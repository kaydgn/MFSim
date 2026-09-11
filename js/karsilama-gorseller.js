// ═══ KARŞILAMA SLAYTI — KARE LİSTESİ ═══
// DOM'suz saf veri. Sıra ÖNEMSİZ: liste çalışma anında karıştırılıyor
// (js/components.js › veWelcomeSlaytBaslat).
//
// Dosyalar assets/karsilama/ altında durur ve build.js her birini data URI
// olarak window.__MFSIM_KARSILAMA'ya gömer — program tek dosya olarak
// file:// ile açılıyor, gömülmeyen bir resim orada YOK demektir. Modüler
// index.html'de künye olmadığı için dosya yolundan okunur.
//
// Liste ile klasör AYRIŞAMAZ: tests/unit/karsilama-slayt.test.js iki yönlü
// tutuyor (öksüz dosya yok, eksik kayıt yok).
var VE_KARSILAMA_GORSELLER = [
  'karsilama-01.webp',
  'karsilama-02.webp',
  'karsilama-04.webp',
  'karsilama-05.webp',
  'karsilama-06.webp',
  'karsilama-07.webp',
  'karsilama-08.webp',
  'karsilama-09.webp',
  'karsilama-10.webp',
  'karsilama-11.webp',
  'karsilama-12.webp',
  'karsilama-13.webp',
  'karsilama-14.webp',
  'karsilama-16.webp',
  'karsilama-17.webp',
  'karsilama-18.webp',
  'karsilama-19.webp',
  'karsilama-20.webp',
  'karsilama-21.webp',
  'karsilama-22.webp',
  'karsilama-24.webp',
  'karsilama-25.webp',
  'karsilama-26.webp',
  'karsilama-27.webp',
  'karsilama-28.webp',
  'karsilama-29.webp',
  'karsilama-30.webp',
  'karsilama-31.webp',
  'karsilama-32.webp',
  'karsilama-33.webp',
  'karsilama-34.webp',
  'karsilama-35.webp',
  'karsilama-36.webp',
  'karsilama-37.webp',
  'karsilama-38.webp',
  'karsilama-39.webp',
  'karsilama-40.webp',
  'karsilama-41.webp',
  'karsilama-42.webp',
  'karsilama-43.webp',
  'karsilama-44.webp',
  'karsilama-45.webp',
  'karsilama-46.webp',
  'karsilama-47.webp',
  'karsilama-48.webp',
  'karsilama-49.webp',
  'karsilama-50.webp',
  'karsilama-51.webp'
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VE_KARSILAMA_GORSELLER: VE_KARSILAMA_GORSELLER };
}
