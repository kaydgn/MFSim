/**
 * arac-performans.test.js — "Araç Performans" alt-sistem (subsystem) düğümü
 *
 * "Araç Performans" bir composite düğümdür; çift tıklanınca kendi iç topolojisi
 * açılır. Bu testte:
 *  1) componentDefs['arac-performans'] kaydı (subsystem düğümü, 0 port),
 *  2) veAracPopulateStarter() — iç topolojiye kurulan BAŞLANGIÇ: yalnız
 *     "Başlangıç ve Örnekler" (ap-example) düğümü, bağlantı yok,
 *  3) getAracPerformansPropertiesHTML() — "Alt Topolojiyi Aç" butonu
 * doğrulanır. veAracPopulateStarter gerçek DOM'a değil global createNode'a
 * dayanır → mock'lanır.
 */

// components.js sonundaki IIFE querySelector çağırır → minimal DOM
document.body.innerHTML =
  '<div class="ve-main"></div>' +
  '<div id="ve-module-overlay" style="display:none;"></div>' +
  '<div id="ve-canvas-wrapper"></div>';

const fs = require('fs');
const path = require('path');

function resetGlobals() {
  global.compCounter = 0;
  global.nodes = [];
  global.connections = [];
  global.canvasOffset = { x: 3000, y: 3000 };
  global.canvasZoom = 1;
  global.showToast = jest.fn();
  global.updateAllConnections = jest.fn();

  global.createNode = jest.fn(function (type, x, y) {
    global.compCounter++;
    var node = { id: 'comp-' + global.compCounter, type: type, x: x, y: y, data: {} };
    if (type === 'differential' && !nodes.some(function (n) { return n.type === 'differential'; })) node.isMasterDiff = true;
    if (type === 'wheel' && !nodes.some(function (n) { return n.type === 'wheel'; })) node.isMasterWheel = true;
    nodes.push(node);
  });

  // Gerçek createConnection gibi id = 'conn-' + Date.now() (senkron döngüde ÇAKIŞIR)
  global.createConnection = jest.fn(function (from, to, fromPort, toPort) {
    fromPort = fromPort || 'output';
    toPort = toPort || 'input';
    var exists = connections.some(function (c) {
      return c.from === from && c.to === to && c.fromPort === fromPort && c.toPort === toPort;
    });
    if (exists) return;
    connections.push({ id: 'conn-' + Date.now(), from: from, to: to, fromPort: fromPort, toPort: toPort });
  });
}

resetGlobals();
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../../js/cp-arac-performans.js'), 'utf8'));

function typeOf(id) {
  var n = nodes.find(function (x) { return x.id === id; });
  return n ? n.type : null;
}

describe('Araç Performans — bileşen kaydı (subsystem düğümü)', () => {
  test('componentDefs girişi tanımlı ve doğru', () => {
    const def = componentDefs['arac-performans'];
    expect(def).toBeDefined();
    expect(def.name).toBe('Araç Performans');
    expect(def.inputs).toBe(0);
    expect(def.outputs).toBe(0);
    expect(def.isSubsystem).toBe(true);
    expect(typeof def.svg).toBe('string');
    expect(def.svg.startsWith('<svg')).toBe(true);
  });

  test('VE_MODULES components dizisinde mevcut', () => {
    expect(VE_MODULES['full-throttle'].components).toContain('arac-performans');
  });
});

describe('Araç Performans — referans yerleşim (koordinat çerçevesi)', () => {
  test('LAYOUT tanımlı', () => {
    expect(VE_ARAC_PERFORMANS_LAYOUT.length).toBe(16);
  });

  test('LAYOUT tipleri componentDefs içinde tanımlı', () => {
    VE_ARAC_PERFORMANS_LAYOUT.forEach(function (it) {
      expect(componentDefs[it.type]).toBeDefined();
    });
  });

  // Yerleşim artık KURULMUYOR — yalnız "Örneği Aktar" sonrası ap-example
  // düğümünün geri konduğu koordinat çerçevesi (cp-arac-example.js). Bağlantı
  // tablosu (VE_ARAC_PERFORMANS_LINKS) bu yüzden kaldırıldı; geri sızmasın.
  test('hazır zincir kurma yolu geride kalmadı', () => {
    expect(typeof VE_ARAC_PERFORMANS_LINKS).toBe('undefined');
    expect(typeof veAracPopulateDrivetrain).toBe('undefined');
  });
});

