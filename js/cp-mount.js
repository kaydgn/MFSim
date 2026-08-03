// ============================================================================
// TAKOZ ÇÖKME-TİTREŞİM — GERÇEK KANVAS BİLEŞENLERİ (panel + çözücü)
// ============================================================================
// SPEC "Takoz Çökme–Titreşim Modülü (6 SD Rijit Gövde Modeli)" v1.0.
// Hesap çekirdeği: js/mount-core.js (veMountCore) — DOM'suz saf fonksiyonlar.
//
// MİMARİ (kullanıcı kararı): Motor / Şanzıman / Şaft / Braket / Transfer (kütle
// gövdeleri) ve Takoz bileşenleri iç topolojiye sürüklenir; BAĞLANTI YOKTUR
// (bağlantı portu bulunmaz). Çözücü iç topolojideki TÜM kütle+takoz düğümlerini
// (nodes içinde def.isMountBody / def.isMount) OTOMATİK algılayıp 6 SD analizini
// otomatik yük durumlarıyla çalıştırır — kullanıcı ne bağlantı ne yük durumu girer.
//
// Birim (SPEC 2): UI mm/kg/N/mm; çekirdek SI. Dönüşüm yalnız burada.
// Kalıcılık: her node kendi node.data'sında (proje kaydet/yükle otomatik).
// ----------------------------------------------------------------------------

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function _mntNum(v, d){ if(v===undefined||v===null||v==='') return d===undefined?0:d; var x=(typeof v==='string')?v.trim().replace(',', '.'):v; var n=Number(x); return Number.isFinite(n)?n:(d===undefined?0:d); }
function _mntFmt(x, dg){ if(!Number.isFinite(x)) return '—'; dg=(dg===undefined)?3:dg; return x.toFixed(dg); }
function _mntEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _mntDeflColor(mm){ var a=Math.abs(mm); if(a<0.5) return '#22c55e'; if(a<1.0) return '#84cc16'; if(a<2.0) return '#eab308'; if(a<3.0) return '#f97316'; return '#ef4444'; }
function _mntForceColor(kN){ var a=Math.abs(kN); if(a<5) return '#22c55e'; if(a<10) return '#84cc16'; if(a<20) return '#eab308'; if(a<30) return '#f97316'; return '#ef4444'; }
function _mntDef(n){ return (typeof componentDefs!=='undefined') ? componentDefs[n.type] : (n.def||{}); }
function _mntNodeName(n){ return n.customName || (_mntDef(n)||{}).name || n.type; }

// A26 gömülü takoz kütüphanesi (SPEC 7.2)
// Gömülü girdi: statik (sx/sy/sz) + dinamik (dx/dy/dz) rijitlik [N/mm]. Bir eksende
// nonlineer kuvvet–sehim yasası iki biçimde tanımlanabilir (yoksa o eksen lineerdir):
//   • `fits:{x,y,z}`   — ANALİTİK kapalı-form (mm/N). Çekirdek force+tanjantı tam ve
//        pürüzsüz üretir (Newton için ideal). 'poly': F=k0·x+c3·x³+c5·x⁵ (radyal);
//        'asym' (eksenel, MODEL konvansiyonu δ<0 = BASMA): δ<0 → comp.k0·δ/(1+δ/comp.xmax)
//        (rasyonel, −xmax'ta bump-stop), δ≥0 → ext.k0·δ+ext.c3·δ³ (kübik, geri-gelme).
//   • `curves:{x,y,z}` — ölçülmüş [[δ_mm,f_N],…] nokta tablosu (monoton kübik interp).
// TK0xx fit'leri test raporu grafiklerinin (Fx/Fy radyal, Fz eksenel) curve-fit'idir;
// dz @5 mm ön yük. Test grafiğinde +yer değiştirme=BASMA olduğundan, eksenel fit modelin
// δ<0=basma konvansiyonuna göre yazılmıştır (comp=test'in sert dalı). NOT: radyal fit
// orijin eğimi = statik Cx/Cy; eksenel fit orijin eğimi (~k0≈360) tablo Cz'den (192)
// yüksektir (rasyonel form uç-noktaya oturtulmuş) — daha iyi fit gelirse güncellenir.
//
// ── AYNI PARÇA KODU, FARKLI TAKOZ ────────────────────────────────────────────
// 57RS313773 ve 57RS313774 kodları İKİ AYRI kaynakta, İKİ AYRI takoz için
// geçiyor (kullanıcı teyidi: kodlar aynı olsa da farklı takozlardır). Bu yüzden
// her biri AYRI girdi olarak tutulur; hangisinin kullanılacağına kullanıcı
// açılır listede karar verir. Girdi adı KOD + KAYNAK taşır — başka bir şey değil.
//
//   kaynak       | kod        | statik x/y/z    | dinamik x/y/z
//   -------------|------------|-----------------|-----------------
//   A26          | 57RS313773 |  334/ 334/2300  |  435/ 435/3000
//   A26          | 57RS313774 | 1200/1200/2400  |  950/ 950/1900
//   ASR-SR-116   | 57RS313773 |  462/ 462/2200  |  630/ 630/3000
//   ASR-SR-116   | 57RS313774 | 1045/1045/1800  | 1045/1045/1800
//
// ÖN/ARKA gibi KONUM etiketleri girdi adına KONMAZ: bir takozun ön mü arka mı
// olduğu takozun değil, monte edildiği yerin özelliğidir — araçtan araca
// değişir. Konum, takoz düğümünün kendi adıyla (customName) ifade edilir.
// (Kaynak dokümanlardaki roller kayıt olsun diye: A26'da 773=ön, 774=arka;
//  ASR-SR-116'da tersi. Bu yalnız köken bilgisidir, koda girmez.)
//
// A26 satırları powerpack_mount_analysis_A26.html'den birebir port edilmiştir.
// ASR-SR-116 satırları BMC "ASFAT 8x8 OBUS Takoz Seçimi" (04.08.2021) Tablo 9'dur;
// o dokümanın Tablo 8 (çökme) ve Tablo 11 (sönüm) sonuçları bu değerlerle
// yeniden üretilebilir — bkz. tests/unit/mount-library-sources.test.js.
//
// ANAHTARLAR DEĞİŞMEZ: kayıtlı projeler takozu node.data.libKey ile bağlar;
// mevcut '57RS313773'/'57RS313774' anahtarları A26 girdilerinde KALIR, yeni
// kaynak '-sr116' sonekiyle eklenir. Yalnız görünen ad kaynağı belirtir.
var VE_MOUNT_LIBRARY = {
  'amc55sha':         { name:'AMC 55 ShA',                       sx:1252, sy:1252, sz:640,  dx:2055, dy:2055, dz:977 },
  '57RS313773':       { name:'57RS313773 (A26)',          sx:334,  sy:334,  sz:2300, dx:435,  dy:435,  dz:3000 },
  '57RS313774':       { name:'57RS313774 (A26)',          sx:1200, sy:1200, sz:2400, dx:950,  dy:950,  dz:1900 },
  '57RS313773-sr116': { name:'57RS313773 (ASR-SR-116)',   sx:462,  sy:462,  sz:2200, dx:630,  dy:630,  dz:3000 },
  '57RS313774-sr116': { name:'57RS313774 (ASR-SR-116)',   sx:1045, sy:1045, sz:1800, dx:1045, dy:1045, dz:1800 },
  // TK035 · 57RS328045 · 35 ShA — MLMT-0216-33-TK035 (curve-fit, R²≈0.997)
  'TK035': { name:'TK035 (57RS328045)', sx:415, sy:210, sz:192, dx:535, dy:250, dz:230,
    fits:{
      x:{ form:'poly', k0:415, c3:-2.44, c5:0.0201 },
      y:{ form:'poly', k0:210, c3:-1.28, c5:0.0169 },
      z:{ form:'asym', comp:{k0:367, xmax:5.60}, ext:{k0:361, c3:2.20} }   // basma sert (rasyonel), geri-gelme kübik
    } },
  // TK040 · 57RS329001M · 45 ShA — MLMT-0216-33-TK040 (curve-fit, R²≈0.99)
  'TK040': { name:'TK040 (57RS329001M)', sx:515, sy:260, sz:242, dx:740, dy:355, dz:335,
    fits:{
      x:{ form:'poly', k0:515, c3:-3.29, c5:0.0311 },
      y:{ form:'poly', k0:260, c3:-2.78, c5:0.0269 },
      z:{ form:'asym', comp:{k0:387, xmax:5.66}, ext:{k0:400, c3:2.06} }
    } },
  // TK050 · 57RS326612M · 50 ShA — MLMT-0216-33-TK050 (curve-fit, R²≈0.99)
  'TK050': { name:'TK050 (57RS326612M)', sx:665, sy:335, sz:290, dx:1165, dy:590, dz:490,
    fits:{
      x:{ form:'poly', k0:665, c3:-5.85, c5:0.0618 },
      y:{ form:'poly', k0:335, c3:-2.53, c5:0.0249 },
      z:{ form:'asym', comp:{k0:381, xmax:5.02}, ext:{k0:374, c3:2.11} }
    } }
};

// ─── ETKİN KÜTÜPHANE (gömülü + gömülü override + kullanıcı tanımlı) ───────────
// Gömülü katalog (VE_MOUNT_LIBRARY) fabrika varsayılanıdır ve ÇALIŞMA ANINDA
// DEĞİŞMEZ (asla mutasyona uğramaz). "Takoz Özellikleri" (mnt-library) düğümleri:
//   node.data.mounts    → kullanıcı tanımlı takozlar (Özel grup)
//   node.data.overrides → gömülü takozlara alan-bazlı düzenleme (fabrikanın üzerine)
// Bu üç kaynak burada birleştirilir. Takoz panelinin kütüphane açılır listesi ve
// veMntApplyLib doğrudan VE_MOUNT_LIBRARY yerine bu birleşik haritayı okur —
// böylece kullanıcının eklediği/değiştirdiği takozlar da yansır. Override'lar
// alan-bazlıdır: düzenlenmemiş alanlar fabrika değerini izler; ↺ ile override
// silinince gömülü girdi fabrikaya döner. Girdi biçimi (birleşik):
//   { key, name, sx, sy, sz, dx, dy, dz, builtin, overridden }.
function veMntGetLibraryMap(){
  var map={};
  var cv=function(a){ return (Array.isArray(a)&&a.length>=2)?a:null; };   // geçerli eğri (≥2 nokta) veya null
  Object.keys(VE_MOUNT_LIBRARY).forEach(function(k){
    var m=VE_MOUNT_LIBRARY[k], c=m.curves||{}, f=m.fits||{};
    map[k]={ key:k, name:m.name, sx:m.sx, sy:m.sy, sz:m.sz, dx:m.dx, dy:m.dy, dz:m.dz, builtin:true, overridden:false,
      fitX:f.x||null, fitY:f.y||null, fitZ:f.z||null,       // fabrika analitik fit (varsa)
      curveX:cv(c.x), curveY:cv(c.y), curveZ:cv(c.z) };     // ya da nokta tablosu (varsa)
  });
  (typeof nodes!=='undefined'?nodes:[]).forEach(function(n){
    var def=_mntDef(n)||{};
    if(!def.isMountLibrary || !n.data) return;
    // Gömülü override'ları uygula (fabrika değerinin üzerine, alan-bazlı). Eğriler
    // fabrikadan gelir (override edilmez) — base'ten aynen taşınır.
    var ov=n.data.overrides;
    if(ov && typeof ov==='object'){
      Object.keys(ov).forEach(function(k){
        var base=map[k]; if(!base) return;                // yalnız var olan gömülü girdiler
        var o=ov[k]||{}; if(!o || Object.keys(o).length===0) return;
        var pick=function(f){ return (o[f]!==undefined && o[f]!==null && o[f]!=='') ? (f==='name'?o[f]:_mntNum(o[f])) : base[f]; };
        map[k]={ key:k, name:pick('name'), sx:pick('sx'), sy:pick('sy'), sz:pick('sz'),
          dx:pick('dx'), dy:pick('dy'), dz:pick('dz'), builtin:true, overridden:true,
          fitX:base.fitX, fitY:base.fitY, fitZ:base.fitZ,
          curveX:base.curveX, curveY:base.curveY, curveZ:base.curveZ };
      });
    }
    // Kullanıcı tanımlı takozlar (Özel grup) — 3-eksen eğri (curveX/Y/Z) taşıyabilir.
    if(Array.isArray(n.data.mounts)){
      n.data.mounts.forEach(function(e){
        if(!e || !e.key) return;
        map[e.key]={ key:e.key, name:(e.name||'Özel Takoz'),
          sx:_mntNum(e.sx), sy:_mntNum(e.sy), sz:_mntNum(e.sz),
          dx:_mntNum(e.dx), dy:_mntNum(e.dy), dz:_mntNum(e.dz), builtin:false,
          // Opsiyonel nonlineer yasa (takoz tipinin özelliği) — Takoz'a uygulanınca kopyalanır.
          fitX:(e.fitX||null), fitY:(e.fitY||null), fitZ:(e.fitZ||null),
          curveX:cv(e.curveX), curveY:cv(e.curveY), curveZ:cv(e.curveZ) };
      });
    }
  });
  return map;
}
function veMntGetLibraryList(){
  var map=veMntGetLibraryMap(), out=[];
  Object.keys(map).forEach(function(k){ out.push(map[k]); });
  return out;
}

// Otomatik yük durumları — araç yük kitabı g-faktörleri (a_x, a_y, a_z magnitüd;
// yön MFSim konvansiyonuyla işaretlenir: frenleme −x, yanal +y, düşey −z; a_z
// yerçekimi DAHİL toplam düşey g). n vektörü çekirdeğe SI olarak gider; tork
// durumları (Forward/Reverse) ayrıca _mntTorqueCases ile eklenir → 14 senaryo.
//
// g-seviyeleri:
//   • Cornering 0.6g, Brake-in-Turn 0.4g (boyuna+yanal), Max Bump/Pothole 3.5g düşey,
//   • Kerb Strike 1.55g yanal (bordür darbesi); a_y İŞARETİ cornering'in TERSİDİR
//     (Kerb sol = −1.55, cornering sol = +0.6), Max Rebound +1g (droop/ekstansiyon).
// L/R varyantları a_y işaretiyle ayrışır. Büyük sehimli satırlar (Max Bump, Pothole,
// Reverse) ±15 mm metal-metal durdurucuyla klipslenir (solveCaseStop, F4);
// çözücü useStop=true ile çağrılır.
var MNT_AUTO_CASES = [
  { name:'Static',            n:[ 0,    0,   -1  ], T:[0,0,0] }, // 1g düşey
  { name:'Max Bump',          n:[ 0,    0,   -3.5], T:[0,0,0] }, // 3.5g düşey → klips
  { name:'Braking',           n:[-1,    0,   -1  ], T:[0,0,0] }, // 1g boyuna (fren)
  { name:'Acceleration',      n:[ 1,    0,   -1  ], T:[0,0,0] }, // 1g boyuna (hızlanma)
  { name:'Cornering Left',    n:[ 0,    0.6, -1  ], T:[0,0,0] }, // 0.6g yanal (sol)
  { name:'Cornering Right',   n:[ 0,   -0.6, -1  ], T:[0,0,0] }, // 0.6g yanal (sağ)
  { name:'Brake in Turn L',   n:[-0.4,  0.4, -1  ], T:[0,0,0] }, // 0.4g fren+yanal (sol)
  { name:'Brake in Turn R',   n:[-0.4, -0.4, -1  ], T:[0,0,0] }, // 0.4g fren+yanal (sağ)
  { name:'Pothole Braking',   n:[-3,    0,   -3.5], T:[0,0,0] }, // çukur+fren → klips
  { name:'Kerb Strike L',     n:[ 0,   -1.55,-1  ], T:[0,0,0] }, // 1.55g yanal bordür (sol) — işaret cornering'in TERSİ
  { name:'Kerb Strike R',     n:[ 0,    1.55,-1  ], T:[0,0,0] }, // 1.55g yanal bordür (sağ)
  { name:'Max Rebound',       n:[ 0,    0,    1  ], T:[0,0,0] }  // droop / negatif-g (ekstansiyon)
];

// ════════════════════════════════════════════════════════════════════════════
//  ANA MODÜL — ALT-SİSTEM (SUBSYSTEM) DÜĞÜMÜ  (arac-performans kalıbı)
// ════════════════════════════════════════════════════════════════════════════
// "Takoz Çökme-Titreşim" ana bileşen listesindeki TEK giriştir (Alt Modüller).
// Ana canvas'ta tek blok; çift tıkla → kendi İÇ TOPOLOJİSİNE girilir. Alt
// bileşenler (Motor/Şanzıman/Şaft/Braket/Kütle/Takoz/Çözücü) YALNIZ orada görünür
// (sidebar 'takoz' modu) ve normal sürükle-bağla ile kurulur. "← Ana Topolojiye
// Dön" ile çıkılır. Ana canvas makinesi (topology.js) aynen yeniden kullanılır:
// girişte ebeveyn durumu saklanır, canvas alt-topoloji ile değiştirilir; çıkışta
// alt-topoloji node.data.subTopology'ye yazılır. Kaydet öncesi veSaveActiveTabState
// → veMntCollapseToRoot ile köke çöker.
var veMntStack = [];
var _veMntBusy = false;

// Modül paneli (tek tık): "Alt Topolojiyi Aç".
function getMntModulePropertiesHTML(node){
  var sub = node && node.data && node.data.subTopology;
  var nCount = (sub && sub.nodes) ? sub.nodes.length : 0;
  var cCount = (sub && sub.connections) ? sub.connections.length : 0;
  var initialized = !!(sub && sub.nodes && sub.nodes.length);
  var html='<div class="sw-panel">';
  html+='<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-primary);">'
      + '<b style="color:var(--text-heading);">Takoz Çökme-Titreşim — alt-sistem.</b> '
      + 'Üstüne <b>çift tıklayınca</b> kendi <b>alt topolojisine</b> girilir. Motor / Şanzıman / Şaft / Braket / Kütle / Takoz / Takoz Özellikleri / Çözücü alt bileşenlerini orada, kendi panellerinden düzenler, Çözücü\'ye bağlarsınız. Yük durumları otomatik.</div>';
  html+='<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:10px;">';
  if(initialized){
    html+='<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bileşen</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">'+nCount+'</td></tr>';
    html+='<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bağlantı</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">'+cCount+'</td></tr>';
  } else {
    html+='<tr><td style="padding:7px 8px; border:1px solid var(--border-color); color:var(--text-muted);">Henüz açılmadı — ilk açılışta hazır bileşenlerle başlar.</td></tr>';
  }
  html+='</table>';
  html+='<button onclick="veMntOpenEditor(\''+node.id+'\')" style="width:100%; padding:14px 16px; font-size:var(--fs-lg); font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.03em;" onmouseover="this.style.filter=\'brightness(1.15)\'" onmouseout="this.style.filter=\'none\'">▶ Alt Topolojiyi Aç</button>';
  html+='</div>';
  return html;
}

// REFERANS yerleşim (yerel px) — güç grubunun düzenli üstten-görünüş şeması ve
// analiz araçlarının konumları. Model açılışında bu yerleşimin TAMAMI artık
// KURULMAZ; yalnız "Başlangıç ve Örnekler" bileşeni gelir (aşağıdaki
// veMntPopulateStarter). Buradaki koordinatlar hâlâ (a) tek bileşenin konumu ve
// (b) "Örneği Aktar" ile kurulan topolojinin görünür alana ortalanması için
// koordinat çerçevesi olarak kullanılır.
var VE_MNT_STARTER_LAYOUT = [
  // ── Üst şerit: analiz araçları (tek sıra, eşit aralık) ──
  { type:'mnt-coordframe',                     lx:40,  ly:20 },
  { type:'mnt-library',                        lx:190, ly:20 },
  { type:'mnt-viewer',                         lx:340, ly:20 },
  { type:'mnt-2dview',                         lx:490, ly:20 },
  { type:'mnt-solver',   name:'Çözücü',         lx:640, ly:20 },
  { type:'mnt-example',                        lx:790, ly:20 },
  { type:'mnt-report',                         lx:940, ly:20 },
  // ── Sağ takozlar (şasi sağ tarafı → şemada üstte) ──
  { type:'mnt-mount',    name:'Sağ Yan Takoz',  lx:300, ly:190 },
  { type:'mnt-mount',    name:'Sağ Arka Takoz', lx:480, ly:190 },
  // ── Güç grubu (gövdeler yatay sıra) ──
  { type:'mnt-mount',    name:'Ön Takoz',       lx:60,  ly:320 },
  { type:'mnt-motor',    name:'Motor',          lx:180, ly:308 },
  { type:'mnt-gearbox',  name:'Şanzıman',       lx:320, ly:320 },
  { type:'mnt-transfer', name:'Transfer Kutusu',lx:445, ly:320 },
  { type:'mnt-shaft',    name:'Şaft',           lx:575, ly:320 },
  // ── Sol takozlar (şasi sol tarafı → şemada altta) ──
  { type:'mnt-mount',    name:'Sol Yan Takoz',  lx:300, ly:450 },
  { type:'mnt-mount',    name:'Sol Arka Takoz', lx:480, ly:450 }
];

// Node'a özel ad ata + kanvastaki etiketi güncelle.
function _mntSetNodeName(node, name){
  if(!node || !name) return;
  node.customName = name;
  if(typeof document!=='undefined'){
    var el=document.getElementById(node.id);
    if(el){ var lbl=el.querySelector('.ve-node-label'); if(lbl) lbl.textContent=name; }
  }
}

// Node'u (id ile) topolojiden ve DOM'dan kaldır — bağlantılarını da temizle.
function _mntRemoveNode(id){
  if(typeof connections!=='undefined'){
    connections = connections.filter(function(c){ return c.from!==id && c.to!==id; });
  }
  if(typeof document!=='undefined'){
    var el=document.getElementById(id); if(el) el.remove();
  }
  if(typeof nodes!=='undefined'){
    nodes = nodes.filter(function(n){ return n.id!==id; });
  }
}

// İlk açılışta iç topolojiye YALNIZ "Başlangıç ve Örnekler" (mnt-example)
// bileşeni gelir; kullanıcı örneği bu bileşenin panelinden aktarır. Bileşen,
// referans yerleşimdeki sağ-üst konumuna (aynı taban) yerleştirilir; "Örneği
// Aktar" güç grubunu sol-orta bölgeye (Çözücü sağ-üste) kurduğundan çakışmaz.
function veMntPopulateStarter(){
  if(typeof createNode!=='function') return [];
  var base = (typeof veArrangeModuleBase==='function')
    ? veArrangeModuleBase(VE_MNT_STARTER_LAYOUT.map(function(it){ return {lx:it.lx, ly:it.ly}; }))
    : { x:3000, y:3000 };
  var slot = VE_MNT_STARTER_LAYOUT.find(function(it){ return it.type==='mnt-example'; }) || { lx:790, ly:20 };
  var created=[];
  var before=nodes.length;
  createNode('mnt-example', base.x+slot.lx, base.y+slot.ly);
  if(nodes.length>before){
    var n=nodes[nodes.length-1];
    if(slot.name) _mntSetNodeName(n, slot.name);
    created.push(n);
  }
  if(typeof updateAllConnections==='function') updateAllConnections();
  return created;
}

// Sidebar kapsamını güncelle (takoz iç topolojisi ⇄ ana ekran). Kapsam açık
// alt-sistem stack'lerinden merkezi olarak hesaplanır (bkz. veSyncSidebarScope).
function _veMntSetSidebar(mode){
  if(typeof veSyncSidebarScope==='function'){ veSyncSidebarScope(); return; }
  if(typeof veShowAllSidebarComponents==='function') veShowAllSidebarComponents();
}

// _silent: autosave gibi arka-plan işlemleri köke çöküp (veSaveActiveTabState)
// kullanıcıyı bulunduğu iç topolojiye geri getirirken true geçer; bu görünmez
// geri-girişte toast/animasyon tetiklenmez (breadcrumb ve sidebar yine güncellenir).
function veMntOpenEditor(nodeId, _silent){
  if(_veMntBusy) return;
  if(typeof nodes==='undefined' || typeof veSerializeCurrentState!=='function') return;
  var node = nodes.find(function(n){ return n.id===nodeId; });
  if(!node || node.type!=='mount-analysis') return;
  _veMntBusy=true;
  try {
    if(typeof veFlushOpenPanelData==='function') veFlushOpenPanelData();
    if(typeof veTogglePropertiesPanel==='function') veTogglePropertiesPanel(false);
    var parentState = veSerializeCurrentState();
    veMntStack.push({ nodeId:nodeId, parentState:parentState });
    veClearCanvasDOM();
    var sub = node.data && node.data.subTopology;
    if(sub && sub.nodes && sub.nodes.length){
      veLoadTabState({ state: sub });
    } else {
      veLoadTabState({ state: null });
      veMntPopulateStarter();
    }
    _veMntSetSidebar('takoz');
  } finally { _veMntBusy=false; }
  if(!_silent && typeof veAnimateCanvasTransition==='function') veAnimateCanvasTransition('enter');
  veMntUpdateBreadcrumb();
  if(!_silent && typeof showToast==='function') showToast('Takoz Çökme-Titreşim — İç Topoloji','info');
}

// _silent: köke çökerken (veMntCollapseToRoot → kaydet/sekme değiştir öncesi) true
// gelir; kullanıcıya görünmeyen bu toplu çıkışta geçiş animasyonu tetiklenmez.
function veMntCloseEditor(_silent){
  if(_veMntBusy) return;
  if(!veMntStack.length) return;
  _veMntBusy=true;
  try {
    if(typeof veFlushOpenPanelData==='function') veFlushOpenPanelData();
    var subState = veSerializeCurrentState();
    // Gömmeden ÖNCE hafiflet (bkz. topology.js veSanitizeEmbeddedState): undo/redo
    // geçmişi + tam simResults gömülünce çarpımsal büyüyüp JSON.stringify'ı
    // "Invalid string length" ile patlatır ve yedek kotasını taşırır.
    if(typeof veSanitizeEmbeddedState==='function') subState = veSanitizeEmbeddedState(subState);
    var ctx = veMntStack.pop();
    var pn = (ctx.parentState.nodes||[]).find(function(n){ return n.id===ctx.nodeId; });
    if(pn){ if(!pn.data) pn.data={}; pn.data.subTopology = subState; }
    veClearCanvasDOM();
    veLoadTabState({ state: ctx.parentState });
    _veMntSetSidebar('performans');
  } finally { _veMntBusy=false; }
  if(!_silent && typeof veAnimateCanvasTransition==='function') veAnimateCanvasTransition('exit');
  veMntUpdateBreadcrumb();
  if(!_silent && typeof showToast==='function') showToast('Ana topolojiye dönüldü','info');
}

function veMntCollapseToRoot(){
  var guard=0;
  while(veMntStack.length && guard++<32){ veMntCloseEditor(true); }
}

// Alt-topoloji çıkış çipi — canvas alanının sol-üst köşesine (topoloji sınırına)
// iliştirilir (arac-performans ile aynı CSS sınıfı ve konumlama mantığı).
function veMntUpdateBreadcrumb(){
  if(typeof document==='undefined') return;
  var el=document.getElementById('ve-mnt-breadcrumb');
  if(veMntStack.length===0){ if(el) el.remove(); return; }
  if(!el){
    el=document.createElement('div');
    el.id='ve-mnt-breadcrumb';
    el.className='ve-arac-breadcrumb';
    // Canvas alanının sol-üst köşesine iliştir. #ve-split-container position:relative
    // ve geçiş animasyonunun transform'u alt-seviye .ve-canvas-wrapper'a uygulandığı
    // için çip konumunu şaşırmaz → sınıra sabit kalır.
    var host=document.getElementById('ve-split-container')
          || document.querySelector('.ve-canvas-area')
          || document.body;
    host.appendChild(el);
  }
  var depth=veMntStack.length;
  el.innerHTML='<button onclick="veMntCloseEditor()" title="Ana (üst) topolojiye dön">← Ana topolojiye dön</button>'
    + '<span class="ve-arac-breadcrumb-label">Takoz Çökme-Titreşim · İç Topoloji'
    + (depth>1 ? ' <b>(derinlik '+depth+')</b>' : '') + '</span>';
}

