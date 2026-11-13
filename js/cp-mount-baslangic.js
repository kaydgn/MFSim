// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ BAŞLANGIÇ SAYFASI — boş bir güç grubu modelinin karşılaması
// ════════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-10-14): *"FEAD modülünün başlangıç ekranı çok güzel,
// aynı onun gibi bir ekran istiyorum. Takoz modülüne de 'Başlangıç Sihirbazı',
// 'STEP dosyadan başlama' ve 'Boş kanvas' gibi özellikler kuracağız."*
//
// Önceki açılış iç topolojiye tek bir "Başlangıç ve Örnekler" bileşeni
// koyuyordu; kullanıcı ne yapacağını o bileşene çift tıklayıp panelini açınca
// öğreniyordu. Sayfa aynı soruyu tuvalin tamamında, kapılarla sorar. Bileşen
// 2026-11-10'da (Canlı Not 110) kalktı; yerinde sihirbazı açan Başlangıç
// Sihirbazı bileşeni durur (`mnt-wizard`).
//
// KURALLAR (FEAD kural 5'in aynısı — iki modül aynı sayfayı kurar):
//  • GÖRÜNÜM VE DOM ORTAK KİTTEN (js/baslangic-sayfa.js · `.ve-bas*`). Bu
//    dosyada kalan şey Takoz'un kendisi: görünürlük sorusu, kapıların
//    eylemleri ve örneklerin künyesi.
//  • GÖRÜNÜRLÜK MODELDEN TÜRER, BAYRAK TUTULMAZ: Takoz topolojisinde
//    kullanıcının seçtiği bir yol yoksa sayfa (`veMntBaslangicGerekli`). Kapı
//    modeli kurar, sayfa kendiliğinden çekilir; Ctrl+Z kurulumu geri alırsa
//    sayfa geri gelir. Bayrak olsaydı kaydedilmek zorunda kalırdı ve geri-al
//    ile ayrışırdı.
//  • KAPILAR MODÜLÜN ÇAĞRILARI, sayfa düğüm KURMAZ: Sihirbaz `veMntWizAc`,
//    STEP `veMntCadAcStep` (dosya seçici AYNI tıklamada; dosya 3B'de okunur,
//    sihirbaz açılmaz — kullanıcı kararı 2026-11-02), Boş kanvas
//    `veMntKanvasBos`, örnek `veMntOrnekYukle`. İkinci bir kurucu, iki yolun
//    sessizce ayrışması demekti.
//  • ÖRNEKLER DİZİNDE, RESİMSİZ (kitin Çalışma masası; kullanıcı seçimi
//    2026-11-04, tasarım tuvali "sade seçenekler" · D): satır araç · gövde ve
//    takoz sayısı · kütle · kaynak; satırın Yükle'si TEK TIKLA
//    `veMntOrnekYukle`, adı ayrıntıyı açar (gövdeler kütleleriyle, takozlar).
//    Satırın her yazısı örneğin KENDİ kaydından — ikinci bir künye listesi
//    tutulmaz. Önizleme ve resimli karolar aynı gün emekli (*"Ortada falan
//    kocaman şekil olmuş, çirkin duruyor"*).
//  • Paletten sayfanın üstüne bırakılan bileşen tuvale kurulur (kit
//    sürükle-bırakı sızdırır) ve sayfa çekilir: dördüncü kapı.
//  • Tazeleme iki noktadan: kapsam değişimi (`veSyncSidebarScope` →
//    `veMntBaslangicKapsam`) ve düğüm kümesi değişimi (`updateNodeCount` →
//    `veMntBaslangicTazele` — ekleme, silme, geri yükleme, sekme yükleme).

var VE_MNT_BAS_ID = 've-mnt-baslangic';
var _mntBasKapsam = false;       // Takoz alt topolojisinde miyiz (veSyncSidebarScope yazar)

