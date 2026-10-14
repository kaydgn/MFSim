// ============================================================================
// AYARLAR MODALI
// ============================================================================
// Açılış: proje menüsündeki "Ayarlar" öğesinden. 5 bölüm:
//   - Görünüm (Tema)        — top-right palet butonundan taşındı
//   - Otomatik kaydet       — periyodik localStorage yedeği
//   - Klavye kısayolları    — "?" penceresiyle aynı liste (shortcuts-help.js)
//   - Veri yönetimi         — tercih sıfırlama, yedek silme, tam sıfırlama
//   - Hakkında              — sürüm künyesi, lisans, bağımlılıklar
// Bölümün başlığı menünün adıdır (_veSettingsBaslik).
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

// ─── Bölüm başlığı MENÜNÜN ADIDIR ──────────────────────────────────────────
// Başlıklar ayrı yazılıyordu ve beş bölümün dördünde menüden farklıydı
// ("Otomatik kaydet" → "Periyodik yedekleme", "Veri yönetimi" → "Yerel
// depolama", "Hakkında" → "MFSim"). Ad TEK yerde, index.html'deki menüde;
// başlık oradan okunur. Kapı: tests/unit/ayarlar-bolum.test.js.
function _veSettingsBaslik(name) {
  var b = (typeof document !== 'undefined')
    ? document.querySelector('.ve-settings-nav-item[data-section="' + name + '"]') : null;
  var ad = b ? b.textContent.replace(/\s+/g, ' ').trim() : name;
  return '<h3 class="ve-settings-section-title">' + ad + '</h3>';
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
  // VARSAYILAN BURADA TUTULMAZ — js/theme.js'ten okunur. Bu pencere eskiden
  // kendi varsayılanını tutuyordu ve ayrışmıştı: program 'pearl' açılıyor,
  // pencere 'Midnight' işaretli gösteriyordu (ölçüldü 2026-09-22). Kopyayı
  // kapıyla korumak yerine kopyanın kendisi kaldırıldı.
  var current = (typeof veThemeStoredKip === 'function') ? veThemeStoredKip() : 'acik';

  // ÜÇ KİP — ondokuz tema kartının yerine. 'sistem' bir palet değil bir
  // DAVRANIŞ: işletim sistemi gün batımında koyuya dönünce program da döner.
  // Bu yüzden onun pulu iki zemini yan yana gösterir.
  //
  // swatch: [zemin, yüzey, aksan] — css/styles.css'teki blokların GERÇEK
  // değerleri. Pul aktif temanın değişkenlerini kullanamaz (üç kart da aynı
  // görünürdü), bu yüzden renkler burada sabit; palet değişirse burası da
  // değişmeli. Kapı: tests/unit/theme-consistency.test.js.
  var kipler = [
    { id: 'acik',   name: 'Açık',   swatch: ['#f0ede7', '#e6e1d8', '#a8502b'] },
    { id: 'koyu',   name: 'Koyu',   swatch: ['#1a1815', '#2a2621', '#d9763f'] },
    { id: 'sistem', name: 'Sistem', swatch: ['#f0ede7', '#1a1815', '#a8502b'] }
  ];

  var html = _veSettingsBaslik('appearance');

  // ── KİMLİK ───────────────────────────────────────────────────────────
  // Üst bandın avatarı buradan besleniyor. Ad TARAYICIDA durur, projeye
  // YAZILMAZ: dosyayı paylaşan herkes onu da paylaşırdı.
  var _kAd = (typeof veKimlikAd === 'function') ? veKimlikAd() : '';
  var _kBh = (typeof veKimlikBasHarf === 'function') ? veKimlikBasHarf(_kAd) : '';
  // Avatar hesap menüsündekiyle AYNI daire (.ve-avatar-menu-av, boşu dâhil):
  // bu bloğun sınıflarının kuralı hiç yazılmamıştı ve baş harfler 16 px
  // çıplak metin olarak ayrı satıra düşüyordu (ölçüldü).
  html += '<h4 class="ve-settings-subhead">Kimlik</h4>'
       +  '<div class="ve-set-kimlik">'
       +    '<span class="ve-avatar-menu-av ve-set-kimlik-av' + (_kBh ? '' : ' bos') + '" aria-hidden="true">' + _kBh + '</span>'
       +    '<label class="ve-fp-f" style="flex:1;">'
       +      '<span class="ve-fp-l">Ad</span>'
       +      '<input class="ve-fp-inp ve-fp-inp--text" id="ve-set-kimlik-ad" type="text"'
       +      ' value="' + String(_kAd).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"'
       +      ' placeholder="Adın ve soyadın" maxlength="40"'
       +      ' onchange="veKimlikAdYaz(this.value); veSettingsShowSection(\'appearance\');">'
       +    '</label>'
       +  '</div>'
       +  '<p class="ve-set-not">Avatarda baş harfleri görünür. Bu tarayıcıda saklanır,'
       +  ' proje dosyasına yazılmaz.</p>';
  html += '<h4 class="ve-settings-subhead">Tema</h4>';
  html += '<p class="ve-settings-desc">Program tek bir tasarım dili taşır; ' +
          'seçtiğin şey o dilin zemini. Seçim anında uygulanır ve hatırlanır.</p>';
  html += '<div class="ve-settings-theme-grid">';
  kipler.forEach(function(t) {
    var a = (t.id === current) ? ' active' : '';
    html += '<button class="ve-theme-menu-item' + a + '" data-mf-theme="' + t.id + '" onclick="changeTheme(\'' + t.id + '\')">';
    html += veIkon('check', 've-theme-tik');     // yalnız etkin olanda görünür (CSS)
    html += '<span class="ve-theme-swatch" aria-hidden="true">';
    t.swatch.forEach(function(c) { html += '<i style="background:' + c + '"></i>'; });
    html += '</span>';
    html += '<span class="ve-theme-swatch-name">' + t.name + '</span>';
    html += '</button>';
  });
  html += '</div>';
  html += '<p class="ve-settings-desc">Sistem kipinde işletim sistemi koyuya ' +
          'döndüğünde program da o anda döner; elle seçim yaptıysan dokunulmaz.</p>';
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
  var html = _veSettingsBaslik('autosave');
  html += '<p class="ve-settings-desc">Aktif projeyi belirli aralıklarla tarayıcı depolamasına yedekler. Beklenmedik bir kapanmadan sonra son yedek “Yedeği geri yükle” ile açılır.</p>';
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
// Liste BURADA TUTULMAZ: "?" ile açılan pencerenin çizicisi
// (shortcuts-help.js → veKisayolGruplariHTML). Bu bölüm kendi tablosunu
// tutuyordu ve yanlıştı — "sol sürükle → tuvali kaydır" yazıyordu; sol
// sürükleme seçim kutusu açar, kaydırma sağ tıkla (ui-core.js).
function _veSettingsRenderShortcuts() {
  var html = _veSettingsBaslik('shortcuts');
  html += '<p class="ve-settings-desc">Programın kısayolları — <kbd>?</kbd> ile açılan pencereyle aynı liste.</p>';
  html += '<div class="ve-set-kisayol">' + (typeof veKisayolGruplariHTML === 'function' ? veKisayolGruplariHTML() : '') + '</div>';
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
  if(n < 1024 * 1024) return veSayi(n / 1024, 1) + ' KB';
  return veSayi(n / 1024 / 1024, 2) + ' MB';
}
function veSettingsResetPreferences() {
  if(!confirm('Tema, panel durumu ve diğer tercihler sıfırlanacak (oturum ve otomatik yedek korunur). Devam edilsin mi?')) return;
  var keep = { 'mfsim_auth_token': 1, 'mfsim_auth_rl': 1, 'mf-autosave-data': 1, 'mf-autosave-ts': 1, 'mf-autosave-interval': 1 };
  try {
    var keys = [];
    for(var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.forEach(function(k) { if(!keep[k]) localStorage.removeItem(k); });
  } catch(e) {}
  if(typeof showToast === 'function') showToast('Tercihler sıfırlandı, sayfa yenileniyor…', 'info');
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
  var html = _veSettingsBaslik('data');
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
// Buradaki her satır bir KAYNAKTAN okunur, elle yazılmaz — elle yazılanlar
// sessizce yanlıştı: sürüm hiç yazılmayan bir globalden okunuyor ve HER kopyada
// "dev" çıkıyordu; açıklama üç modülden yalnız birini sayıyordu; lisans ISC
// yazıyordu (LICENSE MIT); Three.js "r0.149" (doğrusu r149 = 0.149.0).
// Kapı: tests/unit/ayarlar-hakkinda.test.js — sürümler gömülü dosyalarla.
var VE_SETTINGS_LISANS = 'MIT';
var VE_SETTINGS_BAGIMLILIK = [
  // [ad, sürüm, lisans] — sürüm, gömülen dosyanın kendi künyesiyle aynı
  ['Three.js',     'r149 (0.149.0)', 'MIT'],
  ['Plotly.js',    '2.35.2 (gl3d)',  'MIT'],
  ['Leaflet',      '1.9.4',          'BSD-2-Clause'],
  ['KaTeX',        '0.16.9',         'MIT'],   // js/mount-report-assets.js (rapor formülleri)
  ['Feather · Lucide ikonları', 'seçki', 'MIT · ISC'],   // tools/ikonlar.json: "çizim dili Feather / Lucide"
  ['Inter',        '5.0.18',         'SIL OFL 1.1']
];
// Gömülü sürüm künyesi (build.js → window.__MFSIM_BUILD): commit · PR · tarih.
// Modüler index.html'de künye YOKTUR; o zaman bunu söyler, "dev" uydurmaz.
function _veSettingsSurum() {
  var b = (typeof window !== 'undefined') ? window.__MFSIM_BUILD : null;
  if(!b || !b.shortSha) return 'künye yok — modüler kopya';
  var t = b.shortSha + (b.prNumber ? ' · PR #' + b.prNumber : '');
  var d = b.date ? new Date(b.date) : null;
  if(d && !isNaN(d.getTime())) t += ' · ' + d.toLocaleDateString('tr-TR');   // makine: tarih — tr-TR yerel biçimi, sayı değil
  return t;
}
// Modüller tip tanımlarından: yeni modül eklenince açıklama kendiliğinden büyür.
function _veSettingsModuller() {
  if(typeof componentDefs === 'undefined') return [];
  return Object.keys(componentDefs).filter(function(k) { return componentDefs[k].isSubsystem; })
    .map(function(k) { return componentDefs[k].name; });
}
function _veSettingsRenderAbout() {
  var html = _veSettingsBaslik('about');
  var mod = _veSettingsModuller();
  html += '<p class="ve-settings-desc">MFSim — tarayıcıda çalışan mühendislik simülasyonu'
    + (mod.length ? ': ' + mod.join(' · ') : '') + '.</p>';
  html += '<div class="ve-settings-row"><span class="ve-settings-label">Sürüm</span><div class="ve-settings-value">' + _veSettingsSurum() + '</div></div>';
  html += '<div class="ve-settings-row"><span class="ve-settings-label">Lisans</span><div class="ve-settings-value">' + VE_SETTINGS_LISANS + '</div></div>';
  html += '<div class="ve-settings-row"><span class="ve-settings-label">Kaynak kod</span><div class="ve-settings-value"><a href="https://github.com/kaydgn/MFSim" target="_blank" rel="noopener">github.com/kaydgn/MFSim</a></div></div>';
  html += '<div class="ve-settings-subhead" style="margin-top:18px;">Açık kaynak bağımlılıklar</div>';
  html += '<table class="ve-settings-table ve-set-bagimlilik"><tbody>';
  VE_SETTINGS_BAGIMLILIK.forEach(function(d) {
    html += '<tr><td>' + d[0] + '</td><td>' + d[1] + '</td><td>' + d[2] + '</td></tr>';
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
