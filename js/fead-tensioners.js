// ============================================================================
//  FEAD — OTOMATİK GERGİ KÜNYE KÜTÜPHANESİ
// ============================================================================
// `fead-tensioner` bileşeninin katalog katmanı. DOM'suz ve saf veri: panel
// (js/cp-fead.js) buradan okur, buraya HİÇBİR ŞEY yazmaz. Kalıp
// js/fead-belts.js ve js/structural-materials.js ile aynı.
//
// Kullanıcı isteği (2026-08-28): *"Bu otomatik gergi özelliklerini de Gates
// raporlarından kalibre ederek çekeceğiz."*
//
// ── KAYITLAR ÖLÇÜLDÜ, PARÇA NUMARASI UYDURULMADI ────────────────────────────
// Aşağıdaki 14 künyenin tamamı `tests/fixtures/fead-validation.js` içindeki
// Gates raporlarından çıkarıldı — yani doğrulama kapısının kullandığı AYNI
// sayılar. Kayıtlar KAYNAK RAPORLA adlandırıldı ve öyle kalıyor: anahtar
// hangi ölçümden geldiğini söyler, parça numarası ise ayrı bir alandır.
//
// > **DÜZELTME (2026-08-28).** Bu blok bir dönem *"Gates raporları gerginin
// > PARÇA NUMARASINI yazmıyor; tek bilinen E9843 ve o da tek bir aracın montaj
// > çiziminden geliyor"* diyordu. `docs/gates-reports/pdf/` arşivi kurulunca
// > ÖLÇÜLDÜ ve tutmadı: on raporun ONUNDA da parça kodu raporun kendi
// > **Drive Notes** alanında yazıyor, üstelik DÖRT ayrı kod —
// > `Tensioner T38624; CW; 24.6Nm` · `Tensioner Gates T38665; 31Nm` ·
// > `E9843, 22Nm@27°, CCW@115/260` · `T38519 (29.5Nm): CCW@-303/7`.
// > Kodlar artık `part` alanında ve `tests/unit/gates-archive.test.js`
// > her birini kaynağına karşı denetliyor. Arşivde PDF'i olmayan dört
// > AG00976 kaydı `part` TAŞIMIYOR — doğrulanamayan bir kod yazmak, tam da
// > kaçınılmak istenen şey olurdu.
//
// Aynı alan bir şey daha ele verdi: Drive Notes BAĞIL AÇIYI da yazıyor
// (`E9843/16Nm@15°` · `/19Nm@21°` · `/22.5Nm@28°`) ve bunlar künyeden
// hesaplanan `(mean−pre)/rate` ile birebir tutuyor (15.07 · 20.99 · 27.96).
//
// ── HANGİ ALAN PARÇANIN, HANGİSİ MONTAJIN — ÖLÇÜLDÜ ─────────────────────────
// Ayrım tahmin değil: AG0868 ailesi AYNI gergiyi üç farklı kayış genişliğiyle
// kullanıyor ve yalnız bir alan değişiyor.
//
//     8PK: pre 8.56 · rate 0.501 · mean 22.57 Nm → rel 27.96°
//     6PK: pre 8.65 · rate 0.495 · mean 19.04 Nm → rel 20.99°
//     4PK: pre 8.46 · rate 0.505 · mean 16.07 Nm → rel 15.07°
//
// `preload` ve `rate` %2 içinde sabit (aynı yay), `meanLoad` ise kayış
// genişliğiyle ölçekleniyor. Yani:
//
//   PARÇA:  armLen · preloadNm · rateNmPerDeg · kasnak çapı · temas tarafı
//   MONTAJ: meanLoadNm — kolun ne kadar kurulduğu, yani bir TASARIM AYARI
//
// Bu yüzden künyeyi uygulamak `meanLoad`ı da yazar (bir başlangıç noktası
// gerekiyor) ama kütüphane `relNomDeg`i AYRICA taşıyor: kullanıcı kendi kayış
// genişliğine göre ayarı değiştirdiğinde neyin parçadan neyin karardan
// geldiğini görebilsin.
//
// ── ÖLÇÜLEN İKİ AİLE ────────────────────────────────────────────────────────
// 14 kaydın 13'ü tek bir gövde ailesinden: kol 90 mm, kasnak Ø77.2 mm, sırttan
// temas, yay katsayısı 0.475–0.505 Nm/° (±%3), ön yük 8.46–9.31 Nm (AG00810
// hariç: 11.561). Tek istisna AG00879: kol 56 mm, Ø76.2, katsayı 0.409, ön yük
// 20.05 — belirgin şekilde başka bir parça.
//
// NOMİNAL DÖNME ~28° VE BU RASTLANTI DEĞİL: kol 90 ailesinin tam genişlikli
// (8PK) dokuz kaydında (M_mean − M₀)/k = 27.10 … 29.62°. Kullanıcının
// gönderdiği E9843 montaj çizimi aynı sayıyı yazıyor:
//   *"PIN POSITION FOR THE 344° MEAN ANGLE AND 22.5 Nm SPRING TORQUE
//     @ 28° FREEARM-MEAN ROTATION"*
// Yani parçanın kendi değişmezi BAĞIL dönmedir; MUTLAK açı montaja aittir ve
// zarftan seçilir (bkz. js/fead-model.js "PİVOT GİRDİ, KOL AÇISI ZARFTAN").
//
// ── KÜTÜPHANE BİR SERTİFİKA DEĞİL ───────────────────────────────────────────
// Değerler tek tek raporlardan okunmuş ÖLÇÜMLERDİR, bir üretici kataloğu
// değil. Aynı gövde farklı yay indeksleriyle satılıyor olabilir; buradaki
// bant o 14 raporun gördüğü banttır. Panel bunu listenin ÜSTÜNDE yazıyor
// (structural-materials.js'in "nominal ≠ sertifika" kuralının aynısı).
var VE_FEAD_TEN_LIB_VERSION = '1.0.0';
var VE_FEAD_TEN_LIB_SOURCE  = 'Gates ABDS raporları (14 sistem), '
  + 'tests/fixtures/fead-validation.js';

