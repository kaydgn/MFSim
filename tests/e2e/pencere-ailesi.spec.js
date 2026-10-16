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
 * çizgi ikon, başlıkta bir çizgi ikon, köşe --radius-lg, gölge --shadow-xl,
 * perde --scrim ve bulanıklıksız.
 * Komut paleti bilerek dışarıda: arama alanı onun başlığı.
 *
 * İkinci ölçüm (doku turu 5 · E): listede olmayan sekiz pencere aileden
 * ayrıydı — beşi kendi bandını çiziyordu (5 px dolgu, kalın başlık, 24–28 px
 * çerçeveli ✕), ikisi bandsız 16 px başlık, Takoz'un tam ekran görüntüleyicisi
 * 11 px dolgulu 700 kalınlıkta bant; on üç pencerenin perdesi beş ayrı
 * koyulukta (%50–%85) ve altısı bulanık, altı kabuğun gölgesi temadan habersiz.
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
const OLC = ({ kok, kab, perde }) => {
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
    // perde: pencerenin altındaki tam ekran katman (Özellikler sütun kipinde yok)
    perde: perde ? (document.querySelector(perde) ? cs(document.querySelector(perde)).backgroundColor
      + (cs(document.querySelector(perde)).backdropFilter !== 'none' ? ' + bulanık' : '') : 'yok') : null,
  };
};
// Jetonların çözülmüş değeri — sabit sayı yazmak jetonun işini üstlenmek olurdu.
const JETON = () => {
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;left:-99px;width:9px;height:9px;border-radius:var(--radius-lg);box-shadow:var(--shadow-xl);background:var(--scrim)';
  document.body.appendChild(p);
  const c = getComputedStyle(p);
  const sb = getComputedStyle(document.querySelector('.ve-sidebar-header'));
  const j = { bant: Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bant-h'))),
    kose: c.borderTopLeftRadius, golge: c.boxShadow, yazi: sb.fontSize + ' ' + sb.fontWeight, perde: c.backgroundColor };
  p.remove();
  return j;
};

