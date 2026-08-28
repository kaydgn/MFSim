/**
 * fead-canvas-drag.spec.js — FEAD: KANVAS = KAYIŞ DÜZLEMİ (gerçek tarayıcı)
 *
 * Birim testler koordinat katmanını Node altında sınıyor; buradaki soru başka:
 * ZİNCİR uçtan uca ayakta mı?
 *
 *   fare sürüklemesi → veAttachNodeDrag → veFeadSyncDrag → mm koordinatı →
 *   topoloji imzası → Kayış Yolu kartının yeniden kurulması → yeni L_eff
 *
 * Bu zincirin halkalarının çoğu Node'da HİÇ koşmuyor: gerçek `mousedown/
 * mousemove/mouseup` dizisi, `canvasZoom` bölmesi, DOM'a yazılan `style.left`,
 * ve kartın `innerHTML` ile yeniden kurulması. Biri kırılırsa kutu yine
 * hareket eder, panel yine açılır — ve sayılar SESSİZCE eski kalır. Sessiz
 * kırılma tam olarak burada yakalanır.
 */
const { test, expect } = require('@playwright/test');

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' &&
    typeof window.veFeadOpenEditor === 'function' &&
    typeof window.veFeadLoadExample === 'function' &&
    typeof window.veFeadSyncDrag === 'function' &&
    Array.isArray(window.nodes),
    null, { timeout: 60000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 60000 });
}

// FEAD alt topolojisini aç ve BMC örneğini kur.
async function openFeadWithExample(page) {
  await page.evaluate(() => {
    const n = createNode('fead-analysis', 400, 300);
    veFeadOpenEditor(n.id);
  });
  await page.waitForFunction(() => Array.isArray(window.nodes), null, { timeout: 20000 });
  await page.evaluate(() => veFeadLoadExample('BMC_FEAD_2026'));
  await page.waitForFunction(() =>
    window.nodes.some((n) => n.type === 'fead-alternator') &&
    window.nodes.some((n) => n.type === 'fead-layout'),
    null, { timeout: 20000 });
  // Kümeyi görünür alana getir — kutular sidebar'ın altında kalırsa gerçek
  // fare olayları oraya gitmez.
  await page.evaluate(() => {
    if (typeof veFitViewToContent === 'function') veFitViewToContent();
  });
  await page.waitForTimeout(300);
}

// Kanvas zoom'u — sürükleme deltası buna BÖLÜNÜYOR (veAttachNodeDrag), yani
// ekranda 60 px sürüklemek zoom 0.6'da 100 mm demek. Bu bir kusur değil,
// 3 numaralı kararın kendisi: "1 px = 1 mm, hassasiyet zoom'dan gelir".
const zoomOf = (page) => page.evaluate(() =>
  (typeof canvasZoom !== 'undefined' ? canvasZoom : 1));

// Kayış Yolu kartının durum şeridinden L_eff'i oku.
const readL = (page) => page.evaluate(() => {
  const el = document.querySelector('.ve-node--fead-layout, [id]');
  const cards = Array.from(document.querySelectorAll('svg[data-fead-node]'));
  if (!cards.length) return null;
  const strip = cards[0].parentElement.parentElement.querySelector('div:last-child');
  const m = strip && strip.textContent.match(/L\s+([\d.]+)\s*mm/);
  return m ? Number(m[1]) : null;
});

const mmOf = (page, id) => page.evaluate((nid) => {
  const n = window.nodes.find((x) => x.id === nid);
  return n ? { x: n.data.x, y: n.data.y, px: n.x, py: n.y } : null;
}, id);

