// ═══════════════════════════════════════════════════════════════════════════
// ARAÇ PERFORMANS KULLANIM KILAVUZU — rapor kozmetiğinde, yönlendirici
// ═══════════════════════════════════════════════════════════════════════════
//
// Kabuk ve kozmetik js/guide-kit.js'ten gelir (gömülü rapor şablonundan
// çıkarılıyor) — bu dosyada tek satır CSS yok. FEAD kılavuzuyla aynı kalıp,
// aynı iki kural:
//
//   1 · ÇÖZÜLMÜŞ MODEL GEREKTİRMEZ. Kılavuz bir ÖĞRETİ belgesidir: tuval
//       bomboşken — kullanıcının ona en çok ihtiyaç duyduğu anda — okunabilir.
//
//   2 · ÖRNEĞİN SAYILARI ELLE YAZILMAZ. §14, kayıt defterindeki TURAN
//       örneğini BELLEKTE koşturur (veGetPowertrainChain →
//       veFTRunSimulationEngine) ve çıkan sayıları basar.
//
// FEAD'DEN TEK YAPISAL FARKI: bu modülün çözücüsü açık düğüm listesi
// KABUL ETMİYOR — `veFTRunSimulationEngine` global `nodes`'u okuyor. Bu yüzden
// §14 global'leri geçici olarak takas ediyor ve `finally` ile geri veriyor
// (`_gaKoslu`). Takas edilmeseydi ya sayı elle yazılırdı (bayatlar) ya da
// kullanıcının açık modeli koşturulurdu (kılavuz herkeste başka çıkardı).
//
// Ad öneki `_ga…` / `veGuideArac…` (source-hygiene: `_gf` FEAD kılavuzunun,
// `_gk` kabuğun, `_ap` örnek kayıt defterinin).

// Sayı biçimi RAPORDAN — ikinci bir kopya iki belgenin aynı sayıyı farklı
// basması demekti (FEAD kılavuzunun kuralının aynısı).
function _gaF(v, d){ return (typeof _frF === 'function') ? _frF(v, d) : String(v); }
function _gaFs(v, d){ return (typeof _frFs === 'function') ? _frFs(v, d) : String(v); }
function _gaE(s){ return (typeof _gkEsc === 'function') ? _gkEsc(s) : String(s); }

var _gaTblNo = 0;
function _gaTbl(){ return ++_gaTblNo; }

function _gaAdimlar(satirlar){
  return '<ol>' + satirlar.map(function(s){ return '<li>' + s + '</li>'; }).join('') + '</ol>';
}

// Alan tablosu — HER SÜTUN `td.l`. Raporun `td` varsayılanı bir SAYIDIR
// (mono, sağa dayalı, nowrap); cümle taşıyan hücrede yatay taşma üretir.
function _gaAlanTablo(baslik, satirlar, basliklar){
  var b = basliklar || ['Alan', 'Ne yazılır', 'Nereden bulunur'];
  var h = '<table><caption>Tablo ' + _gaTbl() + ' — ' + _gaE(baslik) + '</caption>';
  h += '<tr>' + b.map(function(t){ return '<th>' + _gaE(t) + '</th>'; }).join('') + '</tr>';
  satirlar.forEach(function(r){
    h += '<tr>' + r.map(function(c){ return '<td class="l">' + c + '</td>'; }).join('') + '</tr>';
  });
  return h + '</table>';
}

// Sayısal tablo — hücreler HAM verilir, hizalama çağırandan.
function _gaTablo(baslik, basliklar, satirlar, hizalar){
  var h = '<table><caption>Tablo ' + _gaTbl() + ' — ' + _gaE(baslik) + '</caption>';
  h += '<tr>' + basliklar.map(function(t){ return '<th>' + _gaE(t) + '</th>'; }).join('') + '</tr>';
  satirlar.forEach(function(r){
    h += '<tr>' + r.map(function(c, i){
      var cls = (hizalar && hizalar[i]) ? ' class="' + hizalar[i] + '"' : '';
      return '<td' + cls + '>' + c + '</td>';
    }).join('') + '</tr>';
  });
  return h + '</table>';
}

function _gaNot(baslik, govde){ return veGuideNote('', baslik, govde); }
function _gaUyari(baslik, govde){ return veGuideNote('warn', baslik, govde); }
function _gaOnay(baslik, govde){ return veGuideNote('check', baslik, govde); }

// ── BÖLÜM KİMLİKLERİ — içindekiler ve başlıklar TEK KAYNAKTAN ──────────────
var VE_GUIDE_ARAC_SECTIONS = [
  ['a1',  '1',    'Bu Kılavuz Nasıl Kullanılır'],
  ['a2',  '2',    'Modülün Haritası'],
  ['a3',  '3',    'Modüle Girmek'],
  ['a4',  '4',    'Motoru Tanımlamak'],
  ['a5',  '5',    'Tork Konvertörünü Tanımlamak'],
  ['a6',  '6',    'Şanzıman ve Vites Geçiş Takvimi'],
  ['a7',  '7',    'Aktarma Organları'],
  ['a8',  '8',    'Aracı ve Tekerleği Tanımlamak'],
  ['a9',  '9',    'Yol, Senaryo ve Çevre'],
  ['a10', '10',   'Modeli Çözmek'],
  ['a11', '11',   'Sonuçları Okumak'],
  ['a12', '12',   'Rapor Üretmek'],
  ['a13', '13',   'Sık Yapılan Hatalar'],
  ['a14', '14',   'Sayısal Örnek: TURAN 4×4'],
  ['aEk', 'Ek A', 'Alan → Panel Hızlı Başvurusu']
];

function _gaH2(i){
  var s = VE_GUIDE_ARAC_SECTIONS[i];
  return veGuideH2(s[0], s[1], s[2]);
}

// ═══════════════════════════════════════════════════════════════════════════
//  BÖLÜMLER
// ═══════════════════════════════════════════════════════════════════════════

function _gaSec1(){
  var h = _gaH2(0);
  h += '<p>Bu belge, MFSim’in <strong>Araç Performans</strong> modülünü kullanarak bir aracın '
    + 'güç aktarma organlarını modelleme ve tam gaz hızlanma performansını hesaplama işini '
    + '<strong>adım adım</strong> anlatır. Bölümler programda izleyeceğiniz sırayla '
    + 'dizilmiştir: baştan sona okuyup uygularsanız çalışan bir modeliniz olur.</p>';
  h += '<p>Her bölüm aynı düzendedir: önce <em>ne yapacağınız</em> numaralı adımlarla, sonra '
    + '<em>hangi alana ne yazacağınız</em> bir tabloyla, en sonda da o adımda sessizce yanlış '
    + 'gidebilecek şeyler bir uyarı kutusuyla verilir. Uyarı kutularını atlamayın: bu modülde '
    + 'de yanlış girilen bir alan çoğu zaman <strong>hata vermez</strong> — simülasyon yine '
    + 'koşar, eğriler yine çizilir, yalnızca sayılar başkadır.</p>';
  h += '<p><strong>Bölüm 14</strong> bütün kılavuzu tek bir araç üzerinde tekrarlar ve çıkan '
    + 'sayıları o aracın kendi <em>Allison iSCAAN</em> raporuyla karşılaştırır. Aceleniz varsa '
    + 'önce oraya bakın, sonra ilgili bölüme dönün.</p>';
  h += _gaNot('Bu belgedeki sayılar ölçülmüştür',
      'Bölüm 14’teki bütün değerler, belge üretilirken programın <strong>gerçek simülasyon '
    + 'motoru</strong> koşturularak hesaplanır — kılavuza elle yazılmış tek bir sonuç yoktur. '
    + 'Çözücü bir gün değişirse bu belgedeki sayılar da onunla değişir; kılavuz yapısal olarak '
    + 'bayatlayamaz. Örnek <strong>bellekte</strong> koşturulur ve açık olan projenize '
    + 'dokunulmaz: kılavuz kanvas değişkenlerini geçici olarak takas eder ve işi bitince '
    + 'olduğu gibi geri verir.');
  h += '<h3>1.1 Kim için</h3>';
  h += '<p>Araç performansı hesaplayan, güç aktarma organı seçimi yapan, tedarikçiden '
    + '(Allison, ZF, Cummins…) dönen bir performans raporunu doğrulamak ya da bir aracın '
    + 'yeniden yapılandırılmasında hızlanma/tırmanma sonucunu önceden görmek isteyen makine '
    + 'mühendisi için yazıldı.</p>';
  h += '<h3>1.2 Bu modül neyi hesaplar</h3>';
  h += _gaAlanTablo('Kapsam', [
    ['<strong>Tam gaz hızlanma</strong>', 'Duruştan azami hıza kadar hız–zaman–mesafe; vites '
      + 'geçişleri ve konvertör kilitlenmesi dahil', 'Bölüm 10 ve 11'],
    ['<strong>Azami hız</strong>', 'Düz yolda ve eğimde denge hızı', 'Bölüm 11'],
    ['<strong>Tırmanma kabiliyeti</strong>', 'Verilen hızda çıkılabilen azami eğim',
      'Bölüm 11'],
    ['<strong>Stall noktası</strong>', 'Duran araçta konvertör denge devri', 'Bölüm 5'],
    ['<strong>Eşleştirme analizi</strong>', 'Motor–konvertör ve motor–şanzıman uyumu',
      'Bölüm 5 ve 6'],
    ['<strong>Engel atlama</strong>', 'Basamak/rampa geçişi', 'Bölüm 9']
  ], ['Ne', 'Neyi verir', 'Nerede']);
  h += _gaUyari('Bu modülde OLMAYANLAR',
      'Modül tam gaz (wide-open-throttle) bir <strong>boyuna dinamik</strong> modelidir. '
    + 'Yanal dinamik, süspansiyon, viraj, fren sistemi ve yakıt tüketimi <strong>yoktur</strong>. '
    + 'Motor freni (retarder) ayrı bir çalışma kipidir. Sürüş çevrimi (WLTP, NEDC) tüketim '
    + 'hesabı da bu modülün kapsamı dışındadır.');
  return h;
}

