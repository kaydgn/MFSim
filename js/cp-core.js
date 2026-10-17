// ============================================================================
// INFO POPUP SİSTEMİ
// ============================================================================
var infoPopupData = {
  'torkKonvertoru': {
    title: 'Tork Konvertörü hakkında',
    content: 'Tork konvertörü, motor ile şanzıman arasında hidrolik bağlantı sağlar. Kilitli konvertör direkt mekanik bağlantı sağlar (oran 1.0). Kilitsiz durumda ise düşük hızlarda tork çarpanı (1.8-2.5), yüksek hızlarda ise yaklaşık 1.0 oran uygulanır.'
  },
  'ecMatching': {
    title: 'Motor-TC eşleştirme analizi hakkında',
    content: 'Allison TD-148G standardına göre motor ile tüm mevcut tork konvertörlerinin uyumluluğunu otomatik analiz eder. C4 (Stall Speed), C5 (Min Motor Devri), C7 (Türbin Torku Limiti) ve C8 (SR @ Governed) kontrollerini uygulayarak en uygun konvertörü önerir.'
  },
  'transferKutusu': {
    title: 'Transfer Kutusu hakkında',
    content: 'Transfer kutusu, çift kademe (High/Low) veya tek kademe olabilir. High kademe genellikle 1:1 oranında (veya çok yakın), Low kademe ise 2-3 kat daha yüksek orandadır. Arazi koşullarında Low kademe kullanılır.'
  },
  'diferansiyel': {
    title: 'Diferansiyel hakkında',
    content: 'Diferansiyel (son tahrik), dönme hareketini tekerleklere aktarır ve virajlarda iç/dış tekerlek hız farkını sağlar. Diferansiyel oranı, motor devri ile tekerlek devri arasındaki son dönüşüm oranıdır.'
  },
  'propshaftVerileri': {
    title: 'Propşaft hakkında',
    content: 'Propşaft (kardan mili), şanzıman çıkışı ile transfer kutusu veya transfer kutusu ile diferansiyel arasında tork aktarımı sağlayan güç aktarma milidir. Oran 1:1 olarak çalışır, sadece kardan mafsalı ve yatak kayıplarından kaynaklanan verim kaybı uygulanır.'
  },
  'tekerlek': {
    title: 'Tekerlek parametreleri hakkında',
    content: 'Tekerlek yarıçapı, hız ve devir hesaplamalarında kritiktir. Yuvarlanma direnci (Crr) yol yüzeyine ve lastik tipine bağlıdır. Döner kütle faktörü (δ), dönen parçaların ataletini hesaba katar.'
  }
};

function showInfoPopup(infoKey) {
  var info = infoPopupData[infoKey];
  if(!info) return;
  
  // Mevcut popup varsa kaldır
  var existingPopup = document.getElementById('ve-info-popup');
  if(existingPopup) existingPopup.remove();
  
  var popup = document.createElement('div');
  popup.id = 've-info-popup';
  popup.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-lg); box-shadow:var(--shadow-xl); z-index:10005; max-width:400px; overflow:hidden;';
  
  // Pencere ailesinin başlığı (CLAUDE.md → PENCERE AİLESİ TEK): eskiden kendi
  // 16 px başlığını ve bandsız dolgusunu çiziyordu.
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', info.title);
  popup.innerHTML = '<div class="ve-settings-header"><span>' + veIkon('info') + ' ' + info.title + '</span>' +
    '<button class="ve-settings-close" type="button" onclick="closeInfoPopup()" title="Kapat" aria-label="Kapat">' + veIkon('x') + '</button>' +
    '</div>' +
    '<p style="margin:0; padding:14px 16px; font-size:var(--fs-lg); color:var(--text-secondary); line-height:1.5;">' + info.content + '</p>';
  
  // Arka plan overlay
  var overlay = document.createElement('div');
  overlay.id = 've-info-overlay';
  overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:var(--scrim); z-index:10004;';
  overlay.onclick = closeInfoPopup;
  
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
}

function closeInfoPopup() {
  var popup = document.getElementById('ve-info-popup');
  var overlay = document.getElementById('ve-info-overlay');
  if(popup) popup.remove();
  if(overlay) overlay.remove();
}

