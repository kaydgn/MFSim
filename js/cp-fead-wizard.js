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
  { key:'kaynak', ad:'Başlangıç',      ipucu:'Sistem adı · örnekten doldur' },
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

// GERGİNİN SİHİRBAZDAKİ ADI TEK YERDE.
//
// Palet adı "Gergi" (`componentDefs['fead-tensioner'].name`) ama sihirbaz baştan
// beri "Otomatik Gergi" diyor: 4. adımın başlığı, kayış yolu listesi ve
// kurulan düğümün `customName` yedeği üçü de o. Kullanıcı satırda da onu
// istedi (2026-08-31): *"orada normal 'Otomatik Gergi' yazacak."*
//
// TEK ÜRETİCİ ŞART çünkü satırın YER TUTUCUSU ile kurulan düğümün adı AYNI
// olmak zorunda: ad boş bırakıldığında kanvasa yazılacak şey budur. İkisi
// ayrışsaydı kullanıcı "Gergi" yazan bir yer tutucu görüp kanvasta
// "Otomatik Gergi" bulurdu.
var VE_FW_TEN_AD = 'Otomatik Gergi';
function _fwTenAd(){ return VE_FW_TEN_AD; }

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
    // ÇALIŞMA ÇEVRİMİ DOLU AÇILIR. Bir dönem `duty: []` idi ve kullanıcı
    // bildirdi: aksesuar modeli seçilse bile doldurulacak satır olmadığı için
    // kW sütunları boş kalıyor, on iki satır elle açılıyordu. Kayıt hangi
    // ölçümden geldiğini söylüyor ve 6. adımdaki seçiciyle değiştirilebiliyor.
    solver: { ratioMode: 'direct', driveRatio: 1, cylinders: 6, serviceFact: 1.3,
              dutyLib: (typeof VE_FEAD_DUTY_DEFAULT !== 'undefined') ? VE_FEAD_DUTY_DEFAULT : '',
              duty: (typeof veFeadDutyRowsOf === 'function')
                ? veFeadDutyRowsOf(VE_FEAD_DUTY_DEFAULT) : [] },
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

// ── GERGİNİN KOORDİNATI KİPE BAĞLI — TEK OKUYUCU ───────────────────────────
//
// Kullanıcı isteği (2026-08-31): *"Kasnaklar kısmına otomatik gergi eklensin,
// koordinatları oraya el ile girelim… Bu girdiler sihirbazın 'Otomatik Gergi'
// sayfasına gitsin."*
//
// İki yüzey (Kasnaklar tablosundaki gergi satırı ve 4. adımın koordinat kartı)
// AYNI alanı yazmak ZORUNDA — ikinci bir durum kopyası tutulsaydı biri
// ötekini sessizce eskitirdi (bu modülün tekrar eden kuralı: "panel ile kart
// AYNI alanı okur").
//
// VE O ALAN DİĞER BEŞ SATIRINKİYLE AYNI ŞEY DEĞİL: kasnak satırlarının X/Y'si
// kasnağın MERKEZİ, gergininki gövdenin motora cıvatalandığı MONTAJ NOKTASI.
// İkisini karıştırmanın ölçülmüş bedeli gerginlikte −%48,6, en kötü sarımda
// +%27,9 — ve model yine çözülür, uyarı çıkmaz. Satır bu yüzden hangi noktayı
// istediğini ADIYLA yazıyor.
//
// İKİ FONKSİYON, ÇÜNKÜ İKİ YÜZEY AYNI ALANI YAZMAK ZORUNDA: alan adı burada
// TEK yerde duruyor; satır da 4. adımın koordinat kartı da buradan okuyor.
function veFeadWizTenCoordKeys(){
  return ['pivotX', 'pivotY'];
}
function veFeadWizTenCoordLabel(){
  return 'montaj noktası';
}
// Gergi alanı yazıcısı — st.ten TEK GERÇEK KAYNAK olarak kalıyor (gergi
// st.pulleys dizisine GİRMİYOR). Diziye gerçek bir satır olarak koymak
// veFeadWizNodes, veFeadWizRoute, duty sütunları ve sürücü radyosunun her
// birinde "bu satır gergi mi" ayıklaması gerektirirdi; sanal satır tek yerde
// çiziliyor ve doğrudan st.ten üzerine yazıyor.
function veFeadWizTenSet(alan, val){
  if(!_fwState) return;
  if(!_fwState.ten) _fwState.ten = {};
  _fwState.ten[alan] = val;
  veFeadWizLiveSoon();
}

// ── SIRA ───────────────────────────────────────────────────────────────────
//
// İKİ SIRA DOLAŞIYORDU — ve bu ÖLÇÜLMÜŞ bir kusurdu.
//
// Gergi `st.pulleys` dizisinde değil `st.ten`de duruyor; sıraya `'__ten__'`
// anahtarını `veFeadWizRoute` **anlık** olarak ekliyor ve `_fwState.route`'a
// YAZMIYOR. Dolayısıyla iki farklı sıra vardı: OKUNAN (gergi dahil) ve YAZILAN
// (gergi hariç). Taşıma ile çevirme YAZILAN sırada çalıştığı için:
//
//   · `veFeadWizRouteReverse` çevrimi ters yürütmüyor, gerginin halkadaki
//     YERİNİ değiştiriyordu. ÖLÇÜLDÜ (AG00976, `'__ten__'` sırada yokken):
//     okunan sıra `p1>p2>p3>p4>p5>__ten__` → `p1>p5>p4>p3>p2>__ten__`, yani
//     gergi SONDA kaldı. Kayış boyu 1714,61 → **2459,29 mm**, gerginlik
//     543,85 → **323,41 N**. Model yine "çözülüyor"du — kapanma ve temizlik
//     ihlalleri UYARI olarak düşüyor (hoşgörülü kip), hata olarak değil.
//   · `veFeadWizRouteMove('__ten__', ±1)` `indexOf < 0` ile ERKEN DÖNÜYORDU:
//     3. adımdaki gerginin yukarı/aşağı okları etkin görünüp HİÇBİR ŞEY
//     yapmıyordu (ölçüldü: sıra değişmedi).
//
// Çözüm iki sırayı BİRLEŞTİRMEK: her iki işlem de OKUNAN sırayı alıp geri
// yazıyor. `veFeadWizRoute` yalnız eksikse eklediği için bu yazma
// birim işlemdir (idempotent) ve seedlenmiş durumu değiştirmez.
function veFeadWizRouteMove(key, delta){
  if(!_fwState) return;
  var r = veFeadWizRoute(_fwState), i = r.indexOf(key), j = i + delta;
  if(i < 0 || j < 0 || j >= r.length) return;
  var t = r[i]; r[i] = r[j]; r[j] = t;
  _fwState.route = r;
  veFeadWizRender();
}
// Sırayı çevirmek = dönüş yönünü çevirmek. Ayrı bir "yön" alanı YOK; yön
// kablolamadan türüyor (fead-spin bileşeninin kuralının aynısı).
function veFeadWizRouteReverse(){
  if(!_fwState) return;
  var r = veFeadWizRoute(_fwState);
  if(r.length > 2) _fwState.route = [r[0]].concat(r.slice(1).reverse());
  else _fwState.route = r;
  veFeadWizRender();
}