function _gaSec2(){
  var h = _gaH2(1);
  h += '<p>Ana tuvalde <strong>Araç Performans</strong> kartına çift tıklayınca modülün kendi '
    + 'iç topolojisi açılır. Oradaki bağlantıların anlamı <strong>güç akışıdır</strong>: tel, '
    + 'torkun hangi bileşenden hangisine gittiğini söyler.</p>';
  h += '<h3>2.1 Zincir ve dallar</h3>';
  h += '<p>Omurga tek sıradır ve sırası fizikseldir:</p>';
  h += '<p style="text-align:center; font-weight:600;">Motor → Tork Konvertörü → Şanzıman → '
    + 'Propşaft → Transfer Kutusu → Diferansiyel → Tekerlek</p>';
  h += '<p>Transferden sonra zincir <strong>dallanır</strong>: her aks için bir diferansiyel, '
    + 'her diferansiyel için iki tekerlek. 4×4’te iki dal, 6×6’da üç dal olur. Araç, Yol, '
    + 'Senaryo ve Çözücü bileşenleri zincirin <em>içinde</em> değildir — zincire bağlanmazlar, '
    + 'tuvalde ayrı dururlar ve çözücü onları tipinden bulur.</p>';
  h += _gaNot('Aksesuarlar Motor’a asılır',
      'Klima Kompresörü, Alternatör ve Hava Kompresörü zincire girmez; <strong>Motor’un ön '
    + 'portuna</strong> bağlanır. Çektikleri güç motorun brüt torkundan düşülür ve net tork '
    + 'öyle oluşur. Bir aksesuarı zincire ara halka olarak sokmaya çalışmayın — porta '
    + 'bağlanır.');
  h += '<h3>2.2 Neyi siz verirsiniz, neyi program hesaplar</h3>';
  h += _gaAlanTablo('Girdi / türeyen ayrımı', [
    ['Motor', 'devir–brüt tork tablosu · governed devir · aksesuar kayıpları',
      '<strong>net tork eğrisi</strong> · azami güç ve devri'],
    ['Tork konvertörü', 'K-faktörü ve tork oranı tabloları (SR’ye karşı)',
      '<strong>stall devri</strong> · her hızda pompa/türbin denge noktası'],
    ['Şanzıman', 'vites oranları · vites başına verim · geçiş takvimi profili',
      '<strong>geçiş hızları</strong> · kilitlenme noktası'],
    ['Aktarma', 'aks oranı · transfer kademeleri · propşaft verimi',
      'tekerlekteki tork ve devir'],
    ['Araç ve tekerlek', 'kütle · frontal alan · C<sub>d</sub> · yarıçap · C<sub>rr</sub> · δ',
      '<strong>eşdeğer kütle</strong> · direnç kuvvetleri'],
    ['Yol ve senaryo', 'eğim · başlangıç hızı · gaz oranı',
      '<strong>hız–zaman–mesafe</strong> · azami hız · tırmanma']
  ], ['Konu', 'Siz verirsiniz', 'Program hesaplar']);
  h += _gaUyari('Hız oranını ELLE YAZMAYIN',
      'Aksesuar devri, tekerlek devri ve türbin devri hep <strong>oranlardan</strong> '
    + 'hesaplanır. Bir yerde elle yazılmış bir hız oranı, çaplardan/oranlardan hesaplanana '
    + 'ters düşerse sonuç sessizce kayar — bu depoda ölçülmüş bir sınıf: bir veri setinde '
    + 'elle yazılmış oran gerçeğinden <strong>%2,7</strong> saparak bütün gerilme zincirini '
    + 'kaydırıyordu.');
  return h;
}

function _gaSec3(){
  var h = _gaH2(2);
  h += '<p>Modüle üç yoldan girilir. Hangisini seçeceğiniz elinizde ne olduğuna bağlıdır.</p>';
  h += '<h3>3.1 Yol A — hazır bir örnekten başlamak (önerilen)</h3>';
  h += _gaAdimlar([
    'Karşılama ekranından <strong>Araç Performans</strong> kartını seçin; ana tuvale tek bir '
      + 'alt-sistem kutusu düşer.',
    'Kutuya <strong>çift tıklayın</strong> — iç topoloji açılır. İlk açılışta içeride yalnız '
      + '<strong>Başlangıç ve Örnekler</strong> kutusu vardır.',
    'O kutuya çift tıklayın. Açılan panelde kayıtlı araçları görürsünüz; birini seçin.',
    '<strong>▶ Örneği Aktar</strong> düğmesine basın. Bütün zincir — motor eğrisi, konvertör '
      + 'tabloları, vites oranları, aks, transfer, lastik, araç künyesi — bir anda kurulur.'
  ]);
  var liste = (typeof veApExampleList === 'function') ? veApExampleList() : [];
  if(liste.length){
    var satir = liste.map(function(e){
      return [_gaE(e.name), _gaE(e.vehicle || '—'), _gaE(e.subtitle || '—')];
    });
    h += _gaTablo('Kayıtlı örnek araçlar', ['Örnek', 'Araç', 'Yapılandırma'], satir,
      ['l', 'l', 'l']);
    h += _gaNot('Örneklerin tamamı gerçek rapordan',
        'Kayıt defterindeki <strong>' + liste.length + '</strong> araç, gerçek '
      + '<em>Allison iSCAAN</em> performans raporlarından çıkarıldı: motor eğrisi, K-faktörü, '
      + 'vites oranları ve verimleri, aks, transfer, lastik ve C<sub>rr</sub> ya rapordan '
      + 'ölçüldü ya da ondan türetildi. Yani örnekler yalnız “çalışan bir model” değil, '
      + '<strong>doğrulanmış</strong> bir modeldir — kendi aracınızı kurarken alanların hangi '
      + 'mertebede olması gerektiğini oradan okuyabilirsiniz.');
  }
  h += _gaUyari('Örnek aktarmak mevcut zinciri DEĞİŞTİRİR',
      'İç topolojide güç aktarma bileşeni varsa program önce sorar. Onaylarsanız zincir '
    + 'örneğinkiyle <strong>değiştirilir</strong>. Üzerine eklemek diye bir seçenek yoktur — '
    + 'iki motorlu, iki şanzımanlı bir topoloji çözücüyü belirsiz bırakırdı.');
  h += '<h3>3.2 Yol B — sıfırdan elle kurmak</h3>';
  h += _gaAdimlar([
    'Sol paletten bileşenleri sırayla tuvale sürükleyin: <strong>Motor</strong>, '
      + '<strong>Tork Konvertörü</strong>, <strong>Şanzıman</strong>, <strong>Propşaft</strong>, '
      + '<strong>Transfer Kutusu</strong>, <strong>Diferansiyel</strong>, '
      + '<strong>Tekerlek</strong>.',
    'Bir bileşenin <strong>çıkış portundan</strong> bir sonrakinin <strong>giriş portuna</strong> '
      + 'tel çekin. Geçersiz bir çift seçerseniz program sebebini yazar.',
    'Zincirin dışına <strong>Araç</strong>, <strong>Yol</strong>, <strong>Senaryo</strong> ve '
      + '<strong>Çözücü</strong> bileşenlerini bırakın — bunlar bağlanmaz.',
    'Aksesuar kullanacaksanız <strong>Klima / Alternatör / Hava Kompresörü</strong> '
      + 'bileşenlerini Motor’un <em>ön</em> portuna bağlayın.',
    'Araç birden çok akslıysa transferin her çıkışına bir <strong>Diferansiyel</strong>, her '
      + 'diferansiyele iki <strong>Tekerlek</strong> bağlayın.'
  ]);
  h += _gaNot('“Otomatik Düzenle” zinciri hizalar',
      'Araçta güç akışı soldan sağa akan bir zincirdir ve dallar simetrik iner/çıkar. '
    + 'Şerit düğmesindeki <strong>Otomatik Düzenle</strong>, bileşenleri programın kendi '
    + 'referans ızgarasına oturtur: zincirin dört bağlantısı tam yatay çizilir, dallar eşit '
    + 've zıt sapar. Yerleşim <strong>hesabı etkilemez</strong> — yalnız okunurluk içindir.');
  h += '<h3>3.3 Yol C — kayıtlı bir projeden</h3>';
  h += '<p>Daha önce kaydedilmiş bir proje dosyasını (<code>.json</code>) şerit üzerinden '
    + 'açabilirsiniz. <strong>Başlangıç ve Örnekler</strong> panelindeki '
    + '<strong>↓ İç Topolojiyi JSON Dışa Aktar</strong> düğmesi de bunun tersini yapar: '
    + 'kurduğunuz zinciri örnek biçiminde diske yazar.</p>';
  return h;
}

