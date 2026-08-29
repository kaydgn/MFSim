// ════════════════════════════════════════════════════════════════════════════
//  FEAD BAŞLANGIÇ SİHİRBAZI — adım adım model kurulumu
// ════════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-08-29): *"Bir 'Başlangıç Sihirbazı' bileşeni
// kuracağız. Bu bileşene tıkladığımızda adım adım bir modeli kurmak için
// gereken tüm girdileri gireceğiz. İlk sayfada sihirbaz kullanıcıya kasnak
// koordinatlarını soracak, diğer sayfada diğer girdileri…"*
//
// Sihirbazın çözdüğü sorun bir eksiklik değil bir SIRA sorunuydu: bütün
// girdiler zaten paneller içinde vardı, ama hangi sırayla gireceğini ve hangi
// alanın hangi belgeden okunduğunu ancak modülü bilen biri biliyordu. Boş bir
// iç topolojide kullanıcı "önce ne koyayım" sorusuyla baş başa kalıyordu.
//
// ── ÜÇ KURAL, ÜÇÜ DE BU MODÜLÜN KENDİ DERSLERİNDEN ─────────────────────────
//
// 1. SİHİRBAZ KENDİ MODELİNİ KURMAZ. Durum → `veFeadWizNodes` → `fead-model`in
//    düğüm biçimi. ÖNİZLEME de KURULUM da AYNI listeden geçiyor; ikinci bir
//    kurucu yazmak, önizlemenin kurulan modelden sessizce ayrışması demekti —
//    bu modülde defalarca ölçülmüş hata sınıfı ("panel ile kart AYNI alanı
//    okur").
//
// 2. DOĞRULAMA DA KÖPRÜDEN. Her adımda `veFeadBuildSystem` koşuyor ve onun
//    `errors/warnings` listesi süzülüp gösteriliyor. İkinci bir zorunlu-alan
//    listesi tutmak, köprü değiştiğinde sessizce eskiyen bir kapı olurdu.
//    Köprü hiçbir durumda istisna atmıyor (yarım model onun sözleşmesinde
//    zaten var), yani sihirbaz ilk adımdan itibaren canlı çalışabiliyor.
//
// 3. DURUM OTURUMLUK, KURULUM KALICI. Her tuş vuruşunda `saveState()` çağırmak
//    kırk alanlık bir formda geri-al yığınını kullanılamaz hale getirirdi
//    (panel alanlarının kuralı burada geçerli değil: orada bir alan = bir
//    karar). Yarım kalan sihirbaz kaybolmasın diye durum KAPANIŞTA
//    `node.data.wiz`e yazılıyor; `saveState` yalnız kapanışta ve kurulumda.
//
// ── KAYIŞ SIRASI = KABLOLAMA ───────────────────────────────────────────────
// Sihirbazdaki sıra doğrudan bağlantı sırasıdır; dönüş yönü (CW/CCW) ondan
// TÜRER, ayrı bir alan yok. "Dönüş Yönü" bileşeninin dersi (durum kablolarda
// tutulur, bayrakta değil) burada da geçerli.

var VE_FW_STEPS = [
  { key:'kaynak', ad:'Başlangıç',      ipucu:'Sistem adı ve gerginin tanım biçimi' },
  { key:'kasnak', ad:'Kasnaklar',      ipucu:'Tip · çap · koordinat · temas tarafı · sürücü' },
  { key:'yol',    ad:'Kayış Yolu',     ipucu:'Serpantin sırası — kablolamayı bu belirler' },
  { key:'gergi',  ad:'Otomatik Gergi', ipucu:'Montaj noktası · kol boyu · yay künyesi' },
  { key:'kayis',  ad:'Kayış',          ipucu:'Profil · kanal sayısı · katalog sonuçları' },
  { key:'cevrim', ad:'Motor ve Çevrim',ipucu:'Tahrik oranı · motor künyesi · çalışma çevrimi' },
  { key:'ozet',   ad:'Özet ve Kurulum',ipucu:'Canlı çözüm · kayış yolu şeması · modeli kur' }
];

// Kasnak tipleri — ad ve varsayılan temas tarafı componentDefs'ten okunuyor,
// burada İKİNCİ BİR LİSTE tutulmuyor (tip eklendiğinde sessizce eskimesin).
var VE_FW_PULLEY_TYPES = ['fead-crank', 'fead-fan', 'fead-alternator', 'fead-ac',
  'fead-waterpump', 'fead-ps', 'fead-aircomp', 'fead-idler'];

var _fwState = null;       // oturumluk durum
var _fwNodeId = null;      // sihirbazı açan düğüm
var _fwStep = 0;
var _fwBuild = null;       // son çözüm (önizleme)
var _fwLiveTimer = null;
var _fwSeq = 0;            // kasnak anahtarı üreteci