// ════════════════════════════════════════════════════════════════════════════
//  KÜTLE GÖVDESİ PANELİ (Motor / Şanzıman / Şaft / Braket / Kütle)
// ════════════════════════════════════════════════════════════════════════════
// Nokta-kütle VARSAYILANI tipe göre: Şaft ince/hafif; PTO ve Pompa parçalarının
// kendi atalet tensörü katalog/CAD verisinde çoğu zaman YOKTUR (ASR-SR-116 Tablo 4
// yalnız kütle+CG verir) → nokta kütle. Grubun ataleti parçaların CG yayılımından
// paralel-eksen teoremiyle zaten doğar. 'PTO Toplam' ise grup ataletini TAŞIR
// (ASR-SR-116 Tablo 3) → nokta kütle DEĞİL.
var _MNT_POINTMASS_DEFAULT = { 'mnt-shaft':1, 'mnt-pto':1, 'mnt-pump':1 };
function _mntEnsureMassData(node){
  if(!node.data) node.data = {};
  if(node.data.pointMass===undefined) node.data.pointMass = !!_MNT_POINTMASS_DEFAULT[node.type];
  return node.data;
}
function _mntInp(node, key, ph, step){
  var v=(node.data[key]===undefined||node.data[key]===null)?'':node.data[key];
  return '<input type="number" id="ve-mnt-'+key+'-'+node.id+'" value="'+_mntEsc(v)+'" step="'+(step||'any')+'" placeholder="'+(ph||'')+'" onchange="veMntSet(\''+node.id+'\',\''+key+'\',this.value)" style="width:100%; padding:4px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right;">';
}
function _mntRow(label, sub, inner){
  return '<tr style="border-bottom:1px solid var(--border-color);">'
    + '<th style="padding:5px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:52%; font-weight:500; color:var(--text-secondary);">'+label+(sub?' <span style="color:var(--text-muted); font-weight:400;">'+sub+'</span>':'')+'</th>'
    + '<td style="padding:3px 5px; background:var(--bg-tertiary);">'+inner+'</td></tr>';
}
// ─── Estetik girdi yardımcıları (kompakt, ince, hizalı) ──────────────────────
// Ortak input stili — küçük, zarif, odakta vurgu.
var _MNT_INP='padding:4px 6px; font-size:var(--fs-body); height:25px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right; box-sizing:border-box;';
// Bölüm başlığı (ince alt çizgi + opsiyonel birim).
function _mntGrpTitle(title, unit){
  return '<div style="font-size:var(--fs-tiny); font-weight:700; color:var(--text-heading); border-bottom:1px solid var(--border-color); padding-bottom:4px; margin:3px 0 9px;">'+title+(unit?' <span style="font-size:var(--fs-micro); font-weight:400; color:var(--text-muted);">'+unit+'</span>':'')+'</div>';
}
// Kart sarmalı — başlık + aksan çubuğu + içerik. Bölümleri görsel olarak gruplar
// (estetik: yumuşak zemin, yuvarlak köşe, sol aksan).
function _mntCard(title, unit, accent, inner){
  var head = title ? '<div style="display:flex; align-items:center; gap:7px; margin-bottom:9px;">'
    + '<span style="width:3px; height:12px; border-radius:2px; background:'+(accent||'var(--accent-primary)')+';"></span>'
    + '<span style="font-size:var(--fs-tiny); font-weight:700; color:var(--text-heading); letter-spacing:0.02em;">'+title+'</span>'
    + (unit ? '<span style="font-size:var(--fs-micro); font-weight:400; color:var(--text-muted);">'+unit+'</span>' : '')
    + '</div>' : '';
  return '<div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:11px 12px 6px; margin-bottom:9px;">'+head+inner+'</div>';
}
// Etiketli 3'lü inline grup (x/y/z yan yana). title boşsa üst başlık çizilmez
// (kart başlığı kapsıyorsa). subLabel verilirse solda küçük bir alt-etiket olur.
// phs (ops.): 3 elemanlı placeholder dizisi — kullanıcı beklenen mertebeyi görsün.
function _mntTriple(node, title, unit, keys, subs, step, phs){
  var h='<div style="margin-bottom:9px;">';
  if(title){ h+='<div style="font-size:var(--fs-micro); font-weight:600; color:var(--text-secondary); letter-spacing:0.03em; text-transform:uppercase; margin-bottom:5px;">'+title+(unit?' <span style="color:var(--text-muted); font-weight:400; text-transform:none; letter-spacing:0;">'+unit+'</span>':'')+'</div>'; }
  h+='<div style="display:flex; gap:5px;">';
  for(var i=0;i<3;i++){
    var key=keys[i];
    var v=(node.data[key]===undefined||node.data[key]===null)?'':node.data[key];
    var ph=(phs&&phs[i]!=null)?' placeholder="'+_mntEsc(phs[i])+'"':'';
    h+='<label style="flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;">'
      +'<span style="font-size:var(--fs-micro); color:var(--text-muted); text-align:center;">'+subs[i]+'</span>'
      +'<input type="number" id="ve-mnt-'+key+'-'+node.id+'" value="'+_mntEsc(v)+'" step="'+(step||'any')+'"'+ph+' onchange="veMntSet(\''+node.id+'\',\''+key+'\',this.value)" style="width:100%; '+_MNT_INP+'">'
      +'</label>';
  }
  h+='</div></div>';
  return h;
}
// Tek etiketli alan (etiket sol, dar input sağ).
function _mntSingle(node, title, unit, key, ph, step){
  var v=(node.data[key]===undefined||node.data[key]===null)?'':node.data[key];
  return '<div style="display:flex; align-items:center; gap:10px; margin-bottom:9px;">'
    +'<div style="flex:1; font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">'+title+(unit?' <span style="color:var(--text-muted); font-weight:400;">'+unit+'</span>':'')+'</div>'
    +'<input type="number" id="ve-mnt-'+key+'-'+node.id+'" value="'+_mntEsc(v)+'" step="'+(step||'any')+'" placeholder="'+(ph||'')+'" onchange="veMntSet(\''+node.id+'\',\''+key+'\',this.value)" style="width:120px; '+_MNT_INP+'">'
    +'</div>';
}
// Etiketli hücre ızgarası (cells=[{key,label,step,ph}], cols sütun).
function _mntGrid(node, cells, cols){
  cols=cols||3;
  var h='<div style="display:grid; grid-template-columns:repeat('+cols+',1fr); gap:7px 6px; margin-bottom:9px;">';
  cells.forEach(function(c){
    var v=(node.data[c.key]===undefined||node.data[c.key]===null)?'':node.data[c.key];
    h+='<label style="display:flex; flex-direction:column; gap:2px; min-width:0;">'
      +'<span style="font-size:var(--fs-micro); color:var(--text-muted); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">'+c.label+'</span>'
      +'<input type="number" id="ve-mnt-'+c.key+'-'+node.id+'" value="'+_mntEsc(v)+'" step="'+(c.step||'any')+'"'+(c.ph?' placeholder="'+_mntEsc(c.ph)+'"':'')+' onchange="veMntSet(\''+node.id+'\',\''+c.key+'\',this.value)" style="width:100%; '+_MNT_INP+'">'
      +'</label>';
  });
  h+='</div>';
  return h;
}
// Kısa ipucu satırı (not kutusu değil — tek satır, sade).
function _mntHint(text){
  return '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.4; margin:-3px 0 9px;">'+text+'</div>';
}

// ─── Tipe özel kinematik bölümleri (tork yük durumları için) ─────────────────
// Motor tork zinciri girdileri komponentler içine dağıtılır: Motor→tepe tork,
// Şanzıman→vites oranları + stall, Transfer→transfer oranı + aks payı.
// ─── Motor kataloğu köprüsü (Araç Performans preset'leri → takoz Motor'u) ────
// Aynı motor iki modülde de kullanılabiliyor; TAHRİK büyüklükleri (tepe tork,
// maks güç, rölanti) katalogda ZATEN var — elle ikinci kez girilmesin.
//
//   KATALOGDAN GELİR : Te · TeRpm · Pmax · PmaxRpm · idleRpm
//   ELLE KALIR       : kütle · ağırlık merkezi · atalet tensörü · silindir sayısı
//
// Elle kalanlar motor kataloğu verisi DEĞİL, araca özel entegrasyon verisidir
// (CATIA ölçümü); katalog onları taşımaz ve seçim onlara DOKUNMAZ.
//
// SESSİZ HATA TUZAĞI: preset'teki specs.inertia KRANK MİLİ DÖNER ataletidir
// (0,5–3 kg·m²) — takozun istediği rijit gövde atalet TENSÖRÜ (100+ kg·m²) ile
// aynı şey DEĞİLDİR, iki mertebe fark eder. Bu yüzden asla aktarılmaz.
function _mntEnginePresets(){
  if(typeof VE_FT_MOTOR_PRESETS!=='undefined') return VE_FT_MOTOR_PRESETS;
  if(typeof window!=='undefined' && window.VE_FT_MOTOR_PRESETS) return window.VE_FT_MOTOR_PRESETS;
  return null;
}

// Preset → takoz Motor alanları. Tepe tork ve maks güç eğriden okunur; düz tork
// platosunda EN DÜŞÜK devir alınır (katalog konvansiyonu — data artan devirde
// sıralı, kesin '>' ile ilk maksimum korunur). Bilinmeyen anahtar → null.
function _mntEnginePresetValues(key){
  var P=_mntEnginePresets(); if(!P || !P[key]) return null;
  var p=P[key], sp=p.specs||{}, rows=Array.isArray(p.data)?p.data:[];
  var out={};
  if(_mntNum(sp.idleRpm,0)>0) out.idleRpm=_mntNum(sp.idleRpm);
  var bt=null, bp=null;
  rows.forEach(function(r){
    var rpm=_mntNum(r.rpm,NaN), tq=_mntNum(r.torque,NaN), pw=_mntNum(r.power,NaN);
    if(!Number.isFinite(rpm)) return;
    if(Number.isFinite(tq) && (!bt || tq>bt.v)) bt={v:tq, rpm:rpm};
    if(Number.isFinite(pw) && (!bp || pw>bp.v)) bp={v:pw, rpm:rpm};
  });
  if(bt){ out.Te=bt.v;                        out.TeRpm=bt.rpm; }
  if(bp){ out.Pmax=Math.round(bp.v*10)/10;    out.PmaxRpm=bp.rpm; }
  return out;
}

// Katalog seçimi uygula. Boş anahtar → yalnız bağ kaldırılır, GİRİLEN DEĞERLER
// SİLİNMEZ (kullanıcı katalogdan yükleyip sonra elle rötuşlayabilsin).
function veMntApplyEnginePreset(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  if(!key){
    delete node.data.enginePreset;
  } else {
    var v=_mntEnginePresetValues(key); if(!v) return;
    Object.keys(v).forEach(function(k){ node.data[k]=v[k]; });
    node.data.enginePreset=key;
    if(typeof showToast==='function'){
      var P=_mntEnginePresets(), nm=(P && P[key] && P[key].name) || key;
      showToast('Motor katalogdan yüklendi: '+nm+' — kütle / CG / atalet elle girilir.','success');
    }
  }
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}

// Aile gruplaması — Araç Performans motor seçicisiyle (cp-engine.js) AYNI düzen,
// böylece kullanıcı iki modülde aynı listeyi görür.
var _MNT_ENG_FAMILIES = [
  {label:'BMC / AZRA',        prefix:['azra_','bmc_']},
  {label:'Cummins ISB 4.5L',  prefix:['isb45']},
  {label:'Cummins ISB 6.7L',  prefix:['isb67']},
  {label:'Cummins ISL 8.9L',  prefix:['isl']},
  {label:'Cummins ISG 12L',   prefix:['isg']},
  {label:'Cummins ISM 10.8L', prefix:['ism']},
  {label:'Cummins ISX 15L',   prefix:['isx']},
  {label:'GM Duramax',        prefix:['duramax_']},
  {label:'Diğer',             prefix:[]}
];
function _mntEnginePresetSelect(node){
  var P=_mntEnginePresets();
  if(!P) return '';                      // katalog yüklü değil → seçiciyi hiç gösterme
  var keys=Object.keys(P); if(!keys.length) return '';
  var cur=node.data.enginePreset||'';
  var h='<select onchange="veMntApplyEnginePreset(\''+node.id+'\',this.value)" style="width:100%; padding:5px 8px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
  h+='<option value="">— Katalogdan motor seç ('+keys.length+' motor) —</option>';
  var used={};
  _MNT_ENG_FAMILIES.forEach(function(fam){
    var ks=keys.filter(function(k){
      if(used[k]) return false;
      if(!fam.prefix.length) return true;
      return fam.prefix.some(function(p){ return k.indexOf(p)===0; });
    });
    if(!ks.length) return;
    h+='<optgroup label="'+_mntEsc(fam.label)+' ('+ks.length+')">';
    ks.forEach(function(k){ used[k]=1;
      h+='<option value="'+_mntEsc(k)+'"'+(k===cur?' selected':'')+'>'+_mntEsc(P[k].name||k)+'</option>'; });
    h+='</optgroup>';
  });
  h+='</select>';
  return h;
}

function _mntEngineSection(node){
  var sel=_mntEnginePresetSelect(node);
  var head='';
  if(sel){
    head = sel + '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.45; margin:5px 0 10px;">'
      + 'Seçilen motorun <b>tepe tork, maks güç ve rölanti devri</b> katalogdan otomatik dolar. '
      + '<b>Kütle, ağırlık merkezi ve atalet tensörü</b> katalogda bulunmaz (araca özel CATIA verisi) — elle girilir, seçim onlara dokunmaz.</div>';
  }
  return _mntCard('Motor · Tahrik','', 'var(--accent-danger)',
      head
    + _mntGrid(node, [
        {key:'Te',        label:'Tepe Tork [Nm]',  step:'1',   ph:'760'},
        {key:'TeRpm',     label:'@ Devir [rpm]',   step:'1',   ph:'1500'},
        {key:'Pmax',      label:'Maks Güç [kW]',   step:'0.1', ph:'156.6'},
        {key:'PmaxRpm',   label:'@ Devir [rpm]',   step:'1',   ph:'2300'},
        {key:'idleRpm',   label:'Rölanti [rpm]',   step:'1',   ph:'800'},
        {key:'cylinders', label:'Silindir sayısı', step:'1',   ph:'6'}
      ], 3)
    + _mntHint('Tork yük durumları <b>Tepe Tork</b> değerinden türetilir. <b>Rölanti devri + silindir sayısı</b> raporun ateşleme frekansını verir: f<sub>ateş</sub> = (N/60)·(z/2) — Kriter 1 ve iletilebilirlik bunun üzerine kurulur. Silindir sayısı katalogda yoktur, elle girilir.'));
}
function _mntGearboxSection(node){
  return _mntCard('Şanzıman · Vites Oranları','', 'var(--accent-danger)',
      _mntGrid(node, [
        {key:'g1', label:'1. Vites',    step:'0.01', ph:'3.10'},
        {key:'g2', label:'2. Vites',    step:'0.01', ph:'1.81'},
        {key:'g3', label:'3. Vites',    step:'0.01', ph:'1.41'},
        {key:'g4', label:'4. Vites',    step:'0.01', ph:'1.00'},
        {key:'g5', label:'5. Vites',    step:'0.01', ph:'0.71'},
        {key:'g6', label:'6. Vites',    step:'0.01', ph:'0.61'},
        {key:'gR', label:'Geri',        step:'0.01', ph:'-4.49'},
        {key:'Rstall', label:'Stall Oranı', step:'0.01', ph:'1.58'}
      ], 4)
    + _mntHint('İleri tork durumu <b>1. Vites</b> (en yüksek redüksiyon), geri tork <b>Geri</b> ile hesaplanır. Stall Oranı = konvertör tork çarpanı.'));
}
function _mntTransferSection(node){
  return _mntCard('Transfer Kutusu · Tahrik','', 'var(--accent-danger)',
      _mntGrid(node, [
        {key:'iTransfer', label:'Oran',      step:'0.001', ph:'3.428'},
        {key:'phiFwd',    label:'Aks Payı φ (ileri)', step:'0.001', ph:'1'},
        {key:'phiRev',    label:'Aks Payı φ (geri)',  step:'0.001', ph:'1'}
      ], 3)
    + _mntHint('Aks payı φ: takozlara ulaşan tork oranı (varsayılan 1 = tam tepki).'));
}

// ─── PTO GRUBU (PTO · Pompa · PTO Toplam) ────────────────────────────────────
// Bu üç bileşen aynı kütle panelini kullanır; farkları burada eklenen bilgi
// şerididir: (1) hangi giriş yolunda olduğun, (2) referans değerler, (3) iki
// yolun ÇAKIŞTIĞI durumun canlı uyarısı. "Bu bir PTO tipi mi?" sorusunun tek
// kaynağı _MNT_PTO_REF anahtarlarıdır (ayrı bir tip listesi tutulmaz).

// Panel girdilerinin placeholder'ları — kullanıcı beklenen mertebeyi görsün.
// Kaynak: ASR-SR-116 (ASFAT 8x8 Obüs) Tablo 2/3/4, mm · kg · kg·m².
var _MNT_PTO_PH = {
  'mnt-pto':       { mass:'25',   cg:['741,21','77,01','894,73'] },
  'mnt-pump':      { mass:'37',   cg:['971,21','77,01','894,73'] },
  'mnt-pto-group': { mass:'97',   cg:['1058,06','77,01','894,73'], I:['0,45','6,515','6,15'] }
};

// Referans tabloları — ASR-SR-116 Tablo 4 (parça bazında) ve Tablo 2+3 (grup).
// Rapor grup ataletini YALNIZ toplam için verir; tek tek PTO/pompa ataleti
// belgede yoktur — bu yüzden parça satırlarında atalet sütunu da yoktur.
var _MNT_PTO_REF = {
  'mnt-pto': {
    head: ['PTO parçası','m [kg]','X [mm]','Y [mm]','Z [mm]'],
    rows: [['Üst PTO','25','741,21','77,01','894,73'],
           ['Yan PTO','25','741,21','−269,52','473,30']]
  },
  'mnt-pump': {
    head: ['Pompa','m [kg]','X [mm]','Y [mm]','Z [mm]'],
    rows: [['Üst Pompa 1','37','971,21','77,01','894,73'],
           ['Üst Pompa 2','17,5','1271,20','77,01','894,73'],
           ['Üst Pompa 3','17,5','1481,21','77,01','894,73'],
           ['Yan Pompa 1','21','991,21','−269,52','473,30']]
  },
  'mnt-pto-group': {
    head: ['Grup','m [kg]','X [mm]','Y [mm]','Z [mm]','Ixx','Iyy','Izz'],
    rows: [['Üst PTO Grubu','97','1058,06','77,01','894,73','0,45','6,515','6,15'],
           ['Yan PTO Grubu','46','855,34','−269,52','473,30','0,136','0,915','0,915']]
  }
};

// Topolojide İKİ giriş yolu birden kullanılıyor mu? (PTO Toplam + ayrı PTO/Pompa
// → aynı kütle iki kez sayılır). Döner: null | {groups:[ad], parts:[ad]}.
function _mntPtoConflict(){
  if(typeof nodes==='undefined' || !nodes) return null;
  var groups=[], parts=[];
  nodes.forEach(function(n){
    if(!n) return;
    if(n.type==='mnt-pto-group') groups.push(_mntNodeName(n));
    else if(n.type==='mnt-pto' || n.type==='mnt-pump') parts.push(_mntNodeName(n));
  });
  return (groups.length && parts.length) ? { groups:groups, parts:parts } : null;
}