function _gaSec4(){
  var h = _gaH2(3);
  h += '<p>Motor, zincirin ve modelin en çok girdi isteyen bileşenidir. Motora çift tıklayın; '
    + 'panel üç sütun açar: solda girdi rayı, ortada veri ızgarası, sağda doğrulama.</p>';
  h += _gaAdimlar([
    'En üstteki <strong>Motor Seçimi</strong> şeridinden hazır bir motor seçin. Liste '
      + 'aile bazlı gruplanmıştır (Cummins ISB / ISG / ISL, Duramax…). Seçim, devir–tork '
      + 'tablosunu ve künyeyi bir anda doldurur.',
    'Motorunuz listede yoksa <strong>Tork &amp; Güç Verileri</strong> ızgarasına devir ve '
      + '<strong>brüt</strong> tork çiftlerini elle girin. Satırlar devre göre artan sırada '
      + 'olmalıdır.',
    '<strong>Motor Parametreleri</strong> kartına governed (regüle) devri yazın — motorun '
      + 'yük altında aşamadığı üst sınır.',
    '<strong>Aksesuar Kayıpları</strong> tablosunu doldurun. Her satır bir aksesuarın '
      + 'çektiği gücü söyler; net tork bunlar düşülerek üretilir.',
    'Sağdaki <strong>Doğrulama</strong> sütununda net eğriyi ve azami güç noktasını okuyun.'
  ]);
  h += _gaAlanTablo('Motor paneli — alanlar', [
    ['Devir [rpm] / Tork [N·m]', 'Devir–<strong>brüt</strong> tork çiftleri',
      'Motor üreticisinin performans eğrisi (fan hariç, aksesuarsız)'],
    ['Governed devir', 'Regüle devri, rpm', 'Motor künyesi; hızlanmanın üst sınırını belirler'],
    ['Aksesuar kayıpları', 'Fan · alternatör · hava kompresörü · direksiyon pompası · klima · '
      + 'ek tahrik, her biri kW', 'Araç üreticisinin aksesuar listesi ya da tedarikçi raporu'],
    ['Eğri yaklaşımı', 'Doğrusal ara değerleme ya da polinom uydurma',
      'Az sayıda noktada doğrusal daha güvenli; polinom uçlarda salınabilir'],
    ['Verim [%]', 'Motor çıkışına uygulanan genel çarpan',
      'Genellikle 100 bırakılır — kayıplar aksesuar tablosunda modellenir']
  ]);
  h += _gaUyari('Brüt mü net mi — en pahalı karışıklık',
      'Tabloya <strong>brüt</strong> tork girilir; program net torku aksesuar modelinden '
    + 'kendisi üretir. Net eğriyi brüt alanına yazarsanız aksesuar kaybı '
    + '<strong>iki kez</strong> düşülür ve bütün performans düşük çıkar. Hata vermez: eğri '
    + 'yine çizilir, araç yine hızlanır, yalnız daha yavaş. Tedarikçi raporundan okuyorsanız '
    + 'sütun başlığına bakın — çoğu rapor ikisini de basar.');
  h += _gaNot('Fan kaybı devirle değişir',
      'Kavramalı fan gücü devrin <strong>küpüyle</strong> ölçeklenir (N³), sabit bir kW '
    + 'değil. Program bunu modelliyor; tabloya girdiğiniz değer referans devirdeki güçtür. '
    + 'Tedarikçi raporları performansı çoğu zaman <em>fan açık</em> ve <em>fan kapalı</em> '
    + 'olarak iki kez basar — karşılaştırırken hangisine baktığınıza dikkat edin.');
  return h;
}

function _gaSec5(){
  var h = _gaH2(4);
  h += '<p>Tork konvertörü, motor ile şanzıman arasındaki hidrolik bağlantıdır ve duruştan '
    + 'kalkışı o mümkün kılar. Konvertöre çift tıklayın.</p>';
  h += _gaAdimlar([
    '<strong>Konvertör Seçimi</strong> listesinden konvertörünüzü seçin (TC411, TC413, '
      + 'TC551…). Seçim K-faktörü ve tork oranı tablolarını doldurur.',
    'Listede yoksa <strong>Konvertör Veri Tablosu</strong>na hız oranına (SR) karşı '
      + 'K-faktörü ve tork oranı (τ) çiftlerini girin.',
    'Panelin okumasında <strong>stall</strong> noktasını kontrol edin: SR = 0’daki tork oranı '
      + 've K-faktörü, duran araçtaki denge devrini belirler.'
  ]);
  h += _gaAlanTablo('Konvertör paneli — alanlar', [
    ['SR (Speed Ratio)', 'Türbin devri / pompa devri, 0…1 arası',
      'Konvertör üreticisinin karakteristik eğrisi'],
    ['K-faktörü', 'Pompa kapasite faktörü, N<sub>pompa</sub>/√T<sub>pompa</sub>',
      'Aynı eğri. SR = 0 satırı stall K’sıdır'],
    ['τ (tork oranı)', 'Türbin torku / pompa torku', 'Aynı eğri. Stall’da en yüksektir'],
    ['Pompa tork düşümü', 'Şanzıman pompasının çektiği tork, N·m',
      'Tedarikçi raporundan türetilir; sıfır bırakılabilir']
  ]);
  h += _gaNot('Stall bir GİRDİ değil, bir SONUÇTUR',
      'Duran araçta motor torku ile pompa torku dengeye gelir; program bu dengeyi kendisi '
    + 'çözer. Stall devrini bir alana yazamazsınız — motor eğrisi, K-faktörü ve pompa tork '
    + 'düşümü birlikte onu belirler. Tedarikçi raporunun stall satırı bu yüzden '
    + '<strong>doğrulama</strong> için birebir kullanılabilir: tutuyorsa üç girdinin üçü de '
    + 'doğru okunmuş demektir.');
  h += _gaUyari('Çok köklü denge',
      'Bazı motor–konvertör çiftlerinde denge denkleminin birden çok kökü olur. Program en '
    + 'düşük <strong>kararlı</strong> kökü alır — rölantiden tam gaza basıldığında motorun '
    + 'fiilen ulaşabildiği devir odur. Bazı tedarikçi raporları kararsız kökü basar; böyle '
    + 'bir durumda iki sayı ayrışır ve fark modelin hatası değildir. Kayıtlı örneklerden '
    + 'birinde bu ölçüldü ve rapor o konvertörü zaten “uygun değil” diye işaretliyor.');
  return h;
}

