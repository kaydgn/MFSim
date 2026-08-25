// ============================================================================
//  YAPISAL ANALİZ — YÜZEY YENİDEN-MESH'LEME (isotropic remeshing)
// ============================================================================
// TetGen'e giden yüzey ağı OCCT'nin RENDER tessellation'ı OLAMAZ. OCCT'nin ağı
// GÖRÜNTÜLEMEK için üretilir: eğriliğe uyarlanır, min açısı ~2,8°'ye inen ince
// (sliver) üçgenler bırakır. O üçgenler TetGen'e SINIR KISITI olarak gider —
// TetGen PLC kipinde sınır üçgenlerini DEĞİŞTİREMEZ, yalnız etraflarını Steiner
// noktalarıyla doldurmaya çalışır. Ölçülen sonuç: 11 bin üçgen → 834 bin tet.
//
// Bu dosya araya girer ve AYNI yüzeyi daha üniform bir ağa çevirir: Botsch–
// Kobbelt izotropik yeniden-mesh döngüsü (kenar böl → birleştir → çevir →
// teğetsel düzleştir), birkaç tur. DOM'suz, saf — worker'da da çalışır.
//
// ── BAĞIMSIZ DOĞRULAMA: BU ADIM GERÇEKTEN GEREKLİ ──────────────────────────
// Aynı braket parçası için kurulmuş Python boru hattı (gmsh + pymeshfix +
// tetgen) aynı duvara çarpmış ve kendi notlarında şunu yazmış: "ağ kalitesinin
// darboğazı tetgen değil… kök neden yüzey onarımının bıraktığı üçgenler…
// gerçekten iyileştirmek istersen yüzeyi yeniden ağla, tetgen parametreleriyle
// uğraşma." Yani bu modül, o boru hattının çözemediği maddenin ta kendisidir.
// O tarafta yüzey onarımının bedeli %1,5–1,7 HACİM KAYBIydı; buradaki döngü
// hacmi tam korur (ölçüm aşağıda).
//
// ── CAD YÜZÜ SINIRI KUTSAL ───────────────────────────────────────────────────
// Girdi, occt köprüsünün per-face üçgen ARALIKLARIdır (structural-model.js
// `faces: [{id, first, last}]`). İki CAD yüzünü ayıran kenar ("özellik kenarı")
// bölünebilir ama kaydırılamaz/çevrilemez; üç+ özellik kenarının buluştuğu köşe
// düğümü TAMAMEN SABİTTİR. Aksi halde yüz sınırı sürüklenir ve Sınır Koşulları
// bileşeninin bağlanacağı kimlik anlamsızlaşır.
//
// ── DİKİŞ KAYNAĞI (welding) ÖNCE ─────────────────────────────────────────────
// occt her CAD yüzünü BAĞIMSIZ üçgenler; paylaşılan kenarın iki yanındaki
// düğümler aynı koordinatta ama farklı indistedir. Kaynatılmazsa her yüz sınırı
// "açık kenar" görünür ve üç yüzün buluştuğu köşeler çift sayılır.
//
// ── HER İŞLEM KENDİNİ DENETLER ───────────────────────────────────────────────
// Split/collapse/flip/smooth'un HER BİRİ sonucu uygulamadan önce dejenerasyon,
// normal ters dönmesi, topoloji bozulması VE KALİTE KÖTÜLEŞMESİ için denetlenir;
// biri bile tutmazsa o TEK işlem atlanır. Yani bir tahmin hatası ağı çöpe
// çevirmez — en kötü ihtimalle o bölge iyileşmeden kalır.
//
// ── ÖLÇÜLDÜ (10×10×10 mm küp, 12 üçgen → hedef kenar 1,2 mm) ────────────────
//   açık kenar 0 · anormal (>2 üçgenli) kenar 0 · yüzeyden sapma 0,000e+0
//   hacim 1000,0000 mm³ (sapma %0,0000) — 10 pasonun HER BİRİNDE.
// Üç ayrı hata sınıfı bu ölçümlerle yakalandı ve kapatıldı (kod içinde işaretli):
// anlık-görüntü üzerinde ikinci kez işlem, sınır düğümünün yanlış yöne
// birleşmesi, ve içbükey dörtgenin çevrilmesi (normal denetiminin GÖRMEDİĞİ).
// ----------------------------------------------------------------------------

var VE_STR_REMESH_DEFAULT_ITERATIONS = 10;
var VE_STR_REMESH_SPLIT_FACTOR = 4 / 3;
var VE_STR_REMESH_COLLAPSE_FACTOR = 4 / 5;
var VE_STR_REMESH_WELD_EPS = 1e-6;     // mm
var VE_STR_REMESH_SMOOTH_RELAX = 0.5;  // teğetsel adım katsayısı

