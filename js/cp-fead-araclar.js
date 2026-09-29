// ════════════════════════════════════════════════════════════════════════════
//  FEAD ARAÇLARI PENCERESİ — topolojideki araç kutularının yerine
// ════════════════════════════════════════════════════════════════════════════
//
// Kullanıcı kararı (2026-09-28, tasarım tezgâhı IV · A · Takım Penceresi):
// *"A güzel. A'yı çok beğendim. Onu yapalım."* İsteğin kendisi: *"FEAD
// modülündeki topoloji-bileşen mantığını kaldırmak istiyorum … araçlar buraya
// bir pencere olarak gelebilir … hatta taşınabilir de yapılabilir."* "Buraya",
// Kayış Yolu kartının solundaki kesikli alan: pencerenin YUVASI orası.
//
// NEDEN PENCERE: Sihirbaz, Çözücü, Rapor ve Dönüş Yönü kayış sisteminin parçası
// değildi — dördünün de girişi ve çıkışı sıfır — ve kutu olmalarının tek sebebi
// pencerelerinin düğüm kimliğinden açılmasıydı. Hesaplamak üç hareketti (kutuya
// çift tık · ▶ Hesapla · pencereyi kapat); burada tek tık.
//
// KURALLAR — her biri modülün kendi kuralının bu yüzeydeki karşılığı:
//  • VERİ DÜĞÜMDE KALIR (kural 9). Pencere hiçbir ayar TUTMAZ: Çözücü, Rapor
//    ve Sihirbaz düğümleri kutusuz yaşar (components.js → noCanvasBox) ve
//    pencere onlara bağlanır — Hesapla çözücünün çevrimini, İndir raporun
//    türünü okur. İkinci bir ayar iki yüzeyin sessizce ayrışması demekti.
//  • DURUM TEK ÇAĞRIDAN (kural 33): `veFeadResultState` — çözücü penceresi,
//    Sonuçlar sekmesi ve rapor da onu okur; çip tek üreticiden
//    (`veFeadResChipHTML`), özet kartları `veFeadSignals.summary`den, uygunluk
//    çözücü penceresinin sağ sütunundan (`_feadSideGates`, kural 16) — aynı
//    soruya iki yüzey aynı cevabı verir.
//  • YER VE KATLILIK MODELDE DEĞİL (kural 15'in gerekçesi): görünüm durumu
//    kaydedilmez, geri-al yığınına yazılmaz; tarayıcıda hatırlanır.
//  • YUVADAKİ PENCERE TUVALİ ÖRTER VE BUNU SÖYLER (`data-ve-ortu="sol"`):
//    sığdırma o genişliği görünür alandan düşer (ui-core.js →
//    veFitViewToContent). Söylemeseydi açılış kadrajında kart pencerenin
//    ALTINDA kalırdı. Serbest bırakılan pencere söylemez — yeri kullanıcının.
//  • YALNIZ FEAD KAPSAMINDA GÖRÜNÜR — kapsam değişiminin tek noktası
//    `veSyncSidebarScope` (components.js) buraya haber verir.
//  • TAZELEME TEK NOKTADAN (kural 11): kartların tazelemesi
//    (`veFeadRefreshLayoutCards` — her saveState'ten ve geri yüklemeden) +
//    çözüm (`veFeadSolve`) + sonucu unutma (`_feadForgetResults`).
//  • FARE PENCEREDE KALIR: tuvalin sürükleme/seçme/yakınlaştırma dinleyicileri
//    kap üzerinde; pencere onlara olay SIZDIRMAZ (tık tuvali kaydırmasın,
//    tekerlek kadrajı değiştirmesin).
//  • NOT ARAÇLARI BURADA (kullanıcı, 2026-09-28: *"Not araçlarını da FEAD
//    araçları penceresine ekleyelim"*): FEAD'de "Bileşenler" sütunu yok (kural
//    41), sütunun "Araçlar" kategorisi — gruplama çerçevesi · yazı etiketi —
//    buraya geldi. Açıklama modülü (js/annotations.js) DEĞİŞMEDİ: sürükleme
//    onun taşıyıcısını (`annotation-type`) yazar ve kabın `drop` dinleyicisine
//    düşer, tık onun kurucusunu (`createAnnotation`) çağırır — ikinci bir
//    açıklama yolu yok. Pencere bırakma hedefi DEĞİL: altına kurulan not
//    pencerenin arkasında görünmez kalırdı.
// Görünüm CSS'te (`css/styles.css` → `.ve-fead-arac*`); başlık pencere
// ailesinin (`.ve-settings-header`, kök CLAUDE.md → "PENCERE AİLESİ TEK").

var VE_FEAD_ARAC_ID = 've-fead-araclar';
var VE_FEAD_ARAC_ANAHTAR = 'mfsim.fead.araclar';
// Yuva: tuval kabının sol üstü. Pencere bu kadar yaklaşınca yapışır.
var VE_FEAD_ARAC_YUVA = { x: 12, y: 12 };
var VE_FEAD_ARAC_YAPIS = 64;
// Pencerenin eni — `.ve-fead-arac{width}` ile BİREBİR (kapı: fead-araclar.test.js).
// Okuyan: kılavuz sahnesi (doğal en). Tuvalin sığdırma payı eni DOM'dan ölçer.
var VE_FEAD_ARAC_EN = 236;
// Özet kartlarının sırası — Sonuçlar'ın listesinden seçilir, kopyalanmaz.
var VE_FEAD_ARAC_KPI = ['kayma', 'taraf', 'ankraj', 'burulma'];
// Not araçları — tip annotations.js'in (`createAnnotation(tip, …)`) tipi.
var VE_FEAD_ARAC_NOT = [
  { tip: 'frame', ikon: 'square-dashed', ad: 'Çerçeve', uzun: 'Gruplama çerçevesi',
    tik: 'kartları çevreler' },
  { tip: 'text', ikon: 'type', ad: 'Yazı', uzun: 'Yazı etiketi',
    tik: 'kartların üstüne' }
];
// Tıkla kurulan notun kartlara uzaklığı (kanvas px) ve kamera kaydırmada
// görünümün kenarından bırakılan pay (ekran px).
var VE_FEAD_NOT_PAY = 28;
var VE_FEAD_NOT_ARALIK = 12;
var VE_FEAD_NOT_KENAR = 16;

