/**
 * minimap-ortmez.spec.js — MİNİMAP İÇERİĞİ ÖRTMEZ (gerçek tarayıcı)
 * ───────────────────────────────────────────────────────────────────────────
 * Ölçülen kusur (doku haritası K5): 1366×657'lik pencerede (Edge'de 1366×768
 * ekran) üç modülün 29 örneği × kasnak paneli kapalı/açık = 58 durumun 13'ünde
 * minimap bir denetimi ya da kart adını örtüyordu: FEAD'de 2 örnekte kart
 * çubuğunun düğmeleri (panel kapalı da açık da), AP'de 7 örnekte lastik
 * kartının adı, Takoz'da 2 örnekte bir kartın adı. 1920×945'te 0. Soluk
 * durmak yetmiyordu: soluk kutu tıklamayı yine yutuyor.
 *
 * Sayılan şey GÖRÜNEN denetim: kaydırma kabının dışına taşan satır zaten
 * görünmez, onun kutusu köşeye düşse de sayılmaz. Örtülü = kesişimin
 * ortasında en üstteki öğe minimapın kendisi.
 *
 * Node'da koşamaz: jsdom yerleşim ve `elementFromPoint` hesaplamaz. Mantığın
 * birim kapısı tests/unit/minimap-ortmez.test.js.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BUILD = path.join(__dirname, '../..', 'MFSim_Code.html');
test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});
test.setTimeout(180000);

// Minimapın örttüğü GÖRÜNEN denetimler (adlarıyla).
const ORTULEN = () => {
  const mm = document.getElementById('ve-minimap');
  const r = mm.getBoundingClientRect();
  if (r.width < 2 || getComputedStyle(mm).display === 'none') return [];
  const ad = [];
  document.querySelectorAll('button, select, input, [role=button], .ve-node, .ve-node-label, a[href]').forEach((el) => {
    if (mm.contains(el)) return;
    const q0 = el.getBoundingClientRect();
    if (q0.width < 2 || q0.height < 2) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    const q = { l: q0.left, t: q0.top, r: q0.right, b: q0.bottom };
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ac = getComputedStyle(a);
      if (ac.overflowX === 'visible' && ac.overflowY === 'visible') continue;
      const k = a.getBoundingClientRect();
      q.l = Math.max(q.l, k.left); q.t = Math.max(q.t, k.top); q.r = Math.min(q.r, k.right); q.b = Math.min(q.b, k.bottom);
    }
    const l = Math.max(r.left, q.l), t = Math.max(r.top, q.t), rr = Math.min(r.right, q.r), b = Math.min(r.bottom, q.b);
    if (rr - l <= 2 || b - t <= 2) return;
    const ust = document.elementFromPoint((l + rr) / 2, (t + b) / 2);
    if (ust && mm.contains(ust)) ad.push((el.getAttribute('aria-label') || el.title || (el.innerText || '').split('\n')[0] || el.className).toString().trim().slice(0, 30));
  });
  return ad;
};
const DURUM = () => document.getElementById('ve-minimap').className;

async function ac(page, W, H, modul) {
  await page.setViewportSize({ width: W, height: H });
  page.on('dialog', (d) => d.accept());
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.evaluate(() => { try { localStorage.removeItem('veMinimapCollapsed'); } catch (e) {} });
  await page.click(`.ve-module-card[data-module="${modul}"]`);
  await page.waitForSelector('#mfsim-module-loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
}
async function feadOrnek(page, anahtar) {
  await page.evaluate((k) => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); veFeadLoadExample(k); }, anahtar);
  await page.waitForFunction(() => nodes.some((n) => /^fead-/.test(n.type) && n.data && n.data.od), null, { timeout: 15000 });
  await page.waitForTimeout(900);
}
async function kasnakPaneli(page, acik) {
  await page.evaluate((acik) => {
    if (acik) { const n = nodes.find((x) => veIsCanvasHidden(x)); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); }
    else { veTogglePropertiesPanel(false); clearSelection(); }
  }, acik);
  await page.waitForTimeout(700);
}

test('1366 genişliğinde FEAD: kasnak paneli kapalı da açık da olsa minimap denetim örtmüyor', async ({ page }) => {
  await ac(page, 1366, 657, 'fead-analysis');
  const sonuc = {};
  // İkisi de düzeltmeden önce iki hâlde de örtülüydü (3 · 4 ve 3 · 3 denetim).
  for (const k of ['AG00976_GATES_2025', 'AG00879_GATES_2023']) {
    await feadOrnek(page, k);
    sonuc[k + ' · panel kapalı'] = await page.evaluate(ORTULEN);
    await kasnakPaneli(page, true);
    sonuc[k + ' · panel açık'] = await page.evaluate(ORTULEN);
    // Panel açılınca tuval daralıyor ve kamera yerinde kalıyor: kutu pencere
    // boyu değişmeden gelen bir ölçümle (gözlemci) iniyor.
    sonuc[k + ' · minimap'] = await page.evaluate(DURUM);
    await kasnakPaneli(page, false);
  }
  for (const [k, v] of Object.entries(sonuc)) {
    if (/minimap$/.test(k)) expect(v, k).toMatch(/collapsed.*oto|oto.*collapsed/);
    else expect(v, k).toEqual([]);
  }
});

test('1366 genişliğinde AP ve Takoz: kartın adı minimapın altında kalmıyor', async ({ page, browser }) => {
  await ac(page, 1366, 657, 'arac-performans');
  await page.evaluate(() => { let ex = nodes.find((x) => x.type === 'ap-example'); if (!ex) ex = createNode('ap-example', 300, 200);
    ex.data = ex.data || {}; ex.data.exampleKey = 'bmc10ton_380_32t'; veApLoadExample(ex.id); });
  await page.waitForTimeout(2000);
  expect(await page.evaluate(ORTULEN), 'AP bmc10ton_380_32t').toEqual([]);

  const p2 = await browser.newPage();
  await ac(p2, 1366, 657, 'mount-analysis');
  for (const k of ['siper', 'tulga']) {
    await p2.evaluate((k) => { let ex = nodes.find((x) => x.type === 'mnt-example'); if (!ex) ex = createNode('mnt-example', 300, 200);
      ex.data = ex.data || {}; ex.data.exampleKey = k; veMntLoadExample(ex.id); }, k);
    await p2.waitForTimeout(2200);
    expect(await p2.evaluate(ORTULEN), 'Takoz ' + k).toEqual([]);
  }
  await p2.close();
});

test('köşe boşsa minimap AÇIK kalıyor (her zaman inen bir kutu düzeltme değil)', async ({ page }) => {
  await ac(page, 1920, 945, 'fead-analysis');
  await feadOrnek(page, 'AG00976_GATES_2025');
  expect(await page.evaluate(DURUM)).not.toContain('collapsed');
  expect(await page.evaluate(ORTULEN)).toEqual([]);
});

test('oto inmiş kutu düğmeyle açılır; köşe boşalınca istek söner; kullanıcının indirdiği kutu inik kalır', async ({ page }) => {
  await ac(page, 1366, 657, 'fead-analysis');
  await feadOrnek(page, 'AG00976_GATES_2025');
  const kaydir = (dx) => page.evaluate((dx) => { canvasOffset.x += dx; updateCanvasTransform(); }, dx).then(() => page.waitForTimeout(400));
  const tercih = () => page.evaluate(() => localStorage.getItem('veMinimapCollapsed'));

  expect(await page.evaluate(DURUM)).toMatch(/collapsed.*oto|oto.*collapsed/);
  expect(await tercih(), 'oto iniş tercihi yazmaz').toBeNull();

  await page.click('#ve-minimap-toggle');                  // istek: içerik altında olsa da göster
  await page.waitForTimeout(300);
  expect(await page.evaluate(DURUM)).not.toContain('collapsed');
  expect(await tercih()).toBe('0');

  await kaydir(-2400);                                      // köşe boşaldı → istek yerine geldi
  expect(await page.evaluate(DURUM)).not.toContain('collapsed');
  await kaydir(2400);                                       // içerik geri geldi → yine iner
  expect(await page.evaluate(DURUM)).toContain('oto');

  await page.click('#ve-minimap-toggle');                  // aç
  await page.waitForTimeout(300);
  await page.click('#ve-minimap-toggle');                  // kullanıcı indirdi
  await page.waitForTimeout(300);
  expect(await tercih()).toBe('1');
  await kaydir(-2400);
  const d = await page.evaluate(DURUM);
  expect(d).toContain('collapsed');
  expect(d).not.toContain('oto');
});
