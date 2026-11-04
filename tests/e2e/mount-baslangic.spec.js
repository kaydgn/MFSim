/**
 * mount-baslangic.spec.js — TAKOZ BAŞLANGIÇ SAYFASI (gerçek tarayıcı)
 *
 * Kullanıcı isteği (2026-10-14): *"FEAD modülünün başlangıç ekranı çok güzel,
 * aynı onun gibi bir ekran istiyorum. Takoz modülüne de 'Başlangıç Sihirbazı',
 * 'STEP dosyadan başlama' ve 'Boş kanvas' gibi özellikler kuracağız."*
 *
 * ÖLÇÜLEN ESKİ HÂL: modül açılınca iç topolojiye tek bir "Başlangıç ve
 * Örnekler" bileşeni kuruluyordu; ne yapılacağı ancak ona çift tıklayınca
 * görünüyordu.
 *
 * Node'da HİÇ koşmayan halkalar: sayfanın tuvali gerçekten örtmesi ve
 * ana topolojiye dönüş düğmesinin onun ÜSTÜNDE kalması, tekerleğin kadrajı
 * oynatmaması, gerçek tıkla kurulum → çekilme → Ctrl+Z → geri gelme, STEP
 * kapısının dosya seçiciyi AYNI tıklamada açması. Birim tarafı:
 * tests/unit/mount-baslangic.test.js · mount-wizard.test.js.
 */
const { test, expect } = require('@playwright/test');
const STEP = require('../helpers/step-takoz.js');
test.setTimeout(180000);

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veMntOpenEditor === 'function' &&
    typeof window.veMntBaslangicTazele === 'function' && typeof window.veMntWizAc === 'function' &&
    typeof window.veMntStpOku === 'function' && Array.isArray(window.nodes),
    null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
}
async function takozGir(page) {
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
}
const say = (page) => page.evaluate(() => ({
  hepsi: window.nodes.length,
  govde: window.nodes.filter((n) => (componentDefs[n.type] || {}).isMountBody).length,
  takoz: window.nodes.filter((n) => (componentDefs[n.type] || {}).isMount).length,
  ornek: window.nodes.filter((n) => n.type === 'mnt-example').length,
}));

test('AÇILIŞ: sayfa tuvali örter, dönüş düğmesi üstte, düğüm KURULMAZ', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  expect(await say(page)).toEqual({ hepsi: 0, govde: 0, takoz: 0, ornek: 0 });
  const o = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { w: b.width, h: b.height }; };
    const btn = document.querySelector('#ve-mnt-breadcrumb button');
    const bb = btn.getBoundingClientRect();
    const ust = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2);
    return { kap: r(document.getElementById('ve-canvas-wrapper')), sayfa: r(document.getElementById('ve-mnt-baslangic')),
      donus: !!(ust && btn.contains(ust)),
      kapi: [...document.querySelectorAll('#ve-mnt-baslangic .ve-bas-kapi')].map((b) => b.getAttribute('data-ey')),
      karo: document.querySelectorAll('#ve-mnt-baslangic .ve-bas-karo').length,
      cizim: document.querySelectorAll('#ve-mnt-baslangic .ve-bas-resim svg.ve-mnt2d-akso').length,
      ornek: veMountCore.getMountExampleList().length,
      // KİMLİK VE VERİ tarayıcıda: sabitler `window`dan okunur — Node'un
      // `require` yolu bunu göremez; bir satır düşerse ancak burada görünür.
      baslik: (document.querySelector('#ve-mnt-baslangic .ve-bas-kimlik h1') || {}).textContent,
      veri: [...document.querySelectorAll('#ve-mnt-baslangic .ve-bas-veri dd')].map((e) => e.textContent),
      canli: [Object.keys(VE_MOUNT_LIBRARY).length, VE_MW_GOVDE_TIPLERI.length,
        veMountCore.getMountExampleList().length].map((x) => veSayi(x, 0)),
      kunye: [...document.querySelectorAll('#ve-mnt-baslangic .ve-bas-kapi-k')].map((k) => k.children.length),
      kilavuz: document.querySelector('#ve-mnt-baslangic .ve-bas-kilavuz')?.getAttribute('data-v'),
      // ÇALIŞMA MASASI: sayfa açıkken ray yok; önizleme kutunun ÖLÇÜSÜNDE çizili
      ray: document.getElementById('ve-nav-rail').getBoundingClientRect().width,
      oniz: (() => { const k = document.querySelector('#ve-mnt-baslangic .ve-bas-oniz-resim');
        const s = k.querySelector('svg.ve-mnt2d-akso');
        return { w: k.clientWidth, h: k.clientHeight, vb: s && s.getAttribute('viewBox'), yazi: s ? s.querySelectorAll('text').length : 0 }; })() };
  });
  expect(Math.round(o.sayfa.w)).toBe(Math.round(o.kap.w));
  expect(Math.round(o.sayfa.h)).toBe(Math.round(o.kap.h));
  expect(o.donus).toBe(true);
  expect(o.kapi).toEqual(['sihirbaz', 'step', 'bos']);
  expect(o.karo).toBe(o.ornek);
  expect(o.cizim).toBe(o.ornek);
  expect(o.baslik).toBe('Takoz Çökme-Titreşim');
  expect(o.veri).toHaveLength(5);
  expect([o.veri[0], o.veri[2], o.veri[3]]).toEqual(o.canli);
  expect(o.kunye).toEqual([4, 5, 1]);
  expect(o.kilavuz).toBe('mount');
  expect(o.ray).toBe(0);
  expect(o.oniz.vb).toBe('0 0 ' + o.oniz.w + ' ' + o.oniz.h);
  expect(o.oniz.yazi).toBeGreaterThan(3);              // yazılı kip: gövde adları ve kütleleri
  // Kılavuz düğmesi modülün kılavuzunu açar (pencere açmak yerine çağrı yakalanır).
  await page.evaluate(() => { window.veGuideOpen = (id) => { window.__kilavuz = id; }; });
  await page.click('#ve-mnt-baslangic .ve-bas-kilavuz');
  expect(await page.evaluate(() => window.__kilavuz)).toBe('mount');
  expect(await page.evaluate(() => veMntBaslangicAcik())).toBe(true);   // sayfa yerinde
  expect(hatalar).toEqual([]);
});

