// ═══════════════════════════════════════════════════════════════════════════
// FEAD GRAF YÜZÜ — kayış topolojisinin GİRDİ resmi
// ───────────────────────────────────────────────────────────────────────────
// Bu dosya, FEAD iç topolojisindeki düğümleri "kayış-kasnak sistemi gibi"
// gösterir: kasnak konumları GİRİLEN mm koordinatlarından, kasnak biçimi
// GİRİLEN çaptan, port yönü de KAYIŞ SIRASINDAN gelir. Tasarım etüdündeki
// A (geometrik yerleşim) + B (yöne bakan port) + D (kasnak biçimli düğüm)
// aşamalarının kod karşılığı.
//
// NEDEN GEREKLİ — üç ölçülmüş sebep (tasarım etüdü, kesişim sayıları hesaplı):
//   1. Konum: düğümler nereye bırakıldıysa orada duruyordu; kasnağın mm
//      koordinatı ekranda hiçbir şey ifade etmiyordu → BMC örneğinde 3 kesişim.
//   2. Port: her düğümde giriş SOLDA, çıkış SAĞDA sabitti. Kayış sağdan sola
//      dönerken tel düğümün üstünden geri geçmek zorunda kalıyordu.
//   3. Biçim: kasnak bir DİKDÖRTGEN olarak çiziliyordu; çap ekranda yoktu,
//      teğet noktası ve sarım kavramı çizilemiyordu.
//
// ── GRAF NE DEĞİLDİR ───────────────────────────────────────────────────────
// Graf, Kayış Yolu kartının (cp-fead.js veFeadLayoutSVG) yerine GEÇMEZ.
// Bölüşüm GÖRÜNTÜYE göre değil YETENEĞE göre:
//
//   Graf  = GİRDİ yüzeyi. Çözücü OLMADAN çizilebilen her şey: girilen merkez,
//           çap, temas tarafı, sürücü rolü, serpantin sırası, pivot. Yarım
//           kurulmuş modelde de (kayış kapanmamışken) çalışır. DÜZENLENEBİLİR.
//   Kart  = ÇIKTI yüzeyi. Yalnız çözücünün söyleyebildiği şey: sarım açıları,
//           span boyları, L_eff, Σsarım=360 kapısı, gerginlik, take-up ve
//           kolun AYNI ANDA birden çok konumu. SALT OKUNUR.
//
// Bu ayrım ölçüldü: doğru kurulmuş BMC modelinde girilen gergi montaj merkezi
// (−170.08, 99.16) ile çözücünün bulduğu çalışma merkezi (−170.12, 98.46)
// arasında 0.70 mm — ekranda ~0.21 px fark var. Yani model DOĞRUYKEN iki resim
// ayırt edilemez; AYRILDIKLARINDA (ters temas tarafı, ters pivot, işareti
// yanlış koordinat) fark teşhisin kendisidir. Tek yüzeye inilseydi
// karşılaştıracak ikinci kaynak kalmazdı.
//
// ── ÖLÇEK: 1 px = 1 mm ─────────────────────────────────────────────────────
// Konum ve çap AYNI ölçeği kullanır ve ölçek SABİTTİR. "Görünüme sığdıran"
// bir ölçek daha şık dururdu ama iki kasnağın ekrandaki oranı topolojiden
// topolojiye değişirdi; mühendislik çiziminde bunun bedeli var. Çok küçük
// kasnak tıklanamaz hâle gelmesin diye ALT SINIR var (VE_FEAD_MIN_DIA) —
// alt sınıra çarpan kasnak ölçekli DEĞİLDİR ve bu işaretlenir (clipped).
// Kanvasın kendi yakınlaştırması gerisini hallediyor.
// ═══════════════════════════════════════════════════════════════════════════

// Ölçek ve sınırlar — tek kaynak (CSS ve testler buradan okur).
var VE_FEAD_GRAPH_SCALE = 1;      // px / mm
var VE_FEAD_MIN_DIA     = 34;     // px — altında kasnak tıklanamaz olur
var VE_FEAD_MAX_DIA     = 320;    // px — Ø320'den büyük kasnak ekranı yutar
var VE_FEAD_TOOL_GAP    = 130;    // px — araç şeridi ile kasnak kümesi arası
var VE_FEAD_TOOL_STEP   = 96;     // px — araç şeridinde düğüm aralığı

