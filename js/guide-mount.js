// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ ÇÖKME-TİTREŞİM KULLANIM KILAVUZU — rapor kozmetiğinde, yönlendirici
// ═══════════════════════════════════════════════════════════════════════════
//
// Kabuk ve kozmetik js/guide-kit.js'ten gelir; bu dosyada tek satır CSS yok.
// FEAD ve Araç Performans kılavuzlarıyla aynı iki kural:
//
//   1 · ÇÖZÜLMÜŞ MODEL GEREKTİRMEZ — tuval bomboşken okunabilir.
//   2 · ÖRNEĞİN SAYILARI ELLE YAZILMAZ — §14 gerçek çekirdeği koşturur.
//
// BU MODÜLDE İKİNCİSİ EN TEMİZ HÂLİNDE: `veMountCore` DOM'suz ve açık model
// kabul ediyor (`buildModel` → `solveAllCases` / `solveModal`), yani Araç
// Performans kılavuzunun yapmak zorunda kaldığı global takası burada GEREKMİYOR.
// Kullanıcının tuvaline hiçbir şekilde dokunulmuyor.
//
// Ad öneki `_gm…` / `veGuideMount…` (source-hygiene: `_gf` FEAD kılavuzunun,
// `_ga` Araç Performans kılavuzunun, `_gk` kabuğun, `_mnt` sunumun,
// `_r` Takoz raporunun).

function _gmF(v, d){ return (typeof _frF === 'function') ? _frF(v, d) : String(v); }
function _gmFs(v, d){ return (typeof _frFs === 'function') ? _frFs(v, d) : String(v); }
function _gmE(s){ return (typeof _gkEsc === 'function') ? _gkEsc(s) : String(s); }

var _gmTblNo = 0;
function _gmTbl(){ return ++_gmTblNo; }

function _gmAdimlar(satirlar){
  return '<ol>' + satirlar.map(function(s){ return '<li>' + s + '</li>'; }).join('') + '</ol>';
}

// HER SÜTUN `td.l` — raporun `td` varsayılanı bir SAYIDIR (mono, sağa dayalı,
// nowrap) ve cümle taşıyan hücrede yatay taşma üretir.
function _gmAlanTablo(baslik, satirlar, basliklar){
  var b = basliklar || ['Alan', 'Ne yazılır', 'Nereden bulunur'];
  var h = '<table><caption>Tablo ' + _gmTbl() + ' — ' + _gmE(baslik) + '</caption>';
  h += '<tr>' + b.map(function(t){ return '<th>' + _gmE(t) + '</th>'; }).join('') + '</tr>';
  satirlar.forEach(function(r){
    h += '<tr>' + r.map(function(c){ return '<td class="l">' + c + '</td>'; }).join('') + '</tr>';
  });
  return h + '</table>';
}

function _gmTablo(baslik, basliklar, satirlar, hizalar){
  var h = '<table><caption>Tablo ' + _gmTbl() + ' — ' + _gmE(baslik) + '</caption>';
  h += '<tr>' + basliklar.map(function(t){ return '<th>' + _gmE(t) + '</th>'; }).join('') + '</tr>';
  satirlar.forEach(function(r){
    h += '<tr>' + r.map(function(c, i){
      var cls = (hizalar && hizalar[i]) ? ' class="' + hizalar[i] + '"' : '';
      return '<td' + cls + '>' + c + '</td>';
    }).join('') + '</tr>';
  });
  return h + '</table>';
}

function _gmNot(baslik, govde){ return veGuideNote('', baslik, govde); }
function _gmUyari(baslik, govde){ return veGuideNote('warn', baslik, govde); }
function _gmOnay(baslik, govde){ return veGuideNote('check', baslik, govde); }

var VE_GUIDE_MOUNT_SECTIONS = [
  ['m1',  '1',    'Bu kılavuz nasıl kullanılır'],
  ['m2',  '2',    'Modülün haritası'],
  ['m3',  '3',    'Modüle girmek'],
  ['m4',  '4',    'Kütle gövdelerini tanımlamak'],
  ['m5',  '5',    'Tahrik ve tork'],
  ['m6',  '6',    'Takozları yerleştirmek'],
  ['m7',  '7',    'Takoz kütüphanesi ve nonlineer eğri'],
  ['m8',  '8',    'Yük durumları'],
  ['m9',  '9',    'Çözücü'],
  ['m10', '10',   'Sehim sonuçlarını okumak'],
  ['m11', '11',   'Modal analiz ve izolasyon'],
  ['m12', '12',   'Rapor üretmek'],
  ['m13', '13',   'Sık yapılan hatalar'],
  ['m14', '14',   'Sayısal örnek: BMC Siper'],
  ['m15', '15',   'Parametrik analiz: katalogdan seçim'],
  ['mEk', 'Ek A', 'Alan → pencere hızlı başvurusu']
];

function _gmH2(i){
  var s = VE_GUIDE_MOUNT_SECTIONS[i];
  return veGuideH2(s[0], s[1], s[2]);
}

// ═══════════════════════════════════════════════════════════════════════════
//  BÖLÜMLER
// ═══════════════════════════════════════════════════════════════════════════

function _gmSec1(){
  var h = _gmH2(0);
  h += '<p>Bu belge, MFSim’in <strong>Takoz Çökme-Titreşim</strong> modülünü kullanarak bir '
    + 'güç grubunun elastomer takoz bağlantısını modelleme işini <strong>adım adım</strong> '
    + 'anlatır. Model 6 serbestlik dereceli bir <strong>rijit gövde</strong> modelidir: güç '
    + 'grubu tek bir katı cisim, takozlar onu şasiye bağlayan üç eksenli yaylardır.</p>';
  h += '<p>Her bölüm üç parçadır: numaralı adımlar, alan tablosu ve uyarı kutusu; uyarı '
    + 'kutuları hata vermeden yanlış sonuç üreten girdileri listeler.</p>';
  h += '<p><strong>Bölüm 14</strong> kılavuzun tamamını tek bir gerçek güç grubunda uygular.</p>';
  h += _gmNot('Bölüm 14’ün sayıları',
      'Belge üretilirken çekirdek (<code>veMountCore</code>) <strong>bellekte</strong> kurulan '
    + 'örnekle koşturulur; Bölüm 14’teki bütün değerler bu hesabın çıktısıdır. Açık proje '
    + 'değişmez.');
  h += '<h3>1.1 Bu modül neyi hesaplar</h3>';
  h += _gmAlanTablo('Kapsam', [
    ['<strong>Statik sehim</strong>', 'Ağırlık ve ivme altında güç grubunun 6 serbestlik '
      + 'derecesindeki yer değiştirmesi', 'Bölüm 10'],
    ['<strong>Takoz kuvvetleri</strong>', 'Her takozda üç eksenli kuvvet; çekme ve durdurucu '
      + 'teması', 'Bölüm 10'],
    ['<strong>Doğal frekanslar</strong>', '6 rijit gövde modu ve mod biçimleri',
      'Bölüm 11'],
    ['<strong>İzolasyon</strong>', 'Ateşleme frekansında iletim oranı', 'Bölüm 11'],
    ['<strong>Taşıma kapasitesi</strong>', 'Takoz başına eksenel yük kullanımı', 'Bölüm 6'],
    ['<strong>Şok yanıtı</strong>', 'Darbe altında geçici rejim', 'Bölüm 9']
  ], ['Ne', 'Neyi verir', 'Nerede']);
  h += _gmUyari('Rijit gövde varsayımı',
      'Güç grubu <strong>tek bir katı cisim</strong> kabul edilir; gövdenin kendi esnemesi, '
    + 'blok burulması ve şasi esnekliği modelde <strong>yoktur</strong>. Bu, takoz seçimi ve '
    + 'yerleşimi için standart ve yeterli bir yaklaşımdır — ama bir gövde modu takoz '
    + 'modlarının bandına giriyorsa sonuç yanıltıcı olur. Elastomerlerin sıcaklık ve yaşlanma '
    + 'bağımlılığı da modelde yoktur.');
  return h;
}

