/**
 * ust-bant.spec.js — ATÖLYE ÜST BANDI
 * ────────────────────────────────────
 *
 * Bant artık komut dizmiyor: NEREDEYİM (marka · modül adı) + NE ARIYORUM
 * (komut arama) + TEK ANA EYLEM (Çöz). Şerit gövdesi varsayılan katlı.
 *
 * O varsayılanın meşruiyeti TEK bir koşula bağlı ve o koşul Node'da kapılı
 * (`tests/unit/komut-kapsami.test.js`): şeritteki her komut palette de var.
 * Burada ölçülen şey YERLEŞİM ve CANLI BAĞ — ikisi de jsdom'da ölçülemez.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BUILD = path.join(__dirname, '../..', 'MFSim_Code.html');

test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});

async function ac(page, modul) {
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForFunction(() => Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  if (modul) {
    await page.click('.ve-module-card[data-module="' + modul + '"]');
    await page.waitForTimeout(1200);
    // FEAD boş topolojiyi SİHİRBAZLA karşılar (modülün kuralı) ve modal bandı
    // ÖRTER. Ölçüm örtüden geçer (`getBoundingClientRect` katman bilmez) ama
    // TIK geçmez — kapıyı yazarken bu fark ölçüldü.
    await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
    await page.waitForTimeout(300);
  }
}

const olc = () => {
  const g = (s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { y: Math.round(b.y), h: Math.round(b.height), w: Math.round(b.width),
             gorunur: b.width > 0 && b.height > 0 };
  };
  const m = document.querySelector('#ve-bant-modul');
  return {
    bant: g('#ve-rb-strip'), serit: g('#ve-ribbon'),
    ara: g('.ve-bant-ara'), coz: g('.ve-bant-ana'), tuval: g('#ve-split-container'),
    modul: m ? m.textContent.trim() : null,
    katli: !!document.querySelector('#ve-ribbon.is-collapsed'),
  };
};

test('şerit gövdesi VARSAYILAN katlı — bant tek satır', async ({ page }) => {
  await ac(page, 'fead-analysis');
  const r = await page.evaluate(olc);
  expect(r.katli).toBe(true);
  // Şeridin tamamı bandın kendisi kadar: gövde gerçekten kapalı
  expect(r.serit.h).toBe(r.bant.h);
  // ve bant maketin havadar satırı — eski 30 px'lik kuşak değil
  expect(r.bant.h).toBeGreaterThanOrEqual(40);
});

test('MODÜL ADI canlı — modülün içinde yazılı, kökte BOŞ', async ({ page }) => {
  await ac(page, null);
  expect((await page.evaluate(olc)).modul).toBe('');   // karşılama: gidilecek modül yok
  await page.click('.ve-module-card[data-module="fead-analysis"]');
  await page.waitForTimeout(1200);
  expect((await page.evaluate(olc)).modul).toBe('FEAD');
});

test('komut arama düğmesi paleti AÇIYOR', async ({ page }) => {
  await ac(page, 'fead-analysis');
  await expect(page.locator('#ve-cmdk-input')).toBeHidden();
  await page.click('.ve-bant-ara');
  await expect(page.locator('#ve-cmdk-input')).toBeVisible();
});

// BANDIN TEK DOLU DÜĞMESİ: ikinci bir dolu düğme "asıl iş hangisi" sorusunu
// geri getirirdi. Ölçüt renk adı değil ZEMİN — aksan jetonuyla boyanmış kaç
// düğme var.
test('bantta TEK dolu düğme var', async ({ page }) => {
  await ac(page, 'fead-analysis');
  const n = await page.evaluate(() => {
    const aksan = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-primary').trim();
    const d = document.createElement('div'); d.style.color = aksan;
    document.body.appendChild(d); const hedef = getComputedStyle(d).color; d.remove();
    let say = 0;
    document.querySelectorAll('#ve-rb-strip button').forEach((b) => {
      if (getComputedStyle(b).backgroundColor === hedef) say++;
    });
    return say;
  });
  expect(n).toBe(1);
});

test('gövde kapalı olunca tuval KAZANIYOR', async ({ page }) => {
  await ac(page, 'fead-analysis');
  const katli = await page.evaluate(olc);
  await page.evaluate(() => veRibbonToggleCollapse());   // gövdeyi AÇ
  await page.waitForTimeout(500);
  const acik = await page.evaluate(olc);
  expect(acik.katli).toBe(false);
  expect(katli.tuval.h - acik.tuval.h).toBeGreaterThan(60);
});