// ── Kasnağın GİRİLEN merkezi (mm) ───────────────────────────────────────────
// Sıradan kasnak konumunu data.x/data.y ile verir. GERGİ VERMEZ: gergi
// kasnağının konumu yay dengesinden çözülür — ama kullanıcı tedarikçi
// sayfasından MONTAJ MERKEZİNİ (cenX/cenY) giriyor ve grafın göstereceği şey
// tam olarak odur (girdi yüzeyi). Montaj merkezi yoksa pivot + kol boyu +
// serbest açıdan türetilir; o da yoksa kasnak yerine pivot gösterilir —
// hiçbiri yoksa kasnak yerleştirilemez ve bu ayrıca raporlanır.
function veFeadEnteredCenter(node){
  var d = (node && node.data) || {};
  var out = { ok:false, x:NaN, y:NaN, from:'' };
  var isTen = !!(typeof _feadDefOf === 'function' && _feadDefOf(node).isFeadTensioner);
  if(!isTen){
    var x = _feadNum(d.x, NaN), y = _feadNum(d.y, NaN);
    if(Number.isFinite(x) && Number.isFinite(y)){ out.ok=true; out.x=x; out.y=y; out.from='xy'; }
    return out;
  }
  // SIRA, PANELİN HANGİ ALANI SORDUĞUNA BAĞLI. Panel iki kipte çalışıyor
  // (veFeadAngleMode): 'mount' montaj merkezini, 'direct' serbest kol açısını
  // soruyor. Graf bir GİRDİ yüzeyi — kullanıcının o an GİRDİĞİ sayıyı çizmek
  // zorunda. Sıra koşulsuz "önce cenX/cenY" olsaydı, kipini 'direct'e alıp
  // serbest açıyı değiştiren kullanıcı grafın kımıldamadığını görürdü: eski
  // montaj merkezi veride duruyor ama model onu ARTIK KULLANMIYOR. Yani graf
  // modelin okumadığı bir sayıyı çizerdi — sessiz ve tam da bu modülde en
  // pahalı olan hata türü.
  var cx = _feadNum(d.cenX, NaN), cy = _feadNum(d.cenY, NaN);
  var px = _feadNum(d.pivotX, NaN), py = _feadNum(d.pivotY, NaN);
  var arm = _feadNum(d.armLen, NaN), fa = _feadNum(d.freeAngleDeg, NaN);
  var mod = (typeof veFeadAngleMode === 'function') ? veFeadAngleMode(d) : 'mount';
  function mount(){
    if(!Number.isFinite(cx) || !Number.isFinite(cy)) return false;
    out.ok=true; out.x=cx; out.y=cy; out.from='mount'; return true;
  }
  function kol(){
    if(!Number.isFinite(px) || !Number.isFinite(py)) return false;
    if(!(Number.isFinite(arm) && arm > 0 && Number.isFinite(fa))) return false;
    var a = fa * Math.PI / 180;
    out.ok=true; out.x = px + arm*Math.cos(a); out.y = py + arm*Math.sin(a); out.from='arm';
    return true;
  }
  if(mod === 'direct'){ if(kol() || mount()) return out; }
  else               { if(mount() || kol()) return out; }
  if(Number.isFinite(px) && Number.isFinite(py)){
    out.ok=true; out.x=px; out.y=py; out.from='pivot';
  }
  return out;
}

// Kasnağın ekrandaki ÇAPI (px) ve o çapın DÜRÜSTLÜĞÜ.
//   hasOD  : çap GİRİLDİ mi. Girilmediyse tipe göre bir varsayılan (180 mm gibi)
//            kullanmak yerine NÖTR bir ölçü çizilir — 180 px'lik bir daire,
//            kullanıcının hiç yazmadığı bir çapı yazmış gibi gösterirdi.
//   toScale: çizilen çap gerçekten ölçekli mi (alt/üst sınıra çarpmadı mı).
// Çağıran ikisini de rozetler; "çizim ölçekli değilse kullanıcı bunu bilmeli".
var VE_FEAD_NODIA_DIA = 64;       // px — çapı girilmemiş kasnağın nötr ölçüsü
function veFeadGraphDiaInfo(node){
  var has = (typeof veFeadHasOD === 'function') ? veFeadHasOD(node)
          : (_feadNum(node && node.data && node.data.od, 0) > 0);
  if(!has) return { dia: VE_FEAD_NODIA_DIA, hasOD:false, toScale:false };
  var raw = _feadNum(node && node.data && node.data.od, 0) * VE_FEAD_GRAPH_SCALE;
  var dia = Math.max(VE_FEAD_MIN_DIA, Math.min(VE_FEAD_MAX_DIA, Math.round(raw)));
  return { dia: dia, hasOD:true, toScale: (raw >= VE_FEAD_MIN_DIA && raw <= VE_FEAD_MAX_DIA) };
}
function veFeadGraphDia(node){ return veFeadGraphDiaInfo(node).dia; }

