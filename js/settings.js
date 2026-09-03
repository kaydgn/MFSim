// ============================================================================
// AYARLAR MODALI
// ============================================================================
// Açılış: proje menüsündeki "Ayarlar" öğesinden. 5 bölüm:
//   - Görünüm (Tema)        — top-right palet butonundan taşındı
//   - Otomatik Kaydet       — periyodik localStorage yedeği
//   - Klavye Kısayolları    — referans tablosu
//   - Veri Yönetimi         — tercih sıfırlama, yedek silme, tam sıfırlama
//   - Hakkında              — versiyon, lisans, bağımlılıklar
// LocalStorage anahtarları (mf-* öneki):
//   mf-theme, mf-sidebar-collapsed, mf-autosave-interval, mf-autosave-data,
//   mf-autosave-ts
// ============================================================================

var VE_SETTINGS_AUTOSAVE_KEY      = 'mf-autosave-data';
var VE_SETTINGS_AUTOSAVE_TS_KEY   = 'mf-autosave-ts';
var VE_SETTINGS_AUTOSAVE_INT_KEY  = 'mf-autosave-interval';
var VE_SETTINGS_AUTOSAVE_INTERVALS = [0, 5, 10, 30]; // dakika (0 = kapalı)

var _veAutosaveTimerId = null;
var _veSettingsCurrentSection = 'appearance';

// ─── Aç / Kapat ────────────────────────────────────────────────────────────
function veOpenSettings() {
  var ov = document.getElementById('ve-settings-overlay');
  if(!ov) return;
  ov.style.display = 'flex';
  veSettingsShowSection(_veSettingsCurrentSection || 'appearance');
  document.addEventListener('keydown', _veSettingsEscHandler);
}
function veCloseSettings() {
  var ov = document.getElementById('ve-settings-overlay');
  if(ov) ov.style.display = 'none';
  document.removeEventListener('keydown', _veSettingsEscHandler);
}
function _veSettingsEscHandler(e) {
  if(e.key !== 'Escape') return;
  var t = e.target;
  if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  veCloseSettings();
}

// ─── Bölüm değiştir + render ───────────────────────────────────────────────
function veSettingsShowSection(name) {
  _veSettingsCurrentSection = name;
  document.querySelectorAll('.ve-settings-nav-item').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-section') === name);
  });
  var content = document.getElementById('ve-settings-content');
  if(!content) return;
  var html = '';
  if(name === 'appearance')      html = _veSettingsRenderAppearance();
  else if(name === 'autosave')   html = _veSettingsRenderAutosave();
  else if(name === 'shortcuts')  html = _veSettingsRenderShortcuts();
  else if(name === 'data')       html = _veSettingsRenderData();
  else if(name === 'about')      html = _veSettingsRenderAbout();
  content.innerHTML = html;
}

