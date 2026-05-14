/**
 * FEA BC (Boundary Conditions) panel UI birim testleri
 * - Malzeme seçici render
 * - Yüzey atama listesi (force/pressure/fixed/displacement)
 * - Atama ekleme/silme akışı (DOM mock'lu)
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-materials.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-topology.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8'));

// jsdom üzerinde gerçek DOM elementi oluştur (mock yerine)
function _setDomValue(id, value) {
  var el = document.getElementById(id);
  if (!el) {
    el = document.createElement('input');
    el.id = id;
    document.body.appendChild(el);
  }
  el.value = value;
  return el;
}
function _clearDom() {
  if (typeof document !== 'undefined' && document.body) {
    document.body.innerHTML = '';
  }
}

describe('BC paneli — geometri olmadan', () => {
  test('Mesnetler yok mesajı + malzeme yine seçilebilir', () => {
    global.nodes = [{ id: 'bc-1', type: 'fea-bc', data: {} }];
    global.connections = [];
    var html = getFEABCPropertiesHTML(global.nodes[0]);
    expect(html).toMatch(/Malzeme/);
    expect(html).toMatch(/Çelik|Alüminyum/);
    expect(html).toMatch(/yukarı akışta geometri/i);
  });
});

describe('BC paneli — geometri+mesh+bc bağlı', () => {
  beforeEach(() => {
    global.nodes = [
      { id: 'geom-b', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-b', type: 'fea-mesh', data: {} },
      { id: 'bc-b',   type: 'fea-bc',   data: {} }
    ];
    global.connections = [
      { from: 'geom-b', to: 'mesh-b' },
      { from: 'mesh-b', to: 'bc-b' }
    ];
    global.saveState = jest.fn();
    global.showNodeProperties = jest.fn();
  });

  test('Kutu için 6 yüzey listesi render edilir', () => {
    var html = getFEABCPropertiesHTML(global.nodes[2]);
    expect(html).toMatch(/X− Yüzeyi|X\+ Yüzeyi|Y− Yüzeyi|Y\+ Yüzeyi|Z− Yüzeyi|Z\+ Yüzeyi/);
    // 6 face option + 4 kind option + materyaller (>= 10)
    var optCount = (html.match(/<option /g) || []).length;
    expect(optCount).toBeGreaterThanOrEqual(6 + 4);
  });

  test('Yeni atama formu (force/pressure/displacement) render edilir', () => {
    var html = getFEABCPropertiesHTML(global.nodes[2]);
    expect(html).toMatch(/Fixed Support/);
    expect(html).toMatch(/Kuvvet/);
    expect(html).toMatch(/Basınç/);
    expect(html).toMatch(/Yer Değişt/i);
  });

  test('Çelik St37 varsayılan seçilidir (E, ν, σy görünür)', () => {
    var html = getFEABCPropertiesHTML(global.nodes[2]);
    expect(html).toMatch(/210000 MPa/);
    expect(html).toMatch(/0\.30/);
    expect(html).toMatch(/235 MPa/);
  });

  test('Materyal kategorisi optgroup\'ları görünür', () => {
    var html = getFEABCPropertiesHTML(global.nodes[2]);
    expect(html).toMatch(/Çelikler|Alüminyum/);
    expect(html).toMatch(/<optgroup/);
  });
});

describe('BC paneli — atama yönetimi', () => {
  beforeEach(() => {
    _clearDom();
    global.nodes = [
      { id: 'geom-c', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-c', type: 'fea-mesh', data: {} },
      { id: 'bc-c',   type: 'fea-bc',   data: {} }
    ];
    global.connections = [
      { from: 'geom-c', to: 'mesh-c' },
      { from: 'mesh-c', to: 'bc-c' }
    ];
    global.saveState = jest.fn();
    global.showNodeProperties = jest.fn();
  });

  test('veFEABCSetMaterial: malzeme güncellenir', () => {
    veFEABCSetMaterial('bc-c', 'aluminum-6061');
    expect(global.nodes[2].data.bc.materialId).toBe('aluminum-6061');
    expect(global.saveState).toHaveBeenCalled();
  });

  test('veFEABCAddAssignment(fixed) → assignments\'a eklenir', () => {
    _setDomValue('ve-fea-bc-face-bc-c', 'faceXMin');
    _setDomValue('ve-fea-bc-kind-bc-c', 'fixed');
    veFEABCAddAssignment('bc-c');
    var a = global.nodes[2].data.bc.assignments;
    expect(a.length).toBe(1);
    expect(a[0].faceId).toBe('faceXMin');
    expect(a[0].kind).toBe('fixed');
    expect(a[0].enabled).toBe(true);
  });

  test('veFEABCAddAssignment(force) → Fx/Fy/Fz değerleri kayıt edilir', () => {
    _setDomValue('ve-fea-bc-face-bc-c', 'faceZMax');
    _setDomValue('ve-fea-bc-kind-bc-c', 'force');
    _setDomValue('ve-fea-bc-fx-bc-c', 0);
    _setDomValue('ve-fea-bc-fy-bc-c', 0);
    _setDomValue('ve-fea-bc-fz-bc-c', -500);
    veFEABCAddAssignment('bc-c');
    var a = global.nodes[2].data.bc.assignments[0];
    expect(a.kind).toBe('force');
    expect(a.value.fz).toBe(-500);
  });

  test('veFEABCAddAssignment(pressure) → magnitude kayıt edilir', () => {
    _setDomValue('ve-fea-bc-face-bc-c', 'faceYMax');
    _setDomValue('ve-fea-bc-kind-bc-c', 'pressure');
    _setDomValue('ve-fea-bc-pmag-bc-c', 2.5);
    veFEABCAddAssignment('bc-c');
    var a = global.nodes[2].data.bc.assignments[0];
    expect(a.kind).toBe('pressure');
    expect(a.value.magnitude).toBe(2.5);
  });

  test('veFEABCRemoveAssignment: atamayı listeden çıkarır', () => {
    global.nodes[2].data.bc = {
      materialId: 'steel-st37',
      assignments: [
        { faceId: 'faceXMin', kind: 'fixed', value: null, enabled: true },
        { faceId: 'faceZMax', kind: 'force', value: { fx: 0, fy: 0, fz: -100 }, enabled: true }
      ]
    };
    veFEABCRemoveAssignment('bc-c', 0);
    var rem = global.nodes[2].data.bc.assignments;
    expect(rem.length).toBe(1);
    expect(rem[0].kind).toBe('force');
  });

  test('Mevcut atamalar panelde liste olarak gösterilir', () => {
    global.nodes[2].data.bc = {
      materialId: 'steel-st37',
      assignments: [
        { faceId: 'faceXMin', kind: 'fixed', value: null, enabled: true },
        { faceId: 'faceZMax', kind: 'force', value: { fx: 0, fy: 0, fz: -1000 }, enabled: true }
      ]
    };
    var html = getFEABCPropertiesHTML(global.nodes[2]);
    expect(html).toMatch(/Fixed Support/);
    expect(html).toMatch(/Kuvvet/);
    expect(html).toMatch(/-1000/);
    // Özet satırı
    expect(html).toMatch(/1 fixed/);
    expect(html).toMatch(/1 force/);
  });
});
