/**
 * cp-mount.test.js — Takoz Çökme-Titreşim GERÇEK KANVAS BİLEŞENLERİ
 *
 * Yeni mimari: Motor/Şanzıman/Şaft/Braket/Kütle + Takoz bileşenleri normal
 * kanvasta Çözücü'ye bağlanır; Çözücü connections'tan okuyup OTOMATİK yük
 * durumlarıyla analiz eder. Burada panel üreticileri, kütüphane, otomatik yük
 * durumları ve EN ÖNEMLİSİ "bağlı node'lar → _mntGatherForSolver → _mntToSI →
 * çekirdek" köprüsü TTAR ile T1/T3/T6'ya karşı doğrulanır.
 */
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const cp = require('../../js/cp-mount.js');

// TTAR (UI birimleri) → gerçek node + connection topolojisi (hepsi Çözücü'ye bağlı)
function buildTTARTopology() {
  const EX = core.TTAR_EXAMPLE;
  const nodes = [];
  const connections = [];
  const solver = { id: 'sv', type: 'mnt-solver', def: { name: 'Takoz Çözücü', isMountSolver: true }, data: {} };
  let c = 0;
  EX.components.forEach(cp0 => {
    const kind = /motor/i.test(cp0.name) ? 'mnt-motor' : /şanz|sanz/i.test(cp0.name) ? 'mnt-gearbox'
      : /şaft|saft|shaft/i.test(cp0.name) ? 'mnt-shaft' : /cradle|braket/i.test(cp0.name) ? 'mnt-bracket' : 'mnt-transfer';
    const id = 'm' + (++c);
    nodes.push({ id, type: kind, customName: cp0.name, def: { name: cp0.name, isMountBody: true },
      data: { mass: cp0.mass, cgx: cp0.cg[0], cgy: cp0.cg[1], cgz: cp0.cg[2], Ixx: cp0.Ixx, Iyy: cp0.Iyy, Izz: cp0.Izz, Ixy: cp0.Ixy, Ixz: cp0.Ixz, Iyz: cp0.Iyz, pointMass: !!cp0.pointMass } });
    connections.push({ id: 'c' + c, from: id, to: solver.id, fromPort: 'output', toPort: 'input' });
  });
  EX.mounts.forEach(m => {
    const id = 'm' + (++c);
    nodes.push({ id, type: 'mnt-mount', customName: m.name, def: { name: m.name, isMount: true },
      data: { x: m.pos[0], y: m.pos[1], z: m.pos[2], kxs: m.kstat[0], kys: m.kstat[1], kzs: m.kstat[2], kxd: m.kdyn[0], kyd: m.kdyn[1], kzd: m.kdyn[2] } });
    connections.push({ id: 'c' + c, from: id, to: solver.id, fromPort: 'output', toPort: 'input' });
  });
  nodes.push(solver);
  return { nodes, connections, solver };
}

describe('Ana modül (alt-sistem) paneli', () => {
  test('getMntModulePropertiesHTML "Alt Topolojiyi Aç" düğmesi verir', () => {
    const node = { id: 'comp-1', type: 'mount-analysis', def: { name: 'Takoz Çökme-Titreşim' }, data: {} };
    const html = cp.getMntModulePropertiesHTML(node);
    expect(html).toContain("veMntOpenEditor('comp-1')");
    expect(html).toContain('alt topolojisine');
  });
  test('başlatılmış alt-topoloji özeti bileşen/bağlantı sayısını gösterir', () => {
    const node = { id: 'comp-2', type: 'mount-analysis', data: { subTopology: { nodes: [{}, {}, {}], connections: [{}, {}] } } };
    const html = cp.getMntModulePropertiesHTML(node);
    expect(html).toContain('>3<'); // 3 bileşen
    expect(html).toContain('>2<'); // 2 bağlantı
  });
});