function _gmSec2(){
  var h = _gmH2(1);
  h += '<p>Ana tuvalde <strong>Takoz Çökme-Titreşim</strong> kartına çift tıklayınca modülün '
    + 'kendi iç topolojisi açılır.</p>';
  h += _gmUyari('Bağlantılar burada salt görseldir',
      'Diğer modüllerde tel bir akışı anlatır (FEAD’de kayış yolu, Araç Performans’ta güç '
    + 'akışı). Burada öyle <strong>değildir</strong>: çözücü bileşenleri '
    + '<strong>tipinden</strong> toplar, teli okumaz. Tel çekmek modeli değiştirmez; yalnız '
    + 'hangi kütlenin hangi takoza oturduğunu gözle anlatır. Eksik bağlantı sonucu '
    + '<strong>etkilemez</strong>; eksik bileşen etkiler.');
  h += '<h3>2.1 Bileşenler</h3>';
  h += _gmAlanTablo('İç topolojideki bileşenler', [
    ['<strong>Kütle gövdeleri</strong>', 'Motor · Şanzıman · Şaft · Braket · Transfer · '
      + 'PTO · Pompa · PTO grubu', 'Hepsi aynı “Kütle”, “Ağırlık merkezi” ve “Atalet” bölümlerini '
      + 'taşır; farkları altlarındaki tipe özel bölümlerde'],
    ['<strong>Takoz</strong>', 'Konum ve üç eksenli rijitlik', 'En az 3, tipik olarak 3–4'],
    ['<strong>Takoz Özellikleri</strong>', 'Takoz tiplerinin kataloğu: rijitlik, kuvvet–sehim '
      + 'yasası, kapasite', 'Katalogdan seçip takoza uygulamak için'],
    ['<strong>Çözücü</strong>', 'Çözüm modu, sönüm, şok', 'Tuvalde bir tane'],
    ['<strong>Başlangıç ve Örnekler</strong>', 'Kayıtlı gerçek modeller', 'Bölüm 3'],
    ['<strong>Görünümler · Koordinat Düzlemi · 3D Görüntüleyici</strong>',
      'Modeli gözle denetleme yüzeyleri; Görünümler modeli aksonometrik çizer ve serbestçe '
      + 'döndürür (sol tık + sürükle: döndür, tekerlek: yakınlaştır, sağ tık: kaydır; '
      + 'başlıktaki düğmeler yakınlaştırır, dimetrik bakışa sıfırlar ve tam ekran açar), '
      + 'işaretlerin adlarını ve konumlarını çizimin altındaki föyde verir (föyün satırının '
      + 'üstüne gelince o parça çizimde aydınlanır, modelin geri kalanı gölgeye düşer); 3D Görüntüleyici '
      + 'gerçek CAD dosyasıyla çalışmaya ayrıldı', 'Hesaba girmez'],
    ['<strong>Rapor</strong>', 'Çevrimdışı HTML rapor', 'Bölüm 12'],
    ['<strong>Parametrik Analiz</strong>', 'Katalogdan seçim: takoz gruplarına kütüphanedeki '
      + 'tipler, kısıtlar, iletilebilirlik–sehim dengesi; öneri, kriterler ve iki grafik pencerenin '
      + 'Sonuç bölümünde, on diyagram tam ekranda, ayrıntı ayrı bir raporda', 'Bölüm 15']
  ], ['Bileşen', 'Ne', 'Not']);
  h += '<h3>2.2 Girdiler ve türeyenler</h3>';
  h += _gmAlanTablo('Girdi / türeyen ayrımı', [
    ['Kütle gövdeleri', 'kütle · ağırlık merkezi · atalet tensörü',
      '<strong>birleşik kütle özellikleri</strong> (toplam kütle, ortak CG, paralel-eksen '
      + 'teoremiyle birleştirilmiş atalet)'],
    ['Takozlar', 'konum · statik ve dinamik rijitlik (x, y, z) · kapasite',
      '<strong>rijitlik matrisi K</strong> (CG etrafında, 6×6)'],
    ['Yük durumları', 'ivme vektörü ve tork', '<strong>sehim q</strong> · takoz kuvvetleri'],
    ['Çözücü', 'çözüm modu · sönüm oranı', '<strong>doğal frekanslar</strong> · mod '
      + 'biçimleri · izolasyon']
  ], ['Konu', 'Girdi', 'Türeyen']);
  h += _gmNot('Sonuçlar raporda',
      'Bileşen pencereleri yalnız girdiyi ve girdiden türeyeni gösterir (birleşik kütle, '
    + 'CG farkı, dinamik/statik oranı, mil torku). Sehim, takoz kuvvetleri, modlar ve '
    + 'uygunluk hükmü <strong>ayrıntılı raporda</strong>dır (Bölüm 12); pencerelerde çözümle '
    + 'değişen tek şey Çözücü’nün ve Rapor’un son hesabın güncel olup olmadığını söyleyen satırıdır.');
  h += _gmNot('Koordinat sistemi',
      'Bütün konumlar ve ağırlık merkezleri <strong>aynı çerçevede</strong> ve '
    + '<strong>mm</strong> cinsinden girilir. Çerçevenin nerede olduğu önemli değildir — '
    + 'çözüm merkez farklarından kurulur — ama çerçeveler <strong>karışmamalıdır</strong>: '
    + 'bir kütlenin CG’si parça çerçevesinde, bir takozun konumu araç çerçevesindeyse model '
    + 'hata vermeden yanlış çözülür. <strong>Koordinat Düzlemi</strong> bileşeni çerçeveyi '
    + 'gözle gösterir.');
  return h;
}

function _gmSec3(){
  var h = _gmH2(2);
  h += '<h3>3.1 Başlangıç sayfası</h3>';
  h += '<p>Boş bir Takoz modülünde <strong>başlangıç sayfası</strong> açılır: üç seçenek '
    + '(<em>Sihirbazla kur</em> · <em>STEP’ten başla</em> · <em>Boş kanvas</em>) ve altında örnek '
    + 'modellerin karoları. Birine basınca model kurulur ve sayfa kapanır; kurulum Ctrl+Z ile '
    + 'geri alınınca sayfa yeniden açılır. <em>STEP’ten başla</em> sihirbazın ilk adımındaki '
    + 'dosya seçiciyi açar.</p>';
  h += '<h3>3.2 Yol A — hazır bir örnekten başlamak</h3>';
  h += _gmAdimlar([
    'Karşılama ekranından <strong>Takoz Çökme-Titreşim</strong> kartını seçin; ana tuvale '
      + 'tek bir alt-sistem kutusu düşer.',
    'Kutuya <strong>çift tıklayın</strong>: başlangıç sayfası açılır.',
    'Bir örnek karosuna tıklayın — bütün kütleler, takozlar ve künyeler bir anda kurulur.',
    '<strong>Başlangıç ve Örnekler</strong> penceresinin <strong>Tutarlılık uyarıları</strong> '
      + 'bölümüne bakın: model çözülebilir durumda mı, eksik bir alan var mı?'
  ]);
  var liste = _gmOrnekListe();
  if(liste.length){
    var satir = liste.map(function(e){
      return [_gmE(e.name), _gmE(e.vehicle || '—'), _gmE(e.subtitle || '—')];
    });
    h += _gmTablo('Kayıtlı örnek modeller', ['Örnek', 'Araç', 'Yapılandırma'], satir,
      ['l', 'l', 'l']);
  }
  h += _gmNot('Tutarlılık uyarıları',
      'Panel modeli sürekli denetler ve iki düzeyde konuşur: <strong>hata</strong> (kütle yok, '
    + 'takoz yok, kütle tanımsız) çözümü durdurur; <strong>uyarı</strong> (üçten az takoz, '
    + 'dörtten fazla takoz, tanımsız rijitlik, PTO kütlesinin iki kez sayılması) çözümü '
    + 'durdurmaz ama sonucu şüpheli yapar. Uyarısız model iç tutarlıdır.');
  h += '<h3>3.3 Yol B — boş kanvastan elle kurmak</h3>';
  h += _gmAdimlar([
    'Başlangıç sayfasında <strong>Boş kanvas</strong>’a basın: araç bileşenleri (Çözücü, '
      + 'Rapor, Görünümler …) kurulur.',
    'Paletten güç grubunun her parçası için bir <strong>kütle gövdesi</strong> sürükleyin '
      + '(Motor, Şanzıman, Şaft, Braket…).',
    'Her takoz için bir <strong>Takoz</strong> bileşeni sürükleyin. <strong>En az üç</strong> '
      + 'takoz gerekir: daha azında rijit gövde kinematik olarak serbest kalır ve rijitlik '
      + 'matrisi tekil olur.',
    'Kütleler takozlara tel çekilerek görsel olarak eşlenebilir — <em>hesabı '
      + 'etkilemez</em> (Bölüm 2).'
  ]);
  return h;
}

function _gmSec4(){
  var h = _gmH2(3);
  h += '<p>Güç grubunun her parçası bir <strong>kütle gövdesi</strong> düğümüdür. Penceresi '
    + 'sağdaki sütunda açılır. Pencere FEAD pencereleriyle aynı yapıdadır: bütün bölümler '
    + 'tek gövdede alt alta, sağda (dar pencerede altta) bağlam sütunu. İlk üç bölüm her '
    + 'gövdede aynıdır (<strong>Kütle</strong> · <strong>Ağırlık merkezi</strong> · '
    + '<strong>Atalet</strong>); tipe göre değişenler onların altındadır (Bölüm 5). Bir alan '
    + 'eksikse pencerenin en üstünde <strong>eksik bandı</strong> belirir. Sağ sütundaki '
    + '<strong>Güç grubundaki yeri</strong> '
    + 'Görünümler’in çizimidir ve onunla aynı açıda döner (sol tık + sürükle; başlıktaki '
    + 'düğmeler yakınlaştırır, dimetrik bakışa sıfırlar ve tam ekran açar): bu gövde aydınlık '
    + 've adıyla, modelin geri kalanı gölgede; öteki işaretlerin bilgisi farenin altında.</p>';
  h += _gmAdimlar([
    'Gövdeye çift tıklayın.',
    '<strong>Kütle</strong> bölümüne kütleyi (kg), <strong>Ağırlık merkezi</strong> föyüne '
      + 'CG’yi (mm, x/y/z) yazın — yanındaki sütun birleşik ağırlık merkezine farkı gösterir.',
    '<strong>Atalet</strong> bölümünde, gövde ince ya da hafifse <strong>Nokta kütle</strong> '
      + 'kutusunu işaretleyin — atalet tensörü sıfır kabul edilir, kütle CG’de toplanır; grubun '
      + 'ataleti gövdelerin CG yayılımından (paralel eksen) yine doğar.',
    'Nokta kütle değilse <strong>Atalet tensörü</strong> matrisinin üst üçgenine köşegen (I<sub>xx</sub>, '
      + 'I<sub>yy</sub>, I<sub>zz</sub>) ve çarpım (I<sub>xy</sub>, I<sub>xz</sub>, '
      + 'I<sub>yz</sub>) terimlerini kg·m² cinsinden girin; alt üçgen simetriden kendiliğinden dolar.',
    'Pencerenin üstündeki <strong>eksik bandını</strong> okuyun: boş bir alan çözücüde 0 '
      + 'demektir; bant bunun sonucunu yazar, <strong>Doldur</strong> o alana götürür ve '
      + 'eksik bölüm sol kenarında kehribar bir çizgi taşır.'
  ]);
  h += _gmAlanTablo('Kütle gövdesi penceresi — alanlar', [
    ['Kütle [kg]', 'Parçanın kütlesi', 'CAD ölçümü ya da parça künyesi'],
    ['Ağırlık merkezi [mm]', 'x / y / z — <strong>modelin ortak çerçevesinde</strong>',
      'CAD ölçümü (CATIA <em>Measure Inertia</em> gibi)'],
    ['Nokta kütle', 'Atalet ihmal edilsin mi',
      'Şaft, PTO parçası gibi ince/hafif gövdeler için uygun'],
    ['Atalet köşegen [kg·m²]', 'I<sub>xx</sub> · I<sub>yy</sub> · I<sub>zz</sub>',
      'CAD ölçümü — <strong>parçanın kendi CG’sinde</strong>'],
    ['Atalet çarpım [kg·m²]', 'I<sub>xy</sub> · I<sub>xz</sub> · I<sub>yz</sub>',
      'Simetrik gövdelerde çoğu sıfırdır'],
    ['Asal momentler · eşdeğer kutu', 'Tensörden türetilir (salt okunur)',
      'Tensör fiziksel değilse (ör. I<sub>yy</sub> + I<sub>zz</sub> &lt; I<sub>xx</sub>) bant uyarır']
  ]);
  h += _gmUyari('Atalet parçanın kendi CG’sinde girilir',
      'Gövdeler birleştirilirken <strong>paralel-eksen teoremi</strong> uygulanır: her parçanın '
    + 'ataleti parçanın CG’sinden ortak CG’ye taşınır. Ortak CG’ye taşınmış atalet girilirse '
    + 'taşıma <strong>iki kez</strong> yapılır ve atalet şişer. Belirtisi yalnız modal analizde '
    + 'görünür: dönme modları beklenenden <strong>düşük</strong> çıkar; sehim sonuçları '
    + 'etkilenmez.');
  h += _gmNot('Birimler: kg · mm · kg·m² · N/mm',
      'Pencere bu birimlerde çalışır ve çekirdeğe geçerken SI’ya çevirir. Atalet '
    + '<strong>kg·m²</strong>’dir (kg·mm² değil): 10⁶ kat fark eder ve karıştırıldığında '
    + 'dönme modları anlamsız yerlere gider.');
  return h;
}

