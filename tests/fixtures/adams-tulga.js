/* =========================================================================
 * adams-tulga.js — Tulga takoz analizi için ADAMS REFERANS VERİSİ (dondurulmuş)
 * =========================================================================
 * NE: Tulga güç grubu takoz analizinin Adams'ta üretilmiş sonuç tablosu —
 * 14 yük durumu × 5 takoz × (δx, δy, δz) ve 6 rijit gövde modu.
 *
 * NEDEN AYRI BİR DOSYA: sevk edilen örnek (assets/examples/tulga_topoloji.json)
 * ile Adams'ın koştuğu model ARASINDA BİLİNEN BİR GİRDİ FARKI VAR (aşağıda).
 * Örneği kataloğa göre düzeltmek doğru olandı, ama düzeltme Adams uyumunu
 * kötüleştirdi. O bilgi hiçbir yerde kayıtlı değildi; bu dosya onun defteri.
 * Karşılaştırma yeniden üretilebilir kalsın, fark sayıyla dursun, ve biri
 * "modal neden tutmuyor" diye sorduğunda cevap sohbet geçmişinde değil kodda
 * olsun diye.
 *
 * ── İKİ ADAMS TABLOSU VARDI, BİRİ SEÇİLDİ ───────────────────────────────────
 * Kullanıcı iki sonuç seti getirdi; hangisinin güncel olduğu bilinmiyordu.
 * Programın girdileriyle koşturularak ayrıldı — ayırt edici STATİK Y satırı:
 *
 *   MFSim     : −0,19  −0,17  +0,25  −0,16  +0,25   (modelin Y-asimetrisi)
 *   TABLO 1   : −0,2   −0,2   +0,3   −0,2   +0,3    ← beşi de birebir
 *   Tablo 2   :  0,0    0,0    0,0    0,0    0,0
 *
 * Tablo 2'nin sıfırları tesadüf değil: model simetrikleştirilince (şanzıman/
 * transfer CG'lerinin y'si 0, braketler aynalı, arka takozların y ve z'si eşit)
 * MFSim de beş sıfır veriyor. Tablo 2 ayrıca daha SERT — altı modu da %3–9
 * yüksek ve TR %11,00 → %13,18. Yani Tablo 2 aynı modelin yeniden koşusu değil,
 * BAŞKA bir model (simetrik + sert). Bu dosya Tablo 1'i tutar.
 *
 * ── BİLİNEN GİRDİ FARKI: TK040 dinamik rijitliğinde X ↔ Z ───────────────────
 * Sevk edilen örnek, programın gömülü kataloğunu (VE_MOUNT_LIBRARY → TK040 ·
 * 57RS329001M, kaynak MLMT-0216-33-TK040) izler: dx 740 · dy 355 · dz 335.
 * Adams'ın koştuğu model, ölçülen kanıta göre, X ile Z'si takas edilmiş hâli
 * taşıyor: 335 · 355 · 740.
 *
 * KANIT — takas edilmiş hâl Tablo 1'e DAHA YAKIN (modal RMS 0,539 < 1,010 Hz),
 * yani Adams'ın girdisi büyük olasılıkla takaslı. Ama takaslı hâl fiziksel
 * olarak imkânsız (dx/sx = 0,65; dinamik rijitlik statiğin altına inmez) ve
 * kütüphanedeki 27 girdinin hiçbiri böyle değil. Bu yüzden sevk edilen örnek
 * KATALOĞA göre düzeltildi ve Adams girdisi buraya, fikstüre kondu.
 *
 * KAPANMAMIŞ SORU: MLMT-0216-33-TK040 raporunun kendisi depoda YOK. Katalog
 * kaydı rapordan takaslı girilmişse yön terstir. Meseleyi kapatacak tek şey o
 * raporun ilgili sayfası ya da Adams modelinin girdi dosyasıdır. Cevap
 * geldiğinde: doğrulanırsa bu fikstür güncellenir, çürütülürse katalog.
 *
 * ── ADAMS'TA OLUP MFSim'DE OLMAYAN İKİ ŞEY ──────────────────────────────────
 * Bunlar girdi farkı değil MODEL farkı; iki Adams tablosu da hemfikir:
 *   1. YANAL DURDURUCU — Kerb Strike satırlarında ön takozların Y'si ~12 mm'de
 *      duruyor: Tablo 1'de dört hücrenin üçü tam ±12,0, biri 11,9; Tablo 2'de
 *      dördü de tam ±12,0. MFSim'de yalnız düşey (±15 mm) durdurucu olduğu için
 *      o değerleri aşıyor (12,05 … 12,56) ve ön takozlar dibe oturmadığı için
 *      arka takozlara yük dağılmıyor (Adams ~9,7 mm, MFSim ~7,5 mm).
 *   2. TORK İŞARETİ — Forward/Reserve satırlarında Y ve Z sistematik ters
 *      (X tutuyor). MFSim Tx = −T_shaft uygular; Adams ters yalpa yönünde.
 *
 * SÜTUN ↔ TAKOZ eşlemesi (Adams sütun adı → örnekteki takoz adı) aşağıda.
 * Değerler mm; tablo 0,1 mm'e yuvarlı, dolayısıyla |fark| ≤ 0,05 mm "birebir".
 * ========================================================================= */

'use strict';

// Adams sütun adı → assets/examples/tulga_topoloji.json'daki takoz adı
const COLUMNS = [
  { col: 'On',         mount: 'Ön Takoz' },
  { col: 'Sag_Arka',   mount: 'Sağ Arka Takoz' },
  { col: 'Sag_On_X',   mount: 'Sağ Ön Takoz' },
  { col: 'Sol_Arka_X', mount: 'Sol Arka Takoz' },
  { col: 'Sol_On_X',   mount: 'Sol Ön Takoz' },
];

