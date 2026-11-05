// ════════════════════════════════════════════════════════════════════════════
//  BAŞLANGIÇ SAYFASI KİTİ — boş bir modül topolojisinin karşılaması (ORTAK)
// ════════════════════════════════════════════════════════════════════════════
//
// İki modül aynı sayfayı kurar: FEAD (js/cp-fead-baslangic.js) ve Takoz
// (js/cp-mount-baslangic.js). Kullanıcı isteği (2026-10-14): *"FEAD modülünün
// başlangıç ekranı çok güzel, aynı onun gibi bir ekran istiyorum."* — "aynı"
// sözcüğünün karşılığı TEK üretici ve TEK CSS ailesidir (`.ve-bas*`,
// css/styles.css). Takoz'a sayfanın bir kopyası kurulsaydı iki görünüm ilk
// rötuşta sessizce ayrışırdı.
//
// İKİ DÜZEN, TEK ÜRETİCİ — modül sayfanın tanımında beyan eder (`s.duzen`):
//  • 'masa' (varsayılan) — SOL PANEL (kullanıcı seçimi 2026-11-05, tasarım tuvali
//    "Takoz başlangıç ekranı seçenekleri" · 2 — *"Sol panel güzel ama yine panel
//    boş kalmış … takoz çökme ve titreşim modülü için yapılan güncellemeleri mi
//    yazsak?"*): solda PANEL (kimlik · kapılar · ÖRNEKLER sekmeli dizin · altta
//    dönüş ve Kılavuz), sağda MASA — modülün SON DEĞİŞİKLİKLERİ (`degisiklik`,
//    derlemenin künyesinden). Örneklerin satırı ad · sayı · kütle · Yükle, RESİM
//    YOK; ortadaki geniş dizin (2026-11-04, "sade seçenekler" · D) kalktı —
//    *"Örneklerin olması güzel ama ekranı tamamen doldurmuş"*. Takoz.
//  • 'sutun' — ortalanmış sütun: kimlik (Kılavuz sağda) · veri bandı · kapılar ·
//    karolar; karo TEK TIKLA kurar. FEAD (kullanıcı 2026-11-04: *"FEAD modülü
//    önceki hali gibi kalsın. O daha güzelmiş."*).
// İki düzen aynı yuvaları (kimlik · veri · kapı) aynı sınıflarla basar; ölçü
// farkı düzenin kapsamında (`.ve-bas-ic--masa` · `.ve-bas-ic--sutun`).
//
// KİT YALNIZ SUNUMU KURAR. Hangi modülün sayfası olduğunu, sayfanın NE ZAMAN
// gerektiğini (görünürlük modelden türer, bayrak tutulmaz) ve kapıların NE
// YAPTIĞINI modül söyler — kit bunları sormaz, yalnız çağırır.
//
// KURALLAR (FEAD kural 5'ten devralındı):
//  • SAYFA TUVALİ ÖRTER, FARE SAYFADA KALIR: tuvalin pan/seçim/yakınlaştırma
//    dinleyicileri kapta; sayfanın fare ve tekerlek olayları kaba sızmaz.
//    Sürükle-bırak SIZAR (bilinçli): paletten sayfanın üstüne bırakılan
//    bileşen tuvale kurulur ve sayfa modelden türediği için kendiliğinden
//    çekilir — dördüncü kapı.
//  • HER AÇILIŞTA YENİDEN BASILIR (tema, adım ve örnek listesi o an neyse);
//    açıkken yeniden basmak odağı ve kaydırmayı düşürürdü.
//  • DİZİNDE YÜKLE TEK TIKLA KURAR (satırın düğmesi → modülün eylemi); satırın
//    adı AYRINTIYI açar (modülün listeleri: gövdeler, takozlar). Açık satır TEK
//    ve GÖRÜNÜM durumudur: modelde değil, sayfa başına bellekte
//    (`_veBasAcikSatir`) — kaydedilmez, geri-al yığınına girmez; ilk açılışta
//    ilk satır açık. Açıp kapamak sayfayı yeniden basmaz (odak yerinde kalır).
//    Sütunun karosu da tek tıkla kurar.
//  • SAYFA AÇIKKEN SAYFA RAYI (Topoloji · Sonuçlar) VE PALETİN AÇMA SEKMESİ
//    GİZLİ (kullanıcı 2026-11-04 — ray: *"Gerek yok"*; sekme: *"iki sembol var.
//    Onları kaldıralım. Sadece geriye gelme kalsın"*): kit kabına `ve-bas-acik`
//    yazar (`_veBasRayEsitle`), CSS ikisini yalnız topoloji sayfasında gizler —
//    öteki sayfada ray dönüş yoludur. Ana topolojiye dönüş düğmesi (z 60)
//    kalır ve masada kimliğin YERİNDEDİR: başlık onun satırında, sağında
//    başlar, ikon kutusu yok (kullanıcı 2026-11-05, Canlı Not 4: *"Yazılar
//    sütunun en tepesine kadar çıkmalı"* — düğmeye ayrılan 48 px'lik üst
//    dolgu başlığı aşağı itiyordu). Sayfa
//    SIĞDIRMADAN önce çekilir (Takoz ilk düğümde, FEAD sonuçları unuturken):
//    ray geri geldiğinde kadraj doğru genişlikle kurulur.
//  • İkon ailesi tek (karar 10·B): kapının ikonu `veIkon`dan.