function _gaSec6(){
  var h = _gaH2(5);
  h += '<p>Şanzıman iki ayrı şey taşır: <strong>oranlar</strong> (kaç vites, hangi oran, hangi '
    + 'verim) ve <strong>geçiş takvimi</strong> (hangi noktada vites değişir). İkisi ayrı '
    + 'panellerdedir ve ayrı ayrı yanlış olabilir.</p>';
  h += '<h3>6.1 Şanzıman Verileri</h3>';
  h += _gaAdimlar([
    'Şanzımana çift tıklayın; <strong>Şanzıman Verileri</strong> tablosunu açın.',
    'Hazır listeden şanzımanınızı seçin (Allison 3000 SP, 4000 SP, 4500 SP…) ya da oranları '
      + 'elle girin.',
    'Her vites için <strong>oran</strong> ve <strong>verim</strong> sütunlarını doldurun. '
      + 'Verim vites başına farklı olabilir — doğrudan tahrikli vitesin verimi daha yüksektir.',
    'Geri vites oranını da girin; hızlanma simülasyonu onu kullanmaz ama topoloji raporunda '
      + 'görünür.'
  ]);
  h += '<h3>6.2 Vites Geçiş Takvimi</h3>';
  h += '<p><strong>Vites Geçiş Kontrolcüsü</strong> (shift-controller) bileşeni zincire '
    + 'bağlanmaz; tuvalde ayrı durur ve çözücü onu tipinden bulur. Panelinde '
    + '<strong>Shift Schedule</strong> tablosu vardır.</p>';
  h += _gaAlanTablo('Geçiş takvimi — alanlar', [
    ['Profil', 'Şanzıman ailesine göre hazır geçiş profili',
      'Allison kontrol nesli; örneklerde rapordan doğrulandı'],
    ['Yukarı vites eşiği', 'Geçişin tetiklendiği çıkış devri ya da referans devir oranı',
      'Profil tabloları; elle değiştirilebilir'],
    ['Kilitlenme (lockup) noktası', 'Konvertörün kilitlendiği hız oranı',
      'Konvertör moddan (2C) kilitli moda (2L) geçiş']
  ]);
  h += _gaNot('Vites adları iki harflidir ve ikinci harf MODU söyler',
      'Sonuçlarda göreceğiniz <code>1C · 2C · 2L · 3L …</code> gösteriminde rakam vitesi, harf '
    + 'konvertör modunu verir: <strong>C</strong> = converter (hidrolik, kayma var), '
    + '<strong>L</strong> = lockup (kilitli, kayma yok). Tipik bir kalkış '
    + '<code>1C → 2C → 2L → 3L …</code> diye ilerler; yani ikinci viteste önce hidrolik '
    + 'kalınır, sonra kilitlenilir.');
  h += _gaUyari('Vites avlanması sessiz bir kusurdur',
      'Yukarı ve aşağı vites eşikleri birbirine fazla yakınsa araç iki vites arasında gidip '
    + 'gelir. Simülasyon bunu <strong>hata olarak bildirmez</strong> — yalnız hızlanma süresi '
    + 'uzar ve geçiş sayısı beklenmedik biçimde artar. Bu depoda ölçülmüş bir vaka var: bir '
    + 'şanzıman profilinde tek bir eşik hatası <strong>321 geçiş / 105 aşağı vites</strong> '
    + 'üretiyordu. Sonuçlardaki geçiş sayısına bakmayı alışkanlık edinin.');
  return h;
}

function _gaSec7(){
  var h = _gaH2(6);
  h += '<p>Şanzımandan tekerleğe kadar olan halkalar. Üçü de oran ve verim taşır; hepsi '
    + 'çarpımsal olarak toplam tahrik oranını kurar.</p>';
  h += '<h3>7.1 Propşaft</h3>';
  h += '<p>Kendi oranı yoktur (1:1); yalnız <strong>verim</strong> ve atalet taşır. Zincirde '
    + 'birden çok propşaft olabilir — her biri kendi verimini uygular.</p>';
  h += '<h3>7.2 Transfer Kutusu</h3>';
  h += _gaAdimlar([
    'Transfer kutusuna çift tıklayın; <strong>Kademe Tablosu</strong>nu açın.',
    'Her kademe için bir satır girin: <strong>ad</strong>, <strong>oran</strong> ve '
      + '<strong>verim</strong>. İki kademeli bir arazi transferinde tipik olarak bir hızlı '
      + '(yüksek) ve bir yavaş (düşük) kademe olur.',
    'Simülasyon her kademeyi <strong>ayrı ayrı</strong> koşturur; sonuçlarda kademe başına '
      + 'ayrı bir eğri görürsünüz.'
  ]);
  h += _gaNot('Kademe ROLÜ orandan çözülür',
      'Hangi kademenin “hızlı”, hangisinin “yavaş” olduğu <strong>dizideki sırasından değil '
    + 'oranından</strong> belirlenir. Tabloda satırların yerini değiştirmek sonucu '
    + 'değiştirmez — bu bilinçlidir ve testi vardır.');
  h += '<h3>7.3 Diferansiyel ve Tekerlek</h3>';
  h += _gaAlanTablo('Diferansiyel ve tekerlek — alanlar', [
    ['Aks oranı', 'Diferansiyel dişli oranı', 'Aks künyesi'],
    ['Verim', 'Aks verimi, %', 'Tipik 0,95–0,98'],
    ['Tekerlek yarıçapı [m]', '<strong>Yüklü (dinamik) yarıçap</strong>',
      'Lastik künyesi; statik yarıçap DEĞİL'],
    ['C<sub>rr</sub>', 'Yuvarlanma direnci katsayısı',
      'Lastik ve zemin; asfaltta 0,003–0,008 bandında'],
    ['Döner kütle faktörü δ', 'Dönen kütlelerin eşdeğer kütleye katkısı',
      'Tipik 1,03–1,15; hızlanmayı doğrudan etkiler'],
    ['Tekerlek sayısı', 'O diferansiyele bağlı tekerlek adedi', 'Yerleşim']
  ]);
  h += _gaUyari('MASTER tekerlek ve MASTER diferansiyel',
      'Çok akslı bir araçta birden çok diferansiyel ve tekerlek vardır, ama çözücü hız–devir '
    + 'çevrimini <strong>bir</strong> tanesinden yapar. O bileşen panelde '
    + '<strong>★ MASTER</strong> ile işaretlidir; diğerleri <strong>SLAVE</strong> görünür. '
    + 'Yanlış tekerleğe master demek — örneğin farklı yarıçaplı bir aksı seçmek — bütün hız '
    + 'ekseni kaydırır ve <strong>hata vermez</strong>.');
  return h;
}

function _gaSec8(){
  var h = _gaH2(7);
  h += '<p><strong>Araç</strong> bileşeni zincire bağlanmaz; tuvalde ayrı durur ve aracın '
    + 'bütününe ait büyüklükleri taşır.</p>';
  h += _gaAlanTablo('Araç paneli — alanlar', [
    ['Araç ağırlığı [kg]', 'Simülasyonda kullanılacak <strong>toplam</strong> kütle',
      'Yüklü mü boş mu — hangi durumu hesaplıyorsanız o'],
    ['Frontal alan [m²]', 'İzdüşüm alanı', 'Araç künyesi ya da genişlik × yükseklik × 0,85'],
    ['Sürüklenme katsayısı C<sub>d</sub>', 'Aerodinamik direnç katsayısı',
      'Kamyonlarda 0,6–0,9; binek araçta 0,25–0,35'],
    ['Hava yoğunluğu [kg/m³]', 'Ortam yoğunluğu', 'Deniz seviyesi 15 °C için 1,225'],
    ['Aktarma organları toplam verimi [%]', 'Zincirin bileşen bazlı verimlerine ek genel çarpan',
      'Bileşenlerde verim girdiyseniz 100 bırakın — yoksa iki kez uygulanır']
  ]);
  h += _gaUyari('Kütle iki kere sayılmasın',
      'Döner kütle faktörü δ, dönen parçaların eylemsizliğini <strong>eşdeğer kütleye</strong> '
    + 'çevirir. Ayrıca bileşenlere atalet girdiyseniz katkı iki kez sayılabilir. Kural: '
    + 'ataletleri bileşenlere girin ve δ’yı 1’e yakın tutun, ya da ataletleri boş bırakıp '
    + 'δ ile modelleyin — ikisini birden şişirmeyin.');
  return h;
}

