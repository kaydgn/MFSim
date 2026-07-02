/**
 * cp-mount.test.js — Takoz Çökme-Titreşim UI katmanı (iç içe topoloji)
 *
 * Yeni mimari: alt-bileşen node'ları (Motor/Takoz/Yük Durumu/...) → Çözücü
 * agregasyonu → mount-core. Burada veri modeli, agregasyon ve EN ÖNEMLİSİ
 * "alt-node'lar → _mntAggregate → _mntToSI → çekirdek" köprüsü TTAR ile
 * uçtan uca T1/T3/T6 referans değerlerine karşı doğrulanır.
 */
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const cp = require('../../js/cp-mount.js');

describe('Veri modeli', () => {
  test('veMountDefaultData iç topoloji modeli döner (nodes dizisi)', () => {
    const d = cp.veMountDefaultData();
    expect(d.g).toBe(9.81);
    expect(Array.isArray(d.nodes)).toBe(true);
    expect(d.nodes).toHaveLength(0);
  });
  test('veMountEnsureData node.data.mnt oluşturur', () => {
    const node = { id: 'comp-1', type: 'mount-analysis', data: {} };
    const d = cp.veMountEnsureData(node);
    expect(node.data.mnt).toBeDefined();
    expect(Array.isArray(d.nodes)).toBe(true);
  });
});

describe('Alt-bileşen türleri (MNT_KINDS)', () => {
  test('temel türler tanımlı ve doğru gruplarda', () => {
    expect(cp.MNT_KINDS.motor.group).toBe('component');
    expect(cp.MNT_KINDS.motor.ctype).toBe('motor');
    expect(cp.MNT_KINDS.mount.group).toBe('mount');
    expect(cp.MNT_KINDS.loadcase.group).toBe('loadcase');
    expect(cp.MNT_KINDS.torque.group).toBe('torque');
    expect(cp.MNT_KINDS.torque.max).toBe(1);
    expect(cp.MNT_KINDS.solver.group).toBe('solver');
    expect(cp.MNT_KINDS.solver.max).toBe(1);
  });
});

describe('Özellik paneli (getMountAnalysisPropertiesHTML)', () => {
  test('özet + "Modülü Aç" düğmesi (iç topoloji)', () => {
    const node = { id: 'comp-5', type: 'mount-analysis', data: {} };
    const html = cp.getMountAnalysisPropertiesHTML(node);
    expect(html).toContain('iç topoloji');
    expect(html).toContain("veMountOpenEditor('comp-5')");
    expect(html).toContain('Takoz');
  });
});

describe('Takoz kütüphanesi', () => {
  test('AMC 55 ShA doğru rijitliklerle', () => {
    const m = cp.VE_MOUNT_LIBRARY['amc55sha'];
    expect([m.sx, m.sy, m.sz]).toEqual([1252, 1252, 640]);
    expect([m.dx, m.dy, m.dz]).toEqual([2055, 2055, 977]);
  });
});

describe('TTAR alt-node üretimi (veMountTTARNodes)', () => {
  const ttar = cp.veMountTTARNodes();
  test('doğru sayıda ve türde node üretir', () => {
    const by = k => ttar.nodes.filter(n => cp.MNT_KINDS[n.kind].group === k).length;
    expect(by('component')).toBe(5);
    expect(by('mount')).toBe(6);
    expect(by('loadcase')).toBe(8);
    expect(by('torque')).toBe(1);
    expect(by('solver')).toBe(1);
    expect(ttar.nodes).toHaveLength(21);
  });
  test('Motor node doğru kütle/CG taşır', () => {
    const motor = ttar.nodes.find(n => n.kind === 'motor');
    expect(motor.data.mass).toBe(1386.3);
    expect(motor.data.cgx).toBe(-321.36);
  });
});

describe('Agregasyon köprüsü (alt-node → çekirdek) — TTAR ile T1/T3/T6', () => {
  const d = { g: 9.81, nodes: cp.veMountTTARNodes().nodes };
  const agg = cp._mntAggregate(d);

  test('_mntAggregate node\'ları component/mount/loadCase\'e ayırır', () => {
    expect(agg.components).toHaveLength(5);
    expect(agg.mounts).toHaveLength(6);
    expect(agg.loadCases).toHaveLength(8);
    expect(agg.torque).toBeTruthy();
  });

  const si = cp._mntToSI(agg);

  test('T1 — kütle birleştirme (2294.522 kg)', () => {
    const mp = core.combineMassProps(si.components);
    expect(mp.m).toBeCloseTo(2294.522, 2);
    expect(mp.cg[0] * 1000).toBeCloseTo(254.669, 2);
    expect(mp.cg[2] * 1000).toBeCloseTo(746.052, 2);
  });
  test('T3 — statik çökme (sağ ön δz=-3.941, ΣFz ✓)', () => {
    const mp = core.combineMassProps(si.components);
    const Kstat = core.buildK(si.mounts, mp.cg, false);
    const res = core.solveCase(Kstat, si.mounts, mp.cg, mp.m, si.g, si.loadCases[0]);
    expect(res.perMount[0].delta[2] * 1000).toBeCloseTo(-3.941, 2);
    expect(res.checks.sumFzOk).toBe(true);
  });
  test('T6 — modal frekanslar', () => {
    const mp = core.combineMassProps(si.components);
    const Kdyn = core.buildK(si.mounts, mp.cg, true);
    const M6 = core.buildM6(mp.m, mp.I_G);
    const modes = core.solveModal(Kdyn, M6, si.mounts, mp.cg);
    const expF = [5.039, 6.111, 8.364, 10.148, 12.071, 21.239];
    modes.forEach((md, i) => expect(md.f_Hz).toBeCloseTo(expF[i], 2));
  });
  test('birim dönüşümü: mm→m, N/mm→N/m', () => {
    const motor = si.components.find(c => c.name === 'Motor');
    expect(motor.cg[0]).toBeCloseTo(-0.32136, 5);
    expect(si.mounts[0].kstat).toEqual([1252000, 1252000, 640000]);
  });
});

describe('Renk skalaları', () => {
  test('sehim/kuvvet eşikleri', () => {
    expect(cp._mntDeflColor(0.2)).toBe('#22c55e');
    expect(cp._mntDeflColor(15)).toBe('#ef4444');
    expect(cp._mntForceColor(25)).toBe('#f97316');
  });
});
