/* =========================================================================
 * adams-ttar.js — TTAR (BMC Savunma 8×8) takoz analizi için ADAMS REFERANS VERİSİ
 * (dondurulmuş)
 * =========================================================================
 * NE: Adams .BMC_TTAR_2031 modelinin sonuç tablosu — 14 yük durumu × 6 takoz ×
 * (δx, δy, δz), 6 rijit gövde modu (sönümsüz), TR ve toplam kütle. Kaynak:
 * kullanıcının "TTAR_Engine_Bus_STVDM_2031" çalışma kitabı (2026-11-02):
 * 'Çıktılar' sayfası, Adams'ın mod tablosu ve toplam kütle ekranı (görseller),
 * girdiler 'genel' · 'shaft' · 'Braket' · 'Takoz_Özellikleri' sayfalarında.
 * Programdaki karşılığı: assets/examples/siper_topoloji.json (aynı model).
 *
 * ── ÜÇ BULGU ────────────────────────────────────────────────────────────────
 *   1. ARAÇ EKSENİ TERS. TTAR'ın CAD ekseninde araç İLERİ +X, SOL +Y; Tulga'da
 *      ileri −X, sağ +Y (Z etrafında 180°). Programın ivme yük durumları
 *      (MNT_AUTO_CASES) ileri −X eksende yazılı; 2026-11-02'den beri Çözücü'nün
 *      ayarı (ileri) n_x ve n_y'yi çevirir ve örnek ileri +X ile gelir.
 *      Varsayılan yönde boyuna ve yanal yükler TERS uygulanır. Tork yönü ayrı
 *      ayardır (torkYon): TTAR'ın Adams'ı varsayılanla (−X) tutuyor — motorun
 *      önü −X'te, aktarma güç grubunda dönüşü çevirmiyor.
 *   2. ADAMS TABLOSUNUN X/Y'Sİ DÖNDÜRÜLMÜŞ EKSENDE. Saf düşey yükte bile δx ve
 *      δy'nin işareti CAD ekseninin tersi, δz aynı (Z etrafında 180°): takozun
 *      raporladığı eksen takımı. Karşılaştırma Adams'ın X ve Y'sini çevirir.
 *   3. KALDIRIM DARBESİ 3,5 g, VİRAJLA AYNI YÖNDE. Programın varsayılanı
 *      (Tulga'nın Adams'ı) 1,55 g ve virajın tersi yönde; iki analizin tanımı
 *      farklı. Örnek Çözücü'de 3,5 g · virajla aynı ile gelir.
 *
 * ── KİTAPTAKİ TUTARSIZLIKLAR (karşılaştırma dışı) ───────────────────────────
 *   • Acceleration satırı: altı takozda birebir aynı (3; 0; −6) — yer tutucu.
 *   • Braking · sol orta δz −4,0 (sağ orta −7,5; program −7,51).
 *   • Max Rebound · sağ ön δz 7,1 (Static'in tersi 4,0 olmalı; sol ön 4,0).
 *   • Kerb Strike (R) · sol orta δz −15 ve sağ arka δz −4,74 (Kerb Strike
 *     (L)'nin aynası +7 ve −15 olmalı).
 *   Adams'ın nokta tablosunda sol ön takozun x'i −948,17 (kitapta −948,697).
 *
 * Değerler mm; tablo çoğunlukla 0,1 mm'e, bir kısmı tam sayıya yuvarlı.
 * ========================================================================= */

'use strict';

// Kitabın sütun adı → assets/examples/siper_topoloji.json'daki takoz adı
const COLUMNS = [
  { col: 'sag ön',   mount: 'Sağ Ön Takoz' },
  { col: 'sol ön',   mount: 'Sol Ön Takoz' },
  { col: 'sag orta', mount: 'Sağ Orta Takoz' },
  { col: 'sol orta', mount: 'Sol Orta Takoz' },
  { col: 'sag arka', mount: 'Sağ Arka Takoz' },
  { col: 'sol arka', mount: 'Sol Arka Takoz' },
];

