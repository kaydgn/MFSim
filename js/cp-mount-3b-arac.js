// ============================================================================
//  TAKOZ 3B — CAD ARAÇLARI: GÖRÜNÜŞLER, SEÇİM SÜZGECİ, ÖLÇÜ VE KESİT
// ============================================================================
// Kullanıcı isteği (2026-11-02): "3D görüntüleyici tıpkı bir CAD programı gibi
// olmalı. Ölçümler, kesit alma vb. kullanışlı özellikleri ekleyeceğiz." ·
// "Modelde yüzey seçme özelliğini de getirelim."
//   · ARAÇ ÇUBUĞU tuvalin üstünde, ağaç ile kartın arasında ortada.
//   · GÖRÜNÜŞLER araç ekseninde (+X arka, +Y sağ, +Z yukarı): Ön (önden,
//     −X'ten) · Arka · Sol (−Y'den) · Sağ · Üst · Alt · İzometrik (eşit
//     kısalma: yükseliş atan(1/√2)); seçilen bakışta model sığar.
//   · SEÇİM SÜZGECİ: Parça (rol, ağaç — olağan) · Yüzey (aşağıda, 4b).
//   · ÖLÇÜ: iki nokta arası (aşağıda, 4b).
//   · KESİT: X · Y · Z düzlemi, kaydırıcıyla konumu (mm), Ters. Kesilen yan
//     çizilmez ve SEÇİLMEZ: ışın kesilen yandaki üçgeni atlar (js/cp-mount-3b.js
//     → _mw3bUcgenKes); düzlem soluk dikdörtgenle gösterilir.
// Durumu js/cp-mount-3b.js tutar (_mw3b); bu dosya çubuğun HTML'ini, bakışın
// açılarını, kesit düzlemini, yüz seçimini ve ölçüyü kurar.
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

// Araç çubuğu (saf, testli). D: { kesit: { eksen, d, ters } | null, aralik: [lo, hi],
// suzgec: 'parca' | 'yuz', olcu: ölçü açık mı }
function veMntWiz3bAracHTML(D){
  var k = D && D.kesit, yuz = !!(D && D.suzgec === 'yuz'), bas = function(b){ return ' aria-pressed="' + (b ? 'true' : 'false') + '"'; };
  var ayrac = '<span class="ve-mw-3b-arac-ayrac" aria-hidden="true"></span>';
  var h = '<div class="ve-mw-3b-arac-sira" role="toolbar" aria-label="3B araçları">'
    + '<div class="ve-mw-3b-arac-grup" role="group" aria-label="Bakış">';
  VE_MW_3B_BAKIS.forEach(function(g){
    h += '<button type="button" class="ve-mw-3b-arac-b" data-ve-3b-bakis="' + g.k + '" onclick="veMntWiz3bBakis(\'' + g.k + '\')">'
      + g.ad + '</button>';
  });
  h += '</div>' + ayrac + '<div class="ve-mw-3b-arac-grup" role="group" aria-label="Seçim">'
    + '<button type="button" class="ve-mw-3b-arac-b" data-ve-3b-suzgec="parca"' + bas(!yuz) + ' onclick="veMntWiz3bSuzgec(\'parca\')">'
      + _mwIkon('box') + ' Parça</button>'
    + '<button type="button" class="ve-mw-3b-arac-b" data-ve-3b-suzgec="yuz"' + bas(yuz) + ' onclick="veMntWiz3bSuzgec(\'yuz\')">'
      + _mwIkon('square') + ' Yüzey</button></div>' + ayrac
    + '<button type="button" class="ve-mw-3b-arac-b" id="ve-mw-3b-olcu"' + bas(D && D.olcu) + ' onclick="veMntWiz3bOlcu()">'
      + _mwIkon('ruler') + ' Ölçü</button>'
    + '<button type="button" class="ve-mw-3b-arac-b" id="ve-mw-3b-kesit"' + bas(k) + ' onclick="veMntWiz3bKesit()">'
      + _mwIkon('scissors') + ' Kesit</button></div>';
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
  [V.yuzG, V.yuzOnG].forEach(function(o){ if(o) liste.push(o.material); });   // seçili ve fare altındaki yüz
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
  el.innerHTML = veMntWiz3bAracHTML({ kesit: V.kesit, aralik: V.kesit && V.kutu ? veMntWiz3bKesitAralik(V.kutu, V.kesit.eksen) : null,
                                      suzgec: V.suzgec, olcu: !!V.olcu });
}

