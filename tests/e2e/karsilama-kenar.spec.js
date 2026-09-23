/**
 * karsilama-kenar.spec.js — KARŞILAMA AÇILIŞ EKRANININ İKİZİ Mİ (ÇİZİMDE)?
 * ──────────────────────────────────────────────────────────────────────────
 *
 * ÖLÇÜLEN KUSUR (2026-09-23, kullanıcı bildirimi: "kenarlardan kısıtı var,
 * çerçevesi var"): karşılama fotoğrafı (9, 9)'dan 1902×1014 çiziliyordu,
 * 1920×1032 yerine. Kaplama `.ve-canvas-wrapper`ın İÇİNDE duruyor ve Tur B'nin
 * tuval çukurunu (8 px dolgu + 1 px kenarlık + 10 px köşe + iç gölge) birlikte
 * devralmıştı.
 *
 * Kart da aynı 9 px'i yedi ve bunu söyleyen bir kapı YOKTU:
 * `loader-splash.test.js` iki kartın CSS METNİNİ karşılaştırıyor — ikisi de
 * `left:56px` yazıyor. Ama `left` kapsayan bloğa göre; açılış kartınınki
 * ekranın kendisi, karşılama kartınınki içeri kaymış tuval kabı. Metin
 * birebir aynıydı, ÇİZİM 9 px ayrıydı. Bu halka çizimi ölçer.
 *
 * (İkinci bir halka "çukur MODÜLDE geri geliyor"u tutuyordu: karşılamanın
 * çukursuz kuralı modüle sızmasın. 2026-09-23'te çukur tuvalden de kalktı —
 * kullanıcı: "pencere sınırları hizasız" — ve karşılamaya özel kural gereksiz
 * kaldı. Tuvalin kenara yapışıklığı artık kabuk-sutun.spec.js'te.)
 *
 * 2026-09-23'ten beri açılışta KART YOK (AMBLEM): ölçülen şey amblemin sol
 * kenarı — karşılama kartı onun yerinde, aynı kenarda beliriyor ve marka
 * kartın logosuna içeriden iniyor.
 *
 * Node'da koşamaz: jsdom yerleşim hesaplamaz, `getBoundingClientRect` hep 0.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BUILD = path.join(__dirname, '../..', 'MFSim_Code.html');
test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});

const kutu = (sel) => {
  const e = document.querySelector(sel);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
};

test('karşılama fotoğrafı TAM KENAR ve kartı amblemin kenarında', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  // AÇILIŞ EKRANI — yükleme sürerken ölç
  await page.waitForSelector('#mfsim-loading-screen .mfsim-amblem', { state: 'visible', timeout: 30000 });
  const acilis = {
    foto: await page.evaluate(kutu, '#mfsim-loading-photo'),
    amblem: await page.evaluate(kutu, '#mfsim-loading-screen .mfsim-amblem'),
  };
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.waitForTimeout(800);
  const karsilama = {
    foto: await page.evaluate(kutu, '#ve-welcome-slayt'),
    kart: await page.evaluate(kutu, '.ve-welcome-id'),
  };

  // Fotoğraf ekranın TAMAMI — çerçeve yok
  expect(karsilama.foto).toEqual({ x: 0, y: 0, w: 1600, h: 900 });
  expect(karsilama.foto).toEqual(acilis.foto);
  // Kart amblemin SOL KENARINDA beliriyor — ÇİZİMDE aynı x
  // (genişlik ve yükseklik bilerek farklı: amblem bir kart değil)
  expect(karsilama.kart.x).toBe(acilis.amblem.x);

  // Köşe de yok: kaplamanın kabı yuvarlatılmış olsaydı fotoğraf köşeden kırpılırdı
  const kose = await page.evaluate(() => getComputedStyle(document.querySelector('.ve-canvas-wrapper')).borderTopLeftRadius);
  expect(kose).toBe('0px');
});
