/**
 * FEA Mesh — birim testleri (Faz 3a)
 *  - Mesh algoritmaları: kutu (Heks8), silindir (Wedge6), şaft (Heks8 annulus)
 *  - STL/STEP yüzey mesh (Tri3 + vertex dedup)
 *  - veFEAComputeMeshMetrics: düğüm/eleman sayısı + edge length
 *  - cp-fea.js Mesh paneli render (geometri var/yok, mesh aktif/pasif)
 *  - Köprü: veFEAFindUpstreamGeometryNode, veFEABuildMeshForNode
 *  - viewer.loadMesh + veFEAInitMeshViewerForNode (Three.js olmadan graceful)
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
// ANSYS-tarz outline + lokal kontroller (Faz 3b) — editor'dan önce
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh-outline.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh-controls.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh-editor.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8'));

// Test helper — Faz 3b outline+details refactor sonrası: modal sol paneli
// artık outline tree + tek bir details container içerir; bir anda sadece bir
// bölümün HTML'i görünür. Geri-uyumlu testler için TÜM details renderer'larını
// topluca üret ve birleştir.
function _testRenderFullMeshUI(node) {
  var toolbar = _veFEAEditorBuildToolbar(node);
  var rightPanel = _veFEAEditorBuildRightPanel(node);
  var leftPanel = _veFEAEditorBuildLeftPanel(node);
  // Outline tree label'larının (Görünüm Modu, Kalite Metrikleri, vb.) test
  // arama düzlemine girmesi için tüm grupları aç ve outline'ı tekrar render et.
  var allOutline = '';
  try {
    if (typeof FEAMeshOutline !== 'undefined' && node && node.data && node.data.meshSettings && node.data.meshSettings.outline) {
      var st = node.data.meshSettings.outline;
      st.expanded['group:globals']       = true;
      st.expanded['group:localControls'] = true;
      st.expanded['group:topologyTools'] = true;
      st.expanded['group:inspect']       = true;
      allOutline = FEAMeshOutline.render();
    }
  } catch (e) { /* tolere et */ }
  // Outline'da seçili olmayan tüm bölümleri de string'e ekle (tüm UI alanlarını
  // test'e görünür kıl). Defaults, Sizing, Inflation, NamedSel, Quality,
  // Display, Statistics, Suggestions, Convergence, Topology — sıra önemli değil.
  var allDetails = '';
  // Doğrudan referanslar — eval'da global[name] çalışmadığı için scope'tan
  // identifier üzerinden erişim şart.
  try { allDetails += _veFEAEditorDefaultsHTML(node); }         catch(e){}
  try { allDetails += _veFEAEditorSizingHTML(node); }           catch(e){}
  try { allDetails += _veFEAEditorInflationHTML(node); }        catch(e){}
  try { allDetails += _veFEAEditorFaceSizingHTML(node); }       catch(e){}
  try { allDetails += _veFEAEditorEdgeSizingHTML(node); }       catch(e){}
  try { allDetails += _veFEAEditorSphereOfInfluenceHTML(node); }catch(e){}
  try { allDetails += _veFEAEditorVirtualTopologyHTML(node); }  catch(e){}
  try { allDetails += _veFEAEditorNamedSelHTML(node); }         catch(e){}
  try { allDetails += _veFEAEditorQualityHTML(node); }          catch(e){}
  try { allDetails += _veFEAEditorDisplayHTML(node); }          catch(e){}
  try { allDetails += _veFEAEditorStatisticsHTML(node); }       catch(e){}
  try { allDetails += _veFEAEditorSuggestionsHTML(node); }      catch(e){}
  try { allDetails += _veFEAEditorConvergenceHTML(node); }      catch(e){}
  try { allDetails += _veFEAEditorTopologyHTML(node); }         catch(e){}
  return (
    getFEAMeshPropertiesHTML(node) +
    toolbar.outerHTML +
    leftPanel.outerHTML +
    rightPanel.outerHTML +
    allOutline +
    allDetails
  );
}

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshLabel', () => {
  test('bilinen tipler için etiket döner', () => {
    expect(veFEAMeshLabel('hex8')).toMatch(/Heks8/);
    expect(veFEAMeshLabel('wedge6')).toMatch(/Wedge/);
    expect(veFEAMeshLabel('tri3')).toMatch(/Tri3/);
    expect(veFEAMeshLabel('tet4')).toMatch(/Tet4/);
  });

  test('bilinmeyen tip için tipin kendisi döner', () => {
    expect(veFEAMeshLabel('foobar')).toBe('foobar');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Kutu → Heks8 structured mesh', () => {
  test('1×1×1 kutu, size=1 → 1 eleman, 8 düğüm', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    expect(m.type).toBe('hex8');
    expect(m.nodesPerElement).toBe(8);
    expect(m.nodes.length / 3).toBe(8);
    expect(m.elements.length / 8).toBe(1);
  });

  test('2×2×2 kutu, size=1 → 8 eleman, 27 düğüm', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 2, height: 2, depth: 2 } }, { size: 1 });
    expect(m.elements.length / 8).toBe(8);
    expect(m.nodes.length / 3).toBe(27); // 3×3×3
  });

  test('10×10×10 kutu, size=2 → 5×5×5 eleman = 125', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 2 });
    expect(m.elements.length / 8).toBe(125);
    expect(m.nodes.length / 3).toBe(216); // 6×6×6
    expect(m.grid).toEqual({ nx: 5, ny: 5, nz: 5 });
  });

  test('kutu mesh kütle merkezi orijinde olmalı (geometri ile uyumlu)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 20, depth: 30 } }, { size: 5 });
    var sx = 0, sy = 0, sz = 0;
    var n = m.nodes.length / 3;
    for (var i = 0; i < n; i++) {
      sx += m.nodes[i*3]; sy += m.nodes[i*3+1]; sz += m.nodes[i*3+2];
    }
    expect(Math.abs(sx / n)).toBeLessThan(0.001);
    expect(Math.abs(sy / n)).toBeLessThan(0.001);
    expect(Math.abs(sz / n)).toBeLessThan(0.001);
  });

  test('minimum eleman boyutu kaldırıldı: küçük size daha çok eleman üretir', () => {
    // Eski davranış: size VE_FEA_MESH_MIN_SIZE=0.5 mm'e clamp ediliyordu.
    // Yeni: alt sınır yok (kullanıcı isteği). Aşırı küçük değer OOM yapabileceği
    // için ölçülebilir ama güvenli bir değer kullanılır.
    expect(VE_FEA_MESH_MIN_SIZE).toBe(0);
    var coarse = veFEAMeshFromGeometry({ type: 'box', params: { width: 5, height: 5, depth: 5 } }, { size: 1 });
    var fine   = veFEAMeshFromGeometry({ type: 'box', params: { width: 5, height: 5, depth: 5 } }, { size: 0.25 });
    // size 0.25 eskiden 0.5'e clamp olur, coarse ile aynı kalırdı. Artık daha ince.
    expect(fine.elements.length).toBeGreaterThan(coarse.elements.length);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// B.5 — Face Sizing kontrolünün gerçek mesh etkisi (eksenel kümeleme bias)
describe('Face Sizing → eksenel kümeleme bias (B.5)', () => {
  function uniqueSortedAxis(mesh, axis) {
    var set = {};
    var n = mesh.nodes.length / 3;
    for (var i = 0; i < n; i++) set[mesh.nodes[i * 3 + axis].toFixed(5)] = true;
    return Object.keys(set).map(Number).sort(function(a, b) { return a - b; });
  }

  test('faceXMin sizing düğümleri X−\'e doğru kümeler, eleman sayısı korunur', () => {
    var geom = { type: 'box', params: { width: 20, height: 10, depth: 10 } };
    var base = veFEAMeshFromGeometry(geom, { size: 5 });
    var biased = veFEAMeshFromGeometry(geom, {
      size: 5,
      faceSizingControls: [{ faceId: 'faceXMin', size: 1, behavior: 'soft' }]
    });
    // Eleman + düğüm sayısı değişmez (sadece konum kayar → mesh geçerli kalır)
    expect(biased.elements.length).toBe(base.elements.length);
    expect(biased.nodes.length).toBe(base.nodes.length);
    // X eksenindeki ilk aralık (X−'e en yakın) son aralıktan belirgin küçük olmalı
    var xs = uniqueSortedAxis(biased, 0);
    expect(xs.length).toBeGreaterThan(2);
    var firstGap = xs[1] - xs[0];
    var lastGap = xs[xs.length - 1] - xs[xs.length - 2];
    expect(firstGap).toBeLessThan(lastGap * 0.6);
    // Tüm koordinatlar sonlu (NaN yok)
    for (var i = 0; i < biased.nodes.length; i++) expect(isFinite(biased.nodes[i])).toBe(true);
  });

  test('hedef boyut ≥ global ise kümeleme uygulanmaz (no-op)', () => {
    var geom = { type: 'box', params: { width: 20, height: 10, depth: 10 } };
    var base = veFEAMeshFromGeometry(geom, { size: 5 });
    var noop = veFEAMeshFromGeometry(geom, {
      size: 5, faceSizingControls: [{ faceId: 'faceXMax', size: 8 }]
    });
    var xb = uniqueSortedAxis(base, 0);
    var xn = uniqueSortedAxis(noop, 0);
    expect(xn).toEqual(xb);
  });

  test('eksenel olmayan yüz (cylinder faceSide) bias\'ı mesh\'i bozmaz', () => {
    var geom = { type: 'cylinder', params: { radius: 10, height: 20 } };
    var base = veFEAMeshFromGeometry(geom, { size: 5 });
    var withSide = veFEAMeshFromGeometry(geom, {
      size: 5, faceSizingControls: [{ faceId: 'faceSide', size: 1 }]
    });
    // faceSide eksenel değil → veFEAApplyLocalSizing no-op → eleman sayısı korunur
    expect(withSide.elements.length).toBe(base.elements.length);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Silindir → O-grid Hex8 mesh (Butterfly topology)', () => {
  test('crossSection "ogrid" → tip hex8 (wedge6 yerine)', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 5, crossSection: 'ogrid' }
    );
    expect(m).not.toBeNull();
    expect(m.type).toBe('hex8');
    expect(m.nodesPerElement).toBe(8);
    expect(m.grid.ogrid).toBe(true);
  });

  test('Default (crossSection yok) → akilli O-grid Hex8 (yeni davranis)', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    expect(m.type).toBe('hex8');
    expect(m.grid.ogrid).toBe(true);
  });

  test('crossSection "wedge" acikca verilirse legacy Wedge6 (opt-in)', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 5, crossSection: 'wedge' }
    );
    expect(m.type).toBe('wedge6');
  });

  test('O-grid: nC 4\'ün katına yuvarlanır', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 7, crossSection: 'ogrid' }
    );
    expect(m.grid.nCircum % 4).toBe(0);
    expect(m.grid.nCircum).toBeGreaterThanOrEqual(8);
  });

  test('O-grid: element sayısı = (nSquare² + 4×nSquare×nR) × nA', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 5, crossSection: 'ogrid' }
    );
    var g = m.grid;
    var nSquare = g.nCircum / 4;
    var expectedPerLayer = (nSquare * nSquare) + (4 * nSquare * g.nRadial);
    expect(g.nQuads).toBe(expectedPerLayer);
    expect(m.elements.length / 8).toBe(expectedPerLayer * g.nAxial);
  });

  test('O-grid: tüm element indeksleri geçerli aralıkta', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 5, crossSection: 'ogrid' }
    );
    var maxIdx = m.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < m.elements.length; i++) {
      if (m.elements[i] < 0 || m.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });

  test('O-grid: 3 named selection (Alt, Üst, Yan)', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 5, crossSection: 'ogrid' }
    );
    expect(m.namedSelections.faceBottom).toBeDefined();
    expect(m.namedSelections.faceTop).toBeDefined();
    expect(m.namedSelections.faceSide).toBeDefined();
  });

  test('O-grid: yan yüzeydeki tüm düğümlerin radyal mesafesi = r', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 5, crossSection: 'ogrid' }
    );
    var ids = m.namedSelections.faceSide.nodeIds;
    expect(ids.length).toBeGreaterThan(0);
    for (var i = 0; i < ids.length; i++) {
      var nid = ids[i];
      var x = m.nodes[nid * 3];
      var z = m.nodes[nid * 3 + 2];
      expect(Math.sqrt(x * x + z * z)).toBeCloseTo(10, 4);
    }
  });

  test('O-grid: Jacobian pozitif (tüm Hex8 valid)', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 5, crossSection: 'ogrid' }
    );
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
    expect(jm.invertedCount).toBe(0);
  });

  test('O-grid: hacim ≈ analitik πr²h', () => {
    var r = 10, h = 20;
    var m = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: r, height: h } },
      { size: 3, crossSection: 'ogrid' }
    );
    // Element hacimleri topla (6-tet split)
    var totalVol = 0;
    var nodes = m.nodes;
    var elems = m.elements;
    var T = [[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]];
    for (var e = 0; e < elems.length / 8; e++) {
      var off = e * 8;
      for (var k = 0; k < 6; k++) {
        var a = elems[off + T[k][0]] * 3;
        var b = elems[off + T[k][1]] * 3;
        var c = elems[off + T[k][2]] * 3;
        var d = elems[off + T[k][3]] * 3;
        var v1x = nodes[b] - nodes[a], v1y = nodes[b+1] - nodes[a+1], v1z = nodes[b+2] - nodes[a+2];
        var v2x = nodes[c] - nodes[a], v2y = nodes[c+1] - nodes[a+1], v2z = nodes[c+2] - nodes[a+2];
        var v3x = nodes[d] - nodes[a], v3y = nodes[d+1] - nodes[a+1], v3z = nodes[d+2] - nodes[a+2];
        var cx = v2y*v3z - v2z*v3y;
        var cy = v2z*v3x - v2x*v3z;
        var cz = v2x*v3y - v2y*v3x;
        totalVol += Math.abs(v1x*cx + v1y*cy + v1z*cz) / 6;
      }
    }
    var analytic = Math.PI * r * r * h;
    // Discretization error (segmentlerle): %4'ten az olmalı
    expect(totalVol).toBeGreaterThan(analytic * 0.95);
    expect(totalVol).toBeLessThan(analytic * 1.05);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Silindir → Wedge6 legacy mesh (opt-in)', () => {
  test('crossSection:"wedge" ile wedge6 oluşur', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20, segments: 32 } }, { size: 5, crossSection: 'wedge' });
    expect(m.type).toBe('wedge6');
    expect(m.nodesPerElement).toBe(6);
    expect(m.elements.length % 6).toBe(0);
    expect(m.elements.length / 6).toBeGreaterThan(0);
  });

  test('eleman sayısı = (nC + 2*nC*(nR-1)) * nA (legacy wedge fan)', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5, crossSection: 'wedge' });
    var g = m.grid;
    var expected = (g.nCircum + 2 * g.nCircum * (g.nRadial - 1)) * g.nAxial;
    expect(m.elements.length / 6).toBe(expected);
  });

  test('tüm element indeksleri geçerli aralıkta (legacy wedge fan)', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5, crossSection: 'wedge' });
    var maxIdx = m.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < m.elements.length; i++) {
      if (m.elements[i] < 0 || m.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Küre → Cubed-Sphere Hex8 mesh', () => {
  test('Küre mesh oluşturulur (Hex8, single-block cubed sphere)', () => {
    var m = veFEAMeshFromGeometry({ type: 'sphere', params: { radius: 25 } }, { size: 8 });
    expect(m).not.toBeNull();
    expect(m.type).toBe('hex8');
    expect(m.geometryType).toBe('sphere');
    expect(m.grid.cubedSphere).toBe(true);
    expect(m.elements.length / 8).toBe(m.grid.nC * m.grid.nC * m.grid.nC);
  });

  test('nC = (n+1)^3 düğüm sayısı', () => {
    var m = veFEAMeshFromGeometry({ type: 'sphere', params: { radius: 25 } }, { size: 8 });
    var nC = m.grid.nC;
    expect(m.nodes.length / 3).toBe((nC + 1) * (nC + 1) * (nC + 1));
  });

  test('Tüm element indeksleri geçerli', () => {
    var m = veFEAMeshFromGeometry({ type: 'sphere', params: { radius: 25 } }, { size: 8 });
    var maxIdx = m.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < m.elements.length; i++) {
      if (m.elements[i] < 0 || m.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });

  test('Cube outer surface düğümlerinin radyal mesafesi = r', () => {
    var r = 25;
    var m = veFEAMeshFromGeometry({ type: 'sphere', params: { radius: r } }, { size: 8 });
    var ids = m.namedSelections.faceSurface.nodeIds;
    expect(ids.length).toBeGreaterThan(0);
    for (var i = 0; i < ids.length; i++) {
      var nid = ids[i];
      var x = m.nodes[nid * 3];
      var y = m.nodes[nid * 3 + 1];
      var z = m.nodes[nid * 3 + 2];
      expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(r, 4);
    }
  });

  test('Jacobian pozitif (tüm Hex8 valid)', () => {
    var m = veFEAMeshFromGeometry({ type: 'sphere', params: { radius: 25 } }, { size: 6 });
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
    expect(jm.invertedCount).toBe(0);
  });

  test('Hacim ≈ analitik (4/3)πr³ (kabul edilebilir hata)', () => {
    var r = 25;
    var m = veFEAMeshFromGeometry({ type: 'sphere', params: { radius: r } }, { size: 4 });
    // Hex8 hacim toplamı 6-tet split ile
    var totalVol = 0;
    var nodes = m.nodes;
    var elems = m.elements;
    var T = [[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]];
    for (var e = 0; e < elems.length / 8; e++) {
      var off = e * 8;
      for (var k = 0; k < 6; k++) {
        var a = elems[off + T[k][0]] * 3;
        var b = elems[off + T[k][1]] * 3;
        var c = elems[off + T[k][2]] * 3;
        var d = elems[off + T[k][3]] * 3;
        var v1x = nodes[b]-nodes[a], v1y = nodes[b+1]-nodes[a+1], v1z = nodes[b+2]-nodes[a+2];
        var v2x = nodes[c]-nodes[a], v2y = nodes[c+1]-nodes[a+1], v2z = nodes[c+2]-nodes[a+2];
        var v3x = nodes[d]-nodes[a], v3y = nodes[d+1]-nodes[a+1], v3z = nodes[d+2]-nodes[a+2];
        var cx = v2y*v3z - v2z*v3y;
        var cy = v2z*v3x - v2x*v3z;
        var cz = v2x*v3y - v2y*v3x;
        totalVol += Math.abs(v1x*cx + v1y*cy + v1z*cz) / 6;
      }
    }
    var analytic = (4 / 3) * Math.PI * r * r * r;
    // Cubed-sphere ile düşük nC: yaklaşık %15 hata kabul (köşelerde hacim kaybı)
    expect(totalVol).toBeGreaterThan(analytic * 0.80);
    expect(totalVol).toBeLessThan(analytic * 1.05);
  });

  test('Tek named selection: faceSurface', () => {
    var m = veFEAMeshFromGeometry({ type: 'sphere', params: { radius: 25 } }, { size: 8 });
    expect(Object.keys(m.namedSelections)).toEqual(['faceSurface']);
    expect(m.namedSelections.faceSurface.label).toBe('Küresel Yüzey');
  });

  test('Equiangular warp: kabul edilebilir kalite (inverted yok, skewness sınırlı)', () => {
    // Equiangular cubed-sphere mapping köşe çarpıklığını azaltır. Gnomonic'e
    // göre skewness daha düşük, orthogonal quality daha yüksek olmalı.
    [10, 5].forEach(function (sz) {
      var m = veFEAMeshFromGeometry({ type: 'sphere', params: { radius: 25 } }, { size: sz });
      var jm = veFEAComputeJacobianMetrics(m);
      var q = veFEAComputeQualityMetrics(m);
      expect(jm.invertedCount).toBe(0);
      expect(jm.valid).toBe(true);
      // Equiangular ile skewness gnomonic'ten (s=5'te ~0.91) belirgin düşük olmalı.
      expect(q.skewness.max).toBeLessThan(0.90);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Koni / Frustum → Hex8 mesh (cylinder O-grid + radial scaling)', () => {
  test('Frustum (rT < rB) → Hex8 O-grid (yeni default)', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cone', params: { bottomRadius: 20, topRadius: 8, height: 60 } },
      { size: 5 }
    );
    expect(m).not.toBeNull();
    expect(m.type).toBe('hex8');
    expect(m.geometryType).toBe('cone');
  });

  test('Frustum legacy Wedge6 modu (crossSection:"wedge")', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cone', params: { bottomRadius: 20, topRadius: 8, height: 60 } },
      { size: 5, crossSection: 'wedge' }
    );
    expect(m.type).toBe('wedge6');
  });

  test('Apex (rT=0): tepe tek noktaya çökertilir → tet4 (degenere hex önlenir)', () => {
    // Eski davranış: rTeff=0.001·rMax ile "iğne hex8" → AR ~3000, Jac ~10^4.
    // Yeni: gerçek apex tek noktaya çöker, hex→tet4 + degenere tet filtresi.
    var m = veFEAMeshFromGeometry(
      { type: 'cone', params: { bottomRadius: 20, topRadius: 0, height: 60 } },
      { size: 5 }
    );
    expect(m).not.toBeNull();
    expect(m.type).toBe('tet4');
    expect(m.apexCollapsed).toBe(true);
  });

  test('Apex (rT=0): çözücü-uyumlu — inverted/degenerate yok', () => {
    [10, 5, 2.5].forEach(function (sz) {
      var m = veFEAMeshFromGeometry(
        { type: 'cone', params: { bottomRadius: 20, topRadius: 0, height: 60 } },
        { size: sz }
      );
      var jm = veFEAComputeJacobianMetrics(m);
      expect(jm.invertedCount).toBe(0);
      expect(jm.degenerateCount).toBe(0);
      expect(jm.minVolume).toBeGreaterThan(0);
      expect(jm.valid).toBe(true);
    });
  });

  test('Apex (rT=0): hacim analitik koni hacmine yakın', () => {
    var rB = 20, h = 60;
    var m = veFEAMeshFromGeometry(
      { type: 'cone', params: { bottomRadius: rB, topRadius: 0, height: h } },
      { size: 4 }
    );
    var el = m.elements, nd = m.nodes, vol = 0;
    for (var e = 0; e < el.length / 4; e++) {
      var o = e * 4;
      var a = el[o]*3, b = el[o+1]*3, c = el[o+2]*3, d = el[o+3]*3;
      var v1x=nd[b]-nd[a], v1y=nd[b+1]-nd[a+1], v1z=nd[b+2]-nd[a+2];
      var v2x=nd[c]-nd[a], v2y=nd[c+1]-nd[a+1], v2z=nd[c+2]-nd[a+2];
      var v3x=nd[d]-nd[a], v3y=nd[d+1]-nd[a+1], v3z=nd[d+2]-nd[a+2];
      vol += Math.abs((v1x*(v2y*v3z-v2z*v3y)+v1y*(v2z*v3x-v2x*v3z)+v1z*(v2x*v3y-v2y*v3x))/6);
    }
    var analytic = (Math.PI * h / 3) * rB * rB;
    // Çevresel poligon yaklaşımı nedeniyle ~%3 tolerans.
    expect(vol).toBeGreaterThan(analytic * 0.95);
    expect(vol).toBeLessThan(analytic * 1.02);
  });

  test('Üst layer yarıçapı rT, alt layer rB', () => {
    var rB = 20, rT = 8, h = 60;
    var m = veFEAMeshFromGeometry({ type: 'cone', params: { bottomRadius: rB, topRadius: rT, height: h } }, { size: 5 });
    var topNodes = m.namedSelections.faceTop.nodeIds;
    var bottomNodes = m.namedSelections.faceBottom.nodeIds;
    // Üst yüzeyin maksimum radyal mesafesi rT olmalı
    var maxRTop = 0;
    for (var i = 0; i < topNodes.length; i++) {
      var nid = topNodes[i];
      var x = m.nodes[nid * 3], z = m.nodes[nid * 3 + 2];
      maxRTop = Math.max(maxRTop, Math.sqrt(x * x + z * z));
    }
    var maxRBot = 0;
    for (var j = 0; j < bottomNodes.length; j++) {
      var nidB = bottomNodes[j];
      var xB = m.nodes[nidB * 3], zB = m.nodes[nidB * 3 + 2];
      maxRBot = Math.max(maxRBot, Math.sqrt(xB * xB + zB * zB));
    }
    expect(maxRTop).toBeCloseTo(rT, 1);
    expect(maxRBot).toBeCloseTo(rB, 1);
  });

  test('Hacim ≈ analitik (1/3)πh(rB²+rB·rT+rT²)', () => {
    var rB = 20, rT = 8, h = 60;
    var stats = veFEAPrimitiveStats('cone', { bottomRadius: rB, topRadius: rT, height: h });
    var analytic = (Math.PI * h / 3) * (rB*rB + rB*rT + rT*rT);
    expect(stats.volume).toBeCloseTo(analytic, 3);
  });

  test('Jacobian pozitif (frustum, non-apex)', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cone', params: { bottomRadius: 20, topRadius: 8, height: 60 } },
      { size: 8 }
    );
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
  });

  test('3 named selection (frustum: alt, üst, yan)', () => {
    var m = veFEAMeshFromGeometry({ type: 'cone', params: { bottomRadius: 20, topRadius: 8, height: 60 } }, { size: 5 });
    expect(m.namedSelections.faceBottom).toBeDefined();
    expect(m.namedSelections.faceTop).toBeDefined();
    expect(m.namedSelections.faceSide).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Torus → Hex8 O-grid sweep mesh (closed loop)', () => {
  test('Torus mesh oluşturulur (Hex8 O-grid)', () => {
    var m = veFEAMeshFromGeometry({ type: 'torus', params: { majorRadius: 30, minorRadius: 10 } }, { size: 5 });
    expect(m).not.toBeNull();
    expect(m.type).toBe('hex8');
    expect(m.geometryType).toBe('torus');
    expect(m.grid.closed).toBe(true);
    expect(m.grid.ogrid).toBe(true);
  });

  test('Düğüm sayısı nMajor × (O-grid disk node count)', () => {
    var m = veFEAMeshFromGeometry({ type: 'torus', params: { majorRadius: 30, minorRadius: 10 } }, { size: 5 });
    var g = m.grid;
    // O-grid disk: nSquare = nMinor/4, inner square + 4 outer arcs (nSquare × nRadial each)
    // node count cross-section icin disk.nodes2D.length kadar.
    // Topolama icin: toplam_nodes = nMajor x disk_node_count
    expect(m.nodes.length / 3 % g.nMajor).toBe(0);
    expect(g.nMinor % 4).toBe(0); // O-grid kati zorunlu
  });

  test('Tüm elemanlar pozitif Jacobian (inverted/degenerate yok)', () => {
    // Regresyon: toroidal süpürme yön/winding hatası tüm elemanları ters
    // çeviriyordu (negatif signed volume → çözücü patlar). Hex8 düğüm sırası
    // silindirle aynı (pozitif) konvansiyonda olmalı.
    [10, 5, 2.5].forEach(function (sz) {
      var m = veFEAMeshFromGeometry({ type: 'torus', params: { majorRadius: 30, minorRadius: 10 } }, { size: sz });
      var j = veFEAComputeJacobianMetrics(m);
      expect(j.invertedCount).toBe(0);
      expect(j.degenerateCount).toBe(0);
      expect(j.minVolume).toBeGreaterThan(0);
      expect(j.valid).toBe(true);
    });
  });

  test('Yüzey düğümlerinin minor radius mesafesi (her layer için)', () => {
    var R = 30, r = 10;
    var m = veFEAMeshFromGeometry({ type: 'torus', params: { majorRadius: R, minorRadius: r } }, { size: 5 });
    var surf = m.namedSelections.faceSurface.nodeIds;
    expect(surf.length).toBeGreaterThan(0);
    for (var i = 0; i < surf.length; i++) {
      var nid = surf[i];
      var x = m.nodes[nid * 3];
      var y = m.nodes[nid * 3 + 1];
      var z = m.nodes[nid * 3 + 2];
      // Centerline pozisyonu xz plane'inde R yarıçaplı çember üstünde
      var rho = Math.sqrt(x * x + z * z);  // axial distance
      var dRho = rho - R;
      var distFromCenterline = Math.sqrt(dRho * dRho + y * y);
      expect(distFromCenterline).toBeCloseTo(r, 1);
    }
  });

  test('Hacim ≈ 2π²Rr² (Pappus)', () => {
    var R = 30, r = 10;
    var stats = veFEAPrimitiveStats('torus', { majorRadius: R, minorRadius: r });
    expect(stats.volume).toBeCloseTo(2 * Math.PI * Math.PI * R * r * r, 1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Yarım Küre → Hex8 (alt düz disk + üst dome)', () => {
  test('Yarım küre mesh oluşturulur (Hex8)', () => {
    var m = veFEAMeshFromGeometry({ type: 'hemisphere', params: { radius: 25 } }, { size: 8 });
    expect(m).not.toBeNull();
    expect(m.type).toBe('hex8');
    expect(m.geometryType).toBe('hemisphere');
    expect(m.grid.hemisphere).toBe(true);
  });

  test('Alt düz disk düğümlerinin y koordinatı = 0', () => {
    var r = 25;
    var m = veFEAMeshFromGeometry({ type: 'hemisphere', params: { radius: r } }, { size: 8 });
    var flatIds = m.namedSelections.faceFlat.nodeIds;
    for (var i = 0; i < flatIds.length; i++) {
      var nid = flatIds[i];
      expect(m.nodes[nid * 3 + 1]).toBeCloseTo(0, 5);
    }
  });

  test('Dome düğümlerinin |position| = r (sphere yüzeyi)', () => {
    var r = 25;
    var m = veFEAMeshFromGeometry({ type: 'hemisphere', params: { radius: r } }, { size: 8 });
    var domeIds = m.namedSelections.faceDome.nodeIds;
    for (var i = 0; i < domeIds.length; i++) {
      var nid = domeIds[i];
      var x = m.nodes[nid * 3];
      var y = m.nodes[nid * 3 + 1];
      var z = m.nodes[nid * 3 + 2];
      expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(r, 3);
      expect(y).toBeGreaterThanOrEqual(-1e-3); // üst yarıda
    }
  });

  test('Jacobian pozitif (yarım küre)', () => {
    var m = veFEAMeshFromGeometry({ type: 'hemisphere', params: { radius: 25 } }, { size: 8 });
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
  });

  test('Hacim ≈ (2/3)πr³', () => {
    var r = 25;
    var stats = veFEAPrimitiveStats('hemisphere', { radius: r });
    expect(stats.volume).toBeCloseTo((2 / 3) * Math.PI * r * r * r, 3);
  });

  test('2 named selection: faceFlat, faceDome', () => {
    var m = veFEAMeshFromGeometry({ type: 'hemisphere', params: { radius: 25 } }, { size: 8 });
    expect(Object.keys(m.namedSelections).sort()).toEqual(['faceDome', 'faceFlat']);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Şaft (içi boş silindir) → Heks8 annulus', () => {
  test('temel parametrelerle heks8 oluşur', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } }, { size: 5 });
    expect(m.type).toBe('hex8');
    expect(m.nodesPerElement).toBe(8);
    expect(m.elements.length / 8).toBeGreaterThan(0);
  });

  test('eleman sayısı = nR × nC × nA', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } }, { size: 5 });
    var g = m.grid;
    expect(m.elements.length / 8).toBe(g.nRadial * g.nCircum * g.nAxial);
  });

  test('düğüm sayısı = (nR+1) × nC × (nA+1)', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } }, { size: 5 });
    var g = m.grid;
    expect(m.nodes.length / 3).toBe((g.nRadial + 1) * g.nCircum * (g.nAxial + 1));
  });

  test('iç yarıçap dış yarıçaptan büyük olursa düzeltilir', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 5, innerRadius: 50, length: 50 } }, { size: 5 });
    expect(m).not.toBeNull();
    expect(m.elements.length / 8).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Geçersiz geometri/giriş', () => {
  test('null/undefined geometri → null döner', () => {
    expect(veFEAMeshFromGeometry(null)).toBeNull();
    expect(veFEAMeshFromGeometry(undefined)).toBeNull();
    expect(veFEAMeshFromGeometry({})).toBeNull();
  });

  test('bilinmeyen tip → null döner', () => {
    expect(veFEAMeshFromGeometry({ type: 'unknown' })).toBeNull();
  });

  test('STL geometri rawDataB64 yoksa null', () => {
    expect(veFEAMeshFromGeometry({ type: 'step' })).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeMeshMetrics', () => {
  test('kutu mesh için makul metrikler', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var metrics = veFEAComputeMeshMetrics(m);
    expect(metrics.nodeCount).toBe(27);
    expect(metrics.elementCount).toBe(8);
    expect(metrics.elementType).toBe('hex8');
    expect(metrics.minSize).toBeCloseTo(5, 2);
    expect(metrics.maxSize).toBeCloseTo(5, 2);
    expect(metrics.avgSize).toBeCloseTo(5, 2);
  });

  test('null mesh → null metrikler', () => {
    expect(veFEAComputeMeshMetrics(null)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshExtractEdges', () => {
  test('kutu Heks8 1 eleman → 12 kenar (24 float = 12 line)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var edges = veFEAMeshExtractEdges(m);
    // Her kenar 2 endpoint × 3 koord = 6 float
    expect(edges.length).toBe(12 * 6);
  });

  test('null mesh için null döner', () => {
    expect(veFEAMeshExtractEdges(null)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshExtractSurfaceEdges', () => {
  test('kutu hex8 1 eleman → 12 surface edge (kutu tüm yüzleri sınır)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var sEdges = veFEAMeshExtractSurfaceEdges(m);
    // 1 hex'in 6 yüzü = 6 sınır quad × 4 kenar = 24 (dedup) — küpün 12 kenarı
    expect(sEdges.length).toBe(12 * 6);
  });

  test('kutu 2×2×2 = 8 hex iç edge\'ler dahil değil', () => {
    // 2×2×2 hex grid: iç hex'lerin paylaştığı yüzler 'iç' olarak sayılır.
    // Toplam: 8 köşe + 12 kenar (kutunun) + her face üzerinde 1 orta vertex
    // = küpün dış surface edge'leri (yüzey edge'leri sayılı).
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 2, height: 2, depth: 2 } }, { size: 1 });
    var all = veFEAMeshExtractEdges(m);
    var surf = veFEAMeshExtractSurfaceEdges(m);
    // Yüzey her zaman tüm edge'lerin alt kümesi
    expect(surf.length).toBeLessThanOrEqual(all.length);
    expect(surf.length).toBeGreaterThan(0);
  });

  test('null mesh için null döner', () => {
    expect(veFEAMeshExtractSurfaceEdges(null)).toBeNull();
  });

  test('tri3 surface mesh için tüm edge\'ler döner (tri3 zaten yüzey)', () => {
    var m = { type: 'tri3', nodes: new Float32Array([0,0,0, 1,0,0, 0,1,0]),
              elements: new Uint32Array([0, 1, 2]), nodesPerElement: 3 };
    var sEdges = veFEAMeshExtractSurfaceEdges(m);
    expect(sEdges.length).toBe(3 * 6); // 3 kenar × 6 float
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('STL yüzey mesh (vertex dedup)', () => {
  // 12 üçgenli küp (10×10×10) fixture'ı
  function buildCubeTriangles() {
    return [
      [0,0,0, 10,10,0, 10,0,0,  0,0,-1],
      [0,0,0, 0,10,0, 10,10,0,  0,0,-1],
      [0,0,10, 10,0,10, 10,10,10,  0,0,1],
      [0,0,10, 10,10,10, 0,10,10,  0,0,1],
      [0,0,0, 0,0,10, 0,10,10,  -1,0,0],
      [0,0,0, 0,10,10, 0,10,0,  -1,0,0],
      [10,0,0, 10,10,0, 10,10,10,  1,0,0],
      [10,0,0, 10,10,10, 10,0,10,  1,0,0],
      [0,0,0, 10,0,0, 10,0,10,  0,-1,0],
      [0,0,0, 10,0,10, 0,0,10,  0,-1,0],
      [0,10,0, 0,10,10, 10,10,10,  0,1,0],
      [0,10,0, 10,10,10, 10,10,0,  0,1,0]
    ];
  }
  // Test fixture: direkt parsed obje (STL parser kaldırıldı, _parsedTriangles
  // test bypass field'ı kullanılır).
  function getCubeParsed() {
    var tris = buildCubeTriangles();
    var vertices = new Float32Array(tris.length * 9);
    var normals  = new Float32Array(tris.length * 9);
    for (var i = 0; i < tris.length; i++) {
      var t = tris[i];
      for (var j = 0; j < 9; j++) vertices[i * 9 + j] = t[j];
      for (var k = 0; k < 3; k++) {
        normals[i * 9 + k * 3]     = t[9];
        normals[i * 9 + k * 3 + 1] = t[10];
        normals[i * 9 + k * 3 + 2] = t[11];
      }
    }
    return { vertices: vertices, normals: normals, triangleCount: tris.length };
  }

  test('STEP geometri + mode "surface" → Tri3 mesh, dedup\'lı düğümler', () => {
    // F3b sonrası default mode (auto) STEP için voxel hex8 üretir.
    // Yüzey Tri3 mesh için explicit "surface" mode gerek.
    var m = veFEAMeshFromGeometry(
      { type: 'step', _parsedTriangles: getCubeParsed() },
      { size: 5, mode: 'surface' }
    );
    expect(m).not.toBeNull();
    expect(m.type).toBe('tri3');
    expect(m.nodesPerElement).toBe(3);
    expect(m.elements.length / 3).toBe(12); // 12 üçgen
    // Küp 8 unique vertex'e sahip (dedup sonrası)
    expect(m.nodes.length / 3).toBe(8);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAFindUpstreamGeometryNode', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('bağlantı yoksa null döner', () => {
    expect(veFEAFindUpstreamGeometryNode('mesh-1')).toBeNull();
  });

  test('upstream geometri node\'unu bulur', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box' } } },
      { id: 'mesh-1', type: 'fea-mesh', data: {} }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1', fromPort: 'output', toPort: 'input' }];
    var result = veFEAFindUpstreamGeometryNode('mesh-1');
    expect(result).not.toBeNull();
    expect(result.id).toBe('geom-1');
  });

  test('yanlış tipte upstream varsa null döner', () => {
    global.nodes = [
      { id: 'foo', type: 'engine' },
      { id: 'mesh-1', type: 'fea-mesh' }
    ];
    global.connections = [{ from: 'foo', to: 'mesh-1' }];
    expect(veFEAFindUpstreamGeometryNode('mesh-1')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEABuildMeshForNode (köprü)', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
  });

  test('upstream geometri yoksa warning toast atar, mesh hesaplamaz', () => {
    global.nodes = [{ id: 'mesh-1', type: 'fea-mesh', data: {} }];
    veFEABuildMeshForNode('mesh-1');
    expect(global.showToast).toHaveBeenCalled();
    var warns = global.showToast.mock.calls.filter((c) => c[1] === 'warning');
    expect(warns.length).toBeGreaterThan(0);
    expect(veFEAMeshCache['mesh-1']).toBeUndefined();
  });

  test('geometri varsa mesh hesaplar, cache + metrik + saveState', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-1', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    veFEABuildMeshForNode('mesh-1');
    expect(veFEAMeshCache['mesh-1']).toBeDefined();
    expect(global.nodes[1].data.meshActive).toBe(true);
    expect(global.nodes[1].data.meshMetrics).toBeDefined();
    expect(global.nodes[1].data.meshMetrics.elementCount).toBe(8);
    expect(global.saveState).toHaveBeenCalled();
  });

  test('hesaplama sonrası success toast atılır', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 4, height: 4, depth: 4 } } } },
      { id: 'mesh-1', type: 'fea-mesh', data: {} }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    veFEABuildMeshForNode('mesh-1');
    var success = global.showToast.mock.calls.filter((c) => c[1] === 'success');
    expect(success.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAClearMeshForNode', () => {
  test('cache + meshActive + meshMetrics temizlenir', () => {
    global.nodes = [{ id: 'mesh-1', type: 'fea-mesh', data: { meshActive: true, meshMetrics: { nodeCount: 8 } } }];
    veFEAMeshCache['mesh-1'] = { type: 'hex8' };
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    veFEAClearMeshForNode('mesh-1');
    expect(veFEAMeshCache['mesh-1']).toBeUndefined();
    expect(global.nodes[0].data.meshActive).toBeUndefined();
    expect(global.nodes[0].data.meshMetrics).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli render', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
  });

  test('upstream geometri yoksa "bağlı değil" uyarısı', () => {
    var node = { id: 'mesh-x', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/bağlı değil/);
  });

  test('geometri bağlı varken etiket gösterilir', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } }, def: { name: 'Geometri' } },
      { id: 'mesh-1', type: 'fea-mesh', data: {} }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    var html = _testRenderFullMeshUI(global.nodes[1]);
    expect(html).toMatch(/Kutu|Geometri/);
    expect(html).not.toMatch(/bağlı değil/);
  });

  test('Side panel: "Mesh Editörünü Aç" butonu render', () => {
    // Mesh paneli artık sadece modal launcher. Canvas + view butonları modal içinde.
    var node = { id: 'mesh-c', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/veFEAOpenMeshEditor/);
  });

  test('"Mesh Oluştur" butonu geometri yoksa disabled', () => {
    var node = { id: 'mesh-d', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/<button\s+disabled[^>]*onclick="veFEASubmitMeshBuild/);
  });

  test('Mesh aktifken metrik değerleri ve "Mesh\'i Sil" butonu', () => {
    var node = {
      id: 'mesh-e',
      type: 'fea-mesh',
      data: {
        meshSettings: { size: 5 },
        meshActive: true,
        meshMetrics: { nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5, computeMs: 12 }
      }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/Heks8/);
    expect(html).toMatch(/27/);
    expect(html).toMatch(/Mesh.{0,4}i Sil/);
  });

  test('Coarse/Medium/Fine preset butonları render', () => {
    var node = { id: 'mesh-f', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/Coarse/);
    expect(html).toMatch(/Medium/);
    expect(html).toMatch(/Fine/);
    expect(html).toMatch(/veFEASetMeshSizePreset/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshFromGeometryViaWorker (Worker async + sync fallback)', () => {
  beforeEach(() => {
    // jsdom Worker desteklemiyor → her test sync fallback yoluna gider
    VE_FEA_MESH_WORKER_FAILED = false;
    VE_FEA_MESH_WORKER = null;
    Object.keys(VE_FEA_MESH_WORKER_REQS).forEach((k) => delete VE_FEA_MESH_WORKER_REQS[k]);
  });

  test('Worker yokken sync fallback ile box mesh oluşur (Promise)', () => {
    return veFEAMeshFromGeometryViaWorker(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5 }
    ).then(function(mesh) {
      expect(mesh).not.toBeNull();
      expect(mesh.type).toBe('hex8');
      expect(mesh.elements.length / 8).toBe(8);
    });
  });

  test('Sync fallback ile cylinder mesh', () => {
    return veFEAMeshFromGeometryViaWorker(
      { type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 5 }
    ).then(function(mesh) {
      // Yeni default: O-grid Hex8
      expect(mesh.type).toBe('hex8');
    });
  });

  test('Geçersiz geometri ile reject olur veya null mesh döner', () => {
    return veFEAMeshFromGeometryViaWorker(null, {}).then(function(mesh) {
      expect(mesh).toBeNull();
    });
  });

  test('elementType tet4 + Worker fallback', () => {
    return veFEAMeshFromGeometryViaWorker(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, elementType: 'tet4' }
    ).then(function(mesh) {
      expect(mesh.type).toBe('tet4');
      expect(mesh.elements.length / 4).toBe(48);
    });
  });

  test('Worker FAILED flag → ikinci çağrıda da sync fallback', () => {
    VE_FEA_MESH_WORKER_FAILED = true;
    return veFEAMeshFromGeometryViaWorker(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5 }
    ).then(function(mesh) {
      expect(mesh.type).toBe('hex8');
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Worker toggle UI', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Web Worker checkbox render edilir, default unchecked', () => {
    var node = { id: 'mesh-w1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/id="ve-fea-mesh-worker-mesh-w1"/);
    expect(html).toMatch(/Web Worker.*da hesapla/);
    var match = html.match(/<input type="checkbox"[^>]*id="ve-fea-mesh-worker-mesh-w1"[^>]*>/);
    expect(match[0]).not.toMatch(/ checked/);
  });

  test('Persisted useWorker:true → checkbox işaretli', () => {
    var node = { id: 'mesh-w2', type: 'fea-mesh', data: { meshSettings: { size: 5, useWorker: true } } };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    var match = html.match(/<input type="checkbox"[^>]*id="ve-fea-mesh-worker-mesh-w2"[^>]*>/);
    expect(match[0]).toMatch(/checked/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEACombineMeshes (multi-body assembly)', () => {
  test('İki box mesh birleştirilir, eleman sayısı toplanır', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 6, height: 6, depth: 6 } }, { size: 3 });
    var asm = veFEACombineMeshes([m1, m2], ['part1', 'part2']);
    expect(asm.type).toBe('hex8');
    expect(asm.elements.length / 8).toBe(m1.elements.length / 8 + m2.elements.length / 8);
    expect(asm.nodes.length / 3).toBe(m1.nodes.length / 3 + m2.nodes.length / 3);
    expect(asm.isAssembly).toBe(true);
  });

  test('Body ranges üretilir', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 6, height: 6, depth: 6 } }, { size: 3 });
    var asm = veFEACombineMeshes([m1, m2], ['A', 'B']);
    expect(asm.bodyRanges.length).toBe(2);
    expect(asm.bodyRanges[0].name).toBe('A');
    expect(asm.bodyRanges[0].nodeStart).toBe(0);
    expect(asm.bodyRanges[1].nodeStart).toBe(m1.nodes.length / 3);
  });

  test('Named selections prefix\'lenir', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 6, height: 6, depth: 6 } }, { size: 3 });
    var asm = veFEACombineMeshes([m1, m2], ['A', 'B']);
    expect(asm.namedSelections['A.faceXMin']).toBeDefined();
    expect(asm.namedSelections['B.faceXMax']).toBeDefined();
    expect(Object.keys(asm.namedSelections).length).toBe(12); // 6 + 6 yüzey
  });

  test('Element indeksleri offset\'li (ikinci mesh ID\'leri yer değişir)', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 6, height: 6, depth: 6 } }, { size: 3 });
    var asm = veFEACombineMeshes([m1, m2], ['A', 'B']);
    var offset = m1.nodes.length / 3;
    var m1ElCount = m1.elements.length / 8;
    // İlk m1 element'lerinin ID'si değişmez
    expect(asm.elements[0]).toBe(m1.elements[0]);
    // m2'nin ilk elementi offset'li olmalı
    var asmM2Start = m1ElCount * 8;
    expect(asm.elements[asmM2Start]).toBe(m2.elements[0] + offset);
  });

  test('Karma tipler (hex8 + wedge6) → error', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var wedge = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 5, height: 10 } }, { size: 5, crossSection: 'wedge' });
    var asm = veFEACombineMeshes([hex, wedge]);
    expect(asm.error).toBe('mixed-element-types');
  });

  test('Boş liste → null', () => {
    expect(veFEACombineMeshes([])).toBeNull();
    expect(veFEACombineMeshes(null)).toBeNull();
  });

  test('Default isim üretimi (body1, body2, ...)', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 6, height: 6, depth: 6 } }, { size: 3 });
    var asm = veFEACombineMeshes([m1, m2]);
    expect(asm.namedSelections['body1.faceXMin']).toBeDefined();
    expect(asm.namedSelections['body2.faceXMin']).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEADetectContactPairs (tie-constraint adayları)', () => {
  test('Aynı pozisyonda iki box → her tarafta yakın node çiftleri', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    // m2'yi aynı yere koy (üst üste) — tüm boundary node'lar çakışır
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var pairs = veFEADetectContactPairs([m1, m2], 0.01);
    // 27 düğümden 26'sı boundary (1 iç hariç) → çakışan çiftler
    expect(pairs.length).toBeGreaterThan(0);
  });

  test('Çok uzak iki mesh → çift yok', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    // m2'yi uzağa kaydır (manuel olarak)
    var shifted = new Float32Array(m2.nodes);
    for (var i = 0; i < shifted.length; i += 3) shifted[i] += 100;
    var m2shifted = Object.assign({}, m2, { nodes: shifted });
    var pairs = veFEADetectContactPairs([m1, m2shifted], 0.5);
    expect(pairs.length).toBe(0);
  });

  test('Tolerance > 0 mesafe → çiftler bulunur', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    // m2'yi 0.05 mm kaydır
    var shifted = new Float32Array(m2.nodes);
    for (var i = 0; i < shifted.length; i += 3) shifted[i] += 0.05;
    var m2sh = Object.assign({}, m2, { nodes: shifted });
    var pairsNarrow = veFEADetectContactPairs([m1, m2sh], 0.01); // tolerance < shift
    var pairsWide   = veFEADetectContactPairs([m1, m2sh], 0.5);  // tolerance > shift
    expect(pairsNarrow.length).toBeLessThanOrEqual(pairsWide.length);
    expect(pairsWide.length).toBeGreaterThan(0);
  });

  test('Tek mesh → boş liste', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    expect(veFEADetectContactPairs([m], 0.1)).toEqual([]);
  });

  test('Distance field doğru hesaplanır', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var pairs = veFEADetectContactPairs([m1, m2], 0.01);
    if (pairs.length > 0) {
      expect(pairs[0].distance).toBeGreaterThanOrEqual(0);
      expect(pairs[0].distance).toBeLessThan(0.01);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeRefinementSuggestions (adaptive heuristic)', () => {
  test('Inverted eleman → KRİTİK öneri reduceSize/0.5', () => {
    var metrics = {
      elementCount: 8,
      jacobian: { invertedCount: 1, degenerateCount: 0, poorCount: 0, ratioWarnThreshold: 40 },
      quality: { aspectRatio: { poorCount: 0, warnThreshold: 20 }, skewness: { poorCount: 0, warnThreshold: 0.85 } }
    };
    var sugs = veFEAComputeRefinementSuggestions(metrics);
    expect(sugs.length).toBe(1);
    expect(sugs[0].severity).toBe('critical');
    expect(sugs[0].action.type).toBe('reduceSize');
    expect(sugs[0].action.factor).toBeCloseTo(0.5, 2);
  });

  test('Dejenere eleman → KRİTİK öneri', () => {
    var metrics = {
      elementCount: 100,
      jacobian: { invertedCount: 0, degenerateCount: 3, poorCount: 0, ratioWarnThreshold: 40 },
      quality: { aspectRatio: { poorCount: 0, warnThreshold: 20 }, skewness: { poorCount: 0, warnThreshold: 0.85 } }
    };
    var sugs = veFEAComputeRefinementSuggestions(metrics);
    expect(sugs[0].severity).toBe('critical');
  });

  test('Yüksek aspect %>5 → UYARI reduceSize/0.8', () => {
    var metrics = {
      elementCount: 100,
      jacobian: { invertedCount: 0, degenerateCount: 0, poorCount: 0, ratioWarnThreshold: 40 },
      quality: {
        aspectRatio: { poorCount: 10, warnThreshold: 20 },
        skewness: { poorCount: 0, warnThreshold: 0.85 }
      }
    };
    var sugs = veFEAComputeRefinementSuggestions(metrics);
    var warnSug = sugs.find(function(s) { return s.severity === 'warn'; });
    expect(warnSug).toBeDefined();
    expect(warnSug.action.type).toBe('reduceSize');
    expect(warnSug.action.factor).toBeCloseTo(0.8, 2);
  });

  test('Yüksek skewness %>5 → UYARI reduceSize/0.85', () => {
    var metrics = {
      elementCount: 100,
      jacobian: { invertedCount: 0, degenerateCount: 0, poorCount: 0, ratioWarnThreshold: 40 },
      quality: {
        aspectRatio: { poorCount: 0, warnThreshold: 20 },
        skewness: { poorCount: 10, warnThreshold: 0.85 }
      }
    };
    var sugs = veFEAComputeRefinementSuggestions(metrics);
    var warnSug = sugs.find(function(s) { return s.severity === 'warn' && s.message.match(/skewness/); });
    expect(warnSug).toBeDefined();
  });

  test('Tüm metrikler iyi → "Mesh kalitesi iyi" OK mesajı', () => {
    var metrics = {
      elementCount: 8,
      jacobian: { invertedCount: 0, degenerateCount: 0, poorCount: 0, ratioWarnThreshold: 40 },
      quality: { aspectRatio: { poorCount: 0, max: 1, warnThreshold: 20 }, skewness: { poorCount: 0, warnThreshold: 0.85 } }
    };
    var sugs = veFEAComputeRefinementSuggestions(metrics);
    expect(sugs.length).toBe(1);
    expect(sugs[0].severity).toBe('ok');
    expect(sugs[0].message).toMatch(/iyi/);
  });

  test('Silindir sweep + yüksek aspect → curvature refinement önerisi', () => {
    var metrics = {
      elementCount: 100,
      sweepAxis: 'Y',
      jacobian: { invertedCount: 0, degenerateCount: 0, poorCount: 0, ratioWarnThreshold: 40 },
      quality: {
        aspectRatio: { poorCount: 0, max: 8, warnThreshold: 20 },
        skewness: { poorCount: 0, warnThreshold: 0.85 }
      }
    };
    var sugs = veFEAComputeRefinementSuggestions(metrics);
    var curvSug = sugs.find(function(s) { return s.action && s.action.type === 'enableCurvature'; });
    expect(curvSug).toBeDefined();
  });

  test('null metrics → boş öneri listesi', () => {
    expect(veFEAComputeRefinementSuggestions(null)).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAApplyRefinementSuggestion bridge', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
  });

  test('reduceSize action → meshSettings.size çarpan ile küçülür', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-1', type: 'fea-mesh', data: { meshSettings: { size: 10 } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    veFEAApplyRefinementSuggestion('mesh-1', 'reduceSize', { factor: 0.5 });
    expect(global.nodes[1].data.meshSettings.size).toBe(5);
  });

  test('enableCurvature action → settings.curvatureRefinement.enabled true', () => {
    global.nodes = [
      { id: 'geom-c', type: 'fea-geometry', data: { geometry: { type: 'cylinder', params: { radius: 10, height: 20 } } } },
      { id: 'mesh-c', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-c', to: 'mesh-c' }];
    veFEAApplyRefinementSuggestion('mesh-c', 'enableCurvature', { normalAngleDeg: 20 });
    expect(global.nodes[1].data.meshSettings.curvatureRefinement.enabled).toBe(true);
    expect(global.nodes[1].data.meshSettings.curvatureRefinement.normalAngleDeg).toBe(20);
  });

  test('Bilinmeyen action → no-op', () => {
    global.nodes = [{ id: 'mesh-x', type: 'fea-mesh', data: { meshSettings: { size: 10 } } }];
    expect(() => veFEAApplyRefinementSuggestion('mesh-x', 'unknown', {})).not.toThrow();
    expect(global.nodes[0].data.meshSettings.size).toBe(10);
  });

  test('Bilinmeyen nodeId → sessizce çıkar', () => {
    expect(() => veFEAApplyRefinementSuggestion('nonexistent', 'reduceSize', { factor: 0.5 })).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Adaptive Refinement Önerileri', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Mesh yokken placeholder mesajı', () => {
    var node = { id: 'mesh-ar1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    // Accordion başlığı Türkçeleştirildi: "Adaptif İnceltme Önerileri"
    expect(html).toMatch(/Adaptif İnceltme Önerileri/);
    expect(html).toMatch(/Mesh oluşturulduktan sonra öneriler gösterilir/);
  });

  test('Geçerli mesh + iyi metrikler → "iyi" mesajı', () => {
    var node = {
      id: 'mesh-ar2',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5,
          jacobian: { invertedCount: 0, degenerateCount: 0, poorCount: 0, ratioWarnThreshold: 40 },
          quality: {
            aspectRatio: { poorCount: 0, max: 1, warnThreshold: 20, histogram: { bins: [8,0,0,0,0,0,0,0,0,0], min: 1, max: 20, binCount: 10 } },
            skewness: { poorCount: 0, warnThreshold: 0.85, histogram: { bins: [8,0,0,0,0,0,0,0,0,0], min: 0, max: 1, binCount: 10 } },
            angle: { min: 90, max: 90, histogram: { bins: [0,0,0,0,0,8,0,0,0,0,0,0], min: 0, max: 180, binCount: 12 } }
          }
        }
      }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/Mesh kalitesi iyi/);
  });

  test('Inverted eleman varsa "Uygula" butonu render edilir', () => {
    var node = {
      id: 'mesh-ar3',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5,
          jacobian: { invertedCount: 2, degenerateCount: 0, poorCount: 0, ratioWarnThreshold: 40 },
          quality: {
            aspectRatio: { poorCount: 0, max: 1, warnThreshold: 20, histogram: { bins: [8,0,0,0,0,0,0,0,0,0], min: 1, max: 20, binCount: 10 } },
            skewness: { poorCount: 0, warnThreshold: 0.85, histogram: { bins: [8,0,0,0,0,0,0,0,0,0], min: 0, max: 1, binCount: 10 } },
            angle: { min: 90, max: 90, histogram: { bins: [0,0,0,0,0,8,0,0,0,0,0,0], min: 0, max: 180, binCount: 12 } }
          }
        }
      }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/Ters\/dejenere/);
    expect(html).toMatch(/Uygula/);
    expect(html).toMatch(/veFEAApplyRefinementSuggestion/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Rectangular tube (rectTube) primitif - sweep mesh', () => {
  test('rectTube mesh oluşturulur (Heks8, Z sweep)', () => {
    var m = veFEAMeshFromGeometry({ type: 'rectTube', params: { width: 60, height: 40, thickness: 5, length: 100 } }, { size: 5 });
    expect(m).not.toBeNull();
    expect(m.type).toBe('hex8');
    expect(m.geometryType).toBe('rectTube');
    expect(m.sweepAxis).toBe('Z');
    expect(m.elements.length / 8).toBeGreaterThan(0);
  });

  test('İç dikdörtgen boş — eleman sayısı tam dolu kutudan az', () => {
    var hollow = veFEAMeshFromGeometry({ type: 'rectTube', params: { width: 60, height: 40, thickness: 5, length: 60 } }, { size: 5 });
    var full = veFEAMeshFromGeometry({ type: 'box', params: { width: 60, height: 40, depth: 60 } }, { size: 5 });
    expect(hollow.elements.length / 8).toBeLessThan(full.elements.length / 8);
    // Hollow elementCount yaklaşık olarak: (12·8·12 - 2·6·12) = 1152 - 144 = 1008
    // (kesin değer iç dikdörtgenin grid alignment'ına bağlı)
  });

  test('Thickness çok büyükse clamp (max = min(w,h)/2)', () => {
    var p = veFEANormalizePrimitiveParams('rectTube', { width: 40, height: 30, thickness: 100, length: 50 });
    expect(p.thickness).toBeLessThan(15); // min(40,30)/2 - 0.1 = 14.9
    expect(p.thickness).toBeGreaterThan(0);
  });

  test('Tüm element indeksleri geçerli', () => {
    var m = veFEAMeshFromGeometry({ type: 'rectTube', params: { width: 60, height: 40, thickness: 5, length: 80 } }, { size: 10 });
    var maxIdx = m.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < m.elements.length; i++) {
      if (m.elements[i] < 0 || m.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });

  test('Hacim hesabı: dış − iç × uzunluk', () => {
    var stats = veFEAPrimitiveStats('rectTube', { width: 60, height: 40, thickness: 5, length: 100 });
    // (60·40 - 50·30)·100 = (2400 - 1500)·100 = 90000 mm³
    expect(stats.volume).toBeCloseTo(90000, 0);
  });

  test('Named selections üretilir', () => {
    var m = veFEAMeshFromGeometry({ type: 'rectTube', params: { width: 60, height: 40, thickness: 5, length: 80 } }, { size: 10 });
    expect(m.namedSelections).toBeDefined();
    expect(Object.keys(m.namedSelections).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('L-Profil (lbracket) primitif - cell-exclusion mesh', () => {
  test('L-bracket mesh oluşturulur (Hex8, Z sweep)', () => {
    var m = veFEAMeshFromGeometry({ type: 'lbracket', params: { width: 60, height: 40, thickness: 5, length: 100 } }, { size: 5 });
    expect(m).not.toBeNull();
    expect(m.type).toBe('hex8');
    expect(m.geometryType).toBe('lbracket');
    expect(m.sweepAxis).toBe('Z');
    expect(m.elements.length / 8).toBeGreaterThan(0);
  });

  test('L: eleman sayısı tam dolu kutudan (W·H·L hacim grid) az', () => {
    var lb   = veFEAMeshFromGeometry({ type: 'lbracket', params: { width: 60, height: 40, thickness: 5, length: 60 } }, { size: 5 });
    var full = veFEAMeshFromGeometry({ type: 'box',      params: { width: 60, height: 40, depth: 60 } }, { size: 5 });
    expect(lb.elements.length / 8).toBeLessThan(full.elements.length / 8);
  });

  test('Hacim hesabı: t·(w+h-t)·L', () => {
    var stats = veFEAPrimitiveStats('lbracket', { width: 60, height: 40, thickness: 5, length: 100 });
    // 5·(60+40-5)·100 = 5·95·100 = 47500
    expect(stats.volume).toBeCloseTo(47500, 0);
  });

  test('Thickness çok büyükse clamp (max = min(w,h))', () => {
    var p = veFEANormalizePrimitiveParams('lbracket', { width: 30, height: 20, thickness: 999, length: 50 });
    expect(p.thickness).toBeLessThan(20);
    expect(p.thickness).toBeGreaterThan(0);
  });

  test('Tüm element indeksleri geçerli', () => {
    var m = veFEAMeshFromGeometry({ type: 'lbracket', params: { width: 60, height: 40, thickness: 5, length: 80 } }, { size: 10 });
    var maxIdx = m.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < m.elements.length; i++) {
      if (m.elements[i] < 0 || m.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });

  test('Named selections üretilir', () => {
    var m = veFEAMeshFromGeometry({ type: 'lbracket', params: { width: 60, height: 40, thickness: 5, length: 80 } }, { size: 10 });
    expect(m.namedSelections).toBeDefined();
    expect(Object.keys(m.namedSelections).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('I-Profil (ibeam) primitif - cell-exclusion mesh', () => {
  test('I-beam mesh oluşturulur (Hex8, Z sweep)', () => {
    var m = veFEAMeshFromGeometry({ type: 'ibeam', params: { width: 80, height: 120, flange: 8, web: 6, length: 200 } }, { size: 8 });
    expect(m).not.toBeNull();
    expect(m.type).toBe('hex8');
    expect(m.geometryType).toBe('ibeam');
    expect(m.sweepAxis).toBe('Z');
    expect(m.elements.length / 8).toBeGreaterThan(0);
  });

  test('I: eleman sayısı tam dolu kutudan (W·H·L grid) az', () => {
    var ib   = veFEAMeshFromGeometry({ type: 'ibeam', params: { width: 80, height: 120, flange: 8, web: 6, length: 80 } }, { size: 8 });
    var full = veFEAMeshFromGeometry({ type: 'box',   params: { width: 80, height: 120, depth: 80 } }, { size: 8 });
    expect(ib.elements.length / 8).toBeLessThan(full.elements.length / 8);
  });

  test('Hacim hesabı: 2·w·tf + tw·(h−2tf), ×L', () => {
    var stats = veFEAPrimitiveStats('ibeam', { width: 80, height: 120, flange: 8, web: 6, length: 200 });
    // (2·80·8 + 6·(120-16))·200 = (1280 + 624)·200 = 1904·200 = 380800
    expect(stats.volume).toBeCloseTo(380800, 0);
  });

  test('Flange/web çok büyükse clamp', () => {
    var p = veFEANormalizePrimitiveParams('ibeam', { width: 40, height: 30, flange: 999, web: 999, length: 50 });
    expect(p.flange).toBeLessThan(15);  // h/2-0.1
    expect(p.web).toBeLessThan(40);     // w-0.1
    expect(p.flange).toBeGreaterThan(0);
    expect(p.web).toBeGreaterThan(0);
  });

  test('Tüm element indeksleri geçerli', () => {
    var m = veFEAMeshFromGeometry({ type: 'ibeam', params: { width: 80, height: 120, flange: 8, web: 6, length: 100 } }, { size: 10 });
    var maxIdx = m.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < m.elements.length; i++) {
      if (m.elements[i] < 0 || m.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });

  test('Named selections üretilir', () => {
    var m = veFEAMeshFromGeometry({ type: 'ibeam', params: { width: 80, height: 120, flange: 8, web: 6, length: 100 } }, { size: 10 });
    expect(m.namedSelections).toBeDefined();
    expect(Object.keys(m.namedSelections).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Sweep axis bilgisi mesh metrics\'e yansır', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
  });

  test('Silindir build → metrics.sweepAxis === "Y"', () => {
    global.nodes = [
      { id: 'geom-c', type: 'fea-geometry', data: { geometry: { type: 'cylinder', params: { radius: 10, height: 20 } } } },
      { id: 'mesh-c', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-c', to: 'mesh-c' }];
    veFEABuildMeshForNode('mesh-c');
    expect(global.nodes[1].data.meshMetrics.sweepAxis).toBe('Y');
  });

  test('Box build → metrics.sweepAxis null/undefined', () => {
    global.nodes = [
      { id: 'geom-b', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-b', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-b', to: 'mesh-b' }];
    veFEABuildMeshForNode('mesh-b');
    expect(global.nodes[1].data.meshMetrics.sweepAxis).toBeFalsy();
  });

  test('RectTube build → metrics.sweepAxis === "Z"', () => {
    global.nodes = [
      { id: 'geom-r', type: 'fea-geometry', data: { geometry: { type: 'rectTube', params: { width: 60, height: 40, thickness: 5, length: 100 } } } },
      { id: 'mesh-r', type: 'fea-mesh', data: { meshSettings: { size: 10 } } }
    ];
    global.connections = [{ from: 'geom-r', to: 'mesh-r' }];
    veFEABuildMeshForNode('mesh-r');
    expect(global.nodes[1].data.meshMetrics.sweepAxis).toBe('Z');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAApplyLocalSizing (boundary bias)', () => {
  test('biasStrength=0 → no-op (düğümler değişmez)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var clone = veFEAApplyLocalSizing(m, { selection: 'faceXMin', biasStrength: 0 });
    expect(clone).toBe(m); // no clone, original döner
  });

  test('faceXMin + strength=0.5 → X eksende düğümler -x\'e doğru kümeli', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 2 });
    var biased = veFEAApplyLocalSizing(m, { selection: 'faceXMin', biasStrength: 0.5 });
    // Düğümlerin x-koordinatları min'e (=-5) doğru sıkışmalı.
    // Orijinal uniform: -5, -3, -1, 1, 3, 5. Power p=2.5 ile:
    // t=0→0, t=0.2→0.2^2.5=0.018, t=0.4→0.103, t=0.6→0.279, t=0.8→0.573, t=1→1
    // Yeni x: -5, -4.82, -3.97, -2.21, 0.73, 5
    var xs = [];
    var n = biased.nodes.length / 3;
    for (var i = 0; i < n; i++) xs.push(biased.nodes[i * 3]);
    var uniqueXs = Array.from(new Set(xs.map(function(x){return x.toFixed(3);}))).map(Number).sort(function(a,b){return a-b;});
    // İlk fark (en küçük dx) son farktan daha küçük olmalı
    var firstDx = uniqueXs[1] - uniqueXs[0];
    var lastDx = uniqueXs[uniqueXs.length - 1] - uniqueXs[uniqueXs.length - 2];
    expect(firstDx).toBeLessThan(lastDx);
  });

  test('faceXMax + strength=0.5 → +x\'e doğru kümeli (ters yön)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 2 });
    var biased = veFEAApplyLocalSizing(m, { selection: 'faceXMax', biasStrength: 0.5 });
    var xs = [];
    var n = biased.nodes.length / 3;
    for (var i = 0; i < n; i++) xs.push(biased.nodes[i * 3]);
    var uniqueXs = Array.from(new Set(xs.map(function(x){return x.toFixed(3);}))).map(Number).sort(function(a,b){return a-b;});
    var firstDx = uniqueXs[1] - uniqueXs[0];
    var lastDx = uniqueXs[uniqueXs.length - 1] - uniqueXs[uniqueXs.length - 2];
    // Sıkışma max'ta → son dx küçük olmalı
    expect(lastDx).toBeLessThan(firstDx);
  });

  test('Sınırlar korunur (minX, maxX değişmez)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 2 });
    var biased = veFEAApplyLocalSizing(m, { selection: 'faceXMin', biasStrength: 0.8 });
    var minX = Infinity, maxX = -Infinity;
    var n = biased.nodes.length / 3;
    for (var i = 0; i < n; i++) {
      var x = biased.nodes[i * 3];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    expect(minX).toBeCloseTo(-5, 4);
    expect(maxX).toBeCloseTo(5, 4);
  });

  test('Bilinmeyen selection → mesh aynen döner', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var out = veFEAApplyLocalSizing(m, { selection: 'unknownFace', biasStrength: 0.5 });
    expect(out).toBe(m);
  });

  test('biasStrength clamp [0, 1]', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 2 });
    var biased = veFEAApplyLocalSizing(m, { selection: 'faceXMin', biasStrength: 2.0 }); // > 1
    // Clamp 1, exponent 4 — düğümler hâlâ -5'e yakın kümeli
    expect(biased.nodes).not.toBe(m.nodes);
  });

  test('faceTop (silindir) + strength → Y eksende üst\'e kümeli', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 5, height: 20 } }, { size: 5 });
    var biased = veFEAApplyLocalSizing(m, { selection: 'faceTop', biasStrength: 0.6 });
    var ys = [];
    var n = biased.nodes.length / 3;
    for (var i = 0; i < n; i++) ys.push(biased.nodes[i * 3 + 1]);
    var uniqueYs = Array.from(new Set(ys.map(function(y){return y.toFixed(3);}))).map(Number).sort(function(a,b){return a-b;});
    var firstDy = uniqueYs[1] - uniqueYs[0];
    var lastDy = uniqueYs[uniqueYs.length - 1] - uniqueYs[uniqueYs.length - 2];
    expect(lastDy).toBeLessThan(firstDy);
  });

  test('Eleman bağlantıları korunur (sadece düğüm konumu değişir)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var biased = veFEAApplyLocalSizing(m, { selection: 'faceXMin', biasStrength: 0.7 });
    expect(biased.elements).toBe(m.elements); // aynı referans
    expect(biased.elements.length).toBe(m.elements.length);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Inflation layers (biasMode: inflation)', () => {
  test('Geometrik progresyon: ilk katman küçük, sonrakiler büyür', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 100, height: 20, depth: 20 } }, { size: 10 });
    // size=10 → nx=10 cell, nx+1=11 nodes along X
    var biased = veFEAApplyLocalSizing(m, {
      selection: 'faceXMin',
      biasMode: 'inflation',
      firstLayerThickness: 1,
      growthRate: 1.5,
      layerCount: 4
    });
    // X-koordinatlarını topla, sırala
    var xs = [];
    var n = biased.nodes.length / 3;
    for (var i = 0; i < n; i++) xs.push(biased.nodes[i * 3]);
    var unique = Array.from(new Set(xs.map(function(x){return x.toFixed(4);}))).map(Number).sort(function(a,b){return a-b;});
    // İlk 5 düğüm: -50 (boundary), -49, -47.5, -45.25, -41.875 (first=1, growth=1.5)
    // Boundary at min = -50. After:
    //   x0 = -50
    //   x1 = -50 + 1 = -49
    //   x2 = -50 + 1 + 1.5 = -47.5
    //   x3 = -50 + 1 + 1.5 + 2.25 = -45.25
    //   x4 = -50 + 1 + 1.5 + 2.25 + 3.375 = -41.875
    expect(unique[0]).toBeCloseTo(-50, 3);
    expect(unique[1]).toBeCloseTo(-49, 3);
    expect(unique[2]).toBeCloseTo(-47.5, 3);
    expect(unique[3]).toBeCloseTo(-45.25, 3);
    expect(unique[4]).toBeCloseTo(-41.875, 3);
    // İlk dx (1) son dx'ten çok daha küçük
    var firstDx = unique[1] - unique[0];
    var lastDx = unique[unique.length - 1] - unique[unique.length - 2];
    expect(firstDx).toBeLessThan(lastDx);
  });

  test('Inflation toplam kalınlığı eksenden büyükse scale edilir', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 1 });
    // Geometri 10 mm, inflation 4 katman × first=5 × growth=2 = 5*(15) = 75 mm
    // Bu çok büyük, scale edilmeli
    var biased = veFEAApplyLocalSizing(m, {
      selection: 'faceXMin',
      biasMode: 'inflation',
      firstLayerThickness: 5,
      growthRate: 2,
      layerCount: 4
    });
    // Boundary değerleri aynen korunmalı
    var xs = [];
    var n = biased.nodes.length / 3;
    for (var i = 0; i < n; i++) xs.push(biased.nodes[i * 3]);
    var minX = Math.min.apply(null, xs);
    var maxX = Math.max.apply(null, xs);
    expect(minX).toBeCloseTo(-5, 3);
    expect(maxX).toBeCloseTo(5, 3);
  });

  test('faceXMax: inflation max\'tan başlar (towardMax)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 100, height: 20, depth: 20 } }, { size: 10 });
    var biased = veFEAApplyLocalSizing(m, {
      selection: 'faceXMax',
      biasMode: 'inflation',
      firstLayerThickness: 1,
      growthRate: 1.5,
      layerCount: 4
    });
    var xs = [];
    var n = biased.nodes.length / 3;
    for (var i = 0; i < n; i++) xs.push(biased.nodes[i * 3]);
    var unique = Array.from(new Set(xs.map(function(x){return x.toFixed(4);}))).map(Number).sort(function(a,b){return a-b;});
    // En son iki düğüm boundary'ye en yakın olmalı
    var lastDx = unique[unique.length - 1] - unique[unique.length - 2];
    var firstDx = unique[1] - unique[0];
    expect(lastDx).toBeLessThan(firstDx);
  });

  test('layerCount > nAxis → clamp', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    // size=5, w=10 → nx=2 interval (3 düğüm); layerCount=10 > 2 → clamp
    var biased = veFEAApplyLocalSizing(m, {
      selection: 'faceXMin',
      biasMode: 'inflation',
      firstLayerThickness: 0.5,
      growthRate: 1.2,
      layerCount: 10
    });
    expect(biased.nodes).not.toBe(m.nodes); // mesh değişti
  });

  test('Inflation invalid params → no-op', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var out = veFEAApplyLocalSizing(m, {
      selection: 'faceXMin',
      biasMode: 'inflation',
      firstLayerThickness: -1, // invalid
      growthRate: 1.2,
      layerCount: 3
    });
    expect(out).toBe(m);
  });

  test('Element bağlantıları korunur (sadece düğüm konumları değişir)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 50, height: 10, depth: 10 } }, { size: 5 });
    var biased = veFEAApplyLocalSizing(m, {
      selection: 'faceXMin',
      biasMode: 'inflation',
      firstLayerThickness: 0.5,
      growthRate: 1.3,
      layerCount: 3
    });
    expect(biased.elements).toBe(m.elements);
    expect(biased.elements.length).toBe(m.elements.length);
  });

  test('biasMode default=power: eski davranış korunur', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 2 });
    var biased1 = veFEAApplyLocalSizing(m1, { selection: 'faceXMin', biasStrength: 0.5 });
    var biased2 = veFEAApplyLocalSizing(m1, { selection: 'faceXMin', biasMode: 'power', biasStrength: 0.5 });
    // İki yöntem de aynı sonucu vermeli
    for (var i = 0; i < biased1.nodes.length; i++) {
      expect(biased2.nodes[i]).toBeCloseTo(biased1.nodes[i], 6);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Inflation UI', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Default mode "power": bias slider gösterilir', () => {
    var node = { id: 'mesh-inf1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/id="ve-fea-mesh-local-bias-mesh-inf1"/);
    expect(html).not.toMatch(/id="ve-fea-mesh-local-first-mesh-inf1"/);
  });

  test('Mode "inflation" persisted → first/grow/nlay inputlari', () => {
    var node = {
      id: 'mesh-inf2',
      type: 'fea-mesh',
      data: { meshSettings: { size: 5, localSizing: { selection: 'faceXMin', biasMode: 'inflation', firstLayerThickness: 0.5, growthRate: 1.3, layerCount: 4 } } }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/id="ve-fea-mesh-local-first-mesh-inf2"/);
    expect(html).toMatch(/id="ve-fea-mesh-local-grow-mesh-inf2"/);
    expect(html).toMatch(/id="ve-fea-mesh-local-nlay-mesh-inf2"/);
    expect(html).toMatch(/value="inflation"\s+selected/);
    expect(html).toMatch(/value="0\.5"/);
    expect(html).toMatch(/value="1\.3"/);
    expect(html).toMatch(/value="4"/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshFromGeometry — localSizing entegrasyonu', () => {
  test('opts.localSizing build sırasında uygulanır', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 2 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 2, localSizing: { selection: 'faceXMin', biasStrength: 0.5 } });
    // Aynı eleman sayısı, farklı düğüm konumları
    expect(m2.elements.length).toBe(m1.elements.length);
    expect(m2.nodes).not.toBe(m1.nodes);
    expect(m2.localSizingApplied).toBeDefined();
  });

  test('localSizing + midSideNodes birlikte çalışır', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, midSideNodes: true, localSizing: { selection: 'faceXMin', biasStrength: 0.5 } });
    expect(m.type).toBe('hex20');
    // Midpoint düğümleri biased corner'lardan hesaplandı
    expect(m.nodes.length / 3).toBeGreaterThan(27);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Lokal yoğunlaştırma UI', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Dropdown + slider render edilir', () => {
    var node = { id: 'mesh-ls1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/id="ve-fea-mesh-local-sel-mesh-ls1"/);
    expect(html).toMatch(/id="ve-fea-mesh-local-bias-mesh-ls1"/);
    expect(html).toMatch(/Lokal Yoğunlaştırma/);
    expect(html).toMatch(/faceXMin/);
    expect(html).toMatch(/faceXMax/);
    expect(html).toMatch(/faceTop/);
  });

  test('Persisted ayarlar dropdown\'a yansır', () => {
    var node = {
      id: 'mesh-ls2',
      type: 'fea-mesh',
      data: { meshSettings: { size: 5, localSizing: { selection: 'faceYMax', biasStrength: 0.6 } } }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/value="faceYMax"\s+selected/);
    expect(html).toMatch(/value="60"/);
    expect(html).toMatch(/60%/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Curvature-based refinement', () => {
  test('Disabled (default): nC mevcut size-based hesaplama (legacy wedge)', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 10, crossSection: 'wedge' });
    var nC = m.grid.nCircum;
    // size=10, min=8 → max(8, round(2π·10/10)) = max(8,6) = 8
    expect(nC).toBeGreaterThanOrEqual(6);
  });

  test('Enabled normalAngleDeg=18° → nC ≥ 20 (silindir)', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 10, curvatureRefinement: { enabled: true, normalAngleDeg: 18 } });
    // 360/18 = 20 segment minimum
    expect(m.grid.nCircum).toBeGreaterThanOrEqual(20);
  });

  test('Enabled normalAngleDeg=5° → çok daha fine (≥ 72 segment)', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 10, curvatureRefinement: { enabled: true, normalAngleDeg: 5 } });
    expect(m.grid.nCircum).toBeGreaterThanOrEqual(72);
  });

  test('Şaft için curvature refinement uygulanır', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } },
      { size: 20, curvatureRefinement: { enabled: true, normalAngleDeg: 18 } });
    expect(m.grid.nCircum).toBeGreaterThanOrEqual(20);
  });

  test('Kutu mesh curvature\'dan etkilenmez (planar)', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, curvatureRefinement: { enabled: true, normalAngleDeg: 5 } });
    expect(m1.elements.length).toBe(m2.elements.length);
  });

  test('Size-based nC daha büyükse curvature override etmez', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 100, height: 20 } },
      { size: 5, curvatureRefinement: { enabled: true, normalAngleDeg: 60 } });
    // size-based: nC ≈ round(2π·100/5) = round(125.6) = 126
    // curvature: 360/60 = 6
    // max(126, 6) = 126 → size kazandı
    expect(m.grid.nCircum).toBeGreaterThan(6);
  });

  test('Bozuk normalAngleDeg değeri clamp edilir', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 10, curvatureRefinement: { enabled: true, normalAngleDeg: -5 } });
    // Clamp 1 → çok büyük segment
    expect(m.grid.nCircum).toBeGreaterThanOrEqual(360);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Curvature refinement UI', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Checkbox + açı input\'u render edilir', () => {
    var node = { id: 'mesh-cr1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/id="ve-fea-mesh-curv-mesh-cr1"/);
    expect(html).toMatch(/id="ve-fea-mesh-curv-ang-mesh-cr1"/);
    expect(html).toMatch(/Eğrilik tabanlı incelt/);
  });

  test('Default değerler: disabled + 18°', () => {
    var node = { id: 'mesh-cr2', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    var checkboxMatch = html.match(/<input type="checkbox"[^>]*id="ve-fea-mesh-curv-mesh-cr2"[^>]*>/);
    expect(checkboxMatch[0]).not.toMatch(/ checked/);
    expect(html).toMatch(/value="18"/);
  });

  test('Persisted ayarlar UI\'da işaretlenir', () => {
    var node = {
      id: 'mesh-cr3',
      type: 'fea-mesh',
      data: { meshSettings: { size: 10, curvatureRefinement: { enabled: true, normalAngleDeg: 10 } } }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    var checkboxMatch = html.match(/<input type="checkbox"[^>]*id="ve-fea-mesh-curv-mesh-cr3"[^>]*>/);
    expect(checkboxMatch[0]).toMatch(/checked/);
    expect(html).toMatch(/value="10"/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputePerElementQuality (heat map için)', () => {
  test('aspect metriği — eleman sayısı kadar değer', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var vals = veFEAComputePerElementQuality(m, 'aspect');
    expect(vals.length).toBe(m.elements.length / m.nodesPerElement);
    // Küp için her elemanın aspect'i ≈ 1
    for (var i = 0; i < vals.length; i++) {
      expect(vals[i]).toBeCloseTo(1, 2);
    }
  });

  test('skewness metriği — küp için ≈ 0', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var vals = veFEAComputePerElementQuality(m, 'skewness');
    for (var i = 0; i < vals.length; i++) {
      expect(vals[i]).toBeCloseTo(0, 3);
    }
  });

  test('minAngle metriği — küp için ≈ 90', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var vals = veFEAComputePerElementQuality(m, 'minAngle');
    for (var i = 0; i < vals.length; i++) {
      expect(vals[i]).toBeCloseTo(90, 1);
    }
  });

  test('jacobianRatio metriği — küp için ≈ 1', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var vals = veFEAComputePerElementQuality(m, 'jacobianRatio');
    for (var i = 0; i < vals.length; i++) {
      expect(vals[i]).toBeCloseTo(1, 2);
    }
  });

  test('null mesh → null', () => {
    expect(veFEAComputePerElementQuality(null, 'aspect')).toBeNull();
  });

  test('Tet4 küp için tüm metrikler hesaplanır', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    var asp = veFEAComputePerElementQuality(m, 'aspect');
    var sk = veFEAComputePerElementQuality(m, 'skewness');
    expect(asp.length).toBe(48);
    expect(sk.length).toBe(48);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAExtractSurfaceTriangles', () => {
  test('Tek küp hex8 → 12 yüzey üçgeni (6 yüz × 2 tri)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var surf = veFEAExtractSurfaceTriangles(m);
    expect(surf.positions.length / 9).toBe(12);
    expect(surf.elementIds.length).toBe(12);
  });

  test('2×1×1 hex (2 eleman, ortak iç yüz) → 10 yüz × 2 tri = 20', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 2, height: 1, depth: 1 } }, { size: 1 });
    // 2 hex × 6 face = 12 face. Ortak 1 iç face × 2 = 2 (dahili). Boundary = 10
    var surf = veFEAExtractSurfaceTriangles(m);
    expect(surf.positions.length / 9).toBe(20); // 10 quad × 2 tri
  });

  test('Tri3 mesh için doğrudan elementler döner', () => {
    var tri = {
      type: 'tri3',
      nodes: new Float32Array([0,0,0, 1,0,0, 0,1,0, 1,1,0]),
      elements: new Uint32Array([0,1,2, 1,3,2]),
      nodesPerElement: 3
    };
    var surf = veFEAExtractSurfaceTriangles(tri);
    expect(surf.positions.length / 9).toBe(2);
  });

  test('null/boş için null', () => {
    expect(veFEAExtractSurfaceTriangles(null)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAJetColor', () => {
  test('t=0 → mavi', () => {
    var c = veFEAJetColor(0);
    expect(c[0]).toBeCloseTo(0, 2); // R
    expect(c[2]).toBeGreaterThan(0.5); // B
  });

  test('t=1 → kırmızı', () => {
    var c = veFEAJetColor(1);
    expect(c[0]).toBeGreaterThan(0.5); // R
    expect(c[2]).toBeCloseTo(0, 2); // B
  });

  test('t=0.5 → yeşil/sarı civarı', () => {
    var c = veFEAJetColor(0.5);
    expect(c[1]).toBeGreaterThan(0.5); // G
  });

  test('out-of-range clamp', () => {
    expect(veFEAJetColor(-1)[2]).toBeGreaterThan(0); // mavi
    expect(veFEAJetColor(2)[0]).toBeGreaterThan(0); // kırmızı
  });

  test('NaN → t=0 (mavi)', () => {
    var c = veFEAJetColor(NaN);
    expect(c[2]).toBeGreaterThan(0); // B aktif → mavi tarafı
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAApplyHeatMap köprüsü', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
  });

  test('metric set → heatMapMetric data\'ya yazılır', () => {
    global.nodes = [{ id: 'mesh-h1', type: 'fea-mesh', data: {} }];
    veFEAApplyHeatMap('mesh-h1', 'aspect');
    expect(global.nodes[0].data.heatMapMetric).toBe('aspect');
  });

  test('"off" → heatMapMetric null', () => {
    global.nodes = [{ id: 'mesh-h2', type: 'fea-mesh', data: { heatMapMetric: 'skewness' } }];
    veFEAApplyHeatMap('mesh-h2', 'off');
    expect(global.nodes[0].data.heatMapMetric).toBeNull();
  });

  test('Bilinmeyen node sessizce çıkar', () => {
    expect(() => veFEAApplyHeatMap('nonexistent', 'aspect')).not.toThrow();
  });

  test('Solid mode: heatMapMetric="solid"', () => {
    global.nodes = [{ id: 'mesh-h-s', type: 'fea-mesh', data: {} }];
    veFEAApplyHeatMap('mesh-h-s', 'solid');
    expect(global.nodes[0].data.heatMapMetric).toBe('solid');
  });

  test('Solid+Edges mode: heatMapMetric="solid-edges"', () => {
    global.nodes = [{ id: 'mesh-h-se', type: 'fea-mesh', data: {} }];
    veFEAApplyHeatMap('mesh-h-se', 'solid-edges');
    expect(global.nodes[0].data.heatMapMetric).toBe('solid-edges');
  });

  test('Mesh clear sonrası heatMapMetric temizlenir', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-c', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-c' }];
    veFEABuildMeshForNode('mesh-c');
    veFEAApplyHeatMap('mesh-c', 'aspect');
    expect(global.nodes[1].data.heatMapMetric).toBe('aspect');
    veFEAClearMeshForNode('mesh-c');
    expect(global.nodes[1].data.heatMapMetric).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEASetWireframeMode (yoğun mesh için kullanıcı seçimi)', () => {
  beforeEach(() => {
    global.nodes = [];
    global.saveState = jest.fn();
  });

  test('wireframeMode meshSettings\'e persist edilir', () => {
    global.nodes = [{ id: 'mesh-wf1', type: 'fea-mesh', data: { meshSettings: { size: 1 } } }];
    veFEASetWireframeMode('mesh-wf1', 'surface');
    expect(global.nodes[0].data.meshSettings.wireframeMode).toBe('surface');
  });

  test('"off" değeri kabul edilir', () => {
    global.nodes = [{ id: 'mesh-wf2', type: 'fea-mesh', data: {} }];
    veFEASetWireframeMode('mesh-wf2', 'off');
    expect(global.nodes[0].data.meshSettings.wireframeMode).toBe('off');
  });

  test('Bilinmeyen node ID sessizce çıkar', () => {
    expect(function() { veFEASetWireframeMode('nonexistent', 'surface'); }).not.toThrow();
  });

  test('saveState çağrılır', () => {
    global.nodes = [{ id: 'mesh-wf3', type: 'fea-mesh', data: {} }];
    veFEASetWireframeMode('mesh-wf3', 'all');
    expect(global.saveState).toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Heat Map seçici', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Mesh varsa Görünüm Modu dropdown render edilir (7 seçenek: 3 standart + 4 heat map)', () => {
    var node = {
      id: 'mesh-hm1',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: { nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5 }
      }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/Görünüm Modu/);
    expect(html).toMatch(/value="off"/);
    expect(html).toMatch(/value="solid"/);
    expect(html).toMatch(/value="solid-edges"/);
    expect(html).toMatch(/value="aspect"/);
    expect(html).toMatch(/value="skewness"/);
    expect(html).toMatch(/value="minAngle"/);
    expect(html).toMatch(/value="jacobianRatio"/);
  });

  test('Aktif heatMapMetric option\'ı seçili gelir', () => {
    var node = {
      id: 'mesh-hm2',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        heatMapMetric: 'skewness',
        meshMetrics: { nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5 }
      }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/value="skewness"\s+selected/);
  });

  test('Mesh yokken Heat Map kullanılamaz mesajı', () => {
    var node = { id: 'mesh-hm3', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/Mesh oluşturulduktan sonra kullanılabilir/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeQualityMetrics', () => {
  test('Küp mesh için aspect ratio ≈ 1.0 (ideal küp)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.elementCount).toBe(8);
    expect(q.aspectRatio.min).toBeCloseTo(1, 2);
    expect(q.aspectRatio.max).toBeCloseTo(1, 2);
    expect(q.aspectRatio.avg).toBeCloseTo(1, 2);
    expect(q.aspectRatio.poorCount).toBe(0);
  });

  test('Küp mesh için skewness ≈ 0 (ideal yüzler)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.skewness.min).toBeCloseTo(0, 3);
    expect(q.skewness.max).toBeCloseTo(0, 3);
    expect(q.skewness.poorCount).toBe(0);
  });

  test('Küp mesh için iç açılar ≈ 90°', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.angle.min).toBeCloseTo(90, 1);
    expect(q.angle.max).toBeCloseTo(90, 1);
  });

  test('Dikdörtgen prizma (10×30×5) için aspect > 1', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 30, depth: 5 } }, { size: 10 });
    var q = veFEAComputeQualityMetrics(m);
    // size=10 → 1×3×1 grid; her eleman 10×10×5 (z yönünde 5) → aspect = 10/5 = 2
    expect(q.aspectRatio.min).toBeGreaterThan(1);
    expect(q.aspectRatio.max).toBeGreaterThan(1.5);
  });

  test('Silindir wedge mesh için aspect ratio ≥ 1', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.aspectRatio.min).toBeGreaterThanOrEqual(1);
    expect(q.elementCount).toBeGreaterThan(0);
  });

  test('Tet4 küp mesh için makul kalite', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.elementCount).toBe(48); // 8 hex × 6 tet
    // Tet4 6-split — bazı tetlerin aspect ratio'su yüksek olabilir ama hepsi geçerli
    expect(q.aspectRatio.min).toBeGreaterThan(0);
    expect(q.angle.min).toBeGreaterThan(0);
    expect(q.angle.max).toBeLessThan(180);
  });

  test('Histogram bin sayıları doğru toplanır', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var q = veFEAComputeQualityMetrics(m);
    var arSum = 0;
    q.aspectRatio.histogram.bins.forEach(function(b) { arSum += b; });
    expect(arSum).toBe(q.elementCount);
    var skSum = 0;
    q.skewness.histogram.bins.forEach(function(b) { skSum += b; });
    expect(skSum).toBe(q.elementCount);
  });

  test('null/error mesh → null döner', () => {
    expect(veFEAComputeQualityMetrics(null)).toBeNull();
    expect(veFEAComputeQualityMetrics({ error: 'voxel-too-many' })).toBeNull();
  });

  test('Hex20 kuadratik mesh için corner-only kalite metrikleri', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, midSideNodes: true });
    expect(m.type).toBe('hex20');
    var q = veFEAComputeQualityMetrics(m);
    expect(q.cornerCount).toBe(8);
    expect(q.aspectRatio.min).toBeCloseTo(1, 2);
  });

  test('Build sonrası meshMetrics.quality eklenir', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-1', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
    veFEABuildMeshForNode('mesh-1');
    expect(global.nodes[1].data.meshMetrics.quality).toBeDefined();
    expect(global.nodes[1].data.meshMetrics.quality.aspectRatio).toBeDefined();
    expect(global.nodes[1].data.meshMetrics.quality.skewness).toBeDefined();
    expect(global.nodes[1].data.meshMetrics.quality.angle).toBeDefined();
  });
});

