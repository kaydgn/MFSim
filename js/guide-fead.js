// ═══════════════════════════════════════════════════════════════════════════
// FEAD KULLANIM KILAVUZU — "Detaylı FEAD raporu" kozmetiğinde, yönlendirici
// ═══════════════════════════════════════════════════════════════════════════
//
// Belge kabuğu js/guide-kit.js'ten gelir ve kozmetiğini gömülü rapor
// şablonundan ÇIKARIR — yani bu dosyada tek satır CSS yok. Rapor teması bir kez
// güncellendiğinde kılavuz onunla birlikte güncellenir.
//
// ── BU BELGENİN RAPORDAN İKİ FARKI ─────────────────────────────────────────
//
// 1 · ÇÖZÜLMÜŞ MODEL GEREKTİRMEZ. Rapor bir SONUÇ belgesidir ve çözülmemiş
//     modelde indirmeyi reddeder. Kılavuz bir ÖĞRETİ belgesidir: tuval bomboşken
//     — kullanıcının ona en çok ihtiyaç duyduğu anda — okunabilmek zorundadır.
//
// 2 · ÖRNEĞİN SAYILARI ELLE YAZILMAZ. §14'teki işlenmiş örnek, kayıt
//     defterindeki `AG00976_GATES_2025` sistemini BELLEKTE kurup gerçek zinciri
//     (veFeadBuildSystem → FEADCore → veFeadAnalyze) koşturuyor ve çıkan
//     sayıları basıyor. Kullanıcının tuvaline dokunulmaz: `veFeadBuildSystem`
//     açık düğüm listesi kabul ediyor, `veFeadBuildFromCanvas` gibi global
//     `nodes` okumuyor.
//
//     Sayıları elle yazmak bu belgeyi ilk çekirdek değişikliğinde SESSİZCE
//     yanlış yapardı: kılavuz "kayış boyu 1715,39 mm çıkar" der, program başka
//     bir sayı verir, kullanıcı hangisinin doğru olduğunu bilemez. Canlı hesap
//     bu sınıfı yapısal olarak yok ediyor.
//
// Ad öneki `_gf…` / `veGuideFead…` (source-hygiene: `_fr` raporun, `_fsr`
// özetin, `_fead` sunumun, `_gk` kabuğun).

// Sayı biçimi ve kaçış RAPORDAN alınır (js/cp-fead-report.js) — ikinci bir
// kopya iki belgenin aynı sayıyı farklı basması demekti. Yükleme sırasından
// bağımsız olsun diye çağrı anında çözülüyor.
function _gfF(v, d){ return (typeof _frF === 'function') ? _frF(v, d) : String(v); }
function _gfFs(v, d){ return (typeof _frFs === 'function') ? _frFs(v, d) : String(v); }
function _gfE(s){ return (typeof _gkEsc === 'function') ? _gkEsc(s) : String(s); }

// Tablo / şekil sayaçları — her üretimde sıfırlanır (raporun kuralının aynısı:
// elle "Tablo 4" yazmak, araya bir tablo girdiğinde sessizce kayardı).
var _gfTblNo = 0, _gfFigNo = 0;
function _gfTbl(){ return ++_gfTblNo; }
function _gfFig(){ return ++_gfFigNo; }

// ── KÜÇÜK YAPI TAŞLARI (raporun sınıflarıyla) ──────────────────────────────

// Adım listesi. Kılavuzun omurgası bu: her bölüm "şunu yap, sonra bunu yap"
// diye ilerler. <ol> raporun kendi liste stilini kullanır.
function _gfAdimlar(satirlar){
  return '<ol>' + satirlar.map(function(s){ return '<li>' + s + '</li>'; }).join('') + '</ol>';
}

// Alan tablosu — kılavuzun en çok tekrarlanan bileşeni: hangi alan, ne yazılır,
// nereden bulunur. Üç sütun sabit; dördüncü sütun (not) isteğe bağlı.
function _gfAlanTablo(baslik, satirlar, basliklar){
  var b = basliklar || ['Alan', 'Ne yazılır', 'Nereden bulunur'];
  var h = '<table><caption>Tablo ' + _gfTbl() + ' — ' + _gfE(baslik) + '</caption>';
  h += '<tr>' + b.map(function(t){ return '<th>' + _gfE(t) + '</th>'; }).join('') + '</tr>';
  satirlar.forEach(function(r){
    // HER SÜTUN `td.l`. Raporun `td` VARSAYILANI BİR SAYIDIR: mono, sağa
    // dayalı ve `white-space:nowrap`. Kılavuzun alan tablolarında üç sütun da
    // cümledir; ilk sütun bir dönem `td.c` ile basılıyordu ve nowrap yüzünden
    // uzun alan adları tabloyu 393 px taşırıyordu (gerçek tarayıcıda ölçüldü).
    // Vurgu gereken yerde çağıran <strong> koyar — sınıf değil içerik işi.
    h += '<tr>' + r.map(function(c){
      return '<td class="l">' + c + '</td>';
    }).join('') + '</tr>';
  });
  return h + '</table>';
}

// Sayısal tablo — örnek bölümünde kullanılıyor; hücreler HAM verilir.
function _gfTablo(baslik, basliklar, satirlar, hizalar){
  var h = '<table><caption>Tablo ' + _gfTbl() + ' — ' + _gfE(baslik) + '</caption>';
  h += '<tr>' + basliklar.map(function(t){ return '<th>' + _gfE(t) + '</th>'; }).join('') + '</tr>';
  satirlar.forEach(function(r){
    h += '<tr>' + r.map(function(c, i){
      var cls = (hizalar && hizalar[i]) ? ' class="' + hizalar[i] + '"' : '';
      return '<td' + cls + '>' + c + '</td>';
    }).join('') + '</tr>';
  });
  return h + '</table>';
}

function _gfNot(baslik, govde){ return veGuideNote('', baslik, govde); }
function _gfUyari(baslik, govde){ return veGuideNote('warn', baslik, govde); }
function _gfOnay(baslik, govde){ return veGuideNote('check', baslik, govde); }

// ── SAHNELER: PROGRAMIN KENDİ BİLEŞENİ, BELGENİN İÇİNDE ────────────────────
//
// Kabuk `js/guide-kit.js`'te (`veGuideScene` + `veGuideSceneCSS`); burada olan
// tek şey ÜRETİCİYİ ÇAĞIRMAK. Elle yazılmış bir kopya konursa sahnenin bütün
// gerekçesi düşer — kapı bu yüzden sahnenin içeriğini üreticinin çıktısıyla
// karşılaştırıyor, sabit bir dizeyle değil.
//
// GLOBAL TAKASI ŞART. Kart ve panel üreticileri `nodes`/`connections`
// global'lerini okuyor (Araç Performans kılavuzundaki `_gaKoslu` ile aynı
// sınıf). Kullanıcının açık modeli çizilseydi kılavuz herkeste başka
// görünürdü; `finally` ile geri veriliyor.
var _gfSahnePack = null;   // örnek bir kez kurulur, sahneler paylaşır

function _gfSahnePaketi(){
  if(_gfSahnePack !== null) return _gfSahnePack;
  _gfSahnePack = _gfOrnekCoz() || false;
  return _gfSahnePack;
}

// Üreticiyi ÖRNEK MODELDE koştur. Üretici patlarsa sahne hiç çizilmez —
// yarım bir kutu, olmayan bir arayüzü varmış gibi gösterirdi.
//
// `coz` İSTENİRSE ÇÖZÜM DE YAYINLANIR. Bazı yüzeyler (rapor paneli) oturumluk
// `window.veFeadResults` globalini okuyor ve o boşken "Model çözülmedi" deyip
// düğmesini pasifleştiriyor — kılavuzda öğretici olan hâli DEĞİL. Sonuç nesnesi
// elle kurulmaz (ikinci kopya olurdu): programın kendi `veFeadSolve`'u örnek
// üzerinde koşturulur, sonra global geri verilir.
//
// TOAST SUSTURULUR: çözüm bildirimi kılavuz üretilirken ekranda çakmasın.
function _gfSahneHTML(fn, coz){
  var O = _gfSahnePaketi();
  if(!O || typeof fn !== 'function') return '';
  var w = (typeof window !== 'undefined') ? window : null;
  var eskiN = w ? w.nodes : undefined;
  var eskiC = w ? w.connections : undefined;
  var eskiR = w ? w.veFeadResults : undefined;
  var eskiT = w ? w.showToast : undefined;
  try {
    if(w){
      w.nodes = O.pack.nodes;
      w.connections = O.pack.connections || [];
      w.showToast = function(){};
      if(coz && typeof veFeadSolve === 'function'){
        try { veFeadSolve(O.cozucu.id); } catch(e2){ /* çözülemezse sahne
          yine çizilir, yalnız çözülmemiş hâliyle */ }
      }
    }
    return fn(O) || '';
  } catch(e){
    return '';
  } finally {
    if(w){
      w.nodes = eskiN;
      w.connections = eskiC;
      w.veFeadResults = eskiR;
      w.showToast = eskiT;
    }
  }
}

// Bir kasnağı tipine göre bul — sahne hangi kasnağı gösterdiğini SEÇER,
// "ilk bulduğun" demek sürücüyü verirdi ve aksesuara özgü kartlar
// (Katalog Modeli · Devir Sınırları) hiç görünmezdi.
function _gfSahneKasnak(O, tip){
  var bul = null;
  O.pack.nodes.forEach(function(n){ if(n.type === tip && !bul) bul = n; });
  return bul;
}

// Şerit düğmesi — `veRibbonItemHTML`'in kendisi. Kayıt defterindeki ögeyi
// ADIYLA arar: dizi konumundan almak, şerit yeniden dizildiğinde sessizce
// başka bir düğmeyi çizerdi.
function _gfSeritOgesi(run){
  if(typeof VE_RIBBON_TABS === 'undefined' || typeof veRibbonItemHTML !== 'function')
    return '';
  var bulunan = null, tabId = '', gi = 0, ii = 0;
  VE_RIBBON_TABS.forEach(function(t){
    (t.groups || []).forEach(function(g, gx){
      (g.items || []).forEach(function(it, ix){
        if(!bulunan && it.run === run){ bulunan = it; tabId = t.id; gi = gx; ii = ix; }
      });
    });
  });
  if(!bulunan) return '';
  try { return veRibbonItemHTML(bulunan, tabId, gi, ii) || ''; } catch(e){ return ''; }
}

// Düğme KOMUTU VARKEN çizilir. `veRibbonRunnable` düğmenin etkinliğini
// `window[item.run]` var mı diye ölçüyor; kılavuz belgesi üretilirken o komut
// yüklü olmayabilir ve düğme PASİF çizilir — kullanıcıya "bu düğme
// kullanılamaz" demek, anlatılan şeyin tam tersi. Komut çizim süresince
// tanımlanıyor ve `finally` ile geri veriliyor (`nodes` takasının aynısı).
function _gfSeritEtkin(run, fn){
  if(typeof window === 'undefined') return fn();
  var vardi = Object.prototype.hasOwnProperty.call(window, run);
  var eski = window[run];
  try {
    if(typeof eski !== 'function') window[run] = function(){};
    return fn();
  } catch(e){
    return '';
  } finally {
    if(vardi) window[run] = eski; else { try { delete window[run]; } catch(e2){ window[run] = eski; } }
  }
}

// Cümle içinde bir şerit düğmesi. Sahne değil — okuma akışını bölmeden
// "şu düğmeye bas" diyebilmek için.
function _gfBtn(run){
  var b = _gfSeritEtkin(run, function(){ return _gfSeritOgesi(run); });
  return (b && b.indexOf('is-disabled') < 0 && typeof veGuideBtn === 'function')
    ? veGuideBtn(b) : '';
}

function _gfSahneSerit(){
  var btn = _gfSeritEtkin('veTidyLayout', function(){ return _gfSeritOgesi('veTidyLayout'); });
  if(!btn || btn.indexOf('is-disabled') >= 0) return '';
  return veGuideScene('<div class="ve-rb-group-items">' + btn + '</div>',
    'Şeritteki <b>Otomatik düzenle</b> düğmesi.');
}

function _gfSahneTablo(){
  var html = _gfSahneHTML(function(){
    if(typeof veFeadTableCardHTML !== 'function') return '';
    // PROGRAMDAKİ KABIYLA: başlık şeridi paftanın yan dolgusunu negatif
    // kenar boşluğuyla örtüyor (çizgiler kartın kenarına kadar). Kapsız
    // basılınca şerit sahneden iki yana 10 px taşıyordu (baskıda ölçüldü).
    // Kap kartın dibine yapışık değil, akışta.
    return '<div class="ve-fead-pafta" style="position:relative; bottom:auto; height:auto;">'
      + veFeadTableCardHTML(null) + '</div>';
  });
  if(!html) return '';
  // Doğal genişlik ÜRETİLEN HTML'den okunuyor (guide-kit.js
  // `_gkNaturalWidth`); burada bir ölçü yazılmıyor.
  return veGuideScene(html,
    'Kayış Tablosu — Kayış Yolu kartının altındaki <em>Layout Data</em> — <b>Bölüm 14’ün '
    + 'örnek modeliyle</b> doldurulmuş hâlde. Türeyen sütunlar (Ø eff · Sarım · Span) '
    + 'çözümden gelir.');
}

function _gfSahneKasnakPaneli(){
  return _gfSahneKart2('getFeadPulleyPropertiesHTML', 'Temas tarafı',
    'Kasnak panelinin ilk kartı — çizimde kasnağa ya da tablodaki <b>ada tıklayınca</b> açılan '
    + 'yüzey. Temas tarafı hesabı en çok etkileyen ve hata vermeden yanlış girilebilen alandır.');
}

function _gfSahneDevirSinir(){
  return _gfSahneKart2('getFeadPulleyPropertiesHTML', 'Devir sınırları',
    'Aksesuar kasnağının devir sınırları — değerleri <b>Model</b> seçiminden gelir, elle '
    + 'girilen değer onların önüne geçer. Üç sınır da boşsa sağ sütunun <b>Uygunluk</b>u o '
    + 'kasnak için <b>hüküm veremez</b>. Sürücüde aynı bölüm motorun sınırlarını taşır, avarada yoktur.');
}

// AKSESUARIN MODEL SEÇİCİSİ — iki katalog, tek liste (sihirbazla aynı).
function _gfSahneModel(){
  return _gfSahneKart2('getFeadPulleyPropertiesHTML', 'Katalog modeli',
    'Aksesuarın <b>tek</b> model seçicisi: BMC künyeleri ve Araç Performans kataloğu aynı '
    + 'listede. Altındaki iki satır seçimin neyi getirdiğini okur; çevrimde bu aksesuar için '
    + 'elle yazılmış kW varsa sayısıyla uyarır — o satırlarda eğri kullanılmaz.');
}

// SÜRÜCÜ KASNAĞIN PENCERESİNDEN tek kart. Sürücü KÖPRÜNÜN seçtiği kasnak
// (`veFeadResolveDriver`) — örnekte fan kasnağı: ikincil tahrikte FEAD'i o
// çeviriyor. Tip aramak ("fead-crank") örnekte hiçbir şey bulmazdı.
function _gfSahneSurucuKart(baslik, altyazi){
  var html = _gfSahneHTML(function(O){
    if(typeof getFeadPulleyPropertiesHTML !== 'function' || typeof veFeadResolveDriver !== 'function')
      return '';
    var drv = (O.build && O.build.order) ? veFeadResolveDriver(O.build.order) : null;
    if(!drv) return '';
    return (typeof veGuideCard === 'function') ? veGuideCard(getFeadPulleyPropertiesHTML(drv), baslik) : '';
  });
  return html ? veGuideScene(html, altyazi) : '';
}

// Tuval kartları — ikisi de AYNI çiziciden (`veFeadLayoutCardHTML`), tipe
// göre farklı opts. Kılavuz ikisini de gösterir çünkü bölünmenin sebebi
// ölçü değil SORU: biri model kurulurken, öteki devir seçilince sorulur.
// SEÇİM TİPTEN VE (varsa) ÖN AYARDAN. Kanvas tipi teke indikten sonra
// (2026-09-11) yalnız tipe bakmak iki sahnede de AYNI kartı basardı —
// örnekteki iki `fead-layout` düğümünden ilkini. `veri` verilirse eşleşme
// o alanları da arar; bulunamazsa sahne BOŞ döner (yanlış kartı basmaktansa
// hiç basmamak: boş sahne kılavuz testinde görünür, yanlış kart görünmez).
// Kanvas kartının TASARIM genişliği — `components.js`'teki tek kaynaktan.
// Sayfaya gerilen kart programdakinden başka görünüyor ve şeritleri taşıyor.
function _gfKanvasEn(w){
  return (w || (typeof VE_FEAD_LAYOUT_W === 'number' ? VE_FEAD_LAYOUT_W : 440)) + 26;
}
function _gfKartW(n){
  return (typeof veFeadKartVarsayilanW === 'function') ? veFeadKartVarsayilanW(n)
    : (typeof VE_FEAD_LAYOUT_W === 'number' ? VE_FEAD_LAYOUT_W : 440);
}

function _gfSahneKart(tip, veri){
  return _gfSahneHTML(function(O){
    if(typeof veFeadLayoutCardHTML !== 'function') return '';
    var n = null;
    O.pack.nodes.forEach(function(x){
      if(n || x.type !== tip) return;
      if(veri) for(var k in veri){
        if(!Object.prototype.hasOwnProperty.call(veri, k)) continue;
        if(!x.data || x.data[k] !== veri[k]) return;
      }
      n = x;
    });
    if(!n) return '';
    // TABLOLU KART PAFTASIYLA BİRLİKTE (Pafta, 2026-09-26): programdaki kart
    // çizim + altındaki Kayış Tablosu'dur; yalnız çizimi basmak, altında boş
    // bir şerit olan bir kart gösterirdi. Kabuk programın kendi sınıflarıyla —
    // ölçüsü kartın varsayılanı, tablonun boyu programın kendi hesabı.
    var w = _gfKartW(n), h = (typeof VE_FEAD_LAYOUT_H === 'number') ? VE_FEAD_LAYOUT_H : 500;
    var kart = Object.assign({}, n, { width: w, height: h });
    var ciz = veFeadLayoutCardHTML(kart);
    if(typeof veFeadTabloAcik !== 'function' || !veFeadTabloAcik(kart)
       || typeof veFeadTableCardHTML !== 'function') return ciz;
    var satir = O.pack.nodes.filter(function(x){ return _feadIsPulleyGuide(x); }).length;
    var pH = (typeof veFeadPaftaH === 'function') ? veFeadPaftaH(kart, satir) : 0;
    return '<div class="ve-fead-layout-card" style="position:relative; display:flex;'
      + ' flex-direction:column; width:' + w + 'px; height:' + h + 'px; --fead-paf-h:' + pH + 'px;">'
      + ciz + '<div class="ve-fead-pafta">' + veFeadTableCardHTML(kart) + '</div></div>';
  });
}
function _feadIsPulleyGuide(x){
  var d = (typeof componentDefs !== 'undefined' && x && componentDefs[x.type]) || {};
  return !!d.isFeadPulley;
}

function _gfSahneSema(){
  var html = _gfSahneKart('fead-layout');
  if(!html) return '';
  return veGuideScene(html,
    'Kayış Yolu kanvası, <b>Geometri</b> ön ayarında — ölçekli şema. Turuncu yol '
    + 'çözücünün teğet noktalarından geçiyor, dişler kayışın kaburgalı yüzünü '
    + 'gösteriyor, yeşil artı gerginin <b>türetilmiş</b> montaj konumu. Altında Kayış '
    + 'Tablosu: satırın numarası kasnağın göbeğinde de yazılı.',
    _gfKanvasEn(typeof VE_FEAD_PAFTA_W === 'number' ? VE_FEAD_PAFTA_W : 640));
}

// AYNI TİP, BAŞKA ÖN AYAR. Sahne bir zamanlar ayrı bir bileşen tipi
// (`fead-run`) kuruyordu; tip 2026-09-11'de kalktı ve fark `data.katOn`a
// taşındı. Sahne de o yoldan geçmek ZORUNDA: ikinci bir çizim yolu açsaydı
// kılavuz, programda olmayan bir kartı anlatırdı.
function _gfSahneCalisma(){
  var html = _gfSahneKart('fead-layout', { katOn: 'isletme' });
  if(!html) return '';
  return veGuideScene(html,
    'Aynı kanvas, <b>İşletme</b> ön ayarında: açıklık gerilmeleri, gerilme haritası '
    + 've titreşim. Kart tipi tektir — fark, kartın <b>Katmanlar</b> panelinden '
    + 'seçilen ön ayardır ve her kanvas kendi seçimini taşır.', _gfKanvasEn());
}

// Bir PANELDEN tek kart. Baskı için: bütün panel A4'ten uzun olabiliyor
// (gergi paneli ~1700 px, sayfa ~1050) ve sayfaya sığmayan bir şekil ya
// kırpılıyor ya kendi sayfasında yine taşıyor. Kart boyutunda şekil, hem
// sayfaya sığıyor hem de açıkladığı paragrafın yanında duruyor.
function _gfSahneKart2(fn, baslik, altyazi, coz){
  var html = _gfSahneHTML(function(O){
    if(typeof window[fn] !== 'function') return '';
    var tip = { getFeadTensionerPropertiesHTML: 'fead-tensioner',
                getFeadBeltPropertiesHTML: 'fead-belt',
                getFeadSolverPropertiesHTML: 'fead-solver',
                getFeadPulleyPropertiesHTML: null }[fn];
    var n = null;
    if(tip) O.pack.nodes.forEach(function(x){ if(x.type === tip && !n) n = x; });
    else n = _gfSahneKasnak(O, 'fead-alternator') || _gfSahneKasnak(O, 'fead-ac');
    if(!n) return '';
    return (typeof veGuideCard === 'function')
      ? veGuideCard(window[fn](n), baslik) : '';
  }, coz);
  return html ? veGuideScene(html, altyazi) : '';
}

function _gfSahnePanel(fn, altyazi, coz){
  var html = _gfSahneHTML(function(O){
    if(typeof window[fn] !== 'function') return '';
    var tip = { getFeadTensionerPropertiesHTML: 'fead-tensioner',
                getFeadBeltPropertiesHTML: 'fead-belt',
                getFeadSolverPropertiesHTML: 'fead-solver',
                getFeadReportPropertiesHTML: 'fead-report' }[fn];
    var n = null;
    O.pack.nodes.forEach(function(x){ if(x.type === tip && !n) n = x; });
    return n ? window[fn](n) : '';
  }, coz);
  return html ? veGuideScene(html, altyazi) : '';
}

// FEAD ARAÇLARI PENCERESİ — programın kendi üreticisi (`veFeadAraclarHTML`),
// ÇÖZÜLMÜŞ örnekte: öğretici olan hâl, özet kartlarının ve gergi tarafı
// hükmünün dolu olduğu hâl. Pencere tuvalde mutlak konumlu; sahnede akışta
// durması `ve-fead-arac-sahne` sınıfının işi (css/styles.css). Dönüş Yönü
// penceresinin sahnesi bunun yerine geçti: yön artık bu pencerenin bölümü.
function _gfSahneAraclar(){
  var html = _gfSahneHTML(function(){
    if(typeof veFeadAraclarHTML !== 'function' || typeof veFeadAraclarDurum !== 'function') return '';
    return '<section class="ve-fead-arac ve-fead-arac-sahne">'
      + veFeadAraclarHTML(veFeadAraclarDurum()) + '</section>';
  }, true);
  if(!html) return '';
  return veGuideScene(html,
    '<b>FEAD araçları</b> penceresi, beş bölüm: <b>Model</b> (künye · Sihirbaz · ＋ Kanvas), '
    + '<b>Çözüm</b> (durum · Hesapla · Ayarlar · özet kartları · uygunluk), <b>Rapor</b> '
    + '(tür · İndir · Künye), <b>Yön</b> (CW | CCW · gergi tarafı hükmü) ve <b>Not</b> '
    + '(Çerçeve · Yazı — tuvale sürüklenir ya da tıklanır). Tuvalin sol '
    + 'üstündeki yuvada durur; başlığından taşınır, çift tıkla dar bir şeride katlanır.',
    (typeof VE_FEAD_ARAC_EN === 'number' ? VE_FEAD_ARAC_EN : 236) + 26);
}

function _gfSahneGergiMerkez(){
  return _gfSahneKart2('getFeadTensionerPropertiesHTML', 'Avara kasnağının merkezi',
    'Gergi panelinin <b>tek konum girdisi</b>. Buraya gergi <i>avarasının</i> merkezi '
    + 'yazılır — gövdenin montaj konumu değil; o, aşağıdaki Kol künyesi kartında '
    + '<b>türetilmiş</b> olarak görünür.');
}

function _gfSahneGergiKol(){
  return _gfSahneKart2('getFeadTensionerPropertiesHTML', 'Kol künyesi',
    'Kol boyu ve kol çalışma açısı bir <b>girdidir</b>. Kartın altındaki '
    + '“gövdenin montaj konumu (türedi)” satırı §7.1’in denetim sayısı: tedarikçi '
    + 'raporunun <i>Tensioner Data → Pivot Point</i> değeriyle karşılaştırılır.');
}

function _gfSahneGergiHareket(){
  return _gfSahneKart2('getFeadTensionerPropertiesHTML', 'Avara hareketi',
    'Gerginin bütün türeyen okumaları tek kartta: serbest kol açısı, gereken kayış '
    + 'boyu, tasarım gerginliği ve kol açısının olanaklı bant içinde olup olmadığı. '
    + 'Alttaki eğri her montaj saatinde çıkacak gerginliği gösterir.');
}

function _gfSahneKayisKunye(){
  return _gfSahneKart2('getFeadBeltPropertiesHTML', 'Künye',
    'Kanal sayısı, tolerans ve aşınma payı buradan girilir; <b>gereken efektif boy</b> '
    + 'kartın altında türetilmiş olarak okunur — kayış boyu bir girdi değil, bir '
    + '<b>çıktıdır</b>.');
}

function _gfSahneKayisKatalog(){
  var html = _gfSahneHTML(function(O){
    if(typeof veFeadBeltCatalogCard !== 'function') return '';
    var n = null;
    O.pack.nodes.forEach(function(x){ if(x.type === 'fead-belt' && !n) n = x; });
    return n ? veFeadBeltCatalogCard(n, true) : '';
  });
  if(!html) return '';
  return veGuideScene(html,
    'Katalog kartı: gereken boya en yakın adaylar, her biri için kolun oturacağı açı '
    + 've çıkacak gerginlikle. <b>◇</b> otomotiv ızgarasını işaretler; sığmayan aday '
    + 'bir sayı basmaz, <b>“sığmıyor”</b> yazar.');
}

