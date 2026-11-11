/* =========================================================================
 * adams-isg-askili.js — 6×6 ISG 430 hp, ŞANZIMAN ASKILI: Adams motor takozu
 * analizi (VeD, H. M. Ertop), DONDURULMUŞ
 * =========================================================================
 * Kaynak: kullanıcının sunumu "6x6__sg_powertrain_mount_simulation.pptx"
 * (2026-11-11). Girdiler slayt 4–5'in tablolarında; sonuçlar slayt 6–10'un
 * görsellerinde: statik çökme (Adams grafikleri, piksel ölçümüyle ±0,003 mm)
 * ve Adams'ın özdeğer tablosu (birebir). Koordinatlar Adams'ın sisteminde
 * (10 Ton TTA föyünden x'te 1.105,67 mm ileride; motor ISG, föy ISM).
 *
 * Bilinmeyenler: bileşen kütleleri (yalnız toplam 1.560,5 kg verilmiş). Kapı
 * (tests/unit/mount-aski.test.js → ADAMS) kütleleri sabit tutar; değerler 60
 * sonucun (30 çökme + 30 frekans) en küçük kareler uydurmasından:
 *   • statik çökmede statik, frekansta dinamik rijitlik (öteki eşlemelerde
 *     frekans farkı %0,9–17);
 *   • Adams çıktısının sol/sağ adları girdi tablosunun y işaretiyle ters;
 *   • yayın etkin ön yükü ~0 N — sunumdaki 918,4 N ile fark çökmede 0,525 mm,
 *     frekansta %3,3'e çıkar (toplam kütle serbest bırakılsa da 0,32 mm, %4,2).
 */
'use strict';

module.exports = {
  // slayt 4 — takoz tipleri [statik x, y, z], [dinamik x, y, z] N/mm
  tip: {
    TK65:  { s: [1200, 550, 500],   d: [2965, 1825, 960] },
    C3840: { s: [1200, 780, 450],   d: [1440, 936, 540] },
    C3850: { s: [1450, 900, 700],   d: [2030, 1260, 980] },
    C3940: { s: [1340, 1340, 720],  d: [1608, 1608, 864] },
    C3950: { s: [2200, 2200, 1150], d: [3080, 3080, 1610] },
    C3860: { s: [1800, 1210, 1150], d: [2880, 1936, 1840] }
  },
  // slayt 5 — konumlar (mm). Sıra Adams'ın çıktısıyla aynı: ön sol · ön sağ · orta sol · orta sağ · arka sol · arka sağ.
  // Çıktının "sol"u bu tablonun +y'sinde (ters eşleme; başlıktaki not).
  takoz: [
    ['Sol_Ön_Takoz', 457.1, -50.8, -419.9], ['Sağ_Ön_Takoz', 457.1, 50.8, -419.9],
    ['Orta_Sol_Takoz', 1637.7, -356, -150.9], ['Orta_Sağ_Takoz', 1637.7, 356, -150.9],
    ['Sol_Arka_Takoz', 1747.7, -356, -150.9], ['Sağ_Arka_Takoz', 1747.7, 356, -150.9]
  ],
  yay: {
    ust: [[2523.3, -350, -44], [2523.3, 350, -44]],      // braket tarafı
    alt: [[2523.3, -350, -114], [2523.3, 350, -114]],    // şasi tarafı → tasarım boyu 70 mm
    k: 57.4, onYuk: 918.4                                  // N/mm · N (sunumda)
  },
  govde: {   // CG mm; atalet kg·mm² (slayt 5); kütle: uydurma (başlıktaki not)
    Motor:    { cg: [1042.3, -11.6, -43],     I: [4.75e7, 1.33e8, 1.14e8], kutle: 1002.0 },
    Sanziman: { cg: [2154.4, -42.9, -302.4],  I: [1.21e7, 3.37e7, 3.15e7], kutle: 524.3 },
    Braket:   { cg: [2516.3, 4.5, 29],        I: [4.11e5, 2.40e4, 4.17e5], kutle: 8.1 },
    Shaft:    { cg: [2699.6, 0, -219.55],     I: null,                     kutle: 26.1 }
  },
  toplamKutle: 1560.5,
  rolanti: { silindir: 6, rpm: 700, hedefSonMod: 24.82 },     // slayt 3
  // slayt 6–10: [ön takoz tipi, orta + arka takoz tipi], statik çökme z (mm; ön sol … arka sağ), frekans (Hz), TR
  sonuc: {
    TK65:       { on: 'TK65', arka: 'TK65', d: [-3.597, -3.704, -4.987, -5.744, -5.147, -5.903],
                  f: [8.45133, 9.10972, 10.7383, 12.2257, 17.3167, 25.6524], tr: 8.5 },
    C3940:      { on: 'C3940', arka: 'C3940', d: [-2.396, -2.473, -3.570, -4.104, -3.702, -4.236],
                  f: [7.83344, 8.30593, 10.0411, 11.3432, 12.8643, 23.7754], tr: 7.6 },
    C3850:      { on: 'C3850', arka: 'C3850', d: [-2.478, -2.557, -3.661, -4.210, -3.795, -4.344],
                  f: [8.27505, 8.74312, 10.1652, 10.7319, 14.4079, 22.3495], tr: 8.6 },
    F3840R3940: { on: 'C3840', arka: 'C3940', d: [-3.675, -3.752, -3.706, -4.244, -3.730, -4.269],
                  f: [7.4769, 7.79494, 8.74347, 11.2813, 12.5159, 19.836], tr: 6.6 },
    F3840R3850: { on: 'C3840', arka: 'C3850', d: [-3.695, -3.774, -3.796, -4.348, -3.828, -4.380],
                  f: [7.68319, 8.23316, 9.15575, 10.1178, 13.5273, 20.4288], tr: 7.3 }
  }
};
