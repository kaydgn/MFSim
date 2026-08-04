// ═══════════════════════════════════════════════════════════════════════════
// MFSim Komut Paleti — Ctrl/⌘+K ile aranabilir eylem menüsü (Linear/VSCode tarzı)
// ───────────────────────────────────────────────────────────────────────────
// Tüm sık eylemleri tek bir aranabilir yerde toplar: görünüm (sığdır/zoom/grid/
// minimap), düzen (geri/ileri al), dosya (kaydet/aç/yeni), çözücü, paneller ve
// aktif modülün sidebar'ından türetilen "Ekle: <bileşen>" komutları.
//
// Kendi DOM'unu kurar (index.html'e yalnızca script + isteğe bağlı toolbar
// düğmesi eklenir). Yalnızca mevcut global fonksiyonlara bağlanır; her komut
// typeof-guard'lı çalışır, eksik fonksiyon sessizce yok sayılır. Türkçe
// diyakritik-duyarsız arama ("sigdir" → "Sığdır", "motor" → "Motor Ekle").
// ═══════════════════════════════════════════════════════════════════════════

var _cmdkBuilt = false;
var _cmdkItems = [];       // filtrelenmiş görünür komutlar
var _cmdkSel = 0;          // seçili index (filtrelenmiş listede)
var _cmdkAll = [];         // tüm komutlar (açılışta yeniden kurulur)
var _cmdkCloseTimer = null;// bekleyen kapanış (hidden) zamanlayıcısı

