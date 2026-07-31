/**
 * Viskoz sönüm — tek ζ'den takoz katsayılarının türetilmesi
 * ────────────────────────────────────────────────────────
 * Sönüm oranı ζ ŞİRKET KABULÜDÜR: takoz başına girilmez, tüm montaj için tek
 * değer olarak Çözücü'de girilir. Takozun eksen başına katsayısı buradan türer:
 *
 *     c_eksen = 2·ζ·√( k_dyn,eksen · m_pay ),   m_pay = |f_z,statik| / g
 *
 * ALTIN REFERANS: BMC ASR-SR-116 (ASFAT 8x8 Obüs) Tablo 11 — ζ=0,02 ile 6
 * takozun 12 katsayısı. Bağıntı yanlış olursa bu tablo tutmaz; sessiz bir
 * "makul ama yanlış" sonuç gözle yakalanmaz. Testin karşılığı burada.
 */

const core = require('../../js/mount-core.js');
global.veMountCore = core;

const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn() });
const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

// ── ASR-SR-116: takoz yükleri (Tablo 7/11) + rijitlikler (Tablo 9) ─────────
// Ön takozlar 57RS313774 (dyn 1045/1045/1800), arka dörtlü 57RS313773 (630/630/3000).
const REF = [
  { name: 'Ön Sol',   m: 365.84, kdyn: [1045, 1045, 1800], c: [0.78, 0.78, 1.03] },
  { name: 'Ön Sağ',   m: 364.37, kdyn: [1045, 1045, 1800], c: [0.78, 0.78, 1.02] },
  { name: 'Sol Ön',   m: 437.86, kdyn: [630, 630, 3000],   c: [0.66, 0.66, 1.45] },
  { name: 'Sol Arka', m: 436.87, kdyn: [630, 630, 3000],   c: [0.66, 0.66, 1.45] },
  { name: 'Sağ Ön',   m: 425.55, kdyn: [630, 630, 3000],   c: [0.65, 0.65, 1.43] },
  { name: 'Sağ Arka', m: 424.56, kdyn: [630, 630, 3000],   c: [0.65, 0.65, 1.43] },
];
const ZETA = 0.02;

describe('Çekirdek — mountDamping', () => {
  test('ASR-SR-116 Tablo 11 birebir yeniden üretilir (12/12 katsayı)', () => {
    const mounts = REF.map((r) => ({ name: r.name, kdyn: r.kdyn.map((k) => k * 1000) })); // N/mm → N/m
    const shares = REF.map((r) => r.m);
    const d = core.mountDamping(mounts, shares, ZETA);
    d.forEach((e, i) => {
      [0, 1, 2].forEach((ax) => {
        expect(e.c[ax] / 1000).toBeCloseTo(REF[i].c[ax], 2);   // N·s/m → N·s/mm, ±0,005
      });
      expect(e.zeta).toBe(ZETA);
      expect(e.mShare).toBeCloseTo(REF[i].m, 6);
    });
  });

  test('ζ ile doğrusal, k ve m ile karekök ölçekli', () => {
    const mt = [{ name: 'a', kdyn: [1e6, 1e6, 1e6] }];
    const c1 = core.mountDamping(mt, [100], 0.02)[0].c[2];
    expect(core.mountDamping(mt, [100], 0.04)[0].c[2]).toBeCloseTo(2 * c1, 9);   // ζ ×2 → c ×2
    expect(core.mountDamping(mt, [400], 0.02)[0].c[2]).toBeCloseTo(2 * c1, 9);   // m ×4 → c ×2
    const stiff = [{ name: 'a', kdyn: [4e6, 4e6, 4e6] }];
    expect(core.mountDamping(stiff, [100], 0.02)[0].c[2]).toBeCloseTo(2 * c1, 9); // k ×4 → c ×2
  });

  test('yük payı veya ζ yoksa c = 0 (uydurma değer üretilmez)', () => {
    const mt = [{ name: 'a', kdyn: [1e6, 1e6, 1e6] }];
    expect(core.mountDamping(mt, null, 0.02)[0].c).toEqual([0, 0, 0]);
    expect(core.mountDamping(mt, [100], 0)[0].c).toEqual([0, 0, 0]);
    expect(core.mountDamping([], [], 0.02)).toEqual([]);
  });
});