function _gmSec5(){
  var h = _gmH2(4);
  h += '<p>Bazı kütle gövdeleri, kütlelerine ek olarak <strong>tork</strong> üretir ya da '
    + 'iletir. Bu bilgiler pencerede atalet bölümünün altındadır ve gövdenin tipine göre değişir. '
    + 'Motor kataloğundan bir motor seçmek tepe torku, maks. gücü ve rölantiyi doldurur; '
    + '<strong>kütle, CG ve atalet doldurulmaz</strong> — kataloğun ataleti krank milinin döner '
    + 'ataletidir, gövdenin tensörü değil.</p>';
  h += _gmAlanTablo('Tipe özel bölümler', [
    ['Motor', '<strong>Katalog</strong>, <strong>Motor noktaları</strong> (tepe tork, maks. güç, '
      + 'rölanti, silindir sayısı), <strong>Tork zinciri</strong>, <strong>Ateşleme</strong>', 'Motor künyesi'],
    ['Şanzıman', '<strong>Vites oranları</strong> (vites başına oran ve mil torku), '
      + '<strong>Konvertör</strong> (stall oranı)', 'Şanzıman künyesi ve konvertör'],
    ['Transfer Kutusu', '<strong>Oran ve aks payı</strong> (transfer oranı, aks payı φ), '
      + '<strong>Mil torku</strong>', 'Transfer künyesi'],
    ['PTO · Pompa · PTO grubu', '<strong>Giriş yolu</strong> ve <strong>ASR-SR-116 referansı</strong>',
      'Toplu ya da parça parça — <strong>ikisi birden değil</strong>']
  ], ['Gövde', 'Bölümler', 'Nereden']);
  h += '<p>Motorun <strong>Tork zinciri</strong> föyü, mil torkunu oluşturan her çarpanın '
    + 'hangi gövdeden okunduğunu yazar. Aynı alan iki gövdede birden doluysa çözücü ilkini '
    + 'okur; pencerenin üstündeki bant bunu <strong>çakışma</strong> olarak, hangi gövdenin '
    + 'okunduğuyla birlikte yazar.</p>';
  h += '<p>Tork bilgisi <strong>vites tork durumlarını</strong> üretir: program her vites '
    + 'için tepki torkunu hesaplar ve ayrı bir yük durumu olarak çözer (Bölüm 8).</p>';
  h += _gmUyari('PTO kütlesi iki kez sayılabilir',
      'PTO grubunun kütlesi iki yoldan verilir: tek bir <strong>PTO grubu</strong> '
    + 'gövdesiyle toplu olarak, ya da ayrı <strong>PTO</strong> ve <strong>Pompa</strong> '
    + 'gövdeleriyle parça parça. Toplu girişte grubun kütlesi, CG’si ve atalet tensörü tek '
    + 'kalemdir; ayrıntılı girişte parça başına kütle ve CG girilir ve grubun ataleti parçaların '
    + 'yayılımından doğar. <strong>İkisi birden</strong> tanımlanırsa aynı kütle iki kez '
    + 'sayılır ve çözücü “makul ama yanlış” bir toplam üretir; tutarlılık uyarıları bunu '
    + 'adıyla yazar.');
  return h;
}

function _gmSec6(){
  var h = _gmH2(5);
  h += '<p>Takoz, güç grubunu şasiye bağlayan üç eksenli bir yaydır. Her takoz kendi '
    + 'konumunu ve üç eksende iki ayrı rijitliğini taşır. Penceresi hepsini tek gövdede alt '
    + 'alta taşır: <strong>Takoz tipi</strong> (künye), <strong>Rijitlik</strong> (kuvvet–sehim '
    + 'yasasıyla), <strong>Kapasite</strong> ve <strong>Konum</strong> (konum ve birleşik ağırlık '
    + 'merkezine farkı); sağ sütunda takozu vurgulayan <strong>Güç grubundaki yeri</strong> '
    + 'krokisi.</p>';
  h += _gmAdimlar([
    'Takoza çift tıklayın.',
    '<strong>Takoz tipi</strong> listesinden hazır bir künye seçin — konum hariç bütün '
      + 'alanlar dolar (Bölüm 7). Altındaki durum satırı değerlerin kaçının künyeyle aynı kaldığını söyler.',
    '<strong>Konum</strong> föyüne takozun x / y / z koordinatını yazın (mm, modelin '
      + 'ortak çerçevesinde).',
    'Künye kütüphanede yoksa <strong>Rijitlik</strong> föyüne üç eksenin statik ve dinamik '
      + 'değerlerini girin (N/mm); her satırın dinamik/statik oranı yanında türetilir.',
    'Varsa <strong>Kapasite</strong> bölümüne takozun azami eksenel yükünü yazın — '
      + 'raporun uygunluğunda kullanım yüzdesi olarak görünür.'
  ]);
  h += _gmAlanTablo('Takoz penceresi — alanlar', [
    ['Konum [mm]', 'x / y / z — takozun <strong>elastik merkezi</strong>',
      'Montaj resmi; kütle CG’leriyle <strong>aynı çerçevede</strong>'],
    ['Rijitlik · statik [N/mm]', 'k<sub>x</sub> · k<sub>y</sub> · k<sub>z</sub>',
      'Takoz kataloğu — <strong>yavaş yükleme</strong> değeri'],
    ['Rijitlik · dinamik [N/mm]', 'k<sub>x</sub> · k<sub>y</sub> · k<sub>z</sub>',
      'Aynı katalog — <strong>titreşim frekansındaki</strong> değer'],
    ['Maks. eksenel yük [kg]', 'Takozun taşıyabileceği azami yük',
      'Katalog; boş bırakılabilir, o zaman kullanım yüzdesi basılmaz']
  ]);
  h += _gmUyari('Statik ve dinamik rijitlik aynı değildir',
      'Elastomer bir takoz, hızlı yüklemede yavaş yüklemeden <strong>daha rijittir</strong> — '
    + 'tipik oran 1,4–1,8. <strong>Sehim</strong> statik rijitlikle, <strong>doğal '
    + 'frekanslar</strong> dinamik rijitlikle hesaplanır. İkisine aynı değer yazılırsa model '
    + 'yine çözülür: ya sehim fazla küçük çıkar ya frekanslar fazla düşük; <strong>hata '
    + 'verilmez</strong>. Pencere oranın eksenler '
    + 'arasında 1,5 kattan fazla yayıldığını işaretler: eksenlerin takaslı girildiğinin izidir.');
  h += _gmNot('Üç takoz alt sınırdır, dört üst sınır değildir',
      'Rijit gövdeyi 6 serbestlik derecesinde kısıtlamak için en az üç takoz gerekir; daha '
    + 'azında rijitlik matrisi <strong>tekildir</strong> ve çözücü açıkça “singular” der. '
    + 'Dörtten fazla takoz ise <em>aşırı-kısıtlı</em> bir modeldir: çözülür, ama yük dağılımı '
    + 'takozların birbirine göre rijitliğine çok duyarlı hâle gelir. Tipik bir güç grubu 3–4 '
    + 'takozla bağlanır ve model bunun dışını uyarı olarak yazar.');
  return h;
}

function _gmSec7(){
  var h = _gmH2(6);
  h += '<h3>7.1 Takoz Özellikleri</h3>';
  h += '<p><strong>Takoz Özellikleri</strong> bileşeni takoz tiplerinin kataloğunu taşır: '
    + 'gömülü künyeler ve eklenen özel takozlar. Seçilen tip takoza uygulanınca rijitlikler '
    + 've kapasite dolar; <strong>konum dolmaz</strong> — o motorun verisidir, parçanın '
    + 'değil.</p>';
  h += _gmAlanTablo('Takoz Özellikleri penceresi', [
    ['Takoz tipi · Taşıma kapasitesi', 'Takoz tipi seçici, seçili tipin adı ve türü (gömülü · '
      + 'özel · değiştirilmiş), taşıma kapasitesi', 'Alttaki bölümler seçili tipin adını '
      + 'başlıklarında taşır'],
    ['Rijitlik', 'Üç eksenin statik ve dinamik rijitliği, dinamik/statik oranı',
      'Boş ya da ≤ 0 değer varsa bant bunu yazar: çözücü bu tipi taşıyan takozu reddeder. '
      + 'Oran eksenler arasında 1,5 kattan fazla yayılıyorsa da yazar: eksenler takaslı '
      + 'girilmiş olabilir'],
    ['Yasa', 'Seçilen eksenin kuvvet–sehim grafiği (X · Y · Z) ve üç eksenin yasası',
      'Gömülü takoz lineerdir; z-eğrisinin noktaları yalnız özel takozda girilir'],
    ['Kullanım (yan sütun)', 'Bu tipi taşıyan takozlar',
      'Tipinden sapan takozu <strong>n değer farklı</strong> diye gösterir (aşağıdaki not)']
  ], ['Bölüm', 'Ne taşır', 'Ne söyler']);
  h += _gmNot('Künye kopya olarak gider',
      'Takoz Özellikleri’nden uygulanan değerler takoz düğümüne <strong>kopyalanır</strong>: '
    + 'katalog güncellense de kaydedilmiş proje <strong>değişmez</strong>; hangi künyeden '
    + 'geldiğinin izi kalır. Tip sonradan değişirse takoz eski değerinde kalır; pencerenin '
    + '<strong>Kullanım</strong> bölümü onu gösterir. Taşıma kapasitesi de kopyalanır; tipte '
    + 'tanımsızsa takozdaki eski değer silinir. Gömülü bir takozda yapılan değişiklik bu '
    + 'Takoz Özellikleri düğümüne yazılır, fabrika değeri bozulmaz — <strong>Fabrika</strong> '
    + 'düğmesi geri döndürür.');
  h += '<h3>7.2 Nonlineer z-eğrisi</h3>';
  h += '<p>Elastomer takozlar büyük sehimde <strong>sertleşir</strong>: kuvvet–sehim ilişkisi '
    + 'doğru değil, yukarı bükülen bir eğridir. Takoza <strong>kuvvet–sehim eğrisi</strong> '
    + 'girilince çözücü nonlineer yola (Newton iterasyonu) geçer.</p>';
  h += _gmAlanTablo('Doğrusal ↔ nonlineer', [
    ['Hiçbir takozda eğri yok', 'Doğrusal çözüm — tek adımda',
      'Küçük sehimlerde (statik ağırlık) doğru ve hızlı'],
    ['En az bir takozda eğri var', 'Newton iterasyonu — bütün model nonlineer çözülür',
      'Büyük sehim (3,5 g düşey gibi) için gerekli'],
    ['Metal-metal durdurucu', 'Her zaman açık: her takozda düşeyde ±15 mm boşluk',
      'Takozun mekanik sınırına dayanmasını modeller; boşluk ayarlanmaz, yanal durdurucu yok']
  ], ['Durum', 'Çözüm yolu', 'Ne zaman']);
  h += _gmUyari('Doğrusal model büyük sehimde iyimserdir',
      'Eğri girilmemişse takoz <strong>her sehimde aynı rijitlikte</strong> sayılır. Gerçek '
    + 'takoz sertleştiği için doğrusal model büyük ivmelerde sehimi <strong>fazla</strong>, '
    + 'takoz kuvvetini <strong>az</strong> gösterir. Raporun <em>Lineerlik (±10 mm)</em> '
    + 'satırı bunu bildirir; aşım varsa eğri girin.');
  h += _gmNot('Eğrinin noktaları',
      'z-eğrisi özel bir takoz tipinde, <strong>Takoz Özellikleri → Yasa</strong> '
    + 'bölümünde tanımlanır ve tip bir takoza uygulanınca onunla birlikte kopyalanır. '
    + 'Çözücü noktaları sehime (δ) göre sıralar; monoton bir eğri girin (basma eksi).');
  return h;
}

