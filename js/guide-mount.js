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
  ['m14', '14',   'Sayısal örnek: BMC SİPER'],
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
      + 'PTO · Pompa · PTO grubu', 'Hepsi aynı “Kütle ve CG” ve “Atalet” sekmelerini taşır; '
      + 'farkları üçüncü sekmede'],
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
      + 'tipler, kısıtlar, iletilebilirlik–sehim dengesi; sonuç ayrı bir raporda', 'Bölüm 15']
  ], ['Bileşen', 'Ne', 'Not']);
  h += '<h3>2.2 Neyi siz verirsiniz, neyi program hesaplar</h3>';
  h += _gmAlanTablo('Girdi / türeyen ayrımı', [
    ['Kütle gövdeleri', 'kütle · ağırlık merkezi · atalet tensörü',
      '<strong>birleşik kütle özellikleri</strong> (toplam kütle, ortak CG, paralel-eksen '
      + 'teoremiyle birleştirilmiş atalet)'],
    ['Takozlar', 'konum · statik ve dinamik rijitlik (x, y, z) · kapasite',
      '<strong>rijitlik matrisi K</strong> (CG etrafında, 6×6)'],
    ['Yük durumları', 'ivme vektörü ve tork', '<strong>sehim q</strong> · takoz kuvvetleri'],
    ['Çözücü', 'çözüm modu · sönüm oranı', '<strong>doğal frekanslar</strong> · mod '
      + 'biçimleri · izolasyon']
  ], ['Konu', 'Siz verirsiniz', 'Program hesaplar']);
  h += _gmNot('Sonuçlar raporda',
      'Bileşen pencereleri yalnız girdiyi ve girdiden türeyeni gösterir (birleşik kütle, '
    + 'CG farkı, dinamik/statik oranı, mil torku). Sehim, takoz kuvvetleri, modlar ve '
    + 'uygunluk hükmü <strong>ayrıntılı raporda</strong>dır (bölüm 12); pencerelerde çözümle '
    + 'değişen tek şey Çözücü’nün ve Rapor’un son hesabın güncel olup olmadığını söyleyen satırıdır.');
  h += _gmNot('Koordinat sistemi',
      'Bütün konumlar ve ağırlık merkezleri <strong>aynı çerçevede</strong> ve '
    + '<strong>mm</strong> cinsinden girilir. Çerçevenin nerede olduğu önemli değildir — '
    + 'çözüm merkez FARKLARINDAN kurulur — ama <strong>karıştırmamak</strong> önemlidir: '
    + 'bir kütlenin CG’si parça çerçevesinde, bir takozun konumu araç çerçevesindeyse model '
    + 'sessizce yanlış çözülür. <strong>Koordinat Düzlemi</strong> bileşeni bunu gözle '
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
    'O kutuya çift tıklayın, listeden bir model seçin ve <strong>▶ Örneği aktar</strong> '
      + 'deyin — bütün kütleler, takozlar ve künyeler bir anda kurulur.',
    'Penceredeki <strong>Tutarlılık uyarıları</strong> bölümüne bakın: model '
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
  h += '<p>Güç grubunun her parçası bir <strong>kütle gövdesi</strong> düğümüdür. Penceresi '
    + 'sağdaki sütunda açılır. Pencere FEAD pencereleriyle aynı yapıdadır: üstte kategori '
    + 'sekmeleri, sağda (dar pencerede altta) sekmeden bağımsız sütun. İlk iki sekme her '
    + 'gövdede aynıdır (<strong>Kütle ve CG</strong> · <strong>Atalet</strong>); tipe göre '
    + 'değişen üçüncü sekmedir (bölüm 5). Sağ sütundaki <strong>Güç grubundaki yeri</strong> '
    + 'Görünümler’in çizimidir ve onunla aynı açıda döner (sol tık + sürükle; başlıktaki '
    + 'düğmeler yakınlaştırır, dimetrik bakışa sıfırlar ve tam ekran açar): bu gövde aydınlık '
    + 've adıyla, modelin geri kalanı gölgede; öteki işaretlerin bilgisi farenin altında.</p>';
  h += _gmAdimlar([
    'Gövdeye çift tıklayın.',
    '<strong>Kütle ve CG</strong> sekmesinde kütleyi (kg) ve <strong>Ağırlık merkezi</strong> '
      + 'föyüne CG’yi (mm, x/y/z) yazın — yanındaki sütun birleşik ağırlık merkezine farkı gösterir.',
    '<strong>Atalet</strong> sekmesinde, gövde ince ya da hafifse <strong>Nokta kütle</strong> '
      + 'kutusunu işaretleyin — atalet tensörü sıfır kabul edilir, kütle CG’de toplanır; grubun '
      + 'ataleti gövdelerin CG yayılımından (paralel eksen) yine doğar.',
    'Aksi hâlde <strong>Atalet tensörü</strong> matrisinin üst üçgenine köşegen (I<sub>xx</sub>, '
      + 'I<sub>yy</sub>, I<sub>zz</sub>) ve çarpım (I<sub>xy</sub>, I<sub>xz</sub>, '
      + 'I<sub>yz</sub>) terimlerini kg·m² cinsinden girin; alt üçgen simetriden kendiliğinden dolar.',
    'Sekme adının altındaki durum satırını okuyun: boş bir alan çözücüde 0 demektir ve '
      + 'sekme bunu <strong>eksik</strong> diye söyler.'
  ]);
  h += _gmAlanTablo('Kütle gövdesi penceresi — alanlar', [
    ['Kütle [kg]', 'Parçanın kütlesi', 'CAD ölçümü ya da parça künyesi'],
    ['Ağırlık merkezi [mm]', 'x / y / z — <strong>modelin ortak çerçevesinde</strong>',
      'CAD ölçümü (CATIA <em>Measure Inertia</em> gibi)'],
    ['Nokta kütle', 'Atalet ihmal edilsin mi',
      'Şaft, PTO parçası gibi ince/hafif gövdeler için uygun'],
    ['Atalet köşegen [kg·m²]', 'I<sub>xx</sub> · I<sub>yy</sub> · I<sub>zz</sub>',
      'CAD ölçümü — <strong>parçanın KENDİ CG’sinde</strong>'],
    ['Atalet çarpım [kg·m²]', 'I<sub>xy</sub> · I<sub>xz</sub> · I<sub>yz</sub>',
      'Simetrik gövdelerde çoğu sıfırdır'],
    ['Asal momentler · eşdeğer kutu', 'Tensörden türetilir (salt okunur)',
      'Tensör fiziksel değilse (ör. I<sub>yy</sub> + I<sub>zz</sub> &lt; I<sub>xx</sub>) sekme uyarır']
  ]);
  h += _gmUyari('Atalet PARÇANIN KENDİ CG’sinde girilir',
      'Program gövdeleri birleştirirken <strong>paralel-eksen teoremini</strong> kendisi '
    + 'uygular: her parçanın ataleti, parçanın CG’sinden ortak CG’ye taşınır. Ataleti zaten '
    + 'ortak CG’ye taşınmış olarak girerseniz taşıma <strong>iki kez</strong> yapılır ve '
    + 'atalet şişer. Belirtisi yalnız modal analizde görünür: dönme modları beklenenden '
    + '<strong>düşük</strong> çıkar. Sehim sonuçları etkilenmez — bu yüzden hata sessizdir.');
  h += _gmNot('Birimler: kg · mm · kg·m² · N/mm',
      'Pencere bu birimlerde çalışır ve çekirdeğe geçerken SI’ya çevirir. Atalet '
    + '<strong>kg·m²</strong>’dir (kg·mm² değil): 10⁶ kat fark eder ve karıştırıldığında '
    + 'dönme modları anlamsız yerlere gider.');
  return h;
}