function _gaSec9(){
  var h = _gaH2(8);
  h += '<h3>9.1 Yol</h3>';
  h += '<p><strong>Yol</strong> bileşeni eğimi taşır ve iki kipte çalışır:</p>';
  h += _gaAlanTablo('Yol paneli — eğim kipleri', [
    ['Manuel (kullanıcı girişli)', 'Tek bir sabit eğim yüzdesi',
      'Tırmanma ve azami hız analizlerinin çoğu bu kiple yapılır'],
    ['Segment bazlı (harita tabanlı)', 'Mesafeye göre değişen eğim segmentleri',
      'Gerçek bir güzergâhı koşturmak için; segment tablosu ve harita panelde']
  ], ['Kip', 'Ne yapar', 'Ne zaman']);
  h += _gaNot('Eğim işareti',
      'Pozitif eğim <strong>yokuş yukarı</strong> demektir ve aracı yavaşlatır. Harita '
    + 'tarafındaki yükseklik farkı ile fizik tarafındaki işaret konvansiyonu ayrı ayrı '
    + 'tanımlıdır ve çeviri tek yerde yapılır; testi vardır.');
  h += '<h3>9.2 Senaryo</h3>';
  h += _gaAlanTablo('Senaryo paneli — alanlar', [
    ['Senaryo tipi', 'Hangi analiz koşulacak', 'Hızlanma · tırmanma · engel atlama…'],
    ['Başlangıç hızı [km/h]', 'Simülasyonun başladığı hız', 'Duruştan kalkışta 0'],
    ['Gaz pedal oranı [%]', 'Tam gazda 100', 'Kısmi gaz senaryoları için düşürülür']
  ]);
  h += '<h3>9.3 Yuvarlanma direnci ölçümü (Coast-down)</h3>';
  h += '<p><strong>Coast-Down</strong> bileşeni, sahada yapılmış bir serbest yavaşlama '
    + 'ölçümünden C<sub>d</sub>·A ve C<sub>rr</sub> çiftini geri çözer. Elinizde ölçüm varsa '
    + 'bu, tahmin edilen aerodinamik katsayıdan çok daha güvenilirdir.</p>';
  return h;
}

function _gaSec10(){
  var h = _gaH2(9);
  h += '<p><strong>Çözücü</strong> bileşeni zincire bağlanmaz; sayısal yöntemi ve çözüm '
    + 'kümesini taşır. Çift tıklayın.</p>';
  h += _gaAdimlar([
    '<strong>Güç Aktarma Zinciri</strong> okumasına bakın: program zinciri bulabildi mi, '
      + 'hangi bileşenleri gördü? Eksik bir halka burada görünür.',
    '<strong>Çözüm Kümesi</strong> kartından hangi analizlerin koşacağını seçin '
      + '(performans · hızlanma-yavaşlama · tırmanma · engel atlama · enerji dengesi).',
    '<strong>Sayısal Yöntemler</strong> kartında çözüm yöntemini ve adım büyüklüğünü seçin. '
      + 'Varsayılan <strong>RK45 Dormand-Prince</strong> (adaptif) çoğu iş için doğru '
      + 'seçimdir.',
    'Şeritteki <strong>Doğrula</strong> ile modeli sınayın, sonra <strong>Çalıştır</strong> '
      + 'ile simülasyonu başlatın.'
  ]);
  h += _gaAlanTablo('Çözücü paneli — alanlar', [
    ['Çözüm yöntemi', 'Euler · Heun · Ralston · RK4 · RK45',
      'RK45 adaptiftir ve hem hızlı hem doğrudur; Euler yalnız karşılaştırma için'],
    ['Adım büyüklüğü Δt [s]', 'Sabit adımlı yöntemlerde adım',
      'RK45’te başlangıç adımı; adaptif olarak değişir'],
    ['Tolerans (ATol / RTol)', 'Adaptif adım kontrolünün hata bütçesi',
      'Varsayılan 0,01 çoğu iş için yeterli; 0,001 çok hassas ve yavaş'],
    ['Tork interpolasyonu', 'Motor eğrisinin ara değerleme yöntemi',
      'PCHIP spline aşırı salınım yapmaz; doğrusal en güvenlisi'],
    ['Güvenlik limiti [s]', 'Simülasyonun kesileceği azami süre',
      'Sonsuz döngüye karşı; azami hıza ulaşılamıyorsa artırın']
  ]);
  h += _gaUyari('Zincir bulunamıyorsa sebebi Çözücü panelinde yazar',
      'Simülasyon “güç aktarma zinciri bulunamadı” diyorsa bir halka bağlı değildir ya da bir '
    + 'tel ters yönde çekilmiştir. Çözücü panelinin zincir okuması hangi bileşenleri '
    + 'görebildiğini sırayla yazar — eksik olan orada belli olur. Motor, Araç ve Tekerlek '
    + 'bileşenleri <strong>zorunludur</strong>; biri yoksa çözücü açık hata verir.');
  return h;
}

function _gaSec11(){
  var h = _gaH2(10);
  h += '<p>Sonuçların <strong>üç okuma yüzeyi</strong> vardır ve hangisine bakacağınız ne '
    + 'aradığınıza bağlıdır.</p>';
  h += _gaAlanTablo('Sonuç yüzeyleri', [
    ['<strong>Sonuçlar penceresi</strong>', 'Hız–zaman, mesafe, devir, tork, vites ve mod '
      + 'kanalları; çok şeritli eğri görünümü',
      'Bir büyüklüğün zaman içindeki gidişini görmek'],
    ['<strong>Veri Gezgini</strong>', 'Kanal ağacı; arama, istatistik, mini eğri',
      'Hangi kanalların üretildiğini görmek ve şeride eklemek'],
    ['<strong>TXT / HTML raporlar</strong>', 'Tam gaz raporu, detay matematik izi, '
      + 'hızlanma-yavaşlama, engel atlama, topoloji detayı',
      'Sayıyı belgelemek, paylaşmak, elle doğrulamak']
  ], ['Yüzey', 'Ne gösterir', 'Ne zaman']);
  h += '<h3>11.1 Hangi sayı nerede</h3>';
  h += _gaAlanTablo('Kritik sonuçlar', [
    ['Azami hız', 'Düz yolda denge hızı, km/h', 'Tam gaz raporu özeti; kademe başına ayrı'],
    ['0–X km/h süreleri', 'Hızlanma çıpaları, s', 'Tam gaz raporunun hızlanma tablosu'],
    ['Stall devri', 'Duran araçta konvertör denge devri, rpm', 'Detay matematik izi'],
    ['Vites geçiş hızları', 'Her geçişin gerçekleştiği hız, km/h',
      'Tam gaz raporunun geçiş satırları; Sonuçlar penceresindeki vites kanalı'],
    ['Tırmanma kabiliyeti', 'Verilen hızda azami eğim, %', 'Tırmanma analizi çıktısı'],
    ['Enerji dengesi', 'Üretilen iş ↔ harcanan iş kapanıyor mu',
      'Çözücüde “Enerji dengesi” seçiliyse rapora girer']
  ], ['Büyüklük', 'Ne', 'Nerede okunur']);
  h += _gaNot('Kademe başına ayrı sonuç',
      'Transfer kutusu iki kademeliyse simülasyon <strong>iki kez</strong> koşar ve iki ayrı '
    + 'sonuç kümesi üretir. Azami hız ve hızlanma süreleri kademeye göre çok farklıdır — '
    + 'karşılaştırırken hangi kademeye baktığınızı doğrulayın. Rapor kademeyi satır başında '
    + 'yazar.');
  h += _gaUyari('Geçiş sayısı bir sağlık göstergesidir',
      'Normal bir tam gaz kalkışında geçiş sayısı vites sayısı kadardır (altı vitesli bir '
    + 'şanzımanda beş–altı geçiş). Onlarca geçiş görüyorsanız takvim avlanıyordur; '
    + 'bölüm 6’ya dönün.');
  return h;
}

