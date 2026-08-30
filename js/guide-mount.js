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
  ['m1',  '1',    'Bu Kılavuz Nasıl Kullanılır'],
  ['m2',  '2',    'Modülün Haritası'],
  ['m3',  '3',    'Modüle Girmek'],
  ['m4',  '4',    'Kütle Gövdelerini Tanımlamak'],
  ['m5',  '5',    'Tahrik ve Tork'],
  ['m6',  '6',    'Takozları Yerleştirmek'],
  ['m7',  '7',    'Takoz Kütüphanesi ve Nonlineer Eğri'],
  ['m8',  '8',    'Yük Durumları'],
  ['m9',  '9',    'Çözücü'],
  ['m10', '10',   'Çökme Sonuçlarını Okumak'],
  ['m11', '11',   'Modal Analiz ve İzolasyon'],
  ['m12', '12',   'Rapor Üretmek'],
  ['m13', '13',   'Sık Yapılan Hatalar'],
  ['m14', '14',   'Sayısal Örnek: BMC SİPER'],
  ['mEk', 'Ek A', 'Alan → Panel Hızlı Başvurusu']
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
  h += '<p>Her bölüm aynı düzendedir: önce <em>ne yapacağınız</em> numaralı adımlarla, sonra '
    + '<em>hangi alana ne yazacağınız</em> bir tabloyla, en sonda o adımda sessizce yanlış '
    + 'gidebilecek şeyler bir uyarı kutusuyla verilir.</p>';
  h += '<p><strong>Bölüm 14</strong> bütün kılavuzu tek bir gerçek güç grubu üzerinde '
    + 'tekrarlar ve çıkan sayıları basar.</p>';
  h += _gmNot('Bu belgedeki sayılar ölçülmüştür',
      'Bölüm 14’teki bütün değerler, belge üretilirken programın <strong>gerçek çekirdeği</strong> '
    + '(<code>veMountCore</code>) koşturularak hesaplanır — kılavuza elle yazılmış tek bir '
    + 'sonuç yoktur. Çekirdek DOM’suz ve açık model kabul ettiği için hesap tamamen '
    + '<strong>bellekte</strong> yapılır: açık olan projenize hiçbir şekilde dokunulmaz.');
  h += '<h3>1.1 Bu modül neyi hesaplar</h3>';
  h += _gmAlanTablo('Kapsam', [
    ['<strong>Statik çökme</strong>', 'Ağırlık ve ivme altında güç grubunun 6 serbestlik '
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
  h += _gmUyari('Bağlantılar burada SALT GÖRSELDİR',
      'Diğer modüllerde tel bir akışı anlatır (FEAD’de kayış yolu, Araç Performans’ta güç '
    + 'akışı). Burada öyle <strong>değildir</strong>: çözücü bileşenleri '
    + '<strong>tipinden</strong> toplar, teli okumaz. Tel çekmek modeli değiştirmez; yalnız '
    + 'hangi kütlenin hangi takoza oturduğunu gözle anlatır. Bir bağlantıyı unutmanız '
    + 'sonucu <strong>etkilemez</strong> — ama bir bileşeni tuvale koymayı unutmanız '
    + 'etkiler.');
  h += '<h3>2.1 Bileşenler</h3>';
  h += _gmAlanTablo('İç topolojideki bileşenler', [
    ['<strong>Kütle gövdeleri</strong>', 'Motor · Şanzıman · Şaft · Braket · Transfer · '
      + 'PTO · Pompa · PTO Grubu', 'Hepsi aynı kütle/CG/atalet panelini taşır; farkları '
      + 'tahrik şeridinde'],
    ['<strong>Takoz</strong>', 'Konum ve üç eksenli rijitlik', 'En az 3, tipik olarak 3–4'],
    ['<strong>Kütüphane</strong>', 'Hazır takoz künyeleri', 'Katalogdan seçip uygulamak için'],
    ['<strong>Çözücü</strong>', 'Çözüm modu, sönüm, şok', 'Tuvalde bir tane'],
    ['<strong>Başlangıç ve Örnekler</strong>', 'Kayıtlı gerçek modeller', 'Bölüm 3'],
    ['<strong>3B Görüntüleyici · 2B Görünüm · Koordinat Çerçevesi</strong>',
      'Modeli gözle denetleme yüzeyleri', 'Hesaba girmez'],
    ['<strong>Rapor</strong>', 'Çevrimdışı HTML rapor', 'Bölüm 12']
  ], ['Bileşen', 'Ne', 'Not']);
  h += '<h3>2.2 Neyi siz verirsiniz, neyi program hesaplar</h3>';
  h += _gmAlanTablo('Girdi / türeyen ayrımı', [
    ['Kütle gövdeleri', 'kütle · ağırlık merkezi · atalet tensörü',
      '<strong>birleşik kütle özellikleri</strong> (toplam kütle, ortak CG, paralel-eksen '
      + 'teoremiyle birleştirilmiş atalet)'],
    ['Takozlar', 'konum · statik ve dinamik rijitlik (x, y, z) · kapasite',
      '<strong>rijitlik matrisi K</strong> (CG etrafında, 6×6)'],
    ['Yük durumları', 'ivme vektörü ve tork', '<strong>çökme q</strong> · takoz kuvvetleri'],
    ['Çözücü', 'çözüm modu · sönüm oranı', '<strong>doğal frekanslar</strong> · mod '
      + 'biçimleri · izolasyon']
  ], ['Konu', 'Siz verirsiniz', 'Program hesaplar']);
  h += _gmNot('Koordinat sistemi',
      'Bütün konumlar ve ağırlık merkezleri <strong>aynı çerçevede</strong> ve '
    + '<strong>mm</strong> cinsinden girilir. Çerçevenin nerede olduğu önemli değildir — '
    + 'çözüm merkez FARKLARINDAN kurulur — ama <strong>karıştırmamak</strong> önemlidir: '
    + 'bir kütlenin CG’si parça çerçevesinde, bir takozun konumu araç çerçevesindeyse model '
    + 'sessizce yanlış çözülür. <strong>Koordinat Çerçevesi</strong> bileşeni bunu gözle '
    + 'denetlemek için vardır.');
  return h;
}

function _gmSec3(){
  var h = _gmH2(2);
  h += '<h3>3.1 Yol A — hazır bir örnekten başlamak (önerilen)</h3>';
  h += _gmAdimlar([
    'Karşılama ekranından <strong>Takoz Çökme-Titreşim</strong> kartını seçin; ana tuvale '
      + 'tek bir alt-sistem kutusu düşer.',
    'Kutuya <strong>çift tıklayın</strong>. İlk açılışta içeride yalnız '
      + '<strong>Başlangıç ve Örnekler</strong> kutusu vardır.',
    'O kutuya çift tıklayın, listeden bir model seçin ve <strong>▶ Örneği Aktar</strong> '
      + 'deyin — bütün kütleler, takozlar ve künyeler bir anda kurulur.',
    'Panelin altındaki <strong>Tutarlılık Uyarıları</strong> kutusuna bakın: model '
      + 'çözülebilir durumda mı, eksik bir alan var mı?'
  ]);
  var liste = _gmOrnekListe();
  if(liste.length){
    var satir = liste.map(function(e){
      return [_gmE(e.name), _gmE(e.vehicle || '—'), _gmE(e.subtitle || '—')];
    });
    h += _gmTablo('Kayıtlı örnek modeller', ['Örnek', 'Araç', 'Yapılandırma'], satir,
      ['l', 'l', 'l']);
  }
  h += _gmNot('Tutarlılık uyarıları bir KAPIDIR',
      'Panel modeli sürekli denetler ve iki düzeyde konuşur: <strong>hata</strong> (kütle yok, '
    + 'takoz yok, kütle tanımsız) çözümü durdurur; <strong>uyarı</strong> (üçten az takoz, '
    + 'dörtten fazla takoz, tanımsız rijitlik, PTO kütlesinin iki kez sayılması) çözümü '
    + 'durdurmaz ama sonucu şüpheli yapar. Uyarısız bir model, kurduğunuz şeyin en azından '
    + 'iç tutarlılığa sahip olduğunu söyler.');
  h += '<h3>3.2 Yol B — sıfırdan elle kurmak</h3>';
  h += _gmAdimlar([
    'Paletten güç grubunun her parçası için bir <strong>kütle gövdesi</strong> sürükleyin '
      + '(Motor, Şanzıman, Şaft, Braket…).',
    'Her takoz için bir <strong>Takoz</strong> bileşeni sürükleyin. <strong>En az üç</strong> '
      + 'takoz gerekir: daha azında rijit gövde kinematik olarak serbest kalır ve rijitlik '
      + 'matrisi tekil olur.',
    'Bir <strong>Çözücü</strong> bileşeni bırakın.',
    'İsterseniz kütleleri takozlara tel çekerek görsel olarak eşleyin — <em>hesabı '
      + 'etkilemez</em> (bölüm 2).'
  ]);
  return h;
}

function _gmSec4(){
  var h = _gmH2(3);
  h += '<p>Güç grubunun her parçası bir <strong>kütle gövdesi</strong> düğümüdür. Hepsi aynı '
    + 'paneli taşır; tipe göre değişen tek şey alttaki tahrik şerididir (bölüm 5).</p>';
  h += _gmAdimlar([
    'Gövdeye çift tıklayın.',
    '<strong>Kütle &amp; Ağırlık Merkezi</strong> kartına kütleyi (kg) ve CG’yi (mm, x/y/z) '
      + 'yazın.',
    'Gövde ince ya da hafifse <strong>Nokta kütle</strong> anahtarını açın — atalet tensörü '
      + 'sıfır kabul edilir.',
    'Aksi hâlde sağdaki <strong>Atalet Tensörü</strong> kartına köşegen (I<sub>xx</sub>, '
      + 'I<sub>yy</sub>, I<sub>zz</sub>) ve çarpım (I<sub>xy</sub>, I<sub>xz</sub>, '
      + 'I<sub>yz</sub>) terimlerini kg·m² cinsinden girin.'
  ]);
  h += _gmAlanTablo('Kütle gövdesi paneli — alanlar', [
    ['Kütle [kg]', 'Parçanın kütlesi', 'CAD ölçümü ya da parça künyesi'],
    ['Ağırlık Merkezi (CG) [mm]', 'x / y / z — <strong>modelin ortak çerçevesinde</strong>',
      'CAD ölçümü (CATIA <em>Measure Inertia</em> gibi)'],
    ['Nokta kütle', 'Atalet ihmal edilsin mi',
      'Şaft, PTO parçası gibi ince/hafif gövdeler için uygun'],
    ['Atalet köşegen [kg·m²]', 'I<sub>xx</sub> · I<sub>yy</sub> · I<sub>zz</sub>',
      'CAD ölçümü — <strong>parçanın KENDİ CG’sinde</strong>'],
    ['Atalet çarpım [kg·m²]', 'I<sub>xy</sub> · I<sub>xz</sub> · I<sub>yz</sub>',
      'Simetrik gövdelerde çoğu sıfırdır']
  ]);
  h += _gmUyari('Atalet PARÇANIN KENDİ CG’sinde girilir',
      'Program gövdeleri birleştirirken <strong>paralel-eksen teoremini</strong> kendisi '
    + 'uygular: her parçanın ataleti, parçanın CG’sinden ortak CG’ye taşınır. Ataleti zaten '
    + 'ortak CG’ye taşınmış olarak girerseniz taşıma <strong>iki kez</strong> yapılır ve '
    + 'atalet şişer. Belirtisi yalnız modal analizde görünür: dönme modları beklenenden '
    + '<strong>düşük</strong> çıkar. Çökme sonuçları etkilenmez — bu yüzden hata sessizdir.');
  h += _gmNot('Birimler: kg · mm · kg·m² · N/mm',
      'Panel bu birimlerde çalışır ve çekirdeğe geçerken SI’ya çevirir. Atalet '
    + '<strong>kg·m²</strong>’dir (kg·mm² değil): 10⁶ kat fark eder ve karıştırıldığında '
    + 'dönme modları anlamsız yerlere gider.');
  return h;
}

function _gmSec5(){
  var h = _gmH2(4);
  h += '<p>Bazı kütle gövdeleri, kütlelerine ek olarak <strong>tork</strong> üretir ya da '
    + 'iletir. Bu bilgiler panelin alt şeridinde, tipe göre değişen bir kartta durur.</p>';
  h += _gmAlanTablo('Tahrik kartları', [
    ['Motor · Tahrik', 'Motor torku ve stall oranı', 'Motor künyesi ve konvertör'],
    ['Şanzıman · Vites Oranları', 'Vites başına oran', 'Şanzıman künyesi'],
    ['Transfer Kutusu · Tahrik', 'Transfer oranı', 'Transfer künyesi'],
    ['PTO Grubu · Giriş Yolu', 'PTO/pompa kütlesinin nasıl verildiği',
      'Toplu ya da parça parça — <strong>ikisi birden değil</strong>']
  ], ['Kart', 'Ne taşır', 'Nereden']);
  h += '<p>Tork bilgisi <strong>vites tork durumlarını</strong> üretir: program her vites '
    + 'için tepki torkunu hesaplar ve ayrı bir yük durumu olarak çözer (bölüm 8).</p>';
  h += _gmUyari('PTO kütlesi İKİ KEZ sayılabilir',
      'PTO grubunun kütlesini iki yoldan verebilirsiniz: tek bir <strong>PTO Grubu</strong> '
    + 'gövdesiyle toplu olarak, ya da ayrı <strong>PTO</strong> ve <strong>Pompa</strong> '
    + 'gövdeleriyle parça parça. <strong>İkisini birden</strong> tanımlarsanız aynı kütle iki '
    + 'kez sayılır ve çözücü “makul ama yanlış” bir toplam üretir. Tutarlılık uyarıları bunu '
    + 'yakalar ve adıyla söyler — ama yalnız bakarsanız.');
  return h;
}

function _gmSec6(){
  var h = _gmH2(5);
  h += '<p>Takoz, güç grubunu şasiye bağlayan üç eksenli bir yaydır. Her takoz kendi '
    + 'konumunu ve üç eksende iki ayrı rijitliğini taşır.</p>';
  h += _gmAdimlar([
    'Takoza çift tıklayın.',
    '<strong>Kütüphane</strong> kartından hazır bir takoz künyesi seçin — konum '
      + 'HARİÇ bütün alanlar dolar (bölüm 7).',
    '<strong>Konum</strong> kartına takozun x / y / z koordinatını yazın (mm, modelin '
      + 'ortak çerçevesinde).',
    'Künye kütüphanede yoksa <strong>Statik Rijitlik</strong> ve <strong>Dinamik '
      + 'Rijitlik</strong> kartlarına üç eksenin değerlerini elle girin (N/mm).',
    'Elinizde varsa <strong>Taşıma Kapasitesi</strong> alanına takozun azami eksenel yükünü '
      + 'yazın — sonuçlarda kullanım yüzdesi olarak görünür.'
  ]);
  h += _gmAlanTablo('Takoz paneli — alanlar', [
    ['Konum [mm]', 'x / y / z — takozun <strong>elastik merkezi</strong>',
      'Montaj resmi; kütle CG’leriyle <strong>aynı çerçevede</strong>'],
    ['Statik Rijitlik [N/mm]', 'k<sub>x</sub> · k<sub>y</sub> · k<sub>z</sub>',
      'Takoz kataloğu — <strong>yavaş yükleme</strong> değeri'],
    ['Dinamik Rijitlik [N/mm]', 'k<sub>x</sub> · k<sub>y</sub> · k<sub>z</sub>',
      'Aynı katalog — <strong>titreşim frekansındaki</strong> değer'],
    ['Maks. eksenel yük [kg]', 'Takozun taşıyabileceği azami yük',
      'Katalog; boş bırakılabilir, o zaman kullanım yüzdesi basılmaz']
  ]);
  h += _gmUyari('Statik ve dinamik rijitlik AYNI DEĞİLDİR',
      'Elastomer bir takoz, hızlı yüklemede yavaş yüklemeden <strong>daha rijittir</strong> — '
    + 'tipik oran 1,4–1,8. Program ikisini ayrı ayrı kullanır: <strong>çökme</strong> statik '
    + 'rijitlikle, <strong>doğal frekanslar</strong> dinamik rijitlikle hesaplanır. İkisine '
    + 'aynı değeri yazarsanız model yine çözülür — ama ya çökme fazla küçük çıkar ya '
    + 'frekanslar fazla düşük. <strong>Hata verilmez.</strong>');
  h += _gmNot('Üç takoz alt sınırdır, dört üst sınır DEĞİLDİR',
      'Rijit gövdeyi 6 serbestlik derecesinde kısıtlamak için en az üç takoz gerekir; daha '
    + 'azında rijitlik matrisi <strong>tekildir</strong> ve çözücü açıkça “singular” der. '
    + 'Dörtten fazla takoz ise <em>aşırı-kısıtlı</em> bir modeldir: çözülür, ama yük dağılımı '
    + 'takozların birbirine göre rijitliğine çok duyarlı hâle gelir. Tipik bir güç grubu 3–4 '
    + 'takozla bağlanır ve panel bunun dışını uyarı olarak yazar.');
  return h;
}

function _gmSec7(){
  var h = _gmH2(6);
  h += '<h3>7.1 Kütüphane</h3>';
  h += '<p><strong>Kütüphane</strong> bileşeni hazır takoz künyelerini taşır. Bir künye '
    + 'seçip takoza uyguladığınızda rijitlikler ve kapasite dolar; <strong>konum '
    + 'dolmaz</strong> — o motorun verisidir, parçanın değil.</p>';
  h += _gmNot('Künye KOPYA olarak gider',
      'Kütüphaneden uygulanan değerler takoz düğümüne <strong>kopyalanır</strong>. Katalog '
    + 'sürümü bir gün güncellenip bir değer düzeltilse bile kaydedilmiş projeniz '
    + '<strong>kendiliğinden değişmez</strong>; yalnız hangi künyeden geldiğinin izi kalır. '
    + 'Bir katalog güncellemesinin kaydedilmiş bir analizi sessizce değiştirmesi, bu programın '
    + 'en çok kaçındığı hata sınıfıdır.');
  h += '<h3>7.2 Nonlineer z-eğrisi</h3>';
  h += '<p>Elastomer takozlar büyük çökmede <strong>sertleşir</strong>: kuvvet–sehim ilişkisi '
    + 'doğru değil, yukarı bükülen bir eğridir. Takoz paneline bir '
    + '<strong>kuvvet–sehim eğrisi</strong> girerseniz çözücü otomatik olarak nonlineer '
    + 'yola (Newton iterasyonu) geçer.</p>';
  h += _gmAlanTablo('Doğrusal ↔ nonlineer', [
    ['Hiçbir takozda eğri yok', 'Doğrusal çözüm — tek adımda',
      'Küçük çökmelerde (statik ağırlık) doğru ve hızlı'],
    ['En az bir takozda eğri var', 'Newton iterasyonu — bütün model nonlineer çözülür',
      'Büyük çökme (3,5 g düşey gibi) için gerekli'],
    ['Metal-metal durdurucu', 'Çözücüde ayrıca açılır',
      'Takozun mekanik sınırına dayanmasını modeller']
  ], ['Durum', 'Çözüm yolu', 'Ne zaman']);
  h += _gmUyari('Doğrusal model büyük çökmede İYİMSERDİR',
      'Eğri girilmemişse program takozu <strong>her çökmede aynı rijitlikte</strong> sayar. '
    + 'Gerçek takoz sertleştiği için doğrusal model büyük ivmelerde çökmeyi '
    + '<strong>fazla</strong>, takoz kuvvetini <strong>az</strong> gösterir. Sonuçlarda '
    + '“doğrusal aralık aşıldı” sayacı bunu bildirir — sıfırdan büyükse eğri girmeyi '
    + 'düşünün.');
  return h;
}

function _gmSec8(){
  var h = _gmH2(7);
  h += '<p>Bir yük durumu iki şeyden oluşur: bir <strong>ivme vektörü</strong> (g cinsinden, '
    + 'x/y/z) ve bir <strong>tork</strong> (N·m, x/y/z). Program bunlardan güç grubuna etki '
    + 'eden kuvvet ve momenti kurar, sonra çökmeyi çözer.</p>';
  h += _gmTablo('Standart yük durumları',
    ['Durum', 'İvme n = [x, y, z]', 'Ne anlatıyor'],
    [
      ['Static', '[0, 0, −1]', 'Yalnız ağırlık — çökmenin temel hâli'],
      ['Max Bump', '[0, 0, −3]', 'Düşey darbe (3 g)'],
      ['Acceleration', '[+1, 0, −1]', 'Boyuna hızlanma'],
      ['Braking', '[−1, 0, −1]', 'Fren'],
      ['Cornering L / R', '[0, ±0,6, −1]', 'Yanal viraj'],
      ['Forward / Reverse Torque', '[0, 0, −1] + T', 'Tahrik tepki torku']
    ], ['l', 'c', 'l']);
  h += '<p>Bunlara ek olarak program <strong>vites tork durumlarını</strong> (her vites için '
    + 'ayrı) ve üç <strong>tasarım yük durumunu</strong> (3,5 g düşey · 1 g yanal · 1 g '
    + 'boyuna fren) kendiliğinden kurar.</p>';
  h += _gmNot('İvme işareti',
      'Düşey bileşen <strong>−1</strong>’dir çünkü yerçekimi aşağı yöndedir; “3 g düşey” '
    + 'demek n<sub>z</sub> = −3 demektir. Yanal ve boyuna bileşenler ise aracın ivmesidir ve '
    + 'gövdeye <strong>ters yönde</strong> atalet kuvveti uygular — çeviriyi program yapar.');
  return h;
}

function _gmSec9(){
  var h = _gmH2(8);
  h += '<p><strong>Çözücü</strong> bileşenine çift tıklayın. Panel dört karta ayrılır.</p>';
  h += _gmAlanTablo('Çözücü paneli — kartlar', [
    ['Çözüm Modu', 'Doğrusal ya da nonlineer, metal-metal durdurucu açık/kapalı',
      'Takozlarda eğri varsa nonlineer kendiliğinden seçilir'],
    ['Sönüm Oranı ζ', 'Modal sönüm oranı', 'Elastomerde tipik 0,05–0,15'],
    ['Şok Darbesi', 'Darbe genliği ve süresi', 'Geçici rejim analizi için'],
    ['Takoz Özellikleri', 'Çözümün kullandığı künyelerin özeti', 'Salt okunur denetim']
  ], ['Kart', 'Ne', 'Not']);
  h += _gmAdimlar([
    'Çözüm modunu ve gerekiyorsa durdurucuyu ayarlayın.',
    'Sönüm oranını girin — yalnız şok ve izolasyon hesabına girer, çökmeye girmez.',
    '<strong>▶ Hesapla</strong> düğmesine basın.',
    'Panelin altındaki durum şeridini okuyun: kaç kütle, kaç takoz, kaç yük durumu, kaç mod '
      + 'çözüldü; toplam kütle ve ortak CG nerede çıktı.'
  ]);
  h += _gmUyari('Durum şeridindeki notlar bir HÜKÜMDÜR',
      'Şerit yalnız “çözüldü” demez; <strong>çekme</strong> (bir takoz çekiye giriyor), '
    + '<strong>durdurucu teması</strong>, <strong>doğrusal aralık aşımı</strong>, '
    + '<strong>yakınsamama</strong> ve <strong>f ≈ 0 modu</strong> gibi mühendislik notlarını '
    + 'da basar. Bunlar hata değildir — modelin size söylediği şeylerdir. Ayrıntısı raporda.');
  return h;
}

function _gmSec10(){
  var h = _gmH2(9);
  h += '<p>Her yük durumu için çözülen şey <strong>q</strong> vektörüdür: güç grubunun '
    + 'ortak CG’sinin üç ötelenmesi (mm) ve üç dönmesi (derece).</p>';
  h += _gmAlanTablo('Çökme sonuçları', [
    ['q<sub>x</sub> · q<sub>y</sub> · q<sub>z</sub>', 'CG’nin ötelenmesi, mm',
      'Statik durumda z genellikle en büyüğüdür'],
    ['θ<sub>x</sub> · θ<sub>y</sub> · θ<sub>z</sub>', 'Roll · pitch · yaw dönmesi, derece',
      'Tork durumlarında roll belirgin büyür'],
    ['Takoz kuvvetleri', 'Her takozda üç eksenli kuvvet, N',
      'İşaret yönü verir: negatif z basma, pozitif z <strong>çekme</strong>'],
    ['Kuvvet dengesi', 'Σ F ≈ dış kuvvet', 'Sıfıra yakın olmalı — çözümün iç denetimi'],
    ['Kapasite kullanımı', 'Takoz başına %', 'Kapasite girildiyse']
  ], ['Büyüklük', 'Ne', 'Nasıl okunur']);
  h += _gmUyari('ÇEKME bir tasarım uyarısıdır',
      'Elastomer takozlar basmada çalışmak üzere tasarlanır. Bir takozun düşey kuvveti '
    + '<strong>çekiye</strong> dönüyorsa (gövde o köşeden kalkıyorsa) takoz ya kopar ya da '
    + 'ömrü kısalır. Program çekiye giren takozları sayar ve durum şeridinde bildirir. '
    + 'Genellikle çare takozu yeniden konumlandırmaktır, rijitliği büyütmek değil.');
  h += _gmNot('Kuvvet dengesi çözümün KENDİ denetimidir',
      'Takoz kuvvetlerinin toplamı, uygulanan dış kuvvete eşit olmak <strong>zorundadır</strong> '
    + '— bu bir modelleme tercihi değil, denge denkleminin kendisi. Program artığı hesaplayıp '
    + 'basar; sıfırdan belirgin farklıysa çözüm yakınsamamıştır.');
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
  return h;
}

function _gmSec12(){
  var h = _gmH2(11);
  h += '<p><strong>Rapor</strong> bileşeni çevrimdışı, tek dosyalık bir HTML rapor üretir: '
    + 'teori bölümleri, modelin künyesi, bütün yük durumları, takoz kuvvetleri, modal sonuçlar '
    + 've uygunluk hükmü.</p>';
  h += _gmAdimlar([
    'Önce modeli <strong>çözün</strong> — rapor bir sonuç belgesidir ve çözümsüz üretilmez.',
    'Rapor bileşenine çift tıklayın, doküman künyesini (hazırlayan, proje) doldurun.',
    'Raporu üretip indirin. Dosya tek başına açılır; internet gerekmez.'
  ]);
  h += _gmUyari('Rapor çözümün fotoğrafıdır',
      'Rapor üretildikten sonra bir alanı değiştirirseniz o değişiklik rapora '
    + '<strong>sızmaz</strong> — belge kendi sayılarıyla çelişmez. Değişikliği yansıtmak için '
    + 'yeniden çözün ve raporu yeniden üretin.');
  return h;
}

function _gmSec13(){
  var h = _gmH2(12);
  h += '<p>Bu modülde de en pahalı hata sınıfı çöken model değil, <strong>“makul ama yanlış” '
    + 'sayıdır</strong>.</p>';
  h += _gmTablo('Sessiz hata sınıfları',
    ['Alan', 'Yanlış verilirse ne olur', 'Belirtisi'],
    [
      ['Karışık koordinat çerçevesi', 'Bir CG parça çerçevesinde, bir takoz araç '
        + 'çerçevesinde', 'Çökme ve modlar birlikte anlamsızlaşır — ama hata çıkmaz'],
      ['Atalet zaten taşınmış girilir', 'Paralel-eksen teoremi iki kez uygulanır',
        'Yalnız <strong>dönme modları</strong> düşer; çökme normal görünür'],
      ['Atalet birimi kg·mm²', 'Atalet 10⁶ kat büyür',
        'Dönme modları sıfıra yakın çıkar'],
      ['Statik = dinamik rijitlik', 'İki ayrı büyüklüğe aynı sayı',
        'Ya çökme küçük ya frekanslar düşük — ikisi birden doğru olamaz'],
      ['PTO kütlesi iki yoldan', 'Aynı kütle iki kez sayılır',
        'Toplam kütle beklenenden büyük — tutarlılık uyarısı bunu söyler'],
      ['Üçten az takoz', 'Rijit gövde serbest kalır', 'K tekil — çözücü açıkça söyler'],
      ['Takozlar tek düzlemde', 'Bir serbestlik derecesi kısıtlanmaz',
        'Bir mod <strong>f ≈ 0</strong> çıkar'],
      ['Doğrusal model, büyük ivme', 'Sertleşme modellenmez',
        '“Doğrusal aralık aşıldı” sayacı sıfırdan büyük']
    ], ['l', 'l', 'l']);
  h += _gmOnay('En hızlı gözden geçirme: tutarlılık uyarıları + durum şeridi',
      'Yukarıdaki sınıfların çoğu bu iki yüzeyde adıyla görünür. Çözümden sonra durum '
    + 'şeridini okumayı alışkanlık edinin; “✓ Çözüldü” tek başına “model doğru” demek '
    + 'değildir.');
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
    h += '<p>Bu bölüm, kayıt defterindeki bir örneği belge üretilirken çözüp sayılarını '
      + 'basar. Örnek bu kurulumda bulunamadı, bu yüzden sayılar üretilmedi — '
      + '<em>uydurulmuş bir değer basmak yerine bölüm boş bırakılıyor</em>.</p>';
    return h;
  }

  var c = P.core, model = P.model, ui = P.ui;
  h += '<p>Bu bölüm bütün kılavuzu tek bir gerçek güç grubu üzerinde tekrarlar: '
    + '<strong>' + _gmE(ex.name) + '</strong>. Aşağıdaki bütün sayılar, bu belge üretilirken '
    + 'programın <strong>kendi çekirdeği</strong> koşturularak hesaplanmıştır.</p>';

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
  h += _gmNot('Dinamik/statik oranı bir SAĞLIK GÖSTERGESİDİR',
      'Son sütun her takozda 1’den büyük olmalı ve tipik olarak 1,4–1,8 bandında durmalıdır '
    + '(bölüm 6). Bire eşit çıkıyorsa iki alana aynı sayı girilmiş demektir; banttan çok '
    + 'uzaksa katalog yanlış okunmuştur.');

  // ── 14.2 Birleşik kütle özellikleri ──────────────────────────────────────
  h += '<h3>14.2 Program neyi birleştirdi</h3>';
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
      'Her gövdenin ataleti kendi CG’sinde girildi ve program onları ortak CG’ye taşıyıp '
    + 'topladı (bölüm 4). Bu, kılavuzun en çok vurguladığı sessiz hatanın — ataleti zaten '
    + 'taşınmış girmenin — neden sonucu bozduğunu gösterir: taşıma burada '
    + '<strong>zaten</strong> yapılıyor.');

  // ── 14.3 Çökme ───────────────────────────────────────────────────────────
  var lc = ui.loadCases || [];
  var cozum = null;
  try { cozum = c.solveAllCases(model, lc, {}); } catch(e){ cozum = null; }
  if(cozum && cozum.length){
    h += '<h3>14.3 Çökme — bütün yük durumları</h3>';
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
    h += _gmTablo('Çökme ve çekme — yük durumu başına',
      ['Yük durumu', 'qx [mm]', 'qy [mm]', 'qz [mm]', 'θx [°]', 'θy [°]', 'Çekme'],
      qSat, ['l', 'c', 'c', 'c', 'c', 'c', 'c']);

    var st = cozum[0] && cozum[0].res;
    if(st && st.checks){
      h += _gmNot('Statik durum, çökmenin temel hâli',
          'İlk satır yalnız ağırlık altındaki çökmedir: düşey ötelenme '
        + '<strong>' + _gmFs(st.q[2] * 1000, 3) + ' mm</strong>. Kuvvet dengesi artığı '
        + '<strong>' + _gmFs(st.checks.sumFzResidual || 0, 6) + '</strong> — sıfıra eşit '
        + 'olması çözümün kendi iç denetimidir (bölüm 10), bir yaklaşıklık değil.');
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
    h += _gmUyari('Bu sayı bir HEDEF değil bir ÖLÇÜTTÜR',
        'Program rölanti devrini bilmez; yukarıdaki değer yalnız “bu takoz seti hangi '
      + 'rölantiye kadar yalıtır” sorusunun cevabıdır. Gerçek rölanti daha düşükse ya '
      + 'takoz yumuşatılır ya da yerleşim değiştirilir.');
  }

  // ── 14.5 Kendiniz koşturmak ──────────────────────────────────────────────
  h += '<h3>14.5 Bu örneği kendiniz koşturmak</h3>';
  h += _gmAdimlar([
    'Takoz modülünün iç topolojisinde <strong>Başlangıç ve Örnekler</strong> kutusunu açın.',
    'Listeden <strong>' + _gmE(ex.name) + '</strong> örneğini seçip '
      + '<strong>▶ Örneği Aktar</strong> deyin.',
    'Tutarlılık uyarılarının boş olduğunu doğrulayın.',
    'Çözücüde <strong>▶ Hesapla</strong>’ya basın ve durum şeridindeki toplam kütle ile '
      + 'CG’yi yukarıdaki 14.2 tablosuyla karşılaştırın.',
    'Ayrıntı için <strong>Rapor</strong> bileşeninden çevrimdışı HTML raporu üretin.'
  ]);
  h += _gmOnay('Kılavuz ile program aynı sayıyı verir',
      'Yukarıdaki değerler bu belge üretilirken programın <strong>kendi çekirdeğiyle</strong> '
    + 'hesaplandı; kılavuza elle yazılmış tek bir sonuç yoktur. Hesap tamamen bellekte '
    + 'yapıldığı için açık olan projenize dokunulmadı.');
  return h;
}

function _gmEkA(){
  var h = _gmH2(14);
  h += '<p>Bir alanı nerede bulacağınızı hatırlamak için. Panel adları programdaki '
    + 'başlıklarla birebir aynıdır.</p>';
  h += _gmTablo('Alan → panel eşlemesi',
    ['Aradığınız', 'Panel', 'Kart'],
    [
      ['Kütle ve ağırlık merkezi', 'Kütle gövdesi', 'Kütle &amp; Ağırlık Merkezi'],
      ['Atalet tensörü', 'Kütle gövdesi', 'Atalet Tensörü'],
      ['Nokta kütle anahtarı', 'Kütle gövdesi', 'Kütle &amp; Ağırlık Merkezi altı'],
      ['Motor torku', 'Motor', 'Motor · Tahrik'],
      ['Vites oranları', 'Şanzıman', 'Şanzıman · Vites Oranları'],
      ['Transfer oranı', 'Transfer Kutusu', 'Transfer Kutusu · Tahrik'],
      ['PTO giriş yolu', 'PTO Grubu', 'PTO Grubu · Giriş Yolu'],
      ['Takoz konumu', 'Takoz', 'Konum'],
      ['Statik rijitlik', 'Takoz', 'Statik Rijitlik'],
      ['Dinamik rijitlik', 'Takoz', 'Dinamik Rijitlik'],
      ['Taşıma kapasitesi', 'Takoz', 'Taşıma Kapasitesi'],
      ['Kuvvet–sehim eğrisi', 'Takoz', 'Kuvvet–Sehim Yasası'],
      ['Hazır takoz künyeleri', 'Kütüphane', '—'],
      ['Çözüm modu ve durdurucu', 'Çözücü', 'Çözüm Modu'],
      ['Sönüm oranı', 'Çözücü', 'Sönüm Oranı ζ'],
      ['Şok darbesi', 'Çözücü', 'Şok Darbesi'],
      ['Örnek modeller', 'Başlangıç ve Örnekler', '—'],
      ['Doküman künyesi', 'Rapor', '—']
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
    eyebrow: 'MFSim · Takoz Modülü · Kullanım Kılavuzu',
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
         + _gmSec13() + _gmSec14() + _gmEkA();

  return veGuideDocHTML({
    title: 'MFSim — Takoz Çökme-Titreşim Kılavuzu',
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
