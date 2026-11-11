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
// GÖVDE YOK — KOMUTLARIN PENCERESİ (kullanıcı 2026-11-06, Canlı Not 59: *"Şu
// kısmın programdan tamamen kalkmasını istiyorum. Buradaki özelliklerin ise,
// böyle kenarda açılır bir ufak pencere şeklinde belirmesini istiyorum.
// Programı daraltıyor"*): şerit hep katlı; sabitleme, daralt tutamağı ve çift
// tık kalktı. Bandın sağ ucundaki #ve-rb-expand kenarda küçük bir pencere
// (#ve-rb-dock) açar: başında sekmeler, altında seçili sekmenin grupları liste
// olarak. Komut, dışarı tık ve Esc pencereyi kapatır; sayfa hiç kaymaz
// (--ribbon-h hep bandın boyu).

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
        { size:'lg', icon:'file-plus',   label:'Yeni\nproje',  run:'veNewProject' },
        { size:'lg', icon:'folder-open', label:'Proje\naç',    run:'veLoadTopology' },
        { size:'lg', icon:'save',        label:'Kaydet',       run:'veSaveTopology',  tip:'Ctrl+S' },
        { size:'sm', icon:'trash',       label:'Temizle',      run:'veClearAll' }
      ]},
      // Ölçüm dosyası açmak proje açmanın kardeşi: ikisi de "programa dışarıdan
      // veri getir" işi. Bu yüzden Proje grubunun hemen yanında ve Giriş
      // sekmesinde — Sonuçlar sayfasına gitmeden, elinde dosya olan kullanıcı
      // ilk baktığı yerde bulsun.
      { label: 'Ölçüm verisi', items: [
        { size:'lg', icon:'upload', label:'Ölçüm\niçe aktar', run:'veImpOpenPicker',
          tip:'Excel · CSV' }
      ]},
      { label: 'Çözüm', items: [
        { size:'lg', icon:'search', label:'Doğrula',  run:'veSolverValidate' },
        // Ad "Çalıştır" değil "Çözücü": düğme hesabı başlatmıyor, Çözücü
        // bileşenini açıyor (hesap oradaki "Hesapla" ile başlar). İkon play —
        // Çözücü bileşeninin tuvaldeki simgesiyle aynı (kare içinde üçgen).
        { size:'lg', icon:'play',   label:'Çözücü',   run:'veSolverRun',      accent:true }
      ]},
      { label: 'Düzen', items: [
        { size:'sm', icon:'undo', label:'Geri al',          run:'veUndo',       tip:'Ctrl+Z' },
        { size:'sm', icon:'redo', label:'İleri al',         run:'veRedo',       tip:'Ctrl+Y' },
        { size:'sm', icon:'wand', label:'Otomatik düzenle', run:'veTidyLayout' }
      ]},
      { label: 'Dışa aktar', items: [
        { size:'sm', icon:'download',  label:'PNG',   run:'veExportTopology', args:['png'] },
        { size:'sm', icon:'download',  label:'SVG',   run:'veExportTopology', args:['svg'] },
        { size:'sm', icon:'file-text', label:'Rapor', run:'veShowRaporModal' }
      ]}
    ]
  },
  {
    id: 'gorunum', label: 'Görünüm',
    groups: [
      { label: 'Yakınlaştırma', items: [
        { size:'lg', icon:'maximize',  label:'İçeriğe\nsığdır', run:'veFitViewToContent', args:[{maxZoom:2}] },
        { size:'sm', icon:'zoom-in',   label:'Yakınlaştır',     run:'veZoomIn' },
        { size:'sm', icon:'zoom-out',  label:'Uzaklaştır',      run:'veZoomOut' },
        { size:'sm', icon:'crosshair', label:'%100',            run:'veResetZoom' }
      ]},
      { label: 'Izgara', items: [
        { size:'sm', icon:'grid',       label:'Izgara',    run:'veToggleGrid',
          state:function(){ return typeof veGridVisible !== 'undefined' && veGridVisible; } },
        { size:'sm', icon:'grid-cells', label:'Yoğunluk',  run:'veCycleGridDensity' },
        { size:'sm', icon:'ruler',      label:'Izgaraya yapış', run:'veToggleSnap',
          state:function(){ return typeof SNAP_ENABLED !== 'undefined' && SNAP_ENABLED; } }
      ]},
      { label: 'Paneller', items: [
        { size:'sm', icon:'package',         label:'Bileşenler', run:'veToggleSidebar',
          state:function(){ return !veRibbonHasClass('ve-sidebar', 'collapsed'); } },
        { size:'sm', icon:'sliders',         label:'Özellikler', run:'veTogglePropertiesPanel',
          state:function(){ return veRibbonHasClass('ve-properties-overlay', 'visible'); } },
        { size:'sm', icon:'map',             label:'Genel görünüm', run:'veMinimapToggle',
          // "ve-minimap-hidden" kullanıcı tercihi değil, çizecek içerik
          // olmadığında otomatik gelir. Basılı göstergesi kullanıcının GÖRDÜĞÜ
          // durumu yansıtmalı: boş topolojide açık ama görünmezken basılı
          // görünmesi yanıltıcı olurdu.
          state:function(){ return !veRibbonHasClass('ve-minimap', 'collapsed') &&
                                   !veRibbonHasClass('ve-minimap', 've-minimap-hidden'); } }
      ]},
      { label: 'Sınır', items: [
        { size:'sm', icon:'frame',    label:'Sınırı göster', run:'veToggleBoundary',
          state:function(){ return typeof veBoundaryVisible !== 'undefined' && veBoundaryVisible; } },
        { size:'sm', icon:'contrast', label:'Opaklık',       run:'veCycleBoundaryOpacity' }
      ]},
      { label: 'Efektler', items: [
        { size:'sm', icon:'zap',     label:'Güç akışı',        run:'veToggleFlow',
          state:function(){ return typeof veFlowAnim !== 'undefined' && veFlowAnim; } },
        { size:'sm', icon:'refresh', label:'Görünümü sıfırla', run:'veResetView' }
      ]}
    ]
  },
  {
    id: 'araclar', label: 'Araçlar',
    groups: [
      { label: 'Program', items: [
        { size:'lg', icon:'settings', label:'Ayarlar',  run:'veOpenSettings' },
        // Güncelleme rozeti: eskiden marka menüsünde duruyordu (menü kaldırıldı).
        // Şeritteki karşılığı hem bu butonda hem "Araçlar" sekmesinde görünür —
        // yani haber, sekme kapalıyken de kromda okunur.
        { size:'lg', icon:'activity', label:'Program\nDurumu', run:'veOpenStatusModal',
          badge:function(){ return typeof veStatusUpdatePending === 'function' && veStatusUpdatePending(); } }
      ]},
      // ── KULLANIM KILAVUZLARI KİTİ ──────────────────────────────────
      // Her modülün kendi kılavuzu var ve hepsi TEK kayıt defterinden
      // (VE_GUIDE_KIT, js/guide-kit.js) besleniyor. Şeritte iki yüzey:
      //   • "Kılavuzlar" — dört modülü birden gösteren seçim penceresi.
      //     Hangi kılavuzun HAZIR olduğunu orada okunur; yazılmamış olanlar
      //     gizlenmiyor, "hazırlanıyor" diye yazılıyor.
      //   • "Bu Modülün Kılavuzu" — kullanıcı bir modülün İÇİNDEYKEN, o
      //     modülün kılavuzunu tek tıkla açar. Pencereden geçmek, elindeki
      //     işi bırakıp bir liste okumak demekti.
      // Grup kendi başına duruyor, "Yardım"ın içinde değil: kılavuz bir
      // kısayol listesi değil, modülün kullanım belgesi.
      { label: 'Kullanım kılavuzları', items: [
        { size:'lg', icon:'clipboard', label:'Kılavuz\nkiti', run:'veGuideKitOpen' },
        { size:'sm', icon:'file-text', label:'Bu modülün kılavuzu', run:'veGuideOpenCurrent',
          when:function(){ return typeof veGuideCurrentId === 'function' && !!veGuideCurrentId(); } }
      ]},
      // ── PROGRAM ARŞİVİ ─────────────────────────────────────────────
      // MFSim çevresinde üretilmiş tek dosyalık HTML programlar (artifact'lar,
      // dışarıdan gelen araçlar, MFSim'in kendi üç ürünü). Kayıt defteri
      // programlar/kayit.json; pencere js/cp-programlar.js.
      { label: 'Arşiv', items: [
        { size:'lg', icon:'folder-open', label:'Program\nArşivi', run:'veProgramArsiviOpen' }
      ]},
      { label: 'Yardım', items: [
        { size:'sm', icon:'lightbulb', label:'Klavye kısayolları', run:'veShortcutsHelpOpen' },
        { size:'sm', icon:'search',    label:'Komut paleti',       run:'veCmdkOpen', tip:'Ctrl+K' }
      ]},
      // Radyo eskiden krom bandının sağ ucundaydı: komut yüzeyinin dışında,
      // hiçbir sekmeye ait olmayan tek başına bir düğme. Yeri burası — 2048'in
      // yanı: ikisi de işin kendisine değil, işin arasındaki molaya ait.
      { label: 'Mola', items: [
        { size:'sm', icon:'radio', label:'Radyo', run:'veToggleRadio',
          state:function(){ return veRibbonHasClass('mf-radio', 'open'); } },
        { size:'sm', icon:'grid', label:'2048', run:'veGame2048Open' }
      ]},
      { label: 'Oturum', items: [
        { size:'sm', icon:'log-out', label:'Çıkış yap', run:'mfsimLogout', danger:true }
      ]}
    ]
  },
  {
    // Bağlamsal sekme: yalnızca Sonuçlar sayfasındayken görünür. Ribbon'un
    // en yararlı özelliği — sayfaya özgü komutlar orada değilken yer kaplamaz.
    id: 'sonuc', label: 'Sonuç araçları', contextual: true,
    when: function() { return typeof currentSubTab !== 'undefined' && currentSubTab === 'sonuclar'; },
    groups: [
      // "Panel Düzeni" komutu kaldırıldı: seçilecek bir düzen kalmadı, tek
      // ölçüm penceresi var. "Senkron İmleç" de kalktı — senkronlanacak
      // ikinci bir yüzey yok, imleç zaten tüm şeritleri kesiyor.
      { label: 'Ölçüm penceresi', items: [
        // Grafiklere bakarken "bir de şu ölçümü açayım" en sık istenen şey;
        // Giriş sekmesine dönmeye gerek kalmasın.
        { size:'lg', icon:'upload', label:'Ölçüm\niçe aktar', run:'veImpOpenPicker',
          tip:'Excel · CSV' },
        { size:'lg', icon:'maximize', label:'Tümünü\nsığdır', run:'veTrFit' },
        { size:'lg', icon:'trash', label:'Sonuçları\ntemizle', run:'veClearAllResults' }
      ]},
      { label: 'Şeritler', items: [
        { size:'sm', icon:'scissors', label:'Şeritlere ayır', run:'veTrSplitAll' },
        { size:'sm', icon:'grid-cells', label:'Birime göre birleştir', run:'veTrMergeByUnit' },
        { size:'sm', icon:'crosshair', label:'Referansı kaldır', run:'veTrUnpin' }
      ]}
    ]
  }
];

