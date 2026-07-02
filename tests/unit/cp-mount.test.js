/**
 * cp-mount.test.js — Takoz Çökme-Titreşim UI katmanı (cp-mount.js)
 *
 * UI katmanı çekirdeği (mount-core.js) çağırır; burada özellik paneli, veri
 * modeli, takoz kütüphanesi ve EN ÖNEMLİSİ UI↔çekirdek birim köprüsü
 * (_mntToSI: mm→m, N/mm→N/m) TTAR seti ile uçtan uca doğrulanır.
 */

// Çekirdeği global olarak sağla (cp-mount.js veMountCore'u global bekler)
const core = require('../../js/mount-core.js');
global.veMountCore = core;

const cp = require('../../js/cp-mount.js');

// TTAR_EXAMPLE (UI birimleri) → cp-mount veri modeli şekli (veMountLoadTTAR ile aynı eşleme)
function ttarUIData() {
  const EX = core.TTAR_EXAMPLE;
  return {
    g: EX.g,
    components: EX.components.map(c => ({
      name: c.name, type: 'other', mass: c.mass,
      cgx: c.cg[0], cgy: c.cg[1], cgz: c.cg[2],
      Ixx: c.Ixx, Iyy: c.Iyy, Izz: c.Izz, Ixy: c.Ixy, Ixz: c.Ixz, Iyz: c.Iyz,
      pointMass: !!c.pointMass
    })),
    mounts: EX.mounts.map(m => ({
      name: m.name, x: m.pos[0], y: m.pos[1], z: m.pos[2],
      kxs: m.kstat[0], kys: m.kstat[1], kzs: m.kstat[2],
      kxd: m.kdyn[0], kyd: m.kdyn[1], kzd: m.kdyn[2]
    })),
    loadCases: EX.loadCases.map(lc => ({ name: lc.name, nx: lc.n[0], ny: lc.n[1], nz: lc.n[2], Tx: lc.T[0], Ty: lc.T[1], Tz: lc.T[2] }))
  };
}

describe('Veri modeli (veMountDefaultData / veMountEnsureData)', () => {
  test('varsayılan model 8 yük durumu şablonuyla gelir', () => {
    const d = cp.veMountDefaultData();
    expect(d.g).toBe(9.81);
    expect(Array.isArray(d.components)).toBe(true);
    expect(d.loadCases).toHaveLength(8);
    expect(d.loadCases[0].name).toBe('Static');
    expect(d.loadCases[0].nz).toBe(-1);
  });
  test('veMountEnsureData node.data.mnt oluşturur ve eksik alanları tamamlar', () => {
    const node = { id: 'comp-1', type: 'mount-analysis', data: {} };
    const d = cp.veMountEnsureData(node);
    expect(node.data.mnt).toBeDefined();
    expect(d.torque).toBeDefined();
    expect(d.matrixMode).toBe('delta');
  });
});

describe('Özellik paneli (getMountAnalysisPropertiesHTML)', () => {
  test('özet + "Editörü Aç" düğmesi döndürür', () => {
    const node = { id: 'comp-5', type: 'mount-analysis', data: {} };
    const html = cp.getMountAnalysisPropertiesHTML(node);
    expect(typeof html).toBe('string');
    expect(html).toContain('6 SD');
    expect(html).toContain("veMountOpenEditor('comp-5')");
    expect(html).toContain('Bileşen sayısı');
  });
});

describe('Takoz kütüphanesi (VE_MOUNT_LIBRARY)', () => {
  test('AMC 55 ShA doğru rijitliklerle mevcut', () => {
    const m = cp.VE_MOUNT_LIBRARY['amc55sha'];
    expect(m.name).toBe('AMC 55 ShA');
    expect([m.sx, m.sy, m.sz]).toEqual([1252, 1252, 640]);
    expect([m.dx, m.dy, m.dz]).toEqual([2055, 2055, 977]);
  });
  test('ÖN ve ARKA A26 takozları mevcut', () => {
    expect(cp.VE_MOUNT_LIBRARY['57RS313773'].name).toContain('ÖN');
    expect(cp.VE_MOUNT_LIBRARY['57RS313774'].name).toContain('ARKA');
  });
});

