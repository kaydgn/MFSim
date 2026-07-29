// ═══════════════════════════════════════════════════════════════════════════
// RIBBON (Fluent tarzı şerit) — komut yüzeyi
// ═══════════════════════════════════════════════════════════════════════════
//
// Office 2007'den bu yana mühendislik yazılımlarının standart komut yüzeyi:
// komutlar menülerde gizlenmek yerine sekmelere ve etiketli gruplara serilir,
// sık kullanılanlar büyük ikonla öne çıkar. MFSim'de komutlar şimdiye kadar
// marka menüsünde ve komut paletinde (Ctrl+K) duruyordu — yani keşfedilmesi
// için önce aranması gerekiyordu. Ribbon bunu tersine çevirir.
//
// Yapı:
//   #tab-bar        → başlık satırı (marka + hızlı erişim + sayfa sekmeleri)
//   #ve-ribbon      → sekme şeridi + gövde
//
// Sekme şeridi daima görünür; gövde daraltılabilir (aktif sekmeye çift tık ya
// da sağdaki ok). Daraltılmışken bir sekmeye tıklamak gövdeyi geçici olarak
// açar (Office'teki "peek" davranışı) — dışarı tıklayınca yeniden kapanır.
//
// Yükseklik CSS değişkeniyle yönetilir: --ribbon-h değişince #sayfa2 üstten
// kendiliğinden kayar (bkz. --chrome-h). JS piksel hesabı yapmaz.