var veRibbonActiveTab = 'giris';
var veRibbonCollapsed = true;     // hep katlı (Canlı Not 59) — gövde yok
var _veRibbonPeek = false;        // komutların penceresi açık mı

var VE_RIBBON_COLLAPSE_KEY = 'mf-ribbon-collapsed';

// ŞERİT HEP KATLI (Canlı Not 59; önce 2026-09-22'den beri varsayılan katlıydı).
// Meşruiyeti TEK bir koşula bağlı: şeritteki her komut palette de bulunabilsin
// — `tests/unit/komut-kapsami.test.js`. Kaydedilmiş "açık" tercihi
// (VE_RIBBON_COLLAPSE_KEY = '0') artık okunmaz: gövde yok.

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
// KILAVUZLAR BU LİSTEDE OLMAK ZORUNDA. js/guide-kit.js'in kendi kuralı şunu
// diyor: "kılavuz çözülmüş model istemez; tuval bomboşken — hatta karşılama
// ekranındayken — okunabilir olmak zorundadır. Zaten kullanıcının ona en çok
// ihtiyaç duyduğu an odur." Muafiyet verilmezse tam o anda düğme PASİF çizilir
// ve kural yüzeyde yazılı, davranışta yok olurdu.
var VE_RIBBON_ALWAYS_ON = [
  'veNewProject', 'veLoadTopology', 'veOpenSettings', 'veOpenStatusModal',
  'veShortcutsHelpOpen', 'veCmdkOpen', 'veGame2048Open', 'mfsimLogout',
  'veGuideKitOpen', 'veGuideOpenCurrent', 'veProgramArsiviOpen'
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

  // `\n` iki satırlı büyük düğmenin kırılması; önündeki boşluk pencerede
  // (kırılma yok) iki sözcüğü ayırır
  var label = veRibbonEsc(item.label).replace(/\n/g, ' <br>');
  var tip = veRibbonEsc(item.tip || item.label.replace(/\n/g, ' '));
  if(!ok && veRibbonRunnable(item)) tip = 'Modül seçili değil';

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

  // YAPISAL DURUM İÇERİKTEN ÖNCE. Katlı/açık sınıfı eskiden en sonda, gövde
  // kurulduktan SONRA yazılıyordu: gövdeyi kuran bir komutun `when()`
  // denetimi patlasaydı değişken dönmüş, sınıf dönmemiş olurdu — düğme
  // sessizce "çalışmıyor" gibi görünürdü. Bugün hiçbir `when()` patlamıyor
  // (ölçüldü); sıra yine de aç/kapa'yı içeriğin başarısına bağlamamalı.
  host.classList.toggle('is-collapsed', true);
  host.classList.toggle('is-peek', _veRibbonPeek);
  veRibbonApplyHeight();
  var tog = document.getElementById('ve-rb-expand');
  if(tog) {
    tog.setAttribute('aria-expanded', _veRibbonPeek ? 'true' : 'false');
    tog.classList.toggle('has-badge', tabs.some(veRibbonTabBadge));
  }

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

  // ── Gövde ──
  var tab = tabs.filter(function(t) { return t.id === veRibbonActiveTab; })[0];
  var b = '';
  if(tab) {
    tab.groups.forEach(function(g, gi) {
      var itemsHTML = g.items.map(function(it, ii) {
        return veRibbonItemHTML(it, tab.id, gi, ii);
      }).join('');
      if(!itemsHTML) return;
      // pencerede grubun adı başlıktır: öğelerin üstünde
      b += '<div class="ve-rb-group" role="group" aria-label="' + veRibbonEsc(g.label) + '">';
      b += '<div class="ve-rb-group-label">' + veRibbonEsc(g.label) + '</div>';
      b += '<div class="ve-rb-group-items">' + itemsHTML + '</div>';
      b += '</div>';
    });
  }
  bodyHost.innerHTML = b;
  veRibbonSyncQat();
}

