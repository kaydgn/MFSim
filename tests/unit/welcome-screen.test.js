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
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const CSS = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Karşılama bloğu: overlay'in açılışından tuval seçim kutusuna kadar.
const WELCOME = HTML.slice(
  HTML.indexOf('<div class="ve-module-overlay"'),
  HTML.indexOf('<div class="ve-selection-box"')
);

function setupDOM() {
  document.body.className = '';
  document.body.innerHTML =
    '<div id="ve-ribbon"></div>' +
    '<div id="sayfa2-content">' +
    '  <div class="ve-main">' +
    '    <div class="ve-doc-dock"></div>' +
    '    <div class="ve-module-overlay" id="ve-module-overlay">' +
    '      <button id="ve-welcome-stamp" hidden></button>' +
    '    </div>' +
    '  </div>' +
    '</div>';
}

setupDOM();
eval(loadSource('canvas-space.js'));
eval(loadSource('components.js'));

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
  test('dört modül kutusu, dördü de .ve-module-card (E2E bu seçiciyle tıklıyor)', () => {
    const kartlar = WELCOME.match(/class="ve-module-card"/g) || [];
    expect(kartlar.length).toBe(4);

    ['arac-performans', 'mount-analysis', 'fead-analysis', 'structural-analysis']
      .forEach(function (tip) {
        expect(WELCOME).toContain("veStartModule('" + tip + "')");
      });
  });

  test('her kutuda ad, açıklama ve künye satırı var', () => {
    ['ve-module-card-name', 've-module-card-desc', 've-module-card-spec'].forEach(function (sinif) {
      const n = (WELCOME.match(new RegExp('class="' + sinif + '"', 'g')) || []).length;
      expect(n).toBe(4);
    });
  });

  test('şerit gizliyken ulaşılamaz kalacak komutların girişi burada', () => {
    // Şerit bu ekranda çizilmiyor; bu dört komuda BAŞKA yol yok.
    ['veLoadTopology', 'veGuideKitOpen', 'veOpenSettings', 'veOpenStatusModal']
      .forEach(function (komut) {
        expect(WELCOME).toContain(komut);
      });
  });

  test('klavye erişimi korunuyor: her kutu odaklanabilir ve Enter/Space ile açılır', () => {
    expect((WELCOME.match(/tabindex="0"/g) || []).length).toBe(4);
    expect((WELCOME.match(/event\.key==='Enter'/g) || []).length).toBe(4);
  });
});
