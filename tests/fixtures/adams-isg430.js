/**
 * adams-isg430.js — "6x6 ISG 430 hp motorlu aracın Adams motor takozu analizleri" sunumunun
 * (kullanıcının dosyası, 2026-11-11) GİRDİSİ ve SONUCU, dondurulmuş. Program karşılaştırması:
 * tests/unit/mount-adams-isg.test.js.
 *
 * Slayt 3 — rölanti: 6 silindir · 700 d/dk → 35 Hz; güvenlik katsayısı 1,41 → son mod < 24,82 Hz.
 * Slayt 4 — takoz tipleri [N/mm]: statik ve dinamik x · y · z.
 * Slayt 5 — konumlar [mm], yay (k 57,4 N/mm · ön yük 918,4 N), ataletler [kg·mm²], toplam 1.560,5 kg.
 * Slayt 6–10 — beş kombinasyon: takozların statik sehimi [mm] (Front_Left … Rear_Right), altı doğal
 * frekans [Hz] (Adams "Eigen Information"), iletilebilirlik TR [%].
 */
module.exports = {
  rolanti: { devir: 700, silindir: 6, fAtes: 35, guvenlik: 1.41, sonModSinir: 24.82 },
  tip: {   // [statik x, y, z], [dinamik x, y, z]
    TK65:  [[1200, 550, 500], [2965, 1825, 960]],
    C3840: [[1200, 780, 450], [1440, 936, 540]],
    C3850: [[1450, 900, 700], [2030, 1260, 980]],
    C3940: [[1340, 1340, 720], [1608, 1608, 864]],
    C3950: [[2200, 2200, 1150], [3080, 3080, 1610]],
    C3860: [[1800, 1210, 1150], [2880, 1936, 1840]]
  },
  // Sunumun konum tablosu (Sol = −y): Sol_Ön, Sağ_Ön, Orta_Sol, Orta_Sağ, Sol_Arka, Sağ_Arka
  takoz: [[457.1, -50.8, -419.9], [457.1, 50.8, -419.9], [1637.7, -356, -150.9], [1637.7, 356, -150.9],
          [1747.7, -356, -150.9], [1747.7, 356, -150.9]],
  yay: { k: 57.4, onYuk: 918.4, ust: [[2523.3, -350, -44], [2523.3, 350, -44]], alt: [[2523.3, -350, -114], [2523.3, 350, -114]] },
  toplamKutle: 1560.5,
  // Kombinasyon: ön tip, orta + arka tip; sehim sırası Adams'ın: FL, FR, ML, MR, RL, RR
  kombinasyon: {
    TK65:       { on: 'TK65',  arka: 'TK65',  d: [-3.597, -3.704, -4.987, -5.744, -5.147, -5.903], f: [8.45133, 9.10972, 10.7383, 12.2257, 17.3167, 25.6524], TR: 8.5 },
    C3940:      { on: 'C3940', arka: 'C3940', d: [-2.396, -2.473, -3.570, -4.104, -3.702, -4.236], f: [7.83344, 8.30593, 10.0411, 11.3432, 12.8643, 23.7754], TR: 7.6 },
    C3850:      { on: 'C3850', arka: 'C3850', d: [-2.478, -2.557, -3.661, -4.210, -3.795, -4.344], f: [8.27505, 8.74312, 10.1652, 10.7319, 14.4079, 22.3495], TR: 8.6 },
    F3840R3940: { on: 'C3840', arka: 'C3940', d: [-3.675, -3.752, -3.706, -4.244, -3.730, -4.269], f: [7.4769, 7.79494, 8.74347, 11.2813, 12.5159, 19.836], TR: 6.6 },
    F3840R3850: { on: 'C3840', arka: 'C3850', d: [-3.695, -3.774, -3.796, -4.348, -3.828, -4.380], f: [7.68319, 8.23316, 9.15575, 10.1178, 13.5273, 20.4288], TR: 7.3 }
  }
};
