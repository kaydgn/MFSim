/**
 * mufettis-sutun.spec.js — ÖZELLİK PENCERESİ GENİŞ EKRANDA SÜTUN MU?
 * ──────────────────────────────────────────────────────────────────
 *
 * ÖLÇÜLEN KUSUR (2026-09-22): bileşen özellikleri ekranın ORTASINDA, %60
 * karartmalı bir perdenin üstünde açılıyordu. Bir sayı girmek modeli gözden
 * kaybettiriyor, girilen sayının modeli nasıl değiştirdiğini görmek pencereyi
 * KAPATMAYI gerektiriyordu. Atölye kalıbında müfettiş tuvalin YANINDADIR.
 *
 * Bu halkaların hiçbiri Node'da koşamaz: jsdom `@media` sorgusunu
 * değerlendirmez, `:has()` hesaplamaz, `getBoundingClientRect` hep 0 döner ve
 * `pointer-events`in tıklamayı gerçekten geçirdiği ancak gerçek bir tıklamayla
 * ölçülür.
 */
const { test, expect } = require('@playwright/test');

const GENIS = 1600;   // sütun kipi
const DAR = 1100;     // modal kipi (eşik 1280)

async function bootApp(page, w) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veTogglePropertiesPanel === 'function' &&
    Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  // Ertelenmiş modüller yüklenene kadar bekle — `createNode` içeriden
  // `updateNodeHandles`i çağırıyor ve o daha geç geliyor.
  await page.waitForFunction(() =>
    typeof window.updateNodeHandles === 'function' && typeof window.addToSelection === 'function',
  null, { timeout: 90000 });
  // AÇILIŞ EKRANI ÇEKİLENE KADAR BEKLE. Ölçüldü: perdesi hâlâ üstteyken
  // `elementFromPoint` tuvalin merkezinde `#mfsim-loading-photo` döndürüyor —
  // "tıklama tuvale geçiyor mu" sorusunu ölçen halka açılış ekranını ölçer.
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none' || getComputedStyle(s).display === 'none';
  }, null, { timeout: 90000 });
  await page.waitForTimeout(400);
}

// Paneli KULLANICININ yolundan açar: kanvasta bir bileşen seç.
async function panelAc(page) {
  await page.evaluate(() => {
    const n = createNode('engine', 400, 300);
    clearSelection(); addToSelection(n);
  });
  // Seçim ile AÇMA arasına nefes: modülün açılış yüzeyi yerleşirken
  // `clearSelection` çağırıyor ve o da pencereyi kapatıyor.
  await page.waitForTimeout(500);
  await page.evaluate(() => veTogglePropertiesPanel(true));
  await page.waitForFunction(() =>
    document.getElementById('ve-properties-overlay').classList.contains('visible'),
  null, { timeout: 10000 });
  await page.waitForTimeout(350);
}

test('GENİŞ ekranda müfettiş bir SÜTUN — perde yok, tuval daralıyor, örtmüyor', async ({ page }) => {
  await bootApp(page, GENIS);
  // ÇİZİM YÜZEYİ `.ve-split-container` — `.ve-canvas-area`nın `clientWidth`i
  // DOLGUYU İÇERİR, yani `padding-right` ile daralmayı HİÇ göstermez (ölçüldü:
  // müfettiş açıkken de kapalıyken de 1316). Yanlış ölçü, çalışan bir düzeni
  // "bozuk" gösterdi.
  const kapali = await page.evaluate(() =>
    Math.round(document.getElementById('ve-split-container').getBoundingClientRect().width));
  await panelAc(page);

  const r = await page.evaluate(() => {
    const ov = document.getElementById('ve-properties-overlay');
    const pn = document.querySelector('.ve-properties');
    const ar = document.querySelector('.ve-canvas-area');
    const cs = getComputedStyle(ov);
    const pr = pn.getBoundingClientRect();
    return {
      perde: cs.backgroundColor,
      tiklamaGecer: cs.pointerEvents,
      panelTiklanir: getComputedStyle(pn).pointerEvents,
      sag: Math.round(pr.right), genislik: Math.round(pr.width), ust: Math.round(pr.top),
      tuvalAcik: Math.round(document.getElementById('ve-split-container').getBoundingClientRect().width),
      tuvalSagKenar: Math.round(document.getElementById('ve-split-container').getBoundingClientRect().right),
      bandAlti: Math.round(document.getElementById('ve-ribbon').getBoundingClientRect().bottom),
      ekran: window.innerWidth,
    };
  });

  // PERDE YOK — model görünür kalır
  expect(r.perde).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
  // Tıklama tuvale geçer, panelin kendisi tıklanabilir kalır
  expect(r.tiklamaGecer).toBe('none');
  expect(r.panelTiklanir).toBe('auto');
  // Sağ kenara yaslı, tam boy, bandın ALTINDAN başlıyor
  expect(r.sag).toBe(r.ekran);
  expect(r.genislik).toBe(380);
  expect(Math.abs(r.ust - r.bandAlti)).toBeLessThanOrEqual(1);
  // TUVAL DARALDI — sütun modeli ÖRTMÜYOR. İkisi de aynı jetondan.
  expect(kapali - r.tuvalAcik).toBe(380);
  expect(r.tuvalSagKenar).toBeLessThanOrEqual(r.sag - r.genislik + 1);
});

