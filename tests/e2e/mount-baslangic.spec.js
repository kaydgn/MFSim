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
 * ana topolojiye dönüşün panelin ALTINDA olması (köşedeki düğme gizli — Canlı
 * Not 19), örneklerin sekmesi, tekerleğin kadrajı
 * oynatmaması, gerçek tıkla kurulum → çekilme → Ctrl+Z → geri gelme, STEP
 * kapısının dosya seçiciyi AYNI tıklamada açması. Birim tarafı:
 * tests/unit/mount-baslangic.test.js · mount-wizard.test.js.
 */
const { test, expect } = require('@playwright/test');
const STEP = require('../helpers/step-takoz.js');
const Y = require('../helpers/yerlesim-olcu.js');
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

test('AÇILIŞ: sayfa tuvali örter, dönüş panelin altında, düğüm KURULMAZ', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  expect(await say(page)).toEqual({ hepsi: 0, govde: 0, takoz: 0, ornek: 0 });
  const o = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { w: b.width, h: b.height }; };
    // Dönüş panelin altında (Canlı Not 19); köşedeki düğme sayfa açıkken gizli.
    const btn = document.querySelector('#ve-mnt-baslangic .ve-bas-dip .ve-bas-donus');
    const bb = btn.getBoundingClientRect(), pb = document.querySelector('#ve-mnt-baslangic .ve-bas-panel').getBoundingClientRect();
    const ust = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2);
    return { kap: r(document.getElementById('ve-canvas-wrapper')), sayfa: r(document.getElementById('ve-mnt-baslangic')),
      donus: !!(ust && btn.contains(ust)), donusAlt: Math.round(pb.bottom - bb.bottom),
      kose: document.querySelector('#ve-mnt-breadcrumb button').offsetWidth,
      // Canlı Not 22: sayfa açıkken "Bileşenler" sütunu yok
      palet: document.getElementById('ve-sidebar').offsetWidth,
      yetenek: document.querySelectorAll('#ve-mnt-baslangic .ve-bas-yetenek').length,
      sekme: [...document.querySelectorAll('#ve-mnt-baslangic .ve-bas-sekme')].map((b) => b.textContent),
      kapi: [...document.querySelectorAll('#ve-mnt-baslangic .ve-bas-kapi')].map((b) => b.getAttribute('data-ey')),
      satir: document.querySelectorAll('#ve-mnt-baslangic .ve-bas-satir').length,
      cizim: document.querySelectorAll('#ve-mnt-baslangic svg.ve-mnt2d-akso').length,
      acik: [...document.querySelectorAll('#ve-mnt-baslangic .ve-bas-satir.acik')].map((r) => r.getAttribute('data-v')),
      ornek: veMountCore.getMountExampleList().filter((e) => !e.kurgu).length,
      kurgu: veMountCore.getMountExampleList().filter((e) => e.kurgu).length,
      // KİMLİK VE VERİ tarayıcıda: künyenin sabitleri `window`dan okunur —
      // Node'un `require` yolu bunu göremez; bir ad düşerse ancak burada
      // görünür. Sayı bandı YOK (kullanıcı 2026-11-05, Canlı Not 5).
      baslik: (document.querySelector('#ve-mnt-baslangic .ve-bas-kimlik h1') || {}).textContent,
      veri: document.querySelectorAll('#ve-mnt-baslangic .ve-bas-veri').length,
      kunye: [...document.querySelectorAll('#ve-mnt-baslangic .ve-bas-kapi-k')].map((k) => k.children.length),
      kilavuz: document.querySelector('#ve-mnt-baslangic .ve-bas-kilavuz')?.getAttribute('data-v'),
      // ÇALIŞMA MASASI: sayfa açıkken ray yok; masada örneklerin dizini, resim yok
      ray: document.getElementById('ve-nav-rail').getBoundingClientRect().width };
  });
  expect(Math.round(o.sayfa.w)).toBe(Math.round(o.kap.w));
  expect(Math.round(o.sayfa.h)).toBe(Math.round(o.kap.h));
  expect(o.donus).toBe(true);
  expect(o.donusAlt).toBe(16);                           // panelin dibinde (alt dolgu)
  expect(o.kose).toBe(0);                                // köşedeki dönüş gizli
  expect(o.palet).toBe(0);                               // Bileşenler sütunu yok (Canlı Not 22)
  expect(o.yetenek).toBe(0);                             // analizlerin adı yok (Canlı Not 19)
  expect(o.kapi).toEqual(['sihirbaz', 'step', 'bos']);
  expect(o.satir).toBe(o.ornek);                         // açık sekme: araçlar
  expect(o.sekme).toEqual(['Araçlar' + o.ornek, 'Kurgu' + o.kurgu]);
  expect(o.cizim).toBe(0);
  expect(o.acik).toEqual(['siper']);                     // ilk açılışta ilk satır açık
  expect(o.baslik).toBe('Takoz Çökme-Titreşim');
  expect(o.veri).toBe(0);
  expect(o.kunye).toEqual([4, 5, 1]);
  expect(o.kilavuz).toBe('mount');
  expect(o.ray).toBe(0);
  // Kılavuz düğmesi modülün kılavuzunu açar (pencere açmak yerine çağrı yakalanır).
  await page.evaluate(() => { window.veGuideOpen = (id) => { window.__kilavuz = id; }; });
  await page.click('#ve-mnt-baslangic .ve-bas-kilavuz');
  expect(await page.evaluate(() => window.__kilavuz)).toBe('mount');
  expect(await page.evaluate(() => veMntBaslangicAcik())).toBe(true);   // sayfa yerinde
  // Dönüş ana topolojiye götürür; köşedeki düğmenin işi.
  await page.click('#ve-mnt-baslangic .ve-bas-donus');
  await page.waitForFunction(() => veMntStack.length === 0, null, { timeout: 5000 });
  await expect(page.locator('#ve-mnt-baslangic')).toBeHidden();
  expect(await page.evaluate(() => document.getElementById('sayfa2-content').classList.contains('ve-bas-donus-acik'))).toBe(false);
  expect(hatalar).toEqual([]);
});