test('TEKERLEK sayfayı kaydırır, kadrajı oynatmaz', async ({ page }) => {
  // Kısa pencere: sayfanın içeriği sığmasın (1366×600'de sığıyor — ölçüldü)
  await page.setViewportSize({ width: 1200, height: 460 });
  await bootApp(page);
  await takozGir(page);
  expect(await page.evaluate(() => { const e = document.getElementById('ve-mnt-baslangic'); return e.scrollHeight > e.clientHeight; })).toBe(true);
  const once = await page.evaluate(() => ({ z: canvasZoom, x: canvasOffset.x, y: canvasOffset.y }));
  await page.mouse.move(700, 300);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(200);
  const sonra = await page.evaluate(() => ({ z: canvasZoom, x: canvasOffset.x, y: canvasOffset.y,
    kay: document.getElementById('ve-mnt-baslangic').scrollTop }));
  expect({ z: sonra.z, x: sonra.x, y: sonra.y }).toEqual(once);
  expect(sonra.kay).toBeGreaterThan(0);
});

test('BOŞ KANVAS: araçlar kurulur, sayfa çekilir; Ctrl+Z sayfayı geri getirir', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  await page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="bos"]');
  await expect(page.locator('#ve-mnt-baslangic')).toBeHidden();
  const s = await page.evaluate(() => ({ tip: nodes.map((n) => n.type).sort(), beklenen: VE_MNT_ARAC_TIPLERI.slice().sort() }));
  expect(s.tip).toEqual(s.beklenen);
  await page.locator('#ve-canvas-wrapper').click({ position: { x: 40, y: 300 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
  expect((await say(page)).hepsi).toBe(0);
});

test('ÖRNEK KARO: model birebir yüklenir, sayfa çekilir; Ctrl+Z TEK adımda geri alır', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  await page.evaluate(() => { window.confirm = () => true; });
  // ÇALIŞMA MASASI: karo SEÇER (model kurulmaz, önizleme değişir), Yükle kurar
  await page.click('#ve-mnt-baslangic .ve-bas-karo[data-v="tulga"]');
  await expect(page.locator('#ve-mnt-baslangic .ve-bas-oniz h2')).toHaveText('TULGA');
  expect((await say(page)).hepsi).toBe(0);
  await page.click('#ve-mnt-baslangic .ve-bas-yukle');
  await expect(page.locator('#ve-mnt-baslangic')).toBeHidden();
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'mnt-mount'), null, { timeout: 15000 });
  // Ray geri geldi ve kadraj RAYLI tuvalde kuruldu: hiçbir kutu tuvalin dışında değil
  await page.waitForTimeout(400);
  const k = await page.evaluate(() => {
    const w = document.getElementById('ve-canvas-wrapper').getBoundingClientRect();
    const dis = [...document.querySelectorAll('#ve-canvas .ve-node')].filter((e) => e.offsetWidth > 0).map((e) => e.getBoundingClientRect())
      .filter((b) => b.left < w.left - 1 || b.right > w.right + 1 || b.top < w.top - 1 || b.bottom > w.bottom + 1).length;
    return { ray: document.getElementById('ve-nav-rail').getBoundingClientRect().width, dis };
  });
  expect(k).toEqual({ ray: 64, dis: 0 });
  const s = await say(page);
  expect(s.govde).toBeGreaterThan(0);
  expect(s.takoz).toBeGreaterThanOrEqual(3);
  await page.locator('#ve-canvas-wrapper').click({ position: { x: 20, y: 600 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
  expect((await say(page)).hepsi).toBe(0);
});

test('SİHİRBAZ KAPISI: pencere FEAD sihirbazının kabuğuyla açılır, Esc kapatır', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  await page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="sihirbaz"]');
  await expect(page.locator('#ve-mntwiz-overlay')).toBeVisible();
  const ray = await page.evaluate(() => [...document.querySelectorAll('#ve-mw-nav .ve-fw-step-t b')].map((b) => b.textContent));
  expect(ray).toEqual(await page.evaluate(() => VE_MW_STEPS.map((s) => s.ad)));
  await expect(page.locator('#ve-mw-title')).toContainText('Takoz Başlangıç Sihirbazı');
  await page.keyboard.press('Escape');
  await expect(page.locator('#ve-mntwiz-overlay')).toBeHidden();
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
});

