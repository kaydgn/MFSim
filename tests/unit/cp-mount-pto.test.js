/**
 * PTO Grubu bileşenleri — PTO · Pompa · PTO Toplam
 * ────────────────────────────────────────────────
 * Kaynak veri: BMC ASR-SR-116 "ASFAT 8x8 OBUS Motor ve Şanzıman Takozu Seçimi"
 * (04.08.2021) Tablo 2 (grup CG), Tablo 3 (grup atalet), Tablo 4 (parça CG).
 *
 * Test politikası gereği burada SUNUM değil MANTIK sınanır:
 *   • tip kaydı + çözücünün bu gövdeleri toplaması (yoksa kütle sessizce kaybolur),
 *   • iki giriş yolunun (ayrıntılı / toplu) AYNI birleşik kütle+CG'yi vermesi
 *     — çekirdeğin paralel-eksen birleştirmesiyle rapor Tablo 2 birebir tutmalı,
 *   • çift-sayım (her iki yol birden) uyarısı,
 *   • taşınan gövde bağlantı kuralı (takoz asla PTO'ya asılmaz).
 * Panel HTML'i için tek "üretiliyor mu / patlamıyor mu" smoke testi yeterlidir.
 */

const core = require('../../js/mount-core.js');
global.veMountCore = core;   // cp-mount.js çekirdeği global olarak arar (tarayıcıdaki gibi)

const stubs = stubGlobals({
  saveState: jest.fn(),
  showToast: jest.fn(),
  showNodeProperties: jest.fn(),
  updateAllConnections: jest.fn(),
});

// componentDefs'i GERÇEK dosyadan al — tip kaydı ile panelin aynı kaynağa
// bakması bu testin asıl amacı (kayıt unutulursa burada kırılır).
const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;

const cp = require('../../js/cp-mount.js');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
});

// ── ASR-SR-116 Tablo 4: üst PTO grubunun parçaları (mm, kg) ────────────────
const TOP_PARTS = [
  { name: 'Üst PTO',     type: 'mnt-pto',  mass: 25,   cg: [741.21, 77.013, 894.726] },
  { name: 'Üst Pompa 1', type: 'mnt-pump', mass: 37,   cg: [971.21, 77.013, 894.726] },
  { name: 'Üst Pompa 2', type: 'mnt-pump', mass: 17.5, cg: [1271.2, 77.013, 894.726] },
  { name: 'Üst Pompa 3', type: 'mnt-pump', mass: 17.5, cg: [1481.21, 77.013, 894.726] },
];
// ASR-SR-116 Tablo 2 + Tablo 3: aynı grubun toplu karşılığı
const TOP_GROUP = { mass: 97, cg: [1058.064, 77.013, 894.726], I: [0.45, 6.515, 6.15] };

const mkNode = (id, type, name, mass, cg, extra) => ({
  id, type, customName: name, def: componentDefs[type],
  data: Object.assign({ mass, cgx: cg[0], cgy: cg[1], cgz: cg[2], pointMass: true }, extra || {}),
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Tip kaydı', () => {
  test('üç bileşen de kayıtlı, kütle gövdesi ve "taşınan" olarak işaretli', () => {
    ['mnt-pto', 'mnt-pump', 'mnt-pto-group'].forEach((t) => {
      expect(componentDefs[t]).toBeDefined();
      expect(componentDefs[t].isMountBody).toBe(true);     // çözücü bunları toplar
      expect(componentDefs[t].isMountCarried).toBe(true);  // takoza değil gövdeye asılır
      expect(componentDefs[t].svg).toContain('<svg');
    });
    expect(componentDefs['mnt-pto'].name).toBe('PTO');
    expect(componentDefs['mnt-pump'].name).toBe('Pompa');
    expect(componentDefs['mnt-pto-group'].name).toBe('PTO Toplam');
  });

  test('ana modül bileşen listesine eklendi (paletten sürüklenebilir)', () => {
    const list = VE_MODULES['full-throttle'].components;
    expect(list).toEqual(expect.arrayContaining(['mnt-pto', 'mnt-pump', 'mnt-pto-group']));
  });
});