function deleteConnection(connId) {
  var conn = connections.find(function(c) { return c.id === connId; });
  if(!conn) return;
  
  // Bu bağlantıya bağlı sensörleri kopar
  nodes.forEach(function(n) {
    if(n.type === 'sensor' && n.data && n.data.attachedConnection === connId) {
      n.data.attachedConnection = '';
      n.data.selectedSignal = '';
    }
  });
  
  connections = connections.filter(function(c) { return c.id !== connId; });

  // Port işaretlerini güncelle
  updatePortStatus(conn.from);
  updatePortStatus(conn.to);

  updateAllConnections();
  updateNodeCount();

  // Aksesuar bağlantısı koptuysa → Motor'un net-tork modelini tazele
  // Doğrulama yalnız motorun aksesuar bağlantısı koptuysa (ui-core.js
  // createConnection'daki gerekçe: port adları her çok girişli düğümde var).
  if(typeof VE_ACC_PORT_MAP !== 'undefined' && VE_ACC_PORT_MAP[conn.toPort] && typeof veSyncEngineAccessories === 'function') {
    var engN = nodes.find(function(n){ return n.id === conn.to && n.type === 'engine'; });
    if(engN) {
      veSyncEngineAccessories(engN);
      if(typeof updateVENetChart === 'function') { try { updateVENetChart(engN.id); } catch(e){} }
      if(typeof veSolverValidate === 'function' && document.getElementById('ve-solver-validation')) { try { veSolverValidate(); } catch(e){} }
    }
  }
}

function updatePortStatus(nodeId) {
  var hasOutput = connections.some(function(c) { return c.from === nodeId; });
  var hasInput = connections.some(function(c) { return c.to === nodeId; });
  
  var outPort = document.querySelector('#' + nodeId + ' .ve-node-port.output');
  var inPort = document.querySelector('#' + nodeId + ' .ve-node-port.input');
  
  if(outPort) outPort.classList.toggle('connected', hasOutput);
  if(inPort) inPort.classList.toggle('connected', hasInput);
}

function addToSelection(node) {
  if(selectedNodes.indexOf(node) === -1) {
    selectedNodes.push(node);
  }
  var el = document.getElementById(node.id);
  if(el) el.classList.add('selected');
  
  if(selectedNodes.length === 1) {
    showNodeProperties(node);
  } else {
    showMultipleSelection();
  }
  // KUTUSUZ DÜĞÜMLERİN "seçili" İŞARETİ. Yukarıdaki `classList.add` bir kutu
  // varsayıyor; FEAD kasnaklarının kanvasta kutusu YOK, o yüzden onlarda
  // hiçbir şeye yazmıyor ve seçim yalnız Kayış Tablosu'nun satırında görünür.
  // `clearAnnotationSelection` çağrısındaki kalıbın aynısı: modül varsa haber
  // verilir, yoksa sessizce geçilir.
  if(typeof veFeadMarkSelectedRow === 'function') veFeadMarkSelectedRow();
}

function clearSelection() {
  // Onaylanmamış girdi, seçim HÂLÂ eski bileşendeyken yazılır (map.js).
  if(typeof _veMufettisGirdiyiYaz === 'function') _veMufettisGirdiyiYaz();
  selectedNodes.forEach(function(n) {
    var el = document.getElementById(n.id);
    if(el) el.classList.remove('selected');
  });
  selectedNodes = [];
  if(typeof clearAnnotationSelection === 'function') clearAnnotationSelection();
  if(typeof veFeadMarkSelectedRow === 'function') veFeadMarkSelectedRow();
  showEmptyProperties();
}

