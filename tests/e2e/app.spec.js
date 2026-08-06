/**
 * MFSim E2E — kabuk ve temel etkileşimler (Playwright)
 *
 * Çalıştırmak için: npm run test:e2e
 *
 * ─────────────────────────────────────────────────────────────────────────
 * BU DOSYA YENİDEN YAZILDI. Eski hâlinde beş testin ÜÇÜ hiç çalışmıyordu:
 * gövdeleri `if (locator.count() > 0)` gibi koşulların içindeydi ve
 * koşullar var olmayan seçicilere bakıyordu —
 *
 *     data-type="Motor"        → gerçek tip 'engine'
 *     .toast-message           → gerçek sınıf .ve-toast
 *     [onclick*="veAddTab"]    → düğme ancak modüller yüklendikten sonra çizilir
 *
 * Yani özellik bozulsa da testler yeşil kalıyordu: sahte güvence. Dördüncüsü
 * (kaydetme) doğrudan patlıyordu, çünkü giriş yapmadan `veSaveTopology`
 * çağırıyordu — modüller js/loader.js ile GİRİŞTEN SONRA yükleniyor.
 *
 * Artık iki grup var:
 *   • Giriş ÖNCESİ: yalnız statik kabuk (index.html'de doğrudan yazan şeyler)
 *   • Giriş SONRASI: modüllerin çizdiği yüzey — iddialar KOŞULSUZ
 * ─────────────────────────────────────────────────────────────────────────
 */

const { test, expect } = require('@playwright/test');

// Giriş + modül yüklemesi. Diğer E2E dosyalarıyla aynı yol: gerçek parola
// akışından geçiliyor, çünkü giriş kapısı da uygulamanın parçası.
async function bootApp(page) {
  await page.goto('/index.html');
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForFunction(
    () => typeof window.veSaveTopology === 'function' &&
          typeof window.veAddTab === 'function' &&
          typeof window.createNode === 'function' &&
          Array.isArray(window.nodes),
    null, { timeout: 60000 });
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 60000 });

  // Karşılama ekranı kapanmadan bileşen paleti GİZLİ durur. Kart tıklamak
  // yerine bu fonksiyon çağrılıyor çünkü kart aynı zamanda bir modül bloğu
  // BIRAKIYOR; testler boş bir kanvasla başlamalı ki eklenen düğüm sayılabilsin.
  await page.evaluate(() => veSelectModuleFromOverlay('arac-performans'));
  await expect(page.locator('#ve-module-overlay')).toBeHidden();
}

// ── Giriş öncesi: statik kabuk ───────────────────────────────────────────
// Buradaki her şey index.html'de DOĞRUDAN yazıyor; modül yüklemesi
// beklenmeden doğrulanabilir. Kabuk bozulursa program hiç açılmaz.

test.describe('Statik kabuk (giriş öncesi)', () => {
  test('sayfa yüklenir ve başlığı doğrudur', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page).toHaveTitle(/MFSim|Motor/i);
  });

  test('kanvas ve şerit iskeleti yerinde', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#ve-canvas')).toBeVisible();
    await expect(page.locator('#ve-ribbon')).toHaveCount(1);
  });

  test('hızlı erişim çubuğunda kaydet / geri al / yinele var', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#ve-qat [data-qat="veSaveTopology"]')).toHaveCount(1);
    await expect(page.locator('#ve-qat [data-qat="veUndo"]')).toHaveCount(1);
    await expect(page.locator('#ve-qat [data-qat="veRedo"]')).toHaveCount(1);
  });

  test('marka düz etiket — proje menüsü kaldırılmıştı', async ({ page }) => {
    // Menüdeki her komut şeritte de vardı; menü kalktı. Geri gelirse burada
    // görünür (regresyon kapısı).
    await page.goto('/index.html');
    await expect(page.locator('#ve-file-menu')).toHaveCount(0);
    await expect(page.locator('[onclick*="veToggleFileMenu"]')).toHaveCount(0);
    await expect(page.locator('#ve-project-name-btn')).toBeVisible();
    await expect(page.locator('#ve-project-name-btn .ve-brand-chev')).toHaveCount(0);
  });
});

// ── Giriş sonrası: modüllerin çizdiği yüzey ──────────────────────────────

