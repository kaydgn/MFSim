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
  ['a1',  '1',    'Bu kılavuz nasıl kullanılır'],
  ['a2',  '2',    'Modülün haritası'],
  ['a3',  '3',    'Modüle girmek'],
  ['a4',  '4',    'Motoru tanımlamak'],
  ['a5',  '5',    'Tork Konvertörünü tanımlamak'],
  ['a6',  '6',    'Şanzıman ve vites geçiş takvimi'],
  ['a7',  '7',    'Aktarma organları'],
  ['a8',  '8',    'Aracı ve tekerleği tanımlamak'],
  ['a9',  '9',    'Yol, senaryo ve çevre'],
  ['a10', '10',   'Modeli çözmek'],
  ['a11', '11',   'Sonuçları okumak'],
  ['a12', '12',   'Rapor üretmek'],
  ['a13', '13',   'Sık yapılan hatalar'],
  ['a14', '14',   'Sayısal örnek: TURAN 4×4'],
  ['aEk', 'Ek A', 'Alan → pencere hızlı başvurusu']
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
  h += '<p>MFSim’in <strong>Araç Performans</strong> modülüyle bir aracın güç aktarma '
    + 'organlarını <strong>adım adım</strong> modelleme ve tam gaz hızlanma performansını '
    + 'hesaplama kılavuzu. Bölümler modelin kuruluş sırasıyla dizilmiştir.</p>';
  h += '<p>Her bölüm üç parçadır: numaralı adımlar, alan tablosu ve uyarı kutusu. Bu modülde '
    + 'yanlış girilen bir alan çoğu zaman <strong>hata vermez</strong> — simülasyon yine '
    + 'koşar, eğriler yine çizilir, yalnızca sayılar başkadır; uyarı kutuları bu durumları '
    + 'listeler.</p>';
  h += '<p><strong>Bölüm 14</strong> kılavuzun tamamını tek bir araçta uygular ve çıkan '
    + 'sayıları aracın kendi <em>Allison iSCAAN</em> raporuyla karşılaştırır.</p>';
  h += _gaNot('Bölüm 14’ün sayıları',
      'Belge üretilirken simülasyon motoru <strong>bellekte</strong> kurulan örnekle '
    + 'koşturulur; Bölüm 14’teki bütün MFSim değerleri bu koşunun çıktısıdır. Açık proje '
    + 'değişmez.');
  h += '<h3>1.1 Kim için</h3>';
  h += '<p>Araç performansı hesaplayan, güç aktarma organı seçen, tedarikçiden (Allison, ZF, '
    + 'Cummins…) dönen bir performans raporunu doğrulayan ya da yeniden yapılandırılan bir '
    + 'aracın hızlanma ve eğim kabiliyetini önceden hesaplayan makine mühendisi için '
    + 'yazıldı.</p>';
  h += '<h3>1.2 Bu modül neyi hesaplar</h3>';
  h += _gaAlanTablo('Kapsam', [
    ['<strong>Tam gaz hızlanma</strong>', 'Duruştan azami hıza kadar hız–zaman–mesafe; vites '
      + 'geçişleri ve konvertör kilitlenmesi dahil', 'Bölüm 10 ve 11'],
    ['<strong>Azami hız</strong>', 'Düz yolda ve eğimde denge hızı', 'Bölüm 11'],
    ['<strong>Eğim kabiliyeti</strong>', 'Verilen hızda çıkılabilen azami eğim',
      'Bölüm 11'],
    ['<strong>Stall noktası</strong>', 'Duran araçta konvertör denge devri', 'Bölüm 5'],
    ['<strong>Eşleştirme analizi</strong>', 'Motor–konvertör ve motor–şanzıman uyumu',
      'Ek A'],
    ['<strong>Engel atlama</strong>', 'Basamak/rampa geçişi', 'Bölüm 10 ve 12']
  ], ['Ne', 'Neyi verir', 'Nerede']);
  h += _gaUyari('Modülün kapsamı dışında kalanlar',
      'Modül tam gaz (wide-open-throttle) bir <strong>boyuna dinamik</strong> modelidir. '
    + 'Yanal dinamik, süspansiyon, viraj, fren sistemi ve yakıt tüketimi <strong>yoktur</strong>. '
    + 'Motor freni (retarder) ayrı bir çalışma kipidir. Sürüş çevrimi (WLTP, NEDC) tüketim '
    + 'hesabı da kapsam dışıdır.');
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
    + 'her diferansiyel için iki tekerlek. 4×4’te iki dal, 6×6’da üç dal olur. Araç, Yol / '
    + 'Ortam, Senaryolar ve Çözücü bileşenleri zincirin <em>içinde</em> değildir — zincire '
    + 'bağlanmazlar, tuvalde ayrı dururlar ve çözücü onları tipinden bulur.</p>';
  h += _gaNot('Aksesuarlar Motor’a asılır',
      'Klima Kompresörü, Alternatör ve Hava Kompresörü zincire girmez; <strong>Motor’un ön '
    + 'portlarına</strong> bağlanır. Çektikleri güç motorun brüt torkundan düşülür ve net tork '
    + 'öyle oluşur.');
  h += '<h3>2.2 Girdiler ve türeyenler</h3>';
  h += _gaAlanTablo('Girdi / türeyen ayrımı', [
    ['Motor', 'devir–brüt tork tablosu · governed devir · aksesuar kayıpları',
      '<strong>net tork eğrisi</strong> · azami güç ve devri'],
    ['Tork konvertörü', 'K-faktörü ve tork oranı tabloları (SR’ye karşı)',
      '<strong>stall devri</strong> · her hızda pompa/türbin denge noktası'],
    ['Şanzıman', 'vites oranları · vites başına verim · geçiş takvimi profili',
      '<strong>geçiş hızları</strong> · kilitlenme noktası'],
    ['Aktarma', 'aks oranı · transfer kademeleri · propşaft verimi',
      'tekerlekteki tork ve devir'],
    ['Araç ve tekerlek', 'kütle · yükseklik ve genişlik · C<sub>d</sub> · yarıçap · '
      + 'C<sub>rr</sub> · ataletler',
      '<strong>eşdeğer kütle</strong> · direnç kuvvetleri'],
    ['Yol ve senaryo', 'eğim segmentleri · başlangıç hızı · gaz oranı',
      '<strong>hız–zaman–mesafe</strong> · azami hız · eğim kabiliyeti']
  ], ['Konu', 'Girdi', 'Türeyen']);
  h += _gaUyari('Aksesuar tahrik oranı',
      'Aksesuarın çektiği güç kendi eğrisinden <strong>aksesuar devrinde</strong> okunur: '
    + 'aksesuar devri = motor devri × <strong>Tahrik oranı</strong>. Oran aksesuarın '
    + 'penceresinde girilir; yanlış oran kaybı başka bir devirde okutur ve uyarı vermez.');
  return h;
}

