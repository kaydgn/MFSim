// ============================================================================
//  STEP YÜZ ÜÇGENLEYİCİSİ — DOM'suz, saf JS · YALNIZ GÖRÜNTÜ İÇİN
// ============================================================================
// js/step-p21.js'in okuduğu B-rep yüzlerini (ADVANCED_FACE) üçgene çevirir.
// 3B görüntüleyici parçaları bununla çizer ve fareyle seçer.
//
// ── ÖLÇÜM BURADAN ALINMAZ ─────────────────────────────────────────────────
// Kasnak çapı, merkez ve kayış düzlemi js/fead-step.js'te dosyanın ANALİTİK
// sayılarından okunur (CYLINDRICAL_SURFACE'in yarıçapı dosyada yazılı). Üçgen
// bir yaklaşıklıktır (kiriş payı `kiris`); bir ölçüyü ondan geri çıkarmak,
// okuyucunun OCCT'yi bırakma gerekçesini geri getirmek olurdu.
//
// ── YÖNTEM ─────────────────────────────────────────────────────────────────
// 1. KENAR: her EDGE_CURVE bir kez örneklenir (kiriş payı + açı adımı) ve iki
//    komşu yüz AYNI noktaları kullanır — yüzler arasında çatlak kalmaz.
//    Yay, köşeleri arasında `same_sense`in söylediği yönden taranır.
// 2. DÖNGÜ: kenar noktaları yüzeyin parametre uzayına (u, v) ters çevrilir,
//    periyodik yön süreklilikle açılır. Kutup (küre ucu, koni tepesi) bir
//    çizgiye açılır; 2π saran döngü (bant) bir dikişle kesilir.
// 3. ÜÇGEN: parametre uzayında kulak kırpma (delikler köprüyle dış döngüye
//    bağlanır), sonra kiriş payını aşan İÇ kenarlar bölünür. Sınır kenarı
//    bölünmez: komşu yüzle ortak noktalar bozulmasın.
// 4. YÖN: normal yüzeyin analitik normalidir (ADVANCED_FACE same_sense ile);
//    üçgenin sarımı o normale uyar — çift yüzlü malzeme ışığı buna göre çevirir.
//
// Çözülemeyen yüz SESSİZCE düşmez: kenarları yine çizilir, sayacı
// `kenarYuz`da ve sebebi `nedenler`de durur.
// ============================================================================

var VE_STEP_UCGEN_SURUM = '1.0.0';
// kiris: üçgenin yüzeyden en çok uzaklaşması (mm). aci: kenar örneklemesinde
// bir parçanın taradığı en büyük açı (derece) — küçük yarıçaplı yaylar da
// yuvarlak görünsün. enCokUc: tek yüzde inceltmenin tavanı.
var VE_STEP_UCGEN_VARSAYILAN = { kiris: 0.1, aci: 15, enCokUc: 40000 };

function _suOkuyucu(){
  if(typeof veStepP21Varlik === 'function')
    return { Varlik: veStepP21Varlik, Tip: veStepP21Tip, Parca: veStepP21Parca, Cerceve: veStepP21Cerceve };
  if(typeof require === 'function'){
    try {
      var m = require('./step-p21.js');
      return { Varlik: m.veStepP21Varlik, Tip: m.veStepP21Tip, Parca: m.veStepP21Parca, Cerceve: m.veStepP21Cerceve };
    } catch(e){ return null; }
  }
  return null;
}

