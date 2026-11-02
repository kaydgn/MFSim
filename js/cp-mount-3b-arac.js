// ============================================================================
//  TAKOZ 3B — CAD ARAÇLARI: GÖRÜNÜŞLER VE KESİT
// ============================================================================
// Kullanıcı isteği (2026-11-02): "3D görüntüleyici tıpkı bir CAD programı gibi
// olmalı. Ölçümler, kesit alma vb. kullanışlı özellikleri ekleyeceğiz."
//   · ARAÇ ÇUBUĞU tuvalin üstünde, ağaç ile kartın arasında ortada.
//   · GÖRÜNÜŞLER araç ekseninde (+X arka, +Y sağ, +Z yukarı): Ön (önden,
//     −X'ten) · Arka · Sol (−Y'den) · Sağ · Üst · Alt · İzometrik (eşit
//     kısalma: yükseliş atan(1/√2)); seçilen bakışta model sığar.
//   · KESİT: X · Y · Z düzlemi, kaydırıcıyla konumu (mm), Ters. Kesilen yan
//     çizilmez ve SEÇİLMEZ: ışın kesilen yandaki üçgeni atlar (js/cp-mount-3b.js
//     → _mw3bUcgenKes); düzlem soluk dikdörtgenle gösterilir.
// Durumu js/cp-mount-3b.js tutar (_mw3b); bu dosya çubuğun HTML'ini, bakışın
// açılarını ve kesit düzlemini kurar.
// ============================================================================

var VE_MW_3B_BAKIS = [
  { k: 'on', ad: 'Ön', theta: Math.PI, phi: 0 },
  { k: 'arka', ad: 'Arka', theta: 0, phi: 0 },
  { k: 'sol', ad: 'Sol', theta: -Math.PI / 2, phi: 0 },
  { k: 'sag', ad: 'Sağ', theta: Math.PI / 2, phi: 0 },
  { k: 'ust', ad: 'Üst', theta: Math.PI, phi: VE_MW_3B_PHI },
  { k: 'alt', ad: 'Alt', theta: Math.PI, phi: -VE_MW_3B_PHI },
  { k: 'izo', ad: 'İzometrik', theta: 0.75 * Math.PI, phi: Math.atan(1 / Math.SQRT2) }
];
var VE_MW_3B_EKSEN_HARF = ['X', 'Y', 'Z'];
// Kaydırıcının adım sayısı (montajın o eksendeki boyu bu kadar dilime bölünür)
var VE_MW_3B_KESIT_ADIM = 400;

function veMntWiz3bBakisBul(k){
  for(var i = 0; i < VE_MW_3B_BAKIS.length; i++) if(VE_MW_3B_BAKIS[i].k === k) return VE_MW_3B_BAKIS[i];
  return null;
}
// Kesit düzlemi (saf, testli): { eksen: 0|1|2, d: mm, ters } → [nx, ny, nz, c];
// kalan yan n·p + c ≥ 0 (three.js'in kırpma düzlemiyle aynı işaret). Ters değilse
// eksenin küçük yanı kalır (p ≤ d), tersse büyük yanı.
function veMntWiz3bKesitDuzlem(k){
  if(!k || !(k.eksen >= 0 && k.eksen <= 2) || !isFinite(k.d)) return null;
  var n = [0, 0, 0];
  n[k.eksen] = k.ters ? 1 : -1;
  return [n[0], n[1], n[2], k.ters ? -k.d : k.d];
}
function veMntWiz3bKesitKalir(K, x, y, z){ return !K || K[0] * x + K[1] * y + K[2] * z + K[3] >= -1e-9; }
// Kaydırıcının aralığı: montajın kutusunun o eksendeki boyu, iki yanda %1 pay
function veMntWiz3bKesitAralik(kutu, eksen){
  if(!kutu || !kutu.min) return [0, 1];
  var a = ['x', 'y', 'z'][eksen], lo = kutu.min[a], hi = kutu.max[a], p = (hi - lo) * 0.01 || 1;
  return [lo - p, hi + p];
}

