// ============================================================================
// KROM BANDI — Her zaman görünür (artık tek sayfa, tek bant)
// ============================================================================
// #tab-bar kaldırıldı: marka menüsü ve hızlı erişim şerit şeridine taşındı
// (bkz. index.html "TEK KROM BANDI"), sayfa anahtarı ise çalışma alanının
// solundaki dikey sayfa rayına (bkz. index.html "SAYFA RAYI"). Kabuğun var
// olduğunu gösteren sentinel artık #ve-ribbon.
var _veRibbonEl = document.getElementById('ve-ribbon');
if(_veRibbonEl) _veRibbonEl.classList.add('visible');
document.body.classList.add('app-chrome-visible');

// Görsel Editör sub-tab değiştirme
var currentSubTab = 'arac-performans';

function veSubTabDegistir(tabName) {
  currentSubTab = tabName;

  // Sayfa rayı (.ve-nav-rail, bkz. index.html) — dikey tablist.
  // Roving tabindex: yalnız AKTİF öğe Tab sırasında; ray'a bir kez uğranır,
  // öğe sayısı kadar değil (WAI-ARIA tabs pattern).
  document.querySelectorAll('.ve-nav-item').forEach(function(btn) {
    var on = btn.getAttribute('data-subtab') === tabName;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    btn.tabIndex = on ? 0 : -1;
  });

  document.querySelectorAll('.ve-sub-page').forEach(function(page) {
    page.style.display = 'none';
  });

  var mainContent = document.querySelector('.ve-main');

  // Görsel editör sekmesi (ve-main). Sidebar tek modda çalışır ('performans').
  if(tabName === 'arac-performans') {
    mainContent.style.display = 'flex';
    veSidebarMode = 'performans';
    if(typeof veShowAllSidebarComponents === 'function') veShowAllSidebarComponents();
  } else {
    mainContent.style.display = 'none';
    var page = document.getElementById('ve-page-' + tabName);
    if(page) {
      // Sonuçlar sayfası flex, diğerleri block+scroll
      if(tabName === 'sonuclar') {
        page.style.display = 'flex';
        page.style.overflowY = 'hidden';
      } else {
        page.style.display = 'block';
        page.style.overflowY = 'auto';
      }
    }
  }
  
  // Sonuçlar sayfası açıldığında: veri ağacını güncelle, ardından düzen seçili
  // değilse önce panel-düzeni seçiciyi göster (paneller otomatik açılmaz).
  if(tabName === 'sonuclar') {
    if(typeof veEnterResults === 'function') {
      veEnterResults();
    } else {
      // Geriye dönük güvenlik: eski davranış
      if(typeof veUpdateSolverTabs === 'function') veUpdateSolverTabs();
      veUpdateResultsTree();
      veInitResultSlots();
    }
    // Sonuç açılışı: içerik yumuşakça belirir (animasyon CSS'te; reduced-motion'a saygılı).
    // remove → reflow → add ile her geçişte yeniden tetiklenir.
    var _resPage = document.getElementById('ve-page-sonuclar');
    if(_resPage){ _resPage.classList.remove('ve-reveal-play'); void _resPage.offsetWidth; _resPage.classList.add('ve-reveal-play'); }
  }

  // Şerit: bağlamsal sekme (Sonuç Araçları) sayfaya göre gelir/gider
  if(typeof veRibbonOnPageChange === 'function') veRibbonOnPageChange();
}

// ── Sayfa rayı: klavye gezinmesi ────────────────────────────────────────────
// Dikey tablist'in beklenen tuşları: ↑/↓ komşu sayfa, Home/End uçlar.
// Sayfa seçimle birlikte DEĞİŞİR (automatic activation) — iki sayfa var, ok
// tuşuyla "gezip sonra Enter" ayrımı burada kullanıcıya tuş kazandırmaz.
(function veNavRailKeys() {
  var rail = document.getElementById('ve-nav-rail');
  if(!rail) return;
  rail.addEventListener('keydown', function(e) {
    var keys = { ArrowDown:1, ArrowUp:-1, Home:'first', End:'last' };
    if(!(e.key in keys)) return;
    var items = Array.prototype.slice.call(rail.querySelectorAll('.ve-nav-item'));
    if(!items.length) return;
    var cur = items.indexOf(document.activeElement);
    if(cur < 0) cur = items.findIndex(function(b){ return b.classList.contains('active'); });
    var step = keys[e.key];
    var next = step === 'first' ? 0
             : step === 'last'  ? items.length - 1
             : (cur + step + items.length) % items.length;   // uçlarda sarar
    e.preventDefault();
    items[next].focus();
    veSubTabDegistir(items[next].getAttribute('data-subtab'));
  });
})();