describe('Çekirdek — mountLoadShares', () => {
  test('statik çözümden yük payı: Σm_pay = toplam kütle', () => {
    const comps = core.ttarComponentsSI();
    const mounts = core.ttarMountsSI();
    const mp = core.combineMassProps(comps);
    const K = core.buildK(mounts, mp.cg, false);
    const res = core.solveCase(K, mounts, mp.cg, mp.m, 9.81, { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
    const shares = core.mountLoadShares(res, 9.81);
    expect(shares).toHaveLength(6);
    expect(shares.reduce((s, v) => s + v, 0)).toBeCloseTo(mp.m, 3);   // denge: Σ|f_z|/g = m
    expect(shares.every((v) => v > 0)).toBe(true);
  });

  test('çözüm yoksa null', () => {
    expect(core.mountLoadShares(null, 9.81)).toBeNull();
  });
});

describe('UI — ζ tek kaynak: Çözücü', () => {
  test('varsayılan çekirdekten gelir (tek doğruluk kaynağı)', () => {
    expect(core.DEFAULT_ZETA).toBe(0.02);
    expect(cp._mntZetaDefault()).toBe(core.DEFAULT_ZETA);
  });

  test('girilmemiş / geçersiz değer varsayılana düşer', () => {
    expect(cp._mntZetaOf({ data: {} })).toBe(core.DEFAULT_ZETA);
    expect(cp._mntZetaOf({ data: { zeta: '' } })).toBe(core.DEFAULT_ZETA);
    expect(cp._mntZetaOf({ data: { zeta: 1.5 } })).toBe(core.DEFAULT_ZETA);   // ζ<1 olmalı
    expect(cp._mntZetaOf({ data: { zeta: 'abc' } })).toBe(core.DEFAULT_ZETA);
    expect(cp._mntZetaOf(null)).toBe(core.DEFAULT_ZETA);
  });

  test('geçerli değer aynen kullanılır (ondalık virgül dahil)', () => {
    expect(cp._mntZetaOf({ data: { zeta: 0.05 } })).toBe(0.05);
    expect(cp._mntZetaOf({ data: { zeta: '0,035' } })).toBeCloseTo(0.035, 9);
    expect(cp._mntZetaOf({ data: { zeta: 0 } })).toBe(0);   // sönümsüz kasıtlı seçilebilir
  });

  test('veMntSetZeta: aralık dışını yok sayar, boş girdi alanı siler', () => {
    const solver = { id: 's1', type: 'mnt-solver', data: {} };
    global.nodes = [solver];
    cp.veMntSetZeta('s1', '0.03');   expect(solver.data.zeta).toBeCloseTo(0.03, 9);
    cp.veMntSetZeta('s1', '2');      expect(solver.data.zeta).toBeCloseTo(0.03, 9);   // reddedildi
    cp.veMntSetZeta('s1', '-0.1');   expect(solver.data.zeta).toBeCloseTo(0.03, 9);   // reddedildi
    cp.veMntSetZeta('s1', '');       expect(solver.data.zeta).toBeUndefined();        // varsayılana dön
  });

  test('Çözücü paneli ζ alanını basar', () => {
    const html = cp.getMntSolverPropertiesHTML({ id: 's1', type: 'mnt-solver', def: {}, data: {} });
    expect(html).toContain('veMntSetZeta');
    expect(html).toContain('Sönüm Oranı');
  });
});

describe('Çözüm zinciri — ζ sonuçlara akıyor', () => {
  // TTAR referans modelini kanvas düğümleri olarak kur (çözücünün gördüğü biçim).
  const buildTopo = (zeta) => {
    const EX = core.TTAR_EXAMPLE;
    const bodies = EX.components.map((c, i) => ({
      id: 'b' + i, type: 'mnt-motor', def: { isMountBody: true }, customName: c.name,
      data: { mass: c.mass, cgx: c.cg[0], cgy: c.cg[1], cgz: c.cg[2],
              Ixx: c.Ixx, Iyy: c.Iyy, Izz: c.Izz, Ixy: c.Ixy, Ixz: c.Ixz, Iyz: c.Iyz,
              pointMass: !!c.pointMass } }));
    const mounts = EX.mounts.map((m, i) => ({
      id: 'm' + i, type: 'mnt-mount', def: { isMount: true }, customName: m.name,
      data: { x: m.pos[0], y: m.pos[1], z: m.pos[2],
              kxs: m.kstat[0], kys: m.kstat[1], kzs: m.kstat[2],
              kxd: m.kdyn[0], kyd: m.kdyn[1], kzd: m.kdyn[2] } }));
    const solver = { id: 'sv', type: 'mnt-solver', def: { isMountSolver: true },
                     data: zeta === undefined ? {} : { zeta } };
    return bodies.concat(mounts, [solver]);
  };

  test('R.zeta + R.damping üretilir; yük payları toplamı kütleyi verir', () => {
    global.nodes = buildTopo(0.02);
    const R = cp._mntComputeResults('sv');
    expect(R.error).toBeUndefined();
    expect(R.zeta).toBe(0.02);
    expect(R.damping).toHaveLength(6);
    expect(R.loadShares.reduce((s, v) => s + v, 0)).toBeCloseTo(R.mp.m, 2);
    // c değerleri pozitif ve dinamik rijitlikle uyumlu sırada (kz>kx → cz>cx)
    R.damping.forEach((d) => {
      expect(d.c.every((v) => v > 0)).toBe(true);
      expect(d.zeta).toBe(0.02);
    });
  });

  test('ζ girilmemişse varsayılan uygulanır', () => {
    global.nodes = buildTopo(undefined);
    const R = cp._mntComputeResults('sv');
    expect(R.zeta).toBe(core.DEFAULT_ZETA);
    expect(R.damping).toHaveLength(6);
  });

  test('ζ=0 → tüm c sıfır (sönümsüz çözüm kasıtlı seçilebilir)', () => {
    global.nodes = buildTopo(0);
    const R = cp._mntComputeResults('sv');
    expect(R.zeta).toBe(0);
    expect(R.damping.every((d) => d.c.every((v) => v === 0))).toBe(true);
  });

  test('ζ modal frekansları DEĞİŞTİRMEZ (sönümsüz özdeğer problemi korunur)', () => {
    global.nodes = buildTopo(0.001);
    const a = cp._mntComputeResults('sv').modes.map((m) => m.f_Hz);
    global.nodes = buildTopo(0.20);
    const b = cp._mntComputeResults('sv').modes.map((m) => m.f_Hz);
    a.forEach((f, i) => expect(b[i]).toBeCloseTo(f, 9));
  });
});

describe('Rapor — ζ tek kaynaktan okunur', () => {
  const rep = require('../../js/cp-mount-report.js');

  test('Çözücü değeri (R.zeta) önceliklidir', () => {
    expect(rep._mntRepZeta({ zeta: 0.05 }, { zeta: 0.001 })).toBe(0.05);
  });

  test('eski projeler: R.zeta yoksa Rapor düğümündeki değere düşer', () => {
    expect(rep._mntRepZeta({}, { zeta: 0.001 })).toBe(0.001);
  });

  test('ikisi de yoksa çekirdek varsayılanı', () => {
    expect(rep._mntRepZeta({}, {})).toBe(core.DEFAULT_ZETA);
  });

  test('§8.12 sönüm tablosu üretilir; damping yoksa bölüm atlanır', () => {
    global.nodes = [];
    const R = { zeta: 0.02, mp: { m: 2294.5 },
      damping: [{ name: 'sağ ön', mShare: 365.84, zeta: 0.02, c: [782, 782, 1026] }] };
    const html = rep._mntRepDamping(R);
    expect(html).toContain('8.12');
    expect(html).toContain('sağ ön');
    expect(html).toContain('0,782');            // N·s/m → N·s/mm
    expect(rep._mntRepDamping({ zeta: 0.02, mp: { m: 1 }, damping: null })).toBe('');
  });
});
