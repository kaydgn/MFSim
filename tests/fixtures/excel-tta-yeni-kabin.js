/* =========================================================================
 * excel-tta-yeni-kabin.js — 10 Ton TTA, 6x6 YENİ KABİN: takoz konumları föyü
 * (kullanıcı 2026-11-09, Canlı Not 68), DONDURULMUŞ
 * =========================================================================
 * Dosya: "6X6_YENI_KABIN_-_ISM_TAKOZ_KONUMLARI-SANZIMAN_ASKISIZ.xlsx", sayfa
 * "6X6 YENI KABIN-ISM_SANZ ASKISIZ" (B1: "6x6 YENI KABIN - ISM 380HP MOTOR -
 * 4500SP SANZIMAN - ŞANZIMAN ASKISIZ"). Hücreler birebir; birim mm · kg.
 * Koordinatlar ilk kitabın (excel-tta-askisiz.js, AĞIRLIK_KIRILIMI) sistemi:
 * motor ve şanzıman grubunun ağırlık merkezi o kitabın sonucuyla aynı.
 * Örnek assets/examples/tta10_topoloji.json'un takozları ve rölantisi bu
 * föyden; kapı tests/unit/mount-ornek-tta.test.js → YENİ KABİN.
 */
'use strict';

module.exports = {
  baslik: '6x6 YENI KABIN - ISM 380HP MOTOR - 4500SP SANZIMAN - ŞANZIMAN ASKISIZ',
  // MOUNTING LOCATION — B4:E9 [ad, X, Y, Z]
  takoz: [
    ['Mount 1', -636.668, -48.971, 293.531],
    ['Mount 2', -636.471, 52.629, 293.531],
    ['Mount 3', 532, -365, 535],
    ['Mount 4', 1637.67, 365, 535],
    ['Mount 5', 642, -365, 535],
    ['Mount 6', 1747.67, 365, 535]
  ],
  // C11 · C12 — "(Accessories Included)"
  agirlik: { motor: 1210, sanziman: 530 },
  silindir: 'I6-90°',                                      // C13
  // ENGINE — C16:E19: azami güç 283 kW · 1431 Nm @ 1900; tepe tork 1835 Nm · 230 kW @ 1200;
  // E16 "Idle Speed 800 rpm"
  motor: { Pmax: 283, PmaxRpm: 1900, TePmax: 1431, TeMax: 1835, TeRpm: 1200, PTeMax: 230, rolanti: 800 },
  // TRANMISSION — C22:C29 (D29: "(TC-541)")
  vites: [4.7, 2.21, 1.53, 1, 0.76, 0.67], geri: -5.55, stall: 1.9, konvertor: 'TC-541',
  // TRANSFER CASE — C32 · C33
  transfer: { dusuk: 0.874, yuksek: 1.536 },
  // CENTER OF GRAVITY (REF.MOUNT 1) — C37:E38
  cg: { motor: [-102.47, 2.69, 676.33], sanziman: [1024.69, -19.68, 445.88] },
  // INERTIA — C42:E43 (metin hücreleri: "80,9 kg-m2" …)
  atalet: { motor: [80.9, 164.9, 122.6], sanziman: [12.08, 33.65, 31.5] }
};