function _gfSahneAlgilanan(){
  return _gfSahneKart2('getFeadSolverPropertiesHTML', 'Algılanan model',
    'Çözücünün <b>Algılanan model</b> bölümü modelin tamam olup olmadığını satır satır yazar. '
    + '<b>▶ Hesapla</b> ancak burada sarı satır kalmadığında ve en az bir devir '
    + 'noktası girildiğinde etkinleşir.');
}

function _gfSahneYontem(){
  return _gfSahneKart2('getFeadSolverPropertiesHTML', 'Çözüm zinciri',
    'Çözücünün <b>Çözüm zinciri</b> bölümü: çözümün aşamaları, her birinin sayısal yöntemi '
    + 've girdisinin düzenlendiği pencere.');
}

function _gfSahneMotor(){
  return _gfSahneSurucuKart('Motor',
    'Sürücü kasnağın <b>Motor</b> bölümü: BMC motor kataloğu, silindir sayısı, servis '
    + 'faktörü, ivmelenme ve yavaşlama; altında seçilen motorun devir sınırları, güç eğrisi '
    + 've FEAD tahriki. Motor seçimi sınırları ve — varsa — ara kademenin çaplarını da yazar.');
}

function _gfSahneCevrim(){
  return _gfSahneSurucuKart('Çalışma çevrimi',
    'Sürücü kasnağın <b>Çalışma çevrimi</b> bölümü: her satır bir devir noktası, sütunlar da '
    + 'aksesuarlar. Üstteki <b>Çevrim kaydı</b> seçicisi yedi ölçülmüş çevrimden birini bir '
    + 'anda doldurur.');
}

function _gfSahneRapor(){
  return _gfSahnePanel('getFeadReportPropertiesHTML',
    'Rapor paneli iki bölümü alt alta taşır: <b>Rapor türü</b> (hangi belge indirilecek) ve '
    + '<b>Doküman künyesi</b> (antete, A3 panonun başlık bloğuna ve belgenin sonundaki notlara '
    + 'akan altı alan). Sağ sütun '
    + 'kasnak panellerininkiyle aynı; rapor <b>çözülmüş</b> modelden üretilir, model '
    + 'çözülmemişse düğme pasiftir ve sebebi yazılır.', true);
}

function _gfSahneKatman(){
  var html = _gfSahneHTML(function(O){
    if(typeof veFeadKatmanPanelHTML !== 'function'
       || typeof veFeadKatmanlar !== 'function') return '';
    var n = null;
    O.pack.nodes.forEach(function(x){
      if(!n && (_feadDefOf ? _feadDefOf(x) : {}).isFeadLayout) n = x;
    });
    if(!n) return '';
    // PANELİN AÇIK OLMASI MODELDE DEĞİL, bir görünüm durumu (`VE_FEAD_KAT_ACIK`)
    // ve üretici kapalıyken boş dönüyor. Durum programın KENDİ çağrısıyla
    // açılıp kapatılıyor — modül kapsamındaki değişkene dışarıdan yazılamaz,
    // ve ikinci bir "açık mı" kaynağı tutmak o kuralın ihlali olurdu.
    if(typeof veFeadKatmanToggle !== 'function') return '';
    var html = '';
    try {
      veFeadKatmanToggle(n.id);
      html = veFeadKatmanPanelHTML(n, veFeadKatmanlar(n), true) || '';
    } finally {
      veFeadKatmanToggle(n.id);          // geri kapat
    }
    return html;
  });
  if(!html) return '';
  return veGuideScene(html,
    'Kanvasın <b>Katmanlar</b> paneli. Üstteki iki ön ayar kutucukları bir kerede '
    + 'düzenler; altındaki liste her katmanı tek tek açıp kapatır. Seçim '
    + '<b>kart başına</b> saklanır, yani iki kanvas farklı görünümlerde durabilir.');
}

// SONUÇLAR SEKMESİNİN ÖZET KARTLARI — panonun KENDİ üreticisinden
// (`veFeadResKpiHTML` → `veFeadSignals.summary`). Kartların sayısı ve adı
// çözüme bağlı: ikinci bir liste tutmak, panoda olmayan bir kartı kılavuzda
// göstermek demekti.
function _gfSahneSonucKart(){
  var html = _gfSahneHTML(function(){
    if(typeof veFeadResKpiHTML !== 'function') return '';
    var R = (typeof window !== 'undefined') ? window.veFeadResults : null;
    return veFeadResKpiHTML(R);
  }, true);
  if(!html) return '';
  return veGuideScene(html,
    'Sonuçlar sayfasının FEAD sekmesindeki <b>özet kartları</b>, örnek model '
    + 'çözülmüş hâlde. Sayılar çözümden okunur.');
}

function _gfSahneKapilar(){
  var html = _gfSahneHTML(function(O){
    if(typeof veFeadChecksCard !== 'function') return '';
    return veFeadChecksCard(O.cozucu, O.build);
  });
  if(!html) return '';
  // ALTYAZI ŞEKİLDEN TÜRER. Sabit yazılmıştı ve şekil değişince bayatladı:
  // sahne motorun devir sınırlarını yazmaya başlayınca (2026-09-29) hiçbir
  // satır "değerlendirilemedi" demiyordu ama altyazı o satırları açıklamaya
  // devam ediyordu. Şekil canlıysa onu anlatan cümle de canlı olmak zorunda.
  var alt = 'Uygunluk kriterleri kartı, örnek modelde. Rozetler üç kuralın o modeldeki '
    + 'hükmünü taşır.';
  if(html.indexOf('değerlendirilemedi') >= 0)
    alt += ' “Değerlendirilemedi” satırlarında o kasnağın devir sınırı girilmemiştir.';
  // İki dal da SABİT metin: tırnağın içi bir ifade olsaydı alıntı kapısı onu
  // programın metniyle karşılaştıramazdı.
  var yon = ' bir <b>hükümdür</b> ve yönü söyler (Tablo’daki “Çevrim oranı '
    + 'penceresi” satırı).';
  if(html.indexOf('Kasnak çapı küçültülmeli') >= 0)
    alt += ' Çevrim oranı satırındaki “Kasnak çapı küçültülmeli”' + yon;
  else if(html.indexOf('Kasnak çapı büyütülmeli') >= 0)
    alt += ' Çevrim oranı satırındaki “Kasnak çapı büyütülmeli”' + yon;
  if(html.indexOf('sınırda') >= 0)
    alt += ' Merkez mesafesindeki <b>sınırda</b> rozeti yalnız uyarıdır; negatif pay '
      + 'çiftin alt sınırın altında kaldığını söyler.';
  return veGuideScene(html, alt);
}

// ── BÖLÜM KİMLİKLERİ — içindekiler ve başlıklar TEK KAYNAKTAN ──────────────
// Raporun kendi kuralı: iki yerde yazılsa biri kayardı.
var VE_GUIDE_FEAD_SECTIONS = [
  ['g1',  '1',    'Bu kılavuz nasıl kullanılır'],
  ['g2',  '2',    'Modülün haritası'],
  ['g3',  '3',    'Modüle girmek'],
  ['g4',  '4',    'Kasnakları girmek — Çizim ve Kayış Tablosu'],
  ['g5',  '5',    'Kayış sırası ve dönüş yönü'],
  ['g6',  '6',    'Kasnak künyelerini girmek'],
  ['g7',  '7',    'Otomatik gergiyi tanımlamak'],
  ['g8',  '8',    'Kayış künyesi ve katalog'],
  ['g9',  '9',    'Sürücü kasnak: motor, tahrik ve çalışma çevrimi'],
  ['g10', '10',   'Modeli çözmek'],
  ['g11', '11',   'Sonuçları okumak'],
  ['g12', '12',   'Rapor üretmek'],
  ['g13', '13',   'Sık yapılan hatalar'],
  ['g14', '14',   'Sayısal örnek: Sıfırdan bir FEAD modeli'],
  ['gEk', 'Ek A', 'Alan → Panel hızlı başvurusu']
];

function _gfH2(i){
  var s = VE_GUIDE_FEAD_SECTIONS[i];
  return veGuideH2(s[0], s[1], s[2]);
}

// ═══════════════════════════════════════════════════════════════════════════
//  BÖLÜMLER
// ═══════════════════════════════════════════════════════════════════════════

function _gfSec1(){
  var h = _gfH2(0);
  h += '<p>MFSim’in <strong>FEAD</strong> (Front End Accessory Drive — ön uç aksesuar kayış '
    + 'tahriki) modülüyle bir serpantin kayış sistemini <strong>adım adım</strong> modelleme '
    + 'kılavuzu. Bölümler modelin kuruluş sırasıyla dizilmiştir.</p>';
  h += '<p>Her bölüm üç parçadır: numaralı adımlar, alan tablosu ve uyarı kutusu. Bu modülde '
    + 'yanlış girilen bir alan çoğu zaman <strong>hata vermez</strong> — model yine çözülür, '
    + 'tablolar yine dolar, yalnızca sayılar başkadır; uyarı kutuları bu durumları listeler.</p>';
  h += '<p><strong>Bölüm 14</strong> kılavuzun tamamını tek bir örnekte uygular: boş bir '
    + 'tuvalden gerçek bir aracın FEAD sistemi kurulur ve çıkan sayılar kayış tedarikçisinin '
    + 'raporuyla karşılaştırılır.</p>';
  h += _gfNot('Bölüm 14’ün sayıları',
      'Belge üretilirken hesap zinciri <strong>bellekte</strong> kurulan örnekle koşturulur; '
    + 'Bölüm 14’teki bütün değerler bu hesabın çıktısıdır. Açık proje değişmez.');
  h += '<p>Şeritteki ' + _gfBtn('veGuideKitOpen')
    + ' düğmesi bütün modül kılavuzlarını listeler, açar ve indirir.</p>';
  h += '<h3>1.1 Kim için</h3>';
  h += '<p>Kayış tahrik yerleşimi yapan, tedarikçiye gönderilecek bilgi sayfasını hazırlayan '
    + 'ya da tedarikçiden dönen raporu doğrulamak isteyen makine mühendisi için yazıldı. '
    + 'Kayış–kasnak teorisini bilmek gerekmez; gereken teori, üretilen '
    + '<strong>Detaylı FEAD raporunun</strong> 1–7. bölümlerinde ayrıca anlatılır.</p>';
  h += '<h3>1.2 Ne kadar sürer</h3>';
  h += '<p>Kasnak koordinatları, çaplar ve gergi künyesi hazırsa altı kasnaklı bir sistem '
    + '<strong>15–20 dakikada</strong> kurulur. Hazır bir örnekten (Bölüm 3.3) çözülmüş bir '
    + 'model bir dakikada açılır.</p>';
  return h;
}

function _gfSec2(){
  var h = _gfH2(1);
  h += '<p>FEAD modülünde <strong>altı çalışma yüzeyi</strong> vardır.</p>';
  h += _gfAlanTablo('Altı çalışma yüzeyi ve sorumlulukları', [
    ['<strong>Kayış Yolu çizimi</strong>', 'Kasnakların <strong>giriş yüzeyi</strong> '
      + '(Çizim Masası): kasnağa <strong>tıklayınca</strong> penceresi açılır, '
      + '<strong>sürükleyince</strong> konumu değişir, Kayış Tablosu’nun <strong>＋ Kasnak ekle</strong> '
      + 'listesinden <strong>kayışın üstüne</strong> sürüklenen kasnak iki komşusunun arasına girer. '
      + 'Girdi değiştikçe <strong>canlı</strong> '
      + 'yeniden çizilir ve modelin tutarlı olup olmadığını panel açmadan gösterir.',
      'Bölüm 4 ve 11.1'],
    ['<strong>Kayış Tablosu</strong>', '<strong>Kesin sayının</strong> yüzeyi: Kayış Yolu '
      + 'kartının <strong>altında</strong>, çizimle aynı kâğıtta — Gates raporunun '
      + '<em>Layout Data</em> tablosu gibi. Kartın <strong>Tablo</strong> düğmesi onu o kartta '
      + 'açar ya da kapatır; tablolu kart öteki karttan geniştir. Ad · X · Y · çap · dönüş '
      + 'yönü girilir, efektif çap · sarım · span okunur; <strong>kayış sırası</strong> da '
      + 'buradan değişir. Satırın numarası çizimde kasnağın göbeğinde de yazılıdır. '
      + '<strong>Kasnakların kanvasta kutusu yoktur</strong> — çizim ve bu tablo onların '
      + 'yerine geçer.', 'Bölüm 4 ve 5'],
    ['Paneller', 'Çizimdeki kasnağa ya da tablodaki <strong>ada tıklayınca</strong> açılan '
      + 'özellik pencereleri. Tablonun taşımadığı her şey (temas tarafı, güç eğrisi, gergi '
      + 'künyesi, kayış, çözücü) buradan girilir.', 'Bölüm 6–9'],
    ['<strong>FEAD araçları</strong>', 'Tuvalin sol üstündeki pencere: modeli kurmak '
      + '(<strong>Sihirbaz</strong>), yeni bir çizim açmak (<strong>＋ Kanvas</strong>), çözmek '
      + '(<strong>Hesapla</strong> · <strong>Ayarlar</strong>), raporu indirmek, çevrimin '
      + '<strong>yönünü</strong> çevirmek ve tuvale <strong>not</strong> koymak (gruplama '
      + 'çerçevesi · yazı etiketi). Tuvalde bunların kutusu '
      + '<strong>yoktur</strong> — tuvalde yalnız Kayış Yolu kartları durur; kasnaklar da, '
      + 'kayış da, araçlar da modelde düğüm olarak yaşar.', 'Bölüm 2, 5.2, 10 ve 12'],
    ['<strong>Sonuçlar sayfası</strong>', 'Çözümün <strong>diyagram</strong> yüzeyi: kabuğun '
      + '<em>Sonuçlar</em> sekmesindeki <strong>FEAD kayış tahriki</strong> sekmesi. Özet kartları, '
      + 'dört veri kümesinin şerit diyagramları (çevrim · Campbell · gergi kolu · senaryo) ve '
      + '<strong>Sonuç Özeti</strong> penceresinin tabloları; son çözümün kümelerini gösterir.',
      'Bölüm 11.7'],
    ['Rapor', 'Tek dosyalık, çevrimdışı açılan HTML belge. <strong>Üç tür</strong>: Detaylı, Özet '
      + 've tek yatay A3 sayfaya basılan <strong>sonuç panosu</strong>.', 'Bölüm 12']
  ], ['Yüzey', 'Ne taşır', 'Kılavuzda']);
  h += _gfSahneAraclar();
  h += _gfNot('Eksik bandı eksiği söyler',
      'FEAD pencereleri bütün bölümlerini <strong>tek gövdede</strong>, alt alta taşır. '
    + 'Hesabın okuduğu bir alan eksikse pencerenin en üstünde bir <strong>eksik bandı</strong> '
    + 'belirir ve o eksiğin <strong>sonucunu</strong> yazar — köprünün verdiği hata ya da '
    + 'uygunluk hükmünün verilemeyişi. Yanındaki <strong>Doldur</strong> bağlantısı doğrudan '
    + '<em>o alana</em> götürür, bölümün ilk boş alanına değil; eksik bölüm sol kenarında '
    + 'kehribar bir çizgi taşır ve kaydırırken de görünür. Bant yalnız “boş” demez: boşluğun '
    + 'bir <strong>sonucu</strong> olduğunda eksik sayılır; isteğe bağlı bir alan boş '
    + 'kalabilir, hiçbir hesabın okumadığı bir alan ise hiç işaretlenmez.');
  h += '<h3>2.1 Renk dili — mavi girdi, amber türeyen</h3>';
  h += '<p>Tuvaldeki rozetlerde ve panellerde renk anlam taşır ve kılavuz boyunca aynı '
    + 'anlamı korur:</p>';
  h += '<ul>'
    + '<li><strong>Mavi</strong> — <em>girdi</em>.</li>'
    + '<li><strong>Amber</strong> — <em>türeyen</em> değer.</li>'
    + '<li><strong>Kırmızı</strong> — hesabı doğrudan bozan, hata vermeden yanlış sonuç '
    + 'üretebilecek alan.</li>'
    + '</ul>';
  h += '<h3>2.2 Girdiler ve türeyenler</h3>';
  h += '<p>Her büyüklüğün tek bir kaynağı vardır: gergi kasnağının merkezi girilir, gövdenin '
    + 'montaj konumu türer; kol açısı girilir, kayış boyu türer; yay künyesi girilir, tasarım '
    + 'gerginliği türer.</p>';
  h += _gfAlanTablo('Girdi / türeyen ayrımı', [
    ['Kasnaklar', 'merkez koordinatı (X, Y) · dış çap · temas tarafı · sürücü rolü',
      'teğet noktaları · sarım açıları · açıklık boyları · hız oranları'],
    ['Gergi', '<strong>avara kasnağının merkezi</strong> · kol boyu · kol çalışma açısı · '
      + 'yay künyesi',
      '<strong>gövdenin montaj konumu</strong> → serbest kol açısı → '
      + '<strong>kayış boyu</strong> → tasarım gerginliği'],
    ['Kayış', 'profil (PK / PJ / PH / PL / PM) ve marka',
      'gereken efektif boy · katalogdan uygun aday boylar'],
    ['Çalışma çevrimi', 'devir · %zaman · sıcaklık · aksesuar başına kW',
      'sürücü gücü · açıklık gerilmeleri · hubload · kayma emniyeti · titreşim']
  ], ['Konu', 'Girdi', 'Türeyen']);
  h += _gfNot('Gergide girdi: avara merkezi',
      'Gerginin avara kasnağı <strong>kayış yolunun üstündedir</strong>: teğet noktaları, '
    + 'sarım açıları ve efektif boy onun merkezinden çıkar. Gövdenin cıvatalandığı nokta '
    + 'kolun öbür ucudur ve geometriye girmez. Avara merkezi öteki kasnaklar gibi Kayış '
    + 'Tablosu’nda girilir; montaj konumu ve kayış boyu türer — tasarım aşamasında kayış '
    + 'henüz seçilmemiştir. Ayrıntısı ve denetimi Bölüm 7’de.');
  return h;
}