function _gaSec3(){
  var h = _gaH2(2);
  h += '<p>Modüle üç yoldan girilir: hazır bir örnekten, boş tuvalden ya da kayıtlı bir '
    + 'projeden.</p>';
  h += '<h3>3.1 Yol A — hazır bir örnekten başlamak</h3>';
  h += _gaAdimlar([
    'Karşılama ekranından <strong>Araç Performans</strong> kartını seçin; ana tuvale tek bir '
      + 'alt-sistem kutusu düşer.',
    'Kutuya <strong>çift tıklayın</strong> — iç topoloji açılır. İlk açılışta içeride yalnız '
      + '<strong>Başlangıç ve Örnekler</strong> kutusu vardır.',
    'O kutuya çift tıklayın ve <strong>Örnek araç</strong> listesinden bir araç seçin.',
    '<strong>Örneği aktar</strong> düğmesine basın. Bütün zincir — motor eğrisi, konvertör '
      + 'tabloları, vites oranları, aks, transfer, lastik, araç künyesi — bir anda kurulur.'
  ]);
  var liste = (typeof veApExampleList === 'function') ? veApExampleList() : [];
  if(liste.length){
    var satir = liste.map(function(e){
      return [_gaE(e.name), _gaE(e.vehicle || '—'), _gaE(e.subtitle || '—'),
              _gaE(e.warning || '—')];
    });
    h += _gaTablo('Kayıtlı örnek araçlar', ['Örnek', 'Araç', 'Yapılandırma', 'Uyarı'], satir,
      ['l', 'l', 'l', 'l']);
    var uyarili = liste.filter(function(e){ return !!e.warning; }).length;
    h += _gaNot('Örneklerin kaynağı',
        'Kayıt defterindeki <strong>' + liste.length + '</strong> araç <em>Allison iSCAAN</em> '
      + 'performans raporlarından kuruldu: motor eğrisi, K-faktörü, vites oranları ve verimleri, '
      + 'aks, transfer, lastik ve C<sub>rr</sub> rapordan okundu ya da ondan türetildi.'
      + (uyarili ? ' Uyarı sütunu dolu <strong>' + uyarili + '</strong> örnekte verinin bir '
        + 'kısmı başka bir rapordan ya da varsayımdan gelir, ya da raporla bilinen bir fark '
        + 'vardır.' : ''));
  }
  h += _gaUyari('Örnek aktarmak mevcut zinciri değiştirir',
      'İç topolojide güç aktarma bileşeni varsa aktarma onay ister; onaylanınca zincir '
    + 'örneğinkiyle <strong>değiştirilir</strong>. Mevcut zincirin üzerine ekleme yoktur.');
  h += '<h3>3.2 Yol B — boş tuvalden elle kurmak</h3>';
  h += _gaAdimlar([
    '<strong>Bileşenler</strong> sütunundan bileşenleri sırayla tuvale sürükleyin: '
      + '<strong>Motor</strong>, <strong>Tork Konvertörü</strong>, <strong>Şanzıman</strong>, '
      + '<strong>Propşaft</strong>, <strong>Transfer Kutusu</strong>, '
      + '<strong>Diferansiyel</strong>, <strong>Tekerlek</strong>.',
    'Bir bileşenin <strong>çıkış portundan</strong> bir sonrakinin <strong>giriş portuna</strong> '
      + 'tel çekin. Geçersiz çiftte bağlantı kurulmaz ve sebebi bildirilir.',
    'Zincirin dışına <strong>Araç</strong>, <strong>Yol / Ortam</strong>, '
      + '<strong>Senaryolar</strong>, <strong>Şanzıman Kontrol</strong> ve '
      + '<strong>Çözücü</strong> bileşenlerini bırakın — bunlar bağlanmaz.',
    'Aksesuarları (<strong>Klima Kompresörü · Alternatör · Hava Kompresörü</strong>) Motor’un '
      + '<em>ön</em> portlarına bağlayın.',
    'Araç birden çok akslıysa transferin her çıkışına bir <strong>Diferansiyel</strong>, her '
      + 'diferansiyele iki <strong>Tekerlek</strong> bağlayın.'
  ]);
  h += _gaNot('Otomatik düzenle',
      'Şeritteki <strong>Otomatik düzenle</strong> bileşenleri referans ızgarasına oturtur: '
    + 'güç akışı soldan sağa, zincirin dört bağlantısı yatay, dallar eşit ve zıt sapar. '
    + 'Yerleşim <strong>hesabı etkilemez</strong>.');
  h += '<h3>3.3 Yol C — kayıtlı bir projeden</h3>';
  h += '<p>Kaydedilmiş proje dosyası (<code>.json</code>) şeritteki <strong>Proje aç</strong> '
    + 'ile açılır. <strong>Başlangıç ve Örnekler</strong> penceresindeki '
    + '<strong>İç topolojiyi JSON dışa aktar</strong> düğmesi kurulan zinciri örnek biçiminde '
    + 'diske yazar.</p>';
  return h;
}