test.describe('Sekme yönetimi', () => {
  test.setTimeout(90000);

  test('"+" düğmesi yeni topoloji sekmesi açar', async ({ page }) => {
    await bootApp(page);
    const before = await page.locator('.ve-tab').count();
    expect(before).toBeGreaterThan(0);          // açılışta en az bir sekme olmalı

    await page.locator('.ve-tab-add').click();
    await expect(page.locator('.ve-tab')).toHaveCount(before + 1);
    // Sekme yalnız görsel değil: durum katmanında da açılmalı
    expect(await page.evaluate(() => veTabs.length)).toBe(before + 1);
  });

  test('sekme kapatılabilir', async ({ page }) => {
    await bootApp(page);
    await page.locator('.ve-tab-add').click();
    const n = await page.locator('.ve-tab').count();

    await page.locator('.ve-tab').last().locator('.ve-tab-close').click();
    await expect(page.locator('.ve-tab')).toHaveCount(n - 1);
  });
});

test.describe('Bileşen ekleme', () => {
  test.setTimeout(90000);

  test('modül bloğu sürükle-bırak ile kanvasa eklenir', async ({ page }) => {
    // ÜST SEVİYEDE yalnız "Modüller" görünür (bkz. arac-performans.spec.js
    // sidebar kapsamı testi); güç aktarma bileşenleri modülün İÇİNDE. Bu
    // yüzden üst seviyenin gerçek etkileşimi bir MODÜL bırakmaktır.
    await bootApp(page);
    expect(await page.evaluate(() => nodes.length)).toBe(0);

    const item = page.locator('.ve-submodule[data-type="arac-performans"]');
    await expect(item).toBeVisible();
    await item.dragTo(page.locator('#ve-canvas'));

    await page.waitForFunction(() => window.nodes.length === 1, null, { timeout: 10000 });
    const t = await page.evaluate(() => nodes[0].type);
    expect(t).toBe('arac-performans');
    await expect(page.locator('#ve-canvas .ve-node')).toHaveCount(1);
  });

  test('modülün içinde güç aktarma bileşeni eklenebilir', async ({ page }) => {
    await bootApp(page);
    // KURULUM doğrudan çağrıyla yapılıyor, çift tıkla değil: yeni düğüm
    // '.ve-node-dropin' giriş animasyonuyla geldiği için Playwright onu bir
    // süre "kararsız" görüyor ve çift tık kırılganlaşıyor. Çift tıkla açma
    // zaten kendi testinde doğrulanıyor (arac-performans.spec.js); burada
    // ölçülen şey İÇERİDE bileşen eklenebilmesi.
    await page.evaluate(() => {
      createNode('arac-performans', 3200, 3200);
      var n = nodes.find((x) => x.type === 'arac-performans');
      veAracOpenEditor(n.id);
    });
    await page.waitForFunction(() => window.nodes.length === 16, null, { timeout: 15000 });

    // İç topolojide bileşen kategorileri açılır; motoru kanvasa bırak.
    const engine = page.locator('.ve-component[data-type="engine"]').first();
    await expect(engine).toBeVisible();
    await engine.dragTo(page.locator('#ve-canvas'));

    await page.waitForFunction(() => window.nodes.length === 17, null, { timeout: 10000 });
    const engines = await page.evaluate(() => nodes.filter((n) => n.type === 'engine').length);
    expect(engines).toBe(2);       // preset'ten gelen + yeni bırakılan
  });
});

