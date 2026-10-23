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
 * 2026-09-23'ten beri açılışta KART YOK (2026-10-18'den beri SİNEMA
 * bantları): ölçülen şey bandın markasının sol kenarı — karşılama kartı aynı
 * kenarda beliriyor ve marka kartın logosuna içeriden iniyor.
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

test('karşılama fotoğrafı TAM KENAR ve kartı açılış markasının kenarında', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  // AÇILIŞ EKRANI — yükleme sürerken ölç
  await page.waitForSelector('#mfsim-loading-screen .mfsim-sinema-marka', { state: 'visible', timeout: 30000 });
  const acilis = {
    foto: await page.evaluate(kutu, '#mfsim-loading-photo'),
    marka: await page.evaluate(kutu, '#mfsim-loading-screen .mfsim-sinema-marka'),
  };
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.waitForTimeout(800);
  const karsilama = {
    foto: await page.evaluate(kutu, '#ve-welcome-slayt'),
    // Kesiğin içeriğinin kenarı: markanın kutusu (sütunun kutusu, bağlantıların
    // taşma payı kadar solda başlıyor — 2026-10-23).
    kart: await page.evaluate(kutu, '.ve-welcome-logo'),
  };

  // Fotoğraf ekranın TAMAMI — çerçeve yok
  expect(karsilama.foto).toEqual({ x: 0, y: 0, w: 1600, h: 900 });
  expect(karsilama.foto).toEqual(acilis.foto);
  // Kart açılış markasının SOL KENARINDA beliriyor — ÇİZİMDE aynı x
  // (genişlik ve yükseklik bilerek farklı: marka bir kart değil)
  expect(karsilama.kart.x).toBe(acilis.marka.x);

  // Köşe de yok: kaplamanın kabı yuvarlatılmış olsaydı fotoğraf köşeden kırpılırdı
  const kose = await page.evaluate(() => getComputedStyle(document.querySelector('.ve-canvas-wrapper')).borderTopLeftRadius);
  expect(kose).toBe('0px');
});

// ── KESİK (2026-10-23, kullanıcı kararı "6d · İnce") ─────────────────────
// İçerik siyah kesiğin İÇİNDE durmalı: eğik kenar aşağı indikçe daralıyor ve
// clip-path taşan her şeyi SESSİZCE kırpıyor — yazı yarım görünür, hiçbir
// şey kırılmaz. Kesiğin bir kutunun DİBİNDEKİ genişliği, o kutu için en dar
// yerdir; her kutu orada kenardan en az 12 px içeride olmalı. Üç boy:
// kullanıcının ekranı ve penceresi, bir de kısa pencere (sıkı düzen).
for (const [w, h] of [[1600, 900], [998, 946], [1366, 650]]) {
  test(`kesiğin içeriği eğik kenara değmiyor — ${w}×${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('file://' + BUILD);
    await page.fill('#mfsim-login-password', 'mfsim2024');
    await page.press('#mfsim-login-password', 'Enter');
    await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
    // Giriş koreografisi bitsin: kutular DURACAKLARI yerde ölçülür.
    await page.waitForFunction(() => document.getAnimations()
      // slaytın yakınlaşması hiç bitmez (18 sn) — beklenen yalnız giriş hareketi
      .filter((a) => !(a.effect && a.effect.target && a.effect.target.classList
        && a.effect.target.classList.contains('ve-welcome-kare')))
      .every((a) => a.playState !== 'running'),
      null, { timeout: 15000 });

    const r = await page.evaluate(() => {
      const K = document.querySelector('.ve-welcome .ve-kesik').getBoundingClientRect();
      const alt = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kesik-alt'));
      const kenar = (y) => K.left + K.width - (K.width - alt) * (y - K.top) / K.height;
      const sec = '.ve-welcome-logo > span, .ve-welcome-tagline, .ve-welcome-cetvel, .ve-welcome-eyebrow, '
        + '.ve-module-card, .ve-welcome-panel-title, .ve-welcome-change, .ve-welcome-kunye, '
        + '.ve-welcome-open, .ve-welcome-link';
      const kutular = [...document.querySelectorAll('.ve-welcome-id :is(' + sec + ')')]
        .filter((e) => getComputedStyle(e).display !== 'none')
        .map((e) => ({ e, q: e.getBoundingClientRect() }))
        .filter(({ q }) => q.width > 0 && q.height > 0);
      const pay = kutular.map(({ e, q }) => ({
        ad: (e.className || '').toString().split(' ')[0],
        pay: Math.round(kenar(q.bottom) - q.right),
        icinde: q.top >= K.top && q.bottom <= K.bottom,
      }));
      const id = document.querySelector('.ve-welcome-id');
      return {
        say: pay.length,
        enDar: pay.reduce((a, b) => (b.pay < a.pay ? b : a)),
        disarida: pay.filter((p) => !p.icinde).map((p) => p.ad),
        kayarX: id.scrollWidth > id.clientWidth,
        kayarY: id.scrollHeight > id.clientHeight,
        cizgi: getComputedStyle(document.querySelector('.ve-welcome .ve-kesik-cizgi')).clipPath,
      };
    });

    expect(r.say).toBeGreaterThanOrEqual(15);             // ölçüm boşa koşmuyor (kısa boyda 2 kayıt)
    expect(r.enDar.pay).toBeGreaterThanOrEqual(12);       // en dar yerde bile kenardan içeride
    expect(r.disarida).toEqual([]);                       // dikeyde de kesiğin içinde
    expect(r.kayarX).toBe(false);
    expect(r.kayarY).toBe(false);                         // sütun bu boylarda kaymadan sığıyor
    expect(r.cizgi).toMatch(/^polygon\(/);                // bakır çizgi çiziliyor
  });
}