function veBasEsc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function _veBasIkon(ad){ return (typeof veIkon === 'function') ? veIkon(ad) : ''; }

// ── KİMLİK, VERİ, KÜNYE — sayfanın AD ve VERİ yuvaları (2026-10-19) ─────────
// Kullanıcı isteği: *"… çok sade olmuş. Güzel durmuyor. Bir şeyler ekleyelim
// … profesyonel dursun."* Eklenen her yuva YAPILI: modülün adı, analizlerinin
// programdaki ADLARI, kataloğun ölçülen SAYILARI, kapının künyesi (adımların
// adı, dosya biçimi). Yuva bir ad listesi ya da {ad, deger} çifti alır, cümle
// almaz — serbest metin yuvası (üst satır, alt metin, not, rozet) YİNE YOK.
// Kapı: mount-baslangic.test.js → KİMLİK VE VERİ.

// i: { ad, ikon (SVG — modülün componentDefs ikonu), yetenekler:[ad…],
//      kilavuz (kılavuz kimliği; verilmezse düğme yok) }. `kilavuzIcinde`:
// Kılavuz başlığın sağında (sütun); masada panelin dibinde (veBasKilavuzHTML).
// `ikonsuz`: masada ikonun yerinde dönüş düğmesi durur — verilse de basılmaz.
function veBasKimlikHTML(i, kilavuzIcinde, ikonsuz){
  if(!i || !i.ad) return '';
  var y = (i.yetenekler || []).filter(Boolean);
  return '<header class="ve-bas-kimlik">'
    + (i.ikon && !ikonsuz ? '<span class="ve-bas-kimlik-ik" aria-hidden="true">' + i.ikon + '</span>' : '')
    + '<div class="ve-bas-kimlik-t"><h1>' + veBasEsc(i.ad) + '</h1>'
    + (y.length ? '<ul class="ve-bas-yetenek" aria-label="Analizler">'
        + y.map(function(a){ return '<li>' + veBasEsc(a) + '</li>'; }).join('') + '</ul>' : '')
    + '</div>'
    + (kilavuzIcinde ? veBasKilavuzHTML(i) : '')
    + '</header>';
}

// Kılavuz düğmesi: masada panelin dibinde, sütunda kimliğin sağında.
function veBasKilavuzHTML(i){
  if(!i || !i.kilavuz) return '';
  return '<button type="button" class="ve-bas-kilavuz" data-ey="kilavuz" data-v="' + veBasEsc(i.kilavuz) + '">'
    + _veBasIkon('file-text') + '<span>Kılavuz</span></button>';
}