// ── DÖNÜŞ YÖNÜ SEÇİMİ — DURUM TUTMAZ, SIRAYI ÇEVİRİR ──────────────────────
//
// Kullanıcı isteği (2026-08-31): *"'Kasnaklar' kısmına 'dönüş yönü' seçmeyi de
// eklememiz gerekiyor. Dönüş yönünü seçtikten sonra matematik ve topoloji buna
// göre belirlensin."*
//
// `fead-spin` bileşeninin kuralının BİREBİR aynısı: yön bir AYAR değil, rota
// sırasının sonucudur (`FEADCore.loopSense` kasnak merkezlerinin ayakkabı-bağı
// işaretli alanına bakar). Duruma bir `dir` alanı koymak İKİNCİ bir gerçek
// kaynak yaratırdı ve üç yerden ısırırdı: 3. adımın sıra listesi yalan söyler,
// kurulan kanvasın gidiş okları bayrakla çelişir, bayrak silinince yön sessizce
// dönerdi. Bu yüzden seçim yalnız ŞUNU yapıyor: istenen yön bugünkünden
// farklıysa sırayı çevir.
//
// İSTENEN YÖN ZATEN GEÇERLİYSE HİÇBİR ŞEY YAPILMAZ — yoksa aynı düğmeye ikinci
// tık sırayı geri çevirir ve seçici bir aç/kapa gibi davranırdı.
function veFeadWizSpinSet(dir){
  if(!_fwState) return false;
  var istenen = _fwNum(dir, 0);
  var b = _fwBuild || veFeadWizBuild();
  var suan = (b && b.spin) ? b.spin : 0;
  if(!istenen || !suan || istenen === suan){ veFeadWizRender(); return false; }
  veFeadWizRouteReverse();
  return true;
}

// Yön yüzeyi TEK ÜRETİCİDEN: 2. adım (Kasnaklar) ile 3. adım (Kayış Yolu) aynı
// kontrolü basıyor. İki kopya tutulsaydı biri düzeltilince öbürü sessizce
// eskirdi — bu deponun tekrar eden kuralı ("panel ile kart AYNI alanı okur").
function veFeadWizSpinHTML(b){
  var sp = (b && b.spin) ? b.spin : 0;
  function dugme(v, glif, ad){
    return '<button type="button" class="ve-fw-spin' + (sp === v ? ' ve-fw-spin-on' : '')
      + '"' + (sp ? '' : ' disabled')
      + ' onclick="veFeadWizSpinSet(' + v + ')" title="' + _fwEsc(ad) + '">'
      + glif + '</button>';
  }
  return '<div class="ve-fw-spinbox">'
    + dugme(1, '\u21ba CCW', 'Saat yönünün TERSİNE — motora önden bakışta')
    + dugme(-1, '\u21bb CW', 'Saat yönünde — motora önden bakışta')
    + '<span class="ve-fw-dim">' + (sp
        ? 'Sıradan türedi; seçim serpantin sırasını ters yürütür.'
        : 'Henüz okunamıyor — en az üç kasnak ve koordinatları gerekli.')
      + '</span></div>';
}

// ── ÇALIŞMA ÇEVRİMİ ────────────────────────────────────────────────────────
// ── ÇALIŞMA ÇEVRİMİ KÜTÜPHANEDEN ──────────────────────────────────────────
//
// Kullanıcı isteği (2026-08-31): *"Çalışma çevrimi sabit zaten, ona göre
// tabloyu program otomatik olarak çıkarmalı. El ile girmemeliyiz."*
//
// kW TAŞINIR: kullanıcının (ya da yüklenen örneğin) kayıtlı ölçümü, devri
// tutan satırlara geçirilir. Taşınmasaydı çevrim değiştirmek AG00976'nın
// rapordan gelen güç tablosunu sessizce silerdi.
function veFeadWizDutyLib(key){
  if(!_fwState) return;
  if(typeof veFeadDutyRowsOf !== 'function') return;
  var yeni = veFeadDutyRowsOf(key);
  if(!yeni.length) return;
  var eski = {};
  (_fwState.solver.duty || []).forEach(function(r){
    if(r.kw && Object.keys(r.kw).length) eski[_fwNum(r.rpm, NaN)] = r.kw;
  });
  yeni.forEach(function(r){ if(eski[r.rpm]) r.kw = eski[r.rpm]; });
  _fwState.solver.duty = yeni;
  _fwState.solver.dutyLib = key;
  veFeadWizRender();
}

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
// ── KÜNYE SEÇİLİYSE PARÇA ALANLARI KİLİTLİ ────────────────────────────────
//
// Kullanıcı isteği (2026-08-31): *"'Otomatik Gergi' kısmında, 'elle gir'
// haricinde, diğer gergiler seçildiğinde değerler değiştirilmemeli. Eğer illa
// değiştirilecekse, kullanıcı seçeceği gergiyi seçip, ardından 'elle gir'
// seçeneğine tıklamalı ve buna tıklayınca önceki seçtiği gergi değerleri
// gelmeli."*
//
// İkinci yarısı BEDAVA ve bilinçli: "elle gir" (`key === ''`) künyeyi
// UYGULAMIYOR, yalnız `tenLib`i boşaltıyor — dolayısıyla son seçilen künyenin
// yazdığı sayılar olduğu gibi kalıyor ve düzenlenebilir hâle geliyor. Alanları
// temizlemek ya da varsayılana döndürmek, kullanıcının "önceki değerler
// gelmeli" isteğinin tam tersi olurdu.
//
// KİLİTLENEN ALAN KÜMESİ `veFeadTensionerApply`'ın YAZDIĞI kümedir
// (fead-tensioners.js) — ikinci bir liste tutmak, künye bir alan daha yazmaya
// başladığında o alanın sessizce açık kalması demekti.
function veFeadWizTenLocked(st){
  st = st || _fwState;
  return !!(st && st.ten && st.ten.tenLib);
}
var VE_FW_TEN_LOCK_NOTE = 'Künye kütüphaneden seçili — bu alan parçanın verisi. '
  + 'Değiştirmek için Tip listesinden "elle gir" seçin; seçtiğiniz künyenin '
  + 'değerleri korunur.';

