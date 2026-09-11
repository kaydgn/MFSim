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
    'Şeritteki <b>Otomatik Düzenle</b> düğmesi. Bu bir ekran görüntüsü değil — '
    + 'düğmenin kendisi, programın kendi üreticisinden ve kendi renkleriyle '
    + 'çizildi; ikonu ya da adı değişirse bu resim <b>kendiliğinden</b> değişir.');
}

function _gfSahneTablo(){
  var html = _gfSahneHTML(function(){
    if(typeof veFeadTableCardHTML !== 'function') return '';
    return veFeadTableCardHTML({ id: 'gk-tbl', type: 'fead-table', data: {} });
  });
  if(!html) return '';
  // Doğal genişlik ÜRETİLEN HTML'den okunuyor (guide-kit.js
  // `_gkNaturalWidth`); burada bir ölçü yazılmıyor.
  return veGuideScene(html,
    'Kayış Tablosu, <b>Bölüm 14’ün örnek modeliyle</b> doldurulmuş hâlde. '
    + 'Türeyen sütunlar gerçek çözümden geliyor: Σsarım <b>360,00°</b> okuması '
    + 'kayış yolunun kapandığını söylüyor. Sütun bir gün yeniden adlandırılırsa '
    + 'bu şekil onunla birlikte değişir.');
}

function _gfSahneKasnakPaneli(){
  var html = _gfSahneHTML(function(O){
    if(typeof getFeadPulleyPropertiesHTML !== 'function') return '';
    var n = _gfSahneKasnak(O, 'fead-alternator') || _gfSahneKasnak(O, 'fead-ac');
    return n ? getFeadPulleyPropertiesHTML(n) : '';
  });
  if(!html) return '';
  return veGuideScene(html,
    'Bir <b>aksesuar</b> kasnağının paneli (alternatör). Tablodaki ada tıklayınca '
    + 'açılan yüzey budur. <b>Katalog Modeli</b> ve <b>Devir Sınırları</b> kartları '
    + 'yalnız aksesuar tiplerinde çizilir — sürücü ya da avara kasnağında yoktur.');
}

// Tuval kartları — ikisi de AYNI çiziciden (`veFeadLayoutCardHTML`), tipe
// göre farklı opts. Kılavuz ikisini de gösterir çünkü bölünmenin sebebi
// ölçü değil SORU: biri model kurulurken, öteki devir seçilince sorulur.
function _gfSahneKart(tip){
  return _gfSahneHTML(function(O){
    if(typeof veFeadLayoutCardHTML !== 'function') return '';
    var n = null;
    O.pack.nodes.forEach(function(x){ if(x.type === tip && !n) n = x; });
    return n ? veFeadLayoutCardHTML(n) : '';
  });
}

function _gfSahneSema(){
  var html = _gfSahneKart('fead-layout');
  if(!html) return '';
  return veGuideScene(html,
    'Kayış Yolu kartı — <b>ölçekli ve donuk</b> şema. Turuncu yol çözücünün teğet '
    + 'noktalarından geçiyor, dişler kayışın kaburgalı yüzünü gösteriyor, yeşil artı '
    + 'gerginin <b>türetilmiş</b> montaj konumu. Alt şeritteki tek seçici kol konumudur.');
}

function _gfSahneCalisma(){
  var html = _gfSahneKart('fead-run');
  if(!html) return '';
  return veGuideScene(html,
    'Çalışma Noktası kartı — aynı çizim, <b>işletme</b> katmanıyla: açıklık gerilmeleri, '
    + 'gerilme haritası ve titreşim. İki seçicisi var (devir ve titreşim) ve kayış '
    + '<b>akar</b>; Kayış Yolu kartı bunların hiçbirini yapmaz.');
}

function _gfSahnePanel(fn, altyazi, coz){
  var html = _gfSahneHTML(function(O){
    if(typeof window[fn] !== 'function') return '';
    var tip = { getFeadTensionerPropertiesHTML: 'fead-tensioner',
                getFeadBeltPropertiesHTML: 'fead-belt',
                getFeadSolverPropertiesHTML: 'fead-solver',
                getFeadReportPropertiesHTML: 'fead-report',
                getFeadSpinPropertiesHTML: 'fead-spin' }[fn];
    var n = null;
    O.pack.nodes.forEach(function(x){ if(x.type === tip && !n) n = x; });
    if(!n && tip === 'fead-spin') n = { id: 'gk-spin', type: 'fead-spin', data: {} };
    return n ? window[fn](n) : '';
  }, coz);
  return html ? veGuideScene(html, altyazi) : '';
}

function _gfSahneSpin(){
  return _gfSahnePanel('getFeadSpinPropertiesHTML',
    'Dönüş Yönü kartının paneli. Rozet çevrimin yönünü çevirir; <b>rengi</b> gerginin '
    + 'gevşek tarafta olup olmadığının hükmünü taşır.');
}

function _gfSahneGergi(){
  return _gfSahnePanel('getFeadTensionerPropertiesHTML',
    'Gergi paneli, örnek modelin künyesiyle. <b>Avara Kasnağının Merkezi</b> programın '
    + 'sorduğu tek konum girdisi; <b>Kol Künyesi</b> kartının altındaki türeyen montaj '
    + 'konumu §7.1’in denetim sayısıdır.');
}

function _gfSahneKayis(){
  return _gfSahnePanel('getFeadBeltPropertiesHTML',
    'Kayış Özellikleri paneli. <b>Kayış Boyu</b> kartı kipi yazıyor (avara merkezi '
    + 'girdiyken SERBEST ve kilitli), <b>Katalog</b> kartı da gereken boya en yakın '
    + 'adayları kolun oturacağı açı ve çıkacak gerginlikle birlikte listeliyor.');
}

function _gfSahneCozucu(){
  return _gfSahnePanel('getFeadSolverPropertiesHTML',
    'Çözücü paneli. <b>Algılanan Model</b> tablosu modelin tamam olup olmadığını satır '
    + 'satır yazıyor; <b>▶ Hesapla</b> ancak o tablo temizken ve en az bir devir noktası '
    + 'girildiğinde etkinleşir.');
}

function _gfSahneRapor(){
  return _gfSahnePanel('getFeadReportPropertiesHTML',
    'Rapor paneli. Doküman künyesi alanları antete ve belgenin sonundaki notlara akar; '
    + 'rapor <b>çözülmüş</b> modelden üretilir, model çözülmemişse düğme pasiftir ve '
    + 'sebebi yazılır.', true);
}

function _gfSahneKapilar(){
  var html = _gfSahneHTML(function(O){
    if(typeof veFeadChecksCard !== 'function') return '';
    return veFeadChecksCard(O.cozucu, O.build);
  });
  if(!html) return '';
  return veGuideScene(html,
    'Uygunluk Kapıları kartı, örnek model üzerinde <b>canlı ölçülmüş</b> hâlde. '
    + 'Rozetler üç kuralın o modeldeki hükmünü taşıyor; “değerlendirilemedi” '
    + 'satırları o kasnakta devir sınırı girilmediği için öyle.');
}

// ── BÖLÜM KİMLİKLERİ — içindekiler ve başlıklar TEK KAYNAKTAN ──────────────
// Raporun kendi kuralı: iki yerde yazılsa biri kayardı.
var VE_GUIDE_FEAD_SECTIONS = [
  ['g1',  '1',    'Bu Kılavuz Nasıl Kullanılır'],
  ['g2',  '2',    'Modülün Haritası'],
  ['g3',  '3',    'Modüle Girmek'],
  ['g4',  '4',    'Kayış Tablosu — Kasnakları Girmek'],
  ['g5',  '5',    'Kayış Sırası ve Dönüş Yönü'],
  ['g6',  '6',    'Kasnak Künyelerini Girmek'],
  ['g7',  '7',    'Otomatik Gergiyi Tanımlamak'],
  ['g8',  '8',    'Kayış Künyesi ve Katalog'],
  ['g9',  '9',    'Çalışma Çevrimi ve Motor Künyesi'],
  ['g10', '10',   'Modeli Çözmek'],
  ['g11', '11',   'Sonuçları Okumak'],
  ['g12', '12',   'Rapor Üretmek'],
  ['g13', '13',   'Sık Yapılan Hatalar'],
  ['g14', '14',   'Sayısal Örnek: Sıfırdan Bir FEAD Modeli'],
  ['gEk', 'Ek A', 'Alan → Panel Hızlı Başvurusu']
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
  h += '<p>Bu belge, MFSim’in <strong>FEAD</strong> (Front End Accessory Drive — ön uç '
    + 'aksesuar kayış tahriki) modülünü kullanarak bir serpantin kayış sistemini modelleme '
    + 'işini <strong>adım adım</strong> anlatır. Bölümler programda izleyeceğiniz sırayla '
    + 'dizilmiştir: baştan sona okuyup uygularsanız çalışan bir modeliniz olur.</p>';
  h += '<p>Her bölüm aynı düzendedir: önce <em>ne yapacağınız</em> numaralı adımlarla, sonra '
    + '<em>hangi alana ne yazacağınız</em> bir tabloyla, en sonda da o adımda sessizce yanlış '
    + 'gidebilecek şeyler bir uyarı kutusuyla verilir. Uyarı kutularını atlamayın: bu modülde '
    + 'yanlış girilen bir alan çoğu zaman <strong>hata vermez</strong> — model yine çözülür, '
    + 'tablolar yine dolar, yalnızca sayılar başkadır.</p>';
  h += '<p><strong>Bölüm 14</strong> bütün kılavuzu tek bir örnek üzerinde tekrarlar: boş bir '
    + 'tuvalden başlayıp gerçek bir aracın FEAD sistemini kurar ve çıkan sayıları kayış '
    + 'tedarikçisinin kendi raporuyla karşılaştırır. Aceleniz varsa önce oraya bakın, sonra '
    + 'ilgili bölüme dönün.</p>';
  h += _gfNot('Bu belgedeki sayılar ölçülmüştür',
      'Bölüm 14’teki bütün değerler, belge üretilirken programın <strong>gerçek hesap '
    + 'zinciri</strong> koşturularak hesaplanır — kılavuza elle yazılmış tek bir sonuç yoktur. '
    + 'Çekirdek bir gün değişirse bu belgedeki sayılar da onunla değişir; kılavuz yapısal '
    + 'olarak bayatlayamaz. Örnek <strong>bellekte</strong> kurulur, açık olan projenize '
    + 'dokunmaz.');
  h += '<p>Bu belgeye programın içinden istediğiniz zaman dönebilirsiniz: şeritteki '
    + _gfBtn('veGuideKitOpen')
    + ' düğmesi bütün modül kılavuzlarını listeler, açar ve indirir.</p>';
  h += '<h3>1.1 Kim için</h3>';
  h += '<p>Kayış tahrik yerleşimi yapan, tedarikçiye gönderilecek bilgi sayfasını hazırlayan '
    + 'ya da tedarikçiden dönen raporu doğrulamak isteyen makine mühendisi için yazıldı. '
    + 'Kayış–kasnak teorisini bilmek gerekmez; gereken teori, üretilen '
    + '<strong>Detaylı FEAD raporunun</strong> 1–7. bölümlerinde ayrıca anlatılır.</p>';
  h += '<h3>1.2 Ne kadar sürer</h3>';
  h += '<p>Elinizde kasnak koordinatları, çaplar ve gergi künyesi varsa altı kasnaklı bir '
    + 'sistem <strong>15–20 dakikada</strong> kurulur. Hazır bir örnekten başlarsanız '
    + '(Bölüm 3.2) bir dakikada çözülmüş bir model elde eder, üzerinde değişiklik yaparak '
    + 'öğrenirsiniz — ilk kez kullanıyorsanız önerilen yol budur.</p>';
  return h;
}

function _gfSec2(){
  var h = _gfH2(1);
  h += '<p>FEAD modülünde <strong>beş çalışma yüzeyi</strong> vardır. Hangi bilginin nerede '
    + 'durduğunu bilmek, kılavuzun geri kalanını takip etmeyi kolaylaştırır.</p>';
  h += _gfAlanTablo('Beş çalışma yüzeyi ve sorumlulukları', [
    ['<strong>Kayış Tablosu</strong>', 'Kasnakların <strong>veri giriş yüzeyi</strong>: ad · '
      + 'X · Y · çap · dönüş yönü girilir, efektif çap · sarım · span okunur. Kasnak eklemek, '
      + 'silmek ve <strong>kayış sırasını değiştirmek</strong> de buradan. '
      + '<strong>Kasnakların kanvasta kutusu yoktur</strong> — bu tablo onların yerine geçer.',
      'Bölüm 4 ve 5'],
    ['Paneller', 'Tablodaki <strong>ada tıklayınca</strong> açılan özellik pencereleri. '
      + 'Tablonun taşımadığı her şey (temas tarafı, güç eğrisi, gergi künyesi, kayış, çözücü) '
      + 'buradan girilir.', 'Bölüm 6–9'],
    ['Kayış Yolu kartı', 'Tuvalde duran, girdi değiştikçe <strong>canlı</strong> yeniden '
      + 'çizilen ölçekli şema. Modelin tutarlı olup olmadığını panel açmadan gösterir.',
      'Bölüm 11.1'],
    ['Tuval', 'Yalnız <strong>araç kartlarını</strong> taşır: Kayış Tablosu, Kayış Yolu '
      + 'şeması, Kayış Özellikleri, Çözücü, Rapor, Dönüş Yönü, sihirbaz ve örnekler. '
      + 'Kasnaklar burada <strong>görünmez</strong> — modelde düğüm olarak dururlar ama '
      + 'kutuları çizilmez.', 'Bölüm 3.4'],
    ['Rapor', 'Tek dosyalık, çevrimdışı açılan HTML belge. İki tür: Detaylı ve Özet.',
      'Bölüm 12']
  ], ['Yüzey', 'Ne taşır', 'Kılavuzda']);
  h += _gfNot('Kasnakların kutusu neden yok',
      'Bir dönem kasnaklar da kanvasta kutuydu ve aralarına kayış teli çekiliyordu. Bugün '
    + 'değil: kasnak sırası bir <em>graf</em> değil bir <strong>liste</strong> ve o liste '
    + 'Kayış Tablosu’nun satır sırasıdır. Koordinat, çap ve dönüş yönü tablodan girilir; '
    + 'tuval de böylece yalnız araç kartlarını taşıyan bir çalışma tezgâhına dönüşür. '
    + 'Elinizdeki tedarikçi bilgi sayfası zaten bir <em>tablodur</em> — program artık onu '
    + 'satır satır kopyalayabildiğiniz bir yüzey veriyor.');
  h += '<h3>2.1 Renk dili — mavi girdi, amber türeyen</h3>';
  h += '<p>Tuvaldeki rozetlerde ve panellerde renk anlam taşır ve kılavuz boyunca aynı '
    + 'anlamı korur:</p>';
  h += '<ul>'
    + '<li><strong>Mavi</strong> — bu bir <em>girdidir</em>, siz yazarsınız.</li>'
    + '<li><strong>Amber</strong> — bu bir <em>türeyen</em> değerdir, program hesaplar.</li>'
    + '<li><strong>Kırmızı</strong> — hesabı doğrudan bozan, hata vermeden yanlış sonuç '
    + 'üretebilecek alan.</li>'
    + '</ul>';
  h += '<h3>2.2 Neyi siz verirsiniz, neyi program hesaplar</h3>';
  h += '<p>Modülün son sürümünde girdi kümesi bilinçli olarak küçültüldü. Aynı bilgiyi iki '
    + 'ayrı yerden sormak (gergi kasnağının merkezi <em>ve</em> gövdenin montaj konumu; '
    + 'kayış boyu <em>ve</em> kol açısı; tasarım gerginliği <em>ve</em> yay künyesi) '
    + 'çeliştiğinde modeli sessizce yanlış çözüyordu. Bugün her büyüklüğün tek bir kaynağı '
    + 'var ve program hiçbirini bir diğeriyle karşılaştırmaz.</p>';
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
  ], ['Konu', 'Siz verirsiniz', 'Program hesaplar']);
  h += _gfNot('Gergide yön neden bu şekilde',
      'Gerginin avara kasnağı <strong>kayış yolunun üstündedir</strong>: teğet noktaları, '
    + 'sarım açıları ve efektif boy onun merkezinden çıkar. Gövdenin cıvatalandığı nokta ise '
    + 'kolun öbür ucudur ve geometriye hiç girmez. Bu yüzden program <strong>merkezi '
    + 'sorar</strong>, montaj konumunu <strong>türetir</strong> — diğer bütün kasnaklarla '
    + 'aynı alan, aynı tabloda, aynı sütunda. Kayış boyu da bu zincirin sonunda bir '
    + '<strong>sonuç</strong> olarak çıkar; tasarım aşamasında kayış henüz seçilmemiştir. '
    + 'Ayrıntısı ve denetimi Bölüm 7’de.');
  return h;
}

