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
// ── ZİNCİRİN NERESİ DOLU ────────────────────────────────────────────────────
//   Geometri        ✔ DOLU — STEP içe aktarma (gömülü occt/WASM, worker'da) +
//                     3B görüntüleyici + CAD yüzü vurgusu. Bu dosyanın alt
//                     yarısı; hesap js/structural-model.js'te.
//   Hesaplama Ağı   → yüzey yeniden-mesh'leme + TetGen (WASM) → tet10
//   Sınır Koşulları → CAD yüzü seçimi, mesnet/yük/simetri, RBE ile delik yükü
//   Sonuçlar        → gerilme/sehim konturu, yakınsama eğrisi, emniyet payı
//
// Kalan üçünün paneli bilerek BOŞ ama SESSİZ DEĞİL: her biri nerede bittiğini
// SÖYLÜYOR (bkz. _strPending — sessizce boş bir panel, çalışmayan panelden
// kötüdür).
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
  html += '<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:10px;">';
  if(initialized){
    html += '<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bileşen</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">' + nCount + '</td></tr>';
    html += '<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bağlantı</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">' + cCount + '</td></tr>';
  } else {
    html += '<tr><td style="padding:7px 8px; border:1px solid var(--border-color); color:var(--text-muted);">Alt topoloji henüz açılmadı</td></tr>';
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
  // İçe aktarılmış GEOMETRİ de oturumluk: üçgenler node.data'ya yazılmıyor
  // (bkz. veStrGeomRecord). Temizlenmezse yeni projede önceki projenin parçası
  // görüntüleyicide durur — Takoz/FEAD'deki tuzağın birebir aynısı.
  if(typeof veStrGeomCacheClear === 'function') veStrGeomCacheClear();
  if(typeof veStrSrcClear === 'function') veStrSrcClear();
  if(typeof veStrViewerDispose === 'function') veStrViewerDispose();
}

// Boş panelin DURUM satırı — sessizce boş bırakılan bir panel, çalışmayan bir
// panelden kötüdür (cp-fead.js _feadPending ile aynı gerekçe). Metin DURUM
// bildirir; kullanım anlatmaz, geliştirme planı duyurmaz.
function _strPending(){
  return '<div style="padding:8px 10px; margin-bottom:9px; font-size:var(--fs-micro); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px dashed var(--accent-warning);">'
    + '<b style="color:var(--text-heading);">Kullanıma açık değil.</b></div>';
}

// ════════════════════════════════════════════════════════════════════════════
//  ZİNCİR BİLEŞENLERİ — PANELLER BİLEREK BOŞ
// ════════════════════════════════════════════════════════════════════════════
// Dördü de yalnız KİMLİĞİNİ ve zincirdeki yerini yazar. İçerikleri (STEP içe
// aktarma, ağ örme, koşul düzenleyici, kontur çizimi) ayrı oturumlarda tek tek
// doldurulacak. Panel boş ama SESSİZ DEĞİL: kullanıcı iskeletin nerede
// bittiğini görüyor (bkz. cp-fead.js _feadPending ile aynı gerekçe).

function _strStub(){
  return '<div class="sw-panel">' + _strPending() + '</div>';
}

// ════════════════════════════════════════════════════════════════════════════
//  GEOMETRİ — STEP İÇE AKTARMA + 3B GÖRÜNTÜLEYİCİ
// ════════════════════════════════════════════════════════════════════════════
// Zincirin ilk bileşeni artık DOLU. Sunum katmanı: dosyayı alır, köprüye
// (js/structural-model.js) verir, dönen modeli künye + 3B görüntüleyici olarak
// gösterir. KENDİ GEOMETRİSİNİ HESAPLAMAZ — tek üçgen bile burada üretilmiyor.
//
// UZANTI SÜZGECİ VAR ve gerekli (measure-dropzone.js'teki .png dersinin
// aynısı): occt keyfî bir ikili dosyada `success:false` döner, ama kullanıcının
// gördüğü mesaj "STEP olarak okunamadı" olur — oysa sorun dosyanın STEP
// OLMAMASIDIR. Kapıyı önce uzantı tutuyor ki sebep doğru yazılsın.
var VE_STR_STEP_EXT = /\.(stp|step)$/i;

// STEP KAYNAĞI node.data'DA DURMAZ — oturumluk depoda durur ve yalnız proje
// DOSYAYA kaydedilirken enjekte edilir (js/structural-model.js veStrSrcAttach).
// Gerekçesi ölçülmüş: node.data'ya yazılan kaynak her `saveState()`'te derin
// kopyalanıp 50 adımlık undo yığınına biniyor ve localStorage yedeğini bozuyor
// (ayrıntı model katmanının başlığında). Sınır da orada: VE_STR_SRC_STORE_LIMIT.

