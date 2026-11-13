/* =========================================================================
 * excel-tta-askili.js — 10 Ton TTA, 6x6 YENİ KABİN, ŞANZIMAN ASKILI: takoz ve
 * yay konumları föyü + Cummins'in "Engine Mounting – Reaction and Moments Tool"
 * askılı girdisi (kullanıcı 2026-11-11), DONDURULMUŞ
 * =========================================================================
 * Föy: "6X6_YENI_KABIN_-_ISM_TAKOZ_KONUMLARI-SANZIMAN_ASKILI.xlsx" (sayfanın adı
 * askısız föyden kalma: "6X6 YENI KABIN-ISM_SANZ ASKISIZ"; B1 "… ŞANZIMAN
 * ASKILI"). Hücreler birebir; birim mm · kg. Askısız föyden farkı: arka
 * takozların Y'si ±335 (askısızda ±365) ve iki yay (Spring-1 · 2) ile yayların
 * ortak destek noktası. Mount 4 · 6'nın X'i yine Adams'ın koordinat sisteminde
 * (sol eşlerinden 1.105,67 mm geride; Adams modelinde orta ve arka takozlar tam
 * bu X'lerde — tests/fixtures/adams-isg-askili.js).
 * Cummins aracı: kullanıcının ekran görüntüsü (AEB 21.36 çalışma sayfası);
 * girdiler ve aracın hücrede tuttuğu sonuçlar.
 * Kapı: tests/unit/mount-aski.test.js → *TTA ASKILI* · *CUMMINS*.
 */
'use strict';

module.exports = {
  baslik: '6x6 YENI KABIN - ISM 380HP MOTOR - 4500SP SANZIMAN - ŞANZIMAN ASKILI',
  // MOUNTING LOCATION — B4:E12 [ad, X, Y, Z], F10:F12 yük notu
  takoz: [
    ['Mount 1', -636.668, -48.971, 293.531],
    ['Mount 2', -636.471, 52.629, 293.531],
    ['Mount 3', 532, -335, 535],
    ['Mount 4', 1637.67, 335, 535],
    ['Mount 5', 642, -335, 535],
    ['Mount 6', 1747.67, 335, 535]
  ],
  yay: [
    ['Spring-1', 1365, -350, 672.503, '50kg'],
    ['Spring-2', 1365, 350, 672.501, '50kg']
  ],
  destek: ['Spring Support Point', 1372.697, -2.117, 750.502, '100kg (merkez)'],
  agirlik: { motor: 1210, sanziman: 530 },                  // C14 · C15
  // CENTER OF GRAVITY (REF.MOUNT 1) — C40:E41; INERTIA — C45:E46 (metin hücreleri)
  cg: { motor: [-102.47, 2.69, 676.33], sanziman: [1024.69, -19.68, 445.88] },
  atalet: { motor: [80.9, 164.9, 122.6], sanziman: [12.08, 33.65, 31.5] },
  // Cummins aracı (askılı): B9:B16 · H9:H11 girdi; B18 · B21 · B24 · B27 · B30 · B33 sonuç
  cummins: {
    girdi: { L1: 531, L2: 1066, L3: 563, L4: 84, L5: 942, L6: 119, L7: 48, L8: 79, We: 1210, Wt: 530, R3: 100 },
    sonuc: { R2: 1093.4, R2yari: 546.7, R1: 546.6, Mr: 587, Mf: 638, Mfwy: -257, Mfwx: -424 },
    oneri: { R3: 100, L4sifir: 262.37, L4dene: 236.1 },      // L19 · L22 · L24
    kgfMmNm: 0.009806
  }
};
