/**
 * arac-performans-presets.test.js — 3.0L Duramax LZ0 motoru + 8L90 şanzımanı
 * preset/profil verisinin doğru tanımlandığını doğrular.
 *
 * Değer başına test (test politikası): burada test edilen şey "sayısal veri
 * çekirdeği" — yanlış bir oran/nokta sessizce "makul ama yanlış" performans
 * üretir, gözle yakalanmaz. UI/etiket değil, veri bütünlüğü test edilir.
 */
const stubs = stubGlobals();
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));

describe('Motor preset — 3.0L I6 Duramax Turbo Diesel LZ0', () => {
  const p = VE_FT_MOTOR_PRESETS['duramax_lz0_305'];

  test('preset tanımlı ve isim/etiket doğru', () => {
    expect(p).toBeDefined();
    expect(p.name).toContain('Duramax');
    expect(p.name).toContain('671Nm');
    expect(p.name).toContain('227kW');
  });

  test('spec değerleri (governor / rölanti / hacim)', () => {
    expect(p.specs.displacement).toBe(2.99);
    expect(p.specs.idleRpm).toBe(700);
    expect(p.specs.governedSpeed).toBe(4000);
    expect(p.specs.noLoadGoverned).toBe(5000);
    expect(p.specs.inertia).toBeGreaterThan(0);
  });

  test('rated tork/güç noktaları eğride mevcut ve tepe değerler', () => {
    // Tepe tork = 671 Nm @ 2750 (495 lb-ft)
    const at2750 = p.data.find(d => d.rpm === 2750);
    expect(at2750.torque).toBe(671);
    expect(Math.max.apply(null, p.data.map(d => d.torque))).toBe(671);

    // Tepe güç @ 3750 = 227 kW (305 HP) — güç sütununun tepesi 3750'de
    const peakPow = p.data.reduce((a, d) => d.power > a.power ? d : a);
    expect(peakPow.rpm).toBe(3750);
    expect(peakPow.power).toBeCloseTo(227.0, 1);
  });

  test('eğri artan rpm ile sıralı ve güç = tork·rpm/9549 tutarlı', () => {
    for (let i = 1; i < p.data.length; i++) {
      expect(p.data[i].rpm).toBeGreaterThan(p.data[i - 1].rpm);
    }
    // Her (0 olmayan) satırda power ≈ torque*rpm/9549.3 (±1 kW yuvarlama toleransı)
    p.data.forEach(d => {
      if (d.torque > 0) {
        expect(d.power).toBeCloseTo(d.torque * d.rpm / 9549.3, 0);
      }
    });
  });

  test('terminal nokta {5000,0,0} (governor kesimi) ve rölanti çapası mevcut', () => {
    const last = p.data[p.data.length - 1];
    expect(last).toEqual({ rpm: 5000, torque: 0, power: 0 });
    expect(p.data[0].rpm).toBe(700);   // rölanti çapası
  });

  test('yayınlanan eğri NET → aksesuar kayıpları 0 (çift-sayım yok)', () => {
    expect(p.accessories.length).toBe(6);
    expect(p.accessories.every(a => a.userLoss === 0)).toBe(true);
  });
});

describe('Şanzıman preset — GM 8L90 8-Speed', () => {
  const g = VE_GEARBOX_PRESETS['8L90'];

  test('preset tanımlı, 8 ileri + geri, oranlar doğru', () => {
    expect(g).toBeDefined();
    const fwd = g.gears.filter(x => x.gear !== 'R');
    expect(fwd.length).toBe(8);
    expect(fwd.map(x => x.ratio)).toEqual([4.56, 2.97, 2.08, 1.69, 1.27, 1.00, 0.85, 0.65]);
    const rev = g.gears.find(x => x.gear === 'R');
    expect(rev.ratio).toBe(-3.82);
  });

  test('limit spekleri (giriş güç/tork, çıkış-tork)', () => {
    expect(g.grossInputPower).toBe(313);   // 420 HP
    expect(g.grossInputTorque).toBe(624);  // 460 lb-ft
    expect(g.netTurbineTorque).toBe(900);  // 665 lb-ft
    expect(g.calibrated).toBe(true);
  });
});

describe('Vites profili — gm8l90_perf', () => {
  test('profil tanımlı ve 8L90 preset anahtarına eşleşir', () => {
    const sp = VE_FT_SHIFT_PROFILES['gm8l90_perf'];
    expect(sp).toBeDefined();
    expect(sp.shiftRefRPM).toBe(3900);
    // 8L90 preset'i uygulanınca bu profil otomatik seçilir:
    expect(veGetGearboxKeyFromShiftProfile('gm8l90_perf')).toBe('8L90');
    // Allison profilleri hâlâ kendi anahtarlarına eşleşir (regresyon yok):
    expect(veGetGearboxKeyFromShiftProfile('allison3200sp_s1')).toBe('3200SP');
  });

  test('lockup shift katsayıları a = 1/i_gear (her vites ~3900 rpm\'de)', () => {
    const ls = VE_FT_SHIFT_PROFILES['gm8l90_perf'].lockupShifts;
    // '2L3L' → 2. vitesten çıkış, i=2.97 → a=1/2.97
    expect(ls['2L3L'].a).toBeCloseTo(1 / 2.97, 2);
    expect(ls['6L7L'].a).toBeCloseTo(1 / 1.00, 2);
    expect(ls['7L8L'].a).toBeCloseTo(1 / 0.85, 2);
  });
});
