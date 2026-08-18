// ═══════════════════════════════════════════════════════════════════════════
// MFSim Topoloji Dışa Aktarma — PNG / SVG
// ───────────────────────────────────────────────────────────────────────────
// Mevcut topolojiyi bağımsız (self-contained) bir SVG olarak yeniden kurar:
//   • Bağlantı yolları CANLI #ve-connections-layer'dan KLONLANIR — path 'd'
//     koordinatları canvas-local (node.x/y ile aynı uzay), birebir sadık.
//   • Düğümler kutu + sembol (def.svg) + etiket olarak çizilir; kutu renkleri
//     canlı .ve-node-box'tan getComputedStyle ile okunur (tema + tip rengi).
//   • def.svg sembolleri var(--x, yedek) renk kullanır → bağımsız SVG'de yedek
//     renkler devreye girer, stil sayfası gerekmez.
// PNG: SVG bir Image'e yüklenip 2× ölçekte canvas'a çizilir (foreignObject yok
// → canvas taint olmaz) ve toBlob ile indirilir.
// ═══════════════════════════════════════════════════════════════════════════

function _veExpCssVar(name, fb) {
  try { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; }
  catch(e) { return fb; }
}
function _veExpEsc(s) {
  return ('' + (s == null ? '' : s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Topolojiden bağımsız bir SVG string üretir (yoksa null).
function veBuildTopologySVG() {
  if(typeof nodes === 'undefined' || !nodes || nodes.length === 0) return null;

  // ── İçerik sınır kutusu ──
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(function(n) {
    var w = n.width || 65, h = n.height || 60;
    if(n.x < minX) minX = n.x;
    if(n.y < minY) minY = n.y;
    if(n.x + w > maxX) maxX = n.x + w;
    if(n.y + h > maxY) maxY = n.y + h;
  });
  if(!isFinite(minX)) return null;
  var LABEL_PAD = 22, M = 56;                 // etiket + kenar boşluğu
  minX -= M; minY -= M; maxX += M; maxY += M + LABEL_PAD;
  var W = Math.max(1, Math.round(maxX - minX)), H = Math.max(1, Math.round(maxY - minY));

  var bg      = _veExpCssVar('--bg-primary', '#0e1626');
  var accent  = _veExpCssVar('--accent-primary', '#3b82f6');
  var labelCol= _veExpCssVar('--text-secondary', '#9fb0c8');
  var boxBgFb = _veExpCssVar('--bg-secondary', '#141d30');
  var boxBdFb = _veExpCssVar('--border-color', '#2a3a54');

  var parts = [];
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
             '" viewBox="' + minX + ' ' + minY + ' ' + W + ' ' + H + '">');
  parts.push('<rect x="' + minX + '" y="' + minY + '" width="' + W + '" height="' + H + '" fill="' + bg + '"/>');

  // ── Bağlantılar (canlı katmandan klonla) ──
  var layer = document.getElementById('ve-connections-layer');
  if(layer) {
    var paths = layer.querySelectorAll('path');
    parts.push('<g fill="none" stroke-linecap="round" stroke-linejoin="round">');
    for(var i = 0; i < paths.length; i++) {
      var pth = paths[i];
      var cls = pth.getAttribute('class') || '';
      if(cls.indexOf('temp') > -1) continue;                 // geçici çizim değil
      var d = pth.getAttribute('d');
      if(!d) continue;
      var stroke = accent, sw = '2';
      try {
        var cs = getComputedStyle(pth);
        if(cs.stroke && cs.stroke !== 'none') stroke = cs.stroke;
        if(cs.strokeWidth) sw = parseFloat(cs.strokeWidth) || 2;
      } catch(e) {}
      parts.push('<path d="' + _veExpEsc(d) + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>');
    }
    parts.push('</g>');
  }

  // ── Düğümler (kutu + sembol + etiket) ──
  var parser = (typeof DOMParser !== 'undefined') ? new DOMParser() : null;
  nodes.forEach(function(n) {
    var w = n.width || 65, h = n.height || 60;
    var def = (typeof componentDefs !== 'undefined' && componentDefs[n.type]) ? componentDefs[n.type] : (n.def || {});
    var boxBg = boxBgFb, boxBd = accent;
    var el = document.getElementById(n.id);
    var boxEl = el ? el.querySelector('.ve-node-box') : null;
    if(boxEl) {
      try {
        var s = getComputedStyle(boxEl);
        if(s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') boxBg = s.backgroundColor;
        if(s.borderTopColor) boxBd = s.borderTopColor;
      } catch(e) {}
    }
    var name = n.customName || (def && def.name) || n.type;
    // Alt-sistem (modül) düğümü ekranda KART olarak duruyor: ad ve içerik özeti
    // kutunun İÇİNDE. Dışa aktarma bunu bilmezse aynı topoloji ekranda kart,
    // PNG'de "içi boş geniş kutu + altında ad" çıkardı — aynı belgenin iki
    // farklı hâli. Yerleşim tek kaynaktan: js/components.js modül kartı.
    var _modul = (typeof veIsModuleNode === 'function') && veIsModuleNode(n);
    // FEAD kasnağı ekranda DAİRE, kutu değil — çapı veri (1 px = 1 mm), çeper
    // dokusu temas tarafı (kesikli = kayış sırttan değiyor). Dışa aktarma bunu
    // bilmezse aynı topoloji ekranda kasnak sistemi, PNG'de kutular çıkardı:
    // node.data.labelPos ile yaşanan hatanın aynı sınıfı (bkz.
    // tests/unit/node-label-anchor.test.js). Biçim kararı tek yerden:
    // js/fead-graph.js + css .ve-node--fead-pulley.
    var _kasnak = (typeof _feadIsPulley === 'function') && _feadIsPulley(n);
    var _rx = _kasnak ? (w / 2) : 6, _ry = _kasnak ? (h / 2) : 6;
    var _dash = (_kasnak && typeof veFeadContactOf === 'function'
                 && veFeadContactOf(n) === 'back') ? ' stroke-dasharray="5 4"' : '';
    parts.push('<g>');
    parts.push('<rect x="' + n.x + '" y="' + n.y + '" width="' + w + '" height="' + h +
               '" rx="' + _rx + '" ry="' + _ry + '" fill="' + boxBg + '" stroke="' + boxBd +
               '" stroke-width="1.5"' + _dash + '/>');
    // Sembol (nested svg): modülde sola yaslı, diğerlerinde ortalanmış.
    // Kasnakta ekrandaki oranla AYNI (%46) — %72 dairenin jant halkasını aşardı.
    var symSize = _modul ? 30 : Math.min(w, h) * (_kasnak ? 0.46 : 0.72);
    if(def.svg && parser) {
      try {
        var doc = parser.parseFromString(def.svg, 'image/svg+xml');
        var src = doc.documentElement;
        if(src && src.nodeName.toLowerCase() === 'svg') {
          var vb = src.getAttribute('viewBox') || '0 0 100 100';
          var sx = _modul ? (n.x + 15) : (n.x + (w - symSize) / 2);
          var sy = n.y + (h - symSize) / 2;
          parts.push('<svg x="' + sx + '" y="' + sy + '" width="' + symSize + '" height="' + symSize +
                     '" viewBox="' + vb + '" overflow="visible">' + src.innerHTML + '</svg>');
        }
      } catch(e) {}
    }
    if(_modul) {
      // Sol şerit + ad + canlı özet — ekrandaki kartla aynı sıra
      parts.push('<rect x="' + (n.x + 4) + '" y="' + (n.y + 4) + '" width="4" height="' + (h - 8) +
                 '" fill="' + accent + '"/>');
      var tx = n.x + 15 + symSize + 8;
      parts.push('<text x="' + tx + '" y="' + (n.y + h / 2 - 2) + '" ' +
                 'font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" font-size="12" font-weight="600" ' +
                 'fill="' + labelCol + '">' + _veExpEsc(name) + '</text>');
      parts.push('<text x="' + tx + '" y="' + (n.y + h / 2 + 12) + '" ' +
                 'font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" font-size="10" ' +
                 'fill="' + labelCol + '" opacity="0.7">' +
                 _veExpEsc(typeof veModuleSummaryText === 'function' ? veModuleSummaryText(n) : '') + '</text>');
      parts.push('</g>');
      return;   // etiket kutunun İÇİNDE — altına ikinci kez yazılmaz
    }
    parts.push('</g>');
    // Etiket — konumu node.data.labelPos'tan (components.js veNodeLabelAnchor,
    // ekrandaki .lbl-* kuralıyla AYNI). Sabit "kutunun altında" idi; ekranda
    // üste alınmış bir ad çıktıda yine altta kalıyordu.
    var _la = (typeof veNodeLabelAnchor === 'function')
      ? veNodeLabelAnchor(n, w, h, 14)
      : { x: n.x + w / 2, y: n.y + h + 14, anchor: 'middle' };
    parts.push('<text x="' + _la.x + '" y="' + _la.y + '" text-anchor="' + _la.anchor + '" ' +
               'font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" font-size="11" font-weight="600" ' +
               'fill="' + labelCol + '">' + _veExpEsc(name) + '</text>');
  });

  parts.push('</svg>');
  return parts.join('');
}

// SVG string → PNG blob (2× ölçek, retina-net). cb(blob|null).
function veRasterizeSVG(svgStr, scale, cb) {
  scale = scale || 2;
  var img = new Image();
  var blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  var url = (typeof URL !== 'undefined' && URL.createObjectURL) ? URL.createObjectURL(blob) : null;
  if(!url) { cb(null); return; }
  img.onload = function() {
    try {
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(iw * scale));
      canvas.height = Math.max(1, Math.round(ih * scale));
      var ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      if(canvas.toBlob) canvas.toBlob(function(b) { cb(b); }, 'image/png');
      else cb(null);
    } catch(e) { try { URL.revokeObjectURL(url); } catch(_){} cb(null); }
  };
  img.onerror = function() { try { URL.revokeObjectURL(url); } catch(e){} cb(null); };
  img.src = url;
}

// Dışa aktar: format 'png' | 'svg'.
function veExportTopology(format) {
  format = (format || 'png').toString().toLowerCase();
  if(typeof nodes === 'undefined' || !nodes || nodes.length === 0) {
    if(typeof showToast === 'function') showToast('Dışa aktarılacak bileşen yok', 'warning');
    return;
  }
  var svgStr = veBuildTopologySVG();
  if(!svgStr) { if(typeof showToast === 'function') showToast('Dışa aktarma başarısız', 'error'); return; }

  var base = (typeof veProjectName !== 'undefined' && veProjectName) ? veProjectName : 'mfsim-topoloji';

  if(format === 'svg') {
    var svgBlob = new Blob([svgStr], { type: 'image/svg+xml' });
    if(typeof veShowSaveDialog === 'function') veShowSaveDialog(base + '.svg', svgBlob, 'SVG olarak dışa aktarıldı');
    return;
  }
  // PNG
  veRasterizeSVG(svgStr, 2, function(blob) {
    if(!blob) { if(typeof showToast === 'function') showToast('PNG oluşturulamadı', 'error'); return; }
    if(typeof veShowSaveDialog === 'function') veShowSaveDialog(base + '.png', blob, 'PNG olarak dışa aktarıldı');
  });
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veBuildTopologySVG: veBuildTopologySVG, veRasterizeSVG: veRasterizeSVG, veExportTopology: veExportTopology };
}