test('yirmi bir pencere tek aile: bant, başlık yazısı, kapat, başlık ikonu, köşe, gölge, perde', async ({ page }) => {
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
  // Açma ya da kapatma yolu patlarsa ölçüm sürer ve hata ayrıca raporlanır —
  // sapma listesinin TAMAMI görülsün, ilk kırık pencerede kopmasın.
  const kirik = [];
  const ac = async (ad, kod, olc, kapat) => {
    await page.evaluate(kod).catch((e) => kirik.push(ad + ' açılmadı: ' + e.message.split('\n')[0]));
    await page.waitForTimeout(450);
    S[ad] = await page.evaluate(OLC, olc);
    await page.evaluate(kapat).catch((e) => kirik.push(ad + ' kapanmadı: ' + e.message.split('\n')[0]));
    await page.waitForTimeout(250);
  };
  await ac('Özellikler', "(() => { const n = nodes.find((x) => x.type === 'engine'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); })()",
    { kok: '#ve-properties' }, 'veTogglePropertiesPanel(false)');
  await ac('Ayarlar', 'veOpenSettings()', { kok: '#ve-settings-overlay', kab: '#ve-settings-overlay .ve-settings-modal', perde: '#ve-settings-overlay' }, 'veCloseSettings()');
  await ac('Program Durumu', 'veOpenStatusModal()', { kok: '#ve-status-overlay', kab: '#ve-status-overlay .ve-settings-modal', perde: '#ve-status-overlay' }, 'veCloseStatusModal()');
  await ac('İçe Aktarma', 'veImpOpenModal()', { kok: '#ve-import-overlay', kab: '#ve-import-overlay .ve-settings-modal', perde: '#ve-import-overlay' }, 'veImpCloseModal()');
  await ac('Kısayollar', 'veShortcutsHelpOpen()', { kok: '#ve-help', kab: '#ve-help .ve-help-panel', perde: '#ve-help' }, 'veShortcutsHelpClose()');
  await ac('Kılavuzlar', 'veGuideKitOpen()', { kok: '#ve-guide-kit', kab: '#ve-guide-kit .ve-help-panel', perde: '#ve-guide-kit' }, 'veGuideKitClose()');
  await ac('Program Arşivi', 'veProgramArsiviOpen()', { kok: '#ve-programlar', kab: '#ve-programlar .ve-help-panel', perde: '#ve-programlar' }, 'veProgramArsiviClose()');
  await ac('Tablo penceresi', "(() => { const d = document.createElement('div'); d.innerHTML = '<div class=\"ve-tablo\" data-ve-tablo=\"k6\" data-ve-tablo-baslik=\"Çalışma çevrimi\" data-ve-tablo-ozet=\"7 satır\"><table><tr><td>1</td></tr></table></div>'; document.body.appendChild(d); veTabloAc('k6'); })()",
    { kok: '.ve-tablo-perde', kab: '.ve-tablo-pencere', perde: '.ve-tablo-perde' }, 'veTabloKapat()');
  // Aile dışında kalmış pencereler (doku turu 5 · E). Düğümü yoksa kurulur.
  const dugum = (tip) => page.evaluate((t) => { let n = nodes.find((x) => x.type === t); if (!n) n = createNode(t, 900, 1400); return n.id; }, tip);
  const cd = await dugum('coast-down');
  await ac('Yavaşlama sihirbazı', `veOpenCoastDownWizard('${cd}')`, { kok: '#ve-cd-wizard-overlay', kab: '#ve-cd-wizard-overlay > div', perde: '#ve-cd-wizard-overlay' }, 'veCloseCoastDownWizard()');
  const ecm = await dugum('ec-matching');
  await ac('Eşleştirme diyagramı', `ecmExpandChart('${ecm}')`, { kok: '#ecm-chart-modal-overlay', kab: '#ecm-chart-modal-overlay > div', perde: '#ecm-chart-modal-overlay' }, 'ecmCloseChartModal()');
  const yol = await dugum('road');
  await page.evaluate((y) => { const n = nodes.find((q) => q.id === y); n.data = n.data || {};
    n.data.manualSegments = [{ direction: 'down', gradePct: 6, distance: 1000 }, { direction: 'up', gradePct: 4, distance: 800 }];
    n.data.gpsSamples = Array.from({ length: 40 }, (_, i) => ({ dist: i * 50, elev: 800 + 20 * Math.sin(i / 5), lat: 39.9 + i * 1e-4, lng: 32.8 + i * 1e-4 })); }, yol);
  await ac('Yol profili', `veManualSegExpandProfile('${yol}')`, { kok: '#ve-mseg-profile-overlay', kab: '#ve-mseg-profile-overlay > div', perde: '#ve-mseg-profile-overlay' }, 'veCloseManualProfileModal()');
  await ac('Rakım profili', `veExpandProfileChart('${yol}', 'alt')`, { kok: '#ve-profile-modal-overlay', kab: '#ve-profile-modal-overlay > div', perde: '#ve-profile-modal-overlay' }, 'veCloseProfileModal()');
  // Harita yol düğümünün PANELİNDE kurulur; büyük pencere onu taşır.
  await page.evaluate((y) => { const n = nodes.find((q) => q.id === y); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); }, yol);
  await page.waitForTimeout(1500);
  await ac('Harita', `veExpandRoadMap('${yol}')`, { kok: '#ve-map-modal-overlay', kab: '#ve-map-modal-overlay > div', perde: '#ve-map-modal-overlay' }, 'veCloseMapModal(); veTogglePropertiesPanel(false)');
  await ac('Referans noktası', `_veWaypointNameDialog('${yol}', 1234, function () {})`, { kok: '#ve-wp-name-dialog', kab: '#ve-wp-name-dialog .ve-mini-pencere', perde: '#ve-wp-name-dialog' }, "document.getElementById('ve-wp-name-dialog').remove()");
  await ac('Bilgi', 'showInfoPopup(Object.keys(infoPopupData)[0])', { kok: '#ve-info-popup', kab: '#ve-info-popup', perde: '#ve-info-overlay' }, 'closeInfoPopup()');
  await ac('Farklı kaydet', "veShowSaveDialog('proje.json', new Blob(['{}']), 'ok')", { kok: '#ve-save-dialog-overlay', kab: '#ve-save-dialog-overlay > div', perde: '#ve-save-dialog-overlay' }, "document.getElementById('ve-save-x').click()");
  await ac('Diyagram künyesi', 'swShowDiagramInfo(SENSOR_PACKAGES[0].id, 0)', { kok: '#sw-info-overlay', kab: '#sw-info-overlay .ve-mini-pencere', perde: '#sw-info-overlay' }, "document.getElementById('sw-info-overlay').remove()");
  await ac('TXT rapor indir', "window._veTxtPreviewContent = 'deneme'; veDownloadTXTFromPreview()", { kok: '#ve-txt-author-overlay', kab: '#ve-txt-author-overlay .ve-mini-pencere', perde: '#ve-txt-author-overlay' }, "document.getElementById('ve-txt-author-overlay').remove()");
  // Takoz'un tam ekran görüntüleyicisi: kimliği '-overlay' ile bitmiyordu, ad
  // listesinden kaçıyordu. three.js tam ekranı 2026-10-16'da kaldırıldı ("Klasik
  // 3B" yalnız ad); aynı perdeyi aksonometrinin tam ekranı kuruyor.
  await ac('3D tam ekran', 'veMntAkso3BTamEkran()', { kok: '#ve-mnt-fs', kab: '#ve-mnt-fs > div', perde: '#ve-mnt-fs' }, "document.getElementById('ve-mnt-fs-x').click()");

  // Çözücü: kapat çözüm bitince görünür
  await page.evaluate(() => veSolverRunProfessional());
  await page.waitForFunction(() => { const b = document.getElementById('ve-solver-modal-close'); return b && b.style.display !== 'none'; }, null, { timeout: 90000 });
  S['Çözücü'] = await page.evaluate(OLC, { kok: '#ve-solver-modal-overlay', kab: '#ve-solver-modal-overlay > div', perde: '#ve-solver-modal-overlay' });
  // BMC raporu sonuç ister: çözümden sonra.
  await page.evaluate(() => document.getElementById('ve-solver-modal-close').click()).catch((e) => kirik.push('Çözücü kapanmadı: ' + e.message.split('\n')[0]));
  await page.waitForTimeout(300);
  await ac('BMC raporu', 'veShowRaporModal()', { kok: '#ve-rapor-modal-overlay', kab: '#ve-rapor-modal-overlay .ve-mini-pencere', perde: '#ve-rapor-modal-overlay' }, 'veCloseRaporModal()');

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
    if (v.perde !== null && v.perde !== J.perde) sapma.push(`${ad}: perde ${v.perde} (jeton ${J.perde})`);
  }
  expect(Object.keys(S)).toHaveLength(21);
  expect(sapma).toEqual([]);
  expect(kirik).toEqual([]);
});