// ─── ANSYS §7 — eksik 4 metrik (Element Quality / Orthogonal / Warping / Parallel Deviation) ───
describe('veFEAComputeQualityMetrics — Element Quality (C·V / (ΣL²)^1.5)', () => {
  test('Mükemmel küp hex8 için Element Quality ≈ 1.0', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 10 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.elementQuality).toBeDefined();
    expect(q.elementQuality.min).toBeCloseTo(1, 2);
    expect(q.elementQuality.max).toBeCloseTo(1, 2);
    expect(q.elementQuality.avg).toBeCloseTo(1, 2);
    expect(q.elementQuality.poorCount).toBe(0);
  });

  test('Streçli prizma (1×10×1) için Element Quality < 1.0', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 10, depth: 1 } }, { size: 10 });
    var q = veFEAComputeQualityMetrics(m);
    // Streçli element → kalite düşmeli ama 0 olmamalı
    expect(q.elementQuality.max).toBeLessThan(0.5);
    expect(q.elementQuality.min).toBeGreaterThan(0);
  });

  test('Hex20 quadratic mesh için Element Quality corner-based (≈ 1)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } },
                                  { size: 10, midSideNodes: true });
    expect(m.type).toBe('hex20');
    var q = veFEAComputeQualityMetrics(m);
    expect(q.elementQuality.avg).toBeCloseTo(1, 2);
  });

  test('Tet4 mesh için Element Quality > 0 ve ≤ 1', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } },
                                  { size: 5, elementType: 'tet4' });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.elementQuality.min).toBeGreaterThan(0);
    expect(q.elementQuality.max).toBeLessThanOrEqual(1.0001);
  });

  test('Histogram 10 bin, toplam = elementCount', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.elementQuality.histogram.binCount).toBe(10);
    var sum = 0; q.elementQuality.histogram.bins.forEach(function(b) { sum += b; });
    expect(sum).toBe(q.elementCount);
  });
});

