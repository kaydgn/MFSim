// ============================================================================
//  YAPISAL ANALİZ — SONLU ELEMANLAR (Structural Analysis / FEA)
// ============================================================================
// MFSim'in DÖRDÜNCÜ ana modülü (Araç Performans, Takoz Çökme-Titreşim ve
// FEAD'in yanında). Bu dosya modülün SUNUM katmanıdır: alt-sistem düğümü, iç
// topoloji gezinmesi, breadcrumb ve paneller.
//
// MİMARİ — diğer üç modülle BİREBİR aynı nested kalıp: ana canvas'ta tek kart;
// çift tıkla iç topolojiye girilir; çıkışta iç topoloji node.data.subTopology'ye
// yazılır. Kaydet/sekme-değiştir öncesi veSaveActiveTabState → veStrCollapseToRoot
// ile köke çöker.
//
// BAĞLANTININ ANLAMI BU MODÜLDE FARKLIDIR — analiz zinciridir:
//   • Araç Performans'ta bağlantı GÜÇ AKIŞI, Takoz'da SALT GÖRSEL,
//     FEAD'de KAYIŞ YOLU (serpantin sırası) idi.
//   • Yapısal Analiz'de bağlantı, çözüme giren VERİNİN AKIŞIDIR:
//         Geometri → Hesaplama Ağı → Sınır Koşulları → Sonuçlar
//     Yani bir kenar "bu bileşenin çıktısı şu bileşenin girdisidir" der.
//   • Zincir PORT SAYILARIYLA yapısal olarak zorlanır: Geometri'nin girişi,
//     Sonuçlar'ın çıkışı yoktur → ters kurulamaz (bkz. components.js str-*).
//
// ÜÇ KATMAN (FEAD'deki ayrımın aynısı) — bu iskelet kurulurken planlandı:
//   js/structural-core.js   HESAP ÇEKİRDEĞİ. Eleman kütüphanesi (tet10),
//                           seyrek kurulum, çözücü, gerilme kurtarma.
//                           DOM'suz, saf sayısal.
//   js/structural-model.js  KÖPRÜ. Kanvastaki düğüm+bağlantıyı çekirdeğin
//                           istediği modele çevirir; mesh ↔ CAD yüzü ↔ sınır
//                           koşulu eşlemesi, hata çevirisi. DOM'suz.
//   js/cp-structural.js     BU DOSYA. Yalnız HTML kurar ve modeli çağırır.
//                           Kendi geometrisini/mesh'ini HESAPLAMAZ.
//
// ── BU İSKELET KURULMADAN ÖNCE ÖLÇÜLENLER ───────────────────────────────────
// Modülün kapsamı tahminle değil, ölçümle belirlendi. Aynı konsol kiriş
// problemi (200×20×10 mm, çelik, 1000 N) saf JS'te üç eleman tipiyle çözüldü:
//
//   2D lineer üçgen (CST)    410 DOF   → hata −17.96 %
//   2D kuadratik (Q8)        330 DOF   → hata  −0.35 %   (13 ms)
//   3D lineer tet (tet4)  27 783 DOF   → hata −24.0  %   (14.7 s)
//
// İki sonuç bu modülün iki kuralını doğuruyor:
//   1) ELEMAN KUADRATİK OLMAK ZORUNDA. tet4 ile 28 bin serbestlik derecesinde
//      bile cevap %24 yanlış — ve hep RİJİT tarafa, yani güvenli tarafa değil.
//      Hata gözle yakalanmaz: kontur grafiği kusursuz görünür.
//   2) MESH YAKINSAMASI GÖSTERİLMEK ZORUNDA. Tek bir FEA sonucu bir sayı değil
//      bir kanaattir; rapor yakınsama eğrisini basmadan hüküm veremez.
//
// Mesh üreteci tarafında da ölçüm var (TetGen 1.6.1, native):
//   • Küp: hacim TAM 1000.000000 mm³, ters tet 0, sınır işaretçileri korunuyor.
//   • `-o2` doğrudan TET10 üretiyor → orta düğümleri biz eklemiyoruz.
//   • Kalite reçetesi `-pq1.4/20 -O9 -o/150//2.5` → min dihedral 7.6°,
//     <10° kuyruğu %0.01. (`-q<radius-edge>/<min-dihedral>`; kısa yardımda yok,
//     kaynaktan çıkarıldı.)
//   • DARBOĞAZ TetGen DEĞİL: OCCT'nin RENDER tessellation'ı. Min açı 2.81°
//     (küp) — ve OCCT'yi sıkmak İYİLEŞTİRMİYOR, BOZUYOR: 2.50° → 0.14°,
//     tet 11.8k → 1.32M. Araya yüzey yeniden-mesh'leme adımı ŞART.
//
// ── SINIR KOŞULU ZİNCİRİ (doğrulandı) ───────────────────────────────────────
// Sınır koşulu mesh DÜĞÜMÜNE değil CAD YÜZÜNE bağlanır. Zincir uçtan uca
// ölçüldü ve ayakta: occt-import-js `brep_faces` (üçgen aralığı → CAD yüzü)
// → TetGen `facetmarkerlist` → çıktı `.face` `trifacemarkerlist`. Yani yüzey
// yeniden bölünse de kimlik korunuyor. Mesh'e bağlansaydı, yakınsama çalışması
// için mesh'i her yenilediğinde bütün sınır koşulları düşerdi — ve yakınsama
// çalışması bu modülde ZORUNLU (yukarıdaki 2. kural).
//
// ── BU DOSYADA HENÜZ OLMAYANLAR ─────────────────────────────────────────────
// Dört zincir bileşeni KURULU ve BAĞLI, ama panelleri bilerek BOŞ: her biri
// yalnız kimliğini ve zincirdeki yerini yazıyor. Boş ama sessiz değil — panel
// nerede bittiğini SÖYLÜYOR (bkz. _strPending: sessizce boş bir panel,
// çalışmayan panelden kötüdür). Sonraki oturumlarda tek tek doldurulacaklar:
//   Geometri        → STEP içe aktarma (occt-import-js/WASM) + 3B görüntüleyici
//   Hesaplama Ağı   → yüzey yeniden-mesh'leme + TetGen (WASM) → tet10
//   Sınır Koşulları → CAD yüzü seçimi, mesnet/yük/simetri, RBE ile delik yükü
//   Sonuçlar        → gerilme/sehim konturu, yakınsama eğrisi, emniyet payı
//
// Birim (UI): uzunluk mm, kuvvet N, gerilme MPa, elastisite modülü MPa.
// Kalıcılık: her düğüm kendi node.data'sında (proje kaydet/yükle otomatik).
// ----------------------------------------------------------------------------