function _gfSec3(){
  var h = _gfH2(2);
  h += '<h3>3.1 Modülü açmak</h3>';
  h += _gfAdimlar([
    'Karşılama ekranında <strong>FEAD</strong> kartına tıklayın. Ana tuvale tek bir '
      + 'alt-sistem kutusu düşer.',
    'O kutuya <strong>çift tıklayın</strong>. Modülün iç topolojisi açılır; sol paletteki '
      + 'bileşen listesi FEAD bileşenlerine döner ve üstte bir gezinme çipi belirir.',
    'İç topolojiden çıkmak için aynı çipi ya da çerçevenin alt kenarındaki çıkış düğmesini '
      + 'kullanın. Çıkarken modeliniz alt-sistem kutusunun içine kaydedilir.'
  ]);
  h += '<p><strong>Boş bir FEAD modülü sizi Başlangıç Sihirbazı ile karşılar</strong> — '
    + 'pencere kendiliğinden açılır. Kapatırsanız tuvalde iki kart kalır: '
    + '<strong>Başlangıç Sihirbazı</strong> (yeniden açmak için) ve boş bir '
    + '<strong>Kayış Tablosu</strong>. Hangi yolu seçerseniz seçin kasnaklar sonunda '
    + '<strong>o tabloda</strong> görünür. Buradan üç yol ayrılır.</p>';
  h += _gfNot('Sihirbaz yalnız İLK girişte açılır',
      'Kurulmuş bir modele geri döndüğünüzde pencere <strong>açılmaz</strong>; her girişte '
    + 'kapatılması gereken bir karşılama, karşılama olmaktan çıkıp engele dönerdi. '
    + 'İstediğiniz zaman <strong>Başlangıç Sihirbazı</strong> kartına çift tıklayarak '
    + 'açabilirsiniz.');

  h += '<h3>3.2 Yol A — Başlangıç Sihirbazı <span class="chip">önerilen</span></h3>';
  h += '<p>Sihirbaz, bir modeli kurmak için gereken bütün girdileri <strong>doğru sırayla</strong> '
    + 'sorar ve her adımda modeli canlı doğrular. Boş bir iç topolojide “önce ne koyayım” '
    + 'sorusunu ortadan kaldırır.</p>';
  h += _gfAdimlar([
    'Modüle ilk girişte sihirbaz zaten açıktır; kapattıysanız '
      + '<strong>Başlangıç Sihirbazı</strong> kartına çift tıklayın.',
    'Adımları sırayla doldurun. Her adımın rozeti o adımda kalan eksik/uyarı sayısını '
      + 'gösterir, yani nereye dönmeniz gerektiğini okursunuz.',
    'Son adımda canlı çözümü ve kayış yolu şemasını görün, sonra <strong>modeli kurun</strong> '
      + '— sihirbaz kasnakları ve künyeleri iç topolojiye bir anda yazar. Kasnaklar '
      + '<strong>Kayış Tablosu’nda</strong> belirir; sihirbaz açılışta gelen tabloyu '
      + 'yeniden kullanır, ikincisini kurmaz.'
  ]);
  h += _gfAlanTablo('Sihirbaz adımları ↔ bu kılavuzun bölümleri', [
    ['1 · Başlangıç', 'Sistem adı · <strong>on bir hazır örnekten</strong> doldurma',
      'Bölüm 3.3'],
    ['2 · Kasnaklar', 'Tip · çap · koordinat · temas tarafı · sürücü · '
      + '<strong>kayış sırası</strong> (↑ ↓)', 'Bölüm 4, 5 ve 6'],
    ['3 · Otomatik Gergi', 'Avara merkezi · kol boyu · kol açısı · yay künyesi', 'Bölüm 7'],
    ['4 · Kayış', 'Profil · kanal sayısı · katalog sonuçları', 'Bölüm 8'],
    ['5 · Motor ve Çevrim', 'Tahrik oranı · motor künyesi · çalışma çevrimi', 'Bölüm 9'],
    ['6 · Özet ve Kurulum', 'Canlı çözüm · kayış yolu şeması · modeli kur', 'Bölüm 10 ve 11']
  ], ['Adım', 'Ne sorar', 'Ayrıntısı']);
  h += _gfNot('Ayrı bir “Kayış Yolu” adımı yok',
      'Bir dönem vardı ve serpantin sırasını orada diziyordunuz. Sıra artık '
    + '<strong>Kasnaklar tablosunun kendisi</strong> olduğu için ayrı bir adım aynı bilgiyi '
    + 'ikinci kez sormak olurdu; adım kaldırıldı, yeteneği (↑ ↓ ile satır taşıma) kasnak '
    + 'tablosuna taşındı. Programdaki Kayış Tablosu da aynı işi aynı biçimde yapar.');
  h += _gfNot('Sihirbaz ayrı bir model kurmaz',
      'Sorduğu her alan panellerdeki alanların ta kendisidir ve doğrulamayı da aynı çözücü '
    + 'yapar. Yani sihirbazda gördüğünüz uyarı, panelde göreceğinizin aynısıdır — kurulduktan '
    + 'sonra her şeyi panellerden düzenlemeye devam edersiniz.');

  h += '<h3>3.3 Yol B — hazır bir örnekten başlamak</h3>';
  h += '<p>Örnekler <strong>sihirbazın birinci adımındadır</strong>. Kendi verinizi '
    + 'girmeden önce bir örneği kurup gezmek, alanların hangi belgeden hangi sayıyı '
    + 'beklediğini görmenin en hızlı yolu.</p>';
  h += _gfAdimlar([
    'Sihirbazın <strong>1 · Başlangıç</strong> adımını açın.',
    '<strong>On bir kayıtlı sistem</strong> arasından birini seçin — hepsi gerçek araçlara '
      + 'ait ve hepsi tedarikçiden <em>dönen</em> Gates raporlarından çıkarılmıştır. Seçim '
      + 'bütün adımların alanlarını bir anda doldurur.',
    'Adımları gezip değerleri görün, sonra son adımda <strong>modeli kurun</strong>. '
      + 'Kasnaklar <strong>Kayış Tablosu’nda</strong> sırasıyla belirir.'
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
  h += _gfNot('Örnekler doğrulama çıpasıdır',
      'Her kayıt, sayıları geri üretilebilsin diye <strong>bir tedarikçi raporuna bağlıdır</strong>. '
    + 'Bir örneği kurup çözdüğünüzde çıkan gerginlik, hubload ve sarım değerleri o raporun '
    + 'kendi tablolarıyla karşılaştırılabilir — Bölüm 14 bunu <code>AG00976_GATES_2025</code> '
    + 'üzerinde uçtan uca yapıyor.');
  h += _gfUyari('Örnek eklenir, silmez',
      'Örnek yükleme mevcut kasnakların <strong>üzerine ekler</strong>: yeni kasnaklar kayış '
    + 'sırasının sonuna eklenir ve iki sistem tek bir çevrim gibi çözülmeye çalışılır. Temiz '
    + 'bir başlangıç için önce Kayış Tablosu’ndaki satırları ✕ ile boşaltın.');
  h += '<h3>3.4 Yol C — sıfırdan elle kurmak</h3>';
  h += '<p>İki ayrı ekleme yüzeyi var ve <strong>hangisini kullanacağınız eklediğiniz şeye '
    + 'bağlı</strong>:</p>';
  h += _gfAlanTablo('Ne nereden eklenir', [
    ['<strong>Kasnaklar</strong>', 'Kayış Tablosu’nun sağ üstündeki '
      + '<strong>＋ Kasnak ekle</strong> listesi',
      'Krank Kasnağı · Alternatör · Klima Kompresörü · Su Pompası · Direksiyon Pompası · '
      + 'Hava Kompresörü · Fan Kavraması · Avara Kasnak · Gergi'],
    ['<strong>Araç kartları</strong>', 'Sol palet, <em>FEAD Araçları</em> kategorisi',
      'Kayış Özellikleri · Kayış Yolu · <strong>Çalışma Noktası</strong> · Kayış Tablosu · '
      + 'Çözücü · Rapor · Başlangıç Sihirbazı · Dönüş Yönü']
  ], ['Ne', 'Nereden', 'İçindekiler']);
  h += _gfUyari('Kasnağı paletten sürüklemeyin',
      'Palette <em>FEAD Kasnakları</em> kategorisi hâlâ duruyor, ama oradan sürüklenen bir '
    + 'kasnak <strong>kanvasta hiçbir iz bırakmaz</strong>: kasnakların kutusu yok, dolayısıyla '
    + 'ekranda hiçbir şey olmamış gibi görünür. Kasnak eklemenin görünür tek yolu Kayış '
    + 'Tablosu’nun <strong>＋ Kasnak ekle</strong> listesidir; eklenen kasnak kayış sırasının '
    + '<strong>sonuna</strong> düşer ve tabloda hemen bir satır olarak belirir.');
  h += '<p>Bir modeli kurmak için en az şunlar gerekir: <strong>üç kasnak</strong> (biri sürücü, '
    + 'biri gergi), <strong>Kayış Tablosu</strong>, <strong>Kayış Özellikleri</strong> ve '
    + '<strong>Çözücü</strong>. Kayış Yolu şemasını ve Raporu istediğiniz zaman '
    + 'ekleyebilirsiniz.</p>';
  h += _gfNot('Araç kartlarını dizmek',
      'Tuvalde yalnız araç kartları durduğu için yerleşim bir <em>okunurluk</em> meselesidir, '
    + 'model değil. Şeritteki <strong>Otomatik Düzenle</strong> düğmesi onları dizer: Kayış '
    + 'Yolu şeması ile Kayış Tablosu sağa, künye kartları sola. Kasnaklar dizilmez — '
    + 'dizilecek bir kutuları yok.');
  h += _gfSahneSerit();
  return h;
}

function _gfSec4(){
  var h = _gfH2(3);
  h += '<p>Kasnakların bütün <strong>veri girişi</strong> Kayış Tablosu’ndan yapılır. Tablo '
    + 'tuvalde duran bir karttır ve iç topoloji açıldığında zaten oradadır; sizin hesap '
    + 'sayfanızla aynı sütun sırasını taşır, yani tedarikçi bilgi sayfasını satır satır '
    + 'kopyalayabilirsiniz.</p>';
  h += _gfUyari('Kasnakların kanvasta kutusu YOKTUR',
      'Bu modülde kasnaklar modelde <strong>düğüm olarak durur</strong> — kaydedilir, '
    + 'geri alınır, panelleri açılır — ama tuvale <strong>kutu çizilmez</strong>. Onları '
    + 'göreceğiniz yer bu tablodur; kayış yolunun resmini göreceğiniz yer ise Kayış Yolu '
    + 'şemasıdır. Paletten bir kasnak sürüklerseniz ekranda hiçbir şey olmaz — ekleme '
    + 'tablodan yapılır.');
  h += _gfAdimlar([
    'Tablonun sağ üstündeki <strong>＋ Kasnak ekle</strong> listesinden bir tip seçin. '
      + 'Kasnak kayış sırasının <strong>sonuna</strong> eklenir ve tabloda bir satır olur.',
    'Satırdaki <strong>X</strong>, <strong>Y</strong> ve <strong>D</strong> hücrelerine '
      + 'koordinat tablosundaki sayıları yazın. Hücreye tıklayıp yazmanız yeter; '
      + 'çıkınca model güncellenir.',
    '<strong>Kasnak Dönüş Yönü</strong> hücresinden Sağ / Sol seçin — bu, kayışın o kasnağa '
      + 'hangi yüzünden değdiğini belirler (Bölüm 5.1).',
    'Kasnağın <strong>adına</strong> tıklayarak panelini açın ve tablonun taşımadığı alanları '
      + '(temas tarafı ayrıntısı, atalet, güç eğrisi, devir sınırları) girin — Bölüm 6.',
    'Bütün kasnakları girdikten sonra <strong>üst künyedeki</strong> '
      + '<strong>✓ Çevrim kapalı · Σsarım</strong> okumasına bakın: '
      + '<strong>360,0°</strong> olmalı.'
  ]);

  h += _gfSahneTablo();
  h += '<h3>4.1 Tablonun sütunları</h3>';
  h += '<p>Sıra bilinçlidir: <strong>girdi ile türeyen iç içe durur</strong>. Bir koordinatı '
    + 'değiştirdiğinizde sarımın ve span’in ne olduğunu aynı bakışta görürsünüz — sütunları '
    + 'girdi/çıktı diye ikiye ayırmak bu okumayı bozardı.</p>';
  h += _gfTablo('Kayış Tablosu sütunları',
    ['Sütun', 'Girdi mi', 'Ne yazar / nereden gelir'],
    [
      ['<strong>#</strong>', 'sıra', 'Kayış sırasındaki numara ve satırı taşıyan '
        + '<strong>↑ ↓</strong> okları. Sürücünün numarası vurguludur ve satırı '
        + '<strong>kilitlidir</strong> — sıra ondan başlar (Bölüm 5)'],
      ['<strong>KASNAK</strong>', 'girdi', 'Kasnağın adı. Tıklandığında '
        + '<strong>panelini açar</strong>; sonuç tablolarında sütun başlığı olur'],
      ['<strong>X</strong> · <strong>Y</strong>', 'girdi', 'Kayış düzlemindeki merkez, mm. '
        + 'Orijin sürücü kasnaktır. <strong>Gergi satırında bu, avara kasnağının '
        + 'merkezidir</strong> — gövdenin montaj konumu değil (Bölüm 7)'],
      ['Efektif Çap', 'çözümden', 'Kayışın gerçekten üzerinden geçtiği çap: kaburgalı '
        + 'temasta <em>D + 2·h<sub>b</sub></em>, sırttan temasta <em>D + 2·h<sub>r</sub></em>. '
        + 'Profil sabitinden gelir, tablo hesaplamaz'],
      ['<strong>D</strong>', 'girdi', 'Kasnağın <strong>dış çapı</strong>, mm. Pitch çapı '
        + 'girilmez — program onu profilden türetir'],
      ['<strong>Kasnak Dönüş Yönü</strong>', 'girdi', 'Sağ / Sol açılır listesi. Seçim '
        + '<em>temas tarafını</em> yazar; ikinci bir yön alanı tutulmaz (Bölüm 5.1)'],
      ['Sarım Açısı', 'çözümden', 'Kayışın o kasnağı sardığı açı, derece'],
      ['Span Uzunluğu', 'çözümden', 'O kasnağın <strong>çıkışındaki</strong> serbest açıklık, mm'],
      ['Kayış Uzunluğu', 'çözümden', 'Bütün satırlar için <strong>tek birleşik hücre</strong>: '
        + 'boy satıra değil çevrimin tamamına aittir (Σspan + Σyay)'],
      ['✕', 'işlem', 'Kasnağı modelden siler. Kendi sütununda durur — sık yapılan işlemle '
        + 'geri dönüşü olmayan işlem yan yana olmasın diye']
    ], ['l', 'c', 'l']);
  h += _gfNot('Girdi mi, çözümden mi — künyedeki lejant söyler',
      'Tablonun üst künyesinde küçük bir lejant durur: <strong>123 girilir</strong> / '
    + '<strong>123 çözümden</strong>. Ayrım sütun sırasından değil <strong>hücrenin '
    + 'görünümünden</strong> gelir — alan gibi duran hücreye yazılır, düz duran hücre okunur. '
    + 'Fareyi bir satırın üzerine getirdiğinizde satır zemini değişir, bir hücreye '
    + 'odaklandığınızda çevresinde halka belirir; paneli açık olan kasnağın satırı da '
    + 'işaretli kalır.');
  h += _gfNot('Ondalık ayırıcı virgül olabilir',
      'Hücreler <code>63,5</code> yazımını kabul eder ve 63,5 olarak okur. Bu bir incelik '
    + 'değil bir <strong>kapıdır</strong>: alanlar sıradan metin alanı olduğu için virgül '
    + 'kaybolmaz. Tarayıcının sayı alanı olsaydı virgüllü giriş sessizce yutulur, model hiç '
    + 'değişmezdi.');

  h += '<h3>4.2 Σ satırı ve üst künye</h3>';
  h += _gfAlanTablo('Tablonun iki okuması', [
    ['<strong>Σ toplam</strong> satırı', 'Sarım açısı ve span sütunlarının toplamı',
      'Gösterilen hücrelerin toplamıdır, yeni bir büyüklük türetmez — hücreleri seçince '
      + 'alacağınız sayının aynısı'],
    ['<strong>Üst künye</strong>', 'Kayış profili · marka · kasnak sayısı · efektif boy · '
      + '<strong>✓/✗ Çevrim kapalı · Σsarım</strong> · gösterilen kol konumu',
      '<strong>Σsarım 360,0° olmak zorundadır.</strong> Değilse künye <strong>✗ Çevrim '
      + 'AÇIK</strong> yazar ve kayış yolu kapanmıyor demektir']
  ], ['Nerede', 'Ne gösterir', 'Nasıl okunur']);

  h += '<h3>4.3 Kasnak eklemek, silmek, adlandırmak</h3>';
  h += _gfAlanTablo('Üç işlem', [
    ['Eklemek', '<strong>＋ Kasnak ekle</strong> listesinden tip seçin',
      'Kayış sırasının sonuna düşer; sırayı sonra ↑ ↓ ile taşırsınız'],
    ['Silmek', 'Satırın sağındaki <strong>✕</strong>',
      'Kasnak modelden çıkar, numaralar 1…N−1 olacak şekilde kapanır. Geri almak için '
      + '<em>Geri Al</em> — silme geri-al yığınına yazılır'],
    ['Adlandırmak', 'Adına tıklayıp <strong>panelini</strong> açın, adı orada değiştirin',
      'Adlar sonuç tablolarında ve raporda sütun başlığı olur; kısa ve ayırt edici seçin']
  ], ['İşlem', 'Nasıl', 'Not']);
  h += _gfUyari('Girdi sütunları geometri çözülemese de doludur',
      'Tablo bir <em>rapor</em> değil bir <strong>giriş yüzeyidir</strong>. Model henüz '
    + 'çözülemiyorsa (kasnaklar çakışıyor, gergi künyesi eksik) türeyen sütunlar boş kalır '
    + 'ama <strong>ad · X · Y · D dolu durur</strong> — düzeltmek istediğiniz sayıyı '
    + 'göremediğiniz bir durum olmaz.');
  return h;
}

function _gfSec5(){
  var h = _gfH2(4);
  h += '<p>Kayış yolu bir <strong>graf değil, bir listedir</strong>: hangi kasnaktan hangisine '
    + 'gidildiği Kayış Tablosu’nun <strong>satır sırasıdır</strong>. Kasnaklar arasına tel '
    + 'çekilmez, port tıklanmaz — sıra tablodan okunur ve tablodan değiştirilir.</p>';
  h += _gfAdimlar([
    'Satırı taşımak için # sütunundaki <strong>↑</strong> ya da <strong>↓</strong> okuna '
      + 'basın. Sıra değişir, kayış yolu ve bütün türeyen sütunlar anında yeniden çözülür.',
    'Sıranın <strong>sürücü kasnaktan başladığını</strong> doğrulayın: sürücünün numarası '
      + 'vurguludur ve satırı kilitlidir, oklarla taşınamaz.',
    'Alt şeritteki <strong>Σsarım</strong> 360,00° olana kadar sırayı ve dönüş yönlerini '
      + 'düzeltin.'
  ]);
  h += _gfUyari('Gates tabloları TERS sırada yazar',
      'Tedarikçi raporlarının kasnak tablosu kayışın <strong>gidişinin tersi</strong> '
    + 'sırayla dizilmiştir ve program da listeyi o sırada tutar — böylece raporu satır satır '
    + 'kopyalayabilirsiniz. Doğru kurulmuş bir modelde krank kasnağı '
    + '<strong>saat yönünde</strong> döner; şemadaki kasnak içi oklar bunu gösterir. Yol '
    + 'tersine dönmüş görünüyorsa sırayı elle çevirmeye çalışmayın — <strong>Dönüş Yönü</strong> '
    + 'kartını kullanın (Bölüm 5.2).');

  h += '<h3>5.1 Kasnak Dönüş Yönü sütunu</h3>';
  h += '<p>Tablodaki <strong>Kasnak Dönüş Yönü</strong> hücresi bir açılır listedir ve '
    + '<em>Sağ</em> ya da <em>Sol</em> alır. Seçtiğiniz yön, kayışın o kasnağa hangi yüzünden '
    + 'değdiğini — yani <strong>temas tarafını</strong> — yazar.</p>';
  h += _gfAlanTablo('Yön ↔ temas tarafı', [
    ['Kayış kaburgalı yüzden değiyor', 'Kasnak çevrimin süpürme yönünde döner',
      'Aksesuar kasnakları: alternatör, klima, su pompası, direksiyon, hava kompresörü'],
    ['Kayış sırttan (düz yüzden) değiyor', 'Kasnak ters yönde döner',
      'Avara kasnakları ve çoğu gergi']
  ], ['Ne demek', 'Kasnak nasıl döner', 'Tipik olarak']);
  h += _gfNot('Tek alan, iki okuma — ikinci bir yön alanı yok',
      'Yön hücresi ayrı bir “yön” verisi tutmaz; doğrudan <strong>temas tarafını</strong> '
    + 'yazar ve o alan da panelde kendi kartında görünür. Bu yüzden defterlerde sık görülen '
    + 'sessiz tutarsızlık — “yön şu, temas tarafı bu” — burada '
    + '<strong>kurulamaz</strong>: yönü değiştirmek <em>Efektif Çap</em> sütununu da anında '
    + 'değiştirir (2·h<sub>r</sub> ↔ 2·h<sub>b</sub>), çünkü kayış artık kasnağa başka bir '
    + 'yüzeyden değmektedir. Süpürme işareti henüz okunamıyorsa (model çözülemiyor) hücre '
    + 'salt okunur kalır — uydurulmuş bir taraf sessizce başka bir yol çözdürürdü.');

  h += '<h3>5.2 Dönüş Yönü kartı — bütün yolu çevirmek</h3>';
  h += '<p>Tek bir kasnağın yönü değil, <strong>çevrimin tamamının</strong> yönü yanlışsa '
    + 'tek tek düzeltmeye çalışmayın:</p>';
  h += _gfAdimlar([
    'Paletten <strong>Dönüş Yönü</strong> kartını tuvale bırakın (bir kopya yeter).',
    'Rozetine tıklayın: <code>↺ CCW</code> ↔ <code>↻ CW</code>. Bütün kayış yolu yerinde '
      + 'çevrilir.',
    'Rozetin <strong>rengine</strong> bakın — durumu glif, hükmü renk taşır.'
  ]);
  h += _gfAlanTablo('Dönüş Yönü rozetinin rengi', [
    ['Yeşil', 'Gergi kayışın <strong>gevşek</strong> tarafında', 'Doğru yerleşim — devam edin'],
    ['Kırmızı', 'Gergi kayışın <strong>gergin</strong> tarafında', 'Yönü çevirin ya da gergiyi '
      + 'kayış sırasında sürücünün önüne alın'],
    ['Nötr', 'Henüz çözüm yok', 'Model tamamlanınca renk gelir']
  ], ['Renk', 'Ne demek', 'Ne yapmalı']);
  h += _gfSahneSpin();
  h += _gfUyari('Ters yerleşim hata vermez',
      'Gergi gergin tarafa düştüğünde geometri <strong>kusursuz çözülür</strong>: kapalı çevrim '
    + 'tutar, Σ sarım yine 360° çıkar, tablo yeşil görünür. Bozulan tek şey gerilme zinciridir — '
    + 'açıklık gerilmeleri ankrajın altına iner ve bir kısmı negatife döner. Ölçülen 14 '
    + 'tedarikçi sisteminin <strong>14’ünde de</strong> gergi gevşek taraftadır; istisna yoktur. '
    + 'Bu durumda program kayma emniyeti hükmü de <strong>vermez</strong>: çöken bir zincirde '
    + 'çıkan emniyet faktörü bir marj değil, sayısal bir gölgedir.');

  h += '<h3>5.3 Modelin kurulu olduğunu doğrulamak</h3>';
  h += '<p>İki yerde aynı denetim yazılıdır ve ikisi de aynı çözümden gelir:</p>';
  h += _gfAlanTablo('Kapanış denetimi', [
    ['Kayış Tablosu — üst künye', '✓/✗ Çevrim kapalı · Σsarım · efektif boy',
      'Σsarım <strong>360,0°</strong> olmak zorunda'],
    ['Kayış Yolu şeması — alt şerit', '✓/✗ · kasnak sayısı · efektif boy · Σ sarım',
      'Aynı sayı; ✗ ise sebebini yazar (“Kayış yolu KAPANMIYOR”, “Kayış kasnağın İÇİNDEN geçiyor”)']
  ], ['Nerede', 'Ne yazar', 'Kural']);
  return h;
}

function _gfSec6(){
  var h = _gfH2(5);
  h += '<p>Koordinat, çap ve dönüş yönü tabloya girildi. Geri kalan alanlar '
    + '<strong>kasnak panelindedir</strong>: Kayış Tablosu’nda kasnağın '
    + '<strong>adına tıklayın</strong>, panel sağda açılır. Sıra önemli değildir, ama '
    + '<strong>temas tarafıyla başlamak</strong> iyi bir alışkanlıktır: hesabı en çok etkileyen '
    + 've en sessiz biçimde yanlış girilebilen alan odur.</p>';
  h += _gfAlanTablo('Kasnak paneli — alanlar', [
    ['Temas Tarafı', '“Kaburgalı yüzden değiyor” ya da “Sırtından değiyor”',
      'Yerleşim çiziminden okunur. Aksesuarlar tipik olarak kaburgalı, avara ve gergi sırttan '
      + 'temas eder.'],
    ['Dış çap (OD)', 'Kasnağın dış çapı, mm', 'Koordinat tablosu. <strong>Pitch çapı '
      + 'girilmez</strong> — program onu kayış profilinden türetir. Kayış Tablosu’ndaki '
      + '<em>D</em> sütunuyla <strong>aynı alandır</strong>, iki yerden de girilebilir'],
    ['Konum X / Y', 'Kayış düzleminde merkez, mm', 'Kayış Tablosu’ndaki X ve Y sütunlarının '
      + 'aynısı; orijin sürücü kasnaktır ve işareti sayfadaki gibi yazılır'],
    ['Sürücü kasnak', 'Tek kasnakta işaretlenir', 'Kayışı hangi kasnağın döndürdüğü. Bir '
      + '<strong>roldür</strong>, tip değil: ikincil tahrikte fan kasnağı da sürücü olabilir.'],
    ['Atalet J', 'kg·m²', 'Tepe yük ve burulma titreşimi hesabına girer'],
    ['Katalog Modeli', 'Alternatör / klima / hava kompresörü için hazır devir → kW eğrisi',
      'Araç Performans modülüyle ortak katalog'],
    ['Güç Eğrisi', 'Aksesuar devri → kW tablosu', 'Bilgi sayfasındaki grafiğin altındaki '
      + 'tablo. Girilirse <strong>katalog modelinin önüne geçer</strong>.']
  ]);
  h += _gfUyari('Temas tarafı — hata vermeyen alan',
      'Ters verirseniz program <strong>geçerli ama başka</strong> bir kayış yolu çözer. '
    + 'Kapalı çevrim tutar, sarım değişmezi tutar, hiçbir uyarı çıkmaz — ne kod ne göz yakalar. '
    + 'Ölçülen bir örnekte krank sarımı 207,7° yerine 172,2° çıkıyordu, yani <strong>35,5° '
    + 'fark</strong>, ve model yine “çözüldü” diyordu.<br><br>'
    + 'Bu yüzden temas tarafı <strong>üç ayrı yerde</strong> görünür: panelde kendi '
    + 'kartında, <strong>Kayış Tablosu’nun “Kasnak Dönüş Yönü” sütununda</strong> (Bölüm 5.1), '
    + 've Kayış Yolu şemasında <strong>kayışın kaburgalı yüzü çizilerek</strong> — kaburgalı '
    + 'temas eden kasnakta dişler kasnağın içine, sırttan temas edende dışarı bakar. Şemaya '
    + 'bakıp dişlerin yönünü kontrol etmek, tabloyu okumaktan hızlıdır.');
  h += '<h3>6.1 Aksesuar gücünü nereden vereceksiniz</h3>';
  h += '<p>Aksesuarın çektiği güç iki yoldan gelebilir ve <strong>ikisini birden girmeniz '
    + 'gerekmez</strong>:</p>';
  h += _gfAlanTablo('Aksesuar gücünün iki kaynağı', [
    ['Güç Eğrisi', 'Kasnak panelinde, aksesuar devri → kW tablosu',
      'Bilgi sayfası her aksesuar için kendi ölçülmüş eğrisini veriyorsa'],
    ['Çalışma çevrimi hücresi', 'Çözücü panelinde, devir satırı × kasnak sütunu',
      'Tedarikçi raporu güçleri doğrudan devir noktası başına veriyorsa'],
    ['Katalog Modeli', 'Kasnak panelinde hazır eğri seçimi',
      'Elinizde ölçülmüş eğri yoksa; boş bırakılan kW hücreleri buradan dolar']
  ], ['Kaynak', 'Nerede', 'Ne zaman']);
  h += _gfSahneKasnakPaneli();
  h += '<h3>6.2 Devir sınırları — uygunluk kapısının girdisi</h3>';
  h += '<p>Aksesuar kasnaklarının panelinde bir <strong>Devir Sınırları</strong> kartı vardır. '
    + 'Buradaki üç sayı bir <em>bilgi</em> değil, Bölüm 11.5’teki uygunluk kapılarının '
    + '<strong>girdisidir</strong>: onlar boşsa kapı hüküm veremez ve o kasnak '
    + '<strong>“değerlendirilemedi”</strong> sayılır — uygun sayılmaz.</p>';
  h += _gfAlanTablo('Devir Sınırları kartı', [
    ['BMC künyesi', 'Hazır aksesuar kaydı seçimi',
      'On alternatör ve dört klima kompresörü künyesi. Seçim üç sınırı — ve varsa devir/kW '
      + 'eğrisini — bir anda yazar'],
    ['Optimum [d/dk]', 'Aksesuarın çalışmasının istendiği devir',
      'Katalogdan gelir; elle girilen değer katalogun önüne geçer'],
    ['Maks. sürekli [d/dk]', 'Sürekli aşılmaması gereken devir',
      'Optimum ile bu değerin arası <strong>çalışma bandıdır</strong>: motor '
      + '<em>governed</em> devrindeyken aksesuar bu banda düşmüyorsa panel '
      + '<strong>kasnak çapı küçültülmeli / büyütülmeli</strong> der'],
    ['Maks. anlık [d/dk]', 'Motor <em>overspeed</em>’e çıktığında aşılmaması gereken sınır',
      'Anlık aşımın kapısı']
  ]);
  h += _gfNot('Katalog bir kısıt değil, bir öneridir',
      'Bu, modülün dört kütüphanesinde de (kayış · gergi · motor · aksesuar) aynı kuraldır: '
    + 'seçim alanları <strong>doldurur</strong>, kilitlemez. Sonra bir alanı elle '
    + 'değiştirirseniz program <strong>susmaz</strong> — kart “şu kadar alan elle girilmiş ve '
    + 'katalog değerinin yerine geçiyor” diye yazar. Sessiz kalmak, elle girilmiş bir sayıyı '
    + '“katalogdan geldi” sanmanıza yol açardı.');
  h += _gfNot('Aksesuar devri çaptan hesaplanır',
      'Aksesuarın kaç devirde döndüğü <strong>kasnak pitch çaplarından</strong> gelir; elle '
    + 'hız oranı girilmez. Elle yazılmış hız oranları, bu modülün öncülü olan hesap '
    + 'tablosundaki en ciddi hataydı ve bütün gerilmeleri sistematik olarak düşürüyordu. '
    + 'Kasnak panelindeki güç eğrisi tablosunun yanında, o aksesuar devrini veren '
    + '<em>motor devri</em> de bilgi olarak gösterilir; sayfanızın motor-devri sütunuyla '
    + 'karşılaştırabilirsiniz.');
  return h;
}

function _gfSec7(){
  var h = _gfH2(6);
  h += '<p>Otomatik gergi, modelin en çok girdi isteyen bileşenidir. Panelini '
    + '<strong>Kayış Tablosu’ndaki adına tıklayarak</strong> açın — gerginin de kanvasta '
    + 'kutusu yoktur. '
    + 'Panelin sorduğu <strong>tek konum girdisi</strong> vardır ve diğer bütün kasnaklarla '
    + 'aynı şeydir: <strong>avara kasnağının merkezi</strong>. Gövdenin montaj konumu, '
    + 'serbest kol açısı ve kayış boyu bundan <strong>türer</strong>.</p>';
  h += _gfAdimlar([
    'Önce <strong>Gergi Künye Kütüphanesi</strong> kartına bakın: elinizdeki gergi bu 14 '
      + 'ölçülmüş künyeden biriyse seçin, kol boyu · ön yük · yay katsayısı · kasnak çapı · '
      + 'temas tarafı bir anda dolar.',
    'Kütüphanede yoksa <strong>Yay Künyesi</strong> kartına üç sayıyı elle girin: ön yük, '
      + 'yay katsayısı, çalışma momenti.',
    '<strong>Avara Kasnağının Merkezi</strong> kartına gergi kasnağının merkez X ve Y’sini '
      + 'yazın — bilgi sayfasının koordinat tablosundaki gergi satırı budur.',
    '<strong>Kol Künyesi</strong> kartına kol boyunu ve <strong>kol çalışma açısını</strong> '
      + 'yazın. Kartın altında gövdenin montaj konumu türetilmiş olarak görünür.',
    '<strong>Avara Hareketi</strong> kartındaki okumaya bakın: serbest kol açısı, gereken '
      + 'kayış boyu ve tasarım gerginliği orada.'
  ]);
  h += _gfAlanTablo('Gergi paneli — alanlar', [
    ['Temas Tarafı', 'Genelde “Sırtından değiyor”', 'Yerleşim çizimi'],
    ['Dış çap (OD)', 'Gergi kasnağının dış çapı, mm', 'Parça künyesi'],
    ['Atalet J', 'kg·m²', 'Parça künyesi; burulma modeline girer'],
    ['<strong>Merkez X / Y</strong>', 'Gergi <strong>avarasının</strong> merkezi — kayış '
      + 'yolu buradan geçer. Programın sorduğu <strong>tek</strong> konum girdisi; '
      + 'Kayış Tablosu’nun gergi satırındaki X / Y sütunlarıyla <strong>aynı alan</strong>',
      'Bilgi sayfasının koordinat tablosu, gergi satırı; dönen raporda <em>Layout Data</em>'],
    ['Kol boyu (Arm Length)', 'Montaj ekseni ile kasnak merkezi arasındaki sabit mesafe, mm',
      'Raporun <em>Tensioner Data</em> bölümü; 56–90 mm aralığında doğrulandı'],
    ['<strong>Kol çalışma açısı</strong>', 'Kolun çalışma konumundaki <strong>mutlak</strong> '
      + 'açısı (+X’ten CCW) — gergi gövdesinin montajdaki saat konumu',
      'Gerginin parça/montaj çizimi (E9843: <em>“344° MEAN ANGLE”</em>)'],
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
    + 'ucudur</strong> ve aralarında tam kol boyu kadar mesafe vardır (14 sistemin 81 '
    + 'konumunda ölçüldü, sapma ≤ 0,065 mm). Panelin istediği <strong>merkezdir</strong>; '
    + 'montaj konumu yalnız tedarikçiden <em>dönen</em> raporda bulunur ve modele '
    + '<strong>girmez</strong> — program onu türetir.<br><br>'
    + 'İkisi karıştırılırsa model <strong>yine çözülür</strong> — ölçüldü: '
    + '14 tedarikçi sisteminin <strong>14’ü de çözülüyor</strong>, gerginlik sapması '
    + 'medyan <strong>+%1526</strong> (en kötü +%4518) ve <strong>beşinde hiçbir uyarı '
    + 'çıkmıyor</strong>.<br><br>'
    + 'Program bu iki noktayı <strong>birbiriyle karşılaştırmaz</strong>: ikinci bir koordinat '
    + 'sormaz, dolayısıyla ters girişi kendiliğinden yakalayamaz. Denetimi siz yaparsınız — '
    + 'nasıl olduğu bir sonraki başlıkta.');
  h += _gfSahneGergi();
  h += '<h3>7.1 Doğru noktayı girdiğinizi doğrulamak</h3>';
  h += '<p>Program, girdiğiniz koordinatın kasnak merkezi mi yoksa gövdenin montaj konumu mu '
    + 'olduğunu <strong>kendi başına ayırt edemez</strong> — ikisi de geçerli bir çözüm '
    + 'üretir. Ama denetimi yapmanız için gereken sayıyı <strong>her durumda basar</strong>.</p>';
  h += _gfAdimlar([
    '<strong>Kol Künyesi</strong> kartındaki <em>“↳ gövdenin montaj konumu (türedi)”</em> '
      + 'satırına bakın. Bu, girdiğiniz merkezden kol boyu ve kol açısıyla türetilen '
      + 'montaj eksenidir.',
    'Elinizde tedarikçiden dönen rapor varsa o sayıyı <em>Tensioner Data → Pivot Point '
      + '{X, Y Coordinates}</em> satırıyla karşılaştırın. Tutuyorsa doğru alana '
      + 'girmişsinizdir.',
    'Elinizde yalnız tedarikçiye <em>giden</em> bilgi sayfası varsa, o sayfanın gergi satırı '
      + 'zaten <strong>kasnak merkezidir</strong> — doğrudan panele yazılır, çevirme gerekmez.'
  ]);
  h += _gfNot('Doğrulama sizin işiniz, programın değil',
      'Bu bilinçli bir tercihtir: <strong>programda karşılıklı doğrulama yoktur</strong>. '
    + 'Girilen tek koordinat vardır ve avaranın hareketi yalnız ondan tanımlanır. İkinci bir '
    + 'koordinat sorulup ikisi karşılaştırılsaydı aynı büyüklük iki yerden alınmış olurdu — '
    + 'bölüm 2’de anlatılan “tek kaynak” kuralının ihlali. Denetim için gereken türev sayı '
    + 'ekranda durur; karşılaştırmayı belgeyle siz yaparsınız.');
  h += '<h3>7.2 Kol çalışma açısını program neden SEÇMİYOR</h3>';
  h += '<p>Avara merkezi verildikten sonra kayış yolu tamamen belirlidir: teğet noktaları, '
    + 'sarım açıları ve efektif boy kolun saatinden <strong>bağımsızdır</strong> — geometri '
    + 'yalnız kasnak merkezlerinin farklarından kurulur. Kolun mutlak açısını değiştirmek '
    + 'yalnız <em>gövdenin nereye cıvatalandığını</em>, dolayısıyla yalnız β’yı, yani '
    + 'take-up’ı ve gerginliği oynatır.</p>';
  h += '<p>Bu bir <strong>paketleme</strong> kararıdır ve kayış fiziğinden çıkarılamaz. '
    + 'Program bir dönem onu bir ölçütten seçiyordu (girdi montaj konumuyken bu işe '
    + 'yarıyordu: 14 tedarikçi sisteminin 8’inde ±5° içinde, medyan 4,0°). Girdi avara '
    + 'merkezine dönünce ölçüt çöktü — ölçüldü: aynı ölçüt <strong>2/14</strong>, medyan '
    + '<strong>20,7°</strong>, dört sistemde sapma 90°’nin üstünde; ±10° bandında da yine '
    + '2/14, yani ara bir bant yok. Sekiz aday ölçüt tarandı, en iyisi yine 2/14.</p>';
  h += '<p>Sebep, ölçütün <em>yanlış</em> bir yeri seçmesi değil, <strong>hiçbir yeri '
    + 'seçememesidir</strong>. Merkez sabitken çalışma noktasındaki kayış yolu kol '
    + 'açısından bağımsız olduğu için — ölçüldü: altı sistemde 548’er açı boyunca sarım, '
    + 'açıklıklar ve efektif boy en fazla <strong>4,55·10<sup>−13</sup> mm</strong> '
    + 'oynuyor, yani makine hassasiyeti — ölçüt eğrisi <strong>düzleşiyor</strong>: '
    + '%1 platosu 2,1°’den <strong>24,1°</strong>’ye genişliyor (11,5 kat).</p>';
  h += _gfNot('Uydurulmuş varsayılan yok',
      'Kol çalışma açısı girilmemişse model <strong>çözülmez</strong> ve sebebini adıyla '
    + 'yazar. β = 90° gibi “makul ama yanlış” bir varsayılan, gerginliği ölçülebilir biçimde '
    + 'kaydırıp <em>sessiz</em> kalırdı — bu modülün en pahalı hata sınıfı tam olarak odur.');
  h += '<h3>7.2.1 Program yine de yalnız bırakmıyor: bant ve eğri</h3>';
  h += '<p>Açıyı seçmiyor ama iki şey söylüyor ve ikisi de <strong>sizin kendi '
    + 'verinizden</strong> hesaplanıyor — tedarikçi raporlarından türetilmiş hiçbir sabit '
    + 'yok:</p>';
  h += _gfAlanTablo('Avara Hareketi kartının bant okuması', [
    ['<strong>Kol açısı olanaklı bantta</strong>', 'Girdiğiniz açı fiziksel olarak '
      + 'kullanılabilir mi? Tek soru: kol, kayışın servis aralığının iki ucuna da '
      + '(Değiştirme ↔ Min) ulaşabiliyor mu', 'Kullanılamıyorsa <strong>sebebi '
      + 'yazılır</strong>'],
    ['Kullanılabilir yay', 'Bandın 360°’nin kaçında açık olduğu', 'Tipik olarak ~190°'],
    ['<strong>T(θ) eğrisi</strong>', 'Her montaj saatinde çıkan gerginlik; sizin açınız '
      + 'amber çizgiyle işaretli, kullanılamaz açılar kırmızı taralı',
      'Ölçülen sistemlerde ±20°’de <strong>%47…101</strong> oynuyor — seçim ucuz değil']
  ], ['Satır', 'Ne gösterir', 'Not']);
  h += _gfUyari('Bant bir ÖNERİ DEĞİL, bir KAPIDIR',
      'Bandın içinden bir nokta seçilmez. <strong>Ölçüldü</strong> (14 tedarikçi sistemi, '
    + 'bu ölçütün kendisiyle): tedarikçinin gerçek çalışma açısı bandın içinde '
    + '<strong>14/14</strong> — yani ölçüt hiçbir gerçek tasarımı yanlışlıkla reddetmiyor — '
    + 'ama bant <strong>96…218°</strong> geniş (medyan 189°) ve ortasını seçseydik medyan '
    + 'hata <strong>96°</strong> olurdu.<br><br>'
    + 'Fizik hangi açıların <strong>imkânsız</strong> olduğunu söylüyor, hangisinin '
    + '<strong>doğru</strong> olduğunu söylemiyor. O bilgi motor bloğunun paketlemesinde — '
    + 'cıvata deseni, gövde gabarisi, komşu parçalar — ve programda yok. Eğri seçimin '
    + '<em>bedelini</em> yazar, seçimi sizin yerinize yapmaz.');
  h += '<h3>7.3 Panelde ne okuyacaksınız</h3>';
  h += _gfAlanTablo('Avara Hareketi kartının okuması', [
    ['Yay kurulması', '(M<sub>çalışma</sub> − M<sub>ön</sub>) / k — kolun bağıl dönmesi',
      'Salt yay künyesinden; geometriye hiç bakmaz'],
    ['Kol çalışma açısı', 'Girdiğiniz mutlak açı', 'Bir <strong>girdi</strong>'],
    ['↳ gövdenin montaj konumu (türedi)', 'Merkezden kol boyu kadar geride, çalışma açısında',
      '<strong>Türeyen</strong> — atölyeye giden sayı; §7.1’in denetim sayısı'],
    ['Serbest kol açısı (türedi)', 'θ<sub>çalışma</sub> − sense × yay kurulması',
      'Çekirdeğe giren açı'],
    ['Gereken KAYIŞ BOYU (çıktı)', 'Bu yerleşim için ısmarlanması gereken efektif boy',
      'Bölüm 8’de katalogla eşleştirilir'],
    ['Tasarım gerginliği (türedi)', 'Yay dengesinden türeyen ankraj gerginliği',
      'Bütün gerilme zinciri bu değerden kurulur'],
    ['Konum pimi', 'Kol açısının imalat karşılığı: pim deliğinin yarıçapı ve açısı',
      'Yalnız parça çizimi olan künyelerde; yoksa sebebi yazılır'],
    ['Kol açısı olanaklı bantta', 'Girilen açının fiziksel olarak kullanılabilirliği',
      '§7.2.1 — kullanılamıyorsa sebebiyle'],
    ['T(θ) eğrisi', 'Her montaj saatinin gerginlik bedeli', '§7.2.1 — bir öneri değil']
  ], ['Satır', 'Ne gösterir', 'Not']);
  return h;
}

function _gfSec8(){
  var h = _gfH2(7);
  h += '<p><strong>Kayış Özellikleri</strong> kutusuna çift tıklayın. İç topolojide bu kutudan '
    + 'yalnız bir tane bulunur.</p>';
  h += _gfAdimlar([
    '<strong>Profil ve Marka</strong> kartında kayış profilini seçin (PK · PJ · PH · PL · PM) '
      + 've markayı işaretleyin. Bu seçim kapatılamaz: pitch yarıçapı '
      + '<em>OD/2 + h<sub>b</sub></em> olduğu için teğet geometrisi profil sabitine dayanır.',
    '<strong>Künye</strong> kartına kanal (kaburga) sayısını girin. Gergi montaj '
      + 'koordinatından çözülüyorsa <strong>efektif boy alanı yoktur</strong> — yerine '
      + 'türetilen boyun okuması durur.',
    '<strong>Katalog</strong> kartına bakın: program gereken boya en yakın stok ve ızgara '
      + 'boylarını, her biri için kolun oturacağı açı ve çıkacak gerginlikle birlikte '
      + 'listeler.',
    'Bir satıra tıklayarak o boyu seçin. Kip <strong>SABİT</strong>e döner ve model artık o '
      + 'kayışla çözülür.'
  ]);
  h += _gfSahneKayis();
  h += '<h3>8.1 Kayış boyu kipi</h3>';
  h += _gfAlanTablo('İki kip, iki soru', [
    ['SERBEST', 'Kayış boyu bir <strong>çıktıdır</strong>; kol nominal yay açısına oturur',
      '“Bu düzen için hangi kayışı ısmarlamalıyım?”'],
    ['SABİT', 'Girilen boy kullanılır; kol o boya oturan açıya gider, gerginlik oradan çıkar',
      '“Elimdeki bu kayış bu düzene uyar mı?”']
  ], ['Kip', 'Ne yapar', 'Hangi soruya cevap verir']);
  h += _gfNot('Kayış kipi kilitlidir',
      'Gergi avara merkezinden çözülüyorsa kayış boyu <strong>yapısal olarak</strong> bir '
    + 'sonuçtur ve seçilemez. Panel bunu “SERBEST (kilitli)” diye yazar, tuvaldeki rozet de '
    + 'tıklamayı reddeder.');
  h += '<h3>8.2 Katalog bir kısıt değil, bir öneridir</h3>';
  h += '<p>Katalog iki ayrı küme gösterir ve bunları karıştırmaz:</p>';
  h += _gfAlanTablo('Katalog kümeleri', [
    ['Stok boyları', 'ISO 9982 / DIN 7867 endüstriyel boylar', 'İşaretsiz satırlar'],
    ['Otomotiv ızgarası', '5 mm adımlı üretim pratiği', '<strong>◇</strong> ile işaretli']
  ], ['Küme', 'Nedir', 'Listede nasıl görünür']);
  h += '<p>Ayrım gerçek bir boşluktan doğdu: ölçülen bir aracın kendi kayışı '
    + '(<code>8PK 1715</code>) endüstriyel stok listesinde <strong>yoktur</strong> — komşuları '
    + '1690 ve 1755, arada 65 mm’lik bir boşluk var. Yalnız stok listesi gösterilseydi '
    + 'kullanıcının elindeki kayış “katalogda yok” görünürdü. Ara boy ısmarlanabilir; boyu '
    + 'elle de girebilirsiniz.</p>';
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
    + 'rezonansı ve çırpınma hükmü sizin için önemliyse ölçülmüş değeri elle girin.');
  h += '<h3>8.4 Kayış tipine bağlı çıktılar anahtarı</h3>';
  h += '<p>Aynı panelde bir anahtar daha vardır ve varsayılan olarak '
    + '<strong>kapalıdır</strong>. Kapalıyken şu dört çıktı <strong>üretilmez</strong>:</p>';
  h += '<ul>'
    + '<li>B10 kayış ömrü</li>'
    + '<li>Kaburga yorulma dağılımı</li>'
    + '<li>Açıklık doğal frekansları ve çırpınma hükmü</li>'
    + '<li>Kol konum tablosunun tolerans / aşınma zarfı</li>'
    + '</ul>';
  h += '<p>Dördü de kayış katalogundan gelen sabitlere dayanır (efektif boy, birim kütle, '
    + 'yorulma sabitleri, tolerans ve aşınma payı). Kayış henüz seçilmemişken bu sayıları '
    + 'üretmek, olmayan bir seçimi varsaymak olurdu. Kayışı seçtikten sonra anahtarı '
    + '<strong>Açık</strong>a alın; panel neyin kapalı olduğunu her zaman listeleyerek '
    + 'yazar.</p>';
  return h;
}

function _gfSec9(){
  var h = _gfH2(8);
  h += '<p><strong>Çözücü</strong> kutusuna çift tıklayın. Modelin geri kalanı burada '
    + 'toplanır.</p>';
  h += _gfSahneCozucu();
  h += '<h3>9.1 Birinci kademe — krank ile sürücü kasnak arasındaki oran</h3>';
  h += '<p>FEAD kayışının sürücü kasnağı krank milinde olmak zorunda değildir: yaygın bir '
    + 'düzende krank ayrı bir kademeyle fan kasnağını döndürür, FEAD kayışı da onun üzerinden '
    + 'tahrik edilir.</p>';
  h += '<p>Üç kip var ve seçim <em>düzene</em> göre yapılır, kolaylığa göre değil:</p>';
  h += _gfAlanTablo('Tahrik oranı kipleri', [
    ['Krank ve fan kasnağı çapından türet', 'Ayrı bir kademe VAR',
      'Krank ayrı bir kayış/dişli kademesiyle fan kasnağını döndürüyor ve FEAD kayışı '
      + 'onun üzerinde. İki çapı yazın; oran = krank Ø / fan Ø'],
    ['Kademe yok — sürücü kasnak motor devrinde', 'Fan kavraması krankın hemen önünde',
      'Sürücü kasnak krankla <strong>aynı milde ve aynı devirde</strong> dönüyor. Oran '
      + 'tanımı gereği <strong>1</strong>; çap da oran da sorulmaz'],
    ['Oranı elle gir', 'Oranı biliyorsunuz, çapları bilmiyorsunuz',
      'Tedarikçi sayfası tek bir sayı veriyorsa bu kip']
  ]);
  h += _gfAdimlar([
    'Düzeninize uyan kipi seçin.',
    'Kartın altındaki “Kullanılan tahrik oranı” satırından hem sayıyı hem de hangi kipten '
      + 'geldiğini okuyun.'
  ]);
  h += _gfUyari('Bu oran bütün sonuçları ölçekler',
      'Aksesuar devri = motor devri × <strong>tahrik oranı</strong> × (sürücü kasnak pitch '
    + 'çapı / aksesuar pitch çapı). Yanlış girilirse bütün güç ve gerilme sonuçları aynı '
    + 'oranda kayar ve hiçbir uyarı çıkmaz. <strong>Ölçüldü:</strong> tek kademeli bir '
    + 'sisteme çap kipinden kalmış 1,430 oranı sızdığında bütün aksesuar devirleri %43 '
    + 'kaymış, kayış hızı 17,5 yerine 25,0 m/s çıkmıştı. Hata sessizdi çünkü çaplar '
    + 'geçerli sayılardı; yanlış olan <em>kipti</em>. “Kademe yok” kipi tam bunun için var: '
    + 'düzeni ilan ediyorsunuz, sayı üretmiyorsunuz.');
  h += '<h3>9.2 Motor künyesi</h3>';
  h += '<p>Kartın en üstünde <strong>BMC motor kataloğu</strong> seçicisi durur: '
    + '<strong>yirmi dört motor</strong>, BMC’nin kendi FEAD hesap defterinin '
    + '<em>Motor Bilgileri</em> sayfasından. Bir kayıt seçmek <strong>silindir sayısını, dört '
    + 'devir sınırını ve birinci kademe çaplarını</strong> yazar; kasnak koordinatlarına ve '
    + 'kayışa <strong>dokunmaz</strong>.</p>';
  h += _gfAlanTablo('Kataloğun yazdığı dört devir sınırı', [
    ['Rölanti', 'Motorun boştaki devri', 'Çalışma çevriminin alt ucu'],
    ['Governed', 'Yük altındaki azami devir',
      'Aksesuar <strong>çevrim oranı penceresi</strong> kapısı bu devirde ölçülür (Bölüm 11.5)'],
    ['No load governed', 'Yüksüz azami devir', 'Bandın üst ucu'],
    ['Overspeed', 'Anlık aşım devri',
      'Aksesuar <strong>anlık maksimum</strong> kapısı bu devirde ölçülür']
  ], ['Sınır', 'Nedir', 'Nereye girer']);
  h += _gfNot('Katalogdan sapmak serbest — ama sessiz değil',
      'Seçimden sonra bir alanı elle değiştirirseniz kart bunu <strong>yazar</strong>: '
    + '“Katalogdan sapıldı: …”. Bu bir hata değildir — kayıt varyanta göre değişebilir — ama '
    + 'bir <strong>yazım hatası da tam burada görünür</strong>. Alanlar kayıtla birebirse '
    + 'kart onu da söyler.');
  h += _gfAlanTablo('Motor Künyesi kartı — kalan alanlar', [
    ['Silindir sayısı', 'Adet', 'Ateşleme frekansını verir (dört zamanlıda '
      + 'f = devir/60 × silindir/2); açıklık rezonans kontrolünde kullanılır'],
    ['Servis faktörü', 'Boyutsuz, tipik 1,3', 'Kayma emniyetinin istenen alt sınırı; sonuç '
      + 'tablosunda hüküm verir'],
    ['Krank ataleti', 'kg·m²', 'Burulma titreşimi modeline girer — kasnağın değil '
      + '<strong>krank milinin</strong> ataleti'],
    ['İvmelenme', 'RPM/s', 'Tepe yük taramasına girer'],
    ['Yavaşlama', 'RPM/s', 'Aynı taramanın diğer dalı']
  ]);
  h += '<h3>9.3 Çalışma çevrimi tablosu</h3>';
  h += '<p>Tablonun üstünde bir <strong>Çevrim kaydı</strong> seçicisi vardır: '
    + '<strong>yedi ölçülmüş çalışma çevrimi</strong> — altısı Gates arşivinden, biri BMC '
    + 'tedarikçi sayfasından. Bir kayıt seçmek devir · %zaman · sıcaklık satırlarını bir anda '
    + 'doldurur; sihirbazdaki kart da <strong>aynı kütüphaneyi</strong> kullanır, yani orada '
    + 'seçtiğiniz çevrimi burada da bulursunuz.</p>';
  h += _gfUyari('Tek bir “standart” çevrim yoktur',
      'Arşivde <strong>altı ayrı desen</strong> ölçüldü ve aralarında gerçek farklar var: '
    + 'rölantide geçirilen zaman, tepe devrin ağırlığı, sıcaklık dağılımı. Kütüphane bir '
    + '“doğru cevap” sunmuyor, <strong>ölçülmüş alternatifler</strong> sunuyor. Elinizde '
    + 'aracın kendi çevrimi varsa onu girin; kütüphane yalnız hiç veriniz yokken bir '
    + 'mertebe verir.');
  h += _gfNot('“— özel (elle düzenlendi) —” bir seçenek değil, bir okuma',
      'Tabloyu elle düzenlediyseniz satırlarınız hiçbir kayda uymaz ve seçici bunu '
    + '<strong>söyler</strong>. Yani seçicideki yazı “hangi kaydı seçtim” değil, '
    + '“tablomda şu an ne var” sorusunun cevabıdır.');
  h += _gfAdimlar([
    'Hazır bir çevrimle başlayacaksanız <strong>Çevrim kaydı</strong> seçicisinden birini '
      + 'seçin; kendi verinizi gireceksiniz aşağıdan devam edin.',
    '<strong>+ Devir satırı</strong> düğmesiyle bir devir noktası ekleyin.',
    'Satıra <strong>devir</strong>, o devirde geçirilen <strong>%zaman</strong> ve kayış '
      + '<strong>sıcaklığını</strong> yazın.',
    'Aksesuar sütunlarına o devirdeki <strong>kW</strong> değerlerini girin. Boş bıraktığınız '
      + 'hücre, o aksesuarda katalog modeli seçiliyse eğriden dolar; seçili değilse 0 sayılır.',
    'Bütün devir noktalarını girdikten sonra <strong>%zaman toplamının 100</strong> olduğunu '
      + 'doğrulayın.'
  ]);
  h += _gfNot('Sürücü sütunu yoktur',
      'Sürücü kasnağın gücü diğerlerinin <strong>toplamı</strong> olarak hesaplanır; çevrim '
    + 'ancak böyle kapanır. Elle girilseydi çekirdek reddederdi. Aynı gerekçeyle '
    + '%zaman toplamı 100 değilse dağılım yüzdeleri etkilenmez ama mutlak ömür ölçeklenir — '
    + 'panel bunu uyarır.');
  h += _gfNot('Sıcaklık satır başına girilir, tek sayıya indirgenir',
      'Ömür hesabı sıcaklığı tek bir eşdeğer değer olarak ister. Program bunu '
    + '<strong>hasar-eşdeğer</strong> olarak indirger, aritmetik ortalamayla değil: yüksek '
    + 'sıcaklıklı satırlar hak ettikleri ağırlığı alır. Tek sıcaklıklı bir tabloda iki yöntem '
    + 'aynı sonucu verir; dağılmış bir tabloda aritmetik ortalama ömrü sistematik olarak '
    + '<strong>uzun</strong> gösterirdi.');
  return h;
}

function _gfSec10(){
  var h = _gfH2(9);
  h += '<p>Geometri sonuçları <strong>Hesapla’ya basmadan</strong> hazırdır. Kayış Yolu kartı, '
    + 'gergi panelindeki avara hareketi okuması ve gergi konum tablosu çalışma çevrimi '
    + 'gerektirmez — '
    + 'geometriden ve yay dengesinden gelirler.</p>';
  h += _gfAdimlar([
    'Çözücü panelinde <strong>Algılanan Model</strong> tablosuna bakın: kasnak sayısı, sürücü, '
      + 'gergi, kayış künyesi, temas tarafı dağılımı, tahrik oranı, türetilen tasarım '
      + 'gerginliği ve “Geometri: çözüldü” satırı.',
    'Bir satır sarı ise o eksiği giderin. “Geometri: çözülemedi” yazıyorsa altındaki sebep '
      + 'kutusunu okuyun.',
    'Model tamamsa ve en az bir devir noktası girdiyseniz <strong>▶ Hesapla</strong> düğmesi '
      + 'etkinleşir. Basın.',
    'Düğmenin altında sonuç blokları belirir. Bir hata varsa sebep aynı yerde yazılır.'
  ]);
  h += _gfAlanTablo('“Hesapla” pasifse', [
    ['Model veya çevrim eksik', 'Geometri çözülmedi ya da hiç devir noktası yok',
      'Algılanan Model tablosundaki sarı satırı giderin; çalışma çevrimine en az bir satır '
      + 'ekleyin'],
    ['Kasnak sayısı yetersiz', 'Kayış Tablosu’nda üçten az satır var',
      'Tablonun <strong>＋ Kasnak ekle</strong> listesinden eksikleri ekleyin'],
    ['Sürücü kasnak yok', 'Hiçbir kasnakta sürücü rolü işaretli değil',
      'Sürücü olacak kasnağın panelini tablodaki adından açıp <em>Rol</em> kartında '
      + 'işaretleyin'],
    ['Kayış yolu kapanmıyor', 'Σ işaretli sarım 360° çıkmıyor',
      'Kayış Tablosu’ndaki <strong>sırayı</strong> (↑ ↓) ve <strong>dönüş yönlerini</strong> '
      + 'gözden geçirin; gerekirse Dönüş Yönü kartıyla bütün yolu çevirin (Bölüm 5)'],
    ['Kasnaklar çakışıyor', 'İki kasnağın çemberi kesişiyor — ortak teğet yok',
      'Tablodaki koordinatları ya da çapları düzeltin; program hangi çift olduğunu yazar'],
    ['Tasarım gerginliği türetilemedi', 'Kayış, gergi kolunun erişemeyeceği kadar kısa/uzun',
      'Yerleşimi ya da kayış boyunu gözden geçirin']
  ], ['Belirti', 'Sebep', 'Ne yapmalı']);

  h += '<h3>9.4 Girilmeyen alanlar — Gates arşivinden varsayılan</h3>';
  h += '<p>Bazı alanları elle girmek zordur: kasnak atalet momentleri, gergi kolunun '
    + 'ataleti ve kasnak kütlesi, kayış boy toleransı, uzama+aşınma payı, gerginin mekanik '
    + 'durdurucusu, kayış boyu ofseti. Bunlar <strong>boş bırakılırsa</strong> program '
    + 'onları on dört tedarikçi raporundan çıkarılmış ölçümlerle doldurur ve '
    + '<strong>hangilerini doldurduğunu yazar</strong>.</p>';
  h += _gfAlanTablo('Varsayılanın kaynağı', [
    ['Atalet momentleri', 'Aksesuar tipine göre medyan',
      'Gates “System Vibration Analysis” sayfası, yedi rapor. Avara · klima · alternatör · '
      + 'gergi kasnağı · gergi kolu · kasnak kütlesi · krank mili'],
    ['Kayış boy toleransı ±', 'Boya göre iki basamak',
      'Arşivde temiz bir ayrım var: 1013–1392 mm’lik yedi kayışın hepsi ±5, 1475–1739 mm’lik '
      + 'yedisinin hepsi ±6 mm'],
    ['Uzama + aşınma payı', '%0,70',
      'On dört sistemin onunda tam bu değer; sapanların hepsi ALTINDA, yani %0,70 aynı '
      + 'zamanda emniyetli yön'],
    ['Mekanik durdurucu', 'Nominal dönüş × 1,8',
      'Önce gergi künye kütüphanesinden okunur (12 künye ölçülmüş değerini taşıyor). Künye '
      + 'uygulanmamışsa ölçeklenir — ve <strong>yalnız daraltır</strong>: çekirdeğin kendi '
      + 'erişim sınırından büyük çıkarsa hiç uygulanmaz'],
    ['Kayış boyu ofseti', '1,3 mm',
      'Fiziksel bir sabit değil; tedarikçinin çözdüğü geometrik boy ile sipariş edilen '
      + '<em>katalog</em> boyu arasındaki yuvarlama artığı. Ölçülen beş değer 0,4 … 2,0 mm']
  ], ['Alan', 'Varsayılan', 'Nereden']);
  h += _gfUyari('Varsayılan bu sistemin değeri DEĞİL',
      'Bunlar başka araçların raporlarından çıkarılmış <strong>medyanlardır</strong> ve bir '
    + 'mertebe göstergesidir. Elinizdeki tedarikçi raporunda karşılığı varsa onu girin — '
    + 'varsayılan o anda devreden çıkar. Program varsayılanı <strong>modelinize yazmaz</strong>: '
    + 'alan boş kalır, böylece “girdim” ile “varsayıldı” bir daha karışmaz. Hangi alanın '
    + 'varsayıldığı Kayış Yolu · Çözücü · Kayış Özellikleri panellerinde ve ayrıntılı raporun '
    + '§8 girişinde listelenir.');
  h += _gfNot('Sıfır girmek, boş bırakmak DEĞİLDİR',
      'Toleransa <strong>0</strong> yazmak “zarfı kapat” demektir ve geçerli bir seçimdir; '
    + 'varsayılan onu ezmez. Varsayılan yalnız <em>hiç dokunulmamış</em> alana iner.');
  h += _gfNot('Her tipin varsayılanı yok',
      'Su pompası, direksiyon pompası ve hava kompresörü arşivdeki yedi raporun hiçbirinde '
    + 'geçmiyor. Bu tiplerin ataleti <strong>uydurulmuyor</strong> — rotorun ataleti kasnak '
    + 'çapından türetilemez ve “makul ama yanlış” bir sayı burulma frekansını sessizce '
    + 'kaydırırdı. Böyle bir kasnak modeldeyse burulma modeli kurulmaz ve sebebini yazar.');
  return h;
}

function _gfSec11(){
  var h = _gfH2(10);
  h += '<p>Sonuçların <strong>dört okuma yüzeyi</strong> vardır: Kayış Yolu şeması, Kayış '
    + 'Tablosu, paneller ve rapor. Hangi sayının nerede durduğunu bilmek, panel panel '
    + 'aramaktan hızlıdır.</p>';
  h += '<h3>11.1 İki tuval kartı — Kayış Yolu ve Çalışma Noktası</h3>';
  h += '<p>Tuvalde <strong>iki</strong> ölçekli kart durur ve ikisi de aynı çizimden geçer. '
    + 'Ayrım ölçü değil <strong>soru</strong>dur:</p>';
  h += _gfAlanTablo('İki kart, iki soru', [
    ['<strong>Kayış Yolu</strong>', 'Model <em>kurulurken</em> sorulan soru: geometri doğru mu?',
      'Şema · adlar · sarım açıları · diş sırası · gergi kolu ve montaj ekseni · kol konumları · '
      + 'yön gülü · dönüş okları. <strong>Donuk</strong> — animasyon yükü hiç üretmez'],
    ['<strong>Çalışma Noktası</strong>', 'Devir <em>seçilince</em> sorulan soru: bu noktada ne oluyor?',
      'Gerilme haritası · açıklık gerilmeleri · animasyon · titreşim ve genlik. '
      + '<strong>Canlı</strong> — iki seçicisi var: devir ve titreşim']
  ], ['Kart', 'Hangi soru', 'Ne taşır']);
  h += _gfNot('Kol konumu TEK alandır',
      'İki kart aynı kol konumunu çizer ve o alan <strong>Kayış Yolu düğümünde</strong> '
    + 'durur. Çalışma kartı kendi alanını tutsaydı ikisi farklı konum çizerdi ve fark '
    + '<strong>sessiz</strong> olurdu: her kart kendi içinde tutarlı görünür, yalnız biri '
    + 'başka bir konumu anlatır.');
  h += _gfSahneSema();
  h += '<p>Şemanın işaretleri:</p>';
  h += _gfAlanTablo('Kartta ne var', [
    ['Turuncu yol', 'Çözücünün teğet noktaları ve işaretli sarım yayları'],
    ['Yol üstündeki dişler', 'Kayışın <strong>kaburgalı yüzü</strong> — kaburgalı temas edende '
      + 'kasnağın içine, sırttan temas edende dışarı bakar'],
    ['Kesikli çember', 'Kayış o kasnağa <strong>sırttan</strong> değiyor'],
    ['Kasnak içi ok', 'Dönüş yönü (sırttan temas edende ters döner)'],
    ['Yeşil artı ve kesikli çizgi', 'Gerginin <strong>montaj konumu</strong> ve kolu'],
    ['Yön gülü', 'Açı konvansiyonu — sürüklenebilir, çift tıkla varsayılana döner'],
    ['Soluk gri yollar', 'Kolun gezdiği diğer konumlar (“TÜMÜ” kipinde)'],
    ['Üst künye', 'Çizilen konumun adı · kol açısı · gerginlik. <strong>Kasnak künye '
      + 'tablosu kartta değildir</strong> — ad · Ø · sarım · devir · güç sütunlarını '
      + 'Kayış Tablosu yazıyor, aynı sayıyı iki yüzeyde tutmamak için kalktı'],
    ['<strong>Alt şerit</strong>', '<strong>✓/✗ · kasnak sayısı · efektif boy · Σ sarım</strong> '
      + '— Σ sarım 360,00° olmak zorundadır'],
    ['Alt şeritteki seçici', 'Gergi kol konumu (Kayış Yolu kartında <strong>tek</strong> seçici budur)']
  ], ['İşaret', 'Ne söylüyor']);
  h += _gfSahneCalisma();
  h += _gfNot('Çalışma Noktası kartı çalışır',
      'Çalışma Noktası kartının devir seçicisinden bir çalışma noktası seçerseniz kayış akar ve kasnaklar '
    + 'döner. Hareket <strong>ağır çekimdir</strong> ama oranlar birebir doğrudur: hangi kasnak '
    + 'ne kadar hızlı döner, hangisi <strong>ters</strong> döner, kayış ne kadar hızlı gider — '
    + 'üçü de gerçek çözümden gelir. Gerçek zamanlı gösterilseydi en yavaş çalışma noktasında '
    + 'bile kayış kare başına on diş atlar, alternatör de görsel olarak ters yönde dönüyor '
    + 'görünürdü.');
  h += '<h4>11.1.1 Senaryo — motor çevrimi</h4>';
  h += '<p>Devir seçicisinin son seçeneği sabit bir devir değil, bir '
    + '<strong>senaryodur</strong>: <em>durgun → marş → ateşleme → rölanti → hızlanma → '
    + 'yavaşlama → stop</em>. Sabit devirde göremediğiniz şeyi gösterir — devir değişirken '
    + 'gerginliğin, gergi kolunun ve açıklık çırpınmasının ne yaptığını.</p>';
  h += _gfUyari('Devir geçmişi DAYATILIR, simüle edilmez',
      'Senaryo bir motor dinamiği çözümü <strong>değildir</strong>: MFSim’in FEAD modelinde '
    + 'volan ataleti yoktur (modeldeki krank ataleti burulma modelinin girdisidir). Devir '
    + 'eğrisi <strong>dayatılır</strong> — rampanın dikliği Çözücü panelindeki '
    + '<em>İvmelenme</em> / <em>Yavaşlama</em> alanlarınızdan, şekli motorun tork eğrisinden '
    + 'gelir. Gerginlik, hubload ve çırpınma o dayatılmış devirde <strong>gerçekten</strong> '
    + 'hesaplanır; devrin kendisi bir girdidir, bir sonuç değil.');
  h += '<h3>11.2 Kayış Tablosu ve tuval rozetleri</h3>';
  h += '<p>Kasnakların kutusu olmadığı için tuvalde yalnız <strong>araç kartlarının</strong> '
    + 'rozetleri kalır; kasnak başına okumalar Kayış Tablosu’ndadır.</p>';
  h += _gfAlanTablo('Nerede ne okunur', [
    ['<strong>Kayış Tablosu</strong>', 'Kasnak başına efektif çap · dönüş yönü · sarım · span; '
      + 'altta Σ toplam satırı, üstte künyede ✓/✗ Çevrim kapalı · Σsarım',
      'Sarım ve span <strong>çözümden</strong>; Σsarım 360,0° olmalı'],
    ['Kayış kartı rozeti', '<code>SABİT</code> (mavi) ↔ <code>SERBEST</code> (amber)',
      'Tıklanabilir; avara merkezi girdiyken kilitli'],
    ['Dönüş Yönü kartı rozeti', '<code>↺ CCW</code> ↔ <code>↻ CW</code>',
      'Tıklanabilir; <strong>rengi</strong> gergi tarafı hükmünü taşır (Bölüm 5.2)']
  ], ['Nerede', 'Ne yazar', 'Not']);
  h += '<h3>11.3 Paneller</h3>';
  h += _gfAlanTablo('Hangi sonuç hangi panelde', [
    ['<strong>Kayış Tablosu</strong>', 'Kasnak başına efektif çap · dönüş yönü · sarım açısı · '
      + 'span; Σ toplam satırı ve üst künyede Σsarım', 'Hayır'],
    ['Gergi paneli', 'Türeyen montaj konumu · serbest kol açısı · gereken kayış boyu · '
      + 'tasarım gerginliği · konum pimi', 'Hayır'],
    ['Kayış paneli', 'Türetilen boy ve hangi kol açısından geldiği · katalog aday tablosu · '
      + 'kapatılan çıktıların listesi', 'Hayır'],
    ['Kayış Yolu paneli', 'Geometri tablosu: kasnak · temas · çıkış açıklığı · sarım · hız '
      + 'oranı; altında efektif boy, pitch boyu ve Σ sarım', 'Hayır'],
    ['Çözücü paneli — üst', 'Algılanan Model · <strong>Gergi Konum Tablosu</strong> (altı '
      + 'konum × kol açısı, gerginlik, hubload, yön, β, sarım) · '
      + '<strong>Uygunluk Kapıları</strong> · uyarılar', 'Hayır'],
    ['Çözücü paneli — alt', 'Çıkış gerilmeleri ve min. kayma emniyeti hükmü · hubload · '
      + 'burulma titreşimi · kaburga yorulma dağılımı · B10 ömür · geçerlilik sınırları',
      '<strong>Evet</strong>'],
    ['Rapor kutusu', 'Detaylı ya da Özet HTML belge', '<strong>Evet</strong>']
  ], ['Panel', 'Ne okunur', 'Hesapla gerekir mi']);
  h += '<h3>11.4 Uygunluk kapıları — üç hüküm</h3>';
  h += '<p>Çözücü panelindeki <strong>Uygunluk Kapıları</strong> kartı, BMC’nin kendi FEAD '
    + 'hesap defterinden gelen üç kuralı model üzerinde ölçer. Kart <strong>çözüm '
    + 'gerektirmez</strong>: geometri ve künyeler tamamsa hüküm oradadır.</p>';
  h += _gfTablo('Üç kapı',
    ['Kapı', 'Kural', 'Hüküm mü, uyarı mı'],
    [
      ['Kasnak merkez mesafesi',
        '0,7·(d₁+d₂) ≤ a ≤ 2·(d₁+d₂) — her kasnak çifti için; tablo alt sınır, a, üst sınır '
        + 've <strong>pay yüzdesini</strong> yazar',
        '<strong>Uyarı</strong> — tasarımı reddetmez'],
      ['Çevrim oranı penceresi',
        'Motor <em>governed</em> devrindeyken her aksesuarın devri, kendi '
        + '<em>optimum … maksimum sürekli</em> bandına düşüyor mu',
        '<strong>Hüküm</strong>'],
      ['Aksesuar devir sınırı',
        'Çalışma çevriminin her noktasında aksesuar devri, sürekli ve anlık maksimumun '
        + 'altında mı',
        '<strong>Hüküm</strong>']
    ], ['l', 'l', 'c']);
  h += _gfUyari('Merkez mesafesi kuralı neden yalnız uyarı',
      'O kural <strong>iki kasnaklı V-kayış tahrikleri</strong> için yazılmıştır: orada '
    + 'açıklığı yalnız iki kasnağın arası belirler. Serpantin bir tahrikte açıklığı '
    + '<strong>bütün yerleşim</strong> belirler, dolayısıyla kuralın ihlali tek başına '
    + 'tasarımı geçersiz kılmaz. Program sayıyı gizlemez — payı yazar ve sınıra ne kadar '
    + 'kaldığını söyler; hükmü size bırakır. Diğer iki kapı hükümdür.');
  h += _gfNot('Eksik veri “uygun” demek değildir',
      'Bir aksesuarın devir sınırları girilmemişse (Bölüm 6.2) o satır '
    + '<strong>“değerlendirilemedi”</strong> olur ve <strong>uygun sayılmaz</strong>. Boş '
    + 'bir kapıyı geçilmiş saymak, bu modülün en pahalı hata sınıfının — “makul ama yanlış” '
    + 'sonucun — tam örneği olurdu.');
  h += _gfSahneKapilar();
  h += _gfNot('Panel ve rapor aynı çağrıyı paylaşır',
      'Kapılar tek bir yerden hesaplanır. Panel <strong>canlı</strong> ölçer; rapor ise '
    + '<strong>çözüm anında</strong> yazılan sonucu okur, yeniden hesaplamaz. Aksi hâlde '
    + 'çözümden sonra değiştirdiğiniz bir devir sınırı belgeye sızar ve rapor kendi '
    + 'sayılarıyla çelişirdi.');
  h += '<h3>11.5 Kayma emniyetini doğru okumak</h3>';
  h += '<p>Çıkış gerilmeleri tablosunun son sütunu <strong>Min SF</strong>’dir ve bütün '
    + 'kasnakların en küçüğünü basar. Bu sayı servis faktörünün altına düştüğünde önce '
    + '<strong>hangi kasnak</strong> olduğuna bakın.</p>';
  h += _gfUyari('Oran ≈ 1 iken emniyet faktörü bir marj değildir',
      'Avara ve gergi kasnakları kayıştan <strong>güç çekmez</strong>: giriş ve çıkış '
    + 'gerilmeleri neredeyse eşittir, yani gerginlik oranı 1’e çok yakındır. Orada emniyet '
    + 'faktörü bir <em>marj</em> değil, o sarım açısının <strong>kapasitesidir</strong> — '
    + 'taşıyabileceği azami oran. Servis faktörü ise talebin üzerine konan bir marjdır; talep '
    + 'yokken anlamsızdır.<br><br>'
    + 'Yük taşıyan kasnaklarda oran belirgin biçimde 1’in üstündedir ve emniyet faktörleri '
    + 'çoğunlukla iki mertebe yüksektir. <strong>Rapor hükmünü yalnız yük taşıyanların en '
    + 'küçüğünden verir</strong>; panel tablosu ise ham en küçüğü gösterir. Bölüm 14’te bu '
    + 'ayrımın sayısal karşılığı var.');
  return h;
}

function _gfSec12(){
  var h = _gfH2(11);
  h += '<p><strong>Rapor</strong> kutusuna çift tıklayın. Rapor çözülmüş modelden üretilir; '
    + 'model çözülmemişse düğme pasiftir ve sebebi yazılır.</p>';
  h += _gfAdimlar([
    'Rapor türünü seçin: <strong>Detaylı</strong> ya da <strong>Özet</strong>.',
    '<strong>Doküman künyesi</strong> alanlarını doldurun: hazırlayan, doküman no, revizyon, '
      + 'tasarım notları. Bunlar antete ve belgenin sonundaki notlar bölümüne akar.',
    '<strong>Raporu Oluştur ve İndir</strong> düğmesine basın. İlk üretimde yazı tipleri ve '
      + 'formül dizgisi (~1 MB) bir kez yüklenir.',
    'İnen dosya tek parçadır ve çevrimdışı açılır; yazdırırsanız A4’e sığar.'
  ]);
  h += _gfSahneRapor();
  h += _gfAlanTablo('İki rapor türü', [
    ['Detaylı', 'Teori bölümleri 1–7 ve 9–10 · Ek A · çözümün sayısal bölümü (18 alt bölüm) · '
      + 'uygunluk hükmü', 'Yöntemi de belgelemek, hesabı denetletmek'],
    ['Özet', 'Tedarikçi çıktısının biçiminde altı sayfa: Genel Bakış · Geometri · Gergi '
      + 'Çalışma Zarfı · Çalışma Çevrimi ve Torklar · Gerginlik ve Hubload · Dayanım ve '
      + 'Titreşim', 'Sonuçları paylaşmak, tedarikçi raporuyla yan yana koymak']
  ], ['Tür', 'İçerik', 'Ne zaman']);
  h += _gfNot('Rapor çözülen modeli anlatır',
      'Belge, <strong>Hesapla</strong>’ya bastığınız andaki modeli anlatır. Çözümden sonra bir '
    + 'alanı değiştirirseniz o değişiklik rapora sızmaz — belge kendi sayılarıyla çelişmez. '
    + 'Değişikliği rapora yansıtmak için yeniden çözün.');
  return h;
}

function _gfSec13(){
  var h = _gfH2(12);
  h += '<p>Bu modülde en pahalı hata sınıfı çöken model değil, <strong>“makul ama yanlış” '
    + 'sayıdır</strong>: model çözülür, tablolar dolar, hiçbir uyarı çıkmaz. Aşağıdakiler '
    + 'ölçülmüş bedelleriyle birlikte duruyor.</p>';
  h += _gfTablo('Sessiz hata sınıfları',
    ['Alan', 'Yanlış verilirse ne olur', 'Ölçülen bedel'],
    [
      ['Temas tarafı', 'Geçerli ama <strong>başka</strong> bir kayış yolu çözülür; Σ sarım '
        + 'yine 360 çıkar', 'Bir sistemde sarım 207,7° yerine 172,2° — <strong>−35,5°</strong>'],
      ['Gergi montaj konumu', 'Kasnak merkezi montaj konumu sanılırsa model yine çözülür; '
        + 'program iki noktayı karşılaştırmadığı için uyarı da çıkmaz',
        'Gerginlik medyan <strong>+%1526</strong> · 5/14 sistemde uyarı YOK'],
      ['Kol boyu', 'Yanlış girilirse türeyen kasnak merkezi kol boyu kadar kayar; kayış yolu '
        + 'yine kapanır', 'Bu örnekte 90 mm’lik bir kayma — kasnak sürücünün içine düşebilir'],
      ['Birinci kademe oranı', 'Elle yazılmış hız oranı çaptan hesaplananla çelişir',
        'Bütün gerilmeler aynı oranda kayar — bir veri setinde <strong>%2,7</strong>'],
      ['Dönüş yönü', 'Gergi kayışın gergin tarafına düşer',
        'Açıklık gerilmeleri ankrajın altına iner, bir kısmı <strong>negatife</strong> döner'],
      ['Kayış sırası', 'Tablo satırları raporun sırasında değilse başka bir serpantin '
        + 'çözülür; çevrim yine kapanabilir',
        'Sarım dağılımı ve açıklıklar baştan başka — <strong>gergi de yanlış tarafa</strong> '
        + 'düşebilir'],
      ['Aksesuar devir sınırı', 'Girilmezse uygunluk kapısı hüküm veremez',
        'Kapı <strong>“değerlendirilemedi”</strong> olur ve <strong>uygun sayılmaz</strong> — '
        + 'geçilmiş sanmayın'],
      ['Gergi kasnak kütlesi', 'Girilmezse nokta kütle terimi eksik kalır',
        'Birinci burulma modu <strong>+%32</strong> (15,3 yerine 20,3 Hz)'],
      ['Aşınma payı', '<strong>Oran</strong> olarak girilir (0,007), yüzde olarak değil',
        'Yüz kat sapma'],
      ['Künye karışımı', 'Gergi koordinatı bir belgeden, kayış künyesi başka belgeden alınır',
        'Model iki farklı sistemi anlatır — sapma <strong>üç katına</strong> çıkar']
    ], ['c', 'l', 'l']);
  h += _gfNot('Ortak kural: geçerlilik sınırı sonucun içinde taşınır',
      'Bir sayı kalibre edilmemişse başlığında damgası, altında ölçülen sapma bandı vardır; '
    + 'kapatılmış bir çıktı listelenerek yazılır. “Boş görünmeyen ama denetlenmemiş” bir tablo '
    + 'bu modülde bilerek bırakılmaz. Panelde ya da raporda bir uyarı görürseniz onu bir '
    + 'ayrıntı değil, sonucun parçası sayın.');
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

  delete kayis.data.effLength;

  var build;
  try { build = veFeadBuildSystem(pack.nodes); } catch(e){ return null; }
  if(!build || !build.ok) return null;

  var R = null;
  try {
    R = veFeadAnalyze(build, {
      rows: veFeadDutyRows(cozucu),
      cylinders: Number(cozucu.data.cylinders) || 6,
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
  return (p >= 0 ? '+' : '') + _gfFs(p, 2) + '%';
}

function _gfSec14(){
  var h = _gfH2(13);
  h += '<p>Bu bölüm kılavuzun tamamını tek bir örnek üzerinde tekrarlar. Modellenen sistem '
    + 'gerçek bir araca aittir: altı kasnaklı, ikincil tahrikli bir FEAD düzeni. Çıkan sayılar, '
    + 'aynı sistem için kayış tedarikçisinin ürettiği rapordaki değerlerle yan yana '
    + 'konuyor.</p>';

  var O = _gfOrnekCoz();
  if(!O){
    h += _gfUyari('Örnek bu oturumda çözülemedi',
        'İşlenmiş örnek belge üretilirken canlı hesaplanır ve bu kez zincir kurulamadı. '
      + 'Kılavuzun geri kalanı etkilenmez; örneği programda <strong>Başlangıç Sihirbazı → '
      + '1 · Başlangıç → AG00976</strong> ile kendiniz kurabilirsiniz.');
    return h;
  }
  var b = O.build, R = O.R, G = VE_GUIDE_FEAD_GATES;
  var td = O.gergi.data;

  // ── 14.1 Girdiler ────────────────────────────────────────────────────────
  h += '<h3>14.1 Elimizdeki veri</h3>';
  h += '<p>Tedarikçi raporundan okunan koordinatlar ve künyeler. Bu tabloya girmeyen hiçbir '
    + 'şey modele girmez — geri kalan her sayı bunlardan türeyecek.</p>';

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

  h += _gfOnay('Gergi satırı da bir KASNAK MERKEZİDİR',
      'Altı satırın altısında da X/Y aynı şeydir: <strong>kasnağın merkezi</strong>. '
    + 'Gerginin farkı koordinatında değil, kasnağının bir <em>kolun ucunda</em> '
    + 'olmasında — kol gezindikçe o merkez bir yay çiziyor ve tabloya giren, '
    + 'çalışma (Mean) konumundaki hâlidir.<br><br>'
    + 'Tedarikçiye giden FEAD bilgi sayfası da, tedarikçiden dönen raporun '
    + '<em>Layout Data</em> tablosu da gergi satırında bunu veriyor. Gövdenin motora '
    + 'cıvatalandığı nokta (<em>Tensioner Data → Pivot Point</em>) <strong>modele hiç '
    + 'girmiyor</strong>: program onu kol boyu ve kol çalışma açısından türetiyor ve '
    + '14.2’de raporun kendi satırıyla karşılaştırıyor.');

  h += _gfTablo('Gergi ve kayış künyeleri — girilen değerler',
    ['Alan', 'Değer', 'Nereden'],
    [
      ['Avara kasnağının merkezi',
        _gfF(td.cenX, 2) + ' / ' + _gfF(td.cenY, 2) + ' mm',
        'Raporun <em>Layout Data</em> tablosunun gergi satırı — panelde '
        + '“Avara Kasnağının Merkezi”'],
      ['Kol boyu', _gfF(td.armLen, 1) + ' mm', 'Raporun <em>Tensioner Data</em> bölümü'],
      ['Kol çalışma açısı', _gfFs(td.armMeanDeg, 2) + '°',
        'Gerginin parça/montaj çizimi — gövdenin montajdaki saat konumu'],
      ['Yay ön yükü', _gfF(td.preload, 2) + ' Nm', 'Aynı bölüm'],
      ['Yay katsayısı', _gfF(td.kArm, 3) + ' Nm/°', 'Aynı bölüm'],
      ['Çalışma momenti', _gfF(td.meanLoad, 2) + ' Nm', 'Aynı bölüm'],
      ['Kayış profili', _gfE((O.kayis.data.profile || '—') + ' · '
        + (O.kayis.data.ribs || '—') + ' kanal'), 'Kayış künyesi'],
      ['Kayış efektif boyu', '<em>girilmedi — çıktı olacak</em>', '—']
    ], ['l', 'c', 'l']);

  h += _gfOnay('Kayış boyu bilerek boş bırakıldı',
      'Kayış boyu bu modülde bir <strong>çıktıdır</strong>: kasnak merkezleri ve gergi '
    + 'künyesi verildiğinde kolun nominal yay yükünde oturduğu yer bellidir, kapanan '
    + 'kayış yolunun boyu da onunla. Boy girilseydi program onu kullanır ve aşağıdaki '
    + 'karşılaştırma anlamını yitirirdi — model, bulması gereken sayıyı zaten okumuş '
    + 'olurdu.');

  // ── 14.2 Türeyen değerler ────────────────────────────────────────────────
  h += '<h3>14.2 Program neyi hesapladı</h3>';
  h += '<p>Kasnaklar Kayış Tablosu’na girilip sıraya dizildikten ve gergi künyesi girildikten '
    + 'sonra <strong>Avara Hareketi</strong> kartının okuduğu değerler. Üçüncü satır '
    + '14.1’deki ayrımın karşılığıdır: <strong>gergi gövdesinin montaj konumu bir girdi '
    + 'değil, avara merkezinden ve kol çalışma açısından türeyen bir sonuçtur</strong> — '
    + 've tedarikçi raporunun <em>Tensioner Data</em> satırına oturur.</p>';

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
      '<strong>Bir:</strong> program kayışı <strong>hiç görmeden</strong> tedarikçinin kendi '
    + 'kayışını geri verdi. Kolun oturduğu yer yalnız yay künyesinden türüyor '
    + '(M<sub>çalışma</sub>, M<sub>ön</sub>, k); kayış verisi hesaba hiç girmiyor. Bu, kayış '
    + 'boyunun bir çıktı olabilmesinin ön koşuludur — aksi hâlde döngü kurulurdu.<br><br>'
    + '<strong>İki:</strong> yalnız avara merkezi, kol boyu ve kol açısından türetilen '
    + '<em>montaj konumu</em>, raporun <em>Tensioner Data → Pivot Point</em> satırından '
    + '<strong>' + _gfFs(dPivot, 3) + ' mm</strong> uzakta. O satır modele hiç girmedi. '
    + 'Aradaki mesafe basım yuvarlaması düzeyinde — girilen noktanın gerçekten '
    + '<strong>avara kasnağının merkezi</strong> olarak kullanıldığının kanıtı bu.');

  h += _gfNot('Kol çalışma açısını program SEÇMEZ',
      'Avara merkezi verildikten sonra kayış yolu tamamen belirlidir: teğet noktaları, '
    + 'sarımlar ve efektif boy kolun saatinden <em>bağımsızdır</em>. Geriye kalan tek '
    + 'serbestlik derecesi gövdenin montajdaki saat konumudur ve o bir '
    + '<strong>paketleme</strong> kararıdır — motor bloğunda cıvata deliğinin nereye '
    + 'açıldığı. Bir dönem program bunu bir ölçütten seçiyordu; girdi montaj konumundan '
    + 'avara merkezine dönünce ölçüt çöktü. Ölçüldü: 14 tedarikçi sistemi üzerinde sekiz '
    + 'aday ölçütün en iyisi bile yalnız <strong>2/14</strong> sistemi ±5° içinde buluyor '
    + '(aci farkinin medyani 20,7°). Sebep ölçütün yanlış yeri seçmesi değil, '
    + '<strong>hiçbir yeri seçememesi</strong>: merkez sabitken çalışma noktasındaki '
    + 'kayış yolu kol açısından bağımsız (ölçüldü: <strong>4,55e−13 mm</strong>, '
    + '6 sistem × 548 açı) ve ölçüt eğrisi düzleşiyor — %1 platosu '
    + '2,1° → <strong>24,1°</strong>. Bu yüzden açı bir girdidir ve uydurulmuş bir '
    + 'varsayılanı yoktur.');

  // ── 14.3 Şema ────────────────────────────────────────────────────────────
  var svg = null;
  try {
    if(typeof veFeadLayoutSVG === 'function')
      svg = veFeadLayoutSVG(b, 820, 380, { posMode:'mean', compass:true, pivot:true, arrows:true });
  } catch(e){ svg = null; }
  if(svg){
    h += '<h3>14.3 Çözülmüş kayış yolu</h3>';
    h += '<figure class="appfig">' + svg + '<figcaption><b>Şekil ' + _gfFig() + ' —</b> '
      + 'Programın Kayış Yolu kartında gördüğünüz şemanın aynısı. Çizimde elle yerleştirilmiş '
      + 'tek bir koordinat yoktur: kasnak çemberleri girilen konum ve çaplardan, kayış yolu '
      + 'çözücünün teğet noktaları ve işaretli sarım yaylarından üretilir. Yol üstündeki '
      + 'dişler kayışın kaburgalı yüzünü gösterir; yeşil artı gerginin montaj konumudur '
      +'ve kesikli '
      + 'çizgi koldur.</figcaption></figure>';
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
    h += _gfNot('İki farklı uzunluk — karıştırmayın',
        'Kayışın <strong>kendi efektif boyu</strong> ' + _gfFs(b.beltLengthMm, 2) + ' mm; '
      + 'kayışın bu güzergâhta kat ettiği <strong>efektif tahrik boyu</strong> ise '
      + _gfFs(geom.LeffMm, 1) + ' mm. Aradaki fark Çözücü panelindeki <em>boy ofsetidir</em> '
      + '(bu örnekte ' + _gfF(O.cozucu.data.lengthOffsetMm, 2) + ' mm). Rapor ikisini ayrı '
      + 'adlandırır; antette yan yana durdukları için bir dönem aynı sayının iki kez basıldığı '
      + 'sanılıyordu.<br><br>'
      + 'Σ işaretli sarım <strong>' + _gfFs(geom.signedWrapDeg, 2) + '°</strong> — çevrim '
      + 'kapandı. Bu sayı 360 değilse geometri geçersizdir ve kartın alt şeridi ✗ yazar.');
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
      ['Kasnak', 'Gerilme [N]', 'Rapor', 'Hubload [N]', 'Rapor', 'Gerginlik oranı', 'SF'],
      ssat, ['l', '', '', '', '', '', '']);

    // Kayma emniyeti hükmü — YÜK TAŞIYAN ayrımıyla. Bu, kılavuzun §11.4'te
    // anlattığı okuma kuralının sayısal karşılığı; ayrım yapılmasaydı belge
    // kendi tavsiyesiyle çelişirdi.
    var esik = (typeof VE_FEAD_SLIP_LOADED_RATIO === 'number') ? VE_FEAD_SLIP_LOADED_RATIO : 1.01;
    var yuklu = [], hepsi = [];
    d0.slip.forEach(function(s, i){
      hepsi.push({ ad: isim[i], SF: s.SF, oran: s.tensionRatio });
      if(s.tensionRatio > esik) yuklu.push({ ad: isim[i], SF: s.SF, oran: s.tensionRatio });
    });
    function enKucuk(liste){
      var b0 = null;
      liste.forEach(function(x){ if(!b0 || x.SF < b0.SF) b0 = x; });
      return b0;
    }
    var gEn = enKucuk(hepsi), yEn = enKucuk(yuklu);
    var sfIst = Number(O.cozucu.data.serviceFact) || 0;
    if(gEn && yEn){
      h += _gfUyari('Aynı tablodan iki farklı hüküm çıkar',
          'Ham en küçük emniyet faktörü <strong>' + _gfFs(gEn.SF, 2) + '</strong> ve '
        + '<strong>' + _gfE(gEn.ad) + '</strong> kasnağına ait; servis faktörü '
        + _gfFs(sfIst, 2) + ' ile karşılaştırılırsa '
        + (gEn.SF >= sfIst ? 'geçer' : '<strong>kalır</strong>') + '. Ama o kasnağın '
        + 'gerginlik oranı <strong>' + _gfFs(gEn.oran, 4) + '</strong>, yani ~1: kayıştan '
        + 'güç çekmiyor, dolayısıyla oradaki sayı bir marj değil o sarım açısının '
        + '<strong>kapasitesidir</strong>.<br><br>'
        + 'Yük taşıyan kasnakların en küçüğü <strong>' + _gfFs(yEn.SF, 2) + '</strong> '
        + '(<strong>' + _gfE(yEn.ad) + '</strong>, oran ' + _gfFs(yEn.oran, 4) + ') ve '
        + 'servis faktörünü <strong>' + (yEn.SF >= sfIst ? 'karşılıyor' : 'karşılamıyor')
        + '</strong>. Rapor hükmünü bu ikinci sayıdan verir. Panelde ilk sütuna değil, '
        + '<strong>gerginlik oranına</strong> bakma alışkanlığı edinin.');
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
        'Kayış tipine bağlı çıktılar anahtarı <strong>kapalı</strong> (Bölüm 8.3)']);
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
          'Çözüm geometriden bir boy söyledi, katalog o boya en yakın adayı önerdi, ve '
        + 'önerilen kod tedarikçinin sisteme gerçekten taktığı kayıştır. Üç yol da aynı yere '
        + 'çıkmasaydı biri sessizce yanlış olurdu.');
    }
  }

  h += '<h3>14.7 Bu örneği kendiniz koşturmak</h3>';
  h += _gfAdimlar([
    'FEAD modülünde <strong>Başlangıç Sihirbazı</strong>nı açın.',
    'Birinci adımda <code>AG00976_GATES_2025</code> örneğini seçin ve son adımda '
      + '<strong>modeli kurun</strong>.',
    'Kayış Tablosu’nda gerginin <strong>adına tıklayarak</strong> panelini açın. '
      + '<strong>Avara Kasnağının Merkezi</strong> kartında '
      + '−161,97 / 91,29 yazdığını doğrulayın — örnek bu değeri raporun <em>Layout Data</em> '
      + 'tablosundan taşır.',
    '<strong>Kol Künyesi</strong> kartının altındaki türeyen montaj konumunun '
      + '−250,00 / 110,00 çıktığını görün: raporun <em>Tensioner Data → Pivot Point</em> '
      + 'satırı budur ve modele hiç girmedi.',
    'Çözücüde <strong>▶ Hesapla</strong>’ya basın ve yukarıdaki sayıları karşılaştırın.'
  ]);
  return h;
}

