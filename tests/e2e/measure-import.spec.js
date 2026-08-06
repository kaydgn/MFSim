/**
 * Ölçüm İçe Aktarma — uçtan uca (Playwright)
 *
 * Bu akış baştan sona ARAYÜZ: dosya seç → sütunları tara → X ekseni seç →
 * Y sütunlarını tikle → diyagramlara aktar. Mantık birim testlerle korunuyor
 * (tests/unit/measure-import.test.js, tests/unit/xlsx-read.test.js); burada
 * korunan şey PARÇALARIN BİRBİRİNE BAĞLI KALMASI: gerçek .xlsx baytları
 * gerçek tarayıcıda gerçek şeritlere dönüşüyor mu.
 *
 * Fixture testin içinde üretilir — depoya ikili dosya eklenmez ve dosya
 * gerçek bir ZIP olduğu için okuyucu tam yolu yürümek zorunda kalır.
 * Üreteç tests/e2e/helpers/canoe-xlsx.js'e taşındı: aynı fixture'ı tek dosyalık
 * Ölçüm Görüntüleyici testi de (viewer.spec.js) kullanıyor ve iki kopya zamanla
 * ayrışırdı.
 *
 * Çalıştırmak için: npm run test:e2e
 */

const { test, expect } = require('@playwright/test');
const { canoeXlsx } = require('./helpers/canoe-xlsx');

// ── Ortak kurulum ─────────────────────────────────────────────────────────

// Uygulama şifreyle açılır ve modüller ertelenmiş yüklenir (js/loader.js);
// perde kalkmadan yapılan tıklamalar geçmez.
async function openApp(page) {
  await page.goto('/index.html');
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForFunction(
    () => typeof veTabs !== 'undefined' && typeof veImpOpenPicker === 'function',
    null, { timeout: 60000 });
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 60000 });
  // Sayfa rayı ancak bir modül açıkken görünür
  await page.click('.ve-module-card');
  await page.click('.ve-nav-item[data-subtab="sonuclar"]');
}

async function importFixture(page, buffer, name = 'CANoe_Olcum.xlsx') {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#ve-import-btn'),
  ]);
  await chooser.setFiles({ name, mimeType: 'application/vnd.ms-excel', buffer });
  await page.waitForFunction(() => veImpUI && veImpUI.rows && !veImpUI.busy, null, { timeout: 30000 });
}

// ── Testler ───────────────────────────────────────────────────────────────

