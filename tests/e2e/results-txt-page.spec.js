/**
 * MFSim E2E — TXT raporunun Sonuçlar penceresindeki görünümü (Playwright)
 *
 * Buradaki iki iddia Node'da HİÇ ölçülemez, çünkü ikisi de YERLEŞİMDİR:
 *
 *   1) Ekranın tepesinden geçen yatay çizgi panel ayırıcısında KIRILMASIN —
 *      soldaki "Veri Gezgini" bandı ile rapor bandı aynı yerde bitsin.
 *      Ölçülen hata (1600×950): 36px'e karşı 48px, alt çizgiler 12px kayık.
 *
 *   2) Belge A4 SAYFA olsun ve metin tek blok halinde sola yaslansın.
 *      Ölçülen hata: 43 <pre> bloğu, 10 ayrı sol kenar, 222px yayılım —
 *      "fiş gibi duruyor" (kullanıcı şikâyeti 2026-08-25).
 *
 * Rapor METNİ burada üretilmez: test edilen şey kabuk, içerik değil. Gerçek
 * kod yolu (veRenderTXTReport → veTxtPreviewShow → .ve-rep-page) koşar, yalnız
 * metin üreticisi sabit bir metinle değiştirilir — böylece test bir simülasyon
 * koşusuna ve onun sayılarına bağlı kalmaz. Sütun profili gerçeğini taklit
 * eder: dar bölümler ~80, geniş tablolar 119 karakter (ölçüldü).
 */

const { test, expect } = require('@playwright/test');

// Gerçek Tam Gaz raporunun sütun profili: 80'lik bölümler + 119'luk tablolar.
const DAR = '  Motor                            | Cummins ISG12 380HP';
const GENIS = '  ' + '─'.repeat(115) + '  ';
const ORNEK_TXT = [
  'TAM GAZ HIZLANMA  ·  PERFORMANS HESAP RAPORU', '',
  DAR, DAR, '', '',
  GENIS, '  ' + 'x'.repeat(117), GENIS, '',
  DAR, ''
].join('\n');

async function bootApp(page) {
  await page.goto('/index.html');
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForFunction(
    () => typeof window.veSubTabDegistir === 'function' &&
          typeof window.veRenderTXTReport === 'function',
    null, { timeout: 90000 });
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.evaluate(() => veSelectModuleFromOverlay('arac-performans'));
}

async function txtOnizlemeAc(page, metin) {
  await page.evaluate((txt) => {
    veSubTabDegistir('sonuclar');
    window.veSimResults = { time: [0, 1], reportSnapshot: null };
    window.veGenerateFTTxtReport = () => txt;    // yalnız METİN sahte
    veRenderTXTReport('ft');
  }, metin);
  // Sonuçlar sayfasının açılış animasyonu (0.40–0.46s) yerleşimi 10px kaydırır;
  // ölçüm bitmiş yerleşimde yapılmalı.
  await page.waitForTimeout(900);
}

test.describe('TXT rapor önizlemesi — üst bant ve A4 sayfa', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 950 });
    await bootApp(page);
    await txtOnizlemeAc(page, ORNEK_TXT);
  });

  test('bant panel ayırıcısında KIRILMIYOR — iki yarı aynı yerde bitiyor', async ({ page }) => {
    const o = await page.evaluate(() => {
      const sol = document.querySelector('.ve-results-head').getBoundingClientRect();
      const sag = document.querySelector('.ve-rep-head').getBoundingClientRect();
      return { solAlt: sol.bottom, sagAlt: sag.bottom, solH: sol.height, sagH: sag.height };
    });
    expect(Math.abs(o.solAlt - o.sagAlt)).toBeLessThanOrEqual(1);   // ölçülen eski fark: 12px
    expect(Math.abs(o.solH - o.sagH)).toBeLessThanOrEqual(1);       // ölçülen eski fark: 36 ↔ 48
  });

  test('iki başlık aynı puntoda', async ({ page }) => {
    const o = await page.evaluate(() => ({
      sol: getComputedStyle(document.querySelector('.ve-results-head-title')).fontSize,
      sag: getComputedStyle(document.querySelector('.ve-rep-head-title')).fontSize
    }));
    expect(o.sag).toBe(o.sol);   // ölçülen eski fark: 12px ↔ 13px
  });

  test('sayfa A4 genişliğinde ve içeriğe göre daralmıyor', async ({ page }) => {
    const w = await page.evaluate(() =>
      document.getElementById('ve-txt-report-content').getBoundingClientRect().width);
    expect(w).toBeCloseTo(794, 0);   // 210 mm @96dpi
  });

  test('metin TEK blok ve TEK sol kenar — fiş görüntüsü yok', async ({ page }) => {
    const o = await page.evaluate(() => {
      const pres = [...document.querySelectorAll('#ve-txt-report-content pre')];
      const kenarlar = new Set(pres.map((p) => Math.round(p.getBoundingClientRect().x)));
      return { blok: pres.length, kenar: kenarlar.size };
    });
    expect(o.blok).toBe(1);    // ölçülen eski: 43
    expect(o.kenar).toBe(1);   // ölçülen eski: 10 ayrı kenar, 222px yayılım
  });

  test('119 sütunluk tablo sayfaya SIĞIYOR — yatay kaydırma yok', async ({ page }) => {
    const o = await page.evaluate(() => {
      const sayfa = document.getElementById('ve-txt-report-content');
      const pre = sayfa.querySelector('pre');
      const st = getComputedStyle(sayfa);
      const icerikW = sayfa.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
      return {
        preW: pre.getBoundingClientRect().width,
        icerikW,
        tasma: sayfa.scrollWidth > sayfa.clientWidth + 1,
        fontPx: parseFloat(getComputedStyle(pre).fontSize)
      };
    });
    expect(o.tasma).toBe(false);
    expect(o.preW).toBeLessThanOrEqual(o.icerikW + 1);
    expect(o.fontPx).toBeGreaterThan(8);     // okunabilirlik tabanı
    expect(o.fontPx).toBeLessThanOrEqual(11);// --rep-fs-max tavanı
  });

  test('dar rapor tavan puntoyla açılır (sayfayı doldurmak için şişmez)', async ({ page }) => {
    await txtOnizlemeAc(page, [DAR, '', DAR, ''].join('\n'));   // yalnız 80 sütun
    const fontPx = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector('#ve-txt-report-content pre')).fontSize));
    expect(fontPx).toBeCloseTo(11, 1);
  });
});
