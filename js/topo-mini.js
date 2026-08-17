// ═══════════════════════════════════════════════════════════════════════════
// MİNİ TOPOLOJİ HARİTASI + MODÜL GÖRÜNÜM MODU
// ───────────────────────────────────────────────────────────────────────────
// Ana topolojideki alt-sistem (modül) düğümü iki BİÇİMDEN birinde çizilir:
//
//   'card' — bugüne kadarki kart: şerit + sembol + ad + "N bileşen · M bağlantı"
//   'map'  — aynı kartın başlık satırı + ALTINDA alt topolojinin HARİTASI
//
// Kullanıcı şikâyeti (2026-08-17): "topolojilerin tüm topoloji haritalarıyla da
// yan yana durmalarını istiyorum". Kart doluluk ve sayı taşıyordu ama ŞEKİL
// taşımıyordu: 16 bileşenlik Araç Performans ile 5 bileşenlik FEAD ekranda
// birebir aynı kutuydu.
//
// Biçim seçimi ÜÇ katmanlı — en dar kapsam kazanır:
//   1) düğümün kendi tercihi   node.data.mapOpen === true/false   (kart başlığındaki ▾/▴)
//   2) genel ayar              Ayarlar → Görünüm → Modül Kartı    ('card'|'map'|'zoom')
//   3) 'zoom' ayarında kamera  canvasZoom ≥ VE_MODULE_ZOOM_THRESHOLD → harita
//
// HARİTA NASIL ÇİZİLİR — durumdan, canlı DOM'dan DEĞİL. veTopoMiniSVG saf bir
// fonksiyon: (düğümler, bağlantılar) → SVG dizesi. Üç sonucu var:
//   • Kimlik çakışması yok. DOM klonlansaydı içerideki comp-3 ile dışarıdaki
//     comp-3 aynı belgede olurdu; getElementById ile çalışan her yol (seçim,
//     silme, bağlantı güncelleme, dışa aktarma) yanlış düğümü bulabilirdi.
//     (topology.js veRenderSnapshot aynı tuzağı klonlara id VERMEYEREK aşıyor.)
//   • Aynı çizici PNG/SVG dışa aktarmaya da hizmet ediyor (export-topology.js)
//     → ekrandaki görüntü ile indirilen dosya ayrışamıyor.
//   • Ölçek serbest: viewBox içeriğin sınır kutusuna oturuyor, kart büyüyünce
//     harita da büyüyor.
//
// EKSİĞİ BİLEREK: modüle özel kanvas süslemesi (Takoz'un şasi çerçevesi + yay
// bağlantıları, cp-mount.js veMntDecorateConnections) haritaya GİRMEZ; harita
// kutu + sembol + bağlantı eğrisi çizer. Kullanıcı kararı (2026-08-17): şimdilik
// sade şematik. Gerekirse tip başına bir süsleme kancası eklenecek.
//
// Saf fonksiyonlar birim testli: tests/unit/module-map.test.js
// ═══════════════════════════════════════════════════════════════════════════

// Genel ayarın localStorage anahtarı ve geçerli değerleri.
var VE_MODULE_VIEW_KEY     = 'mf-module-view';
var VE_MODULE_VIEW_MODES   = ['card', 'map', 'zoom'];
var VE_MODULE_VIEW_DEFAULT = 'map';
// 'zoom' modunda biçim değiştiren kamera eşiği. %60'ın altında harita zaten
// okunmuyor (65 px'lik düğüm ekranda 11 px'e iniyor) → kart daha çok bilgi verir.
var VE_MODULE_ZOOM_THRESHOLD = 0.6;
// Haritanın içerik kutusuna eklenen pay (yerel px) — düğümler çerçeveye yapışmasın.
var VE_TOPO_MINI_PAD = 26;