function _gmSec8(){
  var h = _gmH2(7);
  h += '<p>Bir yük durumu iki şeyden oluşur: bir <strong>ivme vektörü</strong> (g cinsinden, '
    + 'x/y/z) ve bir <strong>tork</strong> (N·m, x/y/z). Program bunlardan güç grubuna etki '
    + 'eden kuvvet ve momenti kurar, sonra sehimi çözer.</p>';
  h += _gmTablo('Standart yük durumları',
    ['Durum', 'İvme n = [x, y, z]', 'Ne anlatıyor'],
    [
      ['Static', '[0, 0, −1]', 'Yalnız ağırlık — sehimin temel hâli'],
      ['Max Bump', '[0, 0, −3]', 'Düşey darbe (3 g)'],
      ['Acceleration', '[+1, 0, −1]', 'Boyuna hızlanma'],
      ['Braking', '[−1, 0, −1]', 'Fren'],
      ['Cornering L / R', '[0, ±0,6, −1]', 'Yanal viraj'],
      ['Forward / Reverse Torque', '[0, 0, −1] + T', 'Tahrik tepki torku']
    ], ['l', 'c', 'l']);
  h += '<p>Bunlara ek olarak <strong>vites tork durumları</strong> (her vites için ayrı) ve '
    + 'üç <strong>tasarım yük durumu</strong> (3,5 g düşey · 1 g yanal · 1 g boyuna fren) '
    + 'kendiliğinden kurulur.</p>';
  h += _gmNot('İvme işareti',
      'Düşey bileşen <strong>−1</strong>’dir: yerçekimi aşağı yöndedir; “3 g düşey” '
    + 'n<sub>z</sub> = −3 demektir. Yanal ve boyuna bileşenler ise aracın ivmesidir ve '
    + 'gövdeye <strong>ters yönde</strong> atalet kuvveti uygular; çeviri hesapta yapılır.');
  return h;
}

function _gmSec9(){
  var h = _gmH2(8);
  h += '<p><strong>Çözücü</strong> bileşenine çift tıklayın. Pencere üç bölümü alt alta taşır; '
    + 'sağ sütunda ön denetim ve <strong>Hesapla</strong> düğmesi. Pencere sonucu göstermez — '
    + 'sonuç raporda (Bölüm 12).</p>';
  h += _gmAlanTablo('Çözücü penceresi — bölümler', [
    ['Yük kitabı', 'Çözülecek durumlar, ivme (n) ve tork (T)',
      'Modelin girdisinden; tork durumları tork girildiyse'],
    ['Yöntem', 'Çözüm modu, sönüm oranı ζ', 'Bir sonraki Hesapla’da uygulanır'],
    ['Şok darbesi', 'Yarım sinüs darbenin tepe ivmesi (g) ve süresi (ms)', 'Bir sonraki Hesapla’da uygulanır']
  ], ['Bölüm', 'Ne', 'Not']);
  h += _gmAdimlar([
    '<strong>Yöntem</strong> bölümünde çözüm modunu seçin; sönüm oranı ve şok darbesi '
      + 'varsayılan değerleriyle durur (yanındaki <em>i</em> kaynağını söyler).',
    'Sönüm oranı yalnız şok ve izolasyon hesabına girer, sehime girmez; her takozun viskoz sönüm '
      + 'katsayısı ondan türer: c = 2ζ√(k<sub>din</sub>·m<sub>pay</sub>).',
    '<strong>Hesapla</strong> düğmesine basın — ilerleme düğmenin solundaki çubukta akar: çözülen yük '
      + 'durumu, sırası ve oranı.',
    'Hesapla’nın solundaki not toplam kütleyi, gövde ve takoz sayısını ve son hesabın '
      + 'güncel olup olmadığını söyler; sonucu <strong>Rapor</strong> bileşeninden okuyun.'
  ]);
  h += _gmUyari('Çekme, durdurucu ve yakınsamama raporda bir hükümdür',
      'Raporun yük durumu tabloları <strong>çekme</strong> (bir takoz çekiye giriyor), '
    + '<strong>durdurucu teması</strong> ve <strong>doğrusal aralık aşımı</strong> işaretlerini, '
    + '<strong>yakınsamama</strong> ve <strong>f ≈ 0 modu</strong> uyarılarını taşır. Bunlar '
    + 'hata değil, modelin bulgularıdır.');
  h += _gmNot('Sonuç eski modelin olabilir',
      'Hesaptan sonra modelde bir alan değişirse Çözücü ve Rapor son hesabın güncel olmadığını '
    + 'işaretler: raporun sayıları eski modelin olur. Adı değiştirmek sonucu etkilemez — '
    + 'ad fiziğe girmez. Yeniden <strong>Hesapla</strong>’ya basın.');
  return h;
}

function _gmSec10(){
  var h = _gmH2(9);
  h += '<p>Her yük durumu için çözülen şey <strong>q</strong> vektörüdür: güç grubunun '
    + 'ortak CG’sinin üç ötelenmesi (mm) ve üç dönmesi (derece).</p>';
  h += _gmAlanTablo('Sehim sonuçları', [
    ['q<sub>x</sub> · q<sub>y</sub> · q<sub>z</sub>', 'CG’nin ötelenmesi, mm',
      'Statik durumda z genellikle en büyüğüdür'],
    ['θ<sub>x</sub> · θ<sub>y</sub> · θ<sub>z</sub>', 'Roll · pitch · yaw dönmesi, derece',
      'Tork durumlarında roll belirgin büyür'],
    ['Takoz kuvvetleri', 'Her takozda üç eksenli kuvvet, N',
      'İşaret yönü verir: negatif z basma, pozitif z <strong>çekme</strong>'],
    ['Kuvvet dengesi', 'Σ F ≈ dış kuvvet', 'Sıfıra yakın olmalı — çözümün iç denetimi'],
    ['Kapasite kullanımı', 'Takoz başına %', 'Kapasite girildiyse']
  ], ['Büyüklük', 'Ne', 'Nasıl okunur']);
  h += _gmUyari('Çekme bir tasarım uyarısıdır',
      'Elastomer takozlar basmada çalışmak üzere tasarlanır. Bir takozun düşey kuvveti '
    + '<strong>çekiye</strong> dönüyorsa (gövde o köşeden kalkıyorsa) takoz ya kopar ya da '
    + 'ömrü kısalır. Raporun <em>Çekme / lift-off</em> satırı çekiye giren yük durumlarını '
    + 'adıyla yazar. Genellikle çare takozu yeniden konumlandırmaktır, rijitliği büyütmek '
    + 'değil.');
  h += _gmNot('Kuvvet dengesi çözümün kendi denetimidir',
      'Takoz kuvvetlerinin toplamı, uygulanan dış kuvvete eşit olmak <strong>zorundadır</strong> '
    + '— denge denkleminin kendisi. Artık rapora yazılır; sıfırdan belirgin farklıysa çözüm '
    + 'yakınsamamıştır.');
  return h;
}