// ─── Sunum yardımcıları ──────────────────────────────────────────────────────
// Ad öneki `_str…` / `veStr…` — `cp-mount-report.js` `_r…`, `cp-fead.js`
// `_fead…` kullanıyor. Aynı adı iki dosyada üst-seviye bildirmek sessiz
// çakışma olurdu; tests/unit/source-hygiene.test.js buna kapı tutuyor.
function _strEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ════════════════════════════════════════════════════════════════════════════
//  ANA MODÜL — ALT-SİSTEM (SUBSYSTEM) DÜĞÜMÜ
// ════════════════════════════════════════════════════════════════════════════
var veStrStack = [];
var _veStrBusy = false;

// Modül paneli (tek tık): özet + "Alt Topolojiyi Aç".
function getStrModulePropertiesHTML(node){
  var sub = node && node.data && node.data.subTopology;
  var nCount = (sub && sub.nodes) ? sub.nodes.length : 0;
  var cCount = (sub && sub.connections) ? sub.connections.length : 0;
  var initialized = !!(sub && sub.nodes && sub.nodes.length);
  var html = '<div class="sw-panel">';
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
        + '<b style="color:var(--text-heading);">Yapısal Analiz — alt-sistem.</b> '
        + 'Braket ve taşıyıcı parçaların sonlu elemanlar analizi. Üstüne <b>çift tıklayınca</b> kendi '
        + '<b>alt topolojisine</b> girilir. Bağlantılar burada <b>analiz zincirini</b> anlatır: '
        + 'Geometri → Hesaplama Ağı → Sınır Koşulları → Sonuçlar.'
        + '</div>';
  html += '<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:10px;">';
  if(initialized){
    html += '<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bileşen</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">' + nCount + '</td></tr>';
    html += '<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bağlantı</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">' + cCount + '</td></tr>';
  } else {
    html += '<tr><td style="padding:7px 8px; border:1px solid var(--border-color); color:var(--text-muted);">Henüz açılmadı — ilk açılışta dört bileşenli analiz zinciri kurulu gelir.</td></tr>';
  }
  html += '</table>';
  html += '<button onclick="veStrOpenEditor(\'' + node.id + '\')" style="width:100%; padding:14px 16px; font-size:var(--fs-lg); font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.03em;" onmouseover="this.style.filter=\'brightness(1.15)\'" onmouseout="this.style.filter=\'none\'">▶ Alt Topolojiyi Aç</button>';
  html += '</div>';
  return html;
}