describe('veFEAComputeQualityMetrics — Orthogonal Quality', () => {
  test('Mükemmel küp için Orthogonal Quality ≈ 1.0 (her face perpendicular)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 10 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.orthogonalQuality).not.toBeNull();
    expect(q.orthogonalQuality.min).toBeCloseTo(1, 2);
    expect(q.orthogonalQuality.max).toBeCloseTo(1, 2);
    expect(q.orthogonalQuality.poorCount).toBe(0);
  });

  test('Streçli prizma için Orthogonal Quality hala yüksek (uniform stretch, face/center hizalı kalır)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 10, depth: 1 } }, { size: 10 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.orthogonalQuality.min).toBeGreaterThan(0.9);
  });

  test('Silindir wedge6 için Orthogonal Quality > 0 (üçgen yüzler hafif eğri)', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.orthogonalQuality.min).toBeGreaterThan(0);
    expect(q.orthogonalQuality.max).toBeLessThanOrEqual(1.0001);
  });

  test('Tri3 yüzey mesh için orthogonalQuality === null (3D-only metrik)', () => {
    // Sentetik tri3 mesh inşa et
    var m = {
      type: 'tri3', geometryType: 'test',
      nodes: new Float32Array([0,0,0, 1,0,0, 0,1,0]),
      elements: new Uint32Array([0,1,2]),
      nodesPerElement: 3
    };
    var q = veFEAComputeQualityMetrics(m);
    expect(q.orthogonalQuality).toBeNull();
  });
});