describe('Ad → kanvas tipi eşlemesi', () => {
  test('PTO / Pompa / grup adları doğru tipe düşer', () => {
    expect(cp._mntExampleBodyType('Top PTO')).toBe('mnt-pto');
    expect(cp._mntExampleBodyType('Side PTO')).toBe('mnt-pto');
    expect(cp._mntExampleBodyType('Kuyruk Mili')).toBe('mnt-pto');
    expect(cp._mntExampleBodyType('Top Pump 1')).toBe('mnt-pump');
    expect(cp._mntExampleBodyType('Yan Pompa 1')).toBe('mnt-pump');
    // en özgül kalıp kazanır: "PTO Group" hem /pto/ hem /group/ eşler
    expect(cp._mntExampleBodyType('Top PTO Group')).toBe('mnt-pto-group');
    expect(cp._mntExampleBodyType('Side PTO Group')).toBe('mnt-pto-group');
    expect(cp._mntExampleBodyType('PTO Toplam')).toBe('mnt-pto-group');
    expect(cp._mntExampleBodyType('Pompa Grubu')).toBe('mnt-pto-group');
  });

  test('mevcut eşlemeler bozulmadı (regresyon)', () => {
    expect(cp._mntExampleBodyType('Motor')).toBe('mnt-motor');
    expect(cp._mntExampleBodyType('Şanzıman')).toBe('mnt-gearbox');
    expect(cp._mntExampleBodyType('Şaft payı')).toBe('mnt-shaft');
    expect(cp._mntExampleBodyType('Sol cradle')).toBe('mnt-bracket');
    expect(cp._mntExampleBodyType('Transfer Kutusu')).toBe('mnt-transfer');
  });
});

describe('Çözücü entegrasyonu — iki giriş yolu aynı sonucu vermeli', () => {
  test('PTO/Pompa bileşenleri çözücünün kütle listesine girer', () => {
    global.nodes = TOP_PARTS.map((p, i) => mkNode('p' + i, p.type, p.name, p.mass, p.cg));
    const g = cp._mntGatherForSolver();
    expect(g.components).toHaveLength(4);
    expect(g.components.map((c) => c.name)).toEqual(
      ['Üst PTO', 'Üst Pompa 1', 'Üst Pompa 2', 'Üst Pompa 3']);
    expect(g.components.reduce((s, c) => s + c.mass, 0)).toBe(97);   // Tablo 2 ile aynı
  });

  test('ayrıntılı giriş (nokta kütle) → grup kütlesi + grup CG\'si ASR-SR-116 Tablo 2 ile birebir', () => {
    global.nodes = TOP_PARTS.map((p, i) => mkNode('p' + i, p.type, p.name, p.mass, p.cg));
    const si = cp._mntToSI(cp._mntGatherForSolver(), 9.81);
    const mp = core.combineMassProps(si.components);
    expect(mp.m).toBeCloseTo(TOP_GROUP.mass, 6);
    expect(mp.cg[0] * 1000).toBeCloseTo(TOP_GROUP.cg[0], 2);   // 1058.064 mm
    expect(mp.cg[1] * 1000).toBeCloseTo(TOP_GROUP.cg[1], 3);
    expect(mp.cg[2] * 1000).toBeCloseTo(TOP_GROUP.cg[2], 3);
  });

  test('ayrıntılı girişte grup ataleti paralel-eksenden DOĞAR (nokta kütlelerde bile)', () => {
    // Parçalar aynı y,z'de, X boyunca yayılı → Iyy ve Izz yalnız yayılımdan gelir.
    // Rapor Tablo 3 (Iyy 6.515) parçaların kendi ataletini de içerdiğinden birebir
    // değil YAKIN çıkar; test bu mertebeyi (±%5) ve Ixx≈0'ı kilitler.
    global.nodes = TOP_PARTS.map((p, i) => mkNode('p' + i, p.type, p.name, p.mass, p.cg));
    const si = cp._mntToSI(cp._mntGatherForSolver(), 9.81);
    const mp = core.combineMassProps(si.components);
    expect(mp.I_G[1][1]).toBeGreaterThan(TOP_GROUP.I[1] * 0.95);
    expect(mp.I_G[1][1]).toBeLessThan(TOP_GROUP.I[1] * 1.05);
    expect(mp.I_G[2][2]).toBeGreaterThan(TOP_GROUP.I[2] * 0.95);
    expect(mp.I_G[0][0]).toBeCloseTo(0, 6);   // hepsi aynı y,z → x ekseni ataleti yok
  });

  test('toplu giriş (PTO Toplam) → aynı kütle+CG, ayrıca grup ataleti taşınır', () => {
    global.nodes = [mkNode('g1', 'mnt-pto-group', 'Üst PTO Grubu', TOP_GROUP.mass, TOP_GROUP.cg,
      { pointMass: false, Ixx: TOP_GROUP.I[0], Iyy: TOP_GROUP.I[1], Izz: TOP_GROUP.I[2] })];
    const si = cp._mntToSI(cp._mntGatherForSolver(), 9.81);
    const mp = core.combineMassProps(si.components);
    expect(mp.m).toBeCloseTo(TOP_GROUP.mass, 6);
    expect(mp.cg[0] * 1000).toBeCloseTo(TOP_GROUP.cg[0], 3);
    expect(mp.I_G[0][0]).toBeCloseTo(TOP_GROUP.I[0], 6);
    expect(mp.I_G[1][1]).toBeCloseTo(TOP_GROUP.I[1], 6);
    expect(mp.I_G[2][2]).toBeCloseTo(TOP_GROUP.I[2], 6);
  });
});