// Ağ inceliği kademeleri. Değer `bounding_box_ratio` — parçanın boyuna ORAN,
// mutlak mm değil (bkz. structural-model.js VE_STR_GEOM_DEFLECTION).
// TEKRAR: bu ağ FEA ağı DEĞİL, yalnız görüntüleme ve yüz aralıkları içindir.
var VE_STR_QUALITY = [
  { key: 'kaba', label: 'Kaba',  linear: 0.01,   hint: 'hızlı önizleme' },
  { key: 'orta', label: 'Orta',  linear: 0.002,  hint: 'varsayılan' },
  { key: 'ince', label: 'İnce',  linear: 0.0005, hint: 'yuvarlatmalar belirginleşir' }
];

// İçe aktarma sürerken ikinci bir çağrıyı engelle (kullanıcı düğmeye iki kez
// basarsa iki okuma birbirinin üstüne yazardı).
var _veStrGeomBusy = {};

function _strNodeById(nodeId){
  if(typeof nodes === 'undefined') return null;
  return nodes.find(function(n){ return n.id === nodeId; }) || null;
}

// Türkçe sayı biçimi. NaN/null → '—' (0 DEĞİL: girilmemiş bir değeri "0 ölçüldü"
// gibi göstermek cp-fead-report.js'te belgelenmiş sessiz hata sınıfı).
function _strFmt(v, dec){
  var n = Number(v);
  if(v === null || v === undefined || v === '' || !isFinite(n)) return '—';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: dec || 0, maximumFractionDigits: (dec === undefined ? 0 : dec) });
}
function _strBytes(n){
  var v = Number(n);
  if(!isFinite(v) || v <= 0) return '—';
  if(v < 1024) return v + ' B';
  if(v < 1024 * 1024) return _strFmt(v / 1024, 1) + ' KB';
  return _strFmt(v / (1024 * 1024), 2) + ' MB';
}

// Oturumluk STEP kaynağı — sahibi model katmanı. Panel yalnız iki şey için
// okuyor: ağ inceliği değişince dosyayı yeniden SORMADAN üçgenlemek, ve
// kaynağın projeye yazılıp yazılmayacağını kullanıcıya söylemek.
function _strSourceSet(nodeId, bytes, name, size){
  if(typeof veStrSrcSet === 'function') veStrSrcSet(nodeId, bytes, name, size);
}
function _strSourceGet(nodeId){
  return (typeof veStrSrcGet === 'function') ? veStrSrcGet(nodeId) : null;
}

// ─── İLERLEME ARAYÜZÜ ───────────────────────────────────────────────────────
// STEP çözümlemesi artık WORKER'da (bkz. structural-model.js): ana iş
// parçacığı boşta olduğu için buradaki animasyon GERÇEKTEN akar. Bu bir süs
// değil, işin sürdüğünün TEK kanıtı — donmuş bir arayüzde kullanıcı programın
// çöktüğünü sanıp sekmeyi kapatıyor.
//
// AŞAMA ADLARI structural-model.js'ten geliyor (VE_STR_STAGES). Yalnız
// 'download' belirli bir yüzde taşır; kalan üçü OCCT'nin içinde tek bir
// çağrıdır ve oraya uydurma bir yüzde koymak yalan olurdu → belirsiz kipte
// akan çubuk + geçen süre.
// Kartın ANA SATIRI dosyanın adıdır; aşama alt satırda. Kullanıcının beklediği
// şey PARÇANIN işlenmesi — okuyucunun hazırlanması bir uygulama ayrıntısıdır ve
// yalnız ilk içe aktarmada, kısa bir alt satır olarak geçer.
//
// `download` normalde HİÇ GÖRÜLMEZ: .wasm uygulamaya gömülü. Yalnız gömülü
// varlık yoksa (eski tarayıcı → DecompressionStream yok) yedek yolda çıkar.
var VE_STR_STAGE_TEXT = {
  reader:   'Okuyucu hazırlanıyor',
  download: 'STEP okuyucusu indiriliyor',
  parse:    'Geometri çözümleniyor',
  build:    'Sahne kuruluyor'
};

// Geçen süre sayacı — düğüm kimliğine göre. Sayacın AKMASI, "program çalışıyor"
// diyen en ucuz ve en dürüst işaret.
var _veStrProgTimer = {};

function _strProgEl(){ return (typeof document !== 'undefined') ? document.getElementById('ve-str-geom-progress') : null; }

function _strProgStart(nodeId, fileName, fileSize){
  var el = _strProgEl();
  if(!el) return;
  var t0 = Date.now();
  el.innerHTML =
      '<div class="ve-str-prog">'
    +   '<div class="ve-str-prog-head">'
    +     '<span class="ve-str-prog-spin"></span>'
    +     '<b>' + _strEsc(fileName || 'Geometri') + '</b>'
    +   '</div>'
    +   '<div class="ve-str-prog-file">' + _strBytes(fileSize) + ' · <span data-ve="stage">içe aktarılıyor</span></div>'
    +   '<div class="ve-str-prog-bar"><i data-ve="fill" class="indet"></i></div>'
    +   '<div class="ve-str-prog-foot"><span data-ve="detail"></span><span data-ve="clock">0,0 sn</span></div>'
    + '</div>';
  el.style.display = 'block';
  if(_veStrProgTimer[nodeId]) clearInterval(_veStrProgTimer[nodeId]);
  _veStrProgTimer[nodeId] = setInterval(function(){
    var c = _strProgEl();
    c = c && c.querySelector('[data-ve="clock"]');
    if(!c){ clearInterval(_veStrProgTimer[nodeId]); delete _veStrProgTimer[nodeId]; return; }
    c.textContent = _strFmt((Date.now() - t0) / 1000, 1) + ' sn';
  }, 100);
}

