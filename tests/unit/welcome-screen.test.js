/**
 * welcome-screen.test.js — karşılama ekranı: kabuk kapanışı + giriş noktaları
 *
 * DEĞİŞİKLİK (2026-09-04, kullanıcı isteği): "Bu kısım geldiğinde, herhangi bir
 * modül seçmeden yukarıdaki tüm toolbar'ın görünmesini istemiyorum."
 *
 * Modül seçilmeden çalışma alanı yok: Kaydet / Doğrula / Çözücü / PNG hiçbir
 * şeye dokunmuyor. Şerit bunu zaten biliyordu ama yalnız PASİF çiziyordu
 * (js/ribbon.js › veRibbonNoWorkspace); sol panel ve ray gizliyken on dört ölü
 * komutun ekranda kalması tutarsızdı. Artık aynı anahtar (veSyncModuleShell)
 * şeridi ve belge bandını da kapatıyor.
 *
 * ÜÇ SESSİZ HATA SINIFI — üçü de "program çalışmaya devam eder, kimse uyarmaz":
 *
 * 1) Sınıf yazılır ama CSS kuralı silinirse şerit geri gelir. Sınıfı yazan yer
 *    (js) ile gizleyen yer (css) AYRI dosyalar; ikisi de burada tutuluyor.
 * 2) #ve-ribbon `.ve-main`in DIŞINDA (position:fixed) → sınıf <body>'ye de
 *    yazılmazsa şerit gizlenmez. --chrome-h sıfırlanmazsa da sayfa şerit
 *    yokken 116px aşağıda durur; boş bir bant kalırdı.
 * 3) Şerit gizlenince oradaki komutlara TEK giriş karşılama ekranı olur.
 *    Kayıtlı proje aç / Kılavuzlar / Ayarlar / Program Durumu düğmelerinden
 *    biri silinirse o komut programda ULAŞILAMAZ hâle gelir.
 *
 * ─── KARŞILAMA TASARIMI (2026-09-07) ────────────────────────────────────────
 * Ekran yeniden tasarlandı; buradaki yeni kapılar o kararların KODDAKİ
 * karşılığını tutuyor. Hepsinin ortak yanı sessiz olmaları: bozulunca program
 * çalışmaya devam eder, hiçbir uyarı çıkmaz.
 *
 *  1) Zemin ızgaradan kâğıda döndü — ızgara geri gelse ekran yine açılır.
 *  2) Tek yazı tipi (T1): bu ekranda mono YOK; rakam hizası tabular-nums'tan.
 *  3) Son değişiklikler paneli commit BAŞLIĞI basıyor — serbest metin, kaçış
 *     düşerse ham HTML çalışır.
 *  4) Güncellik satırı DÜRÜSTLÜK kapısı: gömülü künye "yayın güncel mi"yi
 *     yanıtlamaz, bu yüzden 'local' durumu "Güncel" DEMEZ.
 *  5) Açılış koreografisi CSS'te, tetikleyicisi JS'te — ikisi ayrı dosya.
 *  6) Uçuş ve marka devri DEKOR: eksikliği modül açılışını engellemez.
 *
 * ─── KESİK (2026-10-23, kullanıcı kararı "6d · İnce") ───────────────────────
 * Asılı cam kart yerine ekranı boydan boya kesen siyah bir sütun; eğik
 * kenarına paralel bakır çizgi. Kesik açılış sinemasının jetonlarıyla çizilir
 * (temadan bağımsız) — tema rengi sızarsa açık temada koyu yazı siyah kesikte
 * kaybolur ve hiçbir şey kırılmaz. Kapılar aşağıda (→ KESİK).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const CSS = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const LOADER_SRC = loadSource('loader.js');

// Karşılama bloğu: overlay'in açılışından tuval seçim kutusuna kadar.
const WELCOME = HTML.slice(
  HTML.indexOf('<div class="ve-module-overlay"'),
  HTML.indexOf('<div class="ve-selection-box"')
);

// Karşılama ekranının CSS bölümü — bir sonraki bölümün (tuval kabı) başına
// kadar. Kurallar BURADA aranır: "mono yok" gibi hükümler yalnız bu ekran
// için geçerli, dosyanın tamamı için değil.
const CSS_WELCOME = (function () {
  const a = CSS.indexOf('/* \u2550\u2550\u2550 Modül Seçim / Karşılama Ekranı');
  // Sınır karşılama başlığından SONRAKİ ilk tuval kuralı. Düz `indexOf` dosyadaki
  // İLK `.ve-canvas-wrapper{`i buluyordu; karşılamanın çukursuz kuralı
  // (`.ve-main.ve-no-module .ve-canvas-wrapper{`, 2026-09-23) başlıktan önce
  // durunca sınır ters düştü ve bu dosyanın 71 testi HİÇ koşmadı.
  const b = CSS.indexOf('.ve-canvas-wrapper{', a);
  if (a < 0 || b < 0 || b < a) throw new Error('css/styles.css: karşılama bölümü bulunamadı');
  return CSS.slice(a, b);
})();

// :root'taki süre jetonunu ms olarak okur (jetonlar TEK kaynak; koreografinin
// gecikmeleri bunların üstüne calc ile yazılıyor).
function jetonMs(ad) {
  const m = CSS.match(new RegExp(ad + ':\\s*([\\d.]+)ms'));
  if (!m) throw new Error('css/styles.css: ' + ad + ' jetonu yok');
  return parseFloat(m[1]);
}

// _veWelcomeGomuluKopya çıplak `location` okur; eval bu modül kapsamında
// koştuğu için buradaki gölge değişken o okumanın tek kapısıdır (jsdom'da
// window.location salt okunur — spyOn da defineProperty de reddediliyor).
var location = window.location;
const GERCEK_LOCATION = location;

function setupDOM() {
  document.body.className = '';
  // Karşılama markup'ı index.html'den BİREBİR alınır (elle kopya değil):
  // panel/güncellik/kart sözleşmesi gövdeyle ayrışırsa buradan kırmızı döner.
  document.body.innerHTML =
    '<div id="ve-ribbon"></div>' +
    '<span id="ve-deploy-dot" class="ve-deploy-dot ve-deploy-unknown"></span>' +
    '<div id="sayfa2-content">' +
    '  <div class="ve-main">' +
    '    <div class="ve-doc-dock"></div>' +
    '    <div class="ve-canvas-wrapper" id="ve-canvas-wrapper"></div>' +
    WELCOME +
    '  </div>' +
    '</div>';
}

setupDOM();
eval(loadSource('canvas-space.js'));
eval(loadSource('components.js'));
// components.js'teki yüklem GLOBAL'e yazılır: cp-fead.js / state.js require ile
// yükleniyor, dolayısıyla çıplak `veIsCanvasHidden` referansı bu dosyanın
// kapsamını DEĞİL global'i arar. Yazılmazsa kutusuz düğüm kapısı sessizce
// atlanır ve testler kutuların hâlâ kurulduğu bir dünyayı ölçer.
global.veIsCanvasHidden = veIsCanvasHidden;

afterEach(() => { location = GERCEK_LOCATION; });

describe('Karşılama ekranı — kabuk kapanışı', () => {
  beforeEach(setupDOM);

  test('overlay görünürken kabuk sınıfı ÜÇ kaba birden yazılır', () => {
    document.getElementById('ve-module-overlay').style.display = '';
    veSyncModuleShell();

    // .ve-main → sol panel + belge bandı, #sayfa2-content → sayfa rayı,
    // <body> → şerit (fixed, ikisinin de dışında).
    expect(document.querySelector('.ve-main').classList.contains('ve-no-module')).toBe(true);
    expect(document.getElementById('sayfa2-content').classList.contains('ve-no-module')).toBe(true);
    expect(document.body.classList.contains('ve-no-module')).toBe(true);
  });

  test('modül seçilince (overlay gizlenince) üçü de temizlenir', () => {
    document.getElementById('ve-module-overlay').style.display = '';
    veSyncModuleShell();
    document.getElementById('ve-module-overlay').style.display = 'none';
    veSyncModuleShell();

    expect(document.querySelector('.ve-main').classList.contains('ve-no-module')).toBe(false);
    expect(document.getElementById('sayfa2-content').classList.contains('ve-no-module')).toBe(false);
    expect(document.body.classList.contains('ve-no-module')).toBe(false);
  });

  test('CSS kuralları duruyor: şerit gizli, belge bandı gizli, üst boşluk sıfır', () => {
    // Boşluğa toleranslı ama kuralın KENDİSİNİ arayan eşleşmeler.
    expect(CSS).toMatch(/body\.ve-no-module\s*#ve-ribbon\s*\{\s*display:\s*none/);
    expect(CSS).toMatch(/\.ve-main\.ve-no-module\s*\.ve-doc-dock\s*\{\s*display:\s*none/);
    // Şerit gizlenince sayfa yukarı çıkmalı: #sayfa2.active { top:var(--chrome-h) }
    expect(CSS).toMatch(/body\.ve-no-module\s*\{\s*--chrome-h:\s*0px/);
    expect(CSS).toMatch(/#sayfa2\.active\{[^}]*top:var\(--chrome-h/);
    // Ray ve sol panel kuralları eskiden beri var; birlikte anlam taşıyorlar.
    expect(CSS).toMatch(/#sayfa2-content\.ve-no-module\s*\.ve-nav-rail\s*\{\s*display:\s*none/);
  });
});

describe('Karşılama ekranı — sürüm künyesi', () => {
  beforeEach(() => { setupDOM(); delete window.__MFSIM_BUILD; });

  test('künye yoksa düğme GİZLİ kalır (boş çip sürüm gibi görünürdü)', () => {
    expect(veFillWelcomeStamp()).toBe(true);
    expect(document.getElementById('ve-welcome-stamp').hidden).toBe(true);
  });

  test('künye varsa "sha · PR #n" yazar ve görünür olur', () => {
    window.__MFSIM_BUILD = { sha: 'abc1234def', shortSha: 'abc1234', prNumber: 867 };
    expect(veFillWelcomeStamp()).toBe(true);
    const el = document.getElementById('ve-welcome-stamp');
    expect(el.hidden).toBe(false);
    expect(el.textContent).toBe('abc1234 \u00b7 PR #867');
  });

  test('PR numarası yoksa yalnız sha yazılır', () => {
    window.__MFSIM_BUILD = { sha: 'f820711aa', shortSha: 'f820711' };
    veFillWelcomeStamp();
    expect(document.getElementById('ve-welcome-stamp').textContent).toBe('f820711');
  });

  // KÜNYE BİR MODÜLDEN OKUNMAZ. İlk sürüm deploy-status.js'in _veBuildInfo'suna
  // bağlıydı; o dosya index.html'de components.js'ten SONRA yükleniyor ve
  // yükleme (gerçek tarayıcıda ölçüldü) 5 sn'lik yeniden deneme bütçesini
  // aşıyordu → künye tek dosyada HİÇ yazılmıyordu. window.__MFSIM_BUILD ise
  // gövdenin ilk satırında duran satır içi veri: sıraya bağlı değil.
  test('künye satır içi veriden okunur — modül yükleme sırasına bağlı DEĞİL', () => {
    const kaynak = loadSource('components.js');
    const govde = kaynak.slice(kaynak.indexOf('function veFillWelcomeStamp'),
                               kaynak.indexOf('(function veObserveModuleOverlay'));
    expect(govde).toContain('window.__MFSIM_BUILD');
    expect(govde).not.toContain('_veBuildInfo');
  });

  test('markup henüz yoksa FALSE döner (çağıran tekrar dener)', () => {
    document.body.innerHTML = '';
    expect(veFillWelcomeStamp()).toBe(false);
  });
});

describe('Karşılama ekranı — markup sözleşmesi', () => {
  test('üç modül kutusu, üçü de .ve-module-card (E2E bu seçiciyle tıklıyor)', () => {
    const kartlar = WELCOME.match(/class="ve-module-card"/g) || [];
    expect(kartlar.length).toBe(3);

    ['arac-performans', 'mount-analysis', 'fead-analysis']
      .forEach(function (tip) {
        expect(WELCOME).toContain("veStartModule('" + tip + "')");
      });
  });

  // Kutu → SATIR, sonra satır da SADELEŞTİ (kullanıcı reçetesi, 2026-09-09):
  // kart asılı duruyor ve boyunu içeriği belirliyor. Önce uzun açıklama
  // (.ve-module-card-desc), sonra künye (.ve-module-card-spec) düştü — geriye
  // simge + ad + ok kaldı. Modüller Kılavuzlar'dan ve Program Durumu'ndan
  // ayrıca anlatılıyor; burada tek iş SEÇTİRMEK.
  test('her satırda yalnız AD var — açıklama da künye de bu düzende YOK', () => {
    const n = (WELCOME.match(/class="ve-module-card-name"/g) || []).length;
    expect(n).toBe(3);
    expect(WELCOME).not.toContain('ve-module-card-desc');
    expect(WELCOME).not.toContain('ve-module-card-spec');
    expect(WELCOME).not.toContain('ve-welcome-note');
  });

  // P4 · M6 — yerleşimin İKİ yapısal hükmü. İkisi de sessiz: bozulunca ekran
  // yine açılır, yalnız fotoğraf panelin altından geçmez / modüller sağda
  // boşlukta kalır.
  test('modüller SOL PANELİN içinde, slayt karşılamanın DOĞRUDAN çocuğu', () => {
    setupDOM();
    expect(document.querySelectorAll('.ve-welcome-id .ve-module-card').length).toBe(3);
    expect(document.querySelector('.ve-welcome > .ve-welcome-slayt')).toBeTruthy();
    // Sağ sütun kalktı: kalırsa fotoğraf yeniden onun içine kırpılır.
    expect(document.querySelector('.ve-welcome-work')).toBeNull();
  });

  test('şerit gizliyken ulaşılamaz kalacak komutların girişi burada', () => {
    // Şerit bu ekranda çizilmiyor; bu dört komuda BAŞKA yol yok.
    ['veLoadTopology', 'veGuideKitOpen', 'veOpenSettings', 'veOpenStatusModal']
      .forEach(function (komut) {
        expect(WELCOME).toContain(komut);
      });
  });

  test('klavye erişimi korunuyor: her kutu odaklanabilir ve Enter/Space ile açılır', () => {
    expect((WELCOME.match(/tabindex="0"/g) || []).length).toBe(3);
    expect((WELCOME.match(/event\.key==='Enter'/g) || []).length).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// KESİK (2026-10-23, kullanıcı kararı "6d · İnce") — geometri, renk, yapı.
//    Hepsi SESSİZ: bozulunca ekran yine açılır, yalnız başka bir ekran olur.
// ═══════════════════════════════════════════════════════════════════════════
// Seçicinin İLK kuralının gövdesi (yorumlar ayıklanmış). Seçici listesinde
// TAM AD olarak aranır: `.ve-kesik` `.ve-kesik-ic`in alt dizesi.
function kural(css, sec) {
  const govde = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(govde))) {
    if (m[1].split(',').some((s) => s.trim() === sec)) return m[2];
  }
  return null;
}
// :root jetonunun değeri — satır başına çivili (yorumdaki ad yakalanmasın).
function jeton(ad) {
  const m = CSS.match(new RegExp('^\\s*' + ad + ':\\s*([^;]+);', 'm'));
  return m ? m[1].trim() : null;
}
// Bir bildirimdeki polygon(...)'un köşeleri: [{x: ifade, y: ifade}]. calc()
// virgül taşımıyor, köşeler virgülle ayrık.
function koseler(govde) {
  const i = govde.indexOf('polygon(') + 8;
  let d = 1, j = i;
  while (j < govde.length && d > 0) { if (govde[j] === '(') d++; else if (govde[j] === ')') d--; j++; }
  return govde.slice(i, j - 1).split(',').map((p) => {
    const m = p.trim().match(/^([\s\S]*\S)\s+(\S+)$/);
    return { x: m[1], y: m[2] };
  });
}
// calc(var(--a) + var(--b)) → sayı (jetonlar px).
function hesap(ifade) {
  const s = ifade.replace(/var\((--[a-z0-9-]+)\)/g, (_, j) => String(parseFloat(jeton(j))))
    .replace(/calc/g, '').replace(/px/g, '');
  // eslint-disable-next-line no-new-func
  return Function('return (' + s + ')')();
}
const hex = (ad) => {
  const v = jeton(ad);
  expect(v).toMatch(/^#[0-9a-fA-F]{6}$/);
  return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
};
const lum = (c) => c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; })
  .reduce((t, x, i) => t + x * [0.2126, 0.7152, 0.0722][i], 0);
const oran = (a, b) => { const L = [lum(a), lum(b)].sort((x, y) => y - x); return (L[0] + 0.05) / (L[1] + 0.05); };
const karis = (a, b, p) => a.map((x, i) => Math.round(x * p + b[i] * (1 - p)));

describe('KESİK — geometri (kullanıcının onayladığı ölçüler)', () => {
  test('jetonlar: üst 440, alt 360; çizgi 16 px dışarıda, 3 px', () => {
    expect([jeton('--kesik-ust'), jeton('--kesik-alt'), jeton('--kesik-cizgi-ara'), jeton('--kesik-cizgi')])
      .toEqual(['440px', '360px', '16px', '3px']);
  });

  test('kesik ekranı boydan boya keser; eğik kenar üst genişlikten alta iner', () => {
    const k = kural(CSS_WELCOME, '.ve-kesik');
    ['left:0', 'top:0', 'bottom:0', 'width:var(--kesik-ust)'].forEach((b) => expect(k).toContain(b));
    expect(koseler(k)).toEqual([
      { x: '0', y: '0' }, { x: '100%', y: '0' }, { x: 'var(--kesik-alt)', y: '100%' }, { x: '0', y: '100%' }
    ]);
  });

  // Çizgi kenara PARALEL: dört köşesi kesiğin iki jetonundan aynı paylarla
  // türer. Biri elle yazılsa çizgi, pencere boyu değişince kenardan ayrışır.
  test('bakır çizgi eğik kenara paralel — tepede ve dipte aynı pay, aynı kalınlık', () => {
    const k = koseler(kural(CSS_WELCOME, '.ve-kesik-cizgi'));
    expect(k.map((p) => p.y)).toEqual(['0', '0', '100%', '100%']);
    const [a, b, c, d] = k.map((p) => hesap(p.x));
    const ust = parseFloat(jeton('--kesik-ust')), alt = parseFloat(jeton('--kesik-alt'));
    expect([a - ust, d - alt]).toEqual([16, 16]);   // kenardan pay: tepede = dipte
    expect([b - a, c - d]).toEqual([3, 3]);         // kalınlık: tepede = dipte
  });

  test('sütun ve birincil düğme kesiğin İÇİNDE — eğik kenara değmiyor', () => {
    const ic = kural(CSS_WELCOME, '.ve-kesik-ic');
    // İçeriğin kenarı `left`; kutunun soldaki taşma payı (eksi pay + iç pay)
    // genişliğin içinde — içerik genişliği = width − padding-left.
    const sol = parseFloat(ic.match(/(?:^|;|\s)left:(\d+)px/)[1]);
    const pay = parseFloat((ic.match(/padding-left:(\d+)px/) || [0, '0'])[1]);
    expect(ic).toContain('margin-left:-' + pay + 'px');
    const gen = parseFloat(ic.match(/(?:^|;|\s)width:(\d+)px/)[1]) - pay;
    expect(gen).toBe(320);
    const ust = parseFloat(jeton('--kesik-ust')), alt = parseFloat(jeton('--kesik-alt'));
    expect(ust - (sol + gen)).toBeGreaterThanOrEqual(56);          // tepede pay
    const ac = parseFloat(kural(CSS_WELCOME, '.ve-welcome-open').match(/width:(\d+)px/)[1]);
    expect(alt - (sol + ac)).toBeGreaterThanOrEqual(16);           // dipte pay
  });

  test('sütun konumla yerleşir, transform ile DEĞİL; sığmazsa kendi içinde kayar', () => {
    // Giriş koreografisi sütunda transform kullanıyor (`both` dolgu): konum
    // transform'la yazılsaydı koreografi onu ezerdi — sessizce kayık sütun.
    const ic = kural(CSS_WELCOME, '.ve-kesik-ic');
    expect(ic).not.toMatch(/transform:/);
    expect(ic).toMatch(/overflow-y:auto/);
  });
});

describe('KESİK — renk temadan bağımsız', () => {
  // Kesik iki temada da siyah: üstündeki her renk --sinema-* ya da ondan
  // türeyen --kesik-* jetonundan. Tema rengi (--text-heading) açık temada
  // koyudur ve siyah kesikte görünmez olurdu.
  const RENKLI = [
    '.ve-kesik', '.ve-kesik-cizgi', '.ve-welcome-logo', '.ve-welcome-logo-ico', '.ve-welcome-tagline',
    '.ve-welcome-cetvel > span', '.ve-welcome-eyebrow', '.ve-module-overlay-grid', '.ve-module-card',
    '.ve-module-card:hover', '.ve-module-card-icon', '.ve-module-card-name', '.ve-module-card-arrow',
    '.ve-module-card:hover .ve-module-card-arrow', '.ve-welcome-change-k', '.ve-welcome-change-v',
    '.ve-welcome-kunye', '.ve-welcome-fresh', '.ve-welcome-fresh-dot', '.ve-welcome-stamp',
    '.ve-welcome-stamp:hover', '.ve-welcome-open', '.ve-welcome-open:hover', '.ve-welcome-link',
    '.ve-welcome-link:hover', '.ve-welcome-flyer'
  ];
  test.each(RENKLI)('%s — rengi yalnız --sinema-* / --kesik-* jetonundan', (sec) => {
    // Karşılama bölümünde aranır: dosyanın başındaki başlık bağlaması da
    // `.ve-welcome-logo`yu sayıyor ve yalnız iz yazıyor.
    const b = kural(CSS_WELCOME, sec);
    expect(b).not.toBeNull();
    const bildirim = b.split(';').map((d) => d.trim())
      .filter((d) => /^(color|background|background-color|border|border-top|border-bottom)\s*:/.test(d));
    expect(bildirim.length).toBeGreaterThan(0);
    bildirim.forEach((d) => {
      const deger = d.slice(d.indexOf(':') + 1);
      expect(deger).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
      (deger.match(/var\(--[a-z0-9-]+\)/g) || []).forEach((j) => expect(j).toMatch(/^var\(--(sinema|kesik)-/));
    });
  });

  test('--kesik-* renk jetonları yalnız --sinema-* jetonlarından türer', () => {
    ['--kesik-ayrac', '--kesik-kabar'].forEach((j) => {
      const v = jeton(j);
      expect(v).toMatch(/^color-mix\(/);
      expect(v).not.toMatch(/#|rgba?\(/);
      (v.match(/var\(--[a-z0-9-]+\)/g) || []).forEach((x) => expect(x).toMatch(/^var\(--sinema-/));
    });
  });

  test('birincil düğme: kesiğin rengi vurgu zemininde ≥ 4,5:1 — duruşta da üstüne gelince de', () => {
    expect(kural(CSS_WELCOME, '.ve-welcome-open')).toContain('color:var(--sinema-bant)');
    expect(kural(CSS_WELCOME, '.ve-welcome-open')).toContain('background:var(--sinema-vurgu)');
    expect(kural(CSS_WELCOME, '.ve-welcome-open:hover')).toContain('background-color:var(--sinema-vurgu-yazi)');
    const bant = hex('--sinema-bant');
    expect(oran(bant, hex('--sinema-vurgu'))).toBeGreaterThanOrEqual(4.5);
    expect(oran(bant, hex('--sinema-vurgu-yazi'))).toBeGreaterThanOrEqual(4.5);
  });

  test('üstüne gelinen satırın zemininde yazı ≥ 4,5:1', () => {
    // --kesik-kabar = yazının %7'si + kesik; jetonun kendisinden okunur.
    const p = parseFloat(jeton('--kesik-kabar').match(/(\d+(?:\.\d+)?)%/)[1]) / 100;
    const kabar = karis(hex('--sinema-yazi'), hex('--sinema-bant'), p);
    expect(oran(hex('--sinema-yazi'), kabar)).toBeGreaterThanOrEqual(4.5);
    expect(oran(hex('--sinema-yazi-2'), kabar)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('KESİK — yapı', () => {
  beforeEach(setupDOM);

  test('içerik kesiğin İÇİNDE, bakır çizgi DIŞINDA (clip-path kutusundakini kırpar)', () => {
    // Yazının zemini atadan okunur (kontrast ölçeri de öyle okuyor): içerik
    // kesiğin çocuğu olmasaydı yazının zemini sayfanın kâğıdı sayılırdı.
    expect(document.querySelector('.ve-welcome > .ve-kesik > .ve-welcome-id.ve-kesik-ic')).toBeTruthy();
    expect(document.querySelector('.ve-welcome > .ve-kesik-cizgi')).toBeTruthy();
    expect(document.querySelector('.ve-kesik .ve-kesik-cizgi')).toBeNull();
  });

  test('cetvel on iki bölme; her modül sırasıyla kendi dört bölmesini vurgular', () => {
    expect(document.querySelectorAll('.ve-welcome-cetvel > span').length).toBe(12);
    expect(kural(CSS_WELCOME, '.ve-welcome-cetvel')).toContain('grid-template-columns:repeat(12,');
    const tipler = [...document.querySelectorAll('.ve-module-card')].map((k) => k.getAttribute('data-module'));
    const araliklar = [':nth-child(-n+4)', ':nth-child(n+5):nth-child(-n+8)', ':nth-child(n+9)'];
    expect(tipler.length).toBe(araliklar.length);
    tipler.forEach((t, i) => {
      expect(CSS_WELCOME).toContain('.ve-welcome-id:has(.ve-module-card[data-module="' + t
        + '"]:is(:hover, :focus-visible)) .ve-welcome-cetvel > span' + araliklar[i]);
    });
  });

  test('satırın vurgusu zemin + ok + cetvel; sözde eleman ve imleç ışığı YOK', () => {
    expect(kural(CSS_WELCOME, '.ve-module-card:hover')).toContain('background-color:var(--kesik-kabar)');
    expect(kural(CSS_WELCOME, '.ve-module-card:hover .ve-module-card-arrow')).toContain('color:var(--sinema-vurgu)');
    expect(CSS_WELCOME).not.toMatch(/\.ve-module-card::(before|after)/);
    expect(loadSource('components.js')).not.toContain('_veWelcomeInstallCardSheen');
  });

  test('oklar ve klasör ikon ailesinden (çizgi ikon)', () => {
    expect(document.querySelectorAll('.ve-module-card-arrow .mf-ico-arrow-right').length).toBe(3);
    expect(document.querySelector('.ve-welcome-open .mf-ico-folder-open')).toBeTruthy();
    expect(document.querySelector('.ve-welcome-open .mf-ico-arrow-right')).toBeTruthy();
  });

  test('cam kartın jetonları KALKTI — ölü jeton kalmadı', () => {
    ['--karsilama-cam', '--karsilama-cam-blur', '--karsilama-kart-r', '--karsilama-kart-golge', '--karsilama-perde']
      .forEach((j) => expect(CSS).not.toContain(j));
  });
});

// Kullanıcı: "yazılar bir garip olmuş, butona çok yakın, başlık aşağıda."
// (2026-09-09, cam kart) — iki hata vardı ve İKİSİ DE SESSİZDİ: 0 px düğmeyi
// güncellik satırına, 2 px bölüm etiketini ilk modül satırına yapıştırıyordu.
// Kesikte aynı iki kural duruyor.
describe('Kesik — dikey ritim', () => {
  const px = (sec, ozellik) => {
    const m = kural(CSS_WELCOME, sec);
    expect(m).toBeTruthy();
    const d = m.match(new RegExp(ozellik + ':\\s*([-\\d]+)px'));
    return d ? parseInt(d[1], 10) : null;
  };

  test('birincil düğme üstündeki satıra YAPIŞMIYOR — boşluğun tabanı ≥ 16 px', () => {
    const d = kural(CSS_WELCOME, '.ve-welcome-spacer').match(/flex:\s*1\s+0\s+(\d+)px/);
    expect(d).toBeTruthy();
    expect(parseInt(d[1], 10)).toBeGreaterThanOrEqual(16);
  });

  test('künye ADINA yakın, gövdeye uzak (yakınlık kuralı)', () => {
    expect(px('.ve-welcome-tagline', 'margin-top')).toBeLessThan(px('.ve-welcome-cetvel', 'margin'));
  });

  test('başlık kilidini cetvel kapatıyor; logonun alt çizgisi yok', () => {
    expect(kural(CSS_WELCOME, '.ve-welcome-logo')).not.toMatch(/border-bottom/);
    expect(kural(CSS_WELCOME, '.ve-welcome-cetvel')).not.toMatch(/display:\s*none/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 1) ZEMİN — kâğıt dokusu (ızgara kalktı)
//    Izgara geri gelse ekran yine açılır: hata sessizdir, yalnız karşılama
//    tuvalin diliyle konuşmaya döner.
// ═══════════════════════════════════════════════════════════════════════════
describe('Karşılama zemini — kâğıt dokusu', () => {
  test('.ve-module-overlay ızgara gradyanı TANIMLAMIYOR', () => {
    expect(CSS_WELCOME).not.toMatch(/repeating-linear-gradient/);
  });

  test('zemin --paper-grain jetonundan sürülür — İKİ katmanda da', () => {
    // İkinci blok bilinçli bir fallback katı (color-mix'siz tarayıcı); biri
    // dokusuz kalırsa o tarayıcıda zemin sessizce düz renge düşer.
    const bloklar = (CSS_WELCOME.match(/\.ve-module-overlay\{[^}]*\}/g) || [])
      .filter((b) => /background:/.test(b));
    expect(bloklar.length).toBeGreaterThanOrEqual(2);
    bloklar.forEach((b) => expect(b).toContain('var(--paper-grain)'));
  });

  test('--paper-grain gerçek bir gürültü dokusu: feTurbulence data-URI', () => {
    const m = CSS.match(/--paper-grain:\s*url\("([^"]+)"\)/);
    expect(m).toBeTruthy();
    const svg = decodeURIComponent(m[1]);
    expect(svg.indexOf('data:image/svg+xml')).toBe(0);
    expect(svg).toContain('feTurbulence');
    expect(svg).toContain('fractalNoise');
    // Döşeme ölçüsü background-size ile AYNI olmak zorunda: ayrışırsa doku
    // ölçeklenir ve kâğıt yerine bulanık leke çıkar (uyarı yok).
    const w = svg.match(/width='(\d+)'/);
    expect(w).toBeTruthy();
    // Yalnız DOKUYU KULLANAN kurallara bakılır: karşılama bloğunda başka
    // background-size'lar da var (slayt kareleri `cover` ile örtüyor) ve
    // onların döşemeyle ilgisi yok.
    const dokuKurallari = (CSS_WELCOME.match(/\{[^{}]*var\(--paper-grain\)[^{}]*\}/g) || []);
    expect(dokuKurallari.length).toBeGreaterThanOrEqual(2);   // taban + fallback katı
    dokuKurallari.forEach((kural) => {
      const d = kural.match(/background-size:[^;]+;/);
      expect(d).toBeTruthy();
      expect(d[0]).toContain(w[1] + 'px ' + w[1] + 'px');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2) TİPOGRAFİ (T1) — bu ekranda mono YOK
//    Rakam hizası mono'dan değil tabular-nums'tan gelir; mono geri gelirse
//    ekran iki yazı tipiyle konuşur ama hiçbir şey kırılmaz.
describe('Karşılama tipografisi — tek yazı tipi', () => {
  test('karşılama bölümünde tek bir mono kural bile yok', () => {
    expect(CSS_WELCOME).not.toMatch(/--font-mono/);
    expect(CSS_WELCOME).not.toMatch(/monospace/);
  });

  test('sürüm künyesi sans + tabular-nums', () => {
    ['.ve-welcome-stamp'].forEach(function (sec) {
      const m = CSS_WELCOME.match(new RegExp(sec.replace('.', '\\.') + '\\{[^}]*\\}'));
      expect(m).toBeTruthy();
      expect(m[0]).toContain('font-family:var(--font-sans)');
      expect(m[0]).toContain('font-variant-numeric:tabular-nums');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3) SON DEĞİŞİKLİKLER — veFillWelcomeChanges
//    Commit başlığı SERBEST METİN: kaçış düşerse panel ham HTML çalıştırır.
describe('Son değişiklikler — veFillWelcomeChanges', () => {
  beforeEach(() => { setupDOM(); delete window.__MFSIM_BUILD; });

  const panel = () => document.getElementById('ve-welcome-changes');
  const satirlar = () =>
    Array.from(document.querySelectorAll('#ve-welcome-changes-list .ve-welcome-change'));
  const anahtar = (i) => satirlar()[i].querySelector('.ve-welcome-change-k').textContent;
  const govde = (i) => satirlar()[i].querySelector('.ve-welcome-change-v');
  const SAYI = parseInt(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8')
    .match(/var VE_WELCOME_CHANGE_SAYI = (\d+);/)[1], 10);
  const kayitlar = (n) => {
    window.__MFSIM_BUILD = {
      changes: Array.from({ length: n }, (_, i) => ({ sha: 'sha' + (i + 1), title: 'başlık ' + (i + 1) }))
    };
    veFillWelcomeChanges();
  };

  test('künye yoksa panel GİZLİ kalır (boş panel "bilmiyorum"u bilgi gibi gösterirdi)', () => {
    expect(veFillWelcomeChanges()).toBe(true);
    expect(panel().hidden).toBe(true);
    expect(satirlar().length).toBe(0);
  });

  test('künye var ama kayıt yoksa da panel gizli', () => {
    window.__MFSIM_BUILD = { sha: 'abc1234def', shortSha: 'abc1234', changes: [] };
    veFillWelcomeChanges();
    expect(panel().hidden).toBe(true);
  });

  // Kullanıcının onayladığı tasarım (2026-10-23, "6d · İnce"): kesikte ilk
  // ÜÇ kayıt; listenin tamamı Program Durumu'nda.
  test('kesikte ilk ÜÇ kayıt, en yeniden eskiye', () => {
    expect(SAYI).toBe(3);
    kayitlar(10);
    expect(panel().hidden).toBe(false);
    expect(satirlar().map((_, i) => anahtar(i))).toEqual(['sha1', 'sha2', 'sha3']);
  });

  test('üçten az kayıt varsa hepsi', () => {
    kayitlar(2);
    expect(satirlar().map((_, i) => anahtar(i))).toEqual(['sha1', 'sha2']);
  });

  test('liste KATLANMIYOR: aç/kapa düğmesi yok, gizli satır yok', () => {
    kayitlar(10);
    expect(document.getElementById('ve-welcome-changes-toggle')).toBeNull();
    expect(WELCOME).not.toContain('ve-welcome-more');
    expect(satirlar().every((el) => !el.hidden)).toBe(true);
  });

  test('listenin tamamına giden yol: sürüm künyesi Program Durumu\'nu açar', () => {
    expect(document.getElementById('ve-welcome-stamp').getAttribute('onclick')).toContain('veOpenStatusModal');
  });

  test('künye satırı: güncellik de sürüm de gizliyse satır (ve çizgisi) da gizli', () => {
    expect(CSS_WELCOME).toMatch(/\.ve-welcome-kunye:not\(:has\(> :not\(\[hidden\]\)\)\)\{\s*display:none/);
    expect(CSS_WELCOME).toMatch(/\.ve-welcome-stamp\[hidden\]\{\s*display:none/);
    const kunye = document.querySelector('.ve-welcome-kunye');
    expect([...kunye.children].map((c) => c.id)).toEqual(['ve-welcome-fresh', 've-welcome-stamp']);
  });

  test('ikinci çağrı listeyi ÇOĞALTMAZ', () => {
    window.__MFSIM_BUILD = { changes: [{ sha: 'a1', title: 'bir' }, { sha: 'a2', title: 'iki' }] };
    veFillWelcomeChanges();
    veFillWelcomeChanges();
    expect(satirlar().length).toBe(2);
  });

  test('commit başlığı HTML olarak değil METİN olarak konur', () => {
    const ham = '<img src=x onerror="alert(1)"> & <b>kalın</b>';
    window.__MFSIM_BUILD = { changes: [{ sha: 'a1b2c3', title: ham }] };
    veFillWelcomeChanges();
    const v = govde(0);
    expect(v.querySelector('img')).toBeNull();
    expect(v.innerHTML).not.toContain('<img');
    expect(v.innerHTML).toContain('&lt;img');
    expect(v.textContent).toBe(ham);
  });

  test('sha/title eksikse yedeklere düşer (shortSha · message)', () => {
    window.__MFSIM_BUILD = { changes: [{ shortSha: 'ee9d501', message: 'gövde metni' }] };
    veFillWelcomeChanges();
    expect(anahtar(0)).toBe('ee9d501');
    expect(govde(0).textContent).toBe('gövde metni');
  });

  test('markup henüz yoksa FALSE döner (çağıran tekrar dener)', () => {
    document.body.innerHTML = '';
    expect(veFillWelcomeChanges()).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4) GÜNCELLİK SATIRI — veSyncWelcomeFreshness
//    DÜRÜSTLÜK KAPISI: gömülü künye "yayın güncel mi" sorusunu YANITLAMAZ,
//    yalnız elindeki kopyayı söyler (aynı ayrım: js/deploy-status.js).
describe('Güncellik satırı — veSyncWelcomeFreshness', () => {
  const BEKLENEN = [
    ['ve-deploy-success', 'ok', 'Güncel'],
    ['ve-deploy-update-available', 'update', 'Güncelleme var'],
    ['ve-deploy-local', 'local', 'Çevrimdışı kopya'],
    ['ve-deploy-pending', 'pending', 'Yayın sürüyor']
  ];

  beforeEach(() => { setupDOM(); delete window.__MFSIM_BUILD; });

  function nokta(sinif, baslik) {
    const d = document.getElementById('ve-deploy-dot');
    d.className = 've-deploy-dot ' + sinif;
    if (baslik) d.title = baslik;
    return d;
  }
  const satir = () => document.getElementById('ve-welcome-fresh');
  const metin = () => satir().querySelector('.ve-welcome-fresh-text').textContent;

  BEKLENEN.forEach(function (k) {
    test(k[0] + ' → data-state="' + k[1] + '" · "' + k[2] + '"', () => {
      nokta(k[0]);
      expect(veSyncWelcomeFreshness()).toBe(true);
      expect(satir().hidden).toBe(false);
      expect(satir().getAttribute('data-state')).toBe(k[1]);
      expect(metin()).toBe(k[2]);
    });
  });

  test('DÜRÜSTLÜK: yerel kopya "Güncel" DEMEZ', () => {
    nokta('ve-deploy-local');
    veSyncWelcomeFreshness();
    expect(metin()).toBe('Çevrimdışı kopya');
    expect(metin()).not.toMatch(/Güncel/);
  });

  test('beşinci durum — cevap yoksa satır data-state="unknown" ve GİZLİ', () => {
    nokta('ve-deploy-unknown');
    expect(veSyncWelcomeFreshness()).toBe(true);
    expect(satir().getAttribute('data-state')).toBe('unknown');
    expect(satir().hidden).toBe(true);
  });

  test('ağ hatası da bilinmeyene düşer — yalancı satır kalmaz', () => {
    nokta('ve-deploy-error');
    veSyncWelcomeFreshness();
    expect(satir().hidden).toBe(true);
  });

  test('nokta hiç yoksa satır gizli kalır', () => {
    document.getElementById('ve-deploy-dot').remove();
    expect(veSyncWelcomeFreshness()).toBe(true);
    expect(satir().hidden).toBe(true);
  });

  test('file:// + gömülü künye → satır "Çevrimdışı kopya"ya yükselir', () => {
    location = { protocol: 'file:' };
    window.__MFSIM_BUILD = { sha: 'abc1234def', shortSha: 'abc1234' };
    nokta('ve-deploy-unknown');
    veSyncWelcomeFreshness();
    expect(satir().hidden).toBe(false);
    expect(satir().getAttribute('data-state')).toBe('local');
    expect(metin()).toBe('Çevrimdışı kopya');
  });

  test('http kopyada aynı künye satırı AÇMAZ — orada yayın gerçekten sorulabilir', () => {
    window.__MFSIM_BUILD = { sha: 'abc1234def', shortSha: 'abc1234' };
    nokta('ve-deploy-unknown');
    veSyncWelcomeFreshness();
    expect(satir().hidden).toBe(true);
  });

  test('noktanın açıklaması (title) satıra taşınır', () => {
    nokta('ve-deploy-local', 'Bu kopya: abc1234 · PR #872');
    veSyncWelcomeFreshness();
    expect(satir().getAttribute('title')).toBe('Bu kopya: abc1234 · PR #872');
  });

  test('[hidden] CSS ile de gizlenir — display:flex tarayıcı kuralını yenerdi', () => {
    expect(CSS_WELCOME).toMatch(/\.ve-welcome-fresh\[hidden\]\{\s*display:none/);
  });

  test('markup henüz yoksa FALSE döner', () => {
    document.body.innerHTML = '';
    expect(veSyncWelcomeFreshness()).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5) AÇILIŞ KOREOGRAFİSİ — tetikleyici JS'te, tempo CSS'te (İKİ AYRI DOSYA)
describe('Açılış koreografisi', () => {
  beforeEach(() => { setupDOM(); });

  function goster(v) {
    document.getElementById('ve-module-overlay').style.display = v ? '' : 'none';
    veSyncModuleShell();
  }
  const enterVar = () =>
    document.querySelector('.ve-welcome').classList.contains('ve-welcome-enter');

  test('karşılama GİZLİDEN görünüre dönünce .ve-welcome-enter yazılır', () => {
    goster(false);
    expect(enterVar()).toBe(false);
    goster(true);
    expect(enterVar()).toBe(true);
  });

  test('her senkronda değil — görünür kalırken sınıf yeniden yazılmaz', () => {
    goster(false);
    goster(true);
    document.querySelector('.ve-welcome').classList.remove('ve-welcome-enter');
    veSyncModuleShell();                       // durum DEĞİŞMEDİ
    expect(enterVar()).toBe(false);
  });

  test('reduced-motion: sınıf hiç yazılmaz', () => {
    goster(false);
    window.matchMedia = () => ({ matches: true });
    try { goster(true); } finally { delete window.matchMedia; }
    expect(enterVar()).toBe(false);
  });

  test('kart gecikmeleri jetonlardan türer: 420 + n × 70 ms', () => {
    const perde = jetonMs('--dur-enter');
    const adim = jetonMs('--dur-step');
    expect([perde, adim]).toEqual([420, 70]);

    // 1. kart: gecikme doğrudan --dur-enter
    const ilk = CSS_WELCOME.match(/\.ve-welcome-enter \.ve-module-card\{([^}]*)\}/);
    expect(ilk).toBeTruthy();
    expect(ilk[1]).toContain('var(--dur-enter)');

    // 2-4: calc jetonların ÜSTÜNE yazılır → 490 · 560 · 630
    [2, 3, 4].forEach(function (n) {
      const m = CSS_WELCOME.match(new RegExp(
        '\\.ve-welcome-enter \\.ve-module-card:nth-child\\(' + n + '\\)\\{[^}]*animation-delay:([^;]+);'
      ));
      expect(m).toBeTruthy();
      const ifade = m[1]
        .replace(/var\(--dur-enter\)/g, String(perde))
        .replace(/var\(--dur-step\)/g, String(adim))
        .replace(/calc/g, '');
      // eslint-disable-next-line no-new-func
      expect(Function('return ' + ifade)()).toBe(perde + (n - 1) * adim);
    });
  });

  // `both` bitiş karesini KALICI kılar ve CSS animasyonu normal bildirimleri
  // yener → satırın hover kayması hiç görünmezdi. `backwards` yalnız gecikme
  // boyunca giriş karesini uygular. Sessiz: hata yok, yalnız hover ölü.
  test('kart animasyonu `backwards` doldurur — `both` hover\'ı öldürür', () => {
    [/\.ve-module-card\{[^}]*?(animation:ve-welcome-rise[^;]*);/,
     /\.ve-welcome-enter \.ve-module-card\{[^}]*?(animation:ve-welcome-rise[^;]*);/]
      .forEach(function (re) {
        const m = CSS_WELCOME.match(re);
        expect(m).toBeTruthy();
        expect(m[1]).toContain('backwards');       // yalnız BİLDİRİM — yorumdaki
        expect(m[1]).not.toMatch(/\bboth\b/);      // "both" kapıyı yanıltmasın
      });
  });

  test('koreografi kuralları taban kart kurallarından SONRA gelir', () => {
    // Aynı özgüllük → kaynak sırası kazanır. Önce gelselerdi animasyon yine
    // oynardı, yalnız YANLIŞ anda: perde düşer, dördü birden girer.
    expect(CSS_WELCOME.indexOf('.ve-welcome-enter .ve-module-card:nth-child(2)'))
      .toBeGreaterThan(CSS_WELCOME.indexOf('.ve-module-card:nth-child(2)'));
  });

  // Kesik açılış bantlarının ALTINDA hazır durur: kımıldasaydı devir
  // teslimde siyah sütun yerinden oynardı. Çizgi tepeden dibe çizilir —
  // başlangıç karesinin dört köşesi de çizginin tepesinde.
  test('bakır çizgi yukarıdan aşağı çizilir; kesik KIMILDAMAZ', () => {
    expect(kural(CSS_WELCOME, '.ve-welcome-enter .ve-kesik-cizgi')).toMatch(/animation:ve-kesik-cizgi\s/);
    expect(kural(CSS_WELCOME, '.ve-welcome-enter .ve-kesik')).toBeNull();
    const kf = CSS_WELCOME.match(/@keyframes ve-kesik-cizgi\{\s*from\{([\s\S]*?)\}\s*\}/);
    expect(kf).toBeTruthy();
    const k = koseler(kf[1]);
    expect(k.map((x) => x.y)).toEqual(['0', '0', '0', '0']);
    expect([k[2].x, k[3].x]).toEqual([k[1].x, k[0].x]);
  });

  test('reduced-motion bloğu koreografiyi, kabuk inişini ve uçuşu durdurur', () => {
    const blok = CSS_WELCOME.slice(CSS_WELCOME.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(blok).toContain('.ve-welcome-enter .ve-kesik-cizgi');
    expect(blok).toContain('.ve-welcome-enter .ve-module-card');
    expect(blok).toContain('body.ve-chrome-enter #ve-ribbon');
    expect(blok).toMatch(/\.ve-welcome-flyer\{\s*transition:none/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6) UÇAN KART KOPYASI — veWelcomeFlyToNode
//    DEKOR: düğüm zaten yerinde. Buradaki her yol "sessizce çık" ile biter;
//    tek gerçek risk klonun DOM'da asılı kalması (tıklamayı yutar).
describe('Uçan kart kopyası — veWelcomeFlyToNode', () => {
  const KART_R = { left: 100, top: 200, width: 400, height: 160 };
  const NODE_R = { left: 700, top: 500, width: 120, height: 60 };
  let anims;

  beforeEach(() => {
    setupDOM();
    jest.useFakeTimers();
    anims = [];
    delete Element.prototype.animate;
  });
  afterEach(() => {
    jest.useRealTimers();
    delete Element.prototype.animate;
  });

  function waapiKur() {
    Element.prototype.animate = function (kareler, ayar) {
      const a = { kareler: kareler, ayar: ayar, onfinish: null };
      anims.push(a);
      return a;
    };
  }
  function kart() {
    const k = document.querySelector('.ve-module-card[data-module="fead-analysis"]');
    k.getBoundingClientRect = () => KART_R;
    return k;
  }
  function dugum(r) {
    const n = document.createElement('div');
    document.body.appendChild(n);
    n.getBoundingClientRect = () => (r || NODE_R);
    return n;
  }
  const klonlar = () => document.querySelectorAll('body > .ve-welcome-flyer');

  test('WAAPI yoksa sessizce çıkar — ne hata ne klon', () => {
    const k = kart();
    expect(typeof k.animate).not.toBe('function');
    expect(() => veWelcomeFlyToNode(k, dugum(), KART_R)).not.toThrow();
    expect(klonlar().length).toBe(0);          // klon HİÇ doğmamalı (sonra toplanmış olması yetmez)
    jest.advanceTimersByTime(2000);
    expect(klonlar().length).toBe(0);
  });

  test('reduced-motion altında uçuş HİÇ başlamaz', () => {
    waapiKur();
    window.matchMedia = () => ({ matches: true });
    try { veWelcomeFlyToNode(kart(), dugum(), KART_R); } finally { delete window.matchMedia; }
    jest.advanceTimersByTime(2000);
    expect(klonlar().length).toBe(0);
    expect(anims.length).toBe(0);
  });

  test('kalkış ölçüsü yoksa (kart gizli, 0×0) uçuş kurulmaz', () => {
    waapiKur();
    veWelcomeFlyToNode(kart(), dugum(), { left: 0, top: 0, width: 0, height: 0 });
    expect(klonlar().length).toBe(0);          // klon HİÇ doğmamalı: 0×0'dan uçan kopya yanlış yere iner
    jest.advanceTimersByTime(2000);
    expect(klonlar().length).toBe(0);
  });

  test('klon body\'nin DOĞRUDAN çocuğu, sabit konumlu ve tıklamayı yutmuyor', () => {
    waapiKur();
    veWelcomeFlyToNode(kart(), dugum(), KART_R);
    const k = klonlar();
    expect(k.length).toBe(1);
    expect(k[0].parentNode).toBe(document.body);      // tuvalin transform'lu uzayı DEĞİL
    expect(k[0].style.position).toBe('fixed');
    expect(k[0].style.pointerEvents).toBe('none');
    expect(k[0].style.left).toBe(KART_R.left + 'px');
    expect(k[0].getAttribute('onclick')).toBeNull();
    expect(k[0].getAttribute('tabindex')).toBeNull();
    expect(k[0].getAttribute('aria-hidden')).toBe('true');
  });

  test('animasyon bitince klon KALDIRILIR', () => {
    waapiKur();
    veWelcomeFlyToNode(kart(), dugum(), KART_R);
    jest.advanceTimersByTime(200);                    // kabuk otursun diye beklenen aralık
    expect(anims.length).toBe(1);
    expect(anims[0].ayar.duration).toBe(460);         // --dur-fly
    expect(typeof anims[0].onfinish).toBe('function');
    anims[0].onfinish();
    expect(klonlar().length).toBe(0);
  });

  test('bitiş olayı hiç gelmezse emniyet zamanlayıcısı klonu toplar', () => {
    waapiKur();
    veWelcomeFlyToNode(kart(), dugum(), KART_R);
    jest.advanceTimersByTime(200);
    expect(klonlar().length).toBe(1);
    jest.advanceTimersByTime(600);
    expect(klonlar().length).toBe(0);
  });

  test('hedef ölçülemezse (0×0 düğüm) klon asılı kalmaz', () => {
    waapiKur();
    veWelcomeFlyToNode(kart(), dugum({ left: 0, top: 0, width: 0, height: 0 }), KART_R);
    jest.advanceTimersByTime(200);
    expect(anims.length).toBe(0);
    expect(klonlar().length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7) MODÜLE GEÇİŞ — uçuş + kabuk inişi EKLENDİ, merkez sözleşmesi DURUYOR
//    (tests/unit/module-start-center.test.js aynı sözleşmeyi uçuşsuz tutuyor;
//    buradaki kapı yeni katmanların o hesabı bozmadığını ölçer.)
describe('Modüle geçiş — uçuş/kabuk eklendikten sonra da blok tam ortada', () => {
  const FULL_W = 1920, SHELL_W = 284, VIEW_H = 935;

  function olcuKur() {
    const wrap = document.getElementById('ve-canvas-wrapper');
    const gen = () =>
      document.querySelector('.ve-main').classList.contains('ve-no-module') ? FULL_W : FULL_W - SHELL_W;
    wrap.getBoundingClientRect = () => ({
      width: gen(), height: VIEW_H, left: FULL_W - gen(), top: 0, right: FULL_W, bottom: VIEW_H
    });
    Object.defineProperty(wrap, 'clientWidth', { configurable: true, get: gen });
    Object.defineProperty(wrap, 'clientHeight', { configurable: true, get: () => VIEW_H });
  }
  function kartOlc(tip) {
    document.querySelector('.ve-module-card[data-module="' + tip + '"]')
      .getBoundingClientRect = () => ({ left: 100, top: 200, width: 400, height: 160 });
  }
  const ekranX = (n) => (n.x + n.width / 2 - 3000) * canvasZoom + canvasOffset.x;
  const ekranY = (n) => (n.y + n.height / 2 - 3000) * canvasZoom + canvasOffset.y;

  beforeEach(() => {
    setupDOM();
    jest.useFakeTimers();
    olcuKur();
    global.nodes = [];
    global.connections = [];
    global.compCounter = 0;
    global.canvasZoom = 1;
    global.canvasOffset = { x: 3000, y: 3000 };
    global.updateCanvasTransform = jest.fn();
    global.showToast = jest.fn();
    global.createNode = jest.fn(function (type, x, y) {
      const def = componentDefs[type] || {};
      const n = { id: 'comp-' + (++global.compCounter), type: type, x: x, y: y,
                  width: def.defaultWidth || 65, height: def.defaultHeight || 60, data: {} };
      const el = document.createElement('div');
      el.id = n.id;
      el.getBoundingClientRect = () => ({ left: 700, top: 400, width: n.width, height: n.height });
      document.body.appendChild(el);
      global.nodes.push(n);
      return n;
    });
    document.getElementById('ve-module-overlay').style.display = '';
    veSyncModuleShell();
  });
  afterEach(() => {
    jest.useRealTimers();
    delete Element.prototype.animate;
  });

  test('uçuş GERÇEKTEN kurulurken bile blok yatayda ve dikeyde ortada', () => {
    Element.prototype.animate = function () { return {}; };
    kartOlc('fead-analysis');
    veStartModule('fead-analysis');

    expect(document.querySelectorAll('body > .ve-welcome-flyer').length).toBe(1);
    const W = FULL_W - SHELL_W;
    expect(nodes.length).toBe(1);
    expect(Math.abs(ekranX(nodes[0]) - W / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(ekranY(nodes[0]) - VIEW_H / 2)).toBeLessThanOrEqual(1);
  });

  test('kabuk inişi: body.ve-chrome-enter eklenir ve 500 ms sonra kalkar', () => {
    veStartModule('mount-analysis');
    expect(document.body.classList.contains('ve-chrome-enter')).toBe(true);
    jest.advanceTimersByTime(600);
    expect(document.body.classList.contains('ve-chrome-enter')).toBe(false);
  });

  test('reduced-motion: kabuk sınıfı hiç eklenmez, modül yine açılır', () => {
    window.matchMedia = () => ({ matches: true });
    try { veStartModule('mount-analysis'); } finally { delete window.matchMedia; }
    expect(document.body.classList.contains('ve-chrome-enter')).toBe(false);
    expect(nodes.length).toBe(1);
    expect(document.getElementById('ve-module-overlay').style.display).toBe('none');
  });

  test('uçuş PATLASA bile modül açılır — dekor bir kapı değildir', () => {
    const gercek = veWelcomeFlyToNode;
    veWelcomeFlyToNode = function () { throw new Error('uçuş bozuk'); };
    try {
      kartOlc('fead-analysis');
      expect(() => veStartModule('fead-analysis')).not.toThrow();
    } finally {
      veWelcomeFlyToNode = gercek;
    }
    expect(nodes.length).toBe(1);
    expect(nodes[0].type).toBe('fead-analysis');
    expect(document.getElementById('ve-module-overlay').style.display).toBe('none');
    // "‹ad› eklendi" bildirimi 2026-10-16'da kalktı (ARAYÜZ ANLATMAZ): uçuşun
    // ardından çalışan son satır oydu; kapı kartın kurulmasına bakar.
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8) YÜKLEME → KARŞILAMA MARKA DEVRİ — js/loader.js kancası
//    Kanca splash SÖNMEDEN önce çağrılmalı (sonrası ölçülemez); ama kanca yoksa
//    ya da patlarsa kapanış AYNEN sürmeli — asılı splash "program hiç açılmadı".
describe('Marka devri kancası — js/loader.js › hideSplash', () => {
  const SPLASH = (function () {
    const a = HTML.indexOf('<div id="mfsim-loading-screen"');
    const b = HTML.indexOf('<script src="js/loader.js">');
    if (a < 0 || b < 0 || b < a) throw new Error('index.html: açılış ekranı bloğu bulunamadı');
    return HTML.slice(a, b).trim();
  })();

  let gercekKanca;

  beforeEach(() => {
    jest.useFakeTimers();
    gercekKanca = window.veWelcomeAdoptSplashLogo;
    document.body.className = '';
    // Defer script YOK → yükleyicinin en kısa yolu: 250 ms sonra hideSplash.
    document.body.innerHTML = SPLASH + '<div id="mfsim-login-overlay" style="display:block"></div>';
  });
  afterEach(() => {
    jest.useRealTimers();
    window.veWelcomeAdoptSplashLogo = gercekKanca;
    setupDOM();
  });

  function kostur() {
    // Her senaryo için TAZE bir IIFE: `started` bayrağı testler arasında taşınmasın.
    // eslint-disable-next-line no-eval
    eval(LOADER_SRC);
    window.MFSimLoader.start();
    jest.advanceTimersByTime(1000);            // 250 ms bekleme + 340 ms sönme
  }
  const splash = () => document.getElementById('mfsim-loading-screen');

  test('kanca tanımlıysa splash SÖNMEDEN önce çağrılır', () => {
    let sinifCagriAninda = null;
    const kanca = jest.fn(function (el) { sinifCagriAninda = el.className; });
    window.veWelcomeAdoptSplashLogo = kanca;
    kostur();

    expect(kanca).toHaveBeenCalledTimes(1);
    expect(kanca.mock.calls[0][0]).toBe(splash());
    expect(sinifCagriAninda).not.toContain('mfsim-fading-out');
    expect(splash().style.display).toBe('none');
  });

  test('kanca YOKSA splash yine kapanır', () => {
    delete window.veWelcomeAdoptSplashLogo;
    kostur();
    expect(splash().style.display).toBe('none');
  });

  test('kanca PATLASA bile splash kapanır', () => {
    window.veWelcomeAdoptSplashLogo = function () { throw new Error('marka devri bozuk'); };
    kostur();
    expect(splash().style.display).toBe('none');
  });

  test('kancanın adı iki dosya arasında ORTAK — yeniden adlandırma sessizce keserdi', () => {
    expect(LOADER_SRC).toContain('window.veWelcomeAdoptSplashLogo');
    expect(loadSource('components.js'))
      .toContain('window.veWelcomeAdoptSplashLogo = veWelcomeAdoptSplashLogo');
  });
});