function _gfSec3(){
  var h = _gfH2(2);
  // ÖRNEK SAYISI SİHİRBAZIN GÖSTERDİĞİ LİSTEDEN (`veFeadExampleKeys` — gizli
  // kayıtlar sayılmaz), elle yazılmaz: yazılan sayı listeyle birlikte değişmez.
  var _ornekSay = (typeof veFeadExampleKeys === 'function') ? veFeadExampleKeys().length : 0;
  var _ornekMetin = _ornekSay ? _ornekSay + ' hazır örnekten' : 'hazır örneklerden';
  h += '<h3>3.1 Modülü açmak</h3>';
  h += _gfAdimlar([
    'Karşılama ekranında <strong>FEAD</strong> kartına tıklayın: kısa bir yükleme ekranından '
      + 'sonra modülün iç topolojisi açılır. Ana tuvalde bir alt-sistem kutusu durur; ona '
      + '<strong>çift tıklamak</strong> aynı yere götürür.',
    'İç topolojide sol taraftaki <em>Bileşenler</em> sütunu <strong>yoktur</strong> — eklemenin '
      + 'hepsi tuvalde (bkz. 3.4) — ve üstte bir gezinme çipi belirir.',
    'İç topolojiden çıkmak için aynı çipi ya da çerçevenin alt kenarındaki çıkış düğmesini '
      + 'kullanın; model alt-sistem kutusunun içine kaydedilir.'
  ]);
  h += '<p><strong>Boş bir FEAD modülünde başlangıç sayfası açılır</strong>; sihirbaz '
    + 'kendiliğinden açılmaz. Sayfada üç seçenek vardır (<em>Sihirbazla kur</em> · '
    + '<em>STEP’ten başla</em> · <em>Boş çizim masası</em>), altında Gates raporlarının kayış '
    + 'yolları; birine basınca model kurulur ve sayfa kapanır. Boş çizim masası tuvale boş bir '
    + '<strong>Kayış Yolu</strong> kartı koyar — çiziminde <em>Sihirbazla kur</em> düğmesi, altında '
    + 'boş Kayış Tablosu ve onun <em>＋ Kasnak ekle</em> listesi durur. Model kurulunca sol üstte '
    + '<strong>FEAD araçları</strong> penceresi belirir (sihirbazı yeniden açmak için '
    + '<strong>Sihirbaz</strong>). Her yolda kasnaklar sonunda <strong>Kayış Yolu '
    + 'kartında</strong> görünür.</p>';
  h += _gfNot('Sayfa yalnız boş topolojide görünür',
      'Kasnağı ya da Kayış Yolu kartı olan modelde sayfa <strong>açılmaz</strong>; kurulum '
    + 'Ctrl+Z ile geri alınınca yeniden açılır. Sihirbaz <strong>FEAD araçları</strong> '
    + 'penceresindeki <strong>Sihirbaz</strong> düğmesiyle her zaman açılır.');

  h += '<h3>3.2 Yol A — Başlangıç Sihirbazı</h3>';
  h += '<p>Sihirbaz bir modelin bütün girdilerini <strong>kuruluş sırasıyla</strong> sorar ve '
    + 'her adımda modeli canlı doğrular.</p>';
  h += _gfAdimlar([
    'Başlangıç sayfasında <strong>Sihirbazla kur</strong>’a basın; model kurulduktan sonra '
      + 'sihirbaz <strong>FEAD araçları</strong> penceresindeki <strong>Sihirbaz</strong>’dan açılır.',
    'Adımları sırayla doldurun. Her adımın solunda o adımın <strong>çizimi</strong> durur '
      + '(kasnaklar, gerginin kolu, kayış, çevrim grafikleri), sağında girdileri; çizimin sol '
      + 'üstündeki sonuç çipi modelin canlı hükmünü yazar. Her adımın rozeti o adımda kalan '
      + 'eksik/uyarı sayısını gösterir.',
    'Son adımda canlı çözümü ve kayış yolu şemasını görün, sonra <strong>modeli kurun</strong> '
      + '— sihirbaz kasnakları ve künyeleri iç topolojiye bir anda yazar. Kasnaklar '
      + '<strong>Kayış Yolu çiziminde</strong> belirir; tuvalde boş bir kart varsa (boş çizim '
      + 'masası) sihirbaz onu geometri kartı olarak kullanır, üçüncü bir çizim kurmaz.'
  ]);
  h += _gfAlanTablo('Sihirbaz adımları ↔ bu kılavuzun bölümleri', [
    ['1 · Başlangıç', 'Sistem adı · <strong>STEP dosyasından</strong> ya da <strong>'
      + _ornekMetin + '</strong> doldurma', 'Bölüm 3.3 ve 3.5'],
    ['2 · Kasnaklar', 'Tip · çap · koordinat · temas tarafı · sürücü · '
      + '<strong>kayış sırası</strong> — kasnak çizimde tıklanarak seçilir, konumu editörde '
      + 'yazılır; çizim sürükleyerek kaydırılır, tekerlekle yakınlaştırılır', 'Bölüm 4, 5 ve 6'],
    ['3 · Otomatik Gergi', 'Avara merkezi · kol boyu · kol açısı · yay künyesi', 'Bölüm 7'],
    ['4 · Kayış', 'Profil · kanal sayısı · katalog sonuçları', 'Bölüm 8'],
    ['5 · Motor ve çevrim', 'Tahrik oranı · motor künyesi · çalışma çevrimi — çizimde '
      + '<strong>tahrik zinciri</strong> ve <strong>devir pencereleri</strong> (tablo '
      + '“Çevrim tablosunu aç” penceresinde)', 'Bölüm 9'],
    ['6 · Özet ve kurulum', 'Canlı çözüm · kayış yolu şeması · modeli kur', 'Bölüm 10 ve 11']
  ], ['Adım', 'Ne sorar', 'Ayrıntısı']);
  h += _gfNot('Kayış sırası “Kasnaklar” adımında',
      'Serpantin sırası <strong>Kasnaklar listesinin kendisidir</strong>; seçili kasnak '
    + 'sırada öne ya da arkaya bu adımda alınır. Kayış Tablosu da aynı işi yapar.');
  h += _gfNot('Sihirbaz ayrı bir model kurmaz',
      'Sihirbazın alanları panellerdeki alanların kendisidir ve doğrulamayı aynı çözücü '
    + 'yapar: sihirbazdaki uyarı paneldekinin aynısıdır. Kurulumdan sonra her alan '
    + 'panellerden düzenlenir.');

  h += '<h3>3.3 Yol B — hazır bir örnekten başlamak</h3>';
  h += '<p>Örnekler <strong>sihirbazın birinci adımındadır</strong>. Kurulan bir örnek, '
    + 'alanların hangi belgeden hangi sayıyı beklediğini gösterir.</p>';
  h += _gfAdimlar([
    'Sihirbazın <strong>1 · Başlangıç</strong> adımını açın.',
    '<strong>' + (_ornekSay ? _ornekSay + ' kayıtlı sistem' : 'Kayıtlı sistemler') + '</strong> '
      + 'arasından birini seçin — hepsi gerçek araçlara ait ve hepsi tedarikçiden <em>dönen</em> '
      + 'Gates raporlarından çıkarılmıştır. Seçim bütün adımların alanlarını bir anda doldurur.',
    'Adımları gezip değerleri görün, sonra son adımda <strong>modeli kurun</strong>. '
      + 'Kasnaklar çizimde ve altındaki <strong>Kayış Tablosu’nda</strong> sırasıyla belirir.'
  ]);
  h += _gfAlanTablo('Örnek kayıtları ne taşır', [
    ['Kasnak künyeleri', 'Ad · tip · koordinat · dış çap · temas tarafı · atalet · '
      + 'aksesuar güç eğrisi', 'Raporun <em>Layout Data</em> ve aksesuar tabloları'],
    ['Gergi', 'Avara merkezi · kol boyu · kol çalışma açısı · yay künyesi · durdurucu',
      '<em>Tensioner Data</em>; montaj konumu modele <strong>girmez</strong>, türetilir'],
    ['Kayış', 'Profil · marka · kanal sayısı · tolerans · aşınma payı', 'Raporun kayış künyesi'],
    ['Çalışma çevrimi', 'Devir · %zaman · sıcaklık · aksesuar başına kW',
      '<em>Duty Cycle</em> sayfası']
  ], ['Ne', 'İçerik', 'Kaynak']);
  h += _gfNot('Örneklerin kaynağı',
      'Her kayıt <strong>bir tedarikçi raporuna bağlıdır</strong>: kurulan örneğin çözümündeki '
    + 'gerginlik, hubload ve sarım değerleri o raporun tablolarıyla karşılaştırılabilir. '
    + 'Bölüm 14 bunu <code>AG00976_GATES_2025</code> üzerinde uçtan uca gösterir.');
  h += _gfUyari('Örnek eklenir, silmez',
      'Örnek yükleme mevcut kasnakların <strong>üzerine ekler</strong>: yeni kasnaklar kayış '
    + 'sırasının sonuna eklenir ve iki sistem tek bir çevrim gibi çözülmeye çalışılır. Temiz '
    + 'bir başlangıç için önce Kayış Tablosu’ndaki satırları ✕ ile boşaltın (ya da '
    + 'çizimde kasnağa tıklayıp <em>Delete</em>).');
  h += '<h3>3.4 Yol C — sıfırdan elle kurmak</h3>';
  h += '<p>FEAD’de <em>Bileşenler</em> sütunu yoktur; eklemenin hepsi <strong>tuvalde</strong>:</p>';
  h += _gfAlanTablo('Ne nereden eklenir', [
    ['<strong>Kasnaklar</strong>', 'Kayış Tablosu’nun başlığındaki <strong>＋ Kasnak ekle</strong> '
      + 'listesi: satırı çizimde <strong>kayışın üstüne</strong> sürükleyin ya da satıra tıklayın',
      'Krank Kasnağı · Alternatör · Klima Kompresörü · Su Pompası · Direksiyon Pompası · '
      + 'Hava Kompresörü · Fan Kavraması · Avara Kasnak · Gergi'],
    ['<strong>Kayış</strong>', 'Kutusu yok: Kayış Yolu çiziminde <strong>kayışa tıklayın</strong> '
      + '(ya da Kayış Tablosu başlığındaki kayış künyesine)',
      'Kayış Özellikleri penceresi — profil · marka · boy · katalog. Modelde tek kayış '
      + 'vardır; FEAD’e girince kendiliğinden kurulur ve silinmez'],
    ['<strong>İkinci bir çizim</strong>', 'FEAD araçları penceresinin <strong>＋ Kanvas</strong> '
      + 'düğmesi', 'Kayış Yolu — aynı modelin başka katmanlarla ikinci resmi; kartların sağına '
      + 'eklenir'],
    ['<strong>Araçlar</strong>', 'Kutusu yok: tuvalin sol üstündeki <strong>FEAD araçları</strong> '
      + 'penceresi', 'Sihirbaz · Hesapla · Ayarlar (Çözücü) · Rapor · Yön. Modelle birlikte '
      + 'gelir, silinmez'],
    ['<strong>Not</strong>', 'FEAD araçları penceresinin <strong>Not</strong> bölümü: '
      + '<strong>Çerçeve</strong> · <strong>Yazı</strong>', 'Tuvale sürüklenen not bırakıldığı '
      + 'yere kurulur; tıklanınca çerçeve kartları çevreler, yazı kartların üstüne oturur. '
      + 'Metin çift tıkla düzenlenir']
  ], ['Ne', 'Nereden', 'İçindekiler']);
  h += _gfNot('Bırakılan yer sırayı belirler',
      'Listeden sürüklenen kasnak çizimde bir <strong>açıklığın</strong> (iki kasnak '
    + 'arasındaki düz kayış) üstüne gelince hedef açıklık vurgulanır ve kasnağın varsayılan '
    + 'çapında bir hayalet imleci izler. Bırakılan kasnak <strong>o iki kasnağın '
    + 'arasına</strong> girer; merkezi bırakılan noktadır. Avara kasnak halkanın '
    + '<em>içine</em> bırakılırsa kaburgalı yüzüyle, <em>dışına</em> bırakılırsa sırtıyla '
    + 'değer. Gergi ile sürücü arasındaki açıklık <strong>kapalıdır</strong> (kırmızı yanar) '
    + '— kayış sırası sürücüyle başlar, gergiyle biter. Çizimin dışına bırakılan kasnak '
    + 'tablonun ekleyicisine gider: otomatik gerginin <strong>önüne</strong> eklenir, tablo '
    + 'açılır ve konumu orada yazılır.');
  h += '<p>Bir model için en az şunlar gerekir: <strong>üç kasnak</strong> (biri sürücü, biri '
    + 'gergi) ve bir <strong>Kayış Yolu</strong> kartı (çizim ve Kayış Tablosu). Kayış, Çözücü '
    + 've Rapor modelle birlikte gelir ve kutuları yoktur: kayışın özellikleri çizimdeki '
    + '<strong>kayışa tıklanarak</strong>, <strong>Çözücü</strong> ve <strong>Rapor</strong> '
    + 'pencereleri <strong>FEAD araçları</strong> penceresinden açılır.</p>';
  h += _gfNot('Kartları dizmek',
      'Tuvalde yalnız Kayış Yolu kartları durduğu için yerleşim bir <em>okunurluk</em> '
    + 'meselesidir, model değil. Şeritteki <strong>Otomatik düzenle</strong> düğmesi onları '
    + 'yan yana dizer ve kadrajı <strong>FEAD araçları</strong> penceresinin sağından başlatır. '
    + 'Kasnaklar ve araçlar dizilmez — dizilecek bir kutuları yok.');
  h += '<h3>3.5 Yol D — kendi CAD montajınızdan (STEP)</h3>';
  h += '<p>CATIA ya da 3DEXPERIENCE düzeninin <strong>STEP dosyasından</strong> kasnakların dış '
    + 'çapı, kanal sayısı ve merkezleri, gerginin avara merkezi, kol boyu ve kol açısı '
    + '<strong>okunur</strong>. Parçaların rolü <strong>elle verilir</strong>; yalnız rol verilen '
    + 'parçalar incelenir ve sihirbaz örnek yükler gibi dolar.</p>';
  h += _gfAdimlar([
    'CAD’de ürün ağacını STEP olarak kaydedin: <code>.stp</code> ya da sıkıştırılmış '
      + '<code>.stpZ</code>, AP214 veya AP242, <strong>katı geometri</strong>. Yalnız üçgen ağ '
      + 'taşıyan bir dosyada okunacak yüzey yoktur.',
    'Sihirbazın <strong>1 · Başlangıç</strong> adımında <strong>STEP dosyası seç…</strong> '
      + 'düğmesine basın ya da dosyayı kartın üstüne bırakın.',
    'Dosya okununca <strong>3B görüntüleyici</strong> ekranı dolduran bir pencerede açılır ve '
      + 'montajın tamamını gösterir. <strong>Gergi otomatik bulunur</strong>: rolü verilmiş gelir ve '
      + '“Gergi otomatik bulundu” diye yazılıdır; öteki parçalar rolsüzdür. Sol tuşla döndürün, sağ tuş ya da '
      + 'Shift ile kaydırın, tekerlekle yaklaşın; <strong>Sığdır</strong> montajı yeniden '
      + 'ortalar.',
    'Kayışa giren her parçaya <strong>tıklayın</strong> ve sağdaki panelden rolünü verin '
      + '(krank, klima, avara, gergi …). Rol verilen parça rolünün rengini alır. Gergi bir '
      + 'alt montajsa panelin <strong>yolunda</strong> (Montaj › Gergi › Kasnak) üst '
      + 'düğüme tıklayıp rolü montaja verin: alt montajın bütün parçaları tek birim olur. '
      + 'Rol verilmeyen parça incelenmez. Model tek krank, tek gergi ve tek kayış taşır.',
    'Kayış parçasına <strong>Kayış</strong> rolü de verilebilir. Kayış kasnak '
      + 'sayılmaz: kodu adından (<code>8PK1410</code> → PK · 8 kanal · 1.410), genişliği '
      + 'yanlarından okunur ve kanal sayısı genişlikle sağlanır (8 × 3,56 = 28,48 mm).',
    '<strong>Çap ve merkezleri hesapla</strong>’ya basın: kasnakların üstünde ölçülen dış '
      + 'çapta birer <strong>halka</strong> belirir, gerginin montaj konumu ve kolu çizilir, panelde '
      + 'çap ve merkezlerin tablosu gelir. Rol değişince sonuç silinir; yeniden '
      + 'hesaplayın.',
    '<strong>Önden bak</strong> kamerayı kayış düzlemine dik çevirir. <em>Önden</em>, '
      + 'kasnakların önünden, motorun karşısından bakıştır: klima krankın hangi yanında '
      + 'görünüyorsa aktarılan düzende de o yanda olur; değilse <em>Arkadan</em>’ı seçin.',
    '<strong>Sihirbaza aktar</strong>’a basın; görüntüleyici kapanır. Sonra '
      + '<strong>2 · Kasnaklar</strong> adımında kayış sırasını doğrulayın ve '
      + '<strong>3 · Otomatik Gergi</strong> adımında yay künyesini seçin.'
  ]);
  h += _gfNot('Kartın listesi de aynı seçimi yazar',
      'Görüntüleyici <strong>Esc</strong> ya da ✕ ile kapanınca STEP kartında ürün ağacı '
    + 've kayış düzleminin önden çizimi kalır; rol ve hesap orada da verilir, ikisi aynı '
    + 'seçimi okur. <strong>3B’de seç</strong> düğmesi görüntüleyiciyi yeniden açar. '
    + 'Görüntüdeki üçgenler yalnız çizim içindir: çap ve merkez dosyanın yazdığı yüzey '
    + 'denklemlerinden ölçülür.');
  h += _gfAlanTablo('STEP dosyasından ne okunur', [
    ['Kasnak dış çapı', '<strong>Kaburga tepesi</strong> — omuz ya da flanş değil', 'okunur'],
    ['Kanal sayısı · profil', 'Kanal adımından (PK = 3,56 mm …)', 'okunur; kayışa kayış rolüyle yazılır'],
    ['Kasnak merkezi', 'Kayış düzleminde X · Y, krank orijinde', 'okunur'],
    ['Gergi', 'Avara merkezi · kol boyu · kol açısı · parça kodu', 'okunur'],
    ['Yay künyesi', 'Ön yük · katsayı · çalışma momenti', '<strong>okunmaz</strong> — 3. adımda seçilir'],
    ['Kayış', 'Kod (8PK1410) · kanal (genişlikten sağlanır)',
      '<strong>Kayış</strong> rolü verilirse okunur; rol yoksa elle girilir'],
    ['Kayış numarası', 'Koddaki boy (1410)', 'Girdi <strong>değil</strong> — 4 · Kayış adımında '
      + '<em>CAD’deki kayış</em> kartı gereken boyla karşılaştırır ve kolun nereye oturduğunu yazar'],
    ['Kayış sırası', 'Kayışın eskizinden: her yayı bir kasnağa eşlenir, krank başta, gergi '
      + 'gevşek tarafta (tablonun sonunda)',
      '<strong>Kayış</strong> rolü verilirse okunur; rol yoksa ağaç sırası gelir']
  ], ['Ne', 'Nasıl', 'Durum']);
  h += _gfUyari('Kayış sırası kayışın eskizinden okunur',
      'Ürün ağacı kasnakların kayışta hangi sırayla dolandığını bilmez; kayışın eskizi bilir. '
    + '3B’de kayışa da <strong>Kayış</strong> rolünü verin: sıra eskizin yaylarından okunur ve '
    + 'aktarmadan önce 3B tablosunda, etiketlerde ve kartın çiziminde numaralı görünür. Kayışın '
    + 'rolü yoksa ya da eskizi her kasnaktan bir kez geçmiyorsa sihirbaz ürün ağacının sırasını '
    + 'kullanır ve <strong>2 · Kasnaklar</strong> adımını uyarıyla işaretler: kayış yolunu '
    + 'şemada kontrol edin, gerekirse ↑ ↓ ile düzeltin ya da <strong>✓ Sıra doğru</strong> ile '
    + 'onaylayın.');
  h += _gfNot('Rolü parça adı belirlemez',
      'Parça adları ve ağacın yapısı dosyadan dosyaya değişir; “ALT” bir dosyada alternatör, '
    + 'ötekinde başka bir şey olabilir. Kasnakların rolü elle verilir ve yalnız rol verilen '
    + 'parçalar incelenir: başka bir kayışın kasnağı ya da çok kanallı bir damperin öteki izi '
    + 'hesaba karışmaz. Kayış düzlemi rol verilen parçaların çoğunun oturduğu düzlemdir; o '
    + 'düzlemin dışında kalan rollü parça aktarılmaz ve adıyla bildirilir.');
  h += _gfNot('Tek istisna: gergi',
      'Gerginin biçimi kasnaklardan ayrışır: kayış düzleminde bir avara ve ona paralel, avaranın '
    + 'dışında, göbekli bir dönme ekseni (gövdenin montaj konumu). Bu biçim rol verilmeden aranır: '
    + 'tek bir aday bulunur ve adı, parça kodu ya da gergi kataloğu da doğrularsa rol önceden '
    + 'verilir. Doğrulanmayan aday yalnız <strong>Gergi olabilir</strong> diye önerilir; '
    + '<strong>Gergi yap</strong> ile verilir. Otomatik rol kaldırılabilir ya da gergi başka bir '
    + 'parçaya verilebilir; elle verilen rol geçerlidir. Gergi alt montaj değil de dağınık parçalar '
    + 'hâlinde gelirse ya da dönme ekseni kasnağın içinde kalan doğrusal bir gergiyse bulunmaz; rol '
    + 'elle verilir.');
  h += _gfNot('Kaburgalı kasnağın kesiti ve hesap çapı',
      'Hesaptan sonra 3B’de bir kasnağa tıklayın: kesiti açılır. Ölçülen değerler dosyadan gelir '
    + '(kanal adımı ve profil, kaburga tepesi d<sub>b</sub>, kanal tabanı ve derinliği), h · h<sub>b</sub> · '
    + 'h<sub>r</sub> seçili markanın kataloğundan; kord çapı d<sub>w</sub> = d<sub>b</sub> + 2·h<sub>b</sub> ve kayış '
    + 'sırtı bunlardan türetilir. Kayışa rol verildiyse okunan <strong>kayış eskizi</strong> '
    + 'de listededir: her yayın yarıçapı ile kasnağın dış çapı arasındaki fark CAD’in kullandığı '
    + 'h<sub>b</sub> (sırttan dolanan kasnakta h<sub>r</sub>). <strong>Hesap çapı</strong> düğmeleri '
    + 'hesabın hangi çizgide kurulacağını seçer (§8.6); STEP’ten kurulan modelde varsayılan eskizin '
    + 'çizgisidir, eskiz yoksa marka kataloğu. Seçim kayış için tektir, bütün kasnaklara birlikte '
    + 'uygulanır; Kayış adımındaki <em>CAD’deki kayış</em> kartı eskizin boyunu modelin korduyla karşılaştırır.');
  h += _gfNot('Kayışın kesiti ve hesap çapı',
      '3B’de kayışa tıklayın (hesaptan sonra hesap bölümündeki <strong>Kayış</strong> satırı da '
    + 'seçer): sağ sütunda kayışın <strong>kesit şekli</strong> açılır — solda kayış tek başına '
    + '(kaburga adımı s, kayış yüksekliği h), sağda kasnağa oturmuş (sırt yüksekliği h<sub>r</sub>, '
    + 'çizgi farkı h<sub>b</sub>; kord çizgisi d<sub>w</sub> ve kasnak dış çapı d<sub>b</sub>). Şeklin '
    + 'sayıları çizilen kayışındır: marka kataloğu, CAD seçiliyse eskizin h<sub>b</sub> / h<sub>r</sub>’si. '
    + 'Altındaki <strong>Hesap çapı</strong> tablosunda sütun bir seçenek, satır bir kasnaktır: her '
    + 'kasnağın üç hesap çapı yan yana okunur, sütun başlığına basmak seçer ve şekildeki hesap '
    + 'çizgisi seçimi izler. En altta seçili markanın beş profil için <strong>karakteristik '
    + 'ölçüleri</strong> (ContiTech kataloğunun Tablo 1’i gibi; kayışın profili vurgulu, değerin '
    + 'kaynağı son satırda). Şekil hesaptan önce de açılır — profil kayışın adındaki koddan; kasnak '
    + 'çapları ve CAD eskizi seçeneği hesaptan sonra gelir.');
  h += _gfNot('Künye ile dosyadaki gergi',
      'Künye seçmek gerginin parça alanlarını (kol boyu · kasnak çapı · parça kodu) katalogdan '
    + 'yazar. Seçilen künye STEP’teki parçadan farklıysa gergi adımı farkı adıyla gösterir; '
    + 'elle yazılan değer için uyarı çıkmaz.');
  h += _gfSahneSerit();
  return h;
}

function _gfSec4(){
  var h = _gfH2(3);
  h += '<p>Kasnaklar iki yüzeyde girilir ve ikisi <strong>aynı alanları</strong> yazar. '
    + '<strong>Kayış Yolu çizimi</strong> kasnağın yerini gösterir ve taşır; <strong>Kayış '
    + 'Tablosu</strong> kesin sayının yeridir — FEAD hesap defterinin sütun sırasını taşır, '
    + 'tedarikçi bilgi sayfası satır satır kopyalanabilir. Tablo Kayış Yolu kartının '
    + '<strong>altındadır</strong> — çizimle aynı kâğıtta; satırın numarası çizimde kasnağın '
    + 'göbeğinde de yazılıdır. Kartın yüzen çubuğundaki <strong>Tablo</strong> düğmesi onu o '
    + 'kartta açar ya da kapatır; tablolu kart öteki karttan geniştir.</p>';
  h += _gfUyari('Kasnakların kanvasta kutusu yoktur',
      'Bu modülde kasnaklar modelde <strong>düğüm olarak durur</strong> — kaydedilir, '
    + 'geri alınır, panelleri açılır — ama tuvale <strong>kutu çizilmez</strong>. Kasnaklar '
    + 'Kayış Yolu <strong>çiziminde</strong> görünür: seçmek, taşımak ve eklemek orada; kesin '
    + 'sayılar Kayış Tablosu’nda.');
  h += _gfAdimlar([
    'Kasnağı ekleyin: tablonun başlığındaki <strong>＋ Kasnak ekle</strong> listesini açın; bir '
      + 'satırı çizimde <strong>kayışın üstüne</strong> sürükleyip bırakın (iki komşusunun '
      + 'arasına girer) ya da satıra tıklayın — tık kasnağı otomatik gerginin '
      + '<strong>önüne</strong> ekler ve satırı görüş alanına alır.',
    'Konumu verin: kasnağı çizimde <strong>sürükleyerek</strong> kabaca, tablonun '
      + '<strong>X</strong>, <strong>Y</strong> ve <strong>D</strong> alanlarına yazarak '
      + 'kesin olarak. Alana tıklayıp yazın; alandan çıkınca model ve çizim güncellenir. '
      + '<strong>Sekme</strong> sağdaki hücreye, <strong>Enter</strong> alttaki satırın aynı '
      + 'hücresine geçer.',
    '<strong>Kasnak Dönüş Yönü</strong> hücresindeki yazıya (<strong>Sağ</strong> ya da '
      + '<strong>Sol</strong>) tıklayın — öteki yöne döner; bu, kayışın o kasnağa hangi '
      + 'yüzünden değdiğini belirler (Bölüm 5.1).',
    'Çizimde kasnağa ya da tablodaki <strong>adına</strong> tıklayarak panelini açın ve '
      + 'tablonun taşımadığı alanları '
      + '(temas tarafı ayrıntısı, atalet, güç eğrisi, devir sınırları) girin — Bölüm 6.',
    'Bütün kasnakları girdikten sonra kartın <strong>sağ üstündeki</strong> '
      + '<strong>✓ Σsarım</strong> rozetine bakın: <strong>360,0°</strong> olmalı.'
  ]);

  h += '<h3>4.1 Çizimde çalışmak</h3>';
  h += _gfAlanTablo('Çizimde ne yapılır', [
    ['<strong>Tıklamak</strong>', 'Kasnağın penceresi açılır; kasnak iki çizimde de işaretli '
      + 'kalır', 'Tablodaki ada tıklamakla aynı'],
    ['<strong>Sürüklemek</strong>', 'Kasnağın konumu imleçle birlikte değişir (0,1 mm '
      + 'ızgara); sürüklerken konum ve iki komşu açıklığın boyu ekranda yazılır',
      'Gergide oynayan avara <strong>merkezidir</strong>; montaj konumu ondan türer '
      + '(Bölüm 7)'],
    ['<strong>Ok tuşları</strong>', 'Seçili kasnak 1 mm, <em>Shift</em> ile 10 mm kayar',
      'Adım tamdır — girilmiş hassasiyet yuvarlanmaz'],
    ['<strong>Delete</strong>', 'Seçili kasnak silinir, sıra kapanır',
      'Otomatik gergi silinmez'],
    ['<strong>Kayışın üstüne bırakmak</strong>', '<strong>＋ Kasnak ekle</strong> listesinden '
      + 'sürüklenen kasnak o açıklığın iki kasnağının arasına girer', 'Gergi ile sürücü arası '
      + 'kapalıdır; gergi yalnız tıklanarak eklenir'],
    ['<strong>Tablo</strong> düğmesi', 'Kartın altındaki Kayış Tablosu’nu açar / kapatır',
      'Satırın üstüne gelmek kasnağı iki çizimde de yakar; kasnağın üstüne gelmek satırını']
  ], ['Eylem', 'Sonuç', 'Not']);
  h += _gfNot('Kayışı koparan hamle yazılmaz',
      'Başka bir kasnağın içine ya da kayış yolunu kapatamayacağı bir yere sürüklenen kasnak '
    + '<strong>son geçerli yerinde</strong> durur ve kartın durum şeridi sebebini yazar (<em>Buraya taşınamaz — …</em>). Her sürükleme, her ok basışı '
    + 've her ekleme <strong>tek bir geri-al adımıdır</strong>.');

  h += _gfSahneTablo();
  h += '<h3>4.2 Tablonun alanları</h3>';
  h += '<p>Tablo tedarikçi raporunun <strong>Layout Data</strong> tablosu gibi dizilir: ince '
    + 'yatay çizgiler, her satır bir <em>kasnak</em>. Solda <strong>kimlik</strong> (numara · '
    + 'ad), ortada <strong>girdiler</strong>, sağda — tek bir dikey çizginin ardında, gömülü '
    + 'zeminde — <strong>çözüm değerleri</strong>. Çözüm sütunlarına yazılamaz.</p>';
  h += '<p>Grupların <em>içindeki</em> sıra defterin sırasıdır: girdi grubunda '
    + '<strong>X · Y · D · Kasnak Dönüş Yönü</strong>, çözüm grubunda <strong>Efektif Çap · '
    + 'Sarım Açısı · Span Uzunluğu</strong> — tedarikçi raporu satır satır kopyalanabilir. '
    + 'Sütun başları kısadır (<em>Ø eff</em>, <em>Sarım</em>, '
    + '<em>Span</em>); <strong>defterdeki tam ad</strong> başlığın üstüne gelince görünür. '
    + 'Uzunluklar mm’dir — başlık şeridinde bir kez yazılı.</p>';
  h += _gfTablo('Kayış Tablosu alanları',
    ['Alan', 'Girdi mi', 'Ne yazar / nereden gelir'],
    [
      ['<strong>#</strong>', 'sıra', 'Kayış sırasındaki numara — çizimde kasnağın göbeğinde '
        + 'de aynı numara yazılıdır. Satıra gelince <strong>↑ ↓</strong> okları belirir. '
        + 'Sürücünün numarası dolu çizilir ve satırı <strong>kilitlidir</strong> — sıra ondan '
        + 'başlar; gerginin numarası yeşil halkadır (Bölüm 5)'],
      ['<strong>KASNAK</strong>', 'girdi', 'Kasnağın adı, bir <strong>düğme</strong> olarak. '
        + 'Tıklandığında <strong>panelini açar</strong>; sonuç tablolarında sütun başlığı olur'],
      ['<strong>X</strong> · <strong>Y</strong>', 'girdi', 'Kayış düzlemindeki merkez, mm. '
        + 'Orijin sürücü kasnaktır. <strong>Gergi satırında bu, avara kasnağının '
        + 'merkezidir</strong> — gövdenin montaj konumu değil (Bölüm 7)'],
      ['Efektif Çap', 'çözümden', 'Kayışın gerçekten üzerinden geçtiği çap: kaburgalı '
        + 'temasta <em>D + 2·h<sub>b</sub></em>, sırttan temasta <em>D + 2·h<sub>r</sub></em>. '
        + 'Profil sabitinden gelir'],
      ['<strong>D</strong>', 'girdi', 'Kasnağın <strong>dış çapı</strong>, mm. Pitch çapı '
        + 'girilmez — profilden türer'],
      ['<strong>Kasnak Dönüş Yönü</strong>', 'girdi', 'Yön yazılıdır (<strong>Sağ</strong> '
        + 'ya da <strong>Sol</strong>, yanında dönüş oku); tıklamak öteki yöne çevirir. Seçim '
        + '<em>temas tarafını</em> yazar; ikinci bir yön alanı tutulmaz (Bölüm 5.1)'],
      ['Sarım Açısı', 'çözümden', 'Kayışın o kasnağı sardığı açı, derece'],
      ['Span Uzunluğu', 'çözümden', 'O kasnağın <strong>çıkışındaki</strong> serbest açıklık, mm'],
      ['Kayış Uzunluğu', 'çözümden', 'Tabloda <strong>değil</strong>, kartın sağ üst '
        + 'rozetinde (<em>L … mm</em>): boy satıra değil çevrimin tamamına aittir'],
      ['✕', 'işlem', 'Kasnağı modelden siler. Satırın <strong>en sağında</strong>, girdi '
        + 'alanlarından ayrı durur; dinlenmede görünmez, satıra gelince belirir. Gerginin ✕’i '
        + 'pasiftir: her modelde tek bir gergi vardır']
    ], ['l', 'c', 'l']);
  h += _gfNot('Girdi ve çözüm sütunları',
      'Girdiler <strong>dikey çizginin solunda</strong>, çözüm değerleri <strong>sağında</strong>, '
    + 'gömülü zeminde durur; gruplama tedarikçi sayfasının sırasının üstüne kuruludur.<br><br>'
    + 'Girdi hücresi <strong>dinlenmede düz metindir</strong>, üstüne gelince altı çizilir, '
    + 'tıklanınca alan olur; <strong>ad düğmesi</strong> simgesiyle durur. Fare bir satırın '
    + 'üzerine gelince satır zemini değişir ve kasnak çizimde yanar; paneli açık olan kasnağın '
    + 'satırı işaretli kalır.');
  h += _gfNot('Ondalık ayırıcı virgül',
      'Hücreler <code>63,5</code> yazımını kabul eder ve 63,5 olarak okur.');

  h += '<h3>4.3 Başlık şeridi ve kartın rozeti</h3>';
  h += '<p>Tablonun başlık şeridinde <strong>Layout Data · mm</strong>, kayışın profili ve '
    + 'markası ve <strong>＋ Kasnak ekle</strong> listesi durur. Çevrime ait sayılar tabloda '
    + '<strong>tekrarlanmaz</strong>: kapanış hükmü kartın sağ üst rozetindedir ve kartın kendi '
    + 'kol konumuyla verilir.</p>';
  h += _gfAlanTablo('Nerede ne okunur', [
    ['<strong>Rozet</strong> (kartın sağ üstü)', '<strong>✓ Σsarım</strong> · kasnak sayısı · '
      + '<strong>L</strong> (efektif boy)',
      '<strong>Σsarım 360,0° olmak zorundadır.</strong> Değilse rozet arızanın cümlesini yazar '
      + '(<em>Kayış yolu kapanmıyor</em>, <em>Kayış kasnağın içinden geçiyor</em>)'],
    ['<strong>Gergi sonda değil</strong> (başlık şeridi)', 'Yalnız kural kırıkken belirir',
      'Sıra sürücüyle başladığına göre gergi son satır olmalı (Bölüm 5)'],
    ['<strong>Profil · marka</strong> ve <strong>kip anahtarı</strong> (başlık şeridi)',
      'Kayışın künyesi ve boy kipi',
      'Künyeye tıklayın → <em>Kayış Özellikleri</em> penceresi (katalog seçicisi orada). '
      + 'Yanındaki anahtar kayış boyu kipini çevirir; avara merkezi girdiyken kilitlidir']
  ], ['Nerede', 'Ne gösterir', 'Nasıl okunur']);

  h += '<h3>4.4 Kasnak eklemek, silmek, adlandırmak</h3>';
  h += _gfAlanTablo('Üç işlem', [
    ['Eklemek', '<strong>＋ Kasnak ekle</strong> listesinden bir satırı çizimde '
      + '<strong>kayışın üstüne</strong> sürükleyin ya da satıra tıklayın',
      'Çizimde bırakılan açıklığa, listeden eklenen otomatik gerginin önüne düşer; '
      + 'sıra sonra ↑ ↓ ile taşınır'],
    ['Silmek', 'Satırın en sağındaki <strong>✕</strong> ya da çizimde seçip <em>Delete</em>',
      'Kasnak modelden çıkar, numaralar 1…N−1 olacak şekilde kapanır. Geri almak için '
      + '<em>Geri al</em> — silme geri-al yığınına yazılır'],
    ['Adlandırmak', 'Ad <strong>düğmesine</strong> tıklayıp panelini açın, adı orada '
      + 'değiştirin',
      'Adlar sonuç tablolarında ve raporda sütun başlığı olur; kısa ve ayırt edici seçin']
  ], ['İşlem', 'Nasıl', 'Not']);
  h += _gfUyari('Girdi alanları geometri çözülemese de doludur',
      'Model çözülemiyorsa (kasnaklar çakışıyor, gergi künyesi eksik) çözüm sütunları — '
    + 'yazar; <strong>ad · X · Y · D dolu durur</strong>.');
  return h;
}