// Kit global'de (index.html onu bu dosyadan ÖNCE yükler); Node'da modül.
function _mntBasKit(){
  if(typeof veBasSayfaHTML === 'function')
    return { sayfa: veBasSayfaHTML, kur: veBasKur, tazele: veBasTazele, acik: veBasAcik };
  if(typeof require === 'function'){
    try {
      var K = require('./baslangic-sayfa.js');
      return { sayfa: K.veBasSayfaHTML, kur: K.veBasKur, tazele: K.veBasTazele, acik: K.veBasAcik };
    } catch(e){ return null; }
  }
  return null;
}
function _mntBasTip(n){
  return (typeof componentDefs !== 'undefined' && n && componentDefs[n.type]) || (n && n.def) || {};
}
// Sabit tarayıcıda global, Node'da kendi dosyasının dışa aktarımı — kitin yolu.
function _mntBasG(ad, dosya){
  if(typeof window !== 'undefined' && window[ad] !== undefined) return window[ad];
  if(typeof require === 'function'){
    try { return require(dosya)[ad]; } catch(e){ return undefined; }
  }
  return undefined;
}

// ── GÖRÜNÜRLÜK — SAF: yalnız modeli okur ───────────────────────────────────
// Liste verilmezse canlı `nodes`. Herhangi bir düğüm kullanıcının bir yol
// seçtiğini söyler — Başlangıç Sihirbazı bileşeni (mnt-wizard) DIŞINDA: yalnız
// sihirbazı açan bir düğüm model değildir. (Kalkan "Başlangıç ve Örnekler"
// bileşenini kendiliğinden kuran açılış 2026-10-14'e kadardı; onu taşıyan
// kayıtlı topoloji açılışta tanımsız tip olarak düşer ve boş kalır.)
function veMntBaslangicGerekli(liste){
  if(!liste) liste = (typeof nodes !== 'undefined' && nodes) ? nodes : [];
  for(var i = 0; i < liste.length; i++){
    if(!_mntBasTip(liste[i]).isMountWizard) return false;
  }
  return true;
}

// ── ÖRNEKLER — başlangıç sayfasının dizini ──────────────────────────────────
// Kayıt defteri `veMountCore.getMountExampleList`; ikinci bir liste tutulmaz.
// Künye örneğin kaydından okunur: araç · toplam kütle · gövde ve takoz sayısı ·
// gövdeler (ad, kütle) · takozların adı · güç grubunun künyesi.
// KÜNYE (kullanıcı 2026-11-05, Canlı Not 28 · 29: *"'Catia Atalet Ölçümü' gibi gereksiz
// şeyler yazmayalım"* · *"'BMC-ASR-SR' falan yazıyor. Kaldır bunları."*): satırın
// açıklaması örneğin GÜÇ GRUBU künyesi (kaydın açıklaması; kurgu örneklerin biçimi:
// motor · aktarma · askı). Kaynak, rapor kodu ve parça numarası satırda yazılmaz —
// gövdenin ve takozun adındaki parça numarası da düşer (`VE_MNT_BAS_KOD`).
var VE_MNT_BAS_KOD = /\s*[·—–-]?\s*\b\d{2}[A-Z]{2}\d{6}\b/g;
function _mntBasKodsuz(ad){ return String(ad || '').replace(VE_MNT_BAS_KOD, '').trim(); }
function _mntBasKunye(ex){
  return _mntBasKodsuz(String((ex && ex.description) || '').replace(/^Kaynak:\s*/, ''));
}
function veMntBaslangicOrnekler(){
  var C = (typeof veMountCore !== 'undefined') ? veMountCore : null;
  if(!C || typeof C.getMountExampleList !== 'function') return [];
  var out = [];
  C.getMountExampleList().forEach(function(ex){
    var M = ex && ex.model;
    if(!M || !M.components) return;
    var kutle = 0;
    M.components.forEach(function(c){ kutle += (Number(c.mass) || 0); });
    out.push({
      key: ex.id, ad: ex.name || ex.id, arac: ex.vehicle || ex.name || ex.id,
      govde: M.components.length, takoz: (M.mounts || []).length, aski: (M.askilar || []).length, kutle: kutle,
      govdeAdlari: M.components.map(function(c){ return _mntBasKodsuz(c.name); }),
      govdeler: M.components.map(function(c){ return { ad: _mntBasKodsuz(c.name), kg: Number(c.mass) || 0 }; }),
      takozAdlari: (M.mounts || []).map(function(m){ return _mntBasKodsuz(m && m.name); }).filter(Boolean),
      askiAdlari: (M.askilar || []).map(function(a){ return _mntBasKodsuz(a && a.name); }).filter(Boolean),
      kunye: _mntBasKunye(ex),
      kurgu: !!ex.kurgu
    });
  });
  return out;
}