test.describe('FEAD kanvas = kayış düzlemi', () => {
  test('kasnağı SÜRÜKLEMEK mm koordinatını ve çözümü değiştiriyor', async ({ page }) => {
    await bootApp(page);
    await openFeadWithExample(page);

    const altId = await page.evaluate(() =>
      window.nodes.find((n) => n.type === 'fead-alternator').id);

    const once = await mmOf(page, altId);
    const Lonce = await readL(page);
    expect(Lonce).toBeGreaterThan(1000);

    // Kutunun ekran merkezinden tut, 60 px SOLA sürükle.
    const box = await page.locator('#' + altId).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2, { steps: 5 });
    await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();

    const sonra = await mmOf(page, altId);
    const z = await zoomOf(page);
    // Ekranda 60 px = kanvasta 60/zoom px = mm'de o kadar (1 px = 1 mm).
    // Zoom'u hesaba katmak testin kaçamağı değil, KARARIN doğrulaması:
    // hassasiyet zoom'dan geliyor, %400'de bir ekran pikseli 0.25 mm.
    expect(sonra.x).toBeCloseTo(once.x - 60 / z, 0);
    expect(sonra.y).toBeCloseTo(once.y, 0);

    // ve çözüm bunu GÖRDÜ: alternatör uzaklaştı → gereken kayış uzadı
    const Lsonra = await readL(page);
    expect(Lsonra).not.toBeNull();
    expect(Lsonra).toBeGreaterThan(Lonce);
  });

  test('SÜRÜKLERKEN kart canlı tazeleniyor — bırakmayı beklemiyor', async ({ page }) => {
    await bootApp(page);
    await openFeadWithExample(page);
    const altId = await page.evaluate(() =>
      window.nodes.find((n) => n.type === 'fead-alternator').id);

    const L0 = await readL(page);
    const box = await page.locator('#' + altId).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 50, box.y + box.height / 2, { steps: 6 });

    // FARE HÂLÂ BASILI. Kart zaten yeni sayıyı göstermeli.
    const Lsurukle = await readL(page);
    await page.mouse.up();
    expect(Lsurukle).not.toBeNull();
    expect(Math.abs(Lsurukle - L0)).toBeGreaterThan(1);
  });

  test('kayış boyu kipi rozeti TIKLANINCA değişiyor ve çözüm kipe uyuyor', async ({ page }) => {
    await bootApp(page);
    await openFeadWithExample(page);

    const beltId = await page.evaluate(() =>
      window.nodes.find((n) => n.type === 'fead-belt').id);
    // Kayış düğümünü kanvasın açık ortasına taşı: rozet sidebar'ın altında
    // kalırsa GERÇEK fare olayı oraya gitmez ve test tıklamayı hiç sınamaz.
    await page.evaluate((id) => {
      const n = window.nodes.find((x) => x.id === id);
      const c = document.getElementById('ve-canvas').getBoundingClientRect();
      const k = (typeof canvasZoom !== 'undefined' ? canvasZoom : 1);
      const off = (typeof canvasOffset !== 'undefined') ? canvasOffset : { x: 0, y: 0 };
      n.x = (c.width * 0.55 - off.x) / k;
      n.y = (c.height * 0.5 - off.y) / k;
      const el = document.getElementById(id);
      el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
      if (typeof updateAllConnections === 'function') updateAllConnections();
    }, beltId);
    await page.waitForTimeout(200);

    const rozet = page.locator('#' + beltId + ' .ve-fead-badge');
    await expect(rozet).toHaveText('SABİT');

    await rozet.click();
    await expect(page.locator('#' + beltId + ' .ve-fead-badge')).toHaveText('SERBEST');

    // Serbest kipte boy TÜRETİLMİŞ olmalı
    const turetildi = await page.evaluate(() =>
      veFeadBuildFromCanvas().beltLengthDerived);
    expect(turetildi).toBe(true);
  });

  // ── HİZALAMA KENETLEMESİ KOORDİNATI YEMİYOR ─────────────────────────────
  //
  // Kenetleme (checkAlignment) kutu KENARLARINI birbirine yapıştırır ve bunu
  // yaparken bütün düğümler için sabit 65 px genişlik varsayar. FEAD'de konum
  // fiziksel veri olduğu için bu, kullanıcının koymadığı bir koordinatla
  // çözmek demek. Varsayılan KAPALI (SNAP_ENABLED) — yani hata ancak kullanıcı
  // kenetlemeyi açtığında görünür ve o yüzden gözden kaçması kolay.
  //
  // ÖLÇÜLDÜ (gerçek tarayıcı, BMC, alternatör Avara 2'nin satırına doğru):
  //   kenetleme FEAD'de açıkken   24.514 mm istendi →  3.940 mm oldu
  //   kapalıyken (bugünkü hâl)    24.514 mm istendi → 24.514 mm oldu
  test('KENETLEME AÇIKKEN bile kasnak istendiği kadar oynuyor', async ({ page }) => {
    await bootApp(page);
    await openFeadWithExample(page);
    // Kullanıcının kenetlemeyi AÇTIĞI durum — hatanın tek görünür olduğu yer.
    await page.evaluate(() => { window.SNAP_ENABLED = true; });

    const altId = await page.evaluate(() =>
      window.nodes.find((n) => n.type === 'fead-alternator').id);
    const once = await mmOf(page, altId);

    // Avara 2 kayış düzleminde 7.94 mm yukarıda: kenetleme eşiğinin (8 px)
    // tam içine giren, yani kenetlemenin GERÇEKTEN ateşlendiği bir hedef.
    const box = await page.locator('#' + altId).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - i * 2, { steps: 2 });
    await page.mouse.up();

    const sonra = await mmOf(page, altId);
    const z = await zoomOf(page);
    expect(sonra.y - once.y).toBeCloseTo(16 / z, 0);   // ← kenetlemeliyken 3.94
    expect(sonra.x).toBeCloseTo(once.x, 1);
  });

  // ── ÖRNEK "KULLANIMA HAZIR" GELİYOR ─────────────────────────────────────
  //
  // Kullanıcı isteği (2026-08-26): kesikli çap daireleri kalksın; "Başlangıç ve
  // Örnekler" kutusu örnek kurulduktan sonra kalmasın; "Rapor" kutusu Çözücü'nün
  // altında gelsin; kart daha büyük olsun ve yön gülü ana şekle yaklaşsın.
  //
  // Node bunların hiçbirini GÖREMEZ: kutu DOM'da mı, kart gerçekten o ölçüde mi
  // kuruldu, SVG viewBox'ı ne — hepsi gerçek tarayıcının işi.
  test('örnek kurulunca: hayalet YOK, başlangıç kutusu YOK, Rapor VAR', async ({ page }) => {
    await bootApp(page);
    await openFeadWithExample(page);

    const r = await page.evaluate(() => {
      const araclar = window.nodes
        .filter((n) => {
          const d = (window.componentDefs || {})[n.type] || {};
          return d.isFeadExample || d.isFeadBelt || d.isFeadSolver || d.isFeadReport;
        })
        .slice().sort((a, b) => a.y - b.y).map((n) => n.type);
      const lay = window.nodes.find((n) => n.type === 'fead-layout');
      const svg = document.querySelector('svg[data-fead-node]');
      const belt = svg && svg.querySelector('path[data-ve="belt"]');
      const bb = belt ? belt.getBBox() : null;
      return {
        araclar,
        // Kesikli çap hayaleti DOM'dan tamamen kalkmalı
        hayalet: window.nodes.filter((n) => {
          const el = document.getElementById(n.id);
          return el && el.querySelector('.ve-fead-dia');
        }).length,
        kart: lay ? { w: lay.width, h: lay.height } : null,
        viewBox: svg ? svg.getAttribute('viewBox') : null,
        beltW: bb ? +bb.width.toFixed(1) : null
      };
    });

    // Sol şerit: Kayış Özellikleri → Çözücü → Rapor, başlangıç kutusu YOK
    expect(r.araclar).toEqual(['fead-belt', 'fead-solver', 'fead-report']);
    expect(r.hayalet).toBe(0);
    // Kart yeni varsayılan ölçüde ve SVG'si kartın kendi genişliğinde
    expect(r.kart).toEqual({ w: 440, h: 500 });
    expect(r.viewBox).toBe('0 0 440 458');
    // ŞERİT AYRILMADI: çizim 18 px payın dışında kalan TAM genişliği kullanıyor.
    // Şerit ayrılsaydı 440−36−54 = 350 px olurdu (eski davranış, ölçüldü).
    expect(r.beltW).toBeGreaterThan(400);
  });

  test('"Otomatik Düzenle" koordinatları SİLMİYOR, kutuları yerine koyuyor', async ({ page }) => {
    await bootApp(page);
    await openFeadWithExample(page);

    const once = await page.evaluate(() => window.nodes
      .filter((n) => n.data && n.data.od)
      .map((n) => ({ id: n.id, x: n.data.x, y: n.data.y })));

    await page.evaluate(() => veTidyLayout());
    await page.waitForTimeout(200);

    const sonra = await page.evaluate(() => window.nodes
      .filter((n) => n.data && n.data.od)
      .map((n) => ({ id: n.id, x: n.data.x, y: n.data.y })));
    expect(sonra).toEqual(once);

    // ve kutular arası mesafe mm mesafesine eşit (1 px = 1 mm)
    const kontrol = await page.evaluate(() => {
      const p = window.nodes.filter((n) => n.data && Number.isFinite(n.data.x));
      const c = (n) => ({ x: n.x + (n.width || 65) / 2, y: n.y + (n.height || 60) / 2 });
      const a = p[0], b = p[1];
      return { dxPx: c(b).x - c(a).x, dxMm: b.data.x - a.data.x,
               dyPx: c(b).y - c(a).y, dyMm: b.data.y - a.data.y };
    });
    expect(kontrol.dxPx).toBeCloseTo(kontrol.dxMm, 0);
    expect(kontrol.dyPx).toBeCloseTo(-kontrol.dyMm, 0);      // Y TERS
  });

  // ── KONUM BAĞI (fead-coordlink) ─────────────────────────────────────────
  //
  // Kullanıcı isteği (2026-08-28): *"ufak, böyle açılıp kapanabilen bir
  // bileşen… topolojiye çekip açtığımız kapattığımız zaman [koordinatın
  // değişmesi] devreye girsin veya devreden çıksın."*
  //
  // Node bunu göremiyor: rozete GERÇEK bir fare tıklaması, gerçek
  // `mousedown/mousemove/mouseup` dizisi, DOM'a yazılan `style.left` ve
  // kenetlemenin gerçekten ateşlenmesi — dördü de yalnız tarayıcıda koşuyor.

  // Düğümü kanvasın açık ortasına al: rozet sidebar'ın altında kalırsa
  // gerçek fare olayı oraya hiç gitmez (kayış kipi rozetindeki dersin aynısı).
  async function bagiKur(page) {
    const id = await page.evaluate(() => {
      const n = createNode('fead-coordlink', 0, 0);
      const c = document.getElementById('ve-canvas').getBoundingClientRect();
      const k = (typeof canvasZoom !== 'undefined' ? canvasZoom : 1);
      const off = (typeof canvasOffset !== 'undefined') ? canvasOffset : { x: 0, y: 0 };
      n.x = (c.width * 0.55 - off.x) / k;
      n.y = (c.height * 0.5 - off.y) / k;
      const el = document.getElementById(n.id);
      el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
      if (typeof updateAllConnections === 'function') updateAllConnections();
      return n.id;
    });
    await page.waitForTimeout(150);
    // Rozet YERLEŞENE KADAR bekle. Tazeleme (saveState → veFeadRefreshBadges)
    // rozeti DOM'dan söküp yeniden kuruyor; beklemeden tıklamak bayat bir
    // öğeye gidiyor ve tık sessizce kayboluyor (ölçüldü).
    await expect(page.locator('#' + id + ' .ve-fead-badge')).toHaveText('AÇIK');
    return id;
  }

  const rozet = (page, id) => page.locator('#' + id + ' .ve-fead-badge');

  test('rozet TIKLANINCA bağ kapanıyor: kutu oynuyor, mm oynamıyor', async ({ page }) => {
    await bootApp(page);
    await openFeadWithExample(page);
    const bagId = await bagiKur(page);

    // Paletten bırakmak tek başına HİÇBİR ŞEYİ değiştirmemeli: AÇIK doğar.
    await expect(rozet(page, bagId)).toHaveText('AÇIK');

    await rozet(page, bagId).click();
    await expect(rozet(page, bagId)).toHaveText('KAPALI');

    const altId = await page.evaluate(() =>
      window.nodes.find((n) => n.type === 'fead-alternator').id);
    const once = await mmOf(page, altId);
    const L0 = await readL(page);

    const box = await page.locator('#' + altId).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 40, { steps: 8 });
    await page.mouse.up();

    const sonra = await mmOf(page, altId);
    const z = await zoomOf(page);
    // MODEL DEĞİŞMEDİ…
    expect(sonra.x).toBeCloseTo(once.x, 6);
    expect(sonra.y).toBeCloseTo(once.y, 6);
    // …KUTU DEĞİŞTİ (kapatılan şey yazma, hareket değil)
    expect(sonra.px - once.px).toBeCloseTo(-60 / z, 0);
    expect(sonra.py - once.py).toBeCloseTo(-40 / z, 0);
    // Kayış Yolu kartı da aynı kaldı — geometri değişmedi, çizim değişmemeli.
    expect(await readL(page)).toBeCloseTo(L0, 6);
  });

  test('bağı YENİDEN AÇMAK kutuyu koordinata döndürür, koordinatı kutuya YAZMAZ',
    async ({ page }) => {
      await bootApp(page);
      await openFeadWithExample(page);
      const bagId = await bagiKur(page);
      const altId = await page.evaluate(() =>
        window.nodes.find((n) => n.type === 'fead-alternator').id);
      const once = await mmOf(page, altId);

      await rozet(page, bagId).click();                       // KAPAT
      await expect(rozet(page, bagId)).toHaveText('KAPALI');

      const box = await page.locator('#' + altId).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 70, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
      const serbest = await mmOf(page, altId);
      expect(Math.abs(serbest.px - once.px)).toBeGreaterThan(20);

      await rozet(page, bagId).click();                       // AÇ
      await expect(rozet(page, bagId)).toHaveText('AÇIK');
      await page.waitForTimeout(200);

      const geri = await mmOf(page, altId);
      expect(geri.x).toBeCloseTo(once.x, 6);       // model hiç değişmedi
      expect(geri.y).toBeCloseTo(once.y, 6);
      expect(geri.px).toBeCloseTo(once.px, 1);     // kutu koordinatına döndü
      expect(geri.py).toBeCloseTo(once.py, 1);
      // DOM da tazelendi — dizi güncellenip elemanın style'ı eski kalsaydı
      // kutu ekranda serbest yerinde görünmeye devam ederdi.
      const domX = await page.evaluate((id) =>
        parseFloat(document.getElementById(id).style.left), altId);
      expect(domX).toBeCloseTo(geri.px, 1);
    });

  // KENETLEME İSTİSNASI BAĞA BAĞLI. Kasnak sürüklenirken hizalama kenetlemesi
  // KAPALI, çünkü kutu kenarlarını yapıştırmak koordinatı sessizce yutuyordu
  // (ölçüldü: 24.514 mm istenirken 3.940 mm). Bağ kapalıyken o gerekçe yok —
  // kutu salt görsel, yani kenetleme klasik topolojilerdeki anlamına dönüyor.
  test('bağ KAPALIYKEN kenetleme geri geliyor (yutacak bir mm yok)', async ({ page }) => {
    await bootApp(page);
    await openFeadWithExample(page);
    const bagId = await bagiKur(page);
    await rozet(page, bagId).click();                          // KAPAT
    await expect(rozet(page, bagId)).toHaveText('KAPALI');
    // Kullanıcının kenetlemeyi AÇTIĞI durum (varsayılan kapalı).
    await page.evaluate(() => { window.SNAP_ENABLED = true; });

    const altId = await page.evaluate(() =>
      window.nodes.find((n) => n.type === 'fead-alternator').id);
    const once = await mmOf(page, altId);

    // Kardeş testteki HEDEFİN AYNISI: Avara 2 kayış düzleminde 7.94 mm
    // yukarıda, yani 8 px kenetleme eşiğinin tam içinde.
    const box = await page.locator('#' + altId).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - i * 2, { steps: 2 });
    await page.mouse.up();

    const sonra = await mmOf(page, altId);
    const z = await zoomOf(page);
    // KENETLEME ATEŞLENDİ: kutu istenen 16/z px'in belirgin ALTINDA kaldı.
    // (Kardeş test aynı hareketle bağ AÇIKKEN 16/z'yi birebir alıyor.)
    expect(Math.abs(sonra.py - once.py)).toBeLessThan((16 / z) * 0.75);
    // …ve yutulan şey bir mm DEĞİL: model kılı kıpırdamadı.
    expect(sonra.x).toBeCloseTo(once.x, 6);
    expect(sonra.y).toBeCloseTo(once.y, 6);
  });

  // BAĞ DÜĞÜMÜNÜ SİLMEK = BAĞI AÇMAK. Silme gerçek `deleteSelectedNodes`
  // yolundan geçiyor (map.js) ve DOM'a da yazması gerekiyor; Node bunu görmüyor.
  //
  // ÖLÇÜLDÜ (kanca YOKKEN, BMC, kapalıyken alternatör dizilmiş, sonra düğüm
  // silinmiş): sonraki 1 px sürükleme alternatörü mm'de 81 mm sıçratıyordu.
  test('kapalı bağ düğümünü SİLMEK kutuları koordinata oturtur', async ({ page }) => {
    await bootApp(page);
    await openFeadWithExample(page);
    const bagId = await bagiKur(page);
    await rozet(page, bagId).click();
    await expect(rozet(page, bagId)).toHaveText('KAPALI');

    const altId = await page.evaluate(() =>
      window.nodes.find((n) => n.type === 'fead-alternator').id);
    const once = await mmOf(page, altId);

    const box = await page.locator('#' + altId).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 - 50, { steps: 8 });
    await page.mouse.up();
    expect(Math.abs((await mmOf(page, altId)).px - once.px)).toBeGreaterThan(20);

    // Düğümü GERÇEK silme yolundan sil.
    await page.evaluate((id) => {
      window.selectedNodes = [window.nodes.find((n) => n.id === id)];
      deleteSelectedNodes();
    }, bagId);
    await page.waitForTimeout(200);

    const sonra = await mmOf(page, altId);
    expect(sonra.px).toBeCloseTo(once.px, 1);     // kutu koordinatına oturdu
    expect(sonra.py).toBeCloseTo(once.py, 1);
    expect(sonra.x).toBeCloseTo(once.x, 6);       // model hiç değişmedi
    const domX = await page.evaluate((id) =>
      parseFloat(document.getElementById(id).style.left), altId);
    expect(domX).toBeCloseTo(sonra.px, 1);

    // …ve bundan sonra 1 px, 1 mm eder — 81 mm değil.
    const b2 = await page.locator('#' + altId).boundingBox();
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await page.mouse.down();
    await page.mouse.move(b2.x + b2.width / 2 + 10, b2.y + b2.height / 2, { steps: 4 });
    await page.mouse.up();
    const z = await zoomOf(page);
    expect((await mmOf(page, altId)).x - once.x).toBeCloseTo(10 / z, 0);
  });

  test('düğüm YOKKEN davranış birebir eski — bağ varsayılan AÇIK', async ({ page }) => {
    await bootApp(page);
    await openFeadWithExample(page);
    // Bu, bugüne kadar kaydedilmiş HER projenin durumu: bağ düğümü yok.
    const acik = await page.evaluate(() => veFeadCoordLinkOn(window.nodes));
    expect(acik).toBe(true);
    const bagVar = await page.evaluate(() =>
      window.nodes.some((n) => n.type === 'fead-coordlink'));
    expect(bagVar).toBe(false);
  });
});
