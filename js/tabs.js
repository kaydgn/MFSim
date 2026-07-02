// ============================================================================
// TAB BAR — Her zaman görünür (artık tek sayfa)
// ============================================================================
var tabBar = document.getElementById('tab-bar');
tabBar.classList.add('visible');
document.body.classList.add('tab-bar-visible');

// Görsel Editör sub-tab değiştirme
var currentSubTab = 'arac-performans';

function veSubTabDegistir(tabName) {
  currentSubTab = tabName;

  document.querySelectorAll('.ve-sub-tab').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-subtab') === tabName);
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
  
  // Sonuçlar sayfası açıldığında data browser güncelle
  if(tabName === 'sonuclar') {
    if(typeof veUpdateSolverTabs === 'function') veUpdateSolverTabs();
    veUpdateResultsTree();
    veInitResultSlots();
  }
}