// Referans değer tablosu — katlanır (<details>), varsayılan kapalı: panel sade
// kalsın, isteyen açsın.
function _mntPtoRefTable(type){
  var ref=_MNT_PTO_REF[type]; if(!ref) return '';
  var th='padding:4px 7px; text-align:right; color:var(--text-muted); font-weight:600; border-bottom:1px solid var(--border-color); white-space:nowrap;';
  var td='padding:3px 7px; text-align:right; color:var(--text-primary); font-variant-numeric:tabular-nums; white-space:nowrap;';
  var h='<details style="margin-top:2px;"><summary style="cursor:pointer; font-size:var(--fs-micro); color:var(--text-secondary); padding:2px 0; user-select:none;">ASR-SR-116 referans değerleri <span style="color:var(--text-muted);">(ASFAT 8x8 Obüs)</span></summary>';
  h+='<div style="overflow-x:auto; margin-top:6px;"><table style="width:100%; border-collapse:collapse; font-size:var(--fs-micro);"><thead><tr>';
  ref.head.forEach(function(c,i){ h+='<th style="'+th+(i===0?' text-align:left;':'')+'">'+_mntEsc(c)+'</th>'; });
  h+='</tr></thead><tbody>';
  ref.rows.forEach(function(r){
    h+='<tr style="border-bottom:1px solid var(--border-color);">';
    r.forEach(function(c,i){ h+='<td style="'+td+(i===0?' text-align:left; color:var(--text-secondary);':'')+'">'+_mntEsc(c)+'</td>'; });
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  h+='<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.45; margin-top:6px;">Değerler global eksen takımına göredir. Atalet birimi kg·m². Kendi projenin değerlerini gir — bunlar yalnız mertebe referansıdır.</div>';
  h+='</details>';
  return h;
}

// PTO grubu bilgi şeridi (tam genişlik alt kart): giriş yolu + çakışma uyarısı
// + referans tablosu.
function _mntPtoSection(node){
  var isGroup = (node.type==='mnt-pto-group');
  var lead = isGroup
    ? '<b style="color:var(--text-heading);">Toplu giriş.</b> Tüm PTO grubunu (kuyruk mili + pompalar) tek kalemde tanımlarsın: '
      + 'grup kütlesi, grup ağırlık merkezi ve <b>grup atalet tensörü</b>. Ayrıntı gerekmiyorsa en pratik yol budur.'
    : '<b style="color:var(--text-heading);">Ayrıntılı giriş.</b> Her parçayı kendi kütle ve ağırlık merkeziyle ayrı ayrı tanımlarsın. '
      + 'Parça ataleti çoğu katalogda verilmez — <b>nokta kütle</b> bırakılırsa grubun ataleti, parçaların CG yayılımından '
      + 'paralel-eksen teoremiyle çözücüde kendiliğinden oluşur.';
  var body = '<div style="font-size:var(--fs-tiny); color:var(--text-secondary); line-height:1.55; margin-bottom:8px;">'+lead+'</div>';

  var cf=_mntPtoConflict();
  if(cf){
    body += '<div style="display:flex; gap:8px; padding:8px 10px; margin-bottom:8px; border:1px solid var(--accent-warning); '
      + 'background:color-mix(in srgb, var(--accent-warning) 11%, transparent); border-radius:var(--radius-sm); '
      + 'font-size:var(--fs-tiny); line-height:1.5; color:var(--text-secondary);">'
      + '<span style="color:var(--accent-warning); font-weight:700;">⚠</span>'
      + '<span><b style="color:var(--accent-warning);">Kütle iki kez sayılıyor olabilir.</b> Topolojide hem <b>PTO Toplam</b> ('
      + cf.groups.length + ') hem de ayrı <b>PTO/Pompa</b> (' + cf.parts.length + ') bileşeni var. '
      + 'İki giriş yolu aynı kütleyi temsil eder — birini seçip diğerini silin.</span></div>';
  }
  body += _mntPtoRefTable(node.type);
  return _mntCard('PTO Grubu · Giriş Yolu','', 'var(--accent-success)', body);
}

function getMntMassPropertiesHTML(node){
  _mntEnsureMassData(node);
  var d=node.data;
  var ph=_MNT_PTO_PH[node.type] || null;      // tipe özel placeholder (PTO grubu)
  // SOL (girdi): kütle + ağırlık merkezi + nokta-kütle anahtarı.
  var massCard=_mntCard('Kütle & Ağırlık Merkezi','[kg · mm]','var(--accent-primary)',
      _mntSingle(node,'Kütle','[kg]','mass',(ph?ph.mass:'ör: 1386.3'),'0.001')
    + _mntTriple(node,'Ağırlık Merkezi (CG)','[mm]',['cgx','cgy','cgz'],['x','y','z'],'0.01',(ph?ph.cg:null)));
  var toggle='<label style="display:flex; align-items:center; gap:8px; font-size:var(--fs-tiny); color:var(--text-secondary); margin:0 2px 9px; cursor:pointer;"><input type="checkbox" '+(d.pointMass?'checked':'')+' onchange="veMntSetCheck(\''+node.id+'\',\'pointMass\',this.checked)"> Nokta kütle (atalet = 0)</label>';
  // SAĞ (çıktı/tanım): atalet tensörü — nokta kütlede yerine kısa bilgi kartı gelir
  // (sağ sütun boş kalmasın, tüm gövde tiplerinde denge korunsun).
  var ptFor = (node.type==='mnt-pto'||node.type==='mnt-pump')
    ? 'PTO/pompa parçaları gibi ataleti katalogda verilmeyen gövdeler için uygundur; grubun ataleti parçaların CG yayılımından paralel-eksen teoremiyle zaten oluşur.'
    : 'Şaft gibi ince/hafif gövdeler için uygundur.';
  var rightCard = (!d.pointMass)
    ? _mntCard('Atalet Tensörü','[kg·m²]','var(--accent-warning)',
          _mntTriple(node,'Köşegen','',['Ixx','Iyy','Izz'],['Ixx','Iyy','Izz'],'0.001',(ph&&ph.I?ph.I:null))
        + _mntTriple(node,'Çarpım','',['Ixy','Ixz','Iyz'],['Ixy','Ixz','Iyz'],'0.001'))
    : _mntCard('Nokta Kütle','I = 0','var(--accent-warning)',
          '<div style="font-size:var(--fs-tiny); color:var(--text-secondary); line-height:1.5;">Atalet tensörü <b style="color:var(--text-heading);">sıfır</b> kabul edilir; kütle tümüyle ağırlık merkezinde toplanır. '+ptFor+' Atalet girmek için işareti kaldırın.</div>');
  var drive = node.type==='mnt-motor'  ? _mntEngineSection(node)
            : node.type==='mnt-gearbox' ? _mntGearboxSection(node)
            : node.type==='mnt-transfer'? _mntTransferSection(node)
            : _MNT_PTO_REF[node.type]   ? _mntPtoSection(node) : '';
  var html='<div class="sw-panel">';
  html+='<div class="ve-cp-grid ve-cp-grid--cards">';
  html+='<div class="ve-cp-col ve-cp-col--in">'+massCard+toggle+'</div>';
  html+='<div class="ve-cp-col ve-cp-col--out">'+rightCard+'</div>';
  html+='</div>';
  if(drive) html+=drive;   // tork/tahrik veya PTO bilgi şeridi — tam genişlik alt şerit
  html+='</div>';
  return html;
}

// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ PANELİ (konum + statik/dinamik rijitlik + kütüphane)
// ════════════════════════════════════════════════════════════════════════════
function getMntMountPropertiesHTML(node){
  if(!node.data) node.data={};
  var html='<div class="sw-panel">';
  // Kütüphane (gömülü + "Takoz Özellikleri" ile eklenen kullanıcı takozları)
  var _lib=veMntGetLibraryList();
  var _libB=_lib.filter(function(e){ return e.builtin; });
  var _libC=_lib.filter(function(e){ return !e.builtin; });
  var sel='<select onchange="veMntApplyLib(\''+node.id+'\',this.value)" style="width:100%; padding:5px 8px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm);"><option value="">— Kütüphaneden rijitlik yükle —</option>';
  if(_libB.length){ sel+='<optgroup label="Gömülü">'; _libB.forEach(function(e){ sel+='<option value="'+_mntEsc(e.key)+'"'+(node.data.libKey===e.key?' selected':'')+'>'+_mntEsc(e.name)+'</option>'; }); sel+='</optgroup>'; }
  if(_libC.length){ sel+='<optgroup label="Özel (Takoz Özellikleri)">'; _libC.forEach(function(e){ sel+='<option value="'+_mntEsc(e.key)+'"'+(node.data.libKey===e.key?' selected':'')+'>'+_mntEsc(e.name)+'</option>'; }); sel+='</optgroup>'; }
  sel+='</select>';
  // İki sütun: SOL = kaynak/konum (kütüphaneden yükle + nereye konumlanmış),
  // SAĞ = rijitlik çifti (statik + dinamik, aynı 3-eksen biçimi → doğal eş).
  var left  = _mntCard('Kütüphane','', 'var(--accent-success)', sel)
            + _mntCard('Konum','[mm]','var(--accent-primary)', _mntTriple(node,'','',['x','y','z'],['x','y','z'],'0.01'));
  var right = _mntCard('Statik Rijitlik','[N/mm]','var(--accent-warning)', _mntTriple(node,'','',['kxs','kys','kzs'],['kx','ky','kz'],'1'))
            + _mntCard('Dinamik Rijitlik','[N/mm]','var(--accent-warning)', _mntTriple(node,'','',['kxd','kyd','kzd'],['kx','ky','kz'],'1'));
  html+='<div class="ve-cp-grid ve-cp-grid--cards">';
  html+='<div class="ve-cp-col ve-cp-col--in">'+left+'</div>';
  html+='<div class="ve-cp-col ve-cp-col--out">'+right+'</div>';
  html+='</div>';
  html+=_mntMountCurveNote(node);   // nonlineer eğri notu (varsa) — tam genişlik alt
  html+='</div>';
  return html;
}

// Takoz'a uygulanmış nonlineer z-eğrisi için SALT-OKUNUR bilgi notu. Eğri artık
// "Takoz Özellikleri" (kütüphane) bileşeninde bir takoz TİPİNİN özelliği olarak
// tanımlanır; kütüphaneden uygulandığında node.data.curveZ'e kopyalanır. Burada
// yalnız gösterilir, düzenlenmez (düzenleme kütüphane panelinde).
function _mntMountCurveNote(node){
  var axes=[['X','x'],['Y','y'],['Z','z']].filter(function(a){
    var p=node.data['curve'+a[0]]; return Array.isArray(p)&&p.length>=2;
  });
  if(!axes.length) return '';
  var labels=axes.map(function(a){ return a[1]; }).join(', ');
  var carrier=(axes.length===1) ? ('<b style="color:var(--text-heading);">nonlineer '+labels+'-eğrisi</b>')
                                 : ('<b style="color:var(--text-heading);">'+labels+'</b> eksenlerinde <b style="color:var(--text-heading);">nonlineer eğri</b>');
  var inner = '<div style="font-size:var(--fs-micro); color:var(--text-secondary); line-height:1.5;">'
    + 'Bu takoz '+carrier+' taşıyor → çözücü onu Newton ile çözer. '
    + 'Eğri <b>Takoz Özellikleri</b> bileşenindeki takoz tipinden gelir ve oradan düzenlenir.</div>';
  return _mntCard('Kuvvet–Sehim Eğrisi ('+labels+')','nonlineer · kütüphaneden','var(--accent-danger)', inner);
}

// ─── Setters ─────────────────────────────────────────────────────────────────
function veMntSet(nodeId, key, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  node.data[key]=val;
  if(typeof saveState==='function') saveState();
}
// Örnek seçimi: kalıcı yaz + paneli yeniden çiz (görsel/detay canlı değişsin).
function veMntSetExample(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  node.data.exampleKey=key;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntSetCheck(nodeId, key, checked){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  node.data[key]=!!checked;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node); // atalet alanlarını göster/gizle
}
function veMntApplyLib(nodeId, key){
  if(!key) return;
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var m=veMntGetLibraryMap()[key]; if(!m) return;
  if(!node.data) node.data={};
  node.data.kxs=m.sx; node.data.kys=m.sy; node.data.kzs=m.sz;
  node.data.kxd=m.dx; node.data.kyd=m.dy; node.data.kzd=m.dz; node.data.libKey=key;
  // Nonlineer yasa kütüphane girdisinin özelliği: uygularken 3 ekseni de Takoz'a
  // KOPYALA (anlık snapshot; gather okur). Eksen başına fit ÖNCELİKLİ; yoksa nokta
  // tablosu; ikisi de yoksa o eksende eski yasa temizlenir (lineere döner).
  ['X','Y','Z'].forEach(function(A){
    var fit=m['fit'+A], cur=m['curve'+A];
    if(fit && (fit.form==='poly'||fit.form==='asym')){
      node.data['fit'+A]=JSON.parse(JSON.stringify(fit));   // fabrika mutasyona uğramaz
      delete node.data['curve'+A];
    } else if(Array.isArray(cur) && cur.length>=2){
      node.data['curve'+A]=cur.map(function(p){ return [_mntNum(p[0]), _mntNum(p[1])]; });
      delete node.data['fit'+A];
    } else {
      delete node.data['fit'+A]; delete node.data['curve'+A];
    }
  });
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}

// (Nonlineer z-eğrisi düzenleme artık Takoz Özellikleri kütüphane panelinde —
//  veMntLibCurve* — takoz TİPİNE bağlı; veMntApplyLib uygulanınca Takoz'a kopyalar.)

// ════════════════════════════════════════════════════════════════════════════
//  ÖRNEK — hazır doğrulama modellerini seç, önizle ve topolojiye yükle
// ════════════════════════════════════════════════════════════════════════════
// "Örnek" bileşeni: gömülü örnek modelleri (veMountCore.MOUNT_EXAMPLES) seçip
// önizler ve tek tıkla iç topolojiye kurar. Panel yukarıdan aşağı: preset seçici
// → topoloji görseli → araç detayları → "Örneği Aktar" → tutarlılık raporu.
// Yeni örnek eklemek: mount-core.js MOUNT_EXAMPLES defterine bir giriş ekle —
// başka hiçbir yeri değiştirmeye gerek yoktur (panel + yükleyici buradan okur).

// Kayıt defteri erişimi — çekirdeğe bağlı, çekirdek yoksa güvenli düşüş.
function _mntExampleReg(key){
  if(typeof veMountCore!=='undefined' && veMountCore.getMountExample) return veMountCore.getMountExample(key);
  var m=(typeof veMountCore!=='undefined') ? veMountCore.TTAR_EXAMPLE : null;
  return { id:'ttar', name:'BMC TTAR 2031', vehicle:'BMC TTAR 2031', model:m };
}
function _mntExampleList(){
  if(typeof veMountCore!=='undefined' && veMountCore.getMountExampleList) return veMountCore.getMountExampleList();
  return [_mntExampleReg('ttar')];
}

// Örnek adı → kanvas kütle-gövdesi tipi (test buildTTARTopology ile aynı eşleme).
// Yükleyici önce c.kind'i, yoksa bu adı kullanır.
// PTO kalıpları motor/şanzımandan ÖNCE denenir ("PTO Grubu" içinde motor/şanzıman
// geçmez ama sıralama niyeti açık tutsun); grup → pompa → PTO sırası zorunlu:
// "Top PTO Group" hem /pto/ hem /group/ eşler, en özgül olan kazanmalı.
function _mntExampleBodyType(name){
  return /(pto|pompa|pump)[^a-zçğıöşü]*(grubu|grup|group|toplam|total)|(grubu|grup|group|toplam|total)[^a-zçğıöşü]*(pto|pompa|pump)/i.test(name) ? 'mnt-pto-group'
    : /pompa|pump/i.test(name) ? 'mnt-pump'
    : /\bpto\b|kuyruk\s*mili/i.test(name) ? 'mnt-pto'
    : /motor/i.test(name) ? 'mnt-motor'
    : /şanz|sanz/i.test(name) ? 'mnt-gearbox'
    : /şaft|saft|shaft/i.test(name) ? 'mnt-shaft'
    : /cradle|braket|bracket/i.test(name) ? 'mnt-bracket' : 'mnt-transfer';
}

// Örnek modelinin yerel-piksel yerleşimi — HEM otomatik şema HEM yükleyici bunu
// kullanır, böylece görsel ile "Aktar"ın kurduğu topoloji birebir aynıdır.
// Koordinatlar STARTER yerleşimiyle uyumlu: kütleler orta bant (ly=205),
// takozlar ilk yarısı üst (ly=40), kalanı alt (ly=360). Bir bileşen veya takoz
// kendi at:[lx,ly] konumunu taşırsa o kullanılır (görsele tam uyum).
function _mntExampleLayout(model){
  var comps=(model&&model.components)||[], mounts=(model&&model.mounts)||[];
  var bodyY=205, half=Math.ceil(mounts.length/2);
  var bodies=comps.map(function(c,i){
    return (c.at&&c.at.length===2) ? {lx:c.at[0], ly:c.at[1]} : {lx:130+i*95, ly:bodyY};
  });
  var mnts=mounts.map(function(m,i){
    if(m.at&&m.at.length===2) return {lx:m.at[0], ly:m.at[1]};
    var top=i<half, col=top?i:(i-half);
    return {lx:140+col*140, ly: top?40:360};
  });
  return { bodies:bodies, mnts:mnts, bodyY:bodyY, half:half };
}

// componentDefs ikonunun iç SVG içeriğini çıkar (varsa) — nested <svg> ile gömmek için.
function _mntIconInner(type){
  var def=(typeof componentDefs!=='undefined') ? componentDefs[type] : null;
  var svg=def && def.svg;
  if(!svg) return null;
  var m=svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return m ? m[1] : null;
}

// Modelden tema-uyumlu şematik topoloji SVG'si üret (örnek kendi görselini
// vermediğinde). Kütle/takoz düğümleri uygulamanın GERÇEK ikonlarıyla
// (componentDefs) çizilir; ikon yoksa (ör. Jest) kutu/daireye düşer. tools[] =
// önizleme süsü (yardımcı araçlar; yükleyici bunları KURMAZ). Yükleyiciyle aynı
// at:[lx,ly] yerleşimini kullanır → görsel ile kurulan kanvas birebir örtüşür.
function _mntExampleDiagramSVG(model, tools){
  if(!model || !model.components || !model.components.length) return '';
  var L=_mntExampleLayout(model), comps=model.components, mounts=model.mounts||[];
  var items=[];
  comps.forEach(function(c,i){ items.push({type:(c.kind||_mntExampleBodyType(c.name)), name:c.name, x:L.bodies[i].lx, y:L.bodies[i].ly, role:'body'}); });
  mounts.forEach(function(m,i){ items.push({type:'mnt-mount', name:m.name, x:L.mnts[i].lx, y:L.mnts[i].ly, role:'mount'}); });
  (tools||[]).forEach(function(t){ if(t && t.at && t.at.length===2) items.push({type:t.type, name:t.name, x:t.at[0], y:t.at[1], role:'tool'}); });
  var CARD=54, IC=40, LBL=15, M=22, xs=[], ys=[];
  items.forEach(function(it){ xs.push(it.x-CARD/2, it.x+CARD/2); ys.push(it.y-CARD/2, it.y+CARD/2+LBL); });
  var minX=Math.round(Math.min.apply(null,xs)-M), maxX=Math.round(Math.max.apply(null,xs)+M);
  var minY=Math.round(Math.min.apply(null,ys)-M), maxY=Math.round(Math.max.apply(null,ys)+M);
  var s='<svg viewBox="'+minX+' '+minY+' '+(maxX-minX)+' '+(maxY-minY)+'" width="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="display:block;font-family:inherit;">';
  // Takoz → en yakın kütle ince kılavuz çizgisi (arka planda)
  var bodies=items.filter(function(it){ return it.role==='body'; });
  items.filter(function(it){ return it.role==='mount'; }).forEach(function(mo){
    var nb=bodies[0], bd=Infinity;
    bodies.forEach(function(bp){ var dx=bp.x-mo.x, dy=bp.y-mo.y, d=dx*dx+dy*dy; if(d<bd){ bd=d; nb=bp; } });
    if(nb) s+='<line x1="'+mo.x+'" y1="'+mo.y+'" x2="'+nb.x+'" y2="'+nb.y+'" stroke="var(--border-hover)" stroke-width="1.3" stroke-dasharray="3 3" opacity="0.55"/>';
  });
  // Düğümler: kart + gerçek ikon (yoksa yedek) + etiket
  items.forEach(function(it){
    var x0=it.x-CARD/2, y0=it.y-CARD/2, tool=it.role==='tool';
    var stroke=tool?'var(--border-color)':(it.role==='mount'?'var(--accent-success)':'var(--accent-primary)');
    s+='<rect x="'+x0+'" y="'+y0+'" width="'+CARD+'" height="'+CARD+'" rx="9" fill="var(--bg-secondary)" stroke="'+stroke+'" stroke-width="'+(tool?1.2:1.6)+'"'+(tool?' opacity="0.9"':'')+'/>';
    var inner=_mntIconInner(it.type);
    if(inner){
      s+='<svg x="'+(it.x-IC/2)+'" y="'+(it.y-IC/2)+'" width="'+IC+'" height="'+IC+'" viewBox="0 0 100 100">'+inner+'</svg>';
    } else if(it.role==='mount'){
      s+='<circle cx="'+it.x+'" cy="'+it.y+'" r="13" fill="var(--accent-success)" fill-opacity="0.16" stroke="var(--accent-success)" stroke-width="2"/><circle cx="'+it.x+'" cy="'+it.y+'" r="4" fill="var(--accent-success)"/>';
    } else {
      s+='<rect x="'+(it.x-16)+'" y="'+(it.y-9)+'" width="32" height="18" rx="3" fill="var(--bg-tertiary)" stroke="var(--accent-primary)" stroke-width="1.5"/>';
    }
    s+='<text x="'+it.x+'" y="'+(it.y+CARD/2+11)+'" text-anchor="middle" font-size="10.5" fill="'+(tool?'var(--text-muted)':'var(--text-secondary)')+'">'+_mntEsc(it.name)+'</text>';
  });
  s+='</svg>';
  return s;
}

// Örnek görselini panele bas: inline SVG → doğrudan (tema uyumlu); data-URI ya da
// göreli yol → <img>. fallback verilirse ve resim yüklenemezse (dosya henüz
// eklenmemişse) kırık resim yerine yedek şema gösterilir. Boşsa çağıran taraf
// otomatik şemaya düşer.
function _mntExampleImageHTML(image, fallback){
  var s=String(image==null?'':image).trim();
  if(!s) return '';
  if(/^<svg/i.test(s)) return s;
  var fb=fallback||'';
  var onerr=fb?' onerror="this.style.display=\'none\'; if(this.nextElementSibling) this.nextElementSibling.style.display=\'block\';"':'';
  var h='<img src="'+_mntEsc(s)+'" alt="Topoloji şeması" loading="lazy" style="display:block; width:100%; height:auto;"'+onerr+'/>';
  if(fb) h+='<div style="display:none;">'+fb+'</div>';
  return h;
}

// Detay bloğu — araç adı + kısa etiket + açıklama + spec tablosu.
function _mntExampleDetailsHTML(ex){
  var h='<div style="margin-bottom:12px;">';
  h+='<div style="font-size:var(--fs-lg); font-weight:700; color:var(--text-heading); line-height:1.25;">'+_mntEsc(ex.vehicle||ex.name||'')+'</div>';
  if(ex.subtitle) h+='<div style="font-size:var(--fs-tiny); color:var(--accent-primary); font-weight:600; margin-top:2px;">'+_mntEsc(ex.subtitle)+'</div>';
  if(ex.description) h+='<div style="font-size:var(--fs-tiny); color:var(--text-secondary); line-height:1.5; margin-top:7px;">'+_mntEsc(ex.description)+'</div>';
  h+='</div>';
  var specs=ex.specs||[];
  if(specs.length){
    h+='<table style="width:100%; font-size:var(--fs-tiny); border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:13px;">';
    specs.forEach(function(r){
      h+='<tr style="border-bottom:1px solid var(--border-color);">'
        +'<th style="padding:5px 9px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:52%; font-weight:500; color:var(--text-secondary); white-space:nowrap;">'+_mntEsc(r[0])+'</th>'
        +'<td style="padding:5px 9px; color:var(--text-primary); font-weight:600;">'+_mntEsc(r[1])+'</td></tr>';
    });
    h+='</table>';
  }
  return h;
}

function getMntExamplePropertiesHTML(node){
  if(!node.data) node.data={};
  var list=_mntExampleList();
  var sel=node.data.exampleKey || (list[0]&&list[0].id) || 'siper';
  var ex=_mntExampleReg(sel);
  var nid=node.id;
  var autoSvg = _mntExampleDiagramSVG(ex.model, ex.tools);
  var diagram = ex.image ? _mntExampleImageHTML(ex.image, autoSvg) : autoSvg;
  // ── SOL (girdi/bilgi): model seçici + detay + aktar/dışa-aktar + tutarlılık raporu ──
  var left='';
  left+='<div style="font-size:var(--fs-micro); font-weight:700; color:var(--text-secondary); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:5px;">Örnek Model</div>';
  left+='<select id="ve-mnt-example-sel" onchange="veMntSetExample(\''+nid+'\',this.value)" style="width:100%; padding:5px 8px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); margin-bottom:11px;">';
  list.forEach(function(e){ left+='<option value="'+_mntEsc(e.id)+'"'+(sel===e.id?' selected':'')+'>'+_mntEsc(e.name)+'</option>'; });
  left+='</select>';
  left+=_mntExampleDetailsHTML(ex);
  left+='<button onclick="veMntLoadExample(\''+nid+'\')" style="width:100%; padding:11px 14px; font-size:var(--fs-md); font-weight:700; background:var(--accent-warning); color:#111; border:none; cursor:pointer; border-radius:var(--radius-sm); letter-spacing:0.02em;" onmouseover="this.style.filter=\'brightness(1.1)\'" onmouseout="this.style.filter=\'none\'">▶ Örneği Aktar</button>';
  left+='<button onclick="veMntExportTopology()" title="Kanvastaki iç topolojiyi JSON dosyası olarak indir — yeni örnek üretmek için" style="width:100%; margin-top:8px; padding:8px 14px; font-size:var(--fs-body); font-weight:600; background:var(--bg-tertiary); color:var(--text-secondary); border:1px solid var(--border-color); cursor:pointer; border-radius:var(--radius-sm);" onmouseover="this.style.borderColor=\'var(--accent-primary)\'; this.style.color=\'var(--text-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\'; this.style.color=\'var(--text-secondary)\'">↓ İç Topolojiyi JSON Dışa Aktar</button>';
  left+='<div id="ve-mnt-example-report" style="margin-top:12px;"></div>';

  // ── SAĞ (önizleme): topoloji şeması — geniş sütunda büyük gösterilir ──
  var right='';
  if(diagram){
    right+='<div style="font-size:var(--fs-micro); font-weight:700; color:var(--text-muted); letter-spacing:0.03em; text-transform:uppercase; margin-bottom:5px;">Topoloji</div>';
    // İç kap genişliği sınırlar (en-boy korunur), içteki <img>/<svg> %100 ile doldurur.
    right+='<div style="width:100%; padding:14px; box-sizing:border-box; border:1px solid var(--border-color); background:var(--bg-primary); border-radius:var(--radius-md); overflow:hidden; text-align:center;">'
      +'<div style="display:inline-block; width:100%; max-width:460px; vertical-align:top;">'+diagram+'</div>'
      +'</div>';
  }

  var html='<div class="sw-panel">';
  html+='<div class="ve-cp-grid">';
  html+='<div class="ve-cp-col ve-cp-col--in">'+left+'</div>';
  html+='<div class="ve-cp-col ve-cp-col--out">'+right+'</div>';
  html+='</div>';
  html+='</div>';
  return html;
}

// Örnek modeli tutarlılık kontrolü — uyarı nesneleri döner ({level,msg}).
function _mntExampleValidate(){
  var g = _mntGatherForSolver();
  var out=[];
  if(g.components.length===0) out.push({level:'err', msg:'Kütle gövdesi yok — en az bir kütle gerekir.'});
  if(g.mounts.length===0) out.push({level:'err', msg:'Takoz yok — 6 SD kısıtı için en az 3 takoz gerekir.'});
  else if(g.mounts.length<3) out.push({level:'warn', msg:'Az takoz: '+g.mounts.length+' takoz — rijit gövde kısıtı için ≥3 önerilir.'});
  else if(g.mounts.length>4) out.push({level:'warn', msg:'Fazla takoz: '+g.mounts.length+' takoz tanımlı — tipik güç grubu 3–4 takozla bağlanır (aşırı-kısıtlı model).'});
  g.components.forEach(function(c){ if(!(_mntNum(c.mass)>0)) out.push({level:'err', msg:_mntEsc(c.name)+': kütle tanımsız/sıfır.'}); });
  g.mounts.forEach(function(m){
    if(!(_mntNum(m.kzs)>0)) out.push({level:'warn', msg:_mntEsc(m.name)+': düşey (z) statik rijitlik tanımsız.'});
    if(!Number.isFinite(_mntNum(m.z,NaN))) out.push({level:'warn', msg:_mntEsc(m.name)+': z konumu tanımsız.'});
  });
  // PTO grubu: iki giriş yolu (toplu / ayrıntılı) aynı anda kullanılırsa kütle
  // İKİ KEZ sayılır — çözücü sessizce "makul ama yanlış" bir toplam üretir.
  var pc=_mntPtoConflict();
  if(pc) out.push({level:'warn', msg:'PTO Toplam ('+pc.groups.length+') ile ayrı PTO/Pompa bileşenleri ('+pc.parts.length+') birlikte tanımlı — aynı kütle iki kez sayılıyor olabilir. Bir giriş yolunu seçin.'});
  var hasSolver = (typeof nodes!=='undefined') && nodes.some(function(n){ return (_mntDef(n)||{}).isMountSolver; });
  if(!hasSolver) out.push({level:'warn', msg:'Çözücü bulunamadı — sonuç için bir Çözücü ekleyin.'});
  return out;
}

function _mntRenderExampleReport(warnings, silent){
  var el = (typeof document!=='undefined') ? document.getElementById('ve-mnt-example-report') : null;
  if(!el) return;
  if(!warnings.length){
    el.innerHTML='<div style="padding:9px 11px; background:color-mix(in srgb, var(--accent-success) 12%, transparent); border:1px solid var(--accent-success); border-radius:5px; font-size:var(--fs-tiny); color:var(--accent-success);"><b>✓ Model tutarlı</b> — herhangi bir uyarı yok.</div>';
    return;
  }
  var errN=warnings.filter(function(w){return w.level==='err';}).length;
  var h='<div style="font-size:var(--fs-tiny); font-weight:700; color:var(--text-heading); margin-bottom:6px;">Tutarlılık Uyarıları <span style="color:var(--text-muted); font-weight:400;">('+warnings.length+')</span></div>';
  h+='<div style="display:flex; flex-direction:column; gap:5px;">';
  warnings.forEach(function(w){
    var isErr=w.level==='err';
    var col=isErr?'var(--accent-danger)':'var(--accent-warning)';
    var bg=isErr?'rgba(239,68,68,0.10)':'color-mix(in srgb, var(--accent-warning) 10%, transparent)';
    h+='<div style="padding:6px 9px; background:'+bg+'; border-left:3px solid '+col+'; border-radius:3px; font-size:var(--fs-tiny); line-height:1.4; color:var(--text-secondary);"><b style="color:'+col+';">'+(isErr?'HATA':'UYARI')+':</b> '+w.msg+'</div>';
  });
  h+='</div>';
  el.innerHTML=h;
  if(!silent && typeof showToast==='function') showToast('Örnek yüklendi — '+warnings.length+' uyarı ('+errN+' hata).', errN?'warning':'info');
}

// Ayrıştırılmış JSON'u veLoadTabState'in beklediği "state" biçimine getir.
// Kabul edilenler: {format,version,nodes,connections,…} · {state:{…}} · ham state
// · TAM PROJE KAYDI {tabs:[{state:{…}}],activeTabIdx}. Sonuncusu şart: kullanıcı
// örneği çoğu zaman "Kaydet" ile ürettiği proje dosyasından getirir; o biçim
// reddedilirse örnek sessizce "yüklenemedi" olur.
function _mntTopoState(j){
  if(!j) return null;
  var s = (j.state && j.state.nodes) ? j.state : (j.nodes ? j : null);
  if(!s && Array.isArray(j.tabs) && j.tabs.length){
    // Önce aktif sekme, sonra sırayla ilk DOLU sekme (boş sekme örnek değildir).
    var order = [], ai = j.activeTabIdx;
    if(typeof ai === 'number' && j.tabs[ai]) order.push(ai);
    j.tabs.forEach(function(_, i){ if(i !== ai) order.push(i); });
    for(var k = 0; k < order.length && !s; k++){
      var ts = j.tabs[order[k]] && j.tabs[order[k]].state;
      if(ts && ts.nodes && ts.nodes.length) s = ts;
    }
  }
  if(!s || !s.nodes) return null;
  return {
    nodes: s.nodes, connections: s.connections || [],
    compCounter: s.compCounter || 0,
    canvasOffset: s.canvasOffset || { x:3000, y:3000 },
    canvasZoom: s.canvasZoom || 1
  };
}

// Örnek topolojisini çöz: önce build'e gömülü (window.__MNT_TOPOLOGIES), yoksa
// fetch (geliştirme/Pages). Nesne verilirse doğrudan kullanır. cb(state|null).
function _mntResolveTopology(ref, cb){
  if(ref && typeof ref==='object'){ cb(_mntTopoState(ref)); return; }
  var url = String(ref||''); if(!url){ cb(null); return; }
  var emb = (typeof window!=='undefined' && window.__MNT_TOPOLOGIES) ? window.__MNT_TOPOLOGIES[url] : null;
  if(emb){ cb(_mntTopoState(emb)); return; }
  if(typeof fetch==='function'){
    fetch(url).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(j){ cb(_mntTopoState(j)); })
      .catch(function(){ cb(null); });
  } else { cb(null); }
}

// İç topolojiyi (kanvasın o anki hali) JSON olarak dışa aktar — kullanıcı bununla
// örnek topolojisi üretir. undo/redo/simResults gibi uçucu alanlar hariç tutulur.
function veMntExportTopology(){
  if(typeof veSerializeCurrentState!=='function'){ if(typeof showToast==='function') showToast('Dışa aktarma kullanılamıyor.','warning'); return; }
  if(typeof veFlushOpenPanelData==='function') veFlushOpenPanelData();
  var st = veSerializeCurrentState();
  var out = { format:'mfsim-mount-example', version:1,
    nodes: st.nodes, connections: st.connections,
    compCounter: st.compCounter, canvasOffset: st.canvasOffset, canvasZoom: st.canvasZoom };
  var json = JSON.stringify(out, null, 2);
  if(typeof document==='undefined') return json;
  var blob = new Blob([json], { type:'application/json' });
  if(typeof veShowSaveDialog==='function') veShowSaveDialog('ornek-topoloji.json', blob, 'İç topoloji JSON olarak kaydedildi ('+(st.nodes||[]).length+' düğüm)');
  return json;
}

// Örneği kayıtlı JSON topolojisinden yükle — iç topolojiyi tümüyle değiştirir.
function _mntLoadExampleFromJSON(ref, ex){
  var hasBodies = (typeof nodes!=='undefined') && nodes.some(function(n){ var d=_mntDef(n)||{}; return d.isMountBody||d.isMount; });
  if(hasBodies && typeof confirm==='function'){
    if(!confirm('İç topoloji, seçilen örnekle DEĞİŞTİRİLECEK. Devam edilsin mi?')) return;
  }
  _mntResolveTopology(ref, function(state){
    if(!state || !state.nodes || !state.nodes.length){
      if(typeof showToast==='function') showToast('Örnek topolojisi yüklenemedi.','warning');
      return;
    }
    if(typeof veLoadTabState==='function') veLoadTabState({ state: state });
    // Başka örnek yüklenebilsin diye "Başlangıç ve Örnekler" düğümü yoksa ekle.
    if(typeof nodes!=='undefined' && !nodes.some(function(n){ return (_mntDef(n)||{}).isMountExample; }) && typeof veMntPopulateStarter==='function'){
      veMntPopulateStarter();
    }
    if(typeof saveState==='function') saveState();
    if(typeof updateAllConnections==='function') updateAllConnections();
    if(typeof veMntUpdateBreadcrumb==='function') veMntUpdateBreadcrumb();
    if(typeof showToast==='function') showToast('Örnek yüklendi'+(ex&&ex.vehicle?(' — '+ex.vehicle):'')+' (JSON).','info');
  });
}

// "Örneği Aktar" yönlendiricisi: kayıt girişinde JSON topolojisi (topology) varsa
// ondan yükle; yoksa mevcut programatik model kurucusuna düş.
function veMntLoadExample(nodeId){
  if(typeof veMountCore==='undefined') return;
  var node = (typeof nodes!=='undefined') ? nodes.find(function(n){ return n.id===nodeId; }) : null;
  var key = (node && node.data && node.data.exampleKey)
    || ((veMountCore.getMountExampleList && veMountCore.getMountExampleList()[0]||{}).id) || 'siper';
  var ex = (veMountCore.getMountExample) ? veMountCore.getMountExample(key) : null;
  if(ex && ex.topology){ _mntLoadExampleFromJSON(ex.topology, ex); return; }
  _mntLoadExampleFromModel(nodeId);
}

// ── Otomatik destek bağlantıları (GÖRSEL) ───────────────────────────────────
// "Neyi neyin desteklediğini" gösteren port bağlantılarını + port kenarlarını
// hesaplar. SAF fonksiyon (DOM/nodes/connections'a dokunmaz) → birim test edilir.
// items: [{id, kind, lx, ly}] (lx/ly = kanvas yerleşim konumu). Döner:
//   { links:[{from,to,fromPort,toPort}], ports:{ id:{ portType:{side} } } }
// Kural: her takoz → en yakın gövde/cradle; her cradle → en yakın (cradle olmayan)
// gövde. Çıkış portu hedefe, giriş portu gelen kaynakların ağırlık merkezine
// bakacak şekilde (üst/sağ/alt/sol) yönlendirilir. Çözücüyü ETKİLEMEZ (çözücü
// düğümleri tipe göre toplar; bağlantı zorunlu değildir).
function _mntComputeSupportLinks(items){
  items = items || [];
  var BODY = { 'mnt-motor':1, 'mnt-gearbox':1, 'mnt-shaft':1, 'mnt-transfer':1 };
  // PTO grubu bileşenleri TAŞINAN kütlelerdir: güç grubuna civatalanır, takoza
  // doğrudan oturmaz. Bu yüzden (a) cradle gibi kendi çıkışlarıyla en yakın ana
  // gövdeye bağlanırlar, (b) supportTargets'a GİRMEZLER — bir takoz asla PTO'ya
  // asılmaz (fiziksel olarak yanlış olurdu).
  // Liste burada YEREL: bu fonksiyon saf kalsın diye global componentDefs'e
  // (isMountCarried) bakmaz — girdisi düğüm değil {id,kind,lx,ly} verisidir.
  var CARRIED = { 'mnt-pto':1, 'mnt-pump':1, 'mnt-pto-group':1 };
  var pureBodies = items.filter(function(it){ return BODY[it.kind]; });
  var cradles    = items.filter(function(it){ return it.kind==='mnt-bracket'; });
  var carried    = items.filter(function(it){ return CARRIED[it.kind]; });
  var mounts     = items.filter(function(it){ return it.kind==='mnt-mount'; });
  var supportTargets = pureBodies.concat(cradles);
  var byId={}; items.forEach(function(it){ byId[it.id]=it; });

  function nearest(a, pool){
    var best=null, bd=Infinity;
    pool.forEach(function(b){
      if(b.id===a.id) return;
      var dx=b.lx-a.lx, dy=b.ly-a.ly, d=dx*dx+dy*dy;
      if(d<bd){ bd=d; best=b; }
    });
    return best;
  }
  function sideToward(a, b){
    var dx=b.lx-a.lx, dy=b.ly-a.ly;
    if(Math.abs(dx) >= Math.abs(dy)) return dx>=0 ? 'right' : 'left';
    return dy>=0 ? 'bottom' : 'top';
  }

  // 1. Ham linkler: her takoz → en yakın gövde/cradle; her cradle → en yakın gövde.
  var byTarget={};
  function addRaw(src, tgt){ if(src&&tgt) (byTarget[tgt.id]=byTarget[tgt.id]||[]).push(src); }
  mounts.forEach(function(m){ addRaw(m, nearest(m, supportTargets)); });
  cradles.forEach(function(c){ addRaw(c, nearest(c, pureBodies)); });
  carried.forEach(function(p){ addRaw(p, nearest(p, pureBodies)); });   // PTO/Pompa → taşıyıcı gövde

  // 2. Her hedefte gelenleri AYRI giriş portlarına dağıt; hem kaynağın çıkışını hem
  //    hedefin o portunu KARŞILIKLI birbirine baktır (per-instance portPositions).
  //    Böylece ters yönelimli iki cradle bile doğru çıkar (biri üstten, biri alttan).
  var links=[], ports={};
  function setSide(id, portType, side){ (ports[id]=ports[id]||{})[portType]={ side:side }; }
  var SIDE_ORD = { top:0, right:1, bottom:2, left:3 };
  Object.keys(byTarget).forEach(function(tid){
    var tgt=byId[tid];
    var incs=byTarget[tid].slice();
    var inCount=(tgt.inCount!=null)?tgt.inCount:incs.length;
    // Her geleni gideceği kenara göre etiketle, sonra ÇAPRAZ olmayacak sırada diz:
    // önce kenar (grupla), sonra kenarın perp ekseni boyunca konum (sol/sağ → üstten
    // alta ly; üst/alt → soldan sağa lx). Port index'i bu sırayla artınca, üstteki
    // gelen üstteki porta düşer → çizgiler kesişmez.
    incs.forEach(function(s){ s._side = sideToward(tgt, s); });
    incs.sort(function(a,b){
      if(a._side !== b._side) return (SIDE_ORD[a._side]||0) - (SIDE_ORD[b._side]||0);
      return (a._side==='left'||a._side==='right') ? (a.ly-b.ly) : (a.lx-b.lx);
    });
    incs.forEach(function(src, i){
      var pi=Math.min(i, Math.max(0,inCount-1));         // fazla gelen → son portu paylaşır
      var toPort=(inCount<=1) ? 'input' : ('input-'+pi);
      links.push({ from:src.id, to:tgt.id, fromPort:'output', toPort:toPort });
      setSide(src.id, 'output', sideToward(src, tgt));   // kaynak çıkışı hedefe baksın
      setSide(tgt.id, toPort, src._side);                 // hedef portu kaynağa baksın
    });
  });
  return { links:links, ports:ports };
}

// Örnek yükleyicilerin ortak "bağla + port kenarlarını uygula" adımı. placed =
// oluşturulan gövde/takoz düğümlerinin [{id,kind,lx,ly}] listesi. createConnection
// id'yi Date.now()'la üretir → senkron döngüde çakışabilir, compCounter ile
// benzersizleştir (topology.js:392 / cp-arac-performans.js:106 deseni).
function _mntWireSupportLinks(placed){
  if(typeof createConnection!=='function') return;
  var wiring = _mntComputeSupportLinks(placed);
  Object.keys(wiring.ports).forEach(function(id){
    var n = (typeof nodes!=='undefined') ? nodes.find(function(x){ return x.id===id; }) : null;
    if(!n) return;
    n.data = n.data || {};
    n.data.portPositions = Object.assign(n.data.portPositions || {}, wiring.ports[id]);
  });
  wiring.links.forEach(function(lk){
    var before = connections.length;
    createConnection(lk.from, lk.to, lk.fromPort, lk.toPort);
    if(connections.length>before && typeof compCounter!=='undefined'){
      compCounter++;
      connections[connections.length-1].id = 'conn-' + compCounter;
    }
  });
}

// ── ŞASİ METAFORU (kütle-yay-zemin) ─────────────────────────────────────────
// Takoz topolojisini "titreşim diyagramı" gibi çizer: güç grubu bir ŞASİ ÇERÇEVESİ
// içinde; gövdeler aktarma-hattı omurgasıyla; her takoz karşıya uzanan çizgi yerine
// en yakın çerçeve kenarına KISA BİR YAY + dış tarafta zemin sembolü. updateAllConn.
// sonunda çağrılır (connections.js hook), <g class="ve-mnt-chassis"> ekler; her
// çağrıda yeniden çizilir. Takoz+gövde yoksa no-op → başka modüller etkilenmez.
// NOT: mount düğümleri arası port-port eğrileri updateAllConnections'ta atlanır
// (bu metafor onların yerini alır).
function veMntDecorateConnections(svg){
  if(!svg || typeof document==='undefined' || typeof nodes==='undefined') return;
  var old = svg.querySelector('g.ve-mnt-chassis');
  if(old && old.parentNode) old.parentNode.removeChild(old);
  var mountsN = nodes.filter(function(n){ return (_mntDef(n)||{}).isMount; });
  var bodiesN = nodes.filter(function(n){ return (_mntDef(n)||{}).isMountBody; });
  if(!mountsN.length && !bodiesN.length) return;
  var NS='http://www.w3.org/2000/svg';
  var g = document.createElementNS(NS,'g');
  g.setAttribute('class','ve-mnt-chassis');
  g.style.pointerEvents='none';

  // ── Şasi çerçevesi: gövdelerin (cradle dahil) sınır kutusu + pay ──
  var fr=null;
  if(bodiesN.length){
    var pad=26, x1=1e9,y1=1e9,x2=-1e9,y2=-1e9;
    bodiesN.forEach(function(n){ var w=n.width||50,h=n.height||46;
      x1=Math.min(x1,n.x); y1=Math.min(y1,n.y); x2=Math.max(x2,n.x+w); y2=Math.max(y2,n.y+h); });
    fr={x1:x1-pad, y1:y1-pad, x2:x2+pad, y2:y2+pad};
    var rect=document.createElementNS(NS,'rect');
    rect.setAttribute('x',fr.x1); rect.setAttribute('y',fr.y1);
    rect.setAttribute('width',fr.x2-fr.x1); rect.setAttribute('height',fr.y2-fr.y1);
    rect.setAttribute('rx',16); rect.setAttribute('fill','var(--accent-primary, #3b82f6)');
    rect.setAttribute('fill-opacity','0.045'); rect.setAttribute('stroke','var(--accent-primary, #3b82f6)');
    rect.setAttribute('stroke-width','1.6'); rect.setAttribute('stroke-dasharray','2 6'); rect.setAttribute('opacity','0.7');
    g.appendChild(rect);
    var t=document.createElementNS(NS,'text');
    t.setAttribute('x',fr.x1+11); t.setAttribute('y',fr.y1+16);
    t.setAttribute('fill','var(--accent-primary, #3b82f6)'); t.setAttribute('font-size','10.5');
    t.setAttribute('opacity','0.72'); t.setAttribute('letter-spacing','1.5');
    t.setAttribute('font-family','ui-monospace, monospace'); t.textContent='ŞASİ'; g.appendChild(t);
  }

  // ── Aktarma hattı omurgası: ana gövdeler, x sırasına göre merkezden ──
  // Braket/cradle ve "taşınan" gövdeler (PTO/Pompa/PTO Toplam — isMountCarried)
  // omurgaya GİRMEZ: hiçbiri aktarma hattının kendisi değil, ona asılan yardımcı
  // kütlelerdir.
  var spineB = bodiesN.filter(function(n){
      return n.type!=='mnt-bracket' && !(_mntDef(n)||{}).isMountCarried; })
    .sort(function(a,b){ return a.x - b.x; });
  for(var i=0;i<spineB.length-1;i++){
    var a=spineB[i], b=spineB[i+1];
    var l=document.createElementNS(NS,'line');
    l.setAttribute('x1',a.x+(a.width||50)/2); l.setAttribute('y1',a.y+(a.height||46)/2);
    l.setAttribute('x2',b.x+(b.width||50)/2); l.setAttribute('y2',b.y+(b.height||46)/2);
    l.setAttribute('stroke','var(--text-secondary, #888)'); l.setAttribute('stroke-width','3');
    l.setAttribute('stroke-linecap','round'); l.setAttribute('opacity','0.7'); g.appendChild(l);
  }

  // ── Takozlar: en yakın çerçeve kenarına kısa yay + dış tarafta zemin ──
  var opp={ left:'right', right:'left', top:'bottom', bottom:'top' };
  mountsN.forEach(function(n){
    var w=n.width||50,h=n.height||46, cx=n.x+w/2, cy=n.y+h/2;
    if(fr){
      // en yakın çerçeve kenarı + o kenar üzerine izdüşüm (köşeye taşmayı kırp)
      var dl=Math.abs(cx-fr.x1),dr=Math.abs(cx-fr.x2),dt=Math.abs(cy-fr.y1),db=Math.abs(cy-fr.y2);
      var mn=Math.min(dl,dr,dt,db), fp;
      if(mn===dt) fp={x:Math.max(fr.x1,Math.min(fr.x2,cx)), y:fr.y1};
      else if(mn===db) fp={x:Math.max(fr.x1,Math.min(fr.x2,cx)), y:fr.y2};
      else if(mn===dl) fp={x:fr.x1, y:Math.max(fr.y1,Math.min(fr.y2,cy))};
      else fp={x:fr.x2, y:Math.max(fr.y1,Math.min(fr.y2,cy))};
      var mp=_mntEdge(n, fp.x, fp.y);
      _mntSpring(g, mp, fp);
      // zemin: yayın TERS yönünde (dışta). İç yön = fp'ye bakan baskın eksen.
      var idx=fp.x-cx, idy=fp.y-cy;
      var inSide=(Math.abs(idx)>=Math.abs(idy)) ? (idx>0?'right':'left') : (idy>0?'bottom':'top');
      _mntChassisGlyph(g, n, opp[inSide]);
    } else {
      _mntChassisGlyph(g, n, 'left');
    }
  });
  svg.appendChild(g);
}

// Düğüm sınır kutusunun (tx,ty)'ye bakan kenar noktası.
function _mntEdge(n, tx, ty){
  var w=n.width||50,h=n.height||46, cx=n.x+w/2, cy=n.y+h/2, dx=tx-cx, dy=ty-cy;
  if(dx===0&&dy===0) return {x:cx,y:cy};
  var s=Math.min((w/2)/Math.abs(dx||1e-9), (h/2)/Math.abs(dy||1e-9));
  return {x:cx+dx*s, y:cy+dy*s};
}

// İki nokta arası KISA YAY (zig-zag) — takoz kenarından şasi çerçevesine.
function _mntSpring(g, a, b){
  var NS='http://www.w3.org/2000/svg';
  var vx=b.x-a.x, vy=b.y-a.y, L=Math.hypot(vx,vy)||1e-6, ux=vx/L, uy=vy/L, px=-uy, py=ux;
  var coils=Math.max(3, Math.min(6, Math.round(L/8))), amp=Math.min(4.5, L*0.16), seg=L/(coils+1);
  var d='M'+a.x+' '+a.y;
  for(var i=1;i<=coils;i++){ var tt=seg*i, sgn=(i%2?1:-1)*amp; d+=' L '+(a.x+ux*tt+px*sgn)+' '+(a.y+uy*tt+py*sgn); }
  d+=' L '+b.x+' '+b.y;
  var p=document.createElementNS(NS,'path');
  p.setAttribute('d',d); p.setAttribute('fill','none');
  p.setAttribute('stroke','var(--accent-success, #22c55e)'); p.setAttribute('stroke-width','2');
  p.setAttribute('stroke-linecap','round'); p.setAttribute('stroke-linejoin','round'); p.setAttribute('opacity','0.95');
  g.appendChild(p);
}

// Tek takoz için dış kenara sabit-mesnet sembolü çiz: takozdan raya kısa bağ +
// ray + dışa dönük tarama çizgileri. side = şasinin bulunduğu kenar.
function _mntChassisGlyph(g, n, side){
  var NS='http://www.w3.org/2000/svg';
  var w=n.width||50, h=n.height||46, gap=9, rail=Math.min(w,h)*0.62, tick=7, N=5;
  var cx=n.x+w/2, cy=n.y+h/2;
  var col='var(--accent-primary, #3b82f6)';
  function ln(x1,y1,x2,y2,wd,op){
    var l=document.createElementNS(NS,'line');
    l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2);
    l.setAttribute('stroke',col); l.setAttribute('stroke-width',wd); l.setAttribute('stroke-linecap','round');
    if(op!=null) l.setAttribute('opacity',op);
    g.appendChild(l);
  }
  var vertical = (side==='left'||side==='right');
  if(vertical){
    var ax = side==='left' ? n.x-gap : n.x+w+gap;
    var edgeX = side==='left' ? n.x : n.x+w;
    var dir = side==='left' ? -1 : 1;
    ln(edgeX, cy, ax, cy, 2.2, 0.9);                 // takoz → ray
    ln(ax, cy-rail/2, ax, cy+rail/2, 2.4, 1);        // ray
    for(var i=0;i<N;i++){ var yy=cy-rail/2 + i*(rail/(N-1));
      ln(ax, yy, ax+tick*dir, yy-tick, 1.4, 0.7); }  // tarama
  } else {
    var ay = side==='top' ? n.y-gap : n.y+h+gap;
    var edgeY = side==='top' ? n.y : n.y+h;
    var dirY = side==='top' ? -1 : 1;
    ln(cx, edgeY, cx, ay, 2.2, 0.9);
    ln(cx-rail/2, ay, cx+rail/2, ay, 2.4, 1);
    for(var j=0;j<N;j++){ var xx=cx-rail/2 + j*(rail/(N-1));
      ln(xx, ay, xx-tick, ay+tick*dirY, 1.4, 0.7); }
  }
}

