/**
 * mount-topoloji.spec.js — TAKOZ TOPOLOJİSİNİN ÇİZİMİ (gerçek tarayıcı)
 * ─────────────────────────────────────────────────────────────────────────
 * Tur 6 (2026-10-15) ölçümü, üç örnek (Tulga · Siper · ASFAT):
 *   · ŞASİ çerçevesi gövde KUTULARINDAN kuruluyordu, adları saymıyordu —
 *     kutular kenardan 26 px içerideyken kutudan geniş ad ("Ön Takoz
 *     Braketi") kenara 4 px kalıyordu; ana tuvalin sınır çerçevesi adı
 *     sayıyor (`veNodeLabelOverflow`)
 *   · aktarma hattı omurgası merkezden merkeze çiziliyordu: çizgi motorun,
 *     şanzımanın ve transferin kutusunun ve ikonunun üstünden geçiyordu
 * Node'da koşamaz: adın ölçüsü DOM'dan (`offsetWidth`), çizim connections
 * SVG'sinde. Adların birbirine değmemesi ortak turda (yuzey-turu.js).
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

async function bootApp(page) {
  await page.setViewportSize({ width: 1920, height: 952 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veMntLoadExample === 'function' &&
    typeof window.veMntDecorateConnections === 'function' && Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
}

// EKRAN koordinatında ölçülür: ad `translateX(-50%)` ile ortalanıyor ve
// offsetLeft dönüşümü görmez; çizgi uçları SVG'nin ekran matrisinden.
const OLC = () => {
  const govde = nodes.filter((n) => (componentDefs[n.type] || {}).isMountBody);
  const g = document.querySelector('g.ve-mnt-chassis');
  const r = g && g.querySelector('rect');
  const cer = r ? r.getBoundingClientRect() : null;
  const disarida = [];
  const zoom = (typeof canvasZoom !== 'undefined' && canvasZoom > 0) ? canvasZoom : 1;
  govde.forEach((n) => {
    const el = document.getElementById(n.id), l = el && el.querySelector('.ve-node-label');
    if (!l || !l.offsetWidth || !cer) return;
    const q = l.getBoundingClientRect();
    const pay = Math.min(q.left - cer.left, cer.right - q.right, q.top - cer.top, cer.bottom - q.bottom);
    // Ad da kutular kadar içeride (çerçevenin payı 26 px; zoom ile ölçeklenir)
    if (pay < 20 * zoom) disarida.push((n.customName || n.type) + ' ' + Math.round(pay) + ' px');
  });
  // omurga çizgileri gövde kutusunun İÇİNDEN geçmez (uçlar kenarda)
  const kesen = [];
  [...(g ? g.querySelectorAll(':scope > line') : [])].forEach((ln) => {
    const m = ln.getScreenCTM();
    const nok = (x, y) => new DOMPoint(x, y).matrixTransform(m);
    const a = nok(+ln.getAttribute('x1'), +ln.getAttribute('y1')), b = nok(+ln.getAttribute('x2'), +ln.getAttribute('y2'));
    govde.forEach((n) => {
      const k = document.getElementById(n.id).getBoundingClientRect(), p = 1.5;
      for (let i = 1; i < 40; i++) {
        const t = i / 40, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        if (x > k.left + p && x < k.right - p && y > k.top + p && y < k.bottom - p) { kesen.push(n.customName || n.type); break; }
      }
    });
  });
  return { cer: !!cer, ad: govde.length, disarida, kesen: [...new Set(kesen)], cizgi: g ? g.querySelectorAll(':scope > line').length : 0 };
};

for (const ornek of ['tulga', 'siper', 'asfat']) {
  test(`${ornek}: ŞASİ çerçevesi adları da sarar, omurga kutuların içinden geçmez`, async ({ page }) => {
    await bootApp(page);
    await page.evaluate((k) => {
      const ex = createNode('mnt-example', 300, 200);
      ex.data = ex.data || {}; ex.data.exampleKey = k; veMntLoadExample(ex.id);
    }, ornek);
    await page.waitForFunction(() => nodes.some((n) => n.type === 'mnt-solver'), null, { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => { if (typeof updateAllConnections === 'function') updateAllConnections(); });
    const r = await page.evaluate(OLC);
    expect(r.cer).toBe(true);
    expect(r.ad).toBeGreaterThan(3);
    expect(r.cizgi).toBeGreaterThan(0);
    expect.soft(r.disarida).toEqual([]);
    expect.soft(r.kesen).toEqual([]);
  });
}
