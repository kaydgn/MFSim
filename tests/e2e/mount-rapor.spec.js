/**
 * mount-rapor.spec.js — TAKOZ RAPORUNUN ŞEKİLLERİ (gerçek tarayıcı, indirilen belge)
 * ─────────────────────────────────────────────────────────────────────────
 * Tur 6 (2026-10-15) ölçümü — belge ekran kapısının (yerlesim.spec) dışında
 * kalıyordu, şekillerinde çizgi yazıyı kesiyordu:
 *   · Şekil 1: düşey eksen "RİJİT GÖVDE"nin ve alt yazının, yatay eksen
 *     "G"nin içinden geçiyordu
 *   · Şekil 2/3: takoz kareleri ve gövde daireleri komşu adların üstünde
 *   · mod şekilleri: gövde kutusunun kenarı "G"nin içinden
 *   · Şekil 5: ızgara "T = 1 (izolasyon yok)" yazısının içinden
 * Ayrıca her şekil SVG'si çizim taşımalı: SVG yazısına giren HTML öğesi
 * ayrıştırıcıyı SVG'den çıkarıyor, çizim siliniyor ve yazı ölçeri bunu görmüyor.
 * Node'da koşamaz: SVG'de çizginin yazıyı kesmesi `getPointAtLength` ve
 * `isPointInFill` ile, gerçek yerleşimde ölçülür. Mantık tarafı:
 * tests/unit/mount-rapor-doku.test.js.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const Y = require('../helpers/yerlesim-olcu.js');

const BUILD = process.env.MFSIM_OLCUM_HTML || path.join(__dirname, '../..', 'MFSim_Code.html');
test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});
test.setTimeout(420000);

const ORNEK = [['tulga', 'Ön Takoz Braketi'], ['siper', 'cradle'], ['asfat', '57RS']];

test('Takoz raporu: çizgi yazıyı kesmiyor, yazı yazıya binmiyor, sözcük bölünmüyor, küçük yazı yok — üç örnek', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1920, height: 1032 });
  page.on('dialog', (d) => d.accept());
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.click('.ve-module-card[data-module="mount-analysis"]');
  await page.waitForSelector('#mfsim-module-loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  const out = [];
  for (const [k, imza] of ORNEK) {
    await page.evaluate((kk) => {
      let ex = nodes.find((x) => x.type === 'mnt-example'); if (!ex) ex = createNode('mnt-example', 300, 200);
      ex.data = ex.data || {}; ex.data.exampleKey = kk; veMntLoadExample(ex.id);
    }, k);
    await page.waitForFunction((im) => nodes.some((n) => (n.customName || '').indexOf(im) >= 0), imza, { timeout: 20000 });
    await page.evaluate(() => { window._veMntLast = null; const s = nodes.find((x) => x.type === 'mnt-solver'); veMntSolverCompute(s.id); });
    await page.waitForFunction(() => typeof _veMntLast !== 'undefined' && _veMntLast && !_veMntLast.error, null, { timeout: 120000 });
    const html = await page.evaluate(() => new Promise((ok) => _mntReportEnsureAssets(() => {
      const n = nodes.find((x) => x.type === 'mnt-report');
      ok(_mntBuildReportHTML(_veMntLast, veMntRaporOpts(n && n.id)));
    })));
    const p = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
    await p.setContent(html, { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    // Ölçer görüş alanındaki yazıyı sayar: görüş alanı belgenin boyunda
    const boy = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.setViewportSize({ width: 1100, height: Math.min(boy + 20, 32000) });
    await p.waitForTimeout(500);
    // ÇİZİM YERİNDE: SVG'ye giren bir HTML öğesi ayrıştırıcıyı SVG'den çıkarır,
    // çizim kaybolur ve yazı ölçeri bunu GÖRMEZ (kalan yazı temiz ölçülür)
    const bos = await p.evaluate(() => [...document.querySelectorAll('figure svg')]
      .filter((sv) => !sv.querySelector('rect, line, path, circle, polyline, polygon'))
      .map((sv) => (sv.textContent || '').trim().slice(0, 40)));
    bos.forEach((x) => out.push(k + ' · çizimi olmayan şekil "' + x + '"'));
    await p.evaluate(Y.KAYNAK);
    const r = await p.evaluate(() => window.__yerlesim('body'));
    await p.close();
    expect(r.olculen).toBeGreaterThan(2000);          // belgenin TAMAMI (görüş alanı değil)
    Y.yerlesimOzet(r, k).forEach((x) => out.push(x));
  }
  expect(out).toEqual([]);
});