// ── SAF PLANLAYICI ──────────────────────────────────────────────────────────
// DOM'suz: düğüm listesi + bağlantı listesi → yerleşim planı. Koordinatlar
// KÜME MERKEZİNE göre yereldir (anchor'ı uygulayan ekler) → test edilebilir.
//
// mm → ekran: (x, y)_mm  →  (x − cx, −(y − cy)) · s
// Y İŞARETİ TERS: mm düzlemi y-yukarı, kanvas y-aşağı. Kayış Yolu kartı da
// aynı çevirmeyi yapıyor (ty(y) = offY + (maxY − y)·s) — iki yüzey aynı
// yönelimi göstermezse kullanıcı ikisini karşılaştıramaz, ki tek işi bu.
//
// Döner: { ok, items:[{id,cx,cy,w,h,labelPos,clipped}], ports:{id:{input,output}},
//          order:[id], missing:[id], clipped:[id], span:{w,h}, reason }
function veFeadGraphPlan(nodeList, connList){
  var out = { ok:false, items:[], ports:{}, order:[], missing:[], clipped:[],
              span:{w:0,h:0}, reason:'' };
  var order = (typeof veFeadRouteOrder === 'function') ? veFeadRouteOrder(nodeList, connList) : [];
  if(!order.length){ out.reason = 'Kasnak yok.'; return out; }

  var placed = [];
  order.forEach(function(n){
    var c = veFeadEnteredCenter(n);
    if(c.ok) placed.push({ node:n, mm:c });
    else out.missing.push(n.id);
  });
  if(placed.length < 2){
    out.reason = 'Geometrik yerleşim için en az iki kasnağın merkez koordinatı gerekiyor ('
               + placed.length + ' tanesi girilmiş).';
    return out;
  }

  // Küme merkezi: KASNAK ÇEPERLERİNİN sınır kutusu (merkezlerin değil) —
  // Ø162 krank ile Ø57 alternatör aynı kümedeyken merkezlerin ortası kümeyi
  // gözle sağa kaydırıyordu.
  var s = VE_FEAD_GRAPH_SCALE;
  var minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  placed.forEach(function(p){
    var r = veFeadGraphDia(p.node) / 2 / s;
    minX = Math.min(minX, p.mm.x - r); maxX = Math.max(maxX, p.mm.x + r);
    minY = Math.min(minY, p.mm.y - r); maxY = Math.max(maxY, p.mm.y + r);
  });
  var mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  out.span = { w: (maxX - minX) * s, h: (maxY - minY) * s };

  var byId = {};
  placed.forEach(function(p){
    var w = veFeadGraphDia(p.node);
    var it = {
      id: p.node.id,
      cx: (p.mm.x - mx) * s,
      cy: -(p.mm.y - my) * s,          // ← mm y-yukarı, ekran y-aşağı
      w: w, h: w,
      labelPos: 'bottom',
      clipped: !veFeadGraphDiaInfo(p.node).toScale,
      from: p.mm.from
    };
    if(it.clipped) out.clipped.push(p.node.id);
    out.items.push(it);
    byId[p.node.id] = it;
    out.order.push(p.node.id);
  });

  // ── Port açıları: her kasnak KOMŞUSUNA bakar ──
  // Kayış sırası kapalı bir çevrim: çıkış → sıradaki kasnak, giriş → önceki.
  // Açı EKRAN düzleminde atan2(Δy, Δx) — vePortOffset'in 'angle' dalı da aynı
  // konvansiyonu okuyor (bkz. js/components.js).
  //
  // Teğet noktası DEĞİL, merkez doğrultusu kullanılıyor: teğet için çözücü
  // gerekir ve graf çözücüsüz de çalışmak zorunda (yarım kurulmuş model).
  // Fark span başına birkaç derece; tel yine kasnağın çeperinden çıkıyor.
  var k = out.order.length;
  out.order.forEach(function(id, i){
    var me = byId[id];
    var nx = byId[out.order[(i + 1) % k]];
    var pv = byId[out.order[(i - 1 + k) % k]];
    function deg(a, b){
      if(!a || !b || a === b) return 0;
      return Math.atan2(b.cy - a.cy, b.cx - a.cx) * 180 / Math.PI;
    }
    out.ports[id] = { output: deg(me, nx), input: deg(me, pv) };
  });

  // ── Ad yerleşimi: kümenin DIŞINA ──
  // Ad kutunun altında sabit dursaydı, halka biçiminde dizilmiş kasnaklarda
  // alttaki adların yarısı kayış telinin üstüne düşerdi (etütteki maketlerde
  // etiketlerin çakışmamasının tek sebebi buydu).
  out.items.forEach(function(it){
    var dx = it.cx, dy = it.cy;
    if(Math.abs(dx) > Math.abs(dy)) it.labelPos = (dx >= 0) ? 'right' : 'left';
    else                            it.labelPos = (dy >= 0) ? 'bottom' : 'top';
  });

  out.ok = true;
  return out;
}