describe('Panel üreticileri', () => {
  test('Kütle paneli: kütle/CG/atalet alanları + nokta-kütle', () => {
    const node = { id: 'n1', type: 'mnt-motor', def: { name: 'Motor (Kütle)' }, data: {} };
    const html = cp.getMntMassPropertiesHTML(node);
    expect(html).toContain('Kütle');
    expect(html).toContain('ve-mnt-mass-n1');
    expect(html).toContain('ve-mnt-cgx-n1');
    expect(html).toContain('Nokta kütle');
    expect(html).toContain('Atalet Tensörü'); // pointMass false → atalet görünür
  });
  test('Şaft varsayılan nokta-kütle (atalet gizli)', () => {
    const node = { id: 'n2', type: 'mnt-shaft', def: { name: 'Şaft (Kütle)' }, data: {} };
    const html = cp.getMntMassPropertiesHTML(node);
    expect(node.data.pointMass).toBe(true);
    expect(html).not.toContain('Atalet Tensörü');
  });
  test('Takoz paneli: konum + rijitlik + kütüphane', () => {
    const node = { id: 'm1', type: 'mnt-mount', def: { name: 'Takoz' }, data: {} };
    const html = cp.getMntMountPropertiesHTML(node);
    expect(html).toContain('ve-mnt-x-m1');
    expect(html).toContain('ve-mnt-kzs-m1');
    expect(html).toContain('AMC 55 ShA');
    expect(html).toContain("veMntApplyLib('m1'");
  });
  test('Çözücü paneli: Hesapla + sonuç kabı', () => {
    const node = { id: 'sv', type: 'mnt-solver', def: { name: 'Takoz Çözücü' }, data: {} };
    const html = cp.getMntSolverPropertiesHTML(node);
    expect(html).toContain("veMntSolverCompute('sv')");
    expect(html).toContain('ve-mnt-results');
    expect(html).toContain('otomatik');
  });
});