function _gaSec4(){
  var h = _gaH2(3);
  h += '<p>Motor, modelin en çok girdi isteyen bileşenidir. Motora çift tıklayın; pencere üç '
    + 'sütundur: solda girdiler, ortada veri ızgarası, sağda doğrulama.</p>';
  h += _gaAdimlar([
    'Sol sütunun başındaki <strong>Motor seçimi</strong> listesinden hazır bir motor seçin. '
      + 'Liste aile bazlı gruplanmıştır (Cummins ISB / ISG / ISL, Duramax…). Seçim, devir–tork '
      + 'tablosunu ve künyeyi bir anda doldurur.',
    'Motor listede yoksa <strong>Tork &amp; güç verileri</strong> ızgarasına devir ve '
      + '<strong>brüt</strong> tork çiftlerini elle girin. Satırlar devre göre artan sırada '
      + 'olmalıdır.',
    '<strong>Motor parametreleri</strong> kartına governed (regüle) devri yazın — motorun '
      + 'yük altında aşamadığı üst sınır.',
    '<strong>Aksesuar kayıpları</strong> tablosunu doldurun. Her satır bir aksesuarın '
      + 'çektiği gücü söyler; net tork bunlar düşülerek üretilir.',
    'Sağdaki <strong>Doğrulama</strong> sütununda net eğriyi ve azami güç noktasını okuyun.'
  ]);
  h += _gaAlanTablo('Motor penceresi — alanlar', [
    ['Devir [rpm] / Tork [N·m]', 'Devir–<strong>brüt</strong> tork çiftleri',
      'Motor üreticisinin performans eğrisi (fan hariç, aksesuarsız)'],
    ['Governed Speed · No-Load Governed', 'Yük altında ve yüksüz regüle devri, rpm',
      'Motor künyesi; hızlanmanın üst sınırını belirler'],
    ['Motor ataleti [kg·m²]', 'Krank ve volanın dönen ataleti',
      'Motor künyesi; eşdeğer kütleye girer'],
    ['Aksesuar kayıpları', 'Fan · alternatör · hava kompresörü · direksiyon pompası · klima · '
      + 'ek tahrik, her biri kW', 'Araç üreticisinin aksesuar listesi ya da tedarikçi raporu'],
    ['Eğri yaklaşımı', 'Grafikteki eğrinin çizimi: parça-parça lineer · kübik spline (PCHIP) '
      + '· polinom', 'Yalnız grafiği etkiler; simülasyon tabloyu PCHIP ile okur']
  ]);
  h += _gaUyari('Brüt mü net mi',
      'Tabloya <strong>brüt</strong> tork girilir; net tork aksesuar modelinden türetilir. '
    + 'Net eğri brüt alanına yazılırsa aksesuar kaybı <strong>iki kez</strong> düşülür ve '
    + 'bütün performans düşük çıkar; eğri yine çizilir, araç yine hızlanır, uyarı çıkmaz. '
    + 'Tedarikçi raporlarının çoğu iki eğriyi de basar; hangisi olduğunu sütun başlığı '
    + 'söyler.');
  h += _gaNot('Fan kaybı devirle değişir',
      'Kavramalı fan gücü devrin <strong>küpüyle</strong> ölçeklenir (N³); tabloya girilen '
    + 'değer governed devirdeki güçtür. Tedarikçi raporları performansı çoğu zaman '
    + '<em>fan açık</em> ve <em>fan kapalı</em> olarak iki kez basar; karşılaştırma aynı fan '
    + 'durumuyla yapılır.');
  return h;
}

function _gaSec5(){
  var h = _gaH2(4);
  h += '<p>Tork konvertörü, motor ile şanzıman arasındaki hidrolik bağlantıdır ve duruştan '
    + 'kalkışı o mümkün kılar. Konvertöre çift tıklayın.</p>';
  h += _gaAdimlar([
    '<strong>Konvertör seçimi</strong> listesinden konvertörü seçin (TC411, TC413, '
      + 'TC551…). Seçim K-faktörü ve tork oranı tablolarını doldurur.',
    'Listede yoksa <strong>Konvertör veri tablosu</strong>na hız oranına (SR) karşı '
      + 'K-faktörü ve tork oranı (τ) çiftlerini girin.',
    'Pencerenin okumasında <strong>stall</strong> noktasını kontrol edin: SR = 0’daki tork '
      + 'oranı ve K-faktörü, duran araçtaki denge devrini belirler.'
  ]);
  h += _gaAlanTablo('Konvertör penceresi — alanlar', [
    ['SR (Speed Ratio)', 'Türbin devri / pompa devri, 0…1 arası',
      'Konvertör üreticisinin karakteristik eğrisi'],
    ['K-faktörü', 'Pompa kapasite faktörü, N<sub>pompa</sub>/√T<sub>pompa</sub>',
      'Aynı eğri. SR = 0 satırı stall K’sıdır'],
    ['τ (tork oranı)', 'Türbin torku / pompa torku', 'Aynı eğri. Stall’da en yüksektir'],
    ['Pompa tork düşümü', 'Şanzıman pompasının çektiği tork, N·m',
      'Tedarikçi raporundan türetilir; sıfır bırakılabilir']
  ]);
  h += _gaNot('Stall bir girdi değil, bir sonuçtur',
      'Duran araçta motor torku ile pompa torku dengeye gelir ve stall devri bu dengenin '
    + 'çözümüdür; girileceği bir alan yoktur. Motor eğrisi, K-faktörü ve pompa tork düşümü '
    + 'birlikte onu belirler. Tedarikçi raporunun stall satırı bu yüzden bir '
    + '<strong>doğrulama</strong> ölçütüdür: tutuyorsa üç girdi de doğru okunmuştur.');
  h += _gaUyari('Çok köklü denge',
      'Bazı motor–konvertör çiftlerinde denge denkleminin birden çok kökü olur. Çözüm en '
    + 'düşük <strong>kararlı</strong> kökü alır — rölantiden tam gaza basıldığında motorun '
    + 'fiilen ulaşabildiği devir odur. Bazı tedarikçi raporları kararsız kökü basar; o '
    + 'durumda iki sayı ayrışır. Kayıtlı örneklerden <strong>GM Duramax 6.6L — 3200 SP</strong> '
    + 'bu durumdadır; iSCAAN raporu o eşleşmeyi “Unacceptable” olarak işaretler.');
  return h;
}