// Satır adı → MFSim yük durumu adı (js/cp-mount.js MNT_AUTO_CASES + tork)
const ROWS = [
  { row: 'Static',                      lc: 'Static' },
  { row: 'Max Bump',                    lc: 'Max Bump' },
  { row: 'Braking',                     lc: 'Braking' },
  { row: 'Acceleration',                lc: 'Acceleration',    gap: 'yer-tutucu' },
  { row: 'Cornering Left',              lc: 'Cornering Left' },
  { row: 'Cornering Right',             lc: 'Cornering Right' },
  { row: 'Brake in Turn (L)',           lc: 'Brake in Turn L' },
  { row: 'Brake in Turn (R)',           lc: 'Brake in Turn R' },
  { row: 'Pothole Braking',             lc: 'Pothole Braking' },
  { row: 'Rim Lateral Kerb Strike (L)', lc: 'Kerb Strike L',   gap: 'kaldirim' },
  { row: 'Rim Lateral Kerb Strike (R)', lc: 'Kerb Strike R',   gap: 'kaldirim' },
  { row: 'Max Rebound',                 lc: 'Max Rebound' },
  { row: 'Forward (3.51)',              lc: 'Forward Torque' },
  { row: 'Reverse (-4.8)',              lc: 'Reverse Torque' },
];

// Satır × sütun × [δx, δy, δz] (mm), Adams'ın raporladığı eksende. ROWS/COLUMNS sırasıyla.
const TABLE = [
  [[0.33,0.0472,-4],[0.33,-0.0045,-4],[-0.2,-0.0146,-7],[-0.0647,-0.0043,-6.6],[-0.2,-0.0145,-7.1],[-0.0647,-0.0043,-6.8]],
  [[0.1,0,-13.9],[0.1,-0.0066,-13.9],[-0.05,-0.021,-14.9],[-0.05,-0.0063,-14.9],[-0.05,-0.0207,-15],[-0.05,-0.0063,-14.9709]],
  [[-1.8,0,-1.8],[-1.9,0,-1.7],[-3.4,0,-7.5],[-3.3,0,-4],[-3.4,0,-8.3],[-3.3,0,-7.9]],
  [[3,0,-6],[3,0,-6],[3,0,-6],[3,0,-6],[3,0,-6],[3,0,-6]],
  [[0.3,1.1,-3.6],[0.3,1.1,-4.23],[0,2.2,-4.5],[-0.3,2.2,-9],[0,2.2,-4.72],[-0.3,2.2,-9.4]],
  [[0.4,-1.1,-4.5],[0.4,-1.1,-4.5],[0,-2.23,-9.5],[0,-2.23,-4.5],[-0.4,-2.2,-9.5],[-0.42,-2.2,-4.5]],
  [[-0.83,0.73,-3.3],[-0.8,0.73,-3.3],[-1.5,1.45,-6],[-1.5,1.45,-9],[-1.5,1.45,-6],[-1.5,1.45,-9]],
  [[-0.8,-0.7,-3.3],[-0.8,-0.7,-3.3],[-1.5,-1.5,-9.2],[-1.5,-1.5,-5.6],[-1.5,-1.5,-9.2],[-1.5,-1.5,-5.6]],
  [[-8.2,0,-7.6],[-8.2,0,-7.6],[-9.45,0,-14.5],[-9.45,0,-14.5],[-9.45,0,-15],[-9.45,0,-15]],
  [[0,6.6,-2.3],[0,6.6,-5.5],[0.5,13,7],[-0.5,13,-15],[0.5,13,7],[-0.5,13,-15]],
  [[0,-6.5,-5.3],[0,-6.5,-2.2],[-0.5,-13,-15],[0.5,-13,-15],[-0.5,-13,-4.74],[0.5,-13,7.3]],
  [[-0.3,-0.0466,7.1],[-0.3,0.0043,4],[0.2,0.0143,7],[0.1,0.0044,6.6],[0.2,0.0145,7.1],[0.091,0.0044,6.8]],
  [[0.2,0.5,-5],[0.5,0.5,-3],[-1.2,-0.3,-14],[0.85,-0.5,0.3],[-1.2,0,-14],[0.85,-0.2,0.3]],
  [[0,-1,-0.9],[-0.7,-1.1,-5.2],[2.5,1.3,14.8],[-2,0.7,-15],[2.5,0.7,15],[-2,0.1,-15]],
];