var _feadAracYer = null;          // { yuva, x, y, katli } — oturum + tarayıcı
var _feadAracKapsam = false;      // FEAD kapsamında mıyız

function _feadAracEsc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function _feadAracIkon(ad){ return (typeof veIkon === 'function') ? veIkon(ad) : ''; }

// ── GÖRÜNÜM DURUMU (yer · katlılık) — model DIŞINDA ────────────────────────
function veFeadAraclarYer(){
  if(_feadAracYer) return _feadAracYer;
  var y = null;
  try {
    if(typeof localStorage !== 'undefined')
      y = JSON.parse(localStorage.getItem(VE_FEAD_ARAC_ANAHTAR) || 'null');
  } catch(e){ y = null; }
  if(!y || typeof y !== 'object') y = {};
  _feadAracYer = {
    yuva: y.yuva !== false,
    x: Number.isFinite(+y.x) ? +y.x : VE_FEAD_ARAC_YUVA.x,
    y: Number.isFinite(+y.y) ? +y.y : VE_FEAD_ARAC_YUVA.y,
    katli: !!y.katli
  };
  return _feadAracYer;
}
function _feadAracYerYaz(){
  try {
    if(typeof localStorage !== 'undefined')
      localStorage.setItem(VE_FEAD_ARAC_ANAHTAR, JSON.stringify(_feadAracYer));
  } catch(e){ /* özel pencere / engelli depolama: yalnız oturumda kalır */ }
}

// ── MODELİN OKUNMASI — SAF: DOM'a dokunmaz ─────────────────────────────────
function _feadAracDugum(tip){
  if(typeof nodes === 'undefined' || !nodes) return null;
  for(var i = 0; i < nodes.length; i++) if(nodes[i] && nodes[i].type === tip) return nodes[i];
  return null;
}
function _feadAracKasnakSay(){
  if(typeof nodes === 'undefined' || !nodes) return 0;
  return nodes.filter(function(n){
    var d = (typeof componentDefs !== 'undefined' && componentDefs[n.type]) || n.def || {};
    return !!d.isFeadPulley;
  }).length;
}

// Pencerenin okuduğu her şey tek nesnede. Hesaplanan hiçbir şey burada
// ÜRETİLMEZ: hüküm, çip, kartlar ve kapılar modülün kendi çağrılarından.
function veFeadAraclarDurum(){
  var solver = _feadAracDugum('fead-solver'), rapor = _feadAracDugum('fead-report');
  var sih = _feadAracDugum('fead-wizard'), kayis = _feadAracDugum('fead-belt');
  var build = null;
  try { build = (typeof veFeadBuildFromCanvas === 'function') ? veFeadBuildFromCanvas() : null; }
  catch(e){ build = null; }
  var satir = 0;
  try { satir = (solver && typeof veFeadDutyRows === 'function') ? veFeadDutyRows(solver).length : 0; }
  catch(e){ satir = 0; }
  var st = (solver && typeof veFeadResultState === 'function')
    ? veFeadResultState(null, solver.id) : { k: 'yok', R: null };
  var R = st && st.R;
  var kasnak = _feadAracKasnakSay();
  var modelOk = !!(build && build.ok);
  var neden = !solver ? 'Çözücü yok.'
    : !modelOk ? (kasnak ? 'Model eksik — kasnak konumlarını tamamlayın.'
                         : 'Henüz kasnak yok — modeli sihirbazla kurun.')
    : (satir > 0 ? '' : 'Çalışma çevrimi boş — sürücü kasnağın “Çevrim” sekmesinden en az bir satır girin.');
  // Özet kartları yalnız bu modelin sonucu varken (BAYAT sonuç da gösterilir —
  // sayı gizlenmez, çip bayatlığını yanında söyler; kural 10).
  var kpi = [];
  if(R && R.ok && (st.k === 'guncel' || st.k === 'bayat' || st.k === 'bilinmiyor')
     && typeof veFeadSignals !== 'undefined' && veFeadSignals && typeof veFeadSignals.summary === 'function'){
    var liste = [];
    try { liste = veFeadSignals.summary(R) || []; } catch(e){ liste = []; }
    VE_FEAD_ARAC_KPI.forEach(function(k){
      var x = liste.filter(function(s){ return s && s.k === k; })[0];
      if(x) kpi.push(x);
    });
  }
  var spin = (typeof veFeadCurrentSpin === 'function') ? veFeadCurrentSpin() : 0;
  // Gergi tarafı hükmü yalnız GÜNCEL sonuçtan: bayat sonucun hükmü başka bir
  // yönün hükmü olabilir (yön çevrilince sonuç bayatlar).
  var taraf = (st.k === 'guncel' && R && R.tensionerSide) ? R.tensionerSide : null;
  // ÇÖZÜM HATASININ SEBEBİ PENCEREDE: çip yalnız "Çözüm hatası" diyor; sebep
  // yalnız toast'ta kalsaydı Hesapla'ya basan kullanıcı onu kaçırırdı.
  var hata = (st.k === 'hata' && R) ? String(R.error || 'Çözüm başarısız.') : '';
  var kd = (kayis && kayis.data) || {};
  return {
    solverId: solver ? solver.id : null, raporId: rapor ? rapor.id : null,
    sihirbazId: sih ? sih.id : null, kayisId: kayis ? kayis.id : null,
    kasnak: kasnak, modelOk: modelOk, satir: satir,
    hazir: !!(solver && modelOk && satir > 0), neden: neden,
    durum: st || { k: 'yok' }, kpi: kpi,
    raporTur: (rapor && typeof veFeadReportKind === 'function') ? veFeadReportKind(rapor) : 'detailed',
    sonucVar: !!(R && R.ok),
    spin: spin, taraf: taraf, hata: hata,
    kayisKunye: [kd.beltType, [kd.profile, kd.brand].filter(Boolean).join(' · ')].filter(Boolean).join(' · '),
    build: build
  };
}