// v: [{ deger, ad, title }] — sayı yazıcısından geçmiş değer, ölçünün adı.
// Değeri boş satır basılmaz. Masada satır satır (ad solda, sayı sağda), sütunda
// bant (sayı üstte, ad altta) — işaretleme aynı, görünüm düzenin CSS'inde.
function veBasVeriHTML(v){
  v = (v || []).filter(function(x){ return x && x.ad && x.deger != null && x.deger !== ''; });
  if(!v.length) return '';
  return '<dl class="ve-bas-veri">' + v.map(function(x){
    return '<div' + (x.title ? ' title="' + veBasEsc(x.title) + '"' : '') + '>'
      + '<dt>' + veBasEsc(x.ad) + '</dt><dd>' + veBasEsc(x.deger) + '</dd></div>';
  }).join('') + '</dl>';
}

// ── KAPI — sayfanın birincil eylemleri ─────────────────────────────────────
// k: { ey, ikon, ad, kunye:[ad…], title, birincil, onclick }. `ey` kapının
// eylem anahtarı — sayfanın tek tıklama dinleyicisi onu modülün eylemine
// verir. `onclick` yalnız sayfanın DIŞINDA basılan kapı için (bir bileşen
// penceresi aynı kapıyı gösterir, dinleyicisi yoktur). `kunye` VERİ: ad ve
// biçim listesi — her ad kendi öğesinde, ayraç CSS'ten (" · " ile birleşmiş
// bir dize cümle gibi okunur ve metin tarayıcısı onu uzun metin sayar);
// `title` künyede yazmayan veri.
// AÇIKLAMA YUVASI YOK (ARAYÜZ ANLATMAZ, kök CLAUDE.md): kapının not satırı ve
// "önerilen" rozeti iki modülde altı açıklama üretmişti.
function veBasKapiHTML(k){
  k = k || {};
  var ky = (k.kunye || []).filter(Boolean);
  return '<button type="button" class="ve-bas-kapi' + (k.birincil ? ' birincil' : '') + '" data-ey="' + veBasEsc(k.ey) + '"'
    + (k.title ? ' title="' + veBasEsc(k.title) + '"' : '')
    + (k.onclick ? ' onclick="' + veBasEsc(k.onclick) + '"' : '') + '>'
    + '<span class="ve-bas-kapi-ik">' + _veBasIkon(k.ikon) + '</span>'
    + '<span class="ve-bas-kapi-t"><b>' + veBasEsc(k.ad) + '</b>'
    + (ky.length ? '<span class="ve-bas-kapi-k">'
        + ky.map(function(a){ return '<span>' + veBasEsc(a) + '</span>'; }).join('') + '</span>' : '')
    + '</span></button>';
}

// ── KARO — sütunun örnek / rapor kartı ─────────────────────────────────────
// k: { ey (YÜKLEME eylemi), v, baslik (title, isteğe bağlı), resim (SVG), kod,
//      yil, sag, alt }. Karo modülün eylemidir — tek tık kurar; resmin
// köşesinde fare altında "Yükle", künye iki satır (kod · yıl · sağ; alt satır).
// Resim yoksa karo yine basılır, künyesiyle ("çizilemedi") — yükleme de yine
// çalışır. Resim modülün KENDİ çizicisinden gelir; kit çizim yapmaz. `baslik`
// karoda yazmayan VERİ içindir; komut eki yok.
function veBasKaroHTML(k){
  k = k || {};
  return '<button type="button" class="ve-bas-karo" data-ey="' + veBasEsc(k.ey) + '" data-v="' + veBasEsc(k.v) + '"'
    + (k.baslik ? ' title="' + veBasEsc(k.baslik) + '"' : '') + '>'
    + '<span class="ve-bas-resim">' + (k.resim || '<i class="ve-bas-resim-yok">çizilemedi</i>')
    + '<em>Yükle</em></span>'
    + '<span class="ve-bas-kunye"><span class="ve-bas-kunye-1"><b>' + veBasEsc(k.kod) + '</b>'
    + (k.yil ? '<span>' + veBasEsc(k.yil) + '</span>' : '')
    + (k.sag ? '<i>' + veBasEsc(k.sag) + '</i>' : '') + '</span>'
    + '<span class="ve-bas-kunye-2">' + veBasEsc(k.alt) + '</span>'
    + '</span></button>';
}