// ── KİMLİK — sayfanın başı (kullanıcı isteği 2026-10-19) ─────────────────
// Modülün ADI (componentDefs) ve Kılavuz. SAYI BANDI YOK (Canlı Not 5:
// *"Bu açıklamalara gerek yok. Kaldıralım."*); analizlerin adı YOK (Canlı Not 19).
// Kapı: mount-baslangic.test.js → KİMLİK.

// İkon ve analizlerin adı YOK (Canlı Not 4 · 19, 2026-11-05: başlık sütunun
// tepesinde; *"alttaki açıklamalara da gerek yok"*); dönüş panelin altında.
function veMntBaslangicKimlik(){
  var def = (typeof componentDefs !== 'undefined' && componentDefs['mount-analysis']) || {};
  var kitOf = _mntBasG('veGuideKitOf', './guide-kit.js'), hazir = _mntBasG('veGuideKitReady', './guide-kit.js');
  var kilavuz = (typeof kitOf === 'function' && typeof hazir === 'function' && hazir(kitOf('mount'))) ? 'mount' : '';
  return { ad: def.name || 'Takoz Çökme-Titreşim', kilavuz: kilavuz };
}

// KAPIDA KÜNYE YOK (kullanıcı 2026-11-09, Canlı Not 84: *"Gereksiz açıklamaları
// kaldıralım."*): kapı yalnız simge ve ad — sihirbazın adımları, STEP'in biçimi ve
// boş kanvasın araç sayısı adın altında iki satırdı. Boş kanvasın kurduğu araçların
// adları `title`da (veri). Kitin künye yuvası FEAD'in sütununda duruyor.
function veMntBaslangicKapilar(){
  var arac = (_mntBasG('VE_MNT_ARAC_TIPLERI', './cp-mount.js') || []).map(function(t){
    return (typeof componentDefs !== 'undefined' && componentDefs[t] && componentDefs[t].name) || t;
  });
  return [
    { ey: 'sihirbaz', ikon: 'wand', ad: 'Sihirbazla kur', birincil: true },
    { ey: 'step', ikon: 'box', ad: 'STEP\'ten başla' },
    { ey: 'bos', ikon: 'grid', ad: 'Boş kanvas', title: arac.join(' · ') }
  ];
}

