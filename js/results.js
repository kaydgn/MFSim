// ===== SONUÇLAR: SOLVER TAB SİSTEMİ =====
var veSolverTabDefs = [
  { id: 'performance',  name: 'Performans Analizi',  icon: '<span class="mf-ico mf-ico-gauge"></span>', resultKey: 'speed' },
  { id: 'accel-decel',  name: 'Hızlanma-Yavaşlama',  icon: '<span class="mf-ico mf-ico-route"></span>', resultKey: 'segmentDrive' },
  { id: 'obstacle',     name: 'Engel Atlama',         icon: '<span class="mf-ico mf-ico-barrier"></span>', resultKey: 'obstacleCrossing' },
  // Takoz sekmesi ARAÇ çözümünden bağımsızdır: kendi çözücüsü (▶ Hesapla,
  // js/cp-mount.js) window.veMountResults'ı doldurur. Araç hiç çözülmemişken
  // de görünür — kullanıcı yalnız takoz modelini çalıştırmış olabilir.
  { id: 'mount',        name: 'Takoz Çökme-Titreşim', icon: '<span class="mf-ico mf-ico-activity"></span>', resultKey: 'mount' }
];
var veActiveSolverTabId = 'performance';
var veSolverTabSlots = {};  // { tabId: [{},{},{},{}] }
var veSolverTabCollapsed = {}; // { tabId: [false,false,false,false] }

// Takozun kanal kümeleri (js/mount-signals.js build çıktısı) — çözüm yoksa [].
function veMntSets() {
  var R = (typeof window !== 'undefined') ? window.veMountResults : null;
  if(!R || R.error || !R.signals || !R.signals.length) return [];
  return R.signals;
}

// Bir slotun X ekseni bir takoz veri kümesine mi ait? (xAxis.id = "~mnt-XX:kanal")
function veMntSlotSensorId(slot) {
  var id = (slot && slot.xAxis && slot.xAxis.id) ? String(slot.xAxis.id) : '';
  var c = id.indexOf(':');
  var head = (c > 0) ? id.substring(0, c) : id;
  return (typeof veMntSignals !== 'undefined' && veMntSignals.isMountSensor(head)) ? head : null;
}

// Panodaki takoz kanallarını GÜNCEL çözümle uzlaştır.
//
// NEDEN: kanal kimlikleri ve şerit etiketleri panoya (ve projeye) kaydediliyor,
// takoz sonucu ise oturumluk. Kullanıcı bir takozu silip yeniden çözdüğünde ya
// da projeyi takoz çözümü olmadan açtığında pano ELİNDE OLMAYAN bir kanalı
// tutmaya devam eder: şerit adı eski takozu söyler, veri yoktur ya da (kimlik
// konumsal olsaydı) başka bir takozun verisi çizilir.
//
// Bu yüzden sayfa açılışında: var olan kanalların ad/birimi güncel çözümden
// TAZELENİR, artık var olmayanlar DÜŞÜRÜLÜR. Düşmek, yanlış etiketle çizmekten
// iyidir. Dönüş: düşürülen kanal sayısı.
function veMntSyncBoard() {
  if(typeof veMntSignals === 'undefined') return 0;
  var sets = veMntSets();
  var dropped = 0;

  function syncSlot(slot) {
    if(!slot || !slot.sensors || !slot.sensors.length) return;
    var kept = [];
    slot.sensors.forEach(function(s) {
      if(!veMntSignals.isMountSensor(s.id)) { kept.push(s); return; }
      var ch = veMntSignals.channelOf(sets, s.id, s.signal);
      if(!ch) { dropped++; return; }
      s.name = ch.name;                       // etiket asla bayat kalmaz
      s.unit = ch.unit || '';
      kept.push(s);
    });
    slot.sensors = kept;
    // Pano takoz eksenindeydi ve hiç kanal kalmadıysa ekseni de bırak; yoksa
    // araç sinyalleri "Pano X ekseni: Frekans [Hz]" diye reddedilirdi.
    if(!kept.length && veMntSlotSensorId(slot)) delete slot.xAxis;
  }

  (veResultSlots || []).forEach(syncSlot);
  Object.keys(veSolverTabSlots || {}).forEach(function(k) {
    (veSolverTabSlots[k] || []).forEach(syncSlot);
  });
  return dropped;
}

function veGetAvailableSolverTabs() {
  var r = window.veSimResults;
  var tabs = [];
  veSolverTabDefs.forEach(function(def) {
    if(def.id === 'mount') { if(veMntSets().length) tabs.push(def); return; }
    if(!r) return;
    if(def.id === 'performance' && r.speed) tabs.push(def);
    else if(def.id === 'accel-decel' && r.segmentDrive && r.segmentDrive.segmentSummary) tabs.push(def);
    else if(def.id === 'obstacle' && r.obstacleCrossing) tabs.push(def);
  });
  return tabs;
}

// Aktif çözüm sekmesini DEĞİŞTİR: panoyu eskisinin adına kaydet, yenisininkini
// geri yükle. veSwitchSolverTab ile veUpdateSolverTabs'ın ORTAK çekirdeği.
//
// Neden ortak olmak zorunda: pano (veResultSlots) ile sekme kimliği ayrı
// yaşıyor; yalnız kimliği değiştirip panoyu takas etmeyen bir yol, bir sonraki
// gerçek sekme değişiminde YANLIŞ panoyu yanlış sekmenin adına yazar ve
// kullanıcının diğer sekmedeki şeritlerini kalıcı olarak ezer. Sekme çözüm
// silindiği için kendiliğinden kaybolduğunda (takoz çözümü geçersizleşince)
// tam olarak bu olurdu.
function veAdoptSolverTab(tabId) {
  if(tabId === veActiveSolverTabId) return;
  // veTrCloneBoard js/trace-view.js'te ve o modül results.js'ten SONRA yükleniyor.
  // veUpdateSolverTabs yükleme sırasında da çağrılabildiği için burası koşulsuz
  // ona güvenemez. Sığ kopya ile idare etmek YANLIŞ olurdu (iki sekme aynı
  // sensör dizisini paylaşırdı); kopyalayıcı yoksa henüz taşınacak bir pano da
  // yoktur — kimlik değişir, takas atlanır.
  if(typeof veTrCloneBoard !== 'function') { veActiveSolverTabId = tabId; return; }
  veSolverTabSlots[veActiveSolverTabId] = veTrCloneBoard(veResultSlots);
  veActiveSolverTabId = tabId;
  veResultSlots = veSolverTabSlots[tabId]
    ? veTrCloneBoard(veSolverTabSlots[tabId])
    : [{},{},{},{}];
  // Pano her GERİ YÜKLENDİĞİNDE bayat içe aktarma referansları düşer.
  // Yalnızca veEnterResults'ta budamak yetmiyordu: çözücü sekmesi değiştirmek
  // ya da proje açmak da panoyu geri yükleyen bir yol.
  if(typeof veImpPruneSlots === 'function') veImpPruneSlots(veResultSlots);
  // Sekme değişti — görünüm penceresi ve referans imleç önceki koşuya aitti
  if(typeof veTrState !== 'undefined') {
    veTrState.xMin = null; veTrState.xMax = null;
    veTrState.pinX = null; veTrState.cursorX = null;
  }
}

function veUpdateSolverTabs() {
  var container = document.getElementById('ve-solver-tab-bar');
  if(!container) return;
  var tabs = veGetAvailableSolverTabs();

  if(tabs.length === 0) {
    container.style.display = 'none';
    // Hiç sekme kalmadıysa kimlik de sıfırlanmalı. Aksi halde 'mount' takılı
    // kalır; sekme çubuğu gizliyken sonuç ağacı takoz dalını çizip erken döner
    // ve kullanıcı KENDİ sensör ağacına ulaşamaz — çıkış düğmesi de yoktur.
    if(veActiveSolverTabId !== 'performance') veAdoptSolverTab('performance');
    return;
  }
  container.style.display = 'flex';

  // Aktif tab hala geçerli mi? Değilse panoyla BİRLİKTE devret (veAdoptSolverTab).
  var activeValid = tabs.some(function(t) { return t.id === veActiveSolverTabId; });
  if(!activeValid) veAdoptSolverTab(tabs[0].id);

  var html = '';
  tabs.forEach(function(tab) {
    var isActive = tab.id === veActiveSolverTabId;
    html += '<button class="ve-solver-tab' + (isActive ? ' active' : '') + '" onclick="veSwitchSolverTab(\'' + tab.id + '\')" title="' + escapeHTML(tab.name) + '">';
    html += '<span>' + tab.icon + '</span> ' + escapeHTML(tab.name);
    html += '</button>';
  });
  container.innerHTML = html;
}

function veSwitchSolverTab(tabId) {
  if(tabId === veActiveSolverTabId) return;

  // Pano takası veAdoptSolverTab'te. DERİN kopya şart: Object.assign sığ
  // kopyalıyordu, yani `sensors` ve `lanes` dizileri iki çözüm sekmesi arasında
  // AYNI nesneydi. Performans sekmesinde bir sinyal eklemek Engel Atlama
  // sekmesinin listesini de değiştiriyordu.
  veAdoptSolverTab(tabId);

  veUpdateSolverTabs();
  veUpdateResultsTree();
  if(typeof veTrRefresh === 'function') veTrRefresh();
}

// Çözümü ETKİLEYEN bir girdi (Cd, GVW, alın alanı, oran…) değiştiğinde, önceki
// simülasyon sonucu artık BAYAT'tır: detaylı rapor girdi değerlerini (Cd, alan,
// ağırlık…) çözüm ANINDAKİ reportSnapshot'tan okur — kullanıcı Cd'yi düzeltse bile
// yeniden çözmeden rapor eski değeri (ör. varsayılan 0.9) göstermeye devam eder ve
// bu bayat snapshot projeyle birlikte kaydedilip yeniden açılışta da 0.9 gelir.
// Bu yardımcı, saklanan sonucu geçersiz kılar; kullanıcı yeniden çözünce rapor
// güncel girdilerle tutarlı üretilir. Sonuç yoksa hiçbir şey yapmaz (gürültüsüz).
// _silent=true → kullanıcıya toast gösterme (toplu/dolaylı çağrılar için).
function veInvalidateStaleSimResults(reasonMsg, _silent) {
  if(typeof window === 'undefined' || !window.veSimResults) return false;
  window.veSimResults = null;
  // Aktif sekmenin saklı sonucunu da temizle ki sekme/rapor tutarlı kalsın.
  try {
    if(typeof veTabs !== 'undefined' && veTabs[veActiveTabIdx] && veTabs[veActiveTabIdx].state) {
      veTabs[veActiveTabIdx].state.simResults = null;
    }
  } catch(e) {}
  if(!_silent && reasonMsg && typeof showToast === 'function') showToast(reasonMsg, 'info');
  return true;
}

// ===== SONUÇLAR: DATA BROWSER AĞACI =====
function veUpdateResultsTree() {
  var tree = document.getElementById('ve-results-tree');
  if(!tree) return;

  // Ağaç her etkileşimde baştan çizilir. Kaydırma konumu korunmazsa onay
  // kutusuna her tıklayışta liste başa fırlıyordu.
  var _scrollTop = tree.scrollTop;
  if(typeof veSigResetCache === 'function') veSigResetCache();

  // Solver tab bar'ı güncelle
  veUpdateSolverTabs();

  var projectName = 'MFSim Projesi';
  var nameBtn = document.getElementById('ve-project-name-btn');
  if(nameBtn) {
    var t = nameBtn.textContent.replace('⚙','').replace('▾','').trim();
    if(t && t !== 'MFSim') projectName = t;
  }

  // Aktif sekmeyi kaydet (güncel nodes/connections). Alt-topoloji içindeyken sonuç
  // ağacı yenilenirse kullanıcı köke atılmasın diye görünümü koruyan varyant.
  if(veTabs.length > 0) {
    if(typeof veSaveActiveTabStateKeepView === 'function') veSaveActiveTabStateKeepView();
    else veSaveActiveTabState();
  }
  
  // Sensör → sinyal çözümü ve ağaç satırı üretimi js/signal-tree.js'e taşındı
  // (veSigCollectGroups / veSigGroupHTML). Burada yalnızca çerçeve kalıyor.

  // Onay kutularının yazdığı panel ve bu turda çizilen gruplar
  var _targetSlot = veResultSlots[(typeof veSigTargetSlot === 'function') ? veSigTargetSlot() : 0];
  var _allGroups = [];

  var html = '';
  html += veSigToolbarHTML(_targetSlot);

  // ── TAKOZ sekmesi: kanallar araç sensörlerinden değil, takoz çözücüsünden ──
  //
  // Takoz kanalları alt-topolojide (node.data.subTopology) çözülür, ana
  // sekmenin sensör düğümleriyle ilgisi yoktur; ayrıca X eksenleri (Hz / mm / g)
  // araç sinyallerinin zaman eksenine hiç uymaz. Bu yüzden iki liste
  // KARIŞTIRILMAZ: takoz sekmesi kendi ağacını gösterir. Aksi halde kullanıcı
  // aynı listede iki farklı X alanından sinyal işaretleyip anlamsız bir eğri
  // elde ederdi (pano tek eksen kuralı bunu bırakma anında reddederdi ama
  // sebebi listede görünmezdi).
  // Kanal kalmadıysa (çözüm geçersizleşti) takoz dalı çizilmez — aksi halde
  // boş bir dal ve erken dönüş, kullanıcının kendi sensör ağacını erişilemez
  // kılardı. veUpdateSolverTabs kimliği zaten 'performance'a çeker; bu kontrol
  // o iki adımın arasındaki tek karede bile yanlış ağaç çizilmesini önler.
  if(veActiveSolverTabId === 'mount' && veMntSets().length > 0) {
    var mntGroups = (typeof veMntSignals !== 'undefined')
      ? veMntSignals.groups(veMntSets()) : [];
    var mntChannelCount = 0;
    mntGroups.forEach(function(g) { mntChannelCount += g.items.length; });

    html += '<div class="ve-tree-item">';
    html += '<div class="ve-tree-row">';
    html += '<span class="arrow" onclick="veToggleTree(this.parentElement)">▼</span>' +
            '<span class="icon"><span class="mf-ico mf-ico-activity"></span></span>' +
            '<span style="font-weight:600;">Takoz Çökme-Titreşim</span>';
    if(mntChannelCount > 0) {
      html += ' <span style="font-size:var(--fs-tiny); color:var(--text-muted); margin-left:auto;">' +
              mntChannelCount + ' sinyal</span>';
    }
    html += '</div>';
    html += '<div class="ve-tree-children open">';

    var mntShown = veSigDecorateOpen(
      veSigApplyFilter(mntGroups, _targetSlot, veSigState.query, veSigState.filter), _targetSlot);
    mntShown.forEach(function(g) { _allGroups.push(g); });

    if(mntShown.length === 0) {
      html += '<div class="vsig-empty">' +
        (veSigState.query ? 'Aramayla eşleşen sinyal yok.'
                          : (veSigState.filter === 'on' ? 'Ölçüm penceresinde çizili sinyal yok.'
                                                        : 'Bu filtrede sinyal yok.')) + '</div>';
    } else {
      mntShown.forEach(function(g) { html += veSigGroupHTML(g, _targetSlot, veSigState.query); });
    }

    html += '</div></div>';
    html += veMntTreeReportHTML();

    veSigLastGroups = _allGroups;
    var mntInspecting = !!veSigState.inspect;
    if(mntInspecting) html = veSigInspectorHTML();
    tree.innerHTML = html;
    if(!mntInspecting) tree.scrollTop = _scrollTop;
    veSigBindTree(tree);
    return;
  }

  html += '<div class="ve-tree-item">';
  html += '<div class="ve-tree-row">';
  html += '<span class="arrow" onclick="veToggleTree(this.parentElement)">▼</span><span class="icon"><span class="mf-ico mf-ico-folder"></span></span><span style="font-weight:600;">' + projectName + '</span>';
  html += '</div>';
  html += '<div class="ve-tree-children open">';

  // Her sekme bir alt klasör
  veTabs.forEach(function(tab, tabIdx) {
    var isActive = (tabIdx === veActiveTabIdx);
    var tabNodes = isActive ? nodes : ((tab.state && tab.state.nodes) ? tab.state.nodes : []);
    var tabConns = isActive ? connections : ((tab.state && tab.state.connections) ? tab.state.connections : []);
    var tabSimR = isActive ? window.veSimResults : ((tab.state && tab.state.simResults) ? tab.state.simResults : null);
    
    // Sekme düğüm nesnelerini hazırla (aktif olmayan sekmelerde def eklenmeli)
    var tabNodeObjs = isActive ? nodes : tabNodes.map(function(n) {
      return { id: n.id, type: n.type, customName: n.customName || '', data: n.data || {} };
    });
    
    var sensorCount = tabNodeObjs.filter(function(n) { return n.type === 'sensor'; }).length;
    // Sihirbaz sanal sensör sayısı
    var tabWizNode = tabNodeObjs.find(function(n) { return n.type === 'sensor-wizard' && n.data && n.data.sensorsInstalled; });
    var tabWizSensors = tabWizNode ? (tabWizNode.data.activeSensors || []) : [];
    var totalSensorCount = sensorCount + tabWizSensors.length;
    var hasSim = !!tabSimR;

    var tabIcon = hasSim ? '<span class="mf-ico mf-ico-check-circle"></span>' : (totalSensorCount > 0 ? '<span class="mf-ico mf-ico-bar-chart"></span>' : '<span class="mf-ico mf-ico-folder"></span>');
    var tabLabel = tab.name + (hasSim ? '' : ' (çözülmedi)');

    // Prefix: aktif sekme → sensörId direkt, diğer → @tabIdx:sensörId
    var prefix = isActive ? '' : ('@' + tabIdx + ':');

    // Ölçüm kanalları bileşen bazında TEK listede toplanır: fiziksel
    // sensörler + sihirbazın sanal sensörleri. Eski ağaçta bunlar ayrı
    // dallardı (bileşen → yön → sensör → sinyal, dört seviye) ve aynı sinyal
    // iki ayrı yerde görünebiliyordu. Artık bileşen → sinyal, iki seviye.
    var tabGroups = veSigCollectGroups(tabNodeObjs, tabConns, tabWizSensors, prefix);
    var tabChannelCount = 0;
    tabGroups.forEach(function(g) { tabChannelCount += g.items.length; });

    html += '<div class="ve-tree-item">';
    html += '<div class="ve-tree-row" style="padding-left:16px;">';
    html += '<span class="arrow" onclick="veToggleTree(this.parentElement)">' + (totalSensorCount > 0 ? '▶' : ' ') + '</span>';
    html += '<span class="icon">' + tabIcon + '</span>';
    html += '<span style="font-weight:' + (isActive ? '600' : '400') + ';' + (isActive ? 'color:var(--accent-primary);' : '') + '">' + tabLabel + '</span>';
    // Sayaç artık sensör değil SİNYAL sayar: listede görünen satır sayısıyla
    // birebir tutar. "17 sensör" yazıp 24 satır göstermek güven kırıyordu.
    if(tabChannelCount > 0) html += ' <span style="font-size:var(--fs-tiny); color:var(--text-muted); margin-left:auto;">' + tabChannelCount + ' sinyal</span>';
    html += '</div>';

    if(totalSensorCount > 0) {
      html += '<div class="ve-tree-children' + (isActive ? ' open' : '') + '">';
      var shownGroups = veSigDecorateOpen(
        veSigApplyFilter(tabGroups, _targetSlot, veSigState.query, veSigState.filter), _targetSlot);
      shownGroups.forEach(function(g) { _allGroups.push(g); });

      if(shownGroups.length === 0) {
        html += '<div class="vsig-empty">' +
          (veSigState.query ? 'Aramayla eşleşen sinyal yok.'
                            : (veSigState.filter === 'on' ? 'Ölçüm penceresinde çizili sinyal yok.'
                                                          : 'Bu filtrede sinyal yok.')) + '</div>';
      } else {
        shownGroups.forEach(function(g) {
          html += veSigGroupHTML(g, _targetSlot, veSigState.query);
        });
      }

      // Bağlı olmayan sensörler ölçüm vermez — listenin altında, sönük.
      var unbound = tabNodeObjs.filter(function(n) {
        return n.type === 'sensor' && (!n.data || (!n.data.attachedConnection && !n.data.attachedComponent));
      });
      if(unbound.length > 0 && !veSigState.query) {
        html += '<div class="vsig-orphan-head">Bağlı olmayan · ' + unbound.length + '</div>';
        unbound.forEach(function(sn) {
          html += '<div class="vsig-orphan" title="Bir bağlantıya ya da bileşene tutturulmadığı için veri üretmiyor">' +
                  escapeHTML(sn.customName || 'Sensör') + '</div>';
        });
      }

      html += '</div>'; // tree-children (tab content)
    }
    
    html += '</div>'; // tree-item (tab)
  });
  
  html += '</div></div>';

  // ── İçe aktarılan ölçümler (Excel/CSV) ──
  // Ayrı bir dal: bu kanallar topolojiden değil dosyadan geliyor ve sekmeye
  // bağlı değil. Satır/grup üretimi ortak (veSigGroupHTML) — kullanıcı için
  // simülasyon sinyaliyle aynı arayüz: tikle, sürükle, çift tıkla incele.
  if(typeof veImpCollectGroups === 'function') {
    var impGroups = veImpCollectGroups();
    if(impGroups.length > 0) {
      var impChannels = 0;
      impGroups.forEach(function(g) { impChannels += g.items.length; });

      html += '<div style="margin-top:4px; border-top:1px solid var(--border-color); padding-top:4px;">';
      html += '<div class="ve-tree-item">';
      html += '<div class="ve-tree-row" style="display:flex; align-items:center; gap:4px;">';
      html += '<span class="arrow" onclick="veToggleTree(this.parentElement)">▼</span>';
      html += '<span class="icon"><span class="mf-ico mf-ico-upload"></span></span>';
      html += '<span style="font-weight:600;">İçe Aktarılan Ölçümler</span>';
      html += ' <span style="font-size:var(--fs-micro); color:var(--text-muted); margin-left:auto;">' +
              impChannels + ' sinyal</span>';
      html += '</div>';
      html += '<div class="ve-tree-children open">';

      var impShown = veSigDecorateOpen(
        veSigApplyFilter(impGroups, _targetSlot, veSigState.query, veSigState.filter), _targetSlot);
      impShown.forEach(function(g) { _allGroups.push(g); });

      if(impShown.length === 0) {
        html += '<div class="vsig-empty">Aramayla eşleşen sinyal yok.</div>';
      } else {
        impShown.forEach(function(g) {
          html += veSigGroupHTML(g, _targetSlot, veSigState.query);
          // Veri kümesini kaldırma: grup başlığının altında, sönük bir satır.
          html += '<div class="vsig-orphan" style="cursor:pointer;" title="Bu ölçüm dosyasını oturumdan kaldır"' +
                  ' onclick="veImpDropDataset(\'' + escapeHTML(g._import) + '\')">✕ ' +
                  escapeHTML(g.name) + ' — kaldır</div>';
        });
      }
      html += '</div></div></div>';
    }
  }

  // ── Diyagramlar (sihirbaz paketlerinden, aktif solver tab'a göre filtrelenir) ──
  var wizNode = nodes.find(function(n) { return n.type === 'sensor-wizard'; });
  var wizInstalled = wizNode && wizNode.data && wizNode.data.sensorsInstalled;
  var wizPkgs = wizInstalled ? (wizNode.data.installedPackages || []) : [];
  if(wizInstalled && wizPkgs.length > 0 && typeof SENSOR_PACKAGES !== 'undefined') {
    var hasSimForWiz = !!window.veSimResults;
    var _activeTab = typeof veActiveSolverTabId !== 'undefined' ? veActiveSolverTabId : 'performance';

    var filteredPkgs = wizPkgs.filter(function(pkgId) {
      var pkg = SENSOR_PACKAGES.find(function(p) { return p.id === pkgId; });
      return pkg && pkg.solverTab === _activeTab;
    });

    if(filteredPkgs.length > 0) {
      var totalDiags = 0;
      filteredPkgs.forEach(function(pkgId) {
        var pkg = SENSOR_PACKAGES.find(function(p) { return p.id === pkgId; });
        if(pkg) totalDiags += pkg.diagrams.length;
      });

      html += '<div style="margin-top:4px; border-top:1px solid var(--border-color); padding-top:4px;">';
      html += '<div class="ve-tree-item">';
      html += '<div class="ve-tree-row" style="display:flex; align-items:center; gap:4px;">';
      html += '<span class="arrow" onclick="veToggleTree(this.parentElement)">▼</span>';
      html += '<span class="icon"><span class="mf-ico mf-ico-bar-chart"></span></span>';
      html += '<span style="font-weight:600;">Diyagramlar</span>';
      html += ' <span style="font-size:var(--fs-micro); color:var(--text-muted); margin-left:auto;">' + totalDiags + '</span>';
      html += '</div>';
      html += '<div class="ve-tree-children open">';

      filteredPkgs.forEach(function(pkgId) {
        var pkg = SENSOR_PACKAGES.find(function(p) { return p.id === pkgId; });
        if(!pkg) return;

        html += '<div class="ve-tree-item">';
        html += '<div class="ve-tree-row" style="padding-left:16px;">';
        html += '<span class="arrow" onclick="veToggleTree(this.parentElement)">▶</span>';
        html += '<span>' + pkg.name + '</span>';
        html += ' <span style="font-size:var(--fs-micro); color:var(--text-muted); margin-left:auto;">' + pkg.diagrams.length + '</span>';
        html += '</div>';
        html += '<div class="ve-tree-children">';

        // Panonun ortak X ekseni — uyumsuz diyagramlar sürüklenmeden ÖNCE
        // kilitli görünür, kullanıcı deneyerek öğrenmek zorunda kalmaz.
        var _boardX = (typeof veSharedXAxis === 'function') ? veSharedXAxis(veResultSlots) : null;
        var _boardXName = (_boardX && _boardX.xAxis && _boardX.xAxis.name) ? _boardX.xAxis.name : null;

        pkg.diagrams.forEach(function(diag, dIdx) {
          var diagSigDef = (typeof SW_DIAGRAM_SIGNALS !== 'undefined') ? SW_DIAGRAM_SIGNALS[diag.id] : null;
          var is3dDiag = diagSigDef && diagSigDef.z;
          // 3D diyagram muaf: X/Y/Z üç sinyalden gelir, ortak eksene girmez
          var xOk = true;
          if(diagSigDef && !is3dDiag && typeof veXAxisAllowed === 'function') {
            xOk = veXAxisAllowed(veWizDiagXAxis(diagSigDef), diagSigDef.dataSource || '', veResultSlots);
          }
          var canDrag = hasSimForWiz && !!diagSigDef && xOk;
          var diagStyle = canDrag
            ? 'cursor:grab; color:var(--text-primary);'
            : 'cursor:default; color:var(--text-muted); opacity:0.6;';
          var dragAttr = canDrag
            ? ' onmousedown="veStartWizardDiagDrag(event,\'' + pkgId + '\',' + dIdx + ')"'
            : '';

          var reason = !hasSimForWiz || !diagSigDef
            ? ' — Simülasyon gerekli'
            : (!xOk ? ' — Pano X ekseni: ' + (_boardXName || 'Zaman [s]') +
                      ' (bu diyagram ' + veWizDiagXAxis(diagSigDef).name + ' istiyor)'
                    : ' — Slota sürükle');
          var diagIcon = canDrag ? (is3dDiag ? '<span class="mf-ico mf-ico-package"></span>' : '<span class="mf-ico mf-ico-trending-up"></span>') : '<span class="mf-ico mf-ico-lock"></span>';
          html += '<div class="ve-tree-signal" style="padding-left:32px; ' + diagStyle + '"' + dragAttr + ' title="' + diag.name + reason + '">';
          html += diagIcon + ' ' + diag.name;
          if(diag.note) html += ' <span style="font-size:var(--fs-micro); color:var(--accent-warning);">⚠</span>';
          html += '</div>';
        });

        html += '</div></div>';
      });

      html += '</div></div></div>';
    }
  }

  // Detaylı Rapor — aktif solver tab'a göre filtrelenmiş
  if(window.veSimResults) {
    var _activeTab = veActiveSolverTabId;

    // === PERFORMANS ANALİZİ tab'ı ===
    if(_activeTab === 'performance') {
      html += '<div style="margin-top:4px; border-top:1px solid var(--border-color); padding-top:4px;">';
      html += '<div class="ve-tree-row" style="cursor:pointer; display:flex; align-items:center; gap:4px;">';
      html += '<span class="arrow" onclick="veToggleTree(this.parentElement)" style="font-size:var(--fs-micro); width:12px; text-align:center; cursor:pointer; color:var(--text-muted);">▶</span>';
      html += '<span onclick="veRenderDetailedReport()" style="display:flex; align-items:center; gap:4px; flex:1;" title="Tüm raporu görüntüle">';
      html += '<span class="icon"><span class="mf-ico mf-ico-clipboard"></span></span><span style="font-weight:600; color:var(--accent-primary);">Detaylı Rapor</span></span>';
      html += '</div>';
      html += '<div class="ve-tree-children">';
      // Girdi Özeti group
      html += '<div class="ve-tree-row" style="cursor:pointer; padding-left:10px; display:flex; align-items:center; gap:4px;">';
      html += '<span class="arrow" onclick="veToggleTree(this.parentElement)" style="font-size:var(--fs-micro); width:12px; text-align:center; cursor:pointer; color:var(--text-muted);">▶</span>';
      html += '<span onclick="veRenderDetailedReport(\'girdi\')" style="display:flex; align-items:center; gap:4px; flex:1;" title="Girdi Özeti">';
      html += '<span class="icon" style="font-size:var(--fs-tiny);"><span class="mf-ico mf-ico-file-text"></span></span><span style="font-size:var(--fs-body);">Girdi Özeti</span></span></div>';
      html += '<div class="ve-tree-children">';
      var girdiSubs = [
        {id:'platform', icon:'<span class="mf-ico mf-ico-truck"></span>', label:'Platform'},
        {id:'engine', icon:'<span class="mf-ico mf-ico-settings"></span>', label:'Motor'},
        {id:'transmission', icon:'<span class="mf-ico mf-ico-wrench"></span>', label:'Şanzıman'},
        {id:'ecm', icon:'<span class="mf-ico mf-ico-disc"></span>', label:'Konvertör Değerlendirmesi'},
        {id:'driveline', icon:'<span class="mf-ico mf-ico-link"></span>', label:'Aktarma Organları'}
      ];
      girdiSubs.forEach(function(s) {
        html += '<div class="ve-tree-row" onclick="veRenderDetailedReport(\'' + s.id + '\')" style="cursor:pointer; padding-left:24px;" title="' + s.label + '">';
        html += '<span class="icon" style="font-size:var(--fs-micro);">' + s.icon + '</span><span style="font-size:var(--fs-body);">' + s.label + '</span></div>';
      });
      html += '</div>';
      // Araç Performans Özeti group
      html += '<div class="ve-tree-row" style="cursor:pointer; padding-left:10px; display:flex; align-items:center; gap:4px;">';
      html += '<span class="arrow" onclick="veToggleTree(this.parentElement)" style="font-size:var(--fs-micro); width:12px; text-align:center; cursor:pointer; color:var(--text-muted);">▶</span>';
      html += '<span onclick="veRenderDetailedReport(\'performans\')" style="display:flex; align-items:center; gap:4px; flex:1;" title="Araç Performans Özeti">';
      html += '<span class="icon" style="font-size:var(--fs-tiny);"><span class="mf-ico mf-ico-bar-chart"></span></span><span style="font-size:var(--fs-body);">Araç Performans Özeti</span></span></div>';
      html += '<div class="ve-tree-children">';
      html += '<div class="ve-tree-row" onclick="veRenderDetailedReport(\'ft-grade\')" style="cursor:pointer; padding-left:24px;" title="Eğim Kabiliyeti">';
      html += '<span class="icon" style="font-size:var(--fs-micro);"><span class="mf-ico mf-ico-mountain"></span></span><span style="font-size:var(--fs-body);">Eğim Kabiliyeti</span></div>';
      html += '<div class="ve-tree-row" onclick="veRenderDetailedReport(\'ft-accel\')" style="cursor:pointer; padding-left:24px;" title="Hızlanma">';
      html += '<span class="icon" style="font-size:var(--fs-micro);"><span class="mf-ico mf-ico-gauge"></span></span><span style="font-size:var(--fs-body);">Hızlanma</span></div>';
      html += '<div class="ve-tree-row" onclick="veRenderDetailedReport(\'ft-upshifts\')" style="cursor:pointer; padding-left:24px;" title="Vites Geçişleri (Detaylı)">';
      html += '<span class="icon" style="font-size:var(--fs-micro);"><span class="mf-ico mf-ico-bar-chart"></span></span><span style="font-size:var(--fs-body);">Vites Geçişleri (Detaylı)</span></div>';
      html += '</div>';
      html += '</div></div>';
      // Topoloji detayı artık Tam Gaz Hızlanma raporunun içine dahil edildi —
      // ayrı "Topoloji Raporu (TXT)" öğesi bu sekmeden kaldırıldı.
      // Tam Gaz Hızlanma Raporu (TXT)
      html += '<div style="margin-top:2px;">';
      html += '<div class="ve-tree-row" onclick="veRenderTXTReport(\'ft\')" style="cursor:pointer; display:flex; align-items:center; gap:4px;" title="Tam Gaz Hızlanma TXT rapor önizleme">';
      html += '<span class="icon"><span class="mf-ico mf-ico-file-text"></span></span><span style="font-weight:600; color:var(--accent-primary);">Tam Gaz Hızlanma Raporu (TXT)</span></div>';
      html += '</div>';
      // Detay Matematik Hesapları (TXT) — hata avı / matematik doğrulama
      // Transfer kutusu (2+ kademe) varsa Yüksek/Düşük ayrı iz; yoksa tek iz.
      var _ftHasLowRange = (typeof nodes !== 'undefined') && nodes.some(function(nd){
        return nd.type === 'transfer' && nd.data && (nd.data.ftTrGears || []).length > 1;
      });
      if(_ftHasLowRange) {
        html += '<div style="margin-top:2px;">';
        html += '<div class="ve-tree-row" onclick="veRenderTXTReport(\'ft-trace\')" style="cursor:pointer; display:flex; align-items:center; gap:4px;" title="Yüksek kademe — tüm hesaplamaların adım adım (formül + sayı) dökümü">';
        html += '<span class="icon"><span class="mf-ico mf-ico-file-text"></span></span><span style="font-weight:600; color:var(--text-secondary);">Detay Matematik Hesapları — Yüksek Kademe (TXT)</span></div>';
        html += '</div>';
        html += '<div style="margin-top:2px;">';
        html += '<div class="ve-tree-row" onclick="veRenderTXTReport(\'ft-trace-low\')" style="cursor:pointer; display:flex; align-items:center; gap:4px;" title="Düşük kademe — tüm hesaplamaların adım adım (formül + sayı) dökümü">';
        html += '<span class="icon"><span class="mf-ico mf-ico-file-text"></span></span><span style="font-weight:600; color:var(--text-secondary);">Detay Matematik Hesapları — Düşük Kademe (TXT)</span></div>';
        html += '</div>';
      } else {
        html += '<div style="margin-top:2px;">';
        html += '<div class="ve-tree-row" onclick="veRenderTXTReport(\'ft-trace\')" style="cursor:pointer; display:flex; align-items:center; gap:4px;" title="Programın yaptığı tüm hesaplamaların adım adım (formül + sayı) dökümü — doğrulama / hata avı">';
        html += '<span class="icon"><span class="mf-ico mf-ico-file-text"></span></span><span style="font-weight:600; color:var(--text-secondary);">Detay Matematik Hesapları (TXT)</span></div>';
        html += '</div>';
      }
    }

    // === HIZLANMA-YAVAŞLAMA tab'ı ===
    if(_activeTab === 'accel-decel') {
      html += '<div style="margin-top:4px; border-top:1px solid var(--border-color); padding-top:4px;">';
      // Topoloji Raporu (TXT) — modül raporunun üstünde
      if(typeof nodes !== 'undefined' && nodes.length > 0) {
        html += '<div class="ve-tree-row" onclick="veRenderTopologyTXTReport()" style="cursor:pointer; display:flex; align-items:center; gap:4px;" title="Topoloji Detay TXT rapor önizleme">';
        html += '<span class="icon"><span class="mf-ico mf-ico-file-text"></span></span><span style="font-weight:600; color:var(--text-secondary);">Topoloji Raporu (TXT)</span></div>';
      }
      html += '<div class="ve-tree-row" onclick="veRenderSegmentDriveTXTReport()" style="cursor:pointer; display:flex; align-items:center; gap:4px;" title="Hızlanma-Yavaşlama TXT rapor önizleme">';
      html += '<span class="icon"><span class="mf-ico mf-ico-file-text"></span></span><span style="font-weight:600; color:var(--accent-primary);">Hızlanma-Yavaşlama Raporu (TXT)</span></div>';
      html += '</div>';
    }

    // === ENGEL ATLAMA tab'ı ===
    if(_activeTab === 'obstacle' && window.veSimResults.obstacleCrossing) {
      html += '<div style="margin-top:4px; border-top:1px solid var(--border-color); padding-top:4px;">';
      // Topoloji Raporu (TXT) — modül raporunun üstünde
      if(typeof nodes !== 'undefined' && nodes.length > 0) {
        html += '<div class="ve-tree-row" onclick="veRenderTopologyTXTReport()" style="cursor:pointer; display:flex; align-items:center; gap:4px;" title="Topoloji Detay TXT rapor önizleme">';
        html += '<span class="icon"><span class="mf-ico mf-ico-file-text"></span></span><span style="font-weight:600; color:var(--text-secondary);">Topoloji Raporu (TXT)</span></div>';
      }
      html += '<div class="ve-tree-row" onclick="veRenderObstacleCrossingTXTReport()" style="cursor:pointer; display:flex; align-items:center; gap:4px;" title="Engel Atlama TXT rapor önizleme">';
      html += '<span class="icon"><span class="mf-ico mf-ico-file-text"></span></span><span style="font-weight:600; color:var(--accent-primary);">Engel Atlama Raporu (TXT)</span></div>';
      html += '</div>';
    }
  }
  
  // Denetçi ağacın ÜSTÜNE binmez, YERİNE geçer. Kaplama denemesi kaydırılmış
  // ağaçta hizadan kayıyor ve altındaki satırlar tıklanabilir kalıyordu.
  // Gruplar yine de hesaplanır: kapanınca ağaç aynı durumla geri gelir.
  veSigLastGroups = _allGroups;
  var inspecting = !!veSigState.inspect;
  if(inspecting) html = veSigInspectorHTML();

  tree.innerHTML = html;
  // Denetçiye geçerken ağacın kaydırma konumu korunur, denetçiye uygulanmaz
  if(!inspecting) tree.scrollTop = _scrollTop;
  veSigBindTree(tree);
}

// Takoz sekmesinin rapor kısayolu. Sonuçlar panosu SİNYALLERİ gösterir; skaler
// büyüklükler (modal frekanslar, KED matrisi, yük durumu tabloları) Rapor'da
// kalır. Sekmenin bu ikisi arasında kopukluk yaratmaması için Rapor buradan da
// bir tık uzakta olsun — diğer çözüm sekmelerindeki TXT rapor satırıyla aynı
// desen. nodeId yok: motor/ζ girdileri zaten çözüm sonucundan (R.gather) okunur.
function veMntTreeReportHTML() {
  if(typeof veMntGenerateReport !== 'function') return '';
  var h = '<div style="margin-top:4px; border-top:1px solid var(--border-color); padding-top:4px;">';
  h += '<div class="ve-tree-row" onclick="veMntGenerateReport(null)" style="cursor:pointer; display:flex; align-items:center; gap:4px;" ' +
       'title="Takoz çökme-titreşim raporunu üret ve indir — modal frekanslar, KED, yük durumları ve uygunluk tabloları">';
  h += '<span class="icon"><span class="mf-ico mf-ico-file-text"></span></span>' +
       '<span style="font-weight:600; color:var(--accent-primary);">Takoz Çökme-Titreşim Raporu (HTML)</span></div>';
  h += '</div>';
  return h;
}

function veToggleTree(el) {
  var children = el.nextElementSibling;
  if(!children || !children.classList.contains('ve-tree-children')) return;
  children.classList.toggle('open');
  var arrow = el.querySelector('.arrow');
  if(arrow) arrow.textContent = children.classList.contains('open') ? '▼' : '▶';
}

function veToggleGirdiOzeti(hdrEl) {
  var body = hdrEl.nextElementSibling;
  var arrow = hdrEl.querySelector('.dr-gs-arrow');
  if(body.classList.contains('dr-girdi-open')) {
    body.style.maxHeight = body.scrollHeight + 'px';
    body.offsetHeight;
    body.style.maxHeight = '0px';
    body.style.opacity = '0';
    body.classList.remove('dr-girdi-open');
    if(arrow) arrow.textContent = '▼';
    setTimeout(function(){ if(!body.classList.contains('dr-girdi-open')) body.style.display = 'none'; }, 450);
  } else {
    body.style.display = 'block';
    var h = body.scrollHeight;
    body.style.maxHeight = '0px';
    body.style.opacity = '0';
    body.offsetHeight;
    body.style.maxHeight = h + 'px';
    body.style.opacity = '1';
    body.classList.add('dr-girdi-open');
    if(arrow) arrow.textContent = '▲';
    setTimeout(function(){ if(body.classList.contains('dr-girdi-open')) body.style.maxHeight = 'none'; }, 470);
  }
}

function veToggleReportSection(hdrEl) {
  var body = hdrEl.nextElementSibling;
  var arrow = hdrEl.querySelector('.dr-arrow');
  if(!body.classList.contains('dr-open')) {
    // Açılış — gerçek yüksekliği ölç, animasyonla aç
    body.style.display = 'block';
    var h = body.scrollHeight;
    body.style.maxHeight = '0px';
    body.style.opacity = '0';
    body.offsetHeight; // reflow
    body.style.maxHeight = h + 'px';
    body.style.opacity = '1';
    body.classList.add('dr-open');
    if(arrow) arrow.textContent = '▼';
    // Animasyon bitince maxHeight kaldır + canvas'ları yeniden çiz
    setTimeout(function(){
      if(body.classList.contains('dr-open')) {
        body.style.maxHeight = 'none';
        // ECM chart yeniden çiz (boyut sıfırdan geldiği için)
        if(body.querySelector('#dr-ecm-chart') && typeof _drEcmRedraw === 'function') _drEcmRedraw();
        // Engine chart yeniden çiz
        var engCanvas = body.querySelector('#dr-engine-chart');
        if(engCanvas && window.veSimResults && window.veSimResults.reportSnapshot) {
          var R = window.veSimResults.reportSnapshot;
          veDrawEngineChart(R.torqueData, R.governed, R.noLoad, R.fanLossGov, R.otherLossGov);
        }
        // Gradeability chart yeniden çiz
        if(body.querySelector('#gradeChartHigh') && window.veSimResults && window.veSimResults.gradeability) {
          veDrawGradeabilityCharts(window.veSimResults.gradeability);
        }
        // Acceleration chart yeniden çiz
        if(body.querySelector('#accelChartHigh') && window.veSimResults && window.veSimResults.acceleration) {
          veDrawAccelerationCharts(window.veSimResults.acceleration);
        }
        // FT Upshift chart yeniden çiz
        if(body.querySelector('#ftUpshiftChartHigh') && window.veSimResults) {
          veDrawFTUpshiftCharts(window.veSimResults);
        }
      }
    }, 440);
  } else {
    // Kapanış — önce mevcut yüksekliği sabitle, sonra 0'a animasyonla kapat
    body.style.maxHeight = body.scrollHeight + 'px';
    body.offsetHeight; // reflow
    body.style.maxHeight = '0px';
    body.style.opacity = '0';
    body.classList.remove('dr-open');
    if(arrow) arrow.textContent = '▶';
    setTimeout(function(){ if(!body.classList.contains('dr-open')) body.style.display = 'none'; }, 400);
  }
}


// Detaylı Raporu tam ekran overlay olarak göster (simResult snapshot'tan)
// filter: undefined/null = tüm rapor, 'girdi' = Girdi Özeti, 'performans' = Perf Özeti
//         'platform','engine','transmission','ecm','driveline','ft-grade','ft-accel' = tek bölüm
function veRenderDetailedReport(filter) {
  var overlay = document.getElementById('ve-report-overlay');
  if(!overlay) return;
  
  var sim = window.veSimResults;
  if(!sim || !sim.reportSnapshot) {
    showToast('Rapor verisi bulunamadı — önce simülasyon çalıştırın', 'warning');
    return;
  }
  var R = sim.reportSnapshot;
  
  // Filter helpers
  var showAll = !filter;
  var isGirdi = filter === 'girdi';
  var isPerf = filter === 'performans';
  var girdiIds = ['platform','engine','transmission','ecm','driveline'];
  var perfIds = ['ft-grade','ft-accel','ft-upshifts'];
  function shouldShow(sectionId) {
    if(showAll) return true;
    if(isGirdi) return girdiIds.indexOf(sectionId) >= 0;
    if(isPerf) return perfIds.indexOf(sectionId) >= 0;
    return sectionId === filter;
  }
  
  // Title for filtered view
  var reportTitle = 'Detaylı Rapor';
  var filterLabels = {
    'girdi': 'Girdi Özeti', 'performans': 'Araç Performans Özeti',
    'platform': 'Platform', 'engine': 'Motor', 'transmission': 'Şanzıman',
    'ecm': 'Konvertör Değerlendirmesi', 'driveline': 'Aktarma Organları',
    'ft-grade': 'Eğim Kabiliyeti', 'ft-accel': 'Hızlanma',
    'ft-upshifts': 'Vites Geçişleri (Detaylı)'
  };
  if(filter && filterLabels[filter]) reportTitle = filterLabels[filter];
  
  // Hesaplamalar
  var revPerKm = R.tireRadius > 0 ? (1000 / (2 * Math.PI * R.tireRadius)).toFixed(0) : '—';
  
  // Peak torque/power
  var peakTorque = 0, peakTorqueRpm = 0, peakPower = 0, peakPowerRpm = 0, govPower = 0;
  R.torqueData.forEach(function(p) {
    if(p.torque > peakTorque) { peakTorque = p.torque; peakTorqueRpm = p.rpm; }
    var pw = p.power || (p.torque * p.rpm * Math.PI / 30000);
    if(pw > peakPower) { peakPower = pw; peakPowerRpm = p.rpm; }
    if(p.rpm === R.governed) govPower = pw;
  });
  
  // Tablo yardımcıları
  function row(label, value) {
    return '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); width:230px; font-size:var(--fs-md);">' + label + '</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">' + value + '</td></tr>';
  }
  function subHeader(title) {
    return '<tr><td colspan="2" style="padding:7px 14px; font-weight:700; font-size:var(--fs-md); color:var(--text-primary); font-style:italic; border-bottom:1px solid var(--border-color); background:var(--bg-tertiary);">' + title + '</td></tr>';
  }
  function tableWrap(content) {
    return '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary);">' + content + '</table>';
  }
  
  // ═══ PLATFORM ═══
  var platformHTML = '';
  platformHTML += subHeader('Alan ve Ağırlık');
  platformHTML += row('Alın Alanı', R.frontalArea.toFixed(3) + ' m²');
  platformHTML += row('Yükseklik / Genişlik', R.height.toFixed(3) + ' m / ' + R.width.toFixed(3) + ' m');
  platformHTML += row('Aerodinamik Direnç Katsayısı (Cd)', R.cd.toFixed(3));
  platformHTML += row('Brüt Araç Ağırlığı', R.gvw.toFixed(0) + ' kg');
  platformHTML += subHeader('Lastikler');
  platformHTML += row('Seçili Lastik', R.tireName);
  platformHTML += row('Lastik Devir/km', revPerKm + ' devir/km');
  platformHTML += row('Lastik Yuvarlanma Yarıçapı', R.tireRadius.toFixed(3) + ' m');
  platformHTML += row('Yuvarlanma Direnci (Crr)', R.crr.toFixed(4));
  platformHTML += row('Yüzey Faktörü', R.surfFactor.toFixed(2));
  platformHTML += row('Lastik/Tekerlek Ataleti (tahmini)', R.tireInertia.toFixed(4) + ' kg·m²');
  platformHTML = tableWrap(platformHTML);
  
  // ═══ MOTOR KAYIPLARI ═══
  var accData = R.accessories.length > 0 ? R.accessories : [
    {name:'Fan (Kavramalı Fan)',standardLoss:0,userLoss:0},{name:'Alternatör / Jeneratör',standardLoss:0,userLoss:0},
    {name:'Hava Kompresörü',standardLoss:0,userLoss:0},{name:'Direksiyon Pompası',standardLoss:0,userLoss:0},
    {name:'Klima',standardLoss:0,userLoss:0},{name:'Ek Tahrik',standardLoss:0,userLoss:0}
  ];
  var accHTML = '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary); font-size:var(--fs-md);">';
  accHTML += '<thead><tr style="background:var(--bg-tertiary);"><th style="padding:6px 14px; text-align:left; border-bottom:1px solid var(--border-color); color:var(--text-secondary); font-weight:500;">Aksesuar</th>';
  accHTML += '<th style="padding:6px 14px; text-align:center; border-bottom:1px solid var(--border-color); color:var(--text-secondary); font-weight:500; width:150px;">Standart Kayıp (kW)</th>';
  accHTML += '<th style="padding:6px 14px; text-align:center; border-bottom:1px solid var(--border-color); color:var(--text-secondary); font-weight:500; width:170px;">Kullanıcı Tanımlı Kayıp (kW)</th>';
  accHTML += '</tr></thead><tbody>';
  var totalStd = 0, totalUser = 0;
  accData.forEach(function(a) {
    totalStd += a.standardLoss; totalUser += a.userLoss;
    accHTML += '<tr><td style="padding:5px 14px; border-bottom:1px solid var(--border-light); color:var(--text-primary);">' + a.name + '</td>';
    accHTML += '<td style="padding:5px 14px; border-bottom:1px solid var(--border-light); text-align:center; font-weight:600; color:var(--text-primary);">' + a.standardLoss.toFixed(1) + '</td>';
    accHTML += '<td style="padding:5px 14px; border-bottom:1px solid var(--border-light); text-align:center; font-weight:600; color:var(--text-primary);">' + a.userLoss.toFixed(1) + '</td></tr>';
  });
  accHTML += '<tr style="background:var(--bg-tertiary);"><td style="padding:5px 14px; font-weight:700; color:var(--text-primary);">Toplam</td>';
  accHTML += '<td style="padding:5px 14px; text-align:center; font-weight:700; color:var(--text-primary);">' + totalStd.toFixed(1) + '</td>';
  accHTML += '<td style="padding:5px 14px; text-align:center; font-weight:700; color:var(--text-primary);">' + totalUser.toFixed(1) + '</td></tr>';
  accHTML += '</tbody></table>';
  
  // ═══ MOTOR ═══
  var motorHTML = '';
  motorHTML += row('Motor Tanımı', R.engineName);
  motorHTML += row('Silindir Hacmi', R.displacement > 0 ? R.displacement.toFixed(2) + ' L' : '—');
  motorHTML += row('Pik Tork', peakTorque > 0 ? peakTorque.toFixed(1) + ' N·m' : '—');
  motorHTML += row('Pik Tork Devri', peakTorqueRpm > 0 ? peakTorqueRpm + ' rpm' : '—');
  motorHTML += row('Pik Güç', peakPower > 0 ? peakPower.toFixed(1) + ' kW' : '—');
  motorHTML += row('Pik Güç Devri', peakPowerRpm > 0 ? peakPowerRpm + ' rpm' : '—');
  motorHTML += row('Governed Güç', govPower > 0 ? govPower.toFixed(1) + ' kW' : '—');
  motorHTML += row('Governed Devir', R.governed + ' rpm');
  motorHTML += row('No-Load Governed', R.noLoad + ' rpm');
  motorHTML += row('Rölanti Devri', R.idleRpm + ' rpm');
  motorHTML += row('Motor Ataleti (tahmini)', R.engineInertia.toFixed(4) + ' kg·m²');
  motorHTML = tableWrap(motorHTML);
  
  // ═══ MOTOR DETAYLARI ═══
  var motorDetailHTML = '';
  if(R.torqueData.length > 0) {
    motorDetailHTML += '<div style="overflow-x:auto;">';
    motorDetailHTML += '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary); font-size:var(--fs-body);">';
    motorDetailHTML += '<thead><tr style="background:var(--bg-tertiary);">';
    ['Devir<br>(rpm)','Brüt Güç<br>(kW)','Brüt Tork<br>(N·m)','Net Güç<br>Fan Açık (kW)','Net Tork<br>Fan Açık (N·m)','Net Güç<br>Fan Kapalı (kW)','Net Tork<br>Fan Kapalı (N·m)','Tanım'].forEach(function(th) {
      motorDetailHTML += '<th style="padding:5px 8px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); color:var(--text-secondary); font-weight:500; text-align:center; white-space:nowrap;">' + th + '</th>';
    });
    motorDetailHTML += '</tr></thead><tbody>';
    
    R.torqueData.forEach(function(p) {
      var rpm = p.rpm; if(!rpm || rpm <= 0) return;
      var netPwr = p.power || (p.torque * rpm * Math.PI / 30000);
      var netTrk = p.torque || (netPwr * 30000 / (Math.PI * rpm));
      var ratio = R.governed > 0 ? rpm / R.governed : 0;
      var fanPwr = R.fanLossGov * ratio * ratio * ratio;
      var otherPwr = R.otherLossGov * ratio;
      var grossPwr = netPwr + fanPwr + otherPwr;
      var grossTrk = rpm > 0 ? grossPwr * 30000 / (Math.PI * rpm) : 0;
      var netPwrFanOn = netPwr - fanPwr;
      var netTrkFanOn = rpm > 0 ? netPwrFanOn * 30000 / (Math.PI * rpm) : 0;
      var ident = '';
      if(rpm === peakTorqueRpm && peakTorque > 0) ident = 'Pik Tork';
      if(rpm === R.governed) ident = 'Pik Governed';
      if(rpm === R.noLoad || (rpm > R.governed && netTrk <= 0)) ident = 'Yüksüz Governed';
      
      var td = function(v) { return '<td style="padding:4px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; color:var(--text-primary);">' + v + '</td>'; };
      motorDetailHTML += '<tr>';
      motorDetailHTML += '<td style="padding:4px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; font-weight:600; color:var(--text-primary);">' + rpm + '</td>';
      motorDetailHTML += td(grossPwr.toFixed(1)) + td(grossTrk.toFixed(1)) + td(netPwrFanOn.toFixed(1)) + td(netTrkFanOn.toFixed(1)) + td(netPwr.toFixed(1)) + td(netTrk.toFixed(1));
      motorDetailHTML += '<td style="padding:4px 8px; border-bottom:1px solid var(--border-light); text-align:center; color:var(--text-muted); font-style:italic; font-size:var(--fs-tiny);">' + ident + '</td>';
      motorDetailHTML += '</tr>';
    });
    motorDetailHTML += '</tbody></table></div>';
    motorDetailHTML += '<div id="dr-engine-chart-wrap" style="margin-top:14px; position:relative; max-width:800px; margin:0 auto; height:450px; overflow:hidden; background:var(--bg-secondary); cursor:crosshair;">';
    motorDetailHTML += '<canvas id="dr-engine-chart" style="width:100%; height:100%; display:block;"></canvas>';
    motorDetailHTML += '<div id="dr-engine-tooltip" class="dr-chart-tooltip"></div>';
    motorDetailHTML += '<div id="dr-engine-crossV" class="dr-chart-crossV"></div>';
    motorDetailHTML += '<div id="dr-engine-crossH" class="dr-chart-crossH"></div>';
    motorDetailHTML += '<div style="position:absolute; bottom:6px; right:10px; font-size:var(--fs-micro); color:var(--text-muted); pointer-events:none;">Scroll — Yakınlaştır  │  Sağ Tık + Sürükle — Kaydır  │  Çift Tık — Sıfırla</div>';
    motorDetailHTML += '<span id="dr-engine-zoom-ind" style="position:absolute; top:6px; right:10px; display:none; font-size:var(--fs-tiny); font-weight:600; color:var(--accent-primary); cursor:pointer; background:var(--bg-secondary); padding:2px 6px; border-radius:var(--radius-sm);" onclick="drEngineResetZoom()"><span class="mf-ico mf-ico-search"></span> 1.0×</span>';
    motorDetailHTML += '</div>';
  } else {
    motorDetailHTML = '<span style="color:var(--text-muted); font-style:italic;">Motor tork eğrisi verisi bulunamadı</span>';
  }
  
  // ═══ ŞANZIMAN ═══
  var transHTML = '';
  transHTML += row('Şanzıman Üretici', 'Allison Transmission');
  transHTML += row('Şanzıman', R.gbName);
  transHTML += row('Şanzıman Ailesi', R.gbFamily);
  transHTML += row('Şanzıman Verimi', R.gbEff.toFixed(1) + '%');
  if(R.hasTC) transHTML += row('Tork Konvertörü', R.tcName);
  transHTML = tableWrap(transHTML);
  
  // ═══ KONTROL ═══
  var spName = R.shiftProfile.replace(/_/g, ' ').toUpperCase();
  var spDataRes = VE_FT_SHIFT_PROFILES[R.shiftProfile] || {};
  var gLow = R.gearData.length > 0 ? R.gearData[0].name : '1';
  var gHigh = R.gearData.length > 0 ? R.gearData[R.gearData.length - 1].name : '6';
  var controlHTML = '';
  controlHTML += row('Shift Profili', spName);
  controlHTML += row('Vites Geçiş Hızı ve Strateji', R.shiftRefRPM + ' rpm');
  // Converter geçişleri
  if(spDataRes.converterShifts) {
    var csRes = spDataRes.converterShifts;
    var convParts = [];
    if(csRes['1C2C']) convParts.push('1C\u21922C: ' + Math.round(csRes['1C2C'].a * R.shiftRefRPM + (csRes['1C2C'].b || 0)) + ' rpm');
    if(csRes['2C2L'] && csRes['2C2L'].type === 'segmented') {
      convParts.push('2C\u21922L: ' + Math.round(csRes['2C2L'].linear.a * R.shiftRefRPM + csRes['2C2L'].linear.b) + ' rpm (ESL\u2265' + csRes['2C2L'].linear.validFrom + ')');
    }
    if(convParts.length > 0) controlHTML += row('Converter Geçişleri', convParts.join(', '));
  }
  // Lockup geçişleri
  if(spDataRes.lockupShifts) {
    var luSummary = Object.keys(spDataRes.lockupShifts).map(function(sk) {
      var ls = spDataRes.lockupShifts[sk];
      var thr = (typeof calcLockupShiftThreshold === 'function') ? calcLockupShiftThreshold(ls, R.shiftRefRPM) : (ls.a * R.shiftRefRPM + (ls.b || 0));
      return sk.replace(/(\d+L)(\d+L)/, '$1\u2192$2') + ': ' + Math.round(thr) + ' rpm';
    }).join(', ');
    controlHTML += row('Lockup Geçişleri', luSummary);
  } else {
    controlHTML += row('Kilitleme Ofseti', R.lockupOffset + ' rpm');
  }
  controlHTML += row('Ana Mod: Vitesler', 'Düşük = ' + gLow + ', Başlangıç = ' + gLow + ', Yüksek = ' + gHigh + ' (' + gLow + '-' + gLow + '-' + gHigh + ')');
  controlHTML = tableWrap(controlHTML);
  
  // ═══ AKTARMA ORGANLARI ═══
  var driveHTML = '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary); font-size:var(--fs-body); margin-bottom:12px;">';
  driveHTML += '<thead><tr style="background:var(--bg-tertiary);"><th style="padding:5px 12px; text-align:left; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-color); color:var(--text-secondary); font-weight:500;">Bileşen</th>';
  driveHTML += '<th style="padding:5px 12px; text-align:center; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-color); color:var(--text-secondary); font-weight:500;">Açıklama</th>';
  driveHTML += '<th style="padding:5px 12px; text-align:center; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-color); color:var(--text-secondary); font-weight:500;">Oran</th>';
  driveHTML += '<th style="padding:5px 12px; text-align:center; border-bottom:1px solid var(--border-color); color:var(--text-secondary); font-weight:500;">Verim (%)</th></tr></thead><tbody>';
  
  (R.propshafts.length > 0 ? R.propshafts : [{name:'Kardan Mili',eff:98.60}]).forEach(function(ps) {
    driveHTML += '<tr><td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); font-weight:600; color:var(--text-primary);">' + ps.name + '</td>';
    driveHTML += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; color:var(--text-primary);">Tek</td>';
    driveHTML += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; font-weight:600; color:var(--text-primary);">1.000</td>';
    driveHTML += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); text-align:center; font-weight:600; color:var(--text-primary);">' + ps.eff.toFixed(2) + '</td></tr>';
  });

  driveHTML += '<tr><td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); font-weight:600; color:var(--text-primary);">' + R.diffName + '</td>';
  driveHTML += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; color:var(--text-primary);">Tek</td>';
  driveHTML += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; font-weight:600; color:var(--text-primary);">' + R.diffRatio.toFixed(3) + '</td>';
  driveHTML += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); text-align:center; font-weight:600; color:var(--text-primary);">' + R.diffEff.toFixed(2) + '</td></tr>';
  
  if(R.hasTransfer && R.transferGears.length > 0) {
    R.transferGears.forEach(function(tr, i) {
      driveHTML += '<tr><td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); font-weight:600; color:var(--text-primary);">' + (i === 0 ? R.transferName : '') + '</td>';
      driveHTML += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; color:var(--text-primary);">' + tr.kademe + '</td>';
      driveHTML += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; font-weight:600; color:var(--text-primary);">' + tr.ratio.toFixed(3) + '</td>';
      driveHTML += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); text-align:center; font-weight:600; color:var(--text-primary);">' + tr.eff.toFixed(2) + '</td></tr>';
    });
  }
  driveHTML += '</tbody></table>';
  
  if(R.hasTransfer && R.transferGears.length > 0) {
    driveHTML += '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary); font-size:var(--fs-body);">';
    driveHTML += '<thead><tr style="background:var(--bg-tertiary);"><th style="padding:5px 12px; text-align:left; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-color); color:var(--text-secondary); font-weight:500;">Toplam Aktarma Oranı</th>';
    driveHTML += '<th style="padding:5px 12px; text-align:center; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-color); color:var(--text-secondary); font-weight:500;">Kademe</th>';
    driveHTML += '<th style="padding:5px 12px; text-align:center; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-color); color:var(--text-secondary); font-weight:500;">Oran</th>';
    driveHTML += '<th style="padding:5px 12px; text-align:center; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-color); color:var(--text-secondary); font-weight:500;">Verim (%)</th>';
    driveHTML += '<th style="padding:5px 12px; text-align:center; border-bottom:1px solid var(--border-color); color:var(--text-secondary); font-weight:500;">N/V Oranı<br>(rpm/kph)</th></tr></thead><tbody>';
    R.transferGears.forEach(function(tr) {
      var psEffT = 1; R.propshafts.forEach(function(ps){ psEffT *= ps.eff / 100; });
      var oR = R.diffRatio * tr.ratio;
      var oE = (R.diffEff / 100) * (tr.eff / 100) * psEffT * 100;
      var nv = R.tireRadius > 0 ? (oR * 1000 / (R.tireRadius * 2 * Math.PI * 60)).toFixed(3) : '—';
      driveHTML += '<tr><td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light);"></td>';
      driveHTML += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; font-weight:600; color:var(--text-primary);">' + tr.kademe + '</td>';
      driveHTML += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; font-weight:600; color:var(--text-primary);">' + oR.toFixed(3) + '</td>';
      driveHTML += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; font-weight:600; color:var(--text-primary);">' + oE.toFixed(2) + '</td>';
      driveHTML += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); text-align:center; font-weight:600; color:var(--text-primary);">' + nv + '</td></tr>';
    });
    driveHTML += '</tbody></table>';
  }
  
  // ═══ KONVERTÖR DEĞERLENDİRMESİ ═══
  var ecmHTML = '';
  // Konvertör değerlendirmesi yalnız TK veya Motor-TC Eşleştirme (ECM) bileşeni varsa
  if((R.hasTC || R.hasECM) && R.torqueData.length > 2 && typeof VE_FT_TC_PRESETS !== 'undefined' && typeof veGetFamilyTCKeys === 'function') {
    var _pDrop = R.pumpDrop || 17.6;
    var _tRating = R.turbineRating || 3320;
    var _gov = R.governed;
    var _nlg = R.noLoad;
    var _td = R.torqueData;
    var _peakT = 0, _peakRPM = 0;
    _td.forEach(function(d){ if(d.torque > _peakT){_peakT = d.torque; _peakRPM = d.rpm;} });

    // Governed devirdeki tork ve güç (C9/C10)
    var _rGbLimits = { grossInputPower: R.gbGrossInputPower || null, grossInputTorque: R.gbGrossInputTorque || null };
    var _rTorqueAtGov = 0;
    if(_td.length >= 2) {
      if(_gov <= _td[0].rpm) _rTorqueAtGov = _td[0].torque;
      else if(_gov >= _td[_td.length-1].rpm) _rTorqueAtGov = _td[_td.length-1].torque;
      else { for(var _ri=0;_ri<_td.length-1;_ri++){if(_td[_ri].rpm<=_gov&&_gov<=_td[_ri+1].rpm){var _rf=(_gov-_td[_ri].rpm)/(_td[_ri+1].rpm-_td[_ri].rpm);_rTorqueAtGov=_td[_ri].torque+_rf*(_td[_ri+1].torque-_td[_ri].torque);break;}}}
    }
    var _rPowerAtGov = _rTorqueAtGov * _gov * Math.PI / 30000;
    var _rc9ok = _rGbLimits.grossInputPower !== null ? _rPowerAtGov <= _rGbLimits.grossInputPower : true;
    var _rc10ok = _rGbLimits.grossInputTorque !== null ? _rTorqueAtGov <= _rGbLimits.grossInputTorque : true;

    // İnterpolasyon fonksiyonları
    function _interpT(rpm){
      if(rpm<=_td[0].rpm)return _td[0].torque; if(rpm>=_td[_td.length-1].rpm)return _td[_td.length-1].torque;
      for(var i=0;i<_td.length-1;i++){if(_td[i].rpm<=rpm&&rpm<=_td[i+1].rpm){var f=(rpm-_td[i].rpm)/(_td[i+1].rpm-_td[i].rpm);return _td[i].torque+f*(_td[i+1].torque-_td[i].torque);}}return 0;
    }
    function _interpTD(rpm){if(rpm<=_gov)return _interpT(rpm);if(rpm>=_nlg)return 0;return _interpT(_gov)*(1-(rpm-_gov)/(_nlg-_gov));}
    function _interpKp(tcD,sr){sr=Math.max(0,Math.min(0.99,sr));for(var i=0;i<tcD.length-1;i++){if(tcD[i].sr<=sr&&sr<=tcD[i+1].sr){var f=(sr-tcD[i].sr)/(tcD[i+1].sr-tcD[i].sr);return tcD[i].kpump+f*(tcD[i+1].kpump-tcD[i].kpump);}}return tcD[tcD.length-1].kpump;}

    function _findStall(tcD){var kp0=tcD[0].kpump;var lo=600,hi=3500;for(var i=0;i<50;i++){var m=(lo+hi)/2;var tA=_interpTD(m)-_pDrop;var tB=(m*m)/(kp0*kp0);if(tA>tB)lo=m;else hi=m;if(hi-lo<0.5)break;}return(lo+hi)/2;}
    function _findSRGov(tcD){var tp=_interpT(_gov)-_pDrop;if(tp<=0)return 0;var kpN=_gov/Math.sqrt(tp);for(var i=0;i<tcD.length-1;i++){var k1=tcD[i].kpump,k2=tcD[i+1].kpump;if((k1<=kpN&&kpN<=k2)||(k2<=kpN&&kpN<=k1)){var f=(kpN-k1)/(k2-k1);if(f>=0&&f<=1)return tcD[i].sr+f*(tcD[i+1].sr-tcD[i].sr);}}return kpN>tcD[tcD.length-1].kpump?0.99:0.50;}
    function _findMinN(tcD){var mn=9999;for(var nt=0;nt<=_gov*1.05;nt+=15){var lo=Math.max(nt+1,600),hi=_nlg+100;for(var it=0;it<45;it++){var m=(lo+hi)/2;if(m<=nt){lo=m;continue;}var sr=nt/m;sr=Math.max(0,Math.min(0.99,sr));var kp=_interpKp(tcD,sr);var tA=_interpTD(m)-_pDrop;var tB=(m*m)/(kp*kp);if(tA>tB)lo=m;else hi=m;if(hi-lo<1)break;}var nE=(lo+hi)/2;if(nE<mn&&nE>500)mn=nE;}return mn;}

    var _tcKeys = veGetFamilyTCKeys();
    var _ecmResults = [];
    _tcKeys.forEach(function(key){
      var tc = VE_FT_TC_PRESETS[key]; var tcD = tc.data;
      var ss = _findStall(tcD); var srG = _findSRGov(tcD); var minN = _findMinN(tcD);
      var sTau = tcD[0].tau; var tPS = _interpTD(ss)-_pDrop; var tTS = tPS * sTau;
      var c5 = minN >= _peakRPM - 50; var c7 = tTS <= _tRating; var c8 = srG >= 0.80;
      var st, sc;
      if(!_rc9ok || !_rc10ok){st='unacceptable';sc=0;}
      else if(!c7){st='unacceptable';sc=0;}else if(!c5){st='not-recommended';sc=1;}else if(!c8){st='caution';sc=2;}else{st='recommended';sc=3;}
      _ecmResults.push({key:key, name:tc.name, stallTau:sTau, stallSpeed:ss, minSpeed:minN, srGov:srG, tTurbineStall:tTS, c5ok:c5, c7ok:c7, c8ok:c8, c9ok:_rc9ok, c10ok:_rc10ok, status:st, score:sc});
    });
    _ecmResults.sort(function(a,b){return b.score-a.score||b.srGov-a.srGov;});

    // Motor bilgisi
    ecmHTML += '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary); margin-bottom:12px;">';
    ecmHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); width:230px; font-size:var(--fs-md);">Motor</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">' + R.engineName + '</td></tr>';
    ecmHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Pik Tork</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">' + _peakT.toFixed(0) + ' N·m @ ' + _peakRPM + ' rpm</td></tr>';
    ecmHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Governed Devir</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">' + _gov + ' rpm</td></tr>';
    ecmHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Pompa Düşümü</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">' + _pDrop + ' N·m</td></tr>';
    ecmHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Türbin Limiti</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">' + _tRating + ' N·m</td></tr>';
    if(_rGbLimits.grossInputPower !== null) ecmHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Giriş Güç Limiti (C9)</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:' + (_rc9ok ? 'var(--text-primary)' : 'var(--accent-danger)') + '; font-size:var(--fs-md);">' + _rPowerAtGov.toFixed(0) + ' / ' + _rGbLimits.grossInputPower + ' kW ' + (_rc9ok ? '<span style="color:var(--accent-success);font-weight:700;">✓</span>' : '<span style="color:var(--accent-danger);font-weight:700;">✗</span>') + '</td></tr>';
    if(_rGbLimits.grossInputTorque !== null) ecmHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Giriş Tork Limiti (C10)</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:' + (_rc10ok ? 'var(--text-primary)' : 'var(--accent-danger)') + '; font-size:var(--fs-md);">' + _rTorqueAtGov.toFixed(0) + ' / ' + _rGbLimits.grossInputTorque + ' N·m ' + (_rc10ok ? '<span style="color:var(--accent-success);font-weight:700;">✓</span>' : '<span style="color:var(--accent-danger);font-weight:700;">✗</span>') + '</td></tr>';
    ecmHTML += '</table>';
    
    // Tablo
    ecmHTML += '<div style="overflow-x:auto;">';
    ecmHTML += '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary); font-size:var(--fs-body);">';
    ecmHTML += '<thead><tr style="background:var(--bg-tertiary);">';
    ['Durum','Konvertör','Stall τ','Stall rpm','Min N rpm','T_turb N·m','SR@Gov','C5','C7','C8'].forEach(function(th){
      ecmHTML += '<th style="padding:5px 8px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); color:var(--text-secondary); font-weight:500; text-align:center; white-space:nowrap;">' + th + '</th>';
    });
    ecmHTML += '</tr></thead><tbody>';
    
    _ecmResults.forEach(function(r, idx){
      var stI = r.status==='recommended'?'<span style="color:var(--accent-success);font-weight:700;">✓</span>':r.status==='caution'?'<span style="color:var(--accent-warning);font-weight:700;">⚠</span>':r.status==='not-recommended'?'<span style="color:var(--accent-warning);font-weight:700;">⚠</span>':'<span style="color:var(--accent-danger);font-weight:700;">✗</span>';
      var stT = r.status==='recommended'?'Önerilen':r.status==='caution'?'Dikkat':r.status==='not-recommended'?'Önerilmez':'Uyumsuz';
      var stC = r.status==='recommended'?'var(--accent-success)':r.status==='caution'?'var(--accent-warning)':r.status==='not-recommended'?'var(--accent-warning)':'var(--accent-danger)';
      var td = function(v,c){return '<td style="padding:4px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; color:'+(c||'var(--text-primary)')+';">'+v+'</td>';};
      ecmHTML += '<tr>';
      ecmHTML += '<td style="padding:4px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); white-space:nowrap;"><span style="font-weight:600; color:'+stC+'; font-size:var(--fs-tiny);">'+stI+' '+stT+'</span></td>';
      ecmHTML += '<td style="padding:4px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); font-weight:600; color:var(--text-primary);">'+r.name+'</td>';
      ecmHTML += td(r.stallTau.toFixed(2)) + td(r.stallSpeed.toFixed(0)) + td(r.minSpeed.toFixed(0), r.c5ok?'#333':'#dc2626');
      ecmHTML += td(r.tTurbineStall.toFixed(0), r.c7ok?'#333':'#dc2626') + td(r.srGov.toFixed(3), r.c8ok?'#333':'#d97706');
      ecmHTML += td(r.c5ok?'<span style="color:var(--accent-success);font-weight:700;">✓</span>':'<span style="color:var(--accent-danger);font-weight:700;">✗</span>') + td(r.c7ok?'<span style="color:var(--accent-success);font-weight:700;">✓</span>':'<span style="color:var(--accent-danger);font-weight:700;">✗</span>') + td(r.c8ok?'<span style="color:var(--accent-success);font-weight:700;">✓</span>':'<span style="color:var(--accent-warning);font-weight:700;">⚠</span>');
      ecmHTML += '</tr>';
    });
    ecmHTML += '</tbody></table></div>';
    
    // Özet
    if(_ecmResults.length > 0) {
      var best = _ecmResults[0];
      ecmHTML += '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary); margin-top:10px;">';
      ecmHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); width:230px; font-size:var(--fs-md);">Önerilen Konvertör</td>';
      ecmHTML += '<td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">' + (best.status==='recommended'?'<span class="mf-ico mf-ico-trophy"></span> ':'') + best.name + '  —  Stall: ' + best.stallSpeed.toFixed(0) + ' rpm | SR@Gov: ' + best.srGov.toFixed(3) + ' | T_turb: ' + best.tTurbineStall.toFixed(0) + ' N·m</td></tr>';
      ecmHTML += '</table>';
    }
    
    // Chart alanı — interactive wrapper
    ecmHTML += '<div id="dr-ecm-chart-wrap" style="margin-top:14px; position:relative; max-width:800px; margin:0 auto; height:450px; border:1px solid var(--border-color); border-radius:var(--radius-sm); overflow:hidden; background:var(--bg-secondary); cursor:crosshair;">';
    ecmHTML += '<canvas id="dr-ecm-chart" style="width:100%; height:100%; display:block;"></canvas>';
    ecmHTML += '<div style="position:absolute; bottom:6px; right:10px; font-size:var(--fs-micro); color:var(--text-muted); pointer-events:none;">Scroll — Yakınlaştır  │  Sağ Tık + Sürükle — Kaydır</div>';
    ecmHTML += '<span id="dr-ecm-zoom-ind" style="position:absolute; top:6px; right:10px; display:none; font-size:var(--fs-tiny); font-weight:600; color:var(--accent-primary); cursor:pointer; background:var(--bg-secondary); padding:2px 6px; border-radius:var(--radius-sm);" onclick="drEcmResetZoom()"><span class="mf-ico mf-ico-search"></span> 1.0×</span>';
    ecmHTML += '</div>';
  } else {
    ecmHTML = '<span style="color:var(--text-muted); font-style:italic;">Motor-TC eşleştirme verisi bulunamadı</span>';
  }

  // ═══ Bölümler ═══
  var sections = [
    {id:'platform', title:'PLATFORM', content: platformHTML},
    {id:'engine', title:'MOTOR', content: motorHTML + '<div style="height:16px;"></div><div style="font-weight:700; font-size:var(--fs-md); color:var(--text-primary); padding:7px 14px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); margin:0 -24px; padding-left:24px;">Motor Kayıpları (Governed Devirde Güç)</div><div style="height:8px;"></div>' + accHTML + '<div style="height:16px;"></div><div style="font-weight:700; font-size:var(--fs-md); color:var(--text-primary); padding:7px 14px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); margin:0 -24px; padding-left:24px;">Motor Detayları</div><div style="height:8px;"></div>' + motorDetailHTML},
    {id:'transmission', title:'ŞANZIMAN', content: transHTML + '<div style="height:16px;"></div><div style="font-weight:700; font-size:var(--fs-md); color:var(--text-primary); padding:7px 14px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); margin:0 -24px; padding-left:24px;">Kontrol</div><div style="height:8px;"></div>' + controlHTML},
    {id:'driveline', title:'AKTARMA ORGANLARI', content: driveHTML}
  ];
  // Konvertör Değerlendirmesi bölümü yalnız TK veya Motor-TC Eşleştirme varsa gösterilir
  if(R.hasTC || R.hasECM) sections.splice(3, 0, {id:'ecm', title:'KONVERTÖR DEĞERLENDİRMESİ', content: ecmHTML});
  
  // ═══ HTML oluştur ═══
  var html = '';
  html += '<div style="padding:10px 16px; background:var(--bg-secondary); border-bottom:2px solid var(--border-color); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">';
  html += '<div style="display:flex; align-items:center; gap:8px;"><span style="font-size:var(--fs-title);"><span class="mf-ico mf-ico-clipboard"></span></span>';
  html += '<span style="font-size:var(--fs-lg); font-weight:700; color:var(--text-heading);">' + reportTitle + '</span>';
  if(filter) {
    html += '<button onclick="veRenderDetailedReport()" style="padding:3px 10px; font-size:var(--fs-tiny); font-weight:500; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer; margin-left:6px;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'">← Tüm Rapor</button>';
  }
  html += '</div>';
  html += '<div style="display:flex; align-items:center; gap:6px;">';
  html += '<button onclick="veDownloadReportHTML()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'" title="Bağımsız, baskıya hazır HTML rapor indir"><span class="mf-ico mf-ico-download"></span> HTML İndir</button>';
  html += '<button onclick="veCloseDetailedReport()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-danger)\';this.style.color=\'var(--accent-danger)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'">✕ Kapat</button>';
  html += '</div>';
  html += '</div>';
  
  // Geniş beyaz kart container
  html += '<div style="flex:1; overflow-y:auto; background:var(--bg-primary); padding:20px 0;">';
  
  // ═══ Girdi Özeti ═══
  var showGirdi = showAll || isGirdi || girdiIds.indexOf(filter) >= 0;
  if(showGirdi) {
  html += '<div style="max-width:1100px; margin:0 auto; background:var(--bg-secondary); border-radius:var(--radius-sm); box-shadow:0 1px 6px rgba(0,0,0,0.12); overflow:hidden;">';
  
  // Girdi Özeti ana başlık
  html += '<div style="padding:12px 18px; font-size:var(--fs-title); font-weight:400; color:var(--text-primary); border-bottom:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="veToggleGirdiOzeti(this)">';
  html += '<span>Girdi Özeti</span><span class="dr-gs-arrow" style="font-size:var(--fs-tiny); color:var(--text-muted); transition:transform 0.35s ease;">▲</span></div>';
  html += '<div class="dr-girdi-wrapper dr-girdi-open">';
  
  sections.forEach(function(s) {
    if(!shouldShow(s.id)) return;
    var bodyContent = s.content || '<span style="color:var(--text-muted); font-style:italic;">İçerik henüz tanımlanmadı</span>';
    // If single section filter, auto-expand it
    var autoOpen = (!showAll && !isGirdi);
    html += '<div class="dr-section" data-section="' + s.id + '">';
    html += '<div class="dr-hdr" onclick="veToggleReportSection(this)"><span class="dr-arrow">' + (autoOpen ? '▼' : '▶') + '</span>' + s.title + '</div>';
    html += '<div class="dr-body" style="display:' + (autoOpen ? 'block' : 'none') + ';">' + bodyContent + '</div>';
    html += '</div>';
  });
  
  html += '</div></div>';
  }
  
  // ═══ Araç Performans Özeti ═══
  var showPerf = showAll || isPerf || perfIds.indexOf(filter) >= 0;
  if(showPerf) {
  html += '<div style="max-width:1100px; margin:16px auto 0; background:var(--bg-secondary); border-radius:var(--radius-sm); box-shadow:0 1px 6px rgba(0,0,0,0.12); overflow:hidden;">';
  html += '<div style="padding:12px 18px; font-size:var(--fs-title); font-weight:400; color:var(--text-primary); border-bottom:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="veToggleGirdiOzeti(this)">';
  html += '<span>Araç Performans Özeti</span><span class="dr-gs-arrow" style="font-size:var(--fs-tiny); color:var(--text-muted); transition:transform 0.35s ease;">▲</span></div>';
  html += '<div class="dr-girdi-wrapper dr-girdi-open">';
  
  // Tam Gaz Otomatik Vites Artışı (Eğim Kabiliyeti)
  var G = sim.gradeability;
  var ftGradeHTML = '';
  if(G && G.high) {
    // Üst bilgi tablosu
    var trRatioHigh = G.high.transferRatio || 1.0;
    ftGradeHTML += '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary); margin-bottom:14px;">';
    ftGradeHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); width:200px; font-size:var(--fs-md);">Motor Fanı</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">Açık</td>';
    ftGradeHTML += '<td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); width:200px; font-size:var(--fs-md);">Motor Gücü</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">Standart Güç Eğrisi</td></tr>';
    ftGradeHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Klima</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">Kapalı</td>';
    ftGradeHTML += '<td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Araç Parametreleri</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">Standart</td></tr>';
    ftGradeHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Aks Oranı</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">' + R.diffRatio.toFixed(3) + '</td>';
    ftGradeHTML += '<td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Transfer Kutusu Oranı</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">' + trRatioHigh.toFixed(3) + '</td></tr>';
    ftGradeHTML += '</table>';
    
    // Yardımcı fonksiyonlar
    var _td = function(v, align) { return '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:' + (align||'center') + '; color:var(--text-primary);">' + v + '</td>'; };
    var _tdL = function(v) { return '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); text-align:left; color:var(--text-primary);">' + v + '</td>'; };
    var _tdName = function(v) { return '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); color:var(--text-primary);">' + v + '</td>'; };
    
    // Tek kademe tablosu oluşturucu
    function renderGradeTable(gd) {
      var h = '';
      // Kademe etiketi (çift tablo varsa)
      if(G.low) {
        h += '<div style="font-weight:700; font-size:var(--fs-md); color:var(--text-primary); padding:7px 14px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); margin:0 -24px 10px; padding-left:24px;">' + gd.label + '</div>';
      }
      h += '<div style="overflow-x:auto;">';
      h += '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary); font-size:var(--fs-body);">';
      h += '<thead><tr style="background:var(--bg-tertiary);">';
      h += '<th style="padding:6px 12px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:left; color:var(--text-secondary); font-weight:500; width:280px;">Eğim Kabiliyeti</th>';
      h += '<th style="padding:6px 12px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:center; color:var(--text-secondary); font-weight:500;">% Eğim</th>';
      h += '<th style="padding:6px 12px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:center; color:var(--text-secondary); font-weight:500;">Araç Hızı<br>(km/h)</th>';
      h += '<th style="padding:6px 12px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:center; color:var(--text-secondary); font-weight:500;">Vites<br>Kademe</th>';
      h += '<th style="padding:6px 12px; border-bottom:1px solid var(--border-color); text-align:left; color:var(--text-secondary); font-weight:500;">Eşleşme Noktası</th>';
      h += '</tr></thead><tbody>';
      
      h += '<tr>' + _tdName('Durma Eğim Kabiliyeti (Stall)') + _td(veGradeDisplay(gd.stallGrade, 1)) + _td('') + _td(gd.stallGear) + _tdL('Stall') + '</tr>';
      h += '<tr>' + _tdName('Kalkış Eğim Kabiliyeti (Launch)') + _td(veGradeDisplay(gd.launchGrade, 1)) + _td('') + _td(gd.launchGear) + _tdL('') + '</tr>';
      h += '<tr>' + _tdName('Düşük Hız Eğim Kabiliyeti') + _td(veGradeDisplay(gd.lowSpeedGrade, 1)) + _td(gd.lowSpeedV.toFixed(1)) + _td(gd.lowSpeedGear) + _tdL('%80') + '</tr>';
      h += '<tr>' + _tdName('Düz Yolda Maksimum Hız') + _td('0.0') + _td(gd.maxSpeedFlat.toFixed(1)) + _td(gd.maxSpeedFlatGear) + _tdL('Yol Yükü') + '</tr>';
      
      gd.gradeTable.forEach(function(row) {
        if(row.v_max <= 0 && row.grade > 0) return;
        h += '<tr>' + _tdName('') + _td(row.grade.toFixed(1)) + _td(row.v_max.toFixed(1)) + _td(row.gear) + _tdL('') + '</tr>';
      });
      
      h += '</tbody></table></div>';
      return h;
    }
    
    // Yüksek kademe tablosu
    ftGradeHTML += renderGradeTable(G.high);
    
    // Düşük kademe tablosu (varsa)
    if(G.low) {
      ftGradeHTML += '<div style="height:20px;"></div>';
      ftGradeHTML += renderGradeTable(G.low);
    }
    
    // Gradeability grafikleri (yan yana)
    ftGradeHTML += '<div id="gradeabilityCharts" style="display:flex; flex-direction:column; gap:24px; margin-top:20px;">';
    ftGradeHTML += '<div style="max-width:800px; margin:0 auto; position:relative;"><canvas id="gradeChartHigh" height="450" style="cursor:crosshair;"></canvas><div id="gradeChartHigh-tooltip" class="dr-chart-tooltip"></div><div id="gradeChartHigh-crossV" class="dr-chart-crossV"></div><div id="gradeChartHigh-crossH" class="dr-chart-crossH"></div></div>';
    if(G.low) {
      ftGradeHTML += '<div style="max-width:800px; margin:0 auto; position:relative;" id="gradeChartLowWrap"><canvas id="gradeChartLow" height="450" style="cursor:crosshair;"></canvas><div id="gradeChartLow-tooltip" class="dr-chart-tooltip"></div><div id="gradeChartLow-crossV" class="dr-chart-crossV"></div><div id="gradeChartLow-crossH" class="dr-chart-crossH"></div></div>';
    }
    ftGradeHTML += '</div>';
  } else {
    ftGradeHTML = '<span style="color:var(--text-muted); font-style:italic;">Eğim kabiliyeti verisi bulunamadı — tam gaz simülasyonu gerekli</span>';
  }
  if(shouldShow('ft-grade')) {
  var gradeAutoOpen = (filter === 'ft-grade');
  html += '<div class="dr-section" data-section="ft-grade">';
  html += '<div class="dr-hdr" onclick="veToggleReportSection(this)"><span class="dr-arrow">' + (gradeAutoOpen ? '▼' : '▶') + '</span>TAM GAZ OTOMATİK VİTES ARTIŞI (EĞİM KABİLİYETİ)</div>';
  html += '<div class="dr-body" style="display:' + (gradeAutoOpen ? 'block' : 'none') + ';">' + ftGradeHTML + '</div>';
  html += '</div>';
  }
  
  // ── Hızlanma Tablosu + Diyagramı ──
  var A = sim.acceleration;
  var ftAccelHTML = '';
  if(A && A.high) {
    var axleR = R.diffRatio.toFixed(3);
    var trRatioAccel = A.high.transferRatio || 1.0;
    
    // Üst bilgi tablosu (gradeability ile aynı stil)
    ftAccelHTML += '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary); margin-bottom:14px;">';
    ftAccelHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); width:200px; font-size:var(--fs-md);">Motor Fanı</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">Açık</td>';
    ftAccelHTML += '<td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); width:200px; font-size:var(--fs-md);">Motor Gücü</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">Standart Güç Eğrisi</td></tr>';
    ftAccelHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Klima</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">Kapalı</td>';
    ftAccelHTML += '<td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Araç Parametreleri</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">Standart</td></tr>';
    ftAccelHTML += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Aks Oranı</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">' + axleR + '</td>';
    ftAccelHTML += '<td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Transfer Kutusu Oranı</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">' + trRatioAccel.toFixed(3) + '</td></tr>';
    ftAccelHTML += '</table>';
    
    // Tek kademe tablosu oluşturucu
    function renderAccelTable(ad) {
      var bh = '';
      // Kademe etiketi (çift tablo varsa)
      if(A.low) {
        bh += '<div style="font-weight:700; font-size:var(--fs-md); color:var(--text-primary); padding:7px 14px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); margin:0 -24px 10px; padding-left:24px;">' + ad.label + '</div>';
      }
      bh += '<div style="overflow-x:auto;">';
      bh += '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary); font-size:var(--fs-body);">';
      bh += '<thead><tr style="background:var(--bg-tertiary);">';
      bh += '<th style="padding:6px 12px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:left; color:var(--text-secondary); font-weight:500; width:280px;">Hız</th>';
      bh += '<th style="padding:6px 12px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:center; color:var(--text-secondary); font-weight:500;">Süre<br>(saniye)</th>';
      bh += '<th style="padding:6px 12px; border-bottom:1px solid var(--border-color); text-align:center; color:var(--text-secondary); font-weight:500;">Mesafe<br>(m)</th>';
      bh += '</tr></thead><tbody>';
      
      ad.rows.forEach(function(row) {
        bh += '<tr>';
        bh += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); color:var(--text-primary);">0 — ' + row.targetSpeed + ' km/h</td>';
        if(row.time === null) {
          bh += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; color:var(--text-muted); font-style:italic;">Hıza ulaşılamıyor</td>';
          bh += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); text-align:center; color:var(--text-muted); font-style:italic;">Hıza ulaşılamıyor</td>';
        } else {
          bh += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; color:var(--text-primary);">' + row.time.toFixed(1) + '</td>';
          bh += '<td style="padding:5px 12px; border-bottom:1px solid var(--border-light); text-align:center; color:var(--text-primary);">' + Math.round(row.distance) + '</td>';
        }
        bh += '</tr>';
      });
      
      bh += '</tbody></table></div>';
      return bh;
    }
    
    // Yüksek kademe tablosu
    ftAccelHTML += renderAccelTable(A.high);
    
    // Düşük kademe tablosu (varsa)
    if(A.low) {
      ftAccelHTML += '<div style="height:20px;"></div>';
      ftAccelHTML += renderAccelTable(A.low);
    }
    
    // Diyagramlar (alt alta, ortalı — gradeability ile aynı stil)
    ftAccelHTML += '<div id="accelChartsContainer" style="display:flex; flex-direction:column; gap:24px; margin-top:20px;">';
    ftAccelHTML += '<div style="max-width:800px; margin:0 auto; position:relative;"><canvas id="accelChartHigh" height="450" style="cursor:crosshair;"></canvas><div id="accelChartHigh-tooltip" class="dr-chart-tooltip"></div><div id="accelChartHigh-crossV" class="dr-chart-crossV"></div><div id="accelChartHigh-crossH" class="dr-chart-crossH"></div></div>';
    if(A.low) {
      ftAccelHTML += '<div style="max-width:800px; margin:0 auto; position:relative;" id="accelChartLowWrap"><canvas id="accelChartLow" height="450" style="cursor:crosshair;"></canvas><div id="accelChartLow-tooltip" class="dr-chart-tooltip"></div><div id="accelChartLow-crossV" class="dr-chart-crossV"></div><div id="accelChartLow-crossH" class="dr-chart-crossH"></div></div>';
    }
    ftAccelHTML += '</div>';
  } else {
    ftAccelHTML = '<span style="color:var(--text-muted); font-style:italic;">Hızlanma verisi bulunamadı — tam gaz simülasyonu gerekli</span>';
  }
  if(shouldShow('ft-accel')) {
  var accelAutoOpen = (filter === 'ft-accel');
  html += '<div class="dr-section" data-section="ft-accel">';
  html += '<div class="dr-hdr" onclick="veToggleReportSection(this)"><span class="dr-arrow">' + (accelAutoOpen ? '▼' : '▶') + '</span>TAM GAZ OTOMATİK VİTES ARTIŞI (HIZLANMA)</div>';
  html += '<div class="dr-body" style="display:' + (accelAutoOpen ? 'block' : 'none') + ';">' + ftAccelHTML + '</div>';
  html += '</div>';
  }
  
  // ═══ TAM GAZ OTOMATİK VİTES GEÇİŞLERİ (Detaylı FT Tablosu) ═══
  if(shouldShow('ft-upshifts')) {
  var upshiftsAutoOpen = (filter === 'ft-upshifts');
  var ftUpHTML = veBuildFTUpshiftsHTML(sim, R);
  html += '<div class="dr-section" data-section="ft-upshifts">';
  html += '<div class="dr-hdr" onclick="veToggleReportSection(this)"><span class="dr-arrow">' + (upshiftsAutoOpen ? '▼' : '▶') + '</span>TAM GAZ OTOMATİK VİTES GEÇİŞLERİ (DETAYLI)</div>';
  html += '<div class="dr-body" style="display:' + (upshiftsAutoOpen ? 'block' : 'none') + ';">' + ftUpHTML + '</div>';
  html += '</div>';
  }
  
  html += '</div></div>';
  } // end showPerf
  
  html += '</div>';
  
  overlay.innerHTML = html;
  overlay.style.display = 'flex';
  
  setTimeout(function() {
    // Always try to draw these - they may be visible if section is auto-expanded
    veDrawEngineChart(R.torqueData, R.governed, R.noLoad, R.fanLossGov, R.otherLossGov);
    veDrawReportECMChart(R);
    // Draw gradeability charts if visible (auto-expanded or full report)
    if(document.getElementById('gradeChartHigh') && sim.gradeability) {
      veDrawGradeabilityCharts(sim.gradeability);
    }
    // Draw acceleration charts if visible
    if(document.getElementById('accelChartHigh') && sim.acceleration) {
      veDrawAccelerationCharts(sim.acceleration);
    }
    // Draw FT upshift charts if visible
    if(document.getElementById('ftUpshiftChartHigh')) {
      veDrawFTUpshiftCharts(sim);
    }
  }, 80);
}

// ── Gradeability Diyagramları ──
function veBuildGradeChartData(gradeResult) {
  var points = [];
  // Stall ve Launch (sadece < 900)
  if(gradeResult.stallGrade < 900) {
    points.push({ x: 0, y: gradeResult.stallGrade, label: 'Durma (' + gradeResult.stallGrade.toFixed(1) + '%)' });
  }
  if(gradeResult.launchGrade < 900) {
    points.push({ x: 0, y: gradeResult.launchGrade, label: 'Kalkış (' + gradeResult.launchGrade.toFixed(1) + '%)' });
  }
  // Düşük Hız
  if(gradeResult.lowSpeedGrade < 900) {
    points.push({ x: gradeResult.lowSpeedV, y: gradeResult.lowSpeedGrade, label: 'Düşük Hız (' + gradeResult.lowSpeedV.toFixed(0) + ' km/h, ' + gradeResult.lowSpeedGrade.toFixed(1) + '%)' });
  }
  // Grade tablosu (grade > 0 olanlar)
  for(var i = 0; i < gradeResult.gradeTable.length; i++) {
    var row = gradeResult.gradeTable[i];
    if(row.v_max > 0) points.push({ x: row.v_max, y: row.grade });
  }
  points.sort(function(a, b) { return a.x - b.x; });
  return points;
}

// ── Report chart zoom/pan state ──
var _drChartZoom = {};
var _drChartPan = { active:false, canvasId:null, startX:0, startY:0, startCX:0, startCY:0 };

function _drGetZoom(id) {
  if(!_drChartZoom[id]) _drChartZoom[id] = { scale:1.0, cx:null, cy:null };
  return _drChartZoom[id];
}

// Helper: CSS tema renklerini canvas için oku (cache'li)
var _drTC = null;
function _drThemeColors() {
  var s = getComputedStyle(document.documentElement);
  _drTC = {
    bg:        s.getPropertyValue('--bg-secondary').trim() || '#ffffff',
    bgAlt:     s.getPropertyValue('--bg-tertiary').trim() || '#f5f6f8',
    text:      s.getPropertyValue('--text-primary').trim() || '#222',
    textSec:   s.getPropertyValue('--text-secondary').trim() || '#555',
    textMuted: s.getPropertyValue('--text-muted').trim() || '#999',
    border:    s.getPropertyValue('--border-light').trim() || '#eaeaea',
    accent:    s.getPropertyValue('--accent-primary').trim() || '#3b82f6',
    axisLine:  s.getPropertyValue('--border-hover').trim() || '#aaa'
  };
  return _drTC;
}
// Tema değiştiğinde cache'i sıfırla
var _origChangeTheme = typeof changeTheme === 'function' ? changeTheme : null;
if(_origChangeTheme) {
  changeTheme = function(id) { _origChangeTheme(id); _drTC = null; };
}

function veRenderGradeChart(canvasId, data, title, showLabels) {
  var canvas = document.getElementById(canvasId);
  if(!canvas || !data || data.length < 2) return;
  
  var parentW = canvas.parentElement.clientWidth || 800;
  var chartH = 450;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = parentW * dpr;
  canvas.height = chartH * dpr;
  canvas.style.width = parentW + 'px';
  canvas.style.height = chartH + 'px';
  
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  var W = parentW, H = chartH;
  
  var padL = 65, padR = 30, padT = 42, padB = 50;
  var plotW = W - padL - padR, plotH = H - padT - padB;
  
  // Base ranges
  var xVals = data.map(function(p) { return p.x; });
  var yVals = data.map(function(p) { return p.y; });
  var baseXMin = 0, baseXMax = Math.ceil((Math.max.apply(null, xVals) + 10) / 10) * 10;
  var baseYMin = 0, baseYMax = Math.ceil((Math.max.apply(null, yVals) + 5) / 10) * 10;
  if(baseYMax < 10) baseYMax = 10;
  
  // Apply zoom
  var z = _drGetZoom(canvasId);
  var zs = z.scale || 1.0;
  var visXRange = (baseXMax - baseXMin) / zs;
  var visYRange = (baseYMax - baseYMin) / zs;
  if(z.cx === null) z.cx = (baseXMin + baseXMax) / 2;
  if(z.cy === null) z.cy = (baseYMin + baseYMax) / 2;
  var xMin = z.cx - visXRange / 2, xMax = z.cx + visXRange / 2;
  var yMin = z.cy - visYRange / 2, yMax = z.cy + visYRange / 2;
  // Clamp (only when zoomed in, allow overflow when zoomed out)
  if(zs >= 1.0) {
    if(xMin < baseXMin) { xMin = baseXMin; xMax = baseXMin + visXRange; }
    if(xMax > baseXMax) { xMax = baseXMax; xMin = baseXMax - visXRange; }
    if(yMin < baseYMin) { yMin = baseYMin; yMax = baseYMin + visYRange; }
    if(yMax > baseYMax) { yMax = baseYMax; yMin = baseYMax - visYRange; }
  }
  z.cx = (xMin + xMax) / 2; z.cy = (yMin + yMax) / 2;
  
  function toX(v) { return padL + (v - xMin) / (xMax - xMin) * plotW; }
  function toY(v) { return padT + plotH - (v - yMin) / (yMax - yMin) * plotH; }
  function fromX(px) { return xMin + (px - padL) / plotW * (xMax - xMin); }
  function fromY(py) { return yMin + (padT + plotH - py) / plotH * (yMax - yMin); }
  
  // Background
  ctx.fillStyle = (_drTC||_drThemeColors()).bg;
  ctx.fillRect(0, 0, W, H);
  
  // Grid
  ctx.strokeStyle = (_drTC||_drThemeColors()).border; ctx.lineWidth = 0.5;
  var yStep = (yMax - yMin) <= 15 ? 2 : (yMax - yMin) <= 40 ? 5 : 10;
  for(var gy = Math.ceil(yMin / yStep) * yStep; gy <= yMax; gy += yStep) {
    ctx.beginPath(); ctx.moveTo(padL, toY(gy)); ctx.lineTo(W - padR, toY(gy)); ctx.stroke();
  }
  var xStep = (xMax - xMin) <= 40 ? 5 : (xMax - xMin) <= 100 ? 10 : 20;
  for(var gx = Math.ceil(xMin / xStep) * xStep; gx <= xMax; gx += xStep) {
    ctx.beginPath(); ctx.moveTo(toX(gx), padT); ctx.lineTo(toX(gx), H - padB); ctx.stroke();
  }
  
  // Axes
  ctx.strokeStyle = (_drTC||_drThemeColors()).axisLine; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();
  
  // Labels
  ctx.fillStyle = (_drTC||_drThemeColors()).textMuted; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  for(var lx = Math.ceil(xMin / xStep) * xStep; lx <= xMax; lx += xStep) {
    ctx.fillText(lx.toFixed(0), toX(lx), H - padB + 16);
  }
  ctx.textAlign = 'right';
  for(var ly = Math.ceil(yMin / yStep) * yStep; ly <= yMax; ly += yStep) {
    ctx.fillText(ly.toFixed(0), padL - 8, toY(ly) + 4);
  }
  
  // Axis titles
  ctx.fillStyle = (_drTC||_drThemeColors()).textSec; ctx.font = '600 11.5px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Araç Hızı (km/h)', padL + plotW / 2, H - 6);
  ctx.save(); ctx.translate(16, padT + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('Net % Eğim', 0, 0); ctx.restore();
  
  // Title
  ctx.fillStyle = (_drTC||_drThemeColors()).text; ctx.font = '600 13px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(title, padL + plotW / 2, 20);
  
  // Zoom indicator
  if(zs > 1.05 || zs < 0.95) {
    ctx.fillStyle = veThemeRgba('--accent-primary', 0.8, 'rgba(59,130,246,0.8)'); ctx.font = '600 10px Segoe UI, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('' + zs.toFixed(1) + '×  Scroll: Zoom — Sağ Tık+Sürükle: Kaydır — Çift Tık: Sıfırla', W - padR, padT - 8);
  }
  
  // Clip to plot area
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();
  
  // Data line
  ctx.strokeStyle = '#4a86c8'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  var visiblePts = [];
  for(var li = 0; li < data.length; li++) {
    var px = toX(data[li].x), py = toY(data[li].y);
    if(li === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    visiblePts.push({x: px, y: py, dx: data[li].x, dy: data[li].y, label: data[li].label});
  }
  ctx.stroke();
  
  // Points
  for(var pi = 0; pi < visiblePts.length; pi++) {
    var pp = visiblePts[pi];
    if(pp.x < padL - 5 || pp.x > W - padR + 5 || pp.y < padT - 5 || pp.y > H - padB + 5) continue;
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = (_drTC||_drThemeColors()).bg; ctx.fill(); ctx.strokeStyle = '#4a86c8'; ctx.lineWidth = 2; ctx.stroke();
  }
  
  // Labels
  if(showLabels) {
    ctx.font = '10px Segoe UI, sans-serif'; ctx.fillStyle = (_drTC||_drThemeColors()).textSec; ctx.textAlign = 'left';
    visiblePts.forEach(function(p) {
      if(!p.label) return;
      if(p.x < padL || p.x > W - padR || p.y < padT || p.y > H - padB) return;
      ctx.beginPath(); ctx.moveTo(p.x + 7, p.y); ctx.lineTo(p.x + 20, p.y);
      ctx.strokeStyle = (_drTC||_drThemeColors()).textMuted; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillText(p.label, p.x + 22, p.y + 3);
    });
  }
  
  // Restore from clip
  ctx.restore();
  
  // Store interaction data
  canvas._drChart = {
    type:'grade', data:data, padL:padL, padR:padR, padT:padT, padB:padB,
    plotW:plotW, plotH:plotH, xMin:xMin, xMax:xMax, yMin:yMin, yMax:yMax,
    baseXMin:baseXMin, baseXMax:baseXMax, baseYMin:baseYMin, baseYMax:baseYMax,
    fromX:fromX, fromY:fromY, title:title, showLabels:showLabels, W:W, H:H
  };
  
  // Attach events once
  if(!canvas._drEventsAttached) {
    canvas._drEventsAttached = true;
    canvas.addEventListener('wheel', _drChartWheel, {passive:false});
    canvas.addEventListener('mousedown', _drChartMouseDown);
    canvas.addEventListener('mouseup', _drChartMouseUp);
    canvas.addEventListener('mousemove', _drChartMouseMove);
    canvas.addEventListener('mouseleave', _drChartMouseLeave);
    canvas.addEventListener('dblclick', _drChartDblClick);
    canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  }
}

function veDrawGradeabilityCharts(G) {
  if(!G || !G.high) return;
  
  // Yüksek kademe
  var dataHigh = veBuildGradeChartData(G.high);
  if(dataHigh.length >= 2) {
    veRenderGradeChart('gradeChartHigh', dataHigh,
      'Transfer Kutusu: Yüksek Kademe (' + G.high.transferRatio.toFixed(3) + ')', true);
  }
  
  // Düşük kademe (varsa)
  if(G.low) {
    var dataLow = veBuildGradeChartData(G.low);
    if(dataLow.length >= 2) {
      veRenderGradeChart('gradeChartLow', dataLow,
        'Transfer Kutusu: Düşük Kademe (' + G.low.transferRatio.toFixed(3) + ')', false);
    }
    var wrap = document.getElementById('gradeChartLowWrap');
    if(wrap) wrap.style.display = '';
  } else {
    var wrap2 = document.getElementById('gradeChartLowWrap');
    if(wrap2) wrap2.style.display = 'none';
  }
}

// ── Hızlanma (Acceleration) Diyagramları — Dual Y-axis ──
function veBuildAccelChartData(accelData) {
  var timePoints = [], distPoints = [];
  for(var i = 0; i < accelData.rows.length; i++) {
    var row = accelData.rows[i];
    if(row.time === null) continue;
    timePoints.push({ x: row.targetSpeed, y: row.time });
    distPoints.push({ x: row.targetSpeed, y: row.distance });
  }
  return { timePoints: timePoints, distPoints: distPoints };
}

function veRenderAccelChart(canvasId, chartData, title) {
  var canvas = document.getElementById(canvasId);
  if(!canvas || chartData.timePoints.length < 2) return;
  
  var parentW = canvas.parentElement.clientWidth || 800;
  var chartH = 450;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = parentW * dpr;
  canvas.height = chartH * dpr;
  canvas.style.width = parentW + 'px';
  canvas.style.height = chartH + 'px';
  
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  var W = parentW, H = chartH;
  
  var padL = 65, padR = 70, padT = 42, padB = 50;
  var plotW = W - padL - padR, plotH = H - padT - padB;
  
  var tp = chartData.timePoints, dp = chartData.distPoints;
  
  // Base ranges
  var baseXMin = Math.floor(tp[0].x / 10) * 10;
  var baseXMax = Math.ceil(tp[tp.length-1].x / 10) * 10;
  if(baseXMax <= baseXMin) baseXMax = baseXMin + 20;
  var baseTMax = Math.ceil(Math.max.apply(null, tp.map(function(p){ return p.y; })) * 1.15 / 5) * 5;
  var baseDMax = Math.ceil(Math.max.apply(null, dp.map(function(p){ return p.y; })) * 1.15 / 50) * 50;
  if(baseTMax < 5) baseTMax = 5;
  if(baseDMax < 50) baseDMax = 50;
  
  // Zoom
  var z = _drGetZoom(canvasId);
  var zs = z.scale || 1.0;
  var visXRange = (baseXMax - baseXMin) / zs;
  if(z.cx === null) z.cx = (baseXMin + baseXMax) / 2;
  var xMin = z.cx - visXRange / 2, xMax = z.cx + visXRange / 2;
  if(zs >= 1.0) {
    if(xMin < baseXMin) { xMin = baseXMin; xMax = baseXMin + visXRange; }
    if(xMax > baseXMax) { xMax = baseXMax; xMin = baseXMax - visXRange; }
  }
  z.cx = (xMin + xMax) / 2;
  var yTMax = baseTMax, yDMax = baseDMax;
  
  function toX(v) { return padL + (v - xMin) / (xMax - xMin) * plotW; }
  function toYT(v) { return padT + plotH - (v / yTMax) * plotH; }
  function toYD(v) { return padT + plotH - (v / yDMax) * plotH; }
  function fromX(px) { return xMin + (px - padL) / plotW * (xMax - xMin); }
  
  // Background
  ctx.fillStyle = (_drTC||_drThemeColors()).bg; ctx.fillRect(0, 0, W, H);
  
  // Title
  ctx.fillStyle = (_drTC||_drThemeColors()).text; ctx.font = '600 13px Segoe UI, sans-serif';
  ctx.textAlign = 'center'; ctx.fillText(title, W / 2, 20);
  
  // Zoom indicator
  if(zs > 1.05 || zs < 0.95) {
    ctx.fillStyle = veThemeRgba('--accent-primary', 0.8, 'rgba(59,130,246,0.8)'); ctx.font = '600 10px Segoe UI, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('' + zs.toFixed(1) + '×  Scroll: Zoom — Sağ Tık+Sürükle: Kaydır — Çift Tık: Sıfırla', W - padR, padT - 8);
  }
  
  // Grid
  ctx.strokeStyle = (_drTC||_drThemeColors()).border; ctx.lineWidth = 0.5;
  var tStep = yTMax <= 10 ? 2 : yTMax <= 30 ? 5 : 10;
  for(var gt = 0; gt <= yTMax; gt += tStep) {
    ctx.beginPath(); ctx.moveTo(padL, toYT(gt)); ctx.lineTo(W - padR, toYT(gt)); ctx.stroke();
  }
  var xStep = (xMax - xMin) <= 40 ? 10 : 20;
  for(var gx = Math.ceil(xMin / xStep) * xStep; gx <= xMax; gx += xStep) {
    ctx.beginPath(); ctx.moveTo(toX(gx), padT); ctx.lineTo(toX(gx), H - padB); ctx.stroke();
  }
  
  // Axes
  ctx.strokeStyle = (_drTC||_drThemeColors()).axisLine; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - padR, padT); ctx.lineTo(W - padR, H - padB); ctx.stroke();
  
  // Left Y labels (Time - blue)
  ctx.fillStyle = '#4a86c8'; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'right';
  for(var lt = 0; lt <= yTMax; lt += tStep) { ctx.fillText(lt.toString(), padL - 8, toYT(lt) + 4); }
  ctx.save(); ctx.translate(16, padT + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.font = '600 11.5px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Süre (saniye)', 0, 0); ctx.restore();
  
  // Right Y labels (Distance - red)
  var dStep = yDMax <= 100 ? 20 : yDMax <= 300 ? 50 : yDMax <= 600 ? 100 : 200;
  ctx.fillStyle = '#c0392b'; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'left';
  for(var ld = 0; ld <= yDMax; ld += dStep) { ctx.fillText(ld.toString(), W - padR + 8, toYD(ld) + 4); }
  ctx.save(); ctx.translate(W - 10, padT + plotH / 2); ctx.rotate(Math.PI / 2);
  ctx.font = '600 11.5px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Mesafe (m)', 0, 0); ctx.restore();
  
  // X labels
  ctx.fillStyle = (_drTC||_drThemeColors()).textMuted; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  for(var lx = Math.ceil(xMin / xStep) * xStep; lx <= xMax; lx += xStep) { ctx.fillText(lx.toString(), toX(lx), H - padB + 16); }
  ctx.fillStyle = (_drTC||_drThemeColors()).textSec; ctx.font = '600 11.5px Segoe UI, sans-serif';
  ctx.fillText('Araç Hızı (km/h)', padL + plotW / 2, H - 6);
  
  // Clip to plot area
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();
  
  // Time line (blue)
  ctx.strokeStyle = '#4a86c8'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  for(var ti = 0; ti < tp.length; ti++) {
    var px = toX(tp[ti].x), py = toYT(tp[ti].y);
    if(ti === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  for(var tpi = 0; tpi < tp.length; tpi++) {
    var tpx = toX(tp[tpi].x), tpy = toYT(tp[tpi].y);
    if(tpx < padL - 5 || tpx > W - padR + 5) continue;
    ctx.beginPath(); ctx.arc(tpx, tpy, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = (_drTC||_drThemeColors()).bg; ctx.fill(); ctx.strokeStyle = '#4a86c8'; ctx.lineWidth = 2; ctx.stroke();
  }
  
  // Distance line (red)
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  for(var di = 0; di < dp.length; di++) {
    var dpx = toX(dp[di].x), dpy = toYD(dp[di].y);
    if(di === 0) ctx.moveTo(dpx, dpy); else ctx.lineTo(dpx, dpy);
  }
  ctx.stroke();
  for(var dpi = 0; dpi < dp.length; dpi++) {
    var ddpx = toX(dp[dpi].x), ddpy = toYD(dp[dpi].y);
    if(ddpx < padL - 5 || ddpx > W - padR + 5) continue;
    ctx.beginPath(); ctx.arc(ddpx, ddpy, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = (_drTC||_drThemeColors()).bg; ctx.fill(); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2; ctx.stroke();
  }
  
  // Restore from clip
  ctx.restore();
  
  // Legend
  var legX = padL + 14, legY = padT + 12;
  ctx.font = '11px Segoe UI, sans-serif';
  ctx.strokeStyle = '#4a86c8'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(legX, legY); ctx.lineTo(legX + 24, legY); ctx.stroke();
  ctx.beginPath(); ctx.arc(legX + 12, legY, 3.5, 0, Math.PI * 2); ctx.fillStyle = (_drTC||_drThemeColors()).bg; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4a86c8'; ctx.textAlign = 'left'; ctx.fillText('Süre (s)', legX + 30, legY + 4);
  legY += 18;
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(legX, legY); ctx.lineTo(legX + 24, legY); ctx.stroke();
  ctx.beginPath(); ctx.arc(legX + 12, legY, 3.5, 0, Math.PI * 2); ctx.fillStyle = (_drTC||_drThemeColors()).bg; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c0392b'; ctx.fillText('Mesafe (m)', legX + 30, legY + 4);
  
  // Store interaction data
  canvas._drChart = {
    type:'accel', tp:tp, dp:dp, padL:padL, padR:padR, padT:padT, padB:padB,
    plotW:plotW, plotH:plotH, xMin:xMin, xMax:xMax, yTMax:yTMax, yDMax:yDMax,
    baseXMin:baseXMin, baseXMax:baseXMax, baseTMax:baseTMax, baseDMax:baseDMax,
    fromX:fromX, title:title, chartData:chartData, W:W, H:H
  };
  
  if(!canvas._drEventsAttached) {
    canvas._drEventsAttached = true;
    canvas.addEventListener('wheel', _drChartWheel, {passive:false});
    canvas.addEventListener('mousedown', _drChartMouseDown);
    canvas.addEventListener('mouseup', _drChartMouseUp);
    canvas.addEventListener('mousemove', _drChartMouseMove);
    canvas.addEventListener('mouseleave', _drChartMouseLeave);
    canvas.addEventListener('dblclick', _drChartDblClick);
    canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  }
}

function veDrawAccelerationCharts(A) {
  if(!A || !A.high) return;
  var dataHigh = veBuildAccelChartData(A.high);
  if(dataHigh.timePoints.length >= 2) veRenderAccelChart('accelChartHigh', dataHigh, 'Transfer Kutusu: Yüksek Kademe (' + A.high.transferRatio.toFixed(3) + ')');
  if(A.low) {
    var dataLow = veBuildAccelChartData(A.low);
    if(dataLow.timePoints.length >= 2) veRenderAccelChart('accelChartLow', dataLow, 'Transfer Kutusu: Düşük Kademe (' + A.low.transferRatio.toFixed(3) + ')');
    var wrap = document.getElementById('accelChartLowWrap');
    if(wrap) wrap.style.display = '';
  } else {
    var wrap2 = document.getElementById('accelChartLowWrap');
    if(wrap2) wrap2.style.display = 'none';
  }
}

// ── Unified report chart interaction handlers ──

function _drRedrawChart(canvas) {
  var id = canvas.id;
  var d = canvas._drChart;
  if(!d) return;
  if(d.type === 'grade') {
    veRenderGradeChart(id, d.data, d.title, d.showLabels);
  } else if(d.type === 'accel') {
    veRenderAccelChart(id, d.chartData, d.title);
  } else if(d.type === 'ftUpshift') {
    veRenderFTUpshiftChart(id, d.data);
  } else if(d.type === 'distGrade') {
    veRenderDistGradeProfile(id, d.segments, d.nodeId);
  } else if(d.type === 'altProfile') {
    veRenderAltitudeProfile(id, d.gpsSamples, d.nodeId);
  }
}

function _drChartWheel(e) {
  e.preventDefault();
  var canvas = e.target;
  var d = canvas._drChart;
  if(!d) return;
  var rect = canvas.getBoundingClientRect();
  var mx = e.clientX - rect.left, my = e.clientY - rect.top;
  if(mx < d.padL || mx > d.W - d.padR || my < d.padT || my > d.H - d.padB) return;
  
  var z = _drGetZoom(canvas.id);
  var oldScale = z.scale;
  var delta = e.deltaY > 0 ? 0.85 : 1.18;
  z.scale = Math.max(0.3, Math.min(8.0, oldScale * delta));
  if(z.scale === oldScale) return;
  _drRedrawChart(canvas);
}

function _drChartMouseDown(e) {
  if(e.button !== 2) return;
  e.preventDefault();
  var canvas = e.target;
  var d = canvas._drChart;
  if(!d) return;
  _drChartPan.active = true;
  _drChartPan.canvasId = canvas.id;
  _drChartPan.startX = e.clientX;
  _drChartPan.startY = e.clientY;
  var z = _drGetZoom(canvas.id);
  _drChartPan.startCX = z.cx;
  _drChartPan.startCY = z.cy;
  canvas.style.cursor = 'grabbing';
  // Hide tooltip
  var tip = document.getElementById(canvas.id + '-tooltip');
  if(tip) tip.classList.remove('visible');
}

function _drChartMouseUp(e) {
  if(e.button !== 2 || !_drChartPan.active) return;
  _drChartPan.active = false;
  var canvas = e.target;
  canvas.style.cursor = 'crosshair';
}

function _drChartDblClick(e) {
  var canvas = e.target;
  _drChartZoom[canvas.id] = { scale:1.0, cx:null, cy:null };
  _drRedrawChart(canvas);
}

function _drChartMouseLeave(e) {
  var canvas = e.target;
  if(_drChartPan.active && _drChartPan.canvasId === canvas.id) {
    _drChartPan.active = false;
    canvas.style.cursor = 'crosshair';
  }
  var tip = document.getElementById(canvas.id + '-tooltip');
  var cv = document.getElementById(canvas.id + '-crossV');
  var ch = document.getElementById(canvas.id + '-crossH');
  if(tip) tip.classList.remove('visible');
  if(cv) cv.style.display = 'none';
  if(ch) ch.style.display = 'none';
}

var _DR_SNAP_DIST = 25; // piksel: veri noktasına bu kadar yaklaşınca tooltip görünsün

function _drChartMouseMove(e) {
  var canvas = e.target;
  var d = canvas._drChart;
  if(!d) return;
  var rect = canvas.getBoundingClientRect();
  var mx = e.clientX - rect.left, my = e.clientY - rect.top;

  // Pan
  if(_drChartPan.active && _drChartPan.canvasId === canvas.id) {
    var z = _drGetZoom(canvas.id);
    var dx = e.clientX - _drChartPan.startX;
    var dy = e.clientY - _drChartPan.startY;
    var xRange = (d.baseXMax - d.baseXMin) / z.scale;
    z.cx = _drChartPan.startCX - dx / d.plotW * xRange;
    if(d.type === 'grade' || d.type === 'distGrade' || d.type === 'altProfile') {
      var yRange = (d.baseYMax - d.baseYMin) / z.scale;
      z.cy = _drChartPan.startCY + dy / d.plotH * yRange;
    }
    _drRedrawChart(canvas);
    return;
  }

  // Outside plot area
  if(mx < d.padL || mx > d.W - d.padR || my < d.padT || my > d.H - d.padB) {
    var tip0 = document.getElementById(canvas.id + '-tooltip');
    var cv0 = document.getElementById(canvas.id + '-crossV');
    var ch0 = document.getElementById(canvas.id + '-crossH');
    if(tip0) tip0.classList.remove('visible');
    if(cv0) cv0.style.display = 'none';
    if(ch0) ch0.style.display = 'none';
    return;
  }

  // Crosshair
  var crossV = document.getElementById(canvas.id + '-crossV');
  var crossH = document.getElementById(canvas.id + '-crossH');
  if(crossV) { crossV.style.display = 'block'; crossV.style.left = mx + 'px'; }
  if(crossH) { crossH.style.display = 'block'; crossH.style.top = my + 'px'; }

  // Tooltip
  var tip = document.getElementById(canvas.id + '-tooltip');
  if(!tip) return;

  var xVal = d.fromX(mx);
  var html = '';
  var snapOk = false; // veri noktasına yeterince yakın mı?

  if(d.type === 'grade') {
    // En yakın veri noktasını bul
    var nearest = null, nearDist = Infinity;
    d.data.forEach(function(p) {
      var ppx = d.padL + (p.x - d.xMin) / (d.xMax - d.xMin) * d.plotW;
      var ppy = d.padT + d.plotH - (p.y - d.yMin) / (d.yMax - d.yMin) * d.plotH;
      var dist = Math.sqrt((mx - ppx) * (mx - ppx) + (my - ppy) * (my - ppy));
      if(dist < nearDist) { nearDist = dist; nearest = p; }
    });
    if(nearest && nearDist <= _DR_SNAP_DIST) {
      snapOk = true;
      html = '<div style="font-weight:600; color:#fff; margin-bottom:3px;">Eğim Kabiliyeti</div>';
      html += '<div>Hız: <b style="color:#60a5fa;">' + nearest.x.toFixed(1) + '</b> km/h</div>';
      html += '<div>Eğim: <b style="color:#60a5fa;">' + nearest.y.toFixed(1) + '</b> %</div>';
      if(nearest.label) html += '<div style="border-top:1px solid rgba(255,255,255,0.15); margin-top:3px; padding-top:3px;">' + nearest.label + '</div>';
    }
  } else if(d.type === 'accel') {
    // Her iki çizgi üzerindeki en yakın noktayı bul
    var bestDist = Infinity, bestTP = null, bestDP = null;
    for(var i = 0; i < d.tp.length; i++) {
      var tpx = d.padL + (d.tp[i].x - d.xMin) / (d.xMax - d.xMin) * d.plotW;
      var tpy = d.padT + d.plotH - (d.tp[i].y / d.yTMax) * d.plotH;
      var dist = Math.sqrt((mx - tpx) * (mx - tpx) + (my - tpy) * (my - tpy));
      if(dist < bestDist) { bestDist = dist; bestTP = d.tp[i]; }
    }
    for(var j = 0; j < d.dp.length; j++) {
      var dpx = d.padL + (d.dp[j].x - d.xMin) / (d.xMax - d.xMin) * d.plotW;
      var dpy = d.padT + d.plotH - (d.dp[j].y / d.yDMax) * d.plotH;
      var dist2 = Math.sqrt((mx - dpx) * (mx - dpx) + (my - dpy) * (my - dpy));
      if(dist2 < bestDist) { bestDist = dist2; bestDP = d.dp[j]; bestTP = null; }
    }
    if(bestDist <= _DR_SNAP_DIST) {
      snapOk = true;
      // Snap edilen noktanın hız değerinde her iki çizginin değerini bul
      var snapSpeed = bestTP ? bestTP.x : bestDP.x;
      var tVal = null, dValI = null;
      for(var ti = 0; ti < d.tp.length; ti++) { if(Math.abs(d.tp[ti].x - snapSpeed) < 0.01) { tVal = d.tp[ti].y; break; } }
      for(var di = 0; di < d.dp.length; di++) { if(Math.abs(d.dp[di].x - snapSpeed) < 0.01) { dValI = d.dp[di].y; break; } }
      html = '<div style="font-weight:600; color:#fff; margin-bottom:3px;">Hızlanma</div>';
      html += '<div>Hız: <b style="color:#60a5fa;">' + snapSpeed.toFixed(1) + '</b> km/h</div>';
      if(tVal !== null) html += '<div>Süre: <b style="color:#4a86c8;">' + tVal.toFixed(2) + '</b> s</div>';
      if(dValI !== null) html += '<div>Mesafe: <b style="color:#c0392b;">' + Math.round(dValI) + '</b> m</div>';
    }
  } else if(d.type === 'distGrade') {
    // Hangi segmentte olduğunu bul
    var dps = d.dataPoints;
    for(var si = 0; si < dps.length; si++) {
      var spx1 = d.padL + (dps[si].xStart - d.xMin) / (d.xMax - d.xMin) * d.plotW;
      var spx2 = d.padL + (dps[si].xEnd - d.xMin) / (d.xMax - d.xMin) * d.plotW;
      if(mx >= spx1 && mx <= spx2) {
        snapOk = true;
        var segLabel = dps[si].xStart.toFixed(0) + ' — ' + dps[si].xEnd.toFixed(0) + ' m';
        html = '<div style="font-weight:600; color:#fff; margin-bottom:3px;">Segment ' + (si + 1) + '</div>';
        html += '<div>Mesafe: <b style="color:#60a5fa;">' + segLabel + '</b></div>';
        html += '<div>Uzunluk: <b style="color:#60a5fa;">' + dps[si].mesafe.toFixed(0) + '</b> m</div>';
        html += '<div>Eğim: <b style="color:' + (dps[si].grade > 0.5 ? '#4caf50' : (dps[si].grade < -0.5 ? '#ef5350' : '#8b95a5')) + ';">' + (dps[si].grade > 0 ? '↓' : (dps[si].grade < 0 ? '↑' : '→')) + ' %' + dps[si].grade.toFixed(1) + '</b></div>';
        html += '<div>Δh: <b style="color:#60a5fa;">' + dps[si].deltaH.toFixed(1) + '</b> m</div>';
        break;
      }
    }
  } else if(d.type === 'altProfile') {
    // Rakım profilinde en yakın noktayı bul
    var aptXVal = d.fromX(mx);
    if(aptXVal >= 0 && aptXVal <= d.totalDist && d.pts && d.pts.length >= 2) {
      snapOk = true;
      // İnterpolasyon ile yükseklik bul
      var aptElev = d.pts[d.pts.length - 1].elev;
      for(var ak = 0; ak < d.pts.length - 1; ak++) {
        if(aptXVal >= d.pts[ak].dist && aptXVal <= d.pts[ak+1].dist) {
          var at = (aptXVal - d.pts[ak].dist) / (d.pts[ak+1].dist - d.pts[ak].dist);
          aptElev = d.pts[ak].elev + at * (d.pts[ak+1].elev - d.pts[ak].elev);
          break;
        }
      }
      var aptDistLabel = aptXVal.toFixed(0) + ' m';
      html = '<div style="font-weight:600; color:#fff; margin-bottom:3px;">Rakım Profili</div>';
      html += '<div>Mesafe: <b style="color:#60a5fa;">' + aptDistLabel + '</b></div>';
      html += '<div>Rakım: <b style="color:#b39ddb;">' + aptElev.toFixed(1) + '</b> m</div>';
    }
  }

  if(snapOk) {
    tip.innerHTML = html;
    tip.classList.add('visible');
    var tw = tip.offsetWidth || 200;
    var tx = mx + 16, ty = my - 10;
    if(tx + tw > d.W - 10) tx = mx - tw - 12;
    if(ty < d.padT) ty = d.padT;
    if(ty + (tip.offsetHeight || 80) > d.H - 10) ty = d.H - (tip.offsetHeight || 80) - 10;
    tip.style.left = tx + 'px';
    tip.style.top = ty + 'px';
  } else {
    tip.classList.remove('visible');
  }
}

// Motor eğrisi grafiği çiz — interactive with zoom/pan/tooltip
var _drEngZoom = { scale: 1.0, cx: null, cy: null };
var _drEngPan = { active: false, startX: 0, startY: 0, startCX: 0, startCY: 0 };
var _drEngData = null;

function drEngineResetZoom() {
  _drEngZoom = { scale: 1.0, cx: null, cy: null };
  var ind = document.getElementById('dr-engine-zoom-ind');
  if(ind) ind.style.display = 'none';
  if(_drEngData) veDrawEngineChart(_drEngData.torqueData, _drEngData.governed, _drEngData.noLoad, _drEngData.fanLossGov, _drEngData.otherLossGov);
}

function veDrawEngineChart(torqueData, governed, noLoad, fanLossGov, otherLossGov) {
  var wrap = document.getElementById('dr-engine-chart-wrap');
  var canvas = document.getElementById('dr-engine-chart');
  if(!canvas || !torqueData || torqueData.length < 2) return;
  
  _drEngData = { torqueData:torqueData, governed:governed, noLoad:noLoad, fanLossGov:fanLossGov, otherLossGov:otherLossGov };
  
  var rect = (wrap || canvas.parentElement).getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  var W = rect.width, H = rect.height;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  var margin = {top: 28, right: 72, bottom: 48, left: 68};
  var pw = W - margin.left - margin.right;
  var ph = H - margin.top - margin.bottom;
  
  var points = [];
  torqueData.forEach(function(p) {
    if(!p.rpm || p.rpm <= 0) return;
    var rpm = p.rpm;
    var netPwr = p.power || (p.torque * rpm * Math.PI / 30000);
    var netTrk = p.torque || (netPwr * 30000 / (Math.PI * rpm));
    var ratio = governed > 0 ? rpm / governed : 0;
    var fanPwr = fanLossGov * ratio * ratio * ratio;
    var otherPwr = otherLossGov * ratio;
    var grossPwr = netPwr + fanPwr + otherPwr;
    var grossTrk = rpm > 0 ? grossPwr * 30000 / (Math.PI * rpm) : 0;
    points.push({rpm:rpm, grossPwr:grossPwr, grossTrk:grossTrk, netPwr:netPwr, netTrk:netTrk});
  });
  
  // Base ranges
  var baseRpmMin = points[0].rpm, baseRpmMax = points[points.length-1].rpm;
  var basePwrMax = 0, baseTrkMax = 0;
  points.forEach(function(p) {
    if(p.grossPwr > basePwrMax) basePwrMax = p.grossPwr;
    if(p.grossTrk > baseTrkMax) baseTrkMax = p.grossTrk;
  });
  basePwrMax = Math.ceil(basePwrMax / 20) * 20 + 20;
  baseTrkMax = Math.ceil(baseTrkMax / 100) * 100 + 100;
  
  // Apply zoom
  var zs = _drEngZoom.scale || 1.0;
  var visRpmRange = (baseRpmMax - baseRpmMin) / zs;
  var visPwrRange = basePwrMax / zs;
  if(_drEngZoom.cx === null) _drEngZoom.cx = (baseRpmMin + baseRpmMax) / 2;
  if(_drEngZoom.cy === null) _drEngZoom.cy = basePwrMax / 2;
  var rpmMin = _drEngZoom.cx - visRpmRange / 2, rpmMax = _drEngZoom.cx + visRpmRange / 2;
  var pwrMin = _drEngZoom.cy - visPwrRange / 2, pwrMax = _drEngZoom.cy + visPwrRange / 2;
  // Clamp
  if(rpmMin < baseRpmMin - (baseRpmMax - baseRpmMin) * 0.3) rpmMin = baseRpmMin - (baseRpmMax - baseRpmMin) * 0.3;
  if(rpmMax > baseRpmMax + (baseRpmMax - baseRpmMin) * 0.3) rpmMax = baseRpmMax + (baseRpmMax - baseRpmMin) * 0.3;
  if(pwrMin < -basePwrMax * 0.1) pwrMin = -basePwrMax * 0.1;
  if(pwrMax > basePwrMax * 1.3) pwrMax = basePwrMax * 1.3;
  _drEngZoom.cx = (rpmMin + rpmMax) / 2;
  _drEngZoom.cy = (pwrMin + pwrMax) / 2;
  
  var trkMin = pwrMin / basePwrMax * baseTrkMax;
  var trkMax = pwrMax / basePwrMax * baseTrkMax;
  
  function toX(rpm) { return margin.left + (rpm - rpmMin) / (rpmMax - rpmMin) * pw; }
  function toYP(pwr) { return margin.top + ph - (pwr - pwrMin) / (pwrMax - pwrMin) * ph; }
  function toYT(trk) { return margin.top + ph - (trk - trkMin) / (trkMax - trkMin) * ph; }
  
  // Clear
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = (_drTC||_drThemeColors()).bg; ctx.fillRect(0, 0, W, H);
  
  // Grid
  ctx.strokeStyle = (_drTC||_drThemeColors()).border; ctx.lineWidth = 0.5;
  var pwrStep = basePwrMax <= 100 ? 20 : basePwrMax <= 200 ? 40 : basePwrMax <= 400 ? 50 : 100;
  for(var gp = Math.ceil(pwrMin / pwrStep) * pwrStep; gp <= pwrMax; gp += pwrStep) {
    var gy = toYP(gp);
    if(gy < margin.top || gy > H - margin.bottom) continue;
    ctx.beginPath(); ctx.moveTo(margin.left, gy); ctx.lineTo(W - margin.right, gy); ctx.stroke();
  }
  var rpmStep = 200;
  for(var gr = Math.ceil(rpmMin / rpmStep) * rpmStep; gr <= rpmMax; gr += rpmStep) {
    var gx = toX(gr);
    if(gx < margin.left || gx > W - margin.right) continue;
    ctx.beginPath(); ctx.moveTo(gx, margin.top); ctx.lineTo(gx, H - margin.bottom); ctx.stroke();
  }
  
  // Axes
  ctx.strokeStyle = (_drTC||_drThemeColors()).axisLine; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(margin.left, margin.top); ctx.lineTo(margin.left, H - margin.bottom);
  ctx.lineTo(W - margin.right, H - margin.bottom); ctx.lineTo(W - margin.right, margin.top); ctx.stroke();
  
  // Clip to plot area
  ctx.save();
  ctx.beginPath();
  ctx.rect(margin.left, margin.top, pw, ph);
  ctx.clip();
  
  // Draw lines
  function drawLine(data, getX, getYVal, yMin, yMax, color, dash) {
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash(dash || []); ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach(function(p, i) {
      var x = toX(getX(p));
      var y = margin.top + ph - (getYVal(p) - yMin) / (yMax - yMin) * ph;
      if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke(); ctx.setLineDash([]);
  }
  
  var getR = function(p) { return p.rpm; };
  var validPwr = points.filter(function(p) { return p.grossPwr >= 0; });
  var validTrk = points.filter(function(p) { return p.grossTrk >= 0; });
  
  drawLine(validPwr, getR, function(p){return p.grossPwr;}, pwrMin, pwrMax, '#3b82f6', []);
  drawLine(validPwr, getR, function(p){return p.netPwr;}, pwrMin, pwrMax, '#3b82f6', [6,3]);
  drawLine(validTrk, getR, function(p){return p.grossTrk;}, trkMin, trkMax, '#ef4444', []);
  drawLine(validTrk, getR, function(p){return p.netTrk;}, trkMin, trkMax, '#ef4444', [6,3]);
  
  // Restore from clip
  ctx.restore();
  
  // X labels
  ctx.fillStyle = (_drTC||_drThemeColors()).textMuted; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  for(var r = Math.ceil(rpmMin / rpmStep) * rpmStep; r <= rpmMax; r += rpmStep) {
    var lx = toX(r);
    if(lx < margin.left + 10 || lx > W - margin.right - 10) continue;
    ctx.fillText(r.toLocaleString('tr-TR'), lx, H - margin.bottom + 16);
  }
  ctx.fillStyle = (_drTC||_drThemeColors()).textSec; ctx.font = '600 11.5px Segoe UI, sans-serif';
  ctx.fillText('Devir (rpm)', margin.left + pw/2, H - 6);
  
  // Left Y labels (Power - blue)
  ctx.fillStyle = '#3b82f6'; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'right';
  for(var pp = Math.ceil(pwrMin / pwrStep) * pwrStep; pp <= pwrMax; pp += pwrStep) {
    var yp = toYP(pp);
    if(yp < margin.top + 5 || yp > H - margin.bottom - 5) continue;
    ctx.fillText(pp.toFixed(0), margin.left - 8, yp + 4);
  }
  ctx.save(); ctx.translate(16, margin.top + ph/2); ctx.rotate(-Math.PI/2);
  ctx.font = '600 11.5px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Güç (kW)', 0, 0); ctx.restore();
  
  // Right Y labels (Torque - red)
  var trkStep = baseTrkMax <= 400 ? 100 : baseTrkMax <= 800 ? 200 : baseTrkMax <= 1500 ? 200 : 500;
  ctx.fillStyle = '#ef4444'; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'left';
  for(var tt = Math.ceil(trkMin / trkStep) * trkStep; tt <= trkMax; tt += trkStep) {
    var yt = toYT(tt);
    if(yt < margin.top + 5 || yt > H - margin.bottom - 5) continue;
    ctx.fillText(tt.toFixed(0), W - margin.right + 8, yt + 4);
  }
  ctx.save(); ctx.translate(W - 10, margin.top + ph/2); ctx.rotate(Math.PI/2);
  ctx.font = '600 11.5px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Tork (N·m)', 0, 0); ctx.restore();
  
  // Zoom indicator
  if(zs > 1.05 || zs < 0.95) {
    ctx.fillStyle = veThemeRgba('--accent-primary', 0.8, 'rgba(59,130,246,0.8)'); ctx.font = '600 10px Segoe UI, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('' + zs.toFixed(1) + '×', W - margin.right - 4, margin.top + 14);
  }
  
  // Legend
  var lx = margin.left + 14, ly = margin.top + 12;
  [{color:'#3b82f6',dash:false,label:'Brüt Güç (kW)'},{color:'#3b82f6',dash:true,label:'Net Güç (kW)'},
   {color:'#ef4444',dash:false,label:'Brüt Tork (N·m)'},{color:'#ef4444',dash:true,label:'Net Tork (N·m)'}
  ].forEach(function(it, i) {
    var y = ly + i * 17;
    ctx.strokeStyle = it.color; ctx.lineWidth = 2.5; ctx.setLineDash(it.dash ? [6,3] : []);
    ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + 24, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = (_drTC||_drThemeColors()).textMuted; ctx.font = '10px Segoe UI, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(it.label, lx + 30, y + 3);
  });
  
  // Store layout for interaction
  canvas._drEngLayout = {
    margin:margin, pw:pw, ph:ph, W:W, H:H, points:points,
    rpmMin:rpmMin, rpmMax:rpmMax, pwrMin:pwrMin, pwrMax:pwrMax, trkMin:trkMin, trkMax:trkMax,
    baseRpmMin:baseRpmMin, baseRpmMax:baseRpmMax, basePwrMax:basePwrMax, baseTrkMax:baseTrkMax
  };
  
  // Attach events once
  if(!canvas._drEngEventsAttached && wrap) {
    canvas._drEngEventsAttached = true;
    wrap.addEventListener('wheel', function(e) {
      e.preventDefault();
      var old = _drEngZoom.scale;
      var delta = e.deltaY > 0 ? 0.85 : 1.18;
      _drEngZoom.scale = Math.max(0.3, Math.min(12.0, old * delta));
      if(_drEngZoom.scale === old) return;
      veDrawEngineChart(torqueData, governed, noLoad, fanLossGov, otherLossGov);
      var ind = document.getElementById('dr-engine-zoom-ind');
      if(ind) { if(_drEngZoom.scale > 1.05 || _drEngZoom.scale < 0.95){ind.textContent=''+_drEngZoom.scale.toFixed(1)+'×';ind.style.display='inline';}else{ind.style.display='none';} }
    }, {passive:false});
    wrap.addEventListener('mousedown', function(e) {
      if(e.button !== 2) return; e.preventDefault();
      _drEngPan.active = true; _drEngPan.startX = e.clientX; _drEngPan.startY = e.clientY;
      _drEngPan.startCX = _drEngZoom.cx; _drEngPan.startCY = _drEngZoom.cy;
      wrap.style.cursor = 'grabbing';
    });
    wrap.addEventListener('mousemove', function(e) {
      if(_drEngPan.active) {
        var L = canvas._drEngLayout;
        if(!L) return;
        var dx = e.clientX - _drEngPan.startX, dy = e.clientY - _drEngPan.startY;
        _drEngZoom.cx = _drEngPan.startCX - dx / L.pw * (L.rpmMax - L.rpmMin);
        _drEngZoom.cy = _drEngPan.startCY + dy / L.ph * (L.pwrMax - L.pwrMin);
        veDrawEngineChart(torqueData, governed, noLoad, fanLossGov, otherLossGov);
        return;
      }
      // Tooltip
      var L = canvas._drEngLayout;
      if(!L) return;
      var rect = wrap.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var tip = document.getElementById('dr-engine-tooltip');
      var cv = document.getElementById('dr-engine-crossV');
      var ch = document.getElementById('dr-engine-crossH');
      if(mx < L.margin.left || mx > L.W - L.margin.right || my < L.margin.top || my > L.H - L.margin.bottom) {
        if(tip) tip.classList.remove('visible');
        if(cv) cv.style.display = 'none';
        if(ch) ch.style.display = 'none';
        return;
      }
      if(cv) { cv.style.display = 'block'; cv.style.left = mx + 'px'; }
      if(ch) { ch.style.display = 'block'; ch.style.top = my + 'px'; }
      // En yakın veri noktasına piksel mesafesini hesapla
      var nearest = null, bestPxDist = Infinity;
      L.points.forEach(function(p) {
        var ppx = L.margin.left + (p.rpm - L.rpmMin) / (L.rpmMax - L.rpmMin) * L.pw;
        // Güç eğrileri (sol eksen)
        var pwyG = L.margin.top + L.ph - ((p.grossPwr - L.pwrMin) / (L.pwrMax - L.pwrMin)) * L.ph;
        var dG = Math.sqrt((mx - ppx) * (mx - ppx) + (my - pwyG) * (my - pwyG));
        if(dG < bestPxDist) { bestPxDist = dG; nearest = p; }
        var pwyN = L.margin.top + L.ph - ((p.netPwr - L.pwrMin) / (L.pwrMax - L.pwrMin)) * L.ph;
        var dN = Math.sqrt((mx - ppx) * (mx - ppx) + (my - pwyN) * (my - pwyN));
        if(dN < bestPxDist) { bestPxDist = dN; nearest = p; }
        // Tork eğrileri (sağ eksen)
        var ptyG = L.margin.top + L.ph - ((p.grossTrk - L.trkMin) / (L.trkMax - L.trkMin)) * L.ph;
        var dtG = Math.sqrt((mx - ppx) * (mx - ppx) + (my - ptyG) * (my - ptyG));
        if(dtG < bestPxDist) { bestPxDist = dtG; nearest = p; }
        var ptyN = L.margin.top + L.ph - ((p.netTrk - L.trkMin) / (L.trkMax - L.trkMin)) * L.ph;
        var dtN = Math.sqrt((mx - ppx) * (mx - ppx) + (my - ptyN) * (my - ptyN));
        if(dtN < bestPxDist) { bestPxDist = dtN; nearest = p; }
      });
      if(tip && nearest && bestPxDist <= _DR_SNAP_DIST) {
        var html = '<div style="font-weight:600; color:#fff; margin-bottom:3px;">Motor Eğrisi</div>';
        html += '<div>Devir: <b style="color:#60a5fa;">' + nearest.rpm.toLocaleString('tr-TR') + '</b> rpm</div>';
        html += '<div style="color:#93c5fd;">Brüt Güç: <b>' + nearest.grossPwr.toFixed(1) + '</b> kW</div>';
        html += '<div style="color:#93c5fd;">Net Güç: <b>' + nearest.netPwr.toFixed(1) + '</b> kW</div>';
        html += '<div style="color:#fca5a5;">Brüt Tork: <b>' + nearest.grossTrk.toFixed(0) + '</b> N·m</div>';
        html += '<div style="color:#fca5a5;">Net Tork: <b>' + nearest.netTrk.toFixed(0) + '</b> N·m</div>';
        tip.innerHTML = html;
        tip.classList.add('visible');
        var tw = tip.offsetWidth || 200;
        var tx = mx + 16, ty = my - 10;
        if(tx + tw > L.W - 10) tx = mx - tw - 12;
        if(ty < L.margin.top) ty = L.margin.top;
        tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
      } else if(tip) {
        tip.classList.remove('visible');
      }
    });
    wrap.addEventListener('mouseup', function(e) {
      if(e.button === 2 && _drEngPan.active) { _drEngPan.active = false; wrap.style.cursor = 'crosshair'; }
    });
    wrap.addEventListener('mouseleave', function() {
      if(_drEngPan.active) { _drEngPan.active = false; wrap.style.cursor = 'crosshair'; }
      var tip = document.getElementById('dr-engine-tooltip');
      var cv = document.getElementById('dr-engine-crossV');
      var ch = document.getElementById('dr-engine-crossH');
      if(tip) tip.classList.remove('visible');
      if(cv) cv.style.display = 'none';
      if(ch) ch.style.display = 'none';
    });
    wrap.addEventListener('dblclick', function() { drEngineResetZoom(); });
    wrap.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  }
}

// ═══════ TXT RAPOR ÖNİZLEME ═══════
// TXT raporu önizlemede YATAYDA ORTALAR. Metni boş-satır bloklarına ayırır,
// her bloğu ayrı <pre width:fit-content; margin:0 auto> olarak render eder →
// tüm bloklar aynı merkez ekseninde. Blok-içi sütun hizası korunur (her blok
// tek parça kayar). Boş satır aralıkları eşdeğer yükseklikte boşlukla korunur.
// İndirilen .txt DEĞİŞMEZ — ham metin ayrıca saklanır.
function veRenderCenteredTXT(txtContent) {
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var lines = String(txtContent == null ? '' : txtContent).split('\n');
  var out = '', cur = [], blanks = 0;
  function flush(){
    if(!cur.length) return;
    out += '<pre style="margin:0 auto; padding:0; width:fit-content; max-width:100%; white-space:pre; overflow-x:auto; line-height:1.55;">' + esc(cur.join('\n')) + '</pre>';
    cur = [];
  }
  for(var i=0;i<lines.length;i++){
    if(lines[i].trim()===''){ flush(); blanks++; }
    else {
      if(blanks>0){ out += '<div style="height:' + (blanks*1.55).toFixed(2) + 'em;"></div>'; blanks=0; }
      cur.push(lines[i]);
    }
  }
  flush();
  return out;
}

// Raporu, HER TARAYICIDA önizlemedeki gibi ORTALI açılan, kendi kendine yeten
// bir HTML belgeye sarar. (Düz .txt tarayıcıda daima sola yaslı gelir — metin
// CSS taşımaz; ortalama yalnız HTML/CSS ile mümkün.)
function veBuildReportHTML(content, title) {
  var t = String(title || 'MFSim Rapor').replace(/[<>&"]/g, '');
  return '<!DOCTYPE html>\n<html lang="tr"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + t + '</title><style>' +
    'html,body{margin:0;background:#eceff3;}' +
    '.mf-wrap{padding:28px 12px;}' +
    '.mf-card{width:fit-content;max-width:100%;margin:0 auto;background:#fff;' +
    'border:1px solid #d8dce2;box-shadow:0 2px 14px rgba(0,0,0,.08);' +
    'padding:26px 34px;box-sizing:border-box;}' +
    '.mf-card pre{margin:0 auto;padding:0;width:fit-content;max-width:100%;' +
    'white-space:pre;overflow-x:auto;line-height:1.5;font-size:var(--fs-md);color:#14171c;' +
    "font-family:'Consolas','Menlo','DejaVu Sans Mono','Courier New',monospace;}" +
    '@media(prefers-color-scheme:dark){html,body{background:#23201c;}' +
    '.mf-card{background:#2b2621;border-color:#3d352e;}.mf-card pre{color:#e6ddd0;}}' +
    '@media print{html,body{background:#fff;}.mf-card{border:none;box-shadow:none;}}' +
    '</style></head><body><div class="mf-wrap"><div class="mf-card">' +
    veRenderCenteredTXT(content) + '</div></div></body></html>';
}

function veDownloadReportHTML() {
  if(!window._veTxtPreviewContent) { showToast('İndirilecek içerik bulunamadı', 'warning'); return; }
  var name = (window._veTxtPreviewFilename || 'rapor.txt').replace(/\.txt$/i, '') + '.html';
  var html = veBuildReportHTML(window._veTxtPreviewContent, name);
  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
  showToast('HTML rapor indirildi — tarayıcıda ortalı açılır', 'success');
}

function veRenderTXTReport(reportType) {
  var overlay = document.getElementById('ve-report-overlay');
  if(!overlay) return;

  var sim = window.veSimResults;
  if(!sim || !sim.time || sim.time.length === 0) {
    showToast('Rapor verisi bulunamadı — önce simülasyon çalıştırın', 'warning');
    return;
  }

  // TXT içeriğini üret
  var txtContent = '';
  var downloadName = '';
  var reportTitle = '';
  var now = new Date();
  var dateStr = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');

  if(reportType === 'ft') {
    txtContent = veGenerateFTTxtReport(sim);
    downloadName = 'BMC_TamGaz_Rapor_' + dateStr + '.txt';
    reportTitle = 'Tam Gaz Hızlanma Raporu (TXT)';
  } else if(reportType === 'ft-trace' || reportType === 'ft-trace-low') {
    if(typeof veGenerateFTCalcTraceReport !== 'function') { showToast('İz rapor fonksiyonu bulunamadı', 'warning'); return; }
    var _isLow = (reportType === 'ft-trace-low');
    showToast('Detay matematik hesapları üretiliyor…', 'info');
    txtContent = veGenerateFTCalcTraceReport(sim, null, _isLow ? 'low' : null);
    // Üreteç kısa bir "(... uretilemedi ...)" mesajı döndürdüyse (parantezle başlar) uyar
    if(txtContent && txtContent.charAt(0) === '(') { showToast(txtContent.replace(/[()]/g, '').trim(), 'warning'); return; }
    downloadName = 'BMC_TamGaz_DetayMatematik_' + (_isLow ? 'DusukKademe_' : '') + dateStr + '.txt';
    reportTitle = 'Tam Gaz — Detay Matematik Hesapları' + (_isLow ? ' — Düşük Kademe' : '') + ' (TXT)';
  }

  if(!txtContent) { showToast('Rapor oluşturulamadı', 'warning'); return; }

  // Overlay HTML
  var html = '';
  // Header bar
  html += '<div style="padding:10px 16px; background:var(--bg-secondary); border-bottom:2px solid var(--border-color); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">';
  html += '<div style="display:flex; align-items:center; gap:8px;">';
  html += '<span style="font-size:var(--fs-title);"><span class="mf-ico mf-ico-file-text"></span></span>';
  html += '<span style="font-size:var(--fs-lg); font-weight:700; color:var(--text-heading);">' + reportTitle + '</span>';
  html += '<button onclick="veRenderDetailedReport()" style="padding:3px 10px; font-size:var(--fs-tiny); font-weight:500; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer; margin-left:6px;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'">← Detaylı Rapor</button>';
  html += '</div>';
  html += '<div style="display:flex; align-items:center; gap:6px;">';
  html += '<button onclick="veDownloadReportHTML()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'"><span class="mf-ico mf-ico-download"></span> HTML İndir</button>';
  html += '<button onclick="veDownloadTXTFromPreview()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'"><span class="mf-ico mf-ico-download"></span> TXT İndir</button>';
  html += '<button onclick="veCloseDetailedReport()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-danger)\';this.style.color=\'var(--accent-danger)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'">✕ Kapat</button>';
  html += '</div>';
  html += '</div>';

  // TXT content area — düz belge görünümü
  html += '<div style="flex:1; overflow-y:auto; background:var(--bg-primary); padding:20px 0;">';
  html += '<div style="width:fit-content; max-width:100%; margin:0 auto; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); box-shadow:0 1px 6px var(--shadow-color); overflow:hidden;">';
  html += '<div id="ve-txt-report-content" style="padding:24px 32px; font-family:\'Consolas\',\'Monaco\',\'Courier New\',monospace; font-size:var(--fs-body); color:var(--text-primary); tab-size:4;">';
  html += veRenderCenteredTXT(txtContent);
  html += '</div>';
  html += '</div></div>';

  // Store content for download
  window._veTxtPreviewContent = txtContent;
  window._veTxtPreviewFilename = downloadName;
  window._veTxtPreviewReportType = reportType;

  overlay.innerHTML = html;
  overlay.style.display = 'flex';
}

function veRenderSegmentDriveTXTReport() {
  var overlay = document.getElementById('ve-report-overlay');
  if(!overlay) return;

  var sim = window.veSimResults;
  if(!sim || !sim.segmentDrive || !sim.segmentDrive.segmentSummary) {
    showToast('Segment sürüş verisi bulunamadı — önce simülasyon çalıştırın', 'warning');
    return;
  }

  if(typeof veGenerateSegmentDriveTxtReport !== 'function') {
    showToast('Rapor fonksiyonu bulunamadı', 'warning');
    return;
  }

  var txtContent = veGenerateSegmentDriveTxtReport(sim);
  var now = new Date();
  var dateStr = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
  var downloadName = 'BMC_HizlanmaYavaslama_Rapor_' + dateStr + '.txt';

  if(!txtContent) { showToast('Rapor oluşturulamadı', 'warning'); return; }

  var html = '';
  html += '<div style="padding:10px 16px; background:var(--bg-secondary); border-bottom:2px solid var(--border-color); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">';
  html += '<div style="display:flex; align-items:center; gap:8px;">';
  html += '<span style="font-size:var(--fs-title);"><span class="mf-ico mf-ico-file-text"></span></span>';
  html += '<span style="font-size:var(--fs-lg); font-weight:700; color:var(--text-heading);">Hızlanma-Yavaşlama Raporu (TXT)</span>';
  html += '<button onclick="veRenderDetailedReport()" style="padding:3px 10px; font-size:var(--fs-tiny); font-weight:500; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer; margin-left:6px;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'">← Detaylı Rapor</button>';
  html += '</div>';
  html += '<div style="display:flex; align-items:center; gap:6px;">';
  html += '<button onclick="veDownloadReportHTML()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'"><span class="mf-ico mf-ico-download"></span> HTML İndir</button>';
  html += '<button onclick="veDownloadTXTFromPreview()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'"><span class="mf-ico mf-ico-download"></span> TXT İndir</button>';
  html += '<button onclick="veCloseDetailedReport()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-danger)\';this.style.color=\'var(--accent-danger)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'">✕ Kapat</button>';
  html += '</div>';
  html += '</div>';
  html += '<div style="flex:1; overflow-y:auto; background:var(--bg-primary); padding:20px 0;">';
  html += '<div style="width:fit-content; max-width:100%; margin:0 auto; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); box-shadow:0 1px 6px var(--shadow-color); overflow:hidden;">';
  html += '<div id="ve-txt-report-content" style="padding:24px 32px; font-family:\'Consolas\',\'Monaco\',\'Courier New\',monospace; font-size:var(--fs-body); color:var(--text-primary); tab-size:4;">';
  html += veRenderCenteredTXT(txtContent);
  html += '</div>';
  html += '</div></div>';

  window._veTxtPreviewContent = txtContent;
  window._veTxtPreviewFilename = downloadName;
  window._veTxtPreviewReportType = 'sd';

  overlay.innerHTML = html;
  overlay.style.display = 'flex';
}

function veRenderObstacleCrossingTXTReport() {
  var overlay = document.getElementById('ve-report-overlay');
  if(!overlay) return;

  var sim = window.veSimResults;
  if(!sim || !sim.obstacleCrossing) {
    showToast('Engel atlama verisi bulunamadı — önce simülasyon çalıştırın', 'warning');
    return;
  }

  var txtContent = veGenerateObstacleCrossingTxtReport(sim);
  var now = new Date();
  var dateStr = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
  var downloadName = 'BMC_EngelAtlama_Rapor_' + dateStr + '.txt';

  if(!txtContent) { showToast('Rapor oluşturulamadı', 'warning'); return; }

  var html = '';
  html += '<div style="padding:10px 16px; background:var(--bg-secondary); border-bottom:2px solid var(--border-color); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">';
  html += '<div style="display:flex; align-items:center; gap:8px;">';
  html += '<span style="font-size:var(--fs-title);"><span class="mf-ico mf-ico-file-text"></span></span>';
  html += '<span style="font-size:var(--fs-lg); font-weight:700; color:var(--text-heading);">Engel Atlama Raporu (TXT)</span>';
  html += '<button onclick="veRenderDetailedReport()" style="padding:3px 10px; font-size:var(--fs-tiny); font-weight:500; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer; margin-left:6px;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'">← Detaylı Rapor</button>';
  html += '</div>';
  html += '<div style="display:flex; align-items:center; gap:6px;">';
  html += '<button onclick="veDownloadReportHTML()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'"><span class="mf-ico mf-ico-download"></span> HTML İndir</button>';
  html += '<button onclick="veDownloadTXTFromPreview()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'"><span class="mf-ico mf-ico-download"></span> TXT İndir</button>';
  html += '<button onclick="veCloseDetailedReport()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-danger)\';this.style.color=\'var(--accent-danger)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'">✕ Kapat</button>';
  html += '</div>';
  html += '</div>';
  html += '<div style="flex:1; overflow-y:auto; background:var(--bg-primary); padding:20px 0;">';
  html += '<div style="width:fit-content; max-width:100%; margin:0 auto; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); box-shadow:0 1px 6px var(--shadow-color); overflow:hidden;">';
  html += '<div id="ve-txt-report-content" style="padding:24px 32px; font-family:\'Consolas\',\'Monaco\',\'Courier New\',monospace; font-size:var(--fs-body); color:var(--text-primary); tab-size:4;">';
  html += veRenderCenteredTXT(txtContent);
  html += '</div>';
  html += '</div></div>';

  window._veTxtPreviewContent = txtContent;
  window._veTxtPreviewFilename = downloadName;
  window._veTxtPreviewReportType = 'obs';

  overlay.innerHTML = html;
  overlay.style.display = 'flex';
}

function veRenderTopologyTXTReport() {
  var overlay = document.getElementById('ve-report-overlay');
  if(!overlay) return;

  if(typeof nodes === 'undefined' || nodes.length === 0) {
    showToast('Topolojide bileşen yok', 'warning');
    return;
  }

  if(typeof veFlushOpenPanelData === 'function') veFlushOpenPanelData();

  var txtContent = veGenerateTopologyTxtReport();
  var now = new Date();
  var dateStr = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
  var downloadName = 'BMC_Topoloji_Rapor_' + dateStr + '.txt';

  if(!txtContent) { showToast('Rapor oluşturulamadı', 'warning'); return; }

  var html = '';
  html += '<div style="padding:10px 16px; background:var(--bg-secondary); border-bottom:2px solid var(--border-color); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">';
  html += '<div style="display:flex; align-items:center; gap:8px;">';
  html += '<span style="font-size:var(--fs-title);"><span class="mf-ico mf-ico-file-text"></span></span>';
  html += '<span style="font-size:var(--fs-lg); font-weight:700; color:var(--text-heading);">Topoloji Detay Raporu (TXT)</span>';
  html += '<button onclick="veRenderDetailedReport()" style="padding:3px 10px; font-size:var(--fs-tiny); font-weight:500; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer; margin-left:6px;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'">← Detaylı Rapor</button>';
  html += '</div>';
  html += '<div style="display:flex; align-items:center; gap:6px;">';
  html += '<button onclick="veDownloadReportHTML()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'"><span class="mf-ico mf-ico-download"></span> HTML İndir</button>';
  html += '<button onclick="veDownloadTXTFromPreview()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'"><span class="mf-ico mf-ico-download"></span> TXT İndir</button>';
  html += '<button onclick="veCloseDetailedReport()" style="padding:5px 14px; font-size:var(--fs-body); font-weight:600; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-tertiary); color:var(--text-secondary); cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent-danger)\';this.style.color=\'var(--accent-danger)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'">✕ Kapat</button>';
  html += '</div>';
  html += '</div>';
  html += '<div style="flex:1; overflow-y:auto; background:var(--bg-primary); padding:20px 0;">';
  html += '<div style="width:fit-content; max-width:100%; margin:0 auto; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); box-shadow:0 1px 6px var(--shadow-color); overflow:hidden;">';
  html += '<div id="ve-txt-report-content" style="padding:24px 32px; font-family:\'Consolas\',\'Monaco\',\'Courier New\',monospace; font-size:var(--fs-body); color:var(--text-primary); tab-size:4;">';
  html += veRenderCenteredTXT(txtContent);
  html += '</div>';
  html += '</div></div>';

  window._veTxtPreviewContent = txtContent;
  window._veTxtPreviewFilename = downloadName;
  window._veTxtPreviewReportType = 'topo';

  overlay.innerHTML = html;
  overlay.style.display = 'flex';
}

function veDownloadTXTFromPreview() {
  if(!window._veTxtPreviewContent) { showToast('İndirilecek içerik bulunamadı', 'warning'); return; }

  // Mini modal — yazar adı sor
  var ov = document.createElement('div');
  ov.id = 've-txt-author-overlay';
  ov.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center;';
  ov.addEventListener('mousedown', function(e) { if(e.target === ov) ov.remove(); });

  var box = document.createElement('div');
  box.style.cssText = 'width:340px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6);';
  box.innerHTML = '' +
    '<div style="padding:10px 14px; background:linear-gradient(135deg, #1a365d 0%, #2c5282 100%); display:flex; align-items:center; justify-content:space-between;">' +
      '<span style="font-size:var(--fs-lg); font-weight:700; color:#e2e8f0;"><span class="mf-ico mf-ico-download"></span> TXT Rapor İndir</span>' +
      '<button onclick="document.getElementById(\'ve-txt-author-overlay\').remove()" style="width:24px; height:24px; background:transparent; border:1px solid rgba(255,255,255,0.2); border-radius:var(--radius-sm); color:#e2e8f0; cursor:pointer; font-size:var(--fs-lg);">✕</button>' +
    '</div>' +
    '<div style="padding:14px 16px;">' +
      '<label style="color:var(--text-muted); font-size:var(--fs-body); display:block; margin-bottom:3px;">Yazar Adı:</label>' +
      '<input type="text" id="ve-txt-author-input" placeholder="İsim Soyisim" style="width:100%; padding:6px 8px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); box-sizing:border-box;">' +
      '<div id="ve-txt-author-email" style="margin-top:6px; font-size:var(--fs-tiny); color:var(--text-muted); min-height:1.2em;"></div>' +
      '<button id="ve-txt-author-ok" style="width:100%; margin-top:10px; padding:8px; background:linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%); color:#fff; border:none; border-radius:var(--radius-sm); font-size:var(--fs-md); font-weight:700; cursor:pointer;"><span class="mf-ico mf-ico-download"></span> İndir</button>' +
    '</div>';
  ov.appendChild(box);
  document.body.appendChild(ov);

  var inp = document.getElementById('ve-txt-author-input');
  var emailDiv = document.getElementById('ve-txt-author-email');

  inp.addEventListener('input', function() {
    var email = (typeof veNameToEmail === 'function') ? veNameToEmail(inp.value) : '';
    emailDiv.textContent = email ? ('İletişim: ' + email) : '';
  });

  inp.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') document.getElementById('ve-txt-author-ok').click();
  });

  document.getElementById('ve-txt-author-ok').addEventListener('click', function() {
    var authorName = inp.value.trim() || 'Belirtilmemis';
    var sim = window.veSimResults;
    var rType = window._veTxtPreviewReportType;
    var content = '';

    if(rType === 'ft' && typeof veGenerateFTTxtReport === 'function') {
      content = veGenerateFTTxtReport(sim, authorName);
    } else if((rType === 'ft-trace' || rType === 'ft-trace-low') && typeof veGenerateFTCalcTraceReport === 'function') {
      content = veGenerateFTCalcTraceReport(sim, authorName, rType === 'ft-trace-low' ? 'low' : null);
    } else if(rType === 'sd' && typeof veGenerateSegmentDriveTxtReport === 'function') {
      content = veGenerateSegmentDriveTxtReport(sim, authorName);
    } else if(rType === 'obs' && typeof veGenerateObstacleCrossingTxtReport === 'function') {
      content = veGenerateObstacleCrossingTxtReport(sim, authorName);
    } else {
      content = window._veTxtPreviewContent;
    }

    var filename = window._veTxtPreviewFilename || 'rapor.txt';
    var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Önizlemeyi de güncelle
    window._veTxtPreviewContent = content;
    var preEl = document.getElementById('ve-txt-report-content');
    if(preEl) preEl.innerHTML = veRenderCenteredTXT(content);

    ov.remove();
    showToast('TXT rapor indirildi', 'success');
  });

  setTimeout(function() { inp.focus(); }, 50);
}

function veCloseDetailedReport() {
  var overlay = document.getElementById('ve-report-overlay');
  if(overlay) {
    overlay.style.display = 'none';
    overlay.innerHTML = '';
  }
}

// ============================================================================
//  ARAÇ PERFORMANS — DETAYLI RAPOR → BAĞIMSIZ HTML (referans kozmetiği)
// ============================================================================
// "Takoz Çökme–Titreşim" raporunun estetiğini birebir izler: Source Serif 4 gövde,
// Archivo başlıklar, IBM Plex Mono sayılar; Prusya mavisi vurgu; numaralı <h2>
// bölümler + <p> prose + <caption>'lı tablolar + <figure>. Temadan bağımsız beyaz.
//
// SÖZLEŞME (bölüm üreticileri için) — her bölüm şu imzayı taşır:
//   function _veRepSecX(R, sim, H, charts) -> { id, title, body }  (yoksa null)
//   • body: h2 HARİÇ her şey (prose + tablo + figür). Numarayı/h2'yi assembler ekler.
//   • YALNIZCA H yardımcıları kullanılır; SATIR İÇİ (inline) STİL YOK.
//   • Kullanıcı metinleri (isim vb.) H.esc(...) ile kaçışlanır; H.f(...) sayı güvenlidir.
//   • Grafikler: charts['<canvasId>'] bir <img> HTML'i (yoksa '') → H.fig(img, açıklama).
//
// H yardımcıları:
//   H.esc(s)                      → HTML-kaçışlı string
//   H.f(n, d)                     → sayı, d ondalık (varsayılan 2); geçersizse '—'
//   H.p(html)                     → <p>…</p>  (html güvenli/istenmiş kabul edilir)
//   H.h3(text)                    → <h3>…</h3>
//   H.note(kind, title, bodyHtml) → <div class="note {kind}">…</div>  (kind:''|'warn'|'check')
//   H.kv(rows)                    → 2 sütun etiket/değer tablosu (başlıksız). rows:[[label,value],…]
//                                    value string veya {v, cls}; ETİKET kaçışlanır, DEĞER kaçışlanmaz.
//   H.table(caption, cols, rows, sumRows)
//                                    cols:[{t,w,a}] a:'l'|'c'|'r'(vars.); rows/sumRows: hücre = string veya {v,a,cls}
//                                    "Tablo N — {caption}" otomatik numaralanır.
//   H.fig(imgHtml, captionHtml)   → <figure>…<figcaption><b>Şekil N —</b> …</figcaption></figure> (img boşsa '')
//   H.st(kind, text)              → durum rozeti <span class="st-…">  (kind:'ok'|'warn'|'bad')

function _veReportEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function(c) {
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;';
  });
}
function _veReportSlug(s) {
  var map = { 'ç':'c','ğ':'g','ı':'i','ö':'o','ş':'s','ü':'u' };
  return String(s || 'mfsim').toLowerCase()
    .replace(/[çğıöşü]/g, function(c) { return map[c] || c; })
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'mfsim';
}
function _veReportDownloadBlob(html, filename) {
  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
}

// ─── Yardımcı fabrikası (tablo/figür numaralayıcı closure) ───────────────────
function _veMakeReportHelpers() {
  var esc = _veReportEsc;
  var tblNo = 0, figNo = 0;
  function f(n, d) { var v = Number(n); if(!isFinite(v)) return '—'; return v.toFixed(d == null ? 2 : d); }
  function cell(c, colA) {
    var v, a = colA || 'r', cls = '';
    if(c && typeof c === 'object') { v = c.v; if(c.a) a = c.a; if(c.cls) cls = c.cls; } else { v = c; }
    if(v == null) v = '';
    var k = (a === 'l' ? 'l' : a === 'c' ? 'c' : '');
    var full = k + (cls ? (k ? ' ' : '') + cls : '');
    return '<td' + (full ? ' class="' + full + '"' : '') + '>' + v + '</td>';
  }
  return {
    esc: esc,
    f: f,
    p: function(html) { return '<p>' + html + '</p>'; },
    h3: function(t) { return '<h3>' + esc(t) + '</h3>'; },
    note: function(kind, title, body) {
      return '<div class="note' + (kind ? ' ' + kind : '') + '"><span class="t">' + esc(title) + '</span>' + body + '</div>';
    },
    kv: function(rows) {
      var h = '<table class="kv">';
      rows.forEach(function(r) {
        var val = r[1], vcls = '', vv = val;
        if(val && typeof val === 'object') { vv = val.v; vcls = val.cls || ''; }
        if(vv == null) vv = '';
        h += '<tr><td class="l">' + esc(r[0]) + '</td><td' + (vcls ? ' class="' + vcls + '"' : '') + '>' + vv + '</td></tr>';
      });
      return h + '</table>';
    },
    table: function(caption, cols, rows, sumRows) {
      tblNo++;
      var aligns = cols.map(function(c) { return c.a || 'r'; });
      var h = '<table><caption>Tablo ' + tblNo + ' — ' + esc(caption) + '</caption><thead><tr>';
      cols.forEach(function(c) { h += '<th' + (c.w ? ' style="width:' + c.w + '"' : '') + '>' + esc(c.t) + '</th>'; });
      h += '</tr></thead><tbody>';
      (rows || []).forEach(function(row) {
        h += '<tr>';
        row.forEach(function(c, i) { h += cell(c, aligns[i]); });
        h += '</tr>';
      });
      (sumRows || []).forEach(function(row) {
        h += '<tr class="sum">';
        row.forEach(function(c, i) { h += cell(c, aligns[i]); });
        h += '</tr>';
      });
      return h + '</tbody></table>';
    },
    fig: function(imgHtml, caption) {
      if(!imgHtml) return '';
      figNo++;
      return '<figure>' + imgHtml + '<figcaption><b>Şekil ' + figNo + ' —</b> ' + caption + '</figcaption></figure>';
    },
    st: function(kind, text) {
      var k = kind === 'ok' ? 'st-ok' : kind === 'warn' ? 'st-warn' : 'st-bad';
      return '<span class="' + k + '">' + text + '</span>';
    }
  };
}

// ─── Antet (referans .antet bloğu) ───────────────────────────────────────────
function _veReportAntet(R, projectName, dateStr) {
  var esc = _veReportEsc;
  var eng = R ? esc(R.engineName) : '—';
  var gb = R ? esc(R.gbName) : '—';
  var gvw = R ? (Number(R.gvw).toLocaleString('tr-TR') + ' kg') : '—';
  var gears = (R && R.gearData) ? (R.gearData.length + ' ileri') : '—';
  return ''
    + '<div class="antet">'
    +   '<div class="band">'
    +     '<div class="eyebrow">Analiz Raporu · Araç Performansı</div>'
    +     '<h1>' + esc(projectName) + '</h1>'
    +     '<div class="sub">Tam gaz otomatik vites geçişleri, eğim tırmanma kabiliyeti ve hızlanma analizi — projede tanımlı güç aktarma modelinden otomatik üretilmiştir.</div>'
    +   '</div>'
    +   '<div class="fields">'
    +     '<div class="f"><div class="k">Doküman Türü</div><div class="v">Performans Raporu</div></div>'
    +     '<div class="f"><div class="k">Motor</div><div class="v">' + eng + '</div></div>'
    +     '<div class="f"><div class="k">Şanzıman</div><div class="v">' + gb + '</div></div>'
    +     '<div class="f"><div class="k">Brüt Ağırlık · Vites</div><div class="v">' + esc(gvw) + ' · ' + esc(gears) + '</div></div>'
    +     '<div class="f"><div class="k">Tarih</div><div class="v">' + esc(dateStr) + '</div></div>'
    +   '</div>'
    + '</div>';
}

// ─── Bölüm üreticileri ───────────────────────────────────────────────────────
// GOLD ÖRNEK — diğer bölümler bunu birebir taklit eder.
function _veRepSecPlatform(R, sim, H, charts) {
  if(!R) return null;
  var revPerKm = (R.tireRadius > 0) ? (1000 / (2 * Math.PI * R.tireRadius)).toFixed(0) : '—';
  var body = '';
  body += H.p('Bu bölüm, aracın aerodinamik ve kütle parametreleri ile lastik özelliklerini özetler. Bu değerler yol yükü (yuvarlanma ve aerodinamik direnç), çekiş kuvveti ve devir–hız dönüşümü hesaplarının temel girdileridir.');
  body += H.h3('Alan ve Ağırlık');
  body += H.kv([
    ['Alın Alanı', H.f(R.frontalArea, 3) + ' m²'],
    ['Yükseklik / Genişlik', H.f(R.height, 3) + ' m / ' + H.f(R.width, 3) + ' m'],
    ['Aerodinamik Direnç Katsayısı (Cd)', H.f(R.cd, 3)],
    ['Brüt Araç Ağırlığı', H.f(R.gvw, 0) + ' kg']
  ]);
  body += H.h3('Lastikler');
  body += H.kv([
    ['Seçili Lastik', H.esc(R.tireName)],
    ['Lastik Devir/km', revPerKm + ' devir/km'],
    ['Lastik Yuvarlanma Yarıçapı', H.f(R.tireRadius, 3) + ' m'],
    ['Yuvarlanma Direnci (Crr)', H.f(R.crr, 4)],
    ['Yüzey Faktörü', H.f(R.surfFactor, 2)],
    ['Lastik/Tekerlek Ataleti (tahmini)', H.f(R.tireInertia, 4) + ' kg·m²']
  ]);
  return { id: 'platform', title: 'Platform', body: body };
}

function _veRepSecMotor(R, sim, H, charts) {
  if(!R || !R.torqueData) return null;

  // ── Pik tork / güç / governed güç (kaynak 655-664, fonksiyon içine taşındı) ──
  var peakTorque = 0, peakTorqueRpm = 0, peakPower = 0, peakPowerRpm = 0, govPower = 0;
  R.torqueData.forEach(function(p) {
    if(p.torque > peakTorque) { peakTorque = p.torque; peakTorqueRpm = p.rpm; }
    var pw = p.power || (p.torque * p.rpm * Math.PI / 30000);
    if(pw > peakPower) { peakPower = pw; peakPowerRpm = p.rpm; }
    if(p.rpm === R.governed) govPower = pw;
  });

  var body = '';
  body += H.p('Bu bölüm, projede tanımlı motorun karakteristik parametrelerini ve tam devir aralığındaki tork/güç eğrisini özetler. Değerler, çekiş kuvveti ve motor freni hesaplarının kaynak girdisidir; net değerler fan ve diğer aksesuar kayıplarının governed devre göre ölçeklenmesiyle brüt eğriden türetilir.');

  // ── Motor özeti (kaynak 716-729) ──
  body += H.h3('Motor Özeti');
  body += H.kv([
    ['Motor Tanımı', H.esc(R.engineName)],
    ['Silindir Hacmi', R.displacement > 0 ? H.f(R.displacement, 2) + ' L' : '—'],
    ['Pik Tork', peakTorque > 0 ? H.f(peakTorque, 1) + ' N·m' : '—'],
    ['Pik Tork Devri', peakTorqueRpm > 0 ? peakTorqueRpm + ' rpm' : '—'],
    ['Pik Güç', peakPower > 0 ? H.f(peakPower, 1) + ' kW' : '—'],
    ['Pik Güç Devri', peakPowerRpm > 0 ? peakPowerRpm + ' rpm' : '—'],
    ['Governed Güç', govPower > 0 ? H.f(govPower, 1) + ' kW' : '—'],
    ['Governed Devir', R.governed + ' rpm'],
    ['No-Load Governed', R.noLoad + ' rpm'],
    ['Rölanti Devri', R.idleRpm + ' rpm'],
    ['Motor Ataleti (tahmini)', H.f(R.engineInertia, 4) + ' kg·m²']
  ]);

  // ── Motor kayıpları: aksesuar tablosu (kaynak 693-714) ──
  body += H.h3('Motor Kayıpları (Governed Devirde Güç)');
  var accData = (R.accessories && R.accessories.length > 0) ? R.accessories : [
    { name: 'Fan (Kavramalı Fan)', standardLoss: 0, userLoss: 0 },
    { name: 'Alternatör / Jeneratör', standardLoss: 0, userLoss: 0 },
    { name: 'Hava Kompresörü', standardLoss: 0, userLoss: 0 },
    { name: 'Direksiyon Pompası', standardLoss: 0, userLoss: 0 },
    { name: 'Klima', standardLoss: 0, userLoss: 0 },
    { name: 'Ek Tahrik', standardLoss: 0, userLoss: 0 }
  ];
  var totalStd = 0, totalUser = 0;
  var accRows = accData.map(function(a) {
    totalStd += a.standardLoss; totalUser += a.userLoss;
    return [
      { v: H.esc(a.name), a: 'l' },
      { v: H.f(a.standardLoss, 1), a: 'c' },
      { v: H.f(a.userLoss, 1), a: 'c' }
    ];
  });
  var accSum = [[
    { v: 'Toplam', a: 'l' },
    { v: H.f(totalStd, 1), a: 'c' },
    { v: H.f(totalUser, 1), a: 'c' }
  ]];
  body += H.table('Governed devirde aksesuar güç kayıpları', [
    { t: 'Aksesuar', a: 'l' },
    { t: 'Standart Kayıp (kW)', a: 'c', w: '150px' },
    { t: 'Kullanıcı Tanımlı Kayıp (kW)', a: 'c', w: '170px' }
  ], accRows, accSum);

  // ── Motor detayları: tork eğrisi tablosu (kaynak 731-765) ──
  body += H.h3('Motor Detayları');
  if(R.torqueData.length > 0) {
    var detRows = [];
    R.torqueData.forEach(function(p) {
      var rpm = p.rpm; if(!rpm || rpm <= 0) return;
      var netPwr = p.power || (p.torque * rpm * Math.PI / 30000);
      var netTrk = p.torque || (netPwr * 30000 / (Math.PI * rpm));
      var ratio = R.governed > 0 ? rpm / R.governed : 0;
      var fanPwr = R.fanLossGov * ratio * ratio * ratio;
      var otherPwr = R.otherLossGov * ratio;
      var grossPwr = netPwr + fanPwr + otherPwr;
      var grossTrk = rpm > 0 ? grossPwr * 30000 / (Math.PI * rpm) : 0;
      var netPwrFanOn = netPwr - fanPwr;
      var netTrkFanOn = rpm > 0 ? netPwrFanOn * 30000 / (Math.PI * rpm) : 0;
      var ident = '';
      if(rpm === peakTorqueRpm && peakTorque > 0) ident = 'Pik Tork';
      if(rpm === R.governed) ident = 'Pik Governed';
      if(rpm === R.noLoad || (rpm > R.governed && netTrk <= 0)) ident = 'Yüksüz Governed';
      detRows.push([
        rpm,
        H.f(grossPwr, 1),
        H.f(grossTrk, 1),
        H.f(netPwrFanOn, 1),
        H.f(netTrkFanOn, 1),
        H.f(netPwr, 1),
        H.f(netTrk, 1),
        { v: H.esc(ident), a: 'l' }
      ]);
    });
    body += H.table('Devir aralığında brüt ve net (fan açık / fan kapalı) tork ve güç', [
      { t: 'Devir (rpm)', a: 'r' },
      { t: 'Brüt Güç (kW)', a: 'r' },
      { t: 'Brüt Tork (N·m)', a: 'r' },
      { t: 'Net Güç Fan Açık (kW)', a: 'r' },
      { t: 'Net Tork Fan Açık (N·m)', a: 'r' },
      { t: 'Net Güç Fan Kapalı (kW)', a: 'r' },
      { t: 'Net Tork Fan Kapalı (N·m)', a: 'r' },
      { t: 'Tanım', a: 'l' }
    ], detRows);
  } else {
    body += H.note('', 'Veri Yok', 'Motor tork eğrisi verisi bulunamadı.');
  }

  // ── Motor grafiği ──
  body += H.fig(charts['dr-engine-chart'], 'Motor tork ve güç eğrileri — brüt ile net (fan açık/kapalı) değerlerin devre göre değişimi.');

  return { id: 'motor', title: 'Motor', body: body };
}
function _veRepSecTransmission(R, sim, H, charts) {
  if(!R) return null;

  var body = '';
  body += H.p('Bu bölüm, güç aktarma organının şanzıman tanımını ve tam gaz otomatik vites geçişlerini yöneten kontrol stratejisini özetler. Şanzıman verimi ve vites geçiş eşikleri, çekiş kuvveti ve devir–hız profilinin hesaplanmasında doğrudan rol oynar.');

  // ─── Şanzıman ───
  body += H.h3('Şanzıman');
  body += H.kv([
    ['Şanzıman Üretici', 'Allison Transmission'],
    ['Şanzıman', H.esc(R.gbName)],
    ['Şanzıman Ailesi', H.esc(R.gbFamily)],
    ['Şanzıman Verimi', H.f(R.gbEff, 1) + '%'],
    ['Tork Konvertörü', H.esc(R.tcName)]
  ]);

  // ─── Kontrol ───
  var spName = R.shiftProfile.replace(/_/g, ' ').toUpperCase();
  var spDataRes = (typeof VE_FT_SHIFT_PROFILES !== 'undefined' ? VE_FT_SHIFT_PROFILES[R.shiftProfile] : null) || {};
  var gLow = R.gearData.length > 0 ? R.gearData[0].name : '1';
  var gHigh = R.gearData.length > 0 ? R.gearData[R.gearData.length - 1].name : '6';
  var gLowE = H.esc(gLow), gHighE = H.esc(gHigh);

  var ctrlRows = [];
  ctrlRows.push(['Shift Profili', H.esc(spName)]);
  ctrlRows.push(['Vites Geçiş Hızı ve Strateji', H.f(R.shiftRefRPM, 0) + ' rpm']);

  // Converter geçişleri (koşullu)
  if(spDataRes.converterShifts) {
    var csRes = spDataRes.converterShifts;
    var convParts = [];
    if(csRes['1C2C']) convParts.push('1C→2C: ' + Math.round(csRes['1C2C'].a * R.shiftRefRPM + (csRes['1C2C'].b || 0)) + ' rpm');
    if(csRes['2C2L'] && csRes['2C2L'].type === 'segmented') {
      convParts.push('2C→2L: ' + Math.round(csRes['2C2L'].linear.a * R.shiftRefRPM + csRes['2C2L'].linear.b) + ' rpm (ESL≥' + csRes['2C2L'].linear.validFrom + ')');
    }
    if(convParts.length > 0) ctrlRows.push(['Converter Geçişleri', H.esc(convParts.join(', '))]);
  }

  // Lockup geçişleri (koşullu) veya Kilitleme Ofseti
  if(spDataRes.lockupShifts) {
    var luSummary = Object.keys(spDataRes.lockupShifts).map(function(sk) {
      var ls = spDataRes.lockupShifts[sk];
      var thr = (typeof calcLockupShiftThreshold === 'function') ? calcLockupShiftThreshold(ls, R.shiftRefRPM) : (ls.a * R.shiftRefRPM + (ls.b || 0));
      return sk.replace(/(\d+L)(\d+L)/, '$1→$2') + ': ' + Math.round(thr) + ' rpm';
    }).join(', ');
    ctrlRows.push(['Lockup Geçişleri', H.esc(luSummary)]);
  } else {
    ctrlRows.push(['Kilitleme Ofseti', H.f(R.lockupOffset, 0) + ' rpm']);
  }

  ctrlRows.push(['Ana Mod: Vitesler', 'Düşük = ' + gLowE + ', Başlangıç = ' + gLowE + ', Yüksek = ' + gHighE + ' (' + gLowE + '-' + gLowE + '-' + gHighE + ')']);

  body += H.h3('Kontrol');
  body += H.kv(ctrlRows);

  return { id: 'transmission', title: 'Şanzıman ve Kontrol', body: body };
}
function _veRepSecConverter(R, sim, H, charts) {
  if(!R) return null;

  var body = '';
  body += H.p('Bu bölüm, motor tork eğrisi ile aday tork konvertörlerinin eşleştirmesini değerlendirir. Her aday için stall noktası, türbin torku ve governed devirdeki hız oranı (SR) hesaplanır; C5/C7/C8 uygunluk kriterleri ile şanzıman giriş güç/tork limitleri (C9/C10) denetlenir.');

  // Veri koşulu — kaynaktaki gibi torque eğrisi ve TC preset'leri gerekli
  if(!(R.torqueData && R.torqueData.length > 2 && typeof VE_FT_TC_PRESETS !== 'undefined' && typeof veGetFamilyTCKeys === 'function')) {
    body += H.note('warn', 'Veri Yok', 'Motor–TC eşleştirme verisi bulunamadı; bu değerlendirme için tam motor tork eğrisi ve tanımlı konvertör aileleri gereklidir.');
    return { id: 'ecm', title: 'Konvertör Değerlendirmesi', body: body };
  }

  var _pDrop = R.pumpDrop || 17.6;
  var _tRating = R.turbineRating || 3320;
  var _gov = R.governed;
  var _nlg = R.noLoad;
  var _td = R.torqueData;
  var _peakT = 0, _peakRPM = 0;
  _td.forEach(function(d){ if(d.torque > _peakT){_peakT = d.torque; _peakRPM = d.rpm;} });

  // Governed devirdeki tork ve güç (C9/C10)
  var _rGbLimits = { grossInputPower: R.gbGrossInputPower || null, grossInputTorque: R.gbGrossInputTorque || null };
  var _rTorqueAtGov = 0;
  if(_td.length >= 2) {
    if(_gov <= _td[0].rpm) _rTorqueAtGov = _td[0].torque;
    else if(_gov >= _td[_td.length-1].rpm) _rTorqueAtGov = _td[_td.length-1].torque;
    else { for(var _ri=0;_ri<_td.length-1;_ri++){if(_td[_ri].rpm<=_gov&&_gov<=_td[_ri+1].rpm){var _rf=(_gov-_td[_ri].rpm)/(_td[_ri+1].rpm-_td[_ri].rpm);_rTorqueAtGov=_td[_ri].torque+_rf*(_td[_ri+1].torque-_td[_ri].torque);break;}}}
  }
  var _rPowerAtGov = _rTorqueAtGov * _gov * Math.PI / 30000;
  var _rc9ok = _rGbLimits.grossInputPower !== null ? _rPowerAtGov <= _rGbLimits.grossInputPower : true;
  var _rc10ok = _rGbLimits.grossInputTorque !== null ? _rTorqueAtGov <= _rGbLimits.grossInputTorque : true;

  // İnterpolasyon fonksiyonları (kaynaktan aynen taşındı)
  function _interpT(rpm){
    if(rpm<=_td[0].rpm)return _td[0].torque; if(rpm>=_td[_td.length-1].rpm)return _td[_td.length-1].torque;
    for(var i=0;i<_td.length-1;i++){if(_td[i].rpm<=rpm&&rpm<=_td[i+1].rpm){var f=(rpm-_td[i].rpm)/(_td[i+1].rpm-_td[i].rpm);return _td[i].torque+f*(_td[i+1].torque-_td[i].torque);}}return 0;
  }
  function _interpTD(rpm){if(rpm<=_gov)return _interpT(rpm);if(rpm>=_nlg)return 0;return _interpT(_gov)*(1-(rpm-_gov)/(_nlg-_gov));}
  function _interpKp(tcD,sr){sr=Math.max(0,Math.min(0.99,sr));for(var i=0;i<tcD.length-1;i++){if(tcD[i].sr<=sr&&sr<=tcD[i+1].sr){var f=(sr-tcD[i].sr)/(tcD[i+1].sr-tcD[i].sr);return tcD[i].kpump+f*(tcD[i+1].kpump-tcD[i].kpump);}}return tcD[tcD.length-1].kpump;}
  function _findStall(tcD){var kp0=tcD[0].kpump;var lo=600,hi=3500;for(var i=0;i<50;i++){var m=(lo+hi)/2;var tA=_interpTD(m)-_pDrop;var tB=(m*m)/(kp0*kp0);if(tA>tB)lo=m;else hi=m;if(hi-lo<0.5)break;}return(lo+hi)/2;}
  function _findSRGov(tcD){var tp=_interpT(_gov)-_pDrop;if(tp<=0)return 0;var kpN=_gov/Math.sqrt(tp);for(var i=0;i<tcD.length-1;i++){var k1=tcD[i].kpump,k2=tcD[i+1].kpump;if((k1<=kpN&&kpN<=k2)||(k2<=kpN&&kpN<=k1)){var f=(kpN-k1)/(k2-k1);if(f>=0&&f<=1)return tcD[i].sr+f*(tcD[i+1].sr-tcD[i].sr);}}return kpN>tcD[tcD.length-1].kpump?0.99:0.50;}
  function _findMinN(tcD){var mn=9999;for(var nt=0;nt<=_gov*1.05;nt+=15){var lo=Math.max(nt+1,600),hi=_nlg+100;for(var it=0;it<45;it++){var m=(lo+hi)/2;if(m<=nt){lo=m;continue;}var sr=nt/m;sr=Math.max(0,Math.min(0.99,sr));var kp=_interpKp(tcD,sr);var tA=_interpTD(m)-_pDrop;var tB=(m*m)/(kp*kp);if(tA>tB)lo=m;else hi=m;if(hi-lo<1)break;}var nE=(lo+hi)/2;if(nE<mn&&nE>500)mn=nE;}return mn;}

  var _tcKeys = veGetFamilyTCKeys();
  var _ecmResults = [];
  _tcKeys.forEach(function(key){
    var tc = VE_FT_TC_PRESETS[key]; var tcD = tc.data;
    var ss = _findStall(tcD); var srG = _findSRGov(tcD); var minN = _findMinN(tcD);
    var sTau = tcD[0].tau; var tPS = _interpTD(ss)-_pDrop; var tTS = tPS * sTau;
    var c5 = minN >= _peakRPM - 50; var c7 = tTS <= _tRating; var c8 = srG >= 0.80;
    var st, sc;
    if(!_rc9ok || !_rc10ok){st='unacceptable';sc=0;}
    else if(!c7){st='unacceptable';sc=0;}else if(!c5){st='not-recommended';sc=1;}else if(!c8){st='caution';sc=2;}else{st='recommended';sc=3;}
    _ecmResults.push({key:key, name:tc.name, stallTau:sTau, stallSpeed:ss, minSpeed:minN, srGov:srG, tTurbineStall:tTS, c5ok:c5, c7ok:c7, c8ok:c8, c9ok:_rc9ok, c10ok:_rc10ok, status:st, score:sc});
  });
  _ecmResults.sort(function(a,b){return b.score-a.score||b.srGov-a.srGov;});

  // (a) Motor bilgisi — özet listesi
  var motorRows = [
    ['Motor', H.esc(R.engineName)],
    ['Pik Tork', H.f(_peakT, 0) + ' N·m @ ' + H.f(_peakRPM, 0) + ' rpm'],
    ['Governed Devir', H.f(_gov, 0) + ' rpm'],
    ['Pompa Düşümü', H.f(_pDrop, 1) + ' N·m'],
    ['Türbin Limiti', H.f(_tRating, 0) + ' N·m']
  ];
  if(_rGbLimits.grossInputPower !== null) {
    motorRows.push(['Giriş Güç Limiti (C9)', H.st(_rc9ok ? 'ok' : 'bad', H.f(_rPowerAtGov, 0) + ' / ' + H.f(_rGbLimits.grossInputPower, 0) + ' kW')]);
  }
  if(_rGbLimits.grossInputTorque !== null) {
    motorRows.push(['Giriş Tork Limiti (C10)', H.st(_rc10ok ? 'ok' : 'bad', H.f(_rTorqueAtGov, 0) + ' / ' + H.f(_rGbLimits.grossInputTorque, 0) + ' N·m')]);
  }
  body += H.h3('Motor');
  body += H.kv(motorRows);

  // (b) Aday konvertör tablosu
  var cols = [
    { t: 'Durum', a: 'l' },
    { t: 'Konvertör', a: 'l' },
    { t: 'Stall τ', a: 'c' },
    { t: 'Stall rpm', a: 'c' },
    { t: 'Min N rpm', a: 'c' },
    { t: 'T_turb N·m', a: 'c' },
    { t: 'SR@Gov', a: 'c' },
    { t: 'C5', a: 'c' },
    { t: 'C7', a: 'c' },
    { t: 'C8', a: 'c' }
  ];
  var rows = _ecmResults.map(function(r){
    var stKind = r.status==='recommended' ? 'ok' : r.status==='caution' ? 'warn' : r.status==='not-recommended' ? 'warn' : 'bad';
    var stTxt = r.status==='recommended' ? 'Önerilen' : r.status==='caution' ? 'Dikkat' : r.status==='not-recommended' ? 'Önerilmez' : 'Uyumsuz';
    return [
      { v: H.st(stKind, stTxt), a: 'l' },
      { v: H.esc(r.name), a: 'l' },
      { v: H.f(r.stallTau, 2), a: 'c' },
      { v: H.f(r.stallSpeed, 0), a: 'c' },
      { v: H.f(r.minSpeed, 0), a: 'c', cls: r.c5ok ? '' : 'st-bad' },
      { v: H.f(r.tTurbineStall, 0), a: 'c', cls: r.c7ok ? '' : 'st-bad' },
      { v: H.f(r.srGov, 3), a: 'c', cls: r.c8ok ? '' : 'st-warn' },
      { v: r.c5ok ? H.st('ok', '✓') : H.st('bad', '✗'), a: 'c' },
      { v: r.c7ok ? H.st('ok', '✓') : H.st('bad', '✗'), a: 'c' },
      { v: r.c8ok ? H.st('ok', '✓') : H.st('warn', '✗'), a: 'c' }
    ];
  });
  body += H.table('Aday tork konvertörleri — stall, türbin torku ve uygunluk kriterleri', cols, rows);

  // (c) Önerilen konvertör özeti
  if(_ecmResults.length > 0) {
    var best = _ecmResults[0];
    var kind = best.status === 'recommended' ? 'check' : 'warn';
    var summary = H.esc(best.name)
      + ' — Stall: ' + H.f(best.stallSpeed, 0) + ' rpm · SR@Gov: ' + H.f(best.srGov, 3)
      + ' · T_turb: ' + H.f(best.tTurbineStall, 0) + ' N·m';
    body += H.note(kind, 'Önerilen Konvertör', summary);
  }

  // (d) ECM grafiği
  body += H.fig(charts['dr-ecm-chart'], 'Motor tork eğrisi ile aday konvertörlerin pompa/türbin karakteristik eşleşmesi ve stall noktaları.');

  return { id: 'ecm', title: 'Konvertör Değerlendirmesi', body: body };
}
function _veRepSecDriveline(R, sim, H, charts) {
  if(!R) return null;

  var body = '';
  body += H.p('Bu bölüm, şanzıman çıkışından tekerleklere kadar uzanan güç aktarma zincirini (kardan milleri, diferansiyel ve — varsa — transfer kutusu) oran ve verim değerleriyle özetler. Bu bileşenlerin oran çarpımı toplam aktarma oranını, verim çarpımı ise tekerleğe iletilen net gücü belirler.');

  // ─── Bileşen tablosu ───────────────────────────────────────────────────────
  var cols = [
    { t: 'Bileşen',   a: 'l' },
    { t: 'Açıklama',  a: 'c' },
    { t: 'Oran',      a: 'c' },
    { t: 'Verim (%)', a: 'c' }
  ];
  var rows = [];

  // Kardan milleri (yoksa tek varsayılan)
  var pss = (R.propshafts && R.propshafts.length > 0) ? R.propshafts : [{ name: 'Kardan Mili', eff: 98.60 }];
  pss.forEach(function(ps) {
    rows.push([
      { v: H.esc(ps.name), a: 'l' },
      'Tek',
      H.f(1, 3),
      H.f(ps.eff, 2)
    ]);
  });

  // Diferansiyel
  rows.push([
    { v: H.esc(R.diffName), a: 'l' },
    'Tek',
    H.f(R.diffRatio, 3),
    H.f(R.diffEff, 2)
  ]);

  // Transfer kutusu kademeleri (koşullu)
  if(R.hasTransfer && R.transferGears && R.transferGears.length > 0) {
    R.transferGears.forEach(function(tr, i) {
      rows.push([
        { v: (i === 0 ? H.esc(R.transferName) : ''), a: 'l' },
        H.esc(tr.kademe),
        H.f(tr.ratio, 3),
        H.f(tr.eff, 2)
      ]);
    });
  }

  body += H.table('Aktarma organı bileşenleri', cols, rows);

  // ─── Toplam aktarma oranı tablosu (koşullu: transfer kutusu varsa) ──────────
  if(R.hasTransfer && R.transferGears && R.transferGears.length > 0) {
    var psEffT = 1;
    (R.propshafts || []).forEach(function(ps) { psEffT *= ps.eff / 100; });

    var totCols = [
      { t: 'Toplam Aktarma Oranı', a: 'l' },
      { t: 'Kademe',              a: 'c' },
      { t: 'Oran',                a: 'c' },
      { t: 'Verim (%)',           a: 'c' },
      { t: 'N/V Oranı (rpm/kph)', a: 'c' }
    ];
    var totRows = [];
    R.transferGears.forEach(function(tr) {
      var oR = R.diffRatio * tr.ratio;
      var oE = (R.diffEff / 100) * (tr.eff / 100) * psEffT * 100;
      var nv = (R.tireRadius > 0) ? (oR * 1000 / (R.tireRadius * 2 * Math.PI * 60)) : NaN;
      totRows.push([
        '',
        H.esc(tr.kademe),
        H.f(oR, 3),
        H.f(oE, 2),
        H.f(nv, 3)
      ]);
    });

    body += H.table('Diferansiyel ve transfer kademeleri için toplam aktarma oranı', totCols, totRows);
  }

  return { id: 'driveline', title: 'Aktarma Organları', body: body };
}
function _veRepSecGrade(R, sim, H, charts) {
  var G = sim && sim.gradeability;
  if(!G || !G.high) return null;

  var body = '';
  body += H.p('Bu bölüm, tam gaz otomatik vites geçişleriyle aracın çıkabildiği maksimum eğimleri özetler. Durma (stall) ve kalkış (launch) tırmanma kabiliyeti, düşük hız eğim performansı ve düz yolda ulaşılan maksimum hız ile birlikte, artan eğime karşılık gelen en yüksek araç hızı ve o noktadaki vites kademesi verilir.');

  // Üst bilgi — analiz koşulları
  var trRatioHigh = G.high.transferRatio || 1.0;
  body += H.kv([
    ['Motor Fanı', 'Açık'],
    ['Motor Gücü', 'Standart Güç Eğrisi'],
    ['Klima', 'Kapalı'],
    ['Araç Parametreleri', 'Standart'],
    ['Aks Oranı', H.f(R.diffRatio, 3)],
    ['Transfer Kutusu Oranı', H.f(trRatioHigh, 3)]
  ]);

  // Tek kademe tablosu oluşturucu (kaynak renderGradeTable mantığı)
  function gradeTable(gd, caption) {
    var cols = [
      { t: 'Eğim Kabiliyeti', a: 'l', w: '34%' },
      { t: '% Eğim', a: 'c' },
      { t: 'Araç Hızı (km/h)', a: 'c' },
      { t: 'Vites Kademe', a: 'c' },
      { t: 'Eşleşme Noktası', a: 'l' }
    ];
    var rows = [];
    rows.push(['Durma Eğim Kabiliyeti (Stall)', veGradeDisplay(gd.stallGrade, 1), '', H.esc(gd.stallGear), 'Stall']);
    rows.push(['Kalkış Eğim Kabiliyeti (Launch)', veGradeDisplay(gd.launchGrade, 1), '', H.esc(gd.launchGear), '']);
    rows.push(['Düşük Hız Eğim Kabiliyeti', H.f(gd.lowSpeedGrade, 1), H.f(gd.lowSpeedV, 1), H.esc(gd.lowSpeedGear), '%80']);
    rows.push(['Düz Yolda Maksimum Hız', H.f(0, 1), H.f(gd.maxSpeedFlat, 1), H.esc(gd.maxSpeedFlatGear), 'Yol Yükü']);
    (gd.gradeTable || []).forEach(function(row) {
      if(row.v_max <= 0 && row.grade > 0) return;
      rows.push(['', H.f(row.grade, 1), H.f(row.v_max, 1), H.esc(row.gear), '']);
    });
    return H.table(caption, cols, rows);
  }

  if(G.low) {
    // Çift kademe — H.h3 ile etiketle
    body += H.h3('Yüksek Kademe');
    body += gradeTable(G.high, 'Yüksek Kademe Eğim Tırmanma Kabiliyeti');
    body += H.fig(charts['gradeChartHigh'], 'Yüksek kademe için eğim–araç hızı eğrisi (tam gaz otomatik vites geçişleri).');

    body += H.h3('Düşük Kademe');
    body += gradeTable(G.low, 'Düşük Kademe Eğim Tırmanma Kabiliyeti');
    body += H.fig(charts['gradeChartLow'], 'Düşük kademe için eğim–araç hızı eğrisi (tam gaz otomatik vites geçişleri).');
  } else {
    // Tek kademe
    body += gradeTable(G.high, 'Eğim Tırmanma Kabiliyeti');
    body += H.fig(charts['gradeChartHigh'], 'Eğim–araç hızı eğrisi (tam gaz otomatik vites geçişleri).');
  }

  return { id: 'grade', title: 'Eğim Tırmanma Kabiliyeti', body: body };
}
function _veRepSecAccel(R, sim, H, charts) {
  var A = sim && sim.acceleration;
  if(!A || !A.high) return null;

  var body = '';
  body += H.p('Bu bölüm, durgun halden hedef hızlara ulaşmak için gereken süre ve mesafeyi tam gaz otomatik vites geçişleri altında özetler. Değerler, güç aktarma modelinden ve yol yükü hesabından türetilir; her hedef hız için ulaşılan süre ve kat edilen mesafe verilir.');

  // ── Üst bilgi (gradeability ile aynı 6 alan) ─────────────────────────────
  var trRatioAccel = A.high.transferRatio || 1.0;
  body += H.kv([
    ['Motor Fanı', 'Açık'],
    ['Motor Gücü', 'Standart Güç Eğrisi'],
    ['Klima', 'Kapalı'],
    ['Araç Parametreleri', 'Standart'],
    ['Aks Oranı', H.f(R.diffRatio, 3)],
    ['Transfer Kutusu Oranı', H.f(trRatioAccel, 3)]
  ]);

  // ── Tek kademe tablosu oluşturucu ────────────────────────────────────────
  function renderAccelTable(ad) {
    var caption = A.low ? ('Hızlanma — ' + ad.label) : 'Hızlanma Süre ve Mesafe Değerleri';
    var cols = [
      { t: 'Hız', a: 'l', w: '46%' },
      { t: 'Süre (saniye)', a: 'c' },
      { t: 'Mesafe (m)', a: 'c' }
    ];
    var rows = ad.rows.map(function(row) {
      var speedLabel = '0 — ' + H.esc(row.targetSpeed) + ' km/h';
      if(row.time === null) {
        return [
          { v: speedLabel, a: 'l' },
          { v: H.st('bad', 'Hıza ulaşılamıyor'), a: 'c' },
          { v: H.st('bad', 'Hıza ulaşılamıyor'), a: 'c' }
        ];
      }
      return [
        { v: speedLabel, a: 'l' },
        { v: H.f(row.time, 1), a: 'c' },
        { v: H.f(Math.round(row.distance), 0), a: 'c' }
      ];
    });
    return H.table(caption, cols, rows);
  }

  // Yüksek kademe (çift kademe varsa H.h3 ile etiketlenir)
  if(A.low) body += H.h3(A.high.label);
  body += renderAccelTable(A.high);

  // Düşük kademe (varsa)
  if(A.low) {
    body += H.h3(A.low.label);
    body += renderAccelTable(A.low);
  }

  // ── Diyagramlar ──────────────────────────────────────────────────────────
  body += H.fig(charts['accelChartHigh'], 'Yüksek kademe hızlanma diyagramı — hız ve mesafenin zamana göre değişimi.');
  if(A.low) {
    body += H.fig(charts['accelChartLow'], 'Düşük kademe hızlanma diyagramı — hız ve mesafenin zamana göre değişimi.');
  }

  return { id: 'accel', title: 'Hızlanma', body: body };
}
function _veRepSecUpshift(R, sim, H, charts) {
  // Tam gaz otomatik vites geçişleri — simülasyon verisi yoksa bölüm atlanır.
  if(!sim || !sim.speed || sim.speed.length < 2) return null;

  var ss = sim.solverStats || {};
  var rs = sim.reportSnapshot || R || {};
  var axleRatio = ss.i_axle || rs.diffRatio || 5.904;
  var trGears = rs.transferGears || [];
  var hasTransfer = rs.hasTransfer && trGears.length > 1;
  var activeRatio = ss.transferRange ? (parseFloat(ss.transferRange.ratio || ss.transferRange.oran) || 1.0) : (trGears.length > 0 ? trGears[0].ratio : 1.0);

  // Adım listesinden referans-stili tablo satırları üret (_ftBuildTable ile aynı kolon yapısı)
  function _cols() {
    return [
      { t: 'Vites Kademe', a: 'l' },
      { t: 'Araç Hızı (km/h)' },
      { t: 'Motor Devri (rpm)' },
      { t: 'Çıkış Devri (rpm)' },
      { t: 'Çekiş Kuvveti (kN)' },
      { t: 'Net Çekiş (kN)' },
      { t: 'Tekerlek Gücü (kW)' },
      { t: 'Net Eğim (%)' },
      { t: 'Isı Reddi (kW)' },
      { t: 'Eşleşme Noktası', a: 'l' }
    ];
  }
  function _rows(steps) {
    return steps.map(function(s) {
      return [
        { v: H.esc(s.gear), a: 'l' },
        H.f(s.speed, 1),
        String(Math.round(s.engineRPM)),
        String(Math.round(s.outputRPM)),
        H.f(s.te, 2),
        { v: H.f(s.dp, 2), cls: (s.dp < 0 ? 'st-bad' : '') },
        H.f(s.wheelPower, 1),
        { v: H.f(s.netGrade, 2), cls: (s.netGrade < 0 ? 'st-bad' : '') },
        H.f(s.heatRejection, 2),
        { v: (s.matchPoint ? H.esc(s.matchPoint) : ''), a: 'l' }
      ];
    });
  }

  var body = '';
  body += H.p('Bu bölüm, aracın duruştan azami hıza tam gaz hızlanması sırasında otomatik şanzımanın vites geçiş noktalarını adım adım listeler. Her satır, ilgili hız/devir noktasındaki çekiş kuvvetini, tekerlek gücünü, tırmanılabilen net eğimi ve soğutucuya reddedilen ısıyı özetler; simülasyon standart güç eğrisi ve standart araç parametreleri ile motor fanı açık koşulunda yürütülmüştür.');

  // Üst bilgi — koşullar ve aktarma oranları
  body += H.kv([
    ['Motor Fanı', 'Açık'],
    ['Motor Gücü', 'Standart Güç Eğrisi'],
    ['Klima', 'Kapalı'],
    ['Araç Parametreleri', 'Standart'],
    ['Aks Oranı', H.f(axleRatio, 3)],
    ['Transfer Kutusu Oranı', H.f(activeRatio, 3)]
  ]);

  // ═══ HIGH RANGE ═══
  var stepsHigh = veBuildFTStepsFromSim(sim, 'high');
  if(stepsHigh.length > 0) {
    body += H.h3(hasTransfer ? ('Yüksek Kademe (' + H.f(activeRatio, 3) + ')') : 'Vites Geçiş Tablosu');
    body += H.table(
      hasTransfer ? ('Tam gaz vites geçişleri — Transfer Kutusu: Yüksek Kademe') : 'Tam gaz vites geçişleri',
      _cols(), _rows(stepsHigh)
    );
    body += H.fig(charts['ftUpshiftChartHigh'], 'Yüksek kademede araç hızına karşı çekiş kuvveti ve vites geçiş noktaları.');
  }

  // ═══ LOW RANGE ═══
  if(hasTransfer && trGears.length > 1) {
    var lowGear = trGears[1];
    var lowRatio = lowGear.ratio;
    var lowEta = lowGear.eff || 97;
    var activeEta = trGears[0].eff || 97;
    var Cd = rs.cd || 0.9, A = rs.frontalArea || 8.0, Crr = rs.crr || 0.0035;
    var m_kg = ss.m_vehicle || rs.gvw || 15000;

    // Gerçek düşük kademe simülasyonu varsa onu kullan (ölçekleme yerine)
    var allRangeRes = typeof window !== 'undefined' ? window._veFTAllRangeResults : null;
    var lowKademe = lowGear.kademe || 'Low';
    var lowSimResult = allRangeRes ? allRangeRes[lowKademe] : null;

    var stepsLow;
    if(lowSimResult && lowSimResult.speed && lowSimResult.speed.length > 2) {
      stepsLow = veBuildFTStepsFromSim(lowSimResult, 'low');
    } else {
      stepsLow = _ftBuildLowRangeSteps(sim, activeRatio, lowRatio, activeEta, lowEta, m_kg, Cd, A, Crr, rs);
    }

    if(stepsLow.length > 0) {
      body += H.h3('Düşük Kademe (' + H.f(lowRatio, 3) + ')');
      body += H.table('Tam gaz vites geçişleri — Transfer Kutusu: Düşük Kademe', _cols(), _rows(stepsLow));
      body += H.fig(charts['ftUpshiftChartLow'], 'Düşük kademede araç hızına karşı çekiş kuvveti ve vites geçiş noktaları.');
    }
  }

  return { id: 'upshift', title: 'Tam Gaz Vites Geçişleri', body: body };
}

// ─── Assembler: bölümleri sırala, numarala, TOC üret ─────────────────────────
function _veReportAssemble(R, sim, charts) {
  var H = _veMakeReportHelpers();
  var emitters = [
    _veRepSecPlatform, _veRepSecMotor, _veRepSecTransmission, _veRepSecConverter,
    _veRepSecDriveline, _veRepSecGrade, _veRepSecAccel, _veRepSecUpshift
  ];
  var secs = [];
  emitters.forEach(function(fn) {
    var s = null;
    try { s = fn(R, sim, H, charts); } catch(e) { if(typeof console !== 'undefined') console.error('[Rapor bölümü]', e); }
    if(s && s.body) secs.push(s);
  });
  var toc = '<nav class="toc">', body = '';
  secs.forEach(function(s, i) {
    var no = i + 1;
    toc += '<a href="#' + s.id + '"><span class="n">' + no + '</span>' + H.esc(s.title) + '</a>';
    body += '<h2 id="' + s.id + '"><span class="no">' + no + '</span>' + H.esc(s.title) + '</h2>' + s.body;
  });
  toc += '</nav>';
  return { toc: toc, body: body };
}

// ─── Stil (referans CSS uyarlaması; KaTeX yok, daima beyaz zemin) ─────────────
var _VE_REPORT_CSS = `
:root{
  --ink:#1b1e24; --paper:#ffffff; --line:#c9cdd3; --line-soft:#e4e6e9;
  --prusya:#24425f; --prusya-soft:#eef2f6; --check:#2e7d4f; --check-soft:#eaf3ee;
  --warn:#8a5a1e; --warn-soft:#f7f1e6; --bad:#b23b3b;
  --mono:"IBM Plex Mono",ui-monospace,monospace;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:"Source Serif 4",Georgia,serif;font-size:var(--fs-title);line-height:1.68;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
.page{max-width:880px;margin:0 auto;padding:48px 32px 96px}
h1,h2,h3{font-family:"Archivo",system-ui,sans-serif;color:var(--prusya);line-height:1.25;font-stretch:87%}
h1{font-size:var(--fs-h1);font-weight:700;letter-spacing:.2px;margin:0 0 6px}
h2{font-size:var(--fs-h2);font-weight:700;margin:56px 0 14px;padding-top:14px;border-top:2px solid var(--prusya);
  display:flex;gap:14px;align-items:baseline}
h2 .no{font-family:var(--mono);font-size:var(--fs-lg);color:var(--paper);background:var(--prusya);
  padding:2px 8px;border-radius:2px;transform:translateY(-2px)}
h3{font-size:var(--fs-title);font-weight:600;margin:26px 0 8px;color:var(--ink)}
p{margin:0 0 13px;text-align:justify;hyphens:auto}
strong{font-weight:600} em{font-style:italic}

/* ── Antet ── */
.antet{border:1.5px solid var(--ink);margin-bottom:36px}
.antet .band{background:var(--prusya);color:#fff;padding:16px 20px}
.antet .band .eyebrow{font-family:var(--mono);font-size:var(--fs-body);letter-spacing:2.5px;text-transform:uppercase;opacity:.85;margin-bottom:6px}
.antet .band h1{color:#fff}
.antet .band .sub{font-family:"Archivo",sans-serif;font-size:var(--fs-lg);font-weight:400;opacity:.92;margin-top:4px;line-height:1.4}
.antet .fields{display:grid;grid-template-columns:repeat(5,1fr);border-top:1.5px solid var(--ink)}
.antet .f{padding:8px 12px;border-right:1px solid var(--line)}
.antet .f:last-child{border-right:none}
.antet .f .k{font-family:var(--mono);font-size:var(--fs-tiny);letter-spacing:1.5px;text-transform:uppercase;color:#5a6270}
.antet .f .v{font-family:"Archivo",sans-serif;font-size:var(--fs-lg);font-weight:600;margin-top:2px;word-break:break-word}

/* ── Notlar ── */
.note{background:var(--prusya-soft);border-left:3px solid var(--prusya);padding:12px 16px;margin:16px 0;font-size:var(--fs-lg)}
.note.warn{background:var(--warn-soft);border-left-color:var(--warn)}
.note.check{background:var(--check-soft);border-left-color:var(--check)}
.note .t{font-family:"Archivo",sans-serif;font-weight:700;font-size:var(--fs-md);letter-spacing:1.5px;
  text-transform:uppercase;display:block;margin-bottom:4px;color:var(--prusya)}
.note.warn .t{color:var(--warn)} .note.check .t{color:var(--check)}

/* ── Tablolar ── */
table{border-collapse:collapse;width:100%;margin:14px 0 20px;font-size:var(--fs-lg)}
caption{caption-side:top;text-align:left;font-family:"Archivo",sans-serif;font-size:var(--fs-md);
  font-weight:600;color:var(--prusya);padding-bottom:6px;letter-spacing:.3px}
th{font-family:"Archivo",sans-serif;font-size:var(--fs-md);font-weight:600;letter-spacing:.5px;
  background:var(--prusya-soft);color:var(--prusya);padding:7px 10px;border:1px solid var(--line);text-align:center}
td{padding:6px 10px;border:1px solid var(--line-soft);font-family:var(--mono);font-size:var(--fs-lg);text-align:right;white-space:nowrap}
td.l{text-align:left;font-family:"Source Serif 4",Georgia,serif;font-size:var(--fs-lg);white-space:normal}
td.c{text-align:center}
tr.sum td{border-top:1.5px solid var(--line);background:#f7f8f9;font-weight:600}
table.kv td.l{width:46%;color:#3c4350}
table.kv td:not(.l){font-weight:600}
.st-ok{color:var(--check);font-weight:600;white-space:nowrap}
.st-warn{color:var(--warn);font-weight:600;white-space:nowrap}
.st-bad{color:var(--bad);font-weight:600;white-space:nowrap}
.chip{display:inline-block;font-family:var(--mono);font-size:var(--fs-body);background:var(--check-soft);
  color:var(--check);border:1px solid var(--check);border-radius:2px;padding:0 6px;margin-left:6px;vertical-align:1px}

/* ── Şekiller ── */
figure{margin:22px 0 26px;border:1px solid var(--line);padding:14px 14px 10px;background:#fff}
figure img{width:100%;height:auto;display:block}
figcaption{font-family:"Archivo",sans-serif;font-size:var(--fs-md);color:#3c4350;margin-top:10px;
  padding-top:8px;border-top:1px solid var(--line-soft)}
figcaption b{color:var(--prusya)}

/* ── İçindekiler ── */
.toc{font-family:"Archivo",sans-serif;font-size:var(--fs-lg);columns:2;column-gap:36px;margin:10px 0 4px}
.toc a{color:var(--ink);text-decoration:none;display:block;padding:3px 0;border-bottom:1px dotted var(--line-soft);break-inside:avoid}
.toc a:hover{color:var(--prusya)}
.toc .n{font-family:var(--mono);font-size:var(--fs-body);color:var(--prusya);margin-right:8px;font-weight:600}

.foot{margin-top:40px;font-size:var(--fs-lg);color:#5a6270;border-top:1px solid var(--line);padding-top:12px;font-family:"Archivo",sans-serif}

@media print{
  .page{max-width:100%;padding:0}
  body{font-size:11pt}
  h2,h3{break-after:avoid}
  figure,table,.note{break-inside:avoid}
  tr{break-inside:avoid}
  caption{break-after:avoid}
  a{color:inherit;text-decoration:none}
  *{ -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  table{font-size:9pt} caption{font-size:9pt} th{padding:4px 6px} td{padding:3px 6px;white-space:normal}
}
@media (max-width:640px){
  .antet .fields{grid-template-columns:repeat(2,1fr)}
  .toc{columns:1}
  .page{padding:24px 16px 64px}
}
`;

// ─── Ana giriş: grafikleri yakala + belgeyi kur + indir ──────────────────────
function veDownloadReportHTML() {
  var overlay = document.getElementById('ve-report-overlay');
  if(!overlay || overlay.style.display === 'none') {
    if(typeof showToast === 'function') showToast('Rapor açık değil', 'warning');
    return;
  }
  var sim = window.veSimResults;
  var R = sim && sim.reportSnapshot;
  if(!R) {
    if(typeof showToast === 'function') showToast('Rapor verisi bulunamadı — önce simülasyon çalıştırın', 'warning');
    return;
  }

  // 1) Bölümleri aç (grafik canvas'ları layout alsın)
  var allBodies = overlay.querySelectorAll('.dr-body');
  var prevStates = [];
  Array.prototype.forEach.call(allBodies, function(b) { prevStates.push(b.style.display); b.style.display = 'block'; b.style.maxHeight = 'none'; });
  Array.prototype.forEach.call(overlay.querySelectorAll('.dr-girdi-wrapper'), function(w) { w.classList.add('dr-girdi-open'); });

  // 2) Grafikleri SABİT AÇIK renklerle yeniden çiz (tema bağımsızlığı)
  var _savedTC = _drTC;
  _drTC = { bg:'#ffffff', bgAlt:'#f0f1f3', text:'#1b1e24', textSec:'#4e535e',
            textMuted:'#9098a6', border:'#e8eaed', accent:'#2d6fe6', axisLine:'#c2c8d4' };
  function _drawReportCharts() {
    try {
      veDrawEngineChart(R.torqueData, R.governed, R.noLoad, R.fanLossGov, R.otherLossGov);
      veDrawReportECMChart(R);
      if(sim.gradeability) veDrawGradeabilityCharts(sim.gradeability);
      if(sim.acceleration) veDrawAccelerationCharts(sim.acceleration);
      if(document.getElementById('ftUpshiftChartHigh')) veDrawFTUpshiftCharts(sim);
    } catch(e) { /* devam */ }
  }
  _drawReportCharts();

  if(typeof showToast === 'function') showToast('HTML rapor hazırlanıyor…', 'info');

  function withFonts(cb) {
    if(typeof _mntReportEnsureAssets === 'function') {
      try { _mntReportEnsureAssets(function(ok) { cb((ok && window.MNT_REPORT_ASSETS) ? window.MNT_REPORT_ASSETS.fontsCss : ''); }); return; }
      catch(e) {}
    }
    cb((window.MNT_REPORT_ASSETS && window.MNT_REPORT_ASSETS.fontsCss) || '');
  }

  withFonts(function(fontsCss) {
    setTimeout(function() {
      var restored = false;
      function restore() {
        if(restored) return; restored = true;
        Array.prototype.forEach.call(allBodies, function(b, i) { b.style.display = prevStates[i]; });
        Array.prototype.forEach.call(overlay.querySelectorAll('.dr-arrow'), function(a) {
          var sec = a.closest('.dr-section');
          if(sec) { var body = sec.querySelector('.dr-body'); a.textContent = (body && body.style.display !== 'none') ? '▼' : '▶'; }
        });
        _drTC = _savedTC;
        _drawReportCharts();
      }
      try {
        var contentContainer = overlay.querySelector('[style*="overflow-y:auto"]') || overlay;
        // Grafik canvas'larını id → <img> eşle (statik PNG)
        var charts = {};
        Array.prototype.forEach.call(contentContainer.querySelectorAll('canvas'), function(c) {
          if(!c.id) return;
          try {
            var url = c.toDataURL('image/png');
            if(url && url.length > 32) charts[c.id] = '<img src="' + url + '" alt="grafik">';
          } catch(e) {}
        });

        var projectName = 'MFSim Raporu';
        try {
          var pnBtn = document.getElementById('ve-project-name-btn');
          if(pnBtn) { var pn = pnBtn.textContent.replace(/[⚙▾…]/g, '').trim(); if(pn && pn !== 'MFSim') projectName = pn; }
        } catch(e) {}

        var now = new Date();
        var dateStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
        var timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

        var asm = _veReportAssemble(R, sim, charts);
        var doc = '<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">'
          + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
          + '<title>' + _veReportEsc(projectName) + ' — Araç Performans Raporu</title>'
          + (fontsCss ? '<style>' + fontsCss + '</style>' : '')
          + '<style>' + _VE_REPORT_CSS + '</style>'
          + '</head><body><div class="page">'
          + _veReportAntet(R, projectName, dateStr)
          + asm.toc
          + asm.body
          + '<p class="foot">Bu rapor, projede tanımlı güç aktarma modelinden <strong>otomatik üretilmiştir</strong>; girdi değerleri modeldeki bileşen tanımlarından alınır. Tasarım kararlarında güncel tedarikçi / test verisiyle teyit edilmelidir. · MFSim — Motor Freni Simülasyon Yazılımı · ' + dateStr + ' ' + timeStr + '</p>'
          + '</div></body></html>';

        _veReportDownloadBlob(doc, _veReportSlug(projectName) + '_arac_performans_raporu.html');
        if(typeof showToast === 'function') showToast('HTML rapor indirildi (' + Math.round(doc.length / 1024) + ' KB)', 'success');
      } catch(e) {
        if(typeof showToast === 'function') showToast('HTML rapor üretilemedi: ' + e.message, 'error');
        if(typeof console !== 'undefined') console.error('[Detaylı Rapor HTML]', e);
      } finally {
        restore();
      }
    }, 240);
  });
}

// ECM Absorption chart — interactive (zoom + pan)
var _drEcmZoom = { scale: 1.0, centerRPM: null, centerT: null };
var _drEcmPan = { active: false, startX: 0, startY: 0, startCRPM: 0, startCT: 0, raf: null };
var _drEcmData = null;

function veDrawReportECMChart(R) {
  var wrap = document.getElementById('dr-ecm-chart-wrap');
  var canvas = document.getElementById('dr-ecm-chart');
  if(!canvas || !wrap || !R || !R.torqueData || R.torqueData.length < 2) return;
  if(typeof VE_FT_TC_PRESETS === 'undefined' || typeof veGetFamilyTCKeys !== 'function') return;
  
  _drEcmData = R;
  _drEcmZoom = { scale: 1.0, centerRPM: null, centerT: null };
  
  // Attach events once
  if(!canvas._drEventsAttached) {
    canvas._drEventsAttached = true;
    wrap.addEventListener('wheel', function(e) {
      e.preventDefault();
      if(!_drEcmData) return;
      var old = _drEcmZoom.scale;
      var delta = e.deltaY > 0 ? 0.85 : 1.18;
      _drEcmZoom.scale = Math.max(0.3, Math.min(12.0, old * delta));
      if(_drEcmZoom.scale === old) return;
      _drEcmRedraw();
      var ind = document.getElementById('dr-ecm-zoom-ind');
      if(ind) { if(_drEcmZoom.scale > 1.05 || _drEcmZoom.scale < 0.95){ind.textContent=''+_drEcmZoom.scale.toFixed(1)+'×';ind.style.display='inline';}else{ind.style.display='none';} }
    }, {passive: false});
    wrap.addEventListener('mousedown', function(e) {
      if(e.button !== 2) return; e.preventDefault();
      _drEcmPan.active = true; _drEcmPan.startX = e.clientX; _drEcmPan.startY = e.clientY;
      _drEcmPan.startCRPM = _drEcmZoom.centerRPM; _drEcmPan.startCT = _drEcmZoom.centerT;
      wrap.style.cursor = 'grabbing';
    });
    wrap.addEventListener('mousemove', function(e) {
      if(!_drEcmPan.active || !canvas._drLayout) return;
      var L = canvas._drLayout;
      var dx = e.clientX - _drEcmPan.startX, dy = e.clientY - _drEcmPan.startY;
      var vR = L.maxRPM - L.minRPM, vT = L.maxT - L.minT;
      _drEcmZoom.centerRPM = _drEcmPan.startCRPM - dx / L.pw * vR;
      _drEcmZoom.centerT = _drEcmPan.startCT + dy / L.ph * vT;
      if(!_drEcmPan.raf) { _drEcmPan.raf = requestAnimationFrame(function(){ _drEcmRedraw(); _drEcmPan.raf = null; }); }
    });
    wrap.addEventListener('mouseup', function(e) {
      if(e.button === 2 && _drEcmPan.active) { _drEcmPan.active = false; wrap.style.cursor = 'crosshair'; }
    });
    wrap.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  }
  
  _drEcmRedraw();
}

function drEcmResetZoom() {
  _drEcmZoom = { scale: 1.0, centerRPM: null, centerT: null };
  var ind = document.getElementById('dr-ecm-zoom-ind');
  if(ind) ind.style.display = 'none';
  _drEcmRedraw();
}

function _drEcmRedraw() {
  var canvas = document.getElementById('dr-ecm-chart');
  if(!canvas || !_drEcmData) return;
  var R = _drEcmData;
  var wrap = canvas.parentElement;
  var rect = wrap.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  var W = rect.width, H = rect.height;
  var _td = R.torqueData, _gov = R.governed, _nlg = R.noLoad, _pDrop = R.pumpDrop || 17.6;
  
  ctx.fillStyle = (_drTC||_drThemeColors()).bg; ctx.fillRect(0, 0, W, H);
  
  var ml = 58, mr = 20, mt = 20, mb = 44;
  var pw = W - ml - mr, ph = H - mt - mb;
  
  // Base ranges
  var bMaxRPM = _nlg + 100, bMinRPM = 400, bMaxT = 0;
  _td.forEach(function(d){ if(d.torque > bMaxT) bMaxT = d.torque; });
  bMaxT = Math.ceil(bMaxT / 200) * 200 + 400;
  
  // Zoom
  var zs = _drEcmZoom.scale || 1.0;
  var vRR = (bMaxRPM - bMinRPM) / zs, vTR = bMaxT / zs;
  if(_drEcmZoom.centerRPM === null) _drEcmZoom.centerRPM = (bMinRPM + bMaxRPM) / 2;
  if(_drEcmZoom.centerT === null) _drEcmZoom.centerT = bMaxT / 2;
  var minRPM = _drEcmZoom.centerRPM - vRR / 2, maxRPM = _drEcmZoom.centerRPM + vRR / 2;
  var minT = _drEcmZoom.centerT - vTR / 2, maxT = _drEcmZoom.centerT + vTR / 2;
  if(zs >= 1.0) {
    if(minRPM < bMinRPM){minRPM=bMinRPM;maxRPM=bMinRPM+vRR;} if(maxRPM>bMaxRPM){maxRPM=bMaxRPM;minRPM=bMaxRPM-vRR;}
    if(minT < 0){minT=0;maxT=vTR;} if(maxT>bMaxT){maxT=bMaxT;minT=bMaxT-vTR;}
  }
  _drEcmZoom.centerRPM = (minRPM+maxRPM)/2; _drEcmZoom.centerT = (minT+maxT)/2;
  
  canvas._drLayout = {ml:ml,pw:pw,mt:mt,ph:ph,minRPM:minRPM,maxRPM:maxRPM,minT:minT,maxT:maxT};
  
  function xP(rpm){return ml+(rpm-minRPM)/(maxRPM-minRPM)*pw;}
  function yP(t){return mt+ph-((t-minT)/(maxT-minT))*ph;}
  
  // Grid
  var tRange=maxT-minT, tStep=tRange>2000?500:tRange>800?200:tRange>400?100:50;
  var rRange=maxRPM-minRPM, rStep=rRange>2000?500:rRange>1000?200:100;
  ctx.strokeStyle=(_drTC||_drThemeColors()).border; ctx.lineWidth=0.5;
  for(var gt=Math.ceil(minT/tStep)*tStep;gt<=maxT;gt+=tStep){ctx.beginPath();ctx.moveTo(ml,yP(gt));ctx.lineTo(ml+pw,yP(gt));ctx.stroke();ctx.fillStyle=(_drTC||_drThemeColors()).textMuted;ctx.font='10px sans-serif';ctx.textAlign='right';ctx.fillText(gt,ml-5,yP(gt)+3);}
  for(var gr=Math.ceil(minRPM/rStep)*rStep;gr<=maxRPM;gr+=rStep){ctx.beginPath();ctx.moveTo(xP(gr),mt);ctx.lineTo(xP(gr),mt+ph);ctx.stroke();ctx.fillStyle=(_drTC||_drThemeColors()).textMuted;ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText(gr,xP(gr),mt+ph+16);}
  
  // Axes
  ctx.strokeStyle=(_drTC||_drThemeColors()).axisLine;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ml,mt);ctx.lineTo(ml,mt+ph);ctx.lineTo(ml+pw,mt+ph);ctx.stroke();
  ctx.fillStyle=(_drTC||_drThemeColors()).textSec;ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText('Pompa Devri — RPM',ml+pw/2,H-6);
  ctx.save();ctx.translate(14,mt+ph/2);ctx.rotate(-Math.PI/2);ctx.fillText('Pompa Torku — N·m',0,0);ctx.restore();
  
  // Clip to plot area
  ctx.save();
  ctx.beginPath();
  ctx.rect(ml, mt, pw, ph);
  ctx.clip();
  
  // TC curves
  var tcColors=['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6'];
  var tcKeys=veGetFamilyTCKeys();
  tcKeys.forEach(function(key,ci){
    var tc=VE_FT_TC_PRESETS[key];var tcD=tc.data;var color=tcColors[ci%tcColors.length];var kpS=tcD[0].kpump;
    ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.setLineDash([]);var first=true;
    for(var n=Math.max(minRPM,bMinRPM);n<=Math.min(maxRPM,bMaxRPM+50);n+=5){var t=(n*n)/(kpS*kpS);if(t>maxT*1.1)break;if(first){ctx.moveTo(xP(n),yP(t));first=false;}else ctx.lineTo(xP(n),yP(t));}ctx.stroke();
    var kp80=0;for(var di=0;di<tcD.length-1;di++){if(tcD[di].sr<=0.80&&tcD[di+1].sr>=0.80){var f=(0.80-tcD[di].sr)/(tcD[di+1].sr-tcD[di].sr);kp80=tcD[di].kpump+f*(tcD[di+1].kpump-tcD[di].kpump);break;}}
    if(kp80>0){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1;ctx.setLineDash([5,3]);first=true;for(var n2=Math.max(minRPM,bMinRPM);n2<=Math.min(maxRPM,bMaxRPM+50);n2+=5){var t2=(n2*n2)/(kp80*kp80);if(t2>maxT*1.1)break;if(first){ctx.moveTo(xP(n2),yP(t2));first=false;}else ctx.lineTo(xP(n2),yP(t2));}ctx.stroke();}ctx.setLineDash([]);
    var lN=bMinRPM+(ci+1)*(bMaxRPM-bMinRPM)/(tcKeys.length+2);var lT=(lN*lN)/(kpS*kpS);
    if(lT<maxT*0.9&&lT>minT+50&&lN>minRPM&&lN<maxRPM){ctx.fillStyle=color;ctx.font='bold 9px sans-serif';ctx.textAlign='left';ctx.fillText(tc.name,xP(lN)+3,yP(lT)-5);}
  });
  
  // Motor curve
  ctx.beginPath();ctx.strokeStyle='#f59e0b';ctx.lineWidth=2.5;ctx.setLineDash([]);var firstM=true;
  _td.forEach(function(d){var tp=d.torque-_pDrop;if(tp<0)tp=0;if(firstM){ctx.moveTo(xP(d.rpm),yP(tp));firstM=false;}else ctx.lineTo(xP(d.rpm),yP(tp));});
  ctx.lineTo(xP(_nlg),yP(0));ctx.stroke();
  ctx.fillStyle='#f59e0b';ctx.font='bold 10px sans-serif';ctx.textAlign='left';
  var mLbl=_td[0];if(mLbl.rpm>minRPM&&mLbl.rpm<maxRPM)ctx.fillText('Motor (Net − '+_pDrop+')',xP(mLbl.rpm)+4,yP(mLbl.torque-_pDrop)-8);
  
  // Governed line
  if(_gov>minRPM&&_gov<maxRPM){ctx.beginPath();ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.moveTo(xP(_gov),mt);ctx.lineTo(xP(_gov),mt+ph);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=(_drTC||_drThemeColors()).textMuted;ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText('Gov '+_gov,xP(_gov),mt+ph+28);}
  
  // Intersection dots
  try{var _pts=[];_td.forEach(function(d){_pts.push({rpm:d.rpm,torque:Math.max(0,d.torque-_pDrop)});});_pts.push({rpm:_nlg,torque:0});
  var _lu={};for(var si=0;si<_pts.length-1;si++){var p1=_pts[si],p2=_pts[si+1];for(var sr=Math.ceil(p1.rpm);sr<=Math.floor(p2.rpm);sr++){var sf=(p2.rpm>p1.rpm)?(sr-p1.rpm)/(p2.rpm-p1.rpm):0;_lu[sr]=p1.torque+sf*(p2.torque-p1.torque);}}
  var _sf=Math.ceil(_pts[0].rpm),_sl=Math.floor(_pts[_pts.length-1].rpm);
  tcKeys.forEach(function(key,ci){var tc=VE_FT_TC_PRESETS[key];var kpS=tc.data[0].kpump;var color=tcColors[ci%tcColors.length];if(!kpS||kpS<=0)return;
  var wa=false,fR=0,fT=0;for(var sr=_sf;sr<=_sl;sr++){var mV=_lu[sr]||0;var cV=(sr*sr)/(kpS*kpS);if(mV>cV+1)wa=true;else if(wa&&mV>0&&cV>=mV){fR=sr;fT=cV;break;}}
  if(fR>0&&fT>0&&fR>minRPM&&fR<maxRPM&&fT>minT&&fT<maxT){ctx.beginPath();ctx.arc(xP(fR),yP(fT),5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.beginPath();ctx.arc(xP(fR),yP(fT),2,0,Math.PI*2);ctx.fillStyle=(_drTC||_drThemeColors()).bg;ctx.fill();}
  });}catch(e){ console.warn('[MFSim] TC stall nokta çizim hatası:', e); }
  
  // Restore from clip
  ctx.restore();
  
  // Legend
  ctx.font='9px sans-serif';ctx.textAlign='left';ctx.fillStyle=(_drTC||_drThemeColors()).textMuted;ctx.fillText('── Durma   --- 0.80 SR',ml+pw-120,mt+14);
}


// ═══════════════════════════════════════════════════════════════════════════
// TAM GAZ OTOMATİK VİTES GEÇİŞLERİ — DETAYLI FT TABLOSU + DİYAGRAM
// ═══════════════════════════════════════════════════════════════════════════

// Global storage for FT upshift data (for CSV download & chart redraw)
var _ftUpshiftData = {};

// Extract iSCAAN-style step rows from parallel sim arrays
function veBuildFTStepsFromSim(sim, transferLabel) {
  var speed = sim.speed, rpm = sim.rpm, gearMode = sim.gearMode;
  var outputSpeed = sim.outputSpeed || [];
  var TE = sim.TE || [], DP = sim.DP || [], WP = sim.WP || [];
  var netGrade = sim.netGrade || [], heatRej = sim.heatRejection || [];
  var ss = sim.solverStats || {};
  var rs = sim.reportSnapshot || {};
  var governed = ss.N_governed || rs.governed || 2800;
  var m_kg = ss.m_vehicle || rs.gvw || 15000;
  var mg_kN = m_kg * 9.81 / 1000;
  
  if(!speed || speed.length < 2) return [];
  
  var steps = [];
  var prevGear = '';
  var lastSpeed = -999;
  var prevAddedIdx = -1;
  
  // Match point tracking
  var mp060done = false, mp70done = false, mp80done = false, mp85done = false, mpGovDone = false;
  
  // Build raw step from index
  function makeStep(i) {
    var v = speed[i] || 0;
    var g = gearMode[i] || '';
    var eRPM = rpm[i] || 0;
    var oRPM = outputSpeed[i] || 0;
    var te = TE[i] || 0;
    var dp = DP[i] || 0;
    var wp = WP[i] || 0;
    var ng = typeof netGrade[i] === 'number' ? netGrade[i] : 0;
    var hr = heatRej[i] || 0;
    return {
      gear: g, speed: v, engineRPM: eRPM, outputRPM: oRPM,
      te: te, dp: dp, wheelPower: wp, netGrade: ng,
      heatRejection: hr, matchPoint: ''
    };
  }
  
  // Determine match point for a step
  function calcMatchPoint(s) {
    // TE/Weight Ratio = 0.60
    if(!mp060done && mg_kN > 0) {
      var ratio = s.te / mg_kN;
      if(ratio <= 0.605 && ratio >= 0.30) { mp060done = true; return '%60 Çekiş/Ağırlık'; }
    }
    // RPM yüzdeleri (yalnız 1. vites — TK'li '1C' ve TK'siz '1' hepsi eşleşir)
    if(s.gear.replace(/[CL]$/, '') === '1') {
      var rpmPct = s.engineRPM / governed * 100;
      if(!mp70done && rpmPct >= 69.5 && rpmPct <= 71.0) { mp70done = true; return '%70'; }
      if(!mp80done && rpmPct >= 79.5 && rpmPct <= 81.0) { mp80done = true; return '%80'; }
      if(!mp85done && rpmPct >= 84.5 && rpmPct <= 86.0) { mp85done = true; return '%85'; }
    }
    // Governed
    if(!mpGovDone && Math.abs(s.engineRPM - governed) < 15) { mpGovDone = true; return 'Governed'; }
    return '';
  }
  
  // Minimum speed interval per gear mode
  function getSpeedStep(gear) {
    var gn = String(gear).replace(/[CL]$/, '');
    if(gn === '1') return 1.0;
    if(gn === '2') return 1.5;
    return 2.0;
  }
  
  // First point (stall, V=0)
  var s0 = makeStep(0);
  s0.matchPoint = calcMatchPoint(s0);
  steps.push(s0);
  lastSpeed = s0.speed;
  prevGear = s0.gear;
  prevAddedIdx = 0;
  
  for(var i = 1; i < speed.length; i++) {
    var curGear = gearMode[i] || '';
    var curSpeed = speed[i] || 0;
    
    // Gear change — add both: last point of old gear + first point of new gear
    if(curGear !== prevGear && prevGear !== '') {
      // Add previous point (end of old gear) if not already added
      if(i - 1 > prevAddedIdx) {
        var sPrev = makeStep(i - 1);
        sPrev.matchPoint = calcMatchPoint(sPrev);
        steps.push(sPrev);
      }
      // Add current point (start of new gear)
      var sNew = makeStep(i);
      sNew.matchPoint = calcMatchPoint(sNew);
      steps.push(sNew);
      lastSpeed = curSpeed;
      prevGear = curGear;
      prevAddedIdx = i;
      continue;
    }
    
    // Regular sampling based on speed interval
    var minStep = getSpeedStep(curGear);
    if(curSpeed - lastSpeed >= minStep) {
      var s = makeStep(i);
      s.matchPoint = calcMatchPoint(s);
      steps.push(s);
      lastSpeed = curSpeed;
      prevAddedIdx = i;
    }
    
    prevGear = curGear;
  }
  
  // Last point (max speed / steady state)
  var lastIdx = speed.length - 1;
  if(prevAddedIdx < lastIdx) {
    var sLast = makeStep(lastIdx);
    // Check for governed on last points
    if(!mpGovDone) {
      for(var li = Math.max(0, lastIdx - 5); li <= lastIdx; li++) {
        if(Math.abs((rpm[li]||0) - governed) < 15) {
          if(li < lastIdx) {
            var sGov = makeStep(li);
            sGov.matchPoint = 'Governed';
            steps.push(sGov);
            mpGovDone = true;
            break;
          } else {
            sLast.matchPoint = 'Governed';
            mpGovDone = true;
          }
        }
      }
    }
    steps.push(sLast);
  }
  
  // Post-process: find 0.60 TE/Weight match point by interpolation if not found
  if(!mp060done && steps.length > 1) {
    var targetTE = 0.60 * mg_kN;
    for(var mi = 0; mi < steps.length - 1; mi++) {
      if(steps[mi].te >= targetTE && steps[mi+1].te < targetTE) {
        steps[mi+1].matchPoint = steps[mi+1].matchPoint || '%60 Çekiş/Ağırlık';
        break;
      }
    }
  }
  
  return steps;
}

// Build complete HTML for FT Upshifts section
function veBuildFTUpshiftsHTML(sim, R) {
  if(!sim || !sim.speed || sim.speed.length < 2) {
    return '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:var(--fs-body);">Simülasyon verisi bulunamadı.</div>';
  }
  
  var ss = sim.solverStats || {};
  var rs = sim.reportSnapshot || R || {};
  var axleRatio = ss.i_axle || rs.diffRatio || 5.904;
  var trGears = rs.transferGears || [];
  var hasTransfer = rs.hasTransfer && trGears.length > 1;
  var activeRatio = ss.transferRange ? (parseFloat(ss.transferRange.ratio || ss.transferRange.oran) || 1.0) : (trGears.length > 0 ? trGears[0].ratio : 1.0);
  
  var html = '';
  
  // Üst bilgi tablosu (gradeability/accel ile aynı stil)
  html += '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary); margin-bottom:14px;">';
  html += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); width:200px; font-size:var(--fs-md);">Motor Fanı</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">Açık</td>';
  html += '<td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); width:200px; font-size:var(--fs-md);">Motor Gücü</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">Standart Güç Eğrisi</td></tr>';
  html += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Klima</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">Kapalı</td>';
  html += '<td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Araç Parametreleri</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">Standart</td></tr>';
  html += '<tr><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Aks Oranı</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">' + axleRatio.toFixed(3) + '</td>';
  html += '<td style="padding:6px 14px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:var(--fs-md);">Transfer Kutusu Oranı</td><td style="padding:6px 14px; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-primary); font-size:var(--fs-md);">' + activeRatio.toFixed(3) + '</td></tr>';
  html += '</table>';
  
  // ═══ HIGH RANGE ═══
  var stepsHigh = veBuildFTStepsFromSim(sim, 'high');
  _ftUpshiftData['ftUpshiftChartHigh'] = stepsHigh;
  
  if(stepsHigh.length > 0) {
    if(hasTransfer) {
      html += '<div style="font-weight:700; font-size:var(--fs-md); color:var(--text-primary); padding:7px 14px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); margin:0 -24px 10px; padding-left:24px;">Transfer Kutusu: Yüksek Kademe (' + activeRatio.toFixed(3) + ')</div>';
    }
    html += _ftBuildTable(stepsHigh);
    
    // Chart (aynı yapı: canvas + tooltip + crosshair)
    html += '<div style="max-width:800px; margin:20px auto 0; position:relative;"><canvas id="ftUpshiftChartHigh" height="450" style="cursor:crosshair;"></canvas>';
    html += '<div id="ftUpshiftChartHigh-tooltip" class="dr-chart-tooltip"></div>';
    html += '<div id="ftUpshiftChartHigh-crossV" class="dr-chart-crossV"></div>';
    html += '<div id="ftUpshiftChartHigh-crossH" class="dr-chart-crossH"></div></div>';
  }
  
  // ═══ LOW RANGE ═══
  if(hasTransfer && trGears.length > 1) {
    var lowGear = trGears[1];
    var lowRatio = lowGear.ratio;
    var lowEta = lowGear.eff || 97;
    var activeEta = trGears[0].eff || 97;
    var Cd = rs.cd || 0.9, A = rs.frontalArea || 8.0, Crr = rs.crr || 0.0035;
    var m_kg = ss.m_vehicle || rs.gvw || 15000;

    // Gerçek düşük kademe simülasyonu varsa onu kullan (ölçekleme yerine)
    var allRangeRes = typeof window !== 'undefined' ? window._veFTAllRangeResults : null;
    var lowKademe = lowGear.kademe || 'Low';
    var lowSimResult = allRangeRes ? allRangeRes[lowKademe] : null;

    var stepsLow;
    if(lowSimResult && lowSimResult.speed && lowSimResult.speed.length > 2) {
      // Gerçek simülasyon verisi — doğru TE, DP, HR, vites geçişleri
      stepsLow = veBuildFTStepsFromSim(lowSimResult, 'low');
    } else {
      // Fallback: ölçekleme (gerçek sim yoksa)
      stepsLow = _ftBuildLowRangeSteps(sim, activeRatio, lowRatio, activeEta, lowEta, m_kg, Cd, A, Crr, rs);
    }
    _ftUpshiftData['ftUpshiftChartLow'] = stepsLow;
    
    if(stepsLow.length > 0) {
      html += '<div style="height:20px;"></div>';
      html += '<div style="font-weight:700; font-size:var(--fs-md); color:var(--text-primary); padding:7px 14px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); margin:0 -24px 10px; padding-left:24px;">Transfer Kutusu: Düşük Kademe (' + lowRatio.toFixed(3) + ')</div>';
      html += _ftBuildTable(stepsLow);
      
      html += '<div style="max-width:800px; margin:20px auto 0; position:relative;"><canvas id="ftUpshiftChartLow" height="450" style="cursor:crosshair;"></canvas>';
      html += '<div id="ftUpshiftChartLow-tooltip" class="dr-chart-tooltip"></div>';
      html += '<div id="ftUpshiftChartLow-crossV" class="dr-chart-crossV"></div>';
      html += '<div id="ftUpshiftChartLow-crossH" class="dr-chart-crossH"></div></div>';
    }
  }
  
  return html;
}

// Build detail table HTML — Turkish, inline styles matching grade/accel tables
function _ftBuildTable(steps) {
  var html = '<div style="overflow-x:auto;">';
  html += '<table style="width:100%; border-collapse:collapse; background:var(--bg-secondary); font-size:var(--fs-body);">';
  html += '<thead><tr style="background:var(--bg-tertiary);">';
  html += '<th style="padding:6px 8px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:left; color:var(--text-secondary); font-weight:500;">Vites<br>Kademe</th>';
  html += '<th style="padding:6px 8px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:center; color:var(--text-secondary); font-weight:500;">Araç Hızı<br>(km/h)</th>';
  html += '<th style="padding:6px 8px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:center; color:var(--text-secondary); font-weight:500;">Motor Devri<br>(rpm)</th>';
  html += '<th style="padding:6px 8px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:center; color:var(--text-secondary); font-weight:500;">Çıkış Devri<br>(rpm)</th>';
  html += '<th style="padding:6px 8px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:center; color:var(--text-secondary); font-weight:500;">Çekiş Kuvveti<br>(kN)</th>';
  html += '<th style="padding:6px 8px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:center; color:var(--text-secondary); font-weight:500;">Net Çekiş<br>(kN)</th>';
  html += '<th style="padding:6px 8px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:center; color:var(--text-secondary); font-weight:500;">Tekerlek<br>Gücü (kW)</th>';
  html += '<th style="padding:6px 8px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:center; color:var(--text-secondary); font-weight:500;">Net Eğim<br>(%)</th>';
  html += '<th style="padding:6px 8px; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-light); text-align:center; color:var(--text-secondary); font-weight:500;">Isı Reddi<br>(kW)</th>';
  html += '<th style="padding:6px 8px; border-bottom:1px solid var(--border-color); text-align:left; color:var(--text-secondary); font-weight:500;">Eşleşme<br>Noktası</th>';
  html += '</tr></thead><tbody>';
  
  var prevGear = '';
  for(var i = 0; i < steps.length; i++) {
    var s = steps[i];
    var borderTop = '';
    var dpColor = s.dp < 0 ? 'color:var(--accent-danger);' : '';
    var grColor = s.netGrade < 0 ? 'color:var(--accent-danger);' : '';
    
    html += '<tr style="' + borderTop + '">';
    html += '<td style="padding:5px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); font-weight:500; color:var(--text-primary);">' + s.gear + '</td>';
    html += '<td style="padding:5px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; color:var(--text-primary);">' + s.speed.toFixed(1) + '</td>';
    html += '<td style="padding:5px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; color:var(--text-primary);">' + Math.round(s.engineRPM) + '</td>';
    html += '<td style="padding:5px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; color:var(--text-primary);">' + Math.round(s.outputRPM) + '</td>';
    html += '<td style="padding:5px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; color:var(--text-primary);">' + s.te.toFixed(2) + '</td>';
    html += '<td style="padding:5px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; ' + dpColor + '">' + s.dp.toFixed(2) + '</td>';
    html += '<td style="padding:5px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; color:var(--text-primary);">' + s.wheelPower.toFixed(1) + '</td>';
    html += '<td style="padding:5px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; ' + grColor + '">' + s.netGrade.toFixed(2) + '</td>';
    html += '<td style="padding:5px 8px; border-bottom:1px solid var(--border-light); border-right:1px solid var(--border-light); text-align:center; color:var(--text-primary);">' + s.heatRejection.toFixed(2) + '</td>';
    html += '<td style="padding:5px 8px; border-bottom:1px solid var(--border-light); text-align:left; color:var(--accent-primary); font-style:italic; font-size:var(--fs-tiny); white-space:nowrap;">' + (s.matchPoint || '') + '</td>';
    html += '</tr>';
    prevGear = s.gear;
  }
  
  html += '</tbody></table></div>';
  return html;
}

// Build low-range steps by scaling the high-range simulation
function _ftBuildLowRangeSteps(sim, ratioHigh, ratioLow, etaHigh, etaLow, m_kg, Cd, A, Crr, rs) {
  var scale = ratioHigh / ratioLow;
  var forceScale = (ratioLow / ratioHigh) * ((etaLow/100) / (etaHigh/100));
  var governed = (sim.solverStats || {}).N_governed || (rs||{}).governed || 2800;
  var mg_kN = m_kg * 9.81 / 1000;
  var mp060done = false, mp70done = false, mp80done = false, mp85done = false, mpGovDone = false;
  
  var highSteps = veBuildFTStepsFromSim(sim, 'high');
  var steps = [];
  
  for(var i = 0; i < highSteps.length; i++) {
    var h = highSteps[i];
    var v = h.speed * scale;
    var v_ms = v / 3.6;
    var F_roll = m_kg * 9.81 * Crr / 1000;
    var F_aero = 0.5 * 1.225 * Cd * A * v_ms * v_ms / 1000;
    var te = h.te * forceScale;
    var dp = te - F_roll - F_aero;
    var wp = te * v / 3.6;
    var ng = 0;
    if(m_kg > 0) {
      var sinA = (dp * 1000) / (m_kg * 9.81);
      sinA = Math.max(-1, Math.min(1, sinA));
      ng = Math.tan(Math.asin(sinA)) * 100;
    }
    if(ng > 999) ng = 999.0;
    var hr = h.heatRejection * forceScale;
    if(hr < 0) hr = 0;
    
    var s = {
      gear: h.gear, speed: v, engineRPM: h.engineRPM, outputRPM: h.outputRPM,
      te: te, dp: dp, wheelPower: wp, netGrade: ng,
      heatRejection: hr, matchPoint: ''
    };
    
    if(!mp060done && mg_kN > 0 && te / mg_kN <= 0.605 && te / mg_kN >= 0.30) { mp060done = true; s.matchPoint = '%60 Çekiş/Ağırlık'; }
    if(s.gear.replace(/[CL]$/, '') === '1') {
      var rpmPct = s.engineRPM / governed * 100;
      if(!mp70done && rpmPct >= 69.5 && rpmPct <= 71.0) { mp70done = true; s.matchPoint = '%70'; }
      if(!mp80done && rpmPct >= 79.5 && rpmPct <= 81.0) { mp80done = true; s.matchPoint = '%80'; }
      if(!mp85done && rpmPct >= 84.5 && rpmPct <= 86.0) { mp85done = true; s.matchPoint = '%85'; }
    }
    if(!mpGovDone && Math.abs(s.engineRPM - governed) < 15) { mpGovDone = true; s.matchPoint = 'Governed'; }
    
    steps.push(s);
  }
  
  return steps;
}

// ═══ FT Upshift Chart Drawing (interactive — zoom/pan/tooltip/crosshair) ═══
function veDrawFTUpshiftCharts(sim) {
  if(_ftUpshiftData['ftUpshiftChartHigh']) {
    setTimeout(function() { veRenderFTUpshiftChart('ftUpshiftChartHigh', _ftUpshiftData['ftUpshiftChartHigh']); }, 30);
  }
  if(_ftUpshiftData['ftUpshiftChartLow']) {
    setTimeout(function() { veRenderFTUpshiftChart('ftUpshiftChartLow', _ftUpshiftData['ftUpshiftChartLow']); }, 60);
  }
}

function veRenderFTUpshiftChart(canvasId, steps) {
  var canvas = document.getElementById(canvasId);
  if(!canvas || !steps || steps.length < 2) return;
  var parent = canvas.parentElement;
  if(!parent) return;
  var rect = parent.getBoundingClientRect();
  if(rect.width < 50) return;
  
  var dpr = window.devicePixelRatio || 1;
  var W = rect.width, H = 450;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  var padL = 62, padR = 62, padT = 24, padB = 48;
  var plotW = W - padL - padR, plotH = H - padT - padB;
  
  // Zoom state
  if(!_drChartZoom[canvasId]) _drChartZoom[canvasId] = {scale:1.0, cx:null, cy:null};
  var zState = _drChartZoom[canvasId];
  var zs = zState.scale || 1.0;
  
  // Extract data ranges
  var rpmArr = [], grArr = [], spdArr = [];
  for(var i = 0; i < steps.length; i++) {
    rpmArr.push(steps[i].engineRPM);
    grArr.push(steps[i].netGrade);
    spdArr.push(steps[i].speed);
  }
  
  var baseXMin = 0, baseXMax = Math.ceil(Math.max.apply(null, spdArr) / 10) * 10 + 10;
  var baseRPMMin = Math.floor(Math.min.apply(null, rpmArr) / 100) * 100 - 100;
  var baseRPMMax = Math.ceil(Math.max.apply(null, rpmArr) / 100) * 100 + 100;
  if(baseRPMMin < 0) baseRPMMin = 0;
  var baseGrMin = Math.floor(Math.min.apply(null, grArr) / 10) * 10 - 10;
  var baseGrMax = Math.max.apply(null, grArr);
  baseGrMax = baseGrMax > 100 ? Math.ceil(baseGrMax / 50) * 50 + 10 : Math.ceil(baseGrMax / 10) * 10 + 10;
  if(baseGrMin > -10) baseGrMin = -10;
  
  // Apply zoom
  var visXRange = (baseXMax - baseXMin) / zs;
  if(zState.cx === null) zState.cx = (baseXMin + baseXMax) / 2;
  var xMin = zState.cx - visXRange / 2, xMax = zState.cx + visXRange / 2;
  if(zs >= 1.0) { if(xMin < baseXMin){xMin=baseXMin;xMax=baseXMin+visXRange;} if(xMax > baseXMax){xMax=baseXMax;xMin=baseXMax-visXRange;} }
  zState.cx = (xMin + xMax) / 2;
  
  // Y ranges stay fixed (no Y zoom for this chart type — both axes are important)
  var yRPMMin = baseRPMMin, yRPMMax = baseRPMMax;
  var yGrMin = baseGrMin, yGrMax = baseGrMax;
  
  // Transform functions
  function toX(v) { return padL + (v - xMin) / (xMax - xMin) * plotW; }
  function toYR(rpm) { return padT + plotH - ((rpm - yRPMMin) / (yRPMMax - yRPMMin)) * plotH; }
  function toYG(gr) { return padT + plotH - ((gr - yGrMin) / (yGrMax - yGrMin)) * plotH; }
  function fromX(px) { return xMin + (px - padL) / plotW * (xMax - xMin); }
  
  // Background
  ctx.fillStyle = (_drTC||_drThemeColors()).bg; ctx.fillRect(0, 0, W, H);
  
  // Grid
  ctx.strokeStyle = (_drTC||_drThemeColors()).border; ctx.lineWidth = 0.5;
  var xStep = (xMax - xMin) <= 50 ? 5 : (xMax - xMin) <= 100 ? 10 : 20;
  for(var gx = Math.ceil(xMin / xStep) * xStep; gx <= xMax; gx += xStep) {
    ctx.beginPath(); ctx.moveTo(toX(gx), padT); ctx.lineTo(toX(gx), H - padB); ctx.stroke();
  }
  var rStep = (yRPMMax - yRPMMin) > 1500 ? 500 : (yRPMMax - yRPMMin) > 600 ? 200 : 100;
  for(var gy = Math.ceil(yRPMMin / rStep) * rStep; gy <= yRPMMax; gy += rStep) {
    ctx.beginPath(); ctx.moveTo(padL, toYR(gy)); ctx.lineTo(W - padR, toYR(gy)); ctx.stroke();
  }
  
  // Axes
  ctx.strokeStyle = (_drTC||_drThemeColors()).axisLine; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - padR, padT); ctx.lineTo(W - padR, H - padB); ctx.stroke();
  
  // X labels
  ctx.fillStyle = (_drTC||_drThemeColors()).textSec; ctx.font = '600 11px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  for(var lx = Math.ceil(xMin / xStep) * xStep; lx <= xMax; lx += xStep) {
    ctx.fillText(lx.toString(), toX(lx), H - padB + 16);
  }
  ctx.fillText('Araç Hızı (km/h)', padL + plotW / 2, H - 6);
  
  // Left Y labels (RPM — blue)
  ctx.fillStyle = '#4a86c8'; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'right';
  for(var lr = Math.ceil(yRPMMin / rStep) * rStep; lr <= yRPMMax; lr += rStep) {
    ctx.fillText(lr.toString(), padL - 6, toYR(lr) + 4);
  }
  ctx.save(); ctx.translate(14, padT + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.font = '600 11.5px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Motor Devri (rpm)', 0, 0); ctx.restore();
  
  // Right Y labels (Grade — red)
  var gStep = yGrMax > 200 ? 50 : yGrMax > 80 ? 20 : 10;
  ctx.fillStyle = '#c0392b'; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'left';
  for(var lg = Math.ceil(yGrMin / gStep) * gStep; lg <= yGrMax; lg += gStep) {
    ctx.fillText(lg.toString(), W - padR + 6, toYG(lg) + 4);
  }
  ctx.save(); ctx.translate(W - 8, padT + plotH / 2); ctx.rotate(Math.PI / 2);
  ctx.font = '600 11.5px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#c0392b';
  ctx.fillText('Net Eğim (%)', 0, 0); ctx.restore();
  
  // Zoom indicator
  if(zs > 1.05 || zs < 0.95) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.font = '600 10px Segoe UI, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('\uD83D\uDD0D ' + zs.toFixed(1) + '\u00d7  Scroll: Zoom \u2014 Sa\u011f T\u0131k+S\u00fcr\u00fckle: Kayd\u0131r \u2014 \u00c7ift T\u0131k: S\u0131f\u0131rla', W - padR, padT - 8);
  }
  
  // Clip to plot area
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();
  
  // ── Engine Speed line (blue, sawtooth) ──
  ctx.strokeStyle = '#4a86c8'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.setLineDash([]);
  ctx.beginPath();
  for(var ei = 0; ei < steps.length; ei++) {
    var ex = toX(steps[ei].speed), ey = toYR(steps[ei].engineRPM);
    if(ei === 0) ctx.moveTo(ex, ey); else ctx.lineTo(ex, ey);
  }
  ctx.stroke();
  for(var epi = 0; epi < steps.length; epi++) {
    var epx = toX(steps[epi].speed), epy = toYR(steps[epi].engineRPM);
    if(epx < padL - 5 || epx > W - padR + 5) continue;
    ctx.beginPath(); ctx.arc(epx, epy, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = (_drTC||_drThemeColors()).bg; ctx.fill();
    ctx.strokeStyle = '#4a86c8'; ctx.lineWidth = 2; ctx.stroke();
  }
  
  // ── Net Grade line (red, descending) ──
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.setLineDash([]);
  ctx.beginPath();
  for(var gi = 0; gi < steps.length; gi++) {
    var gx2 = toX(steps[gi].speed), gy2 = toYG(steps[gi].netGrade);
    if(gi === 0) ctx.moveTo(gx2, gy2); else ctx.lineTo(gx2, gy2);
  }
  ctx.stroke();
  for(var gpi = 0; gpi < steps.length; gpi++) {
    var gpx = toX(steps[gpi].speed), gpy = toYG(steps[gpi].netGrade);
    if(gpx < padL - 5 || gpx > W - padR + 5) continue;
    ctx.beginPath(); ctx.arc(gpx, gpy, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = (_drTC||_drThemeColors()).bg; ctx.fill();
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2; ctx.stroke();
  }
  
  // Restore from clip
  ctx.restore();
  
  // Legend
  var legX = padL + 14, legY = padT + 14;
  ctx.font = '11px Segoe UI, sans-serif';
  ctx.strokeStyle = '#4a86c8'; ctx.lineWidth = 2.5; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(legX, legY); ctx.lineTo(legX + 24, legY); ctx.stroke();
  ctx.beginPath(); ctx.arc(legX + 12, legY, 3.5, 0, Math.PI * 2); ctx.fillStyle = (_drTC||_drThemeColors()).bg; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4a86c8'; ctx.textAlign = 'left'; ctx.fillText('Motor Devri (rpm)', legX + 30, legY + 4);
  
  legY += 18;
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(legX, legY); ctx.lineTo(legX + 24, legY); ctx.stroke();
  ctx.beginPath(); ctx.arc(legX + 12, legY, 3.5, 0, Math.PI * 2); ctx.fillStyle = (_drTC||_drThemeColors()).bg; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c0392b'; ctx.fillText('Net Eğim (%)', legX + 30, legY + 4);
  
  // Store interaction data (same structure as grade/accel charts)
  canvas._drChart = {
    type:'ftUpshift', data:steps, padL:padL, padR:padR, padT:padT, padB:padB,
    plotW:plotW, plotH:plotH, xMin:xMin, xMax:xMax, yMin:yRPMMin, yMax:yRPMMax,
    baseXMin:baseXMin, baseXMax:baseXMax, baseYMin:baseRPMMin, baseYMax:baseRPMMax,
    fromX:fromX, W:W, H:H,
    yGrMin:yGrMin, yGrMax:yGrMax
  };
  
  // Attach interactive events (reuse existing _drChart* handlers)
  if(!canvas._drEventsAttached) {
    canvas._drEventsAttached = true;
    canvas.addEventListener('wheel', _drChartWheel, {passive:false});
    canvas.addEventListener('mousedown', _drChartMouseDown);
    canvas.addEventListener('mouseup', _drChartMouseUp);
    canvas.addEventListener('mousemove', _ftUpshiftMouseMove);
    canvas.addEventListener('mouseleave', _drChartMouseLeave);
    canvas.addEventListener('dblclick', _drChartDblClick);
    canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  }
}

// FT Upshift chart-specific tooltip with dual-axis interpolation
function _ftUpshiftMouseMove(e) {
  var canvas = e.currentTarget;
  var d = canvas._drChart;
  if(!d || d.type !== 'ftUpshift') return;

  var cr = canvas.getBoundingClientRect();
  var mx = e.clientX - cr.left, my = e.clientY - cr.top;

  // Pan handling
  if(_drChartPan && _drChartPan.active && _drChartPan.canvasId === canvas.id) {
    var z = _drGetZoom(canvas.id);
    var dx = e.clientX - _drChartPan.startX;
    var xRange = (d.baseXMax - d.baseXMin) / z.scale;
    z.cx = _drChartPan.startCX - dx / d.plotW * xRange;
    _drRedrawChart(canvas);
    return;
  }

  // Tooltip + crosshair
  var tooltip = document.getElementById(canvas.id + '-tooltip');
  var crossV = document.getElementById(canvas.id + '-crossV');
  var crossH = document.getElementById(canvas.id + '-crossH');

  if(mx < d.padL || mx > d.W - d.padR || my < d.padT || my > d.H - d.padB) {
    if(tooltip) tooltip.classList.remove('visible');
    if(crossV) crossV.style.display = 'none';
    if(crossH) crossH.style.display = 'none';
    return;
  }

  if(crossV) { crossV.style.display = 'block'; crossV.style.left = mx + 'px'; }
  if(crossH) { crossH.style.display = 'block'; crossH.style.top = my + 'px'; }

  // Her veri noktasına piksel mesafesini hesapla (RPM ve Eğim çizgileri)
  var steps = d.data;
  var best = null, bestPxDist = Infinity;
  for(var si = 0; si < steps.length; si++) {
    var s = steps[si];
    var spx = d.padL + (s.speed - d.xMin) / (d.xMax - d.xMin) * d.plotW;
    // RPM çizgisi noktası
    var rpmy = d.padT + d.plotH - ((s.engineRPM - d.yMin) / (d.yMax - d.yMin)) * d.plotH;
    var distR = Math.sqrt((mx - spx) * (mx - spx) + (my - rpmy) * (my - rpmy));
    if(distR < bestPxDist) { bestPxDist = distR; best = s; }
    // Eğim çizgisi noktası
    var gry = d.padT + d.plotH - ((s.netGrade - d.yGrMin) / (d.yGrMax - d.yGrMin)) * d.plotH;
    var distG = Math.sqrt((mx - spx) * (mx - spx) + (my - gry) * (my - gry));
    if(distG < bestPxDist) { bestPxDist = distG; best = s; }
  }

  if(tooltip && best && bestPxDist <= _DR_SNAP_DIST) {
    var ttHTML = '<span style="color:#fff; font-weight:600;">' + best.gear + '</span> — ' + best.speed.toFixed(1) + ' km/h<br>';
    ttHTML += '<span style="color:#7db3e8;">Motor:</span> ' + Math.round(best.engineRPM) + ' rpm<br>';
    ttHTML += '<span style="color:#e88e8e;">Eğim:</span> ' + best.netGrade.toFixed(2) + '%<br>';
    ttHTML += '<span style="color:#ccc;">TE:</span> ' + best.te.toFixed(2) + ' kN  <span style="color:#ccc;">DP:</span> ' + best.dp.toFixed(2) + ' kN';
    tooltip.innerHTML = ttHTML;
    tooltip.classList.add('visible');
    var tx = mx + 14, ty = my - 10;
    if(tx + 200 > d.W) tx = mx - 180;
    tooltip.style.left = tx + 'px';
    tooltip.style.top = ty + 'px';
  } else if(tooltip) {
    tooltip.classList.remove('visible');
  }
}

// Arama artık DOM'u gizleyip göstermiyor: sorgu ağacın durumuna yazılır ve
// ağaç yeniden çizilir. Böylece eşleşme vurgulanır, eşleşen gruplar kendiliğinden
// açılır ve boş kalan gruplar tamamen düşer.
function veFilterResultsTree(query) {
  if(typeof veSigSetQuery === 'function') veSigSetQuery(query);
}

// ===== SONUÇLAR: ÖLÇÜM PANOSU =====
//
// Sonuçlar sayfası TEK bir ölçüm penceresi üzerinde çalışır (js/trace-view.js).
// Panel ızgarası ve "Panel düzenini seçin" ekranı KALDIRILDI: kullanıcıdan
// ölçümden ÖNCE kaç panel istediğini seçmesini beklemek, cevabını kimsenin
// bilmediği bir soruydu — kaç sinyale bakacağı ancak bakarken belli oluyor.
// Sinyaller artık panele değil, alt alta ŞERİTLERE düşüyor; her şeridin kendi
// Y ekseni var, hepsi tek zaman eksenini paylaşıyor.
//
// veResultSlots dizisi 4 uzunlukta KALIR: eski proje dosyaları resultSlots'u
// bu şekilde saklıyor ve yükleme yolu bozulmamalı. Yalnızca index 0 (VE_BOARD)
// kullanılır; eski dosyalarda 1..3'e dağılmış sinyaller veTrMigrateSlots() ile
// panoya taşınır, hiçbiri kaybolmaz.
var veResultSlots = [{},{},{},{}];

// Sonuçlar sekmesine girişin tek kapısı: veri ağacını tazeler, ölçüm
// penceresini kurar. Eskiden burada bir düzen seçici dallanması vardı.
function veEnterResults() {
  // Takoz sonucu oturumluk, pano ise kalıcı — sayfa açılışında ikisini uzlaştır.
  // Kullanıcı sessizce kaybolan şeritlere bakmasın diye düşenler bildirilir.
  var _mntDropped = veMntSyncBoard();
  if(_mntDropped && typeof showToast === 'function') {
    showToast(_mntDropped + ' takoz kanalı güncel çözümde yok — ölçüm penceresinden düşürüldü. ' +
              'Takoz alt topolojisinde ▶ Hesapla ile yeniden çözün.', 'warning');
  }
  if(typeof veUpdateSolverTabs === 'function') veUpdateSolverTabs();
  // Proje dosyası şerit listesini saklar ama ölçüm verisini saklamaz (ham
  // ölçüm onlarca MB olabilir). Yeniden açılışta artık var olmayan bir veri
  // kümesine bakan şeritler sonsuza dek "veri yok" gösterirdi — temizlenir.
  if(typeof veImpPruneSlots === 'function') {
    var dropped = veImpPruneSlots(veResultSlots);
    if(dropped > 0 && typeof showToast === 'function') {
      showToast(dropped + ' şerit kaldırıldı: içe aktarılan ölçüm verisi bu oturumda yok. ' +
                'Dosyayı yeniden içe aktarın.', 'info');
    }
  }
  veUpdateResultsTree();
  if(typeof veTrEnter === 'function') veTrEnter();
  veInitResultSlots();
}

// Veri Gezgini'nin genişlik ayırıcısı. Panel satır/sütun ayırıcıları
// (veInitRowResizer / veInitColResizers) panel ızgarasıyla birlikte kalktı.
function veInitResultSlots() {
  var br = document.getElementById('ve-results-browser-resizer');
  var bp = document.getElementById('ve-results-browser');
  if(!br || !bp || br._init) return;
  br._init = true;
  var resizing = false, startX, startW;
  br.addEventListener('mousedown', function(e) {
    resizing = true; startX = e.clientX; startW = bp.offsetWidth;
    document.body.style.cursor = 'ew-resize'; document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e) {
    if(!resizing) return;
    bp.style.width = Math.max(160, Math.min(400, startW + (e.clientX - startX))) + 'px';
  });
  document.addEventListener('mouseup', function() {
    if(!resizing) return;
    resizing = false;
    document.body.style.cursor = ''; document.body.style.userSelect = '';
    // Ölçüm penceresinin genişliği değişti — zaman ekseni yeniden hizalanmalı
    if(typeof veTrRenderSoon === 'function') veTrRenderSoon();
  });
}

// Çözüm bitince / sekme değişince / proje yüklenince çağrılan tazeleme kapısı.
// Adı korunuyor: js/topology.js, js/graphics.js ve js/ft-segment-drive.js
// buradan geçiyor.
function veRefreshAllCharts() {
  if(typeof veTrRefresh === 'function') veTrRefresh();
}

// Sensor drag
var veDraggingSensor = null;
var veDraggingSignal = null;

// Sürükle-bırak hedefi ARTIK TEK: ölçüm penceresi. Eskiden dört panel vardı
// ve her sürüklemede dördü birden taranıp "üzerindeyim" vurgusu hesaplanıyordu;
// kullanıcı da sinyali hangi panele bırakacağına karar vermek zorundaydı.
// Şimdi bırakma noktasının tek anlamı var: ŞERİDİN üzerine bırakılırsa o
// şeride katılır (ortak Y ekseni), boşluğa bırakılırsa kendi şeridini açar.
// Ortak gövde: fare hareketinde vurgula, bırakınca uygula.
function veTrDragSession(e, onDrop) {
  if(e.button !== 0) return;
  e.preventDefault();

  var moveHandler = function(ev) {
    if(typeof veTrHighlightDrop === 'function') veTrHighlightDrop(ev.clientX, ev.clientY);
  };
  var upHandler = function(ev) {
    document.removeEventListener('mousemove', moveHandler);
    document.removeEventListener('mouseup', upHandler);
    var host = document.getElementById('ve-trace');
    if(host) host.classList.remove('drop-active');
    if(typeof veTrIsOver === 'function' && veTrIsOver(ev.clientX, ev.clientY)) onDrop(ev);
  };
  document.addEventListener('mousemove', moveHandler);
  document.addEventListener('mouseup', upHandler);
}

function veStartSensorDrag(e, sensorId) {
  veDraggingSensor = sensorId;
  veDraggingSignal = null;   // tüm sinyaller modu
  veTrDragSession(e, function() {
    veAddSensorToSlot(VE_BOARD, sensorId);
    veDraggingSensor = null;
  });
}

// Tek sinyal sürükleme — bırakıldığı şeride katılır.
function veStartSignalDrag(e, sensorId, signalId) {
  veDraggingSensor = sensorId;
  veDraggingSignal = signalId;
  veTrDragSession(e, function(ev) {
    if(typeof veTrDropSignal === 'function') veTrDropSignal(ev.clientX, ev.clientY, sensorId, signalId);
    else veAddSignalToSlot(VE_BOARD, sensorId, signalId);
    veDraggingSensor = null;
    veDraggingSignal = null;
  });
}

// ── Sihirbaz diyagramı sürükleme ──
var veDraggingWizDiag = null; // { pkgId, diagIdx }

function veStartWizardDiagDrag(e, pkgId, diagIdx) {
  veDraggingWizDiag = { pkgId: pkgId, diagIdx: diagIdx };
  veTrDragSession(e, function() {
    veAddWizardDiagramToSlot(VE_BOARD, pkgId, diagIdx);
    veDraggingWizDiag = null;
  });
}

// ═══ ORTAK X EKSENİ — pano genelinde tek eksen ═══
// Kural ve kimlik hesabı js/measure-core.js'te; buradakiler sonuç panosunun
// bırakma (drop) yollarında o kuralı uygulayan ince sarmalayıcılardır.

// Bir sihirbaz diyagramının gerektirdiği X ekseni tanımı.
function veWizDiagXAxis(sigDef) {
  if(!sigDef || !sigDef.x) return { id:'time', name:'Zaman [s]', unit:'s' };
  if(sigDef.x.target === 'time') return { id:'time', name:'Zaman [s]', unit:'s' };
  return {
    id: '~' + sigDef.x.target + ':' + sigDef.x.signal,
    name: (sigDef.x.name || sigDef.x.signal) + ' [' + (sigDef.x.unit || '') + ']',
    unit: sigDef.x.unit || ''
  };
}

// Boş panele düşen sinyal panonun eksenini devralır; pano boşsa zaman ekseni.
// (Sinyallerin kendi X ekseni yoktur — hangi eksende çizileceklerini pano söyler.)
function veInheritedXAxis(slotIdx) {
  var b = (typeof veSharedXAxis === 'function') ? veSharedXAxis(veResultSlots) : null;
  if(b && b.xAxis) {
    var copy = Object.assign({}, b.xAxis);
    if(b.dataSource && slotIdx !== undefined) veResultSlots[slotIdx]._dataSource = b.dataSource;
    return copy;
  }
  var solver = (nodes || []).find(function(n) { return n.type === 'solver'; });
  var tm = solver && solver.data ? (solver.data.timeMode || 'duration') : 'duration';
  return { id: 'time', name: tm === 'stop' ? 'Zaman [s] (Durma)' : 'Zaman [s]', unit: 's' };
}

// Pano ekseni değiştikten sonra çağrılır. Tek işi kaldı: eksen KİMLİĞİ
// değiştiyse Veri Gezgini'ni tazeler, böylece o eksene uymayan sihirbaz
// diyagramları kilitli görünür. Ağacın yeniden kurulması kullanıcının açtığı
// dalları kapattığı için koşulsuz tazelemek rahatsız edici olurdu.
//
// İkinci işi (pano marjını tüm panellerde hizalamak) panel ızgarasıyla
// birlikte kalktı — tek yüzeyde hizalanacak ikinci bir plot alanı yok.
var _veLastBoardXKey = null;
function veSyncBoardState() {
  var k = (typeof veSharedXKey === 'function') ? veSharedXKey(veResultSlots) : null;
  if(k === _veLastBoardXKey) return;
  _veLastBoardXKey = k;
  if(typeof veUpdateResultsTree === 'function') veUpdateResultsTree();
}

// Uyumsuz bırakma uyarısı — hangi eksenin geçerli olduğunu ve nasıl
// değiştirileceğini söyler, yoksa kullanıcı neden reddedildiğini bilemez.
function veWarnXAxisMismatch(wantedXAxis) {
  if(typeof showToast !== 'function') return;
  var b = (typeof veSharedXAxis === 'function') ? veSharedXAxis(veResultSlots) : null;
  var cur = (b && b.xAxis && b.xAxis.name) ? b.xAxis.name : 'Zaman [s]';
  var want = (wantedXAxis && wantedXAxis.name) ? wantedXAxis.name : 'farklı bir eksen';
  showToast('Pano X ekseni: ' + cur + ' — bu öğe ' + want +
            ' istiyor. Değiştirmek için ölçüm penceresinin X ekseni seçicisini kullanın.',
            'warning');
}

// İçe aktarılan ölçüm panosuna simülasyon sinyali giremez.
// Gerekçe: ölçümün KENDİ zaman dizisi vardır (dosyadan gelir) ve seriler
// veGetSensorData'da indeks hizasıyla çizilir. Sim sinyali böyle bir panoya
// girerse ölçümün zaman ekseni üzerinde, hiç ilgisi olmayan bir eğri olarak
// sessizce çizilirdi. Ters yön (ölçüm → sim panosu) veXAxisAllowed ile zaten
// kapalı; bu koşu simülasyon tarafında aynı kapıyı kurar.
function veImpBoardRejects(slotIdx) {
  if(typeof veSharedXKey !== 'function') return false;
  var key = veSharedXKey(veResultSlots);
  if(!key || String(key).indexOf('@import:') < 0) return false;
  if(typeof veWarnXAxisMismatch === 'function') veWarnXAxisMismatch({ name: 'Zaman [s]' });
  return true;
}

function veAddWizardDiagramToSlot(slotIdx, pkgId, diagIdx) {
  var pkg = (typeof SENSOR_PACKAGES !== 'undefined') ? SENSOR_PACKAGES.find(function(p) { return p.id === pkgId; }) : null;
  if(!pkg || !pkg.diagrams[diagIdx]) return;
  var diag = pkg.diagrams[diagIdx];
  var sigDef = (typeof SW_DIAGRAM_SIGNALS !== 'undefined') ? SW_DIAGRAM_SIGNALS[diag.id] : null;
  if(!sigDef) {
    if(typeof showToast === 'function') showToast('Bu diyagram için sinyal haritası tanımlı değil', 'warning');
    return;
  }

  var slot = veResultSlots[slotIdx];
  var is3D = !!sigDef.z;

  // ── Ortak X ekseni kuralı ──
  // Pano tek bir X ekseni üzerinde çalışır (bkz. js/chart-cursor.js). Farklı
  // eksen isteyen bir diyagram bırakılırsa reddedilir — aksi halde imleç o
  // panelde ortak olamazdı. 3D panel muaf (X/Y/Z üç sinyalden gelir).
  if(!is3D && typeof veXAxisAllowed === 'function') {
    var dropX = veWizDiagXAxis(sigDef);
    if(!veXAxisAllowed(dropX, sigDef.dataSource || '', veResultSlots)) {
      veWarnXAxisMismatch(dropX);
      return;
    }
  }

  // Slot'u temizle ve yeni diyagram ile doldur
  slot.type = is3D ? 'scatter3d' : 'line';
  slot.sensors = [];
  slot.yAxisLock = {};
  delete slot.zAxis;
  slot.lanes = [];
  // Yeni diyagram yeni bir zaman aralığı getirebilir — görünüm penceresi sıfırlanır
  if(typeof veTrResetView === 'function') veTrResetView();

  // dataSource etiketi (segmentDrive, obstacleDynamic vb.)
  var ds = sigDef.dataSource || null;
  if(ds) slot._dataSource = ds;
  else delete slot._dataSource;

  // Sinyal oluşturma yardımcı fonksiyonu
  function makeSensorEntry(def) {
    if(def.target === 'time') {
      return { id:'~time', signal:'time', name:'Zaman', unit:'s' };
    }
    return {
      id: '~' + def.target,
      signal: def.signal,
      name: def.name || def.signal,
      unit: def.unit || ''
    };
  }

  if(is3D) {
    // scatter3d: sensors[0]=X, sensors[1]=Y, sensors[2]=Z
    var xEntry = makeSensorEntry(sigDef.x);
    var yEntry = makeSensorEntry(sigDef.y[0]);
    var zEntry = makeSensorEntry(sigDef.z);
    if(ds) { xEntry._dataSource = ds; yEntry._dataSource = ds; zEntry._dataSource = ds; }
    slot.sensors = [xEntry, yEntry, zEntry];
    // scatter3d X ekseni ilk sensörden gelir, ama uyumluluk için xAxis de ayarla
    slot.xAxis = { id: xEntry.id + ':' + xEntry.signal, name: xEntry.name + ' [' + xEntry.unit + ']', unit: xEntry.unit };
  } else {
    // 2D: X ekseni ayarla
    slot.xAxis = veWizDiagXAxis(sigDef);
    if(ds && slot.xAxis.id !== 'time') slot.xAxis._dataSource = ds;

    // Y eksen sinyallerini ekle
    sigDef.y.forEach(function(ySig) {
      var entry = makeSensorEntry(ySig);
      if(ds) entry._dataSource = ds;
      if(!slot.sensors.some(function(s) { return s.id === entry.id && s.signal === entry.signal; })) {
        slot.sensors.push(entry);
      }
    });
  }

  if(typeof veTrRefresh === 'function') veTrRefresh(); else veRenderSlot(slotIdx);
  veSyncBoardState();   // pano ekseni / marjı değişti mi → ağaç + grafikler
  if(typeof showToast === 'function') showToast(diag.name + ' diyagramı eklendi', 'success');
}

// Tek sinyal slot'a ekle
function veAddSignalToSlot(slotIdx, sensorId, signalId) {
  var tabNodes = nodes;
  var tabConns = connections;
  var rawSensorId = sensorId;
  var lookupId = sensorId;

  // ── İçe aktarılan ölçüm: #veriKümesiId ──
  // Kendi zaman eksenini getirir, bu yüzden slot._dataSource ve xAxis birlikte
  // kurulur. Tek-X-ekseni kuralı (js/measure-core.js) böylece kendiliğinden
  // korunur: farklı bir eksendeki panoya bırakılırsa reddedilir.
  if(sensorId.charAt(0) === '#') {
    var impDs = (typeof veImpFind === 'function') ? veImpFind(veImpIdOf(sensorId)) : null;
    if(!impDs) return;
    var impCol = veImpColumn(impDs, signalId);
    if(!impCol) return;

    var iSlot = veResultSlots[slotIdx];
    if(!iSlot.sensors) iSlot.sensors = [];
    if(!iSlot.type) iSlot.type = 'line';

    var impX = {
      id: 'time',
      name: impDs.x.name + (impDs.x.unit ? ' [' + impDs.x.unit + ']' : ''),
      unit: impDs.x.unit || '',
      _dataSource: impDs.dataSource
    };
    if(typeof veXAxisAllowed === 'function' &&
       !veXAxisAllowed(impX, impDs.dataSource, veResultSlots)) {
      veWarnXAxisMismatch(impX);
      return;
    }

    if(iSlot.sensors.some(function(s) { return s.id === rawSensorId && s.signal === signalId; })) return;

    iSlot.xAxis = impX;
    iSlot._dataSource = impDs.dataSource;
    iSlot.sensors.push({
      id: rawSensorId,
      name: impCol.name,
      unit: impCol.unit || '',
      signal: signalId,
      _dataSource: impDs.dataSource
    });
    if(typeof veTrRefresh === 'function') veTrRefresh(); else veRenderSlot(slotIdx);
    veSyncBoardState();
    if(typeof veSigRefreshTree === 'function') veSigRefreshTree();
    return;
  }

  // ── Takoz kanalı: ~mnt-<küme> formatı ──
  // Takoz kanalının X ekseni KENDİ veri kümesinden gelir (frekans / deformasyon
  // / ivme); panodan DEVRALINMAZ. Pano başka bir eksende çalışıyorsa bırakma
  // reddedilir: 240 noktalık bir FRF eğrisini 500 örneklik zaman eksenine
  // çizmek sessizce yanlış bir eğri üretirdi ve kullanıcı bunu fark edemezdi.
  if(typeof veMntSignals !== 'undefined' && veMntSignals.isMountSensor(sensorId)) {
    var mntSets = veMntSets();
    var mntDs = veMntSignals.setOf(mntSets, sensorId);
    var mntCh = veMntSignals.channelOf(mntSets, sensorId, signalId);
    if(!mntDs || !mntCh) return;
    var mntX = veMntSignals.xAxisOf(mntDs);
    var mSlot = veResultSlots[slotIdx];
    if(!mSlot.sensors) mSlot.sensors = [];
    if(!mSlot.type) mSlot.type = 'line';
    if(typeof veXAxisAllowed === 'function' && !veXAxisAllowed(mntX, '', veResultSlots)) {
      veWarnXAxisMismatch(mntX);
      return;
    }
    if(mSlot.sensors.length === 0) {
      // Yeni X ALANI geliyor (Hz / mm / g). Önceki alandan kalan yakınlaştırma
      // penceresi korunursa eğrinin tamamı ekran dışında kalır ve kullanıcı
      // boş ama çerçeveli bir şerit görür — "veri yok" yazısı da çıkmaz, çünkü
      // veri vardır. Eksen değişen her yol gibi burası da görünümü sıfırlar.
      mSlot.xAxis = mntX;
      if(typeof veTrResetView === 'function') veTrResetView();
    }
    if(mSlot.sensors.some(function(s) { return s.id === sensorId && s.signal === signalId; })) return;
    mSlot.sensors.push({ id: sensorId, name: mntCh.name, unit: mntCh.unit || '', signal: signalId });
    if(typeof veTrRefresh === 'function') veTrRefresh(); else veRenderSlot(slotIdx);
    veSyncBoardState();
    if(typeof veSigRefreshTree === 'function') veSigRefreshTree();
    return;
  }

  // Buradan aşağısı simülasyon sinyalleridir: içe aktarma panosuna giremezler.
  if(veImpBoardRejects(slotIdx)) return;

  // ── Sihirbaz sanal sensörü: ~compType formatı ──
  if(sensorId.charAt(0) === '~') {
    var compType = sensorId.substring(1);
    var slot = veResultSlots[slotIdx];
    if(!slot.sensors) slot.sensors = [];
    if(!slot.type) slot.type = 'line';

    // X ekseni: panonun ortak ekseni devralınır (pano boşsa zaman)
    if(slot.sensors.length === 0) {
      slot.xAxis = veInheritedXAxis(slotIdx);
    }

    // Çakışma kontrolü
    if(slot.sensors.some(function(s) { return s.id === rawSensorId && s.signal === signalId; })) return;

    // Sinyal bilgisini bul
    var sigInfo = null;
    if(COMPONENT_SIGNALS[compType]) {
      sigInfo = (COMPONENT_SIGNALS[compType].outputs || []).find(function(s) { return s.id === signalId; });
    }

    var compName = componentDefs[compType] ? componentDefs[compType].name : compType;
    var displayName = '[SW] ' + compName + ' — ' + (sigInfo ? sigInfo.name : signalId);
    slot.sensors.push({ id: rawSensorId, name: displayName, unit: sigInfo ? sigInfo.unit : '', signal: signalId });
    if(typeof veTrRefresh === 'function') veTrRefresh(); else veRenderSlot(slotIdx);
    veSyncBoardState();   // pano ekseni / marjı değişti mi → ağaç + grafikler
    if(typeof veSigRefreshTree === 'function') veSigRefreshTree();
    return;
  }

  if(sensorId.charAt(0) === '@') {
    var parts = sensorId.substring(1).split(':');
    var tabIdx = parseInt(parts[0]);
    lookupId = parts.slice(1).join(':');
    var tab = veTabs[tabIdx];
    if(tab && tab.state) {
      tabNodes = tab.state.nodes || [];
      tabConns = tab.state.connections || [];
    }
  }
  
  var sensor = tabNodes.find(function(n) { return n.id === lookupId; });
  if(!sensor) return;
  
  var slot = veResultSlots[slotIdx];
  if(!slot.sensors) slot.sensors = [];
  if(!slot.type) slot.type = 'line';
  
  // X ekseni: panonun ortak ekseni devralınır (pano boşsa zaman)
  if(slot.sensors.length === 0) {
    slot.xAxis = veInheritedXAxis(slotIdx);
  }
  
  // Zaten ekli mi kontrol
  if(slot.sensors.some(function(s) { return s.id === rawSensorId && s.signal === signalId; })) return;
  
  // Kaynak bileşen tipini bul
  var sourceType = '';
  var sourceName = '';
  if(sensor.data && sensor.data.attachedConnection) {
    var conn = tabConns.find(function(c) { return c.id === sensor.data.attachedConnection; });
    if(conn) {
      var dir = sensor.data.sensorDirection || 'from';
      var srcNode = tabNodes.find(function(n) { return n.id === (dir === 'to' ? conn.to : conn.from); });
      if(srcNode) {
        sourceType = srcNode.type;
        sourceName = srcNode.customName || (componentDefs[srcNode.type] ? componentDefs[srcNode.type].name : srcNode.type);
      }
    }
  }
  if(!sourceType && sensor.data && sensor.data.attachedComponent) {
    var compN = tabNodes.find(function(n) { return n.id === sensor.data.attachedComponent; });
    if(compN) {
      sourceType = compN.type;
      sourceName = compN.customName || (componentDefs[compN.type] ? componentDefs[compN.type].name : compN.type);
    }
  }
  
  var sigInfo = null;
  if(sourceType && COMPONENT_SIGNALS[sourceType]) {
    sigInfo = (COMPONENT_SIGNALS[sourceType].outputs || []).find(function(s) { return s.id === signalId; });
  }
  
  var tabPrefix = '';
  if(rawSensorId.charAt(0) === '@') {
    var tIdx = parseInt(rawSensorId.substring(1).split(':')[0]);
    tabPrefix = '[' + (veTabs[tIdx] ? veTabs[tIdx].name : ('Tab ' + tIdx)) + '] ';
  }
  
  var displayName = tabPrefix + sourceName + ' — ' + (sigInfo ? sigInfo.name : signalId);
  slot.sensors.push({ id: rawSensorId, name: displayName, unit: sigInfo ? sigInfo.unit : '', signal: signalId });

  if(typeof veTrRefresh === 'function') veTrRefresh(); else veRenderSlot(slotIdx);
  veSyncBoardState();   // pano ekseni / marjı değişti mi → ağaç + grafikler
  // Sürükle-bırak ile de eklenebiliyor: ağaçtaki onay kutusu işaretlensin
  if(typeof veSigRefreshTree === 'function') veSigRefreshTree();
}

function veAddSensorToSlot(slotIdx, sensorId) {
  // ── İçe aktarılan ölçüm: #veriKümesiId — tüm sütunları ekle ──
  // Ağaçtaki grup başlığı bu ID ile sürüklenir; dal olmadan sessiz bir
  // hiçbir-şey-yapma davranışı oluşuyordu.
  if(sensorId.charAt(0) === '#') {
    var impSet = (typeof veImpFind === 'function') ? veImpFind(veImpIdOf(sensorId)) : null;
    if(!impSet) return;
    impSet.columns.forEach(function(c) { veAddSignalToSlot(slotIdx, sensorId, c.key); });
    return;
  }

  // ── Takoz veri kümesi: ~mnt-<küme> — kümenin tüm kanallarını ekle ──
  // Grup sürüklemesi ile grup onay kutusu (veSigToggleGroup) AYNI sonucu
  // vermeli; ikisi de tek kanal ekleyen yoldan geçer, eksen kuralı orada bir
  // kez uygulanır.
  if(typeof veMntSignals !== 'undefined' && veMntSignals.isMountSensor(sensorId)) {
    var mntDs = veMntSignals.setOf(veMntSets(), sensorId);
    if(!mntDs) return;
    mntDs.channels.forEach(function(ch) { veAddSignalToSlot(slotIdx, sensorId, ch.id); });
    return;
  }

  // ── Sihirbaz sanal sensörü: ~compType formatı — tüm sinyalleri ekle ──
  if(sensorId.charAt(0) === '~') {
    var compType = sensorId.substring(1);
    var allSigs = (COMPONENT_SIGNALS[compType] || {}).outputs || [];
    allSigs.forEach(function(sig) {
      veAddSignalToSlot(slotIdx, sensorId, sig.id);
    });
    return;
  }

  // Cross-tab sensör desteği
  var tabNodes = nodes;
  var tabConns = connections;
  var rawSensorId = sensorId; // orijinal ID (prefix dahil)
  var lookupId = sensorId;

  if(sensorId.charAt(0) === '@') {
    var parts = sensorId.substring(1).split(':');
    var tabIdx = parseInt(parts[0]);
    lookupId = parts.slice(1).join(':');
    var tab = veTabs[tabIdx];
    if(tab && tab.state) {
      tabNodes = tab.state.nodes || [];
      tabConns = tab.state.connections || [];
    }
  }
  
  var sensor = tabNodes.find(function(n) { return n.id === lookupId; });
  if(!sensor) return;
  
  var slot = veResultSlots[slotIdx];
  if(!slot.sensors) slot.sensors = [];
  if(!slot.type) slot.type = 'line';
  
  // X ekseni: panonun ortak ekseni devralınır (pano boşsa zaman)
  if(slot.sensors.length === 0) {
    slot.xAxis = veInheritedXAxis(slotIdx);
  }
  
  // Kaynak bileşen tipini ve mevcut sinyalleri bul
  var sourceType = '';
  var sourceName = '';
  var availableSignals = [];
  
  if(sensor.data && sensor.data.attachedConnection) {
    var conn = tabConns.find(function(c) { return c.id === sensor.data.attachedConnection; });
    if(conn) {
      var dir = sensor.data.sensorDirection || 'from';
      var srcNode = tabNodes.find(function(n) { return n.id === (dir === 'to' ? conn.to : conn.from); });
      if(srcNode) {
        sourceType = srcNode.type;
        sourceName = srcNode.customName || (componentDefs[srcNode.type] ? componentDefs[srcNode.type].name : srcNode.type);
      }
    }
  }
  if(!sourceType && sensor.data && sensor.data.attachedComponent) {
    var compN = tabNodes.find(function(n) { return n.id === sensor.data.attachedComponent; });
    if(compN) {
      sourceType = compN.type;
      sourceName = compN.customName || (componentDefs[compN.type] ? componentDefs[compN.type].name : compN.type);
    }
  }
  
  if(sourceType && COMPONENT_SIGNALS[sourceType]) {
    var allSigs = COMPONENT_SIGNALS[sourceType].outputs || [];
    // Bağlantı yönüne göre filtrele
    if(sensor.data && sensor.data.attachedConnection) {
      var sDir = sensor.data.sensorDirection || 'from';
      availableSignals = allSigs.filter(function(sig) {
        var id = sig.id;
        var hasIn = id.length > 3 && id.substring(id.length - 3) === '_in';
        if(sDir === 'from') return !hasIn;
        else return hasIn;
      });
    } else {
      availableSignals = allSigs;
    }
  }
  
  // Tüm sinyalleri ayrı ayrı ekle
  if(availableSignals.length === 0) {
    // Fallback: tek sinyal (eski davranış)
    var sig = sensor.data ? sensor.data.selectedSignal : '';
    if(!sig) return;
    if(slot.sensors.some(function(s) { return s.id === rawSensorId && s.signal === sig; })) return;
    var sigInfo = null;
    if(sourceType && COMPONENT_SIGNALS[sourceType]) {
      sigInfo = (COMPONENT_SIGNALS[sourceType].outputs || []).find(function(s) { return s.id === sig; });
    }
    var displayName = sensor.customName || (sigInfo ? sigInfo.name : 'Sensor');
    if(rawSensorId.charAt(0) === '@') {
      var tIdx2 = parseInt(rawSensorId.substring(1).split(':')[0]);
      var tName2 = veTabs[tIdx2] ? veTabs[tIdx2].name : ('Tab ' + tIdx2);
      displayName = '[' + tName2 + '] ' + displayName;
    }
    slot.sensors.push({ id: rawSensorId, name: displayName, unit: sigInfo ? sigInfo.unit : '', signal: sig });
  } else {
    // Cross-tab prefix
    var tabPrefix = '';
    if(rawSensorId.charAt(0) === '@') {
      var tIdx3 = parseInt(rawSensorId.substring(1).split(':')[0]);
      tabPrefix = '[' + (veTabs[tIdx3] ? veTabs[tIdx3].name : ('Tab ' + tIdx3)) + '] ';
    }
    
    // selectedSignals varsa sadece seçilenleri ekle
    var selectedSignals = sensor.data ? sensor.data.selectedSignals : null;
    
    availableSignals.forEach(function(sig) {
      // selectedSignals tanımlıysa ve bu sinyal seçili değilse atla
      if(selectedSignals && selectedSignals.length > 0 && selectedSignals.indexOf(sig.id) < 0) return;
      // Zaten ekli mi kontrol
      if(slot.sensors.some(function(s) { return s.id === rawSensorId && s.signal === sig.id; })) return;
      var displayName = tabPrefix + sourceName + ' — ' + sig.name;
      slot.sensors.push({ id: rawSensorId, name: displayName, unit: sig.unit, signal: sig.id });
    });
  }
  
  if(typeof veTrRefresh === 'function') veTrRefresh(); else veRenderSlot(slotIdx);
}

// veSlotSetType / veSlotClear kaldırıldı: ikisi de panel kabuğunun
// (başlık sekmesi, daralt düğmesi, tip seçici) parçasıydı. Karşılıkları
// ölçüm penceresinde: veTrSetMode() ve veTrClear().

// TABLO ve 3B görünümlerinin gövdesi. ÇİZGİ GRAFİK ARTIK BURADA DEĞİL:
// onu ölçüm penceresi (js/trace-view.js) kendi canvas'ına, şerit şerit
// çiziyor. Geriye kalan iki görünüm panel kavramına değil slot VERİSİNE
// bağlıydı, bu yüzden aynen çalışıyor; hedef kap ('#ve-rslot-body-0') artık
// bir panel değil, ölçüm penceresinin tablo/3B sekmesi.
function veRenderSlot(slotIdx) {
  var slot = veResultSlots[slotIdx];
  var body = document.getElementById('ve-rslot-body-' + slotIdx);
  if(!body) return;

  var type = slot.type || 'line';
  if(type === 'line') {
    if(typeof veTrRender === 'function') veTrRender();
    return;
  }

  var sensors = slot.sensors || [];
  if(sensors.length === 0) {
    var emptyName = (type === 'scatter3d') ? '3B Dağılım' : 'Veri Tablosu';
    var emptyHint = (type === 'scatter3d')
      ? 'Veri Gezgini\'nden en az 2 sinyal seçin (X, Y). 3. sinyal Z olur.'
      : 'Veri Gezgini\'nden sinyal seçin.';
    body.innerHTML =
      '<div class="ve-trace-empty" style="display:flex;">' +
      '<div class="ve-trace-empty-ico"><span class="mf-ico mf-ico-' +
        (type === 'scatter3d' ? 'package' : 'clipboard') + '"></span></div>' +
      '<div class="ve-trace-empty-title">' + emptyName + ' boş</div>' +
      '<div class="ve-trace-empty-sub">' + emptyHint + '</div></div>';
    return;
  }

  var html = '<div class="ve-slot-assigned">';

  if(type === 'scatter3d') {
    html += '<div class="ve-slot-chart-area" id="ve-chart-area-' + slotIdx + '" style="overflow:hidden;">';
    html += '<div id="ve-3d-container-' + slotIdx + '" style="position:absolute;left:0;top:0;width:100%;height:100%;"></div>';
    html += '<div id="ve-chart-placeholder-' + slotIdx + '" style="color:var(--text-muted); font-size:var(--fs-md); text-align:center; padding:0 30px; z-index:1; pointer-events:none;">';
    html += '<div style="font-size:var(--fs-h1); margin-bottom:6px;"><span class="mf-ico mf-ico-package"></span></div>';
    html += (sensors.length < 2)
      ? 'En az 2 sinyal seçin (X, Y). 3. sinyal Z ekseni olur, yoksa zaman kullanılır.'
      : 'Simülasyon sonrası 3B grafik görünecek';
    html += '</div>';

    var axisLabels3d = ['X', 'Y', 'Z'];
    html += '<div class="ve-chart-legend-overlay" id="ve-chart-legend-' + slotIdx + '">';
    sensors.forEach(function(s, i) {
      var c = veSlotSignalColor(slot, i);
      var axisLabel = axisLabels3d[i] || '';
      html += '<span class="ve-slot-legend-item">';
      if(axisLabel) html += '<span style="font-weight:700; font-size:var(--fs-tiny); opacity:0.7; margin-right:2px;">' + axisLabel + ':</span>';
      html += '<span class="ve-legend-color-line" style="background:' + c + ';"></span>';
      html += '<span class="ve-legend-name">' + escapeHTML(s.name) + '</span>';
      if(s.unit) html += '<span class="ve-legend-unit">' + escapeHTML(s.unit) + '</span>';
      html += '<span class="ve-legend-remove" onclick="event.stopPropagation();veRemoveSensorFromSlot(' + slotIdx + ',' + i + ')" title="Kaldır">✕</span>';
      html += '</span>';
    });
    if(sensors.length === 2) {
      html += '<span class="ve-slot-legend-item"><span style="font-weight:700; font-size:var(--fs-tiny); opacity:0.7; margin-right:2px;">Z:</span>';
      html += '<span class="ve-legend-name">Zaman [s]</span></span>';
    }
    html += '</div>';
    html += '</div>';
  } else {
    html += '<div style="overflow:auto; width:100%; height:100%; flex:1;">';
    html += '<table id="ve-table-' + slotIdx + '" class="ve-result-table">';
    html += '<thead><tr>';
    html += '<th>#</th>';
    html += '<th>' + escapeHTML(slot.xAxis ? slot.xAxis.name : 'Zaman [s]') + '</th>';
    sensors.forEach(function(s, i) {
      html += '<th style="color:' + veSlotSignalColor(slot, i) + '; border-bottom:3px solid ' + veSlotSignalColor(slot, i) + ';">' + escapeHTML(s.name) + (s.unit ? ' [' + escapeHTML(s.unit) + ']' : '') + '</th>';
    });
    html += '</tr></thead>';
    html += '<tbody id="ve-table-body-' + slotIdx + '">';
    html += '<tr><td colspan="' + (sensors.length + 2) + '" style="padding:20px; text-align:center; color:var(--text-muted);">Simülasyon verisi bekleniyor</td></tr>';
    html += '</tbody></table></div>';
  }

  html += '</div>';
  body.innerHTML = html;

  // Takoz sekmesi araç çözümü olmadan da veri taşır: tablo/3B kipini yalnız
  // veSimResults'a bakarak kapatmak, o sekmede tabloyu kalıcı olarak
  // "Simülasyon verisi bekleniyor" durumunda bırakırdı (veri aslında hazır).
  var _haveData = !!window.veSimResults || veMntSets().length > 0;
  if(type === 'scatter3d') {
    if(_haveData) veRender3DScatter(slotIdx);
    veInitLegendDrag(slotIdx);
  } else {
    if(_haveData) veRenderTable(slotIdx);
  }
}

// ===== LEGEND SÜRÜKLEME (DRAG) =====
function veInitLegendDrag(slotIdx) {
  var legend = document.getElementById('ve-chart-legend-' + slotIdx);
  if(!legend) return;

  var isDragging = false;
  var startX = 0, startY = 0;
  var startLeft = 0, startBottom = 0;

  legend.addEventListener('mousedown', function(e) {
    // ✕ butonuna tıklanırsa sürükleme başlatma
    if(e.target.classList.contains('ve-legend-remove')) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    var style = window.getComputedStyle(legend);
    startLeft = parseInt(style.left) || 0;
    // bottom yerine top kullan (ilk seferde bottom'dan top'a dönüştür)
    if(!legend._usesTop) {
      var parent = legend.parentElement;
      var parentRect = parent.getBoundingClientRect();
      var legendRect = legend.getBoundingClientRect();
      var topVal = legendRect.top - parentRect.top;
      legend.style.bottom = 'auto';
      legend.style.top = topVal + 'px';
      legend._usesTop = true;
      startBottom = topVal; // artık top olarak kullanılıyor
    } else {
      startBottom = parseInt(legend.style.top) || 0;
    }
    legend.style.cursor = 'grabbing';
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', function(e) {
    if(!isDragging) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    var newLeft = startLeft + dx;
    var newTop = startBottom + dy;

    // Sınır kontrolü
    var parent = legend.parentElement;
    if(parent) {
      var pw = parent.clientWidth;
      var ph = parent.clientHeight;
      var lw = legend.offsetWidth;
      var lh = legend.offsetHeight;
      if(newLeft < 0) newLeft = 0;
      if(newLeft + lw > pw) newLeft = pw - lw;
      if(newTop < 0) newTop = 0;
      if(newTop + lh > ph) newTop = ph - lh;
    }

    legend.style.left = newLeft + 'px';
    legend.style.top = newTop + 'px';
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mouseup', function() {
    if(isDragging) {
      isDragging = false;
      legend.style.cursor = '';
    }
  });
}

// ===== LEJANTTAN SENSÖR KALDIRMA =====
function veRemoveSensorFromSlot(slotIdx, sensorIdx) {
  var slot = veResultSlots[slotIdx];
  if(!slot || !slot.sensors || sensorIdx < 0 || sensorIdx >= slot.sensors.length) return;
  slot.sensors.splice(sensorIdx, 1);
  // Eksen lock'larını sıfırla (birim grupları değişmiş olabilir)
  slot.yAxisLock = {};
  veImpDropStaleAxis(slot);
  if(typeof veTrRefresh === 'function') veTrRefresh(); else veRenderSlot(slotIdx);
  // Lejanttaki ✕ ile de silinebiliyor: ağaçtaki onay kutusu bayat kalmasın
  if(typeof veSigRefreshTree === 'function') veSigRefreshTree();
}

// ===== X EKSENİ SEÇİCİ (DROPDOWN) =====

// Slot'taki mevcut sinyaller + topolojideki tüm bileşen sinyallerini topla
function veGetAvailableXAxisOptions(slotIdx) {
  var slot = veResultSlots[slotIdx];
  var options = [];
  var currentId = (slot.xAxis && slot.xAxis.id) ? slot.xAxis.id : 'time';

  // Takoz sekmesinde zaman ekseni YOKTUR: kanalların hiçbiri zamana bağlı
  // değil (frekans / deformasyon / ivme). Zamanı seçenek olarak sunmak
  // kullanıcıyı boş bir eksene götürürdü. Onun yerine veri kümelerinin kendi
  // eksenleri listelenir — küme değiştirmek eksen değiştirmektir.
  if(veActiveSolverTabId === 'mount' && typeof veMntSignals !== 'undefined') {
    // YALNIZ UYUMLU EKSENLER. Panoda bir kümenin kanalları varken başka bir
    // kümenin eksenini sunmak, bırakma anında uygulanan tek-eksen kuralını
    // seçiciden ATLATIRDI: veSetSlotXAxis yalnız ekseni değiştirir, şeritlerin
    // verisine dokunmaz. Kümelerin uzunlukları da farklı (240 / 121 / 36), yani
    // 240 örneklik iletilebilirlik eğrisi 36 noktalık ivme ekseninde sessizce
    // kırpılıp çizilirdi — imleç "3 g'de iletilebilirlik" okurdu.
    var lockedTo = null;
    (veResultSlots || []).forEach(function(sl) {
      if(lockedTo || !sl || !sl.sensors || !sl.sensors.length) return;
      for(var i = 0; i < sl.sensors.length; i++) {
        if(veMntSignals.isMountSensor(sl.sensors[i].id)) { lockedTo = sl.sensors[i].id; return; }
      }
    });
    veMntSets().forEach(function(ds) {
      if(lockedTo && ds.sensorId !== lockedTo) return;
      var ax = veMntSignals.xAxisOf(ds);
      if(!ax) return;
      options.push({
        group: ds.name, id: ax.id, sensorId: ds.sensorId, signal: ds.x.id,
        name: ds.x.name, unit: ds.x.unit, active: currentId === ax.id
      });
    });
    return options;
  }

  // 1) Zaman ekseni (her zaman mevcut)
  options.push({ group: 'Varsayılan', id: 'time', name: 'Zaman', unit: 's', active: currentId === 'time' });

  // 2) Panodaki Y sinyallerinden (kullanıcı zaten eklemiş). Seçim tüm
  //    panelleri birden değiştirdiği için liste de pano geneli olmalı —
  //    yalnız bu panelin sinyalleri gösterilirse seçici yanıltıcı olurdu.
  var seenAx = {};
  veResultSlots.forEach(function(sl) {
    if(!sl || !sl.sensors || (sl.type || 'line') === 'scatter3d') return;
    sl.sensors.forEach(function(s) {
      var axId = s.id + ':' + s.signal;
      if(seenAx[axId]) return;
      seenAx[axId] = true;
      options.push({
        group: 'Panodaki Sinyaller',
        id: axId,
        sensorId: s.id,
        signal: s.signal,
        name: s.name,
        unit: s.unit || '',
        active: currentId === axId
      });
    });
  });

  // 3) Topolojideki bileşen sinyalleri
  var tabNodes = nodes || [];
  var compOrder = ['engine','torque-converter','gearbox','shift-controller','transfer','propshaft','differential','wheel','vehicle','road','solver'];
  var added = {};

  compOrder.forEach(function(compType) {
    var compNode = tabNodes.find(function(n) { return n.type === compType; });
    if(!compNode) return;
    var sigs = COMPONENT_SIGNALS[compType];
    if(!sigs || !sigs.outputs) return;
    var compName = componentDefs[compType] ? componentDefs[compType].name : compType;

    sigs.outputs.forEach(function(sig) {
      var axId = '~' + compType + ':' + sig.id;
      if(added[axId]) return;
      added[axId] = true;
      options.push({
        group: compName,
        id: axId,
        sensorId: '~' + compType,
        signal: sig.id,
        name: sig.name,
        unit: sig.unit || '',
        active: currentId === axId
      });
    });
  });

  // 4) Fiziksel sensörlerden
  var sensorNodes = tabNodes.filter(function(n) { return n.type === 'sensor'; });
  sensorNodes.forEach(function(sNode) {
    var sourceType = '';
    var sourceName = '';
    if(sNode.data && sNode.data.attachedConnection) {
      var conn = (connections || []).find(function(c) { return c.id === sNode.data.attachedConnection; });
      if(conn) {
        var dir = sNode.data.sensorDirection || 'from';
        var srcNode = tabNodes.find(function(n) { return n.id === (dir === 'to' ? conn.to : conn.from); });
        if(srcNode) {
          sourceType = srcNode.type;
          sourceName = srcNode.customName || (componentDefs[srcNode.type] ? componentDefs[srcNode.type].name : srcNode.type);
        }
      }
    }
    if(!sourceType && sNode.data && sNode.data.attachedComponent) {
      var compN = tabNodes.find(function(n) { return n.id === sNode.data.attachedComponent; });
      if(compN) {
        sourceType = compN.type;
        sourceName = compN.customName || (componentDefs[compN.type] ? componentDefs[compN.type].name : compN.type);
      }
    }
    if(!sourceType) return;

    var sigs = COMPONENT_SIGNALS[sourceType];
    if(!sigs || !sigs.outputs) return;
    var sensorLabel = sNode.customName || sourceName;

    sigs.outputs.forEach(function(sig) {
      var axId = sNode.id + ':' + sig.id;
      if(added[axId]) return;
      added[axId] = true;
      options.push({
        group: sensorLabel,
        id: axId,
        sensorId: sNode.id,
        signal: sig.id,
        name: sig.name,
        unit: sig.unit || '',
        active: currentId === axId
      });
    });
  });

  return options;
}

// Dropdown menüyü göster
// SİNYAL ADLARI KULLANICI VERİSİDİR: içe aktarılan Excel/CSV dosyasının
// başlık satırından geliyorlar ve HTML'e ham gömülemezler. Ölçüldü — başlığı
//   Basinc <img src=x onerror="...">
// olan bir CSV içe aktarılıp bu liste açıldığında <img> gerçekten DOM'a
// giriyor ve onerror ÇALIŞIYORDU. Kötü niyet gerekmez: '<' içeren bir başlık
// menüyü sessizce bozmaya zaten yetiyor (metin kayboluyor).
function veShowXAxisPicker(slotIdx, e) {
  if(e) e.stopPropagation();

  // Zaten açıksa kapat
  var existing = document.getElementById('ve-xaxis-dropdown-' + slotIdx);
  if(existing) { existing.remove(); return; }

  // Diğer açık dropdown'ları kapat
  document.querySelectorAll('.ve-xaxis-dropdown').forEach(function(d) { d.remove(); });

  // Dropdown'ın bağlanacağı parent: tablo modunda ve-xaxis-area, grafik modunda chart-area
  var area = document.getElementById('ve-xaxis-area-' + slotIdx);
  var chartArea = document.getElementById('ve-chart-area-' + slotIdx);
  var parentEl = area || chartArea;
  if(!parentEl) return;

  var options = veGetAvailableXAxisOptions(slotIdx);

  var html = '';
  var lastGroup = '';
  options.forEach(function(opt, i) {
    if(opt.group !== lastGroup) {
      lastGroup = opt.group;
      html += '<div class="ve-xaxis-dropdown-group">' + escapeHTML(opt.group) + '</div>';
    }
    html += '<div class="ve-xaxis-dropdown-item' + (opt.active ? ' active' : '') + '" ';
    html += 'onclick="veSetSlotXAxis(' + slotIdx + ',' + i + ');event.stopPropagation();" ';
    html += 'data-opt-idx="' + i + '">';
    html += '<span>' + (opt.active ? '● ' : '') + escapeHTML(opt.name) + '</span>';
    if(opt.unit) html += '<span class="ve-xaxis-unit">' + escapeHTML(opt.unit) + '</span>';
    html += '</div>';
  });

  var dd = document.createElement('div');
  dd.className = 've-xaxis-dropdown';
  dd.id = 've-xaxis-dropdown-' + slotIdx;
  dd.innerHTML = html;
  // Options verilerini dropdown'a bağla
  dd._options = options;

  // Grafik modunda (chart-area parent): dropdown'ı altta ortada konumla
  if(!area && chartArea) {
    dd.style.position = 'absolute';
    dd.style.bottom = '6px';
    dd.style.left = '50%';
    dd.style.transform = 'translateX(-50%)';
  }
  parentEl.appendChild(dd);

  // Dropdown dışına tıklayınca kapat
  setTimeout(function() {
    function closeHandler(ev) {
      if(!dd.contains(ev.target)) {
        dd.remove();
        document.removeEventListener('mousedown', closeHandler, true);
      }
    }
    document.addEventListener('mousedown', closeHandler, true);
  }, 0);
}

// X eksenini değiştir
function veSetSlotXAxis(slotIdx, optIdx) {
  var dd = document.getElementById('ve-xaxis-dropdown-' + slotIdx);
  if(!dd || !dd._options) return;
  var opt = dd._options[optIdx];
  if(!opt) return;

  // Yeni eksen tanımı
  var newAxis;
  if(opt.id === 'time') {
    newAxis = { id: 'time', name: 'Zaman [s]', unit: 's' };
  } else {
    newAxis = {
      id: opt.id,
      name: opt.name + ' [' + opt.unit + ']',
      unit: opt.unit,
      sensorId: opt.sensorId || null,
      signal: opt.signal || null
    };
  }

  // Dropdown kapat
  dd.remove();

  // ── Ortak X ekseni: seçim TÜM panelleri birden değiştirir ──
  // Pano tek eksen üzerinde çalıştığı için tek paneli ayırmak, imleci o
  // panelde ortak olmaktan çıkarırdı. 3D paneller muaf (kendi X/Y/Z'leri var).
  var changed = 0;
  for(var si = 0; si < veResultSlots.length; si++) {
    var s = veResultSlots[si];
    if(!s || !s.sensors || s.sensors.length === 0) continue;
    if((s.type || 'line') === 'scatter3d') continue;
    s.xAxis = Object.assign({}, newAxis);
    changed++;

    // X-axis etiketi ve tablo başlığı
    var btn = document.querySelector('#ve-xaxis-area-' + si + ' .ve-xaxis-btn span:first-child');
    if(btn) btn.textContent = s.xAxis.name;
    var th = document.querySelector('#ve-table-' + si + ' thead th:nth-child(2)');
    if(th) th.textContent = s.xAxis.name;

    // Takoz sekmesi araç çözümü olmadan da veri taşır (window.veMountResults);
    // yeniden çizim yalnız veSimResults'a bakarsa o sekmede eksen değişince
    // grafik eski eksende donardı.
    if(window.veSimResults || veMntSets().length) {
      if(s.type === 'line') {
        if(typeof veTrResetView === 'function') veTrResetView();
        if(typeof veTrRender === 'function') veTrRender();
      } else veRenderTable(si);
    }
  }

  // Eksen değişti — sabitlenmiş referans imleç ve görünüm penceresi artık
  // başka bir alana ait (zaman pini devir eksenine taşınmaz)
  if(typeof veTrResetView === 'function') veTrResetView();
  veSyncBoardState();

  if(changed && typeof showToast === 'function') {
    showToast('X ekseni ' + newAxis.name + ' olarak ayarlandı', 'info');
  }
}

// ===== CANVAS PAN/ZOOM (Gelişmiş canvasOffset sistemi aşağıda) =====
// Eski pan sistemi kaldırıldı - tüm pan/zoom canvasOffset ile yönetilir

// ===== SIDEBAR RESIZE =====
(function() {
  var sidebar = document.getElementById('ve-sidebar');
  var sidebarResizer = document.getElementById('ve-sidebar-resizer');
  if(!sidebar || !sidebarResizer) return;
  var sbResizing = false, sbStartX, sbStartW;
  var COMPACT_THRESHOLD = 100; // px altında compact mode
  
  function updateCompactMode(w) {
    if(w < COMPACT_THRESHOLD) {
      sidebar.classList.add('compact');
    } else {
      sidebar.classList.remove('compact');
    }
  }
  
  sidebarResizer.addEventListener('mousedown', function(e) {
    sbResizing = true; sbStartX = e.clientX; sbStartW = sidebar.offsetWidth;
    sidebarResizer.classList.add('active');
    sidebar.classList.add('ve-sb-no-anim'); // sürükleme sırasında geçişi kapat
    document.body.style.cursor = 'ew-resize'; document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e) {
    if(!sbResizing) return;
    var newW = Math.max(52, Math.min(360, sbStartW + (e.clientX - sbStartX)));
    sidebar.style.width = newW + 'px';
    updateCompactMode(newW);
  });
  document.addEventListener('mouseup', function() {
    if(sbResizing) { sbResizing = false; sidebarResizer.classList.remove('active'); sidebar.classList.remove('ve-sb-no-anim'); document.body.style.cursor = ''; document.body.style.userSelect = ''; }
  });
})();

// ===== BİLEŞENLER PANELİ DARALT / AÇ =====
// Paneli tamamen gizler; sol kenarda beliren ray ile geri açılır. Durum
// localStorage'a kaydedilir (profesyonel programlar gibi hatırlanır).
function veToggleSidebar(forceState) {
  var sidebar = document.getElementById('ve-sidebar');
  var reveal = document.getElementById('ve-sidebar-reveal');
  if(!sidebar) return;
  var collapsed = (typeof forceState === 'boolean')
    ? forceState
    : !sidebar.classList.contains('ve-sb-collapsed');
  sidebar.classList.toggle('ve-sb-collapsed', collapsed);
  try { localStorage.setItem('mf-sidebar-collapsed', collapsed ? '1' : '0'); } catch(e) {}
  if(reveal) {
    if(collapsed) {
      reveal.style.display = 'flex';
      // iki frame bekle → transform/opacity geçişi tetiklensin
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { reveal.classList.add('visible'); });
      });
    } else {
      reveal.classList.remove('visible');
      setTimeout(function() {
        if(!sidebar.classList.contains('ve-sb-collapsed')) reveal.style.display = 'none';
      }, 260);
    }
  }
  // Layout değişti → canvas/viewer'lara resize sinyali ver
  setTimeout(function() {
    try { window.dispatchEvent(new Event('resize')); } catch(e) {}
  }, 280);
}

// Sayfa açılışında kayıtlı durumu (animasyonsuz) geri yükle
(function() {
  var collapsed = false;
  try { collapsed = localStorage.getItem('mf-sidebar-collapsed') === '1'; } catch(e) {}
  if(!collapsed) return;
  var sidebar = document.getElementById('ve-sidebar');
  var reveal = document.getElementById('ve-sidebar-reveal');
  if(!sidebar) return;
  sidebar.classList.add('ve-sb-no-anim', 've-sb-collapsed');
  if(reveal) { reveal.style.display = 'flex'; reveal.classList.add('visible'); }
  requestAnimationFrame(function() { sidebar.classList.remove('ve-sb-no-anim'); });
})();

// ===== ÖZELLİKLER PANELİ RESIZE =====
(function() {
  var properties = document.getElementById('ve-properties');
  var resizer = document.getElementById('ve-properties-resizer');
  
  if(!properties || !resizer) return;
  
  var isResizing = false;
  var startX, startWidth;
  
  resizer.addEventListener('mousedown', function(e) {
    isResizing = true;
    startX = e.clientX;
    startWidth = properties.offsetWidth;
    resizer.classList.add('active');
    properties.classList.add('ve-prop-no-anim'); // sürükleme sırasında geçişi kapat
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', function(e) {
    if(!isResizing) return;
    
    // Panel sol-kenara taşındı, resizer sağ kenarda: sağa sürüklemek genişletir
    var dx = e.clientX - startX;
    var newWidth = startWidth + dx;

    newWidth = Math.max(280, Math.min(720, newWidth));

    properties.style.width = newWidth + 'px';
  });
  
  document.addEventListener('mouseup', function() {
    if(isResizing) {
      isResizing = false;
      resizer.classList.remove('active');
      properties.classList.remove('ve-prop-no-anim');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
})();

// ===== DRAG & DROP - NODE OLUŞTURMA =====
var compCounter = 0;
var nodes = [];
var connections = [];
var selectedNodes = [];

// Canvas transform değerleri. Bu ilk değer YALNIZCA DOM hazır olana kadar geçerli
// (görünüm ölçüsü daha okunamaz): yerel (0,0)'ı görünümün sol-üst köşesine koyar.
// Açılışta ui-core.js veCameraHome() ile "ev" konumuna alır → kanvasın MERKEZİ
// görünümün ortasına gelir (bkz. js/canvas-space.js).
var canvasOffset = {x: 3000, y: 3000};
var canvasZoom = 1;

// Bağlantı oluşturma durumu
var isConnecting = false;
var connectingFrom = null;
var tempLine = null;

function cleanupTempLine() {
  // Bağlantı başlatan port'un stilini sıfırla
  if(connectingFrom && connectingFrom.element) {
    connectingFrom.element.style.background = '';
    connectingFrom.element.style.transform = '';
  }
  isConnecting = false;
  connectingFrom = null;
  if(tempLine) {
    try { tempLine.remove(); } catch(e) {}
    tempLine = null;
  }
  // Kalan orphan temp çizgileri de temizle
  var svg = document.getElementById('ve-connections-layer');
  if(svg) {
    svg.querySelectorAll('.ve-connection-temp').forEach(function(el) { el.remove(); });
  }
}

// Çoklu seçim durumu
var isSelecting = false;
var selectionStart = {x: 0, y: 0};

// Hizalama ayarları
var SNAP_THRESHOLD = 8; // Piksel cinsinden snap mesafesi
var SNAP_ENABLED = false; // Varsayılan kapalı
var veQKeyDown = false; // Q tuşuna basılı mı

// Q tuşu - basılı tutunca geçici hizalama (input alanlarında tetiklenmesin)
document.addEventListener('keydown', function(e) {
  if(e.key === 'q' || e.key === 'Q') {
    var tag = (e.target.tagName || '').toLowerCase();
    if(tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.contentEditable === 'true') return;
    if(!veQKeyDown) {
      veQKeyDown = true;
      var btn = document.getElementById('ve-snap-btn');
      if(btn && !SNAP_ENABLED) btn.style.opacity = '0.7';
    }
  }
});
document.addEventListener('keyup', function(e) {
  if(e.key === 'q' || e.key === 'Q') {
    veQKeyDown = false;
    var btn = document.getElementById('ve-snap-btn');
    if(btn && !SNAP_ENABLED) btn.style.opacity = '0.4';
    showAlignmentGuides(null); // Rehber çizgilerini temizle
  }
});

function veToggleSnap() {
  SNAP_ENABLED = !SNAP_ENABLED;
  var btn = document.getElementById('ve-snap-btn');
  if(btn) {
    btn.classList.toggle('active', SNAP_ENABLED);
    btn.title = SNAP_ENABLED ? 'Hizalama Açık (Kapatmak için tıkla)' : 'Hizalama Kapalı (Q tuşu ile geçici aktif)';
  }
  showToast(SNAP_ENABLED ? 'Hizalama açık' : 'Hizalama kapalı (Q tuşu ile geçici)');
}

var veGridVisible = false;
var veGridDensity = 1; // 0=geniş(40px), 1=normal(20px), 2=sık(10px)
var veGridSizes = [40, 20, 10];
var veGridLabels = ['Geniş', 'Normal', 'Sık'];

function veToggleGrid() {
  veGridVisible = !veGridVisible;
  var wrapper = document.getElementById('ve-canvas-wrapper');
  var btn = document.getElementById('ve-grid-btn');
  if(wrapper) {
    if(veGridVisible) { wrapper.classList.remove('grid-hidden'); }
    else { wrapper.classList.add('grid-hidden'); }
  }
  if(btn) btn.classList.toggle('active', veGridVisible);
  showToast(veGridVisible ? 'Grid gösteriliyor' : 'Grid gizlendi');
}

// Güç akışı animasyonu — bağlantılarda akan kesik çizgiler (from→to yönünde).
// Sürekli olduğu için KAPALI varsayılan; kullanıcı toolbar'dan açar ve seçim
// localStorage'da hatırlanır. Salt görsel katman (CSS) — bağlantı verisine dokunmaz.
var veFlowAnim = false;
try { veFlowAnim = localStorage.getItem('mf-flow-anim') === '1'; } catch(e) {}
function veApplyFlowAnim() {
  var wrapper = document.getElementById('ve-canvas-wrapper');
  if(wrapper) wrapper.classList.toggle('ve-flow-anim', veFlowAnim);
  var btn = document.getElementById('ve-flow-btn');
  if(btn) btn.classList.toggle('active', veFlowAnim);
}
function veToggleFlow() {
  veFlowAnim = !veFlowAnim;
  try { localStorage.setItem('mf-flow-anim', veFlowAnim ? '1' : '0'); } catch(e) {}
  veApplyFlowAnim();
  if(typeof showToast === 'function') showToast(veFlowAnim ? 'Güç akışı animasyonu açık' : 'Güç akışı animasyonu kapalı');
}
(function(){
  var _apply = function(){ veApplyFlowAnim(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _apply);
  else setTimeout(_apply, 200);
})();

function veCycleGridDensity() {
  veGridDensity = (veGridDensity + 1) % veGridSizes.length;
  var size = veGridSizes[veGridDensity];
  // Izgara görünüm katmanında ve deseni kameradan türetiliyor (sonsuz ızgara,
  // bkz. js/canvas-space.js) → yoğunluk değişince deseni yeniden hesapla.
  if(typeof veApplyGridPattern === 'function') veApplyGridPattern();
  // Snapshot panelini de güncelle
  var snap = document.querySelector('.ve-snapshot-pane');
  if(snap) snap.style.backgroundSize = size + 'px ' + size + 'px';
  
  var btn = document.getElementById('ve-grid-density-btn');
  if(btn) btn.title = 'Grid: ' + veGridLabels[veGridDensity] + ' (' + size + 'px)';
  showToast('Grid: ' + veGridLabels[veGridDensity] + ' (' + size + 'px)');
}

// ===== TOPOLOJİ SINIR ÇERÇEVESİ (AVL-stil kesikli çizgi) =====
var veBoundaryVisible = true;
var veBoundaryPadding = 50; // Bileşenlerden uzaklık (px)
var veBoundaryOpacity = 0.55;
var _veBoundaryOpacitySteps = [0.2, 0.35, 0.55, 0.75, 1.0];

function veCycleBoundaryOpacity() {
  var idx = _veBoundaryOpacitySteps.indexOf(veBoundaryOpacity);
  idx = (idx + 1) % _veBoundaryOpacitySteps.length;
  veBoundaryOpacity = _veBoundaryOpacitySteps[idx];
  veUpdateBoundary();
  var btn = document.getElementById('ve-boundary-opacity-btn');
  if(btn) btn.title = 'Sınır Opaklığı: ' + Math.round(veBoundaryOpacity * 100) + '%';
  showToast('Sınır opaklığı: %' + Math.round(veBoundaryOpacity * 100));
}

function veToggleBoundary() {
  veBoundaryVisible = !veBoundaryVisible;
  var btn = document.getElementById('ve-boundary-btn');
  if(btn) btn.classList.toggle('active', veBoundaryVisible);
  veUpdateBoundary();
  showToast(veBoundaryVisible ? 'Topoloji sınırı gösteriliyor' : 'Topoloji sınırı gizlendi');
}

function veUpdateBoundary() {
  var svg = document.getElementById('ve-connections-layer');
  if(!svg) return;
  
  // Eski sınır elemanlarını temizle
  svg.querySelectorAll('.ve-boundary-rect').forEach(function(el) { el.remove(); });

  if(!veBoundaryVisible || nodes.length === 0) return;
  
  // Bileşenlerin sınır kutusunu hesapla (sensör hariç)
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  var realNodes = 0;
  nodes.forEach(function(n) {
    if(n.type === 'sensor' || n.type === 'sensor-wizard') return;
    var nx = n.x;
    var ny = n.y;
    var nw = n.width || 65;
    var nh = n.height || 60;
    var labelH = 20;
    if(nx < minX) minX = nx;
    if(ny < minY) minY = ny;
    if(nx + nw > maxX) maxX = nx + nw;
    if(ny + nh + labelH > maxY) maxY = ny + nh + labelH;
    realNodes++;
  });
  
  if(realNodes === 0) return;
  
  var pad = veBoundaryPadding;
  var bx = minX - pad;
  var by = minY - pad;
  var bw = (maxX - minX) + pad * 2;
  var bh = (maxY - minY) + pad * 2;
  
  // Sınır dikdörtgeni — sade kesikli çizgi
  var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('class', 've-boundary-rect');
  rect.setAttribute('x', bx);
  rect.setAttribute('y', by);
  rect.setAttribute('width', bw);
  rect.setAttribute('height', bh);
  rect.setAttribute('rx', '6');
  rect.setAttribute('ry', '6');
  // Tema rengi: koyu temalarda border-hover, açık temalarda koyu gri
  rect.style.cssText = 'fill:none; stroke:var(--border-hover); stroke-width:1.5; stroke-dasharray:8,5; opacity:' + veBoundaryOpacity + '; pointer-events:none;';
  if(svg.firstChild) { svg.insertBefore(rect, svg.firstChild); }
  else { svg.appendChild(rect); }

}

// Toast bildirimi göster (sağ üstte yığılır)
// Aynı anda en fazla VE_TOAST_MAX bildirim durur; yenisi gelince en eskisi
// düşer. Eskiden yeni bildirim öncekini SİLİYORDU — arka arkaya iki işlemde
// ilkinin sonucu hiç okunamıyordu.
var VE_TOAST_MAX = 3;

function _veToastStack() {
  var stack = document.querySelector('.ve-toast-stack');
  if(!stack) {
    stack = document.createElement('div');
    stack.className = 've-toast-stack';
    // Ekran okuyucular bildirimi kesintiye uğratmadan duyursun
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  return stack;
}

function _veToastDismiss(toast) {
  if(!toast || toast._veDismissed) return;
  toast._veDismissed = true;
  toast.classList.remove('show');
  setTimeout(function() { toast.remove(); }, 300);
}

function showToast(message, type) {
  var stack = _veToastStack();

  // Kuyruk dolduysa en eskisini düşür. Kapanmakta olanlar (fade-out için
  // 300ms DOM'da kalır) sayılmaz — yoksa sayım şişip yaşayanları düşürürdü.
  var live = Array.prototype.filter.call(
    stack.querySelectorAll('.ve-toast'),
    function(t) { return !t._veDismissed; }
  );
  for(var i = 0; i <= live.length - VE_TOAST_MAX; i++) _veToastDismiss(live[i]);

  var toast = document.createElement('div');
  toast.className = 've-toast';
  if(type === 'warning' || type === 'error' || type === 'info') toast.classList.add(type);

  var icon = document.createElement('span');
  icon.className = 've-toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = (type === 'error') ? '!' : (type === 'warning') ? '!' : (type === 'info') ? 'i' : '✓';

  var text = document.createElement('span');
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);
  // Tıklayınca hemen kapansın — üst üste binen bildirimleri elle temizleme
  toast.addEventListener('click', function() { _veToastDismiss(toast); });
  stack.appendChild(toast);

  // Göster
  setTimeout(function() {
    toast.classList.add('show');
  }, 10);

  // 2.5 saniye sonra gizle
  setTimeout(function() { _veToastDismiss(toast); }, 2500);
}

// Onay gerektiren toast bildirimi
// confirmLabel: onay butonunun yazısı (varsayılan "Evet, Sil"). Silme dışı
// eylemlerde — örn. oturum kapatma — varsayılan yanlış vaatte bulunuyordu.
function showConfirmToast(message, onConfirm, onCancel, confirmLabel) {
  // Mevcut confirm toast'ı kaldır
  var existing = document.querySelector('.ve-toast-confirm');
  if(existing) existing.remove();
  
  var toast = document.createElement('div');
  toast.className = 've-toast-confirm';
  
  var html = '<div class="ve-toast-confirm-message">' + message + '</div>';
  html += '<div class="ve-toast-confirm-buttons">';
  html += '<button class="ve-toast-confirm-btn cancel">İptal</button>';
  html += '<button class="ve-toast-confirm-btn confirm">' + (confirmLabel || 'Evet, Sil') + '</button>';
  html += '</div>';
  
  toast.innerHTML = html;
  document.body.appendChild(toast);
  
  // Göster
  setTimeout(function() {
    toast.classList.add('show');
  }, 10);
  
  // Buton event'leri
  var cancelBtn = toast.querySelector('.cancel');
  var confirmBtn = toast.querySelector('.confirm');
  
  function closeToast() {
    toast.classList.remove('show');
    setTimeout(function() {
      toast.remove();
    }, 300);
  }
  
  cancelBtn.addEventListener('click', function() {
    closeToast();
    if(onCancel) onCancel();
  });
  
  confirmBtn.addEventListener('click', function() {
    closeToast();
    if(onConfirm) onConfirm();
  });
  
  // 10 saniye sonra otomatik kapat (iptal gibi davran)
  setTimeout(function() {
    if(document.body.contains(toast)) {
      closeToast();
      if(onCancel) onCancel();
    }
  }, 10000);
}

// Hizalama çizgilerini göster/gizle
function showAlignmentGuides(guides) {
  var canvasInitialOffset = 3000;
  
  // Tüm guide'ları gizle
  ['ve-align-top', 've-align-center-h', 've-align-bottom', 've-align-left', 've-align-center-v', 've-align-right'].forEach(function(id) {
    var el = document.getElementById(id);
    if(el) el.style.display = 'none';
  });
  
  if(!guides) return;
  
  // Obje formatı ({vertical:[], horizontal:[]}) → array formatına dönüştür
  var guideList = [];
  if(Array.isArray(guides)) {
    guideList = guides;
  } else if(guides.vertical || guides.horizontal) {
    // doResize'dan gelen format
    (guides.vertical || []).forEach(function(pos) {
      guideList.push({id: 've-align-left', pos: pos, type: 'v'});
    });
    (guides.horizontal || []).forEach(function(pos) {
      guideList.push({id: 've-align-top', pos: pos, type: 'h'});
    });
  }
  
  guideList.forEach(function(guide) {
    var el = document.getElementById(guide.id);
    if(!el) return;
    var screenPos = (guide.pos - canvasInitialOffset) * canvasZoom + (guide.type === 'h' ? canvasOffset.y : canvasOffset.x);
    if(guide.type === 'h') { el.style.top = screenPos + 'px'; }
    else { el.style.left = screenPos + 'px'; }
    el.style.display = 'block';
  });
}

// Hizalama kontrolü ve snap
function checkAlignment(movingNodes) {
  if((!SNAP_ENABLED && !veQKeyDown) || movingNodes.length === 0) {
    showAlignmentGuides(null);
    return {snapX: 0, snapY: 0};
  }
  
  var guides = [];
  var snapX = 0;
  var snapY = 0;
  var nodeWidth = 65;
  var nodeHeight = 65;
  
  // Hareket eden node'ların sınırları
  var movingBounds = {
    left: Math.min.apply(null, movingNodes.map(function(n) { return n.x; })),
    right: Math.max.apply(null, movingNodes.map(function(n) { return n.x + nodeWidth; })),
    top: Math.min.apply(null, movingNodes.map(function(n) { return n.y; })),
    bottom: Math.max.apply(null, movingNodes.map(function(n) { return n.y + nodeHeight; })),
    centerX: 0,
    centerY: 0
  };
  movingBounds.centerX = (movingBounds.left + movingBounds.right) / 2;
  movingBounds.centerY = (movingBounds.top + movingBounds.bottom) / 2;
  
  // Diğer node'larla karşılaştır
  var otherNodes = nodes.filter(function(n) { return movingNodes.indexOf(n) === -1; });
  
  otherNodes.forEach(function(other) {
    var otherBounds = {
      left: other.x,
      right: other.x + nodeWidth,
      top: other.y,
      bottom: other.y + nodeHeight,
      centerX: other.x + nodeWidth / 2,
      centerY: other.y + nodeHeight / 2
    };
    
    // Yatay hizalama (Y ekseni)
    // Üst kenar
    if(Math.abs(movingBounds.top - otherBounds.top) < SNAP_THRESHOLD) {
      if(snapY === 0) snapY = otherBounds.top - movingBounds.top;
      guides.push({id: 've-align-top', type: 'h', pos: otherBounds.top});
    }
    if(Math.abs(movingBounds.top - otherBounds.bottom) < SNAP_THRESHOLD) {
      if(snapY === 0) snapY = otherBounds.bottom - movingBounds.top;
      guides.push({id: 've-align-top', type: 'h', pos: otherBounds.bottom});
    }
    
    // Orta yatay
    if(Math.abs(movingBounds.centerY - otherBounds.centerY) < SNAP_THRESHOLD) {
      if(snapY === 0) snapY = otherBounds.centerY - movingBounds.centerY;
      guides.push({id: 've-align-center-h', type: 'h', pos: otherBounds.centerY});
    }
    
    // Alt kenar
    if(Math.abs(movingBounds.bottom - otherBounds.bottom) < SNAP_THRESHOLD) {
      if(snapY === 0) snapY = otherBounds.bottom - movingBounds.bottom;
      guides.push({id: 've-align-bottom', type: 'h', pos: otherBounds.bottom});
    }
    if(Math.abs(movingBounds.bottom - otherBounds.top) < SNAP_THRESHOLD) {
      if(snapY === 0) snapY = otherBounds.top - movingBounds.bottom;
      guides.push({id: 've-align-bottom', type: 'h', pos: otherBounds.top});
    }
    
    // Dikey hizalama (X ekseni)
    // Sol kenar
    if(Math.abs(movingBounds.left - otherBounds.left) < SNAP_THRESHOLD) {
      if(snapX === 0) snapX = otherBounds.left - movingBounds.left;
      guides.push({id: 've-align-left', type: 'v', pos: otherBounds.left});
    }
    if(Math.abs(movingBounds.left - otherBounds.right) < SNAP_THRESHOLD) {
      if(snapX === 0) snapX = otherBounds.right - movingBounds.left;
      guides.push({id: 've-align-left', type: 'v', pos: otherBounds.right});
    }
    
    // Orta dikey
    if(Math.abs(movingBounds.centerX - otherBounds.centerX) < SNAP_THRESHOLD) {
      if(snapX === 0) snapX = otherBounds.centerX - movingBounds.centerX;
      guides.push({id: 've-align-center-v', type: 'v', pos: otherBounds.centerX});
    }
    
    // Sağ kenar
    if(Math.abs(movingBounds.right - otherBounds.right) < SNAP_THRESHOLD) {
      if(snapX === 0) snapX = otherBounds.right - movingBounds.right;
      guides.push({id: 've-align-right', type: 'v', pos: otherBounds.right});
    }
    if(Math.abs(movingBounds.right - otherBounds.left) < SNAP_THRESHOLD) {
      if(snapX === 0) snapX = otherBounds.left - movingBounds.right;
      guides.push({id: 've-align-right', type: 'v', pos: otherBounds.left});
    }
  });
  
  showAlignmentGuides(guides);
  return {snapX: snapX, snapY: snapY};
}

