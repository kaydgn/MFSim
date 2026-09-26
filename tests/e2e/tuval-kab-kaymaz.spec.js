/**
 * tuval-kab-kaymaz.spec.js — TUVAL KABI KAYMAZ, KAMERA KAYAR (gerçek tarayıcı)
 * ───────────────────────────────────────────────────────────────────────────
 * Ölçülen kusur: #ve-canvas-wrapper `overflow:hidden` ama tarayıcı onu yine
 * kaydırıyordu — ekran dışındaki bir öğeye odaklanmak, Ctrl+F, "görünür yap"
 * (Playwright'ın tık öncesi kaydırması da). Kaydırılmış kapta kartlar, ızgara
 * ve minimap birlikte kayıyor (307 × 189 px ölçüldü; minimap tuvalin ORTASINA
 * düşüyordu) ve geri kaydırma yolu yoktu. arac-performans.spec.js:46 bu yüzden
 * aralıklı düşüyordu.
 *
 * Kural (js/canvas-space.js → veKabKaymasiniAktar, ui-core.js'teki dinleyici):
 * kayma kameraya aktarılır, kap 0'a döner; ekrandaki görüntü aynı kalır.
 *
 * Node'da koşamaz: jsdom yerleşim ve kaydırma yapmaz.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BUILD = path.join(__dirname, '../..', 'MFSim_Code.html');
test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});
test.setTimeout(120000);

async function ac(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  page.on('dialog', (d) => d.accept());
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.click('.ve-module-card[data-module="arac-performans"]');
  await page.waitForSelector('#mfsim-module-loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.confirm = () => true; let ex = nodes.find((x) => x.type === 'ap-example'); if (!ex) ex = createNode('ap-example', 300, 200);
    ex.data = ex.data || {}; ex.data.exampleKey = 'isb340_tc411'; veApLoadExample(ex.id); });
  await page.waitForTimeout(2000);
}

const OLC = () => {
  // Minimap kabın sağ alt köşesine tutunur (açık da, kendiliğinden inmiş de
  // olsa): köşeye uzaklığı sabit kalmalı. Kaymış kapta bu uzaklık kayma kadar bozulur.
  const KOSE = () => {
    const kb = document.getElementById('ve-canvas-wrapper').getBoundingClientRect();
    const mb = document.querySelector('.ve-minimap').getBoundingClientRect();
    return [Math.round(kb.right - mb.right), Math.round(kb.bottom - mb.bottom)];
  };
  const w = document.getElementById('ve-canvas-wrapper');
  const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top)]; };
  const n = nodes.find((x) => x.type === 'engine');
  return { kay: [w.scrollLeft, w.scrollTop], ofs: [canvasOffset.x, canvasOffset.y],
    motor: R(document.getElementById(n.id)), mm: KOSE() };
};

test('kodla kaydırılan kap 0\'a döner, kayma kameraya geçer, minimap köşede kalır', async ({ page }) => {
  await ac(page);
  const once = await page.evaluate(OLC);
  expect(once.kay).toEqual([0, 0]);
  await page.evaluate(() => { const w = document.getElementById('ve-canvas-wrapper'); w.scrollLeft = 300; w.scrollTop = 150; });
  await page.waitForTimeout(200);
  const sonra = await page.evaluate(OLC);
  expect(sonra.kay).toEqual([0, 0]);
  // Kap ne kadar kaydıysa kamera o kadar geri gitti.
  expect(sonra.ofs[0] - once.ofs[0]).toBeCloseTo(-300, 0);
  expect(sonra.ofs[1] - once.ofs[1]).toBeCloseTo(-150, 0);
  // Kart ekranda kaydırmanın götürdüğü yerde durur (görüntü sıçramaz)...
  expect(Math.abs(sonra.motor[0] - (once.motor[0] - 300))).toBeLessThanOrEqual(1);
  expect(Math.abs(sonra.motor[1] - (once.motor[1] - 150))).toBeLessThanOrEqual(1);
  // ...ama kabın kendi parçaları (minimap) köşesinden ayrılmaz.
  expect(sonra.mm).toEqual(once.mm);
});

test('ekran dışındaki girdiye odaklanmak: girdi görünür olur, kap kaymaz', async ({ page }) => {
  await ac(page);
  const once = await page.evaluate(OLC);
  // Tuvalin içinde, görünür alanın çok dışında odaklanabilir bir öğe (bir
  // kartın alanı gibi). focus() tarayıcıya onu görünür yaptırır.
  const r = await page.evaluate(() => {
    const i = document.createElement('input');
    i.id = 've-test-uzak-girdi';
    i.style.cssText = 'position:absolute; left:' + (VE_CANVAS_CENTER + 4000) + 'px; top:' + (VE_CANVAS_CENTER + 3000) + 'px; width:80px;';
    document.getElementById('ve-canvas').appendChild(i);
    i.focus();
    return null;
  });
  await page.waitForTimeout(250);
  const sonra = await page.evaluate(() => {
    const w = document.getElementById('ve-canvas-wrapper');
    const kb = w.getBoundingClientRect(), ib = document.getElementById('ve-test-uzak-girdi').getBoundingClientRect();
    return { kay: [w.scrollLeft, w.scrollTop],
      gorunur: ib.left >= kb.left - 1 && ib.right <= kb.right + 1 && ib.top >= kb.top - 1 && ib.bottom <= kb.bottom + 1,
      odak: document.activeElement && document.activeElement.id,
      mm: (() => { const mb = document.querySelector('.ve-minimap').getBoundingClientRect(); return [Math.round(kb.right - mb.right), Math.round(kb.bottom - mb.bottom)]; })() };
  });
  expect(r).toBeNull();
  expect(sonra.odak).toBe('ve-test-uzak-girdi');
  expect(sonra.kay).toEqual([0, 0]);
  expect(sonra.gorunur).toBe(true);
  expect(sonra.mm).toEqual(once.mm);
});
