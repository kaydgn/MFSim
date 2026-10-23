/**
 * Açılış ekranı (splash) + modül yükleyici — js/loader.js
 * ────────────────────────────────────────────────────────
 * Bu dosyaya kadar `js/loader.js`'in HİÇBİR birim testi yoktu: süre sabitleri,
 * atlanan modül davranışı ve splash ↔ loader kimlik sözleşmesi hiçbir kapının
 * arkasında değildi. Üçü de sessiz kırılma sınıfı —
 *
 *   • `#mfsim-loading-cetvel` yeniden adlandırılsa cetvel hiç dolmaz, hata çıkmaz;
 *   • bir modül atlanırsa program EKSİK açılır ve tek iz console.warn'dur.
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
// mods: [{ stage?: 'Çekirdek', src?: '...' }]
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

// O anki öbeğin etiketi: Roma rakamı + ad (listesi yok — yalnız o anki öbek).
function bolum() {
  const el = document.getElementById('mfsim-loading-bolum');
  return {
    // Hazır işareti çizgi ikon (karar 10·B): metni yok, sınıfı var.
    no: el.children[0].querySelector('.mf-ico-check') ? 'tik' : el.children[0].textContent,
    ad: el.children[1].textContent,
    sinif: el.className,
    belir: el.getAttribute('data-belir')
  };
}
// Cetvel: bölme sayısı, geçilen, vurgulu uç ve yardımcı teknolojiye giden değer.
function cetvel() {
  const el = document.getElementById('mfsim-loading-cetvel');
  return {
    bolme: el.children.length,
    gecti: el.querySelectorAll('span.is-gecti').length,
    son: Array.from(el.children).findIndex((c) => c.classList.contains('is-son')),
    aria: el.getAttribute('aria-valuenow')
  };
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
  delete window.veKarsilamaEkranaUygun;
  delete window.veKarsilamaEkranOlcusu;
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
    kur([{ stage: 'Çekirdek' }]);
    baslat();
    await ilerlet(10);

    const foto = document.getElementById('mfsim-loading-photo');
    const secilen = window.__MFSIM_ACILIS_KARE;
    expect(KARELER).toContain(secilen);
    expect(foto.style.backgroundImage).toContain(secilen);
    expect(document.getElementById('mfsim-loading-screen').className)
      .toContain('mfsim-has-photo');
  });

  // Kullanıcı kararı 6·2: ekranda ×1,25'ten fazla büyüyen kare dönmez — açılış
  // karesi de slaytla AYNI süzgeçten geçer (js/karsilama-gorseller.js).
  test('açılış karesi ekrana göre süzülür — büyüyen kare hiç seçilmez', async () => {
    const K = require('../../js/karsilama-gorseller.js');
    window.VE_KARSILAMA_GORSELLER = ['karsilama-01.webp', 'karsilama-04.webp'];  // 1024 px · 1920 px
    window.veKarsilamaEkranaUygun = K.veKarsilamaEkranaUygun;
    window.veKarsilamaEkranOlcusu = () => [1920, 1080];
    const gercek = Math.random;
    const secilen = new Set();
    try {
      for (const r of [0, 0.3, 0.6, 0.99]) {
        Math.random = () => r;
        document.body.innerHTML = '';
        kur([{ stage: 'Çekirdek' }]);
        baslat();
        await ilerlet(10);
        secilen.add(window.__MFSIM_ACILIS_KARE);
      }
    } finally { Math.random = gercek; }
    expect([...secilen]).toEqual(['karsilama-04.webp']);
  });

  test('gömülü kare varsa data URI kullanılır (çevrimdışı tek dosya)', async () => {
    window.VE_KARSILAMA_GORSELLER = ['karsilama-01.webp'];
    window.__MFSIM_KARSILAMA = { 'karsilama-01.webp': 'data:image/webp;base64,AAAA' };
    kur([{ stage: 'Çekirdek' }]);
    baslat();
    await ilerlet(10);
    expect(document.getElementById('mfsim-loading-photo').style.backgroundImage)
      .toContain('data:image/webp;base64,AAAA');
  });

  test('künye yoksa dosya yoluna düşer (modüler kopya)', async () => {
    window.VE_KARSILAMA_GORSELLER = ['karsilama-01.webp'];
    kur([{ stage: 'Çekirdek' }]);
    baslat();
    await ilerlet(10);
    expect(document.getElementById('mfsim-loading-photo').style.backgroundImage)
      .toContain('assets/karsilama/karsilama-01.webp');
  });

  test('kare YOKSA ekran kâğıt zeminde açılır — sınıf yok, hata yok', async () => {
    kur([{ stage: 'Çekirdek' }]);
    baslat();
    await ilerlet(8000);
    expect(document.getElementById('mfsim-loading-photo').style.backgroundImage).toBe('');
    expect(document.getElementById('mfsim-loading-screen').className)
      .not.toContain('mfsim-has-photo');
    expect(window.__MFSIM_ACILIS_KARE).toBeUndefined();
    // ...ve yükleme yine sonuna kadar gider
    expect(cetvel().aria).toBe('100');
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
    // theme.js'in varsayılanı TEK sabitte: MF_VARSAYILAN = MF_ACIK.
    const sabit = THEME_SRC.match(/var MF_VARSAYILAN = (MF_[A-Z]+);/);
    expect(belge).not.toBeNull();
    expect(sabit).not.toBeNull();
    const deger = THEME_SRC.match(new RegExp('var ' + sabit[1] + " = '([^']+)';"));
    expect(deger).not.toBeNull();
    expect(belge[1]).toBe(deger[1]);
  });

  test('kayıtlı kip HİÇBİR ŞEY çizilmeden önce uygulanıyor', () => {
    document.documentElement.setAttribute('data-theme', 'acik');
    const gercek = window.localStorage.getItem;
    window.localStorage.setItem('mf-theme', 'koyu');
    kur([{ stage: 'Çekirdek' }]);
    // baslat() loader'ı eval eder; tema çağrısı IIFE değerlendirilirken koşar,
    // yani MFSimLoader.start()'tan da önce.
    // eslint-disable-next-line no-eval
    eval(LOADER_SRC);
    expect(document.documentElement.getAttribute('data-theme')).toBe('koyu');
    window.localStorage.removeItem('mf-theme');
    expect(typeof gercek).toBe('function');
  });

  // ESKİ KİMLİK GÖÇÜ DE İLK KAREDE. Ondokuz temadan kalan bir kayıt
  // ('navy' gibi) yeni sözlükte yok; göç yüklemenin sonuna bırakılsaydı
  // koyu tema seçmiş kullanıcı açılışı AÇIK zeminde görür, sonra ekran
  // koyuya devrilirdi — tam olarak bu dosyanın kapattığı sıçrama.
  test('eski kimlik ilk karede göçüyor', () => {
    document.documentElement.setAttribute('data-theme', 'acik');
    window.localStorage.setItem('mf-theme', 'navy');
    kur([{ stage: 'Çekirdek' }]);
    // eslint-disable-next-line no-eval
    eval(LOADER_SRC);
    expect(document.documentElement.getAttribute('data-theme')).toBe('koyu');
    window.localStorage.removeItem('mf-theme');
  });

  // DAVRANIŞ DEĞİŞTİ: eskiden tanınmayan değer HİÇ YAZILMIYORDU (belge
  // varsayılanı dururdu). Artık çözücü her zaman yazar — çünkü 'sistem'
  // kipinin karşılığı ancak matchMedia okunarak bulunur ve yazılmazsa
  // belge :root'a düşerdi. Tanınmayan değerin karşılığı VARSAYILAN.
  test('bozuk kayıt varsayılana düşer, çöpten türetilmez', () => {
    document.documentElement.setAttribute('data-theme', 'koyu');
    window.localStorage.setItem('mf-theme', '../kotu değer');
    kur([{ stage: 'Çekirdek' }]);
    // eslint-disable-next-line no-eval
    eval(LOADER_SRC);
    expect(document.documentElement.getAttribute('data-theme')).toBe('acik');
    window.localStorage.removeItem('mf-theme');
  });

  // ESKİDEN: "geçerlilik listesi loader'da KOPYALANMIYOR — tek kaynak
  // js/theme.js". O hüküm ondokuz tema dönemine aitti ve artık TERSİ geçerli:
  // loader eski kimlikleri TANIMAK ZORUNDA, yoksa göçü ilk karede yapamaz
  // (yukarıdaki halka). Kopya bilinçli ve GEÇİCİ — kayıtlar yeni sözlüğe
  // döndükçe bu üç liste birlikte silinebilir.
  // Korunması gereken şey "kopya yok" değil "kopyalar AYNI kararı veriyor":
  // kapı tests/unit/theme-consistency.test.js › "iki ilk-kare yolu AYNI
  // kimliği çözüyor" ve "üç göç yolu aynı aileye düşüyor".
  test('loader eski kimlikleri göç için tanıyor', () => {
    expect(LOADER_SRC).toContain('solidworks');
    expect(THEME_SRC).toContain('solidworks');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// KADEMELİ İLERLEME. Ölçüldü: ilerleme 85 modülün her birinde kımıldıyordu,
// yani adım %1,2 ve adımlar 150 ms arayla — 180 ms'lik geçişler üst üste
// binince göz sürekli bir KAYMA görüyordu. İlerlemeyi 12 bölmeli CETVEL
// söylüyor (SİNEMA'da alt bandın üst kenarı) ve yüzde görünmüyor. Üç sessiz kırılma sınıfı var:
//   • bölme sayısı CSS ile JS'te AYRI yazılırsa bölmeler sütunlara oturmaz;
//   • son kademe atlanırsa cetvel hiç dolmaz;
//   • vurgulu uç bitişte kalırsa "hâlâ yükleniyor" gibi durur.
describe('kademeli ilerleme — cetvel', () => {
  const CSS = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');

  test('kademe sayısı TEK KAYNAK — CSS jetonu, loader onu OKUYOR', () => {
    expect(CSS).toMatch(/--mfsim-kademe:\s*\d+/);
    expect(LOADER_SRC).toContain("getPropertyValue('--mfsim-kademe')");
    // Cetvelin ızgarası da aynı jetondan: bölmeleri JS kuruyor, sütunları CSS.
    expect(CSS).toMatch(/\.mfsim-sinema-cetvel\{[^}]*grid-template-columns:repeat\(var\(--mfsim-kademe\)/);
  });

  test('cetvel kademe başına BİR bölme kuruyor', async () => {
    kur([{ stage: 'Çekirdek' }]);
    baslat();
    await ilerlet(10);
    // jsdom stil sayfası yüklemez: jeton okunamaz, tasarım değerine (12) düşer.
    expect(cetvel().bolme).toBe(12);
  });

  test('ilerleme KADEMEYE yuvarlanıyor — her modülde kımıldamıyor', async () => {
    kur(Array.from({ length: 24 }, (_, i) => ({
      stage: i === 0 ? 'Çekirdek' : undefined
    })));
    baslat();
    await ilerlet(10);
    expect(cetvel()).toMatchObject({ gecti: 0, son: -1, aria: '0' });
    await ilerlet(200);            // 1 modül bitti → 1/24, kademe hâlâ 0
    expect(cetvel()).toMatchObject({ gecti: 0, son: -1, aria: '0' });
    await ilerlet(200);            // 2 modül → kademe 1/12
    // Son geçilen bölme VURGU taşıyor — ilerlemenin ucu.
    expect(cetvel()).toMatchObject({ gecti: 1, son: 0, aria: '8' });
  });

  test('SON KADEME atlanmıyor — yükleme bitince cetvel TAM ve ucu sönük', async () => {
    kur(Array.from({ length: 85 }, (_, i) => ({
      stage: i === 0 ? 'Çekirdek' : undefined
    })));
    baslat();
    await ilerlet(20000);
    // Bitişte vurgulu uç KALMAZ: hepsi aynı renge oturur.
    expect(cetvel()).toEqual({ bolme: 12, gecti: 12, son: -1, aria: '100' });
  });

  test('YÜZDE GÖRÜNMÜYOR — değer yalnız yardımcı teknolojiye gidiyor', () => {
    // Kimlik aranıyor, sınıf değil: modül giriş ekranı kendi yüzdesini
    // (#ve-modload-percent) aynı sınıfla taşımaya devam ediyor.
    const govde = splashMarkup();
    expect(govde).not.toContain('id="mfsim-loading-percent"');
    expect(govde).toMatch(/id="mfsim-loading-cetvel"[^>]*role="progressbar"/);
    expect(LOADER_SRC).not.toMatch(/textContent = '%'/);
  });

  test('dişli de kademeyle döner ve %100\'de TAM TUR tamamlar', async () => {
    kur(Array.from({ length: 24 }, (_, i) => ({
      stage: i === 0 ? 'Çekirdek' : undefined
    })));
    baslat();
    await ilerlet(10);
    const ico = document.getElementById('mfsim-loading-logo-ico');
    expect(ico.style.transform).toBe('rotate(0.0deg)');
    await ilerlet(400);                       // 2 modül → 1/12
    expect(ico.style.transform).toBe('rotate(30.0deg)');
    await ilerlet(20000);
    // Tam tur: devir teslimde dişli DİK durur, karşılama logosuna uçarken
    // bir sıçrama olmaz.
    expect(ico.style.transform).toBe('rotate(360.0deg)');
  });

  // DOSYA ADI SATIRI YOK (ARAYÜZ ANLATMAZ — aşama 1 kararı 2026-10-16): 106
  // modülün adı ("FEAD: veri modeli köprüsü…") kademe kademe akıyordu. Satır
  // aşamanın DURUMUNU söyler; script'te kalmış bir `data-mfsim-label` bile
  // ekrana çıkmaz.
  test('DOSYA ADI SATIRI YOK — durum satırı aşamayı söyler', async () => {
    kur(Array.from({ length: 24 }, (_, i) => ({
      stage: i === 0 ? 'Çekirdek' : undefined
    })));
    document.querySelectorAll('script[type="text/x-mfsim-defer"]')
      .forEach((sc, i) => sc.setAttribute('data-mfsim-label', 'Modül ' + i));
    baslat();
    const msg = () => document.getElementById('mfsim-loading-message').textContent;
    const gorulen = new Set();
    for (let t = 0; t < 24; t++) { await ilerlet(150); gorulen.add(msg()); }
    await ilerlet(8000);
    gorulen.add(msg());
    const DURUM = ['Modüller hazırlanıyor…', 'Son hazırlıklar…', 'Tamamlandı'];
    expect([...gorulen].filter((m) => !DURUM.includes(m))).toEqual([]);
    expect(gorulen.has('Modüller hazırlanıyor…')).toBe(true);
    expect(msg()).toBe('Tamamlandı');
    expect(INDEX).not.toContain('data-mfsim-label');
  });

  test('süsleme hareketleri KALDIRILDI — dönen dişli ve parıltı yok', () => {
    expect(CSS).not.toContain('mfsim-loading-spin');
    expect(CSS).not.toContain('mfsim-loading-shimmer');
    expect(CSS).not.toContain('.mfsim-loading-bar::after');
  });
});

// SİNEMA'nın görünüm kuralları — hepsi "program yine açılır" cinsinden
// sessiz kırılma: bandın bir rengi temaya bağlanırsa açık temada marka siyah
// bantta görünmez olur (taban kural tema başlığını, yani KOYU rengi yazıyor);
// kapanış söner ya da süresi yükleyiciden ayrılırsa bantlar yarıda kesilir.
describe('SİNEMA — bantlar ve kapanış', () => {
  const CSS = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
  // Seçici listesinde `anahtar` geçen İLK kuralın gövdesi (yorumlar ayıklanmış).
  function kural(anahtar) {
    const govde = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(govde))) {
      if (m[1].split(',').some((s) => s.trim() === anahtar)) return m[2];
    }
    return null;
  }
  const JETON = ['sinema-bant', 'sinema-yazi', 'sinema-yazi-2', 'sinema-vurgu',
    'sinema-vurgu-yazi', 'sinema-uyari', 'sinema-iyi'];

  // Bandın üstünde rengi olan her kural. Listede olup renk bildirmeyen kural
  // da kırmızı: marka rengini bırakırsa taban kuralın tema başlığına düşer.
  const RENKLI = [
    '.mfsim-sinema-bant',
    '.mfsim-sinema-cetvel > span',
    '.mfsim-sinema-cetvel > span.is-gecti',
    '.mfsim-sinema-cetvel > span.is-gecti.is-son',
    '.mfsim-loading-logo-ico',
    '.mfsim-loading-logo.mfsim-sinema-ad',
    '.mfsim-sinema-ayrac',
    '.mfsim-sinema-kunye',
    '.mfsim-sinema-no',
    '.mfsim-sinema-bolum.is-atlandi .mfsim-sinema-no',
    '.mfsim-sinema-mesaj',
    '.mfsim-loading-skips',
    '.mfsim-loading-stamp'
  ];
  test.each(RENKLI)('%s — rengi yalnız --sinema-* jetonundan', (sec) => {
    const b = kural(sec);
    expect(b).not.toBeNull();
    const bildirim = b.split(';').map((d) => d.trim())
      .filter((d) => /^(color|background|background-color)\s*:/.test(d));
    expect(bildirim.length).toBeGreaterThan(0);
    bildirim.forEach((d) => {
      const deger = d.slice(d.indexOf(':') + 1);
      expect(deger).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
      const jetonlar = deger.match(/var\(--[a-z0-9-]+\)/g) || [];
      expect(jetonlar.length).toBeGreaterThan(0);
      jetonlar.forEach((j) => expect(j).toMatch(/^var\(--sinema-/));
    });
  });

  test('taban kural tema başlığını yazıyor — marka onu bileşik seçiciyle eziyor', () => {
    expect(kural('.mfsim-loading-logo')).toContain('color:var(--text-heading)');
    expect(kural('.mfsim-loading-logo.mfsim-sinema-ad')).toContain('color:var(--sinema-yazi)');
  });

  // Temadan bağımsızlık bir kopya disiplini değil: jeton TEK yerde. Koyu blok
  // bir değer yazsaydı iki temada iki ayrı bant olurdu.
  test('jetonlar palette BİR KEZ, :root ile ortak açık blokta', () => {
    const acik = (CSS.match(/:root, \[data-theme="acik"\] \{([\s\S]*?)\n {4}\}/) || [])[1] || '';
    expect(acik).toContain('--bg-primary');
    JETON.forEach((j) => {
      const tanim = CSS.match(new RegExp('--' + j + ':\\s*#[0-9a-fA-F]{6};', 'g')) || [];
      expect([j, tanim.length]).toEqual([j, 1]);
      expect(acik).toMatch(new RegExp('--' + j + ':\\s*#[0-9a-fA-F]{6};'));
    });
  });

  test('bandın yazıları banda karşı AA (≥ 4,5:1), vurgu ≥ 3:1', () => {
    const deger = (j) => CSS.match(new RegExp('--' + j + ':\\s*(#[0-9a-fA-F]{6});'))[1];
    const lin = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    const lum = (h) => [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16)))
      .reduce((t, c, i) => t + c * [0.2126, 0.7152, 0.0722][i], 0);
    const oran = (a, b) => {
      const L = [lum(a), lum(b)].sort((x, y) => y - x);
      return (L[0] + 0.05) / (L[1] + 0.05);
    };
    const bant = deger('sinema-bant');
    const dusen = [];
    ['sinema-yazi', 'sinema-yazi-2', 'sinema-vurgu-yazi', 'sinema-uyari', 'sinema-iyi'].forEach((j) => {
      if (oran(deger(j), bant) < 4.5) dusen.push(j);
    });
    if (oran(deger('sinema-vurgu'), bant) < 3) dusen.push('sinema-vurgu');
    expect(dusen).toEqual([]);
  });

  // KAPANIŞ: perde açılır. Bantlar SÖNMEZ (sert kalır), ekrandan çıkar; süre
  // yükleyicinin display:none beklemesiyle AYNI.
  test('kapanışta bantlar ekrandan ÇIKIYOR — üstteki yukarı, alttaki aşağı', () => {
    expect(kural('.mfsim-loading-screen.mfsim-fading-out .mfsim-sinema-ust'))
      .toMatch(/transform:\s*translateY\(-100%\)/);
    expect(kural('.mfsim-loading-screen.mfsim-fading-out .mfsim-sinema-alt'))
      .toMatch(/transform:\s*translateY\(100%\)/);
  });

  test('bantların geçişi js/loader.js › FADE_OUT_MS ile AYNI süre', () => {
    const ms = +(LOADER_SRC.match(/var FADE_OUT_MS = (\d+);/) || [])[1];
    expect(ms).toBeGreaterThan(0);
    const g = (kural('.mfsim-sinema-bant') || '').match(/transition:\s*transform\s+([\d.]+)(m?s)/);
    expect(g).not.toBeNull();
    expect(g[2] === 'ms' ? +g[1] : Math.round(+g[1] * 1000)).toBe(ms);
  });

  test('ekran SÖNMÜYOR — yalnız fotoğraf katmanı, bantlardan önce', () => {
    const ekran = kural('.mfsim-loading-screen.mfsim-fading-out');
    expect(ekran).not.toBeNull();
    expect(ekran).not.toMatch(/opacity/);
    const foto = kural('.mfsim-loading-screen.mfsim-fading-out .mfsim-loading-photo');
    expect(foto).toContain('opacity:0');
    const g = foto.match(/transition:\s*opacity\s+([\d.]+)s/);
    const ms = +(LOADER_SRC.match(/var FADE_OUT_MS = (\d+);/) || [])[1];
    expect(g).not.toBeNull();
    expect(Math.round(+g[1] * 1000)).toBeLessThanOrEqual(ms);
  });

  test('perde YOK — fotoğrafın üstünde bantlardan başka katman yok', () => {
    const govde = splashMarkup();
    expect(govde).not.toMatch(/perde/);
    // Fotoğraf + iki bant: ekranın doğrudan çocukları.
    document.body.innerHTML = govde;
    const cocuk = Array.from(document.getElementById('mfsim-loading-screen').children)
      .map((e) => e.id || e.className);
    expect(cocuk).toEqual(['mfsim-loading-photo',
      'mfsim-sinema-bant mfsim-sinema-ust', 'mfsim-sinema-bant mfsim-sinema-alt']);
  });
});

// Modül giriş ekranı (js/module-loader.js) kartlı kaldı: tıklanan karşılama
// kartının YERİNDE beliriyor. Açılış ekranı 2026-09-23'e kadar bu paneli
// kullanıyordu; kural o günden beri modül girişinin.
describe('modül giriş ekranı karşılamanın KESİĞİNDE', () => {
  const CSS = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
  // Seçici SATIR BAŞINDAN aranıyor: düz indexOf, `.mfsim-loading-panel{`i
  // bileşik seçicinin kuyruğunda da bulur ve yanlış bloğu ölçerdi.
  function blok(secici) {
    const re = new RegExp('^\\s*' + secici.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{', 'm');
    const m = CSS.match(re);
    expect(m).not.toBeNull();
    const i = m.index + m[0].length;
    return CSS.slice(i, CSS.indexOf('}', i));
  }
  const belge = new DOMParser().parseFromString(INDEX, 'text/html');

  // Tıklanınca kesik KIMILDAMAMALI: giriş ekranı karşılamanın kesiğini, bakır
  // çizgisini ve içerik sütununu AYNI sınıflarla taşır — geometri tek yerde,
  // ikinci bir kopya yok. (Cam kart döneminde iki kartın değerleri ayrı ayrı
  // yazılıp burada eşitleniyordu.)
  test('iki ekran da kesiği, çizgiyi ve sütunu AYNI sınıflarla taşıyor', () => {
    expect(belge.querySelector('.ve-welcome > .ve-kesik > .ve-welcome-id.ve-kesik-ic')).not.toBeNull();
    expect(belge.querySelector('.ve-welcome > .ve-kesik-cizgi')).not.toBeNull();
    expect(belge.querySelector('#mfsim-module-loading > .ve-kesik > .mfsim-loading-panel.ve-kesik-ic')).not.toBeNull();
    expect(belge.querySelector('#mfsim-module-loading > .ve-kesik-cizgi')).not.toBeNull();
  });

  test('panelin kendi geometrisi YOK — konum ve ölçü yalnız .ve-kesik-ic\'de', () => {
    ['.mfsim-loading-panel', '.ve-welcome-id'].forEach((sec) => {
      const re = new RegExp('^\\s*' + sec.replace('.', '\\.') + '\\s*\\{([^}]*)\\}', 'gm');
      let m;
      while ((m = re.exec(CSS))) expect(m[1]).not.toMatch(/(^|;|\s)(position|left|top|bottom|width)\s*:/);
    });
    expect(blok('.ve-kesik-ic')).toMatch(/position:absolute/);
  });

  // Bantların içeriği de kesiğin içeriğiyle AYNI sol kenarda: devir teslimde
  // marka sütunun kenarına iner, yandan gelmez.
  test('bantların içeriği kesiğin içeriğiyle aynı sol kenarda', () => {
    expect(blok('.ve-kesik-ic')).toContain('left:56px');
    expect(blok('.mfsim-sinema-satir')).toContain('left:56px');
    expect(blok('.mfsim-sinema-ust-satir')).toContain('left:56px');
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
// O ANKİ ÖBEK. Eskiden bütün öbekler sayaçlarıyla alt alta duruyordu; hiçbiri
// okunmuyor ama hepsi okunmayı bekliyormuş gibi duruyordu. Artık yalnız
// o anki öbek var, Roma rakamıyla. Rakam index.html'deki sıradan TÜRER —
// öbek eklenince ya da yer değiştirince burada güncellenecek bir sayı yok.
describe('o anki öbek', () => {
  test('işaretler öbekleri kurar; işaretsiz script bir öncekine yazılır', async () => {
    kur([
      { stage: 'Çekirdek' },
      {},
      {},
      { stage: 'Takoz' },
      {}
    ]);
    baslat();
    await ilerlet(10);
    expect(bolum()).toMatchObject({ no: 'I', ad: 'Çekirdek' });
    await ilerlet(400);            // iki modül bitti — işaretsiz ikisi hâlâ Çekirdek'te
    expect(bolum()).toMatchObject({ no: 'I', ad: 'Çekirdek' });
    await ilerlet(100);            // üçüncü bitti → sıradaki öbek
    expect(bolum()).toMatchObject({ no: 'II', ad: 'Takoz' });
  });

  test('öbek adında & geçebilir — metin olarak yazılıyor, HTML olarak değil', async () => {
    kur([{ stage: 'Araçlar & ölçüm' }]);
    baslat();
    await ilerlet(10);
    const ad = document.getElementById('mfsim-loading-bolum').children[1];
    expect(ad.textContent).toBe('Araçlar & ölçüm');
    expect(ad.innerHTML).toBe('Araçlar &amp; ölçüm');
  });

  test('Roma rakamı öbek SIRASINDAN — 4 → IV, 9 → IX, 14 → XIV', async () => {
    kur(Array.from({ length: 14 }, (_, i) => ({ stage: 'Öbek ' + (i + 1) })));
    baslat();
    const gorulen = [];
    for (let i = 0; i < 14; i++) {
      await ilerlet(i === 0 ? 10 : 150);
      gorulen.push(bolum().no);
    }
    expect(gorulen).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
      'XI', 'XII', 'XIII', 'XIV']);
  });

  test('etiket yalnız öbek DEĞİŞİNCE belirir — öbek içinde kımıldamaz', async () => {
    kur([
      { stage: 'Çekirdek' },
      {},
      { stage: 'Takoz' }
    ]);
    baslat();
    await ilerlet(10);
    const ilk = bolum().belir;
    expect(['a', 'b']).toContain(ilk);
    await ilerlet(200);            // öbek içinde bir modül ilerledi
    expect(bolum().belir).toBe(ilk);
    await ilerlet(200);            // öbek değişti → animasyon adı değişir, bir kez oynar
    expect(bolum().no).toBe('II');
    expect(bolum().belir).not.toBe(ilk);
  });

  test('yükleme bitince etiket "Hazır" + onay ikonu, cetvel tam, modüller GERÇEKTEN çalıştı', async () => {
    kur([
      { stage: 'Çekirdek' },
      {},
      { stage: 'FEAD' }
    ]);
    baslat();
    await ilerlet(10);
    expect(bolum()).toMatchObject({ no: 'I', ad: 'Çekirdek' });
    await ilerlet(400);
    expect(bolum()).toMatchObject({ no: 'II', ad: 'FEAD' });

    // Üçüncü modül + minimum toplam süre + kapanış
    await ilerlet(8000);
    expect(bolum()).toMatchObject({ no: 'tik', ad: 'Hazır' });
    expect(cetvel().aria).toBe('100');
    expect(document.getElementById('mfsim-loading-message').textContent).toBe('Tamamlandı');
    // Satır içi modüller GERÇEKTEN çalıştı — etiket süslemesi değil
    expect(window.__yuklendi).toBe(3);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
describe('atlanan modül', () => {
  test('yüklenemeyen modül uyarı olarak GÖRÜNÜR, yükleme devam eder', async () => {
    kur([
      { stage: 'Çekirdek' },
      { stage: 'Takoz', src: 'vendor/yok-boyle-bir-dosya.js' },
      {}
    ]);
    baslat();

    const uyari = document.getElementById('mfsim-loading-skips');
    expect(uyari.hidden).toBe(true);

    // Askıdaki kaynak: öbek etkin ama henüz işaretsiz
    await ilerlet(15000);
    expect(uyari.hidden).toBe(true);
    expect(bolum()).toMatchObject({ no: 'II', ad: 'Takoz' });
    expect(bolum().sinif).not.toContain('is-atlandi');

    // MODULE_TIMEOUT_MS = 15000 — iki adımdan (2 × 150 ms) sonra başlayan
    // bekleme 15 300'de dolar, kaynak atlanır; sıradaki modül 150 ms sonra
    await ilerlet(350);
    expect(uyari.hidden).toBe(false);
    // Durumu söyler, tarif vermez: dosyanın ADI + "yüklenemedi" (aşama 1
    // kararı — "ayrıntı tarayıcı konsolunda" bir geliştirici tarifiydi).
    expect(uyari.textContent).toBe('yok-boyle-bir-dosya.js yüklenemedi.');

    // Öbek sürdüğü sürece etiketi de işaretli (rakam kehribar)
    expect(bolum()).toMatchObject({ no: 'II', ad: 'Takoz' });
    expect(bolum().sinif).toContain('is-atlandi');

    // ...ama uygulama yine açılır: kalan modüller yüklendi, cetvel tam.
    // Kalıcı iz uyarı satırı: öbek geçince etiket de geçti.
    await ilerlet(8000);
    expect(cetvel().aria).toBe('100');
    expect(bolum().sinif).not.toContain('is-atlandi');
    expect(uyari.hidden).toBe(false);
    expect(window.__yuklendi).toBe(2);
  });

  test('birden çok atlama: sayı ve sonuncunun adı', async () => {
    kur([
      { stage: 'Çekirdek', src: 'vendor/a-yok.js' },
      { src: 'vendor/b-yok.js' },
      {}
    ]);
    baslat();
    await ilerlet(32000);
    expect(document.getElementById('mfsim-loading-skips').textContent)
      .toBe('2 dosya yüklenemedi (son: b-yok.js).');
  });

  test('atlama yoksa uyarı satırı hiç görünmez', async () => {
    kur([{ stage: 'Çekirdek' }]);
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
    kur([{ stage: 'Çekirdek' }]);
    baslat();
    await ilerlet(10);
    const t = document.getElementById('mfsim-loading-stamp').textContent;
    expect(t).toContain('abc1234');
    expect(t).toContain('PR #867');
    expect(t).toContain('04.09.2026');
  });

  test('modüler geliştirme kopyasında künye YOK — satır boş kalır', async () => {
    kur([{ stage: 'Çekirdek' }]);
    baslat();
    await ilerlet(10);
    expect(document.getElementById('mfsim-loading-stamp').textContent).toBe('');
  });

  test('bozuk tarih künyeyi düşürmez, yalnız tarihi atlar', async () => {
    window.__MFSIM_BUILD = { shortSha: 'def5678', prNumber: 0, date: 'çöp' };
    kur([{ stage: 'Çekirdek' }]);
    baslat();
    await ilerlet(10);
    expect(document.getElementById('mfsim-loading-stamp').textContent).toBe('def5678');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// İPUCU SATIRI YOK (aşama 1 kararı 2026-10-16): açılışta dönen "İpucu: …"
// satırı bir tarifti; kısayollar kısayol penceresinde. Döngü de yok —
// kapanıştan sonra arkada sayan bir zamanlayıcı kalmaz.
describe('ipucu satırı', () => {
  test('gövdede ipucu satırı ve yükleyicide ipucu döngüsü yok', async () => {
    expect(splashMarkup()).not.toContain('id="mfsim-loading-tip"');
    expect(LOADER_SRC).not.toMatch(/TIPS|İpucu: |setInterval/);
    kur([{ stage: 'Çekirdek' }]);
    baslat();
    await ilerlet(8000);   // yükleme bitti + splash kapandı
    expect(jest.getTimerCount()).toBe(0);
  });
});

// GENEL HATA YAKALAYICI — bildirim DURUM söyler (aşama 1 kararı): söz reddi de
// "Beklenmeyen hata" (JavaScript terimi çevirisi "Islenmemis soz reddi" idi),
// üçüncü bildirimin "(sonraki hatalar yalnizca konsola yazilacak)" eki yok.
// Yakalayıcı sahte bir pencereye kurulur: gerçek pencereye her `baslat()`
// yeni dinleyici ekliyor, sayım onlarla karışırdı.
describe('genel hata yakalayıcı', () => {
  const YAKALAYICI = LOADER_SRC.slice(0, LOADER_SRC.indexOf('// ═══ MFSim Loader'));
  const kurYakalayici = () => {
    const dinle = {};
    const toast = jest.fn();
    // eslint-disable-next-line no-new-func
    new Function('window', 'console', 'showToast', YAKALAYICI)(
      { addEventListener: (t, f) => { dinle[t] = f; } }, { error() {} }, toast);
    return { dinle, toast };
  };

  test('hata ve söz reddi AYNI başlıkla; en çok üç bildirim, ek cümle yok', () => {
    const { dinle, toast } = kurYakalayici();
    dinle.error({ error: new Error('bir'), filename: 'a.js', lineno: 3 });
    dinle.unhandledrejection({ reason: new Error('iki') });
    dinle.unhandledrejection({ reason: 'üç' });
    dinle.unhandledrejection({ reason: new Error('dört') });
    expect(toast.mock.calls).toEqual([
      ['Beklenmeyen hata: bir', 'error'],
      ['Beklenmeyen hata: iki', 'error'],
      ['Beklenmeyen hata: üç', 'error']
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OTOMASYONDA SÜS BEKLEMESİ YOK (2026-10-16). Adım gecikmesi (150 ms) ve en az
// toplam süre (6,5 sn) ilerlemenin GÖZLE izlenmesi içindir; 106 modülde her
// e2e açılışına 15,9 sn ekliyordu ve ürün kapısı (e2e-urun) 20 dk sınırını
// aştı. Kapı iki yönü birden tutar: otomasyonda bekleme yok, insanın açılışı
// birebir eski.
describe('otomasyon: süs beklemesi yok, insanın açılışı aynı', () => {
  const ON = Array.from({ length: 10 }, () => ({}));
  const perde = () => document.getElementById('mfsim-loading-screen').style.display;
  afterEach(() => { delete window.navigator.webdriver; });

  test('navigator.webdriver → modüller arka arkaya yüklenir, perde hemen kalkar', async () => {
    Object.defineProperty(window.navigator, 'webdriver', { value: true, configurable: true });
    kur(ON);
    baslat();
    await ilerlet(30, 1);
    expect(window.__yuklendi).toBe(10);
    await ilerlet(800);                       // "Tamamlandı" 400 ms + söneme 340 ms
    expect(perde()).toBe('none');
  });

  test('insan: adım başına 150 ms ve en az 6,5 sn — eskisinin aynısı', async () => {
    kur(ON);
    baslat();
    await ilerlet(30, 1);
    expect(window.__yuklendi).toBeLessThan(2);
    await ilerlet(1600);                      // 10 × 150 ms: hepsi yüklendi…
    expect(window.__yuklendi).toBe(10);
    expect(perde()).not.toBe('none');         // …ama en az süre dolmadı
    await ilerlet(6500);
    expect(perde()).toBe('none');
  });
});