function _gfSec5(){
  var h = _gfH2(4);
  h += '<p>Kayış yolu bir <strong>graf değil, bir listedir</strong>: hangi kasnaktan hangisine '
    + 'gidildiği Kayış Tablosu’nun <strong>satır sırasıdır</strong>. Kasnaklar arasına tel '
    + 'çekilmez, port tıklanmaz — sıra tablodan okunur ve tablodan değiştirilir.</p>';
  h += _gfAdimlar([
    'Satırı taşımak için numaranın yanındaki <strong>↑</strong> ya da <strong>↓</strong> '
      + 'okuna basın (satıra gelince belirir). Sıra değişir, kayış yolu ve bütün türeyen '
      + 'sütunlar anında yeniden çözülür.',
    'Sıranın <strong>sürücü kasnaktan başladığını</strong> doğrulayın: sürücünün numarası '
      + 'dolu çizilir ve satırı kilitlidir, oklarla taşınamaz.',
    'Kartın rozeti <strong>✓ Σsarım 360,0°</strong> diyene kadar sırayı ve dönüş '
      + 'yönlerini düzeltin.'
  ]);
  h += _gfUyari('Gates tabloları ters sırada yazar',
      'Tedarikçi raporlarının kasnak tablosu kayışın <strong>gidişinin tersi</strong> '
    + 'sırayla dizilmiştir; Kayış Tablosu da listeyi o sırada tutar ve rapor satır satır '
    + 'kopyalanabilir. Doğru kurulmuş bir modelde krank kasnağı <strong>saat yönünde</strong> '
    + 'döner; şemadaki kasnak içi oklar bunu gösterir. Yol tersine dönmüşse <strong>FEAD '
    + 'araçları</strong> penceresinin <strong>Yön</strong> bölümünü kullanın (Bölüm 5.2).');

  h += '<h3>5.1 Kasnak Dönüş Yönü sütunu</h3>';
  h += '<p>Kayış Tablosu’nun girdi bölgesindeki <strong>Kasnak Dönüş Yönü</strong> hücresi bir '
    + 'metin düğmesidir: yön yazılıdır (<em>Sağ</em> ya da <em>Sol</em>, yanında dönüş oku), '
    + 'tıklamak öteki yöne çevirir. Seçilen yön kayışın o kasnağa hangi yüzünden değdiğini — '
    + '<strong>temas tarafını</strong> — yazar.</p>';
  h += _gfAlanTablo('Yön ↔ temas tarafı', [
    ['Kayış kaburgalı yüzden değiyor', 'Kasnak çevrimin süpürme yönünde döner',
      'Aksesuar kasnakları: alternatör, klima, su pompası, direksiyon, hava kompresörü'],
    ['Kayış sırttan (düz yüzden) değiyor', 'Kasnak ters yönde döner',
      'Avara kasnakları ve çoğu gergi']
  ], ['Ne demek', 'Kasnak nasıl döner', 'Tipik olarak']);
  h += _gfNot('Tek alan: temas tarafı',
      'Yön hücresi ayrı bir “yön” verisi tutmaz; doğrudan <strong>temas tarafını</strong> '
    + 'yazar ve o alan panelde de görünür. Yön değişince <em>Efektif Çap</em> da değişir '
    + '(2·h<sub>r</sub> ↔ 2·h<sub>b</sub>): kayış kasnağa başka bir yüzeyden değer. Süpürme '
    + 'işareti okunamıyorsa (model çözülemiyor) alanın yerinde <strong>—</strong> durur ve '
    + 'düğme çizilmez.');

  h += '<h3>5.2 Yön — bütün yolu çevirmek</h3>';
  h += '<p>Yanlış olan <strong>çevrimin tamamının</strong> yönüyse:</p>';
  h += _gfAdimlar([
    '<strong>FEAD araçları</strong> penceresinin <strong>Yön</strong> bölümünde '
      + '<strong>CW</strong> ya da <strong>CCW</strong>’ye basın. Bütün kayış yolu yerinde '
      + 'çevrilir; ayrı bir “yön” verisi yazılmaz, Kayış Tablosu’nun sırası çevrilir.',
    'Sonuç geçersiz olur — <strong>Hesapla</strong>’ya basın.',
    'Bölümün altındaki satıra bakın: gerginin hangi tarafta olduğunu söyler.'
  ]);
  h += _gfAlanTablo('Yön bölümünün hükmü', [
    ['Yeşil', 'Gergi kayışın <strong>gevşek</strong> tarafında', 'Doğru yerleşim — devam edin'],
    ['Kırmızı', 'Gergi kayışın <strong>gergin</strong> tarafında; satır en düşük açıklık '
      + 'gerilmesini ve ankrajın ne kadar altında kaldığını yazar', 'Yönü çevirin ya da gergiyi '
      + 'kayış sırasında sürücünün önüne alın'],
    ['Satır yok', 'Güncel çözüm yok (hiç çözülmedi ya da yön değişti)', '<strong>Hesapla</strong>']
  ], ['Renk', 'Ne demek', 'Ne yapmalı']);
  h += _gfUyari('Ters yerleşim hata vermez',
      'Gergi gergin tarafa düştüğünde geometri <strong>kusursuz çözülür</strong>: kapalı çevrim '
    + 'tutar, Σ sarım yine 360° çıkar, tablo yeşil görünür. Bozulan tek şey gerilme zinciridir — '
    + 'açıklık gerilmeleri ankrajın altına iner ve bir kısmı negatife döner. Ölçülen 14 '
    + 'tedarikçi sisteminin <strong>14’ünde de</strong> gergi gevşek taraftadır; istisna yoktur. '
    + 'Bu durumda kayma emniyeti hükmü <strong>verilmez</strong>: çöken bir zincirde '
    + 'çıkan emniyet faktörü bir marj değil, sayısal bir gölgedir.');

  h += '<h3>5.3 Modelin kurulu olduğunu doğrulamak</h3>';
  h += '<p>İki yerde aynı denetim yazılıdır ve ikisi de aynı çözümden gelir:</p>';
  h += _gfAlanTablo('Kapanış denetimi', [
    ['Kayış Yolu kartı — sağ üst rozet', '✓/✗ Σsarım · kasnak sayısı · L (efektif boy) · kord',
      'Σsarım <strong>360,0°</strong> olmak zorunda; ✗ ise sebebini yazar (“Kayış yolu '
      + 'kapanmıyor”, “Kayış kasnağın içinden geçiyor”)'],
    ['Pencerelerin sağ sütunu', '<em>Çevrim kapalı</em> kriteri · Σ',
      'Aynı çözümden; değerlendirilemiyorsa gri']
  ], ['Nerede', 'Ne yazar', 'Kural']);
  return h;
}

function _gfSec6(){
  var h = _gfH2(5);
  h += '<p>Koordinat, çap ve dönüş yönü dışındaki alanlar <strong>kasnak panelindedir</strong>: '
    + 'çizimde kasnağa ya da Kayış Tablosu’nda kasnağın <strong>adına tıklayın</strong>, panel '
    + 'açılır. Hesabı en çok etkileyen ve hata vermeden yanlış girilebilen alan '
    + '<strong>temas tarafıdır</strong>.</p>';
  h += _gfAlanTablo('Kasnak paneli — alanlar', [
    ['Temas tarafı', '“Kaburgalı yüzden değiyor” ya da “Sırtından değiyor”',
      'Yerleşim çiziminden okunur. Aksesuarlar tipik olarak kaburgalı, avara ve gergi sırttan '
      + 'temas eder.'],
    ['Dış çap (OD)', 'Kasnağın dış çapı, mm', 'Koordinat tablosu. <strong>Pitch çapı '
      + 'girilmez</strong> — kayış profilinden türer. Kayış Tablosu’ndaki '
      + '<em>D</em> sütunuyla <strong>aynı alandır</strong>, iki yerden de girilebilir'],
    ['Konum X / Y', 'Kayış düzleminde merkez, mm', 'Kayış Tablosu’ndaki X ve Y sütunlarının '
      + 'aynısı; orijin sürücü kasnaktır ve işareti sayfadaki gibi yazılır'],
    ['Sürücü kasnak', 'Tek kasnakta işaretlenir', 'Kayışı hangi kasnağın döndürdüğü. Bir '
      + '<strong>roldür</strong>, tip değil: ikincil tahrikte fan kasnağı da sürücü olabilir.'],
    ['Atalet', 'kg·m², <strong>değeriyle yazılı</strong>', 'Tepe yük ve burulma titreşimi hesabına '
      + 'girer. Boşken arşivin medyanı alanın <em>değeri</em> olarak görünür; yanındaki '
      + '<strong>i</strong> kaynağını söyler. Sürücüde alan <strong>krank milinin</strong> ataletidir'],
    ['Model', 'Alternatör / klima / hava kompresörü — <strong>tek seçici</strong>',
      'BMC künyeleri (devir sınırı + eğri) ve Araç Performans kataloğu (eğri) aynı listede; '
      + 'sihirbazın seçicisiyle aynı'],
    ['Güç eğrisi', 'Aksesuar devri → kW tablosu', 'Bilgi sayfasındaki grafiğin altındaki '
      + 'tablo. Girilirse <strong>katalog modelinin önüne geçer</strong>.']
  ]);
  h += _gfUyari('Temas tarafı — hata vermeyen alan',
      'Ters verilen temas tarafıyla <strong>geçerli ama başka</strong> bir kayış yolu çözülür: '
    + 'kapalı çevrim tutar, sarım değişmezi tutar, uyarı çıkmaz. Bir örnekte krank sarımı '
    + '207,7° yerine 172,2° çıkar (<strong>35,5° fark</strong>) ve model yine çözülür.<br><br>'
    + 'Temas tarafı <strong>üç yerde</strong> görünür: panelde, <strong>Kayış Tablosu’nun '
    + '“Kasnak Dönüş Yönü” sütununda</strong> (Bölüm 5.1) ve Kayış Yolu şemasında '
    + '<strong>kayışın kaburgalı yüzü çizilerek</strong> — kaburgalı temas eden kasnakta dişler '
    + 'kasnağın içine, sırttan temas edende dışarı bakar.');
  h += '<h3>6.1 Aksesuar gücünün kaynağı</h3>';
  h += '<p>Aksesuarın çektiği güç üç kaynaktan gelir; <strong>biri yeter</strong>:</p>';
  h += _gfAlanTablo('Aksesuar gücünün iki kaynağı', [
    ['Güç eğrisi', 'Kasnak panelinde, aksesuar devri → kW tablosu',
      'Bilgi sayfası her aksesuar için kendi ölçülmüş eğrisini veriyorsa'],
    ['Çalışma çevrimi hücresi', 'Sürücü kasnağın Çalışma çevrimi bölümünde, devir satırı × kasnak sütunu',
      'Tedarikçi raporu güçleri doğrudan devir noktası başına veriyorsa'],
    ['Model', 'Kasnak penceresinin Katalog modeli bölümünde, hazır model seçimi',
      'Ölçülmüş eğri yoksa; boş bırakılan kW hücreleri buradan dolar']
  ], ['Kaynak', 'Nerede', 'Ne zaman']);
  h += _gfNot('Model seçmek o aksesuarın çevrim kW’larını siler',
      'Öncelik sırası <em>çevrimdeki kW › kendi eğrisi › katalog</em>. Elle yazılmış bir kW '
    + 'seçilen modeli o satırda ezer; eğri getiren bir model seçimi <strong>o aksesuarın</strong> '
    + 'çevrim hücrelerini temizler ve temizlenen hücre sayısını yazar. '
    + 'Sonradan yazılan kW’ı Katalog modeli ve Güç eğrisi bölümleri satır sayısıyla bildirir.');
  h += _gfSahneModel();
  h += _gfSahneKasnakPaneli();
  h += '<h3>6.2 Devir sınırları — uygunluk kriterinin girdisi</h3>';
  h += _gfSahneDevirSinir();
  h += '<p>Aksesuar kasnaklarının panelinde bir <strong>Devir sınırları</strong> kartı vardır; '
    + 'üç sayısı Bölüm 11.4’teki uygunluk kriterlerinin <strong>girdisidir</strong>. Boşsa '
    + 'kriter hüküm veremez ve o kasnak <strong>“değerlendirilemedi”</strong> sayılır — uygun '
    + 'sayılmaz.</p>';
  h += _gfAlanTablo('Devir sınırları kartı', [
    ['Optimum [d/dk]', 'Aksesuarın çalışmasının istendiği devir',
      '<strong>Model</strong> seçiminden gelir (on alternatör ve dört klima künyesi); elle '
      + 'girilen değer katalogun önüne geçer'],
    ['Maks. sürekli [d/dk]', 'Sürekli aşılmaması gereken devir',
      'Optimum ile bu değerin arası <strong>çalışma bandıdır</strong>: motor '
      + '<em>governed</em> devrindeyken aksesuar bu banda düşmüyorsa panel '
      + '<strong>kasnak çapı küçültülmeli / büyütülmeli</strong> der'],
    ['Maks. anlık [d/dk]', 'Motor <em>overspeed</em>’e çıktığında aşılmaması gereken sınır',
      'Anlık aşım kriteri']
  ]);
  h += _gfNot('Katalog bir kısıt değil, bir öneridir',
      'Modülün dört kütüphanesinde de (kayış · gergi · motor · aksesuar) katalog seçimi alanları '
    + '<strong>doldurur</strong>, kilitlemez. Elle değiştirilen alanları kart sayısıyla yazar: '
    + '“şu kadar alan elle girilmiş ve katalog değerinin yerine geçiyor”.');
  h += _gfNot('Aksesuar devri çaptan hesaplanır',
      'Aksesuarın devri <strong>kasnak pitch çaplarından</strong> gelir; hız oranı girilmez. '
    + 'Kasnak panelindeki güç eğrisi tablosunun yanında o aksesuar devrini veren '
    + '<em>motor devri</em> de yazılıdır.');
  return h;
}

function _gfSec7(){
  var h = _gfH2(6);
  h += '<p>Otomatik gergi modelin en çok girdi isteyen bileşenidir. Paneli çizimde gergiye '
    + 'ya da <strong>Kayış Tablosu’ndaki adına tıklanarak</strong> açılır — gerginin de '
    + 'kanvasta kutusu yoktur. Çizimde sürüklenen, avara kasnağının <strong>merkezidir</strong>. '
    + '<strong>Tek konum girdisi</strong> öteki kasnaklarınkiyle aynıdır: <strong>avara '
    + 'kasnağının merkezi</strong>. Gövdenin montaj konumu, serbest kol açısı ve kayış boyu '
    + 'bundan <strong>türer</strong>.</p>';
  h += _gfAdimlar([
    'Önce <strong>Gergi künye kütüphanesi</strong> kartına bakın: gergi bu 14 ölçülmüş '
      + 'künyeden biriyse seçin; kol boyu · ön yük · yay katsayısı · kasnak çapı · temas '
      + 'tarafı bir anda dolar.',
    'Kütüphanede yoksa <strong>Yay künyesi</strong> kartına üç sayıyı elle girin: ön yük, '
      + 'yay katsayısı, çalışma momenti.',
    '<strong>Avara kasnağının merkezi</strong> kartına gergi kasnağının merkez X ve Y’sini '
      + 'yazın — bilgi sayfasının koordinat tablosundaki gergi satırı budur.',
    '<strong>Kol künyesi</strong> kartına kol boyunu ve <strong>kol çalışma açısını</strong> '
      + 'yazın. Kartın altında gövdenin montaj konumu türetilmiş olarak görünür.',
    '<strong>Avara hareketi</strong> kartındaki okumaya bakın: serbest kol açısı, gereken '
      + 'kayış boyu ve tasarım gerginliği orada.'
  ]);
  h += _gfAlanTablo('Gergi paneli — alanlar', [
    ['Temas tarafı', 'Genelde “Sırtından değiyor”', 'Yerleşim çizimi'],
    ['Dış çap (OD)', 'Gergi kasnağının dış çapı, mm', 'Parça künyesi'],
    ['Atalet J', 'kg·m²', 'Parça künyesi; burulma modeline girer'],
    ['<strong>Merkez X / Y</strong>', 'Gergi <strong>avarasının</strong> merkezi — kayış '
      + 'yolu buradan geçer. <strong>Tek</strong> konum girdisi; '
      + 'Kayış Tablosu’nun gergi satırındaki X / Y sütunlarıyla <strong>aynı alan</strong>',
      'Bilgi sayfasının koordinat tablosu, gergi satırı; dönen raporda <em>Layout Data</em>'],
    ['Kol boyu (Arm Length)', 'Montaj ekseni ile kasnak merkezi arasındaki sabit mesafe, mm',
      'Raporun <em>Tensioner Data</em> bölümü; 56–90 mm aralığında doğrulandı'],
    // KILAVUZ PROGRAMIN YAZDIĞINI ALINTILAR. Panelin alanı "Kol yönü" ve
    // NİSPİ (merkez→gövde, işaretli); kılavuz onu "mutlak" diye tanıtıyordu
    // ve iki yüzey ayrışmıştı. Mutlak açı yine anlatılıyor — parça çiziminin
    // dili o — ama AYRI bir ad ve açık bir çeviriyle.
    ['<strong>Kol yönü</strong>', 'Gövdenin montaj noktasının avara merkezine '
      + 'göre yönü — <strong>merkez→gövde</strong>, 0° sağda, saat yönünün '
      + 'tersi artı, işaretli (−180…+180). Panele <strong>bu</strong> girilir.',
      'Gerginin parça/montaj çizimi aynı yönü ters uçtan ve mutlak yazar '
      + '(E9843 parça çizimi: <em>344° MEAN ANGLE</em> ↔ panelde <strong>164°</strong>)'],
    ['θ<sub>kol</sub> (mutlak)', 'Aynı kolun <strong>gövde→merkez</strong> yönü, '
      + '0…360. Çekirdeğin, raporun ve pim açısının dili; panelde okunur, '
      + 'girilmez. θ = kol yönü + 180°.',
      'Türev — girilen kol yönünden'],
    ['Ön yük (Pre-Load)', 'Nm', 'Bilgi sayfasının Tensioner tablosu'],
    ['Yay katsayısı (Rate)', 'Nm/°', 'Aynı tablo'],
    ['Çalışma momenti (Mean Load)', 'Nm', 'Aynı tablo. Kolun montajda ne kadar kurulduğunu '
      + 'söyler: göreli açı = (Mean − Pre) / Rate'],
    ['Kol dönüş yönü (sense)', 'Yaya yüklenme yönü: +1 / −1 / otomatik',
      'Varsayılan <em>Otomatik bul</em>; çekirdek kayışın kısaldığı yönden kendisi bulur'],
    ['Load stop', 'Mekanik durdurucunun göreli açısı, °', 'Raporun Tensioner Data satırı; '
      + 'boş bırakılabilir'],
    ['Kol ataleti', 'kg·m²', 'Burulma modeline girer'],
    ['Kasnak kütlesi', 'kg', 'Burulma modeline girer — <strong>girilmezse birinci mod '
      + 'belirgin şekilde yüksek çıkar</strong>']
  ]);
  h += _gfUyari('Buraya montaj konumu yazılmaz',
      'Gergi kasnağının merkezi ile gövdenin montaj konumu kolun <strong>iki ayrı '
    + 'ucudur</strong>; aralarında tam kol boyu kadar mesafe vardır (14 sistemin 81 '
    + 'konumunda sapma ≤ 0,065 mm). Panelin istediği <strong>merkezdir</strong>; montaj '
    + 'konumu yalnız tedarikçiden <em>dönen</em> raporda bulunur ve modele '
    + '<strong>girmez</strong>, türer.<br><br>'
    + 'İkisi karıştırılırsa model <strong>yine çözülür</strong>: 14 tedarikçi sisteminin '
    + '<strong>14’ü de çözülür</strong>, gerginlik sapması medyan <strong>+%1526</strong> '
    + '(en kötü +%4518) ve <strong>beşinde uyarı çıkmaz</strong>. İki nokta birbiriyle '
    + 'karşılaştırılmaz; denetim §7.1’de.');
  h += _gfSahneGergiMerkez();
  h += _gfSahneGergiKol();
  h += '<h3>7.1 Girilen noktanın denetimi</h3>';
  h += '<p>Girilen koordinatın kasnak merkezi mi gövdenin montaj konumu mu olduğu hesaptan '
    + '<strong>ayırt edilemez</strong> — ikisi de geçerli bir çözüm üretir. Denetim sayısı '
    + '<strong>her durumda yazılır</strong>:</p>';
  h += _gfAdimlar([
    '<strong>Kol künyesi</strong> kartındaki <em>“gövdenin montaj konumu (türedi)”</em> '
      + 'satırına bakın. Bu, girilen merkezden kol boyu ve kol açısıyla türetilen montaj '
      + 'eksenidir.',
    'Tedarikçiden dönen rapor varsa o sayıyı <em>Tensioner Data → Pivot Point '
      + '{X, Y Coordinates}</em> satırıyla karşılaştırın; tutuyorsa girilen nokta merkezdir.',
    'Yalnız tedarikçiye <em>giden</em> bilgi sayfası varsa o sayfanın gergi satırı '
      + '<strong>kasnak merkezidir</strong> — doğrudan panele yazılır.'
  ]);
  h += '<h3>7.2 Kol çalışma açısı — paketleme kararı</h3>';
  h += '<p>Avara merkezi verildikten sonra kayış yolu tamamen belirlidir: teğet noktaları, '
    + 'sarım açıları ve efektif boy kolun saatinden <strong>bağımsızdır</strong> — geometri '
    + 'yalnız kasnak merkezlerinin farklarından kurulur. Kolun mutlak açısını değiştirmek '
    + 'yalnız <em>gövdenin nereye cıvatalandığını</em>, dolayısıyla yalnız β’yı, yani '
    + 'take-up’ı ve gerginliği oynatır.</p>';
  h += '<p>Kol açısı bir <strong>paketleme</strong> kararıdır ve kayış fiziğinden '
    + 'çıkarılamaz.</p>';
  h += _gfNot('Kol açısının varsayılanı yok',
      'Kol çalışma açısı girilmemişse model <strong>çözülmez</strong> ve sebebini adıyla '
    + 'yazar.');
  h += '<h3>7.2.1 Olanaklı bant ve T(θ) eğrisi</h3>';
  h += '<p>Avara hareketi kartı iki okuma verir; ikisi de <strong>modelin kendi '
    + 'verisinden</strong> hesaplanır, tedarikçi raporlarından türetilmiş sabit taşımaz:</p>';
  h += _gfAlanTablo('Avara hareketi kartının bant okuması', [
    ['<strong>Kol açısı olanaklı bantta</strong>', 'Girilen açının fiziksel olarak '
      + 'kullanılabilirliği: kol kayışın servis aralığının iki ucuna da (Değiştirme ↔ Min) '
      + 'ulaşabiliyor mu', 'Kullanılamıyorsa <strong>sebebi yazılır</strong>'],
    ['Kullanılabilir yay', 'Bandın 360°’nin kaçında açık olduğu', 'Tipik olarak ~190°'],
    ['<strong>T(θ) eğrisi</strong>', 'Her montaj saatinde çıkan gerginlik; girilen açı '
      + 'amber çizgiyle işaretli, kullanılamaz açılar kırmızı taralı',
      'Arşivdeki sistemlerde ±20°’de <strong>%47…101</strong> değişir']
  ], ['Satır', 'Ne gösterir', 'Not']);
  h += _gfUyari('Bant olanaksızı dışlar, açıyı seçmez',
      'Bant hangi açıların <strong>olanaksız</strong> olduğunu söyler, hangisinin doğru '
    + 'olduğunu söylemez: 14 tedarikçi sisteminin gerçek çalışma açısı bandın içindedir '
    + '(<strong>14/14</strong>), bant ise <strong>96…218°</strong> geniştir (medyan 189°). '
    + 'Doğru açı motor bloğunun paketlemesinden gelir — cıvata deseni, gövde gabarisi, komşu '
    + 'parçalar. T(θ) eğrisi seçimin gerginlik <em>bedelini</em> gösterir.');
  h += '<h3>7.3 Avara hareketi kartı</h3>';
  h += _gfSahneGergiHareket();
  h += _gfAlanTablo('Avara hareketi kartının okuması', [
    ['Yay kurulması', '(M<sub>çalışma</sub> − M<sub>ön</sub>) / k — kolun bağıl dönmesi',
      'Salt yay künyesinden; geometriye hiç bakmaz'],
    ['Kol yönü — girdi (merkez→gövde)', 'Panele yazılan sayı',
      'Bir <strong>girdi</strong>'],
    ['θ<sub>kol</sub> — mutlak (gövde→merkez)', 'Aynı yön, ters uçtan: +180°',
      'Türev — parça çiziminin dili'],
    ['gövdenin montaj konumu (türedi)', 'Merkezden kol boyu kadar geride, çalışma açısında',
      '<strong>Türeyen</strong> — atölyeye giden sayı; §7.1’in denetim sayısı'],
    ['Serbest kol açısı (türedi)', 'θ<sub>çalışma</sub> − sense × yay kurulması',
      'Çekirdeğe giren açı'],
    ['Gereken kayış boyu (çıktı)', 'Bu yerleşim için ısmarlanması gereken efektif boy',
      'Bölüm 8’de katalogla eşleştirilir'],
    ['Tasarım gerginliği (türedi)', 'Yay dengesinden türeyen ankraj gerginliği',
      'Bütün gerilme zinciri bu değerden kurulur'],
    ['Konum pimi', 'Kol açısının imalat karşılığı: pim deliğinin yarıçapı ve açısı',
      'Yalnız parça çizimi olan künyelerde; yoksa sebebi yazılır'],
    ['Kol açısı olanaklı bantta', 'Girilen açının fiziksel olarak kullanılabilirliği',
      '§7.2.1 — kullanılamıyorsa sebebiyle'],
    ['T(θ) eğrisi', 'Her montaj saatinin gerginlik bedeli', '§7.2.1']
  ], ['Satır', 'Ne gösterir', 'Not']);
  return h;
}