function _strProgSet(nodeId, stage, info){
  var el = _strProgEl();
  if(!el) return;
  var s = el.querySelector('[data-ve="stage"]');
  var fill = el.querySelector('[data-ve="fill"]');
  var det = el.querySelector('[data-ve="detail"]');
  if(s) s.textContent = VE_STR_STAGE_TEXT[stage] || stage;
  if(!fill || !det) return;
  if(stage === 'download' && info && info.pct != null){
    // BELİRLİ: gerçekten bilinen tek yüzde.
    fill.className = '';
    fill.style.width = Math.max(2, Math.round(info.pct * 100)) + '%';
    det.textContent = _strBytes(info.loaded) + ' / ' + _strBytes(info.total);
  } else if(stage === 'download' && info && info.loaded){
    // Toplam bilinmiyor ama İNDİRİLEN biliniyor — sayı akıyorsa kullanıcı
    // işin ilerlediğini görür; sahte bir yüzdeye gerek yok.
    fill.className = 'indet';
    fill.style.width = '';
    det.textContent = _strBytes(info.loaded) + ' indirildi';
  } else {
    fill.className = 'indet';
    fill.style.width = '';
    det.textContent = (info && info.fallback)
      ? 'worker açılamadı — ana iş parçacığında sürüyor'
      : (stage === 'parse' ? 'worker\'da'
      : (stage === 'reader' ? 'ilk içe aktarma — bir kez' : ''));
  }
}

function _strProgEnd(nodeId){
  if(_veStrProgTimer[nodeId]){ clearInterval(_veStrProgTimer[nodeId]); delete _veStrProgTimer[nodeId]; }
  var el = _strProgEl();
  if(el){ el.innerHTML = ''; el.style.display = 'none'; }
}

// Panelin durum satırına yaz — PANELİ YENİDEN ÇİZMEDEN. İçe aktarma sırasında
// panel yeniden çizilirse kullanıcının bastığı düğme ve dosya girdisi DOM'dan
// silinir; ayrıca 3B kanvas yeniden kurulur (WebGL bağlamı boşuna yenilenir).
function _strStatus(nodeId, msg, kind){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-str-geom-status');
  if(!el) return;
  var col = (kind === 'err') ? 'var(--accent-danger, #ef4444)'
          : (kind === 'ok') ? 'var(--accent-success, #22c55e)'
          : 'var(--text-secondary)';
  el.style.color = col;
  el.innerHTML = msg ? _strEsc(msg) : '';
}

// ── KANVAS ROZETİ: parça yüklü mü, kaç CAD yüzü var ─────────────────────────
// Zincirin ilk halkası boşsa geri kalan üçü de boştur; ama kanvasta Geometri
// kutusu dolu ile boş arasında HİÇ fark göstermiyordu — kullanıcı panelini
// açmadan bilemiyordu. Rozet iki şeyi söylüyor: parça geldi mi, ve kaç CAD
// YÜZÜ var (sınır koşullarının bağlanacağı sayı).
//
// Stil ELEMANIN ÜSTÜNDE, css/ dosyasında değil — `css/styles.css`'e dokunmak
// Ölçüm Görüntüleyici'nin dağıtım dosyasını bayatlatıyor (bkz. CLAUDE.md);
// tek rozet için o zinciri kurmaya değmez. FEAD rozetiyle (veFeadApplyBadge)
// aynı gerekçe, aynı biçim.
function veStrApplyBadge(nodeEl, node){
  if(!nodeEl || !node || typeof document === 'undefined') return false;
  var old = nodeEl.querySelector('.ve-str-badge');
  if(old) old.remove();
  if(node.type !== 'str-geometry') return false;

  var g = node.data && node.data.geometry;
  var dolu = !!(g && g.stats);
  var b = document.createElement('span');
  b.className = 've-str-badge';
  if(dolu){
    b.textContent = '⬡' + (g.stats.faceCount || 0);
    b.title = (g.fileName || 'Parça') + ' · ' + _strFmt(g.stats.triCount) + ' üçgen · '
            + _strFmt(g.stats.faceCount) + ' CAD yüzü';
  } else {
    // Boşken de rozet VAR: "rozet yok" ile "parça yok" ayırt edilemezdi.
    b.textContent = 'STEP';
    b.title = 'Henüz parça içe aktarılmadı — panelden .step/.stp seçin.';
  }
  b.style.cssText = 'position:absolute; top:-9px; right:-6px; z-index:3; pointer-events:none;'
    // Ölçek jetonu — ham px değil (bkz. tests/unit/typography-scale.test.js).
    + 'font-size:var(--fs-micro); font-weight:700; line-height:1; letter-spacing:0.02em;'
    + 'padding:2px 4px; border-radius:3px; font-family:ui-monospace, monospace;'
    + 'color:#fff; background:' + (dolu ? 'var(--accent-warning, #f59e0b)' : 'var(--text-muted, #888)')
    + '; border:1px solid var(--bg-primary, #111);';
  var box = nodeEl.querySelector('.ve-node-box') || nodeEl;
  box.appendChild(b);
  return true;
}

