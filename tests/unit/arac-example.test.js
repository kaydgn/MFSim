/**
 * arac-example.test.js
 * ────────────────────
 * "Araç Performans → Başlangıç ve Örnekler" (ap-example) kayıt defteri ve
 * yükleyicisi.
 *
 * Örnekler gerçek Allison iSCAAN raporlarından kuruldu; her girdi bir JSON
 * topolojiye işaret eder ve panel "Örneği Aktar" ile onu iç topolojiye kurar.
 * Sessizce bozulabilecek yer BURASI: kayıt defterindeki yol ile diskteki dosya
 * ayrışırsa panel çalışır ama örnek yüklenmez. Bu yüzden kapılar dosya
 * sisteminde doğrulanır.
 */
const fs = require('fs');
const path = require('path');

const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};

eval(loadSource('cp-arac-example.js'));

beforeEach(() => resetStubs(stubs));

const ROOT = path.join(__dirname, '..', '..');
const EXDIR = path.join(ROOT, 'assets', 'examples');
const list = veApExampleList();

describe('kayıt defteri bütünlüğü', () => {
  test('boş değil ve kimlikler benzersiz', () => {
    expect(list.length).toBeGreaterThan(5);
    const ids = list.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('her girdide zorunlu alanlar dolu', () => {
    list.forEach(e => {
      expect(typeof e.id).toBe('string');
      expect(e.id).toMatch(/^[a-z0-9_]+$/);
      expect(e.name && e.name.length).toBeTruthy();
      expect(e.vehicle && e.vehicle.length).toBeTruthy();
      expect(e.topology).toMatch(/^assets\/examples\/ap_.+\.json$/);
      expect(e.image).toMatch(/^assets\/examples\/ap_.+\.png$/);
      expect(Array.isArray(e.specs)).toBe(true);
      expect(e.specs.length).toBeGreaterThan(3);
    });
  });

  test('veApExample bilinmeyen kimlikte ilk girdiye düşer', () => {
    expect(veApExample('yok-boyle-bir-sey').id).toBe(list[0].id);
    expect(veApExample(list[2].id).id).toBe(list[2].id);
  });
});

describe('varlık dosyaları — kayıt defteri ile disk ayrışmasın', () => {
  test('her topology yolu diskte var ve geçerli JSON', () => {
    list.forEach(e => {
      const p = path.join(ROOT, e.topology);
      expect(fs.existsSync(p)).toBe(true);
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      expect(j.format).toBe('mfsim-arac-example');
      expect(Array.isArray(j.nodes)).toBe(true);
      expect(j.nodes.length).toBeGreaterThan(5);
      expect(Array.isArray(j.connections)).toBe(true);
      expect(j.connections.length).toBeGreaterThan(0);
    });
  });

  test('her görsel yolu diskte var', () => {
    list.forEach(e => expect(fs.existsSync(path.join(ROOT, e.image))).toBe(true));
  });

  test('öksüz dosya yok — assets/examples/ap_*.json hepsi kayıtlı', () => {
    const referenced = new Set(list.map(e => path.basename(e.topology)));
    const onDisk = fs.readdirSync(EXDIR).filter(f => /^ap_.*\.json$/.test(f));
    expect(onDisk.sort()).toEqual([...referenced].sort());
  });
});

describe('örnek topolojileri çalışır güç aktarma zinciri içeriyor', () => {
  const need = ['engine', 'torque-converter', 'gearbox', 'propshaft', 'transfer', 'differential', 'wheel', 'vehicle', 'solver'];

  test.each(list.map(e => [e.id, e]))('%s — zincir tam, master ★ tek', (_id, e) => {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, e.topology), 'utf8'));
    const types = j.nodes.map(n => n.type);
    need.forEach(t => expect(types).toContain(t));
    // Master bayrakları: tam bir tane olmalı, yoksa çözücü yanlış düğümü okur.
    expect(j.nodes.filter(n => n.isMasterWheel).length).toBe(1);
    expect(j.nodes.filter(n => n.isMasterDiff).length).toBe(1);
    // Örnek düğümünün kendisi topolojiye GÖMÜLMEZ (yükleyici gerektiğinde ekler).
    expect(types).not.toContain('ap-example');
    // arac-performans düğümü iç topolojide olmamalı (özyineleme olurdu)
    expect(types).not.toContain('arac-performans');
  });

  test.each(list.map(e => [e.id, e]))('%s — motor/TK/vites verisi dolu', (_id, e) => {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, e.topology), 'utf8'));
    const by = t => j.nodes.filter(n => n.type === t);
    const eng = by('engine')[0], tc = by('torque-converter')[0], gb = by('gearbox')[0];
    expect(eng.data.torqueData.length).toBeGreaterThan(5);
    expect(eng.data.motorSpecs.governedSpeed).toBeGreaterThan(500);
    expect(tc.data.tcData.length).toBeGreaterThan(5);
    // K-faktörü tablosu KESİN ARTAN sr istiyor (pchipCreate) — iSCAAN aynı sr'yi
    // iki kez basabildiği için burada da kapı var.
    const srs = tc.data.tcData.map(p => p.sr);
    for (let i = 1; i < srs.length; i++) expect(srs[i]).toBeGreaterThan(srs[i - 1]);
    expect(gb.data.ftGearData.length).toBeGreaterThanOrEqual(6);
    expect(gb.data.ftGearData[0].ratio).toBeGreaterThan(gb.data.ftGearData[gb.data.ftGearData.length - 1].ratio);
  });

  test.each(list.map(e => [e.id, e]))('%s — transfer kademeleri hızlıdan yavaşa sıralı', (_id, e) => {
    // MFSim ftTrGears[0]'ı hızlı kademe sayıyor (veResolveTransferRoles bunu
    // orandan da düzeltiyor, ama örnek dosyaları doğru sırayla üretilmeli).
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, e.topology), 'utf8'));
    const tr = j.nodes.find(n => n.type === 'transfer');
    const g = tr.data.ftTrGears;
    for (let i = 1; i < g.length; i++) expect(g[i].ratio).toBeGreaterThan(g[i - 1].ratio);
  });
});