// ── 4b · SEÇİM SÜZGECİ (parça · yüzey) VE ÖLÇÜ (2026-11-02) ────────────────
//   · YÜZEY: fare altındaki yüz açık vurguyla önden seçilir, tık yüzü seçer
//     (parçanın seçimi değişmez). Yüz tıklanan üçgenin yüz aralığından (ağın
//     `yuzUcgen`i — dosyanın yüz listesiyle aynı sırada); tanımı DOSYADAN
//     (veStepP21Yuz: düzlem · silindir · koni · küre · tor), alanı ağdan.
//   · ÖLÇÜ: iki tık arası uzaklık ve bileşenleri. Tık dairesel kenara
//     VE_MW_3B_DAIRE.px'ten yakınsa dairenin MERKEZİNE (CATIA'nın ölçüsü),
//     yüzün köşesine (dosyanın VERTEX_POINT'i) VE_MW_3B_OLCU.kose'den yakınsa
//     köşeye yapışır; yoksa yüzeyde tıklanan nokta. Üçüncü tık yeni ölçü
//     başlatır. Fare hareketi yalnız SVG katını yeniler (WebGL karesi çizilmez).
//   · Esc ölçüyü, sonra yüzey süzgecini kapatır (veMntWiz3bNoktaBitir'in sonu).
var VE_MW_3B_YUZ_AD = { PLANE: 'Düzlem', CYLINDRICAL_SURFACE: 'Silindir', CONICAL_SURFACE: 'Koni',
                        SPHERICAL_SURFACE: 'Küre', TOROIDAL_SURFACE: 'Tor' };
// Köşeye yapışma payı (px) · seçili ve fare altındaki yüzün örtücülüğü
var VE_MW_3B_OLCU = { kose: 8 };
var VE_MW_3B_YUZ_VURGU = { secili: 0.5, fare: 0.22 };