// STEP KAPISI (kullanıcı kararı 2026-11-02: "Stepten başla butonuna tıkladığım
// zaman, ilk baştaki yükleme sihirbazı üzerinden okuyor. Bunu istemiyorum." →
// "3B açılsın, sonra sihirbaz"). Önce (main 8f83e73): kapı sihirbazı açıyordu.
test('STEP KAPISI: seçici AYNI tıklamada; sihirbaz açılmaz, dosya 3B\'nin perdesinde okunur; Sihirbaza aktar sihirbazı açar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="step"]'),
  ]);
  await expect(page.locator('#ve-mntwiz-overlay')).toBeHidden();
  await fc.setFiles({ name: 'guc.stp', mimeType: 'application/octet-stream', buffer: Buffer.from(STEP.gucGrubu()) });
  await expect(page.locator('#ve-mnt-3b-overlay')).toBeVisible();
  await page.waitForFunction(() => { const k = document.getElementById('ve-mw-3b-tuval'); return k && k.getAttribute('data-durum') === 'hazir'; },
    null, { timeout: 60000 });
  await expect(page.locator('#ve-mntwiz-overlay')).toBeHidden();
  expect(await page.evaluate(() => [veMntWiz3bYer(), veMntWizStp().yer])).toEqual(['pencere', 'pencere']);
  // tuvalde araç şeridi — rollerin evi 3D Görüntüleyici dâhil; başlangıç sayfası çekildi
  expect(await page.evaluate(() => nodes.filter((n) => n.type === 'mnt-viewer').length)).toBe(1);
  await expect(page.locator('#ve-mnt-baslangic')).toBeHidden();
  // rol ve hesap 3B'de; rol rollerin evine yazılır
  await page.evaluate(() => {
    const s = veMntWizStp();
    s.sonuc.agac.forEach((d) => { if (d.ad === 'Motor bloğu') veMntWizStpRol(d.i, 'mnt-motor'); if (/takoz$/.test(d.ad)) veMntWizStpRol(d.i, 'mnt-mount'); });
  });
  expect(await page.evaluate(() => nodes.find((n) => n.type === 'mnt-viewer').data.cad.roller.length)).toBe(5);
  await page.click('#ve-mw-3b-hesapla');
  await page.waitForFunction(() => { const s = veMntWizStp(); return s.coz && s.coz.ok; }, null, { timeout: 60000 });
  // aktarım kendi perdesindeki 3B'de de: sihirbaz açılır, 3B kapanır
  await page.click('#ve-mw-3b-aktar');
  await expect(page.locator('#ve-mntwiz-overlay')).toBeVisible();
  await expect(page.locator('#ve-mnt-3b-overlay')).toBeHidden();
  expect(await page.evaluate(() => !!veMntWizStp().aktarim)).toBe(true);
  await expect(page.locator('#ve-mw-body .ve-fw-stp .ve-fw-seeded b').first()).toHaveText('guc.stp');
});

