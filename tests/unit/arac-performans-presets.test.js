/**
 * arac-performans-presets.test.js — 3.0L Duramax LZ0 motoru + 8L90 şanzımanı
 * preset/profil verisinin doğru tanımlandığını doğrular.
 *
 * Değer başına test (test politikası): burada test edilen şey "sayısal veri
 * çekirdeği" — yanlış bir oran/nokta sessizce "makul ama yanlış" performans
 * üretir, gözle yakalanmaz. UI/etiket değil, veri bütünlüğü test edilir.
 */
const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};
eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('ft-performance.js'));   // FT_SOLVER.createMotorTorqueFn (net eğri doğrulaması)

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

describe('Motor preset — 6.6L V8 Duramax Turbo Diesel L5P', () => {
  const p = VE_FT_MOTOR_PRESETS['duramax_l5p_470'];

  test('preset tanımlı ve isim/etiket doğru', () => {
    expect(p).toBeDefined();
    expect(p.name).toContain('L5P');
    expect(p.name).toContain('1322Nm');
    expect(p.name).toContain('350kW');
  });

  test('spec: max powered speed = governedSpeed 3450', () => {
    expect(p.specs.displacement).toBe(6.60);
    expect(p.specs.idleRpm).toBe(700);
    expect(p.specs.governedSpeed).toBe(3450);   // "Maximum Powered Speed"
    expect(p.specs.noLoadGoverned).toBe(3600);
  });

  test('rated tork/güç noktaları (tepe tork@1600, tepe güç@2800)', () => {
    const at1600 = p.data.find(d => d.rpm === 1600);
    expect(at1600.torque).toBe(1322);           // 975 lb-ft tepe tork
    expect(Math.max.apply(null, p.data.map(d => d.torque))).toBe(1322);
    const peakPow = p.data.reduce((a, d) => d.power > a.power ? d : a);
    expect(peakPow.rpm).toBe(2800);             // 470 HP @ 2800
    expect(peakPow.power).toBeCloseTo(350.2, 1);
  });

  test('eğri sıralı + güç tutarlı, terminal {3600,0,0}, rölanti çapası', () => {
    for (let i = 1; i < p.data.length; i++) expect(p.data[i].rpm).toBeGreaterThan(p.data[i - 1].rpm);
    p.data.forEach(d => { if (d.torque > 0) expect(d.power).toBeCloseTo(d.torque * d.rpm / 9549.3, 0); });
    expect(p.data[p.data.length - 1]).toEqual({ rpm: 3600, torque: 0, power: 0 });
    expect(p.data[0].rpm).toBe(700);
    expect(p.accessories.every(a => a.userLoss === 0)).toBe(true);
  });
});