// ── SATIR — panelin örnek dizinindeki örnek ────────────────────────────────
// r: { ey (YÜKLEME eylemi), v, ad, sayi, kutle, kaynak,
//      detay:[{ baslik, ogeler:[{ ad, deger }] }] }. Yuvaların hepsi AD ya da
// VERİ (ARAYÜZ ANLATMAZ): `sayi` ve `kutle` sayı yazıcısından geçmiş değer,
// `kaynak` örneğin künyesi, ayrıntı modülün listeleri. Boş öğe ve boş liste
// basılmaz. Satırın adı açar/kapar (`data-ey="ac"`), Yükle modülün eylemi.
// Panelde dar (Canlı Not 6): ad satırı · altında sayı ve kütle; kaynak ayrıntının
// ilk satırında, tek satırda kısalır ve tam metni `title`da.
function veBasSatirHTML(r, acik){
  r = r || {};
  var det = (r.detay || []).map(function(d){
    var og = ((d && d.ogeler) || []).filter(function(x){ return x && x.ad; });
    if(!og.length) return '';
    return '<div class="ve-bas-satir-blok"><h3>' + veBasEsc(d.baslik) + '</h3><ul>'
      + og.map(function(x){
          return '<li><span>' + veBasEsc(x.ad) + '</span>'
            + (x.deger != null && x.deger !== '' ? '<b>' + veBasEsc(x.deger) + '</b>' : '') + '</li>';
        }).join('')
      + '</ul></div>';
  }).join('');
  return '<div class="ve-bas-satir' + (acik ? ' acik' : '') + '" data-v="' + veBasEsc(r.v) + '">'
    + '<div class="ve-bas-satir-ust">'
    +   '<button type="button" class="ve-bas-satir-ac" data-ey="ac" data-v="' + veBasEsc(r.v) + '"'
    +     ' aria-expanded="' + (acik ? 'true' : 'false') + '">' + _veBasIkon('chevron-right')
    +     '<b>' + veBasEsc(r.ad) + '</b></button>'
    +   '<button type="button" class="ve-bas-satir-yukle" data-ey="' + veBasEsc(r.ey) + '" data-v="' + veBasEsc(r.v) + '"'
    +     ' aria-label="Yükle — ' + veBasEsc(r.ad) + '">' + _veBasIkon('download') + '<span>Yükle</span></button>'
    +   '<span class="ve-bas-satir-sayi">' + veBasEsc(r.sayi) + '</span>'
    +   '<span class="ve-bas-satir-kutle">' + veBasEsc(r.kutle) + '</span>'
    + '</div>'
    + '<div class="ve-bas-satir-detay"' + (acik ? '' : ' hidden') + '>'
    +   (r.kaynak ? '<div class="ve-bas-satir-kaynak" title="' + veBasEsc(r.kaynak) + '">' + veBasEsc(r.kaynak) + '</div>' : '')
    +   det + '</div>'
    + '</div>';
}

