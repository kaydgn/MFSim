/**
 * MFSim: ölçüm sürükle-bırak + çok eksenli birleştirme — uçtan uca
 *
 * Bu iki özellik önce Ölçüm Görüntüleyici'de (CACIK) yazıldı; burada test
 * edilen şey MFSim'in KENDİSİNDE de çalıştıkları. Kod ortak (js/trace-view.js,
 * js/measure-dropzone.js) ama kabuk değil: MFSim'de giriş kapısı, ertelenmiş
 * modül yükleme, sayfa rayı ve iki ayrı çözücü sekmesi var.
 *
 * Çalıştırmak için: npm run test:e2e
 */

const { test, expect } = require('@playwright/test');
const { canoeXlsx } = require('./helpers/canoe-xlsx');

// Giriş + modül yüklemesi. Takoz akışı buradan sonra KENDİ modülünü kuruyor,
// o yüzden karşılama ekranından çıkış ile Sonuçlar'a geçiş ayrıldı.
async function openApp(page) {
  await page.goto('/index.html');
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForFunction(
    () => typeof veImpOpenPicker === 'function' && typeof veTrBoard === 'function',
    null, { timeout: 60000 });
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 60000 });
}

async function openResults(page) {
  await openApp(page);
  await page.click('.ve-module-card');
  await page.click('.ve-nav-item[data-subtab="sonuclar"]');
}

// Sentetik DragEvent: Playwright işletim sisteminden gerçek dosya sürükleyemez.
function dropInPage(arg) {
  const dt = new DataTransfer();
  arg.files.forEach((f) => dt.items.add(new File([new Uint8Array(f.bytes)], f.name)));
  const mk = (t) => new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true });
  document.dispatchEvent(mk('dragenter'));
  const overPrevented = !document.dispatchEvent(mk('dragover'));
  const shown = document.getElementById('ve-imp-drop').classList.contains('on');
  const dropPrevented = !document.dispatchEvent(mk('drop'));
  return { shown, overPrevented, dropPrevented };
}

async function importByDrop(page, buffer, name) {
  const r = await page.evaluate(dropInPage,
    { files: [{ bytes: Array.from(buffer), name: name }] });
  await page.waitForFunction(() => veImpUI && veImpUI.rows && !veImpUI.busy,
    null, { timeout: 30000 });
  return r;
}

test.describe('MFSim — ölçüm dosyası sürükle-bırak', () => {

  test('pencereye bırakılan .xlsx sihirbazı açar ve şeritlere döner', async ({ page }) => {
    await openResults(page);
    const r = await importByDrop(page, canoeXlsx(300), 'Testfahrt.xlsx');

    // Tarayıcı varsayılanı engellenmeli: yoksa sekme dosyaya gider ve
    // kullanıcının açık PROJESİ kaybolur — MFSim'de bedeli görüntüleyiciden
    // çok daha yüksek.
    expect(r.overPrevented).toBe(true);
    expect(r.dropPrevented).toBe(true);
    expect(r.shown).toBe(true);

    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length > 0,
      null, { timeout: 15000 });
    const signals = await page.evaluate(() => veResultSlots[0].sensors.map((s) => s.name));
    expect(signals).toEqual(['EngSpeed', 'VehSpeed', 'Motor Sıcaklığı', 'Gear', 'Mode']);
  });

  test('desteklenmeyen dosya reddedilir ama uygulama ayakta kalır', async ({ page }) => {
    await openResults(page);
    const r = await page.evaluate(dropInPage,
      { files: [{ bytes: [137, 80, 78, 71], name: 'resim.png' }] });
    expect(r.dropPrevented).toBe(true);
    await expect(page.locator('#ve-import-overlay')).toBeHidden();
    await expect(page.locator('.ve-toast', { hasText: 'resim.png' })).toBeVisible();
    // Proje hâlâ açık
    await expect(page.locator('#ve-results-tree')).toBeVisible();
  });
});

