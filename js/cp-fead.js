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

// ── MODÜL KARTI PENCERESİ — KRANK KASNAĞI AİLESİNDE ────────────────────────
// Kullanıcı isteği (2026-09-23): FEAD pencereleri Krank Kasnağı'nın yapısında,
// KATEGORİ KATEGORİ. Kök tuvaldeki kartın penceresi iki kategoriye ayrıldı:
// İÇERİK (alt topolojide ne var) ve MODEL (kayış yolunun cevabı). Pencerenin
// EYLEMİ "Alt Topolojiyi Aç".
//
// MODEL ALT TOPOLOJİDEN KURULUR, global tuvalden DEĞİL. Kökteyken global
// `nodes` modül kartlarını taşıyor; `veFeadBuildFromCanvas` orada BOŞ bir
// modeli çözer ve sağ sütun her kartta "çözülemedi" derdi. Köprü DOM'suz ve
// düğüm listesini argüman olarak alıyor (`veFeadBuildSystem`) — kart kendi
// listesini veriyor. Uygunluk kapıları da çözücüyü o modelden okur
// (`_feadSideGates` → `build.solver`).
//
// "BAĞLANTI" SATIRI YOK — yapısal olarak hep 0. FEAD tiplerinin on ikisinde de
// `inputs:0, outputs:0`, yani bu alt topolojide bağlantı KURULAMAZ (kayış
// sırası `node.data.beltIndex` alanında, telde değil). Satır her modelde aynı
// sıfırı basıyor ve kullanıcıya "burada bağlanacak bir şey var" diye bakılacak
// bir yer gösteriyordu. Ortak `veModuleSummaryText` dokunulmadı: Araç
// Performans ile Takoz'da bağlantı gerçek bir sayıdır.
function getFeadModulePropertiesHTML(node){
  var sub = node && node.data && node.data.subTopology;
  var liste = (sub && Array.isArray(sub.nodes)) ? sub.nodes : [];
  var kurulu = liste.length > 0;

  // KATEGORİ TİPİN KENDİ BEYANINDAN (`componentDefs` bayrakları): elle tutulan
  // bir tip listesi, yeni bir kasnak tipi geldiğinde onu sessizce "araç" sayardı.
  var say = { kasnak: 0, gergi: 0, kayis: 0, arac: 0 };
  liste.forEach(function(n){
    var d = _feadDefOf(n);
    if(d.isFeadTensioner) say.gergi++;
    else if(d.isFeadPulley) say.kasnak++;
    else if(d.isFeadBelt) say.kayis++;
    else say.arac++;
  });

  var build = null, T = null;
  if(kurulu && typeof veFeadBuildSystem === 'function'){
    try { build = veFeadBuildSystem(liste, {}); } catch(e){ build = null; }
    try { T = (build && typeof veFeadTableRows === 'function') ? veFeadTableRows(build) : null; }
    catch(e){ T = null; }
  }
  function mm(v, dec){ return Number.isFinite(v) ? _feadFmt(v, dec) + ' mm' : '—'; }

  var icerik = kurulu
    ? _feadCard('Bileşenler', 'alt topolojide', 'var(--accent-primary)',
        '<div class="ve-fp-grid" style="--fp-k:2;">'
      + _feadRO('Kasnak', String(say.kasnak)) + _feadRO('Gergi', String(say.gergi))
      + _feadRO('Kayış', String(say.kayis))   + _feadRO('Araç', String(say.arac))
      + '</div>'
      + _feadHint('Kasnakların kanvasta kutusu yok: sıra, koordinat ve çap '
        + '<b>Kayış Tablosu</b>ndan girilir; bir kasnağın penceresi için tablodaki '
        + 'adına tıklayın.'))
    : _feadCard('Bileşenler', 'alt topolojide', 'var(--text-muted)',
        _feadHint('Alt topoloji henüz açılmadı. Açınca <b>Başlangıç Sihirbazı</b> '
          + 'karşılar: kasnakları, gergiyi, kayışı ve çalışma çevrimini adım adım '
          + 'sorar ya da hazır bir örnekten doldurur.'));

  var model = _feadCard('Kayış Yolu', 'çekirdekten', 'var(--accent-warning)',
      '<div class="ve-fp-grid" style="--fp-k:1;">'
    + _feadRO('Pitch boyu', mm(T && T.LpitchMm, 1))
    + _feadRO('Efektif boy', mm(T && T.LeffMm, 1))
    + _feadRO('Σ sarım', (T && Number.isFinite(T.signedWrapDeg))
        ? _feadFmt(T.signedWrapDeg, 2) + '°' : '—')
    + '</div>'
    + _feadHint('Bu sayılar HESAPLANMAZ, alt topolojinin kendi modelinden okunur — '
      + 'içerideki Kayış Tablosu ile aynı kaynak.'));
  // SIRA BİR LİSTE, bir alan değil: altı kasnaklı bir sıra salt okunur bir
  // kutuya sığmaz ve kutu metni SESSİZCE kırpar.
  var satirlar = (T && T.rows) ? T.rows : [];
  model += _feadCard('Kayış Sırası', 'tablo sırası', 'var(--accent-primary)',
      satirlar.length
        ? '<ol class="ve-fp-liste">' + satirlar.map(function(r){
            return '<li>' + (r.driver ? '<b>' + _feadEsc(r.name) + '</b> · sürücü'
                                      : _feadEsc(r.name)) + '</li>';
          }).join('') + '</ol>'
        : _feadHint('Kasnak yok.'));

  var yan = { html: _feadSideGates(build, T)
      + '<button type="button" class="ve-fp-solve" onclick="veFeadOpenEditor(\'' + node.id + '\')">'
      + '<span class="mf-ico mf-ico-folder-open" aria-hidden="true"></span> Alt Topolojiyi Aç</button>' };
  return veFeadPanelShell(node, [{ k:'ic',  ad:'İçerik', govde: icerik },
                                 { k:'mod', ad:'Model',  govde: model }], yan);
}

// REFERANS yerleşim (yerel px). İlk açılışta bu yerleşimin TAMAMI kurulmaz —
// diğer iki modülle aynı kalıp: yalnız "Başlangıç ve Örnekler" gelir. Koordinat
// çerçevesi burada durur ki örnek aktarımı görünür alana ortalanabilsin.
var VE_FEAD_STARTER_LAYOUT = [
  // ── Üst şerit: araçlar ──
  { type:'fead-belt',    lx:40,  ly:20 },
  // İKİ KANVAS, TEK TİP (2026-09-11). İkincisi işletme ön ayarlı; ayrım
  // `katOn` alanında, tipte DEĞİL.
  { type:'fead-layout',  lx:190, ly:20 },
  { type:'fead-layout',  lx:640, ly:20, katOn:'isletme' },
  { type:'fead-solver',  lx:340, ly:20 },
  { type:'fead-wizard',  lx:490, ly:20 },
  { type:'fead-report',  lx:790, ly:20 },
  // ── Kayış düzlemi: krank altta ortada, aksesuarlar çevresinde ──
  { type:'fead-crank',       name:'Krank Kasnağı', lx:250, ly:330 },
  { type:'fead-tensioner',   name:'Gergi',         lx:140, ly:210 },
  { type:'fead-alternator',  name:'Alternatör',    lx:400, ly:170 },
  { type:'fead-ac',          name:'Klima Komp.',   lx:540, ly:270 },
  { type:'fead-waterpump',   name:'Su Pompası',    lx:410, ly:380 },
  { type:'fead-idler',       name:'Avara Kasnak',  lx:290, ly:200 }
];

// ── "OTOMATİK DÜZENLE" — ARAÇ KARTLARINI DİZ ──────────────────────────────
//
// Bu fonksiyon iki kez anlam değiştirdi ve ikisi de bir ölçümün sonucuydu:
//
//   1. Önce kasnakları bir HALKAYA diziyordu (tel kesişimini sıfırlıyordu) —
//      konum hiçbir şey ifade etmezken doğruydu.
//   2. Sonra kutuları mm koordinatlarına oturtuyordu — kanvas kayış düzlemi
//      olunca halka kullanıcının girdiği bütün koordinatları silmek olurdu.
//   3. Bugün kasnakların KUTUSU YOK (components.js veIsCanvasHidden): kanvasta
//      dizilecek kasnak kalmadı. Geriye ARAÇ KARTLARI kaldı ve düzenin tek işi
//      onları çakışmadan, okunur bir sırada yerleştirmek.
//
// Kayış Yolu şeması ile Kayış Tablosu SAĞDA (ikisi de büyük kart), künyeler
// SOLDA. Bölüşüm veFeadLoadExample ile aynı; tek bir sütuna dizilseydi 800 px
// genişliğindeki tablo künyelerin üstüne binerdi.
// ── ARAÇ KARTLARININ YEDEK YERLEŞİMİ — TEK KAYNAK ───────────────────────────
//
// Asıl yerleştirme `veFeadArrangeByCoords` ile yapılıyor; bu dizi kurucuların
// İLK KARESİ ve o yol patlarsa (iki çağıran da try/catch ile yutuyor) geçerli
// kalan yedek. İki kurucunun (örnek · sihirbaz) kendi yedeği vardı ve ikisi de
// yerleştiriciden BAŞKA bir şekil kuruyordu — biri kanvasları ALT ALTA, öteki
// 120 px'lik ızgarada ÜST ÜSTE. Fark sessizdi: yerleştirici bir kez patlasa
// kullanıcı reddettiği resmi alırdı ve hiçbir yerde uyarı çıkmazdı.
// Kullanıcı bildirimi (2026-09-14): *"Alt alta hiç estetik durmuyor."*
//
// ŞEKİL yerleştiricinin şekli: araçlar solda bir sütun, Kayış Tablosu sağ üstte
// (GİRİŞ yüzeyi, geniş ve satırlı — okuma sırası ondan başlıyor), kanvaslar
// onun altında BİR SIRA (aynı modelin iki resmi yan yana durunca
// karşılaştırılıyor). Birebir aynı SAYI beklenmiyor: yerleştirici ad payını
// DOM'dan ölçüyor, burada DOM yok.
//
// KUTUSUZ TİP (kasnak) için `null` döner — kanvasta yeri yok, ve çağıranın
// kendi koordinatı var (örnekte mm, sihirbazda ızgara).
//
// GİRDİ DÜĞÜM, tip dizesi DEĞİL: tip tanımı `_feadDefOf`ten okunuyor ve o,
// global `componentDefs` görünmüyorsa düğümün kendi `def` alanına düşüyor.
// Çıplak global okumak, bu dosyanın `require` ile yüklendiği her yerde
// (testler) sessizce "her şey bir künye" demekti — ölçüldü: altı düğümün
// altısı da sol şeride diziliyordu.
function veFeadFallbackSlots(dugumler, opts){
  opts = opts || {};
  var sagX = (typeof opts.sagX === 'number') ? opts.sagX : 60;
  var ustY = (typeof opts.ustY === 'number') ? opts.ustY : 150;
  var solX = (typeof opts.solX === 'number') ? opts.solX : -150;
  // Sol şeridin KAÇINCI satırından başlanacağı: iki çağrı aynı şeridi
  // paylaşabiliyor (yeni kurulan araçlar + iç topolojide zaten duranlar) ve
  // sıfırdan başlamak ikincisini birincinin ÜSTÜNE yığardı.
  var ustBasla = (typeof opts.ustBasla === 'number') ? opts.ustBasla : 0;
  // Kanvas sırası için aynısı: iç topolojide zaten duran bir kanvas, YENİ
  // kurulanların sağına eklenmeli — sıfırdan başlarsa üstlerine biner.
  var kanvasBasla = (typeof opts.kanvasBasla === 'number') ? opts.kanvasBasla : 0;
  // TABLO KANVASTAN İNDİ (2026-09-23): kanvaslar artık ÜST sırada, yan yana.
  var kanvasY = ustY;
  var ust = ustBasla, kanvasNo = kanvasBasla, out = [];
  (dugumler || []).forEach(function(n){
    var d = _feadDefOf(typeof n === 'string' ? { type: n } : n);
    if(d.noCanvasBox){ out.push(null); return; }
    // Ölçü de veriliyor: yoksa veArrangeModuleBase kartı 65×60 sayıp grubu
    // yanlış ortalıyor ve kart görünür alanın sağından taşıyor.
    if(d.isFeadLayout){
      out.push({ lx: sagX + kanvasNo * ((d.defaultWidth || 440) + 24), ly: kanvasY,
                 w: d.defaultWidth, h: d.defaultHeight });
      kanvasNo++;
    } else {
      // ARAÇLAR SOL ŞERİTTE, KASNAK KÜMESİNİN DIŞINDA. Eskiden kümenin ÜSTÜNE
      // bir sıra hâlinde diziliyorlardı (ly:20) ve kutular tam kayış yolunun
      // üstüne düşüyordu: tel kutunun arkasından geçiyor, ikisi de okunmuyordu.
      out.push({ lx: solX, ly: ustY + ust * 96 });
      ust++;
    }
  });
  // KAÇ KÜNYE YUVASI KULLANILDI — sol şeritte SIRADAKİ boş satırı isteyen
  // çağıranlar için (örnek kurucusu, iç topolojide zaten duran araç
  // düğümlerini aynı şeridin devamına diziyor). Sayıyı çağıranın yeniden
  // türetmesi, ikinci bir "hangi tip künyedir" kuralı demekti.
  out.solAdet = ust;
  out.kanvasAdet = kanvasNo;
  return out;
}

function veFeadArrangeByCoords(opts){
  opts = opts || {};
  if(typeof nodes === 'undefined' || !nodes) return false;
  var CX = 3000, CY = 3000;
  var sol = [], sag = [], yer = {};
  nodes.forEach(function(n){
    // Kutusuz düğüm (kasnak) dizilmez — kanvasta yeri yok.
    if(typeof veIsCanvasHidden === 'function' && veIsCanvasHidden(n)) return;
    var d = _feadDefOf(n);
    d.isFeadLayout ? sag.push(n) : sol.push(n);
  });
  if(!sol.length && !sag.length) return false;

  // ADIN YERİ DE ŞERİDE GİRER. Dikey adım yalnız KUTU yüksekliğini sayıyordu,
  // ad ise kutunun ALTINDA duruyor: araç kartlarında adın altında 2 px kalıyor
  // ve komşunun DEKORASYONU oraya biniyordu — seçim tutamağı kutudan ~5 px
  // dışarı taşar ("Çözücü" → "Çöz▪cü"), kayış kipi rozeti kutunun üst kenarına
  // oturur ve üstteki adın kuyruklarını örter. Ölçüldü (gerçek tarayıcı):
  // sekiz çakışma, üç araç aralığında da boşluk 2 px.
  //
  // Ölçü sınır çerçevesiyle AYNI kaynaktan (veMeasureNodeLabel +
  // veNodeLabelOverflow) — ikinci bir yükseklik sabiti, adın CSS payı değişince
  // sessizce ayrışırdı. Ölçülemezse pay 0 ve davranış BİREBİR eski hâli: saf
  // koşucuda DOM yok, uydurma bir yükseklik kartları sebepsiz uzaklaştırırdı.
  function adPayi(n, b){
    if(typeof veMeasureNodeLabel !== 'function' || typeof veNodeLabelOverflow !== 'function')
      return { top: 0, bottom: 0 };
    var lbl = veMeasureNodeLabel(n);
    if(!lbl) return { top: 0, bottom: 0 };
    var o = veNodeLabelOverflow((n.data && n.data.labelPos) || 'bottom', b.w, b.h, lbl);
    return { top: o.top || 0, bottom: o.bottom || 0 };
  }

  function serit(list, x0, hiza){
    var toplam = 0;
    list.forEach(function(n){
      var b = veFeadNodeBox(n), o = adPayi(n, b);
      toplam += o.top + b.h + o.bottom + 24;
    });
    var y = CY - toplam / 2;
    list.forEach(function(n){
      var b = veFeadNodeBox(n), o = adPayi(n, b);
      y += o.top;                       // ad ÜSTTEyse kutuyu o kadar aşağı al
      yer[n.id] = { x: (hiza === 'sag') ? x0 : (x0 - b.w), y: y };
      y += b.h + o.bottom + 24;
    });
  }

  // BÜYÜK KARTLAR SÜTUN DEĞİL, İKİ SIRA — ölçülmüş bir kadraj kusuru.
  //
  // Üçü de üst üste dizilince içerik 959×1388 oluyor: DAR ve UZUN. Görüş alanı
  // ise geniş (1316×855), yani sığdırma YÜKSEKLİKTEN sınırlanıyor ve yanlarda
  // 409+409 px boş kalıyor. ÖLÇÜLDÜ (gerçek tarayıcı): açılış zoom'u **0,473**,
  // görüşün yalnız **%29,9**'u dolu — Kayış Tablosu'nun yazısı okunmuyor.
  //
  // Üç diziliş ölçüldü:
  //   büyükler SÜTUN (bugün)              959×1388 → 0,582
  //   büyükler tek SIRA                  1887×500  → 0,669
  //   tablo üstte · kanvaslar yan yana    993×864  → 0,906   ← seçilen
  //
  // Seçim yalnız sayısal değil: tablo GİRİŞ yüzeyi (geniş, satırlı) ve üstte
  // durması okuma sırasına uyuyor; iki kanvas ise AYNI modelin iki resmi
  // (donuk geometri ↔ çalışma noktası) ve yan yana durunca karşılaştırılıyor.
  // Alt alta dizmek onları birbirinden 500 px uzaklaştırıyordu.
  function sira(list, x0, yBas){
    var x = x0, enYuksek = 0;
    list.forEach(function(n){
      var b = veFeadNodeBox(n), o = adPayi(n, b);
      yer[n.id] = { x: x, y: yBas + o.top };
      x += b.w + 24;
      enYuksek = Math.max(enYuksek, o.top + b.h + o.bottom);
    });
    return enYuksek;
  }

  serit(sol, CX - 60, 'sol');
  // KANVASLAR TEK SIRA, YAN YANA. Tablo kanvastan inince (2026-09-23) üst
  // sıra boşaldı; kanvasları SÜTUNA dizmek dar-uzun bir blok üretir ve
  // sığdırma yükseklikten sınırlanırdı (ölçülmüş kusur, 0,473). Sıra CY'ye
  // ORTALANIR ki sol şeritle hizası bozulmasın.
  if(sag.length){
    var enY = 0;
    sag.forEach(function(n){
      var b = veFeadNodeBox(n), o = adPayi(n, b);
      enY = Math.max(enY, o.top + b.h + o.bottom);
    });
    sira(sag, CX + 60, CY - enY / 2);
  }

  if(!opts.silent && typeof saveState === 'function') saveState();
  nodes.forEach(function(n){
    var p = yer[n.id];
    if(!p) return;
    n.x = Math.round(p.x); n.y = Math.round(p.y);
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
    showToast('Kartlar düzenlendi', 'success');
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
  // BİR KULLANICI EYLEMİ = BİR GERİ-AL ADIMI (bkz. js/state.js → veStateBatch).
  // Bu kurucu ONİKİ düğüm kuruyor ve `createNode` her birinde `saveState()`
  // çağırıyor: sarılmazsa Ctrl+Z modeli düğüm düğüm SÖKER (ölçüldü — 12.
  // basışta Kayış Tablosu boşalıyor, 13.'te kart tamamen gidiyordu).
  // Yığın zaten toplu kurulumdaysa (sihirbaz açılış yüzeyini çağırıyor)
  // ikinci kez sarılmaz — sayaç iç içe geçmeyi taşıyor.
  if(typeof veStateBatch === 'function' && typeof veStateBatchActive === 'function'
     && !veStateBatchActive()){
    var _r = veStateBatch(function(){ return veFeadPopulateStarter(); });
    // AÇILIŞ DURUMU YIĞININ TABANI (bkz. state.js → veStateResetBaseline).
    // Bir adım olarak dursaydı Ctrl+Z kullanıcıyı boş bir kanvasa düşürürdü:
    // ne tablo, ne sihirbaz, ne örnek — geri dönüşün tek yolu Ctrl+Y.
    // Burada güvenli, çünkü bu yol yalnız KAYITSIZ bir alt topolojiye girerken
    // koşuyor (veFeadOpenEditor → veLoadTabState({state:null})) ve yığın o anda
    // zaten boş.
    if(typeof veStateResetBaseline === 'function') veStateResetBaseline();
    return _r;
  }
  if(typeof createNode !== 'function') return [];
  // AÇILIŞ YÜZEYİ: sihirbaz + BOŞ BİR KAYIŞ YOLU KARTI (Çizim Masası,
  // 2026-09-23). Kart boşken kendi boş hâlini çizer ("Sihirbazla kur" ·
  // "Tabloyu aç"); sihirbazın "Modeli Kur"u onu geometri kartı olarak
  // YENİDEN KULLANIR (tip + ön ayar eşleşmesi). Yerleşim ortak yuvadan.
  var tipler = ['fead-wizard', 'fead-layout'];
  var yuva = veFeadFallbackSlots(tipler);
  var base = (typeof veArrangeModuleBase === 'function')
    ? veArrangeModuleBase(yuva)
    : { x:3000, y:3000 };
  var created = [];
  tipler.forEach(function(tip, k){
    var slot = yuva[k] || { lx: k * 150, ly: 20 };
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

  var _yeniTopoloji = false;
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
      _yeniTopoloji = true;
    }
  } finally { _veFeadBusy = false; }

  // Eski kayıt göçü (data.dia → data.od) ve temas/sürücü rozetleri, alt
  // topoloji YÜKLENDİKTEN sonra: düğümler artık canlı ve DOM'da.
  if(typeof veFeadMigrateAll === 'function' && typeof nodes !== 'undefined') veFeadMigrateAll(nodes);
  // ORİJİN GÖÇÜ. Konum fiziksel; eski projelerde krank (0,0)'da olmayabilir.
  // Göç TANIM GEREĞİ bir öteleme (geometriye etkisi ölçüldü: 0.00e+0), yani
  // sessizce yapılabilir. "Kutuları koordinata oturt" adımı 2026-09-09'da
  // kalktı — kasnakların kanvasta kutusu yok.
  if(typeof veFeadNormalizeOrigin === 'function' && typeof nodes !== 'undefined'){
    try { veFeadNormalizeOrigin(nodes); }
    catch(e){ /* yarım model açılışı engellemez */ }
  }
  veFeadRefreshBadges();

  if(!_silent && typeof veFitViewToContent === 'function') veFitViewToContent();
  if(!_silent && typeof veAnimateCanvasTransition === 'function') veAnimateCanvasTransition('enter');
  veFeadUpdateBreadcrumb();
  if(typeof veSyncSidebarScope === 'function') veSyncSidebarScope();
  if(typeof veUpdateWarnings === 'function') veUpdateWarnings();
  if(!_silent && typeof showToast === 'function') showToast('FEAD — İç Topoloji', 'info');

  // ── BOŞ BİR FEAD TOPOLOJİSİ SİHİRBAZLA KARŞILAR ─────────────────────────
  //
  // Kullanıcı isteği (2026-09-09): *"FEAD modülünü ana topoloji kısmından
  // açtığım zaman, direkt karşıma 'Başlangıç Sihirbazı' bileşeninin gelmesini
  // istiyorum."* Eskiden karşılayan şey BOŞ bir Kayış Tablosuydu: doldurulacak
  // hiçbir satırı yok, ne yapılacağını da söylemiyordu.
  //
  // YALNIZ TAZE TOPOLOJİDE. `_yeniTopoloji` bayrağı yukarıdaki `else` dalından
  // geliyor — kurulmuş bir modele geri dönerken sihirbazın açılması, kullanıcıyı
  // her girişte kapatması gereken bir pencereyle karşılamak olurdu. Aynı sebeple
  // `_silent` (autosave'in görünmez geri-girişi) de dışarıda: orada kullanıcı
  // FEAD'e girmiyor bile.
  //
  // Kapatan için model YİNE KURULABİLİR: sihirbaz düğümü kanvasta duruyor ve
  // Kayış Tablosu'nun kendi ekleyicisi çalışıyor — bu bir kapı değil bir
  // karşılama.
  if(_yeniTopoloji && !_silent && typeof veFeadWizOpenAny === 'function'){
    try { veFeadWizOpenAny(); }
    catch(e){ /* sihirbaz açılamazsa iç topoloji yine açık kalır */ }
  }
}

// _silent: köke çökerken (veFeadCollapseToRoot → kaydet/sekme değiştir öncesi)
// true gelir; kullanıcıya görünmeyen bu toplu çıkışta animasyon tetiklenmez.
function veFeadCloseEditor(_silent){
  if(_veFeadBusy) return;
  if(!veFeadStack.length) return;
  // Kayış Tablosu çekmecesi FEAD'e ait: kullanıcı çıkarken kapanır — ÖNCE,
  // ki kamerası bu topolojide geri dönsün ve öyle kaydedilsin. Sessiz
  // gidiş-dönüşte (arka plan kaydı köke çöker ve hemen geri girer) dokunulmaz.
  if(!_silent) veFeadTabloKapat();

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

// Alt-topoloji çıkış düğmesi — sınır çerçevesinin İÇİNE, sol üst köşeye tutunur
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
  el.innerHTML =
    '<button onclick="veFeadCloseEditor()" title="Ana topolojiye dön — FEAD · İç Topoloji'
    + (depth > 1 ? ' (derinlik ' + depth + ')' : '') + '">'
    + '<span class="mf-ico mf-ico-chevrons-left" aria-hidden="true"></span>'
    + (depth > 1 ? '<i class="ve-bc-depth">' + depth + '</i>' : '')
    + '</button>';
  if(typeof veAnchorBoundaryChip === 'function') veAnchorBoundaryChip();
}

// ════════════════════════════════════════════════════════════════════════════
//  PANEL YARDIMCILARI (Takoz modülüyle aynı görsel dil)
// ════════════════════════════════════════════════════════════════════════════
// ── PANEL DİLİ — GÖRÜNÜM CSS'TE (.ve-fp-*) ────────────────────────────────
//
// Kullanıcı bildirimi (2026-09-21, ekran görüntüsüyle): *"çok karışık ve kötü
// duruyor. Yazılar kaymış, girdiler yanlış konumlanmış."* Beş kusur ölçüldü:
//
//   P1 Pencere GENİŞ (kasnaklar VE_WIDE_PANEL_TYPES'ta, 1040 px) ama içerik
//      tek sütundu ve etiketin `flex:1`i kontrolü sağ uca fırlatıyordu.
//   P2 Aynı pencerede İKİ etiket modeli (sol-sağ ve üst-alt).
//   P3 Etiket `text-align:center`, giriş `text-align:right` — "yazılar kaymış".
//   P4 Neredeyse her alanın altında paragraf.
//   P5 Görünüm satır içi `style=` dizelerindeydi; satır içi CSS DURUM İFADE
//      EDEMEZ, yani hiçbir panelde `:hover`/`:focus` yoktu.
//
// Yerine Araç Performans → Motor panelinin kendi dili: bölüm başlığı + kurallı
// çizgi, ETİKET-DEĞER satırı (paylaşılan sütun kenarı), birim etikette.
// Üçüncü bir dil kurulmadı — kural 14'ün (Kayış Tablosu) aynı gerekçesi.
//
// ÇAĞRI YERLERİ DEĞİŞMİYOR: imzalar aynı kaldı, yalnız ürettikleri işaretleme
// sınıf tabanlı oldu. Böylece 44 kart / 18 ızgara / 13 liste / 74 açıklama —
// yani BÜTÜN FEAD panelleri — tek yerden düzeldi.

// Eski çağrılar aksanı CSS değişkeni dizesiyle veriyor; ton sınıfına çeviriyoruz
// ki 44 çağrı yerinin hiçbiri değişmesin.
var _FEAD_TONE = {
  'var(--accent-danger)':  'danger',
  'var(--accent-warning)': 'warning',
  'var(--accent-success)': 'success',
  'var(--accent-primary)': 'primary',
  'var(--text-muted)':     'muted'
};
function _feadTone(accent){ return _FEAD_TONE[String(accent || '')] || 'primary'; }

function _feadCard(title, unit, accent, inner){
  var head = title
    ? '<div class="ve-fp-sect" data-tone="' + _feadTone(accent) + '"><b>' + title + '</b>'
      + (unit ? '<em>' + unit + '</em>' : '') + '</div>'
    : '';
  return '<section class="ve-fp-card">' + head + inner + '</section>';
}

// Sayısal hücre ızgarası (cells=[{key,label,ph,step}]).
// `--fp-k` satır içinde YAZILIR ve VERİdir (sütun sayısı), görünüm değil —
// `<colgroup>` genişlikleriyle aynı istisna (kural 14).
function _feadGrid(node, cells, cols){
  cols = cols || 3;
  // SÜTUN SAYISI HÜCRE SAYISINI AŞAMAZ. `cols:2` bir tek hücreyle çağrıldığında
  // ızgara BOŞ bir göz bırakıyor ve o göz artık görünür (saç teli zemini) —
  // ölçüldü, gergi panelinde "Kol boyu"nun sağında yarım satırlık boşluk.
  var k = Math.max(1, Math.min(parseInt(cols, 10) || 1, cells.length || 1));
  var h = '<div class="ve-fp-grid" style="--fp-k:' + k + ';">';
  cells.forEach(function(c){
    var v = (node.data && node.data[c.key] !== undefined && node.data[c.key] !== null) ? node.data[c.key] : '';
    h += '<label class="ve-fp-f"><span class="ve-fp-l">' + c.label + '</span>'
      + '<input class="ve-fp-inp" type="number" id="ve-fead-' + c.key + '-' + node.id + '"'
      + ' value="' + _feadEsc(v) + '" step="' + (c.step || 'any') + '"'
      + (c.ph ? ' placeholder="' + _feadEsc(c.ph) + '"' : '')
      + ' onchange="' + (c.setter || 'veFeadSet') + '(\'' + node.id + '\',\'' + c.key
        + '\',this.value)"></label>';
  });
  return h + '</div>';
}

// TÜRETİLEN DEĞER SATIRI — düzenlenemez, ama girdi satırlarıyla AYNI hizada.
// Ayrı bir biçim, aynı pencerede üçüncü bir etiket modeli demekti (P2).
// OKUNUR DEĞER SATIRI. `ton` bir RENK değil bir ANLAM adı: değerin rengi
// `css/styles.css`'te `[data-ton]` kuralından gelir. Satır içine renk yazmak
// on temada tek bir sabit `#` değeri dondurmak olurdu (kural 14).
function _feadRO(label, deger, unit, ton){
  return '<label class="ve-fp-f"><span class="ve-fp-l">' + label
    + (unit ? ' <u>' + unit + '</u>' : '') + '</span>'
    + '<input class="ve-fp-inp' + (ton ? ' ve-fp-inp--ton" data-ton="' + _feadEsc(ton) : '')
    + '" value="' + _feadEsc(deger) + '" readonly tabindex="-1"></label>';
}

// Tek metin alanı — sayısal ızgarayla AYNI satır biçimi (P2: tek etiket modeli).
function _feadText(node, title, key, ph){
  var v = (node.data && node.data[key] != null) ? node.data[key] : '';
  return '<div class="ve-fp-grid" style="--fp-k:1;">'
    + '<label class="ve-fp-f"><span class="ve-fp-l">' + title + '</span>'
    + '<input class="ve-fp-inp ve-fp-inp--text" type="text" id="ve-fead-' + key + '-' + node.id + '"'
    + ' value="' + _feadEsc(v) + '" placeholder="' + _feadEsc(ph || '') + '"'
    + ' onchange="veFeadSet(\'' + node.id + '\',\'' + key + '\',this.value)"></label></div>';
}

// AÇIKLAMA SATIRI — görünümü CSS'te (`css/styles.css` → `.ve-fead-not`).
//
// ÖLÇÜ SINIRI BİR SÜS DEĞİL: panel 980 px geniş ve açıklama kabın tamamına
// yayılıyordu. Gerçek tarayıcıda ölçüldü — gergi ve kayış panellerinde satırlar
// **207 karaktere** çıkıyor (okunur bant 65–75). Göz satır sonundan başına
// dönerken yerini kaybediyor; metin "uzun" değil, SATIRI uzun.
function _feadHint(text){
  return '<div class="ve-fead-not">' + text + '</div>';
}

// "Bu bölüm SPEC ile gelecek" notu — kullanıcıya iskeletin nerede bittiğini
// SÖYLER. Sessizce boş bırakılan bir panel, çalışmayan bir panelden kötüdür.
function _feadPending(text){
  return '<div style="padding:8px 10px; margin-bottom:9px; font-size:var(--fs-micro); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px dashed var(--accent-warning);">'
    + '<b style="color:var(--text-heading);">Hesap çekirdeği bekleniyor.</b> ' + text + '</div>';
}

// Açılır liste (seçenekler: [[değer, etiket], …]).
// `--sel` varyantı kontrol sütununu genişletir: sabit genişlik seçeneğin
// metnini kırpıyordu (ölçüldü: 169 px gerek / 120 px alan).
function _feadSelect(node, title, key, options, def, hint){
  var cur = (node.data && node.data[key] != null && node.data[key] !== '') ? String(node.data[key]) : String(def);
  var h = '<div class="ve-fp-grid" style="--fp-k:1;">'
    + '<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">' + title + '</span>'
    + '<select class="ve-fp-sel" id="ve-fead-' + key + '-' + node.id + '"'
    + ' onchange="veFeadSetChoice(\'' + node.id + '\',\'' + key + '\',this.value)">';
  options.forEach(function(o){
    h += '<option value="' + _feadEsc(o[0]) + '"' + (String(o[0]) === cur ? ' selected' : '') + '>' + _feadEsc(o[1]) + '</option>';
  });
  h += '</select></label></div>';
  return h + (hint ? _feadHint(hint) : '');
}

// Onay kutusu (bayrak).
function _feadToggle(node, title, key, handler, hint){
  var on = !!(node.data && node.data[key]);
  return '<label class="ve-fp-chk"><input type="checkbox"' + (on ? ' checked' : '')
    + ' onchange="' + handler + '(\'' + node.id + '\',this.checked)">'
    + '<span>' + title + '</span></label>' + (hint ? _feadHint(hint) : '');
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
  if(typeof saveState === 'function') saveState();
}

// ── KANVAS ↔ mm KÖPRÜSÜ KALKTI (2026-09-09) ────────────────────────────────
// `veFeadPlaceFromCoords` (mm → kutu) ve `veFeadSyncDrag` (kutu → mm) kasnak
// KUTULARINI konumlandırıyordu. Kutular kalktı: kasnakların kanvasta konumu
// yok, koordinat yalnız Kayış Tablosu'ndan giriliyor. İkisiyle birlikte
// "kenetleme kasnak sürüklenirken kapalı" istisnası da kalktı (ui-core.js).
// Ölçümleri modül skill'inde arşivli — o köprünün çözdüğü iki sessiz kayma
// (örnek kurucusunun kendi ölçeği · hizalama kenetlemesi) bugün KURULAMIYOR.

// ── PORT KENARI KANCASI KALKTI (2026-09-09) ────────────────────────────────
// `veFeadPortSideFor` kasnak portunu KOMŞUYA BAKAN kenara koyuyordu: klasik
// "giriş solda / çıkış sağda" kuralı bir ÇEVRİMDE yolun yarısında ters düşüyor
// ve tel düğümün üstünden geri geçiyordu. On uçtan altısının 36,8…72 px
// saptığı ölçüm o kancayı doğurmuştu.
//
// Kasnaklar artık 0/0 portlu (sıra tabloda), yani kancanın çözdüğü sorun
// ORTADAN KALKTI — kanca dursaydı hiç çağrılmayan bir dal olurdu. Ölçüm
// `.claude/skills/fead/references/kanvas-ve-kart.md` içinde duruyor: aynı yön
// yeniden denenirse nelerin ölçülmüş olduğu oradan okunur.
// ── KANVAS ROZETİ — DAĞITICI ───────────────────────────────────────────────
// Stil ELEMANIN ÜSTÜNDE (css/ dosyasında değil) çünkü css/styles.css'e
// dokunmak Ölçüm Görüntüleyici'nin ve CAN Çözümleyici'nin dağıtım dosyalarını
// bayatlatıyor (bkz. CLAUDE.md); iki rozet için o zinciri kurmaya değmez.
//
// KASNAK K/S ROZETİ KALDIRILDI — erişilemez koddu. Kasnakların kanvasta kutusu
// yok (`noCanvasBox`), yani `createNode` ve `restoreState` onlara DOM elemanı
// hiç kurmuyor ve `veFeadRefreshBadges`'in `getElementById`'si her seferinde
// null dönüyordu. Modülün kuralı bunu zaten söylüyordu ("Kanvas rozeti (K/S)
// kutularla birlikte kalktı"); kalkmayan şey koddu. Temas tarafı üç canlı
// yüzeyde duruyor: tip varsayılanı → kasnak paneli → Kayış Tablosu'nun
// "Kasnak Dönüş Yönü" sütunu.
//
// Geriye kutusu OLAN iki tip kaldı ve ikisi de rozetini kendi çiziyor.
function veFeadApplyBadge(nodeEl, node){
  if(!nodeEl || !node || typeof document === 'undefined') return false;
  var old = nodeEl.querySelector('.ve-fead-badge');
  if(old) old.remove();
  if(_feadDefOf(node).isFeadBelt) return veFeadApplyBeltModeBadge(nodeEl, node);
  if(_feadDefOf(node).isFeadSpin) return veFeadApplySpinBadge(nodeEl, node);
  return false;
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
    + 'padding:2px 4px; border-radius:var(--radius-xs);'
    + 'color:' + (serbest ? 'var(--on-warning)' : 'var(--on-accent)')
    + '; background:' + (serbest ? 'var(--accent-warning)'
                                 : 'var(--accent-primary)')
    + '; border:1px solid var(--bg-primary);'
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
  if(typeof veFeadRefreshCards === 'function') veFeadRefreshCards();
  // Panel açıksa o da tazelensin: serbest kipte "Efektif boy" alanı GİRDİ
  // olmaktan çıkıp türetilmiş bir okumaya dönüşüyor.
  if(typeof showNodeProperties === 'function'
     && typeof selectedNode !== 'undefined' && selectedNode && selectedNode.id === nodeId)
    showNodeProperties(node);
  return yeni;
}

// ── KONUM BAĞI BİLEŞENİ KALKTI (2026-09-09) ───────────────────────────────
// `fead-coordlink` yalnız kanvas konumu ile mm koordinatı arasındaki bağı
// açıp kapatıyordu. Kasnakların kanvasta kutusu kalmayınca bağlanacak bir
// konum da kalmadı: bileşen kendi başına tutarlı görünen ama HİÇBİR ŞEY
// yapmayan bir rozete dönüşürdü. Rozet, panel, çevirme ve silme kancası
// birlikte kaldırıldı.

// ── DÖNÜŞ YÖNÜ ROZETİ ───────────────────────────────────────────────────────
//
// Rozet bir BAYRAK GÖSTERMİYOR, KAYIŞ SIRASINDAN TÜREYEN yönü gösteriyor:
// `veFeadSpinOf` kasnakların tablo sırasını (`beltIndex`) okuyup
// `veFeadNaturalSense` ile yönü çıkarıyor (çekirdeğin `loopSense`'iyle AYNI
// ölçüt). Tıklamak bir "yön" alanı yazmıyor, SIRAYI çeviriyor — tek gerçek
// kaynak orası.
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
// örnek yüklenirken tesadüfen örtüşüyor, ama sıra çevrilince dizi DEĞİŞMİYOR.
// Diziden okuyan rozet, yön çevrildikten sonra da eski yönü gösteriyordu —
// sessiz, çünkü sayı makul.
//
// TEK NOKTA: rozet de panel de burayı çağırıyor (iki ayrı hesap tutulsaydı
// biri bayat kalırdı — bu modülün tekrar eden kuralı).
function veFeadCurrentSpin(){
  if(typeof nodes === 'undefined' || typeof veFeadSpinOf !== 'function') return 0;
  // veFeadSpinOf tablo sırasını (beltIndex) okur. Buradan
  // veFeadNaturalSense(veFeadRouteOrder(…)) çağırmak işareti ters çevirirdi —
  // veFeadRouteOrder GİDİŞ sırasını döndürüyor (fead-model.js).
  return veFeadSpinOf(nodes);
}

function veFeadApplySpinBadge(nodeEl, node){
  // ROZET KAYIŞIN GERÇEK DÖNÜŞÜNÜ BASAR: `veFeadCurrentSpin` liste sırasının
  // dolanımını okuyup işaretini çeviriyor (liste gidişin tersi — fead-model.js
  // → veFeadNaturalSense). Kart da aynı işaretten çiziyor; ikisi tek kaynak.
  var sense = veFeadCurrentSpin();
  var lbl = veFeadSpinLabel(sense);
  var metin = lbl.kisa;

  // Hüküm oturumluk sonuçtan okunur; çözüm yoksa rozet renk İDDİA ETMEZ.
  var _R = (typeof veFeadResults !== 'undefined' && veFeadResults) ? veFeadResults : null;
  var hkm = (_R && _R.tensionerSide) ? !!_R.tensionerSide.ok : null;

  var bg = (hkm === true) ? 'var(--accent-success)'
         : (hkm === false) ? 'var(--accent-danger)'
         : 'var(--text-secondary)';
  // METİN JETONU ZEMİNİN EŞİ: `--on-accent` birincil aksana göre kalibre,
  // yeşil/kırmızı dolguya göre değil. Nötr hâlin zemini bir METİN rengi
  // (`--text-secondary`) olduğu için oraya `--on-accent` de uymaz — tersi
  // gerek, yani sayfanın kendi zemini.
  var fg = (hkm === true) ? 'var(--on-success)'
         : (hkm === false) ? 'var(--on-danger)'
         : 'var(--bg-primary)';
  var b = document.createElement('span');
  b.className = 've-fead-badge';
  b.textContent = metin;
  b.title = (sense === 0
      ? 'Kayış dönüş yönü okunamadı (kasnak koordinatları eksik).'
      : 'Kayış çevrimi ' + lbl.uzun
        + '. Yön TABLO sırasından türer; '
        + 'tıkla → kayış yolunu ters çevir.')
    + (hkm === false
        ? '\n\nUYARI: bu yönde gergi kayışın GERGİN tarafına düşüyor; '
          + 'span gerilmeleri ankrajın altına iniyor.'
        : hkm === true ? '\n\nGergi gevşek tarafta ✓' : '');
  b.style.cssText = 'position:absolute; top:-9px; right:-6px; z-index:3; cursor:pointer;'
    + 'font-size:var(--fs-micro); font-weight:700; line-height:1; letter-spacing:0.02em;'
    + 'padding:2px 4px; border-radius:var(--radius-xs);'
    + 'color:' + fg + '; background:' + bg + '; border:1px solid var(--bg-primary);';
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
// KAYIŞ SIRASI çevrilir (beltIndex), bir "yön" alanı yazılmaz — gerekçe
// fead-model.js → veFeadReverseRoute. saveState mutasyondan ÖNCE çağrılıyor
// (geri-al yığınına ÖN durumu koymak için — projenin kendi sözleşmesi), sonra
// bağlantı katmanı tazeleniyor. Kart tazelemesi için AYRI bir çağrı
// gerekmiyor: `veFeadTopoSignature` kasnakların beltIndex'ini okuyor, sıra
// değişince imza değişiyor ve `updateAllConnections` kartı kendisi yeniden
// kuruyor. İndis imzaya ALINMASAYDI geri-al sonrası kart sessizce bayat
// kalırdı — tel döneminde tel uçlarının yaptığı işi şimdi indis yapıyor.
function veFeadToggleSpin(){
  if(typeof nodes === 'undefined') return 0;
  if(typeof veFeadReverseRoute !== 'function') return 0;
  if(typeof saveState === 'function') saveState();
  var k = veFeadReverseRoute(nodes);
  if(typeof updateAllConnections === 'function') updateAllConnections();
  veFeadRefreshBadges();
  if(typeof veFeadRefreshCards === 'function') veFeadRefreshCards();
  if(typeof showNodeProperties === 'function'
     && typeof selectedNode !== 'undefined' && selectedNode)
    showNodeProperties(selectedNode);
  if(typeof showToast === 'function'){
    var sense = veFeadCurrentSpin();
    // SAYI KASNAK SAYISI, BAĞLANTI SAYISI DEĞİL — `veFeadReverseRoute` kayış
    // sırasını (beltIndex) yeniden numaralandırıyor. Eski metin "N bağlantı
    // çevrildi" diyordu; FEAD'de bağlantı YOK (on iki tipin on ikisinde de
    // inputs:0/outputs:0), yani kullanıcıya hiç var olmamış bir şeyin sayısı
    // veriliyordu.
    showToast(k ? ('Kayış dönüş yönü: ' + veFeadSpinLabel(sense).kisa
                   + ' · ' + k + ' kasnak yeniden sıralandı')
                : 'Sırası çevrilecek kasnak yok (en az üç kasnak gerekir)',
              k ? 'info' : 'warning');
  }
  return k;
}

// ── DÖNÜŞ YÖNÜ PENCERESİ — KRANK KASNAĞI AİLESİNDE ─────────────────────────
// Kullanıcı isteği (2026-09-23): FEAD pencereleri Krank Kasnağı'nın yapısında,
// KATEGORİ KATEGORİ. İki kategori: YÖN (çevrimin dönüşü, nereden türediği,
// yanlış taraftaysa gerginin hükmü) ve ETKİSİ (yön değişince neyin değişip
// neyin değişmediği). Pencerenin EYLEMİ "Yönü çevir" — çözücüdeki Hesapla'nın
// yerinde, sekmeden bağımsız. Hüküm sağ sütunda bir DURUM satırı: cevap bir
// sekmenin içine gömülürse öteki sekmedeyken görünmez.
//
// Görünüm CSS'te (`.ve-fp-yon` · `.ve-fp-liste` · `.ve-fp-durum[data-d]`):
// eski panel yönün rengini, vurguları ve düğmeyi SATIR İÇİ yazıyordu ve
// düğme fareye hiç tepki vermiyordu (kural 14).
function getFeadSpinPropertiesHTML(node){
  if(!node.data) node.data = {};
  var sense = veFeadCurrentSpin();
  var lbl = veFeadSpinLabel(sense);
  var metin = sense ? lbl.uzun : '— (okunamadı)';
  var R = (typeof veFeadResults !== 'undefined' && veFeadResults) ? veFeadResults : null;
  var hkm = (R && R.tensionerSide) ? R.tensionerSide : null;
  var ton = !hkm ? '' : hkm.ok ? 'success' : 'danger';

  // DÜZLEM ADI TEK ÜRETİCİDEN (`_feadPlaneName`). Burada ikinci kez
  // yazılsaydı, ayna bayrağı değişince pencere sessizce eskirdi.
  //
  // METİN TEL DÖNEMİNDEN KALMIŞTI: "kablolama sırasından türer", "tel from →
  // to", "bağlantıları ters çevirir", "kanvastaki gidiş okları da döner".
  // Kasnaklar 2026-09-09'da bağlanmaz oldu (sıra `beltIndex` alanında) ve
  // kanvasta kutuları bile yok — dolayısıyla ne kablo var, ne gidiş oku.
  // Kullanıcı panelde tarif edilen şeyi ekranda arıyordu.
  var yon = _feadCard('Kayış Dönüş Yönü', 'kayış tablosundan', 'var(--accent-primary)',
      '<div class="ve-fp-yon"' + (ton ? ' data-ton="' + ton + '"' : '') + '>'
    + _feadEsc(metin) + '</div>'
    + _feadHint('Yön bir ayar DEĞİL: <b>Kayış Tablosu\'nun satır sırasından</b> türer '
        + '(<b>' + _feadEsc(
            (typeof _feadPlaneName === 'function') ? _feadPlaneName() : 'çizim düzlemi')
        + '</b>). Tablo sırası Gates raporlarının "Layout Data" yönündedir, yani '
        + 'kayışın gidişinin TERSİ; köprü çekirdeğe o sırayı verir. Sürücü kayışı '
        + 'kendine çektiği için gergin taraf ona GİREN açıklıktır. "Yönü çevir" '
        + 'krank sabit kalacak şekilde kalan kasnakların sırasını ters çevirir — '
        + 'tablodaki numaralar da onunla döner.'));

  if(hkm && !hkm.ok){
    yon += _feadCard('Gergi Tarafı', 'hüküm', 'var(--accent-danger)',
        '<div class="ve-fp-durum" data-d="no">'
      + '<b>Gergi kayışın GERGİN tarafında.</b> '
      + 'Ankraj ' + _feadFmt(hkm.anchorN, 1) + ' N, en düşük açıklık '
      + _feadFmt(hkm.minN, 1) + ' N ("' + _feadEsc(hkm.minName || '—') + '") — '
      + _feadFmt(hkm.deficitN, 1) + ' N altında. Otomatik gergi tanım gereği '
      + '<b>gevşek</b> tarafa konur; gergin tarafta tahrik gerginliğinin tamamını '
      + 'yayla karşılamak zorunda kalır ve durdurucusuna dayanır.</div>'
      + _feadHint('Çare: <b>yönü çevirin</b> ya da gergiyi kayış sırasında sürücünün '
        + 'önüne alın. Tasarım gerginliğini yükseltmek bir seçenek DEĞİL — o değer yay '
        + 'dengesinden türüyor, panelde girilen bir alan değil.'));
  }

  // GEOMETRİ YÖNDEN BAĞIMSIZ, GERİLME DEĞİL — ve bunu pencere SÖYLÜYOR, çünkü
  // kullanıcı "yönü çevirdim, sarım açıları neden aynı" diye sormasın.
  var etk = _feadCard('Neyi Değiştirir', 'ölçüldü', 'var(--text-muted)',
      '<ul class="ve-fp-liste">'
    + '<li><b>Değişmez:</b> sarım açıları, açıklıklar, efektif kayış boyu, Σsarım=360 '
    + '— ölçüldü, kasnak başına fark 2,5e−14°</li>'
    + '<li><b>Değişir:</b> hangi açıklığın GERGİN olduğu — yani span gerilmeleri, '
    + 'hubload yönleri ve kayma emniyeti</li>'
    + '<li><b>Değişir:</b> kasnakların dönüş yönü ve Kayış Tablosu\'ndaki sıra numaraları</li>'
    + '</ul>');

  var durum = !hkm
    ? '<div class="ve-fp-durum"><b>Gergi tarafı:</b> hüküm için önce Çözücü '
      + 'penceresinden çözüm koşturun.</div>'
    : hkm.ok
      ? '<div class="ve-fp-durum" data-d="ok"><b>Gergi gevşek tarafta ✓</b> — ankraj '
        + 'en düşük açıklık, gerilme zinciri bu yönde tutarlı.</div>'
      : '<div class="ve-fp-durum" data-d="no"><b>Gergi GERGİN tarafında</b> — yönü '
        + 'çevirin ya da gergiyi sürücünün önüne alın (Yön sekmesi).</div>';
  var eylem = '<button type="button" class="ve-fp-solve" onclick="veFeadToggleSpin()">'
    + '<span class="mf-ico mf-ico-refresh" aria-hidden="true"></span> Yönü çevir</button>';

  var yan = veFeadToolSide(node, null, null, null, durum + eylem);
  return veFeadPanelShell(node, [{ k:'yon', ad:'Yön',    govde: yon },
                                 { k:'etk', ad:'Etkisi', govde: etk }], yan);
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
// ── SEKME DURUMU MODELDE DEĞİL ────────────────────────────────────────────
//
// Kural 15'in (`VE_FEAD_KAT_ACIK`) birebir aynı gerekçesi: görünüm durumu
// kaydedilmez ve geri-al yığınına YAZILMAZ — yazılsaydı Ctrl+Z sekme
// gezdirirdi. Ama panel her seçim değişiminde yeniden kurulduğu için bir
// yerde durmak ZORUNDA, yoksa panel her açılışta ilk sekmeye dönerdi.
var VE_FEAD_PANEL_TAB = {};

function veFeadPanelTabOf(nodeId, gecerli){
  var k = VE_FEAD_PANEL_TAB[nodeId];
  return (k && gecerli.indexOf(k) >= 0) ? k : gecerli[0];
}

// SEKME DEĞİŞİNCE PANEL YENİDEN KURULMAZ, yalnız `hidden` çevrilir.
//
// Yeniden kurmak iki şeyi birden bozardı: (a) düzenlenen alanın odağı düşer
// (bu deponun tekrar eden dersi — bkz. `veFeadMarkSelectedRow`), (b) SAĞ SÜTUN
// da yeniden çizilir, oysa bu tasarımın bütün iddiası sağ sütunun sekmeden
// BAĞIMSIZ durması. Üstelik sağ sütun bir çözüm koşturuyor; her tıklamada
// yeniden koşmak şemayı yanıp söndürürdü.
function veFeadPanelTab(nodeId, key){
  if(typeof document === 'undefined') return false;
  var kap = document.getElementById('ve-fp-tabs-' + nodeId);
  var gov = document.getElementById('ve-fp-panes-' + nodeId);
  if(!kap || !gov) return false;
  VE_FEAD_PANEL_TAB[nodeId] = key;
  Array.prototype.forEach.call(kap.querySelectorAll('.ve-fp-tab'), function(b){
    b.setAttribute('aria-selected', String(b.getAttribute('data-k') === key));
  });
  Array.prototype.forEach.call(gov.children, function(pn){
    pn.hidden = (pn.getAttribute('data-k') !== key);
  });
  // Açılan sekmedeki tablo birimi AYNI karede karar alır — gözlemciye
  // kalsaydı geniş tablo bir kare yatay kaydırmayla görünürdü.
  if(typeof veTabloOlcIcinde === 'function') veTabloOlcIcinde(gov);
  return true;
}

// Sekme şeridi + gövdeler. Her sekme ADININ altında DURUMUNU taşır
// (`s.durum` — bkz. `veFeadSekmeDurumlari`); durumu olmayan pencerede (araç
// pencereleri) yalnız ad basılır. Eski sayı rozeti bu satıra yerini bıraktı
// ve KALKTI: çözücünün satır sayısı artık Çevrim sekmesinin durum satırı.
function veFeadTabsHTML(nodeId, sekmeler, aktif){
  var h = '<div class="ve-fp-tabs" role="tablist" id="ve-fp-tabs-' + nodeId + '">';
  sekmeler.forEach(function(s){
    var D = s.durum || null;
    h += '<button type="button" class="ve-fp-tab" role="tab" data-k="' + s.k + '"'
      + (D ? ' data-d="' + D.d + '"' : '')
      + ' aria-selected="' + (s.k === aktif ? 'true' : 'false') + '"'
      + ' onclick="veFeadPanelTab(\'' + nodeId + '\',\'' + s.k + '\')">'
      + '<span class="ve-fp-tab-ad">' + _feadEsc(s.ad) + '</span>'
      + (D ? _feadSekmeDurumHTML(D) : '')
      + '</button>';
  });
  h += '</div>' + veFeadEksikBandi(nodeId, sekmeler)
     + '<div id="ve-fp-panes-' + nodeId + '">';
  sekmeler.forEach(function(s){
    h += '<div data-k="' + s.k + '"' + (s.k === aktif ? '' : ' hidden') + '>' + s.govde + '</div>';
  });
  return h + '</div>';
}

// ════════════════════════════════════════════════════════════════════════════
//  SEKME DURUMU — "bu sekmede eksik bir şey var mı"
// ════════════════════════════════════════════════════════════════════════════
// Kullanıcı isteği (2026-09-26, ekran görüntüsüyle): *"kullanıcı bu kısmı
// görmeyebilir ve eksik bilgi girebilir"* → tasarım tezgâhından **B · Durumlu
// Sekmeler** seçildi. Sekme adının altında bir durum satırı, eksik varsa
// şeridin altında sebebini ve oraya giden bağlantıyı yazan bir bant.
//
// DÖRT DURUM, dördü de koddan okunur — tahmin edilmez:
//   ok     hesabın kullandığı bütün alanlar dolu
//   eksik  boş alanın bir SONUCU var: köprünün hatası, varsayılan uyarısı,
//          bir kapının 'wait'i ya da sessiz sıfır. Sonuç `neden`de yazılı.
//   bos    boş ama yerine başka kaynak var (isteğe bağlı)
//   yok    bu düğümde hiçbir hesap sekmeyi okumuyor — sürücünün devir sınırı
//          ve güç eğrisi (iki kapı da sürücüyü atlar, sürücünün gücü
//          öteki kasnakların toplamıdır). Kural 25: sorulan her alanın bir
//          tüketicisi olmalı; bu sekmeler sürücüde ALAN SORMAZ, sebebini yazar.
//
// KURALLAR KÖPRÜNÜN KENDİ YÜKLEMLERİ, ikinci bir liste değil: `veFeadHasOD`,
// `veFeadAccLimits` (katalogtan gelen sınır DOLU sayılır — yalnız ham alana
// bakan bir sayım katalog seçmiş kullanıcıya "0/3" derdi), `veFeadBeltMode`
// + `veFeadBeltModeLocked`, `veFeadResolveDriver` (sürücü açıkça seçilmemişse
// köprünün TİPTEN seçtiği), `veFeadPresetOf`, `veFeadResultState`. Yine de
// ayrı yazılmış bir doğrulama köprü değişince sessizce eskirdi — kapı bu
// yüzden ANLAŞMAYI ölçer: her zorunlu alan gerçek bir modelde tek tek
// boşaltılır ve hem sekme 'eksik' der hem köprü hatasını/uyarısını verir
// (`tests/unit/fead-sekme-durum.test.js`). KÖPRÜYE YENİ ZORUNLU ALAN
// EKLEYEN, ONU BURAYA DA EKLER.
function _feadDurum(d, yazi, neden){
  var o = { d: d, yazi: yazi };
  if(neden) o.neden = neden;
  return o;
}
function _feadDolu(v){ return Number.isFinite(_feadNum(v, NaN)); }
function _feadIlkBuyuk(t){ t = String(t || ''); return t.charAt(0).toLocaleUpperCase('tr') + t.slice(1); }

function veFeadSekmeDurumlari(node, build){
  if(!node) return null;
  var def = _feadDefOf(node);
  if(def.isFeadTensioner) return _feadGergiDurum(node);
  if(def.isFeadPulley)    return _feadKasnakDurum(node, _feadDurumModel(build));
  if(def.isFeadBelt)      return _feadKayisDurum(node);
  if(def.isFeadSolver)    return _feadCozucuDurum(node, _feadDurumModel(build));
  return null;                                  // araç pencereleri: durum yok
}
function _feadDurumModel(build){
  if(build) return build;
  try { return (typeof veFeadBuildFromCanvas === 'function') ? veFeadBuildFromCanvas() : null; }
  catch(e){ return null; }
}

// Köprünün sürücüsü: açık işaret → TİP → ilk kasnak (`veFeadResolveDriver`).
// Yalnız `data.driver`a bakmak, işaretsiz krankı sürücü saymayıp iki ölü
// sekmeyi "eksik" diye gösterirdi.
function _feadEtkinSurucuMu(node, build){
  var drv = (build && Array.isArray(build.order) && build.order.length
             && typeof veFeadResolveDriver === 'function') ? veFeadResolveDriver(build.order) : null;
  return drv ? (drv.id === node.id) : !!(node.data && node.data.driver);
}

function _feadCapNot(node){
  var dd = (typeof VE_FEAD_DEFAULT_DIA !== 'undefined' && VE_FEAD_DEFAULT_DIA[node.type]) || 100;
  return 'Dış çap girilmedi — tipe göre ' + dd + ' mm varsayıldı; kayış boyu ve sarım açıları '
    + 'bu varsayıma dayanıyor.';
}

function _feadKasnakDurum(node, build){
  var d = node.data || {}, def = _feadDefOf(node), out = {};
  // GEOMETRİ — konum köprünün HATASI, çap VARSAYILAN UYARISI.
  var konum = _feadDolu(d.x) && _feadDolu(d.y);
  if(!konum) out.geo = _feadDurum('eksik', 'konum yok',
    'Konum X / Y girilmedi — kayış yolu bu kasnak olmadan çözülemiyor.');
  else if(!veFeadHasOD(node)) out.geo = _feadDurum('eksik', 'çap yok', _feadCapNot(node));
  else out.geo = _feadDurum('ok', 'tamam');
  // ROL — zorunlu alanı yok: sürücü bir rol, atalet boşsa Gates medyanı
  // (varsayılan listesinde yazılı), katalog modeli isteğe bağlı.
  out.rol = _feadDurum('ok', 'tamam');
  if(def.isFeadIdler) return out;               // avarada bu iki sekme hiç açılmaz

  if(_feadEtkinSurucuMu(node, build)){
    out.dev = _feadDurum('yok', 'kullanılmaz');
    out.egr = _feadDurum('yok', 'kullanılmaz');
    return out;
  }

  // DEVİR SINIRLARI — iki kapının girdisi (fead-checks.js).
  var lim = (typeof veFeadAccLimits === 'function') ? veFeadAccLimits(node) : null, n = 0;
  if(lim) ['optimum', 'maxCont', 'maxPeak'].forEach(function(k){ if(lim[k] && lim[k].rpm > 0) n++; });
  out.dev = (n === 3) ? _feadDurum('ok', 'tamam')
    : _feadDurum('eksik', n + '/3 girildi', n === 0
        ? 'Üçü de boş: bu kasnak devir kapılarında değerlendirilemiyor — uygun sayılmaz.'
        : (3 - n) + ' sınır boş: devir kapıları bu kasnak için eksik kalıyor.');

  // GÜÇ EĞRİSİ — çevrimdeki boş kW hücresi önce bu eğriden, sonra katalogdan
  // dolar; ikisi de yoksa köprü O SATIRDA 0 kW YAZAR (`veFeadDutyToCore`) —
  // sessiz sıfır. Eğri boş ama çevrim kW'ı taşıyorsa sekme isteğe bağlıdır.
  var pts = (typeof veFeadPowerCurve === 'function') ? veFeadPowerCurve(node) : [];
  var pre = (typeof veFeadPresetOf === 'function') ? veFeadPresetOf(node) : null;
  if(pts.length) out.egr = _feadDurum('ok', pts.length + ' nokta');
  else if(pre && pre.curve) out.egr = _feadDurum('ok', 'katalogdan');
  else {
    var sn = build && build.solver;
    var rows = (sn && typeof veFeadDutyRows === 'function') ? veFeadDutyRows(sn) : [];
    var bos = rows.filter(function(r){
      if(!(r.rpm > 0)) return false;
      var v = r.kw ? r.kw[node.id] : undefined;
      return v === undefined || v === null || v === '';
    }).length;
    out.egr = bos
      ? _feadDurum('eksik', 'kW eksik', 'Çalışma çevriminin ' + bos + ' satırında bu kasnağın '
          + 'kW değeri yok ve güç eğrisi de yok — o satırlarda yük 0 kW sayılıyor.')
      : _feadDurum('bos', 'isteğe bağlı');
  }
  return out;
}

function _feadGergiDurum(node){
  var d = node.data || {}, out = {};
  if(!(_feadDolu(d.cenX) && _feadDolu(d.cenY)))
    out.geo = _feadDurum('eksik', 'merkez yok', 'Avara merkezi (X / Y) girilmedi — kayış yolu '
      + 'bu noktadan geçiyor; model çözülemiyor.');
  else if(!veFeadHasOD(node)) out.geo = _feadDurum('eksik', 'çap yok', _feadCapNot(node));
  else out.geo = _feadDurum('ok', 'tamam');

  var kol = [];
  if(!(_feadNum(d.armLen, 0) > 0)) kol.push('kol boyu');
  if(!_feadDolu(d.armMeanDeg))     kol.push('kol çalışma açısı');
  out.kol = kol.length
    ? _feadDurum('eksik', (2 - kol.length) + '/2 girildi', _feadIlkBuyuk(kol.join(' ve '))
        + ' girilmedi — gergi gövdesinin montaj konumu kurulamıyor; model çözülemiyor.')
    : _feadDurum('ok', 'tamam');

  // Yay dengesi üç sayıdan (`veFeadSpringSetup`): ön yük, katsayı (> 0),
  // çalışma momenti. Eksik olan ADIYLA yazılır — köprünün "çalışma momenti
  // girilmedi" hatası katsayı boşken de düşüyor, o yüzden ondan okunmaz.
  var yay = [];
  if(!_feadDolu(d.preload))           yay.push('ön yük');
  if(!(_feadNum(d.kArm, NaN) > 0))    yay.push('yay katsayısı');
  if(!_feadDolu(d.meanLoad))          yay.push('çalışma momenti');
  out.yay = yay.length
    ? _feadDurum('eksik', (3 - yay.length) + '/3 girildi', _feadIlkBuyuk(yay.join(', '))
        + ' girilmedi — yay dengesi ve kolun nominal açısı kurulamıyor; model çözülemiyor.')
    : _feadDurum('ok', 'tamam');
  return out;
}

function _feadKayisDurum(node){
  var d = node.data || {}, out = {};
  out.pro = (_feadNum(d.ribs, 0) > 0) ? _feadDurum('ok', 'tamam')
    : _feadDurum('eksik', 'kanal yok', 'Kanal (kaburga) sayısı girilmedi — model çözülemiyor.');
  // Gergi varsa kip KİLİTLİ serbesttir (köprünün aynı kuralı): boy bir sonuç.
  var kilit = (typeof veFeadBeltModeLocked === 'function') && veFeadBeltModeLocked();
  var kip = kilit ? 'free' : veFeadBeltMode(d);
  var L = _feadNum(d.effLength != null ? d.effLength : d.length, 0);
  out.boy = (kip === 'free') ? _feadDurum('ok', 'tasarımdan')
    : (L > 0) ? _feadDurum('ok', 'tamam')
    : _feadDurum('eksik', 'boy yok', 'Sabit kipte kayış efektif boyu girilmedi — model çözülemiyor.');
  out.mal = (_feadNum(d.massPerRibKgM, 0) > 0) ? _feadDurum('ok', 'tamam')
    : _feadDurum('bos', 'isteğe bağlı');
  return out;
}

function _feadCozucuDurum(node, build){
  var d = node.data || {}, out = {};
  // GİRDİLER — iki kapının motor devirleri (`veFeadCheckOpt`). Örneklerin
  // HİÇBİRİNDE governed yok (kural 19) ve kapının "değerlendirilemedi" demesi
  // doğru; bu satır o sonucu pencerenin tepesine taşıyor, yeni bir kural
  // koymuyor.
  var gov = _feadNum(d.governedRpm, 0) > 0, ovr = _feadNum(d.overspeedRpm, 0) > 0;
  var ne = [];
  if(!gov) ne.push('Governed devri girilmedi: çevrim oranı kapısı değerlendirilemiyor.');
  if(!ovr) ne.push('Overspeed girilmedi: aksesuarların anlık devir sınırı denetlenmiyor.');
  out.gir = ne.length ? _feadDurum('eksik', ((gov ? 1 : 0) + (ovr ? 1 : 0)) + '/2 girildi', ne.join(' '))
                      : _feadDurum('ok', 'tamam');

  out.mod = (build && build.ok) ? _feadDurum('ok', 'çözüldü')
    : _feadDurum('eksik', 'çözülemiyor', ((build && build.errors && build.errors[0])
        || 'Model çözülemiyor.'));

  var satir = (typeof veFeadDutyRows === 'function')
    ? veFeadDutyRows(node).filter(function(r){ return r.rpm > 0; }).length : 0;
  out.cev = satir ? _feadDurum('ok', satir + ' satır')
    : _feadDurum('eksik', 'boş', 'Çalışma çevrimi boş — gerilme, hubload, kayma ve frekans '
        + 'hesaplanamaz.');

  var R = (typeof veFeadResultState === 'function') ? veFeadResultState(null, node.id) : { k: 'yok' };
  out.son = (R.k === 'guncel') ? _feadDurum('ok', 'güncel')
    : (R.k === 'bilinmiyor') ? _feadDurum('ok', 'var')
    : (R.k === 'bayat') ? _feadDurum('eksik', 'bayat', 'Son hesap bayat: model hesaptan sonra '
        + 'değişti — yeniden hesaplayın.')
    : (R.k === 'hata') ? _feadDurum('eksik', 'hata', 'Son hesap hata verdi — ayrıntısı Sonuç sekmesinde.')
    : _feadDurum('bos', 'hesaplanmadı');
  return out;
}

// Sekmenin durum satırı. Nokta süs değil: renk körlüğünde ve gri basımda
// dört durumu BİÇİM ayırır (dolu · kesikli halka · yok).
function _feadSekmeDurumHTML(D){
  return '<span class="ve-fp-tab-d" data-d="' + D.d + '"><i aria-hidden="true"></i>'
    + _feadEsc(D.yazi) + '</span>';
}

// EKSİK BANDI — şeridin altında, yalnız eksik varken. Her eksik sekme için
// SONUCU (`neden`) ve oraya giden bağlantı; sonuç eskiden yalnız sağ sütunun
// dibinde yazıyordu ve 380 px'lik müfettişte kaydırmadan görünmüyordu.
function veFeadEksikBandi(nodeId, sekmeler){
  var eks = (sekmeler || []).filter(function(s){ return s.durum && s.durum.d === 'eksik'; });
  if(!eks.length) return '';
  return '<div class="ve-fp-eksik" role="status" id="ve-fp-eksik-' + nodeId + '">'
    + eks.map(function(s){
        return '<div class="ve-fp-eksik-s"><span class="mf-ico mf-ico-alert-triangle" aria-hidden="true"></span>'
          + '<span class="ve-fp-eksik-t"><b>' + _feadEsc(s.ad) + '</b> — '
          + _feadEsc(s.durum.neden || '') + '</span>'
          + '<button type="button" onclick="veFeadEksikGit(\'' + nodeId + '\',\'' + s.k + '\')">'
          + (s.k === 'son' ? 'Aç' : 'Doldur') + ' →</button></div>';
      }).join('')
    + '</div>';
}

// Bantın bağlantısı: sekmeyi açar ve İLK BOŞ girişe odaklanır. Boş giriş
// yoksa (sonuç sekmesi, çevrim tablosu) odak sekmenin kendisine gider —
// klavyeyle gelen kullanıcı nerede olduğunu kaybetmesin.
function veFeadEksikGit(nodeId, k){
  if(!veFeadPanelTab(nodeId, k)) return false;
  var gov = document.getElementById('ve-fp-panes-' + nodeId);
  var pn = gov && gov.querySelector('[data-k="' + k + '"]');
  var hedef = pn ? Array.prototype.filter.call(
      pn.querySelectorAll('input.ve-fp-inp:not([readonly]):not([disabled])'),
      function(i){ return String(i.value).trim() === ''; })[0] : null;
  if(!hedef){
    var kap = document.getElementById('ve-fp-tabs-' + nodeId);
    hedef = kap && kap.querySelector('.ve-fp-tab[data-k="' + k + '"]');
  }
  if(hedef && hedef.focus){
    hedef.focus();
    if(hedef.scrollIntoView) hedef.scrollIntoView({ block: 'nearest' });
  }
  return true;
}

// DURUM YERİNDE TAZELENİR, PANEL KURULMAZ. Sayı alanları (`veFeadSet`) paneli
// yeniden kurmuyor — kursaydı Sekme ile geçilen bir sonraki alanın odağı
// düşerdi (bu deponun tekrar eden dersi). Ama durum satırı o zaman bir
// düzenleme geride kalırdı: "0/3" yazan sekmeye üç sınır girildiği hâlde.
// `saveState` "girdi değişti" olayının tek kaynağı ve bunu oradan çağırır;
// yalnız durum satırlarına ve banda dokunur, girdi elemanlarına DOKUNMAZ.
function veFeadSekmeTazele(){
  if(typeof document === 'undefined' || typeof nodes === 'undefined') return 0;
  var n = 0, build;
  Array.prototype.forEach.call(document.querySelectorAll('.ve-fp-tabs[id^="ve-fp-tabs-"]'), function(kap){
    var id = kap.id.slice('ve-fp-tabs-'.length);
    var node = nodes.filter(function(x){ return x.id === id; })[0];
    if(!node) return;
    if(build === undefined) build = _feadDurumModel(null);
    var D = veFeadSekmeDurumlari(node, build);
    if(!D) return;
    var sekmeler = [];
    Array.prototype.forEach.call(kap.querySelectorAll('.ve-fp-tab'), function(b){
      var k = b.getAttribute('data-k'), yeni = D[k];
      var adEl = b.querySelector('.ve-fp-tab-ad');
      sekmeler.push({ k: k, ad: adEl ? adEl.textContent : k, durum: yeni || null });
      if(!yeni) return;
      b.setAttribute('data-d', yeni.d);
      var eski = b.querySelector('.ve-fp-tab-d');
      if(eski) eski.outerHTML = _feadSekmeDurumHTML(yeni);
      else b.insertAdjacentHTML('beforeend', _feadSekmeDurumHTML(yeni));
    });
    var bant = document.getElementById('ve-fp-eksik-' + id);
    var html = veFeadEksikBandi(id, sekmeler);
    if(bant){ if(html) bant.outerHTML = html; else bant.remove(); }
    else if(html) kap.insertAdjacentHTML('afterend', html);
    n++;
  });
  return n;
}

// ── SAĞ SÜTUN — GİRDİNİN SONUCU ───────────────────────────────────────────
//
// Kullanıcı seçimi (2026-09-21): B (sekmeler) + C (sağ özet). Sekme panelin
// UZUNLUĞUNU çözüyor, sağ sütun sekmenin ALDIĞI BAĞLAMI geri veriyor.
//
// Bu modülün en pahalı sessiz hatası temas tarafını ters vermek: program
// geçerli ama BAŞKA bir kayış yolu çözer, uyarı çıkmaz (kural 8). Sağdaki
// çizim onu GÖZLE yakalanabilir kılıyor — sayı doğru görünse bile resim
// yanlış görünür.
//
// TÜRETİLEN SAYILAR TABLONUN KENDİ SATIRINDAN (`veFeadTableRows`): panel ve
// tablo aynı alanı okumak zorunda (kural 9), ikinci bir hesap iki yüzeyin
// sessizce ayrışması demekti. Kapılar TEK ÇAĞRIDAN (`veFeadChecks`, kural 16).
// ════════════════════════════════════════════════════════════════════════════
//  SAĞ SÜTUN — sekmenin ALDIĞI BAĞLAMI geri veren sabit şerit
// ════════════════════════════════════════════════════════════════════════════
// Tasarım B (sekmeler) panelin UZUNLUĞUNU çözüyor ama bir bedeli var: bir
// sekmedeyken öteki sekmenin sayısı görünmüyor. Tasarım C'nin sağ sütunu tam
// bu bedeli ödüyor — sekme ne olursa olsun duruyor (kullanıcı seçimi,
// 2026-09-21: *"TASARIM B çok güzel ama TASARIM C'nin sağ taraftaki özet FEAD
// görünümünü de çok sevdim"*).
//
// ÜÇ PARÇASI VAR ve İKİSİ BÜTÜN PANELLERDE AYNI: kayış yolu küçük resmi ve
// uygunluk kapıları. Üçüncüsü (türetilenler) panele göre değişir. Panel başına
// kopyalansalardı `veFeadChecks` dört ayrı yerden çağrılırdı — kural 16 tam da
// bunu yasaklıyor — ve küçük resmin seçenekleri sessizce ayrışırdı.

// Kayış yolunun küçük resmi. Kuzey gülü, pivot ve oklar KAPALI: bu ölçüde
// okunmuyorlar, yalnız mürekkep ekliyorlar.
//
// YALNIZ KASNAK PENCERESİNDE (2026-09-23, kullanıcı: "gerekli gereksiz her
// yere eklemişsin — Sonuç'ta buna ne ihtiyaç var?"). Bölüm 17 FEAD
// penceresinin 16'sında duruyordu (yalnız Kayış Yolu'nda yoktu); kasnağı
// olmayan yedi pencerede vurgulanacak bir yer yok ve resim çözücünün,
// raporun, sihirbazın kendi sorusuna hiçbir şey katmıyordu. Kural tipten okunur
// (`componentDefs.isFeadPulley` — gergi de bir kasnak), liste tutulmaz;
// kapısı tests/unit/fead-pencere-ailesi.test.js.
//
// BÖLÜMÜN SORUSU "BU KASNAK NEREDE" (2026-09-23). Kanvas kartının resmi
// küçültülüp konuyordu ve o soruyu cevaplamıyordu: pencerenin kasnağı öteki
// beşiyle AYNI çiziliyordu. Ölçülen kusurlar (AG00879, 380 px'lik sütun):
// iki AD üst üste ("Sürücü Kasnak (FAN)" × "Otomatik Gergi (T38665)"), bir
// sarım açısı komşu kasnağın İÇİNDE, çizim çift çerçeveli. Şimdi:
//   • pencerenin kasnağı VURGULU (`highlightId`) ve adı yerleşimde önce gelir;
//   • adlar kısa (künye kodu parantezde kalır, çizimde değil);
//   • sarım açıları YOK — pencerenin açısı hemen altta "Türetilenler"de,
//     ötekilerin açısı bu sorunun cevabı değil;
//   • ad kaçamıyorsa en AZ örtüşen yere düşer (`nameSmart`), ilk adaya değil;
//   • çerçeveyi kap çizer, SVG çizmez (`frame:false`).
// Tuval 320×230: sütunda ~344 px'e büyüyor, yani yazı ~1,1× — eskiden 268
// px'ten 1,3× büyüyordu ve her etiket sığdığı yerden taşıyordu.
function _feadSideThumb(build, hlId){
  var svg = null;
  if(build && typeof veFeadLayoutSVG === 'function'){
    try {
      svg = veFeadLayoutSVG(build, 320, 230, { compass: false, pivot: false, arrows: false,
        shortNames: true, wrapLabels: false, nameSmart: true, frame: false,
        highlightId: hlId || null });
    }
    catch(e){ svg = null; }
  }
  return '<div class="ve-fp-sect"><b>Kayış Yolundaki Yeri</b></div>'
    + '<div class="ve-fp-thumb">'
    + (svg || '<div class="ve-fp-thumb-bos">Kayış yolu henüz çözülemedi — kasnak '
      + 'konumlarını ve kayış boyunu tamamlayın.</div>')
    + '</div>';
}

// Uygunluk kapıları — TEK `veFeadChecks` çağrısından (kural 16). Rapor bunu
// yeniden hesaplamaz, çözüm anında yazılan `R.checks`'i okur.
//
// ÇÖZÜCÜ MODELİN KENDİSİNDEN (`build.solver`), global taramadan DEĞİL. Bu
// satır 2026-09-21'den 09-23'e kadar `_feadSolverNode()` diyordu — o işlev
// KİMLİKLE arıyor, argümansız çağrı hiçbir düğüm bulmuyor ve kapılar BOŞ
// çevrimle soruluyordu. Ölçüldü: AG00976 ve BMC örneklerinde çözücü kartı
// "Devir sınırı: uygun" (12 devir noktası) derken FEAD pencerelerinin sağ
// sütunu aynı kapıya "değerlendirilemedi" diyordu. Sessizdi — 'wait' bir
// hata değil, "veri yok" demek. `build.solver` köprünün BULDUĞU düğüm:
// topoloji içinde global taramayla aynı, modül kartında (kök tuval) ise
// alt topolojininki — global tarama orada yanlış modeli sorardı.
function _feadSideGates(build, T){
  // Sağdaki not KULLANICIYA söylenir: burada bir dönem işlevin adı
  // (`veFeadChecks`) basılıyordu — kodun iç adı, okuyana hiçbir şey demiyor.
  var h = '<div class="ve-fp-sect"><b>Uygunluk</b><em>canlı</em></div>';
  var kapilar = null;
  try {
    if(typeof veFeadChecks === 'function' && typeof veFeadCheckOpt === 'function'){
      var sn = (build && build.solver) || null;
      kapilar = veFeadChecks(build, veFeadCheckOpt((sn && sn.data) || {},
        (sn && typeof veFeadDutyRows === 'function') ? veFeadDutyRows(sn) : []));
    }
  } catch(e){ kapilar = null; }

  function kapi(ad, K, bos){
    var d = (K && K.durum) ? K.durum : 'wait';
    var not = (K && K.note) ? K.note : bos;
    var yazi = (d === 'ok') ? 'uygun' : (d === 'warn') ? 'sınırda'
             : (d === 'no') ? 'kontrol' : 'değerlendirilemedi';
    return '<div class="ve-fp-gate" data-d="' + _feadEsc(d === 'wait' ? 'wait' : d) + '"'
      + (not ? ' title="' + _feadEsc(not) + '"' : '') + '><i></i>' + ad
      + '<span>' + yazi + '</span></div>';
  }
  var cevrimOk = !!(T && T.ok);
  h += '<div class="ve-fp-gate" data-d="' + (cevrimOk ? 'ok' : 'wait') + '"><i></i>Çevrim kapalı'
    + '<span>' + (cevrimOk && Number.isFinite(T.sumWrapDeg)
        ? 'Σ ' + _feadFmt(Math.abs(T.signedWrapDeg), 1) + '°' : '—') + '</span></div>';
  h += kapi('Merkez mesafesi', kapilar && kapilar.centerDistance, 'Kapılar yüklenmedi.');
  h += kapi('Çevrim oranı',    kapilar && kapilar.ratioWindow,    'Kapılar yüklenmedi.');
  h += kapi('Devir sınırı',    kapilar && kapilar.speedLimit,     'Kapılar yüklenmedi.');
  return h;
}

// Model + o düğümün tablo satırı. Tablo TEK KAYNAK (kural 9): sağ sütun kendi
// geometrisini hesaplamaz, satırı okur.
function _feadSideModel(node){
  var build = null;
  try { build = (typeof veFeadBuildFromCanvas === 'function') ? veFeadBuildFromCanvas() : null; }
  catch(e){ build = null; }
  var T = null, satir = null;
  try {
    T = (build && typeof veFeadTableRows === 'function') ? veFeadTableRows(build) : null;
    if(T && T.rows && node) satir = T.rows.filter(function(r){ return r.id === node.id; })[0] || null;
  } catch(e){ T = null; satir = null; }
  return { build: build, T: T, satir: satir, n: (T && T.rows) ? T.rows.length : 0 };
}

// Türetilen değer bloğu — `_feadRO` TEK KAYNAK: okunur giriş, düzenlenebilir
// olandan yalnız `readonly` ile ayrılsaydı fare yine imleç gösterirdi.
// İKİ SÜTUN: tek sütunda dört okuma dört TAM GENİŞLİK kutu oluyordu —
// 380 px'lik pencerede ~350 px dikey yer, değer kutunun öbür ucunda
// (ölçüldü). Sütun sayısı satır sayısını aşmaz (`_feadGrid`in kuralı).
function _feadSideRO(baslik, kaynak, satirlar){
  var h = '<div class="ve-fp-sect"><b>' + baslik + '</b>'
        + (kaynak ? '<em>' + kaynak + '</em>' : '') + '</div>'
        + '<div class="ve-fp-grid" style="--fp-k:' + Math.max(1, Math.min(2, satirlar.length)) + ';">';
  satirlar.forEach(function(r){ h += _feadRO(r[0], r[1], r[2] || ''); });
  return h + '</div>';
}

function veFeadPulleySide(node){
  var out = { html: '' };
  var M = _feadSideModel(node);
  var build = M.build, T = M.T, satir = M.satir, nT = M.n;

  out.html += _feadSideThumb(build, node && node.id);
  out.html += _feadSideRO('Türetilenler', 'çekirdekten', [
    ['Efektif çap', (satir && Number.isFinite(satir.effDiaMm)) ? _feadFmt(satir.effDiaMm, 1) + ' mm' : '—'],
    ['Sarım açısı', (satir && Number.isFinite(satir.wrapDeg)) ? _feadFmt(satir.wrapDeg, 1) + '°' : '—'],
    ['Dönüş yönü', (satir && satir.spin) ? satir.spin : '—'],
    ['Kayış sırası', satir ? (satir.index + ' / ' + nT + (satir.driver ? ' · sürücü' : '')) : '—']
  ]);
  out.html += _feadSideGates(build, T);
  return out;
}

// ÖZET ŞERİDİ YOK (2026-09-23, kullanıcı: "tepede böyle özet bir açıklamaya
// gerek yok"). Pencerenin başında çap · konum · rol · temas · sıra çipleri
// duruyordu; beşinin de yeri pencerenin kendisindeydi (Geometri sekmesi ve
// sağ sütunun "Türetilenler"i), yani şerit aynı sayıları ikinci kez, üstelik
// sekmelerin ÜSTÜNDE yazıyordu. Kapı: fead-pencere-ailesi.test.js.

// ── ARAÇ PANELLERİNİN SAĞ SÜTUNU (kayış · çözücü · tablo · rapor · …)
// Kasnak sütununun aynısı, KÜÇÜK RESİM HARİÇ: vurgulanacak kasnağı olmayan
// pencerede kayış yolunun resmi bir şey söylemiyor (`_feadSideThumb`).
// `ekBlok` panelin kendi cevabını (çözücüde "Hesapla" düğmesi) sütuna asmak
// için — sekme ne olursa olsun görünmesi gereken tek şey o.
function veFeadToolSide(node, baslik, kaynak, satirlar, ekBlok){
  var out = { html: '' };
  var M = _feadSideModel(node);
  if(satirlar && satirlar.length) out.html += _feadSideRO(baslik, kaynak, satirlar);
  out.html += _feadSideGates(M.build, M.T);
  if(ekBlok) out.html += ekBlok;
  return out;
}

// Panel kabuğu TEK ÜRETİCİDEN: sekmeler + sağ sütun. Dört panel bunu elle
// kursaydı biri `ve-fp-side`ı sekme gövdesinin İÇİNE koyup (ölçüldü: aynı DOM
// nesnesi kalıyor, kapı fark etmiyordu) tasarımın bütün katkısını sessizce
// yok edebilirdi.
//
// SEKME DURUMLARI DA BURADA BAĞLANIR: pencere kurucusu durum yazmaz, kabuk
// düğümün tipinden sorar (`veFeadSekmeDurumlari`). Kurucu zaten hesapladıysa
// (kasnak: sürücünün iki sekmesinin GÖVDESİ de duruma bağlı) dördüncü
// argümanla verir — ikinci kez hesaplanmasın.
function veFeadPanelShell(node, sekmeler, yan, durumlar){
  var D = (durumlar !== undefined) ? durumlar : veFeadSekmeDurumlari(node);
  if(D) sekmeler.forEach(function(s){ if(!s.durum && D[s.k]) s.durum = D[s.k]; });
  var aktif = veFeadPanelTabOf(node.id, sekmeler.map(function(s){ return s.k; }));
  return '<div class="sw-panel ve-fp">'
    + '<div class="ve-fp-split"><div class="ve-fp-main">'
    + veFeadTabsHTML(node.id, sekmeler, aktif)
    + '</div><div class="ve-fp-side">' + yan.html + '</div></div></div>';
}

function getFeadPulleyPropertiesHTML(node){
  if(!node.data) node.data = {};
  veFeadMigrateNode(node);                       // eski kayıt: dia → od
  var def = _feadDefOf(node);
  var isIdler = !!def.isFeadIdler;
  var isDriver = !!(node.data.driver);

  // ── GEOMETRİ SEKMESİ ────────────────────────────────────────────────────
  // TEMAS TARAFI sessiz hataya karşı en kritik alan: ters verilirse çekirdek
  // BAŞKA BİR GEÇERLİ güzergâh hesaplar; kapalı çevrim ve sarım değişmezi yine
  // tutar, yani ne kod ne de göz yakalar. Bu yüzden ilk sekmede, kendi
  // kartında ve DANGER tonuyla duruyor.
  var geo = _feadCard('Temas Tarafı', 'hesap için kritik', 'var(--accent-danger)',
      _feadSelect(node, 'Kayış bu kasnağa', 'contact',
        [['grooved', 'Kaburgalı yüzden değiyor'], ['back', 'Sırtından değiyor']],
        veFeadContactOf(node),
        'Yerleşim çiziminden okunur, hesaplanamaz. <b>Ters verilirse</b> program geçerli '
        + 'ama BAŞKA bir kayış yolu çözer; hata mesajı almazsınız. Sağdaki çizim o hatayı '
        + 'görünür kılar. Aksesuarlar tipik olarak kaburgalı yüzden, avara ve gergi '
        + 'sırttan temas eder.'));

  geo += _feadCard('Kasnak Geometrisi', '[mm]', 'var(--accent-primary)',
      _feadGrid(node, [
        { key:'od', label:'Dış çap (OD)', ph:String(VE_FEAD_DEFAULT_DIA[node.type] || 100) },
        { key:'x',  label:'Konum X',      ph:'0' },
        { key:'y',  label:'Konum Y',      ph:'0' }
      ], 3)
    + _feadHint('<b>Dış çap</b> girilir; pitch ve efektif yarıçapları çekirdek kayış profilinden '
        + 'türetir (kaburgalı: r<sub>pitch</sub>=OD/2+h<sub>b</sub>, r<sub>eff</sub>=OD/2). '
        + 'Konum, kayış düzleminde (Gates rapor düzlemi) kasnak merkezidir. '
        + 'Aynı üç alan <b>Kayış Tablosu</b>ndan da girilebilir.'));

  // ── ROL SEKMESİ ─────────────────────────────────────────────────────────
  var rol = _feadCard('Rol', '', 'var(--accent-success)',
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
    rol += _feadCard('Katalog Modeli', 'devir → kW eğrisi', 'var(--accent-warning)',
        _feadSelect(node, 'Model', 'accPreset', secenekler, '__manual__',
          'Araç Performans modülünün kataloglarıyla AYNI kaynak. Seçilince çalışma çevrimi '
          + 'tablosundaki boş kW hücreleri bu eğriden doldurulur; aksesuar devri kasnak '
          + '<b>pitch çaplarından</b> gelir, elle oran girilmez.'));
  }

  var sekmeler = [{ k:'geo', ad:'Geometri', govde: geo },
                  { k:'rol', ad:'Rol',      govde: rol }];
  // AVARA kayıştan güç çekmez: devir sınırı da güç eğrisi de onun için
  // sorulmuyordu, sekme de açılmıyor (kural 25 — sorulan her alanın bir
  // tüketicisi olmak zorunda, tersi de geçerli).
  // SÜRÜCÜDE AYNI KURAL, SEKME KALIR: iki kapı da sürücüyü atlar ve
  // sürücünün gücü öteki kasnakların toplamıdır — yani bu iki sekmeye
  // yazılan hiçbir sayı bir sonuca ulaşmaz. Sekme "kullanılmaz" diye durur ve
  // ALAN SORMAZ, sebebini yazar; avaradan farkı, sürücülüğün bir ROL olması
  // (kural 8): işaret başka kasnağa geçince sekmeler geri gelir.
  var durumlar = veFeadSekmeDurumlari(node);
  if(!isIdler){
    var olu = !!(durumlar && durumlar.dev && durumlar.dev.d === 'yok');
    sekmeler.push({ k:'dev', ad:'Devir Sınırları',
                    govde: olu ? _feadSurucuNotu('dev') : veFeadAccLimitCard(node) });
    sekmeler.push({ k:'egr', ad:'Güç Eğrisi',
                    govde: olu ? _feadSurucuNotu('egr') : veFeadPowerCurveCard(node) });
  }

  return veFeadPanelShell(node, sekmeler, veFeadPulleySide(node), durumlar);
}

function _feadSurucuNotu(k){
  return _feadCard(k === 'dev' ? 'Devir Sınırları' : 'Güç Eğrisi', 'sürücüde kullanılmaz',
      'var(--text-muted)',
      '<div class="ve-fp-olu">'
      + '<b>Sürücü kasnakta bu sekme hiçbir hesaba girmiyor.</b> '
      + (k === 'dev'
          ? 'Devir kapılarının ikisi de sürücüyü atlar: sürücünün devri motor devrinin '
            + 'kendisidir, sınır aksesuarlar için denetlenir.'
          : 'Sürücünün gücü girilmez — öteki kasnakların çektiği gücün toplamından çıkar; '
            + 'çalışma çevrimi tablosunda sürücü sütunu bu yüzden yok.')
      + ' Sürücü işareti başka bir kasnağa geçerse bu sekme o kasnakta açılır.'
      + '</div>');
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
    h += '<div class="ve-fp-grid" style="--fp-k:1;">'
      + '<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">BMC künyesi</span>'
      + '<select onchange="veFeadApplyAccLib(\'' + node.id + '\',this.value)"'
      + ' class="ve-fp-sel">'
      + '<option value="">— elle gir —</option>';
    liste.forEach(function(r){
      h += '<option value="' + _feadEsc(r.key) + '"' + (r.key === sec ? ' selected' : '') + '>'
         + _feadEsc(r.label) + '</option>';
    });
    h += '</select></label></div>';
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
      ? '<b>' + _feadEsc(lim.ad) + '</b> seçili; <b style="color:var(--ink-warning);">'
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

  // Çalışma çevrimi tablosuyla AYNI tablo sınıfları (yapışkan başlık,
  // satır vurgusu) — satır içi stil `:hover`ı ifade edemiyordu (kural 14).
  var h = '<div class="ve-fp-duty"><table class="ve-pnl-tbl ve-pnl-tbl--framed ve-pnl-tbl--tiny ve-fp-duty-tbl">'
     + '<thead><tr>'
     + ['Aksesuar devri', 'Güç [kW]', 'Motor devri'].map(function(t){ return '<th>' + t + '</th>'; }).join('')
     + '<th aria-label="Sil"></th></tr></thead><tbody>';

  if(!raw.length){
    h += '<tr><td colspan="4" class="ve-fp-duty-bos">'
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
      return '<td class="tight">'
        + '<input type="number" value="' + _feadEsc(val == null ? '' : val) + '" step="' + step + '"'
        + ' onchange="veFeadCurveSet(\'' + node.id + '\',' + pi + ',\'' + key + '\',this.value)"'
        + ' class="ve-fp-inp ve-fp-inp--tight"></td>';
    };
    h += '<tr>' + hucre('rpm', p && p.rpm, '10') + hucre('kw', p && p.kw, '0.01')
      + '<td class="ve-fp-duty-oku">' + (Number.isFinite(motor) ? _feadFmt(motor, 0) : '—') + '</td>'
      + '<td class="tight"><button type="button" class="ve-fp-duty-sil"'
      + ' onclick="veFeadCurveRemove(\'' + node.id + '\',' + pi + ')" title="Satırı sil" aria-label="Satırı sil">×</button></td></tr>';
  });
  h += '</tbody></table></div>';

  h += '<div class="ve-fp-eylem">'
    + '<button type="button" class="ve-fp-dugme" onclick="veFeadCurveAdd(\'' + node.id + '\')">+ Devir noktası</button>'
    + '</div>';
  // Bugün sütuna SIĞIYOR (üç sütun) — birim yine işaretli: sığmadığı bir
  // kapta (dar ekran, uzun başlık) karar ölçümle verilir, listeyle değil.
  h = '<div class="ve-tablo" data-ve-tablo="fead-curve:' + _feadEsc(node.id) + '"'
    + ' data-ve-tablo-baslik="Güç Eğrisi" data-ve-tablo-ozet="' + raw.length + ' devir noktası">' + h + '</div>';

  var not = '';
  if(raw.length && pts.length < raw.length)
    not += _feadHint('<b style="color:var(--ink-warning);">' + (raw.length - pts.length)
      + ' satır eksik/geçersiz</b> — yalnız devir ve güç değeri dolu satırlar eğriye girer.');
  if(pts.length === 1)
    not += _feadHint('<b style="color:var(--ink-warning);">Tek nokta</b> — eğri sabit güç '
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
  var html = '';
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
  var _geo = html; html = '';
  html += _feadCard('Kol Künyesi', 'parça + montaj verisi', 'var(--text-secondary)',
      _feadGrid(node, [
        { key:'armLen', label:'Kol boyu (Arm Length) [mm]', ph:'90' }
      ], 2)
    + '<div class="ve-fp-grid" style="--fp-k:1;">'
      + '<label class="ve-fp-f"><span class="ve-fp-l">'
      + 'Kol yönü (merkezden pivota, işaretli) <u>[°]</u></span>'
      + '<input class="ve-fp-inp" type="text" inputmode="decimal" value="'
      + _feadEsc(Number.isFinite(_armGos) ? Math.round(_armGos * 10000) / 10000 : '')
      + '" placeholder="164"'
      + ' onchange="veFeadSetArmShown(\'' + node.id + '\', this.value)"></label></div>'
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
  var _kol = html; html = '';

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

  var _yay = html;

  // ÜÇ SEKME, ÜÇ SORU: kasnak nerede duruyor · kol hangi parça · yay ne
  // veriyor. Gergi paneli 15 alan + 8 bölümle FEAD'in EN UZUN penceresiydi;
  // tek sürgüde kol yönü ile yay katsayısı arasında 600 px vardı ve ikisi
  // aynı hesabın iki ucu.
  var sekmeler = [{ k:'geo', ad:'Yerleşim',  govde: _geo },
                  { k:'kol', ad:'Kol',       govde: _kol },
                  { k:'yay', ad:'Yay',       govde: _yay }];

  // GERGİ DE KAYIŞ YOLUNDA BİR KASNAK: sağ sütunu kasnağınkiyle AYNI. İkinci
  // bir "gergi sütunu" yazmak, sarım açısını iki ayrı yerden okumak olurdu.
  return veFeadPanelShell(node, sekmeler, veFeadPulleySide(node));
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
  // ORTAK ALAN SATIRI (`.ve-fp-f--sel`), kendi flex'i DEĞİL: `flex:1` etiketi
  // bütün boşluğu yiyip seçiciyi sağ uca fırlatıyordu ve etiket üç satıra
  // sarıyordu — P1'in son iki kopyasından biri buydu.
  var h = '<div class="ve-fp-grid" style="--fp-k:1;">'
    + '<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">Ölçülmüş künye</span>'
    + '<select onchange="veFeadApplyTenLib(\'' + node.id + '\',this.value)"'
    + ' class="ve-fp-sel">';
  opts.forEach(function(o){
    h += '<option value="' + _feadEsc(o[0]) + '"' + (o[0] === sec ? ' selected' : '') + '>'
       + _feadEsc(o[1]) + '</option>';
  });
  h += '</select></label></div>';

  // SEÇİLİ KÜNYEDEN SAPMA — bant denetiminden ÖNCE, çünkü daha keskin bir
  // soruya cevap veriyor: bant "on dört raporun aralığında mı", sapma ise
  // "hâlâ SEÇTİĞİN parça mı". Kol boyunu 90'dan 85'e çekmek bandı geçer ama
  // parçayı değiştirir; ekran o ana kadar yine de künyenin adını yazıyordu.
  var sap = (typeof veFeadTensionerDrift === 'function') ? veFeadTensionerDrift(td) : null;
  if(sap && sap.drift.length)
    h += _feadHint('<b style="color:var(--ink-warning);">Künyeden sapıldı:</b> '
      + _feadEsc(sap.drift.join('; ')) + '. Bu alanlar <b>parçanın</b> verisidir — '
      + 'değiştirdiyseniz elinizdeki gergi artık seçili künye değildir. '
      + 'Kasıtlıysa listeden <i>— elle gir —</i> seçin; künye adı yanıltmasın.');
  if(sap && sap.montaj.length)
    h += _feadHint('<b>Montaja göre ayarlandı:</b> ' + _feadEsc(sap.montaj.join('; '))
      + '. Çalışma momenti <b>montajın</b> verisidir, parçanın değil — aynı gergi '
      + 'kanal sayısına göre farklı momentle kurulur. Bu bir sapma DEĞİL.');

  var b = veFeadTensionerBandCheck(td);
  if(b.outside.length)
    h += _feadHint('<b style="color:var(--ink-warning);">Ölçülen bandın dışında:</b> '
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
  if(typeof veFeadRefreshCards === 'function') veFeadRefreshCards();
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
  return '<div class="ve-fp-grid" style="--fp-k:1;">'
    + _feadRO('↳ gövdenin montaj konumu (türedi)',
        _feadFmt(p[0], 2) + ' / ' + _feadFmt(p[1], 2), '[mm]')
    + '</div>';
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
      + '<span style=" color:' + (renk || 'var(--text-primary)') + ';">'
      + deg + '</span></div>';
  };
  var h = '<div style="font-size:var(--fs-micro); line-height:1.5; padding:7px 9px; margin-bottom:9px; '
        + 'background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
  h += satir('Yay kurulması (Mean−Pre)/Rate', _feadFmt(m.relMeanDeg, 2) + '°');
  // AYNI PANELDE İKİ AYRI SAYI DURUYORDU ve ikisi de "kol açısı" diye
  // okunuyordu: yukarıdaki kutu 168,00 (merkez→gövde, GİRDİ), buradaki satır
  // −12,00 (gövde→merkez, mutlak). Kullanıcı bildirimi (2026-09-22): *"açı
  // tanımları çok başka olmuş, kafa karıştırıyor."*
  //
  // ÇARE İKİ SAYIDAN BİRİNİ SİLMEK DEĞİL — ikisi de gerekli: girdi
  // kullanıcının yazdığı, mutlak ise PARÇA ÇİZİMİNİN dili (E9843'ün çizimi
  // "344° MEAN ANGLE" yazıyor). Çare ikisine de AYRI AD vermek, ve "(girdi)"
  // diyen satırın gerçekten GİRİLEN sayıyı göstermesi.
  h += satir('Kol yönü — girdi (merkez→gövde)',
             _feadFmt(veFeadArmShownDeg(th), 2) + '°');
  h += satir('θ_kol — mutlak (gövde→merkez)', _feadFmt(th, 2) + '°');
  var p = veFeadTensionerPivot(td);
  if(p) h += satir('↳ gövdenin montaj konumu (türedi)',
    _feadFmt(p[0], 2) + ' / ' + _feadFmt(p[1], 2), 'var(--ink-warning)');

  if(!b || !b.ok){
    h += satir('Kayış yolu', '— çözülemedi', 'var(--ink-danger)');
    h += '</div>';
    var sebep = (b && b.errors && b.errors.length) ? b.errors[0] : '';
    return h + (sebep
      ? _feadHint('<b style="color:var(--ink-danger);">' + _feadEsc(sebep) + '</b>')
      : _feadHint('Kayış yolu bu yerleşimle çözülemiyor.'));
  }

  h += satir('Serbest kol açısı (türedi)', _feadFmt(b.freeAngleDeg, 2) + '°');
  h += satir('Gereken KAYIŞ BOYU (çıktı)', _feadFmt(b.beltLengthMm, 1) + ' mm', 'var(--ink-warning)');
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
      bant.userOk ? 'var(--ink-success)' : 'var(--ink-danger)');
  }
  h += '</div>';

  if(bant && bant.ok){
    if(!bant.userOk && bant.userWhy)
      h += _feadHint('<b style="color:var(--ink-danger);">Bu açı kullanılamaz:</b> '
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
    h += _feadHint('<b style="color:var(--ink-warning);">' + _feadEsc(bant.note) + '</b>');
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
    not += _feadHint('<b style="color:var(--ink-warning);">' + _feadEsc(b.warnings[0]) + '</b>');
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
  var html = '';
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
  var _pro = html; html = '';
  html += _feadCard('Kayış Boyu', serbest ? 'tasarımdan HESAPLANIR' : 'katalogdan SEÇİLİR',
      serbest ? 'var(--accent-warning)' : 'var(--accent-primary)',
      (kilit
        ? '<div class="ve-fp-grid" style="--fp-k:1;">'
          + _feadRO('Boy kipi', 'SERBEST (kilitli)', '', 'warning') + '</div>'
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
  var _boy = html; html = '';
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
  var _mal = html;

  var sekmeler = [{ k:'pro', ad:'Profil',   govde: _pro },
                  { k:'boy', ad:'Boy',      govde: _boy },
                  { k:'mal', ad:'Malzeme',  govde: _mal }];

  // SAĞ SÜTUN kayışın kendi sorusuna cevap veriyor: hangi profil, kaç kanal,
  // hangi boy — ve o boy KATALOGDAN mı GEOMETRİDEN mi geldi. Kip alt satırda
  // bir açılır liste; sekme değişince kayboluyordu ve kullanıcı serbest kipte
  // olduğunu unutup katalog boyu arıyordu.
  var _bs = veFeadBeltSideRows(node);
  return veFeadPanelShell(node, sekmeler,
    veFeadToolSide(node, 'Kayış Künyesi', 'seçimden', _bs.satirlar));
}

// Kayış sağ sütununun satırları — DEĞERİ OLAN alan tek kaynaktan okunur
// (`veFeadBeltMode`, `veFeadBeltSpec`), panel ikinci bir profil tablosu
// TUTMAZ. Çözülemeyen alan '—' kalır; sıfır yazmak olmayan bir kayış iddia
// etmek olurdu (kural 10).
function veFeadBeltSideRows(node){
  var d = node.data || {};
  var kip = (typeof veFeadBeltMode === 'function') ? veFeadBeltMode(d) : 'fixed';
  var serbest = (kip === 'free');
  var prof = d.profile || '—';
  var kanal = Number.isFinite(_feadNum(d.ribs, NaN)) ? String(_feadNum(d.ribs, NaN)) : '—';

  // Boy İKİ SAYIDIR ve karıştırılmaları sessizdir: `LpitchMm` kayışın PITCH
  // çevresi (katalog boyu bu), `LeffMm` efektif boy. Kayış Tablosu ikisini de
  // basıyor, sağ sütun da ikisini ayrı satırda yazar — tek "kayış boyu" satırı
  // hangisini gösterdiğini söylemezdi.
  var Lp = '—', Le = '—';
  try {
    var B = (typeof veFeadBuildFromCanvas === 'function') ? veFeadBuildFromCanvas() : null;
    var T = (B && typeof veFeadTableRows === 'function') ? veFeadTableRows(B) : null;
    if(T && Number.isFinite(T.LpitchMm)) Lp = _feadFmt(T.LpitchMm, 1) + ' mm';
    if(T && Number.isFinite(T.LeffMm))   Le = _feadFmt(T.LeffMm, 1) + ' mm';
  } catch(e){ Lp = '—'; Le = '—'; }
  // Çözüm yokken kullanıcının GİRDİĞİ katalog boyu yine gösterilir — pencere
  // kendi girdisini boş göstermemeli (Kayış Tablosu'nun aynı kuralı).
  if(Lp === '—' && Number.isFinite(_feadNum(d.lengthMm, NaN)))
    Lp = _feadFmt(_feadNum(d.lengthMm, NaN), 1) + ' mm';

  return {
    satirlar: [
      ['Profil', prof],
      ['Kanal sayısı', kanal],
      ['Pitch boyu', Lp],
      ['Efektif boy', Le],
      ['Boy kaynağı', serbest ? 'tasarımdan hesaplanır' : 'katalogdan seçilir']
    ]
  };
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
    + 'Gereken boy <b style="color:var(--ink-warning);">' + _feadFmt(o.targetMm, 2)
    + ' mm</b> — aşağıdaki boylardan birini seçerseniz gergi kolu ve gerginlik '
    + 'şu değerlere oturur.</div>';
  h += '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;'
    + ' font-size:var(--fs-micro);">'
    + '<thead><tr>' + sut('Boy', '20%') + sut('Δ', '16%') + sut('Kod', '26%', 'left')
    + sut('Kol dönmesi', '16%') + sut('Gerginlik', '22%') + '</tr></thead><tbody>';

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
    if(sig){ kol = '<span style="color:var(--ink-danger);">sığmıyor</span>'; }
    return '<tr style="cursor:pointer;' + vur + (sig ? ' opacity:0.65;' : '') + '"'
      + ' onclick="veFeadPickBelt(\'' + node.id + '\',' + c.lengthMm + ')"'
      + ' title="Bu boyu seç (kip SABİT olur)">'
      + '<td style="padding:3px 5px; text-align:right; font-weight:700;">' + _feadFmt(c.lengthMm, 0) + '</td>'
      + '<td style="padding:3px 5px; text-align:right; color:var(--text-muted);">'
      + (c.deltaMm >= 0 ? '+' : '−') + _feadFmt(Math.abs(c.deltaMm), 1) + '</td>'
      + '<td style="padding:3px 5px; text-align:left;">' + _feadEsc(c.code)
      + (izgara ? ' <span style="color:var(--ink-warning);">◇</span>' : '') + '</td>'
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
  if(typeof veFeadRefreshCards === 'function') veFeadRefreshCards();
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
  // ŞÜPHELİ DEĞER '?' İLE DE İŞARETLİ, yalnız renkle değil: renk körlüğünde
  // ve gri basımda tek ayırt edici o.
  return '<div class="ve-fp-grid" style="--fp-k:1;">'
    + _feadRO('Gereken efektif boy', deger + (supheli ? ' ?' : ''), '',
              supheli ? 'danger' : 'warning')
    + '</div>' + _feadHint(not);
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
    return '<span style="color:var(--ink-danger);">' + _feadEsc(veFeadTranslateError(e && e.message)) + '</span>';
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
    // Açıklık çırpması: her açıklık KENDİ frekansıyla, KENDİ modunun şeklinde,
    // kendi normali boyunca. Şekil v=0 yaklaşımıdır (yükün başındaki 2. sınır).
    //
    // MOD SAYISI ŞEKLİ DEĞİŞTİRİR: sin(n·π·x/L). n=1 bir yay, n=2 ortasında
    // düğümü olan bir S, n=3 iki düğümlü. Model başka bir modu baskın
    // gösterirken koşulsuz yay çizmek yanlış resim olurdu.
    var sp = vib.spans || [];
    return {
      disp: function(segIdx, tt, seg){
        var i = _feadSegSpan(segIdx);
        if(i < 0 || !sp[i] || !(seg.l > 0)) return null;
        var s = sp[i], n = (s.mode > 0) ? s.mode : 1;
        var w = s.ampMm * Math.sin(n * Math.PI * tt / seg.l)
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
// YÜZEN DENETİM ÇUBUĞUNUN KAPLADIĞI ALT PAY.
//
// Çubuk çizimin ÜSTÜNDE duruyor (bant değil), yani çizimin ölçeğini
// düşürmüyor — ama alt kenarın bir kısmını ÖRTÜYOR. Ölçüldü (gerçek tarayıcı,
// 440×500 kart): varsayılan yerindeki yön gülü çubuğun tam altına düşüyordu ve
// TAMAMEN görünmez oluyordu. Gül bir süs değil: "montaj açısı −3,18°" gibi bir
// sayının hangi yöne baktığı yalnız ondan okunuyor.
//
// Çözüm çizimi küçültmek DEĞİL, yalnız gülü yukarı almak: ölçek aynı kalıyor,
// örtülen alan da çizimin kendi boşluğu oluyor.
// Değer = çubuğun alt boşluğu (6) + çubuk yüksekliği (40). CSS'te karşılığı
// `--fead-kat-alt` (styles.css) — orası panelin, burası gülün hizası.
var VE_FEAD_YUZ_ALT = 46;

// KART ÇİZİMİNİN YAZI KATSAYISI — arayüz ölçeğinden türer (`--fs-micro` / 9).
// Çizici etiketleri kullanıcı biriminde yazıyor (ad 9, açı 8, künye 7–8,5) ve
// kanvas kartında 1 birim = 1 px idi: ölçek 2026-09-25'te bir basamak büyüdü
// (9 → 10 px) ama kartın yazısı kıpırdamadı — ölçüldü, 40 etiketin hepsi 7–9 px.
// Kart çizimi bu yüzden kartın 1/k ölçüsünde ÜRETİLİR ve viewBox onu kartın
// tamamına büyütür. Etiket yerleştirme ve çakışma kaçınması kullanıcı
// biriminde çalıştığı için hiçbir ofset değişmez (`fead-card-design.test.js`
// süpürmesi aynı kuralı ölçüyor); fare → mm dönüşümü getScreenCTM'den (ölçeği
// kapsar), gülün yeri kesirle saklanıyor. Bedeli: çizgi kalınlıkları da k kadar.
function veFeadYaziK(){
  var fs = (typeof veThemeFs === 'function') ? veThemeFs('micro') : 9;
  return (Number.isFinite(fs) && fs > 9) ? fs / 9 : 1;
}

function veFeadCompassPlace(W, H, pos, altPay){
  var m = VE_FEAD_ROSE_HALF + 2;
  var alt = Number(altPay) || 0;
  var fx = pos ? Number(pos.fx) : NaN, fy = pos ? Number(pos.fy) : NaN;
  if(!Number.isFinite(fx) || !Number.isFinite(fy))
    return { cx: W - VE_FEAD_ROSE_W/2 - 4,
             // Alt pay kartın yarısından çoksa (aşırı daraltma) gülü yukarı
             // itmek onu çizimin dışına çıkarırdı; o hâlde eski yerinde kalır.
             cy: H - VE_FEAD_ROSE_W/2 - 8 - ((alt < H/2) ? alt : 0), moved: false };
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
//  ÇİZİM MASASI — KASNAK ÇİZİMDE SEÇİLİR VE TAŞINIR
// ════════════════════════════════════════════════════════════════════════════
// Kullanıcı kararı (2026-09-23, tasarım tezgâhı II): kanvas kartının çizimi
// giriş yüzeyi olur. Kasnağa tıklamak penceresini açar, sürüklemek konumunu
// yazar (gergide AVARA MERKEZİ `cenX/cenY` — montaj konumu ondan türer ve
// onunla birlikte kayar); kesin sayı pencerede ve tabloda.
//
//  • ÇİZİM KENDİ GEOMETRİSİNİ HESAPLAMAZ: sürükleme yalnız GİRDİYİ yazar
//    (farenin mm cinsinden yer değiştirmesi, 0,1 mm'ye yuvarlı). Kayış yolu,
//    sarım ve boy çekirdekten gelir.
//  • ÖLÇEK SÜRÜKLEME BOYUNCA DONAR. Çizim her kurulumda kasnaklara
//    sığdırılıyor; donmasa kasnak kenara yaklaştıkça çizim imlecin altında
//    küçülür ve kasnak imleçten kaçardı. Bırakınca kart yeniden sığdırılır.
//  • KAYIŞI KOPARAN HAMLE YAZILMAZ: geçerli bir modelden geçersizine giden
//    hamlede kasnak son geçerli yerinde durur, kart sebebini yazar. Model
//    başta zaten geçersizse hamle serbest — onaran kullanıcı kilitlenmesin.
//  • Sürükleme boyunca saveState ÇAĞRILMAZ, bırakınca bir kez: tek hamle =
//    tek geri-al adımı.
var VE_FEAD_SURUKLE = null;     // { kart, kasnak, xf:{kartId:xf}, red } — görünüm durumu
var VE_FEAD_UZERINDE = null;    // fare altındaki kasnağın kimliği — görünüm durumu

// Kayış yolunun SAĞLIĞI TEK YERDEN: kart rozeti ile sürükleme kapısı aynı
// hükmü versin. Çekirdek hoşgörülü çözüyor (ihlaller sayı olarak taşınır),
// yani "çizildi" demek "doğru" demek değil.
function veFeadYolDurumu(build, mode){
  var d = { ok: !!(build && build.ok), sol: 'Kayış yolu kapanmadı', sag: '', neden: '' };
  // `neden` KISA ve KESİN: sürükleme reddinde kart onu yazar (rozetin `sol`u
  // künyeyle birlikte uzun cümle).
  if(!d.ok){
    d.neden = (build && build.errors && build.errors[0]) || (build && build.geomError)
      || 'kayış yolu kurulamıyor';
    return d;
  }
  try {
    // HANGİ KONUM ÇİZİLİYORSA onun sayıları; Mean'in sayılarını gösterip başka
    // bir konumu çizmek sessiz bir yanlış okuma olurdu.
    var sel = veFeadPosSelection(build, mode || 'mean');
    var relS = (sel.primary && Number.isFinite(sel.primary.relDeg))
      ? sel.primary.relDeg : FEADCore.meanRel(build.sys);
    var g = FEADCore.tensionerState(build.sys, relS).geom, sg = 0, bk = 0;
    g.wraps.forEach(function(w, i){
      if(build.sys.pulleys[i].contact === 'back') bk += w; else sg += w;
    });
    var inv = (sg - bk) * 180 / Math.PI;
    d.sol = build.order.length + ' kasnak · L ' + _feadFmt(g.LeffMm, 1) + ' mm';
    // ÇEVRİM İKİ YÖNE DE GEZİLEBİLİR: aynalanmış düzende işaretli sarım −360°
    // çıkar ve çekirdek onu da kabul ediyor (|Σ| − 360). Yön künyede yazılır.
    d.sag = 'Σsarım ' + _feadFmt(inv, 1) + '°' + (inv < 0 ? ' (ters yön)' : '');
    if(Math.abs(Math.abs(inv) - 360) > 0.05){
      d.ok = false; d.sol = 'Kayış yolu KAPANMIYOR · ' + d.sol;
      d.neden = 'kayış yolu kapanmıyor (Σsarım ' + _feadFmt(inv, 1) + '°)';
    } else if((g.violations || []).length){
      d.ok = false; d.sol = 'Kayış kasnağın İÇİNDEN geçiyor · ' + d.sol;
      d.neden = 'kayış bir kasnağın içinden geçiyor';
    }
  } catch(e){
    d.ok = false; d.sol = 'Geometri okunamadı';
    d.neden = (typeof veFeadTranslateError === 'function')
      ? veFeadTranslateError(e && e.message) : 'geometri çözülemedi';
  }
  return d;
}

function _feadKartSvg(kartId){
  if(typeof document === 'undefined') return null;
  var el = document.getElementById(kartId);
  return el ? el.querySelector('.ve-fead-kanvas svg[data-fead-xf]') : null;
}
// Çizimin mm → görünüm katsayıları: çizici kökte `data-fead-xf` olarak basar
// (`s ox oy mx my`, `_feadXform`un aynısı) — ikinci bir ölçek hesabı yok.
function _feadCizimXf(svg){
  var a = svg && svg.getAttribute && svg.getAttribute('data-fead-xf');
  if(!a) return null;
  var p = String(a).split(' ').map(Number);
  if(p.length !== 5 || !p.every(Number.isFinite) || !(p[0] > 0)) return null;
  return { s: p[0], ox: p[1], oy: p[2], mx: p[3], my: p[4] };
}
function _feadCizimMm(xf, pt){ return [xf.mx + (pt.x - xf.ox) / xf.s, xf.my - (pt.y - xf.oy) / xf.s]; }
// Kasnağın KONUM GİRDİSİ: tablonun satırıyla aynı anahtar (gergide cenX/cenY).
function _feadKasnakKoord(node){
  var ten = !!_feadDefOf(node).isFeadTensioner, d = (node && node.data) || {};
  var kx = ten ? 'cenX' : 'x', ky = ten ? 'cenY' : 'y';
  return { kx: kx, ky: ky, x: _feadNum(d[kx], NaN), y: _feadNum(d[ky], NaN) };
}
function _feadMm01(v){ return Math.round(v * 10) / 10; }
function _feadNodeById(id){
  if(typeof nodes === 'undefined' || !id) return null;
  for(var i = 0; i < nodes.length; i++) if(nodes[i].id === id) return nodes[i];
  return null;
}

// Seçim ve fare altı işareti SINIFLA eşitlenir, kart yeniden KURULMAZ: fare
// her kasnakta çizimi baştan kurmak imlecin altındaki öğeyi değiştirirdi.
function veFeadCizimIsaretle(){
  if(typeof document === 'undefined') return 0;
  var sec = _feadSelectedId(), uz = VE_FEAD_UZERINDE;
  var el = document.querySelectorAll('[data-fead-k]');
  for(var i = 0; i < el.length; i++){
    var k = el[i].getAttribute('data-fead-k');
    el[i].classList.toggle('is-sel', !!sec && k === sec);
    el[i].classList.toggle('is-hov', !!uz && k === uz);
  }
  var satir = document.querySelectorAll('.ve-fead-krt[data-ve-node]');
  for(var j = 0; j < satir.length; j++)
    satir[j].classList.toggle('is-hov', !!uz && satir[j].getAttribute('data-ve-node') === uz);
  return el.length;
}

function veFeadCizimUzerinde(id){
  if(VE_FEAD_SURUKLE) return false;
  id = id || null;
  if(VE_FEAD_UZERINDE === id) return false;
  VE_FEAD_UZERINDE = id;
  veFeadCizimIsaretle();
  return true;
}

// Kasnağın çemberine basıldı. Hareketsiz bırakılırsa TIK (pencere açılır),
// 3 px'ten fazla kayarsa SÜRÜKLEME. mousedown DURDURULUR: kart bir kanvas
// düğümünün içinde, durdurulmasa kasnağı tutmak kartı taşırdı (gülün kuralı).
function veFeadCizimBas(evt, kartId, kasnakId){
  if(!evt || (evt.button != null && evt.button !== 0) || typeof document === 'undefined') return false;
  if(evt.stopPropagation) evt.stopPropagation();
  if(evt.preventDefault) evt.preventDefault();
  var node = _feadNodeById(kasnakId);
  if(!node) return false;
  if(typeof clearSelection === 'function') clearSelection();
  if(typeof addToSelection === 'function') addToSelection(node);
  var svg = _feadKartSvg(kartId), xf = _feadCizimXf(svg), k0 = _feadKasnakKoord(node);
  var p0 = svg ? _feadSvgPoint(svg, evt) : null;
  var suruklenir = !!(xf && p0 && Number.isFinite(k0.x) && Number.isFinite(k0.y));
  var m0 = suruklenir ? _feadCizimMm(xf, p0) : null;
  var xfler = {};
  var bastaGecerli = false;
  if(suruklenir){
    nodes.forEach(function(n){
      if(!_feadDefOf(n).isFeadLayout) return;
      var x = _feadCizimXf(_feadKartSvg(n.id));
      if(x) xfler[n.id] = x;
    });
    bastaGecerli = veFeadYolDurumu(veFeadBuildFromCanvas(), 'mean').ok;
  }
  var tasindi = false, hedef = null, kare = 0, yazildi = false;

  function uygula(){
    kare = 0;
    if(!hedef) return;
    var eskiX = node.data[k0.kx], eskiY = node.data[k0.ky];
    node.data[k0.kx] = hedef.x; node.data[k0.ky] = hedef.y;
    var red = '';
    if(bastaGecerli){
      var yd = veFeadYolDurumu(veFeadBuildFromCanvas(), 'mean');
      if(!yd.ok){
        node.data[k0.kx] = eskiX; node.data[k0.ky] = eskiY;
        red = yd.neden || 'kayış yolu kurulamıyor';
      }
    }
    if(!red && (node.data[k0.kx] !== k0.x || node.data[k0.ky] !== k0.y)) yazildi = true;
    if(VE_FEAD_SURUKLE) VE_FEAD_SURUKLE.red = red;
    hedef = null;
    veFeadRefreshCards();
  }
  function tasi(e){
    if(!suruklenir) return;
    var p = _feadSvgPoint(_feadKartSvg(kartId) || svg, e);
    if(!p) return;
    if(!tasindi){
      if(Math.abs(p.x - p0.x) < 3 && Math.abs(p.y - p0.y) < 3) return;
      tasindi = true;
      VE_FEAD_SURUKLE = { kart: kartId, kasnak: kasnakId, xf: xfler, red: '' };
      if(document.body) document.body.classList.add('ve-fead-surukleniyor');
    }
    var m = _feadCizimMm(xf, p);
    hedef = { x: _feadMm01(k0.x + (m[0] - m0[0])), y: _feadMm01(k0.y + (m[1] - m0[1])) };
    if(kare) return;
    if(typeof requestAnimationFrame === 'function') kare = requestAnimationFrame(uygula);
    else uygula();
  }
  function birak(){
    document.removeEventListener('mousemove', tasi, true);
    document.removeEventListener('mouseup', birak, true);
    if(kare && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(kare);
    if(hedef) uygula();
    VE_FEAD_SURUKLE = null;
    VE_FEAD_UZERINDE = kasnakId;
    if(document.body) document.body.classList.remove('ve-fead-surukleniyor');
    if(!tasindi){
      if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(true);
      veFeadCizimIsaretle();
      return;
    }
    if(yazildi && typeof saveState === 'function') saveState();
    veFeadTableAfterEdit();
  }
  document.addEventListener('mousemove', tasi, true);
  document.addEventListener('mouseup', birak, true);
  return true;
}

// Klavyeyle kaydır: ok 1 mm, Shift+ok 10 mm. Aynı kapıdan geçer (kayışı
// koparan adım yazılmaz) ve her basış bir geri-al adımıdır.
//
// ADIM TAM, IZGARA YOK: sürükleme 0,1 mm'lik ızgaraya oturuyor (imlecin yeri
// zaten keyfi) ama ok tuşu BİLİNEN bir değere bilinen bir adım ekliyor —
// ızgaraya yuvarlamak girilmiş hassasiyeti sessizce silerdi (ölçüldü: gergi
// avara merkezi −161,97 → bir basış → −163,0; olması gereken −162,97).
// Yalnız kayan nokta artığı temizlenir (131,10000000000002 yazılmasın).
function _feadMmTam(v){ return Math.round(v * 1e6) / 1e6; }
function veFeadKasnakKaydir(id, dx, dy){
  var node = _feadNodeById(id);
  if(!node || !_feadDefOf(node).isFeadPulley) return false;
  var k = _feadKasnakKoord(node);
  if(!Number.isFinite(k.x) || !Number.isFinite(k.y)) return false;
  var bastaGecerli = veFeadYolDurumu(veFeadBuildFromCanvas(), 'mean').ok;
  node.data[k.kx] = _feadMmTam(k.x + dx);
  node.data[k.ky] = _feadMmTam(k.y + dy);
  if(bastaGecerli){
    var yd = veFeadYolDurumu(veFeadBuildFromCanvas(), 'mean');
    if(!yd.ok){
      node.data[k.kx] = k.x; node.data[k.ky] = k.y;
      if(typeof showToast === 'function')
        showToast('Buraya taşınamaz — ' + (yd.neden || 'kayış yolu kurulamıyor'), 'warning');
      return false;
    }
  }
  if(typeof saveState === 'function') saveState();
  veFeadTableAfterEdit();
  return true;
}

// Kökteki klavye dinleyicisinin kancası (ui-core.js). Kutusuz bir kasnak
// seçiliyken oklar onu kaydırır, Delete kayış sırasını kapatarak siler —
// genel `deleteSelectedNodes` sırayı kapatmıyor ve gergi kuralını bilmiyor.
function veFeadCizimTus(e){
  if(!e || e.ctrlKey || e.metaKey || e.altKey) return false;
  var node = _feadNodeById(_feadSelectedId());
  if(!node || !_feadDefOf(node).isFeadPulley) return false;
  var y = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  if(y){
    if(e.preventDefault) e.preventDefault();
    var adim = e.shiftKey ? 10 : 1;
    veFeadKasnakKaydir(node.id, y[0] * adim, y[1] * adim);
    return true;
  }
  if(e.key === 'Delete' || e.key === 'Backspace'){
    if(e.preventDefault) e.preventDefault();
    if(typeof veFeadTableDelete === 'function') veFeadTableDelete(node.id);
    return true;
  }
  return false;
}

// Boş / çizilemeyen çizimin eylem düğmesi (ilk basılan BİRİNCİL — CSS).
function _feadBosDugme(eylem, ad){
  return '<button type="button" onmousedown="event.stopPropagation();" onclick="' + eylem + '">'
    + ad + '</button>';
}

// ── KAYIŞIN ÜSTÜNE BIRAKARAK EKLE ──────────────────────────────────────────
// Paletten sürüklenen kasnak çizimde bir AÇIKLIĞIN üstüne bırakılınca o iki
// kasnağın ARASINA girer: tablo sırasında soldaki komşunun hemen ardına,
// konumu bırakılan nokta. "Hangi iki kasnağın arasında" sorusu çizimden
// okunuyor — tabloda ▲▼ ile aranmıyor. (Tablonun ekleyicisi kasnağı
// konumsuz, gerginin önüne ekliyordu; kullanıcı sırayı ve koordinatı sonra
// ayrı ayrı bulmak zorundaydı.)
//
//  • GERGİ İLE SÜRÜCÜ ARASINDAKİ AÇIKLIK KAPALI: tablo sürücüyle başlar ve
//    gergiyle biter (modül kuralı); oraya giren kasnak ya sürücünün önüne ya
//    gerginin ardına düşerdi. Sürükleme sırasında o açıklık KIRMIZI yanar.
//  • AVARANIN DEĞDİĞİ YÜZ BIRAKILAN TARAFTAN OKUNUR: halkanın İÇİNE bırakılan
//    avara kaburgalı yüze (grooved), DIŞINA bırakılan sırta (back) değer.
//    Aksesuar tipin varsayılanında kalır. İç/dış halkanın YÖNÜNDEN (teğet
//    noktalarının işaretli alanı) — ağırlık merkezinden değil: serpantin
//    düzende sırttan avaranın yanındaki açıklık için merkez yanlış taraftadır.
//  • ÇAP YAZILMAZ: model eksik çapı tipe göre varsayar ve UYARI verir
//    (veFeadOD) — uydurulmuş bir çap sessizce kalıcı olmasın.
//  • KAYIŞI KOPARAN EKLEME YAZILMAZ: aday model KOPYADA çözülür; reddedilirse
//    hiçbir şey değişmez ve geri-al yığınına boş bir adım girmez.
//  • Çizimin dışına bırakılan kasnak tablonun ekleyicisine gider ve tablo
//    açılır — satırı ve boş koordinatı görünsün (eskiden bu yol SESSİZDİ:
//    kutusuz düğüm kuruluyor, ekranda hiçbir şey değişmiyordu).
var VE_FEAD_BIRAK_PX = 18;      // açıklığa en fazla bu kadar (kart px) uzağa bırakılır
var VE_FEAD_BIRAK = null;       // { kart, svg, xf, build, g } — sürükleme boyu önbellek

// Olayın hedefinden Kayış Yolu kartının kimliği (çizimin İÇİ ise).
function _feadCizimKartId(el){
  if(!el || !el.closest) return null;
  var kab = el.closest('.ve-fead-kanvas');
  var kart = kab && kab.closest('.ve-node');
  var n = kart ? _feadNodeById(kart.id) : null;
  return (n && _feadDefOf(n).isFeadLayout && kab.querySelector('svg[data-fead-xf]')) ? n.id : null;
}

// Noktanın doğru parçasına uzaklığı (mm) — açıklık seçimi.
function _feadParcaMesafe(p, a, b){
  var vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx*vx + vy*vy;
  var t = L2 > 0 ? ((p[0] - a[0])*vx + (p[1] - a[1])*vy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  var dx = p[0] - (a[0] + t*vx), dy = p[1] - (a[1] + t*vy);
  return Math.sqrt(dx*dx + dy*dy);
}

// SAF: mm cinsinden bir noktanın hangi AÇIKLIĞA en yakın olduğu, ne kadar
// uzak olduğu ve halkanın İÇİNDE mi DIŞINDA mı kaldığı. `g` çekirdeğin
// geometrisi (spans[i]: build.order[i] → build.order[i+1]).
// İç/dış halkanın YÖNÜNDEN okunur (teğet noktalarının işaretli alanı):
// saat yönünün tersine dolanan halkada iç, her açıklığın SOLUNDADIR.
function veFeadAciklikSec(build, g, m){
  if(!build || !build.order || !g || !g.spans || !g.spans.length || !m) return null;
  var A = 0, pts = [], k;
  g.spans.forEach(function(sp){ pts.push(sp.Pi, sp.Pj); });
  for(k = 0; k < pts.length; k++){
    var u = pts[k], v = pts[(k + 1) % pts.length];
    A += u[0]*v[1] - v[0]*u[1];
  }
  var en = null;
  g.spans.forEach(function(sp, i){
    var d = _feadParcaMesafe(m, sp.Pi, sp.Pj);
    if(!en || d < en.d) en = { i: i, d: d, sp: sp };
  });
  var N = build.order.length, sp = en.sp;
  var cr = (sp.Pj[0] - sp.Pi[0]) * (m[1] - sp.Pi[1]) - (sp.Pj[1] - sp.Pi[1]) * (m[0] - sp.Pi[0]);
  return { i: en.i, sol: build.order[en.i], sag: build.order[(en.i + 1) % N],
           mm: m, dMm: en.d, kapali: en.i === N - 1,
           ic: (cr >= 0) === (A >= 0), Pi: sp.Pi, Pj: sp.Pj };
}

// Bırakma noktasının hangi AÇIKLIKTA olduğu (ekran → çizimin mm'si).
// Döner null (çizim çözülmüyor) ya da veFeadAciklikSec'in sonucu + kart,
// ölçek ve ekran uzaklığı. Model sürükleme boyunca değişmediği için kurulum
// ve geometri önbellekten okunur.
function veFeadAciklikBul(kartId, clientX, clientY){
  if(typeof FEADCore === 'undefined') return null;
  var c = VE_FEAD_BIRAK;
  if(!c || c.kart !== kartId){
    var svg = _feadKartSvg(kartId), xf = _feadCizimXf(svg);
    if(!svg || !xf) return null;
    var build = veFeadBuildFromCanvas();
    if(!veFeadYolDurumu(build, 'mean').ok) return null;
    var g;
    try {
      // KARTIN ÇİZDİĞİ KONUM: açıklık çizildiği yerde aranır.
      var sel = veFeadPosSelection(build, veFeadPosMode(_feadNodeById(kartId)));
      var rel = (sel.primary && Number.isFinite(sel.primary.relDeg))
        ? sel.primary.relDeg : FEADCore.meanRel(build.sys);
      g = FEADCore.tensionerState(build.sys, rel).geom;
    } catch(e){ return null; }
    if(!g || !g.spans || !g.spans.length) return null;
    c = VE_FEAD_BIRAK = { kart: kartId, svg: svg, xf: xf, build: build, g: g };
  }
  var p = _feadSvgPoint(c.svg, { clientX: clientX, clientY: clientY });
  if(!p) return null;
  var a = veFeadAciklikSec(c.build, c.g, _feadCizimMm(c.xf, p));
  if(!a) return null;
  a.kart = kartId; a.xf = c.xf; a.svg = c.svg; a.dPx = a.dMm * c.xf.s;
  return a;
}

// Açıklığa girecek kasnağın verisi — yazılmadan önce KOPYADA denetlenir.
// Döner { ok, data?, neden? }.
function veFeadAradanAday(type, a){
  var def = (typeof componentDefs !== 'undefined' && componentDefs[type]) || null;
  if(!def || !def.isFeadPulley) return { ok: false, neden: 'kasnak tipi değil' };
  if(def.isFeadTensioner) return { ok: false, neden: 'otomatik gergi açıklığa eklenmez' };
  if(!a || !a.sol) return { ok: false, neden: 'kayış yolu çizilmiyor' };
  if(a.kapali)
    return { ok: false, neden: 'gergi ile sürücü arasına kasnak girmez — tablo sürücüyle '
      + 'başlar, gergiyle biter' };
  var bi = Number(a.sol.data && a.sol.data.beltIndex);
  var data = {
    x: _feadMm01(a.mm[0]), y: _feadMm01(a.mm[1]),
    contact: def.isFeadIdler ? (a.ic ? 'grooved' : 'back') : (def.feadContact || 'grooved'),
    beltIndex: (Number.isFinite(bi) ? bi : 0) + 0.5
  };
  // KOPYADA ÇÖZ: canlı düğümler yazılmaz (normalize bile sıra numarasını oynatırdı).
  var kopya = nodes.map(function(n){
    return { id: n.id, type: n.type, customName: n.customName,
             data: JSON.parse(JSON.stringify(n.data || {})) };
  });
  kopya.push({ id: '__aday', type: type, data: JSON.parse(JSON.stringify(data)) });
  var yd = veFeadYolDurumu(veFeadBuildSystem(kopya), 'mean');
  if(!yd.ok) return { ok: false, neden: yd.neden || 'kayış yolu kurulamıyor' };
  return { ok: true, data: data };
}

// Açıklığa ekle — TEK geri-al adımı. Döner yeni düğüm ya da null.
function veFeadAradanEkle(type, a){
  var aday = veFeadAradanAday(type, a);
  if(!aday.ok){
    if(typeof showToast === 'function') showToast('Buraya eklenemez — ' + aday.neden, 'warning');
    return null;
  }
  var yeni = null;
  var kur = function(){
    yeni = createNode(type, 3000, 3000);
    if(yeni){ if(!yeni.data) yeni.data = {}; Object.assign(yeni.data, aday.data); }
  };
  if(typeof veStateBatch === 'function') veStateBatch(kur); else kur();
  if(!yeni) return null;
  VE_FEAD_BIRAK = null;
  veFeadTableAfterEdit();
  _feadScrollRowIntoView(yeni.id);
  if(typeof showToast === 'function')
    showToast(_feadNodeName(yeni) + ' eklendi — ' + _feadNodeName(a.sol) + ' ile '
      + _feadNodeName(a.sag) + ' arasına', 'success');
  return yeni;
}

// Sürüklerken İZ: hedef açıklık vurgulanır, kasnağın varsayılan çapında bir
// hayalet imleci izler. Kapalı açıklık kırmızı; uzaktaysa yalnız hayalet.
function _feadBirakIzTemizle(){
  if(typeof document === 'undefined') return;
  var el = document.querySelectorAll('[data-ve="birak-iz"]');
  for(var i = 0; i < el.length; i++) el[i].parentNode.removeChild(el[i]);
}
function _feadBirakIzCiz(a, type){
  _feadBirakIzTemizle();
  if(!a || !a.svg) return false;
  var xf = a.xf, s = xf.s;
  var tx = function(x){ return xf.ox + (x - xf.mx) * s; };
  var ty = function(y){ return xf.oy + (xf.my - y) * s; };
  var f = function(v){ return (Math.round(v * 10) / 10).toString(); };
  var yakin = a.dPx <= VE_FEAD_BIRAK_PX;
  var r = ((typeof VE_FEAD_DEFAULT_DIA !== 'undefined' && VE_FEAD_DEFAULT_DIA[type]) || 80) / 2 * s;
  var h = '';
  if(yakin)
    h += '<line class="' + (a.kapali ? 'kapali' : 'hedef') + '" x1="' + f(tx(a.Pi[0])) + '" y1="'
      + f(ty(a.Pi[1])) + '" x2="' + f(tx(a.Pj[0])) + '" y2="' + f(ty(a.Pj[1])) + '"/>';
  h += '<circle class="' + (yakin ? (a.kapali ? 'kapali' : 'hedef') : 'uzak') + '" cx="'
    + f(tx(a.mm[0])) + '" cy="' + f(ty(a.mm[1])) + '" r="' + f(Math.max(r, 4)) + '"/>';
  if(yakin)
    h += '<text x="' + f(tx(a.mm[0])) + '" y="' + f(ty(a.mm[1]) - Math.max(r, 4) - 5)
      + '" text-anchor="middle" font-size="9">' + _feadEsc(a.kapali
        ? 'Gergi ile sürücü arası — eklenemez'
        : _feadNodeName(a.sol) + ' ↔ ' + _feadNodeName(a.sag)) + '</text>';
  var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('data-ve', 'birak-iz');
  g.setAttribute('pointer-events', 'none');
  g.innerHTML = h;
  a.svg.appendChild(g);
  return true;
}

// Kanvas kabının dragover kancası (ui-core.js). Döner: iz çizildi mi.
function veFeadPaletUstunde(e, type){
  var def = (type && typeof componentDefs !== 'undefined') ? componentDefs[type] : null;
  var kartId = (def && def.isFeadPulley && !def.isFeadTensioner) ? _feadCizimKartId(e && e.target) : null;
  if(!kartId){ _feadBirakIzTemizle(); return false; }
  return _feadBirakIzCiz(veFeadAciklikBul(kartId, e.clientX, e.clientY), type);
}

// Sürükleme bitti (bırakıldı ya da vazgeçildi): iz ve önbellek temizlenir.
function veFeadPaletBitti(){
  _feadBirakIzTemizle();
  VE_FEAD_BIRAK = null;
}

// Kanvas kabının drop kancası (ui-core.js). Döner true: olay FEAD'in —
// kanvasa ayrıca düğüm kurulmaz.
function veFeadPaletBirak(e, type){
  var def = (type && typeof componentDefs !== 'undefined') ? componentDefs[type] : null;
  if(!def || !def.isFeadPulley) return false;
  var kartId = def.isFeadTensioner ? null : _feadCizimKartId(e && e.target);
  var a = kartId ? veFeadAciklikBul(kartId, e.clientX, e.clientY) : null;
  veFeadPaletBitti();
  if(!a){
    // Çizimin dışı (ya da kayış yolu henüz çizilmiyor): tablonun yolu.
    if(veFeadTableAdd(type)) veFeadTabloAc();
    return true;
  }
  if(a.dPx > VE_FEAD_BIRAK_PX){
    if(typeof showToast === 'function')
      showToast('Kasnağı kayışın ÜSTÜNE bırakın — hangi iki kasnağın arasına '
        + 'gireceği oradan anlaşılır.', 'info');
    return true;
  }
  veFeadAradanEkle(type, a);
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
// ── KOL OKU — TEK ÜRETİCİ ──────────────────────────────────────────────────
//
// Kullanıcı bildirimi (2026-09-04): *"'özet ve kurulum' kısmındaki diyagramda
// belirlediğimiz nokta görünmüyor."* ÖLÇÜLDÜ: nokta ÇİZİLİYORDU, ama iki yüzey
// aynı seçimi iki ayrı dille anlatıyordu —
//   seçici : 3 px düz çizgi + dolu üçgen uç, yanında açı sayısı
//   şema   : 1,6 px KESİKLİ çizgi, %85 saydam, OK UCU YOK, 6 px'lik artı
// 56 öğelik bir şemada ikincisi tanınmıyor. Bu deponun kuralı: aynı şeyi
// gösteren iki yüzey aynı üreticiden geçer (bkz. `veFeadBeltPathD`).
//
// YÖN: ok ucu PİVOTTA. Kullanıcı açıyı "merkezden pivota" seçiyor (nispi
// gösterim), dolayısıyla okun gösterdiği şey SEÇİMİN KENDİSİ. Ters çizmek
// kolun fiziksel yönünü (pivot→merkez) gösterirdi ve seçiciyle çelişirdi.
//
// C ve P EKRAN koordinatıdır: bu üretici mm→px çevirisi YAPMAZ, çağıran
// yüzey kendi ölçeğini uygular (sunum katmanı kendi geometrisini hesaplamaz).
function veFeadArmArrowSVG(C, P, opt){
  opt = opt || {};
  var f = opt.f || function(v){ return Math.round(v * 100) / 100; };
  if(!C || !P) return '';
  var dx = P[0] - C[0], dy = P[1] - C[1];
  var L = Math.sqrt(dx * dx + dy * dy);
  // SIFIR UZUNLUK OK ÇİZDİRMEZ: normalleştirme NaN üretir ve SVG'ye NaN yazmak
  // öğeyi sessizce yok eder — çizim "başarılı" görünür, ekranda hiçbir şey olmaz.
  if(!(L > 0.5)) return '';
  var ux = dx / L, uy = dy / L;
  var kal = opt.kalinlik || 3;
  var uc  = opt.ucBoy  || 11;
  var gen = opt.ucGen  || 4.6;
  // OK UCU GÖVDEDEN UZUN OLAMAZ: kısa kolda (yakınlaştırılmış şema) uç
  // gövdeyi aşar ve ok ters dönmüş gibi görünürdü.
  if(uc > L * 0.6){ uc = L * 0.6; gen = uc * 0.42; }
  var renk = opt.renk || 'var(--accent-success)';
  var G = [P[0] - uc * ux, P[1] - uc * uy];
  return '<line data-ve="arm" x1="' + f(C[0]) + '" y1="' + f(C[1]) + '" x2="' + f(G[0])
      + '" y2="' + f(G[1]) + '" stroke="' + renk + '" stroke-width="' + kal
      + '" stroke-linecap="round"/>'
    + '<path data-ve="arm-head" d="M' + f(P[0]) + ' ' + f(P[1])
      + ' L' + f(G[0] - gen * uy) + ' ' + f(G[1] + gen * ux)
      + ' L' + f(G[0] + gen * uy) + ' ' + f(G[1] - gen * ux) + ' Z" fill="' + renk + '"/>';
}

// ── KISA AD — YALNIZ ÇİZİMDE ───────────────────────────────────────────────
// "Alternatör (155 A)" 18 karakter; ad merkezde ortalandığı için etiket payı
// ölçeği kısıtlıyor (iki geçişli `etiketPayi`). Parantezli ek (akım, parça no)
// kartın KÜNYE TABLOSUNDA tam hâliyle duruyor — bilgi kaybolmuyor, yer
// değiştiriyor. Ad tamamen parantezliyse ("(E9843)") dokunulmaz: boş bir
// etiket hiçbir şey söylemez.
function veFeadShortName(ad){
  var t = String(ad == null ? '' : ad);
  var k = t.replace(/\s*\([^()]*\)\s*$/, '').trim();
  return k || t;
}

// ── GERİLME → RENK ─────────────────────────────────────────────────────────
// Üç duraklı rampa: soğuk (gevşek) → amber → sıcak (gergin). ORTA DURAK
// KAYIŞIN KENDİ AMBERİ, yani harita kapalıyken görülen renk rampanın
// ortasında duruyor; açıp kapamak bir renk sıçraması gibi okunmuyor.
// Sabit rgb: rampa bir ÖLÇEK, tema değişkeni değil — açık temada da aynı
// sıralamayı vermek zorunda.
var VE_FEAD_TENSION_RAMP = [[74,144,164],[210,153,34],[224,80,32]];
function veFeadTensionColor(t, min, max){
  var u = (Number.isFinite(t) && max > min) ? (t - min) / (max - min) : 0.5;
  u = Math.min(1, Math.max(0, u));
  var i = (u < 0.5) ? 0 : 1, k = (u < 0.5) ? u*2 : (u - 0.5)*2;
  var A = VE_FEAD_TENSION_RAMP[i], B = VE_FEAD_TENSION_RAMP[i+1];
  return 'rgb(' + Math.round(A[0] + (B[0]-A[0])*k) + ','
                + Math.round(A[1] + (B[1]-A[1])*k) + ','
                + Math.round(A[2] + (B[2]-A[2])*k) + ')';
}

// Tek bir AÇIKLIĞIN yolu — gerilme haritası onu kayışın üstüne kendi rengiyle
// çiziyor. Deformasyon verilirse `_feadWalkPath` ile AYNI örnekleme kullanılır
// (VE_FEAD_VIB_SPAN_PTS); ayrı bir örnekleme, titreşen kayışın üstünde renkli
// parçanın kayması demekti — dişlerle kayış arasındaki kuralın aynısı.
function _feadSpanPathD(walk, spanIdx, T, def){
  var i = spanIdx * 2, sg = walk && walk.segs && walk.segs[i];
  if(!sg || sg.a !== 0) return '';
  var d0 = def && def.disp(i, 0, sg);
  var out = 'M' + _feadR(T.tx(sg.x + (d0 ? d0[0] : 0))) + ' '
                + _feadR(T.ty(sg.y + (d0 ? d0[1] : 0)));
  var K = def ? VE_FEAD_VIB_SPAN_PTS : 1;
  for(var k = 1; k <= K; k++){
    var t = sg.l * k / K, dd = def && def.disp(i, t, sg);
    out += 'L' + _feadR(T.tx(sg.x + sg.ux*t + (dd ? dd[0] : 0))) + ' '
               + _feadR(T.ty(sg.y + sg.uy*t + (dd ? dd[1] : 0)));
  }
  return out;
}

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
  // ÇİZİM AYNALANMAZ. Kasnak konumları Gates raporunun Layout Data
  // koordinatlarının kendisidir ve ekranda da öyle durur (bkz. fead-model.js →
  // "ÇİZİM DÜZLEMİ YOKTUR — TEK ÇERÇEVE VAR"). Burada bir dönem bir ayna
  // bayrağı vardı; üç turda üç kez yanlış resim üretti ve kaldırıldı.
  function geomAt(rel){
    try {
      return FEADCore.tensionerState(build.sys, rel).geom;
    }
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
  // VURGULANAN KASNAK — pencerenin kendi kasnağı (`highlightId`). İndis
  // `build.order`dan: çizimin k'inci kasnağı modelin k'inci düğümü.
  var hk = -1;
  if(opts.highlightId && build.order)
    build.order.forEach(function(n, k){ if(n && n.id === opts.highlightId) hk = k; });
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
  // ALT PAY YALNIZ CANLI KARTTA: rapor ve dışa aktarma aynı çiziciyi kullanıyor
  // ve orada yüzen çubuk YOK — pay verilseydi belgede gül sebepsiz yukarı kayardı.
  var roseYer = wantCompass
    ? veFeadCompassPlace(W, H, opts.compassPos, opts.altPay) : null;
  // Aynı pay ETİKETLERE de söylenir (aşağıda): çubuğun altına düşen yazı
  // görünmüyordu. Gülün kuralıyla aynı sınır — pay kartın yarısını aşarsa yok.
  var ALT = (Number(opts.altPay) > 0 && Number(opts.altPay) < H/2) ? Number(opts.altPay) : 0;
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
  // ADLAR KAPATILABİLİR. Kapalıyken `gorAd` boş döner ve bu TEK yerden üç iş
  // birden hallolur: kenar payı hesabı ad için yer ayırmaz, yerleştirici
  // ada kutu açmaz (o alan sarım/gerilme etiketlerine kalır) ve metin hiç
  // basılmaz. Üçünü ayrı ayrı kapatmak, birinin unutulduğu hâlde "ad yok ama
  // yeri duruyor" gibi sessiz bir sonuç verirdi.
  var adVar = (opts.nameLabels !== false);
  function gorAd(k){
    if(!adVar) return '';
    var a = opts.names && opts.names[k];
    var ad = (a == null || a === '') ? geom.names[k] : String(a);
    return opts.shortNames ? veFeadShortName(ad) : ad;
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
  // SÜRÜKLEME SÜRERKEN ÖLÇEK DONAR (bkz. ÇİZİM MASASI): kasnak kenara
  // yaklaştıkça yeniden sığdırmak çizimi imlecin altında küçültürdü.
  var _xs = opts.xfSabit;
  if(_xs && _xs.s > 0){ s = _xs.s; offX = _xs.ox; offY = _xs.oy; minX = _xs.mx; maxY = _xs.my; }
  // ── AÇIKLIK GERİLMESİ ETİKETLERİ — konum ad yerleştiricisinden ÖNCE ─────
  // Üç ölçülmüş kusur birden kapanıyor (kullanıcı bildirimi: "kayış
  // gerginlikleri iyi görülmüyor"):
  //   • Sayı SABİT bir normalle kaydırılıyordu; normal yarı yarıya çizimin
  //     İÇİNE bakıyor ve etiket kalabalığın üstüne düşüyordu. Artık yön
  //     kümenin ağırlık merkezinden DIŞA seçiliyor.
  //   • Çerçeveye kenetleme yoktu: sağdaki açıklıkta sayı kartın dışına taşıp
  //     KIRPILIYORDU.
  //   • Konumlar burada üretildiği için ad yerleştiricisi onları engel olarak
  //     görebiliyor; eskiden ad ile sayı birbirini bilmiyordu.
  var _spanEt = [];
  if(opts.tension && opts.tension.spanN && opts.spanLabels !== false){
    var TE = _feadXform(s, offX, offY, minX, maxY);
    var cx0 = 0, cy0 = 0;
    ps.forEach(function(p){ cx0 += TE.tx(p.c[0]); cy0 += TE.ty(p.c[1]); });
    cx0 /= Math.max(1, ps.length); cy0 /= Math.max(1, ps.length);
    (geom.spans || []).forEach(function(sp, i){
      var TN = opts.tension.spanN[i];
      if(!Number.isFinite(TN)) return;
      var ax = TE.tx(sp.Pi[0]), ay = TE.ty(sp.Pi[1]);
      var bx = TE.tx(sp.Pj[0]), by = TE.ty(sp.Pj[1]);
      var mx = (ax+bx)/2, my = (ay+by)/2;
      var vx = bx-ax, vy = by-ay, vl = Math.sqrt(vx*vx + vy*vy) || 1;
      var nx = vy/vl, ny = -vx/vl;
      if((mx-cx0)*nx + (my-cy0)*ny < 0){ nx = -nx; ny = -ny; }     // DIŞA
      var yazi = Math.round(TN) + ' N', w = etW(yazi, 9);
      var X = Math.min(Math.max(mx + nx*13, 2 + w/2), W - ROSE - 2 - w/2);
      var Y = Math.min(Math.max(my + ny*13 + 3, 11), H - 4);
      _spanEt.push({ i:i, yazi:yazi, x:X, y:Y, x0:X-w/2, x1:X+w/2, y0:Y-8, y1:Y+2 });
    });
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
  var _aciEt = [];
  (function(){
    var T0 = _feadXform(s, offX, offY, minX, maxY);
    var segler = [];
    (geom.spans || []).forEach(function(sp){
      segler.push([T0.tx(sp.Pi[0]), T0.ty(sp.Pi[1]), T0.tx(sp.Pj[0]), T0.ty(sp.Pj[1])]);
    });
    // KASNAK DİSKLERİ DE ENGEL — yalnız `nameSmart` çiziminde: ad komşu
    // kasnağın çemberine ya da İÇİNE düşmesin (eski küçük resimde bir sarım
    // açısı sürücü kasnağın içindeydi — ölçüldü). Kendi kasnağı sorun değil:
    // adaylar çemberin en az 2 px dışında kuruluyor.
    var diskler = [];
    if(opts.nameSmart)
      ps.forEach(function(p){
        diskler.push({ x: T0.tx(p.c[0]), y: T0.ty(p.c[1]), r: p.rPitch * s + 1 });
      });
    function diskeDeger(d, a){
      var nx = Math.min(Math.max(d.x, a.x0), a.x1), ny = Math.min(Math.max(d.y, a.y0), a.y1);
      return (nx - d.x) * (nx - d.x) + (ny - d.y) * (ny - d.y) < d.r * d.r;
    }
    // SARIM YAYI DA KAYIŞTIR — yalnız `nameSmart` çiziminde. Engel listesi
    // yalnız DÜZ açıklıkları tutuyordu; kayışın kasnağın üstünden dolandığı
    // yerde "üst" aday temiz sayılıyor ve ad yayın üstüne yazılıyordu
    // (ölçüldü: pencerenin küçük resminde "Avara" kayışın üstünde). Yay iki
    // halkayla örneklenir: çemberin kendisi ve kayışın DIŞ kenarı. Dış kenar
    // TEMAS TARAFINA bağlı: sırttan temas eden kasnakta dişler dışa bakar
    // (+4,5 px), kaburgalıda içe (+1,5 px — yalnız çizginin yarı kalınlığı).
    // Hepsine 4 px yazmak, kaburgalı kasnağın boş üstünü de "dolu" sayıp adı
    // kayışın geçtiği alta itiyordu (ölçüldü: "Alternatör").
    // Kanvas kartına ve rapora dokunmaz — onların yerleşimi ayrıca kapılı
    // (fead-card-design.test.js). Yürüyüşün sırası: 2i açıklık, 2i+1 ise
    // (i+1)'inci kasnağın yayı (`_feadBeltWalk`).
    if(opts.nameSmart)
      _feadBeltWalk(geom).segs.forEach(function(sg, si){
        if(sg.a !== 1 || !(sg.r > 0)) return;
        var pk = ps[(((si - 1) / 2) + 1) % ps.length];
        var dis = (pk && pk.contact === 'back') ? 4.5 : 1.5;
        var yay = sg.l / sg.r, N = Math.max(4, Math.ceil(yay / 0.3));
        [0, dis / s].forEach(function(dr){
          var once = null;
          for(var t = 0; t <= N; t++){
            var th = sg.a0 + sg.d * yay * t / N;
            var nk = [T0.tx(sg.cx + (sg.r + dr) * Math.cos(th)), T0.ty(sg.cy + (sg.r + dr) * Math.sin(th))];
            if(once) segler.push([once[0], once[1], nk[0], nk[1]]);
            once = nk;
          }
        });
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
    // SOL ÜST KÜNYE VE ALT NOT DA ENGELDİR — gülle BİREBİR aynı gerekçe:
    // ikisi de çizimin İÇİNDE, sabit yerde duruyor, ama engel listesinde
    // yoktu; yerleştirici tam oraya bakıyordu. ÖLÇÜLDÜ (11 örnek × 7 kol
    // konumu, gerçek tarayıcı): ad künyeye 14 karede, alt nota 14 karede
    // biniyor — en kötüsü künyenin %60'ını örtüyor.
    //
    // SERT tierde, çünkü ikisi de YAPISAL bilgi: künye "hangi kol konumunu
    // görüyorum" sorusunun tek cevabı, alt not da dişli kenarın hangi yüzü
    // gösterdiğinin. Bir SAYIYI örtmek geri alınabilir bir zarar (yumuşak
    // tier), bunları örtmek çizimi okunamaz kılar.
    //
    // Metin ÇİZİLDİĞİ yerden türer (aşağıda `data-ve="pos-label"` ve
    // `data-ve="rib-legend"`), ikinci bir dize yazılmaz: künye biçimi
    // değişirse engel de onunla değişsin.
    if(sel.primary){
      var _kMetin = sel.primary.label + '  ·  kol ' + _feadR(sel.primary.relDeg) + '°'
        + (Number.isFinite(sel.primary.tensionN)
            ? '  ·  ' + Math.round(sel.primary.tensionN) + ' N' : '');
      kutular.push({ x0: pad - 6, x1: pad - 6 + etW(_kMetin, 8.5), y0: 12 - 8, y1: 12 + 2 });
    }
    var _lMetin = 'dişli kenar = kayışın kaburgalı yüzü';
    kutular.push({ x0: pad - 6, x1: pad - 6 + etW(_lMetin, 7), y0: H - ALT - 5 - 7, y1: H - ALT - 5 + 2 });
    // YÜZEN ÇUBUĞUN ALANI DA SERT ENGEL (yalnız kanvas kartı — `altPay`).
    // Çubuğun altına düşen yazı görünmüyordu: ölçüldü (12 örnek × 2 kart),
    // krank kasnağının ADI 6 kartta, sarım açısı 2 kartta; alt not HER kartta,
    // gerilme ölçeği her İŞLETME kartında çubuğun altındaydı — ikisi artık bandın üstünde
    // çiziliyor ve burada engel.
    if(ALT){
      kutular.push({ x0: 0, x1: W, y0: H - ALT, y1: H });
      var _tm = opts.tension;
      if(_tm && _tm.spanN && _tm.spanN.length === (geom.spans || []).length){
        var _gMetin = 'açıklık gerilmesi · ' + Math.round(_tm.engineRpm) + ' dev/dk';
        kutular.push({ x0: pad - 6, x1: pad - 6 + Math.max(84, etW(_gMetin, 7)),
                       y0: H - ALT - 38 - 7, y1: H - ALT - 22 + 2 });
      }
    }
    // SARIM AÇISI ETİKETİ DE BİR ENGEL. Yerleştirici bugüne kadar yalnız kayış
    // açıklıklarına ve güle bakıyordu; oysa her kasnağın ALTINDA (Y + R + 10)
    // bir açı yazısı duruyor ve üst aday doluyken ad tam oraya atılıyordu —
    // iki yazı üst üste, ikisi de okunmaz. Kullanıcı bildirimi (AG00976,
    // "Avara 1" ile 52.83°). Kutu kuralı çizen satırla AYNI yerden türer.
    //
    // AMA YUMUŞAK BİR ENGEL. Gül, açıklıklar ve öteki ADLAR sert: birini
    // örtmek yapısal bilgiyi yok eder (gülün yön etiketleri, kayışın kendisi,
    // hangi adın hangi kasnağa ait olduğu). Bir SAYIYA binmek ise daha küçük
    // bir zarar. Bu yüzden iki geçiş: önce hepsinden kaçılır, hiçbir aday temiz
    // değilse yalnız sert engellere bakılır. Tek listeye konsaydı dar kartta
    // ad, açıdan kaçarken gülün üstüne düşerdi (ölçüldü: taşınmış gül kapısı
    // kırmızıya döndü).
    var yumusak = [];
    var aciVar = (opts.wrapLabels !== false);
    // AÇININ KENDİ ADAY LİSTESİ VAR (2026-09-14) — ama VARSAYILAN yeri hâlâ
    // adın yumuşak engeli. İkisi birlikte çalışıyor: ad önce kaçmayı dener
    // (açı yerinde kalsın, çizim kare kare oynamasın), kaçamazsa açı taşınır.
    // Yalnız biri olsaydı: engel olmadan ad koşulsuz açının üstüne düşerdi,
    // aday listesi olmadan da ad kaçamadığı her karede iki yazı üst üste kalırdı.
    var aciAday = [];
    if(aciVar)
      ps.forEach(function(p, k){
        var X = offX + (p.c[0]-minX)*s, Yc = offY + (maxY-p.c[1])*s, R = p.rPitch*s;
        var w = etW(_feadR(geom.wrapDeg(k)) + '°', 8);
        // SIRA ADINKİNİN TERSİ: ad üstü, açı altı tercih eder. Aynı sırayla
        // arasalardı ikisi de aynı yere koşar, yer değiştirme hiçbir şey
        // çözmezdi — kaçınma ancak tercihler ayrıştığında iş görür.
        aciAday.push([
          { x:X,       y:Yc+R+10, an:'middle', x0:X-w/2,   x1:X+w/2,   y0:Yc+R+2,  y1:Yc+R+12 },
          { x:X,       y:Yc-R-4,  an:'middle', x0:X-w/2,   x1:X+w/2,   y0:Yc-R-12, y1:Yc-R-2 },
          { x:X+R+5,   y:Yc+3,    an:'start',  x0:X+R+5,   x1:X+R+5+w, y0:Yc-5,    y1:Yc+5 },
          { x:X-R-5,   y:Yc+3,    an:'end',    x0:X-R-5-w, x1:X-R-5,   y0:Yc-5,    y1:Yc+5 }
        ]);
        yumusak.push(aciAday[k][0]);          // adın gördüğü yumuşak engel: VARSAYILAN yer
      });
    // Gerilme sayıları da aynı tierde: ad ile sayı birbirini bilmiyordu.
    _spanEt.forEach(function(e){ yumusak.push(e); });

    // ORTAK YERLEŞTİRİCİ. Ad ve açı aynı kuralı koşuyor; ayrıştıkları tek şey
    // aday sırası ve hangi listeye yazıldıkları. İki kopya tutmak, birinde
    // düzeltilen bir sınır denetiminin ötekinde eksik kalması demekti.
    function icerde(a){
      return !(a.x0 < 1 || a.x1 > W-ROSE-1 || a.y0 < 1 || a.y1 > H-1);
    }
    // Örtüşme ALANI — geri düşüşün ölçütü. Boole "çakıştı mı" yetmiyordu:
    // hiçbir aday temiz değilken ilkine dönmek, 3 px payla sıyıran bir adayı
    // yazıyı tamamen örten bir adayla EŞİT sayıyordu.
    function ortAlan(a, b){
      var w = Math.min(a.x1,b.x1) - Math.max(a.x0,b.x0);
      var h = Math.min(a.y1,b.y1) - Math.max(a.y0,b.y0);
      return (w > 0 && h > 0) ? w*h : 0;
    }
    function yerlestir(aday, yumusakList, akilliGeri){
      function dene(yumusagiDaKolla){
        for(var i=0;i<aday.length;i++){
          var a = aday[i];
          if(!icerde(a)) continue;
          var carpti = false;
          for(var j=0;j<segler.length && !carpti;j++) if(kesisir(segler[j], a)) carpti = true;
          for(var m=0;m<kutular.length && !carpti;m++) if(ortusur(kutular[m], a)) carpti = true;
          for(var dk=0;dk<diskler.length && !carpti;dk++) if(diskeDeger(diskler[dk], a)) carpti = true;
          if(yumusagiDaKolla)
            for(var y=0;y<yumusakList.length && !carpti;y++) if(ortusur(yumusakList[y], a)) carpti = true;
          if(!carpti) return a;
        }
        return null;
      }
      var sec = dene(true) || dene(false);
      if(sec) return sec;
      // HİÇBİRİ TEMİZ DEĞİL. Etiket yine de ÇİZİLİR (kaybolmaz) — soru yalnız
      // NEREYE. `akilliGeri` açıkken en az örtüşen aday seçilir; kapalıyken
      // ilk aday, yani eski davranış birebir.
      if(!akilliGeri) return aday[0];
      var enIyi = aday[0], enAz = Infinity;
      for(var i=0;i<aday.length;i++){
        var a = aday[i];
        if(!icerde(a)) continue;
        var puan = 0;
        for(var m=0;m<kutular.length;m++) puan += ortAlan(kutular[m], a);
        // Kayışı ya da bir kasnağı kesen aday, bir kutuyu örtenden AĞIR sayılır:
        // yazı çizginin üstünde okunmaz.
        // Yalnız `nameSmart`ta: kanvas kartının ve raporun geri düşüşü kapılı.
        if(opts.nameSmart) for(var j2=0;j2<segler.length;j2++) if(kesisir(segler[j2], a)) puan += 40;
        for(var dk2=0;dk2<diskler.length;dk2++) if(diskeDeger(diskler[dk2], a)) puan += 40;
        for(var y=0;y<yumusakList.length;y++) puan += ortAlan(yumusakList[y], a) * 0.25;
        if(puan < enAz){ enAz = puan; enIyi = a; }
      }
      return enIyi;
    }

    // 1) ADLAR — sert engellere, sonra (mümkünse) yumuşaklara göre.
    //
    // VURGULANAN KASNAĞIN ADI ÖNCE YERLEŞİR: temiz yeri o alsın — resmin
    // sorusu onun adı. Öteki sıra değişmez (eski çizimler birebir).
    // `nameSmart`: hiçbir aday temiz değilse ilk adaya değil en AZ örtüşene
    // düşer. Varsayılan KAPALI — kanvas kartının ve raporun yerleşimi kapılı
    // (fead-card-design.test.js) ve bu seçenek onlara dokunmuyor.
    var adSira = ps.map(function(p, k){ return k; });
    if(hk > 0){ adSira.splice(hk, 1); adSira.unshift(hk); }
    if(adVar)
      adSira.forEach(function(k){
        var p = ps[k];
        var X = offX + (p.c[0]-minX)*s, Y = offY + (maxY-p.c[1])*s, R = p.rPitch*s;
        // Vurgulu ad KALIN yazılıyor: aynı metin ~%8 geniş. Tahmin ince yazıya
        // göreydi ve ölçüldü — kalın adın sağ ucu kayışa değiyordu.
        var w = etW(gorAd(k), 9) * (k === hk ? 1.1 : 1);
        var aday = [
          { x:X,        y:Y-R-4,      an:'middle', x0:X-w/2,  x1:X+w/2,  y0:Y-R-4-8,   y1:Y-R-4+2 },
          { x:X,        y:Y+R+11,     an:'middle', x0:X-w/2,  x1:X+w/2,  y0:Y+R+11-8,  y1:Y+R+11+2 },
          { x:X+R+5,    y:Y+3,        an:'start',  x0:X+R+5,  x1:X+R+5+w, y0:Y-5,      y1:Y+5 },
          { x:X-R-5,    y:Y+3,        an:'end',    x0:X-R-5-w, x1:X-R-5, y0:Y-5,       y1:Y+5 }
        ];
        // DÖRT YÖN DAR KALABALIKTA YETMİYOR — yalnız `nameSmart` çiziminde
        // çemberin çevresinde 16 açı × 2 uzaklık daha denenir (tercih sırası
        // korunur: önce eski dört yer). Ölçüldü: 6 kasnaklı küçük resimde
        // köşedeki kasnağın dört yeri de doluydu (üst çerçevenin dışı, alt ve
        // sol kayış, sağ çerçevenin dışı) ve ad kayışın üstüne düşüyordu.
        if(opts.nameSmart)
          [6, 14].forEach(function(uz){
            for(var ai = 0; ai < 16; ai++){
              var th = -Math.PI/2 + ai * Math.PI/8;
              var cx = X + (R + uz) * Math.cos(th), cy = Y + (R + uz) * Math.sin(th);
              var co = Math.cos(th), si = Math.sin(th);
              var an = (co > 0.35) ? 'start' : (co < -0.35) ? 'end' : 'middle';
              var x0 = (an === 'start') ? cx : (an === 'end') ? cx - w : cx - w/2;
              var y0 = (si < -0.35) ? cy - 10 : (si > 0.35) ? cy : cy - 5;
              aday.push({ x: (an === 'start') ? x0 : (an === 'end') ? x0 + w : x0 + w/2,
                          y: y0 + 8, an: an, x0: x0, x1: x0 + w, y0: y0, y1: y0 + 10 });
            }
          });
        var sec = yerlestir(aday, yumusak, !!opts.nameSmart);
        kutular.push(sec); _etiket[k] = sec;
      });

    // 2) SARIM AÇILARI — adlar ARTIK YERLEŞMİŞ birer sert engel. Sıra tersine
    // olamazdı: ad yapısal bilgidir (hangi sayı hangi kasnağın), açı bir
    // okumadır; yeri daralan taraf okuma olmalı.
    //
    // Kendi varsayılan yeri yumuşak listeden ÇIKARILIR — yoksa açı kendi
    // tercih ettiği yeri "dolu" sayıp koşulsuz ikinci adaya kaçardı.
    if(aciVar)
      ps.forEach(function(p, k){
        var kendi = aciAday[k][0];
        var yl = yumusak.filter(function(x){ return x !== kendi; });
        var sec = yerlestir(aciAday[k], yl, true);
        kutular.push(sec); _aciEt.push(sec);
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
      // `sense` YÜRÜYÜŞÜN el yönü (liste sırası; kaburga normalleri ondan),
      // `spin` KAYIŞIN GERÇEK dönüşü — liste gidişin tersi olduğu için
      // işareti ters (fead-model.js → veFeadNaturalSense). Animatör fazı
      // `spin` ile değil bu ilişkiyle sürüyor: faz yürüyüşe göre AZALIR.
      spin: (geom.sense < 0 ? 1 : -1),
      loop: r4(walk.l), mmS: _akis ? r4(opts.animate.dispMmS) : 0,
      vib: opts.vib || null,
      // SENARYO: devir zamanın fonksiyonu, dolayısıyla kayış hızı da öyle.
      // `slow` ağır çekim katsayısı; animatör kare başına mmS'i
      //   beltMs(t)·1000·slow
      // diye kendisi kuruyor — sabit bir mmS senaryoda yanlış olurdu.
      scn: opts.scn ? _feadScnSlim(opts.scn) : null,
      vibModes: (typeof VE_FEAD_VIB_MODES === 'number') ? VE_FEAD_VIB_MODES : 4,
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
  // `frame:false` — çerçeveyi KAP çiziyor (pencerenin küçük resmi); SVG'nin
  // kendi kenarlığı içte ikinci bir kutu oluyordu (ölçüldü: çift çerçeve).
  // DÜZENLENEBİLİR ÇİZİM (kanvas kartı) kendi mm dönüşümünü taşır: sürükleme
  // fareyi mm'ye buradan çevirir, ikinci bir ölçek hesabı yapmaz.
  var _duzen = !!(opts.edit && opts.inline && opts.nodeId);
  var editAttr = _duzen
    ? ' data-fead-xf="' + [s, offX, offY, minX, maxY].map(function(v){
        return Math.round(v * 1e6) / 1e6; }).join(' ') + '"'
    : '';
  var kabuk = opts.inline
    ? '<svg' + animAttr + editAttr + ' viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" style="display:block; width:100%; height:100%;">'
    : (opts.frame === false)
    ? '<svg' + animAttr + ' viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block; width:100%; height:auto;">'
    : '<svg' + animAttr + ' viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block; width:100%; max-width:'
      + W + 'px; margin:0 auto; background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
  var svg = kabuk;

  // GERGİ KOLU: pivot → kasnak merkezi. Kol boyu ve montaj açısı bu çizgi;
  // yanlış girilmiş bir pivot burada gözle görünür (kol kayışa ters uzanır).
  if(pv){
    var ti = build.sys._tenIdx;
    var tp = (ti >= 0 && ps[ti]) ? ps[ti] : null;
    if(tp){
      // SEÇİCİYLE AYNI DİL: merkezden pivota bakan dolu uçlu yeşil ok.
      // Eskiden 1,6 px kesikli, %85 saydam, uçsuz bir çizgiydi ve 56 öğelik
      // şemada kullanıcının seçtiği nokta TANINMIYORDU (ölçüldü).
      svg += veFeadArmArrowSVG([tx(tp.c[0]), ty(tp.c[1])], [tx(pv[0]), ty(pv[1])],
                               { f: f, kalinlik: 2.4, ucBoy: 9, ucGen: 3.8 });
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
  // ── GERİLME HARİTASI — renk yalnız AÇIKLIKLARDA ─────────────────────────
  // Çekirdek gerilmeyi AÇIKLIK başına veriyor; sarım yayı boyunca gerilme
  // kasnağın üstünde sürtünmeyle değişiyor ve tek bir sayısı YOK. Yayları da
  // boyamak, olmayan bir sayıyı iddia etmek olurdu — yaylar temel amber kalıyor
  // ve haritanın NEREDE tanımlı olduğu çizimden okunuyor.
  var tmap = opts.tension;
  if(tmap && tmap.spanN && tmap.spanN.length === (geom.spans || []).length){
    geom.spans.forEach(function(sp, i){
      var TN = tmap.spanN[i];
      if(!Number.isFinite(TN)) return;
      var renk = veFeadTensionColor(TN, tmap.min, tmap.max);
      svg += '<path data-ve="belt-tension" data-span="' + i + '" d="'
          + _feadSpanPathD(walk, i, T, vibDef) + '" fill="none" stroke="' + renk
          + '" stroke-width="4.4" stroke-linecap="round"><title>'
          + _feadEsc(geom.names[i] + ' → ' + geom.names[(i+1) % ps.length]
                     + ' · ' + Math.round(TN) + ' N') + '</title></path>';
      // SAYI RAMPA RENGİNDE DEĞİL, METİN RENGİNDE. Rampanın orta durağı kayışın
      // amberi olmak zorunda (harita açılıp kapanınca renk sıçramasın) ama o
      // amber AÇIK temada beyaz üstünde 2,3:1 kontrast veriyor — 9 px'lik bir
      // sayı için okunmaz. Renk zaten yanı başındaki açıklıkta; sayının işi
      // okunmak. Zemin renginde bir hâle (`paint-order`) kayışın, dişlerin ve
      // kasnak çemberinin üstünde de okunur tutuyor.
      var _e = null;
      _spanEt.forEach(function(x){ if(x.i === i) _e = x; });
      if(_e)
        svg += '<text data-ve="span-tension" x="' + f(_e.x) + '" y="' + f(_e.y)
            + '" text-anchor="middle" font-size="9" font-weight="600"'
            + ' paint-order="stroke" stroke="var(--bg-input)" stroke-width="3.2"'
            + ' stroke-linejoin="round" fill="var(--text-primary)">' + _e.yazi + '</text>';
    });
    // ÖLÇEK ÇİZİLİR: renk bir SIRALAMA gösteriyor, sayıya çevrilebilmesi için
    // uçların yazılı olması şart. Gradyan değil ayrık kutucuklar — <defs>
    // kimliği aynı kanvastaki ikinci kartla çakışırdı.
    // Çubuğun ÜSTÜNDE (ALT): altında hiç görünmüyordu. Zemin hâlesi kayışın ve
    // kasnağın üstünde de okunur tutar (açıklık sayılarının kuralı).
    var LB = 84, LX = f(pad - 6), LY = f(H - ALT - 34);
    var _hale = ' paint-order="stroke" stroke="var(--bg-input)" stroke-width="2.4" stroke-linejoin="round"';
    for(var q = 0; q < 12; q++)
      svg += '<rect data-ve="tension-scale" x="' + f(LX + q*LB/12) + '" y="' + LY
          + '" width="' + f(LB/12 + 0.4) + '" height="6" fill="'
          + veFeadTensionColor(tmap.min + (tmap.max-tmap.min)*(q+0.5)/12, tmap.min, tmap.max) + '"/>';
    svg += '<text data-ve="tension-legend" x="' + LX + '" y="' + f(H - ALT - 38) + '" font-size="7" fill="var(--text-muted)"' + _hale + '>'
        + 'açıklık gerilmesi · ' + Math.round(tmap.engineRpm) + ' dev/dk</text>'
      + '<text data-ve="tension-legend" x="' + LX + '" y="' + f(H - ALT - 22) + '" font-size="7" fill="var(--text-muted)"' + _hale + '>'
      + Math.round(tmap.min) + ' N</text>'
      + '<text data-ve="tension-legend" x="' + f(LX + LB) + '" y="' + f(H - ALT - 22) + '" text-anchor="end" font-size="7"'
      + ' fill="var(--text-muted)"' + _hale + '>' + Math.round(tmap.max) + ' N</text>';
  }
  svg += '<path data-ve="rib" d="' + _feadTeethPath(walk, geom.sense, stepMm, toothMm, 0, T, vibDef) + '" fill="none"'
      + ' stroke="var(--accent-warning)" stroke-width="1" stroke-linecap="round" opacity="0.9">'
      + '<title>Kayışın kaburgalı yüzü — dişler bu yüzün baktığı tarafı gösterir</title></path>';
  svg += '<text data-ve="rib-legend" x="' + f(pad - 6) + '" y="' + f(H - ALT - 5) + '" font-size="7"'
      + ' fill="var(--text-muted)"' + (ALT ? ' paint-order="stroke" stroke="var(--bg-input)" stroke-width="2.4" stroke-linejoin="round"' : '')
      + '>dişli kenar = kayışın kaburgalı yüzü</text>';

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
    // VURGU kasnağın ARKASINA bir zemin + kalın çember: rol rengi (sürücü ·
    // gergi · aksesuar) aynı kalır, yani vurgu rolü EZMEZ, üstüne biner.
    var vurgu = (k === hk);
    // DÜZENLENEBİLİR ÇİZİMDE her kasnağın bir işaret zemini VAR, görünürlüğü
    // CSS'te (`.is-hov` · `.is-sel`): seçim ve fare altı kartı yeniden
    // kurmadan değişir (veFeadCizimIsaretle). Kimlik `data-pi`nin ARKASINDA.
    // SUNUM NİTELİĞİ GÖRÜNMEZ (`fill="none" opacity="0"`) ve CSS onu ezer:
    // kural taşımayan bir belgede (kılavuzun baskısı) nitelik olmasa SVG
    // varsayılanı SİYAH dolgu olur ve her kasnağın arkasına kara bir disk
    // çizilirdi.
    var _kid = (_duzen && build.order[k]) ? build.order[k].id : '';
    var _ksin = _kid ? ((_kid === opts.selId ? ' is-sel' : '') + (_kid === opts.hovId ? ' is-hov' : '')) : '';
    var _katt = _kid ? ' data-fead-k="' + _feadEsc(_kid) + '"'
      + (_ksin ? ' class="' + _ksin.trim() + '"' : '') : '';
    if(_kid)
      svg += '<circle data-ve="pulley-hov" cx="' + X + '" cy="' + Y + '" r="' + f(R + 4)
          + '" fill="none" opacity="0"' + _katt + '/>';
    if(vurgu)
      svg += '<circle data-ve="pulley-hl" cx="' + X + '" cy="' + Y + '" r="' + f(R + 3)
          + '" fill="var(--accent-tint-15)" stroke="none"/>';
    svg += '<circle data-ve="pulley" cx="' + X + '" cy="' + Y + '" r="' + R + '" fill="none" stroke="' + col
        + '" stroke-width="' + (vurgu ? 3 : 2) + '"' + (p.contact === 'back' ? ' stroke-dasharray="4 3"' : '')
        + ' data-pi="' + k + '"' + _katt + '/>';
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
    // YÖN: `d` sarım yayının LİSTE sırasındaki süpürme işareti (d > 0 = mm
    // düzleminde CCW; yerleşim yönelimi korunduğu için ekranda da CCW). Liste
    // kayışın gidişinin TERSİ olduğu için kasnağın GERÇEK dönüşü −d: d > 0
    // olan kasnak SAAT YÖNÜNDE döner (fead-model.js → veFeadNaturalSense).
    // İki kez ters yazıldı: önce kayış yayıyla aynı işaret hatasıyla, sonra
    // `d`yi dönüşün kendisi sanarak (2026-09-08'e kadar oklar CCW'ydi ve
    // kullanıcı "krank saat yönünde dönmüyor" diye bildirdi).
    // Animasyon açıkken ok ÇİZİLMEZ: dönüş yönünü artık kolların kendisi
    // gösteriyor ve iki işaret üst üste binerdi (ok 0.55R'de, kollar 0.26–0.86R).
    if(wantArrows && !animPay && R > 9){
      var rr = R * 0.55, cw = (p.d > 0);
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

    if(adVar){
      var et = _etiket[k] || { x: X, y: Y - R - 4, an: 'middle' };
      svg += '<text data-ve="name" x="' + f(et.x) + '" y="' + f(et.y) + '" text-anchor="' + et.an
          + '" font-size="9"' + (vurgu ? ' font-weight="700" fill="var(--text-heading)"' : ' fill="var(--text-muted)"')
          + _katt + '>' + _feadEsc(gorAd(k)) + '</text>';
    }
    // SARIM AÇISI ŞEMADA İKİNCİ KEZ YAZILIR. Kanvasta bunun karşılığı var:
    // orada tablo YOK, kart tek başına duruyor. Raporda aynı altı sayı bir
    // sonraki sayfada hizalı ve iki ondalıkla basılıyor; şemada ise kayış
    // yolunun üstüne düşüyor (ölçüldü: dört çakışmanın ikisi bu etiketten).
    //
    // YERİ YERLEŞTİRİCİDEN GELİR, sabit değil: varsayılanı kasnağın altı, ama
    // orası doluysa üst/sağ/sol adaylarına taşınır (bkz. `aciAday`). Sabitken
    // ad kaçamadığı her karede iki yazı üst üste kalıyordu.
    if(opts.wrapLabels !== false){
      var _ae = _aciEt[k] || { x: X, y: Y + R + 10, an: 'middle' };
      svg += '<text data-ve="wrap" x="' + f(_ae.x) + '" y="' + f(_ae.y) + '" text-anchor="'
          + _ae.an + '" font-size="8" fill="var(--ink-warning)">'
          + f(geom.wrapDeg(k)) + '°</text>';
    }
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

  // ── ÇİZİM MASASI: sürükleme künyesi + isabet halkaları ──────────────────
  if(_duzen){
    // Sürüklenen kasnağın KÜNYESİ: konum GİRDİSİ (mm; gergide avara merkezi)
    // ve komşu iki açıklığın boyu — kesin sayı sürüklerken de okunsun.
    var _sk = -1;
    if(opts.surukleK) build.order.forEach(function(n, k){ if(n && n.id === opts.surukleK) _sk = k; });
    if(_sk >= 0 && ps[_sk]){
      var _sn = build.order[_sk], _sd = _sn.data || {}, _sten = !!_feadDefOf(_sn).isFeadTensioner;
      var _sx = _feadNum(_sten ? _sd.cenX : _sd.x, NaN), _sy = _feadNum(_sten ? _sd.cenY : _sd.y, NaN);
      var _SX = tx(ps[_sk].c[0]), _SY = ty(ps[_sk].c[1]), _SR = ps[_sk].rPitch * s;
      var _sagda = (_SX + _SR + 8 + 96) < W;
      svg += '<text data-ve="drag-readout" x="' + f(_sagda ? _SX + _SR + 8 : _SX - _SR - 8)
          + '" y="' + f(Math.max(12, _SY - _SR * 0.6)) + '" text-anchor="' + (_sagda ? 'start' : 'end')
          + '" font-size="9.5">'
          + 'X ' + _feadFmt(_sx, 1) + ' · Y ' + _feadFmt(_sy, 1) + ' mm</text>';
      var _gx = 0, _gy = 0;
      ps.forEach(function(p){ _gx += tx(p.c[0]); _gy += ty(p.c[1]); });
      _gx /= ps.length; _gy /= ps.length;
      [(_sk - 1 + ps.length) % ps.length, _sk].forEach(function(i){
        var sp = geom.spans && geom.spans[i];
        if(!sp) return;
        var ax = tx(sp.Pi[0]), ay = ty(sp.Pi[1]), bx = tx(sp.Pj[0]), by = ty(sp.Pj[1]);
        var mx = (ax + bx) / 2, my = (ay + by) / 2;
        var vx = bx - ax, vy = by - ay, vl = Math.sqrt(vx*vx + vy*vy) || 1;
        var nx = vy / vl, ny = -vx / vl;
        if((mx - _gx) * nx + (my - _gy) * ny < 0){ nx = -nx; ny = -ny; }      // DIŞA
        var yazi = _feadFmt(sp.L, 1) + ' mm', w = yazi.length * 5 + 12;
        var X = Math.min(Math.max(mx + nx * 13, w/2 + 2), W - w/2 - 2);
        var Y = Math.min(Math.max(my + ny * 13, 10), H - 10);
        svg += '<g data-ve="drag-span"><rect x="' + f(X - w/2) + '" y="' + f(Y - 7.5) + '" width="' + f(w)
            + '" height="15" rx="7.5"/><text x="' + f(X) + '" y="' + f(Y + 3)
            + '" text-anchor="middle" font-size="8.5">'
            + yazi + '</text></g>';
      });
    }
    // İSABET HALKALARI EN ÜSTTE ve BÜYÜKTEN KÜÇÜĞE: büyük kasnağın yanındaki
    // küçük avara üstte kalsın. Yarıçap en az 11 px — 77 mm'lik avara dar
    // kartta birkaç piksel olabiliyor.
    var _hit = ps.map(function(p, k){ return { p: p, k: k }; })
      .sort(function(a, b){ return b.p.rPitch - a.p.rPitch; });
    svg += '<g data-ve="hit">';
    _hit.forEach(function(o){
      var n = build.order[o.k];
      if(!n) return;
      var hid = _feadEsc(n.id), kid = _feadEsc(opts.nodeId);
      // `fill="transparent"` NİTELİKTE de: `none` isabet almaz, nitelik
      // hiç olmasa CSS'siz belgede halka SİYAH dolguyla çizilirdi.
      svg += '<circle class="ve-fead-hit" data-fead-k="' + hid + '" cx="' + f(tx(o.p.c[0]))
          + '" cy="' + f(ty(o.p.c[1])) + '" r="' + f(Math.max(o.p.rPitch * s + 3, 11)) + '"'
          + ' fill="transparent"'
          + ' onmousedown="veFeadCizimBas(event,\'' + kid + '\',\'' + hid + '\')"'
          + ' onmouseenter="veFeadCizimUzerinde(\'' + hid + '\')" onmouseleave="veFeadCizimUzerinde(null)">'
          + '<title>' + _feadEsc(_feadNodeName(n)) + ' — sürükle: taşı · tıkla: penceresini aç</title></circle>';
    });
    svg += '</g>';
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
          + '<title>Yön gülü — sürükle ile taşınır, çift tık varsayılan yerine döndürür.</title></rect>';
    svg += '<g data-ve="compass" stroke="var(--text-muted)" stroke-width="1" fill="none">'
        + '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '"/>'
        + '<line x1="' + f(cx-r-4) + '" y1="' + f(cy) + '" x2="' + f(cx+r+4) + '" y2="' + f(cy) + '"/>'
        + '<line x1="' + f(cx) + '" y1="' + f(cy-r-4) + '" x2="' + f(cx) + '" y2="' + f(cy+r+4) + '"/></g>';
    // Gül veri düzleminin yönünü gösterir: 0° sağda, açı +X'ten CCW artar.
    // Çizim aynalanmadığı için burada bir çeviri yok.
    var ay = +1;
    var et = [['0', cx + ay*(r+7), cy+3, ay>0?'start':'end'], ['90', cx, cy-r-7, 'middle'],
              ['180', cx - ay*(r+7), cy+3, ay>0?'end':'start'], ['270', cx, cy+r+11, 'middle']];
    et.forEach(function(t){
      svg += '<text x="' + f(t[1]) + '" y="' + f(t[2]) + '" text-anchor="' + t[3]
          + '" font-size="7" fill="var(--text-muted)">' + t[0] + '</text>';
    });
    // Açının ARTIŞ yönünü gösteren küçük yay (0°'den 90°'ye). Aynalı çizimde
    // bu yay ekranda saat yönünde görünür — doğrusu budur.
    svg += '<path d="M' + f(cx + ay*r*0.6) + ' ' + f(cy) + ' A' + f(r*0.6) + ' ' + f(r*0.6)
        + ' 0 0 ' + (ay>0 ? '0' : '1') + ' ' + f(cx) + ' ' + f(cy - r*0.6)
        + '" fill="none" stroke="var(--text-muted)" stroke-width="0.9"/>'
        + '<path d="M' + f(cx) + ' ' + f(cy - r*0.6) + ' l' + f(ay*2.6) + ' 2.4 l' + f(-ay*3.4) + ' 1.1 Z" fill="var(--text-muted)"/>';
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
// ── KOL KONUMU KARTIN KENDİSİNİN ───────────────────────────────────────────
// Bir dönem "tek alan" kuralı vardı: iki kart tipi varken (geometri + çalışma
// noktası) ikisi de AYNI düğümün `posMode`'unu okuyordu, çünkü ikisi de aynı
// geometriyi çizmek zorundaydı ve farkı görmek imkânsızdı — ikisi de kendi
// içinde tutarlı görünür, yalnız biri başka bir kol konumunu anlatır.
//
// O kural kartlar ÇOĞALTILABİLİR olunca kendi kendini bozdu: ikinci bir kart
// kendi seçicisini yazıyor, çizimi ise BİRİNCİ kartın konumundan yapıyordu.
// Alan artık her kartın kendi düğümünde (`veFeadPosMode(node)`), yani seçici
// ile çizim aynı yerden besleniyor. `veFeadPosModeShared`/`...Node` çifti
// bununla birlikte KALKTI — çağıranı kalmamıştı ve duran bir "öteki kartın
// konumunu oku" yardımcısı, bir sonraki düzenlemede sessizce geri gelirdi.

var VE_FEAD_CARD_CLASS = 've-fead-layout-card';
var VE_FEAD_TABLE_CLASS = 've-fead-table-card';

function veFeadApplyLayoutCard(nodeEl, node){
  if(!nodeEl || !node || typeof document === 'undefined') return false;
  var _d = _feadDefOf(node);
  if(!_d.isFeadLayout) return false;
  var box = nodeEl.querySelector('.ve-node-box') || nodeEl;

  // Kart bir kez kurulur, İÇİ tazelenir. Yeniden kurmak her tazelemede
  // düğümün sembolünü ve etiketini yeniden taşımak olurdu.
  var card = box.querySelector('.' + VE_FEAD_CARD_CLASS);
  if(!card){
    card = document.createElement('div');
    card.className = VE_FEAD_CARD_CLASS;
    card.style.cssText = 'position:absolute; inset:0; display:flex; flex-direction:column;'
      + 'overflow:hidden; border-radius:inherit; background:var(--bg-input);';
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
  // ── BANT YOK: DENETİMLER ÇİZİMİN ÜSTÜNDE YÜZER ──────────────────────────
  // Kart bir dönem dört yatay bant taşıyordu — iki seçici şeridi (44 px), bir
  // durum şeridi (20 px), titreşim açıkken bir kazanç şeridi daha (20 px) —
  // ve her biri yüksekliğini ÇİZİMDEN alıyordu. Ölçüldü (440×500 kart):
  // çizime 436 px kalıyordu, yani kartın %13'ü banttı; titreşim açılınca
  // %17. Denetimler artık çizimin üstünde YÜZÜYOR ve çizim kartın tamamını
  // alıyor (0 px bant).
  //
  // BEDELİ: yüzen çubuk çizimin alt kenarının bir kısmını örtüyor. Karşılığı
  // ödeniyor çünkü örtülen alan ÇİZİMİN İÇİNDE (şeffaf zemin, altındaki
  // çizgiler görünüyor) ve çubuk çizimin kendi payından daha dar; bant ise
  // çizimin dışındaydı ve ölçeği düşürüyordu.
  var SER = 0;
  var SEC = 0;

  // ── TEK KART TİPİ, TEK ÇİZİCİ ────────────────────────────────────────────
  // Bir dönem İKİ TİP vardı — `fead-layout` (geometri) ve `fead-run`
  // (işletme) — ve fark tipin içine gömülüydü: hangi katmanlar açık, hangi
  // seçiciler görünür, devir okunur mu. Katmanlar kart başına seçilebilir
  // olunca o ayrım İKİNCİ KEZ aynı işi yapmaya başladı; kullanıcı bildirimi
  // (2026-09-11): *"iki kanvas var, ikisinin de özellikleri farklı… tipoloji
  // tek olacak."* Tip kalktı, ayrım ÖN AYAR oldu (`geometri` / `isletme`).
  //
  // Buradan geçen her kart AYNI yeteneklere sahip: kol konumu da, devir de,
  // titreşim de, katmanlar da kendi alanında. Açılışta yine İKİ kart gelir —
  // ama ikisi de bu tipten ve aralarındaki tek fark değiştirilebilir.
  var kat = veFeadKatmanlar(node);
  // KOL KONUMU KARTIN KENDİSİNİN. Bir dönem çalışma kartı bunu geometri
  // kartından devralıyordu (`veFeadPosModeShared`); tek tip kalınca
  // devralınacak bir "öteki" de kalmadı ve her kart kendi seçicisini çiziyor.
  var mode = veFeadPosMode(node);

  // ── ANİMASYON: seçili devir → kinematik → çiziciye ────────────────────────
  // Devir seçimi kartta duruyor (node.data.animRpm) ve PANEL DE aynı alanı
  // okuyacak olursa iki ayrı ayar tutulmaz — kol konumundaki kuralın aynısı.
  // 'Durgun' seçiliyse animasyon YÜKÜ HİÇ ÜRETİLMEZ: kart bugünkü donuk
  // şemasıyla (dönüş okları geri gelir) kalır, rAF döngüsü de başlamaz.
  // HER KART DEVİR OKUR. Bir dönem yalnız çalışma kartı okuyordu ve geometri
  // kartı donuktu; tek tip kalınca "donuk kart" diye bir TİP yok — ama donuk
  // bir KART var: geometri ön ayarı devri 'Durgun'a getiriyor ve o hâlde yük
  // üretilmiyor, rAF uyanmıyor, açıklık gerilmesi hesaplanmıyor. Kullanıcı
  // seçiciden başka bir devir seçer seçmez ön ayar karışmayı bırakır.
  var onDevir = veFeadOnAyarDevir(node);
  var rpmSel = (onDevir !== null) ? onDevir : veFeadAnimRpmOf(build, node);

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
  // HER KART TİTREŞİM OKUR. Bir dönem yalnız çalışma kartı okuyordu (geometri
  // kartı donuktu); tek tip kalınca "donuk kart" diye bir şey yok — seçici
  // 'Kapalı'daysa (varsayılan) mod listesi hiç kurulmaz.
  var vibSel = veFeadVibModeOf(node), vibGain = veFeadVibGainOf(node);
  var vibZeta = veFeadVibZetaOf(node);
  var vibOpts = { crankInertia: _feadNum(build.solver && build.solver.data
                                         && build.solver.data.crankInertia, 0) };
  var vibModes = (vibSel === 'off') ? null : veFeadVibModeList(build, vibOpts);
  var vib = null;
  if(vibSel === 'span' && scn && kin){
    // SENARYODA ÇIRPMA CANLIDIR: frekans ve genlik kare başına senaryonun o
    // andaki gerginliğinden gelir. Donmuş bir yük, süpürme sırasında geçilen
    // rezonansları gösteremezdi — oysa görülecek olay tam olarak o.
    vib = veFeadVibSpanPayload(build, scn.idle, kin.slow, vibGain, vibRel, vibZeta);
    if(vib) vib.live = 1;
  } else if(vibSel === 'span' && kin){
    vib = veFeadVibSpanPayload(build, rpmSel, kin.slow, vibGain, vibRel, vibZeta);
  } else if(vibSel !== 'off' && vibSel !== 'span'){
    vib = veFeadVibModePayload(build, parseInt(vibSel.slice(5), 10) || 0, vibGain, vibOpts, vibRel);
  }

  // KAZANÇ ŞERİDİ DE YÜZER. Bir dönem 20 px'lik dördüncü bir banttı ve
  // titreşimi açmak çizim alanından 20 px koparıyordu ("bedelini isteyen
  // öder" kuralı); yüzer hâlde bedel sıfır, şerit yüzen çubuğun hemen üstünde
  // beliriyor.
  var SVIB = 0;

  // KÜNYE TABLOSU KARTTAN KALKTI. Ad · Ø · sarım · devir · güç sütunlarını
  // kanvastaki KAYIŞ TABLOSU kartı zaten yazıyor; kartın içinde ikinci kez
  // yazmak aynı sayıyı iki yüzeyde tutmaktı. Kalkınca sarım açıları çizime
  // geri döndü (aşağıda `wrapLabels`) ve çizim alanı 342 → 458 px oldu.
  var cizimH = H - SER - SEC - SVIB;

  // Harita yalnız SEÇİLİ SABİT devirde: senaryoda devir zamanın fonksiyonu ve
  // donuk bir renk o anın gerilmesini yanlış anlatırdı, 'Durgun'da ise gerilme
  // tanımsız (bkz. fead-model.js → veFeadSpanTensionMap).
  var tenMap = (rpmSel !== 'off' && rpmSel !== 'scn'
                && typeof veFeadSpanTensionMap === 'function')
    ? veFeadSpanTensionMap(build, vibRel, rpmSel) : null;

  // HANGİ ETİKET ÇİZİLECEK ARTIK KATMANLARDAN. Sarım açısı ile açıklık
  // gerilmesi aynı çizimde kalabalık yapıyor — ama bu bir TİP kuralı değil,
  // iki ön ayarın birbirinden ayrıldığı yer.
  // Yazı katsayısı: çizim 1/k ölçüde üretilir, viewBox büyütür (veFeadYaziK).
  var yk = veFeadYaziK();
  var svg = veFeadLayoutSVG(build, Math.max(120, W) / yk, Math.max(90, cizimH) / yk,
                            { inline: true, posMode: mode, nodeId: node.id,
                              // ÇİZİM MASASI: kanvas kartı DÜZENLENEBİLİR çizimdir.
                              // Seçim/fare altı işareti ve sürükleme durumu görünüm
                              // durumudur (modelde değil); kart kurulurken de
                              // aynen basılsın ki tazeleme işareti düşürmesin.
                              edit: true, selId: _feadSelectedId(), hovId: VE_FEAD_UZERINDE,
                              xfSabit: VE_FEAD_SURUKLE ? VE_FEAD_SURUKLE.xf[node.id] : null,
                              // Sürükleme KÜNYESİ yalnız imlecin altındaki kartta.
                              surukleK: (VE_FEAD_SURUKLE && VE_FEAD_SURUKLE.kart === node.id)
                                ? VE_FEAD_SURUKLE.kasnak : null,
                              compassPos: node.data && node.data.compassPos,
                              // KATMANLAR KARTIN KENDİSİNDEN. Bu satırlar bir
                              // zamanlar sabitti (`shortNames: true`,
                              // sarım açıları tipten) ve ikinci bir kart
                              // açmak aynı resmi ikinci kez çizmek demekti.
                              nameLabels: kat.ad, shortNames: kat.adKisa,
                              wrapLabels: kat.sarim, spanLabels: kat.spanEt,
                              arrows: kat.ok, compass: kat.gul, pivot: kat.kol,
                              ghostLabels: kat.hayaletEt,
                              tension: tenMap,
                              // YÜZEN ÇUBUK YÖN GÜLÜNÜ ÖRTMESİN (ölçüldü).
                              altPay: VE_FEAD_YUZ_ALT / yk,
                              vib: vib, scn: scn,
                              animate: kin ? { dispMmS: scn ? 0 : kin.dispMmS,
                                               slow: kin.slow,
                                               label: _feadAnimLabel(kin, secim && secim.fallback,
                                                                     vib, scn) }
                                           : (vib ? { dispMmS: 0, label: _feadAnimLabel(null, false, vib) } : null) });

  // KABUK KONUMLANDIRILMIŞ: yüzen çubuk, durum rozeti ve katman paneli üçü de
  // buna göre yerleşiyor. `ve-fead-kanvas` olmadan hepsi kart kutusuna göre
  // konumlanır ve kart başlığının altına kayar.
  var h = '<div class="ve-fead-kanvas"><div class="ciz">';
  if(svg){
    h += svg;
  } else {
    // ÇÖZÜLEMEDİ — kartın en değerli hâli bu. Sessiz boş bir kutu yerine
    // EKSİĞİN KENDİSİ yazılıyor; kullanıcı neyi düzeltmesi gerektiğini
    // panel açmadan okuyor.
    var neden = (build && build.errors && build.errors.length) ? build.errors[0]
      : (build && build.geomError) ? build.geomError
      : 'Kayış yolu henüz kurulamadı.';
    // ÇİZİM MASASI: kart giriş yüzeyi, dolayısıyla boş ya da çizilemeyen hâli
    // bir ÇIKMAZ değil — ne yapılacağını söyler ve iki kapıyı gösterir.
    // Kasnağı olmayan model ARIZA değil başlangıçtır: kırmızı başlık yok.
    var _bos = !(build && build.order && build.order.length);
    h += '<div class="ve-fead-kan-bos' + (_bos ? ' ilk' : '') + '">'
      + '<b>' + (_bos ? 'Kayış yolunda henüz kasnak yok' : 'Şema çizilemiyor') + '</b>'
      + '<span>' + _feadEsc(_bos ? 'Sihirbazla kur ya da tabloyu açıp kasnakları sırayla ekle.' : neden) + '</span>'
      + ((!_bos && build && build.errors && build.errors.length > 1)
          ? '<span class="ek">+' + (build.errors.length - 1)
            + ' eksik daha — panelde tamamı yazılı</span>' : '')
      // BİRİNCİL EYLEM DURUMA GÖRE: boş modelde başlangıç (sihirbaz), kasnağı
      // olan ama çizilemeyen modelde eksiği doldurmak (tablo) — ikinci hâlde
      // "Sihirbazla kur"u öne koymak, kullanıcıyı eksik bir X/Y için
      // modeli baştan kurmaya çağırmaktı.
      + '<span class="eylem">' + (_bos
        ? _feadBosDugme('veFeadWizOpenAny()', 'Sihirbazla kur') + _feadBosDugme('veFeadTabloAc()', 'Tabloyu aç')
        : _feadBosDugme('veFeadTabloAc()', 'Tabloyu aç') + _feadBosDugme('veFeadWizOpenAny()', 'Sihirbazla kur'))
      + '</span></div>';
  }
  h += '</div>';
  // SIRA: rozet → katman paneli → titreşim şeridi → yüzen çubuk. Panel
  // çubuğun ÜSTÜNE oturuyor (`--fead-kat-alt`) ve yığın sırası z-index'ten
  // değil bu sıradan da okunabilsin.
  h += veFeadLayoutCardStrip(build, mode);
  h += veFeadKatmanPanelHTML(node, kat, !!tenMap);
  if(vibSel !== 'off') h += veFeadVibStrip(node, build, vib, vibSel);
  h += veFeadPosPicker(node, build, mode, rpmSel, vibSel, vibModes,
                       veFeadKatmanDugmeHTML(node, kat));
  h += '</div>';
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
// DÖRT DENETİM, İKİ SATIR: kol konumu + Katmanlar üstte, devir + titreşim
// altta. Bir dönem denetimler İKİ KART TİPİNE bölünmüştü (kol geometride,
// devir ve titreşim çalışmada); tip kalkınca dördü de her karta geldi ve
// 440 px'lik tek satıra sığmıyorlar.
// ═══════════════════════════════════════════════════════════════════════════
//  KATMANLAR — KART NE ÇİZECEĞİNE KENDİ KARAR VERİR
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-09-11): *"Kanvaslar üzerinde görülen şeyler şu anda
// sabit duruyor. Kanvasların üstüne görülen şeylerin kişiselleştirilmesini
// istiyorum… Böylelikle kullanıcı istediği kanvasları oluşturur."*
//
// Çizicinin (`veFeadLayoutSVG`) bu katmanların HEPSİ zaten vardı; eksik olan
// şey seçim değil, seçimin SAHİBİYDİ: bayraklar kartı kuran yerde sabit
// yazılıydı (`shortNames: true`, sarım açıları tipten, gül/kol/ok hep açık).
// Yani ikinci bir kart açmak AYNI resmi ikinci kez çizmekti.
//
// Seçim artık DÜĞÜMÜN ALANINDA (`node.data.kat`) ve kart başına ayrı. İki
// Kayış Yolu kartı yan yana durabilir: biri adlarla ve sarım açılarıyla, öteki
// çıplak yolla. Kayıtta da öyle durur, geri-al da adım adım söker.
//
// LİSTE TEK KAYNAK: kutucuklar, varsayılanlar ve çiziciye giden seçenek adı
// aynı satırdan gelir. İkinci bir liste tutmak, yeni bir katmanın panelde
// görünüp çizimde hiçbir şey yapmaması demekti — ve bu SESSİZ olurdu.
//
//   k          düğüm alanındaki anahtar
//   svg        veFeadLayoutSVG seçeneği (çizicideki adı)
//   geometri / isletme  →  İKİ ÖN AYAR (o katman o ön ayarda açık mı).
//
// ÖN AYARLAR BİR ZAMANLAR İKİ AYRI KART TİPİYDİ ve fark tipin içine
// gömülüydü. Kullanıcı bildirimi (2026-09-11): *"iki kanvas var, ikisinin de
// özellikleri falan farklı… Tek kanvas olacak, açılır açılmaz iki kanvas
// gelsin fakat tipoloji tek olacak."* Haklı: katmanlar kart başına
// seçilebilir olduktan sonra ikinci bir TİP, aynı işi ikinci kez yapan bir
// ayrımdı. Tip kalktı, ayrım ÖN AYAR olarak kaldı — açılışta iki kart yine
// gelir, ama ikisi de aynı tipten ve aralarındaki tek fark kullanıcının
// değiştirebildiği şey.
var VE_FEAD_KATMANLAR = [
  { k:'ad',        svg:'nameLabels',  t:'Kasnak adları',
    ip:'Çemberin yanına ad yazılır', geometri:1, isletme:1 },
  { k:'adKisa',    svg:'shortNames',  t:'Adı kısalt',
    ip:'Sondaki parantez atılır: "Alternatör (155 A)" → "Alternatör"',
    geometri:1, isletme:1, bagli:'ad' },
  { k:'sarim',     svg:'wrapLabels',  t:'Sarım açıları',
    ip:'Her kasnağın altına derece', geometri:1, isletme:0 },
  { k:'spanEt',    svg:'spanLabels',  t:'Açıklık gerilmeleri',
    ip:'Her açıklığın ortasına newton — devir seçiliyken', geometri:0, isletme:1 },
  { k:'ok',        svg:'arrows',      t:'Dönüş okları',
    ip:'Kasnağın döndüğü yön', geometri:1, isletme:1 },
  { k:'gul',       svg:'compass',     t:'Yön gülü',
    ip:'Sağ üstteki +X/+Y pusulası — sürüklenebilir', geometri:1, isletme:1 },
  { k:'kol',       svg:'pivot',       t:'Gergi kolu',
    ip:'Pivot noktası ve kol çizgisi', geometri:1, isletme:1 },
  { k:'hayaletEt', svg:'ghostLabels', t:'Hayalet konum adları',
    ip:'"TÜMÜ" kipinde soluk yolların adı', geometri:1, isletme:0 }
];

// ÖN AYARLAR — panelin adlandırılmış iki düğmesi ve kurucuların kullandığı
// isim. `geometri` aynı zamanda VARSAYILAN: yazılmamış bir kart onu izler.
// ÖN AYAR DEVİR DE SEÇER (`devir`). Geometri kartının donukluğu bir dönem
// TİPİN içindeydi: `fead-layout` devri hiç okumazdı, 'off' sabitti. Tip
// kalkınca o davranış buraya taşındı — yoksa açılıştaki iki kanvasın İKİSİ de
// animasyonlu gelirdi (devir alanı boşken `veFeadAnimRpmOf` en yüksek görev
// oranlı devri seçiyor). Alan bir kez YAZILDIYSA ön ayar karışmaz.
var VE_FEAD_ON_AYARLAR = [
  { k:'geometri', t:'Geometri', devir:'off',
    ip:'Kayış nereden geçiyor: sarım açıları, gergi kolu — donuk şema' },
  { k:'isletme',  t:'İşletme',
    ip:'Bu devirde ne oluyor: açıklık gerilmeleri, gerilme haritası, akan kayış' }
];
var VE_FEAD_KAT_VARSAYILAN = 'geometri';

// AÇIK KATMAN PANELİ MODELDE DEĞİL. Panelin açık olması bir GÖRÜNÜM durumu:
// kaydedilmemeli, geri-al yığınına yazılmamalı, ikinci bir oturuma
// taşınmamalı. Ama kart her katman değişiminde yeniden kurulduğu için bir
// yerde durması ŞART — yoksa her tıklamada panel kapanır ve ikinci kutucuk
// işaretlenemez. Kayış Tablosu'nun seçili satır işaretiyle aynı sınıf
// (`veFeadMarkSelectedRow`): görünüm durumu modülde, model alanında değil.
var VE_FEAD_KAT_ACIK = null;

// Bir ÖN AYARIN çözülmüş katman kümesi. Anahtar tanınmazsa varsayılana düşer
// — uydurma bir ad sessizce boş bir küme üretip kartı çıplak bırakmasın.
function veFeadKatmanVarsayilan(onAyar){
  var ad = (onAyar === true) ? 'isletme'                 // eski çağrı biçimi
         : (onAyar === false || !onAyar) ? VE_FEAD_KAT_VARSAYILAN : String(onAyar);
  if(!VE_FEAD_ON_AYARLAR.some(function(O){ return O.k === ad; }))
    ad = VE_FEAD_KAT_VARSAYILAN;
  var out = {};
  VE_FEAD_KATMANLAR.forEach(function(K){ out[K.k] = !!K[ad]; });
  return out;
}

// Düğümün ÇÖZÜLMÜŞ katman kümesi: varsayılan + kullanıcının yazdıkları.
//
// EKSİK ANAHTAR VARSAYILANA DÜŞER, kapalıya değil. Eski bir kayıtta `kat` hiç
// yok — o kart bugünkü görünümünü aynen korumalı; "yazılmamış = kapalı"
// deseydik kaydedilmiş her proje çıplak bir şemayla açılırdı.
// Düğümün AÇIK ÖN AYARI. Yazılmamışsa varsayılan; tanınmayan bir ad da
// varsayılana düşer (uydurma bir ad kartı sessizce boş bırakmasın).
function veFeadKatmanOnAyar(node){
  var ad = node && node.data && node.data.katOn;
  return VE_FEAD_ON_AYARLAR.some(function(O){ return O.k === ad; })
    ? ad : VE_FEAD_KAT_VARSAYILAN;
}
function veFeadOnAyarOf(ad){
  var out = null;
  VE_FEAD_ON_AYARLAR.forEach(function(O){ if(O.k === ad) out = O; });
  return out;
}
// Ön ayarın DEVİR varsayılanı — yalnız alan hiç yazılmamışken. `null` = ön
// ayarın söyleyecek bir şeyi yok, olağan çözüm koşsun.
function veFeadOnAyarDevir(node){
  if(node && node.data && node.data.animRpm !== undefined) return null;
  var O = veFeadOnAyarOf(veFeadKatmanOnAyar(node));
  return (O && O.devir !== undefined) ? O.devir : null;
}

// ÖN AYAR TABAN, `kat` ÜSTÜNE YAZAR. Düğüm ön ayarın ADINI taşıyor, kopyasını
// değil: ön ayar yarın değişirse onu izleyen kart da değişir. Kurucular
// (örnek, sihirbaz, göç) yalnız o adı yazabiliyor — köprü katmanı sekiz
// bayrağın kopyasını tutmak zorunda kalsaydı liste ikinci kez yazılırdı.
function veFeadKatmanlar(node){
  var out = veFeadKatmanVarsayilan(veFeadKatmanOnAyar(node));
  var v = node && node.data && node.data.kat;
  if(v && typeof v === 'object')
    VE_FEAD_KATMANLAR.forEach(function(K){
      if(v[K.k] !== undefined) out[K.k] = !!v[K.k];
    });
  // BAĞLI KATMAN: adlar kapalıyken "adı kısalt" bir şey ifade etmiyor.
  VE_FEAD_KATMANLAR.forEach(function(K){ if(K.bagli && !out[K.bagli]) out[K.k] = false; });
  return out;
}

function veFeadKatmanSet(nodeId, k, on){
  if(typeof nodes === 'undefined') return false;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return false;
  if(!VE_FEAD_KATMANLAR.some(function(K){ return K.k === k; })) return false;
  if(typeof saveState === 'function') saveState();
  if(!node.data) node.data = {};
  if(!node.data.kat || typeof node.data.kat !== 'object') node.data.kat = {};
  node.data.kat[k] = !!on;
  if(typeof veFeadRefreshCards === 'function') veFeadRefreshCards();
  return true;
}

// ÜÇ İŞLEM. Kutucukları tek tek gezmek sekiz tıklama demek; asıl istenen
// çoğu zaman "hepsini göster", "çıplak yol" ya da "boş ver, eski hâline dön".
// VARSAYILAN alanı SİLER, sıfırla doldurmaz: silinmiş bir alan varsayılanı
// izlemeye devam eder, sıfırlarla doldurulmuş bir alan bugünün varsayılanını
// dondurup yarınki değişikliği kaçırırdı.
function veFeadKatmanIslem(nodeId, islem){
  if(typeof nodes === 'undefined') return false;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return false;
  var onAyar = VE_FEAD_ON_AYARLAR.some(function(O){ return O.k === islem; });
  if(!onAyar && islem !== 'tumu' && islem !== 'hicbiri') return false;
  if(typeof saveState === 'function') saveState();
  if(!node.data) node.data = {};
  if(onAyar){
    // ÖN AYAR ADIYLA YAZILIR, KOPYASIYLA DEĞİL — ve elle yapılan değişiklikler
    // temizlenir: "İşletme" demek "bu kart o ön ayarı izlesin" demek, "bugün
    // o ön ayarın değerleri neyse onlar donsun" değil.
    if(islem === VE_FEAD_KAT_VARSAYILAN) delete node.data.katOn;
    else node.data.katOn = islem;
    delete node.data.kat;
    // DEVİR DE TEMİZLENİR, çünkü ön ayarın SÖZ SÖYLEDİĞİ bir alan (`devir`):
    // "Geometri" diyen bir kullanıcı donuk şema istiyor, elle seçilmiş 2000
    // dev/dk oraya yapışık kalsaydı ön ayar yarım uygulanmış olurdu. Ön ayarın
    // söz söylemediği alanlara (titreşim, kol konumu, yön gülü) DOKUNULMAZ.
    delete node.data.animRpm;
  } else {
    var on = (islem === 'tumu');
    node.data.kat = {};
    VE_FEAD_KATMANLAR.forEach(function(K){ node.data.kat[K.k] = on; });
  }
  if(typeof veFeadRefreshCards === 'function') veFeadRefreshCards();
  return true;
}

// Paneli aç / kapat. Aynı karta ikinci tıklama kapatır; başka bir kart
// açıldığında öteki kapanır (iki panel aynı anda açıkken hangi kartın
// ayarına baktığın okunmuyor).
function veFeadKatmanToggle(nodeId){
  VE_FEAD_KAT_ACIK = (VE_FEAD_KAT_ACIK === nodeId) ? null : (nodeId || null);
  if(typeof veFeadRefreshCards === 'function') veFeadRefreshCards();
  return VE_FEAD_KAT_ACIK;
}

// Şeritteki tetikleyici — açık katman sayısını da yazar ("6/8"), yani panel
// açılmadan "bu kart neyi gösteriyor" sorusuna kaba bir cevap var.
function veFeadKatmanDugmeHTML(node, kat){
  var acik = 0;
  VE_FEAD_KATMANLAR.forEach(function(K){ if(kat[K.k]) acik++; });
  return '<button type="button" class="ve-fead-kat-dugme'
    + (VE_FEAD_KAT_ACIK === node.id ? ' is-acik' : '') + '"'
    + ' onmousedown="event.stopPropagation();"'
    + ' onclick="veFeadKatmanToggle(\'' + _feadEsc(node.id) + '\')"'
    + ' title="Bu kartta hangi katmanların çizileceğini seç">'
    + VE_FEAD_KAT_ICON + '<span class="ad">Katmanlar</span>'
    + '<span class="sayi">' + acik + '/' + VE_FEAD_KATMANLAR.length + '</span></button>';
}

// KATMAN SİMGESİ — üst üste iki kare (çizim, yazı karakteri DEĞİL: eksik bir
// glif afordansı yok eder, Kayış Tablosu'nun ad düğmesindeki gerekçenin aynısı).
var VE_FEAD_KAT_ICON =
  '<svg class="ac" width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"'
  + ' fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round">'
  + '<path d="M6 1.4 10.4 4 6 6.6 1.6 4Z"/><path d="M1.6 7.4 6 10 10.4 7.4"/></svg>';

// Panelin kendisi. GÖRÜNÜM CSS'TE (`css/styles.css` → `.ve-fead-kat*`): bir
// kutucuk listesinin işi durum göstermek (fare üstünde, işaretli, odakta) ve
// satır içi stil bunların HİÇBİRİNİ yazamaz — Kayış Tablosu'nda ölçülmüş kural.
function veFeadKatmanPanelHTML(node, kat, tenVar){
  if(VE_FEAD_KAT_ACIK !== node.id) return '';
  var ad = (node.customName || _feadDefOf(node).name || 'Kart');
  var h = '<div class="ve-fead-kat" onmousedown="event.stopPropagation();"'
    + ' ondblclick="event.stopPropagation();">'
    + '<div class="ve-fead-kat-bas"><b>Katmanlar</b>'
    + '<span class="kart">' + _feadEsc(ad) + '</span>'
    + '<button type="button" class="ve-fead-kat-kapat" onclick="veFeadKatmanToggle(null)"'
    + ' title="Paneli kapat">✕</button></div>'
    // ÖN AYARLAR ÜSTTE ve ADLARIYLA. Bu iki isim bir zamanlar İKİ AYRI KART
    // TİPİYDİ; tip kalkınca ayrım kayb olmasın diye buraya taşındı. Kullanıcı
    // "bu kart geometri olsun" diyebiliyor ve ne demek olduğunu tek tıkla
    // görebiliyor — sekiz kutucuğu tek tek gezmeden.
    + '<div class="ve-fead-kat-islem onayar">';
  var acikOn = veFeadKatmanOnAyar(node);
  var elle = !!(node.data && node.data.kat);
  VE_FEAD_ON_AYARLAR.forEach(function(O){
    // AÇIK ÖN AYAR BASILI KALIR — ama yalnız elle değişiklik YOKKEN: kutucuk
    // oynatıldıktan sonra kart artık o ön ayar değil, ondan TÜREMİŞ bir küme.
    h += '<button type="button" title="' + _feadEsc(O.ip) + '"'
      + ((O.k === acikOn && !elle) ? ' class="is-acik"' : '')
      + ' onclick="veFeadKatmanIslem(\'' + _feadEsc(node.id) + '\',\'' + O.k + '\')">'
      + _feadEsc(O.t) + '</button>';
  });
  h += '</div><div class="ve-fead-kat-islem">';
  [['tumu','Tümü'], ['hicbiri','Hiçbiri']].forEach(function(o){
    h += '<button type="button" onclick="veFeadKatmanIslem(\'' + _feadEsc(node.id)
      + '\',\'' + o[0] + '\')">' + o[1] + '</button>';
  });
  h += '</div><div class="ve-fead-kat-liste">';
  VE_FEAD_KATMANLAR.forEach(function(K){
    // BAĞLI KATMAN kapalı gösterilmez, PASİF gösterilir: kaybolan bir satır
    // "burada bir ayar vardı" bilgisini de götürür.
    var pasif = !!(K.bagli && !kat[K.bagli]);
    // Bir katman açık ama o an ÇİZİLMİYORSA sebebi yanında yazılır; sessizce
    // hiçbir şey yapmayan bir kutucuk, kullanıcıya kendi seçimini sorgulatır.
    var uyari = (K.k === 'spanEt' && kat[K.k] && !tenVar) ? 'devir seçili değil' : '';
    h += '<label class="ve-fead-kat-sat' + (pasif ? ' pasif' : '') + '"'
      + ' title="' + _feadEsc(K.ip) + '">'
      + '<input type="checkbox"' + (kat[K.k] ? ' checked' : '') + (pasif ? ' disabled' : '')
      + ' onchange="veFeadKatmanSet(\'' + _feadEsc(node.id) + '\',\'' + K.k + '\',this.checked)">'
      + '<span class="ad">' + _feadEsc(K.t) + '</span>'
      + (uyari ? '<span class="uyari">' + _feadEsc(uyari) + '</span>' : '')
      + '</label>';
  });
  h += '</div><p class="ve-fead-kat-not">Bu seçim <b>yalnız bu karta</b> ait. '
    + 'Aynı modelden ikinci bir kart açıp başka katmanlar seçebilirsin.</p></div>';
  return h;
}

function veFeadPosPicker(node, build, mode, rpmSel, vibSel, vibModes, katDugme){
  var rows = (build && build.ok) ? veFeadPositionRows(build) : [];
  var cozulen = {};
  rows.forEach(function(r){ if(r.ok) cozulen[r.key] = r; });

  // KISA AD (`kisa`: Mean · Maks · Serbest…), çizimin hayalet etiketleriyle
  // aynı dil. Tam ad ("Çalışma (Mean)") çubuğun seçicisine sığmıyordu —
  // ölçüldü, 105 px isterken 51 px alıyordu — ve çizimin sol üst künyesinde
  // zaten tam hâliyle yazılı; seçeneğin ipucunda da duruyor.
  var opts = '';
  VE_FEAD_POSITIONS.forEach(function(P){
    var r = cozulen[P.key];
    if(!r && P.key !== 'mean') return;              // çözülemeyen konum listede yok
    opts += '<option value="' + P.key + '" title="' + _feadEsc(P.label) + '"' + (mode === P.key ? ' selected' : '') + '>'
          + _feadEsc(P.kisa || P.label) + (r ? ' · ' + _feadFmt(r.relDeg, 1) + '°' : '') + '</option>';
  });
  var cok = Object.keys(cozulen).length > 1;
  opts += '<option value="all" title="Tümü — üst üste"' + (mode === 'all' ? ' selected' : '') + '>'
        + 'Tümü' + (cok ? '' : ' (tek konum)') + '</option>';

  // ── DEVİR (animasyon) — duty tablosundan ──────────────────────────────────
  // AYNI SATIRDA duruyor, ikinci bir şerit açılmıyor: kartın 340 px'inden her
  // şerit 22 px alıyor ve o piksel çizimden gidiyordu (ölçüldü: iki şeritle
  // şema 276 px'e düşüyor, alternatör dairesi 13 px'in altına iniyor).
  var rpm = (rpmSel === undefined) ? veFeadAnimRpmOf(build, node) : rpmSel;
  // SENARYO ilk sırada, Durgun'un hemen ardında: "kart ne gösteriyor"
  // sorusunun cevabı tek seçicide kalsın (ikinci bir şerit 22 px demekti).
  var rOpt = '<option value="off"' + (rpm === 'off' ? ' selected' : '') + '>Durgun</option>'
           + '<option value="scn" title="Senaryo — motor çevrimi"' + (rpm === 'scn' ? ' selected' : '') + '>Senaryo</option>';
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
  // ÇIRPMA KAYIŞ VERİSİNE BAĞLI: frekansı katalog birim kütlesinden gelir.
  // Kapalıyken seçenek DURUR ama seçilemez ve sebebini söyler — kaybolsaydı
  // kullanıcı neden olmadığını bilemezdi.
  var _cirpAcik = (typeof veFeadBeltDataOn === 'function') ? veFeadBeltDataOn(build) : true;
  var vOpt = '<option value="off"' + (vSel === 'off' ? ' selected' : '') + '>Kapalı</option>'
           + '<option value="span"' + (vSel === 'span' ? ' selected' : '')
           + (_cirpAcik ? '' : ' disabled') + '>Çırpma'
           + (!_cirpAcik ? ' (kayış verisi kapalı)' : (rpm === 'off' ? ' (devir seç)' : '')) + '</option>';
  (vibModes || []).forEach(function(f, i){
    var k = 'mode:' + i;
    vOpt += '<option value="' + k + '"' + (vSel === k ? ' selected' : '') + '>'
          + 'Mod ' + (i+1) + ' — ' + _feadFmt(f, 1) + ' Hz</option>';
  });

  // ── TEK YÜZEN ÇUBUK — İKİ BANT DEĞİL ─────────────────────────────────────
  // Dört denetim bir dönem İKİ YATAY BANTTA duruyordu (44 px) ve o piksel
  // çizimden gidiyordu. Çubuk artık çizimin üstünde yüzüyor: bant 0 px.
  //
  // `<select>` KALIYOR, düğmeye ÇEVRİLMİYOR. Kayış Tablosu'nda iki seçenekli
  // bir liste iki durumlu segmente çevrildi çünkü ikisi de tek bakışta
  // sığıyordu; buradaki listeler ONDAN FARKLI — kol konumu çözülen konum
  // sayısı kadar, devir çalışma çevriminin noktaları kadar, titreşim burulma
  // modu kadar seçenek taşıyor ve hepsi yanında SAYISIYLA geliyor. Elle
  // çizilmiş bir açılır liste bunların hepsini yeniden yazmak, klavye
  // gezinimini ve ekran okuyucuyu da yeniden kurmak demekti. Görünüm CSS'te
  // (`appearance:none` + çizilmiş oklu chevron), davranış tarayıcının.
  var alan = function(et, ipucu, anahtar, ic, genis){
    return '<label class="ve-fead-yuz-dnt' + (genis ? ' genis' : '') + '"'
      + (ipucu ? ' title="' + _feadEsc(ipucu) + '"' : '') + '>'
      + '<i>' + _feadEsc(et) + '</i>'
      + '<select onmousedown="event.stopPropagation();"'
      + ' onchange="veFeadSetChoice(\'' + node.id + '\',\'' + anahtar + '\',this.value)">'
      + ic + '</select></label>';
  };
  return '<div class="ve-fead-yuz" onmousedown="event.stopPropagation();"'
    + ' ondblclick="event.stopPropagation();" onwheel="event.stopPropagation();">'
    + alan('Kol', 'Gergi kolunun hangi konumu çiziliyor', 'posMode', opts)
    + alan('Devir', 'Animasyon devri — çalışma çevriminden', 'animRpm', rOpt, 1)
    + alan('Titr', 'Açıklık çırpması ya da burulma mod şekli', 'vibMode', vOpt)
    + (katDugme || '') + veFeadTabloDugmeHTML() + '</div>';
}

// "TABLO" DÜĞMESİ — Kayış Tablosu çekmecesinin kanvastaki tek kapısı (tablo
// kanvastan indi, 2026-09-23). Basılı hâli pencerenin açık olduğunu söyler.
var VE_FEAD_TBL_ICON =
  '<svg class="ac" width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"'
  + ' fill="none" stroke="currentColor" stroke-width="1.1">'
  + '<rect x="1.4" y="1.9" width="9.2" height="8.2" rx="1"/>'
  + '<path d="M1.4 4.6h9.2M1.4 7.3h9.2M4.6 4.6v5.5"/></svg>';
function veFeadTabloDugmeHTML(){
  var acik = veFeadTabloAcikMi();
  return '<button type="button" class="ve-fead-kat-dugme ve-fead-tablo-dugme' + (acik ? ' is-acik' : '') + '"'
    + ' aria-pressed="' + (acik ? 'true' : 'false') + '"'
    + ' onmousedown="event.stopPropagation();" onclick="veFeadTabloToggle()"'
    + ' title="Kayış Tablosu — Gates Layout Data: sayıları topluca gir (Esc kapatır)">'
    + VE_FEAD_TBL_ICON + '<span class="ad">Tablo</span></button>';
}
function _feadTabloDugmeEsitle(){
  if(typeof document === 'undefined') return;
  var acik = veFeadTabloAcikMi();
  var d = document.querySelectorAll('.ve-fead-tablo-dugme');
  for(var i = 0; i < d.length; i++){
    d[i].classList.toggle('is-acik', acik);
    d[i].setAttribute('aria-pressed', acik ? 'true' : 'false');
  }
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
      ? ((typeof veFeadBeltDataOn === 'function' && !veFeadBeltDataOn(build))
          ? 'çırpma üretilmiyor — kayış tipine bağlı çıktılar kapalı (birim kütle katalogdan)'
          : 'çırpma için bir devir seçin')
      : 'burulma modeli çözülemedi — kasnak ataletleri ve gergi kolu ataleti eksik';
  } else if(vib.kind === 'mode'){
    not = 'mod ' + (vib.idx+1) + ' · ' + _feadFmt(vib.fHz, 1) + ' Hz gerçek · '
        + 'şekil ölçeği ' + _feadFmt(vib.topDeg, 0) + '° · zaman tabanı YOK';
  } else if(vib.live){
    not = 'senaryo boyunca CANLI — frekans ve genlik o andaki gerginlikten';
  } else {
    not = _feadFmt(vib.firingHz, 0) + ' Hz ateşleme · en çok savrulan ×'
        + _feadFmt(Math.max.apply(null, vib.spans.map(function(x){ return x.mag; })), 1)
        + (vib.maxMode > 1 ? ' (mod ' + vib.maxMode + ')' : '')
        + (vib.anyFlutter ? ' · ÇIRPINMA' : '')
        + (vib.extraSlow > 1.01 ? ' · ek ağır çekim ×1/' + Math.round(vib.extraSlow) : '');
  }
  // ── SÖNÜM KAYDIRICISI — genliğin yanında, aynı sebeple ──────────────────
  // ζ göreli genlikleri TEK BAŞINA belirliyor (tepe büyütmesi 1/(2ζ)) ve
  // ölçülmüş bir sayı değil. Koda gömülü kalsaydı ekrandaki genlik farkının
  // uydurulmuş bir sabitten geldiği görünmezdi. Görünür bir ayar olması,
  // sayının ölçülmemiş olduğunu da görünür kılıyor.
  var z = veFeadVibZetaOf(node);
  var zSlider = (vib && vib.kind === 'span')
    ? '<span style="' + etiket + '" title="Sönüm oranı — ÖLÇÜLMÜŞ değil. Tepe büyütmesi 1/(2ζ).">'
      + 'ζ ' + _feadFmt(z, 2) + '</span>'
      + '<input type="range" min="' + Math.round(VE_FEAD_VIB_ZETA_MIN*100) + '" max="'
      + Math.round(VE_FEAD_VIB_ZETA_MAX*100) + '" step="1"'
      + ' value="' + Math.round(z*100) + '" onmousedown="event.stopPropagation();"'
      + ' oninput="veFeadSetChoice(\'' + node.id + '\',\'vibZeta\',this.value/100)"'
      + ' style="flex:0 0 60px; height:14px; accent-color:var(--accent-warning);">'
    : '';
  // YÜZEN ŞERİT, BANT DEĞİL: denetim çubuğunun hemen ÜSTÜNDE beliriyor ve
  // çizimden yükseklik almıyor. Şeridin varlık sebebi değişmedi — genlik
  // ÖLÇÜLMÜŞ DEĞİL ve kaydırıcı tam olarak bunu görünür kılmak için var.
  return '<div class="ve-fead-yuz-vib"'
    + ' onmousedown="event.stopPropagation();" ondblclick="event.stopPropagation();">'
    + '<span style="' + etiket + '" title="Genlik ÖLÇÜLMÜŞ değil — ilan edilmiş gösterim kazancı">'
    + 'Genlik ×' + _feadFmt(g, 0) + '</span>'
    + '<input type="range" min="' + VE_FEAD_VIB_GAIN_MIN + '" max="' + VE_FEAD_VIB_GAIN_MAX + '" step="1"'
    + ' value="' + g + '" onmousedown="event.stopPropagation();"'
    + ' oninput="veFeadSetChoice(\'' + node.id + '\',\'vibGain\',+this.value)"'
    + ' style="flex:0 0 72px; height:14px; accent-color:var(--accent-warning);">'
    + zSlider
    + '<span style="' + etiket + ' overflow:hidden; text-overflow:ellipsis;">'
    + _feadEsc(not) + '</span></div>';
}

// Animasyon künyesi — kartın sol üstünde, konum künyesinin altında.
// AĞIR ÇEKİM KATSAYISI YAZILI: ekranda görülen hız gerçek hız DEĞİL (gerçek
// zamanda 60 Hz ekranda strob oluyor, bkz. fead-model.js), oranlar ise birebir.
// Katsayı gizlenseydi kullanıcı ekrandan devir okumaya kalkardı.
//
// TEK SATIR (kullanıcı isteği): kinematik ile titreşim künyesi ayrı satırlarda
// değil, aynı satırda ' · ' ile birleşiyor — künye üç satırdan ikiye iniyor
// (konum satırı + bu satır). BİRLEŞTİRME METNİ KISALTIR, DAMGAYI KALDIRMAZ:
// 'ağır çekim' katsayısı ve 'KALİBRE DEĞİL' damgası satırda duruyor, çünkü
// ikisi de sonucun geçerlilik sınırı (kural 8) — atılsalardı ekrandan devir ve
// genlik okunmaya kalkılırdı. Senaryo dalı iki satır kalır: oradaki metin tek
// satıra sığmıyor (ölçüldü, ~145 karakter; kartta tavan ~95).
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
      // ANKRAJ GERİLMESİ YAZILI: frekans √T ile ölçekleniyor, yani hangi
      // gerilmede çırptığı yazılmazsa sayı yorumlanamaz. Kartın konum künyesi
      // aynı sayıyı basıyor — ikisinin eşleştiği görülsün diye burada da var.
      : 'çırpma ' + _feadFmt(Math.min.apply(null, vib.spans.map(function(x){ return x.f; })), 0)
        + '–' + _feadFmt(Math.max.apply(null, vib.spans.map(function(x){ return x.f; })), 0)
        + ' Hz @ ' + Math.round(vib.anchorN) + ' N'
        + (vib.maxMode > 1 ? '  ·  mod 1–' + vib.maxMode : '  ·  mod 1')
        + '  ·  ζ ' + _feadFmt(vib.zeta, 2) + ' ×' + _feadFmt(vib.gain, 0)
        + ' (KALİBRE DEĞİL)';
  }
  if(!kin) return alt;
  var kat = (kin.slow >= 0.999) ? 'gerçek zaman'
          : '×1/' + Math.round(1/kin.slow) + ' ağır çekim';
  return Math.round(kin.engineRpm) + ' dev/dk' + (fallback ? ' (varsayılan)' : '')
       + '  ·  kayış ' + _feadFmt(kin.beltMs, 1) + ' m/s  ·  ' + kat
       + (alt ? '  ·  ' + alt : '');
}

// Durum şeridi — "tutarlı mı" sorusunun tek satırlık cevabı.
// Sarım değişmezi (Σkaburgalı − Σsırttan = 360°) burada duruyor çünkü kapalı
// bir kayış çevriminin geometrik ZORUNLULUĞU o; tutmuyorsa şema kendi içinde
// tutarlı görünse bile yol yanlış çözülmüş demektir.
function veFeadLayoutCardStrip(build, mode){
  // Hüküm TEK YERDEN (veFeadYolDurumu): sürükleme kapısı da aynısını soruyor.
  var yd = veFeadYolDurumu(build, mode);
  var ok = yd.ok, sol = yd.sol, sag = yd.sag;
  // SÜRÜKLEME REDDİ görünür: kasnak neden orada durdu, kartın kendisi söyler.
  if(VE_FEAD_SURUKLE && VE_FEAD_SURUKLE.red){
    ok = false; sag = '';
    sol = 'Buraya taşınamaz — ' + VE_FEAD_SURUKLE.red;
  }
  // ── ALT BANT DEĞİL, SAĞ ÜST ROZET ───────────────────────────────────────
  // Şerit 20 px'i çizimden alıyordu ve o 20 px'in taşıdığı şey ÇOĞU ZAMAN
  // "her şey yolunda"dan ibaretti. Rozet çizimin üstünde yüzüyor (bant 0 px).
  //
  // BİRİNCİL OKUMA DURUMA GÖRE DEĞİŞİR. Yolunda olan hâlde birincil metin TEK
  // SAYI (Σsarım), kasnak sayısı ve boy ikincil; yolunda OLMAYAN hâlde
  // birincil metin ARIZANIN CÜMLESİ ve ikincil metin hiç yok. Ters olsaydı
  // "Kayış yolu kapanmadı" bir onay işaretinin yanında ikinci sınıf bir not
  // olarak dururdu.
  //
  // İKİ OKUMA DA KAYBOLMUYOR: `title` her hâlde tamamını taşıyor.
  return '<div class="ve-fead-kan-durum ' + (ok ? 'ok' : 'no') + '"'
    + ' title="' + _feadEsc(sol + (sag ? ' · ' + sag : '')) + '">'
    + '<b>' + (ok ? '✓' : '✗') + '</b>'
    + '<span>' + _feadEsc(ok ? (sag || sol) : sol) + '</span>'
    + (ok && sag ? '<i>' + _feadEsc(sol) + '</i>' : '') + '</div>';
}

// Tuvaldeki BÜTÜN Kayış Yolu kartlarını tazele. Girdi değişince çağrılır
// (setter'lar + saveState); iç topolojide Kayış Yolu düğümü yoksa hiçbir şey
// yapmaz, yani ana tuvalde ve diğer modüllerde bedava.
function veFeadRefreshLayoutCards(){
  if(typeof document === 'undefined' || typeof nodes === 'undefined') return 0;
  var n = 0;
  nodes.forEach(function(x){
    var d = _feadDefOf(x);
    if(!d.isFeadLayout) return;                      // tek kart tipi
    var el = document.getElementById(x.id);
    if(el && veFeadApplyLayoutCard(el, x)) n++;
  });
  return n;
}

// ════════════════════════════════════════════════════════════════════════════
//  KAYIŞ TABLOSU — kasnakların VERİ GİRİŞ yüzeyi
// ════════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-09-09): *"Topolojiye çektiğimiz bileşenlere tıklayıp
// özelliklerini değiştirmek, değerlerini girmek yerine böyle bir tablomuz
// olacak, oradan değerleri gireceğiz. Gerekirse de tıklayarak bileşen
// penceresini açarak detay hesaplamalara bakacağız."*
//
// Sütunlar mühendisin kendi hesap sayfasından birebir: KASNAK · X(mm) · Y(mm) ·
// Efektif Çap(mm) · D(mm) · Kasnak Dönüş Yönü · Sarım Açısı(°) · Span
// Uzunluğu(mm) · Kayış Uzunluğu(mm). GİRDİ ile TÜRETİLEN aynı satırda yan yana
// duruyor ve bu bilerek: bir koordinatı değiştirince sarımın ve span'in ne
// olduğu aynı bakışta görülüyor.
//
// TÜRETİLEN SÜTUNLARIN HİÇBİRİ BURADA HESAPLANMAZ. Efektif çap çekirdeğin
// rPitch'i (kaburgalıda OD+2·hb, sırtta OD+2·hr), dönüş yönü çekirdeğin süpürme
// işareti `d`, sarım ve span geom'un kendi okuyucuları. Sunum katmanının kendi
// geometrisini hesaplamaması modülün üç katman kuralı; ikinci bir formül
// yazmak, profil sabiti değiştiğinde tablonun kartla sessizce ayrışması demekti.

// SAF: build → satırlar. DOM'a dokunmaz, testin baktığı yer burası.
//
// GİRDİ SÜTUNLARI GEOMETRİDEN BAĞIMSIZ DOLDURULUR. Tablo bir rapor değil, veri
// giriş yüzeyi: model çözülemediğinde de ad/X/Y/D okunabilir olmalı, yoksa
// kullanıcı düzeltmek istediği sayıyı göremezdi. Türetilenler o hâlde boş kalır.
function veFeadTableRows(build){
  var out = { rows: [], ok: false, LpitchMm: NaN, LeffMm: NaN,
              signedWrapDeg: NaN, posLabel: '', sense: 0,
              sumWrapDeg: NaN, sumSpanMm: NaN };
  var order = (build && build.order) ? build.order : [];
  order.forEach(function(n, i){
    var d = n.data || {};
    // GERGİNİN KOORDİNATI cenX/cenY (avara merkezi girdi, montaj konumu çıktı —
    // bkz. fead-model.js). Burada x/y okunsaydı gergi satırı BOŞ görünür,
    // kullanıcı da olmayan bir alana yazmaya çalışırdı.
    var ten = !!_feadDefOf(n).isFeadTensioner;
    out.rows.push({
      id: n.id, index: i + 1, name: _feadNodeName(n), type: n.type,
      tensioner: ten, driver: !!d.driver,
      xKey: ten ? 'cenX' : 'x', yKey: ten ? 'cenY' : 'y',
      xMm: _feadNum(ten ? d.cenX : d.x, NaN),
      yMm: _feadNum(ten ? d.cenY : d.y, NaN),
      odMm: _feadNum(d.od, NaN),
      contact: (typeof veFeadContactOf === 'function') ? veFeadContactOf(n) : 'grooved',
      effDiaMm: NaN, spin: '', wrapDeg: NaN, spanMm: NaN
    });
  });
  if(!out.rows.length) return out;

  var geom = null, sel = null;
  try {
    // Tablo ŞEMAYLA AYNI kol konumunu anlatır (veFeadGeometryTable'daki kuralın
    // aynısı): ikisi ayrışsa kullanıcı bir konumun çizimine bakıp başka bir
    // konumun sayılarını okurdu.
    sel = (typeof veFeadPosSelection === 'function')
      ? veFeadPosSelection(build, 'mean') : null;
    var rel = (sel && sel.primary && Number.isFinite(sel.primary.relDeg))
      ? sel.primary.relDeg : FEADCore.meanRel(build.sys);
    geom = FEADCore.tensionerState(build.sys, rel).geom;
  } catch(e){ return out; }
  if(!geom) return out;

  out.rows.forEach(function(r, i){
    var p = geom.pulleys[i];
    if(!p) return;
    r.effDiaMm = p.rPitch * 2;
    // DÖNÜŞ YÖNÜ: kartın kasnak içi okuyla AYNI ifade (`cw = p.d > 0`,
    // veFeadLayoutSVG). Ayrı bir kural yazmak iki yüzeyde ters ok demekti.
    r.spin = (p.d > 0) ? 'Sağ' : 'Sol';
    r.wrapDeg = geom.wrapDeg(i);
    r.spanMm = geom.exitSpanLen(i);
  });
  // SÜTUN TOPLAMLARI — defterdeki SUM satırının karşılığı ve hepsi bu kadar:
  // gösterilen hücrelerin toplamı, kullanıcı sütunu seçince aldığı sayının
  // aynısı. Yeni bir büyüklük TÜRETİLMİYOR (üç katman kuralı: sunum kendi
  // geometrisini hesaplamaz) — toplananların her biri çekirdeğin çıktısı.
  out.sumWrapDeg = out.rows.reduce(function(a, r){
    return a + (Number.isFinite(r.wrapDeg) ? r.wrapDeg : 0); }, 0);
  out.sumSpanMm = out.rows.reduce(function(a, r){
    return a + (Number.isFinite(r.spanMm) ? r.spanMm : 0); }, 0);
  out.LpitchMm = geom.LpitchMm;
  out.LeffMm = geom.LeffMm;
  out.signedWrapDeg = geom.signedWrapDeg;
  out.posLabel = (sel && sel.primary) ? sel.primary.label : 'Mean';
  // ÇEVRİMİN SÜPÜRME İŞARETİ — "Dönüş Yönü" hücresi bunu ters çevirerek temas
  // tarafını yazıyor (fead-model.js → veFeadContactForSpin). Okunamıyorsa hücre
  // salt okunur kalır; uydurulmuş bir taraf sessizce başka bir yol çözdürürdü.
  out.sense = geom.sense || 0;
  out.ok = true;
  return out;
}

// ── SÜTUNLAR ───────────────────────────────────────────────────────────────
// Ölçü ve kimlik TEK YERDE: alan etiketleri, bölge genişlikleri ve kart
// genişliği aynı listeden besleniyor (VE_FEAD_TABLE_W bu toplamdan türer,
// bkz. components.js).
//
// `t` defterin adı, `u` BİRİMİ, `kt` kartta basılan KISA ad. Tam ad
// kaybolmuyor: alanın `title`ında yazılı.
//
// `coz` = DEĞER ÇÖZÜMDEN GELİR. Sütun SIRASI defterle birebir olmak zorunda
// (girdi ile türetilen iç içe: … Y · Efektif Çap · D …), yani bitişik bir
// "GİRDİ" bandı çizilemez — gruplamanın yolu sırayı değiştirmek olurdu.
// Bayrağın taşıyıcısı `yer`: bölge içindeki sıralama defterin sırası, bölgenin
// kendisi de "bu alanlar okunur, şunlar yazılır" diyor.
// ── BÖLGE (`yer`) — KART LİSTESİNİN TAŞIYICISI ─────────────────────────────
//
// Kullanıcı isteği (2026-09-21): *"tablo kısmı çok amatör durdu… farklı bir
// yapı, farklı bir düzen"* → üç tasarım yönü sunuldu, **Kart Listesi (C)**
// seçildi. Satır artık bir hücre dizisi değil bir KASNAK: solda kimlik,
// ortada elle girilenler, sağda çözücünün cevapladıkları.
//
// GİRDİ/ÇÖZÜM AYRIMININ TAŞIYICISI DEĞİŞTİ, KURALI DEĞİL. Eskiden `<col
// class="coz">` şeridiydi; şimdi BÖLGENİN KENDİSİ. Kural aynı kalıyor ve
// aynı şekilde kapılı: değeri çözümden gelen her alan `coz` bölgesinde (ya da
// çevrimin tamamına ait olan `kayis` gibi ÖZET şeridinde), elle girilen hiçbir
// alan orada DEĞİL. Sabit bir liste değil — yeni bir türetilen sütun sessizce
// girdi bölgesine düşemez.
//
// SIRA DEFTERLE BİREBİR KALIYOR: bölge içindeki sıralama bu dizinin sırası,
// yani Gates raporunun "Layout Data" sütun sırası. Bölgeler o sırayı bölmüyor,
// gruplandırıyor.
//
// `kt` KISA AD: kart okuması için. Tam ad (defterin adı) kaybolmuyor —
// alanın `title`ında yazılı ve kapı bunu tutuyor.
var VE_FEAD_TABLE_COLS = [
  { k:'no',    t:'#',                  u:'',   w:54,  al:'c', yer:'kim' },
  { k:'ad',    t:'KASNAK',             u:'',   w:172, al:'l', yer:'kim' },
  { k:'x',     t:'X',                  u:'mm', w:64,  al:'r', yer:'gir' },
  { k:'y',     t:'Y',                  u:'mm', w:64,  al:'r', yer:'gir' },
  { k:'eff',   t:'Efektif Çap',        u:'mm', w:78,  al:'r', coz:1, yer:'coz', kt:'Ø eff' },
  { k:'od',    t:'D',                  u:'mm', w:64,  al:'r', yer:'gir' },
  { k:'yon',   t:'Kasnak Dönüş Yönü',  u:'',   w:86,  al:'c', yer:'gir', kt:'Yön' },
  { k:'sar',   t:'Sarım Açısı',        u:'°',  w:74,  al:'r', coz:1, yer:'coz', kt:'Sarım' },
  { k:'span',  t:'Span Uzunluğu',      u:'mm', w:82,  al:'r', coz:1, yer:'coz', kt:'Span' },
  // BİRLEŞİK HÜCRE: kayış boyu satır başına değil, ÇEVRİMİN TAMAMINA ait
  // (defterde de öyle — K5:K10 birleştirilmiş ve tek formül: =SUM(AB47:AB52)).
  { k:'kayis', t:'Kayış Uzunluğu',     u:'mm', w:88,  al:'c', coz:1, yer:'ozet',
    kt:'Kayış boyu' },
  // SİLME KENDİ SÜTUNUNDA. Sıra oklarıyla aynı hücrede dururken (indis + ▲▼ +
  // ✕, 70 px, 9 px yazı) sık yapılan işlem ile geri dönüşü olmayan işlem
  // bitişikti — satır taşırken kasnak silmek bir dikkat değil bir ÖLÇÜ
  // meselesiydi. Başlığı yok: sütun bir büyüklük taşımıyor.
  { k:'sil',   t:'',                   u:'',   w:30,  al:'c', yer:'son' }
];

// Bölgenin genişliği KENDİ SÜTUNLARININ toplamı — kart genişliği hâlâ sütun
// listesinden TÜRÜYOR, yuvarlak bir sayı değil.
// Bir bölgenin genişliği — sütun listesinden. `yer` verilmezse LİSTEDE yer
// kaplayan bütün bölgelerin toplamı (künyeye giden sütunlar sayılmaz).
function veFeadKartBolgeW(yer){
  var t = 0;
  VE_FEAD_TABLE_COLS.forEach(function(c){
    if(yer ? (c.yer === yer) : (c.yer !== 'ozet')) t += c.w;
  });
  return t;
}
function _feadKol(k){
  for(var i = 0; i < VE_FEAD_TABLE_COLS.length; i++)
    if(VE_FEAD_TABLE_COLS[i].k === k) return VE_FEAD_TABLE_COLS[i];
  return { k:k, t:k, u:'', al:'r' };
}

// Düzenlenebilir sayı ALANI (kartın girdi bölgesinde durur).
//
// İKİ ÖLÇÜLMÜŞ TUZAK, ikisi de gerçek tarayıcıda çıktı ve KART LİSTESİNDE DE
// geçerli:
//
// 1. MOUSEDOWN YUTULMALI — yoksa alana tıklamak düğümü SÜRÜKLEMEYE başlıyor ve
//    kullanıcı sayıyı hiç giremiyor.
// 2. `type="number"` DEĞİL, `text` + `inputmode="decimal"`. Sayı alanında
//    tarayıcı virgüllü girişi GEÇERSİZ sayıp `value`yu boşaltıyor: kullanıcı
//    "63,5" yazıyor, alan sessizce boşalıyor, model hiç değişmiyor ve hiçbir
//    uyarı çıkmıyor. Metin alanında değer olduğu gibi geliyor ve ayrıştırmayı
//    veFeadTableSet yapıyor (hem "63.5" hem "63,5" kabul).
function _feadTblIn(id, key, v){
  return '<input class="ve-fead-tbl-in" type="text" inputmode="decimal"'
    + ' value="' + (Number.isFinite(v) ? v : '') + '"'
    + ' onmousedown="event.stopPropagation();" ondblclick="event.stopPropagation();"'
    + ' onchange="veFeadTableSet(\'' + _feadEsc(id) + '\',\'' + key + '\',this.value)">';
}

// GİRDİ ALANI — etiket ÜSTTE, birim etiketin yanında.
//
// DÜĞME DOLU, ALAN BOŞ kuralı (bkz. modül skill'i 14) kart listesinde de
// aynen geçerli: alanın dinlenme hâlinde kutusu yok, yalnız yazılabileceğini
// söyleyen bir alt çizgisi var; ad DÜĞMESİ ise fare altında dolduğu için ikisi
// karışmıyor.
//
// TAM AD `title`DA. Kart okuması için kısa ad basılıyor ("Ø eff"), ama defterin
// adı ("Efektif Çap") kaybolmuyor — kapı bunu tutuyor.
function _feadKrtFld(kol, ic, ipucu){
  var tam = kol.t + (kol.u ? ' (' + kol.u + ')' : '');
  return '<label class="ve-fead-krt-fld" title="'
    + _feadEsc(ipucu ? tam + ' — ' + ipucu : tam) + '">'
    + '<i>' + _feadEsc(kol.kt || kol.t)
    + (kol.u ? '<span class="br">' + _feadEsc(kol.u) + '</span>' : '') + '</i>'
    + ic + '</label>';
}

// ── "KASNAK DÖNÜŞ YÖNÜ" DÜZENLENEBİLİR — VE `contact` ALANINI YAZAR ────────
//
// BMC'nin hesap defterinde bu sütun bir AÇILIR LİSTE girdisidir (Sağ/Sol,
// `Geometrik Entegrasyon` H5:H10 · veri doğrulama $D$169:$D$170) ve span'ler
// ondan türer. MFSim'de aynı fizik `contact` alanında; alan o alanı yazıyor,
// İKİNCİ bir yön alanı açmıyor (bkz. veFeadContactForSpin).
//
// Bu alan modülün EN TEHLİKELİ girdisinin üçüncü yüzeyi: temas tarafı ters
// verilirse çekirdek hata VERMEZ, geçerli ama BAŞKA bir güzergâh çözer. Bu
// yüzden görünür olması bir incelik değil kural — tip varsayılanı → panel →
// ve artık asıl veri giriş yüzeyi olan kart listesi.
//
// AÇILIR LİSTE DEĞİL İKİ DURUMLU SEGMENT (2026-09-21): iki seçenekli bir
// `<select>`, seçeneklerini göstermek için tıklanmayı gerektiriyordu — oysa
// ikisi de tek bakışta sığıyor. Tarayıcının kendi oku da kartın en çok göze
// batan parçasıydı (ekranda yedi tane vardı).
function _feadTblSpin(id, yon, sense){
  var kol = _feadKol('yon');
  if(!yon || !sense)
    return _feadKrtFld(kol, '<span class="ve-fead-krt-bos">—</span>',
                       'süpürme işareti okunamadı');
  var d = ['Sağ', 'Sol'].map(function(o){
    return '<button type="button" class="' + (o === yon ? 'on' : '') + '"'
      + ' onmousedown="event.stopPropagation();"'
      + ' onclick="veFeadTableSetSpin(\'' + _feadEsc(id) + '\',\'' + o + '\')">'
      + o + '</button>';
  }).join('');
  return _feadKrtFld(kol, '<span class="ve-fead-krt-seg" data-ve="spin">' + d + '</span>',
                     'kayışın o kasnağa hangi yüzünden değdiğini yazar');
}

// ÇÖZÜM OKUMASI — değeri çözücüden gelen alan. Girdi alanından BİÇİMİYLE
// ayrışıyor: yazılamaz, tek aralıklı, gömülü zeminin üstünde.
function _feadKrtRv(kol, v, dec){
  var bos = !(typeof v === 'string' ? v : Number.isFinite(v));
  var tam = kol.t + (kol.u ? ' (' + kol.u + ')' : '');
  return '<span class="ve-fead-krt-rv' + (bos ? ' bos' : '') + '"'
    + ' title="' + _feadEsc(tam + ' — çözümden gelir') + '">'
    + '<i>' + _feadEsc(kol.kt || kol.t)
    + (kol.u ? '<span class="br">' + _feadEsc(kol.u) + '</span>' : '') + '</i>'
    + '<b>' + (typeof v === 'string' ? _feadEsc(v)
               : (Number.isFinite(v) ? _feadFmt(v, dec) : '—')) + '</b></span>';
}

// "PENCERE AÇILIR" SİMGESİ — başlık şeritli küçük bir pencere.
//
// ÇİZİM, YAZI KARAKTERİ DEĞİL. `⧉` / `⤢` gibi bir glif konteynerin yazı
// tipinde olmayabilir ve eksik glif tam da anlatması gereken şeyi — burada bir
// pencere açıldığını — yok eder. `currentColor` düğmenin durumunu (dinlenme /
// fare / açık) kendiliğinden izliyor, yani ikinci bir renk kuralı yok.
var VE_FEAD_TBL_OPEN_ICON =
  '<svg class="ac" width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"'
  + ' fill="none" stroke="currentColor" stroke-width="1.2">'
  + '<rect x="1.4" y="2.4" width="9.2" height="7.2" rx="1.1"/>'
  + '<path d="M1.4 4.7h9.2"/></svg>';

// ── SEÇİLİ SATIR: TABLO İLE PANEL ARASINDAKİ TEK BAĞ ──────────────────────
//
// Kasnakların kanvasta kutusu yok, dolayısıyla `addToSelection`'ın kutuya
// eklediği `selected` sınıfı onlarda hiçbir şeye yazılmıyor
// (`getElementById` null döner). Paneli hangi kasnağın açtığı, işaret tabloda
// olmazsa HİÇBİR YERDE yazmıyor.
//
// KURAL TEK YERDE, çünkü iki okuyucusu var: kart yeniden kurulurken (aşağıda)
// ve seçim değişince DOM'da (veFeadMarkSelectedRow). İkisine ayrı ayrı
// yazılsaydı biri "tek düğüm seçili" derken öteki "ilk seçili düğüm" diyebilir
// ve işaret bir seçimde bir satırda, ötekinde başka satırda kalırdı.
function _feadSelectedId(){
  if(typeof selectedNodes === 'undefined' || !selectedNodes) return null;
  if(selectedNodes.length !== 1) return null;
  return (selectedNodes[0] && selectedNodes[0].id) || null;
}

// SEÇİM DEĞİŞİNCE KART YENİDEN KURULMAZ, yalnız sınıf eşitlenir.
//
// ÖLÇÜLDÜ (gerçek tarayıcı, AG00976): işaret doğru satıra konuyordu ama seçim
// değiştiğinde hiç tazelenmiyordu — kart yalnız MODEL değişince kuruluyor,
// oysa panel açmak modeli değiştirmiyor. Sonuç, işaretin olmamasından KÖTÜ:
// tabloda bir satır işaretli duruyordu ve o satır paneli açık olan kasnak
// DEĞİLDİ (yüklemenin son kurduğu kasnakta kalmıştı).
//
// Tam yeniden kurmak da yanlış olurdu: tablo o anda düzenlenen hücreyi ve
// odağı kaybederdi. Sınıfı yerinde eşitlemek her ikisini de korur.
function veFeadMarkSelectedRow(){
  if(typeof document === 'undefined') return 0;
  var acik = _feadSelectedId(), n = 0;
  var satirlar = document.querySelectorAll('.' + VE_FEAD_TABLE_CLASS
    + ' .ve-fead-krt[data-ve-node]');
  for(var i = 0; i < satirlar.length; i++){
    var tr = satirlar[i];
    var ok = !!acik && tr.getAttribute('data-ve-node') === acik;
    if(ok !== tr.classList.contains('is-sel')){
      if(ok) tr.classList.add('is-sel'); else tr.classList.remove('is-sel');
      n++;
    }
  }
  // ÇİZİMLER DE AYNI SEÇİMİ GÖSTERİR (Çizim Masası) — aynı kapıdan, kart
  // kurulmadan.
  veFeadCizimIsaretle();
  return n;
}

// Kartın içeriği — AYRI ve SAF(ça), Kayış Yolu kartındaki kuralın aynısı.
//
// GÖRÜNÜM CSS'TE (css/styles.css → `.ve-fead-tbl*`), burada DEĞİL. Kart bir
// zamanlar baştan sona satır içi `style="…"` diziyordu ve o taşıyıcı DURUM
// İFADE EDEMİYOR: `:hover`, `:focus`, `:nth-child` yazılamadığı için fare
// hangi satırdaysa, imleç hangi hücredeyse, hangi kasnağın paneli açıksa —
// üçü de görünmüyordu. Kullanıcının "demode ve ilkel" dediği şey bir renk
// tercihi değil, tam olarak buydu.
// PENCERE KİPİNDE BAŞLIK SATIRI — etiketler BİR KEZ. Satırla AYNI ızgara ve
// aynı bölgeler (sıra okları bile görünmez hâlde duruyor), dolayısıyla
// sütunlar hizalı; satırların kendi etiketleri pencerede CSS'le gizlenir.
function _feadTabloBasSatiri(){
  function et(kol){
    return '<i>' + _feadEsc(kol.kt || kol.t)
      + (kol.u ? '<span class="br">' + _feadEsc(kol.u) + '</span>' : '') + '</i>';
  }
  function hucre(k, sinif){
    var kol = _feadKol(k);
    return '<span class="' + sinif + '" title="' + _feadEsc(kol.t + (kol.u ? ' (' + kol.u + ')' : ''))
      + '">' + et(kol) + '</span>';
  }
  var ok = '<button type="button" class="ve-fead-tbl-mv" tabindex="-1" disabled>▲</button>';
  return '<div class="ve-fead-krt ve-fead-krt--bas" aria-hidden="true">'
    + '<div class="kim"><span class="ve-fead-tbl-ord"><b>#</b>' + ok + ok + '</span>'
    + '<span class="bas-ad">Kasnak</span></div>'
    + '<div class="gir">' + ['x', 'y', 'od', 'yon'].map(function(k){
        return hucre(k, 've-fead-krt-fld'); }).join('') + '</div>'
    + '<div class="coz">' + ['eff', 'sar', 'span'].map(function(k){
        return hucre(k, 've-fead-krt-rv'); }).join('') + '</div>'
    + '<span></span></div>';
}

function veFeadTableCardHTML(node, opt){
  var build = (typeof veFeadBuildFromCanvas === 'function') ? veFeadBuildFromCanvas() : null;
  var T = veFeadTableRows(build);
  var belt = (build && build.cfg && build.cfg.belt) ? build.cfg.belt : {};
  var acik = _feadSelectedId();

  // ── ÜST KÜNYE: kayışın kendisi + çevrimin tamamına ait sayılar ───────────
  // Kayış tipi/markası burada SALT OKUNUR: kaynağı "Kayış Özellikleri"
  // bileşeni ve orada katalog seçicisiyle birlikte duruyor. İkinci bir giriş
  // açmak, katalog kapısını atlayan bir yol açardı.
  // KÜNYE ALANI. Kısa ad görünür, DEFTERİN TAM ADI `title`da: kart okuması
  // için "Kayış boyu" yeterli ama raporla satır satır karşılaştıran için
  // sütunun defterdeki adı ("Kayış Uzunluğu") kaybolmamalı.
  var kunye = function(et, dg, vurgu, ipucu){
    return '<span class="ve-fead-tbl-kunye"'
      + (ipucu ? ' title="' + _feadEsc(ipucu) + '"' : '')
      + '><span>' + _feadEsc(et) + '</span>'
      + '<b' + (vurgu ? ' class="acc"' : '') + '>' + _feadEsc(dg) + '</b></span>';
  };

  // ÇEVRİM DENETİMİ BURADA, kartın ALTINDA DEĞİL. Eski alt şerit dört sayıyı
  // kısaltmalarla diziyordu (`Σsarım …° (|Σ| 360 olmalı) · L_pitch … ·
  // L_eff …`) ve okunması için üçünün de ne olduğunu bilmek gerekiyordu.
  // Oysa listenin tek EVET/HAYIR sorusu var — kayış yolu kapandı mı — ve
  // cevabı künyenin yanına, okunur Türkçeyle yazılıyor.
  var okmu = T.ok && Math.abs(Math.abs(T.signedWrapDeg) - 360) <= 0.05;
  var kayisKol = _feadKol('kayis');
  var h = '<div class="ve-fead-tbl-head">'
    + kunye('Kayış', belt.profile || '—', 1)
    + kunye('Marka', belt.brand || '—', 1)
    + kunye('Kasnak', String(T.rows.length))
    + kunye('Efektif boy',
            Number.isFinite(T.LeffMm) ? _feadFmt(T.LeffMm, 1) + ' mm' : '—')
    // KAYIŞ BOYU SATIRA DEĞİL ÇEVRİME AİT (defterde de öyle — K5:K10
    // birleştirilmiş ve tek formül). Tabloda bütün satırları saran tek hücre
    // olarak duruyordu ve beş satır boyu bir dikdörtgenin ortasında tek bir
    // sayı taşıyordu; künyeye geçince hem o boşluk kalkıyor hem de değerin
    // çevrimin tamamına ait olduğu doğrudan söylenmiş oluyor.
    + kunye(kayisKol.kt, Number.isFinite(T.LpitchMm)
            ? _feadFmt(T.LpitchMm, 1) + ' mm' : '—', 0,
            kayisKol.t + ' (' + kayisKol.u + ') — çevrimin tamamına ait'
            + ' (Σspan + Σyay), satıra değil')
    // Σ TOPLAM: defterdeki SUM'ların karşılığı — gösterilen iki büyüklüğün
    // toplamı, fazlası değil. Bir DENETİM olarak sunulmuyor (kayış boyu zaten
    // bunlardan türüyor); asıl denetim sağdaki ve o gerçekten düşebilir.
    + (T.rows.length ? kunye('Σ toplam',
        (Number.isFinite(T.sumWrapDeg) ? _feadFmt(T.sumWrapDeg, 1) + '°' : '—')
        + ' · ' + (Number.isFinite(T.sumSpanMm) ? _feadFmt(T.sumSpanMm, 1) + ' mm' : '—')) : '')
    + '<span class="ve-fead-tbl-durum ' + (okmu ? 'ok' : 'no') + '"'
    + ' title="Kapalı çevrimde işaretli sarımların toplamı |Σ| 360 olmalı;'
    + ' sapma kayışın yolunun kapanmadığını söyler">'
    + '<b>' + (okmu ? '✓' : '✗') + '</b>'
    + '<span>' + (okmu ? 'Çevrim kapalı' : 'Çevrim AÇIK') + ' · Σsarım '
    + (Number.isFinite(T.signedWrapDeg) ? _feadFmt(T.signedWrapDeg, 1) : '—')
    + '°</span>'
    + (T.posLabel ? '<i>' + _feadEsc(T.posLabel) + ' konumu</i>' : '')
    + '</span>'
    // GERGİNİN YERİ HÜKMÜ — SIRANIN DÜZENLENDİĞİ YÜZEYDE. `tensionerOrder`
    // köprüde zaten hesaplanıyor (kural 16) ama yalnız uyarı kutularında ve
    // sihirbazın 2. adımında basılıyordu; sırayı ▲▼ ile değiştiren kullanıcı
    // listeye bakıyor ve hükmü orada göremiyordu. YALNIZ KURAL KIRIKKEN
    // basılıyor: kural yerindeyken ek bir çip künye şeridini ikinci satıra
    // sarardı ve kartın en küçük yüksekliği onu hesaba katmıyor.
    + (function(){
        var to = build && build.tensionerOrder;
        if(!to || to.last) return '';
        return '<span class="ve-fead-tbl-durum no"'
          + ' title="Gerilme zinciri gergiye ankrajlanır ve listede ileri yürür:'
          + ' gergiden sonraki ilk kasnak sürücü DEĞİLSE açıklıklar ankrajın'
          + ' altına iner. Sıra sürücüyle başladığına göre gergi SON SATIR olmalı.">'
          + '<b>✗</b><span>Gergi sonda değil · ' + (to.index + 1) + '/' + to.count
          + '</span></span>';
      }())
    + '</div>';

  // ── KASNAK LİSTESİ ───────────────────────────────────────────────────────
  // Izgara değil kart: her satır bir KASNAK ve üç bölgesi var — kimlik,
  // elle girilenler, çözümün cevapladıkları. Ayrım artık bir zemin tonu değil
  // yerleşimin kendisi.
  // BÖLGE GENİŞLİKLERİ VERİ OLARAK GEÇİYOR — `<colgroup>` genişliklerinin
  // yerini alan şey. CSS'te ikinci bir sayı tutulmuyor (yazılmazsa `auto`).
  h += '<div class="ve-fead-krt-wrap" onmousedown="event.stopPropagation();"'
    // ÇÖZÜM BÖLGESİNİN GENİŞLİĞİ AYRICA YAZILMAZ: o bölge `1fr` (ARTAN NE
    // İSE O). Yazılsaydı CSS'te kullanılmayan bir sayı dolaşırdı ve bir
    // sonraki okuyan onu kaynak sanardı.
    //
    // AMA TOPLAM YAZILIR (`--fead-krt-en`) ve bu ölü veri DEĞİL: kartı
    // EKRAN DIŞINDA yerleştiren tek okuyucu var — kılavuzun sahne
    // ölçekleyicisi (`guide-kit.js` → `_gkNaturalWidth`). O, ızgara
    // döneminde genişliği `<colgroup>`tan topluyordu; kart listesinde
    // toplanacak sütun yok ve bölgeleri toplamak ÇÖZÜM BÖLGESİNİ
    // ATLIYOR (ölçüldü: 768 yerine 534, yani 234 px eksik — sahne
    // sığmadığı hâlde "sığıyor" sayılırdı ve baskıda sağdan kırpılırdı).
    + ' style="--fead-krt-kim:' + veFeadKartBolgeW('kim') + 'px;'
    + ' --fead-krt-gir:' + veFeadKartBolgeW('gir') + 'px;'
    + ' --fead-krt-son:' + veFeadKartBolgeW('son') + 'px;'
    + ' --fead-krt-en:' + veFeadKartBolgeW() + 'px;">';
  if(opt && opt.pencere && T.rows.length) h += _feadTabloBasSatiri();

  if(!T.rows.length){
    // BAYAT TAVSİYE DEĞİL. Burada bir zamanlar "sol paletten ekleyin" yazıyordu
    // ve o yol kutular kalktığından beri SESSİZ: paletten sürüklenen kasnak
    // kanvasta hiçbir iz bırakmıyor, kullanıcı bir şey olmadığını sanıyor.
    h += '<div class="ve-fead-tbl-empty">'
      + '<b>Kayış yolunda henüz kasnak yok.</b>'
      + 'Aşağıdaki <b style="display:inline;">＋ Kasnak ekle</b> ile başlayın —'
      + ' eklenen kasnak otomatik gerginin önüne düşer.</div>';
  }

  // GERGİ SON SATIRDAYSA KİLİT YERİNDEDİR ve liste bunu SÖNÜK okla söylüyor
  // (sürücü kilidinin aynı kalıbı). Kural yerinde DEĞİLSE kilit de yok:
  // gergisi ortada duran eski bir kayıt okla düzeltilebilmeli.
  var N = T.rows.length;
  var gergiSonda = N > 1 && !!T.rows[N - 1].tensioner;
  T.rows.forEach(function(r, k){
    var son = (k === N - 1);
    // SÜRÜCÜ SATIRIN KENDİSİNDE işaretli (`drv`), yalnız numarasında değil:
    // sol rayı satırın nerede başladığını listeye bakar bakmaz söylüyor.
    var sinif = 've-fead-krt' + (r.driver ? ' drv' : '') + (r.id === acik ? ' is-sel' : '')
      + (r.id === VE_FEAD_UZERINDE ? ' is-hov' : '');
    h += '<div class="' + sinif + '" data-ve-node="' + _feadEsc(r.id) + '">';

    // ── KİMLİK ──
    // SIRA: numara + iki ok. Sıra kayışın yolu olduğu için okların taşıdığı şey
    // bir görsel tercih değil, MODELİN KENDİSİ. Sürücünün numarası vurgulu:
    // sıra ondan başlıyor ve satırı bu yüzden kilitli.
    h += '<div class="kim"><span class="ve-fead-tbl-ord">'
      + '<b' + (r.driver ? ' class="drv" title="Sürücü — kayış sırası buradan'
                          + ' başlar, satır kilitli"' : '') + '>' + r.index + '</b>'
      + _feadTblMove(r.id, -1, k <= 1 || (gergiSonda && r.tensioner))
      + _feadTblMove(r.id, +1, son || k === 0 || (gergiSonda && k === N - 2))
      + '</span>'
      // AD: tıklanınca bileşenin PANELİ açılır — "gerekirse tıklayarak bileşen
      // penceresini açarak detay hesaplamalara bakacağız" isteğinin karşılığı.
      + '<button type="button" class="ve-fead-tbl-name"'
      + ' onmousedown="event.stopPropagation();"'
      + ' onclick="veFeadTableOpen(\'' + _feadEsc(r.id) + '\')"'
      + ' title="' + _feadEsc(r.name) + ' — panelini aç (detay hesaplar)">'
      + '<span class="ad">' + _feadEsc(r.name) + '</span>' + VE_FEAD_TBL_OPEN_ICON
      + '</button>'
      + (r.driver ? '<span class="ve-fead-krt-rz">Sürücü</span>'
         : (r.tensioner ? '<span class="ve-fead-krt-rz ten">Gergi</span>' : ''))
      + '</div>';

    // ── GİRDİ — defter sırası: X · Y · D · Yön ──
    h += '<div class="gir">'
      + _feadKrtFld(_feadKol('x'), _feadTblIn(r.id, r.xKey, r.xMm),
                    r.tensioner ? 'avara merkezi (montaj konumu bundan türer)' : '')
      + _feadKrtFld(_feadKol('y'), _feadTblIn(r.id, r.yKey, r.yMm),
                    r.tensioner ? 'avara merkezi (montaj konumu bundan türer)' : '')
      + _feadKrtFld(_feadKol('od'), _feadTblIn(r.id, 'od', r.odMm), 'dış çap')
      + _feadTblSpin(r.id, r.spin, T.sense)
      + '</div>';

    // ── ÇÖZÜM — defter sırası: Efektif Çap · Sarım · Span ──
    h += '<div class="coz">'
      + _feadKrtRv(_feadKol('eff'), r.effDiaMm, 1)
      + _feadKrtRv(_feadKol('sar'), r.wrapDeg, 1)
      + _feadKrtRv(_feadKol('span'), r.spanMm, 1)
      + '</div>';

    h += '<button type="button" class="ve-fead-tbl-del"'
      + ' onmousedown="event.stopPropagation();"'
      + ' onclick="veFeadTableDelete(\'' + _feadEsc(r.id) + '\')"'
      + ' title="' + _feadEsc(r.name) + ' kasnağını sil">✕</button>';
    h += '</div>';
  });
  h += '</div>';

  // ── EKLEME ŞERİDİ: LİSTENİN SONUNDA ──────────────────────────────────────
  // Ekleyici künyenin sağ ucundaydı ve orada bir künye alanı gibi duruyordu.
  // Oysa eklenen kasnak sıranın SONUNA düşüyor — eylemin sonucu tam olarak
  // burada beliriyor. Kartın altı da bir denetim şeridi değil bir eylem şeridi.
  h += '<div class="ve-fead-tbl-ekle">'
    + veFeadTableAddHTML()
    + '<span class="ipucu">eklenen kasnak otomatik gerginin önüne düşer</span>'
    + '</div>';
  return h;
}

// Sıra oku. Pasif hâl `disabled` — eskiden ok yerine soluk bir <span> basılıyordu
// ve o, klavyeyle gezinen için hiç var olmayan bir düğmeydi; `disabled` ise
// "burada bir düğme var ama şu an kullanılamaz" diyor.
function _feadTblMove(id, delta, pasif){
  var g = (delta < 0) ? '▲' : '▼';
  return '<button type="button" class="ve-fead-tbl-mv"' + (pasif ? ' disabled' : '')
    + ' onmousedown="event.stopPropagation();"'
    + ' onclick="veFeadTableMove(\'' + _feadEsc(id) + '\',' + delta + ')"'
    + ' title="Kayış sırasında ' + (delta < 0 ? 'yukarı' : 'aşağı') + ' taşı">'
    + g + '</button>';
}

// ── TABLODAN YAZMA ─────────────────────────────────────────────────────────
// Panelin kullandığı veFeadSet'e devrediyor: saveState, kutuyu koordinatına
// oturtma ve göç hep orada. İkinci bir yazma yolu açmak, tablodan girilen
// koordinatın kutuyu taşımaması gibi sessiz bir ayrışma üretirdi.
//
// VİRGÜLLÜ GİRİŞ KABUL EDİLİR. Tablo değerleri noktayla basıyor ama kullanıcı
// Türkçe klavyede virgül yazıyor; `parseFloat('63,5')` sessizce 63 verirdi ve
// 0,5 mm'lik bir kayma bu modelde ölçülebilir (alternatörün 1 mm'si gerginliği
// %5,9 değiştiriyor).
//
// GEÇERSİZ GİRİŞTE DE TAZELENİR: alan modeldeki değere geri döner. Yalnız
// `false` dönseydi kullanıcının yazdığı geçersiz metin hücrede kalır ve model
// başka bir sayı taşırken kullanıcı yazdığını görürdü.
function veFeadTableSet(nodeId, key, raw){
  var v = parseFloat(String(raw == null ? '' : raw).trim().replace(',', '.'));
  if(!Number.isFinite(v)){ veFeadTableAfterEdit(); return false; }
  if(typeof veFeadSet === 'function') veFeadSet(nodeId, key, v);
  veFeadTableAfterEdit();
  return true;
}

// ── KASNAK EKLE — TİP LİSTESİ componentDefs'TEN ───────────────────────────
// Kutular kalkınca paletten sürüklemek hâlâ çalışıyor (kutusuz düğüm kuruluyor
// ve satır beliriyor) ama kanvasta hiçbir şey görünmediği için o yol artık
// SESSİZ. Tablonun kendi ekleyicisi o boşluğu kapatıyor: seçilen tip kayış
// sırasının SONUNA ekleniyor ve paneli açılıyor.
//
// Liste componentDefs'ten türer, ikinci bir tip listesi tutulmaz.
//
// KARTIN ALTINDA duruyor, künyenin sağ ucunda değil: eklenen kasnak sıranın
// SONUNA düşüyor, yani eylemin sonucu tam olarak listenin bittiği yerde
// beliriyor. Künyede dururken bir kayış künyesi alanı gibi okunuyordu.
// Modeldeki otomatik gergi düğümü (yoksa null). Tek yerden okunuyor ki
// "gergi hangisi" sorusu iki ayrı yanıt üretmesin.
function _feadTensionerOf(list){
  if(!list || typeof componentDefs === 'undefined') return null;
  for(var i = 0; i < list.length; i++)
    if(list[i] && (componentDefs[list[i].type] || {}).isFeadTensioner) return list[i];
  return null;
}

function veFeadTableAddHTML(){
  if(typeof componentDefs === 'undefined') return '';
  var opt = '<option value="">＋ Kasnak ekle…</option>';
  // MODELDE ZATEN GERGİ VARSA LİSTEDE GÖRÜNMEZ. Çekirdek birden fazla gergiyi
  // de reddediyor; liste onu sunmaya devam ederse kullanıcı modeli ikinci bir
  // yönden çözülemez hâle getirebiliyordu. Seçenek KALDIRILIYOR, `disabled`
  // basılmıyor: gri bir satır "neden kapalı?" diye sorduruyor, oysa cevap
  // zaten listede görünen gergi satırı.
  var _tenVar = (typeof nodes !== 'undefined') && !!_feadTensionerOf(nodes);
  Object.keys(componentDefs).forEach(function(t){
    if(!componentDefs[t] || !componentDefs[t].isFeadPulley) return;
    if(_tenVar && componentDefs[t].isFeadTensioner) return;
    opt += '<option value="' + t + '">' + _feadEsc(componentDefs[t].name) + '</option>';
  });
  return '<select class="ve-fead-tbl-add" data-ve="add-pulley"'
    + ' onmousedown="event.stopPropagation();" ondblclick="event.stopPropagation();"'
    + ' onchange="veFeadTableAdd(this.value); this.selectedIndex=0;"'
    + ' title="Kayış sırasının sonuna kasnak ekle">' + opt + '</select>';
}

function veFeadTableAdd(type){
  if(!type || typeof createNode !== 'function') return false;
  if(typeof componentDefs === 'undefined' || !componentDefs[type]
     || !componentDefs[type].isFeadPulley) return false;
  // Konum kutusuz tipte kullanılmıyor ama createNode imzası istiyor; kanvas
  // merkezi geçiliyor ki bir gün kutulu bir tipe uygulansa da anlamlı olsun.
  // İKİNCİ GERGİ KURULMAZ. Liste onu zaten sunmuyor (veFeadTableAddHTML) ama
  // kapı İŞLEVDE de duruyor: liste bir gün başka bir yerden beslenirse kısıt
  // sessizce kalkardı ve çekirdeğin reddi kullanıcıya ancak çözüm anında,
  // başka bir yüzeyde görünürdü.
  if(componentDefs[type].isFeadTensioner && typeof nodes !== 'undefined'
     && _feadTensionerOf(nodes)){
    if(typeof showToast === 'function')
      showToast('Modelde zaten bir otomatik gergi var; çekirdek ikincisini '
        + 'kabul etmez.', 'warning');
    return false;
  }
  // YENİ KASNAK GERGİNİN ÖNÜNE DÜŞER, sıranın SONUNA değil.
  //
  // İndissiz kasnağı `veFeadBeltOrder` sona atıyor; bu, "döngü otomatik
  // gergiyle biter" kuralını kasnak eklenir eklenmez kırıyordu (gergi N−1'e
  // kayıyor ve kullanıcı hiçbir şey yapmadan modeli uyarılı hâle getiriyordu).
  // Kesirli indis veriliyor; `veFeadNormalizeBeltOrder` zaten 1..N'e oturtuyor.
  //
  // GÜVENLİ, çünkü yeni kasnağın henüz KOORDİNATI yok: halkadaki yeri
  // geometriye hiç girmiyor. (Koordinatı olan bir kasnağı halkada oynatmak
  // bedava DEĞİL — ölçüldü, L 1714,61 → 2459,29 mm.)
  //
  // KURULUM + SIRA TEK ADIM (`veStateBatch`): createNode kendi saveState'ini
  // çağırıyor ve indis ondan SONRA yazılıyordu — yığındaki durum gerginin
  // ARDINDA duran kasnağı taşıyordu, İleri Al onu oraya geri koyardı.
  var n = null, _ten = _feadTensionerOf(nodes);
  var kur = function(){
    n = createNode(type, 3000, 3000);
    if(!n || !_ten || _ten === n) return;
    var _ti = Number(_ten.data && _ten.data.beltIndex);
    if(Number.isFinite(_ti)){ if(!n.data) n.data = {}; n.data.beltIndex = _ti - 0.5; }
  };
  if(typeof veStateBatch === 'function') veStateBatch(kur); else kur();
  if(!n) return false;
  // TAZELEME BURADA, İNDİSTEN SONRA: createNode'un kendi tazelemesi toplu
  // kurulumun içinde, indis yazılmadan ÖNCE koşuyor — tablo penceresi yeni
  // kasnağı bir kare boyunca gerginin ARDINDA gösterirdi.
  veFeadTableAfterEdit();
  _feadScrollRowIntoView(n.id);
  if(typeof showToast === 'function')
    showToast(componentDefs[type].name + (_ten && _ten !== n
      ? ' otomatik gerginin önüne eklendi' : ' kayış sırasının sonuna eklendi'), 'success');
  return true;
}

// EKLENEN SATIR GÖRÜNÜR OLMALI.
//
// ÖLÇÜLDÜ (2026-09-11, gerçek tarayıcı): varsayılan kartta yedinci kasnak
// eklendiğinde satır listenin dibinin 35 px ALTINA düşüyor ve tablo hiç
// kaymıyor (scrollTop 0'da kalıyor). Kullanıcı "＋ Kasnak ekle" diyor, paneli
// açılıyor, ama DOLDURACAĞI SATIR ekranda yok — eylemin sonucu görünmüyor.
// Kaydırma `veFeadRefreshCards`'tan SONRA olmak zorunda: satır o çağrıyla
// doğuyor, öncesinde DOM'da yok.
function _feadScrollRowIntoView(nodeId){
  if(typeof document === 'undefined' || !nodeId) return false;
  // Pencerenin tazelemesi bir sonraki kareye ertelenmiş olabilir (odak
  // kuralı); satır ancak o kurulumla doğuyor — bekleyen tazeleme ŞİMDİ yapılır.
  _feadTabloBosalt();
  var tr = document.querySelector('.' + VE_FEAD_TABLE_CLASS
    + ' .ve-fead-krt[data-ve-node="' + nodeId + '"]');
  if(!tr || typeof tr.scrollIntoView !== 'function') return false;
  // `block:'nearest'` — satır zaten görünüyorsa liste OYNAMAZ. 'center' olsaydı
  // her ekleme listeyi zıplatırdı, oysa görünen bir satır için yapılacak doğru
  // şey hiçbir şey yapmamak.
  tr.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return true;
}

// ── KASNAK SİL — `deleteSelectedNodes` DEĞİL ──────────────────────────────
// O fonksiyon `selectedNodes` global'ini TÜKETİYOR ve DOM elemanı arıyor;
// kutusuz kasnakta ikisi de yanlış. Silme burada: diziden çıkar, seçimden
// düşür, sayacı ve kartları tazele. saveState mutasyondan ÖNCE (geri-al
// yığınına ön durum girsin — projenin sözleşmesi).
function veFeadTableDelete(nodeId){
  if(typeof nodes === 'undefined' || !nodes) return false;
  var i = -1, k;
  for(k = 0; k < nodes.length; k++) if(nodes[k].id === nodeId){ i = k; break; }
  if(i < 0 || !_feadIsPulley(nodes[i])) return false;
  // GERGİ SİLİNEMEZ — kozmetik bir kısıt değil: `fead-core.js` gergisiz
  // sistemi kurmayı REDDEDİYOR (throw) ve köprü aynı kapıyı tekrarlıyor.
  // Silinince model çözülemez hâle geliyordu ve sonuç dağınıktı: köprü hata
  // veriyor, modül paneli "Gergi 0 adet"i amber yakıyor, raporun §4 ve
  // §8.7/8.8/8.9 bölümleri tamamen düşüyordu.
  //
  // ASIL GEREKÇE İKİ YÜZEYİN ZIT DAVRANMASI: sihirbaz gergi satırının ✕'ini
  // `disabled` basıp sebebini `title`da yazıyor; liste ise serbest
  // bırakıyordu. Aynı modelin iki yüzeyi aynı kuralı söylemeli.
  if((componentDefs[nodes[i].type] || {}).isFeadTensioner){
    if(typeof showToast === 'function')
      showToast('Otomatik gergi silinemez: her FEAD modelinde tam bir gergi '
        + 'vardır (çekirdek gergisiz sistemi çözmez).', 'warning');
    return false;
  }
  if(typeof saveState === 'function') saveState();
  var ad = _feadNodeName(nodes[i]);
  nodes.splice(i, 1);
  if(typeof selectedNodes !== 'undefined' && Array.isArray(selectedNodes))
    for(k = selectedNodes.length - 1; k >= 0; k--)
      if(nodes.indexOf(selectedNodes[k]) < 0) selectedNodes.splice(k, 1);
  // Silinen kasnağın paneli açık kalmasın.
  if(typeof selectedNodes !== 'undefined' && !selectedNodes.length
     && typeof showEmptyProperties === 'function') showEmptyProperties();
  if(typeof updateNodeCount === 'function') updateNodeCount();
  veFeadTableAfterEdit();
  if(typeof showToast === 'function') showToast(ad + ' silindi', 'info');
  return true;
}

// Yön hücresi → TEMAS TARAFI. Çeviriyi köprü yapıyor (veFeadContactForSpin);
// burada ikinci bir işaret kuralı yazmak, çevrimin süpürme işareti değiştiğinde
// iki yüzeyin sessizce ayrışması demekti.
function veFeadTableSetSpin(nodeId, yon){
  if(typeof nodes === 'undefined' || typeof veFeadContactForSpin !== 'function') return false;
  var c = veFeadContactForSpin(nodes, String(yon) === 'Sağ');
  if(!c){ veFeadTableAfterEdit(); return false; }   // yön okunamıyor → yazma
  if(typeof veFeadSet === 'function') veFeadSet(nodeId, 'contact', c);
  veFeadTableAfterEdit();
  return true;
}

function veFeadTableMove(nodeId, delta){
  if(typeof nodes === 'undefined' || typeof veFeadMoveBeltIndex !== 'function') return false;
  if(typeof saveState === 'function') saveState();   // ÖN durum — projenin sözleşmesi
  var ok = veFeadMoveBeltIndex(nodes, nodeId, delta);
  if(ok) veFeadTableAfterEdit();
  return ok;
}

// Kasnağın panelini aç — kullanıcı isteği: "gerekirse de tıklayarak bileşen
// penceresini açarak detay hesaplamalara bakacağız".
//
// PENCEREYİ AÇAN SATIR SEÇİM DEĞİL, `veTogglePropertiesPanel(true)`.
// `addToSelection` panelin İÇERİĞİNİ doldurur ama `#ve-properties-overlay`
// bir MODAL'dır ve kapalı kalır (map.js). Ölçüldü (gerçek tarayıcı): ada
// tıklanınca satır işaretleniyor, panelin HTML'i kuruluyor, ekranda hiçbir
// şey olmuyordu — ve kasnakların kanvasta kutusu olmadığı için bu hücre
// panele giden TEK kapı. Hücrenin "pencere açılır" simgesi de o sözü
// veriyordu. Kalıp projede zaten var: solver.js çözüm sonrası aynı çağrıyı
// yapıyor (kapısı solver-run-opens-component.test.js).
function veFeadTableOpen(nodeId){
  if(typeof nodes === 'undefined') return false;
  var n = nodes.filter(function(x){ return x.id === nodeId; })[0];
  if(!n) return false;
  if(typeof clearSelection === 'function') clearSelection();
  if(typeof addToSelection === 'function') addToSelection(n);
  else if(typeof showNodeProperties === 'function') showNodeProperties(n);
  if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(true);
  return true;
}

// Tazeleme TEK NOKTADAN, üç yüzey birden: tablo, şema kartı ve rozetler aynı
// modeli gösteriyor. Birini atlamak, tablodan girilen sayının şemaya bir
// düzenleme sonra yansıması demekti.
function veFeadTableAfterEdit(){
  if(typeof updateAllConnections === 'function') updateAllConnections();
  veFeadRefreshCards();
  if(typeof veFeadRefreshBadges === 'function') { try { veFeadRefreshBadges(); } catch(e){} }
  if(typeof showNodeProperties === 'function' && typeof selectedNodes !== 'undefined'
     && selectedNodes && selectedNodes.length === 1)
    showNodeProperties(selectedNodes[0]);
}

// ── FEAD KARTLARININ TEK TAZELEME KAPISI ───────────────────────────────────
// İki kart (şema + tablo) AYNI modeli gösteriyor, dolayısıyla hep BİRLİKTE
// tazelenmeli. Çağrıları kart başına ayırmak, altı düzenleme yolundan birinde
// birinin unutulması demekti — ve fark sessiz olurdu: iki kart kendi başına
// tutarlı görünür, yalnız biri bir düzenleme geride kalır. ("Tazeleme tek
// noktadan" kuralı, bkz. modül skill'i.)
function veFeadRefreshCards(){
  var n = 0;
  if(typeof veFeadRefreshLayoutCards === 'function') n += veFeadRefreshLayoutCards();
  n += veFeadRefreshTableCards();
  return n;
}

// ── KAYIŞ TABLOSU ÇEKMECESİ (Çizim Masası) ────────────────────────────────
// Tablo kanvastan İNDİ (kanvas kartıyken açılış yakınlaştırmasıyla küçülen bir
// formdu). Kanvas kartının "Tablo" düğmesiyle açılır ve MODAL DEĞİLDİR: açıkken
// çizim görünür ve sürüklenebilir, hücreye yazılan sayı çizimde, çizimde
// sürüklenen kasnak tabloda anında görünür. Yazı kanvasla ölçeklenmez.
//
// YERİ TUVALİN ALTI, ÜSTÜ DEĞİL (2026-09-24, kullanıcı: "Tablo açılıyor fakat
// kötü bir yere geliyor"). İlk hâli tuvalin ÜSTÜNDE yüzen bir karttı ve
// ölçüldü (1366×768, AG00976): tuvalin alanının %45'ini ve minimap'in %65'ini
// örtüyor, hiçbir kenara hizalı durmuyor, çizimleri 0,83'ten 0,49'a
// küçültüyor ve kapanınca da öyle bırakıyordu. Artık KANVAS ALANININ BİR SATIRI — tuvalin altına yapışık,
// durum şeridinin üstünde, tuvalin sütunuyla aynı genişlikte. Tuval o kadar
// KISALIR; hiçbir şey örtülmez. Müfettiş sütununun kuralının aynısı
// (docs/decisions/ortak-yuzeyler.md → "Müfettiş tuvalin YANINDADIR"):
// örtmek, kazanılan şeyi yine gizlemekti.
//
// İÇERİK TABLONUN TEK ÜRETİCİSİNDEN (veFeadTableCardHTML) — çekmece kendi
// satırını kurmaz. Çekmece kipinde başlık satırı bir kez basılır ve satırların
// tekrar eden etiketleri gizlenir.
var VE_FEAD_TABLO_ID = 've-fead-tablo';
var _feadTabloKare = 0;
// Tutamakla seçilen yükseklik (px) oturum boyunca korunur — kapatıp açınca
// aynı yükseklikte gelir. 0: içerik kadar (CSS tavanıyla). Görünüm durumu:
// kaydedilmez, geri-al yığınına girmez.
var _feadTabloH = 0;
var VE_FEAD_TABLO_MIN = 150;        // başlık bandı + künye + başlık satırı + ~2 satır
var VE_FEAD_TABLO_TUVAL_MIN = 180;  // tutamak tuvali bundan kısaya indiremez
// Açılışta kamera çizimlere sığdırıldıysa: önceki ve sonraki kamera.
var _feadTabloKamera = null;

function veFeadTabloAcikMi(){
  return !!(typeof document !== 'undefined' && document.getElementById(VE_FEAD_TABLO_ID));
}

// Çekmecenin yeri: kanvas alanının satırı, durum şeridinin hemen üstü. Kabuk
// yoksa (Node testleri) tuval kabının içi.
function _feadTabloYeri(){
  if(typeof document === 'undefined') return null;
  var alan = document.querySelector('.ve-canvas-area');
  if(alan){
    var serit = document.getElementById('ve-status-bar');
    return { kap: alan, once: (serit && serit.parentNode === alan) ? serit : null };
  }
  var w = document.getElementById('ve-canvas-wrapper');
  return w ? { kap: w, once: null } : null;
}

// Odaktaki bölmenin tuval kabı — çekmece onun ALTINI kısaltıyor.
function _feadTuvalKabi(){
  if(typeof document === 'undefined') return null;
  return document.querySelector('.ve-split-pane.focused .ve-canvas-wrapper')
    || document.getElementById('ve-canvas-wrapper');
}

// Çekmece FEAD'e AİT: kanvasta ne Kayış Yolu kartı ne kasnak varsa yeri yok
// (ana topolojiye dönüldü, başka sekme, başka proje). Ölçüldü: ana topolojiye
// dönünce pencere açık kalıyor ve SATIRSIZ bir Kayış Tablosu gösteriyordu.
function _feadTabloBaglam(){
  if(typeof nodes === 'undefined' || !nodes) return false;
  return nodes.some(function(n){
    var d = _feadDefOf(n);
    return !!(d.isFeadPulley || d.isFeadLayout);
  });
}

function _feadKamera(){
  if(typeof canvasZoom === 'undefined' || typeof canvasOffset === 'undefined') return null;
  return { z: canvasZoom, x: canvasOffset.x, y: canvasOffset.y };
}
function _feadAyniKamera(a, b){
  return !!(a && b && Math.abs(a.z - b.z) < 1e-9 && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5);
}

function veFeadTabloAc(){
  if(typeof document === 'undefined') return false;
  var p = document.getElementById(VE_FEAD_TABLO_ID);
  if(!p){
    var yer = _feadTabloYeri();
    if(!yer) return false;
    var tuval = _feadTuvalKabi();
    var rk0 = (tuval && tuval.getBoundingClientRect) ? tuval.getBoundingClientRect() : null;
    p = document.createElement('section');
    p.id = VE_FEAD_TABLO_ID;
    p.className = 've-fead-tablo-pencere';
    p.setAttribute('role', 'region');
    p.setAttribute('aria-label', 'Kayış Tablosu');
    p.innerHTML = '<div class="ve-fead-tablo-tutamak" role="separator" aria-orientation="horizontal"'
      + ' tabindex="0" aria-label="Tablonun yüksekliği" title="Sürükle: tablonun yüksekliği · çift tık: içerik kadar"></div>'
      + '<header class="ve-fead-tablo-bas"><b>Kayış Tablosu</b>'
      + '<em>Gates Layout Data · yazılan değer çizime anında yansır</em>'
      + '<button type="button" class="ve-tablo-kapat" aria-label="Kapat" title="Kapat (Esc)"'
      + ' onclick="veFeadTabloKapat()">'
      + '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"'
      + ' stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></header>'
      + '<div class="' + VE_FEAD_TABLE_CLASS + '"></div>';
    // SATIR ↔ ÇİZİM: satırın üstüne gelmek kasnağı çizimde yakar.
    p.addEventListener('mouseover', function(e){
      var r = e.target && e.target.closest && e.target.closest('.ve-fead-krt[data-ve-node]');
      veFeadCizimUzerinde(r ? r.getAttribute('data-ve-node') : null);
    });
    p.addEventListener('mouseleave', function(){ veFeadCizimUzerinde(null); });
    var tut = p.querySelector('.ve-fead-tablo-tutamak');
    tut.addEventListener('mousedown', function(e){ _feadTabloTutamakBas(p, e); });
    tut.addEventListener('keydown', function(e){ _feadTabloTutamakTus(p, e); });
    tut.addEventListener('dblclick', function(){ _feadTabloBoyut(p, 0); });
    yer.kap.insertBefore(p, yer.once);
    document.addEventListener('keydown', _feadTabloTus, true);
    if(_feadTabloH) _feadTabloBoyut(p, _feadTabloH);
    _feadTabloCiz();
    _feadTabloCizimiGoster(rk0);
  } else _feadTabloCiz();
  _feadTabloDugmeEsitle();
  return true;
}

// ÇİZİM GÖRÜNÜR KALIR. Çekmece açılınca tuval KISALIR ve alt kenarı yukarı
// çıkar; açılıştan önce TAMAMEN görünen bir çizim yeni kenarda kesiliyorsa
// kamera YALNIZ çizimleri yeni tuvale sığdırır. Sözü "yazılan değer çizime
// anında yansır" — yansıdığı yer görünmüyorsa söz tutulmaz. Çizimlerden biri
// zaten kesikse (kullanıcı yakınlaşıp bir kasnağa bakıyor) kamera OYNAMAZ, ve
// hiçbir zaman YAKINLAŞMAZ (ilk hâli 1920×1080'de 1,00 → 1,11 yakınlaşıyordu:
// tablo açmak çizimi büyütmemeli).
function _feadTabloCizimiGoster(rk0){
  _feadTabloKamera = null;
  if(typeof veFitViewToContent !== 'function' || typeof nodes === 'undefined' || !rk0) return false;
  var tuval = _feadTuvalKabi();
  if(!tuval || !tuval.getBoundingClientRect) return false;
  var rk1 = tuval.getBoundingClientRect();
  var tam = function(r, k){
    return r.top >= k.top - 1 && r.bottom <= k.bottom + 1 && r.left >= k.left - 1 && r.right <= k.right + 1;
  };
  var kartlar = [];
  nodes.forEach(function(n){
    if(!_feadDefOf(n).isFeadLayout) return;
    var el = document.getElementById(n.id);
    if(el && el.getBoundingClientRect) kartlar.push(el.getBoundingClientRect());
  });
  if(!kartlar.length) return false;
  if(!kartlar.every(function(r){ return tam(r, rk0); })) return false;
  if(kartlar.every(function(r){ return tam(r, rk1); })) return false;
  var once = _feadKamera();
  var canvas = document.getElementById('ve-canvas');
  if(canvas) canvas.classList.add('tidy-cam');
  veFitViewToContent({ only: function(n){ return !!_feadDefOf(n).isFeadLayout; },
                       margin: 24, maxZoom: Math.min(1.2, once ? once.z : 1.2) });
  if(canvas) setTimeout(function(){ canvas.classList.remove('tidy-cam'); }, 520);
  _feadTabloKamera = { once: once, sonra: _feadKamera() };
  return true;
}

// KAPANINCA KAMERA DÖNER — ama yalnız hâlâ çekmecenin bıraktığı yerdeyse.
// Tuval eski boyuna uzuyor; kamera sığdırılmış hâlde kalsaydı çizimler üstte
// küçük durur, altları boş kalırdı. Kullanıcı o arada kaydırdı ya da
// yakınlaştırdıysa onun görünümüne dokunulmaz.
function _feadTabloKameraGeri(){
  var km = _feadTabloKamera;
  _feadTabloKamera = null;
  if(!km || !km.once || !_feadAyniKamera(_feadKamera(), km.sonra)) {
    if(typeof updateCanvasTransform === 'function') updateCanvasTransform();  // minimap görüş kutusu
    return false;
  }
  var canvas = document.getElementById('ve-canvas');
  if(canvas) canvas.classList.add('tidy-cam');
  canvasZoom = km.once.z;
  canvasOffset.x = km.once.x;
  canvasOffset.y = km.once.y;
  if(typeof updateCanvasTransform === 'function') updateCanvasTransform();
  if(canvas) setTimeout(function(){ canvas.classList.remove('tidy-cam'); }, 520);
  return true;
}

// ÜST KENAR BİR TUTAMAK: sürükleyerek (ya da odaktayken ↑ ↓, Shift ile dört
// kat) çekmecenin yüksekliği. Altta başlık + künye + birkaç satır kalır, üstte
// tuvale en az VE_FEAD_TABLO_TUVAL_MIN px bırakılır. Çift tık (ya da h = 0)
// içerik kadarına döndürür.
function _feadTabloBoyut(p, h){
  if(!h){
    p.style.height = ''; p.style.maxHeight = ''; _feadTabloH = 0;
    if(typeof updateCanvasTransform === 'function') updateCanvasTransform();
    return 0;
  }
  var tuval = _feadTuvalKabi();
  var hT = (tuval && tuval.getBoundingClientRect) ? tuval.getBoundingClientRect().height : 0;
  var hP = p.getBoundingClientRect ? p.getBoundingClientRect().height : 0;
  var ust = Math.max(VE_FEAD_TABLO_MIN, hT + hP - VE_FEAD_TABLO_TUVAL_MIN);
  h = Math.round(Math.max(VE_FEAD_TABLO_MIN, Math.min(ust, h)));
  p.style.height = h + 'px';
  p.style.maxHeight = 'none';
  _feadTabloH = h;
  if(typeof updateCanvasTransform === 'function') updateCanvasTransform();
  return h;
}
function _feadTabloTutamakBas(p, e){
  if(!e || e.button !== 0) return;
  e.preventDefault();
  var y0 = e.clientY, h0 = p.getBoundingClientRect().height;
  p.classList.add('is-boyut');
  function tasi(ev){ _feadTabloBoyut(p, h0 + (y0 - ev.clientY)); }
  function birak(){
    document.removeEventListener('mousemove', tasi, true);
    document.removeEventListener('mouseup', birak, true);
    p.classList.remove('is-boyut');
  }
  document.addEventListener('mousemove', tasi, true);
  document.addEventListener('mouseup', birak, true);
}
function _feadTabloTutamakTus(p, e){
  var d = { ArrowUp: 24, ArrowDown: -24 }[e.key];
  if(!d) return;
  e.preventDefault();
  e.stopPropagation();          // oklar seçili kasnağı da kaydırmasın
  _feadTabloBoyut(p, p.getBoundingClientRect().height + d * (e.shiftKey ? 4 : 1));
}

// ODAK KORUNUR. Hücre `onchange` ile yazıyor ve o olay hücreden ÇIKARKEN
// tetikleniyor; tazeleme aynı anda yapılsa Sekme ile geçilen SONRAKİ hücre
// sökülür ve odak düşerdi (ikinci sayı yazılamaz). Tazeleme bu yüzden bir
// sonraki kareye ertelenir ve o anki odak (anahtarıyla) yeniden verilir.
// Kareye kadar FEAD'den çıkılmışsa çekmece çizilmez, KAPANIR — sessiz bir
// gidiş-dönüş (arka plan kaydı köke çöker ve AYNI anda geri girer) kareye
// kadar tamamlanmış olur ve çekmeceye dokunmaz.
function _feadTabloCiz(){
  _feadTabloKare = 0;
  var p = (typeof document !== 'undefined') ? document.getElementById(VE_FEAD_TABLO_ID) : null;
  var govde = p && p.querySelector('.' + VE_FEAD_TABLE_CLASS);
  if(!govde) return false;
  if(!_feadTabloBaglam()){ veFeadTabloKapat(); return false; }
  var odak = document.activeElement, anahtar = null, s0 = null, s1 = null;
  if(odak && govde.contains(odak)){
    anahtar = odak.getAttribute('onchange') || odak.getAttribute('onclick');
    try { s0 = odak.selectionStart; s1 = odak.selectionEnd; } catch(e){ /* düğme */ }
  }
  var kay = govde.querySelector('.ve-fead-krt-wrap');
  var ust = kay ? kay.scrollTop : 0;
  govde.innerHTML = veFeadTableCardHTML(null, { pencere: true });
  kay = govde.querySelector('.ve-fead-krt-wrap');
  if(kay) kay.scrollTop = ust;
  if(anahtar){
    var el = govde.querySelectorAll('input, button, select');
    for(var i = 0; i < el.length; i++){
      if(el[i].getAttribute('onchange') !== anahtar && el[i].getAttribute('onclick') !== anahtar) continue;
      el[i].focus();
      try { if(s0 != null) el[i].setSelectionRange(s0, s1); } catch(e){ /* düğme */ }
      break;
    }
  }
  return true;
}

function veFeadTabloKapat(){
  if(typeof document === 'undefined') return false;
  var p = document.getElementById(VE_FEAD_TABLO_ID);
  if(!p) return false;
  // Odaktaki hücre ÖNCE bırakılır: değer `onchange` ile yazılsın. Odaktaki
  // bir hücreyi DOM'dan sökmek son değeri hiç yazdırmamak olurdu.
  var odak = document.activeElement;
  if(odak && p.contains(odak) && typeof odak.blur === 'function') odak.blur();
  if(p.parentNode) p.parentNode.removeChild(p);
  document.removeEventListener('keydown', _feadTabloTus, true);
  veFeadCizimUzerinde(null);
  _feadTabloDugmeEsitle();
  _feadTabloKameraGeri();
  return true;
}

// Bekleyen pencere tazelemesini ŞİMDİ yap — satırını DOM'da bulması gereken
// bir adım geliyorsa (eklenen satırı görüş alanına almak gibi).
function _feadTabloBosalt(){
  if(!_feadTabloKare) return false;
  if(typeof cancelAnimationFrame === 'function') cancelAnimationFrame(_feadTabloKare);
  _feadTabloCiz();
  return true;
}

function veFeadTabloToggle(){ return veFeadTabloAcikMi() ? veFeadTabloKapat() : veFeadTabloAc(); }

// YAKALAMA evresinde: ESC yalnız pencereyi kapatır, alttaki seçimi temizlemez
// (tek tuş, tek katman — tablo-pencere.js'in kuralı).
function _feadTabloTus(e){
  if(e.key !== 'Escape' || !veFeadTabloAcikMi()) return;
  e.stopPropagation();
  e.preventDefault();
  veFeadTabloKapat();
}

// Tazeleme kapısının tablo ayağı: pencere açıksa bir sonraki karede tazelenir
// (bkz. odak kuralı). Kanvasta tablo kartı artık yok.
function veFeadRefreshTableCards(){
  if(!veFeadTabloAcikMi()) return 0;
  if(_feadTabloKare) return 1;
  if(typeof requestAnimationFrame === 'function') _feadTabloKare = requestAnimationFrame(_feadTabloCiz);
  else _feadTabloCiz();
  return 1;
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
    // Baskın mod SENARYODA da seçilir. İdeal telde f_n = n·f₁ tam kat olduğu
    // için üst modlar bedava: ayrı bir çekirdek çağrısı gerekmiyor.
    var enF = f, enN = 1;
    if(!(st.firingHz > 0)) mag = 0;
    else if(fl){ mag = cap; enF = st.firingHz; }   // duran dalga yok → akan dalga
    else if(typeof _feadVibSpanMag === 'function'){
      mag = 0;
      for(var n = 1; n <= (spec.vibModes || 4); n++){
        var m = _feadVibSpanMag(n * f, st.firingHz, z);
        if(m > mag){ mag = m; enF = n * f; enN = n; }
      }
    } else mag = 1;
    out.spans.push({
      f: enF, fScreen: enF * (spec.slow > 0 ? spec.slow : 1),
      ampMm: taban * g * mag, mag: mag, flutter: fl, mode: enN,
      ph: (vib.spans && vib.spans[i]) ? vib.spans[i].ph : 0
    });
  }
  return out;
}

var VE_FEAD_ANIM_ATTR = 'data-fead-anim';
var VE_FEAD_ANIM_MAX_DT = 0.1;          // s — sekme geri gelince kayış fırlamasın

// ── DİŞ KARE BAŞINA ÇEYREK ADIMDAN FAZLA İLERLEYEMEZ ───────────────────────
//
// Kullanıcı bildirimi (2026-09-09): *"Sadece başlangıç sihirbazında kayış
// görsel olarak ters yöne dönüyor."* Ve yalnız orada — çünkü kayışın hareketi
// gözle DİŞ SIRASINDAN okunuyor ve diş sırası PERİYODİK bir desen. Böyle bir
// desen kare başına yarım periyottan fazla ilerlerse göz onu en KISA yorumla
// okur, o da GERİYE gitmektir (araba tekerleği / stroboskop etkisi).
//
// ÖLÇÜLDÜ (gerçek tarayıcı, AG00976):
//
//   | Yüzey | diş adımı | hız | 60 Hz'de kare başına | 30 Hz'de |
//   |---|---|---|---|---|
//   | Kanvas kartı (`comp-12`) | 10,20 mm | 59,7 mm/s | 0,098 diş | 0,20 diş |
//   | Sihirbaz önizlemesi | 9,63 mm | **260 mm/s** | **0,45 diş** | **0,90 diş** |
//
// Sihirbaz 60 Hz'de belirsizlik sınırının (0,5) hemen altında, 30 Hz'de ise
// ÜSTÜNDE: 0,90 diş ileri = 0,10 diş geri, yani kayış geriye akıyor görünür.
// Kanvas kartı gerçek kinematikten beslendiği için 0,098'de kalıyor — hatanın
// yalnız sihirbazda görünmesinin sebebi bu, iki yüzeyin yönü ÖLÇÜLDÜ ve AYNI
// (ikisinde de krank saat yönünde).
//
// KAPI HIZDA DEĞİL ANİMATÖRDE: bir sabiti küçültmek yalnız bugünkü çağıranı
// ve yalnız 60 Hz'i kurtarırdı; kare süresi büyüyünce (yavaş makine, dolu
// sayfa, arkada koşan ikinci kart) aynı hata geri gelirdi. Animatör kare
// başına ilerlemeyi diş adımının ÇEYREĞİYLE sınırlıyor — yön her kare
// hızında tek anlamlı kalıyor. Bedeli GÖSTERİM hızı: sihirbazın istediği
// 260 mm/s ekranda ~145 mm/s'e iniyor. Karşılığı doğru yön; zaten okunması
// istenen şey yön, büyüklük değil (hız kartta ayrıca yazılı).
//
// DİŞLER VE KOLLAR AYRIŞMAZ: ikisi de AYNI fazdan sürülüyor, dolayısıyla
// kırpma ikisini birlikte yavaşlatıyor — kasnakta kayma görünmüyor.
var VE_FEAD_ANIM_MAX_STEP_FRAC = 0.25;  // kare başına en fazla çeyrek diş adımı
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
  // ADIM ÇEVREYİ YÜKTE DE TAM BÖLMELİ. `_feadToothStep` adımı çevreye tam
  // oturtuyor ama yük üç sayıyı BİRBİRİNDEN BAĞIMSIZ yuvarlıyor (parça boyları,
  // `loop`, `step` — dört basamak). Yuvarlanmış parçaların toplamı ile
  // yuvarlanmış adımın katı artık eşit değil; ölçüldü (BMC): 174 adım çevreden
  // 0,0023 mm uzun. Faz her adımda bir kez o 0,0023 mm'lik pencereden geçiyor
  // ve o an diş sayısı 174 → 173 düşüyor — "diş belirip kaybolur" sınıfının
  // ta kendisi, yalnız daha dar. Çevre parçaların toplamı olarak alınır ve
  // adım ona yeniden oturtulur; `loop` (JSON) dışarıya künye olarak kalır.
  var L = 0;
  spec.segs.forEach(function(sg){ L += (sg.l > 0) ? sg.l : 0; });
  if(L > 0 && spec.step > 0) spec.step = L / Math.max(1, Math.round(L / spec.step));
  spec.walk = { segs: spec.segs, l: (L > 0) ? L : spec.loop };
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
    // FAZ YÜRÜYÜŞE GÖRE AZALIR. Dişler ve kollar fazı yürüyüş (liste) sırasında
    // sayıyor; liste kayışın gidişinin TERSİ (fead-model.js → veFeadNaturalSense),
    // dolayısıyla kayışın gerçek akışı fazın azalmasıdır. Tek işaret, tek
    // sayaç: dişler de kollar da aynı fazdan sürüldüğü için kasnakta kayma
    // görünmez. Kapı: fead-anim.test.js → "faz kayışın GERÇEK gidişinde".
    var adim = mmS * dt;
    // STROBOSKOP KAPISI (bkz. VE_FEAD_ANIM_MAX_STEP_FRAC): yarım adımı aşan
    // ilerleme dişleri GERİYE okutur; çeyrek adım pay bırakıyor.
    var enFazla = (spec.step > 0) ? spec.step * VE_FEAD_ANIM_MAX_STEP_FRAC : Infinity;
    if(adim > enFazla) adim = enFazla;
    var p = (_feadAnimPhase[key] || 0) - adim;
    // Sarma çevresi YÜRÜYÜŞÜN çevresi (parça toplamı) — `loop` künyesi değil;
    // ikisi yuvarlamadan ötürü 1e-4 mm ayrışabiliyor (bkz. _feadAnimSpec).
    var L = (spec.walk && spec.walk.l > 0) ? spec.walk.l : spec.loop;
    if(L > 0) p = ((p % L) + L) % L;
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

// KAYIŞ TABLOSU PANELİ (`getFeadTablePropertiesHTML`) KALKTI (2026-09-23):
// tablo artık bir düğüm değil, kanvas kartının açtığı PENCERE — seçilecek bir
// tablo düğümü, dolayısıyla onun paneli de yok (bkz. veFeadTabloAc).

// ── KAYIŞ YOLU PENCERESİ — KRANK KASNAĞI AİLESİNDE ─────────────────────────
// İki KATEGORİ: ŞEMA (kol konumu · titreşim · ölçekli çizim) ve GEOMETRİ
// (çekirdeğin kasnak başına span · sarım · hız oranı). Eskiden ikisi alt
// alta tek bir akıştı. Özet sütununda KÜÇÜK RESİM YOK: Şema sekmesi aynı
// kayış yolunu kol konumuyla, pivotla ve yön gülüyle zaten çiziyor — ikinci
// bir çizim aynı resmi iki kez göstermek olurdu. Sütunda uygunluk ve modelin
// uyarıları durur (pencerenin CEVABI).
function getFeadLayoutPropertiesHTML(node){
  if(!node.data) node.data = {};
  var build = veFeadBuildFromCanvas();
  var mode = veFeadPosMode(node);
  // Panel de AYNI alanı okur ve aynı kancayı kurar: gül kartta bir yerde,
  // panelde başka bir yerde durursa kullanıcı hangisinin geçerli olduğunu
  // bilemez (kol konumundaki kuralın aynısı).
  var svg = veFeadLayoutSVG(build, 320, 240,
    { posMode: mode, nodeId: node.id, compassPos: node.data.compassPos });
  if(!svg){
    return '<div class="sw-panel">' + veFeadProblemBox(build) + veFeadWarningBox(build) + '</div>';
  }
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
  var sema = _feadCard('Şema', 'ölçekli · sarım açıları', 'var(--accent-warning)',
      _feadSelect(node, 'Gergi kol konumu', 'posMode', secenekler, mode,
        'Kol kayış uzayıp kısaldıkça dönüyor; her konumda teğet noktaları, sarım '
        + 'açıları ve span boyları DEĞİŞİR. <b>TÜMÜ</b> kolun gezdiği aralığı üst '
        + 'üste bindirir — tolerans ve aşınma payı 0 ise bütün konumlar aynı açıya '
        + 'oturur ve tek eğri görünür.')
    + _feadVibPanelPick(node, build)
    + svg);
  var geo = veFeadGeometryTable(build, mode);

  var T = null;
  try { T = veFeadTableRows(build); } catch(e){ T = null; }
  var yan = { html: _feadSideGates(build, T) + veFeadWarningBox(build) };
  return veFeadPanelShell(node, [{ k:'sema', ad:'Şema',     govde: sema },
                                 { k:'geo',  ad:'Geometri', govde: geo }], yan);
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
      + 'işaretli sarım toplamı ' + _feadFmt(geom.signedWrapDeg,2) + '° (|Σ| 360 olmalı — '
      + 'işaret kaburgalı yüzün çevrime göre hangi yana baktığını söyler).'));
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
  var html = '';
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
  var _gir = html; html = '';
  html += _feadCard('Algılanan Model', '', 'var(--accent-success)', veFeadModelTable(build));

  if(build.ok){
    html += veFeadPositionTable(build);
    html += veFeadWarningBox(build);
  } else {
    html += veFeadProblemBox(build);
    html += veFeadWarningBox(build);
  }

  html += veFeadChecksCard(node, build);
  var _mod = html; html = '';
  html += veFeadDutyEditor(node, build);

  var _cev = html; html = '';
  html += veFeadResultBlock(node);
  var _son = html;

  // HESAPLA DÜĞMESİ SEKMEYE GİRMEZ. Pencerenin tek EYLEMİ o; bir sekmenin
  // içine konsaydı kullanıcı çevrimi düzenlerken düğmeyi göremez, üç sekme
  // gezip geri dönerdi. Sağ sütun tam bu yüzden var: sekmenin aldığı bağlamı
  // geri veriyor. Görünümü CSS'te (`.ve-fp-solve`) — satır içi stil `:hover`ı
  // ve `:disabled`ı ifade edemiyordu, yani kapalı düğme de açık düğme de
  // fareye AYNI tepkiyi veriyordu (kural 14).
  var satirSay = veFeadDutyRows(node).length;
  var hazir = build.ok && satirSay > 0;
  var dugme = '<button type="button" class="ve-fp-solve"' + (hazir ? '' : ' disabled')
    + ' onclick="veFeadSolve(\'' + node.id + '\')">▶ Hesapla</button>'
    + (hazir ? '' : '<div class="ve-fp-solve-not">'
        + (!build.ok ? 'Model eksik — kasnak konumlarını tamamlayın.'
                     : 'Çalışma çevrimi boş — en az bir satır girin.') + '</div>');

  var sekmeler = [{ k:'gir', ad:'Girdiler', govde: _gir },
                  { k:'mod', ad:'Model',    govde: _mod },
                  { k:'cev', ad:'Çevrim',   govde: _cev },
                  { k:'son', ad:'Sonuç',    govde: _son }];

  // SON HESAP SONUCUN KENDİSİNDEN. Burası eskiden `veFeadResults[node.id]`
  // diye arıyordu; oysa sonuç tek bir nesne (düğüme göre anahtarlı bir sözlük
  // DEĞİL) ve çözülen düğüm `solvedNodeId` alanında. Satır her çözümden sonra
  // da "yok" diyordu (ölçüldü: AG00976, 12 devir satırıyla başarılı çözüm).
  // Artık hükmü `veFeadResultState` veriyor: yok · güncel · BAYAT.
  var _sd = veFeadResultState(null, node.id);
  var yan = veFeadToolSide(node, 'Çözüm Durumu', 'canlı', [
    ['Model', build.ok ? 'çözüldü' : 'eksik'],
    ['Çevrim satırı', String(satirSay)],
    ['Son hesap', _sd.metin]
  ], dugme);

  return veFeadPanelShell(node, sekmeler, yan);
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
    if(durum === 'ok')   return '<span style="color:var(--ink-success); font-weight:700;">✓ uygun</span>';
    if(durum === 'warn') return '<span style="color:var(--ink-warning); font-weight:700;">⚠ sınırda</span>';
    if(durum === 'no')   return '<span style="color:var(--ink-danger); font-weight:700;">✗ kontrol</span>';
    return '<span style="color:var(--text-muted);">— değerlendirilemedi</span>';
  }
  function baslik(ad, durum, ek){
    return '<div style="display:flex; align-items:baseline; gap:8px; margin:8px 0 4px;">'
      + '<span style="font-size:var(--fs-micro); font-weight:700; color:var(--text-secondary);">' + ad + '</span>'
      + '<span style="flex:1; font-size:var(--fs-micro); color:var(--text-muted);">' + (ek || '') + '</span>'
      + '<span style="font-size:var(--fs-micro);">' + rozet(durum) + '</span></div>';
  }
  var TD = ' style="padding:2px 5px; border-bottom:1px solid var(--border-color);"';
  var TDR = ' style="padding:2px 5px; border-bottom:1px solid var(--border-color); text-align:right;"';
  function tablo(inner){
    return '<table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; margin-bottom:6px;">'
      + inner + '</table>';
  }
  function pay(p){
    var renk = !Number.isFinite(p) ? 'var(--text-muted)'
             : p < 0  ? 'var(--ink-danger)'
             : p < 10 ? 'var(--ink-warning)' : 'var(--text-secondary)';
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
        + '<td' + TD + '><span style="color:' + (r.ok ? 'var(--ink-success)' : 'var(--ink-danger)')
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

// ── FEAD TAHRİKİ (krank → sürücü kasnak) ────────────────────────────────────
// FEAD kayışının sürücü kasnağı krank milinde olmak zorunda değil: tipik BMC
// düzeninde krank ayrı bir kademeyle fan kasnağını döndürüyor, FEAD kayışı da
// onun üzerinden tahrik ediliyor. Tedarikçi sayfası oranı İKİ ÇAPLA veriyor
// (krank 197.32 / fan 179.62 = 1.0985 ≈ 1.1), tek bir sayıyla değil.
//
// SORU SİHİRBAZLA AYNI SORU, LİSTE DE AYNI LİSTE (`VE_FEAD_DRIVE_MODES`,
// fead-model.js) — gerekçesi ve ölçümü orada. Buraya ikinci bir seçenek
// listesi yazmak, sihirbazdan kurulan modelin panelde BAŞKA bir düzen
// göstermesi demekti; bir kez öyle oldu.
function veFeadDriveCard(node){
  var sd = node.data || {};
  var dr = veFeadDriveRatio(sd);

  // ALANLAR SEÇİLEN DÜZENDEN GELİR, ÇÖZÜLEN DÜZENDEN DEĞİL. `veFeadDriveRatio`
  // çaplar boşken 'derive'ı 'direct'e düşürüyor (oran hâlâ okunabilsin diye);
  // kart o düşüşü izleseydi "ara kademe" seçili ama daha hiçbir çap
  // girilmemişken çap alanları KAYBOLURDU ve kullanıcı onları bir daha
  // giremezdi.
  var kip = veFeadDriveModeOf(sd, true);

  // ESKİ KAYDIN KUYRUĞU: `direct` listede YOK, ama düğüm onu taşıyorsa
  // seçenek olarak basılır — yoksa hiçbir <option> seçili olmaz ve tarayıcı
  // başka bir düzen gösterir (ölçülmüş kusurun ta kendisi). Kullanıcı bir kez
  // ayrıldığında geri gelmez: yeni bir `direct` üretecek yüzey kalmadı.
  var secenekler = VE_FEAD_DRIVE_MODES.slice();
  if(kip === 'direct') secenekler.push(['direct', 'Oran elle girilmiş — ESKİ KAYIT']);

  var inner = _feadSelect(node, 'Düzen', 'ratioMode', secenekler, 'derive',
      'Oran = sürücü kasnak devri / motor devri. Krank kasnağı fan kasnağından büyükse '
      + 'sürücü kasnak motordan HIZLI döner (oran &gt; 1). FEAD\'i tahrik eden ÇAP burada '
      + 'sorulmaz — o, Kayış Tablosu\'nun sürücü satırındadır.');

  // İLK DÜZENDE HİÇBİR ALAN YOK — sorulacak bir şey de yok: krank kasnağının
  // kendisi sürücü kasnak, oran tanımı gereği 1 ve çapı zaten Kayış
  // Tablosu'nda. İkincisinde krank çapı bir MOTOR VERİSİDİR (rapora girer,
  // orana girmez); üçüncüsünde iki çap da oranı kurar.
  if(kip === 'crankDirect'){
    inner += _feadHint('Krank kasnağı doğrudan kayışı çeviriyor: oran <b>1,0000</b> ve '
      + 'türetilecek bir çap yok. Aksesuar devri = motor devri × '
      + '(sürücü kasnak pitch çapı / aksesuar pitch çapı).');
  } else if(kip === 'unity'){
    inner += _feadGrid(node, [
      { key:'crankOD', label:'Krank kasnağı Ø [mm] — motor verisi', ph:'197.32' }
    ], 1);
    inner += _feadHint('Sürücü kasnak krankla aynı milde ve aynı devirde: oran '
      + '<b>1,0000</b>. Krank kasnağının kendi çapı KAYITLIDIR ve rapora girer, '
      + 'ama orana girmez — FEAD\'i tahrik eden çap sürücü kasnağınkidir.');
  } else if(kip === 'direct'){
    inner += _feadGrid(node, [
      { key:'driveRatio', label:'Tahrik oranı [—]', ph:'1', step:'0.0001' }
    ], 1);
    inner += _feadHint('<b>Eski kayıt.</b> Elle yazılmış oran artık sorulmuyor '
      + '(kullanıcı kararı, 2026-09-01): Excel\'deki elle yazılmış hız oranları '
      + 'bütün gerilmeleri %17 düşürüyordu. Değer OKUNMAYA devam ediyor; düzeni '
      + 'yukarıdan değiştirirseniz bu satır bir daha görünmez.');
  } else {
    inner += _feadGrid(node, [
      { key:'crankOD', label:'Krank kasnağı Ø [mm]', ph:'197.32' },
      { key:'fanOD',   label:'Kademenin sürülen kasnağı Ø [mm]', ph:'179.62' }
    ], 2);
  }

  // ORAN ÇÖZÜLEMEDİYSE KİP ADI YAZILMAZ. Köprü çap eksikken 'direct'e düşüyor
  // ve etiketi "elle girildi" — panelde elle girilecek bir alan yokken bu
  // cümle kullanıcıyı olmayan bir kutuya yönlendiriyordu.
  var etiket = dr.ok ? veFeadDriveModeLabel(dr.mode) : 'çözülemedi — çap eksik';
  var deg = '<div style="font-size:var(--fs-micro); line-height:1.5; padding:7px 9px; margin-bottom:9px; '
    + 'background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:var(--radius-sm); '
    + 'display:flex; justify-content:space-between; gap:8px;">'
    + '<span style="color:var(--text-muted);">Kullanılan tahrik oranı</span>'
    + '<span style=" font-weight:700; color:'
    + (dr.ok ? 'var(--ink-accent)' : 'var(--ink-warning)') + ';">'
    + _feadFmt(dr.ratio, 4) + (dr.mode === 'derive' ? '  (' + _feadFmt(dr.crankOD, 2) + ' / ' + _feadFmt(dr.fanOD, 2) + ')' : '')
    + '  <span style="font-weight:400; color:var(--text-muted);">' + etiket + '</span>'
    + '</span></div>';

  return _feadCard('FEAD Tahriki', 'krank → sürücü kasnak', 'var(--accent-warning)',
    inner + deg
    + _feadHint('Bu oran aksesuar devirlerinin TAMAMINI ölçekler: aksesuar devri = motor devri '
      + '× tahrik oranı × (sürücü kasnak pitch çapı / aksesuar pitch çapı). Yanlış girilirse '
      + 'bütün güç ve gerilme sonuçları aynı oranda kayar.'));
}

// ── MOTOR KÜNYESİ ───────────────────────────────────────────────────────────
// Sayfadaki "Engine Info" tablosunun karşılığı. HER ALANIN NEREYE GİRDİĞİ
// AÇIKÇA YAZILI — ve bu kart iki kez o kuralın KENDİ ihlali oldu:
//
//   1. "No load governed" ALANI KALKTI (0 tüketici). `governedRpm` ve
//      `overspeedRpm` uygunluk kapılarını besliyor (js/fead-checks.js),
//      `idleRpm` geçici rejim senaryosunu (js/fead-transient.js) — no-load
//      governed'ı okuyan hiçbir hesap, kapı ya da rapor satırı YOK. Katalogda
//      duruyor (BMC'nin kendi künyesi, js/fead-engines.js) ve künye seçilince
//      veriye yazılıyor; SORULMUYOR. Kartın kendi doktrini buydu zaten:
//      sessizce alan açıp "girdim, hesaba girdi" izlenimi vermek hiç
//      sormamaktan kötüdür.
//   2. NOTU ÜÇ CANLI ALANI ÖLÜ İLAN EDİYORDU. "Krank ataleti · ivmelenme ·
//      yavaşlama … bu çekirdek onları hesaba katmaz" cümlesi yazıldığında
//      doğruydu; burulma modeli ve tepe yük tablosu geldikten sonra yanlış
//      kaldı. ÖLÇÜLDÜ (AG00976): krank ataleti 0,70 → 0,15 birinci burulma
//      modunu 12,947 → 15,014 Hz kaydırıyor (+%16,0); `accelRpmS` 1100 → 500
//      tepe tablosuna birebir geçiyor. Yanlış bir "kullanılmıyor" damgası,
//      kullanıcıyı gerçekten gereken alanı boş bırakmaya davet ediyordu.
function veFeadEngineCard(node){
  return _feadCard('Motor Künyesi', 'sayfadaki Engine Info', 'var(--text-secondary)',
      veFeadEngineLibRow(node)
    + _feadGrid(node, [
        { key:'cylinders',   label:'Silindir sayısı [—]', ph:'6', step:'1' },
        { key:'serviceFact', label:'Servis faktörü [—]',  ph:'1.3', step:'0.01' }
      ], 2)
    + _feadGrid(node, [
        { key:'idleRpm',      label:'Rölanti [d/dk]',   ph:'700',  step:'10' },
        { key:'governedRpm',  label:'Governed [d/dk]',  ph:'2100', step:'10' },
        { key:'overspeedRpm', label:'Overspeed [d/dk]', ph:'2900', step:'10' }
      ], 3)
    + _feadGrid(node, [
        { key:'crankInertia', label:'Krank ataleti [kg·m²]', ph:'0.70', step:'0.01' },
        { key:'accelRpmS',    label:'İvmelenme [RPM/s]',     ph:'1000', step:'10' },
        { key:'decelRpmS',    label:'Yavaşlama [RPM/s]',     ph:'1000', step:'10' }
      ], 3)
    + _feadHint('<b>Silindir sayısı</b> ateşleme frekansını verir (f = devir/60 × silindir/2, '
        + 'dört zamanlı) ve span rezonans kontrolünde kullanılır. <b>Servis faktörü</b> kayma '
        + 'emniyeti için istenen alt sınır olarak sonuç sekmesinde karşılaştırılır. '
        + '<b>Governed</b> ve <b>Overspeed</b> aksesuar devir penceresi ve devir sınırı '
        + 'kapılarını besler, <b>Rölanti</b> geçici rejim senaryosunu. <b>Krank ataleti</b> '
        + 'burulma modelinin sürücü atalet terimidir — boş bırakılırsa birinci mod belirgin '
        + 'biçimde YÜKSEK çıkar. <b>İvmelenme</b> ve <b>yavaşlama</b> tepe yük / hubload '
        + 'tablosuna girer.'));
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
  var h = '<div class="ve-fp-grid" style="--fp-k:1;">'
    + '<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">BMC motor kataloğu</span>'
    + '<select onchange="veFeadApplyEngineLib(\'' + node.id + '\',this.value)"'
    + ' class="ve-fp-sel">'
    + '<option value="">— elle gir —</option>';
  liste.forEach(function(r){
    h += '<option value="' + _feadEsc(r.key) + '"' + (r.key === sec ? ' selected' : '') + '>'
       + _feadEsc(r.label) + '</option>';
  });
  h += '</select></label></div>';

  var d = (typeof veFeadEngineDrift === 'function') ? veFeadEngineDrift(sd) : null;
  if(d && d.drift.length)
    h += _feadHint('<b style="color:var(--ink-warning);">Katalogdan sapıldı:</b> '
      + _feadEsc(d.drift.join('; ')) + '. Bu bir hata değil — kayıt varyanta göre '
      + 'değişebilir; ama bir yazım hatası da tam burada görünür.');
  else if(d)
    h += _feadHint('Alanlar <b>' + _feadEsc(d.ad) + '</b> kaydıyla birebir.');
  return h + _feadHint('Yirmi dört motor, BMC\'nin kendi FEAD hesap defterinin '
    + '<i>Motor Bilgileri</i> sayfasından. Seçim <b>silindir sayısını, devir sınırlarını ve '
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
    // Pencerenin öteki alanlarıyla AYNI satır (etiket üstte, sol kenarda):
    // burada kendi satır içi etiketi vardı ve pencerede tek başına başka
    // biçimde yazılıyordu (2026-09-23).
    dSec = '<div class="ve-fp-grid" style="--fp-k:1;">'
      + '<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">Çevrim kaydı</span>'
      + '<select onchange="if(this.value) veFeadDutyLib(\'' + node.id + '\', this.value)"'
      + ' class="ve-fp-sel">' + dOps + '</select></label></div>';
  }

  // ÇEVRİM TABLOSU KENDİ KABINDA KAYAR, pencere kaymaz. Dokuz sütunlu bir
  // veri ızgarası 380 px'lik müfettiş sütununa sığmaz; sığdırılmaya çalışılınca
  // girdiler 14–37 px'e EZİLİYORDU ("880" devir 23 px'lik kutuda — ölçüldü).
  // Görünüm CSS'te (`.ve-fp-duty*`, kural 14). Eski satır içi sürümün kW
  // girdisinde bir ARTIK vardı: stil sınıfa taşınırken kapanış tırnağı
  // kalmış, `class="…" color:var(--text-muted);"` diye öznitelik dışında çöp
  // basıyordu (tarayıcı sessizce yutuyordu).
  var h = '<div class="ve-fp-duty"><table class="ve-pnl-tbl ve-pnl-tbl--framed ve-pnl-tbl--tiny ve-fp-duty-tbl"><thead><tr>'
     + ['Devir', '%zaman', '°C'].map(function(t){ return '<th>' + t + '</th>'; }).join('')
     + yuk.map(function(n){
         return '<th title="' + _feadEsc(_feadNodeName(n)) + ' [kW]">' + _feadEsc(_feadNodeName(n)) + '</th>';
       }).join('')
     + '<th aria-label="Sil"></th></tr></thead><tbody>';

  if(!rows.length){
    h += '<tr><td colspan="' + (4 + yuk.length) + '" class="ve-fp-duty-bos">Henüz devir noktası yok.</td></tr>';
  }
  rows.forEach(function(r, ri){
    var cell = function(key, val, step){
      return '<td class="tight">'
        + '<input type="number" value="' + _feadEsc(val) + '" step="' + (step || 'any') + '"'
        + ' onchange="veFeadDutySet(\'' + node.id + '\',' + ri + ',\'' + key + '\',this.value)"'
        + ' class="ve-fp-inp ve-fp-inp--tight"></td>';
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
      h += '<td class="tight">'
        + '<input type="number" value="' + _feadEsc(v) + '" step="0.01"'
        + (oto != null ? ' placeholder="' + _feadFmt(oto, 2) + '"' : ' placeholder="0"')
        + ' title="' + (oto != null ? 'Katalogdan: ' + _feadFmt(oto, 2) + ' kW (boş bırakırsanız bu kullanılır)' : 'Boş = 0 kW')
        + '" onchange="veFeadDutySet(\'' + node.id + '\',' + ri + ',\'kw:' + n.id + '\',this.value)"'
        + ' class="ve-fp-inp ve-fp-inp--tight"></td>';
    });
    h += '<td class="tight"><button type="button" class="ve-fp-duty-sil"'
      + ' onclick="veFeadDutyRemove(\'' + node.id + '\',' + ri + ')" title="Satırı sil" aria-label="Satırı sil">×</button></td></tr>';
  });
  h += '</tbody></table></div>';

  var toplam = rows.reduce(function(a, r){ return a + r.dcPct; }, 0);
  // Uyarı BİRİMİN İÇİNDE: tablo pencerede doldurulurken de görünsün.
  var uyari = '';
  if(rows.length && Math.abs(toplam - 100) > 0.5)
    uyari = _feadHint('<b style="color:var(--ink-warning);">%zaman toplamı ' + _feadFmt(toplam, 1)
      + '</b> — 100 değil. Yorulma ve ömür payları bu ağırlıklara göre dağıtılır; '
      + 'toplam 100 değilse mutlak ömür ölçeklenir (dağılım yüzdeleri etkilenmez).');
  h += '<div class="ve-fp-eylem">'
    + '<button type="button" class="ve-fp-dugme" onclick="veFeadDutyAdd(\'' + node.id + '\')">+ Devir satırı</button>'
    + '<button type="button" class="ve-fp-dugme" onclick="veFeadDutyFillCatalog(\'' + node.id + '\')"'
    + ' title="Boş kW hücrelerini seçili katalog eğrilerinden doldur">Katalogdan doldur</button>'
    + '</div>';

  // TABLO + DÜĞMELERİ TEK BİRİM (js/tablo-pencere.js): sütuna sığmazsa
  // birimin yerinde bir özet kartı kalır ve "Tabloyu aç" onu küçük bir
  // pencereye taşır. Satır ekleyen düğme birimin İÇİNDE — pencerede
  // doldurulan tabloya satır da pencereden eklenebilsin.
  var devirler = rows.map(function(r){ return _feadNum(r.rpm, NaN); })
    .filter(function(v){ return Number.isFinite(v); });
  var ozet = rows.length + ' devir noktası'
    + (devirler.length ? ' · ' + Math.min.apply(null, devirler) + '–' + Math.max.apply(null, devirler) + ' d/dk' : '')
    + ' · ' + yuk.length + ' aksesuar sütunu';
  h = '<div class="ve-tablo" data-ve-tablo="fead-duty:' + _feadEsc(node.id) + '"'
    + ' data-ve-tablo-baslik="Çalışma Çevrimi" data-ve-tablo-ozet="' + _feadEsc(ozet) + '">' + h + uyari + '</div>';


  return _feadCard('Çalışma Çevrimi', 'sürücü sütunu YOK — gücü hesaplanır', 'var(--accent-success)',
    dSec + h
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
    // "Kol [°]" üç büyüklükten HANGİSİ olduğunu söylemiyordu (burada GÖRELİ
    // dönme basılıyor — raporun §8.8'i aynı satırı "Kol açısı — göreli" diye
    // adlandırıyor). Tek ad, tek sayı.
    + ['Konum','Kol dönmesi — göreli [°]','Gerginlik [N]','Hubload [N]','Yön [°]','β [°]','Sarım [°]'].map(function(t){
        return '<th style="padding:4px 5px; border:1px solid var(--border-color); text-align:left; font-weight:600; color:var(--text-secondary);">'+t+'</th>';
      }).join('') + '</tr>';
  rows.forEach(function(r){
    var isLoad = r.position === 'Load';
    if(r.error){
      h += '<tr><td style="padding:4px 5px; border:1px solid var(--border-color);">' + (ad[r.position] || r.position) + '</td>'
        + '<td colspan="6" style="padding:4px 5px; border:1px solid var(--border-color); color:var(--ink-danger);">'
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

// "BAŞLANGIÇ VE ÖRNEKLER" PANELİ KALDIRILDI (2026-09-09, kullanıcı isteği).
// Bileşenin kendisi de kalktı (bkz. components.js). Sunduğu iki şey —
// "Sihirbazı Aç" düğmesi ve örnek açılır listesi — sihirbazın 1. adımında
// zaten vardı; FEAD'e girince artık doğrudan sihirbaz açılıyor.
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
  // BİR KULLANICI EYLEMİ = BİR GERİ-AL ADIMI (bkz. js/state.js → veStateBatch).
  // Bu kurucu ONİKİ düğüm kuruyor ve `createNode` her birinde `saveState()`
  // çağırıyor: sarılmazsa Ctrl+Z modeli düğüm düğüm SÖKER (ölçüldü — 12.
  // basışta Kayış Tablosu boşalıyor, 13.'te kart tamamen gidiyordu).
  // Yığın zaten toplu kurulumdaysa (sihirbaz açılış yüzeyini çağırıyor)
  // ikinci kez sarılmaz — sayaç iç içe geçmeyi taşıyor.
  if(typeof veStateBatch === 'function' && typeof veStateBatchActive === 'function'
     && !veStateBatchActive())
    return veStateBatch(function(){ return veFeadLoadExample(key); });
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
  // Araç kartlarının yedek yerleşimi ORTAK YERDEN (`veFeadFallbackSlots`):
  // kanvaslar sağda BİR SIRA, künyeler solda. İkinci bir yedek yazmak,
  // yerleştirici patladığında iki kurucunun iki ayrı resim vermesi demekti.
  // TEK ÇAĞRI: sayaçlar (kaçıncı araç · kaçıncı kanvas) fonksiyonun içinde
  // yürüyor, düğüm başına çağırmak hepsini aynı yuvaya yığardı.
  var sagSerit = 60 + (maxX - minX) * s + 110;
  // SOL ŞERİT BLOĞA YASLANIR, kasnak kümesinin soluna DEĞİL. `lx:0` kayış
  // düzleminin sol kenarı ve kasnakların kanvasta kutusu YOK, yani künyeler
  // oraya konunca aralarında kümenin genişliği kadar BOŞLUK kalıyordu
  // (ölçüldü: yedek yolda blok 1689 px, yerleştiricininki 1089).
  var _yuva = veFeadFallbackSlots(pack.nodes.slice(pack.example.pulleys.length),
                                  { sagX: sagSerit, solX: sagSerit - 210 });
  _yuva.forEach(function(slot){ yer.push(slot || { lx: -150, ly: 150 }); });
  var ust = _yuva.solAdet || 0;          // sol şeritte sıradaki boş satır

  var base = (typeof veArrangeModuleBase === 'function')
    ? veArrangeModuleBase(yer) : { x:3000, y:3000 };

  // İÇ TOPOLOJİDE ZATEN DURAN ARAÇ DÜĞÜMLERİ DE SOL ŞERİDE — kullanıcının kendi
  // eklediği kasnaklara dokunulmuyor. Bu yalnız bir YEDEK yerleşim: asıl işi
  // aşağıdaki `veFeadArrangeByCoords` yapıyor ve o, araç düğümlerini kümenin
  // dışındaki iki şeride koyuyor. Yerleştirici çalışamazsa (iki kasnaktan az
  // koordinat) geçerli kalan sıra budur.
  //
  // ÖLÇÜT "şu dört tipten biri" DEĞİL, "kutusu var ve kasnak değil". Sayılı bir
  // liste (belt · solver · report · table) açılış yüzeyinin kurduğu SİHİRBAZ
  // düğümünü dışarıda bırakıyordu: yerleştirici onu topladığı için olağan
  // yolda görünmüyordu, YEDEK yolda ise kart yerinde kalıp yeni kurulanların
  // ÜSTÜNE biniyordu (ölçüldü: gerçek tarayıcı, bir çakışma).
  var _eskiArac = [];
  if(typeof nodes !== 'undefined') {
    nodes.forEach(function(n){
      if(typeof veIsCanvasHidden === 'function' && veIsCanvasHidden(n)) return;
      if(_feadDefOf(n).isFeadPulley) return;
      _eskiArac.push(n);
    });
  }
  // BUNLAR DA AYNI YUVA ÜRETİCİSİNDEN GEÇER. Eskiden hepsi koşulsuz SOL
  // şeride diziliyordu: açılış yüzeyinin kurduğu BÜYÜK kart (o gün Kayış
  // Tablosu, bugün boş Kayış Yolu) künyelerin arasına düşüyordu. Yerleştirici
  // bunu düzelttiği için görünmüyordu — YEDEK yolda görünüyor (ölçüldü: gerçek
  // tarayıcı, yedek yolda blok 1689 px genişliyordu, 993 yerine).
  veFeadFallbackSlots(_eskiArac, { sagX: sagSerit, solX: sagSerit - 210,
                                  ustBasla: ust, kanvasBasla: _yuva.kanvasAdet || 0 })
    .forEach(function(slot, i){
      var n = _eskiArac[i];
      if(!n || !slot) return;
      n.x = Math.round(base.x + slot.lx);
      n.y = Math.round(base.y + slot.ly);
      var el = (typeof document !== 'undefined') ? document.getElementById(n.id) : null;
      if(el){ el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
    });

  // KANVAS KARTI YENİDEN KULLANILIR — tip + ön ayar eşleşmesiyle, sihirbazın
  // `_fwAracAnahtar` kuralının aynısı. Açılış yüzeyi (Çizim Masası,
  // 2026-09-23) boş bir Kayış Yolu kartı koyuyor; örnek kendi geometri
  // kartını onun yanına kursa kanvasta ÜÇ çizim olurdu (ölçüldü).
  var _kanvasKuyruk = { geometri: [], isletme: [] };
  if(typeof nodes !== 'undefined') nodes.forEach(function(n){
    if(_feadDefOf(n).isFeadLayout)
      _kanvasKuyruk[(n.data && n.data.katOn === 'isletme') ? 'isletme' : 'geometri'].push(n);
  });

  var kuruldu = [], idMap = {};
  pack.nodes.forEach(function(src, i){
    if(_feadDefOf(src).isFeadLayout){
      var _q = _kanvasKuyruk[(src.data && src.data.katOn === 'isletme') ? 'isletme' : 'geometri'];
      var _m = (_q && _q.length) ? _q.shift() : null;
      if(_m){
        _m.data = Object.assign(_m.data || {}, JSON.parse(JSON.stringify(src.data || {})));
        // YERİNİ DE DEVRALIR: yukarıdaki döngü onu yeni kanvasların SAĞINA
        // koydu; devraldığı kartın yuvasına geçmezse yedek yolda sırada bir
        // kanvaslık boşluk kalır.
        _m.x = Math.round(base.x + yer[i].lx);
        _m.y = Math.round(base.y + yer[i].ly);
        var _mel = (typeof document !== 'undefined') ? document.getElementById(_m.id) : null;
        if(_mel){ _mel.style.left = _m.x + 'px'; _mel.style.top = _m.y + 'px'; }
        idMap[src.id] = _m.id;
        // KURULANLAR arasında sayılır — sihirbazla aynı kural: bildirimdeki
        // "N bileşen" modelin parçası olan her kartı sayar (ölçüldü: devralınan
        // kart sayılmayınca AG00976 "10 bileşen" diyordu, model 11).
        kuruldu.push(_m);
        return;
      }
    }
    // TEK KOPYALI ARAÇ DÜĞÜMÜ ZATEN VARSA HİÇ DENEME. createNode ikincisini
    // zaten reddediyor ama bir UYARI TOAST'ı basıyordu ve kullanıcı örneği
    // kurarken "… topolojide en fazla 1 tane olabilir" görüyordu (o gün
    // açılış yüzeyinin Kayış Tablosu'yla) — ÖLÇÜLDÜ
    // (gerçek tarayıcı, AG00976). Zaten duran düğüm KULLANILIR: kimlik
    // haritasına o yazılır, yoksa ona başvuran bir alan öksüz kalırdı.
    var _d1 = (typeof componentDefs !== 'undefined' && componentDefs[src.type]) || {};
    if(_d1.maxInstances && typeof nodes !== 'undefined'){
      var _var = nodes.filter(function(n){ return n.type === src.type; });
      if(_var.length >= _d1.maxInstances){ idMap[src.id] = _var[0].id; return; }
    }
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
  // "Başlangıç ve Örnekler" düğümünü silen döngü KALKTI: o bileşen artık hiç
  // kurulmuyor (2026-09-09, kullanıcı isteği — sihirbaz aynı işi yapıyordu).

  // KUTULARI KOORDİNATLARINA OTURT — kanvas ile mm ilk kareden itibaren AYNI
  // şeyi söylesin. Sessiz kip: saveState/toast/kamera bu fonksiyonun kendisine
  // ait (ikinci bir undo adımı ve üst üste iki bildirim istenmiyor).
  if(typeof veFeadArrangeByCoords === 'function'){
    try { veFeadArrangeByCoords({ silent: true }); } catch(e){ /* yedek: yukarıdaki sıra */ }
  }
  // SAYAÇ TAZELENİR. `nodes` dizisi doğrudan splice edildi (deleteSelectedNodes
  // bilerek kullanılmıyor — o `selectedNodes` global'ini tüketiyor), dolayısıyla
  // araç çubuğunun "N bileşen" sayacı ve minimap kendiliğinden güncellenmiyor.
  // ÖLÇÜLDÜ (gerçek tarayıcı): sihirbaz kurulumundan sonra dizi 12 düğüm
  // taşırken çubuk 13 diyordu — bir sonraki topoloji değişimine kadar bayat.
  if(typeof updateNodeCount === 'function') updateNodeCount();
  if(typeof updateAllConnections === 'function') updateAllConnections();
  if(typeof veFeadRefreshBadges === 'function') veFeadRefreshBadges();
  _feadForgetResults();
  if(typeof veFitViewToContent === 'function') veFitViewToContent();
  if(typeof saveState === 'function') saveState();
  if(typeof showToast === 'function')
    showToast(pack.example.name + ' kuruldu — ' + kuruldu.length + ' bileşen, '
      + kuruldu.filter(function(n){ return _feadIsPulley(n); }).length
      + ' kasnak kayış sırasında.', 'success');
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
  // SONUCUN KİMLİĞİ: hangi modelin, ne zaman. İmza kurulumdan SONRA alınır —
  // kurulum eski kayıt göçünü düğümlere yazıyor, önce alınsaydı ilk bakışta
  // her sonuç "bayat" görünürdü (bkz. veFeadModelSig, veFeadResultState).
  res.solvedAt = Date.now();
  res.sig = (typeof veFeadModelSig === 'function' && typeof nodes !== 'undefined')
    ? veFeadModelSig(nodes) : null;
  // SONUÇLAR PANOSUNA YAYIN — Takoz'un kalıbı (cp-mount.js `R.signals`). Veri
  // kümeleri ÇÖZÜM ANINDA ve çözülen modelden kurulur; üretilemezse pano boş
  // kalır, çözüm yine döner. Ağaç burada TAZELENMEZ: kullanıcı modülün içinde,
  // Sonuçlar'a geçtiğinde `veEnterResults` zaten tazeliyor.
  try {
    res.signals = (res.ok && typeof veFeadSignals !== 'undefined' && veFeadSignals)
      ? veFeadSignals.build(res) : [];
  } catch(e){ res.signals = []; }
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
// ─── SONUÇ DURUMU — "bu sayılar hâlâ bu modelin mi?" ────────────────────────
// Çözücü düğümünü taşıyan CANLI model listesi. İçerideysek global `nodes`;
// kökteysek (Sonuçlar sayfası, modül kartı) modül kartlarının alt topolojisi;
// başka bir FEAD kartının içindeysek yığında bekleyen kök durum. Bulunamazsa
// null — sonuç, projede artık olmayan bir modele ait.
function veFeadLiveModelNodes(solverId){
  if(!solverId) return null;
  var has = function(list){
    for(var i = 0; i < list.length; i++) if(list[i] && list[i].id === solverId) return true;
    return false;
  };
  var subOf = function(list){
    for(var i = 0; i < (list || []).length; i++){
      var n = list[i];
      var sub = n && n.type === 'fead-analysis' && n.data && n.data.subTopology;
      if(sub && Array.isArray(sub.nodes) && has(sub.nodes)) return sub.nodes;
    }
    return null;
  };
  var cur = (typeof nodes !== 'undefined' && Array.isArray(nodes)) ? nodes : [];
  if(has(cur)) return cur;
  var hit = subOf(cur);
  if(hit) return hit;
  for(var k = veFeadStack.length - 1; k >= 0; k--){
    var ps = veFeadStack[k] && veFeadStack[k].parentState;
    hit = subOf(ps && ps.nodes);
    if(hit) return hit;
  }
  return null;
}
// Hüküm: { k, metin, R } — k ∈ yok · hata · guncel · bayat · kayip · bilinmiyor.
// `nodeId` verilirse BAŞKA bir çözücünün sonucu bu çözücü için "yok"tur.
// Paneller, Sonuçlar sekmesi ve rapor aynı çağrıyı okur: üç yüzeyin bayatlığı
// üç ayrı yoldan ölçmesi, üçünün sessizce ayrışması demekti.
function veFeadResultState(R, nodeId){
  if(R === null || R === undefined)
    R = (typeof window !== 'undefined') ? window.veFeadResults : null;
  if(!R) return { k: 'yok', metin: 'yok', R: null };
  if(nodeId && R.solvedNodeId && R.solvedNodeId !== nodeId) return { k: 'yok', metin: 'yok', R: null };
  if(!R.ok) return { k: 'hata', metin: 'çözüm hatası', R: R };
  var list = veFeadLiveModelNodes(R.solvedNodeId);
  if(!list) return { k: 'kayip', metin: 'modeli projede yok', R: R };
  var sig = (typeof veFeadModelSig === 'function') ? veFeadModelSig(list) : null;
  if(!R.sig || !sig) return { k: 'bilinmiyor', metin: 'var', R: R };
  if(sig !== R.sig) return { k: 'bayat', metin: 'BAYAT — model değişti', R: R };
  return { k: 'guncel', metin: 'güncel', R: R };
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
  if(!R) return _feadCard('Sonuç', 'henüz hesap yok', 'var(--text-muted)',
    _feadHint('Sağ sütundaki <b>▶ Hesapla</b> modeli çözer. Sonuçlar burada özetlenir; '
      + 'grafikler ve tablolar <b>Sonuçlar</b> sayfasının <b>FEAD</b> sekmesinde açılır.'));
  if(R.solvedNodeId && node && R.solvedNodeId !== node.id) return '';
  if(!R.ok) return veFeadProblemBox({ errors: [R.error || 'Çözüm başarısız.'] });

  var h = veFeadResultCard(R, node);
  if(R.duty && R.duty.length) h += veFeadResultVerdicts(R);
  h += veFeadLimitsBox(R);
  return h;
}

// ── SONUÇ KARTI — pencerede ÖZET, ayrıntı Sonuçlar'da ──────────────────────
//
// Bu sekme bir dönem beş kart taşıyordu (devir × kasnak gerginlik tablosu,
// hubload tablosu, burulma, yorulma, ömür) — 380 px'lik müfettiş sütununda
// yatay kaydırılan tablolar. Hepsi 2026-09-24'te Sonuçlar sayfasının FEAD
// sekmesine taşındı (grafik + Sonuç Özeti penceresi, js/cp-fead-results.js);
// aynı tabloyu iki yüzeyde tutmak modülün "tek kaynak" kuralına ters.
// Burada kalan: sonucun DURUMU (güncel / BAYAT), özet kartları (Sonuçlar'ın
// kartlarıyla AYNI üretici) ve teşhis hükümleri.
function veFeadResultCard(R, node){
  var st = veFeadResultState(R, node && node.id);
  var h = (typeof veFeadResChipHTML === 'function') ? veFeadResChipHTML(st) : '';
  if(st.k === 'bayat')
    h += _feadHint('<b style="color:var(--ink-warning);">Model çözümden sonra değişti</b> — aşağıdaki '
      + 'sayılar ESKİ modele ait. <b>▶ Hesapla</b> ile yeniden çözün.');
  if(typeof veFeadResKpiHTML === 'function') h += veFeadResKpiHTML(R);
  var kume = (R.signals && R.signals.length) || 0;
  h += '<button type="button" class="ve-fr-ac" onclick="veFeadOpenResults()"'
    + (kume ? '' : ' disabled') + '>'
    + '<span class="mf-ico mf-ico-trending-up"></span>Sonuçlar\'da aç — grafikler ve tablolar</button>';
  return _feadCard('Sonuç', kume ? kume + ' veri kümesi' : '', 'var(--accent-primary)', h);
}

// ── TEŞHİS HÜKÜMLERİ — SEBEBİ SÖYLE, ULAŞILAMAZ BİR ÇARE GÖSTERME ──────────
//
// Hükmün kendisi kaldı, tablosu Sonuçlar'a taşındı. En düşük SF YALNIZ YÜK
// TAŞIYAN kasnaklardan (gerginlik oranı ≥ VE_FEAD_SLIP_LOADED_RATIO) —
// raporun `_frMinSF`'i ve özet kartlarıyla AYNI küme. Oran ≈ 1 olan bir
// avarada SF bir marj değil o sarım açısının KAPASİTESİDİR; tabloyu eskiden
// bu ayrım olmadan tarıyorduk. Hiç yük taşıyan yoksa bütün kasnaklar.
//
// Metinlerin geçmişi: bir dönem "tasarım gerginliğini yükseltin" diyordu;
// tasarım gerginliği 2026-08-25'te GİRDİ OLMAKTAN ÇIKTI (yay dengesinden
// türüyor). Asıl sebep gerginin yeri: kayış ters yönde gezilirse gergi krankın
// GERGİN tarafına düşüyor ve açıklıklar ankrajın altına iniyor.
function veFeadResultVerdicts(R){
  var A = R.analysis || { duty: [] };
  var SF_ist = _feadNum(R.serviceFact, 0);
  var esik = (typeof VE_FEAD_SLIP_LOADED_RATIO === 'number') ? VE_FEAD_SLIP_LOADED_RATIO : 1.01;
  var yuklu = {};
  A.duty.forEach(function(d){
    (d.slip || []).forEach(function(x, i){ if(_feadNum(x.tensionRatio, 0) >= esik) yuklu[i] = true; });
  });
  var herhangi = Object.keys(yuklu).length > 0;
  var enKucukSF = Infinity, enKucukRpm = null;
  A.duty.forEach(function(d){
    (d.slip || []).forEach(function(x, i){
      if(herhangi && !yuklu[i]) return;
      if(x.SF < enKucukSF){ enKucukSF = x.SF; enKucukRpm = d.engineRpm; }
    });
  });
  var h = '';
  var yon = R.tensionerSide || null;
  var tersYerlesim = !!(yon && yon.ok === false);
  // SERVİS FAKTÖRÜ HÜKMÜ — Motor Künyesi kartındaki söz burada karşılanıyor.
  // Girilmemişse hüküm satırı HİÇ çıkmaz: uydurma bir eşik gösterilmez.
  if(!tersYerlesim && SF_ist > 0 && Number.isFinite(enKucukSF)){
    var gecti = enKucukSF >= SF_ist;
    h += '<div class="ve-fr-hukum" data-d="' + (gecti ? 'ok' : 'no') + '">'
      + '<span>Servis faktörü ' + _feadFmt(SF_ist, 2) + ' &nbsp;·&nbsp; en kötü nokta ' + enKucukRpm + ' rpm</span>'
      + '<b>min SF = ' + _feadFmt(enKucukSF, 2) + (gecti ? '  ✓ GEÇTİ' : '  ✗ KALDI') + '</b></div>';
  }
  var neg = A.duty.some(function(d){ return d.warnings && d.warnings.length; });
  // NEGATİF GERİLMEDE KAYMA HÜKMÜ VERİLMEZ. `slipSafety` gevşek tarafı
  // 1e-9'a kenetliyor (fead-core.js), dolayısıyla çöken bir zincirde SF
  // −0.00 / 0.00 çıkıyor — o bir emniyet faktörü değil, sayısal gölge.
  var kayma = !tersYerlesim && Number.isFinite(enKucukSF) && enKucukSF < 1;
  if(tersYerlesim){
    h += _feadHint('<b style="color:var(--ink-danger);">Gergi kayışın GERGİN tarafında</b> — '
      + 'ankraj ' + _feadFmt(yon.anchorN, 1) + ' N iken ' + (yon.drain || []).length
      + ' açıklık onun altına iniyor (en düşük ' + _feadFmt(yon.minN, 1) + ' N, "'
      + _feadEsc(yon.minName || '—') + '"). Otomatik gergi <b>gevşek</b> tarafa konur. '
      + 'Çare kayış dönüş yönünü çevirmek ya da gergiyi kayış sırasında sürücünün önüne '
      + 'almaktır; tasarım gerginliği yay dengesinden türediği için yükseltilemez. '
      + '<b>Bu çözümde kayma emniyet faktörü hüküm vermez.</b>');
  } else {
    if(kayma) h += _feadHint('<b style="color:var(--ink-danger);">Kayma emniyet faktörü 1\'in altına '
      + 'iniyor</b> — kayış o devirde kaymaya başlar. Sarım açısını artırın (avara ekleyin ya da '
      + 'kasnak konumlarını değiştirin); gergi künyesi daha yüksek yay momenti veriyorsa o da '
      + 'ankrajı yükseltir.');
    if(neg) h += _feadHint('<b style="color:var(--ink-warning);">Bir açıklıkta negatif gerilme</b> — '
      + 'kayış gevşiyor. Ankraj (' + _feadFmt(yon && yon.anchorN, 1) + ' N) yay dengesinden '
      + 'türüyor; çekilen güç bu ankrajın taşıyabileceğinden fazla.');
  }
  return h ? _feadCard('Hüküm', 'çalışma (Mean) konumunda', 'var(--accent-warning)', h) : '';
}

function veFeadLimitsBox(R){
  if(!R.limits || !R.limits.length) return '';
  var h = '<ul style="margin:0; padding-left:18px; font-size:var(--fs-micro); line-height:1.6; color:var(--text-secondary);">';
  R.limits.forEach(function(x){ h += '<li>' + x + '</li>'; });
  (R.warnings || []).forEach(function(x){ h += '<li style="color:var(--ink-warning);">' + _feadEsc(x) + '</li>'; });
  return _feadCard('Geçerlilik Sınırları', 'spesifikasyon §7', 'var(--text-secondary)', h + '</ul>');
}

// Jest/Node köprüsü (tarayıcıda no-op)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Rapor penceresi (cp-fead-report.js) kasnak ailesinin BÖLÜM kalıbını
    // ondan alır — ikinci bir kart üreticisi yazmak iki dilin ayrışmasıydı.
    _feadCard: _feadCard, _feadRO: _feadRO, _feadHint: _feadHint,
    VE_FEAD_STARTER_LAYOUT: VE_FEAD_STARTER_LAYOUT,
    veFeadBeltPathD: veFeadBeltPathD, veFeadArmArrowSVG: veFeadArmArrowSVG,
    veFeadLayoutSVG: veFeadLayoutSVG,
    veFeadShortName: veFeadShortName, veFeadTensionColor: veFeadTensionColor,
    VE_FEAD_KATMANLAR: VE_FEAD_KATMANLAR,
    VE_FEAD_ON_AYARLAR: VE_FEAD_ON_AYARLAR,
    VE_FEAD_KAT_VARSAYILAN: VE_FEAD_KAT_VARSAYILAN,
    veFeadKatmanOnAyar: veFeadKatmanOnAyar,
    veFeadOnAyarOf: veFeadOnAyarOf, veFeadOnAyarDevir: veFeadOnAyarDevir,
    veFeadKatmanVarsayilan: veFeadKatmanVarsayilan,
    veFeadKatmanlar: veFeadKatmanlar,
    veFeadKatmanSet: veFeadKatmanSet,
    veFeadKatmanIslem: veFeadKatmanIslem,
    veFeadKatmanToggle: veFeadKatmanToggle,
    veFeadKatmanPanelHTML: veFeadKatmanPanelHTML,
    veFeadKatmanDugmeHTML: veFeadKatmanDugmeHTML,
    veFeadApplyBadge: veFeadApplyBadge,
    veFeadApplyBeltModeBadge: veFeadApplyBeltModeBadge,

    veFeadArmReadout: veFeadArmReadout, veFeadMountReadout: veFeadMountReadout,
    veFeadBandSVG: veFeadBandSVG,
    veFeadPinRows: veFeadPinRows, veFeadPinNote: veFeadPinNote,
    veFeadTensionerLibCard: veFeadTensionerLibCard, veFeadApplyTenLib: veFeadApplyTenLib,
    veFeadEngineLibRow: veFeadEngineLibRow, veFeadApplyEngineLib: veFeadApplyEngineLib,
    veFeadAccLimitCard: veFeadAccLimitCard, veFeadApplyAccLib: veFeadApplyAccLib,
    veFeadChecksCard: veFeadChecksCard,
    veFeadSet: veFeadSet,
    VE_FEAD_COORD_KEYS: VE_FEAD_COORD_KEYS,
    veFeadToggleBeltMode: veFeadToggleBeltMode,


    veFeadCurrentSpin: veFeadCurrentSpin,
    veFeadApplySpinBadge: veFeadApplySpinBadge, veFeadToggleSpin: veFeadToggleSpin,
    getFeadSpinPropertiesHTML: getFeadSpinPropertiesHTML,


    veFeadDerivedLengthHTML: veFeadDerivedLengthHTML,
    veFeadBeltCatalogCard: veFeadBeltCatalogCard,
    veFeadPickBelt: veFeadPickBelt,
    veFeadApplyLayoutCard: veFeadApplyLayoutCard,
    veFeadPosPicker: veFeadPosPicker,
    // Animasyon: yürüyüş + faz + döngü. Testler dişleri ve kolları doğrudan
    // bu saf fonksiyonlardan üretip ölçüyor (DOM'suz).
    _feadBeltWalk: _feadBeltWalk, _feadTeethPath: _feadTeethPath,
    _feadAnimSpec: _feadAnimSpec,                     // test: yükün ÇÖZÜLMÜŞ hâli
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
    _feadForgetResults: _feadForgetResults,           // test: animatör fazını sıfırla
    veFeadCompassPlace: veFeadCompassPlace, veFeadCompassReset: veFeadCompassReset,
    veFeadCompassDragStart: veFeadCompassDragStart,
    VE_FEAD_ROSE_W: VE_FEAD_ROSE_W, VE_FEAD_ROSE_HALF: VE_FEAD_ROSE_HALF,
    VE_FEAD_ANIM_ATTR: VE_FEAD_ANIM_ATTR,
    VE_FEAD_SPOKE_N: VE_FEAD_SPOKE_N, VE_FEAD_SPOKE_MIN_PX: VE_FEAD_SPOKE_MIN_PX,
    veFeadLayoutCardHTML: veFeadLayoutCardHTML,
    veFeadLayoutCardStrip: veFeadLayoutCardStrip,
    veFeadRefreshLayoutCards: veFeadRefreshLayoutCards,
    VE_FEAD_CARD_CLASS: VE_FEAD_CARD_CLASS,
    VE_FEAD_TABLE_CLASS: VE_FEAD_TABLE_CLASS,
    veFeadTabloAc: veFeadTabloAc, veFeadTabloKapat: veFeadTabloKapat,
    veFeadTabloToggle: veFeadTabloToggle, veFeadTabloAcikMi: veFeadTabloAcikMi,
    VE_FEAD_TBL_OPEN_ICON: VE_FEAD_TBL_OPEN_ICON,
    VE_FEAD_TABLE_COLS: VE_FEAD_TABLE_COLS,
    veFeadKartBolgeW: veFeadKartBolgeW,
    veFeadTableRows: veFeadTableRows,
    veFeadTableCardHTML: veFeadTableCardHTML,
    veFeadRefreshTableCards: veFeadRefreshTableCards,
    veFeadRefreshCards: veFeadRefreshCards,
    veFeadTableSet: veFeadTableSet, veFeadTableMove: veFeadTableMove,
    veFeadTableSetSpin: veFeadTableSetSpin,
    veFeadTableAdd: veFeadTableAdd,
    _feadScrollRowIntoView: _feadScrollRowIntoView, veFeadTableDelete: veFeadTableDelete,
    veFeadTableAddHTML: veFeadTableAddHTML,
    veFeadTableOpen: veFeadTableOpen,
    veFeadMarkSelectedRow: veFeadMarkSelectedRow,
    veFeadYolDurumu: veFeadYolDurumu, veFeadCizimBas: veFeadCizimBas,
    veFeadCizimUzerinde: veFeadCizimUzerinde, veFeadCizimIsaretle: veFeadCizimIsaretle,
    _feadCizimXf: _feadCizimXf, _feadCizimMm: _feadCizimMm,
    _feadTabloCizimiGoster: _feadTabloCizimiGoster, _feadTabloKameraGeri: _feadTabloKameraGeri,
    _feadTabloBoyut: _feadTabloBoyut, _feadTabloBaglam: _feadTabloBaglam,
    veFeadKasnakKaydir: veFeadKasnakKaydir, veFeadCizimTus: veFeadCizimTus,
    veFeadAciklikBul: veFeadAciklikBul, veFeadAciklikSec: veFeadAciklikSec,
    veFeadAradanAday: veFeadAradanAday,
    veFeadAradanEkle: veFeadAradanEkle, veFeadPaletUstunde: veFeadPaletUstunde,
    veFeadPaletBirak: veFeadPaletBirak, veFeadPaletBitti: veFeadPaletBitti,
    VE_FEAD_BIRAK_PX: VE_FEAD_BIRAK_PX,
    veFeadBeltDbHint: veFeadBeltDbHint,
    veFeadModelTable: veFeadModelTable,
    veFeadPositionTable: veFeadPositionTable,
    veFeadGeometryTable: veFeadGeometryTable,
    veFeadProblemBox: veFeadProblemBox,
    veFeadWarningBox: veFeadWarningBox, veFeadDefaultsBox: veFeadDefaultsBox,
    veFeadDutyEditor: veFeadDutyEditor, veFeadSolve: veFeadSolve,
    veFeadResultState: veFeadResultState, veFeadLiveModelNodes: veFeadLiveModelNodes,
    veFeadDutyAdd: veFeadDutyAdd, veFeadDutyRemove: veFeadDutyRemove,
    veFeadDutySeed: veFeadDutySeed, veFeadDutyLib: veFeadDutyLib,
    veFeadDutySet: veFeadDutySet, veFeadDutyFillCatalog: veFeadDutyFillCatalog,
    veFeadResultBlock: veFeadResultBlock, _feadForgetResults: _feadForgetResults,
    veFeadResultVerdicts: veFeadResultVerdicts, veFeadResultCard: veFeadResultCard,
    veFeadDriveCard: veFeadDriveCard, veFeadEngineCard: veFeadEngineCard,
    veFeadPowerCurveCard: veFeadPowerCurveCard,
    veFeadCurveAdd: veFeadCurveAdd, veFeadCurveRemove: veFeadCurveRemove,
    veFeadCurveSet: veFeadCurveSet, veFeadLoadExample: veFeadLoadExample,
    veFeadArrangeByCoords: veFeadArrangeByCoords,
    veFeadFallbackSlots: veFeadFallbackSlots,
    veFeadWizOpenAny: veFeadWizOpenAny,
    veFeadPopulateStarter: veFeadPopulateStarter,
    veFeadOpenEditor: veFeadOpenEditor,
    veFeadPanelTab: veFeadPanelTab, veFeadPanelTabOf: veFeadPanelTabOf,
    veFeadTabsHTML: veFeadTabsHTML, veFeadPulleySide: veFeadPulleySide,
    veFeadToolSide: veFeadToolSide, veFeadPanelShell: veFeadPanelShell,
    veFeadSekmeDurumlari: veFeadSekmeDurumlari, veFeadEksikBandi: veFeadEksikBandi,
    veFeadEksikGit: veFeadEksikGit, veFeadSekmeTazele: veFeadSekmeTazele, _feadSideGates: _feadSideGates,
    veFeadBeltSideRows: veFeadBeltSideRows,
    veFeadPanelTabState: function(){ return VE_FEAD_PANEL_TAB; },
    getFeadModulePropertiesHTML: getFeadModulePropertiesHTML,
    getFeadPulleyPropertiesHTML: getFeadPulleyPropertiesHTML,
    getFeadTensionerPropertiesHTML: getFeadTensionerPropertiesHTML,
    getFeadBeltPropertiesHTML: getFeadBeltPropertiesHTML,
    getFeadLayoutPropertiesHTML: getFeadLayoutPropertiesHTML,
    getFeadSolverPropertiesHTML: getFeadSolverPropertiesHTML,
  };
}