function _gaSec12(){
  var h = _gaH2(11);
  h += '<p>Şeritteki <strong>Rapor</strong> düğmesi rapor penceresini açar. Simülasyon '
    + 'koşmadan rapor üretilemez — rapor bir <em>sonuç</em> belgesidir.</p>';
  h += _gaAlanTablo('Rapor türleri', [
    ['Tam Gaz Hızlanma Raporu', 'Özet, hızlanma tablosu, vites geçişleri, azami hız',
      'Ana performans belgesi'],
    ['Detay Matematik Hesapları', 'Adım adım ara değerler, iterasyonlar, denge çözümleri',
      'Bir sayının nereden geldiğini elle takip etmek için'],
    ['Hızlanma-Yavaşlama Raporu', 'İvme ve yavaşlama profilleri', 'Ayrı senaryo'],
    ['Engel Atlama Raporu', 'Basamak/rampa geçişi sonuçları', 'Ayrı senaryo'],
    ['Topoloji Detay Raporu', 'Kurulan zincirin bütün girdileri',
      'Modelin ne ile koştuğunu belgelemek — <strong>gözden geçirmenin en hızlı yolu</strong>'],
    ['CSV', 'Ham kanal verisi', 'Excel’de kendi analizinizi yapmak için']
  ], ['Rapor', 'İçerik', 'Ne zaman']);
  h += _gaNot('Rapor A4 sayfa olarak açılır',
      'TXT raporları ekranda gerçek A4 sayfa biçiminde gösterilir ve punto sayfaya sığmaktan '
    + '<strong>türetilir</strong> — geniş bir tablo otomatik olarak küçülür, dar bir rapor '
    + 'okunur puntoda kalır. İndirilen HTML aynı sayfayı açar ve yazdırıldığında gerçekten '
    + 'A4’e basar.');
  h += _gaUyari('Rapor çözümün fotoğrafıdır',
      'Rapor üretildikten sonra bir alanı değiştirirseniz o değişiklik rapora '
    + '<strong>sızmaz</strong>. Değişikliği yansıtmak için yeniden çözün ve raporu yeniden '
    + 'üretin.');
  return h;
}