function _gmSec5(){
  var h = _gmH2(4);
  h += '<p>Bazı kütle gövdeleri, kütlelerine ek olarak <strong>tork</strong> üretir ya da '
    + 'iletir. Bu bilgiler pencerenin üçüncü sekmesindedir; sekme gövdenin tipine göre değişir. '
    + 'Motor kataloğundan bir motor seçmek tepe torku, maks. gücü ve rölantiyi doldurur; '
    + '<strong>kütle, CG ve atalet doldurulmaz</strong> — kataloğun ataleti krank milinin döner '
    + 'ataletidir, gövdenin tensörü değil.</p>';
  h += _gmAlanTablo('Tipe özel sekmeler', [
    ['Motor · Motor ve tork', 'Katalog, motor noktaları (tepe tork, maks. güç, rölanti, '
      + 'silindir sayısı), tork zinciri, ateşleme frekansı', 'Motor künyesi'],
    ['Şanzıman · Vitesler', 'Vites başına oran ve mil torku, stall oranı', 'Şanzıman künyesi ve konvertör'],
    ['Transfer Kutusu · Tahrik', 'Transfer oranı, aks payı φ', 'Transfer künyesi'],
    ['PTO grubu · PTO grubu', 'Giriş yolu ve ASR-SR-116 referansı',
      'Toplu ya da parça parça — <strong>ikisi birden değil</strong>']
  ], ['Gövde · sekme', 'Ne taşır', 'Nereden']);
  h += '<p>Motorun <strong>Tork zinciri</strong> föyü, mil torkunu oluşturan her çarpanın '
    + 'hangi gövdeden okunduğunu yazar. Aynı alan iki gövdede birden doluysa çözücü ilkini '
    + 'okur ve sekme bunu <strong>çakışma</strong> diye söyler.</p>';
  h += '<p>Tork bilgisi <strong>vites tork durumlarını</strong> üretir: program her vites '
    + 'için tepki torkunu hesaplar ve ayrı bir yük durumu olarak çözer (bölüm 8).</p>';
  h += _gmUyari('PTO kütlesi İKİ KEZ sayılabilir',
      'PTO grubunun kütlesini iki yoldan verebilirsiniz: tek bir <strong>PTO grubu</strong> '
    + 'gövdesiyle toplu olarak, ya da ayrı <strong>PTO</strong> ve <strong>Pompa</strong> '
    + 'gövdeleriyle parça parça. Toplu girişte grubun kütlesi, CG’si ve atalet tensörü tek '
    + 'kalemdir; ayrıntılı girişte parça başına kütle ve CG girilir ve grubun ataleti parçaların '
    + 'yayılımından doğar. <strong>İkisini birden</strong> tanımlarsanız aynı kütle iki '
    + 'kez sayılır ve çözücü “makul ama yanlış” bir toplam üretir. Tutarlılık uyarıları bunu '
    + 'yakalar ve adıyla söyler — ama yalnız bakarsanız.');
  return h;
}