function _gfSec8(){
  var h = _gfH2(7);
  h += '<p>Kayış Yolu çiziminde <strong>kayışa tıklayın</strong> (ya da Kayış Tablosu başlığındaki '
    + 'kayış künyesine): <strong>Kayış Özellikleri</strong> penceresi açılır. Kayışın kanvasta '
    + 'kutusu yoktur; modelde tek kayış bulunur ve silinmez.</p>';
  h += _gfAdimlar([
    '<strong>Profil ve marka</strong> kartında kayış profilini seçin (PK · PJ · PH · PL · PM) '
      + 've markayı işaretleyin. Bu seçim kapatılamaz: pitch yarıçapı '
      + '<em>OD/2 + h<sub>b</sub></em> olduğu için teğet geometrisi profil sabitine dayanır.',
    '<strong>Künye</strong> kartına kanal (kaburga) sayısını girin. Gergi avara '
      + 'merkezinden çözülüyorsa <strong>efektif boy alanı yoktur</strong> — yerine '
      + 'türetilen boyun okuması durur.',
    '<strong>Katalog</strong> kartı gereken boya en yakın stok ve ızgara boylarını, her biri '
      + 'için kolun oturacağı açı ve çıkacak gerginlikle birlikte listeler.',
    'Bir satıra tıklayarak o boyu seçin. Kip <strong>sabit</strong>e döner ve model artık o '
      + 'kayışla çözülür.'
  ]);
  h += _gfSahneKayisKunye();
  h += _gfSahneKayisKatalog();
  h += '<h3>8.1 Kayış boyu kipi</h3>';
  h += _gfAlanTablo('İki kip, iki soru', [
    ['Serbest', 'Kayış boyu bir <strong>çıktıdır</strong>; kol nominal yay açısına oturur',
      '“Bu düzen için hangi kayışı ısmarlamalıyım?”'],
    ['Sabit', 'Girilen boy kullanılır; kol o boya oturan açıya gider, gerginlik oradan çıkar',
      '“Elimdeki bu kayış bu düzene uyar mı?”']
  ], ['Kip', 'Ne yapar', 'Hangi soruya cevap verir']);
  h += _gfNot('Kayış kipi kilitlidir',
      'Gergi avara merkezinden çözülüyorsa kayış boyu <strong>yapısal olarak</strong> bir '
    + 'sonuçtur ve seçilemez. Panel bunu “Serbest (kilitli)” diye yazar, Kayış Tablosu '
    + 'başlığındaki anahtar da tıklamayı reddeder.');
  h += '<h3>8.2 Katalog bir kısıt değil, bir öneridir</h3>';
  h += '<p>Katalog iki ayrı küme gösterir ve bunları karıştırmaz:</p>';
  h += _gfAlanTablo('Katalog kümeleri', [
    ['Stok boyları', 'ISO 9982 / DIN 7867 endüstriyel boylar', 'İşaretsiz satırlar'],
    ['Otomotiv ızgarası', '5 mm adımlı üretim pratiği', '<strong>◇</strong> ile işaretli']
  ], ['Küme', 'Nedir', 'Listede nasıl görünür']);
  h += '<p>Stok listesinde boşluklar vardır: bir aracın kendi kayışı (<code>8PK 1715</code>) '
    + 'endüstriyel stok listesinde <strong>yoktur</strong> — komşuları 1690 ve 1755. Ara boy '
    + 'ısmarlanabilir; boy elle de girilebilir.</p>';
  h += '<p>Sığmayan aday bir sayı basmaz, <strong>“sığmıyor”</strong> yazar: kolun sınıra '
    + 'kenetlendiği noktada gerginlik matematiksel olarak tekilleşir ve oradan okunan sayı '
    + 'fiziksel değildir.</p>';
  h += '<h3>8.3 Malzeme kartı — kaburga başına kütle</h3>';
  h += '<p>Aynı panelde <strong>opsiyonel</strong> bir Malzeme kartı vardır ve tek alan '
    + 'ister: <em>kaburga başına kütle</em> (kg/m). Yalnız <strong>açıklık '
    + 'frekansı</strong> hesabına girer — gerilmelere, ömre ve hubload’a dokunmaz.</p>';
  h += _gfNot('Frekans önemliyse elle girin',
      'Boş bırakılırsa katalog değeri kullanılır, ama iki kaynak ayrışıyor: Gates PK kataloğu '
    + 'kaburga başına <strong>0,0144 kg/m</strong> derken, hem kesit tahmini hem de ölçülmüş '
    + 'frekans haritasından geri-hesap <strong>0,0196 kg/m</strong> veriyor. Açıklık '
    + 'rezonansı ve çırpınma hükmü için ölçülmüş değeri elle girin.');
  h += '<h3>8.4 Kayış tipine bağlı çıktılar anahtarı</h3>';
  h += '<p>Aynı panelde bir anahtar daha vardır ve varsayılan olarak '
    + '<strong>kapalıdır</strong>. Kapalıyken şu çıktılar <strong>üretilmez</strong>:</p>';
  // Liste köprünün kendisinden: çözümün `beltDataOff`u ile aynı satırlar.
  h += '<ul>' + ((typeof VE_FEAD_BELT_DATA_OFF !== 'undefined') ? VE_FEAD_BELT_DATA_OFF : [])
    .map(function(ad){ return '<li>' + _gfE(ad) + '</li>'; }).join('') + '</ul>';
  h += '<p>Hepsi kayış katalogundan gelen sabitlere dayanır (efektif boy, birim kütle, kord '
    + 'rijitliği, yorulma sabitleri, tolerans ve aşınma payı); kayış seçildikten sonra anahtarı '
    + '<strong>Açık</strong>a alın. Panel kapalı çıktıları listeler.</p>';
  h += '<h3>8.5 Kayış numarası hangi çizgide — d<sub>b</sub> ve d<sub>w</sub></h3>';
  h += '<p>Kayış numarası (8PK<strong>1410</strong>’daki 1410) kanallı kasnağın dış çapındaki '
    + '<strong>d<sub>b</sub></strong> çizgisinde ölçülen boydur: ISO 9981’in efektif boyu, '
    + 'ContiTech tablosunun <em>L<sub>b</sub></em>’si. Kayışın kordu bu çizginin '
    + '<em>h<sub>b</sub></em> dışında, <strong>d<sub>w</sub> = d<sub>b</sub> + 2·h<sub>b</sub></strong> '
    + 'çizgisinde durur ve CAD eskizi çoğunlukla onu ölçer. Kapalı bir çevrimde iki boyun farkı '
    + 'yerleşimden bağımsız olarak <strong>2π·h<sub>b</sub></strong>’dir: PK ContiTech '
    + '(h<sub>b</sub> = 1,5 mm) için 9,42 mm, PK Gates (1,2 mm) için 7,54 mm.</p>';
  h += _gfSahneKart2('getFeadBeltPropertiesHTML', 'Boy çizgileri',
    'Kayış Özellikleri → <b>Boy çizgileri</b>. Kesit ölçeklidir ve profilin kendi sabitlerinden '
    + 'çizilir; altındaki iki satır aynı kayışın numarasını ve kord boyunu yazar.');
  h += _gfAlanTablo('İki boy nerede okunur', [
    ['Kayış Özellikleri → <em>Boy çizgileri</em>', 'Kesit figürü · Kayış numarası · Kord boyu',
      'Numara çözüme yazılan boy: sabit kipte girilen, kilitli kipte türetilen'],
    ['Kayış Özellikleri → sağ sütun', 'Kayış numarası · Kord boyu · Boy kaynağı', 'Aynı okuma'],
    ['Kayış Yolu kartı — sağ üst rozet', 'L … mm · kord … mm', 'Çizilen kol konumunun geometrisi'],
    ['Rapor §8.2', 'Efektif boy (d<sub>b</sub>) · Kord boyu (d<sub>w</sub>) · kesit figürü',
      'Numara d<sub>b</sub>’de kalır; kord yalnız karşılığıdır']
  ], ['Nerede', 'Ne yazar', 'Not']);
  h += _gfNot('CAD’deki boy numara değildir',
      'Eskizin kord çizgisinde ölçtüğü boy numara sayılırsa kayış 2π·h<sub>b</sub> uzun seçilir ve '
    + 'gergi kolu başka bir açıya oturur. Kayış Tablosu’ndaki <em>Efektif Çap</em> sütunu da '
    + 'kasnağın <strong>d<sub>w</sub></strong> çapıdır (defterin adı, OD + 2·h<sub>b</sub>); '
    + '<em>efektif boy</em> ise d<sub>b</sub> çizgisindedir — adları benzer, çizgileri farklı.');

  h += '<h3>8.6 Hesap çapı — kayış yolu hangi çizgide kurulur</h3>';
  h += '<p>Kasnağa girilen çap <strong>d<sub>b</sub></strong>’dir: kaburgalı kasnakta kaburga '
    + 'tepesi (dış çap). Kayış yolu, hız oranları ve kuvvetler bu çapta değil, kayışın '
    + '<strong>kord çizgisinde</strong> kurulur: kaburgalı kasnakta d<sub>b</sub> + 2·h<sub>b</sub>, '
    + 'sırttan dolanan kasnakta dış çap + 2·h<sub>r</sub>. Krank Ø147 ise hesap Ø150,0 ile yapılır '
    + '(ContiTech, h<sub>b</sub> = 1,5) — Gates kataloğuyla Ø149,4.</p>';
  h += '<p><strong>Hesap çapı</strong> seçimi h<sub>b</sub> ile h<sub>r</sub>’nin nereden geldiğini '
    + 'belirler. Kayışın kord çizgisi tek olduğu için seçim de <strong>kayış için tektir</strong>: '
    + 'bütün kasnaklara birlikte uygulanır.</p>';
  h += _gfAlanTablo('Hesap çapı seçenekleri', [
    ['Kord (d<sub>w</sub>) · marka kataloğu', 'Seçilen markanın h<sub>b</sub> / h<sub>r</sub>’si',
      'Varsayılan; örnekler ve elle kurulan modeller'],
    ['Kord (d<sub>w</sub>) · CAD eskizi', 'STEP dosyasındaki kayış eskizinden ölçülen h<sub>b</sub> / h<sub>r</sub>',
      'Yalnız eskiz okunduysa sunulur; model CAD’le aynı çizgide kurulur'],
    ['Kasnak dış çapı (d<sub>b</sub>)', 'h<sub>b</sub> = h<sub>r</sub> = 0',
      'Kayış kalınlığı yok sayılır; kord boyu numarayla aynı çıkar']
  ], ['Seçenek', 'Kord ofseti', 'Ne zaman']);
  h += _gfNot('Nerede seçilir',
      'Kayış Özellikleri → <b>Profil ve marka</b> → <em>Hesap çapı</em>; sihirbazda Kayış adımı; '
    + 'STEP’ten kurarken 3B görüntüleyicide kayışa tıklayınca kesit şekliyle birlikte (§3.5). '
    + 'Seçilen çift aynı bölümün ipucunda katalogla yan yana yazılır. Rapor §8.2 hesap çapını ve '
    + 'h<sub>b</sub> / h<sub>r</sub>’nin kaynağını basar; kesit figüründe hesabın çizgisi dolu ve kalındır.');

  h += '<h3>8.7 Servis faktörü c<sub>2</sub> — kayma tasarım yükünde</h3>';
  h += '<p>Kayış Özellikleri → <b>Servis faktörü c<sub>2</sub></b> bölümünde (sihirbazda Kayış adımında) yük katsayısı '
    + 'tablosundan bir hücre seçilir. Seçilen <strong>c<sub>2</sub></strong> aksesuar güçlerini '
    + '<strong>tasarım gücüne</strong> çevirir: P<sub>B</sub> = c<sub>2</sub>·P. Gerilme zinciri gergide '
    + 'ankrajlı olduğu için tasarım yükündeki açıklık gerginlikleri '
    + 'T<sub>B</sub> = T<sub>0</sub> + c<sub>2</sub>·(T − T<sub>0</sub>) olur (T<sub>0</sub> gerginin '
    + 'çıkış gerginliği). Kayma emniyeti bu gerginliklerle hesaplanır ve hüküm '
    + '<strong>SF ≥ 1</strong>’dir.</p>';
  if(typeof VE_FEAD_SERVIS !== 'undefined'){
    var _T = VE_FEAD_SERVIS, _bas = ['Yük sınıfı'], _hiz = ['l'];
    _T.surucu.forEach(function(sr){
      _T.saat.forEach(function(q){ _bas.push(sr.ad + ' · ' + q.ad + ' sa'); _hiz.push(''); });
    });
    h += _gfTablo('Yük katsayısı c₂ — satır tahrik edilen makine, sütun sürücü ve günlük çalışma',
      _bas, _T.yuk.map(function(y){
        var r = ['<strong>' + _gfE(y.ad) + '</strong> — ' + _gfE(y.ornek)];
        _T.surucu.forEach(function(sr){
          y.deger[sr.k].forEach(function(v){ r.push(_gfF(v, 1)); });
        });
        return r;
      }), _hiz);
  }
  h += _gfNot('Araç motoru hangi sütun grubunda',
      'ISO/DIN V-kayış hesabında <strong>600 d/dk üstünde</strong> çalışan içten yanmalı motor ve '
    + 'türbin <em>normal kalkış</em> grubundadır; 600 d/dk ve altındaki <em>yüksek kalkış</em> '
    + 'grubunda. Tablo ContiTech tasarım programının c<sub>2</sub> tablosudur; programın '
    + 'İngilizce ekranında iki grup da <em>n up to 600 rpm</em> yazıyor — birincisindeki çeviri hatası.');
  h += _gfNot('Neye girer, neye girmez',
      'c<sub>2</sub> yalnız <strong>kaymayı</strong> sınar. Gerilme, hubload, ömür ve açıklık '
    + 'frekansları gerçek yükte kalır: kayışın gerçekte gördüğü sayılardır ve tedarikçi '
    + 'raporlarıyla satır satır karşılaştırılır. Kayma eşiği (N cinsinden en düşük ankraj) '
    + 'tasarım yükündedir, yani tam c<sub>2</sub> katıdır. Seçim yapılmazsa '
    + 'c<sub>2</sub> = 1’dir — tasarım yükü gerçek yüktür — ve pencere bunu <em>Seçilmedi</em> '
    + 'diye yazar. Eski projelerden gelen, tablodan seçilmemiş bir sayı “kayıtlı değer” olarak '
    + 'kullanılır.');

  h += '<h3>8.8 Sürtünme katsayısı μ — kaymanın varsayımı</h3>';
  h += '<p>Hemen altındaki <b>Sürtünme katsayısı μ</b> bölümünde (sihirbazda kayış adımında) kayma emniyetine giren <strong>sürtünme</strong> '
    + 'seçilir. μ bir malzeme sabiti değil, Euler–Eytelwein bağıntısına giren <em>etkin</em> '
    + 'sürtünmedir; kaynaklar ayrı sayı verir. Varsayılan <strong>Gates kalibrasyonu</strong>dur; '
    + '<em>Elle</em> seçilince alanlar o an geçerli değerlerle dolar ve değiştirilebilir.</p>';
  if(typeof VE_FEAD_SURTUNME !== 'undefined'){
    h += _gfTablo('Sürtünme seçenekleri', ['Seçenek', 'Oluklu μ', 'Sırt μ', 'Küçük kasnak kaybı', 'Kaynak'],
      VE_FEAD_SURTUNME.secenek.map(function(o){
        var bos = (o.k === 'elle');
        var v = (!bos && typeof veFeadSurtunme === 'function') ? veFeadSurtunme({ surtunme: o.k }) : o;
        return ['<strong>' + _gfE(o.ad) + '</strong>',
          bos ? '—' : _gfF(v.muOluk, 2), bos ? '—' : _gfF(v.muSirt, 2),
          bos ? '—' : (v.kayipMm > 0 ? _gfF(v.kayipMm, 0) + ' mm' : 'yok'), _gfE(o.kaynak)];
      }), ['l', '', '', '', 'l']);
  }
  h += _gfNot('Kayma nasıl aranır',
      'Emniyet faktörü kasnağın taşıyabileceği etkin gerginliğin istenene bölümüdür: '
    + 'SF = T<sub>gevşek</sub>·(e<sup>μφ</sup> − 1) ⁄ (T<sub>gergin</sub> − T<sub>gevşek</sub>). '
    + '1 kayma eşiğidir, üstünde torkla doğrusal okunur: 2, kasnağın istenenin iki katı torku '
    + 'iletebileceğini söyler. Her devirde <strong>en kötü koşul</strong> aranır: ivmelenme, sabit '
    + 'devir ve yavaşlama (aksesuar ataletiyle), her aksesuar tepe gücünün %10’u ya da %100’ü, avara '
    + 've gergide 0,01 kW yatak sürtünmesi. Tepe güç aksesuarın kendi eğrisinden ya da katalogdan '
    + 'gelir; ikisi de yoksa çevrimin kayıtlı yükü %100 sayılır ve rapor bunu yazar. İvme ve '
    + 'yavaşlama sürücünün <em>Motor</em> bölümündedir; girilmezse atalet talebi kaymaya katılmaz.');
  h += _gfNot('Küçük kasnak kaybı',
      'Kayış kasnağa girerken ve çıkarken bükülmeye direnir; temas her uçta ℓ kadar kısalır: '
    + 'φ<sub>etkin</sub> = φ − 2ℓ ⁄ r<sub>p</sub>. Yalnız oluklu temasa uygulanır. Kayıp hesaba '
    + 'katılmazsa Gates’in Ø57–61 alternatörlerinde pay 1,5–1,8 kat iyimser çıkar. Ø61–120 arasında Gates '
    + 'verisi yok; kasnak o aralıktaysa rapor bunu yazar.');
  return h;
}

function _gfSec9(){
  var h = _gfH2(8);
  h += '<p><strong>Sürücü kasnağın</strong> penceresini açın — çoğunlukla krank kasnağı; '
    + 'ikincil tahrikte FEAD’i çeviren fan kasnağı. Çizimde kasnağa ya da Kayış Tablosu’nda '
    + 'sürücü satırının adına tıklayın. Pencere öteki kasnaklarınki gibi geometri ve rolle '
    + 'başlar; sürücüde altında iki grup daha vardır: <strong>Motor</strong> (motor, devir '
    + 'sınırları, güç eğrisi, FEAD tahriki) ve <strong>Çalışma çevrimi</strong> — hepsi tek '
    + 'gövdede, alt alta. <strong>Çözücü</strong> penceresi yalnız yöntemleri, modeli ve sonucu '
    + 'gösterir (Bölüm 10).</p>';
  h += _gfNot('Veri kasnakta değil, modelde saklanır',
      'Sürücülük bir <strong>roldür</strong>: işaret başka bir kasnağa verilince bu iki grup o '
    + 'kasnağın penceresine geçer. Motor ve çevrim kasnağa bağlı saklanmaz — sürücü kasnağı '
    + 'silmek ya da değiştirmek çalışma çevrimini <strong>silmez</strong>.');
  h += _gfSahneMotor();
  h += '<h3>9.1 FEAD tahriki — krank ile sürücü kasnak arasındaki oran</h3>';
  h += '<p>FEAD kayışının sürücü kasnağı krank milinde olmak zorunda değildir: yaygın bir '
    + 'düzende krank ayrı bir kademeyle fan kasnağını döndürür, FEAD kayışı da onun üzerinden '
    + 'tahrik edilir.</p>';
  h += '<p>Üç düzen vardır; Başlangıç Sihirbazı da <strong>bu üçünü, aynı adlarla</strong> '
    + 'sorar:</p>';
  h += _gfAlanTablo('FEAD tahrik düzenleri', [
    ['Krank kasnağı doğrudan FEAD’i tahrik ediyor (1:1)', 'Kademe yok',
      'Krank kasnağının kendisi sürücü kasnak. Oran tanımı gereği <strong>1</strong>; '
      + 'çapı zaten Kayış Tablosu’nun sürücü satırında'],
    ['Kranka bağlı ayrı bir sürücü kasnak — aynı devir (1:1)', 'Kademe yok, çap ayrı',
      'Sürücü kasnak krankla <strong>aynı milde ve aynı devirde</strong> dönüyor. Oran '
      + 'yine <strong>1</strong>; krank kasnağının kendi çapı bir <em>motor verisi</em> '
      + 'olarak sorulur ve rapora girer'],
    ['Ara kademe — krank ve sürücü kasnak farklı devirde', 'Ayrı kademe var',
      'Krank ayrı bir kayış/dişli kademesiyle bir kasnağı döndürüyor ve FEAD kayışı '
      + 'onun üzerinde. İki çapı yazın; oran = krank Ø / sürülen Ø']
  ]);
  h += _gfNot('Oran çaplardan türer',
      'Tahrik oranı yalnız <strong>çaplardan</strong> türer; elle oran girilmez. Elle oran '
    + 'kipinde kurulmuş <em>eski bir model</em> açılınca panel oranı bir kez daha gösterir ve '
    + '“eski kayıt” diye işaretler; düzen değişince satır kalkar.');
  h += _gfAdimlar([
    'Düzene uyan seçeneği seçin.',
    'Kartın altındaki “Kullanılan tahrik oranı” satırından hem sayıyı hem de hangi düzenden '
      + 'geldiğini okuyun. Satır <strong>“çözülemedi — çap eksik”</strong> diyorsa ara kademe '
      + 'seçilmiş ama iki çaptan biri boştur; o hâlde oran 1 alınır ve girilen çap '
      + 'kullanılmaz.'
  ]);
  h += _gfUyari('Bu oran bütün sonuçları ölçekler',
      'Aksesuar devri = motor devri × <strong>tahrik oranı</strong> × (sürücü kasnak pitch '
    + 'çapı / aksesuar pitch çapı). Yanlış seçilirse bütün güç ve gerilme sonuçları aynı '
    + 'oranda kayar ve uyarı çıkmaz: tek kademeli bir sistemde 1,430’luk bir oran aksesuar '
    + 'devirlerini %43 kaydırır, kayış hızı 17,5 yerine 25,0 m/s çıkar.');
  h += '<h3>9.2 Motor ve devir sınırları</h3>';
  h += '<p><em>Motor</em> bölümünün en üstünde <strong>BMC motor kataloğu</strong> seçicisi durur: '
    + '<strong>yirmi dört motor</strong>, BMC’nin kendi FEAD hesap defterinin '
    + '<em>Motor bilgileri</em> sayfasından. Bir kayıt seçmek <strong>silindir sayısını, '
    + 'devir sınırlarını ve birinci kademe çaplarını</strong> yazar; kasnak koordinatlarına ve '
    + 'kayışa <strong>dokunmaz</strong>. Devir sınırları ve güç eğrisi seçicinin hemen '
    + 'altındadır. Aksesuarlarda <em>Devir sınırları</em> ve <em>Güç eğrisi</em> aksesuarın '
    + 'kendisininkini taşır. Tahrik düzeni açıkça seçildiyse (örneğin doğrudan tahrik) motor '
    + 'kaydı onu <strong>ezmez</strong>.</p>';
  h += _gfUyari('Silindir sayısı, rölanti ve governed zorunludur',
      'İşletme hesabı — çevrim boyunca gerilme, hubload, kayma emniyeti, ömür, geçici rejim '
    + 'senaryosu — bu üç alan olmadan <strong>yapılmaz</strong>: <strong>Hesapla</strong> pasif '
    + 'kalır ve pencere eksiği adıyla yazar. Kayış yolu, sarım, kayış boyu ve gergi statiği '
    + 'motordan bağımsızdır ve her zaman çözülür. Gates örnekleri motorun devir sınırlarını '
    + 'taşımaz (raporlarında yok) — örnekle başlanınca motoru katalogdan seçin ya da alanları '
    + 'girin. Bu kılavuzun sahnelerindeki örnekte devir '
    + 'sınırları katalogdaki <strong>ISL8.9E3 375</strong> kaydından alındı.');
  h += _gfAlanTablo('Sürücünün üç devir sınırı', [
    ['Rölanti', 'Motorun boştaki devri',
      'Çalışma çevriminin alt ucu; geçici rejim senaryosunun başlangıcı. <strong>Zorunlu</strong>'],
    ['Governed', 'Yük altındaki azami devir',
      'Aksesuar <strong>çevrim oranı penceresi</strong> kriteri bu devirde değerlendirilir '
      + '(Bölüm 11.4). <strong>Zorunlu</strong>'],
    ['Overspeed', 'Anlık aşım devri',
      'Aksesuar <strong>anlık maksimum</strong> kriteri bu devirde değerlendirilir; boşsa o '
      + 'kriter “değerlendirilemedi” der, “uygun” demez']
  ], ['Sınır', 'Nedir', 'Nereye girer']);
  h += _gfNot('“No load governed” hesaba girmez',
      'Katalogda durur ve künye seçilince modele yazılır; onu <em>okuyan</em> hesap, '
    + 'uygunluk kriteri ya da rapor satırı yok.');
  h += _gfNot('Katalogdan sapma',
      'Seçimden sonra elle değiştirilen alanı kart <strong>yazar</strong>: “Katalogdan sapıldı: '
    + '…”. Sapma hata değildir — kayıt varyanta göre değişebilir —; <strong>yazım hatası da '
    + 'burada görünür</strong>. Alanlar kayıtla birebirse kart onu da yazar.');
  h += _gfAlanTablo('Motor bölümü — kalan alanlar', [
    ['Silindir sayısı', 'Adet', 'Ateşleme frekansını verir (dört zamanlıda '
      + 'f = devir/60 × silindir/2); açıklık rezonans kontrolünde kullanılır'],
    ['İvmelenme', 'RPM/s', 'Tepe yük taramasına ve senaryo rampasına girer'],
    ['Yavaşlama', 'RPM/s', 'Aynı taramanın diğer dalı']
  ]);
  h += _gfNot('Krank mili ataleti',
      'Burulma titreşimi modelinin krank serbestliği kasnağın değil <strong>krank milinin</strong> '
    + 'ataletini ister. Sürücünün <em>Rol</em> bölümündeki atalet alanı budur ve değeriyle '
    + 'yazılıdır: boşken Gates arşivinin medyanı (0,50 kg·m²), yanındaki <strong>i</strong> '
    + 'kaynağını söyler.');
  h += '<h3>9.3 Güç eğrisi — motorun tam yük eğrisi</h3>';
  h += '<p>Motor bölümünün altındaki <em>Güç eğrisi</em> kartı seçilen motorun <strong>tam yük tork ve güç '
    + 'eğrisini</strong> katalogdan, salt okunur gösterir. Aynı eğri geçici rejim senaryosunun '
    + 'rampa şeklini verir. Altındaki tablo çalışma çevriminin her satırında aksesuarların '
    + 'toplam gücünü motorun o devirdeki tam yük gücüyle kıyaslar — FEAD’in motor gücündeki '
    + '<strong>payı</strong>. Pay %100’ü aşarsa kart bunu kırmızıyla yazar: çevrimdeki kW '
    + 'değerleri ya da motor seçimi tutarsızdır.</p>';
  h += '<h3>9.4 Çalışma çevrimi tablosu</h3>';
  h += '<p>Sürücünün <em>Çalışma çevrimi</em> bölümü. Tablonun üstünde bir <strong>Çevrim kaydı</strong> seçicisi vardır: '
    + '<strong>yedi ölçülmüş çalışma çevrimi</strong> — altısı Gates arşivinden, biri BMC '
    + 'tedarikçi sayfasından. Bir kayıt seçmek devir · %zaman · sıcaklık satırlarını bir anda '
    + 'doldurur; sihirbazdaki kart da <strong>aynı kütüphaneyi</strong> kullanır ve orada '
    + 'seçilen çevrim burada aynı adla durur.</p>';
  h += _gfUyari('Tek bir standart çevrim yoktur',
      'Arşivde <strong>altı ayrı desen</strong> vardır ve aralarında gerçek farklar bulunur: '
    + 'rölantide geçirilen zaman, tepe devrin ağırlığı, sıcaklık dağılımı. Kütüphanenin '
    + 'kayıtları <strong>ölçülmüş alternatiflerdir</strong>; aracın kendi çevrimi varsa o '
    + 'girilir, kütüphane veri yokken bir mertebe verir.');
  h += _gfNot('“— özel (elle düzenlendi) —” bir seçenek değil, bir okuma',
      'Elle düzenlenen tablo hiçbir kayda uymaz ve seçici bunu <strong>yazar</strong>: '
    + 'seçicideki yazı tablonun o anki içeriğinin karşılığıdır.');
  h += _gfSahneCevrim();
  h += _gfAdimlar([
    'Hazır bir çevrimle başlamak için <strong>Çevrim kaydı</strong> seçicisinden birini '
      + 'seçin; kendi çevrim aşağıdaki adımlarla girilir.',
    '<strong>+ Devir satırı</strong> düğmesiyle bir devir noktası ekleyin.',
    'Satıra <strong>devir</strong>, o devirde geçirilen <strong>%zaman</strong> ve kayış '
      + '<strong>sıcaklığını</strong> yazın.',
    'Aksesuar sütunlarına o devirdeki <strong>kW</strong> değerlerini girin. Boş bırakılan '
      + 'hücre, o aksesuarda model ya da güç eğrisi varsa eğriden dolar; yoksa '
      + '<strong>Hesapla pasif kalır</strong> ve pencere o aksesuarı adıyla yazar — gücü '
      + 'bilinmeyen bir aksesuar sıfır kW sayılmaz.',
    'Bütün devir noktalarını girdikten sonra <strong>%zaman toplamının 100</strong> olduğunu '
      + 'doğrulayın.'
  ]);
  h += _gfNot('Sürücü sütunu yoktur',
      'Sürücü kasnağın gücü öteki kasnakların <strong>toplamıdır</strong>. %zaman toplamı 100 '
    + 'değilse dağılım yüzdeleri etkilenmez, mutlak ömür ölçeklenir; panel bunu uyarır.');
  h += _gfNot('Sıcaklık satır başına girilir, tek sayıya indirgenir',
      'Ömür hesabı sıcaklığı tek bir eşdeğer değer olarak ister; satırlar aritmetik ortalamayla '
    + 'değil <strong>hasar-eşdeğer</strong> olarak indirgenir ve yüksek sıcaklıklı satırlar '
    + 'ağırlıklarını alır. Tek sıcaklıklı bir tabloda iki yöntem aynı sonucu verir; dağılmış '
    + 'bir tabloda aritmetik ortalama ömrü <strong>uzun</strong> gösterir.');
  return h;
}