// ── Komut tanımları ──────────────────────────────────────────────────────
// run   : global fonksiyon adı (yoksa buton sessizce devre dışı görünür)
// args  : run'a geçilecek argümanlar
// size  : 'lg' (ikon üstte, iki satır etiket) | 'sm' (ikon solda, tek satır)
// state : true dönerse buton "basılı" görünür (aç/kapa komutları için)
// when  : false dönerse öğe hiç çizilmez
var VE_RIBBON_TABS = [
  {
    id: 'giris', label: 'Giriş',
    groups: [
      { label: 'Proje', items: [
        { size:'lg', icon:'file-plus',   label:'Yeni\nProje',  run:'veNewProject',    tip:'Yeni proje oluştur' },
        { size:'lg', icon:'folder-open', label:'Proje\nAç',    run:'veLoadTopology',  tip:'Kayıtlı bir proje dosyası aç' },
        { size:'lg', icon:'save',        label:'Kaydet',       run:'veSaveTopology',  tip:'Projeyi dosyaya kaydet' }
      ]},
      { label: 'Çözüm', items: [
        { size:'lg', icon:'search', label:'Doğrula',  run:'veSolverValidate', tip:'Topolojiyi doğrula' },
        { size:'lg', icon:'play',   label:'Çalıştır', run:'veSolverRun',      tip:'Simülasyonu çalıştır', accent:true }
      ]},
      { label: 'Düzen', items: [
        { size:'sm', icon:'undo', label:'Geri Al',          run:'veUndo',       tip:'Son işlemi geri al (Ctrl+Z)' },
        { size:'sm', icon:'redo', label:'İleri Al',         run:'veRedo',       tip:'Geri alınanı yinele (Ctrl+Y)' },
        { size:'sm', icon:'wand', label:'Otomatik Düzenle', run:'veTidyLayout', tip:'Bileşenleri otomatik yerleştir' }
      ]},
      { label: 'Dışa Aktar', items: [
        { size:'sm', icon:'download',  label:'PNG',   run:'veExportTopology', args:['png'], tip:'Topolojiyi PNG olarak indir' },
        { size:'sm', icon:'download',  label:'SVG',   run:'veExportTopology', args:['svg'], tip:'Topolojiyi SVG olarak indir' },
        { size:'sm', icon:'file-text', label:'Rapor', run:'veShowRaporModal', tip:'Rapor önizlemesini aç' }
      ]}
    ]
  },
  {
    id: 'gorunum', label: 'Görünüm',
    groups: [
      { label: 'Yakınlaştırma', items: [
        { size:'lg', icon:'maximize',  label:'İçeriğe\nSığdır', run:'veFitViewToContent', args:[{maxZoom:2}], tip:'Tüm topolojiyi ekrana sığdır' },
        { size:'sm', icon:'zoom-in',   label:'Yakınlaştır',     run:'veZoomIn' },
        { size:'sm', icon:'zoom-out',  label:'Uzaklaştır',      run:'veZoomOut' },
        { size:'sm', icon:'crosshair', label:'%100',            run:'veResetZoom', tip:'Yakınlaştırmayı %100 yap' }
      ]},
      { label: 'Izgara', items: [
        { size:'sm', icon:'grid',       label:'Izgara',    run:'veToggleGrid',        tip:'Izgarayı göster / gizle',
          state:function(){ return typeof veGridVisible !== 'undefined' && veGridVisible; } },
        { size:'sm', icon:'grid-cells', label:'Yoğunluk',  run:'veCycleGridDensity',  tip:'Izgara sıklığını değiştir' },
        { size:'sm', icon:'ruler',      label:'Hizalama',  run:'veToggleSnap',        tip:'Sürüklerken ızgaraya yapış',
          state:function(){ return typeof SNAP_ENABLED !== 'undefined' && SNAP_ENABLED; } }
      ]},
      { label: 'Paneller', items: [
        { size:'sm', icon:'package',         label:'Bileşenler', run:'veToggleSidebar',
          state:function(){ return !veRibbonHasClass('ve-sidebar', 'collapsed'); } },
        { size:'sm', icon:'sliders',         label:'Özellikler', run:'veTogglePropertiesPanel',
          state:function(){ return veRibbonHasClass('ve-properties-overlay', 'visible'); } },
        { size:'sm', icon:'alert-triangle',  label:'Uyarılar',   run:'veToggleWarnings',
          state:function(){ return !veRibbonHasClass('ve-warnings-body', 'collapsed'); } },
        { size:'sm', icon:'map',             label:'Genel Görünüm', run:'veMinimapToggle',
          state:function(){ return !veRibbonHasClass('ve-minimap', 'collapsed'); } }
      ]},
      { label: 'Efektler', items: [
        { size:'sm', icon:'zap',     label:'Güç Akışı',        run:'veToggleFlow',
          state:function(){ return typeof veFlowAnim !== 'undefined' && veFlowAnim; } },
        { size:'sm', icon:'refresh', label:'Görünümü Sıfırla', run:'veResetView' }
      ]}
    ]
  },
  {
    id: 'araclar', label: 'Araçlar',
    groups: [
      { label: 'Program', items: [
        { size:'lg', icon:'settings', label:'Ayarlar',  run:'veOpenSettings',    tip:'Tema ve program ayarları' },
        { size:'lg', icon:'activity', label:'Program\nDurumu', run:'veOpenStatusModal', tip:'Sürüm ve dağıtım durumu' }
      ]},
      { label: 'Yardım', items: [
        { size:'sm', icon:'lightbulb', label:'Klavye Kısayolları', run:'veShortcutsHelpOpen' },
        { size:'sm', icon:'search',    label:'Komut Paleti',       run:'veCmdkOpen', tip:'Tüm komutlarda ara (Ctrl+K)' }
      ]},
      { label: 'Mola', items: [
        { size:'sm', icon:'grid', label:'2048', run:'veGame2048Open' }
      ]}
    ]
  },
  {
    // Bağlamsal sekme: yalnızca Sonuçlar sayfasındayken görünür. Ribbon'un
    // en yararlı özelliği — sayfaya özgü komutlar orada değilken yer kaplamaz.
    id: 'sonuc', label: 'Sonuç Araçları', contextual: true,
    when: function() { return typeof currentSubTab !== 'undefined' && currentSubTab === 'sonuclar'; },
    groups: [
      { label: 'Pano', items: [
        { size:'lg', icon:'grid-cells', label:'Panel\nDüzeni',  run:'veChangeResultLayout', tip:'Panel yerleşimini değiştir' },
        { size:'lg', icon:'trash',      label:'Sonuçları\nTemizle', run:'veClearAllResults', tip:'Tüm panelleri boşalt' }
      ]},
      { label: 'Ölçüm İmleci', items: [
        { size:'sm', icon:'crosshair', label:'Senkron İmleç', run:'veCursorToggleSync',
          tip:'Paneller tek imleçle birlikte okunur',
          state:function(){ return typeof veCursorState !== 'undefined' && veCursorState.sync; } },
        { size:'sm', icon:'x', label:'Referansı Kaldır', run:'veCursorClearPin',
          tip:'Sabitlenmiş referans imleci kaldır (Esc)' }
      ]}
    ]
  }
];