// Kitabın kendi içinde tutarsız hücreleri (axis: 0 x · 1 y · 2 z) ve tutarlı karşılığı
const SUPHELI = [
  { row: 'Braking',                     col: 'sol orta', axis: 2, karsi: { row: 'Braking', col: 'sag orta' } },
  { row: 'Max Rebound',                 col: 'sag ön',   axis: 2, karsi: { row: 'Max Rebound', col: 'sol ön' } },
  { row: 'Rim Lateral Kerb Strike (R)', col: 'sol orta', axis: 2, karsi: { row: 'Rim Lateral Kerb Strike (R)', col: 'sag orta' } },
  { row: 'Rim Lateral Kerb Strike (R)', col: 'sag arka', axis: 2, karsi: { row: 'Rim Lateral Kerb Strike (R)', col: 'sol arka' } },
];

// Adams'ın mod tablosu (sönümsüz, Hz) ve kitabın mod tipleri; TR (oran)
const MODES = [5.04802, 6.10911, 8.36465, 10.1485, 12.0698, 21.2183];
const MODE_TYPES = ['roll', 'pitch', 'pitch', 'yaw', 'pitch+Fore and aft', 'roll'];
const TR = 0.052;

// Adams'ın toplam kütlesi ve ağırlık merkezi (mm)
const MASS = { m: 2294.482, cg: [254.6785469879, 7.5038098782, 746.0504338539] };

// Kitabın girdileri ('genel' · 'shaft' · 'Braket' · 'Takoz_Özellikleri')
const INPUT = {
  bodies: [
    { name: 'Motor',      mass: 1386.26, cg: [-321.36, 4.89, 859.33],      I: [110.7, 260.2, 205.9] },
    { name: 'Şanzıman',   mass: 778.3,   cg: [905.8148, 11.17, 683.81],    I: [16.43, 68.15, 64.91] },
    { name: 'Şaft payı',  mass: 50.65,   cg: [3041.582, 0, -168.4185],     I: null },
    { name: 'Sol cradle', mass: 39.635,  cg: [2158.356, -274.782, -39.54], I: [0.237, 3.851, 3.727] },
    { name: 'Sağ cradle', mass: 39.637,  cg: [2150.654, 318.791, -39.54],  I: [0.237, 3.851, 3.727] },
  ],
  mounts: [
    [-948.697, 50.81, 371.023], [-948.697, -50.81, 371.023],
    [535.313, 357.192, 635.27], [535.313, -357.109, 635.27],
    [636.813, 357.192, 635.27], [636.813, -357.109, 635.27],
  ],                                                        // COLUMNS sırasıyla
  kstat: [1252, 1252, 640], kdyn: [2055, 2055, 977],       // LMT-1433-37 (57RS320308M), 55 ShA
  torque: { Te: 3000, Rstall: 1.62, iTransfer: 1.407, g1: 3.51, gR: -4.8, phiFwd: 1 / 3.6, phiRev: 2.6 / 3.6 },
};

// TR için motor: ataleti Cummins X15 veri sayfasıyla birebir; rölanti ve silindir
// programın FEAD motor kataloğundan (X15E3 600 · 57RS303308) — örneğin Motor'unda
const ENGINE = { ad: 'Cummins X15', idleRpm: 700, cylinders: 6 };

// Bulgu 3: kitabın kaldırım darbesi (yanal g, virajla aynı yönde)
const KERB_G = 3.5;

module.exports = { COLUMNS, ROWS, TABLE, SUPHELI, MODES, MODE_TYPES, TR, MASS, INPUT, ENGINE, KERB_G };