// Üçgenin yüzü (saf, testli): yuzUcgen'de Y[f] ≤ t < Y[f + 1] olan f (ikili arama)
function veMntWiz3bYuzSira(Y, t){
  if(!Y || Y.length < 2 || !(t >= 0) || t >= Y[Y.length - 1]) return -1;
  var lo = 0, hi = Y.length - 2;
  while(lo < hi){ var m = (lo + hi + 1) >> 1; if(Y[m] <= t) lo = m; else hi = m - 1; }
  return lo;
}
// Yüzün alanı (mm²) ağdan: yüzün üçgenlerinin toplamı
function veMntWiz3bYuzAlan(a, f){
  var Y = a.yuzUcgen, u = a.uc, T = a.ucgen, A = 0;
  for(var t = Y[f]; t < Y[f + 1]; t++){
    var i0 = T[t * 3] * 3, i1 = T[t * 3 + 1] * 3, i2 = T[t * 3 + 2] * 3;
    var e1x = u[i1] - u[i0], e1y = u[i1 + 1] - u[i0 + 1], e1z = u[i1 + 2] - u[i0 + 2];
    var e2x = u[i2] - u[i0], e2y = u[i2 + 1] - u[i0 + 1], e2z = u[i2 + 2] - u[i0 + 2];
    var cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x;
    A += Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
  }
  return A;
}
// Yüzün köşeleri (dünya, mm; saf, testli): sınır döngülerinin kenarlarının
// VERTEX_POINT'leri, her köşe bir kez — dosyada yazılı nokta, ağdan değil
function veMntWiz3bYuzKoseler(model, yuzId, M, birim){
  var out = [], gor = {}, k = birim && birim.mm > 0 ? birim.mm : 1;
  if(typeof veStepP21Varlik !== 'function' || !model) return out;
  var V = function(id){ try { return veStepP21Varlik(model, id); } catch(e){ return null; } };
  var refler = function(x){ var r = []; (Array.isArray(x) ? x : [x]).forEach(function(y){ if(y && y.ref) r.push(y.ref); }); return r; };
  var nokta = function(vid){
    if(!vid || gor[vid]) return;
    gor[vid] = 1;
    var vp = V(vid), cp = vp && vp.t === 'VERTEX_POINT' && vp.a[1] && vp.a[1].ref ? V(vp.a[1].ref) : null, c = cp && cp.a && cp.a[1];
    if(!Array.isArray(c) || c.length < 2) return;
    var p = [c[0] * k, c[1] * k, (c.length > 2 ? c[2] : 0) * k];
    out.push(M ? veStepP21NoktaUygula(M, p) : p);
  };
  var y = V(yuzId);
  if(!y || !y.a) return out;
  refler(y.a[1]).forEach(function(b){                       // FACE_(OUTER_)BOUND(ad, döngü, yön)
    var fb = V(b), lp = fb && fb.a && fb.a[1] && fb.a[1].ref ? V(fb.a[1].ref) : null;
    if(!lp || !lp.a) return;
    if(lp.t === 'VERTEX_LOOP'){ nokta(lp.a[1] && lp.a[1].ref); return; }
    if(lp.t !== 'EDGE_LOOP') return;
    refler(lp.a[1]).forEach(function(oe){
      var o = V(oe), e = o && o.a && o.a[3] && o.a[3].ref ? V(o.a[3].ref) : null;   // ORIENTED_EDGE(ad, *, *, kenar, yön)
      if(!e || e.t !== 'EDGE_CURVE') return;                                      // EDGE_CURVE(ad, v1, v2, eğri, aynı)
      nokta(e.a[1] && e.a[1].ref); nokta(e.a[2] && e.a[2].ref);
    });
  });
  return out;
}
// Tıklanan üçgenin (k: üçgen dizisindeki yeri) yüzü:
// { parca, f, id, tip, ad, alan, aralik: [ilk, son), o?, n? (düzlemde dışa) | eksen?, r?, yariAci?, R?, rk? } | null
function veMntWiz3bYuzBilgi(s, pi, k){
  var a = s && s.ag && s.ag[pi], g = s && s.sonuc && s.sonuc._geo && s.sonuc._geo[pi];
  if(!a || !a.yuzUcgen || !g || !g.yuzler) return null;
  var f = veMntWiz3bYuzSira(a.yuzUcgen, Math.floor(k / 3));
  if(f < 0 || !g.yuzler[f]) return null;
  var y = null;
  try { y = (typeof veStepP21Yuz === 'function') ? veStepP21Yuz(s.sonuc._model, g.yuzler[f], g.M, g.birim) : null; } catch(e){ y = null; }
  var out = { parca: pi, f: f, id: g.yuzler[f], tip: y ? y.tip : '', ad: (y && VE_MW_3B_YUZ_AD[y.tip]) || 'Serbest yüz',
              alan: veMntWiz3bYuzAlan(a, f), aralik: [a.yuzUcgen[f], a.yuzUcgen[f + 1]] };
  if(y && y.o) out.o = y.o.slice();
  if(y && y.z){
    if(y.tip === 'PLANE') out.n = y.ayni ? y.z.slice() : [-y.z[0], -y.z[1], -y.z[2]];
    else out.eksen = y.z.slice();
  }
  ['r', 'yariAci', 'R', 'rk'].forEach(function(x){ if(y && isFinite(y[x])) out[x] = y[x]; });
  return out;
}
function _mw3bSay(x, d){ var k = Math.pow(10, d); return _mwSayi(Math.round(x * k) / k, d); }
// Düzlemin eksene dik olduğu eksen (0 · 1 · 2) ya da -1
function _mw3bDikEksen(n){
  for(var j = 0; j < 3; j++) if(n && Math.abs(Math.abs(n[j]) - 1) < 1e-9) return j;
  return -1;
}
// Yüzün tek satırlık tanımı (saf, testli) — fare altının ipucu
function veMntWiz3bYuzYazi(b){
  if(!b) return '';
  if(b.tip === 'PLANE' && b.n && b.o){
    var j = _mw3bDikEksen(b.n);
    return 'Düzlem · ' + (j >= 0 ? 'xyz'.charAt(j) + ' = ' + _mw3bSay(b.o[j], 1) + ' mm' : 'n (' + _mwStpKonum(b.n, 3) + ')');
  }
  if(b.tip === 'CYLINDRICAL_SURFACE' && isFinite(b.r)) return 'Silindir · Ø ' + _mw3bSay(2 * b.r, 1) + ' mm';
  if(b.tip === 'CONICAL_SURFACE' && isFinite(b.r)) return 'Koni · Ø ' + _mw3bSay(2 * b.r, 1) + ' mm · ' + _mw3bSay(b.yariAci, 1) + '°';
  if(b.tip === 'SPHERICAL_SURFACE' && isFinite(b.r)) return 'Küre · Ø ' + _mw3bSay(2 * b.r, 1) + ' mm';
  if(b.tip === 'TOROIDAL_SURFACE' && isFinite(b.R)) return 'Tor · R ' + _mw3bSay(b.R, 1) + ' · r ' + _mw3bSay(b.rk, 1) + ' mm';
  return b.ad || 'Serbest yüz';
}
// Kartın yüz tablosu (saf, testli): [[ad, değer], …]
function veMntWiz3bYuzSatirlar(b){
  if(!b) return [];
  var L = [['Tip', b.ad]], mm = function(x){ return _mw3bSay(x, 3) + ' mm'; }, uc = function(p){ return '(' + _mwStpKonum(p, 3) + ')'; };
  if(b.tip === 'PLANE' && b.n){
    var j = _mw3bDikEksen(b.n);
    if(j >= 0 && b.o) L.push(['Konum', 'xyz'.charAt(j) + ' = ' + mm(b.o[j])]);
    L.push(['Normal', uc(b.n)]);
  }
  if(isFinite(b.r)) L.push(['Ø', mm(2 * b.r)]);
  if(isFinite(b.yariAci)) L.push(['Yarı açı', _mw3bSay(b.yariAci, 2) + '°']);
  if(isFinite(b.R)) L.push(['R', mm(b.R)]);
  if(isFinite(b.rk)) L.push(['r', mm(b.rk)]);
  if(b.eksen) L.push(['Eksen', uc(b.eksen)]);
  if(b.o && b.tip !== 'PLANE') L.push([b.tip === 'SPHERICAL_SURFACE' || b.tip === 'TOROIDAL_SURFACE' ? 'Merkez' : 'Eksen noktası', uc(b.o)]);
  L.push(['Alan', '≈ ' + _mw3bSay(b.alan, 0) + ' mm²']);
  return L;
}
// İki noktanın ölçüsü (saf, testli)
function veMntWiz3bOlcuDeger(a, b){
  if(!a || !b) return null;
  var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  return { d: Math.sqrt(dx * dx + dy * dy + dz * dz), dx: dx, dy: dy, dz: dz };
}
var VE_MW_3B_OLCU_AD = { daire: 'Daire merkezi', kose: 'Köşe', yuz: 'Yüzey' };
// Kartın araç bölümleri (saf, testli): ölçü ve seçili yüz.
// D: { olcu: { a, b } | null, suzgec, yuz: veMntWiz3bYuzBilgi | null, parcaAd }
function veMntWiz3bAracKartHTML(D){
  var h = '', O = D && D.olcu;
  var tablo = function(L){
    return '<table class="ve-fw-tbl ve-fw-3b-tbl ve-mw-3b-olcu-tbl"><tbody>' + L.map(function(r){
      return '<tr' + (r[2] ? ' ' + r[2] : '') + '><td>' + _mwEsc(r[0]) + '</td><td class="ve-fw-num">' + _mwEsc(r[1]) + '</td></tr>';
    }).join('') + '</tbody></table>';
  };
  var nk = function(n){ return n ? VE_MW_3B_OLCU_AD[n.tur] + (n.tur === 'daire' ? ' · Ø ' + _mw3bSay(2 * n.r, 3) + ' mm' : '') : '—'; };
  if(O){
    h += '<section class="ve-fw-3b-bolum" data-ve-3b-olcu="1"><h4>Ölçü</h4>';
    if(!O.a) h += '<p class="ve-fw-dim">' + veYon('Modelde iki nokta seçin.') + '</p>';
    else {
      var M = O.b ? veMntWiz3bOlcuDeger(O.a.p, O.b.p) : null;
      var L = [['1', nk(O.a)], ['', '(' + _mwStpKonum(O.a.p, 3) + ')'], ['2', nk(O.b)]];
      if(O.b) L.push(['', '(' + _mwStpKonum(O.b.p, 3) + ')']);
      if(M){
        L.push(['Uzaklık', _mw3bSay(M.d, 3) + ' mm', 'class="ve-mw-3b-olcu-d" data-ve-3b-olcu-d="' + M.d + '"']);   // makine: e2e'nin okuduğu değer
        L.push(['Δx', _mw3bSay(M.dx, 3) + ' mm'], ['Δy', _mw3bSay(M.dy, 3) + ' mm'], ['Δz', _mw3bSay(M.dz, 3) + ' mm']);
      }
      h += tablo(L);
    }
    h += '</section>';
  }
  if(D && D.suzgec === 'yuz'){
    var y = D.yuz;
    h += '<section class="ve-fw-3b-bolum" data-ve-3b-yuz="' + (y ? y.f : '') + '"><h4>Yüzey</h4>';
    if(!y) h += '<p class="ve-fw-dim">' + veYon('Modelde bir yüz seçin.') + '</p>';
    else h += tablo([['Parça', D.parcaAd || '']].concat(veMntWiz3bYuzSatirlar(y)));
    h += '</section>';
  }
  return h;
}

