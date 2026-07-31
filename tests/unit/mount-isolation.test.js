/**
 * İzolasyon tabanı — düşey (bounce) doğal frekansı
 * ────────────────────────────────────────────────
 * transmissibility() TEK serbestlik dereceli bir bağıntıdır: f_nat, tahrik
 * yönündeki kütle-yay sisteminin doğal frekansı olmalıdır. Motor takozunda
 * tahrik düşeydir → taban f_bounce = (1/2π)·√(Σk_z,din / m).
 *
 * DÜZELTİLEN HATA: taban olarak MODAL frekans (en yüksek mod = roll)
 * kullanılıyordu. Roll modunun frekansını, tüm kütleyi taşıyan bir düşey yayın
 * frekansıymış gibi işlemek fiziksel olarak yanlıştır; ASFAT 8x8 Obüs modelinde
 * izolasyonu %67 gösteriyordu — gerçek değer %21,9.
 *
 * ALTIN REFERANS: ASR-SR-116 s.12 — "El Hesabı 0,220 sönümlü / 0,219 sönümsüz",
 * "Adams 0,219 / 0,218" ve §5'te %50 yumuşatma sonrası "%9,9".
 */

const core = require('../../js/mount-core.js');
global.veMountCore = core;

const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn() });
const rep = require('../../js/cp-mount-report.js');

// ── ASFAT 8x8 Obüs: 6 takoz (Tablo 9 dinamik z) + toplam kütle 2455 kg ──
const kN = (v) => v * 1000;
const MOUNTS = [
  { name: 'Ön Sol',   kdyn: [1045, 1045, 1800].map(kN) },
  { name: 'Ön Sağ',   kdyn: [1045, 1045, 1800].map(kN) },
  { name: 'Sol Ön',   kdyn: [630, 630, 3000].map(kN) },
  { name: 'Sağ Ön',   kdyn: [630, 630, 3000].map(kN) },
  { name: 'Sol Arka', kdyn: [630, 630, 3000].map(kN) },
  { name: 'Sağ Arka', kdyn: [630, 630, 3000].map(kN) },
];
const M_TOT = 2455;
const F_FIRE = (600 / 60) * (6 / 2);      // 30 Hz — §4

describe('Çekirdek — bounceFrequency', () => {
  test('ASR-SR-116 modelinde 12,69 Hz (Σk_z,din = 15600 N/mm)', () => {
    expect(core.bounceFrequency(MOUNTS, M_TOT)).toBeCloseTo(12.687, 2);
  });

  test('tanım gereği f ∝ √(k/m)', () => {
    const f0 = core.bounceFrequency(MOUNTS, M_TOT);
    const soft = MOUNTS.map((m) => ({ kdyn: m.kdyn.map((v) => v / 2) }));
    expect(core.bounceFrequency(soft, M_TOT)).toBeCloseTo(f0 / Math.SQRT2, 6);
    expect(core.bounceFrequency(MOUNTS, M_TOT * 4)).toBeCloseTo(f0 / 2, 6);
  });

  test('geçersiz girdide NaN (sayı uydurulmaz)', () => {
    expect(Number.isNaN(core.bounceFrequency(MOUNTS, 0))).toBe(true);
    expect(Number.isNaN(core.bounceFrequency([], M_TOT))).toBe(true);
    expect(Number.isNaN(core.bounceFrequency(null, M_TOT))).toBe(true);
    expect(Number.isNaN(core.bounceFrequency([{ kdyn: [1, 1, 0] }], M_TOT))).toBe(true);
  });
});

describe('ASR-SR-116 s.12 el hesabı yeniden üretiliyor', () => {
  const fB = core.bounceFrequency(MOUNTS, M_TOT);

  test('sönümlü T = %21,9 (rapor: El Hesabı 0,220 · Adams 0,219)', () => {
    expect(core.transmissibility(F_FIRE, fB, 0.02)).toBeCloseTo(0.219, 3);
  });

  test('sönümsüz T = %21,8 (rapor: El Hesabı 0,219 · Adams 0,218)', () => {
    expect(core.transmissibility(F_FIRE, fB, 0)).toBeCloseTo(0.218, 3);
  });

  test('%50 yumuşatma sonrası T = %9,9 (rapor §5)', () => {
    const soft = MOUNTS.map((m) => ({ kdyn: m.kdyn.map((v) => v / 2) }));
    const T = core.transmissibility(F_FIRE, core.bounceFrequency(soft, M_TOT), 0.02);
    expect(T * 100).toBeCloseTo(9.9, 1);
  });

  test('ESKİ taban (en yüksek mod, 19,01 Hz) rapordan çok uzak — regresyon kilidi', () => {
    const eski = core.transmissibility(F_FIRE, 19.0048, 0.02);
    expect(eski).toBeGreaterThan(0.6);                     // ~%67
    expect(Math.abs(eski - 0.219)).toBeGreaterThan(0.4);   // taban geri dönerse kırılır
  });
});