var veRibbonActiveTab = 'giris';
var veRibbonCollapsed = false;
var _veRibbonPeek = false;

var VE_RIBBON_COLLAPSE_KEY = 'mf-ribbon-collapsed';

(function veRibbonLoadPref() {
  try { if(localStorage.getItem(VE_RIBBON_COLLAPSE_KEY) === '1') veRibbonCollapsed = true; } catch(e) {}
})();

// ── Yardımcılar ──────────────────────────────────────────────────────────

function veRibbonHasClass(id, cls) {
  var el = document.getElementById(id);
  return !!(el && el.classList.contains(cls));
}

function veRibbonEsc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Komutun karşılığı yüklü mü? (modül yüklenmemişse buton devre dışı çizilir —
// tıklayınca sessizce hiçbir şey olmasındansa görünür şekilde pasif olsun.)
function veRibbonRunnable(item) {
  return !!(item && item.run && typeof window[item.run] === 'function');
}

function veRibbonVisibleTabs() {
  return VE_RIBBON_TABS.filter(function(t) {
    return !t.when || t.when();
  });
}

// ── Çizim ────────────────────────────────────────────────────────────────

function veRibbonItemHTML(item, tabId, gi, ii) {
  if(item.when && !item.when()) return '';
  var ok = veRibbonRunnable(item);
  var pressed = false;
  if(ok && typeof item.state === 'function') {
    try { pressed = !!item.state(); } catch(e) { pressed = false; }
  }
  var cls = 've-rb-btn ve-rb-btn--' + (item.size === 'lg' ? 'lg' : 'sm');
  if(item.accent) cls += ' ve-rb-btn--accent';
  if(pressed) cls += ' is-pressed';
  if(!ok) cls += ' is-disabled';

  var label = veRibbonEsc(item.label).replace(/\n/g, '<br>');
  var tip = veRibbonEsc(item.tip || item.label.replace(/\n/g, ' '));

  var h = '<button type="button" class="' + cls + '" title="' + tip + '"';
  h += ' data-rb="' + tabId + ':' + gi + ':' + ii + '"';
  if(typeof item.state === 'function') h += ' aria-pressed="' + (pressed ? 'true' : 'false') + '"';
  if(!ok) h += ' disabled aria-disabled="true"';
  h += '>';
  h += '<span class="ve-rb-ico mf-ico mf-ico-' + veRibbonEsc(item.icon) + '"></span>';
  h += '<span class="ve-rb-lbl">' + label + '</span>';
  h += '</button>';
  return h;
}

function veRibbonRender() {
  var host = document.getElementById('ve-ribbon');
  if(!host) return;

  var tabs = veRibbonVisibleTabs();
  // Aktif sekme kayboldu ise (bağlamsal sekmeden çıkıldı) ilkine dön
  if(!tabs.some(function(t) { return t.id === veRibbonActiveTab; })) {
    veRibbonActiveTab = tabs.length ? tabs[0].id : '';
    _veRibbonPeek = false;
  }

  var h = '';

  // ── Sekme şeridi ──
  h += '<div class="ve-rb-strip" role="tablist" aria-label="Şerit sekmeleri">';
  tabs.forEach(function(t) {
    var active = t.id === veRibbonActiveTab;
    h += '<button type="button" role="tab" class="ve-rb-tab' +
         (active ? ' active' : '') + (t.contextual ? ' contextual' : '') + '"' +
         ' aria-selected="' + (active ? 'true' : 'false') + '"' +
         ' tabindex="' + (active ? '0' : '-1') + '"' +
         ' data-rb-tab="' + t.id + '">' + veRibbonEsc(t.label) + '</button>';
  });
  h += '<span class="ve-rb-strip-fill"></span>';
  h += '<button type="button" class="ve-rb-collapse" id="ve-rb-collapse" ' +
       'title="' + (veRibbonCollapsed ? 'Şeridi sabitle' : 'Şeridi daralt') + '" ' +
       'aria-label="' + (veRibbonCollapsed ? 'Şeridi sabitle' : 'Şeridi daralt') + '">' +
       (veRibbonCollapsed ? '▼' : '▲') + '</button>';
  h += '</div>';

  // ── Gövde ──
  var tab = tabs.filter(function(t) { return t.id === veRibbonActiveTab; })[0];
  h += '<div class="ve-rb-body" role="tabpanel">';
  if(tab) {
    tab.groups.forEach(function(g, gi) {
      var itemsHTML = g.items.map(function(it, ii) {
        return veRibbonItemHTML(it, tab.id, gi, ii);
      }).join('');
      if(!itemsHTML) return;
      h += '<div class="ve-rb-group">';
      h += '<div class="ve-rb-group-items">' + itemsHTML + '</div>';
      h += '<div class="ve-rb-group-label">' + veRibbonEsc(g.label) + '</div>';
      h += '</div>';
    });
  }
  h += '</div>';

  host.innerHTML = h;
  host.classList.toggle('is-collapsed', veRibbonCollapsed);
  host.classList.toggle('is-peek', veRibbonCollapsed && _veRibbonPeek);
  veRibbonApplyHeight();
}

// Ölçüler CSS'te tanımlı (--ribbon-expanded-h / --ribbon-strip-h); JS yalnızca
// hangisinin geçerli olduğunu söyler. Böylece şerit yeniden boyutlandığında
// JS'i güncellemek gerekmez. #sayfa2 üstten --chrome-h ile kendiliğinden kayar.
// Daraltılmış + "peek" durumunda gövde overlay olarak açılır, sayfa kaymaz.
function veRibbonApplyHeight() {
  document.documentElement.style.setProperty(
    '--ribbon-h',
    veRibbonCollapsed ? 'var(--ribbon-strip-h)' : 'var(--ribbon-expanded-h)'
  );
}

// Aç/kapa butonlarının basılı durumunu tazeler (yeniden çizmeden).
function veRibbonRefreshStates() {
  var host = document.getElementById('ve-ribbon');
  if(!host) return;
  var tab = VE_RIBBON_TABS.filter(function(t) { return t.id === veRibbonActiveTab; })[0];
  if(!tab) return;
  host.querySelectorAll('.ve-rb-btn[data-rb]').forEach(function(btn) {
    var parts = btn.getAttribute('data-rb').split(':');
    var g = tab.groups[parseInt(parts[1], 10)];
    var item = g && g.items[parseInt(parts[2], 10)];
    if(!item || typeof item.state !== 'function') return;
    var on = false;
    try { on = !!item.state(); } catch(e) {}
    btn.classList.toggle('is-pressed', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// ── Etkileşim ────────────────────────────────────────────────────────────

function veRibbonSelectTab(id) {
  var tabs = veRibbonVisibleTabs();
  if(!tabs.some(function(t) { return t.id === id; })) return;
  if(veRibbonCollapsed) {
    // Daraltılmışken sekmeye tıklamak gövdeyi geçici açar
    _veRibbonPeek = (id === veRibbonActiveTab) ? !_veRibbonPeek : true;
  }
  veRibbonActiveTab = id;
  veRibbonRender();
}

function veRibbonToggleCollapse() {
  veRibbonCollapsed = !veRibbonCollapsed;
  _veRibbonPeek = false;
  try { localStorage.setItem(VE_RIBBON_COLLAPSE_KEY, veRibbonCollapsed ? '1' : '0'); } catch(e) {}
  veRibbonRender();
}

function veRibbonRunItem(tabId, gi, ii) {
  var tab = VE_RIBBON_TABS.filter(function(t) { return t.id === tabId; })[0];
  var g = tab && tab.groups[gi];
  var item = g && g.items[ii];
  if(!item || !veRibbonRunnable(item)) return;
  try {
    window[item.run].apply(null, item.args || []);
  } catch(e) {
    console.warn('[MFSim Ribbon] Komut hatası:', item.run, e);
  }
  // Peek modunda komut çalışınca gövde kapansın (Office davranışı)
  if(veRibbonCollapsed && _veRibbonPeek) { _veRibbonPeek = false; veRibbonRender(); }
  else veRibbonRefreshStates();
}

function veRibbonInit() {
  var host = document.getElementById('ve-ribbon');
  if(!host || host._rbInit) return;
  host._rbInit = true;

  host.addEventListener('click', function(e) {
    var collapseBtn = e.target.closest('#ve-rb-collapse');
    if(collapseBtn) { veRibbonToggleCollapse(); return; }

    var tabBtn = e.target.closest('.ve-rb-tab');
    if(tabBtn) { veRibbonSelectTab(tabBtn.getAttribute('data-rb-tab')); return; }

    var btn = e.target.closest('.ve-rb-btn');
    if(btn && !btn.disabled) {
      var p = btn.getAttribute('data-rb').split(':');
      veRibbonRunItem(p[0], parseInt(p[1], 10), parseInt(p[2], 10));
    }
  });

  // Aktif sekmeye çift tık: daralt / genişlet (klasik ribbon davranışı)
  host.addEventListener('dblclick', function(e) {
    var tabBtn = e.target.closest('.ve-rb-tab');
    if(tabBtn && tabBtn.classList.contains('active')) veRibbonToggleCollapse();
  });

  // Sekme şeridinde ok tuşlarıyla gezinme
  host.addEventListener('keydown', function(e) {
    if(e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if(!e.target.closest('.ve-rb-tab')) return;
    var tabs = veRibbonVisibleTabs();
    var i = tabs.map(function(t) { return t.id; }).indexOf(veRibbonActiveTab);
    if(i < 0) return;
    var n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    veRibbonActiveTab = tabs[n].id;
    veRibbonRender();
    var el = host.querySelector('.ve-rb-tab.active');
    if(el) el.focus();
    e.preventDefault();
  });

  // Peek açıkken dışarı tıklanınca kapan
  document.addEventListener('mousedown', function(e) {
    if(!veRibbonCollapsed || !_veRibbonPeek) return;
    if(host.contains(e.target)) return;
    _veRibbonPeek = false;
    veRibbonRender();
  });

  // Hızlı Erişim Araç Çubuğu (#tab-bar içinde) — inline onclick yerine
  // delegasyon: aynı komut menüde de bulunduğundan `[onclick*="..."]`
  // seçicilerini çoğaltmamak için.
  var qat = document.getElementById('ve-qat');
  if(qat && !qat._rbInit) {
    qat._rbInit = true;
    qat.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-qat]');
      if(!btn) return;
      var fn = window[btn.getAttribute('data-qat')];
      if(typeof fn === 'function') fn();
    });
  }

  veRibbonRender();
}

// Sayfa değişince bağlamsal sekme gelir/gider ve buton durumları değişir.
function veRibbonOnPageChange() {
  veRibbonRender();
}

document.addEventListener('DOMContentLoaded', veRibbonInit);

if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_RIBBON_TABS: VE_RIBBON_TABS,
    veRibbonEsc: veRibbonEsc,
    veRibbonRunnable: veRibbonRunnable
  };
}