test('TEKERLEK sayfayı kaydırır, kadrajı oynatmaz', async ({ page }) => {
  // Kısa pencere: panelin içeriği sığmasın (1366×600'de sığıyor — ölçüldü). Panel yan
  // yana düzende sayfanın görünen yüksekliği kadar (Canlı Not 47): sığmayan panel kendi
  // içinde kayar; imlecin altındaki içerik kayar, tuvalin kadrajı oynamaz.
  await page.setViewportSize({ width: 1200, height: 460 });
  await bootApp(page);
  await takozGir(page);
  expect(await page.evaluate(() => { const e = document.querySelector('#ve-mnt-baslangic .ve-bas-panel'); return e.scrollHeight > e.clientHeight; })).toBe(true);
  const once = await page.evaluate(() => ({ z: canvasZoom, x: canvasOffset.x, y: canvasOffset.y }));
  const p = await page.locator('#ve-mnt-baslangic .ve-bas-panel').boundingBox();
  await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(200);
  const sonra = await page.evaluate(() => ({ z: canvasZoom, x: canvasOffset.x, y: canvasOffset.y,
    kay: document.getElementById('ve-mnt-baslangic').scrollTop + document.querySelector('#ve-mnt-baslangic .ve-bas-panel').scrollTop }));
  expect({ z: sonra.z, x: sonra.x, y: sonra.y }).toEqual(once);
  expect(sonra.kay).toBeGreaterThan(0);
});