// Araç çubuğu (saf, testli). D: { kesit: { eksen, d, ters } | null, aralik: [lo, hi] }
function veMntWiz3bAracHTML(D){
  var k = D && D.kesit, h = '<div class="ve-mw-3b-arac-sira" role="toolbar" aria-label="3B araçları">'
    + '<div class="ve-mw-3b-arac-grup" role="group" aria-label="Bakış">';
  VE_MW_3B_BAKIS.forEach(function(g){
    h += '<button type="button" class="ve-mw-3b-arac-b" data-ve-3b-bakis="' + g.k + '" onclick="veMntWiz3bBakis(\'' + g.k + '\')">'
      + g.ad + '</button>';
  });
  h += '</div><button type="button" class="ve-mw-3b-arac-b" id="ve-mw-3b-kesit" aria-pressed="' + (k ? 'true' : 'false') + '"'
    + ' onclick="veMntWiz3bKesit()">' + _mwIkon('scissors') + ' Kesit</button></div>';
  if(!k) return h;
  var A = (D && D.aralik) || [0, 1], adim = (A[1] - A[0]) / VE_MW_3B_KESIT_ADIM;
  h += '<div class="ve-mw-3b-arac-sira ve-mw-3b-kesit" role="group" aria-label="Kesit">'
    + '<div class="ve-mw-3b-arac-grup" role="group" aria-label="Kesit ekseni">';
  VE_MW_3B_EKSEN_HARF.forEach(function(x, i){
    h += '<button type="button" class="ve-mw-3b-arac-b" data-ve-3b-kesit-eksen="' + i + '" aria-pressed="' + (k.eksen === i ? 'true' : 'false') + '"'
      + ' onclick="veMntWiz3bKesitEksen(' + i + ')">' + x + '</button>';
  });
  h += '</div><input type="range" class="ve-mw-3b-kesit-d" id="ve-mw-3b-kesit-d" aria-label="Kesit konumu"'
    + ' min="' + A[0] + '" max="' + A[1] + '" step="' + adim + '" value="' + k.d + '" oninput="veMntWiz3bKesitD(this.value)">'
    + '<span class="ve-mw-3b-kesit-deger" id="ve-mw-3b-kesit-deger">' + veMntWiz3bKesitYazi(k) + '</span>'
    + '<button type="button" class="ve-mw-3b-arac-b" id="ve-mw-3b-kesit-ters" aria-pressed="' + (k.ters ? 'true' : 'false') + '"'
    + ' onclick="veMntWiz3bKesitTers()">Ters</button></div>';
  return h;
}
function veMntWiz3bKesitYazi(k){
  return VE_MW_3B_EKSEN_HARF[k.eksen].toLowerCase() + ' = ' + _mwSayi(Math.round(k.d * 10) / 10, 1) + ' mm';
}

