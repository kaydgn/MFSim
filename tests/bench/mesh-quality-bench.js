#!/usr/bin/env node
// ============================================================================
// MFSim — Mesh Kalite Benchmark (ANSYS karşılaştırması, GENİŞ ölçüm)
// ============================================================================
// Amaç: mevcut mesh motorunu temsili geometriler + boyut taramasında çalıştırıp
// ANSYS Mechanical kalite metrikleriyle ölçer ve "fark raporu" üretir.
// Kapsam: tüm primitifler, kaba/orta/ince boyut, native + tet4,
//         ve STEP yolunu temsil eden sentetik kapalı üçgen-çorbası.
//
// Çalıştır:  node tests/bench/mesh-quality-bench.js
// NOT: Bu bir ÖLÇÜM aracıdır; mesh motorunu DEĞİŞTİRMEZ. Jest test değildir
//      (assertion yok) — kalite/regresyon gözlemi için manuel çalıştırılır.
// ============================================================================

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');

global.window = global;
// Minimal DOM stub — components.js yüklenirken veObserveModuleOverlay gibi
// DOM erişen yan-etkiler Node ortamında hata vermesin (mesh motoru DOM kullanmaz).
global.document = global.document || {
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  addEventListener: function () {}
};
function src(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
try { eval(src('vendor/delaunay/delaunay-bundle.js')); } catch (e) {
  console.warn('[uyarı] delaunay-bundle yüklenemedi:', e.message);
}
eval(src('js/fea-mesh-utils.js'));
eval(src('js/components.js'));
eval(src('js/fea-primitives.js'));
eval(src('js/fea-topology.js'));
eval(src('js/fea-delaunay.js'));
eval(src('js/fea-mesh.js'));

// ─── ANSYS Mechanical referans eşikleri ─────────────────────────────────────
const ANSYS = {
  skewness:     { excellent: 0.25, good: 0.50, acceptable: 0.80, bad: 0.95 },
  orthoQuality: { excellent: 0.95, good: 0.70, acceptable: 0.20, bad: 0.001 },
  aspectRatio:  { good: 3, acceptable: 10, bad: 20 },
  jacobian:     { good: 5, acceptable: 30, bad: 40 },
};
function fmt(x, d) { return (x === null || x === undefined || isNaN(x)) ? '—' : x.toFixed(d === undefined ? 3 : d); }
function rate(metric, val) {
  if (val === null || val === undefined || isNaN(val)) return '?';
  const t = ANSYS[metric];
  if (metric === 'orthoQuality') {
    if (val >= t.excellent) return 'MÜK'; if (val >= t.good) return 'İYİ';
    if (val >= t.acceptable) return 'KBL'; return 'KÖTÜ';
  }
  if (metric === 'skewness') {
    if (val <= t.excellent) return 'MÜK'; if (val <= t.good) return 'İYİ';
    if (val <= t.acceptable) return 'KBL'; return 'KÖTÜ';
  }
  if (val <= t.good) return 'İYİ'; if (val <= t.acceptable) return 'KBL';
  if (val <= t.bad) return 'SNR'; return 'KÖTÜ';
}

// ─── Sentetik kapalı üçgen-çorbası (STEP yolunu temsil) ─────────────────────
// UV-sphere tessellation → triangle soup. STEP geometrisi formatında bir
// { type:'step', vertices:Float32Array(triangle-soup), triangleCount } üretir.
// NOT: motorun _veFEAParseSurfaceTriangles beklentisine birebir uymayabilir;
//      STEP yolu gerçek OCCT çıktısıyla ayrıca doğrulanmalı.
function makeSphereStep(R, latSeg, lonSeg) {
  const tris = [];
  function P(la, lo) {
    const phi = Math.PI * (la / latSeg) - Math.PI / 2;
    const th = 2 * Math.PI * (lo / lonSeg);
    return [R * Math.cos(phi) * Math.cos(th), R * Math.sin(phi), R * Math.cos(phi) * Math.sin(th)];
  }
  for (let la = 0; la < latSeg; la++) {
    for (let lo = 0; lo < lonSeg; lo++) {
      const a = P(la, lo), b = P(la + 1, lo), c = P(la + 1, lo + 1), d = P(la, lo + 1);
      tris.push(a, b, c, a, c, d);
    }
  }
  const verts = new Float32Array(tris.length * 3);
  for (let i = 0; i < tris.length; i++) { verts[i*3]=tris[i][0]; verts[i*3+1]=tris[i][1]; verts[i*3+2]=tris[i][2]; }
  return { type: 'step', vertices: verts, triangleCount: tris.length / 3, bbox: { min:[-R,-R,-R], max:[R,R,R] } };
}

// ─── Test senaryoları ───────────────────────────────────────────────────────
const cases = [];
const prim = [
  ['Kutu',     { type:'box',      params:{ width:50, height:30, depth:20 } }],
  ['Silindir', { type:'cylinder', params:{ radius:15, height:60 } }],
  ['Şaft',     { type:'shaft',    params:{ outerRadius:20, innerRadius:8, length:120 } }],
  ['Küre',     { type:'sphere',   params:{ radius:25 } }],
  ['Koni',     { type:'cone',     params:{ radius:20, height:50 } }],
  ['Tor',      { type:'torus',    params:{ majorRadius:30, minorRadius:10 } }],
  ['Y.Küre',   { type:'hemisphere',params:{ radius:25 } }],
  ['I-Kiriş',  { type:'ibeam',    params:{ width:50, height:80, length:200, flangeThickness:8, webThickness:6 } }],
  ['L-Köşe',   { type:'lbracket', params:{ width:50, height:50, length:100, thickness:8 } }],
  ['Kutu Boru',{ type:'rectTube', params:{ width:50, height:40, length:120, thickness:6 } }],
];
const sizes = [{ tag:'kaba', size:10 }, { tag:'orta', size:5 }, { tag:'ince', size:2.5 }];
for (const [name, geom] of prim) {
  for (const s of sizes) {
    cases.push({ name: name+' ('+s.tag+')', geom, opts:{ size:s.size }, group:'native' });
  }
}
// Tet4 varyantları (orta boyut)
for (const [name, geom] of prim) {
  cases.push({ name: name+' →tet4', geom, opts:{ size:5, elementType:'tet4' }, group:'tet4' });
}
// STEP yolu (sentetik küre triangle-soup)
cases.push({ name:'STEP-küre voxel', geom: makeSphereStep(25, 16, 24), opts:{ size:5, disableTetMesher:true }, group:'step' });
cases.push({ name:'STEP-küre tet',   geom: makeSphereStep(25, 16, 24), opts:{ size:5 }, group:'step' });

console.log('\n=== MFSim Mesh Kalite Benchmark — GENİŞ (ANSYS referanslı) ===');
console.log('Delaunay mevcut:', veFEADelaunayAvailable());

const header = ['Senaryo','Tip','Düğüm','Eleman','AR(max)','Skew(max)','OrthoQ(min)','Jac(max)','Inv/Deg','ms'];
const rows = [];
for (const c of cases) {
  let mesh, q, jac, err = null, t0 = Date.now();
  try {
    mesh = veFEAMeshFromGeometry(c.geom, c.opts);
    if (!mesh) err = 'null';
    else if (mesh.error) err = 'err:' + mesh.error;
    else { q = veFEAComputeQualityMetrics(mesh); jac = veFEAComputeJacobianMetrics(mesh); }
  } catch (e) { err = 'throw:' + e.message; }
  const ms = Date.now() - t0;
  if (err) { rows.push([c.name, '!', err, '', '', '', '', '', '', String(ms)]); continue; }
  const nNodes = mesh.nodes ? mesh.nodes.length / 3 : 0;
  rows.push([
    c.name, mesh.type, String(nNodes), String(q.elementCount),
    fmt(q.aspectRatio.max,1)+'·'+rate('aspectRatio',q.aspectRatio.max),
    fmt(q.skewness.max)+'·'+rate('skewness',q.skewness.max),
    q.orthogonalQuality ? fmt(q.orthogonalQuality.min)+'·'+rate('orthoQuality',q.orthogonalQuality.min) : '—',
    jac ? fmt(jac.maxJacRatio,1)+'·'+rate('jacobian',jac.maxJacRatio) : '—',
    jac ? String(jac.invertedCount)+'/'+jac.degenerateCount : '—',
    String(ms),
  ]);
}
const widths = header.map((h,i)=>Math.max(h.length, ...rows.map(r=>String(r[i]||'').length)));
const line = cells => cells.map((c,i)=>String(c||'').padEnd(widths[i])).join(' | ');
console.log('');
console.log(line(header));
console.log(widths.map(w=>'-'.repeat(w)).join('-+-'));
let lastGroup = null;
for (let i = 0; i < rows.length; i++) {
  if (cases[i].group !== lastGroup) { console.log(widths.map(w=>'·'.repeat(w)).join('···')); lastGroup = cases[i].group; }
  console.log(line(rows[i]));
}
console.log('\nKısaltma: MÜK=mükemmel İYİ KBL=kabul SNR=sınırda KÖTÜ | Inv/Deg=inverted/degenerate eleman');
console.log('Eşik: Skew<0.25mük/<0.5iyi/<0.8kbl | OrthoQ>0.95mük/>0.7iyi/>0.2kbl | AR<3iyi/<10kbl/>20kötü | Jac<5iyi/<30kbl/>40kötü');