// key      : benzersiz kimlik = kaynak rapor
// src      : raporun kendi adı
// armLen   : pivot ↔ kasnak merkezi [mm]  (PARÇA)
// preloadNm: serbest koldaki yay momenti M₀  (PARÇA)
// rateNm   : yay katsayısı k [Nm/°]  (PARÇA)
// meanNm   : çalışma momenti M_mean  (MONTAJ AYARI — kayış genişliğine bağlı)
// od       : gergi kasnağı dış çapı [mm]  (PARÇA)
// contact  : kayışın hangi yüzüne değiyor  (PARÇA)
// inertia  : kasnak ataleti [kg·m²] — raporunda varsa
// ribs     : künyenin ölçüldüğü kayış genişliği (meanNm bunun için geçerli)
var VE_FEAD_TENSIONER_DB = [
  { key:'AG00976-1715', src:'AG00976 · 8PK1715HD · Ten@-250/110',
    armLen:90, preloadNm:8.60, rateNm:0.480, meanNm:22.07, od:77.2, contact:'back',
    inertia:null, ribs:8, note:'E9843 (montaj çizimi: 28° FreeArm–Mean)' },
  { key:'AG00976-1705', src:'AG00976 · 1705 mm · Ten@-250/110',
    armLen:90, preloadNm:9.11, rateNm:0.483, meanNm:22.66, od:77.2, contact:'back',
    inertia:null, ribs:8, note:'' },
  { key:'AG00976-1668', src:'AG00976 · 1668 mm · Ten@-240/115',
    armLen:90, preloadNm:8.87, rateNm:0.484, meanNm:22.43, od:77.2, contact:'back',
    inertia:null, ribs:8, note:'' },
  { key:'AG00976-1655', src:'AG00976 · 1655 mm · Ten@-250/104',
    armLen:90, preloadNm:8.99, rateNm:0.484, meanNm:22.54, od:77.2, contact:'back',
    inertia:null, ribs:8, note:'' },
  { key:'AG00879', part:'T38665', src:'AG00879 · 5 kasnak · kol 56 mm',
    armLen:56, preloadNm:20.05, rateNm:0.409, meanNm:31.14, od:76.2, contact:'back',
    inertia:null, ribs:8, note:'Bandın DIŞINDA: kısa kollu ayrı bir gövde' },
  { key:'AG00894', part:'E9843', src:'AG00894 · 6 kasnak',
    armLen:90, preloadNm:8.93, rateNm:0.475, meanNm:23.00, od:77.2, contact:'back',
    inertia:0.0002, ribs:8, note:'' },
  { key:'AG00902-1300', part:'E9843', src:'AG00902 · 1300 mm · 4 kasnak',
    armLen:90, preloadNm:9.31, rateNm:0.476, meanNm:22.21, od:77.2, contact:'back',
    inertia:0.0004, ribs:8, note:'' },
  { key:'AG00902-1275', part:'E9843', src:'AG00902 · 1275 mm · 4 kasnak',
    armLen:90, preloadNm:9.13, rateNm:0.480, meanNm:22.15, od:77.2, contact:'back',
    inertia:0.0004, ribs:8, note:'' },
  { key:'AG00686', part:'T38624', src:'AG00686 · 8PK1475 · 4 kasnak',
    armLen:90, preloadNm:8.59, rateNm:0.482, meanNm:24.54, od:77.2, contact:'back',
    inertia:0.0076, ribs:8, note:'Nominal dönme 33.1° — banttan yüksek ayar' },
  { key:'AG00686-1520', part:'T38624', src:'AG00686 · 1520 mm',
    armLen:90, preloadNm:8.86, rateNm:0.476, meanNm:22.20, od:77.2, contact:'back',
    inertia:0.0076, ribs:8, note:'' },
  { key:'AG0868-8PK', part:'E9843', src:'AG0868 · 3 kasnak · 8PK',
    armLen:90, preloadNm:8.56, rateNm:0.501, meanNm:22.57, od:77.2, contact:'back',
    inertia:0.0009, ribs:8, note:'' },
  { key:'AG0868-6PK', part:'E9843', src:'AG0868 · 3 kasnak · 6PK',
    armLen:90, preloadNm:8.65, rateNm:0.495, meanNm:19.04, od:77.2, contact:'back',
    inertia:0.0009, ribs:6, note:'Aynı gövde, dar kayış → düşük ayar' },
  { key:'AG0868-4PK', part:'E9843', src:'AG0868 · 3 kasnak · 4PK',
    armLen:90, preloadNm:8.46, rateNm:0.505, meanNm:16.07, od:77.2, contact:'back',
    inertia:0.0009, ribs:4, note:'Aynı gövde, dar kayış → düşük ayar' },
  { key:'AG00810', src:'AG00810 · 4 kasnak',
    armLen:90, preloadNm:11.561, preloadDerived:true, rateNm:0.483, meanNm:29.48,
    od:77.2, contact:'back', inertia:0.0004, ribs:10, part:'T38519',
    note:'Ön yük RAPORDA YOK — mean torktan türetildi (11.561). Ayar bandın üstünde.' }
];