// ─── GÖRÜNÜM ───────────────────────────────────────────────────────────────
function _veSettingsRenderAppearance() {
  var current = 'slate';
  try { current = localStorage.getItem('mf-theme') || 'slate'; } catch(e) {}
  // swatch: [zemin, yüzey, aksan] — styles.css'teki tema bloklarıyla aynı
  // değerler (--bg-primary / --bg-tertiary / --accent-primary). Önizleme pulu
  // aktif temanın değişkenlerini kullanamaz (hepsi aynı görünürdü), bu yüzden
  // renkler burada sabit. Tema paleti değişirse burası da güncellenmeli —
  // tests/unit/theme-consistency.test.js bu senkronu korur.
  // SADE ailesi — düşük doygunlukta, marka taklidi yapmayan paletler.
  // Ayrıntılı gerekçe css/styles.css'teki "SADE AİLESİ" başlığında.
  var sadeDark = [
    { id: 'graphite', name: 'Grafit',        swatch: ['#16181b', '#23272c', '#4a739f'] },
    { id: 'ink',      name: 'Mürekkep',      swatch: ['#111419', '#1e232b', '#5570a6'] },
    { id: 'basalt',   name: 'Bazalt',        swatch: ['#1a1917', '#282622', '#4b7c72'] },
    { id: 'mono',     name: 'Monokrom',      swatch: ['#151515', '#232323', '#6e6e6e'] }
  ];
  var sadeLight = [
    { id: 'paper',    name: 'Kağıt',         swatch: ['#f6f4f0', '#eceae4', '#3a6288'] },
    { id: 'zinc',     name: 'Çinko',         swatch: ['#eef0f2', '#e3e6e9', '#3f637f'] }
  ];
  var dark = [
    { id: 'slate',  name: 'Midnight',        swatch: ['#0a0c10', '#151a22', '#2563eb'] },
    { id: 'cream',  name: 'Carbon',          swatch: ['#161616', '#222222', '#e05020'] },
    { id: 'claude', name: 'Claude',          swatch: ['#141413', '#252420', '#d97757'] },
    { id: 'navy',   name: 'Donanma Mavisi',  swatch: ['#0a1728', '#17324f', '#d9b25a'] }
  ];
  var pro = [
    { id: 'ansys',  name: 'ANSYS',           swatch: ['#1a2632', '#2a3d4f', '#ffb71b'] },
    { id: 'fusion', name: 'Fusion 360',      swatch: ['#2b2e32', '#3c4147', '#0696d7'] },
    { id: 'vscode', name: 'VS Code Dark+',   swatch: ['#1e1e1e', '#2d2d2d', '#007acc'] }
  ];
  var light = [
    { id: 'pearl',      name: 'Pearl',       swatch: ['#fafbfc', '#f0f1f3', '#2d6fe6'] },
    { id: 'steel',      name: 'Steel',       swatch: ['#e4e7ec', '#d8dce4', '#3d5ba9'] },
    { id: 'solidworks', name: 'SolidWorks',  swatch: ['#e9eef3', '#dde4ec', '#d51820'] }
  ];
  function group(label, list, note) {
    var h = '<div class="ve-settings-subhead">' + label + '</div>';
    if (note) h += '<p class="ve-settings-desc">' + note + '</p>';
    h += '<div class="ve-settings-theme-grid">';
    list.forEach(function(t) {
      var a = (t.id === current) ? ' active' : '';
      h += '<button class="ve-theme-menu-item' + a + '" data-mf-theme="' + t.id + '" onclick="changeTheme(\'' + t.id + '\')">';
      h += '<span class="ve-theme-swatch" aria-hidden="true">';
      t.swatch.forEach(function(c) { h += '<i style="background:' + c + '"></i>'; });
      h += '</span>';
      h += '<span class="ve-theme-swatch-name">' + t.name + '</span>';
      h += '</button>';
    });
    h += '</div>';
    return h;
  }
  var html = '<h3 class="ve-settings-section-title">Tema</h3>';
  html += '<p class="ve-settings-desc">Uygulamanın renk paletini değiştirir. Seçim anında uygulanır ve hatırlanır.</p>';
  html += group('Sade — Koyu', sadeDark,
    'Düşük doygunlukta aksan, eşit yüzey basamakları. Uzun oturumlarda ' +
    'gözü yormaz; renk yalnız seçim ve durum bildirir.');
  html += group('Sade — Açık', sadeLight);
  html += group('Koyu', dark);
  html += group('Profesyonel', pro);
  html += group('Açık', light);
  return html;
}

