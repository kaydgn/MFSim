/**
 * AMC MECANOCAUCHO® konik takozlar — kaynağa karşı altın referans
 * ───────────────────────────────────────────────────────────────
 * Kütüphanede bu takozların İKİ AYRI VERİ TABANI var; test ikisini de kilitler:
 *
 *   (A) NOMİNAL KATALOG ('amcNNNNNN')  — üreticinin ürün verisi (AMC karşılaştırma
 *       aracı dökümü + Cone 67 için AMC teknik departmanı bildirimi). Yüksüz,
 *       küçük-sehim rijitliği; takozun kendi özelliği.
 *   (B) BMC 8x8 ÇALIŞMA NOKTASI ('...-calc') — AMC'nin proje 3066 hesaplarından
 *       (13440/13948/13955/13957) geri çözülen efektif sekant rijitlik.
 *
 * Test neyi kilitliyor:
 *   • (A) katalog değerleri birebir + dx = sx × cdyn/cstat özdeşliği;
 *   • (B) değerlerinin dört raporun KENDİ sonuçlarını yeniden ürettiği
 *     (statik çökme + takoz kuvvetleri + 6 doğal frekans, her rapor için);
 *   • oyuklu konilerin KASITLI radyal anizotropisi (sx ≠ sy) ve masif konilerin
 *     eksenel simetrisi (sx = sy);
 *   • iki tabanın BİRBİRİNE KARIŞMADIĞI ve farkın gerçek olduğu (nominal
 *     değerlerle aynı raporlar belirgin şekilde SAPAR — bu kayıt altında).
 *
 * Bir hane kayarsa sonuç sessizce "makul ama yanlış" çıkar — testin karşılığı burada.
 * Aynı güç grubu (2285,2 kg) dört FARKLI takoz kombinasyonuyla çözüldüğü için tek
 * bir takozun rijitliği birden çok bağımsız yapılandırmayı aynı anda tutturmak
 * zorundadır; tesadüfen geçmesi mümkün değildir.
 */

const core = require('../../js/mount-core.js');
global.veMountCore = core;

const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; });

const mm = (v) => v / 1000;

// ── Rapor "Bodies" tablosu — dört raporda da AYNI ────────────────────────────
const COMPS = [
  { name: 'Motor',    mass: 1472.20, cg: [626.80, 64.10, 453.10].map(mm),
    I: [[110.00, 0, 0], [0, 205.00, 0], [0, 0, 260.00]], pointMass: false },
  { name: 'Şanzıman', mass: 813.00, cg: [1875.80, 42.60, 216.30].map(mm),
    I: [[16.40, 0, 0], [0, 68.20, 0], [0, 0, 64.90]], pointMass: false },
];
const G_AMC = 9.806;   // ΣFz = 22,41 kN / 2285,2 kg — raporun kendi yerçekimi sabiti

// ── Rapor "Supports" tablosundaki takoz konumları (mm) ───────────────────────
const P1 = [0, 0, 0];
const P2 = [0, 101.60, 0];
const P3 = [1506.40, -296.70, 264.20];
const P4 = [1506.40, 398.30, 264.20];
const P5 = [1656.40, -296.70, 264.20];
const P6 = [1656.40, 398.30, 264.20];

// (B) çalışma-noktası girdileri — raporları yeniden üreten taban
const K38 = 'amc137963-calc', K67 = 'amc137731-calc',
      KNP = 'amc137829',                       // NP'nin nominal karşılığı yok
      KNG = 'amc137830-calc';
// (A) nominal katalog girdileri
const N38 = 'amc137963', N67 = 'amc137731', NNG = 'amc137830';

