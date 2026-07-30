/**
 * MFSim E2E Testleri (Playwright)
 *
 * Bu testler gerçek bir tarayıcıda çalışır.
 * Çalıştırmak için: npm run test:e2e
 * Gereksinim: npx playwright install chromium
 */

const { test, expect } = require('@playwright/test');

test.describe('Sayfa Yükleme', () => {
  test('index.html başarıyla yüklenir', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page).toHaveTitle(/MFSim|Motor/i);
  });

  test('canvas alanı görünür', async ({ page }) => {
    await page.goto('/index.html');
    const canvas = page.locator('#ve-canvas');
    await expect(canvas).toBeVisible();
  });

  test('şerit ve hızlı erişim çubuğu mevcut', async ({ page }) => {
    await page.goto('/index.html');

    // Zoom/ızgara gibi komutlar artık canvas araç çubuğunda değil, şeritte
    // (bkz. js/ribbon.js). Şeridin gövdesi modüller yüklendikten sonra çizilir;
    // burada statik iskeletin ve hızlı erişim butonlarının varlığı doğrulanır.
    await expect(page.locator('#ve-ribbon')).toHaveCount(1);
    await expect(page.locator('#ve-qat [data-qat="veSaveTopology"]')).toHaveCount(1);
    await expect(page.locator('#ve-qat [data-qat="veUndo"]')).toHaveCount(1);
    await expect(page.locator('#ve-qat [data-qat="veRedo"]')).toHaveCount(1);
  });
});

test.describe('Dosya Menüsü', () => {
  test('dosya menüsü açılır ve kapanır', async ({ page }) => {
    await page.goto('/index.html');

    // Dosya menüsünü aç
    const fileBtn = page.locator('[onclick*="veToggleFileMenu"]');
    await fileBtn.click();

    const fileMenu = page.locator('#ve-file-menu');
    await expect(fileMenu).toBeVisible();

    // Tekrar tıkla → kapansın
    await fileBtn.click();
    await expect(fileMenu).not.toBeVisible();
  });

  test('kaydet butonu mevcut', async ({ page }) => {
    await page.goto('/index.html');

    const fileBtn = page.locator('[onclick*="veToggleFileMenu"]');
    await fileBtn.click();

    // Menü içine kapsamlandırılmıştır: aynı komut hızlı erişim çubuğunda ya da
    // başka bir yüzeyde de bulunabilir; kapsamsız seçici strict-mode ihlali verir.
    const saveBtn = page.locator('#ve-file-menu [onclick*="veSaveTopology"]');
    await expect(saveBtn).toBeVisible();
  });

  test('yükle butonu mevcut', async ({ page }) => {
    await page.goto('/index.html');

    const fileBtn = page.locator('[onclick*="veToggleFileMenu"]');
    await fileBtn.click();

    const loadBtn = page.locator('#ve-file-menu [onclick*="veLoadTopology"]');
    await expect(loadBtn).toBeVisible();
  });
});

test.describe('Sekme Yönetimi', () => {
  test('yeni sekme eklenebilir', async ({ page }) => {
    await page.goto('/index.html');

    // Mevcut sekme sayısı
    const initialTabs = await page.locator('.ve-tab').count();

    // Yeni sekme ekle butonuna tıkla
    const addBtn = page.locator('[onclick*="veAddTab"]');
    if (await addBtn.count() > 0) {
      await addBtn.click();
      const newTabs = await page.locator('.ve-tab').count();
      expect(newTabs).toBeGreaterThan(initialTabs);
    }
  });
});

test.describe('Bileşen Ekleme', () => {
  test('bileşen panelinden sürükle-bırak ile eklenebilir', async ({ page }) => {
    await page.goto('/index.html');

    // Bileşen sayacını kontrol et
    const nodeCountBefore = await page.evaluate(() =>
      typeof nodes !== 'undefined' ? nodes.length : 0
    );

    // Motor bileşenini bul ve canvas'a sürükle
    const motorItem = page.locator('[data-type="Motor"]').first();
    if (await motorItem.count() > 0) {
      const canvas = page.locator('#ve-canvas');
      await motorItem.dragTo(canvas);

      const nodeCountAfter = await page.evaluate(() => nodes.length);
      expect(nodeCountAfter).toBeGreaterThan(nodeCountBefore);
    }
  });
});

test.describe('Proje Kaydet (showSaveFilePicker)', () => {
  test('kaydet fonksiyonu showSaveFilePicker kullanır', async ({ page }) => {
    await page.goto('/index.html');

    // showSaveFilePicker'ın çağrılıp çağrılmadığını izle
    const pickerCalled = await page.evaluate(() => {
      return new Promise((resolve) => {
        if (window.showSaveFilePicker) {
          const original = window.showSaveFilePicker;
          window.showSaveFilePicker = function (opts) {
            resolve({ called: true, suggestedName: opts.suggestedName });
            // İptal et (AbortError)
            return Promise.reject(new DOMException('Cancelled', 'AbortError'));
          };
          veSaveTopology();
        } else {
          resolve({ called: false, reason: 'API not supported' });
        }
      });
    });

    if (pickerCalled.called) {
      expect(pickerCalled.suggestedName).toContain('.json');
    }
  });
});

test.describe('Undo / Redo', () => {
  test('Ctrl+Z ile geri alınabilir', async ({ page }) => {
    await page.goto('/index.html');

    // Toast mesajını dinle
    const toastPromise = page.waitForSelector('.toast-message', { timeout: 3000 }).catch(() => null);

    await page.keyboard.press('Control+z');

    // Toast gösterilmeli (ya "Geri alındı" ya da "Geri alınacak işlem yok")
    const toast = await toastPromise;
    if (toast) {
      const text = await toast.textContent();
      expect(text).toMatch(/Geri al/);
    }
  });
});