function veFeadWizTenLib(key){
  if(!_fwState) return;
  _fwState.ten.tenLib = key || '';
  if(key && typeof veFeadTensionerOf === 'function'){
    var rec = veFeadTensionerOf(key);
    // PANELİN KENDİ UYGULAYICISINA BAĞLI — beyaz liste DEĞİL.
    //
    // Burada bir dönem alan alan kopyalayan bir liste vardı ve ÜÇ ŞEYİ birden
    // kaçırıyordu: (1) `tenPart` (parça kodu) — konum pimi künyesinin tek
    // anahtarı, yani sihirbazdan kurulan model panelden kurulanla AYNI olmuyor
    // ve pim planı sessizce boş kalıyordu; (2) kasnak ataleti `inertia`;
    // (3) SİLME — kodsuz bir künye seçilince `veFeadTensionerApply` eski parça
    // kodunu siliyor, liste ise `!== undefined` süzgeciyle onu geride
    // bırakıyordu (yeni gerginin pimi ÖNCEKİ parçanın çizimiyle hesaplanırdı).
    //
    // Uygulayıcı pivot ve kol açısına DOKUNMUYOR (ölçüldü: yazdığı alanlar
    // armLen · preload · kArm · meanLoad · od · contact · inertia · tenPart ·
    // tenLib · tenLibVer) — künyenin "motorun verisini yazmaz" kuralı korunuyor.
    if(rec && typeof veFeadTensionerApply === 'function')
      veFeadTensionerApply(_fwState.ten, rec);
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
    if(d.accPreset) row.accPreset = d.accPreset;
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
    // KATALOG MODELİ ÇÖZÜME TAŞINIR. Taşınmazsa kullanıcı modeli seçer, panel
    // gösterir, çözüm 0 kW ile koşar — bu modülün belgelenmiş sessiz sınıfı.
    if(p.accPreset) d.accPreset = p.accPreset;
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
  // PARÇA KODU ÇÖZÜME TAŞINIR: konum pimi künyesi (veFeadPinPlan) onun
  // anahtarı. Taşınmazsa model çözülür, hiçbir uyarı çıkmaz, yalnız panel ve
  // raporun pim satırı BOŞ kalır — panelden kurulan aynı model onu verirken.
  if(t.tenPart) td.tenPart = t.tenPart;
  var tenNode = { id: 'wz-ten', type: 'fead-tensioner',
                  customName: t.name || _fwTenAd(), data: td };
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
  // KAYIŞ TİPİNE BAĞLI ÇIKTILAR HER ZAMAN KAPALI (kullanıcı kararı,
  // 2026-08-31): *"programda SADECE VE SADECE kayış boyunu çıktı olarak
  // verecek… kayış sabit kalarak program hesap yapmayacak."* Sihirbaz artık
  // seçenek SUNMUYOR, dolayısıyla kurduğu model de kipi açık bırakamaz —
  // eskiden bir taslakta 'full' yazılı kalmışsa o sessizce taşınırdı.
  bd.beltDataMode = 'none';
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
  // ÇEVRİM KAYDININ İZİ DE TAŞINIR: panelin çevrim seçicisi tabloyu
  // `veFeadDutyMatch` ile tanıyor, yani bu alan hesaba girmiyor — ama
  // kullanıcının hangi ölçülmüş kaydı seçtiğini söyleyen tek yer burası
  // (`structural-materials.js`'in `lib`/`libVer` izinin aynı gerekçesi).
  if(s.dutyLib) sd.dutyLib = s.dutyLib;
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
// CANLI YAMA — NE TAZELENİR, NE TAZELENMEZ
//
// Kullanıcı bildirimi (2026-08-31): *"Uyarılar kısmı biraz problemli, koordinat
// girmemize rağmen hemen güncellemiyor. Hata verebiliyor."*
//
// ÖLÇÜLDÜ (gerçek tarayıcı, 3 kasnaklı boş model): bir kasnağın X/Y'si
// doldurulduğunda canlı şerit ve alt çubuk tazeleniyordu (7 → 6 → 4 eksik) ama
// UYARI KUTUSU 3 satırda ve ADIM RAYI `err:3` rozetinde ÇAKILI kalıyordu —
// yalnız tam yeniden çizimde düzeliyordu. Yani kullanıcı girdiği koordinatın
// karşılığını görmüyor, üstelik artık geçerli olmayan bir hatayı okumaya
// devam ediyordu.
//
// TAM YENİDEN ÇİZİM ÇÖZÜM DEĞİL: `veFeadWizRender` gövdeyi innerHTML ile
// baştan kuruyor ve o an yazılan alanın ODAĞINI düşürüyor — bu deponun
// ölçülmüş kuralı ve canlı şeridin yama olarak yazılma sebebi. Bu yüzden
// yama iki hedef daha alıyor; ikisi de form alanlarının DIŞINDA, dolayısıyla
// odağa dokunmuyorlar.
function veFeadWizLive(){
  if(typeof document === 'undefined') return;
  var b = veFeadWizBuild();
  var el = document.getElementById('ve-fw-live');
  if(el) el.innerHTML = veFeadWizLiveHTML(b);
  var uy = document.getElementById('ve-fw-issue');
  if(uy) uy.innerHTML = veFeadWizIssueHTML(b, _fwStep);
  var nav = document.getElementById('ve-fw-nav');
  if(nav) nav.innerHTML = veFeadWizNavHTML(b);
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
  // KİLİT `readonly`, `disabled` DEĞİL: disabled bir alan gri boşluk gibi
  // okunur ve içindeki SAYI kaybolur gibi görünür; readonly sayıyı okunur
  // bırakır, yalnız yazmayı reddeder. Kullanıcının istediği tam olarak bu:
  // *"değerler değiştirilmemeli"* — gizlenmeli değil.
  return '<input type="' + (opts.text ? 'text' : 'number') + '"'
    + (opts.step ? ' step="' + opts.step + '"' : ' step="any"')
    + ' class="ve-fw-inp' + (opts.kilit ? ' ve-fw-lock' : '') + '"'
    + ' value="' + _fwEsc(v === undefined || v === null ? '' : v) + '"'
    + ' placeholder="' + _fwEsc(opts.ph || '') + '"'
    + (opts.kilit ? ' readonly title="' + _fwEsc(opts.kilitNot || '') + '"' : '')
    + ' oninput="_fwSet(\'' + path + '\', this.value)">';
}
function _fwSelHTML(path, secenekler, cur, opts){
  opts = opts || {};
  var h = '<select class="ve-fw-inp' + (opts.kilit ? ' ve-fw-lock' : '') + '"'
    + (opts.kilit ? ' disabled title="' + _fwEsc(opts.kilitNot || '') + '"' : '')
    + ' onchange="_fwSetRender(\'' + path + '\', this.value)">';
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
// ── ADIM DURUMU — TEK ÜRETİCİ ──────────────────────────────────────────────
//
// Kullanıcı bildirimi (2026-08-31): *"eksik girdi olduğunda kırmızı yanmasını,
// girdiler tam olduğunda ise belirgin bir yeşil yanması… Şu anda kullanıcı
// yeteri kadar bilgilenemiyor."* Haklıydı ve sebebi yapısaldı: rayda tek
// işaret hata ROZETİ idi, yani "sorun yok" ile "buraya hiç bakılmadı"
// AYIRT EDİLEMİYORDU. Üstelik `done` sınıfı GEÇERLİLİĞİ değil KONUMU
// anlatıyordu (i < _fwStep) — üstünden geçilmiş ama eksik bir adım yeşil
// halkalı görünüyordu, yani ray YANLIŞ bilgi veriyordu.
//
// Durum köprünün kendi listesinden süzülüyor (`veFeadWizIssues` → `b.errors` /
// `b.warnings`); ikinci bir doğrulama listesi tutmak, köprü değişince sessizce
// eskiyen bir kapı olurdu — sihirbazın kuruluş kuralının ta kendisi.
//
// ÜÇ DURUM, İKİ DEĞİL: bu modülde "çözülüyor ama uyarı taşıyor" gerçek ve
// sık bir hâl (kalibrasyon dışı çap, türetilemeyen ankraj, kenetlenmiş kol).
// Onu yeşile katmak "her şey tamam" demek, kırmızıya katmak ise çözülen bir
// modeli bozuk göstermek olurdu.
function veFeadWizStepState(b, step){
  var l = veFeadWizIssues(b, step);
  var e = 0, w = 0;
  l.forEach(function(it){ if(it.tur === 'err') e++; else w++; });
  return { durum: e ? 'err' : (w ? 'warn' : 'ok'), err: e, warn: w };
}

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
    // İKİ AYRI KANAL, ÇAKIŞMIYOR: zemin tinti + kalın başlık HANGİ ADIMDA
    // olduğumuzu, renk (sol şerit · numara dairesi · rozet) o adımın DURUMUNU
    // söylüyor. Tek kanala bindirilseydi seçili adımın durumu görünmezdi —
    // oysa kullanıcının en çok baktığı adım tam olarak o.
    var d = veFeadWizStepState(b, i);
    var sinif = 've-fw-step ve-fw-st-' + d.durum + (i === _fwStep ? ' on' : '');
    var rozet = (d.durum === 'ok')
      ? '<span class="ve-fw-step-n" title="Bu adımda eksik girdi yok.">✓</span>'
      : '<span class="ve-fw-step-n" title="'
        + (d.err ? d.err + ' eksik girdi' : '') + (d.err && d.warn ? ' · ' : '')
        + (d.warn ? d.warn + ' uyarı' : '') + '">' + (d.err || d.warn) + '</span>';
    h += '<li class="' + sinif + '" onclick="veFeadWizGoto(' + i + ')" tabindex="0"'
      + ' onkeydown="if(event.key===\'Enter\'){veFeadWizGoto(' + i + ');}">'
      + '<span class="ve-fw-step-no">' + (i + 1) + '</span>'
      + '<span class="ve-fw-step-t"><b>' + _fwEsc(s.ad) + '</b><em>' + _fwEsc(s.ipucu) + '</em></span>'
      + rozet
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
  // Uyarı kutusu KENDİ KABINDA: canlı yama onu form alanlarına dokunmadan
  // tazeleyebilsin diye kararlı bir id gerekiyor.
  if(step !== 6) h += '<div id="ve-fw-issue">' + veFeadWizIssueHTML(b, step) + '</div>';
  return h;
}

// ── 1 · BAŞLANGIÇ ──────────────────────────────────────────────────────────
// Adım bir dönem "gerginin tanım biçimi"ni de soruyordu; o kip seçicisi
// kalktı (tek koordinat kaldı), dolayısıyla burada yalnız künye ve örnekten
// doldurma var. Adımın kendisi KALDI: örnekten doldurmak, alanların hangi
// belgeden okunduğunu anlatmanın en kısa yolu.
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
function _fwStepKasnak(b){
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

  // KASNAK YOKKEN DE TABLO ÇİZİLİR: gergi satırı her zaman orada ve kullanıcı
  // onu oradan tanıyor. Erken dönüş, "gergiyi 4. adımda tanımlayacaksınız"
  // diyordu — artık burada tanımlanıyor.

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
  t += _fwTenRow(st);
  t += '</tbody></table></div>';

  h += _fwCard('Kasnaklar', (st.pulleys.length + 1) + ' kasnak (gergi dahil)',
      'var(--accent-primary)', t
    + _fwHint('<b>Gergi satırı her modelde vardır</b> — eklenmez, silinmez. Onun '
      + 'X/Y sütunu diğer kasnaklardan FARKLI bir noktayı gösterir ve satırdaki etiket '
      + 'bunu yazar: gerginin <b>montaj noktası</b>, yani gövdenin motora cıvatalandığı '
      + 'yer. Kasnağın merkezini program kol açısıyla birlikte hesaplar; ikisini '
      + 'karıştırmanın ölçülmüş bedeli gerginlikte <b>−%48,6</b>. Aynı alanlar 4. adımda '
      + 'da düzenlenebilir; ikisi tek kaydı yazar.')
    + _fwHint('<b style="color:var(--accent-danger);">Temas tarafı hesabın en kritik '
      + 'alanıdır:</b> ters verilirse program <i>geçerli ama başka</i> bir kayış yolu '
      + 'çözer ve hata vermez. Aksesuarlar tipik olarak kaburgalı yüzden, avara ve gergi '
      + 'sırttan temas eder. <b>Atalet</b> yalnız burulma ve tepe yük için, boş bırakılabilir.'));

  // ── DÖNÜŞ YÖNÜ ───────────────────────────────────────────────────────────
  // Kasnaklar tablosunun hemen altında, çünkü yön kasnak MERKEZLERİNİN
  // sırasından okunuyor ve kullanıcı koordinatları burada giriyor.
  h += _fwCard('Dönüş Yönü', 'sıradan türer', 'var(--accent-warning)',
      veFeadWizSpinHTML(b)
    + _fwHint('Yön <b>ayrı bir ayar değildir</b>: kasnak merkezlerinin kayış '
      + 'sırasındaki dolanımından okunur, bu yüzden seçim <b>serpantin sırasını ters '
      + 'yürütür</b> (3. adımdaki "Yönü çevir" ile aynı işlem, aynı alanı yazar). '
      + '<b>Geometri değişmez, GERİLME değişir:</b> ters yürütmek sarım açılarını ve '
      + 'kayış boyunu birebir aynı bırakır (cebirsel özdeşlik) ama gerilme zinciri '
      + 'gergide ankrajlanıp kayış gidiş yönünde yürüdüğü için span gerilmeleri değişir. '
      + 'Otomatik gergi kayışın <b>gevşek</b> tarafında olmalıdır — 14 Gates sisteminin '
      + '14\'ünde de öyle.'));
  return h;
}

// ── GERGİ SATIRI — silinemez, eklenemez, HER MODELDE VAR ──────────────────
//
// Çekirdek tam bir gergi istiyor ("birden fazla tensioner:true" ve "tensioner
// tanimlanmali" ikisi de hata); yani gergi bir SEÇENEK değil, modelin
// parçası. Bu yüzden satır kullanıcı eklemeden gelir ve silinemez — silme
// düğmesi yerinde ama devre dışı, sebebiyle birlikte.
//
// SÜRÜCÜ RADYOSU DEVRE DIŞI: sürücülük bir ROL ve gergi o rolü alamaz
// (çekirdek kranki ayrı, gergiyi ayrı işaretliyor). Etkin bırakmak, seçilince
// modelin çözülemez olduğu bir düğme sunmak olurdu.
function _fwTenRow(st){
  var t = st.ten || {};
  var kx = veFeadWizTenCoordKeys(st), ad = veFeadWizTenCoordLabel(st);
  // Künye seçiliyse parça alanları burada da kilitli — 4. adımla AYNI okuyucu
  // (iki yüzey aynı kaydı yazıyor, biri kilitli öbürü açık olamaz).
  var kilit = veFeadWizTenLocked(st);
  // TİP SÜTUNU TİPİ SÖYLER, KÜNYEYİ DEĞİL. Bir dönem burada künye kütüphanesi
  // açılır listesi vardı ve ilk seçeneği "— elle gir —" olduğu için satır
  // TİP sütununda "elle gir" yazıyordu; kullanıcı bildirdi (2026-08-31):
  // *"otomatik gerginin satırında 'elle gir' gibi bir şey var. O olmayacak,
  // orada normal 'Otomatik Gergi' yazacak."* Diğer beş satırın tip sütunu
  // bileşenin ADINI yazıyor; gergi satırı da öyle yazmalı.
  //
  // Künye seçici SATIRDA KALIYOR ama tipin ALTINDA, ikincil bir kontrol
  // olarak: kullanıcı isteği *"tipinin seçileceği yeri estetik bir şekilde o
  // satıra eklememiz gerekiyor."*
  var liste = (typeof veFeadTensionerList === 'function') ? veFeadTensionerList() : [];
  var kunye = '<select class="ve-fw-inp ve-fw-sub" title="Gergi künyesi — kütüphaneden"'
    + ' onchange="veFeadWizTenLib(this.value)">'
    + [['', '— elle gir —']].concat(liste.map(function(r){
        return [r.key, (typeof veFeadTenLabel === 'function') ? veFeadTenLabel(r) : r.key];
      })).map(function(o){
        return '<option value="' + _fwEsc(o[0]) + '"'
             + (String(o[0]) === String(t.tenLib || '') ? ' selected' : '') + '>'
             + _fwEsc(o[1]) + '</option>'; }).join('')
    + '</select>';
  var tip = '<div class="ve-fw-tip-ten"><b>' + _fwEsc(_fwTenAd()) + '</b>'
    + kunye + '</div>';

  return '<tr class="ve-fw-tr-ten">'
    + '<td class="ve-fw-c"><input type="radio" disabled'
      + ' title="Gergi sürücü olamaz — sürücülük bir roldür ve çekirdek onu ayrı sayar."></td>'
    + '<td>' + tip + '</td>'
    // AD HÜCRESİ DİĞER SATIRLARLA BİREBİR (kullanıcı isteği, 2026-08-31:
    // *"Ad kısmı da diğerleri gibi olacak."*). Amber çip SİLİNMİYOR —
    // karıştırmanın ölçülmüş bedeli gerginlikte −%48,6 — yalnız UYARDIĞI
    // sütuna taşınıyor: çip X sütununun altında.
    + '<td><input type="text" class="ve-fw-inp" value="' + _fwEsc(t.name || '')
      + '" placeholder="' + _fwEsc(_fwTenAd()) + '"'
      + ' oninput="veFeadWizTenSet(\'name\', this.value)"></td>'
    + '<td><input type="number" step="any" class="ve-fw-inp' + (kilit ? ' ve-fw-lock' : '') + '"'
      + ' value="' + _fwEsc(t.od === undefined ? '' : t.od) + '" placeholder="75"'
      + (kilit ? ' readonly title="' + _fwEsc(VE_FW_TEN_LOCK_NOTE) + '"' : '')
      + ' oninput="veFeadWizTenSet(\'od\', this.value)"></td>'
    + '<td><input type="number" step="any" class="ve-fw-inp" value="'
      + _fwEsc(t[kx[0]] === undefined ? '' : t[kx[0]])
      + '" placeholder="-250" oninput="veFeadWizTenSet(\'' + kx[0] + '\', this.value)">'
      + '<span class="ve-fw-tag" title="Gergide bu iki sütun kasnak merkezini DEĞİL, '
      + 'gövdenin motora cıvatalandığı montaj noktasını gösterir — kasnağın merkezini '
      + 'program kol açısıyla birlikte hesaplar.">X/Y = ' + _fwEsc(ad) + '</span></td>'
    + '<td><input type="number" step="any" class="ve-fw-inp" value="'
      + _fwEsc(t[kx[1]] === undefined ? '' : t[kx[1]])
      + '" placeholder="110" oninput="veFeadWizTenSet(\'' + kx[1] + '\', this.value)"></td>'
    + '<td><select class="ve-fw-inp' + (kilit ? ' ve-fw-lock' : '') + '"'
      + (kilit ? ' disabled title="' + _fwEsc(VE_FW_TEN_LOCK_NOTE) + '"' : '')
      + ' onchange="veFeadWizTenSet(\'contact\', this.value)">'
      + '<option value="back"' + (t.contact !== 'grooved' ? ' selected' : '') + '>Sırttan</option>'
      + '<option value="grooved"' + (t.contact === 'grooved' ? ' selected' : '') + '>Kaburgalı</option>'
      + '</select></td>'
    + '<td><input type="number" step="0.0001" class="ve-fw-inp" value="'
      + _fwEsc(t.inertia === undefined ? '' : t.inertia)
      + '" placeholder="—" oninput="veFeadWizTenSet(\'inertia\', this.value)"></td>'
    + '<td class="ve-fw-c"><button type="button" class="ve-fw-x" disabled'
      + ' title="Gergi silinemez: her FEAD modelinde tam bir gergi vardır.">✕</button></td>'
    + '</tr>';
}

// ── 3 · KAYIŞ YOLU ─────────────────────────────────────────────────────────
function _fwStepYol(b){
  var st = _fwState;
  var sira = veFeadWizRoute(st);
  var ad = {};
  st.pulleys.forEach(function(p){ ad[p.key] = p.name || _fwDefName(p.type); });
  ad.__ten__ = (st.ten && st.ten.name) || _fwTenAd();

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

  var h = _fwCard('Serpantin Sırası', sira.length + ' kasnak', 'var(--accent-warning)',
      l
    + '<div class="ve-fw-rowbtns">'
    + '<button type="button" class="ve-fw-btn" onclick="veFeadWizRouteReverse()">⇄ Yönü çevir</button>'
    + '</div>'
    // AYNI ÜRETİCİ, 2. adımdakiyle: iki adım aynı yönü göstermek zorunda.
    + veFeadWizSpinHTML(b)
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
  var kilit = veFeadWizTenLocked(st);
  var kn = { kilit: kilit, kilitNot: VE_FW_TEN_LOCK_NOTE };
  var h = '';

  // ── GERGİ TİPİ ───────────────────────────────────────────────────────────
  // Etiket YALNIZ kol boyu ve çalışma momenti (kullanıcı isteği, 2026-08-31):
  // kaynak rapor adı (`src`) mühendisin seçim yaparken kullandığı bir bilgi
  // değil, bir iz. ÖLÇÜLDÜ — düşürmek ayrımı bozmuyor: 14 kaydın 14'ü de
  // "kol X mm · Y Nm" ile TEKİL (en yakın iki kayıt 22,20 ↔ 22,21 Nm).
  // Etiket üreteci TEK YERDE (veFeadTenLabel, fead-tensioners.js) — panel de
  // aynı listeyi basıyor, iki yüzey ayrışmasın.
  if(typeof veFeadTensionerList === 'function'){
    var liste = veFeadTensionerList();
    var opts = [['', '— elle gir —']].concat(liste.map(function(r){
      return [r.key, (typeof veFeadTenLabel === 'function') ? veFeadTenLabel(r) : r.key];
    }));
    var sel = '<select class="ve-fw-inp" onchange="veFeadWizTenLib(this.value)">'
      + opts.map(function(o){
          return '<option value="' + _fwEsc(o[0]) + '"'
               + (String(o[0]) === String(t.tenLib || '') ? ' selected' : '') + '>'
               + _fwEsc(o[1]) + '</option>'; }).join('') + '</select>';
    h += _fwCard('Gergi Tipi', liste.length + ' künye', 'var(--accent-primary)',
        _fwField('Tip', sel)
      + _fwHint('Seçim kol boyu, yay künyesi ve kasnak çapını doldurur; '
        + '<b>montaj konumu ve kol açısı yazılmaz</b> — ikisi motorun verisi.'
        + (kilit
            ? '<br><b style="color:var(--accent-warning);">Künye seçili olduğu için '
              + 'parça alanları kilitli.</b> Değiştirmek için <b>elle gir</b> seçin — '
              + 'seçtiğiniz künyenin değerleri korunur, yalnız düzenlenebilir olur.'
            : '')));
  }

  // ── MONTAJ KONUMU — TEK KOORDİNAT ───────────────────────────────────────
  h += _fwCard('Otomatik Gergi Montaj Konumu', 'tek girdi', 'var(--accent-danger)',
      _fwGrid([_fwField('Montaj X [mm]', _fwInp('ten.pivotX', { ph: '-250.00' })),
               _fwField('Montaj Y [mm]', _fwInp('ten.pivotY', { ph: '110.00' }))])
    + _fwHint('Gergi <b>gövdesinin motora bağlandığı</b> nokta — kolun döndüğü eksen. '
      + '<b>Avara kasnağının merkezi buradan çıkar</b>: kol bu nokta etrafında kol boyu '
      + 'yarıçapında dönüyor. Kasnak merkezi bir girdi değildir.'));


  h += _fwCard('Kol ve Kasnak', kilit ? 'parça verisi — KİLİTLİ' : 'parça verisi',
      kilit ? 'var(--text-muted)' : 'var(--accent-primary)',
      _fwGrid([_fwField('Kol boyu [mm]', _fwInp('ten.armLen', { ph: '90', kilit: kilit, kilitNot: VE_FW_TEN_LOCK_NOTE })),
               _fwField('Kasnak Ø OD [mm]', _fwInp('ten.od', { ph: '75', kilit: kilit, kilitNot: VE_FW_TEN_LOCK_NOTE })),
               _fwField('Temas tarafı', _fwSelHTML('ten.contact',
                 [['back', 'Sırttan'], ['grooved', 'Kaburgalı']], t.contact || 'back', kn))], 3));

  h += _fwCard('Yay Künyesi', kilit ? 'sayfadaki üç satır — KİLİTLİ' : 'sayfadaki üç satır',
      kilit ? 'var(--text-muted)' : 'var(--accent-success)',
      _fwGrid([_fwField('Ön yük — Pre-Load [Nm]', _fwInp('ten.preload', { ph: '8.60', kilit: kilit, kilitNot: VE_FW_TEN_LOCK_NOTE })),
               _fwField('Yay katsayısı — Rate [Nm/°]', _fwInp('ten.kArm', { ph: '0.480', step: '0.001', kilit: kilit, kilitNot: VE_FW_TEN_LOCK_NOTE })),
               _fwField('Çalışma momenti — Mean [Nm]', _fwInp('ten.meanLoad', { ph: '22.07', kilit: kilit, kilitNot: VE_FW_TEN_LOCK_NOTE }))], 3)
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

  // "BU KÜNYEDEN ÇIKANLAR" KARTI KALDIRILDI (kullanıcı isteği, 2026-08-31):
  // *"'Bu künyeden çıkanlar' kısmına gerek yok. Zaten raporda bunları
  // okuyacağız."* Kart yalnız OKUMA basıyordu, tek bir girdi almıyordu —
  // sayılar da kaybolmuyor: yay kurulması, seçilen kol açısı, türeyen kasnak
  // merkezi, gereken kayış boyu ve tasarım gerginliği hem 7. adımın özet
  // künyelerinde hem raporun §8'inde duruyor.
  //
  // OKUMAYI ÜRETEN BLOK DA GİTTİ, yalnız kart değil: `veFeadSpringSetup` ve
  // `veFeadTensionerCenter` her çizimde koşup hiçbir yere yazmayan bir sonuç
  // üretirdi — bu deponun kendi adıyla andığı ÖLÜ VERİ sınıfı.
  return h;
}
function _fwRead(et, deg){
  return '<div class="ve-fw-read"><span>' + _fwEsc(et) + '</span><b>' + _fwEsc(deg) + '</b></div>';
}

// ── 5 · KAYIŞ ──────────────────────────────────────────────────────────────
function _fwStepKayis(b){
  var st = _fwState, bl = st.belt || {};
  var h = _fwCard('Profil ve Marka', 'h_b / h_r buradan gelir', 'var(--accent-warning)',
      _fwGrid([_fwField('Profil', _fwSelHTML('belt.profile',
                 [['PK','PK'],['PJ','PJ'],['PH','PH'],['PL','PL'],['PM','PM']], bl.profile || 'PK')),
               _fwField('Marka', _fwSelHTML('belt.brand',
                 [['GATES','Gates'],['OPTIBELT','Optibelt'],['CONTITECH','ContiTech']], bl.brand || 'GATES')),
               _fwField('Kanal (kaburga) sayısı', _fwInp('belt.ribs', { ph: '8', step: '1' }))], 3)
    + _fwHint('Profil <b>kapatılamaz bir girdidir</b>: pitch yarıçapı <code>OD/2 + h_b</code>, '
      + 'yani teğet geometrisi profil sabitine dayanıyor (PK\'da h_b = 1,2 mm → merkez '
      + 'mesafelerinde 2,4 mm fark).'));

  // ── ÜÇ KART KALDIRILDI (kullanıcı isteği, 2026-08-31) ────────────────────
  //
  // *"'Kayış' kısmında, 'Künye' ve 'Malzeme' kısımlarına gerek yok. Bunlar
  // detay olarak topoloji bileşenlerinde bulunabilir. Otomatik olarak gelsin…
  // programda SADECE VE SADECE kayış boyunu çıktı olarak verecek. Programa
  // verilen bir kayış olmayacak, kayış sabit kalarak program hesap yapmayacak.
  // Ama 'Kayış' penceresindeki 'profil ve marka' kısmı kalsın."*
  //
  // KALKAN                       | NEDEN
  // -----------------------------|--------------------------------------------
  // Künye (tip/kod·tol·aşınma)   | üçü de kayış SEÇİLDİKTEN sonra anlamlı;
  //                              | Kayış Özellikleri panelinde aynen duruyor
  // Malzeme (kaburga kütlesi)    | yalnız açıklık frekansı için — o da kayış
  //                              | tipine bağlı bir çıktı, yani zaten kapalı
  // "Kayış Tipine Bağlı Çıktılar"| iki seçenekli bir kip DEĞİL artık: kayış
  //                              | boyu tek çıktı, katalog sabitleri KAPALI
  //
  // VERİ KAYBOLMUYOR: `veFeadWizNodes` durumda ne varsa kayış düğümüne
  // taşımaya devam ediyor (örnekten doldurulan tip/kod, tolerans, aşınma,
  // kütle). Sorulmayan alan ile TAŞINMAYAN alan ayrı şeyler — ikincisi
  // kullanıcının örnekten gelen verisini sessizce yutardı.
  h += _fwCard('Kayış Boyu', 'tek çıktı', 'var(--accent-warning)',
      '<div class="ve-fw-reads">'
    + _fwRead('Boy kipi', 'SERBEST (kilitli)')
    + ((b && b.ok && Number.isFinite(b.beltLengthMm))
        ? _fwRead('Gereken boy (çıktı)', _fwFmt(b.beltLengthMm, 1) + ' mm') : '')
    + _fwRead('Kayış tipine bağlı çıktılar', 'KAPALI')
    + '</div>'
    + _fwHint('Gergi <b>montaj koordinatından zarf çözerek</b> çalışıyor, dolayısıyla '
      + 'kayış boyu yapısal olarak bir <b>sonuçtur</b> ve girilemez: kol açısıyla tek '
      + 'serbestlik derecesini paylaşır, açıyı program seçer.<br><br>'
      + '<b>Program bu aşamada kayışın katalog sabitlerini KULLANMAZ.</b> '
      + 'Üretilmeyenler: '
      + _fwEsc((typeof VE_FEAD_BELT_DATA_OFF !== 'undefined' ? VE_FEAD_BELT_DATA_OFF : []).join(' · '))
      + '. Dördü de seçilmiş bir kayışın künyesine dayanıyor; kayış henüz '
      + 'seçilmemişken üretilen sayı bir <b>varsayım</b> olurdu.<br><br>'
      + '<b>Katalogdan boy seçimi kurulumdan sonra</b> yapılır: modeli kurunca '
      + '<b>Kayış Özellikleri</b> paneli, çıkan boya en yakın stok ve ızgara adaylarını '
      + 'her birinin kol açısı ve gerginliğiyle birlikte listeler — tolerans, aşınma ve '
      + 'tip/kod alanları da orada.'));
  return h;
}

// ── AKSESUAR GÜCÜ NEREDEN GELİYOR ──────────────────────────────────────────
//
// Kullanıcı isteği (2026-08-31): *"Motor ve Çevrim kısmında el ile devire
// bağlı olarak aksesuar değerleri girilmiş. Bunu değiştireceğiz. Kullanıcı
// alternatör ve klima kompresörü tipini tıpkı bileşenindeki gibi açılır
// pencere ile seçecek, değerler otomatik olarak gelecek. El ile değer
// girmeyeceğiz."*
//
// ÖNCELİK SIRASI KÖPRÜNÜN KENDİSİNDEN KOPYALANMADI, ONU TAKLİT EDİYOR
// (veFeadDutyToCore + veFeadAutoKw): duty satırında AÇIKÇA yazılı bir kW
// varsa O KAZANIR; yoksa düğümün kendi devir→kW eğrisi; o da yoksa katalog
// modeli; hiçbiri yoksa 0. Sihirbaz bu sırayı EKRANDA aynen göstermek
// zorunda, yoksa kullanıcı katalog seçtiğini sanıp eski bir sayıyla koşar.
//
// ÖLÇÜLDÜ — iki örnek gücünü FARKLI yerden alıyor:
//   AG00976 : aksesuarlarda ne preset ne eğri var; güç YALNIZ duty kW'da
//             (A_C 2,70 · ALT 3,61 kW). Bu değerler düşerse örnek 0 kW'a
//             çöker ve bütün açıklık gerilmeleri tasarım gerginliğine
//             düzleşir — bu modülün belgelenmiş sessiz hata sınıfı.
//   BMC     : aksesuarların KENDİ ölçülmüş eğrisi var (12'şer nokta).
// Bu yüzden kayıtlı kW SİLİNMİYOR, yalnız ELLE GİRİŞ yüzeyi kaldırılıyor.
function _fwAccIdx(b, key){
  if(!b || !b.order) return -1;
  for(var i = 0; i < b.order.length; i++) if(b.order[i].id === 'wz-' + key) return i;
  return -1;
}
// Bir aksesuarın bir devir noktasındaki ETKİN kW'ı ve KAYNAĞI.
function _fwKwEff(b, st, rowIdx, p){
  var r = (st.solver.duty || [])[rowIdx];
  var v = (r && r.kw) ? r.kw[p.key] : undefined;
  if(v !== undefined && v !== null && v !== '')
    return { kw: _fwNum(v, 0), kaynak: 'kayit' };
  // GEOMETRİ ÇÖZÜLMEDEN DE GÜÇ GELİR — kullanıcı bildirimi (2026-08-31):
  // *"aksesuarların tiplerini seçtiğimde değerler hala gelmiyor."* Kapı
  // `b.ok`'tı ve YANLIŞ kapıydı: aksesuar devri `driveRatio · r_sürücü / r_i`,
  // yani salt ÇAPTAN geliyor. Köprü bunun için `ratioSys`i çözülmemiş modelde
  // de kuruyor (bkz. veFeadRatioSys) — `sys` varsa o kazanıyor.
  //
  // İKİ AYRI "değer yok" DURUMU, TEK ETİKETE KATILMAZ:
  //   · oran bile kurulamıyor (çap ya da sürücü yok) → HESAPLANAMAZ.
  //   · oran kurulu ama katalog modeli/eğri yok → gerçekten 0 kW koşar.
  // İkisi bir dönem ikisi de 'yok' diyordu: yarım modelde kart bütün
  // aksesuarları "güç yok" diye uyarıyordu, oysa eksik olan güç değil MODELDİ.
  var rs = b && (b.sys || b.ratioSys);
  if(!rs || typeof veFeadAutoKw !== 'function')
    return { kw: null, kaynak: 'cozumsuz' };
  var i = _fwAccIdx(b, p.key);
  if(i < 0) return { kw: null, kaynak: 'cozumsuz' };
  var kw = veFeadAutoKw(rs, i, b.order[i], _fwNum(r && r.rpm, 0));
  if(kw === null || kw === undefined) return { kw: null, kaynak: 'yok' };
  return { kw: kw, kaynak: (p.pwrCurve && p.pwrCurve.length) ? 'egri' : 'katalog' };
}
var VE_FW_KW_SRC = { kayit: 'kayıtlı ölçüm', egri: 'kendi eğrisi',
                     katalog: 'katalog modeli', yok: 'güç yok',
                     cozumsuz: 'model çözülmüyor' };

// Katalog modeli seçimi. SEÇİM, O AKSESUARIN KAYITLI kW'INI TEMİZLER — yoksa
// köprünün öncelik sırası gereği eski sayı kataloğu SESSİZCE ezerdi
// (kullanıcı modeli seçer, tablo değişmez, sebebi görünmez).
function veFeadWizAccPreset(key, presetKey){
  if(!_fwState) return;
  var p = _fwState.pulleys.filter(function(x){ return x.key === key; })[0];
  if(!p) return;
  if(presetKey) p.accPreset = presetKey; else delete p.accPreset;
  if(presetKey)
    (_fwState.solver.duty || []).forEach(function(r){ if(r.kw) delete r.kw[key]; });
  veFeadWizRender();
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
  h += _fwAccCard(st, b, yuk);

  // DUTY TABLOSUNDA kW SÜTUNU ARTIK BİR GİRDİ DEĞİL, BİR OKUMA. Kullanıcı
  // aksesuar modelini yukarıdaki karttan seçiyor; buradaki sayı o seçimin
  // (ya da kayıtlı ölçümün) o devirdeki karşılığı. Sütunu tamamen kaldırmak
  // daha kolay olurdu ama kullanıcı hangi devirde ne çekildiğini GÖRMELİ —
  // çekilen güç bütün gerilme zincirini belirliyor.
  var t = '<div class="ve-fw-tblwrap"><table class="ve-fw-tbl"><thead><tr>'
    + '<th>Devir [d/dk]</th><th>%zaman</th><th>°C</th>'
    + yuk.map(function(p){
        return '<th>' + _fwEsc(p.name || _fwDefName(p.type)) + '<em>kW · okuma</em></th>'; }).join('')
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
          var e = _fwKwEff(b, st, i, p);
          return '<td class="ve-fw-ro" title="' + _fwEsc(VE_FW_KW_SRC[e.kaynak] || '') + '">'
            + (e.kw === null ? '—' : _fwFmt(e.kw, 2)) + '</td>';
        }).join('')
      + '<td class="ve-fw-c"><button type="button" class="ve-fw-x" title="Satırı sil"'
        + ' onclick="veFeadWizDutyDel(' + i + ')">✕</button></td></tr>';
  });
  t += '</tbody></table></div>';

  // ── ÇEVRİM SEÇİCİ ────────────────────────────────────────────────────────
  // Tablo artık BOŞ açılmıyor; hangi ölçülmüş çevrimin yüklü olduğu burada
  // yazılı ve tek seçimle değişiyor. "Özel" seçeneği bir seçenek DEĞİL, bir
  // OKUMA: kullanıcı satırları elle düzenlediyse tablo hiçbir kayda uymaz ve
  // seçici bunu söyler — sessizce en yakın kaydı göstermek, düzenlenmiş bir
  // tabloyu katalog kaydı gibi okutmak olurdu.
  var lib = (typeof veFeadDutyList === 'function') ? veFeadDutyList() : [];
  var suan = (typeof veFeadDutyMatch === 'function') ? veFeadDutyMatch(s.duty) : null;
  var secili = lib.filter(function(r){ return r.key === suan; })[0] || null;
  var cevrimKart = '';
  if(lib.length){
    var ops = lib.map(function(r){
      return '<option value="' + _fwEsc(r.key) + '"'
           + (r.key === suan ? ' selected' : '') + '>'
           + _fwEsc(veFeadDutyLabel(r)) + '</option>'; }).join('');
    if(!suan) ops = '<option value="" selected>— özel (elle düzenlendi) —</option>' + ops;
    cevrimKart = _fwCard('Çalışma Çevrimi Kaydı', lib.length + ' ölçülmüş çevrim',
        'var(--accent-success)',
        _fwField('Çevrim', '<select class="ve-fw-inp" onchange="veFeadWizDutyLib(this.value)">'
          + ops + '</select>')
      + '<div class="ve-fw-reads">'
        + _fwRead('Kaynak', secili ? secili.kaynak : 'elle düzenlenmiş tablo')
        + _fwRead('Devir noktası', String((s.duty || []).length))
        + _fwRead('%zaman toplamı', _fwFmt((s.duty || []).reduce(function(a, r){
            return a + _fwNum(r.dcPct, 0); }, 0), 1))
      + '</div>'
      + _fwHint(secili
          ? _fwEsc(secili.not) + ' Aşağıdaki tablo bu kayıttan doldu; satırları '
            + 'yine de düzenleyebilirsin — düzenlersen seçici <b>özel</b> der.'
          : 'Tablo kütüphanedeki hiçbir kayda uymuyor, yani elle düzenlenmiş. '
            + 'Listeden bir çevrim seçmek tabloyu o kayıtla değiştirir.'));
  }

  h += cevrimKart;
  h += _fwCard('Çalışma Çevrimi', (s.duty || []).length + ' devir noktası', 'var(--accent-primary)',
      t
    + '<div class="ve-fw-rowbtns"><button type="button" class="ve-fw-btn"'
      + ' onclick="veFeadWizDutyAdd()">+ Devir noktası ekle</button></div>'
    + _fwHint('<b>Sürücü kasnak sütunu YOKTUR</b> — gücünü çekirdek diğerlerinin toplamı '
      + 'olarak hesaplar; elle girilirse çevrim kapanmaz ve çözüm reddedilir. '
      + '<b>%zaman</b> ömür hesabının ağırlığıdır (toplamı 100 olmalı); boş bırakılırsa '
      + 'mutlak ömür hesaplanamaz ama yorulma DAĞILIMI yine geçerlidir. '
      + '<b>kW sütunları salt okunurdur:</b> değer yukarıdaki aksesuar modelinden ya da '
      + 'kayıtlı ölçümden gelir, elle girilmez. <b>—</b> o aksesuarın o devirde gücü '
      + 'olmadığını söyler ve <b>0 kW ile koşar</b>. '
      + '<b>°C</b> satır başına girilir ve çekirdeğin istediği tek sıcaklığa '
      + 'hasar-eşdeğer olarak indirgenir — aritmetik ortalama değil.'));
  return h;
}

