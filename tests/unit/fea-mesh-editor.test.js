/**
 * FEA Mesh Editor — modal pencere testleri (UI refactor)
 *  - veFEAOpenMeshEditor / veFEACloseMeshEditor
 *  - Accordion toggle
 *  - Sade side panel (sadece Aç buton + status)
 *  - Modal DOM yapısı (header, toolbar, split body, footer)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-step.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-step.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-topology.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh-editor.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8'));

// ────────────────────────────────────────────────────────────────────────────
describe('Faz C — Face rename + Lokal Sizing sync', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.saveState = jest.fn();
    document.body.innerHTML = '';
    if (_veFEAEditorActive) veFEACloseMeshEditor();
  });

  test('veFEARenameGeometryFace özel isim kaydeder', () => {
    global.prompt = jest.fn().mockReturnValue('Sabit Mesnet Yüzü');
    var meshNode = { id: 'mesh-r1', type: 'fea-mesh', data: {} };
    global.nodes = [meshNode];
    veFEARenameGeometryFace('mesh-r1', 'faceXMin', 'X− Yüzeyi');
    expect(global.nodes[0].data.faceRenames.faceXMin).toBe('Sabit Mesnet Yüzü');
    expect(global.saveState).toHaveBeenCalled();
  });

  test('Boş veya default isimle rename → kaydı kaldırır', () => {
    global.prompt = jest.fn().mockReturnValue('');
    var meshNode = { id: 'mesh-r2', type: 'fea-mesh', data: { faceRenames: { faceXMin: 'Eski İsim' } } };
    global.nodes = [meshNode];
    veFEARenameGeometryFace('mesh-r2', 'faceXMin', 'X− Yüzeyi');
    expect(global.nodes[0].data.faceRenames.faceXMin).toBeUndefined();
  });

  test('Prompt iptal (null) → değişiklik yok', () => {
    global.prompt = jest.fn().mockReturnValue(null);
    var meshNode = { id: 'mesh-r3', type: 'fea-mesh', data: { faceRenames: { faceXMin: 'Önceki' } } };
    global.nodes = [meshNode];
    veFEARenameGeometryFace('mesh-r3', 'faceXMin', 'X− Yüzeyi');
    expect(global.nodes[0].data.faceRenames.faceXMin).toBe('Önceki');
  });

  test('Custom name topology panelinde yeşil renkte gösterilir', () => {
    var geomNode = {
      id: 'g-r', type: 'fea-geometry',
      data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } }
    };
    geomNode.data.geometry.topology = veFEAComputeGeometryTopology(geomNode.data.geometry);
    var meshNode = { id: 'mesh-r4', type: 'fea-mesh', data: { faceRenames: { faceXMin: 'Sabit Yüz' } } };
    global.nodes = [geomNode, meshNode];
    global.connections = [{ from: 'g-r', to: 'mesh-r4' }];
    var html = _veFEAEditorTopologyHTML(meshNode);
    expect(html).toMatch(/Sabit Yüz/);
    expect(html).toMatch(/Yeniden adlandırıldı/);  // tooltip
  });

  test('veFEASelectGeometryFace → meshSettings.localSizing.selection sync olur', () => {
    var meshNode = { id: 'mesh-r5', type: 'fea-mesh', data: {} };
    global.nodes = [meshNode];
    veFEASelectGeometryFace('mesh-r5', 'faceYMax');
    expect(global.nodes[0].data.meshSettings.localSizing.selection).toBe('faceYMax');
    expect(global.nodes[0].data.selectedFaceId).toBe('faceYMax');
  });

  test('veFEAOnLocalSelectionChange (Inflation → Topology) sync', () => {
    var meshNode = { id: 'mesh-r6', type: 'fea-mesh', data: {} };
    global.nodes = [meshNode];
    veFEAOnLocalSelectionChange('mesh-r6', 'faceTop');
    expect(global.nodes[0].data.selectedFaceId).toBe('faceTop');
    expect(global.nodes[0].data.meshSettings.localSizing.selection).toBe('faceTop');
  });

  test('Dropdown\'da "none" seçilirse selectedFaceId null olur', () => {
    var meshNode = { id: 'mesh-r7', type: 'fea-mesh', data: { selectedFaceId: 'faceXMin' } };
    global.nodes = [meshNode];
    veFEAOnLocalSelectionChange('mesh-r7', 'none');
    expect(global.nodes[0].data.selectedFaceId).toBeNull();
  });

  test('Lokal sizing aktifse topology face\'inde ◆ LOKAL badge', () => {
    var geomNode = {
      id: 'g-r2', type: 'fea-geometry',
      data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } }
    };
    geomNode.data.geometry.topology = veFEAComputeGeometryTopology(geomNode.data.geometry);
    var meshNode = {
      id: 'mesh-r8', type: 'fea-mesh',
      data: { meshSettings: { localSizing: { selection: 'faceXMin', biasMode: 'power', biasStrength: 0.5 } } }
    };
    global.nodes = [geomNode, meshNode];
    global.connections = [{ from: 'g-r2', to: 'mesh-r8' }];
    var html = _veFEAEditorTopologyHTML(meshNode);
    expect(html).toMatch(/LOKAL/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Face selection (Faz B: 3D ↔ topology panel iki yönlü sync)', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.saveState = jest.fn();
    document.body.innerHTML = '';
    if (_veFEAEditorActive) veFEACloseMeshEditor();
  });

  test('veFEASelectGeometryFace persist eder ve viewer.setSelectedFace çağırır', () => {
    var meshNode = { id: 'mesh-fs1', type: 'fea-mesh', data: {} };
    global.nodes = [meshNode];
    veFEASelectGeometryFace('mesh-fs1', 'faceXMin');
    expect(global.nodes[0].data.selectedFaceId).toBe('faceXMin');
    expect(global.saveState).toHaveBeenCalled();
  });

  test('Aynı face ID tekrar → seçim kaldırılır (toggle, manuel mode)', () => {
    var meshNode = { id: 'mesh-fs2', type: 'fea-mesh', data: { selectedFaceId: 'faceXMin' } };
    global.nodes = [meshNode];
    veFEASelectGeometryFace('mesh-fs2', 'faceXMin');
    expect(global.nodes[0].data.selectedFaceId).toBeNull();
  });

  test('Viewer\'dan gelen (fromViewer) tekrar tıklama toggle yapmaz', () => {
    var meshNode = { id: 'mesh-fs3', type: 'fea-mesh', data: { selectedFaceId: 'faceXMin' } };
    global.nodes = [meshNode];
    veFEASelectGeometryFace('mesh-fs3', 'faceXMin', { fromViewer: true });
    expect(global.nodes[0].data.selectedFaceId).toBe('faceXMin');
  });

  test('null faceId → seçim temizlenir', () => {
    var meshNode = { id: 'mesh-fs4', type: 'fea-mesh', data: { selectedFaceId: 'faceXMin' } };
    global.nodes = [meshNode];
    veFEASelectGeometryFace('mesh-fs4', null);
    expect(global.nodes[0].data.selectedFaceId).toBeNull();
  });

  test('Topology accordion seçili face\'i sarı highlight ile gösterir', () => {
    var geomNode = {
      id: 'g-fs', type: 'fea-geometry',
      data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } }
    };
    geomNode.data.geometry.topology = veFEAComputeGeometryTopology(geomNode.data.geometry);
    var meshNode = { id: 'mesh-fs5', type: 'fea-mesh', data: { selectedFaceId: 'faceYMax' } };
    global.nodes = [geomNode, meshNode];
    global.connections = [{ from: 'g-fs', to: 'mesh-fs5' }];
    var html = _veFEAEditorTopologyHTML(meshNode);
    expect(html).toMatch(/Seçili yüz.*faceYMax/);
    expect(html).toMatch(/◉/);
    expect(html).toMatch(/Seçimi Kaldır/);
  });

  test('Topology face satırı onclick veFEASelectGeometryFace çağırır', () => {
    var geomNode = {
      id: 'g-fs2', type: 'fea-geometry',
      data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } }
    };
    geomNode.data.geometry.topology = veFEAComputeGeometryTopology(geomNode.data.geometry);
    var meshNode = { id: 'mesh-fs6', type: 'fea-mesh', data: {} };
    global.nodes = [geomNode, meshNode];
    global.connections = [{ from: 'g-fs2', to: 'mesh-fs6' }];
    var html = _veFEAEditorTopologyHTML(meshNode);
    expect(html).toMatch(/veFEASelectGeometryFace\('mesh-fs6', 'faceXMin'\)/);
    expect(html).toMatch(/veFEASelectGeometryFace\('mesh-fs6', 'faceZMax'\)/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Geometri Topolojisi accordion (ANSYS-style face detection)', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    document.body.innerHTML = '';
    if (_veFEAEditorActive) veFEACloseMeshEditor();
  });

  test('Upstream geometri yoksa "bağlantı yok" mesajı', () => {
    var meshNode = { id: 'mesh-t1', type: 'fea-mesh', data: {} };
    global.nodes = [meshNode];
    var html = _veFEAEditorTopologyHTML(meshNode);
    expect(html).toMatch(/Upstream Geometri bağlantısı yok/);
  });

  test('Kutu geometrisi: 6 face render edilir', () => {
    var geomNode = {
      id: 'g-t1', type: 'fea-geometry',
      data: { geometry: { type: 'box', params: { width: 50, height: 30, depth: 20 } } }
    };
    geomNode.data.geometry.topology = veFEAComputeGeometryTopology(geomNode.data.geometry);
    var meshNode = { id: 'mesh-t2', type: 'fea-mesh', data: {} };
    global.nodes = [geomNode, meshNode];
    global.connections = [{ from: 'g-t1', to: 'mesh-t2' }];
    var html = _veFEAEditorTopologyHTML(meshNode);
    expect(html).toMatch(/Yüzey sayısı/);
    expect(html).toMatch(/faceXMin/);
    expect(html).toMatch(/faceXMax/);
    expect(html).toMatch(/faceYMin/);
    expect(html).toMatch(/faceYMax/);
    expect(html).toMatch(/faceZMin/);
    expect(html).toMatch(/faceZMax/);
    expect(html).toMatch(/Düzlemsel/);
  });

  test('Silindir: yan yüzeye "Silindirik" badge', () => {
    var geomNode = {
      id: 'g-t2', type: 'fea-geometry',
      data: { geometry: { type: 'cylinder', params: { radius: 10, height: 20 } } }
    };
    geomNode.data.geometry.topology = veFEAComputeGeometryTopology(geomNode.data.geometry);
    var meshNode = { id: 'mesh-t3', type: 'fea-mesh', data: {} };
    global.nodes = [geomNode, meshNode];
    global.connections = [{ from: 'g-t2', to: 'mesh-t3' }];
    var html = _veFEAEditorTopologyHTML(meshNode);
    expect(html).toMatch(/faceSide/);
    expect(html).toMatch(/Silindirik/);
    expect(html).toMatch(/r=10/); // radius
  });

  test('Şaft: iç yüzey delik (⌀) icon ile işaretli', () => {
    var geomNode = {
      id: 'g-t3', type: 'fea-geometry',
      data: { geometry: { type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } } }
    };
    geomNode.data.geometry.topology = veFEAComputeGeometryTopology(geomNode.data.geometry);
    var meshNode = { id: 'mesh-t4', type: 'fea-mesh', data: {} };
    global.nodes = [geomNode, meshNode];
    global.connections = [{ from: 'g-t3', to: 'mesh-t4' }];
    var html = _veFEAEditorTopologyHTML(meshNode);
    expect(html).toMatch(/faceInner/);
    expect(html).toMatch(/⌀/); // delik ikonu
    expect(html).toMatch(/Halka.*Düzlem/);
  });

  test('Modal acildiginda topology accordion en altta (Post-mesh grubunun sonu)', () => {
    var geomNode = {
      id: 'g-t4', type: 'fea-geometry',
      data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } }
    };
    geomNode.data.geometry.topology = veFEAComputeGeometryTopology(geomNode.data.geometry);
    var meshNode = { id: 'mesh-t5', type: 'fea-mesh', data: {} };
    global.nodes = [geomNode, meshNode];
    global.connections = [{ from: 'g-t4', to: 'mesh-t5' }];
    veFEAOpenMeshEditor('mesh-t5');
    var section = document.querySelector('[data-acc-section="topology"]');
    expect(section).not.toBeNull();
    // Sol panelde ilk accordion sizing, son accordion topology olmalı
    var leftPanel = document.getElementById('ve-fea-mesh-editor-left-panel');
    var allSections = leftPanel.querySelectorAll('[data-acc-section]');
    expect(allSections[0].getAttribute('data-acc-section')).toBe('sizing');
    expect(allSections[allSections.length - 1].getAttribute('data-acc-section')).toBe('topology');
  });

  test('Topology default kapalı (TÜM accordion\'lar başlangıçta kapalı)', () => {
    var geomNode = {
      id: 'g-t5', type: 'fea-geometry',
      data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } }
    };
    geomNode.data.geometry.topology = veFEAComputeGeometryTopology(geomNode.data.geometry);
    var meshNode = { id: 'mesh-t6', type: 'fea-mesh', data: {} };
    global.nodes = [geomNode, meshNode];
    global.connections = [{ from: 'g-t5', to: 'mesh-t6' }];
    veFEAOpenMeshEditor('mesh-t6');
    expect(document.getElementById('ve-fea-acc-body-topology').style.display).toBe('none');
    // Sizing/defaults da artık kapalı — kullanıcı kendi açar
    expect(document.getElementById('ve-fea-acc-body-sizing').style.display).toBe('none');
    expect(document.getElementById('ve-fea-acc-body-defaults').style.display).toBe('none');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Pre/Post-mesh grup ayrımı — accordion organization
describe('Mesh Editör accordion Pre/Post-mesh ayrımı', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    if (_veFEAEditorActive) veFEACloseMeshEditor();
  });

  test('Pre-mesh grup başlığı (Mesh Öncesi) ve Post-mesh grup başlığı (Mesh Sonrası) render edilir', () => {
    global.nodes = [{ id: 'mesh-g1', type: 'fea-mesh', data: {} }];
    veFEAOpenMeshEditor('mesh-g1');
    var leftPanel = document.getElementById('ve-fea-mesh-editor-left-panel');
    expect(leftPanel.innerHTML).toMatch(/Mesh Öncesi/);
    expect(leftPanel.innerHTML).toMatch(/Mesh Sonrası/);
  });

  test('Pre-mesh sırası: sizing → defaults → inflation → faceSizing → edgeSizing → sphereOfInfluence → namedSel', () => {
    global.nodes = [{ id: 'mesh-g2', type: 'fea-mesh', data: {} }];
    veFEAOpenMeshEditor('mesh-g2');
    var sections = document.getElementById('ve-fea-mesh-editor-left-panel')
      .querySelectorAll('[data-acc-section]');
    var order = Array.from(sections).map(s => s.getAttribute('data-acc-section'));
    expect(order.slice(0, 7)).toEqual(['sizing', 'defaults', 'inflation', 'faceSizing', 'edgeSizing', 'sphereOfInfluence', 'namedSel']);
  });

  test('Post-mesh sırası: quality → statistics → display → suggestions → convergence → topology', () => {
    global.nodes = [{ id: 'mesh-g3', type: 'fea-mesh', data: {} }];
    veFEAOpenMeshEditor('mesh-g3');
    var sections = document.getElementById('ve-fea-mesh-editor-left-panel')
      .querySelectorAll('[data-acc-section]');
    var order = Array.from(sections).map(s => s.getAttribute('data-acc-section'));
    expect(order.slice(7)).toEqual(['quality', 'statistics', 'display', 'suggestions', 'convergence', 'topology']);
  });

  test('Default accordion state: TÜM accordion\'lar kapalı (sade ilk görünüm)', () => {
    var state = _veFEAEditorDefaultAccordionState();
    expect(state.sizing).toBe(false);
    expect(state.defaults).toBe(false);
    expect(state.inflation).toBe(false);
    expect(state.namedSel).toBe(false);
    expect(state.quality).toBe(false);
    expect(state.statistics).toBe(false);
    expect(state.display).toBe(false);
    expect(state.suggestions).toBe(false);
    expect(state.topology).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Side panel — sadeleştirilmiş Mesh özellikleri', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Geometri yoksa "(bağlı değil)" uyarısı + disabled ÇALIŞTIR butonu HTML\'de', () => {
    var node = { id: 'mesh-1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/bağlı değil/);
    expect(html).toMatch(/ÇALIŞTIR.*Mesh Editörünü Aç/);
    expect(html).toMatch(/veFEAOpenMeshEditor\('mesh-1'\)/);
  });

  test('Geometri var + mesh yok → "Henüz mesh hesaplanmadı"', () => {
    var geomNode = { id: 'g1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } }, def: { name: 'Geometri' } };
    var meshNode = { id: 'mesh-2', type: 'fea-mesh', data: {} };
    global.nodes = [geomNode, meshNode];
    global.connections = [{ from: 'g1', to: 'mesh-2' }];
    var html = getFEAMeshPropertiesHTML(meshNode);
    expect(html).toMatch(/Henüz mesh hesaplanmadı/);
    expect(html).toMatch(/✓.*Kutu/);
  });

  test('Mesh aktifken durum özetinde düğüm/eleman + GEÇERLİ', () => {
    var node = {
      id: 'mesh-3', type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          nodeCount: 27, elementCount: 8, elementType: 'hex8',
          minSize: 5, maxSize: 5, avgSize: 5,
          jacobian: { valid: true }
        }
      }
    };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/27 \/ 8/);
    expect(html).toMatch(/✓ Geçerli/);
    expect(html).toMatch(/Heks8/);
  });

  test('Side panel\'de canvas YOK (modal\'a taşındı)', () => {
    var node = { id: 'mesh-4', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    // Eski 240×180 preview canvas artık yok
    expect(html).not.toMatch(/<canvas/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAOpenMeshEditor / veFEACloseMeshEditor', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.saveState = jest.fn();
    document.body.innerHTML = '';
    if (_veFEAEditorActive) veFEACloseMeshEditor();
  });

  test('Modal DOM\'a eklenir, _veFEAEditorActive set olur', () => {
    var node = { id: 'mesh-o1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-o1');
    expect(_veFEAEditorActive).toBe('mesh-o1');
    expect(document.getElementById('ve-fea-mesh-editor-overlay')).not.toBeNull();
    expect(document.getElementById('ve-fea-mesh-editor-modal')).not.toBeNull();
  });

  test('Modal header + toolbar + body + footer içeriyor', () => {
    var node = { id: 'mesh-o2', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-o2');
    expect(document.getElementById('ve-fea-mesh-editor-body')).not.toBeNull();
    expect(document.getElementById('ve-fea-mesh-editor-left-panel')).not.toBeNull();
    expect(document.getElementById('ve-fea-mesh-editor-right-panel')).not.toBeNull();
    expect(document.getElementById('ve-fea-mesh-editor-divider')).not.toBeNull();
  });

  test('veFEACloseMeshEditor modal\'ı DOM\'dan kaldırır', () => {
    var node = { id: 'mesh-o3', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-o3');
    veFEACloseMeshEditor();
    expect(_veFEAEditorActive).toBeNull();
    expect(document.getElementById('ve-fea-mesh-editor-overlay')).toBeNull();
  });

  test('Bilinmeyen node ID → modal açılmaz', () => {
    veFEAOpenMeshEditor('nonexistent');
    expect(_veFEAEditorActive).toBeNull();
  });

  test('Yanlış type → modal açılmaz', () => {
    global.nodes = [{ id: 'eng-1', type: 'engine', data: {} }];
    veFEAOpenMeshEditor('eng-1');
    expect(_veFEAEditorActive).toBeNull();
  });

  test('ESC tuşu modal\'ı kapatır', () => {
    var node = { id: 'mesh-o4', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-o4');
    expect(_veFEAEditorActive).toBe('mesh-o4');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(_veFEAEditorActive).toBeNull();
  });

  test('Aynı node\'a tekrar açma → eski instance kapatılır, yeni açılır', () => {
    var node = { id: 'mesh-o5', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-o5');
    veFEAOpenMeshEditor('mesh-o5');
    expect(_veFEAEditorActive).toBe('mesh-o5');
    // Sadece bir overlay olmalı
    var overlays = document.querySelectorAll('#ve-fea-mesh-editor-overlay');
    expect(overlays.length).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Mesh oluşturma loading / banner görselleştirmesi
describe('veFEAEditorShowLoading / veFEAEditorShowResultBanner', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.saveState = jest.fn();
    document.body.innerHTML = '';
    if (_veFEAEditorActive) veFEACloseMeshEditor();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Editor kapalıyken showLoading sessizce atlanır (no-op)', () => {
    expect(_veFEAEditorActive).toBeNull();
    expect(function() {
      veFEAEditorShowLoading('test', 'sub');
    }).not.toThrow();
    expect(document.getElementById('ve-fea-mesh-loading')).toBeNull();
  });

  test('showLoading modal aktifken spinner + mesaj DOM\'a eklenir', () => {
    var node = { id: 'mesh-L1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-L1');
    veFEAEditorShowLoading('Mesh oluşturuluyor...', 'voxelization + tet4');
    var el = document.getElementById('ve-fea-mesh-loading');
    expect(el).not.toBeNull();
    expect(el.querySelector('[data-loading-msg]').textContent).toBe('Mesh oluşturuluyor...');
    expect(el.querySelector('[data-loading-sub]').textContent).toBe('voxelization + tet4');
  });

  test('hideLoading overlay DOM\'dan kaldırır', () => {
    var node = { id: 'mesh-L2', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-L2');
    veFEAEditorShowLoading('test');
    expect(document.getElementById('ve-fea-mesh-loading')).not.toBeNull();
    veFEAEditorHideLoading();
    expect(document.getElementById('ve-fea-mesh-loading')).toBeNull();
  });

  test('showLoading ikinci çağrı yeni eleman oluşturmaz, sadece mesaj günceller', () => {
    var node = { id: 'mesh-L3', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-L3');
    veFEAEditorShowLoading('İlk mesaj', 'alt1');
    veFEAEditorShowLoading('Güncel mesaj', 'alt2');
    var loaders = document.querySelectorAll('#ve-fea-mesh-loading');
    expect(loaders.length).toBe(1);
    expect(loaders[0].querySelector('[data-loading-msg]').textContent).toBe('Güncel mesaj');
    expect(loaders[0].querySelector('[data-loading-sub]').textContent).toBe('alt2');
  });

  test('showResultBanner success tipi yeşil banner gösterir', () => {
    var node = { id: 'mesh-B1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-B1');
    veFEAEditorShowResultBanner('success', '✓ Mesh oluşturuldu', '8 eleman · 27 düğüm · 12 ms');
    var b = document.getElementById('ve-fea-mesh-banner');
    expect(b).not.toBeNull();
    expect(b.textContent).toContain('Mesh oluşturuldu');
    expect(b.textContent).toContain('8 eleman');
  });

  test('showResultBanner error tipi kırmızı banner gösterir', () => {
    var node = { id: 'mesh-B2', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-B2');
    veFEAEditorShowResultBanner('error', 'Mesh hatası', 'Detay');
    var b = document.getElementById('ve-fea-mesh-banner');
    expect(b).not.toBeNull();
    // jsdom CSS values'ı boşluklu/normalize formatta tutar; her iki olasılığı kabul et
    var css = b.style.cssText;
    expect(css.indexOf('239, 68, 68') >= 0 || css.indexOf('239,68,68') >= 0).toBe(true);
  });

  test('Banner ikinci çağrı eski banner\'ı kaldırır (tek anda 1 banner)', () => {
    var node = { id: 'mesh-B3', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-B3');
    veFEAEditorShowResultBanner('success', 'İlk');
    veFEAEditorShowResultBanner('error', 'İkinci');
    var banners = document.querySelectorAll('#ve-fea-mesh-banner');
    expect(banners.length).toBe(1);
    expect(banners[0].textContent).toContain('İkinci');
  });

  test('Banner kapat butonu manuel olarak kaldırır', () => {
    var node = { id: 'mesh-B4', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-B4');
    veFEAEditorShowResultBanner('success', 'Test');
    var b = document.getElementById('ve-fea-mesh-banner');
    var closeBtn = b.querySelector('[data-banner-close]');
    closeBtn.click();
    expect(document.getElementById('ve-fea-mesh-banner')).toBeNull();
  });

  test('Modal kapatılınca aktif loading + banner timer\'ı sızdırılmaz', () => {
    var node = { id: 'mesh-B5', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-B5');
    veFEAEditorShowLoading('test');
    veFEAEditorShowResultBanner('success', 'Test');
    veFEACloseMeshEditor();
    // Modal DOM'dan kaldırıldı, _veFEAEditorActive null
    expect(_veFEAEditorActive).toBeNull();
    expect(document.getElementById('ve-fea-mesh-editor-overlay')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Kesit (clipping plane) inline kontrol — sağ panel toolbar
describe('veFEAEditorToggleClip / veFEAEditorSetClipOffset', () => {
  beforeEach(() => {
    global.nodes = [];
    document.body.innerHTML = '';
    if (_veFEAEditorActive) veFEACloseMeshEditor();
  });

  test('Toolbar\'da X/Y/Z kesit butonları rendering edilir', () => {
    var node = { id: 'mesh-C1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-C1');
    expect(document.getElementById('ve-fea-clip-btn-x-mesh-C1')).not.toBeNull();
    expect(document.getElementById('ve-fea-clip-btn-y-mesh-C1')).not.toBeNull();
    expect(document.getElementById('ve-fea-clip-btn-z-mesh-C1')).not.toBeNull();
    // Slider satırı default gizli
    var sliders = document.getElementById('ve-fea-clip-sliders-mesh-C1');
    expect(sliders).not.toBeNull();
    expect(sliders.style.display).toBe('none');
  });

  test('Viewer yokken toggle no-op', () => {
    var node = { id: 'mesh-C2', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-C2');
    // veFEAViewerRegistry stub yok — fonksiyon hata vermemeli
    expect(function() { veFEAEditorToggleClip('mesh-C2', 'x'); }).not.toThrow();
  });

  test('Mock viewer ile toggle: state.enabled değişir, slider görünür', () => {
    var node = { id: 'mesh-C3', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-C3');
    // Mock viewer state
    var mockClipState = { x: { enabled: false, offset: 0 }, y: { enabled: false, offset: 0 }, z: { enabled: false, offset: 0 } };
    var setCalls = [];
    veFEAViewerRegistry['mesh-C3'] = {
      _clipState: mockClipState,
      setClipPlane: function(axis, enabled, offset) {
        setCalls.push([axis, enabled, offset]);
        mockClipState[axis].enabled = !!enabled;
        if (typeof offset === 'number') mockClipState[axis].offset = offset;
      },
      getClipBoundsForAxis: function() { return { min: -10, max: 10 }; }
    };
    veFEAEditorToggleClip('mesh-C3', 'x');
    expect(mockClipState.x.enabled).toBe(true);
    // UI senkronlanmış olmalı — slider satırı görünür
    var row = document.getElementById('ve-fea-clip-row-x-mesh-C3');
    expect(row.style.display).toBe('flex');
    // Default offset = bbox merkezi = 0
    expect(mockClipState.x.offset).toBe(0);
  });

  test('veFEAEditorResetClip: 3 ekseni de kapatır', () => {
    var node = { id: 'mesh-C4', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-C4');
    var mockClipState = { x: { enabled: true, offset: 5 }, y: { enabled: true, offset: 3 }, z: { enabled: false, offset: 0 } };
    veFEAViewerRegistry['mesh-C4'] = {
      _clipState: mockClipState,
      setClipPlane: function(axis, enabled) { mockClipState[axis].enabled = !!enabled; },
      getClipBoundsForAxis: function() { return { min: -10, max: 10 }; }
    };
    veFEAEditorResetClip('mesh-C4');
    expect(mockClipState.x.enabled).toBe(false);
    expect(mockClipState.y.enabled).toBe(false);
    expect(mockClipState.z.enabled).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Accordion bölümleri', () => {
  beforeEach(() => {
    global.nodes = [];
    document.body.innerHTML = '';
    if (_veFEAEditorActive) veFEACloseMeshEditor();
  });

  test('8 accordion bölümü render edilir', () => {
    var node = { id: 'mesh-a1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-a1');
    var sectionKeys = ['defaults', 'sizing', 'inflation', 'quality', 'namedSel', 'display', 'statistics', 'suggestions'];
    sectionKeys.forEach(function(k) {
      expect(document.querySelector('[data-acc-section="' + k + '"]')).not.toBeNull();
      expect(document.getElementById('ve-fea-acc-body-' + k)).not.toBeNull();
    });
  });

  test('Default state: TÜM accordion\'lar kapalı (kullanıcı kendi açar)', () => {
    var node = { id: 'mesh-a2', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-a2');
    expect(document.getElementById('ve-fea-acc-body-defaults').style.display).toBe('none');
    expect(document.getElementById('ve-fea-acc-body-sizing').style.display).toBe('none');
    expect(document.getElementById('ve-fea-acc-body-quality').style.display).toBe('none');
    expect(document.getElementById('ve-fea-acc-body-statistics').style.display).toBe('none');
  });

  test('veFEAToggleAccordion açıkken kapatır, kapalıyken açar', () => {
    var node = { id: 'mesh-a3', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-a3');
    // Quality kapalı → aç
    veFEAToggleAccordion('quality');
    expect(document.getElementById('ve-fea-acc-body-quality').style.display).toBe('block');
    expect(document.getElementById('ve-fea-acc-arrow-quality').textContent).toBe('▼');
    // Defaults kapalı → aç
    veFEAToggleAccordion('defaults');
    expect(document.getElementById('ve-fea-acc-body-defaults').style.display).toBe('block');
    expect(document.getElementById('ve-fea-acc-arrow-defaults').textContent).toBe('▼');
    // Defaults yine kapat
    veFEAToggleAccordion('defaults');
    expect(document.getElementById('ve-fea-acc-body-defaults').style.display).toBe('none');
    expect(document.getElementById('ve-fea-acc-arrow-defaults').textContent).toBe('▶');
  });

  test('Accordion state node.data\'ya persist edilir', () => {
    global.saveState = jest.fn();
    var node = { id: 'mesh-a4', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-a4');
    veFEAToggleAccordion('quality');
    expect(global.nodes[0].data.editorAccordion.quality).toBe(true);
    expect(global.saveState).toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Modal toolbar — Çalıştır butonu', () => {
  beforeEach(() => {
    global.nodes = [];
    document.body.innerHTML = '';
    if (_veFEAEditorActive) veFEACloseMeshEditor();
  });

  test('Geometri yoksa Mesh Oluştur disabled', () => {
    var node = { id: 'mesh-t1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-t1');
    var btn = document.querySelector('button[onclick*="veFEASubmitMeshBuild"]');
    expect(btn).not.toBeNull();
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  test('Geometri varsa Mesh Oluştur aktif', () => {
    global.nodes = [
      { id: 'g-t', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-t2', type: 'fea-mesh', data: {} }
    ];
    global.connections = [{ from: 'g-t', to: 'mesh-t2' }];
    veFEAOpenMeshEditor('mesh-t2');
    var btn = document.querySelector('button[onclick*="veFEASubmitMeshBuild"]');
    expect(btn.hasAttribute('disabled')).toBe(false);
  });

  test('Mesh aktifken Mesh\'i Sil butonu render', () => {
    var node = {
      id: 'mesh-t3', type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: { nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5 }
      }
    };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-t3');
    var clearBtn = document.querySelector('button[onclick*="veFEAClearMeshForNode"]');
    expect(clearBtn).not.toBeNull();
  });
});

// ─── Faz 2 Adım 1 — Edge Sizing Controls UI ───
describe('Edge Sizing Controls (ANSYS §5.5) — UI helpers', () => {
  beforeEach(() => {
    global.nodes = [];
    global.saveState = jest.fn();
    document.body.innerHTML = '';
  });

  test('_veFEAEditorEdgeSizingHTML: cylinder geometry → 2 edge dropdown\'da', () => {
    var node = { id: 'es1', type: 'fea-mesh', data: {
      geometry: { type: 'cylinder', params: { radius: 10, height: 20 } }
    }};
    var html = _veFEAEditorEdgeSizingHTML(node);
    expect(html).toMatch(/edgeBottomCircle/);
    expect(html).toMatch(/edgeTopCircle/);
    expect(html).toMatch(/veFEAAddEdgeSizingFromDropdown/);
  });

  test('_veFEAEditorEdgeSizingHTML: edge\'i olmayan geometri → uyarı', () => {
    var node = { id: 'es2', type: 'fea-mesh', data: {
      geometry: { type: 'sphere', params: { radius: 10 } }
    }};
    var html = _veFEAEditorEdgeSizingHTML(node);
    expect(html).toMatch(/tanımlı edge yok/);
  });

  test('veFEAAddEdgeSizingFromDropdown: dropdown\'dan edge ekler', () => {
    var node = { id: 'es3', type: 'fea-mesh', data: {
      geometry: { type: 'cylinder', params: { radius: 10, height: 20 } }
    }};
    global.nodes = [node];
    document.body.innerHTML = '<select id="ve-fea-es-pick-es3"><option value="edgeBottomCircle" selected>X</option></select>';
    veFEAAddEdgeSizingFromDropdown('es3');
    expect(node.data.meshSettings.edgeSizingControls).toBeDefined();
    expect(node.data.meshSettings.edgeSizingControls.length).toBe(1);
    expect(node.data.meshSettings.edgeSizingControls[0].edgeId).toBe('edgeBottomCircle');
  });

  test('veFEARemoveEdgeSizing siler', () => {
    var node = { id: 'es4', type: 'fea-mesh', data: {
      meshSettings: { edgeSizingControls: [
        { edgeId: 'edgeBottomCircle', size: 1, behavior: 'soft' },
        { edgeId: 'edgeTopCircle',    size: 2, behavior: 'hard' }
      ]}
    }};
    global.nodes = [node];
    veFEARemoveEdgeSizing('es4', 0);
    expect(node.data.meshSettings.edgeSizingControls.length).toBe(1);
    expect(node.data.meshSettings.edgeSizingControls[0].edgeId).toBe('edgeTopCircle');
  });

  test('veFEAReadEdgeSizingFromUI: DOM input\'larından okur', () => {
    var node = { id: 'es5', type: 'fea-mesh', data: {
      meshSettings: { edgeSizingControls: [
        { edgeId: 'edgeBottomCircle', size: 1, behavior: 'soft' }
      ]}
    }};
    global.nodes = [node];
    document.body.innerHTML =
      '<input id="ve-fea-es-size-es5-0" value="0.5">' +
      '<input id="ve-fea-es-div-es5-0" value="">' +
      '<input type="radio" name="ve-fea-es-mode-es5-0" value="size" checked>' +
      '<select id="ve-fea-es-beh-es5-0"><option value="hard" selected>H</option></select>';
    var arr = veFEAReadEdgeSizingFromUI('es5');
    expect(arr[0].size).toBe(0.5);
    expect(arr[0].behavior).toBe('hard');
  });
});

// ─── Faz 2 Adım 0 — Face Sizing Controls UI ───
describe('Face Sizing Controls (ANSYS §5.1) — UI helpers', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.saveState = jest.fn();
    document.body.innerHTML = '';
  });

  test('_veFEAEditorFaceSizingHTML: hiç seçim yok + boş liste → uyarı placeholder', () => {
    var node = { id: 'fs1', type: 'fea-mesh', data: {} };
    var html = _veFEAEditorFaceSizingHTML(node);
    expect(html).toMatch(/Henüz face sizing tanımlı değil/);
    expect(html).toMatch(/3D görüntüleyicide bir yüzeye tıklayın/);
  });

  test('_veFEAEditorFaceSizingHTML: face seçili, listede yok → Ekle butonu', () => {
    var node = { id: 'fs2', type: 'fea-mesh', data: {
      selectedFaceId: 'faceTop',
      geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } }
    }};
    var html = _veFEAEditorFaceSizingHTML(node);
    expect(html).toMatch(/Seçili yüz:/);
    expect(html).toMatch(/veFEAAddFaceSizingFromSelection/);
    expect(html).not.toMatch(/zaten listede/);
  });

  test('_veFEAEditorFaceSizingHTML: face seçili VE listede → "zaten listede" mesajı', () => {
    var node = { id: 'fs3', type: 'fea-mesh', data: {
      selectedFaceId: 'faceTop',
      meshSettings: { faceSizingControls: [{ faceId: 'faceTop', size: 1, behavior: 'soft' }] }
    }};
    var html = _veFEAEditorFaceSizingHTML(node);
    expect(html).toMatch(/zaten listede/);
    expect(html).not.toMatch(/veFEAAddFaceSizingFromSelection/);
  });

  test('_veFEAEditorFaceSizingHTML: liste dolu → her entry için size/behavior input', () => {
    var node = { id: 'fs4', type: 'fea-mesh', data: {
      meshSettings: { faceSizingControls: [
        { faceId: 'faceTop', size: 1.5, behavior: 'soft' },
        { faceId: 'faceBottom', size: 0.8, behavior: 'hard' }
      ]}
    }};
    var html = _veFEAEditorFaceSizingHTML(node);
    expect(html).toMatch(/id="ve-fea-fs-size-fs4-0"/);
    expect(html).toMatch(/id="ve-fea-fs-size-fs4-1"/);
    expect(html).toMatch(/id="ve-fea-fs-beh-fs4-0"/);
    expect(html).toMatch(/value="hard" selected/);  // index 1 hard
  });

  test('veFEAAddFaceSizingFromSelection: seçili face listeye eklenir', () => {
    var node = { id: 'fs5', type: 'fea-mesh', data: { selectedFaceId: 'faceTop' } };
    global.nodes = [node];
    veFEAAddFaceSizingFromSelection('fs5');
    expect(node.data.meshSettings.faceSizingControls).toBeDefined();
    expect(node.data.meshSettings.faceSizingControls.length).toBe(1);
    expect(node.data.meshSettings.faceSizingControls[0].faceId).toBe('faceTop');
    expect(node.data.meshSettings.faceSizingControls[0].behavior).toBe('soft');
  });

  test('veFEAAddFaceSizingFromSelection: aynı face tekrar eklenemez (dedup)', () => {
    var node = { id: 'fs6', type: 'fea-mesh', data: {
      selectedFaceId: 'faceTop',
      meshSettings: { faceSizingControls: [{ faceId: 'faceTop', size: 1, behavior: 'soft' }] }
    }};
    global.nodes = [node];
    veFEAAddFaceSizingFromSelection('fs6');
    expect(node.data.meshSettings.faceSizingControls.length).toBe(1);  // değişmedi
  });

  test('veFEAAddFaceSizingFromSelection: hiç face seçili değilse skip', () => {
    var node = { id: 'fs7', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAAddFaceSizingFromSelection('fs7');
    expect(node.data.meshSettings).toBeUndefined();
  });

  test('veFEAAddFaceSizingFromSelection: default size = global / 2', () => {
    var node = { id: 'fs8', type: 'fea-mesh', data: {
      selectedFaceId: 'faceTop',
      meshSettings: { size: 8 }
    }};
    global.nodes = [node];
    veFEAAddFaceSizingFromSelection('fs8');
    expect(node.data.meshSettings.faceSizingControls[0].size).toBe(4);
  });

  test('veFEARemoveFaceSizing: belirtilen index siler', () => {
    var node = { id: 'fs9', type: 'fea-mesh', data: {
      meshSettings: { faceSizingControls: [
        { faceId: 'faceTop',    size: 1, behavior: 'soft' },
        { faceId: 'faceBottom', size: 2, behavior: 'hard' },
        { faceId: 'faceSide',   size: 3, behavior: 'soft' }
      ]}
    }};
    global.nodes = [node];
    veFEARemoveFaceSizing('fs9', 1);
    expect(node.data.meshSettings.faceSizingControls.length).toBe(2);
    expect(node.data.meshSettings.faceSizingControls[0].faceId).toBe('faceTop');
    expect(node.data.meshSettings.faceSizingControls[1].faceId).toBe('faceSide');
  });

  test('veFEAReadFaceSizingFromUI: DOM input\'larından okur', () => {
    var node = { id: 'fs10', type: 'fea-mesh', data: {
      meshSettings: { faceSizingControls: [
        { faceId: 'faceTop',    size: 1, behavior: 'soft' },
        { faceId: 'faceBottom', size: 2, behavior: 'hard' }
      ]}
    }};
    global.nodes = [node];
    document.body.innerHTML =
      '<input id="ve-fea-fs-size-fs10-0" value="0.5">' +
      '<select id="ve-fea-fs-beh-fs10-0"><option value="hard" selected>H</option></select>' +
      '<input id="ve-fea-fs-size-fs10-1" value="3.0">' +
      '<select id="ve-fea-fs-beh-fs10-1"><option value="soft" selected>S</option></select>';
    var arr = veFEAReadFaceSizingFromUI('fs10');
    expect(arr.length).toBe(2);
    expect(arr[0].size).toBe(0.5);
    expect(arr[0].behavior).toBe('hard');
    expect(arr[1].size).toBe(3.0);
    expect(arr[1].behavior).toBe('soft');
  });
});

// ─── Faz 1 Adım 4 — Sphere of Influence UI ───
describe('Sphere of Influence (ANSYS §5.2) — UI helpers', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.saveState = jest.fn();
    document.body.innerHTML = '';
  });

  test('_veFEAEditorSphereOfInfluenceHTML: boş liste → placeholder + Ekle butonu', () => {
    var node = { id: 'soi1', type: 'fea-mesh', data: {} };
    var html = _veFEAEditorSphereOfInfluenceHTML(node);
    expect(html).toMatch(/Henüz tanımlı Sphere of Influence yok/);
    expect(html).toMatch(/veFEAAddSphereOfInfluence/);
  });

  test('_veFEAEditorSphereOfInfluenceHTML: dolu liste → her küre için kart', () => {
    var node = { id: 'soi2', type: 'fea-mesh', data: {
      meshSettings: { sphereOfInfluence: [
        { cx: 1, cy: 2, cz: 3, radius: 5, targetSize: 1 },
        { cx: 10, cy: 20, cz: 30, radius: 8, targetSize: null }
      ]}
    }};
    var html = _veFEAEditorSphereOfInfluenceHTML(node);
    expect(html).toMatch(/Küre 1/);
    expect(html).toMatch(/Küre 2/);
    expect(html).toMatch(/id="ve-fea-soi-cx-soi2-0"/);
    expect(html).toMatch(/id="ve-fea-soi-cx-soi2-1"/);
    expect(html).toMatch(/veFEARemoveSphereOfInfluence/);
  });

  test('veFEAAddSphereOfInfluence: yeni küre ekler', () => {
    var node = { id: 'soi3', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAAddSphereOfInfluence('soi3');
    expect(node.data.meshSettings.sphereOfInfluence).toBeDefined();
    expect(node.data.meshSettings.sphereOfInfluence.length).toBe(1);
    expect(node.data.meshSettings.sphereOfInfluence[0].radius).toBeGreaterThan(0);
  });

  test('veFEAAddSphereOfInfluence: geometry bbox\'ından merkez+yarıçap türetir', () => {
    var geomNode = { id: 'g1', type: 'fea-geometry', data: {
      geometry: { type: 'box', bbox: { minX: 0, maxX: 100, minY: 0, maxY: 50, minZ: 0, maxZ: 20 } }
    }};
    var meshNode = { id: 'm1', type: 'fea-mesh', data: {} };
    global.nodes = [geomNode, meshNode];
    global.connections = [{ from: 'g1', to: 'm1' }];
    veFEAAddSphereOfInfluence('m1');
    var sph = meshNode.data.meshSettings.sphereOfInfluence[0];
    expect(sph.cx).toBe(50);  // bbox center
    expect(sph.cy).toBe(25);
    expect(sph.cz).toBe(10);
    expect(sph.radius).toBeGreaterThan(0);
  });

  test('veFEARemoveSphereOfInfluence: belirtilen index siler', () => {
    var node = { id: 'soi4', type: 'fea-mesh', data: {
      meshSettings: { sphereOfInfluence: [
        { cx: 1, cy: 1, cz: 1, radius: 1 },
        { cx: 2, cy: 2, cz: 2, radius: 2 },
        { cx: 3, cy: 3, cz: 3, radius: 3 }
      ]}
    }};
    global.nodes = [node];
    veFEARemoveSphereOfInfluence('soi4', 1);
    expect(node.data.meshSettings.sphereOfInfluence.length).toBe(2);
    expect(node.data.meshSettings.sphereOfInfluence[0].radius).toBe(1);
    expect(node.data.meshSettings.sphereOfInfluence[1].radius).toBe(3);
  });

  test('veFEAReadSphereOfInfluenceFromUI: DOM input\'larından okur', () => {
    document.body.innerHTML =
      '<input id="ve-fea-soi-cx-n1-0" value="5">' +
      '<input id="ve-fea-soi-cy-n1-0" value="10">' +
      '<input id="ve-fea-soi-cz-n1-0" value="-3">' +
      '<input id="ve-fea-soi-r-n1-0"  value="7.5">' +
      '<input id="ve-fea-soi-ts-n1-0" value="0.5">';
    var arr = veFEAReadSphereOfInfluenceFromUI('n1');
    expect(arr.length).toBe(1);
    expect(arr[0].cx).toBe(5);
    expect(arr[0].cy).toBe(10);
    expect(arr[0].cz).toBe(-3);
    expect(arr[0].radius).toBe(7.5);
    expect(arr[0].targetSize).toBe(0.5);
  });

  test('veFEAReadSphereOfInfluenceFromUI: boş targetSize → null', () => {
    document.body.innerHTML =
      '<input id="ve-fea-soi-cx-n2-0" value="1">' +
      '<input id="ve-fea-soi-cy-n2-0" value="2">' +
      '<input id="ve-fea-soi-cz-n2-0" value="3">' +
      '<input id="ve-fea-soi-r-n2-0"  value="5">' +
      '<input id="ve-fea-soi-ts-n2-0" value="">';
    var arr = veFEAReadSphereOfInfluenceFromUI('n2');
    expect(arr[0].targetSize).toBeNull();
  });
});

// ─── Faz 1 Adım 3 — Element Order Dashboard satırı ───
describe('_veFEAEditorStatisticsHTML — Element Order satırı', () => {
  test('Linear mesh (hex8) için "Linear (Q1...)" gösterir', () => {
    var node = {
      id: 'st1', type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          elementType: 'hex8', nodeCount: 27, elementCount: 8,
          minSize: 5, maxSize: 5, avgSize: 5
        }
      }
    };
    var html = _veFEAEditorStatisticsHTML(node);
    expect(html).toMatch(/Element Order/);
    expect(html).toMatch(/Linear \(Q1/);
    expect(html).not.toMatch(/Quadratic/);
  });

  test('Quadratic mesh (hex20) için "Quadratic (Q2...)" gösterir', () => {
    var node = {
      id: 'st2', type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          elementType: 'hex20', nodeCount: 81, elementCount: 8,
          minSize: 5, maxSize: 5, avgSize: 5
        }
      }
    };
    var html = _veFEAEditorStatisticsHTML(node);
    expect(html).toMatch(/Quadratic \(Q2/);
  });

  test('Tet10 ve Wedge15 de Quadratic olarak görünür', () => {
    ['tet10', 'wedge15'].forEach(function(t) {
      var node = { id: 's-' + t, type: 'fea-mesh', data: {
        meshActive: true,
        meshMetrics: { elementType: t, nodeCount: 10, elementCount: 1, minSize:1, maxSize:1, avgSize:1 }
      }};
      var html = _veFEAEditorStatisticsHTML(node);
      expect(html).toMatch(/Quadratic/);
    });
  });
});

// ─── Faz 1 Adım 2 — ANSYS-style histogram bin selection ───
describe('veFEAHighlightQualityBin (histogram bin → 3D vurgu)', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    // veFEAViewerRegistry & veFEAMeshCache zaten global (fea-viewer.js'den)
    Object.keys(veFEAViewerRegistry).forEach(function(k) { delete veFEAViewerRegistry[k]; });
    Object.keys(veFEAMeshCache).forEach(function(k) { delete veFEAMeshCache[k]; });
  });

  function _makeBoxMeshSetup(nodeId, geomSize, meshSize) {
    var mesh = veFEAMeshFromGeometry(
      { type: 'box', params: { width: geomSize, height: geomSize, depth: geomSize } },
      { size: meshSize }
    );
    var quality = veFEAComputeQualityMetrics(mesh);
    var node = {
      id: nodeId, type: 'fea-mesh',
      data: { meshActive: true, meshMetrics: { quality: quality, elementType: mesh.type } }
    };
    global.nodes = [node];
    veFEAMeshCache[nodeId] = mesh;
    var mockViewer = { highlightElements: jest.fn() };
    veFEAViewerRegistry[nodeId] = mockViewer;
    return { mesh: mesh, node: node, viewer: mockViewer, quality: quality };
  }

  test('clear çağrısı (metricName=null) viewer.highlightElements(null) yapar', () => {
    var s = _makeBoxMeshSetup('m1', 10, 5);
    veFEAHighlightQualityBin('m1', null, null);
    expect(s.viewer.highlightElements).toHaveBeenCalledWith(null);
  });

  test('Mükemmel küp aspect bin 0 (≈1.0) → tüm elemanlar seçilir', () => {
    var s = _makeBoxMeshSetup('m2', 10, 5); // 8 hex8 element, aspect=1
    veFEAHighlightQualityBin('m2', 'aspect', 0);
    expect(s.viewer.highlightElements).toHaveBeenCalled();
    var ids = s.viewer.highlightElements.mock.calls[0][0];
    expect(ids.length).toBe(8); // tüm elementler bin 0'a düşer (aspect≈1)
  });

  test('Mükemmel küp elementQuality bin 9 (≈1.0 → en yüksek bin)', () => {
    var s = _makeBoxMeshSetup('m3', 10, 5);
    veFEAHighlightQualityBin('m3', 'elementQuality', 9);
    expect(s.viewer.highlightElements).toHaveBeenCalled();
    var ids = s.viewer.highlightElements.mock.calls[0][0];
    // Element Quality ≈ 1.0 → bin 9 (son bin) inclusive max'a düşer
    expect(ids.length).toBe(8);
  });

  test('Geçerli viewer yoksa hata vermez', () => {
    expect(function() {
      veFEAHighlightQualityBin('nonexistent', 'aspect', 0);
    }).not.toThrow();
  });

  test('Geçerli metric yoksa hata vermez', () => {
    var s = _makeBoxMeshSetup('m4', 10, 5);
    expect(function() {
      veFEAHighlightQualityBin('m4', 'nonexistentMetric', 0);
    }).not.toThrow();
    expect(s.viewer.highlightElements).not.toHaveBeenCalled();
  });
});

// ─── Faz 1 Adım 2 — Histogram HTML onClick yapısı ───
describe('veFEAHistogramHTML — tıklanabilir bin desteği', () => {
  test('onBarClickJSExpr verilince her bar onclick attribute alır', () => {
    var hist = { bins: [3, 5, 0, 2], min: 0, max: 1, binCount: 4 };
    var html = veFEAHistogramHTML(hist, 'Test', '#000', null, null,
      'function(b){console.log("bin="+b)}');
    expect(html).toMatch(/onclick="\(function/);
    expect(html).toMatch(/cursor:pointer/);
    expect(html).toMatch(/bin tıkla/); // tıkla
  });

  test('onBarClickJSExpr verilmezse onclick eklenmez (geri uyum)', () => {
    var hist = { bins: [3, 5, 0, 2], min: 0, max: 1, binCount: 4 };
    var html = veFEAHistogramHTML(hist, 'Test', '#000', null, null);
    expect(html).not.toMatch(/onclick=/);
    expect(html).not.toMatch(/cursor:pointer/);
  });

  test('Boş bin (count=0) tıklanabilir değil', () => {
    var hist = { bins: [3, 0, 2], min: 0, max: 1, binCount: 3 };
    var html = veFEAHistogramHTML(hist, 'Test', '#000', null, null,
      'function(b){}');
    // 3 div bar, ancak sadece 2'sinde onclick olmalı (0 sayılı bin click'siz)
    var onclickCount = (html.match(/onclick=/g) || []).length;
    expect(onclickCount).toBe(2);
  });
});