// ── SAYFA ──────────────────────────────────────────────────────────────────
// s: { duzen ('masa' | 'sutun'), kimlik, veriler:[…], kapilar:[kapı…],
//      donus:{ ad } (masa — panelin altındaki dönüş), degisiklik:{ baslik, kayitlar } (masa),
//      bolumler:[{ baslik, sekme (masa — sekmenin adı), satirlar:[satır…] (masa) | karolar:[karo…] (sütun) }] }
// Tek bölüm `bolum` olarak da verilebilir (FEAD). Boş bölüm basılmaz.
// Masa: panel (kimlik · kapılar · veri · örnekler · dönüş ve Kılavuz) · masa (son
// değişiklikler); `acikV` açık satırın anahtarı — verilmezse ilk satır, '' hiçbiri;
// `sekmeV` örneklerin açık sekmesi.
// Sütun: kimlik · veri · kapılar · bölümler.
// Sayfanın üst satırı, serbest başlığı (`baslik`), alt metni, bölüm notu ve
// dipnotu YOK (2026-10-16, kullanıcı kararı — metin temizliği aşama 1): beş
// yuva iki modülde on beş açıklama üretmişti ("Nereden başlayalım?" ·
// "Seçtiğin kapı modeli kurar ve bu sayfa çekilir …"). Başlık artık modülün
// ADI (`kimlik.ad`), cümle değil.
function _veBasSutun(s){ return !!(s && s.duzen === 'sutun'); }
function _veBasBolumler(s){
  var alan = _veBasSutun(s) ? 'karolar' : 'satirlar';
  return ((s && (s.bolumler || (s.bolum ? [s.bolum] : []))) || [])
    .filter(function(b){ return b && b[alan] && b[alan].length; });
}
function _veBasIlkSatir(s){
  var b = _veBasBolumler(s)[0];
  return b ? b.satirlar[0] : null;
}
function _veBasSutunHTML(s){
  var h = '<div class="ve-bas-ic ve-bas-ic--sutun">'
    + veBasKimlikHTML(s.kimlik, true)
    + veBasVeriHTML(s.veriler)
    + '<div class="ve-bas-kapilar">' + (s.kapilar || []).map(veBasKapiHTML).join('') + '</div>';
  _veBasBolumler(s).forEach(function(b){
    h += '<div class="ve-bas-baslik"><h2>' + veBasEsc(b.baslik) + '</h2></div>'
      + '<div class="ve-bas-raporlar">' + b.karolar.map(veBasKaroHTML).join('') + '</div>';
  });
  return h + '</div>';
}
function veBasSayfaHTML(s, acikV, sekmeV){
  s = s || {};
  if(_veBasSutun(s)) return _veBasSutunHTML(s);
  var bolumler = _veBasBolumler(s);
  var ilk = _veBasIlkSatir(s);
  var ac = (acikV === undefined || acikV === null) ? (ilk ? String(ilk.v) : '') : String(acikV);
  var h = '<div class="ve-bas-ic ve-bas-ic--masa">'
    + '<aside class="ve-bas-panel">'
    +   veBasKimlikHTML(s.kimlik, false, true)
    +   '<div class="ve-bas-kapilar">' + (s.kapilar || []).map(veBasKapiHTML).join('') + '</div>'
    +   veBasVeriHTML(s.veriler)
    +   (bolumler.length ? veBasOrnekHTML(bolumler, ac, sekmeV) : '')
    +   veBasAltHTML(s)
    + '</aside>'
    + '<div class="ve-bas-masa">' + veBasDegisiklikHTML(s.degisiklik) + '</div>';
  return h + '</div>';
}
// ÖRNEKLER (masa — kullanıcı 2026-11-05, Canlı Not 6): panelde, SEKMELİ (bölüm
// başına bir sekme: `sekme` adı ve satır sayısı); tek bölümde sekme yok, başlık
// bölümün adı. Açık sekme görünüm durumu (_veBasSekme) — verilmezse açık satırın
// sekmesi, o da yoksa ilki.
function veBasOrnekHTML(bolumler, ac, sekmeV){
  var sk = Number(sekmeV);
  if(!(sk >= 0 && sk < bolumler.length)){
    sk = 0;
    bolumler.forEach(function(b, i){ if(b.satirlar.some(function(r){ return String(r.v) === ac; })) sk = i; });
  }
  var h = '<section class="ve-bas-ornek" aria-label="Örnekler"><div class="ve-bas-ornek-bas"><h2>'
    + veBasEsc(bolumler.length > 1 ? 'Örnekler' : bolumler[0].baslik) + '</h2>';
  if(bolumler.length > 1){
    h += '<div class="ve-bas-sekmeler" role="tablist" aria-label="Örnekler">' + bolumler.map(function(b, i){
      return '<button type="button" class="ve-bas-sekme" role="tab" data-ey="sekme" data-v="' + i + '" aria-selected="' + (i === sk ? 'true' : 'false') + '">'
        + veBasEsc(b.sekme || b.baslik) + '<span>' + b.satirlar.length + '</span></button>';
    }).join('') + '</div>';
  }
  // Bölümün tam adı ("Doğrulama örnekleri — kurgu") sekme panelinin adıdır.
  return h + '</div><div class="ve-bas-dizin" role="tabpanel" aria-label="' + veBasEsc(bolumler[sk].baslik || '') + '">'
    + bolumler[sk].satirlar.map(function(r){ return veBasSatirHTML(r, String(r.v) === ac); }).join('') + '</div></section>';
}
// PANELİN ALTI (Canlı Not 19, kullanıcı 2026-11-05: *"Geri butonunu alt taraflara
// uygun bir yere taşıyalım"*): ana topolojiye DÖNÜŞ (`donus`: { ad }) ve
// Kılavuz. Dönüşü taşıyan sayfa açıkken köşedeki dönüş düğmesi gizli
// (kabın `.ve-bas-donus-acik` sınıfı — _veBasRayEsitle).
function veBasAltHTML(s){
  var d = s && s.donus, k = veBasKilavuzHTML(s && s.kimlik);
  if(!d && !k) return '';
  return '<div class="ve-bas-dip">'
    + (d ? '<button type="button" class="ve-bas-donus" data-ey="donus" aria-label="Ana topolojiye dön">'
        + _veBasIkon('chevrons-left') + '<span>' + veBasEsc(d.ad || 'Ana topoloji') + '</span></button>' : '')
    + k + '</div>';
}
// SON DEĞİŞİKLİKLER (masa, Canlı Not 6): d = { baslik, kayitlar:[{ tarih, baslik, pr, ayrinti }] }
// — modülün dosyalarına dokunan son birleşmeler (derlemenin künyesi). Kayıt yoksa
// masa boş: bilinmeyen liste yazılmaz. Başlık PR'ın başlığı, programın metni
// DEĞİL (`data-ve-dis-metin` — sayı ve metin taramaları atlar).
// Satırın ayrıntısı (Canlı Not 23, kullanıcı 2026-11-05: *"Son değişikliklere
// tıkladığım zaman detaylarını okuyabilmem lazım"*): `ayrinti` = [{ konu, govde:[paragraf…] }]
// — birleşmenin commit'leri. Ayrıntısı olan satır açılıp kapanır (`data-ey="degisiklik"`),
// olmayan düz satır; birden çok satır açık kalabilir, açıklık görünüm durumu.
function veBasDegisiklikHTML(d){
  var L = ((d && d.kayitlar) || []).filter(function(k){ return k && k.baslik; });
  if(!L.length) return '';
  return '<section class="ve-bas-degisiklik" aria-label="' + veBasEsc(d.baslik || 'Son değişiklikler') + '"><h2>'
    + veBasEsc(d.baslik || 'Son değişiklikler') + '</h2><ol>' + L.map(function(k, i){
      var bas = '<span class="ve-bas-degisiklik-t">' + veBasEsc(k.tarih || '') + '</span>'
        + '<span class="ve-bas-degisiklik-ad" data-ve-dis-metin>' + veBasEsc(k.baslik) + '</span>'
        + (k.pr ? '<span class="ve-bas-degisiklik-pr">#' + veBasEsc(k.pr) + '</span>' : '');
      var ay = (k.ayrinti || []).filter(function(a){ return a && a.konu; });
      if(!ay.length) return '<li><div class="ve-bas-degisiklik-bas">' + bas + '</div></li>';
      return '<li class="ve-bas-degisiklik-s" data-v="' + i + '">'
        + '<button type="button" class="ve-bas-degisiklik-bas" data-ey="degisiklik" data-v="' + i + '" aria-expanded="false">'
        + _veBasIkon('chevron-right') + bas + '</button>'
        + '<div class="ve-bas-degisiklik-ayrinti" data-ve-dis-metin hidden><ol>' + ay.map(function(a){
            return '<li><b>' + veBasEsc(a.konu) + '</b>' + (a.govde || []).map(function(p){
              return '<div class="ve-bas-degisiklik-p">' + veBasEsc(p) + '</div>';
            }).join('') + (a.resimler || []).map(function(r){
              return '<img class="ve-bas-degisiklik-resim" src="' + veBasEsc(r.src) + '" width="' + (r.g | 0) + '" height="' + (r.y | 0)
                + '" alt="Not ' + veBasEsc(r.no) + ' sonucu" loading="lazy" decoding="async">';
            }).join('') + '</li>';
          }).join('') + '</ol></div></li>';
    }).join('') + '</ol></section>';
}
function _veBasDegAc(el, v){
  var li = el && el.querySelector('.ve-bas-degisiklik-s[data-v="' + v + '"]');
  if(!li) return false;
  var ac = !li.classList.contains('acik');
  li.classList.toggle('acik', ac);
  var b = li.querySelector('.ve-bas-degisiklik-bas'), a = li.querySelector('.ve-bas-degisiklik-ayrinti');
  if(b) b.setAttribute('aria-expanded', ac ? 'true' : 'false');
  if(a) a.hidden = !ac;
  return true;
}

