// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ BAŞLANGIÇ SİHİRBAZI — çizim masası
// ════════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-10-14): *"Takoz modülüne de 'Başlangıç Sihirbazı',
// 'STEP dosyadan başlama' ve 'Boş kanvas' gibi özellikler kuracağız. Aynı FEAD
// modülünün başlangıcı nasılsa, aynısını istiyorum."*
//
// KURALLAR:
//  • KENDİ MODELİNİ KURMAZ. Durum → `veMntWizNodes` → Takoz düğüm listesi;
//    masadaki 2B görünüş, canlı denetim ve "Modeli kur" AYNI listeden geçer.
//    Canlı denetim Çözücü'nün kendi yolu (`_mntPrepareFrom`, cp-mount.js):
//    "model çözülüyor" hükmü kurulan modelde Çözücü'nün vereceği hükmün ta
//    kendisi — ikinci bir "önizleme çözücüsü" sessizce ayrışırdı.
//  • SONUÇ GÖSTERMEZ (kullanıcı kararı 2026-10-16: "kullanıcı sadece detaylı
//    sonuç raporu ile yetinecek"): canlı denetim yalnız modelin ÇÖZÜLEBİLİR
//    olduğunu söyler; sehim, takoz yükü ve doğal frekanslar raporda.
//  • GÖRÜNÜM FEAD SİHİRBAZININ KABUĞUNDAN (`.ve-fw-*`): aynı ray, masa, denetim
//    sütunu ve alt çubuk; Takoz'a özgü birkaç kural `.ve-mw-*`. Kullanıcı
//    "aynısını" istedi; kopya bir kabuk ilk rötuşta ayrışırdı.
//  • MASA düz görünüş çizicisini okur (`veMnt2DGorunusSVG`, gerçek oranda),
//    tork adımında zincirin çarpanlarını çekirdekten (`torqueChain`).
//  • KATALOG BİR ÖNERİ, KISIT DEĞİL (FEAD kural 17): takoz kataloğu ve motor
//    kataloğu alanları doldurur; değer katalogdan farklıysa "elle" yazılır.
//    Takoz kataloğunun yazıcısı panelle TEK (`_mntLibUygula`).
//  • BİR KURULUM = BİR GERİ-AL ADIMI (`veStateBatch`); Ctrl+Z kurulumdan önceki
//    modele (boş topolojide başlangıç sayfasına) döner.
//  • TUVALDE MODEL VARSA SİHİRBAZ ONDAN TOHUMLANIR ve "Modeli kur" bir
//    UYGULAMA'dır: tuvaldeki düğümler yerinde güncellenir (konum ve ad
//    korunur), yeniler eklenir, listeden çıkarılanlar silinir. Tuvalde model
//    yoksa yarım taslak modül düğümü başına OTURUMLUK tutulur.
//  • AÇIKLAMA YÜZEYİ YOK (FEAD kural 45 · 47): yönerge `title`da, kutuda durum.

var VE_MW_STEPS = [
  { key:'kaynak', ad:'Başlangıç',       ipucu:'STEP dosyası · örnekten doldur · tuvaldeki model' },
  { key:'govde',  ad:'Kütle gövdeleri', ipucu:'Motor · şanzıman · braket — kütle, ağırlık merkezi, atalet' },
  { key:'takoz',  ad:'Takozlar',        ipucu:'Konum · katalog · statik ve dinamik rijitlik' },
  { key:'tork',   ad:'Tork ve çalışma', ipucu:'Motor torku · vites oranları · rölanti ve silindir' },
  { key:'ozet',   ad:'Özet ve kurulum', ipucu:'Kurulacaklar · modelin özeti · modeli kur' }
];
// Kütle gövdesi tipleri — Bileşenler'in "Takoz alt bileşenleri" ve "PTO
// grubu" sırasıyla. Ad componentDefs'ten okunur.
var VE_MW_GOVDE_TIPLERI = ['mnt-motor', 'mnt-gearbox', 'mnt-transfer', 'mnt-shaft', 'mnt-bracket',
                           'mnt-pto', 'mnt-pump', 'mnt-pto-group'];
var VE_MW_GOVDE_ALAN = ['mass', 'cgx', 'cgy', 'cgz', 'Ixx', 'Iyy', 'Izz', 'Ixy', 'Ixz', 'Iyz', 'pointMass'];
var VE_MW_TAKOZ_ALAN = ['x', 'y', 'z', 'kxs', 'kys', 'kzs', 'kxd', 'kyd', 'kzd', 'maxLoad', 'libKey',
                        'fitX', 'fitY', 'fitZ', 'curveX', 'curveY', 'curveZ'];