test.describe('MFSim — Birleştir: seçerek, çok eksenli', () => {

  test('araç performans panosunda çalışır', async ({ page }) => {
    await openResults(page);
    await importByDrop(page, canoeXlsx(300), 'Testfahrt.xlsx');
    await page.click('#ve-import-apply');
    await page.waitForFunction(() => veResultSlots[0].sensors.length === 5,
      null, { timeout: 15000 });

    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await expect(page.locator('#ve-trace-merge-pop')).toBeVisible();
    for (const i of [0, 1, 2]) {
      await page.check(`#ve-trace-merge-pop input[data-lane="${i}"]`);
    }
    await page.click('#ve-trace-merge-pop [data-act="merge-ok"]');

    await expect.poll(() => page.evaluate(() => veTrBoard().lanes.length)).toBe(3);
    const axes = await page.evaluate(() =>
      veTrState.geo.lanes[0].axes.map((a) => ({ unit: a.unit, max: a.yMax })));
    expect(axes.map((a) => a.unit)).toEqual(['1/min', 'km/h', '°C']);
    // Her eğri kendi ölçeğinde: hız ekseni devrin tepesine uzanmıyor
    expect(axes[1].max).toBeLessThan(100);
    expect(axes[0].max).toBeGreaterThan(2000);
  });

  test('takoz çökme-titreşim sekmesinde de aynı davranır', async ({ page }) => {
    // Takoz kanalları araç çözümünden BAĞIMSIZ besleniyor (window.veMountResults)
    // ve kendi X eksenleri var (Hz / mm / g). Birleştirme kodu ortak ama sekme
    // farklı: ağacı ayrı kuruluyor, eksen seçeneği ayrı üretiliyor ve o sekmede
    // ŞERİT İŞARETLERİ var (rezonans çizgisi, çalışma noktası) — işaretler
    // birleşik şeritte artık BİRİMİ TUTAN EKSENE çiziliyor. Bu yüzden sekme
    // gerçekten çözülüp sınanıyor, atlanmıyor.
    test.setTimeout(240000);
    await openApp(page);

    // Takoz modülünü kur → alt topolojisine gir → hazır örneği yükle → çöz.
    // Kullanıcının izlediği yolun aynısı; kestirme bir "sonucu enjekte et"
    // yolu seçilseydi test kendi kurgusunu doğrulamış olurdu.
    await page.evaluate(() => {
      window.confirm = () => true;          // örnek yükleme onayı
      veStartModule('mount-analysis');
      const n = (nodes || []).find((x) => x.type === 'mount-analysis');
      if (!n) throw new Error('mount-analysis düğümü kurulamadı');
      veMntOpenEditor(n.id);
    });
    await page.waitForFunction(
      () => (nodes || []).some((n) => (n.type || '').indexOf('mnt-') === 0),
      null, { timeout: 30000 });

    await page.evaluate(() => {
      const starter = (nodes || []).find((n) => n.type === 'mnt-example');
      if (starter) veMntLoadExample(starter.id);
    });
    await page.waitForFunction(
      () => (nodes || []).some((n) => n.type === 'mnt-solver'),
      null, { timeout: 30000 });

    await page.evaluate(async () => {
      const solver = (nodes || []).find((n) => n.type === 'mnt-solver');
      await veMntSolverCompute(solver.id);
    });
    await page.waitForFunction(
      () => typeof veMntSets === 'function' && veMntSets().length > 0,
      null, { timeout: 180000 });

    await page.evaluate(() => veSubTabDegistir('sonuclar'));
    await page.waitForSelector('#ve-trace', { timeout: 30000 });

    // Takoz sekmesine geç ve aynı veri kümesinden iki kanal ekle. Aynı küme
    // şart: farklı kümelerin X ekseni (Hz / mm / g) uyuşmuyor ve tek-eksen
    // kuralı ikincisini zaten reddederdi.
    await page.evaluate(() => {
      veActiveSolverTabId = 'mount';
      veResultSlots[VE_BOARD] = {};
      veUpdateResultsTree();
    });
    const added = await page.evaluate(() => {
      const g = veMntSignals.groups(veMntSets())[0];
      const items = g.items.slice(0, 2);
      items.forEach((it) => veAddSignalToSlot(VE_BOARD, it.sensorId, it.signalId));
      return veResultSlots[VE_BOARD].sensors.length;
    });
    expect(added).toBe(2);
    await page.evaluate(() => veTrRefresh());

    await page.click('#ve-trace-toolbar [data-act="merge-all"]');
    await expect(page.locator('#ve-trace-merge-pop')).toBeVisible();
    await page.check('#ve-trace-merge-pop input[data-lane="0"]');
    await page.check('#ve-trace-merge-pop input[data-lane="1"]');
    await page.click('#ve-trace-merge-pop [data-act="merge-ok"]');

    await expect.poll(() => page.evaluate(() => veTrBoard().lanes[0].ids.length)).toBe(2);
    const st = await page.evaluate(() => {
      const L = veTrState.geo.lanes[0];
      return {
        axes: L.axes.length,
        birim: L.axes.map((a) => a.unit),
        sinyal: L.sigs.length,
        adSatiri: veTrNameRows(L).length,
        // İki sinyal de gerçekten AYNI eksen nesnesini mi gösteriyor?
        ortak: veTrAxisOfSig(L, 0) === veTrAxisOfSig(L, 1),
        // İşaretler (rezonans çizgisi, çalışma noktası) hâlâ birimi tutan
        // eksene mi düşüyor? Birimsiz çağrı birincil ekseni vermeli.
        markAxis: veTrAxisByUnit(L, L.axes[0].unit) === L.axes[0],
        lanes: veTrBoard().lanes.length,
      };
    });
    // Grubun ilk iki kanalı sönümlü ve SÖNÜMSÜZ iletilebilirlik: aynı büyüklük,
    // aynı birim (−). Ayrı eksen alsalardı tepe değerleri (yaklaşık 3 ve 30)
    // İKİSİ DE şeridi doldurur, "sönüm hiçbir şey değiştirmemiş" gibi
    // görünürdü. Kıyaslanabilmeleri için ORTAK ölçek şart.
    expect(st.sinyal).toBe(2);
    expect(st.axes).toBe(1);
    expect(st.birim).toEqual(['−']);
    expect(st.ortak).toBe(true);
    expect(st.markAxis).toBe(true);
    expect(st.adSatiri).toBe(2);   // ortak eksene rağmen iki ad da listeleniyor
    expect(st.lanes).toBe(1);      // tek diyagramda birleştiler
  });
});