test.describe('Proje kaydetme', () => {
  test.setTimeout(90000);

  // "Kaydet" DOĞRUDAN tarayıcı seçicisini açmıyor: önce kendi "Farklı Kaydet"
  // penceresini gösterip dosya adını soruyor (js/toolbar.js veShowSaveDialog).
  // Seçici ancak o pencere onaylanınca çağrılıyor. Eski test bunu atlayıp
  // doğrudan seçiciyi bekliyordu.
  async function saveDialog(page) {
    await page.evaluate(() => veSaveTopology());
    await expect(page.locator('#ve-save-dialog-overlay')).toBeVisible();
    await expect(page.locator('#ve-save-filename')).toHaveValue(/.+/);
  }

  test('kaydet penceresi dosya adını sorar', async ({ page }) => {
    await bootApp(page);
    await saveDialog(page);
    // Uzantı kullanıcıya bırakılmıyor: ad alanının yanında sabit duruyor.
    await expect(page.locator('#ve-save-dialog-overlay')).toContainText('.json');
    await page.locator('#ve-save-cancel').click();
    await expect(page.locator('#ve-save-dialog-overlay')).toHaveCount(0);
  });

  test('onaylanınca showSaveFilePicker .json adıyla çağrılır', async ({ page }) => {
    await bootApp(page);
    await page.evaluate(() => {
      window.__picked = null;
      window.showSaveFilePicker = function (opts) {
        window.__picked = (opts && opts.suggestedName) || '';
        return Promise.reject(new DOMException('Cancelled', 'AbortError'));
      };
    });

    await saveDialog(page);
    await page.locator('#ve-save-confirm').click();

    await page.waitForFunction(() => window.__picked !== null, null, { timeout: 10000 });
    expect(await page.evaluate(() => window.__picked)).toMatch(/\.json$/);
  });

  test('boş dosya adı reddedilir — pencere açık kalır', async ({ page }) => {
    // Sessizce boş adla kaydetmek ya da pencereyi kapatıp hiçbir şey yapmamak,
    // kullanıcının "kaydettim" sanmasına yol açardı.
    await bootApp(page);
    await saveDialog(page);
    await page.fill('#ve-save-filename', '   ');
    await page.locator('#ve-save-confirm').click();
    await expect(page.locator('#ve-save-dialog-overlay')).toBeVisible();
    // Seçici DARALTILIYOR: ekranda başka bildirimler de olabiliyor ve
    // `.ve-toast` çoklu eşleşince Playwright strict-mode ihlali veriyor.
    await expect(page.locator('.ve-toast', { hasText: 'boş olamaz' })).toBeVisible();
  });

  test('showSaveFilePicker yoksa indirme yoluna düşer ve dosya GEÇERLİ', async ({ page }) => {
    // Firefox/Safari'de bu API yok. Yedek yol sessizce çalışmazsa kullanıcı
    // "Kaydet"e basıyor ve hiçbir şey olmuyor — en kötü hata biçimi.
    await bootApp(page);
    await page.evaluate(() => { delete window.showSaveFilePicker; });

    const download = page.waitForEvent('download', { timeout: 15000 });
    await saveDialog(page);
    await page.locator('#ve-save-confirm').click();
    const file = await download;

    // Dosya ADI değil İÇERİĞİ doğrulanıyor. Chromium blob indirmelerinde
    // suggestedFilename() 'download' dönebiliyor (anchor'ın download özniteliği
    // blob URL'de her zaman yansımıyor) — o yüzden ada bakan bir iddia
    // ortamdan ortama değişirdi. Asıl soru zaten şu: kaydedilen dosya geri
    // YÜKLENEBİLİR bir proje mi?
    const fs = require('fs');
    const path = await file.path();
    const project = JSON.parse(fs.readFileSync(path, 'utf8'));
    expect(project.version).toBe(2);
    expect(Array.isArray(project.tabs)).toBe(true);
    expect(project.tabs.length).toBeGreaterThan(0);
    expect(project.tabs[0].state).toBeTruthy();
  });
});

test.describe('Geri al / yinele', () => {
  test.setTimeout(90000);

  test('Ctrl+Z boş geçmişte açıkça uyarır', async ({ page }) => {
    await bootApp(page);
    await page.keyboard.press('Control+z');
    // Gerçek sınıf .ve-toast (eski test .toast-message arıyordu ve hiç
    // eşleşmediği için gövdesi hiç çalışmıyordu). hasText ile daraltılıyor:
    // ekranda aynı anda başka bildirimler de durabiliyor.
    await expect(page.locator('.ve-toast', { hasText: 'Geri al' })).toBeVisible();
  });

  test('eklenen bileşen geri alınır, yinelenince döner', async ({ page }) => {
    await bootApp(page);
    await page.evaluate(() => { createNode('arac-performans', 3200, 3200); });
    await page.waitForFunction(() => window.nodes.length === 1, null, { timeout: 10000 });

    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.nodes.length === 0, null, { timeout: 10000 });

    await page.keyboard.press('Control+y');
    await page.waitForFunction(() => window.nodes.length === 1, null, { timeout: 10000 });
    expect(await page.evaluate(() => nodes[0].type)).toBe('arac-performans');
  });
});