// ── HTML — SAF: durum nesnesinden ──────────────────────────────────────────
function _feadAracDugme(ey, ikon, yazi, sinif, ek){
  return '<button type="button" class="' + (sinif || 've-fead-arac-btn') + '" data-ey="' + ey + '"'
    + (ek || '') + '>' + (ikon ? _feadAracIkon(ikon) : '') + (yazi ? '<span>' + yazi + '</span>' : '') + '</button>';
}

function _feadAracYonAd(s){
  var l = (typeof veFeadSpinLabel === 'function') ? veFeadSpinLabel(s) : null;
  return (l && l.kisa) ? l.kisa : (s > 0 ? 'CCW' : 'CW');
}
// Anahtarın bir yönü. İPUCU DÜZLEMİ YAZAR (`veFeadSpinLabel(s).uzun`): hangi
// taraftan bakıldığı söylenmeden CW/CCW hiçbir şey söylemez — eski Dönüş
// Yönü panelinin kuralı, etiket tek üreticiden.
function _feadAracYonDugme(s, d, yonVar){
  var l = (typeof veFeadSpinLabel === 'function') ? veFeadSpinLabel(s) : null;
  return '<button type="button" role="radio" aria-checked="' + (d.spin === s) + '" data-ey="yon" data-v="' + s + '"'
    + (l && l.uzun ? ' title="' + _feadAracEsc(l.uzun) + '"' : '')
    + (yonVar ? '' : ' aria-disabled="true"') + '>'
    + _feadAracIkon(s > 0 ? 'rotate-ccw' : 'rotate-cw') + '<span>' + _feadAracYonAd(s) + '</span></button>';
}