// Programatik model kurucusu (kayıt girişinde JSON yoksa): model'den kütle/takoz
// düğümlerini oluşturur.
function _mntLoadExampleFromModel(nodeId){
  if(typeof veMountCore==='undefined' || typeof createNode!=='function') return;
  var node = nodes.find(function(n){ return n.id===nodeId; });
  var key = (node && node.data && node.data.exampleKey) || 'siper';
  // Seçilen örneğin modelini kayıt defterinden çöz (bilinmezse ilk örneğe düşer).
  var ex = (veMountCore.getMountExample) ? veMountCore.getMountExample(key) : null;
  var EX = (ex && ex.model) || veMountCore.TTAR_EXAMPLE; if(!EX) return;

  // Mevcut kütle/takoz bileşenlerini bul (Çözücü/Örnek/Görüntüleyici korunur).
  var toRemove = nodes.filter(function(n){ var d=_mntDef(n)||{}; return d.isMountBody || d.isMount; });
  if(toRemove.length){
    var ok = (typeof confirm==='undefined') ? true : confirm('Topolojide '+toRemove.length+' kütle/takoz bileşeni var. Örnek yüklenirken bunlar silinecek. Devam edilsin mi?');
    if(!ok) return;
    toRemove.forEach(function(n){ _mntRemoveNode(n.id); });
  }

  // Örnek düğümlerini STARTER ile aynı tabana göre yerleştir ki yardımcı araçlarla
  // (Koordinat Düzlemi / 3D / 2D / Örnek / Çözücü — sağ ve üst kenarda) çakışmasın.
  // Yerleşim panel önizlemesiyle AYNI (_mntExampleLayout) → görsel ile kurulan
  // topoloji birebir örtüşür; bileşen/takoz kendi at:[lx,ly]'sini taşıyabilir.
  var LAY=_mntExampleLayout(EX);
  var layout=LAY.bodies.concat(LAY.mnts);
  var base = (typeof veArrangeModuleBase==='function')
    ? veArrangeModuleBase(VE_MNT_STARTER_LAYOUT.map(function(it){ return {lx:it.lx, ly:it.ly}; }))
    : { x:3000, y:3000 };

  var tq=EX.torque||{};
  var li=0;
  var placed=[];  // otomatik destek bağlantıları için: {id,kind,lx,ly}
  EX.components.forEach(function(c){
    var pos=layout[li++]; var before=nodes.length;
    var kind=c.kind || _mntExampleBodyType(c.name);
    createNode(kind, base.x+pos.lx, base.y+pos.ly);
    if(nodes.length>before){
      var n=nodes[nodes.length-1];
      n.data=Object.assign(n.data||{}, { mass:c.mass, cgx:c.cg[0], cgy:c.cg[1], cgz:c.cg[2], Ixx:c.Ixx, Iyy:c.Iyy, Izz:c.Izz, Ixy:c.Ixy, Ixz:c.Ixz, Iyz:c.Iyz, pointMass:!!c.pointMass });
      // Tork zinciri: Motor→Te; Şanzıman→vites/stall + transfer/aks payı
      // (örnekte ayrı Transfer gövdesi yok → değerler Şanzıman'da tutulur).
      if(kind==='mnt-motor'){ n.data.Te=tq.Te; }
      else if(kind==='mnt-gearbox' && tq.fwd){
        n.data.g1=tq.fwd.iGear; n.data.gR=(tq.rev||{}).iGear; n.data.Rstall=tq.Rstall;
        n.data.iTransfer=tq.iTransfer; n.data.phiFwd=tq.fwd.phiAxle; n.data.phiRev=(tq.rev||{}).phiAxle; n.data.derate=tq.derate;
      }
      _mntSetNodeName(n, c.name);
      placed.push({ id:n.id, kind:kind, lx:pos.lx, ly:pos.ly,
        inCount:(typeof nodePortCount==='function') ? nodePortCount(n,'inputs') : 1 });
    }
  });
  EX.mounts.forEach(function(m){
    var pos=layout[li++]; var before=nodes.length;
    createNode('mnt-mount', base.x+pos.lx, base.y+pos.ly);
    if(nodes.length>before){
      var n=nodes[nodes.length-1];
      n.data=Object.assign(n.data||{}, { x:m.pos[0], y:m.pos[1], z:m.pos[2], kxs:m.kstat[0], kys:m.kstat[1], kzs:m.kstat[2], kxd:m.kdyn[0], kyd:m.kdyn[1], kzd:m.kdyn[2] });
      _mntSetNodeName(n, m.name);
      placed.push({ id:n.id, kind:'mnt-mount', lx:pos.lx, ly:pos.ly });
    }
  });
  // Takoz/cradle destek bağlantılarını (görsel) otomatik kur.
  _mntWireSupportLinks(placed);

  // Çözücü yoksa ekle (starter'daki sağ-üst konuma).
  if(!nodes.some(function(n){ return (_mntDef(n)||{}).isMountSolver; })){
    createNode('mnt-solver', base.x + 640, base.y + 20);
  }
  if(typeof saveState==='function') saveState();
  if(typeof updateAllConnections==='function') updateAllConnections();

  // createNode +20ms otomatik seçimi paneli son eklenen düğüme çevirir → Örnek
  // düğümünü yeniden seçip raporu bas ki kullanıcı uyarıları (fazla takoz vs)
  // görsün. setTimeout/DOM yoksa (Jest) doğrudan bas.
  var exNode = (typeof nodes!=='undefined') ? nodes.find(function(n){ return n.id===nodeId; }) : null;
  if(typeof setTimeout==='function' && typeof document!=='undefined'){
    setTimeout(function(){
      if(exNode && typeof clearSelection==='function' && typeof addToSelection==='function'){
        clearSelection(); addToSelection(exNode);
        if(typeof showNodeProperties==='function') showNodeProperties(exNode);
      }
      _mntRenderExampleReport(_mntExampleValidate(), false);
    }, 90);
  } else {
    _mntRenderExampleReport(_mntExampleValidate(), false);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  3D GÖRÜNTÜLEYİCİ — iç topolojinin 3B yerleşimi (tema uyumlu)
// ════════════════════════════════════════════════════════════════════════════
// Görüntüleyici araç çubuğu düğmesi (aç/kapa görünümlü).
function _mntVwrBtn(onclick, label, title, active){
  return '<button onclick="'+onclick+'" title="'+_mntEsc(title||label)+'" style="padding:4px 9px; font-size:var(--fs-tiny); background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); cursor:pointer; opacity:'+(active===false?'0.45':'1')+';">'+label+'</button>';
}
// Renk lejantı (slim, tek satır).
function _mntVwrLegend(){
  function chip(col,txt){ return '<span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:9px; height:9px; border-radius:50%; background:'+col+'; display:inline-block;"></span>'+txt+'</span>'; }
  return '<div style="display:flex; flex-wrap:wrap; gap:12px; font-size:var(--fs-micro); color:var(--text-muted); margin-bottom:7px;">'
    + chip('var(--accent-success)','Takoz') + chip('var(--accent-warning)','Bileşen CG') + chip('var(--accent-danger)','Birleşik CG') + '</div>';
}
function getMntViewerPropertiesHTML(node){
  if(!node.data) node.data={};
  // SOL rayı (ince): lejant + görünüm düğmeleri + ipucu + yenile.
  var left='';
  left+=_mntVwrLegend();
  // Görünüm katmanları + sıfırla + tam ekran (Zemin varsayılan gizli)
  left+='<div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-bottom:9px;">';
  left+=_mntVwrBtn("var v=veMountViewerToggle('grid'); this.style.opacity=v?'1':'0.45';",'Zemin','Zemin ızgarasını gizle/göster', false);
  left+=_mntVwrBtn("var v=veMountViewerToggle('axes'); this.style.opacity=v?'1':'0.45';",'Eksen','Eksenleri gizle/göster');
  left+=_mntVwrBtn("var v=veMountViewerToggle('labels'); this.style.opacity=v?'1':'0.45';",'Etiket','Eksen etiketlerini gizle/göster');
  left+=_mntVwrBtn("veMountViewerReset();",'⟳ Sıfırla','Görünümü sıfırla');
  left+=_mntVwrBtn("veMntViewerFullscreen();",'<span class="mf-ico mf-ico-maximize"></span> Tam Ekran','Görüntüleyiciyi tam ekran aç');
  left+='</div>';
  left+='<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.5; margin-bottom:9px;">Sol tık döndür · sağ tık kaydır · tekerlek yakınlaş · fare ile bileşenin üzerine gel → bilgi.</div>';
  left+='<button onclick="veMntViewerRefresh()" style="width:100%; padding:8px; font-size:var(--fs-body); background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); cursor:pointer;">↻ Yenile</button>';
  // SAĞ (geniş): 3B görüntüleyici kanvası — büyük. Canvas boyutu wrap'ın client
  // boyutuna göre kurulur (veMountViewerInit + ResizeObserver) → geniş sütunda oturur.
  var right='<div id="ve-mnt-inline-viewer-wrap" style="width:100%; height:min(58vh,540px); min-height:320px; overflow:hidden; border:1px solid var(--border-color); background:var(--bg-primary); position:relative; border-radius:var(--radius-md);"><canvas id="ve-mnt-inline-viewer-canvas" style="width:100%; height:100%; display:block;"></canvas></div>';
  var html='<div class="sw-panel">';
  html+='<div class="ve-cp-grid ve-cp-grid--wideright">';
  html+='<div class="ve-cp-col ve-cp-col--in">'+left+'</div>';
  html+='<div class="ve-cp-col ve-cp-col--out">'+right+'</div>';
  html+='</div>';
  html+='</div>';
  return html;
}

// ════════════════════════════════════════════════════════════════════════════
//  KOORDİNAT DÜZLEMİ — koordinat sistemini 3B göster (eksen + düzlem + yön)
// ════════════════════════════════════════════════════════════════════════════
function getMntCoordFramePropertiesHTML(node){
  if(!node.data) node.data={};
  // Eksen yönü açıklaması (konum/CG değerlerinin hangi eksene göre girildiği)
  function axRow(col,ax,desc){ return '<div style="display:flex; align-items:center; gap:8px; padding:4px 0; font-size:var(--fs-tiny);"><span style="width:11px; height:11px; border-radius:var(--radius-sm); background:'+col+'; flex-shrink:0;"></span><b style="color:var(--text-primary); width:14px;">'+ax+'</b><span style="color:var(--text-secondary);">'+desc+'</span></div>'; }
  // SOL rayı (ince): eksen açıklaması + görünüm düğmeleri + etkileşim ipucu.
  var left='';
  left+='<div style="font-size:var(--fs-micro); font-weight:700; color:var(--text-secondary); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:6px;">Koordinat Sistemi</div>';
  left+='<div style="margin-bottom:10px;">';
  left+=axRow('#ef4444','X','İleri–geri ekseni · +X araç arkası, −X ön');
  left+=axRow('#22c55e','Y','Yanal eksen · +Y sağ, −Y sol');
  left+=axRow('#3b82f6','Z','Düşey eksen · +Z yukarı, −Z aşağı');
  left+='</div>';
  left+='<div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-bottom:9px;">';
  left+=_mntVwrBtn("var v=veMountViewerToggle('planes'); this.style.opacity=v?'1':'0.45';",'Düzlem','Koordinat düzlemlerini gizle/göster');
  left+=_mntVwrBtn("var v=veMountViewerToggle('grid'); this.style.opacity=v?'1':'0.45';",'Zemin','Zemin ızgarasını gizle/göster', false);
  left+=_mntVwrBtn("veMountViewerReset();",'⟳ Sıfırla','Görünümü sıfırla');
  left+='</div>';
  left+='<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.5;">Sol tık döndür · tekerlek yakınlaş. Konum ve CG değerleri bu eksenlere göre girilir.</div>';
  // SAĞ (geniş): 3B koordinat kanvası — büyük. Canvas boyutu wrap'ın client boyutuna
  // göre kurulur (veMountViewerInit + ResizeObserver) → geniş sütunda ferahça oturur.
  var right='<div id="ve-mnt-coord-wrap" style="width:100%; height:min(58vh,540px); min-height:320px; overflow:hidden; border:1px solid var(--border-color); background:var(--bg-primary); position:relative; border-radius:var(--radius-md);"><canvas id="ve-mnt-coord-canvas" style="width:100%; height:100%; display:block;"></canvas></div>';
  var html='<div class="sw-panel">';
  html+='<div class="ve-cp-grid ve-cp-grid--wideright">';
  html+='<div class="ve-cp-col ve-cp-col--in">'+left+'</div>';
  html+='<div class="ve-cp-col ve-cp-col--out">'+right+'</div>';
  html+='</div>';
  html+='</div>';
  return html;
}
function veMntCoordFrameRefresh(){
  if(typeof veMountViewerInit==='function'){
    try{ veMountViewerInit('ve-mnt-coord-canvas','coordframe'); veMountViewerUpdate(); }catch(e){}
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  2D GÖRÜNÜM — üstten (X–Y) + yandan (X–Z) ölçekli diyagram (akademik)
// ════════════════════════════════════════════════════════════════════════════
// Takozlar (yeşil kare), bileşen ağırlık merkezleri (turuncu daire, kütleye göre
// boyut) ve birleşik ağırlık merkezi (kırmızı G işareti) ölçekli çizilir. X ekseni
// yatay (ortak); üstten görünüşte +Y yukarı (sağ üstte), yandan görünüşte +Z yukarı.
function getMnt2DViewPropertiesHTML(node){
  if(!node.data) node.data={};
  var html='<div class="sw-panel">';
  html+='<div style="display:flex; gap:6px; margin-bottom:7px;">';
  html+='<button onclick="veMnt2DViewRefresh()" style="flex:1; padding:7px; font-size:var(--fs-body); background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); cursor:pointer;">↻ Yenile</button>';
  html+='</div>';
  html+='<div id="ve-mnt-2dview-box" style="width:100%; background:var(--bg-primary); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:8px; overflow:auto;"></div>';
  html+='</div>';
  return html;
}
function veMnt2DViewRefresh(){
  var box=(typeof document!=='undefined')?document.getElementById('ve-mnt-2dview-box'):null;
  if(!box) return;
  box.innerHTML=_mnt2DViewSVG(_mnt2DGather());
  _mnt2DAttachHover(box);
  _mnt2DAttachZoom(box);
}
// Topolojiden 2D diyagram verisi topla (SI değil — mm; birleşik CG kütle-ağırlıklı).
function _mnt2DGather(){
  var g=_mntGatherForSolver();
  var num=function(v){ var n=Number(String(v).replace(',','.')); return Number.isFinite(n)?n:NaN; };
  var comps=g.components.map(function(c){ return {name:c.name, mass:num(c.mass), x:num(c.cgx), y:num(c.cgy), z:num(c.cgz)}; })
    .filter(function(c){ return Number.isFinite(c.x)&&Number.isFinite(c.y)&&Number.isFinite(c.z); });
  var mounts=g.mounts.map(function(m){ return {name:m.name, x:num(m.x), y:num(m.y), z:num(m.z)}; })
    .filter(function(m){ return Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z); });
  var mSum=0,sx=0,sy=0,sz=0;
  comps.forEach(function(c){ if(c.mass>0){ mSum+=c.mass; sx+=c.mass*c.x; sy+=c.mass*c.y; sz+=c.mass*c.z; } });
  var cg=mSum>0?{x:sx/mSum,y:sy/mSum,z:sz/mSum,m:mSum}:null;
  return { comps:comps, mounts:mounts, cg:cg };
}
// SVG metin/işaret yardımcıları — akademik, tek renkli (tema uyumlu) görünüm.
var _MNT2D_MONO="ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";
var _MNT2D_SANS="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
// İşaret renkleri — bileşen ikonuyla (components.js) tutarlı, tema uyumlu:
// takoz=yeşil, bileşen CG=amber, birleşik CG=kırmızı. Fallback'li accent-* değişkenleri.
var _MNT2D_C_MOUNT='var(--accent-success, #22c55e)';
var _MNT2D_C_COMP ='var(--accent-warning, #f59e0b)';
var _MNT2D_C_CG   ='var(--accent-danger, #ef4444)';
function _mnt2DText(x,y,t,anchor,color,size,bold,family){
  return '<text x="'+_mnt2DR(x)+'" y="'+_mnt2DR(y)+'" text-anchor="'+(anchor||'middle')+'" font-size="'+(size||8)+'"'
    + ' font-family="'+(family||_MNT2D_MONO)+'" fill="'+(color||'var(--text-secondary)')+'"'+(bold?' font-weight="700"':'')+'>'+_mntEsc(t)+'</text>';
}
function _mnt2DR(v){ return Math.round(v*10)/10; }
// "Güzel" eksen adımı (1·2·5 ×10^k) ve o adıma oturan işaret (tick) değerleri —
// ölçek ızgarası + sayısal eksen etiketleri için (mm). target ≈ istenen işaret sayısı.
function _mnt2DNiceStep(range, target){
  var raw=range/Math.max(1,target);
  if(!(raw>0)) return 1;
  var mag=Math.pow(10, Math.floor(Math.log(raw)/Math.LN10)), norm=raw/mag, step;
  if(norm<1.5) step=1; else if(norm<3) step=2; else if(norm<7) step=5; else step=10;
  return step*mag;
}
function _mnt2DNiceTicks(min, max, target){
  if(!(max>min)) return [min||0];
  var step=_mnt2DNiceStep(max-min, target||6), ticks=[];
  for(var v=Math.ceil(min/step)*step; v<=max+step*1e-6; v+=step) ticks.push(Math.round(v*1e6)/1e6);
  return ticks;
}
// Eksen işaret etiketi — tam sayı mm, eksi işareti tipografik "−".
function _mnt2DTick(v){ return Math.round(v).toString().replace('-','−'); }
function _mnt2DArrow(x1,y1,x2,y2,color,hl){
  hl=hl||7; var ang=Math.atan2(y2-y1,x2-x1);
  var ax=x2-hl*Math.cos(ang-0.42), ay=y2-hl*Math.sin(ang-0.42);
  var bx=x2-hl*Math.cos(ang+0.42), by=y2-hl*Math.sin(ang+0.42);
  return '<line x1="'+_mnt2DR(x1)+'" y1="'+_mnt2DR(y1)+'" x2="'+_mnt2DR(x2)+'" y2="'+_mnt2DR(y2)+'" stroke="'+color+'" stroke-width="1.4"/>'
    + '<polygon points="'+_mnt2DR(x2)+','+_mnt2DR(y2)+' '+_mnt2DR(ax)+','+_mnt2DR(ay)+' '+_mnt2DR(bx)+','+_mnt2DR(by)+'" fill="'+color+'"/>';
}
// Birleşik CG işareti — jeodezik istasyon sembolü (ters iki çeyrek dolu daire).
function _mnt2DCGMark(cx,cy,r,color){
  r=r||10; color=color||'var(--text-primary)'; var s='';
  s+='<circle cx="'+_mnt2DR(cx)+'" cy="'+_mnt2DR(cy)+'" r="'+r+'" fill="var(--bg-primary)" stroke="'+color+'" stroke-width="1.6"/>';
  s+='<path d="M'+_mnt2DR(cx)+' '+_mnt2DR(cy)+' L'+_mnt2DR(cx+r)+' '+_mnt2DR(cy)+' A'+r+' '+r+' 0 0 1 '+_mnt2DR(cx)+' '+_mnt2DR(cy+r)+' Z" fill="'+color+'"/>';
  s+='<path d="M'+_mnt2DR(cx)+' '+_mnt2DR(cy)+' L'+_mnt2DR(cx-r)+' '+_mnt2DR(cy)+' A'+r+' '+r+' 0 0 1 '+_mnt2DR(cx)+' '+_mnt2DR(cy-r)+' Z" fill="'+color+'"/>';
  return s;
}
// Takoz işareti — içi boş kare; yandan görünüşte tarama (hatch) ile doldurulur.
// Yalnızca şekilleri döndürür; hover bilgisi grubu saran <g>'de tutulur.
function _mnt2DMountMark(cx,cy,hatch,color){
  var r=8, s='', col=color||'var(--text-secondary)';
  s+='<rect x="'+_mnt2DR(cx-r)+'" y="'+_mnt2DR(cy-r)+'" width="'+(2*r)+'" height="'+(2*r)+'" rx="1.5" fill="var(--bg-primary)" stroke="'+col+'" stroke-width="1.5"/>';
  if(hatch){
    s+='<line x1="'+_mnt2DR(cx-r)+'" y1="'+_mnt2DR(cy+r)+'" x2="'+_mnt2DR(cx+r)+'" y2="'+_mnt2DR(cy-r)+'" stroke="var(--text-muted)" stroke-width="0.8"/>';
    s+='<line x1="'+_mnt2DR(cx-r)+'" y1="'+_mnt2DR(cy)+'" x2="'+_mnt2DR(cx)+'" y2="'+_mnt2DR(cy-r)+'" stroke="var(--text-muted)" stroke-width="0.8"/>';
    s+='<line x1="'+_mnt2DR(cx)+'" y1="'+_mnt2DR(cy+r)+'" x2="'+_mnt2DR(cx+r)+'" y2="'+_mnt2DR(cy)+'" stroke="var(--text-muted)" stroke-width="0.8"/>';
  }
  return s;
}
// Hover bilgisi attribute'u: satırları kaçışla + &#10; ile birleştir (pre-line render).
function _mnt2DInfoAttr(lines){
  return ' data-mnt-info="'+_mntEsc(lines.join('\n')).replace(/\n/g,'&#10;')+'"';
}
// 2D SVG işaretlerine fare-üstü (hover) bilgi kutusu bağla — 3D görüntüleyicideki
// gibi. Container'a olay dinleyici ekler; tek bir yüzen tooltip div'i paylaşılır.
function _mnt2DAttachHover(container){
  if(!container || typeof document==='undefined' || container.__mnt2dHover) return;
  container.__mnt2dHover=true;
  var tip=document.getElementById('ve-mnt-2d-tip');
  if(!tip){ tip=document.createElement('div'); tip.id='ve-mnt-2d-tip';
    tip.style.cssText='position:fixed; z-index:100060; pointer-events:none; display:none; max-width:280px; padding:7px 10px; font-size:var(--fs-body); line-height:1.5; white-space:pre-line; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:7px; box-shadow:0 8px 24px rgba(0,0,0,0.45);';
    document.body.appendChild(tip);
  }
  function info(t){ while(t && t!==container){ if(t.getAttribute){ var v=t.getAttribute('data-mnt-info'); if(v) return v; } t=t.parentNode; } return null; }
  container.addEventListener('mousemove', function(e){
    var v=info(e.target);
    if(v){ tip.textContent=v; tip.style.display='block';
      var x=e.clientX+14, y=e.clientY+16;
      if(x+tip.offsetWidth>window.innerWidth-8) x=e.clientX-tip.offsetWidth-14;
      if(y+tip.offsetHeight>window.innerHeight-8) y=e.clientY-tip.offsetHeight-16;
      tip.style.left=x+'px'; tip.style.top=y+'px';
    } else { tip.style.display='none'; }
  });
  container.addEventListener('mouseleave', function(){ tip.style.display='none'; });
}
// 2D figürleri interaktif yap: her <svg class="ve-mnt2d-fig"> kendi viewBox'ı
// üzerinden BAĞIMSIZ yakınlaştırılır/kaydırılır. Fare tekerleği imleç merkezli
// zoom; sürükleme pan; çift tık başlangıca sıfırlar. Pointer-capture kullanır →
// window dinleyicisi yok, SVG kaldırılınca dinleyiciler de gider (sızıntı yok).
function _mnt2DAttachZoom(container){
  if(!container || typeof document==='undefined') return;
  var figs=container.querySelectorAll('.ve-mnt2d-fig');
  Array.prototype.forEach.call(figs, function(svg){
    if(svg.__mnt2dZoom) return; svg.__mnt2dZoom=true;
    var b=(svg.getAttribute('data-vb')||'').split(/\s+/).map(Number);
    if(b.length!==4 || b.some(function(n){ return !isFinite(n); })) return;
    var baseX=b[0], baseY=b[1], baseW=b[2], baseH=b[3];
    var vb={ x:baseX, y:baseY, w:baseW, h:baseH };
    var minW=baseW*0.16;   // en fazla ~6× yakınlaştır
    function clamp(){
      if(vb.w>baseW) vb.w=baseW; if(vb.h>baseH) vb.h=baseH;
      if(vb.x<baseX) vb.x=baseX;
      if(vb.y<baseY) vb.y=baseY;
      if(vb.x+vb.w>baseX+baseW) vb.x=baseX+baseW-vb.w;
      if(vb.y+vb.h>baseY+baseH) vb.y=baseY+baseH-vb.h;
    }
    function apply(){ svg.setAttribute('viewBox', _mnt2DR(vb.x)+' '+_mnt2DR(vb.y)+' '+_mnt2DR(vb.w)+' '+_mnt2DR(vb.h)); }
    function reset(){ vb.x=baseX; vb.y=baseY; vb.w=baseW; vb.h=baseH; apply(); }
    // İmleç (veya verilmezse figür merkezi) sabit kalacak şekilde f kadar ölçekle.
    function zoomAt(f, clientX, clientY){
      var rect=svg.getBoundingClientRect();
      if(!rect.width || !rect.height) return;
      var ux=(clientX==null)?vb.x+vb.w/2:vb.x+(clientX-rect.left)/rect.width*vb.w;
      var uy=(clientY==null)?vb.y+vb.h/2:vb.y+(clientY-rect.top)/rect.height*vb.h;
      if(vb.w*f<minW) f=minW/vb.w; else if(vb.w*f>baseW) f=baseW/vb.w;
      vb.x=ux-(ux-vb.x)*f; vb.y=uy-(uy-vb.y)*f; vb.w*=f; vb.h*=f;
      clamp(); apply();
    }
    svg.addEventListener('wheel', function(e){
      e.preventDefault();
      zoomAt((e.deltaY<0)?0.85:1/0.85, e.clientX, e.clientY);
    }, { passive:false });
    // Köşe butonları (varsa) — figür merkezli zoom / sıfırla.
    var wrapEl=svg.parentNode;
    var ctl=wrapEl && wrapEl.querySelector ? wrapEl.querySelector('.ve-mnt2d-zoomctl') : null;
    if(ctl){
      ctl.addEventListener('click', function(e){
        var btn=e.target.closest ? e.target.closest('button[data-z]') : null;
        if(!btn) return; e.preventDefault();
        var z=btn.getAttribute('data-z');
        if(z==='in') zoomAt(0.8, null, null);
        else if(z==='out') zoomAt(1.25, null, null);
        else reset();
      });
    }
    var drag=false, lx=0, ly=0;
    svg.addEventListener('pointerdown', function(e){
      if(e.button!==0 && e.pointerType==='mouse') return;
      drag=true; lx=e.clientX; ly=e.clientY;
      try { svg.setPointerCapture(e.pointerId); } catch(err){}
      svg.style.cursor='grabbing'; e.preventDefault();
    });
    svg.addEventListener('pointermove', function(e){
      if(!drag) return;
      var rect=svg.getBoundingClientRect();
      if(!rect.width || !rect.height) return;
      vb.x-=(e.clientX-lx)/rect.width*vb.w;
      vb.y-=(e.clientY-ly)/rect.height*vb.h;
      lx=e.clientX; ly=e.clientY; clamp(); apply();
    });
    function endDrag(e){ if(!drag) return; drag=false; svg.style.cursor='grab';
      try { svg.releasePointerCapture(e.pointerId); } catch(err){} }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('dblclick', function(e){ e.preventDefault(); reset(); });
  });
}
// Çakışma önleyici etiket yerleştirici: her etiketi işaretinin üst/alt tarafına
// koyar; yatayda üst üste gelenleri kademeler (tier) ve kademe > 0 ise ince kılavuz
// çizgisi çeker; kenara taşanları başa/sona hizalar (kırpılmayı önler).
function _mnt2DLabels(items, leftX, rightX){
  var svg='';
  ['above','below'].forEach(function(sideKey){
    var above=(sideKey==='above');
    var arr=items.filter(function(it){ return it.above===above; });
    arr.sort(function(a,b){ return a.cx-b.cx; });
    var tiers=[];
    arr.forEach(function(it){
      var halfW=Math.max(15, it.text.length*it.size*0.31);
      var anchor='middle', tx=it.cx;
      if(it.cx+halfW>rightX){ anchor='end'; tx=rightX; }
      else if(it.cx-halfW<leftX){ anchor='start'; tx=leftX; }
      it.anchor=anchor; it.tx=tx;
      var xL=(anchor==='end')?tx-2*halfW:(anchor==='start'?tx:tx-halfW);
      var xR=(anchor==='end')?tx:(anchor==='start'?tx+2*halfW:tx+halfW);
      var t=0;
      while(t<14){ var occ=tiers[t]||[];
        var hit=occ.some(function(iv){ return !(xR<iv[0]-4 || xL>iv[1]+4); });
        if(!hit){ (tiers[t]=occ).push([xL,xR]); break; } t++; }
      it.tier=t;
    });
    arr.forEach(function(it){
      var gap=it.mr+7, step=13;
      var ly=above ? (it.cy-gap-it.tier*step) : (it.cy+gap+it.tier*step);
      if(it.tier>0 && it.anchor==='middle'){
        var y0=above?(it.cy-it.mr):(it.cy+it.mr), y1=above?(ly+3):(ly-9);
        svg+='<line x1="'+_mnt2DR(it.cx)+'" y1="'+_mnt2DR(y0)+'" x2="'+_mnt2DR(it.cx)+'" y2="'+_mnt2DR(y1)+'" stroke="var(--border-color)" stroke-width="0.7"/>';
      }
      svg+=_mnt2DText(it.tx, ly, it.text, it.anchor, it.color, it.size, it.bold);
    });
  });
  return svg;
}
// Tek görünüş (üst/yan) çiz — akademik, tek renkli panel: başlık + eksen köşe
// göstergesi + kesikli referans çizgisi + işaretler + kademeli etiketler + alt not.
function _mnt2DFigure(o){
  // o: {ox, boxX,boxY,boxW,boxH, FIG_W, title, plotTop,plotH,plotL,plotR, px,pyFn,
  //     hKey,vKey, mounts,comps,cg, cr, compAbove, refV,refLabel,
  //     axis:{hLabel,vLabel,vDir,note}, compLabelFn, mountLabelFn, cgLabelFn}
  // hKey → yatay eksen koordinatı ('x' üst/yan, 'y' önden); vKey → düşey ('y'/'z').
  var svg='', plotBottom=o.plotTop+o.plotH;
  var hKey=o.hKey||'x';
  function hval(p){ return hKey==='y'?p.y:(hKey==='z'?p.z:p.x); }
  // dış panel
  svg+='<rect x="'+_mnt2DR(o.boxX)+'" y="'+_mnt2DR(o.boxY)+'" width="'+_mnt2DR(o.boxW)+'" height="'+_mnt2DR(o.boxH)+'" rx="8" fill="var(--bg-secondary)" stroke="var(--border-color)" stroke-width="1"/>';
  // ── ÖLÇEK IZGARASI + SAYISAL EKSEN DEĞERLERİ (mm) — işaretlerin ALTINDA ──
  var gl=o.ox+o.plotL, gr=o.ox+o.FIG_W-o.plotR;
  if(o.hMin!=null && o.hMax!=null){
    _mnt2DNiceTicks(o.hMin, o.hMax, 8).forEach(function(tv){
      var gx=o.px(tv); if(gx<gl-0.5 || gx>gr+0.5) return;
      svg+='<line x1="'+_mnt2DR(gx)+'" y1="'+_mnt2DR(o.plotTop)+'" x2="'+_mnt2DR(gx)+'" y2="'+_mnt2DR(plotBottom)+'" stroke="var(--border-color)" stroke-width="0.5" opacity="0.4"/>';
      svg+=_mnt2DText(gx, plotBottom+13, _mnt2DTick(tv), 'middle', 'var(--text-muted)', 8);
    });
  }
  if(o.vMin!=null && o.vMax!=null){
    _mnt2DNiceTicks(o.vMin, o.vMax, 5).forEach(function(tv){
      var gy=o.pyFn(tv); if(gy<o.plotTop-0.5 || gy>plotBottom+0.5) return;
      svg+='<line x1="'+_mnt2DR(gl)+'" y1="'+_mnt2DR(gy)+'" x2="'+_mnt2DR(gr)+'" y2="'+_mnt2DR(gy)+'" stroke="var(--border-color)" stroke-width="0.5" opacity="0.4"/>';
      svg+=_mnt2DText(gl-5, gy+3, _mnt2DTick(tv), 'end', 'var(--text-muted)', 8);
    });
  }
  // başlık
  svg+=_mnt2DText(o.ox+o.plotL-2, o.boxY+21, o.title, 'start', 'var(--text-heading)', 13, true);
  // kesikli referans çizgisi (Y=0 / Z=0)
  var ry=o.pyFn(o.refV);
  svg+='<line x1="'+_mnt2DR(o.ox+o.plotL-10)+'" y1="'+_mnt2DR(ry)+'" x2="'+_mnt2DR(o.ox+o.FIG_W-o.plotR)+'" y2="'+_mnt2DR(ry)+'" stroke="var(--border-color)" stroke-width="1.1" stroke-dasharray="5 4"/>';
  if(o.refLabel) svg+=_mnt2DText(o.ox+o.FIG_W-o.plotR, ry-5, o.refLabel, 'end', 'var(--text-muted)', 10);
  // eksen köşe göstergesi (yatay + düşey eksen)
  var up=(o.axis.vDir==='up'), axx=o.ox+22, axy=(up? o.plotTop+44 : o.plotTop+14);
  svg+=_mnt2DArrow(axx,axy,axx+26,axy,'var(--text-secondary)')+_mnt2DText(axx+30,axy+4,(o.axis.hLabel||'+X'),'start','var(--text-secondary)',10.5,true);
  var vy=(up? axy-28 : axy+28);
  svg+=_mnt2DArrow(axx,axy,axx,vy,'var(--text-secondary)')+_mnt2DText(axx-3,(up?vy-4:vy+12),o.axis.vLabel,'middle','var(--text-secondary)',10.5,true);
  if(o.axis.note) svg+=_mnt2DText(o.ox+o.plotL-30, plotBottom-2, o.axis.note, 'start', 'var(--text-muted)', 8.5);
  var leftX=o.ox+o.plotL, rightX=o.ox+o.FIG_W-o.plotR, items=[];
  // ── İŞARETLER ── (etiketler ayrı geçişte, çakışma önleyici yerleştirilir)
  // takozlar — HER takoz GERÇEK izdüşüm konumunda çizilir (koordinat düzlemine
  // sadık; konum birleştirme yok). Yalnızca ~işaret boyutu kadar BİREBİR üst üste
  // binen işaretler (aynı piksele düşen sol/sağ çiftleri: yandan X–Z ve önden Y–Z
  // görünüşlerinde) görünürlük için hafifçe yatay yelpazelenir. Her takoz tek tek
  // etiketlenir; çakışan etiketler kademelenir.
  var mpts=o.mounts.map(function(m){ var mv=(o.vKey==='y'?m.y:m.z); return {m:m, v:mv, cx:o.px(hval(m)), cy:o.pyFn(mv)}; });
  var COIN=12;   // px — bu yarıçapta üst üste binenler yelpazelenir (konum aldatmacası değil)
  mpts.forEach(function(a,i){ if(a._grp) return; var grp=[a]; a._grp=1;
    mpts.forEach(function(b,j){ if(j<=i || b._grp) return;
      if(Math.abs(a.cx-b.cx)<COIN && Math.abs(a.cy-b.cy)<COIN){ grp.push(b); b._grp=1; } });
    var n=grp.length;
    grp.forEach(function(pt,k){
      var mx=pt.cx+(n>1?(k-(n-1)/2)*19:0), my=pt.cy;
      var info=['Takoz — '+(pt.m.name||'Takoz'), 'Konum  ('+_mnt2DR(pt.m.x)+', '+_mnt2DR(pt.m.y)+', '+_mnt2DR(pt.m.z)+') mm'];
      svg+='<g'+_mnt2DInfoAttr(info)+'>'+_mnt2DMountMark(mx, my, o.vKey==='z', _MNT2D_C_MOUNT)+'</g>';
      items.push({cx:mx, cy:my, mr:9, above:(pt.v>=o.refV), text:o.mountLabelFn(pt.m), color:'var(--text-secondary)', size:9, bold:false});
    });
  });
  // bileşen CG (içi boş daire, kütleye göre boyut)
  o.comps.forEach(function(c){ var cv=(o.vKey==='y'?c.y:c.z), cx=o.px(hval(c)), cy=o.pyFn(cv), r=o.cr(c.mass);
    var info=[c.name||'Bileşen', 'Ağırlık merkezi  ('+_mnt2DR(c.x)+', '+_mnt2DR(c.y)+', '+_mnt2DR(c.z)+') mm'];
    if(c.mass>0) info.push('Kütle  '+c.mass.toFixed(1)+' kg');
    svg+='<g'+_mnt2DInfoAttr(info)+'>';
    svg+='<circle cx="'+_mnt2DR(cx)+'" cy="'+_mnt2DR(cy)+'" r="'+_mnt2DR(r)+'" fill="var(--bg-primary)" stroke="'+_MNT2D_C_COMP+'" stroke-width="1.5"/></g>';
    items.push({cx:cx, cy:cy, mr:r, above:o.compAbove, text:o.compLabelFn(c), color:'var(--text-secondary)', size:9.5, bold:false});
  });
  // birleşik CG (jeodezik sembol)
  if(o.cg){ var gx=o.px(hval(o.cg)), gy=o.pyFn(o.vKey==='y'?o.cg.y:o.cg.z);
    var cgInfo=['Birleşik Ağırlık Merkezi', 'Konum  ('+_mnt2DR(o.cg.x)+', '+_mnt2DR(o.cg.y)+', '+_mnt2DR(o.cg.z)+') mm'];
    if(o.cg.m>0) cgInfo.push('Toplam kütle  '+o.cg.m.toFixed(1)+' kg');
    svg+='<g'+_mnt2DInfoAttr(cgInfo)+'>'+_mnt2DCGMark(gx,gy,10,_MNT2D_C_CG);
    svg+='<circle cx="'+_mnt2DR(gx)+'" cy="'+_mnt2DR(gy)+'" r="12" fill="transparent"/></g>';
    items.push({cx:gx, cy:gy, mr:11, above:o.compAbove, text:o.cgLabelFn(o.cg), color:'var(--text-primary)', size:10.5, bold:true});
  }
  // ── ETİKETLER ── (üst/alt grupla, yatay çakışanları kademele, kenarda hizala)
  svg+=_mnt2DLabels(items, leftX, rightX);
  return svg;
}
function _mnt2DViewSVG(data){
  if(!data.comps.length && !data.mounts.length){
    return '<div style="padding:24px 10px; text-align:center; font-size:var(--fs-body); color:var(--text-muted);">Görüntülenecek bileşen yok — Motor / Şanzıman / Takoz ekleyip değer girin.</div>';
  }
  // ÜÇ figür ALT ALTA — her biri KENDİ <svg>'sinde (bağımsız yakınlaştır/kaydır).
  // Üstten (X–Y) ve Yandan (X–Z) ortak X yatay ölçeğini paylaşır; Önden (Y–Z)
  // yatayda Y'yi kullanır. Düşey Y/Z ölçekleri bağımsızdır (figür yüksekliğini
  // doldurur). Etiketler sade; ayrıntı (koordinat/kütle) fare-üstü kutusunda.
  var xs=[]; data.mounts.forEach(function(m){xs.push(m.x);}); data.comps.forEach(function(c){xs.push(c.x);}); if(data.cg) xs.push(data.cg.x);
  var minX=Math.min.apply(null,xs), maxX=Math.max.apply(null,xs), xRange=Math.max(maxX-minX,1);
  var ys=[0]; data.mounts.forEach(function(m){ys.push(m.y);}); data.comps.forEach(function(c){ys.push(c.y);}); if(data.cg) ys.push(data.cg.y);
  var minY=Math.min.apply(null,ys), maxY=Math.max.apply(null,ys), yRange=Math.max(maxY-minY,1);
  var zs=[0]; data.mounts.forEach(function(m){zs.push(m.z);}); data.comps.forEach(function(c){zs.push(c.z);}); if(data.cg) zs.push(data.cg.z);
  var minZ=Math.min.apply(null,zs), maxZ=Math.max.apply(null,zs), zRange=Math.max(maxZ-minZ,1);

  // Figür geometrisi — her figür aynı boyut; ayrı SVG viewBox'ta 0'dan başlar.
  var FIG_W=980, plotL=66, plotR=40, usableW=FIG_W-plotL-plotR;
  var headroom=56, plotH=205, vpad=25, capSpace=20, boxY=6;
  var FIG_H=headroom+plotH+capSpace, VB_H=boxY+FIG_H+6, plotTop=boxY+headroom;

  // yatay ölçekler
  var sx=Math.max(0.02, Math.min(1.1, usableW/xRange));   // X (üst + yan ortak)
  var syh=Math.max(0.02, Math.min(1.1, usableW/yRange));  // Y (önden yatay)
  function pxX(x){ return plotL+(x-minX)*sx; }
  function pxY(y){ return plotL+(y-minY)*syh; }
  // düşey ölçekler
  var sy=(plotH-2*vpad)/yRange;                            // Y (üstten düşey)
  var sz=(plotH-2*vpad)/zRange;                            // Z (yan + ön düşey)
  function pyTop(y){ return plotTop+vpad+(maxY-y)*sy; }
  function pyZ(z){ return plotTop+vpad+(maxZ-z)*sz; }

  var ms=data.comps.map(function(c){return c.mass;}).filter(function(m){return m>0;});
  var mMin=ms.length?Math.min.apply(null,ms):0, mMax=ms.length?Math.max.apply(null,ms):1;
  function cr(m){ if(!(m>0)) return 7; var t=(mMax-mMin>1e-9)?(m-mMin)/(mMax-mMin):0.5; return 7+7*Math.sqrt(t); }
  function shortName(n){ n=String(n||''); return n.length>18?n.slice(0,17)+'…':n; }
  function fmt1(v){ return (Math.round(v*10)/10).toString().replace('.',','); }
  function rz(v){ return Math.round(v).toString().replace('-','−'); }
  // Takoz etiketi — gerçek adı (kısaltılmış). Konum birleştirme olmadığından
  // her takoz kendi adıyla, kendi izdüşüm konumunda etiketlenir.
  function mntLabel(m){ return shortName(m.name||'Takoz'); }
  // Her figürü kendi SVG'sine sar (data-vb = başlangıç viewBox'ı, zoom sıfırlama)
  // + köşesine yakınlaştır/uzaklaştır/sıfırla butonları (_mnt2DAttachZoom bağlar).
  function wrap(inner){
    var vb='0 0 '+FIG_W+' '+_mnt2DR(VB_H);
    return '<div class="ve-mnt2d-figwrap">'
      + '<div class="ve-mnt2d-zoomctl">'
      +   '<button type="button" data-z="in" title="Yakınlaştır" aria-label="Yakınlaştır">+</button>'
      +   '<button type="button" data-z="out" title="Uzaklaştır" aria-label="Uzaklaştır">−</button>'
      +   '<button type="button" data-z="reset" title="Sıfırla" aria-label="Sıfırla">⟲</button>'
      + '</div>'
      + '<svg class="ve-mnt2d-fig" viewBox="'+vb+'" data-vb="'+vb+'" preserveAspectRatio="xMidYMid meet"'
      +   ' style="display:block; width:100%; height:auto; touch-action:none; cursor:grab; font-family:'+_MNT2D_MONO+';">'
      + inner + '</svg>'
      + '</div>';
  }
  var common={ ox:0, boxX:8, boxY:boxY, boxW:FIG_W-16, boxH:FIG_H, FIG_W:FIG_W,
    plotTop:plotTop, plotH:plotH, plotL:plotL, plotR:plotR, cr:cr,
    mounts:data.mounts, comps:data.comps, cg:data.cg };
  function fig(extra){ var o={}; var k; for(k in common) o[k]=common[k]; for(k in extra) o[k]=extra[k]; return _mnt2DFigure(o); }

  // ── ÖZET ŞERİDİ + LEJANT (her zaman görünür; hover'a gerek kalmaz) ──
  var totMass=(data.cg&&data.cg.m)?data.cg.m:data.comps.reduce(function(s,c){ return s+(c.mass>0?c.mass:0); },0);
  var summary='<div class="ve-mnt2d-summary">'
    + '<span>Toplam kütle <b>'+fmt1(totMass)+' kg</b></span>'
    + (data.cg?'<span>Birleşik CG <b>('+fmt1(data.cg.x)+' · '+fmt1(data.cg.y)+' · '+fmt1(data.cg.z)+') mm</b></span>':'')
    + '<span>Takoz <b>'+data.mounts.length+'</b></span>'
    + '<span>Bileşen <b>'+data.comps.length+'</b></span>'
    + '</div>';
  function sw(inner){ return '<svg width="16" height="14" viewBox="0 0 16 14" style="vertical-align:-2px;">'+inner+'</svg>'; }
  var legend='<div class="ve-mnt2d-legend">'
    + '<span>'+sw('<rect x="3" y="2.5" width="10" height="9" rx="1.5" fill="none" stroke="'+_MNT2D_C_MOUNT+'" stroke-width="1.6"/>')+' Takoz</span>'
    + '<span>'+sw('<circle cx="8" cy="7" r="5" fill="none" stroke="'+_MNT2D_C_COMP+'" stroke-width="1.6"/>')+' Bileşen CG <i>(kütle ≈ boyut)</i></span>'
    + '<span>'+sw('<circle cx="8" cy="7" r="5" fill="var(--bg-primary)" stroke="'+_MNT2D_C_CG+'" stroke-width="1.6"/><path d="M8 7 L13 7 A5 5 0 0 1 8 12 Z" fill="'+_MNT2D_C_CG+'"/><path d="M8 7 L3 7 A5 5 0 0 1 8 2 Z" fill="'+_MNT2D_C_CG+'"/>')+' Birleşik CG</span>'
    + '</div>';

  var out=summary+legend+'<div class="ve-mnt2d-stack" style="display:flex; flex-direction:column; gap:14px; min-width:480px;">';
  // ── ÜST GÖRÜNÜŞ (X–Y) ──
  out+=wrap(fig({ title:'Üstten Görünüş · X–Y', hKey:'x', vKey:'y', px:pxX, pyFn:pyTop, compAbove:true,
    hMin:minX, hMax:maxX, vMin:minY, vMax:maxY,
    refV:0, refLabel:null, axis:{hLabel:'+X', vLabel:'−Y', vDir:'down', note:'+Y (sağ) yukarı'},
    compLabelFn:function(c){ return shortName(c.name)+' G'; },
    mountLabelFn:mntLabel,
    cgLabelFn:function(cg){ return 'G ('+fmt1(cg.x)+' · '+fmt1(cg.y)+')'; } }));
  // ── YAN GÖRÜNÜŞ (X–Z) ──
  out+=wrap(fig({ title:'Yandan Görünüş · X–Z', hKey:'x', vKey:'z', px:pxX, pyFn:pyZ, compAbove:false,
    hMin:minX, hMax:maxX, vMin:minZ, vMax:maxZ,
    refV:0, refLabel:'Z = 0', axis:{hLabel:'+X', vLabel:'+Z', vDir:'up', note:null},
    compLabelFn:function(c){ return shortName(c.name)+' (z='+rz(c.z)+')'; },
    mountLabelFn:mntLabel,
    cgLabelFn:function(cg){ return 'G (z='+rz(cg.z)+')'; } }));
  // ── ÖNDEN GÖRÜNÜŞ (Y–Z) ──
  out+=wrap(fig({ title:'Önden Görünüş · Y–Z', hKey:'y', vKey:'z', px:pxY, pyFn:pyZ, compAbove:true,
    hMin:minY, hMax:maxY, vMin:minZ, vMax:maxZ,
    refV:0, refLabel:'Z = 0', axis:{hLabel:'+Y', vLabel:'+Z', vDir:'up', note:'+Y (sağ) →'},
    compLabelFn:function(c){ return shortName(c.name)+' G'; },
    mountLabelFn:mntLabel,
    cgLabelFn:function(cg){ return 'G ('+fmt1(cg.y)+' · '+fmt1(cg.z)+')'; } }));
  out+='</div>';
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ ÖZELLİKLERİ PANELİ (kullanıcı tanımlı takoz kataloğu — ekle/çıkar/gör)
// ════════════════════════════════════════════════════════════════════════════
// mnt-library düğümü fiziksel topolojiye bağlanmaz; yalnızca kütüphaneyi
// genişletir. Kullanıcı takozları node.data.mounts içinde tutulur (proje
// kaydet/yükle otomatik). Buradaki her girdi tüm Takoz panellerinin "Kütüphaneden
// yükle" listesinde "Özel" grubunda görünür. Gömülü katalog salt-okunur gösterilir.
function _mntLibEnsure(node){
  if(!node.data) node.data={};
  if(!Array.isArray(node.data.mounts)) node.data.mounts=[];
  return node.data;
}
// Kütüphane girdisi için kompakt sayısal/metin input (satır içi düzenleme).
// setter: değişimi yazan fonksiyon adı — Özel takoz için 'veMntLibSet',
// gömülü override için 'veMntLibSetBuiltin' (varsayılan: veMntLibSet).
function _mntLibInp(nodeId, key, field, val, isText, setter){
  var fn=setter||'veMntLibSet';
  var v=(val===undefined||val===null)?'':val;
  var common='width:100%; padding:4px 7px; font-size:var(--fs-tiny); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px; box-sizing:border-box;';
  if(isText){
    return '<input type="text" value="'+_mntEsc(v)+'" onchange="'+fn+'(\''+nodeId+'\',\''+_mntEsc(key)+'\',\''+field+'\',this.value)" style="'+common+'">';
  }
  return '<input type="number" value="'+_mntEsc(v)+'" step="1" onchange="'+fn+'(\''+nodeId+'\',\''+_mntEsc(key)+'\',\''+field+'\',this.value)" style="'+common+' text-align:right;">';
}
// ─── Grafik/detay yardımcıları (master-detay interaktif panel) ───────────────
// Kuvvet biçimlendirici — grafik ekseni için kompakt (6400→"6.4k"), tipografik −.
function _mntFmtF(v){
  var a=Math.abs(v), s=(v<0)?'−':'';
  if(a>=1000){ var k=a/1000; return s+(k>=10?Math.round(k):(Math.round(k*10)/10))+'k'; }
  return s+Math.round(a);
}
// [[δ,f],…] noktaları arasında lineer interpolasyon/klips (2 nokta veya spline yoksa).
function _mntLinInterp(pts, x){
  var n=pts.length;
  if(x<=pts[0][0]) return pts[0][1];
  if(x>=pts[n-1][0]) return pts[n-1][1];
  for(var i=0;i<n-1;i++){
    if(x<=pts[i+1][0]){
      var dx=(pts[i+1][0]-pts[i][0])||1, t=(x-pts[i][0])/dx;
      return pts[i][1]+t*(pts[i+1][1]-pts[i][1]);
    }
  }
  return pts[n-1][1];
}
// Küçük yuvarlak rozet (ÖZEL / GÖMÜLÜ / DEĞİŞTİRİLDİ).
function _mntLibBadge(text, color){
  return '<span style="font-size:var(--fs-micro); font-weight:700; letter-spacing:0.04em; padding:2px 7px; border:1px solid '+color+'; color:'+color+'; border-radius:10px; white-space:nowrap;">'+text+'</span>';
}
// Bir girdi herhangi bir eksende nonlineer yasa (analitik fit VEYA nokta eğrisi) taşıyor mu?
function _mntEntryHasLaw(e){
  return ['fitX','fitY','fitZ'].some(function(f){ return !!e[f]; })
      || ['curveX','curveY','curveZ'].some(function(f){ return Array.isArray(e[f])&&e[f].length>=2; });
}
// Master listede tek tıklanabilir takoz satırı (seçili → aksan çerçeve + koyu zemin).
function _mntLibMasterRow(node, e, sel){
  var isSel=sel && e.key===sel.key;
  var hasCurve=_mntEntryHasLaw(e);
  var dotColor=hasCurve?'var(--accent-danger)':(e.overridden?'var(--accent-warning)':(e.builtin?'var(--accent-primary)':'var(--accent-success)'));
  var baseBg=isSel?'var(--bg-tertiary)':'transparent';
  var border=isSel?('1px solid '+dotColor):'1px solid transparent';
  var hover=isSel?'':' onmouseover="this.style.background=\'var(--bg-tertiary)\'" onmouseout="this.style.background=\'transparent\'"';
  var h='<div onclick="veMntLibSelect(\''+node.id+'\',\''+_mntEsc(e.key)+'\')"'+hover
    +' style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:6px 9px; border-radius:7px; background:'+baseBg+'; border:'+border+'; margin-bottom:4px;">';
  h+='<span style="width:8px; height:8px; border-radius:50%; background:'+dotColor+'; flex-shrink:0;"></span>';
  h+='<span style="flex:1; min-width:0; font-size:var(--fs-body); font-weight:'+(isSel?'700':'500')+'; color:var(--text-'+(isSel?'heading':'primary')+'); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">'+_mntEsc(e.name)+'</span>';
  h+='<span style="font-size:var(--fs-micro); color:var(--text-muted); font-family:'+_MNT2D_MONO+'; white-space:nowrap;">kz '+Math.round(_mntNum(e.sz))+'</span>';
  if(hasCurve) h+='<span title="nonlineer eğri" style="font-size:var(--fs-body); color:var(--accent-danger); line-height:1;">∿</span>';
  h+='</div>';
  return h;
}
// Rijitlik ızgarası: satır = eksen (kx/ky/kz), sütun = Statik / Dinamik. Kompakt,
// dar, hizalı girişler — geniş tekil satırlar yerine düzenli tablo (estetik).
function _mntLibStiffGrid(node, e, setter){
  var rows=[['x','kx'],['y','ky'],['z','kz']];
  var chip=function(c,t){ return '<span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:9px; height:2px; background:'+c+'; display:inline-block; border-radius:1px;"></span>'+t+'</span>'; };
  var lbl='font-size:var(--fs-micro); color:var(--text-secondary); font-weight:600; white-space:nowrap;';
  var hd='font-size:var(--fs-micro); color:var(--text-muted); font-weight:700; letter-spacing:0.03em; text-transform:uppercase; text-align:center; padding-bottom:1px;';
  // Tablo DEĞİL, CSS grid (div) — .ve-properties-content td padding override'ına takılmaz.
  var h='<div style="margin-bottom:13px;">';
  h+='<div style="font-size:var(--fs-micro); font-weight:700; color:var(--text-secondary); letter-spacing:0.03em; text-transform:uppercase; margin-bottom:7px;">Rijitlik <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">[N/mm]</span></div>';
  h+='<div style="display:grid; grid-template-columns:28px 1fr 1fr; gap:5px 8px; max-width:266px; align-items:center;">';
  h+='<div></div><div style="'+hd+'">'+chip('var(--accent-primary)','Statik')+'</div><div style="'+hd+'">'+chip('var(--accent-warning)','Dinamik')+'</div>';
  rows.forEach(function(r){
    var sv=(e['s'+r[0]]===undefined||e['s'+r[0]]===null)?'':e['s'+r[0]];
    var dv=(e['d'+r[0]]===undefined||e['d'+r[0]]===null)?'':e['d'+r[0]];
    h+='<div style="'+lbl+'">'+r[1]+'</div>'
      +'<div>'+_mntLibInp(node.id, e.key, 's'+r[0], sv, false, setter)+'</div>'
      +'<div>'+_mntLibInp(node.id, e.key, 'd'+r[0], dv, false, setter)+'</div>';
  });
  h+='</div></div>';
  return h;
}
// Grafik altına açıklamalı legend (statik/dinamik/ölçüm).
function _mntLibLegend(hasCurve, hasMarkers){
  function sw(inner){ return '<svg width="16" height="9" viewBox="0 0 16 9" style="vertical-align:-1px;">'+inner+'</svg>'; }
  var statColor=hasCurve?'var(--accent-danger)':'var(--accent-primary)';
  var h='<div style="display:flex; flex-wrap:wrap; gap:11px; margin-top:7px; font-size:var(--fs-micro); color:var(--text-secondary);">';
  h+='<span>'+sw('<line x1="1" y1="4.5" x2="15" y2="4.5" stroke="'+statColor+'" stroke-width="2"/>')+' Statik'+(hasCurve?' (eğri)':' (lineer)')+'</span>';
  h+='<span>'+sw('<line x1="1" y1="4.5" x2="15" y2="4.5" stroke="var(--accent-warning)" stroke-width="1.6" stroke-dasharray="4 2.5"/>')+' Dinamik</span>';
  if(hasMarkers) h+='<span>'+sw('<circle cx="8" cy="4.5" r="2.6" fill="var(--bg-primary)" stroke="var(--accent-danger)" stroke-width="1.3"/>')+' Ölçüm noktaları</span>';
  h+='</div>';
  return h;
}
// Analitik fit değerlendiricisi (x: sehim mm → kuvvet N) — çekirdek makeAxisLaw ile
// AYNI matematik (yalnız panel çizimi için). 'poly': k0·x+c3·x³+c5·x⁵; 'asym' parçalı.
function _mntFitForce(fit, x){
  if(!fit) return 0;
  if(fit.form==='asym'){
    var cp=fit.comp||{}, ex=fit.ext||{}, xmax=(cp.xmax>0?cp.xmax:1), EPS=0.02;
    if(x>=0) return _mntNum(ex.k0)*x + _mntNum(ex.c3)*x*x*x;    // geri-gelme (δ≥0, kübik)
    var u=1+x/xmax; if(u<EPS) u=EPS;                            // basma (δ<0, rasyonel, asimptot −xmax)
    return _mntNum(cp.k0)*x/u;
  }
  return _mntNum(fit.k0)*x + _mntNum(fit.c3)*x*x*x + _mntNum(fit.c5)*x*x*x*x*x;
}
// Fit için çizim aralığı [dmin,dmax] mm — |F|≈17 kN'a ulaştığı yer (eksenelde
// asimptota çok yaklaşmadan xmax·0.985'te durur). Grafik ölçeğini otomatik verir.
function _mntFitDomain(fit){
  var TARGET=17000;
  function reach(dir){ var last=0; for(var i=1;i<=160;i++){ var x=dir*0.25*i; if(Math.abs(_mntFitForce(fit,x))>=TARGET) return x; last=x; } return last; }
  if(fit && fit.form==='asym'){
    var xmax=(fit.comp&&fit.comp.xmax>0)?fit.comp.xmax:5;   // asimptot basma (δ<0) tarafında
    return [Math.max(reach(-1)||(-xmax*0.985), -xmax*0.985), reach(1)||15];
  }
  var h=reach(1)||15;
  return [-h, h];
}
// Kuvvet–sehim GRAFİĞİ (eksen bazlı: 'x'|'y'|'z'): statik yasa (analitik fit, ya da
// PCHIP nokta eğrisi, ya da lineer k_s·δ), dinamik referans slope (k_d·δ, kesikli) ve
// (nokta eğrisi için) ölçüm noktaları. Salt-görsel SVG.
function _mntLibForceChart(e, axis){
  axis=axis||'z';
  var A=axis.toUpperCase();
  var sz=_mntNum(e['s'+axis]), dz=_mntNum(e['d'+axis]);
  var fit=e['fit'+A]||null;
  var rawc=e['curve'+A];
  var raw=(!fit && Array.isArray(rawc) && rawc.length>=2)?rawc:null;
  var pts=raw?raw.map(function(p){ return [_mntNum(p[0]), _mntNum(p[1])]; }).sort(function(a,b){ return a[0]-b[0]; }):null;
  var hasCurve=!!fit || !!pts;
  var dmin, dmax;
  if(fit){ var dm=_mntFitDomain(fit); dmin=dm[0]; dmax=dm[1]; }
  else if(pts){ dmin=pts[0][0]; dmax=pts[pts.length-1][0]; }
  else { dmin=-15; dmax=15; }
  if(!(dmax>dmin)){ dmin-=1; dmax+=1; }
  // Statik yasa değerlendiricisi
  var spline=null;
  if(!fit && pts && pts.length>=3 && typeof veBuildPchipSpline==='function'){
    try{ spline=veBuildPchipSpline(pts.map(function(p){ return {rpm:p[0], torque:p[1]}; })); }catch(_e){ spline=null; }
  }
  function fStat(x){
    var v;
    if(fit) v=_mntFitForce(fit, x);
    else if(!pts) v=sz*x;
    else if(spline && typeof veEvalPchip==='function') v=veEvalPchip(spline, x);
    else v=_mntLinInterp(pts, x);
    return isFinite(v)?v:0;
  }
  // Örnekle
  var N=64, i, x, statPts=[], dynPts=[], allF=[0];
  for(i=0;i<=N;i++){ x=dmin+(dmax-dmin)*i/N; var fs=fStat(x), fd=dz*x; statPts.push([x,fs]); dynPts.push([x,fd]); allF.push(fs); allF.push(fd); }
  if(pts) pts.forEach(function(p){ allF.push(p[1]); });
  var fmin=Math.min.apply(null, allF), fmax=Math.max.apply(null, allF);
  if(!(fmax>fmin)){ fmin-=1; fmax+=1; }
  var fpad=(fmax-fmin)*0.10; fmin-=fpad; fmax+=fpad;
  // Geometri (yan yana 3 grafik için kompakt; fontlar küçültülüp okunur tutuldu)
  var W=300, H=212, plotL=44, plotR=292, plotT=12, plotB=172;
  function px(xx){ return plotL+(xx-dmin)/(dmax-dmin)*(plotR-plotL); }
  function py(ff){ return plotB-(ff-fmin)/(fmax-fmin)*(plotB-plotT); }
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block; font-family:'+_MNT2D_MONO+';">';
  s+='<rect x="'+plotL+'" y="'+plotT+'" width="'+(plotR-plotL)+'" height="'+(plotB-plotT)+'" fill="var(--bg-input)" opacity="0.3"/>';
  // Izgara + eksen etiketleri (4 işaret hedefi — kalabalık olmasın)
  var xticks=_mnt2DNiceTicks(dmin,dmax,4), yticks=_mnt2DNiceTicks(fmin,fmax,4);
  xticks.forEach(function(tv){ var gx=px(tv); if(gx<plotL-0.5||gx>plotR+0.5) return;
    s+='<line x1="'+_mnt2DR(gx)+'" y1="'+plotT+'" x2="'+_mnt2DR(gx)+'" y2="'+plotB+'" stroke="var(--border-color)" stroke-width="0.5" opacity="0.35"/>';
    s+=_mnt2DText(gx, plotB+14, _mnt2DTick(tv), 'middle', 'var(--text-muted)', 9.5);
  });
  yticks.forEach(function(tv){ var gy=py(tv); if(gy<plotT-0.5||gy>plotB+0.5) return;
    s+='<line x1="'+plotL+'" y1="'+_mnt2DR(gy)+'" x2="'+plotR+'" y2="'+_mnt2DR(gy)+'" stroke="var(--border-color)" stroke-width="0.5" opacity="0.35"/>';
    s+=_mnt2DText(plotL-4, _mnt2DR(gy)+3, _mntFmtF(tv), 'end', 'var(--text-muted)', 9);
  });
  // Sıfır eksenleri (vurgulu)
  var y0=py(0), x0=px(0);
  if(y0>=plotT&&y0<=plotB) s+='<line x1="'+plotL+'" y1="'+_mnt2DR(y0)+'" x2="'+plotR+'" y2="'+_mnt2DR(y0)+'" stroke="var(--text-muted)" stroke-width="1"/>';
  if(x0>=plotL&&x0<=plotR) s+='<line x1="'+_mnt2DR(x0)+'" y1="'+plotT+'" x2="'+_mnt2DR(x0)+'" y2="'+plotB+'" stroke="var(--text-muted)" stroke-width="1"/>';
  // Dinamik referans (kesikli) + statik yasa (kalın) + ölçüm noktaları
  s+='<polyline points="'+dynPts.map(function(p){ return _mnt2DR(px(p[0]))+','+_mnt2DR(py(p[1])); }).join(' ')+'" fill="none" stroke="var(--accent-warning)" stroke-width="1.6" stroke-dasharray="5 3" opacity="0.9"/>';
  var statColor=hasCurve?'var(--accent-danger)':'var(--accent-primary)';
  s+='<polyline points="'+statPts.map(function(p){ return _mnt2DR(px(p[0]))+','+_mnt2DR(py(p[1])); }).join(' ')+'" fill="none" stroke="'+statColor+'" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
  if(pts) pts.forEach(function(p){ s+='<circle cx="'+_mnt2DR(px(p[0]))+'" cy="'+_mnt2DR(py(p[1]))+'" r="2.6" fill="var(--bg-primary)" stroke="var(--accent-danger)" stroke-width="1.5"/>'; });
  // Eksen başlıkları
  s+=_mnt2DText((plotL+plotR)/2, H-3, 'sehim δ [mm]', 'middle', 'var(--text-secondary)', 9.5);
  var yc=(plotT+plotB)/2;
  s+='<text x="11" y="'+yc+'" text-anchor="middle" font-size="9.5" font-family="'+_MNT2D_MONO+'" fill="var(--text-secondary)" transform="rotate(-90 11 '+yc+')">kuvvet f [N]</text>';
  s+='</svg>';
  return s;
}
// SEÇİLİ takozun detay kartı: ad + statik/dinamik rijitlikler + kuvvet-sehim
// grafiği + (özel takoz için) nonlineer eğri editörü.
function _mntLibDetail(node, e){
  var isCustom=!e.builtin;
  var setter=isCustom?'veMntLibSet':'veMntLibSetBuiltin';
  var hasCurveZ=isCustom && Array.isArray(e.curveZ) && e.curveZ.length>=2;   // özel z-eğrisi editörü için
  var accent=e.overridden?'var(--accent-warning)':(isCustom?'var(--accent-success)':'var(--accent-primary)');
  var badge=isCustom?_mntLibBadge('ÖZEL','var(--accent-success)')
    :(e.overridden?_mntLibBadge('DEĞİŞTİRİLDİ','var(--accent-warning)'):_mntLibBadge('GÖMÜLÜ','var(--accent-primary)'));
  var actionBtn=isCustom
    ? '<button onclick="veMntLibRemove(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" title="Bu takozu sil" style="background:none; border:1px solid var(--accent-danger); color:var(--accent-danger); cursor:pointer; padding:4px 8px; font-size:var(--fs-tiny); border-radius:5px; white-space:nowrap;">✕ Sil</button>'
    : '<button onclick="veMntLibResetBuiltin(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" title="Fabrika ayarına dön" style="background:none; border:1px solid var(--accent-warning); color:var(--accent-warning); cursor:pointer; padding:4px 8px; font-size:var(--fs-tiny); border-radius:5px; white-space:nowrap;">↺ Fabrika</button>';
  var inner='';
  inner+='<div style="display:flex; align-items:center; gap:8px; margin-bottom:13px;">'
    +'<div style="flex:1; min-width:0; max-width:340px;">'+_mntLibInp(node.id, e.key, 'name', e.name, true, setter)+'</div>'
    +badge+actionBtn+'</div>';
  inner+=_mntLibStiffGrid(node, e, setter);
  // Üç eksen kuvvet–sehim grafiği (Fx/Fy/Fz) YAN YANA — gömülüde fabrika fiti/eğrisi,
  // özelde z-eğrisi; yasa yoksa o eksen statik k_s·δ lineeriyle çizilir. Tek ortak legend.
  inner+='<div style="font-size:var(--fs-micro); font-weight:700; color:var(--text-secondary); letter-spacing:0.03em; text-transform:uppercase; margin:2px 0 8px;">Kuvvet–Sehim Eğrileri <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">δ [mm] · f [N]</span></div>';
  var anyMk=false, row='<div style="display:flex; gap:11px; align-items:stretch; flex-wrap:wrap;">';
  [['x','Fx · radyal'],['y','Fy · radyal'],['z','Fz · eksenel']].forEach(function(ax){
    var A=ax[0].toUpperCase();
    var f=e['fit'+A], c=e['curve'+A];
    var hc=!!f || (Array.isArray(c)&&c.length>=2);
    if(!f && Array.isArray(c)&&c.length>=2) anyMk=true;    // ölçüm noktaları yalnız nokta eğrisinde
    var unit=f?'analitik fit':(hc?'nonlineer':'lineer');
    var uc=hc?'var(--accent-danger)':'var(--accent-primary)';
    row+='<div style="flex:1 1 195px; min-width:185px; background:var(--bg-primary); border:1px solid var(--border-color); border-radius:9px; padding:9px 9px 5px;">'
      +'<div style="display:flex; align-items:center; gap:6px; margin-bottom:5px;">'
        +'<span style="width:3px; height:11px; border-radius:2px; background:'+uc+';"></span>'
        +'<span style="font-size:var(--fs-tiny); font-weight:700; color:var(--text-heading);">'+ax[1]+'</span>'
        +'<span style="font-size:var(--fs-micro); color:var(--text-muted); margin-left:auto;">'+unit+'</span></div>'
      +_mntLibForceChart(e, ax[0])
      +'</div>';
  });
  row+='</div>';
  inner+=row;
  inner+=_mntLibLegend(_mntEntryHasLaw(e), anyMk);
  if(isCustom){
    if(node.data._curveEditKey===e.key){
      inner+=_mntLibCurveEditor(node, _mntLibCustomEntry(node, e.key)||e);
    } else {
      inner+='<button onclick="veMntLibCurveToggle(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" style="width:100%; padding:8px; margin-top:2px; font-size:var(--fs-tiny); font-weight:600; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:6px; cursor:pointer;">∿ '+(hasCurveZ?('z-eğrisini düzenle ('+e.curveZ.length+' nokta)'):'Nonlineer z-eğrisi tanımla')+'</button>';
    }
  } else {
    var anyC=_mntEntryHasLaw(e);
    inner+='<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.4; margin-top:2px; padding:7px 9px; background:var(--bg-tertiary); border:1px dashed var(--border-color); border-radius:6px;">'+(anyC?'Gömülü takoz — eğriler <b>fabrika</b> değeridir (salt-okunur). Kendi eğrini düzenlemek için bir <b>Özel Takoz</b> oluştur.':'Bu gömülü takoz lineerdir. Nonlineer eğri için bir <b>Özel Takoz</b> oluşturun.')+'</div>';
  }
  return '<div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid '+accent+'; border-radius:9px; padding:12px 12px 9px;">'
    +'<div style="font-size:var(--fs-micro); font-weight:700; letter-spacing:0.05em; color:var(--text-muted); text-transform:uppercase; margin-bottom:9px;">Seçili Takoz</div>'
    +inner+'</div>';
}
// Master-detay panel: tıklanabilir takoz listesi (Özel + Gömülü) → seçili takozun
// statik/dinamik rijitlikleri ve kuvvet-sehim eğrisi detay kartında görünür.
function getMntLibraryPropertiesHTML(node){
  var d=_mntLibEnsure(node);
  var custom=d.mounts;                                        // bu düğümün özel takozları (ham girdiler; builtin yok → özel)
  var builtins=veMntGetLibraryList().filter(function(e){ return e.builtin; });
  var nCurve=custom.concat(builtins).filter(_mntEntryHasLaw).length;
  var sel=null;
  if(d._selKey) sel=custom.concat(builtins).find(function(e){ return e.key===d._selKey; });
  if(!sel) sel=custom[0]||builtins[0]||null;

  var html='<div class="sw-panel">';
  html+='<div class="sw-status-bar installed"><span class="sw-status-dot"></span><span>Takoz Kütüphanesi</span>'
    +'<span style="margin-left:auto; font-weight:400; font-size:var(--fs-micro); opacity:0.85;">'+custom.length+' özel · '+builtins.length+' gömülü'+(nCurve?' · '+nCurve+' eğri':'')+'</span></div>';
  html+='<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.45; margin:8px 0 12px;">Soldan bir takoz <b>seçin</b>: sağda statik + dinamik rijitlikleri ve 3 eksen kuvvet–sehim eğrisi görünür. Eklenen takozlar tüm Takoz bileşenlerinin listesinde çıkar. Rijitlikler <b>N/mm</b>.</div>';

  // İki sütun: SOL = takoz seçici (Özel + Gömülü), SAĞ = seçili takoz detayı.
  // Dar ekranda flex-wrap ile alt alta yığılır.
  html+='<div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;">';

  // ── SOL: seçici ──
  html+='<div style="flex:0 0 262px; min-width:228px;">';
  html+='<div class="sw-section-title">Özel Takozlar <span style="font-size:var(--fs-micro); font-weight:400; color:var(--text-muted);">'+custom.length+' adet</span></div>';
  if(!custom.length){
    html+='<div style="padding:8px 10px; margin-bottom:6px; font-size:var(--fs-tiny); color:var(--text-muted); background:var(--bg-tertiary); border:1px dashed var(--border-color); border-radius:6px;">Henüz özel takoz yok. Aşağıdaki <b>＋</b> ile ekleyin.</div>';
  } else {
    custom.forEach(function(e){ html+=_mntLibMasterRow(node, e, sel); });
  }
  html+='<button onclick="veMntLibAdd(\''+node.id+'\')" style="width:100%; padding:8px 12px; margin:4px 0 14px; font-size:var(--fs-body); font-weight:700; background:var(--accent-success); color:#fff; border:none; border-radius:6px; cursor:pointer; letter-spacing:0.02em;" onmouseover="this.style.filter=\'brightness(1.1)\'" onmouseout="this.style.filter=\'none\'">＋ Yeni Takoz Ekle</button>';
  var nOv=builtins.filter(function(e){ return e.overridden; }).length;
  html+='<div class="sw-section-title">Gömülü Katalog <span style="font-size:var(--fs-micro); font-weight:400; color:var(--text-muted);">'+builtins.length+' adet'+(nOv?' · '+nOv+' değiştirildi':'')+'</span></div>';
  builtins.forEach(function(e){ html+=_mntLibMasterRow(node, e, sel); });
  html+='</div>';

  // ── SAĞ: seçili takoz detayı ──
  html+='<div style="flex:1; min-width:300px;">';
  if(sel){ html+=_mntLibDetail(node, sel); }
  else { html+='<div style="padding:14px; font-size:var(--fs-tiny); color:var(--text-muted); background:var(--bg-secondary); border:1px dashed var(--border-color); border-radius:9px;">Soldan bir takoz seçin.</div>'; }
  html+='</div>';

  html+='</div>';   // /iki sütun
  html+='</div>';   // /sw-panel
  return html;
}

// Panel içi 3B görüntüleyiciyi güncel topolojiyle (yeniden) başlat.
function veMntViewerRefresh(){
  if(typeof _mntGatherForSolver!=='function') return;
  _veMntViewerData = _mntGatherForSolver();
  if(typeof veMountViewerInit==='function'){
    try{ veMountViewerInit('ve-mnt-inline-viewer-canvas'); veMountViewerUpdate(); }catch(e){}
  }
}

// ─── Kütüphane setter'ları ───────────────────────────────────────────────────
function veMntLibAdd(nodeId){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  d._seq=(d._seq||0)+1;
  var key='mnt-usr-'+nodeId+'-'+d._seq;
  d.mounts.push({ key:key, name:'Yeni Takoz '+d._seq, sx:0, sy:0, sz:0, dx:0, dy:0, dz:0 });
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntLibRemove(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  d.mounts=d.mounts.filter(function(e){ return e.key!==key; });
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntLibSet(nodeId, key, field, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  var e=d.mounts.find(function(x){ return x.key===key; }); if(!e) return;
  e[field]=(field==='name')?val:_mntNum(val);
  if(typeof saveState==='function') saveState();
  // Ad/rijitlik değişimi Takoz açılır listesini etkiler; panel yeniden çizilmez
  // (aktif input odağı korunur — girdiler zaten güncel değeri gösterir).
}
// Gömülü takoz düzenleme — fabrika VE_MOUNT_LIBRARY'yi asla mutasyona uğratmaz;
// değişikliği node.data.overrides[key][field] içine alan-bazlı yazar (kalıcı).
function veMntLibSetBuiltin(nodeId, key, field, val){
  if(!VE_MOUNT_LIBRARY[key]) return;                       // yalnız var olan gömülü girdi
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  if(!node.data.overrides || typeof node.data.overrides!=='object') node.data.overrides={};
  if(!node.data.overrides[key]) node.data.overrides[key]={};
  node.data.overrides[key][field]=(field==='name')?val:_mntNum(val);
  if(typeof saveState==='function') saveState();
  // Panel yeniden çizilmez (aktif input odağı korunur); ● rozeti bir sonraki
  // açılışta güncellenir, ↺ butonu her zaman tıklanabilir.
}
// Gömülü takozu fabrika ayarına döndür — override'ı sil.
function veMntLibResetBuiltin(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(node.data && node.data.overrides && node.data.overrides[key]!==undefined){
    delete node.data.overrides[key];
    if(typeof saveState==='function') saveState();
  }
  if(typeof showNodeProperties==='function') showNodeProperties(node); // fabrika değerlerini geri bas
}
// Master listede bir takoz seç → detay kartı o takozu gösterir (panel yeniden çizilir).
// Başka takoza geçilince açık eğri editörü kapanır (görsel durum temiz kalır).
function veMntLibSelect(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  d._selKey=key;
  if(d._curveEditKey && d._curveEditKey!==key) d._curveEditKey=null;
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}

// ─── Kütüphane girdisi: nonlineer z-eğrisi (takoz TİPİNİN özelliği) ──────────
// Eğri ÖZEL kütüphane girdisinde (node.data.mounts[i].curveZ = [[δ_mm,f_N],…])
// tutulur; veMntApplyLib ile Takoz'a KOPYALANIR. Gömülü katalog lineer kalır.
// d._curveEditKey: hangi özel girdinin eğri editörü açık (yalnız görsel durum).
function _mntLibCustomEntry(node, key){
  var d=_mntLibEnsure(node);
  return d.mounts.find(function(x){ return x.key===key; }) || null;
}
function veMntLibCurveToggle(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  d._curveEditKey = (d._curveEditKey===key) ? null : key;
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
// Etkinleştir: girdinin sz'sinden (statik kz, N/mm) LİNEER başlangıç eğrisi tohumla.
// Başta lineerle aynı sonucu verir; kullanıcı ilerlemeli/asimetrik yaparak ayrıştırır.
function veMntLibCurveEnable(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key); if(!e) return;
  var kz=_mntNum(e.sz, 0);   // N/mm
  e.curveZ=[[-15,-15*kz],[-7.5,-7.5*kz],[0,0],[7.5,7.5*kz],[15,15*kz]];
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntLibCurveDisable(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key); if(e) delete e.curveZ;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
// Nokta düzenle — YENİDEN ÇİZME YOK (odak korunur). col: 0=δ[mm], 1=f[N].
function veMntLibCurveSetPoint(nodeId, key, idx, col, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key);
  if(!e || !Array.isArray(e.curveZ) || !e.curveZ[idx]) return;
  e.curveZ[idx][col]=_mntNum(val, 0);
  if(typeof saveState==='function') saveState();
}
function veMntLibCurveAddPoint(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key); if(!e || !Array.isArray(e.curveZ)) return;
  var last=e.curveZ[e.curveZ.length-1]||[0,0];
  e.curveZ.push([_mntNum(last[0],0)+5, _mntNum(last[1],0)]);   // son noktanın 5 mm ötesine
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntLibCurveRemovePoint(nodeId, key, idx){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key); if(!e || !Array.isArray(e.curveZ)) return;
  e.curveZ.splice(idx,1);
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
// Özel girdi için eğri editörü kartı (kütüphane panelinde, özel tablonun altında).
function _mntLibCurveEditor(node, e){
  var pts = Array.isArray(e.curveZ) ? e.curveZ : null;
  var head='<div style="display:flex; justify-content:flex-end; margin-bottom:6px;"><button onclick="veMntLibCurveToggle(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" style="background:none; border:1px solid var(--border-color); color:var(--text-muted); cursor:pointer; padding:2px 8px; font-size:var(--fs-tiny); border-radius:4px;">Kapat ✕</button></div>';
  var inner;
  if(!pts || pts.length<2){
    inner = '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.45; margin-bottom:8px;">'
      + '<b>'+_mntEsc(e.name||'Takoz')+'</b> için düşey (z) kuvvet–sehim eğrisi tanımlarsanız, bu takoz tipi '
      + 'bir Takoz\'a uygulandığında çözücü onu <b>nonlineer</b> (Newton) çözer. Tanımlanmazsa statik kz ile lineer kalır.</div>'
      + '<button onclick="veMntLibCurveEnable(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" style="width:100%; padding:7px; font-size:var(--fs-body); font-weight:600; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px; cursor:pointer;">＋ z-eğrisi ekle (sz\'den lineer tohum)</button>';
  } else {
    inner = '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.4; margin-bottom:7px;">δ: sehim [mm], f: kuvvet [N] (basma <b>−</b>). Çözücü δ\'ya göre sıralar; monoton eğri önerilir.</div>';
    inner += '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:var(--fs-tiny); margin-bottom:7px;"><thead><tr>'
      + '<th style="'+_mntMxTh()+'">δ [mm]</th><th style="'+_mntMxTh()+'">f [N]</th><th style="'+_mntMxTh()+'"></th></tr></thead><tbody>';
    pts.forEach(function(p,i){
      inner += '<tr>'
        + '<td style="'+_mntMxTd()+'"><input type="number" value="'+_mntEsc(p[0])+'" step="0.5" onchange="veMntLibCurveSetPoint(\''+node.id+'\',\''+_mntEsc(e.key)+'\','+i+',0,this.value)" style="width:100%; '+_MNT_INP+'"></td>'
        + '<td style="'+_mntMxTd()+'"><input type="number" value="'+_mntEsc(p[1])+'" step="10" onchange="veMntLibCurveSetPoint(\''+node.id+'\',\''+_mntEsc(e.key)+'\','+i+',1,this.value)" style="width:100%; '+_MNT_INP+'"></td>'
        + '<td style="'+_mntMxTd()+'"><button onclick="veMntLibCurveRemovePoint(\''+node.id+'\',\''+_mntEsc(e.key)+'\','+i+')" title="Noktayı sil" style="background:none; border:1px solid var(--border-color); color:var(--accent-danger); cursor:pointer; padding:1px 6px; font-size:var(--fs-body); line-height:1;">✕</button></td>'
        + '</tr>';
    });
    inner += '</tbody></table></div>';
    inner += '<div style="display:flex; gap:5px;">'
      + '<button onclick="veMntLibCurveAddPoint(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" style="flex:1; padding:6px; font-size:var(--fs-tiny); background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer;">＋ nokta</button>'
      + '<button onclick="veMntLibCurveDisable(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" style="flex:1; padding:6px; font-size:var(--fs-tiny); background:var(--bg-tertiary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer;">Lineere dön</button>'
      + '</div>';
  }
  return _mntCard('Nonlineer z-eğrisi — '+_mntEsc(e.name||'Takoz'),'düşey kuvvet–sehim','var(--accent-danger)', head+inner);
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇÖZÜCÜ — bağlı node'ları topla, agrege et, çekirdeği çalıştır
// ════════════════════════════════════════════════════════════════════════════
// Çözücü, iç topolojideki TÜM kütle ve takoz node'larını OTOMATİK algılar —
// bağlantı zorunluluğu yoktur (kullanıcı isteği). Alt topoloji yalnız mount
// bileşenleri içerdiğinden nodes içindeki isMountBody/isMount düğümleri toplanır.
// Tork zinciri girdilerini (Te / vites / transfer / aks payı) kütle
// gövdelerinden konumdan bağımsız topla — hangi bileşende girildiği fark etmez
// (ilk tanımlı değer geçerli). Motor→Te, Şanzıman→vites+stall, Transfer→oran+φ.
// Tahrik/motor büyüklüklerini kütle gövdelerinden topla (ilk tanımlı değer kazanır).
// idleRpm + cylinders motorun ÖZELLİĞİDİR: buradan toplanıp rapora akar; raporun
// ateşleme frekansı f_ateş=(N/60)·(z/2) bu ikisine dayanır.
function _mntGatherTorque(){
  var keys=['Te','Rstall','g1','g2','g3','g4','g5','g6','gR','iTransfer','phiFwd','phiRev','derate',
            'idleRpm','cylinders'];
  var t={};
  (typeof nodes!=='undefined'?nodes:[]).forEach(function(n){
    if(!(_mntDef(n)||{}).isMountBody) return;
    var d=n.data||{};
    keys.forEach(function(k){ if(t[k]===undefined && d[k]!==undefined && d[k]!==null && d[k]!=='') t[k]=d[k]; });
  });
  return t;
}
function _mntGatherForSolver(solver){
  var masses=[], mounts=[];
  (typeof nodes!=='undefined'?nodes:[]).forEach(function(n){
    var def=_mntDef(n)||{};
    if(def.isMountBody){
      var d=n.data||{};
      masses.push({ name:_mntNodeName(n), mass:d.mass, cgx:d.cgx, cgy:d.cgy, cgz:d.cgz, Ixx:d.Ixx, Iyy:d.Iyy, Izz:d.Izz, Ixy:d.Ixy, Ixz:d.Ixz, Iyz:d.Iyz, pointMass:!!d.pointMass });
    } else if(def.isMount){
      var m=n.data||{};
      mounts.push({ name:_mntNodeName(n), x:m.x, y:m.y, z:m.z, kxs:m.kxs, kys:m.kys, kzs:m.kzs, kxd:m.kxd, kyd:m.kyd, kzd:m.kzd,
                    fitX:(m.fitX||null), fitY:(m.fitY||null), fitZ:(m.fitZ||null),   // opsiyonel analitik fit (x/y/z)
                    curveX:(Array.isArray(m.curveX)?m.curveX:null),                  // ya da nokta tablosu (x/y/z)
                    curveY:(Array.isArray(m.curveY)?m.curveY:null),
                    curveZ:(Array.isArray(m.curveZ)?m.curveZ:null) });
    }
  });
  return { components:masses, mounts:mounts, torque:_mntGatherTorque() };
}
// Girilen kinematikten tork yük durumlarını (ileri/geri) kur. Eksikse boş döner.
// İleri = 1. vites (en yüksek redüksiyon), geri = Geri vites. T_shaft çekirdeğin
// torqueChain'i ile hesaplanır; Tx = −T_shaft (SPEC T5 işaret düzeni).
function _mntTorqueCases(torque){
  var C=veMountCore; if(!C || !C.torqueChain) return [];
  var tq=torque||{};
  var Te=_mntNum(tq.Te,0), Rstall=_mntNum(tq.Rstall,0), g1=_mntNum(tq.g1,0), gR=_mntNum(tq.gR,0);
  var iTr=_mntNum(tq.iTransfer,1); if(iTr===0) iTr=1;
  var phiF=_mntNum(tq.phiFwd,1); if(phiF===0) phiF=1;
  var phiR=_mntNum(tq.phiRev,1); if(phiR===0) phiR=1;
  var der=_mntNum(tq.derate,1); if(der===0) der=1;
  if(!(Te>0 && Rstall>0 && g1!==0)) return [];
  var cases=[];
  var Tfwd=C.torqueChain({Te:Te, Rstall:Rstall, iGear:g1, iTransfer:iTr, phiAxle:phiF, derate:der});
  cases.push({name:'Forward Torque', n:[0,0,-1], T:[-Tfwd,0,0]});
  if(gR!==0){
    var Trev=C.torqueChain({Te:Te, Rstall:Rstall, iGear:gR, iTransfer:iTr, phiAxle:phiR, derate:der});
    cases.push({name:'Reverse Torque', n:[0,0,-1], T:[-Trev,0,0]});
  }
  return cases;
}

// Kriter 3 — HER tanımlı vites için ayrı tork durumu (mount kuvvetleri kontrolü).
// _mntTorqueCases yalnız 1. vitesi (maks tork) ana matrise koyar; bu ise g1..g6 +
// geri için ayrı durumlar döndürür. Kütle/rijitlik sabit, yalnız T_shaft vites
// oranıyla ölçeklenir → yüksek vites daha düşük kuvvet (1. vites bağlayıcıdır).
// Dönüş öğeleri gearLabel/ratio/Tshaft meta verisini taşır (rapor §8.9 tablosu).
function _mntGearTorqueCases(torque){
  var C=veMountCore; if(!C || !C.torqueChain) return [];
  var tq=torque||{};
  var Te=_mntNum(tq.Te,0), Rstall=_mntNum(tq.Rstall,0);
  var iTr=_mntNum(tq.iTransfer,1); if(iTr===0) iTr=1;
  var phiF=_mntNum(tq.phiFwd,1); if(phiF===0) phiF=1;
  var phiR=_mntNum(tq.phiRev,1); if(phiR===0) phiR=1;
  var der=_mntNum(tq.derate,1); if(der===0) der=1;
  if(!(Te>0 && Rstall>0)) return [];
  var out=[];
  ['g1','g2','g3','g4','g5','g6'].forEach(function(k,i){
    var gr=_mntNum(tq[k],0); if(gr===0) return;
    var Ts=C.torqueChain({Te:Te, Rstall:Rstall, iGear:gr, iTransfer:iTr, phiAxle:phiF, derate:der});
    out.push({name:(i+1)+'. Vites', gearLabel:(i+1)+'. Vites', ratio:gr, Tshaft:Ts, n:[0,0,-1], T:[-Ts,0,0]});
  });
  var gR=_mntNum(tq.gR,0);
  if(gR!==0){
    var Tr=C.torqueChain({Te:Te, Rstall:Rstall, iGear:gR, iTransfer:iTr, phiAxle:phiR, derate:der});
    out.push({name:'Geri Vites', gearLabel:'Geri', ratio:gR, Tshaft:Tr, n:[0,0,-1], T:[-Tr,0,0]});
  }
  return out;
}
// UI (mm/kg/N/mm) → SI. Yük durumları: 6 otomatik g-durumu + (kinematik
// girildiyse) ileri/geri tork durumları.
function _mntToSI(gather, g){
  var C=veMountCore;
  return {
    g: g||9.81,
    components: gather.components.map(function(c){ return {
      name:c.name||'kütle', mass:_mntNum(c.mass,0),
      cg:[C.mmToM(_mntNum(c.cgx)),C.mmToM(_mntNum(c.cgy)),C.mmToM(_mntNum(c.cgz))],
      I:[[_mntNum(c.Ixx),_mntNum(c.Ixy),_mntNum(c.Ixz)],[_mntNum(c.Ixy),_mntNum(c.Iyy),_mntNum(c.Iyz)],[_mntNum(c.Ixz),_mntNum(c.Iyz),_mntNum(c.Izz)]],
      pointMass:!!c.pointMass }; }),
    mounts: gather.mounts.map(function(m){
      var mnt={
        name:m.name||'takoz', pos:[C.mmToM(_mntNum(m.x)),C.mmToM(_mntNum(m.y)),C.mmToM(_mntNum(m.z))],
        kstat:[C.nPerMmToNPerM(_mntNum(m.kxs)),C.nPerMmToNPerM(_mntNum(m.kys)),C.nPerMmToNPerM(_mntNum(m.kzs))],
        kdyn:[C.nPerMmToNPerM(_mntNum(m.kxd)),C.nPerMmToNPerM(_mntNum(m.kyd)),C.nPerMmToNPerM(_mntNum(m.kzd))] };
      // Nonlineer yasa → çekirdek. Eksen başına FİT (analitik) ÖNCELİKLİ: mm/N olarak
      // AYNEN geçer (çekirdek makeAxisLaw mm↔m dönüşümünü yapar). Yoksa nokta tablosu:
      // burada SI'ya (δ mm→m, f N aynı) çevrilir. Çekirdek mnt.fits/mnt.curves okur.
      var fits={}, curves={};
      [['X','x'],['Y','y'],['Z','z']].forEach(function(ax){
        var f=m['fit'+ax[0]];
        if(f && (f.form==='poly'||f.form==='asym')){ fits[ax[1]]=f; return; }
        var src=m['curve'+ax[0]];
        if(Array.isArray(src) && src.length>=2){
          curves[ax[1]]=src.map(function(p){ return [C.mmToM(_mntNum(p[0])), _mntNum(p[1])]; });
        }
      });
      if(Object.keys(fits).length) mnt.fits=fits;
      if(Object.keys(curves).length) mnt.curves=curves;
      return mnt; }),
    loadCases: MNT_AUTO_CASES.concat(_mntTorqueCases(gather.torque))
  };
}

// Sönüm oranı varsayılanı — TEK doğruluk kaynağı çekirdektir (veMountCore
// .DEFAULT_ZETA). Çağrı anında okunur ki modül yükleme sırasına bağlı olmasın;
// çekirdek yoksa (test izolasyonu) aynı değere düşer.
function _mntZetaDefault(){
  var C=(typeof veMountCore!=='undefined')?veMountCore:null;
  return (C && C.DEFAULT_ZETA>0) ? C.DEFAULT_ZETA : 0.02;
}
// Çözücü düğümünden geçerli ζ (girilmemiş/geçersiz → varsayılan).
function _mntZetaOf(solver){
  var v = solver && solver.data ? solver.data.zeta : undefined;
  var z = _mntNum(v, NaN);
  return (Number.isFinite(z) && z>=0 && z<1) ? z : _mntZetaDefault();
}

var _veMntLast=null;      // son sonuç (kopyala/CSV/3D için)
function getMntSolverPropertiesHTML(node){
  if(!node.data) node.data={};
  if(!node.data.matrixMode) node.data.matrixMode='delta';
  if(!node.data.solveMode) node.data.solveMode='auto';
  var html='<div class="sw-panel">';
  html+='<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.4; margin-bottom:9px;">Tüm kütle ve takozlar otomatik algılanır; yük durumları otomatik uygulanır.</div>';
  // ── Çözüm Modu: nonlineer eğrilerin kullanılıp kullanılmayacağını AÇIKÇA seç ──
  var _sm=node.data.solveMode||'auto';
  html+='<div style="margin-bottom:10px;">';
  html+='<div style="font-size:var(--fs-micro); font-weight:600; color:var(--text-secondary); margin-bottom:4px;">Çözüm Modu</div>';
  html+='<select onchange="veMntSetSolveMode(\''+node.id+'\',this.value)" style="width:100%; padding:6px 8px; font-size:var(--fs-tiny); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
  [['auto','Otomatik — eğri tanımlıysa nonlineer'],
   ['nonlinear','Nonlineer — tanımlı eğrileri kullan (Newton)'],
   ['linear','Lineer — eğrileri yok say (statik rijitlik)']
  ].forEach(function(o){ html+='<option value="'+o[0]+'"'+(_sm===o[0]?' selected':'')+'>'+o[1]+'</option>'; });
  html+='</select>';
  html+='<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.4; margin-top:4px;">Nonlineer eğriler <b>Takoz Özellikleri</b>\'nde tanımlanır. Bu seçim yalnız ▶ Hesapla ile uygulanır.</div>';
  html+='</div>';
  // ── Sönüm oranı ζ: TÜM montaj için TEK değer (şirket kabulü) ──
  // Takoz başına ayrı girilmez; her takozun c katsayısı bundan türetilir
  // (çekirdek mountDamping: c = 2ζ√(k_dyn·m_pay)).
  var _z = (node.data.zeta==null || node.data.zeta==='') ? '' : node.data.zeta;
  var _zd = _mntZetaDefault();
  html+='<div style="margin-bottom:10px;">';
  html+='<div style="font-size:var(--fs-micro); font-weight:600; color:var(--text-secondary); margin-bottom:4px;">Sönüm Oranı ζ <span style="font-weight:400; color:var(--text-muted);">— tüm takozlar için tek değer</span></div>';
  html+='<input type="number" min="0" max="1" step="0.001" value="'+_mntEsc(_z)+'" placeholder="'+_mntFmt(_zd,3)+'" '
      + 'onchange="veMntSetZeta(\''+node.id+'\',this.value)" '
      + 'style="width:100%; padding:6px 8px; font-size:var(--fs-tiny); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right;">';
  html+='<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.4; margin-top:4px;">Şirket kabulü olarak tüm montaja uygulanır (boş → '+_mntFmt(_zd,3)+'). Her takozun sönüm katsayısı <b>c = 2ζ√(k<sub>din</sub>·m<sub>pay</sub>)</b> ile buradan türetilir; ayrıca girilmez. Raporda tablo olarak çıkar.</div>';
  html+='</div>';
  html+='<button onclick="veMntSolverCompute(\''+node.id+'\')" style="width:100%; margin-bottom:10px; padding:9px; font-size:var(--fs-md); font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; border-radius:var(--radius-sm);">▶ Hesapla</button>';
  html+='<div id="ve-mnt-results"></div>';
  html+='</div>';
  return html;
}

// Çözüm modu seç (auto/nonlinear/linear). Yeniden çizme YOK — sonuç korunur;
// seçim bir sonraki ▶ Hesapla'da uygulanır (hesap butona kilitli).
function veMntSetSolveMode(nodeId, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  node.data.solveMode=(val==='linear'||val==='nonlinear')?val:'auto';
  if(typeof saveState==='function') saveState();
}

// Sönüm oranı ζ (0 < ζ < 1). Boş/geçersiz → alan silinir, çözümde varsayılan
// (MNT_DEFAULT_ZETA) kullanılır. Yeniden çizme YOK — sonuç korunur; değer bir
// sonraki ▶ Hesapla'da uygulanır (çözüm modu ile aynı davranış).
function veMntSetZeta(nodeId, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  var s=(typeof val==='string')?val.trim():val;
  if(s===''||s==null){ delete node.data.zeta; }
  else {
    var z=_mntNum(s, NaN);
    if(Number.isFinite(z) && z>=0 && z<1) node.data.zeta=z;
  }
  if(typeof saveState==='function') saveState();
}

// ─── Çözüm hazırlığı (SYNC, DOM'suz) — gather→SI→mod→model + tek-durum çözücüsü ───
// Hem sync _mntComputeResults hem async (progress'li) veMntSolverCompute bunu kullanır;
// böylece iki yol da AYNI çözüm mantığını paylaşır. Dönüş: null (çözücü yok) |
// {error,gather} (validasyon) | prep nesnesi (solveOne/solveModes fonksiyonlarıyla).
function _mntPrepareSolve(solverId){
  var solver=nodes.find(function(n){return n.id===solverId;}); if(!solver) return null;
  var C=veMountCore;
  var gather=_mntGatherForSolver(solver);
  var si=_mntToSI(gather, 9.81);
  var problems=C.validateModel(si.components, si.mounts);
  if(problems.length) return { error:problems, gather:gather };
  var mp=C.combineMassProps(si.components);
  if(!mp) return { error:['Kütle hesaplanamadı (toplam ≤ 0).'], gather:gather };
  // Çözüm Modu: linear → nonlineer yasaları sıyır (saf lineer); nonlinear/auto → kullan.
  // HEM nokta tablosu (curves) HEM analitik fit (fits) sıyrılmalıdır: çekirdeğin
  // mountHasCurve'ü ikisine de bakar. Yalnız curves atılırsa, analitik fit taşıyan
  // takozda kullanıcı "Lineer" seçse bile solvedNL true kalır ve modal/enerji
  // bölümleri tanjant rijitlikten üretilir — yani seçilmeyen model raporlanır.
  var mode=(solver.data && solver.data.solveMode) || 'auto';
  var mounts=si.mounts;
  if(mode==='linear'){
    mounts=si.mounts.map(function(m){
      if(!m.curves && !m.fits) return m;
      var c={}; Object.keys(m).forEach(function(k){ if(k!=='curves' && k!=='fits') c[k]=m[k]; }); return c;
    });
  }
  var solvedNL=(typeof C.anyCurve==='function') && C.anyCurve(mounts);   // fiilen nonlineer mi
  var Kstat=C.buildK(mounts,mp.cg,false);
  var prep={
    C:C, solver:solver, gather:gather, si:si, mp:mp, mode:mode, mounts:mounts,
    solvedNL:solvedNL, nlNoCurve:(mode==='nonlinear' && !solvedNL),
    zeta:_mntZetaOf(solver),               // şirket kabulü — tüm montaja tek değer
    loadCases:si.loadCases, gearDefs:_mntGearTorqueCases(gather.torque),
    designDefs:[ {name:'3.5g Düşey',       n:[ 0,0,-3.5], T:[0,0,0]},
                 {name:'1g Yanal',         n:[ 0,1,-1  ], T:[0,0,0]},
                 {name:'1g Boyuna (fren)', n:[-1,0,-1  ], T:[0,0,0]} ]
  };
  // Tek yük durumu çözücüsü — solveAllCases yönlendirmesiyle AYNI: solvedNL → Newton
  // (solveCaseNL), değilse metal-metal durdurucu (solveCaseStop). onIter (ops.) yalnız
  // nonlineer yolda anlamlı: her Newton adımının residual normunu bildirir (progress).
  prep.solveOne=function(lc, onIter){
    var res = solvedNL
      ? C.solveCaseNL(mounts, mp.cg, mp.m, si.g, lc, {useStop:true, onIter:onIter})
      : C.solveCaseStop(Kstat, mounts, mp.cg, mp.m, si.g, lc, {useStop:true});
    return res ? {name:lc.name, loadCase:lc, res:res}
               : {name:lc.name, loadCase:lc, res:null, error:'K matrisi singular/çözülemedi (montaj kinematik olarak serbest olabilir).'};
  };
  // Modal — nonlineerde statik dengedeki (Static) tanjant rijitlik; değilse K_dyn.
  // Modal çözüm. Kullanılan M6 ve K matrisi prep'e SAKLANIR: modal enerji
  // (genelleştirilmiş kütle/rijitlik) ve mod başına sönüm oranı, modları üreten
  // AYNI matrislerden hesaplanmalı — yoksa k_gen/m_gen = ω² özdeşliği bozulur.
  prep.solveModes=function(allCases){
    var M6=C.buildM6(mp.m, mp.I_G);
    prep.M6=M6;
    if(solvedNL){
      var qStat=(allCases[0] && allCases[0].res) ? allCases[0].res.q : null;
      prep.Kmodal=C.buildKtangentDyn(mounts, mp.cg, qStat);
      // Sönüm de AYNI tabandan: c = 2ζ√(k·m) içindeki k, modal frekansı üreten
      // dinamik tanjant olmalı. Nominal k_dyn kullanılırsa sertleşen takozda
      // ζ_mod = φᵀCφ/(2ωφᵀMφ) sistematik olarak kayar (√(k_dyn/k_tan) kadar).
      prep.kBasis=(typeof C.mountTangentKdyn==='function') ? C.mountTangentKdyn(mounts, mp.cg, qStat) : null;
    } else {
      prep.Kmodal=C.buildK(mounts, mp.cg, true);
      prep.kBasis=null;                        // lineerde tanjant == nominal k_dyn
    }
    return C.solveModal(prep.Kmodal, M6, mounts, mp.cg);
  };
  return prep;
}

// prep + çözülmüş durumlar → R (ve _veMntLast). Sync ve async yol AYNI R'yi üretir.
function _mntAssembleR(prep, allCases, modes, gearCases, designCases){
  var R={ mp:prep.mp, allCases:allCases, mounts:prep.mounts, modes:modes, gather:prep.gather,
          gearCases:gearCases, designCases:designCases, g:prep.si.g,
          matrixMode:((prep.solver.data&&prep.solver.data.matrixMode)||'delta'), solveMode:prep.mode,
          solvedNL:prep.solvedNL, nlNoCurve:prep.nlNoCurve, solverId:prep.solver.id,
          zeta:prep.zeta };
  // ── Takoz sönüm katsayıları — TEK ζ'den türetilir (çekirdek mountDamping).
  // Yük payı STATİK durumdan alınır; Static çözülemediyse damping null kalır
  // (yük payı bilinmeden c türetilemez — uydurma değer üretilmez).
  var C=prep.C, stat=null;
  for(var i=0;i<(allCases||[]).length;i++){ if(allCases[i] && allCases[i].name==='Static'){ stat=allCases[i]; break; } }
  R.loadShares = (stat && stat.res && C.mountLoadShares) ? C.mountLoadShares(stat.res, prep.si.g) : null;
  R.damping    = (R.loadShares && C.mountDamping) ? C.mountDamping(prep.mounts, R.loadShares, prep.zeta, prep.kBasis) : null;
  R.kBasisTangent = !!prep.kBasis;                         // rapor notu: c hangi k'den türedi
  R.components = prep.si.components;                       // modal enerji gövde dağılımı için
  // ── Sönümlü modal + modal enerji ──────────────────────────────────────────
  // Modları üreten AYNI M6/K ile hesaplanır (prep.solveModes bunları saklar).
  // Farklı bir K kullanılırsa k_gen/m_gen = ω² özdeşliği bozulur ve modal enerji
  // moda ait olmayan bir rijitliği raporlar. Matrisler yoksa (modal çözülmediyse)
  // alanlar null kalır — uydurma sayı üretilmez.
  if(modes && modes.length && prep.M6 && prep.Kmodal){
    if(R.damping && C.buildCdamp && C.modalDampingRatios){
      R.C6 = C.buildCdamp(prep.mounts, prep.mp.cg, R.damping);
      R.modalDamping = C.modalDampingRatios(modes, prep.M6, R.C6);
    }
    if(C.modalEnergy) R.modalEnergy = C.modalEnergy(modes, prep.M6, prep.Kmodal, prep.si.components, prep.mp.cg);
  }
  _veMntLast=R;
  return R;
}

// Hesap çekirdeği — DOM'DAN BAĞIMSIZ, SYNC. _veMntLast'i üretir, döner.
// {error:[...]} (validasyon) | {mp,allCases,mounts,modes,gather,...} | null
// (Canlı ilerleme çubuğu için async sürüm veMntSolverCompute; AYNI R'yi üretir.)
function _mntComputeResults(solverId){
  var prep=_mntPrepareSolve(solverId); if(!prep) return null;
  if(prep.error){ _veMntLast=null; return { error:prep.error, gather:prep.gather }; }
  var allCases=prep.loadCases.map(function(lc){ return prep.solveOne(lc); });
  var modes=prep.solveModes(allCases);
  var gearCases=prep.gearDefs.length ? prep.gearDefs.map(function(lc){ return prep.solveOne(lc); }) : [];
  var designCases=prep.designDefs.map(function(lc){ return prep.solveOne(lc); });
  return _mntAssembleR(prep, allCases, modes, gearCases, designCases);
}

// ─── İlerleme çubuğu yardımcıları ────────────────────────────────────────────
// Bir sonraki boyamaya bırak (progress bar görünür olsun) + küçük gecikme.
function _mntYield(){
  return new Promise(function(resolve){
    if(typeof requestAnimationFrame==='function') requestAnimationFrame(function(){ setTimeout(resolve, 24); });
    else setTimeout(resolve, 0);
  });
}
function _mntSci(x){
  if(!Number.isFinite(x)) return '—';
  var a=Math.abs(x);
  return (a===0) ? '0' : (a>=100 || a<0.1) ? x.toExponential(1) : x.toFixed(2);
}
// Yük durumu için iterasyon/durum etiketi (progress alt satırı).
function _mntCaseIterLabel(rc, prep){
  if(!rc || !rc.res) return 'çözülemedi';
  var ck=rc.res.checks||{};
  if(prep.solvedNL){
    var it=ck.newtonIters||1;
    return 'Newton '+it+' iter'+((ck.converged===false)?' ⚠':' ✓');
  }
  return 'lineer'+((ck.clampCount>0)?(' · '+ck.clampCount+' durdurucu'):'');
}
// İlerleme çubuğu HTML'i (async çözüm sırasında #ve-mnt-results'a basılır).
function _mntSolverProgressHTML(done, total, label, sub, prep){
  var pct=Math.max(0, Math.min(100, Math.round(100*done/Math.max(1,total))));
  var accent=prep.solvedNL ? 'var(--accent-danger)' : 'var(--accent-primary)';
  var modeTxt=prep.solvedNL ? 'Nonlineer · Newton-Raphson' : 'Lineer';
  var h='<div style="padding:11px 12px; border:1px solid var(--border-color); background:var(--bg-secondary); border-radius:6px;">';
  h+='<div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom:6px;">'
    + '<span style="font-size:var(--fs-body); font-weight:700; color:var(--text-heading);">Çözülüyor…</span>'
    + '<span style="font-size:var(--fs-micro); color:var(--text-muted);">'+done+' / '+total+' · %'+pct+'</span></div>';
  h+='<div style="height:8px; background:var(--bg-tertiary); border-radius:4px; overflow:hidden;">'
    + '<div style="height:100%; width:'+pct+'%; background:'+accent+'; transition:width 0.12s linear;"></div></div>';
  h+='<div style="margin-top:6px; font-size:var(--fs-tiny); color:var(--text-secondary); display:flex; justify-content:space-between; gap:8px;">'
    + '<span style="font-weight:600;">'+_mntEsc(label)+'</span>'
    + '<span style="color:var(--text-muted);">'+_mntEsc(sub||'')+'</span></div>';
  h+='<div style="margin-top:3px; font-size:var(--fs-micro); color:var(--text-muted);">'+modeTxt+' · '+(prep.mounts?prep.mounts.length:0)+' takoz</div>';
  h+='</div>';
  return h;
}

// Çözücüyü çalıştır → #ve-mnt-results'a önce CANLI İLERLEME ÇUBUĞU, sonra KOMPAKT
// DURUM bas. ASYNC: yük durumlarını adım adım çözüp ilerlemeyi (ve nonlineerde her
// durumun Newton iterasyon sayısını) canlı gösterir. Ayrıntılı sonuç → Rapor.
// Hesap yalnız bu fonksiyonla (▶ Hesapla) koşar.
async function veMntSolverCompute(solverId){
  var out=(typeof document!=='undefined') ? document.getElementById('ve-mnt-results') : null;
  var prep=_mntPrepareSolve(solverId);
  if(!prep){ if(out) out.innerHTML=''; return null; }
  if(prep.error){ _veMntLast=null; var Rerr={ error:prep.error, gather:prep.gather };
    if(out) out.innerHTML=_mntSolverStatusHTML(Rerr); return Rerr; }
  var total=prep.loadCases.length + prep.gearDefs.length + prep.designDefs.length + 1; // +modal
  var done=0;
  function step(label, sub){ done++; if(out) out.innerHTML=_mntSolverProgressHTML(done, total, label, sub, prep); }
  var worst={ iters:0, name:'', trace:null };   // en çok iterasyon yapan durum (residual izi)
  // 1) Ana yük durumları — nonlineerde her durumun Newton residual izini yakala
  var allCases=[];
  for(var i=0;i<prep.loadCases.length;i++){
    var lc=prep.loadCases[i], trace=[];
    var rc=prep.solveOne(lc, prep.solvedNL ? function(iter, res){ trace.push(res); } : null);
    allCases.push(rc);
    var it=(rc.res && rc.res.checks && rc.res.checks.newtonIters) || 0;
    if(prep.solvedNL && it>worst.iters){ worst={ iters:it, name:lc.name, trace:trace.slice() }; }
    step(lc.name, _mntCaseIterLabel(rc, prep));
    await _mntYield();
  }
  // 2) Vites tork durumları (Kriter 3)
  var gearCases=[];
  for(var gi=0; gi<prep.gearDefs.length; gi++){
    var glc=prep.gearDefs[gi], grc=prep.solveOne(glc);
    gearCases.push(grc); step(glc.name, _mntCaseIterLabel(grc, prep)); await _mntYield();
  }
  // 3) Tasarım yük durumları (Kriter 4)
  var designCases=[];
  for(var di=0; di<prep.designDefs.length; di++){
    var dlc=prep.designDefs[di], drc=prep.solveOne(dlc);
    designCases.push(drc); step(dlc.name, _mntCaseIterLabel(drc, prep)); await _mntYield();
  }
  // 4) Modal analiz
  var modes=prep.solveModes(allCases);
  step('Modal analiz', prep.solvedNL ? 'tanjant rijitlik' : 'K_dyn'); await _mntYield();
  var R=_mntAssembleR(prep, allCases, modes, gearCases, designCases);
  R._worstIter=worst;   // profesyonel yakınsama özeti için
  if(out) out.innerHTML=_mntSolverStatusHTML(R);
  return R;
}

// Kompakt çözüm durumu — büyük sonuç dökümü değil. Model çözüldüyse özet
// (kütle/CG + kütle/takoz/durum/mod sayıları) + varsa mühendislik notları
// (çekme, durdurucu, ±10 mm aşımı, modal f≈0, yakınsama). Ayrıntı → Rapor.
function _mntSolverStatusHTML(R){
  if(R.error){
    return '<div style="padding:10px 12px; background:color-mix(in srgb, var(--accent-warning) 12%, transparent); border:1px solid var(--accent-warning); color:var(--accent-warning); font-size:var(--fs-body); line-height:1.5;"><b>Çözülemedi — eksik/geçersiz girdi:</b><ul style="margin:6px 0 0 16px; padding:0;">'
      + R.error.map(function(p){return '<li>'+_mntEsc(p)+'</li>';}).join('')
      + '</ul><div style="margin-top:6px; color:var(--text-muted);">İç topolojide Kütle ve Takoz bileşenleri bulunmalı ve geçerli değerler girilmelidir.</div></div>';
  }
  var mp=R.mp, cgmm=mp.cg.map(function(v){return v*1000;});
  var nC=(R.gather && R.gather.components ? R.gather.components.length : 0);
  var nM=(R.mounts||[]).length, nCase=(R.allCases||[]).length, nMode=(R.modes||[]).length;
  // Durum-bazında uyarı toplulaştırması.
  var failed=0, notConv=0, tension=0, clamp=0, overlin=0;
  (R.allCases||[]).forEach(function(rc){
    if(!rc.res){ failed++; return; }
    var ck=rc.res.checks||{};
    if(ck.converged===false || ck.stopConverged===false) notConv++;
    if(ck.tensionCount>0) tension++;
    if(ck.clampCount>0) clamp++;
    if(ck.overLinearCount>0) overlin++;
  });
  var modalWarn=(R.modes||[]).filter(function(m){return m && m.warning;}).length;

  var h='<div style="padding:9px 11px; border:1px solid var(--accent-success); background:color-mix(in srgb, var(--accent-success) 10%, transparent); border-radius:5px;">';
  h+='<div style="display:flex; align-items:baseline; gap:7px; flex-wrap:wrap; font-size:var(--fs-body); font-weight:700; color:var(--accent-success);"><span>✓ Çözüldü</span>'
    + '<span style="font-weight:400; color:var(--text-muted); font-size:var(--fs-micro);">'+nC+' kütle · '+nM+' takoz · '+nCase+' yük durumu · '+nMode+' mod</span></div>';
  h+='<div style="margin-top:5px; font-size:var(--fs-tiny); color:var(--text-secondary); line-height:1.5;">'
    + 'Toplam kütle <b style="color:var(--text-primary);">'+_mntFmt(mp.m,1)+' kg</b> · '
    + 'CG (<b style="color:var(--text-primary);">'+_mntFmt(cgmm[0],0)+', '+_mntFmt(cgmm[1],0)+', '+_mntFmt(cgmm[2],0)+'</b>) mm</div>';
  var modeLbl = R.solveMode==='linear' ? 'Lineer — eğriler yok sayıldı'
    : R.solveMode==='nonlinear' ? (R.solvedNL ? 'Nonlineer (Newton)' : 'Nonlineer seçildi — eğri yok, lineer')
    : (R.solvedNL ? 'Otomatik → Nonlineer (Newton)' : 'Otomatik → Lineer');
  h+='<div style="margin-top:4px; font-size:var(--fs-micro); color:var(--text-muted);">Çözüm modu: <b style="color:'+(R.solvedNL?'var(--accent-danger)':'var(--text-secondary)')+';">'+_mntEsc(modeLbl)+'</b></div>';
  if(Number.isFinite(R.zeta)){
    var _dOk=(R.damping&&R.damping.length);
    h+='<div style="margin-top:3px; font-size:var(--fs-micro); color:var(--text-muted);">Sönüm oranı: <b style="color:var(--text-secondary);">ζ = '+_mntFmt(R.zeta,3)+'</b>'
      + (_dOk ? ' · '+R.damping.length+' takozun c katsayısı türetildi'
              : ' <span style="color:var(--accent-warning);">· statik durum çözülemedi, c türetilemedi</span>')+'</div>';
  }
  h+='</div>';

  var warns=[];
  if(R.nlNoCurve) warns.push(['ℹ', 'Nonlineer seçildi ama hiç eğri tanımlı değil → lineer çözüldü. Takoz Özellikleri\'nden z-eğrisi ekleyin.', 'var(--accent-warning)']);
  if(failed)    warns.push(['✗', failed+' yük durumu çözülemedi (K tekil)', 'var(--accent-danger)']);
  if(notConv)   warns.push(['⚠', notConv+' durumda çözücü yakınsamadı', 'var(--accent-danger)']);
  if(tension)   warns.push(['⟂', tension+' durumda çekme / lift-off', 'var(--accent-warning)']);
  if(clamp)     warns.push(['▢', clamp+' durumda metal-metal durdurucu', 'var(--accent-warning)']);
  if(overlin)   warns.push(['~', overlin+' durumda ±10 mm lineer bandı aşıldı', 'var(--accent-warning)']);
  if(modalWarn) warns.push(['♪', modalWarn+' modda f≈0 (serbest mod) uyarısı', 'var(--accent-warning)']);
  if(warns.length){
    h+='<div style="margin-top:8px; padding:8px 10px; border:1px solid var(--border-color); background:var(--bg-secondary); border-radius:5px; font-size:var(--fs-tiny); line-height:1.65; color:var(--text-secondary);">';
    h+='<div style="font-weight:700; color:var(--text-heading); margin-bottom:2px; font-size:var(--fs-tiny);">Notlar</div>';
    warns.forEach(function(w){ h+='<div><span style="display:inline-block; width:14px; color:'+w[2]+';">'+w[0]+'</span>'+_mntEsc(w[1])+'</div>'; });
    h+='</div>';
  }

  // ── Yakınsama özeti (yalnız nonlineer): en çok iterasyon + residual izi ──
  if(R.solvedNL){
    var maxIt=0, maxName='';
    (R.allCases||[]).forEach(function(rc){
      var it=rc.res && rc.res.checks && rc.res.checks.newtonIters;
      if(it>maxIt){ maxIt=it; maxName=rc.name; }
    });
    if(maxIt>0){
      h+='<div style="margin-top:8px; padding:8px 10px; border:1px solid var(--accent-danger); background:rgba(239,68,68,0.06); border-radius:5px; font-size:var(--fs-micro); line-height:1.6; color:var(--text-secondary);">';
      h+='<div style="font-weight:700; color:var(--text-heading); font-size:var(--fs-tiny); margin-bottom:2px;">Yakınsama · Newton-Raphson</div>';
      h+='En çok iterasyon: <b style="color:var(--text-primary);">'+maxIt+'</b> ('+_mntEsc(maxName)+' durumu).';
      var tr=(R._worstIter && R._worstIter.trace && R._worstIter.trace.length) ? R._worstIter.trace : null;
      if(tr){
        h+='<div style="margin-top:3px;">Artık ‖r‖: <span style="font-family:monospace; color:var(--text-primary);">'
          + tr.map(function(v){ return _mntSci(v); }).join(' → ')+'</span> N</div>';
      }
      h+='</div>';
    }
  }
  h+='<div style="margin-top:8px; font-size:var(--fs-micro); color:var(--text-muted); line-height:1.45;">Ayrıntılı sonuçlar (çökme matrisi, mod şekilleri, kriter değerlendirmesi) için <b>Rapor</b> bileşenini kullanın.</div>';
  return h;
}

// ─── Render yardımcıları ─────────────────────────────────────────────────────
// (Not: çözücü panelindeki büyük sonuç dökümü — δz matrisi, modal tablosu,
//  Kopyala/CSV — kaldırıldı; sonuçlara Rapor bileşeninden bakılır. _mntMxTh/
//  _mntMxTd hâlâ Takoz Özellikleri kütüphane tablolarında kullanılıyor.)
function _mntMxTh(){ return 'padding:3px 5px; border:1px solid var(--border-color); color:var(--text-secondary); font-weight:600; text-align:center;'; }
function _mntMxTd(){ return 'padding:3px 5px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);'; }

// (📐 Matematik paneli kaldırıldı — istek üzerine tamamen silindi.)

// ─── Tam ekran overlay (3D / 2D görünümleri büyütmek için) ───────────────────
// Büyük, esnek bir overlay: başlık + kapat (X/Esc) + içerik alanı. onMount(body)
// DOM eklendikten sonra çağrılır; onClose kapanışta.
function _mntFsOverlay(title, innerHTML, onMount, onClose){
  var old=document.getElementById('ve-mnt-fs'); if(old) old.remove();
  var ov=document.createElement('div'); ov.id='ve-mnt-fs';
  ov.style.cssText='position:fixed; inset:0; z-index:100045; background:rgba(0,0,0,0.72); display:flex; align-items:center; justify-content:center; padding:2vh 2vw;';
  var box=document.createElement('div');
  box.style.cssText='width:96vw; height:94vh; max-width:1600px; display:flex; flex-direction:column; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:10px; box-shadow:0 24px 70px rgba(0,0,0,0.6); overflow:hidden;';
  function close(){ document.removeEventListener('keydown', onKey); try{ if(onClose) onClose(); }catch(e){} ov.remove(); }
  function onKey(e){ if(e.key==='Escape') close(); }
  box.innerHTML='<div style="display:flex; align-items:center; gap:10px; padding:11px 16px; border-bottom:1px solid var(--border-color); background:var(--bg-tertiary); flex-shrink:0;"><span style="font-weight:700; font-size:var(--fs-title); color:var(--text-heading);">'+title+'</span><div style="flex:1;"></div><button id="ve-mnt-fs-x" title="Kapat (Esc)" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:var(--fs-h2); line-height:1;">✕</button></div>'
    +'<div id="ve-mnt-fs-body" style="flex:1; min-height:0; position:relative; display:flex; flex-direction:column;">'+innerHTML+'</div>';
  ov.appendChild(box); document.body.appendChild(ov);
  ov.addEventListener('mousedown', function(e){ if(e.target===ov) close(); });
  document.getElementById('ve-mnt-fs-x').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  if(onMount){ try{ onMount(document.getElementById('ve-mnt-fs-body')); }catch(e){} }
}
// 3D Görüntüleyici'yi (model modu) tam ekran aç. Koordinat Düzlemi'nde tam ekran yok.
function veMntViewerFullscreen(){
  var toggles = _mntVwrBtn("var v=veMountViewerToggle('grid'); this.style.opacity=v?'1':'0.45';",'Zemin','Zemin', false)
    + _mntVwrBtn("var v=veMountViewerToggle('axes'); this.style.opacity=v?'1':'0.45';",'Eksen','Eksen')
    + _mntVwrBtn("var v=veMountViewerToggle('labels'); this.style.opacity=v?'1':'0.45';",'Etiket','Etiket');
  var bar='<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; padding:8px 14px; flex-shrink:0; border-bottom:1px solid var(--border-color);">'
    + toggles + _mntVwrBtn("veMountViewerReset();",'⟳ Sıfırla','Sıfırla')
    + '<span style="flex:1;"></span><span style="font-size:var(--fs-micro); color:var(--text-muted);">Sol tık döndür · sağ tık kaydır · tekerlek yakınlaş · fare ile bileşen bilgisi</span></div>';
  var wrap='<div style="flex:1; min-height:0; position:relative; background:var(--bg-primary);"><canvas id="ve-mnt-fs-canvas" style="width:100%; height:100%; display:block;"></canvas></div>';
  _mntFsOverlay('3D Görüntüleyici', bar+wrap,
    function(){ if(typeof _mntGatherForSolver==='function') _veMntViewerData=_mntGatherForSolver();
      if(typeof veMountViewerInit==='function'){ try{ veMountViewerInit('ve-mnt-fs-canvas', 'model'); veMountViewerUpdate(); }catch(e){} } },
    function(){ if(typeof veMountViewerDispose==='function'){ try{ veMountViewerDispose(); }catch(e){} }
      veMntViewerRefresh(); }
  );
}

// 3D viewer veri sağlayıcısı (cp-mount-viewer.js okur)
var _veMntViewerData = null;

// Node/Jest için dışa aç
if(typeof module!=='undefined' && module.exports){
  module.exports = {
    getMntModulePropertiesHTML: getMntModulePropertiesHTML,
    getMntMassPropertiesHTML: getMntMassPropertiesHTML,
    getMntMountPropertiesHTML: getMntMountPropertiesHTML,
    getMntLibraryPropertiesHTML: getMntLibraryPropertiesHTML,
    getMntSolverPropertiesHTML: getMntSolverPropertiesHTML,
    veMntSetSolveMode: veMntSetSolveMode,
    veMntSetZeta: veMntSetZeta,
    _mntZetaDefault: _mntZetaDefault,
    _mntZetaOf: _mntZetaOf,
    veMntApplyEnginePreset: veMntApplyEnginePreset,
    _mntEnginePresetValues: _mntEnginePresetValues,
    _mntEnginePresetSelect: _mntEnginePresetSelect,
    _mntEngineSection: _mntEngineSection,
    _mntComputeResults: _mntComputeResults,
    getMntExamplePropertiesHTML: getMntExamplePropertiesHTML,
    getMntViewerPropertiesHTML: getMntViewerPropertiesHTML,
    getMntCoordFramePropertiesHTML: getMntCoordFramePropertiesHTML,
    getMnt2DViewPropertiesHTML: getMnt2DViewPropertiesHTML,
    _mnt2DGather: _mnt2DGather,
    _mnt2DViewSVG: _mnt2DViewSVG,
    VE_MOUNT_LIBRARY: VE_MOUNT_LIBRARY,
    veMntGetLibraryMap: veMntGetLibraryMap,
    veMntGetLibraryList: veMntGetLibraryList,
    veMntApplyLib: veMntApplyLib,
    veMntLibCurveToggle: veMntLibCurveToggle,
    veMntLibCurveEnable: veMntLibCurveEnable,
    veMntLibCurveDisable: veMntLibCurveDisable,
    veMntLibCurveSetPoint: veMntLibCurveSetPoint,
    veMntLibCurveAddPoint: veMntLibCurveAddPoint,
    veMntLibCurveRemovePoint: veMntLibCurveRemovePoint,
    veMntLibAdd: veMntLibAdd,
    veMntLibRemove: veMntLibRemove,
    veMntLibSet: veMntLibSet,
    veMntLibSetBuiltin: veMntLibSetBuiltin,
    veMntLibResetBuiltin: veMntLibResetBuiltin,
    veMntLibSelect: veMntLibSelect,
    MNT_AUTO_CASES: MNT_AUTO_CASES,
    VE_MNT_STARTER_LAYOUT: VE_MNT_STARTER_LAYOUT,
    veMntPopulateStarter: veMntPopulateStarter,
    veMntExportTopology: veMntExportTopology,
    veMntDecorateConnections: veMntDecorateConnections,
    _mntWireSupportLinks: _mntWireSupportLinks,
    _mntTopoState: _mntTopoState,
    _mntResolveTopology: _mntResolveTopology,
    _mntLoadExampleFromJSON: _mntLoadExampleFromJSON,
    _mntExampleReg: _mntExampleReg,
    _mntExampleList: _mntExampleList,
    _mntExampleLayout: _mntExampleLayout,
    _mntExampleDiagramSVG: _mntExampleDiagramSVG,
    _mntExampleBodyType: _mntExampleBodyType,
    _mntComputeSupportLinks: _mntComputeSupportLinks,
    _mntPtoConflict: _mntPtoConflict,
    _MNT_PTO_REF: _MNT_PTO_REF,
    _mntExampleValidate: _mntExampleValidate,
    _mntGatherForSolver: _mntGatherForSolver,
    _mntGatherTorque: _mntGatherTorque,
    _mntTorqueCases: _mntTorqueCases,
    _mntGearTorqueCases: _mntGearTorqueCases,
    _mntToSI: _mntToSI,
    _mntFitForce: _mntFitForce,
    _mntDeflColor: _mntDeflColor,
    _mntForceColor: _mntForceColor
  };
}
