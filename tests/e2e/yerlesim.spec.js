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
 * SVG çizimin yazısı da kapıda (2026-10-14, C2): ekranda 9,5 px altı yazı ve
 * aynı çizimde üst üste binen iki yazı. Eski kodda Takoz kesit çiziminde 32
 * küçük yazı + 9 çakışma, kütüphane grafiğinde 5, gergi grafiğinde 11,
 * sihirbazın gülünde 8. Kayış Yolu penceresinin şemasındaki 18 küçük yazı
 * bilerek açık (S12 — aşağıda `MUAF`).
 *
 * Çizgi yazıyı kesmez, düğüm adları birbirine değmez (2026-10-15, C3): eski
 * kodda FEAD turunda 15, Takoz turunda 81 yazının içinden bir çizgi geçiyordu
 * (kayış, gergi kolu, salınım çemberi, merkez mesafesi, ızgara ve kılavuz
 * çizgileri) ve Tulga topolojisinde "Koordinat Düzlemi" ile "3D
 * Görüntüleyici" arasında 0 px vardı. Turlar artık iki örneğin topolojisini de
 * ölçüyor.
 * Dökmek için `YERLESIM_DOKUM=<önek>` — her tur `<önek>-<tur>.txt`ye yazar.
 *
 * SAYI YAZIMI da aynı turda (2026-10-15, S4·B): her ölçüm noktasında ekrandaki
 * yazı + SVG yazısı + `title` + tuvale çizilen yazı Türkçe sayı ölçütüyle
 * taranır (tests/helpers/sayi-olcu.js — pencere ve belge taramasıyla aynı
 * ölçüt). Pencere taraması sihirbazları, Sonuçlar'ı ve ikincil pencereleri
 * görmüyordu: eski kodda tireli eksi turda 53 (AP 28 · FEAD 25), pencere
 * taramasında 11. Gerçek eksi "%"den sonra satır kırabiliyor (UAX #14: tire
 * HY, eksi PR sınıfı) — yerleşim ölçeri FEAD çözücüsünde "%|−2,9"u yakaladı.
 *
 * Node'da koşamaz: jsdom yerleşim hesaplamaz.
 */
const { test, expect } = require('@playwright/test');
const { yerlesimKur, yerlesimOzet } = require('../helpers/yerlesim-olcu.js');
const { tara } = require('../helpers/sayi-olcu.js');
const T = require('./helpers/yuzey-turu');

test.describe.configure({ timeout: 300000 });
// GitHub API'si fikstürden (helpers/github-fikstur.js): servis çalışanının çektiği
// istek route'a uğramaz.
test.use({ serviceWorkers: 'block' });

function olcucu(page, liste, sayilar) {
  return async (kok, yer) => {
    const r = await page.evaluate((k) => {
      const el = document.querySelector(k);
      if (el) el.querySelectorAll('details:not([open])').forEach((d) => { d.open = true; });
      return window.__yerlesim(k);
    }, kok);
    yerlesimOzet(r, yer).forEach((x) => liste.push(x));
    // Sayı yazımı: ölçülen kökün yazısı + bir önceki ölçümden beri tuvale çizilen yazı
    const metin = await page.evaluate((k) => {
      const el = document.querySelector(k), parca = [];
      if (el) {
        // Ölçüt programın YAZDIĞI sayıya bakar; iki istisna okunurken görünmez
        // yapılır (visibility kutuyu korur, yerleşim ölçümü zaten bitti):
        //   <code>               makine metni — commit kısaltması "0352592" yalnız
        //                        rakamdan oluşabiliyor ((10/16)^7 ≈ %4)
        //   [data-ve-dis-metin]  programın yazmadığı metin — commit konusu o
        //                        kısaltmayı içinde taşıyabiliyor
        // Eski yol metinden kodun İLK eşleşmesini siliyordu: aynı kısaltma daha
        // yeni bir commit'in konusunda önce geçince silinen o oluyor, kod yerinde
        // kalıyordu (#1119–#1120'de e2e-urun kırmızı).
        const dis = [...el.querySelectorAll('code, [data-ve-dis-metin]')];
        const eski = dis.map((d) => d.style.visibility);
        dis.forEach((d) => { d.style.visibility = 'hidden'; });
        parca.push(el.innerText || '');
        dis.forEach((d, i) => { d.style.visibility = eski[i]; });
        el.querySelectorAll('svg text').forEach((x) => parca.push(x.textContent));
        el.querySelectorAll('[title]').forEach((x) => { if (!x.closest('[data-ve-dis-metin]')) parca.push(x.getAttribute('title')); });
      }
      parca.push((window.__sayiFill || []).join('\n'));
      window.__sayiFill = [];
      return parca.join('\n');
    }, kok);
    tara(metin).sorun.forEach((s) => sayilar.push(`${yer} · ${s.tur} "${s.sayi}" ⟨${s.bag}⟩`));
    return r;
  };
}

// BİLEREK AÇIK — karar bekleyen tasarım sorusu (artifact). Muafiyet KURALIN
// yerine geçmez: her biri turunda HÂLÂ gerçekleşiyor mu ölçülür, karar
// uygulanınca eskiyen muafiyet testi kırar (sessizce kalmasın).
const MUAF = [
  { tur: 'FEAD', re: /^fead-layout(\/\w+)? · çizimde küçük yazı /,
    neden: 'S12 — Kayış Yolu penceresinin şeması kartın küçük resmi: yazı ölçeği kanvas kartıyla ortak '
      + '(7–9 birim, 1:1). 1,4 kat büyütme denendi: çizim küçülüyor, üç etiket çifti çakışıyor.' },
];

const TURLAR = [
  ['kabuk', 'arac-performans', T.kabukTuru],
  ['Araç Performans', 'arac-performans', T.apTuru],
  ['Takoz', 'mount-analysis', T.takozTuru],
  ['FEAD', 'arac-performans', T.feadTuru],
];

for (const [ad, modul, tur] of TURLAR) {
  test(`${ad}: yazı kutusuna sığıyor — kesik, kırık sözcük, yatay kaydırma, küçük yazı, yetim, yapışkan şerit, çizimde çakışma ve çizgi yok; sayılar Türkçe`, async ({ page }) => {
    const liste = [], sayilar = [];
    const olc = olcucu(page, liste, sayilar);
    await page.addInitScript(() => {
      window.__sayiFill = [];
      const f = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (s) { window.__sayiFill.push(String(s)); return f.apply(this, arguments); };
    });
    await T.bootApp(page, { modul, kur: yerlesimKur, w: 1920, h: 952,
      karsilama: ad === 'kabuk' ? () => olc('#ve-module-overlay', 'karşılama') : null });
    await tur(page, olc);
    if (process.env.YERLESIM_DOKUM) require('fs').writeFileSync(process.env.YERLESIM_DOKUM + '-' + ad.replace(/\s+/g, '_') + '.txt', liste.join('\n'));
    expect.soft(sayilar).toEqual([]);   // ayrı liste: yerleşim düşse de sayı bulgusu basılır
    const muaf = MUAF.filter((m) => m.tur === ad);
    expect(liste.filter((x) => !muaf.some((m) => m.re.test(x)))).toEqual([]);
    muaf.forEach((m) => expect(`${m.neden.slice(0, 40)}: ${liste.some((x) => m.re.test(x))}`).toBe(`${m.neden.slice(0, 40)}: true`));
  });
}