function veFeadAraclarGovdeHTML(d){
  d = d || veFeadAraclarDurum();
  var h = '';
  // MODEL — künye + Sihirbaz
  h += '<section class="ve-fead-arac-bol" data-bol="model"><h4>Model</h4>'
    + '<div class="ve-fead-arac-kunye">'
    + (d.kasnak ? '<b>' + d.kasnak + ' kasnak</b>' : '<b>Henüz kasnak yok</b>')
    + (d.kayisKunye
        ? '<button type="button" class="ve-fead-arac-bag" data-ey="kayis" title="Kayış Özellikleri">'
          + _feadAracEsc(d.kayisKunye) + '</button>'
        : '')
    + '</div><div class="ve-fead-arac-sat">'
    + _feadAracDugme('sihirbaz', 'wand', 'Sihirbaz', d.kasnak ? 've-fead-arac-btn' : 've-fead-arac-btn birincil',
        ' title="Başlangıç Sihirbazı — modeli adım adım kurar"')
    + '<span class="bos"></span>'
    // YENİ KANVAS — FEAD'de "Bileşenler" sütunu yok (components.js →
    // noPalette); sütunun Kayış Yolu satırının yeri burası. Kasnak ise
    // kartın Kayış Tablosu'ndan eklenir ("＋ Kasnak ekle").
    + _feadAracDugme('kanvas', 'plus', 'Kanvas', 've-fead-arac-bag',
        ' title="Yeni Kayış Yolu kanvası — kartların sağına eklenir"')
    + '</div></section>';

  // ÇÖZÜM — durum çipi, Hesapla, Ayarlar, özet kartları, uygunluk
  var cip = (typeof veFeadResChipHTML === 'function') ? veFeadResChipHTML(d.durum) : '';
  h += '<section class="ve-fead-arac-bol" data-bol="cozum"><h4>Çözüm' + cip + '</h4>'
    + '<div class="ve-fead-arac-sat">'
    + _feadAracDugme('hesapla', 'play', 'Hesapla', 've-fead-arac-btn birincil',
        d.hazir ? ' title="Modeli çalışma çevrimiyle çöz"' : ' aria-disabled="true" title="' + _feadAracEsc(d.neden) + '"')
    + '<span class="bos"></span>'
    + _feadAracDugme('ayarlar', 'sliders', 'Ayarlar', 've-fead-arac-bag',
        ' title="Çözücü penceresi — yöntemler, model ve sonuç"')
    + '</div>';
  if(!d.hazir && d.neden) h += '<p class="ve-fead-arac-not">' + _feadAracEsc(d.neden) + '</p>';
  if(d.hata) h += '<p class="ve-fead-arac-huk" data-d="no">' + (typeof veDurumIkon === 'function' ? veDurumIkon('err') : '')
    + '<span>' + _feadAracEsc(d.hata) + '</span></p>';
  if(d.kpi.length){
    h += '<div class="ve-fead-arac-kpi' + (d.durum.k === 'bayat' ? ' bayat' : '') + '">'
      + d.kpi.map(function(k){
          return '<div data-d="' + _feadAracEsc(k.durum || '') + '"' + (k.not ? ' title="' + _feadAracEsc(k.not) + '"' : '') + '>'
            + '<span>' + _feadAracEsc(k.ad) + '</span>'
            + '<b>' + _feadAracEsc(k.deger) + (k.birim ? '<i>' + _feadAracEsc(k.birim) + '</i>' : '') + '</b></div>';
        }).join('') + '</div>';
  }
  // UYGUNLUK — çözücü penceresinin sağ sütunuyla AYNI üretici (kural 16).
  if(d.modelOk && typeof _feadSideGates === 'function'){
    var T = null;
    try { T = (typeof veFeadTableRows === 'function') ? veFeadTableRows(d.build) : null; } catch(e){ T = null; }
    try { h += '<div class="ve-fead-arac-kapi">' + _feadSideGates(d.build, T) + '</div>'; } catch(e){}
  }
  h += '</section>';

  // RAPOR — tür + İndir
  var tur = d.raporTur;
  h += '<section class="ve-fead-arac-bol" data-bol="rapor"><h4>Rapor</h4><div class="ve-fead-arac-sat">'
    + '<span class="ve-fead-arac-seg" role="radiogroup" aria-label="Rapor türü">'
    + '<button type="button" role="radio" aria-checked="' + (tur === 'summary') + '" data-ey="tur" data-v="summary">Özet</button>'
    + '<button type="button" role="radio" aria-checked="' + (tur !== 'summary') + '" data-ey="tur" data-v="detailed">Detaylı</button>'
    + '</span><span class="bos"></span>'
    + _feadAracDugme('indir', 'download', 'İndir', 've-fead-arac-btn',
        d.sonucVar ? ' title="Raporu oluştur ve indir"' : ' aria-disabled="true" title="Rapor çözümden üretilir — önce modeli hesaplayın."')
    + '</div>'
    // KÜNYE BAĞLANTISI ŞART: rapor kutusu kalktı; belgenin antetine akan
    // alanlar (Rapor penceresi → Künye) başka hiçbir yoldan açılmıyor.
    + '<div class="ve-fead-arac-sat ve-fead-arac-alt">'
    + _feadAracDugme('rapor', 'edit', 'Künye', 've-fead-arac-bag',
        ' title="Rapor penceresi — tür ve belge künyesi"')
    + '</div></section>';

  // YÖN — iki durumlu anahtar + gergi tarafı hükmü
  var yonVar = d.spin !== 0;
  h += '<section class="ve-fead-arac-bol" data-bol="yon"><h4 title="Yön değişince sarım açıları, açıklıklar ve kayış boyu DEĞİŞMEZ; gergin açıklık, span gerilmeleri, hubload yönleri ve kayma emniyeti DEĞİŞİR.">Yön</h4><div class="ve-fead-arac-sat">'
    + '<span class="ve-fead-arac-seg" role="radiogroup" aria-label="Kayış dönüş yönü">'
    + _feadAracYonDugme(-1, d, yonVar) + _feadAracYonDugme(1, d, yonVar)
    + '</span></div>';
  if(d.taraf){
    h += d.taraf.ok
      ? '<p class="ve-fead-arac-huk" data-d="ok">' + (typeof veDurumIkon === 'function' ? veDurumIkon('ok') : '')
        + 'Gergi gevşek tarafta</p>'
      : '<p class="ve-fead-arac-huk" data-d="no">' + (typeof veDurumIkon === 'function' ? veDurumIkon('err') : '')
        + '<span><b>Gergi gergin tarafta</b> — en düşük açıklık '
        + (typeof veSayi === 'function' ? veSayi(d.taraf.minN, 1) : String(d.taraf.minN)) + ' N ('
        + _feadAracEsc(d.taraf.minName || '—') + '), ankrajın '
        + (typeof veSayi === 'function' ? veSayi(d.taraf.deficitN, 1) : String(d.taraf.deficitN))
        + ' N altında. Yönü çevirin ya da gergiyi sürücünün önüne alın.</span></p>';
  } else if(yonVar){
    h += '<p class="ve-fead-arac-not">Yön Kayış Tablosu\'nun sırasından türer; gergi tarafı hükmü için hesaplayın.</p>';
  }
  h += '</section>';

  // NOT — gruplama çerçevesi + yazı etiketi. Öğe bir `div`: sürüklenebilsin
  // diye (kasnak listesinin gerekçesi, cp-fead.js → veFeadTableAddHTML);
  // klavyede Enter/Boşluk tıklar (veFeadAraclarKur).
  h += '<section class="ve-fead-arac-bol" data-bol="not"><h4>Not</h4><div class="ve-fead-arac-sat">'
    + VE_FEAD_ARAC_NOT.map(function(n){
        return '<div class="ve-fead-arac-btn tasinir" role="button" tabindex="0" draggable="true"'
          + ' data-ey="not" data-v="' + n.tip + '"'
          + ' title="' + _feadAracEsc(n.uzun + ' — sürükle: tuvalde bıraktığın yere; tıkla: ' + n.tik) + '">'
          + _feadAracIkon(n.ikon) + '<span>' + n.ad + '</span></div>';
      }).join('')
    + '</div></section>';
  return h;
}

// Katlı hâlin şeridi: durum noktası + dört eylem. Eylemler açık hâlinkilerle
// AYNI (data-ey) — şerit ikinci bir eylem kümesi değil, aynı pencerenin dar hâli.
function veFeadAraclarRayHTML(d){
  d = d || veFeadAraclarDurum();
  var c = (typeof VE_FEAD_RES_DURUM !== 'undefined' && VE_FEAD_RES_DURUM[d.durum.k]) || { d: 'off', t: 'Sonuç yok' };
  return '<span class="ve-fead-arac-nokta" data-d="' + _feadAracEsc(c.d) + '" title="' + _feadAracEsc(c.t) + '"></span>'
    + _feadAracDugme('hesapla', 'play', '', 've-fead-arac-ray-btn birincil',
        d.hazir ? ' title="Hesapla" aria-label="Hesapla"' : ' aria-disabled="true" title="' + _feadAracEsc(d.neden) + '" aria-label="Hesapla"')
    + _feadAracDugme('indir', 'download', '', 've-fead-arac-ray-btn',
        d.sonucVar ? ' title="Raporu indir" aria-label="Raporu indir"' : ' aria-disabled="true" title="Rapor çözümden üretilir — önce modeli hesaplayın." aria-label="Raporu indir"')
    + _feadAracDugme('yon', 'refresh', '', 've-fead-arac-ray-btn', ' title="Yönü çevir" aria-label="Yönü çevir" data-v="cevir"')
    + _feadAracDugme('sihirbaz', 'wand', '', 've-fead-arac-ray-btn', ' title="Başlangıç Sihirbazı" aria-label="Başlangıç Sihirbazı"');
}

