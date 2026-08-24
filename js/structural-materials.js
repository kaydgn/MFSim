// ============================================================================
//  YAPISAL ANALİZ — MALZEME KÜTÜPHANESİ
// ============================================================================
// `str-material` bileşeninin katalog katmanı. DOM'suz ve saf veri: panel
// (js/cp-structural.js) buradan okur, buraya HİÇBİR ŞEY yazmaz.
//
// ── BU DOSYA NE DEĞİLDİR ────────────────────────────────────────────────────
// Bir MALZEME SERTİFİKASI değildir. Buradaki sayılar ilgili standardın ya da
// yerleşik el kitaplarının NOMİNAL / tipik değerleridir; gerçek bir parçanın
// gerçek dökümü bunlardan sapar. Kütüphane bir BAŞLANGIÇ NOKTASI verir —
// hüküm verilecek bir analizde değerler tedarikçinin muayene belgesiyle
// (EN 10204 3.1 vb.) doğrulanmalıdır. Panel bunu kullanıcıya da YAZIYOR;
// sessiz bırakmak, katalog değerini ölçülmüş değer sanmaya davet olurdu.
//
// ── HEPSİ 20 °C ──────────────────────────────────────────────────────────────
// Tek bir sıcaklık noktası. Sıcaklığa bağlı E(T), σ(T) eğrileri YOK: çözücü
// izotermal lineer elastik. Sıcaklık alanı gelince tablo genişler.
//
// ── NEDEN BU ALANLAR ────────────────────────────────────────────────────────
// Çözücünün istediği liste `cp-structural.js`'te yazılı (E, ν zorunlu; ρ, σ_ak,
// σ_ç, α birer YETENEĞİ açar). Kütüphane onlara iki REFERANS alan ekliyor:
//     k   ısıl iletkenlik  [W/(m·K)]
//     cp  özgül ısı        [J/(kg·K)]
// İkisi de ÇÖZÜCÜYE GİTMİYOR (ısıl analiz henüz yok) ve panelde bu yazılı.
// Kayda da yazılmıyorlar — kullanılmayan bir alanı düğüme kopyalamak, ileride
// "bu sayı nereden geldi" sorusunu doğuran ölü veridir.
//
// ── UYDURULMAYAN ŞEYLER (raporun §9 kalıbı) ─────────────────────────────────
//   Kompozit laminatlar   → ORTOTROP. Bu malzeme kartı izotrop: tek E, tek ν.
//                           E1/E2/G12/ν12 + katman dizilimi ayrı bir kart ister.
//   Sıcaklık eğrileri     → yukarıda.
//   S-N yorulma eğrileri  → yorulma çözücüsü yok; σ_ak yalnız emniyet payı için.
//   Akma sonrası davranış → çözücü lineer elastik; pekleşme eğrisi kullanılmaz.
//   Anizotropi            → haddeleme yönü, eklemeli imalatta katman yönü.
//   Beton / ahşap / zemin → bu modül braket ve taşıyıcı METAL parçalar için.
//
// ── DOĞRULAMA NEREDE ────────────────────────────────────────────────────────
// tests/unit/structural-materials.test.js her kaydı fiziksel değişmezlerden
// geçiriyor: kimlik tekilliği, ν aralığı, σ_ak ≤ σ_ç, sınıf başına E ve ρ
// pencereleri, TÜRETİLEN kayma modülünün (G = E/2(1+ν)) sınıfın yayımlanmış
// aralığına düşmesi — bu sonuncusu bir ν yazım hatasını yakalayan kapıdır —
// ve her kaydın `veStrMatValidate`'ten HATASIZ geçmesi.
// ----------------------------------------------------------------------------

// Kütüphane sürümü. Uygulanan kayda YAZILIR (`libVer`): bir proje bir yıl sonra
// açıldığında hangi katalog sürümünden geldiği okunabilsin. Katalog değeri
// düzeltilirse eski projedeki sayı KENDİLİĞİNDEN DEĞİŞMEZ — kayıt düğümde
// duruyor, kütüphaneye referansla değil kopyayla bağlı. Bu bilinçli: bir
// katalog güncellemesinin kaydedilmiş bir analizi sessizce değiştirmesi,
// bu projenin en çok kaçındığı hata sınıfıdır.
var VE_STR_MAT_LIB_VERSION = '1.0';
var VE_STR_MAT_LIB_TEMP_C = 20;

// ── KATEGORİLER ─────────────────────────────────────────────────────────────
// `eWin` / `rhoWin` / `gWin`: sınıfın FİZİKSEL penceresi — testin kapısı.
// Bir kaydın E'si ya da ν'sü yanlış yazılırsa türetilen G pencereden çıkar.
// Pencereler geniş tutuldu: amaç "doğru değeri dayatmak" değil, YAZIM HATASI
// ve ONDALIK KAYMASI yakalamak.
var VE_STR_MAT_CATS = [
  { key:'celik-yapi',      ad:'Yapı Çelikleri',            eWin:[195000,215000], rhoWin:[7700,7900], gWin:[76000,84000] },
  { key:'celik-islah',     ad:'Islah ve Sementasyon Çelikleri', eWin:[195000,215000], rhoWin:[7700,7900], gWin:[76000,84000] },
  { key:'celik-yay',       ad:'Yay Çelikleri',             eWin:[195000,215000], rhoWin:[7700,7900], gWin:[76000,84000] },
  { key:'celik-paslanmaz', ad:'Paslanmaz Çelikler',        eWin:[190000,225000], rhoWin:[7600,8100], gWin:[73000,88000] },
  { key:'dokme-celik',     ad:'Dökme Çelik',               eWin:[195000,215000], rhoWin:[7700,7900], gWin:[76000,84000] },
  { key:'dokme-demir',     ad:'Dökme Demir',               eWin:[ 78000,180000], rhoWin:[6900,7400], gWin:[30000,72000] },
  { key:'alu-dovme',       ad:'Alüminyum — Dövme/Ekstrüzyon', eWin:[65000,80000], rhoWin:[2600,2900], gWin:[24000,29000] },
  { key:'alu-dokum',       ad:'Alüminyum — Döküm',         eWin:[ 65000, 80000], rhoWin:[2600,2800], gWin:[24000,29000] },
  { key:'bakir',           ad:'Bakır Alaşımları',          eWin:[ 90000,130000], rhoWin:[7400,9000], gWin:[33000,50000] },
  { key:'titanyum',        ad:'Titanyum Alaşımları',       eWin:[100000,120000], rhoWin:[4400,4600], gWin:[38000,46000] },
  { key:'magnezyum',       ad:'Magnezyum Alaşımları',      eWin:[ 40000, 50000], rhoWin:[1700,1900], gWin:[15000,19000] },
  { key:'nikel',           ad:'Nikel Alaşımları',          eWin:[170000,215000], rhoWin:[8100,9000], gWin:[65000,85000] },
  // 'Diğer Metaller' BİLEREK heterojen (çinko döküm ↔ tungsten ↔ kurşun), o
  // yüzden penceresi geniş: burada kapı bir SINIF denetimi değil, ondalık
  // kayması yakalayıcısıdır. Homojen kategorilerde pencere dardır ve bir ν
  // yazım hatası türetilen G üzerinden oradan yakalanır.
  { key:'diger-metal',     ad:'Diğer Metaller',            eWin:[ 15000,420000], rhoWin:[6500,19500], gWin:[ 5000,170000] },
  { key:'polimer',         ad:'Polimerler',                eWin:[   300, 12000], rhoWin:[ 890,2200], gWin:[  100,  5000] },
  { key:'elastomer',       ad:'Elastomerler',              eWin:[     1,    50], rhoWin:[ 900,1400], gWin:[    0.3,  20] },
  { key:'seramik',         ad:'Seramik ve Cam',            eWin:[ 60000,450000], rhoWin:[2200,6200], gWin:[24000,200000] }
];