function _gfSec10(){
  var h = _gfH2(9);
  h += '<p>Geometri sonuçları <strong>Hesapla’ya basmadan</strong> hazırdır. Kayış Yolu kartı, '
    + 'gergi panelindeki avara hareketi okuması ve gergi konum tablosu çalışma çevrimi '
    + 'gerektirmez — '
    + 'geometriden ve yay dengesinden gelirler.</p>';
  h += '<p><strong>FEAD araçları</strong> penceresinin <em>Çözüm</em> bölümündeki <strong>Ayarlar</strong> '
    + 'bağlantısı <strong>Çözücü</strong> penceresini açar. Pencere girdi sormaz; bölümleri '
    + 'alt alta: <strong>Çözüm zinciri</strong> (çözümün aşamaları ve sayısal yöntemleri), '
    + '<strong>Algılanan model</strong> (çözücünün modeli nasıl okuduğu), üç uygunluk hükmü '
    + '(11.4) ve <strong>Sonuç</strong>.</p>';
  h += _gfSahneYontem();
  h += _gfSahneAlgilanan();
  h += _gfAdimlar([
    'Çözücü penceresinin <strong>Algılanan model</strong> tablosuna bakın: kasnak sayısı, sürücü, '
      + 'gergi, kayış künyesi, temas tarafı dağılımı, tahrik oranı, türetilen tasarım '
      + 'gerginliği ve “Geometri: çözüldü” satırı.',
    'Bir satır sarı ise o eksiği giderin. “Geometri: çözülemedi” yazıyorsa altındaki sebep '
      + 'kutusunu okuyun.',
    'Model tamamsa, en az bir devir noktası, <strong>motor künyesi</strong> (silindir · '
      + 'rölanti · governed) ve <strong>her aksesuarın gücü</strong> girildiyse FEAD araçları '
      + 'penceresindeki <strong>Hesapla</strong> etkinleşir; pasifken altında sebebi yazar. Basın '
      + '(Çözücü penceresinin sağ sütunundaki düğme de aynı işi yapar).',
    'Çözüm bölümünün durumu <strong>Güncel</strong> olur ve dört özet kartı belirir: kayma '
      + 'emniyeti, gergi tarafı, ankraj ve burulma. Bir hata varsa sebep aynı yerde yazılır.'
  ]);
  h += _gfNot('Çözülmeyen model de çizilir — sembolik olarak',
      'Model henüz çözülemiyorsa (gergi yay verisi yok, bir çap eksik, kayış yolu kapanmıyor) '
    + 'Kayış Yolu kartı <strong>boş kalmaz</strong>: yalnız <em>girdileri</em> çizer — '
    + 'kasnak girdiği konumda ve dış çapıyla, sıra merkezden merkeze <strong>kesikli</strong> '
    + 'çizgiyle, gergi kolu montaj noktasına. Kayış yolunun kendisi '
    + '<strong>uydurulmaz</strong>: teğet noktaları ve sarım yayları bir çözüm sonucudur, '
    + 'çözüm yoksa çizilmez. Kartın sol üstündeki şerit eksiklerin ilkini ve kaç tane daha '
    + 'olduğunu yazar; tamamı şeridin ipucunda. <strong>Konumu girilmemiş</strong> kasnak '
    + 'çizimin altındaki “konum yok” rafında durur; oradan yerine sürüklenir.');
  h += _gfNot('Sihirbazın “Modeli kur”u çözüm istemez',
      'Sihirbazdan model kurmak için çözümün başarılı olması gerekmez; tek koşul '
    + '<strong>yapısaldır</strong> (kasnak var mı). Gerginin eksik çapı ya da kol boyu kurulumu '
    + 'engellemez, adıyla <em>not</em> edilir; eksik kurulumdan sonra kartın üstünde görünür.');
  h += _gfAlanTablo('“Hesapla” pasifse', [
    ['Model veya çevrim eksik', 'Geometri çözülmedi ya da hiç devir noktası yok',
      'Algılanan model tablosundaki sarı satırı giderin; çalışma çevrimine en az bir satır '
      + 'ekleyin'],
    ['Motor künyesi eksik', 'Silindir sayısı, rölanti ya da governed girilmedi',
      'Sürücü kasnağın <em>Motor</em> bölümünde motoru katalogdan seçin ya da alanları elle '
      + 'girin (Bölüm 9.2)'],
    ['Aksesuar gücü yok', 'Bir aksesuarın ne kayıtlı kW’ı ne kendi eğrisi ne katalog modeli var',
      'Aksesuarın <em>Katalog modeli</em> bölümünden model seçin ya da <em>Çalışma çevrimi</em> tablosuna o '
      + 'devirlerdeki kW’ı girin'],
    ['Tahrik oranı çözülemedi', 'Ara kademe seçili ama iki çaptan biri eksik',
      'Sürücünün <em>FEAD tahriki</em> bölümünde krank ve kademe kasnağı çapını girin ya da doğru '
      + 'tahrik düzenini seçin'],
    ['Kasnak sayısı yetersiz', 'Kayış Tablosu’nda üçten az satır var',
      'Tablonun <strong>＋ Kasnak ekle</strong> listesinden eksikleri ekleyin'],
    ['Sürücü kasnak yok', 'Hiçbir kasnakta sürücü rolü işaretli değil',
      'Sürücü olacak kasnağın panelini tablodaki adından açıp <em>Rol</em> kartında '
      + 'işaretleyin'],
    ['Kayış yolu kapanmıyor', 'Σ işaretli sarım 360° çıkmıyor',
      'Kayış Tablosu’ndaki <strong>sırayı</strong> (↑ ↓) ve <strong>dönüş yönlerini</strong> '
      + 'gözden geçirin; gerekirse FEAD araçları penceresinin Yön bölümüyle bütün yolu '
      + 'çevirin (Bölüm 5)'],
    ['Kasnaklar çakışıyor', 'İki kasnağın çemberi kesişiyor — ortak teğet yok',
      'Tablodaki koordinatları ya da çapları düzeltin; çakışan çift adıyla yazılır'],
    ['Tasarım gerginliği türetilemedi', 'Kayış, gergi kolunun erişemeyeceği kadar kısa/uzun',
      'Yerleşimi ya da kayış boyunu gözden geçirin']
  ], ['Belirti', 'Sebep', 'Ne yapmalı']);

  h += '<h3>10.1 Girilmeyen alanlar — Gates arşivinden varsayılan</h3>';
  h += '<p>Bazı alanları elle girmek zordur: kasnak atalet momentleri, gergi kolunun '
    + 'ataleti ve kasnak kütlesi, kayış kaburga kütlesi, kayış boy toleransı, uzama+aşınma '
    + 'payı, gerginin mekanik durdurucusu, kayış boyu ofseti. <strong>Boş bırakılan</strong> '
    + 'bu alanlar on dört tedarikçi raporundan çıkarılmış ölçümlerle dolar; '
    + '<strong>hangilerinin dolduğu yazılır</strong>.</p>';
  h += _gfNot('Varsayılan alanın değeri olarak yazılıdır',
      'Bu alanlar <strong>boş görünmez</strong>: alanda varsayılan sayının kendisi yazılıdır '
    + 've yanındaki <strong>i</strong> düğmesi kaynağını söyler; alan boş kaldıkça hesaba bu '
    + 'değer girer. Üstüne yazılınca ipucu “<em>Girilen değer</em>” olur; alan '
    + '<strong>boşaltılınca varsayılan değer geri gelir</strong>. Modelin alanı boş kalır; '
    + 'girilen ile varsayılan ayrımını <strong>i</strong> düğmesi taşır.');
  h += _gfAlanTablo('Varsayılanın kaynağı', [
    ['Atalet momentleri', 'Aksesuar tipine göre medyan',
      'Gates “System Vibration Analysis” sayfası, yedi rapor. Avara · klima · alternatör · '
      + 'gergi kasnağı · gergi kolu · kasnak kütlesi · krank mili'],
    ['Kayış boy toleransı ±', 'Boya göre iki basamak',
      'Arşivde temiz bir ayrım var: 1013–1392 mm’lik yedi kayışın hepsi ±5, 1475–1739 mm’lik '
      + 'yedisinin hepsi ±6 mm'],
    ['Uzama + aşınma payı', '%0,70',
      'On dört sistemin onunda tam bu değer; sapanların hepsi altında, yani %0,70 aynı '
      + 'zamanda emniyetli yön'],
    ['Mekanik durdurucu', 'Nominal dönüş × 1,8',
      'Önce gergi künye kütüphanesinden okunur (12 künye ölçülmüş değerini taşıyor). Künye '
      + 'uygulanmamışsa ölçeklenir — ve <strong>yalnız daraltır</strong>: çekirdeğin kendi '
      + 'erişim sınırından büyük çıkarsa hiç uygulanmaz'],
    ['Kayış boyu ofseti', '1,3 mm',
      'Fiziksel bir sabit değil; tedarikçinin çözdüğü geometrik boy ile sipariş edilen '
      + '<em>katalog</em> boyu arasındaki yuvarlama artığı. Ölçülen beş değer 0,4 … 2,0 mm']
  ], ['Alan', 'Varsayılan', 'Nereden']);
  h += _gfUyari('Varsayılan bu sistemin değeri değil',
      'Bunlar başka araçların raporlarından çıkarılmış <strong>medyanlardır</strong> ve bir '
    + 'mertebe göstergesidir. Tedarikçi raporunda karşılığı varsa o girilir ve varsayılan '
    + 'devreden çıkar. Varsayılan modele <strong>yazılmaz</strong>: alanın gösterdiği sayı '
    + 'modelin alanına kopyalanmaz. Hangi alanın varsayıldığı '
    + 'alanın yanındaki <strong>i</strong> rozetinde, Kayış Yolu · Çözücü · Kayış '
    + 'Özellikleri panellerinde ve ayrıntılı raporun §8 girişinde listelenir.');
  h += _gfNot('Sıfır girmek boş bırakmak değildir',
      'Toleransa <strong>0</strong> yazmak “zarfı kapat” demektir ve geçerli bir seçimdir; '
    + 'varsayılan onu ezmez ve ipucu “Girilen değer” der. Varsayılan yalnız <em>hiç '
    + 'dokunulmamış</em> alana iner — alanı silmek de o hâle döndürür.');
  h += _gfNot('Her tipin varsayılanı yok',
      'Su pompası, direksiyon pompası ve hava kompresörü arşivdeki yedi raporun hiçbirinde '
    + 'geçmiyor. Bu tiplerin ataleti <strong>varsayılmaz</strong>: rotorun ataleti kasnak '
    + 'çapından türetilemez. Böyle bir kasnak modeldeyse ataleti girilmedikçe burulma modeli '
    + 'kurulmaz ve sebebini yazar.');
  return h;
}

function _gfSec11(){
  var h = _gfH2(10);
  h += '<p>Sonuçların <strong>beş okuma yüzeyi</strong> vardır: Kayış Yolu şeması, Kayış '
    + 'Tablosu, paneller, <strong>Sonuçlar sayfasının FEAD sekmesi</strong> (11.7) ve rapor.</p>';
  h += '<h3>11.1 Kanvas kartı ve katmanları</h3>';
  h += '<p>Tuvaldeki ölçekli şema <strong>Kayış Yolu</strong> kartıdır. Tek bir bileşen '
    + 'tipi vardır; ne çizdiği kartın kendi <strong>Katmanlar</strong> panelinden '
    + 'seçilir ve <strong>her kanvas kendi seçimini taşır</strong>. Açılışta iki kanvas '
    + 'yan yana gelir, iki hazır <strong>ön ayarla</strong>:</p>';
  h += _gfAlanTablo('İki ön ayar, iki soru', [
    ['<strong>Geometri</strong>', 'Model <em>kurulurken</em>: kayış nereden geçiyor?',
      'Adlar · sarım açıları · gergi kolu ve montaj ekseni · kol konumları · yön gülü · '
      + 'dönüş okları. <strong>Donuk</strong> — devir okunmaz, animasyon yükü hiç üretilmez'],
    ['<strong>İşletme</strong>', 'Devir <em>seçilince</em>: bu noktada ne oluyor?',
      'Açıklık gerilmeleri · gerilme haritası · animasyon · titreşim. '
      + '<strong>Canlı</strong> — devir ve titreşim seçicileri açılır']
  ], ['Ön ayar', 'Hangi soru', 'Ne çizilir']);
  h += _gfNot('Ön ayar bir başlangıç noktasıdır',
      'Ön ayar kutucukları bir kerede o düzene getirir; katmanlar sonra tek tek açılıp '
    + 'kapanır. İki kanvas farklı katmanlarla ve farklı <strong>kol konumlarıyla</strong> yan '
    + 'yana durabilir: kolun <em>Min</em> ve <em>Değiştirme</em> konumundaki kayış yolu aynı '
    + 'anda görünür.');
  h += _gfSahneSema();
  h += _gfSahneKatman();
  h += '<p>Şemanın işaretleri:</p>';
  h += _gfAlanTablo('Kartta ne var', [
    ['Turuncu yol', 'Çözücünün teğet noktaları ve işaretli sarım yayları'],
    ['Yol üstündeki dişler', 'Kayışın <strong>kaburgalı yüzü</strong> — kaburgalı temas edende '
      + 'kasnağın içine, sırttan temas edende dışarı bakar'],
    ['Kesikli çember', 'Kayış o kasnağa <strong>sırttan</strong> değiyor'],
    ['Kasnak içi ok', 'Dönüş yönü (sırttan temas edende ters döner)'],
    ['Yeşil artı ve kesikli çizgi', 'Gerginin <strong>montaj konumu</strong> ve kolu'],
    ['Yön gülü', 'Açı konvansiyonu — sürüklenebilir, çift tıkla varsayılana döner'],
    ['Soluk gri yollar', 'Kolun gezdiği diğer konumlar (“Tümü” kipinde)'],
    ['Üst künye', 'Çizilen konumun adı · kol açısı · gerginlik'],
    ['<strong>Sağ üst rozet</strong>', '<strong>✓/✗ Σsarım · kasnak sayısı · efektif boy · kord</strong> '
      + '— Σsarım 360,0° olmak zorundadır; değilse sebebi yazılır. Efektif boy kayış '
      + 'numarasının çizgisi (d<sub>b</sub>), kord CAD eskizininki (d<sub>w</sub>) — §8.5'],
    ['Yüzen çubuk', 'Gergi kol konumu · devir · titreşim · <em>Katmanlar</em> · <em>Tablo</em>'],
    ['Göbekteki numara', 'Tablo açıkken kasnağın tablodaki satır numarası']
  ], ['İşaret', 'Ne söylüyor']);
  h += _gfSahneCalisma();
  h += _gfNot('Devir seçilince kart hareketlenir',
      'İşletme ön ayarlı kartın devir seçicisinden bir çalışma noktası seçilince kayış akar ve '
    + 'kasnaklar döner. Hareket <strong>ağır çekimdir</strong>, oranlar birebir doğrudur: hangi '
    + 'kasnak ne kadar hızlı döner, hangisi <strong>ters</strong> döner, kayış ne kadar hızlı '
    + 'gider — üçü de çözümden gelir.');
  h += '<h4>11.1.1 Senaryo — motor çevrimi</h4>';
  h += '<p>Devir seçicisinin son seçeneği sabit bir devir değil, bir '
    + '<strong>senaryodur</strong>: <em>durgun → marş → ateşleme → rölanti → hızlanma → '
    + 'yavaşlama → stop</em>. Sabit devirde görünmeyeni gösterir: devir değişirken gerginliğin, '
    + 'gergi kolunun ve açıklık çırpınmasının davranışı.</p>';
  h += _gfUyari('Devir geçmişi dayatılır, simüle edilmez',
      'Senaryo bir motor dinamiği çözümü <strong>değildir</strong>: MFSim’in FEAD modelinde '
    + 'volan ataleti yoktur (modeldeki krank ataleti burulma modelinin girdisidir). Devir '
    + 'eğrisi <strong>dayatılır</strong> — rampanın dikliği sürücü kasnağın Motor bölümündeki '
    + '<em>İvmelenme</em> / <em>Yavaşlama</em> alanlarından, şekli motorun tork eğrisinden '
    + 'gelir. Gerginlik, hubload ve çırpınma o dayatılmış devirde <strong>gerçekten</strong> '
    + 'hesaplanır; devrin kendisi bir girdidir, bir sonuç değil.');
  h += '<h3>11.2 Kayış Tablosu ve tuval rozetleri</h3>';
  h += '<p>Kasnakların kutusu olmadığı için tuvalde yalnız <strong>Kayış Yolu kartlarının</strong> '
    + 'rozetleri kalır; kasnak başına okumalar Kayış Yolu kartının altındaki Kayış '
    + 'Tablosu’ndadır, çözümün durumu FEAD araçları penceresindedir.</p>';
  h += _gfAlanTablo('Nerede ne okunur', [
    ['<strong>Kayış Tablosu</strong>', 'Kasnak başına efektif çap · dönüş yönü · sarım · span; '
      + 'kapanış hükmü kartın rozetinde (✓/✗ Σsarım)',
      'Sarım ve span <strong>çözümden</strong>; Σsarım 360,0° olmalı'],
    ['Kayış Tablosu başlığındaki kip anahtarı', 'Sabit (vurgu rengi) ↔ Serbest (amber)',
      'Tıklanabilir; avara merkezi girdiyken kilitli'],
    ['FEAD araçları → Çözüm', 'Durum (<em>Güncel</em> · <em>Model değişti</em> · '
      + '<em>Sonuç yok</em>) ve dört özet kartı', 'Eski sonuç gizlenmez, soluk çizilir'],
    ['FEAD araçları → Yön', '<code>CW</code> | <code>CCW</code> anahtarı ve gergi tarafı satırı',
      'Tıklanabilir; satırın <strong>rengi</strong> gergi tarafı hükmünü taşır (Bölüm 5.2)']
  ], ['Nerede', 'Ne yazar', 'Not']);
  h += '<h3>11.3 Paneller</h3>';
  h += _gfAlanTablo('Hangi sonuç hangi panelde', [
    ['<strong>Kayış Tablosu</strong>', 'Kasnak başına efektif çap · dönüş yönü · sarım açısı · '
      + 'span; Σsarım kartın rozetinde', 'Hayır'],
    ['Gergi paneli', 'Türeyen montaj konumu · serbest kol açısı · gereken kayış boyu · '
      + 'tasarım gerginliği · konum pimi', 'Hayır'],
    ['Kayış paneli', 'Türetilen boy ve hangi kol açısından geldiği · katalog aday tablosu · '
      + 'kapatılan çıktıların listesi', 'Hayır'],
    ['Kayış Yolu paneli', 'Geometri tablosu: kasnak · temas · çıkış açıklığı · sarım · hız '
      + 'oranı; altında efektif boy, pitch boyu ve Σ sarım', 'Hayır'],
    ['Çözücü — Algılanan model', 'Algılanan model · <strong>Gergi konum tablosu</strong> (altı '
      + 'konum × kol açısı, gerginlik, hubload, yön, β, sarım) · '
      + '<strong>Uygunluk kriterleri</strong> · uyarılar', 'Hayır'],
    ['Çözücü — Sonuç', 'Çıkış gerilmeleri ve min. kayma emniyeti hükmü · hubload · '
      + 'burulma titreşimi · kaburga yorulma dağılımı · B10 ömür · geçerlilik sınırları',
      '<strong>Evet</strong>'],
    ['Sürücü kasnak — Güç eğrisi', 'Motorun tam yük eğrisi · çevrimde FEAD’in motor gücündeki payı',
      'Hayır'],
    ['<strong>FEAD araçları</strong> — Rapor bölümü', 'Detaylı · Özet · A3 sonuç panosu '
      + '(kutusu yok: pencerenin bölümü)', '<strong>Evet</strong>']
  ], ['Panel', 'Ne okunur', 'Hesapla gerekir mi']);
  h += '<h3>11.4 Uygunluk kriterleri — üç hüküm</h3>';
  h += '<p>Çözücü penceresinde <strong>Algılanan model</strong>in altındaki kart, BMC’nin kendi FEAD '
    + 'hesap defterinden gelen üç kuralı model üzerinde ölçer. Kart <strong>çözüm '
    + 'gerektirmez</strong>: geometri ve künyeler tamamsa hüküm oradadır.</p>';
  h += _gfTablo('Üç kriter',
    ['Kriter', 'Kural', 'Hüküm mü, uyarı mı'],
    [
      ['Kasnak merkez mesafesi',
        '0,7·(d₁+d₂) ≤ a ≤ 2·(d₁+d₂) — her kasnak çifti için; tablo alt sınır, a, üst sınır '
        + 've <strong>pay yüzdesini</strong> yazar',
        '<strong>Uyarı</strong> — tasarımı reddetmez'],
      ['Çevrim oranı penceresi',
        'Motor <em>governed</em> devrindeyken her aksesuarın devri, kendi '
        + '<em>optimum … maksimum sürekli</em> bandına düşüyor mu. Hüküm yönü de '
        + 'söyler: aksesuar optimumun <strong>altında</strong> dönüyorsa '
        + '“Kasnak çapı küçültülmeli” (küçük kasnak onu hızlandırır), sürekli '
        + 'maksimumun <strong>üstünde</strong> dönüyorsa “Kasnak çapı büyütülmeli”',
        '<strong>Hüküm</strong>'],
      ['Aksesuar devir sınırı',
        'Çalışma çevriminin her noktasında aksesuar devri, sürekli ve anlık maksimumun '
        + 'altında mı',
        '<strong>Hüküm</strong>']
    ], ['l', 'l', 'c']);
  h += _gfUyari('Merkez mesafesi kuralı bir uyarıdır',
      'Kural <strong>iki kasnaklı V-kayış tahrikleri</strong> için yazılmıştır: orada açıklığı '
    + 'yalnız iki kasnağın arası belirler. Serpantin bir tahrikte açıklığı <strong>bütün '
    + 'yerleşim</strong> belirler; kuralın ihlali tek başına tasarımı geçersiz kılmaz. Pay ve '
    + 'sınıra kalan mesafe yazılır. Öteki iki kriter hükümdür.');
  h += _gfNot('Eksik veri “uygun” demek değildir',
      'Bir aksesuarın devir sınırları girilmemişse (Bölüm 6.2) o satır '
    + '<strong>“değerlendirilemedi”</strong> olur ve <strong>uygun sayılmaz</strong>.');
  h += _gfSahneKapilar();
  h += _gfNot('Panel canlı, rapor çözüm anında',
      'Panel kriterleri <strong>canlı</strong> değerlendirir; rapor <strong>çözüm anında</strong> '
    + 'yazılan sonucu okur. Çözümden sonra değiştirilen bir devir sınırı raporu yeni çözüme '
    + 'kadar değiştirmez.');
  h += '<h3>11.5 Kayma emniyetini doğru okumak</h3>';
  h += '<p>Çıkış gerilmeleri tablosunun son sütunu <strong>Min SF</strong>’dir ve bütün '
    + 'kasnakların en küçüğünü basar; sayılar servis faktörü c<sub>2</sub> ile tasarım '
    + 'yükündedir (§8.7). Bu sayı 1’in altına düştüğünde önce <strong>hangi kasnak</strong> '
    + 'olduğuna bakın.</p>';
  h += _gfUyari('Avara ve gerginin payı hükme girmez',
      'Avara ve gergi kasnakları kayıştan <strong>güç çekmez</strong>: talepleri yalnız atalet ve '
    + 'yatak sürtünmesidir, gerginlik oranı 1’e çok yakındır ve emniyet faktörleri çoğunlukla '
    + 'güç ileten kasnaklarınkinden bir mertebe büyüktür. Sayı bir paydır ama tasarımın '
    + 'sorusunu cevaplamaz. <strong>Rapor hükmünü yalnız yük taşıyanların en küçüğünden '
    + 'verir</strong>; panel tablosu ise ham en küçüğü gösterir. Bölüm 14’te bu ayrımın sayısal '
    + 'karşılığı var.');
  h += '<h3>11.6 Kord kuvveti, sürünme ve hizalama payı</h3>';
  h += '<p>Üçü de hesaba girmeyen, <strong>gösterilen</strong> sonuçlardır. Gerginlik tabloları '
    + 'modelin her yerindeki <em>etkin</em> gerginliği basar (T − m′v²); hubload, kayma ve güç '
    + 'onunla tutarlıdır. <strong>Kord kuvveti</strong> buna merkezkaç payını ekler ve kayışın '
    + 'kordunun gerçekten taşıdığı kuvvettir; özet kartı çevrimin en büyüğünü, rapor §8.17 '
    + 'açıklık başına aralığını yazar.</p>';
  h += '<p><strong>Sürünme</strong> (elastik kayma): kasnak yüzeyi, kayışın ona girdiği açıklığın '
    + 'hızıyla döner ve kayış gerildikçe uzar. Sürücüye giren açıklık en gergin olduğu için her '
    + 'aksesuar kinematik devrinin biraz altında döner; en çok, gevşek taraftan beslenen kasnak. '
    + 'Kord rijitliği (EA) yalnız ölçülmüş bir aralık olarak bilindiği için sonuç bir banttır ve '
    + 'yalnız PK kayışta verilir. Aksesuar devri, kayma ve devir sınırı kriteri kinematik devirle '
    + 'kalır.</p>';
  h += '<p><strong>Hizalama payı</strong> (Sonuç Özeti): kaburgalı kasnağa kayışın gidiş yönünde '
    + '<em>giren</em> açıklıkta izin verilen eksenel kaçıklık. Önceki kasnak düzse onun açısal '
    + 'kaçıklığı payı daraltır; bu açı girilmez, 0 alınır ve sayı bir üst sınırdır.</p>';
  h += _gfNot('İkisi de kayış verisine bağlı',
      'Kord kuvveti birim kütleden, sürünme kord rijitliğinden gelir; kayış tipine bağlı çıktılar '
    + 'anahtarı kapalıyken üretilmezler (§8.4). Hizalama payı yalnız geometriden gelir, her '
    + 'çözümde vardır.');
  h += '<h3>11.7 Sonuçlar sayfası — FEAD sekmesi</h3>';
  h += '<p>Sayıların devirle, kol açısıyla ya da zamanla değişimi kabuğun <strong>Sonuçlar</strong> '
    + 'sayfasındaki <strong>FEAD kayış tahriki</strong> sekmesindedir; FEAD araçları penceresinin '
    + 'Çözüm bölümündeki <strong>Sonuçlar’da aç</strong> bağlantısı oraya götürür. Sekme '
    + '<strong>çözüm anında</strong> yazılan veri kümelerini gösterir.</p>';
  h += _gfSahneSonucKart();
  h += '<p>Pano bir <strong>şerit diyagramı</strong> panosudur: sol sütundaki Veri Gezgini’nden '
    + 'seçilen kanallar alt alta şeritler hâlinde çizilir. FEAD <strong>dört veri kümesi</strong> '
    + 'yayınlar; bir panoda <strong>tek X ekseni</strong> bulunur.</p>';
  h += _gfAlanTablo('Dört veri kümesi', [
    ['<strong>Çalışma çevrimi</strong>', 'Motor devri [d/dk]',
      'Çevrimin her devrinde açıklık gerginlikleri, hubload, kayma emniyeti, aksesuar gücü, '
      + 'mil torku ve kasnak devri'],
    ['<strong>Campbell diyagramı</strong>', 'Motor devri [d/dk]',
      'Uyarma mertebeleri × burulma modları × açıklık frekansları — kesişmeler rezonans '
      + 'adaylarıdır'],
    ['<strong>Gergi kolu taraması</strong>', 'Kol açısı (göreli) [°]',
      'Kol boyunca gerginlik kontrol eğrisi, hubload–β ve yay momenti: kolun çalışma '
      + 'zarfının tamamı'],
    ['<strong>Motor çevrimi senaryosu</strong>', 'Zaman [s]',
      'Marştan stopa devir, kayış hızı, devir ivmesi, açıklık gerginlikleri ve açıklık '
      + 'frekansları — sabit devirde görünmeyen geçici rejim']
  ], ['Küme', 'X ekseni', 'Ne taşır']);
  h += _gfNot('Altı hazır ön ayar',
      'Sekmenin <strong>ön ayarları</strong> altı hazır diyagram kurar — <em>Gerginlik ve '
    + 'kayma</em>, <em>Hubload</em>, <em>Aksesuar yükü</em>, <em>Campbell diyagramı</em>, '
    + '<em>Gergi kolu</em> ve <em>Motor çevrimi</em>. Her ön ayar kendi kümesinin kanallarını '
    + 'açar; şeritler sonra ayrılabilir, birleştirilebilir, eksenler logaritmik yapılabilir.');
  h += _gfNot('Şerit yorumu yalnız o şeridi anlatır',
      'Her şeridin altında bir <strong>yorum</strong> paragrafı vardır ve başlığı şeridi '
    + 'adlandırır: kanalların çoğunluğunun grubu, ardından kaç kanal olduğu. Kümenin '
    + 'geneline dair bir cümle — ankraj, '
    + 'kayma eşiği, kalibrasyon notu — <em>bir</em> sahip şeride düşer, her şeritte '
    + 'tekrarlanmaz.');
  h += _gfUyari('Model değişince sonuç damgalanır',
      'Çözümden sonra model değişince (bir çapı büyütmek yeter) sekme <strong>“Model '
    + 'değişti”</strong> damgası taşır; çözücü penceresi ve rapor aynı hükmü verir. '
    + 'Tabloların tamamı <strong>Sonuç Özeti</strong> penceresinde '
    + '(sekmenin başındaki bağlantı); şeritteki <strong>Sonuçları temizle</strong> '
    + 'FEAD kümelerini de siler.');
  h += _gfNot('Kayış verisi kapalıysa küme de yoktur',
      'Kayış Özellikleri’ndeki <em>kayış verisi</em> kapatıldığında açıklık frekansları, '
    + 'senaryo ve kartın çırpınma okuması <strong>üretilmez</strong>.');
  return h;
}

