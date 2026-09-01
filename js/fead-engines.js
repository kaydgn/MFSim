// ============================================================================
//  FEAD — MOTOR KATALOĞU
// ============================================================================
// `fead-solver` bileşeninin motor katmanı. DOM'suz ve saf veri: panel
// (js/cp-fead.js) buradan okur, buraya HİÇBİR ŞEY yazmaz. Kalıp
// js/fead-belts.js · js/fead-duty.js · js/fead-tensioners.js ile aynı.
//
// ── KAYNAK: BMC'nin KENDİ HESAP DEFTERİ ─────────────────────────────────────
// Yirmi dört kaydın tamamı `KIRPI_II_NEX_GEN.FEAD.xlsx` defterinin
// "Motor Bilgileri" sayfasından çıkarıldı (BMC SAS ARGE / Güç Grubu,
// ADEM CAM, son kayıt 13.08.2026). Sayfa iki bloktan oluşuyor ve İKİSİ de
// alındı: Z:AJ künye sütunları, A:X tork/güç eğrisi blokları.
//
// ── KATALOG BİR KISIT DEĞİL, BİR ÖNERİ ──────────────────────────────────────
// Kayış kataloğuyla aynı kural: panel elle girişi engellemez. Katalog yalnız
// "bu motorda ne var" sorusunu cevaplar; kullanıcı listede olmayan bir motorla
// çalışabilir ve alanları kendi doldurur.
//
// ── SİLİNDİR SAYISI DEFTERDE YOK — AİLE ADINDAN GELİYOR ─────────────────────
// `cyl` alanı defterin bir sütunu DEĞİL: Cummins aile adından okunuyor
// (ISB4.5 sıra-4, kalan yirmi üçü sıra-6). Uydurma değil çünkü defterin kendisi
// de aynı sayıyı dolaylı yazıyor — "Spanlardaki frekans" sayfası ateşleme
// sırasını 3 alıyor, yani silindir/2 = 3 → altı silindir (testi var).
// Ateşleme frekansı bundan türediği için alan gerçekten kullanılıyor;
// panel onu bir BAŞLANGIÇ değeri olarak yazar, kullanıcı değiştirebilir.
//
// ── EKSİK ALAN `null`, SIFIR DEĞİL ──────────────────────────────────────────
// Defterde "-" yazan hücre "o motorda o kasnak YOK" demek; sıfır yazmak
// 0 mm'lik bir kasnak iddia etmek olurdu. Dört motorun krank çapı, on altısının
// fan drive çapı, yirmisinin kompresör dişlisi bu yüzden `null`.

var VE_FEAD_ENGINE_LIB_VERSION = '1.0.0';

var VE_FEAD_ENGINE_LIB_SOURCE =
  'KIRPI II NEX GEN FEAD defteri · "Motor Bilgileri" sayfası (BMC SAS ARGE, 13.08.2026)';