// Kol 90 mm ailesinin ÖLÇÜLEN bandı. Uydurma bir tolerans değil: yukarıdaki
// kayıtların kendi en küçük/en büyüğü. Panel bunu bir KISIT olarak değil bir
// KARŞILAŞTIRMA olarak kullanıyor — kullanıcının elindeki gergi listede
// olmayabilir ve bu bir hata değildir.
//
// BANT KAYITLARDAN TÜRETİLİR, ELLE YAZILMAZ. İlk sürüm yuvarlanmış sınırlar
// taşıyordu ve kapı bunu yakaladı: `(16.07 − 8.46)/0.505 = 15.0693…`, elle
// yazılan alt sınır ise 15.07 — yani kütüphane KENDİ kaydını "bandın dışında"
// ilan ediyordu. Elle yazılmış bir sınır ayrıca yeni bir kayıt eklendiğinde
// sessizce eskir. (Kart ölçüsünün "ikinci kopya" dersinin aynısı.)
var VE_FEAD_TEN_BAND = (function(){
  var f = function(sel){
    var v = VE_FEAD_TENSIONER_DB.map(sel).filter(function(x){ return isFinite(x); });
    return { min: Math.min.apply(null, v), max: Math.max.apply(null, v) };
  };
  var rel = function(r){ return (r.meanNm - r.preloadNm) / r.rateNm; };
  var tam = VE_FEAD_TENSIONER_DB.filter(function(r){ return r.armLen === 90 && r.ribs === 8; })
    .map(rel).filter(function(x){ return x < 30; });   // 33.1 ve 37.1 ayarları hariç
  return {
    armLen:    f(function(r){ return r.armLen; }),
    preloadNm: f(function(r){ return r.preloadNm; }),
    rateNm:    f(function(r){ return r.rateNm; }),
    relNomDeg: f(rel),
    od:        f(function(r){ return r.od; }),
    // Tam genişlikli (8PK) kol-90 kayıtlarının nominal dönme bandı; E9843
    // çiziminin "28°"i tam buraya düşüyor.
    relNom8PK: { min: Math.min.apply(null, tam), max: Math.max.apply(null, tam) }
  };
})();

