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
eval(fs.readFileSync(path.join(ROOT, 'js/fea-stl.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-step.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-topology.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh-editor.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8'));

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

  test('Modal acildiginda topology accordion en üstte', () => {
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
    // Sol panelde ilk accordion topology olmalı
    var leftPanel = document.getElementById('ve-fea-mesh-editor-left-panel');
    var firstSection = leftPanel.querySelector('[data-acc-section]');
    expect(firstSection.getAttribute('data-acc-section')).toBe('topology');
  });

  test('Topology default expanded (Defaults + Sizing + Topology hepsi açık)', () => {
    var geomNode = {
      id: 'g-t5', type: 'fea-geometry',
      data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } }
    };
    geomNode.data.geometry.topology = veFEAComputeGeometryTopology(geomNode.data.geometry);
    var meshNode = { id: 'mesh-t6', type: 'fea-mesh', data: {} };
    global.nodes = [geomNode, meshNode];
    global.connections = [{ from: 'g-t5', to: 'mesh-t6' }];
    veFEAOpenMeshEditor('mesh-t6');
    expect(document.getElementById('ve-fea-acc-body-topology').style.display).toBe('block');
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

  test('Default state: defaults + sizing açık, diğerleri kapalı', () => {
    var node = { id: 'mesh-a2', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    veFEAOpenMeshEditor('mesh-a2');
    expect(document.getElementById('ve-fea-acc-body-defaults').style.display).toBe('block');
    expect(document.getElementById('ve-fea-acc-body-sizing').style.display).toBe('block');
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
    // Defaults açık → kapat
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

  test('Mesh aktifken Mesh\'i Sil + Export dropdown render', () => {
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
    var exportSel = document.querySelector('select[onchange*="veFEAExportMeshForNode"]');
    expect(exportSel).not.toBeNull();
  });
});