// ── KAYIT BİÇİMİ ────────────────────────────────────────────────────────────
//   id    kalıcı anahtar (uygulanan kayda yazılır — ADI değil, çünkü ad
//         düzeltilebilir; kimlik düzeltilirse eski projelerin izi kopardı)
//   n     birincil gösterim (standardın kendi adı)
//   c     kategori anahtarı
//   std   standardın numarası — DEĞERİN NEREDEN GELDİĞİ
//   alt   diğer gösterimler: malzeme numarası (1.4301), eski/yabancı ad
//         (AISI 304, St 37-2), ticari ad. ARAMA bunların HEPSİNİ tarar —
//         aynı çeliğin üç ayrı adla anılması bu alanın varlık sebebi.
//         `alt` TEKİL olmak ZORUNDA: aynı gösterim iki malzemede geçerse arama
//         hangisini getireceğini bilemez ve kullanıcı YANLIŞ malzemeyi uygular.
//         Kapı bunu buldu: 'AL995' (alümina seramik) ile 'Al99,5' (saf
//         alüminyum) ayıraçlar atılınca aynı anahtara iniyordu — ρ 3890 ↔ 2710,
//         yani birbirinin yerine geçmesi sessiz ve ciddi bir hata olurdu.
//   fam   AİLE / ATÖLYE terimi: 'sfero', 'pik döküm', 'küresel grafitli'.
//         Arama bunları da tarar ama TEKİLLİK BEKLENMEZ — zaten bir aileyi
//         (beş GJS kalitesini birden) getirsin diye varlar. `alt`'tan ayrı
//         tutulmalarının sebebi bu: tekillik kapısı `alt`'a bakıyor.
//   E     MPa · nu — · rho kg/m³ · sy/su MPa · a 10⁻⁶/K
//   k     W/(m·K) · cp J/(kg·K)   ← REFERANS: çözücüye GİTMEZ
//   not   kaydın geçerlilik koşulu (kalınlık, ısıl işlem durumu…)
//   uyari bu çözücüyle ilgili YAPISAL bir kısıt (elastomer, gevrek malzeme)
//
// σ_ak (sy) GEVREK malzemelerde null'dur, 0 DEĞİL: seramik ve gri dökme demir
// akma göstermeden kırılır. 0 yazmak "emniyet payı sıfır" demek olurdu; null
// "bu malzemede akma dayanımı TANIMSIZ" demek ve panel `—` basıyor.
var VE_STR_MAT_LIB = [

// ── YAPI ÇELİKLERİ (EN 10025) ───────────────────────────────────────────────
// σ_ak değerleri en ince kalınlık kademesi (t ≤ 16 mm) içindir. EN 10025-2
// akma dayanımını kalınlıkla KADEMELİ düşürür (S355JR: 355 → 345 → 335 …);
// kalın levhada bu kaydı olduğu gibi kullanmak emniyet payını OLDUĞUNDAN
// BÜYÜK gösterir. Not alanı bunu her kayıtta söylüyor.
{ id:'s235jr', n:'S235JR', c:'celik-yapi', std:'EN 10025-2', alt:['1.0038','St 37-2','Fe 360 B','A283 Gr.C'],
  E:210000, nu:0.30, rho:7850, sy:235, su:360, a:12.0, k:50, cp:460, not:'t ≤ 16 mm; σ_ç 360–510 MPa bandının alt ucu' },
{ id:'s275jr', n:'S275JR', c:'celik-yapi', std:'EN 10025-2', alt:['1.0044','St 44-2','Fe 430 B'],
  E:210000, nu:0.30, rho:7850, sy:275, su:410, a:12.0, k:48, cp:460, not:'t ≤ 16 mm; σ_ç 410–560 MPa' },
{ id:'s355jr', n:'S355JR', c:'celik-yapi', std:'EN 10025-2', alt:['1.0045','St 52-3','Fe 510 B'],
  E:210000, nu:0.30, rho:7850, sy:355, su:470, a:12.0, k:45, cp:460, not:'t ≤ 16 mm; σ_ç 470–630 MPa' },
{ id:'s355j2', n:'S355J2', c:'celik-yapi', std:'EN 10025-2', alt:['1.0577','St 52-3 N'],
  E:210000, nu:0.30, rho:7850, sy:355, su:470, a:12.0, k:45, cp:460, not:'t ≤ 16 mm; −20 °C çentik darbe sınıfı' },
{ id:'s355k2', n:'S355K2', c:'celik-yapi', std:'EN 10025-2', alt:['1.0596'],
  E:210000, nu:0.30, rho:7850, sy:355, su:470, a:12.0, k:45, cp:460, not:'t ≤ 16 mm; −20 °C / 40 J' },
{ id:'s420n', n:'S420N', c:'celik-yapi', std:'EN 10025-3', alt:['1.8902'],
  E:210000, nu:0.30, rho:7850, sy:420, su:520, a:12.0, k:42, cp:460, not:'t ≤ 16 mm; normalize haddelenmiş' },
{ id:'s460n', n:'S460N', c:'celik-yapi', std:'EN 10025-3', alt:['1.8901'],
  E:210000, nu:0.30, rho:7850, sy:460, su:550, a:12.0, k:42, cp:460, not:'t ≤ 16 mm; normalize haddelenmiş' },
{ id:'s690ql', n:'S690QL', c:'celik-yapi', std:'EN 10025-6', alt:['1.8928','Weldox 700','Strenx 700'],
  E:210000, nu:0.30, rho:7850, sy:690, su:770, a:12.0, k:40, cp:460, not:'t ≤ 50 mm; su verilmiş + temperlenmiş' },
{ id:'s960ql', n:'S960QL', c:'celik-yapi', std:'EN 10025-6', alt:['1.8933','Strenx 960'],
  E:210000, nu:0.30, rho:7850, sy:960, su:980, a:12.0, k:40, cp:460, not:'t ≤ 50 mm; su verilmiş + temperlenmiş' },

// ── ISLAH VE SEMENTASYON ÇELİKLERİ (EN 10083 / EN 10084) ────────────────────
// Islah çeliklerinde σ_ak KESİT ÇAPINA çok bağlıdır (sertleşebilirlik):
// 42CrMo4 d ≤ 16 mm'de 900 MPa, d = 100 mm'de 650 MPa'ya iner. Not alanı
// hangi çap kademesinin yazıldığını söylüyor.
{ id:'c22e', n:'C22E', c:'celik-islah', std:'EN 10083-2', alt:['1.1151','Ck22','AISI 1020'],
  E:210000, nu:0.30, rho:7850, sy:340, su:500, a:11.7, k:50, cp:470, not:'normalize; d ≤ 16 mm' },
{ id:'c35e', n:'C35E', c:'celik-islah', std:'EN 10083-2', alt:['1.1181','Ck35','AISI 1035'],
  E:210000, nu:0.30, rho:7850, sy:430, su:630, a:11.6, k:48, cp:470, not:'ıslah (Q+T); d ≤ 16 mm' },
{ id:'c45e', n:'C45E', c:'celik-islah', std:'EN 10083-2', alt:['1.1191','Ck45','AISI 1045'],
  E:210000, nu:0.30, rho:7850, sy:490, su:700, a:11.5, k:45, cp:470, not:'ıslah (Q+T); d ≤ 16 mm' },
{ id:'c60e', n:'C60E', c:'celik-islah', std:'EN 10083-2', alt:['1.1221','Ck60','AISI 1060'],
  E:210000, nu:0.30, rho:7850, sy:580, su:850, a:11.1, k:45, cp:470, not:'ıslah (Q+T); d ≤ 16 mm' },
{ id:'25crmo4', n:'25CrMo4', c:'celik-islah', std:'EN 10083-3', alt:['1.7218','AISI 4130'],
  E:210000, nu:0.30, rho:7850, sy:700, su:900, a:12.3, k:42, cp:460, not:'ıslah; d ≤ 16 mm' },
{ id:'34cr4', n:'34Cr4', c:'celik-islah', std:'EN 10083-3', alt:['1.7033','AISI 5132'],
  E:210000, nu:0.30, rho:7850, sy:700, su:900, a:11.0, k:44, cp:460, not:'ıslah; d ≤ 16 mm' },
{ id:'42crmo4', n:'42CrMo4', c:'celik-islah', std:'EN 10083-3', alt:['1.7225','AISI 4140','708M40'],
  E:210000, nu:0.30, rho:7850, sy:900, su:1100, a:12.3, k:42, cp:460, not:'ıslah; d ≤ 16 mm (d = 100 mm için ≈ 650 MPa)' },
{ id:'34crnimo6', n:'34CrNiMo6', c:'celik-islah', std:'EN 10083-3', alt:['1.6582','AISI 4340'],
  E:210000, nu:0.30, rho:7850, sy:1000, su:1200, a:12.5, k:42, cp:460, not:'ıslah; d ≤ 16 mm' },
{ id:'30crnimo8', n:'30CrNiMo8', c:'celik-islah', std:'EN 10083-3', alt:['1.6580'],
  E:210000, nu:0.30, rho:7850, sy:1050, su:1250, a:12.5, k:40, cp:460, not:'ıslah; d ≤ 16 mm' },
{ id:'16mncr5', n:'16MnCr5', c:'celik-islah', std:'EN 10084', alt:['1.7131','AISI 5115'],
  E:210000, nu:0.30, rho:7850, sy:590, su:780, a:11.0, k:44, cp:460, not:'sementasyon çeliği — ÖZ değerleri (yüzey sertleştirilmiş kabuk ayrı)' },
{ id:'20mncr5', n:'20MnCr5', c:'celik-islah', std:'EN 10084', alt:['1.7147','AISI 5120'],
  E:210000, nu:0.30, rho:7850, sy:685, su:1000, a:11.0, k:44, cp:460, not:'sementasyon çeliği — ÖZ değerleri' },
{ id:'18crnimo7-6', n:'18CrNiMo7-6', c:'celik-islah', std:'EN 10084', alt:['1.6587'],
  E:210000, nu:0.30, rho:7850, sy:785, su:1080, a:11.0, k:42, cp:460, not:'sementasyon çeliği — ÖZ değerleri; ağır dişli standardı' },

// ── YAY ÇELİKLERİ (EN 10089) ────────────────────────────────────────────────
// E yapı çeliğinden bir tık DÜŞÜK (≈ 206 GPa) ve bu tesadüf değil: yay
// hesabında sehim doğrudan E ile ölçekleniyor, 210 yazmak yayı %2 sert
// gösterirdi.
{ id:'51crv4', n:'51CrV4', c:'celik-yay', std:'EN 10089', alt:['1.8159','AISI 6150','50CrV4'],
  E:206000, nu:0.30, rho:7850, sy:1200, su:1350, a:12.0, k:44, cp:460, not:'ıslah edilmiş yay durumu' },
{ id:'55cr3', n:'55Cr3', c:'celik-yay', std:'EN 10089', alt:['1.7176','AISI 5155'],
  E:206000, nu:0.30, rho:7850, sy:1200, su:1400, a:12.0, k:44, cp:460, not:'ıslah edilmiş yay durumu' },
{ id:'60sicr7', n:'60SiCr7', c:'celik-yay', std:'EN 10089', alt:['1.7108','60SiCr8'],
  E:206000, nu:0.30, rho:7850, sy:1300, su:1450, a:12.0, k:44, cp:460, not:'ıslah edilmiş yay durumu' },

// ── PASLANMAZ ÇELİKLER (EN 10088) ───────────────────────────────────────────
// ÜÇ AYRI AİLE, ÜÇ AYRI DAVRANIŞ: östenitik (manyetik değil, E ≈ 200 GPa,
// α yüksek), ferritik (manyetik, E ≈ 220 GPa, α düşük), martenzitik (ıslah
// edilebilir). α farkı 16 ↔ 10 — ısıl yükte iki kat.
{ id:'1.4301', n:'X5CrNi18-10', c:'celik-paslanmaz', std:'EN 10088-2', alt:['1.4301','AISI 304','SS304','18/10'],
  E:200000, nu:0.30, rho:7900, sy:210, su:520, a:16.0, k:15, cp:500, not:'östenitik, tavlanmış; σ_ç 520–720 MPa' },
{ id:'1.4307', n:'X2CrNi18-9', c:'celik-paslanmaz', std:'EN 10088-2', alt:['1.4307','AISI 304L','SS304L'],
  E:200000, nu:0.30, rho:7900, sy:200, su:500, a:16.0, k:15, cp:500, not:'östenitik, düşük karbonlu; kaynak sonrası korozyona dayanıklı' },
{ id:'1.4401', n:'X5CrNiMo17-12-2', c:'celik-paslanmaz', std:'EN 10088-2', alt:['1.4401','AISI 316','SS316'],
  E:200000, nu:0.30, rho:8000, sy:220, su:530, a:16.5, k:15, cp:500, not:'östenitik, molibdenli (klorür direnci)' },
{ id:'1.4404', n:'X2CrNiMo17-12-2', c:'celik-paslanmaz', std:'EN 10088-2', alt:['1.4404','AISI 316L','SS316L'],
  E:200000, nu:0.30, rho:8000, sy:220, su:520, a:16.5, k:15, cp:500, not:'östenitik, düşük karbonlu molibdenli' },
{ id:'1.4571', n:'X6CrNiMoTi17-12-2', c:'celik-paslanmaz', std:'EN 10088-2', alt:['1.4571','AISI 316Ti'],
  E:200000, nu:0.30, rho:8000, sy:240, su:540, a:16.5, k:15, cp:500, not:'östenitik, titanyum stabilize' },
{ id:'1.4016', n:'X6Cr17', c:'celik-paslanmaz', std:'EN 10088-2', alt:['1.4016','AISI 430'],
  E:220000, nu:0.30, rho:7700, sy:260, su:450, a:10.0, k:25, cp:460, not:'ferritik, manyetik; α östenitiğin yaklaşık yarısı' },
{ id:'1.4021', n:'X20Cr13', c:'celik-paslanmaz', std:'EN 10088-3', alt:['1.4021','AISI 420'],
  E:215000, nu:0.30, rho:7700, sy:500, su:700, a:10.5, k:30, cp:460, not:'martenzitik, ıslah edilmiş (Q+T 650)' },
{ id:'1.4542', n:'X5CrNiCuNb16-4', c:'celik-paslanmaz', std:'EN 10088-3', alt:['1.4542','17-4PH','630'],
  E:200000, nu:0.30, rho:7800, sy:1000, su:1070, a:10.8, k:16, cp:460, not:'çökelme sertleşmeli, H1025 durumu' },
{ id:'1.4462', n:'X2CrNiMoN22-5-3', c:'celik-paslanmaz', std:'EN 10088-2', alt:['1.4462','2205','duplex'],
  E:200000, nu:0.30, rho:7800, sy:460, su:640, a:13.0, k:15, cp:500, not:'dubleks (ferritik + östenitik)' },
{ id:'1.4310', n:'X10CrNi18-8', c:'celik-paslanmaz', std:'EN 10088-3', alt:['1.4310','AISI 301','yay paslanmaz'],
  E:195000, nu:0.30, rho:7900, sy:250, su:600, a:16.0, k:15, cp:500, not:'östenitik yay kalitesi, tavlanmış durum' },

// ── DÖKME ÇELİK (EN 10293) ──────────────────────────────────────────────────
{ id:'ge200', n:'GE200', c:'dokme-celik', std:'EN 10293', alt:['1.0420','GS-38'],
  E:210000, nu:0.30, rho:7850, sy:200, su:380, a:12.0, k:45, cp:460, not:'normalize; genel amaçlı dökme çelik' },
{ id:'ge240', n:'GE240', c:'dokme-celik', std:'EN 10293', alt:['1.0446','GS-45'],
  E:210000, nu:0.30, rho:7850, sy:240, su:450, a:12.0, k:45, cp:460, not:'normalize' },
{ id:'g20mn5', n:'G20Mn5', c:'dokme-celik', std:'EN 10293', alt:['1.6220','GS-20Mn5'],
  E:210000, nu:0.30, rho:7850, sy:300, su:500, a:12.0, k:44, cp:460, not:'normalize; düşük sıcaklık tokluğu' },
{ id:'g17crmo5-5', n:'G17CrMo5-5', c:'dokme-celik', std:'EN 10213', alt:['1.7357'],
  E:210000, nu:0.30, rho:7850, sy:315, su:490, a:12.0, k:42, cp:460, not:'ısıya dayanıklı dökme çelik' },

// ── DÖKME DEMİR (EN 1561 / 1563 / 1562 / 16079) ─────────────────────────────
// GRİ dökme demirin (GJL) İKİ tuzağı var ve ikisi de burada yazılı:
//  1) E ÇELİĞİN YARISI KADAR (95–120 GPa) ve lamel grafit yüzünden gerilmeyle
//     de değişir — tablo çekme tarafındaki sekant değerini veriyor.
//  2) AKMA GÖSTERMEZ. σ_ak null; gevrek kırılır ve BASMA dayanımı çekmenin
//     3–4 katıdır. Von Mises ile hüküm vermek gri dökme demirde YANLIŞTIR
//     (asimetrik dayanım) — uyarı alanı bunu söylüyor.
{ id:'gjl-150', n:'EN-GJL-150', c:'dokme-demir', std:'EN 1561', alt:['GG-15','0.6015','ASTM A48 Cl.25'], fam:['pik döküm'],
  E:95000, nu:0.26, rho:7100, sy:null, su:150, a:11.7, k:52, cp:460,
  not:'lamel grafitli gri döküm; σ_ç 30 mm çubuk',
  uyari:'AKMA GÖSTERMEZ (gevrek) ve basma dayanımı çekmenin 3–4 katı. Simetrik dayanım varsayan von Mises hükmü bu malzemede yanıltır.' },
{ id:'gjl-200', n:'EN-GJL-200', c:'dokme-demir', std:'EN 1561', alt:['GG-20','0.6020','ASTM A48 Cl.30'], fam:['pik döküm'],
  E:100000, nu:0.26, rho:7150, sy:null, su:200, a:11.7, k:50, cp:460,
  not:'lamel grafitli gri döküm', uyari:'AKMA GÖSTERMEZ (gevrek); basma ≫ çekme.' },
{ id:'gjl-250', n:'EN-GJL-250', c:'dokme-demir', std:'EN 1561', alt:['GG-25','0.6025','ASTM A48 Cl.35'], fam:['pik döküm'],
  E:110000, nu:0.26, rho:7200, sy:null, su:250, a:11.7, k:48, cp:460,
  not:'lamel grafitli gri döküm; motor bloğu sınıfı', uyari:'AKMA GÖSTERMEZ (gevrek); basma ≫ çekme.' },
{ id:'gjl-300', n:'EN-GJL-300', c:'dokme-demir', std:'EN 1561', alt:['GG-30','0.6030','ASTM A48 Cl.45'], fam:['pik döküm'],
  E:120000, nu:0.26, rho:7250, sy:null, su:300, a:11.7, k:46, cp:460,
  not:'lamel grafitli gri döküm', uyari:'AKMA GÖSTERMEZ (gevrek); basma ≫ çekme.' },
{ id:'gjs-400-15', n:'EN-GJS-400-15', c:'dokme-demir', std:'EN 1563', alt:['GGG-40','5.3106','ASTM 60-40-18'], fam:['sfero','küresel grafitli'],
  E:169000, nu:0.275, rho:7100, sy:250, su:400, a:12.5, k:36, cp:515, not:'küresel grafitli (sfero); ferritik, %15 uzama' },
{ id:'gjs-500-7', n:'EN-GJS-500-7', c:'dokme-demir', std:'EN 1563', alt:['GGG-50','5.3200','ASTM 65-45-12'], fam:['sfero','küresel grafitli'],
  E:169000, nu:0.275, rho:7100, sy:320, su:500, a:12.5, k:35, cp:515, not:'küresel grafitli; ferritik-perlitik' },
{ id:'gjs-600-3', n:'EN-GJS-600-3', c:'dokme-demir', std:'EN 1563', alt:['GGG-60','5.3300','ASTM 80-55-06'], fam:['sfero','küresel grafitli'],
  E:174000, nu:0.275, rho:7200, sy:370, su:600, a:12.5, k:33, cp:515, not:'küresel grafitli; perlitik-ferritik' },
{ id:'gjs-700-2', n:'EN-GJS-700-2', c:'dokme-demir', std:'EN 1563', alt:['GGG-70','5.3400','ASTM 100-70-03'], fam:['sfero','küresel grafitli'],
  E:176000, nu:0.275, rho:7200, sy:420, su:700, a:12.5, k:32, cp:515, not:'küresel grafitli; perlitik' },
{ id:'gjs-800-2', n:'EN-GJS-800-2', c:'dokme-demir', std:'EN 1563', alt:['GGG-80','5.3401'], fam:['sfero','küresel grafitli'],
  E:176000, nu:0.275, rho:7200, sy:480, su:800, a:12.5, k:32, cp:515, not:'küresel grafitli; perlitik/temperlenmiş' },
{ id:'gjmb-350-10', n:'EN-GJMB-350-10', c:'dokme-demir', std:'EN 1562', alt:['GTS-35','5.3103','temper döküm'],
  E:175000, nu:0.26, rho:7300, sy:200, su:350, a:12.0, k:45, cp:470, not:'siyah temper dökme demir' },
{ id:'gjv-450', n:'EN-GJV-450', c:'dokme-demir', std:'EN 16079', alt:['CGI 450','vermiküler'],
  E:145000, nu:0.26, rho:7100, sy:350, su:450, a:12.0, k:38, cp:475, not:'vermiküler grafitli (CGI); ağır vasıta motor bloğu' },

// ── ALÜMİNYUM — DÖVME / EKSTRÜZYON (EN 573, EN 755, EN 485) ─────────────────
// TEMPER DURUMU DEĞERİ BELİRLER, alaşım değil: 6082 T4'te σ_ak ≈ 110 MPa,
// T6'da 260 MPa. Kayıt adları bu yüzden temperi TAŞIYOR.
{ id:'aw1050a-h14', n:'EN AW-1050A H14', c:'alu-dovme', std:'EN 485-2', alt:['1050A','Al99,5','AA1050'],
  E:69000, nu:0.33, rho:2710, sy:85, su:100, a:23.5, k:229, cp:900, not:'ticari saflıkta alüminyum; yarı sert' },
{ id:'aw3003-h14', n:'EN AW-3003 H14', c:'alu-dovme', std:'EN 485-2', alt:['3003','AlMn1','AA3003'],
  E:69000, nu:0.33, rho:2730, sy:145, su:150, a:23.2, k:160, cp:893, not:'AlMn — şekillendirilebilir levha' },
{ id:'aw5052-h32', n:'EN AW-5052 H32', c:'alu-dovme', std:'EN 485-2', alt:['5052','AlMg2,5','AA5052'],
  E:70000, nu:0.33, rho:2680, sy:195, su:230, a:23.8, k:138, cp:880, not:'AlMg — deniz ortamı' },
{ id:'aw5083-h111', n:'EN AW-5083 H111', c:'alu-dovme', std:'EN 485-2', alt:['5083','AlMg4,5Mn0,7','AA5083'],
  E:71000, nu:0.33, rho:2660, sy:125, su:275, a:24.2, k:117, cp:900, not:'AlMg — gemi/tank; kaynaklanabilir' },
{ id:'aw5754-h22', n:'EN AW-5754 H22', c:'alu-dovme', std:'EN 485-2', alt:['5754','AlMg3','AA5754'],
  E:70000, nu:0.33, rho:2670, sy:185, su:245, a:23.7, k:132, cp:900, not:'AlMg — otomotiv gövde levhası' },
{ id:'aw6060-t6', n:'EN AW-6060 T6', c:'alu-dovme', std:'EN 755-2', alt:['6060','AlMgSi','AA6060'],
  E:69500, nu:0.33, rho:2700, sy:150, su:190, a:23.4, k:200, cp:898, not:'ekstrüzyon profili; yüzey kalitesi yüksek' },
{ id:'aw6061-t6', n:'EN AW-6061 T6', c:'alu-dovme', std:'EN 755-2', alt:['6061','AlMg1SiCu','AA6061','6061-T651'],
  E:68900, nu:0.33, rho:2700, sy:276, su:310, a:23.6, k:167, cp:896, not:'genel amaçlı yapısal alüminyum' },
{ id:'aw6082-t6', n:'EN AW-6082 T6', c:'alu-dovme', std:'EN 755-2', alt:['6082','AlSi1MgMn','AA6082'],
  E:70000, nu:0.33, rho:2700, sy:260, su:310, a:23.1, k:170, cp:900, not:'Avrupa yapısal standardı; t ≤ 5 mm' },
{ id:'aw7020-t6', n:'EN AW-7020 T6', c:'alu-dovme', std:'EN 755-2', alt:['7020','AlZn4,5Mg1','AA7020'],
  E:70000, nu:0.33, rho:2780, sy:280, su:350, a:23.1, k:140, cp:875, not:'kaynaklanabilir yüksek dayanımlı' },
{ id:'aw7075-t6', n:'EN AW-7075 T6', c:'alu-dovme', std:'EN 755-2', alt:['7075','AlZn5,5MgCu','AA7075','Ergal'],
  E:71700, nu:0.33, rho:2810, sy:503, su:572, a:23.6, k:130, cp:960, not:'havacılık sınıfı; kaynaklanamaz' },
{ id:'aw2024-t4', n:'EN AW-2024 T4', c:'alu-dovme', std:'EN 755-2', alt:['2024','AlCu4Mg1','AA2024','Dural'],
  E:73100, nu:0.33, rho:2780, sy:324, su:469, a:23.2, k:121, cp:875, not:'havacılık sınıfı; korozyona hassas' },

// ── ALÜMİNYUM — DÖKÜM (EN 1706) ─────────────────────────────────────────────
{ id:'ac42100-t6', n:'EN AC-42100 (AlSi7Mg0,3) T6', c:'alu-dokum', std:'EN 1706', alt:['42100','AlSi7Mg0,3','A356','G-AlSi7Mg'],
  E:75000, nu:0.33, rho:2680, sy:210, su:260, a:21.5, k:150, cp:960, not:'kokil döküm + T6; jant ve şasi parçaları' },
{ id:'ac43000-t6', n:'EN AC-43000 (AlSi10Mg) T6', c:'alu-dokum', std:'EN 1706', alt:['43000','AlSi10Mg','G-AlSi10Mg'],
  E:71000, nu:0.33, rho:2650, sy:220, su:290, a:21.0, k:150, cp:900, not:'kokil döküm + T6' },
{ id:'ac43000-f', n:'EN AC-43000 (AlSi10Mg) F', c:'alu-dokum', std:'EN 1706', alt:['43000 F','AlSi10Mg ham döküm'],
  E:71000, nu:0.33, rho:2650, sy:80, su:150, a:21.0, k:150, cp:900, not:'kum döküm, ısıl işlemsiz — T6 ile ARASINDA 2,7 kat fark var' },
{ id:'ac46000', n:'EN AC-46000 (AlSi9Cu3)', c:'alu-dokum', std:'EN 1706', alt:['46000','AlSi9Cu3(Fe)','A380','ADC12'],
  E:75000, nu:0.33, rho:2750, sy:140, su:240, a:21.0, k:110, cp:963, not:'basınçlı döküm (die casting) standardı' },
{ id:'ac44300', n:'EN AC-44300 (AlSi12)', c:'alu-dokum', std:'EN 1706', alt:['44300','AlSi12','A413'],
  E:71000, nu:0.33, rho:2650, sy:70, su:150, a:20.0, k:155, cp:963, not:'ötektik; ince cidarlı döküm' },

// ── BAKIR ALAŞIMLARI (EN 12163 / 12420 / 1982) ──────────────────────────────
{ id:'cu-etp', n:'Cu-ETP', c:'bakir', std:'EN 13601', alt:['CW004A','E-Cu58','C11000','elektrolitik bakır'],
  E:118000, nu:0.34, rho:8900, sy:250, su:300, a:17.0, k:394, cp:385, not:'yarı sert (H); tavlanmışta σ_ak ≈ 60 MPa' },
{ id:'cuzn37', n:'CuZn37', c:'bakir', std:'EN 1652', alt:['CW508L','Ms63','C27400','pirinç'],
  E:100000, nu:0.35, rho:8440, sy:200, su:340, a:20.3, k:120, cp:377, not:'yarı sert pirinç levha' },
{ id:'cuzn39pb3', n:'CuZn39Pb3', c:'bakir', std:'EN 12164', alt:['CW614N','Ms58','C38500','otomat pirinci'],
  E:96000, nu:0.35, rho:8470, sy:250, su:420, a:20.9, k:115, cp:377, not:'talaşlı imalat pirinci (kurşunlu)' },
{ id:'cusn8', n:'CuSn8', c:'bakir', std:'EN 1654', alt:['CW453K','C52100','fosfor bronzu'],
  E:115000, nu:0.35, rho:8800, sy:350, su:470, a:18.5, k:62, cp:377, not:'yaylı bronz; yarı sert' },
{ id:'cual10ni5fe4', n:'CuAl10Ni5Fe4', c:'bakir', std:'EN 12163', alt:['CW307G','C63000','alüminyum bronzu'],
  E:122000, nu:0.33, rho:7600, sy:300, su:680, a:16.2, k:42, cp:420, not:'deniz suyu direnci yüksek' },
{ id:'cc483k', n:'CuSn12 (CC483K)', c:'bakir', std:'EN 1982', alt:['CC483K','G-CuSn12','döküm bronz'],
  E:100000, nu:0.35, rho:8700, sy:150, su:280, a:18.0, k:50, cp:377, not:'kaymalı yatak bronzu; kum döküm' },

// ── TİTANYUM (EN ISO 5832 / ASTM B265, B348) ────────────────────────────────
// ÖZGÜL DAYANIM burada anlamlı: Ti-6Al-4V σ_ak/ρ ≈ 0,199 MPa/(kg/m³), 42CrMo4
// için 0,115 — yani aynı yük için parça yarı ağırlıkta olabilir. Kütüphanenin
// bu kolonu göstermesinin sebebi bu.
{ id:'ti-gr2', n:'Titanyum Grade 2', c:'titanyum', std:'ASTM B265', alt:['Gr.2','Ti Gr 2','3.7035','saf titanyum'],
  E:105000, nu:0.34, rho:4510, sy:275, su:345, a:8.6, k:16.4, cp:523, not:'ticari saflıkta; tavlanmış' },
{ id:'ti-6al-4v', n:'Ti-6Al-4V (Grade 5)', c:'titanyum', std:'ASTM B348', alt:['Gr.5','TiAl6V4','3.7165','Ti64'],
  E:113800, nu:0.342, rho:4430, sy:880, su:950, a:8.6, k:6.7, cp:526, not:'tavlanmış; havacılık ve implant standardı' },
{ id:'ti-6al-4v-eli', n:'Ti-6Al-4V ELI (Grade 23)', c:'titanyum', std:'ASTM F136', alt:['Gr.23','Ti64 ELI','3.7165 ELI'],
  E:113800, nu:0.342, rho:4430, sy:795, su:860, a:8.6, k:6.7, cp:526, not:'düşük ara element; kriyojenik ve implant' },

// ── MAGNEZYUM (EN 1753 / ASTM B90) ──────────────────────────────────────────
{ id:'az31b', n:'AZ31B-H24', c:'magnezyum', std:'ASTM B90', alt:['AZ31','3.5312','MgAl3Zn1'],
  E:45000, nu:0.35, rho:1770, sy:220, su:290, a:26.0, k:96, cp:1000, not:'haddelenmiş levha; yarı sert' },
{ id:'az91d', n:'AZ91D', c:'magnezyum', std:'EN 1753', alt:['AZ91','3.5912','MgAl9Zn1'],
  E:45000, nu:0.35, rho:1810, sy:160, su:230, a:26.0, k:72, cp:1020, not:'basınçlı döküm; en yaygın Mg döküm alaşımı' },
{ id:'am60b', n:'AM60B', c:'magnezyum', std:'EN 1753', alt:['AM60','MgAl6Mn'],
  E:45000, nu:0.35, rho:1800, sy:130, su:220, a:25.6, k:62, cp:1020, not:'basınçlı döküm; AZ91\'den tok, daha az dayanımlı' },

// ── NİKEL ALAŞIMLARI ────────────────────────────────────────────────────────
{ id:'inconel600', n:'Inconel 600', c:'nikel', std:'ASTM B168', alt:['Alloy 600','2.4816','NiCr15Fe'],
  E:207000, nu:0.31, rho:8470, sy:310, su:655, a:13.3, k:14.9, cp:444, not:'tavlanmış; yüksek sıcaklık + korozyon' },
{ id:'inconel625', n:'Inconel 625', c:'nikel', std:'ASTM B443', alt:['Alloy 625','2.4856','NiCr22Mo9Nb'],
  E:207500, nu:0.308, rho:8440, sy:415, su:827, a:12.8, k:9.8, cp:410, not:'tavlanmış; deniz ve kimya' },
{ id:'inconel718', n:'Inconel 718', c:'nikel', std:'AMS 5662', alt:['Alloy 718','2.4668','NiCr19Fe19Nb5Mo3'],
  E:200000, nu:0.294, rho:8190, sy:1034, su:1276, a:13.0, k:11.4, cp:435, not:'çözeltiye alınmış + yaşlandırılmış; türbin sınıfı' },
{ id:'hastelloy-c276', n:'Hastelloy C-276', c:'nikel', std:'ASTM B575', alt:['C276','2.4819','NiMo16Cr15W'],
  E:205000, nu:0.31, rho:8890, sy:355, su:760, a:11.2, k:9.8, cp:427, not:'tavlanmış; en geniş kimyasal direnç' },
{ id:'monel400', n:'Monel 400', c:'nikel', std:'ASTM B127', alt:['Alloy 400','2.4360','NiCu30Fe'],
  E:179000, nu:0.32, rho:8800, sy:240, su:550, a:13.9, k:21.8, cp:427, not:'tavlanmış; deniz suyu' },

// ── DİĞER METALLER ──────────────────────────────────────────────────────────
{ id:'zamak5', n:'ZAMAK 5 (ZnAl4Cu1)', c:'diger-metal', std:'EN 12844', alt:['ZP0410','Zamak 5','ZL0410'],
  E:96000, nu:0.29, rho:6700, sy:270, su:330, a:27.4, k:109, cp:419, not:'çinko basınçlı döküm' },
{ id:'wolfram', n:'Wolfram (W)', c:'diger-metal', std:'ASTM B760', alt:['W','tungsten'],
  E:411000, nu:0.28, rho:19300, sy:750, su:980, a:4.5, k:174, cp:132, not:'sinterlenmiş saf tungsten; denge ağırlığı ve ışın koruması' },
{ id:'molibden', n:'Molibden (Mo)', c:'diger-metal', std:'ASTM B387', alt:['Mo','TZM dışı saf'],
  E:329000, nu:0.31, rho:10220, sy:415, su:550, a:4.8, k:138, cp:251, not:'gerilim giderilmiş; yüksek sıcaklık' },
{ id:'kursun', n:'Kurşun (Pb)', c:'diger-metal', std:'EN 12588', alt:['Pb','lead'],
  E:16000, nu:0.44, rho:11340, sy:8, su:15, a:29.0, k:35, cp:129,
  not:'saf kurşun; oda sıcaklığında SÜRÜNÜR',
  uyari:'Oda sıcaklığı homolog sıcaklığın yarısının üstünde: kurşun sabit yük altında SÜRÜNÜR. Lineer elastik çözüm yalnız ANLIK cevabı verir.' },

// ── POLİMERLER ──────────────────────────────────────────────────────────────
// ÜÇ ORTAK KISIT — hepsi `uyari` alanında değil burada, çünkü SINIFIN tamamı
// için geçerli ve panelde kategori notu olarak basılıyor:
//  1) VİSKOELASTİK. E bir ANLIK (kısa süreli çekme) modülüdür; sabit yük
//     altında sürünme (creep) modülü saatler içinde yarıya iner. Lineer
//     elastik çözüm uzun süreli yükte sehimi OLDUĞUNDAN KÜÇÜK gösterir.
//  2) SICAKLIĞA ÇOK BAĞLI. Cam geçiş sıcaklığına yaklaşırken E onda birine
//     düşer; tablo 23 °C içindir.
//  3) NEM. Poliamitler (PA6, PA66) doyduğunda E yarıya iner — kayıtlar KURU
//     durumdadır ve notunda yazılıdır.
// σ_ak sünek polimerlerde AKMA gerilmesidir; gevrek olanlarda (PMMA, PS)
// kopma gerilmesiyle çakışır.
{ id:'pa6', n:'PA6 (kuru)', c:'polimer', std:'ISO 1874', alt:['Poliamit 6','Naylon 6','PA 6'],
  E:3000, nu:0.39, rho:1140, sy:80, su:80, a:80, k:0.25, cp:1700, not:'23 °C, KURU. Doymuş halde E ≈ 1200 MPa, σ_ak ≈ 45 MPa' },
{ id:'pa66', n:'PA66 (kuru)', c:'polimer', std:'ISO 1874', alt:['Poliamit 66','Naylon 66','PA 6.6'],
  E:3300, nu:0.39, rho:1140, sy:85, su:85, a:80, k:0.25, cp:1700, not:'23 °C, KURU. Doymuş halde E ≈ 1400 MPa' },
{ id:'pa66-gf30', n:'PA66-GF30 (kuru)', c:'polimer', std:'ISO 1874', alt:['PA66 %30 cam elyaf','Naylon 66 GF30'],
  E:9500, nu:0.35, rho:1360, sy:175, su:175, a:30, k:0.30, cp:1500,
  not:'23 °C, KURU; %30 kısa cam elyaf',
  uyari:'Kısa elyaf takviyeli: gerçekte ORTOTROP — özellikler akış yönüne bağlı. Buradaki değerler akış yönündeki (en yüksek) değerlerdir; enine yönde E yaklaşık yarısıdır.' },
{ id:'pom-c', n:'POM-C', c:'polimer', std:'ISO 9988', alt:['Poliasetal','Delrin (POM-H)','Asetal kopolimer'],
  E:2800, nu:0.38, rho:1410, sy:65, su:65, a:110, k:0.31, cp:1470, not:'23 °C; boyutsal kararlılığı yüksek' },
{ id:'pp', n:'PP (homopolimer)', c:'polimer', std:'ISO 19069', alt:['Polipropilen','PP-H'],
  E:1500, nu:0.42, rho:905, sy:33, su:33, a:150, k:0.22, cp:1800, not:'23 °C' },
{ id:'pe-hd', n:'PE-HD', c:'polimer', std:'ISO 17855', alt:['HDPE','Yüksek yoğunluklu polietilen'],
  E:1000, nu:0.42, rho:955, sy:26, su:26, a:200, k:0.45, cp:1900, not:'23 °C' },
{ id:'pc', n:'PC', c:'polimer', std:'ISO 7391', alt:['Polikarbonat','Makrolon','Lexan'],
  E:2350, nu:0.37, rho:1200, sy:62, su:65, a:65, k:0.20, cp:1200, not:'23 °C; şeffaf ve tok' },
{ id:'pmma', n:'PMMA', c:'polimer', std:'ISO 8257', alt:['Akrilik','Pleksiglas','Plexiglas'],
  E:3200, nu:0.37, rho:1180, sy:72, su:72, a:70, k:0.19, cp:1470,
  not:'23 °C; σ_ak = σ_ç (gevrek kopar)',
  uyari:'GEVREK: akma öncesi kopar, çentiğe çok hassastır. Emniyet payı hükmü çentik etkisini kapsamaz.' },
{ id:'abs', n:'ABS', c:'polimer', std:'ISO 2580', alt:['Akrilonitril bütadien stiren'],
  E:2300, nu:0.35, rho:1050, sy:45, su:45, a:90, k:0.17, cp:1400, not:'23 °C' },
{ id:'pvc-u', n:'PVC-U', c:'polimer', std:'ISO 1163', alt:['Sert PVC','uPVC'],
  E:3000, nu:0.38, rho:1400, sy:55, su:55, a:80, k:0.16, cp:900, not:'23 °C; plastikleştiricisiz' },
{ id:'pet', n:'PET', c:'polimer', std:'ISO 20028', alt:['Polietilen tereftalat','Arnite'],
  E:3100, nu:0.40, rho:1370, sy:80, su:80, a:70, k:0.24, cp:1200, not:'23 °C' },
{ id:'peek', n:'PEEK', c:'polimer', std:'ISO 19063', alt:['Polieter eter keton','Victrex PEEK'],
  E:3700, nu:0.40, rho:1300, sy:100, su:100, a:47, k:0.25, cp:1340, not:'23 °C; 250 °C\'ye kadar sürekli kullanım' },
{ id:'ptfe', n:'PTFE', c:'polimer', std:'ISO 12086', alt:['Teflon','Politetrafloretilen'],
  E:500, nu:0.46, rho:2170, sy:12, su:25, a:130, k:0.25, cp:1000,
  not:'23 °C; sürtünme katsayısı en düşük polimer',
  uyari:'Oda sıcaklığında bile belirgin SOĞUK AKMA (creep). Sabit yük altındaki sehim lineer elastik çözümün verdiğinden kat kat büyüktür.' },
{ id:'pa12', n:'PA12', c:'polimer', std:'ISO 1874', alt:['Poliamit 12','Naylon 12','PA 12'],
  E:1400, nu:0.40, rho:1010, sy:45, su:45, a:100, k:0.25, cp:1700, not:'23 °C; nem alımı PA6/PA66\'dan çok düşük' },
{ id:'ps', n:'PS', c:'polimer', std:'ISO 1622', alt:['Polistiren','GPPS'],
  E:3200, nu:0.35, rho:1050, sy:45, su:45, a:80, k:0.16, cp:1300,
  not:'23 °C', uyari:'GEVREK: akma göstermeden kopar.' },

// ── ELASTOMERLER ────────────────────────────────────────────────────────────
// SINIFIN TAMAMI BU ÇÖZÜCÜ İÇİN UYGUN DEĞİL ve kayıtlar bunu söylüyor.
// İki ayrı sebep, ikisi de yapısal:
//  1) NEREDEYSE SIKIŞTIRILAMAZ (ν → 0,5). Yer değiştirme temelli standart
//     elemanlarda hacimsel KİLİTLENME olur — panel zaten ν > 0,49'da
//     uyarıyor (bkz. cp-structural.js). Karma (u/p) formülasyon gerekir.
//  2) HİPERELASTİK. %100 uzamada gerilme-gerinim eğrisi doğrusal değil;
//     Mooney-Rivlin / Ogden gibi bir malzeme kartı ister. E burada yalnız
//     KÜÇÜK GERİNİM başlangıç eğimidir.
// E, Shore A sertliğinden Gent bağıntısıyla türetildi:
//     E = 0,0981·(56 + 7,62336·S) / (0,137505·(254 − 2,54·S))   [MPa]
// Takoz modülü (mount-analysis) kauçuğu BAŞKA türlü modelliyor — orada
// F(δ) yasası ve ölçülmüş rijitlikler var, tek bir E değil.
{ id:'nbr70', n:'NBR 70 ShA', c:'elastomer', std:'ISO 1629', alt:['Nitril kauçuk','Buna-N','NBR'],
  E:5.5, nu:0.4995, rho:1250, sy:null, su:15, a:230, k:0.25, cp:1900,
  not:'Shore A 70; E Gent bağıntısıyla sertlikten türetildi',
  uyari:'BU ÇÖZÜCÜ İÇİN UYGUN DEĞİL: hiperelastik ve neredeyse sıkıştırılamaz (hacimsel kilitlenme). Karma formülasyon + Mooney-Rivlin/Ogden gerekir. Kauçuk takoz analizi için Takoz Çökme-Titreşim modülünü kullanın.' },
{ id:'epdm70', n:'EPDM 70 ShA', c:'elastomer', std:'ISO 1629', alt:['EPDM','Etilen propilen dien kauçuk'],
  E:5.5, nu:0.4995, rho:1150, sy:null, su:12, a:200, k:0.25, cp:2000,
  not:'Shore A 70; ozon ve hava koşullarına dayanıklı',
  uyari:'BU ÇÖZÜCÜ İÇİN UYGUN DEĞİL: hiperelastik + neredeyse sıkıştırılamaz.' },
{ id:'nr60', n:'Doğal kauçuk 60 ShA', c:'elastomer', std:'ISO 1629', alt:['NR','Natural rubber','Kauçuk'],
  E:3.6, nu:0.4997, rho:950, sy:null, su:25, a:220, k:0.15, cp:1900,
  not:'Shore A 60; takoz ve titreşim yalıtımının klasik malzemesi',
  uyari:'BU ÇÖZÜCÜ İÇİN UYGUN DEĞİL: hiperelastik + neredeyse sıkıştırılamaz.' },
{ id:'vmq60', n:'Silikon (VMQ) 60 ShA', c:'elastomer', std:'ISO 1629', alt:['VMQ','Silikon kauçuk','MVQ'],
  E:3.6, nu:0.4997, rho:1250, sy:null, su:8, a:250, k:0.22, cp:1300,
  not:'Shore A 60; −60…+200 °C',
  uyari:'BU ÇÖZÜCÜ İÇİN UYGUN DEĞİL: hiperelastik + neredeyse sıkıştırılamaz.' },
{ id:'pur90', n:'Poliüretan 90 ShA', c:'elastomer', std:'ISO 1629', alt:['PUR','PU','Vulkollan'],
  E:25, nu:0.499, rho:1200, sy:null, su:40, a:150, k:0.25, cp:1800,
  not:'Shore A 90; aşınma direnci yüksek',
  uyari:'BU ÇÖZÜCÜ İÇİN UYGUN DEĞİL: hiperelastik + neredeyse sıkıştırılamaz.' },

// ── SERAMİK VE CAM ──────────────────────────────────────────────────────────
// HEPSİ GEVREK: σ_ak yok (null). Verilen σ_ç EĞİLME dayanımıdır (4 nokta
// eğme) ve BASMA dayanımı bunun 5–15 katıdır. Weibull dağılımı yüzünden tek
// bir "dayanım" sayısı da yanıltıcıdır: parça büyüdükçe dayanım DÜŞER.
// Von Mises hükmü bu sınıfta geçersiz — asıl ölçüt maksimum ASAL çekme
// gerilmesidir.
{ id:'al2o3-995', n:'Al₂O₃ %99,5', c:'seramik', std:'ISO 26602', alt:['Alümina','Aluminyum oksit','Alumina 99.5'],
  E:370000, nu:0.22, rho:3890, sy:null, su:380, a:8.2, k:30, cp:880,
  not:'σ_ç = 4 nokta EĞİLME dayanımı; basma ≈ 2600 MPa',
  uyari:'GEVREK: akma yok, Weibull dağılımlı dayanım. Hüküm von Mises ile değil maksimum ASAL ÇEKME gerilmesiyle verilir.' },
{ id:'sic', n:'SiC (sinterlenmiş)', c:'seramik', std:'ISO 26602', alt:['Silisyum karbür','SSiC','Karborundum'],
  E:410000, nu:0.14, rho:3100, sy:null, su:450, a:4.0, k:120, cp:750,
  not:'σ_ç = eğilme dayanımı; basma ≈ 3900 MPa',
  uyari:'GEVREK: hüküm maksimum ASAL ÇEKME gerilmesiyle verilir.' },
{ id:'si3n4', n:'Si₃N₄', c:'seramik', std:'ISO 26602', alt:['Silisyum nitrür','SSN','Sialon'],
  E:310000, nu:0.27, rho:3200, sy:null, su:700, a:3.3, k:30, cp:700,
  not:'σ_ç = eğilme dayanımı; seramik rulman bilyesi sınıfı',
  uyari:'GEVREK: hüküm maksimum ASAL ÇEKME gerilmesiyle verilir.' },
{ id:'zro2-ytzp', n:'ZrO₂ (Y-TZP)', c:'seramik', std:'ISO 13356', alt:['Zirkonya','Y-TZP','Zirkonyum oksit'],
  E:210000, nu:0.31, rho:6050, sy:null, su:900, a:10.5, k:2.5, cp:400,
  not:'σ_ç = eğilme dayanımı; seramikler içinde en toku',
  uyari:'GEVREK: hüküm maksimum ASAL ÇEKME gerilmesiyle verilir.' },
{ id:'cam-soda', n:'Soda-kireç camı', c:'seramik', std:'EN 572-1', alt:['Float cam','Pencere camı','Soda-lime'],
  E:70000, nu:0.23, rho:2500, sy:null, su:45, a:9.0, k:1.0, cp:840,
  not:'σ_ç = tavlanmış float camın tasarım eğilme dayanımı; temperli camda 3–5 kat',
  uyari:'GEVREK: yüzey kusurlarına aşırı hassas. Hüküm maksimum ASAL ÇEKME gerilmesiyle verilir.' },
{ id:'cam-borosilikat', n:'Borosilikat cam', c:'seramik', std:'ISO 3585', alt:['Pyrex','Duran','Borosilicate 3.3'],
  E:64000, nu:0.20, rho:2230, sy:null, su:60, a:3.3, k:1.2, cp:830,
  not:'σ_ç = eğilme dayanımı; ısıl şok direnci yüksek',
  uyari:'GEVREK: hüküm maksimum ASAL ÇEKME gerilmesiyle verilir.' }
];