// İki sütun (geniş) düzene geçmiş içerik-yoğun bileşen tipleri.
// Yeni panel dönüştürüldükçe buraya eklenir → pencere otomatik genişler,
// kimlik kompakt-sola geçer. (Yerleşim üreticileri ilgili cp-*.js dosyalarında.)
// SÜTUNA SIĞMAYAN PENCERELER — ÖLÇÜLDÜ, TAHMİN EDİLMEDİ.
// Tur C müfettişi geniş ekranda 380 px'lik bir sütuna aldı ve kapısı yalnız
// BOŞ motor penceresini ölçtü. Her tipin penceresi GERÇEK veriyle (üç modülün
// örneği yüklü) açılıp ölçüldüğünde 54 tipten 14'ü sütunda taşıyor ya da
// kesiliyordu: eşleştirme 337 px'e kadar, vites 205, motor 185 (kullanıcının
// ekran görüntüsü — grafik kesik, düğmeler dağınık, yatay kaydırma).
// Bu pencereler kategori gramerine taşınana dek MODAL açılır: kesik bir
// sütun, çalışan bir modalden kötüdür. Liste YALNIZ AŞAĞI İNER — bir pencere
// sığacak biçimde yeniden kurulunca buradan çıkar ve
// `tests/e2e/mufettis-sigma.spec.js` onu sütunda ölçer.
// TAKOZ'UN HİÇBİR TİPİ BURADA DEĞİL (2026-10-15, kullanıcı kararı: "eski tipte
// hiçbir bileşen kalmasın"): kütle gövdeleri, Takoz ve Çözücü 2026-10-14'te,
// kalanlar (Örnek, 2D Görünüm — bugün Görünümler —, Takoz Özellikleri) ertesi gün çıktı. İki
// görüntüleyici "KALICI modal" kaydıyla buradaydı; sütunda tek görünüş/tek
// eksen düzeniyle yeniden kuruldular (docs/decisions/ortak-yuzeyler.md →
// "Müfettiş tuvalin YANINDADIR"). Kapı: mount-sutun.test.js → *LİSTE*.
var VE_SUTUNA_SIGMAYAN = ['engine', 'ec-matching', 'gear-shift', 'shift-controller', 'gearbox',
  'acc-ac', 'acc-alternator', 'acc-aircomp', 'road',
  // TAŞMAYAN AMA EZİLEN — okunurluk ölçüsü (girdi < 56 px) ekleyince çıktı:
  // araç adı 40 px'lik kutuda, konvertör tablosunda 13 px. Kendi kategori
  // tasarımları gelene dek modal (kullanıcı sırası: önce FEAD, sonra Takoz).
  'vehicle', 'torque-converter', 'transfer'];

var VE_WIDE_PANEL_TYPES = ['engine', 'torque-converter', 'ec-matching', 'shift-controller', 'vehicle', 'transfer', 'obstacle-crossing', 'engine-gearbox-matching', 'gear-shift', 'gearbox', 'solver', 'sensor-wizard', 'road',
  // Aksesuarlar — iki sütun (model/oran | güç-çekişi grafiği)
  'acc-ac', 'acc-alternator', 'acc-aircomp',
  // Takoz Çökme-Titreşim modülü — içerik-yoğun paneller (dalga dalga eklenir).
  // Rapor BURADA DEĞİL (2026-10-16): FEAD Rapor penceresi gibi hafif pencere
  // (aşağıdaki liste) — dar ekranın modalında 980 ↔ 560 px açılıyordu. (Bu
  // listenin yorumlarında kesme işareti YAZILMAZ: source-hygiene listeyi
  // tırnak eşleştirerek okuyor.)
  'mnt-motor', 'mnt-gearbox', 'mnt-shaft', 'mnt-bracket', 'mnt-transfer', 'mnt-pto', 'mnt-pump', 'mnt-pto-group',
  'mnt-mount', 'mnt-example', 'mnt-coordframe', 'mnt-viewer', 'mnt-library', 'mnt-2dview',
  // Parametrik Analiz — grup, aday ve kısıt föyleri.
  'mnt-parametric',
  // Çözücü artık sekmeli bir pencere (yük kitabı · modlar · ayarlar) — FEAD
  // çözücüsü gibi geniş; dar "eylem kartı" listesinden çıktı.
  'mnt-solver',
  // FEAD — kayış yolu şeması ve çok alanlı kasnak/gergi panelleri.
  //
  // KASNAKLAR VE ÇÖZÜCÜ LİSTEDE DEĞİLDİ ve eksiklik bir karar değil bir
  // atlamaydı: ikisi de varsayılan (ortalı-simge) kimliğe düşüyordu, gergi ve
  // kayış ise kompakt-sol satıra. ÖLÇÜLDÜ (yedi FEAD paneli, gerçek tarayıcı):
  // başlık yüksekliği 92 px ↔ 44 px — aynı modülün panelleri iki ayrı pencere
  // gibi açılıyordu. Kasnak paneli altı kartlı, Çözücü ise modülün en ağır
  // yüzeyi (Algılanan Model + çevrim tablosu + kapılar + sonuç blokları);
  // "içerik-yoğun" ölçütünü ikisi de karşılıyor.
  'fead-tensioner', 'fead-belt', 'fead-layout', 'fead-solver',
  'fead-crank', 'fead-alternator', 'fead-ac', 'fead-waterpump', 'fead-ps',
  'fead-aircomp', 'fead-fan', 'fead-idler',
  // Parametrik: çoklu-seri sonuç grafiği tam genişlikte ferah okunur.
  'parametric'];

