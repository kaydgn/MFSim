/**
 * pencere-ailesi.spec.js — BÜTÜN PENCERELER TEK AİLE (gerçek tarayıcı)
 * ───────────────────────────────────────────────────────────────────────────
 * Ölçülen kusur (doku haritası K6): dokuz pencerede 4 ayrı başlık bandı
 * (26 · 40 · 49 · 63 px), 5 ayrı başlık yazısı (12/600 · 13/600 · 13/700
 * büyük harf · 14/700 · 16/700), 3 ayrı kapat biçimi (22 px ✕ yazı karakteri
 * · 26 ve 30 px elle SVG); beş pencerenin başlığında ikon yoktu, ikisininki
 * şeritteki girişinkinden farklıydı, Çözücü sabit bir gölgeyle çiziliyordu.
 *
 * Her pencere için ölçülen: bant = --bant-h ve zemini bandın, başlık yazısı
 * kabuk bandınınki ("Bileşenler" başlığıyla aynı), kapat 22 px ve içinde
 * çizgi ikon, başlıkta bir çizgi ikon, köşe --radius-lg, gölge --shadow-xl.
 * Komut paleti bilerek dışarıda: arama alanı onun başlığı.
 *
 * Node'da koşamaz: jsdom hesaplanmış stil ve yerleşim vermez. Kaynak kapısı
 * tests/unit/pencere-ailesi.test.js.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BUILD = path.join(__dirname, '../..', 'MFSim_Code.html');
test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});
test.setTimeout(180000);

// Bir pencerenin başlığını ölç. `kab` verilmezse kabuk ölçülmez (Özellikler
// sütun kipinde kabuğun parçası: köşesi ve gölgesi yok).
const OLC = ({ kok, kab }) => {
  const k = document.querySelector(kok);
  const bas = k && k.querySelector('.ve-settings-header, .ve-properties-header');
  if (!bas) return { yok: kok };
  const cs = (e) => getComputedStyle(e);
  const kap = bas.querySelector('.ve-settings-close, .ve-properties-close');
  const bsl = bas.firstElementChild;
  const kabuk = kab ? document.querySelector(kab) : null;
  const ikon = kap && kap.querySelector('.mf-ico-x');
  return {
    bant: Math.round(bas.getBoundingClientRect().height),
    zemin: cs(bas).backgroundImage.startsWith('linear-gradient'),
    cizgi: cs(bas).borderBottomWidth,
    yazi: cs(bsl).fontSize + ' ' + cs(bsl).fontWeight,
    kapat: kap ? Math.round(kap.getBoundingClientRect().width) + '×' + Math.round(kap.getBoundingClientRect().height) : 'yok',
    kapatIkon: !!(ikon && cs(ikon).maskImage !== 'none' && ikon.getBoundingClientRect().width >= 12) && !/✕|×/.test(kap.textContent),
    baslikIkon: !!bas.querySelector('.mf-ico:not(.mf-ico-x)'),
    kose: kabuk ? cs(kabuk).borderTopLeftRadius : null,
    golge: kabuk ? cs(kabuk).boxShadow : null,
  };
};
// Jetonların çözülmüş değeri — sabit sayı yazmak jetonun işini üstlenmek olurdu.
const JETON = () => {
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;left:-99px;width:9px;height:9px;border-radius:var(--radius-lg);box-shadow:var(--shadow-xl)';
  document.body.appendChild(p);
  const c = getComputedStyle(p);
  const sb = getComputedStyle(document.querySelector('.ve-sidebar-header'));
  const j = { bant: Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bant-h'))),
    kose: c.borderTopLeftRadius, golge: c.boxShadow, yazi: sb.fontSize + ' ' + sb.fontWeight };
  p.remove();
  return j;
};

test('dokuz pencere tek aile: bant, başlık yazısı, kapat, başlık ikonu, köşe, gölge', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1032 });
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
  await page.waitForTimeout(2200);
  const J = await page.evaluate(JETON);
  expect(J.bant).toBeGreaterThanOrEqual(20);

  const S = {};
  const ac = async (ad, kod, olc, kapat) => {
    await page.evaluate(kod);
    await page.waitForTimeout(450);
    S[ad] = await page.evaluate(OLC, olc);
    await page.evaluate(kapat);
    await page.waitForTimeout(250);
  };
  await ac('Özellikler', "(() => { const n = nodes.find((x) => x.type === 'engine'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); })()",
    { kok: '#ve-properties' }, 'veTogglePropertiesPanel(false)');
  await ac('Ayarlar', 'veOpenSettings()', { kok: '#ve-settings-overlay', kab: '#ve-settings-overlay .ve-settings-modal' }, 'veCloseSettings()');
  await ac('Program Durumu', 'veOpenStatusModal()', { kok: '#ve-status-overlay', kab: '#ve-status-overlay .ve-settings-modal' }, 'veCloseStatusModal()');
  await ac('İçe Aktarma', 'veImpOpenModal()', { kok: '#ve-import-overlay', kab: '#ve-import-overlay .ve-settings-modal' }, 'veImpCloseModal()');
  await ac('Kısayollar', 'veShortcutsHelpOpen()', { kok: '#ve-help', kab: '#ve-help .ve-help-panel' }, 'veShortcutsHelpClose()');
  await ac('Kılavuzlar', 'veGuideKitOpen()', { kok: '#ve-guide-kit', kab: '#ve-guide-kit .ve-help-panel' }, 'veGuideKitClose()');
  await ac('Program Arşivi', 'veProgramArsiviOpen()', { kok: '#ve-programlar', kab: '#ve-programlar .ve-help-panel' }, 'veProgramArsiviClose()');
  await ac('Tablo penceresi', "(() => { const d = document.createElement('div'); d.innerHTML = '<div class=\"ve-tablo\" data-ve-tablo=\"k6\" data-ve-tablo-baslik=\"Çalışma Çevrimi\" data-ve-tablo-ozet=\"7 satır\"><table><tr><td>1</td></tr></table></div>'; document.body.appendChild(d); veTabloAc('k6'); })()",
    { kok: '.ve-tablo-perde', kab: '.ve-tablo-pencere' }, 'veTabloKapat()');
  // Çözücü: kapat çözüm bitince görünür
  await page.evaluate(() => veSolverRunProfessional());
  await page.waitForFunction(() => { const b = document.getElementById('ve-solver-modal-close'); return b && b.style.display !== 'none'; }, null, { timeout: 90000 });
  S['Çözücü'] = await page.evaluate(OLC, { kok: '#ve-solver-modal-overlay', kab: '#ve-solver-modal-overlay > div' });

  const sapma = [];
  for (const [ad, v] of Object.entries(S)) {
    if (v.yok) { sapma.push(ad + ': başlık yok'); continue; }
    if (v.bant !== J.bant) sapma.push(`${ad}: bant ${v.bant} px (jeton ${J.bant})`);
    if (!v.zemin) sapma.push(`${ad}: zemin bandın değil`);
    if (v.cizgi !== '1px') sapma.push(`${ad}: çizgi ${v.cizgi}`);
    if (v.yazi !== J.yazi) sapma.push(`${ad}: başlık ${v.yazi} (bant ${J.yazi})`);
    if (v.kapat !== '22×22') sapma.push(`${ad}: kapat ${v.kapat}`);
    if (!v.kapatIkon) sapma.push(`${ad}: kapat çizgi ikon değil`);
    if (!v.baslikIkon) sapma.push(`${ad}: başlıkta ikon yok`);
    if (v.kose !== null && v.kose !== J.kose) sapma.push(`${ad}: köşe ${v.kose}`);
    if (v.golge !== null && v.golge !== J.golge) sapma.push(`${ad}: gölge jetondan değil`);
  }
  expect(Object.keys(S)).toHaveLength(9);
  expect(sapma).toEqual([]);
});
