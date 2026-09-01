/**
 * fead-checks.spec.js — KATALOGLAR VE ÜÇ KAPI (gerçek tarayıcı)
 *
 * Birim testler kataloğu ve üç kapıyı Node'da doğruluyor. Buradaki soru başka:
 * YÜZEY ayakta mı? Node'da HİÇ koşmayan halkalar —
 *
 *   • motor kataloğunun açılır listesinin DOM'a basılması ve GERÇEK bir
 *     `selectOption` ile künyenin düğüme yazılması,
 *   • aksesuar künyesinin kasnak panelinde seçilmesi ve devir sınırı
 *     alanlarının dolması,
 *   • Uygunluk Kapıları kartının çözüm ÖNCESİNDE çizilmesi (kapılar yerleşim
 *     ve künye verisiyle çözülüyor, çalışma çevrimi gerekmiyor),
 *   • çözümden sonra kapıların `veFeadResults.checks`e yazılması ve raporun
 *     onları YENİDEN HESAPLAMADAN basması.
 *
 * Kapılar birer HTML kartı olduğu için bir sözdizimi ya da kablolama hatası
 * birim testinden geçer, tarayıcıda sessizce boş kart bırakırdı.
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadOpenEditor === 'function' &&
    Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
}

async function openFeadWithExample(page) {
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForFunction(() => Array.isArray(window.nodes), null, { timeout: 20000 });
  await page.evaluate(() => veFeadLoadExample('BMC_FEAD_2026'));
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-alternator'),
    null, { timeout: 20000 });
}

test('katalog seçimi ve üç kapı — panel, çözüm ve rapor', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await openFeadWithExample(page);

  // ── 1) KATALOGLAR YÜKLENDİ Mİ ───────────────────────────────────────────
  const lib = await page.evaluate(() => ({
    motor: typeof veFeadEngineList === 'function' ? veFeadEngineList().length : -1,
    alt: typeof veFeadAccList === 'function' ? veFeadAccList('fead-alternator').length : -1,
    ac: typeof veFeadAccList === 'function' ? veFeadAccList('fead-ac').length : -1,
    kapi: typeof veFeadChecks === 'function',
  }));
  expect(lib.motor).toBe(24);
  expect(lib.alt).toBe(10);
  expect(lib.ac).toBe(4);
  expect(lib.kapi).toBe(true);

  // ── 2) ÇÖZÜCÜ PANELİ: MOTOR KATALOĞU GERÇEK SEÇİMLE ────────────────────
  const solverId = await page.evaluate(() =>
    window.nodes.find((n) => n.type === 'fead-solver').id);
  await page.dblclick('#' + solverId);
  await page.waitForTimeout(400);

  const motorSec = page.locator('select[onchange*="veFeadApplyEngineLib"]');
  await expect(motorSec).toHaveCount(1);
  await motorSec.selectOption('57RS303234');
  await page.waitForTimeout(400);

  const sd = await page.evaluate((id) => {
    const n = window.nodes.find((x) => x.id === id);
    return { lib: n.data.engineLib, cyl: n.data.cylinders, gov: n.data.governedRpm,
             over: n.data.overspeedRpm, crank: n.data.crankOD, fan: n.data.fanOD };
  }, solverId);
  expect(sd.lib).toBe('57RS303234');
  expect(sd.cyl).toBe(6);
  expect(sd.gov).toBe(2100);
  expect(sd.over).toBe(2900);
  expect(sd.crank).toBe(218.3);
  expect(sd.fan).toBe(179.62);

  // ── 3) KASNAK PANELİ: AKSESUAR KÜNYESİ ─────────────────────────────────
  const altId = await page.evaluate(() =>
    window.nodes.find((n) => n.type === 'fead-alternator').id);
  await page.evaluate((id) => {
    const n = window.nodes.find((x) => x.id === id);
    if (typeof showNodeProperties === 'function') showNodeProperties(n);
  }, altId);
  await page.waitForTimeout(300);

  const accSec = page.locator('select[onchange*="veFeadApplyAccLib"]');
  await expect(accSec).toHaveCount(1);
  await accSec.selectOption('57RS309348');
  await page.waitForTimeout(400);

  const ad = await page.evaluate((id) => {
    const n = window.nodes.find((x) => x.id === id);
    return { lib: n.data.accLib, opt: n.data.optimumRpm, cont: n.data.maxContRpm,
             peak: n.data.maxPeakRpm, egri: (n.data.pwrCurve || []).length };
  }, altId);
  expect(ad.lib).toBe('57RS309348');
  expect(ad.opt).toBe(6000);
  expect(ad.cont).toBe(8000);
  expect(ad.peak).toBe(12000);
  expect(ad.egri).toBe(16);

  // Klima kompresörüne de künye ver — ikinci kapı iki aksesuar bekliyor.
  const acId = await page.evaluate(() => window.nodes.find((n) => n.type === 'fead-ac').id);
  await page.evaluate((id) => {
    veFeadApplyAccLib(id, '57RS322530');
  }, acId);
  await page.waitForTimeout(300);

  // ── 4) UYGUNLUK KAPILARI KARTI — ÇÖZÜMDEN ÖNCE ─────────────────────────
  // Çift tık DEĞİL: kasnak panelinin kaplaması açıkken tıklamayı yutuyor.
  // Ölçülen şey kartın kurulması, tıklamanın kendisi değil.
  await page.evaluate((id) => {
    const n = window.nodes.find((x) => x.id === id);
    if (typeof showNodeProperties === 'function') showNodeProperties(n);
  }, solverId);
  await page.waitForTimeout(500);

  const kart = await page.evaluate(() => {
    const el = document.querySelector('[data-ve-fead-checks]');
    if (!el) return null;
    const t = el.textContent || '';
    return {
      durum: el.getAttribute('data-ve-fead-checks-durum'),
      merkez: /Kasnak merkez mesafesi/.test(t),
      oran: /Çevrim oranı penceresi/.test(t),
      devir: /Aksesuar devir sınırı/.test(t),
      tabloSay: el.querySelectorAll('table').length,
      hukum: (t.match(/Kasnak çapı (küçültülmeli|büyütülmeli)|Uygun/g) || []).length,
    };
  });
  expect(kart).not.toBeNull();
  expect(kart.merkez).toBe(true);
  expect(kart.oran).toBe(true);
  expect(kart.devir).toBe(true);
  expect(kart.tabloSay).toBe(3);          // üç kapı, üç tablo
  expect(kart.hukum).toBeGreaterThan(0);

  // Kapıların canlı sonucu — panelin bastığı sayıların kaynağı.
  const canli = await page.evaluate((id) => {
    const n = window.nodes.find((x) => x.id === id);
    const b = veFeadBuildFromCanvas();
    const R = veFeadChecks(b, veFeadCheckOpt(n.data, veFeadDutyRows(n)));
    return {
      merkez: R.centerDistance.durum, oran: R.ratioWindow.durum, devir: R.speedLimit.durum,
      cift: R.centerDistance.rows.length,
      aks: R.ratioWindow.rows.length,
      gov: R.ratioWindow.governedRpm,
    };
  }, solverId);
  expect(canli.cift).toBe(6);
  expect(canli.aks).toBe(2);
  expect(canli.gov).toBe(2100);
  expect(canli.oran).toBe('ok');       // alternatör 7064 d/dk ∈ [6000, 8000]

  // ── KAPILAR BU ÖRNEKTE GERÇEKTEN ISIRIYOR — ölçüldü, beklenti buna göre ──
  //
  // MERKEZ MESAFESİ 'warn': BMC tedarikçi sayfasının kendi düzeninde
  // Avara 2 ↔ Alternatör açıklığı 281,1 mm, üst sınır ise 273,2 mm (alternatör
  // Ø57 olduğu için sınır KIRPI II defterindekinden dar). %2,9 aşım. Tam olarak
  // bu yüzden ihlal 'no' değil 'warn': bu, sahaya çıkmış bir tasarım.
  //
  // DEVİR SINIRI 'no': örneğin çalışma çevrimi 2750 d/dk'ya çıkıyor (payı %5)
  // ve orada alternatör 9250, klima 3559 d/dk dönüyor — ikisi de kendi SÜREKLİ
  // sınırının (8000 / 3000) üstünde. Governed 2100'de ikisi de sınırın altında,
  // yani kapının gösterdiği şey çevrimin tepesi.
  expect(canli.merkez).toBe('warn');
  expect(canli.devir).toBe('no');

  // ── 5) ÇÖZÜM KAPILARI SONUCA YAZIYOR ───────────────────────────────────
  await page.evaluate((id) => veFeadSolve(id), solverId);
  await page.waitForTimeout(800);
  const res = await page.evaluate(() => {
    const R = window.veFeadResults;
    if (!R || !R.checks) return null;
    return { ok: R.ok, merkez: R.checks.centerDistance.durum,
             oran: R.checks.ratioWindow.durum, devir: R.checks.speedLimit.durum,
             gov: R.checkOpt.governedRpm, tepe: R.checkOpt.maxDutyRpm };
  });
  expect(res).not.toBeNull();
  expect(res.ok).toBe(true);
  expect(res.gov).toBe(2100);
  expect(res.tepe).toBe(2750);          // çevrimin süre payı sıfır olmayan tepesi
  expect(res.oran).toBe('ok');
  // Panelde ne gördüysek sonuçta da o var — iki yüzey tek çağrıyı paylaşıyor.
  expect(res.merkez).toBe(canli.merkez);
  expect(res.devir).toBe(canli.devir);

  // ── 6) RAPORUN UYGUNLUK TABLOSU ÜÇ SATIRI DA TAŞIYOR ───────────────────
  const rap = await page.evaluate(() => {
    if (typeof _frCompliance !== 'function') return null;
    const h = _frCompliance(window.veFeadResults);
    return {
      merkez: /Kasnak merkez mesafesi/.test(h),
      oran: /çevrim oranı penceresi/i.test(h),
      devir: /Aksesuar devir sınırı/.test(h),
      bekliyor: (h.match(/değerlendirilemedi/g) || []).length,
      pay: /%/.test(h),
      sinirda: /Sınırda/.test(h),
      kontrol: /Kontrol/.test(h),
    };
  });
  expect(rap).not.toBeNull();
  expect(rap.merkez).toBe(true);
  expect(rap.oran).toBe(true);
  expect(rap.devir).toBe(true);
  expect(rap.pay).toBe(true);
  // 'warn' rozeti tabloda görünüyor ve genel hükmü KIRMIYOR; 'no' kırıyor.
  expect(rap.sinirda).toBe(true);
  expect(rap.kontrol).toBe(true);

  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  SİHİRBAZ — aynı kataloglar, aynı kapılar, kurulmadan ÖNCE
// ═══════════════════════════════════════════════════════════════════════════
// Birim testler durum → düğüm çevirisini Node'da doğruluyor. Buradaki soru
// yine YÜZEY: 6. adımdaki iki açılır listenin DOM'a basılması ve GERÇEK
// `selectOption` ile durumun yazılması, 7. adımdaki kapı kartının çizilmesi,
// ve "Modeli Kur"un altı yeni alanı kanvasa taşıması.
test('sihirbaz — kataloglar, kapılar ve kurulan modele taşınma', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForFunction(() => Array.isArray(window.nodes) && window.nodes.length > 0,
    null, { timeout: 20000 });

  const wizId = await page.evaluate(() => window.nodes.find((n) => n.type === 'fead-wizard').id);
  await page.dblclick('#' + wizId);
  await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible();

  // Örnekten doldur — kapıların üstünde koşacağı gerçek bir düzen.
  await page.evaluate(() => veFeadWizSeed('BMC_FEAD_2026'));
  await page.evaluate(() => veFeadWizGoto(5));            // 6 · Motor ve Çevrim
  await page.waitForTimeout(600);

  // ── MOTOR KATALOĞU: GERÇEK SEÇİM ──────────────────────────────────────
  const motor = page.locator('#ve-fw-body select[onchange*="veFeadWizEngineLib"]');
  await expect(motor).toHaveCount(1);
  await motor.selectOption('57RS303234');
  await page.waitForTimeout(500);

  const s1 = await page.evaluate(() => {
    const s = veFeadWizState().solver;
    return { lib: s.engineLib, cyl: s.cylinders, gov: s.governedRpm,
             over: s.overspeedRpm, crank: s.crankOD, fan: s.fanOD };
  });
  expect(s1.lib).toBe('57RS303234');
  expect(s1.cyl).toBe(6);
  expect(s1.gov).toBe(2100);
  expect(s1.over).toBe(2900);
  expect(s1.crank).toBe(218.3);
  expect(s1.fan).toBe(179.62);

  // Dört devir alanı DOM'da ve dolu.
  const devirler = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#ve-fw-body input'))
      .filter((i) => /idleRpm|governedRpm|noLoadGovernedRpm|overspeedRpm/.test(i.outerHTML))
      .map((i) => i.value));
  expect(devirler).toEqual(['700', '2100', '2330', '2900']);

  // ── AKSESUAR KÜNYELERİ: GERÇEK SEÇİM ──────────────────────────────────
  const kunye = page.locator('#ve-fw-body select[onchange*="veFeadWizAccLib"]');
  expect(await kunye.count()).toBe(2);                 // alternatör + klima
  // SATIR SIRASINA GÜVENİLMİYOR: hangi seçicinin hangi aksesuara ait olduğu,
  // TAŞIDIĞI SEÇENEKLERDEN okunuyor — alternatör listesinde klima künyesi yok.
  await kunye.filter({ has: page.locator('option[value="57RS309348"]') })
    .selectOption('57RS309348');
  await page.waitForTimeout(400);
  await page.locator('#ve-fw-body select[onchange*="veFeadWizAccLib"]')
    .filter({ has: page.locator('option[value="57RS322530"]') })
    .selectOption('57RS322530');
  await page.waitForTimeout(400);

  const p1 = await page.evaluate(() => {
    const p = veFeadWizState().pulleys.find((x) => x.type === 'fead-alternator');
    return { lib: p.accLib, opt: p.optimumRpm, cont: p.maxContRpm,
             peak: p.maxPeakRpm, egri: (p.pwrCurve || []).length };
  });
  expect(p1.lib).toBe('57RS309348');
  expect(p1.opt).toBe(6000);
  expect(p1.cont).toBe(8000);
  expect(p1.peak).toBe(12000);
  expect(p1.egri).toBe(16);

  // ── 7. ADIM: ÜÇ KAPI ──────────────────────────────────────────────────
  await page.evaluate(() => veFeadWizGoto(6));
  await page.waitForTimeout(700);
  const kart = await page.evaluate(() => {
    const el = document.querySelector('[data-ve-fw-checks]');
    if (!el) return null;
    const t = el.textContent || '';
    return {
      durum: el.getAttribute('data-ve-fw-checks-durum'),
      merkez: /Kasnak merkez mesafesi/.test(t),
      oran: /Çevrim oranı penceresi/.test(t),
      devir: /Aksesuar devir sınırı/.test(t),
      tablo: el.querySelectorAll('table').length,
      bos: /undefined|NaN/.test(t),
    };
  });
  expect(kart).not.toBeNull();
  expect(kart.merkez).toBe(true);
  expect(kart.oran).toBe(true);
  expect(kart.devir).toBe(true);
  expect(kart.tablo).toBe(3);
  expect(kart.bos).toBe(false);
  // Ölçülen hüküm: merkez mesafesi sınırda, oran uygun, devir sınırı kontrol
  // istiyor (çevrimin 2750 d/dk tepesi). Panel tarafıyla AYNI sonuç.
  expect(kart.durum).toBe('warn/ok/no');

  // ── "MODELİ KUR": ALTI ALAN KANVASA TAŞINIYOR MU ──────────────────────
  await page.evaluate(() => veFeadWizCreate());
  await page.waitForTimeout(800);
  const kanvas = await page.evaluate(() => {
    const alt = window.nodes.find((n) => n.type === 'fead-alternator');
    const sv = window.nodes.find((n) => n.type === 'fead-solver');
    return {
      accLib: alt && alt.data.accLib, cont: alt && alt.data.maxContRpm,
      peak: alt && alt.data.maxPeakRpm,
      engineLib: sv && sv.data.engineLib, gov: sv && sv.data.governedRpm,
      over: sv && sv.data.overspeedRpm, cyl: sv && sv.data.cylinders,
    };
  });
  expect(kanvas.accLib).toBe('57RS309348');
  expect(kanvas.cont).toBe(8000);
  expect(kanvas.peak).toBe(12000);
  expect(kanvas.engineLib).toBe('57RS303234');
  expect(kanvas.gov).toBe(2100);
  expect(kanvas.over).toBe(2900);
  expect(kanvas.cyl).toBe(6);

  // KURULAN MODELİN KAPILARI SİHİRBAZINKİYLE AYNI — taşımanın asıl ölçümü.
  const kurulan = await page.evaluate(() => {
    const sv = window.nodes.find((n) => n.type === 'fead-solver');
    const b = veFeadBuildFromCanvas();
    const R = veFeadChecks(b, veFeadCheckOpt(sv.data, veFeadDutyRows(sv)));
    return [R.centerDistance.durum, R.ratioWindow.durum, R.speedLimit.durum].join('/');
  });
  expect(kurulan).toBe(kart.durum);

  expect(hatalar).toEqual([]);
});