// PANEL YERİNDE (kullanıcı 2026-11-06, Canlı Not 47): sağdaki değişiklikler kayarken
// soldaki panel (kimlik · kapılar · dizin) yerinde kalır. Önce: 600 px kaydırınca panelin
// tepesi −600 px'teydi, kimlik görünmüyordu.
test('PANEL YERİNDE: değişiklikler kayarken panel tepede, görünen yükseklik kadar; panel üstünde tekerlek sayfayı kaydırır', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 800 });
  await bootApp(page);
  await takozGir(page);
  // sayfanın giriş animasyonu bitsin (ölçek ve saydamlık geçişi kutuları küçük ölçtürür)
  await page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running'));
  // masayı uzat (modüler kopyada derlemenin değişiklik listesi boş): sayfa kaysın
  await page.evaluate(() => { document.querySelector('#ve-mnt-baslangic .ve-bas-masa').insertAdjacentHTML('beforeend', '<div style="height:2000px" aria-hidden="true"></div>'); });
  await expect.poll(() => page.evaluate(() => { const e = document.getElementById('ve-mnt-baslangic'); return e.scrollHeight - e.clientHeight; })).toBeGreaterThan(600);
  const olc = () => page.evaluate(() => {
    const bas = document.getElementById('ve-mnt-baslangic'), B = bas.getBoundingClientRect();
    const P = bas.querySelector('.ve-bas-panel').getBoundingClientRect(), K = bas.querySelector('.ve-bas-kimlik').getBoundingClientRect();
    const D = bas.querySelector('.ve-bas-donus').getBoundingClientRect();
    return { kay: bas.scrollTop, panelUst: Math.round(P.top - B.top), panelH: Math.round(P.height), gorunen: bas.clientHeight,
      kimlik: K.top >= B.top && K.bottom <= B.bottom, donus: D.top >= B.top && D.bottom <= B.bottom };
  });
  await page.evaluate(() => { document.getElementById('ve-mnt-baslangic').scrollTop = 600; });
  const a = await olc();
  expect(a.kay).toBe(600);
  expect(a.panelUst).toBe(0);
  expect(a.panelH).toBe(a.gorunen);
  expect([a.kimlik, a.donus]).toEqual([true, true]);
  // panelin üstündeki tekerlek de sayfayı kaydırır (panel sığıyorsa kendisi kaymaz)
  const p = await page.locator('#ve-mnt-baslangic .ve-bas-panel').boundingBox();
  await page.mouse.move(p.x + p.width / 2, p.y + 200);
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await olc()).kay).toBeLessThan(600);
  expect((await olc()).panelUst).toBe(0);
  // DİZİN KENDİ İÇİNDE KAYAR: örnekler uzayınca panel taşmaz, dönüş dipte görünür
  // kalır (dört gerçek örnekle 800 px'te panel 56 px taşıyordu)
  await page.evaluate(() => {
    const d = document.querySelector('#ve-mnt-baslangic .ve-bas-dizin'), r = d.querySelector('.ve-bas-satir');
    for (let i = 0; i < 8; i++) d.appendChild(r.cloneNode(true));
  });
  const b = await page.evaluate(() => {
    const P = document.querySelector('#ve-mnt-baslangic .ve-bas-panel'), d = P.querySelector('.ve-bas-dizin');
    return { panelTasma: P.scrollHeight - P.clientHeight, dizinKayar: d.scrollHeight > d.clientHeight };
  });
  expect(b).toEqual({ panelTasma: 0, dizinKayar: true });
  expect([(await olc()).kimlik, (await olc()).donus]).toEqual([true, true]);
});

test('BOŞ KANVAS: araçlar kurulur, sayfa çekilir; Ctrl+Z sayfayı geri getirir', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  expect(await page.evaluate(() => document.getElementById('ve-sidebar').offsetWidth)).toBe(0);
  await page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="bos"]');
  await expect(page.locator('#ve-mnt-baslangic')).toBeHidden();
  const s = await page.evaluate(() => ({ tip: nodes.map((n) => n.type).sort(), beklenen: VE_MNT_ARAC_TIPLERI.slice().sort() }));
  expect(s.tip).toEqual(s.beklenen);
  // seçenek seçildi → "Bileşenler" sütunu KAPALI gelir, açma sekmesi köşede (kullanıcı
  // 2026-11-06, Canlı Not 62: *"bileşenler penceresi otomatik açık olarak geliyor.
  // Gelmesin"*; önce tercihe göre açık geliyordu); tercih yazılmaz
  const sutun = () => page.evaluate(() => ({ palet: document.getElementById('ve-sidebar').offsetWidth,
    sekme: document.getElementById('ve-sidebar-reveal').offsetWidth > 0, tercih: localStorage.getItem('mf-sidebar-collapsed') }));
  expect(await sutun()).toEqual({ palet: 0, sekme: true, tercih: null });
  await page.locator('#ve-canvas-wrapper').click({ position: { x: 40, y: 300 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
  expect((await say(page)).hepsi).toBe(0);
  // Takoz'dan çıkınca kullanıcının tercihi (açık) geri gelir
  await page.evaluate(() => veMntCloseEditor());
  await page.waitForTimeout(500);
  const k = await sutun();
  expect(k.palet).toBeGreaterThan(150);
  expect(k.tercih).toBe(null);
});

test('ÖRNEK SATIRI: Yükle TEK TIKLA kurar, sayfa çekilir; Ctrl+Z TEK adımda geri alır', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  await page.evaluate(() => { window.confirm = () => true; });
  // DİZİN: satırın adı yalnız ayrıntıyı açar (model kurulmaz); Yükle tek tıkla kurar
  await page.click('#ve-mnt-baslangic .ve-bas-satir[data-v="tulga"] .ve-bas-satir-ac');
  await expect(page.locator('#ve-mnt-baslangic .ve-bas-satir[data-v="tulga"] .ve-bas-satir-detay')).toBeVisible();
  expect((await say(page)).hepsi).toBe(0);
  await page.click('#ve-mnt-baslangic .ve-bas-satir[data-v="tulga"] .ve-bas-satir-yukle');
  await expect(page.locator('#ve-mnt-baslangic')).toBeHidden();
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'mnt-mount'), null, { timeout: 15000 });
  // Ray geri geldi ve kadraj RAYLI tuvalde kuruldu: hiçbir kutu tuvalin dışında değil.
  // Bileşenler sütunu KAPALI gelir, açma düğmesi köşe hücresinde (Canlı Not 38);
  // kadraj daralmış tuvalde: sütun sığdırmadan sonra daralsaydı model 220 px
  // sola kayık kalırdı (sol boşluk ≈ 90, sağ ≈ 280).
  await page.waitForTimeout(700);
  const k = await page.evaluate(() => {
    const w = document.getElementById('ve-canvas-wrapper').getBoundingClientRect();
    const kut = [...document.querySelectorAll('#ve-canvas .ve-node')].filter((e) => e.offsetWidth > 0).map((e) => e.getBoundingClientRect());
    const dis = kut.filter((b) => b.left < w.left - 1 || b.right > w.right + 1 || b.top < w.top - 1 || b.bottom > w.bottom + 1).length;
    const sol = Math.min(...kut.map((b) => b.left)) - w.left, sag = w.right - Math.max(...kut.map((b) => b.right));
    return { ray: document.getElementById('ve-nav-rail').getBoundingClientRect().width, dis,
      palet: document.getElementById('ve-sidebar').offsetWidth,
      sekme: document.getElementById('ve-sidebar-reveal').offsetWidth > 0, fark: Math.abs(sol - sag) };
  });
  expect({ ray: k.ray, dis: k.dis, palet: k.palet, sekme: k.sekme }).toEqual({ ray: 64, dis: 0, palet: 0, sekme: true });
  expect(k.fark).toBeLessThan(80);
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