// ════════════════════════════════════════════════════════════════════════════
//  SORGU KATMANI
// ════════════════════════════════════════════════════════════════════════════

// TÜRKÇE KATLAMA — `toLowerCase()` TEK BAŞINA YETMEZ ve bu ölçülmüş bir tuzak:
// JavaScript'in varsayılan `toLowerCase()`'i 'I' harfini 'i' yapar (Türkçe'de
// 'ı' olmalıydı), 'İ' harfini de 'i̇' (birleşik nokta) yapar. Yani kullanıcı
// "ISIL" yazınca "ısıl" bulunamaz, "İNCONEL" yazınca kayıt eşleşmez.
// Çözüm harf harf ASCII'ye katlamak: arama için doğru davranış budur, çünkü
// kullanıcı Türkçe klavyeyle "çelik" de yazabilir "celik" de.
var _VE_STR_FOLD = { 'ı':'i','İ':'i','I':'i','i':'i','ş':'s','Ş':'s','ğ':'g','Ğ':'g',
                     'ü':'u','Ü':'u','ö':'o','Ö':'o','ç':'c','Ç':'c','â':'a','Â':'a','î':'i','Î':'i','û':'u','Û':'u' };
function veStrMatFold(s){
  var out = '';
  var t = String(s == null ? '' : s);
  for(var i = 0; i < t.length; i++){
    var ch = t.charAt(i);
    out += (_VE_STR_FOLD[ch] !== undefined) ? _VE_STR_FOLD[ch] : ch.toLowerCase();
  }
  return out;
}