// ─── OTOMATİK KAYDET ───────────────────────────────────────────────────────
function _veSettingsGetAutosaveInterval() {
  var v = 0;
  try { v = parseInt(localStorage.getItem(VE_SETTINGS_AUTOSAVE_INT_KEY), 10) || 0; } catch(e) {}
  if(VE_SETTINGS_AUTOSAVE_INTERVALS.indexOf(v) === -1) v = 0;
  return v;
}
function veSettingsSetAutosaveInterval(min) {
  try { localStorage.setItem(VE_SETTINGS_AUTOSAVE_INT_KEY, String(min)); } catch(e) {}
  _veRestartAutosave();
  veSettingsShowSection('autosave'); // refresh UI
}
function _veRestartAutosave() {
  if(_veAutosaveTimerId) { clearInterval(_veAutosaveTimerId); _veAutosaveTimerId = null; }
  var min = _veSettingsGetAutosaveInterval();
  if(min > 0) {
    _veAutosaveTimerId = setInterval(_veAutosaveNow, min * 60 * 1000);
  }
}
function _veAutosaveNow() {
  // Not: Köke-çökme yan-etkisi _veSettingsBuildProjectData() içindeki
  // veSaveActiveTabStateKeepView() ile telafi edilir — alt-topolojideyken yedek
  // alınca kullanıcı ana topolojiye atılmaz, bulunduğu yere geri getirilir.
  try {
    var data = _veSettingsBuildProjectData();
    if(!data) return;
    localStorage.setItem(VE_SETTINGS_AUTOSAVE_KEY, JSON.stringify(data));
    localStorage.setItem(VE_SETTINGS_AUTOSAVE_TS_KEY, String(Date.now()));
    // Sessiz — sık olduğu için toast atmıyoruz; Ayarlar açıksa zaman damgası yenilensin
    if(_veSettingsCurrentSection === 'autosave') {
      var ov = document.getElementById('ve-settings-overlay');
      if(ov && ov.style.display !== 'none') veSettingsShowSection('autosave');
    }
  } catch(e) { console.warn('[autosave]', e); }
}
function veSettingsAutosaveNow() {
  _veAutosaveNow();
  if(typeof showToast === 'function') showToast('Yedek alındı', 'info');
  veSettingsShowSection('autosave');
}
function veSettingsRestoreAutosave() {
  var raw = null;
  try { raw = localStorage.getItem(VE_SETTINGS_AUTOSAVE_KEY); } catch(e) {}
  if(!raw) { if(typeof showToast === 'function') showToast('Geri yüklenecek yedek yok', 'warning'); return; }
  if(!confirm('Mevcut çalışma alanı yedekteki içerikle değiştirilecek. Devam edilsin mi?')) return;
  try {
    var data = JSON.parse(raw);
    if(_veSettingsApplyProjectData(data)) {
      veCloseSettings();
      if(typeof showToast === 'function') showToast('Yedek geri yüklendi', 'info');
    }
  } catch(e) {
    if(typeof showToast === 'function') showToast('Yedek bozuk: ' + e.message, 'error');
  }
}
function _veSettingsRenderAutosave() {
  var cur = _veSettingsGetAutosaveInterval();
  var ts = 0;
  try { ts = parseInt(localStorage.getItem(VE_SETTINGS_AUTOSAVE_TS_KEY), 10) || 0; } catch(e) {}
  var hasBackup = false;
  try { hasBackup = !!localStorage.getItem(VE_SETTINGS_AUTOSAVE_KEY); } catch(e) {}
  function fmtAgo(ms) {
    if(!ms) return '—';
    var diff = Math.max(0, Date.now() - ms);
    var sec = Math.floor(diff / 1000);
    if(sec < 60) return sec + ' sn önce';
    var min = Math.floor(sec / 60);
    if(min < 60) return min + ' dk önce';
    var h = Math.floor(min / 60);
    if(h < 24) return h + ' sa önce';
    var d = Math.floor(h / 24);
    return d + ' gün önce';
  }
  var html = '<h3 class="ve-settings-section-title">Periyodik Yedekleme</h3>';
  html += '<p class="ve-settings-desc">Aktif projeyi belirli aralıklarla tarayıcı depolamasına otomatik kaydeder. Beklenmedik kapanmalarda son yedek "Geri yükle" ile açılabilir.</p>';
  html += '<div class="ve-settings-row"><span class="ve-settings-label">Sıklık</span><div class="ve-settings-radios">';
  var labels = { 0: 'Kapalı', 5: '5 dakika', 10: '10 dakika', 30: '30 dakika' };
  VE_SETTINGS_AUTOSAVE_INTERVALS.forEach(function(v) {
    var checked = (v === cur) ? ' checked' : '';
    html += '<label class="ve-settings-radio"><input type="radio" name="autosave-int" value="' + v + '"' + checked + ' onchange="veSettingsSetAutosaveInterval(' + v + ')"> ' + labels[v] + '</label>';
  });
  html += '</div></div>';
  html += '<div class="ve-settings-row"><span class="ve-settings-label">Son yedek</span><div class="ve-settings-value">' + fmtAgo(ts) + '</div></div>';
  html += '<div class="ve-settings-btn-row">';
  html += '<button class="ve-settings-btn" onclick="veSettingsAutosaveNow()"><span class="mf-ico mf-ico-save"></span> Şimdi yedekle</button>';
  if(hasBackup) {
    html += '<button class="ve-settings-btn ve-settings-btn-primary" onclick="veSettingsRestoreAutosave()"><span class="mf-ico mf-ico-upload"></span> Yedeği geri yükle</button>';
  }
  html += '</div>';
  return html;
}