// DİZİN (kullanıcı seçimi 2026-11-04, tasarım tuvali "sade seçenekler" · D).
// Node'da koşmayan halkalar: ayrıntının gerçekten görünüp gizlenmesi, açık
// satırın vurgusu ve Yükle'sinin dolu olması (CSS), satırların kutuya sığması.
test('DİZİN: satır açılıp kapanır, açık satır yeniden açılışta yerinde; satırlar kutuya sığar', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await bootApp(page);
  await takozGir(page);
  const acik = () => page.evaluate(() => [...document.querySelectorAll('#ve-mnt-baslangic .ve-bas-satir')]
    .filter((r) => r.querySelector('.ve-bas-satir-detay').offsetHeight > 0).map((r) => r.getAttribute('data-v')));
  expect(await acik()).toEqual(['siper']);
  // Kurgu örnekleri kendi sekmesinde (Canlı Not 6); sekme yalnız örnekleri yeniden basar.
  await page.click('#ve-mnt-baslangic .ve-bas-sekme[data-v="1"]');
  expect(await acik()).toEqual([]);
  await page.click('#ve-mnt-baslangic .ve-bas-satir[data-v="kamyon"] .ve-bas-satir-ac');
  expect(await acik()).toEqual(['kamyon']);
  // Satır YERİNDE açılır, Yükle'nin zemini geçişle dolar (--dur-base): geçiş bitmeden
  // okunan renk başlangıç rengidir
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  const o = await page.evaluate(() => {
    const sayfa = document.getElementById('ve-mnt-baslangic');
    const y = (v) => getComputedStyle(document.querySelector('#ve-mnt-baslangic .ve-bas-satir[data-v="' + v + '"] .ve-bas-satir-yukle')).backgroundColor;
    const kisa = [...sayfa.querySelectorAll('.ve-bas-satir-ac b, .ve-bas-satir-sayi, .ve-bas-satir-kutle, .ve-bas-satir-blok li > *')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
    // Güç grubunun künyesi iki satıra sarar (Canlı Not 28); sığmayan tam metnini title'da taşır
    const kunye = [...sayfa.querySelectorAll('.ve-bas-satir-kunye')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)
      .filter((e) => e.getAttribute('title') !== e.textContent).length;
    return { yatay: sayfa.scrollWidth - sayfa.clientWidth, kisa, kunye, dolu: y('kamyon'), bos: y('hafif'),
      ana: getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim() };
  });
  expect(o.yatay).toBeLessThanOrEqual(0);
  expect(o.kisa).toEqual([]);                            // ad, sayı, kütle, ayrıntı kesilmiyor
  expect(o.kunye).toBe(0);                               // kısalan künye tam metnini title'da taşır
  expect(o.dolu).not.toBe(o.bos);                        // açık satırın Yükle'si dolu
  await page.evaluate(() => { window.confirm = () => true; });
  await page.click('#ve-mnt-baslangic .ve-bas-satir[data-v="hafif"] .ve-bas-satir-yukle');
  await expect(page.locator('#ve-mnt-baslangic')).toBeHidden();
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'mnt-mount'), null, { timeout: 15000 });
  await page.locator('#ve-canvas-wrapper').click({ position: { x: 20, y: 600 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
  expect(await acik()).toEqual(['kamyon']);              // görünüm durumu yerinde: sekme ve satır
  expect(await page.locator('#ve-mnt-baslangic .ve-bas-sekme[aria-selected="true"]').getAttribute('data-v')).toBe('1');
});

// GÖRSELİN BÜYÜĞÜ (Canlı Not 53, kullanıcı 2026-11-06: *"Resimlere tıklanınca
// büyütülebilmesini istiyorum."*). Node'da koşmayan halkalar: gerçek tık, görselin
// dosyasının ölçüsünde açılması (küçük görsel 560 px, pencerede 1120 px), ekrandan
// büyükse oranı korunarak sığması, yerleşim, Esc'in yalnız pencereyi kapatması.
test('GÖRSELİN BÜYÜĞÜ: küçük görsele tık pencerede dosyanın ölçüsünde açar; dar ekranda sığar; Esc kapatır, odak geri döner', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await bootApp(page);
  // modüler kopyada derlemenin listesi boş: bir birleşme ve notunun görseli (1120 × 700 PNG)
  await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1120; c.height = 700;
    const x = c.getContext('2d'); x.fillStyle = '#dde3ea'; x.fillRect(0, 0, 1120, 700); x.fillStyle = '#3b6ea5'; x.fillRect(80, 80, 400, 240);
    window.__MFSIM_BUILD = { moduller: { takoz: [{ prNumber: 9, date: '2026-11-06T10:00:00Z', title: 'Dokuz',
      ayrinti: [{ konu: 'Canlı not 22: palet', govde: ['p'], notlar: [22] }] }] } };
    window.__MFSIM_DEGISIKLIK = { 22: { src: c.toDataURL('image/png'), g: 560, y: 350 } };
  });
  await takozGir(page);
  await page.click('#ve-mnt-baslangic .ve-bas-degisiklik-bas[data-ey="degisiklik"]');
  const kucuk = page.locator('#ve-mnt-baslangic .ve-bas-degisiklik-resim-b');
  await expect(kucuk).toBeVisible();
  expect(await kucuk.evaluate((b) => getComputedStyle(b).cursor)).toBe('zoom-in');
  const k = await kucuk.locator('img').boundingBox();
  await kucuk.click();
  const perde = page.locator('#ve-bas-buyuk-perde');
  await expect(perde).toBeVisible();
  await expect(perde.locator('#ve-bas-buyuk-baslik')).toHaveText('Not 22 sonucu');
  const olc = () => page.evaluate(() => {
    const im = document.querySelector('#ve-bas-buyuk-perde .ve-bas-buyuk-govde img'), r = im.getBoundingClientRect();
    const p = document.querySelector('#ve-bas-buyuk-perde .ve-bas-buyuk-pencere').getBoundingClientRect();
    return { g: Math.round(r.width), y: Math.round(r.height), tam: im.complete && im.naturalWidth === 1120,
      icinde: p.left >= 0 && p.top >= 0 && p.right <= innerWidth && p.bottom <= innerHeight,
      kay: (() => { const g = document.querySelector('#ve-bas-buyuk-perde .ve-bas-buyuk-govde'); return [g.scrollWidth - g.clientWidth, g.scrollHeight - g.clientHeight]; })() };
  });
  await expect.poll(async () => (await olc()).tam).toBe(true);
  const a = await olc();
  expect(Math.round(k.width)).toBe(560);
  expect([a.g, a.y]).toEqual([1122, 702]);            // dosyanın ölçüsü + 1 px çerçeve
  expect(a.icinde).toBe(true);
  expect(a.kay).toEqual([0, 0]);
  await page.evaluate(Y.KAYNAK);
  expect(Y.yerlesimOzet(await page.evaluate(() => window.__yerlesim('#ve-bas-buyuk-perde')), 'Görsel')).toEqual([]);
  // dar ekran: oranı korunarak sığar, pencerede kaydırma yok
  await page.setViewportSize({ width: 900, height: 600 });
  const b = await olc();
  expect(b.icinde).toBe(true);
  expect(b.kay).toEqual([0, 0]);
  expect(b.g).toBeLessThan(a.g);
  expect(Math.abs((b.g - 2) / (b.y - 2) - 1120 / 700)).toBeLessThan(0.02);
  // Esc yalnız pencereyi kapatır: başlangıç sayfası ve modül yerinde, odak küçük görselde
  await page.keyboard.press('Escape');
  await expect(perde).toHaveCount(0);
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
  expect(await kucuk.evaluate((b) => b === document.activeElement)).toBe(true);
  // klavye: Enter açar, ✕ kapatır; perdeye basmak da kapatır
  await page.keyboard.press('Enter');
  await expect(perde).toBeVisible();
  await perde.locator('.ve-settings-close').click();
  await expect(perde).toHaveCount(0);
  await kucuk.click();
  await page.mouse.click(5, 5);
  await expect(perde).toHaveCount(0);
});