function veFeadAraclarHTML(d){
  d = d || veFeadAraclarDurum();
  return '<div class="ve-settings-header ve-fead-arac-bas" title="Sürükle — çift tık: katla">'
    + '<span>' + _feadAracIkon('wrench') + '<span class="ve-fead-arac-ad">FEAD araçları</span></span>'
    + '<button type="button" class="ve-fead-arac-katla" data-ey="katla" aria-label="Katla" title="Katla">'
    + _feadAracIkon('chevron-up') + '</button></div>'
    + '<div class="ve-fead-arac-govde">' + veFeadAraclarGovdeHTML(d) + '</div>'
    + '<div class="ve-fead-arac-ray">' + veFeadAraclarRayHTML(d) + '</div>';
}

// ── EYLEMLER — hepsi modülün var olan çağrılarına gider ────────────────────
function veFeadAracEylem(ad, v){
  var d = veFeadAraclarDurum();
  if(ad === 'hesapla'){
    if(!d.hazir){ if(typeof showToast === 'function') showToast(d.neden || 'Model hazır değil.', 'warning'); return false; }
    if(typeof veFeadSolve === 'function') veFeadSolve(d.solverId);
    return true;
  }
  if(ad === 'ayarlar'){
    return !!(d.solverId && typeof veFeadTableOpen === 'function' && veFeadTableOpen(d.solverId));
  }
  if(ad === 'rapor'){
    return !!(d.raporId && typeof veFeadTableOpen === 'function' && veFeadTableOpen(d.raporId));
  }
  if(ad === 'kayis'){
    return !!(typeof veFeadKayisAc === 'function' && veFeadKayisAc());
  }
  if(ad === 'sihirbaz'){
    if(d.sihirbazId && typeof veFeadWizOpen === 'function') return !!veFeadWizOpen(d.sihirbazId);
    return !!(typeof veFeadWizOpenAny === 'function' && veFeadWizOpenAny());
  }
  if(ad === 'kanvas'){
    return !!(typeof veFeadKanvasEkle === 'function' && veFeadKanvasEkle());
  }
  if(ad === 'not'){
    return !!veFeadNotEkle(v);
  }
  if(ad === 'tur'){
    var r = _feadAracDugum('fead-report');
    if(!r || (v !== 'summary' && v !== 'detailed')) return false;
    if(!r.data) r.data = {};
    if(r.data.reportKind === v || (!r.data.reportKind && v === 'detailed')) return false;
    r.data.reportKind = v;
    if(typeof saveState === 'function') saveState();
    veFeadAraclarTazele();
    return true;
  }
  if(ad === 'indir'){
    if(!d.sonucVar){ if(typeof showToast === 'function') showToast('Rapor çözümden üretilir — önce modeli hesaplayın.', 'warning'); return false; }
    if(typeof veFeadGenerateReport === 'function') veFeadGenerateReport(d.raporId);
    return true;
  }
  if(ad === 'yon'){
    if(!d.spin) return false;
    // İki durumlu anahtar: seçili olana basmak hiçbir şey yapmaz; şeridin tek
    // düğmesi ("çevir") her basışta çevirir.
    if(v !== 'cevir' && Number(v) === d.spin) return false;
    if(typeof veFeadToggleSpin === 'function') veFeadToggleSpin();
    veFeadAraclarTazele();
    return true;
  }
  if(ad === 'katla'){ veFeadAraclarKatla(); return true; }
  return false;
}

// ── NOT ARAÇLARI — tıkla kurulan notun YERİ ────────────────────────────────
// Not kartların ÖNÜNDE değil ARKASINDA durur (annotations.js: bağlantı
// katmanının hemen ardına kurulur) ve FEAD tuvalini büyük ölçüde kartlar
// kaplar — görünümün ortasına kurulan not kartın arkasında GÖRÜNMEZ kalırdı.
// Yer bu yüzden kartlardan türer: çerçeve kartları ÇEVRELER (gruplamanın
// kendisi), yazı onların üstüne, sol kenara oturur. Hedef kutulu kartların
// HEPSİ — seçim DEĞİL: örnek kurucusu son kurduğu kartı seçili bırakıyor
// (ölçüldü), yani seçime bakan kural kullanıcının seçmediği bir kartı
// çerçevelerdi.
//
// SAF. kutu — kartların sınır kutusu (`veBoundaryBox(liste, 0, ölçer)`:
// {x, y, w, h}, adlar dâhil) ya da null; mevcut — `annotations`; merkez —
// görünür alanın ortası (kanvas px, kart yoksa yedek). Döner {x, y, width, height}.
function veFeadNotYeri(tip, kutu, mevcut, merkez){
  mevcut = mevcut || [];
  merkez = merkez || { x: 3000, y: 3000 };
  var i, a;
  if(tip === 'frame'){
    if(!kutu) return { x: merkez.x - 125, y: merkez.y - 75, width: 250, height: 150 };
    var p = VE_FEAD_NOT_PAY;
    var r = { x: kutu.x - p, y: kutu.y - p, width: kutu.w + 2 * p, height: kutu.h + 2 * p };
    // AYNI kartları çevreleyen çerçeve zaten varsa İÇ İÇE: ikinci çerçeve
    // birincinin 16 px dışına — üst üste binen iki çerçeve tek görünürdü.
    var ayni = function(){
      return mevcut.some(function(m){
        return m && m.type === 'frame' && Math.abs(m.x - r.x) < 2 && Math.abs(m.y - r.y) < 2
          && Math.abs((m.width || 0) - r.width) < 2 && Math.abs((m.height || 0) - r.height) < 2;
      });
    };
    for(i = 0; i < 50 && ayni(); i++){ r.x -= 16; r.y -= 16; r.width += 32; r.height += 32; }
    return r;
  }
  var w = 120, h = 30;
  if(!kutu) return { x: merkez.x - w / 2, y: merkez.y - h / 2, width: w, height: h };
  var x = kutu.x, y = kutu.y - h - VE_FEAD_NOT_ARALIK;
  // Yazının ALTINDA kalması gerekenler: çerçevenin üst kenarı (etiketi onun
  // üstüne biner, css top:-9px) ve başka bir yazı. Çakışırsa yazı onların
  // üstüne çıkar — her yeni başlık bir öncekinin üstüne dizilir.
  for(i = 0; i < 50; i++){
    var engel = null;
    for(var k = 0; k < mevcut.length && !engel; k++){
      a = mevcut[k];
      if(!a || !isFinite(a.x) || !isFinite(a.y)) continue;
      var y1 = a.type === 'frame' ? a.y - 12 : a.y;
      var y2 = a.type === 'frame' ? a.y + 12 : a.y + (a.height || h);
      var x2 = a.x + (a.width || w);
      if(x < x2 && x + w > a.x && y < y2 && y + h > y1) engel = y1;
    }
    if(engel === null) break;
    y = engel - h - VE_FEAD_NOT_ARALIK;
  }
  return { x: x, y: y, width: w, height: h };
}

