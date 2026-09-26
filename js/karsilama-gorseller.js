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

// KAYNAK ÖLÇÜSÜ [genişlik, yükseklik] px — webp başlığından ÜRETİLİR, elle
// yazılmaz: tools/karsilama-webp.js listeyle birlikte yeniden yazar,
// tests/unit/karsilama-slayt.test.js her dosyanın başlığıyla karşılaştırır.
var VE_KARSILAMA_OLCU = {
  'karsilama-01.webp': [1024, 683],
  'karsilama-02.webp': [1599, 899],
  'karsilama-04.webp': [1920, 1079],
  'karsilama-05.webp': [1920, 1299],
  'karsilama-06.webp': [1024, 683],
  'karsilama-07.webp': [1920, 1080],
  'karsilama-08.webp': [1920, 1080],
  'karsilama-09.webp': [1920, 1280],
  'karsilama-10.webp': [1920, 1280],
  'karsilama-11.webp': [1920, 1080],
  'karsilama-12.webp': [1920, 1080],
  'karsilama-13.webp': [1920, 1080],
  'karsilama-14.webp': [1600, 1064],
  'karsilama-16.webp': [1384, 924],
  'karsilama-17.webp': [1387, 924],
  'karsilama-18.webp': [1024, 576],
  'karsilama-19.webp': [1015, 772],
  'karsilama-20.webp': [1384, 925],
  'karsilama-21.webp': [1384, 922],
  'karsilama-22.webp': [1384, 922],
  'karsilama-24.webp': [1384, 921],
  'karsilama-25.webp': [1200, 800],
  'karsilama-26.webp': [1200, 800],
  'karsilama-27.webp': [1385, 935],
  'karsilama-28.webp': [1389, 926],
  'karsilama-29.webp': [1386, 924],
  'karsilama-30.webp': [1386, 924],
  'karsilama-31.webp': [1386, 924],
  'karsilama-32.webp': [1920, 1280],
  'karsilama-33.webp': [1920, 1440],
  'karsilama-34.webp': [1920, 1278],
  'karsilama-35.webp': [1920, 1238],
  'karsilama-36.webp': [1920, 1278],
  'karsilama-37.webp': [1920, 1371],
  'karsilama-38.webp': [1920, 1080],
  'karsilama-39.webp': [1920, 1278],
  'karsilama-40.webp': [1920, 1280],
  'karsilama-41.webp': [1920, 1371],
  'karsilama-42.webp': [1920, 1440],
  'karsilama-43.webp': [1920, 1280],
  'karsilama-44.webp': [1920, 1278],
  'karsilama-45.webp': [1600, 1200],
  'karsilama-46.webp': [1600, 1200],
  'karsilama-47.webp': [1600, 1200],
  'karsilama-48.webp': [1600, 1200],
  'karsilama-49.webp': [1920, 1280],
  'karsilama-50.webp': [1898, 1326],
  'karsilama-51.webp': [1600, 1200]
};

// EKRANDA ×1,25'TEN FAZLA BÜYÜYEN KARE DÖNMEZ (kullanıcı kararı 6·2,
// 2026-09-26). Kare ekranı KAPLAR (cover): büyütme = ekran/kare oranlarının
// büyüğü, fiziksel pikselle. Dosyalar KALIR — karelerin kalitesi düşürülmez
// kararı duruyor; liste ekrana göre süzülür. Ölçüsü bilinmeyen kare elenmez.
// EŞİK EN İYİ KAREYE GÖRE ÖLÇEKLENİR: ekran her kareden büyükse (4K'da en
// keskin kare bile ×2) sabit eşik hepsini eler ve liste ya boşalır ya da
// en bulanık kareler dâhil hepsine döner. Eşik = 1,25 × en küçük büyütme
// (1'in altındaysa 1) — 1920×1080'de karar olduğu gibi 1,25.
var VE_KARSILAMA_BUYUTME_ESIGI = 1.25;

function veKarsilamaEkranaUygun(liste, ekranW, ekranH) {
  var hepsi = (liste || []).slice();
  if (!(ekranW > 0 && ekranH > 0)) return hepsi;
  var buyutme = function (ad) {
    var o = VE_KARSILAMA_OLCU[ad];
    return o ? Math.max(ekranW / o[0], ekranH / o[1]) : null;
  };
  var enAz = Infinity;
  hepsi.forEach(function (ad) { var b = buyutme(ad); if (b !== null && b < enAz) enAz = b; });
  var esik = VE_KARSILAMA_BUYUTME_ESIGI * Math.max(1, isFinite(enAz) ? enAz : 1);
  var uygun = hepsi.filter(function (ad) { var b = buyutme(ad); return b === null || b <= esik + 1e-9; });
  return uygun.length ? uygun : hepsi;
}

// Ekranın fiziksel pikseli (ekran × piksel oranı). Pencere değil EKRAN: kare
// tam ekranda en fazla bu kadar büyür, pencere büyütülünce liste eskimez.
function veKarsilamaEkranOlcusu() {
  if (typeof window === 'undefined') return [0, 0];
  var s = window.screen || {};
  var dpr = window.devicePixelRatio || 1;
  var w = s.width || window.innerWidth || 0;
  var h = s.height || window.innerHeight || 0;
  return [Math.round(w * dpr), Math.round(h * dpr)];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_KARSILAMA_GORSELLER: VE_KARSILAMA_GORSELLER,
    VE_KARSILAMA_OLCU: VE_KARSILAMA_OLCU,
    veKarsilamaEkranaUygun: veKarsilamaEkranaUygun
  };
}