// Tek düğümün rozetini tazele (içe aktarma / kaldırma sonrası).
function veStrRefreshBadge(nodeId){
  if(typeof document === 'undefined') return false;
  var node = _strNodeById(nodeId);
  var el = node ? document.getElementById(node.id) : null;
  return (el && node) ? veStrApplyBadge(el, node) : false;
}

function veStrGeomPick(nodeId){
  var inp = document.getElementById('ve-str-geom-file');
  if(inp) { inp.value = ''; inp.click(); }
}

function veStrGeomFileChosen(nodeId, inputEl){
  var f = inputEl && inputEl.files && inputEl.files[0];
  if(f) _strGeomIngest(nodeId, f);
}

// Sürükle-bırak. dragover'da preventDefault ŞART: yoksa tarayıcı bırakılan
// dosyaya GİDER (measure-dropzone.js'te belgelenmiş; sekme dosyayı açmaya
// kalkar ve o ana kadarki proje kaybolur).
function veStrGeomDragOver(ev){
  ev.preventDefault();
  ev.stopPropagation();
  if(ev.currentTarget && ev.currentTarget.classList) ev.currentTarget.classList.add('on');
}
function veStrGeomDragLeave(ev){
  if(ev.currentTarget && ev.currentTarget.classList) ev.currentTarget.classList.remove('on');
}
function veStrGeomDrop(nodeId, ev){
  ev.preventDefault();
  ev.stopPropagation();
  if(ev.currentTarget && ev.currentTarget.classList) ev.currentTarget.classList.remove('on');
  var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
  if(f) _strGeomIngest(nodeId, f);
}

function _strGeomIngest(nodeId, file){
  if(!VE_STR_STEP_EXT.test(file.name || '')){
    _strStatus(nodeId, 'Bu bir STEP dosyası değil: ' + file.name + ' — beklenen uzantı .step ya da .stp', 'err');
    return;
  }
  var rd = new FileReader();
  rd.onerror = function(){ _strStatus(nodeId, 'Dosya okunamadı: ' + file.name, 'err'); };
  rd.onload = function(){
    var bytes = new Uint8Array(rd.result);
    _strSourceSet(nodeId, bytes, file.name, file.size);
    _strGeomRun(nodeId, bytes, { fileName: file.name, fileSize: file.size });
  };
  rd.readAsArrayBuffer(file);
}

// Ağ inceliği kademesini değiştir → dosyayı YENİDEN SORMADAN yeniden üçgenle.
function veStrGeomSetQuality(nodeId, key){
  var node = _strNodeById(nodeId);
  if(!node) return;
  if(!node.data) node.data = {};
  node.data.geomQuality = key;
  var src = _strSourceGet(nodeId);
  if(!src){
    // Kaynak oturumda yok (proje yeni açıldı ve dosya sınırın üstündeydi).
    _strStatus(nodeId, 'Ağ inceliğini değiştirmek için STEP dosyası yeniden içe aktarılmalı.', 'err');
    return;
  }
  _strGeomRun(nodeId, src.bytes, { fileName: src.name, fileSize: src.size });
}

function _strQualityOf(node){
  var key = (node && node.data && node.data.geomQuality) || 'orta';
  for(var i = 0; i < VE_STR_QUALITY.length; i++) if(VE_STR_QUALITY[i].key === key) return VE_STR_QUALITY[i];
  return VE_STR_QUALITY[1];
}