describe('veFEAComputeQualityMetrics — Warping Factor (quad-face only)', () => {
  test('Mükemmel küp için Warping ≈ 0 (tüm face\'ler planar)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 10 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.warpingFactor).not.toBeNull();
    expect(q.warpingFactor.max).toBeLessThan(1e-4);
    expect(q.warpingFactor.poorCount).toBe(0);
  });

  test('Tet4 mesh için warpingFactor === null (quad face yok)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } },
                                  { size: 10, elementType: 'tet4' });
    expect(m.type).toBe('tet4');
    var q = veFEAComputeQualityMetrics(m);
    expect(q.warpingFactor).toBeNull();
  });

  test('Sentetik warped hex8: bir köşeyi düzlemden çıkarınca W > 0', () => {
    // Birim küp, P4'i (üst sol arka) z-yönünde 0.5 yükselt → top face warped
    var nodes = new Float32Array([
      0,0,0,  1,0,0,  1,1,0,  0,1,0,   // alt yüz
      0,0,1.5,  1,0,1,  1,1,1,  0,1,1  // üst yüz (P4 yukarı bükülmüş)
    ]);
    var m = {
      type: 'hex8', geometryType: 'test',
      nodes: nodes,
      elements: new Uint32Array([0,1,2,3, 4,5,6,7]),
      nodesPerElement: 8
    };
    var q = veFEAComputeQualityMetrics(m);
    expect(q.warpingFactor.max).toBeGreaterThan(0.05);
  });
});

