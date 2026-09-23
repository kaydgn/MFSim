/**
 * tablo-pencere.spec.js — SÜTUNA SIĞMAYAN TABLO AÇILIR PENCEREDE
 * ─────────────────────────────────────────────────────────────
 *
 * Kullanıcı isteği (2026-09-23, Çözücü penceresinin ekran görüntüsüyle):
 * *"geniş tablolar bileşen pencerelerine sığmıyor. Bu pencereleri açılır ufak
 * pencereler şeklinde yapmamız gerekiyor. Kullanıcı çok daha kolay bu
 * tabloları doldurur."*
 *
 * Ölçülen iki kusur (380 px'lik sütun, üç modülün bütün pencereleri, HER
 * sekme): FEAD Çözücü'nün çalışma çevrimi tablosu 1162 px / görünen 359 px;
 * AP motor-şanzıman eşleştirme tablosu 337 / 335 px ("Seç" düğmesi tablonun
 * 2,2 px dışında). Eski sığma taraması yalnız AÇILIŞ sekmesini ölçüyordu —
 * çevrim tablosu "Çevrim" sekmesinde olduğu için hiç görülmedi.
 *
 * Node'da koşamaz: jsdom `scrollWidth`i hep 0 döndürür, `ResizeObserver`ı
 * yoktur ve bir yazının hangi katmanın üstünde olduğunu bilmez.
 * Mekanizmanın birim kapısı: tests/unit/tablo-pencere.test.js.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BUILD = path.join(__dirname, '../..', 'MFSim_Code.html');
test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});
test.setTimeout(180000);

async function modulAc(page, modul, ornek) {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e.message)));
  page.on('dialog', (d) => d.accept());
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.click(`.ve-module-card[data-module="${modul}"]`);
  await page.waitForSelector('#mfsim-module-loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(ornek);
  await page.waitForTimeout(2500);
  return hatalar;
}
const FEAD = "if (typeof veFeadWizClose === 'function') veFeadWizClose(false); veFeadLoadExample('AG00976_GATES_2025');";
const AP = "let ex = nodes.find((x) => x.type === 'ap-example'); if (!ex) ex = createNode('ap-example', 300, 200);"
  + " ex.data = ex.data || {}; ex.data.exampleKey = 'isb340_tc411'; veApLoadExample(ex.id);";

// Açık pencerenin HER sekmesinde, içeride yatay kayan bir kap var mı.
const yatayKayanlar = async (tip) => {
  const n = nodes.find((x) => x.type === tip) || createNode(tip, 900, 800);
  clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
  await new Promise((r) => setTimeout(r, 700));
  const ic = document.querySelector('.ve-properties-content');
  const out = [];
  const sekmeler = [...ic.querySelectorAll('.ve-fp-tab')].map((t) => t.getAttribute('data-k'));
  for (const k of (sekmeler.length ? sekmeler : [null])) {
    if (k) { veFeadPanelTab(n.id, k); await new Promise((r) => setTimeout(r, 120)); }
    ic.querySelectorAll('*').forEach((el) => {
      if (!el.offsetWidth || el === ic) return;
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1)
        out.push(`${tip}${k ? ':' + k : ''} ${el.scrollWidth}/${el.clientWidth} px`);
    });
  }
  veTogglePropertiesPanel(false);
  await new Promise((r) => setTimeout(r, 250));
  return out;
};

test('sütunda YATAY KAYDIRMA YOK — FEAD pencerelerinin her sekmesi', async ({ page }) => {
  await modulAc(page, 'fead-analysis', FEAD);
  const tipler = await page.evaluate(() => [...new Set(nodes.map((n) => n.type))].filter((t) => /^fead-/.test(t)));
  expect(tipler.length).toBeGreaterThanOrEqual(10);        // tarama gerçekten açıyor
  const fead = [];
  for (const t of tipler) fead.push(...await page.evaluate(yatayKayanlar, t));
  // Eski hâl: "fead-solver:cev 1162/359 px".
  expect(fead).toEqual([]);
});

test('sütunda YATAY KAYDIRMA YOK — AP motor-şanzıman eşleştirme', async ({ page }) => {
  await modulAc(page, 'arac-performans', AP);
  // Eski hâl: "engine-gearbox-matching 337/335 px" — "Seç" düğmesi tablonun dışında.
  expect(await page.evaluate(yatayKayanlar, 'engine-gearbox-matching')).toEqual([]);
});

test('çalışma çevrimi: kart → küçük pencere → hücre modeli yazar → satır eklenir → TEK ESC', async ({ page }) => {
  const hatalar = await modulAc(page, 'fead-analysis', FEAD);
  const id = await page.evaluate(() => {
    const n = nodes.find((x) => x.type === 'fead-solver');
    clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
    return n.id;
  });
  await page.waitForTimeout(700);
  await page.evaluate((i) => veFeadPanelTab(i, 'cev'), id);
  await page.waitForTimeout(300);

  // 1) SÜTUNDA: tablo katlı, yerinde özet kartı.
  const sutun = await page.evaluate(() => {
    const ic = document.querySelector('.ve-properties-content');
    const birim = ic.querySelector('[data-ve-tablo^="fead-duty:"]');
    const kart = ic.querySelector('.ve-tablo-kart');
    return { birimGizli: getComputedStyle(birim).display === 'none', kart: kart && !kart.hidden,
             kartYazi: kart && kart.querySelector('b').textContent };
  });
  expect(sutun.birimGizli).toBe(true);
  expect(sutun.kart).toBe(true);
  expect(sutun.kartYazi).toMatch(/^\d+ devir noktası$/);

  // 2) PENCERE: küçük, tablonun tamamı kaydırmasız görünüyor, müfettişin ÜSTÜNDE.
  await page.click('.ve-properties-content .ve-tablo-ac');
  await page.waitForTimeout(300);
  const pen = await page.evaluate(() => {
    const p = document.querySelector('.ve-tablo-pencere');
    const r = p.getBoundingClientRect();
    const duty = p.querySelector('.ve-fp-duty');
    const ust = document.elementFromPoint(r.left + r.width / 2, r.top + 20);
    return { w: r.width, vw: innerWidth, yatay: duty.scrollWidth - duty.clientWidth,
             ustte: !!(ust && ust.closest('.ve-tablo-pencere')),
             odak: !!(document.activeElement && document.activeElement.closest('.ve-tablo-pencere')),
             satir: p.querySelectorAll('tbody tr').length };
  });
  expect(pen.w).toBeLessThan(pen.vw * 0.6);      // "ufak pencere" — eskiden 1517/1600 px
  expect(pen.yatay).toBeLessThanOrEqual(0);      // tablonun tamamı görünüyor
  expect(pen.ustte).toBe(true);                  // müfettişin üstünde
  expect(pen.odak).toBe(true);                   // klavye pencerede başlıyor

  // 3) Hücre modeli yazıyor (aynı DOM, aynı olay işleyicisi).
  const hucre = page.locator('.ve-tablo-pencere tbody tr').first().locator('input').nth(2);
  await hucre.fill('97');
  await hucre.press('Tab');
  expect(await page.evaluate((i) => Number(nodes.find((x) => x.id === i).data.duty[0].degC), id)).toBe(97);

  // 4) Satır pencereden eklenir ve pencere AÇIK kalır (panel yeniden çizilir).
  await page.click('.ve-tablo-pencere .ve-fp-dugme');
  await page.waitForTimeout(400);
  const ekle = await page.evaluate((i) => ({ acik: !!document.querySelector('.ve-tablo-pencere'),
    satir: document.querySelectorAll('.ve-tablo-pencere tbody tr').length,
    model: nodes.find((x) => x.id === i).data.duty.length }), id);
  expect(ekle.acik).toBe(true);
  expect(ekle.satir).toBe(pen.satir + 1);
  expect(ekle.model).toBe(pen.satir + 1);

  // 5) TEK ESC = TEK KATMAN: pencere kapanır, müfettiş AÇIK kalır.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const esc = await page.evaluate(() => ({ pencere: !!document.querySelector('.ve-tablo-pencere'),
    mufettis: document.getElementById('ve-properties-overlay').classList.contains('visible'),
    odak: document.activeElement && document.activeElement.className }));
  expect(esc).toEqual({ pencere: false, mufettis: true, odak: 've-tablo-ac' });

  // 6) Hata yok — ResizeObserver döngüsü bir kez "Beklenmeyen hata" diye
  //    kullanıcıya gösterildi (ölçüldü).
  expect(hatalar).toEqual([]);
  expect(await page.evaluate(() => [...document.querySelectorAll('.ve-toast, .toast')]
    .map((t) => t.textContent).filter((t) => /ResizeObserver|Beklenmeyen/.test(t)))).toEqual([]);
});