// ── Türkçe diyakritik-duyarsız normalize ──
function veCmdkNorm(s) {
  s = (s == null) ? '' : ('' + s);
  try { s = s.toLocaleLowerCase('tr'); } catch(e) { s = s.toLowerCase(); }
  return s.replace(/ı/g,'i').replace(/İ/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g')
          .replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c').replace(/â/g,'a').replace(/î/g,'i').replace(/û/g,'u');
}

// ── İkon yardımcıları ──
function _cmdkIco(name) { return '<span class="mf-ico mf-ico-' + name + '"></span>'; }
var _CMDK_SVG = {
  fit:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  map:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
  check:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  panel:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  tidy: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="4" width="6" height="6" rx="1"/><rect x="9" y="14" width="6" height="6" rx="1"/><path d="M6 10v2a2 2 0 0 0 2 2h4M18 10v2a2 2 0 0 1-2 2h-4"/></svg>',
  kbd: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="10"/><line x1="10" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="14" y2="10"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>'
};
function _cmdkSvg(k) { return _CMDK_SVG[k] || _CMDK_SVG.plus; }

// Bir fonksiyonu güvenle çağır (yoksa uyarı ver, patlamadan).
function _cmdkCall(fnName, arg) {
  var fn = (typeof window !== 'undefined') ? window[fnName] : undefined;
  if(typeof fn !== 'function' && typeof eval !== 'undefined') {
    try { fn = eval(fnName); } catch(e) { fn = undefined; }
  }
  if(typeof fn === 'function') { try { fn(arg); } catch(e) { console.warn('[cmdk] ' + fnName + ' hata:', e); } return true; }
  if(typeof showToast === 'function') showToast('Bu eylem şu an kullanılamıyor', 'warning');
  return false;
}

// Görünüm merkezinin canvas-local koordinatı (ekran → canvas ters eşleme).
function _cmdkViewCenter() {
  var wrap = document.getElementById('ve-canvas-wrapper');
  var W = wrap ? wrap.clientWidth : 1200, H = wrap ? wrap.clientHeight : 700;
  var zoom = (typeof canvasZoom !== 'undefined' && canvasZoom > 0) ? canvasZoom : 1;
  var ox = (typeof canvasOffset !== 'undefined') ? canvasOffset.x : 0;
  var oy = (typeof canvasOffset !== 'undefined') ? canvasOffset.y : 0;
  return { x: (W/2 - ox)/zoom + 3000, y: (H/2 - oy)/zoom + 3000 };
}

// ── Statik komut listesi ──
function _cmdkStaticCommands() {
  return [
    // Görünüm
    { sec:'Görünüm', label:'İçeriğe sığdır',            kw:'fit zoom orta ortala göster tümü', icon:_cmdkSvg('fit'),        run:function(){ _cmdkCall('veFitViewToContent', {maxZoom:2}); } },
    { sec:'Düzen',   label:'Otomatik düzenle',          kw:'tidy düzen layout hizala otomatik temizle dağınık', icon:_cmdkSvg('tidy'), run:function(){ _cmdkCall('veTidyLayout'); } },
    { sec:'Görünüm', label:'Yakınlaştır',               kw:'zoom in büyüt',                     icon:_cmdkIco('zoom-in'),    run:function(){ _cmdkCall('veZoomIn'); } },
    { sec:'Görünüm', label:'Uzaklaştır',                kw:'zoom out küçült',                   icon:_cmdkIco('zoom-out'),   run:function(){ _cmdkCall('veZoomOut'); } },
    { sec:'Görünüm', label:'Yakınlaştırmayı %100 yap',  kw:'zoom reset sıfırla yüzde',          icon:_cmdkIco('crosshair'),  run:function(){ _cmdkCall('veResetZoom'); } },
    { sec:'Görünüm', label:'Görünümü sıfırla',          kw:'reset view merkez',                 icon:_cmdkIco('crosshair'),  run:function(){ _cmdkCall('veResetView'); } },
    { sec:'Görünüm', label:'Grid göster / gizle',       kw:'ızgara grid toggle',                icon:_cmdkIco('grid'),       run:function(){ _cmdkCall('veToggleGrid'); } },
    { sec:'Görünüm', label:'Grid yoğunluğu',            kw:'ızgara grid density sıklık',        icon:_cmdkIco('grid'),       run:function(){ _cmdkCall('veCycleGridDensity'); } },
    { sec:'Görünüm', label:'Hizalama (snap)',           kw:'snap hizala align',                 icon:_cmdkIco('ruler'),      run:function(){ _cmdkCall('veToggleSnap'); } },
    { sec:'Görünüm', label:'Güç akışı animasyonu',      kw:'flow akış animasyon enerji',        icon:_cmdkIco('zap'),        run:function(){ _cmdkCall('veToggleFlow'); } },
    { sec:'Görünüm', label:'Minimap göster / gizle',    kw:'minimap genel görünüm harita',      icon:_cmdkSvg('map'),        run:function(){ _cmdkCall('veMinimapToggle'); } },
    // Düzen
    { sec:'Düzen',   label:'Geri al',                   kw:'undo geri ctrl z',                  icon:_cmdkIco('undo'),       run:function(){ _cmdkCall('veUndo'); } },
    { sec:'Düzen',   label:'İleri al',                  kw:'redo ileri ctrl y',                 icon:_cmdkIco('redo'),       run:function(){ _cmdkCall('veRedo'); } },
    // Dosya
    { sec:'Dosya',   label:'Projeyi kaydet',            kw:'kaydet save dosya indir',           icon:_cmdkIco('save'),       run:function(){ _cmdkCall('veSaveTopology'); } },
    { sec:'Dosya',   label:'Proje aç',                  kw:'aç yükle load dosya open',          icon:_cmdkIco('folder-open'),run:function(){ _cmdkCall('veLoadTopology'); } },
    { sec:'Dosya',   label:'Ölçüm verisi içe aktar',    kw:'excel csv import içe aktar ölçüm canoe vector sütun grafik xlsx', icon:_cmdkIco('upload'), run:function(){ _cmdkCall('veImpOpenPicker'); } },
    { sec:'Dosya',   label:'Yeni proje',                kw:'yeni new temiz',                    icon:_cmdkIco('file-plus'),  run:function(){ _cmdkCall('veNewProject'); } },
    { sec:'Dosya',   label:'PNG olarak dışa aktar',      kw:'export dışa aktar png görüntü resim indir', icon:_cmdkIco('download'), run:function(){ _cmdkCall('veExportTopology', 'png'); } },
    { sec:'Dosya',   label:'SVG olarak dışa aktar',      kw:'export dışa aktar svg vektör indir', icon:_cmdkIco('download'), run:function(){ _cmdkCall('veExportTopology', 'svg'); } },
    { sec:'Dosya',   label:'Tümünü temizle',            kw:'temizle sil clear hepsi',           icon:_cmdkIco('trash'),      run:function(){ _cmdkCall('veClearAll'); } },
    // Çözücü
    { sec:'Çözücü',  label:'Çözümü doğrula',            kw:'doğrula validate kontrol çözücü',   icon:_cmdkSvg('check'),      run:function(){ _cmdkCall('veSolverValidate'); } },
    { sec:'Çözücü',  label:'Çözücüyü aç',               kw:'çalıştır run simüle çözücü solve aç',  icon:_cmdkIco('play'),    run:function(){ _cmdkCall('veSolverRun'); } },
    // Paneller
    { sec:'Panel',   label:'Ayarlar',                   kw:'ayarlar settings tema',             icon:_cmdkIco('settings'),   run:function(){ _cmdkCall('veOpenSettings'); } },
    { sec:'Panel',   label:'Program durumu',            kw:'durum status bilgi versiyon',       icon:_cmdkSvg('info'),       run:function(){ _cmdkCall('veOpenStatusModal'); } },
    { sec:'Panel',   label:'Uyarılar panelini aç / kapa', kw:'uyarı warning hata',              icon:_cmdkIco('alert-triangle'), run:function(){ _cmdkCall('veToggleWarnings'); } },
    { sec:'Panel',   label:'Kenar çubuğu (sidebar)',    kw:'sidebar kenar çubuğu bileşen',      icon:_cmdkSvg('panel'),      run:function(){ _cmdkCall('veToggleSidebar'); } },
    { sec:'Panel',   label:'Özellikler paneli',         kw:'özellik properties panel',          icon:_cmdkIco('sliders'),    run:function(){ _cmdkCall('veTogglePropertiesPanel'); } },
    { sec:'Panel',   label:'Rapor',                     kw:'rapor report pdf',                  icon:_cmdkIco('file-text'),  run:function(){ _cmdkCall('veShowRaporModal'); } },
    { sec:'Genel',   label:'Klavye kısayolları',        kw:'klavye kısayol shortcut yardım help tuş', icon:_cmdkSvg('kbd'), run:function(){ _cmdkCall('veShortcutsHelpOpen'); } },
    { sec:'Genel',   label:'Çıkış yap',                 kw:'çıkış logout oturum kapat exit',    icon:_cmdkIco('log-out'),    run:function(){ _cmdkCall('mfsimLogout'); } }
  ];
}

// Aktif modülün sidebar'ından "Ekle: <bileşen>" komutları türet (bağlama duyarlı).
function _cmdkAddCommands() {
  var out = [];
  var seen = {};
  var comps = document.querySelectorAll('.ve-component[data-type]');
  for(var i = 0; i < comps.length; i++) {
    var el = comps[i];
    if(el.offsetParent === null) continue;            // gizli (başka modül) → atla
    var type = el.getAttribute('data-type');
    if(!type || seen[type]) continue;
    if(typeof componentDefs !== 'undefined' && !componentDefs[type]) continue; // createNode için gerekli
    var lblEl = el.querySelector('.ve-comp-label');
    var name = lblEl ? lblEl.textContent.trim() : type;
    if(!name) continue;
    seen[type] = 1;
    (function(t, n) {
      out.push({
        sec:'Ekle', label:'Ekle: ' + n, kw:'ekle add bileşen ' + n + ' ' + t,
        icon:_cmdkSvg('plus'),
        run:function() {
          if(typeof createNode !== 'function') { if(typeof showToast==='function') showToast('Bileşen eklenemedi', 'warning'); return; }
          var c = _cmdkViewCenter();
          createNode(t, c.x - 32, c.y - 30);
          if(typeof showToast === 'function') showToast(n + ' eklendi', 'success');
        }
      });
    })(type, name);
  }
  return out;
}

function _cmdkBuildDom() {
  if(_cmdkBuilt) return;
  var ov = document.createElement('div');
  ov.className = 've-cmdk-overlay';
  ov.id = 've-cmdk';
  ov.setAttribute('hidden', '');
  ov.innerHTML =
    '<div class="ve-cmdk-panel" role="dialog" aria-modal="true" aria-label="Komut paleti">' +
      '<div class="ve-cmdk-search">' +
        '<span class="mf-ico mf-ico-search ve-cmdk-search-ico"></span>' +
        '<input type="text" id="ve-cmdk-input" role="combobox" aria-controls="ve-cmdk-list" aria-expanded="true" ' +
               'placeholder="Komut ara…  (örn. sığdır, kaydet, motor ekle)" autocomplete="off" spellcheck="false" aria-label="Komut ara">' +
        '<kbd class="ve-cmdk-kbd">ESC</kbd>' +
      '</div>' +
      '<div class="ve-cmdk-list" id="ve-cmdk-list" role="listbox" aria-label="Komutlar"></div>' +
      '<div class="ve-cmdk-foot">' +
        '<span><kbd>↑</kbd><kbd>↓</kbd> gezin</span>' +
        '<span><kbd>↵</kbd> çalıştır</span>' +
        '<span><kbd>esc</kbd> kapat</span>' +
        '<span class="ve-cmdk-foot-grow"></span>' +
        '<span class="ve-cmdk-brand">MFSim</span>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);

  // Overlay boşluğa tık → kapat
  ov.addEventListener('mousedown', function(e) { if(e.target === ov) veCmdkClose(); });

  var input = document.getElementById('ve-cmdk-input');
  input.addEventListener('input', function() { _cmdkFilter(input.value); });
  input.addEventListener('keydown', function(e) {
    if(e.key === 'ArrowDown') { e.preventDefault(); _cmdkMove(1); }
    else if(e.key === 'ArrowUp') { e.preventDefault(); _cmdkMove(-1); }
    else if(e.key === 'Enter') { e.preventDefault(); _cmdkRunSelected(); }
    else if(e.key === 'Escape') { e.preventDefault(); veCmdkClose(); }
    else if(e.key === 'Home') { e.preventDefault(); _cmdkSel = 0; _cmdkHighlight(); }
    else if(e.key === 'End') { e.preventDefault(); _cmdkSel = _cmdkItems.length - 1; _cmdkHighlight(); }
  });

  _cmdkBuilt = true;
}

function _cmdkRender() {
  var list = document.getElementById('ve-cmdk-list');
  if(!list) return;
  if(_cmdkItems.length === 0) {
    list.innerHTML = '<div class="ve-cmdk-empty">Eşleşen komut yok</div>';
    return;
  }
  var html = '';
  for(var i = 0; i < _cmdkItems.length; i++) {
    var c = _cmdkItems[i];
    html += '<div class="ve-cmdk-item' + (i === _cmdkSel ? ' active' : '') + '" role="option" data-idx="' + i + '"' +
            (i === _cmdkSel ? ' aria-selected="true"' : '') + '>' +
              '<span class="ve-cmdk-ico">' + c.icon + '</span>' +
              '<span class="ve-cmdk-label">' + _cmdkEsc(c.label) + '</span>' +
              '<span class="ve-cmdk-sec">' + _cmdkEsc(c.sec) + '</span>' +
            '</div>';
  }
  list.innerHTML = html;
  // fare etkileşimi
  var items = list.querySelectorAll('.ve-cmdk-item');
  for(var j = 0; j < items.length; j++) {
    (function(el) {
      var idx = parseInt(el.getAttribute('data-idx'), 10);
      el.addEventListener('mousemove', function() { if(_cmdkSel !== idx) { _cmdkSel = idx; _cmdkHighlight(); } });
      el.addEventListener('click', function() { _cmdkSel = idx; _cmdkRunSelected(); });
    })(items[j]);
  }
}

function _cmdkEsc(s) {
  return ('' + s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _cmdkHighlight() {
  var list = document.getElementById('ve-cmdk-list');
  if(!list) return;
  var items = list.querySelectorAll('.ve-cmdk-item');
  for(var i = 0; i < items.length; i++) {
    var on = (i === _cmdkSel);
    items[i].classList.toggle('active', on);
    if(on) { items[i].setAttribute('aria-selected', 'true'); items[i].scrollIntoView({ block:'nearest' }); }
    else items[i].removeAttribute('aria-selected');
  }
}

function _cmdkMove(delta) {
  if(_cmdkItems.length === 0) return;
  _cmdkSel = (_cmdkSel + delta + _cmdkItems.length) % _cmdkItems.length;
  _cmdkHighlight();
}

function _cmdkFilter(q) {
  var nq = veCmdkNorm(q).trim();
  if(!nq) {
    _cmdkItems = _cmdkAll.slice();
  } else {
    var tokens = nq.split(/\s+/).filter(Boolean);
    var scored = [];
    for(var i = 0; i < _cmdkAll.length; i++) {
      var c = _cmdkAll[i];
      var hay = c._norm;
      var ok = true, score = 0;
      for(var t = 0; t < tokens.length; t++) {
        var idx = hay.indexOf(tokens[t]);
        if(idx < 0) { ok = false; break; }
        score += (idx === 0) ? 3 : (hay.charAt(idx - 1) === ' ' ? 2 : 1);
      }
      if(!ok) continue;
      if(c._normLabel.indexOf(nq) === 0) score += 6;       // etiket baştan eşleşme
      else if(c._normLabel.indexOf(nq) >= 0) score += 2;
      scored.push({ c:c, s:score, i:i });
    }
    scored.sort(function(a, b) { return (b.s - a.s) || (a.i - b.i); });
    _cmdkItems = scored.map(function(x) { return x.c; });
  }
  _cmdkSel = 0;
  _cmdkRender();
}

function _cmdkRunSelected() {
  var c = _cmdkItems[_cmdkSel];
  if(!c) return;
  veCmdkClose();
  // kapanış animasyonu/DOM ile çakışmasın diye bir tık sonra çalıştır
  setTimeout(function() { try { c.run(); } catch(e) { console.warn('[cmdk] run:', e); } }, 0);
}

function veCmdkOpen() {
  _cmdkBuildDom();
  // komutları taze kur (aktif modülün "Ekle" komutları değişmiş olabilir)
  _cmdkAll = _cmdkStaticCommands().concat(_cmdkAddCommands());
  for(var i = 0; i < _cmdkAll.length; i++) {
    var c = _cmdkAll[i];
    c._normLabel = veCmdkNorm(c.label);
    c._norm = veCmdkNorm(c.label + ' ' + (c.kw || '') + ' ' + c.sec);
  }
  var ov = document.getElementById('ve-cmdk');
  var input = document.getElementById('ve-cmdk-input');
  if(!ov || !input) return;
  if(_cmdkCloseTimer) { clearTimeout(_cmdkCloseTimer); _cmdkCloseTimer = null; } // bekleyen kapanışı iptal et
  input.value = '';
  _cmdkFilter('');
  ov.removeAttribute('hidden');
  // reflow → geçiş çalışsın
  void ov.offsetWidth;
  ov.classList.add('open');
  setTimeout(function() { input.focus(); input.select(); }, 20);
}

function veCmdkClose() {
  var ov = document.getElementById('ve-cmdk');
  if(!ov || !ov.classList.contains('open')) return;   // zaten kapalı/kapanıyor
  ov.classList.remove('open');
  if(_cmdkCloseTimer) clearTimeout(_cmdkCloseTimer);
  // geçiş bitince gizle (reduced-motion / geçiş yoksa da güvence)
  _cmdkCloseTimer = setTimeout(function() { ov.setAttribute('hidden', ''); _cmdkCloseTimer = null; }, 220);
}

// Açık/kapalı kaynağı .open sınıfıdır — kapanış animasyonu sırasında (hidden
// henüz set edilmeden) Ctrl+K yeniden AÇAR, yanlışlıkla kapatmaz.
function veCmdkToggle() {
  var ov = document.getElementById('ve-cmdk');
  if(ov && ov.classList.contains('open')) veCmdkClose();
  else veCmdkOpen();
}

// ── Global kısayol: Ctrl/⌘+K (yalnızca editör sayfası aktifken) ──
if(typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', function(e) {
    if((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
      var sayfa2 = document.getElementById('sayfa2');
      if(!sayfa2 || !sayfa2.classList.contains('active')) return;
      e.preventDefault();
      veCmdkToggle();
    }
  });
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veCmdkOpen: veCmdkOpen, veCmdkClose: veCmdkClose, veCmdkToggle: veCmdkToggle, veCmdkNorm: veCmdkNorm };
}