// KULLANICI ŞİKÂYETİ (2026-08-13): "alt topolojiye girince önceden tasarladığımız
// örnek topoloji geliyor; kaldıralım, Takoz modülü gibi sadece Başlangıç ve
// Örnekler gelsin." ESKİ kodda burası 16 düğüm + 11 bağlantı kuruyordu.
describe('Araç Performans — iç topoloji başlangıcı (veAracPopulateStarter)', () => {
  let created;
  // jsdom'da düzen motoru yok → getBoundingClientRect 0 döner. Kamera ile
  // tutarlı sahte bir görünüm ver ki "ortaya konuyor mu" ölçülebilsin:
  // 1600×900 görünüm + kamera merkezi ⇒ görünür alanın ortası yerel (3000,3000).
  const VIEW = { w: 1600, h: 900 };
  beforeAll(() => {
    resetGlobals();
    const wrap = document.getElementById('ve-canvas-wrapper');
    wrap.getBoundingClientRect = () => ({
      width: VIEW.w, height: VIEW.h, left: 0, top: 0, right: VIEW.w, bottom: VIEW.h
    });
    global.canvasOffset = { x: VIEW.w / 2, y: VIEW.h / 2 };
    global.canvasZoom = 1;
    created = veAracPopulateStarter();
  });

  test('yalnız TEK düğüm kurulur, bağlantı kurulmaz', () => {
    expect(nodes.length).toBe(1);
    expect(connections.length).toBe(0);
    expect(Array.isArray(created)).toBe(true);
    expect(created.length).toBe(1);
  });

  test('kurulan düğüm "Başlangıç ve Örnekler" (ap-example)', () => {
    expect(nodes[0].type).toBe('ap-example');
    expect(componentDefs['ap-example'].name).toBe('Başlangıç ve Örnekler');
    expect(componentDefs['ap-example'].isApExample).toBe(true);
  });

  test('hiçbir güç aktarma bileşeni gelmez (eski preset\'in kapısı)', () => {
    var POWER = ['engine', 'torque-converter', 'gearbox', 'propshaft', 'transfer',
                 'differential', 'wheel', 'vehicle', 'solver', 'shift-controller',
                 'ec-matching', 'engine-gearbox-matching'];
    var types = nodes.map(function (n) { return n.type; });
    POWER.forEach(function (t) { expect(types).not.toContain(t); });
  });

  test('düğüm görünür alanın ORTASINA konur (16\'lık yerleşimin köşesine değil)', () => {
    // Görünür alanın ortası, yukarıdaki sahte kamerada yerel (3000,3000).
    var def = componentDefs['ap-example'];
    var cx = nodes[0].x + def.defaultWidth / 2;
    var cy = nodes[0].y + def.defaultHeight / 2;
    // Tolerans: veArrangeModuleBase tabanı varsayılan 65×60 düğüme göre kurar,
    // ap-example 56×56 → yarım fark kadar (≤5px) sapar; çalışma zamanında
    // veAracOpenEditor'ün veFitViewToContent'i bunu da sıfırlar.
    expect(Math.abs(cx - 3000)).toBeLessThanOrEqual(5);
    expect(Math.abs(cy - 3000)).toBeLessThanOrEqual(5);

    // ESKİ davranışın kapısı: 16'lık yerleşimin tabanı bambaşka bir yerdi.
    var base16 = veArrangeModuleBase(VE_ARAC_PERFORMANS_LAYOUT);
    expect(Math.abs(base16.x - nodes[0].x)).toBeGreaterThan(100);
  });
});

describe('Araç Performans — özellik paneli', () => {
  test('getAracPerformansPropertiesHTML "Alt Topolojiyi Aç" butonu içerir', () => {
    const node = { id: 'comp-7', type: 'arac-performans', def: componentDefs['arac-performans'], data: {} };
    const html = getAracPerformansPropertiesHTML(node);
    expect(typeof html).toBe('string');
    expect(html).toContain("veAracOpenEditor('comp-7')");
    expect(html).toContain('Alt Topolojiyi Aç');
    // Henüz açılmamış → "Başlangıç ve Örnekler bileşeni ile başlar" bilgisi
    expect(html).toContain('Başlangıç ve Örnekler');
    expect(html).not.toContain('hazır güç aktarma topolojisi');
  });

  test('açılmış (subTopology dolu) düğümde bileşen/bağlantı sayısı gösterilir', () => {
    const node = {
      id: 'comp-9', type: 'arac-performans', def: componentDefs['arac-performans'],
      data: { subTopology: { nodes: new Array(16), connections: new Array(11) } }
    };
    const html = getAracPerformansPropertiesHTML(node);
    expect(html).toContain('16');
    expect(html).toContain('11');
  });
});