// İçe aktarmanın TEK yolu. Hem dosya seçme, hem bırakma, hem incelik değişimi,
// hem proje açılışında kaynaktan geri yükleme buradan geçer — iki ayrı yol
// açmak iki davranışın zamanla ayrışması demekti.
function _strGeomRun(nodeId, bytes, meta){
  if(_veStrGeomBusy[nodeId]) return;
  if(typeof veStrImportStep !== 'function'){
    _strStatus(nodeId, 'STEP köprüsü yüklenmemiş (js/structural-model.js).', 'err');
    return;
  }
  var node = _strNodeById(nodeId);
  if(!node) return;
  if(!node.data) node.data = {};
  var q = _strQualityOf(node);

  _veStrGeomBusy[nodeId] = true;
  _strStatus(nodeId, '');
  _strProgStart(nodeId, meta.fileName, meta.fileSize);

  var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  veStrImportStep(bytes, {
    fileName: meta.fileName, fileSize: meta.fileSize,
    importedAt: new Date().toISOString(),
    deflection: { type: 'bounding_box_ratio', linear: q.linear, angular: 0.5 }
  }, {
    onProgress: function(stage, info){ _strProgSet(nodeId, stage, info); }
  }).then(function(geom){
    _veStrGeomBusy[nodeId] = false;
    _strProgEnd(nodeId);
    if(!geom || !geom.ok){
      _strStatus(nodeId, (geom && geom.error) || 'İçe aktarma başarısız.', 'err');
      return;
    }
    var ms = t0 ? Math.round(((performance.now() - t0))) : 0;

    if(typeof veStrGeomCacheSet === 'function') veStrGeomCacheSet(nodeId, geom);
    var rec = (typeof veStrGeomRecord === 'function') ? veStrGeomRecord(geom) : null;
    if(rec){
      // KÜNYE HAFİF: ne üçgen ne STEP kaynağı girer. İkisi de türetilmiş ya da
      // oturumluk; node.data her `saveState()`'te derin kopyalanıyor.
      node.data.geometry = rec;
    }
    if(typeof saveState === 'function') { try { saveState(); } catch(e){} }
    veStrRefreshBadge(nodeId);
    if(typeof showNodeProperties === 'function') showNodeProperties(node);
    _strStatus(nodeId, 'İçe aktarıldı · ' + geom.stats.triCount + ' üçgen · '
      + geom.stats.faceCount + ' CAD yüzü' + (ms ? ' · ' + ms + ' ms' : '')
      + (geom.worker ? '' : ' · ana iş parçacığı'), 'ok');
  })['catch'](function(e){
    _veStrGeomBusy[nodeId] = false;
    _strProgEnd(nodeId);
    _strStatus(nodeId, 'İçe aktarma hatası: ' + ((e && e.message) || e), 'err');
  });
}

function veStrGeomRemove(nodeId){
  var node = _strNodeById(nodeId);
  if(!node) return;
  if(node.data) { node.data.geometry = null; }
  if(typeof veStrGeomCacheClear === 'function') veStrGeomCacheClear(nodeId);
  if(typeof veStrSrcClear === 'function') veStrSrcClear(nodeId);
  if(typeof veStrViewerDispose === 'function') veStrViewerDispose();
  delete _veStrSelFace[nodeId];
  if(typeof saveState === 'function') { try { saveState(); } catch(e){} }
  veStrRefreshBadge(nodeId);
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
}

// Panel DOM'u kurulduktan SONRA çağrılır (cp-core.js kancası). Görüntüleyici
// oturumluk önbellekten beslenir; önbellek boşsa (proje yeni açıldı) node.data
// içindeki STEP kaynağından SESSİZCE yeniden üretilir.
function veStrGeomMountViewer(nodeId){
  var node = _strNodeById(nodeId);
  if(!node || !node.data || !node.data.geometry) return;
  var geom = (typeof veStrGeomCacheGet === 'function') ? veStrGeomCacheGet(nodeId) : null;
  if(geom && geom.ok){
    if(typeof veStrViewerInit === 'function') veStrViewerInit('ve-str-geom-canvas', geom, nodeId);
    return;
  }
  // Önbellek yok (proje yeni açıldı) → oturumluk kaynaktan yeniden üret.
  // Kaynak proje yüklenirken node.data'dan çıkarılıp depoya alınmıştı
  // (veStrSrcHarvest); orada da yoksa dosya kaydedilmemiş demektir.
  var src = _strSourceGet(nodeId);
  if(!src || !src.bytes){
    _strStatus(nodeId, 'Geometri künyesi kayıtlı ama STEP kaynağı bu projede saklanmamış — '
      + 'dosyayı yeniden içe aktarın.', 'err');
    return;
  }
  _strGeomRun(nodeId, src.bytes, { fileName: src.name || node.data.geometry.fileName,
                                   fileSize: src.size || node.data.geometry.fileSize });
}

// ═══════════════════════════════════════════════════════════════════════════
//  CAD YÜZ LİSTESİ — Sınır Koşullarının doğrudan hazırlığı
// ═══════════════════════════════════════════════════════════════════════════
// Yüz kimliği (`m<mesh>/f<yüz>`) sınır koşulunun bağlanacağı dizgi. 3B'de
// fareyle bulmak keşif için iyi ama 160 yüzlü bir montajda "hangi yüzü
// seçtim / hangileri var" sorusuna cevap vermiyor. Liste ile 3B TEK bir
// seçimi paylaşıyor: listeden tıkla → parçada vurgulanır, parçada tıkla →
// listede işaretlenir ve görünüre kaydırılır.
//
// Seçim OTURUMLUK (node.data'ya yazılmıyor): bir vurgu tercihi her
// `saveState()`'te undo yığınına binmemeli. Sınır Koşulları bileşeni kendi
// kalıcı bağlarını kuracak — o zaman kimlik zaten künyede duruyor.
var _veStrSelFace = {};

function _strFaceRowId(faceId){
  return 've-str-face-' + String(faceId).replace(/[^a-zA-Z0-9]/g, '_');
}

