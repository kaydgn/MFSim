// ═══════════════════════════════════════════════════════════════════════════
// MFSim Otomatik Düzen (Tidy) — topolojiyi katmanlı, soldan-sağa düzene sokar
// ───────────────────────────────────────────────────────────────────────────
// Bağlantı grafiğinden katmanlar (uzun-yol / longest-path) çıkarır, katman içi
// sırayı baryzentr (komşu ortalaması) taramalarıyla düzenleyip çaprazları
// azaltır, düğümleri ızgaraya yerleştirir. Sensör/sonlandırıcı gibi yardımcı
// düğümler bağlı oldukları bileşenin altına yerleştirilir. Düğümler anında
// taşınır (bağlantılar kopuk görünmesin), sonra kamera yumuşak biçimde içeriğe
// oturur. GERİ ALINABİLİR (önce saveState).
//
// Salt konum değiştirir; boyut/veri/DOM yapısına dokunmaz. node.x/y modelini ve
// el.style.left/top'u günceller (sürükleme sistemiyle aynı sözleşme).
// ═══════════════════════════════════════════════════════════════════════════

function veTidyLayout(opts) {
  opts = opts || {};
  if(typeof nodes === 'undefined' || !nodes || nodes.length < 2) {
    if(typeof showToast === 'function') showToast('Düzenlenecek yeterli bileşen yok', 'warning');
    return;
  }
  var conns = (typeof connections !== 'undefined' && connections) ? connections : [];

  var byId = {};
  nodes.forEach(function(n) { byId[n.id] = n; });

  function isAux(n) { var d = n.def || {}; return !!(d.isSensor || d.isTerminator); }

  var mainNodes = nodes.filter(function(n) { return !isAux(n); });
  var auxNodes  = nodes.filter(isAux);
  if(mainNodes.length === 0) { mainNodes = nodes.slice(); auxNodes = []; }
  var mainSet = {}; mainNodes.forEach(function(n) { mainSet[n.id] = 1; });

  // ── Ana düğümler arası yönlü kenarlar ──
  var edges = [];
  conns.forEach(function(c) {
    if(mainSet[c.from] && mainSet[c.to] && c.from !== c.to) edges.push({ from:c.from, to:c.to });
  });

  // ── Katman ataması: uzun-yol (döngü güvenli, sınırlı gevşetme) ──
  var layer = {};
  mainNodes.forEach(function(n) { layer[n.id] = 0; });
  var changed = true, iter = 0, cap = mainNodes.length + 3;
  while(changed && iter++ < cap) {
    changed = false;
    for(var i = 0; i < edges.length; i++) {
      var e = edges[i];
      if(layer[e.to] < layer[e.from] + 1) { layer[e.to] = layer[e.from] + 1; changed = true; }
    }
  }

  // İzole ana düğümler (hiç kenarı olmayan) 0. katmanı şişirmesin diye sona
  // alınır — ama HEPSİNİ tek katmana yığmak, hiç bağlantı yokken tüm topolojiyi
  // upuzun tek bir sütuna diziyordu: geniş canvas'ın büyük kısmı boş kalıyor,
  // görünüme sığdırma da zoom'u aşırı düşürüyordu. Bunun yerine yaklaşık kare
  // bir ızgaraya dağıtılırlar.
  var hasEdge = {};
  edges.forEach(function(e) { hasEdge[e.from] = 1; hasEdge[e.to] = 1; });
  var maxLayer = 0;
  mainNodes.forEach(function(n) { if(layer[n.id] > maxLayer) maxLayer = layer[n.id]; });
  var isolated = mainNodes.filter(function(n) { return !hasEdge[n.id]; });
  if(isolated.length) {
    var rowsPerCol = Math.max(1, Math.ceil(Math.sqrt(isolated.length)));
    isolated.forEach(function(n, i) {
      layer[n.id] = maxLayer + 1 + Math.floor(i / rowsPerCol);
    });
  }

  // ── Katmanlara grupla; başlangıç sırası mevcut y ──
  var layers = {};
  mainNodes.forEach(function(n) { (layers[layer[n.id]] = layers[layer[n.id]] || []).push(n.id); });
  var Ls = Object.keys(layers).map(Number).sort(function(a, b) { return a - b; });
  Ls.forEach(function(L) { layers[L].sort(function(a, b) { return byId[a].y - byId[b].y; }); });

  // ── Baryzentr taramaları (çaprazları azalt) ──
  var inAdj = {}, outAdj = {};
  mainNodes.forEach(function(n) { inAdj[n.id] = []; outAdj[n.id] = []; });
  edges.forEach(function(e) { outAdj[e.from].push(e.to); inAdj[e.to].push(e.from); });

  function orderIndex(L) { var m = {}; layers[L].forEach(function(id, i) { m[id] = i; }); return m; }
  function sweep(forward) {
    var seq = forward ? Ls : Ls.slice().reverse();
    for(var s = 1; s < seq.length; s++) {
      var L = seq[s], refL = forward ? (L - 1) : (L + 1);
      if(!layers[refL]) continue;
      var refIdx = orderIndex(refL);
      var adj = forward ? inAdj : outAdj;
      var arr = layers[L];
      var bary = {};
      arr.forEach(function(id) {
        var ns = adj[id].filter(function(x) { return refIdx[x] != null; });
        if(ns.length === 0) { bary[id] = refIdx[id] != null ? refIdx[id] : 1e6; return; }
        var sum = 0; ns.forEach(function(x) { sum += refIdx[x]; });
        bary[id] = sum / ns.length;
      });
      var withIdx = arr.map(function(id, i) { return { id:id, b:bary[id], i:i }; });
      withIdx.sort(function(a, b) { return (a.b - b.b) || (a.i - b.i); });
      layers[L] = withIdx.map(function(x) { return x.id; });
    }
  }
  for(var sw = 0; sw < 4; sw++) sweep(sw % 2 === 0);

  // ── Konumlandırma (canvas merkezine göre; kamera sonra sığdıracak) ──
  var CANVAS_C = 3000;
  var colGap = opts.colGap || 155, rowGap = opts.rowGap || 108;
  var pos = {};
  var baseX = CANVAS_C - ((Ls.length - 1) * colGap) / 2;
  Ls.forEach(function(L, ci) {
    var arr = layers[L], k = arr.length;
    arr.forEach(function(id, r) {
      pos[id] = { x: baseX + ci * colGap, y: CANVAS_C + (r - (k - 1) / 2) * rowGap };
    });
  });

  // ── Yardımcı düğümler: bağlı oldukları ana düğümün altına ──
  var auxByHost = {};
  auxNodes.forEach(function(a) {
    var host = null;
    for(var i = 0; i < conns.length; i++) {
      var c = conns[i];
      if(c.from === a.id && mainSet[c.to]) { host = c.to; break; }
      if(c.to === a.id && mainSet[c.from]) { host = c.from; break; }
    }
    (auxByHost[host || '_'] = auxByHost[host || '_'] || []).push(a.id);
  });
  var auxGap = 44, trailX = baseX + Ls.length * colGap, trailY = CANVAS_C, trailN = 0;
  Object.keys(auxByHost).forEach(function(host) {
    var arr = auxByHost[host];
    if(host !== '_' && pos[host]) {
      var hx = pos[host].x, hy = pos[host].y, k = arr.length;
      arr.forEach(function(id, i) {
        pos[id] = { x: hx + (i - (k - 1) / 2) * auxGap, y: hy + rowGap * 0.92 };
      });
    } else {
      arr.forEach(function(id) { pos[id] = { x: trailX, y: trailY + (trailN++) * auxGap }; });
    }
  });

  // Her ihtimale karşı konumsuz kalanı canvas merkezine
  nodes.forEach(function(n) { if(!pos[n.id]) pos[n.id] = { x: CANVAS_C, y: CANVAS_C }; });

  // ── Uygula (geri alınabilir) ──
  if(typeof saveState === 'function') saveState();
  nodes.forEach(function(n) {
    n.x = Math.round(pos[n.id].x);
    n.y = Math.round(pos[n.id].y);
    var el = document.getElementById(n.id);
    if(el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
  });
  if(typeof updateAllConnections === 'function') updateAllConnections();
  if(typeof updateNodeCount === 'function') updateNodeCount();

  // ── Kamerayı yumuşakça içeriğe oturt (düğümler zaten yerinde) ──
  var canvas = document.getElementById('ve-canvas');
  if(canvas && typeof veFitViewToContent === 'function') {
    canvas.classList.add('tidy-cam');
    veFitViewToContent({ maxZoom: opts.maxZoom || 1.2 });
    setTimeout(function() { if(canvas) canvas.classList.remove('tidy-cam'); }, 520);
  }
  if(typeof showToast === 'function') showToast('Topoloji düzenlendi', 'success');
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veTidyLayout: veTidyLayout };
}