// ── DOM — kurma, açık satır ve görünürlük ──────────────────────────────────
// o: { id, aria, sayfa: function(): s (sayfanın tanımı), eylem: function(ad, v) }
//    —  `html: function(): string` eski yol (sayfanın HTML'i hazır).
var _veBasAcikSatir = {};      // sayfa kimliği → açık satırın anahtarı (görünüm durumu)
var _veBasSekme = {};          // sayfa kimliği → örneklerin açık sekmesi (görünüm durumu)

function _veBasKap(){
  return (typeof document !== 'undefined') ? document.getElementById('ve-canvas-wrapper') : null;
}
function _veBasEl(id){
  return (typeof document !== 'undefined') ? document.getElementById(id) : null;
}
function _veBasBas(el, o){
  if(typeof o.sayfa === 'function'){
    var s = o.sayfa() || {};
    el.setAttribute('data-donus', s.donus ? '1' : '');
    return _veBasSutun(s) ? veBasSayfaHTML(s) : veBasSayfaHTML(s, _veBasAcikSatir[o.id], _veBasSekme[o.id]);
  }
  return (typeof o.html === 'function') ? o.html() : '';
}

// Satırı aç/kapa: açık satır tek. Yalnız sınıf ve nitelik değişir — sayfa
// yeniden basılmaz (odak ve kaydırma yerinde).
function _veBasAc(el, v){
  if(!el || v == null) return false;
  var simdi = el.querySelector('.ve-bas-satir.acik');
  var yeni = (simdi && simdi.getAttribute('data-v') === String(v)) ? '' : String(v);
  _veBasAcikSatir[el.id] = yeni;
  Array.prototype.forEach.call(el.querySelectorAll('.ve-bas-satir'), function(r){
    var on = r.getAttribute('data-v') === yeni;
    r.classList.toggle('acik', on);
    var b = r.querySelector('.ve-bas-satir-ac');
    if(b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
    var d = r.querySelector('.ve-bas-satir-detay');
    if(d) d.hidden = !on;
  });
  return true;
}

// Örneklerin sekmesi: yalnız örnek bölümü yeniden basılır (kimlik, kapılar ve
// kaydırma yerinde); açık satır sekmeler arasında korunur.
function _veBasSekmeSec(el, v){
  var o = el && el._veBasO, bolum = el && el.querySelector('.ve-bas-ornek');
  if(!o || typeof o.sayfa !== 'function' || !bolum) return false;
  _veBasSekme[el.id] = Number(v) || 0;
  var s = o.sayfa() || {}, B = _veBasBolumler(s), ilk = _veBasIlkSatir(s);
  var acikV = _veBasAcikSatir[el.id], ac = (acikV === undefined || acikV === null) ? (ilk ? String(ilk.v) : '') : String(acikV);
  var t = document.createElement('div');
  t.innerHTML = veBasOrnekHTML(B, ac, _veBasSekme[el.id]);
  bolum.parentNode.replaceChild(t.firstChild, bolum);
  var sec = el.querySelector('.ve-bas-sekme[aria-selected="true"]');
  if(sec && sec.focus) sec.focus();
  return true;
}

// Sayfa rayının ve paletin açma sekmesinin görünürlüğü: herhangi bir
// başlangıç sayfası açık mı.
function _veBasRayEsitle(){
  if(typeof document === 'undefined') return false;
  var acik = false, donus = false;
  var hepsi = document.querySelectorAll('.ve-bas');
  for(var i = 0; i < hepsi.length; i++){
    if(!hepsi[i].hidden){ acik = true; if(hepsi[i].getAttribute('data-donus') === '1') donus = true; }
  }
  var kab = document.getElementById('sayfa2-content');
  if(kab){ kab.classList.toggle('ve-bas-acik', acik); kab.classList.toggle('ve-bas-donus-acik', donus); }
  // Ray ve açma sekmesi gelip gidince kap kayar: dönüş düğmesi yeniden oturur
  // (sekme görünürken onun sağına — js/canvas-space.js → veChipSolOrtu).
  if(typeof veAnchorBoundaryChip === 'function') veAnchorBoundaryChip();
  return acik;
}

function veBasKur(o){
  var kap = _veBasKap();
  if(!kap || !o || !o.id) return null;
  var el = _veBasEl(o.id);
  if(el){ el._veBasO = o; return el; }
  el = document.createElement('section');
  el.id = o.id;
  el.className = 've-bas';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', o.aria || 'Başlangıç sayfası');
  el.hidden = true;
  el._veBasO = o;
  el.innerHTML = _veBasBas(el, o);
  // TUVALE OLAY SIZDIRMA: kabın dinleyicileri pan/seçim/yakınlaştırma yapıyor.
  // Tekerlek pasif dinlenir — sayfa kendi kaydırmasını yapar, kadraj oynamaz.
  ['mousedown', 'pointerdown', 'dblclick', 'contextmenu', 'wheel', 'click'].forEach(function(t){
    el.addEventListener(t, function(e){ e.stopPropagation(); }, t === 'wheel' ? { passive: true } : false);
  });
  el.addEventListener('click', function(e){
    var b = e.target && e.target.closest && e.target.closest('[data-ey]');
    if(!b) return;
    var ey = b.getAttribute('data-ey'), v = b.getAttribute('data-v');
    if(ey === 'ac'){ _veBasAc(el, v); return; }
    if(ey === 'sekme'){ _veBasSekmeSec(el, v); return; }
    if(ey === 'degisiklik'){ _veBasDegAc(el, v); return; }
    var oo = el._veBasO;
    if(oo && typeof oo.eylem === 'function') oo.eylem(ey, v);
  });
  kap.appendChild(el);
  return el;
}

// Döner: sayfa AÇIK mı. `acik` çağıranın kararı (kapsam + modelin sorusu);
// kapalıyken hiçbir şey kurulmaz.
function veBasTazele(o, acik){
  var el = _veBasEl(o && o.id);
  if(!acik){
    if(el) el.hidden = true;
    _veBasRayEsitle();
    return false;
  }
  el = el || veBasKur(o);
  if(!el) return false;
  el._veBasO = o;
  if(el.hidden){
    el.innerHTML = _veBasBas(el, o);
    el.scrollTop = 0;
    el.hidden = false;
  }
  _veBasRayEsitle();
  return true;
}

function veBasAcik(id){
  var el = _veBasEl(id);
  return !!(el && !el.hidden);
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veBasEsc: veBasEsc, veBasKapiHTML: veBasKapiHTML, veBasKaroHTML: veBasKaroHTML,
    veBasSatirHTML: veBasSatirHTML,
    veBasKimlikHTML: veBasKimlikHTML, veBasKilavuzHTML: veBasKilavuzHTML, veBasVeriHTML: veBasVeriHTML,
    veBasSayfaHTML: veBasSayfaHTML, veBasOrnekHTML: veBasOrnekHTML, veBasAltHTML: veBasAltHTML,
    veBasDegisiklikHTML: veBasDegisiklikHTML, _veBasSekmeSec: _veBasSekmeSec, _veBasDegAc: _veBasDegAc,
    veBasKur: veBasKur, veBasTazele: veBasTazele, veBasAcik: veBasAcik,
    _veBasAc: _veBasAc, _veBasRayEsitle: _veBasRayEsitle,
    _veBasSifirla: function(){ _veBasAcikSatir = {}; _veBasSekme = {}; }
  };
}