function _gfSec12(){
  var h = _gfH2(11);
  h += '<p>Rapor <strong>FEAD araçları</strong> penceresinin <strong>Rapor</strong> bölümünden '
    + 'üretilir. Rapor çözülmüş modelden üretilir; model çözülmemişse <strong>İndir</strong> '
    + 'pasiftir ve üstüne gelince sebebini yazar.</p>';
  h += _gfAdimlar([
    'Rapor türünü seçin: <strong>Özet</strong>, <strong>Detaylı</strong> ya da <strong>A3</strong>.',
    'Bölümün <strong>Künye</strong> bağlantısı Rapor penceresini açar; <strong>Doküman '
      + 'künyesi</strong> alanlarını doldurun: hazırlayan, doküman no, revizyon, kontrol eden, '
      + 'onaylayan, tasarım notları. Bunlar antete ve belgenin sonundaki notlar bölümüne akar; '
      + 'kontrol eden ve onaylayan A3 panonun başlık bloğunda (boşsa kâğıtta elle doldurulur).',
    '<strong>İndir</strong>’e basın (<strong>Rapor</strong> penceresindeki <strong>Raporu oluştur ve '
      + 'indir</strong> düğmesi de aynı işi yapar). İlk üretimde yazı tipleri ve formül '
      + 'dizgisi (~1 MB) bir kez yüklenir.',
    'İnen dosya tek parçadır ve çevrimdışı açılır. Özet ve Detaylı A4’e, A3 sonuç panosu '
      + 'tek bir yatay A3 sayfaya basılır (yazdırırken ölçek %100).'
  ]);
  h += _gfSahneRapor();
  h += _gfAlanTablo('Üç rapor türü', [
    ['Detaylı', 'Teori bölümleri 1–7 ve 9–10 · Ek A · çözümün sayısal bölümü (18 alt bölüm) · '
      + 'uygunluk hükmü', 'Yöntemi de belgelemek, hesabı denetletmek'],
    ['Özet', 'Tedarikçi çıktısının biçiminde altı sayfa: Genel bakış · Geometri · Gergi '
      + 'çalışma zarfı · Çalışma çevrimi ve torklar · Gerginlik ve Hubload · Dayanım ve '
      + 'titreşim', 'Sonuçları paylaşmak, tedarikçi raporuyla yan yana koymak'],
    ['A3', 'Tek yatay A3 sayfa, dört sütun: dokuz gösterge · kayış yolu ve hubload çizimleri · '
      + 'kasnak yerleşimi, açıklık, kayış, kasnak, çalışma çevrimi (yorulma katkısıyla) ve gergi '
      + 'tabloları · açıklık gerginliği ve kayma emniyeti ısı haritaları · gergi kolu zarfı · '
      + 'gerginlik, motor çevrimi ve frekans grafikleri · burulma modları · uygunluk · tasarım '
      + 'notları. Gövde yazısı 8 pt; küçük modelde bloklar komşu sütuna kayar, sayfa boş kalmaz',
      'Çözümü tek bakışta görmek, basıp masada incelemek']
  ], ['Tür', 'İçerik', 'Ne zaman']);
  h += _gfNot('Rapor çözülen modeli anlatır',
      'Belge <strong>Hesapla</strong> anındaki modeli anlatır; çözümden sonraki değişiklik '
    + 'rapora girmez. Değişiklik için yeniden çözün.');
  return h;
}

