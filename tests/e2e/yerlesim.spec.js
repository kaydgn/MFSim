/**
 * yerlesim.spec.js — EKRANDAKİ YAZI KUTUSUNA SIĞIYOR MU?
 * ───────────────────────────────────────────────────────────────────────
 *
 * `mufettis-sigma.spec.js` pencerenin SÜTUNA sığdığını ölçüyor. Sığan bir
 * pencerenin İÇİNDE yazı yine bozulabiliyordu ve o kapı bunu göremiyordu
 * (eski kodda Araç Performans 17, FEAD 16 bulgu):
 *   · kesik    Motor-Şanzıman Eşleştirme tablosunda şanzıman sütunu ~30 px'e
 *              iniyor, adlar üç noktayla kırpılıyordu ("3…"; tam ad yalnız
 *              satırın ipucunda)
 *   · yatay    sihirbazın kapı tabloları 234 px'lik sütunda kendi kabında
 *              44 px, çözücünün konum tablosu 6 px yatay kayıyordu
 *   · kırık    lejant adları tirede bölünüyordu ("TC-/411"), rapor no da
 *   · yetim    "(limit: 336 kW ✓" satırının ")"si alt satırda tek başına
 *   · küçük    c₂ tablosunun grup başlığı 8,3 px
 *   · yapı     sihirbaz hapında "L<sub>b</sub>" esnek kapta "L b" düşüyordu
 *   · yapışkan "Hesapla"nın altında 10 px'lik şeritten kayan yazı görünüyordu
 * Ölçüt tests/helpers/yerlesim-olcu.js'te (matematiği birim testte düşebiliyor);
 * gezilen yüzeyler kontrast kapısıyla AYNI tur (tests/e2e/helpers/yuzey-turu.js).
 * Ekran: kullanıcının ölçüm ekranı, 1920 × 952.
 *
 * SVG çizimin yazısı (küçük · binen) ölçülür ama kapı DIŞINDA: çizicilerin
 * yerleşimi ayrı bir tur. Görmek için `YERLESIM_DOKUM=<önek>` — her tur
 * `<önek>-<tur>.txt`ye HTML bulgularını ve "--- çizim" altında SVG'ninkileri yazar.
 *
 * Node'da koşamaz: jsdom yerleşim hesaplamaz.
 */
const { test, expect } = require('@playwright/test');
const { yerlesimKur, yerlesimOzet } = require('../helpers/yerlesim-olcu.js');
const T = require('./helpers/yuzey-turu');

test.describe.configure({ timeout: 300000 });

function olcucu(page, liste, cizimListe) {
  return async (kok, yer) => {
    const r = await page.evaluate((k) => {
      const el = document.querySelector(k);
      if (el) el.querySelectorAll('details:not([open])').forEach((d) => { d.open = true; });
      return window.__yerlesim(k);
    }, kok);
    yerlesimOzet(r, yer, { cizim: false }).forEach((x) => liste.push(x));
    if (cizimListe) yerlesimOzet({ kesik: [], kirik: [], yatay: [], kucuk: [], yapi: [], yetim: [], yapiskan: [], kucukSvg: r.kucukSvg, binen: r.binen }, yer)
      .forEach((x) => cizimListe.push(x));
    return r;
  };
}

const TURLAR = [
  ['kabuk', 'arac-performans', T.kabukTuru],
  ['Araç Performans', 'arac-performans', T.apTuru],
  ['Takoz', 'mount-analysis', T.takozTuru],
  ['FEAD', 'arac-performans', T.feadTuru],
];

for (const [ad, modul, tur] of TURLAR) {
  test(`${ad}: yazı kutusuna sığıyor — kesik, kırık sözcük, yatay kaydırma, küçük yazı, yetim, yapışkan şerit yok`, async ({ page }) => {
    const liste = [], cizim = [];
    const olc = olcucu(page, liste, cizim);
    await T.bootApp(page, { modul, kur: yerlesimKur, w: 1920, h: 952,
      karsilama: ad === 'kabuk' ? () => olc('#ve-module-overlay', 'karşılama') : null });
    await tur(page, olc);
    if (process.env.YERLESIM_DOKUM) require('fs').writeFileSync(process.env.YERLESIM_DOKUM + '-' + ad.replace(/\s+/g, '_') + '.txt', liste.concat(['--- çizim'], cizim).join('\n'));
    expect(liste).toEqual([]);
  });
}
