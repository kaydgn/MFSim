/**
 * marka-tutarli.spec.js — MARKA AÇILIŞTAN KARŞILAMAYA AYNI ÇİZİLİYOR MU?
 * ────────────────────────────────────────────────────────────────────────
 *
 * ÖLÇÜLEN KUSUR (2026-09-22): "MFSim" yazısı açılış ekranında -0,2px,
 * karşılama ekranında +0,5px tracking ile çiziliyordu — aynı yüz (Source
 * Serif 4), aynı boy (20px), saniyeler arayla. Devir teslimde marka
 * görünür biçimde geniyordu.
 *
 * Sebep bir renk tercihi değil KASKAD: başlık bağlaması
 * (`h1..h4, .mfsim-loading-logo, .ve-welcome-logo { letter-spacing:-0.01em }`)
 * ile üç elemanın kendi `letter-spacing:0.5px` bildirimi AYNI özgüllükte.
 * İkisinde bağlama SONRA geldiği için kazanıyordu (bildirim ölüydü),
 * `.ve-welcome-logo` ise bağlamadan sonra tanımlı olduğu için KAZANIYORDU.
 * `0.5px` eski SANS marka yazısından kalmaydı.
 *
 * 2026-09-23'ten beri marka serif değil — tek yüz, Inter. Aynı gün açılış
 * ekranı AMBLEM'e geçti: açılışta marka BÜYÜK (--fs-amblem), karşılamada
 * kartın logosu (--fs-h2). Kural "aynı boy" değil "aynı aile, aynı ağırlık,
 * aynı em-iz" oldu — küçültülmüş açılış markası logonun KENDİSİ olmalı,
 * yoksa uçuş inişte genleyen ya da daralan bir markaya döner.
 *
 * Üçüncü halka bunu ÇİZİMDE ölçüyor ve ölçülmüş ikinci bir kusuru da
 * kapatıyor: eski uçuş hedefi karşılamanın giriş koreografisi BAŞLADIKTAN
 * sonra ölçüyordu — kart o an translateX(-16px), logo translateY(14px)'te —
 * ve marka logonun duracağı yerin 16 px solunda, 14 px altında iniyordu;
 * klon kalkınca logo ~21 px sıçrıyordu.
 *
 * Bu halkalar Node'da koşamaz: jsdom kaskadı çözmez, `letterSpacing`i
 * hesaplamaz, metin genişliği ölçmez, animasyon oynatmaz.
 */
const { test, expect } = require('@playwright/test');

const olc = (sel) => {
  const el = document.querySelector(sel);
  const cs = getComputedStyle(el);
  return {
    yuz: cs.fontFamily.split(',')[0].replace(/"/g, ''),
    agirlik: cs.fontWeight,
    izEm: +(parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize)).toFixed(4),
    boy: cs.fontSize,
  };
};

async function acilisBitsin(page) {
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || getComputedStyle(s).display === 'none';
  }, null, { timeout: 90000 });
  await page.waitForTimeout(500);
}

test('marka açılışta ve karşılamada AYNI aile, ağırlık ve em-iz ile çiziliyor', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/index.html');

  // Açılış ekranı DURURKEN ölç — yükleyici başlamadan.
  const acilis = await page.evaluate(olc, '#mfsim-loading-screen .mfsim-loading-logo');
  await acilisBitsin(page);
  const karsilama = await page.evaluate(olc, '.ve-welcome-logo');

  const { boy: aBoy, ...a } = acilis;
  const { boy: kBoy, ...k } = karsilama;
  expect(k).toEqual(a);                              // aile, ağırlık, em-iz BİREBİR
  expect(a.yuz).toBe('Inter');                       // tek yüz — marka da gövdeyle aynı aile
  expect(a.izEm).toBe(-0.01);                        // bağlamadan, iki ekranda da
  // Boy BİLEREK farklı: açılışta amblem, karşılamada logo.
  expect([aBoy, kBoy]).toEqual(['80px', '20px']);
});