// ── Genel ayar ──────────────────────────────────────────────────────────────
function veModuleViewSetting() {
  var v = null;
  try { v = localStorage.getItem(VE_MODULE_VIEW_KEY); } catch(e) {}
  return (VE_MODULE_VIEW_MODES.indexOf(v) >= 0) ? v : VE_MODULE_VIEW_DEFAULT;
}

// Ayarı yaz + ekrandaki her modül düğümünü yeni biçime geçir.
// Dönen değer: uygulanan mod (geçersiz girdi varsayılana düşer).
function veSetModuleViewSetting(mode) {
  var m = (VE_MODULE_VIEW_MODES.indexOf(mode) >= 0) ? mode : VE_MODULE_VIEW_DEFAULT;
  try { localStorage.setItem(VE_MODULE_VIEW_KEY, m); } catch(e) {}
  // Yeni kayıtların varsayılan ölçüsü de moda göre değişir (createNode,
  // veBoundaryBox hep componentDefs'ten okuyor — tek atama yeter).
  if(typeof veApplyModuleViewSizes === 'function') veApplyModuleViewSizes();
  if(typeof veRefreshModuleCards === 'function') veRefreshModuleCards();
  return m;
}

// ── Biçim çözümü (üç katman) ────────────────────────────────────────────────
// opts.mode / opts.zoom testte (ve dışa aktarmada) enjekte edilebilir.
function veModuleLayoutFor(node, opts) {
  opts = opts || {};
  var ov = (node && node.data) ? node.data.mapOpen : undefined;
  if(ov === true)  return 'map';    // düğümün kendi tercihi her şeyi yener
  if(ov === false) return 'card';

  var mode = opts.mode || veModuleViewSetting();
  if(mode === 'card') return 'card';
  if(mode === 'map')  return 'map';

  var z = (typeof opts.zoom === 'number' && isFinite(opts.zoom)) ? opts.zoom
        : ((typeof canvasZoom !== 'undefined' && isFinite(canvasZoom)) ? canvasZoom : 1);
  return (z >= VE_MODULE_ZOOM_THRESHOLD) ? 'map' : 'card';
}

// 'zoom' modunda kamera eşiği geçtiğinde kartları YENİDEN kur. Her karede
// çalışır (updateCanvasTransform), bu yüzden biçim değişmedikçe hiçbir şey
// yapmaz — yoksa pan/zoom sırasında 3 modülün haritası her karede yeniden
// çizilirdi.
var _veModuleZoomLayout = null;
function veSyncModuleZoomLayout() {
  if(veModuleViewSetting() !== 'zoom') { _veModuleZoomLayout = null; return false; }
  var now = veModuleLayoutFor(null);
  if(now === _veModuleZoomLayout) return false;
  _veModuleZoomLayout = now;
  if(typeof veRefreshModuleCards === 'function') veRefreshModuleCards();
  return true;
}

// ── SAF: harita için içerik sınır kutusu ────────────────────────────────────
// Ölçüsü kaydedilmemiş düğümde tipin varsayılanı kullanılır (components.js
// veNodeDefaultSize) — sabit 65 yazılsaydı sensörün sağında hayalet boşluk
// açılırdı. Çizilecek düğüm yoksa null.
function veTopoMiniBox(nodeList, pad) {
  var p = (typeof pad === 'number' && isFinite(pad)) ? pad : VE_TOPO_MINI_PAD;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, seen = 0;
  (nodeList || []).forEach(function(n) {
    if(!n || !isFinite(n.x) || !isFinite(n.y)) return;
    var ds = (typeof veNodeDefaultSize === 'function') ? veNodeDefaultSize(n.type) : { w: 65, h: 60 };
    var w = isFinite(n.width) ? n.width : ds.w;
    var h = isFinite(n.height) ? n.height : ds.h;
    if(n.x < minX) minX = n.x;
    if(n.y < minY) minY = n.y;
    if(n.x + w > maxX) maxX = n.x + w;
    if(n.y + h > maxY) maxY = n.y + h;
    seen++;
  });
  if(!seen) return null;
  return { x: minX - p, y: minY - p, w: (maxX - minX) + p * 2, h: (maxY - minY) + p * 2 };
}