// Hızlı Erişim çubuğu (Kaydet/Geri/İleri) şeritle aynı kuralı izler: çalışma
// alanı yokken hepsi pasif. Aksi hâlde şeritteki "Kaydet" gri, başlıktaki aynı
// komut tıklanabilir görünüyordu.
function veRibbonSyncQat() {
  // Tarama da bandın tamamında: komut arama ve birincil eylem de modül
  // seçilmeden önce pasif olmalı (tıklanabilir görünen ölü komut, kuralın
  // kapattığı kusurun ta kendisi).
  var qat = document.getElementById('ve-rb-strip') || document.getElementById('ve-qat');
  if(!qat) return;
  var blocked = veRibbonNoWorkspace();
  qat.querySelectorAll('[data-qat]').forEach(function(btn) {
    if(btn.dataset.qatTitle === undefined) btn.dataset.qatTitle = btn.getAttribute('title') || '';
    btn.disabled = blocked;
    var t = blocked ? 'Modül seçili değil' : btn.dataset.qatTitle;
    if(t) btn.setAttribute('title', t); else btn.removeAttribute('title');
  });
}

// Ölçü CSS'te (--ribbon-strip-h): krom hep bandın boyu — gövde yok, komutların
// penceresi bandın üstünde yüzer (Canlı Not 59). #sayfa2 --chrome-h ile kayar.
function veRibbonApplyHeight() {
  document.documentElement.style.setProperty('--ribbon-h', 'var(--ribbon-strip-h)');
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
  var tog = document.getElementById('ve-rb-expand');
  if(tog) tog.classList.toggle('has-badge', veRibbonVisibleTabs().some(veRibbonTabBadge));

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

// Sekme pencerenin içinde: seçmek pencereyi açık tutar, yalnız listeyi değiştirir
function veRibbonSelectTab(id) {
  var tabs = veRibbonVisibleTabs();
  if(!tabs.some(function(t) { return t.id === id; })) return;
  veRibbonActiveTab = id;
  _veRibbonPeek = true;
  veRibbonRender();
}

// Komutların penceresi: aç / kapat (`acik` verilmezse çevirir). Açılınca odak
// seçili sekmeye, kapanınca bandın düğmesine (klavyeyle gelen kaybolmasın).
function veRibbonAc(acik) {
  var yeni = (acik === undefined) ? !_veRibbonPeek : !!acik;
  if(yeni === _veRibbonPeek) return _veRibbonPeek;
  _veRibbonPeek = yeni;
  veRibbonRender();
  var hedef = yeni ? document.querySelector('#ve-rb-tabs .ve-rb-tab.active') : null;
  if(hedef && hedef.focus) try { hedef.focus({ preventScroll: true }); } catch(e) { hedef.focus(); }
  return _veRibbonPeek;
}
// Eski ad (bandın düğmesi, testler): artık pencereyi çevirir — gövde yok
function veRibbonToggleCollapse() { return veRibbonAc(); }

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
  // Komut çalışınca pencere kapanır (menü davranışı)
  if(_veRibbonPeek) { _veRibbonPeek = false; veRibbonRender(); }
  else veRibbonRefreshStates();
}