function _strFaceListHTML(node, rec){
  var faces = (rec && rec.faces) || [];
  if(!faces.length) return '';
  var secili = _veStrSelFace[node.id] || '';
  // Çok katılı montajda hangi yüzün hangi parçaya ait olduğu ancak adla
  // anlaşılır; tek katıda sütun gereksiz yer kaplar.
  var cokKati = !!(rec.stats && rec.stats.meshCount > 1);

  var h = '<div class="sw-section-title">CAD yüzleri (' + _strFmt(faces.length) + ')</div>';
  h += '<div class="ve-str-faces" id="ve-str-face-list">';
  faces.forEach(function(f){
    h += '<button type="button" class="ve-str-face' + (f.id === secili ? ' on' : '') + '" '
       + 'id="' + _strFaceRowId(f.id) + '" data-face="' + _strEsc(f.id) + '" '
       + 'onclick="veStrGeomSelectFace(\'' + node.id + '\', \'' + _strEsc(f.id) + '\')">'
       + '<span class="ve-str-face-id">' + _strEsc(f.id) + '</span>'
       + (cokKati ? '<span class="ve-str-face-mesh">' + _strEsc(f.meshName || '') + '</span>' : '')
       + '<span class="ve-str-face-tri">' + _strFmt(f.triCount) + '</span>'
       + '</button>';
  });
  h += '</div>';
  h += '<div class="ve-str-face-sel" id="ve-str-face-sel">' + _strFaceSelText(node.id) + '</div>';
  return h;
}

function _strFaceSelText(nodeId){
  var id = _veStrSelFace[nodeId];
  if(!id) return 'Seçili yüz yok — listeden ya da parçanın üstünden tıklayın.';
  return 'Seçili: <b>' + _strEsc(id) + '</b>';
}

// Listeden ya da 3B'den seçim — tek yol, iki giriş.
function veStrGeomSelectFace(nodeId, faceId){
  var onceki = _veStrSelFace[nodeId];
  // Aynı yüze ikinci tık seçimi KALDIRIR: seçimden çıkmanın başka yolu yoktu.
  var yeni = (onceki === faceId) ? '' : faceId;
  _veStrSelFace[nodeId] = yeni;
  if(typeof veStrViewerSelectFace === 'function') veStrViewerSelectFace(yeni || null);
  _strFaceMarkRow(nodeId, 'on', yeni);
  var el = (typeof document !== 'undefined') ? document.getElementById('ve-str-face-sel') : null;
  if(el) el.innerHTML = _strFaceSelText(nodeId);
}

// Satır işaretle. PANELİ YENİDEN ÇİZMEDEN — 160 satırlık listeyi her fare
// hareketinde yeniden kurmak hem pahalı hem de kaydırma konumunu sıfırlardı.
function _strFaceMarkRow(nodeId, sinif, faceId){
  if(typeof document === 'undefined') return;
  var list = document.getElementById('ve-str-face-list');
  if(!list) return;
  var eski = list.querySelectorAll('.' + sinif);
  Array.prototype.forEach.call(eski, function(e){ e.classList.remove(sinif); });
  if(!faceId) return;
  var row = document.getElementById(_strFaceRowId(faceId));
  if(row) row.classList.add(sinif);
  return row;
}

// 3B'de fare bir yüzün üstündeyken listede de işaretlensin.
function veStrGeomOnHoverFace(face){
  _strFaceMarkRow(null, 'hover', face ? face.id : '');
}

// 3B'de bir yüze tıklanınca: listede seç ve satırı GÖRÜNÜRE KAYDIR — 160
// satırlık listede seçilen satır ekran dışında kalırsa seçim görünmez olurdu.
function veStrGeomOnPickFace(face){
  if(!face) return;
  var nodeId = null;
  if(typeof nodes !== 'undefined'){
    var n = nodes.find(function(x){ return x.type === 'str-geometry' && x.data && x.data.geometry; });
    if(n) nodeId = n.id;
  }
  if(!nodeId) return;
  _veStrSelFace[nodeId] = face.id;
  var row = _strFaceMarkRow(nodeId, 'on', face.id);
  if(row && row.scrollIntoView) { try { row.scrollIntoView({ block: 'nearest' }); } catch(e){} }
  var el = (typeof document !== 'undefined') ? document.getElementById('ve-str-face-sel') : null;
  if(el) el.innerHTML = _strFaceSelText(nodeId);
}

// İlerleme kartının ve durum satırının yuvaları. Panel içe aktarma SIRASINDA
// yeniden çizilmiyor (kullanıcının bastığı düğme DOM'dan silinmesin), bu
// yüzden ikisi de yerinde güncelleniyor (_strProgSet / _strStatus).
function _strStatusSlots(){
  return '<div id="ve-str-geom-progress" style="display:none; margin-top:9px;"></div>'
       + '<div id="ve-str-geom-status" style="margin:9px 0; font-size:var(--fs-micro); line-height:1.45; min-height:1.2em; color:var(--text-secondary);"></div>';
}