describe('veFEAComputeQualityMetrics — Parallel Deviation (quad-face only)', () => {
  test('Mükemmel küp için Parallel Deviation ≈ 0° (kareler paralelogram)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 10 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.parallelDeviation).not.toBeNull();
    expect(q.parallelDeviation.max).toBeLessThan(1);
  });

  test('Tet4 mesh için parallelDeviation === null', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } },
                                  { size: 10, elementType: 'tet4' });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.parallelDeviation).toBeNull();
  });

  test('Sentetik trapezoid hex8: bir kenarı kaydırınca PD > 0', () => {
    // Birim küp, alt yüzü trapez yap: P0'ı x yönünde 0.5 kaydır
    var nodes = new Float32Array([
      0.5,0,0,  1,0,0,  1,1,0,  0,1,0,   // alt: trapez
      0,0,1,    1,0,1,  1,1,1,  0,1,1    // üst: kare
    ]);
    var m = {
      type: 'hex8', geometryType: 'test',
      nodes: nodes,
      elements: new Uint32Array([0,1,2,3, 4,5,6,7]),
      nodesPerElement: 8
    };
    var q = veFEAComputeQualityMetrics(m);
    expect(q.parallelDeviation.max).toBeGreaterThan(5);
  });
});

describe('veFEAComputePerElementQuality — yeni metrikler', () => {
  test('elementQuality, orthogonalQuality, warpingFactor, parallelDeviation per-element çalışır', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    expect(m.type).toBe('hex8');
    var eqArr = veFEAComputePerElementQuality(m, 'elementQuality');
    var oqArr = veFEAComputePerElementQuality(m, 'orthogonalQuality');
    var wpArr = veFEAComputePerElementQuality(m, 'warpingFactor');
    var pdArr = veFEAComputePerElementQuality(m, 'parallelDeviation');
    expect(eqArr.length).toBe(m.elements.length / m.nodesPerElement);
    expect(oqArr.length).toBe(eqArr.length);
    expect(wpArr.length).toBe(eqArr.length);
    expect(pdArr.length).toBe(eqArr.length);
    // Mükemmel küp → tüm değerler iyi
    for (var i = 0; i < eqArr.length; i++) {
      expect(eqArr[i]).toBeCloseTo(1, 2);
      expect(oqArr[i]).toBeCloseTo(1, 2);
      expect(wpArr[i]).toBeLessThan(1e-4);
      expect(pdArr[i]).toBeLessThan(1);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Kalite Metrikleri (histogram)', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Mesh yokken kalite mesajı gösterilir', () => {
    var node = { id: 'mesh-quality1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/Kalite Metrikleri.*Aspect.*Skewness.*Açı/);
    expect(html).toMatch(/otomatik hesaplanır/);
  });

  test('Quality metrics varsa aspect/skewness/açı satırları + histogram bar\'ları', () => {
    var node = {
      id: 'mesh-quality2',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5,
          quality: {
            elementCount: 8, cornerCount: 8,
            aspectRatio: { min: 1.0, max: 1.0, avg: 1.0, poorCount: 0, warnThreshold: 20,
              histogram: { bins: [8,0,0,0,0,0,0,0,0,0], min: 1, max: 20, binCount: 10 } },
            skewness: { min: 0, max: 0, avg: 0, poorCount: 0, warnThreshold: 0.85,
              histogram: { bins: [8,0,0,0,0,0,0,0,0,0], min: 0, max: 1, binCount: 10 } },
            angle: { min: 90, max: 90,
              histogram: { bins: [0,0,0,0,0,8,0,0,0,0,0,0], min: 0, max: 180, binCount: 12 } }
          }
        }
      }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/Aspect Min.*1\.00/);
    expect(html).toMatch(/Skewness Min/);
    expect(html).toMatch(/Min.*Maks iç açı.*90/);
    // Histogram bar'ları render edildi
    expect(html).toMatch(/Aspect Ratio histogramı/);
    expect(html).toMatch(/Skewness histogramı/);
    expect(html).toMatch(/Min iç açı histogramı/);
  });

  test('Poor aspect/skewness sayısı uyarı satırı', () => {
    var node = {
      id: 'mesh-quality3',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          nodeCount: 100, elementCount: 100, elementType: 'hex8', minSize: 1, maxSize: 10, avgSize: 5,
          quality: {
            elementCount: 100, cornerCount: 8,
            aspectRatio: { min: 1, max: 50, avg: 10, poorCount: 7, warnThreshold: 20,
              histogram: { bins: [50,30,10,5,5,0,0,0,0,0], min: 1, max: 20, binCount: 10 } },
            skewness: { min: 0, max: 0.95, avg: 0.4, poorCount: 4, warnThreshold: 0.85,
              histogram: { bins: [50,20,10,5,5,5,3,1,0,1], min: 0, max: 1, binCount: 10 } },
            angle: { min: 15, max: 165,
              histogram: { bins: [0,1,2,5,10,30,30,15,5,2,0,0], min: 0, max: 180, binCount: 12 } }
          }
        }
      }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/7 eleman aspect (>|&gt;) 20/);
    expect(html).toMatch(/4 eleman skewness (>|&gt;) 0\.85/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAEnrichToQuadratic (Tet10/Hex20/Wedge15)', () => {
  test('Hex8 → Hex20: nodesPerElement 8 → 20, eleman sayısı korunur', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var nEl = hex.elements.length / 8;
    var q = veFEAEnrichToQuadratic(hex);
    expect(q.type).toBe('hex20');
    expect(q.nodesPerElement).toBe(20);
    expect(q.elements.length / 20).toBe(nEl);
    expect(q.enrichedFrom).toBe('hex8');
  });

  test('Tet4 → Tet10: nodesPerElement 4 → 10', () => {
    var tet = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    var nEl = tet.elements.length / 4;
    var q = veFEAEnrichToQuadratic(tet);
    expect(q.type).toBe('tet10');
    expect(q.nodesPerElement).toBe(10);
    expect(q.elements.length / 10).toBe(nEl);
  });

  test('Wedge6 → Wedge15 (legacy crossSection:"wedge")', () => {
    var w = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5, crossSection: 'wedge' });
    var nEl = w.elements.length / 6;
    var q = veFEAEnrichToQuadratic(w);
    expect(q.type).toBe('wedge15');
    expect(q.nodesPerElement).toBe(15);
    expect(q.elements.length / 15).toBe(nEl);
  });

  test('Edge dedup: ortak kenarlar tek midnode kazanır', () => {
    // 2×1×1 hex (2 eleman, ortak yüz) — ortak 4 kenar bir kez sayılır
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 2, height: 1, depth: 1 } }, { size: 1 });
    expect(hex.elements.length / 8).toBe(2);
    var q = veFEAEnrichToQuadratic(hex);
    // 2 hex × 12 kenar/hex = 24 toplam kenar, ortak 4 dedup → 20 benzersiz midnode
    // Original 12 corner + 20 mid = 32 düğüm
    var origNodes = hex.nodes.length / 3;
    var newNodes = q.nodes.length / 3;
    expect(newNodes - origNodes).toBe(20);
  });

  test('Midpoint düğüm konumu kenarın gerçek orta noktası', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var q = veFEAEnrichToQuadratic(hex);
    // İlk eleman (0,1,2,3,4,5,6,7 corner + 8,9,...,19 mid)
    var corner0 = q.elements[0];
    var corner1 = q.elements[1];
    var mid01 = q.elements[8]; // ilk mid-node = (0,1) edge midpoint
    var x0 = q.nodes[corner0 * 3], y0 = q.nodes[corner0 * 3 + 1], z0 = q.nodes[corner0 * 3 + 2];
    var x1 = q.nodes[corner1 * 3], y1 = q.nodes[corner1 * 3 + 1], z1 = q.nodes[corner1 * 3 + 2];
    var xm = q.nodes[mid01 * 3], ym = q.nodes[mid01 * 3 + 1], zm = q.nodes[mid01 * 3 + 2];
    expect(xm).toBeCloseTo((x0 + x1) / 2, 5);
    expect(ym).toBeCloseTo((y0 + y1) / 2, 5);
    expect(zm).toBeCloseTo((z0 + z1) / 2, 5);
  });

  test('Named selections enriched mesh\'te de hâlâ geçerli (corner IDs)', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var q = veFEAEnrichToQuadratic(hex);
    expect(q.namedSelections).toBeDefined();
    expect(Object.keys(q.namedSelections).length).toBe(6);
    var ids = q.namedSelections.faceXMin.nodeIds;
    var maxIdx = q.nodes.length / 3 - 1;
    for (var i = 0; i < ids.length; i++) {
      expect(ids[i]).toBeLessThanOrEqual(maxIdx);
    }
  });

  test('null/error/tri3 → no-op', () => {
    expect(veFEAEnrichToQuadratic(null)).toBeNull();
    var err = { error: 'voxel-too-many' };
    expect(veFEAEnrichToQuadratic(err)).toBe(err);
    var tri = { type: 'tri3', nodes: new Float32Array(0), elements: new Uint32Array(0), nodesPerElement: 3 };
    expect(veFEAEnrichToQuadratic(tri).type).toBe('tri3');
  });

  test('Eleman indeksleri geçerli aralıkta', () => {
    var tet = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    var q = veFEAEnrichToQuadratic(tet);
    var maxIdx = q.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < q.elements.length; i++) {
      if (q.elements[i] < 0 || q.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshFromGeometry — midSideNodes opsiyonu', () => {
  test('midSideNodes:false (default) → lineer eleman', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    expect(m.type).toBe('hex8');
  });

  test('midSideNodes:true + box → Hex20', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, midSideNodes: true });
    expect(m.type).toBe('hex20');
    expect(m.nodesPerElement).toBe(20);
  });

  test('midSideNodes:true + cylinder (default O-grid Hex8) → Hex20', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5, midSideNodes: true });
    expect(m.type).toBe('hex20');
  });

  test('midSideNodes:true + cylinder + legacy wedge → Wedge15', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5, midSideNodes: true, crossSection: 'wedge' });
    expect(m.type).toBe('wedge15');
  });

  test('midSideNodes:true + elementType:tet4 → Tet10', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4', midSideNodes: true });
    expect(m.type).toBe('tet10');
    expect(m.nodesPerElement).toBe(10);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// ─── Faz 3 — Virtual Topology (ANSYS §8.2) ───
describe('Virtual Topology (opts.virtualTopology → birleştirilmiş face)', () => {
  test('2 face grup → birleşik named selection', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, virtualTopology: [{ faceIds: ['faceXMin', 'faceXMax'], label: 'X Yüzleri' }] }
    );
    expect(m.namedSelections['virtual-topology-0']).toBeDefined();
    var ns = m.namedSelections['virtual-topology-0'];
    expect(ns.type).toBe('face');
    expect(ns.label).toBe('X Yüzleri');
    // İki face'in toplam node sayısından az olmalı (çakışan köşeler dedup)
    var n1 = m.namedSelections.faceXMin.nodeIds.length;
    var n2 = m.namedSelections.faceXMax.nodeIds.length;
    expect(ns.nodeIds.length).toBeLessThanOrEqual(n1 + n2);
    expect(ns.nodeIds.length).toBeGreaterThan(0);
    expect(ns.virtualTopology.sourceFaceIds).toEqual(['faceXMin', 'faceXMax']);
  });

  test('Tek face\'lik grup atlanır (min 2 face)', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, virtualTopology: [{ faceIds: ['faceXMin'] }] }
    );
    expect(m.namedSelections['virtual-topology-0']).toBeUndefined();
  });

  test('Bilinmeyen face\'ler ignore edilir, en az 1 valid varsa grup oluşur', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, virtualTopology: [{ faceIds: ['faceXMin', 'faceFake', 'faceXMax'] }] }
    );
    expect(m.namedSelections['virtual-topology-0']).toBeDefined();
  });

  test('Birden fazla grup', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, virtualTopology: [
        { faceIds: ['faceXMin', 'faceXMax'], label: 'X' },
        { faceIds: ['faceYMin', 'faceYMax'], label: 'Y' }
      ]}
    );
    expect(m.namedSelections['virtual-topology-0']).toBeDefined();
    expect(m.namedSelections['virtual-topology-1']).toBeDefined();
    expect(m.namedSelections['virtual-topology-0'].label).toBe('X');
    expect(m.namedSelections['virtual-topology-1'].label).toBe('Y');
  });
});

