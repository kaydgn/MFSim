/**
 * mount-belge.spec.js — ŞANZIMAN AİLESİNİN BELGESİ (gerçek tarayıcı, Canlı Not 52)
 *
 * Kullanıcı 2026-11-06: *"Önce şanzıman ailesi seçeriz, ardından o seçtiğimiz
 * şanzıman ailesine ait PDF açılır ve o PDF üzerinden işaretlemeli şekilde
 * şanzımanın özelliklerini seçeriz."*
 *
 * Node'da HİÇ koşmayan halkalar: listenin gerçek seçimiyle açılış, sayfanın görseli,
 * bölgenin gerçek tıkı ve Özellikler'in yerinde tazelenmesi (belgenin kaydırması
 * korunur), bölüm dizini yok (Canlı Not 75), birbirini dışlayan satırlar ve zorunlu
 * seçimin çizgisi, ön izleme (Canlı Not 73 · 74), Esc'in yalnız belgeyi kapatması,
 * yakınlık, başka birimin seçimiyle kapanma ve yazının kutusuna sığması.
 * Birim tarafı: tests/unit/mount-belge.test.js.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const STEP = require('../helpers/step-takoz.js');
const Y = require('../helpers/yerlesim-olcu.js');
test.setTimeout(180000);

const DIZIN = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-belge-'));
const TULGA = path.join(DIZIN, 'tulga.stp');
test.beforeAll(() => { fs.writeFileSync(TULGA, STEP.tulgaKalibi({ oteleme: STEP.TULGA_OTELEME, onFark: [0, 0, -2], krank: true })); });
test.afterAll(() => { fs.rmSync(DIZIN, { recursive: true, force: true }); });

async function ac(page, g, h) {
  await page.setViewportSize({ width: g, height: h });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.createNode === 'function' && typeof window.veMntOpenEditor === 'function'
    && typeof window.veMntWiz3bBelgeAc === 'function' && typeof window.THREE !== 'undefined' && Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => { try { localStorage.setItem(VE_MW_3B_YAN_ANAHTAR, 'acik'); } catch (e) {} });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; }, null, { timeout: 90000 });
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="step"]')]);
  await fc.setFiles(TULGA);
  await page.waitForFunction(() => { const k = document.getElementById('ve-mw-3b-tuval'); return k && k.getAttribute('data-durum') === 'hazir'; }, null, { timeout: 120000 });
  return page.evaluate(() => {
    const s = veMntWizStp(), i = (a) => s.sonuc.agac.findIndex((d) => d.ad === a);
    veMntWizStpRol(i('Şanzıman gövdesi'), 'mnt-gearbox');
    veMntWizStpRol(i('Motor bloğu'), 'mnt-motor');
    veMntWiz3bSec(i('Şanzıman gövdesi'));
    return { sanz: i('Şanzıman gövdesi'), motor: i('Motor bloğu') };
  });
}
const secenek = (page) => page.evaluate(() => {
  const s = veMntWizStp(), i = s.sonuc.agac.findIndex((d) => d.ad === 'Şanzıman gövdesi');
  return veMntStpVs(s.yogunluk[i], 'mnt-gearbox').secenek;
});

// Sayfaya git: bölüm dizini yok (Canlı Not 75) — belge kaydırılır
const git = (page, no) => page.evaluate((n) => {
  const k = document.querySelector('#ve-mw-3b-belge .ve-mw-3b-belge-kay'), sy = k.querySelector('[data-belge-sayfa="' + n + '"]');
  k.scrollTop = sy.offsetTop - 12;
}, no);

test('BELGE: aile seçilince açılır; bölge tıkı seçeneği yazar, kaydırma yerinde; 7-Speed altı vitesin satırlarını kapatır; Esc · yeniden aç · yakınlık · başka birim', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await ac(page, 1912, 900);
  await expect(page.locator('#ve-mw-3b-belge')).toHaveCount(0);
  // Listenin gerçek seçimi: belge tuvalin üstünde, Özellikler yanda
  await page.selectOption('#ve-mw-3b-veri', 'allison-4000');
  const belge = page.locator('#ve-mw-3b-tuval > #ve-mw-3b-belge');
  await expect(belge).toBeVisible();
  await expect(page.locator('#ve-mw-3b-yan')).toBeVisible();
  await expect(page.locator('#ve-mw-3b-belge-ac')).toHaveAttribute('aria-pressed', 'true');
  await expect(belge.locator('.ve-mw-3b-belge-s')).toHaveCount(12);
  await expect(belge.locator('.ve-mw-3b-belge-ad b')).toHaveText('4000 Product Family Transmission Data');
  // Bant Ürün ağacının bandıyla aynı çizgide; sayfa görseli yüklendi
  const bant = await page.evaluate(() => {
    const a = document.querySelector('#ve-mw-3b-belge .ve-mw-3b-belge-bas').getBoundingClientRect(), b = document.querySelector('#ve-mw-3b-agac .ve-mw-3b-dock-bas').getBoundingClientRect();
    return [Math.round(a.top), Math.round(a.height), Math.round(b.top), Math.round(b.height)];
  });
  expect(bant[0]).toBe(bant[2]); expect(bant[1]).toBe(bant[3]);
  await page.waitForFunction(() => { const im = document.querySelector('#ve-mw-3b-belge [data-belge-sayfa="5"] img'); return im && im.complete && im.naturalWidth === 1275; });
  // Bölüm dizini yok (Canlı Not 75): 12.0 Gear Ratios'a kaydırılır
  expect(await belge.locator('.ve-mw-3b-belge-dizin, [data-belge-git]').count()).toBe(0);
  await git(page, 9);
  const kay = belge.locator('.ve-mw-3b-belge-kay');
  // WIDE-RATIO sütunu: seçenek yazılır, Özellikler'in listesi yerinde, kaydırma korunur
  const cr = belge.locator('[data-belge-b="4-0"]'), wr = belge.locator('[data-belge-b="4-1"]');
  await expect(cr).toHaveAttribute('aria-pressed', 'true');
  await expect(wr).toHaveAttribute('aria-label', 'Vites konfigürasyonu: Wide Ratio (WR)');
  const once = await kay.evaluate((k) => k.scrollTop);
  await wr.click();
  await expect(wr).toHaveAttribute('aria-pressed', 'true');
  await expect(cr).toHaveAttribute('aria-pressed', 'false');
  expect((await secenek(page)).dizi).toBe('wr');
  await expect(page.locator('#ve-mw-3b-alt select[data-mw-vs-secenek="dizi"]')).toHaveValue('wr');
  expect(Math.abs((await kay.evaluate((k) => k.scrollTop)) - once)).toBeLessThanOrEqual(1);
  // Birbirini dışlayan sütunlar (Canlı Not 73 · 74): seçili sütunun tıkı seçimi kaldırmaz, öteki
  // sütun seçilir; kilit yok
  await wr.click();
  await expect(wr).toHaveAttribute('aria-pressed', 'true');
  expect((await secenek(page)).dizi).toBe('wr');
  await expect(cr).not.toHaveAttribute('aria-disabled', 'true');
  await expect(cr).toHaveAttribute('title', 'Vites konfigürasyonu: Close Ratio (CR)');
  await cr.click();
  await expect(cr).toHaveAttribute('aria-pressed', 'true');
  expect((await secenek(page)).dizi).toBe('cr');
  await wr.click();
  expect((await secenek(page)).dizi).toBe('wr');
  // onay kutusu: sütunda başlığın altında ortada, satırda satırın solunda (6 px), dikeyde ortada
  const kutu = await page.evaluate(() => {
    const r = (q) => document.querySelector(q).getBoundingClientRect();
    const b = r('#ve-mw-3b-belge [data-belge-b="4-1"]'), t = r('#ve-mw-3b-belge [data-belge-b="4-1"] .ve-mw-3b-belge-t');
    const s5 = r('#ve-mw-3b-belge [data-belge-b="0-2"]'), t5 = r('#ve-mw-3b-belge [data-belge-b="0-2"] .ve-mw-3b-belge-t');
    const sec = getComputedStyle(document.querySelector('#ve-mw-3b-belge [data-belge-b="4-1"] .ve-mw-3b-belge-t'));
    const bb = (VE_MNT_BELGE['allison-4000'].sayfalar.find((x) => x.no === 9) || {}).bolge[1];
    return { sutun: [Math.abs(Math.round((t.left + t.right) / 2 - (b.left + b.right) / 2)),
      Math.abs(Math.round((t.top + t.bottom) / 2 - b.top - (bb.t[1] - bb.k[1]) / bb.k[3] * b.height)), Math.round(t.width)],
      satir: [Math.round(s5.left - t5.right), Math.round((t5.top + t5.bottom) / 2 - (s5.top + s5.bottom) / 2)], dolu: sec.backgroundColor };
  });
  expect(kutu.sutun).toEqual([0, 0, 14]);
  expect(kutu.satir).toEqual([6, 0]);
  // kutunun kendisine tık da seçer ve kaldırır (Dry Weights · PTO)
  await git(page, 5);
  const pto = belge.locator('[data-belge-b="0-2"]');
  await pto.locator('.ve-mw-3b-belge-t').click();
  expect((await secenek(page)).pto).toBe('1');
  await expect(pto).toHaveAttribute('aria-pressed', 'true');
  await pto.locator('.ve-mw-3b-belge-t').click();
  expect((await secenek(page)).pto).toBe('0');
  await expect(pto).toHaveAttribute('aria-pressed', 'false');
  // Soğutucu sayfası (17.4): tık retarderi de açar
  await git(page, 27);
  await belge.locator('[data-belge-sayfa="27"] [data-belge-b]').click();
  expect(await secenek(page)).toMatchObject({ dizi: 'wr', ret: '1', sog: 'r' });
  // 7-Speed: §9.1'in satırları kapalı, sebebi title'da; §9.2'nin satırı seçilir
  await git(page, 9);
  await belge.locator('[data-belge-b="4-2"]').click();
  expect((await secenek(page)).dizi).toBe('7');
  const p6 = belge.locator('[data-belge-sayfa="6"] [data-belge-b]').nth(2);
  await expect(p6).toBeDisabled();
  await expect(p6).toHaveAttribute('title', 'Vites konfigürasyonu: 7-Speed.');
  await git(page, 7);
  // tablonun başlığı yalnız işaret (tıklanmaz); veri satırı seçer
  expect(await belge.locator('[data-belge-sayfa="7"] [data-belge-y]').count()).toBe(2);
  await belge.locator('[data-belge-sayfa="7"] [data-belge-b]').nth(4).click();     // REMOTE-MOUNT · No Retarder, No PTO
  expect(await secenek(page)).toMatchObject({ dizi: '7', bag: 'u', ret: '0', pto: '0' });
  await expect(belge.locator('[data-belge-sayfa="7"] [data-belge-y]').nth(1)).toHaveClass(/secili/);   // REMOTE-MOUNT başlığı
  // Canlı Not 74: "Birincisi neden seçilmiyor?" — Dry Weights'te altı vitesin satırı 7-Speed'den seçilir
  await git(page, 5);
  const alti = belge.locator('[data-belge-b="0-0"]');
  await expect(alti).toBeEnabled();
  await alti.click();
  expect((await secenek(page)).dizi).toBe('cr');
  await expect(alti).toHaveAttribute('aria-pressed', 'true');
  await expect(belge.locator('[data-belge-b="0-1"]')).toHaveAttribute('aria-pressed', 'false');
  // Canlı Not 73: Retarder Option zorunlu bir soğutucu seçimi taşır — yuvarlak işaret ve çizgi
  const cizgi = belge.locator('[data-belge-grup-ust="0-3"]');
  await expect(cizgi).not.toHaveClass(/etkin/);
  await belge.locator('[data-belge-b="0-3"]').click();
  expect(await secenek(page)).toMatchObject({ ret: '1', sog: 'u' });
  await expect(cizgi).toHaveClass(/etkin/);
  await expect(belge.locator('[data-belge-b="0-5"]')).toHaveAttribute('aria-pressed', 'true');
  const isaret = await page.evaluate(() => {
    const st = (q) => getComputedStyle(document.querySelector('#ve-mw-3b-belge ' + q));
    const b = document.querySelector('#ve-mw-3b-belge [data-belge-b="0-5"]').getBoundingClientRect();
    const c = document.querySelector('#ve-mw-3b-belge [data-belge-grup-ust="0-3"]').getBoundingClientRect();
    return { secili: st('[data-belge-b="0-5"] .ve-mw-3b-belge-t--radyo > i').backgroundColor, bos: st('[data-belge-b="0-4"] .ve-mw-3b-belge-t--radyo > i').backgroundColor,
      yuvarlak: st('[data-belge-b="0-5"] .ve-mw-3b-belge-t').borderTopLeftRadius, renk: st('[data-belge-grup-ust="0-3"]').color,
      vurgu: getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim(), cizgiAlt: Math.round(c.bottom - (b.top + b.bottom) / 2) };
  });
  expect(isaret.bos).toBe('rgba(0, 0, 0, 0)');
  expect(isaret.secili).not.toBe('rgba(0, 0, 0, 0)');
  expect(isaret.yuvarlak).toBe('50%');
  expect(isaret.cizgiAlt).toBe(0);                                                  // çizgi son satırın ortasında biter
  // seçili soğutucunun tıkı kaldırmaz; öteki seçilir
  await belge.locator('[data-belge-b="0-5"]').click();
  expect((await secenek(page)).sog).toBe('u');
  await belge.locator('[data-belge-b="0-4"]').click();
  expect(await secenek(page)).toMatchObject({ ret: '1', sog: 'r' });
  // Ön izleme: Retarder Accumulator'ın üstünde solenoid de seçime girecek gibi görünür; fare çıkınca söner
  await belge.locator('[data-belge-b="0-8"]').hover();
  await expect(belge.locator('[data-belge-b="0-9"]')).toHaveClass(/\bekle\b/);
  await page.mouse.move(5, 5);
  await expect(belge.locator('.ekle, .cikar')).toHaveCount(0);
  // Retarder Option'ın üstünde: soğutucu ve retarderli satırlar düşecek
  await belge.locator('[data-belge-b="0-3"]').hover();
  await expect(belge.locator('[data-belge-b="0-4"]')).toHaveClass(/\bcikar\b/);
  await page.mouse.move(5, 5);
  // Yakınlık: %100'den büyür, Sığdır döner
  const yuzde = () => belge.locator('#ve-mw-3b-belge-yuzde').textContent();
  const y0 = await yuzde();
  await belge.locator('[data-belge-yakin="1"]').click();
  expect(parseInt((await yuzde()).slice(1), 10)).toBeGreaterThan(parseInt(y0.slice(1), 10));
  await belge.locator('[data-belge-yakin="0"]').click();
  expect(await yuzde()).toBe(y0);
  // Yerleşim: bant, sayfalar
  await page.evaluate(Y.KAYNAK);
  expect(Y.yerlesimOzet(await page.evaluate(() => window.__yerlesim('#ve-mw-3b-belge')), 'Belge')).toEqual([]);
  // Esc yalnız belgeyi kapatır; Belge satırı yeniden açar
  await page.keyboard.press('Escape');
  await expect(page.locator('#ve-mw-3b-belge')).toHaveCount(0);
  expect(await page.evaluate(() => veMntWiz3bAcik())).toBe(true);
  await expect(page.locator('#ve-mw-3b-belge-ac')).toHaveAttribute('aria-pressed', 'false');
  await page.click('#ve-mw-3b-belge-ac');
  await expect(page.locator('#ve-mw-3b-belge')).toBeVisible();
  // Liste aynı aileyi yeniden seçse de belge ikinci kez kurulmaz; başka birim seçilince kapanır
  await page.evaluate(() => { const s = veMntWizStp(); veMntWiz3bSec(s.sonuc.agac.findIndex((d) => d.ad === 'Motor bloğu')); });
  await expect(page.locator('#ve-mw-3b-belge')).toHaveCount(0);
  expect(hatalar).toEqual([]);
});

test('DAR TUVAL (1366×768): sayfa genişliği alır; bant ve sayfalar sığar', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await ac(page, 1366, 768);
  await page.selectOption('#ve-mw-3b-veri', 'allison-4000');
  const belge = page.locator('#ve-mw-3b-belge');
  await expect(belge).toBeVisible();
  const o = await page.evaluate(() => {
    const b = document.getElementById('ve-mw-3b-belge'), s = b.querySelector('.ve-mw-3b-belge-s');
    return { g: Math.round(b.getBoundingClientRect().width), sayfa: Math.round(s.getBoundingClientRect().width),
      kay: Math.round(b.querySelector('.ve-mw-3b-belge-kay').clientWidth) };
  });
  expect(o.g).toBeLessThanOrEqual(820);
  expect(o.sayfa).toBe(o.kay - 48);
  await page.evaluate(Y.KAYNAK);
  expect(Y.yerlesimOzet(await page.evaluate(() => window.__yerlesim('#ve-mw-3b-belge')), 'Belge (dar)')).toEqual([]);
  expect(hatalar).toEqual([]);
});