// ═══════════════════════════════════════════════════════════════════════════
//  PARÇA ÇİZİMİ — MONTAJ CIVATASI, KOL EKSENİ VE KONUM PİMİ
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı (2026-08-29) E9843'ün parça çizimini verdi: *"Genelde hemen hemen
// tüm otomatik gergilerin görünümü böyle. Yani teknik resimleri bu."*
//
// ── AÇIK KALAN SORU KAPANDI: CIVATA İLE PİVOT EŞEKSENLİ ───────────────────
// Model, gerginin motora bağlandığı noktayı kolun dönme ekseni SAYIYORDU ve bu
// bir VARSAYIMDI (kanonik kayıtta *"ölçülmedi"* diye işaretliydi): eksantrik
// bir gövdede montaj noktası pivottan kaçık olurdu ve zarfın merkezi yanlış
// yere düşerdi. Çizim bunu kapatıyor — gövdenin büyük dairesinin merkezinde
// eşmerkezli bir delik var ve kol tam o eksende dönüyor. Yani:
//
//     montaj cıvatası  ≡  kol dönme ekseni  ≡  pivot
//
// Bu, `angleMode:'envelope'` girdisinin tanımının ta kendisi ve artık ölçülü.
//
// ── SAAT KONUMUNU PİM BELİRLİYOR — ZARF FİZİKSEL OLARAK GERÇEKLENİYOR ─────
// Çizimin başlığı doğrudan bunu söylüyor:
//     "E9843 PIN POSITION FOR THE 344° MEAN ANGLE AND 22.5 Nm SPRING TORQUE
//      @ 28° FREEARM-MEAN ROTATION"
// Yani gövdenin montajdaki saati serbest bir tercih DEĞİL, bir KONUM PİMİYLE
// sabitleniyor — ve çizim, istenen çalışma açısı için pimin nereye konacağını
// veriyor. Zarf seçimi (θ*) bu yüzden soyut bir optimizasyon değil: imalatta
// pimin açısı olarak gerçekleniyor.
//
// ── ÇİZİMDEN OKUNAN GEOMETRİ — aritmetiği kendi içinde tutuyor ────────────
//   basılı ölçüler   : yatay 19,51 mm · dikey 24,09 mm · açı 51° · kol 16°
//   pim yarıçapı     : √(19,51² + 24,09²) = 30,9995 ≈ 31,00 mm
//   pim açısı        : atan(24,09/19,51) = 50,997° ↔ basılı 51°  (−0,003°)
//   kol mutlak açısı : 360 − 16 = 344,0° ↔ künyedeki MEAN ANGLE  (birebir)
//   pim (sol-alt)    : 180 + 51,0 = 231,00°
//   PİM − KOL(mean)  : 231,00 − 344,00 = −113,00°   ← PARÇA SABİTİ
//
// OFSET NEDEN PARÇA SABİTİ: pim deliği GÖVDEDE, kolun çalışma konumu da
// gövdeye göre yay tarafından sabitlenmiş (28° free-arm→mean). Gövdeyi
// döndürmek ikisini BİRLİKTE döndürür, dolayısıyla aradaki açı değişmez.
// Bunun sonucu doğrudan kullanılabilir bir imalat çıktısı:
//
//     pim açısı = θ* + ofset
//
// ── ÇİZİMİN KENDİ ÇAPRAZ DOĞRULAMASI ─────────────────────────────────────
// Çizim "28° FREEARM-MEAN ROTATION" diyor; künyeden hesaplanan
// (M_mean − M₀)/k = (22,07 − 8,60)/0,480 = 28,0625° — **0,06° fark**. İki
// bağımsız kaynak (parça çizimi ↔ tedarikçi raporunun yay künyesi) aynı sayıyı
// veriyor. Çizimdeki yay momenti 22,5 Nm ise nominal; raporun künyesi 22,07.
//
// ── SAYILAR E9843'E AİT, MEKANİZMA GENEL ─────────────────────────────────
// Kullanıcının söylediği "hepsi böyle görünür" MEKANİZMA için geçerli (tek
// merkezî cıvata + saati belirleyen bir konum pimi). Yarıçap ve ofset ise
// PARÇAYA aittir ve yalnız çizimi elde olan parça için yazılıdır. Elde
// olmayan parçaya sayı UYDURULMAZ — okuyucular `null` alır ve panel/rapor
// "pim künyesi yok" der.
var VE_FEAD_TEN_PIN = {
  E9843: {
    rMm: 31.00,
    offsetDeg: -113.00,
    src: 'E9843 parça çizimi — "PIN POSITION FOR THE 344° MEAN ANGLE AND '
       + '22.5 Nm SPRING TORQUE @ 28° FREEARM-MEAN ROTATION"; basılı ölçüler '
       + '19,51 / 24,09 mm ve 51°'
  }
};