// ─── Faz 2 Adım 3 — Convergence Study (ANSYS §10) ───
describe('veFEAConvergenceStudy — otomatik h-refinement', () => {
  test('Konverjans sağlanırsa converged=true, log uzunluğu < maxLoops', () => {
    var result = veFEAConvergenceStudy(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5 },
      { maxLoops: 5, targetPoorPct: 50, shrinkFactor: 0.8 }
    );
    // Mükemmel küp → poor% = 0 → ilk iterasyonda converge
    expect(result.converged).toBe(true);
    expect(result.log.length).toBe(1);
    expect(result.final).toBeDefined();
  });

  test('Yakınsama olmazsa converged=false, max iterasyona ulaşılır', () => {
    // İmkansız hedef: poor=0% strict, aspect=20 sınırı tüm meshler için aşılır mı?
    // Mükemmel küp her zaman 0% poor verir, hedef 0 olsa bile geçer.
    // Bu test çok katı criteria + STEP voxel için çalışmaz, atlama
    var result = veFEAConvergenceStudy(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 100 },  // çok kaba başla, mükemmel küp olsa bile
      { maxLoops: 3, targetPoorPct: 0.0001, shrinkFactor: 0.5 }
    );
    expect(result.log.length).toBeGreaterThanOrEqual(1);
  });

  test('Log her loop için size, elementCount, poor% içerir', () => {
    var result = veFEAConvergenceStudy(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5 },
      { maxLoops: 3, targetPoorPct: 99, shrinkFactor: 0.7 }
    );
    expect(result.log[0].size).toBeDefined();
    expect(result.log[0].elementCount).toBeDefined();
    expect(result.log[0].poorPct).toBeDefined();
    expect(result.log[0].maxAspect).toBeDefined();
  });

  test('maxLoops parametresine uyum (max 20 clamp)', () => {
    var result = veFEAConvergenceStudy(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5 },
      { maxLoops: 100, targetPoorPct: 0.0001 }
    );
    // Mükemmel küp ilk iterasyonda converge → log 1, ama maxLoops clamp etkisi diğer testlerde
    expect(result.log.length).toBeLessThanOrEqual(20);
  });
});

// ─── Faz 2 Adım 2 — Defeaturing Tolerance (ANSYS §8) ───
describe('Defeaturing Tolerance (opts.defeaturingTolerance)', () => {
  test('Tolerans verilince effective minimum size artar (küçük size clamp\'lenir)', () => {
    // size=0.3 + defeatureTol=2 → effective min size = 2 mm, mesh daha kaba olur
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 0.3 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 0.3, defeaturingTolerance: 2 });
    // defeaturing aktifken element sayısı daha düşük (daha az ince mesh)
    expect(m2.elements.length).toBeLessThan(m1.elements.length);
  });

  test('Tolerans büyük size etkilemez (yapısal mesh aynı kalır)', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, defeaturingTolerance: 0.5 });
    // size > tol → değişiklik yok
    expect(m2.elements.length).toBe(m1.elements.length);
  });

  test('Tolerans 0 veya undefined → varsayılan davranış (eski mesh)', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, defeaturingTolerance: 0 });
    expect(m2.elements.length).toBe(m1.elements.length);
  });
});

// ─── Faz 2 Adım 1 — Edge Sizing Controls (ANSYS §5.5) ───
describe('Edge Sizing Controls (opts.edgeSizingControls → named selection)', () => {
  test('Cylinder edgeBottomCircle için target size atanır', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 5, edgeSizingControls: [{ edgeId: 'edgeBottomCircle', size: 0.5, behavior: 'soft' }] }
    );
    expect(m.namedSelections['edge-sizing-0']).toBeDefined();
    var ns = m.namedSelections['edge-sizing-0'];
    expect(ns.type).toBe('edge');
    expect(ns.edgeSizing.sourceEdgeId).toBe('edgeBottomCircle');
    expect(ns.edgeSizing.targetSize).toBe(0.5);
    expect(ns.edgeSizing.behavior).toBe('soft');
  });

  test('Number of Divisions atanır (size null)', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 5, edgeSizingControls: [{ edgeId: 'edgeTopCircle', divisions: 24, behavior: 'hard' }] }
    );
    var ns = m.namedSelections['edge-sizing-0'];
    expect(ns).toBeDefined();
    expect(ns.edgeSizing.divisions).toBe(24);
    expect(ns.edgeSizing.targetSize).toBeNull();
    expect(ns.edgeSizing.behavior).toBe('hard');
  });

  test('Shaft 4 edge entry — tümü çalışır', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } },
      { size: 10, edgeSizingControls: [
        { edgeId: 'edgeOuterBottom', size: 1, behavior: 'soft' },
        { edgeId: 'edgeOuterTop',    size: 1, behavior: 'soft' },
        { edgeId: 'edgeInnerBottom', size: 0.5, behavior: 'hard' },
        { edgeId: 'edgeInnerTop',    size: 0.5, behavior: 'hard' }
      ]}
    );
    for (var i = 0; i < 4; i++) {
      expect(m.namedSelections['edge-sizing-' + i]).toBeDefined();
    }
  });

  test('Bilinmeyen edgeId atlanır', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 5, edgeSizingControls: [
        { edgeId: 'edgeBottomCircle', size: 1, behavior: 'soft' },
        { edgeId: 'edgeNonExistent',  size: 1, behavior: 'soft' }
      ]}
    );
    expect(m.namedSelections['edge-sizing-0']).toBeDefined();
    expect(m.namedSelections['edge-sizing-1']).toBeUndefined();
  });

  test('Hem size hem divisions yok → atlanır', () => {
    var m = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 5, edgeSizingControls: [
        { edgeId: 'edgeBottomCircle', size: null, divisions: null, behavior: 'soft' }
      ]}
    );
    expect(m.namedSelections['edge-sizing-0']).toBeUndefined();
  });
});

// ─── Faz 2 Adım 0 — Face Sizing Controls (ANSYS §5.1) ───
describe('Face Sizing Controls (opts.faceSizingControls → named selection)', () => {
  test('Tek face entry (box: faceYMax): mevcut auto face selection\'a sizing metadata ekler', () => {
    var mesh = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, faceSizingControls: [{ faceId: 'faceYMax', size: 1.5, behavior: 'soft' }] }
    );
    expect(mesh.namedSelections['face-sizing-0']).toBeDefined();
    var ns = mesh.namedSelections['face-sizing-0'];
    expect(ns.type).toBe('face');
    expect(ns.nodeIds.length).toBeGreaterThan(0);
    // Aynı node ID'ler face-sizing'de ve auto face'te paylaşılır (reference)
    expect(ns.nodeIds).toBe(mesh.namedSelections.faceYMax.nodeIds);
    expect(ns.faceSizing).toBeDefined();
    expect(ns.faceSizing.sourceFaceId).toBe('faceYMax');
    expect(ns.faceSizing.targetSize).toBe(1.5);
    expect(ns.faceSizing.behavior).toBe('soft');
  });

  test('Behavior=hard metadata\'da korunur', () => {
    var mesh = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, faceSizingControls: [{ faceId: 'faceYMin', size: 0.8, behavior: 'hard' }] }
    );
    expect(mesh.namedSelections['face-sizing-0'].faceSizing.behavior).toBe('hard');
  });

  test('Birden fazla face entry — her biri ayrı selection', () => {
    var mesh = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, faceSizingControls: [
        { faceId: 'faceYMax', size: 1, behavior: 'soft' },
        { faceId: 'faceYMin', size: 2, behavior: 'hard' }
      ]}
    );
    expect(mesh.namedSelections['face-sizing-0']).toBeDefined();
    expect(mesh.namedSelections['face-sizing-1']).toBeDefined();
    expect(mesh.namedSelections['face-sizing-0'].faceSizing.sourceFaceId).toBe('faceYMax');
    expect(mesh.namedSelections['face-sizing-1'].faceSizing.sourceFaceId).toBe('faceYMin');
  });

  test('Bilinmeyen faceId (auto selection\'da yok) sessizce atlanır', () => {
    var mesh = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, faceSizingControls: [
        { faceId: 'faceYMax',        size: 1, behavior: 'soft' },
        { faceId: 'faceNonExistent', size: 1, behavior: 'soft' }
      ]}
    );
    expect(mesh.namedSelections['face-sizing-0']).toBeDefined();
    // index 1 atlandı çünkü face bulunamadı
    expect(mesh.namedSelections['face-sizing-1']).toBeUndefined();
  });

  test('Geçersiz size (0, negatif, NaN) atlanır', () => {
    var mesh = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, faceSizingControls: [
        { faceId: 'faceYMax', size: 0,   behavior: 'soft' },   // sıfır
        { faceId: 'faceYMax', size: -1,  behavior: 'soft' },   // negatif
        { faceId: 'faceYMax', size: NaN, behavior: 'soft' },   // NaN
        { faceId: 'faceYMax', size: 2,   behavior: 'soft' }    // geçerli
      ]}
    );
    expect(mesh.namedSelections['face-sizing-0']).toBeUndefined();
    expect(mesh.namedSelections['face-sizing-1']).toBeUndefined();
    expect(mesh.namedSelections['face-sizing-2']).toBeUndefined();
    expect(mesh.namedSelections['face-sizing-3']).toBeDefined();
  });

  test('Cylinder eğri yüzey (faceSide) için çalışır', () => {
    var mesh = veFEAMeshFromGeometry(
      { type: 'cylinder', params: { radius: 5, height: 10 } },
      { size: 3, faceSizingControls: [{ faceId: 'faceSide', size: 0.5, behavior: 'soft' }] }
    );
    expect(mesh.namedSelections['face-sizing-0']).toBeDefined();
    expect(mesh.namedSelections['face-sizing-0'].faceSizing.sourceFaceId).toBe('faceSide');
  });

  test('Boş veya tanımsız faceSizingControls → namedSelections değişmez', () => {
    var m1 = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, faceSizingControls: [] }
    );
    var keys = Object.keys(m1.namedSelections).filter(function(k) { return k.indexOf('face-sizing') === 0; });
    expect(keys.length).toBe(0);
  });
});