// GÖSTERİM ANAHTARI — katlama + alfanümerik dışını AT. Aynı malzeme sahada üç
// dört ayrı yazımla anılıyor ve aralarındaki fark yalnız AYIRAÇ oluyor:
//     1.4301 · 1,4301 · 14301        (nokta / virgül / hiç)
//     X5CrNi18-10 · X5CrNi 18-10     (tire / boşluk)
//     EN AW-6082 · AW6082 · 6082     (önek / tire)
// Ayıraçları atmak bu üçünü tek anahtara indiriyor. Atmasaydık kullanıcı
// tedarikçi belgesindeki yazımı birebir taklit etmek zorunda kalırdı.
function veStrMatKey(s){
  return veStrMatFold(s).replace(/[^a-z0-9]/g, '');
}

function veStrMatLibById(id){
  for(var i = 0; i < VE_STR_MAT_LIB.length; i++){
    if(VE_STR_MAT_LIB[i].id === id) return VE_STR_MAT_LIB[i];
  }
  return null;
}

function veStrMatLibCat(key){
  for(var i = 0; i < VE_STR_MAT_CATS.length; i++){
    if(VE_STR_MAT_CATS[i].key === key) return VE_STR_MAT_CATS[i];
  }
  return null;
}

function veStrMatLibByCat(key){
  return VE_STR_MAT_LIB.filter(function(m){ return m.c === key; });
}