// ── DOM: kasnağı DAİREYE çevir ──────────────────────────────────────────────
// Biçim üç kanal taşır (tasarım etüdü 2, S5 formu):
//   • çeper ÇAPI      → gerçek dış çap (1 px = 1 mm)
//   • çeper DOKUSU    → temas tarafı (düz = kaburgalı yüz, kesikli = sırt)
//   • çeper RENGİ     → rol (sürücü / gergi / avara / aksesuar)
// Tip kimliği ortadaki sembolde kalır (componentDefs'teki gerçek SVG).
// Ölçü VERİDİR: bu yüzden yeniden boyutlandırma tutamakları gizlenir (CSS) —
// fareyle mm girmek, panelde 152.0 yazan çapı 151.6 yapardı.
function veFeadApplyPulleyForm(nodeEl, node){
  if(!nodeEl || !node || typeof document === 'undefined') return false;
  var isPulley = (typeof _feadIsPulley === 'function') && _feadIsPulley(node);
  if(!isPulley){ nodeEl.classList.remove('ve-node--fead-pulley'); return false; }

  var def = (typeof _feadDefOf === 'function') ? _feadDefOf(node) : {};
  nodeEl.classList.add('ve-node--fead-pulley');
  nodeEl.classList.toggle('ve-fead-back', (typeof veFeadContactOf === 'function')
    && veFeadContactOf(node) === 'back');
  nodeEl.classList.toggle('ve-fead-driver', !!(node.data && node.data.driver));
  nodeEl.classList.toggle('ve-fead-tensioner', !!def.isFeadTensioner);
  nodeEl.classList.toggle('ve-fead-idler', !!def.isFeadIdler);
  // Ölçekli olmayan (alt/üst sınıra çarpmış) kasnak İŞARETLENİR: çizim ölçekli
  // değilse kullanıcı bunu bilmeli, yoksa iki kasnağın oranını gözle okur.
  var di = veFeadGraphDiaInfo(node);
  nodeEl.classList.toggle('ve-fead-notoscale', !di.toScale);
  nodeEl.classList.toggle('ve-fead-nodia', !di.hasOD);
  return true;
}

// Bir kasnağın ölçüsünü ÇAPINDAN yaz (model + DOM). Çap değişince düğüm
// büyür/küçülür — panelde 152 yazıp ekranda 62 px görmek, biçimin taşıdığı
// tek bilgiyi yalan yapardı.
function veFeadSyncPulleySize(node){
  if(!node || typeof _feadIsPulley !== 'function' || !_feadIsPulley(node)) return false;
  var d = veFeadGraphDia(node);
  if(node.width === d && node.height === d) return false;
  node.width = d; node.height = d;
  if(typeof document === 'undefined') return true;
  var el = document.getElementById(node.id);
  if(!el) return true;
  el.style.width = d + 'px';
  var box = el.querySelector('.ve-node-box');
  if(box){ box.style.width = d + 'px'; box.style.height = d + 'px'; }
  if(typeof updateNodeHandles === 'function') updateNodeHandles(el, d, d);
  if(typeof veRebuildNodePorts === 'function') veRebuildNodePorts(node);
  return true;
}

