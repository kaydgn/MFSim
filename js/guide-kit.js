// ═══════════════════════════════════════════════════════════════════════════
// KULLANIM KILAVUZU KİTİ — şeritteki "Kılavuzlar" yüzeyi + ortak belge kabuğu
// ═══════════════════════════════════════════════════════════════════════════
//
// MFSim dört modül taşıyor (Araç Performans · Takoz · FEAD · Yapısal Analiz) ve
// her birinin kendi kullanım kılavuzu olacak. Bu dosya o kılavuzların ORTAK
// altyapısı: kayıt defteri, şeritten açılan seçim penceresi, ve belgelerin
// paylaştığı HTML kabuğu.
//
// ── ÜÇ KARAR, ÜÇ GEREKÇE ───────────────────────────────────────────────────
//
// 1 · KOZMETİK İKİNCİ KEZ YAZILMAZ. Kılavuz belgesi "Detaylı FEAD raporu" ile
//     BİREBİR aynı görünmek zorunda (kullanıcı isteği). Bunu sağlamanın iki
//     yolu vardı: raporun CSS'ini buraya kopyalamak, ya da ÇALIŞMA ANINDA
//     şablondan çıkarmak. Kopya seçilseydi rapor teması bir kez güncellendiğinde
//     kılavuz sessizce eskirdi — bu deponun en çok kaçındığı hata sınıfı
//     ("ikinci kopya"). Bu yüzden `_gkReportCss` gömülü rapor şablonunun
//     ikinci <style> bloğunu okuyup aynen kullanıyor. Kapı bunu ayrıca tutuyor:
//     şablon bulunamazsa SESSİZCE varsayılana düşmez, açık hata verir.
//
// 2 · KILAVUZ ÇÖZÜLMÜŞ MODEL İSTEMEZ. Rapor, çözülmemiş modelde indirmeyi
//     REDDEDER (boş belge sessiz başarısızlıktır). Kılavuz bunun tersi: öğretici
//     bir belgedir, tuval bomboşken — hatta karşılama ekranındayken — okunabilir
//     olmak zorundadır. Zaten kullanıcının ona en çok ihtiyaç duyduğu an odur.
//
// 3 · ÖRNEK SAYILARI ÜRETİM ANINDA HESAPLANIR. Kılavuzun sonundaki işlenmiş
//     örnek elle yazılmış sayılar taşımıyor: `veFeadBuildSystem(nodeList, connList)`
//     açık liste kabul ettiği için örnek KULLANICININ TUVALİNE DOKUNMADAN
//     bellekte kuruluyor ve çözülüyor. Çekirdek bir gün değişirse kılavuzun
//     sayıları da değişir — belge yapısal olarak bayatlayamaz.
//
// Ad öneki `veGuide…` / `_gk…` — `_fr` (FEAD raporu), `_fsr` (özet rapor),
// `_fead` (FEAD sunumu) ve `_r` (Takoz raporu) ile çakışmasın (source-hygiene
// kapısı: aynı adı iki dosyada üst-seviye bildirmek birincisini sessizce ezer).

// ── KAYIT DEFTERİ ──────────────────────────────────────────────────────────
// Yeni bir modül kılavuzu eklemek = buraya bir satır + `uret` fonksiyonunu
// yazmak. Şerit, pencere ve dosya adı hepsi buradan besleniyor; ikinci bir
// liste tutulmuyor.
//
// `uret` bir GLOBAL FONKSİYON ADIDIR, fonksiyonun kendisi değil: dosya yükleme
// sırası bu listeyi bağlamasın (guide-kit.js, kılavuz üreticilerinden ÖNCE de
// yüklenebilir). Ad çözülemiyorsa satır "hazırlanıyor" olarak çizilir.
var VE_GUIDE_KIT = [
  {
    id: 'fead',
    modul: 'FEAD',
    baslik: 'FEAD — Kayış-Kasnak Sistemi',
    ozet: 'Serpantin kayış tahrikini sıfırdan modelleme: kasnak yerleşimi, '
        + 'kayış yolu, otomatik gergi montaj zarfı, çalışma çevrimi, sonuçların '
        + 'okunması ve rapor. Sonunda uçtan uca işlenmiş bir örnek.',
    uret: 'veGuideFeadHTML',
    dosya: 'MFSim_FEAD_Kullanim_Kilavuzu'
  },
  {
    id: 'arac',
    modul: 'Araç Performans',
    baslik: 'Araç Performans — Güç Aktarma Zinciri',
    ozet: 'Motor, konvertör, şanzıman, transfer, diferansiyel ve tekerlek '
        + 'zincirinin kurulması; senaryo ve çözücü ayarları.',
    uret: 'veGuideAracHTML',
    dosya: 'MFSim_Arac_Performans_Kullanim_Kilavuzu'
  },
  {
    id: 'mount',
    modul: 'Takoz Çökme-Titreşim',
    baslik: 'Takoz — Çökme ve Titreşim Analizi',
    ozet: 'Motor-şanzıman kütlesinin takozlara oturtulması, taşıma kapasitesi, '
        + 'izolasyon ve şok analizi.',
    uret: 'veGuideMountHTML',
    dosya: 'MFSim_Takoz_Kullanim_Kilavuzu'
  }
];