function veRibbonInit() {
  var host = document.getElementById('ve-ribbon');
  if(!host || host._rbInit) return;
  host._rbInit = true;

  host.addEventListener('click', function(e) {
    // Bandın sağ ucundaki düğme komutların penceresini açar / kapatır
    if(e.target.closest('#ve-rb-expand')) { veRibbonAc(); return; }

    var tabBtn = e.target.closest('.ve-rb-tab');
    if(tabBtn) { veRibbonSelectTab(tabBtn.getAttribute('data-rb-tab')); return; }

    var btn = e.target.closest('.ve-rb-btn');
    if(btn && !btn.disabled) {
      var p = btn.getAttribute('data-rb').split(':');
      veRibbonRunItem(p[0], parseInt(p[1], 10), parseInt(p[2], 10));
    }
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

  // Pencere açıkken dışarı tıklanınca ya da Esc'le kapanır. İkisi de YAKALAMA
  // evresinde: Kayış Tablosu gibi yüzeyler mousedown'ı yutuyor (ölçüldü — tablonun
  // satırına basmak pencereyi açık bırakıyordu), alttaki katmanın Esc'i bu tuşu
  // görmez. pointerdown da dinlenir: varsayılanı engellenen işaretçi mousedown üretmez.
  var disari = function(e) {
    if(!_veRibbonPeek) return;
    if(host.contains(e.target)) return;
    _veRibbonPeek = false;
    veRibbonRender();
  };
  document.addEventListener('pointerdown', disari, true);
  document.addEventListener('mousedown', disari, true);
  document.addEventListener('keydown', function(e) {
    if(e.key !== 'Escape' || !_veRibbonPeek) return;
    e.stopPropagation(); e.preventDefault();
    veRibbonAc(false);
    var tog = document.getElementById('ve-rb-expand');
    if(tog && tog.focus) tog.focus();
  }, true);

  // Hızlı Erişim Araç Çubuğu (krom bandı içinde) — inline onclick yerine
  // delegasyon: aynı komut menüde de bulunduğundan `[onclick*="..."]`
  // seçicilerini çoğaltmamak için.
  // Yetki devri BANDIN TAMAMINA bağlanır, yalnız `#ve-qat`a değil: Atölye
  // bandında `data-qat` taşıyan düğmeler o kabın DIŞINDA da var (komut arama,
  // birincil eylem). Dinleyici kapta kalsaydı o düğmeler sessizce ölürdü —
  // markup doğru, fonksiyon yerinde, tık hiçbir şey yapmaz. Ölçüldü.
  var qat = document.getElementById('ve-rb-strip') || document.getElementById('ve-qat');
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
    // Kılavuz sahneleri düğmeyi BU ÜRETİCİDEN alıyor (js/guide-fead.js →
    // `_gfSeritOgesi`): "şu düğmeye bas" derken düğmenin resmi değil kendisi
    // konuyor. Dışa açık olması kapının üreticiyi ölçebilmesi için.
    veRibbonItemHTML: veRibbonItemHTML,
    veRibbonEsc: veRibbonEsc,
    veRibbonRunnable: veRibbonRunnable,
    veRibbonItemBadge: veRibbonItemBadge,
    veRibbonAc: veRibbonAc,
    VE_RIBBON_ALWAYS_ON: VE_RIBBON_ALWAYS_ON
  };
}