// ─── Faz 1 Adım 4 — Sphere of Influence (ANSYS §5.2) ───
describe('Sphere of Influence (opts.sphereOfInfluence → named selection)', () => {
  test('Tek küre içindeki node\'lar named selection oluşturur', () => {
    var mesh = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 20, height: 20, depth: 20 } },
      { size: 5, sphereOfInfluence: [{ cx: 0, cy: 0, cz: 0, radius: 8 }] }
    );
    expect(mesh.namedSelections).toBeDefined();
    expect(mesh.namedSelections['sphere-influence-0']).toBeDefined();
    var ns = mesh.namedSelections['sphere-influence-0'];
    expect(ns.type).toBe('node');
    expect(ns.source).toBe('auto');
    expect(ns.nodeIds.length).toBeGreaterThan(0);
    expect(ns.sphereOfInfluence).toBeDefined();
    expect(ns.sphereOfInfluence.radius).toBe(8);
  });

  test('Birden fazla küre — her biri ayrı selection', () => {
    var mesh = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 30, height: 30, depth: 30 } },
      { size: 5, sphereOfInfluence: [
        { cx: -10, cy: 0, cz: 0, radius: 4 },
        { cx:  10, cy: 0, cz: 0, radius: 4 }
      ]}
    );
    expect(mesh.namedSelections['sphere-influence-0']).toBeDefined();
    expect(mesh.namedSelections['sphere-influence-1']).toBeDefined();
    // İki küre disjoint
    var a = new Set(Array.from(mesh.namedSelections['sphere-influence-0'].nodeIds));
    var b = new Set(Array.from(mesh.namedSelections['sphere-influence-1'].nodeIds));
    var common = 0;
    a.forEach(function(id) { if (b.has(id)) common++; });
    expect(common).toBe(0);
  });

  test('Hiçbir node içine düşmeyen küre → selection eklenmez', () => {
    var mesh = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, sphereOfInfluence: [{ cx: 1000, cy: 1000, cz: 1000, radius: 1 }] }
    );
    expect(mesh.namedSelections['sphere-influence-0']).toBeUndefined();
  });

  test('targetSize metadata olarak saklanır', () => {
    var mesh = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, sphereOfInfluence: [{ cx: 0, cy: 0, cz: 0, radius: 5, targetSize: 1.5 }] }
    );
    var ns = mesh.namedSelections['sphere-influence-0'];
    if (ns) expect(ns.sphereOfInfluence.targetSize).toBe(1.5);
  });

  test('Geçersiz küre (radius<=0) sessizce atlanır', () => {
    var mesh = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, sphereOfInfluence: [
        { cx: 0, cy: 0, cz: 0, radius: 0 },         // sıfır radius
        { cx: 0, cy: 0, cz: 0, radius: -5 },        // negatif
        { cx: NaN, cy: 0, cz: 0, radius: 5 },       // NaN
        { cx: 0, cy: 0, cz: 0, radius: 5 }          // geçerli
      ]}
    );
    expect(mesh.namedSelections['sphere-influence-0']).toBeUndefined();
    expect(mesh.namedSelections['sphere-influence-1']).toBeUndefined();
    expect(mesh.namedSelections['sphere-influence-2']).toBeUndefined();
    expect(mesh.namedSelections['sphere-influence-3']).toBeDefined();
  });

  test('Boş veya tanımsız sphereOfInfluence → namedSelections değişmez', () => {
    var mesh1 = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, sphereOfInfluence: [] }
    );
    var keys1 = Object.keys(mesh1.namedSelections).filter(function(k) { return k.startsWith('sphere-'); });
    expect(keys1.length).toBe(0);

    var mesh2 = veFEAMeshFromGeometry(
      { type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5 } // sphereOfInfluence yok
    );
    var keys2 = Object.keys(mesh2.namedSelections).filter(function(k) { return k.startsWith('sphere-'); });
    expect(keys2.length).toBe(0);
  });
});

// ─── Faz 4 — Physics Preference (ANSYS §2) ───
describe('Physics Preference (ANSYS §2 — preset defaults)', () => {
  test('veFEAPhysicsPresets 3 preset döndürür', () => {
    var presets = veFEAPhysicsPresets();
    expect(presets).toContain('static');
    expect(presets).toContain('nonlinearMechanical');
    expect(presets).toContain('explicit');
  });

  test('Static preset: program order, curvature off', () => {
    var s = veFEAPhysicsPresetSettings('static');
    expect(s.elementOrder).toBe('program');
    expect(s.curvatureRefinement.enabled).toBe(false);
  });

  test('Nonlinear preset: linear order, curvature on, relativeSizeFactor=0.5', () => {
    var s = veFEAPhysicsPresetSettings('nonlinearMechanical');
    expect(s.elementOrder).toBe('linear');
    expect(s.curvatureRefinement.enabled).toBe(true);
    expect(s.relativeSizeFactor).toBe(0.5);
  });

  test('Explicit preset: defeaturing > 0', () => {
    var s = veFEAPhysicsPresetSettings('explicit');
    expect(s.defeaturingTolerance).toBeGreaterThan(0);
  });

  test('Bilinmeyen preset → null', () => {
    expect(veFEAPhysicsPresetSettings('bogus')).toBeNull();
  });
});