function _gaSec6(){
  var h = _gaH2(5);
  h += '<p>Şanzıman iki ayrı şey taşır: <strong>oranlar</strong> (kaç vites, hangi oran, hangi '
    + 'verim) ve <strong>geçiş takvimi</strong> (hangi noktada vites değişir). İkisi ayrı '
    + 'pencerelerdedir ve ayrı ayrı yanlış olabilir.</p>';
  h += '<h3>6.1 Şanzıman verileri</h3>';
  h += _gaAdimlar([
    'Şanzımana çift tıklayın; <strong>Şanzıman verileri</strong> tablosunu açın.',
    'Hazır listeden şanzımanı seçin (Allison 3000 SP, 4000 SP, 4500 SP…) ya da oranları '
      + 'elle girin.',
    'Her vites için <strong>oran</strong> ve <strong>verim</strong> sütunlarını doldurun. '
      + 'Verim vites başına farklı olabilir — doğrudan tahrikli vitesin verimi daha yüksektir.',
    'Geri vites oranını da girin; hızlanma simülasyonu onu kullanmaz ama topoloji raporunda '
      + 'görünür.',
    '<strong>Shift profili</strong> listesinden şanzıman ailesinin geçiş profilini seçin.'
  ]);
  h += '<h3>6.2 Vites geçiş takvimi</h3>';
  h += '<p><strong>Şanzıman Kontrol</strong> bileşeni zincire bağlanmaz; tuvalde ayrı durur '
    + 've çözücü onu tipinden bulur. Penceresi <strong>Shift Schedule</strong> (vites geçiş '
    + 'takvimi) bölümünde seçili profilin geçiş noktalarını gösterir.</p>';
  h += _gaAlanTablo('Geçiş takvimi — alanlar', [
    ['Aktif Shift profili', 'Şanzıman penceresinde seçilen geçiş profili',
      'Allison kontrol nesli; örneklerde rapordan doğrulandı'],
    ['Lockup Mode Shift tablosu', 'Kilitli modda geçiş devri: N<sub>shift_ref</sub> − lockup '
      + 'ofseti', 'Profilden; her geçiş için ayrı satır'],
    ['Converter Mode Shift mantığı', '1C→2C ve 2C→2L geçişlerinin çıkış devri oranı '
      + '(N<sub>out</sub>/N<sub>gov</sub>)', 'Profilden; 2C→2L konvertörün kilitlendiği '
      + 'noktadır']
  ]);
  h += _gaNot('Vites adındaki harf konvertör modudur',
      'Sonuçlardaki <code>1C · 2C · 2L · 3L …</code> gösteriminde rakam vitesi, harf '
    + 'konvertör modunu verir: <strong>C</strong> = converter (hidrolik, kayma var), '
    + '<strong>L</strong> = lockup (kilitli, kayma yok). Tipik bir kalkış '
    + '<code>1C → 2C → 2L → 3L …</code> diye ilerler; ikinci viteste önce hidrolik kalınır, '
    + 'sonra kilitlenilir.');
  h += _gaUyari('Vites avlanması uyarı vermez',
      'Yukarı ve aşağı vites eşikleri birbirine fazla yakınsa araç iki vites arasında gidip '
    + 'gelir. Simülasyon bunu <strong>hata olarak bildirmez</strong> — hızlanma süresi uzar ve '
    + 'geçiş sayısı beklenmedik biçimde artar; tek bir eşik hatası bir tam gaz koşusunda '
    + 'yüzlerce geçiş üretebilir. Geçiş sayısı Sonuçlar’ın vites kanalında ve tam gaz '
    + 'raporunun geçiş satırlarında okunur.');
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
    'Transfer kutusuna çift tıklayın; <strong>Kademe tablosu</strong>nu açın.',
    'Her kademe için bir satır girin: <strong>ad</strong>, <strong>oran</strong> ve '
      + '<strong>verim</strong>. İki kademeli bir arazi transferinde tipik olarak bir hızlı '
      + '(yüksek) ve bir yavaş (düşük) kademe olur.',
    'Simülasyon her kademeyi <strong>ayrı ayrı</strong> koşturur; sonuçlarda her kademenin '
      + 'kendi eğrisi vardır.'
  ]);
  h += _gaNot('Kademe rolü orandan çözülür',
      'Hangi kademenin “hızlı”, hangisinin “yavaş” olduğu <strong>dizideki sırasından değil '
    + 'oranından</strong> belirlenir; satırların yeri sonucu değiştirmez.');
  h += '<h3>7.3 Diferansiyel ve tekerlek</h3>';
  h += _gaAlanTablo('Diferansiyel ve tekerlek — alanlar', [
    ['Diferansiyel oranı', 'Aks dişli oranı', 'Aks künyesi'],
    ['Diferansiyel verimi [%]', 'Aks verimi', 'Tipik %95–98'],
    ['Yuvarlanma yarıçapı [m]', '<strong>Yüklü (dinamik) yarıçap</strong>',
      'Lastik künyesi; statik yarıçap değil'],
    ['Yuvarlanma direnci katsayısı (C<sub>rr</sub>)', 'Lastik ve zeminin direnci',
      'Asfaltta 0,003–0,008 bandında'],
    ['Toplam lastik/jant ataleti [kg·m²]', 'Bütün tekerleklerin dönen ataleti',
      'Eşdeğer kütleye I/r² olarak girer; hızlanmayı doğrudan etkiler'],
    ['Tekerlek sayısı', 'Topolojideki tekerlek düğümü sayısı; salt okunur',
      'Lastik seçiminde toplam atalet bu sayıyla kurulur']
  ]);
  h += _gaUyari('Master tekerlek ve master diferansiyel',
      'Çok akslı araçta birden çok diferansiyel ve tekerlek vardır; hız–devir çevrimi '
    + '<strong>bir</strong> diferansiyel ve <strong>bir</strong> tekerlekten yapılır. İlk '
    + 'eklenen diferansiyel ve tekerlek <strong>master</strong> olur: kanvasta yıldız rozeti, '
    + 'penceresinde <strong>MASTER</strong> taşır. Ötekilerin penceresi <strong>SLAVE</strong> '
    + 'yazar ve parametre almaz; akslar farklı oran ya da yarıçap taşısa da hesaba '
    + 'master’ınki girer ve <strong>uyarı çıkmaz</strong>.');
  return h;
}