// Hafif paneller — içerik az (kısa metin / birkaç alan / tek eylem): geniş yerine
// DAR "eylem kartı" + kompakt-sol kimlik (ortalı-simge boşluğu gitsin). Salt sunum.
var VE_COMPACT_PANEL_TYPES = ['mount-analysis', 'mnt-report',
  'fead-analysis', 'fead-report',
  'fead-wizard',
  'arac-performans', 'terminator', 'sensor', 'scenario', 'coast-down', 'propshaft', 'differential', 'wheel'];

// Son gösterilen bileşen = PENCERENİN KONUSU (map.js → veMufettisKonusu).
// Başka bileşene geçince pencere ortalanır ve en üstten açılır; aynı
// bileşenin yerinde yenilenmesinde konum ve kaydırma korunur.
var _veLastPropNodeId = null;
// İçerik, sütuna sığmayan bir bileşenin sütundaki KARTI mı (map.js).
var _veMufettisKart = false;

// SÜTUNA SIĞMAYAN BİLEŞENİN SÜTUNDAKİ KARTI. Sütun açıkken böyle bir bileşene
// tek tık, geniş penceresini perdeyle açsaydı tek tık tuvali örterdi; kart
// sütunu yerinde bırakır (map.js → veMufettisGenisAc). Kart yalnız düğmedir:
// bileşenin adı başlıkta, açıklama arayüzde yazılmaz (CLAUDE.md → ARAYÜZ ANLATMAZ).
function _veMufettisKartHTML() {
  return '<div class="ve-prop-genis">'
    + '<button type="button" class="sw-btn sw-btn-primary" onclick="veMufettisGenisAc()">'
    + (typeof veIkon === 'function' ? veIkon('maximize') : '') + 'Pencerede aç</button>'
    + '</div>';
}

// Pencerenin çöp kutusu pencerenin KONUSUNU siler, seçimi değil: pencere seçim
// boşalınca da açık kalıyor; seçime bakan düğme hiçbir şey silmezdi.
function veMufettisSil(id) {
  var n = (typeof nodes !== 'undefined' && nodes) ? nodes.find(function(x) { return x && x.id === id; }) : null;
  if(!n) return;
  if(!(selectedNodes.length === 1 && selectedNodes[0] === n)) { clearSelection(); addToSelection(n); }
  deleteSelectedNodes();
}