function _gmSec6(){
  var h = _gmH2(5);
  h += '<p>Takoz, güç grubunu şasiye bağlayan üç eksenli bir yaydır. Her takoz kendi '
    + 'konumunu ve üç eksende iki ayrı rijitliğini taşır. Penceresinin iki sekmesi var: '
    + '<strong>Tip ve rijitlik</strong> (künye, rijitlik, kuvvet–sehim yasası, kapasite) ve '
    + '<strong>Konum</strong> (konum ve birleşik ağırlık merkezine farkı); sağ sütunda takozu '
    + 'vurgulayan <strong>Güç grubundaki yeri</strong> krokisi.</p>';
  h += _gmAdimlar([
    'Takoza çift tıklayın.',
    '<strong>Takoz tipi</strong> listesinden hazır bir künye seçin — konum HARİÇ bütün '
      + 'alanlar dolar (bölüm 7). Altındaki durum satırı değerlerin kaçının künyeyle aynı kaldığını söyler.',
    '<strong>Konum</strong> föyüne takozun x / y / z koordinatını yazın (mm, modelin '
      + 'ortak çerçevesinde).',
    'Künye kütüphanede yoksa <strong>Rijitlik</strong> föyüne üç eksenin statik ve dinamik '
      + 'değerlerini girin (N/mm); her satırın dinamik/statik oranı yanında türetilir.',
    'Elinizde varsa <strong>Kapasite</strong> bölümüne takozun azami eksenel yükünü '
      + 'yazın — raporun uygunluğunda kullanım yüzdesi olarak görünür.'
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
  h += _gmUyari('Statik ve dinamik rijitlik AYNI DEĞİLDİR',
      'Elastomer bir takoz, hızlı yüklemede yavaş yüklemeden <strong>daha rijittir</strong> — '
    + 'tipik oran 1,4–1,8. Program ikisini ayrı ayrı kullanır: <strong>sehim</strong> statik '
    + 'rijitlikle, <strong>doğal frekanslar</strong> dinamik rijitlikle hesaplanır. İkisine '
    + 'aynı değeri yazarsanız model yine çözülür — ama ya sehim fazla küçük çıkar ya '
    + 'frekanslar fazla düşük. <strong>Hata verilmez.</strong> Pencere oranın eksenler '
    + 'arasında 1,5 kattan fazla yayıldığını işaretler: eksenlerin takaslı girildiğinin izidir.');
  h += _gmNot('Üç takoz alt sınırdır, dört üst sınır DEĞİLDİR',
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
    + 'gömülü künyeler ve sizin eklediğiniz özel takozlar. Bir tip seçip takoza '
    + 'uyguladığınızda rijitlikler ve kapasite dolar; <strong>konum dolmaz</strong> — o '
    + 'motorun verisidir, parçanın değil.</p>';
  h += _gmAlanTablo('Takoz Özellikleri penceresi', [
    ['Tip', 'Takoz tipi seçici, seçili tipin adı ve türü (gömülü · özel · değiştirilmiş), '
      + 'taşıma kapasitesi', 'Öteki iki sekme seçili tipin adını bölüm başlığında taşır'],
    ['Rijitlik', 'Üç eksenin statik ve dinamik rijitliği, dinamik/statik oranı',
      'Sekme <strong>rijitlik eksik</strong> der: boş ya da ≤ 0 değer var, çözücü bu tipi '
      + 'taşıyan takozu reddeder. <strong>oran?</strong> der: oran eksenler arasında 1,5 '
      + 'kattan fazla yayılıyor, eksenler takaslı girilmiş olabilir'],
    ['Kuvvet–sehim', 'Seçilen eksenin grafiği (X · Y · Z) ve üç eksenin yasası',
      'Gömülü takoz lineerdir; z-eğrisinin noktaları yalnız özel takozda girilir'],
    ['Kullanım (yan sütun)', 'Bu tipi taşıyan takozlar',
      'Tipinden sapan takozu <strong>n değer farklı</strong> diye gösterir (aşağıdaki not)']
  ], ['Sekme', 'Ne taşır', 'Ne söyler']);
  h += _gmNot('Künye KOPYA olarak gider',
      'Takoz Özellikleri’nden uygulanan değerler takoz düğümüne <strong>kopyalanır</strong>. '
    + 'Katalog sürümü bir gün güncellenip bir değer düzeltilse bile kaydedilmiş projeniz '
    + '<strong>kendiliğinden değişmez</strong>; yalnız hangi künyeden geldiğinin izi kalır. '
    + 'Tipi sonradan değiştirirseniz takoz da eski değerinde kalır; pencerenin '
    + '<strong>Kullanım</strong> bölümü onu gösterir. Taşıma kapasitesi de kopyalanır; tipte '
    + 'tanımsızsa takozdaki eski değer silinir. Gömülü bir takozda yaptığınız değişiklik bu '
    + 'Takoz Özellikleri düğümüne yazılır, fabrika değeri bozulmaz — <strong>Fabrika</strong> '
    + 'düğmesi geri döndürür. Bir katalog güncellemesinin kaydedilmiş '
    + 'bir analizi sessizce değiştirmesi, bu programın en çok kaçındığı hata sınıfıdır.');
  h += '<h3>7.2 Nonlineer z-eğrisi</h3>';
  h += '<p>Elastomer takozlar büyük sehimde <strong>sertleşir</strong>: kuvvet–sehim ilişkisi '
    + 'doğru değil, yukarı bükülen bir eğridir. Takoza bir '
    + '<strong>kuvvet–sehim eğrisi</strong> girerseniz çözücü otomatik olarak nonlineer '
    + 'yola (Newton iterasyonu) geçer.</p>';
  h += _gmAlanTablo('Doğrusal ↔ nonlineer', [
    ['Hiçbir takozda eğri yok', 'Doğrusal çözüm — tek adımda',
      'Küçük sehimlerde (statik ağırlık) doğru ve hızlı'],
    ['En az bir takozda eğri var', 'Newton iterasyonu — bütün model nonlineer çözülür',
      'Büyük sehim (3,5 g düşey gibi) için gerekli'],
    ['Metal-metal durdurucu', 'Her zaman açık: her takozda düşeyde ±15 mm boşluk',
      'Takozun mekanik sınırına dayanmasını modeller; boşluk ayarlanmaz, yanal durdurucu yok']
  ], ['Durum', 'Çözüm yolu', 'Ne zaman']);
  h += _gmUyari('Doğrusal model büyük sehimde İYİMSERDİR',
      'Eğri girilmemişse program takozu <strong>her sehimde aynı rijitlikte</strong> sayar. '
    + 'Gerçek takoz sertleştiği için doğrusal model büyük ivmelerde sehimi '
    + '<strong>fazla</strong>, takoz kuvvetini <strong>az</strong> gösterir. Sonuçlarda '
    + '“doğrusal aralık aşıldı” sayacı bunu bildirir — sıfırdan büyükse eğri girmeyi '
    + 'düşünün.');
  h += _gmNot('Eğrinin noktaları',
      'z-eğrisi özel bir takoz tipinde, <strong>Takoz Özellikleri → Kuvvet–sehim</strong> '
    + 'sekmesinde tanımlanır ve tip bir takoza uygulanınca onunla birlikte kopyalanır. '
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
  h += '<p><strong>Çözücü</strong> bileşenine çift tıklayın. Pencerenin iki sekmesi var; sağ '
    + 'sütundaki ön denetim ve <strong>Hesapla</strong> düğmesi her sekmede durur. Pencere '
    + 'sonucu göstermez — sonuç raporda (bölüm 12).</p>';
  h += _gmAlanTablo('Çözücü penceresi — sekmeler', [
    ['Yük durumları', 'Yük kitabı: çözülecek durumlar, ivme (n) ve tork (T)',
      'Modelin girdisinden; tork durumları tork girildiyse'],
    ['Ayarlar', 'Çözüm modu, sönüm oranı ζ, şok darbesi', 'Bir sonraki Hesapla’da uygulanır']
  ], ['Sekme', 'Ne', 'Not']);
  h += _gmAdimlar([
    '<strong>Ayarlar</strong> sekmesinde çözüm modunu seçin; sönüm oranı ve şok darbesi '
      + 'varsayılan değerleriyle durur (yanındaki <em>i</em> kaynağını söyler).',
    'Sönüm oranı yalnız şok ve izolasyon hesabına girer, sehime girmez.',
    '<strong>Hesapla</strong> düğmesine basın — ilerleme düğmenin içinde akar.',
    'Hesapla’nın altındaki satır toplam kütleyi, gövde ve takoz sayısını ve son hesabın '
      + 'güncel olup olmadığını söyler; sonucu <strong>Rapor</strong> bileşeninden okuyun.'
  ]);
  h += _gmUyari('Çekme, durdurucu ve yakınsamama raporda bir hükümdür',
      'Raporun yük durumu tabloları <strong>çekme</strong> (bir takoz çekiye giriyor), '
    + '<strong>durdurucu teması</strong> ve <strong>doğrusal aralık aşımı</strong> işaretlerini, '
    + '<strong>yakınsamama</strong> ve <strong>f ≈ 0 modu</strong> uyarılarını taşır. Bunlar '
    + 'hata değildir — modelin size söylediği şeylerdir.');
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
  h += '<h3>11.2 Duyarlılık — hangi takoz hangi modu oynatıyor</h3>';
  h += '<p>Program her takozun her ekseni için <strong>esnekliği</strong> verir: o rijitlik %1 '
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
  return h;
}

function _gmSec12(){
  var h = _gmH2(11);
  h += '<p><strong>Rapor</strong> bileşeni çevrimdışı, tek dosyalık bir HTML rapor üretir: '
    + 'teori bölümleri, modelin künyesi, bütün yük durumları, takoz kuvvetleri, modal sonuçlar '
    + 've uygunluk hükmü.</p>';
  h += _gmAdimlar([
    'Önce modeli <strong>çözün</strong> — rapor bir sonuç belgesidir ve çözümsüz üretilmez.',
    'Rapor bileşenine çift tıklayın: <strong>İçerik</strong> sekmesi raporun hangi çözümden '
      + 'üretileceğini, <strong>Girdiler</strong> sekmesi §8.8’in girdilerinin (rölanti devri, '
      + 'silindir sayısı, ζ) nereden geldiğini gösterir; çözümün güncel olup olmadığı sağ '
      + 'sütunda, düğmenin üstündedir. Uygunluk hükmü raporun kendisinde.',
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
      + '<strong>▶ Örneği aktar</strong> deyin.',
    'Tutarlılık uyarılarının boş olduğunu doğrulayın.',
    'Çözücüde <strong>Hesapla</strong>’ya basın; bir kütle gövdesinin penceresinde toplam '
      + 'kütleyi ve birleşik CG farkını yukarıdaki 14.2 tablosuyla karşılaştırın.',
    'Ayrıntı için <strong>Rapor</strong> bileşeninden çevrimdışı HTML raporu üretin.'
  ]);
  h += _gmOnay('Kılavuz ile program aynı sayıyı verir',
      'Yukarıdaki değerler bu belge üretilirken programın <strong>kendi çekirdeğiyle</strong> '
    + 'hesaplandı; kılavuza elle yazılmış tek bir sonuç yoktur. Hesap tamamen bellekte '
    + 'yapıldığı için açık olan projenize dokunulmadı.');
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
    + 'Pencere girdileri taşır; sonuç ayrı bir rapordadır (<em>takoz_katalogdan_secim.html</em>).</p>';
  h += _gmAlanTablo('Parametrik Analiz penceresi', [
    ['<strong>Gruplar</strong>', 'Sağ/sol çiftler ve tek takozlar, x konumu, mevcut tip',
      '“Tara” işareti kalkan grup modeldeki takoz verisiyle kalır'],
    ['<strong>Adaylar</strong>', 'Kütüphanenin bütün tipleri: gömülü, değiştirilmiş, özel',
      'İşareti kalkan tip hiçbir gruba takılmaz'],
    ['<strong>Kısıtlar</strong>', 'Kesin kriterler (1 · 1a · 1b · 2), ek kısıtlar ve sınırları, amaç ağırlığı',
      'Kesin kriterler kapatılamaz'],
    ['<strong>Katalogdan seçim</strong>', 'Grup · tip · kombinasyon sayısı',
      'Kombinasyon = tip sayısı ^ taranan grup sayısı; üst sınır ' + _gmF(K.MAKS_KOMB, 0)]
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
    '<strong>Gruplar</strong> ve <strong>Adaylar</strong> sekmelerinde taranacaklar işaretlenir; '
      + 'sağ sütundaki kombinasyon sayısı tarama süresinin ölçüsüdür (kombinasyon başına yaklaşık 0,5 ms).',
    '<strong>Tara ve raporu indir</strong>: birinci aşama bütün kombinasyonlarda statik denge ve modal analiz, '
      + 'ikinci aşama yalnız birinci aşamayı sağlayanlarda işletme yükleri. Düğme tarama sürerken '
      + '<strong>Durdur</strong>dur.',
    'Rapor iner: kapsam, yöntem, kısıtlar, eleme, sonuç (uzlaşı çözümü ve mevcut tasarım yan yana, '
      + 'Pareto şekli), sıralama, varsayımlar ve kaynaklar.'
  ]);
  return h;
}

function _gmEkA(){
  var h = _gmH2(15);
  h += '<p>Bir alanı nerede bulacağınızı hatırlamak için. Sekme ve bölüm adları programdaki '
    + 'başlıklarla birebir aynıdır.</p>';
  h += _gmTablo('Alan → pencere eşlemesi',
    ['Aradığınız', 'Pencere', 'Sekme → bölüm'],
    [
      ['Kütle ve ağırlık merkezi', 'Kütle gövdesi', 'Kütle ve CG → Kütle · Ağırlık merkezi'],
      ['Atalet tensörü', 'Kütle gövdesi', 'Atalet → Atalet tensörü'],
      ['Nokta kütle anahtarı', 'Kütle gövdesi', 'Atalet → Atalet tensörü'],
      ['Güç grubundaki yeri (kroki)', 'Kütle gövdesi · Takoz', 'Sağ sütun'],
      ['Motor torku', 'Motor', 'Motor ve tork → Motor noktaları'],
      ['Vites oranları', 'Şanzıman', 'Vitesler → Vites oranları'],
      ['Transfer oranı', 'Transfer Kutusu', 'Tahrik → Oran ve aks payı'],
      ['PTO giriş yolu', 'PTO grubu', 'PTO grubu → Giriş yolu'],
      ['Takoz konumu', 'Takoz', 'Konum → Konum'],
      ['Statik rijitlik', 'Takoz', 'Tip ve rijitlik → Rijitlik'],
      ['Dinamik rijitlik', 'Takoz', 'Tip ve rijitlik → Rijitlik'],
      ['Taşıma kapasitesi', 'Takoz', 'Tip ve rijitlik → Kapasite'],
      ['Kuvvet–sehim eğrisi', 'Takoz', 'Tip ve rijitlik → Kuvvet–sehim yasası'],
      ['Takoz tipleri (künyeler)', 'Takoz Özellikleri', 'Tip · Rijitlik · Kuvvet–sehim'],
      ['Çözüm modu', 'Çözücü', 'Ayarlar → Yöntem'],
      ['Sönüm oranı', 'Çözücü', 'Ayarlar → Yöntem'],
      ['Şok darbesi', 'Çözücü', 'Ayarlar → Şok darbesi'],
      ['Örnek modeller', 'Başlangıç ve Örnekler', 'Örnek · Başlangıç'],
      ['Raporun frekans girdileri (rölanti, silindir, ζ)', 'Motor · Çözücü', 'Rapor → Girdiler kaynağını gösterir'],
      ['Takoz grupları, taranan grup', 'Parametrik Analiz', 'Gruplar → Gruplar'],
      ['Aday takoz tipleri', 'Parametrik Analiz', 'Adaylar → Adaylar'],
      ['Ek kısıtların sınırı, sürünme, tolerans, amaç ağırlığı', 'Parametrik Analiz', 'Kısıtlar → Ek kısıtlar · Değerlendirme · Amaç']
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