function _gmSec11(){
  var h = _gmH2(10);
  h += '<p>Modal analiz, güç grubunun <strong>dinamik rijitlikle</strong> hesaplanan altı '
    + 'rijit gövde modunu verir. Her mod bir frekans ve bir biçimden oluşur.</p>';
  h += _gmAlanTablo('Mod etiketleri', [
    ['bounce', 'Ağırlıklı olarak düşey öteleme', 'Genellikle en düşük üç modun içinde'],
    ['roll', 'Boyuna eksen etrafında dönme',
      'Tahrik torkunun uyardığı mod — en kritik olanı budur'],
    ['pitch', 'Yanal eksen etrafında dönme', ''],
    ['yaw', 'Düşey eksen etrafında dönme', ''],
    ['fore-aft · lateral', 'Boyuna ve yanal öteleme', ''],
    ['Karma etiketler', 'İki hareket birlikte (örn. <em>pitch+bounce</em>)',
      'Modlar saf değilse etiket ikisini de yazar']
  ], ['Etiket', 'Ne anlatır', 'Not']);
  h += '<h3>11.1 İzolasyon</h3>';
  h += '<p>Takozun işi motorun ateşleme titreşimini şasiden yalıtmaktır. Klasik kural: '
    + 'iletim oranının 1’in altına inmesi için <strong>uyarma frekansı, doğal frekansın '
    + '√2 katından büyük</strong> olmalıdır. Pratikte hedef genellikle '
    + '<strong>f<sub>ateşleme</sub> / f<sub>en yüksek mod</sub> ≥ 2,5–3</strong>’tür.</p>';
  h += _gmNot('Ateşleme frekansı',
      'Dört zamanlı bir motorda ateşleme frekansı <em>f = devir × silindir sayısı / 120</em>’dir. '
    + 'Rölanti devri en kritik durumdur: orada uyarma frekansı en düşüktür ve modlara en çok '
    + 'yaklaşır.');
  h += _gmUyari('f ≈ 0 çıkan bir mod modelin serbest kaldığını söyler',
      'Altı modun biri sıfıra çok yakınsa güç grubu o serbestlik derecesinde '
    + '<strong>kısıtlanmamıştır</strong> — genellikle takozlar tek bir düzlemde ya da tek bir '
    + 'doğru üzerinde dizilmiştir. Sonuç sayısal olarak üretilir ama fiziksel değildir; '
    + 'takoz yerleşimine dönün.');
  h += '<h3>11.2 Duyarlılık — hangi takoz hangi modu oynatıyor</h3>';
  h += '<p>Her takozun her ekseni için <strong>esneklik</strong> verilir: o rijitlik %1 '
    + 'artınca modun frekansı yüzde kaç artar. Esneklik, yayın o moddaki şekil değiştirme '
    + 'enerjisi payının yarısıdır; her modda bütün takoz ve eksenlerin toplamı 0,5’tir. Bir '
    + 'yayın sertleşmesi hiçbir frekansı düşürmez.</p>';
  h += '<p>Duyarlılık raporun <strong>§8.17</strong> bölümündedir: takoz ve eksen başına altı '
    + 'moddaki esneklik matrisi (kalın hücre modun en etkili kaldıracı) ve frekans kriterlerinin '
    + 'kaldıraçları — tek kaldıraçla sınıra kadar yüzde kaç, yeniden çözülerek.</p>';
  h += _gmNot('Esneklik bir eğimdir',
      'Küçük değişimde doğrudur. İki mod birbirine 0,5 Hz’ten yakınsa rijitlik değişince '
    + 'birbirinden kaçarlar ve eğim çabuk değişir; büyük değişimde raporun kaldıraç tablosundaki '
    + 'yeniden çözülmüş değeri okuyun. Statik sehim bu hesaba girmez: yumuşatılan takozun sehimi artar.');
  h += '<h3>11.3 Frekans yanıtı ve Campbell diyagramı</h3>';
  h += '<p><strong>İletilebilirlik</strong> T, şasiye geçen kuvvetin motor kuvvetine oranıdır: '
    + 'T = 1 azalma yok, T &lt; 1 izolasyon. İzolasyon verimi (1 − T) × 100’dür ve rezonansta '
    + '(T &gt; 1) eksiye iner. Sönümsüz sistemin tepesi rezonansta sınırsızdır: çizilen sönümsüz '
    + 'tepe yüksekliği frekans örneklemesine bağlıdır, tepeyi yalnız sönüm sınırlar.</p>';
  h += '<p><strong>Takoz başına iletilebilirlik</strong> her takozun şasiye geçirdiği kuvvettir. '
    + 'Tepe frekansları bütün takozlarda ortaktır: tepeler takoza değil, yapının modlarına '
    + 'aittir. Takoz eğrilerinin aritmetik toplamı sistem eğrisini vermez: kuvvetler genlik ve faz '
    + 'taşır, toplam vektöreldir; zıt fazlı iki takozda tekil genlikler büyük, sistem toplamı küçük çıkar.</p>';
  h += '<p><strong>Campbell diyagramında</strong> eğik çizgiler motorun uyarma mertebeleridir '
    + '(frekansları devirle büyür), yatay çizgiler güç grubunun doğal frekanslarıdır. İkisinin '
    + 'kesiştiği devirde motor o modu tam frekansından besler. Çalışma bandının altındaki kesişimler '
    + 'yalnız kalkış ve durmada geçilir; bandın içindekiler motor o devirde çalıştıkça sürer.</p>';
  return h;
}

function _gmSec12(){
  var h = _gmH2(11);
  h += '<p><strong>Rapor</strong> bileşeni çevrimdışı, tek dosyalık bir HTML rapor üretir: '
    + 'teori bölümleri, modelin künyesi, bütün yük durumları, takoz kuvvetleri, modal sonuçlar '
    + 've uygunluk hükmü.</p>';
  h += _gmAdimlar([
    'Önce modeli <strong>çözün</strong> — rapor bir sonuç belgesidir ve çözümsüz üretilmez.',
    'Rapor bileşenine çift tıklayın: <strong>Çözüm</strong> bölümü raporun hangi çözümden '
      + 'üretileceğini, <strong>Frekans yerleşimi ve izolasyon</strong> bölümü raporun §8.8’indeki girdilerin (rölanti devri, '
      + 'silindir sayısı, ζ) nereden geldiğini gösterir; çözümün güncel olup olmadığı sağ '
      + 'sütunda, düğmenin üstündedir. Uygunluk hükmü raporun kendisinde.',
    'Raporu üretip indirin. Dosya tek başına açılır; internet gerekmez.'
  ]);
  h += _gmUyari('Rapor çözümün fotoğrafıdır',
      'Rapor üretildikten sonra değişen alan rapora <strong>girmez</strong>. Değişiklik için '
    + 'yeniden çözün ve raporu yeniden üretin.');
  return h;
}