// SAF: yeni notun görünmesi için kameranın KAYMASI (ekran px). Not zaten
// görünüyorsa {0,0} — kamera OYNAMAZ. Görünümden büyükse sol üst köşesi
// (etiketi) görünür kılınır. gor — {sol (örtü), w, h}; kanvas px → ekran:
// (x − 3000)·zoom + ofset (#ve-canvas −3000 ofsetli, ui-core.js).
function veFeadNotKaydir(r, zoom, ofs, gor){
  var z = (isFinite(zoom) && zoom > 0) ? zoom : 1;
  var sx = (r.x - 3000) * z + ofs.x, sy = (r.y - 3000) * z + ofs.y;
  var sw = r.width * z, sh = r.height * z, e = VE_FEAD_NOT_KENAR;
  var x0 = (gor.sol || 0) + e, x1 = gor.w - e, y0 = e, y1 = gor.h - e;
  var dx = 0, dy = 0;
  if(sx + sw > x1) dx = x1 - (sx + sw);
  if(sx + dx < x0) dx = x0 - sx;
  if(sy + sh > y1) dy = y1 - (sy + sh);
  if(sy + dy < y0) dy = y0 - sy;
  return { dx: dx, dy: dy };
}

// TIK: notu kurar, SEÇER ve görünür kılar. Seçim yalnız yeni notta kalır —
// Delete ona gitmeli; seçili kalan bir kart da onunla birlikte silinirdi.
// Kurulum annotations.js'in kurucusundan: TEK saveState = TEK geri-al adımı.
function veFeadNotEkle(tip){
  if(tip !== 'frame' && tip !== 'text') return null;
  if(typeof createAnnotation !== 'function') return null;
  // Kutusuz düğümleri (kasnak, kayış, araçlar) sınır kutusu kendisi ayıklıyor.
  var kutu = (typeof veBoundaryBox === 'function' && typeof nodes !== 'undefined')
    ? veBoundaryBox(nodes, 0, (typeof veMeasureNodeLabel === 'function') ? veMeasureNodeLabel : null) : null;
  var kap = _feadAracKap();
  var W = kap ? kap.clientWidth : 0, H = kap ? kap.clientHeight : 0;
  var sol = (kap && typeof veTuvalSolOrtu === 'function') ? veTuvalSolOrtu(kap) : 0;
  var z = (typeof canvasZoom !== 'undefined' && canvasZoom > 0) ? canvasZoom : 1;
  var o = (typeof canvasOffset !== 'undefined' && canvasOffset) ? canvasOffset : { x: 0, y: 0 };
  var merkez = { x: (sol + (W - sol) / 2 - o.x) / z + 3000, y: (H / 2 - o.y) / z + 3000 };
  var r = veFeadNotYeri(tip, kutu, (typeof annotations !== 'undefined') ? annotations : [], merkez);
  var a = createAnnotation(tip, r.x, r.y, tip === 'frame' ? { width: r.width, height: r.height } : undefined);
  if(!a) return null;
  if(typeof clearSelection === 'function') clearSelection();
  if(typeof clearAnnotationSelection === 'function') clearAnnotationSelection();
  if(typeof selectAnnotation === 'function') selectAnnotation(a);
  if(W > 0 && H > 0 && typeof canvasOffset !== 'undefined'){
    var k = veFeadNotKaydir(r, z, o, { sol: sol, w: W, h: H });
    if(k.dx || k.dy){
      canvasOffset.x += k.dx; canvasOffset.y += k.dy;
      if(typeof updateCanvasTransform === 'function') updateCanvasTransform();
    }
  }
  if(typeof showToast === 'function')
    showToast((tip === 'frame' ? 'Gruplama çerçevesi' : 'Yazı etiketi')
      + ' eklendi — metni çift tıklayarak düzenleyin.', 'success');
  return a;
}

// ── DOM — kurma, yerleştirme, tazeleme ─────────────────────────────────────
function _feadAracKap(){
  return (typeof document !== 'undefined') ? document.getElementById('ve-canvas-wrapper') : null;
}
function _feadAracEl(){
  return (typeof document !== 'undefined') ? document.getElementById(VE_FEAD_ARAC_ID) : null;
}

function _feadAracYerlestir(el){
  var yer = veFeadAraclarYer(), kap = _feadAracKap();
  var x = yer.yuva ? VE_FEAD_ARAC_YUVA.x : yer.x, y = yer.yuva ? VE_FEAD_ARAC_YUVA.y : yer.y;
  if(kap && kap.clientWidth > 0){
    // Serbest pencere kabın dışında kalmasın (pencere küçülmüş olabilir).
    var w = el.offsetWidth || 0;
    x = Math.max(0, Math.min(x, Math.max(0, kap.clientWidth - Math.min(w, 60))));
    y = Math.max(0, Math.min(y, Math.max(0, kap.clientHeight - 30)));
  }
  el.style.left = Math.round(x) + 'px';
  el.style.top = Math.round(y) + 'px';
  el.classList.toggle('katli', !!yer.katli);
  if(yer.yuva) el.setAttribute('data-ve-ortu', 'sol'); else el.removeAttribute('data-ve-ortu');
  el.setAttribute('data-yuva', yer.yuva ? '1' : '0');
  var k = el.querySelector('.ve-fead-arac-katla');
  if(k){
    k.setAttribute('aria-expanded', yer.katli ? 'false' : 'true');
    k.setAttribute('aria-label', yer.katli ? 'Aç' : 'Katla');
    k.title = yer.katli ? 'Aç' : 'Katla';
    var ik = k.querySelector('.mf-ico');
    if(ik && typeof veIkonDegis === 'function') veIkonDegis(ik, yer.katli ? 'chevron-down' : 'chevron-up');
  }
}