// BAŞLANGIÇ YERLEŞİMİ (yerel px) — analiz zinciri soldan sağa.
//
// DİĞER ÜÇ MODÜLDEN BİLİNÇLİ AYRIM: onlar ilk açılışta YALNIZ "Başlangıç ve
// Örnekler" kartını koyar, çünkü alt topolojileri değişken — kaç aksesuar, kaç
// takoz, hangi kasnaklar kullanıcıya bağlı. Yapısal Analiz'in zinciri ise SABİT:
// tam olarak bir Geometri, bir Ağ, bir Sınır Koşulları, bir Sonuçlar. Seçim yok.
// O yüzden zincir ilk açılışta KURULU ve BAĞLI gelir; kullanıcı boş tuvale değil
// çalışan bir iskelete düşer.
var VE_STR_STARTER_LAYOUT = [
  { type:'str-geometry', lx: 40, ly:  40 },
  { type:'str-mesh',     lx:190, ly:  40 },
  { type:'str-bc',       lx:340, ly:  40 },
  { type:'str-results',  lx:490, ly:  40 }
];

// Zincirin kenarları — yerleşim dizisindeki İNDİSLERLE değil TİPLERLE yazıldı:
// yerleşim yeniden sıralanırsa indisli bir tablo sessizce yanlış bağlanırdı.
var VE_STR_STARTER_CHAIN = [
  ['str-geometry', 'str-mesh'],
  ['str-mesh',     'str-bc'],
  ['str-bc',       'str-results']
];

function veStrPopulateStarter(){
  if(typeof createNode !== 'function') return [];
  var base = (typeof veArrangeModuleBase === 'function')
    ? veArrangeModuleBase(VE_STR_STARTER_LAYOUT.map(function(it){
        var def = (typeof componentDefs !== 'undefined') ? componentDefs[it.type] : null;
        return { lx:it.lx, ly:it.ly, w:(def && def.defaultWidth) || 62, h:(def && def.defaultHeight) || 56 };
      }))
    : { x:3000, y:3000 };

  var created = [];
  var byType = {};
  VE_STR_STARTER_LAYOUT.forEach(function(it){
    var before = (typeof nodes !== 'undefined') ? nodes.length : 0;
    createNode(it.type, base.x + it.lx, base.y + it.ly);
    if(typeof nodes !== 'undefined' && nodes.length > before){
      var n = nodes[nodes.length-1];
      created.push(n);
      byType[it.type] = n.id;
    }
  });

  if(typeof createConnection === 'function'){
    VE_STR_STARTER_CHAIN.forEach(function(e){
      if(byType[e[0]] && byType[e[1]]) createConnection(byType[e[0]], byType[e[1]]);
    });
  }
  if(typeof updateAllConnections === 'function') updateAllConnections();
  return created;
}

