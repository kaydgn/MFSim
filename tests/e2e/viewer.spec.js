/**
 * MFSim Ölçüm Görüntüleyici — uçtan uca (Playwright)
 *
 * Test edilen şey ÜRÜNÜN KENDİSİ: viewer/build.js'in ürettiği tek dosya.
 * Modüler kaynak değil, çünkü arkadaşın eline geçecek olan o dosya ve
 * "gömülmemiş bir kaynak kaldı mı", "sıra doğru mu", "file:// üzerinde açılıyor
 * mu" sorularının cevabı ancak çıktıda görünür.
 *
 * ÖN KOŞUL: npm run build:viewer (dosya yoksa testler açıkça o sebeple düşer).
 *
 * Fixture MFSim'in içe aktarma testiyle ORTAK (helpers/canoe-xlsx.js): iki
 * program aynı dosyayı aynı şekilde okumak zorunda, farklı fixture kullanmak
 * bu güvenceyi verirdi gibi görünüp vermezdi.
 *
 * Çalıştırmak için: npm run test:e2e
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { canoeXlsx } = require('./helpers/canoe-xlsx');

const BUILD = path.join(__dirname, '../../MFSim_Olcum_Goruntuleyici.html');

// TESTLER file:// ÜZERİNDEN KOŞAR — arkadaşın kullanımı birebir bu: dosyayı
// indir, çift tıkla. Sunucu üzerinden koşmak daha kolay olurdu ama o zaman
// file://'de patlayan bir bağımlılık (fetch, Worker, dinamik import, mutlak
// yol) testten KAÇARDI; oysa programın tek dağıtım biçimi bu dosya.
const FILE_URL = 'file://' + BUILD;

test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) {
    throw new Error(
      'MFSim_Olcum_Goruntuleyici.html yok. Önce: npm run build:viewer');
  }
});

// Giriş kapısı ve splash YOK — açılış tek adım. Beklenen tek şey modüllerin
// çalışmış olması; onu bir global üzerinden anlıyoruz.
async function openViewer(page) {
  await page.goto(FILE_URL);
  await page.waitForFunction(
    () => typeof veImpOpenPicker === 'function' && typeof veTrBoard === 'function',
    null, { timeout: 30000 });
  await page.waitForSelector('#ve-trace', { timeout: 30000 });
}

async function importFixture(page, buffer, name = 'CANoe_Olcum.xlsx') {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#ve-import-btn'),
  ]);
  await chooser.setFiles({ name, mimeType: 'application/vnd.ms-excel', buffer });
  await page.waitForFunction(() => veImpUI && veImpUI.rows && !veImpUI.busy,
    null, { timeout: 30000 });
}

test.describe('Ölçüm Görüntüleyici — tek dosya', () => {

  test('parola ve yükleme ekranı olmadan doğrudan açılır', async ({ page }) => {
    // Arkadaşın 7/24 kullanacağı programda her açılışta parola girmek ve
    // 6,5 saniyelik splash beklemek kabul edilemezdi — ikisi de yok.
    await openViewer(page);
    await expect(page.locator('#mfsim-login-overlay')).toHaveCount(0);
    await expect(page.locator('#mfsim-loading-screen')).toHaveCount(0);
    await expect(page.locator('#ve-import-btn')).toBeVisible();
    await expect(page.locator('#ve-results-tree')).toContainText('Henüz ölçüm yok');
  });

  test('boş durum çözücüye değil içe aktarmaya yönlendirir', async ({ page }) => {
    // MFSim'in "Çözüm sonucu yok / Çözücüyü Aç" metni burada olmayan bir şeye
    // işaret ederdi; kullanıcı beklemediği bir eksiklik arardı.
    await openViewer(page);
    const empty = page.locator('#ve-trace-empty');
    await expect(empty).toContainText('Henüz ölçüm yok');
    await expect(empty).not.toContainText('Çözüm sonucu yok');
    await expect(empty.locator('[data-act="open-solver"]')).toHaveCount(0);
    await expect(empty.locator('[data-act="import-measure"]')).toHaveCount(1);
  });

  test('konsola hata düşmeden açılır', async ({ page }) => {
    // Eksik bir global ya da gömülmemiş bir modül burada patlar. Sessiz
    // geçerse program "açılıyor ama bir şey yapmıyor" hâline gelirdi.
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await openViewer(page);
    expect(errors).toEqual([]);
  });

  test('gerçek .xlsx şeritlere dönüşür', async ({ page }) => {
    await openViewer(page);
    await importFixture(page, canoeXlsx());
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length > 0,
      null, { timeout: 15000 });

    const board = await page.evaluate(() => {
      const s = veResultSlots[0];
      return {
        dataSource: s._dataSource,
        xAxisName: s.xAxis.name,
        xAxisDS: s.xAxis._dataSource,
        lanes: (s.lanes || []).length,
        signals: s.sensors.map((x) => x.name),
        xLen: (veTrResolveX(s) || []).length,
        lens: s.sensors.map((x) => (veGetSensorData(x.id, x.signal) || []).length),
      };
    });

    // Beklentiler MFSim'in içe aktarma testiyle BİREBİR aynı: iki program aynı
    // dosyadan aynı panoyu kurmak zorunda.
    expect(board.dataSource).toMatch(/^import:/);
    expect(board.xAxisName).toBe('Time [s]');
    expect(board.xAxisDS).toBe(board.dataSource);
    expect(board.signals).toEqual(['EngSpeed', 'VehSpeed', 'Motor Sıcaklığı', 'Gear', 'Mode']);
    expect(board.lanes).toBe(5);
    expect(board.xLen).toBe(300);
    board.lens.forEach((n) => expect(n).toBe(300));
  });

  test('şeritler canvas\'a gerçekten çizilir', async ({ page }) => {
    // Pano dolu ama tuval boş olabilir (eksen çözülemezse). Boş durum
    // katmanının kapanmış olması "çizim yolu sonuna kadar yürüdü" demektir.
    await openViewer(page);
    await importFixture(page, canoeXlsx());
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length > 0,
      null, { timeout: 15000 });

    await expect(page.locator('#ve-trace-empty')).toBeHidden();
    const painted = await page.evaluate(() => {
      const cv = document.querySelector('#ve-trace-graph canvas');
      if (!cv || !cv.width || !cv.height) return { ok: false, why: 'canvas yok' };
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const seen = new Set();
      for (let i = 0; i < d.length; i += 4) {
        seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
        if (seen.size > 3) break;
      }
      // Tek renk = boş tuval. Eğri, ızgara ve eksen en az birkaç renk üretir.
      return { ok: seen.size > 3, colors: seen.size };
    });
    expect(painted.ok).toBe(true);
  });

  test('içe aktarılan sinyaller Veri Gezgini ağacında görünür', async ({ page }) => {
    await openViewer(page);
    await importFixture(page, canoeXlsx());
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veImpDatasets.length > 0, null, { timeout: 15000 });

    const tree = page.locator('#ve-results-tree');
    await expect(tree).toContainText('İçe Aktarılan Ölçümler');
    await expect(tree).toContainText('EngSpeed');
    await expect(tree).toContainText('Motor Sıcaklığı');
  });

  test('ağaçtaki onay kutusu şeridi düşürür ve geri getirir', async ({ page }) => {
    await openViewer(page);
    await importFixture(page, canoeXlsx());
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length === 5,
      null, { timeout: 15000 });

    const box = page.locator('.vsig-row[data-sid="c1"] .vsig-ck').first();
    await box.click();
    await page.waitForFunction(() => veResultSlots[0].sensors.length === 4,
      null, { timeout: 5000 });
    await page.locator('.vsig-row[data-sid="c1"] .vsig-ck').first().click();
    await page.waitForFunction(() => veResultSlots[0].sensors.length === 5,
      null, { timeout: 5000 });
  });

  test('X ekseni seçici yalnızca AYNI dosyanın sütunlarını sunar', async ({ page }) => {
    // İki ölçümün sütunlarını karıştırmak, farklı uzunlukta iki diziyi indeks
    // hizasıyla eşleştirirdi: grafik makul görünür, veri yanlış olurdu.
    await openViewer(page);
    await importFixture(page, canoeXlsx(300), 'A.xlsx');
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length > 0, null, { timeout: 15000 });

    // İkinci dosya (farklı satır sayısı) — pano ilkine bağlı kalır.
    await importFixture(page, canoeXlsx(120), 'B.xlsx');
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veImpDatasets.length === 2, null, { timeout: 15000 });

    const st = await page.evaluate(() => {
      const slot = veResultSlots[0];
      const opts = veGetAvailableXAxisOptions(0);
      const boardDs = slot._dataSource;
      return {
        boardDs: boardDs,
        // Seçenekte başka bir veri kümesine ait olan var mı?
        foreign: opts.filter((o) => o._dataSource !== boardDs).length,
        count: opts.length,
        xLen: (veTrResolveX(slot) || []).length,
      };
    });
    expect(st.foreign).toBe(0);
    expect(st.count).toBeGreaterThan(1);
    // Pano ikinci (120 satırlık) dosyaya geçtiyse X'i de onun ekseni olmalı;
    // her hâlükârda eksen ile şeritler AYNI kümeden gelmeli.
    expect([300, 120]).toContain(st.xLen);
  });

  test('X eksenini başka bir sütuna çevirmek ekseni ölçüme bağlı tutar', async ({ page }) => {
    // _dataSource eksen tanımından düşerse X dizisi hiçbir şeye bağlanmaz ve
    // pencere sessizce boşalır.
    await openViewer(page);
    await importFixture(page, canoeXlsx());
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length > 0, null, { timeout: 15000 });

    const st = await page.evaluate(() => {
      const opts = veGetAvailableXAxisOptions(0);
      const i = opts.findIndex((o) => o.name === 'VehSpeed');
      // Seçiciyi açmadan doğrudan uygulamak için dropdown'ı elle kur
      veShowXAxisPicker(0, null);
      veSetSlotXAxis(0, i);
      const s = veResultSlots[0];
      return {
        name: s.xAxis.name,
        ds: s.xAxis._dataSource,
        xLen: (veTrResolveX(s) || []).length,
      };
    });
    expect(st.name).toBe('VehSpeed [km/h]');
    expect(st.ds).toMatch(/^import:/);
    expect(st.xLen).toBe(300);
  });

  test('Tablo kipi değerleri ve MİN/ORT/MAKS satırlarını gösterir', async ({ page }) => {
    await openViewer(page);
    await importFixture(page, canoeXlsx());
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length > 0, null, { timeout: 15000 });

    await page.click('#ve-trace-toolbar [data-act="mode"][data-mode="table"]');
    const table = page.locator('#ve-table-0');
    await expect(table).toBeVisible();
    await expect(table).toContainText('EngSpeed');
    await expect(table).toContainText('MİN');
    await expect(table).toContainText('MAKS');
    // Metin kanalı ('1C'/'2L') sayısal biçimlendirmeye girip tabloyu
    // patlatmamalı — MİN/MAKS orada '—' olur, tablo yine dolu kalır.
    await expect(table.locator('tbody tr')).not.toHaveCount(0);
  });

  test('3B kipi görüntüleyicide yok (Three.js gerektiriyordu)', async ({ page }) => {
    await openViewer(page);
    await expect(page.locator('#ve-trace-toolbar [data-mode="scatter3d"]')).toHaveCount(0);
    await expect(page.locator('#ve-trace-toolbar [data-mode="table"]')).toHaveCount(1);
  });

  test('ölçüm oturumdan kaldırılabilir', async ({ page }) => {
    await openViewer(page);
    await importFixture(page, canoeXlsx());
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veImpDatasets.length === 1, null, { timeout: 15000 });

    await page.click('#ve-results-tree .vsig-orphan');
    await page.waitForFunction(() => veImpDatasets.length === 0, null, { timeout: 5000 });
    // Şeritler de düşmeli: veri gitmişken eğri kalırsa pencere yalan söyler.
    const left = await page.evaluate(() => veResultSlots[0].sensors.length);
    expect(left).toBe(0);
    await expect(page.locator('#ve-results-tree')).toContainText('Henüz ölçüm yok');
  });

  test('CSV ve ondalık virgül de okunur', async ({ page }) => {
    await openViewer(page);
    const csv = 'Time;EngSpeed;VehSpeed\n0,00;800,5;0,0\n0,01;812,25;0,4\n0,02;825,0;0,9\n';
    await importFixture(page, Buffer.from(csv, 'utf8'), 'olcum.csv');
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length > 0, null, { timeout: 15000 });

    const vals = await page.evaluate(() => {
      const e = veResultSlots[0].sensors[0];
      return veGetSensorData(e.id, e.signal);
    });
    expect(vals).toEqual([800.5, 812.25, 825]);
  });

  test('bozuk dosya anlaşılır hata verir, program ayakta kalır', async ({ page }) => {
    await openViewer(page);
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#ve-import-btn'),
    ]);
    await chooser.setFiles({
      name: 'bozuk.xlsx', mimeType: 'application/vnd.ms-excel',
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0]),
    });
    await expect(page.locator('#ve-import-content')).toContainText('Dosya açılamadı', { timeout: 20000 });
    await expect(page.locator('#ve-import-apply')).toBeDisabled();
    // Kapatıp yeniden denemek mümkün olmalı
    await page.click('.ve-settings-close');
    await expect(page.locator('#ve-import-btn')).toBeVisible();
  });

  test('hiçbir ağ isteği yapmaz — veri bilgisayardan çıkmaz', async ({ page }) => {
    // Başlık çubuğundaki "veri bilgisayarınızdan çıkmaz" bir iddia; ölçülmezse
    // yarın eklenen bir font/CDN/telemetri satırıyla sessizce yalan olur.
    // Ölçüm dosyaları müşteri verisi taşıyabiliyor — bu testin bedeli düşük,
    // karşılığı yüksek.
    const external = [];
    page.on('request', (r) => {
      if (/^https?:/.test(r.url())) external.push(r.url());
    });

    await openViewer(page);
    await importFixture(page, canoeXlsx(150));
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length > 0, null, { timeout: 15000 });

    const n = await page.evaluate(() => (veTrResolveX(veResultSlots[0]) || []).length);
    expect(n).toBe(150);
    expect(external).toEqual([]);
  });
});

// ── Sürükle-bırak ────────────────────────────────────────────────────────
//
// Sentetik DragEvent kullanılıyor: Playwright işletim sisteminden tarayıcıya
// gerçek bir dosya sürüklemesi üretemiyor. Sayfada bir DataTransfer kurup
// olayları elle atmak, tarayıcının kendi olay yolunu aynen çalıştırıyor —
// dinleyiciler, preventDefault ve dropEffect dahil.

function dropInPage(arg) {
  const dt = new DataTransfer();
  arg.files.forEach((f) => dt.items.add(new File([new Uint8Array(f.bytes)], f.name)));
  const mk = (t) => new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true });
  const el = document.getElementById('ve-imp-drop');

  document.dispatchEvent(mk('dragenter'));
  const overPrevented = !document.dispatchEvent(mk('dragover'));
  const shownWhileDragging = el.classList.contains('on');
  const dropPrevented = arg.enterOnly ? null : !document.dispatchEvent(mk('drop'));

  return {
    shownWhileDragging,
    overPrevented,
    dropPrevented,
    shownAfter: el.classList.contains('on'),
  };
}

async function dropFiles(page, files, opts) {
  return page.evaluate(dropInPage, Object.assign({ files: files }, opts || {}));
}

const asBytes = (buf) => Array.from(buf);

test.describe('Sürükle-bırak', () => {

  test('bırakılan .xlsx sihirbazı açar ve şeritlere döner', async ({ page }) => {
    await openViewer(page);
    await dropFiles(page, [{ bytes: asBytes(canoeXlsx(300)), name: 'Testfahrt_2026.xlsx' }]);

    await page.waitForFunction(() => veImpUI && veImpUI.rows && !veImpUI.busy,
      null, { timeout: 30000 });
    await expect(page.locator('#ve-import-overlay')).toBeVisible();

    // "Gözat" ile AYNI kapıdan geçtiğinin kanıtı: sütun taraması, birim satırı
    // ve X ekseni önerisi birebir aynı sonucu vermeli.
    const st = await page.evaluate(() => ({
      xName: veImpUI.columns[veImpUI.xIndex].name,
      names: veImpUI.columns.map((c) => c.name),
    }));
    expect(st.xName).toBe('Time');
    expect(st.names).toEqual(['Time', 'EngSpeed', 'VehSpeed', 'Motor Sıcaklığı', 'Gear', 'Mode']);

    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length > 0, null, { timeout: 15000 });
    expect(await page.evaluate(() => veResultSlots[0].sensors.length)).toBe(5);
  });

  test('TARAYICI VARSAYILANI ENGELLENİR — sekme dosyaya gitmez', async ({ page }) => {
    // Bu testin koruduğu şey en pahalı hata: dragover/drop üzerinde
    // preventDefault çağrılmazsa tarayıcı bırakılan .xlsx'e gider, program
    // kapanır ve açık olan ölçüm kaybolur.
    await openViewer(page);
    const r = await dropFiles(page, [{ bytes: asBytes(canoeXlsx(50)), name: 'x.xlsx' }]);
    expect(r.overPrevented).toBe(true);
    expect(r.dropPrevented).toBe(true);
  });

  test('varsayılan REDDEDİLEN dosyada da engellenir', async ({ page }) => {
    // Program yanlış dosyada da AYAKTA kalmalı. Yalnızca kabul edilen
    // dosyalarda preventDefault çağıran bir kod, .png bırakan kullanıcıyı
    // resmin açıldığı boş bir sekmeye götürürdü.
    await openViewer(page);
    const r = await dropFiles(page, [{ bytes: [137, 80, 78, 71], name: 'resim.png' }]);
    expect(r.overPrevented).toBe(true);
    expect(r.dropPrevented).toBe(true);
    await expect(page.locator('#ve-import-overlay')).toBeHidden();
    await expect(page.locator('.ve-toast', { hasText: 'resim.png' })).toBeVisible();
  });

  test('sürüklerken kaplama görünür, bırakınca kaybolur', async ({ page }) => {
    await openViewer(page);
    const r = await dropFiles(page, [{ bytes: asBytes(canoeXlsx(50)), name: 'x.xlsx' }]);
    expect(r.shownWhileDragging).toBe(true);
    expect(r.shownAfter).toBe(false);
  });

  test('sürükleme pencere dışında biterse kaplama asılı kalmaz', async ({ page }) => {
    // Kullanıcı vazgeçip masaüstüne bırakırsa dragleave gelmeyebiliyor.
    // Kaplama ekranda kalırsa program kilitlenmiş gibi görünür.
    await openViewer(page);
    await dropFiles(page, [{ bytes: [1, 2, 3], name: 'x.xlsx' }], { enterOnly: true });
    await expect(page.locator('#ve-imp-drop.on')).toBeVisible();

    await page.evaluate(() => window.dispatchEvent(new Event('dragend')));
    await expect(page.locator('#ve-imp-drop.on')).toHaveCount(0);
  });

  test('dosya OLMAYAN sürükleme kaplamayı açmaz', async ({ page }) => {
    // Başka bir sayfadan metin sürükleyen kullanıcıya "ölçüm dosyasını
    // bırakın" demek yanıltıcı olurdu.
    await openViewer(page);
    const shown = await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'merhaba');
      document.dispatchEvent(new DragEvent('dragenter',
        { dataTransfer: dt, bubbles: true, cancelable: true }));
      return document.getElementById('ve-imp-drop').classList.contains('on');
    });
    expect(shown).toBe(false);
  });

  test('birden çok dosyada ilki açılır ve bu SÖYLENİR', async ({ page }) => {
    await openViewer(page);
    const x = asBytes(canoeXlsx(120));
    await dropFiles(page, [{ bytes: x, name: 'A.xlsx' }, { bytes: x, name: 'B.xlsx' }]);

    // Sessizce tek dosya açmak "ikisi de yüklendi" sanısına yol açardı.
    await expect(page.locator('.ve-toast', { hasText: 'A.xlsx' })).toBeVisible();
    await page.waitForFunction(() => veImpUI && veImpUI.rows && !veImpUI.busy,
      null, { timeout: 30000 });
    expect(await page.evaluate(() => veImpUI.fileName)).toBe('A.xlsx');
  });

  test('bırakma CSV yolunu da açar', async ({ page }) => {
    await openViewer(page);
    const csv = 'Time;EngSpeed\n0,00;800,5\n0,01;812,25\n';
    await dropFiles(page, [{ bytes: Array.from(Buffer.from(csv, 'utf8')), name: 'olcum.csv' }]);
    await page.waitForFunction(() => veImpUI && veImpUI.rows && !veImpUI.busy,
      null, { timeout: 30000 });
    expect(await page.evaluate(() => veImpUI.commaDecimal)).toBe(true);
  });
});

// ── Birleştirme ──────────────────────────────────────────────────────────
//
// "Birleştir" artık kullanıcının SEÇTİĞİ şeritleri tek diyagramda topluyor ve
// birleşen her sinyal kendi Y ölçeğini koruyor. Buradaki testler seçim
// akışını ve sonucun gerçekten çok eksenli çıktığını koruyor; ölçek
// matematiği birim testlerde (tests/unit/trace-view.test.js).

async function boardWithFive(page) {
  await openViewer(page);
  await importFixture(page, canoeXlsx(300));
  await page.click('#ve-import-apply');
  await page.waitForFunction(() => veResultSlots[0].sensors.length === 5,
    null, { timeout: 15000 });
}

const laneCount = (page) => page.evaluate(() => veTrBoard().lanes.length);

test.describe('Birleştir — seçerek, çok eksenli', () => {

  test('düğme seçim listesini açar', async ({ page }) => {
    await boardWithFive(page);
    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    const pop = page.locator('#ve-trace-merge-pop');
    await expect(pop).toBeVisible();
    // Her şerit listede, kendi birimiyle
    await expect(pop.locator('.ve-trace-pop-item')).toHaveCount(5);
    await expect(pop).toContainText('EngSpeed');
    await expect(pop).toContainText('1/min');
  });

  test('seçilenler tek şeritte toplanır, ötekiler YERİNDE kalır', async ({ page }) => {
    await boardWithFive(page);
    expect(await laneCount(page)).toBe(5);

    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await page.check('#ve-trace-merge-pop input[data-lane="0"]');
    await page.check('#ve-trace-merge-pop input[data-lane="1"]');
    await page.click('#ve-trace-merge-pop [data-act="merge-ok"]');

    // 5 şerit → 4 (ikisi birleşti). Seçilmeyen üçü dokunulmadan kaldı:
    // "birleştir" tüm panoyu yeniden düzenlememeli.
    await expect.poll(() => laneCount(page)).toBe(4);
    const st = await page.evaluate(() => ({
      first: veTrBoard().lanes[0].ids.length,
      rest: veTrBoard().lanes.slice(1).map((L) => L.ids.length),
    }));
    expect(st.first).toBe(2);
    expect(st.rest).toEqual([1, 1, 1]);
  });

  test('birleşen her sinyal KENDİ Y ekseninde — hiçbiri ezilmez', async ({ page }) => {
    await boardWithFive(page);
    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    for (const i of [0, 1, 2]) {
      await page.check(`#ve-trace-merge-pop input[data-lane="${i}"]`);
    }
    await page.click('#ve-trace-merge-pop [data-act="merge-ok"]');
    await expect.poll(() => laneCount(page)).toBe(3);

    const axes = await page.evaluate(() =>
      veTrState.geo.lanes[0].axes.map((a) => ({ unit: a.unit, min: a.yMin, max: a.yMax })));

    expect(axes).toHaveLength(3);
    expect(axes.map((a) => a.unit)).toEqual(['1/min', 'km/h', '°C']);
    // Asıl güvence: hız ekseni devrin tepesine kadar uzanmıyor. Uzansaydı
    // 0…40 km/h eğrisi tabanda düz bir çizgiye dönerdi ve grafik "hız hiç
    // değişmemiş" derdi.
    expect(axes[1].max).toBeLessThan(100);
    expect(axes[2].max).toBeLessThan(100);
    expect(axes[0].max).toBeGreaterThan(2000);
  });

  // İmleç okuması: birleşik şeritte sinyal başına bir değer rozeti çiziliyor.
  // İki eğri o anda birbirine yakınsa rozetler üst üste biniyor ve İKİSİ DE
  // okunamıyordu — beş sinyal birleşikken ekranda "1C )3 °C" görünüyordu,
  // gerçek değer 36.03 °C idi. Yanlış sayı okunabilecek sessiz bir kusurdu.
  test('imleç rozetleri üst üste BİNMEZ — yakın iki eğride de okunur', async ({ page }) => {
    await boardWithFive(page);
    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    for (const i of [0, 1, 2, 3, 4]) {
      await page.check(`#ve-trace-merge-pop input[data-lane="${i}"]`);
    }
    await page.click('#ve-trace-merge-pop [data-act="merge-ok"]');
    await expect.poll(() => laneCount(page)).toBe(1);

    // İmleci çizim alanının ortasına götür (gerçek fare hareketi).
    const geo = await page.evaluate(() => ({
      gutter: veTrState.geo.gutter, plotW: veTrState.geo.plotW,
      y: veTrState.geo.rects[0].y, h: veTrState.geo.rects[0].h,
    }));
    const box = await page.locator('#ve-trace-overlay').boundingBox();
    await page.mouse.move(box.x + geo.gutter + geo.plotW * 0.4, box.y + geo.y + geo.h / 2);
    await expect.poll(() => page.evaluate(() => veTrState.cursorX)).not.toBeNull();

    // Çizim katmanının kullandığı yerleşimin ta kendisi.
    const yer = await page.evaluate(() => {
      const g = veTrState.geo, lane = g.lanes[0], rect = g.rects[0];
      const i = veTrSnapIndex(g.timeArr, veTrState.cursorX);
      const items = lane.sigs.map((sg, gi) => ({
        ad: sg.sensor.name,
        y: veTrYPos(veTrAxisOfSig(lane, gi), rect, sg.series[i]),
      }));
      const fit = veTrStackBadges(items, rect);
      return { fit, items: items.map((b) => ({ ad: b.ad, by: b.by, hidden: !!b.hidden })) };
    });

    const gorunen = yer.items.filter((b) => !b.hidden).map((b) => b.by).sort((a, b) => a - b);
    expect(gorunen.length).toBe(5);          // 764 px'lik şeritte hepsi sığar
    expect(yer.fit.hidden).toBe(0);
    for (let i = 1; i < gorunen.length; i++) {
      // 14 px rozet yüksekliği: aradaki mesafe bundan küçükse metinler girişir.
      expect(gorunen[i] - gorunen[i - 1]).toBeGreaterThanOrEqual(14);
    }
  });

  test('BİRDEN ÇOK birleşik diyagram kurulabilir', async ({ page }) => {
    await boardWithFive(page);

    // 1. birleşim: ilk iki şerit
    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await page.check('#ve-trace-merge-pop input[data-lane="0"]');
    await page.check('#ve-trace-merge-pop input[data-lane="1"]');
    await page.click('#ve-trace-merge-pop [data-act="merge-ok"]');
    await expect.poll(() => laneCount(page)).toBe(4);

    // 2. birleşim: kalanlardan ikisi. Liste yeniden açıldığında GÜNCEL
    // şeritleri göstermeli, yoksa ikinci birleşim yanlış şeritleri toplardı.
    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await expect(page.locator('#ve-trace-merge-pop .ve-trace-pop-item')).toHaveCount(4);
    await page.check('#ve-trace-merge-pop input[data-lane="2"]');
    await page.check('#ve-trace-merge-pop input[data-lane="3"]');
    await page.click('#ve-trace-merge-pop [data-act="merge-ok"]');
    await expect.poll(() => laneCount(page)).toBe(3);

    const sizes = await page.evaluate(() => veTrBoard().lanes.map((L) => L.ids.length));
    expect(sizes).toEqual([2, 1, 2]);
  });

  test('birleşik şerit tekrar dağıtılabilir', async ({ page }) => {
    await boardWithFive(page);
    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await page.check('#ve-trace-merge-pop input[data-lane="0"]');
    await page.check('#ve-trace-merge-pop input[data-lane="1"]');
    await page.click('#ve-trace-merge-pop [data-act="merge-ok"]');
    await expect.poll(() => laneCount(page)).toBe(4);

    // "Dağıt" yalnızca birleşik şeritte çıkar ve yalnız ONU dağıtır —
    // her şeyi dağıtan "Ayır"a gitmek zorunda kalınmamalı.
    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await expect(page.locator('#ve-trace-merge-pop [data-act="split"]')).toHaveCount(1);
    await page.click('#ve-trace-merge-pop [data-act="split"]');
    await expect.poll(() => laneCount(page)).toBe(5);
  });

  test('tek seçimle birleştirme reddedilir ve sebebi söylenir', async ({ page }) => {
    await boardWithFive(page);
    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await page.check('#ve-trace-merge-pop input[data-lane="0"]');
    await page.click('#ve-trace-merge-pop [data-act="merge-ok"]');
    // Pencere KAPANMAMALI: kullanıcı ikinciyi işaretleyip devam edebilmeli.
    await expect(page.locator('#ve-trace-merge-pop')).toBeVisible();
    await expect(page.locator('.ve-toast', { hasText: 'en az iki' })).toBeVisible();
    expect(await laneCount(page)).toBe(5);
  });

  // AYNI BİRİM → ORTAK ÖLÇEK.
  //
  // ÖLÇÜLEN KUSUR: 0…500 Nm motor torku ile 0…50 Nm fren torku birleştirilince
  // ayrı eksen alıyordu; İKİSİ DE şeridin %86'sını dolduruyor, eğriler
  // çakışıyor ve grafik "iki tork eşit" diyordu. On kat farklılar.
  test('aynı birimli iki sinyal ORTAK ölçekte — büyüklük farkı görünür', async ({ page }) => {
    // İki Nm sinyali (biri on kat büyük) + bir km/h.
    const satir = ['Time;Motor Torku;Fren Torku;Hiz', 's;Nm;Nm;km/h'];
    for (let k = 0; k < 300; k++) {
      const t = k * 0.02;
      satir.push([t.toFixed(3), (500 * Math.abs(Math.sin(t / 2))).toFixed(2),
        (50 * Math.abs(Math.sin(t / 2))).toFixed(2),
        (60 * Math.abs(Math.sin(t / 3))).toFixed(2)].join(';'));
    }
    await openViewer(page);
    const [ch] = await Promise.all([
      page.waitForEvent('filechooser'), page.click('#ve-import-btn')]);
    await ch.setFiles({ name: 'tork.csv', mimeType: 'text/csv',
      buffer: Buffer.from(satir.join('\n'), 'utf8') });
    await page.waitForFunction(() => veImpUI && veImpUI.rows && !veImpUI.busy);
    await page.click('#ve-import-apply');
    await expect.poll(() => page.evaluate(() => veResultSlots[0].sensors.length)).toBe(3);

    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await page.click('#ve-trace-merge-pop [data-act="by-unit"]');
    await expect.poll(() => laneCount(page)).toBe(2);   // Nm şeridi + km/h şeridi

    const m = await page.evaluate(() => {
      const g = veTrState.geo, L = g.lanes[0], r = g.rects[0];
      const yayilim = (i) => {
        const a = veTrAxisOfSig(L, i), s = L.sigs[i].series;
        let mn = Infinity, mx = -Infinity;
        for (const v of s) if (isFinite(v)) { if (v < mn) mn = v; if (v > mx) mx = v; }
        return veTrYPos(a, r, mn) - veTrYPos(a, r, mx);
      };
      return { eksen: L.axes.length, birim: L.axes.map((a) => a.unit),
        sinyal: L.sigs.length, oran: yayilim(0) / yayilim(1),
        adSatiri: veTrNameRows(L).length };
    });

    expect(m.sinyal).toBe(2);
    expect(m.eksen).toBe(1);              // TEK Nm ekseni
    expect(m.birim).toEqual(['Nm']);
    // Gerçek oran 10 kat; grafikteki dikey yayılım da onu göstermeli.
    expect(m.oran).toBeGreaterThan(8);
    expect(m.oran).toBeLessThan(12);
    // Ortak eksene rağmen iki sinyalin de adı listeleniyor.
    expect(m.adSatiri).toBe(2);
  });

  test('"Birime göre" kısayolu korundu', async ({ page }) => {
    // Eski davranış kaybolmadı, listenin içine taşındı.
    //
    // Fixture'ın beş sinyalinde TEKRAR EDEN birim yok (1/min, km/h, °C ve iki
    // BİRİMSİZ). Birimsiz olmak ortak bir birim değildir — "Gear" ile "Mode"
    // aynı ölçeğe konamaz. Bu yüzden ortada birleştirilecek bir şey yok:
    // beş şerit yerinde kalır ve sebep söylenir.
    await boardWithFive(page);
    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await page.click('#ve-trace-merge-pop [data-act="by-unit"]');
    await expect(page.locator('.ve-toast', { hasText: 'Aynı birimi paylaşan şerit yok' }))
      .toBeVisible();
    expect(await laneCount(page)).toBe(5);
  });

  test('"Birime göre" TEKRAR EDEN birimi toplar, birimsizlere dokunmaz', async ({ page }) => {
    // İki Nm + bir km/h + bir birimsiz. Beklenen: Nm'ler tek şeritte, ötekiler
    // kendi şeritlerinde → 3 şerit.
    const satir = ['Time;Motor Torku;Fren Torku;Hiz;Mod', 's;Nm;Nm;km/h;'];
    for (let k = 0; k < 200; k++) {
      const t = k * 0.02;
      satir.push([t.toFixed(3), (500 * Math.abs(Math.sin(t / 2))).toFixed(2),
        (50 * Math.abs(Math.sin(t / 2))).toFixed(2),
        (60 * Math.abs(Math.sin(t / 3))).toFixed(2), (k % 3)].join(';'));
    }
    await openViewer(page);
    const [ch] = await Promise.all([
      page.waitForEvent('filechooser'), page.click('#ve-import-btn')]);
    await ch.setFiles({ name: 'karisik.csv', mimeType: 'text/csv',
      buffer: Buffer.from(satir.join('\n'), 'utf8') });
    await page.waitForFunction(() => veImpUI && veImpUI.rows && !veImpUI.busy);
    await page.click('#ve-import-apply');
    await expect.poll(() => page.evaluate(() => veResultSlots[0].sensors.length)).toBe(4);

    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await page.click('#ve-trace-merge-pop [data-act="by-unit"]');
    await expect.poll(() => laneCount(page)).toBe(3);

    const st = await page.evaluate(() => veTrState.geo.lanes.map((L) => ({
      sinyal: L.sigs.length, eksen: L.axes.length,
    })));
    expect(st[0]).toEqual({ sinyal: 2, eksen: 1 });   // iki Nm, ORTAK ölçek
    expect(st[1]).toEqual({ sinyal: 1, eksen: 1 });   // km/h
    expect(st[2]).toEqual({ sinyal: 1, eksen: 1 });   // birimsiz — kendi şeridi
  });
});

// ── Tema ─────────────────────────────────────────────────────────────────
//
// Program tek başına, günün her saatinde açık duruyor; tema bir tercih değil
// ortama uyum meselesi. Varsayılan işletim sisteminin kendisi, kullanıcı
// geçersiz kılabiliyor.

async function themeState(page) {
  return page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    label: document.getElementById('mfv-theme-label').textContent.trim(),
    stored: localStorage.getItem('mfv-theme'),
  }));
}

test.describe('Tema — işletim sistemini izler', () => {

  test.describe('işletim sistemi AÇIK iken', () => {
    test.use({ colorScheme: 'light' });
    test('açık temayla açılır', async ({ page }) => {
      await openViewer(page);
      const st = await themeState(page);
      expect(st.theme).toBe('pearl');
      expect(st.label).toBe('Sistem');
      // Hiçbir şey seçilmeden localStorage'a yazılmamalı: yazılırsa kullanıcı
      // sisteme bir daha hiç dönemez, "sistem gibi davran" tek seferlik olurdu.
      expect(st.stored).toBeNull();
    });
  });

  test.describe('işletim sistemi KOYU iken', () => {
    test.use({ colorScheme: 'dark' });
    test('koyu temayla açılır', async ({ page }) => {
      await openViewer(page);
      const st = await themeState(page);
      expect(st.theme).toBe('slate');
      expect(st.label).toBe('Sistem');
    });

    test('düğme Sistem → Açık → Koyu → Sistem döngüsünü yürütür', async ({ page }) => {
      await openViewer(page);

      await page.click('#mfv-theme-btn');
      expect(await themeState(page)).toMatchObject({ theme: 'pearl', label: 'Açık' });

      await page.click('#mfv-theme-btn');
      expect(await themeState(page)).toMatchObject({ theme: 'slate', label: 'Koyu' });

      // Üçüncü tık sisteme DÖNER. İki durumlu bir anahtarda bu dönüş
      // mümkün olmazdı — istenen davranışın çekirdeği burası.
      await page.click('#mfv-theme-btn');
      expect(await themeState(page)).toMatchObject({ theme: 'slate', label: 'Sistem' });
    });

    test('elle yapılan seçim yeniden açılışta hatırlanır', async ({ page }) => {
      await openViewer(page);
      await page.click('#mfv-theme-btn');            // Açık
      await page.reload();
      await page.waitForSelector('#ve-trace');
      const st = await themeState(page);
      expect(st.theme).toBe('pearl');
      expect(st.label).toBe('Açık');
    });

    test('ilk boyamada doğru tema — koyu/açık parlaması yok', async ({ page }) => {
      // index.html'deki <head> betiği ile js/theme.js'in mantığı ayrı yerlerde
      // duruyor; ayrışırsa açık temadaki kullanıcı her açılışta bir kare koyu
      // ekran görür. Betiği DOM hazır olmadan, ilk fırsatta yokluyoruz.
      await page.goto(FILE_URL);
      const early = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(early).toBe('slate');
      await page.waitForSelector('#ve-trace');
      expect((await themeState(page)).theme).toBe('slate');
    });

    test('diyagram çiziliyken tema değişimi ekranı gerçekten açar', async ({ page }) => {
      // Şeritler doluyken geçiş yapılıyor: ölçüm penceresi kurulduktan sonra
      // tema değişimi en riskli anda sınanmış olur.
      //
      // TUVAL DEĞİL, ZEMİN ÖLÇÜLÜYOR — ve bu bilerek. Ölçüldü: js/trace-view.js
      // temel şerit çizimini tema-NÖTR gri ile yapıyor, eğri renkleri sabit
      // paletten geliyor; tuval iki temada bayt bayt aynı. Açık/koyu görünümü
      // CSS'ten geliyor. Tuvale bakan bir doğrulama, doğru davranışta bile
      // kırmızı yanardı.
      await openViewer(page);
      await importFixture(page, canoeXlsx(200));
      await page.click('#ve-import-apply');
      await page.waitForFunction(() => veResultSlots[0].sensors.length > 0, null, { timeout: 15000 });

      const bg = () => page.evaluate(() =>
        getComputedStyle(document.getElementById('ve-trace')).backgroundColor);

      const dark = await bg();
      await page.click('#mfv-theme-btn');            // → Açık
      await page.waitForTimeout(200);
      const light = await bg();
      expect(light).not.toBe(dark);

      // "Açık" gerçekten açık olmalı: yalnızca "değişti" demek, iki koyu tema
      // arasında gidip gelen bir hatayı yakalamazdı.
      const lum = (c) => c.match(/\d+/g).slice(0, 3).reduce((a, v) => a + +v, 0) / 3;
      expect(lum(light)).toBeGreaterThan(200);
      expect(lum(dark)).toBeLessThan(60);

      // Şeritler geçişte kaybolmamalı
      await expect(page.locator('#ve-trace-empty')).toBeHidden();
      expect(await page.evaluate(() => veResultSlots[0].sensors.length)).toBe(5);
    });
  });
});

// ── Açılır pencerelerden çıkış ───────────────────────────────────────────
//
// Şerit ölçeği ve birleştirme seçicisi ESC ile kapanmıyordu: açılan kutudan
// çıkmanın tek yolu boşluğa tıklamaktı. Klavyeyle çalışan kullanıcı için
// çıkışsız bir kutu demek bu.
test.describe('Açılır pencereler ESC ile kapanır', () => {
  // Dinleyici bağlanmadan ÖNCE basılan ESC de sayılmalı. Eskiden keydown
  // dinleyicisi de setTimeout(...,0) içinde bağlanıyordu: pencere DOM'a girer
  // girmez görünür oluyor ama dinleyici bir sonraki göreve kalıyordu; o
  // aralıkta basılan ESC kayboluyor ve pencere AÇIK kalıyordu. Yüklü makinede
  // (CI) yukarıdaki testler bu yüzden dönüşümlü kırmızıya dönüyordu. Burada
  // aralığa BİLEREK basılıyor — yarış makine hızına bırakılmıyor.
  test('pencere açılır açılmaz basılan ESC kaçmıyor', async ({ page }) => {
    await openViewer(page);
    const acikKaldi = await page.evaluate(() => {
      const pop = document.createElement('div');
      pop.id = 've-esc-yaris-testi';
      document.body.appendChild(pop);
      veTrBindPopupDismiss(pop);
      // Aynı görev içinde, setTimeout sıraya girmişken:
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return new Promise(res => setTimeout(
        () => res(!!document.getElementById('ve-esc-yaris-testi')), 20));
    });
    expect(acikKaldi).toBe(false);
  });

  // ESC'in mousedown İKİZİ. Aynı kusur dış tıklama yolunda DURUYORDU: mousedown
  // dinleyicisi setTimeout(...,0) içinde bağlanıyordu ve gerekçesi "pencereyi
  // açan tıklama kapatıcıya düşmesin"di — oysa pencereyi kuran şey bir click
  // işleyicisi, o etkileşimin mousedown'ı çoktan geçmiş. Karşılığında gerçek
  // bir kaçak vardı: aralıkta gelen tıklama hiçbir dinleyiciye düşmüyor,
  // ardından dinleyici bağlanıyor ve bir daha tıklama gelmediği için pencere
  // KALICI açık kalıyordu. Blink'te girdi olayları zamanlayıcıdan öncelikli;
  // CI'da aşağıdaki "dışarı tıklama" testi tam olarak bu yüzden kırmızıya
  // döndü (koşu 32021715468: tıklama pencerenin 420 px altına düştü, pencere
  // yine de kapanmadı).
  test('pencere açılır açılmaz yapılan dış tıklama kaçmıyor', async ({ page }) => {
    await openViewer(page);
    const acikKaldi = await page.evaluate(() => {
      const pop = document.createElement('div');
      pop.id = 've-tik-yaris-testi';
      document.body.appendChild(pop);
      veTrBindPopupDismiss(pop);
      // Aynı görev içinde, zamanlayıcıya hiç sıra gelmemişken:
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      return new Promise(res => setTimeout(
        () => res(!!document.getElementById('ve-tik-yaris-testi')), 20));
    });
    expect(acikKaldi).toBe(false);
  });

  test('birleştirme seçicisi', async ({ page }) => {
    await openViewer(page);
    await importFixture(page, canoeXlsx(120));
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length === 5,
      null, { timeout: 15000 });

    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await expect(page.locator('#ve-trace-merge-pop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#ve-trace-merge-pop')).toHaveCount(0);

    // Kapanan pencere dinleyicisini de SÖKMELİ: bırakırsa her açılışta bir
    // tane daha birikir. Tekrar açılıp kapanabiliyor olması bunun kanıtı.
    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await expect(page.locator('#ve-trace-merge-pop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#ve-trace-merge-pop')).toHaveCount(0);
  });

  test('dışarı tıklama hâlâ kapatıyor', async ({ page }) => {
    await openViewer(page);
    await importFixture(page, canoeXlsx(120));
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length === 5,
      null, { timeout: 15000 });

    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await expect(page.locator('#ve-trace-merge-pop')).toBeVisible();
    await page.mouse.click(600, 700);
    await expect(page.locator('#ve-trace-merge-pop')).toHaveCount(0);
  });
});
