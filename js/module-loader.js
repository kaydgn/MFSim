/**
 * js/module-loader.js — MODÜL GİRİŞ EKRANI
 *
 * Kullanıcı isteği (2026-09-21): *"ana ekrandan FEAD modülüne tıkladıktan
 * sonra, direk program içine giriyor, yani güzel bir yükleme ekranı olur, ne
 * bileyim daha profesyonel bir görüntü olur."*
 *
 * İKİ İŞ, BİR YÜZEY. Karşılama kartına tıklamak eskiden yalnız ana tuvale bir
 * kart bırakıyordu; içeri girmek için o karta AYRICA çift tıklamak
 * gerekiyordu ve bunu söyleyen hiçbir şey yoktu. Artık tıklama modülün
 * içine kadar götürüyor, ve aradaki iş bu ekranın altında akıyor.
 *
 * ÜÇÜNCÜ BİR PENCERE DİLİ KURULMADI. Sınıfların hepsi açılış ekranının
 * kendi sınıfları (`.mfsim-loading-*`): aynı panel konumu, aynı kademe
 * çubuğu, aynı öbek listesi. Program açılırken gördüğünüz yüzeyin aynısı,
 * bu sefer modül için. Yeni olan tek şey `.mfsim-module-loading` — o da
 * yalnız fotoğrafsız zemini ve iniş/çıkış koreografisini ekliyor.
 *
 * ADIMLAR SAHTE DEĞİL. Her adımın `is()`i GERÇEK işi yapıyor (kabuğu
 * kurmak, düğümü yerleştirmek, iç topolojiyi açmak) ve adım o iş dönünce
 * işaretleniyor. Uydurma bir ilerleme çubuğu için beklenen tek şey adımın
 * OKUNABİLMESİ: iş bittiği anda bir sonrakine geçilseydi üç adım da tek
 * karede yanıp sönerdi. Bekleme o yüzden var, işi yavaşlatmak için değil.
 */

// Adım başına en az duruş. Üç adım × 320 ms + son duruş + çıkış ≈ 1,6 sn.
//
// 170 İDİ VE KISAYDI (kullanıcı: *"bekleme süresi bir miktar daha
// artırılabilir, daha profesyonel durur"*). Sayının bir de ölçülebilir
// gerekçesi var: kademe çubuğunun kendi geçişi `--mfsim-kademe-sure` = 260 ms,
// yani 170 ms'lik duruşta dolgu HİÇ OTURAMADAN bir sonraki adım geliyor ve
// çubuk sürekli yolda görünüyordu. Duruş o geçişten UZUN olmak zorunda;
// aşağıdaki değer onu 60 ms payla aşıyor.
//
// Çıkış 300'de kaldı: solma uzadıkça "kapanmıyor" hissi veriyor, ve zaten
// arkasındaki yüzey hazır.
var VE_MODLOAD_DURUS = 320;
var VE_MODLOAD_CIKIS = 300;

var VE_MODLOAD_ELS = {
  kap:    'mfsim-module-loading',
  ico:    've-modload-ico',
  ad:     've-modload-ad',
  alt:    've-modload-alt',
  obek:   've-modload-stages',
  mesaj:  've-modload-message',
  cubuk:  've-modload-bar',
  yuzde:  've-modload-percent',
  foto:   've-modload-photo'
};

var _veModLoadMesgul = false;
var _veModLoadZaman = null;

function _veModLoadEl(k){
  if(typeof document === 'undefined') return null;
  return document.getElementById(VE_MODLOAD_ELS[k]);
}