describe('UI↔çekirdek köprüsü (_mntToSI) — birim dönüşümü', () => {
  test('mm→m ve N/mm→N/m dönüşümü doğru', () => {
    const d = { g: 9.81,
      components: [{ name: 'x', mass: 100, cgx: 1000, cgy: 2000, cgz: 3000, Ixx: 5, Iyy: 6, Izz: 7, Ixy: 0, Ixz: 0, Iyz: 0, pointMass: false }],
      mounts: [{ name: 'm', x: 500, y: -500, z: 250, kxs: 1252, kys: 1252, kzs: 640, kxd: 2055, kyd: 2055, kzd: 977 }],
      loadCases: [{ name: 's', nx: 0, ny: 0, nz: -1, Tx: 0, Ty: 0, Tz: 0 }]
    };
    const si = cp._mntToSI(d);
    expect(si.components[0].cg).toEqual([1, 2, 3]);                 // mm→m
    expect(si.components[0].I[0][0]).toBe(5);                        // kg·m² değişmez
    expect(si.mounts[0].pos).toEqual([0.5, -0.5, 0.25]);            // mm→m
    expect(si.mounts[0].kstat).toEqual([1252000, 1252000, 640000]); // N/mm→N/m
    expect(si.mounts[0].kdyn).toEqual([2055000, 2055000, 977000]);
  });

  // KRİTİK: UI şeklindeki TTAR verisi → _mntToSI → çekirdek → T1/T3/T6 birebir
  test('TTAR UI verisi köprüden geçince çekirdek T1 kütlesini üretir', () => {
    const si = cp._mntToSI(ttarUIData());
    const mp = core.combineMassProps(si.components);
    expect(mp.m).toBeCloseTo(2294.522, 2);
    expect(mp.cg[0] * 1000).toBeCloseTo(254.669, 2);
    expect(mp.cg[2] * 1000).toBeCloseTo(746.052, 2);
  });
  test('köprüden geçen TTAR verisi T3 statik çökmeyi üretir', () => {
    const si = cp._mntToSI(ttarUIData());
    const mp = core.combineMassProps(si.components);
    const Kstat = core.buildK(si.mounts, mp.cg, false);
    const res = core.solveCase(Kstat, si.mounts, mp.cg, mp.m, si.g, si.loadCases[0]);
    expect(res.perMount[0].delta[2] * 1000).toBeCloseTo(-3.941, 2);
    expect(res.checks.sumFzOk).toBe(true);
  });
  test('köprüden geçen TTAR verisi T6 modal frekanslarını üretir', () => {
    const si = cp._mntToSI(ttarUIData());
    const mp = core.combineMassProps(si.components);
    const Kdyn = core.buildK(si.mounts, mp.cg, true);
    const M6 = core.buildM6(mp.m, mp.I_G);
    const modes = core.solveModal(Kdyn, M6, si.mounts, mp.cg);
    const expF = [5.039, 6.111, 8.364, 10.148, 12.071, 21.239];
    modes.forEach((md, i) => expect(md.f_Hz).toBeCloseTo(expF[i], 2));
  });
});

describe('Renk skalaları (A26 portu)', () => {
  test('sehim rengi eşikleri', () => {
    expect(cp._mntDeflColor(0.2)).toBe('#22c55e');
    expect(cp._mntDeflColor(2.5)).toBe('#f97316');
    expect(cp._mntDeflColor(15)).toBe('#ef4444');
  });
  test('kuvvet rengi eşikleri', () => {
    expect(cp._mntForceColor(2)).toBe('#22c55e');
    expect(cp._mntForceColor(25)).toBe('#f97316');
  });
});