// ── Dört rapor: takoz dizilimi + raporun KENDİ sonuçları ─────────────────────
const REPORTS = [
  { id: 'hesap 13948 — Cone 38 60Sh + Cone 121 NP 55Sh',
    mounts: [[K38, P1], [K38, P2], [KNP, P3], [KNP, P4]],
    f:  [5.770, 7.316, 10.692, 12.446, 15.000, 19.060],
    dz: [-2.876, -2.918, -7.105, -7.392],
    dx: [-0.420, -0.414, 0.326, 0.367],
    dy: [-0.014, -0.014, 0.005, 0.005],
    Fz: [-3.408, -3.453, -7.607, -7.942],
    Fy: [-0.015, -0.015, 0.015, 0.015],
    fTol: 0.47 },                                    // bkz. dosya başı notu (mod 4–5)
  { id: 'hesap 13955 — 2x Cone 38 60Sh + 4x Cone 67 50Sh',
    mounts: [[K38, P1], [K38, P2], [K67, P3], [K67, P4], [K67, P5], [K67, P6]],
    f:  [7.456, 10.404, 11.142, 14.499, 18.344, 20.602],
    dz: [-3.053, -3.075, -2.895, -3.041, -2.885, -3.032],
    dx: [0.011, 0.013, -0.014, 0.004, -0.014, 0.004],
    dy: [-0.012, -0.012, 0.005, 0.005, 0.001, 0.001],
    Fz: [-3.598, -3.621, -3.718, -3.889, -3.707, -3.878],
    Fy: [-0.013, -0.013, 0.010, 0.010, 0.003, 0.003],
    fTol: 0.05 },
  { id: 'hesap 13957 — 6x Cone 38 60Sh',
    mounts: [[K38, P1], [K38, P2], [K38, P3], [K38, P4], [K38, P5], [K38, P6]],
    f:  [7.398, 10.602, 11.124, 11.669, 18.115, 20.670],
    dz: [-3.066, -3.089, -3.146, -3.307, -3.160, -3.322],
    dx: [-0.019, -0.016, -0.001, 0.018, -0.001, 0.018],
    dy: [-0.011, -0.011, 0.008, 0.008, 0.004, 0.004],
    Fz: [-3.611, -3.637, -3.697, -3.868, -3.713, -3.884],
    Fy: [-0.012, -0.012, 0.008, 0.008, 0.004, 0.004],
    fTol: 0.20 },
  { id: 'hesap 13440 — Cone 38 60Sh + Cone 121 NG 55Sh',
    mounts: [[K38, P1], [K38, P2], [KNG, P3], [KNG, P4]],
    f:  [6.291, 7.998, 10.946, 14.346, 16.616, 19.517],
    dz: [-2.810, -2.845, -5.002, -5.241],
    dx: [-0.247, -0.242, 0.141, 0.174],
    dy: [-0.016, -0.016, 0.004, 0.004],
    Fz: [-3.336, -3.373, -7.685, -8.017],
    Fy: [-0.017, -0.017, 0.016, 0.016],
    fTol: 0.10 },
];

// Toleranslar KEYFİ DEĞİL: gerçekte ulaşılan en kötü sapmanın hemen üstüne
// konmuştur (δz 0,030 → 0,035 · δx 0,008 → 0,010 · δy 0,0015 → 0,002 ·
// Fz 0,005 → 0,006 · Fy 0,0015 → 0,002). Gevşek tolerans testi kör eder:
// bu değerlerle bir rijitliği %5 kaydırmak testi KIRAR (mutasyonla doğrulandı).
const TOL = { dz: 0.035, dx: 0.010, dy: 0.002, Fz: 0.006, Fy: 0.002 };

const buildMounts = (spec) => spec.map(([key, pos], i) => {
  const e = cp.VE_MOUNT_LIBRARY[key];
  return { name: key + '#' + (i + 1), pos: pos.map(mm),
           kstat: [e.sx, e.sy, e.sz].map((v) => v * 1000),
           kdyn:  [e.dx, e.dy, e.dz].map((v) => v * 1000) };
});