// ── EYLEMLER (görüntüleyici açıkken) ──────────────────────────────────────
function veMntWiz3bBakis(k){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null, g = veMntWiz3bBakisBul(k);
  if(!V || !V.scene || !g || !V.kutu) return false;
  V.ctrl.theta = g.theta; V.ctrl.phi = g.phi;
  V.eldegdi = true;
  _mw3bSigdir(V.kutu, _mw3bOrnekNoktalar());
  return true;
}
function veMntWiz3bKesit(){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.scene || !V.kutu) return false;
  if(V.kesit) V.kesit = null;
  else {
    var A = veMntWiz3bKesitAralik(V.kutu, 0);
    V.kesit = { eksen: 0, d: (A[0] + A[1]) / 2, ters: false };
  }
  _mw3bKesitUygula(true);
  return true;
}
function veMntWiz3bKesitEksen(i){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.kesit || !(i >= 0 && i <= 2)) return false;
  var A = veMntWiz3bKesitAralik(V.kutu, i);
  V.kesit = { eksen: i, d: (A[0] + A[1]) / 2, ters: V.kesit.ters };
  _mw3bKesitUygula(true);
  return true;
}
function veMntWiz3bKesitD(v){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null, d = parseFloat(v);
  if(!V || !V.kesit || !isFinite(d)) return false;
  V.kesit.d = d;
  _mw3bKesitUygula(false);
  return true;
}
function veMntWiz3bKesitTers(){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.kesit) return false;
  V.kesit.ters = !V.kesit.ters;
  _mw3bKesitUygula(true);
  return true;
}
// Düzlemi malzemelere ve ışına uygular; `cubuk`: çubuk yeniden kurulur (kaydırıcı
// sürüklenirken kurulmaz — odak ve sürükleme kaybolurdu, yalnız yazı tazelenir)
function _mw3bKesitUygula(cubuk){
  var V = _mw3b, K = veMntWiz3bKesitDuzlem(V.kesit);
  V.kesitK = K;
  var M = V.malzeme, liste = [M.opak, M.soluk, M.derinlik, M.cizgi];
  if(K){
    if(!V.kesitP) V.kesitP = new THREE.Plane(new THREE.Vector3(), 0);
    V.kesitP.normal.set(K[0], K[1], K[2]); V.kesitP.constant = K[3];
    V.renderer.localClippingEnabled = true;
    if(!V.kesitDizi) V.kesitDizi = [V.kesitP];
    liste.forEach(function(m){ if(m.clippingPlanes !== V.kesitDizi){ m.clippingPlanes = V.kesitDizi; m.needsUpdate = true; } });
  } else {
    liste.forEach(function(m){ if(m.clippingPlanes && m.clippingPlanes.length){ m.clippingPlanes = []; m.needsUpdate = true; } });
  }
  _mw3bKesitGorsel();
  if(cubuk) _mw3bAracYaz();
  else {
    var y = document.getElementById('ve-mw-3b-kesit-deger');
    if(y && V.kesit) y.textContent = veMntWiz3bKesitYazi(V.kesit);
  }
  _mw3bCiz(true);
}
// Kesit düzleminin soluk dikdörtgeni ve kenarı (kırpılmaz)
function _mw3bKesitGorsel(){
  var V = _mw3b;
  if(V.kesitG){
    V.scene.remove(V.kesitG);
    V.kesitG.traverse(function(o){ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); });
    V.kesitG = null;
  }
  if(!V.kesit || !V.kutu) return;
  var e = V.kesit.eksen, b = V.kutu, boy = b.getSize(new THREE.Vector3()), m = b.getCenter(new THREE.Vector3());
  var u = [boy.y, boy.x, boy.x][e] * 1.08 || 100, v = [boy.z, boy.z, boy.y][e] * 1.08 || 100;
  var renk = _mw3bRenk('--accent-primary', '#a8502b'), G = new THREE.Group();
  var yuz = new THREE.Mesh(new THREE.PlaneGeometry(u, v), new THREE.MeshBasicMaterial({ color: renk, transparent: true, opacity: 0.1,
    depthWrite: false, side: THREE.DoubleSide }));
  var kenar = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(u, v)),
    new THREE.LineBasicMaterial({ color: renk, transparent: true, opacity: 0.6 }));
  G.add(yuz); G.add(kenar);
  if(e === 0) G.rotation.set(0, Math.PI / 2, Math.PI / 2);
  else if(e === 1) G.rotation.set(Math.PI / 2, 0, 0);
  var p = [m.x, m.y, m.z]; p[e] = V.kesit.d;
  G.position.set(p[0], p[1], p[2]);
  G.renderOrder = 3;
  V.kesitG = G;
  V.scene.add(G);
}
function _mw3bAracYaz(){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null, el = typeof document !== 'undefined' && document.getElementById('ve-mw-3b-arac');
  if(!V || !el) return;
  el.innerHTML = veMntWiz3bAracHTML({ kesit: V.kesit, aralik: V.kesit && V.kutu ? veMntWiz3bKesitAralik(V.kutu, V.kesit.eksen) : null });
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    VE_MW_3B_BAKIS: VE_MW_3B_BAKIS, veMntWiz3bBakisBul: veMntWiz3bBakisBul, veMntWiz3bKesitDuzlem: veMntWiz3bKesitDuzlem,
    veMntWiz3bKesitKalir: veMntWiz3bKesitKalir, veMntWiz3bKesitAralik: veMntWiz3bKesitAralik, veMntWiz3bAracHTML: veMntWiz3bAracHTML,
    veMntWiz3bKesitYazi: veMntWiz3bKesitYazi
  };
}