test('GENİŞ ekranda müfettiş açıkken TUVAL hâlâ tıklanabilir', async ({ page }) => {
  await bootApp(page, GENIS);
  await panelAc(page);

  // PERDELİ modalde bu noktanın sahibi overlay'in KENDİSİYDİ (inset:0 ile
  // ekranın tamamını kaplıyordu) ve oraya yapılan tıklama pencereyi kapatırdı.
  const sahip = await page.evaluate(() => {
    const k = document.getElementById('ve-split-container').getBoundingClientRect();
    const el = document.elementFromPoint(Math.round(k.left + k.width / 2), Math.round(k.top + k.height / 2));
    return {
      overlayMi: !!(el && el.closest('#ve-properties-overlay')),
      tuvaldeMi: !!(el && el.closest('.ve-canvas-area')),
    };
  });
  expect(sahip.overlayMi).toBe(false);
  expect(sahip.tuvaldeMi).toBe(true);

  // Ve GERÇEK bir tıklama tuvale İŞ YAPTIRIYOR. İki dünyayı ayıran ölçü bu:
  // perdeli modalde aynı tıklama perdenin `onmousedown`una düşer, pencere
  // kapanır ve SEÇİM OLDUĞU GİBİ KALIR. Sütun kipinde tıklama tuvale ulaşır,
  // seçimi boşaltır — pencerenin kapanması da onun SONUCUdur, perdenin değil.
  const oncesi = await page.evaluate(() => selectedNodes.length);
  const k = await page.evaluate(() => {
    const r = document.getElementById('ve-split-container').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  await page.mouse.click(k.x, k.y);
  await page.waitForTimeout(400);
  const sonrasi = await page.evaluate(() => selectedNodes.length);
  expect(oncesi).toBe(1);
  expect(sonrasi).toBe(0);
});

test('DAR ekranda modal davranış BİREBİR duruyor', async ({ page }) => {
  await bootApp(page, DAR);
  const kapali = await page.evaluate(() =>
    Math.round(document.getElementById('ve-split-container').getBoundingClientRect().width));
  await panelAc(page);
  const r = await page.evaluate(() => {
    const ov = document.getElementById('ve-properties-overlay');
    const pn = document.querySelector('.ve-properties').getBoundingClientRect();
    return {
      perde: getComputedStyle(ov).backgroundColor,
      tiklama: getComputedStyle(ov).pointerEvents,
      ortaliMi: Math.abs((pn.left + pn.right) / 2 - window.innerWidth / 2) <= 2,
      tuvalAcik: Math.round(document.getElementById('ve-split-container').getBoundingClientRect().width),
    };
  });
  expect(r.perde).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);   // PERDE VAR
  expect(r.tiklama).not.toBe('none');
  expect(r.ortaliMi).toBe(true);                                          // ORTADA duruyor
  expect(r.tuvalAcik).toBe(kapali);                                       // tuval DARALMADI
});
