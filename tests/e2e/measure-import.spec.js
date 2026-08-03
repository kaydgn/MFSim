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
 *
 * Çalıştırmak için: npm run test:e2e
 */

const { test, expect } = require('@playwright/test');
const zlib = require('zlib');

// ── Fixture: CANoe tarzı .xlsx üretimi ────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function zipBuild(files) {
  const locals = [], central = [];
  let offset = 0;
  for (const name of Object.keys(files)) {
    const raw = Buffer.from(files[name], 'utf8');
    const data = zlib.deflateRawSync(raw);
    const nb = Buffer.from(name, 'utf8');

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc32(raw), 14); lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nb.length, 26);
    locals.push(lh, nb, data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc32(raw), 16);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, nb);

    offset += 30 + nb.length + data.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

function colRef(i) {
  let s = '', n = i + 1;
  while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/**
 * Gerçek bir CANoe Excel çıktısının düzeni: üstte üstbilgi satırları, boş
 * ayırıcı, başlık, birim satırı, sonra veri. Tork ve mod sütunları SEYREK
 * (farklı CAN periyodu) — örnekle-ve-tut yolu da sınanır.
 */
function canoeXlsx(rowCount = 300) {
  const shared = [], sidx = new Map();
  const sid = (v) => {
    if (!sidx.has(v)) { sidx.set(v, shared.length); shared.push(v); }
    return sidx.get(v);
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const meta = [['Measurement:', 'Testfahrt_2026'], ['Exported:', '11.03.2026 14:22:07']];
  const hdr = ['Time', 'EngineData::EngSpeed [1/min]', 'VehicleData::VehSpeed',
    'Motor Sıcaklığı', 'GearBoxInfo::Gear', 'GearBoxInfo::Mode'];
  const units = ['s', '1/min', 'km/h', '°C', '', ''];

  const out = [];
  let r = 1;
  for (const m of meta) {
    out.push(`<row r="${r}">` + m.map((v, j) =>
      `<c r="${colRef(j)}${r}" t="s"><v>${sid(v)}</v></c>`).join('') + '</row>');
    r++;
  }
  out.push(`<row r="${r}"/>`); r++;
  out.push(`<row r="${r}">` + hdr.map((v, j) =>
    `<c r="${colRef(j)}${r}" t="s"><v>${sid(v)}</v></c>`).join('') + '</row>'); r++;
  out.push(`<row r="${r}">` + units.map((v, j) =>
    `<c r="${colRef(j)}${r}" t="s"><v>${sid(v)}</v></c>`).join('') + '</row>'); r++;

  for (let k = 0; k < rowCount; k++) {
    const t = k * 0.02;
    const rpm = 800 + 1500 * (1 - Math.exp(-t / 4));
    const v = Math.min(95, t * 3.4);
    const temp = 20 + 55 * (1 - Math.exp(-t / 9));
    const gear = Math.min(6, 1 + Math.floor(v / 16));
    let cells = '';
    [t, rpm, v, temp, gear].forEach((val, j) => {
      if (j === 3 && k % 5) return;                    // sıcaklık seyrek
      cells += `<c r="${colRef(j)}${r}"><v>${val.toPrecision(6)}</v></c>`;
    });
    if (k % 10 === 0) {
      const mode = gear <= 2 ? '1C' : (gear <= 4 ? '2L' : '2H');
      cells += `<c r="${colRef(5)}${r}" t="s"><v>${sid(mode)}</v></c>`;
    }
    out.push(`<row r="${r}">${cells}</row>`); r++;
  }

  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  return zipBuild({
    'xl/workbook.xml':
      `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets><sheet name="Measurement" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/sharedStrings.xml':
      `<?xml version="1.0"?><sst xmlns="${NS}" count="${shared.length}" uniqueCount="${shared.length}">` +
      shared.map((s) => `<si><t>${esc(s)}</t></si>`).join('') + `</sst>`,
    'xl/worksheets/sheet1.xml':
      `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${out.join('')}</sheetData></worksheet>`,
  });
}

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
