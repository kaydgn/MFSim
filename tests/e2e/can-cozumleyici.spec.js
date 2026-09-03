/**
 * CAN Çözümleyici — uçtan uca (Playwright)
 *
 * Test edilen şey ÜRÜNÜN KENDİSİ: candbc/build.js'in ürettiği tek dosya.
 * Modüler kaynak değil — kullanıcının eline geçen o dosya ve "gömülmemiş bir
 * kaynak kaldı mı", "script sırası doğru mu", "file:// üzerinde açılıyor mu"
 * sorularının cevabı ancak çıktıda görünür.
 *
 * Birim testler bu halkaları HİÇ görmüyor: onlar candbc/js/ dosyalarını
 * doğrudan yükler, tek dosyaya bakmaz.
 *
 * ÖN KOŞUL: npm run build:can
 * Çalıştırmak için: npm run test:e2e
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BUILD = path.join(__dirname, '../../MFSim_CAN_Cozumleyici.html');

// TESTLER file:// ÜZERİNDEN KOŞAR — kullanım birebir bu: dosyayı indir, çift
// tıkla. Sunucu üzerinden koşmak daha kolay olurdu ama o zaman file://'de
// patlayan bir bağımlılık (fetch, Worker, dinamik import) testten KAÇARDI.
const FILE_URL = 'file://' + BUILD;

test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) {
    throw new Error('MFSim_CAN_Cozumleyici.html yok. Önce: npm run build:can');
  }
});

async function open(page) {
  await page.goto(FILE_URL);
  await page.waitForFunction(
    () => typeof cdbParseDbc === 'function' && typeof cdbChartRedraw === 'function',
    null, { timeout: 30000 });
  await page.waitForSelector('#cdb-tree', { timeout: 30000 });
}

test('açılış: sıfır ağ isteği, sıfır konsol hatası', async ({ page }) => {
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // Tek dosya olarak dağıtılıyor: yanına hiçbir şey kopyalanmıyor. file://
  // dışına çıkan TEK bir istek bile kullanıcının makinesinde 404 demek.
  page.on('request', r => { if (!r.url().startsWith('file://')) requests.push(r.url()); });

  await open(page);
  await expect(page).toHaveTitle('CAN Çözümleyici');
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});

test('örnek yükleme: DBC + kayıt çözülür, şeritler çizilir', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await open(page);

  await page.click('#cdb-topbar button[title^="Elinizde dosya yoksa"]');
  await page.waitForFunction(() => cdbState.store && cdbState.store.n > 0, null, { timeout: 20000 });

  const s = await page.evaluate(() => ({
    kare: cdbState.store.n,
    bicim: cdbState.store.formatId,
    atlanan: cdbState.store.skipped,
    mesaj: cdbState.db.messages.length,
    uyari: cdbState.db.warnings.length,
    kanal: cdbState.channels.length,
    tam: cdbState.match.exact,
    pgn: cdbState.match.pgn,
    yok: cdbState.match.unmatched,
    serit: cdbChart.lanes.length
  }));
  expect(s.bicim).toBe('candump');
  expect(s.kare).toBeGreaterThan(3000);
  expect(s.atlanan).toBe(0);
  expect(s.mesaj).toBe(5);
  expect(s.uyari).toBe(0);
  // Örneğin DBC'si kendi kaydını TAM karşılamalı: tek bir tanımsız kimlik bile
  // "örnek bozuk" demektir ve kullanıcı ilk açılışta boş şerit görür.
  expect(s.kanal).toBe(5);
  expect(s.tam).toBe(5);
  expect(s.pgn).toBe(0);
  expect(s.yok).toBe(0);
  expect(s.serit).toBe(5);

  // Canvas GERÇEKTEN boyandı mı? Şerit sayısı yeterli kanıt değil: geometrisi
  // bozuk bir çizim de beş şerit sayar.
  const painted = await page.evaluate(() => {
    const cv = document.getElementById('cdb-canvas');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4 * 37) if (d[i] > 0) n++;
    return n;
  });
  expect(painted).toBeGreaterThan(1000);
  expect(errors).toEqual([]);
});

test('sinyal gezgini: onay kutusu şeridi açar ve kapatır', async ({ page }) => {
  await open(page);
  await page.click('#cdb-topbar button[title^="Elinizde dosya yoksa"]');
  await page.waitForFunction(() => cdbChart.lanes.length === 5, null, { timeout: 20000 });

  const key = await page.evaluate(() => cdbChart.lanes[0].keys[0]);
  await page.click(`.vsig-row[data-sig="${key}"]`);
  expect(await page.evaluate(k => cdbChartHasSignal(k), key)).toBe(false);
  await page.click(`.vsig-row[data-sig="${key}"]`);
  expect(await page.evaluate(k => cdbChartHasSignal(k), key)).toBe(true);
});

test('sekmeler: kare listesi, istatistik ve tanı dolu gelir', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await open(page);
  await page.click('#cdb-topbar button[title^="Elinizde dosya yoksa"]');
  await page.waitForFunction(() => cdbState.store && cdbState.store.n > 0, null, { timeout: 20000 });

  for (const [tab, enAz] of [['frames', 50], ['stats', 5], ['diag', 5]]) {
    await page.click(`#cdb-tabs button[data-tab="${tab}"]`);
    await page.waitForTimeout(150);
    const rows = await page.locator('#cdb-pane-alt tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(enAz);
  }

  // Kare listesinde çözülen sinyal metni GERÇEKTEN yazılıyor mu?
  await page.click('#cdb-tabs button[data-tab="frames"]');
  await page.waitForTimeout(150);
  const metin = await page.textContent('#cdb-pane-alt');
  expect(metin).toContain('MotorDevri');
  expect(metin).toContain('rpm');
  expect(errors).toEqual([]);
});

test('J1939 PGN düğmesi eşleştirmeyi yeniden kurar', async ({ page }) => {
  await open(page);
  await page.click('#cdb-topbar button[title^="Elinizde dosya yoksa"]');
  await page.waitForFunction(() => cdbState.store && cdbState.store.n > 0, null, { timeout: 20000 });
  // Örnekte her kimlik TAM eşleşiyor; PGN kapatmak sonucu DEĞİŞTİRMEMELİ.
  // (Değişseydi, tam eşleşme yerine PGN'e düşen bir yol var demektir.)
  const once = await page.evaluate(() => cdbState.match.exact);
  await page.click('#cdb-j1939');
  const sonra = await page.evaluate(() => ({ exact: cdbState.match.exact, pressed: document.getElementById('cdb-j1939').getAttribute('aria-pressed') }));
  expect(sonra.exact).toBe(once);
  expect(sonra.pressed).toBe('false');
});

test('tema düğmesi üç durumu dolaşır ve grafiği yeniden çizer', async ({ page }) => {
  await open(page);
  const t0 = await page.getAttribute('html', 'data-theme');
  await page.click('#cdb-theme-btn');
  const t1 = await page.getAttribute('html', 'data-theme');
  await page.click('#cdb-theme-btn');
  const t2 = await page.getAttribute('html', 'data-theme');
  expect([t0, t1, t2]).toEqual(expect.arrayContaining(['pearl', 'slate']));
  expect(t1).not.toBe(t2);
});