describe('Motor preset — 6.6L V8 Duramax L5D (BRÜT eğri + aksesuar → GM Net Fan On)', () => {
  const p = VE_FT_MOTOR_PRESETS['duramax_l5d_470'];

  test('preset tanımlı ve isim/etiket doğru', () => {
    expect(p).toBeDefined();
    expect(p.name).toContain('L5D');
    expect(p.name).toContain('1332Nm');
    expect(p.name).toContain('350kW');
  });

  test('spec: governedSpeed 3000 (rated), no-load 3600, atalet 0.5792', () => {
    expect(p.specs.displacement).toBe(6.60);
    expect(p.specs.idleRpm).toBe(700);
    expect(p.specs.governedSpeed).toBe(3000);    // "Governed Speed" (rated)
    expect(p.specs.noLoadGoverned).toBe(3600);   // "No Load Governed"
    expect(p.specs.inertia).toBeCloseTo(0.5792, 4);
  });

  test('BRÜT tepe: tork 1332@1600, güç 350.1 kW@2800 (spek başlığı)', () => {
    const at1600 = p.data.find(d => d.rpm === 1600);
    expect(at1600.torque).toBe(1332);            // brüt tepe tork (spek başlığı)
    expect(Math.max.apply(null, p.data.map(d => d.torque))).toBe(1332);
    const peakPow = p.data.reduce((a, d) => d.power > a.power ? d : a);
    expect(peakPow.rpm).toBe(2800);
    expect(peakPow.power).toBeCloseTo(350.1, 1);
  });

  test('eğri sıralı + güç tutarlı, terminal {3600,0,0}, rölanti çapası', () => {
    for (let i = 1; i < p.data.length; i++) expect(p.data[i].rpm).toBeGreaterThan(p.data[i - 1].rpm);
    p.data.forEach(d => { if (d.torque > 0) expect(d.power).toBeCloseTo(d.torque * d.rpm / 9549.3, 0); });
    expect(p.data[p.data.length - 1]).toEqual({ rpm: 3600, torque: 0, power: 0 });
    expect(p.data[0].rpm).toBe(700);
  });

  test('aksesuar dökümü — Fan 34.5 kW (kavramalı/N³) + diğerleri 7.2 kW', () => {
    // L5D, LZ0/L5P'den FARKLI tasarım: yayınlanan eğri BRÜT, net sürüş torku
    // aksesuar kayıplarıyla türetilir. Bu değerler net eğrinin "değer başına"
    // korumasıdır — 0'a çekilse gösterilen brüt aynı kalır ama net ~40 Nm sapar.
    expect(p.accessories.length).toBe(6);
    let fan = 0, other = 0;
    p.accessories.forEach(a => {
      const l = a.userLoss || 0;
      if (/fan/i.test(a.name)) fan += l; else other += l;
    });
    expect(fan).toBeCloseTo(34.5, 2);            // kavramalı fan @governed
    expect(other).toBeCloseTo(7.2, 2);           // alternatör+kompresör+direksiyon+klima+ek
  });

  test('BRÜT − aksesuar (Fan N³ + diğer lineer) = GM "Net Fan On" (çalışma bandı)', () => {
    // Preset'in merkezî iddiası: gross+aksesuar, üreticinin "Net Fan On" sütununu
    // yeniden üretir. Solver'ın net formülü (ft-performance.js:414-430) ile birebir.
    const gov = p.specs.governedSpeed, nlg = p.specs.noLoadGoverned;
    const grossFn = FT_SOLVER.createMotorTorqueFn(p.data, gov, nlg);
    let fan = 0, other = 0;
    p.accessories.forEach(a => { const l = a.userLoss || 0; if (/fan/i.test(a.name)) fan += l; else other += l; });
    const net = (rpm) => {
      const ratio = rpm / gov;
      const Ploss = fan * ratio * ratio * ratio + other * ratio;   // fan N³ + diğer lineer
      const omega = 2 * Math.PI * rpm / 60;
      return Math.max(0, grossFn(rpm) - Ploss * 1000 / omega);
    };
    // GM "Net Fan On" (üretici tablosu) — çalışma bandında (rated'e kadar) eşleşir.
    // Bant toleransı ±12 Nm: eğri dijitalleştirme + GM tablosunun kendi brüt/net
    // yuvarlama tutarsızlığı (@1600 ~10 Nm). Güç-tepe bandında ~0'a iner.
    const gm = { 1600: 1268.2, 2000: 1237.8, 2400: 1172.1, 2800: 1074.7, 3000: 952.4 };
    Object.keys(gm).forEach(r => {
      r = +r;
      expect(Math.abs(net(r) - gm[r])).toBeLessThan(12);
    });
    // Güç-tepe / rated bandında (2800-3000) neredeyse birebir (±3 Nm).
    expect(Math.abs(net(2800) - 1074.7)).toBeLessThan(3);
    expect(Math.abs(net(3000) - 952.4)).toBeLessThan(3);
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
    // shiftRefRPM null → çözücü motorun governedSpeed'ini kullanır (her motora uyarlanır).
    // Sabit bir devir olsaydı düşük-devirli motor (L5P maks 3450) o devre ulaşamaz →
    // şanzıman 1. viteste takılırdı.
    expect(sp.shiftRefRPM).toBeNull();
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