describe('Otomatik yük durumları (kullanıcı girişi yok)', () => {
  test('6 g-tabanlı standart durum, tork gerektirmez', () => {
    expect(cp.MNT_AUTO_CASES).toHaveLength(6);
    expect(cp.MNT_AUTO_CASES[0]).toEqual({ name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
    expect(cp.MNT_AUTO_CASES.every(c => c.T[0] === 0 && c.T[1] === 0 && c.T[2] === 0)).toBe(true);
    expect(cp.MNT_AUTO_CASES.map(c => c.name)).toEqual(['Static', 'Max Bump', 'Acceleration', 'Braking', 'Cornering L', 'Cornering R']);
  });
});

describe('Takoz kütüphanesi', () => {
  test('AMC 55 ShA doğru rijitlikler', () => {
    const m = cp.VE_MOUNT_LIBRARY['amc55sha'];
    expect([m.sx, m.sy, m.sz]).toEqual([1252, 1252, 640]);
    expect([m.dx, m.dy, m.dz]).toEqual([2055, 2055, 977]);
  });
});

describe('Takoz Özellikleri (mnt-library — kullanıcı tanımlı katalog)', () => {
  afterEach(() => { delete global.nodes; });

  test('kütüphane düğümü yokken birleşik liste yalnız gömülü katalogdur', () => {
    delete global.nodes;
    const list = cp.veMntGetLibraryList();
    expect(list).toHaveLength(3);
    expect(list.every(e => e.builtin)).toBe(true);
    expect(list.map(e => e.key)).toContain('amc55sha');
  });

  test('veMntLibAdd özel takoz ekler; birleşik listede "Özel" olarak görünür', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: { isMountLibrary: true }, data: {} };
    global.nodes = [lib];
    cp.veMntLibAdd('lib1');
    expect(lib.data.mounts).toHaveLength(1);
    const list = cp.veMntGetLibraryList();
    expect(list).toHaveLength(4); // 3 gömülü + 1 özel
    const custom = list.filter(e => !e.builtin);
    expect(custom).toHaveLength(1);
    expect(custom[0].name).toContain('Yeni Takoz');
  });

  test('veMntLibSet ad ve rijitlikleri günceller (virgüllü ondalık dahil)', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: { isMountLibrary: true }, data: {} };
    global.nodes = [lib];
    cp.veMntLibAdd('lib1');
    const key = lib.data.mounts[0].key;
    cp.veMntLibSet('lib1', key, 'name', 'Özel A');
    cp.veMntLibSet('lib1', key, 'sz', '1500');
    cp.veMntLibSet('lib1', key, 'dz', '2,5'); // virgüllü → 2.5
    const e = lib.data.mounts[0];
    expect(e.name).toBe('Özel A');
    expect(e.sz).toBe(1500);
    expect(e.dz).toBeCloseTo(2.5);
  });

  test('veMntLibRemove yalnız hedef takozu siler', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: { isMountLibrary: true }, data: {} };
    global.nodes = [lib];
    cp.veMntLibAdd('lib1');
    cp.veMntLibAdd('lib1');
    const key = lib.data.mounts[0].key;
    cp.veMntLibRemove('lib1', key);
    expect(lib.data.mounts).toHaveLength(1);
    expect(lib.data.mounts.find(e => e.key === key)).toBeUndefined();
  });

  test('getMntLibraryPropertiesHTML: ekle butonu + özel satır + gömülü katalog', () => {
    const lib = {
      id: 'lib1', type: 'mnt-library', def: { isMountLibrary: true },
      data: { mounts: [{ key: 'k1', name: 'Deneme', sx: 100, sy: 100, sz: 200, dx: 150, dy: 150, dz: 300 }] }
    };
    global.nodes = [lib];
    const html = cp.getMntLibraryPropertiesHTML(lib);
    expect(html).toContain("veMntLibAdd('lib1')");
    expect(html).toContain('Gömülü Katalog');
    expect(html).toContain('AMC 55 ShA');               // gömülü satır (salt-okunur)
    expect(html).toContain('value="Deneme"');           // özel satır ad girdisi
    expect(html).toContain("veMntLibRemove('lib1','k1')");
    expect(html).toContain("veMntLibSet('lib1','k1','sz'");
  });

  test('özel takoz Takoz açılır listesinde çıkar ve veMntApplyLib ile uygulanır', () => {
    const lib = {
      id: 'lib1', type: 'mnt-library', def: { isMountLibrary: true },
      data: { mounts: [{ key: 'kX', name: 'Kullanıcı Takoz', sx: 111, sy: 222, sz: 333, dx: 444, dy: 555, dz: 666 }] }
    };
    const mount = { id: 'm9', type: 'mnt-mount', def: { name: 'Takoz', isMount: true }, data: {} };
    global.nodes = [lib, mount];
    const dd = cp.getMntMountPropertiesHTML(mount);
    expect(dd).toContain('Özel (Takoz Özellikleri)');
    expect(dd).toContain('Kullanıcı Takoz');
    cp.veMntApplyLib('m9', 'kX');
    expect(mount.data.kzs).toBe(333);
    expect(mount.data.kzd).toBe(666);
    expect(mount.data.libKey).toBe('kX');
  });

  test('veMntLibSetBuiltin gömülü takozu düzenler; fabrika sabiti mutasyona uğramaz', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: { isMountLibrary: true }, data: {} };
    global.nodes = [lib];
    cp.veMntLibSetBuiltin('lib1', 'amc55sha', 'sz', '999');
    cp.veMntLibSetBuiltin('lib1', 'amc55sha', 'name', 'AMC 55 ShA (özel)');
    // override node'da alan-bazlı saklanır
    expect(lib.data.overrides.amc55sha.sz).toBe(999);
    expect(lib.data.overrides.amc55sha.name).toBe('AMC 55 ShA (özel)');
    // fabrika sabiti DEĞİŞMEZ
    expect(cp.VE_MOUNT_LIBRARY['amc55sha'].sz).toBe(640);
    expect(cp.VE_MOUNT_LIBRARY['amc55sha'].name).toBe('AMC 55 ShA');
    // birleşik harita override'ı yansıtır; düzenlenmemiş alanlar fabrikayı izler
    const m = cp.veMntGetLibraryMap()['amc55sha'];
    expect(m.sz).toBe(999);
    expect(m.name).toBe('AMC 55 ShA (özel)');
    expect(m.sx).toBe(1252);       // düzenlenmemiş → fabrika
    expect(m.builtin).toBe(true);
    expect(m.overridden).toBe(true);
  });

  test('düzenlenen gömülü takoz veMntApplyLib ile yeni değeri uygular', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: { isMountLibrary: true }, data: {} };
    const mount = { id: 'm9', type: 'mnt-mount', def: { name: 'Takoz', isMount: true }, data: {} };
    global.nodes = [lib, mount];
    cp.veMntLibSetBuiltin('lib1', 'amc55sha', 'sz', '999');
    cp.veMntApplyLib('m9', 'amc55sha');
    expect(mount.data.kzs).toBe(999);     // override değeri
    expect(mount.data.kxs).toBe(1252);    // düzenlenmemiş → fabrika
  });

  test('veMntLibResetBuiltin override siler; gömülü fabrika değerine döner', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: { isMountLibrary: true }, data: {} };
    global.nodes = [lib];
    cp.veMntLibSetBuiltin('lib1', 'amc55sha', 'sz', '999');
    expect(cp.veMntGetLibraryMap()['amc55sha'].overridden).toBe(true);
    cp.veMntLibResetBuiltin('lib1', 'amc55sha');
    expect(lib.data.overrides.amc55sha).toBeUndefined();
    const m = cp.veMntGetLibraryMap()['amc55sha'];
    expect(m.sz).toBe(640);               // fabrikaya döndü
    expect(m.overridden).toBe(false);
  });

  test('getMntLibraryPropertiesHTML: gömülü satırlar düzenlenebilir + ↺ butonu', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: { isMountLibrary: true }, data: {} };
    global.nodes = [lib];
    const html = cp.getMntLibraryPropertiesHTML(lib);
    expect(html).toContain("veMntLibSetBuiltin('lib1','amc55sha','sz'");
    expect(html).toContain("veMntLibResetBuiltin('lib1','amc55sha')");
    expect(html).toContain('value="AMC 55 ShA"');   // gömülü ad artık input değeri
  });
});