// Kategori başına sayım — panelde kategori listesinin yanında duruyor.
function veStrMatLibCounts(){
  var out = {};
  VE_STR_MAT_LIB.forEach(function(m){ out[m.c] = (out[m.c] || 0) + 1; });
  return out;
}

// Bir kaydın ARANABİLİR bütün gösterimleri: birincil ad + diğer adlar + kimlik.
function veStrMatDesigs(m){
  return [m.n].concat(m.alt || []).concat(m.fam || []).concat([m.id]);
}

// TEKİL olması BEKLENEN gösterimler — aile terimleri hariç. Tekillik kapısı
// (tests/unit/structural-materials.test.js) buna bakıyor.
function veStrMatUniqueDesigs(m){
  return [m.n].concat(m.alt || []).concat([m.id]);
}

// Gösterimin PARÇALARI — ayıraçlardan bölünmüş. Anahtardan (veStrMatKey) farkı
// tam da bu: anahtar ayıraçları ATIYOR, bu ise onlardan BÖLÜYOR.
// İkisi ayrı soruya cevap veriyor ve ikisi de gerekli:
//     "1.4301" araması  → anahtar eşleşmesi ("14301")        → tam isabet
//     "304"    araması  → parça eşleşmesi ("AISI 304" → "304") → tam isabet
// Parça olmasaydı "304" hem AISI 304'ü hem AISI 304L'yi aynı puanla getirir ve
// alfabetik sıra 304L'yi ÖNE alırdı (ölçüldü) — kullanıcının aradığı kayıt
// listenin ikinci sırasına düşerdi.
function veStrMatTokens(s){
  return veStrMatFold(s).split(/[^a-z0-9]+/).filter(function(t){ return !!t; });
}