// _silent: autosave gibi arka-plan işlemleri köke çöküp (veSaveActiveTabState)
// kullanıcıyı bulunduğu iç topolojiye geri getirirken true geçer; bu görünmez
// geri-girişte toast/animasyon tetiklenmez (breadcrumb ve sidebar yine güncellenir).
function veStrOpenEditor(nodeId, _silent){
  if(_veStrBusy) return;
  if(typeof nodes === 'undefined' || typeof veSerializeCurrentState !== 'function') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || node.type !== 'structural-analysis') return;

  _veStrBusy = true;
  try {
    if(typeof veFlushOpenPanelData === 'function') veFlushOpenPanelData();
    if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(false);

    var parentState = veSerializeCurrentState();
    veStrStack.push({ nodeId: nodeId, parentState: parentState });
    veClearCanvasDOM();

    var sub = node.data && node.data.subTopology;
    if(sub && sub.nodes && sub.nodes.length){
      veLoadTabState({ state: sub });
    } else {
      veLoadTabState({ state: null });
      veStrPopulateStarter();
    }
  } finally { _veStrBusy = false; }

  if(!_silent && typeof veFitViewToContent === 'function') veFitViewToContent();
  if(!_silent && typeof veAnimateCanvasTransition === 'function') veAnimateCanvasTransition('enter');
  veStrUpdateBreadcrumb();
  if(typeof veSyncSidebarScope === 'function') veSyncSidebarScope();
  if(typeof veUpdateWarnings === 'function') veUpdateWarnings();
  if(!_silent && typeof showToast === 'function') showToast('Yapısal Analiz — İç Topoloji', 'info');
}

// _silent: köke çökerken (veStrCollapseToRoot → kaydet/sekme değiştir öncesi)
// true gelir; kullanıcıya görünmeyen bu toplu çıkışta animasyon tetiklenmez.
function veStrCloseEditor(_silent){
  if(_veStrBusy) return;
  if(!veStrStack.length) return;

  _veStrBusy = true;
  try {
    if(typeof veFlushOpenPanelData === 'function') veFlushOpenPanelData();
    var subState = veSerializeCurrentState();
    // Gömmeden ÖNCE hafiflet (bkz. topology.js veSanitizeEmbeddedState).
    if(typeof veSanitizeEmbeddedState === 'function') subState = veSanitizeEmbeddedState(subState);
    var ctx = veStrStack.pop();
    var pn = (ctx.parentState.nodes || []).find(function(n){ return n.id === ctx.nodeId; });
    if(pn){ if(!pn.data) pn.data = {}; pn.data.subTopology = subState; }
    veClearCanvasDOM();
    veLoadTabState({ state: ctx.parentState });
  } finally { _veStrBusy = false; }

  if(!_silent && typeof veAnimateCanvasTransition === 'function') veAnimateCanvasTransition('exit');
  veStrUpdateBreadcrumb();
  if(typeof veSyncSidebarScope === 'function') veSyncSidebarScope();
  if(typeof veUpdateWarnings === 'function') veUpdateWarnings();
  if(!_silent && typeof showToast === 'function') showToast('Ana topolojiye dönüldü', 'info');
}

function veStrCollapseToRoot(){
  var guard = 0;
  while(veStrStack.length && guard++ < 32){ veStrCloseEditor(true); }
}

// Alt-topoloji çıkış çipi — topoloji sınır çerçevesinin alt kenarına tutunur
// (cp-arac-performans.js veAracUpdateBreadcrumb ile aynı CSS sınıfı ve mantık).
function veStrUpdateBreadcrumb(){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-str-breadcrumb');
  if(veStrStack.length === 0){ if(el) el.remove(); return; }
  if(!el){
    el = document.createElement('div');
    el.id = 've-str-breadcrumb';
    el.className = 've-arac-breadcrumb';
    var host = document.getElementById('ve-canvas-wrapper')
            || document.getElementById('ve-split-container')
            || document.querySelector('.ve-canvas-area')
            || document.body;
    host.appendChild(el);
  }
  var depth = veStrStack.length;
  el.innerHTML = '<button onclick="veStrCloseEditor()" title="Ana (üst) topolojiye dön">← Ana topolojiye dön</button>'
    + '<span class="ve-arac-breadcrumb-label">Yapısal Analiz · İç Topoloji'
    + (depth > 1 ? ' <b>(derinlik ' + depth + ')</b>' : '') + '</span>';
  if(typeof veAnchorBoundaryChip === 'function') veAnchorBoundaryChip();
}