// key      → BMC parça numarası (defterin kendi anahtarı, INDEX/MATCH bununla)
// ad       → marka/model + FR çizim numarası, defterde yazdığı gibi
// cyl      → silindir sayısı (aile adından; yukarıdaki bloğa bak)
// *Rpm     → motorun dört devir sınırı [d/dk]
// *OD      → FEAD ile ilgili kasnak/dişli DIŞ çapları [mm], yoksa null
// curve    → tam yük eğrisi: devir [d/dk] · tork [Nm] · güç [kW]
var VE_FEAD_ENGINE_DB = [
  { key: '57RS303251', ad: 'ISB6.7360/FR97819', cyl: 6,
    idleRpm: 700, governedRpm: 2600, noLoadGovernedRpm: 2950, overspeedRpm: 3750,
    crankOD: 173.75, fanDriveOD: null, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:800,nm:670,kw:56}, {rpm:900,nm:752,kw:71}, {rpm:1000,nm:859,kw:90},
                {rpm:1100,nm:952,kw:110}, {rpm:1200,nm:1000,kw:126}, {rpm:1400,nm:1100,kw:161},
                {rpm:1700,nm:1100,kw:196}, {rpm:2000,nm:1100,kw:230},
                {rpm:2300,nm:1100,kw:265}, {rpm:2400,nm:1070,kw:269},
                {rpm:2500,nm:1027,kw:269}, {rpm:2600,nm:985,kw:268}, {rpm:2630,nm:930,kw:256}] },
  { key: '57RS303276', ad: 'ISB6.7E3 285/FR95014', cyl: 6,
    idleRpm: 700, governedRpm: 2500, noLoadGovernedRpm: 2850, overspeedRpm: 3250,
    crankOD: 173.18, fanDriveOD: null, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:800,nm:600,kw:50}, {rpm:1000,nm:780,kw:82}, {rpm:1200,nm:970,kw:122},
                {rpm:1400,nm:970,kw:142}, {rpm:1600,nm:970,kw:163}, {rpm:1700,nm:970,kw:173},
                {rpm:1900,nm:928,kw:185}, {rpm:2100,nm:886,kw:195}, {rpm:2500,nm:801,kw:210}] },
  { key: '57RS303310', ad: 'ISB6.7E3 245/FR95012', cyl: 6,
    idleRpm: 700, governedRpm: 2500, noLoadGovernedRpm: 2850, overspeedRpm: 3250,
    crankOD: 173.18, fanDriveOD: null, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:800,nm:600,kw:50}, {rpm:1000,nm:750,kw:79}, {rpm:1200,nm:925,kw:116},
                {rpm:1400,nm:925,kw:136}, {rpm:1600,nm:925,kw:155}, {rpm:1700,nm:925,kw:165},
                {rpm:1900,nm:867,kw:172}, {rpm:2100,nm:808,kw:178}, {rpm:2500,nm:688,kw:180}] },
  { key: '57RS303311', ad: 'ISB6.7E3 285/FR95014', cyl: 6,
    idleRpm: 700, governedRpm: 2500, noLoadGovernedRpm: 2850, overspeedRpm: 3250,
    crankOD: 173.18, fanDriveOD: 175.793, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:800,nm:600,kw:50}, {rpm:1000,nm:780,kw:82}, {rpm:1200,nm:970,kw:122},
                {rpm:1400,nm:970,kw:142}, {rpm:1600,nm:970,kw:163}, {rpm:1700,nm:970,kw:173},
                {rpm:1900,nm:928,kw:185}, {rpm:2100,nm:886,kw:195}, {rpm:2500,nm:801,kw:210}] },
  { key: '57RS303321', ad: 'ISB6.7 300/FR95366', cyl: 6,
    idleRpm: 700, governedRpm: 2500, noLoadGovernedRpm: 2850, overspeedRpm: 4200,
    crankOD: 173.75, fanDriveOD: null, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:700,nm:730,kw:54}, {rpm:900,nm:730,kw:69}, {rpm:1000,nm:800,kw:84},
                {rpm:1100,nm:950,kw:109}, {rpm:1200,nm:1100,kw:138}, {rpm:1400,nm:1100,kw:161},
                {rpm:1500,nm:1100,kw:173}, {rpm:1800,nm:1100,kw:207},
                {rpm:2000,nm:1045,kw:219}, {rpm:2100,nm:997,kw:219}, {rpm:2200,nm:953,kw:220},
                {rpm:2300,nm:916,kw:221}, {rpm:2500,nm:843,kw:221}, {rpm:2525,nm:833,kw:220}] },
  { key: '57RS303324', ad: 'ISB6.7 340/FR98387', cyl: 6,
    idleRpm: 700, governedRpm: 2800, noLoadGovernedRpm: null, overspeedRpm: 3250,
    crankOD: 173.75, fanDriveOD: null, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:800,nm:610,kw:51}, {rpm:900,nm:695,kw:66}, {rpm:1000,nm:780,kw:82},
                {rpm:1100,nm:875,kw:101}, {rpm:1200,nm:1000,kw:126}, {rpm:1300,nm:1050,kw:143},
                {rpm:1400,nm:1100,kw:161}, {rpm:1500,nm:1100,kw:173},
                {rpm:1600,nm:1100,kw:184}, {rpm:1700,nm:1100,kw:196},
                {rpm:1800,nm:1075,kw:203}, {rpm:1900,nm:1050,kw:209},
                {rpm:2000,nm:1025,kw:215}, {rpm:2100,nm:1000,kw:220}, {rpm:2200,nm:985,kw:227},
                {rpm:2300,nm:960,kw:231}, {rpm:2400,nm:950,kw:239}, {rpm:2500,nm:940,kw:246},
                {rpm:2800,nm:860,kw:252}] },
  { key: '57RS303325', ad: 'ISB4.5/FR94198', cyl: 4,
    idleRpm: 800, governedRpm: 2500, noLoadGovernedRpm: 2850, overspeedRpm: 4200,
    crankOD: 173.18, fanDriveOD: null, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:800,nm:270,kw:30.7}, {rpm:900,nm:295,kw:37.7}, {rpm:1000,nm:329,kw:46.7},
                {rpm:1100,nm:365,kw:56.5}, {rpm:1200,nm:389,kw:66.3},
                {rpm:1300,nm:425,kw:84.5}, {rpm:1400,nm:518,kw:103}, {rpm:1500,nm:560,kw:119},
                {rpm:1600,nm:560,kw:127}, {rpm:1700,nm:560,kw:135}, {rpm:1800,nm:560,kw:143},
                {rpm:1900,nm:545,kw:147}, {rpm:2000,nm:530,kw:151}, {rpm:2100,nm:515,kw:153.5},
                {rpm:2200,nm:500,kw:156}, {rpm:2300,nm:480,kw:157}, {rpm:2400,nm:458,kw:150.5},
                {rpm:2500,nm:406,kw:144}, {rpm:2530,nm:380,kw:133.5}, {rpm:2600,nm:295,kw:109},
                {rpm:2850,nm:0,kw:0}] },
  { key: '57RS303290', ad: 'ISG12 430/FR20547', cyl: 6,
    idleRpm: 700, governedRpm: 1900, noLoadGovernedRpm: 2100, overspeedRpm: 2375,
    crankOD: 204, fanDriveOD: 175.2, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:1000,nm:2000,kw:210}, {rpm:1100,nm:2000,kw:231}, {rpm:1200,nm:2000,kw:252},
                {rpm:1300,nm:2000,kw:273}, {rpm:1400,nm:2000,kw:294},
                {rpm:1500,nm:1955,kw:307}, {rpm:1600,nm:1909,kw:320},
                {rpm:1700,nm:1797,kw:320}, {rpm:1800,nm:1697,kw:320},
                {rpm:1900,nm:1589,kw:317}] },
  { key: '57RS303322', ad: 'ISGE3-510/FR21168', cyl: 6,
    idleRpm: 700, governedRpm: 1900, noLoadGovernedRpm: 2100, overspeedRpm: 2375,
    crankOD: 204, fanDriveOD: 142.704, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:600,nm:1200,kw:75}, {rpm:700,nm:1050,kw:77}, {rpm:800,nm:1433,kw:120},
                {rpm:900,nm:1816,kw:171}, {rpm:1000,nm:2100,kw:220}, {rpm:1100,nm:2100,kw:242},
                {rpm:1200,nm:2100,kw:264}, {rpm:1300,nm:2100,kw:286},
                {rpm:1400,nm:2100,kw:308}, {rpm:1500,nm:2100,kw:330},
                {rpm:1600,nm:2100,kw:352}, {rpm:1700,nm:2050,kw:365},
                {rpm:1800,nm:1960,kw:369}, {rpm:1900,nm:1874,kw:373},
                {rpm:1930,nm:1826,kw:369}] },
  { key: '57RS303234', ad: 'ISL8.9E3 375/FR94882', cyl: 6,
    idleRpm: 700, governedRpm: 2100, noLoadGovernedRpm: 2330, overspeedRpm: 2900,
    crankOD: 218.3, fanDriveOD: 179.62, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:800,nm:950,kw:80}, {rpm:1000,nm:1356,kw:142}, {rpm:1100,nm:1550,kw:179},
                {rpm:1200,nm:1550,kw:195}, {rpm:1400,nm:1550,kw:227},
                {rpm:1500,nm:1508,kw:237}, {rpm:1600,nm:1466,kw:246},
                {rpm:1700,nm:1424,kw:253}, {rpm:1800,nm:1380,kw:260},
                {rpm:1900,nm:1338,kw:266}, {rpm:2000,nm:1296,kw:271},
                {rpm:2100,nm:1250,kw:275}] },
  { key: '57RS303252', ad: 'ISL8.9E3 375/FR94882', cyl: 6,
    idleRpm: 700, governedRpm: 2100, noLoadGovernedRpm: 2330, overspeedRpm: 2900,
    crankOD: 197.72, fanDriveOD: 179.62, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:800,nm:950,kw:80}, {rpm:1000,nm:1356,kw:142}, {rpm:1100,nm:1550,kw:179},
                {rpm:1200,nm:1550,kw:195}, {rpm:1400,nm:1550,kw:227},
                {rpm:1500,nm:1508,kw:237}, {rpm:1600,nm:1466,kw:246},
                {rpm:1700,nm:1424,kw:253}, {rpm:1800,nm:1380,kw:260},
                {rpm:1900,nm:1338,kw:266}, {rpm:2000,nm:1296,kw:271},
                {rpm:2100,nm:1250,kw:275}] },
  { key: '57RS303280', ad: 'ISLe – T450/FR92598', cyl: 6,
    idleRpm: 700, governedRpm: 2200, noLoadGovernedRpm: 2400, overspeedRpm: 3150,
    crankOD: 197.72, fanDriveOD: 179.62, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:1200,nm:1559,kw:196}, {rpm:1300,nm:1627,kw:222}, {rpm:1400,nm:1627,kw:239},
                {rpm:1500,nm:1627,kw:256}, {rpm:1600,nm:1603,kw:269},
                {rpm:1700,nm:1579,kw:281}, {rpm:1800,nm:1555,kw:293},
                {rpm:1900,nm:1530,kw:305}, {rpm:2000,nm:1506,kw:316},
                {rpm:2100,nm:1482,kw:326}, {rpm:2200,nm:1458,kw:336}] },
  { key: '57RS303315', ad: 'ISL8.9E3 375/FR94882', cyl: 6,
    idleRpm: 700, governedRpm: 2100, noLoadGovernedRpm: 2330, overspeedRpm: 2900,
    crankOD: 197.72, fanDriveOD: 179.62, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:800,nm:950,kw:80}, {rpm:1000,nm:1356,kw:142}, {rpm:1100,nm:1550,kw:179},
                {rpm:1200,nm:1550,kw:195}, {rpm:1400,nm:1550,kw:227},
                {rpm:1500,nm:1508,kw:237}, {rpm:1600,nm:1466,kw:246},
                {rpm:1700,nm:1424,kw:253}, {rpm:1800,nm:1380,kw:260},
                {rpm:1900,nm:1338,kw:266}, {rpm:2000,nm:1296,kw:271},
                {rpm:2100,nm:1250,kw:275}] },
  { key: '57RS303323', ad: 'ISL9E3 400/FR95441', cyl: 6,
    idleRpm: 700, governedRpm: 2100, noLoadGovernedRpm: 2330, overspeedRpm: 2900,
    crankOD: 197.72, fanDriveOD: 179.62, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:700,nm:700,kw:51}, {rpm:800,nm:950,kw:80}, {rpm:900,nm:1153,kw:109},
                {rpm:1000,nm:1356,kw:142}, {rpm:1100,nm:1550,kw:179},
                {rpm:1200,nm:1550,kw:195}, {rpm:1300,nm:1550,kw:211},
                {rpm:1400,nm:1550,kw:227}, {rpm:1500,nm:1508,kw:237},
                {rpm:1600,nm:1466,kw:245}, {rpm:1700,nm:1424,kw:254},
                {rpm:1800,nm:1405,kw:266}, {rpm:1900,nm:1389,kw:276},
                {rpm:2000,nm:1410,kw:296}, {rpm:2100,nm:1355,kw:298}] },
  { key: '57RS303120', ad: 'ISMe385 30/FR2855', cyl: 6,
    idleRpm: 700, governedRpm: 1900, noLoadGovernedRpm: 2130, overspeedRpm: 2600,
    crankOD: null, fanDriveOD: null, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:1000,nm:1572,kw:164}, {rpm:1100,nm:1775,kw:204}, {rpm:1200,nm:1835,kw:230},
                {rpm:1300,nm:1830,kw:249}, {rpm:1400,nm:1790,kw:262},
                {rpm:1500,nm:1724,kw:270}, {rpm:1600,nm:1652,kw:277},
                {rpm:1700,nm:1578,kw:281}, {rpm:1800,nm:1501,kw:283},
                {rpm:1900,nm:1431,kw:283}] },
  { key: '57RS303172', ad: 'ISM380E 20/FR2695', cyl: 6,
    idleRpm: 700, governedRpm: 1900, noLoadGovernedRpm: 2130, overspeedRpm: 2600,
    crankOD: 190.7, fanDriveOD: 152, compGearOD: 220, compGearRatio: 1, waterPumpOD: 110.9,
      curve: [{rpm:1000,nm:1560,kw:163}, {rpm:1100,nm:1763,kw:203}, {rpm:1200,nm:1825,kw:229},
                {rpm:1300,nm:1817,kw:247}, {rpm:1400,nm:1776,kw:260},
                {rpm:1500,nm:1708,kw:268}, {rpm:1600,nm:1634,kw:274},
                {rpm:1700,nm:1558,kw:277}, {rpm:1800,nm:1479,kw:279},
                {rpm:1900,nm:1406,kw:280}] },
  { key: '57RS303235', ad: 'ISM440E 20/FR2578', cyl: 6,
    idleRpm: 700, governedRpm: 1900, noLoadGovernedRpm: 2130, overspeedRpm: 2600,
    crankOD: null, fanDriveOD: null, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:800,nm:1250,kw:105}, {rpm:900,nm:1464,kw:138}, {rpm:1000,nm:1695,kw:177},
                {rpm:1100,nm:1910,kw:220}, {rpm:1200,nm:2100,kw:264},
                {rpm:1300,nm:2100,kw:286}, {rpm:1400,nm:2040,kw:299},
                {rpm:1500,nm:1975,kw:310}, {rpm:1600,nm:1885,kw:316},
                {rpm:1700,nm:1798,kw:320}, {rpm:1800,nm:1717,kw:324},
                {rpm:1900,nm:1600,kw:318}] },
  { key: '57RS303304', ad: 'ISME385 30/FR20317', cyl: 6,
    idleRpm: 700, governedRpm: 1900, noLoadGovernedRpm: 2130, overspeedRpm: 2600,
    crankOD: 190.7, fanDriveOD: 152, compGearOD: 220, compGearRatio: 1, waterPumpOD: 139,
      curve: [{rpm:1000,nm:1572,kw:164}, {rpm:1100,nm:1775,kw:204}, {rpm:1200,nm:1835,kw:230},
                {rpm:1300,nm:1830,kw:249}, {rpm:1400,nm:1790,kw:262},
                {rpm:1500,nm:1724,kw:270}, {rpm:1600,nm:1652,kw:277},
                {rpm:1700,nm:1578,kw:281}, {rpm:1800,nm:1501,kw:283},
                {rpm:1900,nm:1431,kw:283}] },
  { key: '57RS303309', ad: 'ISMe420 30/FR2854', cyl: 6,
    idleRpm: 700, governedRpm: 1900, noLoadGovernedRpm: 2130, overspeedRpm: 2600,
    crankOD: 190.7, fanDriveOD: 152, compGearOD: 220, compGearRatio: 1, waterPumpOD: 110.9,
      curve: [{rpm:1000,nm:1707,kw:178}, {rpm:1100,nm:1922,kw:221}, {rpm:1200,nm:2010,kw:252},
                {rpm:1300,nm:1974,kw:269}, {rpm:1400,nm:1942,kw:285},
                {rpm:1500,nm:1891,kw:292}, {rpm:1600,nm:1785,kw:299},
                {rpm:1700,nm:1692,kw:302}, {rpm:1800,nm:1607,kw:305},
                {rpm:1900,nm:1541,kw:306}] },
  { key: '57RS303316', ad: 'ISM11 425/FR21019', cyl: 6,
    idleRpm: 700, governedRpm: 2100, noLoadGovernedRpm: 2300, overspeedRpm: 2600,
    crankOD: null, fanDriveOD: null, compGearOD: null, compGearRatio: null, waterPumpOD: null,
      curve: [{rpm:1100,nm:1831,kw:211}, {rpm:1200,nm:2102,kw:264}, {rpm:1300,nm:2102,kw:286},
                {rpm:1400,nm:2046,kw:300}, {rpm:1500,nm:1992,kw:313},
                {rpm:1600,nm:1936,kw:324}, {rpm:1700,nm:1822,kw:324},
                {rpm:1800,nm:1721,kw:324}, {rpm:1900,nm:1627,kw:324},
                {rpm:2000,nm:1535,kw:321}, {rpm:2100,nm:1441,kw:317}] },
  { key: '57RS303279', ad: 'ISX Signiture 600/FR10149', cyl: 6,
    idleRpm: 700, governedRpm: 2000, noLoadGovernedRpm: null, overspeedRpm: null,
    crankOD: 212, fanDriveOD: 165, compGearOD: null, compGearRatio: null, waterPumpOD: 140,
      curve: [{rpm:1100,nm:2780,kw:320}, {rpm:1200,nm:2780,kw:349}, {rpm:1300,nm:2780,kw:378},
                {rpm:1400,nm:2780,kw:407}, {rpm:1500,nm:2732,kw:429},
                {rpm:1600,nm:2679,kw:449}, {rpm:1700,nm:2613,kw:465},
                {rpm:1800,nm:2496,kw:471}, {rpm:1900,nm:2317,kw:461},
                {rpm:2000,nm:2137,kw:448}] },
  { key: '57RS303291', ad: 'ISX15NCT 600U/FR11860', cyl: 6,
    idleRpm: 700, governedRpm: 2000, noLoadGovernedRpm: 2030, overspeedRpm: 2625,
    crankOD: 239, fanDriveOD: 198.7, compGearOD: null, compGearRatio: null, waterPumpOD: 126,
      curve: [{rpm:600,nm:1245,kw:78}, {rpm:700,nm:1383,kw:101}, {rpm:800,nm:1695,kw:142},
                {rpm:900,nm:1966,kw:185}, {rpm:983,nm:2229,kw:229}, {rpm:1150,nm:2779,kw:335},
                {rpm:1200,nm:3000,kw:377}, {rpm:1300,nm:2847,kw:388},
                {rpm:1400,nm:2712,kw:398}, {rpm:1500,nm:2644,kw:415},
                {rpm:1600,nm:2576,kw:432}, {rpm:1700,nm:2508,kw:446},
                {rpm:1800,nm:2434,kw:459}, {rpm:1900,nm:2285,kw:455},
                {rpm:2000,nm:2137,kw:448}, {rpm:2030,nm:2096,kw:446}] },
  { key: '57RS303308', ad: 'X15E3 600/FR11779', cyl: 6,
    idleRpm: 700, governedRpm: 2000, noLoadGovernedRpm: 2031, overspeedRpm: 2625,
    crankOD: 239, fanDriveOD: 198.7, compGearOD: null, compGearRatio: null, waterPumpOD: 130.8,
      curve: [{rpm:600,nm:1245,kw:78}, {rpm:700,nm:1384,kw:101}, {rpm:800,nm:1513,kw:127},
                {rpm:900,nm:1695,kw:160}, {rpm:965,nm:1830,kw:185}, {rpm:1000,nm:1966,kw:206},
                {rpm:1100,nm:2508,kw:289}, {rpm:1200,nm:2508,kw:315},
                {rpm:1400,nm:2508,kw:368}, {rpm:1500,nm:2508,kw:394},
                {rpm:1600,nm:2508,kw:420}, {rpm:1700,nm:2429,kw:432},
                {rpm:1800,nm:2314,kw:436}, {rpm:1900,nm:2230,kw:444},
                {rpm:2000,nm:2137,kw:447}] },
  { key: '57RS303317', ad: 'X15 NCT 675/FR12042', cyl: 6,
    idleRpm: 700, governedRpm: 2000, noLoadGovernedRpm: 2031, overspeedRpm: 2625,
    crankOD: 239, fanDriveOD: 198.7, compGearOD: null, compGearRatio: null, waterPumpOD: 130.8,
      curve: [{rpm:600,nm:1245,kw:78}, {rpm:700,nm:1384,kw:101}, {rpm:800,nm:1513,kw:127},
                {rpm:900,nm:1695,kw:160}, {rpm:965,nm:1830,kw:185}, {rpm:1000,nm:1966,kw:206},
                {rpm:1100,nm:2779,kw:320}, {rpm:1200,nm:2779,kw:349},
                {rpm:1300,nm:2779,kw:378}, {rpm:1400,nm:2779,kw:407},
                {rpm:1500,nm:2779,kw:436}, {rpm:1600,nm:2752,kw:461},
                {rpm:1700,nm:2712,kw:483}, {rpm:1800,nm:2671,kw:503},
                {rpm:1900,nm:2530,kw:503}, {rpm:2000,nm:2403,kw:503}] },
];

