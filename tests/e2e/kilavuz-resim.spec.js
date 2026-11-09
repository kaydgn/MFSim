/**
 * kilavuz-resim.spec.js — KILAVUZUN EKRAN GÖRÜNTÜLERİ PROGRAMLA AYNI
 *
 * Takoz kılavuzunun HTML olarak çizilemeyen yüzeyleri (karşılama, tuval, sihirbaz,
 * Sonuçlar, 3B, rapor) programın ekran görüntüsüdür (tools/kilavuz-resim.js →
 * assets/kilavuz/). Görüntü, program değişince kendiliğinden değişmez: düğme
 * taşınır, numara boşluğa düşer ve hiçbir birim testi bunu görmez — guide-kit.js
 * ekran görüntüsünü bu yüzden reddetmişti ("resim sessizce yalan söyler").
 *
 * Bu kapı aynı turu (`tur`) GÖRÜNTÜSÜZ yürür ve her işaretin kutusunu künyeyle
 * karşılaştırır: öğe kaybolduysa ya da 12 px'ten fazla kaydıysa kırmızı.
 * Çare görüntüleri yenilemektir:
 *     MFSIM_CHROMIUM=/opt/pw-browsers/chromium node tools/kilavuz-resim.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('../../tools/kilavuz-resim.js');
test.setTimeout(240000);

// Piksel: CI'nın Chrome'u yazıyı birkaç piksel farklı ölçebilir; numara 12 px'ten
// fazla kayarsa öğesinden ayrılmış görünür.
const TOL_PX = 12;
const OLCU_PX = 8;

test('ekran görüntülerinin işaretleri programdaki öğelerin yerinde', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-kilavuz-'));
  try {
    await R.programiAc(page, '/index.html');
    const sonuc = await R.tur(page, { step: R.denemeStep(dizin) });
    const kunye = JSON.parse(fs.readFileSync(R.KUNYE, 'utf8')).resim;
    expect(Object.keys(sonuc).sort()).toEqual(Object.keys(kunye).sort());
    const fark = [];
    Object.keys(kunye).forEach((ad) => {
      const o = sonuc[ad], k = kunye[ad];
      if (Math.abs(o.g - k.g) > OLCU_PX || Math.abs(o.y - k.y) > OLCU_PX)
        fark.push(ad + ': ölçü ' + o.g + '×' + o.y + ' (künye ' + k.g + '×' + k.y + ')');
      o.yok.forEach((x) => fark.push(ad + '.' + x + ': öğe yok'));
      Object.keys(k.isaret).forEach((x) => {
        const a = k.isaret[x], b = o.isaret[x];
        if (!b) return;
        const d = Math.max.apply(null, a.map((v, i) => Math.abs(v - b[i]) * (i % 2 ? k.y : k.g)));
        if (d > TOL_PX) fark.push(ad + '.' + x + ': ' + Math.round(d) + ' px kaydı');
      });
    });
    expect(fark, 'Görüntüleri yenileyin: MFSIM_CHROMIUM=/opt/pw-browsers/chromium node tools/kilavuz-resim.js')
      .toEqual([]);
    expect(hatalar).toEqual([]);
  } finally {
    fs.rmSync(dizin, { recursive: true, force: true });
  }
});
