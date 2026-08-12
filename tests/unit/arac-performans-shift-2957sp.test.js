/**
 * arac-performans-shift-2957sp.test.js
 * ────────────────────────────────────
 * Allison 2957 SP Wide — DynActive (Index 0) vites geçiş profili.
 *
 * KAYNAK: iSCAAN 497-A336126-1 (BMC YPA 4×4 · Cummins ISB4.5 210HP · TC221 ·
 * aks 1.706 · transfer 3.430 · "2400 rpm Variable" stratejisi).
 *
 * Profil eklenmeden ÖNCE bu şanzımanın kaydı yoktu; çözücü 'allison3200sp_s1'
 * fallback'ine düşüyor, ilk BEŞ geçiş eşiği tutturamadığı için governed-emniyet
 * yoluyla 2501 rpm'de (eşik = "—") tetikleniyordu. Ölçüm: 0-20 1.61 s → 1.54 s,
 * 0-80 20.27 s → 20.17 s (iSCAAN 1.5 / 20.0).
 *
 * MODELİN ÇEKİRDEĞİ: rapordaki dokuz geçişin HEPSİ N_motor = 2400 rpm'de olur —
 * motor governed'ı (2500) DEĞİL. Yani her lockup katsayısı basitçe o vitesin
 * oranının tersidir: a = 1/i, çünkü N_out(geçiş) = 2400 / i.
 */
const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};

eval(loadSource('cp-gearbox.js'));
beforeEach(() => resetStubs(stubs));

const KEY = 'allison2957sp_dyn0';
const P = VE_FT_SHIFT_PROFILES[KEY];
const GEARS = VE_GEARBOX_PRESETS['2957SP_WIDE'].gears.filter(g => g.gear !== 'R');

// iSCAAN raporundaki geçiş noktaları: [etiket, gear index, N_out (rpm)]
const RAPOR = [
  ['1L→2L', 0, 498.2], ['2L→3L', 1, 683.2], ['3L→4L', 2, 843.3],
  ['4L→5L', 3, 1266.8], ['5L→6L', 4, 1668.8], ['6L→7L', 5, 2398.3],
  ['7L→8L', 6, 3259.4], ['8L→9L', 7, 3732.7]
];
const LOCKUP_KEYS = ['1L2L', '2L3L', '3L4L', '4L5L', '5L6L', '6L7L', '7L8L', '8L9L'];

describe('profil kaydı', () => {
  test('kayıtlı ve 2957SP_WIDE presetine açıkça bağlı', () => {
    expect(P).toBeTruthy();
    // Ad kalıbı '2957SP' verir — preset anahtarı '2957SP_WIDE'. Açık bağ olmazsa
    // şanzıman panelinde profil hiç listelenmez ve dişli verimi çözülemez.
    expect(veGetGearboxKeyFromShiftProfile(KEY)).toBe('2957SP_WIDE');
    expect(VE_GEARBOX_PRESETS['2957SP_WIDE']).toBeTruthy();
  });

  test('shiftRefRPM motor governed’ı değil, strateji referansı (2400)', () => {
    // Rapor "2400 rpm Variable" diyor; governed 2500. İkisini karıştırmak
    // bütün eşikleri %4 kaydırır.
    expect(P.shiftRefRPM).toBe(2400);
  });

  test('dokuz ileri vites için sekiz lockup geçişi tanımlı', () => {
    expect(GEARS.length).toBe(9);
    LOCKUP_KEYS.forEach(k => expect(P.lockupShifts[k]).toBeTruthy());
  });
});

describe('geçiş eşikleri iSCAAN raporuyla örtüşüyor', () => {
  test.each(RAPOR.map((r, i) => [r[0], LOCKUP_KEYS[i], r[1], r[2]]))(
    '%s — eşik rapordaki N_out’a ±3 rpm', (_ad, key, gearIdx, nOutRapor) => {
      const s = P.lockupShifts[key];
      expect(s.b).toBe(0);                       // saf oran modeli, ofset yok
      const esik = s.a * P.shiftRefRPM;
      expect(Math.abs(esik - nOutRapor)).toBeLessThan(3);
    });

  test('her katsayı o vitesin oranının tersi (a = 1/i, ±%0.5)', () => {
    // Modelin fiziği: geçiş N_motor sabit → N_out = N_ref / i.
    const sapma = [];
    LOCKUP_KEYS.forEach((k, i) => {
      const beklenen = 1 / GEARS[i].ratio;
      const oran = P.lockupShifts[k].a / beklenen;
      if(Math.abs(oran - 1) > 0.005) sapma.push(`${k}: ${oran.toFixed(4)}`);
    });
    expect(sapma).toEqual([]);
  });

  test('bütün geçişlerde türbin devri 2400’e oturuyor (strateji sabiti)', () => {
    LOCKUP_KEYS.forEach((k, i) => {
      const nTurb = P.lockupShifts[k].a * P.shiftRefRPM * GEARS[i].ratio;
      expect(nTurb).toBeGreaterThan(2385);
      expect(nTurb).toBeLessThan(2415);
    });
  });

  test('eşikler kesin artan — vites avlanmasına karşı', () => {
    const esik = LOCKUP_KEYS.map(k => P.lockupShifts[k].a * P.shiftRefRPM);
    for(let i = 1; i < esik.length; i++) expect(esik[i]).toBeGreaterThan(esik[i - 1]);
    // Converter-mod eşikleri de sıralı ve ilk lockup geçişinin altında
    expect(P.shift2C2L_outRatio).toBeGreaterThan(P.shift1C2C_outRatio);
  });
});