// Çözüm sonucu OTURUMLUK bir global olacak (window.veStrResults) — Takoz'un
// veMountResults'ı ve FEAD'in veFeadResults'ı ile AYNI kalıp ve AYNI TUZAK:
// proje değişince temizlenmezse yeni projede — Yapısal Analiz modülü hiç
// olmasa bile — önceki projenin gerilme tabloları panelde durur. Kanca
// şimdiden bağlı (topology.js veResetSubtopoNav), çözücü gelince dolacak.
function _strForgetResults(){
  if(typeof window !== 'undefined') window.veStrResults = null;
}

// "Bu bölüm sonraki adımda gelecek" notu — kullanıcıya iskeletin nerede
// bittiğini SÖYLER. Sessizce boş bırakılan bir panel, çalışmayan bir panelden
// kötüdür (cp-fead.js _feadPending ile aynı gerekçe).
function _strPending(text){
  return '<div style="padding:8px 10px; margin-bottom:9px; font-size:var(--fs-micro); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px dashed var(--accent-warning);">'
    + '<b style="color:var(--text-heading);">Bileşen bekleniyor.</b> ' + text + '</div>';
}

// ════════════════════════════════════════════════════════════════════════════
//  ZİNCİR BİLEŞENLERİ — PANELLER BİLEREK BOŞ
// ════════════════════════════════════════════════════════════════════════════
// Dördü de yalnız KİMLİĞİNİ ve zincirdeki yerini yazar. İçerikleri (STEP içe
// aktarma, ağ örme, koşul düzenleyici, kontur çizimi) ayrı oturumlarda tek tek
// doldurulacak. Panel boş ama SESSİZ DEĞİL: kullanıcı iskeletin nerede
// bittiğini görüyor (bkz. cp-fead.js _feadPending ile aynı gerekçe).

function _strStub(baslik, ozet, bekleyen){
  return '<div class="sw-panel">'
    + '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-primary);">'
    + '<b style="color:var(--text-heading);">' + baslik + '.</b> ' + ozet
    + '</div>'
    + _strPending(bekleyen)
    + '</div>';
}

function getStrGeometryPropertiesHTML(node){
  return _strStub('Geometri',
    'Analiz edilecek parça. <b>.STEP</b> dosyası buradan içe aktarılır. '
  + 'Zincirin başıdır — girişi yoktur.',
    'İçe aktarma ve 3B görüntüleyici ayrı bir oturumda eklenecek.');
}

function getStrMeshPropertiesHTML(node){
  return _strStub('Hesaplama Ağı',
    'Geometriye sayısal ağ örer. Çıktısı Sınır Koşulları bileşenine gider.',
    'Ağ örücü ayrı bir oturumda eklenecek.');
}

function getStrBCPropertiesHTML(node){
  return _strStub('Sınır Koşulları',
    'Ağ örülmüş geometriye mesnet ve yük tanımlar.',
    'Koşul düzenleyicisi ayrı bir oturumda eklenecek.');
}

function getStrResultsPropertiesHTML(node){
  return _strStub('Sonuçlar',
    'Çözümün gerilme ve deformasyon çıktısı. Zincirin sonudur — çıkışı yoktur.',
    'Çözücü ve kontur çizimi ayrı bir oturumda eklenecek.');
}

// ── Test köprüsü ────────────────────────────────────────────────────────────
// Tarayıcıda bu dosya düz <script> olarak yüklenir; Node tarafında testler
// require ile alabilsin diye guard'lı dışa aktarım (cp-arac-performans.js ile
// aynı kalıp). Üst-seviye bildirim EKLEMEZ → source-hygiene kapısına takılmaz.
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_STR_STARTER_LAYOUT: VE_STR_STARTER_LAYOUT,
    VE_STR_STARTER_CHAIN: VE_STR_STARTER_CHAIN,
    getStrModulePropertiesHTML: getStrModulePropertiesHTML,
    getStrGeometryPropertiesHTML: getStrGeometryPropertiesHTML,
    getStrMeshPropertiesHTML: getStrMeshPropertiesHTML,
    getStrBCPropertiesHTML: getStrBCPropertiesHTML,
    getStrResultsPropertiesHTML: getStrResultsPropertiesHTML
  };
}