test('markanın GENİŞLİĞİ tracking farkını gösterecek kadar duyarlı', async ({ page }) => {
  // Kapının boşa çalışmadığının kanıtı: eski değeri geri koyunca yazı
  // GERÇEKTEN geniyor. Tracking eşitliği ölçmek tek başına, ölçülen şeyin
  // görünür bir fark olduğunu söylemez.
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/index.html');
  await acilisBitsin(page);

  const fark = await page.evaluate(() => {
    const yazi = document.querySelector('.ve-welcome-logo span:last-child');
    const simdi = yazi.getBoundingClientRect().width;
    yazi.parentElement.style.letterSpacing = '0.5px';   // ESKİ değer
    const eski = yazi.getBoundingClientRect().width;
    yazi.parentElement.style.letterSpacing = '';
    return { simdi: +simdi.toFixed(2), eski: +eski.toFixed(2), d: +(eski - simdi).toFixed(2) };
  });
  // 5 karakter × 0,7px = ~3,5px — %5'lik bir genleme, göz ayırır
  expect(fark.d).toBeGreaterThan(2.5);
});

test('devir teslimde marka logonun ÜSTÜNE iniyor — kalkışta kaynakta, inişte hedefte', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  // Uçuş başlar başlamaz yakala: klonlar body'nin çocuğu olarak doğuyor.
  await page.waitForFunction(() => document.querySelector('body > .mfsim-loading-logo'),
    null, { timeout: 90000, polling: 'raf' });

  const r = await page.evaluate(() => {
    const k = (e) => {
      const q = e.getBoundingClientRect();
      return { x: q.left, cy: q.top + q.height / 2, w: q.width };
    };
    const ad = document.querySelector('body > .mfsim-loading-logo');
    const cark = document.querySelector('body > .mfsim-loading-logo-ico');
    const ucus = [ad, cark].filter(Boolean).flatMap((e) => e.getAnimations());
    // Uçuşu DONDUR ve iki ucunu ölç. `pause` → bitiş olayı gelmez, klonlar
    // yerinde kalır (olay gelseydi temizlik onları söküp götürürdü).
    ucus.forEach((a) => { a.pause(); a.currentTime = 0; });
    const kalkis = {
      ad: k(ad.lastElementChild),
      adKaynak: k(document.querySelector('#mfsim-loading-screen .mfsim-loading-logo').lastElementChild),
      cark: k(cark),
      carkKaynak: k(document.getElementById('mfsim-loading-logo-ico')),
    };
    ucus.forEach((a) => { a.currentTime = a.effect.getComputedTiming().endTime; });
    // Karşılamanın giriş koreografisi bitsin: hedef DURACAĞI yerde ölçülür.
    document.getAnimations().forEach((a) => { if (!ucus.includes(a)) { try { a.finish(); } catch (e) {} } });
    const inis = {
      ad: k(ad.lastElementChild),
      adHedef: k(document.querySelector('.ve-welcome-logo').lastElementChild),
      cark: k(cark),
      carkHedef: k(document.querySelector('.ve-welcome-logo-ico')),
    };
    return { sayi: ucus.length, kalkis, inis };
  });

  expect(r.sayi).toBe(2);                            // ad ve çark AYRI uçuyor
  const ustUste = (a, b) => {
    // Sol kenar, dikey orta, genişlik: üçü birlikte "aynı yerde aynı boyda".
    // Genişlik, iz ya da ağırlık ayrışırsa inişte markanın genlemesini yakalar.
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.5);
    expect(Math.abs(a.cy - b.cy)).toBeLessThan(0.5);
    expect(Math.abs(a.w - b.w)).toBeLessThan(0.5);
  };
  ustUste(r.kalkis.ad, r.kalkis.adKaynak);           // kalkışta sıçrama yok
  ustUste(r.kalkis.cark, r.kalkis.carkKaynak);
  ustUste(r.inis.ad, r.inis.adHedef);                // inişte sıçrama yok
  ustUste(r.inis.cark, r.inis.carkHedef);
});