// Tork zinciri alanları ve onları TAŞIYAN gövde (Motor / Şanzıman / Transfer
// panelinin bölümleriyle aynı yer). Toplayıcı (`_mntGatherTorque`) alanı hangi
// gövdede bulursa okur; dağıtım yalnız panelde doğru yerde görünsün diye.
// Örnekte ayrı Transfer gövdesi yoksa transfer alanları Şanzıman'da durur.
var VE_MW_TORK = [
  { grup:'motor',    alan:['Te', 'TeRpm', 'Pmax', 'PmaxRpm', 'idleRpm', 'cylinders', 'enginePreset'], tip:['mnt-motor'] },
  { grup:'sanziman', alan:['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'gR', 'Rstall'], tip:['mnt-gearbox', 'mnt-transfer', 'mnt-motor'] },
  { grup:'transfer', alan:['iTransfer', 'phiFwd', 'phiRev', 'derate'], tip:['mnt-transfer', 'mnt-gearbox', 'mnt-motor'] }
];

var _mwState = null;          // oturumluk durum (açık sihirbazın)
var _mwStep = 0;
var _mwSeq = 0;               // satır anahtarı üreteci
var _mwSec = { govde:null, takoz:null };   // seçili satır (anahtar)
var _mwGorunus = 'ust';       // masanın görünüşü: 'ust' | 'yan' | 'on'
var _mwGor = {};              // masa görünümü, görünüş başına: { z, tx, ty }
var _mwCoz = null;            // son canlı çözüm
var _mwLiveTimer = null;
var _mwTaslaklar = {};        // modül düğümü kimliği → taslak (oturumluk; tuvalde model yokken)
var _mwMasaOlcu = { w:640, h:560 };
var _mwMasaRO = null;
var _mwKaydir = null;         // masada sürükleme süreci

// ── YARDIMCILAR ────────────────────────────────────────────────────────────
function _mwEsc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
// Girdi metni (makine biçimi — js/sayi-alan.js) ya da sayı → sayı; boş → NaN.
function _mwNum(v){
  if(v === undefined || v === null || v === '') return NaN;
  var n = Number(typeof v === 'string' ? v.trim().replace(',', '.') : v);
  return Number.isFinite(n) ? n : NaN;
}
function _mwVar(v){ return Number.isFinite(_mwNum(v)); }
// Takoz ekranları GERÇEK EKSİ yazar (`_mntS`, cp-mount.js): aynı değer
// Çözücü'de "−18.482", sihirbazda "-18.482" görünüyordu.
function _mwSayi(x, d){ return veSayi(x, d, { eksi:'−' }); }
function _mwFmt(x, d){ return Number.isFinite(x) ? _mwSayi(x, d === undefined ? 1 : d) : '—'; }
function _mwAd(tip){ return ((typeof componentDefs !== 'undefined' && componentDefs[tip]) || {}).name || tip; }
function _mwDef(n){ return (typeof componentDefs !== 'undefined' && n && componentDefs[n.type]) || (n && n.def) || {}; }
function _mwKopya(o){ return (o === undefined) ? undefined : JSON.parse(JSON.stringify(o)); }
function _mwKey(on){ return on + (++_mwSeq); }
function _mwAdimNo(key){
  for(var i = 0; i < VE_MW_STEPS.length; i++) if(VE_MW_STEPS[i].key === key) return i + 1;
  return 0;
}
function _mwIkon(ad){ return (typeof veIkon === 'function') ? veIkon(ad) : ''; }

// ── DURUM ─────────────────────────────────────────────────────────────────
function veMntWizDefault(){ return { govdeler:[], takozlar:[], tork:{} }; }
function veMntWizState(){ return _mwState; }

// Anahtar üreteci durumdaki en büyük anahtarın üstünden devam eder: yoksa yeni
// satır eski bir satırla aynı anahtarı alır ve seçim ona kayardı.
function _mwSeqDuzelt(st){
  (st.govdeler || []).concat(st.takozlar || []).forEach(function(r){
    var n = parseInt(String(r.key).replace(/^[a-z]+/, ''), 10);
    if(Number.isFinite(n) && n > _mwSeq) _mwSeq = n;
  });
}

function _mwGovdeYeni(tip){
  return { key:_mwKey('g'), type:tip, ad:_mwAd(tip),
           pointMass: (typeof _MNT_POINTMASS_DEFAULT !== 'undefined') ? !!_MNT_POINTMASS_DEFAULT[tip] : false };
}
function _mwTakozYeni(ad){ return { key:_mwKey('t'), ad:ad || ('Takoz ' + ((_mwState ? _mwState.takozlar.length : 0) + 1)) }; }

// DÜĞÜM LİSTESİNDEN DURUM — tuvaldeki model, örneğin JSON'u ve STEP aktarımı
// aynı yoldan. Tork alanları gövdelerden toplanır (ilk dolu değer —
// `_mntGatherTorque` ile aynı kural) ve gövde satırına YAZILMAZ.
function veMntWizFromNodes(liste, opt){
  opt = opt || {};
  var st = veMntWizDefault();
  (liste || []).forEach(function(n){
    var d = _mwDef(n), data = n.data || {};
    var ad = n.customName || d.name || n.type;
    if(d.isMountBody){
      var g = { key:_mwKey('g'), type:n.type, ad:ad };
      VE_MW_GOVDE_ALAN.forEach(function(k){ if(data[k] !== undefined && data[k] !== '') g[k] = _mwKopya(data[k]); });
      if(g.pointMass === undefined)
        g.pointMass = (typeof _MNT_POINTMASS_DEFAULT !== 'undefined') ? !!_MNT_POINTMASS_DEFAULT[n.type] : false;
      if(opt.dugum && n.id) g._dugum = n.id;
      st.govdeler.push(g);
    } else if(d.isMount){
      var t = { key:_mwKey('t'), ad:ad };
      VE_MW_TAKOZ_ALAN.forEach(function(k){ if(data[k] !== undefined && data[k] !== '' && data[k] !== null) t[k] = _mwKopya(data[k]); });
      if(opt.dugum && n.id) t._dugum = n.id;
      st.takozlar.push(t);
    }
  });
  VE_MW_TORK.forEach(function(gr){
    gr.alan.forEach(function(k){
      for(var i = 0; i < (liste || []).length; i++){
        var n = liste[i];
        if(!_mwDef(n).isMountBody) continue;
        var v = (n.data || {})[k];
        if(v !== undefined && v !== null && v !== ''){ st.tork[k] = _mwKopya(v); break; }
      }
    });
  });
  return st;
}

// ── DURUMDAN DÜĞÜM LİSTESİ ─────────────────────────────────────────────────
// Kanvas yerleşimi güç grubunun ÜSTTEN görünüşünü izler (VE_MNT_STARTER_LAYOUT'un
// düzeni): sağ takozlar (y > 0) üst sırada, gövdeler ve ortadaki takozlar orta
// sırada, sol takozlar alt sırada; sıra içinde fiziksel x'e göre. Araç şeridi
// en üstte (ly = 20) — referans yerleşimle aynı satırlar.
var VE_MW_SIRA = { sag:190, orta:320, sol:450 };
var VE_MW_ARALIK = 118;
function _mwYerlesim(st){
  var ogeler = [];
  st.govdeler.forEach(function(g){ ogeler.push({ key:g.key, x:_mwNum(g.cgx), y:_mwNum(g.cgy), sira:'orta' }); });
  st.takozlar.forEach(function(t){
    var y = _mwNum(t.y);
    ogeler.push({ key:t.key, x:_mwNum(t.x), y:y,
                  sira: !Number.isFinite(y) || Math.abs(y) < 1 ? 'orta' : (y > 0 ? 'sag' : 'sol') });
  });
  var xs = ogeler.map(function(o){ return o.x; }).filter(Number.isFinite);
  var x0 = xs.length ? Math.min.apply(null, xs) : 0, x1 = xs.length ? Math.max.apply(null, xs) : 0;
  var yer = {};
  ['sag', 'orta', 'sol'].forEach(function(s){
    var sira = ogeler.filter(function(o){ return o.sira === s; });
    sira.forEach(function(o, i){
      o.lx = (Number.isFinite(o.x) && x1 > x0) ? 60 + (o.x - x0) / (x1 - x0) * 840 : 60 + i * VE_MW_ARALIK;
    });
    sira.sort(function(a, b){ return a.lx - b.lx; });
    var son = -Infinity;
    sira.forEach(function(o){
      if(o.lx < son + VE_MW_ARALIK) o.lx = son + VE_MW_ARALIK;
      son = o.lx;
      yer[o.key] = { lx:Math.round(o.lx), ly:VE_MW_SIRA[s] };
    });
  });
  return yer;
}

// Sayı alanı → düğüm verisi: sayı, boşsa alan YAZILMAZ (boş metin ile 0 aynı şey değil).
function _mwVeriYaz(hedef, kaynak, alanlar){
  alanlar.forEach(function(k){
    var v = kaynak[k];
    if(v === undefined || v === null || v === '') return;
    if(typeof v === 'object' || typeof v === 'boolean') hedef[k] = _mwKopya(v);
    else if(k === 'libKey' || k === 'enginePreset') hedef[k] = String(v);
    else { var n = _mwNum(v); if(Number.isFinite(n)) hedef[k] = n; }
  });
  return hedef;
}

// Döner: [{ type, customName, data, lx, ly, rol:'govde'|'takoz', key, _dugum }]
// Tork alanları VE_MW_TORK'un tercih ettiği gövdeye dağıtılır.
function veMntWizNodes(st){
  st = st || _mwState || veMntWizDefault();
  var yer = _mwYerlesim(st), out = [];
  st.govdeler.forEach(function(g){
    out.push({ type:g.type, customName:g.ad || _mwAd(g.type), rol:'govde', key:g.key, _dugum:g._dugum,
               lx:(yer[g.key] || {}).lx, ly:(yer[g.key] || {}).ly,
               data:_mwVeriYaz({ pointMass:!!g.pointMass }, g, VE_MW_GOVDE_ALAN) });
  });
  VE_MW_TORK.forEach(function(gr){
    var hedef = null;
    for(var i = 0; i < gr.tip.length && !hedef; i++)
      hedef = out.filter(function(n){ return n.type === gr.tip[i]; })[0] || null;
    if(!hedef) hedef = out[0] || null;
    if(hedef) _mwVeriYaz(hedef.data, st.tork || {}, gr.alan);
  });
  st.takozlar.forEach(function(t){
    out.push({ type:'mnt-mount', customName:t.ad || 'Takoz', rol:'takoz', key:t.key, _dugum:t._dugum,
               lx:(yer[t.key] || {}).lx, ly:(yer[t.key] || {}).ly,
               data:_mwVeriYaz({}, t, VE_MW_TAKOZ_ALAN) });
  });
  return out;
}

// ── DOĞRULAMA — adım başına (rayın rozeti, uyarı kutusu, alt çubuk) ─────────
// Kural çözücünün kapısıyla aynı (veMountCore.validateModel): kütle > 0,
// rijitliğin altı ekseni > 0; 6 serbestlik derecesi için aynı doğru üzerinde
// olmayan en az üç takoz.
function veMntWizSorunlar(st){
  st = st || _mwState || veMntWizDefault();
  var l = [];
  var ek = function(adim, tur, m){ l.push({ adim:adim, tur:tur, m:m }); };
  if(!st.govdeler.length) ek('govde', 'err', 'Kütle gövdesi yok — en az bir gövde gerekir.');
  st.govdeler.forEach(function(g){
    var ad = g.ad || _mwAd(g.type);
    if(!(_mwNum(g.mass) > 0)) ek('govde', 'err', ad + ': kütle eksik.');
    if(!_mwVar(g.cgx) || !_mwVar(g.cgy) || !_mwVar(g.cgz)) ek('govde', 'err', ad + ': ağırlık merkezi eksik.');
    if(!g.pointMass && !['Ixx', 'Iyy', 'Izz'].some(function(k){ return _mwNum(g[k]) > 0; }))
      ek('govde', 'warn', ad + ': atalet tensörü girilmedi — gövde nokta kütle gibi çözülür.');
  });
  var pto = st.govdeler.filter(function(g){ return g.type === 'mnt-pto-group'; }).length;
  var parca = st.govdeler.filter(function(g){ return g.type === 'mnt-pto' || g.type === 'mnt-pump'; }).length;
  if(pto && parca) ek('govde', 'warn', 'PTO Toplam ile ayrı PTO/Pompa gövdeleri birlikte — aynı kütle iki kez sayılıyor olabilir.');

  var n = st.takozlar.length;
  if(!n) ek('takoz', 'err', 'Takoz yok — en az üç takoz gerekir.');
  else if(n < 3) ek('takoz', 'err', n + ' takoz var — 6 serbestlik dereceli denge için en az üç takoz gerekir.');
  st.takozlar.forEach(function(t){
    var ad = t.ad || 'Takoz';
    if(!_mwVar(t.x) || !_mwVar(t.y) || !_mwVar(t.z)) ek('takoz', 'err', ad + ': konum eksik.');
    if(!['kxs', 'kys', 'kzs'].every(function(k){ return _mwNum(t[k]) > 0; })) ek('takoz', 'err', ad + ': statik rijitlik eksik.');
    if(!['kxd', 'kyd', 'kzd'].every(function(k){ return _mwNum(t[k]) > 0; })) ek('takoz', 'err', ad + ': dinamik rijitlik eksik.');
  });
  // Mekanizma: çözücünün kapısıyla AYNI kural ve cümle (çekirdek, birimden bağımsız)
  var C = (typeof veMountCore !== 'undefined') ? veMountCore : null;
  if(n >= 3 && C && C.collinearPoints && st.takozlar.every(function(t){ return _mwVar(t.x) && _mwVar(t.y) && _mwVar(t.z); })){
    var mek = C.mechanismProblem(C.collinearPoints(st.takozlar.map(function(t){ return [_mwNum(t.x), _mwNum(t.y), _mwNum(t.z)]; })), n);
    if(mek) ek('takoz', 'err', mek);
  }

  var tq = st.tork || {};
  if(!(_mwNum(tq.Te) > 0)) ek('tork', 'warn', 'Motor torku yok — tork yük durumları kurulmaz.');
  else if(!(_mwNum(tq.Rstall) > 0) || !_mwNum(tq.g1)) ek('tork', 'warn', 'Tork zinciri eksik (stall oranı · 1. vites) — tork yük durumları kurulmaz.');
  if(!(_mwNum(tq.idleRpm) > 0) || !(_mwNum(tq.cylinders) > 0))
    ek('tork', 'warn', 'Rölanti ya da silindir sayısı yok — ateşleme frekansı hesaplanmaz; Kriter 1 ve 2 değerlendirilemez.');
  return l;
}

// ── CANLI DENETİM — Çözücü'nün yolu ────────────────────────────────────────
// Statik denge Çözücü'nün yoluyla çözülür; yalnız HÜKÜM döner (ok · hata):
// model kurulursa çözülür mü. Sayılar (sehim, yük, mod) sihirbazda yok.
// Döner: { liste, veri (2B), sorun[], ok, hata[], mp, fAtes, tork:{ileri, geri} }
function veMntWizCoz(st){
  st = st || _mwState || veMntWizDefault();
  var liste = veMntWizNodes(st);
  var out = { liste:liste, veri:(typeof _mnt2DGather === 'function') ? _mnt2DGather(liste) : { comps:[], mounts:[], cg:null },
              sorun:veMntWizSorunlar(st), ok:false, hata:[] };
  var tq = st.tork || {};
  var idle = _mwNum(tq.idleRpm), cyl = _mwNum(tq.cylinders);
  out.fAtes = (idle > 0 && cyl > 0) ? (idle / 60) * (cyl / 2) : NaN;
  var C = (typeof veMountCore !== 'undefined') ? veMountCore : null;
  if(C && C.torqueChain){
    var Te = _mwNum(tq.Te), Rs = _mwNum(tq.Rstall), g1 = _mwNum(tq.g1), gR = _mwNum(tq.gR);
    var iTr = _mwNum(tq.iTransfer) || 1, pf = _mwNum(tq.phiFwd) || 1, pr = _mwNum(tq.phiRev) || 1, der = _mwNum(tq.derate) || 1;
    if(Te > 0 && Rs > 0 && g1){
      out.tork = { ileri:C.torqueChain({ Te:Te, Rstall:Rs, iGear:g1, iTransfer:iTr, phiAxle:pf, derate:der }) };
      if(gR) out.tork.geri = C.torqueChain({ Te:Te, Rstall:Rs, iGear:gR, iTransfer:iTr, phiAxle:pr, derate:der });
    }
  }
  var engel = out.sorun.some(function(s){ return s.tur === 'err' && (s.adim === 'govde' || s.adim === 'takoz'); });
  if(engel || typeof _mntPrepareFrom !== 'function' || typeof _mntGatherForSolver !== 'function') return out;
  try {
    var prep = _mntPrepareFrom(_mntGatherForSolver(null, liste), { data:{} });
    if(!prep || prep.error){ out.hata = (prep && prep.error) || ['Model çözüme hazırlanamadı.']; return out; }
    out.mp = prep.mp;
    var stat = prep.solveOne(MNT_AUTO_CASES[0]);
    if(!stat || !stat.res){
      out.hata = [(stat && stat.error) || 'Statik denge çözülemedi — montaj kinematik olarak serbest olabilir.'];
      return out;
    }
    out.ok = true;
  } catch(e){ out.hata = ['Çözüm hatası: ' + e.message]; }
  return out;
}

function veMntWizIssues(c, step){
  var k = (VE_MW_STEPS[step] || {}).key;
  var l = (c && c.sorun || []).filter(function(s){ return s.adim === k; });
  if(k === 'ozet' && c && c.hata && c.hata.length) l = l.concat(c.hata.map(function(m){ return { adim:'ozet', tur:'err', m:m }; }));
  // ÇÖZÜLMEYEN MODELİN ÖZETİ "TAMAM" DEĞİL: önceki bir adımdaki eksik çözümü
  // durdurunca (`veMntWizCoz` → engel) hata listesi boş kalıyordu ve rayda
  // özet ✓ taşıyordu — panel "Çözülemiyor" derken. Engel tek satır: hangi
  // adımlarda olduğunu söyler, eksikleri ikinci kez saymaz.
  if(k === 'ozet' && c && !c.ok && !(c.hata && c.hata.length)){
    var engel = VE_MW_STEPS.filter(function(s){
      return (c.sorun || []).some(function(x){ return x.tur === 'err' && x.adim === s.key; });
    }).map(function(s){ return s.ad; });
    if(engel.length) l = l.concat([{ adim:'ozet', tur:'err',
      m:'Model çözülemiyor — ' + engel.join(' ve ') + ' adımındaki eksikler giderilince çözülür.' }]);
  }
  return l;
}
function veMntWizStepState(c, step){
  var e = 0, w = 0;
  veMntWizIssues(c, step).forEach(function(s){ if(s.tur === 'err') e++; else w++; });
  return { durum: e ? 'err' : (w ? 'warn' : 'ok'), err:e, warn:w };
}

// ── AÇ / KAPAT ─────────────────────────────────────────────────────────────
function _mwModulId(){
  return (typeof veMntStack !== 'undefined' && veMntStack.length) ? veMntStack[veMntStack.length - 1].nodeId : '_';
}
function _mwTuvalModeli(){
  return (typeof nodes !== 'undefined' && nodes || []).filter(function(n){
    var d = _mwDef(n); return d.isMountBody || d.isMount;
  });
}
// TOHUM SIRASI: tuvaldeki model (sihirbaz onu düzenler) → bu modülün oturum
// taslağı → boş. Tek kural, giriş yolundan bağımsız (başlangıç sayfası ya da
// "Başlangıç ve Örnekler" penceresi).
function veMntWizAc(){
  if(typeof document === 'undefined') return false;
  var ov = document.getElementById('ve-mntwiz-overlay');
  if(!ov) return false;
  var tuval = _mwTuvalModeli();
  if(tuval.length){
    _mwState = veMntWizFromNodes(nodes, { dugum:true });
    _mwState.seededFrom = 'tuval';
  } else if(_mwTaslaklar[_mwModulId()]){
    _mwState = _mwKopya(_mwTaslaklar[_mwModulId()]);
  } else {
    _mwState = veMntWizDefault();
  }
  _mwSeqDuzelt(_mwState);
  if(_mwStp && _mwStp.modul !== _mwModulId()) _mwStp = null;
  _mwStep = 0; _mwSec = { govde:null, takoz:null }; _mwGor = {}; _mwKaydir = null;
  ov.style.display = 'flex';
  document.addEventListener('keydown', veMntWizKey);
  veMntWizRender();
  return true;
}
// STEP KAPISI: sihirbaz 1. adımda açılır ve dosya seçici AYNI tıklamanın
// içinde açılır (tarayıcı kullanıcı hareketi ister); açılamazsa kart yerinde.
function veMntWizAcStep(){
  if(!veMntWizAc()) return false;
  try {
    var f = document.querySelector('#ve-mw-body .ve-mw-stp-file');
    if(f && typeof f.click === 'function') f.click();
  } catch(e){ /* dosya seçici açılamadı: kart yine görünür */ }
  return true;
}
function veMntWizAcik(){
  var ov = (typeof document !== 'undefined') ? document.getElementById('ve-mntwiz-overlay') : null;
  return !!(ov && ov.style.display !== 'none' && _mwState);
}
function veMntWizKapat(kaydet){
  if(typeof document === 'undefined') return;
  if(typeof veMntWiz3bKapat === 'function') veMntWiz3bKapat();
  var ov = document.getElementById('ve-mntwiz-overlay');
  if(ov) ov.style.display = 'none';
  document.removeEventListener('keydown', veMntWizKey);
  // TASLAK YALNIZ TUVAL BOŞKEN: tuvalde model varsa sihirbaz her açılışta ondan
  // tohumlanır, bir taslak onu gölgelerdi.
  if(kaydet !== false && _mwState && !_mwTuvalModeli().length) _mwTaslaklar[_mwModulId()] = _mwKopya(_mwState);
  if(_mwMasaRO){ try { _mwMasaRO.disconnect(); } catch(e){} _mwMasaRO = null; }
  // Gövde boşaltılır: kapalı pencerede `.ve-fw-*` öğeleri FEAD sihirbazınınkilerle
  // aynı belgede durmasın.
  ['ve-mw-nav', 've-mw-body', 've-mw-foot'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.innerHTML = '';
  });
  _mwState = null; _mwCoz = null;
}
function veMntWizKey(e){
  if(!e) return;
  if(e.key === 'Escape' && typeof veMntWiz3bAcik === 'function' && veMntWiz3bAcik()){ veMntWiz3bKapat(); return; }
  if(e.key === 'Escape'){ veMntWizKapat(true); return; }
  if(e.altKey && e.key === 'ArrowRight'){ e.preventDefault(); veMntWizGo(1); }
  if(e.altKey && e.key === 'ArrowLeft'){ e.preventDefault(); veMntWizGo(-1); }
}
function veMntWizGo(delta){ veMntWizGoto(_mwStep + delta); }
function veMntWizGoto(i){
  if(i < 0 || i >= VE_MW_STEPS.length || !_mwState) return;
  _mwStep = i;
  veMntWizRender();
  if(typeof document !== 'undefined'){
    var yan = document.getElementById('ve-mw-yan'); if(yan) yan.scrollTop = 0;
  }
}

// ── DURUM YAZICILARI ───────────────────────────────────────────────────────
// Yol: 'tork.Te' · 'govde.<anahtar>.mass' · 'takoz.<anahtar>.x'. `oninput`
// YALNIZ yazar ve canlı yamayı gecikmeli tazeler — tam yeniden çizim odağı
// düşürürdü (FEAD sihirbazında ölçülmüş sınıf).
function _mwSatir(tur, key){
  var l = _mwState ? (tur === 'govde' ? _mwState.govdeler : _mwState.takozlar) : [];
  for(var i = 0; i < l.length; i++) if(l[i].key === key) return l[i];
  return null;
}
function _mwSet(path, val){
  if(!_mwState) return;
  var p = String(path).split('.');
  if(p[0] === 'tork'){ _mwState.tork[p[1]] = val; }
  else {
    var r = _mwSatir(p[0], p[1]); if(!r) return;
    r[p[2]] = val;
    // Elle yazılan değer STEP'ten gelenin yerini alır: kaynak işareti düşer.
    if(r.kaynak){
      if(/^cg[xyz]$/.test(p[2])) delete r.kaynak.cg;
      if(/^I[xyz]{2}$/.test(p[2])) delete r.kaynak.I;
      if(/^[xyz]$/.test(p[2])) delete r.kaynak.konum;
    }
  }
  veMntWizLiveSoon();
}
function _mwSetRender(path, val){ _mwSet(path, val); veMntWizRender(); }

function veMntWizGovdeEkle(tip){
  if(!_mwState || VE_MW_GOVDE_TIPLERI.indexOf(tip) < 0) return null;
  var g = _mwGovdeYeni(tip);
  _mwState.govdeler.push(g);
  _mwSec.govde = g.key;
  veMntWizRender();
  return g;
}
function veMntWizGovdeSil(key){
  if(!_mwState) return;
  _mwState.govdeler = _mwState.govdeler.filter(function(g){ return g.key !== key; });
  if(_mwSec.govde === key) _mwSec.govde = null;
  veMntWizRender();
}
function veMntWizGovdeTip(key, tip){
  var g = _mwSatir('govde', key); if(!g || VE_MW_GOVDE_TIPLERI.indexOf(tip) < 0) return;
  // Ad tipin varsayılan adıysa tiple birlikte değişir; kullanıcının verdiği ad kalır.
  if(!g.ad || g.ad === _mwAd(g.type)) g.ad = _mwAd(tip);
  g.type = tip;
  veMntWizRender();
}
function veMntWizNokta(key, on){
  var g = _mwSatir('govde', key); if(!g) return;
  g.pointMass = !!on;
  veMntWizRender();
}
function veMntWizTakozEkle(){
  if(!_mwState) return null;
  var t = _mwTakozYeni();
  _mwState.takozlar.push(t);
  _mwSec.takoz = t.key;
  veMntWizRender();
  return t;
}
function veMntWizTakozSil(key){
  if(!_mwState) return;
  _mwState.takozlar = _mwState.takozlar.filter(function(t){ return t.key !== key; });
  if(_mwSec.takoz === key) _mwSec.takoz = null;
  veMntWizRender();
}
// Aynalı eş: y işareti döner, ad Sağ ↔ Sol. Takozlar çoğunlukla çift durur.
var _MW_AYNA = [['Sağ', 'Sol'], ['sağ', 'sol'], ['SAĞ', 'SOL'], ['Right', 'Left'], ['right', 'left']];
function _mwAynaAd(ad){
  var s = String(ad || '');
  for(var i = 0; i < _MW_AYNA.length; i++){
    var a = _MW_AYNA[i][0], b = _MW_AYNA[i][1];
    if(s.indexOf(a) >= 0) return s.split(a).join(b);
    if(s.indexOf(b) >= 0) return s.split(b).join(a);
  }
  return s + ' (eş)';
}
function veMntWizTakozAyna(key){
  var t = _mwSatir('takoz', key); if(!t || !(Math.abs(_mwNum(t.y)) >= 1)) return null;
  var e = _mwKopya(t);
  e.key = _mwKey('t'); delete e._dugum; delete e.kaynak;
  e.ad = _mwAynaAd(t.ad);
  e.y = -_mwNum(t.y);
  var i = _mwState.takozlar.indexOf(t);
  _mwState.takozlar.splice(i + 1, 0, e);
  _mwSec.takoz = e.key;
  veMntWizRender();
  return e;
}
// Takoz kataloğu — panelle TEK yazıcı (cp-mount.js → _mntLibUygula).
function veMntWizTakozKatalog(key, libKey){
  var t = _mwSatir('takoz', key); if(!t) return;
  if(!libKey){ delete t.libKey; veMntWizRender(); return; }
  if(typeof _mntLibUygula === 'function') _mntLibUygula(t, libKey);
  veMntWizRender();
}
// Katalog DEĞERİ ile satır arasında fark var mı (FEAD kural 17: "elle" demek
// için değer katalogdan farklı olmalı; yalnız "dolu mu" bakmak katalogun
// yazdığını kullanıcıya mal ederdi).
function veMntWizTakozElle(t){
  if(!t || !t.libKey || typeof veMntGetLibraryMap !== 'function') return false;
  var m = veMntGetLibraryMap()[t.libKey]; if(!m) return false;
  var es = [['kxs', 'sx'], ['kys', 'sy'], ['kzs', 'sz'], ['kxd', 'dx'], ['kyd', 'dy'], ['kzd', 'dz']];
  return es.some(function(e){ return Math.abs(_mwNum(t[e[0]]) - _mwNum(m[e[1]])) > 1e-9; });
}
// Motor kataloğu (Araç Performans motorları) — panelin değer okuyucusuyla aynı
// (cp-mount.js → _mntEnginePresetValues): tepe tork, devirler, rölanti.
function veMntWizMotorKatalog(key){
  if(!_mwState) return;
  if(!key){ delete _mwState.tork.enginePreset; veMntWizRender(); return; }
  var v = (typeof _mntEnginePresetValues === 'function') ? _mntEnginePresetValues(key) : null;
  if(!v) return;
  Object.keys(v).forEach(function(k){ _mwState.tork[k] = v[k]; });
  _mwState.tork.enginePreset = key;
  veMntWizRender();
}
function veMntWizSec(tur, key){
  if(tur !== 'govde' && tur !== 'takoz') return;
  _mwSec[tur] = key;
  veMntWizRender();
}
function veMntWizGorunus(g){
  if(!VE_MNT2D_GORUNUS[g]) return;
  _mwGorunus = g;
  veMntWizRender();
}

// ── ÖRNEKTEN DOLDUR ────────────────────────────────────────────────────────
// Örnek kaydının JSON topolojisi ("Örneği aktar"ın kurduğu düğümlerin
// kendisi) düğüm listesi olarak okunur; çözülemezse kaydın programatik modeli.
function _mwOrnekModelden(M){
  var liste = [];
  (M.components || []).forEach(function(c){
    var tip = c.kind || ((typeof _mntExampleBodyType === 'function') ? _mntExampleBodyType(c.name) : 'mnt-transfer');
    liste.push({ type:tip, customName:c.name, data:{ mass:c.mass, cgx:c.cg[0], cgy:c.cg[1], cgz:c.cg[2],
      Ixx:c.Ixx, Iyy:c.Iyy, Izz:c.Izz, Ixy:c.Ixy, Ixz:c.Ixz, Iyz:c.Iyz, pointMass:!!c.pointMass } });
  });
  (M.mounts || []).forEach(function(m){
    liste.push({ type:'mnt-mount', customName:m.name, data:{ x:m.pos[0], y:m.pos[1], z:m.pos[2],
      kxs:m.kstat[0], kys:m.kstat[1], kzs:m.kstat[2], kxd:m.kdyn[0], kyd:m.kdyn[1], kzd:m.kdyn[2] } });
  });
  var tq = M.torque || {}, ilk = liste[0];
  if(ilk){
    ['Te', 'Rstall', 'iTransfer', 'derate'].forEach(function(k){ if(tq[k] !== undefined) ilk.data[k] = tq[k]; });
    if(tq.fwd){ ilk.data.g1 = tq.fwd.iGear; ilk.data.phiFwd = tq.fwd.phiAxle; }
    if(tq.rev){ ilk.data.gR = tq.rev.iGear; ilk.data.phiRev = tq.rev.phiAxle; }
  }
  return liste;
}
function veMntWizOrnek(key, cb){
  if(!_mwState || typeof veMountCore === 'undefined') return false;
  var ex = veMountCore.getMountExample ? veMountCore.getMountExample(key) : null;
  if(!ex) return false;
  var uygula = function(liste){
    var st = veMntWizFromNodes(liste);
    st.seededFrom = ex.id;
    _mwState = st;
    _mwSec = { govde:null, takoz:null }; _mwGor = {};
    veMntWizRender();
    if(typeof cb === 'function') cb(st);
  };
  var modelden = function(){ uygula(_mwOrnekModelden(ex.model || {})); };
  if(ex.topology && typeof _mntResolveTopology === 'function'){
    _mntResolveTopology(ex.topology, function(state){
      if(state && state.nodes && state.nodes.length) uygula(state.nodes); else modelden();
    });
  } else modelden();
  return true;
}
function veMntWizOrnekSec(v){
  if(v === '__') return;
  if(v === ''){ veMntWizSifirla(); return; }
  veMntWizOrnek(v);
}
// ÖRNEKLER ARASINDA ↑ ↓ — listenin KENDİSİNDEN; "Boş başla" bir örnek değil
// bir silme eylemi, okla üstüne düşülmez (FEAD sihirbazının kuralı).
function veMntWizOrnekAdim(yon){
  var k = (typeof veMountCore !== 'undefined' && veMountCore.getMountExampleList)
    ? veMountCore.getMountExampleList().map(function(e){ return e.id; }) : [];
  if(!k.length || !_mwState) return null;
  var i = k.indexOf(String(_mwState.seededFrom === undefined ? '' : _mwState.seededFrom));
  var j = (i < 0) ? (yon > 0 ? 0 : k.length - 1) : i + (yon > 0 ? 1 : -1);
  if(j < 0 || j >= k.length) return null;
  veMntWizOrnek(k[j]);
  return k[j];
}
function veMntWizSifirla(){
  _mwState = veMntWizDefault();
  _mwState.seededFrom = '';
  _mwSec = { govde:null, takoz:null }; _mwGor = {};
  veMntWizRender();
}

// ── ÇİZİM ─────────────────────────────────────────────────────────────────
function veMntWizRender(){
  if(typeof document === 'undefined' || !_mwState) return;
  var c = _mwCoz = veMntWizCoz(_mwState);
  var nav = document.getElementById('ve-mw-nav');
  if(nav) nav.innerHTML = veMntWizNavHTML(c);
  var body = document.getElementById('ve-mw-body');
  if(body){
    var yan0 = document.getElementById('ve-mw-yan'), yy = yan0 ? yan0.scrollTop : 0;
    body.innerHTML = veMntWizStepHTML(_mwStep, c);
    var yan1 = document.getElementById('ve-mw-yan');
    if(yan1) yan1.scrollTop = Math.min(yy, Math.max(0, yan1.scrollHeight - yan1.clientHeight));
    _mwMasaBagla();
    _mwMasaCiz(c);
  }
  var foot = document.getElementById('ve-mw-foot');
  if(foot) foot.innerHTML = veMntWizFootHTML(c);
  if(typeof veMntWiz3bTazele === 'function') veMntWiz3bTazele();
}

// CANLI YAMA — form alanlarının DIŞINI tazeler (masa, çip, liste, uyarı,
// ray, alt çubuk); yazılan alanın odağı korunur.
function veMntWizLiveSoon(){
  if(typeof setTimeout !== 'function'){ veMntWizLive(); return; }
  if(_mwLiveTimer) clearTimeout(_mwLiveTimer);
  _mwLiveTimer = setTimeout(function(){ _mwLiveTimer = null; veMntWizLive(); }, 200);
}
function veMntWizLive(){
  if(typeof document === 'undefined' || !_mwState) return;
  var c = _mwCoz = veMntWizCoz(_mwState);
  var yama = function(id, html){ var el = document.getElementById(id); if(el) el.innerHTML = html; };
  yama('ve-mw-nav', veMntWizNavHTML(c));
  yama('ve-mw-issue', veMntWizIssueHTML(c, _mwStep));
  yama('ve-mw-foot-state', veMntWizFootStateHTML(c));
  yama('ve-mw-live', _mwCipIcHTML(c));
  var k = VE_MW_STEPS[_mwStep].key;
  if(k === 'govde') yama('ve-mw-liste', _mwGovdeListeHTML(c));
  if(k === 'takoz') yama('ve-mw-liste', _mwTakozListeHTML(c));
  if(k === 'tork') yama('ve-mw-tork-oku', _mwTorkOkuHTML(c));
  if(k === 'ozet') yama('ve-mw-yan', _mwStepOzet(c));
  var kur = document.getElementById('ve-mw-create');
  if(kur) kur.disabled = !veMntWizCanCreate().ok;
  _mwMasaCiz(c);
}

function veMntWizNavHTML(c){
  var h = '<ol class="ve-fw-steps">';
  VE_MW_STEPS.forEach(function(s, i){
    var d = veMntWizStepState(c, i);
    var rozet = (d.durum === 'ok')
      ? '<span class="ve-fw-step-n" title="Bu adımda eksik girdi yok.">' + _mwIkon('check') + '</span>'
      : '<span class="ve-fw-step-n" title="' + (s.key === 'ozet'
          ? _mwEsc(veMntWizIssues(c, i).map(function(x){ return x.m; }).join(' · '))
          : (d.err ? d.err + ' eksik girdi' : '') + (d.err && d.warn ? ' · ' : '') + (d.warn ? d.warn + ' uyarı' : ''))
        + '">' + (d.err || d.warn) + '</span>';
    h += '<li class="ve-fw-step ve-fw-st-' + d.durum + (i === _mwStep ? ' on' : '') + '" onclick="veMntWizGoto(' + i + ')" tabindex="0"'
      + ' onkeydown="if(event.key===\'Enter\'){veMntWizGoto(' + i + ');}">'
      + '<span class="ve-fw-step-no">' + (i + 1) + '</span>'
      + '<span class="ve-fw-step-t"><b>' + _mwEsc(s.ad) + '</b><em>' + _mwEsc(s.ipucu) + '</em></span>'
      + rozet + '</li>';
  });
  return h + '</ol>';
}

function veMntWizIssueHTML(c, step){
  var l = veMntWizIssues(c, step);
  if(!l.length) return '<div class="ve-fw-issues ve-fw-issues-ok">' + _mwIkon('check') + ' Bu adımda eksik girdi yok.</div>';
  var h = '<div class="ve-fw-issues">';
  l.forEach(function(it){
    h += '<div class="ve-fw-issue ve-fw-issue-' + it.tur + '">' + _mwIkon(it.tur === 'err' ? 'x' : 'alert-triangle')
      + ' ' + _mwEsc(it.m) + '</div>';
  });
  return h + '</div>';
}

function veMntWizFootStateHTML(c){
  var st = _mwState || veMntWizDefault();
  if(!st.govdeler.length && !st.takozlar.length) return '<span class="ve-fw-dim">model henüz boş</span>';
  var err = (c.sorun || []).filter(function(s){ return s.tur === 'err'; }).length + (c.hata || []).length;
  if(c.ok) return '<span class="ve-fw-ok">' + _mwIkon('check') + ' model çözülüyor — kurulmaya hazır</span>';
  return '<span class="ve-fw-err">' + err + ' eksik/çelişkili girdi — model yine kurulabilir</span>';
}
function veMntWizFootHTML(c){
  var son = (_mwStep === VE_MW_STEPS.length - 1);
  var kur = veMntWizCanCreate();
  var h = '<span id="ve-mw-foot-state" class="ve-fw-foot-state">' + veMntWizFootStateHTML(c) + '</span>';
  h += '<button type="button" class="ve-fw-btn" onclick="veMntWizKapat(true)">Kapat</button>';
  h += '<button type="button" class="ve-fw-btn"' + (_mwStep === 0 ? ' disabled' : '') + ' onclick="veMntWizGo(-1)">'
     + _mwIkon('arrow-left') + ' Geri</button>';
  if(!son) h += '<button type="button" class="ve-fw-btn ve-fw-btn-primary" onclick="veMntWizGo(1)">İleri ' + _mwIkon('arrow-right') + '</button>';
  else h += '<button type="button" id="ve-mw-create" class="ve-fw-btn ve-fw-btn-go"' + (kur.ok ? '' : ' disabled title="' + _mwEsc(kur.sebep) + '"')
     + ' onclick="veMntWizKur()">' + _mwIkon('settings') + ' Modeli kur</button>';
  return h;
}

// ── ADIM GÖVDELERİ ─────────────────────────────────────────────────────────
function veMntWizStepHTML(step, c){
  var s = VE_MW_STEPS[step] || VE_MW_STEPS[0];
  var yan = '';
  if(s.key === 'kaynak') yan = _mwStepKaynak(c);
  else if(s.key === 'govde') yan = _mwStepGovde(c);
  else if(s.key === 'takoz') yan = _mwStepTakoz(c);
  else if(s.key === 'tork') yan = _mwStepTork(c);
  else yan = _mwStepOzet(c);
  if(s.key !== 'ozet' && s.key !== 'kaynak') yan += '<div id="ve-mw-issue">' + veMntWizIssueHTML(c, step) + '</div>';
  return '<div class="ve-fw-masa-duzen" data-adim="' + s.key + '">'
    + _mwMasaHTML(s.key, c)
    + '<aside class="ve-fw-yan" id="ve-mw-yan" aria-label="' + _mwEsc(s.ad) + ' — girdiler">' + yan + '</aside>'
    + '</div>';
}

// `baslikHTML`: başlıkta birim/simge varsa (özet panelinde başlık BÜYÜK HARFLE
// yazılıyor, "1 g" → "1 G" oluyordu) birim `<u>` içinde verilir — CSS onu
// dönüştürmez (kökteki kural: BÜYÜK HARF DÖNÜŞÜMÜ BİRİMİ ÇEVİRMEZ).
function _mwCard(baslik, inner, baslikHTML){
  return '<section class="ve-fw-card"><header class="ve-fw-card-h"><span>' + (baslikHTML || _mwEsc(baslik)) + '</span></header>'
    + '<div class="ve-fw-card-b">' + inner + '</div></section>';
}
function _mwInp(path, v, opt){
  opt = opt || {};
  return '<input type="text"' + (opt.text ? '' : ' inputmode="decimal"') + ' class="ve-fw-inp"'
    + ' value="' + _mwEsc(v === undefined || v === null ? '' : v) + '"'
    + (opt.ph ? ' placeholder="' + _mwEsc(opt.ph) + '"' : '')
    + (opt.baslik ? ' aria-label="' + _mwEsc(opt.baslik) + '"' : '')
    + ' oninput="_mwSet(\'' + path + '\', this.value)">';
}
function _mwAlan(et, ic, sinif){
  return '<div class="ve-fw-ed-alan' + (sinif ? ' ' + sinif : '') + '"><span>' + et + '</span>' + ic + '</div>';
}
// Alanın STEP geometrisinden geldiğini söyleyen işaret — `.ve-fw-kun`un dili
// (künyeden gelen "K"): sebep `title`da.
var VE_MW_STEP_NOT = 'STEP geometrisinden — homojen yoğunluk varsayımı; ölçülen değeri yazınca işaret düşer';
function _mwKaynakIsaret(r, alan){
  return (r && r.kaynak && r.kaynak[alan]) ? '<sup class="ve-fw-kun" title="' + _mwEsc(VE_MW_STEP_NOT) + '">S</sup>' : '';
}

// ── 1 · BAŞLANGIÇ ─────────────────────────────────────────────────────────
function _mwStepKaynak(c){
  var st = _mwState, h = '';
  if(st.seededFrom === 'tuval'){
    h += _mwCard('Tuvaldeki model', '<div class="ve-fw-seeded">' + _mwIkon('check') + ' <b>Tuvaldeki model</b> yüklendi '
      + '<em>' + st.govdeler.length + ' gövde · ' + st.takozlar.length + ' takoz</em></div>');
  }
  h += _mwCard('STEP\'ten başla', _mwStpKartHTML());
  var liste = (typeof veMountCore !== 'undefined' && veMountCore.getMountExampleList) ? veMountCore.getMountExampleList() : [];
  var yuklu = (st.seededFrom === undefined || st.seededFrom === 'tuval' || st.seededFrom === 'step') ? null : st.seededFrom;
  var sec = '<select class="ve-fw-inp" onchange="veMntWizOrnekSec(this.value)" aria-label="Örnek">'
    + '<option value="__">' + (yuklu === null ? '— örnek seç —' : '— değiştir —') + '</option>';
  liste.forEach(function(ex){
    var M = ex.model || {};
    sec += '<option value="' + _mwEsc(ex.id) + '"' + (String(yuklu) === String(ex.id) ? ' selected' : '') + '>'
      + _mwEsc((ex.vehicle || ex.name) + '  ·  ' + (M.components || []).length + ' gövde · ' + (M.mounts || []).length + ' takoz') + '</option>';
  });
  sec += '<option value=""' + (yuklu === '' ? ' selected' : '') + '>Boş başla — bütün alanları temizler</option></select>';
  var ids = liste.map(function(e){ return e.id; });
  var sira = ids.indexOf(String(yuklu));
  var yok = (sira < 0);
  var gez = ids.length > 1 ? '<div class="ve-fw-seednav">'
    + '<button type="button" class="ve-fw-mini"' + (!yok && sira <= 0 ? ' disabled' : '') + ' title="' + (yok ? 'Son örnek' : 'Önceki örnek') + '" onclick="veMntWizOrnekAdim(-1)">' + _mwIkon('arrow-up') + '</button>'
    + '<button type="button" class="ve-fw-mini"' + (!yok && sira >= ids.length - 1 ? ' disabled' : '') + ' title="' + (yok ? 'İlk örnek' : 'Sonraki örnek') + '" onclick="veMntWizOrnekAdim(1)">' + _mwIkon('arrow-down') + '</button>'
    + '<span class="ve-fw-seednav-n">' + (sira >= 0 ? (sira + 1) + ' / ' + ids.length : '— / ' + ids.length) + '</span></div>' : '';
  var ex = (yuklu && typeof veMountCore !== 'undefined') ? veMountCore.getMountExample(yuklu) : null;
  var durum = (yuklu === null) ? '' : '<div class="ve-fw-seeded">' + _mwIkon('check') + ' <b>'
    + _mwEsc(ex ? (ex.vehicle || ex.name) : 'Boş başla') + '</b> yüklendi</div>';
  h += _mwCard('Örnekten doldur', '<label class="ve-fw-field"><span class="ve-fw-lbl">Örnek</span>' + sec + '</label>' + gez + durum);
  if(ex){
    var ih = ex.description ? '<div class="ve-fw-exnote">' + _mwEsc(ex.description) + '</div>' : '';
    if(ex.specs && ex.specs.length){
      ih += '<dl class="ve-fw-exspec">';
      ex.specs.forEach(function(r){ ih += '<dt>' + _mwEsc(r[0]) + '</dt><dd>' + _mwEsc(r[1]) + '</dd>'; });
      ih += '</dl>';
    }
    h += _mwCard('Seçilen örnek', ih);
  }
  return h;
}

// ── STEP'TEN BAŞLA (1. adımın kartı) ─────────────────────────────────────
// FEAD kural 34'ün kalıbı (js/mount-step.js'in başı): dosya okunur → rol 3B'de
// ya da kartın tablosunda verilir → "Konumları hesapla" YALNIZ rollü birimleri
// ölçer → gövdelerin kütlesi yazılır (STEP'te kütle yok) → "Sihirbaza aktar"
// kaydı örnek tohumunun yolundan yükler (veMntWizFromNodes).
// OTURUMLUK, KAYDEDİLMEZ: `_mwStp` okumanın çıktısını tutar ama taslağa
// girmez — dosya bir KAYNAK, ürünü sihirbaz durumu (izi `st.stepKaynak`).
// Kart modül düğümüne aittir: başka bir Takoz modülünde açılınca düşer.
var _mwStp = null;
// Kartın durumu — 3B görüntüleyici (js/cp-mount-3b.js) aynı nesneyi okur
function veMntWizStp(){ return _mwStp; }
var VE_MW_STP_KUTLE_NOT = 'STEP dosyasında kütle yok. Yazılırsa atalet tensörü katının şeklinden, homojen '
  + 'yoğunluk varsayımıyla türetilir; yazılmazsa gövde yalnız ağırlık merkeziyle aktarılır.';

// Dosya → metin → okuma. Okuma asenkron (File API); ayrıştırma bir kare SONRA
// — "okunuyor" durumu çizilmeden donmuş bir düğme görünmesin (FEAD'de ölçüldü:
// 8 MB'lık dosya ana iş parçacığını ~0,5 sn tutuyor).
function veMntWizStpDosya(dosya){
  if(!dosya) return null;
  var ad = dosya.name || 'STEP';
  _mwStp = { dosya:ad, durum:'okunuyor', modul:_mwModulId() };
  veMntWizRender();
  var oku = (typeof dosya.arrayBuffer === 'function') ? dosya.arrayBuffer()
    : new Promise(function(ok, red){
        var fr = new FileReader();
        fr.onload = function(){ ok(fr.result); };
        fr.onerror = function(){ red(fr.error || new Error('okunamadı')); };
        fr.readAsArrayBuffer(dosya);
      });
  return oku.then(function(buf){
    return new Promise(function(ok){ setTimeout(function(){ ok(veMntWizStpBayt(buf, ad)); }, 20); });
  }, function(e){
    _mwStp = { dosya:ad, durum:'hata', hata:'Dosya okunamadı: ' + ((e && e.message) || e), modul:_mwModulId() };
    veMntWizRender();
    return _mwStp;
  });
}
function veMntWizStpBayt(bayt, ad){
  var m;
  try {
    if(typeof veStepP21Metin !== 'function') throw new Error('STEP okuyucusu (js/step-p21.js) yüklenmemiş.');
    m = veStepP21Metin(bayt);
  } catch(e){
    _mwStp = { dosya:ad, durum:'hata', hata:(e && e.message) || String(e), modul:_mwModulId() };
    veMntWizRender();
    return _mwStp;
  }
  return veMntWizStpOku(m.metin, ad, m.kap);
}
// DOM'suz çekirdek: metin → kart durumu. Roller BOŞ açılır — ad hiçbir şeye
// karar vermez (FEAD kural 34); dosya okununca 3B görüntüleyici açılır.
function veMntWizStpOku(metin, ad, kap){
  var sonuc = (typeof veMntStpOku === 'function') ? veMntStpOku(metin)
    : { ok:false, hatalar:['Takoz STEP tanıyıcısı (js/mount-step.js) yüklenmemiş.'], agac:[], parcalar:[] };
  var s = { dosya:ad || 'STEP', kap:kap || 'duz', durum:sonuc.ok ? 'hazir' : 'hata', sonuc:sonuc,
            roller:(sonuc.agac || []).map(function(){ return null; }), coz:null, kutle:{}, ag:[], modul:_mwModulId() };
  if(!sonuc.ok) s.hata = (sonuc.hatalar || []).join(' ') || 'Dosya okunamadı.';
  _mwStp = s;
  veMntWizRender();
  if(s.durum === 'hazir' && typeof veMntWiz3bAc === 'function') veMntWiz3bAc();
  return s;
}
function veMntWizStpDrop(e){
  if(!e) return false;
  if(e.preventDefault) e.preventDefault();
  var el = e.currentTarget;
  if(el && el.classList){ el.setAttribute('data-surukle', '0'); el.classList.remove('ve-fw-stp-on'); }
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if(!f) return false;
  veMntWizStpDosya(f);
  return true;
}
// Bırakma alanının işareti: dragenter/dragleave ALT elemanlarda da tetikleniyor,
// sayaç olmadan işaret her satırın üstünde yanıp söner.
function veMntWizStpSurukle(el, giris){
  if(!el || !el.classList) return;
  var n = (parseInt(el.getAttribute('data-surukle') || '0', 10) || 0) + (giris ? 1 : -1);
  if(n < 0) n = 0;
  el.setAttribute('data-surukle', String(n));
  el.classList.toggle('ve-fw-stp-on', n > 0);
}
// Tablonun satırları: kök (bütün montaj) çocuğu varsa rol almaz.
function _mwStpSatirlar(s){
  return s.sonuc.agac.filter(function(d){ return !(d.ebeveyn < 0 && d.cocuklar.length); });
}
function _mwStpImza(s){ return JSON.stringify(s.roller); }
// Parçanın ağı — 3B görüntüleyiciyle ORTAK önbellek (s.ag): hesap ve görüntü
// aynı üçgenleri kullanır, ikisi de bir kez üçgenler.
function _mwStpCoz(s){
  var B = null;
  return veMntStpCoz(s.sonuc, s.roller, { ag:function(pi){
    if(!s.ag) s.ag = [];
    if(!s.ag[pi]){
      if(!B && typeof veStepUcgenBaglam === 'function') B = veStepUcgenBaglam(s.sonuc._model);
      s.ag[pi] = veMntStpParcaAgi(s.sonuc, pi, B) || null;
    }
    return s.ag[pi];
  } });
}
// ROL DÜĞÜME VERİLİR ve bir parça TEK birime aittir: düğümün atalarının ve
// torunlarının rolü düşer (motor alt montajına rol verilince parçalarının ayrı
// rolü kalmaz). İlk hesaptan sonra sonuç rolleri izler (FEAD'in kuralı).
function veMntWizStpRol(i, tip){
  var s = _mwStp;
  if(!s || s.durum !== 'hazir' || !(i >= 0 && i < s.roller.length)) return false;
  if(tip && VE_MNT_STP_ROLLER.indexOf(tip) < 0) return false;
  var a = s.sonuc.agac;
  if(tip){
    for(var e = a[i].ebeveyn; e >= 0; e = a[e].ebeveyn) s.roller[e] = null;
    (function sil(d){ a[d].cocuklar.forEach(function(c){ s.roller[c] = null; sil(c); }); })(i);
  }
  s.roller[i] = tip || null;
  var vardi = !!s.coz;
  s.coz = null;
  if(vardi && !_mwStpRolDenetim(s).length) s.coz = _mwStpCoz(s);
  veMntWizRender();
  return true;
}
function veMntWizStpKapat(){
  _mwStp = null;
  veMntWizRender();
}
// Hesaptan ÖNCEKİ kapı
function _mwStpRolDenetim(s){
  return s.roller.some(function(r){ return !!r; }) ? [] : ['Hiçbir parçaya rol verilmedi.'];
}
function veMntWizStpHesapla(){
  var s = _mwStp;
  if(!s || s.durum !== 'hazir') return null;
  var d = _mwStpRolDenetim(s);
  if(d.length){
    if(typeof showToast === 'function') showToast(d[0], 'warning');
    return null;
  }
  s.coz = _mwStpCoz(s);
  veMntWizRender();
  return s.coz;
}
function _mwStpGovdeler(s){
  return (s && s.coz && s.coz.ok) ? s.coz.birimler.filter(function(b){ return b.tip !== 'mnt-mount'; }) : [];
}
function _mwStpTakozlar(s){
  return (s && s.coz && s.coz.ok) ? s.coz.birimler.filter(function(b){ return b.tip === 'mnt-mount'; }) : [];
}
function _mwStpBirim(s, dugum){
  var l = (s && s.coz && s.coz.birimler) || [];
  for(var i = 0; i < l.length; i++) if(l[i].dugum === dugum) return l[i];
  return null;
}
// Koordinat üçlüsü ekranda 0,1 mm'ye, ayraç `; ` (karar 7·C)
function _mwStpKonum(p){
  return (p || []).map(function(v){ return _mwSayi(Math.round(v * 10) / 10); }).join('; ');
}
// Hacim litre (dm³) — büyüklüğe göre hane
function _mwStpHacim(V){
  var l = V / 1e6;
  return veSayi(l, l >= 100 ? 0 : (l >= 10 ? 1 : 2));
}
function _mwStpAtaletHTML(s, b){
  if(!b) return '—';
  if(!b.kapali) return '<span class="ve-fw-kl-dim" title="Ağ kapalı değil — hacim ölçülemedi; atalet sihirbazda elle girilir">yok</span>';
  return (s.kutle[b.dugum] > 0)
    ? veDurumIkon('ok', 'Atalet tensörü homojen yoğunlukla türetilir') + ' türetilir'
    : '<span class="ve-fw-kl-dim">kütle bekliyor</span>';
}
// KÜTLE — gövde başına; kart ve 3B AYNI alanı yazar. Yama: tam yeniden çizim
// yazılan alanın odağını düşürür ve aynı tıklamadaki "Sihirbaza aktar"ı yutar.
function veMntWizStpKutle(dugum, v){
  var s = _mwStp;
  if(!s || !s.coz || !_mwStpBirim(s, dugum)) return false;
  var m = _mwNum(v);
  if(m > 0) s.kutle[dugum] = m; else delete s.kutle[dugum];
  if(typeof document !== 'undefined' && document.querySelectorAll){
    var b = _mwStpBirim(s, dugum);
    Array.prototype.forEach.call(document.querySelectorAll('[data-mw-stp-atalet="' + dugum + '"]'), function(el){
      el.innerHTML = _mwStpAtaletHTML(s, b);
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[data-mw-stp-kutle="' + dugum + '"]'), function(el){
      if(el !== document.activeElement) el.value = (s.kutle[dugum] !== undefined) ? String(s.kutle[dugum]) : '';
    });
    if(_mwState && VE_MW_STEPS[_mwStep].key === 'kaynak') _mwMasaCiz(_mwCoz || veMntWizCoz(_mwState));
  }
  return true;
}
function _mwStpKutleHTML(s){
  var gs = _mwStpGovdeler(s);
  if(!gs.length) return '';
  var t = '<div class="ve-fw-tblwrap"><table class="ve-fw-tbl ve-fw-tbl-fixed ve-mw-tbl-kutle"><thead><tr>'
    + '<th>Gövde</th><th>Hacim<em>dm³</em></th><th title="' + _mwEsc(VE_MW_STP_KUTLE_NOT) + '">Kütle<em>kg</em></th>'
    + '<th>Atalet</th></tr></thead><tbody>';
  gs.forEach(function(b){
    var m = s.kutle[b.dugum];
    t += '<tr><td title="' + _mwEsc(_mwAd(b.tip)) + '">' + _mwEsc(b.ad) + '</td>'
      + '<td class="ve-fw-num">' + (b.kapali ? _mwStpHacim(b.V) : '—') + '</td>'
      + '<td><input type="text" inputmode="decimal" class="ve-fw-inp" data-mw-stp-kutle="' + b.dugum + '"'
      + ' value="' + (m !== undefined ? _mwEsc(m) : '') + '" aria-label="Kütle — ' + _mwEsc(b.ad) + '"'
      + ' oninput="veMntWizStpKutle(' + b.dugum + ', this.value)"></td>'
      + '<td data-mw-stp-atalet="' + b.dugum + '">' + _mwStpAtaletHTML(s, b) + '</td></tr>';
  });
  return t + '</tbody></table></div>';
}
function _mwStpSayim(coz){
  var g = 0, t = 0;
  (coz.birimler || []).forEach(function(b){ if(b.tip === 'mnt-mount') t++; else g++; });
  return g + ' gövde · ' + t + ' takoz';
}

// Aktarım kapısı — sebebiyle. `engel` aktarımı durdurur, `uyari` durdurmaz;
// uyarıların çoğu tanıyıcının KENDİ listesi.
function veMntWizStpDenetim(s){
  s = s || _mwStp;
  var out = { engel:[], uyari:[], hesapsiz:false };
  if(!s || s.durum !== 'hazir'){ out.engel.push('Okunmuş bir STEP dosyası yok.'); return out; }
  out.engel = _mwStpRolDenetim(s);
  (s.sonuc.uyarilar || []).forEach(function(m){ out.uyari.push(m); });
  if(out.engel.length) return out;
  if(!s.coz){ out.hesapsiz = true; out.engel.push('Konumlar henüz hesaplanmadı.'); return out; }
  (s.coz.hatalar || []).forEach(function(m){ out.engel.push(m); });
  (s.coz.uyarilar || []).forEach(function(m){ out.uyari.push(m); });
  if(s.coz.ok){
    var nt = _mwStpTakozlar(s).length;
    if(!_mwStpGovdeler(s).length) out.uyari.push('Gövde rolü verilmedi — kütle gövdesi sihirbazda eklenir.');
    if(nt < 3) out.uyari.push(nt + ' takoz rolü — 6 serbestlik dereceli denge için en az üç takoz gerekir.');
  }
  return out;
}

// AKTAR: kayıt → sihirbaz durumu, örnek tohumunun yolundan. Aktarım bir
// BAŞLANGIÇ eylemidir (örnek seçmek gibi): durumu baştan kurar. Geometriden
// gelen alanlar "S" işareti taşır (kaydın `kaynak` dizisi, listeyle aynı sıra).
function veMntWizStpAktar(){
  var s = _mwStp;
  var d = veMntWizStpDenetim(s);
  if(d.engel.length){
    if(typeof showToast === 'function') showToast(d.engel[0], 'warning');
    return null;
  }
  var kayit = veMntStpKayit(s.coz, s.kutle);
  var st = veMntWizFromNodes(kayit.liste);
  var gi = 0, ti = 0;
  kayit.liste.forEach(function(n, k){
    var r = (n.type === 'mnt-mount') ? st.takozlar[ti++] : st.govdeler[gi++];
    if(r) r.kaynak = _mwKopya(kayit.kaynak[k]);
  });
  st.seededFrom = 'step';
  st.stepKaynak = { dosya:s.dosya, govde:st.govdeler.length, takoz:st.takozlar.length };
  _mwState = st;
  _mwSec = { govde:null, takoz:null }; _mwGor = {};
  _mwStep = 0;
  s.aktarim = _mwStpImza(s);
  veMntWizRender();
  return kayit;
}
// Masanın STEP önizlemesi: hesaplanmış ama (bu rollerle) aktarılmamış birimler.
function _mwStpOnizleme(){
  var s = _mwStp;
  return !!(s && s.durum === 'hazir' && s.coz && s.coz.ok && s.aktarim !== _mwStpImza(s));
}

function _mwStpKartHTML(){
  var s = _mwStp, st = _mwState || {};
  var h = '<div class="ve-fw-stp" data-ve-dropzone="step"'
    + ' ondragenter="veMntWizStpSurukle(this, true)" ondragleave="veMntWizStpSurukle(this, false)"'
    + ' ondragover="event.preventDefault()" ondrop="veMntWizStpDrop(event)">';
  // KARTIN DÜĞMELERİ BİRİNCİL DEĞİL: adımın tek birincil eylemi alttaki "İleri".
  h += '<div class="ve-fw-rowbtns">'
    + '<label class="ve-fw-btn ve-fw-stp-sec"'
    + ' title="STEP dosyasını seçin ya da bu alana bırakın — .stp · .step · .stpZ (AP214 / AP242, katı geometri)">'
    + '<input type="file" class="ve-fw-stp-file ve-mw-stp-file" accept=".stp,.step,.stpz,.p21"'
    + ' onchange="veMntWizStpDosya(this.files && this.files[0]); this.value=\'\';">'
    + (s ? 'Başka dosya seç…' : 'STEP dosyası seç…') + '</label>';
  if(s && s.durum === 'hazir' && typeof veMntWiz3bAc === 'function')
    h += '<button type="button" class="ve-fw-btn" id="ve-mw-stp-3b" onclick="veMntWiz3bAc()"'
      + ' title="Montajı 3B görüntüleyicide açın; parçaya tıklayıp rolünü verin">3B\'de seç</button>';
  if(s && s.durum !== 'okunuyor')
    h += '<button type="button" class="ve-fw-mini" title="Dosyayı karttan kaldır" aria-label="Dosyayı karttan kaldır"'
      + ' onclick="veMntWizStpKapat()">' + _mwIkon('x') + '</button>';
  h += '</div>';

  if(!s){
    if(st.stepKaynak)
      h += '<div class="ve-fw-seeded">' + _mwIkon('check') + ' <b>' + _mwEsc(st.stepKaynak.dosya) + '</b> aktarılmıştı'
        + ' <em>' + st.stepKaynak.govde + ' gövde · ' + st.stepKaynak.takoz + ' takoz</em></div>';
    return h + '</div>';
  }
  if(s.durum === 'okunuyor')
    return h + '<div class="ve-fw-seeded ve-fw-stp-wait">' + _mwIkon('clock') + ' <b>' + _mwEsc(s.dosya) + '</b> okunuyor…</div></div>';
  if(s.durum === 'hata')
    return h + '<div class="ve-fw-issues"><div class="ve-fw-issue ve-fw-issue-err">' + _mwIkon('x') + ' <b>'
      + _mwEsc(s.dosya) + '</b> — ' + _mwEsc(s.hata) + '</div></div></div>';

  var so = s.sonuc, sm = so.sureMs || {}, bas = so.baslik || {};
  var sure = ((sm.oku || 0) + (sm.montaj || 0) + (sm.yuz || 0)) / 1000;
  h += '<div class="ve-fw-seeded">' + _mwIkon('check') + ' <b>' + _mwEsc(s.dosya) + '</b> okundu <em>'
    + _mwEsc([bas.sistem || bas.onisleyici || '',
              s.kap !== 'duz' ? 'sıkıştırılmış (' + s.kap + ')' : '',
              so.parcalar.length + ' parça', veSayi(sure, 2) + ' sn'].filter(Boolean).join(' · '))
    + '</em></div>';

  // ── PARÇA AĞACI ─────────────────────────────────────────────────────────
  var coz = s.coz;
  var sec = [['', '—']].concat(VE_MNT_STP_ROLLER.map(function(t){ return [t, _mwAd(t)]; }));
  var satirlar = _mwStpSatirlar(s), taban = satirlar.length ? satirlar[0].derinlik : 0;
  var t = '<div class="ve-fw-tblwrap"><table class="ve-fw-tbl ve-fw-tbl-fixed ve-fw-tbl-stp ve-mw-tbl-stp"><thead><tr>'
    + '<th>Parça</th><th>Rol</th><th>Konum<em>mm</em></th></tr></thead><tbody>';
  satirlar.forEach(function(d){
    var rol = s.roller[d.i] || '', ata = -1;
    for(var e = d.ebeveyn; e >= 0; e = so.agac[e].ebeveyn) if(s.roller[e]){ ata = e; break; }
    // `tanim` DÜZ METİN, `onEk` HTML (ikon): hücre ikisinden kurulur (FEAD'de
    // ikon metne eklenip birlikte kaçışlanıyordu — ham `<span>` basılıyordu).
    var tanim = '—', onEk = '', sinif = '';
    if(ata >= 0){ onEk = _mwIkon('corner-down-right') + ' '; tanim = _mwAd(s.roller[ata]) + ' birimi'; sinif = ' ve-fw-stp-off'; }
    else if(rol && coz){
      var b = _mwStpBirim(s, d.i);
      if(b && b.konum){
        tanim = _mwStpKonum(b.konum);
        if(b.kaynak !== 'hacim') sinif = ' ve-fw-stp-warn';
      } else { tanim = 'ölçülemedi'; sinif = ' ve-fw-stp-warn'; }
    }
    else if(!rol) sinif = ' ve-fw-stp-off';
    t += '<tr class="ve-fw-stp-r' + sinif + '" data-ve-stp="' + d.i + '">'
      + '<td title="' + _mwEsc(d.ornek || d.id || '') + '" style="--stp-d:' + Math.max(0, d.derinlik - taban) + ';">'
      + _mwEsc(d.ad) + '</td>'
      + '<td><select class="ve-fw-inp" aria-label="Rol — ' + _mwEsc(d.ad) + '" onchange="veMntWizStpRol(' + d.i + ', this.value)">'
      + sec.map(function(o){
          return '<option value="' + o[0] + '"' + (o[0] === rol ? ' selected' : '') + '>' + _mwEsc(o[1]) + '</option>'; }).join('')
      + '</select></td>'
      + '<td>' + onEk + _mwEsc(tanim) + '</td></tr>';
  });
  h += t + '</tbody></table></div>';

  // ── HESAPLA ─────────────────────────────────────────────────────────────
  var d = veMntWizStpDenetim(s);
  var rolEngel = _mwStpRolDenetim(s);
  h += '<div class="ve-fw-rowbtns">'
    + '<button type="button" id="ve-mw-stp-hesapla" class="ve-fw-btn"'
    + (rolEngel.length ? ' disabled' : '') + ' onclick="veMntWizStpHesapla()">'
    + (coz ? 'Yeniden hesapla' : 'Konumları hesapla') + '</button>'
    + '<span class="ve-fw-dim">' + (coz
        ? (coz.ok ? _mwIkon('check') + ' ' + _mwStpSayim(coz) : _mwIkon('x') + ' ölçülemedi')
        : 'hesaplanmadı') + '</span></div>';

  if(coz && coz.ok){
    // ── KÜTLE + AKTAR ─────────────────────────────────────────────────────
    h += _mwStpKutleHTML(s);
    var aktarildi = !!(st.stepKaynak && s.aktarim);
    var degisti = aktarildi && s.aktarim !== _mwStpImza(s);
    h += '<div class="ve-fw-rowbtns">'
      + '<button type="button" id="ve-mw-stp-aktar" class="ve-fw-btn"'
      + (d.engel.length ? ' disabled' : '') + ' onclick="veMntWizStpAktar()">'
      + (aktarildi ? 'Yeniden aktar' : 'Sihirbaza aktar') + '</button></div>';
    if(aktarildi && !degisti)
      h += '<div class="ve-fw-seeded">' + _mwIkon('check') + ' <b>' + st.stepKaynak.govde + ' gövde · ' + st.stepKaynak.takoz
        + ' takoz</b> sihirbaza aktarıldı <em>' + _mwEsc(st.stepKaynak.dosya) + '</em></div>';
    if(degisti) d.uyari.unshift('Rol aktarımdan sonra değişti; sihirbaz eski seçimle dolu.');
  }
  var liste = d.engel.filter(function(m){ return !(d.hesapsiz && m === 'Konumlar henüz hesaplanmadı.'); })
    .map(function(m){ return { tur:'err', m:m }; })
    .concat(d.uyari.map(function(m){ return { tur:'warn', m:m }; }));
  if(liste.length){
    h += '<div class="ve-fw-issues">';
    liste.forEach(function(it){
      h += '<div class="ve-fw-issue ve-fw-issue-' + it.tur + '">' + _mwIkon(it.tur === 'err' ? 'x' : 'alert-triangle')
        + ' ' + _mwEsc(it.m) + '</div>';
    });
    h += '</div>';
  }
  return h + '</div>';
}

// ── 2 · KÜTLE GÖVDELERİ ───────────────────────────────────────────────────
function _mwGovdeDurum(g){
  return (_mwNum(g.mass) > 0 && _mwVar(g.cgx) && _mwVar(g.cgy) && _mwVar(g.cgz)) ? 'ok' : 'err';
}
function _mwGovdeListeHTML(c){
  var st = _mwState;
  if(!st.govdeler.length) return '<div class="ve-fw-dim">Henüz gövde yok.</div>';
  var h = '';
  st.govdeler.forEach(function(g, i){
    var on = (_mwSec.govde === g.key), d = _mwGovdeDurum(g);
    h += '<button type="button" class="ve-fw-kl' + (on ? ' on' : '') + '" onclick="veMntWizSec(\'govde\',\'' + g.key + '\')"'
      + ' data-mw-satir="' + g.key + '">'
      + '<span class="ve-fw-kl-no">' + (i + 1) + '</span>'
      + '<span class="ve-fw-kl-ad"><span>' + _mwEsc(g.ad || _mwAd(g.type)) + '</span>'
      + (g.ad !== _mwAd(g.type) ? '<i class="ve-fw-kl-rol">' + _mwEsc(_mwAd(g.type)) + '</i>' : '') + '</span>'
      + '<span class="ve-fw-kl-n">' + (_mwNum(g.mass) > 0 ? _mwFmt(_mwNum(g.mass), 1) + ' kg' : '<span class="ve-fw-kl-dim">kütle yok</span>') + '</span>'
      + '<span class="ve-mw-kl-d">' + veDurumIkon(d === 'ok' ? 'ok' : 'err', d === 'ok' ? 'Tamam' : 'Eksik girdi') + '</span>'
      + '</button>';
  });
  return h;
}
function _mwGovdeEditorHTML(g){
  var k = g.key, P = 'govde.' + k + '.';
  var tip = '<select class="ve-fw-inp" onchange="veMntWizGovdeTip(\'' + k + '\', this.value)" aria-label="Tip">'
    + VE_MW_GOVDE_TIPLERI.map(function(t){ return '<option value="' + t + '"' + (t === g.type ? ' selected' : '') + '>' + _mwEsc(_mwAd(t)) + '</option>'; }).join('')
    + '</select>';
  var nokta = '<div class="ve-fw-seg" role="group" aria-label="Nokta kütle">'
    + '<button type="button" class="ve-fw-seg-b" aria-pressed="' + (!g.pointMass) + '" onclick="veMntWizNokta(\'' + k + '\', false)">Atalet tensörü</button>'
    + '<button type="button" class="ve-fw-seg-b" aria-pressed="' + (!!g.pointMass) + '" onclick="veMntWizNokta(\'' + k + '\', true)">Nokta kütle</button></div>';
  var h = '<div class="ve-fw-ed">'
    + _mwAlan('Tip', tip)
    + _mwAlan('Ad', _mwInp(P + 'ad', g.ad, { text:true, baslik:'Ad' }))
    + _mwAlan('Kütle [kg]', _mwInp(P + 'mass', g.mass, { ph:'zorunlu', baslik:'Kütle' }))
    + _mwAlan('CG [mm]' + _mwKaynakIsaret(g, 'cg'),
        _mwInp(P + 'cgx', g.cgx, { ph:'x', baslik:'CG x' }) + _mwInp(P + 'cgy', g.cgy, { ph:'y', baslik:'CG y' })
        + _mwInp(P + 'cgz', g.cgz, { ph:'z', baslik:'CG z' }), 've-mw-ed-xyz')
    + _mwAlan('Atalet', nokta);
  if(!g.pointMass){
    h += _mwAlan('I [kg·m²]' + _mwKaynakIsaret(g, 'I'),
        _mwInp(P + 'Ixx', g.Ixx, { ph:'Ixx', baslik:'Ixx' }) + _mwInp(P + 'Iyy', g.Iyy, { ph:'Iyy', baslik:'Iyy' })
        + _mwInp(P + 'Izz', g.Izz, { ph:'Izz', baslik:'Izz' }), 've-mw-ed-xyz')
      + _mwAlan('Çarpım', _mwInp(P + 'Ixy', g.Ixy, { ph:'Ixy', baslik:'Ixy' }) + _mwInp(P + 'Ixz', g.Ixz, { ph:'Ixz', baslik:'Ixz' })
        + _mwInp(P + 'Iyz', g.Iyz, { ph:'Iyz', baslik:'Iyz' }), 've-mw-ed-xyz');
  }
  h += '<div class="ve-fw-ed-ops"><button type="button" class="ve-fw-btn ve-fw-btn-sil" onclick="veMntWizGovdeSil(\'' + k + '\')">'
    + _mwIkon('trash') + ' Sil</button></div></div>';
  return h;
}
function _mwStepGovde(c){
  var st = _mwState;
  if(_mwSec.govde && !_mwSatir('govde', _mwSec.govde)) _mwSec.govde = null;
  if(!_mwSec.govde && st.govdeler.length) _mwSec.govde = st.govdeler[0].key;
  var ekle = '<select class="ve-fw-inp" onchange="if(this.value){veMntWizGovdeEkle(this.value);}" aria-label="Gövde ekle">'
    + '<option value="">Gövde ekle…</option>'
    + VE_MW_GOVDE_TIPLERI.map(function(t){ return '<option value="' + t + '">' + _mwEsc(_mwAd(t)) + '</option>'; }).join('')
    + '</select>';
  var h = _mwCard('Kütle gövdeleri', '<div class="ve-mw-liste" id="ve-mw-liste">' + _mwGovdeListeHTML(c) + '</div>' + ekle);
  var g = _mwSatir('govde', _mwSec.govde);
  if(g) h += _mwCard('Seçili gövde', _mwGovdeEditorHTML(g));
  return h;
}

// ── 3 · TAKOZLAR ──────────────────────────────────────────────────────────
function _mwTakozDurum(t){
  var tamam = _mwVar(t.x) && _mwVar(t.y) && _mwVar(t.z)
    && ['kxs', 'kys', 'kzs', 'kxd', 'kyd', 'kzd'].every(function(k){ return _mwNum(t[k]) > 0; });
  return tamam ? 'ok' : 'err';
}
function _mwTakozListeHTML(c){
  var st = _mwState;
  if(!st.takozlar.length) return '<div class="ve-fw-dim">Henüz takoz yok.</div>';
  var h = '';
  st.takozlar.forEach(function(t, i){
    var on = (_mwSec.takoz === t.key), d = _mwTakozDurum(t);
    h += '<button type="button" class="ve-fw-kl' + (on ? ' on' : '') + '" onclick="veMntWizSec(\'takoz\',\'' + t.key + '\')"'
      + ' data-mw-satir="' + t.key + '">'
      + '<span class="ve-fw-kl-no">' + (i + 1) + '</span>'
      + '<span class="ve-fw-kl-ad"><span>' + _mwEsc(t.ad || 'Takoz') + '</span></span>'
      + '<span class="ve-fw-kl-n">' + (_mwNum(t.kzs) > 0 ? 'k<sub>z</sub> ' + _mwFmt(_mwNum(t.kzs), 0) + ' N/mm' : '<span class="ve-fw-kl-dim">k yok</span>') + '</span>'
      + '<span class="ve-mw-kl-d">' + veDurumIkon(d === 'ok' ? 'ok' : 'err', d === 'ok' ? 'Tamam' : 'Eksik girdi') + '</span>'
      + '</button>';
  });
  return h;
}
function _mwKatalogSecHTML(t){
  var lib = (typeof veMntGetLibraryList === 'function') ? veMntGetLibraryList() : [];
  var b = lib.filter(function(e){ return e.builtin; }), o = lib.filter(function(e){ return !e.builtin; });
  var opt = function(e){ return '<option value="' + _mwEsc(e.key) + '"' + (t.libKey === e.key ? ' selected' : '') + '>' + _mwEsc(e.name) + '</option>'; };
  var h = '<select class="ve-fw-inp" onchange="veMntWizTakozKatalog(\'' + t.key + '\', this.value)" aria-label="Katalog">'
    + '<option value="">— katalogdan seç —</option>';
  if(b.length) h += '<optgroup label="Gömülü">' + b.map(opt).join('') + '</optgroup>';
  if(o.length) h += '<optgroup label="Özel (Takoz Özellikleri)">' + o.map(opt).join('') + '</optgroup>';
  return h + '</select>';
}
function _mwTakozEditorHTML(t){
  var k = t.key, P = 'takoz.' + k + '.';
  var yasa = ['X', 'Y', 'Z'].filter(function(a){
    var f = t['fit' + a], p = t['curve' + a];
    return (f && (f.form === 'poly' || f.form === 'asym')) || (Array.isArray(p) && p.length >= 2);
  });
  var aynaOlur = Math.abs(_mwNum(t.y)) >= 1;
  var h = '<div class="ve-fw-ed">'
    + _mwAlan('Ad', _mwInp(P + 'ad', t.ad, { text:true, baslik:'Ad' }))
    + _mwAlan('Konum [mm]' + _mwKaynakIsaret(t, 'konum'),
        _mwInp(P + 'x', t.x, { ph:'x', baslik:'Konum x' }) + _mwInp(P + 'y', t.y, { ph:'y', baslik:'Konum y' })
        + _mwInp(P + 'z', t.z, { ph:'z', baslik:'Konum z' }), 've-mw-ed-xyz')
    + _mwAlan('Katalog', _mwKatalogSecHTML(t))
    + (veMntWizTakozElle(t) ? '<div class="ve-mw-not">Rijitlik katalogdan farklı — elle girildi.</div>' : '')
    + _mwAlan('Statik [N/mm]',
        _mwInp(P + 'kxs', t.kxs, { ph:'kx', baslik:'Statik kx' }) + _mwInp(P + 'kys', t.kys, { ph:'ky', baslik:'Statik ky' })
        + _mwInp(P + 'kzs', t.kzs, { ph:'kz', baslik:'Statik kz' }), 've-mw-ed-xyz')
    + _mwAlan('Dinamik [N/mm]',
        _mwInp(P + 'kxd', t.kxd, { ph:'kx', baslik:'Dinamik kx' }) + _mwInp(P + 'kyd', t.kyd, { ph:'ky', baslik:'Dinamik ky' })
        + _mwInp(P + 'kzd', t.kzd, { ph:'kz', baslik:'Dinamik kz' }), 've-mw-ed-xyz')
    + _mwAlan('Kapasite [kg]', _mwInp(P + 'maxLoad', t.maxLoad, { ph:'isteğe bağlı', baslik:'Kapasite' }))
    + (yasa.length ? '<div class="ve-mw-not">Nonlineer yasa: ' + yasa.join(', ').toLowerCase() + ' ekseni — katalogdan, çözücü Newton ile çözer.</div>' : '')
    + '<div class="ve-fw-ed-ops">'
    + '<button type="button" class="ve-fw-btn"' + (aynaOlur ? '' : ' disabled title="y = 0 düzlemindeki takozun aynalı eşi kendisidir"')
      + ' onclick="veMntWizTakozAyna(\'' + k + '\')">' + _mwIkon('arrow-left-right') + ' Aynalı eşini ekle</button>'
    + '<button type="button" class="ve-fw-btn ve-fw-btn-sil" onclick="veMntWizTakozSil(\'' + k + '\')">' + _mwIkon('trash') + ' Sil</button>'
    + '</div></div>';
  return h;
}
function _mwStepTakoz(c){
  var st = _mwState;
  if(_mwSec.takoz && !_mwSatir('takoz', _mwSec.takoz)) _mwSec.takoz = null;
  if(!_mwSec.takoz && st.takozlar.length) _mwSec.takoz = st.takozlar[0].key;
  var h = _mwCard('Takozlar', '<div class="ve-mw-liste" id="ve-mw-liste">' + _mwTakozListeHTML(c) + '</div>'
    + '<div class="ve-fw-ed-ops"><button type="button" class="ve-fw-btn" onclick="veMntWizTakozEkle()">' + _mwIkon('plus') + ' Takoz ekle</button></div>');
  var t = _mwSatir('takoz', _mwSec.takoz);
  if(t) h += _mwCard('Seçili takoz', _mwTakozEditorHTML(t));
  return h;
}

// ── 4 · TORK VE ÇALIŞMA ───────────────────────────────────────────────────
function _mwMotorKatalogHTML(){
  var P = (typeof _mntEnginePresets === 'function') ? _mntEnginePresets() : null;
  if(!P) return '';
  var keys = Object.keys(P); if(!keys.length) return '';
  var cur = (_mwState.tork || {}).enginePreset || '', used = {};
  // Yer tutucu takoz kataloğununkiyle aynı söz: "— katalogdan motor seç (24) —"
  // 175 px'lik alana sığmıyor, sonu kesiliyordu. Sayı erişilebilir adda.
  var h = '<select class="ve-fw-inp" onchange="veMntWizMotorKatalog(this.value)" aria-label="Motor kataloğu (' + keys.length + ' motor)"'
    + ' title="Motor kataloğu · ' + keys.length + ' motor">'
    + '<option value="">— katalogdan seç —</option>';
  (typeof _MNT_ENG_FAMILIES !== 'undefined' ? _MNT_ENG_FAMILIES : [{ label:'Motorlar', prefix:[] }]).forEach(function(fam){
    var ks = keys.filter(function(k){
      if(used[k]) return false;
      return !fam.prefix.length || fam.prefix.some(function(p){ return k.indexOf(p) === 0; });
    });
    if(!ks.length) return;
    h += '<optgroup label="' + _mwEsc(fam.label) + '">';
    ks.forEach(function(k){ used[k] = 1; h += '<option value="' + _mwEsc(k) + '"' + (k === cur ? ' selected' : '') + '>' + _mwEsc(P[k].name || k) + '</option>'; });
    h += '</optgroup>';
  });
  return h + '</select>';
}
function _mwTorkOkuHTML(c){
  var r = function(et, deg){ return '<div class="ve-fw-read"><span>' + et + '</span><b>' + deg + '</b></div>'; };
  return '<div class="ve-fw-reads">'
    + r('İleri tork (şaft)', c.tork ? _mwFmt(c.tork.ileri, 0) + ' N·m' : '—')
    + r('Geri tork (şaft)', (c.tork && Number.isFinite(c.tork.geri)) ? _mwFmt(c.tork.geri, 0) + ' N·m' : '—')
    + r('Ateşleme frekansı', Number.isFinite(c.fAtes) ? _mwFmt(c.fAtes, 1) + ' Hz' : '—')
    + '</div>';
}
function _mwStepTork(c){
  var tq = _mwState.tork || {}, P = 'tork.';
  var g = function(k, ph, et){ return '<label class="ve-fw-field"><span class="ve-fw-lbl">' + et + '</span>' + _mwInp(P + k, tq[k], { ph:ph, baslik:et }) + '</label>'; };
  // YER TUTUCU YALNIZ GERÇEK VARSAYILANDA (FEAD kural 46): transfer oranı ve
  // aks payı boşken çözücü 1 alır — onların yer tutucusu 1. Varsayılanı
  // olmayan alana sayı yazılmaz; soluk bir "3000" girilmiş bir değer gibi okunur.
  var h = _mwCard('Motor', (_mwMotorKatalogHTML() ? '<label class="ve-fw-field"><span class="ve-fw-lbl">Katalog</span>' + _mwMotorKatalogHTML() + '</label>' : '')
    + '<div class="ve-fw-grid" style="--fw-cols:2;">'
    + g('Te', '', 'Tepe tork [N·m]') + g('TeRpm', '', 'Tepe tork devri [d/dk]')
    + g('PmaxRpm', '', 'Maks güç devri [d/dk]') + g('idleRpm', '', 'Rölanti [d/dk]')
    + g('cylinders', '', 'Silindir sayısı') + '</div>');
  h += _mwCard('Şanzıman', '<div class="ve-fw-grid" style="--fw-cols:3;">'
    + g('g1', '', '1. vites') + g('g2', '', '2. vites') + g('g3', '', '3. vites')
    + g('g4', '', '4. vites') + g('g5', '', '5. vites') + g('g6', '', '6. vites')
    + g('gR', '', 'Geri') + g('Rstall', '', 'Stall oranı') + '</div>');
  h += _mwCard('Transfer ve aks', '<div class="ve-fw-grid" style="--fw-cols:3;">'
    + g('iTransfer', '1', 'Transfer oranı') + g('phiFwd', '1', 'Aks payı φ ileri') + g('phiRev', '1', 'Aks payı φ geri') + '</div>');
  h += _mwCard('Zincirin sonucu', '<div id="ve-mw-tork-oku">' + _mwTorkOkuHTML(c) + '</div>');
  return h;
}

// ── 5 · ÖZET VE KURULUM ───────────────────────────────────────────────────
function _mwKurulumPlani(){
  var st = _mwState || veMntWizDefault();
  var tuval = _mwTuvalModeli(), ref = {};
  var guncel = 0, yeni = 0;
  st.govdeler.concat(st.takozlar).forEach(function(r){
    var n = r._dugum ? tuval.filter(function(x){ return x.id === r._dugum; })[0] : null;
    var tip = r.type || 'mnt-mount';
    if(n && n.type === tip){ ref[n.id] = 1; guncel++; } else yeni++;
  });
  var sil = tuval.filter(function(n){ return !ref[n.id]; }).length;
  var araclar = (typeof VE_MNT_ARAC_TIPLERI !== 'undefined' ? VE_MNT_ARAC_TIPLERI : []).filter(function(t){
    return !(typeof nodes !== 'undefined' && nodes || []).some(function(n){ return n.type === t; });
  });
  return { yeni:yeni, guncel:guncel, sil:sil, araclar:araclar };
}
function _mwStepOzet(c){
  var st = _mwState, pl = _mwKurulumPlani();
  var r = function(et, deg){ return '<div class="ve-fw-read"><span>' + et + '</span><b>' + deg + '</b></div>'; };
  var kur = '<div class="ve-fw-reads">'
    + r('Kütle gövdesi', st.govdeler.length) + r('Takoz', st.takozlar.length)
    + (pl.guncel ? r('Yerinde güncellenecek', pl.guncel) : '')
    + (pl.sil ? r('Tuvalden çıkarılacak', pl.sil) : '')
    + r('Eksik analiz aracı', pl.araclar.length ? pl.araclar.length + ' (kurulur)' : 'yok')
    + '</div>';
  var h = _mwCard('Kurulacaklar', kur);
  if(c.ok){
    // Modelin özeti — GİRDİDEN türeyen büyüklükler (birleştirme, ateşleme
    // frekansı); sonuç (sehim, yük, mod) yok: raporda.
    var m = c.mp || {};
    h += _mwCard('Model', '<div class="ve-fw-reads">'
      + r('Toplam kütle', _mwFmt(m.m, 1) + ' kg')
      + (m.cg ? r('Birleşik CG', '(' + _mwFmt(m.cg[0] * 1000, 0) + '; ' + _mwFmt(m.cg[1] * 1000, 0) + '; ' + _mwFmt(m.cg[2] * 1000, 0) + ') mm') : '')
      + r('Ateşleme frekansı', Number.isFinite(c.fAtes) ? _mwFmt(c.fAtes, 1) + ' Hz' : '—')
      + '</div>');
  } else {
    var hepsi = (c.sorun || []).filter(function(s){ return s.tur === 'err'; }).map(function(s){ return s.m; }).concat(c.hata || []);
    h += _mwCard('Canlı çözüm', '<div class="ve-fw-issues">' + (hepsi.length ? hepsi.slice(0, 6).map(function(m){
      return '<div class="ve-fw-issue ve-fw-issue-err">' + _mwIkon('x') + ' ' + _mwEsc(m) + '</div>'; }).join('')
      + (hepsi.length > 6 ? '<div class="ve-fw-issue ve-fw-issue-err">+' + (hepsi.length - 6) + ' eksik daha</div>' : '')
      : '<div class="ve-fw-issue ve-fw-issue-warn">' + _mwIkon('alert-triangle') + ' Model boş.</div>') + '</div>');
  }
  return h;
}

// ── MASA ──────────────────────────────────────────────────────────────────
// Masa bir GÖRÜNTÜLEYİCİ (FEAD kural 47): sürükle kaydır, tekerlek imleçteki
// noktaya yakınlaşır, işarete tıkla seç. Görünüm durumu görünüş başına ve
// OTURUMLUK; modele yazılmaz.
var VE_MW_GOR_Z = [0.5, 12];
function _mwMasaTur(k){ return k === 'tork' ? 'tork' : 'figur'; }
function _mwMasaHTML(k, c){
  var tur = _mwMasaTur(k);
  var arac = '';
  if(tur === 'figur'){
    arac = '<div class="ve-fw-masa-arac" role="group" aria-label="Görünüş">'
      + ['ust', 'yan', 'on'].map(function(g){
          return '<button type="button" class="ve-fw-masa-btn ve-fw-masa-btn-yazi" aria-pressed="' + (_mwGorunus === g) + '"'
            + ' onclick="veMntWizGorunus(\'' + g + '\')">' + VE_MNT2D_GORUNUS[g].ad + '</button>';
        }).join('') + '</div>'
      + '<div class="ve-fw-masa-gezin">'
      + '<button type="button" class="ve-fw-masa-btn" title="Yakınlaştır" aria-label="Yakınlaştır" onclick="veMntWizZoom(1)">' + _mwIkon('zoom-in') + '</button>'
      + '<button type="button" class="ve-fw-masa-btn" title="Uzaklaştır" aria-label="Uzaklaştır" onclick="veMntWizZoom(-1)">' + _mwIkon('zoom-out') + '</button>'
      + '<button type="button" class="ve-fw-masa-btn" title="Sığdır" aria-label="Sığdır" onclick="veMntWizZoom(0)">' + _mwIkon('maximize') + '</button>'
      + '</div>';
  }
  var lejant = (tur === 'figur')
    ? '<span class="ve-fw-lj"><i class="ve-mw-lj ve-mw-lj-takoz"></i>Takoz</span>'
      + '<span class="ve-fw-lj"><i class="ve-mw-lj ve-mw-lj-govde"></i>Gövde CG</span>'
      + '<span class="ve-fw-lj"><i class="ve-mw-lj ve-mw-lj-cg"></i>Birleşik CG</span>'
    : '';
  return '<div class="ve-fw-masa" id="ve-mw-masa" data-adim="' + k + '" data-tur="' + tur + '"'
    + (tur === 'figur' ? ' data-gezin="1" tabindex="0"' : '') + '>'
    + '<div class="ve-fw-masa-cizim" id="ve-mw-masa-cizim"></div>'
    + '<div class="ve-fw-masa-ust"><div id="ve-mw-live" class="ve-fw-cip ve-fw-live">' + _mwCipIcHTML(c) + '</div></div>'
    + arac
    + '<div class="ve-fw-masa-alt">' + lejant + '</div>'
    + '</div>';
}
function _mwCipIcHTML(c){
  if(VE_MW_STEPS[_mwStep].key === 'kaynak' && _mwStpOnizleme()){
    var sy = _mwStpSayim(_mwStp.coz).split(' · ');
    return '<span class="ve-fw-damga ve-fw-pill-warn" data-model="stp" title="Masadaki çizim STEP dosyasının ölçümü; sihirbaz henüz eski modelle dolu.">'
      + _mwIkon('box') + ' STEP önizlemesi · aktarılmadı</span>'
      + sy.map(function(x){ return '<span class="ve-fw-pill">' + _mwEsc(x) + '</span>'; }).join('');
  }
  var d = veMntWizStepState(c, _mwStep);
  var h = '<span class="ve-fw-damga ve-fw-pill-' + (c.ok ? d.durum : 'err') + '" data-model="' + (c.ok ? 'ok' : 'no') + '" data-durum="' + d.durum + '">'
    + _mwIkon(c.ok && d.durum === 'ok' ? 'check' : (c.ok ? 'alert-triangle' : 'x')) + ' '
    + (c.ok ? (d.err ? 'Çözülüyor · ' + d.err + ' eksik' : 'Çözülüyor' + (d.warn ? ' · ' + d.warn + ' uyarı' : ''))
            // Özet adımının "eksiği" çözülmeyen modelin kendisi — sayısı anlamsız
            : 'Çözülemiyor' + (d.err && VE_MW_STEPS[_mwStep].key !== 'ozet' ? ' · ' + d.err + ' eksik' : '')) + '</span>';
  var v = c.veri || {};
  if(v.cg && v.cg.m > 0) h += '<span class="ve-fw-pill">m <b>' + _mwFmt(v.cg.m, 1) + ' kg</b></span>';
  h += '<span class="ve-fw-pill">takoz <b>' + ((_mwState || {}).takozlar || []).length + '</b></span>';
  // Sehim ve f₁ hapları kalktı (2026-10-16): sihirbaz sonuç göstermez.
  return h;
}
function _mwMasaOlc(){
  var el = (typeof document !== 'undefined') ? document.getElementById('ve-mw-masa-cizim') : null;
  if(el && el.clientWidth > 40 && el.clientHeight > 40) _mwMasaOlcu = { w:el.clientWidth, h:el.clientHeight };
  return _mwMasaOlcu;
}
// MASANIN PAYI — çizim yüzen öğelerin ALTINA girmez: üstte sonuç çipi ve
// görünüş düğmeleri, sağda yakınlaştırma düğmeleri, altta lejant ve x ekseninin
// yazısı. Üstüne kısa kenarın %6'sı NEFES (FEAD kural 47 · "SIĞDIRMA NEFESİ").
var VE_MW_MASA_PAY = { sol:58, sag:66, ust:56, alt:66 };
// ÖZET PANELİ masanın sağında YÜZER (CSS: `[data-adim="ozet"] > .ve-fw-yan`,
// 288 px, sağdan 12): geniş masada çizim onun SOLUNA sığdırılır — FEAD'in özet
// masasının kuralı (`VE_FW_OZET_PANEL`). Pay yokken Transfer Kutusu, Sağ Arka
// Takoz ve bir braket panelin altında kalıyordu. Dar gövdede (≤ 760 px, CSS'in
// container sorgusu) panel alta iner, pay gerekmez.
var VE_MW_OZET_PANEL = 288;
function _mwMasaPay(o, adim){
  var n = Math.round(0.06 * Math.min(o.w, o.h));
  var sag = (adim === 'ozet' && o.w > 760) ? VE_MW_OZET_PANEL + 24 : VE_MW_MASA_PAY.sag;
  return { sol:VE_MW_MASA_PAY.sol + n, sag:sag + n, ust:VE_MW_MASA_PAY.ust + n, alt:VE_MW_MASA_PAY.alt + n };
}
function _mwGorAnahtar(){ return VE_MW_STEPS[_mwStep].key + ':' + _mwGorunus; }
function _mwGorDurum(){ var k = _mwGorAnahtar(); return _mwGor[k] || (_mwGor[k] = { z:1, tx:0, ty:0 }); }
function _mwFigurVeri(c){
  var v = c.veri || { comps:[], mounts:[], cg:null };
  var st = _mwState || veMntWizDefault(), k = VE_MW_STEPS[_mwStep].key;
  // STEP ÖNİZLEMESİ (1. adım): masa aktarımın YAZACAĞI kaydı çizer — sayılar
  // kaydın kendisinden (veMntStpKayit), ikinci bir dönüşümden değil.
  if(k === 'kaynak' && _mwStpOnizleme() && typeof _mnt2DGather === 'function')
    return { veri:_mnt2DGather(veMntStpKayit(_mwStp.coz, _mwStp.kutle).liste), secili:null };
  // Seçim: satır anahtarı → 2B veri dizisindeki konum (yalnız konumu tam olanlar çizilir).
  var secili = null;
  if(k === 'govde' && _mwSec.govde){
    var gi = st.govdeler.filter(function(g){ return _mwVar(g.cgx) && _mwVar(g.cgy) && _mwVar(g.cgz); })
      .map(function(g){ return g.key; }).indexOf(_mwSec.govde);
    if(gi >= 0) secili = { tur:'govde', i:gi };
  }
  if(k === 'takoz' && _mwSec.takoz){
    var ti = st.takozlar.filter(function(t){ return _mwVar(t.x) && _mwVar(t.y) && _mwVar(t.z); })
      .map(function(t){ return t.key; }).indexOf(_mwSec.takoz);
    if(ti >= 0) secili = { tur:'takoz', i:ti };
  }
  return { veri:v, secili:secili };
}
function _mwMasaCiz(c){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-mw-masa-cizim');
  if(!el || !_mwState) return;
  var k = VE_MW_STEPS[_mwStep].key, tur = _mwMasaTur(k), o = _mwMasaOlc();
  if(tur === 'tork'){ el.innerHTML = _mwTorkZincirSVG(c, o.w, o.h); return; }
  var f = _mwFigurVeri(c);
  var svg = (typeof veMnt2DGorunusSVG === 'function')
    ? veMnt2DGorunusSVG(f.veri, o.w, o.h, { gorunus:_mwGorunus, secili:f.secili, secim:true, pay:_mwMasaPay(o, k) }) : '';
  if(!svg){
    el.innerHTML = '<div class="ve-fw-masa-bos">' + (k === 'kaynak'
      ? 'Model boş — örnekten doldur, STEP\'ten başla ya da Kütle gövdeleri adımında ekle.'
      : 'Çizilecek gövde ya da takoz yok — konumu girilen öğe masada görünür.') + '</div>';
    return;
  }
  el.innerHTML = svg;
  _mwGorUygula();
}
function _mwGorUygula(){
  var svg = (typeof document !== 'undefined') ? document.querySelector('#ve-mw-masa-cizim > svg') : null;
  if(!svg) return;
  var o = _mwMasaOlcu, g = _mwGorDurum();
  svg.setAttribute('viewBox', [g.tx, g.ty, o.w / g.z, o.h / g.z].map(function(v){ return Math.round(v * 100) / 100; }).join(' '));
}
// Yakınlaşma: f çarpanı, (sx, sy) masanın içindeki ekran noktası (verilmezse merkez).
function _mwGorZoom(f, sx, sy){
  var o = _mwMasaOlcu, g = _mwGorDurum();
  if(sx === undefined){ sx = o.w / 2; sy = o.h / 2; }
  var z2 = Math.max(VE_MW_GOR_Z[0], Math.min(VE_MW_GOR_Z[1], g.z * f));
  var ux = g.tx + sx / g.z, uy = g.ty + sy / g.z;
  g.tx = ux - sx / z2; g.ty = uy - sy / z2; g.z = z2;
  _mwGorUygula();
}
function veMntWizZoom(yon){
  if(yon === 0){ _mwGor[_mwGorAnahtar()] = { z:1, tx:0, ty:0 }; _mwGorUygula(); return; }
  _mwGorZoom(yon > 0 ? 1.25 : 0.8);
}
// Dinleyiciler masanın KABINA bir kez bağlanır (çizim her yamada yenilenir).
function _mwMasaBagla(){
  if(typeof document === 'undefined') return;
  var m = document.getElementById('ve-mw-masa');
  if(!m || m.__mwBagli) return;
  m.__mwBagli = true;
  m.addEventListener('wheel', function(e){
    if(!m.hasAttribute('data-gezin')) return;
    e.preventDefault();
    var r = m.getBoundingClientRect();
    _mwGorZoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  }, { passive:false });
  m.addEventListener('pointerdown', function(e){
    if(!m.hasAttribute('data-gezin') || e.button !== 0) return;
    if(e.target.closest && e.target.closest('button, .ve-fw-cip')) return;
    _mwKaydir = { x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, id:e.pointerId };
    try { m.setPointerCapture(e.pointerId); } catch(er){}
  });
  m.addEventListener('pointermove', function(e){
    if(!_mwKaydir) return;
    var g = _mwGorDurum();
    g.tx -= (e.clientX - _mwKaydir.x) / g.z; g.ty -= (e.clientY - _mwKaydir.y) / g.z;
    _mwKaydir.x = e.clientX; _mwKaydir.y = e.clientY;
    if(Math.hypot(e.clientX - _mwKaydir.x0, e.clientY - _mwKaydir.y0) > 3) m.classList.add('kayiyor');
    _mwGorUygula();
  });
  var bitir = function(e){
    if(!_mwKaydir) return;
    var hareket = Math.hypot(e.clientX - _mwKaydir.x0, e.clientY - _mwKaydir.y0);
    try { m.releasePointerCapture(_mwKaydir.id); } catch(er){}
    _mwKaydir = null; m.classList.remove('kayiyor');
    if(hareket > 3) return;
    // TIKLAMA: işaretin üstündeyse seç (yakalama hedefi değiştirdiği için nokta sorulur).
    var hedef = document.elementFromPoint ? document.elementFromPoint(e.clientX, e.clientY) : e.target;
    var g = hedef && hedef.closest ? hedef.closest('[data-mnt-sec]') : null;
    if(g) _mwMasaSec(g.getAttribute('data-mnt-sec'));
  };
  m.addEventListener('pointerup', bitir);
  m.addEventListener('pointercancel', function(){ _mwKaydir = null; m.classList.remove('kayiyor'); });
  if(typeof ResizeObserver !== 'undefined'){
    if(_mwMasaRO){ try { _mwMasaRO.disconnect(); } catch(er){} }
    _mwMasaRO = new ResizeObserver(function(){
      var once = _mwMasaOlcu, yeni = _mwMasaOlc();
      if(Math.abs(once.w - yeni.w) > 2 || Math.abs(once.h - yeni.h) > 2) _mwMasaCiz(_mwCoz || veMntWizCoz(_mwState));
    });
    try { _mwMasaRO.observe(m); } catch(er){}
  }
}
// Masadaki işaret → satır: çizimin dizisi yalnız konumu tam olan öğeleri taşır.
function _mwMasaSec(deger){
  var p = String(deger || '').split(':'), i = +p[1], st = _mwState;
  if(!st || !Number.isFinite(i)) return;
  if(p[0] === 'takoz'){
    var ts = st.takozlar.filter(function(t){ return _mwVar(t.x) && _mwVar(t.y) && _mwVar(t.z); });
    if(ts[i]){ _mwSec.takoz = ts[i].key; if(VE_MW_STEPS[_mwStep].key !== 'takoz') _mwStep = _mwAdimNo('takoz') - 1; veMntWizRender(); }
  } else if(p[0] === 'govde'){
    var gs = st.govdeler.filter(function(g){ return _mwVar(g.cgx) && _mwVar(g.cgy) && _mwVar(g.cgz); });
    if(gs[i]){ _mwSec.govde = gs[i].key; if(VE_MW_STEPS[_mwStep].key !== 'govde') _mwStep = _mwAdimNo('govde') - 1; veMntWizRender(); }
  }
}

// TORK ZİNCİRİ — motor torkundan şaft torkuna, halka halka. Sayılar çekirdeğin
// zinciri (`torqueChain`, çözücünün tork yük durumu da onu kullanır); sunum
// yalnız halkaları dizer.
function _mwTorkZincirSVG(c, W, H){
  var tq = (_mwState || {}).tork || {};
  var Te = _mwNum(tq.Te), Rs = _mwNum(tq.Rstall), g1 = _mwNum(tq.g1), gR = _mwNum(tq.gR);
  var iTr = _mwNum(tq.iTransfer), pf = _mwNum(tq.phiFwd), pr = _mwNum(tq.phiRev);
  var x = function(v, d){ return Number.isFinite(v) ? _mwSayi(v, d === undefined ? 3 : d) : '—'; };
  var halkalar = [
    { ad:'Motor', alt:'tepe tork', deg:Number.isFinite(Te) ? x(Te, 0) + ' N·m' : 'girilmedi' },
    { ad:'Konvertör', alt:'stall oranı', deg:'× ' + x(Rs, 2) },
    { ad:'Şanzıman', alt:'1. vites · geri', deg:'× ' + x(g1, 2) + ' · ' + x(gR, 2) },
    { ad:'Transfer', alt:'oran', deg:'× ' + x(Number.isFinite(iTr) ? iTr : 1, 3) },
    { ad:'Aks payı', alt:'φ ileri · geri', deg:'× ' + x(Number.isFinite(pf) ? pf : 1, 3) + ' · ' + x(Number.isFinite(pr) ? pr : 1, 3) }
  ];
  W = Math.max(W, 360); H = Math.max(H, 260);
  var pad = 28, n = halkalar.length, kutuW = Math.min(150, (W - 2 * pad - (n - 1) * 26) / n), kutuH = 74;
  var y0 = Math.max(70, H * 0.3), adim = kutuW + 26;
  var s = '<svg class="ve-mw-tz" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tork zinciri">';
  halkalar.forEach(function(h, i){
    var x0 = pad + i * adim;
    s += '<g class="ve-mw-tz-halka"><rect x="' + x0 + '" y="' + y0 + '" width="' + kutuW + '" height="' + kutuH + '" rx="8"/>'
      + '<text class="ve-mw-tz-ad" x="' + (x0 + 10) + '" y="' + (y0 + 22) + '">' + _mwEsc(h.ad) + '</text>'
      + '<text class="ve-mw-tz-alt" x="' + (x0 + 10) + '" y="' + (y0 + 40) + '">' + _mwEsc(h.alt) + '</text>'
      + '<text class="ve-mw-tz-deg" x="' + (x0 + 10) + '" y="' + (y0 + 60) + '">' + _mwEsc(h.deg) + '</text></g>';
    if(i < n - 1) s += '<line class="ve-mw-tz-ok" x1="' + (x0 + kutuW + 3) + '" y1="' + (y0 + kutuH / 2) + '" x2="' + (x0 + adim - 5) + '" y2="' + (y0 + kutuH / 2) + '"/>'
      + '<path class="ve-mw-tz-uc" d="M' + (x0 + adim - 5) + ' ' + (y0 + kutuH / 2) + ' l-6 -4 v8 z"/>';
  });
  // SONUÇLAR TEK SÜTUN, SAĞA YASLI (sağ sütunun "Zincirin sonucu"yla aynı
  // okuma): değerler iki ayrı sabit x'te ve sola yaslıydı — "12.761" ile
  // "−18.482"nin basamakları alt alta gelmiyor, ateşleme frekansının "—"sı
  // başka bir sütunda duruyordu. Sütunun sağ kenarı üçüncü halkanın sağı;
  // dar masada en uzun etiketin (≈ 250 px) sağından başlar.
  var sy = y0 + kutuH + 56, xDeg = Math.max(pad + 3 * adim - 26, Math.min(W - pad, pad + 380));
  var sonuc = function(et, deg, yy){
    return '<text class="ve-mw-tz-alt" x="' + pad + '" y="' + yy + '">' + et + '</text>'
      + '<text class="ve-mw-tz-sonuc" x="' + xDeg + '" y="' + yy + '" text-anchor="end">' + deg + '</text>';
  };
  var tork = function(v){ return Number.isFinite(v) ? _mwSayi(v, 0) + ' N·m' : '—'; };
  s += sonuc('Şaft torku · ileri', tork(c.tork ? c.tork.ileri : NaN), sy);
  s += sonuc('Şaft torku · geri', tork(c.tork ? c.tork.geri : NaN), sy + 24);
  s += sonuc('Ateşleme frekansı (rölanti · silindir)', Number.isFinite(c.fAtes) ? _mwSayi(c.fAtes, 1) + ' Hz' : '—', sy + 60);
  return s + '</svg>';
}

// ── KURULUM ───────────────────────────────────────────────────────────────
// Kapı YALNIZ yapısal (FEAD kural 52): kurulacak bir şey var mı. Eksik girdi
// engel değildir — model tuvalde de tamamlanabilir; çözülmeyen model kurulur.
function veMntWizCanCreate(){
  var st = _mwState;
  if(!st) return { ok:false, sebep:'Sihirbaz açık değil.' };
  if(!st.govdeler.length && !st.takozlar.length) return { ok:false, sebep:'Kurulacak gövde ya da takoz yok.' };
  if(typeof createNode !== 'function') return { ok:false, sebep:'Tuval hazır değil.' };
  return { ok:true };
}
function veMntWizKur(){
  var st = _mwState;
  var kapi = veMntWizCanCreate();
  if(!kapi.ok){ if(typeof showToast === 'function') showToast(kapi.sebep, 'warning'); return null; }
  var pl = _mwKurulumPlani();
  if(pl.sil && typeof confirm === 'function'
     && !confirm('Tuvaldeki ' + pl.sil + ' kütle/takoz bileşeni sihirbazın modelinde yok ve çıkarılacak. Devam edilsin mi?')) return null;
  var paket = veMntWizNodes(st);
  var sonuc = { yeni:[], guncel:[], sil:0 };
  var kur = function(){
    var tuval = _mwTuvalModeli(), tutulan = {};
    // 1) Yerinde güncelleme (tip aynıysa): konum, bağlantı ve görünüm verisi korunur.
    paket.forEach(function(p){
      var n = p._dugum ? tuval.filter(function(x){ return x.id === p._dugum; })[0] : null;
      if(!n || n.type !== p.type) return;
      tutulan[n.id] = 1;
      var d = n.data || (n.data = {});
      var alanlar = (p.rol === 'govde') ? VE_MW_GOVDE_ALAN.concat(VE_MW_TORK.reduce(function(a, g){ return a.concat(g.alan); }, []))
                                       : VE_MW_TAKOZ_ALAN;
      alanlar.forEach(function(k){ delete d[k]; });
      Object.keys(p.data).forEach(function(k){ d[k] = p.data[k]; });
      if(typeof _mntSetNodeName === 'function') _mntSetNodeName(n, p.customName);
      else n.customName = p.customName;
      sonuc.guncel.push(n);
    });
    // 2) Listede olmayanlar (ya da tipi değişenler) çıkar.
    tuval.forEach(function(n){
      if(tutulan[n.id]) return;
      if(typeof _mntRemoveNode === 'function') _mntRemoveNode(n.id);
      sonuc.sil++;
    });
    // 3) Yeniler — yerleşim tabanı paketin ve araç şeridinin birlikte ortası.
    var yuva = paket.map(function(p){ return { lx:p.lx || 0, ly:p.ly || 0 }; })
      .concat((typeof VE_MNT_STARTER_LAYOUT !== 'undefined' ? VE_MNT_STARTER_LAYOUT : [])
        .filter(function(it){ return it.ly === 20; }).map(function(it){ return { lx:it.lx, ly:it.ly }; }));
    var base = (typeof veArrangeModuleBase === 'function' && yuva.length) ? veArrangeModuleBase(yuva) : { x:3000, y:3000 };
    paket.forEach(function(p){
      var n = p._dugum ? nodes.filter(function(x){ return x.id === p._dugum && tutulan[x.id]; })[0] : null;
      if(n) return;
      var once = nodes.length;
      createNode(p.type, base.x + (p.lx || 0), base.y + (p.ly || 0));
      if(nodes.length > once){
        var yeni = nodes[nodes.length - 1];
        yeni.data = Object.assign(yeni.data || {}, p.data);
        if(typeof _mntSetNodeName === 'function') _mntSetNodeName(yeni, p.customName); else yeni.customName = p.customName;
        sonuc.yeni.push(yeni);
      }
    });
    // 4) Analiz araçları (eksik olan) ve görsel destek bağlantıları — yapı
    //    değiştiyse bağlantılar baştan kurulur (salt görsel, çözücüye girmez).
    if(typeof _mntAracGaranti === 'function') _mntAracGaranti(base);
    if(sonuc.yeni.length || sonuc.sil){
      var govdeTakoz = nodes.filter(function(n){ var d = _mwDef(n); return d.isMountBody || d.isMount; });
      var kimlik = {}; govdeTakoz.forEach(function(n){ kimlik[n.id] = 1; });
      if(typeof connections !== 'undefined')
        connections = connections.filter(function(cn){ return !(kimlik[cn.from] && kimlik[cn.to]); });
      if(typeof _mntWireSupportLinks === 'function')
        _mntWireSupportLinks(govdeTakoz.map(function(n){
          return { id:n.id, kind:n.type, lx:n.x, ly:n.y,
                   inCount:(typeof nodePortCount === 'function') ? nodePortCount(n, 'inputs') : 1 };
        }));
    }
  };
  if(typeof veStateBatch === 'function') veStateBatch(kur); else kur();
  if(typeof updateAllConnections === 'function') updateAllConnections();
  if(typeof updateNodeCount === 'function') updateNodeCount();
  if(typeof _mntSecimiBirak === 'function') _mntSecimiBirak();
  else if(typeof clearSelection === 'function') clearSelection();
  if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(false);
  if(typeof veFitViewToContent === 'function') veFitViewToContent({ maxZoom:1 });
  delete _mwTaslaklar[_mwModulId()];
  var mesaj = 'Model kuruldu — ' + st.govdeler.length + ' gövde · ' + st.takozlar.length + ' takoz'
    + (sonuc.guncel.length ? ' (' + sonuc.guncel.length + ' yerinde güncellendi)' : '');
  veMntWizKapat(false);
  if(typeof showToast === 'function') showToast(mesaj, 'success');
  return sonuc;
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    VE_MW_STEPS: VE_MW_STEPS, VE_MW_GOVDE_TIPLERI: VE_MW_GOVDE_TIPLERI, VE_MW_TORK: VE_MW_TORK,
    veMntWizDefault: veMntWizDefault, veMntWizState: veMntWizState, veMntWizFromNodes: veMntWizFromNodes,
    veMntWizNodes: veMntWizNodes, veMntWizSorunlar: veMntWizSorunlar, veMntWizCoz: veMntWizCoz,
    veMntWizIssues: veMntWizIssues, veMntWizStepState: veMntWizStepState,
    veMntWizAc: veMntWizAc, veMntWizAcStep: veMntWizAcStep, veMntWizAcik: veMntWizAcik, veMntWizKapat: veMntWizKapat,
    veMntWizGo: veMntWizGo, veMntWizGoto: veMntWizGoto, veMntWizRender: veMntWizRender, veMntWizLive: veMntWizLive,
    veMntWizGovdeEkle: veMntWizGovdeEkle, veMntWizGovdeSil: veMntWizGovdeSil, veMntWizGovdeTip: veMntWizGovdeTip,
    veMntWizNokta: veMntWizNokta, veMntWizTakozEkle: veMntWizTakozEkle, veMntWizTakozSil: veMntWizTakozSil,
    veMntWizTakozAyna: veMntWizTakozAyna, veMntWizTakozKatalog: veMntWizTakozKatalog, veMntWizTakozElle: veMntWizTakozElle,
    veMntWizMotorKatalog: veMntWizMotorKatalog, veMntWizSec: veMntWizSec, veMntWizGorunus: veMntWizGorunus,
    veMntWizOrnek: veMntWizOrnek, veMntWizOrnekSec: veMntWizOrnekSec, veMntWizOrnekAdim: veMntWizOrnekAdim,
    veMntWizSifirla: veMntWizSifirla, veMntWizCanCreate: veMntWizCanCreate, veMntWizKur: veMntWizKur,
    veMntWizZoom: veMntWizZoom, _mwSet: _mwSet, _mwYerlesim: _mwYerlesim, _mwAynaAd: _mwAynaAd,
    _mwMasaPay: _mwMasaPay, VE_MW_OZET_PANEL: VE_MW_OZET_PANEL, _mwStepOzet: _mwStepOzet,
    _mwStepTork: _mwStepTork, _mwTakozListeHTML: _mwTakozListeHTML, veMntWizNavHTML: veMntWizNavHTML,
    _mwOrnekModelden: _mwOrnekModelden, _mwKurulumPlani: _mwKurulumPlani, _mwTorkZincirSVG: _mwTorkZincirSVG,
    veMntWizStp: veMntWizStp, veMntWizStpOku: veMntWizStpOku, veMntWizStpBayt: veMntWizStpBayt,
    veMntWizStpRol: veMntWizStpRol, veMntWizStpHesapla: veMntWizStpHesapla, veMntWizStpKutle: veMntWizStpKutle,
    veMntWizStpDenetim: veMntWizStpDenetim, veMntWizStpAktar: veMntWizStpAktar, veMntWizStpKapat: veMntWizStpKapat,
    veMntWizStpDrop: veMntWizStpDrop, _mwStpKartHTML: _mwStpKartHTML, _mwStpOnizleme: _mwStpOnizleme,
    _mwTaslakSifirla: function(){ _mwTaslaklar = {}; },
    _mwStpSifirla: function(){ _mwStp = null; }
  };
}