function _gaSec8(){
  var h = _gaH2(7);
  h += '<p><strong>Araç</strong> bileşeni zincire bağlanmaz; tuvalde ayrı durur ve aracın '
    + 'bütününe ait büyüklükleri taşır.</p>';
  h += _gaAlanTablo('Araç penceresi — alanlar', [
    ['Toplam kütle (GVW) [kg]', 'Simülasyonda kullanılan <strong>toplam</strong> kütle',
      'Yüklü ya da boş — hesaplanan durumun kütlesi'],
    ['Tahrikli tekerleklerdeki ağırlık [%]', 'Ağırlığın tahrikli akslara düşen payı',
      'Aks yükleri; tutunma sınırını belirler'],
    ['Yükseklik [m] · Genişlik [m]', 'Araç ölçüleri; alın alanı A = yükseklik × genişlik',
      'Araç künyesi'],
    ['C<sub>d</sub>', 'Aerodinamik sürtünme katsayısı',
      'Kamyonlarda 0,6–0,9; binek araçta 0,25–0,35'],
    ['Hava yoğunluğu (ρ) [kg/m³]', 'Ortam yoğunluğu', 'Deniz seviyesi 15 °C için 1,225']
  ]);
  h += _gaNot('Eşdeğer kütle ataletlerden kurulur',
      'Dönen parçaların katkısı motor, aktarma organları ve tekerlek ataletlerinden, aradaki '
    + 'oranlarla tekerleğe indirgenerek hesaplanır (I·i²/r²); konvertör modunda motor '
    + 'ataletinin yerine türbin ataleti girer. Ayrı bir döner kütle katsayısı yoktur; atalet '
    + 'alanı boş bırakılan bileşene varsayılan değer girer.');
  return h;
}

function _gaSec9(){
  var h = _gaH2(8);
  h += '<h3>9.1 Yol / Ortam</h3>';
  h += '<p><strong>Yol / Ortam</strong> bileşeni eğimi taşır; <strong>Eğim modu</strong> iki '
    + 'kiptir:</p>';
  h += _gaAlanTablo('Yol / Ortam penceresi — eğim kipleri', [
    ['Manuel (kullanıcı girişli)', 'Elle girilen eğim segmentleri: yön, eğim %, mesafe',
      'Çözücüde <strong>Kullanıcı girişli eğim analizi</strong>'],
    ['Segment bazlı (harita tabanlı)', 'Güzergâhtan çıkan eğim segmentleri; harita ve '
      + 'profiller pencerede', 'Çözücüde <strong>Hızlanma-yavaşlama</strong>']
  ], ['Kip', 'Eğim', 'Analiz']);
  h += _gaNot('Eğim yönle girilir',
      'Segment tablosunda eğim yüzdesi işaretsiz yazılır, yönü ayrı seçilir: '
    + '<strong>İniş</strong> · <strong>Çıkış</strong> · <strong>Düz</strong>. Çıkış aracı '
    + 'yavaşlatır; kuvvet hesabında yokuş yukarı eğim direnci pozitiftir.');
  h += '<h3>9.2 Senaryolar</h3>';
  h += _gaAlanTablo('Senaryolar penceresi — alanlar', [
    ['Senaryo tipi', 'Tam gaz · Kısmi gaz · Özel', 'Tam gaz performansı için Tam gaz'],
    ['Başlangıç hızı [km/h]', 'Simülasyonun başladığı hız', 'Duruştan kalkışta 0'],
    ['Gaz pedal oranı [%]', 'Tam gazda 100', 'Kısmi gaz senaryoları için düşürülür']
  ]);
  h += '<h3>9.3 Yuvarlanma direnci ölçümü (Coast-Down)</h3>';
  h += '<p><strong>Coast-Down</strong> bileşeni serbest yavaşlama testinin verisinden '
    + 'C<sub>rr</sub> çözer (<strong>Test verisinden hesapla</strong>). Test sihirbazı her '
    + 'ölçüm satırı için m·a = −m·g·C<sub>rr</sub> − ½·ρ·A·C<sub>d</sub>·v² − m·g·sin θ '
    + 'denkleminden C<sub>rr</sub> çözer; C<sub>d</sub> bir girdidir (CFD) ve aktarımda Araç '
    + 'bileşenine yazılır. Çözülen C<sub>rr</sub> Coast-Down bileşeninde kalır: Araç '
    + 'Performans çözücüsü C<sub>rr</sub>’yi Tekerlek penceresinden okur.</p>';
  return h;
}