// ── AKSESUAR MODELLERİ — bileşen panelindeki açılır pencerenin aynısı ──────
//
// Kaynak da AYNI: `veFeadPresetLib` (Araç Performans modülünün eğrileri).
// FEAD bu eğrileri YENİDEN TANIMLAMIYOR, aynı kütüphaneyi okuyor — ikinci bir
// kopya iki modülün sessizce ayrışması demekti.
//
// AKSESUAR DEVRİ PRESET'İN KENDİ `driveRatio`SUNDAN GELMEZ: kasnak PITCH
// çaplarından hesaplanır (veFeadAutoKw). Spesifikasyon §2.3'ün en ciddi
// bulgusu buydu — elle yazılmış hız oranları bütün gerilmeleri %17 düşürüyordu.
function _fwAccCard(st, b, yuk){
  var satir = '', eksik = [];
  yuk.forEach(function(p){
    var def = (typeof componentDefs !== 'undefined' && componentDefs[p.type]) || {};
    var lib = (typeof veFeadPresetLib === 'function') ? veFeadPresetLib(p.type) : null;
    // Avara ve gergi güç ÇEKMEZ; onlar için "güç yok" bir kusur değil, doğru
    // cevap. Uyarı yalnız yük taşıyabilecek aksesuarlar için anlamlı.
    var yukTasir = !def.isFeadIdler && !def.isFeadTensioner;
    var e = _fwKwEff(b, st, 0, p);
    var kaynakMetin = VE_FW_KW_SRC[e.kaynak] || '—';
    if(e.kaynak === 'katalog' && p.accPreset && lib && lib[p.accPreset])
      kaynakMetin += ' · ' + (lib[p.accPreset].name || p.accPreset);
    if(e.kaynak === 'egri') kaynakMetin += ' · ' + p.pwrCurve.length + ' nokta';
    // Uyarı YALNIZ çözülen modelde anlamlı: yarım modelde her aksesuar
    // "güç yok" görünür ve kart yanlış alarm verirdi.
    if(yukTasir && e.kaynak === 'yok') eksik.push(p.name || _fwDefName(p.type));

    var kutu;
    if(lib){
      var opts = [['', '— seçilmedi —']].concat(Object.keys(lib).map(function(k){
        return [k, lib[k].name || k]; }));
      kutu = '<select class="ve-fw-inp" onchange="veFeadWizAccPreset(\'' + p.key + '\', this.value)">'
        + opts.map(function(o){
            return '<option value="' + _fwEsc(o[0]) + '"'
                 + (String(o[0]) === String(p.accPreset || '') ? ' selected' : '') + '>'
                 + _fwEsc(o[1]) + '</option>'; }).join('') + '</select>';
    } else {
      kutu = '<span class="ve-fw-ro">katalog yok</span>';
    }
    satir += '<tr><td>' + _fwEsc(p.name || _fwDefName(p.type)) + '</td>'
      + '<td>' + kutu + '</td>'
      + '<td class="ve-fw-ro' + (yukTasir && e.kaynak === 'yok' ? ' ve-fw-ro-err' : '') + '">'
      + _fwEsc(kaynakMetin) + '</td></tr>';
  });

  var h = '<div class="ve-fw-tblwrap"><table class="ve-fw-tbl"><thead><tr>'
    + '<th>Aksesuar</th><th>Model (katalog)</th><th>Güç kaynağı</th></tr></thead><tbody>'
    + (satir || '<tr><td colspan="3" class="ve-fw-ro">Henüz aksesuar yok.</td></tr>')
    + '</tbody></table></div>';

  // SESSİZ SIFIR KAPISI: gücü hiçbir yerden gelmeyen bir aksesuar 0 kW ile
  // koşar ve model YİNE çözülür — bütün açıklık gerilmeleri tasarım
  // gerginliğine düzleşir, uyarı çıkmaz. Bu modülün ölçülmüş hata sınıfı,
  // o yüzden sihirbaz onu ADIYLA söylüyor.
  if(eksik.length)
    h += '<div class="ve-fw-issue ve-fw-issue-warn">! Şu aksesuarların gücü hiçbir '
      + 'kaynaktan gelmiyor ve <b>0 kW</b> ile koşacak: <b>' + _fwEsc(eksik.join(', '))
      + '</b>. Model yine çözülür ama açıklık gerilmeleri tasarım gerginliğine '
      + 'düzleşir — bir model seçin.</div>';

  return _fwCard('Aksesuar Modelleri', 'değerler otomatik gelir', 'var(--accent-success)', h
    + _fwHint('Model seçilince güç, o aksesuarın <b>devir→kW eğrisinden</b> okunur; '
      + 'aksesuar devri kasnak <b>pitch çaplarından</b> hesaplanır, katalogdaki oran '
      + 'kullanılmaz. Kaynak, Araç Performans modülünün kataloğuyla AYNI. '
      + '<b>Kayıtlı ölçüm</b> yazan satırlarda güç örneğin kendi tablosundan geliyor; '
      + 'model seçmek o kaydı temizler ve katalog devreye girer.'));
}