function _gmSec13(){
  var h = _gmH2(12);
  h += '<p>Bu modülde de en pahalı hata sınıfı çöken model değil, <strong>“makul ama yanlış” '
    + 'sayıdır</strong>.</p>';
  h += _gmTablo('Uyarı vermeyen hatalar',
    ['Alan', 'Yanlış verilirse ne olur', 'Belirtisi'],
    [
      ['Karışık koordinat çerçevesi', 'Bir CG parça çerçevesinde, bir takoz araç '
        + 'çerçevesinde', 'Sehim ve modlar birlikte anlamsızlaşır — ama hata çıkmaz'],
      ['Atalet zaten taşınmış girilir', 'Paralel-eksen teoremi iki kez uygulanır',
        'Yalnız <strong>dönme modları</strong> düşer; sehim normal görünür'],
      ['Atalet birimi kg·mm²', 'Atalet 10⁶ kat büyür',
        'Dönme modları sıfıra yakın çıkar'],
      ['Statik = dinamik rijitlik', 'İki ayrı büyüklüğe aynı sayı',
        'Ya sehim küçük ya frekanslar düşük — ikisi birden doğru olamaz'],
      ['PTO kütlesi iki yoldan', 'Aynı kütle iki kez sayılır',
        'Toplam kütle beklenenden büyük — tutarlılık uyarısı bunu söyler'],
      ['Üçten az takoz', 'Rijit gövde serbest kalır', 'K tekil — çözücü açıkça söyler'],
      ['Takozlar tek düzlemde', 'Bir serbestlik derecesi kısıtlanmaz',
        'Bir mod <strong>f ≈ 0</strong> çıkar'],
      ['Doğrusal model, büyük ivme', 'Sertleşme modellenmez',
        'Raporun <em>Lineerlik (±10 mm)</em> satırı “aşım” yazar']
    ], ['l', 'l', 'l']);
  h += _gmOnay('Gözden geçirme: tutarlılık uyarıları ve raporun tutarlılık özeti',
      'Yukarıdaki sınıfların çoğu bu iki yüzeyde adıyla görünür. Çözülmüş model tek başına '
    + '“model doğru” demek değildir.');
  return h;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §14 — CANLI ÖRNEK
// ═══════════════════════════════════════════════════════════════════════════
//
// Çekirdek DOM'suz ve açık model kabul ediyor, yani Araç Performans
// kılavuzunun yapmak zorunda kaldığı global takası burada GEREKMİYOR.

function _gmCore(){
  if(typeof veMountCore !== 'undefined' && veMountCore && veMountCore.getMountExampleList)
    return veMountCore;
  return null;
}

function _gmOrnekListe(){
  var c = _gmCore();
  if(!c) return [];
  try { return c.getMountExampleList() || []; } catch(e){ return []; }
}

// UI birimlerinden (mm · kg · N/mm) SI'ya çevirip çözüme hazır model kur.
// Çeviri çekirdeğin KENDİ yardımcılarıyla yapılır (mmToM · nPerMmToNPerM);
// elle 1e-3 yazmak ikinci bir birim kaynağı olurdu.
function _gmModelKur(ex){
  var c = _gmCore();
  if(!c || !ex || !ex.model || !ex.model.components) return null;
  var m = ex.model;
  var mm = c.mmToM, kk = c.nPerMmToNPerM;
  var comps = m.components.map(function(x){
    return { name: x.name, mass: x.mass,
             cg: [mm(x.cg[0]), mm(x.cg[1]), mm(x.cg[2])],
             I: [[x.Ixx, x.Ixy, x.Ixz], [x.Ixy, x.Iyy, x.Iyz], [x.Ixz, x.Iyz, x.Izz]],
             pointMass: !!x.pointMass };
  });
  var mnts = m.mounts.map(function(x){
    return { name: x.name,
             pos: [mm(x.pos[0]), mm(x.pos[1]), mm(x.pos[2])],
             kstat: x.kstat.map(kk), kdyn: x.kdyn.map(kk) };
  });
  try {
    var model = c.buildModel(comps, mnts, m.g);
    if(!model) return null;
    return { core: c, ex: ex, ui: m, model: model, mounts: mnts, comps: comps };
  } catch(e){ return null; }
}

function _gmSec14(){
  var h = _gmH2(13);
  var liste = _gmOrnekListe();
  var ex = null;
  for(var i = 0; i < liste.length; i++) if(liste[i].id === 'siper') ex = liste[i];
  if(!ex) ex = liste[0];
  var P = ex ? _gmModelKur(ex) : null;
  if(!P){
    h += '<p>Örnek bu kurulumda bulunamadı; sayılar üretilmedi.</p>';
    return h;
  }

  var c = P.core, model = P.model, ui = P.ui;
  h += '<p>Kılavuzun tamamı tek bir gerçek güç grubunda: <strong>' + _gmE(ex.name) + '</strong>. '
    + 'Bütün sayılar belge üretilirken çekirdekle hesaplanır.</p>';

  // ── 14.1 Girdiler ────────────────────────────────────────────────────────
  h += '<h3>14.1 Model — ne girildi</h3>';
  var cSat = ui.components.map(function(x){
    return [_gmE(x.name), _gmFs(x.mass, 1),
            _gmFs(x.cg[0], 1) + ' / ' + _gmFs(x.cg[1], 1) + ' / ' + _gmFs(x.cg[2], 1),
            x.pointMass ? '<em>nokta kütle</em>'
              : (_gmFs(x.Ixx, 1) + ' / ' + _gmFs(x.Iyy, 1) + ' / ' + _gmFs(x.Izz, 1))];
  });
  h += _gmTablo('Kütle gövdeleri — girilen değerler',
    ['Gövde', 'Kütle [kg]', 'CG x / y / z [mm]', 'Ixx / Iyy / Izz [kg·m²]'],
    cSat, ['l', 'c', 'c', 'c']);

  var mSat = ui.mounts.map(function(x){
    return [_gmE(x.name),
            _gmFs(x.pos[0], 1) + ' / ' + _gmFs(x.pos[1], 1) + ' / ' + _gmFs(x.pos[2], 1),
            x.kstat.map(function(v){ return _gmFs(v, 0); }).join(' / '),
            x.kdyn.map(function(v){ return _gmFs(v, 0); }).join(' / '),
            _gmFs(x.kdyn[2] / x.kstat[2], 2)];
  });
  h += _gmTablo('Takozlar — girilen değerler',
    ['Takoz', 'Konum x / y / z [mm]', 'Statik k [N/mm]', 'Dinamik k [N/mm]',
     'Dinamik / statik (z)'],
    mSat, ['l', 'c', 'c', 'c', 'c']);
  h += _gmNot('Dinamik/statik oranı bir sağlık göstergesidir',
      'Son sütun her takozda 1’den büyük olmalı ve tipik olarak 1,4–1,8 bandında durmalıdır '
    + '(Bölüm 6). Bire eşit çıkıyorsa iki alana aynı sayı girilmiş demektir; banttan çok '
    + 'uzaksa katalog yanlış okunmuştur.');

  // ── 14.2 Birleşik kütle özellikleri ──────────────────────────────────────
  h += '<h3>14.2 Birleşik kütle özellikleri</h3>';
  var toplamUI = ui.components.reduce(function(s, x){ return s + (x.mass || 0); }, 0);
  h += _gmTablo('Birleşik kütle özellikleri',
    ['Büyüklük', 'Değer', 'Nasıl çıktı'],
    [
      ['Gövde sayısı', String(ui.components.length), 'Girilen kütle gövdeleri'],
      ['Toplam kütle', _gmFs(model.m, 1) + ' kg',
        'Gövde kütlelerinin toplamı (' + _gmFs(toplamUI, 1) + ' kg)'],
      ['Ortak ağırlık merkezi',
        _gmFs(model.cg[0] * 1000, 1) + ' / ' + _gmFs(model.cg[1] * 1000, 1) + ' / '
        + _gmFs(model.cg[2] * 1000, 1) + ' mm',
        'Kütlelerle ağırlıklı ortalama'],
      ['Takoz sayısı', String(ui.mounts.length), 'Rijit gövde kısıtı için ≥ 3 gerekir']
    ], ['l', 'c', 'l']);
  h += _gmOnay('Ataletler paralel-eksen teoremiyle taşındı',
      'Her gövdenin ataleti kendi CG’sinde girildi; ataletler ortak CG’ye taşınıp toplandı '
    + '(Bölüm 4). Taşınmış atalet girilirse taşıma <strong>iki kez</strong> yapılır.');

  // ── 14.3 Sehim ───────────────────────────────────────────────────────────
  var lc = ui.loadCases || [];
  var cozum = null;
  try { cozum = c.solveAllCases(model, lc, {}); } catch(e){ cozum = null; }
  if(cozum && cozum.length){
    h += '<h3>14.3 Sehim — bütün yük durumları</h3>';
    var qSat = cozum.map(function(rc){
      var q = rc.res && rc.res.q;
      if(!q) return [_gmE(rc.name), '—', '—', '—', '—', '—', '—'];
      var ck = (rc.res.checks) || {};
      return [_gmE(rc.name),
              _gmFs(q[0] * 1000, 2), _gmFs(q[1] * 1000, 2), _gmFs(q[2] * 1000, 2),
              _gmFs(q[3] * 180 / Math.PI, 3), _gmFs(q[4] * 180 / Math.PI, 3),
              (ck.tensionCount > 0)
                ? ('<strong>' + ck.tensionCount + ' takoz</strong>')
                : '<span class="ok">yok</span>'];
    });
    h += _gmTablo('Sehim ve çekme — yük durumu başına',
      ['Yük durumu', 'qx [mm]', 'qy [mm]', 'qz [mm]', 'θx [°]', 'θy [°]', 'Çekme'],
      qSat, ['l', 'c', 'c', 'c', 'c', 'c', 'c']);

    var st = cozum[0] && cozum[0].res;
    if(st && st.checks){
      h += _gmNot('Statik durum, sehimin temel hâli',
          'İlk satır yalnız ağırlık altındaki sehimdir: düşey ötelenme '
        + '<strong>' + _gmFs(st.q[2] * 1000, 3) + ' mm</strong>. Kuvvet dengesi artığı '
        + '<strong>' + _gmFs(st.checks.sumFzResidual || 0, 6) + '</strong> — sıfıra eşit '
        + 'olması çözümün kendi iç denetimidir (Bölüm 10), bir yaklaşıklık değil.');
    }
  }

  // ── 14.4 Modal ───────────────────────────────────────────────────────────
  var modes = null;
  try {
    var M6 = c.buildM6(model.m, model.I_G);
    modes = c.solveModal(model.Kdyn, M6, P.mounts, model.cg);
  } catch(e){ modes = null; }
  if(modes && modes.length){
    h += '<h3>14.4 Doğal frekanslar</h3>';
    var fSat = modes.map(function(m2, i){
      return [String(i + 1), _gmFs(m2.f_Hz, 2), _gmE(m2.label || '—'),
              m2.warning ? ('<strong>' + _gmE(m2.warning) + '</strong>')
                         : '<span class="ok">—</span>'];
    });
    h += _gmTablo('Rijit gövde modları (dinamik rijitlikle)',
      ['#', 'f [Hz]', 'Baskın hareket', 'Uyarı'], fSat, ['c', 'c', 'l', 'c']);

    var enYuksek = modes[modes.length - 1].f_Hz;
    var Te = (ui.torque && ui.torque.Te) ? ui.torque.Te : null;
    h += _gmNot('İzolasyon nasıl okunur',
        'En yüksek rijit gövde modu <strong>' + _gmFs(enYuksek, 2) + ' Hz</strong>. '
      + 'Bölüm 11’deki kural gereği rölanti ateşleme frekansının bunun en az '
      + '<strong>√2</strong> katı — pratikte 2,5–3 katı — olması istenir. Altı silindirli '
      + 'dört zamanlı bir motorda ateşleme frekansı <em>devir × 6 / 120</em> olduğundan, '
      + 'bu model için gereken rölanti yaklaşık <strong>'
      + _gmFs(enYuksek * 2.5 * 120 / 6, 0) + ' dev/dk</strong> mertebesindedir'
      + (Te ? ' (modelin motor torku ' + _gmFs(Te, 0) + ' N·m).' : '.'));
    h += _gmUyari('Bu sayı bir hedef değil, bir ölçüttür',
        'Değer, bu takoz setinin altı silindir varsayımıyla yalıttığı en düşük rölanti devridir. '
      + 'Gerçek rölanti daha düşükse ya takoz yumuşatılır ya da yerleşim değiştirilir.');
  }

  // ── 14.5 Örneği programda kurmak ─────────────────────────────────────────
  h += '<h3>14.5 Örneği programda kurmak</h3>';
  h += _gmAdimlar([
    'Boş bir Takoz modülünde başlangıç sayfasından <strong>' + _gmE(ex.name) + '</strong> '
      + 'karosuna tıklayın.',
    '<strong>Başlangıç ve Örnekler</strong> penceresinde tutarlılık uyarılarının boş olduğunu '
      + 'doğrulayın.',
    'Çözücüde <strong>Hesapla</strong>’ya basın; bir kütle gövdesinin penceresinde toplam '
      + 'kütleyi ve birleşik CG farkını yukarıdaki 14.2 tablosuyla karşılaştırın.',
    'Ayrıntı için <strong>Rapor</strong> bileşeninden çevrimdışı HTML raporu üretin.'
  ]);
  return h;
}

// ═══ 15 — PARAMETRİK ANALİZ: KATALOGDAN SEÇİM ════════════════════════════
// Kısıtların adı ve varsayılan sınırı çekirdekten (js/mount-katalog.js): kılavuz
// ile pencere aynı tablodan okur.
function _gmSec15(){
  var K = (typeof veMntKatalog !== 'undefined') ? veMntKatalog : require('./mount-katalog.js');
  var V = K.SINIR_VARSAYILAN;
  var h = _gmH2(14);
  h += '<p><strong>Parametrik Analiz</strong> bileşeninin ilk analizi <strong>Katalogdan seçim</strong>dir: '
    + 'takoz gruplarına kütüphanedeki tipleri tek tek takar, her kombinasyonu Çözücü’nün çözüm yolundan '
    + 'geçirir ve kısıtları sağlayanlar arasında iletilebilirlik ile statik sehim arasındaki dengeyi arar. '
    + 'Tarama bitince pencerenin <strong>Sonuç</strong> bölümü önerinin tiplerini, kriterlerin mevcut tasarımla '
    + 'karşılaştırmasını ve iki grafiği taşır; taramanın on diyagramı tam ekranda açılır; ayrıntılı rapor ayrı '
    + 'bir belgedir (<em>takoz_katalogdan_secim.html</em>).</p>';
  h += _gmAlanTablo('Parametrik Analiz penceresi', [
    ['<strong>Gruplar</strong>', 'Sağ/sol çiftler ve tek takozlar, x konumu, mevcut tip',
      '“Tara” işareti kalkan grup modeldeki takoz verisiyle kalır'],
    ['<strong>Adaylar</strong>', 'Kütüphanenin bütün tipleri: gömülü, değiştirilmiş, özel',
      'İşareti kalkan tip hiçbir gruba takılmaz'],
    ['<strong>Kısıtlar</strong>', 'Kesin kriterler (1 · 1a · 1b · 2), ek kısıtlar ve sınırları, amaç ağırlığı',
      'Kesin kriterler kapatılamaz'],
    ['<strong>Katalogdan seçim</strong>', 'Grup · tip · kombinasyon sayısı',
      'Kombinasyon = tip sayısı ^ taranan grup sayısı; üst sınır ' + _gmF(K.MAKS_KOMB, 0)],
    ['Sonuç', 'Öneri, kriterler, modlar, statik sehim ve iletilebilirlik, yakın seçenekler, eleme, '
      + 'diyagramların listesi; raporun indirilmesi', 'Yalnız taramadan sonra (Bölüm 15.5)']
  ], ['Kısım', 'Ne', 'Not']);
  h += '<h3>15.1 Gruplar</h3>';
  h += '<p>Bir grubun takozları aynı tiptir. Adında tek bir yan sözcüğü (<em>sağ</em> ya da <em>sol</em>) bulunan '
    + 'iki takoz, o sözcük çıkınca kalan adları aynıysa çifttir: “Sağ Ön Takoz” ile “Sol Ön Takoz”, '
    + '“Ön Sağ · 57RS313774” ile “Ön Sol · 57RS313774”. Adla eşleşmeyen iki takoz y’de ayna, x ve z’de '
    + _gmF(K.TOL_MM, 0) + ' mm içinde aynıysa çifttir. Kalan takoz tek başına bir gruptur (orta hattaki '
    + 'takoz). Gruplar önden arkaya, x’e göre sıralanır. Takoz konumları değişmez; yalnız tip değişir.</p>';
  h += '<h3>15.2 Kısıtlar</h3>';
  var olcut = {
    k1: ['bütün modlar &lt; 0,5·f<sub>ateş</sub>', 'kesin'],
    k1a: ['komşu iki mod arası &gt; 0,5 Hz', 'kesin'],
    k1b: ['hiçbir mod 8–10 Hz bandında değil', 'kesin'],
    k2: ['T(f<sub>ateş</sub>) &lt; %50', 'kesin'],
    sehimAlt: ['en büyük 1 g statik düşey sehim δ<sub>s</sub>', '≥ ' + _gmF(V.sehimAlt, 1) + ' mm'],
    sehim: ['δ<sub>s</sub>', '≤ ' + _gmF(V.sehimUst, 1) + ' mm'],
    altMod: ['en düşük mod', '≥ ' + _gmF(V.altMod, 1) + ' Hz'],
    kapasite: ['1 g statik yük / kapasite', '≤ %' + _gmF(V.kapasite * 100, 0)],
    ayrisma: ['zıplama ve yalpa modlarında kinetik enerji payı', '≥ %' + _gmF(V.ayrisma * 100, 0)],
    isletme: ['işletme yüklerinde en büyük |δ|', '≤ ' + _gmF(V.isletmeUst, 1) + ' mm'],
    durdurucu: ['aynısı, sürünmüş çalışma noktasında', '≤ ' + _gmF(V.durdurucuUst, 1) + ' mm'],
    cekme: ['işletme yüklerinde düşey çekme', '0 mm'],
    darbe: ['darbe yüklerinde en büyük yük / kapasite', '≤ %' + _gmF(V.darbe * 100, 0)]
  };
  h += _gmTablo('Kısıtlar ve varsayılan sınırlar', ['No', 'Kısıt', 'Ölçüt', 'Varsayılan', 'Açık'],
    K.KISITLAR.map(function(x){
      return [x.no, x.ad, olcut[x.k][0], olcut[x.k][1], x.zorunlu ? 'her zaman' : (K.ACIK_VARSAYILAN[x.k] ? 'evet' : 'hayır')];
    }), ['c', 'l', 'l', '', 'c']);
  h += '<p>Ek kısıtların dayanağı raporun Kısıtlar bölümündedir: statik sehim bandı ve en düşük mod ticari araç ve ağır '
    + 'kamyon çalışmalarından, sürünme payı (bir yılda +%20 · 45 ShA … +%33 · 75 ShA) ile darbe yükü sınırı (2 × anma yükü) '
    + 'üretici kataloğundan, işletme sehimi sınırı ±15 mm durdurucuya 5 mm pay bırakan doğrusal banttan; durdurucu payı '
    + 'sürünmüş takozun işletmede metal–metal durdurucuya oturmamasıdır. '
    + 'Kapasite kısıtları kapasitesi tanımlı tiplerde değerlendirilir.</p>';
  h += _gmTablo('Değerlendirme parametreleri', ['Parametre', 'Varsayılan', 'Etkisi'], [
    ['Sürünme payı', '%' + _gmF(V.surunme * 100, 0), 'E7’de işletme yüklerinin düşey çalışma noktası statik sehimin bu kadarı aşağıda'],
    ['Rijitlik toleransı', '±%' + _gmF(V.tolerans * 100, 0) + ' (kapalı)', 'Açıksa bütün takozlar sert ve yumuşak köşede de çözülür; '
      + 'frekans üstü ve T sertte, sehim ve alt frekans yumuşakta sınanır'],
    ['İletilebilirlik ağırlığı w', _gmF(V.agirlik, 1), 'Uzlaşı uzaklığında T’nin ağırlığı; sehiminki 1 − w']
  ], ['l', 'c', 'l']);
  h += '<p><strong>İşletme yükleri</strong> 1 g düşey ile birlikte en çok 1 g yatay ivme ve tahrik torkudur: statik, '
    + 'frenleme, hızlanma, viraj, fren + viraj, ileri ve geri tork, vites başına tork, 1 g yanal ve 1 g boyuna. '
    + '<strong>Darbe yükleri</strong> (3,5 g düşey, çukur + fren, 1,55 g bordür, geri esneme) ±15 mm metal–metal '
    + 'durdurucuyla sınırlanır; raporda yalnız en büyük sehimleri ve durdurucuya oturan takoz sayısı yazılır.</p>';
  h += '<h3>15.3 Amaç ve sıra</h3>';
  h += '<p>İki büyüklük birlikte küçültülür: rölanti iletilebilirliği <strong>T</strong> (Kriter 2’nin tanımı) ve '
    + 'en büyük statik sehim <strong>δ<sub>s</sub></strong>. Yumuşak takoz T’yi düşürür ve sehimi büyütür. '
    + 'Bütün kısıtları sağlayan kombinasyonlardan, iki amaçta da kendisinden iyi başka bir kombinasyon '
    + 'bulunmayanlar <strong>Pareto cephesi</strong>dir. <strong>Uzlaşı çözümü</strong>, iki amaç uygun kümenin '
    + 'en küçüğü ile en büyüğü arasında 0–1’e çekildikten sonra ideal noktaya ağırlıklı uzaklığı en küçük olan '
    + 'kombinasyondur; ağırlık <em>w</em> iletilebilirliğindir (varsayılan ' + _gmF(V.agirlik, 1) + '), sehiminki 1 − w.</p>';
  h += _gmNot('Uygun kombinasyon yoksa',
      'Rapor kısıtların normalleştirilmiş ihlallerinin toplamına göre en az ihlalli kombinasyonları '
    + 'sıralar ve her birinin hangi kısıtı sağlamadığını yazar.');
  h += '<h3>15.4 Tarama</h3>';
  h += _gmAdimlar([
    'Motor bileşenine rölanti devri ve silindir sayısı girilir: Kriter 1 ve 2 ateşleme frekansından türer.',
    '<strong>Gruplar</strong> ve <strong>Adaylar</strong> bölümlerinde taranacaklar işaretlenir; '
      + 'sağ sütundaki kombinasyon sayısı tarama süresinin ölçüsüdür (kombinasyon başına yaklaşık 0,5 ms).',
    '<strong>Tara</strong>: her kombinasyonda önce statik denge ve modal analiz (birinci aşama), kombinasyon '
      + 'çözülürse ardından işletme ve darbe yükleri (ikinci aşama). Düğmenin solundaki çubuk taranan '
      + 'kombinasyon sayısını ve oranı gösterir; düğme tarama sürerken <strong>Durdur</strong>dur. Tarama '
      + 'sürerken pencere ve tuval kullanılabilir.',
    'Pencerenin <strong>Sonuç</strong> bölümü açılır: öneri (uygun kombinasyon yoksa en az ihlalli '
      + 'kombinasyon), kriterler ve iki grafik.',
    '<strong>Raporu indir</strong> (<strong>Öneri</strong> bölümünde): kapsam, yöntem, kısıtlar, eleme, sonuç '
      + '(uzlaşı çözümü ve mevcut tasarım yan yana, Pareto şekli), sıralama, varsayımlar ve kaynaklar.'
  ]);
  h += '<p>Kısıtların sınırı, açık/kapalı durumu ve amaç ağırlığı değişince Sonuç bölümü taramanın sakladığı '
    + 'ölçülerden yeniden kurulur; tarama yinelenmez. Model, adaylar, sabit gruplar, tolerans ya da sürünme payı '
    + 'değişince tarama eskir ve Sonuç bölümü yalnız bu durumu yazar. Tarama proje dosyasına kaydedilmez.</p>';
  h += '<h3>15.5 Sonuç ve diyagramlar</h3>';
  h += '<p><strong>Öneri</strong> uzlaşı çözümüdür (Bölüm 15.3); uygun kombinasyon yoksa sıranın birincisi, en az '
    + 'ihlalli kombinasyondur ve bölümün, kriter sütununun ve grafiklerdeki işaretin adı <strong>En az ihlalli</strong>dir. '
    + 'Kısıtlar Sonuç bölümünde adlarıyla yazılır; tam ekrandaki diyagramlar kodlarıyla (K1 … E9), kodların '
    + 'adları diyagram listesinin altındadır.</p>';
  h += _gmAlanTablo('Sonuç bölümü', [
    ['<strong>Öneri</strong>', 'Grup başına tip: değişen grupta mevcut tip üstü çizili, önerinin tipi kalın; '
      + 'tipi aynı kalan grup <em>Aynı</em>, taranmayan grup <em>Sabit</em>. İletilebilirlik ve statik sehim: '
      + 'mevcut → öneri', '<strong>Raporu indir</strong> bu bölümde'],
    ['<strong>Kriterler</strong>', 'Açık kısıt başına satır: sınır, mevcut tasarımın ve önerinin değeri; ✓ sağlıyor, '
      + '✗ sağlamıyor (hücre kırmızı). Statik sehimin alt ve üst sınırı tek satırdır',
      'Değeri olmayan kısıt (kapasitesi tanımsız tip) —; değer sınıra yuvarlanıyorsa ondalığı uzar'],
    ['<strong>Modlar</strong>', 'Mevcut tasarımın ve önerinin modları, çentik başına bir mod; gri bölge '
      + 'sınır dışıdır (en düşük modun altı, 8–10 Hz bandı, 0,5·f<sub>ateş</sub>’in üstü); kırmızı çentik '
      + 'sınırı bozan mod', 'Kırmızı köprü 0,5 Hz’ten yakın iki mod; tolerans açıksa gri çizgi modun '
      + '±tolerans köşelerindeki yeri'],
    ['<strong>Statik sehim ve iletilebilirlik</strong>', 'Karo mevcut tasarım, halka öneri, boş daireler yakın '
      + 'seçenekler; ok mevcut tasarımdan öneriye. Yeşil bant statik sehimin sınırları', ''],
    ['<strong>Yakın seçenekler</strong>', 'Sıranın ikinci–altıncı kombinasyonu: grup başına tip (önerininkiyle '
      + 'aynı olan soluk), iletilebilirlik ve statik sehim; uygun değilse sağlamadığı kısıtlar',
      'Uygun kombinasyon beşten azsa en az ihlalli uygun olmayanlarla tamamlanır'],
    ['<strong>Eleme</strong>', 'Kısıtlar sırayla uygulanınca kalan kombinasyon sayısı; yalnız eleyen kısıtlar',
      'Son satır uygun kombinasyon sayısı'],
    ['<strong>Diyagramlar</strong>', 'Taramanın on diyagramının listesi; ad, diyagramı tam ekranda açar',
      'Tam ekranda soldaki listeden öteki diyagrama geçilir']
  ], ['Bölüm', 'Ne', 'Not']);
  h += _gmAlanTablo('Diyagramlar (tam ekran)', [
    ['Pareto cephesi', 'Çözülen her kombinasyon δ<sub>s</sub>–T düzleminde: gri nokta kesin '
      + 'kriterlerden birini, açık mavi bir ek kısıtı sağlamıyor, mavi bütün kısıtları sağlıyor; koyu basamak çizgisi '
      + 'Pareto cephesi, halka öneri, karo mevcut tasarım; kesikli çizgiler E1, E2 ve Kriter 2',
      'Sıranın ilk on kombinasyonunda ince çizgi ±tolerans rijitlik köşelerini birleştirir (yumuşak ↔ sert)'],
    ['Mod yerleşimi', 'Satır başına bir tasarım, çentik başına bir mod: mevcut tasarım ve sıranın '
      + 'ilk beşi; uygun kombinasyon beşten azsa en az ihlalli yakın kombinasyonlar (adlarında sağlamadıkları '
      + 'kısıtlar). Mavi çentik zıplama ya da baş-kıç ağırlıklı mod',
      'Gölge: E3’ün altı, 8–10 Hz bandı, 0,5·f<sub>ateş</sub>’in üstü; kırmızı köprü 0,5 Hz’ten yakın iki mod; '
      + 'gri çizgi ±tolerans köşelerinde modun yeri'],
    ['Bağlayıcı kısıtlar', 'Açık kısıt başına kısıtı sağlamayan kombinasyon sayısı ve yalnız o '
      + 'kısıtı sağlamayan (öteki bütün açık kısıtları sağlayan) kombinasyon sayısı',
      'İkinci sayı, sınırı gevşeyen kısıtın uygun kümeye katacağı kombinasyonlardır'],
    ['Sınır duyarlılığı', 'Sınırı olan her açık ek kısıt için uygun kombinasyon sayısı, '
      + 'o sınırın değerine göre; öteki sınırlar bugünkü değerinde',
      'Kesikli dikey çizgi bugünkü sınır; ölçüsü olmayan kısıt (kapasitesiz tipler) çizilmez'],
    ['Ana etkiler', 'Sıranın birincisinden yalnız bir grubun tipi değişir: yatay eksen o grubun '
      + 'tipi (statik düşey rijitlik sırasıyla), düşey eksen T ve δ<sub>s</sub>; çizgiler grup numarasıyla',
      'Dolu işaret uygun, boş işaret uygun değil; halka sıranın birincisi'],
    ['Kısıt haritaları', 'Kesitte açık kısıt başına bir harita: dolu hücre kısıtı sağlıyor; '
      + 'son harita bütün kısıtların kesişimi',
      'Kesitin her hücresinde sağlanan kısıtlar haritaların altında adlarıyla'],
    ['İletilebilirlik haritası', 'Kesitte hücre rengi T (%10 adım; en koyu sınıf Kriter 2’nin '
      + 'ötesi); çizgiler Kriter 1, E1, E2 ve E3 sınırları', 'Boş daire kesin kriterleri, dolu daire bütün kısıtları '
      + 'sağlayan hücre'],
    ['Kısıt penceresi', '3B: δ<sub>s</sub>, en yüksek mod f<sub>maks</sub> ve T; kesikli kutu '
      + 'E1–E2, Kriter 1 ve Kriter 2’nin bıraktığı pencere', 'Kutudaki nokta öteki kısıtları da sağlamıyorsa uygun değildir'],
    ['Tepki yüzeyi', '3B: kesitte seçilen büyüklüğün (T · δ<sub>s</sub> · f<sub>maks</sub>) yüzeyi',
      'Kesikli çerçeve büyüklüğün sınırı: Kriter 2 · E2 · Kriter 1'],
    ['Tasarım uzayı', '3B: üç taranan grubun tipi eksende, nokta başına bir kombinasyon; rengi '
      + 'eleme durumu', 'Kriter 1’de elenenler kutucukla görünür']
  ], ['Diyagram', 'Ne', 'Not']);
  h += '<p><strong>Kesit.</strong> Kısıt haritaları, İletilebilirlik haritası, Tepki yüzeyi ve Tasarım uzayı iki '
    + 'taranan grubu eksenlere koyar (tipler statik düşey rijitlik sırasıyla); öteki taranan gruplar seçilen tipte '
    + 'durur, varsayılan sıranın birincisinin tipidir. <em>Eksenler</em> ve <em>Grup</em> seçimi dört diyagramda '
    + 'ortaktır. Tek grup taranıyorsa kesit diyagramları çizilmez; Tasarım uzayı üç taranan grup ister.</p>';
  h += _gmNot('Etkileşim',
      '<strong>Diyagramlar</strong> bölümündeki ad diyagramı tam ekranda açar; soldaki listeden öteki diyagrama '
    + 'geçilir. 3B diyagramlar sol tık + sürükle ile döner; çizim odaktayken oklar döndürür; <em>Sıfırla</em> '
    + 'başlangıç bakışına döner. Grafikte ve diyagramda işaretin üstüne gelince kombinasyonun grup başına tipi, T, '
    + 'δ<sub>s</sub> ve sağlamadığı kısıtlar görünür; mod çentiğinin üstünde modun frekansı ve adı.');
  return h;
}

function _gmEkA(){
  var h = _gmH2(15);
  h += '<p>Pencereler bölümlerini tek gövdede alt alta taşır; kalın yazılan bölüm adları '
    + 'programdaki başlıklarla birebir aynıdır.</p>';
  h += _gmTablo('Alan → pencere eşlemesi',
    ['Alan', 'Pencere', 'Bölüm'],
    [
      ['Kütle ve ağırlık merkezi', 'Kütle gövdesi', '<strong>Kütle</strong> · <strong>Ağırlık merkezi</strong>'],
      ['Atalet tensörü', 'Kütle gövdesi', '<strong>Atalet tensörü</strong>'],
      ['Nokta kütle anahtarı', 'Kütle gövdesi', '<strong>Atalet tensörü</strong> (işaretliyken bölümün adı <strong>Atalet</strong>)'],
      ['Güç grubundaki yeri (kroki)', 'Kütle gövdesi · Takoz', 'Sağ sütun'],
      ['Motor torku', 'Motor', '<strong>Motor noktaları</strong> · <strong>Tork zinciri</strong>'],
      ['Vites oranları', 'Şanzıman', '<strong>Vites oranları</strong>'],
      ['Transfer oranı', 'Transfer Kutusu', '<strong>Oran ve aks payı</strong>'],
      ['PTO giriş yolu', 'PTO grubu', '<strong>Giriş yolu</strong>'],
      ['Takoz konumu', 'Takoz', '<strong>Konum</strong>'],
      ['Statik ve dinamik rijitlik', 'Takoz', '<strong>Rijitlik</strong>'],
      ['Taşıma kapasitesi', 'Takoz', '<strong>Kapasite</strong>'],
      ['Kuvvet–sehim eğrisi', 'Takoz Özellikleri', '<strong>Yasa</strong> (takozda <strong>Rijitlik</strong>’in altındaki not)'],
      ['Takoz tipleri (künyeler)', 'Takoz Özellikleri', '<strong>Takoz tipi</strong> · <strong>Rijitlik</strong> · <strong>Yasa</strong>'],
      ['Çözüm modu, sönüm oranı', 'Çözücü', '<strong>Yöntem</strong>'],
      ['Şok darbesi', 'Çözücü', '<strong>Şok darbesi</strong>'],
      ['Örnek modeller', 'Başlangıç sayfası · Başlangıç ve Örnekler', 'Karolar · <strong>Örnek model</strong> · <strong>Modeli kur</strong>'],
      ['Raporun frekans girdileri (rölanti, silindir, ζ)', 'Motor · Çözücü',
        'Rapor penceresinin <strong>Frekans yerleşimi ve izolasyon</strong> bölümü kaynağını gösterir'],
      ['Takoz grupları, taranan grup', 'Parametrik Analiz', '<strong>Gruplar</strong>'],
      ['Aday takoz tipleri', 'Parametrik Analiz', '<strong>Adaylar</strong>'],
      ['Ek kısıtların sınırı, sürünme, tolerans, amaç ağırlığı', 'Parametrik Analiz',
        '<strong>Ek kısıtlar</strong> · <strong>Değerlendirme</strong> · <strong>Amaç</strong>'],
      ['Taramanın sonucu', 'Parametrik Analiz', '<strong>Öneri</strong> · <strong>Kriterler</strong> · <strong>Modlar</strong> · <strong>Statik sehim ve iletilebilirlik</strong>'],
      ['Yakın kombinasyonlar ve eleme', 'Parametrik Analiz', '<strong>Yakın seçenekler</strong> · <strong>Eleme</strong>'],
      ['Taramanın on diyagramı (tam ekran)', 'Parametrik Analiz', '<strong>Diyagramlar</strong>: Pareto cephesi · Mod yerleşimi · Bağlayıcı kısıtlar · Sınır duyarlılığı · Ana etkiler · Kısıt haritaları · İletilebilirlik haritası · Kısıt penceresi · Tepki yüzeyi · Tasarım uzayı']
    ], ['l', 'c', 'l']);
  return h;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BELGE MONTAJI
// ═══════════════════════════════════════════════════════════════════════════

function veGuideMountHTML(){
  _gmTblNo = 0;

  var tarih = new Date().toLocaleDateString('tr-TR',
    { year: 'numeric', month: 'long', day: 'numeric' });

  var govde = veGuideAntet({
    eyebrow: 'MFSim · Takoz modülü · Kullanım kılavuzu',
    h1: 'Takoz Çökme-Titreşim Kılavuzu',
    sub: 'Kütle ve takoz künyesinden rapora: adım adım modelleme, girdi haritası, '
       + 'sonuçların okunması ve işlenmiş örnek',
    fields: [
      ['Belge', 'Kullanım kılavuzu'],
      ['Modül', 'Takoz Çökme-Titreşim'],
      ['Kapsam', VE_GUIDE_MOUNT_SECTIONS.length + ' bölüm'],
      ['Örnek', 'canlı çözülür'],
      ['Tarih', tarih]
    ]
  });

  govde += veGuideToc(VE_GUIDE_MOUNT_SECTIONS);
  govde += _gmSec1() + _gmSec2() + _gmSec3() + _gmSec4() + _gmSec5() + _gmSec6()
         + _gmSec7() + _gmSec8() + _gmSec9() + _gmSec10() + _gmSec11() + _gmSec12()
         + _gmSec13() + _gmSec14() + _gmSec15() + _gmEkA();

  return veGuideDocHTML({
    title: 'MFSim — Takoz Çökme-Titreşim kılavuzu',
    body: govde
  });
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veGuideMountHTML: veGuideMountHTML,
    VE_GUIDE_MOUNT_SECTIONS: VE_GUIDE_MOUNT_SECTIONS,
    _gmOrnekListe: _gmOrnekListe, _gmModelKur: _gmModelKur,
    _gmAlanTablo: _gmAlanTablo, _gmTablo: _gmTablo
  };
}