// RAY (kullanıcı 2026-11-04: "pencere ilk açıldığında sol tarafta 'topoloji ve
// sonuçlar' sütunu görünmesin. Gerek yok"). Node'da koşmayan halkalar: CSS'in
// rayı gerçekten çizmemesi, sayfanın genişlemesi, Sonuçlar sayfasında rayın
// dönüş yolu olarak kalması ve sayfa çekilince geri gelmesi.
test('RAY: sayfa açıkken ray yok; Sonuçlar\'da var; sayfa çekilince geri gelir', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  const ray = () => page.evaluate(() => document.getElementById('ve-nav-rail').getBoundingClientRect().width);
  expect(await ray()).toBe(64);                              // ana topoloji
  await takozGir(page);
  expect(await ray()).toBe(0);
  const w = await page.evaluate(() => ({ kap: document.getElementById('ve-canvas-wrapper').getBoundingClientRect().width,
    sayfa: document.getElementById('ve-mnt-baslangic').getBoundingClientRect().width }));
  expect(Math.round(w.sayfa)).toBe(Math.round(w.kap));
  await page.evaluate(() => veSubTabDegistir('sonuclar'));
  expect(await ray()).toBe(64);                              // öteki sayfada dönüş yolu
  await page.evaluate(() => veSubTabDegistir('arac-performans'));
  expect(await ray()).toBe(0);
  await page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="bos"]');
  await expect(page.locator('#ve-mnt-baslangic')).toBeHidden();
  expect(await ray()).toBe(64);
  await page.locator('#ve-canvas-wrapper').click({ position: { x: 40, y: 300 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
  expect(await ray()).toBe(0);
  await page.evaluate(() => veMntCloseEditor());              // ana topolojiye dönüş
  await page.waitForTimeout(300);
  expect(await ray()).toBe(64);
});

test('ÇALIŞMA MASASI: çift tık kurar; seçim yeniden açılışta yerinde; önizleme pencereyle yeniden çizilir', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  await page.click('#ve-mnt-baslangic .ve-bas-karo[data-v="kamyon"]');
  await expect(page.locator('#ve-mnt-baslangic .ve-bas-oniz h2')).toHaveText('Orta kamyon');
  await expect(page.locator('#ve-mnt-baslangic .ve-bas-oniz-ad i')).toHaveText('kurgu');
  const once = await page.evaluate(() => document.querySelector('#ve-mnt-baslangic .ve-bas-oniz-resim').getAttribute('data-imza'));
  await page.setViewportSize({ width: 1700, height: 960 });
  await page.waitForFunction((o) => document.querySelector('#ve-mnt-baslangic .ve-bas-oniz-resim').getAttribute('data-imza') !== o, once, { timeout: 5000 });
  const sonra = await page.evaluate(() => { const k = document.querySelector('#ve-mnt-baslangic .ve-bas-oniz-resim');
    return { imza: k.getAttribute('data-imza'), olcu: 'kamyon|' + k.clientWidth + 'x' + k.clientHeight }; });
  expect(sonra.imza).toBe(sonra.olcu);
  await page.evaluate(() => { window.confirm = () => true; });
  await page.dblclick('#ve-mnt-baslangic .ve-bas-karo[data-v="hafif"]');
  await expect(page.locator('#ve-mnt-baslangic')).toBeHidden();
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'mnt-mount'), null, { timeout: 15000 });
  await page.locator('#ve-canvas-wrapper').click({ position: { x: 20, y: 600 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
  await expect(page.locator('#ve-mnt-baslangic .ve-bas-karo[aria-pressed="true"]')).toHaveAttribute('data-v', 'hafif');
});

// PALET DARALTILMIŞKEN (kullanıcının ekranı): açma sekmesi (z 150) tuvalin sol
// kenarında, dönüş düğmesi (z 60) eskiden onun ALTINDA kalıyordu — 26 px'in
// 23'ü örtülü, alt topolojiden çıkmanın tek yolu. Düğme sekmenin sağına
// oturur; Çalışma masasının paneli ikisinin altından başlar.
test('DAR PALET: dönüş düğmesi açma sekmesinin sağında ve açıkta; panel sekmenin altında', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await bootApp(page);
  await page.evaluate(() => veToggleSidebar(true));
  await page.waitForTimeout(500);
  await takozGir(page);
  await page.waitForTimeout(500);
  const o = await page.evaluate(() => {
    const r = (e) => e.getBoundingClientRect();
    const btn = document.querySelector('#ve-mnt-breadcrumb button'), sekme = document.getElementById('ve-sidebar-reveal');
    const b = r(btn), s = r(sekme), ik = r(document.querySelector('#ve-mnt-baslangic .ve-bas-kimlik'));
    const ust = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { acik: !!(ust && btn.contains(ust)), dugmeSekmeninSaginda: b.left >= s.right,
             kimlikSekmeninAltinda: ik.top >= s.bottom, kimlikDugmeninAltinda: ik.top >= b.bottom };
  });
  expect(o).toEqual({ acik: true, dugmeSekmeninSaginda: true, kimlikSekmeninAltinda: true, kimlikDugmeninAltinda: true });
  await page.evaluate(() => veToggleSidebar(false));
});