function _gaSec10(){
  var h = _gaH2(9);
  h += '<p><strong>Çözücü</strong> bileşeni zincire bağlanmaz; çözüm kümesini ve sayısal '
    + 'yöntemi taşır. Penceresi bileşene çift tıklanınca ya da şeritteki '
    + '<strong>Çözücü</strong> düğmesiyle açılır.</p>';
  h += _gaAdimlar([
    'Sağ sütundaki <strong>Güç aktarma zinciri</strong> satırını okuyun: bulunan zincirin '
      + 'bileşenleri sırayla yazar; bir halka eksikse satır “Zincir kurulamadı” der.',
    '<strong>Çözüm kümesi</strong>nden analizleri seçin. <strong>Performans analizi</strong> '
      + 'her zaman vardır; Yol / Ortam manuel kipteyse <strong>Kullanıcı girişli eğim '
      + 'analizi</strong>, segment kipinde ve Senaryolar’da yol segmenti varsa '
      + '<strong>Hızlanma-yavaşlama</strong>, tuvalde Engel Geçme bileşeni varsa '
      + '<strong>Engel atlama analizi</strong> seçilebilir.',
    '<strong>Çözüm yöntemi</strong>ni ve <strong>Adım büyüklüğü Δt</strong>’yi seçin.',
    'Şeritteki <strong>Doğrula</strong> ile modeli sınayın; pencerenin '
      + '<strong>Hesapla</strong> düğmesi simülasyonu başlatır.'
  ]);
  h += _gaAlanTablo('Çözücü penceresi — alanlar', [
    ['Çözüm yöntemi', 'Euler · Heun · Ralston · RK4 · RK45 Dormand-Prince',
      'Varsayılan RK4; RK45 adımı kendisi ayarlar'],
    ['Adım büyüklüğü Δt [s]', 'Sabit adımlı yöntemlerde adım: 0,05 · 0,02 · 0,01 · 0,005 · '
      + '0,001', 'Varsayılan 0,01; RK45’te yoktur'],
    ['Tolerans (ATol / RTol)', 'RK45’in adım denetimindeki hata bütçesi',
      'Varsayılan 10<sup>−6</sup> / 10<sup>−4</sup>; yalnız RK45’te'],
    ['Güvenlik limiti [s]', 'Koşunun kesileceği azami süre',
      'Kesilen koşu azami hızı olduğundan düşük verir; azami hıza ulaşılamıyorsa '
      + 'artırılır']
  ]);
  h += '<p>Sağ sütundaki <strong>Sayısal yöntemler</strong> sabittir: tork interpolasyonu '
    + 'PCHIP spline (monoton kübik Hermite; veri noktaları arasında salınım yapmaz), mesafe '
    + 'entegrasyonu trapez kuralı, enerji dengesi her koşuda hesaplanır.</p>';
  h += _gaUyari('Zincir bulunamıyorsa sebebi Çözücü penceresinde yazar',
      'Simülasyon “güç aktarma zinciri bulunamadı” diyorsa bir halka bağlı değildir ya da bir '
    + 'tel ters yönde çekilmiştir. <strong>Güç aktarma zinciri</strong> satırı görülen '
    + 'bileşenleri sırayla yazar; eksik olan orada belli olur. Motor, Araç ve Tekerlek '
    + 'bileşenleri <strong>zorunludur</strong>; biri yoksa çözücü açık hata verir.');
  return h;
}

function _gaSec11(){
  var h = _gaH2(10);
  h += '<p>Sonuçların <strong>üç okuma yüzeyi</strong> vardır.</p>';
  h += _gaAlanTablo('Sonuç yüzeyleri', [
    ['<strong>Sonuçlar sayfası</strong>', 'Hız–zaman, mesafe, devir, tork, vites ve mod '
      + 'kanalları; çok şeritli eğri görünümü',
      'Bir büyüklüğün zaman içindeki gidişini görmek'],
    ['<strong>Veri Gezgini</strong>', 'Kanal ağacı; arama, istatistik, mini eğri',
      'Üretilen kanalları görmek ve şeride eklemek'],
    ['<strong>Raporlar</strong>', 'Detaylı rapor (HTML) ve TXT raporları (Bölüm 12)',
      'Sayıyı belgelemek, paylaşmak, elle doğrulamak']
  ], ['Yüzey', 'Ne gösterir', 'Ne için']);
  h += '<h3>11.1 Hangi sayı nerede</h3>';
  h += _gaAlanTablo('Kritik sonuçlar', [
    ['Azami hız', 'Düz yolda denge hızı, km/h', 'Tam gaz raporu özeti; kademe başına ayrı'],
    ['0–X km/h süreleri', 'Hızlanma çıpaları, s', 'Tam gaz raporunun hızlanma tablosu'],
    ['Stall devri', 'Duran araçta konvertör denge devri, rpm', 'Detay matematik hesapları'],
    ['Vites geçiş hızları', 'Her geçişin gerçekleştiği hız, km/h',
      'Tam gaz raporunun geçiş satırları; Sonuçlar sayfasındaki vites kanalı'],
    ['Eğim kabiliyeti', 'Verilen hızda azami eğim, %',
      'Detaylı rapor → Araç Performans özeti → Eğim kabiliyeti'],
    ['Enerji dengesi', 'Motor gücünün tekerleğe, konvertör ısısına ve aktarma kaybına '
      + 'dağılımı', 'Tam gaz raporunun enerji dengesi bölümü; detaylı raporun güç bütçesi']
  ], ['Büyüklük', 'Ne', 'Nerede okunur']);
  h += _gaNot('Kademe başına ayrı sonuç',
      'Transfer kutusu iki kademeliyse simülasyon <strong>iki kez</strong> koşar ve iki ayrı '
    + 'sonuç kümesi üretir. Azami hız ve hızlanma süreleri kademeye göre çok farklıdır; '
    + 'rapor kademeyi satır başında yazar.');
  h += _gaUyari('Geçiş sayısı avlanmayı gösterir',
      'Tam gaz kalkışta geçiş sayısı ileri vites sayısı mertebesindedir (altı vitesli '
    + 'şanzımanda beş–altı geçiş). Onlarca geçiş, takvimin avlandığını gösterir '
    + '(Bölüm 6.2).');
  return h;
}