// Satır adı → MFSim yük durumu adı (js/cp-mount.js MNT_AUTO_CASES + tork)
const ROWS = [
  { row: 'Static',            lc: 'Static' },
  { row: 'Max Bump',          lc: 'Max Bump' },
  { row: 'Braking',           lc: 'Braking' },
  { row: 'Acceleration',      lc: 'Acceleration' },
  { row: 'Cornering Left',    lc: 'Cornering Left' },
  { row: 'Cornering Right',   lc: 'Cornering Right' },
  { row: 'Brake in Turn (L)', lc: 'Brake in Turn L' },
  { row: 'Brake in Turn (R)', lc: 'Brake in Turn R' },
  { row: 'Pothole Braking',   lc: 'Pothole Braking' },
  { row: 'Kerb Strike (L)',   lc: 'Kerb Strike L',  gap: 'yanal-durdurucu' },
  { row: 'Kerb Strike (R)',   lc: 'Kerb Strike R',  gap: 'yanal-durdurucu' },
  { row: 'Max Rebound',       lc: 'Max Rebound' },
  { row: 'Forward (3.49)',    lc: 'Forward Torque', gap: 'tork-isareti' },
  { row: 'Reserve (-5.03)',   lc: 'Reverse Torque', gap: 'tork-isareti' },
];

// Tablo 1 — satır × sütun × [δx, δy, δz] (mm). COLUMNS/ROWS sırasıyla.
const TABLE1 = [
  [[0,-0.2,-6.7],[0,-0.2,-7.0],[0,0.3,-7.1],[0,-0.2,-6.3],[0,0.3,-6.3]],
  [[0,0,-15.0],[0,0,-15.0],[0,0,-15.0],[0,0,-15.0],[0,0,-15.0]],
  [[-2.9,-0.4,-8.6],[-2.6,0,-5.2],[-3.8,0.3,-7.5],[-2.4,0,-4.4],[-3.5,0.3,-6.6]],
  [[2.9,0,-4.8],[2.6,-0.3,-8.9],[3.7,0.3,-6.7],[2.5,-0.3,-8.2],[3.6,0.3,-6.0]],
  [[0,2.5,-6.7],[-0.2,2.7,-8.7],[-0.3,5.1,-9.0],[0.2,2.8,-4.7],[0.3,5.1,-4.4]],
  [[0,-2.9,-6.7],[0.1,-3.1,-5.4],[0.2,-4.6,-5.2],[-0.1,-3.1,-7.9],[-0.2,-4.5,-8.2]],
  [[-1.1,1.5,-7.4],[-1.2,1.8,-7.4],[-1.7,3.5,-8.5],[-0.8,1.9,-4.5],[-1.2,3.5,-5.1]],
  [[-1.1,-2.1,-7.4],[-1.0,-2.0,-5.2],[-1.4,-2.9,-6.0],[-1.1,-2.0,-6.6],[-1.5,-2.9,-7.6]],
  [[-9.2,-0.6,-15.0],[-9.4,0.6,-15.0],[-9.4,-0.1,-15.0],[-9.0,0.6,-15.0],[-8.9,-0.1,-15.0]],
  [[0,-7.0,-6.7],[0.8,-9.7,-3.5],[0.9,-12.0,-3.0],[-0.8,-9.6,-9.8],[-0.9,-12.0,-10.4]],
  [[0,6.3,-6.6],[-0.9,9.1,-10.3],[-1.0,11.9,-10.9],[0.9,9.2,-3.0],[1.0,12.0,-2.3]],
  [[0,0.2,6.7],[0,0.2,7.0],[0,-0.3,7.1],[0,0.2,6.3],[0,-0.3,6.3]],
  [[-0.2,6.3,1.7],[0.8,5.5,11.2],[2.0,-10.1,15.0],[-1.7,6.0,-14.5],[-1.0,-9.5,-15.0]],
  [[-0.2,-7.4,1.7],[-1.8,-6.7,-14.5],[-1.1,8.5,-15.0],[0.9,-6.2,11.2],[2.0,9.2,15.0]],
];

// Tablo 1 rijit gövde modları [Hz] + Adams'ın kendi etiketleri, ve TR (%).
const TABLE1_MODES = [6.70, 7.87, 8.81, 8.86, 11.78, 18.96];
const TABLE1_MODE_LABELS = ['Roll', 'Pitch', 'Yaw', 'Roll+Pitch', 'Pitch', 'Roll'];
const TABLE1_TR_PCT = 11.00;

// Reddedilen Tablo 2'nin künyesi (verisi tutulmuyor — başka bir model):
// simetrik (statik Y beş sıfır), daha sert (modlar %3–9 yüksek), TR %13,18.
const TABLE2_MODES = [6.92, 7.99, 9.23, 9.66, 12.12, 20.90];
const TABLE2_TR_PCT = 13.18;

// Adams'ın koştuğu girdinin sevk edilen örnekten TEK farkı: TK040 takozlarının
// dinamik rijitliğinde X ↔ Z. Anahtar = statik üçlü (o takozu tekil belirler).
const INPUT_DELTA = {
  note: 'TK040 (57RS329001M) dinamik rijitliğinde X ↔ Z takas',
  matchKstat: [515, 260, 242],
  catalogKdyn: [740, 355, 335],    // VE_MOUNT_LIBRARY.TK040 — sevk edilen örnek
  adamsKdyn:   [335, 355, 740],    // Adams'ın taşıdığı (ölçülen kanıta göre)
};

module.exports = {
  COLUMNS, ROWS, TABLE1, TABLE1_MODES, TABLE1_MODE_LABELS, TABLE1_TR_PCT,
  TABLE2_MODES, TABLE2_TR_PCT, INPUT_DELTA,
};