describe('Çözücü otomatik algılama (bağlantı gerekmez) → gather → çekirdek — TTAR', () => {
  const topo = buildTTARTopology();
  beforeEach(() => { global.nodes = topo.nodes; global.connections = topo.connections; });

  test('_mntGatherForSolver iç topolojideki tüm kütle+takozları toplar', () => {
    const g = cp._mntGatherForSolver(topo.solver);
    expect(g.components).toHaveLength(5);
    expect(g.mounts).toHaveLength(6);
  });
  test('BAĞLANTISIZ node da algılanır (otomatik algılama)', () => {
    global.connections = []; // hiç bağlantı yok
    const g = cp._mntGatherForSolver(topo.solver);
    expect(g.components).toHaveLength(5); // bağlantı olmadan da hepsi
    expect(g.mounts).toHaveLength(6);
  });
  test('eklenen her kütle gövdesi bağlantısız da dahil olur', () => {
    global.nodes = topo.nodes.concat([{ id: 'extra', type: 'mnt-transfer', def: { isMountBody: true }, data: { mass: 120, cgx: 0, cgy: 0, cgz: 0, pointMass: true } }]);
    global.connections = [];
    const g = cp._mntGatherForSolver(topo.solver);
    expect(g.components).toHaveLength(6); // yeni Transfer Kutusu bağlanmadan algılandı
  });

  test('T1 — kütle birleştirme (2294.522 kg)', () => {
    const si = cp._mntToSI(cp._mntGatherForSolver(topo.solver), 9.81);
    const mp = core.combineMassProps(si.components);
    expect(mp.m).toBeCloseTo(2294.522, 2);
    expect(mp.cg[0] * 1000).toBeCloseTo(254.669, 2);
    expect(mp.cg[2] * 1000).toBeCloseTo(746.052, 2);
  });
  test('T3 — Static durumu (sağ ön δz=-3.941, ΣFz ✓)', () => {
    const si = cp._mntToSI(cp._mntGatherForSolver(topo.solver), 9.81);
    const mp = core.combineMassProps(si.components);
    const Kstat = core.buildK(si.mounts, mp.cg, false);
    // si.loadCases[0] otomatik 'Static'
    const res = core.solveCase(Kstat, si.mounts, mp.cg, mp.m, si.g, si.loadCases[0]);
    expect(res.perMount[0].delta[2] * 1000).toBeCloseTo(-3.941, 2);
    expect(res.checks.sumFzOk).toBe(true);
  });
  test('T6 — modal frekanslar', () => {
    const si = cp._mntToSI(cp._mntGatherForSolver(topo.solver), 9.81);
    const mp = core.combineMassProps(si.components);
    const Kdyn = core.buildK(si.mounts, mp.cg, true);
    const M6 = core.buildM6(mp.m, mp.I_G);
    const modes = core.solveModal(Kdyn, M6, si.mounts, mp.cg);
    const expF = [5.039, 6.111, 8.364, 10.148, 12.071, 21.239];
    modes.forEach((md, i) => expect(md.f_Hz).toBeCloseTo(expF[i], 2));
  });
  test('otomatik yük durumları çözücüde uygulanır (6 durum)', () => {
    const si = cp._mntToSI(cp._mntGatherForSolver(topo.solver), 9.81);
    expect(si.loadCases).toHaveLength(6);
    const mp = core.combineMassProps(si.components);
    const model = { m: mp.m, cg: mp.cg, Kstat: core.buildK(si.mounts, mp.cg, false), mounts: si.mounts, g: si.g };
    const rows = core.solveAllCases(model, si.loadCases);
    expect(rows).toHaveLength(6);
    rows.forEach(r => expect(r.res).not.toBeNull());
  });
});

describe('Renk skalaları', () => {
  test('eşikler', () => {
    expect(cp._mntDeflColor(0.2)).toBe('#22c55e');
    expect(cp._mntDeflColor(15)).toBe('#ef4444');
    expect(cp._mntForceColor(25)).toBe('#f97316');
  });
});