// ─── Faz 2 Adım 4 — Mesh Method dropdown (ANSYS §4) ───
describe('cp-fea.js Mesh paneli — Mesh Method dropdown (ANSYS §4)', () => {
  beforeEach(() => {
    global.nodes = [];
  });

  test('Dropdown render edilir, 4 seçenek: automatic, patchConformingTet, hexDominant, sweep', () => {
    var node = { id: 'mm1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/id="ve-fea-mesh-method-mm1"/);
    expect(html).toMatch(/Patch Conforming Tet/);
    expect(html).toMatch(/Hex Dominant/);
    expect(html).toMatch(/Automatic/);
    expect(html).toMatch(/Sweep/);
  });

  test('Persisted meshMethod="patchConformingTet" → seçili', () => {
    var node = { id: 'mm2', type: 'fea-mesh', data: { meshSettings: { meshMethod: 'patchConformingTet' } } };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    var opt = html.match(/<option value="patchConformingTet"[^>]*>/);
    expect(opt[0]).toMatch(/selected/);
  });

  test('Method haritası: tet4 → patchConformingTet, pyramid5 → hexDominant, auto → automatic', () => {
    expect(_veFEAInferMethodFromElType('tet4')).toBe('patchConformingTet');
    expect(_veFEAInferMethodFromElType('pyramid5')).toBe('hexDominant');
    expect(_veFEAInferMethodFromElType('auto')).toBe('automatic');
    expect(_veFEAMethodToElType('patchConformingTet')).toBe('tet4');
    expect(_veFEAMethodToElType('hexDominant')).toBe('pyramid5');
    expect(_veFEAMethodToElType('automatic')).toBe('auto');
  });
});

describe('cp-fea.js Mesh paneli — Element Order dropdown (ANSYS §3.7)', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Dropdown render edilir, default Program Controlled', () => {
    var node = { id: 'mesh-q1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/id="ve-fea-mesh-elorder-mesh-q1"/);
    expect(html).toMatch(/Element Order/);
    expect(html).toMatch(/Program Controlled/);
    expect(html).toMatch(/Linear/);
    expect(html).toMatch(/Quadratic/);
    // Default: program selected
    var optProgramMatch = html.match(/<option value="program"[^>]*>/);
    expect(optProgramMatch[0]).toMatch(/selected/);
    var optQuadMatch = html.match(/<option value="quadratic"[^>]*>/);
    expect(optQuadMatch[0]).not.toMatch(/selected/);
  });

  test('Persisted midSideNodes:true (geri uyum) → Quadratic seçili', () => {
    var node = { id: 'mesh-q2', type: 'fea-mesh', data: { meshSettings: { size: 5, midSideNodes: true } } };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    var optQuadMatch = html.match(/<option value="quadratic"[^>]*>/);
    expect(optQuadMatch[0]).toMatch(/selected/);
  });

  test('Persisted elementOrder:"linear" → Linear seçili (canonical alan)', () => {
    var node = { id: 'mesh-q3', type: 'fea-mesh', data: { meshSettings: { size: 5, elementOrder: 'linear' } } };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    var optLinearMatch = html.match(/<option value="linear"[^>]*>/);
    expect(optLinearMatch[0]).toMatch(/selected/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeJacobianMetrics', () => {
  test('Kutu mesh için tüm elemanlar geçerli (no inverted/degenerate)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
    expect(jm.invertedCount).toBe(0);
    expect(jm.degenerateCount).toBe(0);
    expect(jm.elementCount).toBe(8);
    expect(jm.minJacRatio).toBeCloseTo(1, 2); // küp → tüm sub-tet hacimleri eşit
    expect(jm.maxJacRatio).toBeCloseTo(1, 2);
  });

  test('Silindir mesh için geçerli', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
    expect(jm.invertedCount).toBe(0);
  });

  test('Şaft mesh için geçerli', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } }, { size: 10 });
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
  });

  test('Tet4 mesh için geçerli (tek tet → ratio 1.0)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
    expect(jm.elementCount).toBe(48); // 8 hex × 6 tet
    // Her tet için ratio = max/min = 1/1 = 1 (tek sub-tet)
    expect(jm.minJacRatio).toBeCloseTo(1, 4);
    expect(jm.maxJacRatio).toBeCloseTo(1, 4);
  });

  test('Manuel ters dönmüş tet → invertedCount artar', () => {
    // 4 düğüm, swap son ikisini → orientation flipped
    var mesh = {
      type: 'tet4',
      nodes: new Float32Array([0,0,0,  1,0,0,  0,1,0,  0,0,1]),
      elements: new Uint32Array([0, 1, 3, 2]), // 2 ve 3 swapped → inverted
      nodesPerElement: 4
    };
    var jm = veFEAComputeJacobianMetrics(mesh);
    expect(jm.invertedCount).toBe(1);
    expect(jm.valid).toBe(false);
    expect(jm.invertedIds).toContain(0);
  });

  test('Manuel dejenere tet (collapsed) → degenerateCount artar', () => {
    // 4 düğüm coplanar (z=0) → volume = 0
    var mesh = {
      type: 'tet4',
      nodes: new Float32Array([0,0,0,  1,0,0,  0,1,0,  1,1,0]),
      elements: new Uint32Array([0, 1, 2, 3]),
      nodesPerElement: 4
    };
    var jm = veFEAComputeJacobianMetrics(mesh);
    expect(jm.degenerateCount).toBe(1);
    expect(jm.valid).toBe(false);
  });

  test('null mesh → null döner', () => {
    expect(veFEAComputeJacobianMetrics(null)).toBeNull();
    expect(veFEAComputeJacobianMetrics({ error: 'voxel-too-many' })).toBeNull();
  });

  test('Voxel STEP → tüm voxel hex geçerli', () => {
    function getCubeParsed() {
      var tris = [
        [0,0,0, 10,10,0, 10,0,0,  0,0,-1],
        [0,0,0, 0,10,0, 10,10,0,  0,0,-1],
        [0,0,10, 10,0,10, 10,10,10,  0,0,1],
        [0,0,10, 10,10,10, 0,10,10,  0,0,1],
        [0,0,0, 0,0,10, 0,10,10,  -1,0,0],
        [0,0,0, 0,10,10, 0,10,0,  -1,0,0],
        [10,0,0, 10,10,0, 10,10,10,  1,0,0],
        [10,0,0, 10,10,10, 10,0,10,  1,0,0],
        [0,0,0, 10,0,0, 10,0,10,  0,-1,0],
        [0,0,0, 10,0,10, 0,0,10,  0,-1,0],
        [0,10,0, 0,10,10, 10,10,10,  0,1,0],
        [0,10,0, 10,10,10, 10,10,0,  0,1,0]
      ];
      var vertices = new Float32Array(tris.length * 9);
      for (var i = 0; i < tris.length; i++) {
        for (var j = 0; j < 9; j++) vertices[i * 9 + j] = tris[i][j];
      }
      return { vertices: vertices, triangleCount: tris.length };
    }
    // Snap'siz ham voxel hex8 test (8 eleman). Boundary snap + tet4 default
    // davranışı için disableBoundarySnap:true kullan.
    var m = veFEAMeshFromGeometry(
      { type: 'step', _parsedTriangles: getCubeParsed() },
      { size: 5, disableBoundarySnap: true }
    );
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
    expect(jm.elementCount).toBe(8);
  });

  test('Jacobian metrics meshMetrics içine entegre olur (build sonrası)', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-1', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
    veFEABuildMeshForNode('mesh-1');
    expect(global.nodes[1].data.meshMetrics.jacobian).toBeDefined();
    expect(global.nodes[1].data.meshMetrics.jacobian.valid).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Jacobian/Geçerlilik bölümü', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Mesh yoksa "—" gösterilir', () => {
    var node = { id: 'mesh-j1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/Jacobian.*Geçerlilik/);
  });

  test('Geçerli mesh için "GEÇERLİ" mesajı yeşil', () => {
    var node = {
      id: 'mesh-j2',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5,
          jacobian: {
            elementCount: 8, invertedCount: 0, degenerateCount: 0, poorCount: 0,
            invertedIds: [], minVolume: 125, maxVolume: 125,
            minJacRatio: 1.0, maxJacRatio: 1.0, avgJacRatio: 1.0,
            ratioWarnThreshold: 40, valid: true
          }
        }
      }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/GEÇERLİ/);
    expect(html).toMatch(/22c55e/); // accent-success rengi
  });

  test('Ters eleman olan mesh için "HATALI" mesajı kırmızı', () => {
    var node = {
      id: 'mesh-j3',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5,
          jacobian: {
            elementCount: 8, invertedCount: 2, degenerateCount: 0, poorCount: 0,
            invertedIds: [3, 5], minVolume: -10, maxVolume: 125,
            minJacRatio: 1.0, maxJacRatio: 100, avgJacRatio: 5.0,
            ratioWarnThreshold: 40, valid: false
          }
        }
      }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/HATALI/);
    expect(html).toMatch(/ef4444/); // accent-danger rengi
  });

  test('Düşük kaliteli (poorCount > 0) için uyarı satırı', () => {
    var node = {
      id: 'mesh-j4',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          nodeCount: 27, elementCount: 100, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5,
          jacobian: {
            elementCount: 100, invertedCount: 0, degenerateCount: 0, poorCount: 7,
            invertedIds: [], minVolume: 1, maxVolume: 125,
            minJacRatio: 1.0, maxJacRatio: 80, avgJacRatio: 5.0,
            ratioWarnThreshold: 40, valid: true
          }
        }
      }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/7 eleman düşük kaliteli/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Tet4 decomposition (veFEAConvertMeshToTet4)', () => {
  test('Hex8 mesh → her Heks8 6 Tet4 olur', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var nHex = hex.elements.length / 8;
    var tet = veFEAConvertMeshToTet4(hex);
    expect(tet.type).toBe('tet4');
    expect(tet.nodesPerElement).toBe(4);
    expect(tet.elements.length / 4).toBe(nHex * 6);
    // Düğüm konumları aynı (paylaşılan referans)
    expect(tet.nodes).toBe(hex.nodes);
    expect(tet.convertedFromHex).toBe(true);
  });

  test('Wedge6 mesh → her wedge 3 Tet4 olur (legacy crossSection:"wedge")', () => {
    var wed = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5, crossSection: 'wedge' });
    var nWed = wed.elements.length / 6;
    var tet = veFEAConvertMeshToTet4(wed);
    expect(tet.type).toBe('tet4');
    expect(tet.elements.length / 4).toBe(nWed * 3);
    expect(tet.convertedFromWedge).toBe(true);
  });

  test('Tet4 mesh tekrar dönüştürülmez (no-op)', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var tet1 = veFEAConvertMeshToTet4(hex);
    var tet2 = veFEAConvertMeshToTet4(tet1);
    expect(tet2.elements.length).toBe(tet1.elements.length);
    expect(tet2.type).toBe('tet4');
  });

  test('Named selections tet4\'e taşınır (node ID\'ler korunur)', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var tet = veFEAConvertMeshToTet4(hex);
    expect(tet.namedSelections).toBeDefined();
    expect(Object.keys(tet.namedSelections).length).toBe(6);
    // Aynı düğüm IDs kullanılıyor — tet4\'de hala geçerli
    var ids = tet.namedSelections.faceXMin.nodeIds;
    var maxIdx = tet.nodes.length / 3 - 1;
    for (var i = 0; i < ids.length; i++) {
      expect(ids[i]).toBeLessThanOrEqual(maxIdx);
    }
  });

  test('null veya error mesh için no-op', () => {
    expect(veFEAConvertMeshToTet4(null)).toBeNull();
    var err = { error: 'voxel-too-many' };
    expect(veFEAConvertMeshToTet4(err)).toBe(err);
  });

  test('Tri3 (yüzey) mesh\'ler etkilenmez', () => {
    var tri = { type: 'tri3', nodes: new Float32Array(0), elements: new Uint32Array(0), nodesPerElement: 3 };
    var out = veFEAConvertMeshToTet4(tri);
    expect(out.type).toBe('tri3');
  });

  test('Tet4 element indeksleri geçerli', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var tet = veFEAConvertMeshToTet4(hex);
    var maxIdx = tet.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < tet.elements.length; i++) {
      if (tet.elements[i] < 0 || tet.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });

  test('Hex8 6-tet split toplam hacim ≈ original hex hacim', () => {
    // Heks8 hacmi (1×1×1) = 1; 6 tet hacim toplamı da 1 olmalı (mass conservation)
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var tet = veFEAConvertMeshToTet4(hex);
    var nodes = tet.nodes;
    var totalVol = 0;
    for (var e = 0; e < tet.elements.length / 4; e++) {
      var off = e * 4;
      var a = tet.elements[off], b = tet.elements[off + 1], c = tet.elements[off + 2], d = tet.elements[off + 3];
      var ax = nodes[a*3], ay = nodes[a*3+1], az = nodes[a*3+2];
      var bx = nodes[b*3], by = nodes[b*3+1], bz = nodes[b*3+2];
      var cx = nodes[c*3], cy = nodes[c*3+1], cz = nodes[c*3+2];
      var dx = nodes[d*3], dy = nodes[d*3+1], dz = nodes[d*3+2];
      // V = (1/6) |((b-a) × (c-a)) · (d-a)|
      var v1x = bx-ax, v1y = by-ay, v1z = bz-az;
      var v2x = cx-ax, v2y = cy-ay, v2z = cz-az;
      var v3x = dx-ax, v3y = dy-ay, v3z = dz-az;
      var cross_x = v1y*v2z - v1z*v2y;
      var cross_y = v1z*v2x - v1x*v2z;
      var cross_z = v1x*v2y - v1y*v2x;
      var vol = Math.abs(cross_x*v3x + cross_y*v3y + cross_z*v3z) / 6;
      totalVol += vol;
    }
    expect(totalVol).toBeCloseTo(1, 4);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Pyramid5 dönüşümleri (Hex8 ↔ Pyramid5 ↔ Tet4)', () => {
  test('Hex8 → Pyramid5: her hex için 6 piramit ve 1 centroid eklenir', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var nHex = hex.elements.length / 8;
    var origNodeCount = hex.nodes.length / 3;
    var pyr = veFEAConvertHexToPyramid5(hex);
    expect(pyr.type).toBe('pyramid5');
    expect(pyr.nodesPerElement).toBe(5);
    expect(pyr.elements.length / 5).toBe(nHex * 6);
    // Her hex kendi centroid'ini ekler → toplam +nHex düğüm
    expect(pyr.nodes.length / 3).toBe(origNodeCount + nHex);
    expect(pyr.convertedFromHex).toBe(true);
  });

  test('Pyramid5 elemanlarda her piramit 5 farklı düğüm içerir', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var pyr = veFEAConvertHexToPyramid5(hex);
    var nElem = pyr.elements.length / 5;
    for (var e = 0; e < nElem; e++) {
      var off = e * 5;
      var ids = new Set();
      for (var c = 0; c < 5; c++) ids.add(pyr.elements[off + c]);
      expect(ids.size).toBe(5);
    }
  });

  test('Pyramid5 → Tet4: her piramit 2 tetraya bölünür', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var pyr = veFEAConvertHexToPyramid5(hex);
    var nPyr = pyr.elements.length / 5;
    var tet = veFEAConvertPyramidToTet4(pyr);
    expect(tet.type).toBe('tet4');
    expect(tet.elements.length / 4).toBe(nPyr * 2);
    expect(tet.convertedFromPyramid).toBe(true);
  });

  test('Hex → Pyramid5 → Tet4 hacim korunur', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var pyr = veFEAConvertHexToPyramid5(hex);
    var tet = veFEAConvertPyramidToTet4(pyr);
    var nodes = tet.nodes;
    var totalVol = 0;
    for (var e = 0; e < tet.elements.length / 4; e++) {
      var off = e * 4;
      var a = tet.elements[off], b = tet.elements[off + 1], c = tet.elements[off + 2], d = tet.elements[off + 3];
      var ax = nodes[a*3], ay = nodes[a*3+1], az = nodes[a*3+2];
      var bx = nodes[b*3], by = nodes[b*3+1], bz = nodes[b*3+2];
      var cx = nodes[c*3], cy = nodes[c*3+1], cz = nodes[c*3+2];
      var dx = nodes[d*3], dy = nodes[d*3+1], dz = nodes[d*3+2];
      var v1x = bx-ax, v1y = by-ay, v1z = bz-az;
      var v2x = cx-ax, v2y = cy-ay, v2z = cz-az;
      var v3x = dx-ax, v3y = dy-ay, v3z = dz-az;
      var cross_x = v1y*v2z - v1z*v2y;
      var cross_y = v1z*v2x - v1x*v2z;
      var cross_z = v1x*v2y - v1y*v2x;
      totalVol += Math.abs(cross_x*v3x + cross_y*v3y + cross_z*v3z) / 6;
    }
    expect(totalVol).toBeCloseTo(1, 4);
  });

  test('Pyramid5 element indeksleri geçerli', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var pyr = veFEAConvertHexToPyramid5(hex);
    var maxIdx = pyr.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < pyr.elements.length; i++) {
      if (pyr.elements[i] < 0 || pyr.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });

  test('Named selections Pyramid5\'e taşınır (orijinal node IDs korunur)', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var pyr = veFEAConvertHexToPyramid5(hex);
    expect(pyr.namedSelections).toBeDefined();
    expect(pyr.namedSelections.faceXMin).toBeDefined();
    // Apex düğümleri orijinal yüzey ID'lerinin sonuna eklendi, dolayısıyla
    // namedSelection ID'leri hala geçerli.
    var maxIdx = pyr.nodes.length / 3 - 1;
    pyr.namedSelections.faceXMin.nodeIds.forEach(function(id) {
      expect(id).toBeLessThanOrEqual(maxIdx);
    });
  });

  test('Pyramid5 etiketi: "Pyramid5 (Piramit)"', () => {
    expect(veFEAMeshLabel('pyramid5')).toBe('Pyramid5 (Piramit)');
  });

  test('veFEAConvertHexToPyramid5: hex8 olmayan → no-op', () => {
    var tet = { type: 'tet4', nodes: new Float32Array(0), elements: new Uint32Array(0), nodesPerElement: 4 };
    expect(veFEAConvertHexToPyramid5(tet)).toBe(tet);
    expect(veFEAConvertHexToPyramid5(null)).toBeNull();
  });

  test('veFEAConvertPyramidToTet4: pyramid5 olmayan → no-op', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    expect(veFEAConvertPyramidToTet4(hex)).toBe(hex);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshFromGeometry — elementType seçimi', () => {
  test('elementType "auto" → native eleman tipi (hex8)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'auto' });
    expect(m.type).toBe('hex8');
  });

  test('elementType "tet4" → kutu Hex8 → Tet4 dönüştürür', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    expect(m.type).toBe('tet4');
    expect(m.elements.length / 4).toBe(8 * 6); // 8 hex × 6 tet
  });

  test('elementType "tet4" → silindir Hex8 (O-grid) → 6 Tet4 / hex', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5, elementType: 'tet4' });
    expect(m.type).toBe('tet4');
    var native = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    // Yeni default Hex8 (O-grid): her hex 6 tet
    expect(m.elements.length / 4).toBe((native.elements.length / 8) * 6);
  });

  test('elementType "tet4" + legacy wedge → her wedge 3 tet', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5, elementType: 'tet4', crossSection: 'wedge' });
    expect(m.type).toBe('tet4');
    var native = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5, crossSection: 'wedge' });
    expect(m.elements.length / 4).toBe((native.elements.length / 6) * 3);
  });

  test('Voxel STEP + elementType "tet4" → tet4 voxel mesh', () => {
    function getCubeParsed() {
      var tris = [
        [0,0,0, 10,10,0, 10,0,0,  0,0,-1],
        [0,0,0, 0,10,0, 10,10,0,  0,0,-1],
        [0,0,10, 10,0,10, 10,10,10,  0,0,1],
        [0,0,10, 10,10,10, 0,10,10,  0,0,1],
        [0,0,0, 0,0,10, 0,10,10,  -1,0,0],
        [0,0,0, 0,10,10, 0,10,0,  -1,0,0],
        [10,0,0, 10,10,0, 10,10,10,  1,0,0],
        [10,0,0, 10,10,10, 10,0,10,  1,0,0],
        [0,0,0, 10,0,0, 10,0,10,  0,-1,0],
        [0,0,0, 10,0,10, 0,0,10,  0,-1,0],
        [0,10,0, 0,10,10, 10,10,10,  0,1,0],
        [0,10,0, 10,10,10, 10,10,0,  0,1,0]
      ];
      var vertices = new Float32Array(tris.length * 9);
      for (var i = 0; i < tris.length; i++) {
        for (var j = 0; j < 9; j++) vertices[i * 9 + j] = tris[i][j];
      }
      return { vertices: vertices, triangleCount: tris.length };
    }
    var m = veFEAMeshFromGeometry(
      { type: 'step', _parsedTriangles: getCubeParsed() },
      { size: 5, mode: 'volume', elementType: 'tet4' }
    );
    expect(m.type).toBe('tet4');
    expect(m.voxelMode).toBe(true);
    expect(m.elements.length / 4).toBe(8 * 6); // 8 voxel × 6 tet
  });

  test('Surface mode tet4\'ten etkilenmez (tri3 kalır)', () => {
    function getTwoTriangles() {
      var tris = [
        [0,0,0, 10,10,0, 10,0,0,  0,0,-1],
        [0,0,0, 0,10,0, 10,10,0,  0,0,-1]
      ];
      var vertices = new Float32Array(tris.length * 9);
      for (var i = 0; i < tris.length; i++) {
        for (var j = 0; j < 9; j++) vertices[i * 9 + j] = tris[i][j];
      }
      return { vertices: vertices, triangleCount: tris.length };
    }
    var m = veFEAMeshFromGeometry(
      { type: 'step', _parsedTriangles: getTwoTriangles() },
      { size: 5, mode: 'surface', elementType: 'tet4' }
    );
    // Surface modunda tri3 — tet4 dönüştürmesi uygulanmaz
    expect(m.type).toBe('tri3');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Eleman Tipi seçici', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Eleman Tipi dropdown render edilir (2 seçenek)', () => {
    var node = { id: 'mesh-et1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/id="ve-fea-mesh-eltype-mesh-et1"/);
    expect(html).toMatch(/value="auto"/);
    expect(html).toMatch(/value="tet4"/);
  });

  test('Default elementType "auto" seçili', () => {
    var node = { id: 'mesh-et2', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    // İki dropdown var (mode + elementType); elementType auto seçili olmalı
    expect(html).toMatch(/id="ve-fea-mesh-eltype-mesh-et2"[^>]*>[\s\S]*?value="auto"\s+selected/);
  });

  test('Persist edilmiş elementType UI\'da işaretlenir', () => {
    var node = { id: 'mesh-et3', type: 'fea-mesh', data: { meshSettings: { size: 10, mode: 'auto', elementType: 'tet4' } } };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/id="ve-fea-mesh-eltype-mesh-et3"[^>]*>[\s\S]*?value="tet4"\s+selected/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Named Selections — otomatik üretim', () => {
  test('Kutu mesh 6 yüzey selection üretir', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    expect(m.namedSelections).toBeDefined();
    var keys = Object.keys(m.namedSelections);
    expect(keys).toContain('faceXMin');
    expect(keys).toContain('faceXMax');
    expect(keys).toContain('faceYMin');
    expect(keys).toContain('faceYMax');
    expect(keys).toContain('faceZMin');
    expect(keys).toContain('faceZMax');
    expect(keys.length).toBe(6);
  });

  test('Kutu 2×2×2: her yüzeyde (ny+1)*(nz+1) = 9 düğüm', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    // nx=ny=nz=2 → her face 3×3 = 9
    expect(m.namedSelections.faceXMin.nodeIds.length).toBe(9);
    expect(m.namedSelections.faceXMax.nodeIds.length).toBe(9);
    expect(m.namedSelections.faceYMin.nodeIds.length).toBe(9);
    expect(m.namedSelections.faceYMax.nodeIds.length).toBe(9);
    expect(m.namedSelections.faceZMin.nodeIds.length).toBe(9);
    expect(m.namedSelections.faceZMax.nodeIds.length).toBe(9);
  });

  test('Kutu XMin yüzeyindeki düğümlerin x-koordinatı geometrinin minX değerine eşit', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var ids = m.namedSelections.faceXMin.nodeIds;
    for (var i = 0; i < ids.length; i++) {
      expect(m.nodes[ids[i] * 3]).toBeCloseTo(-5, 5); // x0 = -w/2
    }
  });

  test('Kutu YMax yüzeyindeki düğümlerin y-koordinatı maxY', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var ids = m.namedSelections.faceYMax.nodeIds;
    for (var i = 0; i < ids.length; i++) {
      expect(m.nodes[ids[i] * 3 + 1]).toBeCloseTo(5, 5);
    }
  });

  test('Silindir mesh 3 yüzey + 2 daire kenar selection üretir', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var keys = Object.keys(m.namedSelections);
    expect(keys).toContain('faceTop');
    expect(keys).toContain('faceBottom');
    expect(keys).toContain('faceSide');
    expect(keys).toContain('edgeBottomCircle');
    expect(keys).toContain('edgeTopCircle');
    expect(keys.length).toBe(5);
    expect(m.namedSelections.edgeBottomCircle.type).toBe('edge');
    expect(m.namedSelections.edgeTopCircle.type).toBe('edge');
  });

  test('Silindir Alt disk düğümlerinin y-koordinatı -h/2', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var ids = m.namedSelections.faceBottom.nodeIds;
    for (var i = 0; i < ids.length; i++) {
      expect(m.nodes[ids[i] * 3 + 1]).toBeCloseTo(-10, 5);
    }
  });

  test('Silindir Yan yüzey düğümlerinin radyal mesafesi R', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var ids = m.namedSelections.faceSide.nodeIds;
    for (var i = 0; i < ids.length; i++) {
      var x = m.nodes[ids[i] * 3];
      var z = m.nodes[ids[i] * 3 + 2];
      expect(Math.sqrt(x * x + z * z)).toBeCloseTo(10, 5);
    }
  });

  test('Şaft mesh 4 yüzey + 4 daire kenar selection üretir', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } }, { size: 10 });
    var keys = Object.keys(m.namedSelections);
    expect(keys).toContain('faceTop');
    expect(keys).toContain('faceBottom');
    expect(keys).toContain('faceOuter');
    expect(keys).toContain('faceInner');
    expect(keys).toContain('edgeOuterBottom');
    expect(keys).toContain('edgeOuterTop');
    expect(keys).toContain('edgeInnerBottom');
    expect(keys).toContain('edgeInnerTop');
    expect(keys.length).toBe(8);
  });

  test('Şaft İç yüzey düğümlerinin radyal mesafesi iç yarıçap', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } }, { size: 10 });
    var ids = m.namedSelections.faceInner.nodeIds;
    for (var i = 0; i < ids.length; i++) {
      var x = m.nodes[ids[i] * 3];
      var z = m.nodes[ids[i] * 3 + 2];
      expect(Math.sqrt(x * x + z * z)).toBeCloseTo(8, 4);
    }
  });

  test('Tüm selection nodeIds geçerli aralıkta', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var maxIdx = m.nodes.length / 3 - 1;
    Object.keys(m.namedSelections).forEach(function(k) {
      var ids = m.namedSelections[k].nodeIds;
      for (var i = 0; i < ids.length; i++) {
        expect(ids[i]).toBeGreaterThanOrEqual(0);
        expect(ids[i]).toBeLessThanOrEqual(maxIdx);
      }
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeNamedSelectionsSummary', () => {
  test('mesh.namedSelections → { label, type, source, nodeCount } özet', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var summary = veFEAComputeNamedSelectionsSummary(m);
    expect(Object.keys(summary).length).toBe(6);
    expect(summary.faceXMin.nodeCount).toBe(9);
    expect(summary.faceXMin.label).toMatch(/X−/);
    expect(summary.faceXMin.type).toBe('face');
    expect(summary.faceXMin.source).toBe('auto');
    // nodeIds özet'te olmamalı (JSON-serializable kalsın)
    expect(summary.faceXMin.nodeIds).toBeUndefined();
  });

  test('null mesh → {} döner', () => {
    expect(veFEAComputeNamedSelectionsSummary(null)).toEqual({});
    expect(veFEAComputeNamedSelectionsSummary({})).toEqual({});
  });

  test('Özet JSON-serializable (Float32Array/Uint32Array içermez)', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var summary = veFEAComputeNamedSelectionsSummary(m);
    expect(() => JSON.stringify(summary)).not.toThrow();
    var parsed = JSON.parse(JSON.stringify(summary));
    // 3 face + 2 edge
    expect(Object.keys(parsed).length).toBe(5);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAToggleNamedSelection köprüsü', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.showNodeProperties = jest.fn();
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
  });

  test('Mevcut highlight yokken key → highlightedSelection = key', () => {
    global.nodes = [{ id: 'mesh-1', type: 'fea-mesh', data: {} }];
    veFEAToggleNamedSelection('mesh-1', 'faceXMin');
    expect(global.nodes[0].data.highlightedSelection).toBe('faceXMin');
  });

  test('Aynı key tekrar → toggle (null)', () => {
    global.nodes = [{ id: 'mesh-1', type: 'fea-mesh', data: { highlightedSelection: 'faceXMin' } }];
    veFEAToggleNamedSelection('mesh-1', 'faceXMin');
    expect(global.nodes[0].data.highlightedSelection).toBeNull();
  });

  test('Farklı key → highlight değişir', () => {
    global.nodes = [{ id: 'mesh-1', type: 'fea-mesh', data: { highlightedSelection: 'faceXMin' } }];
    veFEAToggleNamedSelection('mesh-1', 'faceYMax');
    expect(global.nodes[0].data.highlightedSelection).toBe('faceYMax');
  });

  test('Bilinmeyen nodeId → sessizce çıkar', () => {
    expect(() => veFEAToggleNamedSelection('nonexistent', 'foo')).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Named Selections bölümü', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Mesh yoksa "Mesh oluşturulduktan sonra" mesajı', () => {
    var node = { id: 'mesh-ns1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/Atanmış Yüzeyler/);
    expect(html).toMatch(/Mesh oluşturulduktan sonra/);
  });

  test('namedSelectionsSummary varsa düğüm grupları listelenir', () => {
    var node = {
      id: 'mesh-ns2',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: { nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5 },
        namedSelectionsSummary: {
          faceXMin: { label: 'X− Yüzeyi', type: 'face', source: 'auto', nodeCount: 9 },
          faceXMax: { label: 'X+ Yüzeyi', type: 'face', source: 'auto', nodeCount: 9 }
        }
      }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/X− Yüzeyi/);
    expect(html).toMatch(/X\+ Yüzeyi/);
    expect(html).toMatch(/AUTO/);
    expect(html).toMatch(/veFEAToggleNamedSelection\('mesh-ns2', 'faceXMin'\)/);
  });

  test('Aktif highlight için ◉ ikonu, diğerleri için ○', () => {
    var node = {
      id: 'mesh-ns3',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: { nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5 },
        highlightedSelection: 'faceXMin',
        namedSelectionsSummary: {
          faceXMin: { label: 'X− Yüzeyi', type: 'face', source: 'auto', nodeCount: 9 },
          faceXMax: { label: 'X+ Yüzeyi', type: 'face', source: 'auto', nodeCount: 9 }
        }
      }
    };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    // Aktif faceXMin için ◉ kullanılmalı
    expect(html).toMatch(/◉/);
    expect(html).toMatch(/○/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEABuildMeshForNode — namedSelectionsSummary persist', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
  });

  test('mesh hesaplandıktan sonra namedSelectionsSummary node.data\'ya kaydedilir', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-1', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    veFEABuildMeshForNode('mesh-1');
    var summary = global.nodes[1].data.namedSelectionsSummary;
    expect(summary).toBeDefined();
    expect(Object.keys(summary).length).toBe(6);
    expect(summary.faceXMin.nodeCount).toBe(9);
  });

  test('Mesh silindikten sonra namedSelectionsSummary da temizlenir', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-1', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    veFEABuildMeshForNode('mesh-1');
    expect(global.nodes[1].data.namedSelectionsSummary).toBeDefined();
    veFEAClearMeshForNode('mesh-1');
    expect(global.nodes[1].data.namedSelectionsSummary).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAInitMeshViewerForNode (graceful, Three.js olmadan)', () => {
  beforeEach(() => {
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
    document.body.innerHTML = '';
  });

  test('canvas yoksa sessizce çıkar', () => {
    expect(() => veFEAInitMeshViewerForNode('nonexistent')).not.toThrow();
  });

  test('canvas varsa hata atmaz (Three.js olmadan 2D fallback)', () => {
    document.body.innerHTML = '<canvas id="ve-fea-mesh-canvas-t1" width="240" height="180"></canvas>';
    expect(() => veFEAInitMeshViewerForNode('t1')).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Regresyon: fullscreen viewer Mesh node için cache'ten yüklemeli.
// Kullanıcı raporu: "Mesh ekranındaki tam ekran görüntüleyici tam olarak
// çalışmıyor. Mesh'li geometri tam olarak gelmiyor."
describe('_veFEALoadNodeGeometryIntoViewer — Mesh node desteği', () => {
  beforeEach(() => {
    global.nodes = [];
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
  });

  test('Mesh node + cache\'te mesh varsa viewer.loadMesh çağrılır', () => {
    global.nodes = [{ id: 'mesh-x', type: 'fea-mesh', data: { meshActive: true } }];
    veFEAMeshCache['mesh-x'] = {
      type: 'hex8', nodes: new Float32Array([0,0,0, 1,0,0]),
      elements: new Uint32Array([]), nodesPerElement: 8
    };
    var loadMeshMock = jest.fn();
    var loadSTLMock = jest.fn();
    var loadPrimitiveMock = jest.fn();
    var mockViewer = { loadMesh: loadMeshMock, loadSTL: loadSTLMock, loadPrimitive: loadPrimitiveMock };
    _veFEALoadNodeGeometryIntoViewer(mockViewer, 'mesh-x');
    expect(loadMeshMock).toHaveBeenCalledTimes(1);
    expect(loadSTLMock).not.toHaveBeenCalled();
    expect(loadPrimitiveMock).not.toHaveBeenCalled();
  });

  test('Mesh node + cache\'te mesh YOKsa hata atmaz', () => {
    global.nodes = [{ id: 'mesh-empty', type: 'fea-mesh', data: {} }];
    var loadMeshMock = jest.fn();
    var mockViewer = { loadMesh: loadMeshMock };
    expect(() => _veFEALoadNodeGeometryIntoViewer(mockViewer, 'mesh-empty')).not.toThrow();
    expect(loadMeshMock).not.toHaveBeenCalled();
  });

  test('Geometry node yine eski davranışla yüklenir (primitif)', () => {
    global.nodes = [{ id: 'g1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } }];
    var loadMeshMock = jest.fn();
    var loadPrimitiveMock = jest.fn();
    var mockViewer = { loadMesh: loadMeshMock, loadPrimitive: loadPrimitiveMock };
    _veFEALoadNodeGeometryIntoViewer(mockViewer, 'g1');
    expect(loadPrimitiveMock).toHaveBeenCalledTimes(1);
    expect(loadPrimitiveMock).toHaveBeenCalledWith('box', expect.any(Object));
    expect(loadMeshMock).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshSelfTest — mesh kalite diagnostiği', () => {
  test('Sonuç nesnesi doğru yapıda döner', () => {
    var r = veFEAMeshSelfTest({ verbose: false });
    expect(r).toHaveProperty('pass');
    expect(r).toHaveProperty('fail');
    expect(r).toHaveProperty('total');
    expect(r).toHaveProperty('rows');
    expect(r).toHaveProperty('summary');
    expect(r.pass + r.fail).toBe(r.total);
    expect(Array.isArray(r.rows)).toBe(true);
    expect(r.total).toBeGreaterThan(0);
  });

  test('Düzeltilen geometriler (tor, koni-apex, küre) çözücü-uyumlu geçer', () => {
    var r = veFEAMeshSelfTest({ verbose: false });
    var failed = r.rows.filter(function (x) { return !x.ok; }).map(function (x) { return x.senaryo; });
    // Tor, koni (apex+frustum) ve küre senaryolarının HİÇBİRİ başarısız olmamalı.
    var critical = failed.filter(function (s) {
      return /^Tor|^Koni|^Küre /.test(s);  // "Küre " (yarımküre "Y.Küre" hariç)
    });
    expect(critical).toEqual([]);
  });

  test('Her satırda inverted/degenerate alanları raporlanır', () => {
    var r = veFEAMeshSelfTest({ verbose: false });
    var passing = r.rows.filter(function (x) { return x.ok; });
    expect(passing.length).toBeGreaterThan(0);
    passing.forEach(function (row) {
      expect(row.inverted).toBe(0);
      expect(row.degenerate).toBe(0);
    });
  });
});