function veGuideKitOf(id){
  for(var i = 0; i < VE_GUIDE_KIT.length; i++)
    if(VE_GUIDE_KIT[i].id === id) return VE_GUIDE_KIT[i];
  return null;
}

// Kılavuzun üreticisi YÜKLÜ MÜ? Kayıt defterindeki `uret` yalnız bir ad; o adı
// taşıyan bir fonksiyon yoksa kılavuz henüz yazılmamış demektir. Pencere bunu
// "hazırlanıyor" diye yazar — düğmeyi çizip tıklayınca hiçbir şey olmaması,
// bu deponun "sessiz başarısızlık" saydığı şeyin ta kendisi olurdu.
function veGuideKitReady(kayit){
  return !!(kayit && kayit.uret && typeof window !== 'undefined'
            && typeof window[kayit.uret] === 'function');
}

function veGuideKitCount(){
  var n = 0;
  VE_GUIDE_KIT.forEach(function(k){ if(veGuideKitReady(k)) n++; });
  return n;
}

// ── HANGİ MODÜLDEYİZ ───────────────────────────────────────────────────────
// Kapsam `veSidebarScope`ten okunur, alt-sistem yığınları TEKRAR TARANMAZ:
// o değişkeni `veSyncSidebarScope` (js/components.js) her modüle giriş ve
// çıkışta yazıyor, yani tek gerçek kaynak odur. Yığınları burada ikinci kez
// yorumlamak, iki yerin önceliği (Araç → Takoz → FEAD → Yapısal) sessizce
// ayrıştığında yanlış kılavuzu açardı.
var VE_GUIDE_SCOPE_MAP = {
  'arac-performans': 'arac',
  'mount-analysis': 'mount',
  'fead-analysis': 'fead'
};

// Açık modülün kılavuz kimliği — hiçbir modülün içinde değilsek null.
// Kılavuzu YAZILMAMIŞ bir modül de null döner: şeritteki "Bu Modülün Kılavuzu"
// düğmesi o zaman hiç çizilmez. Çizilip tıklanınca "henüz hazır değil" demek,
// kullanıcıya var olmayan bir şeyi vaat edip geri almak olurdu.
function veGuideCurrentId(){
  var scope = (typeof veSidebarScope !== 'undefined') ? veSidebarScope : 'top';
  var id = VE_GUIDE_SCOPE_MAP[scope];
  if(!id) return null;
  return veGuideKitReady(veGuideKitOf(id)) ? id : null;
}

function veGuideOpenCurrent(){
  var id = veGuideCurrentId();
  if(!id){ veGuideKitOpen(); return; }
  veGuideOpen(id);
}

// ── ORTAK BELGE KABUĞU ─────────────────────────────────────────────────────