describe('Çift-sayım koruması', () => {
  test('yalnız bir giriş yolu varsa çakışma yok', () => {
    global.nodes = TOP_PARTS.map((p, i) => mkNode('p' + i, p.type, p.name, p.mass, p.cg));
    expect(cp._mntPtoConflict()).toBeNull();
    global.nodes = [mkNode('g1', 'mnt-pto-group', 'Grup', 97, TOP_GROUP.cg)];
    expect(cp._mntPtoConflict()).toBeNull();
  });

  test('iki yol birlikte → çakışma bildirilir ve doğrulama uyarısı üretir', () => {
    global.nodes = TOP_PARTS.map((p, i) => mkNode('p' + i, p.type, p.name, p.mass, p.cg))
      .concat([mkNode('g1', 'mnt-pto-group', 'Üst PTO Grubu', 97, TOP_GROUP.cg)]);
    const cf = cp._mntPtoConflict();
    expect(cf).not.toBeNull();
    expect(cf.groups).toEqual(['Üst PTO Grubu']);
    expect(cf.parts).toHaveLength(4);
    const warns = cp._mntExampleValidate();
    expect(warns.some((w) => /iki kez sayılıyor/.test(w.msg))).toBe(true);
  });
});

describe('Destek bağlantıları — taşınan gövde kuralı', () => {
  const L = (id, kind, lx, ly) => ({ id, kind, lx, ly });

  test('PTO/Pompa en yakın ANA gövdeye bağlanır (şanzımana asılır)', () => {
    const { links } = cp._mntComputeSupportLinks([
      L('motor', 'mnt-motor', 0, 0),
      L('gbx', 'mnt-gearbox', 300, 0),
      L('pto', 'mnt-pto', 320, 90),
      L('pmp', 'mnt-pump', 360, 90),
    ]);
    const to = (id) => (links.find((l) => l.from === id) || {}).to;
    expect(to('pto')).toBe('gbx');
    expect(to('pmp')).toBe('gbx');
  });

  test('takoz ASLA PTO/Pompa\'ya asılmaz — en yakın olsa bile ana gövdeye gider', () => {
    const { links } = cp._mntComputeSupportLinks([
      L('gbx', 'mnt-gearbox', 300, 0),
      L('pto', 'mnt-pto', 100, 100),      // takoza çok daha yakın
      L('mnt', 'mnt-mount', 95, 105),
    ]);
    expect((links.find((l) => l.from === 'mnt') || {}).to).toBe('gbx');
  });

  test('ana gövde yoksa PTO bağlantısız kalır (çökme yok)', () => {
    const { links } = cp._mntComputeSupportLinks([L('pto', 'mnt-pto', 0, 0)]);
    expect(links).toHaveLength(0);
  });
});

