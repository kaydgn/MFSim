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
//
// MALZEME ZİNCİRİN İÇİNDE DEĞİL, GEOMETRİ'NİN ALTINDA: zincir yatay bir
// şerittir (Geometri → Ağ → Sınır Koşulları → Sonuçlar); Malzeme o şeridin
// ALTINA, Geometri'nin tam hizasına iner. Şeridin içine dizilseydi beşinci bir
// halka gibi okunurdu — oysa çıkışı yok, zincire giremez.
//
// GEOMETRİ'NİN ADI SOLA ALINDI ve bu bir zevk tercihi değil, ÖLÇÜLMÜŞ bir
// çakışmanın düzeltmesi. Malzeme teli Geometri'nin ALT portundan dümdüz iniyor;
// ad varsayılan yerinde (kutunun altında, ortalı) dururken tel tam onun
// ÜSTÜNDEN geçiyordu — projenin kendi yerleşim kuralının ihlali
// (bkz. tests/unit/arac-example-layout.test.js: "dik açılı tel ne bileşenin ne
// de bir ADIN üstünden geçer"). Dört seçenek gerçek tarayıcıda ölçüldü:
//
//   bottom (varsayılan)  tel adı KESİYOR                        ✗
//   top                  tel temiz, ama STEP ROZETİ adın üstünde ✗
//   right                tel temiz, ama ad ZİNCİR TELİNİN üstünde ✗
//   left                 ikisi de temiz                          ✓
//
// Ad kullanıcının tercihidir (sağ tık → Etiket Konumu); bu yalnız VARSAYILAN.
var VE_STR_STARTER_LAYOUT = [
  { type:'str-geometry', lx: 40, ly:  40, labelPos: 'left' },
  { type:'str-mesh',     lx:190, ly:  40 },
  { type:'str-bc',       lx:340, ly:  40 },
  { type:'str-results',  lx:490, ly:  40 },
  // Geometri kutusu 62 geniş, Malzeme 50 → 6 px sağa kaydırınca ikisi ORTALANIR
  // ve tel dümdüz iner (Geometri alt portu %50'de, Malzeme üst portu %50'de).
  { type:'str-material', lx: 46, ly: 150 }
];

