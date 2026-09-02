// ============================================================================
//  FEAD — MOTOR ÖN UÇ KAYIŞ-KASNAK SİSTEMİ (Front End Accessory Drive)
// ============================================================================
// MFSim'in ÜÇÜNCÜ ana modülü (Araç Performans ve Takoz Çökme-Titreşim'in
// yanında). Bu dosya modülün SUNUM katmanıdır: alt-sistem düğümü, iç topoloji
// gezinmesi, paneller, kanvas rozeti ve şema çizimi.
//
// ÜÇ KATMAN — hangisinin nerede olduğu önemli:
//   js/fead-core.js   HESAP ÇEKİRDEĞİ. Dışarıdan geldi, 17 Gates raporundan
//                     2095 değerle doğrulanmış, BİREBİR duruyor. Dokunulmaz.
//   js/fead-model.js  KÖPRÜ. Kanvastaki düğüm+bağlantıyı çekirdeğin istediği
//                     sisteme çevirir; temas tarafı / sürücü / çap çözümü,
//                     hata çevirisi. DOM'suz, testlenebilir.
//   js/cp-fead.js     BU DOSYA. Yalnız HTML kurar ve çekirdeği model üzerinden
//                     çağırır. Kendi geometrisini HESAPLAMAZ.
//
// MİMARİ — arac-performans / mount-analysis ile BİREBİR aynı nested kalıp:
// ana canvas'ta tek kart; çift tıkla iç topolojiye girilir; çıkışta iç
// topoloji node.data.subTopology'ye yazılır. Kaydet/sekme-değiştir öncesi
// veSaveActiveTabState → veFeadCollapseToRoot ile köke çöker.
//
// BAĞLANTININ ANLAMI BU MODÜLDE FARKLIDIR — kayış yoludur:
//   • Araç Performans'ta bağlantı GÜÇ AKIŞI, Takoz'da SALT GÖRSEL'di.
//   • FEAD'de bağlantı, serpantin kayışın kasnaktan kasnağa geçiş SIRASIDIR.
//     Sürücünün çıkışından başlar, kasnakları dolaşır, girişine döner →
//     KAPALI ÇEVRİM. Bu yüzden her kasnak 1 giriş + 1 çıkış taşır.
//   • SÜRÜCÜLÜK BİR ROLDÜR, TİP DEĞİL (node.data.driver) — ikincil tahrikte
//     fan kasnağı da sürücü olabilir; bkz. js/fead-model.js.
//   • Sarım açısı ve kayış boyu bu SIRA + konumlar + TEMAS TARAFLARINDAN
//     çekirdek tarafından türetilir; kullanıcı elle girmez.
//
// Birim (UI): konum ve çap mm, atalet kg·m², tork Nm, gerginlik N.
// Kalıcılık: her düğüm kendi node.data'sında (proje kaydet/yükle otomatik).
// ----------------------------------------------------------------------------

// ─── Sunum yardımcıları ──────────────────────────────────────────────────────
// SAF veri/geometri yardımcıları BU DOSYADA DEĞİL: _feadNum, _feadDefOf,
// _feadNodeName, _feadIsPulley, veFeadContactOf, veFeadOD, veFeadRouteOrder,
// veFeadBuildSystem… hepsi js/fead-model.js içinde ve o dosya index.html'de
// BUNDAN ÖNCE yükleniyor. Ayrım kasıtlı: model katmanı DOM'suz ve testlenebilir,
// bu dosya yalnız HTML kuruyor. (Aynı adı iki dosyada bildirmek üst-seviye
// çakışması olurdu; tests/unit/source-hygiene.test.js buna kapı tutuyor.)
function _feadEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _feadFmt(x, dg){ if(!Number.isFinite(x)) return '—'; dg=(dg===undefined)?1:dg; return x.toFixed(dg); }

// ── EMEKLİYE AYRILDI: veFeadBeltPath ────────────────────────────────────────
// Bu dosyada kayış çevresini kendi hesaplayan bir fonksiyon vardı ve YANLIŞTI:
// bütün kasnakları DIŞ TEĞET sayıyordu. Oysa sırttan temas eden kasnak (avara,
// gergi) kayışı TERS yönde sarar. AG00686 üzerinde ölçülen fark:
//   CRK 207.7° (doğru) ↔ 172.2° (o çizim)  → −35.5°
//   A_C 201.3°         ↔ 164.4°            → −36.9°
// Ürettiği çevrim kendi içinde tutarlı olduğu için (Σ = 360) gözle
// YAKALANAMIYORDU. Artık geometri FEADCore.solveGeometry'den geliyor: işaretli
// yarıçap (contact tarafına göre), teğet noktaları, sarım yayları ve sarım
// değişmezi kontrolü. Şemayı çizen kod veFeadLayoutSVG içinde.

// ════════════════════════════════════════════════════════════════════════════
//  ANA MODÜL — ALT-SİSTEM (SUBSYSTEM) DÜĞÜMÜ
// ════════════════════════════════════════════════════════════════════════════
var veFeadStack = [];
var _veFeadBusy = false;

// Modül paneli (tek tık): özet + "Alt Topolojiyi Aç".
function getFeadModulePropertiesHTML(node){
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
  html += '<button onclick="veFeadOpenEditor(\'' + node.id + '\')" style="width:100%; padding:14px 16px; font-size:var(--fs-lg); font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.03em;" onmouseover="this.style.filter=\'brightness(1.15)\'" onmouseout="this.style.filter=\'none\'">▶ Alt Topolojiyi Aç</button>';
  html += '</div>';
  return html;
}

// REFERANS yerleşim (yerel px). İlk açılışta bu yerleşimin TAMAMI kurulmaz —
// diğer iki modülle aynı kalıp: yalnız "Başlangıç ve Örnekler" gelir. Koordinat
// çerçevesi burada durur ki örnek aktarımı görünür alana ortalanabilsin.
var VE_FEAD_STARTER_LAYOUT = [
  // ── Üst şerit: araçlar ──
  { type:'fead-belt',    lx:40,  ly:20 },
  { type:'fead-layout',  lx:190, ly:20 },
  { type:'fead-solver',  lx:340, ly:20 },
  { type:'fead-wizard',  lx:490, ly:20 },
  { type:'fead-example', lx:640, ly:20 },
  { type:'fead-report',  lx:790, ly:20 },
  // ── Kayış düzlemi: krank altta ortada, aksesuarlar çevresinde ──
  { type:'fead-crank',       name:'Krank Kasnağı', lx:250, ly:330 },
  { type:'fead-tensioner',   name:'Gergi',         lx:140, ly:210 },
  { type:'fead-alternator',  name:'Alternatör',    lx:400, ly:170 },
  { type:'fead-ac',          name:'Klima Komp.',   lx:540, ly:270 },
  { type:'fead-waterpump',   name:'Su Pompası',    lx:410, ly:380 },
  { type:'fead-idler',       name:'Avara Kasnak',  lx:290, ly:200 }
];

// ── "OTOMATİK DÜZENLE" FEAD'DE HALKA KURAR ─────────────────────────────────
// Genel yerleştirici (tidy-layout.js) katmanlı bir DAG düzeni kuruyor: kenarları
// soldan sağa sıralı katmanlara böler. FEAD ise bir ÇEVRİM — serpantin kayış
// son kasnaktan krank girişine dönüyor. Katmanlama o çevrimi keyfî bir yerden
// kırıyor ve dönüş telini bütün kümenin üstünden geçiriyor.
//
// ÖLÇÜLDÜ (gerçek tarayıcı, BMC örneği, 6 kasnak): örnek kurulduğunda kesişen
// tel çifti 0; "Otomatik Düzenle" sonrası altı kasnak tek bir YATAY sıraya
// diziliyor ve Sürücü Kasnak → Avara 1 dönüş teli hepsinin üstünden geri
// geçerek 1 kesişim üretiyor — kullanıcının gördüğü "sağlıklı bir bağlantı
// kurulamıyor" tablosu.
//
// Halka düzeninde kesişim YAPISAL OLARAK sıfırdır: kasnaklar kayış sırasında
// çember üzerine dizilince her tel yalnız KOMŞUSUNA gidiyor. Kutular, semboller
// ve ölçüler değişmiyor — yalnız konum. mm koordinatı KULLANILMIYOR: o, kanvastaki
// Kayış Yolu kartının işi (bkz. CLAUDE.md "graf GİRDİ, kart ÇIKTI").
// ── "OTOMATİK DÜZENLE" — KOORDİNATLARA GÖRE YERLEŞTİR ─────────────────────
//
// Bu fonksiyon eskiden kasnakları bir HALKAYA diziyordu ve o zaman doğruydu:
// kanvastaki konum hiçbir şey ifade etmiyordu, dolayısıyla tel kesişimini
// sıfırlayan bir düzen en iyisiydi.
//
// Artık konum FİZİKSEL. Halkaya dizmek, kullanıcının girdiği bütün mm
// koordinatlarını SİLMEK demek olurdu — düğme "düzenle" derken modeli bozardı.
// Yeni anlamı: kanvas konumlarını mm'den YENİDEN KUR. Elle kaydırılmış bir
// düğümü (ya da bir çakışmayı) toparlamak için gerçek bir ihtiyaç, ve tersine
// çevrilebilir: koordinatlar değişmiyor, yalnız kutular yerine oturuyor.
//
// opts.silent: örnek kurucusu (veFeadLoadExample) buradan geçerken kendi
// saveState'ini, kendi toast'ını ve kendi kamerasını kullanır; ikinci bir
// undo adımı ve üst üste binen iki bildirim istenmiyor.
function veFeadArrangeByCoords(opts){
  opts = opts || {};
  if(typeof nodes === 'undefined' || !nodes) return false;
  var kasnaklar = nodes.filter(function(n){ return _feadIsPulley(n); });
  if(kasnaklar.length < 2) return false;
  var org = (typeof veFeadOriginNode === 'function') ? veFeadOriginNode(nodes) : null;
  if(!org) return false;

  var s = (typeof VE_FEAD_PX_PER_MM === 'number') ? VE_FEAD_PX_PER_MM : 1;
  var CX = 3000, CY = 3000;

  // Koordinatı olan kasnakların mm sınır kutusu — küme görünür alanda
  // ORTALANSIN diye. Orijini doğrudan (CX,CY)'ye koymak, krank kümenin
  // kenarındaysa (BMC'de öyle: X −281…+184) her şeyi bir yana yığardı.
  var mm = [], eksik = [];
  kasnaklar.forEach(function(n){
    var d = n.data || {};
    var x = _feadNum(d.x, NaN), y = _feadNum(d.y, NaN);
    // GERGİ KUTUSU KİP BAŞINA BAŞKA BİR NOKTAYI GÖSTERİR — ve okuyucusu
    // veFeadSyncCanvasFromMm ile AYNI (veFeadTensionerBoxMm). Burada doğrudan
    // cenX/cenY okunuyordu; zarf kipinde o alan HİÇ yazılmadığı için gergi
    // "koordinatı yok" sayılıp kümenin altına diziliyordu (ölçüldü: AG00976'da
    // kutu 2857,4/3039,0 yerine 2971,0/3277,3 + "1 kasnağın koordinatı yok"),
    // oysa alt topoloji açılışı onu pivota oturtuyordu: iki yol ayrışmıştı.
    if(_feadDefOf(n).isFeadTensioner){
      var kutuMm = (typeof veFeadTensionerBoxMm === 'function')
        ? veFeadTensionerBoxMm(d) : null;
      x = kutuMm ? kutuMm[0] : NaN; y = kutuMm ? kutuMm[1] : NaN;
    }
    if(Number.isFinite(x) && Number.isFinite(y)) mm.push({ n: n, x: x, y: y });
    else eksik.push(n);
  });
  if(mm.length < 2) return false;
  var minX = Math.min.apply(null, mm.map(function(o){ return o.x; }));
  var maxX = Math.max.apply(null, mm.map(function(o){ return o.x; }));
  var minY = Math.min.apply(null, mm.map(function(o){ return o.y; }));
  var maxY = Math.max.apply(null, mm.map(function(o){ return o.y; }));
  var ortX = (minX + maxX) / 2, ortY = (minY + maxY) / 2;

  var yer = {};
  mm.forEach(function(o){
    var b = veFeadNodeBox(o.n);
    yer[o.n.id] = { x: CX + (o.x - ortX) * s - b.w / 2,
                    y: CY - (o.y - ortY) * s - b.h / 2 };   // Y TERS
  });

  // KOORDİNATI OLMAYAN KASNAK GİZLENMİYOR: kümenin altına bir sıraya diziliyor
  // ki kullanıcı onu görüp koordinatını girsin. Sessizce (0,0)'a koymak, iki
  // kasnağı üst üste bindirip "kasnaklar çakışıyor" hatası üretirdi.
  var altY = CY + (maxY - ortY) * s + 120;
  eksik.forEach(function(n, i){
    var b = veFeadNodeBox(n);
    yer[n.id] = { x: CX - ((eksik.length - 1) * 100) / 2 + i * 100 - b.w / 2, y: altY };
  });

  // Araç düğümleri kümenin DIŞINDA. Kayış Yolu kartı (440×500) sağ şeritte,
  // künyeler sol şeritte — veFeadLoadExample ile aynı bölüşüm, yoksa kart
  // kümenin içine düşüp tellerin altında kalırdı.
  var yariX = (maxX - minX) * s / 2, yariY = (maxY - minY) * s / 2;
  var sol = [], sag = [];
  nodes.forEach(function(n){
    if(yer[n.id]) return;
    if(_feadDefOf(n).isFeadLayout) sag.push(n); else sol.push(n);
  });
  function serit(list, x0, hiza){
    var toplam = 0;
    list.forEach(function(n){ toplam += veFeadNodeBox(n).h + 24; });
    var y = CY - toplam / 2;
    list.forEach(function(n){
      var b = veFeadNodeBox(n);
      yer[n.id] = { x: (hiza === 'sag') ? x0 : (x0 - b.w), y: y };
      y += b.h + 24;
    });
  }
  serit(sol, CX - yariX - 150, 'sol');
  serit(sag, CX + yariX + 150, 'sag');

  if(!opts.silent && typeof saveState === 'function') saveState();
  nodes.forEach(function(n){
    var p = yer[n.id];
    if(!p) return;
    // TAM SAYIYA YUVARLANMIYOR: 1 px = 1 mm olduğu için tam sayı yuvarlaması
    // koordinatı 1 mm'ye kuantalar (veFeadSyncCanvasFromMm'deki ölçümün
    // aynısı — alternatörün 1 mm'si gerginliği %5.9 değiştiriyor).
    n.x = Math.round(p.x * 100) / 100; n.y = Math.round(p.y * 100) / 100;
    var el = (typeof document !== 'undefined') ? document.getElementById(n.id) : null;
    if(el){ el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
  });
  if(typeof updateAllConnections === 'function') updateAllConnections();
  if(typeof veFeadRefreshBadges === 'function') { try { veFeadRefreshBadges(); } catch(e){} }

  var canvas = (typeof document !== 'undefined') ? document.getElementById('ve-canvas') : null;
  if(!opts.silent && canvas && typeof veFitViewToContent === 'function'){
    canvas.classList.add('tidy-cam');
    veFitViewToContent({ maxZoom: opts.maxZoom || 1.2 });
    setTimeout(function(){ if(canvas) canvas.classList.remove('tidy-cam'); }, 520);
  }
  if(!opts.silent && typeof showToast === 'function')
    showToast('Kasnaklar koordinatlarına yerleştirildi (1 px = 1 mm)'
      + (eksik.length ? ' · ' + eksik.length + ' kasnağın koordinatı yok' : ''),
      eksik.length ? 'warning' : 'success');
  return true;
}

// İlk açılışta iç topolojiye İKİ açılış yüzeyi gelir: "Başlangıç Sihirbazı"
// (sıfırdan kurulum — bütün girdileri adım adım sorar) ve "Başlangıç ve
// Örnekler" (hazır bir düzeni tek tıkla kurar). Kullanıcı ya birinden başlar
// ya da sidebar'dan kendi kayış düzenini elle kurar.
//
// İKİSİ BİRDEN, çünkü ikisi FARKLI soruya cevap: sihirbaz "kendi motorumun
// verisini nasıl gireceğim", örnek ise "çalışan bir model neye benziyor"
// diyene. Sihirbazın içinden de örnekle doldurulabiliyor (veFeadWizSeed), ama
// oradaki yol formu doldurur — kanvasa kurmaz.
function veFeadPopulateStarter(){
  if(typeof createNode !== 'function') return [];
  var base = (typeof veArrangeModuleBase === 'function')
    ? veArrangeModuleBase(VE_FEAD_STARTER_LAYOUT.map(function(it){ return { lx:it.lx, ly:it.ly }; }))
    : { x:3000, y:3000 };
  var created = [];
  ['fead-wizard', 'fead-example'].forEach(function(tip, k){
    var slot = null;
    for(var i=0;i<VE_FEAD_STARTER_LAYOUT.length;i++){
      if(VE_FEAD_STARTER_LAYOUT[i].type === tip){ slot = VE_FEAD_STARTER_LAYOUT[i]; break; }
    }
    if(!slot) slot = { lx: 490 + k * 150, ly: 20 };
    var before = (typeof nodes !== 'undefined') ? nodes.length : 0;
    createNode(tip, base.x + slot.lx, base.y + slot.ly);
    if(typeof nodes !== 'undefined' && nodes.length > before) created.push(nodes[nodes.length-1]);
  });
  if(typeof updateAllConnections === 'function') updateAllConnections();
  return created;
}

// _silent: autosave gibi arka-plan işlemleri köke çöküp (veSaveActiveTabState)
// kullanıcıyı bulunduğu iç topolojiye geri getirirken true geçer; bu görünmez
// geri-girişte toast/animasyon tetiklenmez (breadcrumb ve sidebar yine güncellenir).
function veFeadOpenEditor(nodeId, _silent){
  if(_veFeadBusy) return;
  if(typeof nodes === 'undefined' || typeof veSerializeCurrentState !== 'function') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || node.type !== 'fead-analysis') return;

  _veFeadBusy = true;
  try {
    if(typeof veFlushOpenPanelData === 'function') veFlushOpenPanelData();
    if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(false);

    var parentState = veSerializeCurrentState();
    veFeadStack.push({ nodeId: nodeId, parentState: parentState });
    veClearCanvasDOM();

    var sub = node.data && node.data.subTopology;
    if(sub && sub.nodes && sub.nodes.length){
      veLoadTabState({ state: sub });
    } else {
      veLoadTabState({ state: null });
      veFeadPopulateStarter();
    }
  } finally { _veFeadBusy = false; }

  // Eski kayıt göçü (data.dia → data.od) ve temas/sürücü rozetleri, alt
  // topoloji YÜKLENDİKTEN sonra: düğümler artık canlı ve DOM'da.
  if(typeof veFeadMigrateAll === 'function' && typeof nodes !== 'undefined') veFeadMigrateAll(nodes);
  // ORİJİN GÖÇÜ + KUTULARI KOORDİNATA OTURTMA. Konum artık fiziksel; eski
  // projelerde krank (0,0)'da olmayabilir ve kutular keyfî yerlerde durur.
  // Göç TANIM GEREĞİ bir öteleme (geometriye etkisi ölçüldü: 0.00e+0), yani
  // sessizce yapılabilir. Yerleştirme de kutuyu koordinatının söylediği yere
  // koyuyor — yoksa kanvas ile mm ilk açılıştan itibaren ayrışırdı.
  if(typeof veFeadNormalizeOrigin === 'function' && typeof nodes !== 'undefined'){
    try {
      veFeadNormalizeOrigin(nodes);
      veFeadPlaceFromCoords();
    } catch(e){ /* yarım model açılışı engellemez */ }
  }
  veFeadRefreshBadges();

  if(!_silent && typeof veFitViewToContent === 'function') veFitViewToContent();
  if(!_silent && typeof veAnimateCanvasTransition === 'function') veAnimateCanvasTransition('enter');
  veFeadUpdateBreadcrumb();
  if(typeof veSyncSidebarScope === 'function') veSyncSidebarScope();
  if(typeof veUpdateWarnings === 'function') veUpdateWarnings();
  if(!_silent && typeof showToast === 'function') showToast('FEAD — İç Topoloji', 'info');
}

// _silent: köke çökerken (veFeadCollapseToRoot → kaydet/sekme değiştir öncesi)
// true gelir; kullanıcıya görünmeyen bu toplu çıkışta animasyon tetiklenmez.
function veFeadCloseEditor(_silent){
  if(_veFeadBusy) return;
  if(!veFeadStack.length) return;

  _veFeadBusy = true;
  try {
    if(typeof veFlushOpenPanelData === 'function') veFlushOpenPanelData();
    var subState = veSerializeCurrentState();
    // Gömmeden ÖNCE hafiflet (bkz. topology.js veSanitizeEmbeddedState).
    if(typeof veSanitizeEmbeddedState === 'function') subState = veSanitizeEmbeddedState(subState);
    var ctx = veFeadStack.pop();
    var pn = (ctx.parentState.nodes || []).find(function(n){ return n.id === ctx.nodeId; });
    if(pn){ if(!pn.data) pn.data = {}; pn.data.subTopology = subState; }
    veClearCanvasDOM();
    veLoadTabState({ state: ctx.parentState });
  } finally { _veFeadBusy = false; }

  if(!_silent && typeof veAnimateCanvasTransition === 'function') veAnimateCanvasTransition('exit');
  veFeadUpdateBreadcrumb();
  if(typeof veSyncSidebarScope === 'function') veSyncSidebarScope();
  if(typeof veUpdateWarnings === 'function') veUpdateWarnings();
  if(!_silent && typeof showToast === 'function') showToast('Ana topolojiye dönüldü', 'info');
}

function veFeadCollapseToRoot(){
  var guard = 0;
  while(veFeadStack.length && guard++ < 32){ veFeadCloseEditor(true); }
}

// Alt-topoloji çıkış çipi — topoloji sınır çerçevesinin alt kenarına tutunur
// (cp-arac-performans.js veAracUpdateBreadcrumb ile aynı CSS sınıfı ve mantık).
function veFeadUpdateBreadcrumb(){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-fead-breadcrumb');
  if(veFeadStack.length === 0){ if(el) el.remove(); return; }
  if(!el){
    el = document.createElement('div');
    el.id = 've-fead-breadcrumb';
    el.className = 've-arac-breadcrumb';
    var host = document.getElementById('ve-canvas-wrapper')
            || document.getElementById('ve-split-container')
            || document.querySelector('.ve-canvas-area')
            || document.body;
    host.appendChild(el);
  }
  var depth = veFeadStack.length;
  el.innerHTML = '<button onclick="veFeadCloseEditor()" title="Ana (üst) topolojiye dön">← Ana topolojiye dön</button>'
    + '<span class="ve-arac-breadcrumb-label">FEAD · İç Topoloji'
    + (depth > 1 ? ' <b>(derinlik ' + depth + ')</b>' : '') + '</span>';
  if(typeof veAnchorBoundaryChip === 'function') veAnchorBoundaryChip();
}

// ════════════════════════════════════════════════════════════════════════════
//  PANEL YARDIMCILARI (Takoz modülüyle aynı görsel dil)
// ════════════════════════════════════════════════════════════════════════════
var _FEAD_INP = 'padding:4px 6px; font-size:var(--fs-body); height:25px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right; box-sizing:border-box;';

function _feadCard(title, unit, accent, inner){
  var head = title ? '<div style="display:flex; align-items:center; gap:7px; margin-bottom:9px;">'
    + '<span style="width:3px; height:12px; border-radius:2px; background:' + (accent||'var(--accent-primary)') + ';"></span>'
    + '<span style="font-size:var(--fs-tiny); font-weight:700; color:var(--text-heading); letter-spacing:0.02em;">' + title + '</span>'
    + (unit ? '<span style="font-size:var(--fs-micro); font-weight:400; color:var(--text-muted);">' + unit + '</span>' : '')
    + '</div>' : '';
  return '<div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:11px 12px 6px; margin-bottom:9px;">' + head + inner + '</div>';
}

// Sayısal hücre ızgarası (cells=[{key,label,ph,step}]).
function _feadGrid(node, cells, cols){
  cols = cols || 3;
  var h = '<div style="display:grid; grid-template-columns:repeat(' + cols + ',1fr); gap:7px 6px; margin-bottom:9px;">';
  cells.forEach(function(c){
    var v = (node.data && node.data[c.key] !== undefined && node.data[c.key] !== null) ? node.data[c.key] : '';
    h += '<label style="display:flex; flex-direction:column; gap:2px; min-width:0;">'
      + '<span style="font-size:var(--fs-micro); color:var(--text-muted); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + c.label + '</span>'
      + '<input type="number" id="ve-fead-' + c.key + '-' + node.id + '" value="' + _feadEsc(v) + '" step="' + (c.step||'any') + '"'
      + (c.ph ? ' placeholder="' + _feadEsc(c.ph) + '"' : '')
      + ' onchange="' + (c.setter || 'veFeadSet') + '(\'' + node.id + '\',\'' + c.key
        + '\',this.value)" style="width:100%; ' + _FEAD_INP + '">'
      + '</label>';
  });
  return h + '</div>';
}

// Tek metin alanı (etiket sol, giriş sağ).
function _feadText(node, title, key, ph){
  var v = (node.data && node.data[key] != null) ? node.data[key] : '';
  return '<div style="display:flex; align-items:center; gap:10px; margin-bottom:9px;">'
    + '<div style="flex:1; font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">' + title + '</div>'
    + '<input type="text" id="ve-fead-' + key + '-' + node.id + '" value="' + _feadEsc(v) + '" placeholder="' + _feadEsc(ph||'') + '"'
    + ' onchange="veFeadSet(\'' + node.id + '\',\'' + key + '\',this.value)" style="width:130px; ' + _FEAD_INP + ' text-align:left;">'
    + '</div>';
}

function _feadHint(text){
  return '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.4; margin:-3px 0 9px;">' + text + '</div>';
}

// "Bu bölüm SPEC ile gelecek" notu — kullanıcıya iskeletin nerede bittiğini
// SÖYLER. Sessizce boş bırakılan bir panel, çalışmayan bir panelden kötüdür.
function _feadPending(text){
  return '<div style="padding:8px 10px; margin-bottom:9px; font-size:var(--fs-micro); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px dashed var(--accent-warning);">'
    + '<b style="color:var(--text-heading);">Hesap çekirdeği bekleniyor.</b> ' + text + '</div>';
}

// Açılır liste (seçenekler: [[değer, etiket], …]).
function _feadSelect(node, title, key, options, def, hint){
  var cur = (node.data && node.data[key] != null && node.data[key] !== '') ? String(node.data[key]) : String(def);
  var h = '<div style="display:flex; align-items:center; gap:10px; margin-bottom:9px;">'
    + '<div style="flex:1; font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">' + title + '</div>'
    + '<select id="ve-fead-' + key + '-' + node.id + '" onchange="veFeadSetChoice(\'' + node.id + '\',\'' + key + '\',this.value)"'
    + ' style="width:150px; ' + _FEAD_INP + ' text-align:left;">';
  options.forEach(function(o){
    h += '<option value="' + _feadEsc(o[0]) + '"' + (String(o[0]) === cur ? ' selected' : '') + '>' + _feadEsc(o[1]) + '</option>';
  });
  h += '</select></div>';
  return h + (hint ? _feadHint(hint) : '');
}

// Onay kutusu (bayrak).
function _feadToggle(node, title, key, handler, hint){
  var on = !!(node.data && node.data[key]);
  return '<label style="display:flex; align-items:center; gap:8px; margin-bottom:9px; cursor:pointer;">'
    + '<input type="checkbox"' + (on ? ' checked' : '')
    + ' onchange="' + handler + '(\'' + node.id + '\',this.checked)" style="width:15px; height:15px; accent-color:var(--accent-primary); cursor:pointer;">'
    + '<span style="font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">' + title + '</span>'
    + '</label>' + (hint ? _feadHint(hint) : '');
}

// KOORDİNAT ALANLARI KUTUYU DA TAŞIR. Panel ile kanvas artık AYNI ŞEYİ
// gösteriyor; panele 250 yazıp kutunun yerinde kalması, iki yüzeyin sessizce
// ayrışması olurdu (bu modülün tekrar eden kuralı: tek alan, tek kaynak).
var VE_FEAD_COORD_KEYS = ['x', 'y', 'cenX', 'cenY', 'od'];

function veFeadSet(nodeId, key, val){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  node.data[key] = val;
  if(VE_FEAD_COORD_KEYS.indexOf(key) >= 0 && _feadIsPulley(node)) veFeadPlaceFromCoords();
  if(typeof saveState === 'function') saveState();
}

// Kutuları mm koordinatlarına oturt ve DOM'a yaz. İki OTOMATİK çağıran var:
// alt topoloji açılışı ve panelde bir koordinat alanının düzenlenmesi.
//
// KONUM BAĞI KAPALIYKEN BU YOL DA KAPALI — ve bu, bağın tek yönlü
// kapatılamayacağının sonucu. Yalnız kanvas→mm yönü kesilseydi özellik
// ÇALIŞMAZDI: kullanıcının serbestçe dizdiği kutular alt topolojiden her
// çıkıp girişte (satır ~286) koordinatlarına geri çekilir, panele tek bir
// sayı yazmak da (veFeadSet) o kutuyu tek başına yerine oturtup dizilişi
// bozardı. Kapalı bağın tanımı "kutu ile koordinat BAĞIMSIZ"; bağımsızlık
// simetriktir.
//
// "Otomatik Düzenle" (veFeadArrangeByCoords) bu kapının DIŞINDA ve kendi
// yerleştirmesini yapıyor: o AÇIK bir kullanıcı eylemi ("kutuları
// koordinatına geri koy") ve bağ kapalıyken tek yönlü uzlaştırma yolu odur.
function veFeadPlaceFromCoords(){
  if(typeof nodes === 'undefined' || !nodes) return 0;
  if(typeof veFeadSyncCanvasFromMm !== 'function') return 0;
  if(typeof veFeadCoordLinkOn === 'function' && !veFeadCoordLinkOn(nodes)) return 0;
  var k = veFeadSyncCanvasFromMm(nodes);
  if(!k) return 0;
  if(typeof document !== 'undefined'){
    nodes.forEach(function(n){
      var el = document.getElementById(n.id);
      if(el){ el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
    });
  }
  if(typeof updateAllConnections === 'function') updateAllConnections();
  return k;
}

// ── KAYIŞ BAĞLANTISININ UCU: KOMŞUYA BAKAN KENAR ────────────────────────────
// Bir kasnağın portu klasik kuralla yerleşiyordu: giriş SOLDA, çıkış SAĞDA.
// Serpantin kayış bir ÇEVRİM olduğu için bu kural yolun yarısında ters düşüyor
// — kayış sağdan sola dönerken tel düğümün ÜSTÜNDEN geri geçmek zorunda
// kalıyor, iki tel birbirini kesiyor ve hangi sırayla gidildiği okunmuyor.
//
// Çözüm düğümü ya da yerleşimi DEĞİŞTİRMİYOR: yalnız telin çıktığı kenarı
// seçiyor. Kenar, komşunun yönünden okunur; seçim kutunun ORANINA göre
// yapılır (|dx|·h ≥ |dy|·w) — sabit 45° köşegeni kullanmak geniş kutularda
// yanlış kenarı seçerdi (72×66'lık krank ile 54×50'lik avarada fark ediyor).
//
// Bu bir VARSAYILAN (defaultPortSide): kullanıcı bir portu sağ tıkla taşıdıysa
// (node.data.portPositions) onun seçimi kazanmaya devam eder.
function veFeadPortSideFor(node, portType){
  if(typeof _feadIsPulley !== 'function' || !_feadIsPulley(node)) return null;
  if(typeof nodes === 'undefined' || typeof connections === 'undefined') return null;
  if(!node.id) return null;
  var isIn = String(portType || '').indexOf('input') === 0, komsuId = null;
  for(var i = 0; i < connections.length; i++){
    var c = connections[i];
    if(!c) continue;
    if(isIn  && c.to === node.id   && (c.toPort   || 'input')  === portType){ komsuId = c.from; break; }
    if(!isIn && c.from === node.id && (c.fromPort || 'output') === portType){ komsuId = c.to;   break; }
  }
  if(!komsuId) return null;
  var o = null;
  for(var j = 0; j < nodes.length; j++) if(nodes[j] && nodes[j].id === komsuId){ o = nodes[j]; break; }
  if(!o || !_feadIsPulley(o)) return null;
  var w = node.width || 65, h = node.height || 60;
  var dx = (o.x + (o.width || 65) / 2) - (node.x + w / 2);
  var dy = (o.y + (o.height || 60) / 2) - (node.y + h / 2);
  if(!isFinite(dx) || !isFinite(dy) || (dx === 0 && dy === 0)) return null;
  if(Math.abs(dx) * h >= Math.abs(dy) * w) return (dx >= 0) ? 'right' : 'left';
  return (dy >= 0) ? 'bottom' : 'top';
}

// SÜRÜKLEME → mm. ui-core.js'in sürükleme döngüsünden her karede çağrılıyor.
// Tek geçiş: gergi dahil bütün kasnakların krank-göreli mm'si tazeleniyor
// (bkz. veFeadSyncMmFromCanvas). Kasnak yoksa bedava.
//
// KONUM BAĞI KAPISI BURADA, `veFeadSyncMmFromCanvas`'ın İÇİNDE DEĞİL. O
// fonksiyon SAF bir dönüşüm ("kutuların yerini koordinata yaz") ve öyle
// kalmalı: kapı oraya konsaydı, bağdan bağımsız olarak koordinat yazması
// gereken bir çağıran (göç, örnek kurucu, ileride bir toplu işlem) sessizce
// engellenirdi. Kapı, bağın ANLAMLI olduğu tek yerde: kullanıcı kutuyu
// sürüklerken.
function veFeadSyncDrag(){
  if(typeof nodes === 'undefined' || !nodes) return 0;
  if(typeof veFeadSyncMmFromCanvas !== 'function') return 0;
  if(typeof veFeadCoordLinkOn === 'function' && !veFeadCoordLinkOn(nodes)) return 0;
  var org = veFeadOriginNode(nodes);
  if(!org) return 0;
  return veFeadSyncMmFromCanvas(nodes, { origin: org });
}

// ── KANVAS ROZETİ: temas tarafı + sürücü ────────────────────────────────────
// Temas tarafı hesabın en tehlikeli girdisi: ters verilirse çekirdek GEÇERLİ
// ama BAŞKA bir kayış yolu çözer, hata vermez. Panelde bir açılır listede
// gizlenirse kullanıcı yanlışı fark edemez. Bu yüzden değer kanvasta, düğümün
// üstünde durur — "K" kaburgalı, "S" sırttan; sürücü kasnak ayrıca "►" taşır.
// Stil ELEMANIN ÜSTÜNDE (css/ dosyasında değil) çünkü css/styles.css'e
// dokunmak Ölçüm Görüntüleyici'nin dağıtım dosyasını bayatlatıyor (bkz.
// CLAUDE.md); tek rozet için o zinciri kurmaya değmez.
function veFeadApplyBadge(nodeEl, node){
  if(!nodeEl || !node || typeof document === 'undefined') return false;
  var old = nodeEl.querySelector('.ve-fead-badge');
  if(old) old.remove();
  if(_feadDefOf(node).isFeadBelt) return veFeadApplyBeltModeBadge(nodeEl, node);
  if(_feadDefOf(node).isFeadCoordLink) return veFeadApplyCoordLinkBadge(nodeEl, node);
  if(_feadDefOf(node).isFeadSpin) return veFeadApplySpinBadge(nodeEl, node);
  if(!_feadIsPulley(node)) return false;
  var back = veFeadContactOf(node) === 'back';
  var drv = !!(node.data && node.data.driver);
  var b = document.createElement('span');
  b.className = 've-fead-badge';
  b.textContent = (drv ? '► ' : '') + (back ? 'S' : 'K');
  b.title = 'Temas: ' + veFeadContactLabel(back ? 'back' : 'grooved')
          + (drv ? ' · Sürücü kasnak' : '');
  b.style.cssText = 'position:absolute; top:-9px; right:-6px; z-index:3; pointer-events:none;'
    // Ölçek jetonu — ham px değil (bkz. tests/unit/typography-scale.test.js).
    // --fs-micro zaten "rozet, mikro etiket" için tanımlı.
    + 'font-size:var(--fs-micro); font-weight:700; line-height:1; letter-spacing:0.02em;'
    + 'padding:2px 4px; border-radius:3px; font-family:ui-monospace, monospace;'
    + 'color:#fff; background:' + (back ? 'var(--text-secondary, #666)' : 'var(--accent-primary, #3b82f6)')
    + '; border:1px solid var(--bg-primary, #111);';
  var box = nodeEl.querySelector('.ve-node-box') || nodeEl;
  box.appendChild(b);
  return true;
}

// KAYIŞ BOYU KİPİ ROZETİ — kanvasta, TIKLANABİLİR.
//
// Kip `node.data.lengthMode` alanında ve panel ile kanvas AYNI alanı okuyor
// (Kayış Yolu kartındaki kol konumu seçicisinin kuralının aynısı: iki ayrı
// ayar tutulsa panel bir kipi, kanvastaki rozet başkasını gösterirdi).
//
// Rozet SEÇİM YÜZEYİ, salt gösterge değil: kullanıcı "topoloji üzerinden çok
// basit bir şekilde" seçebilmeli. 60×54'lük kayış kutusuna açılır liste
// sığmıyor, iki durumlu bir anahtar sığıyor.
//
// Renk kipin ANLAMINI taşıyor: SABİT bir GİRDİ (mavi — panelde girilen her
// şeyin rengi), SERBEST bir ÇIKTI (amber — kayışın kendi rengi, ve bu modülde
// "hesaplanmış" demek).
function veFeadApplyBeltModeBadge(nodeEl, node){
  // Gergi zarf kipindeyse kip KİLİTLİ: kayış boyu yapısal olarak bir çıktı.
  // Rozet bunu göstermek ve TIKLAMAYI REDDETMEK zorunda — tıklanabilir kalsaydı
  // kullanıcı "SABİT"e çevirir, rozet öyle görünür, çözücü yine serbest koşardı.
  var kilit = (typeof veFeadBeltModeLocked === 'function') && veFeadBeltModeLocked();
  var serbest = kilit || ((typeof veFeadBeltMode === 'function')
    ? (veFeadBeltMode(node.data) === 'free') : false);
  var b = document.createElement('span');
  b.className = 've-fead-badge';
  b.textContent = serbest ? 'SERBEST' : 'SABİT';
  b.title = kilit
    ? 'Kayış boyu SERBEST ve KİLİTLİ: kasnak merkezleri ve gergi künyesi '
      + 'verildiğinde kol nominal yay yüküne oturuyor ve boy o çözümün sonucu. '
      + 'Girdi olarak seçilemez.'
    : serbest
    ? 'Kayış boyu SERBEST: tasarımdan hesaplanıyor (gergi nominal açısında). '
      + 'Tıkla → sabit boya geç.'
    : 'Kayış boyu SABİT: girilen boy kullanılıyor. Tıkla → tasarımdan hesaplansın.';
  b.style.cssText = 'position:absolute; top:-9px; right:-6px; z-index:3; cursor:pointer;'
    + 'font-size:var(--fs-micro); font-weight:700; line-height:1; letter-spacing:0.02em;'
    + 'padding:2px 4px; border-radius:3px; font-family:ui-monospace, monospace;'
    + 'color:#fff; background:' + (serbest ? 'var(--accent-warning, #f59e0b)'
                                           : 'var(--accent-primary, #3b82f6)')
    + '; border:1px solid var(--bg-primary, #111);'
    + (kilit ? 'cursor:default; opacity:0.85;' : '');
  // Rozete basmak düğümü SÜRÜKLEMEYE başlatmamalı: veAttachNodeDrag mousedown'ı
  // yakalıyor ve sürükleme başlarsa tık hiç gelmiyor.
  b.onmousedown = function(e){ e.stopPropagation(); };
  b.ondblclick  = function(e){ e.stopPropagation(); e.preventDefault(); };
  b.onclick = function(e){
    e.stopPropagation(); e.preventDefault();
    if(kilit) return;
    veFeadToggleBeltMode(node.id);
  };
  var box = nodeEl.querySelector('.ve-node-box') || nodeEl;
  box.appendChild(b);
  return true;
}

// Kipi çevir. saveState mutasyondan SONRA çağrılıyor (rozet bir kullanıcı
// kararı, geri alınabilmeli) ve rozet ile Kayış Yolu kartı birlikte tazeleniyor
// — kart kipe göre başka bir boy gösteriyor.
function veFeadToggleBeltMode(nodeId){
  if(typeof nodes === 'undefined') return null;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || !_feadDefOf(node).isFeadBelt) return null;
  if((typeof veFeadBeltModeLocked === 'function') && veFeadBeltModeLocked()) return null;
  if(!node.data) node.data = {};
  var yeni = (typeof veFeadBeltMode === 'function' && veFeadBeltMode(node.data) === 'free')
    ? 'fixed' : 'free';
  node.data.lengthMode = yeni;
  if(typeof saveState === 'function') saveState();
  veFeadRefreshBadges();
  if(typeof veFeadRefreshLayoutCards === 'function') veFeadRefreshLayoutCards();
  // Panel açıksa o da tazelensin: serbest kipte "Efektif boy" alanı GİRDİ
  // olmaktan çıkıp türetilmiş bir okumaya dönüşüyor.
  if(typeof showNodeProperties === 'function'
     && typeof selectedNode !== 'undefined' && selectedNode && selectedNode.id === nodeId)
    showNodeProperties(node);
  return yeni;
}

// ── KONUM BAĞI ROZETİ ───────────────────────────────────────────────────────
//
// Rozet salt gösterge DEĞİL, SEÇİM YÜZEYİ — kayış kipi rozetinin kuralının
// aynısı. Kullanıcı isteği zaten bunu söylüyordu: *"ufak, böyle açılıp
// kapanabilen bir bileşen"*.
//
// RENK ANLAM TAŞIR ve bu modülün kendi renk dilinden geliyor (mavi = GİRDİ,
// amber = HESAPLANMIŞ; bkz. kayış kipi rozeti):
//   AÇIK   amber → mm koordinatı kanvastan TÜREYEN bir değer
//   KAPALI mavi  → mm koordinatı salt panelden gelen bir GİRDİ
// Kapalı hâli soluk grı basmak da düşünüldü ve BIRAKILDI: bu modülün en pahalı
// sessiz hatası kullanıcının bağın kapalı olduğunu FARK ETMEMESİ olurdu; soluk
// bir rozet tam olarak onu davet ederdi.
function veFeadApplyCoordLinkBadge(nodeEl, node){
  var acik = (typeof veFeadCoordLinkOn === 'function' && typeof nodes !== 'undefined')
    ? veFeadCoordLinkOn(nodes)
    : !(node && node.data && node.data.linked === false);
  var b = document.createElement('span');
  b.className = 've-fead-badge';
  b.textContent = acik ? 'AÇIK' : 'KAPALI';
  b.title = acik
    ? 'Konum bağı AÇIK: kasnağı kanvasta taşımak mm koordinatını da değiştirir '
      + '(1 px = 1 mm). Tıkla → bağı kapat, kutular serbest kalsın.'
    : 'Konum bağı KAPALI: kutu salt görsel, koordinat salt panel girdisi. '
      + 'Tıkla → bağı aç; kutular koordinatlarına geri oturur.';
  b.style.cssText = 'position:absolute; top:-9px; right:-6px; z-index:3; cursor:pointer;'
    + 'font-size:var(--fs-micro); font-weight:700; line-height:1; letter-spacing:0.02em;'
    + 'padding:2px 4px; border-radius:3px; font-family:ui-monospace, monospace;'
    + 'color:#fff; background:' + (acik ? 'var(--accent-warning, #f59e0b)'
                                        : 'var(--accent-primary, #3b82f6)')
    + '; border:1px solid var(--bg-primary, #111);';
  // Rozete basmak düğümü SÜRÜKLEMEYE başlatmamalı (veAttachNodeDrag mousedown'ı
  // yakalıyor; durdurulmazsa tık hiç gelmiyor).
  b.onmousedown = function(e){ e.stopPropagation(); };
  b.ondblclick  = function(e){ e.stopPropagation(); e.preventDefault(); };
  b.onclick = function(e){
    e.stopPropagation(); e.preventDefault();
    veFeadToggleCoordLink(node.id);
  };
  var box = nodeEl.querySelector('.ve-node-box') || nodeEl;
  box.appendChild(b);
  return true;
}

// ── BAĞI ÇEVİR ──────────────────────────────────────────────────────────────
//
// AÇARKEN KUTULAR KOORDİNATA GERİ OTURUR — ve bu üç seçenekten tek güvenli
// olanı:
//   (a) kutular mm'ye döner            ← SEÇİLEN
//   (b) mm kutulardan yeniden yazılır  → kullanıcının bağı kapatma SEBEBİNİ
//       (modeli değiştirmeden dizmek) tersine çevirir: tek tıkla bütün
//       koordinatlar sessizce değişir. Bu modülün en pahalı hata sınıfı.
//   (c) hiçbir şey                     → (b)'nin gecikmiş hâli ve daha kötüsü:
//       `veFeadSyncMmFromCanvas` mm'yi MUTLAK hesaplıyor (delta değil), yani
//       açtıktan sonraki İLK sürükleme bütün kasnakların koordinatını kutu
//       konumlarına sıçratırdı — hem de alakasız bir anda.
// (a) ayrıca sistemin kendi davranışıyla tutarlı: alt topoloji her açılışında
// `veFeadPlaceFromCoords` zaten kutuları koordinata oturtuyor (satır ~286).
//
// Kaç kutunun oynadığı TOAST'ta yazılı: 0 ise kullanıcı hiçbir şeyin
// değişmediğini görür, 6 ise dizilişinin geri alındığını.
function veFeadToggleCoordLink(nodeId){
  if(typeof nodes === 'undefined') return null;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || !_feadDefOf(node).isFeadCoordLink) return null;
  if(!node.data) node.data = {};
  var acik = (typeof veFeadCoordLinkOn === 'function') ? veFeadCoordLinkOn(nodes) : true;
  node.data.linked = !acik;
  var oturan = 0;
  // Bağ AÇILDIYSA kutuları koordinata oturt. Kapatmada yapılacak bir şey yok:
  // o anda kutu ile koordinat zaten uyuşuyor.
  if(node.data.linked && typeof veFeadPlaceFromCoords === 'function'){
    try { oturan = veFeadPlaceFromCoords(); } catch(e){ oturan = 0; }
  }
  if(typeof saveState === 'function') saveState();
  veFeadRefreshBadges();
  if(typeof veFeadRefreshLayoutCards === 'function') veFeadRefreshLayoutCards();
  if(typeof showNodeProperties === 'function'
     && typeof selectedNode !== 'undefined' && selectedNode && selectedNode.id === nodeId)
    showNodeProperties(node);
  if(typeof showToast === 'function'){
    showToast(node.data.linked
      ? ('Konum bağı AÇIK — kanvas konumu = mm koordinatı'
         + (oturan ? ' · ' + oturan + ' kutu koordinatına oturdu' : ''))
      : 'Konum bağı KAPALI — kutular serbest, koordinatlar panelden', 'info');
  }
  return node.data.linked;
}

// ── KONUM BAĞI PANELİ ───────────────────────────────────────────────────────
//
// Panel ile rozet AYNI ALANI okuyor (`veFeadCoordLinkOn`) ve AYNI eylemi
// çağırıyor (`veFeadToggleCoordLink`) — iki ayrı ayar tutulsa panel bir durumu,
// kanvastaki rozet başkasını gösterirdi. Kayış kipindeki kuralın aynısı.
//
// Künye bir SÜS DEĞİL: bağ açıkken "kanvasta 1 px kaç mm" ve "orijin hangi
// kasnak" sorularının cevabı olmadan kullanıcı kutuyu neye göre taşıdığını
// bilemez. Orijin bir ROL (sürücü kasnak), tip değil — yani topolojiye göre
// değişiyor ve panelde adıyla yazılması gerekiyor.
function getFeadCoordLinkPropertiesHTML(node){
  if(!node.data) node.data = {};
  var acik = (typeof veFeadCoordLinkOn === 'function' && typeof nodes !== 'undefined')
    ? veFeadCoordLinkOn(nodes) : true;
  var org = (typeof veFeadOriginNode === 'function' && typeof nodes !== 'undefined')
    ? veFeadOriginNode(nodes) : null;
  var kasnak = (typeof nodes !== 'undefined' && nodes)
    ? nodes.filter(function(n){ return _feadIsPulley(n); }).length : 0;
  var s = (typeof VE_FEAD_PX_PER_MM === 'number') ? VE_FEAD_PX_PER_MM : 1;
  var renk = acik ? 'var(--accent-warning)' : 'var(--accent-primary)';

  var html = '<div class="sw-panel">';

  html += _feadCard('Konum Bağı', '', renk,
      '<button onclick="veFeadToggleCoordLink(\'' + node.id + '\')" '
    + 'style="width:100%; padding:11px 14px; margin-bottom:9px; border:none; cursor:pointer; '
    + 'border-radius:var(--radius-sm); color:#fff; font-weight:700; letter-spacing:0.03em; '
    + 'font-size:var(--fs-body); background:' + renk + ';">'
    + (acik ? 'AÇIK — kapatmak için tıkla' : 'KAPALI — açmak için tıkla') + '</button>'
    + '<div style="font-size:var(--fs-micro); color:var(--text-secondary); line-height:1.6;">'
    + (acik
        ? '<b>Kanvas = kayış düzlemi.</b> Bir kasnağı kanvasta taşımak onu kayış '
          + 'düzleminde taşır; mm koordinatı, kayış yolu ve gerginlik aynı karede '
          + 'tazelenir.'
        : '<b>Kutu ile koordinat bağımsız.</b> Kasnakları okunur bir blok diyagramı '
          + 'gibi dizebilirsin; model değişmez. Koordinatlar yalnız kasnak '
          + 'panellerinden girilir.')
    + '</div>');

  html += _feadCard('Künye', '', 'var(--text-muted)',
      '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.7;">'
    + '• ölçek: <b>1 px = ' + _feadFmt(1 / s, 2) + ' mm</b> (hassasiyet zoom\'dan)<br>'
    + '• orijin: <b>' + (org ? _feadEsc(_feadNodeName(org)) : '—')
    + '</b> (sürücü kasnak — bir ROL, tip değil)<br>'
    + '• kapsam: <b>' + kasnak + ' kasnak</b> · gergide taşınan şey avara merkezi'
    + '</div>');

  html += _feadHint('Bağ kapalıyken de <b>Otomatik Düzenle</b> kutuları '
    + 'koordinatlarına geri oturtur — tek yönlü uzlaştırma yolu odur. Bağı '
    + 'yeniden açmak da aynı şeyi yapar: kutular koordinata döner, koordinatlar '
    + 'kutulara YAZILMAZ.');

  html += '</div>';
  return html;
}

// ── BAĞ DÜĞÜMÜ SİLİNİNCE UZLAŞTIR ───────────────────────────────────────────
//
// Düğüm silinince bağ AÇILIR — "düğüm yoksa AÇIK" varsayılanı gereği. Ama
// kutular hâlâ kullanıcının onları bıraktığı serbest yerlerde duruyor, yani
// silme tek başına kanvas ile modeli AYRIŞMIŞ bırakıyor. Ve ayrışma sessiz
// kalmıyor, PATLIYOR: `veFeadSyncMmFromCanvas` mm'yi MUTLAK hesaplıyor
// (delta değil), dolayısıyla sonraki İLK sürükleme birikmiş kaymanın
// tamamını tek karede modele yazıyor.
//
// ÖLÇÜLDÜ (BMC, bağ kapalıyken alternatör 80 px sağa / 50 px yukarı dizilmiş,
// sonra bağ düğümü silinmiş):
//     silmeden hemen sonra   alternatör mm −281.00 · kol 28.4271°
//     ve 1 px SÜRÜKLENİNCE   alternatör mm −200.00 · kol 28.0625°
// Yani bir pikselin karşılığı 81 mm — uyarısız, hatasız. Bu, modülün
// belgelenmiş 38.108 mm sınıfının aynısı.
//
// Silme, rozeti AÇIK'a çevirmekle aynı şeydir; uzlaştırma da aynı olmalı:
// kutular koordinata döner, koordinat kutuya YAZILMAZ.
function veFeadCoordLinkAfterDelete(silinen){
  if(typeof nodes === 'undefined' || !silinen || !silinen.length) return 0;
  var vardi = silinen.some(function(n){ return !!_feadDefOf(n).isFeadCoordLink; });
  if(!vardi) return 0;
  // Geriye KAPALI bir kopya kaldıysa bağ hâlâ kapalı — uzlaştırma yanlış olurdu.
  if(typeof veFeadCoordLinkOn === 'function' && !veFeadCoordLinkOn(nodes)) return 0;
  var oturan = 0;
  try { oturan = veFeadPlaceFromCoords(); } catch(e){ oturan = 0; }
  if(oturan && typeof showToast === 'function')
    showToast('Konum bağı düğümü silindi — bağ AÇIK; ' + oturan
      + ' kutu koordinatına oturdu', 'info');
  return oturan;
}

// ── DÖNÜŞ YÖNÜ ROZETİ ───────────────────────────────────────────────────────
//
// Rozet bir BAYRAK GÖSTERMİYOR, KABLOLARDAN TÜREYEN yönü gösteriyor:
// `veFeadNaturalSense` kasnak merkezlerinin kayış gidiş sırasındaki
// ayakkabı-bağı işaretini okuyor (çekirdeğin `loopSense`'iyle AYNI ölçüt).
// Tıklamak bir alan yazmıyor, KABLOLARI çeviriyor — tek gerçek kaynak orası.
//
// GLİF DURUMU TAŞIR, RENK DEĞİL — ve bu bilinçli. Aynı kanvasta iki rozet daha
// var (`SABİT/SERBEST`, `AÇIK/KAPALI`) ve ikisinde de renk kanalı
// "mavi = GİRDİ, amber = TÜRETİLEN" demek. CW ile CCW'nin İKİSİ DE eşit
// derecede meşru; birine amber vermek "bu yön hesaplanmış, öbürü girilmiş"
// derdi ve yalan olurdu. Durumu ok (↻ / ↺) taşıyor.
//
// RENK BAŞKA BİR ŞEY SÖYLÜYOR — bu yönün ÇALIŞIP ÇALIŞMADIĞINI:
//   yeşil  gergi kayışın GEVŞEK tarafında (geçerli yerleşim)
//   kırmızı gergi GERGİN tarafa düştü — span gerilmeleri ankrajın altına iner
//   nötr   henüz çözüm yok (hüküm verilemez; uydurulmaz)
// Bu bir üçüncü renk EKSENİ, girdi/türetilen ekseniyle çakışmıyor.
// YÖN ROTA SIRASINDAN OKUNUR, DÜĞÜM DİZİSİ SIRASINDAN DEĞİL — ve bu ayrım
// bir kapıyla yakalandı. `nodes` dizisinin sırası kayış yolunu anlatmıyor;
// örnek yüklenirken tesadüfen örtüşüyor, ama kablolar çevrilince dizi
// DEĞİŞMİYOR. Diziden okuyan rozet, yön çevrildikten sonra da eski yönü
// gösteriyordu — sessiz, çünkü sayı makul.
//
// TEK NOKTA: rozet de panel de burayı çağırıyor (iki ayrı hesap tutulsaydı
// biri bayat kalırdı — bu modülün tekrar eden kuralı).
function veFeadCurrentSpin(){
  if(typeof nodes === 'undefined' || typeof veFeadNaturalSense !== 'function') return 0;
  var conn = (typeof connections !== 'undefined' && connections) ? connections : [];
  var order = (typeof veFeadRouteOrder === 'function')
    ? veFeadRouteOrder(nodes, conn) : nodes.filter(function(n){ return _feadIsPulley(n); });
  return veFeadNaturalSense(order);
}

function veFeadApplySpinBadge(nodeEl, node){
  var sense = veFeadCurrentSpin();
  var metin = sense > 0 ? '↺ CCW' : sense < 0 ? '↻ CW' : '—';

  // Hüküm oturumluk sonuçtan okunur; çözüm yoksa rozet renk İDDİA ETMEZ.
  var _R = (typeof veFeadResults !== 'undefined' && veFeadResults) ? veFeadResults : null;
  var hkm = (_R && _R.tensionerSide) ? !!_R.tensionerSide.ok : null;

  var bg = (hkm === true) ? 'var(--accent-success, #22c55e)'
         : (hkm === false) ? 'var(--accent-danger, #ef4444)'
         : 'var(--text-secondary, #666)';
  var b = document.createElement('span');
  b.className = 've-fead-badge';
  b.textContent = metin;
  b.title = (sense === 0
      ? 'Kayış dönüş yönü okunamadı (kasnak koordinatları eksik ya da yol kapanmıyor).'
      : 'Kayış çevrimi ' + (sense > 0 ? 'CCW (saat yönünün TERSİNE)' : 'CW (saat yönünde)')
        + ' — motora ÖNDEN bakışta. Yön kablolama sırasından türer; '
        + 'tıkla → kayış yolunu ters çevir.')
    + (hkm === false
        ? '\n\nUYARI: bu yönde gergi kayışın GERGİN tarafına düşüyor; '
          + 'span gerilmeleri ankrajın altına iniyor.'
        : hkm === true ? '\n\nGergi gevşek tarafta ✓' : '');
  b.style.cssText = 'position:absolute; top:-9px; right:-6px; z-index:3; cursor:pointer;'
    + 'font-size:var(--fs-micro); font-weight:700; line-height:1; letter-spacing:0.02em;'
    + 'padding:2px 4px; border-radius:3px; font-family:ui-monospace, monospace;'
    + 'color:#fff; background:' + bg + '; border:1px solid var(--bg-primary, #111);';
  b.onmousedown = function(e){ e.stopPropagation(); };
  b.ondblclick  = function(e){ e.stopPropagation(); e.preventDefault(); };
  b.onclick = function(e){
    e.stopPropagation(); e.preventDefault();
    veFeadToggleSpin();
  };
  var box = nodeEl.querySelector('.ve-node-box') || nodeEl;
  box.appendChild(b);
  return true;
}

// ── YÖNÜ ÇEVİR ──────────────────────────────────────────────────────────────
//
// KABLOLAR çevrilir, bir alan yazılmaz. saveState mutasyondan ÖNCE çağrılıyor
// (geri-al yığınına ÖN durumu koymak için — projenin kendi sözleşmesi), sonra
// bağlantı katmanı tazeleniyor. Kart tazelemesi için AYRI bir çağrı gerekmiyor:
// `veFeadTopoSignature` tel uçlarını okuyor, uçlar değişince imza değişiyor ve
// `updateAllConnections` kartı kendisi yeniden kuruyor. Bayrak yolunda bu
// bedava olmazdı — araç düğümlerinin `data`'sı imzaya HİÇ girmiyor (ölçüldü),
// yani geri-al sonrası kart sessizce bayat kalırdı.
function veFeadToggleSpin(){
  if(typeof nodes === 'undefined' || typeof connections === 'undefined') return 0;
  if(typeof veFeadReverseRoute !== 'function') return 0;
  if(typeof saveState === 'function') saveState();
  var k = veFeadReverseRoute(nodes, connections);
  if(typeof updateAllConnections === 'function') updateAllConnections();
  veFeadRefreshBadges();
  if(typeof veFeadRefreshLayoutCards === 'function') veFeadRefreshLayoutCards();
  if(typeof showNodeProperties === 'function'
     && typeof selectedNode !== 'undefined' && selectedNode)
    showNodeProperties(selectedNode);
  if(typeof showToast === 'function'){
    var sense = veFeadCurrentSpin();
    showToast(k ? ('Kayış dönüş yönü: ' + (sense > 0 ? 'CCW' : sense < 0 ? 'CW' : '—')
                   + ' · ' + k + ' bağlantı çevrildi')
                : 'Çevrilecek kayış bağlantısı yok', k ? 'info' : 'warning');
  }
  return k;
}

// ── DÖNÜŞ YÖNÜ PANELİ ───────────────────────────────────────────────────────
function getFeadSpinPropertiesHTML(node){
  if(!node.data) node.data = {};
  var sense = veFeadCurrentSpin();
  var metin = sense > 0 ? 'CCW — saat yönünün TERSİNE'
            : sense < 0 ? 'CW — saat yönünde' : '— (okunamadı)';
  var R = (typeof veFeadResults !== 'undefined' && veFeadResults) ? veFeadResults : null;
  var hkm = (R && R.tensionerSide) ? R.tensionerSide : null;
  var renk = !hkm ? 'var(--text-secondary)'
           : hkm.ok ? 'var(--accent-success)' : 'var(--accent-danger)';

  var html = '<div class="sw-panel">';
  html += _feadCard('Kayış Dönüş Yönü', '', renk,
      '<div style="font-family:ui-monospace,monospace; font-weight:700; '
    + 'font-size:var(--fs-lg); color:' + renk + '; margin-bottom:9px;">'
    + _feadEsc(metin) + '</div>'
    + '<button onclick="veFeadToggleSpin()" style="width:100%; padding:11px 14px; '
    + 'margin-bottom:9px; border:none; cursor:pointer; border-radius:var(--radius-sm); '
    + 'color:#fff; font-weight:700; letter-spacing:0.03em; font-size:var(--fs-body); '
    + 'background:var(--accent-primary);">Yönü çevir</button>'
    + _feadHint('Yön bir ayar DEĞİL: kasnak merkezlerinin kayış gidiş sırasındaki '
        + 'dolanım işaretinden türer (<b>motora ÖNDEN bakış</b>). "Yönü çevir" '
        + 'kayış yolunun bağlantılarını ters çevirir — kanvastaki gidiş okları da '
        + 'onunla döner.'));

  // GEOMETRİ YÖNDEN BAĞIMSIZ, GERİLME DEĞİL — ve bunu panel SÖYLÜYOR, çünkü
  // kullanıcı "yönü çevirdim, sarım açıları neden aynı" diye sormasın.
  html += _feadCard('Neyi değiştirir', '', 'var(--text-muted)',
      '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.7;">'
    + '• <b>Değişmez:</b> sarım açıları, açıklıklar, efektif kayış boyu, Σsarım=360 '
    + '— ölçüldü, kasnak başına fark 2,5e−14°<br>'
    + '• <b>Değişir:</b> hangi açıklığın GERGİN olduğu — yani span gerilmeleri, '
    + 'hubload yönleri ve kayma emniyeti<br>'
    + '• <b>Değişir:</b> kasnakların dönüş yönü ve kanvastaki gidiş okları'
    + '</div>');

  if(hkm && !hkm.ok){
    html += _feadCard('Gergi tarafı', 'hüküm', 'var(--accent-danger)',
        '<div style="font-size:var(--fs-micro); color:var(--text-secondary); line-height:1.7;">'
      + '<b style="color:var(--accent-danger);">Gergi kayışın GERGİN tarafında.</b> '
      + 'Ankraj ' + _feadFmt(hkm.anchorN, 1) + ' N, en düşük açıklık '
      + _feadFmt(hkm.minN, 1) + ' N ("' + _feadEsc(hkm.minName || '—') + '") — '
      + _feadFmt(hkm.deficitN, 1) + ' N altında. Otomatik gergi tanım gereği '
      + '<b>gevşek</b> tarafa konur; gergin tarafta tahrik gerginliğinin tamamını '
      + 'yayla karşılamak zorunda kalır ve durdurucusuna dayanır.<br><br>'
      + 'Çare: <b>yönü çevirin</b> ya da gergiyi kayış sırasında sürücünün önüne alın. '
      + 'Tasarım gerginliğini yükseltmek bir seçenek DEĞİL — o değer yay dengesinden '
      + 'türüyor, panelde girilen bir alan değil.'
      + '</div>');
  } else if(hkm && hkm.ok){
    html += _feadHint('<b style="color:var(--accent-success);">Gergi gevşek tarafta ✓</b> — '
      + 'ankraj en düşük açıklık, gerilme zinciri bu yönde tutarlı.');
  } else {
    html += _feadHint('Gergi tarafı hükmü için önce Çözücü panelinden çözüm koşturun.');
  }

  html += '</div>';
  return html;
}

// Tüm kasnakların rozetini tazele (temas tarafı / sürücü değişince).
function veFeadRefreshBadges(){
  if(typeof document === 'undefined' || typeof nodes === 'undefined') return 0;
  var n = 0;
  nodes.forEach(function(x){
    var el = document.getElementById(x.id);
    if(el && veFeadApplyBadge(el, x)) n++;
  });
  return n;
}

function veFeadSetChoice(nodeId, key, val){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  node.data[key] = val;
  if(typeof saveState === 'function') saveState();
  if(key === 'contact' || key === 'lengthMode') veFeadRefreshBadges();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
}

// SÜRÜCÜ TEKİLDİR. İşaretlenince diğer kasnaklardaki bayrak temizlenir —
// aksi hâlde çekirdek "birden fazla crank" diye reddeder ve kullanıcı hangi
// kasnağın eski işareti taşıdığını aramak zorunda kalır.
function veFeadSetDriver(nodeId, on){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return;
  nodes.forEach(function(n){
    if(n.data && n.data.driver && n.id !== nodeId && _feadIsPulley(n)) delete n.data.driver;
  });
  if(!node.data) node.data = {};
  if(on) node.data.driver = true; else delete node.data.driver;
  if(typeof saveState === 'function') saveState();
  veFeadRefreshBadges();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
}

// ════════════════════════════════════════════════════════════════════════════
//  KASNAK PANELİ (Krank / aksesuarlar / avara)
// ════════════════════════════════════════════════════════════════════════════
// Üç kasnak ailesinin de ortak çekirdeği: geometri (etkin çap + kayış
// düzlemindeki konum) ve eylemsizlik. Farklar tipten okunur:
//   • Krank (isFeadDriver)    → tahrik kaynağı, yük torku YOK.
//   • Aksesuar (isFeadAccessory) → çektiği tork/güç alanı VAR.
//   • Avara (isFeadIdler)     → yük çekmez, yalnız kayış yolunu yönlendirir.
function getFeadPulleyPropertiesHTML(node){
  if(!node.data) node.data = {};
  veFeadMigrateNode(node);                       // eski kayıt: dia → od
  var def = _feadDefOf(node);
  var isIdler = !!def.isFeadIdler;
  var isDriver = !!(node.data.driver);
  var html = '<div class="sw-panel">';


  // ── TEMAS TARAFI — sessiz hataya karşı en kritik alan ──
  // Ters verilirse çekirdek BAŞKA BİR GEÇERLİ güzergâh hesaplar; kapalı çevrim
  // ve sarım değişmezi yine tutar. Yani ne kod ne de göz yakalar. Bu yüzden
  // kendi kartında, uyarısıyla birlikte duruyor.
  html += _feadCard('Temas Tarafı', 'hesap için kritik', 'var(--accent-danger)',
      _feadSelect(node, 'Kayış bu kasnağa', 'contact',
        [['grooved', 'Kaburgalı yüzden değiyor'], ['back', 'Sırtından değiyor']],
        veFeadContactOf(node),
        'Yerleşim çiziminden okunur, hesaplanamaz. <b>Ters verilirse</b> program geçerli '
        + 'ama BAŞKA bir kayış yolu çözer; hata mesajı almazsınız. Aksesuarlar tipik olarak '
        + 'kaburgalı yüzden, avara ve gergi sırttan temas eder.'));

  html += _feadCard('Kasnak Geometrisi', '[mm]', 'var(--accent-primary)',
      _feadGrid(node, [
        { key:'od', label:'Dış çap (OD)', ph:String(VE_FEAD_DEFAULT_DIA[node.type] || 100) },
        { key:'x',  label:'Konum X',      ph:'0' },
        { key:'y',  label:'Konum Y',      ph:'0' }
      ], 3)
    + _feadHint('<b>Dış çap</b> girilir; pitch ve efektif yarıçapları çekirdek kayış profilinden '
        + 'türetir (kaburgalı: r<sub>pitch</sub>=OD/2+h<sub>b</sub>, r<sub>eff</sub>=OD/2). '
        + 'Konum, kayış düzleminde (motor önden görünüş) kasnak merkezidir.'
        // BAĞ KAPALIYKEN KUTU OYNAMAZ VE BUNU BURADA SÖYLER. Normalde bu üç
        // alan kanvastaki kutuyu da taşıyor (VE_FEAD_COORD_KEYS →
        // veFeadPlaceFromCoords); bağ kapalıyken taşımıyor. Sessiz bırakılsaydı
        // kullanıcı sayıyı yazar, kutu yerinde kalır ve alanın bozuk olduğunu
        // sanardı — oysa model DEĞİŞTİ. Sağlıklı (bağ açık) durumda metin
        // birebir eskisi: yanlış alarm yok.
        + ((typeof veFeadCoordLinkOn === 'function' && typeof nodes !== 'undefined'
            && !veFeadCoordLinkOn(nodes))
             ? '<br><b style="color:var(--accent-primary);">Konum Bağı KAPALI</b> — '
               + 'girilen değer modele işler ama kanvastaki kutu yerinden oynamaz.'
             : '')));

  html += _feadCard('Rol', '', 'var(--accent-success)',
      _feadToggle(node, 'Sürücü kasnak (kayışı bu döndürür)', 'driver', 'veFeadSetDriver',
        'Sürücülük bir ROLDÜR, bileşen tipi değil: ikincil tahrikte fan kasnağı da sürücü '
        + 'olabilir. Tek kasnakta işaretlenir; işaretlerseniz diğerlerinden kalkar.')
    + _feadGrid(node, [
        { key:'inertia', label:'Atalet J [kg·m²]', ph:'0.010', step:'0.0001' }
      ], 1)
    + _feadHint(isDriver ? 'Sürücü kasnak ataleti torsiyonel damperi de içerir.'
        : isIdler ? 'Avara kasnak kayıştan güç çekmez; ataleti yalnız geçici rejim için.'
        : 'Aksesuarın çektiği güç, Çözücü panelindeki çalışma çevrimi tablosunda devir başına girilir.'));

  // KATALOG BAĞI — yalnız MFSim'de devir→kW eğrisi bulunan aksesuar tipleri.
  // Seçilirse çalışma çevrimi tablosundaki boş kW hücreleri bu eğriden dolar ve
  // AKSESUAR DEVRİ KASNAK PITCH ÇAPLARINDAN hesaplanır — preset'in kendi
  // driveRatio'su kullanılmaz. Spesifikasyon §2.3: elle yazılmış hız oranları
  // Excel'in en ciddi hatasıydı, bütün gerilmeleri %17 düşürüyordu.
  var lib = veFeadPresetLib(node.type);
  if(lib){
    var secenekler = [['__manual__', 'Elle gir (katalog kullanma)']];
    Object.keys(lib).forEach(function(k){ secenekler.push([k, lib[k].name || k]); });
    html += _feadCard('Katalog Modeli', 'devir → kW eğrisi', 'var(--accent-warning)',
        _feadSelect(node, 'Model', 'accPreset', secenekler, '__manual__',
          'Araç Performans modülünün kataloglarıyla AYNI kaynak. Seçilince çalışma çevrimi '
          + 'tablosundaki boş kW hücreleri bu eğriden doldurulur; aksesuar devri kasnak '
          + '<b>pitch çaplarından</b> gelir, elle oran girilmez.'));
  }

  if(!isIdler) html += veFeadAccLimitCard(node);
  if(!isIdler) html += veFeadPowerCurveCard(node);

  html += '</div>';
  return html;
}

// ── BMC AKSESUAR KÜNYESİ + DEVİR SINIRLARI ─────────────────────────────────
//
// Üç devir alanı ÖLÜ DEĞİL: ikisi doğrudan bir kapı besliyor
// (js/fead-checks.js — devir penceresi ve devir sınırı). MFSim'de zaten olan
// "Katalog Modeli" kartıyla karıştırılmasın diye ayrı duruyor ve ne getirdiği
// yazılı: o kart yalnız devir→kW eğrisi verir, bu kart SINIR verir.
//
// KATALOG SEÇİCİ yalnız defterde karşılığı olan iki tipte (alternatör, klima)
// çıkar; SINIR ALANLARI her aksesuarda durur — kullanıcı su pompasının ya da
// hava kompresörünün sınırını biliyorsa kapı onda da çalışsın. Elle girilen
// değer katalogtan ÜSTÜNDÜR (veFeadAccLimits).
function veFeadAccLimitCard(node){
  var h = '';
  var tip = (typeof VE_FEAD_ACC_TYPE !== 'undefined') ? VE_FEAD_ACC_TYPE[node.type] : null;

  if(tip && typeof veFeadAccList === 'function'){
    var liste = veFeadAccList(node.type);
    var sec = (node.data && node.data.accLib) || '';
    h += '<div style="display:flex; align-items:center; gap:10px; margin-bottom:9px;">'
      + '<div style="flex:1; font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">'
      + 'BMC künyesi</div>'
      + '<select onchange="veFeadApplyAccLib(\'' + node.id + '\',this.value)"'
      + ' style="width:230px; ' + _FEAD_INP + ' text-align:left;">'
      + '<option value="">— elle gir —</option>';
    liste.forEach(function(r){
      h += '<option value="' + _feadEsc(r.key) + '"' + (r.key === sec ? ' selected' : '') + '>'
         + _feadEsc(r.label) + '</option>';
    });
    h += '</select></div>';
  }

  h += _feadGrid(node, [
      { key:'optimumRpm', label:'Optimum [d/dk]',       ph:'6000',  step:'50' },
      { key:'maxContRpm', label:'Maks. sürekli [d/dk]', ph:'8000',  step:'50' },
      { key:'maxPeakRpm', label:'Maks. anlık [d/dk]',   ph:'12000', step:'50' }
    ], 3);

  // Katalog seçiliyken hangi alanın nereden geldiği YAZILI: elle girilen bir
  // değer katalogu ezer ve bunu görmeden fark etmek zor olurdu.
  var lim = (typeof veFeadAccLimits === 'function') ? veFeadAccLimits(node) : null;
  if(lim && lim.key){
    var elle = ['optimum','maxCont','maxPeak'].filter(function(k){
      return lim[k] && lim[k].kaynak === 'elle'; });
    h += _feadHint(elle.length
      ? '<b>' + _feadEsc(lim.ad) + '</b> seçili; <b style="color:var(--accent-warning);">'
        + elle.length + ' alan elle girilmiş</b> ve katalog değerinin yerine geçiyor.'
      : '<b>' + _feadEsc(lim.ad) + '</b> — üç sınır da katalogdan.');
  }

  h += _feadHint('<b>Optimum</b> ile <b>maksimum sürekli</b> arası, aksesuarın çalışmasının '
    + 'istendiği banttır: motor <i>governed</i> devrindeyken aksesuar devri bu banda düşmüyorsa '
    + 'panel <b>kasnak çapı küçültülmeli / büyütülmeli</b> der. <b>Maksimum anlık</b> ise motor '
    + '<i>overspeed</i>\'e çıktığında aşılmaması gereken sınırdır. Üçü de boşsa o kasnak için '
    + 'kapı <b>değerlendirilemedi</b> olur — uygun sayılmaz.');

  return _feadCard('Devir Sınırları', tip ? 'BMC kataloğu + kapı girdisi' : 'kapı girdisi',
                   'var(--accent-primary)', h);
}

// Aksesuar künyesini uygula. Boş değer yalnız BAĞI çözer (alanlar kalır);
// dolu değer sınırları ve — varsa — devir/kW eğrisini yazar.
function veFeadApplyAccLib(nodeId, key){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  if(!key){
    if(typeof veFeadAccUnlink === 'function') veFeadAccUnlink(node);
  } else if(typeof veFeadAccApply === 'function'){
    if(!veFeadAccOf(key)) return;
    veFeadAccApply(node, key);
    var rec = veFeadAccOf(key);
    if(typeof showToast === 'function')
      showToast(rec.ad + ' künyesi yüklendi'
        + (rec.curve && rec.curve.length ? ' (' + rec.curve.length + ' noktalı eğriyle)'
                                         : ' — defterde eğrisi yok, kW tablosu korundu'), 'success');
  }
  if(typeof saveState === 'function') saveState();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
}

// ── AKSESUAR GÜÇ EĞRİSİ (devir → kW) ────────────────────────────────────────
// Tedarikçi sayfası her aksesuar için kendi ölçülmüş eğrisini veriyor
// (FEAD_INFORMATION'daki "AIR COMPRESOR" ve "ALTERNATOR" grafikleri + altındaki
// tablolar). Bu, genel katalog eğrisinden ÜSTÜNDÜR: aynı tip aksesuarın farklı
// modelleri çok farklı güç çeker. Bu yüzden düğümün kendi eğrisi varsa
// veFeadAutoKw onu kataloğun ÖNÜNDE kullanır.
//
// Tablo AKSESUAR devrine göre girilir (sayfadaki grafiklerin ekseni de o).
// Kullanıcı sayfadaki motor-devri sütunuyla karşılaştırabilsin diye her satırın
// yanında o devri veren MOTOR devri de gösterilir — model çözülüyse.
function veFeadPowerCurveCard(node){
  var pts = veFeadPowerCurve(node);
  var raw = (node.data && Array.isArray(node.data.pwrCurve)) ? node.data.pwrCurve : [];
  var build = veFeadBuildFromCanvas();
  var idx = -1;
  if(build.ok) build.order.forEach(function(n, i){ if(n.id === node.id) idx = i; });

  var h = '<table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; border:1px solid var(--border-color);">';
  h += '<tr style="background:var(--bg-tertiary);">'
     + ['Aksesuar devri', 'Güç [kW]', 'Motor devri'].map(function(t){
         return '<th style="padding:3px 4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-secondary);">' + t + '</th>';
       }).join('')
     + '<th style="padding:3px 4px; border:1px solid var(--border-color);"></th></tr>';

  if(!raw.length){
    h += '<tr><td colspan="4" style="padding:9px; text-align:center; color:var(--text-muted); border:1px solid var(--border-color);">'
       + 'Eğri girilmedi — katalog modeli (varsa) kullanılır.</td></tr>';
  }
  raw.forEach(function(p, pi){
    var rpm = _feadNum(p && p.rpm, NaN);
    // Aksesuar devrini veren motor devri: aksRpm = motorRpm × oran ⇒ tersi.
    var motor = NaN;
    if(build.ok && idx >= 0 && Number.isFinite(rpm) && rpm > 0){
      var bir = FEADCore.accessoryRpm(build.sys, idx, 1000);
      if(Number.isFinite(bir) && bir > 0) motor = rpm * 1000 / bir;
    }
    var hucre = function(key, val, step){
      return '<td style="padding:1px 2px; border:1px solid var(--border-color);">'
        + '<input type="number" value="' + _feadEsc(val == null ? '' : val) + '" step="' + step + '"'
        + ' onchange="veFeadCurveSet(\'' + node.id + '\',' + pi + ',\'' + key + '\',this.value)"'
        + ' style="width:100%; ' + _FEAD_INP + ' height:22px; padding:2px 3px;"></td>';
    };
    h += '<tr>' + hucre('rpm', p && p.rpm, '10') + hucre('kw', p && p.kw, '0.01')
      + '<td style="padding:2px 5px; border:1px solid var(--border-color); text-align:right; '
      + 'font-family:ui-monospace,monospace; color:var(--text-muted);">'
      + (Number.isFinite(motor) ? _feadFmt(motor, 0) : '—') + '</td>'
      + '<td style="padding:1px 3px; border:1px solid var(--border-color); text-align:center;">'
      + '<button onclick="veFeadCurveRemove(\'' + node.id + '\',' + pi + ')" title="Satırı sil"'
      + ' style="background:none; border:none; color:var(--accent-danger); cursor:pointer; font-size:var(--fs-body); line-height:1;">×</button></td></tr>';
  });
  h += '</table>';

  h += '<div style="display:flex; gap:6px; margin-top:7px;">'
    + '<button onclick="veFeadCurveAdd(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:var(--fs-micro); '
    + 'background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">+ Devir noktası</button>'
    + '</div>';

  var not = '';
  if(raw.length && pts.length < raw.length)
    not += _feadHint('<b style="color:var(--accent-warning);">' + (raw.length - pts.length)
      + ' satır eksik/geçersiz</b> — yalnız devir ve güç değeri dolu satırlar eğriye girer.');
  if(pts.length === 1)
    not += _feadHint('<b style="color:var(--accent-warning);">Tek nokta</b> — eğri sabit güç '
      + 'gibi davranır (her devirde ' + _feadFmt(pts[0].kw, 2) + ' kW).');

  return _feadCard('Güç Eğrisi', 'sayfadaki devir → kW tablosu', 'var(--accent-primary)',
    h + not
    + _feadHint('Girildiğinde <b>katalog modelinin önüne geçer</b>. Ara değerler doğrusal, '
      + 'uçlarda sabit tutulur (ekstrapolasyon YAPILMAZ — alternatör eğrisini uzatmak eksi '
      + 'güç üretebilirdi). "Motor devri" sütunu bilgi içindir: o aksesuar devrini veren motor '
      + 'devri, kasnak <b>pitch</b> çaplarından ve birinci kademe oranından hesaplanır — '
      + 'sayfanızın motor-devri sütunuyla karşılaştırabilirsiniz.'));
}

function veFeadCurveAdd(nodeId){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  if(!Array.isArray(node.data.pwrCurve)) node.data.pwrCurve = [];
  var son = node.data.pwrCurve[node.data.pwrCurve.length - 1];
  node.data.pwrCurve.push({ rpm: son ? _feadNum(son.rpm, 0) + 500 : 1000, kw: '' });
  if(typeof saveState === 'function') saveState();
  _feadForgetResults();
  _feadRedraw(node);
}
function veFeadCurveRemove(nodeId, i){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || !node.data || !Array.isArray(node.data.pwrCurve)) return;
  node.data.pwrCurve.splice(i, 1);
  if(typeof saveState === 'function') saveState();
  _feadForgetResults();
  _feadRedraw(node);
}
function veFeadCurveSet(nodeId, i, key, val){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || !node.data || !Array.isArray(node.data.pwrCurve)) return;
  var row = node.data.pwrCurve[i];
  if(!row) return;
  row[key] = val;
  if(typeof saveState === 'function') saveState();
  _feadForgetResults();
  _feadRedraw(node);
}

// ════════════════════════════════════════════════════════════════════════════
//  GERGİ PANELİ
// ════════════════════════════════════════════════════════════════════════════
// Gergi bir kasnaktır ve koordinatı da diğerleriyle AYNI şeyi gösterir: avara
// kasnağının merkezi. Farkı, kasnağın bir kolun ucunda olması — bu yüzden kol
// ve yay alanlarını da taşır ve gövdenin MONTAJ KONUMU ondan türetilir.
function getFeadTensionerPropertiesHTML(node){
  veFeadMigrateNode(node);        // eski kayıt → tek koordinat: avara merkezi
  if(!node.data) node.data = {};
  var html = '<div class="sw-panel">';
  html += _feadCard('Temas Tarafı', 'hesap için kritik', 'var(--accent-danger)',
      _feadSelect(node, 'Kayış gergi kasnağına', 'contact',
        [['back', 'Sırtından değiyor'], ['grooved', 'Kaburgalı yüzden değiyor']],
        veFeadContactOf(node),
        'Gergi çoğu FEAD düzeninde kayışın SIRTINA bastırır. Ters verilirse program '
        + 'geçerli ama başka bir kayış yolu çözer; hata almazsınız.'));

  html += _feadCard('Kasnak', '', 'var(--accent-primary)',
      _feadGrid(node, [
        { key:'od',      label:'Dış çap (OD) [mm]', ph:'75' },
        { key:'inertia', label:'Atalet J [kg·m²]',  ph:'0.001', step:'0.0001' }
      ], 2));

  // ── AVARA MERKEZİ — TEK KOORDİNAT ──────────────────────────────────────
  //
  // Kullanıcı kararı (2026-09-01): *"biz otomatik gergi için normalde
  // 'otomatik gerginin montaj noktasını' veriyorduk. Bu daha mantıklı oluyordu
  // fakat şimdi 'otomatik gergi avarasının orta noktasını' vereceğiz."*
  //
  // Bir önceki kararla (2026-08-29) birlikte okunur: *"Herhangi bir doğrulama
  // gibi bir olay söz konusu değil."* Yani panel TEK koordinat soruyor ve
  // program hiçbir şeyi hiçbir şeyle karşılaştırmıyor. Kalkan yüzeyler: kip
  // seçicisi, ikincil "Ölçülmüş Pivot" alanları, "Doğrulama" kartı, ve
  // (2026-09-01) montaj zarfı ile kol açısı sabitleme anahtarı.
  //
  // Gövdenin montaj konumu bir GİRDİ DEĞİL: p = c − a·(cos θ, sin θ).
  html += _feadCard('Avara Kasnağının Merkezi', 'tek girdi', 'var(--accent-danger)',
      _feadGrid(node, [
        { key:'cenX', label:'Merkez X [mm]', ph:'-161.97' },
        { key:'cenY', label:'Merkez Y [mm]', ph:'91.29' }
      ], 2)
    + _feadHint('Gergi <b>avarasının merkezi</b> — kayış yolu buradan geçiyor. '
        + 'Tedarikçiye giden FEAD bilgi sayfasının koordinat tablosu gergi satırında '
        + 'da <b>bunu</b> veriyor, diğer bütün kasnaklarla aynı sütunda. Kolun '
        + 'çalışma (Mean) konumundaki merkezdir; kol gezindikçe kasnak bu noktanın '
        + 'çevresinde bir yay çiziyor. <b>Gövdenin montaj konumu buradan çıkar</b> '
        + '(aşağıda).'));

  // KOL YÖNÜ SİHİRBAZLA AYNI DİLDE — kullanıcı isteği (2026-09-01): *"0 ekseni
  // parçanın solunda kalıyor. Mutlak değil, nispi bir açı değeri tanımı
  // olsun."* Alan artık MERKEZDEN PİVOTA bakan işaretli açıyı gösteriyor
  // (0 = +X, CCW artı — yön gülüyle aynı); saklanan alan mutlak kalıyor ve
  // çeviri TEK üreticiden (veFeadArmShownDeg / veFeadArmFromShown). Panel ile
  // sihirbaz aynı alanı yazıyor, ikisi ayrı dil konuşamaz.
  var _armAbs = _feadNum(node.data && node.data.armMeanDeg, NaN);
  var _armGos = (typeof veFeadArmShownDeg === 'function') ? veFeadArmShownDeg(_armAbs) : NaN;
  html += _feadCard('Kol Künyesi', 'parça + montaj verisi', 'var(--text-secondary)',
      _feadGrid(node, [
        { key:'armLen', label:'Kol boyu (Arm Length) [mm]', ph:'90' }
      ], 2)
    + '<label style="display:block; margin-top:6px;">'
      + '<span style="display:block; font-size:var(--fs-micro); color:var(--text-secondary); margin-bottom:2px;">'
      + 'Kol yönü (merkezden pivota, işaretli) [°]</span>'
      + '<input type="text" inputmode="decimal" value="'
      + _feadEsc(Number.isFinite(_armGos) ? Math.round(_armGos * 10000) / 10000 : '')
      + '" placeholder="164" style="width:100%; ' + _FEAD_INP + '"'
      + ' onchange="veFeadSetArmShown(\'' + node.id + '\', this.value)"></label>'
    + veFeadMountReadout(node)
    + _feadHint('<b>Kol boyu</b>: montaj ekseni ile avara merkezi arasındaki sabit '
        + 'mesafe; tedarikçi raporunun "Tensioner Data" bölümünde yazar (56–90 mm '
        + 'aralığında doğrulandı).<br><b>Kol yönü</b>: gövdenin montaj noktasının '
        + 'avara merkezine göre yönü — <b>0° sağda, saat yönünün tersi artı</b>, '
        + 'değer işaretli (−180…+180). Programın yön gülüyle aynı dil. Parça/montaj '
        + 'çizimi bunu ters yönden, mutlak olarak yazar (E9843’ün çizimi '
        + '<i>"344° MEAN ANGLE"</i> diyor — burada <b>164°</b> okunur). Aynı parça '
        + 'başka bir motorda başka bir yönde durabilir, bu yüzden künye '
        + 'kütüphanesine <b>yazılmaz</b>: parçanın kendi değişmezi yön değil, göreli '
        + 'dönme (28°) — o da yay künyesinden çıkıyor.'));

  html += veFeadTensionerLibCard(node);

  // ── YAY KÜNYESİ — tedarikçi sayfasındaki dört satırın birebir karşılığı ──
  html += _feadCard('Yay Künyesi', 'sayfadaki dört satır', 'var(--accent-success)',
      _feadGrid(node, [
        { key:'preload',  label:'Ön yük — Pre-Load [Nm]',  ph:'8.60' },
        { key:'kArm',     label:'Yay katsayısı — Rate [Nm/°]', ph:'0.480', step:'0.001' },
        { key:'meanLoad', label:'Çalışma momenti — Mean Load [Nm]', ph:'22.07' }
      ], 3)
    + _feadHint('Üçü de tedarikçi sayfasının "Tensioner" tablosunda yazar (Spring Pre-Load · '
        + 'Spring Rate · Spring Mean Load). <b>Çalışma momenti</b> kolun montajda ne kadar '
        + 'kurulduğunu söyler: göreli açı = (Mean − Pre) / Rate.'));

  // ── AVARANIN HAREKETİ — avara merkezi + kol künyesinden ────────────────
  // Kart bir girdi SORMUYOR: kolun nereye oturduğunu, gövdenin montaj
  // konumunu ve ÇIKAN kayış boyunu okutuyor. Sayı gizlenmiyor — modülün kendi
  // kuralı: geçerlilik sınırı sonucun İÇİNDE taşınır.
  html += _feadCard('Avara Hareketi', 'girdiden çözülür', 'var(--accent-primary)',
      veFeadArmReadout(node)
    + _feadSelect(node, 'Kol dönüş yönü (sense)', 'sense',
        [['', 'Otomatik bul'], ['1', '+1'], ['-1', '−1']], '',
        'Göreli açı sıfırda serbest koldur ve artan yön yaya yüklenme yönüdür: '
        + 'M = önYük + katsayı × göreli; mutlak açı = serbest + sense × göreli. Sense '
        + 'verilmezse çekirdek kayışın kısaldığı yönden kendisi bulur.'));

  html += _feadCard('Mekanik Sınır ve Atalet', 'burulma modeli için', 'var(--text-secondary)',
      _feadGrid(node, [
        { key:'loadStopRelDeg', label:'Load stop (göreli) [°]', ph:'62.4' },
        { key:'armInertia',     label:'Kol ataleti [kg·m²]',  ph:'0.0009', step:'0.0001' },
        { key:'pulleyMass',     label:'Kasnak kütlesi [kg]',   ph:'0.80',   step:'0.01' }
      ], 3)
    + _feadHint('<b>Load stop</b> bir MEKANİK sınırdır, çalışma noktası değil — boş bırakılabilir. '
        + '<b>Kol ataleti</b> ve <b>kasnak kütlesi</b> burulma (dönel titreşim) modeline girer; '
        + 'ikisi de raporun "Tensioner Data" satırlarında yazar. Kol, kasnağı kol boyu '
        + 'yarıçapında taşıdığı için etkin atalet J<sub>kol</sub> + m·L² olur — <b>kütle '
        + 'girilmezse birinci mod belirgin şekilde YÜKSEK çıkar</b> (BMC örneğinde 15.3 yerine '
        + '20.3 Hz, +%32).'));

  html += '</div>';
  return html;
}


// ── GERGİ KÜNYE KÜTÜPHANESİ KARTI ──────────────────────────────────────────
//
// Kütüphane bir KISIT değil bir ÖNERİ (kayış kataloğuyla aynı kural): kullanıcı
// her zaman elle girebilir. Kartın iki işi var — hazır bir künyeyi tek tıkla
// uygulamak, ve elle girilen künyeyi ölçülen bantla KARŞILAŞTIRMAK. İkincisi
// bir ondalık kaymasını yakalayan tek yüzey.
function veFeadTensionerLibCard(node){
  if(typeof veFeadTensionerList !== 'function')
    return _feadCard('Gergi Künye Kütüphanesi', '', 'var(--text-muted)',
      _feadHint('Kütüphane yüklenmedi (js/fead-tensioners.js).'));
  var td = node.data || {};
  var liste = veFeadTensionerList();
  var sec = td.tenLib || '';
  // ETİKET TEK ÜRETİCİDEN (veFeadTenLabel, fead-tensioners.js) — sihirbazın
  // gergi adımı da aynı listeyi basıyor. İki kopya tutulsaydı biri sessizce
  // eskirdi. Kullanıcı isteği (2026-08-31): etikette kaynak rapor adı DEĞİL,
  // yalnız kol boyu ve çalışma momenti.
  var opts = [['', '— elle gir —']].concat(liste.map(function(r){
    return [r.key, (typeof veFeadTenLabel === 'function') ? veFeadTenLabel(r)
                   : ('kol ' + r.armLen + ' mm · ' + r.meanNm + ' Nm')];
  }));
  var h = '<div style="display:flex; align-items:center; gap:10px; margin-bottom:9px;">'
    + '<div style="flex:1; font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">'
    + 'Ölçülmüş künye</div>'
    + '<select onchange="veFeadApplyTenLib(\'' + node.id + '\',this.value)"'
    + ' style="width:230px; ' + _FEAD_INP + ' text-align:left;">';
  opts.forEach(function(o){
    h += '<option value="' + _feadEsc(o[0]) + '"' + (o[0] === sec ? ' selected' : '') + '>'
       + _feadEsc(o[1]) + '</option>';
  });
  h += '</select></div>';

  var b = veFeadTensionerBandCheck(td);
  if(b.outside.length)
    h += _feadHint('<b style="color:var(--accent-warning);">Ölçülen bandın dışında:</b> '
      + _feadEsc(b.outside.join('; ')) + '. Bu bir hata DEĞİL — elinizdeki gergi '
      + 'bu 14 raporun dışından olabilir. Ama bir ondalık kayması da tam burada '
      + 'görünür.');
  else if(Number.isFinite(b.relNomDeg))
    h += _feadHint('Nominal kol dönmesi <b>' + _feadFmt(b.relNomDeg, 2) + '°</b> '
      + '((M<sub>çalışma</sub> − M<sub>ön</sub>)/k) — ölçülen bandın içinde.');

  h += _feadHint('<b>Kütüphane bir SERTİFİKA değil:</b> 14 Gates raporundan '
    + 'okunmuş künyeler. Parça kodu <b>uydurulmadı</b> — raporun kendi '
    + '<i>Drive Notes</i> alanından okundu (E9843 · T38624 · T38665 · T38519); '
    + 'arşivde raporu olmayan dört kayıt kod <b>taşımıyor</b>. <b>Kol boyu · '
    + 'ön yük · katsayı · kasnak çapı · parça kodu</b> parçanın, <b>çalışma '
    + 'momenti</b> ise montajın: aynı gergi AG0868’de 8PK’da 22,57 · 6PK’da '
    + '19,04 · 4PK’da 16,07 Nm ile kuruluyor. Künye uygulamak <b>montaj konumunu ve kol '
    + 'açısını YAZMAZ</b> — ikisi de motorun verisi, parçanın değil.');
  var _pk = (typeof veFeadTenPin === 'function' && td.tenPart)
    ? veFeadTenPin(td.tenPart) : null;
  if(td.tenPart)
    h += _feadHint(_pk
      ? '<b>Pim künyesi VAR</b> (' + _feadEsc(td.tenPart) + '): gövdenin montajdaki '
        + 'saatini belirleyen konum piminin yarıçapı ve ofseti parça çiziminden '
        + 'okundu, seçilen kol açısının imalat karşılığı aşağıda basılıyor.'
      : '<b>Pim künyesi yok</b> (' + _feadEsc(td.tenPart) + '): parça çizimi elde '
        + 'olmadığı için pim yarıçapı ve ofseti <b>uydurulmuyor</b>. Kol açısı yine '
        + 'seçiliyor; imalata geçmek için o iki sayı parçanın çiziminden okunmalı.');
  return _feadCard('Gergi Künye Kütüphanesi', liste.length + ' ölçülmüş künye',
    'var(--accent-primary)', h);
}

// Künyeyi uygula. KOPYA yazılır (kütüphane sürümü değişse bile kaydedilmiş
// proje kendiliğinden değişmez) ve montaj konumu/kol açısına DOKUNULMAZ.
function veFeadApplyTenLib(nodeId, key){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  if(!key){ delete node.data.tenLib; delete node.data.tenLibVer; }
  else {
    var rec = veFeadTensionerOf(key);
    if(!rec) return;
    veFeadTensionerApply(node.data, rec);
  }
  if(typeof saveState === 'function') saveState();
  if(typeof veFeadRefreshLayoutCards === 'function') veFeadRefreshLayoutCards();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
}


// ═══════════════════════════════════════════════════════════════════════════
//  MONTAJ KONUMU OKUMASI — girdinin YANINDA, çünkü ATÖLYEYE GİDEN SAYI BUDUR
// ═══════════════════════════════════════════════════════════════════════════
//
// Gövdenin montaj konumu bir çıktı ama okunması gereken bir çıktı: motor
// bloğundaki boss/cıvata deliğinin yeri odur. Kol künyesi kartının içinde
// duruyor çünkü onu belirleyen iki alan (kol boyu + kol çalışma açısı) orada.
//
// SAF: yalnız düğüm verisinden hesaplanır, çözüme HİÇ bakmaz. Kayış yolu
// çözülemese de bu üç sayı geçerlidir — geometri onlara bakmıyor.
// Panelin kol yönü yazıcısı — sihirbazdakiyle AYNI çeviriden geçiyor.
function veFeadSetArmShown(nodeId, val){
  var node = (typeof nodes !== 'undefined' && nodes)
    ? nodes.filter(function(n){ return n.id === nodeId; })[0] : null;
  if(!node) return;
  if(!node.data) node.data = {};
  var d = _feadNum(val, NaN);
  if(!Number.isFinite(d)) delete node.data.armMeanDeg;
  else node.data.armMeanDeg = Math.round(veFeadArmFromShown(d) * 10000) / 10000;
  if(typeof saveState === 'function') saveState();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
  if(typeof veFeadRefreshBadges === 'function') veFeadRefreshBadges();
}

function veFeadMountReadout(node){
  var td = (node && node.data) || {};
  var p = veFeadTensionerPivot(td);
  if(!p) return '';
  return '<div style="font-size:var(--fs-micro); line-height:1.5; padding:6px 9px; '
    + 'margin-top:7px; background:var(--bg-tertiary); border:1px solid var(--border-color); '
    + 'border-radius:var(--radius-sm); display:flex; justify-content:space-between; gap:8px;">'
    + '<span style="color:var(--text-muted);">↳ gövdenin montaj konumu (türedi)</span>'
    + '<span style="font-family:ui-monospace,monospace; color:var(--accent-warning);">'
    + _feadFmt(p[0], 2) + ' / ' + _feadFmt(p[1], 2) + ' mm</span></div>';
}

// ═══════════════════════════════════════════════════════════════════════════
//  AVARA HAREKETİ OKUMASI — kol nereye oturdu, kayış boyu ne çıktı
// ═══════════════════════════════════════════════════════════════════════════
//
// Bir dönem burada bir MONTAJ ZARFI vardı: gergi montaj konumu girdiyken kolun
// mutlak açısı bir ölçütten seçiliyordu. Girdi avara merkezine dönünce o ölçüt
// çöktü (ölçüldü: medyan sapma 4,5° → 15,9°, ±5° isabet 9/14 → 2/14, sekiz
// aday ölçütün en iyisi bile 2/14) ve sebebi fiziksel: merkez sabitken kayış
// yolu kol açısından bağımsız (ölçüldü: 4,55e−13 mm), dolayısıyla ölçüt
// eğrisi DÜZLEŞİYOR — %1 platosu 2,1° → 24,1°.
// Gerekçe `fead-model.js`'in "MONTAJ ZARFI KALKTI" bloğunda.
//
// Kart artık bir girdi SORMUYOR — okutuyor.
function veFeadArmReadout(node){
  var td = (node && node.data) || {};
  var m = veFeadSpringSetup(td);
  var cen = veFeadTensionerBoxMm(td);
  var a = _feadNum(td.armLen, NaN);
  var th = _feadNum(td.armMeanDeg, NaN);

  if(!cen || !(a > 0) || !Number.isFinite(th) || !Number.isFinite(m.relMeanDeg))
    return _feadHint('Avara merkezi, kol boyu, kol çalışma açısı ve yay künyesi '
      + '(ön yük · katsayı · çalışma momenti) girilince kolun hareketi burada çözülür.');

  var b = null;
  try { b = veFeadBuildFromCanvas(); } catch(e){ b = null; }
  var satir = function(et, deg, renk){
    return '<div style="display:flex; justify-content:space-between; gap:8px; padding:2px 0;">'
      + '<span style="color:var(--text-muted);">' + et + '</span>'
      + '<span style="font-family:ui-monospace,monospace; color:' + (renk || 'var(--text-primary)') + ';">'
      + deg + '</span></div>';
  };
  var h = '<div style="font-size:var(--fs-micro); line-height:1.5; padding:7px 9px; margin-bottom:9px; '
        + 'background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
  h += satir('Yay kurulması (Mean−Pre)/Rate', _feadFmt(m.relMeanDeg, 2) + '°');
  h += satir('Kol çalışma açısı (girdi)', _feadFmt(th, 2) + '°');
  var p = veFeadTensionerPivot(td);
  if(p) h += satir('↳ gövdenin montaj konumu (türedi)',
    _feadFmt(p[0], 2) + ' / ' + _feadFmt(p[1], 2), 'var(--accent-warning)');

  if(!b || !b.ok){
    h += satir('Kayış yolu', '— çözülemedi', 'var(--accent-danger)');
    h += '</div>';
    var sebep = (b && b.errors && b.errors.length) ? b.errors[0] : '';
    return h + (sebep
      ? _feadHint('<b style="color:var(--accent-danger);">' + _feadEsc(sebep) + '</b>')
      : _feadHint('Kayış yolu bu yerleşimle çözülemiyor.'));
  }

  h += satir('Serbest kol açısı (türedi)', _feadFmt(b.freeAngleDeg, 2) + '°');
  h += satir('Gereken KAYIŞ BOYU (çıktı)', _feadFmt(b.beltLengthMm, 1) + ' mm', 'var(--accent-warning)');
  if(Number.isFinite(b.springTensionN))
    h += satir('Tasarım gerginliği (türedi)', _feadFmt(b.springTensionN, 1) + ' N');
  h += veFeadPinRows(b.pin, satir);

  // ── OLANAKLI BANT: KAPI ─────────────────────────────────────────────────
  // Program açıyı SEÇMİYOR ama girilen açının fiziksel olarak kullanılabilir
  // olup olmadığını SÖYLÜYOR. Ölçüt kullanıcının kendi girdilerinden (kayış
  // tolerans+aşınma bandı, load stop, sarım); Gates verisi yok.
  var bant = null;
  try { bant = veFeadArmBand(b); } catch(e){ bant = null; }
  if(bant && bant.ok){
    h += satir(bant.userOk ? 'Kol açısı olanaklı bantta' : 'Kol açısı bandın DIŞINDA',
      (bant.userOk ? '✓ ' : '✗ ') + _feadFmt(bant.arcDeg, 0) + '° / 360° kullanılabilir',
      bant.userOk ? 'var(--accent-success)' : 'var(--accent-danger)');
  }
  h += '</div>';

  if(bant && bant.ok){
    if(!bant.userOk && bant.userWhy)
      h += _feadHint('<b style="color:var(--accent-danger);">Bu açı kullanılamaz:</b> '
        + _feadEsc(bant.userWhy) + '. Kayış servis ömrü boyunca kol bu yerleşimi '
        + 'taşıyamıyor — gövdenin montaj saatini değiştirin.');
    var fig = veFeadBandSVG(bant, 320, 132);
    if(fig) h += '<div style="margin:2px 0 8px;">' + fig + '</div>'
      + _feadHint('Eğri, kolun her montaj saatinde çıkan <b>gerginliği</b> gösterir; '
        + 'kırmızı taralı açılar fiziksel olarak kullanılamaz (servis aralığı sığmıyor, '
        + 'sarım çöküyor ya da load stop aşılıyor). Amber çizgi sizin açınız. '
        + '<b>Bu bir öneri değildir</b> — bandın hangi noktasının motor bloğunda '
        + 'kullanılabilir olduğunu program bilmez; şekil yalnız seçimin bedelini yazar.');
  } else if(bant && bant.note){
    h += _feadHint('<b style="color:var(--accent-warning);">' + _feadEsc(bant.note) + '</b>');
  }

  var not = _feadHint('Kol çalışma açısı <b>girilen</b> bir sayıdır ve program onu '
    + 'seçmez: avara merkezi verildikten sonra kayış yolu tamamen belirlidir, geriye '
    + 'kalan tek serbestlik derecesi gövdenin montajdaki saat konumudur ve o bir '
    + '<b>paketleme</b> kararıdır. Ölçüldü — 14 Gates sistemine karşı sekiz aday '
    + 'ölçütün en iyisi bile yalnız <b>2/14</b> sistemi ±5° içinde buluyor '
    + '(aci farkinin medyani 20,7°). Sebep ölçütün yanlış yeri seçmesi değil, '
    + '<b>hiçbir yeri seçememesi</b>: merkez sabitken çalışma noktasındaki kayış '
    + 'yolu kol açısından bağımsız (ölçüldü: 4,55e−13 mm) ve ölçüt eğrisi '
    + 'düzleşiyor — %1 platosu <b>2,1° → 24,1°</b>. Bu yüzden uydurulmuş bir '
    + 'varsayılan <b>konmuyor</b>.');
  not += veFeadPinNote(b.pin);
  if(b.warnings && b.warnings.length)
    not += _feadHint('<b style="color:var(--accent-warning);">' + _feadEsc(b.warnings[0]) + '</b>');
  return h + not;
}

// ═══════════════════════════════════════════════════════════════════════════
//  KOL AÇISI BANDI — ŞEKİL (`veFeadBandSVG`)
// ═══════════════════════════════════════════════════════════════════════════
//
// Yatay eksen kolun çalışma açısı, dikey eksen o açıdaki gerginlik. Fiziksel
// olarak kullanılamayan açılar taralı; kullanıcının noktası işaretli.
//
// BU BİR SEÇİCİ DEĞİL. Eğri bir "en iyi" göstermiyor — sadece seçimin bedelini
// gösteriyor. Bandın kendisi ~190° geniş (ölçüldü), yani karar hâlâ
// paketlemenin; şekil o kararı BİLGİYLE almayı sağlıyor.
//
// TEK ÜRETİCİ, İKİ ÇAĞRI YERİ: rapor da bunu çağırıyor (`opt.print` ile basım
// paletine geçerek). Raporun kendi kopyasını çizmesi, iki yüzeyin sessizce
// ayrışması demekti — `veFeadLayoutSVG`'de kurulmuş olan kalıbın aynısı.
//
// TEPE KIRPILIYOR VE BU YAZILIYOR: sarım sıfıra giderken T tekilleşiyor
// (ölçüldü: bir örnekte 5223 N). Kırpılmasaydı eğrinin okunur bölgesi tek bir
// piksele çökerdi. Kırpma çizgisi kesikli basılıyor ki "eğri burada bitiyor"
// sanılmasın.
function veFeadBandSVG(band, W, H, opt){
  opt = opt || {};
  if(!band || !band.ok || !band.samples || band.samples.length < 8) return '';
  var ok = band.samples.filter(function(x){ return x.ok && Number.isFinite(x.tensionN); });
  if(ok.length < 4) return '';
  var pr = !!opt.print;
  var C = pr ? { ink:'#1b1e24', grid:'#e4e6e9', mut:'#5a6270', ana:'#24425f',
                 uy:'#c8781e', kot:'#9c2b2b' }
             : { ink:'var(--text-primary)', grid:'var(--border-color)',
                 mut:'var(--text-muted)', ana:'var(--accent-primary)',
                 uy:'var(--accent-warning)', kot:'var(--accent-danger)' };
  var L = pr ? 58 : 42, R = 10, T = 10, B = pr ? 34 : 24;
  var x0 = -180, x1 = 180;
  var X = function(v){ return L + (v - x0) / (x1 - x0) * (W - L - R); };

  // Y TAVANI: kullanıcının noktasının 3 katı ya da bandın en büyüğü —
  // hangisi küçükse. Tekillik eğriyi ezmesin.
  var Tu = _feadNum(band.userTensionN, NaN);
  var Tmax = Math.max.apply(null, ok.map(function(x){ return x.tensionN; }));
  var tavan = Number.isFinite(Tu) ? Math.min(Tmax, Tu * 3) : Tmax;
  var kirpik = tavan < Tmax - 1e-6;
  var yMax = Math.ceil(tavan / 100) * 100 || 100;
  var Y = function(v){ return T + (1 - Math.min(v, yMax) / yMax) * (H - T - B); };

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img"'
    + ' aria-label="Kol çalışma açısına göre gerginlik ve olanaklı bant"'
    + ' style="display:block; width:100%; height:auto;">';
  // ızgara
  for(var g = 0; g <= 4; g++){
    var yv = yMax * g / 4, y = Y(yv);
    s += '<line x1="' + L + '" y1="' + y.toFixed(1) + '" x2="' + (W - R)
      + '" y2="' + y.toFixed(1) + '" stroke="' + C.grid + '" stroke-width="1"/>'
      + '<text x="' + (L - 5) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end"'
      + ' font-size="' + (pr ? 10 : 8) + '" fill="' + C.mut + '">' + Math.round(yv) + '</text>';
  }
  [-180, -90, 0, 90, 180].forEach(function(v){
    s += '<text x="' + X(v).toFixed(1) + '" y="' + (H - B + 12)
      + '" text-anchor="middle" font-size="' + (pr ? 10 : 8) + '" fill="' + C.mut + '">'
      + v + '</text>';
  });
  // KULLANILAMAYAN AÇILAR taralı
  var st = band.step;
  band.samples.forEach(function(x){
    if(x.ok) return;
    s += '<rect data-ve="band-block" x="' + X(x.deg - st / 2).toFixed(1) + '" y="' + T
      + '" width="' + Math.max(1, X(st) - X(0)).toFixed(1) + '" height="' + (H - T - B)
      + '" fill="' + C.kot + '" opacity="0.10"/>';
  });
  // T(θ) EĞRİSİ — YALNIZ KULLANILABİLİR AÇILAR, kopukluklar KORUNUYOR.
  //
  // `x.ok` KOŞULU ŞART: kullanılamaz örneklerin bir kısmının gerginliği YİNE DE
  // hesaplanmış oluyor (çalışma noktası çözülüp servis ucu çözülemediğinde —
  // AG00976'da 21 örnek). Yalnız `Number.isFinite(tensionN)`e bakmak onları da
  // çizerdi ve eğri taralı bölgenin İÇİNE uzanırdı: "burada bir gerginlik var"
  // diye okunur, oysa o açı kullanılamaz.
  //
  // ESKİ ATLAMA DALI KALDIRILDI (ölçüldü, ölü): örnekler 360°'yi bitişik
  // tarıyor, dolayısıyla iki olanaklı koşu arasında MUTLAKA bir olanaksız
  // örnek var ve kopmayı zaten aşağıdaki `else` yapıyor. Dal, örneklerin
  // seyrek olabildiği eski zarf çiziciden kalmıştı.
  var seg = [], segs = [];
  band.samples.forEach(function(x){
    if(x.ok && Number.isFinite(x.tensionN)){
      seg.push(X(x.deg).toFixed(1) + ',' + Y(x.tensionN).toFixed(1));
    } else if(seg.length){ segs.push(seg); seg = []; }
  });
  if(seg.length) segs.push(seg);
  segs.forEach(function(q){
    if(q.length > 1) s += '<polyline data-ve="band-curve" points="' + q.join(' ')
      + '" fill="none" stroke="' + C.ana + '" stroke-width="' + (pr ? 1.8 : 1.5) + '"/>';
  });
  if(kirpik)
    s += '<line data-ve="band-clip" x1="' + L + '" y1="' + Y(yMax).toFixed(1)
      + '" x2="' + (W - R) + '" y2="' + Y(yMax).toFixed(1) + '" stroke="' + C.mut
      + '" stroke-width="1" stroke-dasharray="3 3"/>';
  // KULLANICININ NOKTASI
  var u = _feadNum(band.userDeg, NaN);
  if(Number.isFinite(u)){
    var uu = ((u + 180) % 360 + 360) % 360 - 180, ux = X(uu);
    s += '<line data-ve="band-user" x1="' + ux.toFixed(1) + '" y1="' + T + '" x2="'
      + ux.toFixed(1) + '" y2="' + (H - B) + '" stroke="' + C.uy
      + '" stroke-width="1.4" stroke-dasharray="4 3"/>';
    if(Number.isFinite(Tu))
      s += '<circle cx="' + ux.toFixed(1) + '" cy="' + Y(Tu).toFixed(1) + '" r="'
        + (pr ? 4 : 3) + '" fill="' + C.uy + '"/>';
  }
  s += '<line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (H - B)
    + '" stroke="' + C.ink + '" stroke-width="1"/>'
    + '<line x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B)
    + '" stroke="' + C.ink + '" stroke-width="1"/>'
    + '<text x="' + ((L + W - R) / 2).toFixed(0) + '" y="' + (H - 2)
    + '" text-anchor="middle" font-size="' + (pr ? 11 : 8) + '" fill="' + C.mut + '">'
    + 'kol çalışma açısı [°]</text>'
    + '<text transform="translate(' + (pr ? 13 : 10) + ',' + (H / 2).toFixed(0)
    + ') rotate(-90)" text-anchor="middle" font-size="' + (pr ? 11 : 8) + '" fill="'
    + C.mut + '">gerginlik [N]</text>';
  s += '</svg>';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
//  PİM SATIRLARI — seçilen açının İMALAT karşılığı
// ═══════════════════════════════════════════════════════════════════════════
//
// Kol açısı bir girdi; atölyeye gidecek talimat ise "gövdeyi bu saate kuran
// pim nerede" sorusunun cevabı. İki okuyucu (kol künyesi ve avara hareketi) AYNI
// üreticiden besleniyor — ikinci bir kopya, iki yüzeyin sessizce ayrışması
// demek olurdu (bu modülün tekrar eden hata sınıfı).
//
// SAYI YOKSA SESSİZ KALINMIYOR: pim künyesi olmayan parçada satır YAZILIR ve
// sebebi söylenir. Sessiz bırakılsaydı okuyucu "bu gergide pim yok" sanardı —
// oysa pim var, ölçüsü bizde yok.
function veFeadPinRows(pin, satir){
  if(!pin) return '';
  if(!pin.ok)
    return satir('Konum pimi', '— ' + (pin.part || 'künye yok'), 'var(--text-muted)');
  return satir('Konum pimi · yarıçap', _feadFmt(pin.rMm, 2) + ' mm')
       + satir('Konum pimi · AÇI (imalat)', _feadFmt(pin.angleDeg, 2) + '°',
               'var(--accent-warning)');
}

function veFeadPinNote(pin){
  if(!pin) return '';
  if(!pin.ok)
    return _feadHint('<b>Konum pimi:</b> ' + _feadEsc(pin.reason) + ' Mekanizma genel '
      + '(merkezî cıvata + saati belirleyen bir konum pimi), ama pim yarıçapı ve '
      + 'ofseti PARÇAYA özgüdür ve uydurulmaz.');
  return _feadHint('<b>Seçilen açı böyle GERÇEKLENİYOR:</b> gövdeyi merkezî cıvata '
    + 'tutar, saatini <b>konum pimi</b> belirler. Pim deliği gövdede, kolun gövdeye '
    + 'göre çalışma konumu ise yayla sabit → aradaki açı bir <b>parça sabitidir</b> '
    + '(' + _feadEsc(pin.part) + ': ' + _feadFmt(pin.offsetDeg, 2) + '°). Yani '
    + '<b>pim açısı = kol açısı ' + (pin.offsetDeg < 0 ? '−' : '+') + ' '
    + _feadFmt(Math.abs(pin.offsetDeg), 2) + '°</b>. Kaynak: ' + _feadEsc(pin.src) + '.');
}

// ════════════════════════════════════════════════════════════════════════════
//  KAYIŞ ÖZELLİKLERİ PANELİ (iç topolojide tek kopya)
// ════════════════════════════════════════════════════════════════════════════
function getFeadBeltPropertiesHTML(node){
  if(!node.data) node.data = {};
  var html = '<div class="sw-panel">';
  // UYARILAR BU PANELDE DE BASILIR. `veFeadWarningBox` Kayış Yolu ve Çözücü
  // panellerinde vardı ama boyun OKUNDUĞU panelde yoktu: kol kenetlendiğinde
  // köprü sebebi adıyla yazıyor ("nominal çalışma açısı … aralığın dışında"),
  // kullanıcı ise o sayıyı burada, izsiz, "tedarikçiye verilecek boy" diye
  // okuyordu. Geçerlilik sınırı sonucun İÇİNDE taşınır — modülün kendi kuralı.
  try {
    var _b = (typeof veFeadBuildFromCanvas === 'function') ? veFeadBuildFromCanvas() : null;
    if(_b) html += veFeadWarningBox(_b);
  } catch(e){ /* yarım model paneli açmayı engellemez */ }
  // Profil + marka, çekirdeğin BELT_DB'sindeki hb/hr'yi seçer — kasnak
  // yarıçapları buradan türetildiği için künyenin en belirleyici iki alanı bu.
  var profiller = [['PK','PK'],['PJ','PJ'],['PH','PH'],['PL','PL'],['PM','PM']];
  var markalar = [['GATES','Gates'],['OPTIBELT','Optibelt'],['CONTITECH','ContiTech']];
  html += _feadCard('Profil ve Marka', 'h_b / h_r buradan gelir', 'var(--accent-warning)',
      _feadSelect(node, 'Profil', 'profile', profiller, 'PK')
    + _feadSelect(node, 'Marka', 'brand', markalar, 'GATES', veFeadBeltDbHint(node)));

  // ── BOY KİPİ ───────────────────────────────────────────────────────────
  // Kol açısı ile kayış boyu TEK serbestlik derecesini paylaşıyor; hangisinin
  // GİRDİ olduğu burada seçiliyor. Panel ile kanvas rozeti AYNI alanı okuyor
  // (veFeadBeltMode → node.data.lengthMode).
  var kip = (typeof veFeadBeltMode === 'function') ? veFeadBeltMode(node.data) : 'fixed';
  // ZARF KİPİ KAYIŞ KİPİNİ KİLİTLER. Gergi montaj koordinatından çözülüyorsa
  // kayış boyu yapısal olarak bir ÇIKTIDIR; seçiciyi açık bırakmak kullanıcıya
  // etkisi olmayan bir düğme sunmak olurdu — daha kötüsü, "SABİT" seçip
  // çözücünün serbest koştuğunu görmemek.
  var kilit = (typeof veFeadBeltModeLocked === 'function') && veFeadBeltModeLocked();
  if(kilit) kip = 'free';
  var serbest = (kip === 'free');
  html += _feadCard('Kayış Boyu', serbest ? 'tasarımdan HESAPLANIR' : 'katalogdan SEÇİLİR',
      serbest ? 'var(--accent-warning)' : 'var(--accent-primary)',
      (kilit
        ? '<div style="display:flex; align-items:center; gap:10px; margin-bottom:9px;">'
          + '<div style="flex:1; font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">'
          + 'Boy kipi</div><div style="width:150px; text-align:center; font-weight:700; '
          + 'font-size:var(--fs-body); color:var(--accent-warning);">SERBEST (kilitli)</div></div>'
          + _feadHint('Kasnak merkezleri ve gergi künyesi verildiğinde kol nominal yay '
            + 'yüküne oturuyor; kapanan kayış yolunun boyu o konumun <b>sonucudur</b> ve '
            + 'girdi olarak seçilemez.')
        : _feadSelect(node, 'Boy kipi', 'lengthMode', [
            ['fixed', 'Sabit — kayış seçilmiş'],
            ['free',  'Serbest — tasarımdan çıkar']
          ], kip))
    + _feadHint(serbest
        ? 'Gergi kolu <b>nominal yay yüküne</b> karşılık gelen açıya oturuyor '
          + '((M<sub>çalışma</sub> − M<sub>ön</sub>)/k) ve gereken kayış boyu oradan '
          + '<b>hesaplanıyor</b>. Tasarım yapıp kayışı sonra tedarik ediyorsanız bu kip. '
          + 'Kasnak konumunu değiştirdikçe gereken boy da değişir.'
        : 'Girilen boy kullanılıyor; gergi kolu kayış yolunu <b>o boya eşitleyen</b> açıya '
          + 'oturuyor ve gerginlik oradan çıkıyor. Elinizde belirli bir kayış varsa bu kip. '
          + 'Kayış bu yerleşime sığmıyorsa model yine çözülür — kol nominal açısına alınır '
          + 've <b>gereken boy</b> yazılır.'));

  html += _feadCard('Künye', '', 'var(--accent-warning)',
      _feadText(node, 'Tip / kod', 'beltType', 'ör. 8PK 1475HD')
    + _feadGrid(node, serbest ? [
        { key:'ribs',      label:'Kanal sayısı',        ph:'8', step:'1' },
        { key:'tolerance', label:'Tolerans ± [mm]',     ph:'6' },
        { key:'wearPct',   label:'Aşınma payı [oran]',  ph:'0.007', step:'0.0001' }
      ] : [
        { key:'ribs',      label:'Kanal sayısı',        ph:'8', step:'1' },
        { key:'effLength', label:'Efektif boy [mm]',    ph:'1475' },
        { key:'tolerance', label:'Tolerans ± [mm]',     ph:'6' },
        { key:'wearPct',   label:'Aşınma payı [oran]',  ph:'0.007', step:'0.0001' }
      ], 2)
    + (serbest ? veFeadDerivedLengthHTML(node) : '')
    + _feadHint('<b>Efektif boy</b> ISO 9981 boyudur — katalog adındaki sayının ta kendisi '
        + '(8PK<b>1715</b> → 1715 mm). <b>Aşınma payı</b> ORAN olarak girilir '
        + '(0.007 = %0.70). Konum tablosu bu üç sayıdan kurulur: Replace = L+tol+aşınma·L, '
        + 'Max = L+tol, Mean = L, Min = L−tol.'));

  // ── KAYIŞ TİPİNE BAĞLI ÇIKTILAR ANAHTARI ────────────────────────────────
  var _bdm = (typeof veFeadBeltDataMode === 'function')
    ? veFeadBeltDataMode(node.data) : 'none';
  var _kapali = (_bdm === 'none');
  html += _feadCard('Kayış Tipine Bağlı Çıktılar',
      _kapali ? 'KAPALI' : 'açık',
      _kapali ? 'var(--text-muted)' : 'var(--accent-success)',
      _feadSelect(node, 'Katalog sabitleriyle hesap', 'beltDataMode', [
        ['none', 'KAPALI — kayış henüz seçilmedi'],
        ['full', 'Açık — seçilen kayışın sabitleriyle hesapla']
      ], _bdm)
    + (_kapali
        ? _feadHint('Şu çıktılar <b>üretilmiyor</b>: '
            + _feadEsc((typeof VE_FEAD_BELT_DATA_OFF !== 'undefined'
                ? VE_FEAD_BELT_DATA_OFF : []).join(' · '))
            + '. Dördü de kayış katalogundan gelen sabitlere dayanıyor (efektif '
            + 'boy · birim kütle · yorulma sabitleri · tolerans/aşınma) ve kayış '
            + 'henüz seçilmemişken üretilen sayı bir <b>varsayım</b> olurdu.<br><br>'
            + '<b>Profil (PK/PJ/…) yine soruluyor</b> ve kapatılamaz: pitch '
            + 'yarıçapı <code>OD/2 + h<sub>b</sub></code>, yani teğet geometrisi '
            + 'profil sabitine dayanıyor (PK’da h<sub>b</sub> = 1,2 mm → merkez '
            + 'mesafelerinde 2,4 mm). Kapatılan şey profil değil, profilin '
            + '<b>katalog sonuçları</b>.')
        : _feadHint('Ömür, yorulma dağılımı, açıklık frekansları ve kol konum '
            + 'zarfı seçilen kayışın katalog sabitleriyle hesaplanıyor. '
            + 'Geçerlilik sınırları (B10 çap penceresi, yorulma modeli) sonucun '
            + 'kendi içinde yazılı.')));

  html += veFeadBeltCatalogCard(node, serbest);

  html += _feadCard('Malzeme', 'opsiyonel', 'var(--accent-success)',
      _feadGrid(node, [
        { key:'massPerRibKgM', label:'Kaburga başına kütle [kg/m]', ph:'0.0196', step:'0.0001' }
      ], 1)
    + _feadHint('Yalnız span frekansı için. Boş bırakılırsa katalog değeri kullanılır — ama '
        + 'Gates PK kataloğu 0.0144 kg/m/kaburga derken hem kesit tahmini hem de ölçülmüş '
        + 'frekans haritasından geri-hesap <b>0.0196</b> veriyor. Frekans önemliyse elle girin.'));
  html += '</div>';
  return html;
}

// ─── KATALOG KARTI ──────────────────────────────────────────────────────────
//
// Katalogun değeri bir boy listesi DEĞİL, o listeden birini seçmenin NE
// YAPACAĞI: kayış boyu değişince gergi kolu başka bir açıya oturuyor ve
// gerginlik onunla değişiyor. "1690 mı 1755 mi" sorusu ancak bu sayılarla
// cevaplanabilir; çıplak bir liste kullanıcıyı kendi başına bırakırdı.
//
// İKİ KÜME AYRI GÖSTERİLİYOR ve etiketli — biri gerçek bir STOK listesi
// (ISO 9982 / DIN 7867), öbürü otomotiv IZGARASI (bir kural). Tek listede
// karıştırmak "bunlar da stokta" sanılmasına yol açardı. Ölçülmüş sebep:
// BMC'nin kendi kayışı (8PK 1715) stok listesinde YOK — komşuları 1690 ve
// 1755, yani 65 mm'lik bir boşluk.
function veFeadBeltCatalogCard(node, serbest){
  // KATALOĞUN KENDİ sembolüne bakılıyor, köprününkine değil: köprü
  // (fead-model.js) her zaman yüklü ama katalog ayrı bir dosya. Yanlış sembolü
  // yoklamak, katalog eksikken paneli ReferenceError ile düşürüyordu.
  if(typeof veFeadBeltNearest !== 'function' || typeof veFeadBeltOptions !== 'function')
    return _feadCard('Katalog', '', 'var(--text-muted)',
      _feadHint('Kayış kataloğu yüklenmedi (js/fead-belts.js).'));
  var kaynak = (typeof VE_FEAD_BELT_LIB_SOURCE === 'string') ? VE_FEAD_BELT_LIB_SOURCE : '';

  var b = null;
  try { b = (typeof veFeadBuildFromCanvas === 'function') ? veFeadBuildFromCanvas() : null; }
  catch(e){ b = null; }
  var o = veFeadBeltOptions(b, { count: 3 });
  if(!o.ok)
    return _feadCard('Katalog', 'ISO 9982 / DIN 7867', 'var(--text-muted)',
      _feadHint(_feadEsc(o.error || 'Gereken boy henüz belli değil.')));

  var sut = function(t, w, al){
    return '<th style="padding:3px 5px; text-align:' + (al||'right') + '; width:' + w
      + '; font-size:var(--fs-micro); font-weight:600; color:var(--text-muted);'
      + ' border-bottom:1px solid var(--border-color); white-space:nowrap;">' + t + '</th>';
  };
  var h = '<div style="font-size:var(--fs-micro); color:var(--text-muted); margin:-3px 0 7px;">'
    + 'Gereken boy <b style="color:var(--accent-warning);">' + _feadFmt(o.targetMm, 2)
    + ' mm</b> — aşağıdaki boylardan birini seçerseniz gergi kolu ve gerginlik '
    + 'şu değerlere oturur.</div>';
  h += '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;'
    + ' font-family:ui-monospace, monospace; font-size:var(--fs-micro);">'
    + '<thead><tr>' + sut('Boy', '20%') + sut('Δ', '16%') + sut('Kod', '26%', 'left')
    + sut('Kol', '16%') + sut('Gerginlik', '22%') + '</tr></thead><tbody>';

  var satir = function(c, izgara){
    if(!c) return '';
    var f = c.fit || {};
    var vur = izgara ? ' background:var(--bg-input);' : '';
    // SIĞMAYAN ADAY: sayı değil HÜKÜM. Kenetlenmiş çözümün gerginliği
    // tekilliğe komşu ve fiziksel değil (bkz. veFeadBeltFit).
    var kol = (f.ok && f.fits) ? _feadFmt(f.relDeg, 2) + '°' : '—';
    var ger = (f.ok && f.fits && Number.isFinite(f.tensionN))
      ? _feadFmt(f.tensionN, 0) + ' N' : '—';
    var sig = !(f.ok && f.fits);
    if(sig){ kol = '<span style="color:var(--accent-danger);">sığmıyor</span>'; }
    return '<tr style="cursor:pointer;' + vur + (sig ? ' opacity:0.65;' : '') + '"'
      + ' onclick="veFeadPickBelt(\'' + node.id + '\',' + c.lengthMm + ')"'
      + ' title="Bu boyu seç (kip SABİT olur)">'
      + '<td style="padding:3px 5px; text-align:right; font-weight:700;">' + _feadFmt(c.lengthMm, 0) + '</td>'
      + '<td style="padding:3px 5px; text-align:right; color:var(--text-muted);">'
      + (c.deltaMm >= 0 ? '+' : '−') + _feadFmt(Math.abs(c.deltaMm), 1) + '</td>'
      + '<td style="padding:3px 5px; text-align:left;">' + _feadEsc(c.code)
      + (izgara ? ' <span style="color:var(--accent-warning);">◇</span>' : '') + '</td>'
      + '<td style="padding:3px 5px; text-align:right;">' + kol + '</td>'
      + '<td style="padding:3px 5px; text-align:right;">' + ger + '</td></tr>';
  };
  // Izgara adayı listeye SIRALI giriyor ama ayrı işaretli (◇).
  var hepsi = o.stock.slice();
  if(o.grid && !hepsi.some(function(x){ return x.lengthMm === o.grid.lengthMm; }))
    hepsi.push(o.grid);
  hepsi.sort(function(a, b){ return a.lengthMm - b.lengthMm; });
  hepsi.forEach(function(c){ h += satir(c, c.kind === 'grid'); });
  h += '</tbody></table></div>';

  h += _feadHint('<b>◇</b> otomotiv ızgarası (5 mm adım) — stok listesinde değil ama '
    + 'ısmarlanabilir; FEAD kayışları uygulama başına üretiliyor. İşaretsiz satırlar '
    + 'ISO 9982 / DIN 7867 <b>stok</b> boyları. Katalog bir KISIT DEĞİL: ara boy '
    + 'tedarik edilebilir, boyu elle de girebilirsiniz. Kaynak: ' + _feadEsc(kaynak) + '.');

  return _feadCard('Katalog', serbest ? 'gereken boya en yakınlar' : 'başka bir boy seçersem',
                   'var(--accent-primary)', h);
}

// Katalogdan boy seçmek KİPİ DE SABİTLER: seçilen boy bir GİRDİ, dolayısıyla
// serbest kipte kalmak kullanıcının seçimini sessizce yok saymak olurdu.
function veFeadPickBelt(nodeId, lengthMm){
  if(typeof nodes === 'undefined') return null;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || !_feadDefOf(node).isFeadBelt) return null;
  if(!node.data) node.data = {};
  var L = _feadNum(lengthMm, NaN);
  if(!Number.isFinite(L) || !(L > 0)) return null;
  node.data.effLength = L;
  node.data.lengthMode = 'fixed';
  if(typeof saveState === 'function') saveState();
  veFeadRefreshBadges();
  if(typeof veFeadRefreshLayoutCards === 'function') veFeadRefreshLayoutCards();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
  return L;
}

// SERBEST KİPTE BOY BİR OKUMA, ALAN DEĞİL — ama GÖRÜNMEK ZORUNDA.
//
// Alanı kaldırıp yerine hiçbir şey koymamak, kullanıcıyı "boy nereden geldi"
// sorusuyla baş başa bırakırdı; bu modülün kuralı türetilen her sayıyı
// okunabilir bir yerde göstermek (tasarım gerginliğinin "Algılanan Model"
// tablosunda görünmesiyle aynı gerekçe).
function veFeadDerivedLengthHTML(node){
  var b = null;
  try { b = (typeof veFeadBuildFromCanvas === 'function') ? veFeadBuildFromCanvas() : null; }
  catch(e){ b = null; }
  var deger = '—', not = 'Model henüz çözülemedi; kasnakları ve gergi künyesini tamamlayın.';
  var supheli = false;
  if(b && b.ok && Number.isFinite(b.beltLengthMm)){
    deger = _feadFmt(b.beltLengthMm, 2) + ' mm';
    var wp = b.workPoint || {};
    // ── BOY, KOLUN NOMİNALDE OTURDUĞU VARSAYIMIYLA ANLAMLI ────────────────
    //
    // Serbest kipin cevabı "kol yayın çalışma momentindeyken kayış yolu ne
    // kadar" sorusunun cevabı. Kol oraya OTURAMADIYSA çıkan sayı hâlâ bir
    // sayıdır ama "tedarikçiye verilecek boy" DEĞİLDİR. İki hâl var ve ikisi
    // de eskiden sessizdi — ÖLÇÜLDÜ:
    //   nominalFallback : künye eksik, kol aralığın ORTASINA düştü
    //                     (BMC/direct: 1717.32 yerine 1715.27 mm)
    //   atLimit         : nominal açı kolun erişemediği yerde, kol KENETLENDİ
    //                     (kArm ondalık kayması: 1754.94 mm, +39.7 mm)
    // İkisinde de panel "Tedarikçiye verilecek boy budur" diyordu.
    if(wp.nominalFallback){
      supheli = true;
      not = '<b>Gergi künyesi eksik.</b> Yay çalışma momenti (Spring Mean Load), ön yük ve '
          + 'yay sabitinden biri girilmediği için kolun NOMİNAL açısı türetilemedi; boy, kolun '
          + 'gezinme aralığının ORTASINDAN (kol ' + _feadFmt(b.relDeg, 3) + '°) hesaplandı. '
          + 'Bu sayı tedarikçiye verilecek boy DEĞİLDİR — künyeyi tamamlayın.';
    } else if(wp.atLimit){
      supheli = true;
      not = '<b>Kol nominal açısına oturamadı.</b> Boy, kolun kenetlendiği '
          + _feadFmt(b.relDeg, 3) + '° konumundan hesaplandı; nominal çalışma noktası bu '
          + 'yerleşimde erişilebilir değil. Sebebi aşağıdaki uyarılarda yazılı — '
          + 'düzeltilmeden bu boy ısmarlanmamalıdır.';
    } else {
      not = 'Kasnak koordinatları, çaplar ve gergi künyesinden hesaplandı '
          + '(kol ' + _feadFmt(b.relDeg, 3) + '°). Tedarikçiye verilecek boy budur; '
          + 'en yakın katalog boyunu seçerseniz kip SABİT olur ve kol biraz kayar.';
    }
  } else if(b && b.errors && b.errors.length){
    not = _feadEsc(b.errors[0]);
  }
  return '<div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">'
    + '<div style="flex:1; font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">'
    + 'Gereken efektif boy</div>'
    + '<div style="width:130px; text-align:center; font-family:ui-monospace, monospace;'
    + ' font-weight:700; font-size:var(--fs-body); color:'
    + (supheli ? 'var(--accent-danger)' : 'var(--accent-warning)') + ';">'
    + _feadEsc(deger) + (supheli ? ' ?' : '') + '</div></div>'
    + _feadHint(not);
}

// Seçili profil+marka için çekirdeğin katalogda tuttuğu değerleri göster —
// kullanıcı hangi h_b/h_r ile hesaplandığını görsün, tahmin etmesin.
function veFeadBeltDbHint(node){
  if(typeof FEADCore === 'undefined') return '';
  try {
    var bp = FEADCore.beltProps({ profile: (node.data.profile || 'PK'), brand: (node.data.brand || 'GATES') });
    return 'Katalog: h<sub>b</sub> = ' + bp.hb + ' mm · h<sub>r</sub> = ' + bp.hr + ' mm · '
      + 'kaburga adımı ' + bp.ribPitch + ' mm · min. kasnak çapı ' + bp.minPulleyDia + ' mm · '
      + 'maks. hız ' + bp.maxSpeedMs + ' m/s.';
  } catch(e){
    return '<span style="color:var(--accent-danger);">' + _feadEsc(veFeadTranslateError(e && e.message)) + '</span>';
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  KAYIŞIN YAY-UZUNLUĞU YÜRÜYÜŞÜ — çizimin ve animasyonun ORTAK tabanı
// ════════════════════════════════════════════════════════════════════════════
// Kayış yolu, ardışık parçaların (açıklık doğrusu → sarım yayı → …) kapalı bir
// zinciri. Diş sırası da, kasnak kollarının açısı da bu zincir üzerindeki YAY
// UZUNLUĞUNUN fonksiyonu; ikisini tek bir yürüyüşten üretmek animasyonun
// tutarlılığını YAPISAL yapıyor: kayış bir kasnağın üzerinde v hızıyla
// ilerlerken kasnağın kolları ω = v/r ile dönüyor, yani KAYMA gözle görünmez —
// çünkü aynı fazdan besleniyorlar, ayrı iki sayaçtan değil.
//
// mm DÜZLEMİNDE kalınır (ekran px'inde değil): işaret kuralları (diş normali,
// sarım yönü) mm düzleminde türetilmişti ve ty() y'yi çevirdiği için px'e
// taşımak bütün o kuralları yeniden işaretlemek olurdu. Bu modülde bir işaret
// kuralı ZATEN bir kez ters yazılmıştı (yay sweep bayrağı).
function _feadR(v){ return Math.round(v*100)/100; }

// mm → ekran dönüşümü tek nesnede: hem çizici hem animatör aynısını kullanır.
// (Animatör geometriyi değil, bu katsayıları JSON'dan okuyor.)
function _feadXform(s, offX, offY, minX, maxY){
  return { s: s, ox: offX, oy: offY, mx: minX, my: maxY,
           tx: function(x){ return offX + (x - minX)*s; },
           ty: function(y){ return offY + (maxY - y)*s; } };
}

// Kapalı kayış zinciri: her açıklık için bir doğru parçası, ardından o
// açıklığın VARDIĞI kasnağın sarım yayı. Sıra beltPath()'in çizdiği sırayla
// birebir aynı — iki ayrı sıra tutmak, dişlerin kayıştan kayması demekti.
function _feadBeltWalk(geom){
  var q = geom.pulleys, n = q.length, segs = [], toplam = 0;
  for(var i=0;i<n;i++){
    var sp = geom.spans[i], p = q[(i+1)%n];
    var dx = sp.Pj[0]-sp.Pi[0], dy = sp.Pj[1]-sp.Pi[1];
    var L = Math.sqrt(dx*dx + dy*dy) || 0;
    segs.push({ a:0, x:sp.Pi[0], y:sp.Pi[1],
                ux:(L ? dx/L : 1), uy:(L ? dy/L : 0), l:L });
    toplam += L;
    var R = p.rPitch, wrap = geom.wraps[(i+1)%n];
    segs.push({ a:1, cx:p.c[0], cy:p.c[1], r:R,
                a0:Math.atan2(sp.Pj[1]-p.c[1], sp.Pj[0]-p.c[0]),
                d:(p.d > 0 ? 1 : -1), l:R*wrap });
    toplam += R*wrap;
  }
  return { segs: segs, l: toplam };
}

// ════════════════════════════════════════════════════════════════════════════
//  DEFORMASYON NESNESİ — iki titreşim animasyonunun TEK mekanizması
// ════════════════════════════════════════════════════════════════════════════
// Çırpma ve mod şekli bambaşka iki olay ama çizim tarafında ikisi de aynı
// soruyu soruyor: "kayış zincirinin şu noktası nereye kaydı?" Bu yüzden tek bir
// nesne var ve üç çizici (kayış yolu, dişler, kollar) onu paylaşıyor:
//
//   def.disp(segIdx, t, seg) → [dx, dy]   mm cinsinden kayma
//   def.spin(arcIdx)         → ek açı     rad (yalnız kasnak kolları)
//
// İKİ ÇİZİCİ AYRI OLSAYDI dişler kayıştan kopardı — modülün bu hatayı bir kez
// ölçtüğü yer zaten burası (diş adımı / kapanış artığı notu yukarıda).
//
// def NULL ise davranış BİREBİR eski hâlidir; kapı testi bunu kilitliyor.
//
// mm DÜZLEMİNDE çalışılır (px'te değil): normal ve sarım yönü işaretleri mm
// düzleminde türetilmişti, px'e taşımak hepsini yeniden işaretlemek olurdu.

// walk parça indeksi → açıklık / kasnak eşlemesi. _feadBeltWalk sırayı
// "açıklık i, sonra kasnak i+1'in yayı" diye kuruyor; buradaki iki yardımcı o
// sıranın TEK yorumu olsun diye var (üç yerde ayrı ayrı çözülseydi biri
// kaçınılmaz olarak kayardı).
function _feadSegSpan(segIdx){ return (segIdx % 2 === 0) ? (segIdx/2) : -1; }
function _feadSegPulley(segIdx, n){
  return (segIdx % 2 === 1) ? (((segIdx - 1)/2 + 1) % n) : -1;
}

// Titreşim yükü + zaman → deformasyon nesnesi. tau EKRAN saniyesidir.
function _feadVibDef(vib, tau, walk){
  if(!vib) return null;
  var TWO = Math.PI*2, t = tau || 0;

  if(vib.kind === 'span'){
    // Açıklık çırpması: her açıklık KENDİ frekansıyla, yarım sinüs şeklinde,
    // kendi normali boyunca. Şekil v=0 yaklaşımıdır (yükün başındaki 2. sınır).
    var sp = vib.spans || [];
    return {
      disp: function(segIdx, tt, seg){
        var i = _feadSegSpan(segIdx);
        if(i < 0 || !sp[i] || !(seg.l > 0)) return null;
        var s = sp[i];
        var w = s.ampMm * Math.sin(Math.PI * tt / seg.l)
                        * Math.sin(TWO * s.fScreen * t + s.ph);
        return [-seg.uy * w, seg.ux * w];          // açıklığa dik
      },
      spin: null
    };
  }

  if(vib.kind === 'mode'){
    // Mod şekli. İKİ hareket üst üste biner:
    //   • her kasnak kendi özvektör açısı kadar döner (TAM — özvektörün kendisi)
    //   • gergi kolu pivotu etrafında döner, kasnağını da götürür (katı cisim
    //     yaklaşımı; teğet noktalarının kayması ihmal edilir, O(delta^2))
    // Kayış KASNAKTA KAYMAZ: yay üzerindeki her nokta kasnakla birlikte döner,
    // açıklıklar da iki ucunun kaymasını doğrusal taşır. Yalnız kolları
    // döndürüp kayışı yerinde bıraksaydık ekranda OLMAYAN bir kayma görünürdü —
    // V kaburgalı bir tahrikte en yanlış öğretilecek şey.
    var q = Math.sin(TWO * vib.screenHz * t);
    var d = vib.armRad * q;
    var ca = Math.cos(d), sa = Math.sin(d);
    var vx = vib.tenC[0] - vib.pivot[0], vy = vib.tenC[1] - vib.pivot[1];
    var off = [vib.pivot[0] + ca*vx - sa*vy - vib.tenC[0],
               vib.pivot[1] + sa*vx + ca*vy - vib.tenC[1]];
    var n = (vib.spin || []).length, ten = vib.tenIdx;
    var segs = (walk && walk.segs) ? walk.segs : [];
    // Kasnak p'nin yay parçası: walk sırası "açıklık i, kasnak i+1'in yayı".
    function arcOf(p){ return segs[((p - 1 + n) % n) * 2 + 1] || null; }
    // P noktası kasnak p ile birlikte dönerse ne kadar kayar?
    function rotDisp(p, px, py){
      var a = arcOf(p); if(!a) return [0, 0];
      var th = (vib.spin[p] || 0) * q;
      var c2 = Math.cos(th), s3 = Math.sin(th);
      var ex = px - a.cx, ey = py - a.cy;
      var dx = a.cx + c2*ex - s3*ey - px, dy = a.cy + s3*ex + c2*ey - py;
      if(p === ten){ dx += off[0]; dy += off[1]; }
      return [dx, dy];
    }
    return {
      armOff: off, armDelta: d, q: q, rotDisp: rotDisp,
      disp: function(segIdx, tt, seg){
        var p = _feadSegPulley(segIdx, n);
        if(p >= 0){                                  // kasnak yayı üstündeki nokta
          if(!(seg.r > 0)) return null;
          var th0 = seg.a0 + seg.d * (tt / seg.r);
          return rotDisp(p, seg.cx + seg.r*Math.cos(th0), seg.cy + seg.r*Math.sin(th0));
        }
        var i = _feadSegSpan(segIdx);
        if(i < 0 || !(seg.l > 0)) return null;
        // Açıklık: iki ucunun kayması doğrusal taşınır. Uçlar kasnakların
        // TEĞET noktaları olduğu için bu, açıklığın uzaması/kısalmasıdır.
        var A = rotDisp(i, seg.x, seg.y);
        var B = rotDisp((i + 1) % n, seg.x + seg.ux*seg.l, seg.y + seg.uy*seg.l);
        var u = tt / seg.l;
        return [A[0] + (B[0] - A[0])*u, A[1] + (B[1] - A[1])*u];
      },
      spin: function(arcIdx){
        var p = (arcIdx + 1) % n;
        return (vib.spin[p] || 0) * q;
      }
    };
  }
  return null;
}

// Kayış yolunu ZİNCİRDEN (walk) yeniden kurar. Donuk şemayı `beltPath(geom)`
// çiziyor; bu ise animatörün her karede yazdığı yol — deformasyon uygulanabilir
// olması için nokta nokta örneklenir.
//
// def yokken yay `A` komutuyla, deformasyon varken çokgen olarak çizilir:
// kaymış bir yay artık dairesel değildir ve `A` ile çizmek sessizce yanlış bir
// eğri verirdi.
var VE_FEAD_VIB_SPAN_PTS = 16;      // açıklık başına örnek (yarım sinüs pürüzsüz)
var VE_FEAD_VIB_ARC_RAD  = 0.14;    // yay örnekleme adımı [rad]
function _feadWalkPath(walk, T, def){
  var out = '', segs = walk.segs, n2 = segs.length, i, k, K, t, P;
  function put(cmd, x, y, dd){
    var px = x + (dd ? dd[0] : 0), py = y + (dd ? dd[1] : 0);
    out += cmd + _feadR(T.tx(px)) + ' ' + _feadR(T.ty(py));
  }
  for(i=0;i<n2;i++){
    var sg = segs[i];
    if(sg.a === 0){
      if(i === 0) put('M', sg.x, sg.y, def && def.disp(0, 0, sg));
      if(!def){ put(' L', sg.x + sg.ux*sg.l, sg.y + sg.uy*sg.l, null); continue; }
      K = VE_FEAD_VIB_SPAN_PTS;
      for(k=1;k<=K;k++){
        t = sg.l * k / K;
        put(' L', sg.x + sg.ux*t, sg.y + sg.uy*t, def.disp(i, t, sg));
      }
    } else {
      if(!(sg.r > 0)) continue;
      var wrap = sg.l / sg.r;
      if(!def){
        var aEnd = sg.a0 + sg.d * wrap;
        var R = _feadR(sg.r * T.s);
        out += ' A' + R + ' ' + R + ' 0 ' + (wrap > Math.PI ? 1 : 0) + ' '
             + (sg.d > 0 ? 0 : 1) + ' '
             + _feadR(T.tx(sg.cx + sg.r*Math.cos(aEnd))) + ' '
             + _feadR(T.ty(sg.cy + sg.r*Math.sin(aEnd)));
        continue;
      }
      K = Math.max(4, Math.ceil(wrap / VE_FEAD_VIB_ARC_RAD));
      for(k=1;k<=K;k++){
        t = sg.l * k / K;
        var th = sg.a0 + sg.d * (t / sg.r);
        put(' L', sg.cx + sg.r*Math.cos(th), sg.cy + sg.r*Math.sin(th), def.disp(i, t, sg));
      }
    }
  }
  return out + ' Z';
}

// DİŞ ADIMI ÇEVREYİ TAM BÖLER. Hedef adım (7 px) çevreye tam oturmadığı için
// kapanış noktasında bir artık kalır; şema donukken bu görünmez, ama faz
// ilerlerken o artık sabit bir noktada duran "diş sıkışması" olarak akıp
// giden kayışın üstünde tek bir tökezleme gibi okunur. Adımı çevreye
// bölünecek şekilde yuvarlamak dikişi tamamen kaldırıyor (BMC: hedef 12.66 mm
// → 135 diş → 12.70 mm, yani %0.3 sapma).
function _feadToothStep(loopLenMm, hedefMm){
  if(!(loopLenMm > 0) || !(hedefMm > 0)) return hedefMm || 1;
  return loopLenMm / Math.max(8, Math.round(loopLenMm / hedefMm));
}

// Diş sırası — faz kadar İLERLETİLMİŞ olarak.
//
// Yön kuralı değişmedi (bkz. aşağıdaki türetme): mm düzleminde ilerleme yönü u
// iken kaburgalı yüz normali rot90ccw(u)/sense. Değişen tek şey dişlerin
// NEREDE durduğu: eskiden her parça kendi fazından (adımın yarısı) başlıyordu,
// yani parça sınırlarında adım bozuluyordu; şimdi tek bir küresel yay
// uzunluğundan (σ ≡ faz, mod adım) çözülüyor. Faz artınca dişler kayış boyunca
// İLERİ (güzergâh yönünde) yürür — kayışın gerçek gidiş yönü.
// `def` (deformasyon) verilirse her dişin TABAN noktası kaydırılır — dişler
// kayışla birlikte bükülür. Verilmezse davranış birebir eski hâlidir.
function _feadTeethPath(walk, sense, stepMm, lenMm, phaseMm, T, def){
  var sn = (sense < 0) ? -1 : 1, out = '', sigma = 0;
  var step = (stepMm > 0) ? stepMm : 1;
  var faz = phaseMm || 0, eps = step * 1e-6;
  function rib(ux, uy){ return sn > 0 ? [-uy, ux] : [uy, -ux]; }
  function tooth(px, py, nx, ny, dd){
    var L = Math.sqrt(nx*nx + ny*ny) || 1;
    if(dd){ px += dd[0]; py += dd[1]; }
    out += 'M' + _feadR(T.tx(px)) + ' ' + _feadR(T.ty(py))
         + 'L' + _feadR(T.tx(px + nx/L*lenMm)) + ' ' + _feadR(T.ty(py + ny/L*lenMm));
  }
  walk.segs.forEach(function(sg, segIdx){
    // PARÇA SINIRI EPSİLONLA KAPANIR — yoksa diş SAYISI faz boyunca ±1 oynar.
    // Tam sınıra düşen bir diş, kayan noktada ya iki parçaya birden ya da
    // hiçbirine yazılır: ekranda bir dişin çevrimde bir kez yanıp sönmesi.
    // (Ölçüldü: 12 fazın birinde 141, kalanında 140 diş.) Sayaç da KATLA
    // ilerletilir, tekrarlı toplamayla değil — 140 adımda birikecek kayma
    // dişleri kayışın gerisinde bırakırdı.
    var t0 = ((faz - sigma) % step + step) % step;
    if(t0 > step - eps) t0 = 0;                       // ≈adım ⇒ aslında 0
    var m = Math.max(0, Math.ceil((sg.l - t0 - eps) / step)), q, t;
    if(sg.a === 0){
      var nb = rib(sg.ux, sg.uy);
      for(q = 0; q < m; q++){
        t = t0 + q*step;
        tooth(sg.x + sg.ux*t, sg.y + sg.uy*t, nb[0], nb[1],
              def && def.disp(segIdx, t, sg));
      }
    } else if(sg.r > 0){
      for(q = 0; q < m; q++){
        t = t0 + q*step;
        var th = sg.a0 + sg.d * (t / sg.r);
        var nb2 = rib(-sg.d*Math.sin(th), sg.d*Math.cos(th));
        tooth(sg.cx + sg.r*Math.cos(th), sg.cy + sg.r*Math.sin(th), nb2[0], nb2[1],
              def && def.disp(segIdx, t, sg));
      }
    }
    sigma += sg.l;
  });
  return out;
}

// ── KASNAK KOLLARI — dönüşün görünür işareti ───────────────────────────────
// Neden ÇEPERE DİŞ DEĞİL de kol: V kaburgalı kayış SÜRTÜNME ile çalışır,
// kasnak yüzeyindeki oluklar ÇEVRESELDİR (kayışla aynı yönde uzanır), diş
// değildir. Çepere radyal diş çizmek senkron (dişli) kayış resmi olurdu —
// yanlış bir mekanizma öğretirdi. Kol ise bir YÜZEY iddiası değil, nirengi
// işareti: sadece "bu kasnak şu hızda, şu yöne dönüyor" der.
//
// AÇI AYNI FAZDAN: θ(faz) = a0 + d·faz/r. Türevi d·(1/r), yani ω = d·v/r —
// kayışın o kasnak üzerindeki hızının ta kendisi. Dişlerle kolları ayrı
// sayaçlardan sürseydik ikisi zamanla ayrışır ve kayış kasnağın üstünde
// KAYIYORMUŞ gibi görünürdü (V kaburgalı bir tahrikte olmayan bir şey).
var VE_FEAD_SPOKE_N   = 3;      // kol sayısı
var VE_FEAD_SPOKE_IN  = 0.26;   // iç uç (yarıçap oranı)
var VE_FEAD_SPOKE_OUT = 0.86;   // dış uç
var VE_FEAD_SPOKE_MIN_PX = 9;   // bundan küçük kasnakta kol çizilmez (kalabalık)
// onlyArc verilirse YALNIZ o sarım yayının (o kasnağın) kolları üretilir —
// her kasnak kendi rol rengini taşıyan ayrı bir yol olsun diye. Sayım
// SEGMENTTEN yapılır, DOM sırasından değil.
// `def` verilirse kolların açısına mod şeklinin EK AÇISI eklenir ve kasnak
// merkezi (gergide kol hareketiyle) kayar.
function _feadSpokePath(walk, phaseMm, T, onlyArc, def){
  var out = '', faz = phaseMm || 0, arc = -1;
  var nArc = 0;
  walk.segs.forEach(function(g){ if(g.a === 1 && g.r > 0) nArc++; });
  walk.segs.forEach(function(sg){
    if(sg.a !== 1 || !(sg.r > 0)) return;
    arc++;
    if(onlyArc != null && arc !== onlyArc) return;
    if(sg.r * T.s < VE_FEAD_SPOKE_MIN_PX) return;
    var th0 = sg.a0 + sg.d * (faz / sg.r);
    if(def && def.spin) th0 += def.spin(arc);
    // Merkez yalnız gergide kayar (kol hareketi); kendi dönüşü merkezi oynatmaz.
    var cx = sg.cx, cy = sg.cy;
    if(def && def.rotDisp){
      var dd = def.rotDisp((arc + 1) % Math.max(1, nArc), sg.cx, sg.cy);
      cx += dd[0]; cy += dd[1];
    }
    for(var k=0;k<VE_FEAD_SPOKE_N;k++){
      var th = th0 + k * 2*Math.PI/VE_FEAD_SPOKE_N;
      var c = Math.cos(th), s2 = Math.sin(th);
      out += 'M' + _feadR(T.tx(cx + sg.r*VE_FEAD_SPOKE_IN*c)) + ' '
                 + _feadR(T.ty(cy + sg.r*VE_FEAD_SPOKE_IN*s2))
           + 'L' + _feadR(T.tx(cx + sg.r*VE_FEAD_SPOKE_OUT*c)) + ' '
                 + _feadR(T.ty(cy + sg.r*VE_FEAD_SPOKE_OUT*s2));
    }
  });
  return out;
}

// ── YÖN GÜLÜNÜN YERİ — kullanıcı taşıyabilir ───────────────────────────────
// Varsayılan yer sağ alt köşe ve o hâlde şemadan 54 px'lik bir SAĞ ŞERİT
// ayrılır (yoksa gül kayışın üstüne düşerdi). Kullanıcı gülü kendi eliyle bir
// boşluğa taşıdığında o şerit ARTIK AYRILMAZ — kartı daraltmanın önündeki en
// büyük engel oydu: 420 px'lik kartın 54 px'i, yani sekizde biri, yalnız dört
// sayı için duruyordu. Taşıma bir TERCİH bildirimi olduğu için yer açmayı da
// kullanıcıya devrediyor.
//
// Konum KESİR olarak saklanır (kart ölçüsünün oranı), piksel olarak değil:
// kart yeniden boyutlandırılınca gül aynı bağıl yerde kalır. Piksel saklansaydı
// kart daraldığı anda gül çerçevenin dışında kalırdı — kullanıcının asıl yapmak
// istediği şey tam olarak daraltmak.
var VE_FEAD_ROSE_W    = 54;   // varsayılan konumda ayrılan sağ şerit
var VE_FEAD_ROSE_HALF = 27;   // gülün merkezden dışa taşan yarı-genişliği
function veFeadCompassPlace(W, H, pos){
  var m = VE_FEAD_ROSE_HALF + 2;
  var fx = pos ? Number(pos.fx) : NaN, fy = pos ? Number(pos.fy) : NaN;
  if(!Number.isFinite(fx) || !Number.isFinite(fy))
    return { cx: W - VE_FEAD_ROSE_W/2 - 4, cy: H - VE_FEAD_ROSE_W/2 - 8, moved: false };
  // Kenetleme: gül her hâlükârda çerçevenin İÇİNDE kalır. Kart gülden de küçükse
  // (aşırı daraltma) merkeze oturur — yarısı dışarıda bir gül hiçbir şey demez.
  return {
    cx: (W < 2*m) ? W/2 : Math.min(Math.max(fx * W, m), W - m),
    cy: (H < 2*m) ? H/2 : Math.min(Math.max(fy * H, m), H - m),
    moved: true
  };
}

// Fare noktasını SVG kullanıcı birimine çevir. Birincil yol getScreenCTM:
// kartın kutusu ile viewBox'ı aynı en-boy oranında olsa da (letterbox yok),
// tuval ZOOM'lu olabiliyor ve CTM onu da kapsıyor. Kutu oranı yalnız yedek.
function _feadSvgPoint(svg, e){
  if(!svg || !e) return null;
  try {
    var m = svg.getScreenCTM && svg.getScreenCTM();
    if(m){
      if(typeof DOMPoint === 'function')
        return new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      if(svg.createSVGPoint){
        var sp = svg.createSVGPoint(); sp.x = e.clientX; sp.y = e.clientY;
        return sp.matrixTransform(m.inverse());
      }
    }
  } catch(err){ /* yedeğe düş */ }
  try {
    var rc = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    if(rc.width > 0 && rc.height > 0)
      return { x: (e.clientX - rc.left) / rc.width * vb.width,
               y: (e.clientY - rc.top)  / rc.height * vb.height };
  } catch(err2){ /* yok */ }
  return null;
}

// Gülü sürükle. Sürükleme boyunca DOM'a yalnız bir transform yazılır; kart
// ANCAK BIRAKILDIĞINDA yeniden kurulur. Her mousemove'da saveState çağırmak
// hem yirmi kat gereksiz çizim hem de undo yığınına yüzlerce ara adım demekti.
//
// mousedown DURDURULUR: kart bir kanvas düğümünün içinde ve düğüm mousedown ile
// sürüklenmeye başlıyor — durdurulmazsa gülü taşımaya çalışmak düğümü taşırdı
// (konum seçicisindeki kuralın aynısı).
function veFeadCompassDragStart(evt, nodeId){
  if(typeof document === 'undefined' || !evt) return false;
  if(evt.stopPropagation) evt.stopPropagation();
  if(evt.preventDefault) evt.preventDefault();
  var g = evt.currentTarget || evt.target;
  while(g && !(g.getAttribute && g.getAttribute('data-ve') === 'compass-group')) g = g.parentNode;
  if(!g) return false;
  var svg = g.ownerSVGElement;
  var vb = svg && svg.viewBox && svg.viewBox.baseVal;
  var bas = _feadSvgPoint(svg, evt);
  if(!bas || !vb || !(vb.width > 0) || !(vb.height > 0)) return false;

  var cx0 = parseFloat(g.getAttribute('data-cx')), cy0 = parseFloat(g.getAttribute('data-cy'));
  if(!Number.isFinite(cx0) || !Number.isFinite(cy0)) return false;
  var son = { x: cx0, y: cy0 }, tasindi = false;

  function tasi(e){
    var p = _feadSvgPoint(svg, e);
    if(!p) return;
    if(Math.abs(p.x - bas.x) > 1 || Math.abs(p.y - bas.y) > 1) tasindi = true;
    // Kenetleme sürükleme SIRASINDA uygulanır: bırakıldıktan sonra "gül nereye
    // gitti" sorusu doğmasın, kullanıcı sınırı çekerken görsün.
    var yer = veFeadCompassPlace(vb.width, vb.height, {
      fx: (cx0 + (p.x - bas.x)) / vb.width,
      fy: (cy0 + (p.y - bas.y)) / vb.height
    });
    son = { x: yer.cx, y: yer.cy };
    g.setAttribute('transform', 'translate(' + _feadR(son.x - cx0) + ',' + _feadR(son.y - cy0) + ')');
  }
  function birak(){
    document.removeEventListener('mousemove', tasi, true);
    document.removeEventListener('mouseup', birak, true);
    // HAREKETSİZ TIK HİÇBİR ŞEY YAZMAZ. İki sebep, ikisi de ölçüldü:
    // (1) Her mouseup'ta saveState çağırmak kartı yeniden kuruyor ve ÇİFT TIK
    //     olayı, ulaşacağı öğe artık DOM'da olmadığı için hiç ateşlenmiyordu —
    //     yani sıfırlama sessizce çalışmıyordu (gerçek tarayıcıda doğrulandı).
    // (2) Gülün üstüne yapılan her tık undo yığınına boş bir adım koyardı.
    if(!tasindi) return;
    veFeadSetChoice(nodeId, 'compassPos',
      { fx: Math.round(son.x / vb.width * 1e4) / 1e4,
        fy: Math.round(son.y / vb.height * 1e4) / 1e4 });
  }
  document.addEventListener('mousemove', tasi, true);
  document.addEventListener('mouseup', birak, true);
  return true;
}

// Çift tık → varsayılan yer (ve sağ şerit geri ayrılır). Alan SİLİNİR, sabit bir
// varsayılan yazılmaz: "taşındı mı" sorusunun tek cevabı alanın varlığı olsun.
function veFeadCompassReset(nodeId){
  if(typeof nodes === 'undefined') return false;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || !node.data || !node.data.compassPos) return false;
  delete node.data.compassPos;
  if(typeof saveState === 'function') saveState();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
  return true;
}

// ════════════════════════════════════════════════════════════════════════════
//  KAYIŞ YOLU (2D ŞEMA) — ARTIK ÇEKİRDEĞİN GEOMETRİSİYLE
// ════════════════════════════════════════════════════════════════════════════
// Şema, kayış çevresini KENDİ hesaplamaz: FEADCore.solveGeometry'nin ürettiği
// teğet noktalarını ve sarım yaylarını çizer. Fark önemsiz değil — çekirdek
// temas tarafına göre İŞARETLİ yarıçap kullanır, yani sırttan temas eden
// kasnakta kayış ters yönde sarar. Kendi çizimimiz bunu bilmiyordu ve AG00686'da
// sarım açılarını 37°'ye kadar yanlış veriyordu (bkz. dosya başındaki emeklilik
// notu). Ayrıca çekirdek çakışma ve sarım değişmezi denetimi de yapıyor:
// çözülemeyen bir yerleşim artık YANLIŞ ÇİZİM yerine AÇIK HATA veriyor.
//
// Ölçek: mm → görünüm. Kayış düzleminde +Y YUKARI (mühendislik çizimi),
// SVG'de y aşağı → çevrilir.
// opts:
//   .compass  yön gülü (0/90/180/270) — kayış düzleminin yönü
//   .pivot    gergi pivotunda artı + pivottan kasnak merkezine kol çizgisi
//   .arrows   her kasnakta dönüş yönü oku
//   .inline   kanvas kartı için: dış çerçeve/arkaplan yok, boy %100
// Varsayılan (opts verilmezse) hepsi AÇIK: tedarikçi sayfasının çıktısı da bu
// işaretleri taşıyor ve panelde de aynı dili konuşmak doğrusu.
// ── KAYIŞ YOLUNUN SVG YOLU — TEK ÜRETİCİ ──────────────────────────────────
//
// Çözülmüş geometriden (`FEADCore.geometryAt`) kayışın kapalı yolunu kuruyor:
// teğet doğrusu → sarım yayı → teğet doğrusu … İki tüketicisi var ve ikisi de
// AYNI yolu çizmek zorunda: yerleşim şeması (`veFeadLayoutSVG`, kart/rapor) ve
// sihirbazın kol açısı seçicisi. İkinci bir çizici sessizce ayrışırdı — biri
// sarım yönünü ötekinden başka okusa kullanıcı iki yüzeyde iki farklı kayış
// görürdü ve hangisinin doğru olduğunu söyleyecek bir şey olmazdı.
//
// `tx`/`ty` mm → görünüm dönüşümü, `sc` ölçek, `f` yuvarlayıcı: hepsi
// ÇAĞIRANDAN geliyor, çünkü iki yüzeyin kabı ve yakınlaştırması farklı.
function veFeadBeltPathD(g, tx, ty, sc, f){
  if(!g || !g.pulleys || !g.spans) return '';
  var q = g.pulleys, n = q.length, d = '';
  // BOŞ GEOMETRİ BOŞ YOL DEMEK, kapalı bir "Z" değil: `' Z'` bir yol dizesi
  // olarak DOĞRU görünür, tüketici onu çizmeye kalkar ve ekranda görünmeyen
  // ama VAR olan bir kayış üretilir — bu modülün sessiz sınıfı.
  if(!n || g.spans.length !== n) return '';
  for(var i = 0; i < n; i++){
    var sp = g.spans[i], p = q[(i + 1) % n], spN = g.spans[(i + 1) % n];
    if(i === 0) d += 'M' + f(tx(sp.Pi[0])) + ' ' + f(ty(sp.Pi[1]));
    d += ' L' + f(tx(sp.Pj[0])) + ' ' + f(ty(sp.Pj[1]));
    var R = f(p.rPitch * sc), wrap = g.wraps[(i + 1) % n];
    d += ' A' + R + ' ' + R + ' 0 ' + (wrap > Math.PI ? 1 : 0) + ' ' + (p.d > 0 ? 0 : 1)
       + ' ' + f(tx(spN.Pi[0])) + ' ' + f(ty(spN.Pi[1]));
  }
  return d + ' Z';
}

function veFeadLayoutSVG(build, W, H, opts){
  W = W || 320; H = H || 240;
  opts = opts || {};
  var wantCompass = (opts.compass !== false);
  var wantPivot   = (opts.pivot   !== false);
  var wantArrows  = (opts.arrows  !== false);
  if(!build || !build.ok || !build.sys || typeof FEADCore === 'undefined') return null;

  // HANGİ KOL KONUMU / KONUMLARI. Gergi kolu yay dengesinde duruyor; kayış
  // uzayıp kısaldıkça (tolerans + aşınma) kol dönüyor ve kayış yolu her konumda
  // BAŞKA bir eğri oluyor. Seçim model katmanında çözülür (veFeadPosSelection);
  // burada yalnız çizim var.
  var sel = (typeof veFeadPosSelection === 'function')
    ? veFeadPosSelection(build, opts.posMode || 'mean')
    : { primary: null, ghosts: [] };

  // ÇÖZÜCÜ HATASI YUTULMAZ. Kurulum geçerli olsa bile geometri çözülemeyebilir
  // (kayış hedef boyu erişilebilir aralığın dışında, kol sınıra dayandı…) ve
  // eskiden bu durumda kart yalnız "Kayış yolu henüz kurulamadı" diyordu —
  // yani kullanıcı NEDEN olduğunu göremiyordu. Sebep build üzerinde taşınıyor;
  // kart ve panel onu basıyor.
  function geomAt(rel){
    try { return FEADCore.tensionerState(build.sys, rel).geom; }
    catch(e){
      if(!build.geomError)
        build.geomError = (typeof veFeadTranslateError === 'function')
          ? veFeadTranslateError(e && e.message) : String(e && e.message || e);
      return null;
    }
  }
  var geom = sel.primary ? geomAt(sel.primary.relDeg) : null;
  if(!geom){                                     // konum tablosu kurulamadıysa
    geom = geomAt(FEADCore.meanRel ? FEADCore.meanRel(build.sys) : 0);
  }
  if(!geom) return null;

  // Hayalet konumların geometrisi (yalnız 'TÜMÜ' kipinde dolu).
  var hayalet = [];
  (sel.ghosts || []).forEach(function(r){
    var g = geomAt(r.relDeg);
    if(g) hayalet.push({ row: r, geom: g });
  });

  var ps = geom.pulleys;
  var minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  function sinirla(list){
    list.forEach(function(p){
      minX=Math.min(minX,p.c[0]-p.rPitch); maxX=Math.max(maxX,p.c[0]+p.rPitch);
      minY=Math.min(minY,p.c[1]-p.rPitch); maxY=Math.max(maxY,p.c[1]+p.rPitch);
    });
  }
  sinirla(ps);
  // HAYALETLER DE ÖLÇEĞE GİRER: gergi kasnağı konumlar arasında BMC'de 60 mm yol
  // alıyor. Sınırlara katılmazsa uç konumdaki daire çerçeveden taşar.
  hayalet.forEach(function(h){ sinirla(h.geom.pulleys); });
  // GERGİ PİVOTU DA ÖLÇEĞE GİRER: pivot çoğu düzende kasnak kümesinin dışında
  // kalıyor (BMC'de −259.94 mm, en soldaki kasnaktan 20 mm daha solda). Sınırlara
  // katılmazsa artı işareti çerçevenin dışına düşüp görünmez olur.
  var pv = wantPivot && build.sys.tensioner && build.sys.tensioner.pivot;
  if(pv){
    minX=Math.min(minX,pv[0]); maxX=Math.max(maxX,pv[0]);
    minY=Math.min(minY,pv[1]); maxY=Math.max(maxY,pv[1]);
  }
  // Yön gülü sağ altta yer istiyor; şema onun altına girmesin.
  var pad = 18;
  // ── SAĞ ŞERİT KOŞULLU: gül ÇİZİMİN ÜSTÜNE DÜŞÜYORSA ayrılır ────────────
  //
  // Eskiden kural şuydu: gül varsayılan yerindeyse 54 px'lik sağ şerit KOŞULSUZ
  // ayrılır. Bu, kartın sekizde birini dört sayı için ölü alan yapıyordu — ve
  // çoğu yerleşimde gereksiz: gül sağ ALT köşede duruyor, kayış yolunun sağ alt
  // köşesi ise sıklıkla BOŞ (BMC'de krank sağ değil ORTA-ALTTA).
  //
  // Yeni kural bir ÖLÇÜM: önce şerit AYRILMADAN ölçeklenir, sonra gülün kutusu
  // gerçekten çizilen şeylere (kasnak çemberleri · kayış açıklıkları · pivot)
  // çarpıyor mu diye bakılır. Çarpmıyorsa şerit hiç ayrılmaz.
  //
  // ÖLÇÜLDÜ (BMC örneği, 440×500 kart): şerit koşulsuzken şemaya 350 px kalıyor,
  // koşulluyken 404 px — %15.4 daha geniş çizim, ve gül çizime yaklaşıyor
  // (kullanıcının istediği tam olarak bu). Çarpışma varsa davranış BİREBİR
  // eskisi: şerit ayrılır, hiçbir şey kötüleşmez.
  //
  // Kullanıcı gülü ELİYLE taşımışsa şerit yine hiç ayrılmaz (moved) — o bir
  // TERCİH bildirimi ve yer açma sorumluluğu ona geçmiş demektir.
  var roseYer = wantCompass ? veFeadCompassPlace(W, H, opts.compassPos) : null;
  var ROSE = 0;
  var spanX = Math.max(1, maxX-minX), spanY = Math.max(1, maxY-minY);
  var s, offX, offY;
  function olcekle(padL, padR, padU, padD){
    var eW = W - padL - padR - ROSE, eH = H - padU - padD;
    s = Math.min(eW/spanX, eH/spanY);
    offX = padL + (eW - spanX*s)/2; offY = padU + (eH - spanY*s)/2;
  }
  olcekle(pad, pad, pad, pad);

  // ── ETİKET GENİŞLİĞİ DE ÖLÇEĞE GİRER ───────────────────────────────────
  // Kasnak adı merkezde ORTALANIR; "Alternatör (155 A)" 18 karakter, 9 px
  // yazıda ≈97 px, yani merkezden ±49 px. Küme kenara yakınsa ad çerçevenin
  // DIŞINA taşar — ÖLÇÜLDÜ (özet rapor, sayfa 1): 9 px dışarıda ve kırpılmış.
  // Sınır kutusu yalnız çemberleri sardığı için hata sayılardan görünmez,
  // yalnız çizimden; Şekil 1'de düzeltilen sınıfın aynısı.
  //
  // Ölçek ile etiket genişliği BİRBİRİNE BAĞLI (etiket px, sınır mm; ikisini
  // çözen `s`'nin kendisi sınırdan geliyor) → tek geçişte çözülemez. İKİ GEÇİŞ:
  // önce ölçek, sonra taşan payı kadar kenar payı büyütülüp yeniden ölçek.
  // İkinci geçiş `s`'yi küçültür, yani etiketler daha da daralır — yakınsama
  // tek adımda garanti.
  // GÖRÜNEN AD ÇAĞIRANDAN GELEBİLİR. Kanvas kartında tam ad okunur (kutu 420
  // px ve kullanıcı zaten kasnağı adıyla tanıyor); RAPORDA aynı ad şemayı
  // taşırıyor ve kayış yolunun üstüne biniyor — ÖLÇÜLDÜ: "Alternatör (155 A)"
  // çerçeveyi 10,4 px aşıyor, dört etiket kayışla çakışıyordu. Rapor kısa kodu
  // geçiyor; kod ↔ ad künyesi aynı sayfada duruyor.
  function gorAd(k){
    var a = opts.names && opts.names[k];
    return (a == null || a === '') ? geom.names[k] : String(a);
  }
  var etW = (typeof opts.labelWidth === 'function') ? opts.labelWidth : function(t, fs){
    return String(t == null ? '' : t).length * fs * 0.6;      // monospace/dar sans
  };
  function etiketPayi(){
    var solTas = 0, sagTas = 0, ustTas = 0;
    ps.forEach(function(p, k){
      var X = offX + (p.c[0] - minX) * s, Y = offY + (maxY - p.c[1]) * s;
      var R = p.rPitch * s, yari = etW(gorAd(k), 9) / 2;
      solTas = Math.max(solTas, 2 - (X - yari));
      sagTas = Math.max(sagTas, (X + yari) - (W - ROSE - 2));
      ustTas = Math.max(ustTas, 11 - (Y - R - 4));            // ad, çemberin ÜSTÜNDE
    });
    if(solTas <= 0.5 && sagTas <= 0.5 && ustTas <= 0.5) return;
    // Pay sınırlı: bir etiket şemanın yarısını yiyemez.
    var tavX = W * 0.22, tavY = H * 0.14;
    olcekle(pad + Math.min(Math.max(0, solTas), tavX), pad + Math.min(Math.max(0, sagTas), tavX),
            pad + Math.min(Math.max(0, ustTas), tavY), pad);
  }
  etiketPayi();

  // ── ŞERİT KARARI — ÖLÇÜMLE ────────────────────────────────────────────────
  // Gülün kutusu: HALF (27) yön etiketlerini (0/90/180/270, merkezden en fazla
  // 23 px) zaten kapsıyor; +3 px nefes payı.
  //
  // KUTU KOŞULSUZ, ŞERİT KOŞULLU — İKİ AYRI SORU, tek bayrağa bağlanamaz:
  //   "şerit ayırayım mı"  → taşınmış gülde HAYIR; yer açma sorumluluğu
  //                          kullanıcıya geçmiştir (eski kural, korunuyor).
  //   "etiket buraya girmesin" → taşınmış gülde de EVET; taşınmış gül de
  //                          ÇİZİLİYOR, üstelik kullanıcı onu şemanın tam
  //                          ortasına sürükleyebilir.
  // İkisi `!moved`e birden bağlanınca compassPos verilir verilmez gül etiket
  // engeli olmaktan çıkıyordu — yani tam da gülün çizimin içine girdiği durumda
  // koruma kapanıyordu.
  var roseKutu = roseYer ? {
    x0: roseYer.cx - VE_FEAD_ROSE_HALF - 3, x1: roseYer.cx + VE_FEAD_ROSE_HALF + 3,
    y0: roseYer.cy - VE_FEAD_ROSE_HALF - 3, y1: roseYer.cy + VE_FEAD_ROSE_HALF + 3
  } : null;
  var seritAdayi = !!(roseYer && !roseYer.moved);
  // ÇARPIŞMA ÖLÇÜTÜ SINIR KUTUSU DEĞİL, ÇİZİLEN ŞEYİN KENDİSİ. Sınır kutusu
  // kullanılsaydı BMC'de de çarpardı (kutunun sağ alt köşesi güle 0.5 px kalıyor)
  // ve şerit hiç kazanılmazdı — oysa orası BOŞ: krank sağda değil, ORTA-ALTTA.
  function _roseCarpti(){
    if(!seritAdayi || !roseKutu) return false;
    var T = _feadXform(s, offX, offY, minX, maxY);
    function kutuKesisir(x0,y0,x1,y1){       // doğru parçası ↔ gül kutusu
      var r = roseKutu;
      if(Math.max(x0,x1) < r.x0 || Math.min(x0,x1) > r.x1) return false;
      if(Math.max(y0,y1) < r.y0 || Math.min(y0,y1) > r.y1) return false;
      if((x0>=r.x0&&x0<=r.x1&&y0>=r.y0&&y0<=r.y1) || (x1>=r.x0&&x1<=r.x1&&y1>=r.y0&&y1<=r.y1)) return true;
      var dx=x1-x0, dy=y1-y0;
      function yan(x,y){ return dx*(y-y0) - dy*(x-x0); }
      var a=yan(r.x0,r.y0), b=yan(r.x1,r.y0), c=yan(r.x1,r.y1), d=yan(r.x0,r.y1);
      return !((a>0&&b>0&&c>0&&d>0) || (a<0&&b<0&&c<0&&d<0));
    }
    // Kasnak çemberi ↔ kutu: kutunun çembere en yakın noktası yarıçapın içindeyse.
    for(var i=0;i<ps.length;i++){
      var X = T.tx(ps[i].c[0]), Y = T.ty(ps[i].c[1]), R = ps[i].rPitch * s + 12;  // +ad payı
      var nx = Math.min(Math.max(X, roseKutu.x0), roseKutu.x1);
      var ny = Math.min(Math.max(Y, roseKutu.y0), roseKutu.y1);
      if((nx-X)*(nx-X) + (ny-Y)*(ny-Y) <= R*R) return true;
    }
    var sp = geom.spans || [];
    for(var j=0;j<sp.length;j++)
      if(kutuKesisir(T.tx(sp[j].Pi[0]), T.ty(sp[j].Pi[1]), T.tx(sp[j].Pj[0]), T.ty(sp[j].Pj[1]))) return true;
    // Gergi pivotu (artı işareti) ve KOLU (pivot → kasnak merkezi) da çizilen
    // şeyler. Kol bir DOĞRU PARÇASI: yalnız pivot noktasına bakmak, kutunun
    // kolun ORTASINDA kaldığı yerleşimde çarpışmayı kaçırırdı.
    if(pv){
      var px = T.tx(pv[0]), py = T.ty(pv[1]);
      if(px >= roseKutu.x0-8 && px <= roseKutu.x1+8 && py >= roseKutu.y0-8 && py <= roseKutu.y1+8) return true;
      var _ti = build.sys._tenIdx, _tp = (_ti >= 0 && ps[_ti]) ? ps[_ti] : null;
      if(_tp && kutuKesisir(px, py, T.tx(_tp.c[0]), T.ty(_tp.c[1]))) return true;
    }
    // Hayalet konumların kayış yolları da görünür.
    for(var h=0;h<hayalet.length;h++){
      var hs = hayalet[h].geom.spans || [];
      for(var m=0;m<hs.length;m++)
        if(kutuKesisir(T.tx(hs[m].Pi[0]), T.ty(hs[m].Pi[1]), T.tx(hs[m].Pj[0]), T.ty(hs[m].Pj[1]))) return true;
    }
    return false;
  }
  if(_roseCarpti()){
    ROSE = VE_FEAD_ROSE_W;
    olcekle(pad, pad, pad, pad);
    etiketPayi();
  }
  // ── ETİKET YERLEŞİMİ — KAYIŞ YOLU BİR ENGELDİR ─────────────────────────
  // Ad şimdiye kadar koşulsuz çemberin ÜSTÜNE konuyordu. Yerleşim dairesel
  // olduğu için kasnakların yarısında kayış tam oradan geçiyor: ÖLÇÜLDÜ
  // (AG00976, 480×420) dört etiket kayış yolunun üstüne biniyordu ve hangi
  // sayının hangi kasnağa ait olduğu okunmuyordu.
  //
  // Aday sıralaması ÜST → ALT → SAĞ → SOL: üst, teknik resimde alışılmış yer;
  // yan adaylar ancak dikey iki yer de doluysa kullanılıyor, çünkü yandaki
  // etiket komşu kasnağın alanına giriyor. İlk TEMİZ aday seçilir; hiçbiri
  // temiz değilse üste dönülür (etiket kaybolmaz, yalnız çakışır).
  var _etiket = [];
  (function(){
    var T0 = _feadXform(s, offX, offY, minX, maxY);
    var segler = [];
    (geom.spans || []).forEach(function(sp){
      segler.push([T0.tx(sp.Pi[0]), T0.ty(sp.Pi[1]), T0.tx(sp.Pj[0]), T0.ty(sp.Pj[1])]);
    });
    function kesisir(seg, r){                       // doğru parçası ↔ dikdörtgen
      var x1=seg[0], y1=seg[1], x2=seg[2], y2=seg[3];
      if(Math.max(x1,x2) < r.x0 || Math.min(x1,x2) > r.x1) return false;
      if(Math.max(y1,y2) < r.y0 || Math.min(y1,y2) > r.y1) return false;
      if((x1>=r.x0&&x1<=r.x1&&y1>=r.y0&&y1<=r.y1) || (x2>=r.x0&&x2<=r.x1&&y2>=r.y0&&y2<=r.y1)) return true;
      var dx=x2-x1, dy=y2-y1;
      function yan(x,y){ return dx*(y-y1) - dy*(x-x1); }
      var a=yan(r.x0,r.y0), b=yan(r.x1,r.y0), c=yan(r.x1,r.y1), d=yan(r.x0,r.y1);
      return !((a>0&&b>0&&c>0&&d>0) || (a<0&&b<0&&c<0&&d<0));
    }
    function ortusur(a, b){
      return !(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1);
    }
    // GÜL DE BİR ENGEL. Şerit artık koşullu olduğu için etiket, gülün durduğu
    // sağ alt köşeye girebiliyor; girerse yön etiketleri (0/90/180/270) ile üst
    // üste biner. Engel listesine konunca yerleştirici oraya hiç bakmıyor.
    // TAŞINMIŞ GÜL DE ENGELDİR (yukarıdaki `roseKutu` notu): engeli `!moved`e
    // bağlamak, kullanıcı gülü şemanın ortasına sürüklediğinde etiketlerin
    // tam onun altına düşmesi demekti.
    var kutular = roseKutu ? [roseKutu] : [];
    ps.forEach(function(p, k){
      var X = offX + (p.c[0]-minX)*s, Y = offY + (maxY-p.c[1])*s, R = p.rPitch*s;
      var w = etW(gorAd(k), 9), h = 10;
      var aday = [
        { x:X,        y:Y-R-4,      an:'middle', x0:X-w/2,  x1:X+w/2,  y0:Y-R-4-8,   y1:Y-R-4+2 },
        { x:X,        y:Y+R+11,     an:'middle', x0:X-w/2,  x1:X+w/2,  y0:Y+R+11-8,  y1:Y+R+11+2 },
        { x:X+R+5,    y:Y+3,        an:'start',  x0:X+R+5,  x1:X+R+5+w, y0:Y-5,      y1:Y+5 },
        { x:X-R-5,    y:Y+3,        an:'end',    x0:X-R-5-w, x1:X-R-5, y0:Y-5,       y1:Y+5 }
      ];
      var sec = null;
      for(var i=0;i<aday.length && !sec;i++){
        var a = aday[i];
        if(a.x0 < 1 || a.x1 > W-ROSE-1 || a.y0 < 1 || a.y1 > H-1) continue;
        var carpti = false;
        for(var j=0;j<segler.length && !carpti;j++) if(kesisir(segler[j], a)) carpti = true;
        for(var m=0;m<kutular.length && !carpti;m++) if(ortusur(kutular[m], a)) carpti = true;
        if(!carpti) sec = a;
      }
      if(!sec) sec = aday[0];
      kutular.push(sec); _etiket.push(sec);
    });
  })();

  // mm → ekran dönüşümü TEK NESNEDE (_feadXform): animatör de kare başına aynı
  // katsayıları kullanıyor. İki ayrı dönüşüm tutmak, hareket eden dişlerin
  // duran kayıştan kayması demekti.
  var T = _feadXform(s, offX, offY, minX, maxY);
  function tx(x){ return T.tx(x); }
  function ty(y){ return T.ty(y); }
  var f = _feadR;

  // Kayış yolu: çekirdeğin teğet uçları (Pi/Pj) + her kasnakta sarım yayı.
  //
  // SWEEP BAYRAĞI — bir kez YANLIŞ yazıldı, gözle "bükülmüş kayış" olarak
  // görüldü ve ölçülerek düzeltildi. Kural:
  //   ty(y) = offY + (maxY − y)·s  ölçeklemesi mm düzlemini EKRANDA AYNI YÖNDE
  //   gösterir (mm yukarısı ekran yukarısı) — yani yönelim KORUNUR, dönmez.
  //   SVG'nin açı sistemi ise y-AŞAĞI: pozitif açı yönü görsel olarak SAAT
  //   YÖNÜ demek. Dolayısıyla mm düzleminde CCW olan (d > 0) ekranda da CCW
  //   görünür ve SVG'de NEGATİF yön, yani sweep = 0.
  // Eskiden sweep = (d > 0 ? 1 : 0) yazıyordu: yarıçap ve uçlar doğru olduğu
  // için yay yine iki uca değiyordu ama AYNALANMIŞ çemberin üzerinde kalıyordu,
  // yani kasnağın İÇİNDEN geçiyordu. ÖLÇÜLDÜ (BMC örneği, 420×320): yay
  // merkezleri kasnak merkezlerinden 6.7–42.7 px sapıyordu; düzeltmeyle altı
  // kasnakta da sapma 0.00. Testi bu değişmezi kilitliyor (yayın merkezi
  // kasnağın merkezi olmak ZORUNDA).
  //
  // TEK FONKSİYON: hayalet konumlar da aynı yoldan çizilir, yoksa iki ayrı
  // çizici sessizce ayrışırdı.
  function beltPath(g){ return veFeadBeltPathD(g, tx, ty, s, f); }
  // ── KAYIŞIN KABURGALI YÜZÜ — hangi kasnağa hangi yüzüyle değiyor ────────
  // Temas tarafı bu modülün en pahalı sessiz hatası: ters verilirse çekirdek
  // GEÇERLİ ama BAŞKA bir güzergâh çözer, hata vermez. Şemada bunu şimdiye
  // kadar yalnız kasnağın kesikli çemberi söylüyordu — bir UZLAŞIM, yani
  // öğrenilmesi gereken bir kod. Oysa fark gerçek ve çizilebilir: kayışın bir
  // yüzü kaburgalı, öbürü düz sırt. Diş sırası o yüzü işaretler; kaburgalı
  // yüze değen kasnakta dişler kasnağın İÇİNE, sırttan temas edende DIŞARI
  // bakar. Kullanıcı artık kodu değil parçayı görüyor.
  //
  // Yön TEK BİR YERDEN çözülür ve sabittir: kayış kendi yüzlerini yol boyunca
  // değiştiremez. mm düzleminde ilerleme yönü u iken kaburgalı yüz normali
  // rot90ccw(u)/sense'tir (sense = çevrimin dönüş yönü, çekirdekten gelir).
  // Türetme: kaburgalı bir kasnakta d = +sense ve teğet u = d·(−sinθ, cosθ)
  // olduğundan rot90ccw(u) = d·(−cosθ, −sinθ) = d · (merkeze doğru).
  // Sırttan temas edende d = −sense, dolayısıyla aynı normal kasnaktan UZAĞA
  // bakar — istenen tam olarak bu.
  //
  // Diş sırasının kendisi dosyanın üstündeki _feadTeethPath'te: ANİMATÖR DE
  // aynı fonksiyondan besleniyor, yani hareket eden kayışla duran kayış tek
  // çiziciden çıkıyor. Adım, çevreyi tam bölecek şekilde yuvarlanır
  // (_feadToothStep) — donuk şemada görünmeyen kapanış artığı, faz ilerlerken
  // sabit bir noktada duran tek bir tökezleme olarak okunurdu.
  var walk = _feadBeltWalk(geom);
  var stepMm = _feadToothStep(walk.l, 7/s), toothMm = 3.2/s;

  // DONUK KARE, ANİMASYONUN İLK KARESİDİR. Çırpmada açıklıklar arasında faz
  // kayması var (hepsi aynı anda tepeye çıksaydı kayış nefes alıyor gibi
  // görünürdü), dolayısıyla t=0'da deformasyon SIFIR DEĞİL. Donuk şema
  // deformasyonsuz çizilseydi animasyon başlarken kayış görünür biçimde
  // sıçrardı — ve `prefers-reduced-motion` açık kullanıcı hiç titreşim
  // GÖRMEZDİ. Şimdi o kullanıcı sapmış şekli durağan olarak görüyor; mod
  // şeklinde bu zaten ders kitabı gösterimidir.
  // (Mod şeklinde t=0'da q = sin(0) = 0, yani bu dal etkisiz kalır.)
  var vibDef = opts.vib ? _feadVibDef(opts.vib, 0, walk) : null;

  var d = vibDef ? _feadWalkPath(walk, T, vibDef) : beltPath(geom);

  // ── ANİMASYON YÜKÜ — animatörün kare başına ihtiyaç duyduğu HER ŞEY ──────
  // Kart her saveState()'te innerHTML ile BAŞTAN kuruluyor (alan değişti,
  // bağlantı kuruldu, düğüm silindi…). Animatör bu yüzden DOM'da durum tutmaz:
  // her karede öğeyi bulur ve bu yükü okur, dolayısıyla yeniden kurulma
  // zararsızdır. Yük yalnız SAYIDIR — dönüşüm katsayıları, kayış zinciri (mm)
  // ve ekrandaki hız; geometriyi kare başına yeniden çözmek çözücüyü 60 Hz
  // koşturmak olurdu.
  //
  // TİTREŞİM DE BU YÜKTEN SÜRÜLÜR. Kayış durgunken (mod şekli) mmS = 0 olur ama
  // yük yine üretilir: animatörün çalışması için gereken şey artık "kayış akıyor
  // mu" değil, "kare başına yazacak bir şey var mı".
  var animPay = null;
  var _akis = !!(opts.animate && opts.animate.dispMmS > 0);
  if(_akis || opts.vib || opts.scn){
    var r4 = function(v){ return Math.round(v*1e4)/1e4; };
    animPay = {
      s: r4(s), ox: r4(offX), oy: r4(offY), mx: r4(minX), my: r4(maxY),
      step: r4(stepMm), tooth: r4(toothMm), sense: (geom.sense < 0 ? -1 : 1),
      loop: r4(walk.l), mmS: _akis ? r4(opts.animate.dispMmS) : 0,
      vib: opts.vib || null,
      // SENARYO: devir zamanın fonksiyonu, dolayısıyla kayış hızı da öyle.
      // `slow` ağır çekim katsayısı; animatör kare başına mmS'i
      //   beltMs(t)·1000·slow
      // diye kendisi kuruyor — sabit bir mmS senaryoda yanlış olurdu.
      scn: opts.scn ? _feadScnSlim(opts.scn) : null,
      slow: (opts.animate && opts.animate.slow > 0) ? r4(opts.animate.slow) : 0,
      segs: walk.segs.map(function(sg){
        return (sg.a === 0)
          ? { a:0, x:r4(sg.x), y:r4(sg.y), ux:r4(sg.ux), uy:r4(sg.uy), l:r4(sg.l) }
          : { a:1, cx:r4(sg.cx), cy:r4(sg.cy), r:r4(sg.r), a0:r4(sg.a0), d:sg.d, l:r4(sg.l) };
      })
    };
  }
  // ── YÜK ARTIK METİN DE TAŞIYOR — ATTRIBUTE KAÇIŞLANMAK ZORUNDA ──────────
  // Burada eskiden şu yazıyordu: "JSON yalnız sayı ve sabit anahtar taşıdığı
  // için TEK TIRNAKLI attribute içinde güvenli (içinde tek tırnak geçemez)."
  // Senaryo geldiğinde o ilan YANLIŞ hâle geldi: faz adları, açıklık adları ve
  // notlar metin ve Türkçe metinde kesme işareti geçiyor ("MFSim'de").
  // ÖLÇÜLDÜ (gerçek tarayıcı): tek tırnak attribute'ü 7573. karakterde kapattı,
  // JSON.parse "Unterminated string" attı ve animasyon SESSİZCE hiç kurulmadı —
  // kart donuk kaldı, konsola tek satır düşmedi.
  //
  // Çare tırnağı değiştirmek DEĞİL (aynı tuzağın aynası olurdu): çift tırnak
  // + `_feadEsc`, yani & < > " kaçışlanıyor ve `getAttribute` okurken geri
  // çözüyor. Böylece yükün ne taşıdığı artık bir varsayım olmaktan çıkıyor.
  var animAttr = animPay
    ? ' data-fead-anim="' + _feadEsc(JSON.stringify(animPay)) + '"'
      + (opts.nodeId ? ' data-fead-node="' + _feadEsc(opts.nodeId) + '"' : '')
    : '';

  // ÖLÇÜ SINIRI ŞART: panel iki sütuna geçtiğinde (VE_WIDE_PANEL_TYPES) yalnız
  // width:100% veren bir viewBox'lı SVG en-boy oranıyla birlikte YÜKSELİR ve
  // pencerenin altından taşarak kırpılır (ölçüldü). max-width bunu keser.
  var kabuk = opts.inline
    ? '<svg' + animAttr + ' viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" style="display:block; width:100%; height:100%;">'
    : '<svg' + animAttr + ' viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block; width:100%; max-width:'
      + W + 'px; margin:0 auto; background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
  var svg = kabuk;

  // GERGİ KOLU: pivot → kasnak merkezi. Kol boyu ve montaj açısı bu çizgi;
  // yanlış girilmiş bir pivot burada gözle görünür (kol kayışa ters uzanır).
  if(pv){
    var ti = build.sys._tenIdx;
    var tp = (ti >= 0 && ps[ti]) ? ps[ti] : null;
    if(tp){
      svg += '<line data-ve="arm" x1="' + f(tx(pv[0])) + '" y1="' + f(ty(pv[1])) + '" x2="' + f(tx(tp.c[0]))
          + '" y2="' + f(ty(tp.c[1])) + '" stroke="var(--accent-success)" stroke-width="1.6"'
          + ' stroke-dasharray="5 3" opacity="0.85"/>';
    }
    var px = f(tx(pv[0])), py = f(ty(pv[1])), a = 6;
    svg += '<g data-ve="pivot" stroke="var(--accent-success)" stroke-width="1.8">'
        + '<line x1="' + f(px-a) + '" y1="' + py + '" x2="' + f(px+a) + '" y2="' + py + '"/>'
        + '<line x1="' + px + '" y1="' + f(py-a) + '" x2="' + px + '" y2="' + f(py+a) + '"/></g>';
  }

  // HAYALET KONUMLAR — ana yolun ARKASINDA, ince ve soluk. Referans tedarikçi
  // çıktısındaki üst üste binmiş kayış yolları bunlar: kolun gezdiği aralık.
  var tiG = build.sys._tenIdx;
  hayalet.forEach(function(h){
    svg += '<path data-ve="belt-ghost" d="' + beltPath(h.geom) + '" fill="none"'
        + ' stroke="var(--text-muted)" stroke-width="1.1" stroke-linejoin="round" opacity="0.5"/>';
    var gp = (tiG >= 0) ? h.geom.pulleys[tiG] : null;
    if(gp){
      var GX = f(tx(gp.c[0])), GY = f(ty(gp.c[1])), GR = f(gp.rPitch*s);
      svg += '<circle data-ve="pulley-ghost" cx="' + GX + '" cy="' + GY + '" r="' + GR
          + '" fill="none" stroke="var(--text-muted)" stroke-width="1.1"'
          + ' stroke-dasharray="3 3" opacity="0.6"/>'
        + '<circle cx="' + GX + '" cy="' + GY + '" r="1.4" fill="var(--text-muted)" opacity="0.7"/>';
      // ETİKET PİVOTTAN DIŞA DOĞRU. Konumlar pivot çevresinde bir YAY üzerinde
      // dizildiği için radyal yerleşim onları kendiliğinden yelpazeler; sabit
      // "solda" yerleşimde üç etiket üst üste biniyordu (ölçüldü — gergi bu
      // düzende yalnız ~25 px yol alıyor).
      var lx = GX - GR - 4, ly = GY + 3, anc = 'end';
      if(pv){
        var vx = tx(gp.c[0]) - tx(pv[0]), vy = ty(gp.c[1]) - ty(pv[1]);
        var vl = Math.sqrt(vx*vx + vy*vy);
        if(vl > 1){
          lx = f(tx(gp.c[0]) + vx/vl * (gp.rPitch*s + 10));
          ly = f(ty(gp.c[1]) + vy/vl * (gp.rPitch*s + 10) + 2.5);
          anc = (vx >= 0) ? 'start' : 'end';
        }
      }
      // HAYALET ETİKETİ KAPATILABİLİR. Kanvas kartında gerekli: orada kolun
      // hangi konumda olduğunu söyleyen başka bir yüzey yok. RAPORDA gereksiz
      // ve zararlı — konumların adı zaten hemen yanındaki tabloda, 395 px'lik
      // küçük bir şemada ise altı etiket üst üste biniyor (ÖLÇÜLDÜ: "Serbest"
      // ile "Değişt." 104 px² çakışıyordu). Tedarikçi çıktısı da zarfı
      // etiketsiz çiziyor.
      if(opts.ghostLabels !== false)
        svg += '<text data-ve="ghost-label" x="' + lx + '" y="' + ly
            + '" text-anchor="' + anc + '" font-size="7" fill="var(--text-muted)" opacity="0.9">'
            + _feadEsc(h.row.kisa) + '</text>';
    }
  });

  svg += '<path data-ve="belt" d="' + d + '" fill="none" stroke="var(--accent-warning)" stroke-width="2.6" stroke-linejoin="round"/>';
  // Dişler kayışın ÜSTÜNE çizilir (yolun kendisi altta kalsın) ve YALNIZ ana
  // konumda: hayalet yollarda diş sırası okunmaz, yalnız gürültü olurdu.
  svg += '<path data-ve="rib" d="' + _feadTeethPath(walk, geom.sense, stepMm, toothMm, 0, T, vibDef) + '" fill="none"'
      + ' stroke="var(--accent-warning)" stroke-width="1" stroke-linecap="round" opacity="0.9">'
      + '<title>Kayışın kaburgalı yüzü — dişler bu yüzün baktığı tarafı gösterir</title></path>';
  svg += '<text data-ve="rib-legend" x="' + f(pad - 6) + '" y="' + f(H - 5) + '" font-size="7"'
      + ' fill="var(--text-muted)">dişli kenar = kayışın kaburgalı yüzü</text>';

  ps.forEach(function(p, k){
    var def = build.order[k] ? _feadDefOf(build.order[k]) : {};
    var isDrv = !!(build.sys.pulleys[k] && build.sys.pulleys[k].crank);
    var col = isDrv ? 'var(--accent-primary)' : (def.isFeadTensioner ? 'var(--accent-success)' : 'var(--text-secondary)');
    var X = f(tx(p.c[0])), Y = f(ty(p.c[1])), R = f(p.rPitch*s);
    // data-pi: animatör mod şeklinde GERGİ kasnağını buradan buluyor. DOM
    // sırasına güvenmek, kol çizilmeyen küçük kasnakta kayardı (kol yolundaki
    // data-arc kuralının aynısı).
    // data-pi SIRANIN SONUNDA: kasnak çemberinin ilk üç niteliği (cx/cy/r) bu
    // dosyanın dışından da OKUNUYOR (şema kapıları onları düzenli ifadeyle
    // ayrıştırıyor); araya bir nitelik sokmak o okuyucuları sessizce kırardı.
    svg += '<circle data-ve="pulley" cx="' + X + '" cy="' + Y + '" r="' + R + '" fill="none" stroke="' + col
        + '" stroke-width="2"' + (p.contact === 'back' ? ' stroke-dasharray="4 3"' : '')
        + ' data-pi="' + k + '"/>';
    svg += '<circle cx="' + X + '" cy="' + Y + '" r="2.2" fill="' + col + '" data-pi="' + k + '"/>';

    // KASNAK KOLLARI — yalnız animasyonlu kartta. Kasnağın rol rengini taşırlar
    // (çemberle aynı), çünkü söyledikleri şey o kasnağın kendi hareketi.
    // data-arc: animatör bu yolun HANGİ sarım yayına ait olduğunu buradan okur;
    // DOM sırasına güvenmek, küçük kasnakta kol çizilmediği durumda kayardı.
    if(animPay){
      var arcIdx = (k + ps.length - 1) % ps.length;
      svg += '<path data-ve="spoke" data-arc="' + arcIdx + '" d="'
          + _feadSpokePath(walk, 0, T, arcIdx, vibDef) + '" fill="none" stroke="' + col
          + '" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/>';
    }

    // DÖNÜŞ YÖNÜ OKU — kasnağın içinde, yarıçapın %55'inde bir yay + uç oku.
    // Tedarikçi çıktısındaki dönüş okunun karşılığı: bütün kasnaklar aynı yöne
    // dönmüyorsa (sırttan temas) bu gözle görünür.
    // YÖN: d > 0 mm düzleminde CCW, yerleşim yönelimi korunduğu için ekranda da
    // CCW — yani SAAT YÖNÜNÜN TERSİ. Bu da bir kez ters yazılmıştı (kayış
    // yayıyla aynı hata); ok kasnağın gerçek dönüşünün tersini gösteriyordu.
    // Animasyon açıkken ok ÇİZİLMEZ: dönüş yönünü artık kolların kendisi
    // gösteriyor ve iki işaret üst üste binerdi (ok 0.55R'de, kollar 0.26–0.86R).
    if(wantArrows && !animPay && R > 9){
      var rr = R * 0.55, cw = (p.d < 0);
      var a0 = cw ? -2.3 : -0.85, a1 = cw ? 0.85 : 2.3;
      var x0 = X + rr*Math.cos(a0), y0 = Y + rr*Math.sin(a0);
      var x1 = X + rr*Math.cos(a1), y1 = Y + rr*Math.sin(a1);
      svg += '<path data-ve="spin" d="M' + f(x0) + ' ' + f(y0) + ' A' + f(rr) + ' ' + f(rr) + ' 0 1 '
          + (cw ? 1 : 0) + ' ' + f(x1) + ' ' + f(y1) + '" fill="none" stroke="' + col
          + '" stroke-width="1.2" opacity="0.75"/>';
      var tng = a1 + (cw ? Math.PI/2 : -Math.PI/2), hb = 3.6;
      svg += '<path d="M' + f(x1) + ' ' + f(y1)
          + ' L' + f(x1 - hb*Math.cos(tng - 0.4)) + ' ' + f(y1 - hb*Math.sin(tng - 0.4))
          + ' L' + f(x1 - hb*Math.cos(tng + 0.4)) + ' ' + f(y1 - hb*Math.sin(tng + 0.4))
          + ' Z" fill="' + col + '" opacity="0.75"/>';
    }

    var et = _etiket[k] || { x: X, y: Y - R - 4, an: 'middle' };
    svg += '<text data-ve="name" x="' + f(et.x) + '" y="' + f(et.y) + '" text-anchor="' + et.an
        + '" font-size="9" fill="var(--text-muted)">' + _feadEsc(gorAd(k)) + '</text>';
    // SARIM AÇISI ŞEMADA İKİNCİ KEZ YAZILIR. Kanvasta bunun karşılığı var:
    // orada tablo YOK, kart tek başına duruyor. Raporda aynı altı sayı bir
    // sonraki sayfada hizalı ve iki ondalıkla basılıyor; şemada ise kayış
    // yolunun üstüne düşüyor (ölçüldü: dört çakışmanın ikisi bu etiketten).
    if(opts.wrapLabels !== false)
      svg += '<text x="' + X + '" y="' + f(Y + R + 10) + '" text-anchor="middle" font-size="8" fill="var(--accent-warning)">'
          + f(geom.wrapDeg(k)) + '°</text>';
  });

  // SEÇİLİ KONUMUN KÜNYESİ — sol üstte. "Hangi konumu görüyorum" sorusu şemanın
  // kendi içinde cevaplanmalı; kip seçicisi kartın altında, çizimin dışında.
  if(sel.primary){
    svg += '<text data-ve="pos-label" x="' + f(pad - 6) + '" y="12" font-size="8.5"'
        + ' fill="var(--accent-warning)">' + _feadEsc(sel.primary.label)
        + '  ·  kol ' + f(sel.primary.relDeg) + '°'
        + (Number.isFinite(sel.primary.tensionN) ? '  ·  ' + Math.round(sel.primary.tensionN) + ' N' : '')
        + '</text>';
    // ANİMASYON KÜNYESİ. Ağır çekim katsayısı GİZLENMEZ: ekranda gördüğü hız
    // gerçek hız değil, oranlar gerçek — bu ayrım yazılı olmazsa kullanıcı
    // ekrandan devir okumaya kalkar.
    var y2 = 22;
    if(animPay && opts.animate && opts.animate.label){
      // İKİ SATIR OLABİLİR: kinematik künyesi + titreşim künyesi. SVG <text>
      // satır sonu tanımaz, o yüzden ayrı ayrı basılıyor; ikincisi titreşimin
      // sınırını taşıyor (ölçek göreli / KALİBRE DEĞİL) ve gizlenemez.
      opts.animate.label.split('\n').forEach(function(satir, si){
        svg += '<text data-ve="anim-label" x="' + f(pad - 6) + '" y="' + (22 + si*9)
            + '" font-size="7.5" fill="var(--text-'
            + (si ? 'muted' : 'secondary') + ')">' + _feadEsc(satir) + '</text>';
      });
      y2 = 22 + opts.animate.label.split('\n').length * 9 + 1;
    }
    // SENARYO GÖSTERGESİ — animatörün kare başına yazdığı TEK canlı satır.
    // Donuk hâli senaryonun t=0 durumunu gösterir ki animasyon başlamadan da
    // (prefers-reduced-motion) ne anlatıldığı okunsun.
    if(animPay && opts.scn){
      var s0 = (typeof veFeadScnStateAt === 'function')
        ? veFeadScnStateAt(opts.scn, 0) : null;
      svg += '<text data-ve="scn-label" x="' + f(pad - 6) + '" y="' + y2
          + '" font-size="7.5" fill="var(--accent-warning)">'
          + _feadEsc(s0 ? _feadScnHud(opts.scn, s0) : 'senaryo') + '</text>';
      y2 += 10;
    }
    if(hayalet.length)
      svg += '<text x="' + f(pad - 6) + '" y="' + y2 + '" font-size="7" fill="var(--text-muted)">'
          + hayalet.length + ' konum daha (soluk) — kolun gezdiği aralık</text>';
  }

  // YÖN GÜLÜ — sağ altta, tedarikçi çıktısındaki gibi. Kayış düzleminin açı
  // konvansiyonu: 0° = +x, açılar CCW. Bu olmadan "montaj açısı −3.18°" gibi
  // bir sayının hangi yöne baktığı okunamıyor.
  if(wantCompass){
    var cx = f(roseYer.cx), cy = f(roseYer.cy), r = VE_FEAD_ROSE_W/2 - 15;
    // TAŞIMA KANCASI yalnız düğüm kimliği verilmişse kurulur: rapor ve dışa
    // aktarma aynı çiziciyi kullanıyor, oralarda sürüklenecek bir şey yok.
    // Şeffaf dikdörtgen TUTAMAK: gül ince çizgilerden ibaret, 1 px'lik bir
    // çizgiyi yakalamaya çalışmak sürüklemeyi kullanılamaz yapardı.
    var tut = opts.nodeId
      ? ' style="cursor:move;" onmousedown="veFeadCompassDragStart(event,\'' + _feadEsc(opts.nodeId) + '\')"'
        + ' ondblclick="event.stopPropagation(); veFeadCompassReset(\'' + _feadEsc(opts.nodeId) + '\')"'
      : '';
    svg += '<g data-ve="compass-group" data-cx="' + cx + '" data-cy="' + cy + '"' + tut + '>';
    if(opts.nodeId)
      svg += '<rect x="' + f(cx - VE_FEAD_ROSE_HALF) + '" y="' + f(cy - VE_FEAD_ROSE_HALF) + '" width="'
          + (2*VE_FEAD_ROSE_HALF) + '" height="' + (2*VE_FEAD_ROSE_HALF) + '" fill="transparent">'
          + '<title>Yön gülü — sürükle ile taşınır, çift tık varsayılan yerine döndürür</title></rect>';
    svg += '<g data-ve="compass" stroke="var(--text-muted)" stroke-width="1" fill="none">'
        + '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '"/>'
        + '<line x1="' + f(cx-r-4) + '" y1="' + f(cy) + '" x2="' + f(cx+r+4) + '" y2="' + f(cy) + '"/>'
        + '<line x1="' + f(cx) + '" y1="' + f(cy-r-4) + '" x2="' + f(cx) + '" y2="' + f(cy+r+4) + '"/></g>';
    var et = [['0', cx+r+7, cy+3, 'start'], ['90', cx, cy-r-7, 'middle'],
              ['180', cx-r-7, cy+3, 'end'], ['270', cx, cy+r+11, 'middle']];
    et.forEach(function(t){
      svg += '<text x="' + f(t[1]) + '" y="' + f(t[2]) + '" text-anchor="' + t[3]
          + '" font-size="7" fill="var(--text-muted)">' + t[0] + '</text>';
    });
    // CCW yönünü gösteren küçük yay (0°'den 90°'ye).
    svg += '<path d="M' + f(cx + r*0.6) + ' ' + f(cy) + ' A' + f(r*0.6) + ' ' + f(r*0.6)
        + ' 0 0 0 ' + f(cx) + ' ' + f(cy - r*0.6) + '" fill="none" stroke="var(--text-muted)" stroke-width="0.9"/>'
        + '<path d="M' + f(cx) + ' ' + f(cy - r*0.6) + ' l2.6 2.4 l-3.4 1.1 Z" fill="var(--text-muted)"/>';
    svg += '</g>';
  }
  return svg + '</svg>';
}

// ════════════════════════════════════════════════════════════════════════════
//  KANVAS KARTI: CANLI KAYIŞ YOLU ŞEMASI
// ════════════════════════════════════════════════════════════════════════════
// Kayış Yolu düğümü tuvalin üstünde ÇİZİM olarak durur — panel açmak gerekmez.
// Neden kanvasta: kullanıcı koordinat, çap, temas tarafı ve gergi girdilerini
// yazarken modelin GERÇEKTEN kapanıp kapanmadığını anında görmeli. Topoloji
// grafiği (düğüm-bağlantı) kayışın SIRASINI gösteriyor ama ŞEKLİNİ göstermiyor;
// üst üste binen iki kasnak, ters temas tarafı ya da yanlış işaretli bir
// koordinat orada fark edilmiyor. Bu kart o boşluğu kapatıyor.
//
// Şema, düğümlerin KANVASTAKİ yerinden değil, kasnakların kayış düzlemindeki
// (mm) koordinatlarından çizilir — düğümü sürüklemek şemayı değiştirmez.
//
// Stil ELEMANIN ÜSTÜNDE (css/ dosyasında değil): css/styles.css'e dokunmak
// Ölçüm Görüntüleyici'nin dağıtım dosyasını bayatlatıyor (bkz. CLAUDE.md) ve
// tek bir kart için o zinciri kurmaya değmez. Rozette de aynı gerekçe var.
var VE_FEAD_CARD_CLASS = 've-fead-layout-card';

function veFeadApplyLayoutCard(nodeEl, node){
  if(!nodeEl || !node || typeof document === 'undefined') return false;
  if(!_feadDefOf(node).isFeadLayout) return false;
  var box = nodeEl.querySelector('.ve-node-box') || nodeEl;

  // Kart bir kez kurulur, İÇİ tazelenir. Yeniden kurmak her tazelemede
  // düğümün sembolünü ve etiketini yeniden taşımak olurdu.
  var card = box.querySelector('.' + VE_FEAD_CARD_CLASS);
  if(!card){
    card = document.createElement('div');
    card.className = VE_FEAD_CARD_CLASS;
    card.style.cssText = 'position:absolute; inset:0; display:flex; flex-direction:column;'
      + 'overflow:hidden; border-radius:inherit; background:var(--bg-input, #0f1115);';
    // Tuvaldeki sembol kartın arkasında kalmasın (düğüm kutusu kendi SVG'sini
    // ortada gösteriyor); şema onun yerini alır.
    var sym = box.querySelector(':scope > svg');
    if(sym) sym.style.display = 'none';
    box.appendChild(card);
  }
  card.innerHTML = veFeadLayoutCardHTML(node);
  // Kart animasyon yükü taşıyorsa döngü buradan uyanır. Döngü zaten dönüyorsa
  // no-op; kart durgunsa (yük yok) bir sonraki karede kendi kendine durur.
  if(typeof veFeadAnimEnsure === 'function') veFeadAnimEnsure();
  return true;
}

// Kartın içeriği — AYRI ve SAF(ça) tutuluyor ki test HTML'e bakabilsin.
function veFeadLayoutCardHTML(node){
  var build = (typeof veFeadBuildFromCanvas === 'function')
    ? veFeadBuildFromCanvas() : null;
  // Ölçü düğümden, yoksa TİP TANIMINDAN (componentDefs.defaultWidth) okunur —
  // sabitin kendisi js/components.js'te ve orada tek kopya. Buradan bare global
  // olarak okumak dosyalar arası gizli bir bağ kurardı.
  var def = _feadDefOf(node);
  // YEDEK SAYI TUTULMAZ: buradaki `|| 420` / `|| 340` kart ölçüsünün İKİNCİ
  // KOPYASIYDI ve kart 440×500'e büyüyünce sessizce eskidi (components.js'in
  // kendi kuralı: "ölçü tip tanımlarına BURADAN yazılır, defs içinde ayrıca
  // sayı tutulmaz"). Yedek sabitten okunuyor; def zaten her zaman yazılı
  // olduğu için bu dal pratikte hiç koşmuyor, ama koşarsa doğru sayıyı verir.
  var _vW = (typeof VE_FEAD_LAYOUT_W === 'number') ? VE_FEAD_LAYOUT_W : 440;
  var _vH = (typeof VE_FEAD_LAYOUT_H === 'number') ? VE_FEAD_LAYOUT_H : 500;
  var W = (node && node.width) || def.defaultWidth || _vW;
  var H = (node && node.height) || def.defaultHeight || _vH;
  var SER = 20;                                   // alt durum şeridi
  var SEC = 22;                                   // konum seçici şeridi
  var mode = veFeadPosMode(node);

  // ── ANİMASYON: seçili devir → kinematik → çiziciye ────────────────────────
  // Devir seçimi kartta duruyor (node.data.animRpm) ve PANEL DE aynı alanı
  // okuyacak olursa iki ayrı ayar tutulmaz — kol konumundaki kuralın aynısı.
  // 'Durgun' seçiliyse animasyon YÜKÜ HİÇ ÜRETİLMEZ: kart bugünkü donuk
  // şemasıyla (dönüş okları geri gelir) kalır, rAF döngüsü de başlamaz.
  var rpmSel = veFeadAnimRpmOf(build, node);

  // Kol konumu HER ŞEYE geçer: şema hangi konumu çiziyorsa gerginlik, açıklık
  // frekansı ve senaryo da o konumdan gelmeli.
  var vibRel = null;
  if(typeof veFeadPosSelection === 'function'){
    var vsel0 = veFeadPosSelection(build, mode || 'mean');
    if(vsel0 && vsel0.primary && Number.isFinite(vsel0.primary.relDeg)) vibRel = vsel0.primary.relDeg;
  }

  // ── SENARYO: motor çevrimi ────────────────────────────────────────────────
  // Devir artık sabit değil, zamanın fonksiyonu. Ağır çekim katsayısı TEPE
  // devre göre bir kez sabitlenir (mevcut kural: katsayı seçili devre göre
  // normalize edilseydi her devirde ekrandaki hız aynı çıkardı ve devir
  // değişimi görünmezdi — senaryoda görünmesi gereken TAM OLARAK O).
  var scn = null;
  var kin = null, secim = null;
  if(rpmSel === 'scn'){
    if(typeof veFeadScenarioBuild === 'function')
      scn = veFeadScenarioBuild(build, { relDeg: vibRel });
    if(scn) kin = veFeadAnimKinematics(build, scn.peak, scn.peak);
    if(!scn) rpmSel = 'off';                        // kurulamadıysa sessizce akmasın
  } else if(rpmSel !== 'off'){
    kin = veFeadAnimKinematics(build, rpmSel);
    veFeadAnimRpmChoices(build).forEach(function(c){ if(c.rpm === rpmSel) secim = c; });
  }

  // ── TİTREŞİM ──────────────────────────────────────────────────────────────
  // Seçim kartta duruyor (node.data.vibMode / vibGain) ve panel de AYNI alanı
  // okur — kol konumu ve devirdeki kuralın aynısı.
  //
  // Kol konumu titreşime de GEÇER: kart hangi kol konumunu çiziyorsa gerginlik
  // ve dolayısıyla açıklık frekansı da o konumdan gelmeli. Geçilmeseydi şema
  // bir konumu, çırpma başka bir konumu anlatırdı.
  var vibSel = veFeadVibModeOf(node), vibGain = veFeadVibGainOf(node);
  var vibOpts = { crankInertia: _feadNum(build.solver && build.solver.data
                                         && build.solver.data.crankInertia, 0) };
  var vibModes = (vibSel === 'off') ? null : veFeadVibModeList(build, vibOpts);
  var vib = null;
  if(vibSel === 'span' && scn && kin){
    // SENARYODA ÇIRPMA CANLIDIR: frekans ve genlik kare başına senaryonun o
    // andaki gerginliğinden gelir. Donmuş bir yük, süpürme sırasında geçilen
    // rezonansları gösteremezdi — oysa görülecek olay tam olarak o.
    vib = veFeadVibSpanPayload(build, scn.idle, kin.slow, vibGain, vibRel);
    if(vib) vib.live = 1;
  } else if(vibSel === 'span' && kin){
    vib = veFeadVibSpanPayload(build, rpmSel, kin.slow, vibGain, vibRel);
  } else if(vibSel !== 'off' && vibSel !== 'span'){
    vib = veFeadVibModePayload(build, parseInt(vibSel.slice(5), 10) || 0, vibGain, vibOpts, vibRel);
  }

  var SVIB = (vibSel === 'off') ? 0 : 20;          // kazanç şeridi — yalnız açıkken
  var svg = veFeadLayoutSVG(build, Math.max(120, W), Math.max(90, H - SER - SEC - SVIB),
                            { inline: true, posMode: mode, nodeId: node.id,
                              compassPos: node.data && node.data.compassPos,
                              vib: vib, scn: scn,
                              animate: kin ? { dispMmS: scn ? 0 : kin.dispMmS,
                                               slow: kin.slow,
                                               label: _feadAnimLabel(kin, secim && secim.fallback,
                                                                     vib, scn) }
                                           : (vib ? { dispMmS: 0, label: _feadAnimLabel(null, false, vib) } : null) });

  var h = '<div style="flex:1; min-height:0; display:flex; align-items:center; justify-content:center;">';
  if(svg){
    h += svg;
  } else {
    // ÇÖZÜLEMEDİ — kartın en değerli hâli bu. Sessiz boş bir kutu yerine
    // EKSİĞİN KENDİSİ yazılıyor; kullanıcı neyi düzeltmesi gerektiğini
    // panel açmadan okuyor.
    var neden = (build && build.errors && build.errors.length) ? build.errors[0]
      : (build && build.geomError) ? build.geomError
      : 'Kayış yolu henüz kurulamadı.';
    h += '<div style="padding:10px 12px; text-align:center; font-size:var(--fs-micro);'
      + ' line-height:1.5; color:var(--text-muted);">'
      + '<div style="font-size:var(--fs-tiny); font-weight:700; color:var(--accent-danger);'
      + ' margin-bottom:5px;">Şema çizilemiyor</div>' + _feadEsc(neden)
      + ((build && build.errors && build.errors.length > 1)
          ? '<div style="margin-top:5px; opacity:0.8;">+' + (build.errors.length - 1)
            + ' eksik daha — panelde tamamı yazılı</div>' : '')
      + '</div>';
  }
  h += '</div>';
  h += veFeadPosPicker(node, build, mode, rpmSel, vibSel, vibModes);
  if(vibSel !== 'off') h += veFeadVibStrip(node, build, vib, vibSel);
  h += veFeadLayoutCardStrip(build, mode);
  return h;
}

// ── KART DENETİM SATIRI: KOL KONUMU + DEVİR ─────────────────────────────────
// Gergi kolu kayış uzayıp kısaldıkça dönüyor ve kayış yolu her konumda BAŞKA.
// Kart varsayılan olarak çalışma (Mean) konumunu gösteriyor; bu kutu diğer
// konumlara geçmeyi ve "TÜMÜ" ile üst üste bindirmeyi sağlıyor.
//
// mousedown DURDURULUR: kart bir kanvas düğümünün içinde ve düğüm mousedown ile
// SÜRÜKLENMEYE başlıyor — durdurulmazsa listeyi açmaya çalışmak düğümü
// taşıyordu. change ise serbest; saveState zaten kartı tazeliyor.
function veFeadPosPicker(node, build, mode, rpmSel, vibSel, vibModes){
  var rows = (build && build.ok) ? veFeadPositionRows(build) : [];
  var cozulen = {};
  rows.forEach(function(r){ if(r.ok) cozulen[r.key] = r; });

  var opts = '';
  VE_FEAD_POSITIONS.forEach(function(P){
    var r = cozulen[P.key];
    if(!r && P.key !== 'mean') return;              // çözülemeyen konum listede yok
    opts += '<option value="' + P.key + '"' + (mode === P.key ? ' selected' : '') + '>'
          + _feadEsc(P.label) + (r ? ' · ' + _feadFmt(r.relDeg, 1) + '°' : '') + '</option>';
  });
  var cok = Object.keys(cozulen).length > 1;
  opts += '<option value="all"' + (mode === 'all' ? ' selected' : '') + '>'
        + 'TÜMÜ — üst üste' + (cok ? '' : ' (tek konum)') + '</option>';

  // ── DEVİR (animasyon) — duty tablosundan ──────────────────────────────────
  // AYNI SATIRDA duruyor, ikinci bir şerit açılmıyor: kartın 340 px'inden her
  // şerit 22 px alıyor ve o piksel çizimden gidiyordu (ölçüldü: iki şeritle
  // şema 276 px'e düşüyor, alternatör dairesi 13 px'in altına iniyor).
  var rpm = (rpmSel === undefined) ? veFeadAnimRpmOf(build, node) : rpmSel;
  // SENARYO ilk sırada, Durgun'un hemen ardında: "kart ne gösteriyor"
  // sorusunun cevabı tek seçicide kalsın (ikinci bir şerit 22 px demekti).
  var rOpt = '<option value="off"' + (rpm === 'off' ? ' selected' : '') + '>Durgun</option>'
           + '<option value="scn"' + (rpm === 'scn' ? ' selected' : '') + '>Senaryo — motor çevrimi</option>';
  veFeadAnimRpmChoices(build).forEach(function(c){
    rOpt += '<option value="' + c.rpm + '"' + (rpm === c.rpm ? ' selected' : '') + '>'
         + c.rpm + ' dev/dk'
         + (c.fallback ? ' (varsayılan)'
                       : (c.dcPct > 0 ? ' · %' + _feadFmt(c.dcPct, 0) : ''))
         + '</option>';
  });

  // ── TİTREŞİM — üçüncü seçici, AYNI ŞERİTTE ────────────────────────────────
  // Ayrı bir şerit açılmadı: kartın her şeridi 22 px ve o piksel çizimden
  // gidiyor (ölçülmüş kural, yukarıdaki Devir notu). Kazanç kaydırıcısı ise
  // yalnız titreşim AÇIKKEN beliren dördüncü şeritte — bedelini isteyen ödüyor.
  //
  // Mod listesi burulma modelinden gelir ve o model TÜM ataletler girilmemişse
  // ÇÖZÜLMEZ. O hâlde mod seçenekleri hiç yazılmaz ve sebebi kaydırıcı
  // şeridinde yazılı: sessizce sıfır göstermek, iki sessiz girdisi olan
  // (gergi kasnak kütlesi %32, krank mili ataleti %40) bir modelde
  // kendinden emin biçimde YANLIŞ bir frekans göstermek olurdu.
  var vSel = (vibSel === undefined) ? veFeadVibModeOf(node) : vibSel;
  var vOpt = '<option value="off"' + (vSel === 'off' ? ' selected' : '') + '>Kapalı</option>'
           + '<option value="span"' + (vSel === 'span' ? ' selected' : '') + '>Çırpma'
           + (rpm === 'off' ? ' (devir seç)' : '') + '</option>';
  (vibModes || []).forEach(function(f, i){
    var k = 'mode:' + i;
    vOpt += '<option value="' + k + '"' + (vSel === k ? ' selected' : '') + '>'
          + 'Mod ' + (i+1) + ' — ' + _feadFmt(f, 1) + ' Hz</option>';
  });

  var stil = 'flex:1; min-width:0; height:18px; padding:0 3px; font-size:var(--fs-micro);'
    + ' background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);'
    + ' border-radius:2px;';
  var etiket = 'font-size:var(--fs-micro); color:var(--text-muted); white-space:nowrap;';

  return '<div style="flex:0 0 auto; display:flex; align-items:center; gap:4px; padding:1px 6px;'
    + ' border-top:1px solid var(--border-color); background:var(--bg-secondary, #16181d);"'
    + ' onmousedown="event.stopPropagation();" ondblclick="event.stopPropagation();">'
    + '<span style="' + etiket + '">Kol</span>'
    + '<select onmousedown="event.stopPropagation();"'
    + ' onchange="veFeadSetChoice(\'' + node.id + '\',\'posMode\',this.value)"'
    + ' style="' + stil + '">' + opts + '</select>'
    + '<span style="' + etiket + '">Devir</span>'
    + '<select onmousedown="event.stopPropagation();"'
    + ' onchange="veFeadSetChoice(\'' + node.id + '\',\'animRpm\',this.value)"'
    + ' style="' + stil + ' flex:0.85;">' + rOpt + '</select>'
    + '<span style="' + etiket + '" title="Açıklık çırpması ya da burulma mod şekli">Titr.</span>'
    + '<select onmousedown="event.stopPropagation();"'
    + ' onchange="veFeadSetChoice(\'' + node.id + '\',\'vibMode\',this.value)"'
    + ' style="' + stil + ' flex:0.95;">' + vOpt + '</select></div>';
}

// ── KAZANÇ ŞERİDİ — yalnız titreşim açıkken ────────────────────────────────
// GENLİK BİR SONUÇ DEĞİLDİR (bkz. fead-model.js'teki 1. sınır) ve bu şerit tam
// olarak bunu söylemek için var: kaydırıcının yanında ne olduğu ve neyin
// ölçülmediği yazılı. Kaydırıcı gizlenip sabit bir kazanç kullanılsaydı
// kullanıcı ekrandan genlik okumaya kalkardı.
function veFeadVibStrip(node, build, vib, vibSel){
  var g = veFeadVibGainOf(node);
  var etiket = 'font-size:var(--fs-micro); color:var(--text-muted); white-space:nowrap;';
  var not;
  if(!vib){
    not = (vibSel === 'span')
      ? 'çırpma için bir devir seçin'
      : 'burulma modeli çözülemedi — kasnak ataletleri ve gergi kolu ataleti eksik';
  } else if(vib.kind === 'mode'){
    not = 'mod ' + (vib.idx+1) + ' · ' + _feadFmt(vib.fHz, 1) + ' Hz gerçek · '
        + 'şekil ölçeği ' + _feadFmt(vib.topDeg, 0) + '° · zaman tabanı YOK';
  } else if(vib.live){
    not = 'senaryo boyunca CANLI — frekans ve genlik o andaki gerginlikten';
  } else {
    not = _feadFmt(vib.firingHz, 0) + ' Hz ateşleme · en çok savrulan ×'
        + _feadFmt(Math.max.apply(null, vib.spans.map(function(x){ return x.mag; })), 1)
        + (vib.anyFlutter ? ' · ÇIRPINMA' : '')
        + (vib.extraSlow > 1.01 ? ' · ek ağır çekim ×1/' + Math.round(vib.extraSlow) : '');
  }
  return '<div style="flex:0 0 auto; display:flex; align-items:center; gap:5px; padding:1px 6px;'
    + ' border-top:1px solid var(--border-color); background:var(--bg-secondary, #16181d);"'
    + ' onmousedown="event.stopPropagation();" ondblclick="event.stopPropagation();">'
    + '<span style="' + etiket + '" title="Genlik ÖLÇÜLMÜŞ değil — ilan edilmiş gösterim kazancı">'
    + 'Genlik ×' + _feadFmt(g, 0) + '</span>'
    + '<input type="range" min="' + VE_FEAD_VIB_GAIN_MIN + '" max="' + VE_FEAD_VIB_GAIN_MAX + '" step="1"'
    + ' value="' + g + '" onmousedown="event.stopPropagation();"'
    + ' oninput="veFeadSetChoice(\'' + node.id + '\',\'vibGain\',+this.value)"'
    + ' style="flex:0 0 84px; height:14px; accent-color:var(--accent-warning);">'
    + '<span style="' + etiket + ' overflow:hidden; text-overflow:ellipsis;">'
    + _feadEsc(not) + '</span></div>';
}

// Animasyon künyesi — kartın sol üstünde, konum künyesinin altında.
// AĞIR ÇEKİM KATSAYISI YAZILI: ekranda görülen hız gerçek hız DEĞİL (gerçek
// zamanda 60 Hz ekranda strob oluyor, bkz. fead-model.js), oranlar ise birebir.
// Katsayı gizlenseydi kullanıcı ekrandan devir okumaya kalkardı.
function _feadAnimLabel(kin, fallback, vib, scn){
  var alt = '';
  if(scn){
    // İKİ HIZ TEK SATIRDA. Senaryo saati gerçek, dönüş ağır çekimde — bu
    // yazılmazsa kullanıcı ekrandan devir okumaya kalkar.
    var kat0 = (kin && kin.slow < 0.999) ? '×1/' + Math.round(1/kin.slow) : '×1';
    return 'senaryo ' + _feadFmt(scn.T, 1) + ' s (gerçek zaman)  ·  dönüş ' + kat0
         + ' ağır çekim  ·  tepe ' + scn.peak + ' dev/dk'
         + (scn.egri ? '  ·  rampa tork eğrisinden' : '  ·  rampa DOĞRUSAL')
         + (vib ? '\nçırpma canlı · genlik ×' + _feadFmt(vib.gain, 0) + ' (KALİBRE DEĞİL)' : '');
  }
  if(vib){
    // GENLİK KAZANCI KÜNYEDE. Gizlenseydi kullanıcı ekrandan mm okumaya
    // kalkardı — oysa o sayı ölçülmedi (bkz. fead-model.js, 1. sınır).
    alt = (vib.kind === 'mode')
      ? 'mod ' + (vib.idx+1) + ' · ' + _feadFmt(vib.fHz, 1) + ' Hz · şekil ×'
        + _feadFmt(vib.gain, 0) + ' (ölçek göreli)'
      : 'çırpma ' + _feadFmt(Math.min.apply(null, vib.spans.map(function(x){ return x.f; })), 0)
        + '–' + _feadFmt(Math.max.apply(null, vib.spans.map(function(x){ return x.f; })), 0)
        + ' Hz · genlik ×' + _feadFmt(vib.gain, 0) + ' (KALİBRE DEĞİL)';
  }
  if(!kin) return alt;
  var kat = (kin.slow >= 0.999) ? 'gerçek zaman'
          : '×1/' + Math.round(1/kin.slow) + ' ağır çekim';
  return Math.round(kin.engineRpm) + ' dev/dk' + (fallback ? ' (varsayılan)' : '')
       + '  ·  kayış ' + _feadFmt(kin.beltMs, 1) + ' m/s  ·  ' + kat
       + (alt ? '\n' + alt : '');
}

// Durum şeridi — "tutarlı mı" sorusunun tek satırlık cevabı.
// Sarım değişmezi (Σkaburgalı − Σsırttan = 360°) burada duruyor çünkü kapalı
// bir kayış çevriminin geometrik ZORUNLULUĞU o; tutmuyorsa şema kendi içinde
// tutarlı görünse bile yol yanlış çözülmüş demektir.
function veFeadLayoutCardStrip(build, mode){
  var ok = !!(build && build.ok);
  var sol = 'Kayış yolu kapanmadı', sag = '';
  if(ok){
    try {
      // Şerit HANGİ KONUM ÇİZİLİYORSA onun sayılarını verir; Mean'in sayılarını
      // gösterip başka bir konumu çizmek sessiz bir yanlış okuma olurdu.
      var sel = veFeadPosSelection(build, mode || 'mean');
      var relS = (sel.primary && Number.isFinite(sel.primary.relDeg))
        ? sel.primary.relDeg : FEADCore.meanRel(build.sys);
      var st = FEADCore.tensionerState(build.sys, relS);
      var g = st.geom, sg = 0, bk = 0;
      g.wraps.forEach(function(w, i){
        if(build.sys.pulleys[i].contact === 'back') bk += w; else sg += w;
      });
      var inv = (sg - bk) * 180 / Math.PI;
      sol = build.order.length + ' kasnak · L ' + _feadFmt(g.LeffMm, 1) + ' mm';
      // ÇEVRİM İKİ YÖNE DE GEZİLEBİLİR: aynalanmış bir düzende kayış ters yönde
      // dolanır ve işaretli sarım toplamı −360° çıkar. Çekirdek bunu ZATEN kabul
      // ediyor (fead-core.js: |‌|Σ|−360| > 0.05 → hata), yani ±360'ın ikisi de
      // geçerli çözüm. Buradaki kapı yalnız +360 arıyordu; rastgele üretilmiş
      // bir topolojide çekirdeğin kusursuz çözdüğü bir yerleşim kartta ✗ ile
      // "tutarsız" görünüyordu. Yön künyede yazılıyor ki bilgi kaybolmasın.
      sag = 'Σsarım ' + _feadFmt(inv, 1) + '°' + (inv < 0 ? ' (ters yön)' : '');
      // ÇEKİRDEK ARTIK HOŞGÖRÜLÜ: kapanmayan çevrim istisna atmıyor, sayıları
      // üretip ihlali taşıyor (bkz. solveGeometry tolerant). Yani kart artık
      // ÇİZİYOR — ve tam bu yüzden şeridin sebebi ADIYLA söylemesi gerekiyor:
      // çizilen yol makul görünür, yanlış olduğu yalnız buradan okunur.
      if(Math.abs(Math.abs(inv) - 360) > 0.05){
        ok = false;
        sol = 'Kayış yolu KAPANMIYOR · ' + sol;
      } else if((g.violations || []).length){
        ok = false;
        sol = 'Kayış kasnağın İÇİNDEN geçiyor · ' + sol;
      }
    } catch(e){ ok = false; sol = 'Geometri okunamadı'; }
  }
  var renk = ok ? 'var(--accent-success)' : 'var(--accent-danger)';
  return '<div style="flex:0 0 auto; display:flex; justify-content:space-between; gap:6px;'
    + ' align-items:center; padding:2px 7px; font-size:var(--fs-micro); line-height:1.5;'
    + ' font-family:ui-monospace, monospace; color:' + renk
    + '; border-top:1px solid var(--border-color); background:var(--bg-secondary, #16181d);">'
    + '<span>' + (ok ? '✓ ' : '✗ ') + _feadEsc(sol) + '</span>'
    + '<span style="opacity:0.85;">' + _feadEsc(sag) + '</span></div>';
}

// Tuvaldeki BÜTÜN Kayış Yolu kartlarını tazele. Girdi değişince çağrılır
// (setter'lar + saveState); iç topolojide Kayış Yolu düğümü yoksa hiçbir şey
// yapmaz, yani ana tuvalde ve diğer modüllerde bedava.
function veFeadRefreshLayoutCards(){
  if(typeof document === 'undefined' || typeof nodes === 'undefined') return 0;
  var n = 0;
  nodes.forEach(function(x){
    if(!_feadDefOf(x).isFeadLayout) return;
    var el = document.getElementById(x.id);
    if(el && veFeadApplyLayoutCard(el, x)) n++;
  });
  return n;
}

// ════════════════════════════════════════════════════════════════════════════
//  ANİMATÖR — tek rAF döngüsü, DOM'da durum YOK
// ════════════════════════════════════════════════════════════════════════════
// Kart her saveState()'te innerHTML ile baştan kuruluyor. Animasyonu öğeye
// bağlı bir durumla (kurulum/temizlik çiftiyle) sürdürmek, o yeniden kurulmayı
// her seferinde yakalamayı gerektirirdi — unutulan tek yol sızıntı ya da donmuş
// kart demekti. Bunun yerine döngü DURUM TUTMAZ: her karede animasyon yükü
// taşıyan SVG'leri arar, bulduğuna fazı uygular. Yeniden kurulma kendiliğinden
// zararsız; kart yok olunca döngü kendini durdurur.
//
// FAZ DÜĞÜM KİMLİĞİYLE saklanır (öğeyle değil): kullanıcı bir alanı
// değiştirdiğinde kart yeniden kuruluyor, öğe yeni; faz öğede dursaydı kayış
// her tuş vuruşunda başa sararak ZIPLARDI.
//
// KARE BAŞINA İŞ: kart başına bir diş yolu (~140 kısa parça) + kasnak başına
// bir kol yolu (3 parça). Hepsi attribute yazımı; yeniden düzen (layout)
// tetiklemez.
// Yükün taşıdığı senaryo: `notlar` DÜŞÜRÜLÜR. Notlar kullanıcıya yazılan
// metin (şeritte ve panelde duruyor), animatörün kare başına bakacağı bir şey
// değil — yükte durması hem gereksiz hem de en uzun metin alanı.
function _feadScnSlim(scn){
  var o = {};
  Object.keys(scn).forEach(function(k){ if(k !== 'notlar') o[k] = scn[k]; });
  return o;
}

// ── SENARYO GÖSTERGESİ ─────────────────────────────────────────────────────
// Kare başına yazılan TEK satır. Faz adı, devir, kayış hızı, gerginlik bandı
// ve — varsa — o anda geçilen rezonans. Rezonans yazılmasaydı süpürmenin asıl
// olayı yalnız "bir açıklık daha çok sallanıyor" olarak kalırdı; hangi
// mertebenin hangi açıklığı uyardığı okunamazdı.
var VE_FEAD_SCN_REZ_TOL = 0.04;        // |k·f_ateşleme − f| / f eşiği
var VE_FEAD_SCN_REZ_ORDERS = 4;
function _feadScnRezonans(st){
  if(!st || !(st.firingHz > 0)) return null;
  var en = null;
  for(var i=0;i<st.spanF.length;i++){
    var f = st.spanF[i];
    if(!(f > 0)) continue;
    for(var k=1;k<=VE_FEAD_SCN_REZ_ORDERS;k++){
      var d = Math.abs(k*st.firingHz - f) / f;
      if(d < VE_FEAD_SCN_REZ_TOL && (!en || d < en.d)) en = { i:i, k:k, d:d, f:f };
    }
  }
  return en;
}
function _feadScnHud(scn, st){
  if(!st) return '';
  var h = st.fazAd + '  ·  ' + Math.round(st.rpm) + ' dev/dk'
        + '  ·  kayış ' + _feadFmt(st.beltMs, 1) + ' m/s';
  h += '  ·  T ' + Math.round(st.Tmin)
     + (Math.round(st.Tmax) !== Math.round(st.Tmin) ? '–' + Math.round(st.Tmax) : '') + ' N';
  var r = _feadScnRezonans(st);
  if(r) h += '   ⚠ REZONANS ' + ((scn && scn.adlar && scn.adlar[r.i]) ? scn.adlar[r.i] : ('açıklık ' + (r.i+1)))
           + ' × ' + r.k + '. mertebe';
  return h;
}

// Senaryonun O ANKİ durumundan çırpma yükü. Donmuş yükün aynısı, ama frekans
// ve genlik canlı gerginlikten geliyor — süpürmede geçilen rezonanslar ancak
// böyle görünür.
function _feadScnVibLive(spec, st, vib){
  var g = vib.gain, z = vib.zeta || 0.06;
  var cap = 1/(2*z), taban = (typeof VE_FEAD_VIB_SPAN_MM === 'number') ? VE_FEAD_VIB_SPAN_MM : 0.35;
  var out = { kind: 'span', gain: g, zeta: z, spans: [] };
  for(var i=0;i<st.spanF.length;i++){
    var f = st.spanF[i], fl = !(f > 0);
    var mag;
    // UYARMA YOKSA TİTREŞİM DE YOK: durgun kayış çırpmaz. Ateşleme frekansı
    // sıfırken SDOF büyütmesi 1 döner ve kayış sebepsiz sallanırdı.
    if(!(st.firingHz > 0)) mag = 0;
    else if(fl) mag = cap;                      // duran dalga yok → akan dalga
    else mag = (typeof _feadVibSpanMag === 'function')
      ? _feadVibSpanMag(f, st.firingHz, z) : 1;
    out.spans.push({
      f: fl ? st.firingHz : f,
      fScreen: (fl ? st.firingHz : f) * (spec.slow > 0 ? spec.slow : 1),
      ampMm: taban * g * mag, mag: mag, flutter: fl,
      ph: (vib.spans && vib.spans[i]) ? vib.spans[i].ph : 0
    });
  }
  return out;
}

var VE_FEAD_ANIM_ATTR = 'data-fead-anim';
var VE_FEAD_ANIM_MAX_DT = 0.1;          // s — sekme geri gelince kayış fırlamasın
var _feadAnimPhase = {};                // düğüm kimliği → mm cinsinden faz
var _feadVibTime = {};                  // düğüm kimliği → ekran saniyesi (titreşim)
var VE_FEAD_VIB_TIME_WRAP = 1200;       // s — sin() hassasiyeti için sarma
var _feadAnimRAF = 0;
var _feadAnimLast = 0;

// Kullanıcı hareketi azaltmak istiyorsa animasyon HİÇ başlamaz; kart donuk
// şemasıyla (dönüş okları ve tam okunur etiketleriyle) kalır.
function _feadAnimReduced(){
  try {
    return !!(typeof window !== 'undefined' && window.matchMedia
              && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch(e){ return false; }
}

// Yükü bir kez çözüp öğenin üstünde önbelleğe alır. Anahtar ham metnin
// KENDİSİ: kart yeniden kurulup yük değiştiyse (devir değişti, geometri
// değişti) önbellek kendiliğinden düşer.
function _feadAnimSpec(el){
  var raw = el.getAttribute(VE_FEAD_ANIM_ATTR);
  if(!raw) return null;
  var spec = el.__feadAnim;
  if(spec && spec._raw === raw) return spec;
  try { spec = JSON.parse(raw); } catch(e){ return null; }
  if(!spec || !Array.isArray(spec.segs)) return null;
  spec._raw = raw;
  spec.T = _feadXform(spec.s, spec.ox, spec.oy, spec.mx, spec.my);
  spec.walk = { segs: spec.segs, l: spec.loop };
  el.__feadAnim = spec;
  return spec;
}

// tau = EKRAN saniyesi (titreşim için). Kayış fazı mm, titreşim fazı saniye —
// ikisi ayrı sayaç çünkü ayrı zaman tabanları var (mod şeklinin gerçek zaman
// tabanı YOK, bkz. fead-model.js'teki 3. sınır).
function veFeadAnimApply(el, phaseMm, tau){
  var spec = _feadAnimSpec(el);
  if(!spec) return false;
  var t = tau || 0, vib = spec.vib;
  // SENARYO: devir zamanın fonksiyonu. Durum SAF SAYIDAN çözülüyor
  // (js/fead-transient.js), yani animatör kare başına çekirdeğe dokunmuyor.
  if(spec.scn && typeof veFeadScnStateAt === 'function'){
    var st = veFeadScnStateAt(spec.scn, t);
    if(st){
      if(vib && vib.live) vib = _feadScnVibLive(spec, st, vib);
      var hud = el.querySelector('[data-ve="scn-label"]');
      if(hud) hud.textContent = _feadScnHud(spec.scn, st);
    }
  }
  var def = vib ? _feadVibDef(vib, t, spec.walk) : null;
  var rib = el.querySelector('[data-ve="rib"]');
  if(rib) rib.setAttribute('d',
    _feadTeethPath(spec.walk, spec.sense, spec.step, spec.tooth, phaseMm, spec.T, def));
  var kollar = el.querySelectorAll('[data-ve="spoke"]');
  for(var i=0;i<kollar.length;i++){
    var j = parseInt(kollar[i].getAttribute('data-arc'), 10);
    kollar[i].setAttribute('d',
      _feadSpokePath(spec.walk, phaseMm, spec.T, Number.isFinite(j) ? j : null, def));
  }
  if(!def) return true;

  // Kayış yolunun KENDİSİ de bükülür — yalnız dişler bükülseydi diş sırası
  // kayışın dışına taşardı.
  var belt = el.querySelector('[data-ve="belt"]');
  if(belt) belt.setAttribute('d', _feadWalkPath(spec.walk, spec.T, def));

  // Mod şeklinde gergi kasnağı ve kol da yer değiştirir. Çember/göbek için
  // TRANSFORM kullanılıyor: cx/cy'ye yazmak, ikinci karede kaymış değerin
  // üstüne yazmak olurdu (taban değeri saklamak gerekirdi). Kol çizgisinin
  // yalnız UCU oynadığı için orada taban değer öğede saklanıyor — öğe her
  // yeniden kurulumda taze geldiği için taban da tazelenir.
  if(def.armOff){
    var dxp =  def.armOff[0] * spec.T.s;
    var dyp = -def.armOff[1] * spec.T.s;              // ty() y'yi çevirir
    var tr = 'translate(' + _feadR(dxp) + ' ' + _feadR(dyp) + ')';
    var ti = vib.tenIdx;
    var kutu = el.querySelectorAll('[data-pi="' + ti + '"]');
    for(var m=0;m<kutu.length;m++) kutu[m].setAttribute('transform', tr);
    var kol = el.querySelector('[data-ve="arm"]');
    if(kol){
      if(kol.__bx == null){
        kol.__bx = parseFloat(kol.getAttribute('x2'));
        kol.__by = parseFloat(kol.getAttribute('y2'));
      }
      if(Number.isFinite(kol.__bx)){
        kol.setAttribute('x2', _feadR(kol.__bx + dxp));
        kol.setAttribute('y2', _feadR(kol.__by + dyp));
      }
    }
  }
  return true;
}

function veFeadAnimTick(now){
  _feadAnimRAF = 0;
  if(typeof document === 'undefined') return 0;
  var els = document.querySelectorAll('svg[' + VE_FEAD_ANIM_ATTR + ']');
  if(!els.length){ _feadAnimLast = 0; return 0; }       // kart yok → döngü biter
  var t = (typeof now === 'number') ? now : 0;
  var dt = (_feadAnimLast > 0) ? Math.min(VE_FEAD_ANIM_MAX_DT, (t - _feadAnimLast) / 1000) : 0;
  if(dt < 0) dt = 0;
  _feadAnimLast = t;
  var canli = 0;
  for(var i=0;i<els.length;i++){
    var el = els[i], spec = _feadAnimSpec(el);
    // Kayış akmıyor OLABİLİR (mod şekli durgun kayışta oynar); o hâlde bile
    // yazacak bir şey varsa döngü canlıdır.
    if(!spec || (!(spec.mmS > 0) && !spec.vib && !spec.scn)) continue;
    var key = el.getAttribute('data-fead-node') || '?';
    var tau = 0;
    if(spec.vib || spec.scn){
      // TEK SAAT, İKİ HIZ. tau gerçek saniyedir: senaryo onu doğrudan okur
      // (motor çevrimi gerçek zamanda geçer), titreşim ise ağır çekim
      // katsayısıyla ölçeklenmiş fScreen ile okur. İki ayrı sayaç tutmak
      // ikisinin sessizce ayrışması demekti.
      // Kayan noktada uzun oturumda hassasiyet kaybolmasın diye sarılır;
      // senaryo döngüsel olduğu için sarma sınırı çevrim süresinin katı olmalı
      // ki sarmada faz atlamasın.
      var wrap = VE_FEAD_VIB_TIME_WRAP;
      if(spec.scn && spec.scn.T > 0)
        wrap = Math.max(spec.scn.T, Math.floor(VE_FEAD_VIB_TIME_WRAP / spec.scn.T) * spec.scn.T);
      tau = ((_feadVibTime[key] || 0) + dt) % wrap;
      _feadVibTime[key] = tau;
    }
    // Senaryoda kayış hızı devirle değişir; sabit mmS yanlış olurdu.
    var mmS = spec.mmS;
    if(spec.scn && spec.slow > 0 && typeof veFeadScnStateAt === 'function'){
      var sq = veFeadScnStateAt(spec.scn, tau);
      mmS = sq ? sq.beltMs * 1000 * spec.slow : 0;
    }
    var p = (_feadAnimPhase[key] || 0) + mmS * dt;
    if(spec.loop > 0) p = ((p % spec.loop) + spec.loop) % spec.loop;
    _feadAnimPhase[key] = p;
    veFeadAnimApply(el, p, tau);
    canli++;
  }
  if(canli) veFeadAnimEnsure();
  else _feadAnimLast = 0;
  return canli;
}

function veFeadAnimEnsure(){
  if(_feadAnimRAF) return false;
  if(typeof requestAnimationFrame !== 'function') return false;
  if(_feadAnimReduced()) return false;
  _feadAnimRAF = requestAnimationFrame(veFeadAnimTick);
  return true;
}

function getFeadLayoutPropertiesHTML(node){
  if(!node.data) node.data = {};
  var build = veFeadBuildFromCanvas();
  var html = '<div class="sw-panel">';
  var mode = veFeadPosMode(node);
  // Panel de AYNI alanı okur ve aynı kancayı kurar: gül kartta bir yerde,
  // panelde başka bir yerde durursa kullanıcı hangisinin geçerli olduğunu
  // bilemez (kol konumundaki kuralın aynısı).
  var svg = veFeadLayoutSVG(build, 320, 240,
    { posMode: mode, nodeId: node.id, compassPos: node.data.compassPos });
  if(svg){
    // Konum seçimi KARTLA AYNI ALANI okur (node.data.posMode) — iki ayrı ayar
    // tutulsa panel bir konumu, kanvastaki kart başka bir konumu gösterirdi.
    var secenekler = [];
    var rows = veFeadPositionRows(build), coz = {};
    rows.forEach(function(r){ if(r.ok) coz[r.key] = r; });
    VE_FEAD_POSITIONS.forEach(function(P){
      if(!coz[P.key] && P.key !== 'mean') return;
      secenekler.push([P.key, P.label + (coz[P.key] ? ' · kol ' + _feadFmt(coz[P.key].relDeg, 1) + '°' : '')]);
    });
    secenekler.push(['all', 'TÜMÜ — üst üste (kolun gezdiği aralık)']);
    html += _feadCard('Şema', 'ölçekli · sarım açıları', 'var(--accent-warning)',
        _feadSelect(node, 'Gergi kol konumu', 'posMode', secenekler, mode,
          'Kol kayış uzayıp kısaldıkça dönüyor; her konumda teğet noktaları, sarım '
          + 'açıları ve span boyları DEĞİŞİR. <b>TÜMÜ</b> kolun gezdiği aralığı üst '
          + 'üste bindirir — tolerans ve aşınma payı 0 ise bütün konumlar aynı açıya '
          + 'oturur ve tek eğri görünür.')
      + _feadVibPanelPick(node, build)
      + svg);
    html += veFeadGeometryTable(build, mode);
  } else {
    html += veFeadProblemBox(build);
  }
  html += veFeadWarningBox(build);
  html += '</div>';
  return html;
}

// ── PANELDEKİ TİTREŞİM SEÇİMİ — kartla AYNI ALAN ───────────────────────────
// Kart `node.data.vibMode` / `vibGain` okuyor; panel de aynı ikisini okur.
// İkinci bir ayar tutulsaydı panel bir modu, kanvastaki kart başkasını
// gösterirdi (kol konumu ve yön gülündeki kuralın aynısı).
//
// Panelin ŞEMASI animasyon oynatmaz (modülün kuralı: animasyon yalnız kanvas
// kartında) — buradaki seçim kartı sürer. Bu yüzden kutunun altında nereye
// baktığı yazılı; yoksa kullanıcı panelde seçip panelde bir şey olmamasını
// kusur sanardı.
function _feadVibPanelPick(node, build){
  var sec = veFeadVibModeOf(node);
  var opts = [['off', 'Kapalı'], ['span', 'Açıklık çırpması (kanvasta devir seçili olmalı)']];
  var liste = (sec === 'off') ? null : veFeadVibModeList(build,
    { crankInertia: _feadNum(build.solver && build.solver.data
                             && build.solver.data.crankInertia, 0) });
  (liste || []).forEach(function(f, i){
    opts.push(['mode:' + i, 'Burulma modu ' + (i+1) + ' — ' + _feadFmt(f, 1) + ' Hz']);
  });
  var h = _feadSelect(node, 'Titreşim animasyonu', 'vibMode', opts, sec,
    'Kanvastaki <b>Kayış Yolu kartında</b> oynar. <b>Çırpma</b> açıklıkların enine '
    + 'titreşimidir (frekans çekirdekten, f = (c²−v²)/2Lc); <b>burulma modu</b> '
    + 'kasnakların birbirine karşı salınımıdır ve şekli özvektörün kendisidir. '
    + '<b>Genlik ÖLÇÜLMÜŞ DEĞİLDİR</b> — ilan edilmiş bir gösterim kazancıdır, '
    + 'kartın kaydırıcısından ayarlanır ve künyede yazar.');
  if(sec !== 'off' && !liste)
    h += _feadHint('Burulma modları listelenemedi: model <b>her kasnağın atalet '
      + 'momentini</b> ve <b>gergi kolu ataletini</b> istiyor. Eksikken sessizce '
      + 'sıfır göstermek, iki sessiz girdisi olan (gergi kasnak kütlesi %32, krank '
      + 'mili ataleti %40) bir modelde kendinden emin biçimde yanlış bir frekans '
      + 'göstermek olurdu.');
  return h;
}

// Geometri özeti — çekirdeğin kasnak başına verdiği span + sarım + hız oranı.
function veFeadGeometryTable(build, mode){
  var geom, st;
  try {
    // Tablo ŞEMAYLA AYNI konumu anlatır; ikisi ayrışsa kullanıcı bir konumun
    // çizimine bakıp başka bir konumun sayılarını okurdu.
    var _sel = (typeof veFeadPosSelection === 'function')
      ? veFeadPosSelection(build, mode || 'mean') : null;
    var _rel = (_sel && _sel.primary && Number.isFinite(_sel.primary.relDeg))
      ? _sel.primary.relDeg : FEADCore.meanRel(build.sys);
    st = FEADCore.tensionerState(build.sys, _rel);
    geom = st.geom;
  } catch(e){ return ''; }
  var h = '<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color);">'
    + '<tr style="background:var(--bg-tertiary);">'
    + ['Kasnak','Temas','Çıkış span [mm]','Sarım [°]','Hız oranı'].map(function(t){
        return '<th style="padding:4px 6px; border:1px solid var(--border-color); text-align:left; font-weight:600; color:var(--text-secondary);">'+t+'</th>';
      }).join('') + '</tr>';
  geom.names.forEach(function(nm, i){
    h += '<tr>'
      + '<td style="padding:4px 6px; border:1px solid var(--border-color); color:var(--text-primary);">' + _feadEsc(nm) + '</td>'
      + '<td style="padding:4px 6px; border:1px solid var(--border-color); color:var(--text-muted);">'
        + veFeadContactLabel(geom.pulleys[i].contact) + '</td>'
      + '<td style="padding:4px 6px; border:1px solid var(--border-color); text-align:right;">' + _feadFmt(geom.exitSpanLen(i),1) + '</td>'
      + '<td style="padding:4px 6px; border:1px solid var(--border-color); text-align:right;">' + _feadFmt(geom.wrapDeg(i),1) + '</td>'
      + '<td style="padding:4px 6px; border:1px solid var(--border-color); text-align:right;">' + _feadFmt(FEADCore.speedRatio(build.sys, i),3) + '</td>'
      + '</tr>';
  });
  h += '</table>';
  var _etiket = (_sel && _sel.primary) ? (_sel.primary.label + ' konumunda')
                                      : 'ortalama kol açısında';
  return _feadCard('Geometri', _etiket, 'var(--accent-primary)', h
    + _feadHint('Efektif kayış boyu <b>' + _feadFmt(geom.LeffMm,1) + ' mm</b> · '
      + 'pitch boyu ' + _feadFmt(geom.LpitchMm,1) + ' mm · '
      + 'işaretli sarım toplamı ' + _feadFmt(geom.signedWrapDeg,2) + '° (360 olmalı).'));
}

// Çözülemeyen model: NE EKSİK olduğunu say. Yanlış bir şema, doğru bir
// uyarıdan kötüdür — bu yüzden hata varken hiç çizmiyoruz.
function veFeadProblemBox(build){
  // Girdi hatası yoksa ama geometri yine de çözülemediyse ÇÖZÜCÜNÜN sebebini
  // bas: "Geometri çözülemedi" tek başına kullanıcıyı aramaya bırakırdı.
  var _liste = (build && build.errors && build.errors.length) ? build.errors.slice() : [];
  if(!_liste.length && build && build.geomError) _liste.push(build.geomError);
  if(!_liste.length){
    return '<div style="padding:14px; text-align:center; font-size:var(--fs-body); color:var(--text-muted); border:1px dashed var(--border-color); border-radius:var(--radius-md); margin-bottom:9px;">'
      + 'Geometri çözülemedi.</div>';
  }
  var h = '<div style="padding:10px 12px; margin-bottom:9px; background:var(--bg-secondary); border:1px solid var(--accent-danger); border-left:3px solid var(--accent-danger); border-radius:var(--radius-sm);">'
    + '<div style="font-size:var(--fs-tiny); font-weight:700; color:var(--text-heading); margin-bottom:6px;">Şema çizilemiyor — eksik ya da tutarsız girdi</div>'
    + '<ul style="margin:0; padding-left:18px; font-size:var(--fs-micro); line-height:1.6; color:var(--text-secondary);">';
  _liste.forEach(function(e){ h += '<li>' + _feadEsc(e) + '</li>'; });
  return h + '</ul></div>';
}

// GİRİLMEMİŞ ALANLAR İÇİN ARŞİVDEN ALINAN DEĞERLER — bir uyarı DEĞİL, bir
// künye. Kutunun tamamı `build.defaults` listesinden üretilir (köprü katmanı,
// bkz. VE_FEAD_DEFAULTS); panel kendi varsayılanını tutmaz, yoksa iki yüzey
// sessizce ayrışırdı.
//
// NEDEN GÖRÜNÜR OLMAK ZORUNDA: varsayılan düğüme YAZILMIYOR, yani alan boş
// kalıyor ve kullanıcı panele baktığında "girilmemiş" görüyor — ama hesap o
// sayıyla koşuyor. İkisi arasındaki köprü bu kutu; olmasaydı model
// bilinmeyen bir sayıyla çözülür ve hiçbir yerde yazmazdı.
function veFeadDefaultsBox(build){
  var d = (build && build.defaults) || [];
  if(!d.length) return '';
  var h = '<div data-ve="fead-defaults" style="padding:10px 12px; margin-bottom:9px; '
    + 'background:var(--bg-secondary); border:1px solid var(--border-color); '
    + 'border-left:3px solid var(--accent-primary); border-radius:var(--radius-sm);">'
    + '<div style="font-size:var(--fs-tiny); font-weight:700; color:var(--text-heading); margin-bottom:6px;">'
    + 'Girilmeyen ' + d.length + ' alan Gates arşivinden varsayıldı</div>'
    + '<ul style="margin:0; padding-left:18px; font-size:var(--fs-micro); line-height:1.6; color:var(--text-secondary);">';
  d.forEach(function(r){
    h += '<li><b>' + _feadEsc(r.field) + '</b> = ' + _feadFmt(r.value, 4)
      + (r.unit ? ' ' + _feadEsc(r.unit) : '')
      + (r.source ? ' <span style="color:var(--text-muted);">— ' + _feadEsc(r.source) + '</span>' : '')
      + '</li>';
  });
  return h + '</ul>'
    + '<div style="margin-top:6px; font-size:var(--fs-micro); color:var(--text-muted);">'
    + 'Bunlar ÖLÇÜLMÜŞ MEDYANLAR, bu sistemin değerleri değil — elinizdeki '
    + 'tedarikçi raporundaki sayıları girerseniz varsayılan devreden çıkar.'
    + '</div></div>';
}

// TEK ÜRETİCİ: uyarı kutusu ve varsayılan künyesi AYNI çağrıdan çıkar. Üç
// panel (Kayış Yolu · Çözücü · Kayış Özellikleri) bu fonksiyonu çağırıyor;
// varsayılan kutusunu ayrı bir çağrı olarak eklemek üçünden birinin
// unutulması demekti (modülün 9. kuralı).
function veFeadWarningBox(build){
  var uyari = '';
  if(build && build.warnings && build.warnings.length){
    uyari = '<div style="padding:10px 12px; margin-bottom:9px; background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning); border-radius:var(--radius-sm);">'
      + '<div style="font-size:var(--fs-tiny); font-weight:700; color:var(--text-heading); margin-bottom:6px;">Uyarılar</div>'
      + '<ul style="margin:0; padding-left:18px; font-size:var(--fs-micro); line-height:1.6; color:var(--text-secondary);">';
    build.warnings.forEach(function(w){ uyari += '<li>' + _feadEsc(w) + '</li>'; });
    uyari += '</ul></div>';
  }
  return uyari + veFeadDefaultsBox(build);
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇÖZÜCÜ — tasarım girdileri + model durumu + konum tablosu
// ════════════════════════════════════════════════════════════════════════════
// Çözücü iç topolojiyi TİPE göre tarar (Takoz Çözücüsü ile aynı yaklaşım):
// kullanıcı çözücüye bileşen bağlamaz. Kendi taşıdığı üç girdi tasarım
// düzeyindedir ve hiçbir kasnağa ait değildir: tasarım gerginliği, tahrik
// oranı, boy ofseti.
function getFeadSolverPropertiesHTML(node){
  if(!node.data) node.data = {};
  // ÇEVRİM TOHUMU PANEL KURULURKEN ATILIR, eylem yolunda değil: tohum yalnız
  // `_feadSolverNode`'a bağlansaydı tablo İLK açılışta yine boş görünür,
  // ancak kullanıcı bir düğmeye bastıktan sonra dolardı.
  if(!Array.isArray(node.data.duty)) node.data.duty = [];
  veFeadDutySeed(node);
  var build = veFeadBuildFromCanvas();
  var html = '<div class="sw-panel">';
  // TASARIM GERGİNLİĞİ ALANI KALDIRILDI. Bağımsız bir veri değildi: gergi
  // kolunun taşıdığı gerginlik yay dengesinden zaten belirli (T = M/(dL/dθ)) ve
  // 10 Gates raporunda girilen değerle türeyen değer %0.12 içinde örtüşüyordu.
  // Ayrıca sormak, aynı bilgiyi ikinci kez ve ÇELİŞEBİLİR biçimde istemekti;
  // çeliştiğinde çekirdek girileni kullanıp yay dengesini yok sayıyordu ve
  // bütün gerilmeler sessizce kayıyordu. Artık köprü türetiyor
  // (veFeadBuildSystem, "ANKRAJ TÜRETİLİYOR"); okunacak yeri aşağıdaki
  // Algılanan Model tablosu.
  html += _feadCard('Tasarım', '', 'var(--accent-primary)',
      _feadGrid(node, [
        { key:'lengthOffsetMm', label:'Boy ofseti [mm]', ph:'0', step:'0.01' }
      ], 1)
    + _feadSelect(node, 'Yorulma modeli', 'fatigueModel',
        [['PK-2_2p-MT3', 'PK-2_2p-MT3 (doğrulanmış, 8 sistem)'],
         ['PK-2_2a-MT3', 'PK-2_2a-MT3 (tek sistem — doğrulanmamış)']], 'PK-2_2p-MT3',
        'Gates raporunun "Pulley Contributions to Belt Rib Fatigue" başlığında yazan model adı. '
        + 'İki takım sabit çok farklı (m 5.6 ↔ 4.05); yanlış seçim yorulma dağılımını kaydırır.')
    + _feadHint('<b>Tasarım gerginliği sorulmaz</b> — gergi yay dengesinden türetilir '
        + '(T = M/(dL/dθ)); değeri "Algılanan Model" tablosunda yazar. '
        + '<b>Boy ofseti</b> tasarım başına kalibrasyon girdisidir '
        + '(kuralı bilinmiyor; gözlenen aralık −0.3 … +3.5 mm).'));

  html += veFeadDriveCard(node);
  html += veFeadEngineCard(node);
  html += _feadCard('Algılanan Model', '', 'var(--accent-success)', veFeadModelTable(build));

  if(build.ok){
    html += veFeadPositionTable(build);
    html += veFeadWarningBox(build);
  } else {
    html += veFeadProblemBox(build);
    html += veFeadWarningBox(build);
  }

  html += veFeadChecksCard(node, build);
  html += veFeadDutyEditor(node, build);

  var hazir = build.ok && veFeadDutyRows(node).length > 0;
  html += '<button ' + (hazir ? '' : 'disabled ')
    + 'onclick="veFeadSolve(\'' + node.id + '\')" style="width:100%; padding:13px 16px; '
    + 'font-size:var(--fs-lg); font-weight:700; letter-spacing:0.03em; border:none; cursor:'
    + (hazir ? 'pointer' : 'not-allowed') + '; background:'
    + (hazir ? 'var(--accent-warning)' : 'var(--bg-tertiary)') + '; color:'
    + (hazir ? '#fff' : 'var(--text-muted)')
    + (hazir ? '' : '; border:1px solid var(--border-color)') + ';">▶ Hesapla'
    + (hazir ? '' : ' (model veya çevrim eksik)') + '</button>';

  html += veFeadResultBlock(node);
  html += '</div>';
  return html;
}

// ── UYGUNLUK KAPILARI KARTI ────────────────────────────────────────────────
//
// BMC hesap defterinden gelen üç kapı (js/fead-checks.js), HESAPLAMADAN ÖNCE
// görünür. Sebep: üçü de yerleşim ve künye verisiyle çözülüyor — çalışma
// çevrimi ya da gerginlik gerekmiyor. Kullanıcı "Hesapla"ya basmadan kasnak
// çapını düzeltebilsin diye burada duruyor, sonuç bloğunda değil.
//
// ÜÇ DURUM VAR, İKİ DEĞİL: 'wait' (veri yok) uygun SAYILMAZ ve gizlenmez.
function veFeadChecksCard(node, build){
  if(typeof veFeadChecks !== 'function')
    return _feadCard('Uygunluk Kapıları', '', 'var(--text-muted)',
      _feadHint('Kapılar yüklenmedi (js/fead-checks.js).'));

  var opt = veFeadCheckOpt(node.data || {}, veFeadDutyRows(node));
  var R = veFeadChecks(build, opt);
  var h = '';

  function rozet(durum){
    if(durum === 'ok')   return '<span style="color:var(--accent-success); font-weight:700;">✓ uygun</span>';
    if(durum === 'warn') return '<span style="color:var(--accent-warning); font-weight:700;">⚠ sınırda</span>';
    if(durum === 'no')   return '<span style="color:var(--accent-danger); font-weight:700;">✗ kontrol</span>';
    return '<span style="color:var(--text-muted);">— değerlendirilemedi</span>';
  }
  function baslik(ad, durum, ek){
    return '<div style="display:flex; align-items:baseline; gap:8px; margin:8px 0 4px;">'
      + '<span style="font-size:var(--fs-micro); font-weight:700; color:var(--text-secondary);">' + ad + '</span>'
      + '<span style="flex:1; font-size:var(--fs-micro); color:var(--text-muted);">' + (ek || '') + '</span>'
      + '<span style="font-size:var(--fs-micro);">' + rozet(durum) + '</span></div>';
  }
  var TD = ' style="padding:2px 5px; border-bottom:1px solid var(--border-color);"';
  var TDR = ' style="padding:2px 5px; border-bottom:1px solid var(--border-color); text-align:right; font-family:ui-monospace,monospace;"';
  function tablo(inner){
    return '<table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; margin-bottom:6px;">'
      + inner + '</table>';
  }
  function pay(p){
    var renk = !Number.isFinite(p) ? 'var(--text-muted)'
             : p < 0  ? 'var(--accent-danger)'
             : p < 10 ? 'var(--accent-warning)' : 'var(--text-secondary)';
    return '<span style="color:' + renk + ';">' + (Number.isFinite(p) ? _feadFmt(p, 1) + '%' : '—') + '</span>';
  }

  // 1 — merkez mesafesi
  var c = R.centerDistance;
  h += baslik('Kasnak merkez mesafesi', c.durum,
        '0,7·(d₁+d₂) ≤ a ≤ 2·(d₁+d₂)' + (c.note ? ' — ' + _feadEsc(c.note) : ''));
  if(c.rows.length){
    var t = '<tr><th' + TD + '>çift</th><th' + TDR + '>alt</th><th' + TDR + '>a</th>'
          + '<th' + TDR + '>üst</th><th' + TDR + '>pay</th></tr>';
    c.rows.forEach(function(r){
      t += '<tr><td' + TD + '>' + _feadEsc(r.cift) + '</td>'
        + '<td' + TDR + '>' + _feadFmt(r.lo, 1) + '</td>'
        + '<td' + TDR + '>' + _feadFmt(r.a, 1) + '</td>'
        + '<td' + TDR + '>' + _feadFmt(r.hi, 1) + '</td>'
        + '<td' + TDR + '>' + pay(r.payPct) + '</td></tr>';
    });
    h += tablo(t);
  }

  // 2 — çevrim oranı penceresi
  var w = R.ratioWindow;
  h += baslik('Çevrim oranı penceresi', w.durum,
        (w.governedRpm > 0 ? 'governed ' + _feadFmt(w.governedRpm, 0) + ' d/dk' : '')
        + (w.note ? ' — ' + _feadEsc(w.note) : ''));
  if(w.rows.length){
    var t2 = '<tr><th' + TD + '>aksesuar</th><th' + TDR + '>optimum</th><th' + TDR + '>devir</th>'
           + '<th' + TDR + '>sürekli</th><th' + TD + '>hüküm</th></tr>';
    w.rows.forEach(function(r){
      t2 += '<tr><td' + TD + '>' + _feadEsc(r.ad) + '</td>'
        + '<td' + TDR + '>' + _feadFmt(r.optimumRpm, 0) + '</td>'
        + '<td' + TDR + '>' + _feadFmt(r.accRpm, 0) + '</td>'
        + '<td' + TDR + '>' + _feadFmt(r.maxContRpm, 0) + '</td>'
        + '<td' + TD + '><span style="color:' + (r.ok ? 'var(--accent-success)' : 'var(--accent-danger)')
        + ';">' + _feadEsc(r.metin) + '</span></td></tr>';
    });
    h += tablo(t2);
  }

  // 3 — devir sınırı
  var s = R.speedLimit;
  h += baslik('Aksesuar devir sınırı', s.durum,
        'sürekli ve anlık maksimum' + (s.note ? ' — ' + _feadEsc(s.note) : ''));
  if(s.rows.length){
    var t3 = '<tr><th' + TD + '>aksesuar</th><th' + TD + '>nokta</th><th' + TDR + '>devir</th>'
           + '<th' + TDR + '>sınır</th><th' + TDR + '>pay</th></tr>';
    s.rows.forEach(function(r){
      r.noktalar.forEach(function(p, k){
        t3 += '<tr><td' + TD + '>' + (k === 0 ? _feadEsc(r.ad) : '') + '</td>'
          + '<td' + TD + '>' + _feadEsc(p.ad) + '</td>'
          + '<td' + TDR + '>' + _feadFmt(p.accRpm, 0) + '</td>'
          + '<td' + TDR + '>' + _feadFmt(p.limit, 0) + ' <span style="color:var(--text-muted);">'
          + _feadEsc(p.limitAd) + '</span></td>'
          + '<td' + TDR + '>' + pay(p.payPct) + '</td></tr>';
      });
    });
    h += tablo(t3);
  }

  h += _feadHint('Üçü de BMC\'nin kendi FEAD hesap defterinden. <b>Merkez mesafesi kuralı iki '
    + 'kasnaklı V-kayış tahrikleri için yazılmıştır</b>; serpantinde açıklığı bütün yerleşim '
    + 'belirlediği için ihlali <b>uyarı</b> sayılır, hüküm değil — pay yüzdesi sınıra ne kadar '
    + 'kaldığını söyler. Diğer ikisi <b>hüküm</b>dür.');

  var kotu = [c.durum, w.durum, s.durum];
  var renk = kotu.indexOf('no') >= 0 ? 'var(--accent-danger)'
           : kotu.indexOf('warn') >= 0 ? 'var(--accent-warning)'
           : kotu.indexOf('wait') >= 0 ? 'var(--text-muted)' : 'var(--accent-success)';
  // Kararlı tutamak: kartın gövdesi bir öznitelikle işaretli. E2E testi kartı
  // metinden aramak zorunda kalsaydı dış sarmalları da yakalar ve "üç tablo"
  // gibi bir ölçüt sessizce yanlış sayardı (ölçüldü: 6 tablo).
  return _feadCard('Uygunluk Kapıları', 'BMC hesap defteri', renk,
    '<div data-ve-fead-checks="1" data-ve-fead-checks-durum="'
      + _feadEsc(c.durum + '/' + w.durum + '/' + s.durum) + '">' + h + '</div>');
}

// ── BİRİNCİ KADEME (krank → sürücü kasnak) ──────────────────────────────────
// FEAD kayışının sürücü kasnağı krank milinde olmak zorunda değil: tipik BMC
// düzeninde krank ayrı bir kademeyle fan kasnağını döndürüyor, FEAD kayışı da
// onun üzerinden tahrik ediliyor. Tedarikçi sayfası oranı İKİ ÇAPLA veriyor
// (krank 197.32 / fan 179.62 = 1.0985 ≈ 1.1), tek bir sayıyla değil — panel de
// o biçimde sorar ve oranı türetir. Elle sayı girme yolu duruyor (tek kademeli
// sistemde oran 1'dir ve çap sormak anlamsız olurdu).
function veFeadDriveCard(node){
  var sd = node.data || {};
  var dr = veFeadDriveRatio(sd);

  var inner = _feadSelect(node, 'Tahrik oranı nereden gelsin', 'ratioMode',
      [['derive', 'Krank ve fan kasnağı çapından türet'],
       ['unity',  'Kademe yok — sürücü kasnak motor devrinde'],
       ['direct', 'Oranı elle gir']], 'derive',
      'Oran = sürücü kasnak devri / motor devri. Krank kasnağı fan kasnağından büyükse '
      + 'sürücü kasnak motordan HIZLI döner (oran &gt; 1).');

  // ALANLAR SEÇİLEN KİPTEN GELİR, ÇÖZÜLEN KİPTEN DEĞİL. `veFeadDriveRatio`
  // çaplar boşken 'derive'ı 'direct'e düşürüyor (oran hâlâ okunabilsin diye);
  // kart o düşüşü izleseydi "çaplardan türet" seçili ama daha hiçbir çap
  // girilmemişken çap alanları KAYBOLURDU ve kullanıcı onları bir daha
  // giremezdi. `unity` bunun dışında: orada düşüş yok, kip kesin.
  var kip = (sd.ratioMode === 'unity' || sd.ratioMode === 'direct')
    ? sd.ratioMode : 'derive';

  // ÜÇÜNCÜ KİPTE HİÇBİR ALAN YOK — sorulacak bir şey de yok. Fan kavraması
  // krankın hemen önündeyse sürücü kasnak motorla aynı devirde döner ve oran
  // tanımı gereği 1'dir; çap sormak kullanıcıyı var olmayan bir kademeyi
  // tarif etmeye zorlardı.
  if(kip === 'unity'){
    inner += _feadHint('Bu düzende fan kavraması krank kasnağının hemen önünde: '
      + 'sürücü kasnak krankla aynı milde ve aynı devirde döner. Oran <b>1,0000</b> — '
      + 'türetilecek bir çap yok. Aksesuar devri = motor devri × '
      + '(sürücü kasnak pitch çapı / aksesuar pitch çapı).');
  } else if(kip === 'direct'){
    inner += _feadGrid(node, [
      { key:'driveRatio', label:'Tahrik oranı [—]', ph:'1', step:'0.0001' }
    ], 1);
  } else {
    inner += _feadGrid(node, [
      { key:'crankOD', label:'Krank kasnağı Ø [mm]', ph:'197.32' },
      { key:'fanOD',   label:'Fan / sürücü kasnağı Ø [mm]', ph:'179.62' }
    ], 2);
  }

  var deg = '<div style="font-size:var(--fs-micro); line-height:1.5; padding:7px 9px; margin-bottom:9px; '
    + 'background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:var(--radius-sm); '
    + 'display:flex; justify-content:space-between; gap:8px;">'
    + '<span style="color:var(--text-muted);">Kullanılan tahrik oranı</span>'
    + '<span style="font-family:ui-monospace,monospace; font-weight:700; color:'
    + (dr.ok ? 'var(--accent-primary)' : 'var(--accent-warning)') + ';">'
    + _feadFmt(dr.ratio, 4) + (dr.mode === 'derive' ? '  (' + _feadFmt(dr.crankOD, 2) + ' / ' + _feadFmt(dr.fanOD, 2) + ')' : '')
    + '  <span style="font-weight:400; color:var(--text-muted);">' + veFeadDriveModeLabel(dr.mode) + '</span>'
    + '</span></div>';

  return _feadCard('Birinci Kademe', 'krank → sürücü kasnak', 'var(--accent-warning)',
    inner + deg
    + _feadHint('Bu oran aksesuar devirlerinin TAMAMINI ölçekler: aksesuar devri = motor devri '
      + '× tahrik oranı × (sürücü kasnak pitch çapı / aksesuar pitch çapı). Yanlış girilirse '
      + 'bütün güç ve gerilme sonuçları aynı oranda kayar.'));
}

// ── MOTOR KÜNYESİ ───────────────────────────────────────────────────────────
// Sayfadaki "Engine Info" tablosunun karşılığı. HANGİSİNİN HESABA GİRDİĞİ
// AÇIKÇA YAZILI: model yarı-statiktir, ivmelenme/yavaşlama ve krank ataleti
// geçici rejim girdileridir ve bu çekirdek onları KULLANMIYOR. Sessizce alan
// açıp "girdim, hesaba girdi" izlenimi vermek, hiç sormamaktan kötü olurdu.
//
// DÖRT DEVİR SINIRI 2026-09-01'DE EKLENDİ ve ölü alan DEĞİL: `governedRpm` ve
// `overspeedRpm` iki uygunluk kapısını besliyor (js/fead-checks.js). Boş
// bırakılırsa kapılar "değerlendirilemedi" der — uygun saymaz.
function veFeadEngineCard(node){
  return _feadCard('Motor Künyesi', 'sayfadaki Engine Info', 'var(--text-secondary)',
      veFeadEngineLibRow(node)
    + _feadGrid(node, [
        { key:'cylinders',   label:'Silindir sayısı [—]', ph:'6', step:'1' },
        { key:'serviceFact', label:'Servis faktörü [—]',  ph:'1.3', step:'0.01' }
      ], 2)
    + _feadGrid(node, [
        { key:'idleRpm',           label:'Rölanti [d/dk]',   ph:'700',  step:'10' },
        { key:'governedRpm',       label:'Governed [d/dk]',  ph:'2100', step:'10' },
        { key:'noLoadGovernedRpm', label:'No load gov.',     ph:'2330', step:'10' },
        { key:'overspeedRpm',      label:'Overspeed',        ph:'2900', step:'10' }
      ], 4)
    + _feadGrid(node, [
        { key:'crankInertia', label:'Krank ataleti [kg·m²]', ph:'0.70', step:'0.01' },
        { key:'accelRpmS',    label:'İvmelenme [RPM/s]',     ph:'1000', step:'10' },
        { key:'decelRpmS',    label:'Yavaşlama [RPM/s]',     ph:'1000', step:'10' }
      ], 3)
    + _feadHint('<b>Silindir sayısı</b> ateşleme frekansını verir (f = devir/60 × silindir/2, '
        + 'dört zamanlı) ve span rezonans kontrolünde KULLANILIR. <b>Servis faktörü</b> kayma '
        + 'emniyeti için istenen alt sınır olarak sonuç sekmesinde karşılaştırılır. '
        + '<b>Governed</b> ve <b>Overspeed</b> devirleri aksesuar devir penceresi ve devir '
        + 'sınırı kapılarını besler. <b>Krank ataleti · ivmelenme · yavaşlama</b> geçici rejim '
        + 'girdileridir; bu çekirdek yarı-statiktir ve onları <b>hesaba katmaz</b> — modelin '
        + 'künyesinde kayıtlı kalırlar.'));
}

// ── MOTOR KATALOĞU SATIRI ───────────────────────────────────────────────────
// Katalog bir KISIT değil bir ÖNERİ (kayış ve gergi kütüphaneleriyle aynı
// kural): seçim yapmak alanları doldurur, ama kullanıcı sonra hepsini elle
// değiştirebilir. Değiştirdiğinde SUSMUYORUZ — `veFeadEngineDrift` sapan
// alanları sayar ve satır bunu yazar; sessiz kalmak "katalogdan geldi"
// izlenimi bırakırdı.
function veFeadEngineLibRow(node){
  if(typeof veFeadEngineList !== 'function')
    return _feadHint('Motor kataloğu yüklenmedi (js/fead-engines.js).');
  var sd = node.data || {};
  var liste = veFeadEngineList();
  var sec = sd.engineLib || '';
  var h = '<div style="display:flex; align-items:center; gap:10px; margin-bottom:9px;">'
    + '<div style="flex:1; font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">'
    + 'BMC motor kataloğu</div>'
    + '<select onchange="veFeadApplyEngineLib(\'' + node.id + '\',this.value)"'
    + ' style="width:260px; ' + _FEAD_INP + ' text-align:left;">'
    + '<option value="">— elle gir —</option>';
  liste.forEach(function(r){
    h += '<option value="' + _feadEsc(r.key) + '"' + (r.key === sec ? ' selected' : '') + '>'
       + _feadEsc(r.label) + '</option>';
  });
  h += '</select></div>';

  var d = (typeof veFeadEngineDrift === 'function') ? veFeadEngineDrift(sd) : null;
  if(d && d.drift.length)
    h += _feadHint('<b style="color:var(--accent-warning);">Katalogdan sapıldı:</b> '
      + _feadEsc(d.drift.join('; ')) + '. Bu bir hata değil — kayıt varyanta göre '
      + 'değişebilir; ama bir yazım hatası da tam burada görünür.');
  else if(d)
    h += _feadHint('Alanlar <b>' + _feadEsc(d.ad) + '</b> kaydıyla birebir.');
  return h + _feadHint('Yirmi dört motor, BMC\'nin kendi FEAD hesap defterinin '
    + '<i>Motor Bilgileri</i> sayfasından. Seçim <b>silindir sayısını, dört devir sınırını ve '
    + 'birinci kademe çaplarını</b> yazar; kasnak koordinatlarına ve kayışa <b>dokunmaz</b>.');
}

// Katalogdan motor uygula. Boş değer bağı çözer, alanları SİLMEZ — kullanıcı
// katalog değerinden başlayıp üstünde oynamak isteyebilir.
function veFeadApplyEngineLib(nodeId, key){
  var n = _feadSolverNode(nodeId); if(!n) return;
  if(!n.data) n.data = {};
  if(!key){ delete n.data.engineLib; delete n.data.engineLibVer; }
  else if(typeof veFeadEngineApply === 'function'){
    if(!veFeadEngineOf(key)) return;
    veFeadEngineApply(n.data, key);
    if(typeof showToast === 'function')
      showToast(veFeadEngineOf(key).ad + ' künyesi yüklendi', 'success');
  }
  _feadRedraw(n);
}

// ── ÇALIŞMA ÇEVRİMİ TABLOSU ─────────────────────────────────────────────────
// Satır = devir noktası. Sütunlar: devir · %zaman · °C · aksesuar başına kW.
// SÜRÜCÜ SÜTUNU YOK — gücü diğerlerinin toplamı olarak çekirdek hesaplar;
// elle girilirse çevrim kapanmaz ve çekirdek reddeder.
// Boş bırakılan aksesuar hücresi: katalog seçiliyse oradan doldurulur (devir
// kasnak ÇAPLARINDAN gelir, elle oran girilmez), yoksa 0 sayılır.
function veFeadDutyEditor(node, build){
  var rows = veFeadDutyRows(node);
  // AKSESUAR SÜTUNLARI ORAN SİSTEMİNDEN DE ÇIKAR. Kapı `build.ok` iken yarım
  // modelde tabloda HİÇ kW sütunu olmuyordu; oysa hangi kasnağın sürücü
  // olduğu ve devri koordinatlardan bağımsız (bkz. veFeadRatioSys).
  var _rsys = build.sys || build.ratioSys;
  var _crk = _rsys ? (_rsys._crkIdx != null ? _rsys._crkIdx : -1) : -1;
  var yuk = _rsys ? build.order.filter(function(n, i){ return i !== _crk; }) : [];
  var yukIdx = {};
  if(_rsys) build.order.forEach(function(n, i){ yukIdx[n.id] = i; });

  // ── ÇEVRİM SEÇİCİ — sihirbazdaki kartın AYNI kütüphanesi ────────────────
  // İki yüzey aynı listeyi farklı adlandırsaydı kullanıcı sihirbazda seçtiği
  // çevrimi panelde bulamazdı (gergi künyesi turunda ölçülmüş sınıf).
  var dLib = (typeof veFeadDutyList === 'function') ? veFeadDutyList() : [];
  var dSuan = (typeof veFeadDutyMatch === 'function') ? veFeadDutyMatch(rows) : null;
  var dSec = '';
  if(dLib.length){
    var dOps = dLib.map(function(r){
      return '<option value="' + _feadEsc(r.key) + '"' + (r.key === dSuan ? ' selected' : '')
        + '>' + _feadEsc(veFeadDutyLabel(r)) + '</option>'; }).join('');
    // "Özel" bir seçenek değil bir OKUMA: tablo elle düzenlenmişse hiçbir
    // kayda uymaz ve seçici bunu söyler.
    if(!dSuan) dOps = '<option value="" selected>&mdash; özel (elle düzenlendi) &mdash;</option>' + dOps;
    dSec = '<div style="margin-bottom:7px;">'
      + '<label style="display:block; font-size:var(--fs-micro); color:var(--text-secondary); margin-bottom:3px;">'
      + 'Çevrim kaydı</label>'
      + '<select onchange="if(this.value) veFeadDutyLib(\'' + node.id + '\', this.value)"'
      + ' style="width:100%; ' + _FEAD_INP + ' height:24px;">' + dOps + '</select></div>';
  }

  var h = dSec + '<table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; border:1px solid var(--border-color);">';
  h += '<tr style="background:var(--bg-tertiary);">'
     + ['Devir', '%zaman', '°C'].map(function(t){
         return '<th style="padding:3px 4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-secondary);">' + t + '</th>';
       }).join('')
     + yuk.map(function(n){
         return '<th style="padding:3px 4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-secondary);" title="'
           + _feadEsc(_feadNodeName(n)) + ' [kW]">' + _feadEsc(_feadNodeName(n)) + '</th>';
       }).join('')
     + '<th style="padding:3px 4px; border:1px solid var(--border-color);"></th></tr>';

  if(!rows.length){
    h += '<tr><td colspan="' + (4 + yuk.length) + '" style="padding:9px; text-align:center; color:var(--text-muted); border:1px solid var(--border-color);">'
       + 'Henüz devir noktası yok.</td></tr>';
  }
  rows.forEach(function(r, ri){
    var cell = function(key, val, step){
      return '<td style="padding:1px 2px; border:1px solid var(--border-color);">'
        + '<input type="number" value="' + _feadEsc(val) + '" step="' + (step || 'any') + '"'
        + ' onchange="veFeadDutySet(\'' + node.id + '\',' + ri + ',\'' + key + '\',this.value)"'
        + ' style="width:100%; ' + _FEAD_INP + ' height:22px; padding:2px 3px;"></td>';
    };
    h += '<tr>' + cell('rpm', r.rpm, '10') + cell('dcPct', r.dcPct, '0.1') + cell('degC', r.degC, '1');
    yuk.forEach(function(n){
      var v = (r.kw && r.kw[n.id] != null) ? r.kw[n.id] : '';
      // ORAN SİSTEMİ, ÇÖZÜLMÜŞ SİSTEM DEĞİL: aksesuar devri `driveRatio ·
      // r_sürücü / r_i`, yani salt çaptan geliyor — koordinatlar girilmeden de
      // bilinir. Kapı `build.ok` iken yarım modelde katalog değeri HİÇ
      // görünmüyordu (sihirbazda ölçülmüş sınıfın aynısı). `build.sys` varsa
      // `ratioSys` ona eşit, yani çözülmüş modelde davranış birebir eski.
      var _rs = build.sys || build.ratioSys;
      var oto = (v === '' && _rs) ? veFeadAutoKw(_rs, yukIdx[n.id], n, r.rpm) : null;
      h += '<td style="padding:1px 2px; border:1px solid var(--border-color);">'
        + '<input type="number" value="' + _feadEsc(v) + '" step="0.01"'
        + (oto != null ? ' placeholder="' + _feadFmt(oto, 2) + '"' : ' placeholder="0"')
        + ' title="' + (oto != null ? 'Katalogdan: ' + _feadFmt(oto, 2) + ' kW (boş bırakırsanız bu kullanılır)' : 'Boş = 0 kW')
        + '" onchange="veFeadDutySet(\'' + node.id + '\',' + ri + ',\'kw:' + n.id + '\',this.value)"'
        + ' style="width:100%; ' + _FEAD_INP + ' height:22px; padding:2px 3px;'
        + (oto != null && v === '' ? ' color:var(--text-muted);' : '') + '"></td>';
    });
    h += '<td style="padding:1px 3px; border:1px solid var(--border-color); text-align:center;">'
      + '<button onclick="veFeadDutyRemove(\'' + node.id + '\',' + ri + ')" title="Satırı sil"'
      + ' style="background:none; border:none; color:var(--accent-danger); cursor:pointer; font-size:var(--fs-body); line-height:1;">×</button></td></tr>';
  });
  h += '</table>';

  var toplam = rows.reduce(function(a, r){ return a + r.dcPct; }, 0);
  h += '<div style="display:flex; gap:6px; margin-top:7px;">'
    + '<button onclick="veFeadDutyAdd(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:var(--fs-micro); '
    + 'background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">+ Devir satırı</button>'
    + '<button onclick="veFeadDutyFillCatalog(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:var(--fs-micro); '
    + 'background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;" '
    + 'title="Boş kW hücrelerini seçili katalog eğrilerinden doldur">Katalogdan doldur</button>'
    + '</div>';

  var uyari = '';
  if(rows.length && Math.abs(toplam - 100) > 0.5)
    uyari = _feadHint('<b style="color:var(--accent-warning);">%zaman toplamı ' + _feadFmt(toplam, 1)
      + '</b> — 100 değil. Yorulma ve ömür payları bu ağırlıklara göre dağıtılır; '
      + 'toplam 100 değilse mutlak ömür ölçeklenir (dağılım yüzdeleri etkilenmez).');

  return _feadCard('Çalışma Çevrimi', 'sürücü sütunu YOK — gücü hesaplanır', 'var(--accent-success)',
    h + uyari
    + _feadHint('Boş bırakılan kW hücresi: aksesuarda katalog modeli seçiliyse o eğriden '
        + 'doldurulur (aksesuar devri kasnak <b>pitch çaplarından</b> hesaplanır, elle oran '
        + 'girilmez), seçili değilse 0 sayılır.'));
}

// Modelin çekirdeğe göre durumu — sayarken TİPE değil ROLE bakılır.
function veFeadModelTable(build){
  var all = (typeof nodes !== 'undefined') ? nodes : [];
  var pulleys = (build && build.order) || [];
  var say = function(pred){ return all.filter(pred).length; };
  var drv = pulleys.filter(function(n){ return n.data && n.data.driver; });
  var driver = veFeadResolveDriver(pulleys);

  function satir(ad, deger, ok){
    return '<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">' + ad + '</td>'
      + '<td style="padding:5px 8px; border:1px solid var(--border-color); font-weight:600; color:'
      + (ok ? 'var(--text-primary)' : 'var(--accent-warning)') + ';">' + deger + '</td></tr>';
  }
  var h = '<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color);">';
  h += satir('Kayış yolundaki kasnak', pulleys.length + ' adet', pulleys.length >= 3);
  h += satir('Sürücü', driver ? _feadEsc(_feadNodeName(driver)) + (drv.length ? '' : ' (tipten varsayıldı)') : 'yok',
             drv.length === 1);
  h += satir('Gergi', say(function(n){ return _feadDefOf(n).isFeadTensioner; }) + ' adet',
             say(function(n){ return _feadDefOf(n).isFeadTensioner; }) === 1);
  h += satir('Avara kasnak', say(function(n){ return _feadDefOf(n).isFeadIdler; }) + ' adet', true);
  h += satir('Kayış künyesi', say(function(n){ return _feadDefOf(n).isFeadBelt; }) ? 'tanımlı' : 'yok',
             say(function(n){ return _feadDefOf(n).isFeadBelt; }) > 0);
  var kaburgali = pulleys.filter(function(n){ return veFeadContactOf(n) === 'grooved'; }).length;
  h += satir('Temas tarafı', kaburgali + ' kaburgalı / ' + (pulleys.length - kaburgali) + ' sırttan', true);

  // GERGİ KOL AÇISI (girdi) ve ondan TÜREYEN serbest açı burada görünür.
  // Görünmezse "hangi sayı kullanıldı" sorusu panelde cevapsız kalırdı — bu
  // modülde en pahalı sessizlik tam olarak orada.
  if(Number.isFinite(build.armAbsDeg)){
    h += satir('Gergi kol çalışma açısı', _feadFmt(build.armAbsDeg, 2) + '° · girdi', true);
    if(build.pivot)
      h += satir('↳ gövde montaj konumu (türedi)',
        _feadFmt(build.pivot[0], 2) + ' / ' + _feadFmt(build.pivot[1], 2) + ' mm', true);
    if(Number.isFinite(build.freeAngleDeg))
      h += satir('↳ serbest açı (hesaba giren)', _feadFmt(build.freeAngleDeg, 2) + '°', true);
    if(build.ok && build.sys)
      h += satir('↳ dönüş yönü (sense)', (build.sys.tensioner.sense > 0 ? '+1' : '−1'), true);
  }
  if(build.drive)
    h += satir('Tahrik oranı', _feadFmt(build.drive.ratio, 4)
      + ' (' + veFeadDriveModeLabel(build.drive.mode) + ')', build.drive.ok);

  // TÜRETİLEN TASARIM GERGİNLİĞİ. Panelde artık alan yok; kullanıcının hesabın
  // hangi ankrajla kurulduğunu okuyacağı tek yer burası. Görünmezse "gerginlik
  // nereden geldi" sorusu cevapsız kalır — bu modülde en pahalı sessizlik türü.
  if(Number.isFinite(build.springTensionN) && build.springTensionN > 0)
    h += satir('Tasarım gerginliği (türetildi)',
      _feadFmt(build.springTensionN, 0) + ' N — yay dengesinden', true);
  else if(build.ok)
    h += satir('Tasarım gerginliği', 'türetilemedi', false);

  h += satir('Geometri', build.ok ? 'çözüldü' : 'çözülemedi', !!build.ok);
  return h + '</table>';
}

// Gates "Tensioner Geometry" tablosunun karşılığı: kol açısı, gergi kasnağı
// konumu, hubload, gerginlik, sarım. Bu tablo DUTY GEREKTİRMEZ — geometri ve
// yay dengesinden gelir, o yüzden çalışma çevrimi girilmeden de üretilebiliyor.
function veFeadPositionTable(build){
  var rows;
  try { rows = FEADCore.positionTable(build.sys); }
  catch(e){ return _feadHint('Konum tablosu üretilemedi: ' + _feadEsc(veFeadTranslateError(e && e.message))); }

  var ad = { FreeArm:'Serbest kol', Replace:'Değiştirme', MaxBelt:'Maks. kayış',
             Mean:'Ortalama', MinBelt:'Min. kayış', Load:'Load (mekanik stop)' };
  var h = '<table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; border:1px solid var(--border-color);">'
    + '<tr style="background:var(--bg-tertiary);">'
    + ['Konum','Kol [°]','Gerginlik [N]','Hubload [N]','Yön [°]','β [°]','Sarım [°]'].map(function(t){
        return '<th style="padding:4px 5px; border:1px solid var(--border-color); text-align:left; font-weight:600; color:var(--text-secondary);">'+t+'</th>';
      }).join('') + '</tr>';
  rows.forEach(function(r){
    var isLoad = r.position === 'Load';
    if(r.error){
      h += '<tr><td style="padding:4px 5px; border:1px solid var(--border-color);">' + (ad[r.position] || r.position) + '</td>'
        + '<td colspan="6" style="padding:4px 5px; border:1px solid var(--border-color); color:var(--accent-danger);">'
        + _feadEsc(veFeadTranslateError(r.error)) + '</td></tr>';
      return;
    }
    var sty = 'padding:4px 5px; border:1px solid var(--border-color); text-align:right;'
      + (isLoad ? ' color:var(--text-muted);' : '');
    h += '<tr><td style="padding:4px 5px; border:1px solid var(--border-color); color:'
      + (isLoad ? 'var(--text-muted)' : 'var(--text-primary)') + ';">' + (ad[r.position] || r.position) + '</td>'
      + '<td style="' + sty + '">' + _feadFmt(r.relDeg,1) + '</td>'
      + '<td style="' + sty + '">' + _feadFmt(r.tensionN,0) + '</td>'
      + '<td style="' + sty + '">' + _feadFmt(r.hubloadN,0) + '</td>'
      + '<td style="' + sty + '">' + _feadFmt(r.hubDirDeg,1) + '</td>'
      + '<td style="' + sty + '">' + _feadFmt(r.betaDeg,1) + '</td>'
      + '<td style="' + sty + '">' + _feadFmt(r.wrapDeg,1) + '</td></tr>';
  });
  h += '</table>';

  var mean = rows.filter(function(r){ return r.position === 'Mean'; })[0];
  var ek = mean && !mean.error
    ? _feadHint('Ortalama konumda take-up <b>' + _feadFmt(mean.takeupMmPerDeg,3) + ' mm/°</b> · '
        + 'yay momenti ' + _feadFmt(mean.springNm,2) + ' Nm · efektif tahrik boyu '
        + _feadFmt(mean.driveLenMm,1) + ' mm. <b>Load</b> bir MEKANİK STOP\'tur, çalışma noktası '
        + 'değildir: orada sarım sıfıra yaklaştığı için gerginlik tekilleşir.')
    : '';
  return _feadCard('Gergi Konum Tablosu', 'çalışma çevrimi gerektirmez', 'var(--accent-warning)', h + ek);
}

function getFeadExamplePropertiesHTML(node){
  if(!node.data) node.data = {};
  var html = '<div class="sw-panel">';
  // SIFIRDAN KURULUM YOLU BURADA DA DURUYOR: kullanıcı boş bir iç topolojide
  // önce bu panele bakıyor ("örnekler" en tanıdık kelime), ve kendi motorunu
  // kuracaksa aradığı şey burada yok. Düğme sihirbaz düğümüne DEĞİL doğrudan
  // sihirbaza gidiyor — paletten ikinci bir kutu aramak zorunda kalmasın.
  if(typeof veFeadWizOpen === 'function')
    html += _feadCard('Kendi Modelimi Kuracağım', 'adım adım', 'var(--accent-primary)',
        '<button onclick="veFeadWizOpenAny()" style="width:100%; padding:11px 14px; '
      + 'font-size:var(--fs-body); font-weight:700; border:none; cursor:pointer; '
      + 'border-radius:var(--radius-sm); background:var(--accent-primary); color:#fff;">'
      + '🧭 Başlangıç Sihirbazını Aç</button>'
      + _feadHint('Kasnak koordinatlarından çalışma çevrimine kadar bütün girdileri '
        + 'yedi adımda sorar ve her adımda modeli <b>canlı çözer</b>. Aşağıdaki hazır '
        + 'örnekler ise tek tıkla kurulur — sihirbazın ilk adımından da '
        + 'doldurulabilirler.'));
  veFeadExampleKeys().forEach(function(k){
    var ex = veFeadExampleOf(k);
    var kasnak = ex.pulleys.length;
    var egri = ex.pulleys.filter(function(p){ return p.data && p.data.pwrCurve; }).length;
    // Aksesuar gücü İKİ YOLDAN gelebiliyor: kasnağın kendi devir→kW eğrisinden
    // (tedarikçi sayfasının biçimi) ya da duty satırına doğrudan yazılmış kW'dan
    // (Gates raporunun biçimi). Kart yalnız eğriyi sayarsa raporlu örnek
    // "0 aksesuar" der ve boş görünür; ikisi ayrı ayrı yazılıyor.
    var dutyKw = 0;
    (ex.solver.duty || []).forEach(function(r){
      var m = r && (r.kwByKey || r.kw);
      if(m) dutyKw = Math.max(dutyKw, Object.keys(m).filter(function(k){ return m[k] > 0.05; }).length);
    });
    // Birinci kademe SATIRI koşullu: 'derive' kipinde iki çap yazılır, 'direct'
    // kipinde o iki alan YOKTUR ve ham basmak "undefined / undefined mm"
    // üretiyordu. Oran her iki kipte de tek kaynaktan (veFeadDriveRatio).
    var dr = veFeadDriveRatio(ex.solver);
    var kademe = (dr.mode === 'derive' && dr.crankOD > 0 && dr.fanOD > 0)
      ? ('birinci kademe: ' + dr.crankOD + ' / ' + dr.fanOD + ' mm (oran '
         + dr.ratio.toFixed(3) + ')')
      : ('tahrik oranı: ' + dr.ratio.toFixed(3)
         + ' — devir sütunu SÜRÜCÜ KASNAK devri');
    var b = ex.belt || {};
    var kayis = 'kayış: ' + _feadEsc(b.beltType || ((b.ribs || '?') + b.profile))
      + ' · ' + b.effLength + ' mm'
      + ' · tolerans ' + (b.tolerance > 0 ? '±' + b.tolerance + ' mm' : 'YOK')
      + ' · aşınma ' + (b.wearPct > 0 ? '%' + (b.wearPct * 100).toFixed(2) : 'YOK');
    html += _feadCard(_feadEsc(ex.name), kasnak + ' kasnak', 'var(--accent-success)',
        '<div style="font-size:var(--fs-micro); color:var(--text-secondary); line-height:1.5; margin-bottom:9px;">'
      + _feadEsc(ex.note) + '</div>'
      + '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.6; margin-bottom:10px;">'
      + '• kasnak koordinatları + çaplar + temas tarafı<br>'
      + '• gergi: avara merkezi, kol boyu + çalışma açısı, yay künyesi<br>'
      + '• ' + kayis + '<br>'
      + '• ' + (egri ? egri + ' aksesuarın devir → kW eğrisi'
                     : dutyKw + ' aksesuarın kW\'ı duty satırında') + '<br>'
      + '• çalışma çevrimi: ' + ex.solver.duty.length + ' devir noktası<br>'
      + '• ' + kademe + '</div>'
      + '<button onclick="veFeadLoadExample(\'' + _feadEsc(k) + '\')" style="width:100%; padding:11px 16px; '
      + 'font-size:var(--fs-body); font-weight:700; letter-spacing:0.02em; border:none; cursor:pointer; '
      + 'background:var(--accent-success); color:#fff;">İç topolojiye kur</button>'
      + _feadHint('<b>Mevcut kasnakların üzerine eklenir</b>, silinmez — boş bir iç topolojide '
        + 'kurmak en temizidir.'));
  });
  html += '</div>';
  return html;
}

// ── ÖRNEĞİ KANVASA KUR ──────────────────────────────────────────────────────
// Örnek tanımı js/fead-model.js'te (VE_FEAD_EXAMPLES); burada YALNIZ kanvasa
// yerleştirme var. Kasnaklar kayış düzlemindeki GERÇEK koordinatlarına oranlı
// yerleştirilir: kanvasta gördüğü şekil sayfadaki yerleşimin ta kendisi olsun.
// (Kanvas y aşağı doğru artar, kayış düzlemi yukarı — bu yüzden y ters çevrilir.)
// Sihirbazı düğüm KİMLİĞİ olmadan açar: kanvasta bir sihirbaz düğümü varsa
// onun taslağı sürer (yarım kalan iş kaybolmaz), yoksa paletten bir tane kurar.
// Taslağın bir düğümde durması ŞART — kaydedilen proje onu taşıyor.
function veFeadWizOpenAny(){
  if(typeof veFeadWizOpen !== 'function' || typeof nodes === 'undefined') return false;
  var n = nodes.filter(function(x){ return (_feadDefOf(x) || {}).isFeadWizard; })[0];
  if(!n && typeof createNode === 'function'){
    var base = (typeof veArrangeModuleBase === 'function')
      ? veArrangeModuleBase([{ lx: 0, ly: 0 }]) : { x: 3000, y: 3000 };
    var once = nodes.length;
    createNode('fead-wizard', base.x, base.y);
    if(nodes.length > once){
      n = nodes[nodes.length - 1];
      if(typeof saveState === 'function') saveState();
    }
  }
  if(!n) return false;
  return veFeadWizOpen(n.id);
}

function veFeadLoadExample(key){
  if(typeof createNode !== 'function') return null;
  var pack = veFeadExampleNodes(key);
  if(!pack){ if(typeof showToast === 'function') showToast('Örnek bulunamadı: ' + key, 'error'); return null; }

  var xs = [], ys = [];
  pack.example.pulleys.forEach(function(p){
    var d = p.data;
    // Gergide kutunun gösterdiği nokta AYRI bir okuyucudan geliyor
    // (veFeadTensionerBoxMm): gerginin `x/y`si yoktur, koordinatı `cenX/cenY`
    // alanında durur. Satır içi okunsaydı burası sessizce (0,0)'a düşerdi.
    var kutuMm = (d.x != null) ? null : veFeadTensionerBoxMm(d);
    var x = (d.x != null) ? _feadNum(d.x, 0) : (kutuMm ? kutuMm[0] : 0);
    var y = (d.y != null) ? _feadNum(d.y, 0) : (kutuMm ? kutuMm[1] : 0);
    xs.push(x); ys.push(y);
  });
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);

  // ── ÖLÇEK 1 px = 1 mm, "GÖRÜNÜME SIĞDIRAN" DEĞİL ────────────────────────
  //
  // Burada eskiden kümeyi 520×400'lük bir kutuya sığdıran bir ölçek vardı
  // (BMC'de ×1.1178) ve kutular köşe koordinatıyla diziliyordu. Kanvas artık
  // KAYIŞ DÜZLEMİ olduğu için bu sessiz bir TUTARSIZLIK üretiyordu: örnek
  // yüklenir yüklenmez kutunun kanvastaki yeri, düğümün taşıdığı mm
  // koordinatını YALANLIYORDU.
  //
  // ÖLÇÜLDÜ (gerçek tarayıcı, BMC, sürüklemeden ÖNCE):
  //   alternatör merkezi − krank merkezi = −319.108 px
  //   alternatör mm koordinatı           = −281.000 mm      → 38.108 mm FARK
  //
  // Fark = ölçek payı (−281 × 0.1178 = −33.11) + kutu genişliği payı
  // ((54−72)/2 = −5.00). İlk sürüklemede `veFeadSyncMmFromCanvas` kanvası
  // okuyup mm'yi tazelediği için o 38.108 mm koordinatın üstüne SESSİZCE
  // biniyordu: kullanıcı 60 px sürüklüyor, model 98 mm oynuyordu.
  //
  // Yerleştirme artık TEK NOKTADAN: aşağıdaki `veFeadArrangeByCoords` — yani
  // "Otomatik Düzenle"nin ve panel düzenlemesinin kullandığı yolun ta kendisi.
  // Buradaki dizi yalnız `createNode`'un ilk karesi ve o yol çalışamazsa
  // (iki kasnaktan az koordinat) geçerli kalan yedek; ölçeği bu yüzden 1.
  var s = (typeof VE_FEAD_PX_PER_MM === 'number') ? VE_FEAD_PX_PER_MM : 1;

  var yer = pack.example.pulleys.map(function(p, i){
    return { lx: 60 + (xs[i] - minX) * s, ly: 150 + (maxY - ys[i]) * s };
  });
  // Araç kutuları. SIRA pack.nodes ile aynı olmak ZORUNDA — veFeadExampleNodes
  // kasnakları önce, araçları (kayış künyesi · çözücü · kayış yolu) sonra ekliyor.
  //
  // KAYIŞ YOLU KARTI AYRI ŞERİTTE: 440×500'lük canlı şema üst şeride konsa
  // kasnak kümesinin üstüne biner ve komşu düğümlerin portları/rozetleri kartın
  // üstünde görünür (ölçüldü). Kullanıcının istediği yer de bu: topolojinin
  // YANINDA, kendi alanında duran bir çizim.
  var araclar = pack.nodes.length - pack.example.pulleys.length;
  var sagSerit = 60 + (maxX - minX) * s + 110;
  var ust = 0;
  for(var t = 0; t < araclar; t++){
    var tip = pack.nodes[pack.example.pulleys.length + t].type;
    var td = (typeof componentDefs !== 'undefined' && componentDefs[tip]) || {};
    if(tip === 'fead-layout'){
      // Ölçü de veriliyor: yoksa veArrangeModuleBase kartı 65×60 sayıp grubu
      // yanlış ortalıyor ve kart görünür alanın sağından taşıyor.
      yer.push({ lx: sagSerit, ly: 150, w: td.defaultWidth, h: td.defaultHeight });
    } else {
      // ARAÇLAR SOL ŞERİTTE, KASNAK KÜMESİNİN DIŞINDA. Eskiden kümenin ÜSTÜNE
      // bir sıra hâlinde diziliyorlardı (ly:20) ve "Başlangıç ve Örnekler"
      // kutusu tam kayış yolunun üstüne düşüyordu: tel kutunun arkasından
      // geçiyor, ikisi de okunmuyordu (ölçüldü — Klima ile Avara 1 arasındaki
      // açıklık oradan geçiyor). Sol şerit kümeyle hiç kesişmiyor.
      yer.push({ lx: -150, ly: 150 + ust * 96 });
      ust++;
    }
  }

  var base = (typeof veArrangeModuleBase === 'function')
    ? veArrangeModuleBase(yer) : { x:3000, y:3000 };

  // İÇ TOPOLOJİDE ZATEN DURAN ARAÇ DÜĞÜMLERİ DE SOL ŞERİDE — kullanıcının kendi
  // eklediği kasnaklara dokunulmuyor. Bu yalnız bir YEDEK yerleşim: asıl işi
  // aşağıdaki `veFeadArrangeByCoords` yapıyor ve o, araç düğümlerini kümenin
  // dışındaki iki şeride koyuyor. Yerleştirici çalışamazsa (iki kasnaktan az
  // koordinat) geçerli kalan sıra budur.
  //
  // `isFeadExample` BURADA ARANMAZ: o düğüm birkaç satır aşağıda siliniyor,
  // yani taşınacak bir şey yok. Listede tutulsaydı önce taşınıp sonra silinen
  // bir kutu olurdu ve yukarıdaki gerekçe onu hâlâ "sol şeride alınıyor" diye
  // anlatırdı — kodun kendi kaydını yalanlaması.
  var _eskiArac = [];
  if(typeof nodes !== 'undefined') {
    nodes.forEach(function(n){
      var d0 = _feadDefOf(n);
      if(d0.isFeadBelt || d0.isFeadSolver || d0.isFeadReport || d0.isFeadCoordLink)
        _eskiArac.push(n);
    });
  }
  _eskiArac.forEach(function(n, i){
    n.x = Math.round(base.x - 150);
    n.y = Math.round(base.y + 150 + (ust + i) * 96);
    var el = (typeof document !== 'undefined') ? document.getElementById(n.id) : null;
    if(el){ el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
  });

  var kuruldu = [], idMap = {};
  pack.nodes.forEach(function(src, i){
    var before = (typeof nodes !== 'undefined') ? nodes.length : 0;
    createNode(src.type, base.x + yer[i].lx, base.y + yer[i].ly);
    if(typeof nodes === 'undefined' || nodes.length <= before) return;
    var yeni = nodes[nodes.length - 1];
    yeni.data = JSON.parse(JSON.stringify(src.data));
    if(src.customName){
      yeni.customName = src.customName;
      // KANVAS ETİKETİ ELLE TAZELENİR: createNode etiketi tip adıyla basıyor,
      // customName'i sonradan atamak DOM'u güncellemiyor. Tazelenmezse iki
      // avara kasnak da "Avara Kasnak" görünür — hesap doğru çalışır (adlar
      // veFeadUniqueNames'te tekilleşir) ama kullanıcı hangi avaranın hangi
      // koordinatta olduğunu kanvasta AYIRT EDEMEZ.
      var el = (typeof document !== 'undefined') ? document.getElementById(yeni.id) : null;
      var lbl = el && el.querySelector('.ve-node-label');
      if(lbl) lbl.textContent = src.customName;
    }
    idMap[src.id] = yeni.id;
    kuruldu.push(yeni);
  });

  // DUTY kW SÖZLÜĞÜ KİMLİK GÖÇÜNDEN GEÇMEK ZORUNDA. Yukarıdaki döngü her düğümü
  // YENİ bir kimlikle kuruyor (createNode kendi kimliğini üretir) ama data'yı
  // birebir kopyalıyor; kW sözlüğü ise düğüm kimliğiyle anahtarlı. Göç
  // yapılmazsa hiçbir aksesuar eşleşmez ve hepsi 0 kW ile koşar — çözüm yine
  // üretilir, yalnız bütün gerginlikler tasarım gerginliğine düzleşir. Göç
  // ancak idMap TAMAMLANDIKTAN sonra yapılabilir (çözücü düğümü de aynı
  // döngüde kuruluyor), bu yüzden döngünün İÇİNDE değil, burada.
  kuruldu.forEach(function(n){
    if(n.data && Array.isArray(n.data.duty)) veFeadRemapDutyKw(n.data.duty, idMap);
  });

  if(typeof createConnection === 'function'){
    pack.connections.forEach(function(c){
      if(idMap[c.from] && idMap[c.to]) createConnection(idMap[c.from], idMap[c.to]);
    });
  }
  // ── "BAŞLANGIÇ VE ÖRNEKLER" DÜĞÜMÜ İŞİNİ BİTİRDİ ────────────────────────
  //
  // O düğüm bir AÇILIŞ yüzeyi: alt topoloji ilk açıldığında tek başına gelir
  // (veFeadPopulateStarter) ve tek işi buradaki örnek listesini sunmaktır.
  // Örnek kurulduktan sonra kanvasta kalması iki şey yapıyordu: sol şeritte
  // yer kaplıyor, ve kullanıcıya "buradan devam et" diyen bir düğme gibi
  // duruyordu — oysa devam edilecek yer artık kurulmuş modelin kendisi.
  //
  // Bağlantısı YOK (fead-example girişsiz/çıkışsız), o yüzden silmek diziden
  // ve DOM'dan çıkarmakla bitiyor; deleteSelectedNodes'un sensör/parametrik
  // temizliğine ihtiyaç yok ve o fonksiyon `selectedNodes` global'ini de
  // tüketiyor (burada seçim kullanıcınındır, ona dokunulmaz).
  //
  // SPLICE, YENİDEN ATAMA DEĞİL: `nodes = nodes.filter(...)` global'i yeni bir
  // diziye bağlar; bu dosya ile onu tutan diğer modüller tarayıcıda aynı
  // global'i paylaştığı için çalışır ama Node testinde `global.nodes` bayat
  // kalır. Yerinde mutasyon iki ortamda da aynı şeyi yapıyor.
  //
  // SIRASI: yerleştiriciden ÖNCE. Sonra silinseydi sol şeritte ona ayrılmış
  // boş bir sıra kalır, altındaki iki kutu bir kademe aşağıda dururdu.
  if(typeof nodes !== 'undefined' && nodes){
    for(var _i = nodes.length - 1; _i >= 0; _i--){
      if(!_feadDefOf(nodes[_i]).isFeadExample) continue;
      var _el = (typeof document !== 'undefined') ? document.getElementById(nodes[_i].id) : null;
      if(_el) _el.remove();
      nodes.splice(_i, 1);
    }
    if(typeof selectedNodes !== 'undefined' && Array.isArray(selectedNodes)){
      // Silinen düğüm seçiliyse seçimde bayat referans kalmasın (panel onu
      // gösterip "bileşen bulunamadı" durumuna düşerdi).
      for(var _k = selectedNodes.length - 1; _k >= 0; _k--)
        if(nodes.indexOf(selectedNodes[_k]) < 0) selectedNodes.splice(_k, 1);
    }
  }

  // KUTULARI KOORDİNATLARINA OTURT — kanvas ile mm ilk kareden itibaren AYNI
  // şeyi söylesin. Sessiz kip: saveState/toast/kamera bu fonksiyonun kendisine
  // ait (ikinci bir undo adımı ve üst üste iki bildirim istenmiyor).
  if(typeof veFeadArrangeByCoords === 'function'){
    try { veFeadArrangeByCoords({ silent: true }); } catch(e){ /* yedek: yukarıdaki sıra */ }
  }
  if(typeof updateAllConnections === 'function') updateAllConnections();
  if(typeof veFeadRefreshBadges === 'function') veFeadRefreshBadges();
  _feadForgetResults();
  if(typeof veFitViewToContent === 'function') veFitViewToContent();
  if(typeof saveState === 'function') saveState();
  if(typeof showToast === 'function')
    showToast(pack.example.name + ' kuruldu — ' + kuruldu.length + ' bileşen, '
      + pack.connections.length + ' kayış bağlantısı.', 'success');
  return kuruldu;
}


// ════════════════════════════════════════════════════════════════════════════
//  ÇALIŞMA ÇEVRİMİ — DÜZENLEME
// ════════════════════════════════════════════════════════════════════════════
function _feadSolverNode(nodeId){
  if(typeof nodes === 'undefined') return null;
  var n = nodes.find(function(x){ return x.id === nodeId; });
  if(!n) return null;
  if(!n.data) n.data = {};
  if(!Array.isArray(n.data.duty)) n.data.duty = [];
  veFeadDutySeed(n);
  return n;
}

// ── ÇALIŞMA ÇEVRİMİ BOŞ AÇILMAZ ────────────────────────────────────────────
//
// Kullanıcı bildirimi (2026-08-31): *"…çalışma çevrimini otomatik olarak
// hesaplamıyor. El ile girmek gerekiyor. Bu olmamalı."* Tablo boş açıldığı
// için aksesuar modeli seçilse bile doldurulacak satır yoktu.
//
// TEK SEFERLİK ve YALNIZ BOŞ TABLOYA: `dutySeeded` bayrağı olmadan, kullanıcı
// bütün satırları bilerek sildiğinde tablo her panel açılışında geri gelirdi.
// Dolu bir tabloya HİÇ dokunulmuyor — kaydedilmiş her proje birebir eski
// davranışını sürdürüyor.
function veFeadDutySeed(n){
  if(!n || !n.data) return false;
  // Diziyi BURADA normalleştiriyoruz: fonksiyon iki ayrı yerden çağrılıyor
  // (panel kurulumu ve eylem yolu) ve dışarıdan da çağrılabiliyor; normalleşme
  // çağıranlara bırakılsaydı biri unutulduğunda sessiz bir TypeError olurdu.
  if(!Array.isArray(n.data.duty)) n.data.duty = [];
  if(n.data.dutySeeded) return false;
  n.data.dutySeeded = true;
  if(n.data.duty.length) return false;
  if(typeof veFeadDutyRowsOf !== 'function') return false;
  var key = n.data.dutyLib || (typeof VE_FEAD_DUTY_DEFAULT !== 'undefined'
    ? VE_FEAD_DUTY_DEFAULT : '');
  var rows = veFeadDutyRowsOf(key);
  if(!rows.length) return false;
  n.data.duty = rows;
  n.data.dutyLib = key;
  return true;
}

// Kütüphaneden çevrim uygula. kW TAŞINIR: devri tutan satırların kayıtlı
// ölçümü korunur, yoksa çevrim değiştirmek rapordan gelen güç tablosunu
// sessizce silerdi.
function veFeadDutyLib(nodeId, key){
  var n = _feadSolverNode(nodeId); if(!n) return;
  if(typeof veFeadDutyRowsOf !== 'function') return;
  var rows = veFeadDutyRowsOf(key);
  if(!rows.length) return;
  var eski = {};
  n.data.duty.forEach(function(r){
    if(r.kw && Object.keys(r.kw).length) eski[_feadNum(r.rpm, NaN)] = r.kw;
  });
  rows.forEach(function(r){ if(eski[r.rpm]) r.kw = eski[r.rpm]; });
  n.data.duty = rows;
  n.data.dutyLib = key;
  if(typeof showToast === 'function')
    showToast(rows.length + ' devir noktası yüklendi', 'success');
  _feadRedraw(n);
}
function _feadRedraw(node){
  if(typeof saveState === 'function') saveState();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
}

function veFeadDutyAdd(nodeId){
  var n = _feadSolverNode(nodeId); if(!n) return;
  var son = n.data.duty[n.data.duty.length - 1];
  // Yeni satır son satırın devamı gibi başlasın (boş kutuya bakmaktan iyi):
  // devir bir kademe yukarı, sıcaklık aynı.
  n.data.duty.push({
    rpm: son ? _feadNum(son.rpm, 800) + 250 : 800,
    dcPct: '', degC: son ? son.degC : 90, kw: {}
  });
  _feadRedraw(n);
}
function veFeadDutyRemove(nodeId, idx){
  var n = _feadSolverNode(nodeId); if(!n) return;
  n.data.duty.splice(idx, 1);
  _feadRedraw(n);
}
function veFeadDutySet(nodeId, idx, key, val){
  var n = _feadSolverNode(nodeId); if(!n) return;
  var row = n.data.duty[idx]; if(!row) return;
  if(key.indexOf('kw:') === 0){
    if(!row.kw) row.kw = {};
    var pid = key.slice(3);
    if(val === '' || val === null) delete row.kw[pid]; else row.kw[pid] = val;
  } else {
    row[key] = val;
  }
  if(typeof saveState === 'function') saveState();
  // Paneli YENİDEN ÇİZMİYORUZ: kullanıcı hücreler arasında sekme ile geziniyor,
  // her değişiklikte yeniden çizmek odağı kaybettirir. Sonuç bloğu bir sonraki
  // ▶ Hesapla ile tazelenir.
}

// Boş kW hücrelerini katalogdan doldur — kullanıcı sayıları GÖRSÜN, yer
// tutucuda kalmasın (yer tutucu kaydedilmiyor, değer kaydediliyor).
function veFeadDutyFillCatalog(nodeId){
  var n = _feadSolverNode(nodeId); if(!n) return;
  var build = veFeadBuildFromCanvas();
  if(!build.ok){
    if(typeof showToast === 'function') showToast('Model çözülemeden katalog doldurulamaz', 'error');
    return;
  }
  var say = 0;
  n.data.duty.forEach(function(row){
    if(!row.kw) row.kw = {};
    build.order.forEach(function(pn, i){
      if(build.sys.pulleys[i] && build.sys.pulleys[i].crank) return;
      if(row.kw[pn.id] != null && row.kw[pn.id] !== '') return;      // kullanıcının değeri korunur
      var kw = veFeadAutoKw(build.sys, i, pn, _feadNum(row.rpm, 0));
      if(kw != null){ row.kw[pn.id] = Math.round(kw * 100) / 100; say++; }
    });
  });
  if(typeof showToast === 'function')
    showToast(say ? say + ' hücre katalogdan dolduruldu' : 'Katalog modeli seçili aksesuar yok', say ? 'success' : 'info');
  _feadRedraw(n);
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇÖZÜM
// ════════════════════════════════════════════════════════════════════════════
// Sonuç OTURUMLUK bir global: window.veFeadResults. Takoz modülündeki
// veMountResults ile aynı kalıp — ve aynı tuzak: proje değişince temizlenmeli,
// yoksa yeni projede ÖNCEKİ projenin sonuçları durur (bkz. _feadForgetResults,
// topology.js veResetSubtopoNav'dan çağrılıyor).
function veFeadSolve(nodeId){
  var node = _feadSolverNode(nodeId);
  var build = veFeadBuildFromCanvas();
  if(!build.ok){
    if(typeof showToast === 'function')
      showToast('Çözülemedi: ' + (build.errors[0] || 'model eksik'), 'error');
    if(node) _feadRedraw(node);
    return null;
  }
  var res = veFeadAnalyze(build, {
    rows: veFeadDutyRows(node),
    cylinders: _feadNum(node && node.data && node.data.cylinders, 6),
    // Burulma modelinin krank serbestliği kasnağın değil KRANK MİLİNİN ataletini
    // ister; panel bu sayıyı zaten soruyor (bkz. veFeadTorsionalOpt).
    crankInertia: _feadNum(node && node.data && node.data.crankInertia, 0),
    fatigueModel: (node && node.data && node.data.fatigueModel) || 'PK-2_2p-MT3',
    // Tepe yük taraması bu iki alanı kullanır; geçilmezse tablo varsayılan
    // 1100 d/d/s ile koşar ve panelde girilen değer hiçbir yere gitmez.
    accelRpmS: _feadNum(node && node.data && node.data.accelRpmS, NaN),
    decelRpmS: _feadNum(node && node.data && node.data.decelRpmS, NaN)
  });
  res.solvedNodeId = nodeId;
  res.pulleyNames = build.names;
  // KURULMUŞ SİSTEM SONUCA TAŞINIR. Rapor üreteci (cp-fead-report.js) kayış
  // künyesini, kasnak çaplarını ve gergi parametrelerini buradan okur —
  // yeniden veFeadBuildFromCanvas() çağırsaydı, çözümden SONRA değiştirilmiş
  // bir alan raporun girdi tablosuna sızar ve belge kendi sayılarıyla
  // çelişirdi. Rapor ÇÖZÜLEN modeli anlatır.
  res.build = build;
  // SERVİS FAKTÖRÜ sonuca TAŞINIR: kayma emniyetinin istenen alt sınırı bu.
  // Eskiden tabloda 1.3 SABİT yazıyordu — sayfadaki değerle aynı olması
  // tesadüftü; farklı bir servis faktörü giren kullanıcı yine 1.3'e göre
  // renklenmiş bir tablo görüyordu.
  res.serviceFact = _feadNum(node && node.data && node.data.serviceFact, 0);
  // UYGUNLUK KAPILARI ÇÖZÜM ANINDA HESAPLANIR VE SONUCA TAŞINIR. Rapor onları
  // yeniden hesaplasaydı, çözümden sonra değiştirilen bir devir sınırı belgeye
  // sızar ve rapor kendi modelinden başka bir şeyi denetlerdi — `res.build`'in
  // taşınma gerekçesinin aynısı. Panel kartı canlı hesaplar (henüz çözüm yok),
  // rapor ÇÖZÜLEN modelin kapılarını basar.
  res.checkOpt = (typeof veFeadCheckOpt === 'function')
    ? veFeadCheckOpt(node && node.data, veFeadDutyRows(node)) : null;
  res.checks = (typeof veFeadChecks === 'function')
    ? veFeadChecks(build, res.checkOpt) : null;
  if(typeof window !== 'undefined') window.veFeadResults = res;
  // ROZETLER SONUÇTAN SONRA TAZELENİR. Dönüş Yönü rozetinin RENGİ hükmü
  // taşıyor (gergi gevşek tarafta mı) ve o hüküm ancak çözümle biliniyor.
  // Tazeleme burada olmasaydı rozet TAM BİR ÇÖZÜM GERİDE kalırdı — ölçüldü
  // (gerçek tarayıcı): ileri yönde nötr, ters yönde YEŞİL, geri dönünce
  // KIRMIZI. Yani renk her seferinde bir önceki modelin hükmünü gösteriyordu;
  // sayı makul olduğu için sessiz.
  if(typeof veFeadRefreshBadges === 'function') veFeadRefreshBadges();
  if(typeof showToast === 'function')
    showToast(res.ok ? 'FEAD çözüldü — ' + res.duty.length + ' devir noktası'
                     : 'Çözüm hatası: ' + res.error, res.ok ? 'success' : 'error');
  if(node) _feadRedraw(node);
  return res;
}
function _feadForgetResults(){
  // Animasyon fazı da oturumluk: yeni projede kayış önceki modelin fazından
  // devam etmesin (yük değişince faz çevrim boyunu aşabilir de).
  _feadAnimPhase = {};
  if(typeof window !== 'undefined') window.veFeadResults = null;
}

// ════════════════════════════════════════════════════════════════════════════
//  SONUÇ BLOĞU (çözücü panelinin altı)
// ════════════════════════════════════════════════════════════════════════════
function veFeadResultBlock(node){
  var R = (typeof window !== 'undefined') ? window.veFeadResults : null;
  if(!R) return '';
  if(R.solvedNodeId && node && R.solvedNodeId !== node.id) return '';
  if(!R.ok) return veFeadProblemBox({ errors: [R.error || 'Çözüm başarısız.'] });

  var h = '';
  if(R.duty.length) h += veFeadDutyResultTable(R);
  if(R.torsional) h += veFeadTorsionalCard(R);
  if(R.fatigue) h += veFeadFatigueTable(R);
  if(R.life) h += veFeadLifeCard(R);
  h += veFeadLimitsBox(R);
  return h;
}

// ── BURULMA (DÖNEL TİTREŞİM) MODELİ ─────────────────────────────────────────
// Çekirdek modu hesaplıyordu ama hiçbir yerde GÖRÜNMÜYORDU. Sayının mühendislik
// karşılığı tek başına frekans değil, ateşleme frekansıyla ÇAKIŞIP çakışmaması:
// FEAD'i uyaran baskın kuvvet motorun ateşleme mertebesidir ve duty tablosu
// hangi devir bandında çalışıldığını zaten söylüyor. Kart bu örtüşmeyi
// ARİTMETİK olarak kuruyor — yeni bir model değil, iki bilinen sayının
// karşılaştırması — ve hüküm vermiyor, gözlem yazıyor.
function veFeadTorsionalCard(R){
  var T = R.torsional;
  if(!T || !Number.isFinite(T.firstElasticHz)) return '';
  var A = R.analysis;

  var h = '<div style="display:flex; align-items:baseline; gap:8px; margin-bottom:6px;">'
    + '<span style="font-size:var(--fs-h2); font-weight:700; color:var(--text-heading);">'
    + _feadFmt(T.firstElasticHz, 1) + '</span>'
    + '<span style="font-size:var(--fs-body); color:var(--text-muted);">Hz — 1. elastik mod</span></div>';

  // Bütün elastik modlar. Rijit cisim modu (f = 0, sistem birlikte döner)
  // LİSTELENMEZ ama SAYISI yazılır: tam 1 tane olmak zorunda, fazlası modelin
  // koptuğunu (bir kasnağın kayıştan ayrıldığını) gösterir.
  var mod = (T.elasticHz || []).slice(0, 6);
  if(mod.length) h += _feadHint('Elastik modlar: <b>'
    + mod.map(function(f){ return _feadFmt(f, 1); }).join(' · ') + '</b> Hz'
    + ((T.elasticHz.length > mod.length) ? ' (+' + (T.elasticHz.length - mod.length) + ' tane)' : '')
    + ' · rijit cisim modu ' + T.rigidBodyModes + ' (1 olmalı)'
    + ' · serbestlik ' + (T.dofNames || []).length);

  // Ateşleme frekansı bandıyla örtüşme.
  if(A && A.duty && A.duty.length){
    var fs = A.duty.map(function(d){ return d.firingHz; });
    var lo = Math.min.apply(null, fs), hi = Math.max.apply(null, fs);
    var ic = (T.elasticHz || []).filter(function(f){ return f >= lo && f <= hi; });
    var rpmOf = function(f){
      var d0 = A.duty[0];
      return (d0 && d0.firingHz > 0) ? (f / d0.firingHz * d0.engineRpm) : NaN;
    };
    h += _feadHint('Duty tablosunun ateşleme frekansı bandı <b>' + _feadFmt(lo, 1) + '–'
      + _feadFmt(hi, 1) + ' Hz</b>. '
      + (ic.length
          ? '<b style="color:var(--accent-warning);">Bu bandın içinde ' + ic.length
            + ' elastik mod var</b> (' + ic.map(function(f){ return _feadFmt(f, 1); }).join(' · ')
            + ' Hz ≈ ' + ic.map(function(f){ return _feadFmt(rpmOf(f), 0); }).join(' · ')
            + ' rpm). Ateşleme mertebesi bu devirlerde modu uyarır.'
          : 'Hiçbir elastik mod bu bandın içine düşmüyor; 1. mod '
            + _feadFmt(rpmOf(T.firstElasticHz), 0) + ' rpm ateşleme mertebesine karşılık geliyor.'));
  }

  // TAKE-UP ÖZDEŞLİĞİ — modelin kendi iç tutarlılık kapısı. Kol→span uzama
  // türevlerinin toplamı gergi take-up oranına EŞİT olmak zorunda; ayrışırsa
  // geometri ile dinamik model farklı şeyi anlatıyor demektir.
  if(T.takeupCheck && Number.isFinite(T.takeupCheck.errPct)){
    var tk = T.takeupCheck.errPct, iyi = tk < 1;
    h += _feadHint('Take-up özdeşliği: Σ(∂span/∂kol) ile gergi take-up oranı '
      + '<b style="color:' + (iyi ? 'var(--accent-success)' : 'var(--accent-danger)') + ';">%'
      + _feadFmt(tk, 3) + '</b> farkla ' + (iyi ? 'tutuyor' : 'TUTMUYOR') + '.');
  }

  return _feadCard('Burulma Titreşimi', 'çalışma (Mean) konumunda · kalibre model',
    'var(--accent-warning)', h);
}

// Duty noktası başına: kasnak çıkış gerilmesi, hubload, kayma emniyeti.
// Tek tabloda devir × kasnak; kayış hızı ve ateşleme frekansı satır başında.
function veFeadDutyResultTable(R){
  var A = R.analysis;
  var isim = R.pulleyNames || [];
  var th = function(t, w){ return '<th style="padding:3px 4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-secondary);'
    + (w ? ' width:' + w : '') + '">' + t + '</th>'; };
  var td = function(v, col){ return '<td style="padding:3px 4px; border:1px solid var(--border-color); text-align:right;'
    + (col ? ' color:' + col + ';' : '') + '">' + v + '</td>'; };

  // İSTENEN alt sınır kullanıcının girdiği servis faktörü; girilmemişse yalnız
  // kayma sınırı (1.0) kırmızıya boyanır — uydurma bir eşik gösterilmez.
  var SF_ist = _feadNum(R.serviceFact, 0);
  var sfRenk = function(sf){
    if(sf < 1) return 'var(--accent-danger)';
    if(SF_ist > 0 && sf < SF_ist) return 'var(--accent-warning)';
    return null;
  };
  var h = '<div style="overflow-x:auto;"><table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; border:1px solid var(--border-color);">';
  h += '<tr style="background:var(--bg-tertiary);">' + th('Devir') + th('%') + th('Kayış [m/s]')
     + isim.map(function(n){ return th(n); }).join('') + th('Min SF') + '</tr>';
  var enKucukSF = Infinity, enKucukRpm = null;
  A.duty.forEach(function(d){
    var minSF = Math.min.apply(null, d.slip.map(function(x){ return x.SF; }));
    if(minSF < enKucukSF){ enKucukSF = minSF; enKucukRpm = d.engineRpm; }
    h += '<tr>' + td(d.engineRpm) + td(_feadFmt(d.dcPct, 1)) + td(_feadFmt(d.vMs, 2))
       + d.perPulley.map(function(p){ return td(_feadFmt(p.exitTensionN, 0)); }).join('')
       + td(_feadFmt(minSF, 2), sfRenk(minSF))
       + '</tr>';
  });
  h += '</table></div>';

  // SERVİS FAKTÖRÜ HÜKMÜ — Motor Künyesi kartındaki söz burada karşılanıyor.
  if(SF_ist > 0 && Number.isFinite(enKucukSF)){
    var gecti = enKucukSF >= SF_ist;
    h += '<div style="display:flex; justify-content:space-between; gap:8px; font-size:var(--fs-micro); '
      + 'line-height:1.5; padding:7px 9px; margin-top:7px; background:var(--bg-tertiary); '
      + 'border:1px solid ' + (gecti ? 'var(--accent-success)' : 'var(--accent-danger)') + '; '
      + 'border-radius:var(--radius-sm);">'
      + '<span style="color:var(--text-muted);">Servis faktörü ' + _feadFmt(SF_ist, 2)
      + ' &nbsp;·&nbsp; en kötü nokta ' + enKucukRpm + ' rpm</span>'
      + '<span style="font-family:ui-monospace,monospace; font-weight:700; color:'
      + (gecti ? 'var(--accent-success)' : 'var(--accent-danger)') + ';">'
      + 'min SF = ' + _feadFmt(enKucukSF, 2) + (gecti ? '  ✓ GEÇTİ' : '  ✗ KALDI') + '</span></div>';
  }

  // ── TEŞHİS: SEBEBİ SÖYLE, ULAŞILAMAZ BİR ÇARE GÖSTERME ──────────────────
  //
  // Buradaki iki metin bir dönem şunu diyordu: "tasarım gerginliğini
  // yükseltin". Tasarım gerginliği 2026-08-25'te GİRDİ OLMAKTAN ÇIKTI — yay
  // dengesinden türüyor ve panelde öyle bir alan YOK (`grep designTension
  // js/cp-fead.js` → sıfır). Yani çare, basılacak düğmesi olmayan bir
  // denetimi gösteriyordu. CLAUDE.md'de belgelenmiş "kayma hükmü çaresi hükmü
  // veren kasnakta etki yapmıyordu" sınıfının aynısı, bir adım kötüsü.
  //
  // ASIL SEBEP ÖLÇÜLDÜ: gerilme zinciri gergiden ankrajlanıp kayış gidiş
  // yönünde yürüyor. Kayış ters yönde gezilirse gergi krankın GERGİN tarafına
  // düşüyor ve spanlar ankrajın altına iniyor (AG00976 ters: 545.4 · 544.0 ·
  // 67.5 · 66.2 · −290.3 · −291.6). O durumda hüküm gerginlikte değil YÖNDE.
  var yon = (typeof veFeadResults !== 'undefined' && veFeadResults)
    ? veFeadResults.tensionerSide : null;
  var tersYerlesim = !!(yon && yon.ok === false);
  var neg = A.duty.some(function(d){ return d.warnings && d.warnings.length; });
  // NEGATİF GERİLMEDE KAYMA HÜKMÜ VERİLMEZ. `slipSafety` gevşek tarafı
  // 1e-9'a kenetliyor (fead-core.js), dolayısıyla çöken bir zincirde SF
  // −0.00 / 0.00 çıkıyor — o bir emniyet faktörü değil, sayısal gölge.
  var kayma = !tersYerlesim
    && A.duty.some(function(d){ return d.slip.some(function(x){ return x.SF < 1; }); });
  var ek = '';
  if(tersYerlesim){
    ek += _feadHint('<b style="color:var(--accent-danger);">Gergi kayışın GERGİN tarafında</b> — '
      + 'ankraj ' + _feadFmt(yon.anchorN, 1) + ' N iken ' + yon.drain.length
      + ' açıklık onun altına iniyor (en düşük ' + _feadFmt(yon.minN, 1) + ' N, "'
      + _feadEsc(yon.minName || '—') + '"). Otomatik gergi <b>gevşek</b> tarafa konur. '
      + 'Çare kayış dönüş yönünü çevirmek ya da gergiyi kayış sırasında sürücünün önüne '
      + 'almaktır; tasarım gerginliği yay dengesinden türediği için yükseltilemez. '
      + '<b>Bu tabloda kayma emniyet faktörü hüküm vermez.</b>');
  } else {
    if(kayma) ek += _feadHint('<b style="color:var(--accent-danger);">Kayma emniyet faktörü 1\'in altına '
      + 'iniyor</b> — kayış o devirde kaymaya başlar. Sarım açısını artırın (avara ekleyin ya da '
      + 'kasnak konumlarını değiştirin); gergi künyesi daha yüksek yay momenti veriyorsa o da '
      + 'ankrajı yükseltir.');
    if(neg) ek += _feadHint('<b style="color:var(--accent-warning);">Bir spanda negatif gerilme</b> — '
      + 'kayış gevşiyor. Ankraj (' + _feadFmt(yon && yon.anchorN, 1) + ' N) yay dengesinden '
      + 'türüyor; çekilen güç bu ankrajın taşıyabileceğinden fazla.');
  }

  // KONUM YAZILIR: gerilme, hubload ve kayma HEP ÇALIŞMA (Mean) konumunda
  // hesaplanır (FEADCore.analyze meanRel'i kullanır), oysa yukarıdaki Geometri
  // tablosu kullanıcının seçtiği kol konumunu gösterebiliyor. Sarım açısı
  // konuma göre değiştiği için hubload da değişir; iki tabloyu yan yana okuyan
  // kullanıcı hangi konumu gördüğünü söylemezsek yanlış eşleştirir.
  return _feadCard('Çıkış Gerilmeleri', 'çalışma (Mean) konumunda, duty noktası başına [N]', 'var(--accent-primary)',
    h + ek + _feadHint('Hubload ve span frekansları için aşağıdaki hubload tablosuna bakın. '
      + 'Ateşleme frekansı ' + _feadFmt(A.duty.length ? A.duty[0].firingHz : 0, 1) + ' Hz @ '
      + (A.duty.length ? A.duty[0].engineRpm : 0) + ' rpm (silindir sayısı Çözücü panelinden).'))
    + veFeadHubTable(R);
}

function veFeadHubTable(R){
  var A = R.analysis, isim = R.pulleyNames || [];
  var h = '<div style="overflow-x:auto;"><table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; border:1px solid var(--border-color);">';
  h += '<tr style="background:var(--bg-tertiary);"><th style="padding:3px 4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-secondary);">Devir</th>'
     + isim.map(function(n){ return '<th style="padding:3px 4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-secondary);">' + n + '</th>'; }).join('')
     + '</tr>';
  A.duty.forEach(function(d){
    h += '<tr><td style="padding:3px 4px; border:1px solid var(--border-color); text-align:right;">' + d.engineRpm + '</td>'
      + d.hubloads.map(function(x){
          return '<td style="padding:3px 4px; border:1px solid var(--border-color); text-align:right;">'
            + _feadFmt(x.FN, 0) + ' <span style="color:var(--text-muted);">/ ' + _feadFmt(x.dirDeg, 0) + '°</span></td>';
        }).join('') + '</tr>';
  });
  h += '</table></div>';
  return _feadCard('Hubload', 'çalışma (Mean) konumunda · büyüklük [N] / yön [°]', 'var(--accent-primary)', h);
}

function veFeadFatigueTable(R){
  var f = R.fatigue;
  var h = '<table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; border:1px solid var(--border-color);">'
    + '<tr style="background:var(--bg-tertiary);">'
    + ['Kasnak', 'd_eff [mm]', 'Temas', 'Hasar payı'].map(function(t){
        return '<th style="padding:3px 5px; border:1px solid var(--border-color); text-align:left; font-weight:600; color:var(--text-secondary);">' + t + '</th>';
      }).join('') + '</tr>';
  f.perPulley.forEach(function(p){
    h += '<tr><td style="padding:3px 5px; border:1px solid var(--border-color);">' + _feadEsc(p.name) + '</td>'
      + '<td style="padding:3px 5px; border:1px solid var(--border-color); text-align:right;">' + _feadFmt(p.dEffMm, 1) + '</td>'
      + '<td style="padding:3px 5px; border:1px solid var(--border-color); color:var(--text-muted);">' + veFeadContactLabel(p.contact) + '</td>'
      + '<td style="padding:3px 5px; border:1px solid var(--border-color); text-align:right; font-weight:600;">%' + _feadFmt(p.sharePct, 1) + '</td></tr>';
  });
  h += '</table>';
  return _feadCard('Kaburga Yorulma Dağılımı', f.constants.fatigueModel, 'var(--accent-warning)',
    h + _feadHint('Dağılım YALNIZ çapa ve temas tarafına bağlıdır (gerilmeden bağımsız): '
      + 'hasar ∝ w · d<sub>eff</sub><sup>−m</sup>, m = ' + f.constants.m
      + ' · w<sub>sırt</sub> = ' + f.constants.wBackside + '. Göreli karşılaştırma için '
      + 'GÜVENİLİR ölçüt budur — mutlak ömür değil.'));
}

function veFeadLifeCard(R){
  var L = R.life;
  var gecerli = L.inValidRange;
  var saat = gecerli ? L.hoursB10 : L.hoursB10Corrected;
  var h = '<div style="display:flex; align-items:baseline; gap:8px; margin-bottom:6px;">'
    + '<span style="font-size:var(--fs-h2); font-weight:700; color:' + (gecerli ? 'var(--text-heading)' : 'var(--accent-warning)') + ';">'
    + _feadFmt(saat, 0) + '</span>'
    + '<span style="font-size:var(--fs-body); color:var(--text-muted);">saat (B10)'
    + (gecerli ? '' : ' — ampirik düzeltmeli') + '</span></div>';
  // SEÇİLEN YORULMA MODELİ MUTLAK ÖMRE GEÇMİYOR — bunu kartın kendisi söylemeli.
  // Dağılım tablosu hemen üstte seçilen modelin adıyla basılıyor; altındaki saat
  // değeri başka bir üsse göre. Ayrımı yalnız "Geçerlilik Sınırları" kutusuna
  // bırakmak, iki tabloyu yan yana okuyan kullanıcıyı yanıltırdı.
  if(L.modelMismatch)
    h += _feadHint('<b style="color:var(--accent-warning);">SEÇİLEN YORULMA MODELİNE GÖRE DEĞİL.</b> '
      + 'Bu saat değeri <b>' + _feadEsc(L.calibratedModel || 'PK-2_2p-MT3') + '</b> sabitleriyle '
      + 'kalibre edilmiştir; Çözücü panelinde <b>' + _feadEsc(L.modelMismatch) + '</b> seçili. '
      + 'Yukarıdaki <b>dağılım</b> seçtiğiniz modeli kullanır ve geçerlidir — <b>mutlak ömür '
      + 'kullanmaz</b>. Karşılaştırma için dağılıma bakın.');
  if(!gecerli)
    h += _feadHint('<b style="color:var(--accent-warning);">GEÇERLİLİK ALANI DIŞINDA.</b> '
      + 'Model mutlak ömrü yalnız tüm kasnak çapları 79.6–176 mm iken doğrular. Aralık dışında '
      + 'sistematik olarak ~0.55× veriyor; yukarıdaki sayı bu ampirik düzeltmeyi içerir. '
      + 'Aralık dışı: ' + _feadEsc((L.outOfRange || []).join(', '))
      + '. <b>Sertifikasyon için kullanmayın</b> — göreli karşılaştırma için yorulma dağılımını kullanın.');
  return _feadCard('Kayış Ömrü', 'ham ' + _feadFmt(L.hoursB10, 0) + ' saat', 'var(--accent-danger)', h);
}

function veFeadLimitsBox(R){
  if(!R.limits || !R.limits.length) return '';
  var h = '<ul style="margin:0; padding-left:18px; font-size:var(--fs-micro); line-height:1.6; color:var(--text-secondary);">';
  R.limits.forEach(function(x){ h += '<li>' + x + '</li>'; });
  (R.warnings || []).forEach(function(x){ h += '<li style="color:var(--accent-warning);">' + _feadEsc(x) + '</li>'; });
  return _feadCard('Geçerlilik Sınırları', 'spesifikasyon §7', 'var(--text-secondary)', h + '</ul>');
}

// Jest/Node köprüsü (tarayıcıda no-op)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_STARTER_LAYOUT: VE_FEAD_STARTER_LAYOUT,
    veFeadBeltPathD: veFeadBeltPathD,
    veFeadLayoutSVG: veFeadLayoutSVG,
    veFeadPortSideFor: veFeadPortSideFor,
    veFeadApplyBadge: veFeadApplyBadge,
    veFeadApplyBeltModeBadge: veFeadApplyBeltModeBadge,
    veFeadSyncDrag: veFeadSyncDrag,
    veFeadArmReadout: veFeadArmReadout, veFeadMountReadout: veFeadMountReadout,
    veFeadBandSVG: veFeadBandSVG,
    veFeadPinRows: veFeadPinRows, veFeadPinNote: veFeadPinNote,
    veFeadTensionerLibCard: veFeadTensionerLibCard, veFeadApplyTenLib: veFeadApplyTenLib,
    veFeadEngineLibRow: veFeadEngineLibRow, veFeadApplyEngineLib: veFeadApplyEngineLib,
    veFeadAccLimitCard: veFeadAccLimitCard, veFeadApplyAccLib: veFeadApplyAccLib,
    veFeadChecksCard: veFeadChecksCard,
    veFeadSet: veFeadSet, veFeadPlaceFromCoords: veFeadPlaceFromCoords,
    VE_FEAD_COORD_KEYS: VE_FEAD_COORD_KEYS,
    veFeadToggleBeltMode: veFeadToggleBeltMode,
    veFeadApplyCoordLinkBadge: veFeadApplyCoordLinkBadge,
    veFeadToggleCoordLink: veFeadToggleCoordLink,
    veFeadCurrentSpin: veFeadCurrentSpin,
    veFeadApplySpinBadge: veFeadApplySpinBadge, veFeadToggleSpin: veFeadToggleSpin,
    getFeadSpinPropertiesHTML: getFeadSpinPropertiesHTML,
    veFeadCoordLinkAfterDelete: veFeadCoordLinkAfterDelete,
    getFeadCoordLinkPropertiesHTML: getFeadCoordLinkPropertiesHTML,
    veFeadDerivedLengthHTML: veFeadDerivedLengthHTML,
    veFeadBeltCatalogCard: veFeadBeltCatalogCard,
    veFeadPickBelt: veFeadPickBelt,
    veFeadApplyLayoutCard: veFeadApplyLayoutCard,
    veFeadPosPicker: veFeadPosPicker,
    // Animasyon: yürüyüş + faz + döngü. Testler dişleri ve kolları doğrudan
    // bu saf fonksiyonlardan üretip ölçüyor (DOM'suz).
    _feadBeltWalk: _feadBeltWalk, _feadTeethPath: _feadTeethPath,
    _feadSpokePath: _feadSpokePath, _feadToothStep: _feadToothStep,
    _feadXform: _feadXform, _feadAnimLabel: _feadAnimLabel,
    _feadVibDef: _feadVibDef, _feadWalkPath: _feadWalkPath,
    _feadScnHud: _feadScnHud, _feadScnRezonans: _feadScnRezonans,
    _feadScnSlim: _feadScnSlim,
    _feadScnVibLive: _feadScnVibLive,
    _feadSegSpan: _feadSegSpan, _feadSegPulley: _feadSegPulley,
    veFeadVibStrip: veFeadVibStrip,
    VE_FEAD_VIB_SPAN_PTS: VE_FEAD_VIB_SPAN_PTS,
    veFeadAnimTick: veFeadAnimTick, veFeadAnimEnsure: veFeadAnimEnsure,
    veFeadAnimApply: veFeadAnimApply,
    veFeadCompassPlace: veFeadCompassPlace, veFeadCompassReset: veFeadCompassReset,
    veFeadCompassDragStart: veFeadCompassDragStart,
    VE_FEAD_ROSE_W: VE_FEAD_ROSE_W, VE_FEAD_ROSE_HALF: VE_FEAD_ROSE_HALF,
    VE_FEAD_ANIM_ATTR: VE_FEAD_ANIM_ATTR,
    VE_FEAD_SPOKE_N: VE_FEAD_SPOKE_N, VE_FEAD_SPOKE_MIN_PX: VE_FEAD_SPOKE_MIN_PX,
    veFeadLayoutCardHTML: veFeadLayoutCardHTML,
    veFeadLayoutCardStrip: veFeadLayoutCardStrip,
    veFeadRefreshLayoutCards: veFeadRefreshLayoutCards,
    VE_FEAD_CARD_CLASS: VE_FEAD_CARD_CLASS,
    veFeadBeltDbHint: veFeadBeltDbHint,
    veFeadModelTable: veFeadModelTable,
    veFeadPositionTable: veFeadPositionTable,
    veFeadGeometryTable: veFeadGeometryTable,
    veFeadProblemBox: veFeadProblemBox,
    veFeadWarningBox: veFeadWarningBox, veFeadDefaultsBox: veFeadDefaultsBox,
    veFeadDutyEditor: veFeadDutyEditor, veFeadSolve: veFeadSolve,
    veFeadDutyAdd: veFeadDutyAdd, veFeadDutyRemove: veFeadDutyRemove,
    veFeadDutySeed: veFeadDutySeed, veFeadDutyLib: veFeadDutyLib,
    veFeadDutySet: veFeadDutySet, veFeadDutyFillCatalog: veFeadDutyFillCatalog,
    veFeadResultBlock: veFeadResultBlock, _feadForgetResults: _feadForgetResults,
    veFeadDutyResultTable: veFeadDutyResultTable, veFeadHubTable: veFeadHubTable,
    veFeadFatigueTable: veFeadFatigueTable, veFeadLifeCard: veFeadLifeCard,
    veFeadTorsionalCard: veFeadTorsionalCard,
    veFeadDriveCard: veFeadDriveCard, veFeadEngineCard: veFeadEngineCard,
    veFeadPowerCurveCard: veFeadPowerCurveCard,
    veFeadCurveAdd: veFeadCurveAdd, veFeadCurveRemove: veFeadCurveRemove,
    veFeadCurveSet: veFeadCurveSet, veFeadLoadExample: veFeadLoadExample,
    veFeadArrangeByCoords: veFeadArrangeByCoords,
    veFeadWizOpenAny: veFeadWizOpenAny,
    veFeadPopulateStarter: veFeadPopulateStarter,
    getFeadModulePropertiesHTML: getFeadModulePropertiesHTML,
    getFeadPulleyPropertiesHTML: getFeadPulleyPropertiesHTML,
    getFeadTensionerPropertiesHTML: getFeadTensionerPropertiesHTML,
    getFeadBeltPropertiesHTML: getFeadBeltPropertiesHTML,
    getFeadLayoutPropertiesHTML: getFeadLayoutPropertiesHTML,
    getFeadSolverPropertiesHTML: getFeadSolverPropertiesHTML,
    getFeadExamplePropertiesHTML: getFeadExamplePropertiesHTML
  };
}
