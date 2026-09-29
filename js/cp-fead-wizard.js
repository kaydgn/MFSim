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
// ── KAYIŞ SIRASI = KAYIŞ TABLOSUNUN SIRASI ────────────────────────────────
// Sihirbazdaki sıra kurulumda `node.data.beltIndex`e yazılıyor (kasnaklar arası
// bağlantı 2026-09-09'da kaldırıldı) ve dönüş yönü (CW/CCW) ondan TÜRER, ayrı
// bir alan yok. Sihirbaz sırayı kayışın GİDİŞ yönünde gösteriyor; indis tablo
// sırasını taşıdığı için kurulumda veFeadRouteFlip'ten geçiyor.

var VE_FW_STEPS = [
  { key:'kaynak', ad:'Başlangıç',      ipucu:'Sistem adı · STEP dosyası · örnekten doldur' },
  // KAYIŞ YOLU ADIMI KALDIRILDI (kullanıcı isteği, 2026-09-04): *"Kayış yolu
  // kısmını kaldıralım. Gerek yok. O işi zaten 'kasnaklar' kısmından
  // yapıyoruz."*
  //
  // ÖLÇÜLDÜ: "zaten yapıyoruz" O AN DOĞRU DEĞİLDİ — `veFeadWizPulleyMove`
  // yalnız `st.pulleys`i takas ediyordu, `st.route`a HİÇ dokunmuyordu (kodun
  // kendi yorumu: "BU SIRA KAYIŞ YOLU DEĞİLDİR"). Adımı olduğu gibi silmek
  // serpantin sırasını DÜZENLENEMEZ bırakırdı.
  //
  // Bu yüzden adım silinmedi, YETENEĞİ TAŞINDI: Kasnaklar tablosu artık
  // kayış sırasının KENDİSİ (gergi satırı da kendi sırasında) ve ↑ ↓ rotayı
  // taşıyor. Tablo sırası ile kayış sırası ARTIK AYNI ŞEY — eski ayrım
  // "tabloyu düzenlemek gerilmeyi sessizce değiştirmesin" diyeydi; şimdi
  // değiştirmesi SESSİZ değil, kartın konusu.
  { key:'kasnak', ad:'Kasnaklar',      ipucu:'Kayış sırası · tip · çap · koordinat · sürücü' },
  { key:'gergi',  ad:'Otomatik Gergi', ipucu:'Montaj noktası · kol boyu · yay künyesi' },
  { key:'kayis',  ad:'Kayış',          ipucu:'Profil · kanal sayısı · katalog sonuçları' },
  { key:'cevrim', ad:'Motor ve çevrim',ipucu:'Tahrik oranı · motor künyesi · çalışma çevrimi' },
  { key:'ozet',   ad:'Özet ve kurulum',ipucu:'Canlı çözüm · kayış yolu şeması · modeli kur' }
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
  return veSayi(x, dg === undefined ? 1 : dg);
}
function _fwDefName(type){
  var d = (typeof componentDefs !== 'undefined' && componentDefs[type]) || {};
  return d.name || type;
}

// GERGİNİN SİHİRBAZDAKİ ADI TEK YERDE.
//
// Palet adı "Gergi" (`componentDefs['fead-tensioner'].name`) ama sihirbaz baştan
// beri "Otomatik Gergi" diyor: gergi adımının başlığı, kayış yolu listesi ve
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
    ad: 'Yeni FEAD sistemi',
    pulleys: [],
    // GERGİNİN SAYILARI BOŞ AÇILIR — kullanıcı isteği (2026-09-22):
    // *"Otomatik gergiyi başlangıç sihirbazında otomatik olarak görüyoruz.
    // Bu otomatik olarak gelmesin, kullanıcı seçsin."*
    //
    // Gerginin VARLIĞI yapısal: `fead-core.js` gergisiz sistemi reddediyor
    // (throw) ve çekirdek dokunulmaz — yani "gergi hiç gelmesin" bugünkü
    // matematikte "model hiç çözülmesin" demek. Seçtirilebilecek olan
    // SAYILARDIR: çap ve kol boyu artık yazılı gelmiyor, kullanıcı ya 3.
    // adımdaki katalogtan künye seçiyor ya da elle giriyor.
    //
    // `contact` BOŞ BIRAKILMIYOR: otomatik gerginin kayışa sırttan değmesi
    // bir ölçüm değil tipin kendisi (`componentDefs.feadContact`), ve
    // seçtirmek olmayan bir özgürlük sunardı.
    ten: { contact: 'back', tenLib: '' },
    route: [],
    belt: { profile: 'PK', brand: 'GATES', ribs: 8 },
    // ÇALIŞMA ÇEVRİMİ DOLU AÇILIR. Bir dönem `duty: []` idi ve kullanıcı
    // bildirdi: aksesuar modeli seçilse bile doldurulacak satır olmadığı için
    // kW sütunları boş kalıyor, on iki satır elle açılıyordu. Kayıt hangi
    // ölçümden geldiğini söylüyor ve 6. adımdaki seçiciyle değiştirilebiliyor.
    // `driveRatio` BURADA YOK. Sihirbaz elle oran SORMUYOR (2026-09-01) ama
    // boş duruma yazılı 1 her kurulan modele taşınıyordu: kullanıcı "ara
    // kademe" seçip TEK çap girdiğinde köprü o 1'e düşüyor, oran 1 çıkıyor,
    // kip "elle girildi" oluyor ve "Algılanan Model" satırı ✓ gösteriyordu —
    // girilen çapın hiç kullanılmadığı hâlde. Alan olmayınca aynı durum
    // ok:false veriyor ve satır ✗ ile uyarıyor.
    // SİLİNDİR SAYISI YAZILI GELMİYOR (2026-09-29): 6 hiçbir motorun sayısı
    // değildi ve boş sihirbazdan kurulan her model 6 silindirli bir motorun
    // ateşleme frekansıyla çözülüyordu. Motor künyesi seçilir ya da girilir.
    // SERVİS FAKTÖRÜ DE YAZILI GELMİYOR (2026-09-29, kural 48): 1,3'ün kaynağı
    // yoktu; c₂ Kayış adımındaki yük katsayısı tablosundan seçilir.
    solver: { ratioMode: 'derive',
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
// İki yüzey (Kasnaklar tablosundaki gergi satırı ve gergi adımının koordinat kartı)
// AYNI alanı yazmak ZORUNDA — ikinci bir durum kopyası tutulsaydı biri
// ötekini sessizce eskitirdi (bu modülün tekrar eden kuralı: "panel ile kart
// AYNI alanı okur").
//
// VE O ALAN DİĞER BEŞ SATIRINKİYLE AYNI ŞEYDİR: altı satırın altısında da
// kasnağın MERKEZİ isteniyor. Gerginin farkı, merkezin çalışma (Mean)
// konumundaki hâli olması ve gövdenin montaj konumunun ondan TÜREMESİ.
//
// Buraya montaj konumu yazmanın ölçülmüş bedeli 14 Gates sisteminde gerginlikte
// medyan +%1526 (en kötü +%4518) — ve 14/14 sistem YİNE ÇÖZÜLÜYOR, 5'inde
// hiçbir uyarı çıkmıyor. Satır bu yüzden hangi noktayı istediğini ADIYLA
// yazıyor, ve gergi adımı türeyen montaj konumunu okutuyor.
//
// ALAN ADI BURADA TEK YERDE: satır da gergi adımının koordinat kartı da buradan
// okuyor. (Bir dönem bir de `veFeadWizTenCoordLabel` vardı; satırdaki amber
// çip kullanıcı isteğiyle kalkınca onu okuyan tek yüzey de kalktı ve ölü
// export olarak kalmasın diye silindi. Uyarı kaybolmadı: alanların `title`
// ipucuna ve tablonun altındaki karta taşındı.)
function veFeadWizTenCoordKeys(){
  return ['cenX', 'cenY'];
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

// ── KASNAK TABLOSUNDA SATIR TAŞIMA ────────────────────────────────────────
//
// Kullanıcı isteği (2026-09-01): *"'Kasnaklar' kısmında sırasıyla girdiğimiz
// kasnakları tutup yukarı, aşağı çekelim. Yani yerlerini değiştirelim."*
//
// BU SIRA KAYIŞ YOLU DEĞİLDİR ve olmamalı: serpantin sırası `st.route`'ta
// duruyor ve 3. adımda düzenleniyor. Buradaki sıra tablonun ve duty tablosu
// kW sütunlarının okuma sırası — yani kullanıcının kendi düzeni. İkisini
// birbirine bağlamak, tabloyu düzenlemenin kayış yolunu sessizce değiştirmesi
// demekti; ÖLÇÜLEBİLİR bir fark olurdu, çünkü yol gerilmeyi belirliyor.
// TABLO SIRASI = KAYIŞ SIRASI (2026-09-04). Eskiden bu iki sıra AYRIYDI ve
// ayrılığın gerekçesi "tabloyu düzenlemek gerilmeyi sessizce değiştirmesin"di.
// Kayış Yolu adımı kalkınca sıra düzenlemenin tek yeri burası oldu; artık
// değişiklik sessiz DEĞİL — kartın başlığı ve hükmü bunu söylüyor.
//
// Taşıma `veFeadWizRouteMove`a devrediyor: gergi (`__ten__`) `st.pulleys`te
// DEĞİL `st.ten`de duruyor ve yalnız o fonksiyon okunan sırayı geri yazmayı
// biliyor. İkinci bir taşıyıcı yazmak, gerginin satırını yine ölü bırakırdı.
function veFeadWizPulleyMove(key, delta){
  // TAŞIMA BASILAN SIRADA OKUNUR. Tablo 2026-09-22'den beri TABLO sırasını
  // basıyor (Gates "Layout Data", gidişin tersi) ama model sırası (`st.route`)
  // GİDİŞ olarak kalıyor. `veFeadRouteFlip` bir yansıma olduğu için basılan
  // sıradaki bir satır aşağı, gidiş sırasında bir satır YUKARI demektir.
  // Çevrilmezse oklar ters yönde taşır: kullanıcı "aşağı" der, satır yukarı
  // gider — ve jsdom kapıları bunu yakalayamaz (okunan sıraya bakıyorlar,
  // BASILAN sıraya değil).
  return veFeadWizRouteMove(key, -delta);
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
// BAŞARIYI DÖNDÜRÜYOR: satır okları artık bunun üstünde duruyor ve "taşındı
// mı?" sorusunun bir cevabı olmalı (uçta duran ok sessizce hiçbir şey yapar).
function veFeadWizRouteMove(key, delta){
  if(!_fwState) return false;
  var r = veFeadWizRoute(_fwState), i = r.indexOf(key), j = i + delta;
  if(i < 0 || j < 0 || j >= r.length) return false;
  // İKİ UÇ KİLİTLİ — Kayış Tablosu'ndaki kalıbın BİREBİR aynısı, çünkü
  // sihirbaz tam o tabloyu kuruyor ve iki yüzey aynı kuralı söylemeli.
  //   · GİDİŞ sırasının 0. öğesi SÜRÜCÜ (basılan tablonun da ilk satırı).
  //     Eskiden korumasızdı: 1. satırın ↑'si sürücüyle YER DEĞİŞTİRİYORDU.
  //   · GİDİŞ sırasının 1. öğesi GERGİ ise, o basılan tablonun SON satırıdır
  //     ("döngü otomatik gergiyle biter"). Kilit yalnız kural yerindeyken —
  //     gergisi başka yerde duran bir durum okla düzeltilebilmeli.
  if(i === 0 || j === 0) return false;
  if(r.indexOf('__ten__') === 1 && (i === 1 || j === 1)) return false;
  var t = r[i]; r[i] = r[j]; r[j] = t;
  _fwState.route = r;
  delete _fwState.siraKaynagi;           // sıra artık kullanıcının
  veFeadWizRender();
  return true;
}
// Sırayı çevirmek = dönüş yönünü çevirmek. Ayrı bir "yön" alanı YOK; yön
// sıranın kendisinden türüyor (FEAD araçları penceresinin Yön bölümüyle aynı kural).
function veFeadWizRouteReverse(){
  if(!_fwState) return;
  var r = veFeadWizRoute(_fwState);
  if(r.length > 2) _fwState.route = [r[0]].concat(r.slice(1).reverse());
  else _fwState.route = r;
  delete _fwState.siraKaynagi;           // sıra artık kullanıcının
  veFeadWizRender();
}

// ── DÖNÜŞ YÖNÜ SEÇİMİ — DURUM TUTMAZ, SIRAYI ÇEVİRİR ──────────────────────
//
// Kullanıcı isteği (2026-08-31): *"'Kasnaklar' kısmına 'dönüş yönü' seçmeyi de
// eklememiz gerekiyor. Dönüş yönünü seçtikten sonra matematik ve topoloji buna
// göre belirlensin."*
//
// FEAD araçları penceresinin Yön bölümüyle BİREBİR aynı kural: yön bir AYAR değil, rota
// sırasının sonucudur (`FEADCore.loopSense` kasnak merkezlerinin ayakkabı-bağı
// işaretli alanına bakar). Duruma bir `dir` alanı koymak İKİNCİ bir gerçek
// kaynak yaratırdı ve üç yerden ısırırdı: 3. adımın sıra listesi yalan söyler,
// kurulan kanvasın gidiş okları bayrakla çelişir, bayrak silinince yön sessizce
// dönerdi. Bu yüzden seçim yalnız ŞUNU yapıyor: istenen yön bugünkünden
// farklıysa sırayı çevir.
//
// İSTENEN YÖN ZATEN GEÇERLİYSE HİÇBİR ŞEY YAPILMAZ — yoksa aynı düğmeye ikinci
// tık sırayı geri çevirir ve seçici bir aç/kapa gibi davranırdı.
//
// DÜĞME DE KART DA AYNI ÇERÇEVEDE. `b.spin` `FEADCore.loopSense`'ten geliyor
// ve çizim aynalanmadığı için ekranda görülen yön onunla AYNI — arada çeviri
// yok. (Bir dönem burada bir ayna çevirisi vardı; ayna kaldırıldı.)
function veFeadWizSpinSet(dirFront){
  if(!_fwState) return false;
  var istenen = _fwNum(dirFront, 0);
  var b = _fwBuild || veFeadWizBuild();
  var suan = (b && b.spin) ? b.spin : 0;
  if(!istenen || !suan || istenen === suan){ veFeadWizRender(); return false; }
  veFeadWizRouteReverse();
  return true;
}

// Dönüş yönü: ikon + kısa ad ("↻ CW" karakterdi; karar 10·B).
function _fwSpinHTML(spin){
  var et = veFeadSpinLabel(spin);
  return (et.ikon ? veIkon(et.ikon) + ' ' : '') + _fwEsc(et.kisa);
}

// Yön yüzeyi TEK ÜRETİCİDEN: 2. adım (Kasnaklar) ile 3. adım (Kayış Yolu) aynı
// kontrolü basıyor. İki kopya tutulsaydı biri düzeltilince öbürü sessizce
// eskirdi — bu deponun tekrar eden kuralı ("panel ile kart AYNI alanı okur").
function veFeadWizSpinHTML(b){
  var sp = (b && b.spin) || 0;                     // ÇİZİLEN yön
  function dugme(v){
    var et = veFeadSpinLabel(v);
    return '<button type="button" class="ve-fw-spin' + (sp === v ? ' ve-fw-spin-on' : '')
      + '"' + (sp ? '' : ' disabled')
      + ' onclick="veFeadWizSpinSet(' + v + ')" title="' + _fwEsc(et.uzun) + '">'
      + _fwSpinHTML(v) + '</button>';
  }
  return '<div class="ve-fw-spinbox">'
    // İPUCU METNİ DE TEK ÜRETİCİDEN. Düzlem adı burada İKİNCİ KEZ yazılsaydı,
    // ayna bayrağı değişince bu iki düğme sessizce eskirdi — tam olarak bir
    // kez olan şey (metin koşulsuz "önden bakışta" diyordu).
    + dugme(1)
    + dugme(-1)
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
// ── MOTOR ODASI SICAKLIĞI — TEK ALAN, BÜTÜN SATIRLARA ────────────────────
//
// Kullanıcı isteği (2026-09-04): *"buradaki 'C' sütununa da gerek yok. Üst
// tarafa … 'motor odası sıcaklığı' tarzı bir ifade… Oraya sadece bir değer
// gireriz."*
//
// VERİ MODELİ DEĞİŞMEDİ: sıcaklık satır başına saklanmaya devam ediyor,
// çünkü köprü ondan bir HASAR-EŞDEĞER sıcaklık türetiyor
//   degC_eş = 80 + ΔT · log2( Σ wᵢ · 2^((Tᵢ−80)/ΔT) )
// ve satırlar farklıysa B10 ömrü gerçekten değişir. Kaldırılan şey SÜTUN,
// alan değil.
//
// ÖLÇÜLDÜ: on iki örneğin HEPSİNDE tablo içi sıcaklık tek (90 · 80 · 92 · 70),
// yani tek alan pratikte hiçbir şey kaybettirmiyor. Yine de satırlar farklıysa
// alan bunu SESSİZCE düzlemez — okuma "satır başına farklı" der ve yazma
// ancak kullanıcı alana dokununca olur.
function veFeadWizDutyTemp(val){
  if(!_fwState || !_fwState.solver) return;
  (_fwState.solver.duty || []).forEach(function(r){ r.degC = val; });
  veFeadWizLiveSoon();
}
// Tablodaki sıcaklıkların ortak değeri; satırlar ayrışıksa null.
function veFeadWizDutyTempOf(duty){
  var v = null;
  for(var i = 0; i < (duty || []).length; i++){
    var t = String(duty[i].degC === undefined || duty[i].degC === null ? '' : duty[i].degC);
    if(i === 0) v = t; else if(t !== v) return null;
  }
  return v;
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
  var st = _fwSeedKayit(ex);
  st.ad = ex.name || key;
  // HANGİ ÖRNEKTEN DOLDURULDUĞUNUN İZİ. Hesaba girmiyor; 1. adımdaki kartın
  // "yüklendi" işaretini besliyor ve taslakla birlikte düğümde kalıyor, yani
  // kullanıcı geri döndüğünde hangi örnekle başladığını görüyor.
  st.seededFrom = key;
  _fwState = st;
  _fwStep = 0;
  // Yeni model: masanın seçimi ve yakınlığı eskisine aitti.
  _fwSec = null; _fwZoom = 1;
  veFeadWizRender();
  return true;
}

// ÖRNEK KAYDI → DURUM (DOM'suz). İKİ KAYNAK TEK YOLDAN: kayıt defterindeki
// örnek (`veFeadWizSeed`) ve STEP dosyasından gelen kayıt (`veFeadWizStpAktar`)
// — FEAD kural 34: "sihirbaz onu örnek gibi yükler, ikinci kurulum yolu
// açılmaz". İkinci bir kopyalayıcı, kural 20'nin sessiz sınıfını (bir yöne
// eklenip ötekine eklenmeyen alan) ikiye katlardı.
//
// Kayıt kayış ya da çözücü TAŞIMIYORSA (STEP) o bölümler BOŞ DURUMDAN kalır:
// kayışa dokunulmaz (kullanıcı kararı, 2026-09-26: *"Kayışı zaten biz manuel
// olarak dolduruyoruz"*). Eskiden `ex.belt || {}` yazılıydı — kayıtsız bir
// kaynak profili ve kanal sayısını SİLERDİ.
function _fwSeedKayit(ex){
  var st = veFeadWizDefault();
  st.ad = ex.name || st.ad;
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
    // DEVİR SINIRLARI DA TOHUMA GİRER. Ters yön (`veFeadWizNodes`) bunları
    // zaten taşıyordu; eksik olan ÖRNEK → DURUM yönüydü ve tohum alan alan
    // kopyaladığı için eksiklik sessizdi: örnekte sınır var, sihirbazdan
    // kurulan modelde yok, uygunluk kapısı "değerlendirilemedi" diyordu.
    if(d.accLib) row.accLib = d.accLib;
    ['optimumRpm', 'maxContRpm', 'maxPeakRpm'].forEach(function(a){
      if(d[a] !== undefined) row[a] = d[a];
    });
    keyMap[p.key] = row.key;
    st.pulleys.push(row);
  });
  // SIRA KAYIŞIN GİDİŞİ (2026-09-08). `ex.route` Gates TABLO sırası, yani
  // gidişin tersi; tablo "kayış sırasıyla" dediği için tohum çevrilir (krank
  // sabit, kalanı ters). Köprü kurarken geri çevirir — sayılar birebir.
  st.route = veFeadRouteFlip((ex.route || []).map(function(k){ return keyMap[k]; })
    .filter(function(k){ return !!k; }));
  if(ex.belt) st.belt = JSON.parse(JSON.stringify(ex.belt));
  if(ex.solver){
    st.solver = JSON.parse(JSON.stringify(ex.solver));
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
  }
  st.temizle = false;
  return st;
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
    // BMC KÜNYESİ VE DEVİR SINIRLARI DA TAŞINIR. Aynı sessiz sınıf: taşınmazsa
    // kullanıcı sihirbazda künyeyi seçer, kapılar orada hüküm verir, kurulan
    // modelde aynı kapılar "değerlendirilemedi" der — iki yüzey ayrışır.
    if(p.accLib){ d.accLib = p.accLib; if(p.accLibVer) d.accLibVer = p.accLibVer; }
    ['optimumRpm', 'maxContRpm', 'maxPeakRpm'].forEach(function(a){
      var v = _fwNum(p[a], NaN);
      if(Number.isFinite(v)) d[a] = v;
    });
    var n = { id: 'wz-' + p.key, type: p.type,
              customName: p.name || _fwDefName(p.type), data: d };
    byKey[p.key] = n;
    out.push(n);
  });

  // ── GERGİ ────────────────────────────────────────────────────────────────
  // Kip alanı YOK: tek yol var (avara merkezi girdi, montaj konumu türev).
  var t = st.ten || {};
  // ÇAP YEDEĞİ YOK. Bir dönem `_fwNum(t.od, 75)` yazılıydı; tohum boşaltılıp
  // bu yedek bırakılsaydı "kullanıcı seçsin" isteği GÖRÜNÜRDE yerine gelir,
  // gerçekte gelmezdi: alan boş görünür, kurulan modele sessizce 75 yazılırdı.
  // Bu, tam olarak bu modülün belgelenmiş sessiz hata sınıfı.
  var td = { contact: t.contact || 'back',
             od: _fwNum(t.od, NaN), armLen: _fwNum(t.armLen, NaN) };
  if(!Number.isFinite(td.od)) delete td.od;
  if(!Number.isFinite(td.armLen)) delete td.armLen;
  ['preload', 'kArm', 'meanLoad', 'armInertia', 'pulleyMass', 'loadStopRelDeg',
   'inertia'].forEach(function(a){
    var v = _fwNum(t[a], NaN);
    if(Number.isFinite(v)) td[a] = v;
  });
  // TEK KOORDİNAT: avara merkezi. Kol çalışma açısı da bir GİRDİ ve zorunlu —
  // yazılmazsa köprü modeli çözmez ve sebebini adıyla yazar (kullanıcı onu
  // gergi adımında görür).
  if(Number.isFinite(_fwNum(t.cenX, NaN))) td.cenX = _fwNum(t.cenX, NaN);
  if(Number.isFinite(_fwNum(t.cenY, NaN))) td.cenY = _fwNum(t.cenY, NaN);
  if(Number.isFinite(_fwNum(t.armMeanDeg, NaN))) td.armMeanDeg = _fwNum(t.armMeanDeg, NaN);

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
  // HESAP ÇAPI VE CAD ESKİZİNİN ÖLÇÜSÜ DE TAŞINIR (kural 20). Taşınmasaydı
  // sihirbazda "CAD eskizi" seçilir, kurulan model sessizce katalogla çözülürdü.
  if(b.hesapCap === 'cad' || b.hesapCap === 'db') bd.hesapCap = b.hesapCap;
  ['hbCad', 'hrCad'].forEach(function(a){
    var v = _fwNum(b[a], NaN);
    if(Number.isFinite(v)) bd[a] = v;
  });
  // KAYIŞ TİPİNE BAĞLI ÇIKTILAR HER ZAMAN KAPALI (kullanıcı kararı,
  // 2026-08-31): *"programda SADECE VE SADECE kayış boyunu çıktı olarak
  // verecek… kayış sabit kalarak program hesap yapmayacak."* Sihirbaz artık
  // seçenek SUNMUYOR, dolayısıyla kurduğu model de kipi açık bırakamaz —
  // eskiden bir taslakta 'full' yazılı kalmışsa o sessizce taşınırdı.
  bd.beltDataMode = 'none';
  // KAYIŞ KİPİ HİÇ YAZILMAZ: gergi avara merkezinden çözüldüğü için boy
  // yapısal olarak bir ÇIKTI ve köprü kipi zaten kilitliyor
  // (veFeadBeltModeLocked). Yazmak, panelde "SABİT" görünüp serbest koşan bir
  // model üretirdi. (Bir dönem burada `if(false)` ile kapatılmış bir atama
  // duruyordu — koşul hiç doğru olamayacağı için ölü daldı.)
  out.push({ id: 'wz-belt', type: 'fead-belt', data: bd });

  var s = st.solver || {};
  // KİP KOŞULSUZ `derive`: sihirbaz artık elle oran sormuyor (kullanıcı kararı,
  // 2026-09-01), dolayısıyla kurduğu model de elle oran taşıyamaz. Eski bir
  // taslakta `direct` yazılı kalmışsa sessizce taşınırdı.
  // ÜÇ KİP TAŞINIR (2026-09-04): `crankDirect` (krank kasnağı doğrudan FEAD'i
  // tahrik ediyor), `unity` (kranka bağlı ayrı sürücü kasnak — aynı devir) ve
  // `derive` (gerçek ara kademe, çaplardan türe). Elle oran (`direct`) hâlâ
  // YOK ve eski taslaklardan taşınmıyor: `derive`a düşer, çünkü elle yazılmış
  // bir oran spesifikasyon §2.3'ün en ciddi bulgusuydu.
  var _kip = (s.ratioMode === 'unity' || s.ratioMode === 'crankDirect') ? s.ratioMode : 'derive';
  var sd = { ratioMode: _kip };
  // Dört motor devri (`idleRpm` … `overspeedRpm`) ÖLÜ ALAN DEĞİL: ikisi
  // uygunluk kapılarını besliyor (js/fead-checks.js). Taşınmazsa sihirbazda
  // hüküm veren kapılar kurulan modelde "değerlendirilemedi" derdi.
  ['driveRatio', 'crankOD', 'fanOD', 'cylinders', 'serviceFact', 'crankInertia',
   'accelRpmS', 'decelRpmS', 'lengthOffsetMm',
   'idleRpm', 'governedRpm', 'noLoadGovernedRpm', 'overspeedRpm'].forEach(function(a){
    var v = _fwNum(s[a], NaN);
    if(Number.isFinite(v)) sd[a] = v;
  });
  if(s.fatigueModel) sd.fatigueModel = s.fatigueModel;
  // SERVİS FAKTÖRÜNÜN HÜCRESİ DE TAŞINIR (kural 20 · 48): yalnız sayı taşınsaydı
  // kurulan modelde değer doğru olur ama tablo hangi hücrenin seçildiğini
  // gösteremezdi ("kayıtlı değer — tablodan seçilmedi").
  if(s.servisHucre) sd.servisHucre = String(s.servisHucre);
  // SÜRTÜNME SEÇİMİ DE TAŞINIR (kural 20 · 49): seçim ve elle üç sayı. Seçim
  // yoksa alan yazılmaz — varsayılan (Gates kalibrasyonu) köprüde çözülür.
  if(s.surtunme) sd.surtunme = String(s.surtunme);
  ['muOluk', 'muSirt', 'kucukKasnakMm'].forEach(function(a){
    var v = _fwNum(s[a], NaN);
    if(s.surtunme === 'elle' && Number.isFinite(v)) sd[a] = v;
  });
  // Motor kaydının izi — `dutyLib`/`tenLib` ile aynı gerekçe: hangi künyeden
  // gelindiği tek yerde yazılı olsun ki panel "katalogdan sapıldı" diyebilsin.
  if(s.engineLib){ sd.engineLib = s.engineLib; if(s.engineLibVer) sd.engineLibVer = s.engineLibVer; }
  // ÇEVRİM KAYDININ İZİ DE TAŞINIR: panelin çevrim seçicisi tabloyu
  // `veFeadDutyMatch` ile tanıyor, yani bu alan hesaba girmiyor — ama
  // kullanıcının hangi ölçülmüş kaydı seçtiğini söyleyen tek yer burası
  // (`lib`/`libVer` izi aynı gerekçeyle tutulur).
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
  // İKİ KANVAS, TEK TİP (2026-09-11, kullanıcı isteği: *"tipoloji tek
  // olacak"*). Fark ön ayarın ADI (`katOn`), tipin kendisi değil; ad da
  // yazılır, yoksa iki kart yan yana aynı etiketi taşırdı.
  out.push({ id: 'wz-layout', type: 'fead-layout', data: {} });
  out.push({ id: 'wz-run',    type: 'fead-layout',
             customName: 'Çalışma Noktası', data: { katOn: 'isletme' } });
  out.push({ id: 'wz-report', type: 'fead-report', data: {} });

  // ── SIRA İNDİSTE, TELDE DEĞİL (2026-09-09) ───────────────────────────────
  // `st.route` kayışın GİDİŞ sırasıdır — sihirbaz kullanıcıya o sırayı
  // gösteriyor ve gergiyi krankın hemen ardına koyuyor. `beltIndex` ise TABLO
  // sırasını taşır, yani gidişin TERSİNİ → veFeadRouteFlip (krank sabit,
  // kalanı ters). Çevirme atlansaydı sihirbazdan kurulan her model ters
  // numaralanır, gergi kayışın GERGİN tarafına düşer ve span gerilmeleri
  // negatife inerdi — model yine "çözülüyor" derdi.
  var sira = (st.route || []).filter(function(k){ return !!byKey[k]; });
  if(sira.length > 1 && typeof veFeadRouteFlip === 'function')
    veFeadRouteFlip(sira.map(function(k){ return byKey[k]; }))
      .forEach(function(n, i){ n.data.beltIndex = i + 1; });
  return { nodes: out, connections: [], solverId: 'wz-solver' };
}

// Sıraya gergi de girmeli; kullanıcı kasnak eklerken sıraya otomatik ekleniyor
// ama gergi durumda ayrı duruyor. Sıra listesi bu yüzden burada tamamlanıyor.
function veFeadWizRoute(st){
  st = st || _fwState;
  var r = (st.route || []).slice();
  // GERGİ VARSAYILAN OLARAK KRANKIN HEMEN ARDINDA (2026-09-08): sıra kayışın
  // gidişi olduğu için gevşek açıklık krankın ÇIKIŞIDIR, kayış sırasında 2.
  // konum. Sona eklemek (eski, tablo sırası dönemi) gergiyi krankın GİRİŞİNE,
  // yani gergin tarafa koyardı — rozet kırmızı, span negatif.
  if(r.indexOf('__ten__') < 0) r.splice(Math.min(1, r.length), 0, '__ten__');
  var gecerli = {};
  (st.pulleys || []).forEach(function(p){ gecerli[p.key] = 1; });
  gecerli.__ten__ = 1;
  return r.filter(function(k){ return gecerli[k]; });
}

// ── CANLI ÇÖZÜM ────────────────────────────────────────────────────────────
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
  try { b = veFeadBuildSystem(pack.nodes); }
  catch(e){ return null; }
  _fwBuild = b;
  return b;
}

// Hangi hata hangi adıma ait — kullanıcı "eksik alan" mesajını girdiği yerde
// görsün diye. Eşleşmeyen mesaj ÖZET adımında toplanıyor: bilinmeyen bir
// hatayı gizlemek, yanlış yere koymaktan kötüdür.
var VE_FW_ERR_STEP = [
  { re: /kasnağının konumu|dış çapı|Sürücü kasnak|kasnak gerekli|hiç kasnak/i, step: 1 },
  // Kayış yolu hataları da KASNAKLAR adımına gidiyor: sıra artık orada.
  { re: /Kayış yolu kapanmıyor|bağlı olmayan kasnak|kayış çıkıyor|kayış giriyor/i, step: 1 },
  { re: /[Gg]ergi|avara|montaj konumu|yay|kol boyu|kol(un)? çalışma açısı/i, step: 2 },
  { re: /[Kk]ayış (efektif boyu|kanal|profil)|Kayış Özellikleri/i, step: 3 },
  { re: /tahrik oranı|Çözücü|devir/i, step: 4 }
];
function veFeadWizStepOf(msg){
  for(var i = 0; i < VE_FW_ERR_STEP.length; i++)
    if(VE_FW_ERR_STEP[i].re.test(String(msg))) return VE_FW_ERR_STEP[i].step;
  return VE_FW_STEPS.length - 1;
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
  // STEP'TEN GELEN SIRA BİR VARSAYIM (kural 34) — model o sırayla çözülebilir
  // ve yine de yanlış olabilir; sıra elle değişene ya da onaylanana kadar
  // Kasnaklar adımı uyarı taşır.
  // İŞLETME HESABININ GİRDİSİ — köprünün TEK kaynağı (`b.isletme`). Motor ve
  // çevrim adımına ait (motor künyesi, tahrik oranı, aksesuar modeli ve
  // çevrim hepsi orada). Model bunlarsız da KURULUR — kayış yolu çözülüyor —
  // ama gerilme, kayma, ömür ve senaryo hesaplanmaz; adım bu yüzden kırmızı.
  if(b.isletme && !b.isletme.ok && (step === undefined || step === 4)
     && typeof VE_FEAD_ISLETME_GRUP !== 'undefined'){
    VE_FEAD_ISLETME_GRUP.forEach(function(g){
      var ad = (b.isletme.eksik || []).filter(function(e){ return e.grup === g[0]; })
        .map(function(e){ return e.ad; });
      if(ad.length) out.push({ tur: 'err', m: g[1] + ': ' + ad.join(' · ') + '.' });
    });
  }
  var st = _fwState;
  if(st && st.siraKaynagi === 'agac' && (step === undefined || step === 1))
    out.push({ tur: 'warn', m: VE_FW_SIRA_AGAC });
  // STEP ↔ KÜNYE: künye gerginin parça alanlarını YAZAR (kol · çap · parça
  // kodu; kural 17). CAD'deki gergi başka bir parçaysa dosyadan gelen sayılar
  // sessizce katalogunkilerle değişirdi — fark yalnız künye seçiliyken
  // söylenir (elle yazılan değer kullanıcının kendi kararıdır).
  var sk = st && st.stepKaynak && st.stepKaynak.gergi, tn = st && st.ten;
  if(sk && tn && tn.tenLib && (step === undefined || step === 2)){
    if(sk.tenPart && tn.tenPart && sk.tenPart !== tn.tenPart)
      out.push({ tur: 'warn', m: 'Seçilen künyenin parçası ' + tn.tenPart
        + ', STEP dosyasındaki gergi ' + sk.tenPart + '.' });
    [['armLen', 'kol boyu', ' mm'], ['od', 'kasnak çapı', ' mm']].forEach(function(a){
      var v = _fwNum(tn[a[0]], NaN), ref = sk[a[0]];
      if(Number.isFinite(ref) && Number.isFinite(v) && Math.abs(v - ref) > 0.05)
        out.push({ tur: 'warn', m: 'Künyenin ' + a[1] + ' ' + _fwFmt(v, 3) + a[2]
          + ', STEP dosyasında ' + _fwFmt(ref, 3) + a[2] + '.' });
    });
  }
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
  // STEP kartı oturumluk ve AÇAN DÜĞÜME ait: başka bir FEAD sisteminin
  // sihirbazı öncekinin dosyasını göstermemeli.
  if(_fwStp && _fwStp.nodeId !== _fwNodeId) _fwStp = null;
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
  _fwSec = null; _fwZoom = 1; _fwGergiGor = 'yakin'; _fwSurukle = null;
  ov.style.display = 'flex';
  document.addEventListener('keydown', veFeadWizKey);
  veFeadWizRender();
  return true;
}

function veFeadWizClose(kaydet){
  if(typeof document === 'undefined') return;
  if(typeof veFeadWiz3bKapat === 'function') veFeadWiz3bKapat();
  // Açık kalan iç pencere bir sonraki açılışta sihirbazın üstünde belirirdi.
  VE_FW_CEVRIM_OPEN = false; veFeadWizCevrimRender();
  VE_FW_ENG_OPEN = false; veFeadWizEngRender();
  if(VE_FW_ANG){ VE_FW_ANG = null; veFeadWizAngRender(); }
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
  // TEK ESC TEK KATMAN: 3B görüntüleyici açıksa yalnız o kapanır
  if(e.key === 'Escape' && typeof veFeadWiz3bAcik === 'function' && veFeadWiz3bAcik()){ veFeadWiz3bKapat(); return; }
  // Sihirbazın kendi pencereleri de tek katman: önce üstteki kapanır.
  if(e.key === 'Escape' && VE_FW_CEVRIM_OPEN){ veFeadWizCevrimKapat(); return; }
  if(e.key === 'Escape' && VE_FW_ENG_OPEN){ veFeadWizEngClose(); return; }
  if(e.key === 'Escape' && VE_FW_ANG){ veFeadWizAngClose(); return; }
  if(e.key === 'Escape'){ veFeadWizClose(true); return; }
  // ÇİZİM MASASI: odak masadayken ok tuşu seçili kasnağı oynatır (0,1 mm).
  if(_fwMasaTus(e)) return;
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
  _fwStepScrollReset();
}
// ADIM DEĞİŞTİRMEK KONUMU SIFIRLAR — yeni adım baştan okunur.
function _fwStepScrollReset(){
  if(typeof document === 'undefined') return;
  var body = document.getElementById('ve-fw-body');
  if(body) body.scrollTop = 0;
  var yan = document.getElementById('ve-fw-yan');
  if(yan) yan.scrollTop = 0;
}
function veFeadWizGoto(i){
  if(i < 0 || i >= VE_FW_STEPS.length) return;
  _fwStep = i;
  veFeadWizRender();
  _fwStepScrollReset();
}

// ── CANLI ŞERİT — gecikmeli ────────────────────────────────────────────────
// Tuş vuruşu başına tam bir köprü çözümü koşturmak yazmayı tökezletiyor;
// 220 ms'lik gecikme akıcı kalmayı sağlıyor.
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
  // ÇİZİM MASASI da canlı: yazılan sayı çizimde görünsün. Masa ve Kasnaklar
  // listesi form alanlarının DIŞINDA — odağa dokunmaz.
  _fwMasaYenile(b);
  var kl = document.getElementById('ve-fw-kl-liste');
  if(kl && _fwState){
    var _sira = (typeof veFeadRouteFlip === 'function')
      ? veFeadRouteFlip(veFeadWizRoute(_fwState)) : veFeadWizRoute(_fwState);
    var _by = {};
    _fwState.pulleys.forEach(function(p){ _by[p.key] = p; });
    kl.innerHTML = _fwKasnakListeHTML(b, _sira, _by);
  }
  var nav = document.getElementById('ve-fw-nav');
  if(nav) nav.innerHTML = veFeadWizNavHTML(b);
  var f = document.getElementById('ve-fw-foot-state');
  if(f) f.innerHTML = veFeadWizFootStateHTML(b);
  var kur = document.getElementById('ve-fw-create');
  if(kur){
    var hazir = !!(b && b.ok) && veFeadWizCanCreate().ok;
    kur.disabled = !hazir;
  }
  // Çevrim penceresinin kW okumaları devirle değişir; hücre yerinde yazılır,
  // girdi kutusu yeniden kurulmaz (odak ve imleç korunur).
  if(VE_FW_CEVRIM_OPEN) _fwCevrimCanli(b);
}

// ════════════════════════════════════════════════════════════════════════════
//  GÖVDE — ortak parçalar
// ════════════════════════════════════════════════════════════════════════════
// KART: BAŞLIK VE GÖVDE. Üçüncü bir şey YOK.
//
// Kullanıcı isteği (2026-09-02): *"garip açıklamalar… Pencerenin sağ üst
// köşesine baksana, 'fareyle' yazıyor… Bu tarz garip açıklamaları lütfen
// 'Başlangıç Sihirbazı' kısmından TAMAMEN kaldıralım."*
//
// Kartın başlığında bir "göz kırpma" alanı (`unit`) ve gövdesinin altında bir
// açıklama paragrafı üreteci (`_fwHint`) vardı; ikisi de KALDIRILDI —
// parametre ve fonksiyon olarak, bırakılmış bir kanal olarak değil. Bırakmak
// yeterli olmazdı: her turda yeniden dolduruluyorlardı, çünkü yüzey oradaydı.
// `tests/unit/fead-wizard.test.js` bunu kapı olarak tutuyor.
//
// Alan başına açıklama gerekiyorsa `title` ipucu kullanılır (üzerine gelince
// çıkar, yüzeyi doldurmaz); modelin durumuyla ilgili bir şey söylenecekse
// `ve-fw-issue` kutusu kullanılır — o bir açıklama değil, canlı doğrulama
// çıktısıdır.
//
// ÇİZİM MASASI (2026-09-29, tasarım tuvali · F): kart sağdaki denetim
// sütununun BLOĞU — başlık + gövde, kutulu. Föyün numaralı bölümü kalktı
// (emekli-yonler.md). `accent` imzada KALIR (çağrı yerleri) ama çizilmez:
// renk kanalı durum taşımıyordu (durum rayda ve sonuç çipinde).
function _fwCard(baslik, accent, inner){
  return '<section class="ve-fw-card">'
    + '<header class="ve-fw-card-h"><span>' + _fwEsc(baslik) + '</span></header>'
    + '<div class="ve-fw-card-b">' + inner + '</div></section>';
}

// ADIM NUMARASI ADINDAN — metne elle yazılmış bir numara adım eklenince/
// kalkınca sessizce bayatlar (ölçüldü 2026-09-29: sihirbaz "7. adımdaki iki
// kapı" ve "4. adımda okunur" diyordu; adım sayısı 6, gövde noktası 3.
// adımda). Metin adımı ANAHTARIYLA anar.
function _fwAdimNo(key){
  for(var i = 0; i < VE_FW_STEPS.length; i++) if(VE_FW_STEPS[i].key === key) return i + 1;
  return 0;
}

// Alan üreteci. `oninput` YALNIZ durumu yazar ve canlı şeridi gecikmeli
// tazeler — tam yeniden çizim odağı düşürürdü.
// SAYI ALANI `type="number"` DEĞİL — kullanıcı isteği (2026-09-01):
// *"Koordinat, değer vs girerken hep nokta koyuyoruz. Virgülü tanımıyor
// program. Virgülü de tanısın."*
//
// `_fwNum` virgülü ZATEN çeviriyordu; kusur okuyucuda değil ALANDAYDI:
// `<input type="number">` tarayıcı belgesinde "floating-point number" ister ve
// ondalık ayırıcı olarak YALNIZ noktayı kabul eder — virgül yazılınca alan
// GEÇERSİZ olur ve `input.value` **boş string** döner. Yani tuş vuruşu hiç
// ulaşmıyordu; program virgülü tanımıyor değil, virgülü hiç GÖRMÜYORDU.
//
// `inputmode="decimal"` telefonda sayı tuş takımını yine açıyor; `step`
// metin alanında anlamsız olduğu için düşürülüyor. Ok tuşlarıyla artırma
// kayboluyor — kabul edilen bedel, çünkü virgül yazamamak bir sayının HİÇ
// girilememesi demekti.
function _fwInp(path, opts){
  opts = opts || {};
  var v = _fwGet(path);
  // KİLİT `readonly`, `disabled` DEĞİL: disabled bir alan gri boşluk gibi
  // okunur ve içindeki SAYI kaybolur gibi görünür; readonly sayıyı okunur
  // bırakır, yalnız yazmayı reddeder. Kullanıcının istediği tam olarak bu:
  // *"değerler değiştirilmemeli"* — gizlenmeli değil.
  return _fwKun('<input type="text"' + (opts.text ? '' : ' inputmode="decimal"')
    + ' class="ve-fw-inp' + (opts.kilit ? ' ve-fw-lock' : '') + '"'
    + ' value="' + _fwEsc(v === undefined || v === null ? '' : v) + '"'
    + ' placeholder="' + _fwEsc(opts.ph || '') + '"'
    + (opts.kilit ? ' readonly title="' + _fwEsc(opts.kilitNot || '') + '"' : '')
    + ' oninput="_fwSet(\'' + path + '\', this.value)">', opts.kilit, opts.kilitNot);
}
// KÜNYEDEN GELEN ALAN "K" İŞARETİ TAŞIR — föyün dili (2026-09-29): noktalı alt
// çizgi DÜZENLENEBİLİR, çizgisiz ve K'li alan künyenin verisi (kütüphaneden
// seçili, `readonly`/`disabled`). Sebep `title`da: sihirbazda açıklama yüzeyi
// yok (kullanıcı kararı 2026-09-02). Sarmalayıcı alanla işareti tek satırda
// tutar — alan `.ve-fw-field`in sütununda ya da tablo hücresinde durur.
function _fwKun(html, kilit, not){
  if(!kilit) return html;
  return '<span class="ve-fw-kun-kap">' + html + '<sup class="ve-fw-kun" title="'
    + _fwEsc(not || VE_FW_TEN_LOCK_NOTE) + '">K</sup></span>';
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
  return _fwKun(h + '</select>', opts.kilit, opts.kilitNot);
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
  // SONUÇ ÇİPİ (çizim masası, 2026-09-29): masanın sol üstünde, çizimin
  // üstünde yüzer. Önce DAMGA — modelin hükmü ve bu adımın eksik/uyarı sayısı,
  // rayın rozetiyle aynı kaynaktan (veFeadWizStepState); RENGİ DE RAYIN:
  // kayış yolu çözülüp adımda eksik kalabiliyor (işletme girdisi, kural 46) ve
  // o hâlde yeşil bir "çözülüyor" rayın kırmızısıyla çelişirdi. Modelin hükmü
  // ayrıca `data-model`de — "model çözülüyor mu" diye soran okur rengi değil
  // onu okur. Sonra sayılar: boy · gerginlik · kol yönü · dönüş.
  var h = '<div class="ve-fw-cip ve-fw-live">';
  if(!b){
    h += '<span class="ve-fw-damga ve-fw-pill-dim" data-model="no" data-durum="err">Çözüm yok</span>';
    return h + '</div>';
  }
  if(b.ok){
    var d = veFeadWizStepState(b, _fwStep);
    h += '<span class="ve-fw-damga ve-fw-pill-' + d.durum + '" data-model="ok" data-durum="' + d.durum + '">'
      + veIkon(d.durum === 'ok' ? 'check' : 'alert-triangle') + ' '
      + (d.err ? 'Kayış yolu çözülüyor · ' + d.err + ' eksik'
               : 'Çözülüyor' + (d.warn ? ' · ' + d.warn + ' uyarı' : '')) + '</span>';
    // KAYIŞ NUMARASI d_b ÇİZGİSİNDE, kord (d_w) yanında — CAD eskizi kordu
    // ölçer (kullanıcı kararı 2026-09-28). Dönüşüm köprüden.
    if(Number.isFinite(b.beltLengthMm)){
      var _bc = (typeof veFeadBoyCizgileri === 'function' && b.sys && b.sys.belt)
        ? veFeadBoyCizgileri(b.beltLengthMm, b.sys.belt) : null;
      h += '<span class="ve-fw-pill">L<sub>b</sub> <b>' + _fwFmt(b.beltLengthMm, 1) + ' mm</b>'
         + (b.beltLengthDerived ? ' <em>çıktı</em>' : '')
         + ((_bc && Number.isFinite(_bc.dw)) ? ' <em>· d<sub>w</sub> ' + _fwFmt(_bc.dw, 1) + '</em>' : '')
         + '</span>';
    }
    if(Number.isFinite(b.springTensionN))
      h += '<span class="ve-fw-pill">T <b>' + _fwFmt(b.springTensionN, 1) + ' N</b></span>';
    // ÇİP KULLANICININ YAZDIĞI SAYIYI GÖSTERİR. Bir dönem mutlak açı
    // basılıyordu: kullanıcı kutuya 168 yazarken pil −12,00° diyordu — aynı
    // modelin aynı alanı, iki sayı. GÖSTERİLEN açı basılır ve adını da söyler
    // ("kol yönü"), çünkü "kol" tek başına üç ayrı büyüklüğe verilmiş bir addı.
    if(Number.isFinite(b.armAbsDeg))
      h += '<span class="ve-fw-pill">kol yönü <b>'
        + _fwFmt((typeof veFeadArmShownDeg === 'function')
                 ? veFeadArmShownDeg(b.armAbsDeg) : b.armAbsDeg, 2) + '°</b></span>';
    if(b.spin)
      h += '<span class="ve-fw-pill">' + _fwSpinHTML(b.spin) + '</span>';
  } else {
    h += '<span class="ve-fw-damga ve-fw-pill-err" data-model="no" data-durum="err">'
      + veIkon('x') + ' Çözülemiyor · ' + (b.errors || []).length + ' eksik</span>';
    h += '<span class="ve-fw-pill ve-fw-pill-dim">' + _fwEsc((b.errors || [])[0] || '') + '</span>';
  }
  return h + '</div>';
}
function veFeadWizFootStateHTML(b){
  var eksik = b ? (b.errors || []).length : 0;
  if(!b) return '<span class="ve-fw-dim">model henüz kurulmadı</span>';
  // "KURULMAYA HAZIR" YALNIZ İŞLETME GİRDİSİ DE TAMSA. Kayış yolu çözülen
  // ama motoru/aksesuar gücü eksik bir model KURULABİLİR (geometri sonucu
  // gerçek) — yine de "hazır" demek, eksik künyeyle hesap yapılacağı
  // izlenimini veriyordu (kullanıcı bildirimi, 2026-09-29).
  if(b.ok && b.isletme && !b.isletme.ok && typeof VE_FEAD_ISLETME_GRUP !== 'undefined'){
    var gr = [];
    VE_FEAD_ISLETME_GRUP.forEach(function(g){
      if((b.isletme.eksik || []).some(function(e){ return e.grup === g[0]; }))
        gr.push(g[1].charAt(0).toLowerCase() + g[1].slice(1));
    });
    return '<span class="ve-fw-warn" title="' + _fwEsc(veFeadIsletmeMetni(b.isletme)) + '">'
      + veIkon('alert-triangle') + ' kayış yolu çözülüyor — işletme hesabı bekliyor: '
      + _fwEsc(gr.join(' · ')) + '</span>';
  }
  if(b.ok) return '<span class="ve-fw-ok">' + veIkon('check') + ' model çözülüyor — kurulmaya hazır</span>';
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
    return '<div class="ve-fw-issues ve-fw-issues-ok">' + veIkon('check') + ' Bu adımda eksik girdi yok.</div>';
  var h = '<div class="ve-fw-issues">';
  list.forEach(function(it){
    h += '<div class="ve-fw-issue ve-fw-issue-' + it.tur + '">'
      + _fwSorunIkon(it.tur) + ' ' + _fwEsc(it.m) + '</div>';
  });
  return h + '</div>';
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇİZİM
// ════════════════════════════════════════════════════════════════════════════
// KAYDIRMA KONUMU KORUNUR — ama YALNIZ aynı adımda.
//
// Kullanıcı bildirimi (2026-08-31): *"'Çalışma çevrimi' kısmında 'çevrim'
// seçtiğim zaman, sayfa en tepeye atıyor. Seçtiğim yerde kalmıyor yani."*
// ÖLÇÜLDÜ (gerçek tarayıcı): gövdenin `scrollTop`'u 900 → **0**.
//
// Sebep `body.scrollTop = 0`'ın KOŞULSUZ olmasıydı. O satır ADIM DEĞİŞİMİNDE
// doğru — yeni bir adım baştan okunur — ama aynı adımı yerinde yeniden
// çizerken (çevrim seçmek, aksesuar modeli seçmek, temas tarafını değiştirmek)
// kullanıcıyı bulunduğu yerden koparıyordu.
//
// KONUM SAKLANMIYOR, OKUNUYOR: gövde elemanı yeniden çizimler arasında AYNI
// kalıyor, dolayısıyla `scrollTop`'u kendisi taşıyor. Adım başına bir bellek
// tutmak ölü veri olurdu — yazılır, hiçbir yerden okunmazdı.
function veFeadWizRender(){
  if(typeof document === 'undefined' || !_fwState) return;
  var b = veFeadWizBuild();
  var nav = document.getElementById('ve-fw-nav');
  if(nav) nav.innerHTML = veFeadWizNavHTML(b);
  var body = document.getElementById('ve-fw-body');
  if(body){
    var y = body.scrollTop;
    var yan0 = document.getElementById('ve-fw-yan'), yy = yan0 ? yan0.scrollTop : 0;
    body.innerHTML = veFeadWizStepHTML(_fwStep, b);
    var yan1 = document.getElementById('ve-fw-yan');
    if(yan1) yan1.scrollTop = Math.min(yy, Math.max(0, yan1.scrollHeight - yan1.clientHeight));
    // İçerik kısaldıysa (satır silindi, kart kalktı) eski konum artık yok —
    // kırpılmazsa tarayıcı sessizce dibe yapıştırır.
    var enFazla = Math.max(0, body.scrollHeight - body.clientHeight);
    body.scrollTop = Math.min(y, enFazla);
    // Denetim sütunu da kendi kaydırmasını taşır (masa sabit, sütun kayar).
    _fwMasaGozle();
  }
  var foot = document.getElementById('ve-fw-foot');
  if(foot) foot.innerHTML = veFeadWizFootHTML(b);
  // AÇI SEÇİCİSİ HER ÇİZİMDE DURUMUNU İZLER. Ayrı bırakılsaydı "Uygula"
  // kapatma bayrağını temizler ama kaplama ekranda KALIRDI (ölçüldü, gerçek
  // tarayıcı): yazma olur, pencere durur, kullanıcı ikinci kez uygular.
  if(typeof veFeadWizAngRender === 'function') veFeadWizAngRender();
  // ÇEVRİM TABLOSU PENCERESİ de: satır ekleme/silme ve çevrim seçimi tam
  // çizimden geçer; açık pencere aynı durumu okumalı.
  if(VE_FW_CEVRIM_OPEN) veFeadWizCevrimRender();
  // 3B GÖRÜNTÜLEYİCİ DE (js/cp-fead-3b.js): rol, hesap, bakış ve aktarım hep
  // buradan geçer; pencerenin paneli ve renkleri kartla aynı durumu okur.
  if(typeof veFeadWiz3bTazele === 'function') veFeadWiz3bTazele();
}

function veFeadWizNavHTML(b){
  // Rayın başında marka bloğu YOK: pencerenin başlık bandı "FEAD Başlangıç
  // Sihirbazı" diyor ve blok onu 54 px'lik ikinci bir başlık olarak
  // tekrarlıyordu (kullanıcı: "header kısmı boyuna çok büyük").
  var h = '<ol class="ve-fw-steps">';
  VE_FW_STEPS.forEach(function(s, i){
    // İKİ AYRI KANAL, ÇAKIŞMIYOR: zemin tinti + kalın başlık HANGİ ADIMDA
    // olduğumuzu, renk (sol şerit · numara dairesi · rozet) o adımın DURUMUNU
    // söylüyor. Tek kanala bindirilseydi seçili adımın durumu görünmezdi —
    // oysa kullanıcının en çok baktığı adım tam olarak o.
    var d = veFeadWizStepState(b, i);
    var sinif = 've-fw-step ve-fw-st-' + d.durum + (i === _fwStep ? ' on' : '');
    var rozet = (d.durum === 'ok')
      ? '<span class="ve-fw-step-n" title="Bu adımda eksik girdi yok.">' + veIkon('check') + '</span>'
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
     + ' onclick="veFeadWizGo(-1)">' + veIkon('arrow-left') + ' Geri</button>';
  if(!son){
    h += '<button type="button" class="ve-fw-btn ve-fw-btn-primary" onclick="veFeadWizGo(1)">İleri →</button>';
  } else {
    h += '<button type="button" id="ve-fw-create" class="ve-fw-btn ve-fw-btn-go"'
       + ((b && b.ok && kur.ok) ? '' : ' disabled')
       + ' onclick="veFeadWizCreate()">' + veIkon('settings') + ' Modeli kur</button>';
  }
  return h;
}

// ════════════════════════════════════════════════════════════════════════════
//  ADIM GÖVDELERİ
// ════════════════════════════════════════════════════════════════════════════
function veFeadWizStepHTML(step, b){
  var s = VE_FW_STEPS[step] || VE_FW_STEPS[0];
  // ÇİZİM MASASI (2026-09-29, tasarım tuvali · F): gövdede başlık YOK — adımın
  // adı ve ipucu soldaki rayda yazılı (föyün tek satırlık başlığı ve anteti
  // kalktı). Gövde iki sütun: masa + denetim sütunu.
  var yan = '';
  if(step === 0) yan = _fwStepKaynak(b);
  else if(step === 1) yan = _fwStepKasnak(b);
  else if(step === 2) yan = _fwStepGergi(b);
  else if(step === 3) yan = _fwStepKayis(b);
  else if(step === 4) yan = _fwStepCevrim(b);
  else yan = _fwStepOzet(b);
  // Uyarı kutusu KENDİ KABINDA: canlı yama onu form alanlarına dokunmadan
  // tazeleyebilsin diye kararlı bir id gerekiyor.
  if(step !== VE_FW_STEPS.length - 1) yan += '<div id="ve-fw-issue">' + veFeadWizIssueHTML(b, step) + '</div>';
  return '<div class="ve-fw-masa-duzen" data-adim="' + s.key + '">'
    + _fwMasaHTML(step, b)
    + '<aside class="ve-fw-yan" id="ve-fw-yan" aria-label="' + _fwEsc(s.ad) + ' — girdiler">' + yan + '</aside>'
    + '</div>';
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇİZİM MASASI — her adımın konusu büyük çizimde
// ════════════════════════════════════════════════════════════════════════════
// Kullanıcı kararı (2026-09-29, tasarım tuvali "Adım içerikleri" · F): *"Bu
// tasarımı beğenmedim … Yeni tasarımımız 'F çizim masası' olacak."* Föy (E)
// geri alındı (bkz. references/emekli-yonler.md). Adımın gövdesi iki sütun:
// solda MASA — milimetrik zemin üstünde adımın konusu ölçekli çizimde, sol
// üstte sonuç çipi — sağda dar DENETİM SÜTUNU. Adımlı ray aynen kaldı.
//
// ÇİZİM TEK KAYNAKTAN: kayış yolu `veFeadLayoutSVG`; masanın eksenleri, seçim
// izdüşümü ve isabet halkaları aynı çizimin EK KATMANI (`opts.ek`) — aynı
// dönüşümle, ikinci bir ölçek hesabı yok. Gergi yakın çizimi ve çevrim
// grafikleri çekirdeğin tablolarını okur (`veFeadPositionRows`,
// `FEADCore.tensionerState`); sunum geometri HESAPLAMAZ (üç katman kuralı).
//
// MASA ÖLÇÜLÜR: çizim piksel ölçüsünde üretilir ki yazı ve çizgi kalınlığı
// ekranda kendi boyunda dursun — viewBox'ı sündürmek yazıyı büyütürdü. İlk
// çizim son bilinen ölçüyle, yerleşimden sonra gerçek ölçüyle (`_fwMasaOlc`).
//
// GÖRÜNÜM DURUMU MODELDE DEĞİL: seçili kasnak, yakınlık ve gergi görünümü
// oturumluk; sihirbazın kaydına (`node.data.wiz`) yazılmaz.
var _fwMasa = { w: 640, h: 600 };  // masanın son ölçüsü (px); jsdom'da bu kalır
var _fwSec = null;                 // Kasnaklar adımında seçili satır ('__ten__' = gergi)
var _fwZoom = 1;                   // Kasnaklar çiziminin yakınlığı (1 = sığdır)
var _fwGergiGor = 'yakin';         // Gergi adımının çizimi: 'yakin' | 'yol'
var _fwMasaXf = null;              // son kasnak çiziminin mm↔px dönüşümü
var _fwSurukle = null;             // sürükleme süreci (masada)
var _fwMasaRO = null;              // masanın ölçü gözlemcisi
var _fwMasaIzgara = null;          // zemin ızgarası eksenle hizalıysa { b, k, x, y } (px)

// ÇİZİM ÖLÇEĞİ: masa çizimi 1/k boyunda kurulur ve masaya k kat büyüyerek
// oturur. Çizicinin yazıları kullanıcı biriminde 7–9,5 — 1:1 masada 7 px'lik
// ad okunmuyordu; k = 1,35 onları 9,5–12,8 px'e taşır. Masanın kendi
// katmanlarının yazısı CSS'te `--masa-k`ya bölünür (ekranda jetonun boyu).
// Grafik adımı (çevrim) 1:1 — grafikler sunumun kendi SVG'si.
var VE_FW_MASA_K = 1.35;
var _fwMasaKat = 1;                // o anki çizimin ölçeği (grafikte 1)
function _fwPx(v){ return v / _fwMasaKat; }   // ekran px → çizim birimi
// Çip ve lejant masanın köşelerinde yüzer; çizim onların altına girmesin diye
// sığdırma bu payları bırakır (ekran px).
var VE_FW_MASA_PAY = { ust: 48, alt: 44 };
// Eksen payı (çizim birimi): sol kenarda Y yazıları, altta X yazıları.
var VE_FW_EKSEN = { sol: 34, alt: 22 };

function _fwMasaAdim(step){ return (VE_FW_STEPS[step] || VE_FW_STEPS[0]).key; }

function _fwMasaBos(metin){
  return '<div class="ve-fw-masa-bos">' + _fwEsc(metin) + '</div>';
}

// MASA — çizim + sol üst sonuç çipi + sağ üst araçlar + sol alt lejant.
// Sonuç çipinin kabı `ve-fw-live`: canlı yama onu form alanlarına dokunmadan
// tazeler (föyün SONUÇ satırının yerini aldı; içerik aynı üreticiden).
function _fwMasaHTML(step, b){
  var k = _fwMasaAdim(step);
  var ciz = _fwMasaCizim(step, b, _fwMasa.w, _fwMasa.h);
  var h = '<div class="ve-fw-masa" id="ve-fw-masa" data-adim="' + k + '"'
    + (k === 'cevrim' ? ' data-tur="grafik"' : '')
    + (k === 'kasnak' ? ' tabindex="0" onpointerdown="veFeadWizMasaBas(event)"' : '')
    + ' style="' + _fwMasaIzgaraStil() + '"'
    + ' aria-label="' + _fwEsc(VE_FW_STEPS[step].ad) + ' — çizim">';
  h += '<div class="ve-fw-masa-cizim" id="ve-fw-masa-cizim">' + ciz + '</div>';
  h += '<div class="ve-fw-masa-ust" id="ve-fw-live">' + veFeadWizLiveHTML(b) + '</div>';
  var arac = _fwMasaAracHTML(k);
  if(arac) h += '<div class="ve-fw-masa-arac">' + arac + '</div>';
  h += '<div class="ve-fw-masa-alt" id="ve-fw-masa-lejant">' + _fwMasaLejantHTML(k, b) + '</div>';
  return h + '</div>';
}

function _fwMasaCizim(step, b, W, H){
  var k = _fwMasaAdim(step);
  _fwMasaIzgara = null;
  _fwMasaKat = (k === 'cevrim') ? 1 : VE_FW_MASA_K;
  if(_fwMasaKat !== 1){ W = Math.round(W / _fwMasaKat); H = Math.round(H / _fwMasaKat); }
  try {
    if(k === 'kaynak') return _fwKaynakMasa(b, W, H);
    if(k === 'kasnak') return _fwKasnakMasa(b, W, H);
    if(k === 'gergi')  return _fwGergiMasa(b, W, H);
    if(k === 'kayis')  return _fwKayisMasa(b, W, H);
    if(k === 'cevrim') return _fwCevrimMasa(b, W, H);
    return _fwOzetMasa(b, W, H);
  } catch(e){
    // Çizim patlarsa masa BOŞ kalmaz, sebebini söyler; adımın denetimleri
    // yine çalışır.
    return _fwMasaBos('Çizim üretilemedi: ' + String(e && e.message || e));
  }
}

// Sağ üst araçlar — adımın kendi görünüm denetimleri.
function _fwMasaAracHTML(k){
  if(k === 'kasnak'){
    return '<button type="button" class="ve-fw-masa-btn" aria-label="Yakınlaş" title="Yakınlaş"'
        + ' onclick="veFeadWizZoom(1)">' + veIkon('zoom-in') + '</button>'
      + '<button type="button" class="ve-fw-masa-btn" aria-label="Uzaklaş" title="Uzaklaş"'
        + (_fwZoom > 1 ? '' : ' disabled') + ' onclick="veFeadWizZoom(-1)">' + veIkon('zoom-out') + '</button>'
      + '<button type="button" class="ve-fw-masa-btn ve-fw-masa-btn-yazi"'
        + (_fwZoom > 1 ? '' : ' disabled') + ' onclick="veFeadWizZoom(0)">Sığdır</button>';
  }
  if(k === 'gergi'){
    function dg(v, ad){
      return '<button type="button" class="ve-fw-masa-btn ve-fw-masa-btn-yazi"'
        + ' aria-pressed="' + (_fwGergiGor === v) + '" onclick="veFeadWizGergiGor(\'' + v + '\')">'
        + ad + '</button>';
    }
    return dg('yol', 'Tüm yol') + dg('yakin', 'Gergiye yakın');
  }
  return '';
}

function _fwLejSatir(isaret, metin){
  return '<span class="ve-fw-lj">' + isaret + '<span>' + metin + '</span></span>';
}
function _fwLejCizgi(tur){ return '<i class="ve-fw-lj-c" data-tur="' + tur + '"></i>'; }

// LEJANT BİR ANAHTARDIR, AÇIKLAMA DEĞİL: çizimdeki işaretlerin ne olduğunu
// söyler (sihirbazın açıklama yüzeyi yasağı sürüyor — "sürükle: taşı" gibi
// yönerge YOK; o bilgi isabet halkasının ipucunda).
function _fwMasaLejantHTML(k, b){
  var ok = !!(b && b.ok);
  if(k === 'kasnak'){
    var h = ok ? _fwLejSatir(_fwLejCizgi('duz'), 'kaburgalı')
      + _fwLejSatir(_fwLejCizgi('kesik'), 'sırttan')
      + _fwLejSatir(_fwLejCizgi('kayis'), 'kayış · dişli kenar kaburgalı yüz') : '';
    if(_fwSurukle && _fwSurukle.red)
      h += '<span class="ve-fw-lj ve-fw-lj-red">' + veIkon('alert-triangle')
        + '<span>Bu konumda kayış kapanmıyor — son geçerli konum korundu.</span></span>';
    return h;
  }
  if(k === 'gergi') return _fwGergiLejant(b);
  if(k === 'ozet' || k === 'kayis') return _fwOzetLejant(b, k);
  return '';
}

// ── ÖLÇÜ ───────────────────────────────────────────────────────────────────
function _fwMasaOlc(){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-fw-masa-cizim');
  if(!el) return;
  var w = Math.round(el.clientWidth), h = Math.round(el.clientHeight);
  if(!(w > 40 && h > 40)) return;                  // jsdom ya da gizli kap
  if(Math.abs(w - _fwMasa.w) < 2 && Math.abs(h - _fwMasa.h) < 2) return;
  _fwMasa = { w: w, h: h };
  _fwMasaYenile();
}
// YALNIZ MASA tazelenir: çizim ve lejant. Denetim sütunu (form alanları)
// yerinde kalır — odağa dokunulmaz.
function _fwMasaYenile(b){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-fw-masa-cizim');
  if(!el) return;
  if(!b) b = _fwBuild || veFeadWizBuild();
  el.innerHTML = _fwMasaCizim(_fwStep, b, _fwMasa.w, _fwMasa.h);
  var masa = document.getElementById('ve-fw-masa');
  if(masa && masa.style && typeof masa.style.setProperty === 'function'){
    masa.style.setProperty('--masa-k', String(_fwMasaKat));
    ['b', 'k', 'x', 'y'].forEach(function(a){
      if(_fwMasaIzgara) masa.style.setProperty('--izg-' + a, _fwMasaIzgara[a] + 'px');
      else masa.style.removeProperty('--izg-' + a);
    });
  }
  var lj = document.getElementById('ve-fw-masa-lejant');
  if(lj) lj.innerHTML = _fwMasaLejantHTML(_fwMasaAdim(_fwStep), b);
  var ar = document.querySelector('#ve-fw-masa .ve-fw-masa-arac');
  if(ar) ar.innerHTML = _fwMasaAracHTML(_fwMasaAdim(_fwStep));
  if(typeof veFeadAnimEnsure === 'function' && typeof setTimeout === 'function')
    setTimeout(veFeadAnimEnsure, 0);
}
function _fwMasaGozle(){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-fw-masa-cizim');
  if(!el) return;
  if(typeof ResizeObserver === 'function'){
    if(!_fwMasaRO){
      var bekleyen = false;
      _fwMasaRO = new ResizeObserver(function(){
        if(bekleyen) return;
        bekleyen = true;
        (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout)(function(){
          bekleyen = false; _fwMasaOlc();
        });
      });
    }
    _fwMasaRO.disconnect();
    _fwMasaRO.observe(el);
  }
  _fwMasaOlc();
}

// ── EKSENLER ───────────────────────────────────────────────────────────────
// Çentik adımı "güzel" bir sayı (10 · 20 · 25 · 50 · 100 …): görünen aralığı
// dört ile dokuz parçaya bölen en küçüğü.
function _fwGuzelAdim(aralik){
  var adaylar = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  for(var i = 0; i < adaylar.length; i++) if(aralik / adaylar[i] <= 8) return adaylar[i];
  return adaylar[adaylar.length - 1];
}
function _fwMod(v, m){ return ((v % m) + m) % m; }
// ZEMİN IZGARASI EKSENLE HİZALI: masanın CSS deseni (`--izg-*`) bir çentik
// adımı kadar kalın, beşte biri kadar ince hücre; başlangıcı mm sıfırı.
// Hizasız ızgara çentiklerin arasından geçen süs çizgisi olurdu.
function _fwMasaIzgaraStil(){
  var z = _fwMasaIzgara, h = '--masa-k:' + _fwMasaKat;
  if(!z) return h;
  return h + ';--izg-b:' + z.b + 'px;--izg-k:' + z.k + 'px;--izg-x:' + z.x + 'px;--izg-y:' + z.y + 'px';
}
// Sol ve alt kenarda mm eksenleri — çizimin kendi dönüşümüyle (T). Adım İKİ
// eksende AYNI: çizim eş ölçekli (1 mm = T.s px) ve ızgara kare kalmalı.
function _fwEksenSVG(T){
  var W = T.W, H = T.H, f = T.f;
  // Y ekseni çipin ALTINDAN başlar (çip sol üstte yüzüyor, altında kalan
  // çentik okunmazdı).
  var xA = VE_FW_EKSEN.sol - 8, yA = H - VE_FW_EKSEN.alt + 6, yU = _fwPx(VE_FW_MASA_PAY.ust) - 6;
  var mmX = function(px){ return T.mx + (px - T.ox) / T.s; };
  var mmY = function(py){ return T.my - (py - T.oy) / T.s; };
  var x0 = mmX(xA), x1 = mmX(W - 6), y0 = mmY(yA), y1 = mmY(yU);
  var h = '<g data-ve="eksen" class="ve-fw-eksen">'
    + '<line x1="' + f(xA) + '" y1="' + f(yU) + '" x2="' + f(xA) + '" y2="' + f(yA) + '"/>'
    + '<line x1="' + f(xA) + '" y1="' + f(yA) + '" x2="' + f(W - 6) + '" y2="' + f(yA) + '"/>';
  var ax = _fwGuzelAdim(Math.max(x1 - x0, y1 - y0)), ay = ax;
  // Izgara EKRAN px'inde (çizim masaya k kat büyüyerek oturuyor).
  var K = _fwMasaKat, ib = ax * T.s * K, ik = ib / 5 >= 6 ? ib / 5 : (ib / 2 >= 6 ? ib / 2 : ib);
  var r2 = function(v){ return Math.round(v * 100) / 100; };
  _fwMasaIzgara = { b: r2(ib), k: r2(ik), x: r2(_fwMod(T.tx(0) * K, ib)), y: r2(_fwMod(T.ty(0) * K, ib)) };
  var yazi = '';
  for(var v = Math.ceil(x0 / ax) * ax; v <= x1; v += ax){
    var px = T.tx(v);
    if(px < xA + 4) continue;
    h += '<line x1="' + f(px) + '" y1="' + f(yA) + '" x2="' + f(px) + '" y2="' + f(yA - 6) + '"/>';
    yazi += '<text x="' + f(px) + '" y="' + f(yA + 12) + '" text-anchor="middle">' + veSayi(v, 0) + '</text>';
  }
  for(var w = Math.ceil(y0 / ay) * ay; w <= y1; w += ay){
    var py = T.ty(w);
    if(py > yA - 4 || py < yU + 4) continue;
    h += '<line x1="' + f(xA) + '" y1="' + f(py) + '" x2="' + f(xA + 6) + '" y2="' + f(py) + '"/>';
    yazi += '<text x="' + f(xA - 5) + '" y="' + f(py + 3.5) + '" text-anchor="end">' + veSayi(w, 0) + '</text>';
  }
  // Birim KÖŞEDE, bir kez: iki eksenin çentik yazısı oraya düşmüyor.
  yazi += '<text x="' + f(xA - 4) + '" y="' + f(yA + 12) + '" text-anchor="end">mm</text>';
  return h + '</g><g class="ve-fw-eksen-yazi">' + yazi + '</g>';
}

// ── 1 · BAŞLANGIÇ ──────────────────────────────────────────────────────────
// Adım bir dönem "gerginin tanım biçimi"ni de soruyordu; o kip seçicisi
// kalktı (tek koordinat kaldı), dolayısıyla burada yalnız künye ve örnekten
// doldurma var. Adımın kendisi KALDI: örnekten doldurmak, alanların hangi
// belgeden okunduğunu anlatmanın en kısa yolu.
function _fwStepKaynak(b){
  var st = _fwState;
  // SİSTEM ADI YALNIZ BOŞ BAŞLANGIÇTA — kullanıcı isteği (2026-09-04):
  // *"bu 'sistem adı' kısmı sadece boş örnek seçildiğinde gelsin… Çünkü
  // örneklerde sistem adı sabit. Belli yani."*
  //
  // ALAN GİZLENİYOR, DEĞER DEĞİL: örnekten gelen ad `st.ad`'da duruyor ve
  // kurulan modele gidiyor. Kaldırmak, örneğin kendi adını sessizce silerdi.
  // Ad, hemen aşağıdaki "Seçilen Örnek" kartında zaten okunuyor.
  var ornekYuklu = !!(st.seededFrom !== undefined && st.seededFrom !== ''
                      && st.seededFrom !== null);
  var h = ornekYuklu ? '' : _fwCard('Sistem', 'var(--accent-primary)',
      _fwField('Sistem adı', _fwInp('ad', { text: true, ph: 'Yeni FEAD sistemi' }))
    );

  // SEÇİLİ KART BELİRGİN — kullanıcı isteği (2026-08-31): *"buradan bir
  // seçenek seçtiğimizde seçtiğimiz seçeneğin belirgin olmasını istiyorum."*
  //
  // Etiket "SEÇİLİ" değil **"YÜKLENDİ"**: kart bir seçim kutusu değil, bir
  // EYLEM düğmesi — formu dolduruyor ve kullanıcı sonra her alanı
  // değiştirebiliyor. "Seçili" demek, formun hâlâ o örneğe EŞİT olduğunu
  // iddia etmek olurdu; kütüphane bunu bilmiyor (duty seçicisindeki "özel"
  // okumasının aynı gerekçesi).
  var yuklu = (st.seededFrom === undefined) ? null : st.seededFrom;

  // AÇILIR LİSTE, YAN YANA KART DEĞİL — kullanıcı isteği (2026-09-02):
  // *"pencereyi uzatmasaydın keşke, böyle aşağıya indirilebilir bir pencere
  // yapsaydın."* Liste üç örnek için tasarlanmıştı; arşivin tamamı örnek
  // olunca ON İKİ tam genişlik kartı modalı aşağı doğru büyüttü ve 1. adım
  // kaydırmasız okunamaz oldu. Açılır liste sabit yükseklik demek: örnek
  // sayısı artmaya devam edebilir, pencere büyümez.
  //
  // "YÜKLENDİ" SÖZCÜĞÜ KALIYOR — kart düğmesinden devraldığımız ayrım bu:
  // seçim formu DOLDURAN bir eylemdir, forma EŞİT olduğu iddiası değil.
  // Kullanıcı sonra her alanı değiştirebiliyor ve kütüphane bunu bilmiyor;
  // <select>'in kendisi "seçili" ima ettiği için durum satırı ayrıca yazılıyor.
  var secenekler = '<option value="__">' + (yuklu === null ? '— örnek seç —' : '— değiştir —')
    + '</option>';
  var yukluAd = '', yukluAlt = '';
  if(typeof veFeadExampleKeys === 'function'){
    secenekler += '<optgroup label="Gates raporları ve tedarikçi sayfası">';
    veFeadExampleKeys().forEach(function(k){
      var ex = veFeadExampleOf(k);
      var alt = ex.pulleys.length + ' kasnak · ' + (ex.solver.duty || []).length + ' devir';
      var se = (yuklu !== null && String(yuklu) === String(k));
      if(se){ yukluAd = ex.name; yukluAlt = alt; }
      secenekler += '<option value="' + _fwEsc(k) + '"' + (se ? ' selected' : '') + '>'
        + _fwEsc(ex.name + '  ·  ' + alt) + '</option>';
    });
    secenekler += '</optgroup>';
  }
  // "BOŞ BAŞLA" DA BİR SEÇİM ve işaretleniyor — kayıtlı davranış: temizlemek
  // de bir başlangıç kararıdır, "hiçbiri seçilmemiş" hâlinden (taze sihirbaz)
  // ayrı durmalı.
  var bosSecili = (yuklu !== null && String(yuklu) === '');
  if(bosSecili) yukluAd = 'Boş başla';
  secenekler += '<option value=""' + (bosSecili ? ' selected' : '') + '>'
    + 'Boş başla — bütün alanları temizler</option>';

  // ÖRNEKLER ARASINDA ↑ ↓ — kullanıcı isteği (2026-09-04): *"örnekleri
  // seçtiğimiz yerin uygun bir altına böyle yukarı aşağı oklar koyalım…
  // tüm örnekleri ve tüm tasarımları görme şansı olur."*
  //
  // KASNAK SATIRLARININ DİLİYLE AYNI: uçlarda `disabled`, sarma YOK. Sarma
  // son örnekten ilkine atlardı ve kullanıcı listeyi bitirdiğini anlamazdı;
  // devre dışı düğme sınırı GÖSTERİYOR. Sayaç bir açıklama değil, kaçıncı
  // örnekte olduğunu söyleyen bir okuma.
  var anahtarlar = (typeof veFeadExampleKeys === 'function') ? veFeadExampleKeys() : [];
  var sira = anahtarlar.indexOf(String(yuklu));
  var gezinme = '';
  if(anahtarlar.length > 1){
    // ÖRNEK YÜKLÜ DEĞİLKEN İKİ OK DA AÇIK — kullanıcı bildirimi (2026-09-04):
    // *"'— değiştir —' ve ya '— boş başla —' kısımları geldiğinde, ok tuşları
    // çalışmıyor."*
    //
    // KUSUR BENDEYDİ ve iki parça arasındaki tutarsızlıktı:
    // `veFeadWizSeedStep` `i < 0` durumunu ZATEN karşılıyor (↓ ilkini, ↑
    // sonuncusunu açar) ama düğmeler `sira < 0` iken İKİSİ BİRDEN kapanıyordu.
    // Birim testi fonksiyonu yokluyordu, DÜĞME DURUMUNU değil — bu turda kapı
    // da eklendi.
    var yok = (sira < 0);
    var ustKapali = !yok && sira <= 0;
    var altKapali = !yok && sira >= anahtarlar.length - 1;
    gezinme = '<div class="ve-fw-seednav">'
      + '<button type="button" class="ve-fw-mini"' + (ustKapali ? ' disabled' : '')
        + ' title="' + (yok ? 'Son örnek' : 'Önceki örnek')
        + '" onclick="veFeadWizSeedStep(-1)">' + veIkon('arrow-up') + '</button>'
      + '<button type="button" class="ve-fw-mini"' + (altKapali ? ' disabled' : '')
        + ' title="' + (yok ? 'İlk örnek' : 'Sonraki örnek')
        + '" onclick="veFeadWizSeedStep(1)">' + veIkon('arrow-down') + '</button>'
      + '<span class="ve-fw-seednav-n">'
        + (sira >= 0 ? (sira + 1) + ' / ' + anahtarlar.length
                     : '— / ' + anahtarlar.length)
      + '</span></div>';
  }

  var sel = '<select class="ve-fw-inp" onchange="veFeadWizSeedPick(this.value)">'
    + secenekler + '</select>';
  // Durum satırı bir AÇIKLAMA değil, bir DURUM: sihirbazda açıklama yüzeyi
  // yok (`_fwHint` kaldırıldı, kapısı da var). Burada yalnız hangi örneğin
  // yüklendiği yazılı — <select>'in "seçili"si tek başına o ayrımı taşımıyor.
  var durum = yuklu === null ? ''
    : '<div class="ve-fw-seeded">' + veIkon('check') + ' <b>' + _fwEsc(yukluAd || 'Boş başla') + '</b> yüklendi'
      + (yukluAlt ? ' <em>' + _fwEsc(yukluAlt) + '</em>' : '') + '</div>';
  // STEP'TEN BAŞLA ÖRNEKLERDEN ÖNCE: kullanıcının kendi tasarımının yolu bu,
  // örnekler öğrenme yolu (kural 34).
  h += _fwCard('STEP\'ten başla', 'var(--accent-primary)', _fwStpKartHTML());
  h += _fwCard('Örnekten doldur', 'var(--accent-success)',
      _fwField('Örnek', sel) + gezinme + durum);

  // SEÇİLEN ÖRNEĞİN NE OLDUĞU — kullanıcı isteği (2026-09-02): *"kullanıcı
  // örnek seçtiğinde, hemen altında seçilen konfigürasyonun kullanıcıyı
  // bilgilendiren bir özeti olsun. Şemayı çizdir, gerekli bilgileri ver.
  // Kullanıcı seçtiği örneğin ne olduğunu anlasın."*
  //
  // Açılır liste tek satıra indi ve kazanç buydu; ama tek satır ne olduğunu
  // ANLATMIYOR. Özet o boşluğu dolduruyor ve pencereyi yine büyütmüyor:
  // yalnız BİR örnek için basılıyor (liste değil), yani örnek sayısı arttıkça
  // sabit kalıyor.
  //
  // ÜST BANTLA ÇAKIŞMIYOR: `veFeadWizLiveHTML` zaten L_eff · T · kol · yön
  // basıyor. Buradaki künye onların TAŞIMADIĞI şeyi taşıyor — örneğin kimliği:
  // hangi kasnaklar, hangi kayış, hangi gergi parçası, çevrim kaç nokta.
  var exSec = (yuklu !== null && yuklu !== '') ? veFeadExampleOf(yuklu) : null;
  if(exSec){
    var tenP = exSec.pulleys.filter(function(p){
      return (componentDefs[p.type] || {}).isFeadTensioner; })[0];
    var bd = exSec.belt || {};
    var kunye = [
      ['Kasnaklar', exSec.pulleys.map(function(p){ return _fwEsc(p.name); }).join(' · ')],
      ['Kayış', _fwEsc(bd.beltType || ((bd.ribs || '?') + bd.profile)) + ' · '
        + veSayi(bd.effLength) + ' mm · tolerans ' + (bd.tolerance > 0 ? '±' + veSayi(bd.tolerance) + ' mm' : 'YOK')
        + ' · aşınma ' + (bd.wearPct > 0 ? '%' + veSayi(bd.wearPct * 100, 2) : 'YOK')],
      ['Gergi', tenP ? (_fwEsc(tenP.name) + ' · kol ' + veSayi(tenP.data.armLen) + ' mm · yay '
        + veSayi(tenP.data.meanLoad) + ' Nm @ ' + veSayi(tenP.data.armMeanDeg) + '°') : '—'],
      ['Çalışma çevrimi', (exSec.solver.duty || []).length + ' devir noktası'
        + ((exSec.solver.duty || [])[0] ? ' · ' + veSayi(exSec.solver.duty[0].degC) + ' °C' : '')]
    ];
    var ih = '<div class="ve-fw-exnote">' + _fwEsc(exSec.note) + '</div>'
           + '<dl class="ve-fw-exspec">';
    kunye.forEach(function(k){
      ih += '<dt>' + _fwEsc(k[0]) + '</dt><dd>' + k[1] + '</dd>';
    });
    ih += '</dl>';

    // ŞEMA MASADA (`_fwKaynakMasa`): dönüş animasyonuyla, kullanıcı isteği
    // 2026-09-04 (*"en azından sistemin dönüş yönü belli olur"*). Künye
    // burada, şemanın taşımadığı kimlikle.
    h += _fwCard('Seçilen örnek', 'var(--accent-primary)', ih);
  }
  return h;
}

// AÇILIR LİSTENİN EYLEMİ. Üç durum var ve üçü de ayrı: başlık satırı ('__')
// bir seçim DEĞİL — seçilirse hiçbir şey yapılmamalı, yoksa listeyi açıp
// kapatmak yüklü örneği sessizce silerdi. '' gerçek bir eylem (temizle).
// ÖRNEK ADIMLAYICI — seçicinin KENDİ listesinden, ikinci bir sıra yok.
// Yalnız örnekler arasında gezer: "Boş başla" bir örnek değil, bir SİLME
// eylemi; oka basarken üstüne düşmek kullanıcının bütün formunu temizlerdi.
function veFeadWizSeedStep(yon){
  if(typeof veFeadExampleKeys !== 'function') return null;
  var k = veFeadExampleKeys();
  if(!k.length) return null;
  var st = _fwState || {};
  var i = k.indexOf(String(st.seededFrom === undefined ? '' : st.seededFrom));
  // Örnek yüklü DEĞİLSE (taze ya da "Boş başla"): ↓ ilkini, ↑ sonuncusunu açar.
  var j = (i < 0) ? (yon > 0 ? 0 : k.length - 1) : i + (yon > 0 ? 1 : -1);
  if(j < 0 || j >= k.length) return null;
  veFeadWizSeed(k[j]);
  return k[j];
}

function veFeadWizSeedPick(v){
  if(v === '__') return;
  if(v === '') return veFeadWizReset();
  return veFeadWizSeed(v);
}

function veFeadWizReset(){
  _fwState = veFeadWizDefault();
  _fwState.seededFrom = '';          // "Boş başla" da bir SEÇİMDİR
  _fwStep = 0;
  _fwSec = null; _fwZoom = 1;
  veFeadWizRender();
}

// ── 1 · BAŞLANGIÇ: STEP'TEN BAŞLA ──────────────────────────────────────────
//
// Kullanıcı isteği (2026-09-26): *"STEP dosyasını aktardığımızda, 3B
// görüntüleyici ile beraber, parçaları manuel olarak seçeceğiz, ardından bir
// buton gibi bir şeye tıkladığımızda otomatik olarak çaplar, merkez
// koordinatlar falan hesaplanacak ve gerçek zamanlı olarak … bir kanvas
// çizilecek."* Ağaç ve adlar dosyadan dosyaya değişir; program hiçbir ada
// güvenmez (FEAD kural 34).
//
// ZİNCİR: baytlar → `veStepP21Metin` (düz · gzip · zip) → `veFeadStpOku`
// (YALNIZ ağaç + yüz) → kullanıcı düğümlere rol verir → "Hesapla" →
// `veFeadStpCoz` (yalnız rollü düğümler) → sayılar + kayış düzlemi çizimi →
// `veFeadStpKayit` → `_fwSeedKayit` (örnek tohumunun AYNI yolu). Kart
// geometri HESAPLAMAZ; tanıyıcının sayılarını okur ve çizer.
//
// HESAP BİR DÜĞMEDİR: rol değişince önceki sonuç DÜŞER (bayat sayı ekranda
// kalmasın); bakış değişince düşmez (analiz değil, yalnız izdüşüm).
//
// OTURUMLUK, KAYDEDİLMEZ: `_fwStp` okumanın çıktısını tutar ama
// `node.data.wiz`e YAZILMAZ — dosya bir KAYNAK, ürünü sihirbaz durumu.
// Aktarımın izi durumda kalır (`st.stepKaynak`), sıranın kaynağı da
// (`st.siraKaynagi`).
var _fwStp = null;
// Kartın durumu — 3B görüntüleyici (js/cp-fead-3b.js) aynı nesneyi okur
function veFeadWizStp(){ return _fwStp; }

// TEK OLABİLEN ROLLER: model tek sürücü ve tek gergi taşır. İkisinden birinin
// iki düğüme verilmesi hesabı DURDURUR — ikinci gergi ötekinin üstüne, ikinci
// krank sürücüsüz bir krank olarak sessizce girerdi.
var VE_FW_STP_TEKIL = ['fead-crank', 'fead-tensioner', 'fead-belt'];

// Kayış rolünün adı KISA: bileşenin adı ("Kayış Özellikleri") bir pencere adı.
var VE_FW_STP_KAYIS_AD = 'Kayış';
function _fwStpRolAd(tip){
  return tip === 'fead-tensioner' ? _fwTenAd() : (tip === 'fead-belt' ? VE_FW_STP_KAYIS_AD : _fwDefName(tip));
}
// Rol seçeneklerinin TEK listesi: kartın seçicisi ve 3B'nin düğmeleri buradan.
function veFeadWizStpRolTipleri(){
  return VE_FW_PULLEY_TYPES.concat(['fead-tensioner', 'fead-belt']);
}
// Kayış biriminin tablo/panel okuması: kod · kanal (kaynağıyla) · genişlik
function _fwStpKayisTanim(k){
  if(!k) return 'kayış okunamadı';
  var p = [k.kod || 'kod yok'];
  if(k.kanal) p.push(k.kanal + ' kanal' + (k.kanalKaynak === 'genislik' ? ' (genişlikten)' : ''));
  if(Number.isFinite(k.genislik)) p.push(_fwFmt(k.genislik, 2) + ' mm');
  return p.join(' · ');
}
// ── HESAP ÇAPI (kullanıcı kararları 2026-09-28: kayış için TEK seçim; STEP'te
// varsayılan CAD eskizinin d_w'si) ─────────────────────────────────────────
// Aktarımdan ÖNCE seçim STEP oturumunda (`s.hesapCap`), aktarımdan SONRA
// sihirbazın kayışında (`st.belt.hesapCap`) — tek okuyucu, tek yazıcı; iki
// yüzey (kart · 3B) ikisini de buradan okur ve yazar.
function _fwStpEskiz(s){ return (s && s.coz && s.coz.kayis && s.coz.kayis.eskiz) || null; }
function _fwStpHesapCap(s){
  var st = _fwState;
  if(s && s.aktarim && st && st.stepKaynak && st.belt) return st.belt.hesapCap || 'katalog';
  if(s && s.hesapCap) return s.hesapCap;
  var es = _fwStpEskiz(s);
  return (es && es.hb !== null) ? 'cad' : 'katalog';
}
function veFeadWizStpHesapCap(v){
  var s = _fwStp;
  if(!s || ['katalog', 'cad', 'db'].indexOf(v) < 0) return false;
  var es = _fwStpEskiz(s);
  if(v === 'cad' && !(es && es.hb !== null)) return false;
  s.hesapCap = v;
  if(s.aktarim && _fwState && _fwState.stepKaynak && _fwState.belt) _fwState.belt.hesapCap = v;
  veFeadWizRender();
  return true;
}
// Köprünün okuduğu biçimde kayış (veFeadKordOfset): profil STEP'ten, marka
// sihirbazın kayışından, CAD ofsetleri eskizden.
function _fwStpKord(s){
  var st = _fwState || {}, bl = st.belt || {}, es = _fwStpEskiz(s), prof = null;
  if(s && s.coz){
    if(s.coz.kayis && s.coz.kayis.profil) prof = s.coz.kayis.profil;
    else (s.coz.kasnaklar || []).forEach(function(k){ if(!prof && k.tur === 'kanalli' && k.profil) prof = k.profil; });
  } else {
    // Hesaptan önce: kayışın adındaki kod (8PK1715 → PK)
    var kb = _fwStpKayisBirim(s);
    if(kb && kb.profil) prof = kb.profil;
  }
  var o = { profile: prof || bl.profile || 'PK', brand: bl.brand || 'GATES', hesapCap: _fwStpHesapCap(s) };
  if(es && es.hb !== null) o.hbCad = es.hb;
  if(es && es.hr !== null) o.hrCad = es.hr;
  return o;
}
// Kasnağın hesaptaki çapı: kaburgalı d_b + 2·h_b, sırttan dolanan OD + 2·h_r.
function _fwStpHesapCapi(s, k, mod){
  if(!k || typeof veFeadKordOfset !== 'function') return NaN;
  var b = _fwStpKord(s);
  if(mod) b.hesapCap = mod;
  var ko = veFeadKordOfset(b);
  return k.od + 2 * (k.tur === 'kanalli' ? ko.hb : ko.hr);
}
// Seçici — kart, 3B paneli ve kasnağın bölümü AYNI üreticiden; seçenekler
// kayış penceresinin listesinden (`veFeadHesapCapSecenekleri`, kural 24).
// `k` verilirse düğmeler o kasnağın hesap çaplarını taşır (147 mi 150 mi).
function _fwStpMarkaAdi(bl){
  return (typeof veFeadKayisMarkaAdi === 'function') ? veFeadKayisMarkaAdi(bl.brand) : bl.brand;
}
// Seçeneğin kısa adı — seçicinin, matrisin ve kesitin ORTAK etiketi
function _fwStpHesapCapEtiket(mod, marka){
  return mod === 'db' ? 'd<sub>b</sub>' : 'd<sub>w</sub> · ' + (mod === 'cad' ? 'CAD' : _fwEsc(marka));
}
function _fwStpHesapCapHTML(s, k){
  if(typeof veFeadHesapCapSecenekleri !== 'function' || typeof veFeadKordOfset !== 'function') return '';
  var bl = _fwStpKord(s), cur = _fwStpHesapCap(s);
  var marka = _fwStpMarkaAdi(bl);
  var h = '<div class="ve-fw-spinbox" role="group" aria-label="Hesap çapı" data-ve-hesapcap-grup="1">';
  veFeadHesapCapSecenekleri(bl).forEach(function(o){
    var et = _fwStpHesapCapEtiket(o[0], marka);
    if(k) et += ' <b>' + _fwFmt(_fwStpHesapCapi(s, k, o[0]), 2) + '</b>';
    h += '<button type="button" class="ve-fw-spin' + (o[0] === cur ? ' ve-fw-spin-on' : '') + '"'
      + ' data-ve-hesapcap="' + o[0] + '" aria-pressed="' + (o[0] === cur ? 'true' : 'false') + '"'
      + ' title="' + _fwEsc(o[1]) + '" onclick="veFeadWizStpHesapCap(\'' + o[0] + '\')">' + et + '</button>';
  });
  return h + '</div>';
}
// KASNAĞIN KESİTİ (kullanıcı isteği 2026-09-28: kaburgalı kasnak seçilince
// kesitin değerleri kendiliğinden). Ölçülen (STEP) · katalog (marka) ·
// türetilen (d_w, sırt) · CAD eskizi · hesaptaki çap; figür kayış penceresinin
// kesitiyle TEK üretici (`veFeadKesitSVG`), hesap çizgisi işaretli.
function _fwStpKasnakKesitHTML(s, ki){
  var k = s && s.coz && s.coz.kasnaklar[ki];
  if(!k) return '';
  var bl = _fwStpKord(s), ko = veFeadKordOfset(bl), kat = ko.katalog || {}, es = _fwStpEskiz(s);
  var bp = null;
  try { bp = FEADCore.beltProps({ profile: bl.profile, brand: bl.brand }); } catch(e){ bp = null; }
  var marka = _fwStpMarkaAdi(bl);
  var kanalli = k.tur === 'kanalli';
  var ofs = function(o){ return kanalli ? o.hb : o.hr; };
  var r = function(et, deger, not, veri){
    return '<tr' + (veri ? ' data-ve-kesit="' + veri + '"' : '') + '><td>' + et + '</td><td class="ve-fw-num">' + deger
      + '</td><td class="ve-fw-dim">' + (not || '') + '</td></tr>';
  };
  var h = '<section class="ve-fw-3b-bolum" data-ve-3b-kesit="' + ki + '"><h4>' + (kanalli ? 'Kaburgalı kasnak' : 'Düz kasnak')
    + ' <span class="ve-fw-dim">' + (kanalli ? _fwEsc((k.profil || '?') + ' · ' + k.kanal + ' kanal') : 'kayış sırtta') + '</span></h4>';
  if(kanalli && typeof veFeadKesitSVG === 'function') h += veFeadKesitSVG(bl.profile, bl.brand, { kord: ko, maxW: 300 });
  h += '<table class="ve-fw-tbl ve-fw-kesit-tbl"><tbody>';
  if(kanalli){
    h += r('Kanal adımı s', _fwFmt(k.adim, 3), bp ? 'katalog ' + _fwFmt(bp.ribPitch, 2) : '', 'adim');
    h += r('Kaburga tepesi d<sub>b</sub>', _fwFmt(k.od, 2), 'ölçülen', 'db');
    if(Number.isFinite(k.tabanCap))
      h += r('Kanal tabanı', _fwFmt(k.tabanCap, 2), 'derinlik ' + _fwFmt((k.od - k.tabanCap) / 2, 2), 'taban');
    if(bp){
      h += r('Kayış yüksekliği h', _fwFmt(bp.thickness, 1), _fwEsc(marka) + ' kataloğu', 'h');
      h += r('h<sub>b</sub> · h<sub>r</sub>', _fwFmt(kat.hb, 2) + ' · ' + _fwFmt(kat.hr, 2), _fwEsc(marka) + ' kataloğu', 'katalog');
    }
    if(Number.isFinite(kat.hb)) h += r('Kord d<sub>w</sub>', _fwFmt(k.od + 2 * kat.hb, 2), _fwEsc(marka) + ' kataloğu', 'dw-katalog');
  } else {
    h += r('Dış çap', _fwFmt(k.od, 2), 'ölçülen', 'od');
    if(Number.isFinite(kat.hr)) h += r('Kord (OD + 2·h<sub>r</sub>)', _fwFmt(k.od + 2 * kat.hr, 2), _fwEsc(marka) + ' kataloğu · h<sub>r</sub> ' + _fwFmt(kat.hr, 2), 'dw-katalog');
  }
  var esOf = es ? (kanalli ? es.hb : es.hr) : null;
  if(esOf !== null && esOf !== undefined)
    h += r(kanalli ? 'Kord d<sub>w</sub>' : 'Kord (OD + 2·h<sub>r</sub>)', _fwFmt(k.od + 2 * esOf, 2),
      'CAD · ' + (kanalli ? 'h<sub>b</sub> ' : 'h<sub>r</sub> ') + _fwFmt(esOf, 2), 'dw-cad');
  if(kanalli && bp && Number.isFinite(ko.hb))
    h += r('Kayış sırtı', _fwFmt(k.od + 2 * (ko.hb + ko.hr), 2), 'd<sub>w</sub> + 2·h<sub>r</sub>', 'sirt');
  h += '<tr class="ve-fw-kesit-hesap" data-ve-kesit="hesap"><td><b>Hesap çapı</b></td><td class="ve-fw-num"><b>'
    + _fwFmt(k.od + 2 * ofs(ko), 2) + '</b></td><td class="ve-fw-dim">'
    + _fwEsc(ko.kaynak === 'db' ? 'kayış kalınlığı yok' : ko.kaynak === 'cad' ? 'CAD eskizi' : marka + ' kataloğu') + '</td></tr>';
  h += '</tbody></table>';
  return h + _fwStpHesapCapHTML(s, k) + '</section>';
}
// KAYIŞ BİRİMİ: hesaptan SONRA tanıyıcınınki (`coz.kayis`); ÖNCE yalnız
// adı ve parça kimliklerinden kod — tanıyıcının AYNI ayrıştırıcısı
// (`veFeadStpKayisKodu`, ikinci ayrıştırıcı yok). Kayış rolü yoksa null.
function _fwStpKayisBirim(s){
  if(!s || !s.sonuc) return null;
  if(s.coz && s.coz.kayis) return s.coz.kayis;
  var d = s.roller.indexOf('fead-belt');
  if(d < 0) return null;
  var a = s.sonuc.agac[d], metin = [a.ad];
  a.parcalar.forEach(function(pi){ var q = s.sonuc.parcalar[pi]; if(q) metin.push(q.ad + ' ' + (q.id || '')); });
  var c = (typeof veFeadStpKayisKodu === 'function') ? veFeadStpKayisKodu(metin) : null;
  return { dugum: d, ad: a.ad, kod: c ? c.kod : null, profil: c ? c.profile : null,
           kanal: (c && c.ribs) || null, kanalKaynak: (c && c.ribs) ? 'kod' : null, genislik: null, eskiz: null };
}
// HESAP ÇAPI MATRİSİ (kullanıcı isteği 2026-09-29: *"Kullanıcı hangi çapı
// kullanacağını buradan kayışı seçtikten sonra seçecek"*). Sütun bir seçenek,
// satır bir kasnak: her kasnağın üç hesap çapı seçmeden önce yan yana okunur.
// Başlık düğmesi seçer; seçim kayış için TEK (`veFeadWizStpHesapCap`),
// seçenekler ortak listeden (`veFeadHesapCapSecenekleri`, kural 24).
function _fwStpHesapCapMatrisHTML(s){
  if(typeof veFeadHesapCapSecenekleri !== 'function' || typeof veFeadKordOfset !== 'function') return '';
  var bl = _fwStpKord(s), cur = _fwStpHesapCap(s), marka = _fwStpMarkaAdi(bl);
  var ops = veFeadHesapCapSecenekleri(bl);
  var on = function(o){ return o[0] === cur ? ' class="on"' : ''; };
  var h = '<table class="ve-fw-tbl ve-fw-hc-tbl" data-ve-hesapcap-matris="1"><thead><tr><th></th>';
  ops.forEach(function(o){
    h += '<th' + on(o) + '><button type="button" class="ve-fw-hc-sec" data-ve-hesapcap="' + o[0] + '" aria-pressed="'
      + (o[0] === cur ? 'true' : 'false') + '" title="' + _fwEsc(o[1]) + '" onclick="veFeadWizStpHesapCap(\'' + o[0] + '\')">'
      + _fwStpHesapCapEtiket(o[0], marka) + '</button></th>';
  });
  h += '</tr></thead><tbody><tr data-ve-hc="ofset"><td>h<sub>b</sub> · h<sub>r</sub></td>';
  ops.forEach(function(o){
    var ko = veFeadKordOfset(Object.assign({}, bl, { hesapCap: o[0] }));
    h += '<td' + on(o) + '>' + _fwFmt(ko.hb, 2) + ' · ' + _fwFmt(ko.hr, 2) + '</td>';
  });
  h += '</tr>';
  var coz = s && s.coz;
  if(coz && coz.ok){
    coz.kasnaklar.forEach(function(k, i){
      h += '<tr data-ve-hc-kasnak="' + i + '"><td>' + _fwEsc(_fwStpRolAd(k.tip))
        + (k.tur === 'kanalli' ? '' : ' <span class="ve-fw-dim">sırt</span>') + '</td>';
      ops.forEach(function(o){ h += '<td' + on(o) + '>' + _fwFmt(_fwStpHesapCapi(s, k, o[0]), 2) + '</td>'; });
      h += '</tr>';
    });
  } else {
    h += '<tr data-ve-hc="bekliyor"><td colspan="' + (ops.length + 1) + '" class="ve-fw-dim">Kasnak çapları hesaptan sonra</td></tr>';
  }
  return h + '</tbody></table>';
}
// KAYIŞIN BÖLÜMÜ (kullanıcı isteği 2026-09-29: ContiTech'in kayış kesiti
// şekli ve tablosu 3B'nin sağında, kayış seçilince). Üç parça: Şekil 1
// (çizilen kayış markanın tablosundan, CAD seçiliyse eskizin h_b · h_r'si;
// hesabın çizgisi işaretli) · hesap çapı matrisi (seçici) · markanın
// karakteristik ölçüleri (kayışın profili vurgulu).
function _fwStpKayisKesitHTML(s){
  var kb = _fwStpKayisBirim(s);
  if(!kb || typeof veFeadKordOfset !== 'function') return '';
  var bl = _fwStpKord(s), ko = veFeadKordOfset(bl), marka = _fwStpMarkaAdi(bl);
  var g = (typeof veFeadBeltGeom === 'function') ? veFeadBeltGeom(bl.profile, bl.brand) : null;
  var sekil = '';
  if(g && g.kalinlik && typeof veFeadKayisSekilSVG === 'function'){
    var c = { e: g.ribAdim, t: g.kalinlik, hb: g.hb, hr: g.hr };
    if(ko.kaynak === 'cad' && ko.hb > 0 && ko.hr > 0 && ko.hb + ko.hr < g.kalinlik){ c.hb = ko.hb; c.hr = ko.hr; }
    sekil = veFeadKayisSekilSVG(c, { hesap: ko.kaynak === 'db' ? 'db' : 'dw' });
  }
  return '<section class="ve-fw-3b-bolum" data-ve-3b-kayis-kesit="' + kb.dugum + '"><h4>Kayış kesiti <span class="ve-fw-dim">'
      + _fwEsc(bl.profile + ' · ' + (ko.kaynak === 'cad' ? 'CAD eskizi' : marka)) + '</span></h4>' + sekil
      + '<p class="ve-fw-dim" data-ve-3b-kayis-tanim="1">' + _fwEsc(_fwStpKayisTanim(kb)) + '</p></section>'
    + '<section class="ve-fw-3b-bolum" data-ve-3b-hesapcap-bolum="1"><h4>Hesap çapı</h4>'
      + _fwStpHesapCapMatrisHTML(s) + '</section>'
    + '<section class="ve-fw-3b-bolum" data-ve-3b-kayis-olcu="1"><h4>Karakteristik ölçüler <span class="ve-fw-dim">'
      + _fwEsc(marka) + '</span></h4>'
      + (typeof veFeadKayisOlcuHTML === 'function' ? veFeadKayisOlcuHTML(bl.brand, bl.profile) : '') + '</section>';
}
// Satır olarak basılan düğümler. Kök, altında düğüm varsa basılmaz: bütün
// montaj bir kasnak olamaz.
function _fwStpSatirlar(s){
  return s.sonuc.agac.filter(function(d){ return !(d.ebeveyn < 0 && d.cocuklar.length); });
}
// Orijin KULLANICININ seçtiği krank: kasnak listesinde krank rolündeki ilk kasnak.
function _fwStpSecim(s){
  var m = -1;
  if(s.coz) s.coz.kasnaklar.forEach(function(k, i){ if(m < 0 && k.tip === 'fead-crank') m = i; });
  return { ayna: !!s.ayna, merkez: m >= 0 ? m : undefined, hesapCap: _fwStpHesapCap(s) };
}
function _fwStpImza(s){ return JSON.stringify({ r: s.roller, a: !!s.ayna }); }

// Dosya → metin → okuma. Okuma asenkron (File API); ayrıştırma bir kare
// SONRA — 8 MB'lık dosyada ~0,5 sn ana iş parçacığını tutuyor ve "okunuyor"
// durumu çizilmeden donmuş bir düğme görünürdü.
function veFeadWizStpDosya(dosya){
  if(!dosya) return null;
  var ad = dosya.name || 'STEP';
  _fwStp = { dosya: ad, durum: 'okunuyor', nodeId: _fwNodeId };
  veFeadWizRender();
  var oku = (typeof dosya.arrayBuffer === 'function') ? dosya.arrayBuffer()
    : new Promise(function(ok, red){
        var fr = new FileReader();
        fr.onload = function(){ ok(fr.result); };
        fr.onerror = function(){ red(fr.error || new Error('okunamadı')); };
        fr.readAsArrayBuffer(dosya);
      });
  return oku.then(function(buf){
    return new Promise(function(ok){
      setTimeout(function(){ ok(veFeadWizStpBayt(buf, ad)); }, 20);
    });
  }, function(e){
    _fwStp = { dosya: ad, durum: 'hata', hata: 'Dosya okunamadı: ' + ((e && e.message) || e),
               nodeId: _fwNodeId };
    veFeadWizRender();
    return _fwStp;
  });
}
function veFeadWizStpBayt(bayt, ad){
  var m;
  try {
    if(typeof veStepP21Metin !== 'function') throw new Error('STEP okuyucusu (js/step-p21.js) yüklenmemiş.');
    m = veStepP21Metin(bayt);
  } catch(e){
    _fwStp = { dosya: ad, durum: 'hata', hata: (e && e.message) || String(e), nodeId: _fwNodeId };
    veFeadWizRender();
    return _fwStp;
  }
  return veFeadWizStpOku(m.metin, ad, m.kap);
}
// DOM'suz çekirdek: metin → kart durumu. Roller BOŞ açılır — TEK istisna
// GERGİ (kullanıcı sorusu 2026-09-28: "modeli attığımız zaman otomatik gergi
// otomatik olarak bulunabilir mi?"): rol vermeden bulunan TEK aday, ad · kod ·
// katalogdan biri de doğruluyorsa rolünü ÖNCEDEN alır ve bu yazılır
// (`s.otomatik`); doğrulanmayan aday yalnız önerilir. Kullanıcı kaldırır ya da
// başka parçaya verir — seçimi kazanır.
function veFeadWizStpOku(metin, ad, kap){
  var sonuc = (typeof veFeadStpOku === 'function') ? veFeadStpOku(metin)
    : { ok: false, hatalar: ['FEAD tanıyıcısı (js/fead-step.js) yüklenmemiş.'], agac: [], parcalar: [] };
  var s = { dosya: ad || 'STEP', kap: kap || 'duz', durum: sonuc.ok ? 'hazir' : 'hata',
            sonuc: sonuc, ayna: false, nodeId: _fwNodeId, coz: null,
            roller: (sonuc.agac || []).map(function(){ return null; }), oneri: null, otomatik: null };
  if(!sonuc.ok) s.hata = (sonuc.hatalar || []).join(' ') || 'Dosya okunamadı.';
  else if(typeof veFeadStpOner === 'function'){
    s.oneri = veFeadStpOner(sonuc);
    var g = s.oneri.gergi;
    if(g && g.uyusan.length){
      s.roller[g.dugum] = 'fead-tensioner';
      s.otomatik = { dugum: g.dugum, tip: 'fead-tensioner', sebep: _fwOneriSebep(g) };
    }
  }
  _fwStp = s;
  veFeadWizRender();
  // Akışın ikinci adımı 3B'de seçmek (kullanıcı kararı, 2026-09-26): dosya
  // okununca görüntüleyici açılır. THREE yoksa açılmaz, kartın tablosu kalır.
  if(s.durum === 'hazir' && typeof veFeadWiz3bAc === 'function') veFeadWiz3bAc();
  return s;
}
function veFeadWizStpDrop(e){
  if(!e) return false;
  if(e.preventDefault) e.preventDefault();
  var el = e.currentTarget;
  if(el && el.classList){ el.setAttribute('data-surukle', '0'); el.classList.remove('ve-fw-stp-on'); }
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if(!f) return false;
  veFeadWizStpDosya(f);
  return true;
}
// Bırakma alanının işareti: dragenter/dragleave ALT elemanlarda da tetikleniyor,
// sayaç olmadan işaret her satırın üstünde yanıp söner.
function veFeadWizStpSurukle(el, giris){
  if(!el || !el.classList) return;
  var n = (parseInt(el.getAttribute('data-surukle') || '0', 10) || 0) + (giris ? 1 : -1);
  if(n < 0) n = 0;
  el.setAttribute('data-surukle', String(n));
  el.classList.toggle('ve-fw-stp-on', n > 0);
}
// ROL DÜĞÜME VERİLİR ve bir parça TEK birime aittir: düğümün atalarının ve
// torunlarının rolü düşer (gergi alt montajına rol verilince kolun ayrı rolü
// kalmaz). Önceki hesap DÜŞER.
function veFeadWizStpRol(i, tip){
  var s = _fwStp;
  if(!s || s.durum !== 'hazir' || !(i >= 0 && i < s.roller.length)) return false;
  var a = s.sonuc.agac;
  // OTOMATİK GERGİ SÖNER: kullanıcı o düğüme dokunduysa ya da gergiyi başka
  // bir parçaya verdiyse seçimi kazanır (ikinci gergi rolü hesabı durdururdu).
  if(s.otomatik && (s.otomatik.dugum === i || tip === s.otomatik.tip)){
    if(s.otomatik.dugum !== i) s.roller[s.otomatik.dugum] = null;
    s.otomatik = null;
  }
  if(tip){
    for(var e = a[i].ebeveyn; e >= 0; e = a[e].ebeveyn) s.roller[e] = null;
    (function sil(d){ a[d].cocuklar.forEach(function(c){ s.roller[c] = null; sil(c); }); })(i);
  }
  s.roller[i] = tip || null;
  s.coz = null;
  veFeadWizRender();
  return true;
}
// Doğrulanmamış öneriyi kullanıcı tek tıkla kabul eder (otomatik sayılmaz).
function veFeadWizStpOneriUygula(){
  var s = _fwStp, g = s && s.oneri && s.oneri.gergi;
  if(!g) return false;
  return veFeadWizStpRol(g.dugum, 'fead-tensioner');
}
// Önerinin gerekçesi — kart ve 3B aynı metni yazar.
function _fwOneriSebep(g){
  var ne = { ad: 'ad', kod: 'kod ' + (g.kod || ''), katalog: 'katalog' };
  return 'kol ' + _fwFmt(g.kol, 1) + ' mm · Ø' + _fwFmt(g.od, 0) + (g.tur === 'duz' ? ' düz' : ' kanallı')
    + (g.uyusan && g.uyusan.length ? ' · uyuşan: ' + g.uyusan.map(function(k){ return ne[k]; }).join(' + ') : '');
}
// Kartın ve 3B'nin öneri satırı: otomatik atama ya da doğrulanmamış aday.
function _fwStpOneriHTML(s){
  var g = s && s.oneri && s.oneri.gergi, ag = s && s.sonuc && s.sonuc.agac;
  if(!g || !ag) return '';
  if(s.otomatik)
    return '<div class="ve-fw-seeded ve-fw-oto" data-ve-otomatik="1">' + veIkon('check') + ' <b>Gergi otomatik bulundu</b> — '
      + _fwEsc(ag[s.otomatik.dugum].ad) + ' <em>· ' + _fwEsc(s.otomatik.sebep) + '</em></div>';
  if(s.roller.indexOf('fead-tensioner') >= 0) return '';
  return '<div class="ve-fw-seeded ve-fw-oto" data-ve-oneri="1">' + veIkon('lightbulb') + ' <b>Gergi olabilir</b> — '
    + _fwEsc(ag[g.dugum].ad) + ' <em>· ' + _fwEsc(_fwOneriSebep(g)) + '</em> '
    + '<button type="button" class="ve-fw-mini" onclick="veFeadWizStpOneriUygula()">Gergi yap</button></div>';
}

function veFeadWizStpAyna(ayna){
  if(!_fwStp || _fwStp.durum !== 'hazir') return false;
  _fwStp.ayna = !!ayna;
  veFeadWizRender();
  return true;
}
function veFeadWizStpKapat(){
  _fwStp = null;
  veFeadWizRender();
}
// Hesaptan ÖNCEKİ kapı: rol yok ya da tekil rol iki düğümde.
function _fwStpRolDenetim(s){
  var out = [];
  VE_FW_STP_TEKIL.forEach(function(tip){
    var kim = [];
    s.roller.forEach(function(r, i){ if(r === tip) kim.push(s.sonuc.agac[i].ad); });
    if(kim.length > 1)
      out.push(_fwStpRolAd(tip) + ' rolü ' + kim.length + ' parçada: ' + kim.join(' · ')
        + '. Model tek ' + _fwStpRolAd(tip).toLocaleLowerCase('tr') + ' taşır.');
  });
  if(!s.roller.some(function(r){ return !!r; })) out.push('Hiçbir parçaya rol verilmedi.');
  return out;
}
// HESAPLA: yalnız rollü düğümler (veFeadStpCoz). Rol kapısı geçilmezse hesap
// yok — iki gergi rolüyle bir sonuç üretmek, birini sessizce düşürmek olurdu.
function veFeadWizStpHesapla(){
  var s = _fwStp;
  if(!s || s.durum !== 'hazir') return null;
  var d = _fwStpRolDenetim(s);
  if(d.length){
    if(typeof showToast === 'function') showToast(d[0], 'warning');
    return null;
  }
  s.coz = veFeadStpCoz(s.sonuc, s.roller);
  veFeadWizRender();
  return s.coz;
}

// Aktarım kapısı — sebebiyle. `engel` aktarımı durdurur, `uyari` durdurmaz;
// uyarıların çoğu tanıyıcının ve kayıt üreticisinin KENDİ listesi (ikinci bir
// denetim listesi, onlar değişince sessizce eskirdi).
function veFeadWizStpDenetim(s){
  s = s || _fwStp;
  var out = { engel: [], uyari: [], hesapsiz: false };
  if(!s || s.durum !== 'hazir'){ out.engel.push('Okunmuş bir STEP dosyası yok.'); return out; }
  out.engel = _fwStpRolDenetim(s);
  (s.sonuc.uyarilar || []).forEach(function(m){ out.uyari.push(m); });
  if(out.engel.length) return out;
  if(!s.coz){ out.hesapsiz = true; out.engel.push('Çap ve merkezler henüz hesaplanmadı.'); return out; }
  (s.coz.hatalar || []).forEach(function(m){ out.engel.push(m); });
  (s.coz.uyarilar || []).forEach(function(m){ out.uyari.push(m); });
  if(s.coz.ok && typeof veFeadStpKayit === 'function')
    veFeadStpKayit(s.coz, _fwStpSecim(s)).uyarilar.forEach(function(m){ out.uyari.push(m); });
  return out;
}

// AKTAR: kayıt → sihirbaz durumu, örnek tohumunun yolundan. Aktarım bir
// BAŞLANGIÇ eylemidir (örnek seçmek gibi): durumu baştan kurar.
function veFeadWizStpAktar(){
  var s = _fwStp;
  var d = veFeadWizStpDenetim(s);
  if(d.engel.length){
    if(typeof showToast === 'function') showToast(d.engel[0], 'warning');
    return null;
  }
  var kayit = veFeadStpKayit(s.coz, _fwStpSecim(s));
  var st = _fwSeedKayit(kayit);
  st.ad = kayit.name;
  // SIRA BİR VARSAYIMDIR (kural 34): dosya kayışın hangi kasnaktan hangisine
  // geçtiğini taşımıyor. Kullanıcı sırayı elle değiştirene ya da onaylayana
  // kadar Kasnaklar adımı uyarı taşır (veFeadWizIssues).
  st.siraKaynagi = 'agac';
  var ten = kayit.pulleys.filter(function(p){ return p.type === 'fead-tensioner'; })[0];
  st.stepKaynak = { dosya: s.dosya, kasnak: kayit.pulleys.length, ayna: !!s.ayna,
    gergi: ten ? { od: ten.data.od, armLen: ten.data.armLen, tenPart: ten.data.tenPart || '' } : null };
  // KAYIŞ YALNIZ ROLÜ VERİLDİYSE: profil, kanal ve kod boş durumun kayışına
  // yazılır (marka dosyada yok, varsayılan kalır); CAD'deki numara yalnız iz —
  // gergi varken boy bir çıktı, karşılaştırması Kayış adımında.
  if(kayit.belt){
    st.belt = Object.assign(veFeadWizDefault().belt, kayit.belt);
    st.stepKaynak.kayis = kayit.kayisCad;
  }
  _fwState = st;
  _fwStep = 0;
  s.aktarim = _fwStpImza(s);
  veFeadWizRender();
  return kayit;
}

// Kayış sırasının STEP ağacından geldiğini kullanıcı doğruladı.
function veFeadWizSiraOnay(){
  if(!_fwState || !_fwState.siraKaynagi) return false;
  delete _fwState.siraKaynagi;
  veFeadWizRender();
  return true;
}
var VE_FW_SIRA_AGAC = 'Kayış sırası STEP ağacından geldi — dosya kayışın kasnak sırasını '
  + 'taşımıyor. ↑ ↓ ile düzeltin; doğruysa "Sıra doğru" ile onaylayın.';

// ── KAYIŞ DÜZLEMİ ÇİZİMİ ───────────────────────────────────────────────────
// Hesaptan hemen sonra: kasnaklar dış çaplarıyla, merkezleri tanıyıcının
// izdüşümünden (`veFeadStp2B`) — sunum koordinat hesaplamaz, çizer. Kayış
// yolu ÇİZİLMEZ: sıra dosyada yok ve yol çekirdeğin işi (sihirbaz onu
// çözülmüş modelden çizer). Renk CSS'ten (tema jetonları), yazı sayfanın
// ailesinden; SVG koordinatında y aşağı olduğu için y ters çevrilir ve yazı
// aynalanmasın diye dönüşüm KULLANILMAZ.
function _fwStpCizimSVG(s){
  if(!s || !s.coz || !s.coz.ok || typeof veFeadStp2B !== 'function') return '';
  var iki = veFeadStp2B(s.coz, _fwStpSecim(s));
  var K = s.coz.kasnaklar.map(function(k, i){
    return { k: k, x: iki.kasnaklar[i].x, y: -iki.kasnaklar[i].y, r: k.od / 2 };
  });
  var G = iki.gergiler.map(function(g){ return { m: [g.merkez.x, -g.merkez.y], p: [g.pivot.x, -g.pivot.y] }; });
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  K.forEach(function(q){ x0 = Math.min(x0, q.x - q.r); x1 = Math.max(x1, q.x + q.r); y0 = Math.min(y0, q.y - q.r); y1 = Math.max(y1, q.y + q.r); });
  G.forEach(function(g){ x0 = Math.min(x0, g.p[0]); x1 = Math.max(x1, g.p[0]); y0 = Math.min(y0, g.p[1]); y1 = Math.max(y1, g.p[1]); });
  var boy = Math.max(x1 - x0, y1 - y0, 1), pay = boy * 0.08, fs = boy * 0.034;
  var f = function(v){ return (Math.round(v * 100) / 100).toString(); };
  var h = '<svg class="ve-fw-stp-svg" viewBox="' + [x0 - pay, y0 - pay - fs * 1.6, x1 - x0 + 2 * pay, y1 - y0 + 2 * pay + fs * 1.6].map(f).join(' ')
    + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Kayış düzlemi — kasnak merkezleri ve çapları">';
  // Orijin: krankın merkezi (x = 0, y = 0)
  var a = fs * 0.9;
  h += '<path class="ve-fw-stp-eksen" d="M' + f(-a) + ' 0H' + f(a) + 'M0 ' + f(-a) + 'V' + f(a) + '"/>';
  G.forEach(function(g){
    h += '<line class="ve-fw-stp-kol" x1="' + f(g.p[0]) + '" y1="' + f(g.p[1]) + '" x2="' + f(g.m[0]) + '" y2="' + f(g.m[1]) + '"/>'
      + '<circle class="ve-fw-stp-pivot" cx="' + f(g.p[0]) + '" cy="' + f(g.p[1]) + '" r="' + f(fs * 0.35) + '"/>';
  });
  K.forEach(function(q){
    var sinif = q.k.tip === 'fead-tensioner' ? 'k-gergi' : (q.k.tur === 'kanalli' ? 'k-kanalli' : 'k-duz');
    h += '<g class="ve-fw-stp-kasnak ' + sinif + '" data-ve-stp-kasnak="' + q.k.i + '">'
      + '<circle cx="' + f(q.x) + '" cy="' + f(q.y) + '" r="' + f(q.r) + '"/>'
      + '<circle class="m" cx="' + f(q.x) + '" cy="' + f(q.y) + '" r="' + f(fs * 0.22) + '"/>'
      + '<text x="' + f(q.x) + '" y="' + f(q.y - q.r - fs * 0.5) + '" font-size="' + f(fs) + '" text-anchor="middle">'
      + _fwEsc(_fwStpRolAd(q.k.tip)) + '</text>'
      + '<text class="d" x="' + f(q.x) + '" y="' + f(q.y + fs * 1.4) + '" font-size="' + f(fs) + '" text-anchor="middle">Ø'
      + _fwFmt(q.k.od, 1) + '</text></g>';
  });
  return h + '</svg>';
}

function _fwStpKartHTML(){
  var s = _fwStp, st = _fwState || {};
  var h = '<div class="ve-fw-stp" data-ve-dropzone="step"'
    + ' ondragenter="veFeadWizStpSurukle(this, true)" ondragleave="veFeadWizStpSurukle(this, false)"'
    + ' ondragover="event.preventDefault()" ondrop="veFeadWizStpDrop(event)">';
  // KARTIN DÜĞMELERİ BİRİNCİL DEĞİL: adımın tek birincil eylemi alttaki
  // "İleri →". İki dolu düğme yarışıyordu ve "İleri"yi sınıfıyla arayan
  // gerçek tarayıcı testi iki elemana çarpıp düştü (fead-sihirbaz-tablo.spec).
  h += '<div class="ve-fw-rowbtns">'
    + '<label class="ve-fw-btn ve-fw-stp-sec"'
    + ' title="STEP dosyasını seçin ya da bu alana bırakın — .stp · .step · .stpZ (AP214 / AP242, katı geometri)">'
    + '<input type="file" class="ve-fw-stp-file" accept=".stp,.step,.stpz,.p21"'
    + ' onchange="veFeadWizStpDosya(this.files && this.files[0]); this.value=\'\';">'
    + (s ? 'Başka dosya seç…' : 'STEP dosyası seç…') + '</label>';
  if(s && s.durum === 'hazir' && typeof veFeadWiz3bAc === 'function')
    h += '<button type="button" class="ve-fw-btn" id="ve-fw-stp-3b" onclick="veFeadWiz3bAc()"'
      + ' title="Montajı 3B görüntüleyicide açın; parçaya tıklayıp rolünü verin">3B\'de seç</button>';
  if(s && s.durum !== 'okunuyor')
    h += '<button type="button" class="ve-fw-mini" title="Dosyayı karttan kaldır" onclick="veFeadWizStpKapat()">' + veIkon('x') + '</button>';
  h += '</div>';

  if(!s){
    // Önceki aktarımın izi (kart oturumluk; durum kalıcı).
    if(st.stepKaynak)
      h += '<div class="ve-fw-seeded">' + veIkon('check') + ' <b>' + _fwEsc(st.stepKaynak.dosya) + '</b> aktarılmıştı'
        + ' <em>' + st.stepKaynak.kasnak + ' kasnak</em></div>';
    return h + '</div>';
  }
  if(s.durum === 'okunuyor')
    return h + '<div class="ve-fw-seeded ve-fw-stp-wait">' + veIkon('clock') + ' <b>' + _fwEsc(s.dosya) + '</b> okunuyor…</div></div>';
  if(s.durum === 'hata')
    return h + '<div class="ve-fw-issues"><div class="ve-fw-issue ve-fw-issue-err">' + _fwSorunIkon('err') + ' <b>'
      + _fwEsc(s.dosya) + '</b> — ' + _fwEsc(s.hata) + '</div></div></div>';

  var so = s.sonuc, sm = so.sureMs || {};
  var sure = ((sm.oku || 0) + (sm.montaj || 0) + (sm.yuz || 0)) / 1000;
  var bas = so.baslik || {};
  h += '<div class="ve-fw-seeded">' + veIkon('check') + ' <b>' + _fwEsc(s.dosya) + '</b> okundu <em>'
    + _fwEsc([bas.sistem || bas.onisleyici || '',
              s.kap !== 'duz' ? 'sıkıştırılmış (' + s.kap + ')' : '',
              so.parcalar.length + ' parça', veSayi(sure, 2) + ' sn'].filter(Boolean).join(' · '))
    + '</em></div>';

  h += _fwStpOneriHTML(s);

  // ── PARÇA AĞACI ─────────────────────────────────────────────────────────
  var coz = s.coz, iki = (coz && coz.ok && typeof veFeadStp2B === 'function') ? veFeadStp2B(coz, _fwStpSecim(s)) : null;
  var birimKasnak = {}, kol = {};
  if(coz){
    coz.birimler.forEach(function(b){ birimKasnak[b.dugum] = (b.kasnak === undefined) ? -1 : b.kasnak; });
    coz.gergiler.forEach(function(g){ kol[g.kasnak] = g.kolBoy; });
  }
  var sec = [['', '—']]
    .concat(veFeadWizStpRolTipleri().map(function(t){ return [t, _fwStpRolAd(t)]; }));
  var satirlar = _fwStpSatirlar(s), taban = satirlar.length ? satirlar[0].derinlik : 0;
  var t = '<div class="ve-fw-tblwrap"><table class="ve-fw-tbl ve-fw-tbl-fixed ve-fw-tbl-stp"><thead><tr>'
    // Birim başlığın ALT satırında (`th em`): sütun 316–380 px'lik denetim
    // sütununda 39 px ve "X [mm]" oraya sığmıyordu (ölçüldü: tablo 6 px taşıyor).
    + '<th>Parça</th><th>Rol</th><th>Kasnak</th><th>X<em>mm</em></th><th>Y<em>mm</em></th></tr></thead><tbody>';
  satirlar.forEach(function(d){
    var rol = s.roller[d.i] || '';
    // Rollü bir atanın içindeki düğüm: o birimin parçası
    var ata = -1;
    for(var e = d.ebeveyn; e >= 0; e = so.agac[e].ebeveyn) if(s.roller[e]){ ata = e; break; }
    var tanim = '—', xs = '—', ys = '—', sinif = '';
    if(ata >= 0){ tanim = veIkon('corner-down-right') + ' ' + _fwStpRolAd(s.roller[ata]) + ' birimi'; sinif = ' ve-fw-stp-off'; }
    else if(rol === 'fead-belt' && coz){
      tanim = _fwStpKayisTanim(coz.kayis);
      if(!coz.kayis || !coz.kayis.kod) sinif = ' ve-fw-stp-warn';
    }
    else if(rol && coz){
      var ki = birimKasnak[d.i];
      if(ki >= 0){
        var k = coz.kasnaklar[ki];
        tanim = 'Ø' + _fwFmt(k.od, 1) + ' · ' + (k.tur === 'kanalli' ? k.kanal + ' × ' + (k.profil || '?') : 'düz')
          + (kol[ki] !== undefined ? ' · kol ' + _fwFmt(kol[ki], 1) : '')
          // hesabın kurulduğu çap (hesap çapı seçimine göre) — 147 mi 150 mi
          + ' · hesap Ø' + _fwFmt(_fwStpHesapCapi(s, k), 1);
        if(iki){ xs = _fwFmt(iki.kasnaklar[ki].x, 1); ys = _fwFmt(iki.kasnaklar[ki].y, 1); }
      } else { tanim = 'kasnak bulunamadı'; sinif = ' ve-fw-stp-warn'; }
    }
    else if(!rol) sinif = ' ve-fw-stp-off';
    t += '<tr class="ve-fw-stp-r' + sinif + '" data-ve-stp="' + d.i + '">'
      + '<td title="' + _fwEsc(d.ornek || d.id || '') + '" style="--stp-d:' + Math.max(0, d.derinlik - taban) + ';">'
      + _fwEsc(d.ad) + '</td>'
      + '<td><select class="ve-fw-inp" onchange="veFeadWizStpRol(' + d.i + ', this.value)">'
      + sec.map(function(o){
          return '<option value="' + o[0] + '"' + (o[0] === rol ? ' selected' : '') + '>'
            + _fwEsc(o[1]) + '</option>'; }).join('')
      + '</select>' + (s.otomatik && s.otomatik.dugum === d.i
          ? ' <span class="ve-fw-oto-rozet" title="' + _fwEsc(s.otomatik.sebep) + '">otomatik</span>' : '')
      + '</td>'
      + '<td>' + _fwEsc(tanim) + '</td>'
      + '<td class="ve-fw-num">' + xs + '</td><td class="ve-fw-num">' + ys + '</td></tr>';
  });
  h += t + '</tbody></table></div>';

  // ── HESAPLA ─────────────────────────────────────────────────────────────
  var d = veFeadWizStpDenetim(s);
  var rolEngel = _fwStpRolDenetim(s);
  h += '<div class="ve-fw-rowbtns">'
    + '<button type="button" id="ve-fw-stp-hesapla" class="ve-fw-btn"'
    + (rolEngel.length ? ' disabled' : '') + ' onclick="veFeadWizStpHesapla()">'
    + (coz ? 'Yeniden hesapla' : 'Çap ve merkezleri hesapla') + '</button>'
    + '<span class="ve-fw-dim">' + (coz
        ? (coz.ok ? veIkon('check') + ' ' + coz.kasnaklar.length + ' kasnak' + (coz.duzlem ? ' · düzlem sapması '
            + _fwFmt(coz.duzlem.yayilim, 3) + ' mm' : '')
            + (coz.kayis && coz.kayis.kod ? ' · kayış ' + _fwEsc(coz.kayis.kod) : '') : _fwSorunIkon('err') + ' kasnak bulunamadı')
        : 'hesaplanmadı') + '</span></div>';

  if(coz && coz.ok){
    // ── BAKIŞ + ÇİZİM ─────────────────────────────────────────────────────
    var kaynak = coz.bakis && coz.bakis.kaynak === 'orijin'
      ? 'Dosyadan: montaj orijini kayış düzleminin arkasında (motor tarafı).'
      : 'Dosyadan çıkarılamadı — varsayılan.';
    h += _fwField('Bakış', '<div class="ve-fw-spinbox">'
      + '<button type="button" class="ve-fw-spin' + (s.ayna ? '' : ' ve-fw-spin-on') + '"'
        + ' title="Önden: kasnakların önünden, motorun karşısından. ' + _fwEsc(kaynak) + '"'
        + ' onclick="veFeadWizStpAyna(false)">Önden</button>'
      + '<button type="button" class="ve-fw-spin' + (s.ayna ? ' ve-fw-spin-on' : '') + '"'
        + ' title="Arkadan: x ekseni aynalanır; krankın dönüş yönü de ters okunur."'
        + ' onclick="veFeadWizStpAyna(true)">Arkadan</button></div>');
    h += _fwField('Hesap çapı', _fwStpHesapCapHTML(s));
    // ÇİZİM MASADA (çizim masası, 2026-09-29): kartın içindeki ikinci kopya
    // aynı kasnakları iki kez sayardı (`_fwKaynakMasa`).

    // ── AKTAR ─────────────────────────────────────────────────────────────
    var aktarildi = !!(st.stepKaynak && s.aktarim);
    var degisti = aktarildi && s.aktarim !== _fwStpImza(s);
    h += '<div class="ve-fw-rowbtns">'
      + '<button type="button" id="ve-fw-stp-aktar" class="ve-fw-btn"'
      + (d.engel.length ? ' disabled' : '') + ' onclick="veFeadWizStpAktar()">'
      + (aktarildi ? 'Yeniden aktar' : 'Sihirbaza aktar') + '</button></div>';
    if(aktarildi && !degisti)
      h += '<div class="ve-fw-seeded">' + veIkon('check') + ' <b>' + st.stepKaynak.kasnak + ' kasnak</b> sihirbaza aktarıldı'
        + ' <em>' + _fwEsc(st.stepKaynak.dosya) + '</em></div>';
    if(degisti) d.uyari.unshift('Rol ya da bakış aktarımdan sonra değişti; sihirbaz eski seçimle dolu.');
  }
  var liste = d.engel.filter(function(m){ return !(d.hesapsiz && m === 'Çap ve merkezler henüz hesaplanmadı.'); })
    .map(function(m){ return { tur: 'err', m: m }; })
    .concat(d.uyari.map(function(m){ return { tur: 'warn', m: m }; }));
  if(liste.length){
    h += '<div class="ve-fw-issues">';
    liste.forEach(function(it){
      h += '<div class="ve-fw-issue ve-fw-issue-' + it.tur + '">' + _fwSorunIkon(it.tur)
        + ' ' + _fwEsc(it.m) + '</div>';
    });
    h += '</div>';
  }
  return h + '</div>';
}

// ── 2 · KASNAKLAR — ÇİZİM MASASI ───────────────────────────────────────────
// Kayış yolu gerçek oranda, X/Y eksenleri mm çentikli, göbekte TABLONUN sıra
// numarası (Pafta'nın dili — `siraNo`). Seçili kasnak halesiyle ve iki eksene
// kesikli izdüşümüyle; izdüşümün yazısı GİRDİNİN kendisi (X/Y alanı; gergide
// avara merkezi) — ekrandaki çizimden geri okunan bir sayı değil.
//
// ÇİZİMDE SEÇİLİR, SÜRÜKLENİR, OK TUŞUYLA OYNAR — kanvastaki Çizim Masası'nın
// (kural 32) sihirbazdaki karşılığı: tık kasnağı seçer, sürükleme konum
// girdisini 0,1 mm ızgarada yazar, ok tuşu 0,1 mm (Shift ile 1 mm). Kayışı
// KOPARAN konum YAZILMAZ — son geçerli konum korunur ve sebep lejantta.
// Sürükleme sürerken ölçek DONAR (`xfSabit`): kasnak kenara yaklaştıkça
// yeniden sığdırmak çizimi imlecin altında küçültürdü.
function _fwSecId(){
  if(!_fwSec) return null;
  return _fwSec === '__ten__' ? 'wz-ten' : 'wz-' + _fwSec;
}
function _fwKeyOf(id){
  var s = String(id || '');
  if(s === 'wz-ten') return '__ten__';
  return s.indexOf('wz-') === 0 ? s.slice(3) : null;
}
// Seçili satır geçerli mi — değilse tablo sırasının ilk satırı (sürücü).
function _fwSecDogrula(sira){
  if(!_fwSec || sira.indexOf(_fwSec) < 0) _fwSec = sira[0] || null;
  return _fwSec;
}
// Konum GİRDİSİ (mm): kasnakta X/Y, gergide avara merkezi.
function _fwKasnakXY(key){
  var st = _fwState;
  if(!st) return null;
  if(key === '__ten__'){
    var t = st.ten || {}, x = _fwNum(t.cenX, NaN), y = _fwNum(t.cenY, NaN);
    return (Number.isFinite(x) && Number.isFinite(y)) ? [x, y] : null;
  }
  var p = st.pulleys.filter(function(q){ return q.key === key; })[0];
  if(!p) return null;
  var px = _fwNum(p.x, NaN), py = _fwNum(p.y, NaN);
  return (Number.isFinite(px) && Number.isFinite(py)) ? [px, py] : null;
}
function _fwKasnakXYYaz(key, x, y){
  var st = _fwState;
  if(key === '__ten__'){
    if(!st.ten) st.ten = {};
    st.ten.cenX = x; st.ten.cenY = y;
    return;
  }
  var p = st.pulleys.filter(function(q){ return q.key === key; })[0];
  if(p){ p.x = x; p.y = y; }
}
// Konumu dener: çözülüyorsa yazar ve true; kayışı koparıyorsa eski değeri
// geri koyar ve false (koparan konum yazılmaz).
function _fwKasnakTasi(key, x, y){
  var eski = _fwKasnakXY(key);
  if(!eski) return false;
  x = Math.round(x * 10) / 10; y = Math.round(y * 10) / 10;
  _fwKasnakXYYaz(key, x, y);
  var b = veFeadWizBuild();
  if(b && b.ok) return true;
  _fwKasnakXYYaz(key, eski[0], eski[1]);
  veFeadWizBuild();
  return false;
}

function _fwKasnakOpt(xf, ek){
  return { inline: true, kunye: false, posMode: 'mean', compass: false, pivot: true, arrows: true,
           siraNo: true, nameLabels: false, wrapLabels: false, frame: false,
           // Lejant X ekseninin ÜSTÜNDE yüzer (CSS `data-adim="kasnak"`): alt pay
           // eksen + lejant, üst pay sonuç çipi.
           kenarPay: { sol: VE_FW_EKSEN.sol, alt: VE_FW_EKSEN.alt + _fwPx(VE_FW_MASA_PAY.alt),
                       ust: _fwPx(VE_FW_MASA_PAY.ust), sag: _fwPx(8) },
           xfSabit: xf || null, ek: ek };
}
function _fwKasnakMasa(b, W, H){
  if(!(b && b.ok) || typeof veFeadLayoutSVG !== 'function')
    return _fwMasaBos('Kayış yolu henüz çözülmedi.');
  var xf = (_fwSurukle && _fwSurukle.xf) || null;
  // YAKINLIK = sığdırılmış dönüşümün ölçeği × z, seçili kasnak (yoksa masanın
  // ortası) yerinde kalacak biçimde. Taban dönüşüm çizicinin KENDİSİNDEN
  // alınır (ek katman onu görür) — ikinci bir sığdırma hesabı yazılmaz.
  if(!xf && _fwZoom > 1){
    var taban = null;
    veFeadLayoutSVG(b, W, H, _fwKasnakOpt(null, function(T){ taban = T; return ''; }));
    if(taban){
      var cx = W / 2, cy = H / 2, k = _fwSecIndex(taban.order);
      if(k >= 0 && taban.ps[k]){ cx = taban.tx(taban.ps[k].c[0]); cy = taban.ty(taban.ps[k].c[1]); }
      var xm = taban.mx + (cx - taban.ox) / taban.s, ym = taban.my - (cy - taban.oy) / taban.s;
      var s2 = taban.s * _fwZoom;
      xf = { s: s2, ox: cx - (xm - taban.mx) * s2, oy: cy - (taban.my - ym) * s2,
             mx: taban.mx, my: taban.my };
    }
  }
  var svg = veFeadLayoutSVG(b, W, H, _fwKasnakOpt(xf, function(T){
    _fwMasaXf = { s: T.s, ox: T.ox, oy: T.oy, mx: T.mx, my: T.my };
    return _fwKasnakKatman(T);
  }));
  return svg || _fwMasaBos('Kayış yolu henüz çözülmedi.');
}
function _fwSecIndex(order){
  var id = _fwSecId();
  if(!id || !order) return -1;
  for(var i = 0; i < order.length; i++) if(order[i] && order[i].id === id) return i;
  return -1;
}
function _fwKasnakKatman(T){
  var f = T.f, s = T.s;
  var h = _fwEksenSVG(T);
  var k = _fwSecIndex(T.order);
  if(k >= 0 && T.ps[k]){
    var p = T.ps[k], cx = T.tx(p.c[0]), cy = T.ty(p.c[1]), R = p.rPitch * s;
    var xA = VE_FW_EKSEN.sol - 8, yA = T.H - VE_FW_EKSEN.alt + 6;
    var xy = _fwKasnakXY(_fwSec) || [p.c[0], p.c[1]];
    h += '<g data-ve="secim" class="ve-fw-secim">'
      + '<circle class="ve-fw-secim-hale" cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(R + 6) + '"/>'
      + '<line class="ve-fw-secim-iz" x1="' + f(cx) + '" y1="' + f(cy + R + 6) + '" x2="' + f(cx) + '" y2="' + f(yA) + '"/>'
      + '<line class="ve-fw-secim-iz" x1="' + f(cx - R - 6) + '" y1="' + f(cy) + '" x2="' + f(xA) + '" y2="' + f(cy) + '"/>'
      + '<path class="ve-fw-secim-uc" d="M' + f(cx) + ' ' + f(yA) + ' l-5 -9 h10 z M' + f(xA) + ' ' + f(cy) + ' l9 -5 v10 z"/>'
      + '<text data-ve="secim-x" x="' + f(cx + 6) + '" y="' + f(yA - 8) + '">X ' + veSayi(xy[0], 1) + '</text>'
      + '<text data-ve="secim-y" x="' + f(xA + 12) + '" y="' + f(cy - 6) + '">Y ' + veSayi(xy[1], 1) + '</text>'
      + '</g>';
  }
  // İSABET HALKALARI EN ÜSTTE, BÜYÜKTEN KÜÇÜĞE: büyük kasnağın yanındaki
  // küçük avara üstte kalsın. Yarıçap en az 11 px (kanvastaki kuralın aynısı).
  var hit = T.ps.map(function(q, i){ return { q: q, i: i }; })
    .sort(function(a, c){ return c.q.rPitch - a.q.rPitch; });
  h += '<g data-ve="hit">';
  hit.forEach(function(o){
    var n = T.order[o.i], key = n && _fwKeyOf(n.id);
    if(!key) return;
    h += '<circle class="ve-fw-hit" data-fw-k="' + _fwEsc(key) + '" cx="' + f(T.tx(o.q.c[0]))
      + '" cy="' + f(T.ty(o.q.c[1])) + '" r="' + f(Math.max(o.q.rPitch * s + 3, 11)) + '" fill="transparent">'
      + '<title>' + _fwEsc((T.geom.names && T.geom.names[o.i]) || '') + ' — sürükle: taşı · ok tuşu: 0,1 mm</title></circle>';
  });
  return h + '</g>';
}

// ── MASADA FARE ────────────────────────────────────────────────────────────
function veFeadWizMasaBas(e){
  if(_fwMasaAdim(_fwStep) !== 'kasnak' || !e || e.button > 0) return;
  var t = e.target && e.target.closest ? e.target.closest('[data-fw-k]') : null;
  if(!t) return;
  var key = t.getAttribute('data-fw-k');
  if(e.preventDefault) e.preventDefault();
  var masa = document.getElementById('ve-fw-masa');
  if(masa && masa.focus) masa.focus({ preventScroll: true });
  var svg = document.querySelector('#ve-fw-masa-cizim svg');
  var vb = svg && svg.viewBox && svg.viewBox.baseVal;
  var r = svg ? svg.getBoundingClientRect() : null;
  var olc = (r && vb && vb.width) ? r.width / vb.width : 1;
  var degisti = (_fwSec !== key);
  _fwSec = key;
  _fwSurukle = { key: key, x0: e.clientX, y0: e.clientY, olc: olc, xf: _fwMasaXf,
                 bas: _fwKasnakXY(key), oynadi: false, red: false, bekle: null };
  document.addEventListener('pointermove', veFeadWizMasaSurukle);
  document.addEventListener('pointerup', veFeadWizMasaBirak);
  if(degisti){
    // Seçim değişti: liste ve editör o kasnağa geçer (tam çizim; odak masada).
    veFeadWizRender();
    var m2 = document.getElementById('ve-fw-masa');
    if(m2 && m2.focus) m2.focus({ preventScroll: true });
  }
}
function veFeadWizMasaSurukle(e){
  var d = _fwSurukle;
  if(!d || !d.xf || !d.bas) return;
  var px = e.clientX - d.x0, py = e.clientY - d.y0;
  if(!d.oynadi && Math.sqrt(px * px + py * py) < 3) return;        // tık eşiği
  d.oynadi = true;
  d.bekle = [d.bas[0] + px / (d.olc * d.xf.s), d.bas[1] - py / (d.olc * d.xf.s)];
  if(d.kare) return;
  var zaman = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : setTimeout;
  d.kare = zaman(function(){
    d.kare = null;
    if(!d.bekle || _fwSurukle !== d) return;
    var ok = _fwKasnakTasi(d.key, d.bekle[0], d.bekle[1]);
    d.red = !ok;
    _fwMasaYenile(_fwBuild);
    var el = document.getElementById('ve-fw-live');
    if(el) el.innerHTML = veFeadWizLiveHTML(_fwBuild);
  });
}
function veFeadWizMasaBirak(){
  document.removeEventListener('pointermove', veFeadWizMasaSurukle);
  document.removeEventListener('pointerup', veFeadWizMasaBirak);
  var d = _fwSurukle;
  _fwSurukle = null;
  if(d && d.oynadi){
    // Bırakınca TAM çizim: editörün X/Y alanları ve liste yeni değeri gösterir.
    veFeadWizRender();
    var m = document.getElementById('ve-fw-masa');
    if(m && m.focus) m.focus({ preventScroll: true });
  }
}
// Ok tuşu: seçili kasnağı 0,1 mm (Shift: 1 mm) oynatır. Koparan adım yazılmaz.
function _fwMasaTus(e){
  if(!e || e.altKey || !/^Arrow(Up|Down|Left|Right)$/.test(e.key)) return false;
  if(typeof document === 'undefined' || _fwMasaAdim(_fwStep) !== 'kasnak' || !_fwSec) return false;
  var a = document.activeElement;
  if(!a || a.id !== 've-fw-masa') return false;
  var xy = _fwKasnakXY(_fwSec);
  if(!xy) return false;
  if(e.preventDefault) e.preventDefault();
  var adim = e.shiftKey ? 1 : 0.1;
  var dx = e.key === 'ArrowLeft' ? -adim : e.key === 'ArrowRight' ? adim : 0;
  var dy = e.key === 'ArrowDown' ? -adim : e.key === 'ArrowUp' ? adim : 0;
  var ok = _fwKasnakTasi(_fwSec, xy[0] + dx, xy[1] + dy);
  _fwSurukle = ok ? null : { red: true };
  veFeadWizRender();
  _fwSurukle = null;
  var m = document.getElementById('ve-fw-masa');
  if(m && m.focus) m.focus({ preventScroll: true });
  return true;
}
function veFeadWizZoom(yon){
  _fwZoom = yon > 0 ? Math.min(6, _fwZoom * 1.4) : yon < 0 ? Math.max(1, _fwZoom / 1.4) : 1;
  if(_fwZoom < 1.05) _fwZoom = 1;
  _fwMasaYenile();
}
function veFeadWizSec(key){
  _fwSec = key;
  veFeadWizRender();
}

// ── 2 · KASNAKLAR — DENETİM SÜTUNU ─────────────────────────────────────────
// Sıra listesi (Gates tablo sırası: sürücü ilk, gergi son) + seçili kasnağın
// editörü. Tablo 10 sütunluk bir ızgaraydı; masa çizimi geometriyi taşıdığı
// için liste yalnız KİMLİĞİ (sıra · ad · rol) ve iki okumayı (Ø · sarım)
// taşır, girdiler seçili satırın editöründe.
//
// SARIM AÇISI ÇEKİRDEKTEN (Mean konumundaki geometri, `build.order` sırası =
// tablo sırası); çözüm yoksa "—".
function _fwSarimlar(b){
  var out = {};
  if(!(b && b.ok && b.sys) || typeof FEADCore === 'undefined') return out;
  try {
    var g = FEADCore.tensionerState(b.sys, FEADCore.meanRel(b.sys)).geom;
    (b.order || []).forEach(function(n, i){
      var k = n && _fwKeyOf(n.id);
      if(k && g.wraps && Number.isFinite(g.wraps[i])) out[k] = g.wraps[i] * 180 / Math.PI;
    });
  } catch(e){ /* çözülemeyen konum: sarım yok */ }
  return out;
}
function _fwKasnakListeHTML(b, sira, byKey){
  var sarim = _fwSarimlar(b), t = (_fwState && _fwState.ten) || {};
  var h = '';
  sira.forEach(function(k, i){
    var ten = (k === '__ten__'), p = ten ? null : byKey[k];
    if(!ten && !p) return;
    var ad = ten ? (t.name || _fwTenAd()) : (p.name || _fwDefName(p.type));
    var od = ten ? t.od : p.od;
    var rol = ten ? '<i class="ve-fw-kl-rol" data-rol="gergi">gergi</i>'
            : (p.driver ? '<i class="ve-fw-kl-rol" data-rol="surucu">sürücü</i>' : '');
    var on = (k === _fwSec);
    h += '<button type="button" class="ve-fw-kl' + (on ? ' on' : '') + '" role="option"'
      + ' aria-selected="' + on + '" data-fw-k="' + _fwEsc(k) + '"'
      + ' onclick="veFeadWizSec(\'' + _fwEsc(k) + '\')">'
      + '<span class="ve-fw-kl-no">' + (i + 1) + '</span>'
      + '<span class="ve-fw-kl-ad"><span>' + _fwEsc(ad) + '</span>' + rol + '</span>'
      + '<span class="ve-fw-kl-n">' + (Number.isFinite(_fwNum(od, NaN)) ? veSayi(_fwNum(od, NaN), 0) : '—') + '</span>'
      + '<span class="ve-fw-kl-n ve-fw-kl-dim">' + (Number.isFinite(sarim[k]) ? veSayi(sarim[k], 1) + '°' : '—') + '</span>'
      + '</button>';
  });
  return h;
}

// Temas tarafı: iki düğmeli seçici (tasarımın segmenti). Değer `contact`.
function _fwTemasHTML(cur, cagri, kilit){
  function dg(v, ad){
    return '<button type="button" class="ve-fw-seg-b" aria-pressed="' + (cur === v) + '"'
      + (kilit ? ' disabled title="' + _fwEsc(VE_FW_TEN_LOCK_NOTE) + '"' : '')
      + ' onclick="' + cagri(v) + '">' + ad + '</button>';
  }
  return '<div class="ve-fw-seg" role="group" aria-label="Temas tarafı">'
    + dg('grooved', 'Kaburgalı') + dg('back', 'Sırttan') + '</div>';
}
function veFeadWizTemas(key, v){
  veFeadWizPulleySet(key, 'contact', v);
  veFeadWizRender();
}
function veFeadWizTenTemas(v){
  if(veFeadWizTenLocked(_fwState)) return;
  veFeadWizTenSet('contact', v);
  veFeadWizRender();
}

// Satır işlemleri — oklar kilidi GÖSTERİR (kural: etkin görünüp hiçbir şey
// yapmayan düğme bu deponun adıyla saydığı kusur). Koşullar BASILAN sıraya
// göre; `veFeadWizRouteMove` iki ucu zaten reddediyor.
// Gergi SON SATIRDAYSA iki ok da pasif — "döngü otomatik gergiyle biter" bir
// KURAL (2026-09-22); kural yerinde değilse (yön çevrilmiş) oklar canlı kalır.
function _fwSiraDugmeleri(key, i, n, gergiSonda, silinir){
  var ten = (key === '__ten__');
  var ustKapali = ten ? (i === 0 || i === n - 1) : (i <= 1);
  var altKapali = ten ? (i >= n - 1) : (i === 0 || i >= n - 1 - (gergiSonda ? 1 : 0));
  return '<div class="ve-fw-ed-ops">'
    + '<button type="button" class="ve-fw-btn"' + (ustKapali ? ' disabled' : '')
      + (ten && i === n - 1 ? ' title="Gergi son satırda kilitli: döngü otomatik gergiyle biter."' : '')
      + ' onclick="veFeadWizPulleyMove(\'' + key + '\',-1)">' + veIkon('arrow-up') + ' Sırada öne</button>'
    + '<button type="button" class="ve-fw-btn"' + (altKapali ? ' disabled' : '')
      + ' onclick="veFeadWizPulleyMove(\'' + key + '\',1)">' + veIkon('arrow-down') + ' Arkaya</button>'
    // GERGİ SİLİNEMEZ — ama düğme YOK DEĞİL, KAPALI: kilit sessiz olmasın,
    // sebebi ipucunda (çekirdek her modelde tam bir gergi istiyor).
    + '<button type="button" class="ve-fw-btn ve-fw-btn-sil"'
      + (silinir ? ' onclick="veFeadWizPulleyDel(\'' + key + '\')"'
                 : ' disabled title="Gergi silinemez: çekirdek her modelde tam bir gergi ister."')
      + '>' + veIkon('trash') + ' Sil</button>'
    + '</div>';
}

// SEÇİLİ SATIRIN EDİTÖRÜ — alanlar tablonun hücreleriyle AYNI yazıcılara
// gider (`veFeadWizPulleySet` · `veFeadWizTenSet` · `veFeadWizDriver` …);
// ikinci bir durum kopyası yok.
function _fwKasnakEditorHTML(b, sira, byKey){
  var st = _fwState, key = _fwSec, i = sira.indexOf(key), n = sira.length;
  if(i < 0) return '';
  var gergiSonda = n > 1 && sira[n - 1] === '__ten__';
  var basla = function(ad, rol){
    return '<div class="ve-fw-ed-bas"><span class="ve-fw-kl-no ve-fw-kl-no-on">' + (i + 1) + '</span>'
      + '<b>' + _fwEsc(ad) + '</b>' + rol + '</div>';
  };
  function alan(et, kontrol){
    return '<label class="ve-fw-ed-alan"><span>' + et + '</span>' + kontrol + '</label>';
  }
  function sayi(deger, oninput, ph, ek){
    return '<span class="ve-fw-ed-kutu"><input type="text" inputmode="decimal" class="ve-fw-inp"'
      + ' value="' + _fwEsc(deger === undefined || deger === null ? '' : deger) + '"'
      + ' placeholder="' + _fwEsc(ph || '') + '"' + (ek || '') + ' oninput="' + oninput + '"></span>';
  }
  var h;
  if(key === '__ten__'){
    var t = st.ten || {}, kx = veFeadWizTenCoordKeys(st), kilit = veFeadWizTenLocked(st);
    // Gergide de X/Y KASNAĞIN MERKEZİ (kolun çalışma konumunda); gövdenin
    // montaj noktası bir girdi değil, türeyen sonuç — ipucunda, açıklama
    // paragrafı olarak değil.
    var mnt = 'Gergide de X/Y kasnağın MERKEZİDİR (kolun çalışma konumunda), '
      + 'diğer satırlarla aynı şey. Gövdenin montaj noktası bir girdi değil, '
      + 'ondan ve kol açısından türeyen bir sonuçtur — ' + _fwAdimNo('gergi') + '. adımda okunur. '
      + 'Karıştırmanın ölçülmüş bedeli gerginlikte medyan +%1526 ve model yine çözülür.';
    // GERGİ EDİTÖRÜ KASNAKLARINKİYLE BİREBİR (kullanıcı isteği 2026-09-01:
    // *"onu da diğer satırlar gibi yapalım"*): aynı alanlar aynı sırada. Tip
    // TEK seçenekli liste — kilit görünümle değil SEÇENEK KÜMESİYLE; sürücü
    // ve sil KAPALI, sebebi ipucunda.
    h = basla(t.name || _fwTenAd(), '<i class="ve-fw-kl-rol" data-rol="gergi">gergi</i>')
      + alan('Ad', '<input type="text" class="ve-fw-inp" value="' + _fwEsc(t.name || '') + '"'
          + ' placeholder="' + _fwEsc(_fwTenAd()) + '" oninput="veFeadWizTenSet(\'name\', this.value)">')
      + alan('Tip', '<select class="ve-fw-inp" aria-label="Tip"><option value="fead-tensioner" selected>'
          + _fwEsc(_fwTenAd()) + '</option></select>')
      // KİLİT AYNI ÜRETİCİDEN (`_fwInp` → readonly + K): gergi adımının
      // künye bloğu da bunu basıyor, iki yüzey ayrışamaz.
      + alan('Ø OD', '<span class="ve-fw-ed-kutu">'
          + _fwInp('ten.od', { ph: '75', kilit: kilit, kilitNot: VE_FW_TEN_LOCK_NOTE }) + '</span>')
      + '<div class="ve-fw-ed-alan ve-fw-ed-xy"><span>Merkez</span>'
        + sayi(t[kx[0]], 'veFeadWizTenSet(\'' + kx[0] + '\', this.value)', 'X', ' title="' + _fwEsc(mnt) + '" aria-label="Merkez X"')
        + sayi(t[kx[1]], 'veFeadWizTenSet(\'' + kx[1] + '\', this.value)', 'Y', ' title="' + _fwEsc(mnt) + '" aria-label="Merkez Y"')
      + '</div>'
      + alan('Temas', _fwTemasHTML(t.contact === 'grooved' ? 'grooved' : 'back',
          function(v){ return 'veFeadWizTenTemas(\'' + v + '\')'; }, kilit))
      + alan('J', sayi(t.inertia, 'veFeadWizTenSet(\'inertia\', this.value)', '—'))
      + '<label class="ve-fw-check" title="Gergi sürücü olamaz: kayışı tahrik etmez, gerer.">'
        + '<input type="radio" disabled><span>Sürücü kasnak</span></label>'
      + '<div class="ve-fw-rowbtns">'
        + '<button type="button" class="ve-fw-btn" onclick="veFeadWizGoto(' + (_fwAdimNo('gergi') - 1) + ')">'
        + 'Kol ve yay: ' + _fwEsc(VE_FW_STEPS[_fwAdimNo('gergi') - 1].ad) + ' ' + veIkon('arrow-right') + '</button></div>'
      + _fwSiraDugmeleri('__ten__', i, n, gergiSonda, false);
  } else {
    var p = byKey[key];
    if(!p) return '';
    var tipler = VE_FW_PULLEY_TYPES.map(function(x){ return [x, _fwDefName(x)]; });
    h = basla(p.name || _fwDefName(p.type),
          p.driver ? '<i class="ve-fw-kl-rol" data-rol="surucu">sürücü</i>' : '')
      + alan('Ad', '<input type="text" class="ve-fw-inp" value="' + _fwEsc(p.name || '') + '"'
          + ' placeholder="' + _fwEsc(_fwDefName(p.type)) + '"'
          + ' oninput="veFeadWizPulleySet(\'' + p.key + '\',\'name\',this.value)">')
      + alan('Tip', '<select class="ve-fw-inp" onchange="veFeadWizPulleyType(\'' + p.key + '\', this.value)">'
          + tipler.map(function(o){
              return '<option value="' + o[0] + '"' + (o[0] === p.type ? ' selected' : '') + '>'
                + _fwEsc(o[1]) + '</option>'; }).join('') + '</select>')
      + alan('Ø OD', sayi(p.od, 'veFeadWizPulleySet(\'' + p.key + '\',\'od\',this.value)', ''))
      + '<div class="ve-fw-ed-alan ve-fw-ed-xy"><span>Merkez</span>'
        + sayi(p.x, 'veFeadWizPulleySet(\'' + p.key + '\',\'x\',this.value)', 'X', ' aria-label="Merkez X"')
        + sayi(p.y, 'veFeadWizPulleySet(\'' + p.key + '\',\'y\',this.value)', 'Y', ' aria-label="Merkez Y"')
      + '</div>'
      + alan('Temas', _fwTemasHTML(p.contact === 'back' ? 'back' : 'grooved',
          function(v){ return 'veFeadWizTemas(\'' + p.key + '\',\'' + v + '\')'; }, false))
      + alan('J', sayi(p.inertia, 'veFeadWizPulleySet(\'' + p.key + '\',\'inertia\',this.value)', '—'))
      + '<label class="ve-fw-check"><input type="radio" name="ve-fw-driver"' + (p.driver ? ' checked' : '')
        + ' onchange="veFeadWizDriver(\'' + p.key + '\')"><span>Sürücü kasnak</span></label>'
      + _fwSiraDugmeleri(p.key, i, n, gergiSonda, true);
  }
  return '<div class="ve-fw-ed" id="ve-fw-ed" data-fw-k="' + _fwEsc(key) + '">' + h + '</div>';
}

function _fwStepKasnak(b){
  var st = _fwState;
  // SATIRLAR TABLO SIRASINDA — Gates "Layout Data" sırası, kayışın gidişinin
  // TERSİ ve kurulacak Kayış Tablosu'nun BİREBİR aynısı (kullanıcı isteği
  // 2026-09-22: "otomatik gergiyi en son kısımda görmek istiyoruz"). Model
  // sırası (`st.route`) gidişte kalır; taşıma `veFeadWizPulleyMove` ile
  // basılan sırada okunur.
  var sira = (typeof veFeadRouteFlip === 'function')
    ? veFeadRouteFlip(veFeadWizRoute(st)) : veFeadWizRoute(st);
  var byKey = {};
  st.pulleys.forEach(function(p){ byKey[p.key] = p; });
  _fwSecDogrula(sira);

  // GERGİ KRANKIN ÇIKIŞINDA MI — hüküm sıranın YANINDA (köprünün
  // `build.tensionerOrder`ı; sihirbaz yeniden hesaplamaz).
  var _tord = b && b.tensionerOrder, _hkm = '';
  if(_tord && _tord.afterDriver){
    _hkm = '<p class="ve-fw-dim ve-fw-kl-hukum">Gergi krankın <strong>çıkışında</strong> (kayış '
      + 'sırasında 2.) — otomatik gergi gevşek açıklıkta durur; Gates tablosunda bu, sıranın sonudur.</p>';
  } else if(_tord){
    _hkm = '<p class="ve-fw-warn ve-fw-kl-hukum">' + veIkon('alert-triangle') + ' Gergi krankın çıkışında değil ('
      + (_tord.index + 1) + '/' + _tord.count + '). Otomatik gergi kayışın kranktan <strong>çıktığı</strong> '
      + '(gevşek) açıklıkta durur — kayış sırasında krankın hemen ardında. '
      // ÇARE UYDURULMAZ: sayıların etkilenmediği AYNI cümlede — yoksa okuyucu
      // bunu bir hesap hatası sanardı.
      + '<span class="ve-fw-dim">Sayılar bundan etkilenmez; etkilenen tedarikçi '
      + 'raporlarıyla satır satır karşılaştırılabilirlik.</span></p>';
  }

  var liste = '<div class="ve-fw-kl-bas"><span>kayış sırasıyla · ' + sira.length + '</span>'
    + '<span>Ø · sarım</span></div>'
    + '<div class="ve-fw-kl-liste" id="ve-fw-kl-liste" role="listbox" aria-label="Kasnaklar — kayış sırasıyla">'
    + _fwKasnakListeHTML(b, sira, byKey) + '</div>' + _hkm;
  var h = _fwCard('Kasnaklar — kayış sırasıyla', 'var(--accent-primary)', liste);
  var ed = _fwKasnakEditorHTML(b, sira, byKey);
  if(ed) h += _fwCard('Seçili kasnak', 'var(--accent-primary)', ed);

  // EKLE · YÖN — tek blokta. Ekleme bir açılır liste (tipler componentDefs'ten).
  var ekle = '<select class="ve-fw-inp ve-fw-ekle" aria-label="Kasnak ekle"'
    + ' onchange="if(this.value){veFeadWizKasnakEkle(this.value);}">'
    + '<option value="">＋ Kasnak ekle…</option>'
    + VE_FW_PULLEY_TYPES.map(function(t){
        return '<option value="' + t + '">' + _fwEsc(_fwDefName(t)) + '</option>'; }).join('')
    + '</select>';
  h += _fwCard('Sıra ve yön', 'var(--accent-warning)',
      ekle
    + '<div class="ve-fw-rowbtns">'
      + '<button type="button" class="ve-fw-btn" onclick="veFeadWizRouteReverse()">'
      + veIkon('arrow-left-right') + ' Kayış yönünü çevir</button>'
      + (st.siraKaynagi === 'agac'
          ? '<button type="button" id="ve-fw-sira-onay" class="ve-fw-btn" onclick="veFeadWizSiraOnay()"'
            + ' title="Sıra STEP ağacından geldi. Kayış yolunu doğruladıysanız onaylayın.">'
            + veIkon('check') + ' Sıra doğru</button>'
          : '')
    + '</div>'
    + veFeadWizSpinHTML(b)
    );
  return h;
}
// Ekleme: yeni kasnak SEÇİLİ doğar — editörü hemen onun alanlarını gösterir.
function veFeadWizKasnakEkle(type){
  if(!_fwState) return;
  var once = {};
  _fwState.pulleys.forEach(function(p){ once[p.key] = 1; });
  veFeadWizPulleyAdd(type);
  var yeni = _fwState.pulleys.filter(function(p){ return !once[p.key]; })[0];
  if(yeni){ _fwSec = yeni.key; veFeadWizRender(); }
}


// ── 1 · BAŞLANGIÇ — ÇİZİM MASASI ───────────────────────────────────────────
// Dosya açıldıysa ve çap/merkez hesaplandıysa STEP'in kendi çizimi (rol
// verilen parçalar); yoksa yüklenen modelin kayış yolu, dönüş animasyonuyla
// (kullanıcı isteği 2026-09-04: "dönüş yönü belli olur"). Hiçbiri yoksa masa
// boş ve bunu söyler.
function _fwKaynakMasa(b, W, H){
  var s = _fwStp;
  if(s && s.durum === 'hazir' && s.coz && s.coz.ok && typeof _fwStpCizimSVG === 'function')
    return '<div class="ve-fw-masa-stp">' + _fwStpCizimSVG(s) + '</div>';
  if(b && b.ok && typeof veFeadLayoutSVG === 'function'){
    var svg = veFeadLayoutSVG(b, W, H, { inline: true, kunye: false, posMode: 'mean', compass: true, pivot: true,
      arrows: true, frame: false, nodeId: 've-fw-example', animate: { dispMmS: 260 },
      kenarPay: { ust: _fwPx(VE_FW_MASA_PAY.ust) } });
    if(svg) return svg;
  }
  // DURUM, yönerge değil: dosya okunduysa çizimin neyi beklediği yazılır.
  if(s && s.durum === 'okunuyor') return _fwMasaBos('STEP dosyası okunuyor…');
  if(s && s.durum === 'hazir')
    return _fwMasaBos(s.coz && !s.coz.ok ? 'Kasnak bulunamadı.' : 'Kasnak çizimi hesaptan sonra.');
  return _fwMasaBos('Örnek seçin ya da STEP dosyası açın.');
}

// ── 3 · OTOMATİK GERGİ — YAKIN ÇİZİM ───────────────────────────────────────
// Kolun gezdiği yol: serbest kol → load stop salınımı (kesikli), çalışma
// bandı Maks → Min kayış (yeşil yay), Mean'deki kol ve gerginlik, göbek yükü
// oku ve gövde noktası p. Konumlar çekirdeğin konum tablosundan
// (`veFeadPositionRows` → FEADCore.positionTable), göbek yükü ve yönü
// `FEADCore.tensionerState`'ten (Gates pusulası: +x'ten CCW) — sunum hiçbirini
// hesaplamaz. Kayış yolu yine `veFeadLayoutSVG`; yakınlık yalnız dönüşüm.
function _fwGergiVeri(b){
  if(!(b && b.ok && b.sys && b.sys.tensioner) || typeof FEADCore === 'undefined') return null;
  var rows = (typeof veFeadPositionRows === 'function') ? veFeadPositionRows(b) : [];
  var by = {};
  rows.forEach(function(r){ if(r.ok && r.cen) by[r.key] = r; });
  var st = null;
  try { st = FEADCore.tensionerState(b.sys, FEADCore.meanRel(b.sys)); } catch(e){ st = null; }
  var ti = b.sys._tenIdx;
  var rP = (st && st.geom && st.geom.pulleys[ti]) ? st.geom.pulleys[ti].rPitch : null;
  return { pv: b.sys.tensioner.pivot, by: by, st: st, rP: rP, rows: rows };
}
function _fwGergiMasa(b, W, H){
  if(!(b && b.ok) || typeof veFeadLayoutSVG !== 'function')
    return _fwMasaBos('Kayış yolu henüz çözülmedi.');
  if(_fwGergiGor === 'yol'){
    return veFeadLayoutSVG(b, W, H, { inline: true, kunye: false, posMode: 'all', compass: true, pivot: true,
      arrows: true, frame: false, kenarPay: { ust: _fwPx(VE_FW_MASA_PAY.ust) } })
      || _fwMasaBos('Kayış yolu henüz çözülmedi.');
  }
  var v = _fwGergiVeri(b);
  if(!v || !v.pv || !v.by.mean) return _fwMasaBos('Gerginin konum tablosu çözülemedi.');
  // YAKINLIK: pivot + konumların kutusu, kol boyunun yarısı kadar pay.
  var nok = [v.pv];
  ['free', 'max', 'mean', 'min', 'load'].forEach(function(k){ if(v.by[k]) nok.push(v.by[k].cen); });
  var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, r = v.rP || 30;
  nok.forEach(function(q){
    x0 = Math.min(x0, q[0] - r); x1 = Math.max(x1, q[0] + r);
    y0 = Math.min(y0, q[1] - r); y1 = Math.max(y1, q[1] + r);
  });
  var pay = Math.max(40, 0.45 * Math.max(x1 - x0, y1 - y0));
  x0 -= pay; x1 += pay; y0 -= pay; y1 += pay;
  var m = 16, UST = _fwPx(VE_FW_MASA_PAY.ust), ALT = _fwPx(VE_FW_MASA_PAY.alt);
  var s = Math.min((W - 2 * m) / (x1 - x0), (H - UST - ALT) / (y1 - y0));
  var xf = { s: s, mx: x0, my: y1,
             ox: m + ((W - 2 * m) - (x1 - x0) * s) / 2,
             oy: UST + ((H - UST - ALT) - (y1 - y0) * s) / 2 };
  return veFeadLayoutSVG(b, W, H, { inline: true, kunye: false, posMode: 'mean', compass: false, pivot: true,
    arrows: false, nameLabels: true, shortNames: true, wrapLabels: false, frame: false,
    xfSabit: xf, ek: function(T){ return _fwGergiKatman(T, v); } })
    || _fwMasaBos('Kayış yolu henüz çözülmedi.');
}
// Pivot çevresinde a → b yayı; `ara` noktası yayın ÜSTÜNDE olmalı (kolun
// döndüğü taraf ekrandan okunur, varsayılmaz).
function _fwYay(T, pv, a, c, ara){
  var f = T.f, P = [T.tx(pv[0]), T.ty(pv[1])];
  var A = [T.tx(a[0]), T.ty(a[1])], C = [T.tx(c[0]), T.ty(c[1])];
  var R = Math.sqrt((A[0] - P[0]) * (A[0] - P[0]) + (A[1] - P[1]) * (A[1] - P[1]));
  var aci = function(q){ return Math.atan2(q[1] - P[1], q[0] - P[0]); };
  var norm = function(x){ while(x < 0) x += 2 * Math.PI; while(x >= 2 * Math.PI) x -= 2 * Math.PI; return x; };
  var d = norm(aci(C) - aci(A));
  var sweep = 1, ext = d;
  if(ara){
    var M = [T.tx(ara[0]), T.ty(ara[1])];
    if(norm(aci(M) - aci(A)) > d){ sweep = 0; ext = 2 * Math.PI - d; }
  }
  // Uç noktalar yarıçapa oturtulur (konumların pivot uzaklığı mm'de eşit;
  // yuvarlama pikseli kaydırmasın).
  var uc = function(q){ var t = aci(q); return [P[0] + R * Math.cos(t), P[1] + R * Math.sin(t)]; };
  var a2 = uc(A), c2 = uc(C);
  return 'M' + f(a2[0]) + ' ' + f(a2[1]) + ' A' + f(R) + ' ' + f(R) + ' 0 ' + (ext > Math.PI ? 1 : 0)
    + ' ' + sweep + ' ' + f(c2[0]) + ' ' + f(c2[1]);
}
function _fwGergiKatman(T, v){
  var f = T.f, by = v.by, pv = v.pv, rpx = (v.rP || 30) * T.s;
  var P = [T.tx(pv[0]), T.ty(pv[1])];
  var h = '<g data-ve="gergi-yakin" class="ve-fw-gergi">';
  // Salınım: serbest kol ↔ load stop (kesikli kollar + ince yay + soluk hayalet).
  ['free', 'load'].forEach(function(k){
    var r = by[k];
    if(!r) return;
    var X = T.tx(r.cen[0]), Y = T.ty(r.cen[1]);
    h += '<line class="ve-fw-g-sinir" x1="' + f(P[0]) + '" y1="' + f(P[1]) + '" x2="' + f(X) + '" y2="' + f(Y) + '"/>'
      + '<circle class="ve-fw-g-hayalet" cx="' + f(X) + '" cy="' + f(Y) + '" r="' + f(rpx) + '"/>';
  });
  if(by.free && by.load)
    h += '<path class="ve-fw-g-salinim" d="' + _fwYay(T, pv, by.free.cen, by.load.cen, by.mean.cen) + '"/>';
  if(by.max && by.min)
    h += '<path class="ve-fw-g-bant" data-ve="calisma-bandi" d="' + _fwYay(T, pv, by.max.cen, by.min.cen, by.mean.cen) + '"/>';
  // Göbek yükü: Mean merkezinden, çekirdeğin yönüyle (y ekranda aşağı).
  var st = v.st, M = [T.tx(by.mean.cen[0]), T.ty(by.mean.cen[1])];
  if(st && Number.isFinite(st.hubloadN) && Number.isFinite(st.hubDirDeg)){
    var t = st.hubDirDeg * Math.PI / 180, L = Math.max(34, Math.min(90, rpx * 1.6));
    var E = [M[0] + L * Math.cos(t), M[1] - L * Math.sin(t)];
    var ux = Math.cos(t), uy = -Math.sin(t);
    h += '<line class="ve-fw-g-gobek" x1="' + f(M[0]) + '" y1="' + f(M[1]) + '" x2="' + f(E[0]) + '" y2="' + f(E[1]) + '"/>'
      + '<path class="ve-fw-g-gobek-uc" d="M' + f(E[0]) + ' ' + f(E[1])
        + ' L' + f(E[0] - 9 * ux + 4 * uy) + ' ' + f(E[1] - 9 * uy - 4 * ux)
        + ' L' + f(E[0] - 9 * ux - 4 * uy) + ' ' + f(E[1] - 9 * uy + 4 * ux) + ' Z"/>'
      + '<text class="ve-fw-g-yazi ve-fw-g-yazi-gobek" data-ve="gobek-yazi" x="' + f(E[0] + 6 * ux) + '" y="' + f(E[1] + 6 * uy + 4) + '"'
        + ' text-anchor="' + (ux < -0.2 ? 'end' : ux > 0.2 ? 'start' : 'middle') + '">'
        + 'göbek ' + veSayi(st.hubloadN, 1) + ' N</text>';
  }
  // Konum yazıları — pivotun tersine, kasnağın dışında.
  function yazi(r, metin, sinif){
    var X = T.tx(r.cen[0]), Y = T.ty(r.cen[1]);
    var dx = X - P[0], dy = Y - P[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    var tx = X + dx / l * (rpx + 10), ty = Y + dy / l * (rpx + 10) + 4;
    return '<text class="ve-fw-g-yazi' + (sinif ? ' ' + sinif : '') + '" x="' + f(tx) + '" y="' + f(ty) + '"'
      + ' text-anchor="' + (dx < -0.3 * l ? 'end' : dx > 0.3 * l ? 'start' : 'middle') + '">' + metin + '</text>';
  }
  if(by.free) h += yazi(by.free, 'Serbest kol ' + veSayi(by.free.relDeg, 1) + '°');
  if(by.load) h += yazi(by.load, 'Load stop ' + veSayi(by.load.relDeg, 1) + '°');
  h += yazi(by.mean, 'Mean ' + veSayi(by.mean.relDeg, 2) + '°'
    + (st && Number.isFinite(st.tensionN) ? ' · ' + veSayi(st.tensionN, 1) + ' N' : ''), 've-fw-g-yazi-mean');
  h += '<text class="ve-fw-g-yazi" data-ve="govde-p" x="' + f(P[0]) + '" y="' + f(P[1] - 12) + '" text-anchor="middle">'
    + 'gövde p (' + veSayi(pv[0], 2) + '; ' + veSayi(pv[1], 2) + ')</text>';
  return h + '</g>';
}
function _fwGergiLejant(b){
  var v = (_fwGergiGor === 'yakin') ? _fwGergiVeri(b) : null;
  if(!v) return '';
  var h = '';
  if(v.by.max && v.by.min)
    h += _fwLejSatir('<i class="ve-fw-lj-c" data-tur="bant"></i>', 'çalışma bandı Maks '
      + veSayi(v.by.max.relDeg, 1) + '° → Min ' + veSayi(v.by.min.relDeg, 1) + '°');
  if(v.by.free && v.by.load) h += _fwLejSatir(_fwLejCizgi('sinir'), 'salınım sınırları');
  if(v.st && Number.isFinite(v.st.hubDirDeg))
    h += _fwLejSatir(_fwLejCizgi('gobek'), 'göbek yükü, ' + veSayi(v.st.hubDirDeg, 1) + '°');
  return h;
}

// YAY DOĞRUSU — künyenin kendisi: ön yük + katsayı × göreli dönme. Mean
// noktası ve çalışma bandı konum tablosundan; doğru uydurulmaz, alanlardan.
function _fwYayGrafikHTML(t, b){
  var P = _fwNum(t.preload, NaN), K = _fwNum(t.kArm, NaN);
  if(!(Number.isFinite(P) && Number.isFinite(K) && K > 0)) return '';
  var v = _fwGergiVeri(b), by = (v && v.by) || {};
  var L = _fwNum(t.loadStopRelDeg, NaN);
  if(!(L > 0)) L = by.load ? by.load.relDeg : 60;
  var W = 290, H = 116, x0 = 34, x1 = W - 10, y0 = 100, y1 = 12;
  var tMax = P + K * L, tTop = Math.max(10, Math.ceil(tMax / 10) * 10);
  var sx = function(a){ return x0 + (x1 - x0) * a / L; };
  var sy = function(m){ return y0 - (y0 - y1) * m / tTop; };
  var r = function(n){ return Math.round(n * 10) / 10; };
  // ETİKETLER DOĞRUYU KESMEZ. Doğru sağa doğru yükselir: altı sağda, üstü
  // solda boştur. Her etiket adaylarından İLK BOŞ olana konur — doğrunun o
  // aralıktaki yüksekliği ve önce konan etiketler sayılır. Genişlik
  // karakterden (10 px yazı ≈ 6 px/karakter). Sabit ofsetli eski yerleşimde
  // AG00976'nın üç etiketinin üçünü de doğru kesiyordu.
  var dy = function(x){ return sy(P + K * L * (Math.min(Math.max(x, x0), x1) - x0) / (x1 - x0)); };
  var dolu = [{ xs: x0 + 2, xe: x0 + 22, yu: y1 - 6, ya: y1 + 5 }];     // "Nm"
  var bos = function(k){
    if(k.xs < x0 + 1 || k.xe > x1 + 2 || k.yu < y1 - 8 || k.ya > y0 - 2) return false;
    if(!(dy(k.xs) < k.yu - 1 || dy(k.xe) > k.ya + 1)) return false;
    return dolu.every(function(o){ return k.xe < o.xs - 3 || k.xs > o.xe + 3 || k.ya < o.yu - 1 || k.yu > o.ya + 1; });
  };
  var koy = function(adaylar, w){
    var kutu = function(a){ var xs = a.son ? a.x - w : a.x; return { xs: xs, xe: xs + w, yu: a.y - 8, ya: a.y + 2 }; };
    for(var i = 0; i < adaylar.length; i++) if(bos(kutu(adaylar[i]))){ dolu.push(kutu(adaylar[i])); return adaylar[i]; }
    dolu.push(kutu(adaylar[0]));
    return adaylar[0];
  };
  var et = function(a, metin, sinif){
    return '<text' + (sinif ? ' class="' + sinif + '"' : '') + ' x="' + r(a.x) + '" y="' + r(a.y) + '"'
      + (a.son ? ' text-anchor="end"' : '') + '>' + metin + '</text>';
  };
  var h = '<svg class="ve-fw-yay" viewBox="0 0 ' + W + ' ' + H + '" role="img"'
    + ' aria-label="Yay doğrusu: ön yük ' + veSayi(P, 2) + ' Nm, katsayı ' + veSayi(K, 3) + ' Nm/°">';
  if(by.max && by.min)
    h += '<rect class="ve-fw-yay-bant" x="' + r(sx(Math.min(by.max.relDeg, by.min.relDeg))) + '" y="' + y1
      + '" width="' + r(Math.abs(sx(by.min.relDeg) - sx(by.max.relDeg))) + '" height="' + (y0 - y1) + '"/>';
  h += '<g class="ve-fw-yay-eksen"><line x1="' + x0 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + y0 + '"/>'
    + '<line x1="' + x0 + '" y1="' + y1 + '" x2="' + x0 + '" y2="' + y0 + '"/></g>';
  h += '<line class="ve-fw-yay-dogru" x1="' + r(sx(0)) + '" y1="' + r(sy(P)) + '" x2="' + r(sx(L)) + '" y2="' + r(sy(tMax)) + '"/>';
  var yazi = '<g class="ve-fw-yay-yazi">'
    // Uç etiketleri uca YASLI (0° başa, L° sona): ortalanan 0°, y ekseninin
    // "0"ıyla köşede üst üste biniyordu.
    + '<text x="' + (x0 + 1) + '" y="' + (y0 + 12) + '">0°</text>'
    + '<text x="' + r(sx(L)) + '" y="' + (y0 + 12) + '" text-anchor="end">' + veSayi(L, 1) + '°</text>'
    + '<text x="' + (x0 - 4) + '" y="' + (y0 + 3) + '" text-anchor="end">0</text>'
    + '<text x="' + (x0 - 4) + '" y="' + (y1 + 3) + '" text-anchor="end">' + veSayi(tTop, 0) + '</text>'
    + '<text x="' + (x0 + 4) + '" y="' + (y1 + 3) + '">Nm</text>'
    + '<text x="' + r((x0 + x1) / 2) + '" y="' + (y0 + 12) + '" text-anchor="middle">göreli dönme</text>';
  var kEt = veSayi(K, 3) + ' Nm/°', kW = kEt.length * 6;
  yazi += et(koy([{ x: x1, y: dy(x1 - kW) + 11, son: true }, { x: x1, y: y0 - 5, son: true }], kW), kEt);
  var pEt = 'ön yük ' + veSayi(P, 2), pW = pEt.length * 6;
  yazi += et(koy([{ x: x0 + 4, y: dy(x0 + 4) + 12 }, { x: x0 + 4, y: dy(x0 + 4 + pW) - 5 }], pW), pEt);
  if(by.mean){
    var mt = P + K * by.mean.relDeg, cx = sx(by.mean.relDeg), cy = sy(mt);
    var mEt = veSayi(mt, 2) + ' Nm · ' + veSayi(by.mean.relDeg, 2) + '°', mW = mEt.length * 6.4;
    h += '<circle class="ve-fw-yay-mean" cx="' + r(cx) + '" cy="' + r(cy) + '" r="4"/>';
    yazi += et(koy([{ x: cx - 7, y: dy(cx - 7) - 5, son: true }, { x: cx + 7, y: dy(cx + 7) + 12 },
      { x: cx - 7, y: dy(cx - 7 - mW) + 12, son: true }, { x: cx + 7, y: dy(cx + 7 + mW) - 5 }], mW), mEt, 've-fw-yay-mean-y');
  }
  return h + yazi + '</g></svg>';
}

// ── 4 · KAYIŞ — ÇİZİM MASASI ───────────────────────────────────────────────
// Adımın konusu kayışın kendisi: yol, açıklık boyları (mm) ve sonuç çipinde
// gereken boy. Kasnak adları kısa.
function _fwKayisMasa(b, W, H){
  if(!(b && b.ok) || typeof veFeadLayoutSVG !== 'function')
    return _fwMasaBos('Kayış yolu henüz çözülmedi.');
  return veFeadLayoutSVG(b, W, H, { inline: true, kunye: false, posMode: 'mean', compass: false, pivot: false,
    arrows: true, nameLabels: true, shortNames: true, wrapLabels: false, frame: false,
    kenarPay: { ust: _fwPx(VE_FW_MASA_PAY.ust), alt: _fwPx(VE_FW_MASA_PAY.alt) },
    ek: function(T){ return _fwAciklikKatman(T); } }) || _fwMasaBos('Kayış yolu henüz çözülmedi.');
}
// Açıklık boyları (mm) — çekirdeğin açıklık uzunluğu (`span.L`), orta
// noktadan DIŞA doğru (kümenin ağırlık merkezinin tersine).
function _fwAciklikKatman(T){
  var f = T.f, g = T.geom;
  if(!g || !g.spans) return '';
  var gx = 0, gy = 0;
  T.ps.forEach(function(p){ gx += T.tx(p.c[0]); gy += T.ty(p.c[1]); });
  gx /= Math.max(1, T.ps.length); gy /= Math.max(1, T.ps.length);
  var h = '<g data-ve="aciklik" class="ve-fw-aciklik">';
  g.spans.forEach(function(sp){
    if(!sp || !Number.isFinite(sp.L)) return;
    var ax = T.tx(sp.Pi[0]), ay = T.ty(sp.Pi[1]), bx = T.tx(sp.Pj[0]), by = T.ty(sp.Pj[1]);
    var mx = (ax + bx) / 2, my = (ay + by) / 2, vx = bx - ax, vy = by - ay;
    var l = Math.sqrt(vx * vx + vy * vy) || 1, nx = vy / l, ny = -vx / l;
    if((mx - gx) * nx + (my - gy) * ny < 0){ nx = -nx; ny = -ny; }
    h += '<text x="' + f(mx + nx * 12) + '" y="' + f(my + ny * 12 + 4) + '" text-anchor="middle">'
      + veSayi(sp.L, 1) + '</text>';
  });
  return h + '</g>';
}

// ── 6 · ÖZET — ÇİZİM MASASI ────────────────────────────────────────────────
// Tam boy kayış yolu: adlar, sarım açıları, açıklık boyları ve SINIRDAKİ
// merkez mesafesi — uygunluk kapısının kendi satırlarından (`veFeadChecks`,
// panel ve raporla AYNI çağrı). Sağdaki yüzen panel çizimin üstüne binmesin
// diye çizime sağ pay verilir.
var VE_FW_OZET_PANEL = 288;
function _fwOzetKapilar(b){
  if(!(b && b.ok) || typeof veFeadChecks !== 'function') return null;
  var s = (_fwState && _fwState.solver) || {};
  try { return veFeadChecks(b, veFeadCheckOpt(s, s.duty || [])); } catch(e){ return null; }
}
function _fwOzetMasa(b, W, H){
  if(!(b && b.ok) || typeof veFeadLayoutSVG !== 'function')
    return _fwMasaBos('Kayış yolu henüz çözülmedi.');
  var R = _fwOzetKapilar(b);
  // Panel masanın sağında yüzüyor (ekran px); geniş masada çizim onun
  // soluna sığdırılır. Dar gövdede panel alta iner (CSS), pay gerekmez.
  var genis = W * _fwMasaKat > 760;
  var pay = { ust: _fwPx(VE_FW_MASA_PAY.ust), alt: _fwPx(VE_FW_MASA_PAY.alt) };
  if(genis) pay.sag = _fwPx(VE_FW_OZET_PANEL + 24);
  return veFeadLayoutSVG(b, W, H, { inline: true, kunye: false, posMode: 'mean', compass: true, pivot: true,
    arrows: true, nameLabels: true, wrapLabels: true, frame: false,
    kenarPay: pay,
    ek: function(T){ return _fwAciklikKatman(T) + _fwMerkezKatman(T, R); } })
    || _fwMasaBos('Kayış yolu henüz çözülmedi.');
}
function _fwMerkezKatman(T, R){
  var c = R && R.centerDistance;
  if(!c || !c.rows) return '';
  var f = T.f, h = '<g data-ve="merkez-sinir" class="ve-fw-merkez">';
  c.rows.forEach(function(r){
    if(r.ok) return;
    var pi = T.ps[r.i], pj = T.ps[r.j];
    if(!pi || !pj) return;
    var ax = T.tx(pi.c[0]), ay = T.ty(pi.c[1]), bx = T.tx(pj.c[0]), by = T.ty(pj.c[1]);
    var ust = r.a > r.hi;
    var yazi = 'a = ' + veSayi(r.a, 1) + (ust ? ' > ' + veSayi(r.hi, 1) : ' < ' + veSayi(r.lo, 1)) + ' mm';
    var fs = 11 / _fwMasaKat, w = yazi.length * fs * 0.58 + 12, mx = (ax + bx) / 2, my = (ay + by) / 2;
    // Açıklık boyu orta noktanın DIŞINA yazılıyor (`_fwAciklikKatman`); kutu
    // kümenin İÇİNE, bir yazı boyu kayar — ikisi üst üste binmesin.
    var gx = 0, gy = 0;
    T.ps.forEach(function(q){ gx += T.tx(q.c[0]); gy += T.ty(q.c[1]); });
    gx /= Math.max(1, T.ps.length); gy /= Math.max(1, T.ps.length);
    var dx = gx - mx, dy = gy - my, dl = Math.sqrt(dx * dx + dy * dy) || 1;
    mx += dx / dl * fs * 2.2; my += dy / dl * fs * 2.2;
    h += '<line x1="' + f(ax) + '" y1="' + f(ay) + '" x2="' + f(bx) + '" y2="' + f(by) + '"/>'
      + '<rect x="' + f(mx - w / 2) + '" y="' + f(my - fs) + '" width="' + f(w) + '" height="' + f(2 * fs) + '" rx="3"/>'
      + '<text x="' + f(mx) + '" y="' + f(my + fs * 0.36) + '" text-anchor="middle">' + _fwEsc(yazi) + '</text>';
  });
  return h + '</g>';
}
function _fwOzetLejant(b, k){
  if(!(b && b.ok)) return '';
  var h = '';
  // Anahtar yazının BİÇİMİNİ gösterir, bir değer değil: örnek sayı veri
  // gibi okunurdu.
  if(k === 'ozet') h += _fwLejSatir('<b class="ve-fw-lj-sarim">°</b>', 'sarım açısı');
  h += _fwLejSatir('<b class="ve-fw-lj-aciklik">mm</b>', 'açıklık boyu');
  if(k === 'ozet'){
    var R = _fwOzetKapilar(b), c = R && R.centerDistance;
    if(c && c.rows && c.rows.some(function(r){ return !r.ok; }))
      h += _fwLejSatir(_fwLejCizgi('merkez'), 'sınırdaki merkez mesafesi');
  }
  return h;
}

// ── 5 · MOTOR VE ÇEVRİM — GRAFİKLER ────────────────────────────────────────
// İki grafik: çalışma çevrimi (devre göre zaman payı çubukları + aksesuar
// gücü) ve aksesuar devri ile katalog sınırları (optimum · maks. sürekli ·
// maks. anlık). Güç `_fwKwEff`ten (tablonun okuduğu sayı), devir
// `FEADCore.accessoryRpm`den ve sınırlar `veFeadAccLimits`ten — uygunluk
// kapısının kullandığı aynı üç kaynak.
var VE_FW_SERI = ['var(--seri-1)', 'var(--seri-3)', 'var(--seri-4)', 'var(--seri-2)'];
function _fwCevrimMasa(b, W, H){
  // Grafik kutusunun iç eni: 12 px iç pay + 1 px kenar, iki yanda (CSS
  // `.ve-fw-graf` ile birebir) — SVG kutuya ölçeklenmeden oturur.
  var Wi = Math.max(220, W - 26), yarim = Math.max(160, Math.floor((H - 10) / 2));
  return '<div class="ve-fw-graf">' + _fwCevrimGrafik(b, Wi, yarim) + '</div>'
    + '<div class="ve-fw-graf">' + _fwDevirGrafik(b, Wi, H - yarim - 10) + '</div>';
}
function _fwYukler(){
  var st = _fwState;
  return (st.pulleys || []).filter(function(p){
    var d = (typeof componentDefs !== 'undefined' && componentDefs[p.type]) || {};
    return !p.driver && !d.isFeadIdler && !d.isFeadTensioner;
  });
}
function _fwGrafEksen(x0, x1, y0, y1, xv, yv, xAd, yAd, sagEksen){
  var h = '<g class="ve-fw-gr-izgara">';
  yv.forEach(function(t){ h += '<line x1="' + x0 + '" y1="' + t.y + '" x2="' + x1 + '" y2="' + t.y + '"/>'; });
  h += '</g><g class="ve-fw-gr-eksen"><line x1="' + x0 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + y0 + '"/>'
    + '<line x1="' + x0 + '" y1="' + y1 + '" x2="' + x0 + '" y2="' + y0 + '"/>'
    + (sagEksen ? '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x1 + '" y2="' + y0 + '"/>' : '') + '</g>'
    + '<g class="ve-fw-gr-yazi">';
  xv.forEach(function(t){ h += '<text x="' + t.x + '" y="' + (y0 + 14) + '" text-anchor="middle">' + t.m + '</text>'; });
  yv.forEach(function(t){ h += '<text x="' + (x0 - 5) + '" y="' + (t.y + 3) + '" text-anchor="end">' + t.m + '</text>'; });
  (sagEksen || []).forEach(function(t){ h += '<text x="' + (x1 + 5) + '" y="' + (t.y + 3) + '">' + t.m + '</text>'; });
  h += '<text x="' + x1 + '" y="' + (y0 + 28) + '" text-anchor="end">' + xAd + '</text>'
    + (yAd ? '<text x="' + (x0 + 6) + '" y="' + (y1 + 11) + '">' + yAd + '</text>' : '');
  return h + '</g>';
}
function _fwCevrimGrafik(b, W, H){
  var st = _fwState, s = st.solver || {}, duty = (s.duty || []).filter(function(r){ return _fwNum(r.rpm, NaN) > 0; });
  var bas = '<header class="ve-fw-gr-bas"><b>Çalışma çevrimi</b><span>' + duty.length + ' nokta · Σ %'
    + veSayi(duty.reduce(function(a, r){ return a + _fwNum(r.dcPct, 0); }, 0), 1) + '</span>';
  if(!duty.length) return bas + '</header>' + _fwMasaBos('Çevrim tablosu boş.');
  var yuk = _fwYukler(), seri = [];
  yuk.forEach(function(p){
    var kw = duty.map(function(r){
      var i = (s.duty || []).indexOf(r), e = _fwKwEff(b, st, i, p);
      return (e && e.kw !== null && Number.isFinite(e.kw)) ? e.kw : null;
    });
    if(kw.some(function(v){ return v !== null; })) seri.push({ p: p, kw: kw });
  });
  seri.forEach(function(sr, i){
    sr.renk = VE_FW_SERI[i % VE_FW_SERI.length];
    bas += '<span class="ve-fw-gr-lj"><i style="border-top-color:' + sr.renk + '"></i>'
      + _fwEsc(sr.p.name || _fwDefName(sr.p.type)) + ' kW</span>';
  });
  bas += '<span class="ve-fw-gr-lj"><i class="ve-fw-gr-lj-cubuk"></i>zaman payı</span></header>';
  var GH = H - 40, x0 = 46, x1 = W - (seri.length ? 44 : 14), y0 = GH - 34, y1 = 14;
  var rpm = duty.map(function(r){ return _fwNum(r.rpm, 0); });
  var rMin = Math.min.apply(null, rpm), rMax = Math.max.apply(null, rpm);
  var ad = _fwGuzelAdim(Math.max(1, rMax - rMin) * 1.2);
  var a0 = Math.floor((rMin - ad * 0.5) / ad) * ad, a1 = Math.ceil((rMax + ad * 0.5) / ad) * ad;
  if(a0 < 0) a0 = 0;
  var sx = function(v){ return x0 + (x1 - x0) * (v - a0) / Math.max(1, a1 - a0); };
  var pMax = Math.max.apply(null, duty.map(function(r){ return _fwNum(r.dcPct, 0); }));
  var pTop = Math.max(10, Math.ceil(pMax / 10) * 10);
  var kMax = 0;
  seri.forEach(function(sr){ sr.kw.forEach(function(v){ if(v !== null && v > kMax) kMax = v; }); });
  var kTop = Math.max(2, Math.ceil(kMax / 2) * 2);
  var sy = function(p){ return y0 - (y0 - y1) * p / pTop; };
  var sk = function(k){ return y0 - (y0 - y1) * k / kTop; };
  var r1 = function(n){ return Math.round(n * 10) / 10; };
  var xv = [], yv = [], kv = [];
  for(var v = a0; v <= a1 + 1e-9; v += ad) xv.push({ x: r1(sx(v)), m: veSayi(v, 0) });
  for(var q = 0; q <= 3; q++){
    yv.push({ y: r1(sy(pTop * q / 3)), m: '%' + veSayi(pTop * q / 3, 0) });
    kv.push({ y: r1(sk(kTop * q / 3)), m: veSayi(kTop * q / 3, 1) + (q === 3 ? ' kW' : '') });
  }
  var svg = '<svg class="ve-fw-gr" viewBox="0 0 ' + W + ' ' + GH + '" role="img"'
    + ' aria-label="Çalışma çevrimi: devre göre zaman payı ve aksesuar gücü">'
    + _fwGrafEksen(x0, x1, y0, y1, xv, yv, 'motor devri · RPM', '', seri.length ? kv : null);
  var gen = Math.max(4, Math.min(14, (x1 - x0) / (duty.length * 2.2)));
  svg += '<g class="ve-fw-gr-cubuk" data-ve="cevrim-cubuk">';
  duty.forEach(function(r){
    var X = sx(_fwNum(r.rpm, 0)), Y = sy(_fwNum(r.dcPct, 0));
    svg += '<rect x="' + r1(X - gen / 2) + '" y="' + r1(Y) + '" width="' + r1(gen) + '" height="' + r1(y0 - Y) + '"/>';
  });
  svg += '</g>';
  seri.forEach(function(sr){
    var pts = [];
    duty.forEach(function(r, i){ if(sr.kw[i] !== null) pts.push(r1(sx(_fwNum(r.rpm, 0))) + ',' + r1(sk(sr.kw[i]))); });
    svg += '<polyline class="ve-fw-gr-cizgi" data-ve="cevrim-kw" style="stroke:' + sr.renk + '" points="' + pts.join(' ') + '"/>';
  });
  return bas + svg + '</svg>';
}
// Model düğümünün ADI — sihirbazın kendi satırından (`wz-<anahtar>`), yoksa
// düğümün adı, o da yoksa çekirdeğin kasnak adı. Grafik ve lejant aynı adı
// kullanıcının Kasnaklar adımında gördüğü biçimde yazar.
function _fwDugumAdi(node, q){
  var id = node && node.id ? String(node.id) : '';
  if(id === 'wz-ten') return (_fwState.ten && _fwState.ten.name) || _fwTenAd();
  var key = id.indexOf('wz-') === 0 ? id.slice(3) : null;
  var p = key ? (_fwState.pulleys || []).filter(function(x){ return x.key === key; })[0] : null;
  if(p) return p.name || _fwDefName(p.type);
  return (node && node.customName) || (q && q.name) || '';
}
function _fwDevirGrafik(b, W, H){
  var st = _fwState, s = st.solver || {};
  var bas = '<header class="ve-fw-gr-bas"><b>Aksesuar devri ve katalog sınırları</b>';
  var rs = b && (b.sys || b.ratioSys);
  if(!rs || typeof FEADCore === 'undefined' || typeof FEADCore.accessoryRpm !== 'function')
    return bas + '</header>' + _fwMasaBos('Tahrik oranı henüz kurulamadı.');
  var duty = (s.duty || []).map(function(r){ return _fwNum(r.rpm, NaN); }).filter(function(v){ return v > 0; });
  var gov = _fwNum(s.governedRpm, NaN), over = _fwNum(s.overspeedRpm, NaN), idle = _fwNum(s.idleRpm, NaN);
  var uc = duty.concat([gov, over, idle].filter(function(v){ return v > 0; }));
  if(!uc.length) return bas + '</header>' + _fwMasaBos('Devir noktası yok.');
  var rMax = Math.max.apply(null, uc);
  var crk = (rs._crkIdx != null) ? rs._crkIdx : -1, ti = (b.sys && b.sys._tenIdx != null) ? b.sys._tenIdx : -1;
  var seri = [], yMax = 0;
  (rs.pulleys || []).forEach(function(q, i){
    if(i === crk || i === ti) return;
    var node = b.order && b.order[i], d = node && node.type && (typeof componentDefs !== 'undefined') ? componentDefs[node.type] || {} : {};
    if(d.isFeadIdler) return;
    var oran;
    try { oran = FEADCore.accessoryRpm(rs, i, 1000) / 1000; } catch(e){ oran = NaN; }
    if(!Number.isFinite(oran)) return;
    var lim = (typeof veFeadAccLimits === 'function') ? veFeadAccLimits(node) : null;
    var sr = { ad: _fwDugumAdi(node, b.sys.pulleys[i]), oran: oran, lim: lim };
    seri.push(sr);
    yMax = Math.max(yMax, oran * rMax);
    if(lim){ ['optimum', 'maxCont', 'maxPeak'].forEach(function(k){
      var v = lim[k] && lim[k].rpm; if(v > 0) yMax = Math.max(yMax, v); }); }
  });
  if(!seri.length) return bas + '</header>' + _fwMasaBos('Aksesuar yok.');
  seri.forEach(function(sr, i){
    sr.renk = VE_FW_SERI[i % VE_FW_SERI.length];
    bas += '<span class="ve-fw-gr-lj"><i style="border-top-color:' + sr.renk + '"></i>'
      + _fwEsc(sr.ad) + ' × ' + veSayi(sr.oran, 3) + '</span>';
  });
  if(!(gov > 0)) bas += '<span class="ve-fw-gr-not">governed devri yok</span>';
  bas += '</header>';
  var GH = H - 40, x0 = 56, x1 = W - 14, y0 = GH - 34, y1 = 14;
  var ad = _fwGuzelAdim(rMax * 1.1), a1 = Math.ceil(rMax * 1.08 / ad) * ad;
  var yad = _fwGuzelAdim(yMax * 1.1), yTop = Math.ceil(yMax * 1.1 / yad) * yad;
  var r1 = function(n){ return Math.round(n * 10) / 10; };
  var sx = function(v){ return x0 + (x1 - x0) * v / a1; };
  var sy = function(v){ return y0 - (y0 - y1) * v / yTop; };
  var xv = [], yv = [];
  for(var v = 0; v <= a1 + 1e-9; v += ad) xv.push({ x: r1(sx(v)), m: veSayi(v, 0) });
  for(var w = 0; w <= yTop + 1e-9; w += yad) yv.push({ y: r1(sy(w)), m: veSayi(w, 0) });
  var svg = '<svg class="ve-fw-gr" viewBox="0 0 ' + W + ' ' + GH + '" role="img"'
    + ' aria-label="Aksesuar devri, katalog sınırlarıyla">'
    + _fwGrafEksen(x0, x1, y0, y1, xv, yv, 'motor devri · RPM', 'aksesuar RPM', null);
  var dMax = duty.length ? Math.max.apply(null, duty) : NaN;
  seri.forEach(function(sr){
    var lim = sr.lim;
    if(lim){
      [['optimum', 'optimum', 've-fw-gr-sinir-opt'], ['maxCont', 'maks. sürekli', 've-fw-gr-sinir-cont'],
       ['maxPeak', 'maks. anlık', 've-fw-gr-sinir-peak']].forEach(function(k){
        var v = lim[k[0]] && lim[k[0]].rpm;
        if(!(v > 0)) return;
        svg += '<line class="' + k[2] + '" data-ve="devir-sinir" x1="' + x0 + '" y1="' + r1(sy(v)) + '" x2="' + x1 + '" y2="' + r1(sy(v)) + '"/>'
          + '<text class="' + k[2] + '-y" x="' + (x0 + 6) + '" y="' + r1(sy(v) - 4) + '">'
          + _fwEsc(sr.ad) + ' · ' + k[1] + ' ' + veSayi(v, 0) + '</text>';
      });
    }
    svg += '<line class="ve-fw-gr-cizgi" style="stroke:' + sr.renk + '" x1="' + r1(sx(0)) + '" y1="' + r1(sy(0))
      + '" x2="' + r1(sx(a1)) + '" y2="' + r1(sy(sr.oran * a1)) + '"/>';
    if(dMax > 0){
      var tepe = sr.oran * dMax, cont = lim && lim.maxCont && lim.maxCont.rpm;
      svg += '<circle class="ve-fw-gr-tepe" style="fill:' + sr.renk + '" cx="' + r1(sx(dMax)) + '" cy="' + r1(sy(tepe)) + '" r="4.5"/>';
      if(cont > 0)
        svg += '<text class="ve-fw-gr-tepe-y" x="' + r1(sx(dMax) - 8) + '" y="' + r1(sy(tepe) - 8) + '" text-anchor="end">'
          + 'tepe ' + veSayi(tepe, 0) + ' · pay %' + veSayi((cont - tepe) / cont * 100, 1) + '</text>';
    }
  });
  return bas + svg + '</svg>';
}

// (Kayış Yolu adımı KALDIRILDI — yeteneği Kasnaklar tablosuna taşındı;
//  gerekçesi VE_FW_STEPS'in yanında yazılı.)

function veFeadWizGergiGor(v){
  _fwGergiGor = (v === 'yol') ? 'yol' : 'yakin';
  _fwMasaYenile();
}

function _fwStepGergi(b){
  var st = _fwState, t = st.ten || {};
  var kilit = veFeadWizTenLocked(st);
  var kn = { kilit: kilit, kilitNot: VE_FW_TEN_LOCK_NOTE };
  var kl = function(o){ o.kilit = kilit; o.kilitNot = VE_FW_TEN_LOCK_NOTE; return o; };
  var h = '';

  // ── KÜNYE — tip + parçanın alanları + yay doğrusu ───────────────────────
  // Etiket YALNIZ kol boyu ve çalışma momenti (kullanıcı isteği, 2026-08-31):
  // kaynak rapor adı (`src`) mühendisin seçim yaparken kullandığı bir bilgi
  // değil, bir iz. ÖLÇÜLDÜ — düşürmek ayrımı bozmuyor: 14 kaydın 14'ü de
  // "kol X mm · Y Nm" ile TEKİL (en yakın iki kayıt 22,20 ↔ 22,21 Nm).
  // Etiket üreteci TEK YERDE (veFeadTenLabel, fead-tensioners.js) — panel de
  // aynı listeyi basıyor, iki yüzey ayrışmasın.
  //
  // KÜNYE SEÇİLİYKEN PARÇA ALANLARI KİLİTLİ — `readonly` + K, gizli DEĞİL
  // (kullanıcı: *"değerler değiştirilmemeli"*, *"görünmesin"* değil). Yay
  // doğrusu aynı alanlardan çizilir; ikinci bir kaynak okumaz.
  var ic = '';
  if(typeof veFeadTensionerList === 'function'){
    var liste = veFeadTensionerList();
    var opts = [['', '— elle gir —']].concat(liste.map(function(r){
      return [r.key, (typeof veFeadTenLabel === 'function') ? veFeadTenLabel(r) : r.key];
    }));
    ic += _fwField('Tip', '<select class="ve-fw-inp" onchange="veFeadWizTenLib(this.value)">'
      + opts.map(function(o){
          return '<option value="' + _fwEsc(o[0]) + '"'
               + (String(o[0]) === String(t.tenLib || '') ? ' selected' : '') + '>'
               + _fwEsc(o[1]) + '</option>'; }).join('') + '</select>');
  }
  ic += _fwGrid([
    _fwField('Kol boyu [mm]', _fwInp('ten.armLen', kl({ ph: '90' }))),
    _fwField('Kasnak Ø OD [mm]', _fwInp('ten.od', kl({ ph: '75' }))),
    _fwField('Ön yük [Nm]', _fwInp('ten.preload', kl({ ph: '8.60' }))),
    _fwField('Yay katsayısı [Nm/°]', _fwInp('ten.kArm', kl({ ph: '0.480' }))),
    _fwField('Çalışma momenti [Nm]', _fwInp('ten.meanLoad', kl({ ph: '22.07' }))),
    _fwField('Temas tarafı', _fwSelHTML('ten.contact',
      [['back', 'Sırttan'], ['grooved', 'Kaburgalı']], t.contact || 'back', kn))], 2);
  ic += _fwYayGrafikHTML(t, b);
  h += _fwCard('Künye', 'var(--accent-primary)', ic);

  // ── MONTAJ — TEK KOORDİNAT: avara merkezi + kol yönü ────────────────────
  // Gergi tanımı (AVARA MERKEZİ GİRDİ, MONTAJ KONUMU ÇIKTI): X/Y kasnağın
  // merkezi, kol yönü girdi; gövdenin montaj noktası aşağıda TÜRER.
  h += _fwCard('Montaj', 'var(--accent-danger)',
      '<div class="ve-fw-field"><span class="ve-fw-lbl">Avara kasnağının merkezi [mm]</span>'
    + _fwGrid([_fwInp('ten.cenX', { ph: 'X' }), _fwInp('ten.cenY', { ph: 'Y' })], 2) + '</div>'
    + _fwField('Kol yönü [°]', _fwArmAngleField(t)));

  h += _fwCard('Titreşim', 'var(--text-secondary)',
      _fwGrid([_fwField('Kol ataleti [kg·m²]', _fwInp('ten.armInertia', { ph: '0.0009' })),
               _fwField('Kütle [kg]', _fwInp('ten.pulleyMass', { ph: '0.80' })),
               _fwField('Load stop [°]', _fwInp('ten.loadStopRelDeg', { ph: '62.4' }))], 3));

  // ── TÜRETİLEN — atölyeye giden sayı + gerginlik + göbek yükü ────────────
  // Montaj konumu panelin "Kol Künyesi" okumasının AYNI üreticisinden
  // (`veFeadTensionerPivot`); ikinci bir formül iki yüzeyi sessizce
  // ayrıştırırdı. DENKLEM KULLANICININ YAZDIĞI AÇIYLA (φ = gösterilen açı):
  // θ mutlaktı ve kendi sayısını denkleme koyan kullanıcı 2a kadar uzakta
  // YANLIŞ noktayı buluyordu (c − a·u(θ) = c + a·u(φ), u(φ) = −u(θ)).
  // KaTeX: kullanıcı isteği 2026-09-04. Göbek yükü çekirdeğin gergi
  // durumundan (FEADCore.tensionerState, Mean).
  var _piv = (typeof veFeadTensionerPivot === 'function')
    ? veFeadTensionerPivot({ cenX: _fwNum(t.cenX, NaN), cenY: _fwNum(t.cenY, NaN),
                             armLen: _fwNum(t.armLen, NaN),
                             armMeanDeg: _fwNum(t.armMeanDeg, NaN) })
    : null;
  var tr = '<div class="ve-fw-reads">';
  if(_piv){
    tr += _fwRead('Gövdenin montaj konumu', '(' + veSayi(_piv[0], 2) + '; ' + veSayi(_piv[1], 2) + ') mm')
      + '<div class="ve-fw-denklem">'
      + _fwTeX('\\vec{p} = \\vec{c} + a\\,(\\cos\\varphi,\\ \\sin\\varphi)',
               'p = c + a·(cos φ, sin φ)   ·   φ = kol yönü') + '</div>';
  } else {
    // KART KAYBOLMAZ, EKSİĞİ SÖYLER. `veFeadTensionerPivot` girdilerden biri
    // eksikken null döndürüyor; gerginin sayıları 2026-09-22'de tohumdan
    // çıkınca ATÖLYEYE GİDEN tek denetim sayısı sessizce yok oluyordu.
    var e = [];
    if(!Number.isFinite(_fwNum(t.cenX, NaN)) || !Number.isFinite(_fwNum(t.cenY, NaN))) e.push('avara merkezi (X/Y)');
    if(!Number.isFinite(_fwNum(t.armLen, NaN))) e.push('kol boyu');
    if(!Number.isFinite(_fwNum(t.armMeanDeg, NaN))) e.push('kol yönü');
    tr += _fwRead('Gövdenin montaj konumu', 'Hesaplanamadı — eksik: ' + (e.length ? e.join(' · ') : 'geçersiz değer'));
  }
  if(b && b.ok && Number.isFinite(b.springTensionN))
    tr += _fwRead('Tasarım gerginliği', _fwFmt(b.springTensionN, 1) + ' N');
  var gv = _fwGergiVeri(b);
  if(gv && gv.st && Number.isFinite(gv.st.hubloadN))
    tr += _fwRead('Göbek yükü', veSayi(gv.st.hubloadN, 1) + ' N · ' + veSayi(gv.st.hubDirDeg, 1) + '°');
  h += _fwCard('Türetilen', 'var(--accent-warning)', tr + '</div>');
  return h;
}
// ── DENKLEM DİZGİSİ (KaTeX) ───────────────────────────────────────────────
//
// Kullanıcı isteği (2026-09-04): *"'gövdenin montaj konumu' kısmında alt
// tarafta yazan denklem KaTeX formatında olsun. Çok amatör duruyor."*
//
// KaTeX PROGRAMIN İÇİNDE GÖMÜLÜ ama TALEP ÜZERİNE açılıyor (~1 MB, rapor
// varlıklarıyla ORTAK — `window.MNT_REPORT_ASSETS`). Sihirbaz açılırken o
// megabaytı ödemek, tek bir denklem için bütün adımları yavaşlatmak olurdu.
// Bu yüzden:
//   · HTML her zaman düz metin YEDEĞİYLE basılıyor (yükleme başarısız olsa
//     ya da hiç gelmese bile denklem OKUNUR kalır — boş bir kutu değil),
//   · varlık geldiğinde `veFeadWizTeXPaint` yerinde dizip yedeği değiştiriyor.
// Yani KaTeX bir SÜS değil bir YÜKSELTME: yokluğunda yüzey çalışmaya devam
// ediyor.
function _fwTeX(tex, duz){
  return '<span class="ve-fw-tex" data-tex="' + _fwEsc(tex) + '">' + _fwEsc(duz) + '</span>';
}

var _fwTeXYukleniyor = false;
// Sayfadaki dizilmemiş denklemleri dizer; varlık yoksa bir kez yüklemeyi dener.
function veFeadWizTeXPaint(){
  if(typeof document === 'undefined') return;
  var hedef = document.querySelectorAll('.ve-fw-tex[data-tex]:not([data-tex-ok])');
  if(!hedef.length) return;
  if(typeof katex === 'undefined' || !katex.render){
    if(_fwTeXYukleniyor || typeof _frEnsureAssets !== 'function') return;
    _fwTeXYukleniyor = true;
    try {
      _frEnsureAssets(function(ok){
        _fwTeXYukleniyor = false;
        if(!ok || typeof window === 'undefined' || !window.MNT_REPORT_ASSETS) return;
        _fwTeXInject(window.MNT_REPORT_ASSETS);
        veFeadWizTeXPaint();
      });
    } catch(e){ _fwTeXYukleniyor = false; }
    return;
  }
  Array.prototype.forEach.call(hedef, function(el){
    try {
      katex.render(el.getAttribute('data-tex'), el,
                   { throwOnError: false, displayMode: false });
      el.setAttribute('data-tex-ok', '1');
    } catch(e){ /* yedek metin yerinde kalır */ }
  });
}
// KaTeX'in CSS'i ve betiği sayfaya BİR KEZ enjekte edilir — ağdan hiçbir şey
// çekilmiyor (çevrimdışı kuralı). Metin yüzü ENJEKTE EDİLMEZ: sayfa zaten
// arayüzün yüzüyle (Inter) yazıyor; eskiden rapor paketinin üç yüzü de
// (Archivo · Source Serif 4 · IBM Plex Mono) buraya taşınıyordu.
function _fwTeXInject(A){
  if(typeof document === 'undefined' || document.getElementById('ve-fw-katex')) return;
  var st = document.createElement('style');
  st.id = 've-fw-katex';
  st.textContent = (A.katexCss || '');
  document.head.appendChild(st);
  if(typeof katex === 'undefined' && A.katexJs){
    var sc = document.createElement('script');
    sc.textContent = A.katexJs;
    document.head.appendChild(sc);
  }
}

// KOL YÖNÜ ALANI — nispi/işaretli gösterim + seçici düğmesi.
//
// Alan SAKLANANI DEĞİL GÖSTERİLENİ tutuyor (bkz. veFeadArmShownDeg): kullanıcı
// avara merkezini girdi, şimdi gövdenin ona göre nerede olduğunu söylüyor.
// Çeviri tek üreticiden ve gidiş-dönüş birebir.
function _fwArmAngleField(t){
  var abs = _fwNum(t.armMeanDeg, NaN);
  var g = (typeof veFeadArmShownDeg === 'function') ? veFeadArmShownDeg(abs) : NaN;
  return '<span class="ve-fw-ang-cell">'
    + '<input type="text" inputmode="decimal" class="ve-fw-inp"'
      + ' value="' + _fwEsc(Number.isFinite(g) ? Math.round(g * 10000) / 10000 : '') + '"'
      + ' placeholder="164" oninput="veFeadWizArmShown(this.value)">'
    + '<button type="button" class="ve-fw-mini ve-fw-ang-btn" title="Koordinat düzleminde seç"'
      + ' onclick="veFeadWizAngOpen()">' + veIkon('ruler') + '</button></span>';
}
// GÖSTERİLEN → SAKLANAN. Alan boşaltılırsa kayıt da silinir: 0 yazmak
// "kullanıcı 0° seçti" demek olurdu, oysa alan BOŞ.
function veFeadWizArmShown(v){
  if(!_fwState) return;
  if(!_fwState.ten) _fwState.ten = {};
  var d = _fwNum(v, NaN);
  if(!Number.isFinite(d)) delete _fwState.ten.armMeanDeg;
  else _fwState.ten.armMeanDeg = Math.round(veFeadArmFromShown(d) * 10000) / 10000;
  veFeadWizLiveSoon();
}

// Sorun satırının ikonu (karar 10·B): hata çarpı, uyarı üçgen. Eskiden '✗' ve
// '!' KARAKTERİ yazılıyordu; listeler aynı ikonu buradan alır.
function _fwSorunIkon(tur){
  return veIkon(tur === 'err' ? 'x' : 'alert-triangle');
}

function _fwRead(et, deg){
  return _fwReadHTML(_fwEsc(et), deg);
}
// ETİKETİ KAÇIŞLAMAYAN sürüm — adı bunu SÖYLÜYOR. `_fwRead` kaçışlamaya devam
// ediyor ve varsayılan o; bu üretici yalnız etiketi PROGRAMIN KENDİSİ ürettiği
// yerde çağrılıyor (bugün tek yer: KaTeX denklemi). Sessizce kaçışsız bir
// `_fwRead` yapmak, kullanıcı metni taşıyan onlarca okumayı da açardı.
//
// ÖLÇÜLDÜ: denklem ilk denemede hiç görünmedi — `_fwRead(_fwTeX(...))` çağrısı
// span'i metne çeviriyordu ve ekranda ham etiket bile çıkmıyordu.
function _fwReadHTML(etHtml, deg, ikon){
  return '<div class="ve-fw-read"><span>' + etHtml + '</span><b>' + (ikon ? veIkon(ikon) + ' ' : '')
    + _fwEsc(deg) + '</b></div>';
}
// Türetilen boyun KORD karşılığı (d_w = d_b + 2·h_b çizgisi; CAD eskizi bunu
// ölçer). Sayı köprüden; profil kaydı tanınmıyorsa satır hiç yazılmaz.
function _fwKordRead(b){
  var x = (typeof veFeadBoyCizgileri === 'function' && b && b.sys && b.sys.belt)
    ? veFeadBoyCizgileri(b.beltLengthMm, b.sys.belt) : null;
  return (x && Number.isFinite(x.dw)) ? _fwRead('Kord boyu (CAD çizgisi)', _fwFmt(x.dw, 1) + ' mm') : '';
}

// ════════════════════════════════════════════════════════════════════════════
//  KOL AÇISI SEÇİCİ — küçük koordinat düzlemi
// ════════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-09-01): *"o satırın üstüne ufak bir buton koyacağız ve
// ufak bir koordinat düzlemi açılacak. Açılan koordinat düzleminde de otomatik
// gergi belirecek ve kullanıcı faresini kullanarak oradan açı tayin edecek…
// Sol tık yaptığı zaman 'tam açı değerini' soran ufak bir doldurulabilir
// kutucuk olacak."*
//
// NEDEN İŞE YARIYOR: kol açısı, avara merkezi girildikten sonra kalan TEK
// serbestlik derecesi ve bir PAKETLEME kararı — kayış yolunu hiç
// değiştirmiyor (ölçüldü: 6 sistem × 548 açı, en büyük fark 4,55e−13 mm).
// Yani doğru cevabı hesap veremez, ancak tasarımcı verir; ona da sayı yazmak
// yerine motorun üstünde bir yer göstermek doğal geliyor. Seçim aynı anda
// GÖVDENİN MONTAJ KONUMUNU da belirliyor (p = c − a·(cosθ, sinθ)) ve pencere
// onu canlı yazıyor — kullanıcının *"muhtemel bir pivot noktası belirlemiş
// olacak"* dediği şey bu.
//
// AÇI DİLİ YÖN GÜLÜYLE AYNI (bkz. veFeadArmShownDeg): merkezden pivota,
// 0 = +X, CCW artı, işaretli. Saklanan alan mutlak kalıyor.
//
// ÇİZİM SAF FONKSİYON: DOM'a dokunmuyor, bu yüzden Node'da ölçülebiliyor.
var VE_FW_ANG = null;          // { key:'ten', shown:Number } — açık pencere

// SAHNE: kasnaklar, gergi ve — çözülüyorsa — GERÇEK KAYIŞ YOLU.
//
// Kullanıcı isteği (2026-09-02): *"Kayış görünsün, tıpkı topoloji üzerindeki
// kanvas gibi olsun. Ama yazılar olmadan tabiki."*
//
// KAYIŞ YOLU KOL AÇISINDAN BAĞIMSIZ (ölçüldü: 6 sistem × 548 açı, en büyük
// fark 4,55e−13 mm) — avara merkezi sabit olduğu için. Bu yüzden yol BİR KEZ
// çözülüp saklanıyor; fare gezerken yalnız kol yeniden çiziliyor. Her karede
// yeniden çözmek 6 ms'lik bir çözümü fare hızında koşturmak olurdu.
//
// ÇÖZÜM YOKSA sahne yine kuruluyor (çemberler + kol çemberi): kullanıcı açıyı
// tam da model yarımken arıyor olabilir ve pencereyi hiç açamamak daha kötü.
function veFeadWizAngScene(st){
  st = st || _fwState;
  if(!st) return null;
  var t = st.ten || {};
  var cx = _fwNum(t.cenX, NaN), cy = _fwNum(t.cenY, NaN), a = _fwNum(t.armLen, NaN);
  if(!Number.isFinite(cx) || !Number.isFinite(cy) || !(a > 0)) return null;
  var od = _fwNum(t.od, 75);
  var digerleri = [];
  (st.pulleys || []).forEach(function(p){
    var x = _fwNum(p.x, NaN), y = _fwNum(p.y, NaN);
    if(Number.isFinite(x) && Number.isFinite(y))
      digerleri.push({ x: x, y: y, r: _fwNum(p.od, 80) / 2 });
  });

  // GERÇEK KAYIŞ — çözülmüş geometriden, çizici kartla AYNI (veFeadBeltPathD).
  var geom = null;
  var b = _fwBuild || veFeadWizBuild();
  if(b && b.ok && b.sys && typeof FEADCore !== 'undefined'){
    try {
      var rel = FEADCore.meanRel ? FEADCore.meanRel(b.sys) : 0;
      geom = FEADCore.tensionerState(b.sys, rel).geom;
    } catch(e){ geom = null; }
  }
  // OLANAKLI AÇI BANDI — künyenin KENDİ verisinden türüyor.
  // Kullanıcı isteği (2026-09-04): *"katalogdan seçtiğimiz gergi tipleri için
  // de, diyagramdan otomatik olarak konumu görünsün."* Künye bir KONUM
  // yazmıyor (`veFeadTensionerApply` kol boyunu, yayı ve kasnağı yazar; montaj
  // açısı tasarımcının kararıdır) — ama kol boyu + yay künyesi, kolun fiziksel
  // olarak HANGİ açılarda durabileceğini belirliyor. Diyagramda görünmesi
  // gereken şey bu: künyenin erişebildiği yay.
  //
  // Bant KÖPRÜDEN geliyor (`veFeadArmBand`), burada yeniden hesaplanmıyor —
  // ikinci bir ölçüt iki yüzeyin sessizce ayrışması demekti.
  var bant = null;
  if(b && b.ok && typeof veFeadArmBand === 'function'){
    try { bant = veFeadArmBand(b); } catch(e){ bant = null; }
    if(bant && !bant.ok) bant = null;
  }
  return { cx: cx, cy: cy, armLen: a, r: od / 2, others: digerleri, geom: geom, band: bant };
}

// AÇI SEÇİCİSİ DE ÖN GÖRÜNÜŞTE ÇİZER — yoksa aynı sihirbazın iki resmi ters.
//
// Bu, kartın (`veFeadLayoutSVG`) aynalanmasının doğurduğu SESSİZ bir kusurdu:
// seçici kendi çizicisi ve mm düzleminde çiziyordu, yani 6. adımın açı
// seçicisiyle hemen altındaki "Kayış Yolu" kartı BİRBİRİNİN AYNASI oluyordu.
// İkisi de ayrı ayrı makul görünür; hata ancak yan yana konunca fark edilir.
//
// SAHNE AYNALANIR, AÇI VERİ DÜZLEMİNDE KALIR. Ayna faktörü `data-mir` ile
// DOM'a yazılıyor ve ters çevirici (`veFeadWizAngFromPoint`) onu okuyup
// ekrandan okunan açıyı veri düzlemine geri çeviriyor. Yazılmasaydı fareyle
// seçilen açı çizilenin AYNASI olurdu — sessiz, çünkü sayı makul kalır.
//
// Kayış için `veFeadMirrorGeomX` kullanılıyor (kartın kullandığı AYNI saf
// fonksiyon): `d` işaretini de çevirdiği için sarım yayları kasnağın içinden
// geçmiyor. İkinci bir aynalama yazmak, kartla seçicinin sessizce ayrışacağı
// tek yer olurdu.
// ÇİZİM AYNALANMAZ — bu yüzden sabit. Fonksiyon duruyor çünkü kart ile
// seçicinin AYNI cevabı kullanması bir kapı (fead-wizard.test.js).
function _fwMir(){ return 1; }

// mm → SVG. +Y mm'de YUKARI, SVG'de aşağı → çevrilir (kanvasın kuralının
// aynısı). Ölçek bütün sahneyi kabına oturtur; `zoom` onu çarpar.
// `hoverDeg` HAYALET: farenin gösterdiği aday açı. `shownDeg` SEÇİLEN açı.
// İkisinin AYRI olması bu turun asıl düzeltmesi — eskiden fare `shown`'ı
// doğrudan eziyordu, yani tıklamanın izi kalmıyor ve kutuya yazılan değer
// fare oynayınca sessizce siliniyordu (kullanıcı ölçtü: ok 35,80° iken kutu
// 48,74 yazıyordu).
function veFeadWizAngSVG(sc, shownDeg, zoom, W, H, hoverDeg){
  if(!sc) return '';
  W = W || 420; H = H || 320;
  // ÇİZİM AYNALANMAZ (bkz. fead-model.js → "TEK ÇERÇEVE VAR"). `mir` sabit
  // +1; `data-mir` niteliği fare→açı çevirisinin okuduğu sözleşme olduğu için
  // duruyor, ama artık hiçbir zaman −1 olmuyor.
  var mir = 1;
  var z = (_fwNum(zoom, 1) > 0) ? _fwNum(zoom, 1) : 1;
  var pad = 22;
  var minX = sc.cx - sc.armLen, maxX = sc.cx + sc.armLen;
  var minY = sc.cy - sc.armLen, maxY = sc.cy + sc.armLen;
  sc.others.forEach(function(o){
    minX = Math.min(minX, o.x - o.r); maxX = Math.max(maxX, o.x + o.r);
    minY = Math.min(minY, o.y - o.r); maxY = Math.max(maxY, o.y + o.r);
  });
  var k = Math.min((W - 2 * pad) / Math.max(1e-6, maxX - minX),
                   (H - 2 * pad) / Math.max(1e-6, maxY - minY)) * z;
  // Sahnenin ORTASI kabın ortasına oturur — yakınlaştırma merkeze doğru olur,
  // sol üste doğru değil.
  var ox = W / 2 - ((minX + maxX) / 2) * k;
  var oy = H / 2 + ((minY + maxY) / 2) * k;
  function X(mm){ return ox + mm * k; }
  function Y(mm){ return oy - mm * k; }
  function f(v){ return Math.round(v * 100) / 100; }

  // ÖLÇEK KÜNYESİ ÇİZİM YUVARLAMASINDAN AYRI: `f` iki ondalığa yuvarlıyor
  // (çizim için yeter) ama fare→açı çevirisi bu sayılarla mm'ye dönüyor —
  // iki ondalık, yakınlaştırılmış bir sahnede gözle görülür bir kayma demek.
  function g(v){ return Math.round(v * 1e6) / 1e6; }
  var h = '<svg class="ve-fw-ang-svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%"'
    + ' data-k="' + g(k) + '" data-ox="' + g(ox) + '" data-oy="' + g(oy) + '"'
    + ' data-cx="' + g(sc.cx) + '" data-cy="' + g(sc.cy) + '" data-mir="' + mir + '">';

  // ── KASNAKLAR — kanvastaki gibi dolgulu daireler, ADSIZ ────────────────
  sc.others.forEach(function(o){
    h += '<circle cx="' + f(X(o.x)) + '" cy="' + f(Y(o.y)) + '" r="' + f(o.r * k) + '"'
      + ' fill="var(--bg-tertiary)" stroke="var(--border-hover)" stroke-width="1.2"/>';
  });

  // ── KAYIŞ — kart ve raporla AYNI üreticiden ────────────────────────────
  if(sc.geom && typeof veFeadBeltPathD === 'function'){
    var d = veFeadBeltPathD(sc.geom, X, Y, k, f);
    if(d) h += '<path d="' + d + '" fill="none" stroke="var(--accent-warning)"'
      + ' stroke-width="2.4" stroke-linejoin="round"/>';
  }

  var C = [X(sc.cx), Y(sc.cy)], R = sc.armLen * k;

  // ── AÇI EKSENLERİ — MONTAJ NOKTASININ geometrik yeri üzerinde, soluk ───
  // (Kesikli çember kolun gezindiği yer DEĞİL: merkez sabit, kol boyu sabit,
  //  dolayısıyla çember gövdenin montaj noktasının olanaklı yerleridir.)
  h += '<circle cx="' + f(C[0]) + '" cy="' + f(C[1]) + '" r="' + f(R) + '"'
    + ' fill="none" stroke="var(--border-color)" stroke-dasharray="3 4"/>'
    + '<line x1="' + f(C[0] - R - 8) + '" y1="' + f(C[1]) + '" x2="' + f(C[0] + R + 8)
    + '" y2="' + f(C[1]) + '" stroke="var(--border-color)" stroke-width="0.8"/>'
    + '<line x1="' + f(C[0]) + '" y1="' + f(C[1] - R - 8) + '" x2="' + f(C[0])
    + '" y2="' + f(C[1] + R + 8) + '" stroke="var(--border-color)" stroke-width="0.8"/>';
  // ETİKETLER DE AYNALANIR: aynada veri düzleminin 0°'si ekranda SOLA bakar.
  // Bırakılsaydı resim aynalı, açı okuması aynalı DEĞİL olurdu — kullanıcı
  // 0°'yi yanlış tarafta arardı (yön gülünde ölçülmüş sınıfın aynısı).
  var sag = (mir < 0) ? '180' : '0', sol = (mir < 0) ? '0' : '180';
  [[sag, C[0] + R + 11, C[1] + 3, 'start'], ['90', C[0], C[1] - R - 11, 'middle'],
   [sol, C[0] - R - 11, C[1] + 3, 'end'], ['-90', C[0], C[1] + R + 15, 'middle']]
    .forEach(function(e){
      h += '<text x="' + f(e[1]) + '" y="' + f(e[2]) + '" text-anchor="' + e[3]
        + '" font-size="9" fill="var(--text-muted)">' + veSayi(e[0]) + '°</text>';
    });

  // ── OLANAKLI AÇI BANDI — künyenin erişebildiği yay ─────────────────────
  // Kullanıcı isteği (2026-09-04): künye seçilince konumun diyagramdan
  // görünmesi. Künye bir KONUM yazmıyor; kol boyunu ve yayı yazıyor, ve
  // kolun hangi açılarda durabileceği ONLARDAN türüyor. Çizilen şey bu:
  // yeşil yaylar = servis aralığını taşıyabilen açılar.
  //
  // ÖRNEKLER KÖPRÜDEN (`veFeadArmBand`) — burada ölçüt YENİDEN KURULMUYOR.
  // Örnek `deg`i MUTLAK açı (pivottan merkeze); gösterim nispi, o yüzden
  // `veFeadArmShownDeg` ile çevrilip sonra ekran açısına gidiyor.
  if(sc.band && sc.band.samples && sc.band.samples.length
     && typeof veFeadArmShownDeg === 'function'){
    var adim = _fwNum(sc.band.step, 5);
    var Rb = R + 5;
    var yay = '';
    sc.band.samples.forEach(function(x){
      if(!x || !x.ok) return;
      var d0 = veFeadArmShownDeg(x.deg);
      if(!Number.isFinite(d0)) return;
      // Örnek bir NOKTA değil bir ARALIK temsil ediyor (genişliği `step`);
      // nokta olarak çizmek bandı olduğundan dar gösterirdi.
      var e0 = (mir < 0) ? (180 - d0) : d0;
      var e1 = e0 + ((mir < 0) ? -adim : adim);
      var r0 = e0 * Math.PI / 180, r1 = e1 * Math.PI / 180;
      yay += '<path data-ve="band-arc" d="M' + f(C[0] + Rb * Math.cos(r0)) + ' '
          + f(C[1] - Rb * Math.sin(r0)) + ' A' + f(Rb) + ' ' + f(Rb) + ' 0 0 '
          + ((mir < 0) ? 1 : 0) + ' '
          + f(C[0] + Rb * Math.cos(r1)) + ' ' + f(C[1] - Rb * Math.sin(r1)) + '"'
          + ' fill="none" stroke="var(--accent-success)" stroke-width="3.4"'
          + ' stroke-linecap="butt" opacity="0.32"/>';
    });
    h += yay;
  }

  // ── GERGİ AVARASI — seçimin döndüğü nokta ──────────────────────────────
  h += '<circle cx="' + f(C[0]) + '" cy="' + f(C[1]) + '" r="' + f(sc.r * k) + '"'
    + ' fill="var(--accent-tint-10)" stroke="var(--accent-primary)" stroke-width="1.6"/>';

  // ── HAYALET OK — farenin gösterdiği aday ───────────────────────────────
  // Kullanıcı isteği (2026-09-04): *"diyagram üzerinde bir yere tıkladığımda
  // ok hayalet şekilde görülmüyor."* Aday ile seçim artık AYRI: hayalet soluk
  // ve ince, seçim dolu ve kalın. Aday seçimle çakışıyorsa çizilmez — üst
  // üste iki ok "iki seçim var" gibi okunurdu.
  var hov = _fwNum(hoverDeg, NaN);
  if(Number.isFinite(hov) && Math.abs(hov - _fwNum(shownDeg, NaN)) > 0.25
     && typeof veFeadArmArrowSVG === 'function'){
    var he = (mir < 0) ? (180 - hov) : hov;
    var hr = he * Math.PI / 180;
    var HP = [C[0] + R * Math.cos(hr), C[1] - R * Math.sin(hr)];
    h += '<g data-ve="arm-ghost" opacity="0.38">'
      + veFeadArmArrowSVG(C, HP, { f: f, kalinlik: 2, ucBoy: 9, ucGen: 3.6 })
      + '</g>'
      + '<text x="' + f(C[0] + (R + 16) * Math.cos(hr)) + '" y="'
      + f(C[1] - (R + 16) * Math.sin(hr) + 4) + '" text-anchor="middle"'
      + ' font-size="10" fill="var(--accent-success)" opacity="0.6">'
      + _fwFmt(hov, 1) + '°</text>';
  }

  // ── KOL: YEŞİL OK ──────────────────────────────────────────────────────
  // Kullanıcı isteği (2026-09-02): *"Kol açısını seçtiğimizde de ekranda yeşil
  // bir ok olarak görünsün."* Ok ucu MERKEZDEN PİVOTA bakıyor, yani seçilen
  // yönü gösteriyor — kolun kendi çizgisi değil, SEÇİM bu.
  var deg = _fwNum(shownDeg, NaN);
  if(Number.isFinite(deg)){
    // ÇİZİM EKRAN AÇISIYLA — aynada θ, 180°−θ olarak görünür. Sayı etiketi
    // yine VERİ düzlemindeki açıyı basıyor (kullanıcının girdiği değer odur).
    var ekran = (mir < 0) ? (180 - deg) : deg;
    var rad = ekran * Math.PI / 180;
    var ux = Math.cos(rad), uy = -Math.sin(rad);           // SVG'de y aşağı
    var P = [C[0] + R * ux, C[1] + R * uy];
    // OK TEK ÜRETİCİDEN (`veFeadArmArrowSVG`, js/cp-fead.js): özet şeması da
    // aynı çağrıyı yapıyor. İki ayrı çizim, iki ayrı dil demekti ve tam olarak
    // öyle olmuştu — kullanıcı seçimini şemada tanıyamadı.
    h += (typeof veFeadArmArrowSVG === 'function')
      ? veFeadArmArrowSVG(C, P, { f: f, kalinlik: 3, ucBoy: 11, ucGen: 4.6 })
      : '';
    // Açı yayı ve sayısı — seçimin işaretini gözle gösteriyor.
    var ry = Math.min(R * 0.4, 44);
    h += '<path d="M' + f(C[0] + ry * (mir < 0 ? -1 : 1)) + ' ' + f(C[1])
      + ' A' + f(ry) + ' ' + f(ry) + ' 0 '
      + (Math.abs(deg) > 180 ? 1 : 0) + ' ' + (deg >= 0 ? (mir < 0 ? 1 : 0) : (mir < 0 ? 0 : 1)) + ' '
      + f(C[0] + ry * Math.cos(rad)) + ' ' + f(C[1] - ry * Math.sin(rad)) + '"'
      + ' fill="none" stroke="var(--accent-success)" stroke-width="1.2" stroke-dasharray="2 2"/>'
      + '<text x="' + f(C[0] + ry * 0.66 * Math.cos((rad + (mir < 0 ? Math.PI : 0)) / 2))
      + '" y="' + f(C[1] - ry * 0.66 * Math.sin((rad + (mir < 0 ? Math.PI : 0)) / 2) - 4)
      + '" text-anchor="middle"'
      + ' font-size="12" font-weight="700" fill="var(--accent-success)">'
      + _fwFmt(deg, 1) + '°</text>';
  }
  return h + '</svg>';
}

function veFeadWizAngHTML(){
  var sc = veFeadWizAngScene();
  if(!sc)
    // ESKİ CÜMLE FİZİĞİ TERS ANLATIYORDU: *"kol o merkez etrafında dönüyor."*
    // Kol PİVOT etrafında döner; avara merkezi kolun UCUDUR. Seçici, gövdenin
    // montaj noktasının olanaklı yerini çiziyor — kolun gezindiği çemberi
    // değil. Bu iki cümle diyagramın yanlış okunmasını doğrudan öğretiyordu.
    return '<div class="ve-fw-issue ve-fw-issue-err">' + _fwSorunIkon('err') + ' Açı seçmek için önce '
      + '<b>avara merkezi (X/Y)</b> ve <b>kol boyu</b> gerekli — gövdenin montaj '
      + 'noktası o merkezden kol boyu kadar uzakta olmak zorunda.</div>';
  var d = VE_FW_ANG ? VE_FW_ANG.shown : NaN;
  var piv = null;
  if(Number.isFinite(d) && typeof veFeadArmFromShown === 'function'
     && typeof veFeadTensionerPivot === 'function')
    piv = veFeadTensionerPivot({ cenX: sc.cx, cenY: sc.cy, armLen: sc.armLen,
                                 armMeanDeg: veFeadArmFromShown(d) });
  var z = VE_FW_ANG ? VE_FW_ANG.zoom : 1;
  return '<div class="ve-fw-ang-wrap" id="ve-fw-ang-plot">'
      + veFeadWizAngSVG(sc, d, z, undefined, undefined, VE_FW_ANG ? VE_FW_ANG.hover : null)
      + '<div class="ve-fw-ang-zoom">'
        + '<button type="button" class="ve-fw-mini" title="Uzaklaş"'
          + ' onclick="event.stopPropagation(); veFeadWizAngZoom(-1)">' + veIkon('minus') + '</button>'
        + '<button type="button" class="ve-fw-mini" title="Sığdır"'
          + ' onclick="event.stopPropagation(); veFeadWizAngZoom(0)">' + veIkon('maximize') + '</button>'
        + '<button type="button" class="ve-fw-mini" title="Yakınlaş"'
          + ' onclick="event.stopPropagation(); veFeadWizAngZoom(1)">' + veIkon('plus') + '</button>'
      + '</div></div>'
    // YAYIN NE OLDUĞU DİYAGRAMIN YANINDA YAZILI — kullanıcı sordu
    // (2026-09-04): *"kasnağın etrafında yeşil yaylar çıkıyor. Bunun anlamı
    // ne?"* Bir açıklama paragrafı değil, bir GÖSTERGE (legend): renk ile
    // anlamı eşleyen tek satır. Bant yoksa satır da yok.
    + (sc.band && sc.band.samples && sc.band.samples.length
        ? '<div class="ve-fw-legend">'
          + '<span class="ve-fw-legend-arc"></span>'
          + 'Yeşil yay: kolun bu açıda durabildiği aralık — kayış sarımı ve '
          + 'yay servis aralığı birlikte sağlanıyor. Boşluklar, kolun oraya '
          + 'gelemediği ya da gelirse çözümün servis aralığından çıktığı açılar.'
          + '</div>'
        : '')
    // AÇININ TANIMI SEÇİM YÜZEYİNİN KENDİSİNDE.
    //
    // Kullanıcı bildirimi (2026-09-22): *"Kol açısını seçtiğimiz diyagramdaki
    // açı tanımları çok başka olmuş. Kafa karıştırıyor."* Ölçüldü: bu modal
    // yalnız çizim + zoom + yeşil yay göstergesi + üç okuma + giriş kutusu
    // basıyordu. "0° nereden ölçülüyor", "artı yön hangisi", "yeşil ok neyi
    // gösteriyor", "kesikli çember ne" — hiçbiri ekranda YAZILI DEĞİLDİ. Bu
    // bilgiyi taşıyan tek metin BAŞKA bir yüzeydeki panel ipucuydu ve
    // kullanıcı açıyı seçerken onu görmüyordu.
    //
    // En sezgisel olmayan parça referans NOKTASIDIR: gösterilen açı merkezden
    // PİVOTA bakar, yani "Kol yönü 0°" demek "gövde avaranın SAĞINDA, kol
    // SOLA uzanıyor" demektir. Bir ad ("kol yönü") doğal olarak "kolun baktığı
    // yön" diye okunur ve o tam tersidir — bu yüzden ok açıkça adlandırılıyor.
    // SINIF AYRI (`ve-fw-angdef`): `ve-fw-legend` BANDA bağlı ve bant yokken
    // basılmıyor (kapısı fead-wizard.test.js'te). Tanım ise her zaman durmalı
    // — asıl kusur zaten tanımın hiç görünmemesiydi.
    + '<div class="ve-fw-angdef">'
      + '<b>Kol yönü nedir:</b> yeşil ok <b>avara merkezinden gövdenin montaj '
      + 'noktasına</b> bakar. <b>0° sağda, saat yönünün tersi artı</b>, değer '
      + 'işaretli (−180…+180 — programın yön gülü aynı ekseni 0…360 ile yazar, '
      + 'yani buradaki −90 gülde 270\'tir). Kesikli çember montaj noktasının '
      + 'olanaklı yerleridir: merkez ve kol boyu sabit olduğu için nokta o '
      + 'çember üzerinde durmak zorunda. Parça çizimi aynı yönü TERS uçtan, '
      + 'mutlak yazar (E9843: <i>"344° MEAN ANGLE"</i> ↔ burada 164°).'
      + '</div>'
    + '<div class="ve-fw-reads">' + _fwAngReads(sc, d) + '</div>'
    + '<div class="ve-fw-ang-row">'
      + '<label class="ve-fw-lbl" for="ve-fw-ang-in">Kol yönü [°]</label>'
      + '<input id="ve-fw-ang-in" type="text" inputmode="decimal" class="ve-fw-inp"'
        + ' value="' + (Number.isFinite(d) ? d.toFixed(2) : '') + '"'   // makine: sayı alanının değeri
        + ' oninput="veFeadWizAngType(this.value)"'
        + ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();veFeadWizAngOk();}">'
      + '<button type="button" class="ve-fw-btn ve-fw-btn-primary" onclick="veFeadWizAngOk()">Uygula</button>'
      + '<button type="button" class="ve-fw-btn" onclick="veFeadWizAngClose()">Vazgeç</button>'
    + '</div>'
    ;
}

// OKUMALAR TEK ÜRETİCİDEN — ilk çizim ve canlı yama aynı satırları basıyor.
// İkinci bir kopya, yamanın ilk çizimden sessizce ayrışması demekti.
//
// ÜÇÜNCÜ SATIR "MODELE İŞLENEN": Uygula pencereyi artık kapatmadığı için
// "işledi mi?" sorusunun ekranda bir cevabı olmalı. Seçili açı ile modeldeki
// açı aynıysa satır işaretli; farklıysa kullanıcı Uygula'ya basmadığını
// GÖRÜYOR. Bir açıklama değil, bir DURUM.
function _fwAngReads(sc, d){
  var piv = null;
  if(sc && Number.isFinite(d) && typeof veFeadTensionerPivot === 'function')
    piv = veFeadTensionerPivot({ cenX: sc.cx, cenY: sc.cy, armLen: sc.armLen,
                                 armMeanDeg: veFeadArmFromShown(d) });
  var uyg = NaN;
  if(_fwState && _fwState.ten && typeof veFeadArmShownDeg === 'function')
    uyg = veFeadArmShownDeg(_fwNum(_fwState.ten.armMeanDeg, NaN));
  var ayni = Number.isFinite(uyg) && Number.isFinite(d) && Math.abs(uyg - d) < 0.005;
  return _fwRead('Kol yönü (merkezden pivota)', Number.isFinite(d) ? _fwFmt(d, 2) + '°' : '—')
    + _fwRead('Gövdenin montaj konumu',
        piv ? _fwFmt(piv[0], 2) + ' / ' + _fwFmt(piv[1], 2) + ' mm' : '—')
    + _fwReadHTML(_fwEsc('Modele işlenen açı'),
        Number.isFinite(uyg) ? _fwFmt(uyg, 2) + '°' : '— (henüz uygulanmadı)',
        Number.isFinite(uyg) && ayni ? 'check' : null);
}

function veFeadWizAngOpen(){
  if(!_fwState) return;
  var t = _fwState.ten || {};
  var d = (typeof veFeadArmShownDeg === 'function')
    ? veFeadArmShownDeg(_fwNum(t.armMeanDeg, NaN)) : NaN;
  VE_FW_ANG = { shown: Number.isFinite(d) ? d : 0, hover: null, zoom: 1 };
  veFeadWizAngRender();
  veFeadWizEngRender();   // künye penceresi de kaplamanın durumunu izliyor
  veFeadWizTeXPaint();    // denklemler dizilir (varlık gelmişse)
}
function veFeadWizAngClose(){ VE_FW_ANG = null; veFeadWizAngRender(); }

// ── YAKINLAŞTIRMA ────────────────────────────────────────────────────────
// Kullanıcı isteği (2026-09-02). Ölçek sahneye oturan otomatik değeri ÇARPAR
// (1 = sığdır), bu yüzden yakınlaştırma sahnenin ORTASINA doğru oluyor ve
// fare→açı çevirisi kendiliğinden doğru kalıyor: çeviri ölçeği SVG'nin kendi
// `data-*` künyesinden okuyor, ayrı bir hesap tutmuyor.
var VE_FW_ANG_ZOOM = [0.6, 0.8, 1, 1.35, 1.8, 2.4, 3.2];
function veFeadWizAngZoom(yon){
  if(!VE_FW_ANG) return 1;
  if(!yon){ VE_FW_ANG.zoom = 1; veFeadWizAngPatch(); return 1; }
  var z = _fwNum(VE_FW_ANG.zoom, 1), i = 0;
  for(var j = 0; j < VE_FW_ANG_ZOOM.length; j++)
    if(Math.abs(VE_FW_ANG_ZOOM[j] - z) < Math.abs(VE_FW_ANG_ZOOM[i] - z)) i = j;
  i = Math.max(0, Math.min(VE_FW_ANG_ZOOM.length - 1, i + (yon > 0 ? 1 : -1)));
  VE_FW_ANG.zoom = VE_FW_ANG_ZOOM[i];
  veFeadWizAngPatch();
  return VE_FW_ANG.zoom;
}
function veFeadWizAngWheel(ev){
  if(!VE_FW_ANG) return;
  if(ev && ev.preventDefault) ev.preventDefault();
  veFeadWizAngZoom(ev.deltaY < 0 ? 1 : -1);
}

// Fare hareketi: SVG'nin kendi ölçek künyesinden mm'ye dönüp açıyı okuyor.
// Ölçek DOM'a yazılı (data-*), çünkü çizim saf ve kabın ölçüsünü bilmiyor.
function veFeadWizAngFromPoint(svg, px, py){
  if(!svg) return NaN;
  var k = Number(svg.getAttribute('data-k'));
  var ox = Number(svg.getAttribute('data-ox')), oy = Number(svg.getAttribute('data-oy'));
  var cx = Number(svg.getAttribute('data-cx')), cy = Number(svg.getAttribute('data-cy'));
  var mir = Number(svg.getAttribute('data-mir')) < 0 ? -1 : 1;
  if(!(k > 0)) return NaN;
  var mx = (px - ox) / k, my = (oy - py) / k;
  var dx = mx - cx, dy = my - cy;
  if(Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return NaN;
  var a = Math.atan2(dy, dx) * 180 / Math.PI;
  // EKRAN → VERİ. Sahne aynalıysa okunan açı ekranın açısıdır; saklanan alan
  // veri düzleminde kalmak ZORUNDA (çözücü orayı okuyor).
  // NORMALLEŞTİRME KAYAN NOKTAYA DAYANIKLI OLMALI: `if(a > 180)` biçimi, ekranın
  // tam sağındaki bir noktada atan2'nin −1e−17 döndürmesiyle sonucu 180 ↔ −180
  // arasında zıplatıyordu. Aynı yön, ama saklanan sayı karadan karaya değişir.
  if(mir < 0) a = (180 - a) - 360 * Math.floor(((180 - a) + 180) / 360);
  return a;
}
// FARE YALNIZ HAYALETİ OYNATIR — SEÇİMİ DEĞİL.
//
// Eskiden `shown`ı doğrudan yazıyordu ve iki şeyi birden bozuyordu:
// (1) tıklamanın hiçbir izi kalmıyordu, çünkü ok zaten farenin peşindeydi;
// (2) kutuya elle yazılan değer, fare düzlemin üstünden geçer geçmez
//     sessizce siliniyordu. Kullanıcı ikisini birden ölçtü: ok 35,80°
//     gösterirken kutuda 48,74 yazıyordu.
function veFeadWizAngHover(ev){
  if(!VE_FW_ANG || typeof document === 'undefined') return;
  var svg = document.querySelector('#ve-fw-ang-plot svg');
  if(!svg || !svg.getBoundingClientRect) return;
  var r = svg.getBoundingClientRect();
  var vb = (svg.getAttribute('viewBox') || '0 0 380 300').split(/\s+/);
  var W = Number(vb[2]) || 380, H = Number(vb[3]) || 300;
  var d = veFeadWizAngFromPoint(svg, (ev.clientX - r.left) * W / r.width,
                                     (ev.clientY - r.top) * H / r.height);
  if(!Number.isFinite(d)) return;
  VE_FW_ANG.hover = Math.round(d * 100) / 100;
  veFeadWizAngPatch();
}
// Fare düzlemden çıkınca hayalet de gider — kalsaydı ekranda sahibi olmayan
// bir aday dururdu.
function veFeadWizAngLeave(){
  if(!VE_FW_ANG || VE_FW_ANG.hover == null) return;
  VE_FW_ANG.hover = null;
  veFeadWizAngPatch();
}
// SOL TIK SEÇİMİ SABİTLER: hayaletin durduğu açı `shown` olur, kutuya yazılır
// ve kutuya odaklanılır — kullanıcı isteği: tıkta "tam açı değerini soran ufak
// bir doldurulabilir kutucuk".
function veFeadWizAngPick(ev){
  if(!VE_FW_ANG) return;
  veFeadWizAngHover(ev);
  if(!Number.isFinite(_fwNum(VE_FW_ANG.hover, NaN))) return;
  VE_FW_ANG.shown = VE_FW_ANG.hover;
  veFeadWizAngPatch();
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-fw-ang-in');
  if(el){ el.value = _fwNum(VE_FW_ANG.shown, NaN).toFixed(2); el.focus(); el.select(); }   // makine: sayı alanının değeri
}
function veFeadWizAngType(v){
  if(!VE_FW_ANG) return;
  var d = _fwNum(v, NaN);
  if(!Number.isFinite(d)) return;
  VE_FW_ANG.shown = d;
  veFeadWizAngPatch();          // KUTUYA DOKUNMAZ — yazarken odak düşmesin
}
// UYGULA PENCEREYİ KAPATMAZ — kullanıcı isteği (2026-09-04): *"açı değerini
// girip tamam dediğimde pencere otomatik kapanıyor. Kapanmasın."* Açık kalınca
// aynı pencerede birkaç açı denenebiliyor; kapatma yolu "Vazgeç" ve modalın
// kendi ✕'i.
//
// UYGULANAN DEĞER OKUNUYOR: pencere açık kaldığı için "işledi mi?" sorusunun
// ekranda bir cevabı olmalı — okumalar satırı modele YAZILAN açıyı da basıyor
// (bkz. `veFeadWizAngPatch`). Bu bir açıklama değil bir DURUM.
function veFeadWizAngOk(){
  if(!VE_FW_ANG || !_fwState) return false;
  var d = _fwNum(VE_FW_ANG.shown, NaN);
  if(!Number.isFinite(d)) return false;
  if(!_fwState.ten) _fwState.ten = {};
  _fwState.ten.armMeanDeg = Math.round(veFeadArmFromShown(d) * 10000) / 10000;
  // Arkadaki sihirbaz tazelenir (şerit, uyarılar, gergi adımının alanı); pencere
  // `VE_FW_ANG` null OLMADIĞI için açık kalır.
  veFeadWizRender();
  veFeadWizAngRender();
  return true;
}
// Yalnız çizimi ve okumaları tazeler; kutuya dokunmaz (odak kuralı).
function veFeadWizAngPatch(){
  if(typeof document === 'undefined') return;
  var kap = document.getElementById('ve-fw-ang-body');
  if(!kap) return;
  var plot = document.getElementById('ve-fw-ang-plot');
  if(plot){
    // YALNIZ SVG değişir; yakınlaştırma düğmeleri yerinde kalır (yeniden
    // kurulsalardı basılı tutulan düğme her karede DOM'dan silinirdi).
    var eski = plot.querySelector('svg');
    var yeni = veFeadWizAngSVG(veFeadWizAngScene(), VE_FW_ANG && VE_FW_ANG.shown,
                               VE_FW_ANG && VE_FW_ANG.zoom, undefined, undefined,
                               VE_FW_ANG && VE_FW_ANG.hover);
    if(eski) eski.outerHTML = yeni; else plot.insertAdjacentHTML('afterbegin', yeni);
  }
  var oku = kap.querySelector('.ve-fw-reads');
  if(oku){
    var sc = veFeadWizAngScene(), d = VE_FW_ANG ? VE_FW_ANG.shown : NaN, piv = null;
    if(sc && Number.isFinite(d))
      piv = veFeadTensionerPivot({ cenX: sc.cx, cenY: sc.cy, armLen: sc.armLen,
                                   armMeanDeg: veFeadArmFromShown(d) });
    oku.innerHTML = _fwAngReads(sc, d);
  }
}
function veFeadWizAngRender(){
  if(typeof document === 'undefined') return;
  var ov = document.getElementById('ve-fw-ang');
  if(!ov) return;
  if(!VE_FW_ANG){ ov.style.display = 'none'; ov.innerHTML = ''; return; }
  ov.style.display = 'flex';
  // BAŞLIK VE GÖVDE, ÜÇÜNCÜ BİR ŞEY YOK — `_fwCard` ile aynı kural. Bu başlık
  // ELLE yazıldığı için #848'in temizliğinden kaçmıştı: `<em>fareyle</em>`
  // burada duruyordu ve kullanıcı onu ekranda gördü. Kapı artık üretilen
  // yüzeye bakıyor, tek bir üreticiye değil.
  ov.innerHTML = '<div class="ve-fw-ang-box"><header class="ve-fw-card-h">'
    + '<span>Kol açısını seç</span></header>'
    + '<div class="ve-fw-card-b" id="ve-fw-ang-body">' + veFeadWizAngHTML() + '</div></div>';
  var plot = document.getElementById('ve-fw-ang-plot');
  if(plot){
    plot.onmousemove = veFeadWizAngHover;
    plot.onmouseleave = veFeadWizAngLeave;   // hayalet fareyle birlikte gider
    plot.onclick = veFeadWizAngPick;
    plot.onwheel = veFeadWizAngWheel;
  }
}

// ── 5 · KAYIŞ ──────────────────────────────────────────────────────────────
function _fwStepKayis(b){
  var st = _fwState, bl = st.belt || {};
  var h = _fwCard('Profil ve marka', 'var(--accent-warning)',
      _fwGrid([_fwField('Profil', _fwSelHTML('belt.profile',
                 [['PK','PK'],['PJ','PJ'],['PH','PH'],['PL','PL'],['PM','PM']], bl.profile || 'PK')),
               _fwField('Marka', _fwSelHTML('belt.brand',
                 [['GATES','Gates'],['OPTIBELT','Optibelt'],['CONTITECH','ContiTech']], bl.brand || 'GATES')),
               _fwField('Kanal sayısı', _fwInp('belt.ribs', { ph: '8', step: '1' }))], 3)
    // HESAP ÇAPI — kayış penceresinin seçicisiyle TEK listeden (kural 24).
    + ((typeof veFeadHesapCapSecenekleri === 'function')
        ? _fwGrid([_fwField('Hesap çapı', _fwSelHTML('belt.hesapCap',
            veFeadHesapCapSecenekleri(bl), bl.hesapCap || 'katalog'))], 1) : '')
    );

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
  h += _fwCard('Kayış boyu', 'var(--accent-warning)',
      '<div class="ve-fw-reads">'
    + _fwRead('Boy kipi', 'SERBEST (kilitli)')
    + ((b && b.ok && Number.isFinite(b.beltLengthMm))
        ? _fwRead('Gereken boy (çıktı)', _fwFmt(b.beltLengthMm, 1) + ' mm')
          + _fwKordRead(b) : '')
    + _fwRead('Kayış tipine bağlı çıktılar', 'KAPALI')
    + '<div class="ve-fw-read ve-fw-read-dik"><span>Üretilmeyenler</span><b>'
      + _fwEsc((typeof VE_FEAD_BELT_DATA_OFF !== 'undefined' ? VE_FEAD_BELT_DATA_OFF : []).join(' · '))
      + '</b></div>'
    + '</div>'
    );
  // SERVİS FAKTÖRÜ c₂ — kayış penceresinin Tasarım sekmesiyle AYNI üretici ve
  // aynı köprü yazıcısı (kural 24 · 48); değer durumun çözücü alanına yazılır,
  // kurulumda depoya taşınır (`veFeadWizNodes`).
  if(typeof veFeadServisTabloHTML === 'function')
    h += _fwCard('Servis faktörü c₂', 'var(--accent-primary)',
      veFeadServisTabloHTML(st.solver || {}, function(k){ return 'veFeadWizServisSec(\'' + k + '\')'; }));
  // SÜRTÜNME — kayış penceresiyle AYNI üretici ve aynı köprü yazıcısı (kural
  // 24 · 49); değer durumun çözücü alanında, kurulumda depoya taşınır.
  if(typeof veFeadSurtunmeHTML === 'function')
    h += _fwCard('Sürtünme katsayısı μ', 'var(--accent-primary)',
      veFeadSurtunmeHTML(st.solver || {}, function(k, a){
        return 'veFeadWizSurtunmeSec(\'' + k + '\'' + (a ? ',\'' + a + '\',this.value' : '') + ')'; }));
  h += _fwCadKayisHTML(st, b);
  return h;
}

// Sihirbazın sürtünme yazıcısı — kayış penceresininkiyle aynı köprü fonksiyonu.
function veFeadWizSurtunmeSec(anahtar, alan, deger){
  if(!_fwState || typeof veFeadSurtunmeSet !== 'function') return;
  if(!_fwState.solver) _fwState.solver = {};
  var d = null;
  if(alan){ d = {}; d[alan] = deger; }
  var ok = veFeadSurtunmeSet(_fwState.solver, anahtar, d);
  if(!ok && alan && typeof showToast === 'function')
    showToast('Değer yazılmadı: μ 0,05–3, küçük kasnak kaybı 0–20 mm aralığında olmalı.', 'warning');
  if(typeof veFeadWizLiveSoon === 'function') veFeadWizLiveSoon();
  veFeadWizRender();
}

// Sihirbazın c₂ yazıcısı — kayış penceresininkiyle aynı köprü fonksiyonu.
function veFeadWizServisSec(anahtar){
  if(!_fwState || typeof veFeadServisSet !== 'function') return;
  if(!_fwState.solver) _fwState.solver = {};
  veFeadServisSet(_fwState.solver, anahtar);
  if(typeof veFeadWizLiveSoon === 'function') veFeadWizLiveSoon();
  veFeadWizRender();
}

// ── CAD'DEKİ KAYIŞ (STEP'ten, kayış rolü verildiyse) ────────────────────────
// Kullanıcı isteği (2026-09-28): kayış 3B'de seçilir. Numara bir GİRDİ değil
// (gergi varken boy çıktı); kart o kayışın bu düzende ne yapacağını yazar:
// numara ile gereken boyun farkı ve kolun oturduğu yer (veFeadBeltFit — katalog
// kartının kullandığı aynı değerlendirme).
function _fwCadKayisHTML(st, b){
  var c = st && st.stepKaynak && st.stepKaynak.kayis;
  if(!c) return '';
  var r = _fwRead('Kod', c.kod || '—');
  if(c.kanal) r += _fwRead('Kanal', c.kanal + (c.kanalKaynak === 'genislik' ? ' (genişlikten)' : ''));
  var f = null;
  if(b && b.ok && b.sys && Number.isFinite(c.boy) && Number.isFinite(b.beltLengthMm)){
    var fark = c.boy - b.beltLengthMm;
    r += _fwRead('Numara − gereken', (fark < 0 ? '−' : '+') + _fwFmt(Math.abs(fark), 1) + ' mm');
    f = (typeof veFeadBeltFit === 'function') ? veFeadBeltFit(b.sys, c.boy) : null;
    if(f && f.ok && f.fits){
      var d = f.relDeg - b.relDeg;
      r += _fwRead('Bu kayışla kol', (Math.abs(d) < 0.05 ? 'nominalde'
          : 'nominalden ' + _fwFmt(Math.abs(d), 1) + '° ' + (d < 0 ? 'serbest uca doğru' : 'yük stopuna doğru'))
        + (Number.isFinite(f.tensionN) ? ' · T ' + _fwFmt(f.tensionN, 0) + ' N' : ''));
    } else if(f && f.ok && f.atLimit){
      r += _fwRead('Bu kayışla kol', 'sığmıyor — ' + (f.atLimit.side === 'free'
          ? 'kayış uzun, kol serbest ucuna dayanır' : 'kayış kısa, kol yük stopuna dayanır'));
    }
  }
  // ESKİZ: CAD'in çizdiği kord çizgisi ve modelin kordu — hesap çapı CAD
  // eskiziyse ve kol CAD'deki konumdaysa ikisi aynı boyu okur.
  var es = c.eskiz;
  if(es){
    r += _fwRead('Eskiz', (es.ad || 'kayış eskizi') + ' · ' + es.yay + ' yay'
      + (es.hb !== null ? ' · h_b ' + _fwFmt(es.hb, 2) : '') + (es.hr !== null ? ' · h_r ' + _fwFmt(es.hr, 2) : ''));
    var tm = (b && b.ok && typeof veFeadTableRows === 'function') ? veFeadTableRows(b) : null;
    if(tm && Number.isFinite(tm.LpitchMm) && Number.isFinite(es.L)){
      var fk = es.L - tm.LpitchMm;
      r += _fwRead('Eskiz kordu − model kordu', (fk < 0 ? '−' : '+') + _fwFmt(Math.abs(fk), 1) + ' mm');
    }
  }
  return _fwCard('CAD\'deki kayış', (f && f.ok && !f.fits) ? 'var(--accent-danger)' : 'var(--text-muted)',
    '<div class="ve-fw-reads" data-ve="cad-kayis">' + r + '</div>');
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
  //   · oran kurulu ama katalog modeli/eğri yok → güç YOK; işletme hesabı
  //     onsuz yapılmaz (fead-model.js → veFeadIsletmeEksik).
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
// ── AKSESUAR MODELİ — İKİ KATALOĞUN BİRLEŞİMİ, TEK SEÇİCİ ─────────────────
//
// Kullanıcı bildirimi (2026-09-01): *"'Aksesuar modelleri' kısmında kullanıcıya
// sunulan alternatör ve kompresör seçenekleri eksik gibi duruyor."* ÖLÇÜLDÜ ve
// haklıydı — ama sebep eksik veri değil, İKİ AYRI KATALOG ve ikisinin ayrı
// yerlerde sunulmasıydı:
//
//   Araç Performans kataloğu  (`veFeadPresetLib`)  → alternatör 2 · klima 2
//   BMC/FEAD defteri          (`veFeadAccList`)    → alternatör 10 · klima 4
//
// "Aksesuar Modelleri" kartı YALNIZ birincisini gösteriyordu (2 alternatör);
// on kayıtlık defter ise "Aksesuar Devir Sınırları" kartındaki AYRI bir
// seçicideydi. Yani seçenekler eksik değil, GÖRÜNMÜYORDU — ve aynı aksesuarın
// modeli iki ayrı yerden seçiliyordu.
//
// Artık TEK seçici var ve listesi birleşim. Değer ön ekli: `bmc:<parça>` ya da
// `ap:<anahtar>`. Ön ek şart, çünkü iki katalog aynı aksesuar için ayrı anahtar
// uzayları kullanıyor (BMC parça numarası ↔ AP model kodu) ve çıplak bir
// anahtar hangi kataloğa gideceğini söylemiyordu.
// LİSTE VE YAZICI KÖPRÜDE (`veFeadAccModelOpts` · `veFeadAccModelOf` ·
// `veFeadAccModelSet`, fead-model.js): kasnak penceresi de AYNI seçiciyi
// sunuyor (kural 24) — iki yüzeyin iki kuralı olsaydı biri sessizce
// eskirdi. Bir dönem öyleydi: sihirbaz seçimde çevrim kW'larını
// temizliyordu, pencere temizlemiyordu ve pencereden seçilen model
// sonuçlara hiç ulaşmıyordu (2026-09-28, ölçüldü).
function veFeadWizAccModelOpts(type){ return veFeadAccModelOpts(type); }
// Bir kasnağın SEÇİLİ model değeri — hangi katalogdan geldiğiyle birlikte.
function veFeadWizAccModelOf(p){ return veFeadAccModelOf(p); }
// TEK YAZICI — köprünün. Başka kataloğa geçiş künyenin yazdığını temizler,
// eğri getiren seçim o aksesuarın çevrim kW'larını siler.
function veFeadWizAccModel(key, val){
  if(!_fwState) return;
  var p = _fwState.pulleys.filter(function(x){ return x.key === key; })[0];
  if(!p) return;
  veFeadAccModelSet(p.type, p, val, (_fwState.solver || {}).duty, key);
  veFeadWizRender();
}

function veFeadWizAccPreset(key, presetKey){
  if(!_fwState) return;
  var p = _fwState.pulleys.filter(function(x){ return x.key === key; })[0];
  if(!p) return;
  if(presetKey) p.accPreset = presetKey; else delete p.accPreset;
  if(presetKey)
    (_fwState.solver.duty || []).forEach(function(r){ if(r.kw) delete r.kw[key]; });
  veFeadWizRender();
}

// ── BMC KATALOGLARI — panelin uyguladığı fonksiyonların AYNISI ──────────────
//
// Sihirbaz kendi uygulama kuralını yazmıyor: `veFeadEngineApply` ve
// `veFeadAccApply` çağrılıyor. İkinci bir kopya, "katalogda null olan alana
// dokunma" ve "boş eğri yazma" kurallarının bir yüzeyde sessizce kaybolması
// demekti. Sihirbazın kasnak satırı DÜZ bir nesne (p.od, p.pwrCurve…);
// katalog fonksiyonları `node.data` bekliyor, o yüzden `{ data: p }` sarmalı
// ile çağrılıyor ve alanlar doğrudan satıra yazılıyor.
function veFeadWizEngineLib(key){
  if(!_fwState) return;
  var s = _fwState.solver || (_fwState.solver = {});
  if(!key){ delete s.engineLib; delete s.engineLibVer; }
  else if(typeof veFeadEngineApply === 'function' && veFeadEngineOf(key)){
    veFeadEngineApply(s, key);
    if(typeof showToast === 'function')
      showToast(veFeadEngineOf(key).ad + ' künyesi yüklendi', 'success');
  }
  veFeadWizRender();
}

function veFeadWizAccLib(key, libKey){
  if(!_fwState) return;
  var p = _fwState.pulleys.filter(function(x){ return x.key === key; })[0];
  if(!p) return;
  if(!libKey){
    if(typeof veFeadAccUnlink === 'function') veFeadAccUnlink({ data: p });
  } else if(typeof veFeadAccApply === 'function' && veFeadAccOf(libKey)){
    veFeadAccApply({ data: p }, libKey);
    // Künye devir→kW eğrisi de getiriyorsa duty tablosundaki elle kaydedilmiş
    // kW'lar o eğrinin ÖNÜNDE kalırdı (`_fwKwEff` önceliği: duty kW > eğri >
    // katalog). Model seçiminin kuralının aynısı: seçim yapmak "bu aksesuarın
    // verisi budur" demektir, yarım kalan eski sayı iki kaynağı karıştırırdı.
    var rec = veFeadAccOf(libKey);
    if(rec.curve && rec.curve.length)
      (_fwState.solver.duty || []).forEach(function(r){ if(r.kw) delete r.kw[key]; });
  }
  veFeadWizRender();
}

// ── BMC MOTOR KATALOĞU SATIRI ──────────────────────────────────────────────
//
// Panelin kartıyla AYNI kural (katalog bir KISIT değil bir ÖNERİ): seçim
// alanları doldurur, kullanıcı sonra hepsini elle değiştirebilir. Değiştirince
// SUSULMUYOR — `veFeadEngineDrift` sapan alanları sayar ve satır bunu yazar.
function _fwEngineLibRow(s){
  // KÜTÜPHANE YOKSA SESSİZ KALINMAZ — bu bir açıklama değil, bir HATA DURUMU.
  if(typeof veFeadEngineList !== 'function')
    return '<div class="ve-fw-issue ve-fw-issue-err">' + _fwSorunIkon('err') + ' Motor kataloğu yüklenmedi '
      + '(js/fead-engines.js).</div>';
  var liste = veFeadEngineList(), sec = (s && s.engineLib) || '';
  var sel = '<select class="ve-fw-inp" onchange="veFeadWizEngineLib(this.value)">'
    + '<option value="">— elle gir —</option>'
    + liste.map(function(r){
        return '<option value="' + _fwEsc(r.key) + '"'
             + (r.key === sec ? ' selected' : '') + '>' + _fwEsc(r.label) + '</option>';
      }).join('') + '</select>';
  var h = _fwField('BMC motor kataloğu', sel);
  var d = (typeof veFeadEngineDrift === 'function') ? veFeadEngineDrift(s) : null;
  // KATALOGDAN SAPMA BİR OKUMADIR, açıklama değil: alanlar seçilen kayıtla
  // birebir mi, değilse HANGİ alan ayrışmış — ikisi de modelin durumu.
  if(d && d.drift.length)
    h += '<div class="ve-fw-issue ve-fw-issue-warn">! <b>Katalogdan sapıldı:</b> '
       + _fwEsc(d.drift.join('; ')) + '</div>';
  else if(d)
    h += '<div class="ve-fw-reads">'
       + _fwRead('Katalog kaydı', _fwEsc(d.ad) + ' — alanlar birebir') + '</div>';
  return h;
}

// Sıcaklık alanı: satırlar ortaksa değeri gösterir, ayrışıksa BOŞ kalır ve
// yer tutucusu durumu söyler — dolu göstermek, olmayan bir ortak değeri
// iddia etmek olurdu (bu modülün sessiz sınıfı).
function _sicaklikAlani(duty){
  var ortak = veFeadWizDutyTempOf(duty);
  var ayrisik = (ortak === null) && (duty || []).length > 0;
  return '<input type="text" inputmode="decimal" class="ve-fw-inp"'
    + ' value="' + _fwEsc(ortak === null ? '' : ortak) + '"'
    + ' placeholder="' + (ayrisik ? 'satır başına farklı' : '90') + '"'
    + ' title="Kayışın gördüğü ortam sıcaklığı. Bütün devir noktalarına yazılır;'
    + ' ömür hesabı satır başına saklanan sıcaklıklardan hasar-eşdeğer bir'
    + ' sıcaklık türetiyor."'
    + ' oninput="veFeadWizDutyTemp(this.value)">';
}

// ── MOTOR KÜNYESİ ÖZETİ VE PENCERESİ ──────────────────────────────────────
//
// ALAN LİSTESİ TEK YERDE: özet, pencere ve "katalogdan mı geldi" ayrımı aynı
// diziden okuyor. İkinci bir liste, pencereye eklenen bir alanın özette
// görünmemesi demekti.
//
// `kat: true` → motor kataloğunun YAZDIĞI alan (`veFeadEngineApply`).
// `kat: false` → katalogda KARŞILIĞI OLMAYAN alan; motordan gelemez, elle
// girilir. Ayrımı gizlemek, kullanıcının "motoru seçtim, hepsi doldu" diye
// düşünüp boş bir krank ataletiyle devam etmesi demekti.
//
// SERVİS FAKTÖRÜ BU LİSTEDE YOK (2026-09-29, kural 48): yük katsayısı c₂
// tablosu olarak Kayış adımında — serbest sayı alanı tablonun dışında bir değer
// yazdırıyordu.
//
// "NO LOAD GOVERNED" BU LİSTEDE YOK — sorulmaz. Sayıyı OKUYAN hiçbir hesap,
// uygunluk kapısı ya da rapor satırı yok (aranan yerler: fead-model · fead-core
// · fead-checks · fead-transient · iki rapor üreteci). Katalogda duruyor ve
// künye seçilince veriye yazılıyor; kullanıcıdan istenmesi, hesaba girdiği
// izlenimi veriyordu. Aynı kaldırma Çözücü panelinde de yapıldı — iki yüzey
// aynı künyeyi sorar.
var VE_FW_ENG_FIELDS = [
  // YER TUTUCU BOŞ ALANIN NE YAPTIĞINI SÖYLER (2026-09-29). Eskiden bir
  // örnek sayı taşıyordu (6 · 700 · 2100 · 0,70 · 1000) ve ilk ikisi boş
  // alanda GERÇEKTEN kullanılıyordu — kullanıcı yer tutucuyu girilmiş değer
  // sanıyordu. İşletme hesabının girdisi 'zorunlu'; boşken varsayılanla koşan
  // alan o varsayılanı yazar (ivme 1100 RPM/s — çekirdeğin kendi değeri;
  // krank ataleti Gates arşivinin medyanı, künyeye yazılarak).
  { yol: 'solver.cylinders',         ad: 'Silindir sayısı',      br: '—',      ph: 'zorunlu', kat: true  },
  { yol: 'solver.idleRpm',           ad: 'Rölanti',              br: 'RPM',    ph: 'zorunlu', kat: true  },
  { yol: 'solver.governedRpm',       ad: 'Governed',             br: 'RPM',    ph: 'zorunlu', kat: true  },
  { yol: 'solver.overspeedRpm',      ad: 'Overspeed',            br: 'RPM',    ph: '—',    kat: true  },
  { yol: 'solver.crankInertia',      ad: 'Krank mili ataleti',   br: 'kg·m²',  ph: 'arşiv 0,50', kat: false },
  { yol: 'solver.accelRpmS',         ad: 'İvmelenme',            br: 'RPM/s',  ph: '1100', kat: false },
  { yol: 'solver.decelRpmS',         ad: 'Yavaşlama',            br: 'RPM/s',  ph: '1100', kat: false },
  { yol: 'solver.lengthOffsetMm',    ad: 'Boy ofseti',           br: 'mm',     ph: '0',    kat: false }
];

function _fwEngVal(s, f){
  var v = s ? s[f.yol.replace('solver.', '')] : undefined;
  return (v === undefined || v === null || v === '') ? null : v;
}

// DEVİR SINIRLARI KUTU OLARAK — OKUMA, girdi DEĞİL: alanlar pencerede
// (kullanıcı kararı 2026-09-04, *"tıklanır bir buton ve açılır bir
// pencere"*). Girilmemiş sınır "—"; yer tutucuyu değermiş gibi basmak boş bir
// künyeyi dolu gösterirdi.
function _fwEngineKutular(s){
  var d = VE_FW_ENG_FIELDS.filter(function(f){ return /Rpm$/.test(f.yol.split('.')[1]); });
  return '<div class="ve-fw-kutular">' + d.map(function(f){
    var v = _fwNum(_fwEngVal(s, f), NaN);
    return '<div class="ve-fw-kutu" data-yol="' + _fwEsc(f.yol) + '"><span>' + _fwEsc(f.ad) + '</span>'
      + '<b>' + (Number.isFinite(v) ? veSayi(v) : '—') + '</b><em>' + _fwEsc(f.br) + '</em></div>';
  }).join('') + '</div>';
}
// Sayfadaki ÖZET: silindir + künyenin doluluğu.
function _fwEngineOzet(s){
  var say = 0, bos = 0;
  VE_FW_ENG_FIELDS.forEach(function(f){ if(_fwEngVal(s, f) === null) bos++; else say++; });
  return _fwRead('Silindir', (function(){ var v = _fwEngVal(s, VE_FW_ENG_FIELDS[0]); return v === null ? '—' : String(v); })())
    + _fwRead('Künye alanları', say + ' / ' + VE_FW_ENG_FIELDS.length
        + (bos ? ' — ' + bos + ' alan boş' : ' — tamam'));
}

var VE_FW_ENG_OPEN = false;
function veFeadWizEngOpen(){ VE_FW_ENG_OPEN = true;  veFeadWizEngRender(); }
function veFeadWizEngClose(){ VE_FW_ENG_OPEN = false; veFeadWizEngRender(); }

function veFeadWizEngHTML(){
  var s = (_fwState && _fwState.solver) || {};
  var kat = VE_FW_ENG_FIELDS.filter(function(f){ return f.kat; });
  var elle = VE_FW_ENG_FIELDS.filter(function(f){ return !f.kat; });
  function alanlar(liste){
    return _fwGrid(liste.map(function(f){
      return _fwField(f.ad + ' [' + f.br + ']', _fwInp(f.yol, { ph: f.ph }));
    }), Math.min(3, liste.length));
  }
  return _fwEngineLibRow(s)
    + _fwCard('Motordan gelen', 'var(--accent-success)', alanlar(kat))
    + _fwCard('Motora bağlı olmayan', 'var(--accent-warning)', alanlar(elle))
    + '<div class="ve-fw-ang-row"><span class="ve-fw-lbl">'
      + 'Motor kataloğu bu ikinci grubu yazmaz — hiçbir kayıt taşımıyor.</span>'
      + '<button type="button" class="ve-fw-btn ve-fw-btn-primary"'
        + ' onclick="veFeadWizEngClose()">Kapat</button></div>';
}

function veFeadWizEngRender(){
  if(typeof document === 'undefined') return;
  var ov = document.getElementById('ve-fw-eng');
  if(!ov) return;
  if(!VE_FW_ENG_OPEN){ ov.style.display = 'none'; ov.innerHTML = ''; return; }
  ov.style.display = 'flex';
  ov.innerHTML = '<div class="ve-fw-ang-box"><header class="ve-fw-card-h">'
    + '<span>Motor künyesi</span></header>'
    + '<div class="ve-fw-card-b" id="ve-fw-eng-body">' + veFeadWizEngHTML() + '</div></div>';
}

// ── 6 · MOTOR VE ÇALIŞMA ÇEVRİMİ ───────────────────────────────────────────
function _fwStepCevrim(b){
  var st = _fwState, s = st.solver || {};
  var dr = (typeof veFeadDriveRatio === 'function') ? veFeadDriveRatio(s) : { ratio: 1 };

  // ── ORAN ELLE GİRİLEMEZ; KADEMENİN VARLIĞI BİR SEÇİM ────────────────────
  // Kullanıcı isteği (2026-09-01): *"'Motor ve çevrim' kısmında oran sadece
  // kasnak çaplarından türeyecek. El ile herhangi bir giriş olmayacak."*
  // Elle girilen oran spesifikasyon §2.3'ün en ciddi bulgusuydu — Excel'deki
  // elle yazılmış hız oranları bütün gerilmeleri %17 düşürüyordu. O yüzden
  // `direct` kipi sihirbazda YOK ve durum onu `derive`a düşürüyor.
  //
  // Kullanıcı bildirimi (2026-09-02): *"Bazen fan kavraması krank kasnağının
  // hemen önünde oluyor ve krank kasnağı ile aynı devirde dönüyor… Bazen de
  // farklı bir yerde. Bunu seçenek haline getirmemiz lazım."*
  //
  // ÖNCESİNDE "kademe yok" durumu İKİ ÇAPI DA BOŞ BIRAKMAKLA ifade ediliyordu
  // ve o bir SESSİZLİKTİ: "kademe yok" ile "çapları henüz girmedim" aynı
  // görünüyor, ikisi de 1:1 veriyordu. Artık düzen ilan ediliyor ve kademe
  // yokken çap alanları hiç sorulmuyor.
  //
  // TEK ÇAP GİRİLİRSE oran yine 1 kalır ve bu SESSİZ olurdu — o yüzden
  // aşağıda adıyla uyarılıyor (ama yalnız kademe VARKEN; kademe yokken
  // uyarı kullanıcıyı olmayan bir alana yönlendirirdi).
  var _kademe = (s.ratioMode === 'unity' || s.ratioMode === 'crankDirect' || s.ratioMode === 'derive')
              ? s.ratioMode : 'crankDirect';
  var _cOD = _fwNum(s.crankOD, NaN), _fOD = _fwNum(s.fanOD, NaN);
  var _yarim = _kademe === 'derive'
    && (Number.isFinite(_cOD) && _cOD > 0) !== (Number.isFinite(_fOD) && _fOD > 0);
  // ── FEAD'İ NE TAHRİK EDİYOR ─────────────────────────────────────────────
  // Kullanıcı tarifi (2026-09-04) üç düzen ayırıyor; ikisi oran 1 veriyor ve
  // aralarındaki fark ÇAPTA, oranda değil. Sürücü kasnağın çapı ZATEN
  // Kasnaklar tablosunda (sürücü satırı) — buraya ikinci kez sorulmuyor;
  // sorulan şey yalnız KRANK ile o kasnak arasındaki ilişki.
  var _srcOD = null;
  (st.pulleys || []).forEach(function(p){ if(p.driver) _srcOD = _fwNum(p.od, null); });
  var h = _fwCard('Tahrik', 'var(--accent-warning)',
      // LİSTE TEK KAYNAKTAN (`VE_FEAD_DRIVE_MODES`, fead-model.js): Çözücü
      // paneli aynı soruyu soruyor ve ikinci bir kopya tutulduğunda iki yüzey
      // ayrıştı — sihirbazın kurduğu düzen panelin listesinde HİÇ YOKTU.
      _fwGrid([_fwField('Düzen',
        _fwSelHTML('solver.ratioMode', VE_FEAD_DRIVE_MODES, _kademe))], 1)
    + (_kademe === 'derive'
        ? _fwGrid([_fwField('Krank kasnağı Ø [mm]', _fwInp('solver.crankOD', { ph: '197.32' })),
                   _fwField('Kademenin sürülen kasnağı Ø [mm]', _fwInp('solver.fanOD', { ph: '179.62' }))])
        : (_kademe === 'unity'
            ? _fwGrid([_fwField('Krank kasnağı Ø [mm] — motor verisi',
                _fwInp('solver.crankOD', { ph: '197.32' }))], 1)
            : ''))
    + '<div class="ve-fw-reads">'
      + _fwRead('FEAD\'i tahrik eden çap (Kasnaklar tablosundan)',
          _srcOD === null ? '— (sürücü kasnak seçilmedi)' : _fwFmt(_srcOD, 2) + ' mm')
    + '</div>'
    + '<div class="ve-fw-reads">'
      + _fwRead('Tahrik oranı', _fwFmt(dr.ratio, 4))
      + _fwRead('Kaynak', veFeadDriveModeLabel(dr.mode, dr.ok))
    + '</div>'
    + (_yarim
        ? '<div class="ve-fw-issue ve-fw-issue-warn">! <b>Yalnız bir çap girildi.</b> '
          + 'Oran iki çaptan türüyor; biri boşken <b>1:1</b> alınır ve bu, girdiğiniz '
          + 'çapın hiç kullanılmadığı anlamına gelir. İkincisini de girin, ya da ara '
          + 'kademe gerçekten yoksa üstteki seçimi değiştirin.</div>'
        : '')
    );

  // ── MOTOR KÜNYESİ: ON ALAN SAYFADAN KALKTI ──────────────────────────────
  //
  // Kullanıcı bildirimi (2026-09-04): *"bunların girdi olmasına bile gerek
  // yok. Seçilen motor için otomatik gelecek… tıklanır bir buton ve açılır
  // bir pencere ile bu işi halledelim. Çok kalabalık duruyor."*
  //
  // ÖLÇÜLDÜ VE İSTEĞİN YARISI ZATEN DOĞRUYDU: `veFeadEngineApply` katalogdan
  // BEŞ alanı yazıyor (silindir · rölanti · governed · no-load governed ·
  // overspeed) artı iki çapı. Kalan beş alan (servis faktörü, krank mili
  // ataleti, ivmelenme, yavaşlama, boy ofseti) motor kataloğunda HİÇ YOK —
  // hiçbir kayıt taşımıyor, dolayısıyla motordan "otomatik gelemezler".
  // Onlara katalogdan bir değer uydurmak bu modülün sessiz hata sınıfı olurdu.
  //
  // Bu yüzden sayfada KATALOG SEÇİCİSİ + ÖZET OKUMA + bir düğme duruyor;
  // alanların kendisi pencerede. Elle giriş KALDIRILMADI: "katalog bir KISIT
  // değil bir ÖNERİ" kuralı, kullanıcının motoru katalogda olmadığında tek
  // çıkış yolu.
  h += _fwCard('Motor künyesi', 'var(--text-secondary)',
      _fwEngineLibRow(s)
    + _fwEngineKutular(s)
    + '<div class="ve-fw-reads">' + _fwEngineOzet(s) + '</div>'
    + '<div class="ve-fw-rowbtns"><button type="button" class="ve-fw-btn"'
      + ' onclick="veFeadWizEngOpen()">' + veIkon('settings') + ' Künye alanlarını düzenle</button></div>'
    );

  // ── DUTY TABLOSU ─────────────────────────────────────────────────────────
  // SÜRÜCÜ SÜTUNU YOK: gücü çekirdek diğerlerinin toplamı olarak hesaplıyor,
  // elle girilirse çevrim kapanmıyor ve çekirdek reddediyor.
  var yuk = st.pulleys.filter(function(p){ return !p.driver; });
  h += _fwAccCard(st, b, yuk);

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
    cevrimKart = _fwCard('Çevrim',
        'var(--accent-success)',
        _fwField('Çevrim kaydı', '<select class="ve-fw-inp" onchange="veFeadWizDutyLib(this.value)">'
            + ops + '</select>')
      + _fwField('Motor odası sıcaklığı [°C]', _sicaklikAlani(s.duty))
      + '<div class="ve-fw-reads">'
        + _fwRead('Kaynak', secili ? secili.kaynak : 'elle düzenlenmiş tablo')
        + _fwRead('%zaman toplamı', _fwFmt((s.duty || []).reduce(function(a, r){
            return a + _fwNum(r.dcPct, 0); }, 0), 1))
      + '</div>'
      + '<div class="ve-fw-rowbtns"><button type="button" class="ve-fw-btn" id="ve-fw-cevrim-ac"'
        + ' onclick="veFeadWizCevrimAc()">' + veIkon('grid-cells') + ' Çevrim tablosunu aç · '
        + (s.duty || []).length + ' satır</button></div>'
      );
  }

  h += cevrimKart;
  return h;
}

// ÇEVRİM TABLOSU PENCEREDE (çizim masası, 2026-09-29, tasarım tuvali · F):
// sağ sütun 316 px ve tablo aksesuar başına bir sütun taşıyor; sayfada
// çevrim seçici + okumalar + "Çevrim tablosunu aç" düğmesi duruyor, satırlar
// motor künyesi penceresiyle AYNI kabukta düzenleniyor. Grafik masada.
var VE_FW_CEVRIM_OPEN = false;
function veFeadWizCevrimAc(){ VE_FW_CEVRIM_OPEN = true;  veFeadWizCevrimRender(); }
function veFeadWizCevrimKapat(){ VE_FW_CEVRIM_OPEN = false; veFeadWizCevrimRender(); veFeadWizRender(); }
function _fwCevrimTabloHTML(b){
  var st = _fwState, s = st.solver || {};
  var yuk = st.pulleys.filter(function(p){ return !p.driver; });
  // DUTY TABLOSUNDA kW SÜTUNU ARTIK BİR GİRDİ DEĞİL, BİR OKUMA. Kullanıcı
  // aksesuar modelini yukarıdaki karttan seçiyor; buradaki sayı o seçimin
  // (ya da kayıtlı ölçümün) o devirdeki karşılığı. Sütunu tamamen kaldırmak
  // daha kolay olurdu ama kullanıcı hangi devirde ne çekildiğini GÖRMELİ —
  // çekilen güç bütün gerilme zincirini belirliyor.
  var t = '<div class="ve-fw-tblwrap"><table class="ve-fw-tbl"><thead><tr>'
    + '<th>Devir [RPM]</th><th>%zaman</th>'
    + yuk.map(function(p){
        return '<th>' + _fwEsc(p.name || _fwDefName(p.type)) + '<em>kW · okuma</em></th>'; }).join('')
    + '<th></th></tr></thead><tbody>';
  (s.duty || []).forEach(function(r, i){
    t += '<tr>'
      + '<td><input type="text" inputmode="decimal" class="ve-fw-inp" value="' + _fwEsc(r.rpm)
        + '" oninput="veFeadWizDutySet(' + i + ',\'rpm\',this.value)"></td>'
      + '<td><input type="text" inputmode="decimal" class="ve-fw-inp" value="' + _fwEsc(r.dcPct === undefined ? '' : r.dcPct)
        + '" placeholder="—" oninput="veFeadWizDutySet(' + i + ',\'dcPct\',this.value)"></td>'
      + yuk.map(function(p){
          var e = _fwKwEff(b, st, i, p);
          return '<td class="ve-fw-ro" data-fw-kw="' + i + ':' + _fwEsc(p.key) + '"'
            + ' title="' + _fwEsc(VE_FW_KW_SRC[e.kaynak] || '') + '">'
            + (e.kw === null ? '—' : _fwFmt(e.kw, 2)) + '</td>';
        }).join('')
      + '<td class="ve-fw-c"><button type="button" class="ve-fw-x" title="Satırı sil"'
        + ' onclick="veFeadWizDutyDel(' + i + ')">' + veIkon('x') + '</button></td></tr>';
  });
  t += '</tbody></table></div>';

  return t + '<div class="ve-fw-rowbtns"><button type="button" class="ve-fw-btn"'
    + ' onclick="veFeadWizDutyAdd()">+ Devir noktası ekle</button></div>';
}
function _fwCevrimCanli(b){
  if(typeof document === 'undefined' || !_fwState) return;
  var ov = document.getElementById('ve-fw-cevrim');
  if(!ov) return;
  var st = _fwState;
  st.pulleys.forEach(function(p){
    if(p.driver) return;
    (st.solver.duty || []).forEach(function(r, i){
      var td = ov.querySelector('[data-fw-kw="' + i + ':' + p.key + '"]');
      if(!td) return;
      var e = _fwKwEff(b, st, i, p);
      td.textContent = e.kw === null ? '—' : _fwFmt(e.kw, 2);
      td.title = VE_FW_KW_SRC[e.kaynak] || '';
    });
  });
}
function veFeadWizCevrimRender(){
  if(typeof document === 'undefined') return;
  var ov = document.getElementById('ve-fw-cevrim');
  if(!ov) return;
  if(!VE_FW_CEVRIM_OPEN){ ov.style.display = 'none'; ov.innerHTML = ''; return; }
  ov.style.display = 'flex';
  ov.innerHTML = '<div class="ve-fw-ang-box ve-fw-cevrim-box"><header class="ve-fw-card-h">'
    + '<span>Çalışma çevrimi</span></header>'
    + '<div class="ve-fw-card-b" id="ve-fw-cevrim-body">' + _fwCevrimTabloHTML(_fwBuild || veFeadWizBuild())
    + '<div class="ve-fw-ang-row"><span class="ve-fw-lbl"></span>'
    + '<button type="button" class="ve-fw-btn ve-fw-btn-primary" onclick="veFeadWizCevrimKapat()">Kapat</button></div>'
    + '</div></div>';
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
  var eksik = [], sinirsiz = 0, sat = '';
  yuk.forEach(function(p){
    var def = (typeof componentDefs !== 'undefined' && componentDefs[p.type]) || {};
    // Avara ve gergi güç ÇEKMEZ ve devir sınırı taşımaz — satırı yok. "Güç
    // yok" onlar için bir kusur değil, beklenen sonuç.
    if(def.isFeadIdler || def.isFeadTensioner) return;
    var lib = (typeof veFeadPresetLib === 'function') ? veFeadPresetLib(p.type) : null;
    var e = _fwKwEff(b, st, 0, p);
    var kaynakMetin = VE_FW_KW_SRC[e.kaynak] || '—';
    if(e.kaynak === 'katalog' && p.accPreset && lib && lib[p.accPreset])
      kaynakMetin += ' · ' + (lib[p.accPreset].name || p.accPreset);
    if(e.kaynak === 'egri'){
      kaynakMetin += ' · ' + p.pwrCurve.length + ' nokta';
      // BMC künyesi eğriyi düğüme YAZIYOR, yani kaynak "kendi eğrisi" görünür.
      // Hangi künyeden geldiğini yazmazsak kullanıcı seçtiği modeli hiç göremezdi.
      if(p.accLib && typeof veFeadAccOf === 'function'){
        var _a = veFeadAccOf(p.accLib);
        if(_a) kaynakMetin += ' · ' + _a.ad;
      }
    }
    if(e.kaynak === 'yok') eksik.push(p.name || _fwDefName(p.type));

    // TEK SEÇİCİ — model burada seçilir, sınır satırı onun OKUMASI (kullanıcı,
    // 2026-09-01: aynı aksesuarın modeli iki ayrı kartta seçilebiliyordu).
    // SEÇİCİ KENDİ SATIRINDA, tam genişlik: tabloda "güç kaynağı" hücresi
    // seçimle uzayıp payı seçici sütunundan çalıyordu (2026-08-31, ölçülen
    // 362 → 283 px). Satır yapısı o bölüşmeyi hiç kurmuyor.
    var kutu, secenek = veFeadWizAccModelOpts(p.type), suan = veFeadWizAccModelOf(p);
    if(secenek.length){
      var opts = [['', '— seçilmedi —']].concat(secenek);
      kutu = '<select class="ve-fw-inp" onchange="veFeadWizAccModel(\'' + p.key + '\', this.value)">'
        + opts.map(function(o){
            return '<option value="' + _fwEsc(o[0]) + '"'
                 + (String(o[0]) === String(suan) ? ' selected' : '') + '>'
                 + _fwEsc(o[1]) + '</option>'; }).join('') + '</select>';
    } else {
      kutu = '<span class="ve-fw-ro">katalog yok</span>';
    }
    var s = _fwAccSinirHTML(p);
    if(s.eksik) sinirsiz++;
    sat += '<div class="ve-fw-acc" data-fw-k="' + _fwEsc(p.key) + '">'
      + '<div class="ve-fw-acc-h"><b>' + _fwEsc(p.name || _fwDefName(p.type)) + '</b>'
      + '<em class="' + (e.kaynak === 'yok' ? 've-fw-ro-err' : '') + '">' + _fwEsc(kaynakMetin) + '</em></div>'
      + kutu + s.html + '</div>';
  });
  var h = sat || '<div class="ve-fw-ro">Yük taşıyan aksesuar yok.</div>';

  // GÜÇ KAYNAĞI OLMAYAN AKSESUAR ADIYLA söylenir. Eskiden 0 kW ile koşuyordu
  // ve model yine çözülüyordu — bütün açıklık gerilmeleri tasarım gerginliğine
  // düzleşiyordu. Artık işletme hesabı onsuz YAPILMAZ (fead-model.js →
  // veFeadIsletmeEksik).
  if(eksik.length)
    h += '<div class="ve-fw-issue ve-fw-issue-err">' + _fwSorunIkon('err') + ' Gücü hiçbir kaynaktan '
      + 'gelmiyor: <b>' + _fwEsc(eksik.join(', ')) + '</b> — işletme hesabı (gerilme, kayma, ömür) '
      + 'bunlarsız yapılmaz.</div>';
  // SESSİZ "wait" KAPISI: sınırı olmayan aksesuar kapıda hüküm ALMAZ ve bu
  // "geçti" demek DEĞİL. Kullanıcı özet adımında "değerlendirilemedi" görmeden
  // önce burada sebebini görmeli.
  if(sinirsiz)
    h += '<div class="ve-fw-issue ve-fw-issue-warn">' + _fwSorunIkon('warn') + ' <b>' + sinirsiz
      + ' aksesuarın</b> devir sınırı yok; ' + _fwAdimNo('ozet') + '. adımdaki iki kapı onlar için '
      + '<b>değerlendirilemedi</b> der ve <b>uygun sayılmaz</b>.</div>';
  return _fwCard('Aksesuarlar', 'var(--accent-success)', h);
}

// ── AKSESUAR DEVİR SINIRLARI — KAPI GİRDİSİ ────────────────────────────────
//
// Model kartı devir→kW EĞRİSİ veriyor, bu satır SINIR veriyor ve ikisinin
// kaynağı ayrı: eğri Araç Performans kütüphanesinden, sınırlar BMC hesap
// defterinden. SINIR ALANLARI her yük taşıyan aksesuarda durur — kullanıcı su
// pompasının ya da hava kompresörünün sınırını biliyorsa kapı onda da
// çalışsın. Elle girilen değer katalogtan ÜSTÜNDÜR (`veFeadAccLimits`); satırın
// altındaki okuma ETKİN sınırı ve kaynağını yazar.
function _fwAccSinirHTML(p){
  if(typeof veFeadAccLimits !== 'function')
    return { eksik: true, html: '<div class="ve-fw-issue ve-fw-issue-err">' + _fwSorunIkon('err')
      + ' Aksesuar kataloğu yüklenmedi (js/fead-accessories.js).</div>' };
  var lim = veFeadAccLimits(p);
  function alan(a, ad){
    return _fwField(ad, '<input type="text" inputmode="decimal" class="ve-fw-inp"'
      + ' value="' + _fwEsc(p[a] === undefined || p[a] === null ? '' : p[a]) + '"'
      + ' placeholder="—"'
      + ' oninput="veFeadWizPulleySet(\'' + p.key + '\',\'' + a + '\',this.value)">');
  }
  var kay = [lim.optimum, lim.maxCont, lim.maxPeak];
  var eksik = !(lim.maxCont.rpm > 0) && !(lim.maxPeak.rpm > 0);
  var deger = kay.map(function(k){ return k.rpm > 0 ? veSayi(k.rpm, 0) : '—'; }).join(' · ') + ' RPM';
  var elle = kay.some(function(k){ return k.kaynak === 'elle'; });
  // KÜNYE BURADA SEÇİLMEZ, OKUNUR — seçim yukarıdaki model seçicisinde.
  var _rec = (p.accLib && typeof veFeadAccOf === 'function') ? veFeadAccOf(p.accLib) : null;
  var not = eksik ? 'sınır yok'
    : deger + (elle ? ' · elle' : '') + (_rec ? ' · künye ' + veFeadAccLabel(_rec) : '');
  return { eksik: eksik,
    html: '<div class="ve-fw-acc-sinir">'
      + _fwGrid([alan('optimumRpm', 'Optimum'), alan('maxContRpm', 'Maks. sürekli'),
                 alan('maxPeakRpm', 'Maks. anlık')], 3)
      + '<div class="ve-fw-acc-not' + (eksik ? ' ve-fw-acc-not-yok' : '') + '">' + _fwEsc(not) + '</div></div>' };
}

// ── 6 · ÖZET VE KURULUM ────────────────────────────────────────────────────
// Masa tam boy kayış yolunu çizer (`_fwOzetMasa`); bu sütun onun üstünde
// YÜZEN paneldir: sonuç, kapılar, uyarılar ve kurulum.
function _fwStepOzet(b){
  var st = _fwState;
  var h = '';

  // SONUÇ — sayı UYDURULMUYOR: çözüm yoksa "—".
  // KOL AÇISI OKUMASI YOK (kullanıcı isteği, 2026-08-31): çözülmemiş modelde
  // etiket başka bir büyüklüğe (göreli dönme) düşüyordu — tek ad altında iki
  // farklı sayı. Kol açısı gergi adımının kendi ALANINDA.
  var ok = !!(b && b.ok), spin = b && b.spin ? veFeadSpinLabel(b.spin) : null;
  var r = '<div class="ve-fw-reads" data-ve-fw-sonuc="1">'
    + _fwReadHTML('Durum', ok ? 'çözülüyor' : 'çözülemiyor', ok ? 'check' : 'x')
    + _fwRead('Kasnak', String((b && b.order ? b.order.length : st.pulleys.length + 1)))
    + _fwRead('Kayış boyu · gereken', ok ? _fwFmt(b.beltLengthMm, 1) + ' mm' : '—')
    + (ok ? _fwKordRead(b) : '')
    + _fwRead('Tasarım gerginliği', ok ? _fwFmt(b.springTensionN, 1) + ' N' : '—')
    + (spin ? _fwReadHTML('Dönüş yönü', spin.kisa, spin.ikon) : _fwRead('Dönüş yönü', '—'))
    + '</div>';
  h += _fwCard('Sonuç', ok ? 'var(--accent-success)' : 'var(--accent-danger)', r);

  h += _fwChecksCard(b);

  var list = veFeadWizIssues(b);
  if(list.length){
    var ih = '';
    list.forEach(function(it){
      ih += '<div class="ve-fw-issue ve-fw-issue-' + it.tur + '">'
         + _fwSorunIkon(it.tur) + ' ' + _fwEsc(it.m) + '</div>';
    });
    h += _fwCard('Uyarılar', ok ? 'var(--accent-warning)' : 'var(--accent-danger)', ih);
  } else {
    h += _fwCard('Uyarılar', 'var(--accent-success)',
      '<div class="ve-fw-issues ve-fw-issues-ok">' + veIkon('check') + ' Uyarı yok.</div>');
  }

  // ── KURULUM KAPISI ───────────────────────────────────────────────────────
  var kur = veFeadWizCanCreate();
  var kh2 = '<div class="ve-fw-reads">'
    + '<div class="ve-fw-read ve-fw-read-dik"><span>Kurulacak bileşen</span><b>'
      + _fwEsc(_fwKurulumOzet(veFeadWizNodes(st).nodes)) + '</b></div>'
    + _fwRead('Kayış sırası', String(veFeadWizRoute(st).length) + ' kasnak')
    + '</div>';
  if(kur.varOlan > 0){
    // MEVCUT MODEL SESSİZCE SİLİNMEZ. Üstüne kurmak kanvasta iki ayrı kayış
    // yolunun kasnaklarını tek sıraya karıştırırdı; silmek ise kullanıcının
    // verisi. Karar açık onaya bağlı ve `saveState` sayesinde geri alınabilir.
    kh2 += '<label class="ve-fw-check"><input type="checkbox"' + (st.temizle ? ' checked' : '')
      + ' onchange="_fwSetRender(\'temizle\', this.checked)">'
      + '<span>Kanvastaki <b>' + kur.varOlan + ' kasnağı sil</b>, '
      + 'modeli yeniden kur</span></label>';
  }
  if(!kur.ok) kh2 += '<div class="ve-fw-issue ve-fw-issue-err">' + _fwSorunIkon('err') + ' ' + _fwEsc(kur.sebep) + '</div>';
  h += _fwCard('Kurulum', 'var(--accent-primary)', kh2);
  return h;
}

// ── UYGUNLUK KAPILARI — KURMADAN ÖNCE ──────────────────────────────────────
//
// BMC hesap defterinden gelen üç kapı (js/fead-checks.js), panelin bastığı
// kartla AYNI çağrıdan. Sihirbazda yeri ÖZET adımı çünkü kullanıcı "Modeli
// Kur"a basmadan önce kasnak çapını düzeltebilsin — kurduktan sonra görmek,
// düzeltmeyi kanvasa taşımak demekti.
//
// Kapılar HESAPLANMIYOR, sorulan şey aynı: `veFeadChecks(b, opt)`. İkinci bir
// hesap iki yüzeyin sessizce ayrışması olurdu (modülün tekrar eden kuralı).
function _fwChecksCard(b){
  if(typeof veFeadChecks !== 'function')
    return _fwCard('Uygunluk kapıları', 'var(--text-muted)',
      '<div class="ve-fw-issue ve-fw-issue-err">' + _fwSorunIkon('err') + ' Uygunluk kapıları yüklenmedi '
      + '(js/fead-checks.js).</div>');
  var st = _fwState, s = (st && st.solver) || {};
  var R = veFeadChecks(b, veFeadCheckOpt(s, s.duty || []));

  var HUKUM = { ok: 'uygun', warn: 'sınırda', no: 'kontrol', wait: 'değerlendirilemedi' };
  var IKON = { ok: 'check', warn: 'alert-triangle', no: 'x', wait: 'minus' };
  function pay(v){
    var sinif = !Number.isFinite(v) ? 've-fw-ro' : (v < 0 ? 've-fw-err' : (v < 10 ? 've-fw-warn' : ''));
    return '<span class="' + sinif + '">' + (Number.isFinite(v) ? '%' + _fwFmt(v, 1) : '—') + '</span>';
  }
  function tablo(bas, govde){
    return '<div class="ve-fw-tblwrap"><table class="ve-fw-tbl"><thead><tr>' + bas
      + '</tr></thead><tbody>' + govde + '</tbody></table></div>';
  }
  // KAPI BAŞINA TEK SATIR HÜKÜM (çizim masası, tasarım tuvali · F-6): ad ·
  // hüküm ve en kritik satır — çizimde kesikli olan çift, tepe devir ve payı.
  // Satırların tamamı aynı kapının açılır ayrıntısında; ikinci bir hesap yok.
  function kapi(ad, durum, not, tbl, n){
    var d = HUKUM[durum] ? durum : 'wait';
    return '<div class="ve-fw-gate" data-durum="' + d + '">'
      + '<span class="ve-fw-gate-ikon">' + veIkon(IKON[d]) + '</span>'
      + '<div class="ve-fw-gate-g"><div class="ve-fw-gate-h"><b>' + _fwEsc(ad) + '</b> '
      + '<span class="ve-fw-gate-hk">' + HUKUM[d] + '</span></div>'
      + (not ? '<em>' + not + '</em>' : '')
      + (tbl ? '<details class="ve-fw-gate-d"><summary>' + n + ' satır</summary>' + tbl + '</details>' : '')
      + '</div></div>';
  }

  var h = '';
  // 1 — merkez mesafesi · 0,7·(d₁+d₂) ≤ a ≤ 2·(d₁+d₂)
  var c = R.centerDistance, cn = c.note ? _fwEsc(c.note) : '';
  var cw = c.worst;
  if(cw && !cn)
    cn = _fwEsc(cw.cift) + ': a = ' + _fwFmt(cw.a, 1) + ' mm, '
      + (cw.a > cw.hi ? 'üst sınır ' + _fwFmt(cw.hi, 1) : cw.a < cw.lo ? 'alt sınır ' + _fwFmt(cw.lo, 1)
         : 'pencere ' + _fwFmt(cw.lo, 1) + '–' + _fwFmt(cw.hi, 1)) + ' · pay ' + pay(cw.payPct);
  h += kapi('Kasnak merkez mesafesi', c.durum, cn, c.rows.length
    ? tablo('<th>Çift</th><th>alt</th><th>a</th><th>üst</th><th>pay</th>',
        c.rows.map(function(r){
          return '<tr><td>' + _fwEsc(r.cift) + '</td>'
            + '<td class="ve-fw-ro">' + _fwFmt(r.lo, 1) + '</td>'
            + '<td class="ve-fw-ro">' + _fwFmt(r.a, 1) + '</td>'
            + '<td class="ve-fw-ro">' + _fwFmt(r.hi, 1) + '</td>'
            + '<td class="ve-fw-ro">' + pay(r.payPct) + '</td></tr>'; }).join('')) : '', c.rows.length);

  // 2 — çevrim oranı penceresi
  var w = R.ratioWindow, wn = w.note ? _fwEsc(w.note) : '';
  if(!wn && w.rows.length){
    var kotu = w.rows.filter(function(r){ return !r.ok; })[0];
    wn = kotu ? _fwEsc(kotu.ad + ': ' + kotu.metin)
      : _fwEsc('governed ' + _fwFmt(w.governedRpm, 0) + ' RPM · ' + w.rows.length + ' aksesuar pencerede');
  }
  h += kapi('Çevrim oranı penceresi', w.durum, wn, w.rows.length
    ? tablo('<th>Aksesuar</th><th>optimum</th><th>devir</th><th>sürekli</th><th>hüküm</th>',
        w.rows.map(function(r){
          return '<tr><td>' + _fwEsc(r.ad) + '</td>'
            + '<td class="ve-fw-ro">' + _fwFmt(r.optimumRpm, 0) + '</td>'
            + '<td class="ve-fw-ro">' + _fwFmt(r.accRpm, 0) + '</td>'
            + '<td class="ve-fw-ro">' + _fwFmt(r.maxContRpm, 0) + '</td>'
            + '<td class="' + (r.ok ? 've-fw-ok' : 've-fw-err') + '">'
            + _fwEsc(r.metin) + '</td></tr>'; }).join('')) : '', w.rows.length);

  // 3 — aksesuar devir sınırı (sürekli ve anlık maksimum)
  var sp = R.speedLimit, sn = sp.note ? _fwEsc(sp.note) : '';
  if(sp.rows.length){
    var kr = null;
    sp.rows.forEach(function(r){ if(!kr || r.payPct < kr.payPct) kr = r; });
    var q = kr && kr.kritik;
    if(q) sn = (sn ? sn + ' · ' : '') + _fwEsc(kr.ad + ' ' + q.ad + ' ' + _fwFmt(q.accRpm, 0) + ' / '
      + _fwFmt(q.limit, 0) + ' RPM ' + q.limitAd) + ' · pay ' + pay(q.payPct);
  }
  var g = '';
  sp.rows.forEach(function(r){
    r.noktalar.forEach(function(q2, k){
      g += '<tr><td>' + (k === 0 ? _fwEsc(r.ad) : '') + '</td>'
        + '<td>' + _fwEsc(q2.ad) + '</td>'
        + '<td class="ve-fw-ro">' + _fwFmt(q2.accRpm, 0) + '</td>'
        + '<td class="ve-fw-ro">' + _fwFmt(q2.limit, 0) + ' ' + _fwEsc(q2.limitAd) + '</td>'
        + '<td class="ve-fw-ro">' + pay(q2.payPct) + '</td></tr>';
    });
  });
  h += kapi('Aksesuar devir sınırı', sp.durum, sn, sp.rows.length
    ? tablo('<th>Aksesuar</th><th>nokta</th><th>devir</th><th>sınır</th><th>pay</th>', g) : '', sp.rows.length);

  var d = [c.durum, w.durum, sp.durum];
  var renk = d.indexOf('no') >= 0 ? 'var(--accent-danger)'
           : d.indexOf('warn') >= 0 ? 'var(--accent-warning)'
           : d.indexOf('wait') >= 0 ? 'var(--text-muted)' : 'var(--accent-success)';
  return _fwCard('Uygunluk kapıları', renk,
    '<div data-ve-fw-checks="1" data-ve-fw-checks-durum="' + _fwEsc(d.join('/')) + '">'
      + h + '</div>');
}

// KURULACAKLAR LİSTESİ KURULUMUN KENDİSİNDEN (veFeadWizNodes) — elle yazılmış
// liste bayatladı: 2026-09-23'te tablo kanvas bileşeni olmaktan çıktı, metin
// 29'una kadar "… + tablo + rapor" saymaya devam etti. Adlar bileşen adları
// (`componentDefs.name`), kasnaklar gergi dâhil tek sayıda, aynı tipten
// birden fazlası sayısıyla ("2 Kayış Yolu").
function _fwKurulumOzet(liste){
  liste = liste || [];
  var kasnak = 0, sira = [], say = {};
  liste.forEach(function(n){
    var d = (typeof componentDefs !== 'undefined' && componentDefs[n.type]) || {};
    if(d.isFeadPulley){ kasnak++; return; }
    var ad = d.name || n.type;
    if(!say[ad]){ say[ad] = 0; sira.push(ad); }
    say[ad]++;
  });
  var parca = [];
  if(kasnak) parca.push(kasnak + ' kasnak (gergi dâhil)');
  sira.forEach(function(ad){ parca.push((say[ad] > 1 ? say[ad] + ' ' : '') + ad); });
  return liste.length + ' — ' + parca.join(' · ');
}

// Kurulum kapısı — sebebiyle birlikte.
function veFeadWizCanCreate(){
  var out = { ok: true, sebep: '', varOlan: 0 };
  if(!_fwState){ out.ok = false; out.sebep = 'Sihirbaz durumu yok.'; return out; }
  if(typeof nodes !== 'undefined' && nodes && typeof _feadIsPulley === 'function')
    out.varOlan = nodes.filter(function(n){ return _feadIsPulley(n); }).length;
  if(out.varOlan > 0 && !_fwState.temizle){
    out.ok = false;
    out.sebep = 'İç topolojide zaten ' + out.varOlan + ' kasnak var. Üstüne kurmak '
      + 'iki ayrı kayış yolunun kasnaklarını TEK sıraya karıştırır; silme onayını '
      + 'işaretleyin ya da kasnakları elle kaldırın.';
    return out;
  }
  // GERGİNİN SAYILARI ARTIK TOHUMDAN GELMİYOR (2026-09-22) — kapı da burada.
  // Olmasaydı "kullanıcı seçsin" isteği, çözülemeyen bir model kurmakla
  // sonuçlanırdı: köprü hatayı adıyla verir ama kullanıcı onu ancak kurulum
  // BİTTİKTEN sonra, başka bir yüzeyde görürdü.
  var _t = _fwState.ten || {};
  var _eksik = [];
  if(!Number.isFinite(_fwNum(_t.od, NaN))) _eksik.push('kasnak çapı');
  if(!Number.isFinite(_fwNum(_t.armLen, NaN))) _eksik.push('kol boyu');
  if(_eksik.length){
    out.ok = false;
    out.sebep = 'Otomatik gerginin ' + _eksik.join(' ve ') + ' girilmedi. '
      + _fwAdimNo('gergi') + '. adımda ("Otomatik Gergi") ya katalogdan bir künye seçin ya da '
      + 'değerleri elle girin — gergisiz ya da eksik gergiyle model çözülmez.';
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
//  KURULUM — durum → kanvas
// ════════════════════════════════════════════════════════════════════════════
//
// Yol örnek kurucusununkiyle (veFeadLoadExample) AYNI ve bu bilinçli: düğümleri
// `createNode` kuruyor (kimlikler ve DOM oradan), `data` birebir
// kopyalanıyor, duty kW sözlüğü kimlik göçünden geçiyor ve yerleştirme tek
// noktadan (veFeadArrangeByCoords) yapılıyor. İkinci bir kurucu yazmak, iki
// yolun sessizce ayrışması demekti.
function veFeadWizCreate(){
  // BİR KULLANICI EYLEMİ = BİR GERİ-AL ADIMI (bkz. js/state.js → veStateBatch).
  // Bu kurucu ONİKİ düğüm kuruyor ve `createNode` her birinde `saveState()`
  // çağırıyor: sarılmazsa Ctrl+Z modeli düğüm düğüm SÖKER (ölçüldü — 12.
  // basışta Kayış Tablosu boşalıyor, 13.'te kart tamamen gidiyordu).
  // Yığın zaten toplu kurulumdaysa (sihirbaz açılış yüzeyini çağırıyor)
  // ikinci kez sarılmaz — sayaç iç içe geçmeyi taşıyor.
  if(typeof veStateBatch === 'function' && typeof veStateBatchActive === 'function'
     && !veStateBatchActive())
    return veStateBatch(function(){ return veFeadWizCreate(); });
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
  // Kasnaklar gider; araç düğümleri (kayış, çözücü, kanvaslar, rapor) KALIR
  // ve aşağıda yeniden KULLANILIR — maxInstances:1 taşıyan düğümler ikinci kez
  // kurulamaz, ve kullanıcının kart ölçüsü / rapor türü gibi tercihlerini çöpe
  // atmanın karşılığı yok.
  if(st.temizle) _fwClearPulleys();

  // Araç düğümleri: VARSA yeniden kullan, yoksa kur.
  //
  // AÇILIŞ YÜZEYİNİN BOŞ KAYIŞ YOLU KARTI da bu yoldan YENİDEN KULLANILIR
  // (Çizim Masası, 2026-09-23 — tablo artık bir kanvas bileşeni değil):
  // `fead-layout:geometri` anahtarı onu yakalar, ikinci bir kart kurulmaz.
  //
  // EŞLEŞME TİPE DEĞİL, TİP + ÖN AYARA BAKAR. `fead-layout` artık İKİ KEZ
  // geçiyor (geometri + işletme kanvası, aynı tip — 2026-09-11). Yalnız tipe
  // bakan bir eşleşmenin iki sessiz kaçağı vardı: (1) tek düğüm tutulursa
  // ikinci kanvas her "Modeli Kur"da yeniden kurulur ve kartlar üst üste
  // açıldığı için sayı ancak taşındıklarında fark edilir; (2) kuyruk tutulup
  // sıraya güvenilirse `nodes` dizisinde işletme kartı önce duruyorsa
  // GEOMETRİ kartının üstüne `katOn:'isletme'` yazılır — kullanıcının donuk
  // şeması sebepsizce gerilme haritasına döner.
  var araclar = {};
  function _fwAracAnahtar(n){
    if(!n || !n.type) return '';
    if(n.type !== 'fead-layout') return n.type;
    return 'fead-layout:' + ((n.data && n.data.katOn === 'isletme') ? 'isletme' : 'geometri');
  }
  ['fead-belt', 'fead-solver', 'fead-layout:geometri', 'fead-layout:isletme',
   'fead-report'].forEach(function(t){ araclar[t] = []; });
  nodes.forEach(function(n){
    var k = _fwAracAnahtar(n);
    if(araclar.hasOwnProperty(k)) araclar[k].push(n);
  });

  // ── YEDEK YERLEŞİM ORTAK YERDEN ─────────────────────────────────────────
  //
  // Asıl yerleştirme aşağıdaki `veFeadArrangeByCoords` ile yapılıyor; burası
  // İLK KARE ve o yol patlarsa (try/catch yutuyor) geçerli kalan sıra. Eskiden
  // burada 120×110'luk düz bir ızgara vardı ve iki 440×500'lük kanvası 120 px
  // arayla koyuyordu: 320 px ÜST ÜSTE. Sessizdi — kartlar üst üste açıldığı
  // için tek kart gibi görünüyorlardı.
  //
  // Şekil artık örnek kurucusuyla AYNI kaynaktan (`veFeadFallbackSlots`):
  // kanvaslar sağda bir sıra, künyeler solda. Kutusuz
  // tipler (kasnaklar) `null` döner ve eski ızgarada kalır — kanvasta yerleri
  // olmadığı için görünen bir şey değişmiyor, yalnız createNode'a bir
  // koordinat gerekiyor.
  var _yuva = (typeof veFeadFallbackSlots === 'function')
    ? veFeadFallbackSlots(pack.nodes)
    : pack.nodes.map(function(){ return null; });
  function _fwYuva(i){
    return _yuva[i] || { lx: 60 + (i % 4) * 120, ly: 120 + Math.floor(i / 4) * 110 };
  }
  var base = (typeof veArrangeModuleBase === 'function')
    ? veArrangeModuleBase(pack.nodes.map(function(_, i){ return _fwYuva(i); }))
    : { x: 3000, y: 3000 };

  // YUVA DÜĞÜMÜN KENDİ SIRASINDAN, kurulan-düğüm SAYACINDAN değil: yuvalar
  // `pack.nodes`in tiplerinden türüyor (kanvaslar sağda, künyeler solda).
  // Sayaçla indekslemek, zaten duran bir araç atlandığında sonrakilere BAŞKA
  // tipin yuvasını verirdi — çözücü kutusu bir kanvasın yerine düşerdi.
  var kuruldu = [], idMap = {};
  pack.nodes.forEach(function(src, _i){
    var kuyruk = araclar[_fwAracAnahtar(src)];
    var mevcut = (kuyruk && kuyruk.length) ? kuyruk.shift() : null;   // ikinci kez eşleşmesin
    if(mevcut){
      // Araç düğümü zaten duruyor: verisini tazele, kimliğini haritaya yaz.
      mevcut.data = Object.assign(mevcut.data || {}, JSON.parse(JSON.stringify(src.data)));
      // YUVASINI DA ALIR. Yuva listesi paketin BÜTÜN düğümleri için kuruldu;
      // devralınan düğüm eski yerinde kalırsa ona ayrılan yuva boş kalır ve
      // yedek yolda sırada bir kart boşluğu açılır — açılış yüzeyinin boş
      // Kayış Yolu kartı ile yeni kurulan işletme kartı ayrı iki tabandan
      // ölçülmüş olur (örnek kurucusundaki kuralın aynısı).
      var _ys = _fwYuva(_i);
      mevcut.x = Math.round(base.x + _ys.lx);
      mevcut.y = Math.round(base.y + _ys.ly);
      var _mel = (typeof document !== 'undefined') ? document.getElementById(mevcut.id) : null;
      if(_mel){ _mel.style.left = mevcut.x + 'px'; _mel.style.top = mevcut.y + 'px'; }
      idMap[src.id] = mevcut.id;
      kuruldu.push(mevcut);
      return;
    }
    var once = nodes.length;
    var _s = _fwYuva(_i);
    createNode(src.type, base.x + _s.lx, base.y + _s.ly);
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
  // aksesuar eşleşmez: eskiden hepsi 0 kW ile koşar, gerilmeler tasarım
  // gerginliğine düzleşirdi; bugün işletme kapısı "gücü yok" diye durdurur
  // (FEAD kural 46).
  if(typeof veFeadRemapDutyKw === 'function')
    kuruldu.forEach(function(n){
      if(n.data && Array.isArray(n.data.duty)) veFeadRemapDutyKw(n.data.duty, idMap);
    });

  // "Başlangıç ve Örnekler" düğümünü silen döngü KALKTI: o bileşen artık hiç
  // kurulmuyor (2026-09-09, kullanıcı isteği). SİHİRBAZ DÜĞÜMÜ KALIR: taşıdığı
  // form kullanıcının kendi girdisi, silmek onu çöpe atmak olurdu.
  //
  // SAYAÇ TAZELENİR. `nodes` dizisi doğrudan splice edildi (deleteSelectedNodes
  // bilerek kullanılmıyor — o `selectedNodes` global'ini tüketiyor), dolayısıyla
  // araç çubuğunun "N bileşen" sayacı ve minimap kendiliğinden güncellenmiyor.
  // ÖLÇÜLDÜ (gerçek tarayıcı): sihirbaz kurulumundan sonra dizi 12 düğüm
  // taşırken çubuk 13 diyordu — bir sonraki topoloji değişimine kadar bayat.
  if(typeof updateNodeCount === 'function') updateNodeCount();
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
      + kuruldu.filter(function(n){ return _feadIsPulley(n); }).length
      + ' kasnak kayış sırasında.', 'success');
  return kuruldu;
}

// Kasnakları kaldır (ve elle düzenlenmiş bir dosyada onlara bağlı kalmış bir
// tel varsa onu da). `deleteSelectedNodes` KULLANILMAZ:
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
//  PANEL — düğümün kendi yüzeyi · KRANK KASNAĞI AİLESİNDE
// ════════════════════════════════════════════════════════════════════════════
// Kullanıcı isteği (2026-09-23): FEAD pencereleri Krank Kasnağı'nın yapısında,
// KATEGORİ KATEGORİ. İki kategori: TASLAK (düğümde kayıtlı yarım model) ve
// ADIMLAR (sihirbazın ne sorduğu). Pencerenin EYLEMİ "Sihirbazı Aç".
//
// ADIM LİSTESİ `VE_FW_STEPS`TEN, elle yazılmaz. Eski metin "bütün girdileri
// YEDİ adımda sorar: … kayış yolu sırası …" diyordu; Kayış Yolu adımı
// 2026-09-04'te kaldırılmıştı ve sihirbaz altı adımdı. Elle yazılan özet
// sessizce bayatlar — bu deponun tekrar eden dersi.
//
// Kart gövdesi FEAD pencerelerinin grameri (`_feadCard` · `_feadRO` ·
// `_feadHint`), sihirbaz MODALININ grameri (`_fwCard`) değil: bu yüzey
// modalın bir adımı değil, bir bileşen penceresi.
function getFeadWizardPropertiesHTML(node){
  if(!node.data) node.data = {};
  var w = node.data.wiz;
  var kasnak = (w && w.pulleys) ? w.pulleys.length : 0;
  var nokta = (w && w.solver && w.solver.duty) ? w.solver.duty.length : 0;

  var taslak = w
    ? _feadCard('Kayıtlı taslak', 'bu düğümde', 'var(--accent-primary)',
        '<div class="ve-fp-grid" style="--fp-k:1;">'
      + _feadRO('Sistem', w.ad || '—')
      + _feadRO('Kasnak', kasnak + ' (+ gergi)')
      + _feadRO('Çalışma çevrimi', nokta + ' devir noktası')
      + '</div>')
    : _feadCard('Kayıtlı taslak', 'bu düğümde', 'var(--text-muted)',
        _feadHint('Henüz taslak yok. Sihirbazı açıp boş başlayabilir ya da hazır bir '
          + 'örnekten doldurabilirsiniz.'));
  taslak += _feadHint('Sihirbaz <b>FEAD araçları</b> penceresinden açılır. Kurulumdan sonra '
    + 'taslak modelde kalır — geri dönüp bir sayıyı düzeltebilirsiniz.');

  var adimlar = _feadCard('Adımlar', VE_FW_STEPS.length + ' adım', 'var(--accent-primary)',
      '<ol class="ve-fp-liste">' + VE_FW_STEPS.map(function(s){
        return '<li><b>' + _fwEsc(s.ad) + '</b> — ' + _fwEsc(s.ipucu) + '</li>';
      }).join('') + '</ol>'
    + _feadHint('Her adımda model <b>canlı çözülür</b>, yani eksik girdiyi son adımı '
      + 'beklemeden görürsünüz.'));

  var eylem = '<button type="button" class="ve-fp-solve" onclick="veFeadWizOpen(\''
    + node.id + '\')"><span class="mf-ico mf-ico-wand" aria-hidden="true"></span>'
    + ' Sihirbazı Aç</button>';
  var yan = veFeadToolSide(node, null, null, null, eylem);
  return veFeadPanelShell(node, [{ k:'tas', ad:'Taslak',  govde: taslak },
                                 { k:'adm', ad:'Adımlar', govde: adimlar }], yan);
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    VE_FW_STEPS: VE_FW_STEPS, VE_FW_PULLEY_TYPES: VE_FW_PULLEY_TYPES,
    _fwAdimNo: _fwAdimNo, _fwKurulumOzet: _fwKurulumOzet, _fwKun: _fwKun, veFeadWizLive: veFeadWizLive,
    // ÇİZİM MASASI (tasarım tuvali · F)
    _fwMasaHTML: _fwMasaHTML, _fwMasaCizim: _fwMasaCizim, _fwMasaLejantHTML: _fwMasaLejantHTML,
    _fwMasaYenile: _fwMasaYenile, _fwEksenSVG: _fwEksenSVG, _fwGuzelAdim: _fwGuzelAdim,
    _fwKasnakMasa: _fwKasnakMasa, _fwKasnakXY: _fwKasnakXY, _fwKasnakTasi: _fwKasnakTasi,
    _fwKasnakListeHTML: _fwKasnakListeHTML, _fwKasnakEditorHTML: _fwKasnakEditorHTML,
    _fwSarimlar: _fwSarimlar, _fwMasaTus: _fwMasaTus, veFeadWizSec: veFeadWizSec,
    veFeadWizZoom: veFeadWizZoom, veFeadWizGergiGor: veFeadWizGergiGor,
    veFeadWizKasnakEkle: veFeadWizKasnakEkle, veFeadWizTemas: veFeadWizTemas,
    veFeadWizTenTemas: veFeadWizTenTemas, veFeadWizMasaBas: veFeadWizMasaBas,
    _fwGergiVeri: _fwGergiVeri, _fwGergiMasa: _fwGergiMasa, _fwYayGrafikHTML: _fwYayGrafikHTML,
    _fwCevrimMasa: _fwCevrimMasa, _fwCevrimGrafik: _fwCevrimGrafik, _fwDevirGrafik: _fwDevirGrafik,
    _fwOzetMasa: _fwOzetMasa, _fwMerkezKatman: _fwMerkezKatman, _fwOzetKapilar: _fwOzetKapilar,
    _fwKayisMasa: _fwKayisMasa, _fwKaynakMasa: _fwKaynakMasa,
    veFeadWizCevrimAc: veFeadWizCevrimAc, veFeadWizCevrimKapat: veFeadWizCevrimKapat,
    // Görünüm durumu (modelde değil) — kapılar okur ve kurar.
    VE_FW_OZET_PANEL: VE_FW_OZET_PANEL, VE_FW_MASA_K: VE_FW_MASA_K, VE_FW_MASA_PAY: VE_FW_MASA_PAY,
    _fwMasaDurum: function(y){
      if(y){
        if('sec' in y) _fwSec = y.sec;
        if('zoom' in y) _fwZoom = y.zoom;
        if('gergi' in y) _fwGergiGor = y.gergi;
        if('masa' in y) _fwMasa = y.masa;
      }
      return { sec: _fwSec, zoom: _fwZoom, gergi: _fwGergiGor, masa: _fwMasa, xf: _fwMasaXf,
               kat: _fwMasaKat, izgara: _fwMasaIzgara };
    },
    veFeadWizEngineLib: veFeadWizEngineLib, veFeadWizAccLib: veFeadWizAccLib,
    _fwEngineLibRow: _fwEngineLibRow, _fwAccSinirHTML: _fwAccSinirHTML, _fwEngineKutular: _fwEngineKutular,
    _fwChecksCard: _fwChecksCard,
    veFeadWizDefault: veFeadWizDefault, veFeadWizState: veFeadWizState,
    veFeadWizNodes: veFeadWizNodes, veFeadWizRoute: veFeadWizRoute,
    veFeadWizServisSec: veFeadWizServisSec, _fwStepKayis: _fwStepKayis,
    veFeadWizSurtunmeSec: veFeadWizSurtunmeSec,
    veFeadWizBuild: veFeadWizBuild, veFeadWizSeed: veFeadWizSeed,
    _fwTeX: _fwTeX, veFeadWizTeXPaint: veFeadWizTeXPaint,
    veFeadWizEngOpen: veFeadWizEngOpen, veFeadWizEngClose: veFeadWizEngClose,
    veFeadWizEngHTML: veFeadWizEngHTML, veFeadWizEngRender: veFeadWizEngRender,
    VE_FW_ENG_FIELDS: VE_FW_ENG_FIELDS, _fwEngineOzet: _fwEngineOzet,
    veFeadWizDutyTemp: veFeadWizDutyTemp, veFeadWizDutyTempOf: veFeadWizDutyTempOf,
    veFeadWizSeedStep: veFeadWizSeedStep,
    veFeadWizPulleyAdd: veFeadWizPulleyAdd, veFeadWizPulleyDel: veFeadWizPulleyDel,
    veFeadWizPulleySet: veFeadWizPulleySet, veFeadWizPulleyType: veFeadWizPulleyType,
    veFeadWizPulleyMove: veFeadWizPulleyMove,
    veFeadWizDriver: veFeadWizDriver, veFeadWizRouteMove: veFeadWizRouteMove,
    veFeadWizRouteReverse: veFeadWizRouteReverse, veFeadWizTenLib: veFeadWizTenLib,
    veFeadWizSpinSet: veFeadWizSpinSet, veFeadWizSpinHTML: veFeadWizSpinHTML,
    veFeadWizTenLocked: veFeadWizTenLocked, _fwTenAd: _fwTenAd,
    veFeadWizArmShown: veFeadWizArmShown, _fwArmAngleField: _fwArmAngleField,
    veFeadWizAngOpen: veFeadWizAngOpen, veFeadWizAngClose: veFeadWizAngClose,
    veFeadWizAngOk: veFeadWizAngOk, veFeadWizAngType: veFeadWizAngType,
    veFeadWizAngScene: veFeadWizAngScene, veFeadWizAngSVG: veFeadWizAngSVG,
    veFeadWizAngHTML: veFeadWizAngHTML, veFeadWizAngFromPoint: veFeadWizAngFromPoint,
    // Kapı ÜRETİLEN DOM'a bakabilsin diye: gövde üreticisini yoklamak
    // pencereyi yoklamak değil (bkz. `<em>fareyle</em>` kaçağı).
    veFeadWizAngRender: veFeadWizAngRender,
    veFeadWizAngZoom: veFeadWizAngZoom, VE_FW_ANG_ZOOM: VE_FW_ANG_ZOOM,
    veFeadWizAngHover: veFeadWizAngHover, veFeadWizAngPick: veFeadWizAngPick,
    veFeadWizAngLeave: veFeadWizAngLeave, _fwAngReads: _fwAngReads,
    veFeadWizAngState: function(){ return VE_FW_ANG; },
    veFeadWizDutyAdd: veFeadWizDutyAdd,
    veFeadWizDutyLib: veFeadWizDutyLib, veFeadWizDutyDel: veFeadWizDutyDel,
    veFeadWizDutySet: veFeadWizDutySet, veFeadWizDutyKw: veFeadWizDutyKw,
    veFeadWizTenSet: veFeadWizTenSet,
    veFeadWizTenCoordKeys: veFeadWizTenCoordKeys,
    veFeadWizAccPreset: veFeadWizAccPreset, veFeadWizAccModel: veFeadWizAccModel,
    veFeadWizAccModelOpts: veFeadWizAccModelOpts, veFeadWizAccModelOf: veFeadWizAccModelOf,
    _fwKwEff: _fwKwEff, _fwAccCard: _fwAccCard,
    _fwCevrimTabloHTML: _fwCevrimTabloHTML, veFeadWizCevrimRender: veFeadWizCevrimRender,
    veFeadWizIssues: veFeadWizIssues,
    veFeadWizStepState: veFeadWizStepState, veFeadWizStepOf: veFeadWizStepOf,
    veFeadWizCanCreate: veFeadWizCanCreate, veFeadWizCreate: veFeadWizCreate,
    veFeadWizOpen: veFeadWizOpen, veFeadWizClose: veFeadWizClose,
    veFeadWizSeedPick: veFeadWizSeedPick,
    veFeadWizGo: veFeadWizGo, veFeadWizGoto: veFeadWizGoto,
    veFeadWizRender: veFeadWizRender, veFeadWizStepHTML: veFeadWizStepHTML,
    veFeadWizNavHTML: veFeadWizNavHTML, veFeadWizFootHTML: veFeadWizFootHTML,
    veFeadWizLiveHTML: veFeadWizLiveHTML, veFeadWizReset: veFeadWizReset,
    veFeadWizStpRolTipleri: veFeadWizStpRolTipleri, veFeadWizStpOneriUygula: veFeadWizStpOneriUygula,
    getFeadWizardPropertiesHTML: getFeadWizardPropertiesHTML,
    _fwSet: _fwSet, _fwSetRender: _fwSetRender, _fwGet: _fwGet,
    // STEP'ten başla (kural 34)
    _fwSeedKayit: _fwSeedKayit, _fwStpKartHTML: _fwStpKartHTML,
    veFeadWizStpDosya: veFeadWizStpDosya, veFeadWizStpBayt: veFeadWizStpBayt,
    veFeadWizStpOku: veFeadWizStpOku, veFeadWizStpRol: veFeadWizStpRol,
    veFeadWizStpAyna: veFeadWizStpAyna, veFeadWizStpKapat: veFeadWizStpKapat,
    veFeadWizStpDenetim: veFeadWizStpDenetim, veFeadWizStpAktar: veFeadWizStpAktar,
    veFeadWizStpDrop: veFeadWizStpDrop, veFeadWizStpSurukle: veFeadWizStpSurukle,
    veFeadWizStpHesapla: veFeadWizStpHesapla, _fwStpCizimSVG: _fwStpCizimSVG,
    veFeadWizSiraOnay: veFeadWizSiraOnay, VE_FW_SIRA_AGAC: VE_FW_SIRA_AGAC,
    veFeadWizStp: veFeadWizStp,
    // 3B görüntüleyicinin paneli (js/cp-fead-3b.js) bunları kullanıyor
    _fwEsc: _fwEsc, _fwFmt: _fwFmt, _fwStpRolAd: _fwStpRolAd, _fwStpRolDenetim: _fwStpRolDenetim,
    _fwStpSecim: _fwStpSecim, _fwStpKayisTanim: _fwStpKayisTanim, _fwStpOneriHTML: _fwStpOneriHTML,
    _fwStpHesapCap: _fwStpHesapCap, veFeadWizStpHesapCap: veFeadWizStpHesapCap, _fwStpHesapCapi: _fwStpHesapCapi,
    _fwStpHesapCapHTML: _fwStpHesapCapHTML, _fwStpKasnakKesitHTML: _fwStpKasnakKesitHTML, _fwStpKord: _fwStpKord,
    _fwStpKayisBirim: _fwStpKayisBirim, _fwStpHesapCapMatrisHTML: _fwStpHesapCapMatrisHTML,
    _fwStpKayisKesitHTML: _fwStpKayisKesitHTML, _fwStpHesapCapEtiket: _fwStpHesapCapEtiket,
    _fwCadKayisHTML: _fwCadKayisHTML, veFeadWizKey: veFeadWizKey
  };
}