describe('Estetik paneller — yan yana alanlar', () => {
  test('Kütle paneli CG/atalet alanlarını 3\'lü inline id ile üretir', () => {
    const node = { id: 'n9', type: 'mnt-motor', def: { name: 'Motor (Kütle)' }, data: {} };
    const html = cp.getMntMassPropertiesHTML(node);
    // CG x/y/z + atalet köşegen/çarpım hepsi id'li input
    ['cgx','cgy','cgz','Ixx','Iyy','Izz','Ixy','Ixz','Iyz','mass'].forEach(k =>
      expect(html).toContain('ve-mnt-' + k + '-n9'));
    // Yan yana flex düzeni
    expect(html).toContain('display:flex');
    expect(html).toContain('Ağırlık Merkezi');
  });
  test('Takoz paneli konum + statik/dinamik rijitliği yan yana id ile üretir', () => {
    const node = { id: 'm9', type: 'mnt-mount', def: { name: 'Takoz' }, data: {} };
    const html = cp.getMntMountPropertiesHTML(node);
    ['x','y','z','kxs','kys','kzs','kxd','kyd','kzd'].forEach(k =>
      expect(html).toContain('ve-mnt-' + k + '-m9'));
    expect(html).toContain('Statik Rijitlik');
    expect(html).toContain('Dinamik Rijitlik');
  });
});

describe('Starter yerleşim (modül açılınca hazır bileşenler)', () => {
  test('fiziksel + takoz + Çözücü + analiz araçları', () => {
    const L = cp.VE_MNT_STARTER_LAYOUT;
    expect(L.filter(i => i.type === 'mnt-mount')).toHaveLength(5);
    expect(L.filter(i => i.type === 'mnt-solver')).toHaveLength(1);
    expect(L.map(i => i.type)).toEqual(expect.arrayContaining(['mnt-motor', 'mnt-gearbox', 'mnt-transfer', 'mnt-shaft']));
    // referans görseldeki analiz araçları da starter'da (image 1)
    expect(L.map(i => i.type)).toEqual(expect.arrayContaining(['mnt-coordframe', 'mnt-library', 'mnt-viewer', 'mnt-2dview', 'mnt-example']));
  });
  test('takoz adları referans görsel ile aynı (5 adet)', () => {
    const names = cp.VE_MNT_STARTER_LAYOUT.filter(i => i.type === 'mnt-mount').map(i => i.name).sort();
    expect(names).toEqual(['Sağ Arka Takoz', 'Sağ Yan Takoz', 'Sol Arka Takoz', 'Sol Yan Takoz', 'Ön Takoz'].sort());
  });
  test('kütle gövdesi adlarında "(Kütle)" son eki yok', () => {
    const bodyNames = cp.VE_MNT_STARTER_LAYOUT
      .filter(i => /mnt-(motor|gearbox|shaft|transfer)/.test(i.type) && i.name)
      .map(i => i.name);
    bodyNames.forEach(n => expect(n).not.toMatch(/\(Kütle\)/));
  });
});