// SON DEĞİŞİKLİKLER (Canlı Not 6, kullanıcı 2026-11-05: modülün güncellemeleri,
// yalnız Takoz'a özgü olanlar):
// derlemenin künyesinden (window.__MFSIM_BUILD.moduller.takoz — Takoz'un
// dosyalarına dokunan son birleşmeler, tools/version-info.js). Künye yoksa
// (modüler kopya, test) liste yok.
// GÖRSEL (kullanıcı 2026-11-05, Canlı Not 27: *"Her son değişikliği görselli olarak
// görmek istiyorum"*): commit'in notlarının sonuç görüntüsü, derlemenin gömdüğü
// haritadan (__MFSIM_DEGISIKLIK; tools/degisiklik-resim.js). Not birleşmede İLK
// commit'inin altında bir kez; gösterim ölçüsü boyu en çok VE_BAS_DEG_RESIM_Y.
var VE_BAS_DEG_RESIM_Y = 360;
function _mntBasDegResimler(a, resim, goruldu){
  return (a.notlar || []).filter(function(n){
    if(!resim[n] || goruldu[n]) return false;
    goruldu[n] = 1;
    return true;
  }).map(function(n){
    var r = resim[n], k = Math.min(1, VE_BAS_DEG_RESIM_Y / (r.y || 1));
    return { no: n, src: r.src, g: Math.round(r.g * k), y: Math.round(r.y * k) };
  });
}
function veMntBaslangicDegisiklik(K, R){
  var b = K || ((typeof window !== 'undefined') ? window.__MFSIM_BUILD : null);
  var resim = R || ((typeof window !== 'undefined' && window.__MFSIM_DEGISIKLIK) || {});
  var L = (b && b.moduller && b.moduller.takoz) || [];
  var tarih = function(d){
    var t = new Date(d);
    if(isNaN(t.getTime())) return '';
    var p = function(n){ return (n < 10 ? '0' : '') + n; };
    return p(t.getDate()) + '.' + p(t.getMonth() + 1) + '.' + t.getFullYear();
  };
  return { baslik: 'Son değişiklikler', kayitlar: L.map(function(c){
    var goruldu = {};
    return { tarih: tarih(c.date), baslik: c.title || '', pr: c.prNumber || '', ayrinti: (c.ayrinti || []).map(function(a){
      return { konu: a.konu, govde: a.govde || [], resimler: _mntBasDegResimler(a, resim, goruldu) };
    }) };
  }) };
}

// ── SAYFA — SAF: yalnız sabitlerden ve örnek kaydından ────────────────────
// Kapıların adı ve örneklerin dizini. İki grup: gerçek araçlar ve KURGU
// doğrulama modelleri (kayıtta `kurgu`) — kurgu model gerçek bir aracı temsil
// etmez; bölüm başlığı bunu söyler, gerçek örneklerle aynı grupta karışmaz.
// Satır araç · gövde ve takoz sayısı · kütle · künye; ayrıntısı gövdeler
// (kütleleriyle, tek ondalık) ve takozların adı.
function veMntBaslangicSayfa(){
  var ornekler = veMntBaslangicOrnekler();
  var n = function(x, b){ return (typeof veSayi === 'function') ? veSayi(x, b || 0) : String(Math.round(x)); };
  var satir = function(o){
    return { ey: 'ornek', v: o.key, ad: o.arac,
             sayi: n(o.govde) + ' gövde · ' + n(o.takoz) + ' takoz' + (o.aski ? ' · ' + n(o.aski) + ' askı' : ''),
             kutle: n(o.kutle) + ' kg', kunye: o.kunye,
             detay: [
               { baslik: 'Gövdeler', ogeler: o.govdeler.map(function(g){ return { ad: g.ad, deger: n(g.kg, 1) + ' kg' }; }) },
               { baslik: 'Takozlar', ogeler: o.takozAdlari.map(function(a){ return { ad: a }; }) }
             ].concat(o.askiAdlari.length ? [{ baslik: 'Askı yayları', ogeler: o.askiAdlari.map(function(a){ return { ad: a }; }) }] : []) };
  };
  var gercek = ornekler.filter(function(o){ return !o.kurgu; });
  var kurgu = ornekler.filter(function(o){ return o.kurgu; });
  return {
    kimlik: veMntBaslangicKimlik(),
    kapilar: veMntBaslangicKapilar(),
    donus: { ad: 'Ana topoloji' },
    bolumler: [
      { baslik: 'Araç örnekleri', sekme: 'Araçlar', satirlar: gercek.map(satir) },
      { baslik: 'Doğrulama örnekleri — kurgu', sekme: 'Kurgu', satirlar: kurgu.map(satir) }
    ],
    degisiklik: veMntBaslangicDegisiklik()
  };
}

function veMntBaslangicHTML(){
  var K = _mntBasKit();
  if(!K) return '';
  return K.sayfa(veMntBaslangicSayfa());
}