function _gaSec12(){
  var h = _gaH2(11);
  h += '<p>Raporlar <strong>Sonuçlar</strong> sayfasında, Veri Gezgini’nin altında, çözüm '
    + 'sekmesine göre listelenir; simülasyon koşmadan liste boştur. Şeritteki '
    + '<strong>Rapor</strong> düğmesi tam raporu TXT, kanal verisini CSV olarak indirir.</p>';
  h += _gaAlanTablo('Rapor türleri', [
    ['Detaylı rapor', 'Girdi özeti ve Araç Performans özeti: eğim kabiliyeti, hızlanma, '
      + 'vites geçişleri; güç bütçesi', 'Performans analizi sekmesi · HTML'],
    ['Tam gaz hızlanma raporu (TXT)', 'Topoloji detayı, özet, hızlanma tablosu, vites '
      + 'geçişleri, azami hız, enerji dengesi',
      'Performans analizi sekmesi · ana performans belgesi'],
    ['Detay matematik hesapları (TXT)', 'Adım adım ara değerler, iterasyonlar, denge '
      + 'çözümleri; iki kademeli transferde kademe başına ayrı',
      'Performans analizi sekmesi · bir sayının nereden geldiğini izlemek'],
    ['Hızlanma-yavaşlama raporu (TXT)', 'İvme ve yavaşlama profilleri',
      'Hızlanma-yavaşlama sekmesi'],
    ['Engel atlama raporu (TXT)', 'Basamak/rampa geçişi sonuçları', 'Engel atlama sekmesi'],
    ['Topoloji raporu (TXT)', 'Kurulan zincirin bütün girdileri',
      'Hızlanma-yavaşlama ve Engel atlama sekmeleri'],
    ['CSV', 'Ham kanal verisi', 'Şeritteki <strong>Rapor</strong> düğmesi']
  ], ['Rapor', 'İçerik', 'Nerede']);
  h += _gaNot('TXT raporu A4 sayfasıdır',
      'TXT raporları ekranda A4 sayfa olarak açılır; geniş tablo sayfaya sığacak puntoya '
    + 'küçülür, dar rapor okunur puntoda kalır. İndirilen HTML aynı sayfayı açar ve A4’e '
    + 'basılır.');
  h += _gaUyari('Rapor çözümün fotoğrafıdır',
      'Rapor üretildikten sonra değişen alan rapora <strong>girmez</strong>. Değişiklik için '
    + 'yeniden çözün ve raporu yeniden üretin.');
  return h;
}

function _gaSec13(){
  var h = _gaH2(12);
  h += '<p>Bu modülde de en pahalı hata sınıfı çöken model değil, <strong>“makul ama yanlış” '
    + 'sayıdır</strong>: simülasyon koşar, eğriler çizilir, hiçbir uyarı çıkmaz.</p>';
  h += _gaTablo('Uyarı vermeyen hatalar',
    ['Alan', 'Yanlış verilirse ne olur', 'Belirtisi'],
    [
      ['Brüt ↔ net tork', 'Aksesuar kaybı iki kez düşülür',
        'Bütün performans düşük; azami hız ve hızlanma birlikte kayar'],
      ['Yuvarlanma yarıçapı', 'Hız ekseninin tamamı ölçeklenir',
        'Vites geçiş hızları ve azami hız aynı oranda kayar, biçim korunur'],
      ['Master tekerlek / diferansiyel', 'Akslar farklıyken hesaba yalnız master’ın değeri '
        + 'girer', 'Yalnız çok akslı araçlarda; oranlar farklıysa hız kayar'],
      ['Vites geçiş eşikleri', 'Araç iki vites arasında avlanır',
        '<strong>Geçiş sayısı beklenenin katlarına çıkar</strong>'],
      ['Aktarma verimi', 'Toplam zincir verimi tek bir bileşene yazılır, ötekilerin verimi '
        + 'de uygulanır', 'Çekiş kuvveti sistematik düşük'],
      ['Atalet alanları', 'Eşdeğer kütle şişer ya da küçülür',
        'Hızlanma süreleri kayar, azami hız değişmez'],
      ['Eğim yönü', 'İniş ile çıkış karıştırılır', 'Azami hız beklenmedik biçimde yüksek'],
      ['Transfer kademesi', 'Yanlış kademenin sonucu okunur',
        'Azami hız iki kat farklı — rapor satır başında kademeyi yazar']
    ], ['l', 'l', 'l']);
  h += _gaOnay('Gözden geçirme: zincirin girdileri tek sayfada',
      'Bu sınıfların çoğu, kurulan zincirin bütün girdileri tek sayfada görülünce gözle '
    + 'yakalanır: tam gaz hızlanma raporunun başındaki topoloji detayı ya da Topoloji '
    + 'raporu.');
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
  return '%' + (p >= 0 ? '+' : '') + _gaFs(p, 2);
}