describe('Örnek bileşeni', () => {
  test('panel: örnek seçici + Topolojiye Yükle düğmesi', () => {
    const node = { id: 'ex1', type: 'mnt-example', def: { name: 'Örnek' }, data: {} };
    const html = cp.getMntExamplePropertiesHTML(node);
    expect(html).toContain('ve-mnt-example-sel');
    expect(html).toContain("veMntLoadExample('ex1')");
    expect(html).toContain('BMC SİPER');
    expect(html).toContain('ve-mnt-example-report');
  });
  test('örnek adı → kanvas kütle tipi eşlemesi', () => {
    expect(cp._mntExampleBodyType('Motor')).toBe('mnt-motor');
    expect(cp._mntExampleBodyType('Şanzıman')).toBe('mnt-gearbox');
    expect(cp._mntExampleBodyType('Şaft payı')).toBe('mnt-shaft');
    expect(cp._mntExampleBodyType('Sol cradle')).toBe('mnt-bracket');
    expect(cp._mntExampleBodyType('Transfer Kutusu')).toBe('mnt-transfer');
  });
  test('panel: topoloji görseli + araç detayları + Örneği Aktar', () => {
    const node = { id: 'ex1', type: 'mnt-example', def: { name: 'Örnek' }, data: {} };
    const html = cp.getMntExamplePropertiesHTML(node);
    expect(html).toContain('veMntSetExample(\'ex1\'');   // seçici canlı yenileme
    expect(html).toContain('<svg');                       // otomatik topoloji şeması
    expect(html).toContain('BMC Siper');                  // araç başlığı (detay)
    expect(html).toContain('Örneği Aktar');               // aktar düğmesi
  });
  test('kayıt defteri: bilinen anahtar çözülür, bilinmeyen ilk örneğe düşer', () => {
    const first = core.getMountExampleList()[0];
    expect(core.getMountExample('siper').id).toBe('siper');
    expect(core.getMountExample('yok-boyle-anahtar').id).toBe(first.id);  // bilinmeyen → ilk örnek
    expect(core.getMountExampleList().length).toBeGreaterThanOrEqual(1);
    expect(cp._mntExampleReg('siper').model).toBe(core.getMountExample('siper').model);
  });
  test('yerleşim: otomatik (orta sıra kütle, alt/üst takoz) + at[] override', () => {
    const L = cp._mntExampleLayout(core.TTAR_EXAMPLE);
    expect(L.bodies).toHaveLength(core.TTAR_EXAMPLE.components.length);
    expect(L.mnts).toHaveLength(core.TTAR_EXAMPLE.mounts.length);
    // kütleler tek sırada (aynı ly); ilk takoz üst, sonuncusu alt sırada
    expect(L.bodies.every(b => b.ly === L.bodies[0].ly)).toBe(true);
    expect(L.mnts[0].ly).toBeLessThan(L.bodyY);
    expect(L.mnts[L.mnts.length - 1].ly).toBeGreaterThan(L.bodyY);
    // at[] override → görsele birebir uyum
    const custom = { components: [{ name: 'X', at: [11, 22] }], mounts: [{ name: 'M', at: [33, 44] }] };
    const L2 = cp._mntExampleLayout(custom);
    expect(L2.bodies[0]).toEqual({ lx: 11, ly: 22 });
    expect(L2.mnts[0]).toEqual({ lx: 33, ly: 44 });
  });
  test('otomatik şema: model bileşen adlarını içeren tema-uyumlu SVG üretir', () => {
    const svg = cp._mntExampleDiagramSVG(core.TTAR_EXAMPLE);
    expect(svg).toMatch(/^<svg[\s\S]*<\/svg>$/);
    expect(svg).toContain('Motor');
    expect(svg).toContain('var(--accent-success)');  // takoz rengi (tema değişkeni)
    expect(cp._mntExampleDiagramSVG(null)).toBe('');  // model yoksa boş
  });
  test('BMC Siper örneği: 5 kütle + 6 takoz, doğru gövde eşlemesi, 2294.5 kg', () => {
    const ex = core.getMountExample('siper');
    expect(ex.vehicle).toBe('BMC Siper');
    expect(ex.name).toContain('BMC SİPER');
    const m = ex.model;
    expect(m.components).toHaveLength(5);
    expect(m.mounts).toHaveLength(6);
    // toplam kütle ADAMS referansı (2294.482) ile birebir
    expect(m.components.reduce((s, c) => s + c.mass, 0)).toBeCloseTo(2294.52, 1);
    // bileşen adları → yükleyicinin kuracağı kanvas tipleri
    expect(m.components.map(c => cp._mntExampleBodyType(c.name)))
      .toEqual(['mnt-motor', 'mnt-gearbox', 'mnt-shaft', 'mnt-bracket', 'mnt-bracket']);
    // şaft nokta-kütle; tüm takozlar aynı statik/dinamik rijitlik
    expect(m.components[2].pointMass).toBe(true);
    expect(m.mounts.every(x => x.kstat[2] === 640 && x.kdyn[2] === 977)).toBe(true);
    expect(m.torque.Te).toBe(3000);
    // her gövde/takoz kullanıcı düzenine ait at:[lx,ly] taşır (görsel↔topoloji birebir)
    expect(m.components.every(c => Array.isArray(c.at) && c.at.length === 2)).toBe(true);
    expect(m.mounts.every(x => Array.isArray(x.at) && x.at.length === 2)).toBe(true);
    // önizleme sahnesinde yardımcı araçlar (tools) tanımlı
    expect(ex.tools.map(t => t.type)).toContain('mnt-solver');
    // panelde araç adı + otomatik şema görünür
    const html = cp.getMntExamplePropertiesHTML({ id: 'e', type: 'mnt-example', data: { exampleKey: 'siper' } });
    expect(html).toContain('BMC Siper');
    expect(html).toContain('<svg');
  });
  test('TTAR modeli (6 takoz) → "Fazla takoz" UYARI verir, hata değil', () => {
    const topo = buildTTARTopology();
    global.nodes = topo.nodes;
    global.connections = topo.connections;
    const w = cp._mntExampleValidate();
    const excess = w.find(x => /Fazla takoz/.test(x.msg));
    expect(excess).toBeTruthy();
    expect(excess.level).toBe('warn');
  });
  test('boş topoloji → eksik kütle + eksik takoz HATASI', () => {
    global.nodes = [];
    global.connections = [];
    const w = cp._mntExampleValidate();
    expect(w.some(x => /Kütle gövdesi yok/.test(x.msg) && x.level === 'err')).toBe(true);
    expect(w.some(x => /Takoz yok/.test(x.msg) && x.level === 'err')).toBe(true);
  });
});