function veFeadAraclarKur(){
  var kap = _feadAracKap();
  if(!kap) return null;
  var el = _feadAracEl();
  if(el) return el;
  el = document.createElement('section');
  el.id = VE_FEAD_ARAC_ID;
  el.className = 've-fead-arac';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'FEAD araçları');
  el.innerHTML = veFeadAraclarHTML();
  // TUVALE OLAY SIZDIRMA: kabın dinleyicileri pan/seçim/yakınlaştırma yapıyor.
  ['mousedown', 'pointerdown', 'dblclick', 'contextmenu', 'wheel', 'click'].forEach(function(t){
    el.addEventListener(t, function(e){ e.stopPropagation(); }, t === 'wheel' ? { passive: true } : false);
  });
  el.addEventListener('click', function(e){
    var b = e.target && e.target.closest && e.target.closest('[data-ey]');
    if(!b) return;
    // PASİFLİK EYLEMİN KAPISINDA: her eylem kendi koşulunu denetler — Hesapla
    // ve İndir sebebi söyler (sessiz kalan pasif düğme "bozuk" okunurdu), yön
    // anahtarı yön yokken hiçbir şey yapmaz. Tık düzeyinde ikinci bir kapı
    // eylemin kendisiyle örtüşüyordu: onu kaldıran mutasyon hiçbir testte
    // görünmedi (ölçüldü), yani ölü koddu.
    veFeadAracEylem(b.getAttribute('data-ey'), b.getAttribute('data-v'));
  });
  // Klavye: `div` düğmeler (not araçları — sürüklenebilsinler diye `div`)
  // Enter / Boşluk ile tıklanır.
  el.addEventListener('keydown', function(e){
    if(e.key !== 'Enter' && e.key !== ' ') return;
    var b = e.target && e.target.closest && e.target.closest('[data-ey][role="button"]');
    if(!b) return;
    e.preventDefault();
    veFeadAracEylem(b.getAttribute('data-ey'), b.getAttribute('data-v'));
  });
  // NOT SÜRÜKLEME: annotations.js'in taşıyıcısı (`annotation-type`); bırakmayı
  // kabın `drop` dinleyicisi (annotations.js) karşılar. Pencerenin gövdesi her
  // tazelemede yeniden kuruluyor — dinleyici öğede değil pencerede.
  el.addEventListener('dragstart', function(e){
    var b = e.target && e.target.closest && e.target.closest('[data-ey="not"]');
    if(!b || !e.dataTransfer) return;
    e.dataTransfer.setData('annotation-type', b.getAttribute('data-v'));
    e.dataTransfer.effectAllowed = 'copy';
  });
  // PENCERE BIRAKMA HEDEFİ DEĞİL: kabın `dragover`ı her yerde bırakmaya izin
  // veriyor (ui-core.js) ve pencere onun çocuğu — altına kurulan not
  // pencerenin arkasında görünmez kalırdı. `dropEffect = 'none'` kabın izni
  // verilse bile bırakmayı reddeder; olay yine kabarır (belge dinleyicileri
  // körleşmez).
  el.addEventListener('dragover', function(e){
    var ty = e.dataTransfer && e.dataTransfer.types;
    if(ty && Array.prototype.indexOf.call(ty, 'annotation-type') >= 0) e.dataTransfer.dropEffect = 'none';
  });
  _feadAracSurukleBagla(el);
  kap.appendChild(el);
  _feadAracYerlestir(el);
  return el;
}

// BAŞLANGIÇ SAYFASI AÇIKKEN PENCERE GİZLİ (js/cp-fead-baslangic.js): sayfa
// tuvali örter ve aynı kapıları (Sihirbaz · boş kanvas) kendisi gösterir; iki
// yüzey aynı anda "buradan başla" demesin. Sayfanın görünürlüğü MODELDEN
// türer (kasnak yok ve Kayış Yolu kartı yok) ve tek sorulduğu yer burası —
// kapsam değişimi de tazeleme de buradan geçer, yani sayfa her saveState'te,
// geri yüklemede ve sonuç unutulunca kendini modele göre açar/kapar.
function _feadAracBaslangic(){
  var acik = (typeof veFeadBaslangicTazele === 'function')
    ? !!veFeadBaslangicTazele(_feadAracKapsam) : false;
  var el = _feadAracEl();
  if(el) el.hidden = !_feadAracKapsam || acik;
  return acik;
}

// Tazeleme: gövde ve şerit yeniden kurulur, ODAK KORUNUR (düğmenin eylem
// anahtarıyla) — klavyeyle Hesapla'ya basan kullanıcının odağı düşmesin.
function veFeadAraclarTazele(){
  var el = _feadAracEl();
  if(!el || !_feadAracKapsam) return false;
  _feadAracBaslangic();
  var d;
  try { d = veFeadAraclarDurum(); } catch(e){ return false; }
  var odak = (typeof document !== 'undefined' && document.activeElement && el.contains(document.activeElement))
    ? document.activeElement : null;
  var anah = odak ? (odak.getAttribute('data-ey') || '') + '|' + (odak.getAttribute('data-v') || '') : null;
  var govde = el.querySelector('.ve-fead-arac-govde'), ray = el.querySelector('.ve-fead-arac-ray');
  if(govde) govde.innerHTML = veFeadAraclarGovdeHTML(d);
  if(ray) ray.innerHTML = veFeadAraclarRayHTML(d);
  if(anah){
    var p = anah.split('|');
    var yeni = el.querySelector('[data-ey="' + p[0] + '"]' + (p[1] ? '[data-v="' + p[1] + '"]' : ''));
    if(yeni && typeof yeni.focus === 'function') yeni.focus();
  }
  return true;
}