// Hareket kısıtlıysa geçiş EKRANI DA yok: burada gösterilecek iş ~50 ms
// sürüyor, geriye kalan yalnız koreografi — ve koreografi tam olarak
// kısıtlanması istenen şey.
function veModuleLoaderKisitli(){
  try {
    if(typeof window !== 'undefined' && typeof window.matchMedia === 'function')
      return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch(e){}
  return false;
}

// Öbek listesini kurar. `textContent` — adım adı '&' içerebilir ve bu dosya
// hiçbir yerde HTML dizesi birleştirmiyor (açılış ekranının kendi kuralı).
function _veModLoadObekKur(adimlar){
  var host = _veModLoadEl('obek');
  if(!host) return;
  host.innerHTML = '';
  (adimlar || []).forEach(function(a){
    var li = document.createElement('li');
    li.className = 'mfsim-loading-stage';
    var mk = document.createElement('span');
    mk.className = 'mfsim-loading-stage-mk';
    mk.textContent = '·';
    var nm = document.createElement('span');
    nm.className = 'mfsim-loading-stage-nm';
    nm.textContent = a.ad || '';
    li.appendChild(mk); li.appendChild(nm);
    host.appendChild(li);
  });
}

// KADEME SAYISI ADIM LİSTESİNDEN. js/loader.js'in TERSİ: orada sayı CSS
// jetonunda yazılı ve JS onu okuyor, çünkü açılışın öbek sayısı sabit.
// Burada sayı modüle göre değişiyor, dolayısıyla tek kaynak adım listesi ve
// jetonu JS yazıyor — çentikli dolgu onu okuyor. İki yerde yazılsaydı dolgu
// çentikle hizalanmazdı (açılış ekranının kendi ölçülmüş dersi).
function _veModLoadKademe(kap, n){
  if(!kap || !kap.style || !n) return;
  kap.style.setProperty('--mfsim-kademe', String(n));
}

function _veModLoadDurum(adimlar, i, bittiMi){
  var host = _veModLoadEl('obek');
  if(host){
    for(var k = 0; k < adimlar.length && k < host.children.length; k++){
      var bitti = !!adimlar[k].bitti;
      var aktif = (k === i) && !bitti;
      host.children[k].className = 'mfsim-loading-stage'
        + (bitti ? ' is-done' : (aktif ? ' is-active' : ''));
      var mk = host.children[k].firstChild;
      if(mk) mk.textContent = bitti ? '✓' : '·';
    }
  }
  // MESAJ ADIM ADINI TEKRARLAMAZ: liste zaten adları gösteriyor, mesaj o
  // adımın AYRINTISINI taşıyor. Ve sıradaki BİTMEMİŞ adımdan okunuyor —
  // indisten okunsaydı iş biten adımın adı, bir sonrakine geçilene kadar
  // (bir duruş boyu) "şu an yapılıyor" gibi durur (ölçüldü).
  var siradaki = null;
  for(var m = 0; m < adimlar.length; m++){ if(!adimlar[m].bitti){ siradaki = adimlar[m]; break; } }
  var mesaj = _veModLoadEl('mesaj');
  if(mesaj) mesaj.textContent = (bittiMi || !siradaki)
    ? 'Hazır' : (siradaki.not || siradaki.ad || '');

  var kac = 0;
  adimlar.forEach(function(a){ if(a.bitti) kac++; });
  var q = adimlar.length ? (kac / adimlar.length) : 1;
  var cubuk = _veModLoadEl('cubuk');
  // GENİŞLİK q'DAN, yuvarlanmış yüzdeden DEĞİL: yüzde yazılsaydı dolgu
  // çentiğin gerisinde kalırdı (açılış ekranında ölçülmüş).
  if(cubuk) cubuk.style.width = (q * 100) + '%';
  var yuzde = _veModLoadEl('yuzde');
  if(yuzde) yuzde.textContent = '%' + Math.round(q * 100);
}

// KARŞILAMA KARESİNİ DEVRALIR. Slayt iki katmanı çapraz geçiriyor; görünen
// olan OPAKLIĞI YÜKSEK olanıdır — ilkini almak geçişin ortasında yanlış kareyi
// kopyalardı. Tamamen dekor: kare bulunamazsa ekran kâğıt zeminde durur, tıpkı
// açılış ekranının karesiz hâli gibi.
function _veModLoadFotoUygula(){
  var hedef = _veModLoadEl('foto');
  if(!hedef) return;
  hedef.style.backgroundImage = '';
  if(typeof document === 'undefined') return;
  var kap = document.getElementById('ve-welcome-slayt');
  if(!kap) return;
  var en = null, enOp = -1;
  for(var i = 0; i < kap.children.length; i++){
    var el = kap.children[i];
    if(!el.style || !el.style.backgroundImage) continue;
    var op = 0;
    try { op = parseFloat(window.getComputedStyle(el).opacity); } catch(e){}
    if(!isFinite(op)) op = 0;
    if(op > enOp){ enOp = op; en = el; }
  }
  if(en) hedef.style.backgroundImage = en.style.backgroundImage;
}

/**
 * Modül giriş ekranını gösterir ve adımları sırayla koşturur.
 *
 * @param  {Object} kimlik  {ad, alt, svg}
 * @param  {Array}  adimlar [{ad, is}]
 * @param  {Function} [bitince]
 * @return {boolean} ekran gösterildiyse true; kısıtlı/kapsız hâlde işler
 *                   EŞZAMANLI koşar ve false döner.
 */
function veModuleLoaderRun(kimlik, adimlar, bitince){
  adimlar = adimlar || [];
  var hepsi = function(){
    adimlar.forEach(function(a){
      try { if(typeof a.is === 'function') a.is(); } catch(e){}
      a.bitti = true;
    });
    if(typeof bitince === 'function') { try { bitince(); } catch(e){} }
  };

  var kap = _veModLoadEl('kap');
  if(!kap || _veModLoadMesgul || veModuleLoaderKisitli()
     || typeof requestAnimationFrame !== 'function'){
    hepsi();
    return false;
  }

  _veModLoadMesgul = true;
  kimlik = kimlik || {};
  adimlar.forEach(function(a){ a.bitti = false; });

  var ico = _veModLoadEl('ico');
  // Sembol `componentDefs`ten geliyor — karşılama kartıyla AYNI kaynak;
  // ikinci bir kopya tutmak yeniden adlandırmada sessizce eskirdi.
  if(ico) ico.innerHTML = kimlik.svg || '';
  var ad = _veModLoadEl('ad');
  if(ad) ad.textContent = kimlik.ad || '';
  var alt = _veModLoadEl('alt');
  if(alt) alt.textContent = kimlik.alt || '';

  _veModLoadFotoUygula();
  _veModLoadObekKur(adimlar);
  _veModLoadKademe(kap, adimlar.length);
  _veModLoadDurum(adimlar, 0, false);

  kap.classList.remove('is-cikis');
  kap.setAttribute('aria-hidden', 'false');
  // SENKRON GÖSTERİM ŞART: `veStartModule` tek turda koşuyor ve tarayıcı
  // ancak tur bitince boyuyor. Burada `display` anında yazıldığı için İLK
  // boyamada ekran çoktan kaplanmış oluyor — arada boş tuval parlamıyor.
  kap.style.display = 'flex';

  var i = 0;
  var yurut = function(){
    if(i >= adimlar.length){ _veModLoadBitir(kap, adimlar, bitince); return; }
    _veModLoadDurum(adimlar, i, false);
    // İŞ BİR SONRAKİ KAREDE: aynı karede koşsaydı adımın adı hiç boyanmadan
    // iş biter ve ekran tek karede son duruma atlardı.
    requestAnimationFrame(function(){
      try { if(typeof adimlar[i].is === 'function') adimlar[i].is(); } catch(e){}
      adimlar[i].bitti = true;
      _veModLoadDurum(adimlar, i, false);
      i++;
      _veModLoadZaman = setTimeout(yurut, VE_MODLOAD_DURUS);
    });
  };
  yurut();
  return true;
}

function _veModLoadBitir(kap, adimlar, bitince){
  _veModLoadDurum(adimlar, adimlar.length - 1, true);
  _veModLoadZaman = setTimeout(function(){
    kap.classList.add('is-cikis');
    _veModLoadZaman = setTimeout(function(){
      kap.style.display = 'none';
      kap.classList.remove('is-cikis');
      kap.setAttribute('aria-hidden', 'true');
      _veModLoadMesgul = false;
      if(typeof bitince === 'function') { try { bitince(); } catch(e){} }
    }, VE_MODLOAD_CIKIS);
  }, VE_MODLOAD_DURUS);
}

// Ekranı ZORLA kapatır (hata yolu / test temizliği). Açık kalmış bir kaplama
// programı tümüyle kullanılamaz yapardı, o yüzden kapanışın bir de
// koşulsuz yolu var.
function veModuleLoaderKapat(){
  if(_veModLoadZaman) { clearTimeout(_veModLoadZaman); _veModLoadZaman = null; }
  var kap = _veModLoadEl('kap');
  if(kap){
    kap.style.display = 'none';
    kap.classList.remove('is-cikis');
    kap.setAttribute('aria-hidden', 'true');
  }
  _veModLoadMesgul = false;
}

function veModuleLoaderMesgul(){ return _veModLoadMesgul; }

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veModuleLoaderRun: veModuleLoaderRun,
    veModuleLoaderKapat: veModuleLoaderKapat,
    veModuleLoaderMesgul: veModuleLoaderMesgul,
    veModuleLoaderKisitli: veModuleLoaderKisitli,
    VE_MODLOAD_ELS: VE_MODLOAD_ELS,
    VE_MODLOAD_DURUS: VE_MODLOAD_DURUS,
    VE_MODLOAD_CIKIS: VE_MODLOAD_CIKIS
  };
}