function _gfSec13(){
  var h = _gfH2(12);
  h += '<p>Bu modülde en pahalı hata çöken model değil, <strong>“makul ama yanlış” '
    + 'sayıdır</strong>: model çözülür, tablolar dolar, uyarı çıkmaz. Her hatanın ölçülmüş '
    + 'bedeli:</p>';
  h += _gfTablo('Uyarı vermeyen hatalar',
    ['Alan', 'Yanlış verilirse ne olur', 'Ölçülen bedel'],
    [
      ['Temas tarafı', 'Geçerli ama <strong>başka</strong> bir kayış yolu çözülür; Σ sarım '
        + 'yine 360 çıkar', 'Bir sistemde sarım 207,7° yerine 172,2° — <strong>−35,5°</strong>'],
      ['Gergi montaj konumu', 'Kasnak merkezi montaj konumu sanılırsa model yine çözülür; '
        + 'iki nokta karşılaştırılmaz, uyarı çıkmaz',
        'Gerginlik medyan <strong>+%1526</strong> · 5/14 sistemde uyarı yok'],
      ['Kol boyu', 'Yanlış girilirse türeyen kasnak merkezi kol boyu kadar kayar; kayış yolu '
        + 'yine kapanır', 'Bu örnekte 90 mm’lik bir kayma — kasnak sürücünün içine düşebilir'],
      ['Tahrik düzeni', 'Yanlış düzen seçilirse oran yanlış çaplardan türer',
        'Bütün devir ve gerilmeler aynı oranda kayar — tek kademeli bir sistemde 1,430’luk '
        + 'oran devirleri <strong>%43</strong> kaydırır'],
      ['Dönüş yönü', 'Gergi kayışın gergin tarafına düşer',
        'Açıklık gerilmeleri ankrajın altına iner, bir kısmı <strong>negatife</strong> döner'],
      ['Kayış sırası', 'Tablo satırları raporun sırasında değilse başka bir serpantin '
        + 'çözülür; çevrim yine kapanabilir',
        'Sarım dağılımı ve açıklıklar baştan başka — <strong>gergi de yanlış tarafa</strong> '
        + 'düşebilir'],
      ['Aksesuar devir sınırı', 'Girilmezse uygunluk kriteri hüküm veremez',
        'Kriter <strong>“değerlendirilemedi”</strong> olur ve <strong>uygun sayılmaz</strong>'],
      ['Gergi kasnak kütlesi', 'Girilmezse nokta kütle terimi eksik kalır',
        'Birinci burulma modu <strong>+%32</strong> (15,3 yerine 20,3 Hz)'],
      ['Aşınma payı', '<strong>Oran</strong> olarak girilir (0,007), yüzde olarak değil',
        'Yüz kat sapma'],
      ['Künye karışımı', 'Gergi koordinatı bir belgeden, kayış künyesi başka belgeden alınır',
        'Model iki farklı sistemi anlatır — sapma <strong>üç katına</strong> çıkar']
    ], ['c', 'l', 'l']);
  h += _gfNot('Ortak kural: geçerlilik sınırı sonucun içinde taşınır',
      'Kalibre edilmemiş bir sayının başlığında damgası, altında ölçülen sapma bandı vardır; '
    + 'kapatılmış bir çıktı listelenerek yazılır. Paneldeki ya da rapordaki uyarı sonucun '
    + 'parçasıdır.');
  return h;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §14 — İŞLENMİŞ ÖRNEK (sayılar üretim anında hesaplanır)
// ═══════════════════════════════════════════════════════════════════════════

// Örneği BELLEKTE kur ve çöz. Kullanıcının tuvaline dokunulmaz: örnek düğümleri
// `veFeadExampleNodes` düz nesne olarak üretiyor ve `veFeadBuildSystem` açık
// liste kabul ediyor (global `nodes` okuyan `veFeadBuildFromCanvas` DEĞİL).
//
// KAYIŞ BOYU SİLİNİR. Örnek onu kendi kaydında taşımıyor zaten (boy bir
// ÇIKTI), ama silmek kılavuzun iddiasını yapısal olarak garantiliyor: belge
// "program bu boyu buldu" derken girdiyi okuyor olamaz.
//
// KOL ÇALIŞMA AÇISI SİLİNMEZ ve bu 2026-09-01'de değişti. Bir dönem burada
// açı da siliniyordu, çünkü program onu bir MONTAJ ZARFINDAN seçiyordu ve
// kılavuz "sıfırdan tasarım" akışını anlatıyordu. Girdi avara merkezine
// dönünce o zarf çöktü (bkz. fead-model.js "MONTAJ ZARFI KALKTI") — kol
// çalışma açısı artık kol boyu ve yay künyesiyle aynı sınıftan, gerginin
// montaj verisinden okunan bir GİRDİ. Silmek modeli çözülemez yapardı.
var VE_GF_MOTOR = '57RS303252';   // ISL8.9E3 375 — 700 · 2100 · 2900 RPM
function _gfOrnekCoz(){
  if(typeof veFeadExampleNodes !== 'function' || typeof veFeadBuildSystem !== 'function'
     || typeof componentDefs === 'undefined')
    return null;
  var pack;
  try { pack = veFeadExampleNodes('AG00976_GATES_2025'); } catch(e){ return null; }
  if(!pack || !pack.nodes) return null;
  pack.nodes.forEach(function(n){ n.def = componentDefs[n.type]; });

  var gergi = null, kayis = null, cozucu = null;
  pack.nodes.forEach(function(n){
    var d = componentDefs[n.type] || {};
    if(d.isFeadTensioner) gergi = n;
    if(d.isFeadBelt) kayis = n;
    if(d.isFeadSolver) cozucu = n;
  });
  if(!gergi || !kayis || !cozucu) return null;

  // MOTOR KÜNYESİ KATALOGDAN — yalnız DEVİR SINIRLARI. Gates raporu motorun
  // rölanti/governed/overspeed devrini basmıyor ve işletme hesabı onlarsız
  // yapılmaz (fead-model.js → veFeadIsletmeEksik); sahneler çözülmüş hâli
  // göstersin diye kullanıcının yapacağı adım yapılıyor ve 9.2 bunu SÖYLÜYOR.
  // Kademe çapları YAZILMAZ: örneğin doğrudan tahrikini değiştirirdi. Gates'le
  // karşılaştırılan sayıların hiçbiri (çevrim devirlerindeki gerilme, hubload,
  // boy) bu devirlere bağlı değil.
  var _m = (typeof veFeadEngineOf === 'function') ? veFeadEngineOf(VE_GF_MOTOR) : null;
  if(_m) ['idleRpm', 'governedRpm', 'overspeedRpm'].forEach(function(k){
    if(!(Number(cozucu.data[k]) > 0) && _m[k] != null) cozucu.data[k] = _m[k];
  });

  delete kayis.data.effLength;

  var build;
  try { build = veFeadBuildSystem(pack.nodes); } catch(e){ return null; }
  if(!build || !build.ok) return null;

  var R = null;
  try {
    R = veFeadAnalyze(build, {
      rows: veFeadDutyRows(cozucu),
      cylinders: Number(cozucu.data.cylinders),
      crankInertia: Number(cozucu.data.crankInertia) || 0,
      fatigueModel: cozucu.data.fatigueModel || 'PK-2_2p-MT3',
      accelRpmS: Number(cozucu.data.accelRpmS),
      decelRpmS: Number(cozucu.data.decelRpmS)
    });
  } catch(e){ R = null; }

  return { pack: pack, build: build, R: R,
           gergi: gergi, kayis: kayis, cozucu: cozucu };
}

// Gates AG00976 raporunun kendi sayıları — KARŞILAŞTIRMA için. Bunlar dış bir
// belgenin basılı değerleridir, modelin çıktısı değil; bu yüzden burada sabit
// dururlar ve öyle kalmalıdırlar. Model tarafındaki her sayı canlı hesaplanıyor.
var VE_GUIDE_FEAD_GATES = {
  belt: 1714.6, design: 544, freeAbsDeg: 16.1, NF: 12.52,
  // Raporun gergi için bastığı İKİ AYRI koordinat. Bunlar aynı şeyin iki
  // yazımı değil, kolun iki ucu: aralarındaki mesafe 14 sistemin 14'ünde de
  // tam kol boyu (en büyük sapma 0,0054 mm — basım yuvarlaması).
  //   tenXY  → "Layout Data" tablosunun gergi satırı (çalışma merkezi) = GİRDİ
  //   pivot  → "Tensioner Data / Pivot Point {X, Y Coordinates} mm"  = modelin
  //            TÜRETTİĞİ sayı; modele hiç girmiyor, karşılaştırma için burada
  pivot: [-250, 110], tenXY: [-161.97, 91.29], arm: 90,
  wrap: [156.2, 52.8, 198.4, 64.3, 157.1, 34.6],
  span: [148.0, 141.4, 150.8, 272.7, 194.4, 141.3],
  T880: [1381, 1380, 1023, 1022, 545, 544],
  H880: [1891, 1228, 2372, 1088, 1539, 324]
};

function _gfSapma(bizim, gates){
  if(!Number.isFinite(bizim) || !Number.isFinite(gates) || gates === 0) return '—';
  var p = (bizim - gates) / gates * 100;
  return '%' + (p >= 0 ? '+' : '') + _gfFs(p, 2);
}

function _gfSec14(){
  var h = _gfH2(13);
  h += '<p>Kılavuzun tamamı tek bir örnekte: altı kasnaklı, ikincil tahrikli gerçek bir aracın '
    + 'FEAD düzeni. Çıkan sayılar aynı sistem için kayış tedarikçisinin raporundaki değerlerle '
    + 'yan yanadır.</p>';

  var O = _gfOrnekCoz();
  if(!O){
    h += _gfUyari('Örnek bu oturumda çözülemedi',
        'İşlenmiş örnek belge üretilirken hesaplanır; hesap zinciri kurulamadı. Örnek programda '
      + '<strong>Başlangıç Sihirbazı → 1 · Başlangıç → AG00976</strong> ile kurulur.');
    return h;
  }
  var b = O.build, R = O.R, G = VE_GUIDE_FEAD_GATES;
  var td = O.gergi.data;

  // ── 14.1 Girdiler ────────────────────────────────────────────────────────
  h += '<h3>14.1 Girdiler</h3>';
  h += '<p>Tedarikçi raporundan okunan koordinatlar ve künyeler: modelin bütün girdileri '
    + 'bunlardır, geri kalan her sayı bunlardan türer.</p>';

  // KOORDİNATIN NE OLDUĞU KENDİ SÜTUNUNDA. Gergi satırı diğer beşiyle AYNI
  // sütunda ama BAŞKA bir noktayı taşıyor: beşi kasnak merkezi, gergininki
  // montaj konumu (kolun döndüğü eksen) — ve aradaki mesafe tam kol
  // boyu, yani 90 mm. Fark bir dönem X hücresine sıkıştırılmış "pivot"
  // kelimesiyle anlatılıyordu; tek sütunun iki anlam taşıması bu modülün
  // "sessiz tuzak" saydığı şeyin ta kendisi. Artık yapısal olarak ayrı.
  var satirlar = [];
  var pulleys = b.order || [];
  pulleys.forEach(function(n, i){
    var d = n.data || {};
    var ad = (typeof _feadNodeName === 'function') ? _feadNodeName(n) : (b.names[i] || '—');
    var gergiMi = !!(componentDefs[n.type] && componentDefs[n.type].isFeadTensioner);
    satirlar.push([
      _gfE(ad),
      _gfF(d.od, 0),
      gergiMi ? _gfF(d.cenX, 2) : _gfF(d.x, 1),
      gergiMi ? _gfF(d.cenY, 2) : _gfF(d.y, 1),
      gergiMi ? 'avara kasnağının merkezi' : 'kasnak merkezi',
      (typeof veFeadContactOf === 'function' && veFeadContactOf(n) === 'grooved')
        ? 'kaburgalı' : 'sırttan',
      // ROL SÜTUNU GERGİYİ DE ADLANDIRIR. Bir dönem yalnız `driver`a bakıyordu,
      // yani gergi satırında '—' yazıyordu ve o satırı diğerlerinden ayıran tek
      // şey kasnağın ADIYDI — kullanıcı düğümü yeniden adlandırınca kaybolan
      // bir sinyal. Detaylı raporun aynı tablosu orada 'gergi' yazıyor.
      d.driver ? '<span class="ok">sürücü</span>'
        : (gergiMi ? 'gergi'
        : (_feadDefOf(n).isFeadIdler ? 'avara' : 'aksesuar'))
    ]);
  });
  h += _gfTablo('Kasnak künyeleri — girilen değerler',
    ['Kasnak', 'OD [mm]', 'X [mm]', 'Y [mm]', 'Koordinat neyi gösteriyor', 'Temas', 'Rol'],
    satirlar, ['l', '', '', '', 'l', 'c', 'c']);

  h += _gfOnay('Gergi satırı da bir kasnak merkezidir',
      'Altı satırın altısında da X/Y aynı şeydir: <strong>kasnağın merkezi</strong>. '
    + 'Gerginin farkı koordinatında değil, kasnağının bir <em>kolun ucunda</em> '
    + 'olmasında — kol gezindikçe o merkez bir yay çiziyor ve tabloya giren, '
    + 'çalışma (Mean) konumundaki hâlidir.<br><br>'
    + 'Tedarikçiye giden FEAD bilgi sayfası da, tedarikçiden dönen raporun '
    + '<em>Layout Data</em> tablosu da gergi satırında bunu veriyor. Gövdenin motora '
    + 'cıvatalandığı nokta (<em>Tensioner Data → Pivot Point</em>) <strong>modele '
    + 'girmez</strong>: kol boyu ve kol çalışma açısından türer ve 14.2’de raporun kendi '
    + 'satırıyla karşılaştırılır.');

  h += _gfTablo('Gergi ve kayış künyeleri — girilen değerler',
    ['Alan', 'Değer', 'Nereden'],
    [
      ['Avara kasnağının merkezi',
        _gfF(td.cenX, 2) + ' / ' + _gfF(td.cenY, 2) + ' mm',
        'Raporun <em>Layout Data</em> tablosunun gergi satırı — panelde '
        + '“Avara kasnağının merkezi”'],
      ['Kol boyu', _gfF(td.armLen, 1) + ' mm', 'Raporun <em>Tensioner Data</em> bölümü'],
      // "GİRİLEN DEĞERLER" tablosu kullanıcının GERÇEKTEN girdiği sayıyı
      // basmalı: `armMeanDeg` saklanan (mutlak) hâl, panele yazılan ise onun
      // 180° ötesi. Ham basılınca tablo "siz şunu girdiniz" diyerek girilmemiş
      // bir sayı gösteriyordu.
      ['Kol yönü (girdi)',
        _gfFs((typeof veFeadArmShownDeg === 'function')
              ? veFeadArmShownDeg(td.armMeanDeg) : td.armMeanDeg, 2) + '°',
        'Panele yazılan değer — merkez→gövde, işaretli'],
      ['θ<sub>kol</sub> (mutlak, türev)', _gfFs(td.armMeanDeg, 2) + '°',
        'Gerginin parça/montaj çizimi — gövde→merkez, 0…360'],
      ['Yay ön yükü', _gfF(td.preload, 2) + ' Nm', 'Aynı bölüm'],
      ['Yay katsayısı', _gfF(td.kArm, 3) + ' Nm/°', 'Aynı bölüm'],
      ['Çalışma momenti', _gfF(td.meanLoad, 2) + ' Nm', 'Aynı bölüm'],
      ['Kayış profili', _gfE((O.kayis.data.profile || '—') + ' · '
        + (O.kayis.data.ribs || '—') + ' kanal'), 'Kayış künyesi'],
      ['Kayış efektif boyu', '<em>girilmedi — çıktı olacak</em>', '—']
    ], ['l', 'c', 'l']);

  h += _gfOnay('Kayış boyu girilmedi',
      'Kayış boyu bu modülde bir <strong>çıktıdır</strong>: kasnak merkezleri ve gergi '
    + 'künyesi verildiğinde kolun nominal yay yükünde oturduğu yer bellidir, kapanan '
    + 'kayış yolunun boyu da onunla. 14.2’de model bu boyu bulur.');

  // ── 14.2 Türeyen değerler ────────────────────────────────────────────────
  h += '<h3>14.2 Türeyen değerler</h3>';
  h += '<p>Kasnaklar Kayış Tablosu’na girilip sıraya dizildikten ve gergi künyesi girildikten '
    + 'sonra <strong>Avara hareketi</strong> kartının değerleri. Montaj konumu satırı 14.1’deki '
    + 'ayrımın karşılığıdır: <strong>gergi gövdesinin montaj konumu bir girdi değil, avara '
    + 'merkezinden ve kol çalışma açısından türeyen bir sonuçtur</strong> ve tedarikçi '
    + 'raporunun <em>Tensioner Data</em> satırına oturur.</p>';

  var m = (typeof veFeadSpringSetup === 'function') ? veFeadSpringSetup(td) : {};
  var piv = (typeof veFeadTensionerPivot === 'function') ? veFeadTensionerPivot(td) : null;
  var pX = piv ? piv[0] : NaN, pY = piv ? piv[1] : NaN;

  h += _gfTablo('Çözüm — gergi panelindeki okuma',
    ['Büyüklük', 'Değer', 'Nasıl çıktı'],
    [
      ['Yay kurulması', _gfFs(m.relMeanDeg, 2) + '°',
        '(M<sub>çalışma</sub> − M<sub>ön</sub>) / k — salt yay künyesinden'],
      ['<strong>Gövdenin montaj konumu</strong>',
        '<strong>' + _gfFs(pX, 2) + ' / ' + _gfFs(pY, 2) + ' mm</strong>',
        'p = c − a·(cos θ, sin θ) — avara merkezi, kol boyu ve kol çalışma açısından'],
      ['Serbest kol açısı', _gfFs(b.freeAngleDeg, 2) + '°',
        'θ<sub>çalışma</sub> − sense × yay kurulması'],
      ['<strong>Gereken kayış boyu</strong>',
        '<strong>' + _gfFs(b.beltLengthMm, 2) + ' mm</strong>',
        'Kolun nominal yay yükünde kapanan kayış yolunun efektif boyu'],
      ['Tasarım gerginliği', _gfFs(b.springTensionN, 2) + ' N',
        'Yay dengesinden: T = M / (dL/dθ)']
    ], ['l', 'c', 'l']);

  var dPivot = Math.sqrt(Math.pow(pX - G.pivot[0], 2) + Math.pow(pY - G.pivot[1], 2));
  h += _gfTablo('Türeyen değerler ↔ tedarikçi raporu',
    ['Büyüklük', 'MFSim', 'Tedarikçi raporu', 'Fark'],
    [
      ['Kayış efektif boyu', _gfFs(b.beltLengthMm, 2) + ' mm', _gfFs(G.belt, 1) + ' mm',
        _gfSapma(b.beltLengthMm, G.belt)],
      ['Tasarım gerginliği', _gfFs(b.springTensionN, 2) + ' N', _gfFs(G.design, 0) + ' N',
        _gfSapma(b.springTensionN, G.design)],
      ['Serbest kol açısı', _gfFs(b.freeAngleDeg, 2) + '°', _gfFs(G.freeAbsDeg, 1) + '°',
        _gfFs(Math.abs(b.freeAngleDeg - G.freeAbsDeg), 2) + '°'],
      // Bu satır 14.1'deki kutunun SAYISAL kapanışı: girilen nokta gerçekten
      // avara merkezi olarak kullanılıyorsa, ondan türeyen montaj konumu
      // raporun KENDİ Tensioner Data satırına oturmalı. Oturuyor.
      ['Gövdenin montaj konumu', _gfFs(pX, 2) + ' / ' + _gfFs(pY, 2) + ' mm',
        _gfFs(G.pivot[0], 2) + ' / ' + _gfFs(G.pivot[1], 2) + ' mm',
        _gfFs(dPivot, 3) + ' mm']
    ], ['l', '', '', 'c']);

  h += _gfOnay('İki bağımsız doğrulama',
      '<strong>Bir:</strong> kayış verisi girilmeden tedarikçinin kendi kayışı geri bulunur: '
    + 'kolun oturduğu yer yalnız yay künyesinden türer (M<sub>çalışma</sub>, M<sub>ön</sub>, '
    + 'k).<br><br>'
    + '<strong>İki:</strong> avara merkezi, kol boyu ve kol açısından türetilen <em>montaj '
    + 'konumu</em> raporun <em>Tensioner Data → Pivot Point</em> satırından <strong>'
    + _gfFs(dPivot, 3) + ' mm</strong> uzaktadır; o satır modele girmez. Fark basım '
    + 'yuvarlaması düzeyindedir: girilen nokta <strong>avara kasnağının merkezidir</strong>.');

  h += _gfNot('Kol çalışma açısı bir girdidir',
      'Avara merkezi verildikten sonra kayış yolu tamamen belirlidir: teğet noktaları, '
    + 'sarımlar ve efektif boy kolun saatinden <em>bağımsızdır</em>. Geriye kalan tek '
    + 'serbestlik derecesi gövdenin montajdaki saat konumudur ve o bir '
    + '<strong>paketleme</strong> kararıdır — motor bloğunda cıvata deliğinin nereye '
    + 'açıldığı. Açının varsayılanı yoktur.');

  // ── 14.3 Şema ────────────────────────────────────────────────────────────
  var svg = null;
  try {
    if(typeof veFeadLayoutSVG === 'function')
      svg = veFeadLayoutSVG(b, 820, 380, { posMode:'mean', compass:true, pivot:true, arrows:true });
  } catch(e){ svg = null; }
  if(svg){
    h += '<h3>14.3 Çözülmüş kayış yolu</h3>';
    h += '<figure class="appfig">' + svg + '<figcaption><b>Şekil ' + _gfFig() + ' —</b> '
      + 'Kayış Yolu kartındaki şema. Kasnak çemberleri girilen konum ve çaplardan, kayış yolu '
      + 'çözücünün teğet noktaları ve işaretli sarım yaylarından çizilir. Yol üstündeki dişler '
      + 'kayışın kaburgalı yüzünü gösterir; yeşil artı gerginin montaj konumu, kesikli çizgi '
      + 'koldur.</figcaption></figure>';
  }

  // ── 14.4 Geometri ────────────────────────────────────────────────────────
  var geom = null;
  try { geom = FEADCore.tensionerState(b.sys, FEADCore.meanRel(b.sys)).geom; }
  catch(e){ geom = null; }
  if(geom){
    h += '<h3>14.4 Geometri</h3>';
    h += '<p>Kayış Yolu panelindeki geometri tablosu. Sağdaki iki sütun tedarikçi raporunun '
      + 'kendi değerleridir.</p>';
    var gsat = geom.names.map(function(nm, i){
      return [
        _gfE(nm),
        _gfFs(geom.wrapDeg(i), 1),
        _gfFs(G.wrap[i], 1),
        _gfFs(geom.exitSpanLen(i), 1),
        _gfFs(G.span[i], 1),
        _gfFs(FEADCore.speedRatio(b.sys, i), 3)
      ];
    });
    h += _gfTablo('Sarım açıları ve açıklık boyları',
      ['Kasnak', 'Sarım [°]', 'Rapor', 'Açıklık [mm]', 'Rapor', 'Hız oranı'],
      gsat, ['l', '', '', '', '', '']);
    h += _gfNot('İki farklı uzunluk',
        'Kayışın <strong>kendi efektif boyu</strong> ' + _gfFs(b.beltLengthMm, 2) + ' mm; '
      + 'kayışın bu güzergâhta kat ettiği <strong>efektif tahrik boyu</strong> ise '
      + _gfFs(geom.LeffMm, 1) + ' mm. Aradaki fark kayış penceresinin Tasarım bölümündeki <em>boy ofsetidir</em> '
      + '(bu örnekte ' + _gfF(O.cozucu.data.lengthOffsetMm, 2) + ' mm). Rapor ikisini ayrı '
      + 'adlandırır.<br><br>'
      + 'Σ işaretli sarım <strong>' + _gfFs(geom.signedWrapDeg, 2) + '°</strong> — çevrim '
      + 'kapalı. Bu sayı 360 değilse geometri geçersizdir ve kartın rozeti ✗ yazar.');
  }

  // ── 14.5 Çözüm ───────────────────────────────────────────────────────────
  if(R && R.ok && R.analysis && R.analysis.duty && R.analysis.duty.length){
    var d0 = R.analysis.duty[0];
    var isim = R.pulleyNames || b.names || [];
    h += '<h3>14.5 Çalışma çevrimi ve çözüm</h3>';
    h += '<p>Çalışma çevrimi tablosuna ' + R.analysis.duty.length + ' devir noktası girildi ve '
      + '<strong>▶ Hesapla</strong>’ya basıldı. Aşağıda ilk devir noktasının sonuçları var; '
      + 'panelde bütün noktalar tek tabloda görünür.</p>';
    var ssat = isim.map(function(nm, i){
      var p = d0.perPulley[i] || {}, hb = d0.hubloads[i] || {}, sl = d0.slip[i] || {};
      return [
        _gfE(nm),
        _gfFs(p.exitTensionN, 0), _gfFs(G.T880[i], 0),
        _gfFs(hb.FN, 0), _gfFs(G.H880[i], 0),
        _gfFs(sl.tensionRatio, 4),
        _gfFs(sl.SF, 2)
      ];
    });
    h += _gfTablo('Çıkış gerilmeleri, hubload ve kayma emniyeti — ' + d0.engineRpm + ' rpm',
      ['Kasnak', 'Gerilme [N]', 'Rapor', 'Hubload [N]', 'Rapor', 'Oran (en kötü koşul)', 'SF'],
      ssat, ['l', '', '', '', '', '', '']);

    // Kayma emniyeti hükmü — YÜK TAŞIYAN ayrımıyla. Bu, kılavuzun §11.4'te
    // anlattığı okuma kuralının sayısal karşılığı; ayrım yapılmasaydı belge
    // kendi tavsiyesiyle çelişirdi.
    var esik = (typeof VE_FEAD_SLIP_LOADED_RATIO === 'number') ? VE_FEAD_SLIP_LOADED_RATIO : 1.01;
    var yuklu = [], hepsi = [];
    d0.slip.forEach(function(s, i){
      hepsi.push({ ad: isim[i], SF: s.SF, oran: s.tensionRatio });
      if((typeof veFeadSlipYukTasir === 'function') ? veFeadSlipYukTasir(s) : s.tensionRatio > esik)
        yuklu.push({ ad: isim[i], SF: s.SF, oran: s.tensionRatio });
    });
    function enKucuk(liste){
      var b0 = null;
      liste.forEach(function(x){ if(!b0 || x.SF < b0.SF) b0 = x; });
      return b0;
    }
    var gEn = enKucuk(hepsi), yEn = enKucuk(yuklu);
    // Satırlar TASARIM yükünde (servis faktörü c₂, kural 48): hüküm SF ≥ 1.
    var svG = (R && R.servis) || { deger: 1, kaynak: 'yok' };
    var c2G = (svG.kaynak !== 'yok' && typeof veFeadServisYaz === 'function')
      ? ' tasarım yükünde (c<sub>2</sub> = ' + veFeadServisYaz(svG.deger) + ')' : '';
    if(gEn && yEn){
      h += _gfUyari('Tablonun en küçük sayısı hükmü vermez',
          (gEn.ad !== yEn.ad
            ? 'Ham en küçük emniyet faktörü <strong>' + _gfFs(gEn.SF, 2) + '</strong> ve '
              + '<strong>' + _gfE(gEn.ad) + '</strong> kasnağına ait. Ama o kasnağın '
              + 'gerginlik oranı <strong>' + _gfFs(gEn.oran, 4) + '</strong>, yani ~1: kayıştan '
              + 'güç çekmiyor, talebi yalnız atalet ve yatak sürtünmesi; hükme girmez.<br><br>'
            : '')
        + 'Yük taşıyan kasnakların en küçüğü <strong>' + _gfFs(yEn.SF, 2) + '</strong> '
        + '(<strong>' + _gfE(yEn.ad) + '</strong>, oran ' + _gfFs(yEn.oran, 4) + ') ve' + c2G
        + ' SF ≥ 1 şartını <strong>' + (yEn.SF >= 1 ? 'karşılıyor' : 'karşılamıyor')
        + '</strong>. Rapor hükmünü bu sayıdan verir.');
    }

    var ek = [];
    if(R.torsional && Number.isFinite(R.torsional.firstElasticHz))
      ek.push(['Burulma — 1. elastik mod', _gfFs(R.torsional.firstElasticHz, 2) + ' Hz',
        'Rapor ' + _gfFs(G.NF, 2) + ' Hz — sapma ' + _gfSapma(R.torsional.firstElasticHz, G.NF)]);
    if(R.tensionerSide)
      ek.push(['Gergi hangi tarafta',
        R.tensionerSide.ok ? '<span class="ok">gevşek ✓</span>' : 'gergin ✗',
        R.tensionerSide.ok ? 'Doğru yerleşim' : 'Dönüş yönünü çevirin']);
    ek.push(['Kayış hızı', _gfFs(d0.vMs, 2) + ' m/s', d0.engineRpm + ' rpm’de']);
    ek.push(['Ateşleme frekansı', _gfFs(d0.firingHz, 1) + ' Hz',
      'Silindir sayısından; açıklık rezonans kontrolünde kullanılır']);
    if(Array.isArray(R.beltDataOff) && R.beltDataOff.length)
      ek.push(['Üretilmeyen çıktılar', _gfE(R.beltDataOff.join(' · ')),
        'Kayış tipine bağlı çıktılar anahtarı <strong>kapalı</strong> (Bölüm 8.4)']);
    // 'Değer' sütunu yalnız sayı taşımıyor: kapatılan çıktıların listesi de
    // buraya giriyor ve nowrap bir `td.c`'de tabloyu taşırıyordu.
    h += _gfTablo('Diğer sonuçlar', ['Büyüklük', 'Değer', 'Not'], ek, ['l', 'l', 'l']);
  }

  // ── 14.6 Katalog ─────────────────────────────────────────────────────────
  if(typeof veFeadBeltOptions === 'function'){
    var o = null;
    try { o = veFeadBeltOptions(b, { count: 3 }); } catch(e){ o = null; }
    if(o && o.ok){
      h += '<h3>14.6 Hangi kayışı ısmarlamalı</h3>';
      h += '<p>Gereken boy <strong>' + _gfFs(o.targetMm, 2) + ' mm</strong>. Kayış panelinin '
        + 'katalog kartı, aday boyların her biri için kolun oturacağı açıyı ve çıkacak '
        + 'gerginliği hesaplar:</p>';
      var liste = o.stock.slice();
      if(o.grid && !liste.some(function(x){ return x.lengthMm === o.grid.lengthMm; }))
        liste.push(o.grid);
      liste.sort(function(x, y){ return x.lengthMm - y.lengthMm; });
      var ksat = liste.map(function(c){
        var f = c.fit || {};
        var sigar = !!(f.ok && f.fits);
        return [
          _gfF(c.lengthMm, 0),
          (c.deltaMm >= 0 ? '+' : '−') + _gfFs(Math.abs(c.deltaMm), 1),
          _gfE(c.code),
          (c.kind === 'grid') ? '◇ ızgara' : 'stok',
          sigar ? _gfFs(f.relDeg, 2) + '°' : '<em>sığmıyor</em>',
          sigar ? _gfFs(f.tensionN, 0) + ' N' : '—'
        ];
      });
      h += _gfTablo('Katalog adayları', ['Boy [mm]', 'Δ [mm]', 'Kod', 'Küme', 'Kol açısı',
        'Gerginlik'], ksat, ['', '', 'c', 'c', '', '']);
      h += _gfNot('Üç bağımsız yol tek noktada buluşuyor',
          'Çözüm geometriden bir boy verir, katalog o boya en yakın adayı sunar; bu aday '
        + 'tedarikçinin sisteme taktığı kayıştır.');
    }
  }

  h += '<h3>14.7 Örneği programda kurmak</h3>';
  h += _gfAdimlar([
    'FEAD modülünde <strong>Başlangıç Sihirbazı</strong>nı açın.',
    'Birinci adımda <code>AG00976_GATES_2025</code> örneğini seçin ve son adımda '
      + '<strong>modeli kurun</strong>.',
    'Kayış Tablosu’nda gerginin <strong>adına tıklayarak</strong> panelini açın. '
      + '<strong>Avara kasnağının merkezi</strong> kartında '
      + '−161,97 / 91,29 yazdığını doğrulayın — örnek bu değeri raporun <em>Layout Data</em> '
      + 'tablosundan taşır.',
    '<strong>Kol künyesi</strong> kartının altındaki türeyen montaj konumunun '
      + '−250,00 / 110,00 çıktığını doğrulayın: raporun <em>Tensioner Data → Pivot Point</em> '
      + 'satırı budur ve modele girmez.',
    'FEAD araçları penceresinde <strong>Hesapla</strong>’ya basın ve yukarıdaki sayıları '
      + 'karşılaştırın.'
  ]);
  return h;
}

function _gfEkA(){
  var h = _gfH2(14);
  h += '<p>Panel adları programdaki başlıklarla birebir aynıdır.</p>';
  h += '<p>Kasnak ve gergi panelleri <strong>Kayış Tablosu’ndaki ada tıklanarak</strong> '
    + 'açılır (motor, tahrik ve çevrim <strong>sürücü</strong> kasnağın penceresinde); Kayış '
    + 'Özellikleri çizimdeki <strong>kayışa tıklanarak</strong>; Çözücü ve Rapor '
    + 'pencereleri <strong>FEAD araçları</strong> penceresinden (<em>Ayarlar</em> · '
    + '<em>Künye</em>).</p>';
  h += _gfTablo('Alan → panel eşlemesi',
    ['Alan', 'Panel', 'Kart'],
    [
      ['<strong>Kasnak eklemek / silmek</strong>', 'Kayış Tablosu',
        '＋ Kasnak ekle · satır ✕'],
      ['<strong>Kasnak konumu (X · Y) ve dış çapı</strong>', 'Kayış Tablosu',
        'X · Y · D sütunları (kasnak panelinde de var)'],
      ['<strong>Kayış sırası</strong>', 'Kayış Tablosu', '# sütunundaki ↑ ↓ okları'],
      ['<strong>Kasnak dönüş yönü</strong>', 'Kayış Tablosu', 'Kasnak Dönüş Yönü sütunu'],
      ['Efektif Çap · sarım açısı · span · Σsarım', 'Kayış Tablosu',
        'Türeyen sütunlar; Σsarım Kayış Yolu kartının rozetinde'],
      ['Temas tarafı (ayrıntı) ve kasnak geometrisi', 'Kasnak',
        'Temas tarafı · Kasnak geometrisi'],
      ['Sürücü kasnak seçimi · atalet', 'Kasnak', 'Rol'],
      ['<strong>Aksesuar modeli</strong> ve güç eğrisi', 'Kasnak', 'Katalog modeli · Güç eğrisi'],
      ['<strong>Aksesuar devir sınırları (optimum · sürekli · anlık)</strong>', 'Kasnak',
        'Devir sınırları'],
      ['Gergi avarasının merkezi', 'Gergi', 'Avara kasnağının merkezi'],
      ['Kol boyu · kol çalışma açısı · türeyen montaj konumu', 'Gergi', 'Kol künyesi'],
      ['Yay ön yükü, katsayısı, çalışma momenti', 'Gergi', 'Yay künyesi'],
      ['Hazır gergi künyeleri', 'Gergi', 'Gergi künye kütüphanesi'],
      ['Serbest kol açısı · gereken kayış boyu · tasarım gerginliği · konum pimi',
        'Gergi', 'Avara hareketi'],
      ['Gergi kasnak kütlesi, kol ataleti, load stop', 'Gergi', 'Mekanik sınır ve atalet'],
      ['Kayış profili ve markası', 'Kayış Özellikleri', 'Profil ve marka'],
      ['Kanal sayısı, tolerans, aşınma payı', 'Kayış Özellikleri', 'Künye'],
      ['Kayış boyu kipi', 'Kayış Özellikleri', 'Kayış boyu (ya da Kayış Tablosu başlığındaki anahtar)'],
      ['Katalog aday boyları', 'Kayış Özellikleri', 'Katalog'],
      ['<strong>Kaburga başına kütle</strong>', 'Kayış Özellikleri', 'Malzeme'],
      ['Kayış tipine bağlı çıktılar anahtarı', 'Kayış Özellikleri',
        'Kayış tipine bağlı çıktılar'],
      ['FEAD tahrik düzeni / krank ve kademe çapı', 'Kasnak', 'FEAD tahriki'],
      ['Silindir sayısı, ivme, <strong>motor kataloğu</strong>',
        'Kasnak', 'Motor'],
      ['Motorun rölanti · governed · overspeed devri', 'Kasnak', 'Devir sınırları'],
      ['<strong>Motorun tam yük eğrisi</strong> ve FEAD’in payı', 'Kasnak', 'Güç eğrisi'],
      ['Devir, %zaman, sıcaklık, aksesuar kW, <strong>çevrim kaydı</strong>',
        'Kasnak', 'Çalışma çevrimi'],
      ['Yorulma modeli ve boy ofseti', 'Kayış Özellikleri', 'Tasarım'],
      ['<strong>Servis faktörü c<sub>2</sub></strong> (yük katsayısı tablosu)', 'Kayış Özellikleri', 'Tasarım'],
      ['<strong>Çözümün aşamaları ve sayısal yöntemleri</strong>', 'Çözücü', 'Çözüm zinciri'],
      ['Türeyen tasarım gerginliği', 'Çözücü', 'Algılanan model'],
      ['Gergi kol konumları (altı konum)', 'Çözücü', 'Gergi konum tablosu'],
      ['<strong>Merkez mesafesi · çevrim oranı · devir sınırı hükmü</strong>', 'Çözücü',
        'Uygunluk kriterleri'],
      ['Sarım, açıklık, hız oranı', 'Kayış Yolu', 'Geometri'],
      ['Gergi kol konumu seçici, yön gülü', 'Kayış Yolu', 'Şema'],
      ['<strong>Katman seçimi ve ön ayar (Geometri / İşletme)</strong>',
        'Kayış Yolu', 'Katmanlar'],
      ['Devir ve titreşim seçicisi, gerilme haritası, senaryo',
        'Kayış Yolu', 'Şema — İşletme ön ayarında'],
      ['<strong>Hesaplamak · raporu indirmek · rapor türü</strong>', 'FEAD araçları',
        'Çözüm · Rapor'],
      ['Doküman künyesi', 'Rapor', 'Künye'],
      ['Çevrimin dönüş yönünü çevirmek', 'FEAD araçları', 'Yön']
    ], ['l', 'c', 'l']);
  return h;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BELGE MONTAJI
// ═══════════════════════════════════════════════════════════════════════════

function veGuideFeadHTML(){
  _gfTblNo = 0; _gfFigNo = 0;
  _gfSahnePack = null;
  if(typeof veGuideSceneReset === 'function') veGuideSceneReset();

  var tarih = new Date().toLocaleDateString('tr-TR',
    { year: 'numeric', month: 'long', day: 'numeric' });

  var govde = veGuideAntet({
    eyebrow: 'MFSim · FEAD modülü · Kullanım kılavuzu',
    h1: 'FEAD Modelleme Kılavuzu',
    sub: 'Kasnak yerleşiminden rapora: adım adım modelleme, girdi haritası, '
       + 'sonuçların okunması ve işlenmiş örnek',
    fields: [
      ['Belge', 'Kullanım kılavuzu'],
      ['Modül', 'FEAD — kayış-kasnak'],
      ['Kapsam', VE_GUIDE_FEAD_SECTIONS.length + ' bölüm'],
      ['Örnek', 'canlı hesaplanır'],
      ['Tarih', tarih]
    ]
  });

  govde += veGuideToc(VE_GUIDE_FEAD_SECTIONS);

  govde += _gfSec1() + _gfSec2() + _gfSec3() + _gfSec4() + _gfSec5() + _gfSec6()
         + _gfSec7() + _gfSec8() + _gfSec9() + _gfSec10() + _gfSec11() + _gfSec12()
         + _gfSec13() + _gfSec14() + _gfEkA();

  // SAHNE CSS'İ SAHNE VARSA EKLENİR. Hiç sahne çizilmediyse (üreticiler
  // yüklü değil) uygulamanın kurallarını belgeye koymanın karşılığı yok.
  var sahneCss = '';
  if(govde.indexOf('gk-sahne') >= 0 && typeof veGuideSceneCSS === 'function'){
    // Sahne çizildi ama kuralları sökülemiyorsa SESSİZ KALINMAZ: kutu biçimsiz
    // bir yığın gibi görünür ve kullanıcı olmayan bir arayüz görür.
    sahneCss = veGuideSceneCSS();
  }

  return veGuideDocHTML({
    title: 'MFSim — FEAD modelleme kılavuzu',
    body: govde,
    extraCss: sahneCss
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_GUIDE_FEAD_SECTIONS: VE_GUIDE_FEAD_SECTIONS,
    VE_GUIDE_FEAD_GATES: VE_GUIDE_FEAD_GATES,
    _gfOrnekCoz: _gfOrnekCoz, _gfSapma: _gfSapma,
    _gfSeritOgesi: _gfSeritOgesi, _gfSahneHTML: _gfSahneHTML,
    _gfSeritEtkin: _gfSeritEtkin,
    _gfSahneTablo: _gfSahneTablo, _gfSahneKasnakPaneli: _gfSahneKasnakPaneli,
    _gfSahneKapilar: _gfSahneKapilar, _gfSahneSerit: _gfSahneSerit,
    _gfSahneSema: _gfSahneSema, _gfSahneCalisma: _gfSahneCalisma,
    _gfSahneKatman: _gfSahneKatman, _gfSahneDevirSinir: _gfSahneDevirSinir,
    _gfSahneGergiMerkez: _gfSahneGergiMerkez, _gfSahneGergiKol: _gfSahneGergiKol,
    _gfSahneGergiHareket: _gfSahneGergiHareket,
    _gfSahneKayisKunye: _gfSahneKayisKunye, _gfSahneKayisKatalog: _gfSahneKayisKatalog,
    _gfSahneAlgilanan: _gfSahneAlgilanan, _gfSahneCevrim: _gfSahneCevrim,
    _gfSahneRapor: _gfSahneRapor, _gfSahneSonucKart: _gfSahneSonucKart,
    _gfSahneAraclar: _gfSahneAraclar,
    veGuideFeadHTML: veGuideFeadHTML
  };
}