const solveReport = (R) => {
  const mounts = buildMounts(R.mounts);
  const mp = core.combineMassProps(COMPS);
  const stat = core.solveCase(core.buildK(mounts, mp.cg, false), mounts, mp.cg, mp.m, G_AMC,
                              { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
  const modes = core.solveModal(core.buildK(mounts, mp.cg, true),
                                core.buildM6(mp.m, mp.I_G), mounts, mp.cg);
  return { mp, mounts, stat, modes };
};

// ═══════════════════════════════════════════════════════════════════════════
// ── (A) NOMİNAL KATALOG — üreticinin ürün verisi ─────────────────────────────
// kod → [ad, kx, ky, kz (N/mm, statik), cdyn/cstat, maks. yük (kg), Sh, oyuklu?]
const CATALOG = {
  'amc137963': ['Cone 38 60Sh (AMC 137963)',     1800, 1210, 1150, 1.6,  650, 60, true],
  'amc137964': ['Cone 38 70Sh (AMC 137964)',     2770, 1990, 1900, 1.8,  900, 70, true],
  'amc137731': ['Cone 67 50Sh (AMC 137731)',     3090, 2150, 1325, 1.4,  900, 50, true],
  'amc137981': ['Cone 39 40Sh (AMC 137981)',     1340, 1340,  720, 1.2,  400, 40, false],
  'amc137982': ['Cone 39 50Sh (AMC 137982)',     2200, 2200, 1150, 1.4,  600, 50, false],
  'amc137983': ['Cone 39 60Sh (AMC 137983)',     2490, 2490, 1400, 1.6,  900, 60, false],
  'amc137830': ['Cone 121 NG 55Sh (AMC 137830)', 4000, 4000, 1350, 1.5, 1750, 55, false],
  'amc137833': ['Cone 121 NG 65Sh (AMC 137833)', 5800, 5800, 2500, 1.7, 2000, 65, false],
  'amc177296': ['AMC 177296',                    1090, 1090,  650, 2.0,  900, null, false],
};
// ── (B) BMC 8x8 çalışma noktası — AMC hesaplarından geri çözüm ───────────────
const WORKPOINT = {
  [K38]: ['Cone 38 60Sh (AMC 137963 · BMC 8x8 çalışma noktası)',     [2670, 1065, 1180], [4265, 1690, 1715]],
  [K67]: ['Cone 67 50Sh (AMC 137731 · BMC 8x8 çalışma noktası)',     [3550, 2115, 1280], [4630, 2785, 1625]],
  [KNG]: ['Cone 121 NG 55Sh (AMC 137830 · BMC 8x8 çalışma noktası)', [4405, 4405, 1530], [6380, 6380, 2080]],
  [KNP]: ['Cone 121 NP 55Sh (AMC 137829 · BMC 8x8 çalışma noktası)', [3150, 3150, 1075], [4605, 4605, 1755]],
};

describe('(A) Nominal katalog girdileri', () => {
  test('dokuz girdi de kütüphanede, statik değerleri üreticinin tablosuyla birebir', () => {
    Object.entries(CATALOG).forEach(([k, [name, kx, ky, kz]]) => {
      const e = cp.VE_MOUNT_LIBRARY[k];
      expect(e).toBeDefined();
      expect(e.name).toBe(name);
      expect([e.sx, e.sy, e.sz]).toEqual([kx, ky, kz]);
    });
  });

  test('dinamik = statik × cdyn/cstat (üreticinin verdiği yöntem, tam sayı)', () => {
    Object.entries(CATALOG).forEach(([k, [, kx, ky, kz, r]]) => {
      const e = cp.VE_MOUNT_LIBRARY[k];
      expect([e.dx, e.dy, e.dz]).toEqual([kx * r, ky * r, kz * r].map((v) => Math.round(v * 1e6) / 1e6));
      expect(Number.isInteger(e.dx) && Number.isInteger(e.dy) && Number.isInteger(e.dz)).toBe(true);
    });
  });

  test('AMC NR kuralı cdyn/cstat = (Sh+20)/50 — bilinen beş veriyi de veriyor', () => {
    // Cone 39'un oranı bu kuraldan TÜRETİLDİ; kural, sertliği bilinen ve oranı
    // kaynakta AÇIKÇA verilen beş NR koniyi birebir vermeli. Kural kayarsa
    // 137981/137982/137983'ün dinamik değerleri de dayanaksız kalır.
    const GIVEN = ['amc137731', 'amc137830', 'amc137963', 'amc137833', 'amc137964'];
    GIVEN.forEach((k) => {
      const [, , , , r, , sh] = CATALOG[k];
      expect((sh + 20) / 50).toBeCloseTo(r, 10);
    });
    ['amc137981', 'amc137982', 'amc137983'].forEach((k) => {
      const [, , , , r, , sh] = CATALOG[k];
      expect((sh + 20) / 50).toBeCloseTo(r, 10);
    });
  });

  test('oyuklu koni radyal anizotropik, masif koni eksenel simetrik', () => {
    Object.entries(CATALOG).forEach(([k, [, kx, ky, , , , , cutouts]]) => {
      const e = cp.VE_MOUNT_LIBRARY[k];
      if (cutouts) {                          // CONE WITH CUTOUTS → kx > ky
        expect(kx).toBeGreaterThan(ky);
        expect(e.dx).toBeGreaterThan(e.dy);
      } else {                                // SOLID CONE → eksenel simetrik
        expect(e.sx).toBe(e.sy);
        expect(e.dx).toBe(e.dy);
      }
      expect(e.sz).toBeLessThan(e.sx);        // koni: eksenel her zaman en yumuşak
    });
  });
});

describe('(B) Çalışma-noktası girdileri', () => {
  test('dördü de kütüphanede, değerleri birebir', () => {
    Object.entries(WORKPOINT).forEach(([k, [name, s, d]]) => {
      const e = cp.VE_MOUNT_LIBRARY[k];
      expect(e).toBeDefined();
      expect(e.name).toBe(name);
      expect([e.sx, e.sy, e.sz]).toEqual(s);
      expect([e.dx, e.dy, e.dz]).toEqual(d);
    });
  });

  test('adları "çalışma noktası" taşıyor — nominalle karıştırılamaz', () => {
    Object.keys(WORKPOINT).forEach((k) =>
      expect(cp.VE_MOUNT_LIBRARY[k].name).toContain('çalışma noktası'));
    Object.keys(CATALOG).forEach((k) =>
      expect(cp.VE_MOUNT_LIBRARY[k].name).not.toContain('çalışma noktası'));
  });
});

describe('İki taban birbirine karışmıyor', () => {
  test('aynı parça kodunun iki girdisi AYRI ve değerleri farklı', () => {
    [['amc137963', K38], ['amc137731', K67], ['amc137830', KNG]].forEach(([nom, wp]) => {
      const a = cp.VE_MOUNT_LIBRARY[nom], b = cp.VE_MOUNT_LIBRARY[wp];
      expect(a).not.toBe(b);
      expect([a.sx, a.sy, a.sz]).not.toEqual([b.sx, b.sy, b.sz]);
    });
  });

  test('sert eksende fark BÜYÜK — sessizce takas edilirse fark edilir', () => {
    // ön yük kauçuğu kayma yönünde sertleştirir; oyuklu konide sert eksende belirgin
    expect(cp.VE_MOUNT_LIBRARY[K38].sx / cp.VE_MOUNT_LIBRARY['amc137963'].sx).toBeGreaterThan(1.4);
    expect(cp.VE_MOUNT_LIBRARY[K67].sx / cp.VE_MOUNT_LIBRARY['amc137731'].sx).toBeGreaterThan(1.1);
  });

  test('anahtarlar ve adlar tekil — mevcut girdilerle çakışmıyor', () => {
    const L = cp.VE_MOUNT_LIBRARY;
    const names = Object.values(L).map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(Object.keys(L)).size).toBe(Object.keys(L).length);
  });

  test('mevcut girdiler DEĞİŞMEDİ (regresyon)', () => {
    const L = cp.VE_MOUNT_LIBRARY;
    expect([L['57RS313773'].sx, L['57RS313773'].sy, L['57RS313773'].sz]).toEqual([334, 334, 2300]);
    expect([L['57RS313774'].sx, L['57RS313774'].sy, L['57RS313774'].sz]).toEqual([1200, 1200, 2400]);
    expect([L['amc55sha'].sx, L['amc55sha'].sy, L['amc55sha'].sz]).toEqual([1252, 1252, 640]);
    expect(L['TK050'].fits.z.comp.k0).toBe(381);
  });

  test('hepsi Takoz panelinin kütüphane listesinde görünüyor', () => {
    const html = cp.getMntMountPropertiesHTML({ id: 'm1', type: 'mnt-mount', def: {}, data: {} });
    Object.keys(CATALOG).concat(Object.keys(WORKPOINT))
      .forEach((k) => expect(html).toContain('value="' + k + '"'));
  });

  test('kütüphaneden uygulanınca Takoz düğümüne doğru rijitlikler yazılıyor', () => {
    const n = { id: 'm1', type: 'mnt-mount', def: componentDefs['mnt-mount'], data: {} };
    global.nodes = [n];
    cp.veMntApplyLib('m1', N67);                                   // nominal
    expect([n.data.kxs, n.data.kys, n.data.kzs]).toEqual([3090, 2150, 1325]);
    expect([n.data.kxd, n.data.kyd, n.data.kzd]).toEqual([4326, 3010, 1855]);
    cp.veMntApplyLib('m1', K67);                                   // çalışma noktası
    expect([n.data.kxs, n.data.kys, n.data.kzs]).toEqual([3550, 2115, 1280]);
    expect(n.data.libKey).toBe(K67);
  });
});

describe('Kütle özellikleri raporun "Bodies" tablosuyla aynı', () => {
  test('toplam kütle, ağırlık merkezi ve atalet momentleri', () => {
    const mp = core.combineMassProps(COMPS);
    expect(mp.m).toBeCloseTo(2285.20, 6);
    expect(mp.cg[0] * 1000).toBeCloseTo(1071.15, 1);
    expect(mp.cg[1] * 1000).toBeCloseTo(56.45, 1);
    expect(mp.cg[2] * 1000).toBeCloseTo(368.85, 1);
    expect(mp.I_G[0][0]).toBeCloseTo(156.01, 1);
    expect(mp.I_G[1][1]).toBeCloseTo(1119.64, 1);
    expect(mp.I_G[2][2]).toBeCloseTo(1142.21, 1);
  });
});

describe.each(REPORTS.map((R) => [R.id, R]))('%s', (_id, R) => {
  test(`Static Results — düşey çökmeler (±${TOL.dz} mm)`, () => {
    const { stat } = solveReport(R);
    stat.perMount.forEach((pm, i) =>
      expect(Math.abs(pm.delta[2] * 1000 - R.dz[i])).toBeLessThanOrEqual(TOL.dz));
    expect(stat.checks.tensionCount).toBe(0);            // hepsi basıda
  });

  test(`Static Results — boyuna çökmeler (±${TOL.dx} mm) → sx'i kilitler`, () => {
    const { stat } = solveReport(R);
    stat.perMount.forEach((pm, i) =>
      expect(Math.abs(pm.delta[0] * 1000 - R.dx[i])).toBeLessThanOrEqual(TOL.dx));
  });

  test(`Static Results — yanal çökmeler (±${TOL.dy} mm) → sy'yi kilitler`, () => {
    const { stat } = solveReport(R);
    stat.perMount.forEach((pm, i) =>
      expect(Math.abs(pm.delta[1] * 1000 - R.dy[i])).toBeLessThanOrEqual(TOL.dy));
  });

  test(`Static Results — takoz kuvvetleri (Fz ±${TOL.Fz} kN, Fy ±${TOL.Fy} kN)`, () => {
    const { stat } = solveReport(R);
    stat.perMount.forEach((pm, i) => {
      expect(Math.abs(pm.f[2] / 1000 - R.Fz[i])).toBeLessThanOrEqual(TOL.Fz);
      expect(Math.abs(pm.f[1] / 1000 - R.Fy[i])).toBeLessThanOrEqual(TOL.Fy);
    });
    // ΣFz = ağırlık
    const sum = stat.perMount.reduce((s, pm) => s + pm.f[2], 0);
    expect(sum / 1000).toBeCloseTo(-2285.20 * G_AMC / 1000, 2);
  });

  test('Natural Frequencies — 6 doğal mod', () => {
    const { modes } = solveReport(R);
    expect(modes).toHaveLength(6);
    modes.forEach((md, i) => {
      expect(Math.abs(md.f_Hz - R.f[i])).toBeLessThanOrEqual(R.fTol);
    });
  });
});

describe('Değerler yapılandırmalar arası TUTARLI — tesadüf değil', () => {
  // Cone 38 üç ayrı raporda (13948 / 13955 / 13957) ve üç farklı komşu takozla
  // görünüyor. Tek bir rijitlik üçünü birden tutturuyorsa değer gerçektir.
  test('Cone 38 üç raporda da aynı rijitlikle tutuyor', () => {
    const worst = REPORTS.filter((R) => R.mounts.some(([k]) => k === K38))
      .map((R) => {
        const { stat } = solveReport(R);
        return Math.max(...stat.perMount.map((pm, i) => Math.abs(pm.delta[2] * 1000 - R.dz[i])));
      });
    expect(worst).toHaveLength(4);
    worst.forEach((w) => expect(w).toBeLessThanOrEqual(TOL.dz));
  });

  test('yanlış takoz tipi kullanılırsa sonuç BELİRGİN şekilde sapar (karışırsa fark edilir)', () => {
    // 13948'de Cone 121 NP yerine NG kullan → arka takozların çökmesi çok değişmeli
    const R = REPORTS[0];
    const good = solveReport(R);
    const bad = solveReport({ ...R, mounts: [[K38, P1], [K38, P2], [KNG, P3], [KNG, P4]] });
    const diff = Math.max(...good.stat.perMount.map((pm, i) =>
      Math.abs(pm.delta[2] - bad.stat.perMount[i].delta[2]) * 1000));
    expect(diff).toBeGreaterThan(1.0);                   // mm mertebesinde ayrışıyor
  });
});

describe('Nominal taban raporları YENİDEN ÜRETMEZ — fark ölçülü ve kayıtlı', () => {
  // Bu, kütüphanede neden iki taban durduğunun kanıtı. Nominal (yüksüz) değerler
  // ürün seçimi için doğrudur ama AMC'nin ön yüklü hesabını tutturmaz. Biri gelip
  // '-calc' girdilerini "gereksiz" diye silerse bu test, neyin kaybedildiğini
  // sayıyla gösterir. Beklenen sapma ÖLÇÜLDÜ: Δf ≈ 2,92 Hz · Δδz ≈ 0,70 mm.
  const NOMINAL_FOR = { [K38]: N38, [K67]: N67, [KNG]: NNG, [KNP]: KNP };

  test('nominal değerlerle sapma, çalışma noktasınınkinden mertebe olarak büyük', () => {
    let worstNomF = 0, worstNomZ = 0, worstWpF = 0, worstWpZ = 0;
    REPORTS.forEach((R) => {
      const nomR = { ...R, mounts: R.mounts.map(([k, p]) => [NOMINAL_FOR[k], p]) };
      const wp = solveReport(R), nom = solveReport(nomR);
      worstWpF = Math.max(worstWpF, ...wp.modes.map((m, i) => Math.abs(m.f_Hz - R.f[i])));
      worstNomF = Math.max(worstNomF, ...nom.modes.map((m, i) => Math.abs(m.f_Hz - R.f[i])));
      worstWpZ = Math.max(worstWpZ, ...wp.stat.perMount.map((pm, i) => Math.abs(pm.delta[2] * 1000 - R.dz[i])));
      worstNomZ = Math.max(worstNomZ, ...nom.stat.perMount.map((pm, i) => Math.abs(pm.delta[2] * 1000 - R.dz[i])));
    });
    // çalışma noktası: sıkı  ·  nominal: belirgin şekilde sapıyor
    expect(worstWpF).toBeLessThanOrEqual(0.47);
    expect(worstWpZ).toBeLessThanOrEqual(TOL.dz);
    expect(worstNomF).toBeGreaterThan(2.0);              // ölçülen ≈ 2,92 Hz
    expect(worstNomZ).toBeGreaterThan(0.3);              // ölçülen ≈ 0,70 mm
    expect(worstNomF / worstWpF).toBeGreaterThan(5);     // mertebe farkı
  });
});
