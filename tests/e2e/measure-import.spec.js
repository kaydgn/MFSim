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

  // TABLO KİPİ — içe aktarılan ölçüm için de dolmalı.
  //
  // ÖLÇÜLEN KUSUR: beş sinyal şerit diyagramında düzgün çiziliyordu, "Tablo"ya
  // geçilince gövde tek satır kalıyordu: "Simülasyon verisi bekleniyor".
  // Sebep js/results.js'teki veri kapısıydı —
  //   _haveData = !!window.veSimResults || veMntSets().length > 0
  // yani yalnız SİMÜLASYON ve TAKOZ tanınıyordu; içe aktarma hiç eklenmemişti.
  // veRenderTable'ın içe aktarma dalı (veImpXSeries) ZATEN yazılıydı; eksik
  // olan tek şey onu çağıran kapıydı.
  //
  // Bu kusurun hayatta kalma sebebi: aynı çizici iki programda çalışıyor ama
  // kapı yalnız MFSim'de var ve tablo testi yalnız GÖRÜNTÜLEYİCİDE vardı
  // (viewer.spec.js). Bu test o boşluğu kapatıyor.
  test('Tablo kipi içe aktarılan ölçümle DOLU ve değerler ham seriyle aynı', async ({ page }) => {
    await openApp(page);
    await importFixture(page, canoeXlsx(200));
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length === 5,
      null, { timeout: 20000 });

    await page.click('#ve-trace-toolbar [data-mode="table"]');
    const tbody = page.locator('#ve-table-body-0');
    await expect(tbody).toBeVisible();
    await expect(tbody).not.toContainText('bekleniyor');

    // Dolu olması yetmez: DOĞRU olmalı. Boş bir tablo göze çarpar, dolu ama
    // yanlış bir tablo çarpmaz — asıl korunması gereken bu.
    const r = await page.evaluate(() => {
      const slot = veResultSlots[0];
      const xs = veImpXSeries(slot._dataSource);
      const seri = slot.sensors.map((s) => veGetSensorData(s.id, s.signal));
      const tr = [...document.querySelectorAll('#ve-table-body-0 tr')];
      const uyusmaz = [];
      [0, 1, 2, 17, 99, 199].forEach((i) => {
        if (i >= tr.length) return;
        const td = [...tr[i].querySelectorAll('td')].map((e) => e.innerText.trim());
        if (td[0] !== String(i + 1)) uyusmaz.push(`satır ${i}: sıra no ${td[0]}`);
        if (Math.abs(parseFloat(td[1]) - xs[i]) > 1e-6) uyusmaz.push(`satır ${i}: X ${td[1]} ≠ ${xs[i]}`);
        seri.forEach((d, k) => {
          const bek = veFormatTooltipVal(d ? d[i] : null);
          if (td[2 + k] !== bek) uyusmaz.push(`satır ${i} sütun ${k}: ${td[2 + k]} ≠ ${bek}`);
        });
      });
      const son3 = tr.slice(-3).map((t) => t.querySelector('td').innerText.trim());
      return { satir: tr.length, uyusmaz, son3, ornek: xs.length };
    });

    // 200 örnek → 200 veri satırı + MİN/MAKS/ORT
    expect(r.ornek).toBe(200);
    expect(r.satir).toBe(203);
    expect(r.uyusmaz).toEqual([]);
    expect(r.son3).toEqual(['MİN', 'ORT', 'MAKS']);   // görüntüleyiciyle aynı
  });

  test('Tablo X ekseni değiştirilince O EKSENİ gösterir', async ({ page }) => {
    await openApp(page);
    await importFixture(page, canoeXlsx(200));
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length === 5,
      null, { timeout: 20000 });

    // X eksenini VehSpeed'e çevir (listeyi aç → veSetSlotXAxis İNDEKS alır)
    await page.click('#ve-trace-toolbar [data-act="xaxis"]');
    const sec = await page.evaluate(() => {
      const dd = document.getElementById('ve-xaxis-dropdown-0');
      const i = dd._options.findIndex((o) => /VehSpeed/i.test(o.name || ''));
      veSetSlotXAxis(0, i);
      return i;
    });
    expect(sec).toBeGreaterThan(0);

    await page.click('#ve-trace-toolbar [data-mode="table"]');
    const r = await page.evaluate(() => {
      const slot = veResultSlots[0];
      const hiz = veGetSensorData(slot.sensors[1].id, slot.sensors[1].signal);
      const bas = [...document.querySelectorAll('#ve-table-0 th')].map((e) => e.innerText.trim());
      const x = [...document.querySelectorAll('#ve-table-body-0 tr')].slice(0, 3)
        .map((t) => parseFloat(t.querySelectorAll('td')[1].innerText));
      return { baslik: bas[1], x, ham: hiz.slice(0, 3) };
    });
    expect(r.baslik).toBe('VehSpeed [km/h]');
    r.x.forEach((v, i) => expect(Math.abs(v - r.ham[i])).toBeLessThan(1e-3));
  });

  // SÜTUN BAŞLIĞI KULLANICI VERİSİDİR.
  //
  // ÖLÇÜLEN KUSUR: başlığı  Basinc <img src=x onerror="...">  olan bir CSV içe
  // aktarılıp X ekseni listesi açıldığında <img> gerçekten DOM'a giriyor ve
  // onerror ÇALIŞIYORDU. Kötü niyet gerekmiyor: '<' içeren bir başlık menüyü
  // sessizce bozmaya zaten yetiyordu — görünen metinden koca bir parça
  // kayboluyor, kullanıcı hangi sütunu seçtiğini bilemiyordu.
  test('sütun başlığındaki HTML çalıştırılmaz, olduğu gibi YAZILIR', async ({ page }) => {
    const KOTU = 'Basinc <img src=x onerror="window.__SIZDI=1"> "kapali"';
    const satir = [`Time;${KOTU};Hiz`, 's;bar;km/h'];
    for (let k = 0; k < 120; k++) {
      satir.push([(k * 0.02).toFixed(3), (k % 50).toFixed(2), (k * 0.3).toFixed(2)].join(';'));
    }
    await openApp(page);
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'), page.click('#ve-import-btn')]);
    await chooser.setFiles({ name: 'kotu.csv', mimeType: 'text/csv',
      buffer: Buffer.from(satir.join('\n'), 'utf8') });
    await page.waitForFunction(() => veImpUI && veImpUI.rows && !veImpUI.busy,
      null, { timeout: 30000 });
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length === 2,
      null, { timeout: 20000 });

    await page.click('#ve-trace-toolbar [data-act="xaxis"]');
    const r = await page.evaluate(() => {
      const dd = document.querySelector('.ve-xaxis-dropdown, [id^=ve-xaxis-dd]');
      return { acildi: !!dd, img: document.querySelectorAll('img[src="x"]').length,
        sizdi: !!window.__SIZDI, metin: dd ? dd.innerText : '' };
    });

    expect(r.acildi).toBe(true);
    expect(r.img).toBe(0);              // enjekte düğüm YOK
    expect(r.sizdi).toBe(false);        // script KOŞMADI
    // Ve kaçış metni yutmuyor: başlık olduğu gibi okunuyor.
    expect(r.metin).toContain('<img src=x');
    expect(r.metin).toContain('"kapali"');
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
