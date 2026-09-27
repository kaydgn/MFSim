/**
 * sayi-alan.spec.js — TÜRKÇE SAYI ALANI, GERÇEK TARAYICIDA (karar 7·C)
 * ─────────────────────────────────────────────────────────────────────
 *
 * ÖLÇÜLEN KUSUR (2026-09-27): `type="number"` alan virgülü tanımıyordu.
 * Üç modülün 55 penceresindeki 520 düzenlenebilir sayı alanının 520'si
 * "12,5" yazılınca 125 okuyordu, "1.716,2" yazılınca 1,7162 — ikisi de
 * sessiz. Araç penceresinde Cd'ye "0,65" yazan kullanıcı modele 65
 * yazıyordu. Alan artık `type="text" inputmode="decimal"` ve js/sayi-alan.js
 * onu Türkçe gösterip `.value`'yu makine biçiminde veriyor.
 *
 * Node'da koşmayan halkalar: GERÇEK klavye (virgül tuşu), tarayıcının kendi
 * `insertText` komutuyla yapıştırma, işleyicinin (satır içi `onchange`)
 * sayıyı modele yazması, üretilen tek dosyalarda katmanın gerçekten yüklü
 * olması (MFSim + Ölçüm Görüntüleyici).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const KOK = path.join(__dirname, '../..');
const BUILD = path.join(KOK, 'MFSim_Code.html');
const VIEWER = path.join(KOK, 'MFSim_Olcum_Goruntuleyici.html');
test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});
test.setTimeout(120000);

const ac = async (page, modul, ornek) => {
  await page.setViewportSize({ width: 1920, height: 1032 });
  page.on('dialog', (d) => d.accept());
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.click(`.ve-module-card[data-module="${modul}"]`);
  await page.waitForSelector('#mfsim-module-loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(ornek);
  await page.waitForTimeout(3000);
};
const pencere = async (page, tip) => {
  const id = await page.evaluate((tip) => {
    let n = nodes.find((x) => x.type === tip);
    if (!n) n = createNode(tip, 300, 700);
    clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
    return n.id;
  }, tip);
  await page.waitForTimeout(500);
  return id;
};
const yaz = async (page, sec, metin) => {
  await page.click(sec);
  await page.keyboard.press('Control+A');
  await page.keyboard.type(metin);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
};
const gorunen = (page, sec) => page.$eval(sec, (e) =>
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get.call(e));
const yapistir = (page, sec, metin) => page.$eval(sec, (e, metin) => {
  e.focus(); e.select();
  const dt = new DataTransfer(); dt.setData('text/plain', metin);
  e.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}, metin);

test('Araç: virgülle yazılan Cd modele DOĞRU gider, türetilen alan Türkçe; yapıştırma ve ↑', async ({ page }) => {
  await ac(page, 'arac-performans', "let ex = nodes.find((x) => x.type === 'ap-example'); if (!ex) ex = createNode('ap-example', 300, 200);"
    + " ex.data = ex.data || {}; ex.data.exampleKey = 'isb340_tc411'; veApLoadExample(ex.id);");
  const id = await pencere(page, 'vehicle');
  const cd = `#ve-ftv-cd-${id}`, gvw = `#ve-ftv-gvw-${id}`, cda = `#ve-ftv-cda-${id}`;

  expect(await page.$eval(cd, (e) => e.type + '/' + e.getAttribute('inputmode'))).toBe('text/decimal');
  await yaz(page, cd, '0,65');
  const d = await page.evaluate((id) => nodes.find((n) => n.id === id).data, id);
  expect(d.ftCd).toBe(0.65);                         // eski alan: "065" → 65
  expect(await gorunen(page, cd)).toBe('0,65');
  expect(await gorunen(page, cda)).toMatch(/^\d+,\d{3}$/);   // koddan yazılan salt okunur alan da Türkçe

  // ↑: `step` taşıyan alan eski sayı alanı gibi adım atar ve modele yazar.
  await page.click(cd);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(100);
  expect(await page.evaluate((id) => nodes.find((n) => n.id === id).data.ftCd, id)).toBe(0.651);
  expect(await gorunen(page, cd)).toBe('0,651');

  // Yapıştırma: ondalıklı gruplu sayı belirsiz değil — sessizce doğru okunur.
  await yapistir(page, gvw, '15.200,5 kg');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  expect(await page.evaluate((id) => nodes.find((n) => n.id === id).data.ftGVW, id)).toBe(15200.5);
  expect(await page.locator('.ve-toast.warning').count()).toBe(0);

  // Gruplu TAM SAYI iki türlü okunur: ondalık okunur ama SESSİZ kalmaz.
  await yapistir(page, gvw, '14.900');
  expect(await gorunen(page, gvw)).toBe('14,900');
  expect(await page.$eval(gvw, (e) => e.classList.contains('ve-sayi-belirsiz'))).toBe(true);
  await expect(page.locator('.ve-toast.warning').last()).toContainText('14900');
});

// Pencerenin görünen İLK düzenlenebilir sayı alanı; kimliği `<önek><anahtar>-<düğüm>`.
const ilkAlan = (page, onek, nid) => page.evaluate(([onek, nid]) => {
  const e = [...document.querySelectorAll('.ve-properties-content input[inputmode="decimal"]:not([readonly])')]
    .find((x) => x.offsetWidth && x.id.startsWith(onek) && x.id.endsWith('-' + nid));
  return e ? { id: e.id, anahtar: e.id.slice(onek.length, -(nid.length + 1)) } : null;
}, [onek, nid]);

for (const [modul, ornek, tip, onek] of [
  ['mount-analysis', "let ex = nodes.find((x) => x.type === 'mnt-example'); if (!ex) ex = createNode('mnt-example', 300, 200);"
    + " ex.data = ex.data || {}; ex.data.exampleKey = 'tulga'; veMntLoadExample(ex.id);", 'mnt-motor', 've-mnt-'],
  ['fead-analysis', "if (typeof veFeadWizClose === 'function') veFeadWizClose(false); veFeadLoadExample('AG00976_GATES_2025');",
    'fead-tensioner', 've-fead-'],
]) {
  test(`${modul}: panel alanına virgülle yazılan sayı modele doğru gider`, async ({ page }) => {
    await ac(page, modul, ornek);
    const nid = await pencere(page, tip);
    const a = await ilkAlan(page, onek, nid);
    expect(a).toBeTruthy();
    await yaz(page, '#' + a.id, '12,5');
    const v = await page.evaluate(([nid, k]) => nodes.find((n) => n.id === nid).data[k], [nid, a.anahtar]);
    expect([a.anahtar, parseFloat(v)]).toEqual([a.anahtar, 12.5]);    // eski alan: "125"
    expect(await gorunen(page, '#' + a.id)).toBe('12,5');
  });
}

test('Ölçüm Görüntüleyici katmanı taşıyor (tek dosya, file://)', async ({ page }) => {
  await page.goto('file://' + VIEWER);
  const r = await page.evaluate(async () => {
    const e = document.createElement('input');
    e.setAttribute('inputmode', 'decimal'); e.setAttribute('value', '0.25');
    document.body.appendChild(e);
    await new Promise((r) => setTimeout(r, 0));
    return [typeof veSayiAlanKur, Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get.call(e), e.value];
  });
  expect(r).toEqual(['function', '0,25', '0.25']);
});