// ─── Panel ──────────────────────────────────────────────────────────────────
function _strGeomImportCard(node){
  var h = '';
  h += '<div class="ve-str-drop" data-ve-dropzone ondragover="veStrGeomDragOver(event)" ondragleave="veStrGeomDragLeave(event)" '
     + 'ondrop="veStrGeomDrop(\'' + node.id + '\', event)">';
  h += '<div class="ve-str-drop-ico"><svg width="34" height="34" viewBox="0 0 100 100">'
     + '<path d="M28 40 L52 26 L76 40 L76 66 L52 80 L28 66 Z" fill="none" stroke="var(--text-muted, #888)" stroke-width="5" stroke-linejoin="round"/>'
     + '<path d="M28 40 L52 54 L76 40 M52 54 V80" fill="none" stroke="var(--text-muted, #888)" stroke-width="3.5" stroke-linejoin="round"/>'
     + '<path d="M52 8 v18 M45 20 l7 8 l7 -8" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
     + '</svg></div>';
  h += '<div class="ve-str-drop-txt"><b>STEP dosyasını buraya bırakın</b><br><span>ya da seçin — .step / .stp</span></div>';
  h += '<button onclick="veStrGeomPick(\'' + node.id + '\')" class="ve-str-btn ve-str-btn--primary">Dosya Seç</button>';
  h += '<input type="file" id="ve-str-geom-file" accept=".step,.stp" style="display:none" '
     + 'onchange="veStrGeomFileChosen(\'' + node.id + '\', this)">';
  h += '</div>';
  return h;
}

function _strGeomInfoTable(g){
  var bb = g.bbox || {};
  var sz = bb.size || [];
  function row(k, v){
    return '<tr><td style="padding:4px 8px; border:1px solid var(--border-color); color:var(--text-secondary); white-space:nowrap;">' + k + '</td>'
         + '<td style="padding:4px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">' + v + '</td></tr>';
  }
  var h = '<table style="width:100%; font-size:var(--fs-tiny); border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:9px;">';
  h += row('Dosya', _strEsc(g.fileName || '—') + ' <span style="color:var(--text-muted); font-weight:400;">(' + _strBytes(g.fileSize) + ')</span>');
  h += row('Birim', 'mm <span style="color:var(--text-muted); font-weight:400;">(dosyanın kendi birimi okunup çevrildi)</span>');
  h += row('Ölçü (X×Y×Z)', _strFmt(sz[0], 2) + ' × ' + _strFmt(sz[1], 2) + ' × ' + _strFmt(sz[2], 2) + ' mm');
  h += row('Köşegen', _strFmt(bb.diag, 2) + ' mm');
  h += row('Katı / kabuk', _strFmt(g.stats.meshCount));
  h += row('CAD yüzü', '<span style="color:var(--accent-warning);">' + _strFmt(g.stats.faceCount) + '</span>'
      + ' <span style="color:var(--text-muted); font-weight:400;">← sınır koşulları buraya bağlanacak</span>');
  h += row('Görüntü üçgeni', _strFmt(g.stats.triCount) + ' <span style="color:var(--text-muted); font-weight:400;">(FEA ağı değil)</span>');
  h += '</table>';
  return h;
}

