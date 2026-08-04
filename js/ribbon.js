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
//   #ve-rb-strip    → tek krom bandı (marka + hızlı erişim + sekmeler +
//                     sayfa anahtarı + radyo); STATİK markup, JS ezmez
//   #ve-ribbon      → sekme şeridi + gövde
//
// Sekme şeridi daima görünür; gövde daraltılabilir (aktif sekmeye çift tık ya
// da gövdenin SAĞ ALT köşesindeki ok). Daraltılmışken bir sekmeye tıklamak
// gövdeyi geçici olarak açar (Office'teki "peek" davranışı) — dışarı tıklayınca
// yeniden kapanır. Tutamak gövdenin köşesinde olduğu için daraltılmışken
// görünmez; geri açmanın yolu çift tık ya da peek içindeki "sabitle" okudur.
//
// Yükseklik CSS değişkeniyle yönetilir: --ribbon-h değişince #sayfa2 üstten
// kendiliğinden kayar (bkz. --chrome-h). JS piksel hesabı yapmaz.

// ── Komut tanımları ──────────────────────────────────────────────────────
// run    : global fonksiyon adı (yoksa buton sessizce devre dışı görünür)
// args   : run'a geçilecek argümanlar
// size   : 'lg' (ikon üstte, iki satır etiket) | 'sm' (ikon solda, tek satır)
// state  : true dönerse buton "basılı" görünür (aç/kapa komutları için)
// when   : false dönerse öğe hiç çizilmez
// badge  : true dönerse butonda (ve sekmesinde) bildirim noktası belirir
// danger : yıkıcı komut — ikon kırmızı çizilir (Çıkış Yap)
var VE_RIBBON_TABS = [
  {
    id: 'giris', label: 'Giriş',
    groups: [
      { label: 'Proje', items: [
        { size:'lg', icon:'file-plus',   label:'Yeni\nProje',  run:'veNewProject',    tip:'Yeni proje oluştur' },
        { size:'lg', icon:'folder-open', label:'Proje\nAç',    run:'veLoadTopology',  tip:'Kayıtlı bir proje dosyası aç' },
        { size:'lg', icon:'save',        label:'Kaydet',       run:'veSaveTopology',  tip:'Projeyi dosyaya kaydet' },
        { size:'sm', icon:'trash',       label:'Temizle',      run:'veClearAll',      tip:'Bu sekmedeki tüm bileşenleri sil' }
      ]},
      { label: 'Çözüm', items: [
        { size:'lg', icon:'search', label:'Doğrula',  run:'veSolverValidate', tip:'Topolojiyi doğrula' },
        // Ad "Çalıştır" değil "Çözücü": düğme hesabı başlatmıyor, Çözücü
        // bileşenini açıyor (hesap oradaki "Hesapla" ile başlar). İkon play —
        // Çözücü bileşeninin tuvaldeki simgesiyle aynı (kare içinde üçgen).
        { size:'lg', icon:'play',   label:'Çözücü',   run:'veSolverRun',      tip:'Çözücü bileşenini aç', accent:true }
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
          // "ve-minimap-hidden" kullanıcı tercihi değil, çizecek içerik
          // olmadığında otomatik gelir. Basılı göstergesi kullanıcının GÖRDÜĞÜ
          // durumu yansıtmalı: boş topolojide açık ama görünmezken basılı
          // görünmesi yanıltıcı olurdu.
          state:function(){ return !veRibbonHasClass('ve-minimap', 'collapsed') &&
                                   !veRibbonHasClass('ve-minimap', 've-minimap-hidden'); } }
      ]},
      { label: 'Sınır', items: [
        { size:'sm', icon:'frame',    label:'Sınırı Göster', run:'veToggleBoundary',
          state:function(){ return typeof veBoundaryVisible !== 'undefined' && veBoundaryVisible; } },
        { size:'sm', icon:'contrast', label:'Opaklık',       run:'veCycleBoundaryOpacity',
          tip:'Sınır opaklığını sırayla değiştir' }
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
        // Güncelleme rozeti: eskiden marka menüsünde duruyordu (menü kaldırıldı).
        // Şeritteki karşılığı hem bu butonda hem "Araçlar" sekmesinde görünür —
        // yani haber, sekme kapalıyken de kromda okunur.
        { size:'lg', icon:'activity', label:'Program\nDurumu', run:'veOpenStatusModal', tip:'Sürüm ve dağıtım durumu',
          badge:function(){ return typeof veStatusUpdatePending === 'function' && veStatusUpdatePending(); } }
      ]},
      { label: 'Yardım', items: [
        { size:'sm', icon:'lightbulb', label:'Klavye Kısayolları', run:'veShortcutsHelpOpen' },
        { size:'sm', icon:'search',    label:'Komut Paleti',       run:'veCmdkOpen', tip:'Tüm komutlarda ara (Ctrl+K)' }
      ]},
      { label: 'Mola', items: [
        { size:'sm', icon:'grid', label:'2048', run:'veGame2048Open' }
      ]},
      { label: 'Oturum', items: [
        { size:'sm', icon:'log-out', label:'Çıkış Yap', run:'mfsimLogout', danger:true,
          tip:'Oturumu kapat ve giriş ekranına dön' }
      ]}
    ]
  },
  {
    // Bağlamsal sekme: yalnızca Sonuçlar sayfasındayken görünür. Ribbon'un
    // en yararlı özelliği — sayfaya özgü komutlar orada değilken yer kaplamaz.
    id: 'sonuc', label: 'Sonuç Araçları', contextual: true,
    when: function() { return typeof currentSubTab !== 'undefined' && currentSubTab === 'sonuclar'; },
    groups: [
      // "Panel Düzeni" komutu kaldırıldı: seçilecek bir düzen kalmadı, tek
      // ölçüm penceresi var. "Senkron İmleç" de kalktı — senkronlanacak
      // ikinci bir yüzey yok, imleç zaten tüm şeritleri kesiyor.
      { label: 'Ölçüm Penceresi', items: [
        { size:'lg', icon:'maximize', label:'Tümünü\nSığdır', run:'veTrFit',
          tip:'Zaman eksenini tüm veriye sığdır' },
        { size:'lg', icon:'trash', label:'Sonuçları\nTemizle', run:'veClearAllResults',
          tip:'Ölçüm penceresini ve çözüm sonuçlarını boşalt' }
      ]},
      { label: 'Şeritler', items: [
        { size:'sm', icon:'scissors', label:'Şeritlere Ayır', run:'veTrSplitAll',
          tip:'Her sinyal kendi Y ekseninde ayrı şeride' },
        { size:'sm', icon:'grid-cells', label:'Birime Göre Birleştir', run:'veTrMergeByUnit',
          tip:'Aynı birimli sinyalleri tek şeritte topla' },
        { size:'sm', icon:'crosshair', label:'Referansı Kaldır', run:'veTrUnpin',
          tip:'Sabitlenmiş Δ referans imlecini kaldır' }
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

// Modül seçim ekranı açıkken çalışma alanı yok: Kaydet / Doğrula / Çözücü /
// PNG gibi komutlar bir işe yaramaz. Şeridin tamamı etkin görünürken sol panel
// gizleniyordu — tutarsızdı. Bu durumda proje açma/oluşturma ve program
// komutları dışındaki her şey pasif çizilir.
var VE_RIBBON_ALWAYS_ON = [
  'veNewProject', 'veLoadTopology', 'veOpenSettings', 'veOpenStatusModal',
  'veShortcutsHelpOpen', 'veCmdkOpen', 'veGame2048Open', 'mfsimLogout'
];
function veRibbonNoWorkspace() {
  var ov = document.getElementById('ve-module-overlay');
  return !!(ov && ov.offsetParent !== null);
}
function veRibbonItemEnabled(item) {
  if(!veRibbonRunnable(item)) return false;
  if(veRibbonNoWorkspace() && VE_RIBBON_ALWAYS_ON.indexOf(item.run) < 0) return false;
  return true;
}

function veRibbonVisibleTabs() {
  return VE_RIBBON_TABS.filter(function(t) {
    return !t.when || t.when();
  });
}

// Rozet (bildirim noktası) — öğe kendi durumunu bildirir, şerit yalnız çizer.
function veRibbonItemBadge(item) {
  if(!item || typeof item.badge !== 'function') return false;
  try { return !!item.badge(); } catch(e) { return false; }
}
// Sekme rozeti: içindeki herhangi bir komutun haberi varsa sekme de işaretlenir.
// Aksi hâlde haber, o sekme açılana dek görünmez kalırdı.
function veRibbonTabBadge(tab) {
  return tab.groups.some(function(g) { return g.items.some(veRibbonItemBadge); });
}

// ── Çizim ────────────────────────────────────────────────────────────────

function veRibbonItemHTML(item, tabId, gi, ii) {
  if(item.when && !item.when()) return '';
  var ok = veRibbonItemEnabled(item);
  var pressed = false;
  if(ok && typeof item.state === 'function') {
    try { pressed = !!item.state(); } catch(e) { pressed = false; }
  }
  var cls = 've-rb-btn ve-rb-btn--' + (item.size === 'lg' ? 'lg' : 'sm');
  if(item.accent) cls += ' ve-rb-btn--accent';
  if(item.danger) cls += ' ve-rb-btn--danger';
  if(pressed) cls += ' is-pressed';
  if(veRibbonItemBadge(item)) cls += ' has-badge';
  if(!ok) cls += ' is-disabled';

  var label = veRibbonEsc(item.label).replace(/\n/g, '<br>');
  var tip = veRibbonEsc(item.tip || item.label.replace(/\n/g, ' '));
  if(!ok && veRibbonRunnable(item)) tip = 'Önce bir modül seçin — ' + tip;

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

  // Şerit ARTIK KABUĞU EZMEZ. Krom bandı (marka menüsü, hızlı erişim, sayfa
  // anahtarı, radyo) ve gövdenin köşesindeki daralt tutamağı index.html'de
  // STATİK markup; JS yalnız iki kabın içini yazar. Eskiden host.innerHTML her
  // çizimde her şeyi siliyordu — statik markup orada duramazdı.
  var tabsHost = document.getElementById('ve-rb-tabs');
  var bodyHost = document.getElementById('ve-rb-body');
  if(!tabsHost || !bodyHost) return;

  // ── Sekmeler ──
  var h = '';
  tabs.forEach(function(t) {
    var active = t.id === veRibbonActiveTab;
    h += '<button type="button" role="tab" class="ve-rb-tab' +
         (active ? ' active' : '') + (t.contextual ? ' contextual' : '') +
         (veRibbonTabBadge(t) ? ' has-badge' : '') + '"' +
         ' aria-selected="' + (active ? 'true' : 'false') + '"' +
         ' tabindex="' + (active ? '0' : '-1') + '"' +
         ' data-rb-tab="' + t.id + '">' + veRibbonEsc(t.label) + '</button>';
  });
  tabsHost.innerHTML = h;

  // ── Daralt tutamağı (gövdenin sağ alt köşesi): statik, yerinde güncellenir ──
  var col = document.getElementById('ve-rb-collapse');
  if(col) {
    var etiket = veRibbonCollapsed ? 'Şeridi sabitle' : 'Şeridi daralt';
    col.textContent = veRibbonCollapsed ? '▼' : '▲';
    col.setAttribute('title', etiket);
    col.setAttribute('aria-label', etiket);
  }

  // ── Gövde ──
  var tab = tabs.filter(function(t) { return t.id === veRibbonActiveTab; })[0];
  var b = '';
  if(tab) {
    tab.groups.forEach(function(g, gi) {
      var itemsHTML = g.items.map(function(it, ii) {
        return veRibbonItemHTML(it, tab.id, gi, ii);
      }).join('');
      if(!itemsHTML) return;
      b += '<div class="ve-rb-group">';
      b += '<div class="ve-rb-group-items">' + itemsHTML + '</div>';
      b += '<div class="ve-rb-group-label">' + veRibbonEsc(g.label) + '</div>';
      b += '</div>';
    });
  }
  bodyHost.innerHTML = b;

  host.classList.toggle('is-collapsed', veRibbonCollapsed);
  host.classList.toggle('is-peek', veRibbonCollapsed && _veRibbonPeek);
  veRibbonApplyHeight();
  veRibbonSyncQat();
}

// Hızlı Erişim çubuğu (Kaydet/Geri/İleri) şeritle aynı kuralı izler: çalışma
// alanı yokken hepsi pasif. Aksi hâlde şeritteki "Kaydet" gri, başlıktaki aynı
// komut tıklanabilir görünüyordu.
function veRibbonSyncQat() {
  var qat = document.getElementById('ve-qat');
  if(!qat) return;
  var blocked = veRibbonNoWorkspace();
  qat.querySelectorAll('[data-qat]').forEach(function(btn) {
    if(btn.dataset.qatTitle === undefined) btn.dataset.qatTitle = btn.getAttribute('title') || '';
    btn.disabled = blocked;
    btn.setAttribute('title', (blocked ? 'Önce bir modül seçin — ' : '') + btn.dataset.qatTitle);
  });
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
  veRibbonRefreshBadges();
  veRibbonSyncQat();
}

// Rozetleri yerinde tazeler (yeniden çizmeden) — haber şeritten bağımsız gelir:
// deploy durumu değişince js/status.js bunu çağırır.
function veRibbonRefreshBadges() {
  var host = document.getElementById('ve-ribbon');
  if(!host) return;

  var tabsHost = document.getElementById('ve-rb-tabs');
  if(tabsHost) {
    VE_RIBBON_TABS.forEach(function(t) {
      var tb = tabsHost.querySelector('[data-rb-tab="' + t.id + '"]');
      if(tb) tb.classList.toggle('has-badge', veRibbonTabBadge(t));
    });
  }

  host.querySelectorAll('.ve-rb-btn[data-rb]').forEach(function(btn) {
    var p = btn.getAttribute('data-rb').split(':');
    var tab = VE_RIBBON_TABS.filter(function(t) { return t.id === p[0]; })[0];
    var g = tab && tab.groups[parseInt(p[1], 10)];
    var item = g && g.items[parseInt(p[2], 10)];
    if(!item) return;
    btn.classList.toggle('has-badge', veRibbonItemBadge(item));
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
  if(!item || !veRibbonItemEnabled(item)) return;
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

  // Hızlı Erişim Araç Çubuğu (krom bandı içinde) — inline onclick yerine
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
// Bağlamsal sekme YENİ belirdiyse otomatik seçilir (Office davranışı): kullanıcı
// Sonuçlar'a geçtiğinde şeridin hâlâ "Yeni Proje / PNG" göstermesi anlamsızdı.
// Sekme zaten görünürken yeniden seçilmez — kullanıcı başka sekmeye geçtiyse
// orada kalır.
var _veRibbonCtxWasVisible = {};
function veRibbonOnPageChange() {
  var newlyShown = null;
  VE_RIBBON_TABS.forEach(function(t) {
    if(!t.contextual) return;
    var visible = !t.when || t.when();
    if(visible && !_veRibbonCtxWasVisible[t.id]) newlyShown = t.id;
    _veRibbonCtxWasVisible[t.id] = visible;
  });
  if(newlyShown) veRibbonActiveTab = newlyShown;
  veRibbonRender();
}

document.addEventListener('DOMContentLoaded', veRibbonInit);

if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_RIBBON_TABS: VE_RIBBON_TABS,
    veRibbonEsc: veRibbonEsc,
    veRibbonRunnable: veRibbonRunnable,
    veRibbonItemBadge: veRibbonItemBadge,
    VE_RIBBON_ALWAYS_ON: VE_RIBBON_ALWAYS_ON
  };
}