describe('Rapor — tek hesap noktası (_mntRepIsolation)', () => {
  const R = {
    zeta: 0.02, mp: { m: M_TOT }, mounts: MOUNTS,
    gather: { torque: { idleRpm: 600, cylinders: 6 }, components: [] },
    modes: [5.92, 6.60, 7.31, 11.33, 13.27, 18.87].map((f) => ({ f_Hz: f, phi: [1, 0, 0, 0, 0, 0], label: 'x' })),
  };

  test('f_bounce tabanlı T üretir; modal frekansı KULLANMAZ', () => {
    const iso = rep._mntRepIsolation(R, {});
    expect(iso.fFire).toBeCloseTo(30, 6);
    expect(iso.fBounce).toBeCloseTo(12.687, 2);
    expect(iso.T).toBeCloseTo(0.219, 3);
    expect(iso.T0).toBeCloseTo(0.218, 3);
    expect(iso.r).toBeCloseTo(30 / 12.687, 3);
  });

  test('f_bounce modal bandın İÇİNDE (bounce, pitch ile kuplajlı iki mod arası)', () => {
    const iso = rep._mntRepIsolation(R, {});
    expect(iso.fBounce).toBeGreaterThan(11.33);
    expect(iso.fBounce).toBeLessThan(13.27);
  });

  test('§8.8 ile uygunluk tablosu AYNI sayıyı basıyor', () => {
    const s8 = rep._mntRepFreqPlacement(R, {});
    const uy = rep._mntRepCompliance(R, {});
    expect(s8).toContain('21,9');
    expect(uy).toContain('21,9');
    expect(uy).toContain('f_bounce');
    // eski taban metni gitmeli
    expect(uy).not.toContain('en yüksek mod');
  });

  test('§8.8 düşey taban formülünü ve modal bandı gösteriyor', () => {
    const s8 = rep._mntRepFreqPlacement(R, {});
    expect(s8).toContain('f_{\\text{bounce}}');
    expect(s8).toContain('12,69');
    expect(s8).toContain('5,92');       // modal bant alt ucu
  });

  test('girdi eksikse NaN döner, bölüm atlanır', () => {
    const noEng = Object.assign({}, R, { gather: { torque: {}, components: [] } });
    expect(Number.isNaN(rep._mntRepIsolation(noEng, {}).T)).toBe(true);
    expect(rep._mntRepFreqPlacement(noEng, {})).toBe('');
    const noMass = Object.assign({}, R, { mp: { m: 0 } });
    expect(Number.isNaN(rep._mntRepIsolation(noMass, {}).fBounce)).toBe(true);
  });

  test('ζ Çözücü\'den gelir ve sonucu etkiler', () => {
    const z0 = rep._mntRepIsolation(Object.assign({}, R, { zeta: 0 }), {});
    const z2 = rep._mntRepIsolation(R, {});
    expect(z0.zeta).toBe(0);
    expect(z0.T).toBeCloseTo(z0.T0, 9);      // ζ=0 → sönümlü = sönümsüz
    expect(z2.T).toBeGreaterThan(z0.T);      // sönüm izolasyon bölgesinde T'yi az da olsa artırır
  });

  test('ζ=0 KASITLI seçimdir, "girilmemiş" sayılmaz (sönüm tablosuyla tutarlı)', () => {
    // Regresyon: rapor 0'ı geçersiz sayıp varsayılana düşerse, sönüm tablosu
    // ζ=0 (tüm c=0) gösterirken iletilebilirlik ζ=0,02 ile hesaplanırdı.
    expect(rep._mntRepZeta({ zeta: 0 }, {})).toBe(0);
    expect(rep._mntRepZeta({ zeta: 0 }, { zeta: 0.05 })).toBe(0);
    // gerçekten girilmemişse varsayılana düşer
    expect(rep._mntRepZeta({}, {})).toBe(core.DEFAULT_ZETA);
    // aralık dışı reddedilir
    expect(rep._mntRepZeta({ zeta: 1.5 }, {})).toBe(core.DEFAULT_ZETA);
  });
});