function getStrGeometryPropertiesHTML(node){
  if(!node.data) node.data = {};
  var rec = node.data.geometry || null;
  var q = _strQualityOf(node);

  // ── SOL: kimlik · içe aktarma · künye · denetimler ──
  var left = '';
  if(!rec){
    left += _strGeomImportCard(node);
    left += _strStatusSlots();
  } else {
    left += _strGeomInfoTable(rec);
    // Durum ve ilerleme KÜNYENİN HEMEN ALTINDA. Panelin en altındayken
    // ölçüldü: 1600×1000'de bile katlamanın 5 px altında kalıyordu ve
    // "İçe aktarıldı · 4.902 üçgen · 240 CAD yüzü" — yani kullanıcının içe
    // aktarmadan hemen sonra görmek istediği tek satır — görünmüyordu.
    left += _strStatusSlots();

    left += '<div class="sw-section-title">Görüntü ağı inceliği</div>';
    left += '<div class="ve-str-seg">';
    VE_STR_QUALITY.forEach(function(o){
      left += '<button class="ve-str-seg-btn' + (o.key === q.key ? ' on' : '') + '" title="' + _strEsc(o.hint) + '" '
            + 'onclick="veStrGeomSetQuality(\'' + node.id + '\', \'' + o.key + '\')">' + o.label + '</button>';
    });
    left += '</div>';
    left += '<div style="font-size:var(--fs-micro); color:var(--text-muted); margin:4px 0 9px; line-height:1.4;">'
          + 'Görüntü ağı — hesaplama ağı değil. CAD yüz kimlikleri incelikten bağımsızdır.</div>';

    left += '<div class="sw-section-title">Görünüm</div>';
    left += '<div class="ve-str-seg">';
    [['iso', 'İzo'], ['front', 'Ön'], ['top', 'Üst'], ['right', 'Sağ']].forEach(function(v){
      left += '<button class="ve-str-seg-btn" onclick="veStrViewerView(\'' + v[0] + '\')">' + v[1] + '</button>';
    });
    left += '</div>';
    left += '<div style="display:flex; gap:6px; margin-top:6px; align-items:center; flex-wrap:wrap;">';
    left += '<button class="ve-str-btn" onclick="veStrViewerReset()">Sıfırla</button>';
    left += '<label style="display:flex; align-items:center; gap:5px; font-size:var(--fs-micro); color:var(--text-secondary); cursor:pointer;">'
          + '<input type="checkbox" checked onchange="veStrViewerToggleEdges(this.checked)"> Kenarlar</label>';
    left += '</div>';

    left += _strFaceListHTML(node, rec);

    left += '<div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">';
    left += '<button class="ve-str-btn" onclick="veStrGeomPick(\'' + node.id + '\')">Başka Dosya</button>';
    left += '<button class="ve-str-btn ve-str-btn--danger" onclick="veStrGeomRemove(\'' + node.id + '\')">Kaldır</button>';
    left += '<input type="file" id="ve-str-geom-file" accept=".step,.stp" style="display:none" '
          + 'onchange="veStrGeomFileChosen(\'' + node.id + '\', this)">';
    left += '</div>';

    // Kaynağın projeyle kaydedilip kaydedilmeyeceğini AÇIKÇA yaz. Sessiz
    // bırakılsaydı kullanıcı projeyi kaydedip kapatır, geri açtığında
    // geometrinin gitmiş olduğunu ancak orada görürdü. Durum CANLI depodan
    // okunuyor — künyeye yazılmış bayat bir bayraktan değil.
    var kalir = (typeof veStrSrcWillPersist === 'function') && veStrSrcWillPersist(node.id);
    left += '<div style="margin-top:9px; padding:6px 9px; font-size:var(--fs-micro); line-height:1.45; border:1px solid var(--border-color); '
          + 'color:' + (kalir ? 'var(--text-muted)' : 'var(--accent-warning)') + '; background:var(--bg-secondary);">'
          + (kalir
              ? 'STEP kaynağı proje dosyasına sıkıştırılarak yazılır. Otomatik yedeğe yazılmaz.'
              : 'STEP kaynağı bu oturumda yok — geometri künyesi duruyor, yeniden içe aktarma gerekiyor.')
          + '</div>';
  }


  // ── SAĞ: 3B görüntüleyici ──
  // Ölçü SATIR İÇİNDE DEĞİL sınıfta (.ve-str-vwr-box): parça yüklüyken pencere
  // büyük açılıyor (.ve-properties--strgeom) ve kutu orada panelin BOYUNU
  // dolduruyor — satır içi `height` onu ezerdi.
  var right = '<div id="ve-str-geom-wrap" class="ve-str-vwr-box">';
  if(rec){
    right += '<canvas id="ve-str-geom-canvas" style="width:100%; height:100%; display:block;"></canvas>';
    right += '<div class="ve-str-vwr-hint">Sol tık döndür · sağ tık kaydır · tekerlek yakınlaş · parçanın üstüne gel → <b>CAD yüzü</b></div>';
  } else {
    right += '<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:20px; '
           + 'font-size:var(--fs-tiny); color:var(--text-muted); line-height:1.6;">'
           + 'Parça içe aktarılmadı</div>';
  }
  right += '</div>';

  var html = '<div class="sw-panel">';
  html += '<div class="ve-cp-grid ve-cp-grid--wideright ve-str-geom-grid">';
  html += '<div class="ve-cp-col ve-cp-col--in ve-str-col-in">' + left + '</div>';
  html += '<div class="ve-cp-col ve-cp-col--out ve-str-col-out">' + right + '</div>';
  html += '</div></div>';
  return html;
}

function getStrMeshPropertiesHTML(node){
  return _strStub();
}

function getStrBCPropertiesHTML(node){
  return _strStub();
}

function getStrResultsPropertiesHTML(node){
  return _strStub();
}

// ── Test köprüsü ────────────────────────────────────────────────────────────
// Tarayıcıda bu dosya düz <script> olarak yüklenir; Node tarafında testler
// require ile alabilsin diye guard'lı dışa aktarım (cp-arac-performans.js ile
// aynı kalıp). Üst-seviye bildirim EKLEMEZ → source-hygiene kapısına takılmaz.
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_STR_STARTER_LAYOUT: VE_STR_STARTER_LAYOUT,
    VE_STR_STARTER_CHAIN: VE_STR_STARTER_CHAIN,
    VE_STR_STEP_EXT: VE_STR_STEP_EXT,
    VE_STR_QUALITY: VE_STR_QUALITY,
    veStrApplyBadge: veStrApplyBadge,
    veStrGeomSelectFace: veStrGeomSelectFace,
    getStrModulePropertiesHTML: getStrModulePropertiesHTML,
    getStrGeometryPropertiesHTML: getStrGeometryPropertiesHTML,
    getStrMeshPropertiesHTML: getStrMeshPropertiesHTML,
    getStrBCPropertiesHTML: getStrBCPropertiesHTML,
    getStrResultsPropertiesHTML: getStrResultsPropertiesHTML
  };
}