function _gaSec13(){
  var h = _gaH2(12);
  h += '<p>Bu modülde de en pahalı hata sınıfı çöken model değil, <strong>“makul ama yanlış” '
    + 'sayıdır</strong>: simülasyon koşar, eğriler çizilir, hiçbir uyarı çıkmaz.</p>';
  h += _gaTablo('Sessiz hata sınıfları',
    ['Alan', 'Yanlış verilirse ne olur', 'Belirtisi'],
    [
      ['Brüt ↔ net tork', 'Aksesuar kaybı iki kez düşülür',
        'Bütün performans düşük; azami hız ve hızlanma birlikte kayar'],
      ['Tekerlek yarıçapı', 'Hız ekseninin tamamı ölçeklenir',
        'Vites geçiş hızları ve azami hız aynı oranda kayar, biçim korunur'],
      ['MASTER tekerlek / diferansiyel', 'Hız–devir çevrimi yanlış aksdan yapılır',
        'Yalnız çok akslı araçlarda; oranlar farklıysa hız kayar'],
      ['Vites geçiş eşikleri', 'Araç iki vites arasında avlanır',
        '<strong>Geçiş sayısı beklenenin katlarına çıkar</strong>'],
      ['Aktarma verimi iki kez', 'Bileşen verimleri + araç genel verimi birlikte uygulanır',
        'Çekiş kuvveti sistematik düşük'],
      ['Döner kütle δ + ataletler', 'Eşdeğer kütle şişer', 'Hızlanma yavaş, azami hız normal'],
      ['Eğim işareti', 'Yokuş aşağı yukarı sanılır', 'Azami hız beklenmedik biçimde yüksek'],
      ['Transfer kademesi', 'Yanlış kademenin sonucu okunur',
        'Azami hız iki kat farklı — rapor satır başında kademeyi yazar']
    ], ['l', 'l', 'l']);
  h += _gaOnay('En hızlı gözden geçirme: Topoloji Detay Raporu',
      'Yukarıdaki sınıfların çoğu, kurulan zincirin bütün girdilerini tek sayfada gördüğünüzde '
    + 'gözle yakalanır. Şüphelendiğinizde önce o raporu üretin; alan alan panel gezmekten '
    + 'hızlıdır.');
  return h;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §14 — CANLI ÖRNEK
// ═══════════════════════════════════════════════════════════════════════════
//
// TURAN, kayıt defterindeki ilk örnek ve programın kalibrasyon referansı.
// iSCAAN 497-A321222-1 raporundan birebir kuruldu.
//
// AŞAĞIDAKİ SAYILAR RAPORUN KENDİ BASILI DEĞERLERİDİR — dış çıpa, elle
// yazılması DOĞRU olan tek küme (FEAD kılavuzundaki VE_GUIDE_FEAD_GATES ile
// aynı gerekçe: bunlar bizim hesabımız değil, karşılaştırdığımız belge).
var VE_GUIDE_ARAC_ISCAAN = {
  rapor: '497-A321222-1',
  stall: 2204,                          // Converter Mode / Gear F1 / SR = 0
  vmax: { 1.257: 116.2, 2.337: 62.8 },  // Vehicle Performance Summary, fan On
  hizlanma: { 1.257: [1.61, 5.45, 11.66, 21.03], 2.337: [1.63, 5.44, 11.58, null] },
  gecis: { 2.337: [['1C', '2C', 8.7, 9.7], ['2C', '2L', 14.6, 16.1], ['2L', '3L', 21.2, 22.5],
                   ['3L', '4L', 28.1, 29.0], ['4L', '5L', 39.5, 40.2], ['5L', '6L', 52.7, 53.1]] }
};

// Örneğin topolojisini gömülü tablodan çöz. `_apResolveTopology` geri çağrılı
// ve fetch'e düşebiliyor; kılavuz SENKRON üretiliyor, o yüzden yalnız GÖMÜLÜ
// tablo okunur. Tablo yoksa bölüm sayı basmaz ve sebebini yazar — uydurmaz.
function _gaOrnekTopoloji(){
  if(typeof veApExampleList !== 'function') return null;
  var liste = veApExampleList();
  var ex = null;
  for(var i = 0; i < liste.length; i++) if(liste[i].id === 'turan') ex = liste[i];
  if(!ex || !ex.topology) return null;
  var tbl = (typeof window !== 'undefined') ? window.__MNT_TOPOLOGIES : null;
  var j = tbl ? tbl[ex.topology] : null;
  if(!j || !j.nodes || !j.nodes.length) return null;
  return { ex: ex, nodes: j.nodes, connections: j.connections || [] };
}

// ÇÖZÜCÜ GLOBAL OKUYOR — bu yüzden takas edilip GERİ VERİLİYOR.
// `veFTRunSimulationEngine` açık liste kabul etmiyor (`veGetPowertrainChain`
// global `nodes`u tarıyor). Takas edilmeseydi ya sayı elle yazılırdı ya da
// kullanıcının açık modeli koşturulurdu. `veTrResetView` de geçici olarak
// susturuluyor: sessiz bir hesap kullanıcının eğri görünümünü sıfırlamamalı.
function _gaKoslu(pack, kademe){
  if(typeof veFTRunSimulationEngine !== 'function') return null;
  var g = (typeof window !== 'undefined') ? window : null;
  if(!g) return null;
  var eskiN = g.nodes, eskiC = g.connections, eskiReset = g.veTrResetView;
  try {
    g.nodes = pack.nodes;
    g.connections = pack.connections;
    g.veTrResetView = function(){};
    return veFTRunSimulationEngine(kademe);
  } catch(e){
    return null;
  } finally {
    g.nodes = eskiN;
    g.connections = eskiC;
    g.veTrResetView = eskiReset;
  }
}

// Hız–zaman dizisinde verilen hıza ulaşma anı (doğrusal ara değerleme).
function _gaZamanAt(R, v){
  if(!R || !R.speed || !R.time) return null;
  for(var i = 1; i < R.speed.length; i++){
    if(R.speed[i - 1] <= v && R.speed[i] >= v){
      var q = (R.speed[i] > R.speed[i - 1])
        ? (v - R.speed[i - 1]) / (R.speed[i] - R.speed[i - 1]) : 0;
      return R.time[i - 1] + q * (R.time[i] - R.time[i - 1]);
    }
  }
  return null;
}

function _gaSapma(mf, ref){
  if(!Number.isFinite(mf) || !Number.isFinite(ref) || ref === 0) return '—';
  var p = (mf - ref) / ref * 100;
  return (p >= 0 ? '+' : '') + _gaFs(p, 2) + '%';
}

function _gaSec14(){
  var h = _gaH2(13);
  var pack = _gaOrnekTopoloji();
  if(!pack){
    h += '<p>Bu bölüm, kayıt defterindeki <strong>TURAN</strong> örneğini belge üretilirken '
      + 'koşturup sayılarını basar. Örnek topolojisi bu kurulumda bulunamadı, bu yüzden '
      + 'sayılar üretilemedi — <em>uydurulmuş bir değer basmak yerine bölüm boş '
      + 'bırakılıyor</em>. Örneği programın kendisinden yükleyip bölüm 11’deki yüzeylerden '
      + 'okuyabilirsiniz.</p>';
    return h;
  }

  var ex = pack.ex;
  h += '<p>Bu bölüm bütün kılavuzu tek bir araç üzerinde tekrarlar: '
    + '<strong>' + _gaE(ex.name) + '</strong>. Araç, programın kalibrasyon referansıdır ve '
    + '<em>Allison iSCAAN ' + _gaE(VE_GUIDE_ARAC_ISCAAN.rapor) + '</em> raporundan birebir '
    + 'kuruldu. Aşağıdaki bütün MFSim sayıları, bu belge üretilirken gerçek simülasyon motoru '
    + 'koşturularak hesaplanmıştır.</p>';

  // ── 14.1 Girdiler ────────────────────────────────────────────────────────
  h += '<h3>14.1 Aracın künyesi — ne girildi</h3>';
  var specs = (ex.specs || []).map(function(r){ return [_gaE(r[0]), _gaE(r[1])]; });
  if(specs.length) h += _gaTablo('TURAN — girilen künye', ['Konu', 'Değer'], specs, ['l', 'l']);

  var tipSay = {};
  pack.nodes.forEach(function(n){ tipSay[n.type] = (tipSay[n.type] || 0) + 1; });
  var zincir = ['engine', 'torque-converter', 'gearbox', 'propshaft', 'transfer',
                'differential', 'wheel'];
  var zAd = { engine: 'Motor', 'torque-converter': 'Tork Konvertörü', gearbox: 'Şanzıman',
              propshaft: 'Propşaft', transfer: 'Transfer Kutusu',
              differential: 'Diferansiyel', wheel: 'Tekerlek' };
  var zSat = zincir.map(function(t){
    return [_gaE(zAd[t]), '<code>' + t + '</code>', String(tipSay[t] || 0)];
  });
  h += _gaTablo('Kurulan zincir', ['Bileşen', 'Tip', 'Adet'], zSat, ['l', 'l', 'c']);
  h += _gaNot('Dallanma tekerlek sayısından okunur',
      'Zincir transferden sonra dallanıyor: <strong>' + (tipSay.differential || 0) + '</strong> '
    + 'diferansiyel ve <strong>' + (tipSay.wheel || 0) + '</strong> tekerlek düğümü var. '
    + 'Hız–devir çevrimi bunlardan yalnız <strong>MASTER</strong> işaretli olanından yapılır '
    + '(bölüm 7.3).');

  // ── 14.2 Koşu ────────────────────────────────────────────────────────────
  var tr = null;
  pack.nodes.forEach(function(n){ if(n.type === 'transfer') tr = n; });
  var kademeler = (tr && tr.data && tr.data.ftTrGears && tr.data.ftTrGears.length)
    ? tr.data.ftTrGears : [{ kademe: 'tek', ratio: 1 }];

  var kosular = kademeler.map(function(g){
    return { g: g, R: _gaKoslu(pack, g.kademe) };
  }).filter(function(k){ return k.R && k.R.speed && k.R.speed.length; });

  if(!kosular.length){
    h += '<p>Simülasyon bu kurulumda koşturulamadı; sayılar üretilmedi.</p>';
    return h;
  }

  h += '<h3>14.2 Program ne hesapladı</h3>';
  h += '<p>Transfer kutusu iki kademeli olduğu için simülasyon <strong>her kademe için ayrı '
    + 'ayrı</strong> koştu. Aşağıdaki tablo her kademenin sonucunu, aynı aracın iSCAAN '
    + 'raporundaki karşılığıyla yan yana veriyor.</p>';

  var G = VE_GUIDE_ARAC_ISCAAN;
  var vSat = kosular.map(function(k){
    var ratio = Number(k.g.ratio);
    var ref = G.vmax[ratio];
    var mf = k.R.solverStats && k.R.solverStats.maxSpeed_kmh;
    return [_gaE(k.g.kademe), _gaFs(ratio, 3),
            Number.isFinite(mf) ? _gaFs(mf, 2) + ' km/h' : '—',
            Number.isFinite(ref) ? _gaFs(ref, 1) + ' km/h' : '—',
            _gaSapma(mf, ref)];
  });
  h += _gaTablo('Azami hız — MFSim ↔ iSCAAN',
    ['Kademe', 'Oran', 'MFSim', 'iSCAAN (fan açık)', 'Fark'], vSat,
    ['l', 'c', 'c', 'c', 'c']);

  // Stall — kademeden BAĞIMSIZ: duran araçta çıkış devri her viteste sıfırdır,
  // dolayısıyla oran denge noktasını fiziksel olarak etkileyemez.
  var st = null;
  kosular.forEach(function(k){
    if(st === null && k.R.settledStall && Number.isFinite(k.R.settledStall.N_engine))
      st = k.R.settledStall.N_engine;
  });
  if(Number.isFinite(st)){
    h += _gaTablo('Stall — duran araçta konvertör denge noktası',
      ['Büyüklük', 'MFSim', 'iSCAAN', 'Fark'],
      [['Motor devri', _gaFs(st, 0) + ' rpm', _gaFs(G.stall, 0) + ' rpm',
        _gaSapma(st, G.stall)]], ['l', 'c', 'c', 'c']);
    h += _gaNot('Stall kademeden bağımsızdır',
        'Duran araçta çıkış devri her viteste sıfırdır, yani vites ya da transfer oranı denge '
      + 'noktasını <strong>fiziksel olarak etkileyemez</strong>. İki kademede de aynı sayı '
      + 'çıkar; tabloda bir kez basılıyor. Bu, bölüm 5’teki “stall bir girdi değil sonuçtur” '
      + 'kuralının sayısal karşılığıdır: motor eğrisi, K-faktörü ve pompa tork düşümü doğru '
      + 'okunmuşsa rapor birebir geri gelir.');
  }

  // ── 14.3 Hızlanma ────────────────────────────────────────────────────────
  h += '<h3>14.3 Hızlanma çıpaları</h3>';
  var hedef = [20, 40, 60, 80];
  var hSat = [];
  kosular.forEach(function(k){
    var ratio = Number(k.g.ratio);
    var ref = G.hizlanma[ratio] || [];
    hedef.forEach(function(v, i){
      var t = _gaZamanAt(k.R, v);
      if(!Number.isFinite(t)) return;
      hSat.push([_gaE(k.g.kademe), '0–' + v + ' km/h',
                 _gaFs(t, 2) + ' s',
                 Number.isFinite(ref[i]) ? _gaFs(ref[i], 2) + ' s' : '—',
                 Number.isFinite(ref[i]) ? _gaFs(t - ref[i], 2) + ' s' : '—']);
    });
  });
  if(hSat.length){
    h += _gaTablo('Hızlanma süreleri — MFSim ↔ iSCAAN',
      ['Kademe', 'Aralık', 'MFSim', 'iSCAAN', 'Fark'], hSat, ['l', 'l', 'c', 'c', 'c']);
    h += _gaNot('Farkı SANİYE olarak okuyun, yüzde olarak değil',
        '0–20 km/h gibi kısa bir aralıkta yüzde küçük bir sayıya bölündüğü için şişer; '
      + 'mutlak fark ise raporun kendi baskı çözünürlüğü (±0,05 s) mertebesindedir. Fark ilk '
      + 'birkaç saniyede doğuyor ve vites geçişlerinde <strong>sıçramıyor</strong> — yani '
      + 'kaynağı tork kesintisinin modellenmemesi değil, konvertör modundaki eşdeğer kütle '
      + 'farkıdır. Ölçüldü ve tek bir atalet terimine yüklenemedi; uydurma katsayı konmadı.');
  }

  // ── 14.4 Vites geçişleri ─────────────────────────────────────────────────
  var yavas = null;
  kosular.forEach(function(k){ if(Math.abs(Number(k.g.ratio) - 2.337) < 1e-6) yavas = k; });
  if(!yavas) yavas = kosular[kosular.length - 1];
  var gec = (yavas.R.solverStats && yavas.R.solverStats.shiftHistory) || [];
  if(gec.length){
    h += '<h3>14.4 Vites geçişleri</h3>';
    var gRef = G.gecis[Number(yavas.g.ratio)] || null;
    var gSat = gec.map(function(s, i){
      var r = gRef && gRef[i];
      return [_gaE((s.fromMode || '?') + ' → ' + (s.toMode || '?')),
              _gaFs(s.v_kmh, 2) + ' km/h',
              Number.isFinite(s.N_engine) ? _gaFs(s.N_engine, 0) + ' rpm' : '—',
              r ? (_gaFs(r[2], 1) + '–' + _gaFs(r[3], 1) + ' km/h') : '—',
              r ? ((s.v_kmh >= r[2] && s.v_kmh <= r[3])
                    ? '<span class="ok">bandın içinde</span>' : 'bandın dışında') : '—'];
    });
    h += _gaTablo('Vites geçişleri — ' + _gaE(yavas.g.kademe),
      ['Geçiş', 'MFSim hızı', 'Motor devri', 'iSCAAN bandı', 'Hüküm'], gSat,
      ['l', 'c', 'c', 'c', 'c']);
    h += _gaNot('Referans bir NOKTA değil bir BANT',
        'iSCAAN hızlanma tablosu sabit bir hız ızgarasında basılıyor, yani geçişin tam olarak '
      + 'hangi hızda olduğunu söylemiyor — yalnız hangi iki satır arasında olduğunu. '
      + 'Karşılaştırma bu yüzden bir bandadır ve bandın genişliği tablonun kendi '
      + 'çözünürlüğüdür (~1,6 km/h).');
  }

  // ── 14.5 Kendiniz koşturmak ──────────────────────────────────────────────
  h += '<h3>14.5 Bu örneği kendiniz koşturmak</h3>';
  h += _gaAdimlar([
    'Araç Performans modülünün iç topolojisinde <strong>Başlangıç ve Örnekler</strong> '
      + 'kutusunu açın.',
    'Listeden <strong>' + _gaE(ex.name) + '</strong> örneğini seçip '
      + '<strong>▶ Örneği Aktar</strong> deyin.',
    'Şeritten <strong>Çalıştır</strong> ile simülasyonu başlatın.',
    'Şeritteki <strong>Rapor</strong> düğmesinden <strong>Tam Gaz Hızlanma Raporu</strong>nu '
      + 'üretin ve yukarıdaki sayılarla karşılaştırın.',
    'Sayının nereden geldiğini görmek için <strong>Detay Matematik Hesapları</strong> '
      + 'raporunu üretin — stall dengesi ve her adımın ara değerleri orada.'
  ]);
  h += _gaOnay('Kılavuz ile program aynı sayıyı verir',
      'Yukarıdaki değerler bu belge üretilirken <strong>programın kendi motoruyla</strong> '
    + 'hesaplandı; kılavuza elle yazılmış tek bir MFSim sayısı yoktur. Kendi koşunuz farklı '
    + 'çıkıyorsa örnek değişmiş ya da bir alanı düzenlemişsiniz demektir — iSCAAN sütunu ise '
    + 'raporun basılı değeridir ve sabittir.');
  return h;
}

function _gaEkA(){
  var h = _gaH2(14);
  h += '<p>Bir alanı nerede bulacağınızı hatırlamak için. Panel adları programdaki '
    + 'başlıklarla birebir aynıdır.</p>';
  h += _gaTablo('Alan → panel eşlemesi',
    ['Aradığınız', 'Panel', 'Kart'],
    [
      ['Hazır motor listesi', 'Motor', 'Motor Seçimi'],
      ['Devir–brüt tork tablosu', 'Motor', 'Tork &amp; Güç Verileri'],
      ['Governed devir', 'Motor', 'Motor Parametreleri'],
      ['Fan, alternatör, klima kayıpları', 'Motor', 'Aksesuar Kayıpları'],
      ['Eğri uydurma yöntemi', 'Motor', 'Eğri Yaklaşımı'],
      ['Net eğri ve azami güç', 'Motor', 'Doğrulama'],
      ['Hazır konvertör listesi', 'Tork Konvertörü', 'Konvertör Seçimi'],
      ['K-faktörü ve tork oranı', 'Tork Konvertörü', 'Konvertör Veri Tablosu'],
      ['Vites oranları ve verimleri', 'Şanzıman', 'Şanzıman Verileri'],
      ['Vites geçiş eşikleri', 'Vites Geçiş Kontrolcüsü', 'Shift Schedule'],
      ['Transfer kademeleri', 'Transfer Kutusu', 'Kademe Tablosu'],
      ['Aks oranı', 'Diferansiyel', 'Diferansiyel'],
      ['Lastik yarıçapı, C<sub>rr</sub>, δ', 'Tekerlek', 'Tekerlek Parametreleri'],
      ['Kütle, alan, C<sub>d</sub>', 'Araç', 'Araç Parametreleri · Aerodinamik Parametreleri'],
      ['Yol eğimi', 'Yol', 'Eğim Parametreleri'],
      ['Başlangıç hızı, gaz oranı', 'Senaryo', 'Başlangıç Koşulları · Senaryo Parametreleri'],
      ['Çözüm yöntemi ve tolerans', 'Çözücü', 'Sayısal Yöntemler'],
      ['Hangi analizler koşacak', 'Çözücü', 'Çözüm Kümesi'],
      ['Zincir bulundu mu', 'Çözücü', 'Güç Aktarma Zinciri'],
      ['Motor–konvertör uyumu', 'Motor-Konvertör Eşleştirme', 'Konvertör Uyumluluk Tablosu'],
      ['Motor–şanzıman uyumu', 'Motor-Şanzıman Eşleştirme', 'Şanzıman Uyumluluk Tablosu'],
      ['Hazır araç örnekleri', 'Başlangıç ve Örnekler', '—'],
      ['Raporlar', '—', 'Şerit → Rapor']
    ], ['l', 'c', 'l']);
  return h;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BELGE MONTAJI
// ═══════════════════════════════════════════════════════════════════════════

function veGuideAracHTML(){
  _gaTblNo = 0;

  var tarih = new Date().toLocaleDateString('tr-TR',
    { year: 'numeric', month: 'long', day: 'numeric' });

  var govde = veGuideAntet({
    eyebrow: 'MFSim · Araç Performans Modülü · Kullanım Kılavuzu',
    h1: 'Araç Performans Modelleme Kılavuzu',
    sub: 'Motordan tekerleğe: adım adım modelleme, girdi haritası, sonuçların '
       + 'okunması ve işlenmiş örnek',
    fields: [
      ['Belge', 'Kullanım kılavuzu'],
      ['Modül', 'Araç Performans'],
      ['Kapsam', VE_GUIDE_ARAC_SECTIONS.length + ' bölüm'],
      ['Örnek', 'canlı koşturulur'],
      ['Tarih', tarih]
    ]
  });

  govde += veGuideToc(VE_GUIDE_ARAC_SECTIONS);
  govde += _gaSec1();
  govde += _gaSec2();
  govde += _gaSec3();
  govde += _gaSec4();
  govde += _gaSec5();
  govde += _gaSec6();
  govde += _gaSec7();
  govde += _gaSec8();
  govde += _gaSec9();
  govde += _gaSec10();
  govde += _gaSec11();
  govde += _gaSec12();
  govde += _gaSec13();
  govde += _gaSec14();
  govde += _gaEkA();

  return veGuideDocHTML({
    title: 'MFSim — Araç Performans Kılavuzu',
    body: govde
  });
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veGuideAracHTML: veGuideAracHTML,
    VE_GUIDE_ARAC_SECTIONS: VE_GUIDE_ARAC_SECTIONS,
    VE_GUIDE_ARAC_ISCAAN: VE_GUIDE_ARAC_ISCAAN,
    _gaOrnekTopoloji: _gaOrnekTopoloji, _gaKoslu: _gaKoslu, _gaZamanAt: _gaZamanAt,
    _gaSapma: _gaSapma, _gaAlanTablo: _gaAlanTablo, _gaTablo: _gaTablo
  };
}