// ── ARAMA ───────────────────────────────────────────────────────────────────
// Puanlama, "yazdığım şeyin TAM KARŞILIĞI önce gelsin" diye kademeli:
//     100  bir gösterimin TAMAMI eşleşiyor      ("1.4301" → X5CrNi18-10)
//      90  bir gösterimin bir PARÇASI tam eşleşiyor ("304" → AISI 304,
//          ama AISI 304L değil — onun parçası "304l")
//      80  birincil ad sorguyla BAŞLIYOR        ("s355"  → S355JR, S355J2…)
//      70  bir diğer ad sorguyla başlıyor       ("aisi3" → 304, 316…)
//      50  birincil ad İÇERİYOR
//      40  bir diğer ad içeriyor                 ("304"   → AISI 304)
//      20  standart ya da kategori adı içeriyor  ("10025" → bütün yapı çelikleri)
// Eşit puanda ad alfabetik. Sıralama olmasaydı "s355" araması S355K2'yi
// S355JR'den önce getirebilirdi — kullanıcı listeyi baştan okuyor.
function veStrMatLibSearch(q, catKey){
  var qk = veStrMatKey(q);
  var list = catKey ? veStrMatLibByCat(catKey) : VE_STR_MAT_LIB.slice();

  // ARAMASIZ liste GEZME kipidir ve sırası AİLEYE göre, ad alfabesine göre
  // değil. ÖLÇÜLDÜ (gerçek tarayıcı): düz alfabetik sırada 16 kategori için
  // 30 AİLE BAŞLIĞI basılıyordu — aileler birbirinin içine giriyor, yapışkan
  // başlık her birkaç satırda değişiyor ve katalog gezilemez oluyordu.
  // Aile sırası VE_STR_MAT_CATS'in sırası: çelikten seramiğe, ağırdan hafife.
  if(!qk){
    var sira = {};
    VE_STR_MAT_CATS.forEach(function(c, i){ sira[c.key] = i; });
    return list.slice().sort(function(a, b){
      var d = (sira[a.c] === undefined ? 999 : sira[a.c]) - (sira[b.c] === undefined ? 999 : sira[b.c]);
      return d || a.n.localeCompare(b.n, 'tr');
    });
  }

  var hit = [];
  list.forEach(function(m){
    var puan = 0;
    var desigs = veStrMatDesigs(m);
    for(var i = 0; i < desigs.length; i++){
      var dk = veStrMatKey(desigs[i]);
      if(!dk) continue;
      if(dk === qk){ puan = Math.max(puan, 100); continue; }
      if(veStrMatTokens(desigs[i]).indexOf(qk) >= 0){ puan = Math.max(puan, 90); continue; }
      var ilk = (i === 0);
      if(dk.indexOf(qk) === 0) puan = Math.max(puan, ilk ? 80 : 70);
      else if(dk.indexOf(qk) > 0) puan = Math.max(puan, ilk ? 50 : 40);
    }
    if(!puan){
      var cat = veStrMatLibCat(m.c);
      var meta = veStrMatKey((m.std || '') + ' ' + (cat ? cat.ad : ''));
      if(meta.indexOf(qk) >= 0) puan = 20;
    }
    if(puan) hit.push({ m: m, p: puan });
  });
  hit.sort(function(a, b){ return (b.p - a.p) || a.m.n.localeCompare(b.m.n, 'tr'); });
  return hit.map(function(h){ return h.m; });
}