describe('3D Görüntüleyici bileşeni', () => {
  test('panel: canvas + Yenile + interaktif kontroller + resize', () => {
    const node = { id: 'vw1', type: 'mnt-viewer', def: { name: '3D Görüntüleyici' }, data: {} };
    const html = cp.getMntViewerPropertiesHTML(node);
    expect(html).toContain('ve-mnt-inline-viewer-canvas');
    expect(html).toContain('veMntViewerRefresh()');
    expect(html).toContain('var(--bg-primary)');
    // interaktif: katman aç/kapa + sıfırla + büyüt + boyutlandırma
    expect(html).toContain("veMountViewerToggle('grid')");
    expect(html).toContain('veMountViewerReset()');
    // tam ekran (tüm pencereyi büyüt) + hover ipucu
    expect(html).toContain('veMntViewerFullscreen()');
    expect(html).toContain('bilgi');
    // Büyüt/resize kaldırıldı (kullanıcı isteği: iç 3D genişlemesi gereksiz)
    expect(html).not.toContain('veMntViewerExpand');
    expect(html).not.toContain('resize:vertical');
    // garip açıklama kutusu YOK
    expect(html).not.toContain('Aktif tema ile uyumlu');
  });
});

describe('2D Görünüm bileşeni', () => {
  afterEach(() => { delete global.nodes; });
  test('panel: diyagram kutusu + Yenile', () => {
    const html = cp.getMnt2DViewPropertiesHTML({ id: 'd1', type: 'mnt-2dview', def: {}, data: {} });
    expect(html).toContain('ve-mnt-2dview-box');
    expect(html).toContain('veMnt2DViewRefresh()');
    expect(html).toContain('veMnt2DViewFullscreen()');   // tam ekran
  });
  test('_mnt2DGather kütle-ağırlıklı birleşik CG hesaplar', () => {
    global.nodes = [
      { id: 'a', type: 'mnt-motor',   def: { isMountBody: true }, data: { mass: 100, cgx: 0,   cgy: 0, cgz: 0 } },
      { id: 'b', type: 'mnt-gearbox', def: { isMountBody: true }, data: { mass: 300, cgx: 200, cgy: 0, cgz: 0 } },
      { id: 'm', type: 'mnt-mount',   def: { isMount: true },     data: { x: 50, y: 10, z: 20 } }
    ];
    const d = cp._mnt2DGather();
    expect(d.comps).toHaveLength(2);
    expect(d.mounts).toHaveLength(1);
    expect(d.cg.x).toBeCloseTo(150, 3); // (100·0 + 300·200)/400 = 150
  });
  test('_mnt2DViewSVG: boş → mesaj, dolu → iki ölçekli görünüş', () => {
    expect(cp._mnt2DViewSVG({ comps: [], mounts: [], cg: null })).toMatch(/Görüntülenecek bileşen yok/);
    const svg = cp._mnt2DViewSVG({
      comps: [{ name: 'Motor', mass: 100, x: 0, y: 0, z: 100 }],
      mounts: [{ name: 'Ön Takoz', x: -50, y: 20, z: 30 }],
      cg: { x: 0, y: 0, z: 100, m: 100 }
    });
    expect(svg).toContain('<svg');
    expect(svg).toContain('Üstten Görünüş');
    expect(svg).toContain('Yandan Görünüş');
    expect(svg).toContain('<rect');       // takoz karesi / çerçeve
    expect(svg).toMatch(/Z\s*=\s*0/);     // zemin çizgisi etiketi
  });
});

describe('Koordinat Düzlemi bileşeni', () => {
  test('panel: 3B canvas + eksen açıklamaları + düzlem toggle', () => {
    const node = { id: 'cf1', type: 'mnt-coordframe', def: { name: 'Koordinat Düzlemi' }, data: {} };
    const html = cp.getMntCoordFramePropertiesHTML(node);
    expect(html).toContain('ve-mnt-coord-canvas');
    expect(html).toContain("veMountViewerToggle('planes')");
    expect(html).toContain('İleri–geri');   // X ekseni açıklaması
    expect(html).toContain('Yanal');        // Y ekseni açıklaması
    expect(html).toContain('Düşey');        // Z ekseni açıklaması
  });
});

