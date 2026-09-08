/**
 * karsilama-slayt.test.js — karşılama ekranının arkasındaki slayt
 *
 * KULLANICI İSTEĞİ (2026-09-08): "Modüllerin arkasına bu resimleri karışık ve
 * slayt halinde koy, yumuşak geçişlerle."
 *
 * DÖRT SESSİZ HATA SINIFI — dördü de "program çalışır, kimse uyarmaz":
 *
 * 1) LİSTE ↔ KLASÖR AYRIŞMASI. Kare listesi (js/karsilama-gorseller.js) ile
 *    assets/karsilama/ içeriği birbirinden habersiz. Bir dosya silinirse slayt
 *    404'e düşer (modüler kopyada boş kare, tek dosyada gömülmemiş ad); yeni bir
 *    dosya eklenip listeye yazılmazsa hiç görünmez. İki yönlü tutuluyor.
 *
 * 2) BOYUT KAÇAĞI. Kareler tek dosyaya base64 gömülüyor (×1,34). Klasöre 5 MB'lık
 *    bir fotoğraf düşerse indirilen program sessizce şişer. Kare başına ve toplam
 *    tavan burada.
 *
 * 3) KAYNAK SEÇİMİ. Gömülü künye varsa data URI, yoksa dosya yolu kullanılmalı.
 *    Ters giderse tek dosya çevrimdışı açıldığında slayt HİÇ çıkmaz.
 *
 * 4) ZAMANLAYICI SIZINTISI. Slayt modül seçilince durmazsa arka planda kare
 *    değiştirmeye devam eder; iki kez başlatılırsa iki zamanlayıcı birden koşar.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const DIR = path.join(ROOT, 'assets/karsilama');
const CSS = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
const BUILD = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
const LISTE = require('../../js/karsilama-gorseller.js').VE_KARSILAMA_GORSELLER;

const KARE_TAVAN = 260 * 1024;        // kare başına (ölçülen en büyük: 160 KB)
const TOPLAM_TAVAN = 3 * 1024 * 1024; // klasör toplamı (ölçülen: 2,19 MB)

function setupDOM() {
  document.body.innerHTML =
    '<div id="sayfa2-content"><div class="ve-main">' +
    '  <div class="ve-doc-dock"></div>' +
    '  <div class="ve-module-overlay" id="ve-module-overlay">' +
    '    <div class="ve-welcome"><div class="ve-welcome-work">' +
    '      <div class="ve-welcome-slayt" id="ve-welcome-slayt"></div>' +
    '    </div></div>' +
    '  </div>' +
    '</div></div>';
}

// matchMedia jsdom'da yok; varsayılan "hareket açık".
let hareketKapali = false;
global.matchMedia = (q) => ({ matches: hareketKapali && /reduce/.test(q), media: q });

setupDOM();
global.VE_KARSILAMA_GORSELLER = LISTE;   // eval edilen kod BUNU görür
eval(loadSource('canvas-space.js'));
eval(loadSource('components.js'));

beforeEach(() => {
  setupDOM();
  hareketKapali = false;
  delete window.__MFSIM_KARSILAMA;
  veWelcomeSlaytDurdur();
});
afterEach(() => veWelcomeSlaytDurdur());

// ═══ 1) LİSTE ↔ KLASÖR ═════════════════════════════════════════════════════
describe('Kare listesi ile klasör ayrışamaz', () => {
  const diskte = fs.readdirSync(DIR).filter((f) => f.endsWith('.webp')).sort();

  test('klasördeki her kare listede var (öksüz dosya yok)', () => {
    expect(diskte.filter((f) => LISTE.indexOf(f) < 0)).toEqual([]);
  });

  test('listedeki her kare diskte var (kırık ad yok)', () => {
    expect(LISTE.filter((f) => diskte.indexOf(f) < 0)).toEqual([]);
  });

  test('en az iki kare var (tek kare slayt değildir)', () => {
    expect(LISTE.length).toBeGreaterThanOrEqual(2);
  });

  test('adlar düzenli: karsilama-NN.webp', () => {
    LISTE.forEach((f) => expect(f).toMatch(/^karsilama-\d{2}\.webp$/));
  });
});

// ═══ 2) BOYUT KAPISI ═══════════════════════════════════════════════════════
describe('Boyut — kareler tek dosyaya base64 gömülüyor', () => {
  test('hiçbir kare 260 KB\'ı geçmiyor', () => {
    const buyuk = LISTE
      .map((f) => ({ f, b: fs.statSync(path.join(DIR, f)).size }))
      .filter((x) => x.b > KARE_TAVAN)
      .map((x) => x.f + ' (' + Math.round(x.b / 1024) + ' KB)');
    expect(buyuk).toEqual([]);
  });

  test('klasör toplamı 3 MB\'ı geçmiyor', () => {
    const toplam = LISTE
      .reduce((t, f) => t + fs.statSync(path.join(DIR, f)).size, 0);
    expect(toplam).toBeLessThanOrEqual(TOPLAM_TAVAN);
  });

  test('build.js kareleri gömüyor (çevrimdışı tek dosyanın tek yolu)', () => {
    expect(BUILD).toContain('window.__MFSIM_KARSILAMA');
    expect(BUILD).toMatch(/assets['"\s,]+karsilama/);
  });
});

// ═══ 3) KAYNAK SEÇİMİ ══════════════════════════════════════════════════════
describe('Kare kaynağı — gömülü varsa data URI, yoksa dosya yolu', () => {
  test('gömülü künye varken data URI kullanılır', () => {
    window.__MFSIM_KARSILAMA = { 'karsilama-01.webp': 'data:image/webp;base64,AAA' };
    expect(veSlaytKaynak('karsilama-01.webp')).toBe('data:image/webp;base64,AAA');
  });

  test('künye yoksa modüler yola düşer', () => {
    expect(veSlaytKaynak('karsilama-07.webp')).toBe('assets/karsilama/karsilama-07.webp');
  });

  test('künye var ama o kare eksikse yine dosya yoluna düşer', () => {
    window.__MFSIM_KARSILAMA = { 'karsilama-01.webp': 'data:x' };
    expect(veSlaytKaynak('karsilama-02.webp')).toBe('assets/karsilama/karsilama-02.webp');
  });
});

// ═══ 4) SLAYT DAVRANIŞI ════════════════════════════════════════════════════
describe('veWelcomeSlaytBaslat', () => {
  const kap = () => document.getElementById('ve-welcome-slayt');
  const kareler = () => Array.from(kap().querySelectorAll('.ve-welcome-kare'));

  test('iki katman kurar, ilki görünür ve resmi yüklü', () => {
    expect(veWelcomeSlaytBaslat()).toBe(true);
    expect(kareler().length).toBe(2);
    const acik = kareler().filter((k) => k.classList.contains('is-on'));
    expect(acik.length).toBe(1);
    expect(acik[0].style.backgroundImage).toContain('assets/karsilama/karsilama-');
  });

  test('kap yoksa FALSE döner, hata atmaz', () => {
    document.body.innerHTML = '';
    expect(veWelcomeSlaytBaslat()).toBe(false);
  });

  test('kare listesi boşsa kap temizlenir ve FALSE döner', () => {
    const yedek = global.VE_KARSILAMA_GORSELLER;
    global.VE_KARSILAMA_GORSELLER = [];
    expect(veWelcomeSlaytBaslat()).toBe(false);
    expect(kap().innerHTML).toBe('');
    global.VE_KARSILAMA_GORSELLER = yedek;
  });

  test('sıra KARIŞTIRILIYOR — liste sırası korunmuyor', () => {
    // Math.random sabitlenince Fisher-Yates deterministik: sonuç liste sırası OLMAMALI.
    const gercek = Math.random;
    Math.random = () => 0.42;
    const ilkKare = [];
    for (let i = 0; i < 6; i++) { veWelcomeSlaytBaslat(); 
      ilkKare.push(kareler().find((k) => k.classList.contains('is-on')).style.backgroundImage); }
    Math.random = gercek;
    // Karılmamış olsaydı her seferinde listenin ilk karesi çıkardı.
    expect(ilkKare[0]).not.toContain(LISTE[0]);
  });

  test('karılan liste bir PERMÜTASYON — kare kaybolmuyor, çoğalmıyor', () => {
    const gercek = Math.random;
    let n = 0;
    Math.random = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    const k = _veSlaytKarilmis();
    Math.random = gercek;
    expect(k.slice().sort()).toEqual(LISTE.slice().sort());
  });
});

// ═══ 5) ZAMANLAYICI ════════════════════════════════════════════════════════
describe('Zamanlayıcı — sızıntı ve gereksiz koşu yok', () => {
  test('hareket kapalıyken zamanlayıcı KURULMAZ (tek kare durur)', () => {
    hareketKapali = true;
    const spy = jest.spyOn(global, 'setInterval');
    expect(veWelcomeSlaytBaslat()).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('iki kez başlatmak iki zamanlayıcı BIRAKMAZ', () => {
    const temizle = jest.spyOn(global, 'clearInterval');
    veWelcomeSlaytBaslat();
    veWelcomeSlaytBaslat();
    expect(temizle).toHaveBeenCalled();       // ikinci başlatış öncekini kapatıyor
    temizle.mockRestore();
  });

  test('modül seçilince (karşılama gizlenince) slayt durur', () => {
    document.getElementById('ve-module-overlay').style.display = '';
    veSyncModuleShell();                      // karşılama görünür → slayt döner
    const temizle = jest.spyOn(global, 'clearInterval');
    document.getElementById('ve-module-overlay').style.display = 'none';
    veSyncModuleShell();                      // modül seçildi → durmalı
    expect(temizle).toHaveBeenCalled();
    temizle.mockRestore();
  });
});

// ═══ 6) GÖRSEL KATMAN KURALLARI ════════════════════════════════════════════
describe('CSS — okunurluk ve kırpma', () => {
  test('sağ sütun konumlanmış ve taşmayı kırpıyor (Ken Burns sızmasın)', () => {
    const blok = CSS.slice(CSS.indexOf('.ve-welcome-work{'), CSS.indexOf('.ve-welcome-slayt{'));
    expect(blok).toMatch(/position:\s*relative/);
    expect(blok).toMatch(/overflow:\s*hidden/);
  });

  test('içerik slaytın ÜSTÜNDE çiziliyor', () => {
    const m = CSS.match(/\.ve-welcome-eyebrow,\s*\n\.ve-module-overlay-grid\{[^}]*\}/g) || [];
    expect(m.join('')).toMatch(/z-index:\s*1/);
  });

  test('örtü TEMA JETONUNDAN türer — sabit renk yazılmaz', () => {
    const ortu = CSS.slice(CSS.indexOf('.ve-welcome-slayt::after{'));
    const blok = ortu.slice(0, ortu.indexOf('}\n'));
    expect(blok).toContain('var(--bg-primary)');
    expect(blok).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  test('hareket kapalıyken kare hareketi duruyor', () => {
    expect(CSS).toMatch(/prefers-reduced-motion[\s\S]{0,400}\.ve-welcome-kare\.is-on\{[^}]*animation:\s*none/);
  });
});