function _gaSec14(){
  var h = _gaH2(13);
  var pack = _gaOrnekTopoloji();
  if(!pack){
    h += '<p>Örnek bu kurulumda bulunamadı; sayılar üretilmedi.</p>';
    return h;
  }

  var ex = pack.ex;
  h += '<p>Kılavuzun tamamı tek bir araçta: <strong>' + _gaE(ex.name) + '</strong>. Araç '
    + 'modülün kalibrasyon referansıdır ve <em>Allison iSCAAN '
    + _gaE(VE_GUIDE_ARAC_ISCAAN.rapor) + '</em> raporundan kuruldu. MFSim sayıları belge '
    + 'üretilirken simülasyon motoruyla hesaplanır.</p>';

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
    + 'Hız–devir çevrimi bunlardan yalnız <strong>master</strong> olanından yapılır '
    + '(Bölüm 7.3).');

  // ── 14.2 Koşu ────────────────────────────────────────────────────────────
  var tr = null;
  pack.nodes.forEach(function(n){ if(n.type === 'transfer') tr = n; });
  var kademeler = (tr && tr.data && tr.data.ftTrGears && tr.data.ftTrGears.length)
    ? tr.data.ftTrGears : [{ kademe: 'tek', ratio: 1 }];

  var kosular = kademeler.map(function(g){
    return { g: g, R: _gaKoslu(pack, g.kademe) };
  }).filter(function(k){ return k.R && k.R.speed && k.R.speed.length; });

  if(!kosular.length){
    h += '<p>Simülasyon bu kurulumda koşmadı; sayılar üretilmedi.</p>';
    return h;
  }

  h += '<h3>14.2 Azami hız ve stall</h3>';
  h += '<p>Transfer kutusu iki kademelidir; simülasyon <strong>her kademe için ayrı</strong> '
    + 'koşar ve her kademenin sonucu iSCAAN raporundaki karşılığıyla yan yana durur.</p>';

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
        'Duran araçta çıkış devri her viteste sıfırdır; vites ya da transfer oranı denge '
      + 'noktasını <strong>etkilemez</strong> ve iki kademede de aynı sayı çıkar. Sayının '
      + 'raporla örtüşmesi motor eğrisinin, K-faktörünün ve pompa tork düşümünün doğru '
      + 'okunduğunu gösterir (Bölüm 5).');
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
    h += _gaNot('Fark saniye olarak okunur',
        '0–20 km/h gibi kısa bir aralıkta yüzde küçük bir sayıya bölündüğü için şişer; '
      + 'mutlak fark raporun baskı çözünürlüğü (±0,05 s) mertebesindedir. Fark ilk birkaç '
      + 'saniyede doğar ve vites geçişlerinde <strong>sıçramaz</strong>: kaynağı tork '
      + 'kesintisi değil, konvertör modundaki eşdeğer kütle farkıdır.');
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
    h += _gaNot('Referans bir nokta değil bir bant',
        'iSCAAN hızlanma tablosu sabit bir hız ızgarasında basılır; geçişin hangi hızda '
      + 'değil, hangi iki satır arasında olduğunu verir. Karşılaştırma bu yüzden bir bandadır; '
      + 'bandın genişliği tablonun çözünürlüğüdür (~1,6 km/h).');
  }

  // ── 14.5 Örneği programda koşturmak ──────────────────────────────────────
  h += '<h3>14.5 Örneği programda koşturmak</h3>';
  h += _gaAdimlar([
    'Araç Performans modülünün iç topolojisinde <strong>Başlangıç ve Örnekler</strong> '
      + 'kutusunu açın.',
    '<strong>Örnek araç</strong> listesinden <strong>' + _gaE(ex.name) + '</strong> '
      + 'örneğini seçin ve <strong>Örneği aktar</strong> düğmesine basın.',
    '<strong>Çözücü</strong> penceresinde <strong>Hesapla</strong> ile simülasyonu başlatın.',
    '<strong>Sonuçlar</strong> sayfasında <strong>Tam gaz hızlanma raporu (TXT)</strong> '
      + 'Bölüm 14.2–14.4’teki sayıları verir.',
    'Stall dengesi ve her adımın ara değerleri <strong>Detay matematik hesapları</strong> '
      + 'raporundadır.'
  ]);
  h += _gaOnay('Kılavuz ile program aynı sayıyı verir',
      'Bölüm 14’teki MFSim değerleri belge üretilirken <strong>programın kendi '
    + 'motoruyla</strong> hesaplanır. Programdaki koşu farklı çıkıyorsa örnek ya da bir alanı '
    + 'değişmiştir; iSCAAN sütunu raporun basılı değeridir ve sabittir.');
  return h;
}

function _gaEkA(){
  var h = _gaH2(14);
  h += '<p>Pencere ve kart adları programdaki başlıklarla birebir aynıdır.</p>';
  h += _gaTablo('Alan → pencere eşlemesi',
    ['Alan', 'Pencere', 'Kart'],
    [
      ['Hazır motor listesi', 'Motor', 'Motor seçimi'],
      ['Devir–brüt tork tablosu', 'Motor', 'Tork &amp; güç verileri'],
      ['Governed devir', 'Motor', 'Motor parametreleri'],
      ['Fan, alternatör, klima kayıpları', 'Motor', 'Aksesuar kayıpları'],
      ['Eğri uydurma yöntemi', 'Motor', 'Eğri yaklaşımı'],
      ['Net eğri ve azami güç', 'Motor', 'Doğrulama'],
      ['Hazır konvertör listesi', 'Tork Konvertörü', 'Konvertör seçimi'],
      ['K-faktörü ve tork oranı', 'Tork Konvertörü', 'Konvertör veri tablosu'],
      ['Vites oranları ve verimleri', 'Şanzıman', 'Şanzıman verileri'],
      ['Shift profili', 'Şanzıman', 'Şanzıman verileri'],
      ['Vites geçiş noktaları', 'Şanzıman Kontrol', 'Shift Schedule'],
      ['Transfer kademeleri', 'Transfer Kutusu', 'Kademe tablosu'],
      ['Aks oranı', 'Diferansiyel', 'Diferansiyel'],
      ['Lastik yarıçapı, C<sub>rr</sub>, atalet', 'Tekerlek', 'Tekerlek parametreleri'],
      ['Kütle, ölçüler, C<sub>d</sub>', 'Araç', 'Araç parametreleri · Aerodinamik parametreleri'],
      ['Yol eğimi', 'Yol / Ortam', 'Eğim parametreleri'],
      ['Başlangıç hızı, gaz oranı', 'Senaryolar', 'Başlangıç koşulları · Senaryo parametreleri'],
      ['Çözüm yöntemi ve tolerans', 'Çözücü', 'Çözüm yöntemi · Tolerans (ATol / RTol)'],
      ['Hangi analizler koşacak', 'Çözücü', 'Çözüm kümesi'],
      ['Zincir bulundu mu', 'Çözücü', 'Güç aktarma zinciri'],
      ['C<sub>rr</sub> testi', 'Coast-Down', 'Coast-Down parametreleri'],
      ['Motor–konvertör uyumu', 'Motor-Konvertör Eşleştirme', 'Konvertör uyumluluk tablosu'],
      ['Motor–şanzıman uyumu', 'Motor-Şanzıman Eşleştirme', 'Şanzıman uyumluluk tablosu'],
      ['Hazır araç örnekleri', 'Başlangıç ve Örnekler', 'Örnek araç'],
      ['Raporlar', 'Sonuçlar', 'Veri Gezgini']
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
    eyebrow: 'MFSim · Araç Performans modülü · Kullanım kılavuzu',
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
    title: 'MFSim — Araç Performans kılavuzu',
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