// ── KAYDA ÇEVİRME ───────────────────────────────────────────────────────────
// Katalogdan düğüme geçen ALAN LİSTESİ burada sabitleniyor. Kütüphanenin
// referans alanları (k, cp) KASTEN GEÇMİYOR: çözücü onları kullanmıyor ve
// kullanılmayan bir sayıyı düğüme kopyalamak, ileride "bu nereden geldi,
// güncel mi" sorusunu doğuran ölü veridir.
//
// NULL ALAN YAZILMAZ. Gevrek malzemede σ_ak yoktur; kayda `sy: null` koymak
// ile alanı HİÇ koymamak farklı şeyler: `veStrMatValidate` ikincisinde
// "akma dayanımı yok, emniyet payı hükmü verilemez" uyarısını üretiyor —
// yani kütüphaneden gelen gevrek malzeme de kendi kısıtını taşıyor.
//
// KOPYA, REFERANS DEĞİL: kayıt düğümde kendi başına duruyor. Kütüphane
// sürümü değişip bir değer düzeltilse bile kaydedilmiş proje KENDİLİĞİNDEN
// DEĞİŞMEZ. `lib` + `libVer` yalnız İZ bırakıyor ki panel "hangi katalog
// kaydından geldi" sorusuna cevap verebilsin.
function veStrMatLibRecord(id){
  var m = veStrMatLibById(id);
  if(!m) return null;
  var rec = { name: m.n, source: 'library', lib: m.id, libVer: VE_STR_MAT_LIB_VERSION };
  [['E','E'], ['nu','nu'], ['rho','rho'], ['sy','sy'], ['su','su'], ['alpha','a']].forEach(function(p){
    var v = m[p[1]];
    if(v !== null && v !== undefined && isFinite(Number(v))) rec[p[0]] = Number(v);
  });
  return rec;
}