// Parçanın pim künyesi — yoksa null (uydurulmaz).
function veFeadTenPin(part){
  var r = part && VE_FEAD_TEN_PIN[part];
  if(!r) return null;
  return { part: part, rMm: r.rMm, offsetDeg: r.offsetDeg, src: r.src };
}

// Seçilen çalışma açısını GERÇEKLEYEN pim açısı. Zarf seçiminin imalat
// karşılığı budur: "θ*'ı istiyorsan pimi buraya koy."
function veFeadTenPinAngle(part, armAbsDeg){
  var p = veFeadTenPin(part);
  if(!p || !Number.isFinite(Number(armAbsDeg))) return null;
  var a = (Number(armAbsDeg) + p.offsetDeg) % 360;
  if(a < 0) a += 360;
  return { part: part, rMm: p.rMm, offsetDeg: p.offsetDeg, angleDeg: a, src: p.src };
}

// Nominal (çalışma) kol dönmesi — SALT YAY KÜNYESİNDEN.
function veFeadTenRelNom(rec){
  if(!rec) return NaN;
  var p = Number(rec.preloadNm), k = Number(rec.rateNm), m = Number(rec.meanNm);
  if(!isFinite(p) || !isFinite(m) || !isFinite(k) || !(k > 0)) return NaN;
  return (m - p) / k;
}