// ── EYLEMLER — hepsi modülün var olan çağrılarına gider ────────────────────
function veMntBaslangicEylem(ad, v){
  if(ad === 'sihirbaz')
    return !!(typeof veMntWizAc === 'function' && veMntWizAc());
  if(ad === 'step')
    return !!(typeof veMntCadAcStep === 'function' && veMntCadAcStep());
  if(ad === 'bos')
    return !!(typeof veMntKanvasBos === 'function' && veMntKanvasBos().length);
  if(ad === 'ornek'){
    if(!v || typeof veMntOrnekYukle !== 'function') return false;
    return veMntOrnekYuklemeli(v);
  }
  if(ad === 'donus')
    return !!(typeof veMntCloseEditor === 'function' && (veMntCloseEditor(), true));
  if(ad === 'kilavuz'){
    if(!v || typeof veGuideOpen !== 'function') return false;
    veGuideOpen(v);
    return true;
  }
  return false;
}

// ── ÖRNEĞİN YÜKLEME EKRANI (kullanıcı 2026-11-11, Canlı Not 128: *"Örnek yüklediğimiz
// zaman direkt topolojiyi ekrana veriyor. Böyle bir yükleme ekranı gibi bir şey olsun,
// biraz geç yüklensin yani. Profesyonelliği belli olsun. Tık diye açılıyor."*) ──────────
// Yükle → modülün alanında kart: örneğin adı, künyesi (gövde · takoz · kütle) ve kademeli
// çubuk. Model kartın ARKASINDA kurulur ve sığdırılır, çubuk dolar, kart söner. Süre
// VE_MNT_YUKLEME_MS (Canlı Not 131: *"biraz daha uzun sürebilir … Kısa olmuş"* — 1,4 → 2,6 sn);
// çubuk bekleyişin TAMAMINDA dolar (geçişi süreden: `--ve-mnt-yukleme-adim`), yolda durmaz.
// Otomasyonda (navigator.webdriver) ve jsdom'da gecikme YOK: kurucu eşzamanlı çağrılır —
// testler ve ürün turu birebir eski (`zorla` yalnız kapı içindir).
var VE_MNT_YUKLEME_MS = 2600;
var VE_MNT_YUKLEME_ID = 've-mnt-yukleme';
function _mntYuklemeGecikmesiz(){
  if(typeof window !== 'undefined' && window.VE_MNT_YUKLEME_ZORLA) return false;
  if(typeof navigator === 'undefined' || typeof document === 'undefined' || !document.body) return true;
  if(navigator.webdriver === true) return true;
  return /jsdom/i.test(navigator.userAgent || '');
}
// Kartın içi — ad, künye, kademeli çubuk (örnek ve sihirbaz aynı kalıptan)
function _mntYuklemeKartHTML(ad, kunye, ikon){
  var e = function(x){ return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  return '<div class="ve-mnt-yukleme-kart" role="status" aria-live="polite">'
    + '<div class="ve-mnt-yukleme-bas">' + (typeof veIkon === 'function' ? veIkon(ikon || 'settings', 've-mnt-yukleme-ico') : '')
    + '<b>' + e(ad) + '</b></div>'
    + '<div class="ve-mnt-yukleme-kunye">' + e(kunye) + '</div>'
    + '<div class="ve-mnt-yukleme-cubuk" role="progressbar" aria-label="' + e(ad) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>'
    + '</div>';
}
function veMntOrnekYuklemeHTML(o){
  var n = function(x){ return (typeof veSayi === 'function') ? veSayi(x, 0) : String(Math.round(x)); };
  return _mntYuklemeKartHTML(o.arac || o.ad, n(o.govde) + ' gövde · ' + n(o.takoz) + ' takoz' + (o.aski ? ' · ' + n(o.aski) + ' askı' : '') + ' · ' + n(o.kutle) + ' kg', 'settings');
}
// Kartın oynatılışı: çubuk bekleyişin %62'sinde %86'ya, %68'de `ortada` (kurulum) ve %100,
// %88'de kart söner. Örnek ve sihirbaz aynı zamanlamadan (Canlı Not 131 · 146).
function _mntYuklemeOynat(el, ms, ortada){
  var sonraki = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : function(f){ setTimeout(f, 16); };
  el.style.setProperty('--ve-mnt-yukleme-adim', Math.round(ms * 0.62) + 'ms');
  // Başlangıç hâli (perde saydam, çubuk boş) ÖNCE hesaplanır: yeni kartın ilk karesinde
  // verilen genişlik geçişsiz uygulanıyordu — çubuk %71'e sıçrayıp 0,8 sn duruyordu (Not 131).
  void el.offsetWidth;
  sonraki(function(){ el.classList.add('acik'); _mntYuklemeIlerle(el, 86); });
  setTimeout(function(){
    if(ortada){ try { ortada(); } catch(e){ if(typeof console !== 'undefined') console.error(e); } }
    el.style.setProperty('--ve-mnt-yukleme-adim', '240ms');
    _mntYuklemeIlerle(el, 100);
    setTimeout(function(){
      el.classList.remove('acik');
      setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, Math.round(ms * 0.2));
  }, Math.round(ms * 0.68));
}
function _mntYuklemeIlerle(el, yuzde){
  if(!el) return;
  var c = el.querySelector('.ve-mnt-yukleme-cubuk');
  if(!c) return;
  c.setAttribute('aria-valuenow', String(Math.round(yuzde)));
  c.firstChild.style.width = yuzde + '%';
}
// Kartı kurar (görünür, çubuk boş). Döner: kartın kabı ya da null.
function veMntOrnekYuklemeKur(key){
  if(typeof document === 'undefined') return null;
  var o = veMntBaslangicOrnekler().filter(function(x){ return x.key === key; })[0];
  var kap = document.getElementById('ve-page-topoloji') || document.querySelector('.ve-main');
  if(!o || !kap) return null;
  var eski = document.getElementById(VE_MNT_YUKLEME_ID);
  if(eski) eski.remove();
  var el = document.createElement('div');
  el.id = VE_MNT_YUKLEME_ID;
  el.className = 've-mnt-yukleme';
  el.innerHTML = veMntOrnekYuklemeHTML(o);
  kap.appendChild(el);
  return el;
}
// Yükle'nin eylemi: kartla gecikmeli yükleme; gecikmesiz ortamda doğrudan kurucu.
function veMntOrnekYuklemeli(key, opt){
  opt = opt || {};
  if(!opt.zorla && _mntYuklemeGecikmesiz()) return !!veMntOrnekYukle(key);
  var el = veMntOrnekYuklemeKur(key);
  if(!el) return !!veMntOrnekYukle(key);
  var ms = (opt.ms > 0) ? opt.ms : VE_MNT_YUKLEME_MS;
  _mntYuklemeOynat(el, ms, function(){ veMntOrnekYukle(key); });
  return true;
}

// ── SİHİRBAZIN YÜKLEME EKRANI (kullanıcı 2026-11-11, Canlı Not 146: *"Başlangıç sihirbazı açılırken
// yine bir yükleme ekranı olsun, daha profesyonel görünür."*) ──────────────────────────────────
// Sihirbaz açılınca (her yoldan: araç şeridi, başlangıç sayfası, 3B'den aktarım) pencerenin ÜSTÜNDE
// örneğin kartının aynısı: ad, künye (tuvaldeki model: örneğin adı · gövde · takoz; boşsa adım
// sayısı), kademeli çubuk; sihirbaz kartın ARKASINDA kurulur, kart söner. Süre örneğinki
// (VE_MNT_YUKLEME_MS). Otomasyonda ve jsdom'da kart yok (açılış eşzamanlı, testler birebir).
// Kapı: mount-baslangic.test.js → *SİHİRBAZIN YÜKLEME EKRANI*.
var VE_MW_YUKLEME_ID = 've-mw-yukleme';
function veMntSihirbazYukleme(kunye, opt){
  opt = opt || {};
  if(!opt.zorla && _mntYuklemeGecikmesiz()) return null;
  if(typeof document === 'undefined') return null;
  var modal = document.querySelector('#ve-mntwiz-overlay .ve-fw-modal');
  if(!modal) return null;
  var eski = document.getElementById(VE_MW_YUKLEME_ID);
  if(eski) eski.remove();
  var el = document.createElement('div');
  el.id = VE_MW_YUKLEME_ID;
  el.className = 've-mnt-yukleme ve-mw-yukleme';
  el.innerHTML = _mntYuklemeKartHTML('Takoz Başlangıç Sihirbazı', kunye || '', 'wand');
  modal.appendChild(el);
  _mntYuklemeOynat(el, (opt.ms > 0) ? opt.ms : VE_MNT_YUKLEME_MS, null);
  return el;
}

// ── DOM — kurma ve görünürlük (kit) ────────────────────────────────────────
function _mntBasSecenek(){
  return { id: VE_MNT_BAS_ID, aria: 'Takoz başlangıç sayfası',
           sayfa: veMntBaslangicSayfa, eylem: veMntBaslangicEylem };
}

// Kapsam: yalnız Takoz alt topolojisinde. Kapsamın tek noktası
// veSyncSidebarScope (components.js) — modül aç/kapa, sekme, proje yükleme.
// Kapsamın geçişi Bileşenler sütununu da yönetir (Canlı Not 62): Takoz'a girişte kapalı,
// çıkışta kullanıcının tercihi (js/cp-mount.js → veMntPaletKapat · veMntPaletGeriAc).
function veMntBaslangicKapsam(scope){
  var once = _mntBasKapsam;
  _mntBasKapsam = (scope === 'mount-analysis');
  if(_mntBasKapsam && !once && typeof veMntPaletKapat === 'function') veMntPaletKapat();
  else if(!_mntBasKapsam && once && typeof veMntPaletGeriAc === 'function') veMntPaletGeriAc();
  return veMntBaslangicTazele();
}

// Döner: sayfa AÇIK mı. Kapsam dışında hiçbir şey kurulmaz.
function veMntBaslangicTazele(){
  var K = _mntBasKit();
  if(!K) return false;
  return K.tazele(_mntBasSecenek(), _mntBasKapsam && veMntBaslangicGerekli());
}

function veMntBaslangicAcik(){
  var K = _mntBasKit();
  return K ? K.acik(VE_MNT_BAS_ID) : false;
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veMntBaslangicGerekli: veMntBaslangicGerekli, veMntBaslangicOrnekler: veMntBaslangicOrnekler,
    veMntBaslangicHTML: veMntBaslangicHTML, veMntBaslangicSayfa: veMntBaslangicSayfa,
    veMntBaslangicEylem: veMntBaslangicEylem, veMntBaslangicKapsam: veMntBaslangicKapsam,
    veMntOrnekYuklemeli: veMntOrnekYuklemeli, veMntOrnekYuklemeKur: veMntOrnekYuklemeKur,
    VE_MNT_YUKLEME_MS: VE_MNT_YUKLEME_MS, _mntYuklemeGecikmesiz: _mntYuklemeGecikmesiz,
    veMntSihirbazYukleme: veMntSihirbazYukleme, VE_MW_YUKLEME_ID: VE_MW_YUKLEME_ID,
    veMntBaslangicTazele: veMntBaslangicTazele, veMntBaslangicAcik: veMntBaslangicAcik,
    veMntBaslangicKimlik: veMntBaslangicKimlik,
    veMntBaslangicKapilar: veMntBaslangicKapilar,
    VE_MNT_BAS_ID: VE_MNT_BAS_ID,
    veMntBaslangicDegisiklik: veMntBaslangicDegisiklik,
    _mntBasSifirla: function(){ _mntBasKapsam = false; }
  };
}