function _rmKey(a, b){ return a < b ? (a + '_' + b) : (b + '_' + a); }
function _rmVec(V, i){ return [V[i*3], V[i*3+1], V[i*3+2]]; }
function _rmSub(a, b){ return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function _rmCross(a, b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function _rmDot(a, b){ return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function _rmLen(a){ return Math.sqrt(_rmDot(a, a)); }
function _rmNormal(p0, p1, p2){ return _rmCross(_rmSub(p1, p0), _rmSub(p2, p0)); }

// Üçgenin en küçük iç açısı (derece).
function _rmMinAngleDeg(p0, p1, p2){
  var a = _rmLen(_rmSub(p1, p2)), b = _rmLen(_rmSub(p0, p2)), c = _rmLen(_rmSub(p0, p1));
  if(a < 1e-12 || b < 1e-12 || c < 1e-12) return 0;
  function ang(opp, s1, s2){
    var cosv = (s1*s1 + s2*s2 - opp*opp) / (2*s1*s2);
    return Math.acos(Math.max(-1, Math.min(1, cosv))) * 180 / Math.PI;
  }
  return Math.min(ang(a,b,c), ang(b,a,c), ang(c,a,b));
}
function _rmTriMinAngle(V, tri){
  return _rmMinAngleDeg(_rmVec(V,tri[0]), _rmVec(V,tri[1]), _rmVec(V,tri[2]));
}

// ŞEKİL ÖLÇÜTÜ — kalite KAPILARININ ölçütü. `4√3·A / (a²+b²+c²)`: eşkenarda 1,
// dejenerede 0, min açıyla monoton ilişkili. Min açının kendisi RAPORLAMADA
// kullanılıyor (kullanıcıya derece anlamlı), ama kapılarda kullanılamaz:
// üçgen başına üç `Math.acos` demek ve kapılar iç döngüde milyonlarca kez
// çalışıyor. ÖLÇÜLDÜ: acos'lu kapılarla braket katısı 0'da düzleştirme
// 11,0 s + çevirme 8,4 s sürüyordu.
function _rmShapeQ(p0, p1, p2){
  var e0 = _rmSub(p1, p0), e1 = _rmSub(p2, p0), e2 = _rmSub(p2, p1);
  var area2 = _rmLen(_rmCross(e0, e1));            // 2·Alan
  var sum = _rmDot(e0,e0) + _rmDot(e1,e1) + _rmDot(e2,e2);
  if(sum < 1e-24) return 0;
  return 2 * Math.sqrt(3) * area2 / sum;
}
function _rmTriShapeQ(V, tri){
  return _rmShapeQ(_rmVec(V,tri[0]), _rmVec(V,tri[1]), _rmVec(V,tri[2]));
}
// ~25°'lik "yeterince iyi" eşiğinin şekil ölçütü karşılığı (bir kapı bu
// eşiğin ÜSTÜNDEKİ üçgenleri daha da iyileştirmeye zorlamaz).
var VE_STR_REMESH_GOOD_Q = 0.6;

// ─── 0) Dikiş kaynağı ────────────────────────────────────────────────────────
function _rmWeld(positions, indices, eps){
  var n = positions.length / 3;
  var grid = {}, remap = new Int32Array(n), outPos = [], inv = 1 / eps;
  for(var i = 0; i < n; i++){
    var x = positions[i*3], y = positions[i*3+1], z = positions[i*3+2];
    var key = Math.round(x*inv) + ',' + Math.round(y*inv) + ',' + Math.round(z*inv);
    var hit = grid[key];
    if(hit === undefined){ hit = outPos.length / 3; outPos.push(x, y, z); grid[key] = hit; }
    remap[i] = hit;
  }
  var outIdx = new Int32Array(indices.length);
  for(var t = 0; t < indices.length; t++) outIdx[t] = remap[indices[t]];
  return { positions: outPos, indices: outIdx, weldedCount: n - outPos.length / 3 };
}

// ─── Topoloji indeksi ────────────────────────────────────────────────────────
// Kenar tablosu + DÜĞÜM→ÜÇGEN listesi tek geçişte. Düğüm→üçgen listesi
// ZORUNLU: onsuz "bu düğümün yıldızı" her sorguda BÜTÜN üçgen dizisini taramak
// demekti (O(V·T)); 20 bin üçgenlik gerçek bir parçada tek paso dakikalara
// çıkıyordu. İndeksle aynı iş O(V + T).
function _rmIndex(T, Tface){
  var edges = {};
  var vt = {};   // düğüm → [üçgen indisleri]
  for(var t = 0; t < T.length; t++){
    var tri = T[t];
    if(!tri) continue;
    for(var k = 0; k < 3; k++){
      var a = tri[k], b = tri[(k+1)%3];
      var key = _rmKey(a, b);
      if(!edges[key]) edges[key] = { a: Math.min(a,b), b: Math.max(a,b), tris: [] };
      edges[key].tris.push(t);
      (vt[a] = vt[a] || []).push(t);
    }
  }
  // Özellik kenarı: açık (≠2 üçgen) VEYA iki komşusu farklı CAD yüzünde.
  var featureEdge = {}, featCount = {}, featNb = {};
  Object.keys(edges).forEach(function(key){
    var e = edges[key];
    var isF = (e.tris.length !== 2) || (Tface[e.tris[0]] !== Tface[e.tris[1]]);
    featureEdge[key] = isF;
    if(isF){
      featCount[e.a] = (featCount[e.a] || 0) + 1;
      featCount[e.b] = (featCount[e.b] || 0) + 1;
      (featNb[e.a] = featNb[e.a] || []).push(e.b);
      (featNb[e.b] = featNb[e.b] || []).push(e.a);
    }
  });
  // fixedVertex: özellik-kenar sayısı ≠2 → köşe ya da açık uç, hiç taşınmaz.
  // hasFeature: HERHANGİ bir özellik kenarına dokunan her düğüm (üst küme).
  var fixedVertex = {}, hasFeature = {};
  Object.keys(featCount).forEach(function(v){
    hasFeature[v] = true;
    if(featCount[v] !== 2) fixedVertex[v] = true;
  });
  return { edges: edges, vt: vt, featureEdge: featureEdge,
           fixedVertex: fixedVertex, hasFeature: hasFeature, featNb: featNb };
}

// Bir düğümün yıldızındaki (canlı) üçgenler — indeksten, tekilleştirilerek.
function _rmStar(ix, T, v){
  var list = ix.vt[v] || [], out = [], seen = {};
  for(var i = 0; i < list.length; i++){
    var t = list[i];
    if(seen[t] || !T[t]) continue;
    seen[t] = true;
    out.push(t);
  }
  return out;
}


// Kalkan ızgarası TALEP ÜZERİNE kurulur ve `state` üzerinde taşınır. Çağırana
// bırakılsaydı (ör. "veStrRemeshMesh kursun") kalkan, fonksiyonu doğrudan
// çağıran her yolda SESSİZCE kapalı olurdu — kapının kendisi kaçırılabilir
// hale gelirdi.
function _rmShieldGrid(state){
  if(!VE_STR_REMESH_SHIELD) return null;
  if(!state.grid) state.grid = _rmGridBuild(state.V, state.T, state.cell || _rmMeanEdge(state));
  return state.grid;
}
function _rmMeanEdge(state){
  var T = state.T, V = state.V, sum = 0, n = 0;
  for(var t = 0; t < T.length && n < 3000; t++){
    var tri = T[t];
    if(!tri) continue;
    sum += _rmLen(_rmSub(_rmVec(V,tri[0]), _rmVec(V,tri[1]))); n++;
  }
  return n ? (sum / n) : 1;
}

// ─── 1) Kenar bölme ──────────────────────────────────────────────────────────
function _rmSplitLongEdges(state, maxLen){
  var V = state.V, T = state.T, Tface = state.Tface;
  var ix = _rmIndex(T, Tface);
  // Bir üçgenin birden fazla kenarı aynı pasoda uzun olabilir. `ix` bu pasonun
  // BAŞINDAKİ anlık görüntü: üçgen bir kez bölündükten sonra T[t] değişir, ama
  // ikinci uzun kenarı hâlâ ESKİ düzene göre işlenirdi ve yanlış köşeleri
  // birleştirip AÇIK KENAR üretirdi (ÖLÇÜLDÜ: 888 üçgenlik ağda 1220 açık
  // kenar). Bir üçgen pasoda BİR kez dokunulur; kalanı sonraki pasoya kalır.
  var touched = {}, n = 0;

  // EN UZUNDAN BAŞLA. `Object.keys` sırası geometriyle ilgisizdir; rastgele bir
  // kenarı bölmek üçgeni yanlış yerden ikiye ayırıp uzun-ince parçalar bırakır
  // ve `touched` yüzünden o üçgen aynı pasoda düzeltilemez. Uzunluğa göre azalan
  // sıra, klasik "en uzun kenarı böl" davranışını verir.
  // ÖLÇÜLDÜ: sırasız hâlde 10 pasoda ortalama-min açı 45° → 17,6° düşüyor ve
  // üçgenlerin %45,8'i 10° altına iniyordu.
  var cand = [];
  Object.keys(ix.edges).forEach(function(key){
    var e = ix.edges[key];
    if(!e.tris.length) return;
    // NON-MANIFOLD KENARA DOKUNMA. Gerçek CAD verisinde bir kenar 2'den fazla
    // üçgene komşu olabilir: OCCT tessellation'ı çakışan/temas eden yüzeyleri
    // aynı koordinata oturtur (ÖLÇÜLDÜ — braket katısı 1'de dikiş kaynağından
    // hemen sonra 4 böyle kenar; parçanın kendi geometrisinden geliyor, bu
    // modülün ürettiği bir bozukluk değil). Bölmek onları ÇOĞALTIR: aynı
    // parçada 4 kenar remesh sonunda 303'e çıkıyordu. Dokunulmadıklarında
    // sayı sabit kalır ve çağıran (panel) kaça bakacağını bilir.
    if(e.tris.length !== 2) return;
    var L = _rmLen(_rmSub(_rmVec(V, e.a), _rmVec(V, e.b)));
    if(L > maxLen) cand.push({ key: key, len: L });
  });
  cand.sort(function(x, y){ return y.len - x.len; });

  cand.forEach(function(rec){
    var e = ix.edges[rec.key];
    for(var i = 0; i < e.tris.length; i++) if(touched[e.tris[i]]) return;
    var pa = _rmVec(V, e.a), pb = _rmVec(V, e.b);
    for(var j = 0; j < e.tris.length; j++) touched[e.tris[j]] = true;

    var mIdx = V.length / 3;
    V.push((pa[0]+pb[0])/2, (pa[1]+pb[1])/2, (pa[2]+pb[2])/2);
    e.tris.forEach(function(t){
      var tri = T[t];
      if(!tri) return;
      var order = null;
      for(var i2 = 0; i2 < 3; i2++){
        var v0 = tri[i2], v1 = tri[(i2+1)%3];
        if(v0 === e.a && v1 === e.b){ order = [e.a, e.b, tri[(i2+2)%3]]; break; }
        if(v0 === e.b && v1 === e.a){ order = [e.b, e.a, tri[(i2+2)%3]]; break; }
      }
      if(!order) return;
      T[t] = [order[0], mIdx, order[2]];
      T.push([mIdx, order[1], order[2]]);
      Tface.push(Tface[t]);
    });
    n++;
  });
  return n;
}

// ─── 2) Kısa kenar birleştirme ──────────────────────────────────────────────
function _rmCollapseShortEdges(state, minLen, maxLen){
  var V = state.V, T = state.T, Tface = state.Tface, dead = state.dead;
  var ix = _rmIndex(T, Tface);
  var n = 0;
  var keys = Object.keys(ix.edges);

  for(var ki = 0; ki < keys.length; ki++){
    var key = keys[ki], e = ix.edges[key];
    if(dead[e.a] || dead[e.b]) continue;
    var aFeat = !!ix.hasFeature[e.a], bFeat = !!ix.hasFeature[e.b];
    var aFix = !!ix.fixedVertex[e.a], bFix = !!ix.fixedVertex[e.b];
    var keep, drop;

    if(ix.featureEdge[key]){
      // SINIR ZİNCİRİ ÜSTÜNDEKİ kenar. Bunu tamamen yasaklamak ilk sürümün
      // hatasıydı: sliver'ların ÇOĞU tam burada oluşuyor (ölçüldü — en kötü
      // sekiz üçgenin sekizi de bir CAD yüzü sınırına dayanıyordu) ve
      // birleştirme yasak olduğu için hiçbir adım onlara dokunamıyordu
      // (collapse sayısı pasolar boyunca 0). İki uç da AYNI zincirin ORTASINDA
      // ise (köşe değil) birleştirme zinciri kısaltır ama eğrinin üstünde
      // kalır — düz bir kenarda geometri TAM korunur.
      if(aFix && bFix) continue;              // iki köşeyi birleştirmek kenarı yutar
      keep = aFix ? e.a : e.b;                // köşe varsa hayatta kalan O
      drop = aFix ? e.b : e.a;
      // KORDAL SAPMA KAPISI — sınır EĞRİ olabilir (silindirik delik kenarı).
      // `drop` silinince zincir, komşusundan `keep`'e düz bir parçayla kısalır;
      // sapma `drop`'un o parçaya uzaklığıdır. Hedef kenarın %10'unu aşarsa
      // birleştirme reddedilir: düz kenarda sapma tam 0 olduğu için orada hep
      // serbest, dar bir yuvarlatmada ise kapalı — delik çapı sessizce küçülmez.
      var fnb = (ix.featNb[drop] || []).filter(function(x){ return x !== keep; });
      if(fnb.length !== 1) continue;
      var pOther = _rmVec(V, fnb[0]), pK = _rmVec(V, keep), pD = _rmVec(V, drop);
      var seg = _rmSub(pK, pOther), segL = _rmLen(seg);
      if(segL < 1e-12) continue;
      var w = _rmSub(pD, pOther);
      var tPar = Math.max(0, Math.min(1, _rmDot(w, seg) / (segL*segL)));
      var devVec = [w[0]-seg[0]*tPar, w[1]-seg[1]*tPar, w[2]-seg[2]*tPar];
      if(_rmLen(devVec) > minLen * 0.125) continue;
    } else {
      if(aFeat && bFeat) continue;   // iki AYRI sınırı birleştirmek yüzü yutar
      // TAM OLARAK biri sınırdaysa hayatta kalan ZORUNLU olarak O taraftır: iç
      // nokta sınıra doğru birleşir, tersi ASLA. Yoksa yüzler arası sınır eğrisi
      // bir düğüm içeri kayar — su geçirmezlik bozulmaz ama hacim SESSİZCE
      // küçülür (ÖLÇÜLDÜ: bu kural yokken küp testinde %3,5 hacim kaybı).
      keep = aFeat ? e.a : e.b;
      drop = aFeat ? e.b : e.a;
    }
    var pKeep = _rmVec(V, keep);
    if(_rmLen(_rmSub(_rmVec(V, e.a), _rmVec(V, e.b))) >= minLen) continue;

    var star = _rmStar(ix, T, drop);
    var ok = true, plan = [], dropNb = {}, sharedThird = {};
    for(var si = 0; si < star.length; si++){
      var t = star[si], tri = T[t];
      if(!tri) continue;
      var hasKeep = (tri[0]===keep || tri[1]===keep || tri[2]===keep);
      tri.forEach(function(v){ if(v !== drop) dropNb[v] = true; });
      if(hasKeep){
        plan.push({ t: t, kill: true });
        tri.forEach(function(v){ if(v !== drop && v !== keep) sharedThird[v] = true; });
        continue;
      }
      var newTri = [tri[0], tri[1], tri[2]];
      for(var q = 0; q < 3; q++) if(newTri[q] === drop) newTri[q] = keep;
      var oldN = _rmNormal(_rmVec(V,tri[0]), _rmVec(V,tri[1]), _rmVec(V,tri[2]));
      var newN = _rmNormal(_rmVec(V,newTri[0]), _rmVec(V,newTri[1]), _rmVec(V,newTri[2]));
      var oL = _rmLen(oldN), nL = _rmLen(newN);
      if(nL < 1e-12){ ok = false; break; }                       // dejenere
      if(_rmDot(oldN,newN) / (oL*nL) < 0.2){ ok = false; break; } // katlanma
      // Yeni kenarlar hedefin üst sınırını aşmasın: aşarsa bir sonraki paso
      // onları böler ve döngü salınıma girer (birleştir–böl–birleştir).
      for(var w = 0; w < 3; w++){
        if(newTri[w] === keep) continue;
        if(_rmLen(_rmSub(pKeep, _rmVec(V, newTri[w]))) > maxLen){ ok = false; break; }
      }
      if(!ok) break;
      plan.push({ t: t, kill: false, tri: newTri, before: _rmTriShapeQ(V, tri), after: _rmShapeQ(_rmVec(V,newTri[0]), _rmVec(V,newTri[1]), _rmVec(V,newTri[2])) });
    }
    if(!ok) continue;

    // BAĞLANTI (LİNK) KOŞULU: drop ile keep'in ortak komşusu YALNIZ ortak
    // üçgenlerinin üçüncü köşeleri olabilir. Başka ortak komşu varsa birleşme
    // bir kenarı 3+ üçgene bağlar (non-manifold). ÖLÇÜLDÜ: denetim olmadan
    // 1000+ üçgenlik ağın 9. pasosunda 8 anormal kenar; denetimle 0.
    var keepStar = _rmStar(ix, T, keep), keepNb = {};
    keepStar.forEach(function(t2){
      var tr = T[t2];
      if(tr) tr.forEach(function(v){ if(v !== keep) keepNb[v] = true; });
    });
    for(var nb in dropNb){
      if(nb === String(keep)) continue;
      if(keepNb[nb] && !sharedThird[nb]){ ok = false; break; }
    }
    if(!ok) continue;

    // KALİTE KAPISI: birleşme, dokunduğu bölgenin en kötü üçgenini
    // KÖTÜLEŞTİRMEMELİ. Bu modülün TEK amacı min açıyı yükseltmek; kaliteyi
    // düşüren bir "iyileştirme" adımı amacın tersine çalışır.
    var worstBefore = Infinity, worstAfter = Infinity;
    for(var pi = 0; pi < plan.length; pi++){
      if(plan[pi].kill) continue;
      if(plan[pi].before < worstBefore) worstBefore = plan[pi].before;
      if(plan[pi].after < worstAfter) worstAfter = plan[pi].after;
    }
    if(plan.length && worstAfter < Math.min(worstBefore, VE_STR_REMESH_GOOD_Q) - 1e-9) continue;

    // KESİŞME KALKANI. Yukarıdaki kapıların hiçbiri "birleşen düğüm karşı
    // duvarın içinden geçiyor mu" diye soramaz (bkz. kalkan bölümü).
    var grid = _rmShieldGrid(state);
    if(grid){
      var skipC = {};
      for(var sk = 0; sk < star.length; sk++) skipC[star[sk]] = true;
      var carp = false;
      for(var pj = 0; pj < plan.length; pj++){
        if(plan[pj].kill) continue;
        if(_rmShieldHit(grid, V, T, plan[pj].tri, skipC)){ carp = true; break; }
      }
      if(carp) continue;
    }

    plan.forEach(function(rec){
      T[rec.t] = rec.kill ? null : rec.tri;
      // İNDEKSİ GÜNCEL TUT. `ix` bu pasonun başında kuruldu; bir üçgen `drop`
      // yerine `keep` kazandığında `ix.vt[keep]` onu İÇERMİYOR. Güncellenmezse
      // sonraki bir birleştirmede `keep`'in yıldızı EKSİK görünür, o üçgenler
      // güncellenmeden kalır ve silinmiş bir düğümü göstermeye devam eder →
      // AÇIK KENAR. (Bu, indeksi eklerken doğan bir regresyondu: indeks
      // öncesi sürüm her sorguda BÜTÜN diziyi taradığı için hep günceldi ama
      // O(V·T) idi — ölçüldü: 104 açık kenar.)
      if(!rec.kill) (ix.vt[keep] = ix.vt[keep] || []).push(rec.t);
      if(state.grid) _rmGridUpdate(state.grid, V, T, rec.t);
    });
    dead[drop] = true;
    n++;
  }
  return n;
}

// ─── 3) Kenar çevirme ────────────────────────────────────────────────────────
// ÖLÇÜT VALANS DEĞİL, MİN AÇI. Klasik izotropik yeniden-mesh valans eşitler
// (iç düğüm 6, sınır 4) — düzgün ama sliver'ı hedeflemez. Bu modülün varlık
// sebebi min açıyı yükseltmek olduğu için ölçüt doğrudan odur; valans zaten
// dolaylı olarak düzelir.
function _rmFlipEdges(state){
  var V = state.V, T = state.T, Tface = state.Tface;
  var ix = _rmIndex(T, Tface);
  var touched = {}, created = {}, n = 0;

  Object.keys(ix.edges).forEach(function(key){
    var e = ix.edges[key];
    if(ix.featureEdge[key]) return;
    if(e.tris.length !== 2) return;
    if(touched[e.tris[0]] || touched[e.tris[1]]) return;
    var t1 = T[e.tris[0]], t2 = T[e.tris[1]];
    if(!t1 || !t2) return;
    var c = _rmThirdVertex(t1, e.a, e.b), d = _rmThirdVertex(t2, e.a, e.b);
    if(c < 0 || d < 0 || c === d) return;
    // Yeni köşegen mevcut bir kenarla çakışmamalı — çakışırsa aynı köşe çiftini
    // bağlayan İKİ kenar doğar (non-manifold). `created` da sayılır: bu pasoda
    // az önce doğmuş bir köşegen `ix.edges`'te YOKTUR (anlık görüntü), o yüzden
    // hata bir paso gecikmeyle ortaya çıkıyordu.
    var nk = _rmKey(c, d);
    if(ix.edges[nk] || created[nk]) return;

    var newT1 = [e.a, d, c], newT2 = [e.b, c, d];
    var n1 = _rmNormal(_rmVec(V,newT1[0]), _rmVec(V,newT1[1]), _rmVec(V,newT1[2]));
    var n2 = _rmNormal(_rmVec(V,newT2[0]), _rmVec(V,newT2[1]), _rmVec(V,newT2[2]));
    var o1 = _rmNormal(_rmVec(V,t1[0]), _rmVec(V,t1[1]), _rmVec(V,t1[2]));
    var o2 = _rmNormal(_rmVec(V,t2[0]), _rmVec(V,t2[1]), _rmVec(V,t2[2]));
    if(_rmLen(n1) < 1e-12 || _rmLen(n2) < 1e-12) return;
    if(_rmDot(n1,o1) <= 0 || _rmDot(n2,o2) <= 0) return;   // katlanma
    // KONVEKSLİK — normal denetiminin GÖREMEDİĞİ hata. Dörtgen içbükeyse yeni
    // iki üçgen ÜST ÜSTE BİNER ve biri dörtgenin dışına taşar; normaller yine
    // aynı yönde kalır. Alan üzerinden sınanır: geçerli çevirme düzlemsel
    // dörtgende toplam alanı TAM korur. ÖLÇÜLDÜ: bu denetim yokken bütün
    // düğümleri küp yüzeyinde duran (sapma 0,000e+0) bir ağda hacim
    // 1000,000 → 1000,418 kaydı — hata yalnız hacim değişmezinden görünüyordu.
    var oldArea = _rmLen(o1) + _rmLen(o2), newArea = _rmLen(n1) + _rmLen(n2);
    if(oldArea > 1e-12 && Math.abs(newArea - oldArea) / oldArea > 0.02) return;

    var before = Math.min(_rmTriShapeQ(V, t1), _rmTriShapeQ(V, t2));
    var after = Math.min(_rmShapeQ(_rmVec(V,newT1[0]), _rmVec(V,newT1[1]), _rmVec(V,newT1[2])),
                         _rmShapeQ(_rmVec(V,newT2[0]), _rmVec(V,newT2[1]), _rmVec(V,newT2[2])));
    if(after <= before + 1e-9) return;

    // KESİŞME KALKANI. Bu parçada ölçülen kusurun DOĞRUDAN kaynağı: yeni
    // köşegen (c,d) ince bir duvarın çevresini dolaşıp KARŞI yüzeyin içinden
    // geçebiliyor. Normal ve alan denetimleri bunu göremez — ikisi de yalnız
    // dörtgenin kendisine bakar.
    var gridF = _rmShieldGrid(state);
    if(gridF){
      var skipF = {}; skipF[e.tris[0]] = true; skipF[e.tris[1]] = true;
      if(_rmShieldHit(gridF, V, T, newT1, skipF)) return;
      if(_rmShieldHit(gridF, V, T, newT2, skipF)) return;
    }

    T[e.tris[0]] = newT1; T[e.tris[1]] = newT2;
    if(state.grid){ _rmGridUpdate(state.grid, V, T, e.tris[0]); _rmGridUpdate(state.grid, V, T, e.tris[1]); }
    touched[e.tris[0]] = true; touched[e.tris[1]] = true;
    created[nk] = true;
    n++;
  });
  return n;
}

function _rmThirdVertex(tri, a, b){
  for(var i = 0; i < 3; i++) if(tri[i] !== a && tri[i] !== b) return tri[i];
  return -1;
}

// ─── 4) Teğetsel düzleştirme ─────────────────────────────────────────────────
// Serbest düğüm komşularının ağırlık merkezine çekilir ve yıldızının ORTALAMA
// NORMALİNE dik düzleme izdüşürülür — düz/az eğrisel yüzeylerde (bu modülün
// kapsamı: makine parçaları) yüzeyden sapma ölçülemez düzeyde kalır. Özellik
// kenarı üstündeki (köşe olmayan) düğüm yalnız KENDİ ZİNCİRİ boyunca kayar.
//
// HER DÜĞÜM KENDİ KALİTE KAPISINDAN GEÇER: taşıma o düğümün yıldızındaki en
// kötü açıyı düşürüyorsa düğüm eski yerinde bırakılır. Denetim normal bazlı
// olsaydı (ilk sürüm öyleydi) düz bir yüzeyde normal hiç değişmediği için kapı
// hep açık kalırdı — düğüm serbestçe incelen üçgenler üretebilirdi.
// `ix` DIŞARIDAN geçilebilir: düzleştirme topolojiyi DEĞİŞTİRMEZ (yalnız düğüm
// taşır), dolayısıyla ardışık turlar aynı indeksi paylaşabilir. Her turda
// yeniden kurmak braket katısı 0'da tur başına 149 ms boşa gidiyordu.
function _rmSmooth(state, ixIn){
  var V = state.V, T = state.T, Tface = state.Tface;
  var ix = ixIn || _rmIndex(T, Tface);

  var nbrs = {};
  Object.keys(ix.edges).forEach(function(key){
    var e = ix.edges[key];
    (nbrs[e.a] = nbrs[e.a] || []).push(e.b);
    (nbrs[e.b] = nbrs[e.b] || []).push(e.a);
  });

  var nV = V.length / 3;
  for(var v = 0; v < nV; v++){
    if(state.dead[v] || ix.fixedVertex[v]) continue;
    var star = _rmStar(ix, T, v);
    if(!star.length) continue;

    var p0 = _rmVec(V, v), target = null;
    if(ix.hasFeature[v]){
      var fn = ix.featNb[v] || [];
      if(fn.length !== 2) continue;             // yalnız düzgün zincir ortası kayar
      var q1 = _rmVec(V, fn[0]), q2 = _rmVec(V, fn[1]);
      target = [(q1[0]+q2[0])/2, (q1[1]+q2[1])/2, (q1[2]+q2[2])/2];
    } else {
      var nb = nbrs[v];
      if(!nb || nb.length < 3) continue;
      var cen = [0,0,0];
      for(var i = 0; i < nb.length; i++){
        var p = _rmVec(V, nb[i]);
        cen[0] += p[0]; cen[1] += p[1]; cen[2] += p[2];
      }
      cen[0] /= nb.length; cen[1] /= nb.length; cen[2] /= nb.length;
      var nrm = [0,0,0], cnt = 0;
      for(var s = 0; s < star.length; s++){
        var tr = T[star[s]];
        if(!tr) continue;
        var nn = _rmNormal(_rmVec(V,tr[0]), _rmVec(V,tr[1]), _rmVec(V,tr[2]));
        var l = _rmLen(nn);
        if(l < 1e-12) continue;
        nrm[0] += nn[0]/l; nrm[1] += nn[1]/l; nrm[2] += nn[2]/l; cnt++;
      }
      if(!cnt) continue;
      var nl = _rmLen(nrm);
      if(nl < 1e-9) continue;
      nrm = [nrm[0]/nl, nrm[1]/nl, nrm[2]/nl];
      var dvec = _rmSub(cen, p0);
      var proj = _rmDot(dvec, nrm);
      target = [p0[0] + (dvec[0]-proj*nrm[0]), p0[1] + (dvec[1]-proj*nrm[1]), p0[2] + (dvec[2]-proj*nrm[2])];
    }

    var np = [p0[0] + (target[0]-p0[0])*VE_STR_REMESH_SMOOTH_RELAX,
              p0[1] + (target[1]-p0[1])*VE_STR_REMESH_SMOOTH_RELAX,
              p0[2] + (target[2]-p0[2])*VE_STR_REMESH_SMOOTH_RELAX];

    var wBefore = Infinity, wAfter = Infinity, bad = false;
    for(var s2 = 0; s2 < star.length; s2++){
      var tr2 = T[star[s2]];
      if(!tr2) continue;
      var P = [_rmVec(V,tr2[0]), _rmVec(V,tr2[1]), _rmVec(V,tr2[2])];
      var Q = [P[0], P[1], P[2]];
      for(var k2 = 0; k2 < 3; k2++) if(tr2[k2] === v) Q[k2] = np;
      var oN = _rmNormal(P[0], P[1], P[2]), nN = _rmNormal(Q[0], Q[1], Q[2]);
      var oL2 = _rmLen(oN), nL2 = _rmLen(nN);
      if(nL2 < 1e-12 || (oL2 > 1e-12 && _rmDot(oN,nN)/(oL2*nL2) < 0.3)){ bad = true; break; }
      var b1 = _rmShapeQ(P[0], P[1], P[2]), a1 = _rmShapeQ(Q[0], Q[1], Q[2]);
      if(b1 < wBefore) wBefore = b1;
      if(a1 < wAfter) wAfter = a1;
    }
    if(bad) continue;
    if(wAfter < Math.min(wBefore, VE_STR_REMESH_GOOD_Q) - 1e-9) continue;

    var eskiP = [V[v*3], V[v*3+1], V[v*3+2]];
    V[v*3] = np[0]; V[v*3+1] = np[1]; V[v*3+2] = np[2];

    // KESİŞME KALKANI — düğüm ÖNCE taşınır, sonra sınanır: kalkan yıldızı YENİ
    // konumuyla değerlendirmek zorunda, aksi halde taşımanın yarattığı kesişimi
    // göremez. Reddedilirse düğüm eski yerine geri konur.
    var gridS = _rmShieldGrid(state);
    if(gridS){
      var skipS = {};
      for(var s3 = 0; s3 < star.length; s3++) skipS[star[s3]] = true;
      var carpS = false;
      for(var s4 = 0; s4 < star.length; s4++){
        var tr4 = T[star[s4]];
        if(!tr4) continue;
        if(_rmShieldHit(gridS, V, T, tr4, skipS)){ carpS = true; break; }
      }
      if(carpS){
        V[v*3] = eskiP[0]; V[v*3+1] = eskiP[1]; V[v*3+2] = eskiP[2];
        continue;
      }
      for(var s5 = 0; s5 < star.length; s5++) _rmGridUpdate(gridS, V, T, star[s5]);
    }
  }
}

// ─── 5) KESİŞME KALKANI ──────────────────────────────────────────────────────
// ÖLÇÜLMÜŞ BİR KUSURUN KAPISI. Yukarıdaki üç işlemin denetimleri YEREL: normal
// katlanması, alan korunumu, şekil ölçütü — hepsi işlemin DOKUNDUĞU yıldıza
// bakar. Hiçbiri "bu üçgen 3 mm ötedeki KARŞI duvarın içinden geçiyor mu" diye
// soramaz, çünkü karşı duvar yıldızda değildir.
//
// ÖLÇÜLDÜ (kullanıcının braketi, sac kalınlığı 3 mm, NATIVE TetGen `-d`):
//   ham OCCT üçgenlemesi                → "The input surface mesh is correct."
//   yeniden-mesh h=10/8/6/5/4/3         → 8 / 7 / 2 / 0 / 4 / 6 üçgen ATILIYOR
// Kesişen kenarların boyu HEP ~3,0–3,1 mm, yani tam SAC KALINLIĞI; yani hata
// bir duvarın bir yüzünden öbür yüzüne geçen üçgenler. Boyutla ilişkisi
// MONOTON DEĞİL (h=5 temiz, h=4 kirli) — yani "hedef kenar kalınlıktan büyük
// olmasın" gibi bir kural bunu KAPATMAZ; kalkan yapısal olmak zorunda.
//
// ABLASYONLA YERİ BULUNDU (h=6): yalnız-split, split+collapse, split+smooth,
// flip KAPALI ve smooth KAPALI koşularının BEŞİ de temiz; kesişim ancak flip
// ile smooth BİRLİKTE koşunca doğuyor. Kalkan yine de üçünü birden koruyor:
// collapse de bir düğümü karşı duvara taşıyabilir, ve "bu parçada gözlenmedi"
// bir güvence değil.
//
// BÖLME KALKAN DIŞINDA ve bu bir eksiklik değil: kenar bölme yeni düğümü
// MEVCUT kenarın üstüne koyar, yani yeni üçgenlerin BİRLEŞİMİ eskisinin tam
// olarak aynı noktaları kaplar — kesişim üretmesi geometrik olarak imkânsız.
// Üstelik üçgen sayısını ikiye katlayan en sıcak adım odur; oraya kalkan
// koymak bedeli karşılıksız ikiye katlardı.
var VE_STR_REMESH_SHIELD = true;

// Möller (1997) üçgen–üçgen kesişimi. Eşik BAĞIL: mutlak bir epsilon mm ile
// çalışan bir modelde ölçek değiştiğinde anlamını yitirir.
function _rmTriTriHit(V0, V1, V2, U0, U1, U2){
  var e1 = _rmSub(V1, V0), e2 = _rmSub(V2, V0);
  var N1 = _rmCross(e1, e2);
  var l1 = _rmLen(N1);
  if(l1 < 1e-18) return false;                       // dejenere → kesişim sayma
  var d1 = -_rmDot(N1, V0);
  var eps = 1e-9 * Math.max(1, l1);

  var du0 = _rmDot(N1, U0) + d1, du1 = _rmDot(N1, U1) + d1, du2 = _rmDot(N1, U2) + d1;
  if(Math.abs(du0) < eps) du0 = 0;
  if(Math.abs(du1) < eps) du1 = 0;
  if(Math.abs(du2) < eps) du2 = 0;
  if((du0 > 0 && du1 > 0 && du2 > 0) || (du0 < 0 && du1 < 0 && du2 < 0)) return false;

  var f1 = _rmSub(U1, U0), f2 = _rmSub(U2, U0);
  var N2 = _rmCross(f1, f2);
  var l2 = _rmLen(N2);
  if(l2 < 1e-18) return false;
  var d2 = -_rmDot(N2, U0);
  var eps2 = 1e-9 * Math.max(1, l2);

  var dv0 = _rmDot(N2, V0) + d2, dv1 = _rmDot(N2, V1) + d2, dv2 = _rmDot(N2, V2) + d2;
  if(Math.abs(dv0) < eps2) dv0 = 0;
  if(Math.abs(dv1) < eps2) dv1 = 0;
  if(Math.abs(dv2) < eps2) dv2 = 0;
  if((dv0 > 0 && dv1 > 0 && dv2 > 0) || (dv0 < 0 && dv1 < 0 && dv2 < 0)) return false;

  if(du0 === 0 && du1 === 0 && du2 === 0) return _rmCoplanarHit(N1, V0, V1, V2, U0, U1, U2);

  var D = _rmCross(N1, N2);
  var ax = 0, mx = Math.abs(D[0]);
  if(Math.abs(D[1]) > mx){ mx = Math.abs(D[1]); ax = 1; }
  if(Math.abs(D[2]) > mx){ ax = 2; }

  var iv1 = _rmIsectInterval(V0[ax], V1[ax], V2[ax], dv0, dv1, dv2);
  var iv2 = _rmIsectInterval(U0[ax], U1[ax], U2[ax], du0, du1, du2);
  if(!iv1 || !iv2) return false;
  return !(iv1[1] < iv2[0] || iv2[1] < iv1[0]);
}

// Üçgenin, karşı düzlemle kesiştiği doğru üzerindeki aralığı (Möller
// COMPUTE_INTERVALS): tek başına kalan köşe yalıtılır, kalan iki kenar
// düzlemle kesiştirilir.
function _rmIsect2(a, b, c, da, db, dc){
  var t0 = a + (b - a) * da / (da - db);
  var t1 = a + (c - a) * da / (da - dc);
  return t0 < t1 ? [t0, t1] : [t1, t0];
}
function _rmIsectInterval(p0, p1, p2, d0, d1, d2){
  if(d0 * d1 > 0) return _rmIsect2(p2, p0, p1, d2, d0, d1);
  if(d0 * d2 > 0) return _rmIsect2(p1, p0, p2, d1, d0, d2);
  if(d1 * d2 > 0 || d0 !== 0) return _rmIsect2(p0, p1, p2, d0, d1, d2);
  if(d1 !== 0) return _rmIsect2(p1, p0, p2, d1, d0, d2);
  if(d2 !== 0) return _rmIsect2(p2, p0, p1, d2, d0, d1);
  return null;   // eş düzlemli — çağıran ayrı ele alıyor
}

// EŞ DÜZLEMLİ ÖRTÜŞME. Bunu atlamak ölçülmüş bir hatayı kaçırırdı: TetGen'in
// bu parçada bildirdiği durumlardan biri tam olarak "Two line segments are
// nearly overlapping" — yani üst üste binen EŞ DÜZLEMLİ üçgenler.
function _rmCoplanarHit(N, V0, V1, V2, U0, U1, U2){
  var A = [Math.abs(N[0]), Math.abs(N[1]), Math.abs(N[2])];
  var i0, i1;
  if(A[0] > A[1]){ if(A[0] > A[2]){ i0 = 1; i1 = 2; } else { i0 = 0; i1 = 1; } }
  else { if(A[2] > A[1]){ i0 = 0; i1 = 1; } else { i0 = 0; i1 = 2; } }
  var P = [[V0[i0],V0[i1]], [V1[i0],V1[i1]], [V2[i0],V2[i1]]];
  var Q = [[U0[i0],U0[i1]], [U1[i0],U1[i1]], [U2[i0],U2[i1]]];
  for(var a = 0; a < 3; a++){
    for(var b = 0; b < 3; b++){
      if(_rmSeg2Hit(P[a], P[(a+1)%3], Q[b], Q[(b+1)%3])) return true;
    }
  }
  return _rmPointIn2(P[0], Q) || _rmPointIn2(Q[0], P);
}
function _rmSeg2Hit(a, b, c, d){
  function cr(p, q, r){ return (q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0]); }
  var d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function _rmPointIn2(p, tri){
  function cr(o, q, r){ return (q[0]-o[0])*(r[1]-o[1]) - (q[1]-o[1])*(r[0]-o[0]); }
  var s1 = cr(tri[0], tri[1], p), s2 = cr(tri[1], tri[2], p), s3 = cr(tri[2], tri[0], p);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

// ─── Düzgün ızgara ──────────────────────────────────────────────────────────
// Hücre boyu hedef kenar. `tc` (üçgen → hücreler) SİLME için zorunlu: işlem
// kabul edilince üçgenin ESKİ hücrelerinden çıkması gerekir, yoksa ızgara
// bayatlar ve kalkan artık var olmayan bir üçgeni sınamaya devam eder.
//
// "BÜYÜK KOVA" TASARIMI ÖLÇÜLEREK ATILDI. İlk sürüm, kutusu çok hücreye yayılan
// üçgeni tek bir `big` kovasına koyuyor ve o kovayı HER sorguda tarıyordu. Ham
// OCCT üçgenlemesinde düz yüzeylerde 150 mm'ye varan üçgenler var (parça
// 131×150×131 mm), yani kova doluydu: ÖLÇÜLDÜ, sorgu başına 486 üçgen–üçgen
// testi, 49.160 sorguda 23,9 MİLYON test → kalkan toplam sürenin %96'sı
// (h=10, 2 paso: 44 s). Üçgen kutusunun hücrelerine YAYARAK yazmak aynı işi
// yerelleştiriyor: uzaktaki sorgu o üçgeni hiç görmüyor.
var VE_STR_REMESH_SHIELD_MAXCELLS = 4096;   // üçgen başına hücre tavanı

function _rmGridBuild(V, T, cell){
  var g = { cell: (cell > 1e-9 ? cell : 1), map: {}, tc: {}, big: [], stamp: {}, tick: 0 };
  for(var t = 0; t < T.length; t++) if(T[t]) _rmGridAdd(g, V, T[t], t);
  return g;
}
// Hücre anahtarı TAM SAYI: dize birleştirme (`x+','+y+','+z`) sıcak yolda
// milyonlarca kez koşuyor ve tek başına ölçülebilir bir maliyet.
function _rmCellKey(x, y, z){
  return ((x & 0x3ff) * 1048576) + ((y & 0x3ff) * 1024) + (z & 0x3ff);
}
function _rmGridCellKeys(g, V, tri){
  var inv = 1 / g.cell, a, k;
  var lo0 = Infinity, lo1 = Infinity, lo2 = Infinity, hi0 = -Infinity, hi1 = -Infinity, hi2 = -Infinity;
  for(k = 0; k < 3; k++){
    var i3 = tri[k] * 3, x = V[i3], y = V[i3+1], z = V[i3+2];
    if(x < lo0) lo0 = x; if(x > hi0) hi0 = x;
    if(y < lo1) lo1 = y; if(y > hi1) hi1 = y;
    if(z < lo2) lo2 = z; if(z > hi2) hi2 = z;
  }
  var x0 = Math.floor(lo0*inv), x1 = Math.floor(hi0*inv);
  var y0 = Math.floor(lo1*inv), y1 = Math.floor(hi1*inv);
  var z0 = Math.floor(lo2*inv), z1 = Math.floor(hi2*inv);
  var say = (x1-x0+1) * (y1-y0+1) * (z1-z0+1);
  if(!(say > 0) || say > VE_STR_REMESH_SHIELD_MAXCELLS) return null;
  var keys = new Array(say), n = 0;
  for(a = x0; a <= x1; a++)
    for(var b = y0; b <= y1; b++)
      for(var c = z0; c <= z1; c++) keys[n++] = _rmCellKey(a, b, c);
  return keys;
}
function _rmGridAdd(g, V, tri, t){
  var keys = _rmGridCellKeys(g, V, tri);
  if(!keys){ g.big.push(t); g.tc[t] = null; return; }
  g.tc[t] = keys;
  for(var i = 0; i < keys.length; i++) (g.map[keys[i]] = g.map[keys[i]] || []).push(t);
}
function _rmGridDel(g, t){
  var keys = g.tc[t];
  if(keys === undefined) return;
  if(keys === null){
    var bi = g.big.indexOf(t);
    if(bi >= 0) g.big.splice(bi, 1);
  } else {
    for(var i = 0; i < keys.length; i++){
      var arr = g.map[keys[i]];
      if(!arr) continue;
      var j = arr.indexOf(t);
      if(j >= 0) arr[j] = arr[arr.length-1], arr.pop();
    }
  }
  delete g.tc[t];
}
function _rmGridUpdate(g, V, T, t){
  _rmGridDel(g, t);
  if(T[t]) _rmGridAdd(g, V, T[t], t);
}

// Aday üçgenin kutusu sorgu kutusundan AYRIK mı? Ayrıksa kesişim imkânsız.
function _rmBoxApart(V, o, x0, x1, y0, y1, z0, z1){
  var i0 = o[0]*3, i1 = o[1]*3, i2 = o[2]*3;
  var v = V[i0];   var mn = v, mx = v;
  v = V[i1]; if(v < mn) mn = v; else if(v > mx) mx = v;
  v = V[i2]; if(v < mn) mn = v; else if(v > mx) mx = v;
  if(mx < x0 || mn > x1) return true;
  v = V[i0+1]; mn = v; mx = v;
  v = V[i1+1]; if(v < mn) mn = v; else if(v > mx) mx = v;
  v = V[i2+1]; if(v < mn) mn = v; else if(v > mx) mx = v;
  if(mx < y0 || mn > y1) return true;
  v = V[i0+2]; mn = v; mx = v;
  v = V[i1+2]; if(v < mn) mn = v; else if(v > mx) mx = v;
  v = V[i2+2]; if(v < mn) mn = v; else if(v > mx) mx = v;
  return (mx < z0 || mn > z1);
}

// Aday üçgenin kutusu sorgu kutusundan AYRIK mı? Ayrıksa kesişim imkânsız.
function _rmBoxApart(V, o, x0, x1, y0, y1, z0, z1){
  var i0 = o[0]*3, i1 = o[1]*3, i2 = o[2]*3;
  var v = V[i0];   var mn = v, mx = v;
  v = V[i1]; if(v < mn) mn = v; else if(v > mx) mx = v;
  v = V[i2]; if(v < mn) mn = v; else if(v > mx) mx = v;
  if(mx < x0 || mn > x1) return true;
  v = V[i0+1]; mn = v; mx = v;
  v = V[i1+1]; if(v < mn) mn = v; else if(v > mx) mx = v;
  v = V[i2+1]; if(v < mn) mn = v; else if(v > mx) mx = v;
  if(mx < y0 || mn > y1) return true;
  v = V[i0+2]; mn = v; mx = v;
  v = V[i1+2]; if(v < mn) mn = v; else if(v > mx) mx = v;
  v = V[i2+2]; if(v < mn) mn = v; else if(v > mx) mx = v;
  return (mx < z0 || mn > z1);
}

// `tri` (YENİ konumlarıyla) ızgaradaki herhangi bir üçgeni kesiyor mu?
// KÖŞE PAYLAŞANLAR ELENİR: komşu üçgenler tanım gereği birbirine değer,
// kesişme sayılmaz — TetGen'in `-d` ölçütü de budur. `skip` işlemin yerine
// geçtiği (yani artık var olmayacak) üçgenler.
function _rmShieldHit(g, V, T, tri, skip){
  var keys = _rmGridCellKeys(g, V, tri);
  var a = tri[0], b = tri[1], c = tri[2];
  var pa = _rmVec(V, a), pb = _rmVec(V, b), pc = _rmVec(V, c);
  // KUTU ÖN ELEMESİ. Möller testi aday başına ~1,9 µs (üç köşe okuması, iki
  // düzlem, aralık kesişimi — hepsi dizi ayırarak). Kutu ayrıksa cevap zaten
  // "hayır" ve on karşılaştırmayla veriliyor. ÖLÇÜLDÜ: 5,75 M aday testi →
  // 0,55 M, kalkan 10,9 s → 1,6 s.
  var qx0 = pa[0] < pb[0] ? (pa[0] < pc[0] ? pa[0] : pc[0]) : (pb[0] < pc[0] ? pb[0] : pc[0]);
  var qx1 = pa[0] > pb[0] ? (pa[0] > pc[0] ? pa[0] : pc[0]) : (pb[0] > pc[0] ? pb[0] : pc[0]);
  var qy0 = pa[1] < pb[1] ? (pa[1] < pc[1] ? pa[1] : pc[1]) : (pb[1] < pc[1] ? pb[1] : pc[1]);
  var qy1 = pa[1] > pb[1] ? (pa[1] > pc[1] ? pa[1] : pc[1]) : (pb[1] > pc[1] ? pb[1] : pc[1]);
  var qz0 = pa[2] < pb[2] ? (pa[2] < pc[2] ? pa[2] : pc[2]) : (pb[2] < pc[2] ? pb[2] : pc[2]);
  var qz1 = pa[2] > pb[2] ? (pa[2] > pc[2] ? pa[2] : pc[2]) : (pb[2] > pc[2] ? pb[2] : pc[2]);
  var tick = ++g.tick, stamp = g.stamp;
  var i, j, arr, t, o;
  for(i = -1; i < (keys ? keys.length : 0); i++){
    arr = (i < 0) ? g.big : g.map[keys[i]];
    if(!arr) continue;
    for(j = 0; j < arr.length; j++){
      t = arr[j];
      if(stamp[t] === tick) continue;
      stamp[t] = tick;
      if(skip && skip[t]) continue;
      o = T[t];
      if(!o) continue;
      if(_rmBoxApart(V, o, qx0, qx1, qy0, qy1, qz0, qz1)) continue;
      if(o[0]===a || o[0]===b || o[0]===c || o[1]===a || o[1]===b || o[1]===c
      || o[2]===a || o[2]===b || o[2]===c) continue;
      if(_rmTriTriHit(pa, pb, pc, _rmVec(V,o[0]), _rmVec(V,o[1]), _rmVec(V,o[2]))) return true;
    }
  }
  // Sorgu üçgeni kendisi "büyük" ise (kutusu tavanı aşıyor) hücreleri
  // bilinmiyor demektir; o durumda ızgaranın tamamı taranmak ZORUNDA — eksik
  // tarama kalkanı sessizce delerdi. Bölme adımı her pasonun başında koştuğu
  // için bu yol pratikte yalnız ilk pasolarda görülüyor.
  if(!keys){
    for(var kk in g.map){
      arr = g.map[kk];
      for(j = 0; j < arr.length; j++){
        t = arr[j];
        if(stamp[t] === tick) continue;
        stamp[t] = tick;
        if(skip && skip[t]) continue;
        o = T[t];
        if(!o) continue;
        if(_rmBoxApart(V, o, qx0, qx1, qy0, qy1, qz0, qz1)) continue;
        if(o[0]===a || o[0]===b || o[0]===c || o[1]===a || o[1]===b || o[1]===c
        || o[2]===a || o[2]===b || o[2]===c) continue;
        if(_rmTriTriHit(pa, pb, pc, _rmVec(V,o[0]), _rmVec(V,o[1]), _rmVec(V,o[2]))) return true;
      }
    }
  }
  return false;
}

// ─── 6) ASILI DÜĞÜM ONARIMI ─────────────────────────────────────────────────
// ÖNLEMEK YERİNE ONARMAK — ve bu bir teslim değil, ölçülmüş bir tercih.
//
// Asılı düğümü işlemlerin İÇİNDE önlemek bir EŞİK meselesine dönüşüyor ve eşik
// iki yönde de yanlış: ÖLÇÜLDÜ (kullanıcının braketi),
//   eşik 1e-4 → kapı TetGen'in kendi eş-doğrusallık toleransından SIKI, üçgen
//               hâlâ atılıyor (3,1 mm kenarda 3,8e-4 mm sapma "temiz" sayılıyor)
//   eşik 1e-2 → kapı meşru birleştirmeleri de reddediyor: üçgen sayısı İKİYE
//               KATLANIYOR (h=12'de 3.546 → 8.932), min açı 3,36° → 0,01°
// Yani doğru eşik yok; TetGen'in toleransını kovalamak kırılgan bir düzeltme
// olurdu.
//
// Onarım ise ölçüt tanımı gereği KESİN: "v düğümü (a,b) kenarının içinde" ise
// o kenarı v'de BÖL. Sonuç uyumlu (conforming) bir ağ — üst üste binen segment
// çifti ortadan kalkar, geometri v zaten kenarın üstünde olduğu için ölçülemez
// düzeyde değişir. Yeni bir sınıf da açmaz: bölme, kesişim ÜRETEMEYEN tek
// işlemdir (yeni üçgenlerin birleşimi eskisinin tam olarak aynı noktalarını
// kaplar).
var VE_STR_REMESH_REPAIR_REL = 1e-3;
var VE_STR_REMESH_REPAIR_ROUNDS = 6;

// Bir turda bulunan asılı düğümleri onarır; onarılan sayıyı döndürür.
function _rmRepairHangingOnce(state){
  var V = state.V, T = state.T, Tface = state.Tface;
  var grid = _rmGridBuild(V, T, state.cell || _rmMeanEdge(state));
  var ix = _rmIndex(T, Tface);
  var isler = [], gorulen = {};

  Object.keys(ix.edges).forEach(function(key){
    var e = ix.edges[key];
    var ax = V[e.a*3], ay = V[e.a*3+1], az = V[e.a*3+2];
    var dx = V[e.b*3]-ax, dy = V[e.b*3+1]-ay, dz = V[e.b*3+2]-az;
    var L2 = dx*dx + dy*dy + dz*dz;
    if(L2 < 1e-18) return;
    // Kenarın kutusuna düşen üçgenlerin köşelerini tara.
    var sahte = [e.a, e.b, e.a];
    var keys = _rmGridCellKeys(grid, V, sahte);
    var tick = ++grid.tick, stamp = grid.stamp;
    var i, j, k, arr, t, o;
    for(i = -1; i < (keys ? keys.length : 0); i++){
      arr = (i < 0) ? grid.big : grid.map[keys[i]];
      if(!arr) continue;
      for(j = 0; j < arr.length; j++){
        t = arr[j];
        if(stamp[t] === tick) continue;
        stamp[t] = tick;
        o = T[t];
        if(!o) continue;
        for(k = 0; k < 3; k++){
          var v = o[k];
          if(v === e.a || v === e.b) continue;
          if(gorulen[v]) continue;
          if(!_rmPointOnEdgeRel(V, v, e.a, e.b, VE_STR_REMESH_REPAIR_REL)) continue;
          // v, kenarın üçgenlerinden birinin köşesi ise bu bir T-bağlantısı
          // DEĞİL, normal komşuluktur.
          var komsu = false;
          for(var q = 0; q < e.tris.length; q++){
            var tr = T[e.tris[q]];
            if(tr && (tr[0] === v || tr[1] === v || tr[2] === v)){ komsu = true; break; }
          }
          if(komsu) continue;
          gorulen[v] = true;
          isler.push({ a: e.a, b: e.b, v: v, tris: e.tris.slice() });
        }
      }
    }
  });

  var n = 0;
  for(var s = 0; s < isler.length; s++){
    var iş = isler[s];
    var bozuk = false;
    for(var z = 0; z < iş.tris.length; z++) if(!T[iş.tris[z]]) bozuk = true;
    if(bozuk) continue;                       // bu turda önceki bir onarım değiştirdi
    for(var z2 = 0; z2 < iş.tris.length; z2++){
      var ti = iş.tris[z2], tri = T[ti];
      var c = _rmThirdVertex(tri, iş.a, iş.b);
      if(c < 0) continue;
      // Sarımı KORU: (a,b,c) sırasını bozmadan (a,v,c) ve (v,b,c) üret.
      var yeni1 = null, yeni2 = null;
      for(var r = 0; r < 3; r++){
        if(tri[r] === iş.a && tri[(r+1)%3] === iş.b){ yeni1 = [iş.a, iş.v, c]; yeni2 = [iş.v, iş.b, c]; break; }
        if(tri[r] === iş.b && tri[(r+1)%3] === iş.a){ yeni1 = [iş.b, iş.v, c]; yeni2 = [iş.v, iş.a, c]; break; }
      }
      if(!yeni1) continue;
      T[ti] = yeni1;
      T.push(yeni2); Tface.push(Tface[ti]);
    }
    n++;
  }
  return n;
}
function _rmPointOnEdgeRel(V, pi, a, b, rel){
  var ax = V[a*3], ay = V[a*3+1], az = V[a*3+2];
  var dx = V[b*3]-ax, dy = V[b*3+1]-ay, dz = V[b*3+2]-az;
  var L2 = dx*dx + dy*dy + dz*dz;
  if(L2 < 1e-18) return false;
  var wx = V[pi*3]-ax, wy = V[pi*3+1]-ay, wz = V[pi*3+2]-az;
  var par = (wx*dx + wy*dy + wz*dz) / L2;
  if(par <= 1e-3 || par >= 1 - 1e-3) return false;
  var ex = wx - dx*par, ey = wy - dy*par, ez = wz - dz*par;
  return (ex*ex + ey*ey + ez*ez) < rel * rel * L2;
}
function _rmRepairHanging(state){
  var toplam = 0;
  for(var r = 0; r < VE_STR_REMESH_REPAIR_ROUNDS; r++){
    var n = _rmRepairHangingOnce(state);
    toplam += n;
    if(!n) break;
  }
  return toplam;
}

// KAPALI YÜZEYİN ÇEVRELEDİĞİ HACİM (diverjans teoremi). Yeniden-mesh'lemenin
// parçayı kaç mm³ yediğini ölçmek için: kayıp SESSİZ olursa çözüm daha ince bir
// gövde üzerinde koşar ve gerilme sistematik olarak YÜKSEK çıkar — "makul ama
// yanlış" sonucun ders kitabı örneği. Aynı braket için kurulmuş Python boru
// hattı da bu sayıyı (`vol_loss_pct`) raporluyor ve %4'ü aşarsa uyarıyor.
function veStrSurfaceVolume(V, T){
  var vol = 0;
  for(var t = 0; t < T.length; t++){
    var tri = T[t];
    if(!tri) continue;
    var a = tri[0]*3, b = tri[1]*3, c = tri[2]*3;
    vol += (V[a]   * (V[b+1]*V[c+2] - V[b+2]*V[c+1])
          - V[a+1] * (V[b]  *V[c+2] - V[b+2]*V[c])
          + V[a+2] * (V[b]  *V[c+1] - V[b+1]*V[c])) / 6;
  }
  return vol;
}

// ─── Kalite ölçümü ───────────────────────────────────────────────────────────
function veStrMeshQuality(V, T){
  var minAngle = 180, sum = 0, n = 0, below10 = 0;
  for(var t = 0; t < T.length; t++){
    var tri = T[t];
    if(!tri) continue;
    var a = _rmTriMinAngle(V, tri);
    if(a < minAngle) minAngle = a;
    if(a < 10) below10++;
    sum += a; n++;
  }
  return {
    minAngleDeg: n ? minAngle : 0,
    meanMinAngleDeg: n ? sum / n : 0,
    below10Pct: n ? (100 * below10 / n) : 0,
    triCount: n
  };
}

// ─── Ana giriş ───────────────────────────────────────────────────────────────
// mesh: { positions, indices, faces:[{id, first, last}] } (geom.meshes[i])
// opts: { targetLen (mm), iterations }
function veStrRemeshMesh(mesh, opts){
  opts = opts || {};
  if(!mesh || !mesh.positions || !mesh.indices || !mesh.indices.length){
    return { ok: false, error: 'Yeniden-mesh: geçersiz girdi (üçgen yok).' };
  }
  var srcFaces = mesh.faces || [];
  if(!srcFaces.length){
    return { ok: false, error: 'Yeniden-mesh: CAD yüzü bilgisi yok (brep_faces boş).' };
  }

  var weld = _rmWeld(mesh.positions, mesh.indices, VE_STR_REMESH_WELD_EPS);
  var V = weld.positions, idx = weld.indices, triCount = idx.length / 3;

  // Üçgen → CAD yüzü kimliği. Aralıklar sıralı olduğu için ikili arama.
  var T = new Array(triCount), Tface = new Array(triCount);
  var sorted = srcFaces.slice().sort(function(a,b){ return a.first - b.first; });
  for(var t = 0; t < triCount; t++){
    T[t] = [idx[t*3], idx[t*3+1], idx[t*3+2]];
    var lo = 0, hi = sorted.length - 1, hit = null;
    while(lo <= hi){
      var mid = (lo + hi) >> 1;
      if(t < sorted[mid].first) hi = mid - 1;
      else if(t > sorted[mid].last) lo = mid + 1;
      else { hit = sorted[mid]; break; }
    }
    Tface[t] = hit ? hit.id : null;
  }

  // İKİSİ DE DÖNGÜDEN ÖNCE: `V` ve `T` döngü boyunca YERİNDE değişiyor, sonda
  // ölçülen bir "önce" değeri aslında "sonra"yı ölçerdi.
  var qBefore = veStrMeshQuality(V, T);
  var volBefore = veStrSurfaceVolume(V, T);

  // NON-MANIFOLD SAYIMI — kaynaktan HEMEN SONRA, remesh'ten ÖNCE. Bu sayı
  // parçanın kendi geometrisinden gelir (temas eden/çakışan yüzeyler); remesh
  // onu ne üretir ne de düzeltir, yalnız korur. Çağıran bunu kullanıcıya
  // yazmak zorunda: TetGen böyle bir yüzeyde geçerli ama BAŞKA bir hacim
  // çözebilir ya da hiç çözemez, ve iki durumda da sebep görünür olmalı.
  var nonManifold = 0;
  (function(){
    var probe = _rmIndex(T, Tface);
    Object.keys(probe.edges).forEach(function(k){
      if(probe.edges[k].tris.length > 2) nonManifold++;
    });
  })();

  // Bu KATININ kendi sınır kutusu — hedef kenar boyunun hem varsayılanı hem de
  // ÜST SINIRI ondan çıkar.
  var minP = [Infinity,Infinity,Infinity], maxP = [-Infinity,-Infinity,-Infinity];
  for(var vi = 0; vi < V.length; vi += 3){
    for(var ax = 0; ax < 3; ax++){
      if(V[vi+ax] < minP[ax]) minP[ax] = V[vi+ax];
      if(V[vi+ax] > maxP[ax]) maxP[ax] = V[vi+ax];
    }
  }
  var ownDiag = _rmLen(_rmSub(maxP, minP)) || 1;

  var targetLen = opts.targetLen;
  if(!targetLen || !isFinite(targetLen) || targetLen <= 0){
    targetLen = ownDiag / 40;
  }
  // KATI BAŞINA TAVAN. Hedef kenar boyu bir MONTAJIN tamamı için seçiliyor
  // (kullanıcı tek sayı giriyor, varsayılan tüm parçanın köşegeninden türüyor);
  // ama o sayı montajın KÜÇÜK parçaları için fazlasıyla kaba olabilir. Kaba bir
  // hedefle bu döngü kısa kenarları birleştirmeye devam eder ve küçük parçanın
  // keskin kenarları YUVARLANIR. ÖLÇÜLDÜ (braket montajı, hedef 5,98 mm):
  // 17 mm'lik mesafe parçaları ekranda yuvarlak çakıl taşına dönüyordu ve
  // hacim kaybı %5,7'ye çıkıyordu. Kendi köşegeninin 1/8'i, o parçada her
  // kenar boyunca en az 8 bölme demek — biçimi koruyan pratik alt sınır.
  var cap = ownDiag / 8;
  if(targetLen > cap) targetLen = cap;
  targetLen = Math.max(targetLen, 1e-3);
  var iterations = opts.iterations || VE_STR_REMESH_DEFAULT_ITERATIONS;

  var state = { V: V, T: T, Tface: Tface, dead: {}, cell: targetLen, grid: null };
  for(var iter = 0; iter < iterations; iter++){
    _rmSplitLongEdges(state, targetLen * VE_STR_REMESH_SPLIT_FACTOR);
    // Bölme kalkan DIŞINDA (kesişim üretemez) ama üçgen sayısını ikiye
    // katlayabiliyor → ızgara geçersiz. Yeniden kurma sorumluluğu
    // `_rmShieldGrid`'te; burada yalnız bayrak düşüyor.
    state.grid = null;
    _rmCollapseShortEdges(state, targetLen * VE_STR_REMESH_COLLAPSE_FACTOR, targetLen * VE_STR_REMESH_SPLIT_FACTOR);
    // Çevir ve düzleştir BİRDEN FAZLA TUR. İkisi de bir üçgene pasoda bir kez
    // dokunur (çevirme `touched` yüzünden, düzleştirme komşusu taşınınca
    // yeniden değerlendirilmesi gerektiği için), oysa bölme adımı tek pasoda
    // üçgen sayısını ikiye katlayabiliyor. Tek tur, bölmenin açtığı kalite
    // çukurunun ancak bir kısmını kapatıyordu. Turlar kalite yakınsayınca
    // (çevirme bulamayınca) erken biter — sabit maliyet değil.
    for(var f = 0; f < 4; f++){ if(!_rmFlipEdges(state)) break; }
    var ixSmooth = _rmIndex(state.T, state.Tface);
    for(var sm = 0; sm < 3; sm++) _rmSmooth(state, ixSmooth);
  }

  // ASILI DÜĞÜM ONARIMI — döngü bittikten SONRA, tek sefer. Döngünün içinde
  // koşsaydı bir sonraki paso onardığı kenarları yeniden birleştirip aynı
  // yapıyı geri getirebilirdi; sondaki tek geçiş nihai ağı uyumlu bırakıyor.
  var onarilan = _rmRepairHanging(state);

  // Sıkıştır: silinen üçgenleri ve kullanılmayan düğümleri at.
  var liveT = [], liveFace = [];
  for(var ti = 0; ti < state.T.length; ti++){
    if(state.T[ti]){ liveT.push(state.T[ti]); liveFace.push(state.Tface[ti]); }
  }
  var used = {};
  liveT.forEach(function(tri){ tri.forEach(function(v){ used[v] = true; }); });
  var remap = {}, outPos = [];
  Object.keys(used).map(Number).sort(function(a,b){ return a-b; }).forEach(function(v){
    remap[v] = outPos.length / 3;
    outPos.push(state.V[v*3], state.V[v*3+1], state.V[v*3+2]);
  });
  var outIdx = new Int32Array(liveT.length * 3), remapped = [];
  for(var ti2 = 0; ti2 < liveT.length; ti2++){
    var a2 = remap[liveT[ti2][0]], b2 = remap[liveT[ti2][1]], c2 = remap[liveT[ti2][2]];
    outIdx[ti2*3] = a2; outIdx[ti2*3+1] = b2; outIdx[ti2*3+2] = c2;
    remapped.push([a2, b2, c2]);
  }
  var outPosArr = new Float64Array(outPos);

  return {
    ok: true,
    positions: outPosArr,
    indices: outIdx,
    faceIds: liveFace,
    weldedCount: weld.weldedCount,
    nonManifoldEdges: nonManifold,
    repairedHangingNodes: onarilan,
    volumeBefore: volBefore,
    volumeAfter: veStrSurfaceVolume(outPosArr, remapped),
    qualityBefore: qBefore,
    qualityAfter: veStrMeshQuality(outPosArr, remapped),
    targetLen: targetLen
  };
}