function _gfEkA(){
  var h = _gfH2(14);
  h += '<p>Bir alanı nerede bulacağınızı hatırlamak için. Panel adları programdaki '
    + 'başlıklarla birebir aynıdır.</p>';
  h += '<p>Kasnak ve gergi panelleri <strong>Kayış Tablosu’ndaki ada tıklanarak</strong> '
    + 'açılır; kalan paneller kendi araç kartlarına çift tıklanarak.</p>';
  h += _gfTablo('Alan → panel eşlemesi',
    ['Aradığınız', 'Panel', 'Kart'],
    [
      ['<strong>Kasnak eklemek / silmek</strong>', 'Kayış Tablosu',
        '＋ Kasnak ekle · satır ✕'],
      ['<strong>Kasnak konumu (X · Y) ve dış çapı</strong>', 'Kayış Tablosu',
        'X · Y · D sütunları (kasnak panelinde de var)'],
      ['<strong>Kayış sırası</strong>', 'Kayış Tablosu', '# sütunundaki ↑ ↓ okları'],
      ['<strong>Kasnak dönüş yönü</strong>', 'Kayış Tablosu', 'Kasnak Dönüş Yönü sütunu'],
      ['Efektif çap · sarım açısı · span · Σsarım', 'Kayış Tablosu',
        'Türeyen sütunlar ve üst künye'],
      ['Temas tarafı (ayrıntı) ve kasnak geometrisi', 'Kasnak',
        'Temas Tarafı · Kasnak Geometrisi'],
      ['Sürücü kasnak seçimi', 'Kasnak', 'Rol'],
      ['Aksesuar güç eğrisi', 'Kasnak', 'Katalog Modeli · Güç Eğrisi'],
      ['<strong>Aksesuar devir sınırları (optimum · sürekli · anlık)</strong>', 'Kasnak',
        'Devir Sınırları'],
      ['Gergi avarasının merkezi', 'Gergi', 'Avara Kasnağının Merkezi'],
      ['Kol boyu · kol çalışma açısı · türeyen montaj konumu', 'Gergi', 'Kol Künyesi'],
      ['Yay ön yükü, katsayısı, çalışma momenti', 'Gergi', 'Yay Künyesi'],
      ['Hazır gergi künyeleri', 'Gergi', 'Gergi Künye Kütüphanesi'],
      ['Serbest kol açısı · gereken kayış boyu · tasarım gerginliği · konum pimi',
        'Gergi', 'Avara Hareketi'],
      ['Gergi kasnak kütlesi, kol ataleti, load stop', 'Gergi', 'Mekanik Sınır ve Atalet'],
      ['Kayış profili ve markası', 'Kayış Özellikleri', 'Profil ve Marka'],
      ['Kanal sayısı, tolerans, aşınma payı', 'Kayış Özellikleri', 'Künye'],
      ['Kayış boyu kipi', 'Kayış Özellikleri', 'Kayış Boyu (ya da karttaki rozet)'],
      ['Katalog aday boyları', 'Kayış Özellikleri', 'Katalog'],
      ['<strong>Kaburga başına kütle</strong>', 'Kayış Özellikleri', 'Malzeme'],
      ['Kayış tipine bağlı çıktılar anahtarı', 'Kayış Özellikleri',
        'Kayış Tipine Bağlı Çıktılar'],
      ['Tahrik oranı / krank ve fan çapı', 'Çözücü', 'Birinci Kademe'],
      ['Silindir sayısı, servis faktörü, krank ataleti, <strong>motor kataloğu</strong>',
        'Çözücü', 'Motor Künyesi'],
      ['Devir, %zaman, sıcaklık, aksesuar kW, <strong>çevrim kaydı</strong>',
        'Çözücü', 'Çalışma Çevrimi'],
      ['Yorulma modeli ve boy ofseti', 'Çözücü', 'Tasarım'],
      ['Türeyen tasarım gerginliği', 'Çözücü', 'Algılanan Model'],
      ['Gergi kol konumları (altı konum)', 'Çözücü', 'Gergi Konum Tablosu'],
      ['<strong>Merkez mesafesi · çevrim oranı · devir sınırı hükmü</strong>', 'Çözücü',
        'Uygunluk Kapıları'],
      ['Sarım, açıklık, hız oranı', 'Kayış Yolu', 'Geometri'],
      ['Gergi kol konumu seçici, yön gülü', 'Kayış Yolu', 'Şema'],
      ['<strong>Devir ve titreşim seçicisi, gerilme haritası, senaryo</strong>',
        'Çalışma Noktası', 'Şema'],
      ['Rapor türü ve doküman künyesi', 'Rapor', '—'],
      ['Çevrimin dönüş yönünü çevirmek', 'Dönüş Yönü', 'Kayış Dönüş Yönü · Gergi tarafı']
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
    eyebrow: 'MFSim · FEAD Modülü · Kullanım Kılavuzu',
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
    title: 'MFSim — FEAD Modelleme Kılavuzu',
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
    _gfSahneGergi: _gfSahneGergi, _gfSahneKayis: _gfSahneKayis,
    _gfSahneCozucu: _gfSahneCozucu, _gfSahneRapor: _gfSahneRapor,
    _gfSahneSpin: _gfSahneSpin,
    veGuideFeadHTML: veGuideFeadHTML
  };
}