// Kayıt ile katalog kaydı hâlâ AYNI mı? Kullanıcı bir alanı elle değiştirdiyse
// panel bunu "kütüphaneden türetildi, elle değiştirildi" diye yazmak zorunda —
// yoksa katalog adı, artık katalogda olmayan sayıların üstünde durur.
function veStrMatLibMatches(rec){
  if(!rec || !rec.lib) return false;
  var ref = veStrMatLibRecord(rec.lib);
  if(!ref) return false;
  var alanlar = ['E', 'nu', 'rho', 'sy', 'su', 'alpha'];
  for(var i = 0; i < alanlar.length; i++){
    var a = alanlar[i];
    var x = (rec[a] === undefined || rec[a] === null) ? null : Number(rec[a]);
    var y = (ref[a] === undefined || ref[a] === null) ? null : Number(ref[a]);
    if(x === null && y === null) continue;
    if(x === null || y === null) return false;
    if(Math.abs(x - y) > Math.abs(y) * 1e-9) return false;
  }
  return true;
}

// ── TEST KÖPRÜSÜ ────────────────────────────────────────────────────────────
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_STR_MAT_LIB_VERSION: VE_STR_MAT_LIB_VERSION,
    VE_STR_MAT_LIB_TEMP_C: VE_STR_MAT_LIB_TEMP_C,
    VE_STR_MAT_CATS: VE_STR_MAT_CATS,
    VE_STR_MAT_LIB: VE_STR_MAT_LIB,
    veStrMatFold: veStrMatFold,
    veStrMatKey: veStrMatKey,
    veStrMatLibById: veStrMatLibById,
    veStrMatLibCat: veStrMatLibCat,
    veStrMatLibByCat: veStrMatLibByCat,
    veStrMatLibCounts: veStrMatLibCounts,
    veStrMatDesigs: veStrMatDesigs,
    veStrMatUniqueDesigs: veStrMatUniqueDesigs,
    veStrMatTokens: veStrMatTokens,
    veStrMatLibSearch: veStrMatLibSearch,
    veStrMatLibRecord: veStrMatLibRecord,
    veStrMatLibMatches: veStrMatLibMatches
  };
}