// ── EYLEMLER ───────────────────────────────────────────────────────────────
function veMntWiz3bSuzgec(k){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.scene) return false;
  V.suzgec = k === 'yuz' ? 'yuz' : 'parca';
  _mw3bYuzOn(null);
  if(V.suzgec !== 'yuz') _mw3bYuzSec(null);
  if(V.fare >= 0){ V.fare = -1; _mw3bBoya(); }
  _mw3bIpucu(null);
  _mw3bAracYaz(); _mw3bPanel(); _mw3bCiz(true);
  return true;
}
function veMntWiz3bOlcu(){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.scene) return false;
  if(V.olcu) _mw3bOlcuKapat();
  else {
    if(V.nokta >= 0) _mw3bNoktaKip(-1);
    if(V.ref) _mw3bRefKip(null);
    _mw3bYuzOn(null);
    if(V.fare >= 0){ V.fare = -1; _mw3bBoya(); }
    _mw3bIpucu(null);
    V.olcu = { a: null, b: null, aday: null };
    if(V.kap && V.kap.classList) V.kap.classList.add('ve-mw-3b-nokta-kip');
    _mw3bAracYaz();
  }
  _mw3bPanel(); _mw3bCiz(true);
  return true;
}
// Ölçüyü kapatır (çizim ve kart çağıranın) — takozun noktası ya da referans kipi açılınca da
function _mw3bOlcuKapat(){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.olcu) return false;
  V.olcu = null;
  if(V.kap && V.kap.classList) V.kap.classList.toggle('ve-mw-3b-nokta-kip', V.nokta >= 0 || !!V.ref);
  if(typeof document !== 'undefined') _mw3bIpucu(null);
  _mw3bAracYaz();
  return true;
}
// Esc: ölçü, sonra yüzey süzgeci — döner: kapattı mı
function veMntWiz3bAracBitir(){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.scene) return false;
  if(V.olcu){ _mw3bOlcuKapat(); _mw3bPanel(); _mw3bCiz(true); return true; }
  if(V.suzgec === 'yuz'){ veMntWiz3bSuzgec('parca'); return true; }
  return false;
}
// Fare tuvalden çıktı: ölçünün adayı ve fare altındaki yüz düşer
function _mw3bAracCikis(){
  var V = _mw3b;
  if(V.olcu && V.olcu.aday){ V.olcu.aday = null; _mw3bIpucu(null); _mw3bEtiketle(); }
  if(V.yuzOn){ _mw3bYuzOn(null); _mw3bIpucu(null); _mw3bCiz(true); }
}
// Ekrandan ışın: ilk çarpılan parça, üçgeni ve noktası (kesitin kalan yanında)
// { i, k, t, p } | null
function _mw3bIsinK(cx, cy){
  var V = _mw3b;
  if(!V || !V.camera || !V.ekli.length) return null;
  var R = V.renderer.domElement.getBoundingClientRect();
  V.camera.updateMatrixWorld();
  V.ray.setFromCamera(new THREE.Vector2((cx - R.left) / (R.width || 1) * 2 - 1, -((cy - R.top) / (R.height || 1)) * 2 + 1), V.camera);
  var o = V.ray.ray.origin, d = V.ray.ray.direction, K = V.kutular, aday = [];
  for(var e = 0; e < V.ekli.length; e++){ var t = _mw3bKutuKes(o, d, K, e * 6); if(t >= 0) aday.push([t, V.ekli[e]]); }
  aday.sort(function(a, b){ return a[0] - b[0]; });
  var en = { t: Infinity, k: -1, i: -1 };
  for(var c = 0; c < aday.length && aday[c][0] <= en.t; c++){
    var q = _mw3bUcgenKesK(o, d, V.s.ag[aday[c][1]], en.t, V.kesitK);
    if(q.t < en.t) en = { t: q.t, k: q.k, i: aday[c][1] };
  }
  if(en.i < 0) return null;
  return { i: en.i, k: en.k, t: en.t, p: [o.x + en.t * d.x, o.y + en.t * d.y, o.z + en.t * d.z] };
}
// YÜZEY süzgeci: fare altı (önden seçim) ve tık
function _mw3bYuzFare(e){
  var V = _mw3b;
  V.fareSon = e;
  if(V.fareIstek) return;
  V.fareIstek = requestAnimationFrame(function(){
    V.fareIstek = 0;
    if(_mw3b !== V || V.suzgec !== 'yuz' || V.olcu) return;
    var ev = V.fareSon, h = _mw3bIsinK(ev.clientX, ev.clientY), b = h ? veMntWiz3bYuzBilgi(V.s, h.i, h.k) : null;
    var ayni = b && V.yuzOn ? b.parca === V.yuzOn.parca && b.f === V.yuzOn.f : !b && !V.yuzOn;
    if(!ayni){ _mw3bYuzOn(b); _mw3bCiz(true); }
    _mw3bIpucuYaz(ev, b ? veMntWiz3bYuzYazi(b) : '');
  });
}
function _mw3bYuzTik(e){
  var V = _mw3b, h = _mw3bIsinK(e.clientX, e.clientY);
  _mw3bYuzSec(h ? veMntWiz3bYuzBilgi(V.s, h.i, h.k) : null);
  _mw3bPanel(); _mw3bCiz(true);
  return true;
}
function _mw3bYuzSec(b){
  var V = _mw3b;
  V.yuzSec = b || null;
  V.yuzG = _mw3bYuzCiz(V.yuzG, V.yuzSec, VE_MW_3B_YUZ_VURGU.secili, 5);
}
function _mw3bYuzOn(b){
  var V = _mw3b;
  V.yuzOn = b && !(V.yuzSec && V.yuzSec.parca === b.parca && V.yuzSec.f === b.f) ? b : null;
  V.yuzOnG = _mw3bYuzCiz(V.yuzOnG, V.yuzOn, VE_MW_3B_YUZ_VURGU.fare, 4);
}
// Yüzün vurgusu: yüzün üçgenleri vurgu tonunda, yüzeyin önünde; kesitle kırpılır.
// Eski nesne bırakılır, yenisi döner (yüz yoksa null)
function _mw3bYuzCiz(eski, b, opak, sira){
  var V = _mw3b;
  if(eski){ V.scene.remove(eski); eski.geometry.dispose(); eski.material.dispose(); }
  var a = b && V.s.ag[b.parca];
  if(!a || !a.ucgen) return null;
  var T = a.ucgen, u = a.uc, n = b.aralik[1] - b.aralik[0], poz = new Float32Array(n * 9);
  for(var t = 0; t < n; t++) for(var j = 0; j < 3; j++){
    var v = T[(b.aralik[0] + t) * 3 + j] * 3;
    poz[t * 9 + j * 3] = u[v]; poz[t * 9 + j * 3 + 1] = u[v + 1]; poz[t * 9 + j * 3 + 2] = u[v + 2];
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  var m = new THREE.MeshBasicMaterial({ color: _mw3bRenk('--accent-primary', '#a8502b'), transparent: true, opacity: opak,
    side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  if(V.kesitK && V.kesitDizi) m.clippingPlanes = V.kesitDizi;
  var o = new THREE.Mesh(g, m);
  o.renderOrder = sira; o.frustumCulled = false;
  V.scene.add(o);
  return o;
}
// ÖLÇÜ: aday — dairenin merkezi · yüzün köşesi · yüzeyde nokta: { p, tur, r?, n?, anahtar } | null
function _mw3bOlcuAday(cx, cy){
  var V = _mw3b, dA = _mw3bDaireAra(cx, cy);
  if(dA) return { p: dA.daire.c.slice(), tur: 'daire', r: dA.daire.r, n: dA.daire.n.slice(), anahtar: 'd' + dA.parca + ':' + dA.kenar };
  var h = _mw3bIsinK(cx, cy);
  if(!h) return null;
  var R = V.renderer.domElement.getBoundingClientRect(), mx = cx - R.left, my = cy - R.top, en = null;
  var PM = new THREE.Matrix4().multiplyMatrices(V.camera.projectionMatrix, V.camera.matrixWorldInverse).elements;
  _mw3bYuzKoseleri(h.i, h.k).forEach(function(q, j){
    if(!veMntWiz3bKesitKalir(V.kesitK, q[0], q[1], q[2])) return;
    var sc = _mw3bEkran(PM, q[0], q[1], q[2], R.width || 1, R.height || 1);
    if(!sc) return;
    var dd = Math.sqrt((sc[0] - mx) * (sc[0] - mx) + (sc[1] - my) * (sc[1] - my));
    if(dd <= VE_MW_3B_OLCU.kose && (!en || dd < en.dd)) en = { dd: dd, p: q, j: j };
  });
  if(en) return { p: en.p.slice(), tur: 'kose', anahtar: 'k' + h.i + ':' + en.p.join(',') };
  return { p: h.p, tur: 'yuz', anahtar: 'y' };
}
// Tıklanan yüzün köşeleri (parça · yüz başına bir kez okunur)
function _mw3bYuzKoseleri(pi, k){
  var V = _mw3b, a = V.s.ag[pi], g = V.s.sonuc._geo && V.s.sonuc._geo[pi];
  if(!a || !a.yuzUcgen || !g || !g.yuzler) return [];
  var f = veMntWiz3bYuzSira(a.yuzUcgen, Math.floor(k / 3));
  if(f < 0 || !g.yuzler[f]) return [];
  var C = V.koseler || (V.koseler = {}), key = pi + ':' + f;
  if(!C[key]) C[key] = veMntWiz3bYuzKoseler(V.s.sonuc._model, g.yuzler[f], g.M, g.birim);
  return C[key];
}
function _mw3bOlcuTik(e){
  var V = _mw3b, O = V.olcu, c = _mw3bOlcuAday(e.clientX, e.clientY);
  if(!c) return false;
  if(!O.a || O.b){ O.a = c; O.b = null; } else O.b = c;
  O.aday = null;
  _mw3bIpucu(null);
  _mw3bPanel(); _mw3bEtiketle();
  return true;
}
function _mw3bOlcuFare(e){
  var V = _mw3b;
  V.fareSon = e;
  if(V.fareIstek) return;
  V.fareIstek = requestAnimationFrame(function(){
    V.fareIstek = 0;
    if(_mw3b !== V || !V.olcu) return;
    var ev = V.fareSon, c = _mw3bOlcuAday(ev.clientX, ev.clientY), o = V.olcu.aday;
    if((c ? c.anahtar : '') !== (o ? o.anahtar : '') || (c && c.tur === 'yuz')){ V.olcu.aday = c; _mw3bEtiketle(); }
    _mw3bIpucuYaz(ev, c && c.tur !== 'yuz' ? VE_MW_3B_OLCU_AD[c.tur] + (c.tur === 'daire' ? ' · Ø ' + _mw3bSay(2 * c.r, 1) + ' mm' : '') : '');
  });
}
// Ölçünün çizimi (SVG, her karede izdüşümden; saf olmayan — kameradan): iki
// nokta, aralarında çizgi, ortada zeminli uzaklık yazısı; yapışan aday: dairede
// çemberin izdüşümü + merkezin artısı, köşede kare
function _mw3bAracSVG(){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null, O = V && V.olcu;
  if(!O || !V.camera) return '';
  var w = V.kap.clientWidth || 1, h = V.kap.clientHeight || 1, f = _mw3bYuvarla;
  V.camera.updateMatrixWorld();
  var PM = new THREE.Matrix4().multiplyMatrices(V.camera.projectionMatrix, V.camera.matrixWorldInverse).elements;
  var P = function(p){ return p ? _mw3bEkran(PM, p[0], p[1], p[2], w, h) : null; };
  var A = O.a ? P(O.a.p) : null, B = O.b ? P(O.b.p) : null, C = O.aday && O.aday.tur !== 'yuz' ? O.aday : null, s = '';
  if(C){
    var q = P(C.p);
    if(C.tur === 'daire'){
      var n = C.n, t = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      var u = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]], ul = Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
      u = [u[0] / ul, u[1] / ul, u[2] / ul];
      var v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]], pts = [];
      for(var i = 0; i <= 48; i++){
        var a = i / 48 * 2 * Math.PI, ca = Math.cos(a) * C.r, sa = Math.sin(a) * C.r;
        var sc = P([C.p[0] + ca * u[0] + sa * v[0], C.p[1] + ca * u[1] + sa * v[1], C.p[2] + ca * u[2] + sa * v[2]]);
        if(sc) pts.push(f(sc[0]) + ',' + f(sc[1]));
      }
      if(pts.length > 2) s += '<polyline class="ve-mw-3b-olcu-ah" points="' + pts.join(' ') + '"/><polyline class="ve-mw-3b-olcu-a" points="' + pts.join(' ') + '"/>';
      if(q) s += '<path class="ve-mw-3b-olcu-ah" d="M' + f(q[0] - 6) + ' ' + f(q[1]) + 'h12M' + f(q[0]) + ' ' + f(q[1] - 6) + 'v12"/>'
        + '<path class="ve-mw-3b-olcu-a" d="M' + f(q[0] - 6) + ' ' + f(q[1]) + 'h12M' + f(q[0]) + ' ' + f(q[1] - 6) + 'v12"/>';
    } else if(q) s += '<rect class="ve-mw-3b-olcu-ah" x="' + f(q[0] - 5) + '" y="' + f(q[1] - 5) + '" width="10" height="10"/>'
      + '<rect class="ve-mw-3b-olcu-a" x="' + f(q[0] - 5) + '" y="' + f(q[1] - 5) + '" width="10" height="10"/>';
  }
  if(A && B) s += '<line class="ve-mw-3b-olcu-ch" x1="' + f(A[0]) + '" y1="' + f(A[1]) + '" x2="' + f(B[0]) + '" y2="' + f(B[1]) + '"/>'
    + '<line class="ve-mw-3b-olcu-c" x1="' + f(A[0]) + '" y1="' + f(A[1]) + '" x2="' + f(B[0]) + '" y2="' + f(B[1]) + '"/>';
  [A, B].forEach(function(q2, i2){
    if(q2) s += '<circle class="ve-mw-3b-olcu-n" data-ve-3b-olcu-n="' + (i2 + 1) + '" cx="' + f(q2[0]) + '" cy="' + f(q2[1]) + '" r="4"/>';
  });
  if(A && B){
    var M = veMntWiz3bOlcuDeger(O.a.p, O.b.p), yazi = _mw3bSay(M.d, 1) + ' mm', gen = yazi.length * VE_MW_3B_ETK.harf + 12;
    var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    s += '<g class="ve-mw-3b-olcu-y" data-ve-3b-olcu-yazi="1"><rect x="' + f(mx - gen / 2) + '" y="' + f(my - 10) + '" width="' + f(gen)
      + '" height="20" rx="4"/><text x="' + f(mx) + '" y="' + f(my) + '" text-anchor="middle" dominant-baseline="central">' + yazi + '</text></g>';
  }
  return s;
}
// Kartın araç bölümlerinin verisi
function _mw3bAracKartVeri(){
  var V = _mw3b, y = V.yuzSec, p = y && V.s.sonuc.parcalar[y.parca];
  return { olcu: V.olcu, suzgec: V.suzgec, yuz: y, parcaAd: p ? p.ad : '' };
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    VE_MW_3B_BAKIS: VE_MW_3B_BAKIS, veMntWiz3bBakisBul: veMntWiz3bBakisBul, veMntWiz3bKesitDuzlem: veMntWiz3bKesitDuzlem,
    veMntWiz3bKesitKalir: veMntWiz3bKesitKalir, veMntWiz3bKesitAralik: veMntWiz3bKesitAralik, veMntWiz3bAracHTML: veMntWiz3bAracHTML,
    veMntWiz3bKesitYazi: veMntWiz3bKesitYazi, veMntWiz3bYuzSira: veMntWiz3bYuzSira, veMntWiz3bYuzAlan: veMntWiz3bYuzAlan,
    veMntWiz3bYuzKoseler: veMntWiz3bYuzKoseler, veMntWiz3bYuzBilgi: veMntWiz3bYuzBilgi, veMntWiz3bYuzYazi: veMntWiz3bYuzYazi,
    veMntWiz3bYuzSatirlar: veMntWiz3bYuzSatirlar, veMntWiz3bOlcuDeger: veMntWiz3bOlcuDeger, veMntWiz3bAracKartHTML: veMntWiz3bAracKartHTML
  };
}