describe('Referans tablosu ASR-SR-116 ile aynı', () => {
  // Panelde gösterilen değerler rapordan ELLE kopyalandı; bir hane kayarsa
  // kullanıcı yanlış mertebeyi referans alır. Kaynağa karşı kilitlenir.
  const num = (s) => Number(String(s).replace('−', '-').replace(',', '.'));

  test('parça satırları Tablo 4 ile birebir', () => {
    const pto = cp._MNT_PTO_REF['mnt-pto'].rows.map((r) => r.map(num).slice(1));
    expect(pto).toEqual([[25, 741.21, 77.01, 894.73], [25, 741.21, -269.52, 473.30]]);
    const pump = cp._MNT_PTO_REF['mnt-pump'].rows.map((r) => r.map(num).slice(1));
    expect(pump).toEqual([
      [37, 971.21, 77.01, 894.73],
      [17.5, 1271.20, 77.01, 894.73],
      [17.5, 1481.21, 77.01, 894.73],
      [21, 991.21, -269.52, 473.30]]);
    // parça kütleleri grup toplamlarını vermeli (Tablo 2): üst 97, yan 46
    expect(pto[0][0] + pump[0][0] + pump[1][0] + pump[2][0]).toBe(97);
    expect(pto[1][0] + pump[3][0]).toBe(46);
  });

  test('grup satırları Tablo 2 + Tablo 3 ile birebir', () => {
    const g = cp._MNT_PTO_REF['mnt-pto-group'].rows.map((r) => r.map(num).slice(1));
    expect(g).toEqual([
      [97, 1058.06, 77.01, 894.73, 0.45, 6.515, 6.15],
      [46, 855.34, -269.52, 473.30, 0.136, 0.915, 0.915]]);
  });
});

describe('Panel (smoke)', () => {
  test('üç tip de panel üretir; PTO şeridi ve referans tablosu görünür', () => {
    ['mnt-pto', 'mnt-pump', 'mnt-pto-group'].forEach((t) => {
      const html = cp.getMntMassPropertiesHTML({ id: 'n1', type: t, def: componentDefs[t], data: {} });
      expect(html).toContain('PTO Grubu');
      expect(html).toContain('ASR-SR-116');
      expect(html.length).toBeGreaterThan(500);
    });
  });

  test('nokta-kütle varsayılanı: PTO/Pompa açık, PTO Toplam kapalı', () => {
    const d = (t) => { const n = { id: 'x', type: t, def: componentDefs[t], data: {} };
      cp.getMntMassPropertiesHTML(n); return n.data.pointMass; };
    expect(d('mnt-pto')).toBe(true);
    expect(d('mnt-pump')).toBe(true);
    expect(d('mnt-pto-group')).toBe(false);   // grup ataleti taşır
    expect(d('mnt-shaft')).toBe(true);        // regresyon: şaft davranışı korundu
    expect(d('mnt-motor')).toBe(false);
  });

  test('çakışma varsa panelde uyarı basılır', () => {
    global.nodes = [mkNode('p0', 'mnt-pto', 'PTO', 25, TOP_PARTS[0].cg),
                    mkNode('g1', 'mnt-pto-group', 'Grup', 97, TOP_GROUP.cg)];
    const html = cp.getMntMassPropertiesHTML(global.nodes[0]);
    expect(html).toContain('Kütle iki kez sayılıyor olabilir');
  });
});