// ─── KLAVYE KISAYOLLARI ────────────────────────────────────────────────────
function _veSettingsRenderShortcuts() {
  var rows = [
    ['Esc',                'Açık pencereyi/modali/seçimi kapat'],
    ['Delete / Backspace', 'Seçili bileşeni/bağlantıyı sil'],
    ['Ctrl + Z',           'Geri al'],
    ['Ctrl + Y / Ctrl + Shift + Z', 'Yinele'],
    ['Ctrl + C',           'Seçili bileşeni kopyala'],
    ['Enter',              'Aktif girdiyi onayla / yeniden adlandırma kaydet'],
    ['Mouse: Sol sürükle', 'Canvas alanını kaydır'],
    ['Mouse: Tekerlek',    'Yakınlaştır / uzaklaştır'],
    ['Mouse: Sürükle (bileşen)', 'Topolojiye bileşen ekle']
  ];
  var html = '<h3 class="ve-settings-section-title">Klavye & Fare Kısayolları</h3>';
  html += '<p class="ve-settings-desc">Sıkça kullanılan kontroller.</p>';
  html += '<table class="ve-settings-table"><tbody>';
  rows.forEach(function(r) {
    html += '<tr><td><kbd>' + r[0] + '</kbd></td><td>' + r[1] + '</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

// ─── VERİ YÖNETİMİ ─────────────────────────────────────────────────────────
function _veSettingsLocalStorageBytes() {
  var total = 0;
  try {
    for(var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      var v = localStorage.getItem(k) || '';
      total += k.length + v.length;
    }
  } catch(e) {}
  return total;
}
function _veSettingsFmtBytes(n) {
  if(n < 1024) return n + ' B';
  if(n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}
function veSettingsResetPreferences() {
  if(!confirm('Tema, panel durumu ve diğer tercihler sıfırlanacak (oturum ve otomatik yedek korunur). Devam edilsin mi?')) return;
  var keep = { 'mfsim_auth_token': 1, 'mfsim_auth_rl': 1, 'mf-autosave-data': 1, 'mf-autosave-ts': 1, 'mf-autosave-interval': 1 };
  try {
    var keys = [];
    for(var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.forEach(function(k) { if(!keep[k]) localStorage.removeItem(k); });
  } catch(e) {}
  if(typeof showToast === 'function') showToast('Tercihler sıfırlandı, sayfa yenileniyor...', 'info');
  setTimeout(function() { location.reload(); }, 600);
}
function veSettingsClearAutosave() {
  if(!confirm('Otomatik yedek silinecek. Devam edilsin mi?')) return;
  try {
    localStorage.removeItem(VE_SETTINGS_AUTOSAVE_KEY);
    localStorage.removeItem(VE_SETTINGS_AUTOSAVE_TS_KEY);
  } catch(e) {}
  if(typeof showToast === 'function') showToast('Otomatik yedek silindi', 'info');
  veSettingsShowSection('data');
}
function veSettingsClearAll() {
  if(!confirm('TÜM yerel veriler silinecek (oturum, tema, yedek, tercihler) ve uygulama yeniden başlatılacak. Bu işlem geri alınamaz. Devam edilsin mi?')) return;
  try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
  setTimeout(function() { location.reload(); }, 300);
}
function _veSettingsRenderData() {
  var bytes = _veSettingsLocalStorageBytes();
  var keys = [];
  try {
    for(var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
  } catch(e) {}
  var hasBackup = false;
  try { hasBackup = !!localStorage.getItem(VE_SETTINGS_AUTOSAVE_KEY); } catch(e) {}
  var html = '<h3 class="ve-settings-section-title">Yerel Depolama</h3>';
  html += '<p class="ve-settings-desc">Uygulama tüm tercih ve yedeklerini tarayıcının yerel depolamasında tutar.</p>';
  html += '<div class="ve-settings-row"><span class="ve-settings-label">Toplam boyut</span><div class="ve-settings-value">' + _veSettingsFmtBytes(bytes) + ' (' + keys.length + ' anahtar)</div></div>';
  html += '<div class="ve-settings-btn-row" style="flex-direction:column; align-items:stretch; gap:8px; margin-top:14px;">';
  html += '<button class="ve-settings-btn" onclick="veSettingsResetPreferences()"><span class="mf-ico mf-ico-refresh"></span> Tercihleri sıfırla<small> — tema/panel/sidebar (oturum & yedek korunur)</small></button>';
  if(hasBackup) {
    html += '<button class="ve-settings-btn" onclick="veSettingsClearAutosave()"><span class="mf-ico mf-ico-trash"></span> Otomatik yedeği sil</button>';
  }
  html += '<button class="ve-settings-btn ve-settings-btn-danger" onclick="veSettingsClearAll()"><span class="mf-ico mf-ico-trash"></span> Tüm verileri sil + yeniden başlat</button>';
  html += '</div>';
  return html;
}

// ─── HAKKINDA ──────────────────────────────────────────────────────────────
function _veSettingsRenderAbout() {
  var html = '<h3 class="ve-settings-section-title">MFSim</h3>';
  html += '<p class="ve-settings-desc">Tarayıcı tabanlı Araç Performans simülasyon ortamı.</p>';
  html += '<div class="ve-settings-row"><span class="ve-settings-label">Versiyon</span><div class="ve-settings-value">' + (window.__mfsimVersion || 'dev') + '</div></div>';
  html += '<div class="ve-settings-row"><span class="ve-settings-label">Lisans</span><div class="ve-settings-value">ISC</div></div>';
  html += '<div class="ve-settings-row"><span class="ve-settings-label">Kaynak kod</span><div class="ve-settings-value"><a href="https://github.com/kaydgn/MFSim" target="_blank" rel="noopener">github.com/kaydgn/MFSim</a></div></div>';
  html += '<div class="ve-settings-subhead" style="margin-top:18px;">Açık kaynak bağımlılıklar</div>';
  html += '<table class="ve-settings-table"><tbody>';
  var deps = [
    ['Three.js',          'r0.149',      'MIT'],
    ['Plotly.js',         '2.35 (gl3d)', 'MIT'],
    ['Leaflet',           '1.9.4',       'BSD-2'],
    ['Lucide ikonlar',    '—',           'ISC'],
    ['Inter font',        '5.0.18',      'SIL OFL 1.1']
  ];
  deps.forEach(function(d) {
    html += '<tr><td>' + d[0] + '</td><td><small style="opacity:0.7;">' + d[1] + '</small></td><td><small style="opacity:0.7;">' + d[2] + '</small></td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

// ─── Proje veri serileştirme yardımcıları (autosave için) ──────────────────
function _veSettingsBuildProjectData() {
  if(typeof veTabs === 'undefined') return null;
  // Görünümü koruyan varyant: alt-topolojideyken yedek alınca kullanıcı köke atılmaz.
  if(typeof veSaveActiveTabStateKeepView === 'function') veSaveActiveTabStateKeepView();
  else if(typeof veSaveActiveTabState === 'function') veSaveActiveTabState();
  return {
    version: 2,
    projectName: (typeof veProjectName !== 'undefined') ? (veProjectName || '') : '',
    activeModule: (typeof veActiveModule !== 'undefined') ? (veActiveModule || '') : '',
    tabCounter: (typeof veTabCounter !== 'undefined') ? veTabCounter : 0,
    activeTabIdx: (typeof veActiveTabIdx !== 'undefined') ? veActiveTabIdx : 0,
    tabs: veTabs.map(function(tab) {
      // Otomatik yedek localStorage'a yazılır (kota ~5-10 MB). Simülasyon
      // sonuçları buraya sığmaz ve yedeği sessizce bozar; kurtarma için
      // önemli olan topolojidir. Bu yüzden sonuçları hiç yazmıyoruz —
      // yedekten dönünce sonuçlar tek "Hesapla" ile yeniden üretilir.
      // Fallback de veBuildCleanTabState ile AYNI alan kümesini üretmeli;
      // schemaVersion/annotations burada da düşerse yedekten dönüş notları
      // siler ve LEGACY migrasyonu kullanıcı girdilerini ezer.
      var cleanState = (typeof veBuildCleanTabState === 'function')
        ? veBuildCleanTabState(tab.state, { stripResults: true })
        : (tab.state ? {
            schemaVersion: (tab.state.schemaVersion !== undefined && tab.state.schemaVersion !== null)
              ? tab.state.schemaVersion
              : (typeof VE_SCHEMA_VERSION !== 'undefined' ? VE_SCHEMA_VERSION : 2),
            nodes: tab.state.nodes,
            connections: tab.state.connections,
            compCounter: tab.state.compCounter,
            canvasOffset: tab.state.canvasOffset,
            canvasZoom: tab.state.canvasZoom,
            simResults: null,
            resultSlots: tab.state.resultSlots || [{},{},{},{}],
            annotations: tab.state.annotations || []
          } : null);
      return { id: tab.id, name: tab.name, state: cleanState };
    })
  };
}
function _veSettingsApplyProjectData(data) {
  if(!data || data.version !== 2 || !data.tabs || !data.tabs.length) {
    if(typeof showToast === 'function') showToast('Geçersiz yedek verisi', 'error');
    return false;
  }
  // Yedekten dönüş de bir PROJE yüklemesidir: açık alt-topoloji gezinme yolu
  // önceki projeye aittir, temizlenmezse ilk arka-plan kaydı onu geri yazar
  // (bkz. veResetSubtopoNav — topology.js).
  if(typeof veResetSubtopoNav === 'function') veResetSubtopoNav();
  if(typeof veClearCanvasDOM === 'function') veClearCanvasDOM();
  veTabs = [];
  veTabCounter = data.tabCounter || data.tabs.length;
  data.tabs.forEach(function(t) {
    // Yükleme sırasında iç içe subTopology'yi hafiflet (bkz. veSanitizeEmbeddedState):
    // eski yedeklerde undo geçmişi + tam sim gömülü olabilir; belleği sınırla.
    var st = (t.state && typeof veSanitizeEmbeddedState === 'function')
      ? veSanitizeEmbeddedState(t.state) : t.state;
    veTabs.push({
      id: t.id, name: t.name, state: st,
      nodeCount: (st && st.nodes) ? st.nodes.length : 0,
      connCount: (st && st.connections) ? st.connections.length : 0
    });
  });
  veActiveTabIdx = Math.min(data.activeTabIdx || 0, veTabs.length - 1);
  veActiveModule = 'full-throttle';
  var ov = document.getElementById('ve-module-overlay');
  if(ov) ov.style.display = 'none';
  if(typeof veShowAllSidebarComponents === 'function') veShowAllSidebarComponents();
  if(typeof veLoadTabState === 'function') veLoadTabState(veTabs[veActiveTabIdx]);
  if(data.projectName) {
    veProjectName = data.projectName;
    if(typeof veSetProjectNameButton === 'function') veSetProjectNameButton(veProjectName);
  }
  if(typeof veRenderTabs === 'function') veRenderTabs();
  return true;
}

// Init: kayıtlı aralığa göre otomatik kaydet timer'ını başlat
(function _veSettingsInit() {
  // Modüller geç yüklendiği için biraz bekle ki diğer ortam hazır olsun
  setTimeout(_veRestartAutosave, 1500);
})();