test.describe('Ölçüm içe aktarma sihirbazı', () => {
  test('İçe Aktar düğmesi Veri Gezgini başlığında', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#ve-import-btn')).toBeVisible();
  });

  test('komut şeritte de var — Giriş sekmesinde ve Sonuç Araçları\'nda', async ({ page }) => {
    // Keşfedilebilirlik: elinde dosya olan kullanıcı Sonuçlar sayfasına
    // gitmeden, ilk baktığı sekmede komutu bulabilmeli.
    await page.goto('/index.html');
    await page.fill('#mfsim-login-password', 'mfsim2024');
    await page.press('#mfsim-login-password', 'Enter');
    await page.waitForFunction(() => typeof veImpOpenPicker === 'function', null, { timeout: 60000 });
    await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 60000 });
    await page.click('.ve-module-card');

    const ribbonImport = page.locator('#ve-ribbon button', { hasText: 'İçe Aktar' });
    await expect(ribbonImport).toHaveCount(1);              // Giriş sekmesi
    await expect(ribbonImport.first()).toBeVisible();

    await page.click('.ve-nav-item[data-subtab="sonuclar"]');
    await expect(page.locator('#ve-ribbon button', { hasText: 'İçe Aktar' })).toHaveCount(1);
  });

  test('şerit düğmesi de sihirbazı açar', async ({ page }) => {
    await openApp(page);
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('#ve-ribbon button', { hasText: 'İçe Aktar' }).first().click(),
    ]);
    await chooser.setFiles({ name: 'x.xlsx', mimeType: 'application/vnd.ms-excel', buffer: canoeXlsx(120) });
    await page.waitForFunction(() => veImpUI && veImpUI.rows && !veImpUI.busy, null, { timeout: 30000 });
    await expect(page.locator('#ve-import-apply')).toBeEnabled();
  });

  test('sütun adları ilk satırdan taranır, X ekseni Time olarak önerilir', async ({ page }) => {
    await openApp(page);
    await importFixture(page, canoeXlsx());

    const st = await page.evaluate(() => ({
      headerRow: veImpUI.layout.headerRow,
      unitRow: veImpUI.layout.unitRow,
      xName: veImpUI.columns[veImpUI.xIndex].name,
      names: veImpUI.columns.map((c) => c.name),
      units: veImpUI.columns.map((c) => c.unit),
      groups: veImpUI.columns.map((c) => c.group),
    }));

    // Üstteki "Measurement:/Exported:" satırları elenmiş olmalı
    expect(st.headerRow).toBe(3);
    expect(st.unitRow).toBe(4);
    expect(st.xName).toBe('Time');
    expect(st.names).toEqual(['Time', 'EngSpeed', 'VehSpeed', 'Motor Sıcaklığı', 'Gear', 'Mode']);
    expect(st.units).toEqual(['s', '1/min', 'km/h', '°C', '', '']);
    expect(st.groups[1]).toBe('EngineData');
  });

  test('Y sütunları tikli kutuyla seçilir; hepsi varsayılan seçili', async ({ page }) => {
    await openApp(page);
    await importFixture(page, canoeXlsx());

    const boxes = page.locator('.ve-imp-item input[type="checkbox"]');
    await expect(boxes).toHaveCount(5);                 // X hariç 5 sinyal
    for (let i = 0; i < 5; i++) await expect(boxes.nth(i)).toBeChecked();

    await page.click('.ve-imp-mini:has-text("Hiçbiri")');
    await expect(page.locator('#ve-import-apply')).toBeDisabled();

    await page.click('.ve-imp-mini:has-text("Tümü")');
    await expect(page.locator('#ve-import-apply')).toBeEnabled();
  });

  test('arama kutusu sütunları süzer', async ({ page }) => {
    await openApp(page);
    await importFixture(page, canoeXlsx());

    await page.fill('.ve-imp-search', 'speed');
    await expect(page.locator('.ve-imp-item')).toHaveCount(2);   // EngSpeed, VehSpeed
    // Türkçe katlama: 'sicaklik' → 'Sıcaklığı'
    await page.fill('.ve-imp-search', 'sicak');
    await expect(page.locator('.ve-imp-item')).toHaveCount(1);
  });

  test('Diyagramlara Aktar seçilen sütunları şeritlere döker', async ({ page }) => {
    await openApp(page);
    await importFixture(page, canoeXlsx());
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length > 0, null, { timeout: 15000 });

    const board = await page.evaluate(() => {
      const s = veResultSlots[0];
      return {
        dataSource: s._dataSource,
        xAxisName: s.xAxis.name,
        xAxisDS: s.xAxis._dataSource,
        lanes: (s.lanes || []).length,
        signals: s.sensors.map((x) => x.name),
        xLen: (veTrResolveX(s) || []).length,
        // Her seri X dizisiyle indeks hizalı olmalı — pencere zamanla
        // eşleştirme yapmaz, yalnızca indeksten okur.
        lens: s.sensors.map((x) => (veGetSensorData(x.id, x.signal) || []).length),
      };
    });

    expect(board.dataSource).toMatch(/^import:/);
    expect(board.xAxisName).toBe('Time [s]');
    expect(board.xAxisDS).toBe(board.dataSource);
    expect(board.signals).toEqual(['EngSpeed', 'VehSpeed', 'Motor Sıcaklığı', 'Gear', 'Mode']);
    expect(board.lanes).toBe(5);
    expect(board.xLen).toBe(300);
    board.lens.forEach((n) => expect(n).toBe(300));
  });

  test('seyrek metin kanalı boşluk bırakmaz (örnekle-ve-tut)', async ({ page }) => {
    // Doldurulmazsa durum şeridi Y eksenini etiketler ama tek çizgi çizmez:
    // çizim katmanı her boşlukta kalemi kaldırıyor.
    await openApp(page);
    await importFixture(page, canoeXlsx());
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length > 0, null, { timeout: 15000 });

    const mode = await page.evaluate(() => {
      const s = veResultSlots[0];
      const e = s.sensors.find((x) => x.name === 'Mode');
      const series = veGetSensorData(e.id, e.signal) || [];
      return { gaps: series.filter((v) => v === null || v === undefined).length, len: series.length };
    });
    expect(mode.len).toBe(300);
    expect(mode.gaps).toBe(0);
  });

  test('içe aktarılan sinyaller Veri Gezgini ağacında görünür', async ({ page }) => {
    await openApp(page);
    await importFixture(page, canoeXlsx());
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veImpDatasets.length > 0, null, { timeout: 15000 });

    await expect(page.locator('#ve-results-tree')).toContainText('İçe Aktarılan Ölçümler');
    await expect(page.locator('#ve-results-tree')).toContainText('EngSpeed');
  });

  test('X ekseni değiştirilebilir — Time zorunlu değil', async ({ page }) => {
    await openApp(page);
    await importFixture(page, canoeXlsx());

    // VehSpeed'i X ekseni yap: "hız–devir" gibi eksen dışı grafikler için.
    const idx = await page.evaluate(() => veImpUI.columns.findIndex((c) => c.name === 'VehSpeed'));
    await page.selectOption('.ve-imp-xsel', String(idx));
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length > 0, null, { timeout: 15000 });

    const st = await page.evaluate(() => ({
      xAxisName: veResultSlots[0].xAxis.name,
      signals: veResultSlots[0].sensors.map((s) => s.name),
    }));
    expect(st.xAxisName).toBe('VehSpeed [km/h]');
    expect(st.signals).not.toContain('VehSpeed');   // X sütunu Y'ye sızmamalı
  });

  test('CSV de okunur ve ondalık virgül tanınır', async ({ page }) => {
    await openApp(page);
    const csv = 'Time;EngSpeed;VehSpeed\n0,00;800,5;0,0\n0,01;812,25;0,4\n0,02;825,0;0,9\n';
    await importFixture(page, Buffer.from(csv, 'utf8'), 'olcum.csv');

    const st = await page.evaluate(() => ({
      comma: veImpUI.commaDecimal,
      xName: veImpUI.columns[veImpUI.xIndex].name,
      names: veImpUI.columns.map((c) => c.name),
    }));
    expect(st.comma).toBe(true);
    expect(st.xName).toBe('Time');
    expect(st.names).toEqual(['Time', 'EngSpeed', 'VehSpeed']);

    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length > 0, null, { timeout: 15000 });
    const vals = await page.evaluate(() => {
      const e = veResultSlots[0].sensors[0];
      return veGetSensorData(e.id, e.signal);
    });
    expect(vals).toEqual([800.5, 812.25, 825]);
  });

  test('Excel olmayan dosya anlaşılır hata verir, uygulama ayakta kalır', async ({ page }) => {
    await openApp(page);
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#ve-import-btn'),
    ]);
    // ZIP imzalı ama Excel olmayan içerik: CSV yoluna düşmez, xlsx yolu patlar.
    await chooser.setFiles({
      name: 'bozuk.xlsx', mimeType: 'application/vnd.ms-excel',
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0]),
    });
    await expect(page.locator('#ve-import-content')).toContainText('Dosya açılamadı', { timeout: 20000 });
    await expect(page.locator('#ve-import-apply')).toBeDisabled();
  });
});