// ─── SAYI OKUMA ─────────────────────────────────────────────────────────────
// Kendi yerel yardımcısı: bu dosya `js/fead-model.js`'ten ÖNCE yüklenebilsin
// ve `_feadNum`'a bağımlı olmasın (üst-seviye çakışma kapısı da aynı adı iki
// dosyada bildirmeye izin vermezdi).
function _feNum(v){
  var n = (typeof v === 'string') ? Number(v.trim().replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// Liste — KOPYA döner (katalog dizisini dışarı vermek, bir çağrının onu
// yerinde değiştirip bütün oturumu sessizce bozmasına kapı bırakırdı).
function veFeadEngineList(){
  return VE_FEAD_ENGINE_DB.map(function(e){
    return { key: e.key, ad: e.ad, label: veFeadEngineLabel(e) };
  });
}

function veFeadEngineLabel(e){
  if(!e) return '';
  return e.ad + '  ·  ' + e.key
    + (e.governedRpm > 0 ? '  ·  ' + e.governedRpm + ' d/dk' : '');
}

function veFeadEngineOf(key){
  var k = String(key == null ? '' : key).trim();
  if(!k) return null;
  for(var i = 0; i < VE_FEAD_ENGINE_DB.length; i++)
    if(VE_FEAD_ENGINE_DB[i].key === k) return VE_FEAD_ENGINE_DB[i];
  return null;
}

// Parça numarası ya da model adının PARÇASI ile arama. Kullanıcı defterden
// "ISL8.9" kopyalayıp yapıştırabilsin diye; birden çok eşleşme varsa hepsi
// döner ve seçim çağırana kalır (tek eşleşme varmış gibi davranmak, üç ayrı
// ISL8.9E3 375 kaydından rastgele birini seçmek olurdu).
function veFeadEngineFind(text){
  var s = String(text == null ? '' : text).trim().toUpperCase();
  if(!s) return [];
  return VE_FEAD_ENGINE_DB.filter(function(e){
    return e.key.toUpperCase().indexOf(s) >= 0 || e.ad.toUpperCase().indexOf(s) >= 0;
  });
}

// Dört devir sınırı tek nesnede. Eksik olan alan `null` KALIR — 0 yazmak
// "bu motorun overspeed'i sıfır" demek olurdu ve devir sınırı kapısı onu
// anında ihlal sayardı.
function veFeadEngineSpeeds(e){
  var r = (typeof e === 'string') ? veFeadEngineOf(e) : e;
  if(!r) return null;
  return { idleRpm: r.idleRpm, governedRpm: r.governedRpm,
           noLoadGovernedRpm: r.noLoadGovernedRpm, overspeedRpm: r.overspeedRpm };
}

// Tam yük eğrisinden ara değerleme. UÇLARDA SABİT TUTAR (ekstrapolasyon yok) —
// `veFeadInterpKw`'ün aksesuar tarafındaki kuralıyla aynı; motor eğrisini
// governed devrin ötesine uzatmak var olmayan bir güç iddia etmek olurdu.
function veFeadEngineAt(e, rpm){
  var r = (typeof e === 'string') ? veFeadEngineOf(e) : e;
  var n = _feNum(rpm);
  if(!r || !r.curve || !r.curve.length || !Number.isFinite(n)) return null;
  var c = r.curve;
  if(c.length === 1 || n <= c[0].rpm) return { nm: c[0].nm, kw: c[0].kw };
  if(n >= c[c.length - 1].rpm) return { nm: c[c.length-1].nm, kw: c[c.length-1].kw };
  for(var i = 1; i < c.length; i++){
    if(n <= c[i].rpm){
      var a = c[i-1], b = c[i], t = (b.rpm === a.rpm) ? 0 : (n - a.rpm) / (b.rpm - a.rpm);
      var lerp = function(x, y){
        return (Number.isFinite(x) && Number.isFinite(y)) ? (x + (y - x) * t) : null;
      };
      return { nm: lerp(a.nm, b.nm), kw: lerp(a.kw, b.kw) };
    }
  }
  return null;
}

// Künyeyi çözücü düğümünün verisine yazar. HANGİ ALANIN NEREDEN GELDİĞİ
// KAYITLI (`engineLib`) — kullanıcı sonradan bir alanı elle değiştirdiğinde
// panel "katalogdan sapıldı" diyebilsin diye.
//
// KATALOGDA `null` OLAN ALANA DOKUNULMAZ: motorun fan drive kasnağı yoksa
// kullanıcının kendi girdiği değeri silmek, olmayan bir bilgiyi dayatmak olurdu.
function veFeadEngineApply(sd, key){
  var e = veFeadEngineOf(key);
  if(!sd || !e) return sd;
  sd.engineLib    = e.key;
  sd.engineLibVer = VE_FEAD_ENGINE_LIB_VERSION;
  sd.cylinders    = e.cyl;
  ['idleRpm','governedRpm','noLoadGovernedRpm','overspeedRpm'].forEach(function(k){
    if(e[k] != null) sd[k] = e[k];
  });
  // Birinci kademe: iki çap da varsa oran türetilebilir; yoksa kip
  // DEĞİŞTİRİLMEZ (tek kademeli sistemde oran 1'dir ve çap sormak anlamsız).
  if(e.crankOD != null) sd.crankOD = e.crankOD;
  if(e.fanDriveOD != null) sd.fanOD = e.fanDriveOD;
  if(e.crankOD != null && e.fanDriveOD != null) sd.ratioMode = 'derive';
  return sd;
}

// Düğümdeki kayıt hâlâ katalogla aynı mı? Panelin "elle değiştirildi" rozeti
// bunu okur. Karşılaştırma SAYISAL (metin değil): 700 ile "700" aynı sayıdır.
function veFeadEngineDrift(sd){
  var e = veFeadEngineOf(sd && sd.engineLib);
  if(!e) return null;
  var out = { key: e.key, ad: e.ad, drift: [] };
  var alanlar = [
    ['cylinders', e.cyl, 'silindir sayısı'],
    ['idleRpm', e.idleRpm, 'rölanti'], ['governedRpm', e.governedRpm, 'governed'],
    ['noLoadGovernedRpm', e.noLoadGovernedRpm, 'no load governed'],
    ['overspeedRpm', e.overspeedRpm, 'overspeed'],
    ['crankOD', e.crankOD, 'krank kasnağı Ø'], ['fanOD', e.fanDriveOD, 'fan kasnağı Ø']
  ];
  alanlar.forEach(function(a){
    if(a[1] == null) return;                       // katalogda yok → hüküm yok
    var v = _feNum(sd[a[0]]);
    if(Number.isFinite(v) && Math.abs(v - a[1]) > 1e-6)
      out.drift.push(a[2] + ': ' + v + ' (katalog ' + a[1] + ')');
  });
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_ENGINE_LIB_VERSION: VE_FEAD_ENGINE_LIB_VERSION,
    VE_FEAD_ENGINE_LIB_SOURCE: VE_FEAD_ENGINE_LIB_SOURCE,
    VE_FEAD_ENGINE_DB: VE_FEAD_ENGINE_DB,
    veFeadEngineList: veFeadEngineList,
    veFeadEngineLabel: veFeadEngineLabel,
    veFeadEngineOf: veFeadEngineOf,
    veFeadEngineFind: veFeadEngineFind,
    veFeadEngineSpeeds: veFeadEngineSpeeds,
    veFeadEngineAt: veFeadEngineAt,
    veFeadEngineApply: veFeadEngineApply,
    veFeadEngineDrift: veFeadEngineDrift
  };
}