function _gkEsc(s){
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// RAPORUN KOZMETİĞİ — şablondan ÇIKARILIR, kopyalanmaz.
//
// Gömülü şablon (js/fead-report-template.js → window.FEAD_REPORT_TEMPLATE_B64)
// iki <style> bloğu taşıyor: birincisi `@@ASSETS_CSS@@` yer tutucusu (font +
// KaTeX), ikincisi belgenin KENDİ kozmetiği (palet, tipografi, antet, tablo,
// not kutusu, şekil, baskı kuralları). Kılavuz ikincisini olduğu gibi alıyor.
//
// SESSİZCE VARSAYILANA DÜŞMEZ. Blok bulunamazsa kılavuz raporun temasını değil
// tarayıcının varsayılan stilini alırdı — belge yine üretilir, yine indirilir,
// yalnız bambaşka görünürdü. Tam olarak "makul ama yanlış" sınıfı; bu yüzden
// açık hata.
function _gkReportCss(tpl){
  var s = String(tpl || '');
  var ilk = s.indexOf('<style>');
  var ikinci = (ilk < 0) ? -1 : s.indexOf('<style>', ilk + 7);
  var kapan = (ikinci < 0) ? -1 : s.indexOf('</style>', ikinci);
  if(ikinci < 0 || kapan < 0)
    throw new Error('Rapor şablonunda kozmetik <style> bloğu bulunamadı — '
      + 'kılavuz raporla aynı görünümde üretilemez.');
  var css = s.slice(ikinci + 7, kapan);
  // Çıkarılan bloğun GERÇEKTEN kozmetik blok olduğunu doğrula: şablonun
  // sırası değişirse (ör. araya üçüncü bir <style> girerse) yanlış blok
  // alınabilirdi ve fark yalnız belgeye bakınca görünürdü.
  if(css.indexOf('--prusya') < 0 || css.indexOf('.antet') < 0)
    throw new Error('Şablondan çıkarılan <style> bloğu rapor kozmetiği değil.');
  return css;
}

// Rapor varlıkları (şablon + font/KaTeX) talep üzerine yüklenir. Yükleyici
// cp-fead-report.js'te (`_frEnsureAssets`) ve TEK KOPYA olarak orada kalıyor:
// iki yükleyici tutmak, ikisinin `finished` mandalının ayrışması demekti
// (o dosyada belgelenmiş bir tuzak — sayaç döngüden önce kurulur).
function veGuideEnsureAssets(cb){
  if(typeof window !== 'undefined' && window.FEAD_REPORT_TEMPLATE_B64
     && window.MNT_REPORT_ASSETS){ cb(true); return; }
  if(typeof _frEnsureAssets === 'function'){ _frEnsureAssets(cb); return; }
  cb(false);
}

// Kılavuz belgesinin tam HTML'i. Raporun iskeletiyle aynı: <head> içinde
// font CSS + rapor kozmetiği, <body> içinde tek `.page` kabı.
//
// KaTeX GEÇMİYOR ve bu bilinçli: kılavuzda denklem yok. Özet raporun aynı
// kararı belge boyunu 944 KB'tan 340 KB'a indiriyor.
function veGuideDocHTML(o){
  if(typeof window === 'undefined' || !window.FEAD_REPORT_TEMPLATE_B64
     || !window.MNT_REPORT_ASSETS)
    throw new Error('Rapor varlıkları yüklenmedi.');
  var tpl = decodeURIComponent(escape(atob(window.FEAD_REPORT_TEMPLATE_B64)));
  var css = _gkReportCss(tpl);
  var fonts = window.MNT_REPORT_ASSETS.fontsCss || '';
  return '<!DOCTYPE html>\n<html lang="tr">\n<head>\n<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    + '<title>' + _gkEsc(o.title) + '</title>\n'
    + '<style>' + fonts + '</style>\n'
    + '<style>' + css + '</style>\n'
    + (o.extraCss ? '<style>' + o.extraCss + '</style>\n' : '')
    + '</head>\n<body>\n<div class="page">\n'
    + (o.body || '')
    + '\n</div>\n</body>\n</html>';
}

// ── SAHNE — PROGRAMIN BİLEŞENİ, BELGENİN İÇİNDE ────────────────────────────
//
// "Şu düğmeye bas" derken düğmenin RESMİ değil KENDİSİ konur: kılavuz üretim
// anında gerçek üreticiyi çağırır (`veFeadTableCardHTML`, `veRibbonItemHTML`,
// `getFead*PropertiesHTML`) ve çıkan HTML'i belgeye gömer.
//
// GEREKÇE §14'ÜN GEREKÇESİYLE AYNI. Ekran görüntüsü gömülseydi düğme
// değiştiğinde resim sessizce yalan söylerdi ve hiçbir test bunu göremezdi.
// Kılavuzun METNİ tam olarak böyle eskidi: kasnak kutuları kalktı, kılavuz
// onları anlatmaya devam etti, 43 kapının hiçbiri kırmızıya dönmedi. Bir resim
// metinden daha da sessiz eskir.
//
// SÖZLEŞME YENİ DEĞİL — RAPORUNKİ. Rapor, uygulamanın çizdiği kayış yolu
// şemasını `<figure class="appfig">` içine koyuyor ve uygulamanın jetonlarını
// o sınıf altında BASKI paletine bağlıyor. Sahneler aynı sınıfı kullanır;
// ikinci bir kabuk sınıfı açmak, aynı sorunun iki çözümü demekti (ve raporun
// "arayüz jetonu .appfig dışına sızmasın" kapısı zaten o ayrımı bekliyor).
//
// CSS KOPYALANMAZ, ÇALIŞAN SAYFADAN SÖKÜLÜR. Bileşenin kuralları
// `document.styleSheets`ten okunur; ikinci bir kopya tutmak bir tema
// rötuşunda kılavuzun sessizce ayrışması demekti — `_gkReportCss`'in kozmetik
// için kurduğu kuralın aynısı.

// Sahnenin çizilmesi için gereken kural önekleri — TEK LİSTE.
var VE_GUIDE_SCENE_SEL = [
  '.ve-fead-tbl',      // Kayış Tablosu
  '.ve-rb-btn',        // şerit düğmesi
  '.ve-rb-ico',
  '.ve-rb-lbl',
  '.mf-ico',           // ikon maskeleri
  '.sw-panel'          // panel kabuğu
];

// ARAYÜZ JETONLARININ BASKI KARŞILIĞI. Rapor şablonu `.appfig` altında on bir
// jeton bağlıyor; sahnelenen bileşenler daha fazlasını istiyor ve eksikler
// burada tamamlanıyor. YALNIZ EKSİKLER: raporun tanımladığı bir jetonu ikinci
// kez yazmak, aynı bileşenin iki belgede farklı renkte çizilmesi demekti —
// `veGuideSceneCSS` bu yüzden çakışanı atıyor, listeye bakıp varsaymıyor.
//
// Değerler baskı paletinden türer (rapor: --ink #1b1e24, --line #c9cdd3,
// --prusya #24425f). Belge DURGUN: geçiş süresi 0, gölge ve odak halkası yok —
// kâğıtta karşılığı olmayan şeyler.
var VE_GUIDE_APPFIG_TOKENS = {
  '--bg-primary': '#fff', '--bg-secondary': '#fbfbfc', '--bg-tertiary': '#f2f4f7',
  '--text-primary': '#1b1e24', '--text-heading': '#12161f',
  '--border-light': '#d8dce2', '--border-subtle': '#e4e6e9', '--border-hover': '#b4bbc4',
  '--font-mono': "'IBM Plex Mono',ui-monospace,monospace",
  '--fs-body': '11px', '--fs-md': '12px', '--fs-lg': '13px', '--fs-h2': '15px',
  '--radius-md': '3px', '--tracking-wide': '.04em',
  '--ink-accent': '#24425f', '--ink-success': '#2e7d4f',
  '--ink-warning': '#c8781e', '--ink-danger': '#a8321f',
  '--on-accent': '#fff', '--on-danger': '#fff',
  '--accent-tint-6': 'rgba(36,66,95,.06)',  '--accent-tint-8': 'rgba(36,66,95,.08)',
  '--accent-tint-10': 'rgba(36,66,95,.10)', '--accent-tint-12': 'rgba(36,66,95,.12)',
  '--accent-tint-15': 'rgba(36,66,95,.15)', '--accent-tint-22': 'rgba(36,66,95,.22)',
  '--accent-tint-35': 'rgba(36,66,95,.35)',
  '--dur-fast': '0s', '--shadow-lg': 'none', '--focus-ring': 'transparent',
  '--shadow-color': 'transparent',
  '--ribbon-strip-h': 'auto', '--ribbon-expanded-h': 'auto'
};

// Tema bloğu ÇAPASI — bugün yalnız denetim için okunuyor (baskı paleti
// kullanıldığı için ekran renkleri belgeye girmiyor). `:root {` diye
// körlemesine aramak YANLIŞ BLOĞU alıyor: styles.css'te başka bir `:root`
// daha var ve ondan çıkan sahne renksiz çiziliyordu (ölçüldü).
var _GK_THEME_RE = /:root\s*,\s*\[data-theme\s*=\s*["']?slate["']?\]/;

// Çalışan sayfadaki CSS metni. İki kaynak, çünkü iki dağıtım biçimi var: tek
// dosya build'inde CSS satır içi <style>, modüler index.html'de <link>.
function _gkStyleText(){
  if(typeof document === 'undefined') return '';
  var parts = [], i, j;
  var st = document.getElementsByTagName('style');
  for(i = 0; i < st.length; i++) parts.push(st[i].textContent || '');
  var sheets = document.styleSheets || [];
  for(i = 0; i < sheets.length; i++){
    var node = sheets[i].ownerNode;
    if(node && node.tagName === 'STYLE') continue;   // yukarıda alındı
    var rules = null;
    // file:// üzerinde <link> sayfasının kuralları SecurityError atabilir.
    try { rules = sheets[i].cssRules; } catch(e){ rules = null; }
    if(!rules) continue;
    var buf = [];
    for(j = 0; j < rules.length; j++) buf.push(rules[j].cssText);
    parts.push(buf.join('\n'));
  }
  return parts.join('\n');
}

// ÜST SEVİYE kuralları topla — @media / @supports İÇİNE GİRME.
//
// Naif bir "selector{...}" taraması iç içe blokları düzleştirir ve dar ekran
// kuralını her ekrana uygulanır hâle getirir: `.ve-rb` kurallarının bir kısmı
// `@media (max-width:900px)` içinde ve o hoisting sessizce yanlış bir düğme
// çizerdi. Bu yüzden derinlik sayılıyor.
function _gkTopRules(css, prefixes){
  // YORUMLAR ÖNCE SİLİNİR. Bu deponun CSS'i yoğun yorumlu ve beşi süslü
  // parantez taşıyor (`[hidden]{display:none}` gibi kod alıntıları). Yorum
  // silinmezse parantez sayacı kayıyor ve ONDAN SONRAKİ kurallar sessizce
  // düşüyor — ölçüldü: 58 seçicinin 20'si kayboldu, tablo künye şeridi
  // bitişik, birim satırları yan yana çizildi. Belge yine üretilmişti.
  css = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');
  var out = [], i = 0, n = css.length;
  while(i < n){
    var ac = css.indexOf('{', i);
    if(ac < 0) break;
    var sel = css.slice(i, ac).trim();
    if(sel.charAt(0) === '@'){            // @-bloğunun gövdesini komple atla
      var d = 1, k = ac + 1;
      while(k < n && d > 0){
        if(css.charAt(k) === '{') d++;
        else if(css.charAt(k) === '}') d--;
        k++;
      }
      i = k; continue;
    }
    var kap = css.indexOf('}', ac);
    if(kap < 0) break;
    for(var p = 0; p < prefixes.length; p++){
      if(sel.indexOf(prefixes[p]) === 0){
        out.push({ sel: sel, body: css.slice(ac + 1, kap) });
        break;
      }
    }
    i = kap + 1;
  }
  return out;
}

// Kuralı `.appfig` altına KAPSA — virgüllü listenin her parçası ayrı ayrı.
// Kapsanmasaydı uygulamanın kuralları belgenin kendi gövdesine de uygulanır,
// jetonlar orada tanımsız olduğu için "invalid at computed-value time" olurdu.
function _gkScopeRule(r){
  var sel = r.sel.split(',').map(function(x){
    return '.appfig ' + x.trim();
  }).join(', ');
  return sel + '{' + r.body + '}';
}

// Tema jetonları — çapalı, ve ÇAPA TUTSA BİLE İÇERİK DENETLENİR.
function _gkThemeVars(css){
  var m = _GK_THEME_RE.exec(css);
  if(!m) return null;
  var ac = css.indexOf('{', m.index);
  var kap = (ac < 0) ? -1 : css.indexOf('}', ac);
  if(ac < 0 || kap < 0) return null;
  var govde = css.slice(ac + 1, kap);
  if(govde.indexOf('--bg-secondary') < 0 || govde.indexOf('--accent-primary') < 0)
    return null;
  return govde;
}

// Sahne kurallarının kullandığı ama NE raporun `.appfig`inde NE de yukarıdaki
// tabloda karşılığı olan jetonlar. Boş olmak zorunda; kapı bunu ölçüyor.
//
// Belge ÜRETİLMEYE DEVAM EDER — eksik bir jetonun bedeli soluk bir renk, yanlış
// bir sayı değil. Sessiz-yanlış doktrini sayılar içindir; burada gürültü
// testte çıkar, kullanıcının elinde kılavuzsuz kalmasıyla değil.
function veGuideSceneMissingTokens(reportCss){
  if(reportCss === undefined) reportCss = _gkReportCssNow();
  var rules = _gkTopRules(_gkStyleText(), VE_GUIDE_SCENE_SEL);
  var metin = rules.map(function(r){ return r.body; }).join('\n');
  var kul = metin.match(/var\((--[a-z0-9-]+)/g) || [];
  var rap = String(reportCss || '');
  var eksik = [];
  kul.forEach(function(v){
    var ad = v.slice(4);
    if(VE_GUIDE_APPFIG_TOKENS[ad]) return;
    if(rap.indexOf(ad + ':') >= 0) return;
    if(eksik.indexOf(ad) < 0) eksik.push(ad);
  });
  return eksik.sort();
}

// Sahnenin CSS'i. SESSİZCE BOŞ DÖNMEZ: kural bulunamazsa sahne çizilir ama
// bambaşka görünür — raporun kozmetik kapısındaki gerekçenin aynısı.
// Raporun kozmetiğini ÇALIŞMA ANINDA çöz — hangi jetonları zaten bağladığını
// bilmeden "eksik" diye bir şey yazmak, ikinci bir tanım demekti.
function _gkReportCssNow(){
  if(typeof window === 'undefined' || !window.FEAD_REPORT_TEMPLATE_B64) return '';
  try {
    return _gkReportCss(decodeURIComponent(escape(atob(window.FEAD_REPORT_TEMPLATE_B64))));
  } catch(e){ return ''; }
}

function veGuideSceneCSS(reportCss){
  if(reportCss === undefined) reportCss = _gkReportCssNow();
  var rules = _gkTopRules(_gkStyleText(), VE_GUIDE_SCENE_SEL);
  if(!rules.length)
    throw new Error('Sahne bileşen kuralları bulunamadı ('
      + VE_GUIDE_SCENE_SEL.join(' ') + ') — kılavuz programın kendi '
      + 'görünümüyle çizilemez.');
  var rap = String(reportCss || '');
  var jet = '';
  Object.keys(VE_GUIDE_APPFIG_TOKENS).forEach(function(ad){
    if(rap.indexOf(ad + ':') >= 0) return;      // rapor zaten bağlamış
    jet += ad + ':' + VE_GUIDE_APPFIG_TOKENS[ad] + ';';
  });
  return (jet ? '.appfig{' + jet + '}\n' : '')
    + '.appfig .gk-sahne{border:1px solid var(--line); background:var(--paper);'
    + ' padding:10px 12px; overflow-x:auto; text-align:left;'
    + ' font-family:system-ui,-apple-system,"Segoe UI",sans-serif;'
    + ' color:var(--text-primary); line-height:1.45;}\n'
    + '.appfig .gk-sahne *{box-sizing:border-box;}\n'
    + '.appfig .gk-sahne button, .appfig .gk-sahne select,'
    + ' .appfig .gk-sahne input{cursor:default;}\n'
    + '.gk-cip{display:inline-flex; vertical-align:middle; margin:0 2px;'
    + ' line-height:normal;}\n'
    + '.gk-cip button{cursor:default; pointer-events:none;}\n'
    + rules.map(_gkScopeRule).join('\n');
}

// Sayfanın içerik genişliği — raporun kendi `.page` kuralından. İkinci bir
// sabit yazmak, sayfa ölçüsü değiştiğinde sahnelerin sessizce taşması demekti.
function _gkPageWidth(){
  var css = _gkReportCssNow();
  var m = /\.page\{[^}]*max-width\s*:\s*(\d+)px[^}]*\}/.exec(css);
  if(!m) return 0;
  var tam = Number(m[1]);
  var p = /\.page\{[^}]*padding\s*:\s*\d+px\s+(\d+)px/.exec(css);
  var yan = p ? Number(p[1]) : 0;
  return tam - 2 * yan;
}

// Sahnenin DOĞAL genişliği — üretilen HTML'in kendi `<colgroup>` ölçülerinden.
//
// Bir global'e (`VE_FEAD_TABLE_W`) bakmak iki sebeple yanlıştı: kılavuz modül
// kapsamından o adı göremiyor (ölçüldü — ölçekleme sessizce hiç uygulanmadı),
// ve gördüğü hâlde bile o sayı KUTUNUN ölçüsü, tablonun değil. Sütun
// genişlikleri veri olarak zaten HTML'de duruyor; sütun eklenince bu sayı
// kendiliğinden değişir.
function _gkNaturalWidth(html){
  var m = String(html || '').match(/<col[^>]*width\s*:\s*(\d+(?:\.\d+)?)px/g);
  if(!m || !m.length) return 0;
  var t = 0;
  m.forEach(function(x){
    var v = /(\d+(?:\.\d+)?)px/.exec(x);
    if(v) t += Number(v[1]);
  });
  // Kartın kendi payı: kenarlıklar ve hücre boşluğu. Ölçü sütunlardan gelir,
  // bu yalnız onun etrafındaki çerçeve.
  return t ? t + 26 : 0;
}

// CÜMLE İÇİNDE DÜĞME. Sahne bir figürdür ve okuma akışını böler; "şeritteki
// şu düğmeye bas" derken düğmenin kendisi CÜMLENİN İÇİNDE durmalı.
//
// `appfig` sınıfı burada da kullanılıyor ve bu bilinçli: o sınıf raporun
// şablonunda YALNIZ jeton bağlıyor (kutu/kenar stili taşımıyor), dolayısıyla
// satır içi bir kabuğa da takılabiliyor. İkinci bir jeton kabuğu açmak, aynı
// paletin iki yerden tanımlanması demekti.
function veGuideBtn(html){
  if(!html) return '';
  return '<span class="appfig gk-cip">' + html + '</span>';
}

// Şekil sayacı — elle "Şekil 3" yazmak, araya bir sahne girdiğinde sessizce
// kayardı (raporun tablo sayacındaki kuralın aynısı).
var _gkSahneNo = 0;
function veGuideSceneReset(){ _gkSahneNo = 0; }
function veGuideSceneCount(){ return _gkSahneNo; }

// Bir bileşeni sahneye koy. `html` programın ÜRETİCİSİNDEN gelir; buraya elle
// yazılmış bir kopya konursa sahnenin bütün gerekçesi düşer.
//
// Kabuk raporun şekil kalıbıyla birebir: `<figure class="appfig">` +
// `<figcaption><b>Şekil N —</b> …`.
function veGuideScene(html, altyazi, dogalEn){
  if(!html) return '';
  _gkSahneNo++;
  // SIĞMAYAN İÇERİK ÖLÇEKLENİR, KIRPILMAZ. Kayış Tablosu doğal hâlinde
  // sayfadan geniş; yatay kaydırma ekranda çare, BASKIDA değil — A4'e basılan
  // belgede sağdaki sütunlar kaybolurdu. Oran sayfanın kendi genişliğinden
  // türer (rapor şablonundan sökülür), elle ayarlanmaz.
  var stil = '';
  var en = Number(dogalEn);
  if(!Number.isFinite(en) || en <= 0) en = _gkNaturalWidth(html);
  if(Number.isFinite(en) && en > 0){
    var sayfa = _gkPageWidth();
    if(sayfa > 0 && en > sayfa)
      stil = ' style="zoom:' + (Math.floor(sayfa / en * 100) / 100) + '"';
  }
  return '<figure class="appfig"><div class="gk-sahne" data-gk-sahne="'
    + _gkSahneNo + '"' + stil + '>' + html + '</div>'
    + '<figcaption><b>Şekil ' + _gkSahneNo + ' —</b> ' + (altyazi || '')
    + '</figcaption></figure>';
}

// ── ANTET · İÇİNDEKİLER · BÖLÜM — raporun kalıbıyla ────────────────────────
// Üçü de raporun `.antet` / `.toc` / `h2 .no` yapısını birebir kullanır; tek
// fark alan adlarıdır. Kılavuza özgü bir yapı icat etmek, "aynı kozmetik"
// isteğini yüzeyde tutup iskelette bozmak olurdu.

function veGuideAntet(o){
  var h = '<div class="antet">';
  h += '<div class="band">';
  h += '<div class="eyebrow">' + _gkEsc(o.eyebrow || 'MFSim · Kullanım Kılavuzu') + '</div>';
  h += '<h1>' + _gkEsc(o.h1) + '</h1>';
  h += '<div class="sub">' + _gkEsc(o.sub) + '</div>';
  h += '</div>';
  h += '<div class="fields">';
  (o.fields || []).forEach(function(f){
    h += '<div class="f"><div class="k">' + _gkEsc(f[0]) + '</div><div class="v">'
       + _gkEsc(f[1]) + '</div></div>';
  });
  h += '</div></div>';
  return h;
}

function veGuideToc(satirlar){
  var h = '<div class="toc">';
  satirlar.forEach(function(s){
    h += '<a href="#' + _gkEsc(s[0]) + '"><span class="n">' + _gkEsc(s[1]) + '</span>'
       + _gkEsc(s[2]) + '</a>';
  });
  return h + '</div>';
}

function veGuideH2(id, no, baslik){
  return '<h2 id="' + _gkEsc(id) + '"><span class="no">' + _gkEsc(no) + '</span>'
       + _gkEsc(baslik) + '</h2>';
}

// Not kutusu — raporun `.note` / `.note.warn` / `.note.check` bileşeni.
// `govde` HAM HTML'dir (kalın, kod, listeler geçsin diye); çağıranın kaçışı
// kendisi yapması gerekir.
function veGuideNote(tur, baslik, govde){
  var cls = 'note' + (tur ? ' ' + tur : '');
  return '<div class="' + cls + '"><span class="t">' + _gkEsc(baslik) + '</span>'
       + govde + '</div>';
}

// ── PENCERE (şeritten açılır) ──────────────────────────────────────────────
// Kabuk sınıfları `.ve-help-*` — Klavye Kısayolları penceresiyle AYNI. İkinci
// bir pencere stili yazmak css/styles.css'e dokunmak demekti; o dosyaya
// dokunmak Ölçüm Görüntüleyici'nin dağıtım dosyasını bayatlatıyor (CLAUDE.md).
// Kart içleri satır içi stille, FEAD rozetlerindeki kuralın aynısı.

var _gkBuilt = false;

function _gkKart(k){
  var hazir = veGuideKitReady(k);
  var kenar = hazir ? 'var(--accent-primary)' : 'var(--border-color)';
  var h = '<div style="border:1px solid var(--border-color); border-left:3px solid '
    + kenar + '; background:var(--bg-primary); padding:12px 14px; display:flex; '
    + 'flex-direction:column; gap:8px;">';
  h += '<div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;">'
     + '<b style="font-size:var(--fs-body); color:var(--text-primary);">' + _gkEsc(k.modul) + '</b>'
     + '<span style="font-family:ui-monospace,monospace; font-size:var(--fs-micro); '
     + 'letter-spacing:.08em; text-transform:uppercase; padding:1px 6px; border-radius:3px; '
     + (hazir
        ? 'background:rgba(16,185,129,.14); color:var(--accent-success);">HAZIR'
        : 'background:var(--bg-tertiary); color:var(--text-muted);">HAZIRLANIYOR')
     + '</span></div>';
  h += '<div style="font-size:var(--fs-micro); line-height:1.5; color:var(--text-muted);">'
     + _gkEsc(k.ozet) + '</div>';
  if(hazir){
    h += '<div style="display:flex; gap:6px; margin-top:2px;">'
      + '<button type="button" onclick="veGuideOpen(\'' + _gkEsc(k.id) + '\')" '
      + 'style="flex:2; padding:7px 10px; font-size:var(--fs-micro); font-weight:600; '
      + 'border:none; cursor:pointer; background:var(--accent-primary); color:#fff;">Aç</button>'
      + '<button type="button" onclick="veGuideDownload(\'' + _gkEsc(k.id) + '\')" '
      + 'style="flex:1; padding:7px 10px; font-size:var(--fs-micro); font-weight:600; '
      + 'border:1px solid var(--border-color); cursor:pointer; background:var(--bg-tertiary); '
      + 'color:var(--text-primary);">İndir</button></div>';
  } else {
    h += '<div style="font-size:var(--fs-micro); color:var(--text-muted); '
      + 'font-style:italic; margin-top:2px;">Bu modülün kılavuzu henüz yazılmadı.</div>';
  }
  return h + '</div>';
}

function _gkBuild(){
  if(_gkBuilt) return;
  var ov = document.createElement('div');
  ov.className = 've-help-overlay';
  ov.id = 've-guide-kit';
  ov.setAttribute('hidden', '');
  ov.innerHTML =
    '<div class="ve-help-panel" role="dialog" aria-modal="true" aria-label="Kullanım kılavuzları">'
    + '<div class="ve-help-head"><h3>Kullanım Kılavuzları</h3>'
    + '<button class="ve-help-close" type="button" title="Kapat (Esc)" aria-label="Kapat" '
    + 'onclick="veGuideKitClose()">'
    + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" '
    + 'stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/>'
    + '<line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>'
    + '<div class="ve-help-body" id="ve-guide-kit-body"></div>'
    + '<div class="ve-help-foot"><span id="ve-guide-kit-foot"></span>'
    + '<span class="ve-help-brand">MFSim</span></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('mousedown', function(e){ if(e.target === ov) veGuideKitClose(); });
  _gkBuilt = true;
}

// Gövde HER AÇILIŞTA yeniden çizilir, kurulumda bir kez değil: bir kılavuz
// üreticisi sonradan yüklenirse (ya da ileride eklenirse) pencere onu görsün.
function _gkRender(){
  var b = document.getElementById('ve-guide-kit-body');
  if(!b) return;
  b.innerHTML = VE_GUIDE_KIT.map(_gkKart).join('');
  var f = document.getElementById('ve-guide-kit-foot');
  if(f){
    var n = veGuideKitCount();
    f.textContent = n + ' / ' + VE_GUIDE_KIT.length + ' kılavuz hazır · belge '
      + 'çevrimdışı açılan tek dosyadır';
  }
}

function veGuideKitOpen(){
  _gkBuild();
  _gkRender();
  var ov = document.getElementById('ve-guide-kit');
  if(!ov) return;
  ov.removeAttribute('hidden');
  void ov.offsetWidth;
  ov.classList.add('open');
}

function veGuideKitClose(){
  var ov = document.getElementById('ve-guide-kit');
  if(!ov || !ov.classList.contains('open')) return;
  ov.classList.remove('open');
  setTimeout(function(){
    if(ov && !ov.classList.contains('open')) ov.setAttribute('hidden', '');
  }, 200);
}

// ── ÜRETİM · AÇMA · İNDİRME ────────────────────────────────────────────────

function _gkStatus(msg, tur){
  if(typeof showToast === 'function') showToast(msg, tur || 'info');
}

// Belgeyi kur. Varlıklar yüklü değilse önce onları getirir (ilk çağrıda ~1 MB
// font); `cb(html | null)`.
function veGuideBuild(id, cb){
  var k = veGuideKitOf(id);
  if(!k){ _gkStatus('Kılavuz bulunamadı: ' + id, 'error'); cb(null); return; }
  if(!veGuideKitReady(k)){
    _gkStatus(k.modul + ' kılavuzu henüz hazır değil.', 'warning'); cb(null); return;
  }
  _gkStatus('Kılavuz hazırlanıyor…');
  veGuideEnsureAssets(function(ok){
    if(!ok){ _gkStatus('Kılavuz varlıkları yüklenemedi.', 'error'); cb(null); return; }
    var html;
    try { html = window[k.uret](); }
    catch(e){
      _gkStatus('Kılavuz üretilemedi: ' + (e && e.message ? e.message : e), 'error');
      cb(null); return;
    }
    cb(html);
  });
}

// AÇ — yeni sekmede. Blob URL'i tarayıcı engellerse (açılır pencere engelleyici,
// bazı file:// yapılandırmaları) SESSİZ KALMAZ: indirmeye düşer ve bunu söyler.
// "Tıkladım, hiçbir şey olmadı" bu depoda kabul edilmeyen bir sonuç.
function veGuideOpen(id){
  veGuideBuild(id, function(html){
    if(!html) return;
    var k = veGuideKitOf(id);
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var w = null;
    try { w = window.open(url, '_blank'); } catch(e){ w = null; }
    if(!w){
      URL.revokeObjectURL(url);
      _gkStatus('Yeni sekme açılamadı — kılavuz indiriliyor.', 'warning');
      _gkDownload(html, k);
      return;
    }
    // Sekme belgeyi okuyana kadar URL yaşamalı; erken revoke boş sayfa verir.
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    _gkStatus(k.modul + ' kılavuzu açıldı.', 'success');
    veGuideKitClose();
  });
}

function veGuideDownload(id){
  veGuideBuild(id, function(html){
    if(!html) return;
    _gkDownload(html, veGuideKitOf(id));
  });
}

function _gkDownload(html, k){
  var ad = (k && k.dosya) || 'MFSim_Kullanim_Kilavuzu';
  var damga = (typeof _frDateStamp === 'function') ? _frDateStamp() : '';
  var dosya = ad + (damga ? '_' + damga : '') + '.html';
  if(typeof _frDownload === 'function'){ _frDownload(html, dosya); }
  else {
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = dosya;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
  }
  _gkStatus('Kılavuz indirildi (' + Math.round(html.length / 1024) + ' KB).', 'success');
}

// Esc ile kapat — Klavye Kısayolları penceresinin kuralının aynısı.
if(typeof document !== 'undefined' && typeof document.addEventListener === 'function'){
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    var ov = document.getElementById('ve-guide-kit');
    if(ov && ov.classList.contains('open')){ e.preventDefault(); veGuideKitClose(); }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_GUIDE_KIT: VE_GUIDE_KIT,
    veGuideKitOf: veGuideKitOf, veGuideKitReady: veGuideKitReady,
    veGuideKitCount: veGuideKitCount,
    VE_GUIDE_SCOPE_MAP: VE_GUIDE_SCOPE_MAP, veGuideCurrentId: veGuideCurrentId,
    _gkEsc: _gkEsc, _gkReportCss: _gkReportCss,
    veGuideDocHTML: veGuideDocHTML, veGuideAntet: veGuideAntet,
    veGuideToc: veGuideToc, veGuideH2: veGuideH2, veGuideNote: veGuideNote,
    // ÜRETİLEN YÜZEY de dışa açılıyor: bu depoda tekrar eden ders, kapının
    // üreticiyi değil ÜRETİLEN ŞEYİ ölçmesi gerektiği. Kartın "hazırlanıyor"
    // dalını ve pencerenin gövdesini ancak buradan görebilir.
    _gkKart: _gkKart, _gkRender: _gkRender, veGuideBuild: veGuideBuild,
    veGuideKitOpen: veGuideKitOpen, veGuideKitClose: veGuideKitClose,
    veGuideOpenCurrent: veGuideOpenCurrent,
    VE_GUIDE_SCENE_SEL: VE_GUIDE_SCENE_SEL,
    VE_GUIDE_APPFIG_TOKENS: VE_GUIDE_APPFIG_TOKENS,
    _gkStyleText: _gkStyleText, _gkTopRules: _gkTopRules, _gkThemeVars: _gkThemeVars,
    _gkScopeRule: _gkScopeRule, _gkReportCssNow: _gkReportCssNow,
    _gkPageWidth: _gkPageWidth, _gkNaturalWidth: _gkNaturalWidth,
    veGuideSceneCSS: veGuideSceneCSS, veGuideScene: veGuideScene,
    veGuideSceneReset: veGuideSceneReset, veGuideSceneCount: veGuideSceneCount,
    veGuideBtn: veGuideBtn,
    veGuideSceneMissingTokens: veGuideSceneMissingTokens
  };
}