describe('Kinematik girdiler + tork yük durumları', () => {
  test('Motor paneli tepe tork alanı içerir', () => {
    const node = { id: 'mo1', type: 'mnt-motor', def: { name: 'Motor (Kütle)' }, data: {} };
    const html = cp.getMntMassPropertiesHTML(node);
    expect(html).toContain('ve-mnt-Te-mo1');
    expect(html).toContain('Motor · Tahrik');
  });
  test('Şanzıman paneli vites oranları + stall içerir', () => {
    const node = { id: 'gb1', type: 'mnt-gearbox', def: { name: 'Şanzıman (Kütle)' }, data: {} };
    const html = cp.getMntMassPropertiesHTML(node);
    ['g1','g2','g6','gR','Rstall'].forEach(k => expect(html).toContain('ve-mnt-' + k + '-gb1'));
    expect(html).toContain('Vites Oranları');
  });
  test('Transfer paneli transfer oranı içerir', () => {
    const node = { id: 'tr1', type: 'mnt-transfer', def: { name: 'Transfer Kutusu' }, data: {} };
    const html = cp.getMntMassPropertiesHTML(node);
    expect(html).toContain('ve-mnt-iTransfer-tr1');
    expect(html).toContain('Transfer Kutusu');
  });
  test('Şaft/Braket kinematik bölüm göstermez', () => {
    const shaft = cp.getMntMassPropertiesHTML({ id: 's1', type: 'mnt-shaft', def: {}, data: {} });
    expect(shaft).not.toContain('Vites Oranları');
    expect(shaft).not.toContain('Motor / Tahrik');
  });

  test('_mntGatherTorque kütle gövdelerinden konumdan bağımsız toplar', () => {
    global.nodes = [
      { id: 'mo', type: 'mnt-motor',    def: { isMountBody: true }, data: { Te: 760 } },
      { id: 'gb', type: 'mnt-gearbox',  def: { isMountBody: true }, data: { g1: 3.10, gR: -4.49, Rstall: 1.58 } },
      { id: 'tr', type: 'mnt-transfer', def: { isMountBody: true }, data: { iTransfer: 3.428 } }
    ];
    const t = cp._mntGatherTorque();
    expect(Number(t.Te)).toBe(760);
    expect(Number(t.g1)).toBe(3.10);
    expect(Number(t.Rstall)).toBe(1.58);
    expect(Number(t.iTransfer)).toBe(3.428);
    delete global.nodes;
  });

  test('_mntTorqueCases TTAR kinematiğini çekirdek tork zinciriyle üretir', () => {
    const torque = { Te: 3000, Rstall: 1.62, g1: 3.51, gR: -4.8, iTransfer: 1.407, phiFwd: 1 / 3.6, phiRev: 2.6 / 3.6, derate: 1 };
    const cases = cp._mntTorqueCases(torque);
    expect(cases).toHaveLength(2);
    expect(cases[0].name).toBe('Forward Torque');
    expect(cases[0].T[0]).toBeCloseTo(-6667.07, 1);   // −T_shaft (ileri)
    expect(cases[1].name).toBe('Reverse Torque');
    expect(cases[1].T[0]).toBeCloseTo(23705.14, 1);   // −T_shaft (geri, negatif → +)
  });
  test('_mntTorqueCases eksik kinematikte boş döner', () => {
    expect(cp._mntTorqueCases({})).toHaveLength(0);
    expect(cp._mntTorqueCases({ Te: 760 })).toHaveLength(0); // Rstall/g1 yok
  });

  test('_mntToSI tork girildiğinde 8, girilmediğinde 6 yük durumu', () => {
    const withTq = cp._mntToSI({ components: [], mounts: [], torque: { Te: 760, Rstall: 1.58, g1: 3.10, gR: -4.49 } }, 9.81);
    expect(withTq.loadCases).toHaveLength(8);
    expect(withTq.loadCases.map(c => c.name)).toContain('Forward Torque');
    const noTq = cp._mntToSI({ components: [], mounts: [], torque: {} }, 9.81);
    expect(noTq.loadCases).toHaveLength(6);
  });
  test('MNT_AUTO_CASES mutasyona uğramaz (concat kopya)', () => {
    cp._mntToSI({ components: [], mounts: [], torque: { Te: 760, Rstall: 1.58, g1: 3.10 } }, 9.81);
    expect(cp.MNT_AUTO_CASES).toHaveLength(6);
  });
});

describe('Garip açıklamalar kaldırıldı (Adams dahil)', () => {
  test('Kütle/Takoz/Çözücü panellerinde Adams referansı yok', () => {
    const mass = cp.getMntMassPropertiesHTML({ id: 'a', type: 'mnt-motor', def: {}, data: {} });
    const mount = cp.getMntMountPropertiesHTML({ id: 'b', type: 'mnt-mount', def: {}, data: {} });
    const solver = cp.getMntSolverPropertiesHTML({ id: 'c', type: 'mnt-solver', def: {}, data: {} });
    [mass, mount, solver].forEach(h => expect(h).not.toMatch(/Adams/i));
  });
});