// Kapsam: yalnız FEAD alt topolojisinde görünür. Görünür olduğu anda yeri
// kurulur ki ardından gelen sığdırma yuvadaki genişliği ölçebilsin.
function veFeadAraclarKapsam(scope){
  _feadAracKapsam = (scope === 'fead-analysis');
  var el = _feadAracEl();
  if(!_feadAracKapsam){ if(el) el.hidden = true; _feadAracBaslangic(); return false; }
  el = el || veFeadAraclarKur();
  if(!el) return false;
  el.hidden = false;
  _feadAracYerlestir(el);
  veFeadAraclarTazele();
  return true;
}

function veFeadAraclarKatla(){
  var yer = veFeadAraclarYer();
  yer.katli = !yer.katli;
  _feadAracYerYaz();
  var el = _feadAracEl();
  if(el) _feadAracYerlestir(el);
  return yer.katli;
}

// ── TAŞIMA VE YUVA ─────────────────────────────────────────────────────────
// Başlıktan tutulur (düğmeler hariç). Yuvaya VE_FEAD_ARAC_YAPIS kadar
// yaklaşınca kesikli yuva belirir, bırakınca yapışır. Serbest pencere tuvali
// örttüğünü söylemez — yeri kullanıcının.
function _feadAracYuvaEl(kap){
  var y = kap.querySelector('.ve-fead-arac-yuva');
  if(y) return y;
  y = document.createElement('div');
  y.className = 've-fead-arac-yuva';
  y.setAttribute('aria-hidden', 'true');
  kap.appendChild(y);
  return y;
}
function _feadAracYakin(x, y){
  return Math.hypot(x - VE_FEAD_ARAC_YUVA.x, y - VE_FEAD_ARAC_YUVA.y) <= VE_FEAD_ARAC_YAPIS;
}
function _feadAracSurukleBagla(el){
  var bas = el.querySelector('.ve-fead-arac-bas');
  if(!bas) return;
  bas.addEventListener('dblclick', function(e){
    if(e.target && e.target.closest && e.target.closest('button')) return;
    veFeadAraclarKatla();
  });
  bas.addEventListener('pointerdown', function(e){
    if(e.button !== 0 || (e.target && e.target.closest && e.target.closest('button'))) return;
    var kap = _feadAracKap();
    if(!kap) return;
    e.preventDefault();
    var sx = e.clientX, sy = e.clientY, x0 = el.offsetLeft, y0 = el.offsetTop, oynadi = false;
    var yuva = _feadAracYuvaEl(kap);
    yuva.style.left = VE_FEAD_ARAC_YUVA.x + 'px';
    yuva.style.top = VE_FEAD_ARAC_YUVA.y + 'px';
    yuva.style.width = el.offsetWidth + 'px';
    yuva.style.height = el.offsetHeight + 'px';
    try { bas.setPointerCapture(e.pointerId); } catch(err){}
    function mv(ev){
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if(!oynadi && Math.abs(dx) + Math.abs(dy) < 4) return;
      if(!oynadi){ oynadi = true; el.classList.add('surukle'); yuva.classList.add('goster'); }
      var nx = Math.max(0, Math.min(x0 + dx, kap.clientWidth - 60));
      var ny = Math.max(0, Math.min(y0 + dy, kap.clientHeight - 30));
      el.style.left = Math.round(nx) + 'px';
      el.style.top = Math.round(ny) + 'px';
      el.removeAttribute('data-ve-ortu');
      yuva.classList.toggle('yakin', _feadAracYakin(nx, ny));
    }
    function up(){
      bas.removeEventListener('pointermove', mv);
      bas.removeEventListener('pointerup', up);
      bas.removeEventListener('pointercancel', up);
      el.classList.remove('surukle');
      yuva.classList.remove('goster', 'yakin');
      if(!oynadi) return;
      var yer = veFeadAraclarYer();
      var nx = el.offsetLeft, ny = el.offsetTop;
      yer.yuva = _feadAracYakin(nx, ny);
      if(!yer.yuva){ yer.x = nx; yer.y = ny; }
      _feadAracYerYaz();
      _feadAracYerlestir(el);
    }
    bas.addEventListener('pointermove', mv);
    bas.addEventListener('pointerup', up);
    bas.addEventListener('pointercancel', up);
  });
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veFeadAraclarDurum: veFeadAraclarDurum, veFeadAraclarHTML: veFeadAraclarHTML,
    veFeadAraclarGovdeHTML: veFeadAraclarGovdeHTML, veFeadAraclarRayHTML: veFeadAraclarRayHTML,
    veFeadAracEylem: veFeadAracEylem, veFeadAraclarKur: veFeadAraclarKur,
    veFeadAraclarTazele: veFeadAraclarTazele, veFeadAraclarKapsam: veFeadAraclarKapsam,
    veFeadAraclarKatla: veFeadAraclarKatla, veFeadAraclarYer: veFeadAraclarYer,
    VE_FEAD_ARAC_YUVA: VE_FEAD_ARAC_YUVA, VE_FEAD_ARAC_YAPIS: VE_FEAD_ARAC_YAPIS, VE_FEAD_ARAC_EN: VE_FEAD_ARAC_EN,
    VE_FEAD_ARAC_ANAHTAR: VE_FEAD_ARAC_ANAHTAR, VE_FEAD_ARAC_KPI: VE_FEAD_ARAC_KPI,
    VE_FEAD_ARAC_NOT: VE_FEAD_ARAC_NOT, VE_FEAD_NOT_PAY: VE_FEAD_NOT_PAY,
    veFeadNotYeri: veFeadNotYeri, veFeadNotKaydir: veFeadNotKaydir, veFeadNotEkle: veFeadNotEkle,
    _feadAracSifirla: function(){ _feadAracYer = null; _feadAracKapsam = false; }
  };
}