function _fwEsc(s){
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _fwNum(v, d){
  if(v === undefined || v === null || v === '') return (d === undefined) ? NaN : d;
  var x = (typeof v === 'string') ? v.trim().replace(',', '.') : v;
  var n = Number(x);
  return Number.isFinite(n) ? n : ((d === undefined) ? NaN : d);
}
function _fwFmt(x, dg){
  if(!Number.isFinite(x)) return '—';
  return x.toFixed(dg === undefined ? 1 : dg);
}
function _fwDefName(type){
  var d = (typeof componentDefs !== 'undefined' && componentDefs[type]) || {};
  return d.name || type;
}

// ── BOŞ DURUM ──────────────────────────────────────────────────────────────
// Varsayılan gergi kipi ZARF: köprünün kendi varsayılanıyla aynı (bkz.
// tek koordinat: montaj konumu). İki yüzey farklı
// varsayarsa kullanıcı sihirbazda bir soru görür, panelde başkasını.
function veFeadWizDefault(){
  return {
    ad: 'Yeni FEAD Sistemi',
    pulleys: [],
    ten: { od: 75, contact: 'back', armLen: 90, tenLib: '' },
    route: [],
    belt: { profile: 'PK', brand: 'GATES', ribs: 8 },
    solver: { ratioMode: 'direct', driveRatio: 1, cylinders: 6, serviceFact: 1.3,
              duty: [] },
    temizle: false
  };
}

function _fwKey(){ return 'p' + (++_fwSeq); }

// Yeni kasnak satırı. Çap TİP VARSAYILANINDAN geliyor (VE_FEAD_DEFAULT_DIA) —
// boş bırakmak kullanıcıyı her satırda katalog aramaya zorlardı; sayı yine de
// düzenlenebilir ve köprü girilmemiş çapı ayrıca UYARIYOR.
function _fwNewPulley(type){
  var t = type || 'fead-alternator';
  var dia = (typeof VE_FEAD_DEFAULT_DIA !== 'undefined' && VE_FEAD_DEFAULT_DIA[t]) || 80;
  var def = (typeof componentDefs !== 'undefined' && componentDefs[t]) || {};
  return { key: _fwKey(), type: t, name: '', od: dia, x: '', y: '',
           contact: (def.feadContact === 'back') ? 'back' : 'grooved', driver: false };
}

// ── DURUM ──────────────────────────────────────────────────────────────────
function veFeadWizState(){ return _fwState; }

function _fwGet(path){
  var o = _fwState, p = String(path).split('.');
  for(var i = 0; i < p.length && o != null; i++) o = o[p[i]];
  return o;
}
function _fwSet(path, val){
  if(!_fwState) return;
  var p = String(path).split('.'), o = _fwState;
  for(var i = 0; i < p.length - 1; i++){ if(o[p[i]] == null) o[p[i]] = {}; o = o[p[i]]; }
  o[p[p.length - 1]] = val;
  veFeadWizLiveSoon();
}
// Seçim/anahtar değişimi: durum + TAM yeniden çizim (alanların kendisi değişir).
function _fwSetRender(path, val){ _fwSet(path, val); veFeadWizRender(); }

// ── KASNAK SATIRLARI ───────────────────────────────────────────────────────
function veFeadWizPulleyAdd(type){
  if(!_fwState) return;
  var p = _fwNewPulley(type);
  // İLK KASNAK SÜRÜCÜ DOĞAR. Sürücülük bir ROL (bkz. fead-model.js) ve boş
  // bırakılırsa köprü "açıkça seçilmedi" uyarısı basıyor; sihirbazın ilk
  // satırında bu uyarıyı doğurmak, kullanıcıya kendi kurduğu şeyi hata gibi
  // göstermek olurdu.
  if(!_fwState.pulleys.length) p.driver = true;
  _fwState.pulleys.push(p);
  _fwState.route.push(p.key);
  veFeadWizRender();
}
function veFeadWizPulleyDel(key){
  if(!_fwState) return;
  _fwState.pulleys = _fwState.pulleys.filter(function(p){ return p.key !== key; });
  _fwState.route = _fwState.route.filter(function(k){ return k !== key; });
  // Duty satırlarındaki kW sütunu da gitmeli; kalırsa kurulumda eşleşmeyen bir
  // anahtar olarak taşınır ve "girilmiş ama görünmeyen" bir güç üretirdi.
  (_fwState.solver.duty || []).forEach(function(r){ if(r.kw) delete r.kw[key]; });
  if(!_fwState.pulleys.some(function(p){ return p.driver; }) && _fwState.pulleys.length)
    _fwState.pulleys[0].driver = true;
  veFeadWizRender();
}
function veFeadWizPulleySet(key, alan, val){
  if(!_fwState) return;
  var p = _fwState.pulleys.filter(function(x){ return x.key === key; })[0];
  if(!p) return;
  p[alan] = val;
  veFeadWizLiveSoon();
}
// SÜRÜCÜ TEK OLABİLİR — köprü birden fazlasını hata sayıyor. Radyo davranışı
// burada zorlanıyor ki kullanıcı hatayı ancak son adımda görmesin.
function veFeadWizDriver(key){
  if(!_fwState) return;
  _fwState.pulleys.forEach(function(p){ p.driver = (p.key === key); });
  veFeadWizRender();
}
function veFeadWizPulleyType(key, type){
  if(!_fwState) return;
  var p = _fwState.pulleys.filter(function(x){ return x.key === key; })[0];
  if(!p) return;
  var eskiVar = (typeof VE_FEAD_DEFAULT_DIA !== 'undefined')
    && _fwNum(p.od, 0) === (VE_FEAD_DEFAULT_DIA[p.type] || 80);
  p.type = type;
  var def = (typeof componentDefs !== 'undefined' && componentDefs[type]) || {};
  p.contact = (def.feadContact === 'back') ? 'back' : 'grooved';
  // Çap YALNIZ dokunulmamışsa tazelenir: kullanıcının girdiği ölçüyü tip
  // değişince silmek, sessiz bir veri kaybı olurdu.
  if(eskiVar && typeof VE_FEAD_DEFAULT_DIA !== 'undefined')
    p.od = VE_FEAD_DEFAULT_DIA[type] || 80;
  veFeadWizRender();
}

// ── SIRA ───────────────────────────────────────────────────────────────────
function veFeadWizRouteMove(key, delta){
  if(!_fwState) return;
  var r = _fwState.route, i = r.indexOf(key), j = i + delta;
  if(i < 0 || j < 0 || j >= r.length) return;
  var t = r[i]; r[i] = r[j]; r[j] = t;
  veFeadWizRender();
}
// Sırayı çevirmek = dönüş yönünü çevirmek. Ayrı bir "yön" alanı YOK; yön
// kablolamadan türüyor (fead-spin bileşeninin kuralının aynısı).
function veFeadWizRouteReverse(){
  if(!_fwState) return;
  var r = _fwState.route.slice();
  if(r.length > 2) _fwState.route = [r[0]].concat(r.slice(1).reverse());
  veFeadWizRender();
}

// ── ÇALIŞMA ÇEVRİMİ ────────────────────────────────────────────────────────
function veFeadWizDutyAdd(){
  if(!_fwState) return;
  var d = _fwState.solver.duty;
  var son = d.length ? d[d.length - 1] : null;
  d.push({ rpm: son ? _fwNum(son.rpm, 1000) + 500 : 1000,
           dcPct: '', degC: son ? son.degC : 90, kw: {} });
  veFeadWizRender();
}
function veFeadWizDutyDel(i){
  if(!_fwState) return;
  _fwState.solver.duty.splice(i, 1);
  veFeadWizRender();
}
function veFeadWizDutySet(i, alan, val){
  if(!_fwState) return;
  var r = _fwState.solver.duty[i];
  if(!r) return;
  r[alan] = val;
  veFeadWizLiveSoon();
}
function veFeadWizDutyKw(i, key, val){
  if(!_fwState) return;
  var r = _fwState.solver.duty[i];
  if(!r) return;
  if(!r.kw) r.kw = {};
  r.kw[key] = val;
  veFeadWizLiveSoon();
}

// ── GERGİ KÜNYE KÜTÜPHANESİ ────────────────────────────────────────────────
// Kütüphane bir KISIT değil bir ÖNERİ (kayış kataloğuyla aynı kural): seçim
// alanları DOLDURUR, kilitlemez. Künye pivot ve kol açısı YAZMAZ — ikisi de
// motorun verisi, parçanın değil (bkz. fead-tensioners.js).
function veFeadWizTenLib(key){
  if(!_fwState) return;
  _fwState.ten.tenLib = key || '';
  if(key && typeof veFeadTensionerOf === 'function'){
    var rec = veFeadTensionerOf(key);
    if(rec && typeof veFeadTensionerApply === 'function'){
      var kopya = {};
      veFeadTensionerApply(kopya, rec);
      ['armLen', 'preload', 'kArm', 'meanLoad', 'od', 'contact', 'armInertia',
       'pulleyMass', 'loadStopRelDeg', 'tenLib', 'tenLibVer'].forEach(function(a){
        if(kopya[a] !== undefined) _fwState.ten[a] = kopya[a];
      });
    }
  }
  veFeadWizRender();
}

// ── ÖRNEKTEN DOLDUR ────────────────────────────────────────────────────────
// Sihirbazın en ucuz öğretme yolu: doğru doldurulmuş bir formu göstermek.
// Örnek tanımı tek kaynak (VE_FEAD_EXAMPLES) — burada ikinci bir kopya yok.
function veFeadWizSeed(key){
  if(typeof veFeadExampleOf !== 'function') return false;
  var ex = veFeadExampleOf(key);
  if(!ex) return false;
  var st = veFeadWizDefault();
  st.ad = ex.name || key;
  var keyMap = {};
  ex.pulleys.forEach(function(p){
    var d = p.data || {};
    if((componentDefs[p.type] || {}).isFeadTensioner){
      st.ten = JSON.parse(JSON.stringify(d));
      st.ten.name = p.name;
      keyMap[p.key] = '__ten__';
      return;
    }
    var row = { key: _fwKey(), type: p.type, name: p.name || '',
                od: d.od, x: d.x, y: d.y,
                contact: (typeof veFeadContactOf === 'function')
                  ? veFeadContactOf({ type: p.type, data: d }) : 'grooved',
                driver: !!d.driver };
    if(d.inertia !== undefined) row.inertia = d.inertia;
    if(d.pwrCurve) row.pwrCurve = JSON.parse(JSON.stringify(d.pwrCurve));
    keyMap[p.key] = row.key;
    st.pulleys.push(row);
  });
  st.route = (ex.route || []).map(function(k){ return keyMap[k]; })
    .filter(function(k){ return !!k; });
  st.belt = JSON.parse(JSON.stringify(ex.belt || {}));
  st.solver = JSON.parse(JSON.stringify(ex.solver || {}));
  // Duty kW'ı örnekte KASNAK ANAHTARIYLA yazılı; sihirbaz da anahtarla tutuyor
  // (kimliğe çeviri tek yerde: veFeadWizNodes). Çeviri burada yapılsaydı
  // sihirbaz durumu düğüm kurma ayrıntısına bağlanırdı.
  (st.solver.duty || []).forEach(function(r){
    var kaynak = r.kwByKey || r.kw || {};
    var kw = {};
    Object.keys(kaynak).forEach(function(k){ if(keyMap[k]) kw[keyMap[k]] = kaynak[k]; });
    r.kw = kw;
    delete r.kwByKey;
  });
  st.temizle = false;
  _fwState = st;
  _fwStep = 0;
  veFeadWizRender();
  return true;
}

// ════════════════════════════════════════════════════════════════════════════
//  DURUM → DÜĞÜM LİSTESİ  (DOM'suz, saf)
// ════════════════════════════════════════════════════════════════════════════
//
// Çıktı biçimi `veFeadExampleNodes` ile AYNI: {nodes, connections, solverId}.
// Aynı olması şart, çünkü kurulum yolu (veFeadWizCreate) örnek kurucusunun
// yolundan geçiyor ve önizleme de aynı listeyi köprüye veriyor. Tek fark:
// burada kaynak bir form, orada bir kayıt defteri.
function veFeadWizNodes(st){
  st = st || _fwState;
  if(!st) return { nodes: [], connections: [], solverId: null };
  var out = [], byKey = {};

  st.pulleys.forEach(function(p){
    var d = { od: _fwNum(p.od, undefined), contact: p.contact };
    if(Number.isFinite(_fwNum(p.x, NaN))) d.x = _fwNum(p.x, NaN);
    if(Number.isFinite(_fwNum(p.y, NaN))) d.y = _fwNum(p.y, NaN);
    if(!Number.isFinite(d.od)) delete d.od;
    if(p.driver) d.driver = true;
    if(Number.isFinite(_fwNum(p.inertia, NaN))) d.inertia = _fwNum(p.inertia, NaN);
    if(p.pwrCurve) d.pwrCurve = JSON.parse(JSON.stringify(p.pwrCurve));
    var n = { id: 'wz-' + p.key, type: p.type,
              customName: p.name || _fwDefName(p.type), data: d };
    byKey[p.key] = n;
    out.push(n);
  });

  // ── GERGİ ────────────────────────────────────────────────────────────────
  // `angleMode` AÇIKÇA yazılıyor: köprü onu veriden de çözebiliyor ama sihirbaz
  // kullanıcıya hangi soruyu sorduğunu biliyor, ve açık seçim her zaman kazanır
  // Yazılmasaydı yarım doldurulmuş bir formda kip
  // kullanıcının seçtiğinden BAŞKA çıkabilirdi.
  var t = st.ten || {};
  var td = { od: _fwNum(t.od, 75), contact: t.contact || 'back',
             armLen: _fwNum(t.armLen, NaN) };
  if(!Number.isFinite(td.armLen)) delete td.armLen;
  ['preload', 'kArm', 'meanLoad', 'armInertia', 'pulleyMass', 'loadStopRelDeg',
   'inertia'].forEach(function(a){
    var v = _fwNum(t[a], NaN);
    if(Number.isFinite(v)) td[a] = v;
  });
  // KİPE GÖRE HANGİ KOORDİNAT TAŞINIR — ve ötekiler TAŞINMAZ. Zarf kipinde
  // montaj merkezini de yazmak, köprünün "iki koordinat da var" uyarısını
  // doğurur ve kullanıcı girmediği bir alandan uyarı alırdı.
  if(Number.isFinite(_fwNum(t.pivotX, NaN))) td.pivotX = _fwNum(t.pivotX, NaN);
  if(Number.isFinite(_fwNum(t.pivotY, NaN))) td.pivotY = _fwNum(t.pivotY, NaN);
  if(t.armPinned && Number.isFinite(_fwNum(t.armMeanDeg, NaN))){
    td.armPinned = true; td.armMeanDeg = _fwNum(t.armMeanDeg, NaN);
  }

  if(t.tenLib) td.tenLib = t.tenLib;
  if(t.tenLibVer) td.tenLibVer = t.tenLibVer;
  var tenNode = { id: 'wz-ten', type: 'fead-tensioner',
                  customName: t.name || 'Otomatik Gergi', data: td };
  byKey.__ten__ = tenNode;
  out.push(tenNode);

  // ── ARAÇ DÜĞÜMLERİ — model KULLANIMA HAZIR gelir ─────────────────────────
  // Örnek kurucusunun kararının aynısı: kullanıcı çözümü görmek için Kayış
  // Yolu kartını, raporu ve çözücüyü paletten ayrıca aramak zorunda kalmasın.
  var b = st.belt || {};
  var bd = { profile: b.profile || 'PK', brand: b.brand || 'GATES' };
  ['ribs', 'effLength', 'tolerance', 'wearPct', 'massPerRibKgM'].forEach(function(a){
    var v = _fwNum(b[a], NaN);
    if(Number.isFinite(v)) bd[a] = v;
  });
  if(b.beltType) bd.beltType = b.beltType;
  if(b.beltDataMode === 'full' || b.beltDataMode === 'none') bd.beltDataMode = b.beltDataMode;
  // KAYIŞ KİPİ ZARF KİPİNDE YAZILMAZ: orada boy yapısal olarak bir ÇIKTI ve
  // köprü kipi zaten kilitliyor (veFeadBeltModeLocked). Yazmak, panelde
  // "SABİT" görünüp serbest koşan bir model üretirdi.
  if(false)
    bd.lengthMode = b.lengthMode;
  out.push({ id: 'wz-belt', type: 'fead-belt', data: bd });

  var s = st.solver || {};
  var sd = { ratioMode: s.ratioMode || 'direct' };
  ['driveRatio', 'crankOD', 'fanOD', 'cylinders', 'serviceFact', 'crankInertia',
   'accelRpmS', 'decelRpmS', 'lengthOffsetMm'].forEach(function(a){
    var v = _fwNum(s[a], NaN);
    if(Number.isFinite(v)) sd[a] = v;
  });
  if(s.fatigueModel) sd.fatigueModel = s.fatigueModel;
  sd.duty = (s.duty || []).map(function(r){
    var row = { rpm: _fwNum(r.rpm, 0), kw: {} };
    if(Number.isFinite(_fwNum(r.dcPct, NaN))) row.dcPct = _fwNum(r.dcPct, NaN);
    if(Number.isFinite(_fwNum(r.degC, NaN))) row.degC = _fwNum(r.degC, NaN);
    // kW SÖZLÜĞÜ ANAHTARDAN KİMLİĞE — çeviri TEK YERDE. Sihirbaz durumu kasnak
    // anahtarıyla tutuyor; köprü düğüm kimliğiyle okuyor (veFeadDutyToCore).
    // Ayrışırsa hata SESSİZ: eşleşmeyen anahtar "kW girilmemiş" sayılır ve o
    // aksesuar 0 kW ile koşar — ölçülmüş sınıf (bkz. veFeadRemapDutyKw).
    Object.keys(r.kw || {}).forEach(function(k){
      var v = _fwNum(r.kw[k], NaN);
      if(byKey[k] && Number.isFinite(v)) row.kw[byKey[k].id] = v;
    });
    return row;
  });
  out.push({ id: 'wz-solver', type: 'fead-solver', data: sd });
  out.push({ id: 'wz-layout', type: 'fead-layout', data: {} });
  out.push({ id: 'wz-report', type: 'fead-report', data: {} });

  // ── KABLOLAMA: sıra = kayış yolu ─────────────────────────────────────────
  var sira = (st.route || []).filter(function(k){ return !!byKey[k]; });
  var conns = [];
  if(sira.length > 1){
    sira.forEach(function(k, i){
      var next = sira[(i + 1) % sira.length];
      conns.push({ from: byKey[k].id, to: byKey[next].id });
    });
  }
  return { nodes: out, connections: conns, solverId: 'wz-solver' };
}

// Sıraya gergi de girmeli; kullanıcı kasnak eklerken sıraya otomatik ekleniyor
// ama gergi durumda ayrı duruyor. Sıra listesi bu yüzden burada tamamlanıyor.
function veFeadWizRoute(st){
  st = st || _fwState;
  var r = (st.route || []).slice();
  if(r.indexOf('__ten__') < 0) r.push('__ten__');
  var gecerli = {};
  (st.pulleys || []).forEach(function(p){ gecerli[p.key] = 1; });
  gecerli.__ten__ = 1;
  return r.filter(function(k){ return gecerli[k]; });
}

// ── CANLI ÇÖZÜM ────────────────────────────────────────────────────────────
//
// KOL AÇISI MEMOSU DURUMDA TUTULUYOR ve sebebi ölçülmüş: zarf kipinin genel
// taraması 84 ms, tohumlu yerel araması 6 ms (bkz. veFeadArmEnvelope). Memo
// yazılmazsa her tuş vuruşu genel taramayı yeniden koşardı.
function veFeadWizBuild(){
  if(!_fwState) return null;
  if(typeof veFeadBuildSystem !== 'function') return null;
  var st = _fwState;
  var sira = veFeadWizRoute(st);
  var eski = st.route;
  st.route = sira;
  var pack = veFeadWizNodes(st);
  st.route = eski;
  var b;
  try { b = veFeadBuildSystem(pack.nodes, pack.connections); }
  catch(e){ return null; }
  // Seçilen açıyı duruma NOT DÜŞ (karar değil, hesabın ara sonucu — köprünün
  // kendi memo kuralının aynısı; saveState çağrılmıyor).
  if(b && b.ok && b.armSelected && Number.isFinite(b.armAbsDeg) && !st.ten.armPinned)
    st.ten.armMeanDeg = Math.round(b.armAbsDeg * 1000) / 1000;
  _fwBuild = b;
  return b;
}

// Hangi hata hangi adıma ait — kullanıcı "eksik alan" mesajını girdiği yerde
// görsün diye. Eşleşmeyen mesaj ÖZET adımında toplanıyor: bilinmeyen bir
// hatayı gizlemek, yanlış yere koymaktan kötüdür.
var VE_FW_ERR_STEP = [
  { re: /kasnağının konumu|dış çapı|Sürücü kasnak|kasnak gerekli|hiç kasnak/i, step: 1 },
  { re: /Kayış yolu kapanmıyor|bağlı olmayan kasnak|kayış çıkıyor|kayış giriyor/i, step: 2 },
  { re: /[Gg]ergi|pivot|montaj koordinat|yay|kol boyu|zarf/i, step: 3 },
  { re: /[Kk]ayış (efektif boyu|kanal|profil)|Kayış Özellikleri/i, step: 4 },
  { re: /tahrik oranı|Çözücü|devir/i, step: 5 }
];
function veFeadWizStepOf(msg){
  for(var i = 0; i < VE_FW_ERR_STEP.length; i++)
    if(VE_FW_ERR_STEP[i].re.test(String(msg))) return VE_FW_ERR_STEP[i].step;
  return 6;
}
function veFeadWizIssues(b, step){
  var out = [];
  if(!b) return out;
  (b.errors || []).forEach(function(m){
    if(step === undefined || veFeadWizStepOf(m) === step) out.push({ tur: 'err', m: m });
  });
  (b.warnings || []).forEach(function(m){
    if(step === undefined || veFeadWizStepOf(m) === step) out.push({ tur: 'warn', m: m });
  });
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
//  KABUK — modal aç / kapat / gezin
// ════════════════════════════════════════════════════════════════════════════
//
// Kabuk Ayarlar ve İçe Aktarma modallarının kabuğunun aynısı
// (.ve-settings-overlay / .ve-settings-modal): üçüncü bir pencere dili
// kurmanın karşılığı yok. Yalnız gövde bu modüle ait (.ve-fw-*).
function veFeadWizOpen(nodeId){
  if(typeof document === 'undefined') return false;
  var ov = document.getElementById('ve-feadwiz-overlay');
  if(!ov) return false;
  _fwNodeId = nodeId || null;
  // KALDIĞI YERDEN: yarım bırakılmış sihirbaz düğümde duruyor. Durum
  // kopyalanarak alınıyor — kullanıcı "İptal" derse düğümdeki kayıt bozulmasın.
  var node = (typeof nodes !== 'undefined' && nodes)
    ? nodes.filter(function(n){ return n.id === nodeId; })[0] : null;
  var kayit = node && node.data && node.data.wiz;
  _fwState = kayit ? JSON.parse(JSON.stringify(kayit)) : veFeadWizDefault();
  // Anahtar üreteci kayıttaki en büyük anahtarın üstünden devam etmeli; yoksa
  // yeni satır eski bir satırla AYNI anahtarı alır ve duty kW'ı ona sızar.
  (_fwState.pulleys || []).forEach(function(p){
    var n = parseInt(String(p.key).replace(/^p/, ''), 10);
    if(Number.isFinite(n) && n > _fwSeq) _fwSeq = n;
  });
  _fwStep = 0;
  ov.style.display = 'flex';
  document.addEventListener('keydown', veFeadWizKey);
  veFeadWizRender();
  return true;
}

function veFeadWizClose(kaydet){
  if(typeof document === 'undefined') return;
  var ov = document.getElementById('ve-feadwiz-overlay');
  if(ov) ov.style.display = 'none';
  document.removeEventListener('keydown', veFeadWizKey);
  if(kaydet !== false && _fwNodeId && typeof nodes !== 'undefined'){
    var node = nodes.filter(function(n){ return n.id === _fwNodeId; })[0];
    if(node){
      if(!node.data) node.data = {};
      node.data.wiz = JSON.parse(JSON.stringify(_fwState || veFeadWizDefault()));
      // saveState YALNIZ BURADA: form içindeki her tuş vuruşu geri-al yığınına
      // bir adım eklerse yığın kullanılamaz hale gelir.
      if(typeof saveState === 'function') saveState();
      if(typeof showNodeProperties === 'function' && typeof selectedNode !== 'undefined'
         && selectedNode && selectedNode.id === node.id) showNodeProperties(node);
    }
  }
  _fwBuild = null;
}

function veFeadWizKey(e){
  if(!e) return;
  if(e.key === 'Escape'){ veFeadWizClose(true); return; }
  // Adımlar arası klavye gezinmesi: metin alanındayken ok tuşları alanın
  // kendisine ait (imleç), o yüzden yalnız Alt ile.
  if(e.altKey && e.key === 'ArrowRight'){ e.preventDefault(); veFeadWizGo(1); }
  if(e.altKey && e.key === 'ArrowLeft'){ e.preventDefault(); veFeadWizGo(-1); }
}

function veFeadWizGo(delta){
  var i = _fwStep + delta;
  if(i < 0 || i >= VE_FW_STEPS.length) return;
  _fwStep = i;
  veFeadWizRender();
}
function veFeadWizGoto(i){
  if(i < 0 || i >= VE_FW_STEPS.length) return;
  _fwStep = i;
  veFeadWizRender();
}

// ── CANLI ŞERİT — gecikmeli ────────────────────────────────────────────────
// Tuş vuruşu başına çözüm koşturmak zarf kipinde 84 ms'lik genel taramayı
// tetikleyebiliyor (ilk çözümde memo yok). 220 ms'lik gecikme yazarken akıcı
// kalmayı, memo da sonraki çözümlerin 6 ms'de bitmesini sağlıyor.
function veFeadWizLiveSoon(){
  if(typeof setTimeout !== 'function') return;
  if(_fwLiveTimer) clearTimeout(_fwLiveTimer);
  _fwLiveTimer = setTimeout(function(){ _fwLiveTimer = null; veFeadWizLive(); }, 220);
}
// TAM YENİDEN ÇİZİM DEĞİL, YAMA. Panel yeniden kurulsaydı yazılan alan DOM'dan
// silinir ve ODAK her harfte kaybolurdu — malzeme kütüphanesi aramasında
// ölçülmüş sınıfın aynısı.
function veFeadWizLive(){
  if(typeof document === 'undefined') return;
  var b = veFeadWizBuild();
  var el = document.getElementById('ve-fw-live');
  if(el) el.innerHTML = veFeadWizLiveHTML(b);
  var f = document.getElementById('ve-fw-foot-state');
  if(f) f.innerHTML = veFeadWizFootStateHTML(b);
  var kur = document.getElementById('ve-fw-create');
  if(kur){
    var hazir = !!(b && b.ok) && veFeadWizCanCreate().ok;
    kur.disabled = !hazir;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  GÖVDE — ortak parçalar
// ════════════════════════════════════════════════════════════════════════════
function _fwCard(baslik, unit, accent, inner){
  return '<section class="ve-fw-card" style="--fw-accent:' + (accent || 'var(--accent-primary)') + ';">'
    + '<header class="ve-fw-card-h"><span>' + _fwEsc(baslik) + '</span>'
    + (unit ? '<em>' + _fwEsc(unit) + '</em>' : '') + '</header>'
    + '<div class="ve-fw-card-b">' + inner + '</div></section>';
}
function _fwHint(html){ return '<p class="ve-fw-hint">' + html + '</p>'; }

// Alan üreteci. `oninput` YALNIZ durumu yazar ve canlı şeridi gecikmeli
// tazeler — tam yeniden çizim odağı düşürürdü.
function _fwInp(path, opts){
  opts = opts || {};
  var v = _fwGet(path);
  return '<input type="' + (opts.text ? 'text' : 'number') + '"'
    + (opts.step ? ' step="' + opts.step + '"' : ' step="any"')
    + ' class="ve-fw-inp" value="' + _fwEsc(v === undefined || v === null ? '' : v) + '"'
    + ' placeholder="' + _fwEsc(opts.ph || '') + '"'
    + ' oninput="_fwSet(\'' + path + '\', this.value)">';
}
function _fwSelHTML(path, secenekler, cur){
  var h = '<select class="ve-fw-inp" onchange="_fwSetRender(\'' + path + '\', this.value)">';
  secenekler.forEach(function(o){
    h += '<option value="' + _fwEsc(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '')
       + '>' + _fwEsc(o[1]) + '</option>';
  });
  return h + '</select>';
}
function _fwField(label, control, not){
  return '<label class="ve-fw-field"><span class="ve-fw-lbl">' + _fwEsc(label) + '</span>'
    + control + (not ? '<em class="ve-fw-unit">' + _fwEsc(not) + '</em>' : '') + '</label>';
}
function _fwGrid(alanlar, kol){
  return '<div class="ve-fw-grid" style="--fw-cols:' + (kol || 2) + ';">' + alanlar.join('') + '</div>';
}

// ── CANLI ŞERİT ────────────────────────────────────────────────────────────
// Sihirbazın en değerli yüzeyi: kullanıcı daha "İleri" demeden modelin
// çözülüp çözülmediğini görüyor. Sayı UYDURULMUYOR — çözüm yoksa sebep yazılı.
function veFeadWizLiveHTML(b){
  var h = '<div class="ve-fw-live">';
  if(!b){
    h += '<span class="ve-fw-pill ve-fw-pill-dim">çözüm yok</span>';
    return h + '</div>';
  }
  if(b.ok){
    h += '<span class="ve-fw-pill ve-fw-pill-ok">✓ model çözülüyor</span>';
    if(Number.isFinite(b.beltLengthMm))
      h += '<span class="ve-fw-pill">L<sub>eff</sub> <b>' + _fwFmt(b.beltLengthMm, 1) + ' mm</b>'
         + (b.beltLengthDerived ? ' <em>çıktı</em>' : '') + '</span>';
    if(Number.isFinite(b.springTensionN))
      h += '<span class="ve-fw-pill">T <b>' + _fwFmt(b.springTensionN, 1) + ' N</b></span>';
    if(Number.isFinite(b.armAbsDeg))
      h += '<span class="ve-fw-pill">kol <b>' + _fwFmt(b.armAbsDeg, 2) + '°</b></span>';
    if(b.spin)
      h += '<span class="ve-fw-pill">' + (b.spin > 0 ? '↺ CCW' : '↻ CW') + '</span>';
  } else {
    h += '<span class="ve-fw-pill ve-fw-pill-err">✗ çözülemiyor</span>';
    h += '<span class="ve-fw-pill ve-fw-pill-dim">' + _fwEsc((b.errors || [])[0] || '') + '</span>';
  }
  return h + '</div>';
}
function veFeadWizFootStateHTML(b){
  var eksik = b ? (b.errors || []).length : 0;
  if(!b) return '<span class="ve-fw-dim">model henüz kurulmadı</span>';
  if(b.ok) return '<span class="ve-fw-ok">✓ model çözülüyor — kurulmaya hazır</span>';
  return '<span class="ve-fw-err">' + eksik + ' eksik/çelişkili girdi</span>';
}

// Adıma ait uyarı listesi. Boş liste de bir CEVAPTIR ("bu adımda eksik yok");
// hiç basmamak kullanıcıyı "acaba kontrol edildi mi" sorusuyla bırakırdı.
function veFeadWizIssueHTML(b, step){
  var list = veFeadWizIssues(b, step);
  if(!list.length)
    return '<div class="ve-fw-issues ve-fw-issues-ok">✓ Bu adımda eksik girdi yok.</div>';
  var h = '<div class="ve-fw-issues">';
  list.forEach(function(it){
    h += '<div class="ve-fw-issue ve-fw-issue-' + it.tur + '">'
      + (it.tur === 'err' ? '✗' : '!') + ' ' + _fwEsc(it.m) + '</div>';
  });
  return h + '</div>';
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇİZİM
// ════════════════════════════════════════════════════════════════════════════
function veFeadWizRender(){
  if(typeof document === 'undefined' || !_fwState) return;
  var b = veFeadWizBuild();
  var nav = document.getElementById('ve-fw-nav');
  if(nav) nav.innerHTML = veFeadWizNavHTML(b);
  var body = document.getElementById('ve-fw-body');
  if(body){
    body.innerHTML = veFeadWizStepHTML(_fwStep, b);
    body.scrollTop = 0;
  }
  var foot = document.getElementById('ve-fw-foot');
  if(foot) foot.innerHTML = veFeadWizFootHTML(b);
}

function veFeadWizNavHTML(b){
  var h = '<div class="ve-fw-brand"><b>Başlangıç Sihirbazı</b><span>FEAD · kayış-kasnak</span></div>';
  h += '<ol class="ve-fw-steps">';
  VE_FW_STEPS.forEach(function(s, i){
    var durum = (i === _fwStep) ? 'on' : (i < _fwStep ? 'done' : '');
    // ADIM ROZETİ HATA SAYISI TAŞIR: kullanıcı hangi adıma dönmesi gerektiğini
    // son adımı beklemeden görür. Sayı köprünün errors[] listesinden süzülüyor
    // (ikinci bir doğrulama listesi yok).
    var n = veFeadWizIssues(b, i).filter(function(x){ return x.tur === 'err'; }).length;
    h += '<li class="ve-fw-step ' + durum + '" onclick="veFeadWizGoto(' + i + ')" tabindex="0"'
      + ' onkeydown="if(event.key===\'Enter\'){veFeadWizGoto(' + i + ');}">'
      + '<span class="ve-fw-step-no">' + (i + 1) + '</span>'
      + '<span class="ve-fw-step-t"><b>' + _fwEsc(s.ad) + '</b><em>' + _fwEsc(s.ipucu) + '</em></span>'
      + (n ? '<span class="ve-fw-step-n">' + n + '</span>' : '')
      + '</li>';
  });
  return h + '</ol>';
}

function veFeadWizFootHTML(b){
  var son = (_fwStep === VE_FW_STEPS.length - 1);
  var kur = veFeadWizCanCreate();
  var h = '<span id="ve-fw-foot-state" class="ve-fw-foot-state">'
        + veFeadWizFootStateHTML(b) + '</span>';
  h += '<button type="button" class="ve-fw-btn" onclick="veFeadWizClose(true)">Kapat</button>';
  h += '<button type="button" class="ve-fw-btn"' + (_fwStep === 0 ? ' disabled' : '')
     + ' onclick="veFeadWizGo(-1)">← Geri</button>';
  if(!son){
    h += '<button type="button" class="ve-fw-btn ve-fw-btn-primary" onclick="veFeadWizGo(1)">İleri →</button>';
  } else {
    h += '<button type="button" id="ve-fw-create" class="ve-fw-btn ve-fw-btn-go"'
       + ((b && b.ok && kur.ok) ? '' : ' disabled')
       + ' onclick="veFeadWizCreate()">⚙ Modeli Kur</button>';
  }
  return h;
}

// ════════════════════════════════════════════════════════════════════════════
//  ADIM GÖVDELERİ
// ════════════════════════════════════════════════════════════════════════════
function veFeadWizStepHTML(step, b){
  var s = VE_FW_STEPS[step] || VE_FW_STEPS[0];
  var h = '<div class="ve-fw-head"><h2>' + (step + 1) + '. ' + _fwEsc(s.ad) + '</h2>'
        + '<p>' + _fwEsc(s.ipucu) + '</p></div>';
  h += '<div id="ve-fw-live">' + veFeadWizLiveHTML(b) + '</div>';
  if(step === 0) h += _fwStepKaynak(b);
  else if(step === 1) h += _fwStepKasnak(b);
  else if(step === 2) h += _fwStepYol(b);
  else if(step === 3) h += _fwStepGergi(b);
  else if(step === 4) h += _fwStepKayis(b);
  else if(step === 5) h += _fwStepCevrim(b);
  else h += _fwStepOzet(b);
  if(step !== 6) h += veFeadWizIssueHTML(b, step);
  return h;
}

// ── 1 · BAŞLANGIÇ ──────────────────────────────────────────────────────────
// Buradaki tek gerçek karar GERGİNİN TANIM BİÇİMİ ve bilerek en başta: kip
// hem gerginin sorduğu alanları hem de kayış boyunun girdi mi çıktı mı
// olduğunu belirliyor (zarf kipinde boy yapısal olarak bir SONUÇ).
function _fwStepKaynak(){
  var st = _fwState;
  var h = _fwCard('Sistem', '', 'var(--accent-primary)',
      _fwField('Sistem adı', _fwInp('ad', { text: true, ph: 'Yeni FEAD Sistemi' }))
    + _fwHint('Ad yalnız künyedir; rapor antedinde ve kanvas etiketlerinde görünür.'));



  var oh = '';
  if(typeof veFeadExampleKeys === 'function'){
    veFeadExampleKeys().forEach(function(k){
      var ex = veFeadExampleOf(k);
      oh += '<button type="button" class="ve-fw-btn ve-fw-btn-wide"'
         + ' onclick="veFeadWizSeed(\'' + k + '\')">'
         + '<b>' + _fwEsc(ex.name) + '</b><em>' + ex.pulleys.length + ' kasnak · '
         + (ex.solver.duty || []).length + ' devir noktası</em></button>';
    });
  }
  oh += '<button type="button" class="ve-fw-btn ve-fw-btn-wide" onclick="veFeadWizReset()">'
     + '<b>Boş başla</b><em>bütün alanları temizler</em></button>';
  h += _fwCard('Örnekten doldur', 'isteğe bağlı', 'var(--accent-success)', oh
    + _fwHint('Doğru doldurulmuş bir formu görmek, alanların hangi belgeden okunduğunu '
      + 'anlatmanın en kısa yolu. Doldurduktan sonra her alanı değiştirebilirsiniz — '
      + 'örnek bir KISIT değil, başlangıç noktası.'));
  return h;
}

function veFeadWizReset(){
  _fwState = veFeadWizDefault();
  _fwStep = 0;
  veFeadWizRender();
}

// ── 2 · KASNAKLAR ──────────────────────────────────────────────────────────
function _fwStepKasnak(){
  var st = _fwState;
  var ekle = '';
  VE_FW_PULLEY_TYPES.forEach(function(t){
    ekle += '<button type="button" class="ve-fw-chip" onclick="veFeadWizPulleyAdd(\'' + t + '\')">'
         + '+ ' + _fwEsc(_fwDefName(t)) + '</button>';
  });

  var h = _fwCard('Kasnak Ekle', 'gergi ayrı adımda', 'var(--accent-primary)',
      '<div class="ve-fw-chips">' + ekle + '</div>'
    + _fwHint('<b>Koordinatlar kayış düzlemindedir</b> (motora önden bakış, mm) ve '
      + '<b>sürücü kasnak orijindir</b> — onun X/Y\'si 0/0 olabilir, gerisi ona göre '
      + 'ölçülür. Kanvasta 1 px = 1 mm, yani kutuları sürüklemek bu sayıları da '
      + 'değiştirir.'));

  if(!st.pulleys.length){
    h += _fwCard('Kasnaklar', '0 kasnak', 'var(--text-muted)',
        _fwHint('Henüz kasnak yok. En az <b>3</b> gerekir: sürücü + aksesuar + gergi '
          + '(gergiyi 4. adımda tanımlayacaksınız).'));
    return h;
  }

  var t = '<div class="ve-fw-tblwrap"><table class="ve-fw-tbl"><thead><tr>'
    + '<th>Sürücü</th><th>Tip</th><th>Ad</th><th>Ø OD [mm]</th><th>X [mm]</th><th>Y [mm]</th>'
    + '<th>Temas</th><th>J [kg·m²]</th><th></th></tr></thead><tbody>';
  st.pulleys.forEach(function(p){
    var tipler = VE_FW_PULLEY_TYPES.map(function(x){ return [x, _fwDefName(x)]; });
    t += '<tr>'
      + '<td class="ve-fw-c"><input type="radio" name="ve-fw-driver"' + (p.driver ? ' checked' : '')
        + ' onchange="veFeadWizDriver(\'' + p.key + '\')"></td>'
      + '<td><select class="ve-fw-inp" onchange="veFeadWizPulleyType(\'' + p.key + '\', this.value)">'
      + tipler.map(function(o){
          return '<option value="' + o[0] + '"' + (o[0] === p.type ? ' selected' : '') + '>'
               + _fwEsc(o[1]) + '</option>'; }).join('')
      + '</select></td>'
      + '<td><input type="text" class="ve-fw-inp" value="' + _fwEsc(p.name || '')
        + '" placeholder="' + _fwEsc(_fwDefName(p.type)) + '"'
        + ' oninput="veFeadWizPulleySet(\'' + p.key + '\',\'name\',this.value)"></td>'
      + '<td><input type="number" step="any" class="ve-fw-inp" value="' + _fwEsc(p.od)
        + '" oninput="veFeadWizPulleySet(\'' + p.key + '\',\'od\',this.value)"></td>'
      + '<td><input type="number" step="any" class="ve-fw-inp" value="' + _fwEsc(p.x)
        + '" placeholder="0" oninput="veFeadWizPulleySet(\'' + p.key + '\',\'x\',this.value)"></td>'
      + '<td><input type="number" step="any" class="ve-fw-inp" value="' + _fwEsc(p.y)
        + '" placeholder="0" oninput="veFeadWizPulleySet(\'' + p.key + '\',\'y\',this.value)"></td>'
      + '<td><select class="ve-fw-inp" onchange="veFeadWizPulleySet(\'' + p.key + '\',\'contact\',this.value)">'
      + '<option value="grooved"' + (p.contact !== 'back' ? ' selected' : '') + '>Kaburgalı</option>'
      + '<option value="back"' + (p.contact === 'back' ? ' selected' : '') + '>Sırttan</option>'
      + '</select></td>'
      + '<td><input type="number" step="0.0001" class="ve-fw-inp" value="' + _fwEsc(p.inertia === undefined ? '' : p.inertia)
        + '" placeholder="—" oninput="veFeadWizPulleySet(\'' + p.key + '\',\'inertia\',this.value)"></td>'
      + '<td class="ve-fw-c"><button type="button" class="ve-fw-x" title="Sil"'
        + ' onclick="veFeadWizPulleyDel(\'' + p.key + '\')">✕</button></td>'
      + '</tr>';
  });
  t += '</tbody></table></div>';

  h += _fwCard('Kasnaklar', st.pulleys.length + ' kasnak', 'var(--accent-primary)', t
    + _fwHint('<b style="color:var(--accent-danger);">Temas tarafı hesabın en kritik '
      + 'alanıdır:</b> ters verilirse program <i>geçerli ama başka</i> bir kayış yolu '
      + 'çözer ve hata vermez. Aksesuarlar tipik olarak kaburgalı yüzden, avara ve gergi '
      + 'sırttan temas eder. <b>Atalet</b> yalnız burulma ve tepe yük için, boş bırakılabilir.'));
  return h;
}

// ── 3 · KAYIŞ YOLU ─────────────────────────────────────────────────────────
function _fwStepYol(b){
  var st = _fwState;
  var sira = veFeadWizRoute(st);
  var ad = {};
  st.pulleys.forEach(function(p){ ad[p.key] = p.name || _fwDefName(p.type); });
  ad.__ten__ = (st.ten && st.ten.name) || 'Otomatik Gergi';

  var l = '<ol class="ve-fw-route">';
  sira.forEach(function(k, i){
    var son = (i === sira.length - 1);
    l += '<li><span class="ve-fw-route-n">' + (i + 1) + '</span>'
      + '<span class="ve-fw-route-t">' + _fwEsc(ad[k] || k)
      + (k === '__ten__' ? ' <em>gergi</em>' : '') + '</span>'
      + '<span class="ve-fw-route-b">'
      + '<button type="button" class="ve-fw-mini"' + (i === 0 ? ' disabled' : '')
        + ' onclick="veFeadWizRouteMove(\'' + k + '\',-1)" title="Yukarı">↑</button>'
      + '<button type="button" class="ve-fw-mini"' + (son ? ' disabled' : '')
        + ' onclick="veFeadWizRouteMove(\'' + k + '\',1)" title="Aşağı">↓</button>'
      + '</span></li>';
  });
  l += '</ol>';

  var yon = b && b.spin ? (b.spin > 0 ? '↺ CCW — saat yönünün TERSİNE' : '↻ CW — saat yönünde')
                        : '— (henüz okunamıyor)';
  var h = _fwCard('Serpantin Sırası', sira.length + ' kasnak', 'var(--accent-warning)',
      l
    + '<div class="ve-fw-rowbtns">'
    + '<button type="button" class="ve-fw-btn" onclick="veFeadWizRouteReverse()">⇄ Yönü çevir</button>'
    + '<span class="ve-fw-dim">Dönüş yönü: <b>' + _fwEsc(yon) + '</b></span></div>'
    + _fwHint('Sıra, kayışın <b>gidiş yönüdür</b>: listedeki her kasnaktan bir sonrakine '
      + 'tel çekilir ve sonuncudan ilkine dönülür. <b>Dönüş yönü ayrı bir ayar değildir</b> '
      + '— sıradan türer, bu yüzden "Yönü çevir" sırayı ters yürütür.'));

  h += _fwCard('Gergi nerede olmalı', 'tasarım kuralı', 'var(--text-secondary)',
      _fwHint('Otomatik gergi kayışın <b>GEVŞEK</b> tarafına konur — 14 Gates sisteminin '
        + '14\'ünde de öyle. Gergin tarafa düşerse tahrik gerginliğinin tamamını yayla '
        + 'karşılamak zorunda kalır; program bu durumu çözüm sonrası ayrıca bildirir. '
        + 'Pratikte gergi, kayış sırasında sürücü kasnaktan hemen ÖNCE gelir.'));
  return h;
}

// ── 4 · OTOMATİK GERGİ ─────────────────────────────────────────────────────
function _fwStepGergi(b){
  var st = _fwState, t = st.ten || {};
  var h = '';

  // Künye kütüphanesi — KISIT DEĞİL ÖNERİ (kayış kataloğuyla aynı kural).
  if(typeof veFeadTensionerList === 'function'){
    var liste = veFeadTensionerList();
    var opts = [['', '— elle gir —']].concat(liste.map(function(r){
      return [r.key, r.src + '  ·  kol ' + r.armLen + ' mm · k ' + r.rateNm
              + ' Nm/° · rel ' + r.relNomDeg.toFixed(1) + '°'];
    }));
    var sel = '<select class="ve-fw-inp" onchange="veFeadWizTenLib(this.value)">'
      + opts.map(function(o){
          return '<option value="' + _fwEsc(o[0]) + '"'
               + (String(o[0]) === String(t.tenLib || '') ? ' selected' : '') + '>'
               + _fwEsc(o[1]) + '</option>'; }).join('') + '</select>';
    h += _fwCard('Künye Kütüphanesi', liste.length + ' ölçülmüş künye', 'var(--accent-primary)',
        _fwField('Ölçülmüş künye', sel)
      + _fwHint('14 Gates raporundan okunmuş künyeler. Seçim <b>kol boyu · ön yük · yay '
        + 'katsayısı · çalışma momenti · kasnak çapı</b> alanlarını doldurur; '
        + '<b>pivot ve kol açısını YAZMAZ</b> — ikisi de motorun verisi, parçanın değil. '
        + 'Kütüphane bir sertifika değil: elinizdeki gergi bu 14 raporun dışından olabilir.'));
  }

  // ── MONTAJ KONUMU — TEK KOORDİNAT ───────────────────────────────────────
  h += _fwCard('Otomatik Gergi Montaj Konumu', 'tek girdi', 'var(--accent-danger)',
      _fwGrid([_fwField('Montaj X [mm]', _fwInp('ten.pivotX', { ph: '-250.00' })),
               _fwField('Montaj Y [mm]', _fwInp('ten.pivotY', { ph: '110.00' }))])
    + _fwHint('Gergi <b>gövdesinin motora bağlandığı</b> nokta — kolun döndüğü eksen. '
      + '<b>Avara kasnağının merkezi buradan çıkar</b>: kol bu nokta etrafında kol boyu '
      + 'yarıçapında dönüyor. Kasnak merkezi bir girdi değildir.'));


  h += _fwCard('Kol ve Kasnak', 'parça verisi', 'var(--accent-primary)',
      _fwGrid([_fwField('Kol boyu [mm]', _fwInp('ten.armLen', { ph: '90' })),
               _fwField('Kasnak Ø OD [mm]', _fwInp('ten.od', { ph: '75' })),
               _fwField('Temas tarafı', _fwSelHTML('ten.contact',
                 [['back', 'Sırttan'], ['grooved', 'Kaburgalı']], t.contact || 'back'))], 3));

  h += _fwCard('Yay Künyesi', 'sayfadaki üç satır', 'var(--accent-success)',
      _fwGrid([_fwField('Ön yük — Pre-Load [Nm]', _fwInp('ten.preload', { ph: '8.60' })),
               _fwField('Yay katsayısı — Rate [Nm/°]', _fwInp('ten.kArm', { ph: '0.480', step: '0.001' })),
               _fwField('Çalışma momenti — Mean [Nm]', _fwInp('ten.meanLoad', { ph: '22.07' }))], 3)
    + _fwHint('Üçü de tedarikçi sayfasının "Tensioner" tablosunda yazar. Kolun nominal '
      + 'çalışma dönmesi bunlardan çıkar: <b>(Mean − Pre) / Rate</b> — ve zarf kipinde '
      + 'kayış boyunu bu belirler, kayışa hiç bakılmadan.'));

  h += _fwCard('Titreşim Girdileri', 'burulma modeli — opsiyonel', 'var(--text-secondary)',
      _fwGrid([_fwField('Kol ataleti [kg·m²]', _fwInp('ten.armInertia', { ph: '0.0009', step: '0.0001' })),
               _fwField('Kasnak kütlesi [kg]', _fwInp('ten.pulleyMass', { ph: '0.80', step: '0.01' })),
               _fwField('Load stop (göreli) [°]', _fwInp('ten.loadStopRelDeg', { ph: '62.4', step: '0.1' }))], 3)
    + _fwHint('<b>Kasnak kütlesi girilmezse birinci burulma modu belirgin şekilde YÜKSEK '
      + 'çıkar</b> (ölçüldü: 15,3 yerine 20,3 Hz, +%32) — kol, kasnağı kol boyu yarıçapında '
      + 'nokta kütle olarak taşıyor. <b>Load stop</b> bir mekanik sınırdır, çalışma noktası '
      + 'değil.'));

  // ── OKUMA — kip ne veriyor ───────────────────────────────────────────────
  var oku = '';
  var m = (typeof veFeadSpringSetup === 'function')
    ? veFeadSpringSetup(veFeadWizNodes(st).nodes.filter(function(n){
        return n.type === 'fead-tensioner'; })[0].data) : null;
  if(m && Number.isFinite(m.relMeanDeg))
    oku += _fwRead('Yay kurulması (Mean−Pre)/Rate', _fwFmt(m.relMeanDeg, 2) + '°');
  if(b && b.ok){
    if(Number.isFinite(b.armAbsDeg))
      oku += _fwRead(b.armPinned ? 'Kol çalışma açısı (sabitlendi)'
                                 : 'Kol çalışma açısı (ZARFTAN SEÇİLDİ)',
        _fwFmt(b.armAbsDeg, 2) + '°');
    if(typeof veFeadTensionerCenter === 'function'){
      var tn = veFeadWizNodes(st).nodes.filter(function(n){ return n.type === 'fead-tensioner'; })[0];
      var cen = veFeadTensionerCenter(tn.data, b.armAbsDeg);
      if(cen) oku += _fwRead('↳ kasnak merkezi (türedi)',
        _fwFmt(cen[0], 2) + ' / ' + _fwFmt(cen[1], 2));
    }
    if(Number.isFinite(b.beltLengthMm))
      oku += _fwRead('Gereken kayış boyu' + (b.beltLengthDerived ? ' (ÇIKTI)' : ''),
        _fwFmt(b.beltLengthMm, 1) + ' mm');
    if(Number.isFinite(b.springTensionN))
      oku += _fwRead('Tasarım gerginliği (türedi)', _fwFmt(b.springTensionN, 1) + ' N');
    if(b.envelope && b.envelope.best)
      oku += _fwRead('Zarfın çözülebilen yayı', _fwFmt(b.envelope.feasibleDeg, 0) + '° / 360°');
  }
  if(oku) h += _fwCard('Bu künyeden çıkanlar', 'okuma — girdi değil', 'var(--accent-warning)',
      '<div class="ve-fw-reads">' + oku + '</div>'
    + (true
        ? _fwHint('Kol açısı <b>14 Gates sisteminden geriye çözülmüş</b> bir ölçütle '
          + 'seçiliyor: kolun çalışma aralığı boyunca <b>en küçük take-up en büyük</b> '
          + 'olacak şekilde — yani kayışın servis zarfında görülen tepe gerginliğini en '
          + 'küçük yapan montaj saati. <b>Sınır:</b> paketleme modelde yok, sonuç bir '
          + 'ÖNERİDİR.')
        : ''));
  return h;
}
function _fwRead(et, deg){
  return '<div class="ve-fw-read"><span>' + _fwEsc(et) + '</span><b>' + _fwEsc(deg) + '</b></div>';
}

// ── 5 · KAYIŞ ──────────────────────────────────────────────────────────────
function _fwStepKayis(b){
  var st = _fwState, bl = st.belt || {};
  var zarf = true;
  var h = _fwCard('Profil ve Marka', 'h_b / h_r buradan gelir', 'var(--accent-warning)',
      _fwGrid([_fwField('Profil', _fwSelHTML('belt.profile',
                 [['PK','PK'],['PJ','PJ'],['PH','PH'],['PL','PL'],['PM','PM']], bl.profile || 'PK')),
               _fwField('Marka', _fwSelHTML('belt.brand',
                 [['GATES','Gates'],['OPTIBELT','Optibelt'],['CONTITECH','ContiTech']], bl.brand || 'GATES')),
               _fwField('Kanal (kaburga) sayısı', _fwInp('belt.ribs', { ph: '8', step: '1' }))], 3)
    + _fwHint('Profil <b>kapatılamaz bir girdidir</b>: pitch yarıçapı <code>OD/2 + h_b</code>, '
      + 'yani teğet geometrisi profil sabitine dayanıyor (PK\'da h_b = 1,2 mm → merkez '
      + 'mesafelerinde 2,4 mm fark).'));

  if(zarf){
    h += _fwCard('Kayış Boyu', 'tasarımdan HESAPLANIR', 'var(--accent-warning)',
        '<div class="ve-fw-reads">'
      + _fwRead('Boy kipi', 'SERBEST (kilitli)')
      + ((b && b.ok && Number.isFinite(b.beltLengthMm))
          ? _fwRead('Gereken boy (çıktı)', _fwFmt(b.beltLengthMm, 1) + ' mm') : '')
      + '</div>'
      + _fwHint('Gergi <b>montaj koordinatından zarf çözerek</b> çalışıyor; o kipte kayış '
        + 'boyu bir <b>sonuçtur</b> ve girilemez. Boyu girdi yapmak isterseniz 1. adımdan '
        + 'gergi tanım biçimini değiştirin.'));
    // KATALOG ÖNERİSİ — boy bir çıktı olduğuna göre sıradaki soru "hangi kayışı
    // ısmarlamalıyım". Katalog bir KISIT değil öneri: ara boy ısmarlanabiliyor.
    if(b && b.ok && Number.isFinite(b.beltLengthMm) && typeof veFeadBeltNearest === 'function'){
      var n = veFeadBeltNearest(bl.profile || 'PK', b.beltLengthMm, { count: 3 });
      var kh = '';
      if(n.grid){
        var kod = (typeof veFeadBeltCode === 'function')
          ? veFeadBeltCode(n.profile, bl.ribs, n.grid.lengthMm) : '';
        kh += _fwRead('Otomotiv ızgarası (5 mm adım)', (kod ? kod + ' · ' : '')
          + _fwFmt(n.grid.lengthMm, 0) + ' mm  (' + (n.grid.deltaMm >= 0 ? '+' : '')
          + _fwFmt(n.grid.deltaMm, 1) + ')');
      }
      (n.stock || []).forEach(function(o){
        kh += _fwRead('ISO 9982 stok', _fwFmt(o.lengthMm, 0) + ' mm  ('
          + (o.deltaMm >= 0 ? '+' : '') + _fwFmt(o.deltaMm, 1) + ')');
      });
      if(kh) h += _fwCard('Katalog önerisi', 'hangi kayışı ısmarlamalıyım', 'var(--accent-success)',
          '<div class="ve-fw-reads">' + kh + '</div>'
        + _fwHint('Endüstriyel stok listesi (ISO 9982 / DIN 7867) ile otomotiv ızgarası '
          + 'AYRI kümelerdir ve karıştırılmaz: BMC\'nin kendi kayışı (8PK 1715) stok '
          + 'listesinde YOK — komşuları 1690 ve 1755, yani 65 mm\'lik bir boşluk.'));
    }
  } else {
    h += _fwCard('Kayış Künyesi', 'katalogdan SEÇİLİR', 'var(--accent-primary)',
        _fwGrid([_fwField('Tip / kod', _fwInp('belt.beltType', { text: true, ph: '8PK1715HD' })),
                 _fwField('Efektif boy [mm]', _fwInp('belt.effLength', { ph: '1715' })),
                 _fwField('Tolerans ± [mm]', _fwInp('belt.tolerance', { ph: '6' })),
                 _fwField('Aşınma payı [oran]', _fwInp('belt.wearPct', { ph: '0.007', step: '0.0001' }))], 2)
      + _fwHint('<b>Efektif boy</b> ISO 9981 boyudur — katalog adındaki sayının ta kendisi '
        + '(8PK<b>1715</b> → 1715 mm). <b>Aşınma payı ORAN olarak girilir</b> '
        + '(0.007 = %0,70). Tolerans ve aşınma kolun gezinme ZARFINI açar; sıfır '
        + 'bırakılırsa dört orta konum tek noktaya çöker.'));
  }

  var bdm = bl.beltDataMode || (zarf ? 'none' : 'full');
  h += _fwCard('Kayış Tipine Bağlı Çıktılar', bdm === 'none' ? 'KAPALI' : 'açık',
      bdm === 'none' ? 'var(--text-muted)' : 'var(--accent-success)',
      _fwField('Katalog sabitleriyle hesap', _fwSelHTML('belt.beltDataMode',
        [['none', 'KAPALI — kayış henüz seçilmedi'],
         ['full', 'Açık — seçilen kayışın sabitleriyle hesapla']], bdm))
    + _fwHint(bdm === 'none'
        ? 'Şunlar <b>üretilmiyor</b>: '
          + _fwEsc((typeof VE_FEAD_BELT_DATA_OFF !== 'undefined' ? VE_FEAD_BELT_DATA_OFF : []).join(' · '))
          + '. Dördü de kayış katalogundan gelen sabitlere dayanıyor ve kayış henüz '
          + 'seçilmemişken üretilen sayı bir <b>varsayım</b> olurdu.'
        : 'Ömür, yorulma dağılımı, açıklık frekansları ve kol konum zarfı seçilen kayışın '
          + 'katalog sabitleriyle hesaplanıyor.'));

  h += _fwCard('Malzeme', 'opsiyonel', 'var(--text-secondary)',
      _fwField('Kaburga başına kütle [kg/m]', _fwInp('belt.massPerRibKgM', { ph: '0.0196', step: '0.0001' }))
    + _fwHint('Yalnız açıklık frekansı için. Boş bırakılırsa katalog değeri kullanılır — '
      + 'ama Gates PK kataloğu 0,0144 derken hem kesit tahmini hem ölçülmüş frekans '
      + 'haritasından geri-hesap <b>0,0196</b> veriyor.'));
  return h;
}

// ── 6 · MOTOR VE ÇALIŞMA ÇEVRİMİ ───────────────────────────────────────────
function _fwStepCevrim(b){
  var st = _fwState, s = st.solver || {};
  var elle = (s.ratioMode === 'direct');
  var dr = (typeof veFeadDriveRatio === 'function') ? veFeadDriveRatio(s) : { ratio: 1 };

  var h = _fwCard('Birinci Kademe', 'krank → sürücü kasnak', 'var(--accent-warning)',
      _fwField('Tahrik oranı nereden gelsin', _fwSelHTML('solver.ratioMode',
        [['derive', 'Krank ve fan kasnağı çapından türet'],
         ['direct', 'Oranı elle gir']], s.ratioMode || 'direct'))
    + (elle
        ? _fwGrid([_fwField('Tahrik oranı [—]', _fwInp('solver.driveRatio', { ph: '1', step: '0.0001' }))], 1)
        : _fwGrid([_fwField('Krank kasnağı Ø [mm]', _fwInp('solver.crankOD', { ph: '197.32' })),
                   _fwField('Fan / sürücü kasnağı Ø [mm]', _fwInp('solver.fanOD', { ph: '179.62' }))]))
    + '<div class="ve-fw-reads">' + _fwRead('Kullanılan tahrik oranı', _fwFmt(dr.ratio, 4)) + '</div>'
    + _fwHint('Oran = sürücü kasnak devri / motor devri. <b>Aksesuar devirlerinin TAMAMINI '
      + 'ölçekler</b>, yanlış girilirse bütün güç ve gerilme sonuçları aynı oranda kayar. '
      + 'FEAD kayışının sürücüsü krank milinde olmak zorunda değil: tipik ağır ticari '
      + 'düzende krank ayrı bir kademeyle fan kasnağını döndürür.'));

  h += _fwCard('Motor Künyesi', 'sayfadaki Engine Info', 'var(--text-secondary)',
      _fwGrid([_fwField('Silindir sayısı [—]', _fwInp('solver.cylinders', { ph: '6', step: '1' })),
               _fwField('Servis faktörü [—]', _fwInp('solver.serviceFact', { ph: '1.3', step: '0.01' })),
               _fwField('Krank mili ataleti [kg·m²]', _fwInp('solver.crankInertia', { ph: '0.70', step: '0.01' }))], 3)
    + _fwGrid([_fwField('İvmelenme [RPM/s]', _fwInp('solver.accelRpmS', { ph: '1000', step: '10' })),
               _fwField('Yavaşlama [RPM/s]', _fwInp('solver.decelRpmS', { ph: '1000', step: '10' })),
               _fwField('Boy ofseti [mm]', _fwInp('solver.lengthOffsetMm', { ph: '0', step: '0.01' }))], 3)
    + _fwHint('<b>Silindir sayısı</b> ateşleme frekansını verir ve açıklık rezonans '
      + 'kontrolüne girer. <b>Servis faktörü</b> kayma emniyetinin istenen alt sınırıdır. '
      + '<b>Krank MİLİ ataleti</b> (kasnağınki değil) burulma modeline girer — geçilmezse '
      + 'birinci mod ölçülü biçimde kayar. <b>İvme</b> yalnız tepe yük taramasında kullanılır.'));

  // ── DUTY TABLOSU ─────────────────────────────────────────────────────────
  // SÜRÜCÜ SÜTUNU YOK: gücü çekirdek diğerlerinin toplamı olarak hesaplıyor,
  // elle girilirse çevrim kapanmıyor ve çekirdek reddediyor.
  var yuk = st.pulleys.filter(function(p){ return !p.driver; });
  var t = '<div class="ve-fw-tblwrap"><table class="ve-fw-tbl"><thead><tr>'
    + '<th>Devir [d/dk]</th><th>%zaman</th><th>°C</th>'
    + yuk.map(function(p){
        return '<th>' + _fwEsc(p.name || _fwDefName(p.type)) + '<em>kW</em></th>'; }).join('')
    + '<th></th></tr></thead><tbody>';
  (s.duty || []).forEach(function(r, i){
    t += '<tr>'
      + '<td><input type="number" step="any" class="ve-fw-inp" value="' + _fwEsc(r.rpm)
        + '" oninput="veFeadWizDutySet(' + i + ',\'rpm\',this.value)"></td>'
      + '<td><input type="number" step="any" class="ve-fw-inp" value="' + _fwEsc(r.dcPct === undefined ? '' : r.dcPct)
        + '" placeholder="—" oninput="veFeadWizDutySet(' + i + ',\'dcPct\',this.value)"></td>'
      + '<td><input type="number" step="any" class="ve-fw-inp" value="' + _fwEsc(r.degC === undefined ? '' : r.degC)
        + '" placeholder="90" oninput="veFeadWizDutySet(' + i + ',\'degC\',this.value)"></td>'
      + yuk.map(function(p){
          var v = (r.kw && r.kw[p.key] !== undefined) ? r.kw[p.key] : '';
          return '<td><input type="number" step="any" class="ve-fw-inp" value="' + _fwEsc(v)
            + '" placeholder="—" oninput="veFeadWizDutyKw(' + i + ',\'' + p.key + '\',this.value)"></td>';
        }).join('')
      + '<td class="ve-fw-c"><button type="button" class="ve-fw-x" title="Satırı sil"'
        + ' onclick="veFeadWizDutyDel(' + i + ')">✕</button></td></tr>';
  });
  t += '</tbody></table></div>';

  h += _fwCard('Çalışma Çevrimi', (s.duty || []).length + ' devir noktası', 'var(--accent-primary)',
      t
    + '<div class="ve-fw-rowbtns"><button type="button" class="ve-fw-btn"'
      + ' onclick="veFeadWizDutyAdd()">+ Devir noktası ekle</button></div>'
    + _fwHint('<b>Sürücü kasnak sütunu YOKTUR</b> — gücünü çekirdek diğerlerinin toplamı '
      + 'olarak hesaplar; elle girilirse çevrim kapanmaz ve çözüm reddedilir. '
      + '<b>%zaman</b> ömür hesabının ağırlığıdır (toplamı 100 olmalı); boş bırakılırsa '
      + 'mutlak ömür hesaplanamaz ama yorulma DAĞILIMI yine geçerlidir. '
      + '<b>Boş kW hücresi 0 DEMEK DEĞİLDİR:</b> o aksesuarın kendi devir→kW eğrisi '
      + '(ya da seçilmiş katalog modeli) varsa güç oradan gelir — bu yüzden hücre '
      + 'sıfırla değil bir tire ile açılıyor. '
      + '<b>°C</b> satır başına girilir ve çekirdeğin istediği tek sıcaklığa '
      + 'hasar-eşdeğer olarak indirgenir — aritmetik ortalama değil.'));
  return h;
}

// ── 7 · ÖZET VE KURULUM ────────────────────────────────────────────────────
function _fwStepOzet(b){
  var st = _fwState;
  var h = '';

  // Sonuç kartları — sayı UYDURULMUYOR: çözüm yoksa "—" ve sebep.
  var kartlar = [
    ['Durum', b && b.ok ? '✓ çözülüyor' : '✗ çözülemiyor', b && b.ok ? 'ok' : 'err'],
    ['Kasnak', String((b && b.order ? b.order.length : st.pulleys.length + 1)), ''],
    // KİPE GÖRE BAŞKA BÜYÜKLÜK: mutlak kol açısı yalnız zarf kipinde var
    // (orada SEÇİLİYOR); mount kipinde anlamlı sayı kolun GÖRELİ dönmesidir.
    // İkisini tek etiketin altında göstermek, bu modülün defalarca düzelttiği
    // "aynı ad iki farklı büyüklük" hatasının ta kendisi olurdu.
    (b && b.ok && Number.isFinite(b.armAbsDeg))
      ? ['Kol açısı (mutlak)', _fwFmt(b.armAbsDeg, 2) + '°', 'derived']
      : ['Kol dönmesi (göreli)', b && b.ok ? _fwFmt(b.relDeg, 2) + '°' : '—', 'derived'],
    ['Kayış boyu', b && b.ok ? _fwFmt(b.beltLengthMm, 1) + ' mm' : '—',
     b && b.beltLengthDerived ? 'derived' : ''],
    ['Tasarım gerginliği', b && b.ok ? _fwFmt(b.springTensionN, 1) + ' N' : '—', 'derived'],
    ['Dönüş yönü', b && b.spin ? (b.spin > 0 ? '↺ CCW' : '↻ CW') : '—', '']
  ];
  var kh = '<div class="ve-fw-cards">';
  kartlar.forEach(function(k){
    kh += '<div class="ve-fw-stat ' + (k[2] ? 've-fw-stat-' + k[2] : '') + '">'
       + '<em>' + _fwEsc(k[0]) + '</em><b>' + _fwEsc(k[1]) + '</b></div>';
  });
  kh += '</div>';
  h += _fwCard('Çözüm Önizlemesi', 'kurulmadan ÖNCE', 'var(--accent-success)', kh
    + _fwHint('Bu sayılar kurulacak modelin ta kendisinden geliyor: sihirbaz aynı düğüm '
      + 'listesini hem önizlemede hem kurulumda kullanıyor, yani burada gördüğünüz çözüm '
      + 'kanvasta çıkacak çözümdür.'));

  // Kayış yolu şeması — çizici tek kaynak (veFeadLayoutSVG).
  if(b && b.ok && typeof veFeadLayoutSVG === 'function'){
    var svg = null;
    // ÖLÇÜ KABIN GENİŞLİĞİNE GÖRE. 520 px'de etiketler kayış yolunun üstüne
    // biniyordu (ekran görüntüsüyle ölçüldü): çizicinin kendi yerleştiricisi
    // dar kadrajda çakışmayı çözemiyor. Kabın ~880 px'i varken 520'de bırakmanın
    // karşılığı yok. W kabı AŞMAMALI — raporda ölçülmüş kural: aşarsa SVG
    // küçültülür ve kullanıcı birimindeki YAZILAR da onunla küçülür.
    try { svg = veFeadLayoutSVG(b, 700, 440, { posMode: 'mean', compass: true, pivot: true, arrows: true }); }
    catch(e){ svg = null; }
    if(svg) h += _fwCard('Kayış Yolu', 'ölçekli şema', 'var(--accent-warning)',
        '<div class="ve-fw-fig">' + svg + '</div>'
      + _fwHint('Şema kasnakların <b>kayış düzlemindeki</b> koordinatlarından çiziliyor — '
        + 'kanvastaki kutu yerlerinden değil. Kesikli çember kayışın o kasnağa '
        + '<b>sırttan</b> değdiğini, yol üstündeki dişler kayışın kaburgalı yüzünü gösterir.'));
  }

  var list = veFeadWizIssues(b);
  if(list.length){
    var ih = '';
    list.forEach(function(it){
      ih += '<div class="ve-fw-issue ve-fw-issue-' + it.tur + '">'
         + (it.tur === 'err' ? '✗' : '!') + ' ' + _fwEsc(it.m) + '</div>';
    });
    h += _fwCard('Çözümün taşıdığı uyarılar', list.length + ' satır',
      (b && b.ok) ? 'var(--accent-warning)' : 'var(--accent-danger)', ih);
  } else {
    h += _fwCard('Çözümün taşıdığı uyarılar', 'yok', 'var(--accent-success)',
      _fwHint('✓ Eksik girdi ve uyarı yok.'));
  }

  // ── KURULUM KAPISI ───────────────────────────────────────────────────────
  var kur = veFeadWizCanCreate();
  var kh2 = '<div class="ve-fw-reads">'
    + _fwRead('Kurulacak bileşen', String(veFeadWizNodes(st).nodes.length)
        + ' (kasnaklar + gergi + kayış + çözücü + kayış yolu + rapor)')
    + _fwRead('Kayış bağlantısı', String(veFeadWizNodes(st).connections.length))
    + '</div>';
  if(kur.varOlan > 0){
    // MEVCUT MODEL SESSİZCE SİLİNMEZ. Üstüne kurmak çatal hatası üretirdi
    // (her kasnaktan bir tel çıkar kuralı), silmek ise kullanıcının verisi.
    // Karar açık onaya bağlı ve `saveState` sayesinde geri alınabilir.
    kh2 += '<label class="ve-fw-check"><input type="checkbox"' + (st.temizle ? ' checked' : '')
      + ' onchange="_fwSetRender(\'temizle\', this.checked)">'
      + '<span>Kanvastaki <b>' + kur.varOlan + ' kasnağı ve kayış bağlantılarını sil</b>, '
      + 'modeli yeniden kur</span></label>';
    kh2 += _fwHint('İç topolojide zaten bir kayış düzeni var. Üstüne kurmak, bir kasnaktan '
      + 'iki tel çıkması demek olurdu ve çözüm reddedilirdi. Silme işlemi <b>geri '
      + 'alınabilir</b> (Ctrl+Z).');
  }
  if(!kur.ok) kh2 += '<div class="ve-fw-issue ve-fw-issue-err">✗ ' + _fwEsc(kur.sebep) + '</div>';
  h += _fwCard('Modeli Kur', '', 'var(--accent-primary)', kh2);
  return h;
}

// Kurulum kapısı — sebebiyle birlikte.
function veFeadWizCanCreate(){
  var out = { ok: true, sebep: '', varOlan: 0 };
  if(!_fwState){ out.ok = false; out.sebep = 'Sihirbaz durumu yok.'; return out; }
  if(typeof nodes !== 'undefined' && nodes && typeof _feadIsPulley === 'function')
    out.varOlan = nodes.filter(function(n){ return _feadIsPulley(n); }).length;
  if(out.varOlan > 0 && !_fwState.temizle){
    out.ok = false;
    out.sebep = 'İç topolojide zaten ' + out.varOlan + ' kasnak var. Üstüne kurmak kayış '
      + 'yolunu çatallandırır; silme onayını işaretleyin ya da kasnakları elle kaldırın.';
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
//  KURULUM — durum → kanvas
// ════════════════════════════════════════════════════════════════════════════
//
// Yol örnek kurucusununkiyle (veFeadLoadExample) AYNI ve bu bilinçli: düğümleri
// `createNode` kuruyor (kimlikler, DOM, portlar oradan), `data` birebir
// kopyalanıyor, duty kW sözlüğü kimlik göçünden geçiyor ve yerleştirme tek
// noktadan (veFeadArrangeByCoords) yapılıyor. İkinci bir kurucu yazmak, iki
// yolun sessizce ayrışması demekti.
function veFeadWizCreate(){
  if(!_fwState) return null;
  var kapi = veFeadWizCanCreate();
  if(!kapi.ok){
    if(typeof showToast === 'function') showToast(kapi.sebep, 'warning');
    return null;
  }
  if(typeof createNode !== 'function' || typeof nodes === 'undefined') return null;

  var st = _fwState;
  var eskiRoute = st.route;
  st.route = veFeadWizRoute(st);
  var pack = veFeadWizNodes(st);
  st.route = eskiRoute;

  // ── TEMİZLİK — yalnız açık onayla ────────────────────────────────────────
  // Kasnaklar VE onlara bağlı teller gider; araç düğümleri (kayış, çözücü,
  // kart, rapor) KALIR ve aşağıda yeniden KULLANILIR — maxInstances:1 taşıyan
  // kayış düğümü ikinci kez kurulamaz, ve kullanıcının kart ölçüsü / rapor
  // türü gibi tercihlerini çöpe atmanın karşılığı yok.
  if(st.temizle) _fwClearPulleys();

  // Araç düğümleri: VARSA yeniden kullan, yoksa kur.
  var araclar = { 'fead-belt': null, 'fead-solver': null, 'fead-layout': null, 'fead-report': null };
  nodes.forEach(function(n){
    if(araclar.hasOwnProperty(n.type) && !araclar[n.type]) araclar[n.type] = n;
  });

  var base = (typeof veArrangeModuleBase === 'function')
    ? veArrangeModuleBase(pack.nodes.map(function(_, i){ return { lx: 60 + (i % 4) * 120, ly: 120 + Math.floor(i / 4) * 110 }; }))
    : { x: 3000, y: 3000 };

  var kuruldu = [], idMap = {}, i = 0;
  pack.nodes.forEach(function(src){
    var mevcut = araclar[src.type];
    if(mevcut){
      // Araç düğümü zaten duruyor: verisini tazele, kimliğini haritaya yaz.
      mevcut.data = Object.assign(mevcut.data || {}, JSON.parse(JSON.stringify(src.data)));
      idMap[src.id] = mevcut.id;
      kuruldu.push(mevcut);
      araclar[src.type] = null;      // ikinci kez eşleşmesin
      return;
    }
    var once = nodes.length;
    createNode(src.type, base.x + 60 + (i % 4) * 120, base.y + 120 + Math.floor(i / 4) * 110);
    i++;
    if(nodes.length <= once) return;             // maxInstances engelledi
    var yeni = nodes[nodes.length - 1];
    yeni.data = JSON.parse(JSON.stringify(src.data));
    if(src.customName){
      yeni.customName = src.customName;
      // Etiket ELLE tazelenir: createNode etiketi tip adıyla basıyor ve
      // customName'i sonradan atamak DOM'u güncellemiyor — iki avara kasnak
      // aynı adla görünür, kullanıcı hangisinin hangi koordinatta olduğunu
      // kanvasta ayırt edemezdi (örnek kurucusunda ölçülmüş sınıf).
      var el = (typeof document !== 'undefined') ? document.getElementById(yeni.id) : null;
      var lbl = el && el.querySelector('.ve-node-label');
      if(lbl) lbl.textContent = src.customName;
    }
    idMap[src.id] = yeni.id;
    kuruldu.push(yeni);
  });

  // DUTY kW KİMLİK GÖÇÜ — döngü BİTTİKTEN sonra (çözücü düğümü de aynı
  // döngüde kuruluyor, harita ancak burada tamamlanıyor). Atlanırsa hiçbir
  // aksesuar eşleşmez ve hepsi 0 kW ile koşar: çözüm yine üretilir, yalnız
  // bütün gerilmeler tasarım gerginliğine düzleşir.
  if(typeof veFeadRemapDutyKw === 'function')
    kuruldu.forEach(function(n){
      if(n.data && Array.isArray(n.data.duty)) veFeadRemapDutyKw(n.data.duty, idMap);
    });

  if(typeof createConnection === 'function')
    pack.connections.forEach(function(c){
      if(idMap[c.from] && idMap[c.to]) createConnection(idMap[c.from], idMap[c.to]);
    });

  // "Başlangıç ve Örnekler" düğümü işini bitirdi (örnek kurucusunun kararının
  // aynısı: o düğüm bir AÇILIŞ yüzeyi ve kullanıcı verisi taşımıyor).
  // SİHİRBAZ DÜĞÜMÜ İSE KALIR: taşıdığı form kullanıcının kendi girdisi, silmek
  // onu çöpe atmak olurdu — kullanıcı geri dönüp bir sayıyı düzeltebilsin.
  for(var k = nodes.length - 1; k >= 0; k--){
    if(!(_feadDefOf(nodes[k]) || {}).isFeadExample) continue;
    var el2 = (typeof document !== 'undefined') ? document.getElementById(nodes[k].id) : null;
    if(el2) el2.remove();
    nodes.splice(k, 1);
  }
  if(typeof selectedNodes !== 'undefined' && Array.isArray(selectedNodes))
    for(var q = selectedNodes.length - 1; q >= 0; q--)
      if(nodes.indexOf(selectedNodes[q]) < 0) selectedNodes.splice(q, 1);

  if(typeof veFeadArrangeByCoords === 'function'){
    try { veFeadArrangeByCoords({ silent: true }); } catch(e){ /* yedek: ızgara */ }
  }
  if(typeof updateAllConnections === 'function') updateAllConnections();
  if(typeof veFeadRefreshBadges === 'function') veFeadRefreshBadges();
  if(typeof _feadForgetResults === 'function') _feadForgetResults();
  if(typeof veFitViewToContent === 'function') veFitViewToContent();

  // Durum düğümde KALIR (kullanıcı geri dönüp düzeltebilsin) ve saveState
  // kurulumdan SONRA çağrılır: yığına kurulmuş modelin durumu girer.
  veFeadWizClose(true);
  if(typeof showToast === 'function')
    showToast('Model kuruldu — ' + kuruldu.length + ' bileşen, '
      + pack.connections.length + ' kayış bağlantısı.', 'success');
  return kuruldu;
}

// Kasnakları ve onlara bağlı telleri kaldır. `deleteSelectedNodes` KULLANILMAZ:
// o fonksiyon `selectedNodes` global'ini tüketiyor (burada seçim kullanıcınındır)
// ve sensör/parametrik referanslarını da tarıyor — FEAD kasnağında ikisi de yok.
function _fwClearPulleys(){
  if(typeof nodes === 'undefined' || !nodes) return 0;
  var sil = {}, n = 0;
  for(var i = nodes.length - 1; i >= 0; i--){
    if(typeof _feadIsPulley !== 'function' || !_feadIsPulley(nodes[i])) continue;
    sil[nodes[i].id] = 1;
    var el = (typeof document !== 'undefined') ? document.getElementById(nodes[i].id) : null;
    if(el) el.remove();
    nodes.splice(i, 1);
    n++;
  }
  if(typeof connections !== 'undefined' && connections)
    for(var j = connections.length - 1; j >= 0; j--)
      if(sil[connections[j].from] || sil[connections[j].to]){
        var ce = (typeof document !== 'undefined')
          ? document.getElementById(connections[j].id) : null;
        if(ce) ce.remove();
        connections.splice(j, 1);
      }
  if(typeof selectedNodes !== 'undefined' && Array.isArray(selectedNodes))
    for(var q = selectedNodes.length - 1; q >= 0; q--)
      if(nodes.indexOf(selectedNodes[q]) < 0) selectedNodes.splice(q, 1);
  return n;
}

// ════════════════════════════════════════════════════════════════════════════
//  PANEL — düğümün kendi yüzeyi
// ════════════════════════════════════════════════════════════════════════════
function getFeadWizardPropertiesHTML(node){
  if(!node.data) node.data = {};
  var w = node.data.wiz;
  var kasnak = w && w.pulleys ? w.pulleys.length : 0;
  var kip = 'envelope';
  var kipAd = { envelope: 'Montaj koordinatından zarf', mount: 'Montaj merkezinden türet',
                direct: 'Serbest kol açısı' }[kip] || kip;
  var h = '<div class="sw-panel">';
  h += '<div style="padding:10px 12px; margin-bottom:10px; font-size:var(--fs-tiny); '
    + 'line-height:1.6; background:var(--bg-tertiary); border:1px solid var(--border-color); '
    + 'color:var(--text-secondary);">Sihirbaz bir modeli kurmak için gereken <b>bütün '
    + 'girdileri</b> yedi adımda sorar: kasnak koordinatları · kayış yolu sırası · gergi '
    + 'künyesi · kayış · motor ve çalışma çevrimi. Her adımda model <b>canlı çözülür</b>, '
    + 'yani eksik girdiyi son adımı beklemeden görürsünüz.</div>';
  h += '<button onclick="veFeadWizOpen(\'' + node.id + '\')" style="width:100%; '
    + 'padding:13px 16px; font-size:var(--fs-lg); font-weight:700; letter-spacing:0.02em; '
    + 'border:none; cursor:pointer; border-radius:var(--radius-sm); '
    + 'background:var(--accent-primary); color:#fff;">🧭 Sihirbazı Aç</button>';
  if(w){
    h += '<div style="margin-top:10px; padding:8px 10px; font-size:var(--fs-micro); '
      + 'line-height:1.7; background:var(--bg-secondary); border:1px solid var(--border-color); '
      + 'color:var(--text-muted);">'
      + '<b style="color:var(--text-primary);">Kayıtlı taslak</b><br>'
      + 'Sistem: <b>' + _fwEsc(w.ad || '—') + '</b><br>'
      + 'Kasnak: <b>' + kasnak + '</b> (+ gergi)<br>'
      + 'Gergi kipi: <b>' + _fwEsc(kipAd) + '</b><br>'
      + 'Çalışma çevrimi: <b>' + ((w.solver && w.solver.duty) ? w.solver.duty.length : 0)
      + '</b> devir noktası</div>';
  } else {
    h += '<div style="margin-top:10px; font-size:var(--fs-micro); color:var(--text-muted); '
      + 'line-height:1.6;">Henüz taslak yok. Sihirbazı açıp boş başlayabilir ya da hazır bir '
      + 'örnekten doldurabilirsiniz.</div>';
  }
  h += '<div style="margin-top:10px; font-size:var(--fs-micro); color:var(--text-muted); '
    + 'line-height:1.6;">Düğüme <b>çift tıklamak</b> da sihirbazı açar. Kurulumdan sonra '
    + 'taslak bu düğümde kalır — geri dönüp bir sayıyı düzeltebilirsiniz.</div>';
  h += '</div>';
  return h;
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    VE_FW_STEPS: VE_FW_STEPS, VE_FW_PULLEY_TYPES: VE_FW_PULLEY_TYPES,
    veFeadWizDefault: veFeadWizDefault, veFeadWizState: veFeadWizState,
    veFeadWizNodes: veFeadWizNodes, veFeadWizRoute: veFeadWizRoute,
    veFeadWizBuild: veFeadWizBuild, veFeadWizSeed: veFeadWizSeed,
    veFeadWizPulleyAdd: veFeadWizPulleyAdd, veFeadWizPulleyDel: veFeadWizPulleyDel,
    veFeadWizPulleySet: veFeadWizPulleySet, veFeadWizPulleyType: veFeadWizPulleyType,
    veFeadWizDriver: veFeadWizDriver, veFeadWizRouteMove: veFeadWizRouteMove,
    veFeadWizRouteReverse: veFeadWizRouteReverse, veFeadWizTenLib: veFeadWizTenLib,
    veFeadWizDutyAdd: veFeadWizDutyAdd, veFeadWizDutyDel: veFeadWizDutyDel,
    veFeadWizDutySet: veFeadWizDutySet, veFeadWizDutyKw: veFeadWizDutyKw,
    veFeadWizIssues: veFeadWizIssues, veFeadWizStepOf: veFeadWizStepOf,
    veFeadWizCanCreate: veFeadWizCanCreate, veFeadWizCreate: veFeadWizCreate,
    veFeadWizOpen: veFeadWizOpen, veFeadWizClose: veFeadWizClose,
    veFeadWizGo: veFeadWizGo, veFeadWizGoto: veFeadWizGoto,
    veFeadWizRender: veFeadWizRender, veFeadWizStepHTML: veFeadWizStepHTML,
    veFeadWizNavHTML: veFeadWizNavHTML, veFeadWizFootHTML: veFeadWizFootHTML,
    veFeadWizLiveHTML: veFeadWizLiveHTML, veFeadWizReset: veFeadWizReset,
    getFeadWizardPropertiesHTML: getFeadWizardPropertiesHTML,
    _fwSet: _fwSet, _fwSetRender: _fwSetRender, _fwGet: _fwGet
  };
}