// Kenarlar — yerleşim dizisindeki İNDİSLERLE değil TİPLERLE yazıldı: yerleşim
// yeniden sıralanırsa indisli bir tablo sessizce yanlış bağlanırdı.
// Dördüncü alan PORTU da yazıyor: Geometri'nin artık İKİ çıkışı var
// (output-0 = zincir, output-1 = malzeme eki) ve hangisinin hangisi olduğu
// varsayılana bırakılamaz — 'output' yazsaydık ikisi de aynı ağızdan çıkardı.
var VE_STR_STARTER_CHAIN = [
  ['str-geometry', 'str-mesh',     'output-0', 'input'],
  ['str-mesh',     'str-bc',       'output',   'input'],
  ['str-bc',       'str-results',  'output',   'input'],
  ['str-geometry', 'str-material', 'output-1', 'input']
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
      if(it.labelPos){
        if(!n.data) n.data = {};
        n.data.labelPos = it.labelPos;
        if(typeof applyNodeLabelPos === 'function') applyNodeLabelPos(n);
      }
      created.push(n);
      byType[it.type] = n.id;
    }
  });

  if(typeof createConnection === 'function'){
    VE_STR_STARTER_CHAIN.forEach(function(e){
      if(byType[e[0]] && byType[e[1]]) createConnection(byType[e[0]], byType[e[1]], e[2], e[3]);
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
  // Kütüphane tarama durumu da oturumluk (arama metni, seçili kategori/kayıt).
  if(typeof _strLibForget === 'function') _strLibForget();
  if(typeof veStrSrcClear === 'function') veStrSrcClear();
  // Hacim ağı da oturumluk (künye hafif, ağın kendisi node.data'ya yazılmıyor);
  // worker + derlenmiş WASM örneği de bırakılır.
  if(typeof veStrMeshCacheClear === 'function') veStrMeshCacheClear();
  if(typeof veStrMeshForget === 'function') veStrMeshForget();
  if(typeof veStrViewerDispose === 'function') veStrViewerDispose();
  // Oturumluk görünüm durumları da (seçili yüz, yüz inceleme kipi) yeni
  // projeye taşınmasın — düğüm kimlikleri yeniden kullanılırsa önceki projenin
  // tercihi açık gelirdi.
  _veStrSelFace = {};
  _veStrFaceMode = {};
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

// Görüntü ağı inceliği SABİT — panelde üç kademeli bir seçici vardı,
// kullanıcı isteğiyle kaldırıldı: her içe aktarma en ince (kaliteli) ağla
// gelir, yuvarlatmalar hep belirgin olur. Değer `bounding_box_ratio` —
// parçanın boyuna ORAN, mutlak mm değil (bkz. structural-model.js
// VE_STR_GEOM_DEFLECTION).
//
// Kademe kaldırmak bir SEÇİMDİR ve bedeli ölçüldü: as1-tu-203'te üçgen
// 4 408 → 4 688, kullanıcının braketinde 4 902 → 5 572. Yani "ince" pahalı
// bir kademe değil; kabayla arası %14, ve yüz kimlikleri incelikten
// BAĞIMSIZ olduğu için sınır koşulları bundan etkilenmiyor.
// TEKRAR: bu ağ FEA ağı DEĞİL, yalnız görüntüleme ve yüz aralıkları içindir.
var VE_STR_MESH_LINEAR = 0.0005;

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
  reader:   'Çekirdek hazırlanıyor',
  parse:    'Geometri çözümleniyor',
  fuse:     'Katılar tek katıya birleştiriliyor',
  build:    'Ağ örülüyor, sahne kuruluyor'
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
  {
    // BELİRLİ (%) aşama YOK: ağdan indirme yolu kalktı, çekirdek gömülü.
    // Belirsiz aşamalara uydurma bir yüzde koymak yalan olurdu; akan çubuk
    // ve geçen süre sayacı var.
    fill.className = 'indet';
    fill.style.width = '';
    det.textContent = (info && info.fallback)
      ? 'worker açılamadı — ana iş parçacığında sürüyor'
      : (stage === 'parse' ? 'worker\'da — arayüz donmuyor'
      : (stage === 'fuse' ? 'B-Rep birleştirme — gövde sayısıyla büyür'
      : (stage === 'reader' ? 'ilk içe aktarma — bir kez' : '')));
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
  if(node.type !== 'str-geometry' && node.type !== 'str-material' && node.type !== 'str-mesh') return false;

  var dolu, metin, tip;
  if(node.type === 'str-mesh'){
    // AĞ ROZETİ: eleman sayısı. AMBER yalnız ÇÖZÜLEBİLİR ağda — dejenere
    // eleman varsa ağ "hazır" görünmemeli (o eleman rijitlik matrisini tekil
    // yapar), o yüzden kırmızı. Boşken de rozet VAR: Geometri rozetindeki
    // gerekçenin aynısı, "rozet yok" ile "ağ yok" ayırt edilemezdi.
    var mr = node.data && node.data.mesh;
    var st = mr && mr.stats;
    if(st){
      dolu = !(st.degenerate > 0);
      metin = '△' + _strMeshShort(st.tets);
      tip = _strFmt(st.tets) + ' eleman · ' + _strFmt(st.nodes) + ' düğüm · '
          + _strFmt(st.dof) + ' SD'
          + (st.degenerate > 0 ? (' · DEJENERE ' + st.degenerate) : '');
    } else {
      dolu = false; metin = 'AĞ';
      tip = 'Ağ henüz kurulmadı — panelden "Ağı Oluştur".';
    }
    var bm = document.createElement('span');
    bm.className = 've-str-badge';
    bm.textContent = metin;
    bm.title = tip;
    bm.style.cssText = 'position:absolute; top:-9px; right:-6px; z-index:3; pointer-events:none;'
      + 'font-size:var(--fs-micro); font-weight:700; line-height:1; letter-spacing:0.02em;'
      + 'padding:2px 4px; border-radius:3px; font-family:ui-monospace, monospace;'
      + 'color:#fff; background:' + (dolu ? 'var(--accent-warning, #f59e0b)'
          : (st ? 'var(--accent-danger, #ef4444)' : 'var(--text-muted, #888)'))
      + '; border:1px solid var(--bg-primary, #111);';
    (nodeEl.querySelector('.ve-node-box') || nodeEl).appendChild(bm);
    return true;
  }
  if(node.type === 'str-material'){
    // MALZEME: amber yalnız ÇÖZÜLEBİLİR kayıtta (bkz. veStrMatBadgeInfo).
    var mi = veStrMatBadgeInfo(node);
    dolu = mi.ready; metin = mi.text; tip = mi.title;
  } else {
    var g = node.data && node.data.geometry;
    dolu = !!(g && g.stats);
    if(dolu){
      metin = '⬡' + (g.stats.faceCount || 0);
      tip = (g.fileName || 'Parça') + ' · ' + _strFmt(g.stats.triCount) + ' üçgen · '
          + _strFmt(g.stats.faceCount) + ' CAD yüzü';
    } else {
      // Boşken de rozet VAR: "rozet yok" ile "parça yok" ayırt edilemezdi.
      metin = 'STEP';
      tip = 'Henüz parça içe aktarılmadı — panelden .step/.stp seçin.';
    }
  }
  var b = document.createElement('span');
  b.className = 've-str-badge';
  b.textContent = metin;
  b.title = tip;
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

// İçe aktarmanın TEK yolu. Hem dosya seçme, hem bırakma, hem proje açılışında
// kaynaktan geri yükleme buradan geçer — iki ayrı yol açmak iki davranışın
// zamanla ayrışması demekti.
function _strGeomRun(nodeId, bytes, meta){
  if(_veStrGeomBusy[nodeId]) return;
  if(typeof veStrImportStep !== 'function'){
    _strStatus(nodeId, 'STEP köprüsü yüklenmemiş (js/structural-model.js).', 'err');
    return;
  }
  var node = _strNodeById(nodeId);
  if(!node) return;
  if(!node.data) node.data = {};

  _veStrGeomBusy[nodeId] = true;
  _strStatus(nodeId, '');
  _strProgStart(nodeId, meta.fileName, meta.fileSize);

  var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  veStrImportStep(bytes, {
    fileName: meta.fileName, fileSize: meta.fileSize,
    importedAt: new Date().toISOString(),
    deflection: { type: 'bounding_box_ratio', linear: VE_STR_MESH_LINEAR, angular: 0.5 }
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
  delete _veStrFaceMode[nodeId];
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
    // Kip görüntüleyicinin DEĞİL panelin durumunda; her kurulumda yeniden
    // bildirilmeli, yoksa panel açıkken sahne yenilendiğinde (incelik yok ama
    // yeniden içe aktarma var) kip sessizce kapanırdı.
    if(typeof veStrViewerSetFaceMode === 'function') veStrViewerSetFaceMode(veStrGeomFaceMode(nodeId));
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

// YÜZ İNCELEME KİPİ — VARSAYILAN KAPALI (kullanıcı isteği).
//
// Eskiden hem 123–240 satırlık CAD yüz listesi hem de fareyle gezerken çıkan
// yüz künyesi panel açılır açılmaz oradaydı. İkisi de Sınır Koşulları için
// hazırlık; parçaya bakmak isteyen biri için ise gürültü — liste sol rayın
// yarısını yiyor, künye parçanın üstünde sürekli beliriyordu.
//
// TEK ANAHTAR, İKİ YÜZ: liste ile 3B künyesi aynı kipin iki görünümü. Ayrı
// ayrı açılsalardı "liste açık ama parçada bir şey görünmüyor" gibi yarım
// durumlar çıkardı — ve kullanıcı hangisinin neyi açtığını ezberlemek zorunda
// kalırdı.
//
// Kip OTURUMLUK (`node.data`'ya yazılmıyor): bir görünüm tercihi her
// `saveState()`'te undo yığınına binmemeli — seçimin kendisiyle aynı gerekçe.
var _veStrFaceMode = {};

function veStrGeomFaceMode(nodeId){ return !!_veStrFaceMode[nodeId]; }

// Kipi çevir. PANELİ YENİDEN ÇİZMEDEN: showNodeProperties çağrılsaydı 3B
// kanvas da yeniden kurulur, kamera ve sahne baştan yüklenirdi — bir liste
// açmanın bedeli olamaz.
function veStrGeomToggleFaceMode(nodeId){
  var acik = !_veStrFaceMode[nodeId];
  _veStrFaceMode[nodeId] = acik;
  // Kapanırken seçim de gider: seçili yüzün görünür tek karşılığı vurgu ve
  // liste satırı; ikisi de gizliyken "seçili" durmak sessiz bir durum olurdu.
  if(!acik) delete _veStrSelFace[nodeId];
  if(typeof veStrViewerSetFaceMode === 'function') { try { veStrViewerSetFaceMode(acik); } catch(e){} }

  if(typeof document === 'undefined') return;
  var blok = document.getElementById('ve-str-face-block');
  if(blok) blok.style.display = acik ? '' : 'none';
  var btn = document.getElementById('ve-str-face-toggle');
  if(btn){
    btn.setAttribute('aria-expanded', acik ? 'true' : 'false');
    btn.classList.toggle('on', acik);
    var ok = btn.querySelector('.ve-str-face-caret');
    if(ok) ok.textContent = acik ? '▾' : '▸';
  }
  var ipucu = document.getElementById('ve-str-vwr-hint');
  if(ipucu) ipucu.innerHTML = _strViewerHintHTML(acik);
  if(!acik){
    var sel = document.getElementById('ve-str-face-sel');
    if(sel) sel.innerHTML = _strFaceSelText(nodeId);
    _strFaceMarkRow(nodeId, 'on', '');
  }
}

// Kanvasın alt şeridi. Kip kapalıyken "parçanın üstüne gel → CAD yüzü"
// yazmak yalan olurdu: gelince hiçbir şey çıkmıyor.
function _strViewerHintHTML(faceMode){
  var h = 'Sol tık döndür · sağ tık kaydır · tekerlek yakınlaş';
  if(faceMode) h += ' · parçanın üstüne gel → <b>CAD yüzü</b>';
  return h;
}

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

  var acik = veStrGeomFaceMode(node.id);

  // Başlık artık DÜĞME: bölümü açan tek anahtar. Sayı kapalıyken de yazılı —
  // "aç ve gör" ile "aç, sonra kaç yüz olduğunu gör" arasında fark var.
  var h = '<button type="button" id="ve-str-face-toggle" class="ve-str-face-toggle' + (acik ? ' on' : '') + '" '
        + 'aria-expanded="' + (acik ? 'true' : 'false') + '" aria-controls="ve-str-face-block" '
        + 'onclick="veStrGeomToggleFaceMode(\'' + node.id + '\')">'
        + '<span class="ve-str-face-caret">' + (acik ? '▾' : '▸') + '</span>'
        + '<span>CAD yüzlerini incele</span>'
        + '<span class="ve-str-face-count">' + _strFmt(faces.length) + '</span>'
        + '</button>';

  // Liste DOM'da hep duruyor, yalnız gizli: 240 satırı her açılışta yeniden
  // kurmak (ve kaydırma konumunu kaybetmek) bir görünüm anahtarının bedeli
  // olamaz — seçim işaretleyicisi de (_strFaceMarkRow) satırların DOM'da
  // olmasına dayanıyor.
  h += '<div id="ve-str-face-block"' + (acik ? '' : ' style="display:none;"') + '>';
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
  h += '</div>';
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

// "Katı" satırı — BİRLEŞTİRMEYİ AÇIKÇA ANLATIR.
//
// Çok gövdeli bir CAD dosyası tek katıya indiriliyor (kullanıcı kararı):
// ağ örücüye tek su geçirmez hacim gitsin diye. Ama sonuç SESSİZ olamaz —
// boolean başarısız olduysa panel "1 katı" deyip geçseydi, kullanıcı bunu
// ancak ağ örerken, anlaşılmaz bir hatayla öğrenirdi.
//
// Hacim de yazılıyor ve iki hacim AYNI DEĞİLSE bu bir hata değil BİLGİ:
// birleşim hacmi parçaların toplamından küçükse gövdeler ÜST ÜSTE BİNİYORDU
// (ölçüldü: örnek brakette %6,1 — göbekler plakanın içine giriyor).
function _strSolidHTML(g){
  var f = g.fuse || null;
  var n = (g.stats && g.stats.solidCount) || 1;
  if(!f || !f.istendi){
    return _strFmt(n) + ' <span style="color:var(--text-muted); font-weight:400;">(dosyada tek gövde — birleştirme gerekmedi)</span>';
  }
  if(!f.ok){
    return '<span style="color:var(--accent-warning);">' + _strFmt(f.once) + ' ayrı katı</span>'
         + ' <span style="color:var(--text-muted); font-weight:400;">— birleştirilemedi'
         + (f.hata ? ' (' + _strEsc(f.hata) + ')' : '') + '; ağ örerken sorun çıkarabilir</span>';
  }
  var h = '<b>1</b> <span style="color:var(--text-muted); font-weight:400;">← '
        + _strFmt(f.once) + ' gövde birleştirildi'
        + (f.ms ? ' · ' + _strFmt(f.ms) + ' ms' : '') + '</span>';
  var v0 = f.hacimOnce, v1 = f.hacimSonra;
  if(isFinite(v0) && isFinite(v1) && v0 > 0){
    var d = (v0 - v1) / v0 * 100;
    h += '<br><span style="color:var(--text-muted); font-weight:400;">hacim '
       + _strFmt(v1, 1) + ' mm³'
       + (Math.abs(d) > 0.01 ? ' · gövdeler örtüşüyordu (%' + _strFmt(d, 1) + ' ortak hacim)' : ' · gövdeler yalnız değiyordu')
       + '</span>';
  }
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
  h += row('Katı', _strSolidHTML(g));
  h += row('CAD yüzü', '<span style="color:var(--accent-warning);">' + _strFmt(g.stats.faceCount) + '</span>'
      + ' <span style="color:var(--text-muted); font-weight:400;">← sınır koşulları buraya bağlanacak</span>');
  h += row('Görüntü üçgeni', _strFmt(g.stats.triCount) + ' <span style="color:var(--text-muted); font-weight:400;">(FEA ağı değil)</span>');
  h += '</table>';
  return h;
}

function getStrGeometryPropertiesHTML(node){
  if(!node.data) node.data = {};
  var rec = node.data.geometry || null;

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

    // Görüntü ağı inceliği seçicisi KALDIRILDI (hep en ince) ve "Kenarlar"
    // aç/kapa kutusu da öyle (kenarlar teknik görüntünün varsayılanı) —
    // ikisi de kullanıcının hiç dokunmadığı, panelde yer kaplayan ayarlardı.
    left += '<div class="sw-section-title">Görünüm</div>';
    left += '<div class="ve-str-seg">';
    [['iso', 'İzo'], ['front', 'Ön'], ['top', 'Üst'], ['right', 'Sağ']].forEach(function(v){
      left += '<button class="ve-str-seg-btn" onclick="veStrViewerView(\'' + v[0] + '\')">' + v[1] + '</button>';
    });
    left += '</div>';
    left += '<div style="display:flex; gap:6px; margin-top:6px; align-items:center; flex-wrap:wrap;">';
    left += '<button class="ve-str-btn" onclick="veStrViewerReset()">Sıfırla</button>';
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
    right += '<div class="ve-str-vwr-hint" id="ve-str-vwr-hint">' + _strViewerHintHTML(veStrGeomFaceMode(node.id)) + '</div>';
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

// ════════════════════════════════════════════════════════════════════════════
//  MALZEME VE ÖZELLİKLER — Geometri'ye asılan ALT BİLEŞEN
// ════════════════════════════════════════════════════════════════════════════
// Zincirin halkası DEĞİL, Geometri'nin EKİ: içe aktarılan parçaya malzeme atar.
// Kutu bilerek küçük (50×46 ↔ zincirin 62×56) ve çıkışı yok — ikisi birden
// "bu bir alt bileşen" diyor (components.js str-material).
//
// ── ÇÖZÜCÜNÜN GERÇEKTEN İSTEDİĞİ ŞEY ────────────────────────────────────────
// Lineer elastik tet10 çözümü için gereken TAM liste kısa: E ve ν. Geri kalanı
// ayrı sorulara cevap veriyor ve eksikliği FARKLI şeyi imkânsız kılıyor —
// bu yüzden hepsi tek "zorunlu" torbasına atılmadı, eksik olanın NEYİ
// engellediği yazılıyor:
//     E, ν      → rijitlik matrisi.       Yoksa ÇÖZÜM YOK.
//     ρ         → öz ağırlık, kütle, modal analiz. Yoksa yalnız o kapalı.
//     σ_akma    → emniyet payı hükmü.     Yoksa gerilme basılır, hüküm verilmez.
//     σ_çekme   → kopma payı (bilgi).
//     α         → ısıl genleşme (ileride).
//
// ── ν < 0.5 BİR ZEVK MESELESİ DEĞİL, TEKİLLİK ───────────────────────────────
// Hacimsel modül K = E / (3(1−2ν)); ν → 0.5'te payda sıfıra gider ve K → ∞.
// Yer değiştirme temelli standart elemanlarda bu, rijitlik matrisinin
// KOŞULLANMASININ bozulması demek: ν = 0.5 tam tekillik, ν > 0.49 ise hacimsel
// kilitlenme (locking) bölgesi — çözüm koşar, sayı çıkar, ve sonuç sistematik
// olarak FAZLA RİJİT olur. Yani gözle yakalanmayan, güvenli tarafta OLMAYAN bir
// hata: modülün tet4 ölçümünde (%24 rijit) belgelenen sınıfın aynısı.
// Bu yüzden ν ≥ 0.5 REDDEDİLİYOR, 0.49 < ν < 0.5 UYARILIYOR.
//
// ── SESSİZ BİRİM TUZAĞI: ρ ──────────────────────────────────────────────────
// Modülün birim sistemi mm · N · MPa. O sistemde kütle birimi TON, yani
// yoğunluk ton/mm³ olmak zorunda: çelik 7850 kg/m³ = 7,85e-9 ton/mm³.
// 7850'i doğrudan yazmak kütleyi 10¹² kat büyütür — çözüm yine koşar, öz ağırlık
// altında parça "erir". Panel kg/m³ soruyor (kullanıcının bildiği birim) ve
// çevrimi KENDİSİ yapıyor; çevrilmiş değer panelde AÇIKÇA yazılı ki kimse
// hangi sayının çözücüye gittiğini tahmin etmek zorunda kalmasın.

// Alan tablosu — TEK KAYNAK: panel, doğrulama ve (sırada olan) kütüphane hepsi
// buradan besleniyor. İkinci bir kopya tutmak, kütüphane geldiğinde iki listeyi
// sessizce ayrıştırırdı.
var VE_STR_MAT_FIELDS = [
  { key:'E',     sym:'E',   unit:'MPa',     step:'any',  ph:'210000', ad:'Elastisite modülü',      rol:'rijitlik' },
  { key:'nu',    sym:'ν',   unit:'—',       step:'0.01', ph:'0.30',   ad:'Poisson oranı',          rol:'rijitlik' },
  { key:'rho',   sym:'ρ',   unit:'kg/m³',   step:'any',  ph:'7850',   ad:'Yoğunluk',               rol:'öz ağırlık · kütle' },
  { key:'sy',    sym:'σ<sub>ak</sub>', unit:'MPa', step:'any', ph:'355', ad:'Akma dayanımı',       rol:'emniyet payı' },
  { key:'su',    sym:'σ<sub>ç</sub>',  unit:'MPa', step:'any', ph:'510', ad:'Çekme dayanımı',      rol:'kopma payı' },
  { key:'alpha', sym:'α',   unit:'10⁻⁶/K', step:'any',  ph:'12',     ad:'Isıl genleşme katsayısı', rol:'ısıl yük' }
];

// kg/m³ → ton/mm³ (mm·N·MPa birim sisteminin kütle birimi TON'dur).
// 1 kg/m³ = 1e-12 ton/mm³. Çelik: 7850 → 7,85e-9.
var VE_STR_RHO_SI_TO_MM = 1e-12;
function veStrMatDensityMM(rhoKgM3){
  var v = Number(rhoKgM3);
  if(rhoKgM3 === null || rhoKgM3 === undefined || rhoKgM3 === '' || !isFinite(v)) return null;
  return v * VE_STR_RHO_SI_TO_MM;
}

var _STR_INP = 'padding:4px 6px; font-size:var(--fs-body); height:25px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right; box-sizing:border-box;';

// Girilmemiş alan NaN'dır, 0 DEĞİL. `Number(null) === 0` bu projede belgelenmiş
// bir sessiz hata sınıfı (cp-fead-report.js _frNum): girilmemiş bir dayanımı
// "0 MPa ölçüldü" gibi göstermek emniyet payını 0'a çakardı.
function _strMatNum(v){
  if(v === null || v === undefined || v === '') return NaN;
  var n = Number(v);
  return isFinite(n) ? n : NaN;
}

function veStrMatOf(node){
  return (node && node.data && node.data.material) ? node.data.material : {};
}

// Malzeme kaydını yaz. Boş dizge alanı SİLER (undefined bırakmaz) — "0 girildi"
// ile "girilmedi" ayrımı kaydın kendisinde de korunsun.
function veStrMatSet(nodeId, key, val){
  var node = _strNodeById(nodeId);
  if(!node) return;
  if(!node.data) node.data = {};
  if(!node.data.material) node.data.material = {};
  var m = node.data.material;
  if(val === '' || val === null || val === undefined) delete m[key];
  else if(key === 'name') m[key] = String(val);
  else {
    var n = Number(val);
    if(isFinite(n)) m[key] = n; else delete m[key];
  }
  // Elle düzenlenen bir kayıt artık kütüphane kaydı değildir; kütüphane
  // geldiğinde "hangi katalog kaydı" sorusuna yanlış cevap vermesin.
  if(key !== 'name' && m.source && m.source !== 'manual') m.source = 'manual';
  if(typeof saveState === 'function') saveState();
  if(typeof veStrRefreshBadge === 'function') veStrRefreshBadge(nodeId);
}

function veStrMatClear(nodeId){
  var node = _strNodeById(nodeId);
  if(!node || !node.data) return;
  delete node.data.material;
  if(typeof saveState === 'function') saveState();
  if(typeof veStrRefreshBadge === 'function') veStrRefreshBadge(nodeId);
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
}

// ── DOĞRULAMA ───────────────────────────────────────────────────────────────
// İki ayrı torba: `errors` çözümü DURDURUR, `warns` yalnız bir yeteneği kapatır
// ya da veri girişi hatasından şüphelenir. Hepsini tek torbaya atmak, ρ'suz bir
// modeli "çözülemez" ilan ederdi — oysa öz ağırlıksız bir gerilme çözümü
// pekâlâ geçerli bir analizdir.
function veStrMatValidate(m){
  m = m || {};
  var errors = [], warns = [];
  var E = _strMatNum(m.E), nu = _strMatNum(m.nu), rho = _strMatNum(m.rho);
  var sy = _strMatNum(m.sy), su = _strMatNum(m.su);

  if(isNaN(E)) errors.push('Elastisite modülü (E) girilmedi — rijitlik matrisi kurulamaz.');
  else if(E <= 0) errors.push('E pozitif olmalı (girilen: ' + _strFmt(E, 0) + ' MPa).');

  if(isNaN(nu)) errors.push('Poisson oranı (ν) girilmedi — rijitlik matrisi kurulamaz.');
  else if(nu >= 0.5) errors.push('ν ≥ 0,5 çözülemez: K = E/(3(1−2ν)) ıraksar, rijitlik matrisi tekilleşir (girilen: ' + _strFmt(nu, 3) + ').');
  else if(nu > 0.49) warns.push('ν = ' + _strFmt(nu, 3) + ' hacimsel kilitlenme bölgesinde: çözüm koşar ama sonuç sistematik olarak FAZLA RİJİT çıkar.');
  else if(nu < 0) warns.push('ν negatif (auxetic malzeme). Fiziksel olarak mümkün ama nadir — yazım hatası olabilir.');

  if(isNaN(rho)) warns.push('Yoğunluk (ρ) yok: öz ağırlık ve kütle hesabı kapalı kalır.');
  else if(rho <= 0) warns.push('ρ pozitif olmalı — öz ağırlık hesabı kapalı kalır.');

  if(isNaN(sy)) warns.push('Akma dayanımı (σ_ak) yok: gerilme basılır ama emniyet payı hükmü verilemez.');
  else if(sy <= 0) warns.push('σ_ak pozitif olmalı — emniyet payı hükmü verilemez.');

  if(!isNaN(sy) && !isNaN(su) && su < sy)
    warns.push('Çekme dayanımı akma dayanımından küçük (σ_ç < σ_ak) — iki alan yer değiştirmiş olabilir.');

  return { ok: errors.length === 0, errors: errors, warns: warns };
}

// Türetilen büyüklükler. Panelde göstermenin karşılığı var: kullanıcı girdiği
// ν'nün ne demek olduğunu G ve K üzerinden görüyor, ve ρ'nun çözücüye HANGİ
// sayı olarak gittiği yazılı duruyor (yukarıdaki birim tuzağı).
function veStrMatDerived(m){
  m = m || {};
  var E = _strMatNum(m.E), nu = _strMatNum(m.nu);
  var G = (!isNaN(E) && !isNaN(nu) && nu > -1) ? E / (2 * (1 + nu)) : null;
  var K = (!isNaN(E) && !isNaN(nu) && nu < 0.5) ? E / (3 * (1 - 2 * nu)) : null;
  return { G: G, K: K, rhoMM: veStrMatDensityMM(m.rho) };
}

// Bu malzeme kutusu HANGİ Geometri'ye asılı? Bağ, kanvasta çekilen telden
// okunuyor — ikinci bir "hedef seç" alanı tutulsaydı tel ile alan sessizce
// ayrışırdı (FEAD'de panel ile kartın AYNI alanı okuması kuralının aynısı).
function veStrMatHost(node){
  if(!node || typeof connections === 'undefined' || typeof nodes === 'undefined') return null;
  var host = null;
  connections.forEach(function(c){
    if(host || c.to !== node.id) return;
    var n = nodes.find(function(x){ return x.id === c.from; });
    if(n && n.type === 'str-geometry') host = n;
  });
  return host;
}

// ── KANVAS ROZETİ ───────────────────────────────────────────────────────────
// AMBER yalnız ÇÖZÜLEBİLİR kayıtta: adı yazılmış ama E'si girilmemiş bir
// malzeme "hazır" görünmemeli. Rozet boşken de VAR (Geometri rozetindeki
// gerekçenin aynısı: "rozet yok" ile "malzeme yok" ayırt edilemezdi).
// Rozet metni: 50×46'lık kutuya SIĞACAK kadar kısa bir kimlik. Kütüphane
// gelince bu bir soruna dönüştü — katalog adları elle yazılanlardan uzun:
// "EN AW-6082 T6" ham kısaltmayla "EN AW-608…" oluyordu ve bu BAŞKA BİR
// ALAŞIM NUMARASI gibi okunuyor. Kısaltmadan önce iki şey atılıyor:
//   • baştaki standart öneki ("EN ", "EN-")  → EN AW-6082 T6  → AW-6082 T6
//   • parantez içi açıklama                    → EN AC-43000 (AlSi10Mg) T6
//                                                → AC-43000 T6
// Kalan, gösterimin AYIRT EDİCİ parçası. Tam ad zaten ipucunda (title).
function _strMatShortName(ad){
  var t = String(ad || '').trim();
  t = t.replace(/^EN[\s-]+/i, '');
  t = t.replace(/\s*\([^)]*\)\s*/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return (t.length > 11) ? t.slice(0, 10) + '…' : t;
}

function veStrMatBadgeInfo(node){
  var m = veStrMatOf(node);
  var v = veStrMatValidate(m);
  var ad = (m.name != null && String(m.name).trim() !== '') ? String(m.name).trim() : '';
  var E = _strMatNum(m.E);
  var txt = ad ? _strMatShortName(ad)
               : (!isNaN(E) ? _strFmt(E / 1000, 0) + ' GPa' : 'MALZ');
  var tip;
  if(v.ok){
    tip = (ad || 'Malzeme') + ' · E ' + _strFmt(E, 0) + ' MPa · ν ' + _strFmt(_strMatNum(m.nu), 2)
        + (isNaN(_strMatNum(m.rho)) ? '' : ' · ρ ' + _strFmt(_strMatNum(m.rho), 0) + ' kg/m³');
  } else {
    tip = v.errors[0] || 'Malzeme tanımlanmadı — panelden E ve ν girin.';
  }
  return { text: txt, title: tip, ready: v.ok };
}

// ════════════════════════════════════════════════════════════════════════════
//  MALZEME DİYAGRAMLARI
// ════════════════════════════════════════════════════════════════════════════
// Üç diyagram, üç ayrı soruya cevap veriyor ve üçü de KAYITTAN türüyor —
// hiçbiri sabit bir resim değil:
//   σ–ε      "bu malzeme yük altında nasıl davranır"   (E, Ry, Rm, A)
//   Wöhler   "tekrarlı yükte kaç çevrim dayanır"       (FKM modeli)
//   k(θ)     "ısındığında ne kaybeder"                 (EN 1993-1-2 vb.)
//
// TABLODAKİ SAYI İLE DİYAGRAM AYNI KAYNAKTAN BESLENİR (structural-materials.js).
// Diyagram ayrı bir veriden çizilseydi ikisi sessizce ayrışırdı — bu projenin
// en çok kaçındığı hata sınıfı.
//
// Ölçek jetonları: renkler tema değişkenlerinden. Rapor tarafındaki dersin
// aynısı (cp-fead-report.js): tanımsız bir var() "invalid at computed-value
// time"dır ve kalıtılan `stroke` için sonuç `none` demektir — yani çizgi
// görünmez olur. Buradaki jetonların hepsi css/styles.css'te tanımlı.
var _STR_DIA_W = 380, _STR_DIA_H = 190;

// Eksen çerçevesi + ızgara. Dönen nesne ölçekleyicileri taşıyor.
function _strDiaFrame(opt){
  var w = opt.w || _STR_DIA_W, h = opt.h || _STR_DIA_H;
  var L = opt.padL || 44, R = opt.padR || 12, T = opt.padT || 14, B = opt.padB || 30;
  var pw = w - L - R, ph = h - T - B;
  return {
    w:w, h:h, L:L, T:T, pw:pw, ph:ph,
    x: function(v){ return L + pw * v; },     // v: 0..1 normalize
    y: function(v){ return T + ph * (1 - v); }
  };
}

function _strDiaAxes(fr, xlab, ylab){
  var g = '<g data-ve="axes">';
  g += '<rect x="' + fr.L + '" y="' + fr.T + '" width="' + fr.pw + '" height="' + fr.ph + '" '
     + 'fill="none" stroke="var(--border-color)" stroke-width="1"/>';
  g += '<text x="' + (fr.L + fr.pw / 2) + '" y="' + (fr.T + fr.ph + 24) + '" text-anchor="middle" '
     + 'font-size="9" fill="var(--text-muted)">' + xlab + '</text>';
  g += '<text x="10" y="' + (fr.T + fr.ph / 2) + '" text-anchor="middle" font-size="9" '
     + 'fill="var(--text-muted)" transform="rotate(-90 10 ' + (fr.T + fr.ph / 2) + ')">' + ylab + '</text>';
  return g + '</g>';
}

function _strDiaTick(fr, yön, v, metin){
  if(yön === 'x'){
    var px = fr.x(v);
    return '<line x1="' + px + '" y1="' + (fr.T + fr.ph) + '" x2="' + px + '" y2="' + (fr.T + fr.ph + 4) + '" '
         + 'stroke="var(--border-color)" stroke-width="1"/>'
         + '<text x="' + px + '" y="' + (fr.T + fr.ph + 13) + '" text-anchor="middle" font-size="8" '
         + 'fill="var(--text-muted)">' + metin + '</text>';
  }
  var py = fr.y(v);
  return '<line x1="' + (fr.L - 4) + '" y1="' + py + '" x2="' + fr.L + '" y2="' + py + '" '
       + 'stroke="var(--border-color)" stroke-width="1"/>'
       + '<text x="' + (fr.L - 6) + '" y="' + (py + 3) + '" text-anchor="end" font-size="8" '
       + 'fill="var(--text-muted)">' + metin + '</text>';
}

function _strDiaWrap(baslik, not, ic, w, h){
  return '<figure class="ve-str-dia">'
       + '<figcaption>' + baslik + (not ? ' <span>' + not + '</span>' : '') + '</figcaption>'
       + '<svg viewBox="0 0 ' + (w || _STR_DIA_W) + ' ' + (h || _STR_DIA_H) + '" '
       + 'preserveAspectRatio="xMidYMid meet" role="img">' + ic + '</svg></figure>';
}

// ── 1) GERİLME–GERİNİM (idealleştirilmiş) ───────────────────────────────────
// ŞEMATİK ve panel bunu YAZIYOR: gerçek eğri bir çekme deneyiyle çıkar.
// Şemayı taşıyan dört sayı (E eğimi, Ry, Rm, A) GERÇEK; aralarını bağlayan
// biçim idealleştirme. İkisini ayırmadan basmak, çizilmiş bir deney sonucu
// gibi okunurdu.
function _strMatStressStrainSVG(m){
  if(!m || !(m.E > 0) || !(m.su > 0)) return '';
  var A = (typeof m.A === 'number' && m.A > 0) ? m.A : 1;   // % kopma uzaması
  var fr = _strDiaFrame({});
  var yMax = m.su * 1.12;
  var xMax = A * 1.05;
  var gevrek = (m.sy == null);
  var ey = (gevrek ? m.su : m.sy) / m.E * 100;              // % elastik gerinim

  var sx = function(pct){ return fr.x(Math.min(1, pct / xMax)); };
  var sy = function(mpa){ return fr.y(Math.min(1, mpa / yMax)); };

  var g = _strDiaAxes(fr, 'Gerinim ε [%]', 'σ [MPa]');
  [0, 0.25, 0.5, 0.75, 1].forEach(function(f){
    g += _strDiaTick(fr, 'x', f, _strFmt(xMax * f, xMax < 10 ? 1 : 0));
    g += _strDiaTick(fr, 'y', f, _strFmt(yMax * f, 0));
  });

  var d;
  if(gevrek){
    // GEVREK: akma yok, doğrusal çizgi kopmaya kadar. Kopma noktası ×.
    d = 'M ' + sx(0) + ' ' + sy(0) + ' L ' + sx(ey) + ' ' + sy(m.su);
    g += '<path data-ve="curve" d="' + d + '" fill="none" stroke="var(--accent-warning)" stroke-width="2.4"/>';
    g += '<path data-ve="fracture" d="M ' + (sx(ey) - 4) + ' ' + (sy(m.su) - 4) + ' l 8 8 M '
      + (sx(ey) + 4) + ' ' + (sy(m.su) - 4) + ' l -8 8" stroke="var(--accent-danger, #ef4444)" stroke-width="2"/>';
  } else {
    // SÜNEK: elastik doğru → akma → pekleşerek Rm → boyunlanma → kopma.
    // Düzgün uzama (Ag) toplam uzamanın ~%60'ı alınıyor; ondan sonrası
    // boyunlanma bölgesi ve gerilme (mühendislik gerilmesi olarak) DÜŞER.
    var eu = Math.max(ey * 2, A * 0.6);
    d = 'M ' + sx(0) + ' ' + sy(0) + ' L ' + sx(ey) + ' ' + sy(m.sy)
      + ' C ' + sx(ey + (eu - ey) * 0.35) + ' ' + sy(m.sy + (m.su - m.sy) * 0.55)
      + ' '   + sx(ey + (eu - ey) * 0.65) + ' ' + sy(m.su)
      + ' '   + sx(eu) + ' ' + sy(m.su)
      + ' Q ' + sx(eu + (A - eu) * 0.5) + ' ' + sy(m.su)
      + ' '   + sx(A) + ' ' + sy(m.su * 0.93);
    g += '<path data-ve="curve" d="' + d + '" fill="none" stroke="var(--accent-warning)" stroke-width="2.4" stroke-linejoin="round"/>';
    g += '<path data-ve="fracture" d="M ' + (sx(A) - 4) + ' ' + (sy(m.su * 0.93) - 4) + ' l 8 8 M '
      + (sx(A) + 4) + ' ' + (sy(m.su * 0.93) - 4) + ' l -8 8" stroke="var(--accent-danger, #ef4444)" stroke-width="2"/>';
    // Akma çizgisi
    g += '<line data-ve="sy" x1="' + fr.L + '" y1="' + sy(m.sy) + '" x2="' + sx(A) + '" y2="' + sy(m.sy)
      + '" stroke="var(--accent-primary)" stroke-width="1" stroke-dasharray="4 3" opacity="0.75"/>';
    g += '<text x="' + (fr.L + 5) + '" y="' + (sy(m.sy) - 4) + '" font-size="8.5" fill="var(--accent-primary)">σ_ak '
      + _strFmt(m.sy) + '</text>';
  }
  // Çekme dayanımı çizgisi
  g += '<line data-ve="su" x1="' + fr.L + '" y1="' + sy(m.su) + '" x2="' + sx(A) + '" y2="' + sy(m.su)
    + '" stroke="var(--accent-warning)" stroke-width="1" stroke-dasharray="4 3" opacity="0.75"/>';
  g += '<text x="' + (fr.L + 5) + '" y="' + (sy(m.su) - 4) + '" font-size="8.5" fill="var(--accent-warning)">σ_ç '
    + _strFmt(m.su) + '</text>';
  // E eğimi — elastik doğrunun kendisi zaten E; üçgenle işaretleniyor.
  g += '<text data-ve="emod" x="' + (sx(ey) + 6) + '" y="' + (sy(gevrek ? m.su : m.sy) + 14) + '" font-size="8.5" '
    + 'fill="var(--text-secondary)">E = ' + _strFmt(m.E / 1000, 0) + ' GPa</text>';

  return _strDiaWrap('Gerilme–Gerinim', '(idealleştirilmiş — E, σ_ak, σ_ç, A gerçek)', g);
}

// ── 2) WÖHLER (S-N) ─────────────────────────────────────────────────────────
// Log-log. FKM modeli (bkz. structural-materials.js VE_STR_MAT_FAT_SETS).
// Modelin GEÇERLİLİK SINIRI çizimde işaretli: Basquin doğrusu Rm'yi kestiği
// çevrimden önce düşük çevrimli yorulma (LCF) bölgesi var ve orada bu model
// geçerli DEĞİL — o bölge taranıyor.
function _strMatWohlerSVG(m){
  if(typeof veStrMatFatigue !== 'function') return '';
  var f = veStrMatFatigue(m);
  if(!f) return '';
  var fr = _strDiaFrame({ padL: 46 });
  var N0 = 1e3, N1 = 1e9;
  var lo = Math.log10(N0), hi = Math.log10(N1);
  var sMax = f.rm * 1.1, sMin = Math.max(1, f.sw * 0.35);
  var ly = Math.log10(sMin), hy = Math.log10(sMax);
  var sx = function(n){ return fr.x((Math.log10(n) - lo) / (hi - lo)); };
  var sy = function(v){ return fr.y((Math.log10(Math.max(sMin, v)) - ly) / (hy - ly)); };

  var g = _strDiaAxes(fr, 'Çevrim sayısı N (log)', 'σ_a [MPa]');
  for(var e = 3; e <= 9; e++) g += _strDiaTick(fr, 'x', (e - lo) / (hi - lo), '10' + '³⁴⁵⁶⁷⁸⁹'.charAt(e - 3));
  [sMin, Math.sqrt(sMin * sMax), sMax].forEach(function(v){
    g += _strDiaTick(fr, 'y', (Math.log10(v) - ly) / (hy - ly), _strFmt(v, 0));
  });

  // LCF bölgesi — modelin dışı
  var nLcf = veStrMatSNlimit(m);
  if(nLcf > N0){
    g += '<rect data-ve="lcf" x="' + fr.L + '" y="' + fr.T + '" width="' + Math.max(0, sx(Math.min(nLcf, N1)) - fr.L)
      + '" height="' + fr.ph + '" fill="var(--text-muted)" opacity="0.13"/>';
    g += '<text x="' + (fr.L + 4) + '" y="' + (fr.T + 11) + '" font-size="8" fill="var(--text-muted)">LCF — model dışı</text>';
  }

  // Eğri
  var pts = [], n;
  for(var i = 0; i <= 60; i++){
    n = Math.pow(10, lo + (hi - lo) * i / 60);
    pts.push((i ? 'L ' : 'M ') + sx(n) + ' ' + sy(veStrMatSN(m, n)));
  }
  g += '<path data-ve="sn" d="' + pts.join(' ') + '" fill="none" stroke="var(--accent-warning)" stroke-width="2.4"/>';

  // Diz noktası ve dayanma sınırı
  g += '<line data-ve="sw" x1="' + fr.L + '" y1="' + sy(f.sw) + '" x2="' + (fr.L + fr.pw) + '" y2="' + sy(f.sw)
    + '" stroke="var(--accent-primary)" stroke-width="1" stroke-dasharray="4 3" opacity="0.8"/>';
  g += '<circle data-ve="knee" cx="' + sx(f.nd) + '" cy="' + sy(f.sw) + '" r="3.2" fill="var(--accent-primary)"/>';
  g += '<text x="' + (sx(f.nd) + 5) + '" y="' + (sy(f.sw) - 5) + '" font-size="8.5" fill="var(--accent-primary)">σ_W '
    + _strFmt(f.sw, 0) + ' MPa</text>';
  if(!f.sinirVar){
    g += '<text x="' + (fr.L + fr.pw - 4) + '" y="' + (fr.T + fr.ph - 5) + '" text-anchor="end" font-size="8" '
      + 'fill="var(--accent-danger, #ef4444)">dayanma sınırı YOK — eğri düşmeye devam eder</text>';
  }
  return _strDiaWrap('Wöhler (S-N) eğrisi',
    '(FKM modeli: σ_W = ' + _strFmt(f.fw, 2) + ' · σ_ç · k=' + f.k + ' · N_D=10⁶)', g);
}

// ── 3) SICAKLIK AZALTMA EĞRİSİ ──────────────────────────────────────────────
function _strMatTempSVG(m){
  if(typeof veStrMatTempSet !== 'function') return '';
  var set = veStrMatTempSet(m);
  if(!set) return '';
  var fr = _strDiaFrame({ padL: 40 });
  var p = set.p;
  var t0 = p[0][0], t1 = p[p.length-1][0];
  var kMax = 1;
  p.forEach(function(q){ if(q[1] > kMax) kMax = q[1]; if(q[2] > kMax) kMax = q[2]; });
  kMax = Math.ceil(kMax * 10) / 10;
  var sx = function(t){ return fr.x((t - t0) / (t1 - t0)); };
  var sy = function(k){ return fr.y(k / kMax); };

  var g = _strDiaAxes(fr, 'Sıcaklık θ [°C]', 'k(θ)');
  [0, 0.25, 0.5, 0.75, 1].forEach(function(fq){
    g += _strDiaTick(fr, 'x', fq, _strFmt(t0 + (t1 - t0) * fq, 0));
    g += _strDiaTick(fr, 'y', fq, _strFmt(kMax * fq, 2));
  });

  function seri(idx, renk, ad, kesik){
    var d = '', v = 0;
    p.forEach(function(q){
      if(q[idx] === null) return;
      d += (v++ ? ' L ' : 'M ') + sx(q[0]) + ' ' + sy(q[idx]);
    });
    if(!v) return '';
    return '<path data-ve="' + ad + '" d="' + d + '" fill="none" stroke="' + renk + '" stroke-width="2.2"'
         + (kesik ? ' stroke-dasharray="5 3"' : '') + '/>';
  }
  g += seri(1, 'var(--accent-primary)', 'kE', false);
  g += seri(2, 'var(--accent-warning)', 'kY', false);
  g += seri(3, 'var(--text-muted)', 'kP', true);

  // Azami sürekli servis sıcaklığı — malzemenin kendi sınırı
  if(typeof m.tmax === 'number' && m.tmax > t0 && m.tmax < t1){
    g += '<line data-ve="tmax" x1="' + sx(m.tmax) + '" y1="' + fr.T + '" x2="' + sx(m.tmax) + '" y2="' + (fr.T + fr.ph)
      + '" stroke="var(--accent-danger, #ef4444)" stroke-width="1.4" stroke-dasharray="3 3"/>';
    g += '<text x="' + (sx(m.tmax) + 4) + '" y="' + (fr.T + fr.ph - 6) + '" font-size="8" '
      + 'fill="var(--accent-danger, #ef4444)">azami servis ' + _strFmt(m.tmax) + ' °C</text>';
  }

  // Gösterge
  var lg = '<g data-ve="legend" font-size="8.5">';
  var lx = fr.L + 6, ly2 = fr.T + 11;
  lg += '<line x1="' + lx + '" y1="' + ly2 + '" x2="' + (lx+14) + '" y2="' + ly2 + '" stroke="var(--accent-primary)" stroke-width="2.2"/>'
     +  '<text x="' + (lx+18) + '" y="' + (ly2+3) + '" fill="var(--text-secondary)">E</text>';
  lg += '<line x1="' + (lx+40) + '" y1="' + ly2 + '" x2="' + (lx+54) + '" y2="' + ly2 + '" stroke="var(--accent-warning)" stroke-width="2.2"/>'
     +  '<text x="' + (lx+58) + '" y="' + (ly2+3) + '" fill="var(--text-secondary)">akma</text>';
  if(p.some(function(q){ return q[3] !== null; })){
    lg += '<line x1="' + (lx+96) + '" y1="' + ly2 + '" x2="' + (lx+110) + '" y2="' + ly2 + '" stroke="var(--text-muted)" stroke-width="2.2" stroke-dasharray="5 3"/>'
       +  '<text x="' + (lx+114) + '" y="' + (ly2+3) + '" fill="var(--text-secondary)">orantı sınırı</text>';
  }
  g += lg + '</g>';

  // KAYNAK TÜRÜ ETİKETTE: standardın tablosu mu, el kitabının tipik seyri mi.
  var etiket = (set.tur === 'std') ? set.kaynak : (set.kaynak + ' — TİPİK SEYİR, standart tablosu değil');
  return _strDiaWrap('Sıcaklık azaltma eğrisi', '(' + _strEsc(etiket) + ')', g);
}

// ─── Panel ──────────────────────────────────────────────────────────────────
// Bağlı parça kartı: bağ TELDEN okunuyor. Üç durum ve üçü de AÇIKÇA yazılı —
// "bağlı değil" sessiz bırakılsaydı kullanıcı malzemeyi girer, kaydeder ve
// çözücü onu hiç görmezdi.
function _strMatHostCard(node){
  var host = veStrMatHost(node);
  if(!host){
    return '<div style="padding:8px 10px; margin-bottom:9px; font-size:var(--fs-micro); line-height:1.45; '
         + 'color:var(--accent-warning); background:var(--bg-secondary); border:1px solid var(--accent-warning);">'
         + '<b>Geometri\'ye bağlı değil.</b> Bu kutunun <b>üst</b> portunu, Geometri bileşeninin '
         + '<b>alt</b> portuna bağlayın — malzeme parçaya ancak o telle atanır.</div>';
  }
  var g = host.data && host.data.geometry;
  var ad = _strEsc(host.customName || 'Geometri');
  if(!g || !g.stats){
    return '<div style="padding:8px 10px; margin-bottom:9px; font-size:var(--fs-micro); line-height:1.45; '
         + 'color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color);">'
         + '<b style="color:var(--text-heading);">' + ad + '</b> bağlı — ama <b>parça henüz içe aktarılmadı</b>. '
         + 'Malzeme şimdiden girilebilir; parça gelince ona uygulanır.</div>';
  }
  var bb = g.bbox || {}, sz = bb.size || [];
  return '<div style="padding:8px 10px; margin-bottom:9px; font-size:var(--fs-micro); line-height:1.5; '
       + 'color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
       + '<b style="color:var(--text-heading);">' + _strEsc(g.fileName || 'Parça') + '</b>'
       + ' <span style="color:var(--text-muted);">← ' + ad + '</span><br>'
       + _strFmt(g.stats.meshCount) + ' katı · ' + _strFmt(g.stats.faceCount) + ' CAD yüzü · '
       + _strFmt(sz[0], 1) + ' × ' + _strFmt(sz[1], 1) + ' × ' + _strFmt(sz[2], 1) + ' mm'
       + '</div>';
}

function _strMatFieldGrid(node){
  var m = veStrMatOf(node);
  var h = '<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px 7px; margin-bottom:9px;">';
  VE_STR_MAT_FIELDS.forEach(function(f){
    var v = (m[f.key] === null || m[f.key] === undefined) ? '' : m[f.key];
    h += '<label title="' + _strEsc(f.ad + ' — ' + f.rol) + '" style="display:flex; flex-direction:column; gap:2px; min-width:0;">'
      +   '<span style="font-size:var(--fs-micro); color:var(--text-muted); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">'
      +     f.sym + ' <span style="opacity:0.75;">[' + f.unit + ']</span></span>'
      +   '<input type="number" id="ve-str-mat-' + f.key + '-' + node.id + '" value="' + _strEsc(v) + '" step="' + f.step + '"'
      +   ' placeholder="' + _strEsc(f.ph) + '"'
      +   ' onchange="veStrMatSet(\'' + node.id + '\',\'' + f.key + '\',this.value)" style="width:100%; ' + _STR_INP + '">'
      + '</label>';
  });
  return h + '</div>';
}

function _strMatVerdict(node){
  var v = veStrMatValidate(veStrMatOf(node));
  var h = '';
  if(v.ok){
    h += '<div style="padding:7px 9px; margin-bottom:8px; font-size:var(--fs-micro); line-height:1.45; '
       + 'color:var(--text-primary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-success, #22c55e);">'
       + '<b>Çözülebilir.</b> E ve ν girildi — rijitlik matrisi kurulabilir.</div>';
  }
  v.errors.forEach(function(t){
    h += '<div style="padding:6px 9px; margin-bottom:6px; font-size:var(--fs-micro); line-height:1.45; '
       + 'color:var(--accent-danger, #ef4444); background:var(--bg-secondary); border:1px solid var(--accent-danger, #ef4444);">'
       + _strEsc(t) + '</div>';
  });
  v.warns.forEach(function(t){
    h += '<div style="padding:6px 9px; margin-bottom:6px; font-size:var(--fs-micro); line-height:1.45; '
       + 'color:var(--text-secondary); background:var(--bg-secondary); border:1px dashed var(--accent-warning);">'
       + _strEsc(t) + '</div>';
  });
  return h;
}

// Türetilenler — G ve K girilen ν'nün ne demek olduğunu gösteriyor; ρ satırı
// ise çözücüye GİDEN sayıyı yazıyor (mm·N·MPa sisteminin ton/mm³ tuzağı).
function _strMatDerivedTable(node){
  var d = veStrMatDerived(veStrMatOf(node));
  function row(k, v, not){
    return '<tr><td style="padding:4px 8px; border:1px solid var(--border-color); color:var(--text-secondary); white-space:nowrap;">' + k + '</td>'
         + '<td style="padding:4px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">' + v
         + (not ? ' <span style="color:var(--text-muted); font-weight:400;">' + not + '</span>' : '') + '</td></tr>';
  }
  var rhoTxt = (d.rhoMM === null) ? '—' : d.rhoMM.toExponential(3).replace('.', ',') + ' ton/mm³';
  var h = '<table style="width:100%; font-size:var(--fs-tiny); border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:9px;">';
  h += row('Kayma modülü G', d.G === null ? '—' : _strFmt(d.G, 0) + ' MPa', '= E / 2(1+ν)');
  h += row('Hacimsel modül K', d.K === null ? '—' : _strFmt(d.K, 0) + ' MPa', '= E / 3(1−2ν)');
  h += row('Çözücüye giden ρ', rhoTxt, '← mm·N·MPa sisteminde kütle TON');
  h += '</table>';
  return h;
}

// ── KÜTÜPHANE TARAYICISI ────────────────────────────────────────────────────
// Katalog js/structural-materials.js'te (112 kayıt, 16 aile). Bu blok yalnız
// onu GÖSTERİYOR — tek bir malzeme değeri burada yazılı değil.
//
// TARAMA DURUMU OTURUMLUK, node.data'DA DEĞİL. Arama kutusuna yazılan metin,
// seçili kategori ve listede işaretlenen kayıt birer GÖRÜNÜM tercihidir;
// node.data'ya yazılsalardı her tuş vuruşu `saveState()` üzerinden undo
// yığınına binerdi ve kullanıcı "geri al" dediğinde malzemesi değil arama
// metni geri gelirdi. CAD yüz seçimindeki kuralın aynısı.
//
// Düğüm kimliğiyle anahtarlı: iki farklı malzeme kutusu arasında gidip
// gelirken her biri kendi taramasını koruyor.
var _veStrLibUI = {};
function _strLibUI(nodeId){
  if(!_veStrLibUI[nodeId]) _veStrLibUI[nodeId] = { q:'', cat:'', sel:'' };
  return _veStrLibUI[nodeId];
}
function _strLibForget(){ _veStrLibUI = {}; }

function _strLibHas(){
  return (typeof VE_STR_MAT_LIB !== 'undefined') && (typeof veStrMatLibSearch === 'function');
}

// Arama kutusuna yazıldıkça YALNIZ LİSTE yeniden kuruluyor, panel DEĞİL.
// `showNodeProperties` çağrılsaydı arama kutusu DOM'dan silinip yeniden
// kurulur ve odak (imleç) her harfte kaybolurdu — yazmak imkânsız olurdu.
function veStrMatLibQuery(nodeId, q){
  _strLibUI(nodeId).q = String(q == null ? '' : q);
  _strLibRepaint(nodeId);
}
function veStrMatLibSetCat(nodeId, cat){
  _strLibUI(nodeId).cat = String(cat == null ? '' : cat);
  _strLibRepaint(nodeId);
}
function veStrMatLibPick(nodeId, libId){
  var ui = _strLibUI(nodeId);
  // Aynı satıra ikinci tık seçimi kaldırır (CAD yüz listesindeki kuralın
  // aynısı) — başka türlü künyeyi kapatmanın yolu yoktu.
  ui.sel = (ui.sel === libId) ? '' : libId;
  _strLibRepaint(nodeId);
}

function _strLibRepaint(nodeId){
  if(typeof document === 'undefined') return;
  // Arama kutusunu YALNIZ ayrıştıysa yaz. Kullanıcı yazarken değer zaten
  // eşit olduğu için DOM'a hiç dokunulmuyor (yazma imleci bozulmaz); ama
  // sorgu koddan değiştirildiyse (test, dışarıdan çağrı) kutu listeyle
  // ayrışık kalmasın — ölçümde tam olarak bu görüldü: liste tazelendi,
  // kutuda eski metin durdu.
  var kutu = document.getElementById('ve-str-mat-q');
  if(kutu && kutu.value !== _strLibUI(nodeId).q) kutu.value = _strLibUI(nodeId).q;
  var liste = document.getElementById('ve-str-mat-list');
  var say = document.getElementById('ve-str-mat-count');
  var det = document.getElementById('ve-str-mat-det');
  if(liste) liste.innerHTML = _strLibListHTML(nodeId);
  if(say) say.textContent = _strLibCountText(nodeId);
  if(det) det.innerHTML = _strLibDetailHTML(nodeId);
}

function _strLibResults(nodeId){
  if(!_strLibHas()) return [];
  var ui = _strLibUI(nodeId);
  return veStrMatLibSearch(ui.q, ui.cat);
}

function _strLibCountText(nodeId){
  if(!_strLibHas()) return '';
  var n = _strLibResults(nodeId).length;
  var t = _strFmt(VE_STR_MAT_LIB.length) + ' kayıt · ' + VE_STR_MAT_CATS.length + ' aile'
        + ' · sürüm ' + VE_STR_MAT_LIB_VERSION + ' · ' + VE_STR_MAT_LIB_TEMP_C + ' °C';
  var ui = _strLibUI(nodeId);
  if(ui.q || ui.cat) t = _strFmt(n) + ' sonuç · ' + t;
  return t;
}

function _strLibListHTML(nodeId){
  if(!_strLibHas()) return '<div class="ve-str-mat-empty">Malzeme kütüphanesi yüklenmedi.</div>';
  var ui = _strLibUI(nodeId);
  var node = _strNodeById(nodeId);
  var uygulanan = (node && veStrMatOf(node).lib) || '';
  var list = _strLibResults(nodeId);
  if(!list.length){
    return '<div class="ve-str-mat-empty">Eşleşen malzeme yok.<br>'
         + 'Standart numarası (10025), malzeme numarası (1.4301), yabancı ad (AISI 304) '
         + 'ya da atölye adı (sfero) ile de aranabilir.</div>';
  }
  // Kategoriye SÜZÜLMEMİŞ ve ARAMA YAPILMAMIŞ listede aile başlığı basılıyor:
  // 112 kayıt düz bir şerit hâlinde okunmaz. Arama sonuçlarında başlık YOK —
  // orada sıra PUANA göre, aileye göre değil; başlık koymak sırayı yalanlardı.
  var basliklar = !ui.q;
  var h = '', sonCat = null;
  list.forEach(function(m){
    if(basliklar && m.c !== sonCat){
      sonCat = m.c;
      var c = veStrMatLibCat(m.c);
      h += '<div class="ve-str-mat-head">' + _strEsc(c ? c.ad : m.c) + '</div>';
    }
    // Dar sütunda satır İKİ SATIR: ad + gösterimler, sağda tek sayı. ρ listeden
    // ÇIKARILDI — künyede zaten var ve üçüncü kolon satırı üç satıra taşırıyordu
    // (ölçüldü: 112 satırlık liste bir buçuk kat uzuyordu).
    var alt = (m.alt && m.alt.length) ? m.alt.slice(0, 3).join(' · ') : (m.std || '');
    h += '<button type="button" class="ve-str-mat-row'
      +  (ui.sel === m.id ? ' on' : '')
      +  (uygulanan === m.id ? ' applied' : '') + '"'
      +  ' onclick="veStrMatLibPick(\'' + nodeId + '\',\'' + _strEsc(m.id) + '\')"'
      +  ' title="' + _strEsc(m.n + ' — ' + (m.std || '') + ' · ' + m.rho + ' kg/m³') + '">'
      +  '<span class="ve-str-mat-row-n">'
      +    '<span class="ve-str-mat-row-t">' + _strEsc(m.n) + '</span>'
      +    '<span class="ve-str-mat-row-alt">' + _strEsc(alt) + '</span></span>'
      +  '<span class="ve-str-mat-row-num">' + _strFmt(m.E / 1000, 0) + ' GPa</span>'
      +  '</button>';
  });
  return h;
}

// Seçilenin künyesi — "Uygula"dan ÖNCEKİ tek durak. Bütün sayılar burada
// görünüyor: kullanıcı kör bir kimliğe değil, OKUDUĞU değerlere onay veriyor.
function _strLibDetailHTML(nodeId){
  if(!_strLibHas()) return '';
  var ui = _strLibUI(nodeId);
  if(!ui.sel) return '';
  var m = veStrMatLibById(ui.sel);
  if(!m) return '';
  var cat = veStrMatLibCat(m.c);
  var node = _strNodeById(nodeId);
  var uygulanan = (node && veStrMatOf(node).lib) || '';

  function prop(sym, v, unit, ref){
    return '<div class="ve-str-mat-prop' + (ref ? ' ref' : '') + '">'
         + '<b>' + (v === null || v === undefined ? '—' : v) + '</b>'
         + '<span>' + sym + (unit ? ' [' + unit + ']' : '') + '</span></div>';
  }

  var h = '<div class="ve-str-mat-det">';
  h += '<div class="ve-str-mat-det-h">'
     + '<span class="ve-str-mat-det-n">' + _strEsc(m.n) + '</span>'
     + '<span class="ve-str-mat-det-std">' + _strEsc(m.std || '') + ' · ' + _strEsc(cat ? cat.ad : m.c) + '</span>'
     + '</div>';
  if(m.alt && m.alt.length){
    h += '<div class="ve-str-mat-note">Diğer adlar: ' + _strEsc(m.alt.join(' · ')) + '</div>';
  }
  h += '<div class="ve-str-mat-props">';
  h += prop('E', _strFmt(m.E), 'MPa');
  h += prop('ν', _strFmt(m.nu, 3), '');
  h += prop('ρ', _strFmt(m.rho), 'kg/m³');
  h += prop('σ<sub>ak</sub>', m.sy == null ? null : _strFmt(m.sy), 'MPa');
  h += prop('σ<sub>ç</sub>', m.su == null ? null : _strFmt(m.su), 'MPa');
  h += prop('α', m.a == null ? null : _strFmt(m.a, 1), '10⁻⁶/K');
  // Referans alanlar SOLGUN ve etiketleri bunu söylüyor: çözücüye gitmiyorlar.
  h += prop('λ <i>(ref.)</i>', m.k == null ? null : _strFmt(m.k, 2), 'W/m·K', true);
  h += prop('c<sub>p</sub> <i>(ref.)</i>', m.cp == null ? null : _strFmt(m.cp), 'J/kg·K', true);
  h += '</div>';
  if(m.not) h += '<div class="ve-str-mat-note">' + _strEsc(m.not) + '</div>';
  if(m.uyari) h += '<div class="ve-str-mat-warn"><b>Dikkat.</b> ' + _strEsc(m.uyari) + '</div>';

  if(uygulanan === m.id && veStrMatLibMatches(veStrMatOf(node))){
    h += '<div style="font-size:var(--fs-micro); color:var(--accent-warning); font-weight:600;">✓ Bu malzeme parçaya uygulanmış.</div>';
  } else {
    h += '<button class="ve-str-btn ve-str-btn--primary" style="width:100%;"'
      +  ' onclick="veStrMatApplyLib(\'' + nodeId + '\',\'' + _strEsc(m.id) + '\')">'
      +  'Parçaya Uygula</button>';
  }
  return h + '</div>';
}

// Katalog kaydını parçaya uygula. Kayıt KOPYA olarak gidiyor (bkz.
// veStrMatLibRecord) — kütüphane sürümü değişse bile kaydedilmiş proje
// kendiliğinden değişmiyor.
// Uygulanan kaydı listede GÖRÜNÜR yap. 112 satırlık bir listede ✓ işareti
// ekranın dışındaysa hiçbir şey söylemiyor demektir — kullanıcı "hangisi
// takılı" sorusunu ancak kaydırarak cevaplayabilirdi. CAD yüz listesindeki
// `scrollIntoView` kuralının aynısı.
function veStrMatLibScrollToApplied(nodeId){
  if(typeof document === 'undefined') return false;
  var liste = document.getElementById('ve-str-mat-list');
  if(!liste) return false;
  var satir = liste.querySelector('.ve-str-mat-row.applied') || liste.querySelector('.ve-str-mat-row.on');
  if(!satir) return false;
  // `block:'nearest'` sayfayı DEĞİL yalnız listeyi kaydırır; 'center' olsaydı
  // panelin tamamı zıplardı.
  try { satir.scrollIntoView({ block: 'nearest' }); } catch(e) { return false; }
  return true;
}

function veStrMatApplyLib(nodeId, libId){
  var node = _strNodeById(nodeId);
  if(!node || !_strLibHas()) return false;
  var rec = veStrMatLibRecord(libId);
  if(!rec) return false;
  if(!node.data) node.data = {};
  node.data.material = rec;
  if(typeof saveState === 'function') saveState();
  if(typeof veStrRefreshBadge === 'function') veStrRefreshBadge(nodeId);
  if(typeof showToast === 'function') showToast(rec.name + ' uygulandı', 'success');
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
  return true;
}

// Uygulanan kaydın İZİ — panelde açıkça yazılı. Üç durum var ve üçü farklı
// şey söylüyor; ikisini birleştirmek kullanıcıyı yanıltırdı:
//   • katalogdan geldi ve DEĞİŞMEDİ        → katalog adı geçerli
//   • katalogdan geldi ama ELLE DEĞİŞTİ    → ad artık kaydı anlatmıyor
//   • hiç katalogdan gelmedi               → elle girilmiş
function _strMatSourceLine(node){
  var m = veStrMatOf(node);
  if(!m.lib || !_strLibHas()){
    var doluMu = Object.keys(m).length > 0;
    if(!doluMu) return '';
    return '<div style="font-size:var(--fs-micro); color:var(--text-muted); margin-bottom:8px;">'
         + 'Elle girilmiş kayıt — kütüphane izi yok.</div>';
  }
  var kat = veStrMatLibById(m.lib);
  var ad = kat ? kat.n : m.lib;
  var std = kat ? (' · ' + kat.std) : '';
  if(veStrMatLibMatches(m)){
    return '<div style="font-size:var(--fs-micro); color:var(--text-muted); margin-bottom:8px;">'
         + 'Kütüphaneden: <b style="color:var(--text-secondary);">' + _strEsc(ad) + '</b>'
         + _strEsc(std) + ' · katalog sürümü ' + _strEsc(m.libVer || '?') + '</div>';
  }
  return '<div style="font-size:var(--fs-micro); color:var(--accent-warning); margin-bottom:8px;">'
       + '<b>' + _strEsc(ad) + '</b> kaydından türetildi, <b>elle değiştirildi</b> — '
       + 'değerler artık katalogdakiler değil.</div>';
}

function getStrMaterialPropertiesHTML(node){
  if(!node.data) node.data = {};
  var m = veStrMatOf(node);

  var html = '<div class="sw-panel">';
  html += '<div style="padding:8px 10px; margin-bottom:9px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-primary);">'
        + '<b style="color:var(--text-heading);">Malzeme ve Özellikler.</b> Geometri\'ye asılan <b>alt bileşen</b> — '
        + 'içe aktarılan parçaya malzeme atar. Zincirin halkası değildir: çıkışı yoktur, '
        + 'Geometri\'nin <b>alt</b> portundan beslenir.</div>';

  html += _strMatHostCard(node);

  // ── İKİ SÜTUN ──
  // SOL DAR, SAĞ GENİŞ: katalog bir SEÇİCİ, asıl içerik seçilenin kendisi.
  // İlk sürümde katalog geniş, künye dardı ve kullanıcı haklı olarak itiraz
  // etti: "Malzeme Kütüphanesi kısmı çok geniş olmuş." Liste bir ad + iki
  // sayıdan ibaret; genişlik ona değil diyagramlara lazım.
  html += '<div class="ve-cp-grid ve-str-mat-grid">';

  // ── SOL: kütüphane (dar) ──
  var sol = '<div class="sw-section-title">Malzeme Kütüphanesi</div>';
  if(_strLibHas()){
    sol += '<div class="ve-str-mat-disc">'
         + 'Değerler standardın <b>nominal</b> değerleridir, döküm sertifikası değil. '
         + 'Hüküm verilecek analizde muayene belgesiyle (EN 10204) doğrulayın. Taban <b>'
         + VE_STR_MAT_LIB_TEMP_C + ' °C</b>.'
         + '</div>';
    sol += _strLibFilterHTML(node.id);
    sol += '<div class="ve-str-mat-count" id="ve-str-mat-count">' + _strEsc(_strLibCountText(node.id)) + '</div>';
    sol += '<div class="ve-str-mat-list" id="ve-str-mat-list">' + _strLibListHTML(node.id) + '</div>';
    sol += '<div id="ve-str-mat-det">' + _strLibDetailHTML(node.id) + '</div>';
  } else {
    sol += '<div class="ve-str-mat-empty">Malzeme kütüphanesi yüklenmedi '
         + '(js/structural-materials.js). Değerler sağdaki alanlardan elle girilebilir.</div>';
  }

  // ── SAĞ: uygulanan malzeme — künye, diyagramlar, sıcaklık değerlendirici ──
  var kat = (m.lib && _strLibHas()) ? veStrMatLibById(m.lib) : null;
  var sag = '<div class="sw-section-title">Uygulanan Malzeme</div>';
  sag += _strMatSourceLine(node);
  sag += '<div style="display:flex; align-items:center; gap:10px; margin-bottom:9px;">'
       + '<div style="flex:0 0 auto; font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">Ad</div>'
       + '<input type="text" id="ve-str-mat-name-' + node.id + '" value="' + _strEsc(m.name == null ? '' : m.name) + '"'
       + ' placeholder="ör. S355JR" onchange="veStrMatSet(\'' + node.id + '\',\'name\',this.value)"'
       + ' style="flex:1 1 auto; min-width:0; ' + _STR_INP + ' text-align:left;">'
       + '</div>';
  sag += _strMatFieldGrid(node);
  sag += _strMatVerdict(node);

  sag += '<div class="sw-section-title">Türetilen</div>';
  sag += _strMatDerivedTable(node);

  // Katalog kaydı varsa: genişletilmiş künye + diyagramlar. Elle girilmiş
  // kayıtta bunlar YOK ve panel sebebini söylüyor — sertlik, uzama, sıcaklık
  // eğrisi ve yorulma modeli KATALOGDAN geliyor, altı sayısal alandan değil.
  if(kat){
    sag += _strMatExtTable(kat);
    sag += _strMatTempEval(node, kat);
    sag += '<div class="sw-section-title">Diyagramlar</div>';
    sag += '<div class="ve-str-dia-grid">';
    sag += _strMatStressStrainSVG(kat);
    sag += _strMatWohlerSVG(kat);
    sag += _strMatTempSVG(kat);
    sag += '</div>';
    sag += _strMatDiaNote(kat);
  } else if(Object.keys(m).length){
    sag += '<div style="padding:7px 9px; margin:8px 0; font-size:var(--fs-micro); line-height:1.45; '
         + 'color:var(--text-muted); background:var(--bg-secondary); border:1px dashed var(--border-color);">'
         + '<b style="color:var(--text-secondary);">Diyagramlar yok.</b> Sertlik, uzama, sıcaklık eğrisi ve '
         + 'yorulma modeli <b>katalogdan</b> gelir — elle girilen altı sayı bunları üretmeye yetmez. '
         + 'Soldan bir kayıt uygulayın, sonra istediğiniz alanı elle düzeltin.'
         + '</div>';
  }

  sag += '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">';
  sag += '<button class="ve-str-btn ve-str-btn--danger" onclick="veStrMatClear(\'' + node.id + '\')">Temizle</button>';
  sag += '</div>';
  sag += '<div style="padding:7px 9px; font-size:var(--fs-micro); line-height:1.45; color:var(--text-muted); background:var(--bg-secondary); border:1px dashed var(--border-color);">'
       + '<b style="color:var(--text-secondary);">Katalogda olmayanlar:</b> kompozit laminatlar (ortotrop — bu kart izotrop), '
       + 'ölçülmüş S-N eğrileri (buradaki Wöhler bir MODELDİR), akma sonrası pekleşme eğrisi, '
       + 'sürünme (creep) eğrileri, kırılma tokluğu K_Ic, anizotropi.'
       + '</div>';

  html += '<div class="ve-cp-col ve-str-mat-col-lib">' + sol + '</div>';
  html += '<div class="ve-cp-col ve-str-mat-col-cur">' + sag + '</div>';
  html += '</div></div>';
  return html;
}

// ── GENİŞLETİLMİŞ KÜNYE ─────────────────────────────────────────────────────
// Çözücüye giden altı alanın YANINDA duran, malzemeyi ANLATAN veriler.
// Hepsi katalogdan; hiçbiri kayda kopyalanmıyor (ölü veri olurdu).
function _strMatExtTable(kat){
  var h = (typeof veStrMatHardness === 'function') ? veStrMatHardness(kat) : null;
  var f = (typeof veStrMatFatigue === 'function') ? veStrMatFatigue(kat) : null;
  var oz = (kat.sy != null && kat.rho > 0) ? (kat.sy / kat.rho * 1000) : null;  // kNm/kg
  function sat(k, v, not){
    return '<tr><td>' + k + '</td><td>' + v
         + (not ? ' <span class="ve-str-ext-not">' + not + '</span>' : '') + '</td></tr>';
  }
  var t = '<div class="sw-section-title">Malzeme Künyesi</div>';
  t += '<table class="ve-str-ext">';
  t += sat('Sertlik', h ? (_strFmt(h.deger) + ' ' + h.birim) : '—',
           h && h.olcek === 'hb' ? 'Rm/HB = ' + _strFmt(veStrMatHardnessRatio(kat), 2) + ' (ISO 18265)' : '');
  t += sat('Kopma uzaması A', _strFmt(kat.A, kat.A < 10 ? 1 : 0) + ' %',
           kat.A < 2 ? 'gevrek' : (kat.A > 20 ? 'çok sünek' : ''));
  t += sat('Azami sürekli servis', _strFmt(kat.tmax) + ' °C', 'malzemenin kendi sınırı');
  if(f){
    t += sat('Dayanma sınırı σ_W', _strFmt(f.sw, 0) + ' MPa',
             f.sinirVar ? ('N_D = 10⁶ · f_W = ' + _strFmt(f.fw, 2)) : 'GERÇEK SINIR YOK — eğri düşmeye devam eder');
  } else {
    t += sat('Dayanma sınırı σ_W', '—', 'bu sınıf için yorulma modeli yok');
  }
  if(oz !== null) t += sat('Özgül dayanım σ_ak/ρ', _strFmt(oz, 1) + ' kN·m/kg', 'hafiflik ölçütü');
  t += sat('Isıl iletkenlik λ', kat.k == null ? '—' : _strFmt(kat.k, 2) + ' W/(m·K)', 'ref. — çözücüye gitmez');
  t += sat('Özgül ısı c_p', kat.cp == null ? '—' : _strFmt(kat.cp) + ' J/(kg·K)', 'ref. — çözücüye gitmez');
  t += '</table>';
  return t;
}

// ── SICAKLIK DEĞERLENDİRİCİ ─────────────────────────────────────────────────
// Eğriyi okumak yerine SAYIYI vermek: kullanıcı θ yazıyor, panel o sıcaklıktaki
// E ve akma dayanımını basıyor. Seçilen θ OTURUMLUK (node.data'ya yazılmıyor):
// bir okuma tercihi undo yığınına binmemeli — arama metnindeki kuralın aynısı.
function _strMatTempEval(node, kat){
  if(typeof veStrMatTempSet !== 'function' || !veStrMatTempSet(kat)) return '';
  var ui = _strLibUI(node.id);
  var t = (ui.tempC == null) ? 20 : ui.tempC;
  var at = veStrMatAtTemp(kat, t);
  var set = veStrMatTempSet(kat);
  var asildi = (typeof kat.tmax === 'number') && t > kat.tmax;

  var h = '<div class="sw-section-title">Sıcaklıkta Değerlendir</div>';
  h += '<div class="ve-str-tempeval">';
  h += '<label>θ <input type="number" id="ve-str-mat-temp" value="' + _strEsc(t) + '" step="10"'
    +  ' oninput="veStrMatSetTemp(\'' + node.id + '\', this.value)"> °C</label>';
  h += '<span class="ve-str-tempeval-v"><b>' + (at.E == null ? '—' : _strFmt(at.E, 0)) + '</b> MPa <i>E</i></span>';
  h += '<span class="ve-str-tempeval-v"><b>' + (at.sy == null ? '—' : _strFmt(at.sy, 0)) + '</b> MPa <i>σ_ak</i></span>';
  h += '<span class="ve-str-tempeval-v"><b>' + _strFmt(at.kE * 100, 0) + '%</b> <i>E oranı</i></span>';
  h += '</div>';
  var uyari = '';
  if(at.disarida) uyari = 'Eğrinin tanım aralığının dışı — uçtaki değere sabitlendi, ekstrapolasyon yapılmadı.';
  else if(asildi) uyari = 'Azami sürekli servis sıcaklığının (' + _strFmt(kat.tmax) + ' °C) ÜSTÜ: '
    + 'kısa süreli dayanım okunabilir ama sürünme ve kalıcı hasar bu modelde YOK.';
  else if(set.tur !== 'std') uyari = 'Bu eğri bir standardın tablosu değil, sınıfın TİPİK SEYRİDİR.';
  if(uyari){
    h += '<div class="ve-str-tempwarn">' + _strEsc(uyari) + '</div>';
  }
  return h;
}

function _strMatDiaNote(kat){
  var f = (typeof veStrMatFatigue === 'function') ? veStrMatFatigue(kat) : null;
  var set = (typeof veStrMatTempSet === 'function') ? veStrMatTempSet(kat) : null;
  var n = '<div class="ve-str-dia-note">';
  n += '<b>Diyagramlar kayıttan türetildi.</b> ';
  n += 'Gerilme–gerinim <b>idealleştirilmiş</b> bir şemadır (E, σ_ak, σ_ç, A gerçek; aralarındaki biçim değil). ';
  if(f){
    n += 'Wöhler eğrisi <b>ölçülmüş değil</b>, ' + _strEsc(f.kaynak === 'FKM' ? 'FKM yönergesinin' : 'sınıfın tipik')
      + ' modelidir (σ_W = f_W · σ_ç); yüzey pürüzlülüğü, boyut, çentik ve ortalama gerilme etkileri '
      + '<b>dahil değildir</b> — gerçek bir parçanın dayanma sınırı bunlarla DÜŞER. ';
  }
  if(set) n += 'Sıcaklık eğrisinin kaynağı: ' + _strEsc(set.kaynak) + '.';
  return n + '</div>';
}

// Sıcaklık değerlendiricinin girdisi — OTURUMLUK, node.data'ya yazılmıyor.
// Panel değil yalnız değerlendirici satırı tazeleniyor: `showNodeProperties`
// çağrılsaydı sayı kutusu DOM'dan silinir ve odak her tuşta kaybolurdu
// (arama kutusundaki dersin aynısı).
function veStrMatSetTemp(nodeId, val){
  var v = Number(val);
  _strLibUI(nodeId).tempC = isFinite(v) ? v : 20;
  var node = _strNodeById(nodeId);
  if(!node || typeof document === 'undefined') return;
  var kat = (typeof veStrMatLibById === 'function') ? veStrMatLibById(veStrMatOf(node).lib) : null;
  if(!kat) return;
  var kutu = document.getElementById('ve-str-mat-temp');
  if(!kutu) return;
  var blok = kutu.closest ? kutu.closest('.ve-str-tempeval') : null;
  if(!blok || !blok.parentNode) return;
  var yeniHTML = _strMatTempEval(node, kat);
  // Yalnız değer alanlarını ve uyarıyı değiştir; sayı kutusuna DOKUNMA.
  var tmp = document.createElement('div');
  tmp.innerHTML = yeniHTML;
  var yeniBlok = tmp.querySelector('.ve-str-tempeval');
  var eskiV = blok.querySelectorAll('.ve-str-tempeval-v');
  var yeniV = yeniBlok ? yeniBlok.querySelectorAll('.ve-str-tempeval-v') : [];
  for(var i = 0; i < eskiV.length && i < yeniV.length; i++) eskiV[i].innerHTML = yeniV[i].innerHTML;
  var eskiU = blok.parentNode.querySelector('.ve-str-tempwarn');
  var yeniU = tmp.querySelector('.ve-str-tempwarn');
  if(eskiU && yeniU) eskiU.innerHTML = yeniU.innerHTML;
  else if(eskiU && !yeniU) eskiU.remove();
  else if(!eskiU && yeniU) blok.parentNode.insertBefore(yeniU, blok.nextSibling);
}

// Arama + kategori süzgeci. `oninput` LİSTEYİ tazeliyor, paneli değil —
// panel yeniden çizilseydi arama kutusu DOM'dan silinir ve odak her harfte
// kaybolurdu.
function _strLibFilterHTML(nodeId){
  if(!_strLibHas()) return '';
  var ui = _strLibUI(nodeId);
  var say = veStrMatLibCounts();
  var h = '<div class="ve-str-mat-filter">';
  h += '<input type="search" id="ve-str-mat-q" value="' + _strEsc(ui.q) + '"'
    +  ' placeholder="Ara: S355 · 1.4301 · AISI 304 · sfero · 42CrMo4"'
    +  ' oninput="veStrMatLibQuery(\'' + nodeId + '\', this.value)">';
  h += '<select onchange="veStrMatLibSetCat(\'' + nodeId + '\', this.value)">';
  h += '<option value=""' + (ui.cat ? '' : ' selected') + '>Tüm aileler (' + VE_STR_MAT_LIB.length + ')</option>';
  VE_STR_MAT_CATS.forEach(function(c){
    h += '<option value="' + _strEsc(c.key) + '"' + (ui.cat === c.key ? ' selected' : '') + '>'
      +  _strEsc(c.ad) + ' (' + (say[c.key] || 0) + ')</option>';
  });
  h += '</select></div>';
  return h;
}

// ════════════════════════════════════════════════════════════════════════════
//  HESAPLAMA AĞI — TetGen ile tet10 hacim ağı
// ════════════════════════════════════════════════════════════════════════════
// Zincirin ikinci bileşeni. SUNUM katmanı: ayarları alır, köprüye
// (js/structural-mesh-model.js) verir, dönen ağı künye olarak gösterir.
// KENDİ AĞINI ÖRMEZ — tek tetrahedron bile burada üretilmiyor.
//
// GEOMETRİ TELDEN OKUNUYOR, ikinci bir "kaynak seç" alanı YOK — Malzeme
// bileşenindeki kuralın aynısı ve aynı gerekçesi: panelde ayrı bir hedef alanı
// tutulsaydı tel ile alan sessizce ayrışırdı.
var VE_STR_MESH_DEFAULT_DIVISOR = 40;   // hedef kenar ≈ sınır kutusu köşegeni / 40

// Kullanıcının dokunacağı TEK sayı hedef kenar boyu. Kalite reçetesi (radius-edge
// oranı, min dihedral) panelde YOK ve bu bilinçli: aynı braket için kurulmuş
// Python boru hattı bu parametreleri taramış ve "2,5 kat eleman, marjinal kazanç,
// minimum kalite DAHA DA DÜŞÜK" sonucuna varmış — yani bu düğmeleri kullanıcının
// önüne koymak, iyileştirdiğini sanarak ağı bozabileceği bir yüzey açardı.
// Değerler köprüde sabit (VE_STR_TETGEN_DEFAULTS) ve künyede YAZILI.
// Rozet 62×56'lık kutuya sığmak zorunda: 82.016 gibi bir sayı taşardı.
// "82b" okunabilir ve büyüklük mertebesini doğru veriyor; tam sayı ipucunda.
function _strMeshShort(n){
  n = Number(n) || 0;
  if(n < 1000) return String(n);
  if(n < 1000000) return _strFmt(Math.round(n / 100) / 10, 1) + 'b';
  return _strFmt(Math.round(n / 100000) / 10, 1) + 'M';
}

function veStrMeshHost(node){
  if(!node || typeof connections === 'undefined' || typeof nodes === 'undefined') return null;
  var host = null;
  connections.forEach(function(c){
    if(host || c.to !== node.id) return;
    var n = nodes.find(function(x){ return x.id === c.from; });
    if(n && n.type === 'str-geometry') host = n;
  });
  return host;
}

// Hedef kenar boyu: kullanıcı girmediyse parçanın sınır kutusundan TÜRETİLİR.
// Sabit bir varsayılan (ör. "3 mm") 10 mm'lik bir pimde saçma, 1 m'lik bir
// şasede imkânsız olurdu.
function veStrMeshTargetLen(node, geomNode){
  var girilen = Number(node && node.data && node.data.targetLen);
  if(isFinite(girilen) && girilen > 0) return girilen;
  var g = geomNode && geomNode.data && geomNode.data.geometry;
  var diag = g && g.bbox && Number(g.bbox.diag);
  if(!isFinite(diag) || diag <= 0) return null;
  return Math.round((diag / VE_STR_MESH_DEFAULT_DIVISOR) * 100) / 100;
}

function _strMeshStatus(msg, kind){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-str-mesh-status');
  if(!el) return;
  el.style.color = (kind === 'err') ? 'var(--accent-danger, #ef4444)'
                 : (kind === 'ok') ? 'var(--accent-success, #22c55e)'
                 : 'var(--text-secondary)';
  el.innerHTML = msg ? _strEsc(msg) : '';
}

var VE_STR_MESH_STAGE_TEXT = {
  reader: 'Ağ üreteci hazırlanıyor',
  remesh: 'Yüzey hazırlanıyor',
  tetgen: 'Hacim ağı örülüyor',
  build:  'Ağ kuruluyor'
};

var _veStrMeshTimer = {};

function _strMeshProgStart(nodeId, baslik){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-str-mesh-progress');
  if(!el) return;
  var t0 = Date.now();
  el.innerHTML =
      '<div class="ve-str-prog">'
    +   '<div class="ve-str-prog-head"><span class="ve-str-prog-spin"></span><b>' + _strEsc(baslik) + '</b></div>'
    +   '<div class="ve-str-prog-file"><span data-ve="stage">başlıyor</span></div>'
    +   '<div class="ve-str-prog-bar"><i data-ve="fill" class="indet"></i></div>'
    +   '<div class="ve-str-prog-foot"><span data-ve="detail"></span><span data-ve="clock">0,0 sn</span></div>'
    + '</div>';
  el.style.display = 'block';
  if(_veStrMeshTimer[nodeId]) clearInterval(_veStrMeshTimer[nodeId]);
  _veStrMeshTimer[nodeId] = setInterval(function(){
    var c = document.getElementById('ve-str-mesh-progress');
    c = c && c.querySelector('[data-ve="clock"]');
    if(!c){ clearInterval(_veStrMeshTimer[nodeId]); delete _veStrMeshTimer[nodeId]; return; }
    c.textContent = _strFmt((Date.now() - t0) / 1000, 1) + ' sn';
  }, 100);
}

function _strMeshProgSet(stage, info){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-str-mesh-progress');
  if(!el) return;
  var s = el.querySelector('[data-ve="stage"]');
  var det = el.querySelector('[data-ve="detail"]');
  if(s) s.textContent = VE_STR_MESH_STAGE_TEXT[stage] || stage;
  // Katı sayacı UYDURMA BİR YÜZDE DEĞİL: kaçıncı katının işlendiği gerçekten
  // biliniyor. Tek katılı parçada hiç yazılmaz (yanıltıcı olurdu).
  if(det) det.textContent = (info && info.total > 1) ? ('katı ' + (info.solid + 1) + ' / ' + info.total) : '';
}

function _strMeshProgEnd(nodeId){
  if(_veStrMeshTimer[nodeId]){ clearInterval(_veStrMeshTimer[nodeId]); delete _veStrMeshTimer[nodeId]; }
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-str-mesh-progress');
  if(el){ el.innerHTML = ''; el.style.display = 'none'; }
}

function veStrMeshSetTarget(nodeId, val){
  var node = _strNodeById(nodeId);
  if(!node) return;
  if(!node.data) node.data = {};
  var n = Number(val);
  if(isFinite(n) && n > 0) node.data.targetLen = n; else delete node.data.targetLen;
  if(typeof saveState === 'function') saveState();
}

function veStrMeshBuild(nodeId){
  var node = _strNodeById(nodeId);
  if(!node) return;
  var geomNode = veStrMeshHost(node);
  var geom = geomNode && (typeof veStrGeomCacheGet === 'function') ? veStrGeomCacheGet(geomNode.id) : null;
  if(!geomNode){ _strMeshStatus('Bu bileşen bir Geometri bileşenine bağlı değil.', 'err'); return; }
  if(!geom || !geom.ok){
    _strMeshStatus('Bağlı Geometri bileşeninde parça yok — önce bir STEP dosyası içe aktarın.', 'err');
    return;
  }
  if(typeof veStrBuildMesh !== 'function'){
    _strMeshStatus('Ağ köprüsü yüklenmedi (structural-mesh-model.js).', 'err');
    return;
  }

  var target = veStrMeshTargetLen(node, geomNode);
  _strMeshStatus('');
  _strMeshProgStart(nodeId, (geom.fileName || 'Parça') + ' · hedef kenar ' + _strFmt(target, 2) + ' mm');

  veStrBuildMesh(geom, { targetLen: target }, {
    onProgress: function(stage, info){ _strMeshProgSet(stage, info); }
  }).then(function(res){
    _strMeshProgEnd(nodeId);
    if(!res || !res.ok){
      _strMeshStatus((res && res.error) || 'Ağ kurulamadı.', 'err');
      if(typeof veStrMeshCacheClear === 'function') veStrMeshCacheClear();
      if(!node.data) node.data = {};
      delete node.data.mesh;
      if(typeof saveState === 'function') saveState();
      if(typeof showNodeProperties === 'function') showNodeProperties(node);
      return;
    }
    if(typeof veStrMeshCacheSet === 'function') veStrMeshCacheSet(nodeId, res);
    if(!node.data) node.data = {};
    node.data.mesh = (typeof veStrMeshRecord === 'function') ? veStrMeshRecord(res) : null;
    node.data.meshSourceFile = geom.fileName || '';
    if(typeof saveState === 'function') saveState();
    _strMeshStatus('Ağ hazır: ' + _strFmt(res.stats.tets) + ' eleman.', 'ok');
    if(typeof showNodeProperties === 'function') showNodeProperties(node);
    if(typeof veStrRefreshBadge === 'function') veStrRefreshBadge(nodeId);
  }, function(err){
    _strMeshProgEnd(nodeId);
    _strMeshStatus('Ağ kurulamadı: ' + ((err && err.message) || err), 'err');
  });
}

function veStrMeshClear(nodeId){
  var node = _strNodeById(nodeId);
  if(!node) return;
  if(node.data) delete node.data.mesh;
  if(typeof veStrMeshCacheClear === 'function') veStrMeshCacheClear();
  if(typeof saveState === 'function') saveState();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
  if(typeof veStrRefreshBadge === 'function') veStrRefreshBadge(nodeId);
}

// ── AĞ KÜNYESİ ──────────────────────────────────────────────────────────────
// Dört sayı ZORUNLU ve her biri ayrı bir soruya cevap veriyor. Hangisinin
// KRİTİK olduğu ölçülmüş bir ders: aynı braket için kurulmuş Python boru hattı
// notlarına "kritik metrik `v_min`, `q_min` DEĞİL" diye yazmış — şekil ölçütü
// iyi bir ağda bile sıfır görünebiliyor, ama HACMİ sıfıra yakın tetler
// rijitlik matrisini tekil yapıyor ve hiçbir ön koşullandırıcı kurtaramıyor
// (o tarafta CG 800 iterasyonda 1e-2'de takılmış). Bu yüzden dejenere eleman
// sayısı burada bir UYARI değil, çözümü durduran bir HÜKÜM.
function _strMeshStatsHTML(rec){
  var s = rec.stats || {};
  var su = s.surface || {};
  var h = '<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:9px;">';
  function sat(ad, deger, vurgu){
    h += '<tr><td style="padding:4px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">' + ad + '</td>'
      +  '<td style="padding:4px 8px; border:1px solid var(--border-color); color:' + (vurgu || 'var(--text-primary)') + '; font-weight:600; text-align:right;">' + deger + '</td></tr>';
  }
  sat('Düğüm', _strFmt(s.nodes));
  sat('Eleman (tet' + (s.order === 2 ? '10' : '4') + ')', _strFmt(s.tets));
  sat('Serbestlik derecesi', _strFmt(s.dof));
  sat('Ağ hacmi', _strFmt(s.volume, 1) + ' mm³');
  if(s.solidTotal > 1) sat('Katı', s.solidCount + ' / ' + s.solidTotal);
  sat('En küçük eleman hacmi', (s.minTetVolume != null ? s.minTetVolume.toExponential(2) : '—') + ' mm³');
  sat('Dejenere eleman', _strFmt(s.degenerate),
      s.degenerate > 0 ? 'var(--accent-danger, #ef4444)' : 'var(--accent-success, #22c55e)');
  if(su.volumeLossPct != null){
    sat('Hacim kaybı (yüzey hazırlığı)', _strFmt(su.volumeLossPct, 2) + ' %',
        su.volumeLossPct > 4 ? 'var(--accent-warning, #f59e0b)' : 'var(--text-primary)');
  }
  if(su.qualityAfter){
    sat('Yüzey min açı', _strFmt(su.qualityBefore ? su.qualityBefore.minAngleDeg : 0, 2) + '° → '
      + _strFmt(su.qualityAfter.minAngleDeg, 2) + '°');
  }
  if(su.nonManifoldEdges) sat('Non-manifold kenar', _strFmt(su.nonManifoldEdges), 'var(--accent-warning, #f59e0b)');
  h += '</table>';
  return h;
}

function _strMeshWarnHTML(rec){
  var s = rec.stats || {}, su = s.surface || {};
  var uyari = [];
  if(s.degenerate > 0){
    uyari.push(['err', 'Dejenere eleman var (' + _strFmt(s.degenerate) + ' adet, hacim < 1e-6 mm³). '
      + 'Bu elemanlar rijitlik matrisini sayısal olarak tekil yapar ve çözüm yakınsamaz — '
      + 'hedef kenar boyunu büyütüp ağı yeniden kurun.']);
  }
  if(s.inverted > 0) uyari.push(['err', 'Ters çevrilmiş eleman var (' + _strFmt(s.inverted) + ' adet).']);
  if(su.volumeLossPct > 4){
    uyari.push(['warn', 'Yüzey hazırlığı hacmin %' + _strFmt(su.volumeLossPct, 1) + '\'ini yedi. '
      + 'Ağ parçadan ince kalıyor, gerilme sistematik olarak yüksek çıkar — hedef kenar boyunu küçültün.']);
  }
  if(s.solidTotal > 1 && s.solidCount < s.solidTotal){
    uyari.push(['err', 'Parçanın ' + s.solidTotal + ' katısından ' + (s.solidTotal - s.solidCount)
      + ' tanesi ağa giremedi. Çözüm EKSİK bir gövde üzerinde koşar.']);
  }
  if(s.perSolid && s.solidCount > 1){
    uyari.push(['warn', 'Katılar AYRI AYRI ağlandı: temas yüzeylerinde düğümler çakışmaz, '
      + 'yani parçalar ağ düzeyinde birbirine bağlı değildir.']);
  }
  if(!uyari.length) return '';
  var h = '';
  uyari.forEach(function(u){
    var renk = (u[0] === 'err') ? 'var(--accent-danger, #ef4444)' : 'var(--accent-warning, #f59e0b)';
    h += '<div style="padding:7px 9px; margin-bottom:6px; font-size:var(--fs-micro); line-height:1.45;'
      +  ' color:var(--text-secondary); background:var(--bg-secondary); border-left:3px solid ' + renk + ';">'
      +  _strEsc(u[1]) + '</div>';
  });
  return h;
}

function getStrMeshPropertiesHTML(node){
  var id = node.id;
  var geomNode = veStrMeshHost(node);
  var g = geomNode && geomNode.data && geomNode.data.geometry;
  var rec = node.data && node.data.mesh;
  var target = veStrMeshTargetLen(node, geomNode);

  var h = '<div class="sw-panel">';

  // 1) KAYNAK — üç durum da AÇIKÇA yazılı (Malzeme bileşenindeki kural).
  h += '<div style="padding:7px 9px; margin-bottom:9px; font-size:var(--fs-micro); line-height:1.45;'
    +  ' background:var(--bg-secondary); border:1px solid var(--border-color);">';
  if(!geomNode){
    h += '<b style="color:var(--accent-warning, #f59e0b);">Geometri bileşenine bağlı değil.</b>'
      +  ' Kanvasta Geometri çıkışını bu bileşenin girişine bağlayın.';
  } else if(!g || !g.stats){
    h += '<b style="color:var(--accent-warning, #f59e0b);">Bağlı Geometri bileşeninde parça yok.</b>'
      +  ' Önce bir STEP dosyası içe aktarın.';
  } else {
    h += '<b style="color:var(--text-heading);">' + _strEsc(g.fileName || 'Parça') + '</b><br>'
      +  _strFmt(g.stats.triCount) + ' üçgen · ' + _strFmt(g.stats.faceCount) + ' CAD yüzü'
      +  (g.stats.meshCount > 1 ? (' · ' + g.stats.meshCount + ' katı') : '');
  }
  h += '</div>';

  // 2) AYAR — tek sayı: hedef kenar boyu.
  var hazir = !!(g && g.stats);
  h += '<div style="display:grid; grid-template-columns:1fr auto; gap:7px; align-items:end; margin-bottom:9px;">';
  h += '<div><label style="display:block; font-size:var(--fs-micro); color:var(--text-secondary); margin-bottom:3px;">'
    +  'Hedef kenar boyu (mm)</label>'
    +  '<input type="number" step="0.1" min="0.01" style="width:100%;" '
    +  (hazir ? '' : 'disabled ')
    +  'value="' + (target != null ? _strEsc(String(target)) : '') + '"'
    +  ' onchange="veStrMeshSetTarget(\'' + id + '\', this.value)"'
    +  ' placeholder="' + (target != null ? _strEsc(String(target)) : 'parçadan türetilir') + '"></div>';
  h += '<button onclick="veStrMeshBuild(\'' + id + '\')"' + (hazir ? '' : ' disabled')
    +  ' style="padding:9px 16px; font-size:var(--fs-body); font-weight:700; background:var(--accent-primary);'
    +  ' color:#fff; border:none; cursor:' + (hazir ? 'pointer' : 'not-allowed') + '; white-space:nowrap;">'
    +  (rec ? 'Ağı Yenile' : 'Ağı Oluştur') + '</button>';
  h += '</div>';

  h += '<div id="ve-str-mesh-progress" style="display:none; margin-bottom:9px;"></div>';
  h += '<div id="ve-str-mesh-status" style="font-size:var(--fs-micro); line-height:1.45; margin-bottom:9px;"></div>';

  // 3) SONUÇ
  if(rec && rec.stats){
    h += _strMeshWarnHTML(rec);
    h += _strMeshStatsHTML(rec);
    h += '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.5; margin-bottom:9px;">'
      +  'Eleman: <b>ikinci derece tetrahedron (tet10)</b> · TetGen anahtarları: <code>' + _strEsc(rec.switches || '') + '</code>'
      +  (rec.targetLen ? (' · hedef kenar ' + _strFmt(rec.targetLen, 2) + ' mm') : '')
      +  '</div>';
    h += '<button onclick="veStrMeshClear(\'' + id + '\')" style="width:100%; padding:7px; font-size:var(--fs-micro);'
      +  ' background:transparent; color:var(--text-secondary); border:1px solid var(--border-color); cursor:pointer;">'
      +  'Ağı Kaldır</button>';
  } else if(hazir){
    h += '<div style="padding:8px 10px; font-size:var(--fs-micro); line-height:1.45; color:var(--text-secondary);'
      +  ' background:var(--bg-secondary); border:1px dashed var(--border-color);">'
      +  'Ağ henüz kurulmadı. Hedef kenar boyu, parçanın sınır kutusu köşegeninin '
      +  VE_STR_MESH_DEFAULT_DIVISOR + '\'ta biri olarak türetildi; değiştirebilirsiniz.</div>';
  }

  h += '</div>';

  // 4) 3B GÖRÜNÜM — yalnız ağ VARKEN. Geometri panelindeki kuralın aynısı:
  // boş bir WebGL bağlamı açmak bedava değil (tarayıcı sınırı ~8-16 bağlam,
  // dolunca EN ESKİSİ düşürülür).
  if(rec && rec.stats){
    h = '<div class="ve-str-mesh-grid">' + h
      + '<div id="ve-str-mesh-wrap" class="ve-str-vwr-box">'
      + '<canvas id="ve-str-mesh-canvas" style="width:100%; height:100%; display:block;"></canvas>'
      + '<div class="ve-str-vwr-bar">'
      +   '<button onclick="veStrViewerView(\'iso\')">İzometrik</button>'
      +   '<button onclick="veStrViewerView(\'front\')">Ön</button>'
      +   '<button onclick="veStrViewerView(\'top\')">Üst</button>'
      +   '<button onclick="veStrViewerView(\'right\')">Sağ</button>'
      +   '<button onclick="veStrViewerReset()">Sıfırla</button>'
      +   '<span style="margin-left:auto; color:var(--text-muted); font-size:var(--fs-micro);">'
      +     'ağın dış yüzeyi · eleman sınırları çizili</span>'
      + '</div></div></div>';
  }
  return h;
}

// Panel DOM'u kurulduktan SONRA çağrılır (cp-core.js kancası). Ağ oturumluk
// önbellekten gelir; önbellek boşsa (proje yeni açıldı) görüntüleyici KURULMAZ
// ve panel bunu YAZAR — ağ türetilmiş veridir, künyesi kalıcı, kendisi değil.
function veStrMeshMountViewer(nodeId){
  var node = _strNodeById(nodeId);
  if(!node || !node.data || !node.data.mesh) return;
  var mesh = (typeof veStrMeshCacheGet === 'function') ? veStrMeshCacheGet(nodeId) : null;
  if(mesh && mesh.ok){
    if(typeof veStrMeshViewerInit === 'function') veStrMeshViewerInit('ve-str-mesh-canvas', mesh, nodeId);
    return;
  }
  _strMeshStatus('Ağ künyesi kayıtlı ama bu oturumda yeniden kurulmadı — '
    + '3B görünüm için "Ağı Yenile".');
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
    veStrPopulateStarter: veStrPopulateStarter,
    VE_STR_STEP_EXT: VE_STR_STEP_EXT,
    VE_STR_MESH_LINEAR: VE_STR_MESH_LINEAR,
    VE_STR_MAT_FIELDS: VE_STR_MAT_FIELDS,
    VE_STR_RHO_SI_TO_MM: VE_STR_RHO_SI_TO_MM,
    veStrMatDensityMM: veStrMatDensityMM,
    veStrMatOf: veStrMatOf,
    veStrMatSet: veStrMatSet,
    veStrMatClear: veStrMatClear,
    veStrMatValidate: veStrMatValidate,
    veStrMatDerived: veStrMatDerived,
    veStrMatHost: veStrMatHost,
    veStrMatBadgeInfo: veStrMatBadgeInfo,
    _strMatShortName: _strMatShortName,
    veStrMatLibQuery: veStrMatLibQuery,
    veStrMatLibSetCat: veStrMatLibSetCat,
    veStrMatLibPick: veStrMatLibPick,
    veStrMatApplyLib: veStrMatApplyLib,
    veStrMatSetTemp: veStrMatSetTemp,
    veStrMatLibScrollToApplied: veStrMatLibScrollToApplied,
    veStrApplyBadge: veStrApplyBadge,
    veStrGeomSelectFace: veStrGeomSelectFace,
    VE_STR_MESH_DEFAULT_DIVISOR: VE_STR_MESH_DEFAULT_DIVISOR,
    veStrMeshHost: veStrMeshHost,
    veStrMeshTargetLen: veStrMeshTargetLen,
    veStrMeshSetTarget: veStrMeshSetTarget,
    veStrMeshBuild: veStrMeshBuild,
    veStrMeshClear: veStrMeshClear,
    veStrMeshMountViewer: veStrMeshMountViewer,
    _strMeshShort: _strMeshShort,
    getStrModulePropertiesHTML: getStrModulePropertiesHTML,
    getStrGeometryPropertiesHTML: getStrGeometryPropertiesHTML,
    getStrMaterialPropertiesHTML: getStrMaterialPropertiesHTML,
    getStrMeshPropertiesHTML: getStrMeshPropertiesHTML,
    getStrBCPropertiesHTML: getStrBCPropertiesHTML,
    getStrResultsPropertiesHTML: getStrResultsPropertiesHTML
  };
}
