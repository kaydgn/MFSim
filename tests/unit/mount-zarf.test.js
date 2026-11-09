/**
 * mount-zarf.test.js — HAREKET ZARFI (çekirdek motionEnvelope · rapor §8.19)
 * ─────────────────────────────────────────────────────────────────────────
 * Yük durumunun çözümü q = [u; θ] birleşik ağırlık merkezinde (G); gövdenin P
 * noktası Δd = Δu + Δθ × (P − G) kadar yer değiştirir, zarf STATİK konuma göre
 * (Δq = q − q_statik). Noktalar gövdenin ağırlık merkezi + nokta kütle olmayan
 * gövdenin eşdeğer kutusunun sekiz köşesi (köşegen atalet, §8.16'nın kutusu).
 *
 *   · EL HESABI — saf öteleme, saf dönme, referansın çıkarılması, nokta kütle.
 *   · KABUK — R.zarf yük durumları + vitesler + tasarım koşullarından; Statik
 *     çözülemezse zarf yok; rapor §8.19 bölümü ve kritik özetin satırı.
 * TTA örneğinin sayıları: tests/unit/mount-ornek-tta.test.js → ZARF.
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.veMntSignals = null;
global.veMntBrief = require('../../js/mount-brief.js');
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');
const rep = require('../../js/cp-mount-report.js');
['veMntUygunluk', 'veMntRaporOpts', '_mntRepCaseTr', '_mntRepIsolation', '_mntRepEngine', '_mntRepZeta']
  .forEach((k) => { global[k] = rep[k]; });
global.veSayi = require('../../js/sayi.js').veSayi;

beforeEach(() => resetStubs(stubs));

// 1,2 × 0,6 × 0,8 m kutu, 600 kg: I = m(b² + c²)/12 …
const KUTU = [1.2, 0.6, 0.8], KUTLE = 600;
const Ikutu = (m, k) => [[m * (k[1] ** 2 + k[2] ** 2) / 12, 0, 0], [0, m * (k[0] ** 2 + k[2] ** 2) / 12, 0], [0, 0, m * (k[0] ** 2 + k[1] ** 2) / 12]];
const govde = (ad, cg, nokta) => ({ name: ad, mass: nokta ? 10 : KUTLE, cg, I: nokta ? [[0, 0, 0], [0, 0, 0], [0, 0, 0]] : Ikutu(KUTLE, KUTU), pointMass: !!nokta });
const durum = (ad, q) => ({ name: ad, res: { q } });

describe('EL HESABI — çekirdek motionEnvelope', () => {
  test('saf öteleme: her nokta Δu kadar; Statik referans (sıfır) zarfa girer', () => {
    const Z = core.motionEnvelope([govde('kutu', [0, 0, 0])], [durum('Static', [0, 0, 0, 0, 0, 0]), durum('a', [0.002, -0.003, 0.004, 0, 0, 0])], [0, 0, 0]);
    expect(Z.govde[0].min.map((v) => +v.toFixed(12))).toEqual([0, -0.003, 0]);
    expect(Z.govde[0].max.map((v) => +v.toFixed(12))).toEqual([0.002, 0, 0.004]);
    expect(Z.toplam.max[0]).toBeCloseTo(0.002, 12);
    expect(Z.toplam.maxAt[0].durum).toBe('a');
  });
  test('saf dönme (θz = 0,01 rad): kutunun köşesi Δy = θz·a/2, Δx = −θz·b/2; eşdeğer kutu ataletten (1,2 × 0,6 × 0,8 m)', () => {
    const Z = core.motionEnvelope([govde('kutu', [0, 0, 0])], [durum('d', [0, 0, 0, 0, 0, 0.01])], [0, 0, 0], [0, 0, 0, 0, 0, 0]);
    const g = Z.govde[0];
    expect(g.max[1]).toBeCloseTo(0.01 * 0.6, 12);                     // köşe x = +0,6 → Δy = θz·x
    expect(g.min[1]).toBeCloseTo(-0.01 * 0.6, 12);                    // köşe x = −0,6
    expect(g.max[0]).toBeCloseTo(0.01 * 0.3, 12);                     // köşe y = −0,3 → Δx = −θz·y
    expect(g.max[2]).toBeCloseTo(0, 12);
    expect(g.maxAt[1]).toMatchObject({ durum: 'd', govde: 'kutu' });
    expect(g.maxAt[1].nokta[0]).toBe(1);                              // +X yüzünün köşesi
    expect(g.maxAt[0].nokta[1]).toBe(-1);
  });
  test('zarf statik konuma GÖRE: referans q çıkarılır; G\'den uzaktaki nokta dönmeyle büyür', () => {
    const q0 = [0, 0, -0.003, 0.001, 0, 0];
    const Z = core.motionEnvelope([govde('uç', [2, 0.5, 0], true)],
      [durum('Static', q0), durum('b', [0.001, 0, -0.003, 0.001, 0.002, 0])], [0, 0, 0], q0);
    // Δq = [0,001; 0; 0; 0; 0,002; 0], r = (2; 0,5; 0): Δx = 0,001 + 0,002·0, Δz = −0,002·2
    expect(Z.govde[0].max[0]).toBeCloseTo(0.001, 12);
    expect(Z.govde[0].min[2]).toBeCloseTo(-0.004, 12);
    expect(Z.govde[0].minAt[2]).toEqual({ durum: 'b', nokta: 'ag', govde: 'uç' });
  });
  test('nokta kütle yalnız ağırlık merkezi; çözülemeyen durum atlanır; durum ya da G yoksa zarf yok', () => {
    const Z = core.motionEnvelope([govde('n', [1, 0, 0], true), govde('k', [0, 0, 0])],
      [durum('a', [0, 0, 0, 0, 0, 0.01]), { name: 'x', res: null }], [0, 0, 0]);
    expect(Z.govde[0].max[1]).toBeCloseTo(0.01, 12);
    expect(Z.govde[0].maxAt[1].nokta).toBe('ag');
    expect(Z.toplam.max[1]).toBeCloseTo(0.01, 12);                    // kutunun köşesi 0,006 — nokta kütle 0,01
    expect(core.motionEnvelope([govde('k', [0, 0, 0])], [{ name: 'x', res: null }], [0, 0, 0])).toBe(null);
    expect(core.motionEnvelope([govde('k', [0, 0, 0])], [durum('a', [0, 0, 0, 0, 0, 0])], null)).toBe(null);
  });
});

// Kabuğun hattı: iki gövde, dört takoz; tork vites durumları ve tasarım koşulları
function model(veri) {
  const govdeD = { mass: 600, cgx: 0, cgy: 0, cgz: 500, Ixx: 50, Iyy: 90, Izz: 80, Ixy: 0, Ixz: 0, Iyz: 0, pointMass: false };
  global.nodes = [
    { id: 'm1', type: 'mnt-motor', customName: 'Motor', data: Object.assign({}, govdeD, veri || {}) },
    { id: 'p1', type: 'mnt-pump', customName: 'Pompa', data: { mass: 20, cgx: 300, cgy: 250, cgz: 700, Ixx: 0, Iyy: 0, Izz: 0, Ixy: 0, Ixz: 0, Iyz: 0, pointMass: true } },
    ...[[-400, 300], [-400, -300], [400, 300], [400, -300]].map(([x, y], i) => ({ id: 't' + i, type: 'mnt-mount', customName: 'T' + i,
      data: { x, y, z: 300, kxs: 300, kys: 300, kzs: 900, kxd: 300, kyd: 300, kzd: 900 } })),
    { id: 's1', type: 'mnt-solver', data: {} }
  ].map((n) => Object.assign(n, { def: componentDefs[n.type], x: 0, y: 0, width: 60, height: 50 }));
  global.connections = [];
  cp._mntForgetResults();
  return cp._mntComputeResults('s1');
}

describe('KABUK — R.zarf ve rapor §8.19', () => {
  test('zarf yük durumları + vitesler + tasarım koşullarından; Statik referans', () => {
    const R = model({ Te: 800, g1: 4, g2: 2, gR: -4, Rstall: 1.5, idleRpm: 700, cylinders: 6 });
    expect(R.gearCases.length).toBe(3);
    const hepsi = R.allCases.concat(R.gearCases, R.designCases);
    const Z = core.motionEnvelope(R.components, hepsi, R.mp.cg, R.qStatic);
    expect(R.zarf).toEqual(Z);
    expect(R.zarf.govde.map((g) => g.name)).toEqual(['Motor', 'Pompa']);
    const adlar = new Set(R.zarf.govde.flatMap((g) => g.minAt.concat(g.maxAt).map((a) => a.durum)));
    expect([...adlar].some((a) => /Vites/.test(a)) || [...adlar].some((a) => /Torque/.test(a))).toBe(true);
  });
  test('Statik çözülemezse zarf yok, bölüm yok', () => {
    const R = model();
    expect(R.zarf).not.toBe(null);
    const R2 = Object.assign({}, R, { zarf: null });
    expect(rep._mntRepZarf(R2)).toBe('');
  });
  test('§8.19 raporun son bölümü; kritik özette tek satır', () => {
    const R = global._veMntLast = model();
    const el = document.createElement('div');
    el.innerHTML = rep._mntRepSection8(R);
    const h = Array.from(el.querySelectorAll('h3')).map((x) => x.textContent);
    expect(h[h.length - 1]).toBe('8.19 Hareket zarfı');
    const ozet = Array.from(el.querySelectorAll('.note div')).map((d) => d.textContent).find((t) => /Hareket zarfı/.test(t));
    const Z = R.zarf.toplam;
    const yaz = (v) => { const t = veSayi(+Math.abs(v * 1000).toFixed(1)); return t === '0' ? '0' : (v < 0 ? '−' : '+') + t; };
    expect(ozet).toBe('Hareket zarfı (statik konuma göre): ' + ['X', 'Y', 'Z'].map((e, i) =>
      e + ' ' + yaz(Math.min(0, Z.min[i])) + ' / ' + yaz(Math.max(0, Z.max[i]))).join(' · ') + ' mm (§8.19)');
  });
});