// opt.kip: 'kart' · 'tam' — sütuna sığmayan bileşenin hangi hâlde kurulacağı.
// Verilmezse: açık sütunda başka bir bileşene geçiş kart, aynı bileşenin
// yenilenmesi o anki hâli korur, kapalı pencere tam içerik.
function showNodeProperties(node, opt) {
  var content = document.querySelector('.ve-properties-content');
  if(!content) return;
  opt = opt || {};
  var degisti = _veLastPropNodeId !== (node && node.id);
  // Yazılmış ama onaylanmamış girdi ESKİ bileşene yazılır — içerik değişmeden.
  if(degisti && typeof _veMufettisGirdiyiYaz === 'function') _veMufettisGirdiyiYaz();
  // Başka bir bileşen açıldığında pencereyi ORTALA — önceki bileşenin
  // sürüklenmiş konumunu miras alma. Aynı bileşenin içeriği yerinde
  // yenilenirken (sekme/profil değişimi) konumu koru → sürüklediğin yer bozulmaz.
  if(typeof VEWindowDrag !== 'undefined' && VEWindowDrag && typeof VEWindowDrag.resetToCenter === 'function') {
    if(degisti) VEWindowDrag.resetToCenter();
  }
  _veLastPropNodeId = (node && node.id) || null;
  var kart = false;
  if(VE_SUTUNA_SIGMAYAN.indexOf(node.type) >= 0 && typeof veMufettisSutunKipi === 'function' && veMufettisSutunKipi()) {
    if(opt.kip === 'kart') kart = true;
    else if(opt.kip !== 'tam' && typeof veMufettisAcik === 'function' && veMufettisAcik())
      kart = degisti ? true : _veMufettisKart;
  }
  _veMufettisKart = kart;
  // Modal başlığında bileşenin adı ve sembolü görünür
  var titleEl = document.getElementById('ve-properties-title');
  if(titleEl) {
    var nm = (node && (node.customName || (node.def && node.def.name))) || 'Özellikler';
    // Yalnız ad — ID gövdedeki kimlik bloğunda zaten var. İkisi 120 px arayla
    // aynı bilgiyi tekrarlıyordu ("Motor  comp-2" / "Motor ✎  ID: comp-2").
    titleEl.innerHTML = '<span class="mf-ico mf-ico-sliders"></span>' + nm;
  }
  
  // Kimlik bloğu — sınıf tabanlı (yerleşim CSS'te). Varsayılan: ortalanmış
  // (simge üstte, ad/ID altında). Motor penceresinde (.ve-properties--engine)
  // CSS ile kompakt-sol satıra döner: simge solda, ad/ID yanında, sil sağda.
  var displayName = node.customName || node.def.name;
  var html = '<div class="ve-prop-identity">';
  html += '<div class="ve-prop-symbol">' + node.def.svg + '</div>';
  html += '<div class="ve-prop-meta">';
  html += '<div class="ve-prop-name"><span id="ve-node-name-display-' + node.id + '">' + displayName + '</span>';
  html += '<button class="ve-prop-nameedit" onclick="veEditNodeName(\'' + node.id + '\')" title="İsmi düzenle"><span class="mf-ico mf-ico-edit"></span></button></div>';
  // ALT SATIR TİPİ SÖYLER, iç kimliği değil (2026-09-23). "ID: comp-4"
  // kullanıcıya bir şey demiyordu — hiçbir başka yüzeyde geçmiyor, hiçbir
  // yerde aranamıyor. Adlandırılmış bir bileşenin NE olduğu ise addan her
  // zaman okunmuyor ("Sürücü Kasnak (FAN)" bir Fan Kavraması). Ad tipin
  // adıyla aynıysa alt satır yok: aynı sözcük iki kez yazılmaz.
  if(node.customName && node.def && node.def.name && node.customName !== node.def.name)
    html += '<div class="ve-prop-tip">' + node.def.name + '</div>';
  html += '</div>';  // ve-prop-meta
  // Silinmez tip (componentDefs.noDelete — FEAD kayışı) çöp kutusu göstermez:
  // basılınca yalnız "silinmez" diyecek bir düğme, dinlenmede bir yalandır.
  if(!(componentDefs[node.type] || {}).noDelete)
    html += '<button class="ve-prop-del" onclick="veMufettisSil(\'' + node.id + '\')" title="Bileşeni sil"><span class="mf-ico mf-ico-trash"></span></button>';
  html += '</div>';  // ve-prop-identity

  // Node tipine göre özel içerik
  if(kart) {
    html += _veMufettisKartHTML();
  } else if(node.type === 'engine') {
    html += getEnginePropertiesHTML(node);
  } else if(node.type === 'gearbox') {
    html += getGearboxPropertiesHTML(node);
  } else if(node.type === 'shift-controller') {
    html += getShiftControllerPropertiesHTML(node);
  } else if(node.type === 'torque-converter') {
    html += getTorqueConverterPropertiesHTML(node);
  } else if(node.type === 'ec-matching') {
    html += getECMatchingPropertiesHTML(node);
  } else if(node.type === 'engine-gearbox-matching') {
    html += getEngineGearboxMatchingHTML(node);
  } else if(node.type === 'transfer') {
    html += getTransferPropertiesHTML(node);
  } else if(node.type === 'propshaft') {
    html += getPropshaftPropertiesHTML(node);
  } else if(node.type === 'differential') {
    html += getDifferentialPropertiesHTML(node);
  } else if(node.type === 'wheel') {
    html += getWheelPropertiesHTML(node);
  } else if(node.type === 'vehicle') {
    html += getVehiclePropertiesHTML(node);
  } else if(node.type === 'sensor') {
    html += getSensorPropertiesHTML(node);
  } else if(node.type === 'scenario') {
    html += getScenarioPropertiesHTML(node);
  } else if(node.type === 'coast-down') {
    html += getCoastDownPropertiesHTML(node);
  } else if(node.type === 'obstacle-crossing') {
    html += getObstacleCrossingPropertiesHTML(node);
  } else if(node.type === 'mnt-motor' || node.type === 'mnt-gearbox' || node.type === 'mnt-shaft' || node.type === 'mnt-bracket' || node.type === 'mnt-transfer'
         || node.type === 'mnt-pto' || node.type === 'mnt-pump' || node.type === 'mnt-pto-group') {
    html += getMntMassPropertiesHTML(node);
  } else if(node.type === 'mnt-mount') {
    html += getMntMountPropertiesHTML(node);
  } else if(node.type === 'mnt-library') {
    html += getMntLibraryPropertiesHTML(node);
  } else if(node.type === 'mnt-solver') {
    html += getMntSolverPropertiesHTML(node);
  } else if(node.type === 'mnt-example') {
    html += getMntExamplePropertiesHTML(node);
  } else if(node.type === 'mnt-viewer') {
    html += getMntViewerPropertiesHTML(node);
  } else if(node.type === 'mnt-coordframe') {
    html += getMntCoordFramePropertiesHTML(node);
  } else if(node.type === 'mnt-2dview') {
    html += getMnt2DViewPropertiesHTML(node);
  } else if(node.type === 'mnt-report') {
    html += getMntReportPropertiesHTML(node);
  } else if(node.type === 'mnt-parametric') {
    html += getMntParamPropertiesHTML(node);
  } else if(node.type === 'ap-example') {
    html += getApExamplePropertiesHTML(node);
  } else if(node.type === 'arac-performans') {
    html += getAracPerformansPropertiesHTML(node);
  } else if(node.type === 'mount-analysis') {
    html += getMntModulePropertiesHTML(node);
  } else if(node.type === 'fead-analysis') {
    html += getFeadModulePropertiesHTML(node);
  } else if(node.type === 'fead-tensioner') {
    html += getFeadTensionerPropertiesHTML(node);
  } else if(node.type === 'fead-crank' || node.type === 'fead-alternator' || node.type === 'fead-ac'
         || node.type === 'fead-waterpump' || node.type === 'fead-ps' || node.type === 'fead-aircomp'
         || node.type === 'fead-fan' || node.type === 'fead-idler') {
    // Krank / aksesuarlar / avara — ortak kasnak paneli; farklar tipten okunur
    // (def.isFeadDriver / isFeadAccessory / isFeadIdler; bkz. js/cp-fead.js).
    html += getFeadPulleyPropertiesHTML(node);
  } else if(node.type === 'fead-belt') {
    html += getFeadBeltPropertiesHTML(node);
  } else if(node.type === 'fead-layout') {
    html += getFeadLayoutPropertiesHTML(node);
  } else if(node.type === 'fead-solver') {
    html += getFeadSolverPropertiesHTML(node);
  } else if(node.type === 'fead-report') {
    html += getFeadReportPropertiesHTML(node);
  } else if(node.type === 'fead-wizard') {
    html += getFeadWizardPropertiesHTML(node);
  } else if(node.type === 'solver') {
    html += getSolverPropertiesHTML(node);
  } else if(node.type === 'road') {
    html += getRoadPropertiesHTML(node);
  } else if(node.type === 'parametric') {
    html += getParametricPropertiesHTML(node);
  } else if(node.type === 'sensor-wizard') {
    html += getSensorWizardPropertiesHTML(node);
  } else if(node.type === 'terminator') {
    html += getTerminatorPropertiesHTML(node);
  } else if(node.type === 'gear-shift') {
    html += getGearShiftPropertiesHTML(node);
  } else if(node.type === 'acc-ac' || node.type === 'acc-alternator' || node.type === 'acc-aircomp') {
    html += getAccessoryPropertiesHTML(node);
  } else {
    html += getDefaultPropertiesHTML(node);
  }
  
  
  content.innerHTML = html;
  // Başka bileşenin penceresi EN ÜSTTEN açılır: kaydırıcı aynı öğe, değeri
  // önceki bileşenden kalıyordu.
  if(degisti) content.scrollTop = 0;
  if(kart) {
    if(typeof _veMufettisSinifSifirla === 'function') _veMufettisSinifSifirla();
    if(typeof veMufettisIsaretle === 'function') veMufettisIsaretle();
    return;
  }
  var _propWin = document.getElementById('ve-properties');
  // Sütuna sığmayan pencere MODAL açılır (VE_SUTUNA_SIGMAYAN, ölçülmüş liste).
  if(_propWin) _propWin.classList.toggle('ve-properties--modal', VE_SUTUNA_SIGMAYAN.indexOf(node.type) >= 0);
  // İçerik-yoğun paneller (VE_WIDE_PANEL_TYPES listesi): geniş pencere +
  // kompakt-sol kimlik + iki sütun düzeni. Liste dalga dalga büyür. Salt sunum.
  if(_propWin) _propWin.classList.toggle('ve-properties--wide', VE_WIDE_PANEL_TYPES.indexOf(node.type) >= 0);
  // Aksesuar panelleri üç sütunlu adım akışı (model | eğri | doğrulama) → 1040px.
  // --wide (980px) ile birlikte gelir; bu sınıf CSS'te sonra tanımlı → ezer.
  if(_propWin) _propWin.classList.toggle('ve-properties--accwide',
    node.type === 'acc-ac' || node.type === 'acc-alternator' || node.type === 'acc-aircomp');
  // Motor paneli, veri gelene kadar DAR açılır: geniş pencerede sağ (çıktı)
  // sütunu tamamen boş kalıyor, 980px'lik pencerenin yarısı boşluktu. Preset
  // seçilince onVEFTMotorSelect bu sınıfı kaldırıp --wide'a genişletir;
  // tüm veri silinirse showVEMotorPlaceholder geri daraltır. Salt sunum.
  if(_propWin) {
    var _engEmpty = node.type === 'engine' &&
      !(node.data && node.data.torqueData && node.data.torqueData.length);
    _propWin.classList.toggle('ve-properties--engine-empty', _engEmpty);
    if(_engEmpty) _propWin.classList.remove('ve-properties--wide');
    // Motor paneli Tam Gaz'da üç sütunlu hesap tablosu → 1040px. Boş durumda
    // VERİLMEZ: --engwide CSS'te --engine-empty'den sonra tanımlı, verilirse
    // 560px'lik dar "seçim diyaloğu" halini ezerdi.
    _propWin.classList.toggle('ve-properties--engwide',
      node.type === 'engine' && !_engEmpty &&
      typeof veActiveModule !== 'undefined' && veActiveModule === 'full-throttle');
  }
  // Yol / Ortam: harita hero → çok geniş+yüksek pencere (--wide boyutunu ezer).
  if(_propWin) _propWin.classList.toggle('ve-properties--road', node.type === 'road');
  // Yapısal Analiz / Geometri: parça YÜKLÜYKEN büyük pencere — 3B görüntüleyici
  // Hafif paneller (VE_COMPACT_PANEL_TYPES): içerik az → dar pencere + kompakt-sol
  // kimlik. Geniş yapmak boş sütun bırakırdı. Salt sunum.
  if(_propWin) _propWin.classList.toggle('ve-properties--compact', VE_COMPACT_PANEL_TYPES.indexOf(node.type) >= 0);
  // SIĞMAYAN TABLO AÇILIR PENCEREDE (js/tablo-pencere.js). Ölçüm pencere
  // sınıflarından (sütun ↔ modal ↔ geniş) SONRA — genişliği onlar belirliyor.
  // Eşzamanlı: bir kare bile geniş tablo sütunda görünmesin. Panel kapalıysa
  // genişlik 0'dır ve karar gözlemciye kalır (açılınca verilir).
  if(typeof veTabloKatla === 'function') veTabloKatla(content);
  if(typeof veMufettisIsaretle === 'function') veMufettisIsaretle();
  // Modal OTOMATİK AÇILMAZ — tek tık sadece seçim yapar, çift tık (veAttachNodeDrag)
  // veya marker tıklaması modal'ı açar. Eğer modal zaten açıksa içerik yenilenir.


  // Aksesuar bileşenleri: güç-çekişi grafiğini panel DOM'u oluştuktan sonra çiz
  if(node.type === 'acc-ac' || node.type === 'acc-alternator' || node.type === 'acc-aircomp') {
    setTimeout(function() {
      if(typeof veAccDrawChart === 'function') veAccDrawChart(node.id);
    }, 60);
  }

  // Motor bileşeni için grafik çiz ve kategori dropdown'ı doldur
  if(node.type === 'engine') {
    setTimeout(function() {
      // Kategori dropdown'ını doldur
      onVEMotorCategoryChange(node.id);
      // Grafiği güncelle
      updateVEMotorChart(node.id);
    }, 100);
  }
  
  // Tork konvertörü grafikleri
  if(node.type === 'torque-converter' && veActiveModule === 'full-throttle') {
    setTimeout(function() {
      updateVETCCharts(node.id);
    }, 100);
  }
  
  // Motor-TC Eşleştirme bileşeni: analizi çalıştır
  if(node.type === 'ec-matching') {
    setTimeout(function() {
      runECMatchingAnalysis(node.id);
    }, 150);
  }
  // Motor-Şanzıman Eşleştirme bileşeni: analizi çalıştır
  if(node.type === 'engine-gearbox-matching') {
    setTimeout(function() {
      runEngineGearboxMatchingAnalysis(node.id);
    }, 150);
  }
  
  // Yol/Ortam bileşeni: Leaflet haritayı otomatik yükle
  if(node.type === 'road') {
    setTimeout(function() {
      veInitRoadMap(node.id);
    }, 400);
    // Elle segment kipi: özet ve profil panel AÇILINCA doldurulur. Yalnız
    // segment değişince dolduruluyordu — kayıtlı bir yol boş tuval ve "-"
    // özetle açılıyordu (ölçüldü).
    var _rd = node.data || {};
    if(_rd.egimMode === 'manuel' && (_rd.manualSegments || []).length &&
       typeof _veManualSegRefresh === 'function') {
      requestAnimationFrame(function() { _veManualSegRefresh(node.id); });
    }
  }

  // Takoz Çözücü: hesap YALNIZ "▶ Hesapla" düğmesiyle koşar (otomatik tetik YOK).
  // Panel açılışında model çözülmez; ayrıntılı sonuçlara Rapor bileşeninden bakılır.

  // Takoz Koordinat Düzlemi: panel açılınca koordinat sistemini 3B çiz
  if(node.type === 'mnt-coordframe') {
    setTimeout(function() {
      if(typeof veMntCoordFrameRefresh === 'function') veMntCoordFrameRefresh();
    }, 140);
  }

  // Takoz Görünümler: panel açılınca aksonometriyi kabın gerçek genişliğinde kur
  if(node.type === 'mnt-2dview') {
    setTimeout(function() {
      if(typeof veMnt2DViewRefresh === 'function') veMnt2DViewRefresh();
    }, 120);
  }

  // Takoz Örnek: mevcut model uyarılarını göster (yükleme öncesi durum)
  if(node.type === 'mnt-example') {
    setTimeout(function() {
      if(typeof _mntExampleValidate === 'function' && typeof _mntRenderExampleReport === 'function') {
        var g = (typeof _mntGatherForSolver === 'function') ? _mntGatherForSolver() : {components:[],mounts:[]};
        if(g.components.length || g.mounts.length) _mntRenderExampleReport(_mntExampleValidate(), true);
      }
    }, 120);
  }
}