// ── 1 · VEKTÖR ────────────────────────────────────────────────────────────
function _suC(a, b){ return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function _suN(a, b){ return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function _suV(a, b){ return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function _suU(a){ return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
function _suB(a){ var L = _suU(a); return L > 0 ? [a[0] / L, a[1] / L, a[2] / L] : [0, 0, 1]; }
function _suM(a, b){ var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); }
function _suOrta(a, b){ return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }
function _suDik(z){                                  // z'ye dik birim vektör
  var x = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  var d = _suN(x, z);
  return _suB([x[0] - d * z[0], x[1] - d * z[1], x[2] - d * z[2]]);
}

// ── 2 · BAĞLAM ─────────────────────────────────────────────────────────────
// Aynı modelin bütün parçaları tek bağlamı paylaşır: aynı parçanın iki örneği
// (aynı yüz kimlikleri, iki dünya dönüşümü) yüzlerini bir kez üçgenler.
function veStepUcgenBaglam(model, secenek){
  var o = secenek || {}, V = VE_STEP_UCGEN_VARSAYILAN;
  return {
    model: model, P: _suOkuyucu(),
    kiris: o.kiris > 0 ? o.kiris : V.kiris,
    aci: (o.aci > 0 ? o.aci : V.aci) * Math.PI / 180,
    enCokUc: o.enCokUc > 0 ? o.enCokUc : V.enCokUc,
    egri: {}, kenar: {}, yuzey: {}, yuz: {},
    sayac: { yuz: 0, ucgenli: 0, kenarYuz: 0, ucgen: 0, zorla: 0, fermuar: 0, nedenler: {} }
  };
}

function _suNokta(B, id, k){
  var a = B.P.Varlik(B.model, id).a[1];
  return [a[0] * k, a[1] * k, (a.length > 2 ? a[2] : 0) * k];
}
function _suYon(B, id){ return _suB(B.P.Varlik(B.model, id).a[1]); }
function _suTepe(B, id, k){ return _suNokta(B, B.P.Varlik(B.model, id).a[1].ref, k); }
function _suBayrak(x){ return !(x && x.e === 'F'); }
function _suRefler(a){
  var out = [];
  (Array.isArray(a) ? a : []).forEach(function(x){ if(x && x.ref) out.push(x.ref); });
  return out;
}

// ── 3 · TEK BOYUTLU EN KÜÇÜK ─────────────────────────────────────────────
// [t0, t1]'de f'nin en küçüğü: N parçalı tarama + altın oran daraltması.
function _suMin1(f, t0, t1, N){
  var enI = 0, enF = Infinity, i;
  for(i = 0; i <= N; i++){
    var fi = f(t0 + (t1 - t0) * i / N);
    if(fi < enF){ enF = fi; enI = i; }
  }
  var a = t0 + (t1 - t0) * Math.max(0, enI - 1) / N, b = t0 + (t1 - t0) * Math.min(N, enI + 1) / N;
  var g = 0.3819660112501051, x1 = a + g * (b - a), x2 = b - g * (b - a), f1 = f(x1), f2 = f(x2);
  for(i = 0; i < 48; i++){
    if(f1 < f2){ b = x2; x2 = x1; f2 = f1; x1 = a + g * (b - a); f1 = f(x1); }
    else { a = x1; x1 = x2; f1 = f2; x2 = b - g * (b - a); f2 = f(x2); }
  }
  var t = (a + b) / 2;
  return f(t) <= enF ? t : t0 + (t1 - t0) * enI / N;
}

// ── 4 · B-SPLINE ───────────────────────────────────────────────────────────
function _suDugum(katlilik, dugum){
  var U = [];
  for(var i = 0; i < dugum.length; i++) for(var j = 0; j < katlilik[i]; j++) U.push(dugum[i]);
  return U;
}
// U[s] <= t < U[s+1] olan s (der <= s <= n-1); n = kontrol noktası sayısı
function _suAralik(U, der, n, t){
  if(t >= U[n]){ var s = n - 1; while(s > der && !(U[s] < U[s + 1])) s--; return s; }
  if(t <= U[der]) return der;
  var lo = der, hi = n;
  while(hi - lo > 1){ var m = (lo + hi) >> 1; if(t < U[m]) hi = m; else lo = m; }
  return lo;
}
// Taban fonksiyonları (The NURBS Book, A2.2)
function _suTaban(U, der, s, t, N, sol, sag){
  N[0] = 1;
  for(var j = 1; j <= der; j++){
    sol[j] = t - U[s + 1 - j]; sag[j] = U[s + j] - t;
    var kayit = 0;
    for(var r = 0; r < j; r++){
      var pay = sag[r + 1] + sol[j - r];
      var tmp = pay !== 0 ? N[r] / pay : 0;
      N[r] = kayit + sag[r + 1] * tmp;
      kayit = sol[j - r] * tmp;
    }
    N[j] = kayit;
  }
}
function _suAralikSay(U, a, b){
  var n = 0;
  for(var i = 0; i + 1 < U.length; i++) if(U[i] < U[i + 1] && U[i] >= a && U[i + 1] <= b) n++;
  return Math.max(1, n);
}

// ── 5 · EĞRİ ───────────────────────────────────────────────────────────────
// { tip, P(t), t0, t1, per (0 = açık), ters(p) → t, r (yay yarıçapı) }
function _suEgri(B, id, k){
  var key = id + '@' + k;
  if(key in B.egri) return B.egri[key];
  var e = null;
  try { e = _suEgriKur(B, id, k); } catch(x){ e = null; }
  B.egri[key] = e;
  return e;
}
function _suEgriKur(B, id, k){
  var P = B.P, m = B.model, t = P.Tip(m, id), a;
  if(t === 'SURFACE_CURVE' || t === 'SEAM_CURVE' || t === 'INTERSECTION_CURVE' || t === 'BOUNDED_SURFACE_CURVE'
     || t === 'TRIMMED_CURVE'){
    a = P.Varlik(m, id).a;
    return a[1] && a[1].ref ? _suEgri(B, a[1].ref, k) : null;
  }
  if(t === 'LINE'){
    a = P.Varlik(m, id).a;                              // LINE(ad, nokta, VECTOR)
    var p0 = _suNokta(B, a[1].ref, k);
    var d = _suYon(B, P.Varlik(m, a[2].ref).a[1].ref);
    // Aralık sonlu (±100 m): süpürme ve dönel yüzeyin ters çevirmesi onu tarar
    return { tip: 'LINE', per: 0, t0: -1e5, t1: 1e5,
      P: function(s){ return [p0[0] + d[0] * s, p0[1] + d[1] * s, p0[2] + d[2] * s]; },
      ters: function(p){ return (p[0] - p0[0]) * d[0] + (p[1] - p0[1]) * d[1] + (p[2] - p0[2]) * d[2]; } };
  }
  if(t === 'CIRCLE' || t === 'ELLIPSE'){
    a = P.Varlik(m, id).a;                              // CIRCLE(ad, yerleşim, r) · ELLIPSE(ad, yerleşim, a, b)
    var f = P.Cerceve(m, a[1].ref, k);
    var ra = a[2] * k, rb = (t === 'ELLIPSE' ? a[3] : a[2]) * k;
    return { tip: t, per: 2 * Math.PI, t0: 0, t1: 2 * Math.PI, r: Math.max(ra, rb),
      P: function(u){
        var c = Math.cos(u) * ra, s = Math.sin(u) * rb;
        return [f.o[0] + c * f.x[0] + s * f.y[0], f.o[1] + c * f.x[1] + s * f.y[1], f.o[2] + c * f.x[2] + s * f.y[2]]; },
      ters: function(p){
        var q = _suC(p, f.o);
        return Math.atan2(_suN(q, f.y) / rb, _suN(q, f.x) / ra); } };
  }
  if(t === 'B_SPLINE_CURVE_WITH_KNOTS' || t === 'COMPLEX') return _suBsEgri(B, id, k, t);
  if(t === 'POLYLINE'){
    a = P.Varlik(m, id).a;
    var nk = _suRefler(a[1]).map(function(r){ return _suNokta(B, r, k); });
    if(nk.length < 2) return null;
    var pe = { tip: 'POLYLINE', per: 0, t0: 0, t1: nk.length - 1, aralik: nk.length - 1,
      P: function(s){
        var i = Math.max(0, Math.min(nk.length - 2, Math.floor(s))), f2 = s - i;
        return [nk[i][0] + (nk[i + 1][0] - nk[i][0]) * f2, nk[i][1] + (nk[i + 1][1] - nk[i][1]) * f2, nk[i][2] + (nk[i + 1][2] - nk[i][2]) * f2]; } };
    pe.ters = function(p){ return _suMin1(function(s){ return _suM(pe.P(s), p); }, pe.t0, pe.t1, 8 * pe.aralik); };
    return pe;
  }
  return null;
}
function _suBsEgri(B, id, k, t){
  var P = B.P, m = B.model, der, cps, kat, dug, w = null;
  if(t === 'B_SPLINE_CURVE_WITH_KNOTS'){
    var a = P.Varlik(m, id).a;          // (ad, derece, noktalar, biçim, kapalı, kesişim, katlılık, düğümler, tür)
    der = a[1]; cps = a[2]; kat = a[6]; dug = a[7];
  } else {
    var bc = P.Parca(m, id, 'B_SPLINE_CURVE'), bk = P.Parca(m, id, 'B_SPLINE_CURVE_WITH_KNOTS');
    if(!bc || !bk) return null;
    var rb = P.Parca(m, id, 'RATIONAL_B_SPLINE_CURVE');
    der = bc.a[0]; cps = bc.a[1]; kat = bk.a[0]; dug = bk.a[1]; w = rb ? rb.a[0] : null;
  }
  var U = _suDugum(kat, dug), n = cps.length;
  if(!(der >= 1) || U.length !== n + der + 1) return null;
  var H = new Float64Array(n * 4);
  for(var i = 0; i < n; i++){
    var p = _suNokta(B, cps[i].ref, k), wi = w ? w[i] : 1;
    H[i * 4] = p[0] * wi; H[i * 4 + 1] = p[1] * wi; H[i * 4 + 2] = p[2] * wi; H[i * 4 + 3] = wi;
  }
  var d = new Float64Array((der + 1) * 4);
  var e = { tip: 'BSPLINE', per: 0, t0: U[der], t1: U[n], der: der, aralik: _suAralikSay(U, U[der], U[n]),
    P: function(s){
      var sp = _suAralik(U, der, n, s), j, r, c;
      for(j = 0; j <= der; j++){ var q = (sp - der + j) * 4; for(c = 0; c < 4; c++) d[j * 4 + c] = H[q + c]; }
      for(r = 1; r <= der; r++){
        for(j = der; j >= r; j--){
          var ii = sp - der + j, pay = U[ii + der - r + 1] - U[ii], al = pay > 0 ? (s - U[ii]) / pay : 0;
          for(c = 0; c < 4; c++) d[j * 4 + c] = (1 - al) * d[(j - 1) * 4 + c] + al * d[j * 4 + c];
        }
      }
      var ww = d[der * 4 + 3];
      return [d[der * 4] / ww, d[der * 4 + 1] / ww, d[der * 4 + 2] / ww]; } };
  e.ters = function(p){ return _suMin1(function(s){ return _suM(e.P(s), p); }, e.t0, e.t1, Math.min(400, 8 * e.aralik + 16)); };
  if(_suM(e.P(e.t0), e.P(e.t1)) < 1e-9) e.per = e.t1 - e.t0;
  return e;
}

// ── 6 · KENAR ─────────────────────────────────────────────────────────────
// EDGE_CURVE'ün başlangıç köşesinden bitiş köşesine yerel mm noktaları.
// Uçlar köşenin KENDİSİDİR: aynı köşeye bağlanan kenarlar birebir buluşur.
function _suKenar(B, id, k){
  var key = id + '@' + k;
  var c = B.kenar[key];
  if(c) return c;
  var a = B.P.Varlik(B.model, id).a;                   // EDGE_CURVE(ad, başlangıç, bitiş, eğri, aynı_yön)
  var p1 = _suTepe(B, a[1].ref, k), p2 = _suTepe(B, a[2].ref, k);
  var e = a[3] && a[3].ref ? _suEgri(B, a[3].ref, k) : null;
  c = _suKenarOrnek(B, e, p1, p2, _suBayrak(a[4]), a[1].ref === a[2].ref);
  B.kenar[key] = c;
  return c;
}
function _suAciAdim(B, r){
  var kiris = r > B.kiris ? 2 * Math.acos(1 - B.kiris / r) : Math.PI;
  return Math.max(1e-3, Math.min(B.aci, kiris));
}
function _suKenarOrnek(B, e, p1, p2, ayni, kapali){
  if(!e || e.tip === 'LINE') return [p1, p2];
  var out = [p1], i, t1, t2, d;
  if(e.tip === 'CIRCLE' || e.tip === 'ELLIPSE'){
    t1 = e.ters(p1); t2 = kapali ? t1 : e.ters(p2);
    d = t2 - t1;
    var T = 2 * Math.PI;
    if(ayni){ while(d <= 1e-12) d += T; while(d > T + 1e-12) d -= T; }
    else { while(d >= -1e-12) d -= T; while(d < -T - 1e-12) d += T; }
    var n = Math.max(1, Math.ceil(Math.abs(d) / _suAciAdim(B, e.r)));
    for(i = 1; i < n; i++) out.push(e.P(t1 + d * i / n));
    out.push(kapali ? p1 : p2);
    return out;
  }
  // B-spline ve çoklu çizgi: köşelerin parametresi (uç ise doğrudan)
  function uc(p){
    if(_suM(e.P(e.t0), p) < 1e-6) return e.t0;
    if(_suM(e.P(e.t1), p) < 1e-6) return e.t1;
    return e.ters(p);
  }
  t1 = uc(p1);
  if(kapali) t2 = e.per ? t1 + (ayni ? e.per : -e.per) : (ayni ? e.t1 : e.t0);
  else {
    t2 = uc(p2);
    if(e.per){
      if(ayni && t2 <= t1) t2 += e.per;
      if(!ayni && t2 >= t1) t2 -= e.per;
    }
  }
  var ts = _suEgriOrnek(B, e, t1, t2);
  for(i = 1; i < ts.length - 1; i++) out.push(e.P(_suSar(e, ts[i])));
  out.push(kapali ? p1 : p2);
  return out;
}
function _suSar(e, t){
  if(!e.per) return t;
  var s = (t - e.t0) % e.per;
  if(s < 0) s += e.per;
  return e.t0 + s;
}
// Uyarlamalı örnekleme: düğüm aralığı × derece bölme, sonra kiriş payını aşan
// parça ikiye bölünür.
function _suEgriOrnek(B, e, a, b){
  var oran = Math.abs(b - a) / Math.max(1e-12, e.t1 - e.t0);
  var n0 = Math.max(4, Math.min(512, Math.ceil((e.aralik || 1) * Math.max(2, e.der || 2) * Math.min(1, oran + 1e-9))));
  var out = [a], pa = e.P(_suSar(e, a));
  for(var i = 1; i <= n0; i++){
    var tb = a + (b - a) * i / n0, pb = e.P(_suSar(e, tb));
    _suBol(e, a + (b - a) * (i - 1) / n0, pa, tb, pb, out, B.kiris, 0);
    pa = pb;
  }
  return out;
}
function _suBol(e, ta, pa, tb, pb, out, tol, derin){
  var tm = (ta + tb) / 2, pm = e.P(_suSar(e, tm));
  if(derin < 12 && _suM(pm, _suOrta(pa, pb)) > tol){
    _suBol(e, ta, pa, tm, pm, out, tol, derin + 1);
    _suBol(e, tm, pm, tb, pb, out, tol, derin + 1);
  } else out.push(tb);
}

// ── 7 · YÜZEY ─────────────────────────────────────────────────────────────
// { tip, P(u,v), N(u,v) (doğal yön = ∂u × ∂v, birim), ters(p, ipucu) → [u, v, tekil],
//   perU, perV, kutup: [v] (P'nin u'dan bağımsız olduğu çizgiler), olcek(u,v) → [su, sv], duz }
function _suYuzey(B, id, k, dk){
  var key = id + '@' + k;
  if(key in B.yuzey) return B.yuzey[key];
  var s = null;
  try { s = _suYuzeyKur(B, id, k, dk); } catch(x){ s = null; }
  B.yuzey[key] = s;
  return s;
}
// Kutup payı: CATIA kutup köşesini eksenden 1,6·10⁻⁴ mm'ye kadar uzağa yazıyor
// (ölçüldü); 10⁻⁹ eşiği o noktaya rastgele bir u verip sahte bir sarım üretiyordu.
var VE_STEP_UCGEN_KUTUP = 1e-3;
function _suYuzeyKur(B, id, k, dk){
  var P = B.P, m = B.model, t = P.Tip(m, id), a, f;
  var TEK = VE_STEP_UCGEN_KUTUP;
  if(t === 'PLANE'){
    f = P.Cerceve(m, P.Varlik(m, id).a[1].ref, k);
    return { tip: t, duz: true, perU: 0, perV: 0, kutup: [],
      P: function(u, v){ return [f.o[0] + u * f.x[0] + v * f.y[0], f.o[1] + u * f.x[1] + v * f.y[1], f.o[2] + u * f.x[2] + v * f.y[2]]; },
      N: function(){ return f.z; },
      ters: function(p){ var q = _suC(p, f.o); return [_suN(q, f.x), _suN(q, f.y), false]; },
      olcek: function(){ return [1, 1]; } };
  }
  if(t === 'CYLINDRICAL_SURFACE' || t === 'CONICAL_SURFACE' || t === 'SPHERICAL_SURFACE'
     || t === 'TOROIDAL_SURFACE' || t === 'DEGENERATE_TOROIDAL_SURFACE'){
    a = P.Varlik(m, id).a;
    f = P.Cerceve(m, a[1].ref, k);
    var o = f.o, X = f.x, Y = f.y, Z = f.z;
    var er = function(u){ var c = Math.cos(u), s = Math.sin(u); return [c * X[0] + s * Y[0], c * X[1] + s * Y[1], c * X[2] + s * Y[2]]; };
    var yerel = function(p){ var q = _suC(p, o); return [_suN(q, X), _suN(q, Y), _suN(q, Z)]; };
    var nokta = function(u, rho, h){ var e = er(u); return [o[0] + rho * e[0] + h * Z[0], o[1] + rho * e[1] + h * Z[1], o[2] + rho * e[2] + h * Z[2]]; };
    if(t === 'CYLINDRICAL_SURFACE'){
      var r = a[2] * k;
      return { tip: t, perU: 2 * Math.PI, perV: 0, kutup: [],
        P: function(u, v){ return nokta(u, r, v); },
        N: function(u){ return er(u); },
        ters: function(p){ var q = yerel(p); return [Math.atan2(q[1], q[0]), q[2], false]; },
        olcek: function(){ return [r, 1]; },
        egrilik: function(){ return [1 / r, 0]; } };
    }
    if(t === 'CONICAL_SURFACE'){
      var r0 = a[2] * k, al = a[3] * dk * Math.PI / 180, ta = Math.tan(al), ca = Math.cos(al), sa = Math.sin(al);
      var tepe = Math.abs(ta) > 1e-12 ? -r0 / ta : null;
      return { tip: t, perU: 2 * Math.PI, perV: 0, kutup: tepe === null ? [] : [tepe],
        P: function(u, v){ return nokta(u, r0 + v * ta, v); },
        N: function(u){ var e = er(u); return [ca * e[0] - sa * Z[0], ca * e[1] - sa * Z[1], ca * e[2] - sa * Z[2]]; },
        ters: function(p){
          var q = yerel(p), rho = Math.sqrt(q[0] * q[0] + q[1] * q[1]);
          var v = ((rho - r0) * sa + q[2] * ca) * ca;
          return [Math.atan2(q[1], q[0]), v, rho < TEK]; },
        olcek: function(u, v){ return [Math.max(1e-3, Math.abs(r0 + v * ta)), 1 / Math.max(1e-6, ca)]; },
        egrilik: function(u, v){ return [Math.abs(ca) / Math.max(1e-3, Math.abs(r0 + v * ta)), 0]; } };
    }
    if(t === 'SPHERICAL_SURFACE'){
      var R = a[2] * k;
      return { tip: t, perU: 2 * Math.PI, perV: 0, kutup: [-Math.PI / 2, Math.PI / 2],
        P: function(u, v){ return nokta(u, R * Math.cos(v), R * Math.sin(v)); },
        N: function(u, v){ var e = er(u), c = Math.cos(v), s = Math.sin(v); return [c * e[0] + s * Z[0], c * e[1] + s * Z[1], c * e[2] + s * Z[2]]; },
        ters: function(p){
          var q = yerel(p), rho = Math.sqrt(q[0] * q[0] + q[1] * q[1]);
          return [Math.atan2(q[1], q[0]), Math.atan2(q[2], rho), rho < TEK]; },
        olcek: function(u, v){ return [Math.max(1e-3 * R, R * Math.cos(v)), R]; },
        egrilik: function(){ return [1 / R, 1 / R]; } };
    }
    var RR = a[2] * k, rk = a[3] * k;                     // tor: büyük · küçük yarıçap
    return { tip: t, perU: 2 * Math.PI, perV: 2 * Math.PI, kutup: [],
      P: function(u, v){ return nokta(u, RR + rk * Math.cos(v), rk * Math.sin(v)); },
      N: function(u, v){ var e = er(u), c = Math.cos(v), s = Math.sin(v); return [c * e[0] + s * Z[0], c * e[1] + s * Z[1], c * e[2] + s * Z[2]]; },
      ters: function(p){
        var q = yerel(p), rho = Math.sqrt(q[0] * q[0] + q[1] * q[1]);
        return [Math.atan2(q[1], q[0]), Math.atan2(q[2], rho - RR), rho < TEK]; },
      olcek: function(u, v){ return [Math.max(1e-3, RR + rk * Math.cos(v)), rk]; },
      egrilik: function(u, v){ return [Math.abs(Math.cos(v)) / Math.max(1e-3, RR + rk * Math.cos(v)), 1 / rk]; } };
  }
  if(t === 'SURFACE_OF_REVOLUTION') return _suDonel(B, id, k);
  if(t === 'SURFACE_OF_LINEAR_EXTRUSION') return _suSupurme(B, id, k);
  if(t === 'B_SPLINE_SURFACE_WITH_KNOTS' || t === 'COMPLEX') return _suBsYuzey(B, id, k, t);
  return null;
}
// Sayısal türevden normal ve ölçek (dönel · süpürme · B-spline)
function _suSayisal(S, h){
  S.N = function(u, v){
    var pu = _suC(S.P(u + h[0], v), S.P(u - h[0], v)), pv = _suC(S.P(u, v + h[1]), S.P(u, v - h[1]));
    return _suB(_suV(pu, pv));
  };
  S.olcek = function(u, v){
    var su = _suM(S.P(u + h[0], v), S.P(u - h[0], v)) / (2 * h[0]);
    var sv = _suM(S.P(u, v + h[1]), S.P(u, v - h[1])) / (2 * h[1]);
    return [Math.max(1e-6, su), Math.max(1e-6, sv)];
  };
  return S;
}
// SURFACE_OF_REVOLUTION(ad, profil, AXIS1_PLACEMENT(ad, nokta, yön)): u açı, v profil parametresi
function _suDonel(B, id, k){
  var P = B.P, m = B.model, a = P.Varlik(m, id).a;
  var C = _suEgri(B, a[1].ref, k);
  if(!C) return null;
  var ax = P.Varlik(m, a[2].ref).a;
  var o = _suNokta(B, ax[1].ref, k), z = ax[2] && ax[2].ref ? _suYon(B, ax[2].ref) : [0, 0, 1];
  var x = _suDik(z), y = _suV(z, x);
  function dondur(q, u){                                  // z ekseni etrafında u kadar (Rodrigues)
    var c = Math.cos(u), s = Math.sin(u), zq = _suN(z, q), zx = _suV(z, q);
    return [q[0] * c + zx[0] * s + z[0] * zq * (1 - c), q[1] * c + zx[1] * s + z[1] * zq * (1 - c), q[2] * c + zx[2] * s + z[2] * zq * (1 - c)];
  }
  function profil(v){                                     // (h, ρ, φ0)
    var q = _suC(C.P(_suSar(C, v)), o), h = _suN(q, z);
    var w = [q[0] - h * z[0], q[1] - h * z[1], q[2] - h * z[2]];
    return [h, _suU(w), Math.atan2(_suN(w, y), _suN(w, x))];
  }
  var kutup = [];
  [C.t0, C.t1].forEach(function(v){ if(profil(v)[1] < VE_STEP_UCGEN_KUTUP) kutup.push(v); });
  var S = { tip: 'SURFACE_OF_REVOLUTION', perU: 2 * Math.PI, perV: C.per, kutup: C.per ? [] : kutup,
    P: function(u, v){ var q = dondur(_suC(C.P(_suSar(C, v)), o), u); return [o[0] + q[0], o[1] + q[1], o[2] + q[2]]; },
    ters: function(p){
      var q = _suC(p, o), h = _suN(q, z), w = [q[0] - h * z[0], q[1] - h * z[1], q[2] - h * z[2]], rho = _suU(w);
      var v = _suMin1(function(t){ var pr = profil(t); return (pr[0] - h) * (pr[0] - h) + (pr[1] - rho) * (pr[1] - rho); },
        C.t0, C.t1, Math.min(400, 8 * (C.aralik || 4) + 16));
      var phi = Math.atan2(_suN(w, y), _suN(w, x));
      return [phi - profil(v)[2], v, rho < VE_STEP_UCGEN_KUTUP]; } };
  return _suSayisal(S, [1e-5, 1e-6 * Math.max(1e-9, C.t1 - C.t0)]);
}
// SURFACE_OF_LINEAR_EXTRUSION(ad, eğri, VECTOR): u eğri parametresi, v mm (yön boyunca)
function _suSupurme(B, id, k){
  var P = B.P, m = B.model, a = P.Varlik(m, id).a;
  var C = _suEgri(B, a[1].ref, k);
  if(!C) return null;
  var d = _suYon(B, P.Varlik(m, a[2].ref).a[1].ref);
  var S = { tip: 'SURFACE_OF_LINEAR_EXTRUSION', perU: C.per, perV: 0, kutup: [],
    P: function(u, v){ var c = C.P(_suSar(C, u)); return [c[0] + v * d[0], c[1] + v * d[1], c[2] + v * d[2]]; },
    ters: function(p){
      var u = _suMin1(function(t){
        var q = _suC(p, C.P(t)), h = _suN(q, d);
        return _suN(q, q) - h * h; }, C.t0, C.t1, Math.min(400, 8 * (C.aralik || 4) + 16));
      return [u, _suN(_suC(p, C.P(u)), d), false]; } };
  return _suSayisal(S, [1e-6 * Math.max(1e-9, C.t1 - C.t0), 1e-4]);
}
// B_SPLINE_SURFACE_WITH_KNOTS · rasyonel karmaşık varlık
function _suBsYuzey(B, id, k, t){
  var P = B.P, m = B.model, du, dv, cps, kU, kV, dU, dV, W = null;
  if(t === 'B_SPLINE_SURFACE_WITH_KNOTS'){
    var a = P.Varlik(m, id).a;   // (ad, du, dv, noktalar, biçim, uKapalı, vKapalı, kesişim, uKat, vKat, uDüğüm, vDüğüm, tür)
    du = a[1]; dv = a[2]; cps = a[3]; kU = a[8]; kV = a[9]; dU = a[10]; dV = a[11];
  } else {
    var bs = P.Parca(m, id, 'B_SPLINE_SURFACE'), bk = P.Parca(m, id, 'B_SPLINE_SURFACE_WITH_KNOTS');
    if(!bs || !bk) return null;
    var rb = P.Parca(m, id, 'RATIONAL_B_SPLINE_SURFACE');
    du = bs.a[0]; dv = bs.a[1]; cps = bs.a[2]; kU = bk.a[0]; kV = bk.a[1]; dU = bk.a[2]; dV = bk.a[3];
    W = rb ? rb.a[0] : null;
  }
  var U = _suDugum(kU, dU), V = _suDugum(kV, dV), nu = cps.length, nv = cps[0].length;
  if(U.length !== nu + du + 1 || V.length !== nv + dv + 1) return null;
  var H = new Float64Array(nu * nv * 4);
  for(var i = 0; i < nu; i++) for(var j = 0; j < nv; j++){
    var p = _suNokta(B, cps[i][j].ref, k), w = W ? W[i][j] : 1, q = (i * nv + j) * 4;
    H[q] = p[0] * w; H[q + 1] = p[1] * w; H[q + 2] = p[2] * w; H[q + 3] = w;
  }
  var Nu = new Float64Array(du + 1), Nv = new Float64Array(dv + 1);
  var s1 = new Float64Array(Math.max(du, dv) + 2), s2 = new Float64Array(Math.max(du, dv) + 2);
  var u0 = U[du], u1 = U[nu], v0 = V[dv], v1 = V[nv];
  var S = { tip: 'B_SPLINE_SURFACE', perU: 0, perV: 0, kutup: [], u0: u0, u1: u1, v0: v0, v1: v1,
    P: function(u, v){
      // Kapalı yönde parametre SARAR (açılmış döngü u1'i aşabilir), açık yönde kırpılır
      u = S.perU ? u0 + (((u - u0) % S.perU) + S.perU) % S.perU : Math.max(u0, Math.min(u1, u));
      v = S.perV ? v0 + (((v - v0) % S.perV) + S.perV) % S.perV : Math.max(v0, Math.min(v1, v));
      var su = _suAralik(U, du, nu, u), sv = _suAralik(V, dv, nv, v);
      _suTaban(U, du, su, u, Nu, s1, s2);
      _suTaban(V, dv, sv, v, Nv, s1, s2);
      var x = 0, y = 0, z = 0, ww = 0;
      for(var a2 = 0; a2 <= du; a2++){
        var satir = (su - du + a2) * nv;
        for(var b2 = 0; b2 <= dv; b2++){
          var q2 = (satir + sv - dv + b2) * 4, c = Nu[a2] * Nv[b2];
          x += c * H[q2]; y += c * H[q2 + 1]; z += c * H[q2 + 2]; ww += c * H[q2 + 3];
        }
      }
      return [x / ww, y / ww, z / ww]; } };
  var hu = 1e-6 * Math.max(1e-9, u1 - u0), hv = 1e-6 * Math.max(1e-9, v1 - v0);
  _suSayisal(S, [hu, hv]);
  // Kapalı yön: iki kenar çakışıyorsa parametre periyodik sayılır
  var boy = _suM(S.P(u0, v0), S.P(u1, v1)) + _suM(S.P(u0, v1), S.P(u1, v0)) + 1e-9;
  var kapaliMi = function(f){ for(var i2 = 0; i2 <= 4; i2++) if(f(i2 / 4) > 1e-7 * boy) return false; return true; };
  if(kapaliMi(function(s){ var v2 = v0 + (v1 - v0) * s; return _suM(S.P(u0, v2), S.P(u1, v2)); })) S.perU = u1 - u0;
  if(kapaliMi(function(s){ var u2 = u0 + (u1 - u0) * s; return _suM(S.P(u2, v0), S.P(u2, v1)); })) S.perV = v1 - v0;
  // Ters çevirme: ipucu varsa oradan, yoksa ızgaradan Gauss–Newton. Izgara
  // DÜĞÜM ARALIĞI başına üç nokta: 40×40'lık sabit ızgara, u aralığı 351 olan
  // uzun bir yüzeyde ilk noktayı yanlış yerel en küçüğe indiriyordu (ölçüldü).
  var Gu = Math.min(240, Math.max(10, 3 * _suAralikSay(U, u0, u1))), Gv = Math.min(240, Math.max(10, 3 * _suAralikSay(V, v0, v1)));
  while(Gu * Gv > 12000){ if(Gu > Gv) Gu = Math.ceil(Gu * 0.8); else Gv = Math.ceil(Gv * 0.8); }
  var izgara = null;
  function izgaradan(p){
    if(!izgara){
      izgara = [];
      for(var a3 = 0; a3 <= Gu; a3++) for(var b3 = 0; b3 <= Gv; b3++){
        var uu = u0 + (u1 - u0) * a3 / Gu, vv = v0 + (v1 - v0) * b3 / Gv;
        izgara.push([uu, vv, S.P(uu, vv)]);
      }
    }
    var en = izgara[0], enD = Infinity;
    for(var i3 = 0; i3 < izgara.length; i3++){ var dd = _suM(izgara[i3][2], p); if(dd < enD){ enD = dd; en = izgara[i3]; } }
    return [en[0], en[1]];
  }
  function newton(p, uv){
    var u = uv[0], v = uv[1];
    for(var it = 0; it < 30; it++){
      var s0 = S.P(u, v), r = _suC(p, s0);
      var pu = _suC(S.P(u + hu * 100, v), S.P(u - hu * 100, v)), pv = _suC(S.P(u, v + hv * 100), S.P(u, v - hv * 100));
      pu = [pu[0] / (200 * hu), pu[1] / (200 * hu), pu[2] / (200 * hu)];
      pv = [pv[0] / (200 * hv), pv[1] / (200 * hv), pv[2] / (200 * hv)];
      var a11 = _suN(pu, pu), a12 = _suN(pu, pv), a22 = _suN(pv, pv), b1 = _suN(pu, r), b2 = _suN(pv, r);
      var det = a11 * a22 - a12 * a12;
      if(!(Math.abs(det) > 1e-300)) break;
      var dU2 = (b1 * a22 - b2 * a12) / det, dV2 = (a11 * b2 - a12 * b1) / det;
      u = Math.max(u0, Math.min(u1, u + dU2)); v = Math.max(v0, Math.min(v1, v + dV2));
      if(Math.abs(dU2) < 1e-12 * (u1 - u0) && Math.abs(dV2) < 1e-12 * (v1 - v0)) break;
    }
    return [u, v, _suM(S.P(u, v), p)];
  }
  S.ters = function(p, ipucu){
    var sonuc = null;
    if(ipucu && isFinite(ipucu[0]) && isFinite(ipucu[1])){
      var iu = ipucu[0], iv = ipucu[1];
      if(S.perU) iu = u0 + (((iu - u0) % S.perU) + S.perU) % S.perU;
      if(S.perV) iv = v0 + (((iv - v0) % S.perV) + S.perV) % S.perV;
      sonuc = newton(p, [iu, iv]);
    }
    if(!sonuc || sonuc[2] > B.kiris){
      var s2b = newton(p, izgaradan(p));
      if(!sonuc || s2b[2] < sonuc[2]) sonuc = s2b;
    }
    if(sonuc[2] > Math.max(0.05, 5 * B.kiris)) return null;
    return [sonuc[0], sonuc[1], false];
  };
  return S;
}

// ── 8 · DÖNGÜ → PARAMETRE UZAYI ───────────────────────────────────────────
// Her nokta (u, v)'ye çevrilir; periyodik yön bir öncekine göre açılır.
// Tekil nokta (kutup · tepe) u'suz kalır ve sonra iki komşusunun u'suna açılır.
function _suHalkaUV(S, xyz){
  var n = xyz.length, uv = new Array(n), onceki = null, i;
  for(i = 0; i < n; i++){
    var q = S.ters(xyz[i], onceki);
    if(!q || !isFinite(q[0]) || !isFinite(q[1])) return null;
    if(onceki){
      if(S.perU && !q[2]) q[0] += S.perU * Math.round((onceki[0] - q[0]) / S.perU);
      if(S.perV) q[1] += S.perV * Math.round((onceki[1] - q[1]) / S.perV);
    }
    uv[i] = q[2] ? [NaN, q[1]] : [q[0], q[1]];
    if(!q[2]) onceki = uv[i];
    else if(onceki) onceki = [onceki[0], q[1]];
  }
  var ilk = -1, son = -1;
  for(i = 0; i < n; i++) if(isFinite(uv[i][0])){ if(ilk < 0) ilk = i; son = i; }
  var sarU = 0, sarV = 0;
  if(ilk >= 0 && S.perU){
    var u0 = uv[ilk][0] + S.perU * Math.round((uv[son][0] - uv[ilk][0]) / S.perU);
    sarU = Math.round((u0 - uv[ilk][0]) / S.perU);
  }
  if(S.perV){
    var v0 = uv[0][1] + S.perV * Math.round((uv[n - 1][1] - uv[0][1]) / S.perV);
    sarV = Math.round((v0 - uv[0][1]) / S.perV);
  }
  // Tekil noktayı aç: (u_önceki, v) ve (u_sonraki, v)
  var auv = [], axyz = [];
  for(i = 0; i < n; i++){
    if(isFinite(uv[i][0])){ auv.push(uv[i]); axyz.push(xyz[i]); continue; }
    var o2 = null, s2 = null, j;
    for(j = 1; j < n && !o2; j++){ var a = uv[(i - j + n) % n]; if(isFinite(a[0])) o2 = a; }
    for(j = 1; j < n && !s2; j++){ var b = uv[(i + j) % n]; if(isFinite(b[0])) s2 = b; }
    if(!o2 || !s2) return null;
    // döngünün başında/sonunda sarım payı: komşu dizinin öbür ucundaysa bir periyot kaydır
    var ou = o2[0], su = s2[0];
    if(i === 0 && S.perU) ou -= sarU * S.perU;
    if(i === n - 1 && S.perU) su += sarU * S.perU;
    auv.push([ou, uv[i][1]]); axyz.push(xyz[i]);
    if(Math.abs(su - ou) > 1e-12){ auv.push([su, uv[i][1]]); axyz.push(xyz[i]); }
  }
  return { uv: auv, xyz: axyz, sarU: sarU, sarV: sarV };
}
function _suAlan2(uv){
  var A = 0;
  for(var i = 0, n = uv.length; i < n; i++){ var a = uv[i], b = uv[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; }
  return A / 2;
}
function _suKutu(uv){
  var k = [Infinity, Infinity, -Infinity, -Infinity];
  uv.forEach(function(p){ k[0] = Math.min(k[0], p[0]); k[1] = Math.min(k[1], p[1]); k[2] = Math.max(k[2], p[0]); k[3] = Math.max(k[3], p[1]); });
  return k;
}
function _suTers(h){ h.uv.reverse(); h.xyz.reverse(); }
function _suKaydir(h, ax, d){ if(d) h.uv = h.uv.map(function(p){ var q = p.slice(); q[ax] += d; return q; }); }

// Saran bir döngüyü ax = c'de kes: c'den c + per'e giden açık dizi (+ax yönünde).
function _suBantKes(h, ax, per, c){
  var n = h.uv.length, Q = h.uv, X = h.xyz;
  var q0 = Q[0][ax], j = Math.ceil((q0 - c) / per - 1e-12), T = c + j * per;
  // Q'nun bir periyotluk uzantısında T'yi ilk geçen parça
  function uzat(i){ var q = Q[i % n].slice(); q[ax] += Math.floor(i / n) * per; return q; }
  var kes = -1, tau = 0;
  for(var i = 0; i < n; i++){
    var a = uzat(i), b = uzat(i + 1);
    if((a[ax] - T) * (b[ax] - T) <= 0 && a[ax] !== b[ax]){ kes = i; tau = (T - a[ax]) / (b[ax] - a[ax]); break; }
    if(a[ax] === T){ kes = i; tau = 0; break; }
  }
  if(kes < 0) return null;
  var A = uzat(kes), Bq = uzat(kes + 1), xa = X[kes % n], xb = X[(kes + 1) % n];
  var Xk = [A[0] + (Bq[0] - A[0]) * tau, A[1] + (Bq[1] - A[1]) * tau];
  Xk[ax] = T;
  var Xp = [xa[0] + (xb[0] - xa[0]) * tau, xa[1] + (xb[1] - xa[1]) * tau, xa[2] + (xb[2] - xa[2]) * tau];
  var uv = [Xk], xyz = [Xp];
  for(var i2 = kes + 1; i2 <= kes + n; i2++){
    if(i2 === kes + 1 && tau >= 1 - 1e-12) continue;           // kesim noktası zaten bu köşe
    uv.push(uzat(i2)); xyz.push(X[i2 % n]);
  }
  if(tau <= 1e-12){ uv.pop(); xyz.pop(); }                     // son köşe kesimin kendisi
  var Xs = Xk.slice(); Xs[ax] += per;
  uv.push(Xs); xyz.push(Xp);
  // c'ye kaydır
  var kay = -j * per;
  uv = uv.map(function(p){ var q = p.slice(); q[ax] += kay; return q; });
  return { uv: uv, xyz: xyz };
}

// ── 9 · ÜÇGENLEME (kulak kırpma) ─────────────────────────────────────────
// X, Y: ölçekli parametre koordinatı (köşe indisiyle). `dis` saat yönünün
// tersine, `delikler` saat yönünde. Döner: [[a, b, c], ...] (saat yönünün tersine)
function _suKulak(X, Y, dis, delikler, sayac){
  var halka = dis.slice();
  var dl = delikler.map(function(h){
    var mi = 0;
    for(var i = 1; i < h.length; i++) if(X[h[i]] > X[h[mi]] || (X[h[i]] === X[h[mi]] && Y[h[i]] < Y[h[mi]])) mi = i;
    return { h: h, mi: mi };
  }).sort(function(a, b){ return X[b.h[b.mi]] - X[a.h[a.mi]]; });
  dl.forEach(function(d){ var y = _suKopru(X, Y, halka, d.h, d.mi); if(y) halka = y; else sayac.zorla++; });
  return _suKirp(X, Y, halka, sayac);
}
function _suKopru(X, Y, halka, h, mi){
  var M = h[mi], mx = X[M], my = Y[M], n = halka.length, enX = Infinity, enI = -1, i;
  for(i = 0; i < n; i++){
    var a = halka[i], b = halka[(i + 1) % n], ya = Y[a], yb = Y[b];
    if(ya === yb) continue;
    if((ya - my) * (yb - my) > 0) continue;
    var x = X[a] + (my - ya) / (yb - ya) * (X[b] - X[a]);
    if(x < mx) continue;
    if(x < enX){ enX = x; enI = i; }
  }
  if(enI < 0) return null;
  var ia = enI, ib = (enI + 1) % n;
  var Pi = X[halka[ia]] > X[halka[ib]] ? ia : ib;
  var P = halka[Pi];
  if(!(X[P] === enX && Y[P] === my)){
    var enAci = Infinity, enD = Infinity, secilen = Pi;
    for(i = 0; i < n; i++){
      if(i === Pi) continue;
      var q = halka[i];
      if(!_suUcgende(mx, my, enX, my, X[P], Y[P], X[q], Y[q])) continue;
      var o = halka[(i + n - 1) % n], s = halka[(i + 1) % n];
      if(_suAlanUc(X[o], Y[o], X[q], Y[q], X[s], Y[s]) >= 0) continue;   // yansımalı değil
      var dx = X[q] - mx, dy = Y[q] - my, aci = Math.abs(Math.atan2(dy, dx)), dd = dx * dx + dy * dy;
      if(aci < enAci - 1e-12 || (Math.abs(aci - enAci) <= 1e-12 && dd < enD)){ enAci = aci; enD = dd; secilen = i; }
    }
    Pi = secilen;
  }
  var yeni = halka.slice(0, Pi + 1);
  for(var j = 0; j <= h.length; j++) yeni.push(h[(mi + j) % h.length]);
  yeni.push(halka[Pi]);
  return yeni.concat(halka.slice(Pi + 1));
}
function _suAlanUc(ax, ay, bx, by, cx, cy){ return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); }
function _suUcgende(ax, ay, bx, by, cx, cy, px, py){
  var s = _suAlanUc(ax, ay, bx, by, cx, cy);
  if(s < 0){ var tx = bx, ty = by; bx = cx; by = cy; cx = tx; cy = ty; }
  return _suAlanUc(ax, ay, bx, by, px, py) >= 0 && _suAlanUc(bx, by, cx, cy, px, py) >= 0 && _suAlanUc(cx, cy, ax, ay, px, py) >= 0;
}
function _suKirp(X, Y, halka, sayac){
  var n = halka.length, out = [];
  if(n < 3) return out;
  var onc = new Int32Array(n), son = new Int32Array(n), i;
  for(i = 0; i < n; i++){ onc[i] = (i + n - 1) % n; son[i] = (i + 1) % n; }
  var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for(i = 0; i < n; i++){ var v0 = halka[i]; xmin = Math.min(xmin, X[v0]); xmax = Math.max(xmax, X[v0]); ymin = Math.min(ymin, Y[v0]); ymax = Math.max(ymax, Y[v0]); }
  var eps = 1e-14 * ((xmax - xmin) * (xmax - xmin) + (ymax - ymin) * (ymax - ymin));
  function alan(p){ var a = halka[onc[p]], b = halka[p], c = halka[son[p]]; return _suAlanUc(X[a], Y[a], X[b], Y[b], X[c], Y[c]); }
  function kulak(p){
    if(alan(p) <= eps) return false;
    var a = halka[onc[p]], b = halka[p], c = halka[son[p]];
    var x1 = Math.min(X[a], X[b], X[c]), x2 = Math.max(X[a], X[b], X[c]), y1 = Math.min(Y[a], Y[b], Y[c]), y2 = Math.max(Y[a], Y[b], Y[c]);
    for(var q = son[son[p]]; q !== onc[p]; q = son[q]){
      var v = halka[q];
      if(v === a || v === b || v === c) continue;
      var px = X[v], py = Y[v];
      if(px < x1 || px > x2 || py < y1 || py > y2) continue;
      if((px === X[a] && py === Y[a]) || (px === X[b] && py === Y[b]) || (px === X[c] && py === Y[c])) continue;
      if(_suAlanUc(X[a], Y[a], X[b], Y[b], px, py) >= 0 && _suAlanUc(X[b], Y[b], X[c], Y[c], px, py) >= 0
         && _suAlanUc(X[c], Y[c], X[a], Y[a], px, py) >= 0) return false;
    }
    return true;
  }
  var kalan = n, p = 0, deneme = 0;
  while(kalan > 3){
    if(kulak(p)){
      var o = onc[p], s = son[p];
      out.push([halka[o], halka[p], halka[s]]);
      son[o] = s; onc[s] = o; kalan--;
      // Bir SONRAKİNİ atla (earcut'ın kuralı: daha az şerit üçgen). Yelpazeye
      // karşı asıl kapı sonraki Delaunay çevirmesidir (bkz. _suAg).
      p = son[s]; deneme = 0;
      continue;
    }
    p = son[p];
    if(++deneme > kalan){
      // Tıkandı: en büyük alanlı köşeyi zorla kırp. Hiçbiri pozitif değilse
      // kalanlar bir doğru üstündedir: en küçük |alan|lı köşe DEJENERE üçgen
      // olarak yazılır — sınır kenarı üçgensiz kalmasın (Delaunay çevirmesi
      // onu sonra gerçek bir üçgene çevirir).
      var en = -1, enA = -Infinity, sifir = p, sifirA = Infinity, q2 = p;
      for(var c2 = 0; c2 < kalan; c2++, q2 = son[q2]){
        var A2 = alan(q2);
        if(A2 > enA){ enA = A2; en = q2; }
        if(Math.abs(A2) < sifirA){ sifirA = Math.abs(A2); sifir = q2; }
      }
      var sec = enA > eps ? en : sifir;
      if(enA > eps || sifirA <= 1e3 * eps) out.push([halka[onc[sec]], halka[sec], halka[son[sec]]]);
      son[onc[sec]] = son[sec]; onc[son[sec]] = onc[sec]; kalan--;
      p = onc[sec]; deneme = 0;
      if(enA > eps) sayac.zorla++;
    }
  }
  // Son üçgen bir doğru üstünde olsa da yazılır: parametre uzayında düz olan
  // sınır, eğri yüzeyde bir YAYDIR ve o üçgen yay ile kirişi arasındaki şerittir
  // (ölçüldü: 42 köşeli bir silindir yüzünde bir sınır kenarı üçgensiz kalıyordu).
  if(alan(p) > -eps) out.push([halka[onc[p]], halka[p], halka[son[p]]]);
  return out;
}

// Döngünün her kenarı tam bir üçgende, hiçbir kenar ikiden çok üçgende
function _suGecerli(halkalar, T){
  var say = new Map(), KAT = 4194304, ok = true;
  function k(a, b){ return a < b ? a * KAT + b : b * KAT + a; }
  T.forEach(function(t){ for(var j = 0; j < 3; j++){ var key = k(t[j], t[(j + 1) % 3]); say.set(key, (say.get(key) || 0) + 1); } });
  say.forEach(function(n){ if(n > 2) ok = false; });
  halkalar.forEach(function(h){ for(var i = 0; i < h.length; i++) if(say.get(k(h[i], h[(i + 1) % h.length])) !== 1) ok = false; });
  return ok;
}
// Fermuar: dış (saat yönünün tersine) ile delik (saat yönünde) arasındaki
// halka, deliğin ağırlık merkezi çevresindeki açıya göre örülür.
function _suFermuar(X, Y, dis, delik){
  var cx = 0, cy = 0;
  delik.forEach(function(v){ cx += X[v]; cy += Y[v]; });
  cx /= delik.length; cy /= delik.length;
  function aci(v){ var a = Math.atan2(Y[v] - cy, X[v] - cx); return a < 0 ? a + 2 * Math.PI : a; }
  function dizi(h){                                      // en küçük açıdan başla, açısı artan sırada
    var en = 0;
    for(var i = 1; i < h.length; i++) if(aci(h[i]) < aci(h[en])) en = i;
    var out = [];
    for(var j = 0; j < h.length; j++) out.push(h[(en + j) % h.length]);
    return out;
  }
  var A = dizi(dis), Bd = dizi(delik.slice().reverse()), out = [];
  var nA = A.length, nB = Bd.length, i = 0, j = 0;
  function ac(dz, n, k){ var a = aci(dz[k % n]); return k >= n ? a + 2 * Math.PI : a; }
  while(i < nA || j < nB){
    var ileriA = i < nA && (j >= nB || ac(A, nA, i + 1) <= ac(Bd, nB, j + 1));
    if(ileriA){ out.push([A[i % nA], A[(i + 1) % nA], Bd[j % nB]]); i++; }
    else { out.push([A[i % nA], Bd[(j + 1) % nB], Bd[j % nB]]); j++; }
  }
  return out;
}

// ── 10 · DELAUNAY VE İNCELTME ─────────────────────────────────────────────
// Kulak kırpma dikdörtgen bir şeritte yelpaze kurar; önce kısıtlı Delaunay
// çevirmesi (ölçekli parametre uzayında), sonra kiriş payını aşan İÇ kenar
// ortasından bölünür ve çevresi yeniden Delaunay'a çevrilir. Çevirmesiz ikiye
// bölmede yelpazenin her bölmesi iki yeni uzun kenar doğuruyordu (ölçüldü:
// dosyada 3,78 milyon üçgen; bir kaburga tepesi yarım yüzü 5.120 köşe, şimdi
// 119). Sınır kenarı (tek üçgenli) ne çevrilir ne bölünür: komşu yüzle ortak
// noktalar kalsın.
function _suAg(K, X, Y, T){
  var KAT = 4194304, kenar = new Map();
  var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for(var i = 0; i < X.length; i++){ xmin = Math.min(xmin, X[i]); xmax = Math.max(xmax, X[i]); ymin = Math.min(ymin, Y[i]); ymax = Math.max(ymax, Y[i]); }
  var L2 = (xmax - xmin) * (xmax - xmin) + (ymax - ymin) * (ymax - ymin), epsA = 1e-14 * L2;
  function anahtar(a, b){ return a < b ? a * KAT + b : b * KAT + a; }
  function ekle(a, b, t){ var key = anahtar(a, b), l = kenar.get(key); if(l) l.push(t); else kenar.set(key, [t]); }
  function sil(a, b, t){ var key = anahtar(a, b), l = kenar.get(key); if(!l) return; var j = l.indexOf(t); if(j >= 0) l.splice(j, 1); if(!l.length) kenar.delete(key); }
  function ucgenEkle(ti){ var t = T[ti]; ekle(t[0], t[1], ti); ekle(t[1], t[2], ti); ekle(t[2], t[0], ti); }
  function ucgenSil(ti){ var t = T[ti]; sil(t[0], t[1], ti); sil(t[1], t[2], ti); sil(t[2], t[0], ti); }
  T.forEach(function(t, ti){ ucgenEkle(ti); });
  function alan(a, b, c){ return (X[b] - X[a]) * (Y[c] - Y[a]) - (Y[b] - Y[a]) * (X[c] - X[a]); }
  // t içinde a → b sırası varsa üçüncü köşe, yoksa -1
  function sonra(t, a, b){ for(var j = 0; j < 3; j++) if(t[j] === a && t[(j + 1) % 3] === b) return t[(j + 2) % 3]; return -1; }
  // (a, b) kenarının iki yanı: [A, B, c, d, ti, tj] — ti = (A, B, c), tj = (B, A, d)
  function yanlar(key){
    var l = kenar.get(key);
    if(!l || l.length !== 2) return null;
    var a = Math.floor(key / KAT), b = key - a * KAT, ti = l[0], tj = l[1];
    var c = sonra(T[ti], a, b), A = a, Bv = b;
    if(c < 0){ c = sonra(T[ti], b, a); A = b; Bv = a; }
    var d = sonra(T[tj], Bv, A);
    if(c < 0 || d < 0) return null;
    return [A, Bv, c, d, ti, tj];
  }
  function cevir(key){
    var y = yanlar(key);
    if(!y) return false;
    var A = y[0], Bv = y[1], c = y[2], d = y[3];
    var adx = X[A] - X[d], ady = Y[A] - Y[d], bdx = X[Bv] - X[d], bdy = Y[Bv] - Y[d], cdx = X[c] - X[d], cdy = Y[c] - Y[d];
    var det = (adx * adx + ady * ady) * (bdx * cdy - cdx * bdy) - (bdx * bdx + bdy * bdy) * (adx * cdy - cdx * ady)
            + (cdx * cdx + cdy * cdy) * (adx * bdy - bdx * ady);
    var olcu = (adx * adx + ady * ady + bdx * bdx + bdy * bdy + cdx * cdx + cdy * cdy);
    if(!(det > 1e-12 * olcu * olcu)) return false;               // d çemberin dışında (ya da üstünde)
    if(alan(A, d, c) <= epsA || alan(d, Bv, c) <= epsA) return false;   // dörtgen dışbükey değil
    ucgenSil(y[4]); ucgenSil(y[5]);
    T[y[4]] = [A, d, c]; T[y[5]] = [d, Bv, c];
    ucgenEkle(y[4]); ucgenEkle(y[5]);
    return true;
  }
  function yasalla(yigin){
    var sinir = 64 * (T.length + 16);
    while(yigin.length && sinir-- > 0){
      var key = yigin.pop(), y = yanlar(key);
      if(!y || !cevir(key)) continue;
      yigin.push(anahtar(y[0], y[3]), anahtar(y[3], y[1]), anahtar(y[1], y[2]), anahtar(y[2], y[0]));
    }
  }
  return {
    delaunay: function(){ var yigin = []; kenar.forEach(function(l, key){ if(l.length === 2) yigin.push(key); }); yasalla(yigin); },
    incelt: function(S, tol, enCok, ol){
      function hata(key){
        var a = Math.floor(key / KAT), b = key - a * KAT;
        var pm = S.P((K.u[a] + K.u[b]) / 2, (K.v[a] + K.v[b]) / 2);
        // Hata YÜZEYİN kendi noktalarıyla: sınır köşesinin çizilen konumu kenar
        // eğrisinden gelir ve yüzeyden kiriş payı kadar ayrık olabilir.
        return _suM(pm, _suOrta(K.s[a], K.s[b]));
      }
      for(var tur = 0; tur < 40 && K.u.length < enCok; tur++){
        var aday = [];
        kenar.forEach(function(l, key){ if(l.length === 2){ var h = hata(key); if(h > tol) aday.push([h, key]); } });
        if(!aday.length) break;
        aday.sort(function(p, q){ return q[0] - p[0]; });
        var bolundu = 0;
        for(var i = 0; i < aday.length && K.u.length < enCok; i++){
          var key = aday[i][1], y = yanlar(key);
          if(!y || hata(key) <= tol) continue;
          var A = y[0], Bv = y[1], c = y[2], d = y[3], ti = y[4], tj = y[5];
          var um = (K.u[A] + K.u[Bv]) / 2, vm = (K.v[A] + K.v[Bv]) / 2, m = K.u.length, ps = S.P(um, vm);
          K.u.push(um); K.v.push(vm); K.p.push(ps); K.s.push(ps);
          X.push(um * ol[0]); Y.push(vm * ol[1]);
          ucgenSil(ti); ucgenSil(tj);
          var t3 = T.length, t4 = t3 + 1;
          T[ti] = [A, m, c]; T[tj] = [Bv, m, d]; T.push([m, Bv, c], [m, A, d]);
          ucgenEkle(ti); ucgenEkle(tj); ucgenEkle(t3); ucgenEkle(t4);
          yasalla([anahtar(A, c), anahtar(c, Bv), anahtar(Bv, d), anahtar(d, A)]);
          bolundu++;
        }
        if(!bolundu) break;
      }
    }
  };
}

// Sanal kenar (dikiş · kutup yanı): parametre doğrusu, kiriş payına göre bölünür.
function _suSanal(S, a, b, tol, derin, out){
  var m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if(derin < 10 && _suM(S.P(m[0], m[1]), _suOrta(S.P(a[0], a[1]), S.P(b[0], b[1]))) > tol){
    _suSanal(S, a, m, tol, derin + 1, out);
    out.push(m);
    _suSanal(S, m, b, tol, derin + 1, out);
  }
  return out;
}

// ── 11 · YÜZ ──────────────────────────────────────────────────────────────
// Yerel mm üçgenler + kullandığı kenarlar. Önbellekli.
function _suYuz(B, id, k, dk){
  var key = id + '@' + k;
  if(B.yuz[key]) return B.yuz[key];
  var r = { tip: '?', durum: 'kenar', neden: '', uc: [], nor: [], ucg: [], kenarlar: [] };
  try { _suYuzKur(B, id, k, dk, r); }
  catch(x){ r.durum = 'kenar'; r.neden = 'hata: ' + (x && x.message); r.uc = []; r.nor = []; r.ucg = []; }
  B.yuz[key] = r;
  return r;
}
function _suYuzKur(B, id, k, dk, r){
  var P = B.P, m = B.model, a = P.Varlik(m, id).a;      // ADVANCED_FACE(ad, sınırlar, yüzey, aynı_yön)
  r.tip = P.Tip(m, a[2].ref);
  var yon = _suBayrak(a[3]) ? 1 : -1;
  // ── döngüler (3B) ──
  var donguler = [], kopuk = false;
  _suRefler(a[1]).forEach(function(bid){
    var fb = P.Varlik(m, bid);                            // FACE_(OUTER_)BOUND(ad, döngü, yön)
    var lp = P.Varlik(m, fb.a[1].ref);
    if(!lp || lp.t !== 'EDGE_LOOP') return;
    var pts = [];
    _suRefler(lp.a[1]).forEach(function(oid){
      var oe = P.Varlik(m, oid).a;                        // ORIENTED_EDGE(ad, *, *, kenar, yön)
      var eid = oe[3].ref;
      r.kenarlar.push(eid);
      var seg = _suKenar(B, eid, k);
      if(!_suBayrak(oe[4])) seg = seg.slice().reverse();
      if(pts.length){
        if(_suM(pts[pts.length - 1], seg[0]) > Math.max(1e-3, B.kiris)) kopuk = true;
        for(var i = 1; i < seg.length; i++) pts.push(seg[i]);
      } else for(var i2 = 0; i2 < seg.length; i2++) pts.push(seg[i2]);
    });
    if(pts.length > 1){
      if(_suM(pts[0], pts[pts.length - 1]) > Math.max(1e-3, B.kiris)) kopuk = true;
      pts.pop();
    }
    if(!_suBayrak(fb.a[2])) pts.reverse();
    if(pts.length >= 2) donguler.push({ xyz: pts, dis: fb.t === 'FACE_OUTER_BOUND' });
  });
  if(kopuk){ r.neden = 'döngü kopuk'; return; }
  var S = _suYuzey(B, a[2].ref, k, dk);
  if(!S){ r.neden = 'yüzey ' + r.tip; return; }
  if(!donguler.length){ r.neden = 'sınırsız yüz'; return; }

  // ── parametre uzayı ──
  var H = [];
  for(var d = 0; d < donguler.length; d++){
    var h = _suHalkaUV(S, donguler[d].xyz);
    if(!h){ r.neden = 'ters çevrilemedi'; return; }
    h.dis = donguler[d].dis;
    H.push(h);
  }
  var alanKur = _suAlan(B, S, H, yon);
  if(!alanKur){ r.neden = 'alan kurulamadı'; return; }

  // ── köşeler ──
  // p: çizilen konum (sınırda kenarın kendi noktası), s: yüzeydeki konum
  var K = { u: [], v: [], p: [], s: [] }, halkalar = [];
  alanKur.halkalar.forEach(function(hh){
    var idx = [];
    for(var i = 0; i < hh.uv.length; i++){
      idx.push(K.u.length);
      var ps = S.P(hh.uv[i][0], hh.uv[i][1]);
      K.u.push(hh.uv[i][0]); K.v.push(hh.uv[i][1]);
      K.p.push(hh.xyz[i] || ps); K.s.push(ps);
    }
    halkalar.push(idx);
  });
  // Ölçek: yay uzunluğu × √eğrilik — o uzayda eşit uzunluk eşit kiriş hatası
  // demek, Delaunay üçgenleri eğriliğe göre uzar (torda u boyunca uzun, v boyunca
  // kısa). Eşyönlü ölçek en sıkı yöne göre küçülüyordu ve uzun sınır kenarının
  // yanında yatık üçgen ("Schwarz feneri") alanı şişiriyordu (ölçüldü: yarım bir
  // kaburga tepesi torunda 4.779 köşe, alan +%0,86). Oran en çok 10:1.
  var kt = _suKutu(alanKur.halkalar[0].uv), uc0 = (kt[0] + kt[2]) / 2, vc0 = (kt[1] + kt[3]) / 2;
  var ol = S.olcek(uc0, vc0);
  if(S.egrilik){
    var eg = S.egrilik(uc0, vc0), km = Math.max(eg[0], eg[1]);
    if(km > 0) ol = [ol[0] * Math.sqrt(Math.max(eg[0], km / 100)), ol[1] * Math.sqrt(Math.max(eg[1], km / 100))];
  }
  var X = K.u.map(function(u){ return u * ol[0]; }), Y = K.v.map(function(v){ return v * ol[1]; });
  var T = _suKulak(X, Y, halkalar[0], halkalar.slice(1), B.sayac);
  // Döngünün her kenarı TAM BİR üçgende olmalı. Olmuyorsa iki döngülü yüz
  // fermuarla örülür: kiriş payından ince bir halkada (ölçüldü: 0,017 mm) iki
  // çemberin çokgenleri birbirini keser ve kulak kırpma kenar düşürür.
  if(!_suGecerli(halkalar, T) && halkalar.length === 2){
    var F = _suFermuar(X, Y, halkalar[0], halkalar[1]);
    if(F.length) T = F;
    B.sayac.fermuar = (B.sayac.fermuar || 0) + 1;
  }
  if(!T.length){ r.neden = 'üçgen çıkmadı'; return; }
  var ag = _suAg(K, X, Y, T);
  ag.delaunay();
  if(!S.duz) ag.incelt(S, B.kiris, B.enCokUc, ol);

  if(B.iz){ r._halkalar = halkalar; r._uv = [K.u.slice(), K.v.slice()]; }
  // ── çıktı ──
  for(var i = 0; i < K.u.length; i++){
    var p = K.p[i], nn = S.N(K.u[i], K.v[i]);
    r.uc.push(p[0], p[1], p[2]);
    r.nor.push(yon * nn[0], yon * nn[1], yon * nn[2]);
  }
  T.forEach(function(t){ if(yon > 0) r.ucg.push(t[0], t[1], t[2]); else r.ucg.push(t[0], t[2], t[1]); });
  r.durum = 'tamam';
}

// Alan: dış halka (saat yönünün tersine) + delikler (saat yönünde).
//   A · hiçbir döngü sarmıyor: en büyük alanlı dış, kalanı delik
//   B · iki döngü aynı yönde sarıyor: aralarındaki bant, dikişle kesilir
//   C · tek döngü u'da sarıyor ve yüzeyin kutbu var: döngü ile kutup arası
function _suAlan(B, S, H, yon){
  var sarU = H.filter(function(h){ return h.sarU !== 0; }), sarV = H.filter(function(h){ return h.sarV !== 0; });
  if(sarU.length && sarV.length) return null;
  var halkalar;
  if(!sarU.length && !sarV.length){
    var dis = H[0];
    H.forEach(function(h){ if(Math.abs(_suAlan2(h.uv)) > Math.abs(_suAlan2(dis.uv))) dis = h; });
    halkalar = [dis].concat(H.filter(function(h){ return h !== dis; }));
  } else {
    var ax = sarU.length ? 0 : 1, per = ax === 0 ? S.perU : S.perV, bant = ax === 0 ? sarU : sarV;
    var diger = H.filter(function(h){ return bant.indexOf(h) < 0; });
    var sar = function(h){ return ax === 0 ? h.sarU : h.sarV; };
    var halka;
    if(bant.length === 2){
      bant.forEach(function(h){ if(sar(h) < 0){ _suTers(h); if(ax === 0) h.sarU = -h.sarU; else h.sarV = -h.sarV; } });
      var c = bant[0].uv[0][ax];
      var A = _suBantKes(bant[0], ax, per, c), Bk = _suBantKes(bant[1], ax, per, c);
      if(!A || !Bk) return null;
      halka = { uv: [], xyz: [] };
      var yaz = function(uv, xyz){ halka.uv.push(uv); halka.xyz.push(xyz); };
      var i;
      for(i = 0; i < A.uv.length; i++) yaz(A.uv[i], A.xyz[i]);
      _suSanal(S, A.uv[A.uv.length - 1], Bk.uv[Bk.uv.length - 1], B.kiris, 0, []).forEach(function(q){ yaz(q, null); });
      for(i = Bk.uv.length - 1; i >= 0; i--) yaz(Bk.uv[i], Bk.xyz[i]);
      _suSanal(S, Bk.uv[0], A.uv[0], B.kiris, 0, []).forEach(function(q){ yaz(q, null); });
    } else if(bant.length === 1 && ax === 0 && S.kutup.length){
      var h0 = bant[0];
      // Yüz, döngünün SOLUNDADIR (yüz normali bakana doğru): +u giden döngüde
      // doğal yönde +v tarafı. yon = −1 yüzü aynalar.
      var taraf = (h0.sarU > 0 ? 1 : -1) * yon;
      if(h0.sarU < 0){ _suTers(h0); h0.sarU = 1; }
      var kt = _suKutu(h0.uv), vk = null;
      S.kutup.forEach(function(v){
        if(S.kutup.length === 1) vk = v;                       // koni: tek tepe
        else if(taraf > 0 && v >= kt[3] - 1e-9 && (vk === null || v < vk)) vk = v;
        else if(taraf < 0 && v <= kt[1] + 1e-9 && (vk === null || v > vk)) vk = v;
      });
      if(vk === null) return null;
      var c2 = h0.uv[0][0], A2 = _suBantKes(h0, 0, S.perU, c2);
      if(!A2) return null;
      var tepe = S.P(c2, vk);
      halka = { uv: [], xyz: [] };
      var yaz2 = function(uv, xyz){ halka.uv.push(uv); halka.xyz.push(xyz); };
      var j;
      for(j = 0; j < A2.uv.length; j++) yaz2(A2.uv[j], A2.xyz[j]);
      var ilk = A2.uv[0], sonk = A2.uv[A2.uv.length - 1];
      _suSanal(S, sonk, [sonk[0], vk], B.kiris, 0, []).forEach(function(q){ yaz2(q, null); });
      for(j = A2.uv.length - 1; j >= 0; j--) yaz2([A2.uv[j][0], vk], tepe);
      _suSanal(S, [ilk[0], vk], ilk, B.kiris, 0, []).forEach(function(q){ yaz2(q, null); });
    } else return null;
    // Delikleri bandın içine kaydır
    var kb = _suKutu(halka.uv);
    diger.forEach(function(h){
      var kh = _suKutu(h.uv), orta = (kh[ax] + kh[ax + 2]) / 2, hedef = (kb[ax] + kb[ax + 2]) / 2;
      _suKaydir(h, ax, per * Math.round((hedef - orta) / per));
    });
    halkalar = [halka].concat(diger);
  }
  // Dış halkanın öbür yöndeki periyodik kaydırması: delikler dışın kutusuna
  var dk2 = _suKutu(halkalar[0].uv);
  for(var i3 = 1; i3 < halkalar.length; i3++){
    var kh2 = _suKutu(halkalar[i3].uv);
    if(S.perU) _suKaydir(halkalar[i3], 0, S.perU * Math.round(((dk2[0] + dk2[2]) - (kh2[0] + kh2[2])) / 2 / S.perU));
    if(S.perV) _suKaydir(halkalar[i3], 1, S.perV * Math.round(((dk2[1] + dk2[3]) - (kh2[1] + kh2[3])) / 2 / S.perV));
  }
  // Yön: dış saat yönünün tersine, delikler saat yönünde
  if(_suAlan2(halkalar[0].uv) < 0) _suTers(halkalar[0]);
  for(var i4 = 1; i4 < halkalar.length; i4++) if(_suAlan2(halkalar[i4].uv) > 0) _suTers(halkalar[i4]);
  return { halkalar: halkalar };
}

// ── 12 · PARÇA ────────────────────────────────────────────────────────────
// Bir parça örneğinin görüntü ağı (dünya koordinatında, mm). Toplayıcı yüz yüze
// beslenir: görüntüleyici işi karelere böler, arayüz donmaz (dosyanızda bütün
// montaj 1,7 sn; tek başına gergi 0,9 sn).
//   B: veStepUcgenBaglam(model) · M: dünya dönüşümü {R, t} · birim: {mm, derece}
// bitir() döner: { uc, normal: Float32Array, ucgen: Uint32Array, cizgi: Float32Array
//   (kenar parçaları, uç uca), kutu: [xmin, ymin, zmin, xmax, ymax, zmax],
//   yuz, ucgenli, kenarYuz }
function veStepUcgenTopla(B, M, birim){
  var k = birim && birim.mm > 0 ? birim.mm : 1;
  var dk = birim && birim.derece > 0 ? birim.derece : 180 / Math.PI;
  var R = M ? M.R : [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t = M ? M.t : [0, 0, 0];
  var uc = [], nor = [], ucg = [], cizgi = [], gor = {}, out = { yuz: 0, ucgenli: 0, kenarYuz: 0 };
  var kutu = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  function nokta(p, dizi){
    var x = R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2] + t[0];
    var y = R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2] + t[1];
    var z = R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2] + t[2];
    dizi.push(x, y, z);
    if(x < kutu[0]) kutu[0] = x; if(y < kutu[1]) kutu[1] = y; if(z < kutu[2]) kutu[2] = z;
    if(x > kutu[3]) kutu[3] = x; if(y > kutu[4]) kutu[4] = y; if(z > kutu[5]) kutu[5] = z;
  }
  return {
    ekle: function(fid){
      var y = _suYuz(B, fid, k, dk);
      out.yuz++; B.sayac.yuz++;
      if(y.durum === 'tamam'){ out.ucgenli++; B.sayac.ucgenli++; }
      else {
        out.kenarYuz++; B.sayac.kenarYuz++;
        var sb = (y.tip || '?') + ': ' + (y.neden || '?');
        B.sayac.nedenler[sb] = (B.sayac.nedenler[sb] || 0) + 1;
      }
      var taban = uc.length / 3, i;
      for(i = 0; i < y.uc.length; i += 3) nokta([y.uc[i], y.uc[i + 1], y.uc[i + 2]], uc);
      for(i = 0; i < y.nor.length; i += 3){
        var n0 = y.nor[i], n1 = y.nor[i + 1], n2 = y.nor[i + 2];
        nor.push(R[0][0] * n0 + R[0][1] * n1 + R[0][2] * n2, R[1][0] * n0 + R[1][1] * n1 + R[1][2] * n2, R[2][0] * n0 + R[2][1] * n1 + R[2][2] * n2);
      }
      for(i = 0; i < y.ucg.length; i++) ucg.push(taban + y.ucg[i]);
      B.sayac.ucgen += y.ucg.length / 3;
      y.kenarlar.forEach(function(eid){
        if(gor[eid]) return;
        gor[eid] = 1;
        var pts = B.kenar[eid + '@' + k];
        if(!pts) return;
        for(var j = 1; j < pts.length; j++){ nokta(pts[j - 1], cizgi); nokta(pts[j], cizgi); }
      });
    },
    bitir: function(){
      out.uc = new Float32Array(uc);
      out.normal = new Float32Array(nor);
      out.ucgen = new Uint32Array(ucg);
      out.cizgi = new Float32Array(cizgi);
      out.kutu = kutu;
      return out;
    }
  };
}
function veStepUcgenParca(B, yuzler, M, birim){
  var t = veStepUcgenTopla(B, M, birim);
  (yuzler || []).forEach(t.ekle);
  return t.bitir();
}

// Yüzün alanı (mm², yerel) — testler ve tanı için.
function veStepUcgenAlan(uc, ucgen){
  var A = 0;
  for(var i = 0; i < ucgen.length; i += 3){
    var a = ucgen[i] * 3, b = ucgen[i + 1] * 3, c = ucgen[i + 2] * 3;
    var e1 = [uc[b] - uc[a], uc[b + 1] - uc[a + 1], uc[b + 2] - uc[a + 2]];
    var e2 = [uc[c] - uc[a], uc[c + 1] - uc[a + 1], uc[c + 2] - uc[a + 2]];
    A += _suU(_suV(e1, e2)) / 2;
  }
  return A;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_STEP_UCGEN_SURUM: VE_STEP_UCGEN_SURUM,
    VE_STEP_UCGEN_VARSAYILAN: VE_STEP_UCGEN_VARSAYILAN,
    veStepUcgenBaglam: veStepUcgenBaglam,
    veStepUcgenTopla: veStepUcgenTopla,
    veStepUcgenParca: veStepUcgenParca,
    veStepUcgenAlan: veStepUcgenAlan,
    _suYuz: _suYuz,
    _suKulak: _suKulak,
    _suAg: _suAg,
    _suGecerli: _suGecerli,
    _suFermuar: _suFermuar
  };
}