// Portun yerel konumu — components.js'teki TEK kaynaktan (vePortOffset).
// Bağlantı ucu ile port dairesi ana kanvasta aynı noktadan okunuyor; harita da
// aynı yerden okumazsa eğriler düğümlerin kenarından kayardı.
function _veMiniPortPos(node, portType) {
  if(typeof vePortOffset === 'function') {
    var o = vePortOffset(node, portType);
    return { x: node.x + o.dx, y: node.y + o.dy, side: o.side };
  }
  var w = node.width || 65, h = node.height || 60;
  var isInput = String(portType || '').indexOf('input') === 0;
  return isInput ? { x: node.x, y: node.y + h / 2, side: 'left' }
                 : { x: node.x + w, y: node.y + h / 2, side: 'right' };
}

function _veMiniEsc(s) {
  return ('' + (s == null ? '' : s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// def.svg'nin GÖVDESİ (dış <svg> kabuğu olmadan) + viewBox'ı.
function _veMiniSymbol(def) {
  if(!def || !def.svg) return null;
  var vb = def.svg.match(/viewBox="([^"]+)"/);
  return {
    vb: vb ? vb[1] : '0 0 100 100',
    body: def.svg.replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  };
}

// ── SAF: durumdan mini harita SVG'si ────────────────────────────────────────
// Dönen değer TAM bir <svg …> dizesidir; çizilecek düğüm yoksa ''.
// opts:
//   pad        — içerik payı (yerel px)
//   x/y/w/h    — dış SVG'nin içine YERLEŞTİRME (dışa aktarma yolu); yoksa %100
//   labels     — düğüm adlarını da yaz (yalnız 1:1'e yakın ölçekte okunur)
//   className  — kök <svg> sınıfı
//
// ÇİZGİ KALINLIĞI ÖLÇEKLENMEZ (vector-effect="non-scaling-stroke"): harita 0,29
// ölçekte çiziliyor; 1,5 px'lik bağlantı çizgisi 0,4 px'e inip kaybolurdu.
function veTopoMiniSVG(nodeList, connList, opts) {
  opts = opts || {};
  var box = veTopoMiniBox(nodeList, opts.pad);
  if(!box) return '';

  var nodesIn = (nodeList || []).filter(function(n) { return n && isFinite(n.x) && isFinite(n.y); });
  var defs = (typeof componentDefs !== 'undefined') ? componentDefs : {};
  var p = [];

  var place = '';
  if(isFinite(opts.x) && isFinite(opts.y) && isFinite(opts.w) && isFinite(opts.h)) {
    place = ' x="' + opts.x + '" y="' + opts.y + '" width="' + opts.w + '" height="' + opts.h + '"';
  }
  p.push('<svg xmlns="http://www.w3.org/2000/svg"' + place +
         (opts.className ? ' class="' + opts.className + '"' : '') +
         ' viewBox="' + box.x + ' ' + box.y + ' ' + box.w + ' ' + box.h + '"' +
         ' preserveAspectRatio="xMidYMid meet" aria-hidden="true">');

  // Bağlantılar — ana kanvasla AYNI kural (js/connections.js): conn.lineType
  // 'straight' / 'stepped' / 'curve'. Burası eskiden lineType'ı HİÇ okumuyor,
  // her teli bezier çiziyordu; dik açılı kurulmuş bir topoloji modül kartında
  // ve dışa aktarılan PNG/SVG'de eğri görünüyordu (ekran ile çıktı ayrışması).
  p.push('<g fill="none" stroke="var(--text-muted, #75849d)" stroke-width="1.5" ' +
         'stroke-linecap="round" vector-effect="non-scaling-stroke">');
  (connList || []).forEach(function(c) {
    if(!c) return;
    var f = null, t = null;
    for(var i = 0; i < nodesIn.length; i++) {
      if(nodesIn[i].id === c.from) f = nodesIn[i];
      if(nodesIn[i].id === c.to)   t = nodesIn[i];
    }
    if(!f || !t) return;
    var fp = _veMiniPortPos(f, c.fromPort || 'output');
    var tp = _veMiniPortPos(t, c.toPort || 'input');
    var lt = c.lineType || 'curve', d;
    if(lt === 'straight') {
      d = 'M ' + fp.x + ' ' + fp.y + ' L ' + tp.x + ' ' + tp.y;
    } else if(lt === 'stepped') {
      var mx = (fp.x + tp.x) / 2;
      d = 'M ' + fp.x + ' ' + fp.y + ' L ' + mx + ' ' + fp.y +
          ' L ' + mx + ' ' + tp.y + ' L ' + tp.x + ' ' + tp.y;
    } else {
      var off = 40;
      var c1 = (fp.side === 'left') ? fp.x - off : fp.x + off;
      var c2 = (tp.side === 'left') ? tp.x - off : tp.x + off;
      d = 'M ' + fp.x + ' ' + fp.y + ' C ' + c1 + ' ' + fp.y + ', ' +
          c2 + ' ' + tp.y + ', ' + tp.x + ' ' + tp.y;
    }
    p.push('<path d="' + d + '"/>');
  });
  p.push('</g>');

  // Düğümler — kutu + tipin KENDİ sembolü (componentDefs, ikinci kopya yok)
  nodesIn.forEach(function(n) {
    var def = defs[n.type] || {};
    var ds = (typeof veNodeDefaultSize === 'function') ? veNodeDefaultSize(n.type) : { w: 65, h: 60 };
    var w = isFinite(n.width) ? n.width : ds.w;
    var h = isFinite(n.height) ? n.height : ds.h;
    p.push('<g><rect x="' + n.x + '" y="' + n.y + '" width="' + w + '" height="' + h +
           '" rx="4" fill="var(--bg-secondary, #0f1218)" stroke="var(--border-hover, #2d3a4f)" ' +
           'stroke-width="1.2" vector-effect="non-scaling-stroke"/>');
    var sym = _veMiniSymbol(def);
    if(sym) {
      var s = Math.min(w, h) * 0.66;
      p.push('<svg x="' + (n.x + (w - s) / 2) + '" y="' + (n.y + (h - s) / 2) + '" width="' + s +
             '" height="' + s + '" viewBox="' + sym.vb + '" overflow="visible">' + sym.body + '</svg>');
    }
    p.push('</g>');
    if(opts.labels) {
      var nm = n.customName || def.name || n.type;
      if(nm.length > 18) nm = nm.slice(0, 17) + '…';
      // Ad konumu node.data.labelPos'tan (components.js veNodeLabelAnchor).
      var la = (typeof veNodeLabelAnchor === 'function')
        ? veNodeLabelAnchor(n, w, h, 13)
        : { x: n.x + w / 2, y: n.y + h + 13, anchor: 'middle' };
      p.push('<text x="' + la.x + '" y="' + la.y + '" text-anchor="' + la.anchor + '" ' +
             'font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" font-size="10.5" ' +
             'font-weight="600" fill="var(--text-secondary, #98a0b0)">' + _veMiniEsc(nm) + '</text>');
    }
  });

  p.push('</svg>');
  return p.join('');
}

// Bir MODÜL DÜĞÜMÜNÜN haritası: alt topolojisini çizer, yoksa '' döner.
function veModuleMapSVG(node, opts) {
  var sub = (node && node.data) ? node.data.subTopology : null;
  if(!sub || !sub.nodes || !sub.nodes.length) return '';
  return veTopoMiniSVG(sub.nodes, sub.connections || [], opts);
}