describe('_apTopoState — biçim çözümü', () => {
  test('örnek biçimi (nodes/connections) doğrudan duruma çevrilir', () => {
    const st = _apTopoState({ format: 'mfsim-arac-example', nodes: [{ id: 'a', type: 'engine' }], connections: [] });
    expect(st.nodes.length).toBe(1);
    expect(st.undoStack).toEqual([]);
    expect(st.simResults).toBeNull();
  });

  test('tam proje kaydından arac-performans alt topolojisi çıkarılır', () => {
    const sub = { nodes: [{ id: 'x', type: 'engine' }], connections: [] };
    const st = _apTopoState({ tabs: [{ state: { nodes: [{ type: 'arac-performans', data: { subTopology: sub } }] } }] });
    expect(st).toBeTruthy();
    expect(st.nodes[0].id).toBe('x');
  });

  test('boş/geçersiz girdi null döner (kırık örnek sessizce yüklenmesin)', () => {
    expect(_apTopoState(null)).toBeNull();
    expect(_apTopoState({})).toBeNull();
    expect(_apTopoState({ tabs: [] })).toBeNull();
    expect(_apTopoState({ tabs: [{ state: { nodes: [{ type: 'vehicle' }] } }] })).toBeNull();
  });
});

describe('panel — üretiliyor ve patlamıyor', () => {
  // Test politikası: sunum fonksiyonu için etiket etiket assertion AÇMA;
  // panel başına tek smoke testi + kablolamanın varlığı yeter.
  test('bütün girdiler seçenek olarak listeleniyor, düğmeler kablolu', () => {
    const html = getApExamplePropertiesHTML({ id: 'comp-1', data: {} });
    expect(html.length).toBeGreaterThan(500);
    expect((html.match(/<option /g) || []).length).toBe(list.length);
    expect(html).toContain('veApLoadExample');
    expect(html).toContain('veApExportTopology');
  });

  test('seçili örnek node.data.exampleKey ile değişiyor', () => {
    const target = list[list.length - 1];
    const html = getApExamplePropertiesHTML({ id: 'comp-1', data: { exampleKey: target.id } });
    expect(html).toContain(target.vehicle);
    expect(html).toContain(target.image);
  });

  test('uyarılı örnekler panelde uyarı bloğu gösteriyor', () => {
    const warned = list.filter(e => e.warning);
    expect(warned.length).toBeGreaterThan(0);          // en az bir kayıt uyarılı
    warned.forEach(e => {
      const html = getApExamplePropertiesHTML({ id: 'c', data: { exampleKey: e.id } });
      expect(html).toContain('Dikkat.');
    });
    // Uyarısız bir örnekte blok ÇIKMAMALI
    const clean = list.find(e => !e.warning);
    expect(getApExamplePropertiesHTML({ id: 'c', data: { exampleKey: clean.id } })).not.toContain('Dikkat.');
  });
});

describe('bileşen kablolaması', () => {
  const comps = loadSource('components.js');
  const core = loadSource('cp-core.js');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  test('ap-example bileşen tanımı ve modül listesinde', () => {
    expect(comps).toContain("'ap-example': {");
    expect(comps).toContain("'obstacle-crossing','ap-example'");
  });

  test('bağlantısız (standalone) sayılıyor — uyarı paneli şikayet etmesin', () => {
    expect(comps).toContain("VE_STANDALONE_TYPES = ['ap-example'");
  });

  test('özellik paneli yönlendirmesi bağlı', () => {
    expect(core).toContain("node.type === 'ap-example'");
    expect(core).toContain('getApExamplePropertiesHTML(node)');
  });

  test('kenar çubuğu girdisi ve script etiketi index.html’de', () => {
    expect(html).toContain('data-type="ap-example"');
    expect(html).toContain('js/cp-arac-example.js');
  });
});