describe('Sidebar kapsamı (veShowAllSidebarComponents + veSyncSidebarScope)', () => {
  function setupSidebar() {
    document.body.innerHTML =
      '<div class="ve-category" data-ve-scope="module" id="cat-mod"><div class="ve-category-title">Modüller</div></div>' +
      '<div class="ve-category" data-ve-scope="arac-performans" id="cat-ap"><div class="ve-category-title">Güç Kaynağı</div></div>' +
      '<div class="ve-category" data-ve-scope="mount-analysis" id="cat-mnt"><div class="ve-category-title">Takoz Alt Bileşenleri</div></div>' +
      '<div class="ve-category" data-ve-scope="fead-analysis" id="cat-fead"><div class="ve-category-title">FEAD Kasnakları</div></div>' +
      '<div class="ve-category" data-always-visible="true" id="cat-tools"><div class="ve-category-title">Araçlar</div></div>';
  }
  const disp = (id) => document.getElementById(id).style.display;

  test('üst seviye (top): Modüller + Araçlar görünür, modül paletleri gizli', () => {
    setupSidebar();
    veSidebarScope = 'top';
    veShowAllSidebarComponents();
    expect(disp('cat-mod')).toBe('');
    expect(disp('cat-tools')).toBe('');
    expect(disp('cat-ap')).toBe('none');
    expect(disp('cat-mnt')).toBe('none');
    expect(disp('cat-fead')).toBe('none');
  });

  test('modül içi (arac-performans): güç aktarma görünür, Modüller GİZLİ (modül içinde modül yok), diğer paletler gizli', () => {
    setupSidebar();
    veSidebarScope = 'arac-performans';
    veShowAllSidebarComponents();
    expect(disp('cat-mod')).toBe('none');   // alt-topolojide Modüller gizlenir
    expect(disp('cat-ap')).toBe('');
    expect(disp('cat-tools')).toBe('');
    expect(disp('cat-mnt')).toBe('none');
    expect(disp('cat-fead')).toBe('none');
  });

  // Üçüncü modül (FEAD) aynı kapsam kuralına uymak ZORUNDA: kendi paleti gelir,
  // diğer iki modülün paleti gitmelidir. Kural tek yerde (veShowAllSidebarComponents)
  // ama kapsam hesabı veSyncSidebarScope'ta — yeni bir stack eklemeyi unutmak
  // sessizce "FEAD içinde takoz bileşenleri" üretirdi.
  test('modül içi (fead-analysis): FEAD paleti görünür, Araç Performans ve Takoz gizli', () => {
    setupSidebar();
    veSidebarScope = 'fead-analysis';
    veShowAllSidebarComponents();
    expect(disp('cat-fead')).toBe('');
    expect(disp('cat-mod')).toBe('none');
    expect(disp('cat-ap')).toBe('none');
    expect(disp('cat-mnt')).toBe('none');
    expect(disp('cat-tools')).toBe('');
  });

  test('veSyncSidebarScope: veFeadStack dolunca kapsam fead-analysis olur', () => {
    setupSidebar();
    global.veFeadStack = [];
    veSyncSidebarScope();
    expect(veSidebarScope).toBe('top');

    global.veFeadStack.push({ nodeId: 'comp-9', parentState: {} });
    veSyncSidebarScope();
    expect(veSidebarScope).toBe('fead-analysis');
    expect(disp('cat-fead')).toBe('');

    global.veFeadStack.length = 0;
  });

  test('veSyncSidebarScope: boş stack → top, Araç Performans stack dolu → arac-performans', () => {
    setupSidebar();
    veAracStack.length = 0;
    veSyncSidebarScope();
    expect(veSidebarScope).toBe('top');
    expect(disp('cat-ap')).toBe('none');

    veAracStack.push({ nodeId: 'comp-1', parentState: {} });
    veSyncSidebarScope();
    expect(veSidebarScope).toBe('arac-performans');
    expect(disp('cat-ap')).toBe('');

    veAracStack.length = 0;
  });

  afterAll(() => { veSidebarScope = 'top'; });
});