// PALET DARALTILMIŞKEN (kullanıcının ekranı). Kullanıcı 2026-11-04: *"sol
// 'Takoz Çökme ve Titreşim' sütununun üstünde iki sembol var. Onları
// kaldıralım. Sadece geriye gelme kalsın … Arada çirkin bir boşluk var."*
// Sayfa açıkken paletin açma sekmesi gizli. Kullanıcı 2026-11-05 (Canlı Not 4):
// *"Yazılar sütunun en tepesine kadar çıkmalı"*; (Canlı Not 19) *"Geri butonunu
// alt taraflara uygun bir yere taşıyalım"* — köşedeki düğme sayfa açıkken
// gizli, kimlik panelin tepesinde ve girintisiz. Model kurulunca sekme ve köşe
// düğmesi geri gelir, düğme sekmenin sağına oturur.
test('DAR PALET: sayfada açma sekmesi ve köşe düğmesi yok; model kurulunca ikisi geri gelir', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await bootApp(page);
  await page.evaluate(() => veToggleSidebar(true));
  await page.waitForTimeout(500);
  await takozGir(page);
  await page.waitForTimeout(500);
  const olc = () => page.evaluate(() => {
    const r = (e) => e.getBoundingClientRect();
    const btn = document.querySelector('#ve-mnt-breadcrumb button'), sekme = document.getElementById('ve-sidebar-reveal');
    const w = r(document.getElementById('ve-canvas-wrapper')), b = r(btn), s = r(sekme);
    const kim = document.querySelector('#ve-mnt-baslangic:not([hidden]) .ve-bas-kimlik');
    const h1 = kim && kim.querySelector('h1');
    const ust = btn.offsetWidth ? document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) : null;
    // Başlığın METNİNİN kutusu.
    const yazi = h1 && (() => { const g = document.createRange(); g.selectNodeContents(h1); return g.getBoundingClientRect(); })();
    return { acik: !!(ust && btn.contains(ust)), kose: btn.offsetWidth, sekme: sekme.offsetWidth, sekmeSag: Math.round(s.right),
      dugmeSol: Math.round(b.left),
      kimlik: kim ? Math.round(r(kim).top - w.top) : null,
      ikon: kim ? kim.querySelectorAll('.ve-bas-kimlik-ik').length : null,
      basSol: yazi ? Math.round(yazi.left - w.left) : null };
  });
  const o = await olc();
  expect({ kose: o.kose, sekme: o.sekme, kimlik: o.kimlik, ikon: o.ikon, basSol: o.basSol })
    .toEqual({ kose: 0, sekme: 0, kimlik: 18, ikon: 0, basSol: 20 });    // panelin tepesinde, girintisiz
  await page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="bos"]');
  await expect(page.locator('#ve-mnt-baslangic')).toBeHidden();
  await page.waitForTimeout(500);
  const k = await olc();
  expect(k.sekme).toBeGreaterThan(0);                    // tuvalde sekme geri geldi
  expect(k.acik).toBe(true);
  expect(k.dugmeSol).toBeGreaterThanOrEqual(k.sekmeSag); // düğme sekmenin sağında
  await page.evaluate(() => veToggleSidebar(false));
});