function veFeadTensionerList(){
  return VE_FEAD_TENSIONER_DB.map(function(r){
    var c = {}; Object.keys(r).forEach(function(k){ c[k] = r[k]; });
    c.relNomDeg = veFeadTenRelNom(r);
    return c;                                  // KOPYA — katalog salt okunur
  });
}

// ── SEÇİM ETİKETİ — TEK ÜRETİCİ ────────────────────────────────────────────
//
// Kullanıcı isteği (2026-08-31): *"Otomatik gergi tiplerinde Gates raporları
// yazıyor. Bunu kaldıralım, sadece kol uzunluğu ve çalışma momenti yazsın."*
//
// Etiket iki yüzeyde birden basılıyor (Çözücü/Gergi paneli ve sihirbazın gergi
// adımı). İki kopya tutmak, birinin sessizce eskimesi demekti — bu deponun
// tekrar eden kuralı: aynı listeyi gösteren iki yüzey TEK üreticiden beslenir.
//
// `src` (kaynak rapor adı) DÜŞÜYOR ve bu ayrımı bozmuyor — ÖLÇÜLDÜ: 14 kaydın
// 14'ü de "kol X mm · Y Nm" ile TEKİL; en yakın iki kayıt 22,20 ↔ 22,21 Nm.
// İki ondalık ŞART: bire indirilirse o çift çakışır ve kullanıcı iki farklı
// künyeyi ayırt edemez. Kaynak rapor kayıtta (`key`, `src`) DURUYOR — düşen
// yalnız seçim listesinin metni.
function veFeadTenLabel(rec){
  if(!rec) return '';
  var a = Number(rec.armLen), m = Number(rec.meanNm);
  if(!Number.isFinite(a) || !Number.isFinite(m)) return String(rec.key || '');
  return 'kol ' + a + ' mm · ' + m.toFixed(2) + ' Nm';
}

function veFeadTensionerOf(key){
  var l = veFeadTensionerList();
  for(var i = 0; i < l.length; i++) if(l[i].key === key) return l[i];
  return null;
}

// Arama — `structural-materials.js`'in katlama kuralının aynısı: Türkçe
// büyük/küçük harf dönüşümü `toLowerCase()` ile TEK BAŞINA doğru değil
// ('I' → 'ı', 'İ' → noktalı i).
function _fdTenFold(s){
  return String(s == null ? '' : s)
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/ş/g, 's').replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u').replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .toLowerCase();
}

function veFeadTensionerFind(q){
  var t = _fdTenFold(q).trim();
  var l = veFeadTensionerList();
  if(!t) return l;
  return l.filter(function(r){
    return _fdTenFold(r.key).indexOf(t) >= 0
        || _fdTenFold(r.src).indexOf(t) >= 0
        || _fdTenFold(r.note).indexOf(t) >= 0;
  });
}

// Kayıt → düğüm alanları. KOPYA yazılır, referans DEĞİL: kütüphane sürümü
// değişip bir değer düzeltilse bile kaydedilmiş proje kendiliğinden değişmez
// (structural-materials.js'in kendi kuralı; bu projenin en çok kaçındığı hata
// sınıfı bir katalog güncellemesinin eski bir analizi sessizce değiştirmesi).
//
// PİVOT VE KOL AÇISI YAZILMAZ: ikisi de MONTAJA aittir, parçaya değil. Künye
// pivotu da taşısaydı kullanıcı bir kataloğun koordinatını kendi motoruna
// uygulamış olurdu.
function veFeadTensionerApply(td, rec){
  if(!td || !rec) return td;
  td.armLen   = rec.armLen;
  td.preload  = rec.preloadNm;
  td.kArm     = rec.rateNm;
  td.meanLoad = rec.meanNm;
  td.od       = rec.od;
  td.contact  = rec.contact;
  if(rec.inertia != null) td.inertia = rec.inertia;
  // PARÇA KODU DA KOPYALANIR — ve YOKSA SİLİNİR. Kod, pim künyesinin (ve
  // ileride başka parça verisinin) anahtarıdır; kayıtta yoksa geride bırakmak
  // bir sonraki künyenin pimini ÖNCEKİ parçanın çizimiyle hesaplatırdı.
  // Doğrulanamayan dört AG00976 kaydı bilerek kodsuz; silme o boşluğu korur.
  if(rec.part) td.tenPart = rec.part; else delete td.tenPart;
  td.tenLib    = rec.key;
  td.tenLibVer = VE_FEAD_TEN_LIB_VERSION;
  return td;
}

