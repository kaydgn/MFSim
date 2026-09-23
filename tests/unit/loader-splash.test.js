/**
 * Açılış ekranı (splash) + modül yükleyici — js/loader.js
 * ────────────────────────────────────────────────────────
 * Bu dosyaya kadar `js/loader.js`'in HİÇBİR birim testi yoktu: süre sabitleri,
 * atlanan modül davranışı ve splash ↔ loader kimlik sözleşmesi hiçbir kapının
 * arkasında değildi. Üçü de sessiz kırılma sınıfı —
 *
 *   • `#mfsim-loading-cetvel` yeniden adlandırılsa cetvel hiç dolmaz, hata çıkmaz;
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

// O anki öbeğin etiketi: Roma rakamı + ad (AMBLEM'de liste yok).
function bolum() {
  const el = document.getElementById('mfsim-loading-bolum');
  return {
    no: el.children[0].textContent,
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
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
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
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
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
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
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
// binince göz sürekli bir KAYMA görüyordu. AMBLEM'de ilerlemeyi 12 bölmeli
// CETVEL söylüyor ve yüzde görünmüyor. Üç sessiz kırılma sınıfı var:
//   • bölme sayısı CSS ile JS'te AYRI yazılırsa bölmeler sütunlara oturmaz;
//   • son kademe atlanırsa cetvel hiç dolmaz;
//   • vurgulu uç bitişte kalırsa "hâlâ yükleniyor" gibi durur.
describe('kademeli ilerleme — cetvel', () => {
  const CSS = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');

  test('kademe sayısı TEK KAYNAK — CSS jetonu, loader onu OKUYOR', () => {
    expect(CSS).toMatch(/--mfsim-kademe:\s*\d+/);
    expect(LOADER_SRC).toContain("getPropertyValue('--mfsim-kademe')");
    // Cetvelin ızgarası da aynı jetondan: bölmeleri JS kuruyor, sütunları CSS.
    expect(CSS).toMatch(/\.mfsim-amblem-cetvel\{[^}]*grid-template-columns:repeat\(var\(--mfsim-kademe\)/);
  });

  test('cetvel kademe başına BİR bölme kuruyor', async () => {
    kur([{ stage: 'Çekirdek', label: 'Tema motoru' }]);
    baslat();
    await ilerlet(10);
    // jsdom stil sayfası yüklemez: jeton okunamaz, tasarım değerine (12) düşer.
    expect(cetvel().bolme).toBe(12);
  });

  test('ilerleme KADEMEYE yuvarlanıyor — her modülde kımıldamıyor', async () => {
    kur(Array.from({ length: 24 }, (_, i) => ({
      stage: i === 0 ? 'Çekirdek' : undefined, label: 'Modül ' + i
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
      stage: i === 0 ? 'Çekirdek' : undefined, label: 'Modül ' + i
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
      stage: i === 0 ? 'Çekirdek' : undefined, label: 'Modül ' + i
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

  test('modül adı da KADEMEYLE değişir — 85 kez çırpınmaz', async () => {
    kur(Array.from({ length: 24 }, (_, i) => ({
      stage: i === 0 ? 'Çekirdek' : undefined, label: 'Modül ' + i
    })));
    baslat();
    await ilerlet(10);
    const msg = () => document.getElementById('mfsim-loading-message').textContent;
    expect(msg()).toBe('Modül 0');
    await ilerlet(200);          // modül 1 yükleniyor, kademe DEĞİŞMEDİ
    expect(msg()).toBe('Modül 0');
    await ilerlet(200);          // modül 2 → kademe 1
    expect(msg()).toBe('Modül 2');
  });

  test('süsleme hareketleri KALDIRILDI — dönen dişli ve parıltı yok', () => {
    expect(CSS).not.toContain('mfsim-loading-spin');
    expect(CSS).not.toContain('mfsim-loading-shimmer');
    expect(CSS).not.toContain('.mfsim-loading-bar::after');
  });
});

// AMBLEM'in iki görünüm kuralı — ikisi de "program yine açılır" cinsinden
// sessiz kırılma: perde temadan kopunca açık temada yazı okunmaz olur, kapanış
// kayarsa uçan marka ile amblem aynı anda iki yöne gider.
describe('amblem — perde ve kapanış', () => {
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

  // Tema-nötr siyah bir perde (rgba(0,0,0,…)) çıplak renk kapısından GEÇER —
  // o kapı siyahı meşru sayıyor. Ama açık temada yazı koyu: siyah perde onu
  // koyu zemine oturturdu. Perdenin tek rengi temanın kendi zemini.
  test('perde TEMANIN ZEMİNİNDEN — başka renk yok', () => {
    const b = kural('.mfsim-amblem-perde');
    expect(b).not.toBeNull();
    const renkler = (b.match(/var\(--[a-z0-9-]+\)/g) || []);
    expect(renkler.length).toBeGreaterThanOrEqual(4);
    expect(new Set(renkler)).toEqual(new Set(['var(--bg-primary)']));
    expect(b).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  test('fotoğraf yoksa perde de yok — kâğıdın üstünde ikinci kâğıt olmasın', () => {
    expect(kural('.mfsim-loading-screen:not(.mfsim-has-photo) .mfsim-amblem-perde'))
      .toMatch(/display:\s*none/);
  });

  test('kapanışta amblem KAYMIYOR — yalnız opaklık', () => {
    const b = kural('.mfsim-loading-screen.mfsim-fading-out .mfsim-amblem');
    expect(b).not.toBeNull();
    expect(b).toContain('opacity:0');
    expect(b).not.toMatch(/transform|translate/);
  });
});

// Modül giriş ekranı (js/module-loader.js) kartlı kaldı: tıklanan karşılama
// kartının YERİNDE beliriyor. Açılış ekranı 2026-09-23'e kadar bu paneli
// kullanıyordu; kural o günden beri modül girişinin.
describe('modül giriş paneli karşılama kartının İKİZİ', () => {
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

  // Bu değerlerin AYNI olması bir benzetme değil koşul: panel kartın yerinde
  // belirirken 1 px'lik fark "kart yerinden oynadı" olarak görülüyor.
  // Karşılama kartında biri değişirse bu test kırmızıya döner ve ikisi
  // birlikte taşınır.
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

  // Amblem de kartın SOL KENARINDA duruyor: devir teslimde marka kartın
  // kenarından içeri iniyor, yandan gelmiyor.
  test('amblem karşılama kartıyla aynı sol kenarda', () => {
    expect(blok('.mfsim-amblem')).toContain('left:56px');
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
// okunmuyor ama hepsi okunmayı bekliyormuş gibi duruyordu. AMBLEM'de yalnız
// o anki öbek var, Roma rakamıyla. Rakam index.html'deki sıradan TÜRER —
// öbek eklenince ya da yer değiştirince burada güncellenecek bir sayı yok.
describe('o anki öbek', () => {
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
    expect(bolum()).toMatchObject({ no: 'I', ad: 'Çekirdek' });
    await ilerlet(400);            // iki modül bitti — işaretsiz ikisi hâlâ Çekirdek'te
    expect(bolum()).toMatchObject({ no: 'I', ad: 'Çekirdek' });
    await ilerlet(100);            // üçüncü bitti → sıradaki öbek
    expect(bolum()).toMatchObject({ no: 'II', ad: 'Takoz' });
  });

  test('öbek adında & geçebilir — metin olarak yazılıyor, HTML olarak değil', async () => {
    kur([{ stage: 'Araçlar & ölçüm', label: 'Harita modülü' }]);
    baslat();
    await ilerlet(10);
    const ad = document.getElementById('mfsim-loading-bolum').children[1];
    expect(ad.textContent).toBe('Araçlar & ölçüm');
    expect(ad.innerHTML).toBe('Araçlar &amp; ölçüm');
  });

  test('Roma rakamı öbek SIRASINDAN — 4 → IV, 9 → IX, 14 → XIV', async () => {
    kur(Array.from({ length: 14 }, (_, i) => ({ stage: 'Öbek ' + (i + 1), label: 'M' + i })));
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
      { stage: 'Çekirdek', label: 'A' },
      { label: 'B' },
      { stage: 'Takoz', label: 'C' }
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

  test('yükleme bitince etiket "✓ Hazır", cetvel tam, modüller GERÇEKTEN çalıştı', async () => {
    kur([
      { stage: 'Çekirdek', label: 'Tema motoru' },
      { label: 'Ayarlar paneli' },
      { stage: 'FEAD', label: 'FEAD: kayış kataloğu' }
    ]);
    baslat();
    await ilerlet(10);
    expect(bolum()).toMatchObject({ no: 'I', ad: 'Çekirdek' });
    await ilerlet(400);
    expect(bolum()).toMatchObject({ no: 'II', ad: 'FEAD' });

    // Üçüncü modül + minimum toplam süre + kapanış
    await ilerlet(8000);
    expect(bolum()).toMatchObject({ no: '✓', ad: 'Hazır' });
    expect(cetvel().aria).toBe('100');
    expect(document.getElementById('mfsim-loading-message').textContent).toBe('Tamamlandı');
    // Satır içi modüller GERÇEKTEN çalıştı — etiket süslemesi değil
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

    // Askıdaki kaynak: öbek etkin ama henüz işaretsiz
    await ilerlet(15000);
    expect(uyari.hidden).toBe(true);
    expect(bolum()).toMatchObject({ no: 'II', ad: 'Takoz' });
    expect(bolum().sinif).not.toContain('is-atlandi');

    // MODULE_TIMEOUT_MS = 15000 — iki adımdan (2 × 150 ms) sonra başlayan
    // bekleme 15 300'de dolar, kaynak atlanır; sıradaki modül 150 ms sonra
    await ilerlet(350);
    expect(uyari.hidden).toBe(false);
    expect(uyari.textContent).toContain('3D kütüphanesi');
    expect(uyari.textContent).toContain('konsol');

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