// Tüm kasnakların biçim/ölçüsünü tazele (çap, temas tarafı, sürücü değişince).
function veFeadRefreshPulleyForms(){
  if(typeof nodes === 'undefined' || typeof document === 'undefined') return 0;
  var n = 0, resized = 0;
  nodes.forEach(function(x){
    if(typeof _feadIsPulley !== 'function' || !_feadIsPulley(x)) return;
    if(veFeadSyncPulleySize(x)) resized++;
    var el = document.getElementById(x.id);
    if(el && veFeadApplyPulleyForm(el, x)) n++;
  });
  // Bağlantı uçları kasnağın ÇEPERİNDE duruyor; yalnız ölçü DEĞİŞTİYSE
  // teller yeniden çizilir. Her saveState'te koşulsuz çizmek, saniyede
  // birkaç kez tüm bağlantı katmanını yeniden kurmak olurdu.
  if(resized && typeof updateAllConnections === 'function') updateAllConnections();
  return n;
}

// ── UYGULA: geometrik yerleşim + yöne bakan portlar ─────────────────────────
// "Otomatik Düzenle" FEAD iç topolojisinde buraya yönlenir (veTidyLayout).
// Genel yerleştirici katmanlı bir DAG düzeni kurar; FEAD ise bir ÇEVRİM —
// katmanlamak çevrimi keyfî bir yerden kırar ve dönüş kenarını her şeyin
// üstünden geçirir.
function veFeadArrangeGraph(opts){
  opts = opts || {};
  if(typeof nodes === 'undefined' || typeof document === 'undefined') return null;
  var conns = (typeof connections !== 'undefined' && connections) ? connections : [];
  var plan = veFeadGraphPlan(nodes, conns);
  if(!plan.ok){
    if(!opts.quiet && typeof showToast === 'function') showToast(plan.reason, 'warning');
    return plan;
  }

  var byId = {};
  nodes.forEach(function(n){ byId[n.id] = n; });

  // Çıpa: kümenin ŞU ANKİ ekran merkezi. Yerleşim topolojiyi ışınlamamalı —
  // kullanıcı "düzenle" dedikten sonra kamerasını kaybetmesin.
  var ax = 0, ay = 0, k = 0;
  plan.items.forEach(function(it){
    var n = byId[it.id]; if(!n) return;
    ax += n.x + (n.width || 65) / 2; ay += n.y + (n.height || 60) / 2; k++;
  });
  if(k){ ax /= k; ay /= k; }
  else if(typeof veArrangeModuleBase === 'function'){
    var b = veArrangeModuleBase([{ lx:0, ly:0, w:plan.span.w, h:plan.span.h }]);
    ax = b.x + plan.span.w / 2; ay = b.y + plan.span.h / 2;
  } else { ax = 3000; ay = 3000; }

  if(typeof saveState === 'function') saveState();   // ← geri alınabilir

  // 1) Kasnaklar: konum + ölçü + port açısı + ad yönü
  plan.items.forEach(function(it){
    var n = byId[it.id]; if(!n) return;
    n.width = it.w; n.height = it.h;
    n.x = Math.round(ax + it.cx - it.w / 2);
    n.y = Math.round(ay + it.cy - it.h / 2);
    if(!n.data) n.data = {};
    n.data.labelPos = it.labelPos;
    var pp = plan.ports[it.id] || { input:180, output:0 };
    n.data.portPositions = {
      input:  { side:'angle', deg: Math.round(pp.input  * 10) / 10 },
      output: { side:'angle', deg: Math.round(pp.output * 10) / 10 }
    };
  });

  // 2) Araç düğümleri (Kayış Özellikleri · Çözücü · Örnekler · Rapor) kümenin
  //    SOLUNDA dikey şeride; Kayış Yolu kartı (420×340 canlı şema) SAĞDA kendi
  //    alanında — kümenin üstüne binerse komşu portlar kartın altında kalır.
  var half = { w: plan.span.w / 2, h: plan.span.h / 2 };
  var solSira = 0;
  nodes.forEach(function(n){
    var def = (typeof _feadDefOf === 'function') ? _feadDefOf(n) : {};
    if(typeof _feadIsPulley === 'function' && _feadIsPulley(n)) return;
    var fead = !!(def.isFeadBelt || def.isFeadSolver || def.isFeadExample
               || def.isFeadLayout || def.isFeadReport);
    if(!fead) return;
    var w = n.width || 65, h = n.height || 60;
    if(def.isFeadLayout){
      n.x = Math.round(ax + half.w + VE_FEAD_TOOL_GAP);
      n.y = Math.round(ay - h / 2);
    } else {
      n.x = Math.round(ax - half.w - VE_FEAD_TOOL_GAP - w);
      n.y = Math.round(ay - half.h + solSira * VE_FEAD_TOOL_STEP);
      solSira++;
    }
  });

  // 3) Kayış bağlantısı DÜZ ÇİZGİ. Kayışın kasnaklar arası parçası fizikte
  //    zaten bir DOĞRU (ortak teğet); eğri çizmek burada süs değil, yanlış.
  conns.forEach(function(c){
    var a = byId[c.from], b2 = byId[c.to];
    if(!a || !b2) return;
    if(typeof _feadIsPulley === 'function' && _feadIsPulley(a) && _feadIsPulley(b2))
      c.lineType = 'straight';
  });

  // 4) DOM'a bas
  plan.items.forEach(function(it){
    var n = byId[it.id]; if(!n) return;
    var el = document.getElementById(n.id);
    if(!el) return;
    el.style.left = n.x + 'px';
    el.style.top  = n.y + 'px';
    el.style.width = n.width + 'px';
    var box = el.querySelector('.ve-node-box');
    if(box){ box.style.width = n.width + 'px'; box.style.height = n.height + 'px'; }
    if(typeof updateNodeHandles === 'function') updateNodeHandles(el, n.width, n.height);
    if(typeof veRebuildNodePorts === 'function') veRebuildNodePorts(n);
    if(typeof applyNodeLabelPos === 'function') applyNodeLabelPos(n);
    veFeadApplyPulleyForm(el, n);
  });
  nodes.forEach(function(n){
    var el = document.getElementById(n.id);
    if(el){ el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
  });

  if(typeof updateAllConnections === 'function') updateAllConnections();
  if(typeof veUpdateBoundary === 'function') veUpdateBoundary();
  if(typeof veMinimapUpdate === 'function') veMinimapUpdate();
  if(typeof saveState === 'function') saveState();

  if(!opts.quiet && typeof showToast === 'function'){
    var msg = 'Kayış düzenine göre dizildi — ' + plan.items.length + ' kasnak';
    if(plan.missing.length) msg += ' · ' + plan.missing.length + ' kasnağın konumu girilmemiş';
    if(plan.clipped.length) msg += ' · ' + plan.clipped.length + ' kasnak ölçekli değil';
    showToast(msg, plan.missing.length ? 'warning' : 'success');
  }
  if(opts.fit !== false && typeof veFitViewToContent === 'function')
    veFitViewToContent({ maxZoom: 1.2 });
  return plan;
}

// FEAD iç topolojisinde miyiz? (topology.js veFeadStack ile aynı gerçek.)
function veFeadInSubTopology(){
  return (typeof veFeadStack !== 'undefined' && veFeadStack && veFeadStack.length > 0);
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    VE_FEAD_GRAPH_SCALE: VE_FEAD_GRAPH_SCALE,
    VE_FEAD_MIN_DIA: VE_FEAD_MIN_DIA,
    VE_FEAD_MAX_DIA: VE_FEAD_MAX_DIA,
    veFeadEnteredCenter: veFeadEnteredCenter,
    veFeadGraphDia: veFeadGraphDia,
    veFeadGraphDiaInfo: veFeadGraphDiaInfo,
    VE_FEAD_NODIA_DIA: VE_FEAD_NODIA_DIA,
    veFeadGraphPlan: veFeadGraphPlan,
    veFeadApplyPulleyForm: veFeadApplyPulleyForm,
    veFeadSyncPulleySize: veFeadSyncPulleySize,
    veFeadRefreshPulleyForms: veFeadRefreshPulleyForms,
    veFeadArrangeGraph: veFeadArrangeGraph,
    veFeadInSubTopology: veFeadInSubTopology
  };
}