// ── 7 · ÖZET VE KURULUM ────────────────────────────────────────────────────
function _fwStepOzet(b){
  var st = _fwState;
  var h = '';

  // Sonuç kartları — sayı UYDURULMUYOR: çözüm yoksa "—" ve sebep.
  var kartlar = [
    ['Durum', b && b.ok ? '✓ çözülüyor' : '✗ çözülemiyor', b && b.ok ? 'ok' : 'err'],
    ['Kasnak', String((b && b.order ? b.order.length : st.pulleys.length + 1)), ''],
    // KOL AÇISI KUTUSU KALDIRILDI (kullanıcı isteği, 2026-08-31). Sayı
    // kaybolmuyor: 4. adımdaki "Bu künyeden çıkanlar" okuması seçilen mutlak
    // kol açısını basmaya devam ediyor, rapor da öyle. Özette onun yeri yoktu:
    // çözülmemiş modelde etiket başka bir büyüklüğe (göreli dönme) düşüyordu,
    // yani tek ad altında iki farklı sayı — bu modülün defalarca düzelttiği
    // kalıp. Kaldırınca sorun da kalkıyor.
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
    veFeadWizSpinSet: veFeadWizSpinSet, veFeadWizSpinHTML: veFeadWizSpinHTML,
    veFeadWizTenLocked: veFeadWizTenLocked, _fwTenAd: _fwTenAd,
    veFeadWizDutyAdd: veFeadWizDutyAdd,
    veFeadWizDutyLib: veFeadWizDutyLib, veFeadWizDutyDel: veFeadWizDutyDel,
    veFeadWizDutySet: veFeadWizDutySet, veFeadWizDutyKw: veFeadWizDutyKw,
    veFeadWizTenSet: veFeadWizTenSet,
    veFeadWizTenCoordKeys: veFeadWizTenCoordKeys,
    veFeadWizTenCoordLabel: veFeadWizTenCoordLabel,
    veFeadWizAccPreset: veFeadWizAccPreset,
    _fwKwEff: _fwKwEff, _fwTenRow: _fwTenRow, _fwAccCard: _fwAccCard,
    veFeadWizIssues: veFeadWizIssues,
    veFeadWizStepState: veFeadWizStepState, veFeadWizStepOf: veFeadWizStepOf,
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
