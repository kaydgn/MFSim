/**
 * 10 Ton TTA — torkun ve bağlantı yüzü sınırının belgeleri (DONDURULMUŞ)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcının 2026-11-09'da verdiği belgelerden, sayfadaki değerler birebir:
 *
 *   FR20317 — Cummins Engine Performance Curve, ISME385 30 (CPL 43534,
 *     13-Jan-2012): 283 kW (380 HP) @ 1900 RPM · 1835 N-m (1354 lb-ft) @ 1200 RPM;
 *     6 silindir; asgari / azami rölanti 600 / 800 RPM.
 *   iSCAAN 497-A392175-1 — Allison Transmission Bundled Report,
 *     6X6_TTA_385_TC541_0.874_1.536_8.472_33600kg (16-JUL-2026): Engine Idle
 *     Speed 700 rpm; TC541; Converter Stall Torque Ratio 1.897; stall noktası
 *     motor 1560 rpm · net 1571.8 N-m · türbin 2920.5 N-m; vites oranları ve
 *     stall'da şanzıman çıkış torku (Converter Mode, Speed Ratio 0.000).
 *   D353029BX03 — Cummins ISM11 Engine Performance Data (22-Aug-2025):
 *     "Maximum static mounting surface bending moment at rear face of block"
 *     996 lb-ft · 1350 N-m; Number of Cylinders: 6.
 *
 * Örnek (MOUNT_EXAMPLES.tta10 · assets/examples/tta10_topoloji.json) bu
 * değerlerle kuruldu; kapı tests/unit/mount-ornek-tta.test.js → TORK.
 */
'use strict';

module.exports = {
  fr20317: { TeMax: 1835, TeRpm: 1200, Pmax: 283, PmaxRpm: 1900, silindir: 6, rolantiMin: 600, rolantiMax: 800 },
  iscaan: {
    rolanti: 700,
    stall: { rpm: 1560, Te: 1571.8, TR: 1.897, Tturbin: 2920.5 },
    // [vites, oran, stall'da şanzıman çıkış torku N·m]
    vites: [['F1', 4.695, 13551.3], ['F2', 2.213, 6401.7], ['F3', 1.529, 4434.6], ['F4', 1.000, 2920.5],
            ['F5', 0.765, 2215.9], ['F6', 0.672, 1943.9], ['R1', 5.552, 15634.1]],
    tepe: { Te: 1835.0, rpm: 1200 }
  },
  ism11: { rfobMb: 1350, rfobMbLbft: 996, silindir: 6 }
};
