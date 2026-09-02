/**
 * modal-acilis.spec.js — MODAL AÇILIŞ HAREKETİ (gerçek tarayıcı)
 *
 * Node'da HİÇ koşmayan halka: `display:none → flex` geçişinin CSS
 * animasyonunu YENİDEN TETİKLEMESİ. Sınıf adına bakan bir birim testi bunu
 * göremez — kural CSS'te durur, tetikleme tarayıcının işidir. Bu yüzden kapı
 * HESAPLANMIŞ değere bakıyor (opacity/transform/background-color), sınıf
 * adına değil.
 *
 * Kullanıcı isteği (2026-09-02): sihirbaz açılınca "daha profesyonel"
 * görünsün. ÖLÇÜLDÜ: açılışta beklenecek iş yok (ilk 224 ms, sonrakiler
 * 7–10 ms), kusur modalın ekrana ÇARPMASIYDI.
 */
const { test, expect } = require('@playwright/test');

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && window.MFSimLoader.start) window.MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' &&
    typeof window.veFeadOpenEditor === 'function' &&
    typeof window.veFeadWizOpen === 'function' && Array.isArray(window.nodes),
    null, { timeout: 60000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 60000 });
}

// Açılıştan hemen SONRA yakalanan kare: hareket varsa modal daha yerine
// oturmamış olmalı (saydam ve/veya kaymış).
async function ilkKare(page, ac) {
  return page.evaluate((kod) => {
    // eslint-disable-next-line no-eval
    eval(kod);
    const ov = document.querySelector('.ve-settings-overlay[style*="flex"]')
            || [...document.querySelectorAll('.ve-settings-overlay')]
                 .find((o) => getComputedStyle(o).display !== 'none');
    if (!ov) return null;
    const box = ov.querySelector('.ve-settings-modal');
    const cs = getComputedStyle(box);
    return {
      id: ov.id,
      opacity: +cs.opacity,
      transform: cs.transform,
      zeminIlk: getComputedStyle(ov).backgroundColor,
      // animasyon ADI gerçekten bağlı mı
      animModal: cs.animationName,
      animKaplama: getComputedStyle(ov).animationName,
      sure: cs.animationDuration
    };
  }, ac);
}

test.describe('modal açılış hareketi', () => {
  test('SİHİRBAZ: açılışta modal saydam+kaymış başlıyor, sonra yerine oturuyor', async ({ page }) => {
    await bootApp(page);
    await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
    await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-wizard'), null, { timeout: 20000 });
    const id = await page.evaluate(() => window.nodes.find((n) => n.type === 'fead-wizard').id);

    const kare = await ilkKare(page, `veFeadWizOpen(${JSON.stringify(id)})`);
    console.log('AÇILIŞ ' + JSON.stringify(kare));

    expect(kare.id).toBe('ve-feadwiz-overlay');
    expect(kare.animModal).toBe('veModalIn');
    expect(kare.animKaplama).toBe('veModalOverlayIn');
    // Hareketin BAŞINDA: ya henüz saydam ya da henüz kaymış — ikisi de
    // "yerine oturmuş" DEĞİL. Sabit bir eşik kırılgan olurdu (ilk kare
    // makineye göre kayar); yakalanan şey "başlangıç durumu var mı".
    const yerindeDegil = kare.opacity < 0.999 || (kare.transform !== 'none' && kare.transform !== 'matrix(1, 0, 0, 1, 0, 0)');
    expect(yerindeDegil).toBe(true);

    // Bitince TAM yerinde
    await page.waitForFunction(() => {
      const b = document.querySelector('#ve-feadwiz-overlay .ve-settings-modal');
      if (!b) return false;
      const cs = getComputedStyle(b);
      return +cs.opacity === 1 && (cs.transform === 'none' || cs.transform === 'matrix(1, 0, 0, 1, 0, 0)');
    }, null, { timeout: 4000 });

    const bitis = await page.evaluate(() => {
      const b = document.querySelector('#ve-feadwiz-overlay .ve-settings-modal');
      return { opacity: +getComputedStyle(b).opacity, transform: getComputedStyle(b).transform };
    });
    console.log('BİTİŞ  ' + JSON.stringify(bitis));
    expect(bitis.opacity).toBe(1);
  });

  test('İKİNCİ açılışta hareket YENİDEN tetikleniyor (display none↔flex)', async ({ page }) => {
    await bootApp(page);
    await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
    await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-wizard'), null, { timeout: 20000 });
    const id = await page.evaluate(() => window.nodes.find((n) => n.type === 'fead-wizard').id);

    // Aç, bitmesini bekle, kapat, YENİDEN aç.
    await page.evaluate((wid) => veFeadWizOpen(wid), id);
    await page.waitForFunction(() => {
      const b = document.querySelector('#ve-feadwiz-overlay .ve-settings-modal');
      return b && +getComputedStyle(b).opacity === 1;
    }, null, { timeout: 4000 });
    await page.evaluate(() => veFeadWizClose(false));

    const kare = await ilkKare(page, `veFeadWizOpen(${JSON.stringify(id)})`);
    console.log('İKİNCİ AÇILIŞ ' + JSON.stringify(kare));
    // Tetiklenmeseydi opacity 1 ve transform none olurdu — animasyon bir kez
    // koşup bitmiş sayılırdı. Kapı tam olarak bunu tutuyor.
    const yerindeDegil = kare.opacity < 0.999 || (kare.transform !== 'none' && kare.transform !== 'matrix(1, 0, 0, 1, 0, 0)');
    expect(yerindeDegil).toBe(true);
  });

  test('prefers-reduced-motion: hareket TAMAMEN kapanıyor', async ({ page }) => {
    // Kaynakta `@media` aramak yetmez: kural yanlış seçiciye yazılırsa grep
    // yine bulur. Ölçülen şey tarayıcının HESAPLADIĞI değer.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await bootApp(page);
    await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
    await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-wizard'), null, { timeout: 20000 });
    const id = await page.evaluate(() => window.nodes.find((n) => n.type === 'fead-wizard').id);

    const kare = await ilkKare(page, `veFeadWizOpen(${JSON.stringify(id)})`);
    console.log('AZALTILMIŞ HAREKET ' + JSON.stringify(kare));
    expect(kare.animModal).toBe('none');
    expect(kare.animKaplama).toBe('none');
    // Ve modal ilk karede ZATEN yerinde — bekleme yok, sıçrama yok.
    expect(kare.opacity).toBe(1);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(kare.transform);
  });

  test('AYNI hareket dört modalın hepsinde — sihirbaza özel değil', async ({ page }) => {
    await bootApp(page);
    const hepsi = await page.evaluate(() => {
      const o = {};
      ['ve-status-overlay', 've-import-overlay', 've-feadwiz-overlay', 've-settings-overlay'].forEach((id) => {
        const ov = document.getElementById(id);
        const box = ov && ov.querySelector('.ve-settings-modal');
        o[id] = {
          kaplama: ov ? getComputedStyle(ov).animationName : null,
          pencere: box ? getComputedStyle(box).animationName : null
        };
      });
      return o;
    });
    console.log('DÖRT MODAL ' + JSON.stringify(hepsi));
    Object.keys(hepsi).forEach((id) => {
      expect(hepsi[id].kaplama).toBe('veModalOverlayIn');
      expect(hepsi[id].pencere).toBe('veModalIn');
    });
  });
});