// Girilen künye ölçülen bandın neresinde? HÜKÜM DEĞİL, KARŞILAŞTIRMA.
// Kullanıcının gergisi 14 raporun dışından olabilir; bu bir hata değil, ama
// bir ondalık kayması da tam buradan görünür (rate 0.48 yerine 0.048 yazmak
// gereken kayışı 40 mm kaydırıyor — ölçüldü, bkz. CLAUDE.md).
function veFeadTensionerBandCheck(td){
  var out = { ok: true, outside: [], relNomDeg: NaN };
  if(!td) return out;
  var alanlar = [
    ['armLen',   Number(td.armLen),   'kol boyu',      'mm'],
    ['preloadNm',Number(td.preload),  'yay ön yükü',   'Nm'],
    ['rateNm',   Number(td.kArm),     'yay katsayısı', 'Nm/°'],
    ['od',       Number(td.od),       'kasnak çapı',   'mm']
  ];
  alanlar.forEach(function(a){
    var b = VE_FEAD_TEN_BAND[a[0]];
    if(!b || !isFinite(a[1]) || a[1] === 0) return;
    if(a[1] < b.min || a[1] > b.max)
      out.outside.push(a[2] + ' ' + a[1] + ' ' + a[3] + ' (ölçülen bant '
        + b.min + '…' + b.max + ')');
  });
  var rel = veFeadTenRelNom({ preloadNm: Number(td.preload), rateNm: Number(td.kArm),
                              meanNm: Number(td.meanLoad) });
  out.relNomDeg = rel;
  if(isFinite(rel) && (rel < VE_FEAD_TEN_BAND.relNomDeg.min
                    || rel > VE_FEAD_TEN_BAND.relNomDeg.max))
    out.outside.push('nominal kol dönmesi ' + rel.toFixed(2) + '° (ölçülen bant '
      + VE_FEAD_TEN_BAND.relNomDeg.min + '…' + VE_FEAD_TEN_BAND.relNomDeg.max + '°)');
  out.ok = out.outside.length === 0;
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_TEN_LIB_VERSION: VE_FEAD_TEN_LIB_VERSION,
    VE_FEAD_TEN_LIB_SOURCE: VE_FEAD_TEN_LIB_SOURCE,
    VE_FEAD_TENSIONER_DB: VE_FEAD_TENSIONER_DB,
    VE_FEAD_TEN_BAND: VE_FEAD_TEN_BAND,
    veFeadTenRelNom: veFeadTenRelNom,
    VE_FEAD_TEN_PIN: VE_FEAD_TEN_PIN,
    veFeadTenPin: veFeadTenPin, veFeadTenPinAngle: veFeadTenPinAngle,
    veFeadTensionerList: veFeadTensionerList,
    veFeadTenLabel: veFeadTenLabel,
    veFeadTensionerOf: veFeadTensionerOf,
    veFeadTensionerFind: veFeadTensionerFind,
    veFeadTensionerApply: veFeadTensionerApply,
    veFeadTensionerBandCheck: veFeadTensionerBandCheck
  };
}
