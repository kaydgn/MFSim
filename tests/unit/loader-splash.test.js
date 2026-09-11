/**
 * Açılış ekranı (splash) + modül yükleyici — js/loader.js
 * ────────────────────────────────────────────────────────
 * Bu dosyaya kadar `js/loader.js`'in HİÇBİR birim testi yoktu: süre sabitleri,
 * atlanan modül davranışı ve splash ↔ loader kimlik sözleşmesi hiçbir kapının
 * arkasında değildi. Üçü de sessiz kırılma sınıfı —
 *
 *   • `#mfsim-loading-bar` yeniden adlandırılsa çubuk hiç dolmaz, hata çıkmaz;
 *   • bir modül atlanırsa program EKSİK açılır ve tek iz console.warn'dur;
 *   • ipucu döngüsü kapanışta durdurulmazsa uygulama açıldıktan sonra da
 *     arkada saymaya devam eder.
 *
 * Testler gerçek `index.html`'in splash gövdesini kullanıyor (elle kopya
 * DEĞİL): gövde ile yükleyici ayrışırsa buradan kırmızı döner.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LOADER_SRC = loadSource('loader.js');

// index.html'deki açılış ekranı gövdesi — `<script src="js/loader.js">`
// etiketine kadar olan blok.
function splashMarkup() {
  const a = INDEX.indexOf('<div id="mfsim-loading-screen"');
  const b = INDEX.indexOf('<script src="js/loader.js">');
  if (a < 0 || b < 0 || b < a) throw new Error('index.html: açılış ekranı bloğu bulunamadı');
  return INDEX.slice(a, b).trim();
}

// js/loader.js içindeki ELS haritasının değerleri (kimlikler).
function loaderIds() {
  const m = LOADER_SRC.match(/var ELS = \{([\s\S]*?)\};/);
  if (!m) throw new Error('js/loader.js: ELS haritası bulunamadı');
  const out = {};
  m[1].replace(/(\w+)\s*:\s*'([^']+)'/g, (_, k, v) => { out[k] = v; return ''; });
  return out;
}

// ── Sahte belge kurulumu ────────────────────────────────────────────────────
// mods: [{ stage?: 'Çekirdek', label: '...', src?: '...' }]
// src verilmezse satır içi (inline) script kurulur; verilirse jsdom kaynağı
// çekmez → yükleyicinin zaman aşımı/atlama yolu çalışır.
function kur(mods) {
  document.body.innerHTML =
    splashMarkup() +
    '<div id="mfsim-login-overlay" style="display:block"></div>';
  window.__yuklendi = 0;
  mods.forEach((m) => {
    const s = document.createElement('script');
    s.setAttribute('type', 'text/x-mfsim-defer');
    if (m.stage) s.setAttribute('data-mfsim-stage', m.stage);
    if (m.label) s.setAttribute('data-mfsim-label', m.label);
    if (m.src) s.setAttribute('src', m.src);
    else s.textContent = 'window.__yuklendi = (window.__yuklendi || 0) + 1;';
    document.body.appendChild(s);
  });
}

// Sahte saati ilerletirken mikro görevleri (Promise) de boşalt — yükleyici
// her adımda `loadOne(...).then(...)` zinciriyle ilerliyor.
async function ilerlet(ms, adim = 50) {
  const k = Math.min(adim, ms);   // ms < adim ise TAM ms kadar ilerlet
  for (let t = 0; t < ms; t += k) {
    jest.advanceTimersByTime(Math.min(k, ms - t));
    await Promise.resolve();
    await Promise.resolve();
  }
}

function satirlar() {
  return Array.from(document.querySelectorAll('#mfsim-loading-stages li'));
}
function satirOzeti() {
  return satirlar().map((li) => ({
    ad: li.children[1].textContent,
    isaret: li.children[0].textContent,
    sayi: li.children[2].textContent,
    sinif: li.className
  }));
}

function baslat() {
  // Her senaryo için TAZE bir IIFE: `started` bayrağı ve kapanış durumu
  // testler arasında taşınmasın.
  // eslint-disable-next-line no-eval
  eval(LOADER_SRC);
  window.MFSimLoader.start();
}

const KARELER = ['karsilama-01.webp', 'karsilama-02.webp', 'karsilama-04.webp'];

beforeEach(() => {
  jest.useFakeTimers();
  delete window.__MFSIM_BUILD;
  delete window.__MFSIM_KARSILAMA;
  delete window.__MFSIM_ACILIS_KARE;
  delete window.VE_KARSILAMA_GORSELLER;
});
afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = '';
});

// ═══════════════════════════════════════════════════════════════════════════
describe('splash gövdesi ↔ yükleyici kimlik sözleşmesi', () => {
  test('ELS haritasındaki her kimlik gerçekten index.html içinde var', () => {
    const ids = loaderIds();
    const govde = splashMarkup();
    expect(Object.keys(ids).length).toBeGreaterThanOrEqual(8);
    Object.keys(ids).forEach((k) => {
      // login örtüsü splash gövdesinin dışında, ama yine index.html'de.
      const nerede = k === 'login' ? INDEX : govde;
      expect(nerede).toContain('id="' + ids[k] + '"');
    });
  });

  test('#mfsim-loading-screen kimliği korunuyor — 19 E2E beklemesi buna bakıyor', () => {
    expect(loaderIds().splash).toBe('mfsim-loading-screen');
    expect(splashMarkup()).toContain('id="mfsim-loading-screen"');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAHNE — açılış karşılama ekranının kendisiyle başlıyor. İki ayrı sessiz
// kırılma sınıfı var ve ikisi de "program yine açılır" cinsinden:
//   • kare listesi defer setine geri düşerse yükleme ekranı FOTOĞRAFSIZ açılır;
//   • kart geometrisi karşılama kartından ayrışırsa devir teslimde kart oynar.
describe('açılış karesi — liste yükleyiciden ÖNCE', () => {
  test('js/karsilama-gorseller.js defer DEĞİL', () => {
    const etiket = INDEX.match(/<script[^>]*karsilama-gorseller\.js[^>]*>/);
    expect(etiket).not.toBeNull();
    expect(etiket[0]).not.toContain('x-mfsim-defer');
  });

  test('liste js/loader.js\'ten ÖNCE yükleniyor', () => {
    const liste = INDEX.indexOf('js/karsilama-gorseller.js');
    const loader = INDEX.indexOf('<script src="js/loader.js">');
    expect(liste).toBeGreaterThan(-1);
    expect(loader).toBeGreaterThan(-1);
    expect(liste).toBeLessThan(loader);
  });

  test('açılış ekranı gövdesi liste etiketinden ÖNCE — boyanacak katman var', () => {
    expect(INDEX.indexOf('id="mfsim-loading-photo"'))
      .toBeLessThan(INDEX.indexOf('js/karsilama-gorseller.js'));
  });
});

describe('açılış karesi — seçim ve boyama', () => {
  test('listeden bir kare seçilir, katmana boyanır, sınıf eklenir', async () => {
    window.VE_KARSILAMA_GORSELLER = KARELER;
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
    baslat();
    await ilerlet(10);

    const foto = document.getElementById('mfsim-loading-photo');
    const secilen = window.__MFSIM_ACILIS_KARE;
    expect(KARELER).toContain(secilen);
    expect(foto.style.backgroundImage).toContain(secilen);
    expect(document.getElementById('mfsim-loading-screen').className)
      .toContain('mfsim-has-photo');
  });

  test('gömülü kare varsa data URI kullanılır (çevrimdışı tek dosya)', async () => {
    window.VE_KARSILAMA_GORSELLER = ['karsilama-01.webp'];
    window.__MFSIM_KARSILAMA = { 'karsilama-01.webp': 'data:image/webp;base64,AAAA' };
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
    baslat();
    await ilerlet(10);
    expect(document.getElementById('mfsim-loading-photo').style.backgroundImage)
      .toContain('data:image/webp;base64,AAAA');
  });

  test('künye yoksa dosya yoluna düşer (modüler kopya)', async () => {
    window.VE_KARSILAMA_GORSELLER = ['karsilama-01.webp'];
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
    baslat();
    await ilerlet(10);
    expect(document.getElementById('mfsim-loading-photo').style.backgroundImage)
      .toContain('assets/karsilama/karsilama-01.webp');
  });

  test('kare YOKSA ekran kâğıt zeminde açılır — sınıf yok, hata yok', async () => {
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
    baslat();
    await ilerlet(8000);
    expect(document.getElementById('mfsim-loading-photo').style.backgroundImage).toBe('');
    expect(document.getElementById('mfsim-loading-screen').className)
      .not.toContain('mfsim-has-photo');
    expect(window.__MFSIM_ACILIS_KARE).toBeUndefined();
    // ...ve yükleme yine sonuna kadar gider
    expect(document.getElementById('mfsim-loading-percent').textContent).toBe('%100');
  });
});

// Açılış ekranı belgenin varsayılan paletinde yaşıyordu ve kullanıcının teması
// yüklemenin SONUNDA geliyordu (js/theme.js DOMContentLoaded → flushDomReady):
// kart tam devir teslim anında renk değiştiriyordu. Ölçüldü: açılış slate/koyu,
// karşılama pearl/açık.
describe('tema ilk karede', () => {
  const THEME_SRC = loadSource('theme.js');

  test('belgenin varsayılanı js/theme.js\'in varsayılanıyla AYNI', () => {
    const belge = INDEX.match(/<html[^>]*data-theme="([^"]+)"/);
    const modul = THEME_SRC.match(/var savedTheme = '([^']+)'/);
    expect(belge).not.toBeNull();
    expect(modul).not.toBeNull();
    expect(belge[1]).toBe(modul[1]);
  });

  test('kayıtlı tema HİÇBİR ŞEY çizilmeden önce uygulanıyor', () => {
    document.documentElement.setAttribute('data-theme', 'pearl');
    const gercek = window.localStorage.getItem;
    window.localStorage.setItem('mf-theme', 'navy');
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
    // baslat() loader'ı eval eder; tema çağrısı IIFE değerlendirilirken koşar,
    // yani MFSimLoader.start()'tan da önce.
    // eslint-disable-next-line no-eval
    eval(LOADER_SRC);
    expect(document.documentElement.getAttribute('data-theme')).toBe('navy');
    window.localStorage.removeItem('mf-theme');
    expect(typeof gercek).toBe('function');
  });

  test('bozuk kayıt yazılmaz — belge varsayılanı durur', () => {
    document.documentElement.setAttribute('data-theme', 'pearl');
    window.localStorage.setItem('mf-theme', '../kotu değer');
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
    // eslint-disable-next-line no-eval
    eval(LOADER_SRC);
    expect(document.documentElement.getAttribute('data-theme')).toBe('pearl');
    window.localStorage.removeItem('mf-theme');
  });

  test('geçerlilik listesi loader\'da KOPYALANMIYOR — tek kaynak js/theme.js', () => {
    expect(LOADER_SRC).not.toContain('solidworks');
    expect(THEME_SRC).toContain('solidworks');
  });
});

describe('kart geometrisi karşılama kartının İKİZİ', () => {
  const CSS = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
  // Seçici SATIR BAŞINDAN aranıyor: düz indexOf, `.mfsim-loading-panel{`i
  // bileşik seçicinin (`... .mfsim-fading-out .mfsim-loading-panel{`) kuyruğunda
  // da bulur ve yanlış bloğu ölçerdi.
  function blok(secici) {
    const re = new RegExp('^\\s*' + secici.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{', 'm');
    const m = CSS.match(re);
    expect(m).not.toBeNull();
    const i = m.index + m[0].length;
    return CSS.slice(i, CSS.indexOf('}', i));
  }

  // Bu değerlerin AYNI olması bir benzetme değil koşul: iki kart üst üste
  // erirken 1 px'lik fark "kart yerinden oynadı" olarak görülüyor. Karşılama
  // kartında biri değişirse bu test kırmızıya döner ve ikisi birlikte taşınır.
  test.each([
    ['left:56px'],
    ['width:clamp(320px, 29%, 380px)'],
    ['var(--karsilama-kart-r)'],
    ['var(--karsilama-cam)'],
    ['var(--karsilama-cam-blur)'],
    ['var(--karsilama-kart-golge)']
  ])('%s — iki kartta da geçiyor', (deger) => {
    expect(blok('.mfsim-loading-panel')).toContain(deger);
    expect(blok('.ve-welcome-id')).toContain(deger);
  });

  test('kapanışta kart KAYMIYOR — yalnız opaklık', () => {
    const b = blok('.mfsim-loading-screen.mfsim-fading-out .mfsim-loading-panel');
    expect(b).toContain('opacity:0');
    expect(b).not.toContain('translateY');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('index.html aşama işaretleri', () => {
  const defers = INDEX.match(/<script[^>]*type="text\/x-mfsim-defer"[^>]*>/g) || [];

  test('işaretli her etiket bir defer script; en az iki aşama var', () => {
    const isaretli = defers.filter((t) => /data-mfsim-stage=/.test(t));
    const toplamIsaret = (INDEX.match(/data-mfsim-stage=/g) || []).length;
    expect(isaretli.length).toBeGreaterThanOrEqual(2);
    // Aşama işareti defer OLMAYAN bir script'e konarsa yükleyici onu hiç
    // görmez ve o aşama sessizce kaybolur.
    expect(isaretli.length).toBe(toplamIsaret);
  });

  test('İLK defer script işaretli — yoksa ilk öbek adsız "Modüller"e düşer', () => {
    expect(defers.length).toBeGreaterThan(0);
    expect(defers[0]).toContain('data-mfsim-stage=');
  });

  test('aşama adları benzersiz', () => {
    const adlar = (INDEX.match(/data-mfsim-stage="([^"]+)"/g) || [])
      .map((s) => s.slice('data-mfsim-stage="'.length, -1));
    expect(new Set(adlar).size).toBe(adlar.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('aşama listesi', () => {
  test('işaretler öbekleri kurar; işaretsiz script bir öncekine yazılır', async () => {
    kur([
      { stage: 'Çekirdek', label: 'Tema motoru' },
      { label: 'Ayarlar paneli' },
      { label: 'Sekmeler' },
      { stage: 'Takoz', label: 'Takoz: hesap çekirdeği' },
      { label: 'Takoz: rapor üreteci' }
    ]);
    baslat();
    await ilerlet(10);

    expect(satirOzeti().map((r) => [r.ad, r.sayi])).toEqual([
      ['Çekirdek', '0/3'],
      ['Takoz', '0/2']
    ]);
  });

  test('öbek adında & geçebilir — metin olarak yazılıyor, HTML olarak değil', async () => {
    kur([{ stage: 'Araçlar & ölçüm', label: 'Harita modülü' }]);
    baslat();
    await ilerlet(10);
    expect(satirlar()[0].children[1].textContent).toBe('Araçlar & ölçüm');
    expect(satirlar()[0].children[1].innerHTML).toBe('Araçlar &amp; ölçüm');
  });

  test('yükleme ilerledikçe işaret ve sayaç değişir, biten öbek ✓ olur', async () => {
    kur([
      { stage: 'Çekirdek', label: 'Tema motoru' },
      { label: 'Ayarlar paneli' },
      { stage: 'FEAD', label: 'FEAD: kayış kataloğu' }
    ]);
    baslat();
    await ilerlet(10);

    // Başlangıç: ilk öbek etkin, hiçbiri bitmemiş
    expect(satirOzeti()[0].isaret).toBe('›');
    expect(satirOzeti()[0].sinif).toContain('is-active');
    expect(satirOzeti()[1].isaret).toBe('·');

    // İlk iki modül (STEP_DELAY_MS = 150 her adım)
    await ilerlet(400);
    expect(satirOzeti()[0]).toMatchObject({ isaret: '✓', sayi: '2/2' });
    expect(satirOzeti()[0].sinif).toContain('is-done');
    expect(satirOzeti()[1].isaret).toBe('›');

    // Üçüncü modül + minimum toplam süre + kapanış
    await ilerlet(8000);
    expect(satirOzeti().map((r) => r.isaret)).toEqual(['✓', '✓']);
    expect(document.getElementById('mfsim-loading-percent').textContent).toBe('%100');
    expect(document.getElementById('mfsim-loading-message').textContent).toBe('Tamamlandı');
    // Satır içi modüller GERÇEKTEN çalıştı — liste süslemesi değil
    expect(window.__yuklendi).toBe(3);
  });

  test('o anki modülün tam adı ayrı satırda kalır', async () => {
    kur([
      { stage: 'FEAD', label: 'FEAD: kayış kataloğu' },
      { label: 'FEAD: gergi künye kütüphanesi' }
    ]);
    baslat();
    await ilerlet(10);
    expect(document.getElementById('mfsim-loading-message').textContent)
      .toBe('FEAD: kayış kataloğu');
    await ilerlet(200);
    expect(document.getElementById('mfsim-loading-message').textContent)
      .toBe('FEAD: gergi künye kütüphanesi');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('atlanan modül', () => {
  test('yüklenemeyen modül uyarı olarak GÖRÜNÜR, yükleme devam eder', async () => {
    kur([
      { stage: 'Çekirdek', label: 'Tema motoru' },
      { stage: 'Takoz', label: '3D kütüphanesi', src: 'vendor/yok-boyle-bir-dosya.js' },
      { label: 'Takoz: görüntüleyici' }
    ]);
    baslat();

    const uyari = document.getElementById('mfsim-loading-skips');
    expect(uyari.hidden).toBe(true);

    // MODULE_TIMEOUT_MS = 15000 — askıda kalan kaynak bu sürede atlanır
    await ilerlet(16000);
    expect(uyari.hidden).toBe(false);
    expect(uyari.textContent).toContain('3D kütüphanesi');
    expect(uyari.textContent).toContain('konsol');

    // Atlanan modülün öbeği "tamam" görünümüne YÜKSELMEZ
    const takoz = satirOzeti()[1];
    expect(takoz.sinif).toContain('has-skip');
    expect(takoz.isaret).toBe('!');

    // ...ama uygulama yine açılır: kalan modüller yüklendi, ilerleme %100
    await ilerlet(8000);
    expect(document.getElementById('mfsim-loading-percent').textContent).toBe('%100');
    expect(window.__yuklendi).toBe(2);
  });

  test('atlama yoksa uyarı satırı hiç görünmez', async () => {
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
    baslat();
    await ilerlet(8000);
    expect(document.getElementById('mfsim-loading-skips').hidden).toBe(true);
    expect(document.getElementById('mfsim-loading-skips').textContent).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('sürüm künyesi', () => {
  test('gömülü künye varsa commit + PR + tarih yazılır', async () => {
    window.__MFSIM_BUILD = {
      shortSha: 'abc1234', prNumber: 867, date: '2026-09-04T10:00:00Z'
    };
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
    baslat();
    await ilerlet(10);
    const t = document.getElementById('mfsim-loading-stamp').textContent;
    expect(t).toContain('abc1234');
    expect(t).toContain('PR #867');
    expect(t).toContain('04.09.2026');
  });

  test('modüler geliştirme kopyasında künye YOK — satır boş kalır', async () => {
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
    baslat();
    await ilerlet(10);
    expect(document.getElementById('mfsim-loading-stamp').textContent).toBe('');
  });

  test('bozuk tarih künyeyi düşürmez, yalnız tarihi atlar', async () => {
    window.__MFSIM_BUILD = { shortSha: 'def5678', prNumber: 0, date: 'çöp' };
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
    baslat();
    await ilerlet(10);
    expect(document.getElementById('mfsim-loading-stamp').textContent).toBe('def5678');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('ipucu satırı', () => {
  test('açılışta bir ipucu görünür ve süreyle değişir', async () => {
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
    baslat();
    await ilerlet(10);

    const tip = document.getElementById('mfsim-loading-tip');
    const ilk = tip.textContent;
    expect(ilk).toMatch(/^İpucu: .+/);

    // TIP_ROTATE_MS = 4200, geçiş 180 ms
    await ilerlet(4600);
    expect(tip.textContent).toMatch(/^İpucu: .+/);
    expect(tip.textContent).not.toBe(ilk);
  });

  test('kapanışta döngü DURUR — uygulama açıldıktan sonra arkada saymaz', async () => {
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
    baslat();
    await ilerlet(8000);   // yükleme bitti + splash kapandı

    const tip = document.getElementById('mfsim-loading-tip');
    const kapanistaki = tip.textContent;
    await ilerlet(20000);
    expect(tip.textContent).toBe(kapanistaki);
  });
});
