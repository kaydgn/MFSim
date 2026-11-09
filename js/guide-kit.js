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
//
// Kayıt açıklama alanı TAŞIMAZ: kart yalnız kılavuzun adını ve durumunu basar
// (CLAUDE.md → ARAYÜZ ANLATMAZ: kalıp açıklama yuvası açmaz).
var VE_GUIDE_KIT = [
  {
    id: 'fead',
    modul: 'FEAD',
    baslik: 'FEAD — Kayış-kasnak sistemi',
    uret: 'veGuideFeadHTML',
    dosya: 'MFSim_FEAD_Kullanim_Kilavuzu'
  },
  {
    id: 'arac',
    modul: 'Araç Performans',
    baslik: 'Araç Performans — Güç aktarma zinciri',
    uret: 'veGuideAracHTML',
    dosya: 'MFSim_Arac_Performans_Kullanim_Kilavuzu'
  },
  {
    id: 'mount',
    modul: 'Takoz Çökme-Titreşim',
    baslik: 'Takoz — Çökme ve titreşim analizi',
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
  if(css.indexOf('--vurgu') < 0 || css.indexOf('.antet') < 0)
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
  // Kılavuzun gerek duyduğu tek varlık raporun ŞABLONU (kozmetik bloğu
  // oradan kopyalanıyor). Yüz artık rapor paketinden değil ARAYÜZÜN kendi
  // @font-face kurallarından geliyor (js/theme.js → veThemeFontFaceCss).
  if(typeof window === 'undefined' || !window.FEAD_REPORT_TEMPLATE_B64)
    throw new Error('Rapor varlıkları yüklenmedi.');
  var tpl = decodeURIComponent(escape(atob(window.FEAD_REPORT_TEMPLATE_B64)));
  var css = _gkReportCss(tpl);
  var fonts = (typeof veThemeFontFaceCss === 'function') ? veThemeFontFaceCss() : '';
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
  '.ve-fead-tbl',      // Kayış Tablosu'nun denetimleri (alan · ad düğmesi · oklar)
  '.ve-fead-pf',       // Kayış Tablosu = PAFTA (başlık şeridi · tablo · satır · numara)
  '.ve-fead-ek',       // paftanın kasnak ekleyicisi (liste — FEAD'de sütun yok, 2026-09-28)
  '.ve-fead-pafta',    // (paftanın kabı — kartın altındaki bölge)
  '.ve-fead-layout',   // Kayış Yolu kartının kabuğu (çubuk bandının jetonu)
  '.ve-fp-',           // FEAD pencerelerinin ortak dili
  '.ve-pnl-tbl',       // panel veri tablosu — çözücünün çevrim ızgarası (2026-09-23)
  '.ve-fead-kat',      // kanvasın Katmanlar paneli
  '.ve-fead-kan',      // Kayış Yolu kartının kabuğu + durum rozeti
  '.ve-fead-yuz',      // çizimin üstünde yüzen denetim çubuğu
  '.ve-fead-hit',      // çizimin isabet halkaları (Çizim Masası) — baskıda görünmez
  '.ve-fead-not',      // panel açıklama satırı
  '.ve-fead-arac',     // FEAD araçları penceresi (2026-09-28 — araç kutularının yerine)
  '.ve-settings-header', // (pencere ailesinin başlığı — araç penceresi onu taşıyor)
  '.ve-fr-chip',       // sonuç durumu çipi (araç penceresinin Çözüm bölümü)
  '.ve-fr-kpi',        // Sonuçlar sekmesinin özet kartları (js/cp-fead-results.js)
  '.ve-fr-nw',         // (kartın bölünmeyen sayı öbeği)
  '.ve-durum',         // durum ikonu (gergi tarafı hükmü)
  '.ve-rb-btn',        // şerit düğmesi
  '.ve-rb-group-items',// düğmenin sarmalı (yerleşim)
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
// Değerler BASKI paletinden türer (rapor: --ink #1f2328, --line #c5cbd3,
// --vurgu #1747b0) — ekran paletinden DEĞİL. Şekiller kâğıda basılıyor: zemin
// beyaz kalır, griler Çalışma masası paletinin soğuk eksenindedir. Belge DURGUN: geçiş
// süresi 0, gölge ve odak halkası yok — kâğıtta karşılığı olmayan şeyler.
var VE_GUIDE_APPFIG_TOKENS = {
  '--bg-primary': '#fff', '--bg-secondary': '#fbfcfd', '--bg-tertiary': '#eef1f4',
  '--text-primary': '#1f2328', '--text-heading': '#101418',
  '--border-light': '#d5dae1', '--border-hover': '#c5cbd3',
  '--font-mono': "'Inter',system-ui,sans-serif",   // tek yüz — belgede de (2026-09-23)
  '--fs-body': '11px', '--fs-md': '12px', '--fs-lg': '13px', '--fs-h2': '15px',
  // Sonuçlar sekmesinin özet kartı bu ikisini istiyor (`.ve-fr-kpi`):
  // ölçek BASKININ ölçeği, uygulamanın 1.5rem'i değil — sahne 11 px gövdede.
  '--fs-h1': '17px', '--space-2': '8px',
  '--radius-xs': '2px', '--radius-md': '3px', '--radius-pill': '999px', '--tracking-wide': '.04em',
  '--ink-accent': '#24425f', '--ink-success': '#2e7d4f',
  '--ink-warning': '#c8781e', '--ink-danger': '#a8321f',
  // ZEMİNİNİN EŞİ, ailenin varsayılanı DEĞİL: baskı paletinde amber
  // (--accent-warning #c8781e) üstünde beyaz 3,41:1, siyah 6,16:1; yeşilde
  // (#2e7d4f) tersi — beyaz 5,05:1, siyah 4,16:1.
  '--on-accent': '#fff', '--on-danger': '#fff',
  '--on-warning': '#000', '--on-success': '#fff',
  '--accent-tint-6': 'rgba(36,66,95,.06)',  '--accent-tint-8': 'rgba(36,66,95,.08)',
  '--accent-tint-10': 'rgba(36,66,95,.10)', '--accent-tint-12': 'rgba(36,66,95,.12)',
  '--accent-tint-15': 'rgba(36,66,95,.15)', '--accent-tint-20': 'rgba(36,66,95,.20)',
  '--accent-tint-22': 'rgba(36,66,95,.22)',
  '--accent-tint-35': 'rgba(36,66,95,.35)',
  // DURUM TONLARI — rapor penceresinin durum kutusu (Model çözüldü/çözülmedi).
  // Baskı yeşili #2e7d4f ve baskı kehribarı #c8781e'den, aksan tonlarının
  // kalıbıyla (.08 zemin · .15 kenar) — ekran paletinden DEĞİL.
  '--success-tint-8': 'rgba(46,125,79,.08)',  '--success-tint-15': 'rgba(46,125,79,.15)',
  '--warning-tint-8': 'rgba(200,120,30,.08)', '--warning-tint-15': 'rgba(200,120,30,.15)',
  '--danger-tint-8': 'rgba(168,50,31,.08)',   // baskı kırmızısı #a8321f — çevrim tablosunun sil düğmesi
  '--danger-tint-15': 'rgba(168,50,31,.15)',  // Dönüş Yönü hükmü (gergi gergin tarafta)
  '--dur-fast': '0s', '--shadow-lg': 'none', '--shadow-xl': 'none', '--focus-ring': 'transparent',
  // FEAD araçları penceresi (2026-09-28): pencere köşesi ve pencere ailesinin
  // başlık bandı — baskı ölçeğinde (köşe --radius-md'nin bir üstü; bant
  // ekrandaki ölçü, zemin baskı paletinin düz tonu).
  '--radius-lg': '4px', '--bant-h': '26px',
  '--bant-zemin': '#f6f8fa',
  '--shadow-color': 'transparent',
  '--ribbon-strip-h': 'auto',
  // Takoz kılavuzunun sahneleri (başlangıç sayfası, pencereler, aksonometrik
  // çizim, sihirbaz, 3B'nin panelleri) — 2026-11-09. Eksen renkleri programınki
  // (kırmızı X · yeşil Y · mavi Z, iki temada aynı); süreler 0 (belge durgun).
  '--accent-tint-60': 'rgba(36,66,95,.60)',
  '--dur-base': '0s', '--dur-enter': '0s', '--ease-out': 'linear',
  '--eksen-x': '#ef4444', '--eksen-y': '#22c55e', '--eksen-z': '#3b82f6',
  '--font-sans': "'Inter',system-ui,sans-serif",
  '--leading-tight': '1.25',
  '--mw3b-agac': '272px', '--mw3b-serit': '30px', '--mw3b-yan': '352px',
  '--scrim': 'transparent', '--shadow-md': 'none',
  '--z-canvas-ui': '40', '--z-modal': '4000',
  '--fs-hero': '20px', '--fw3b-kart': '360px', '--isik': '#ffffff', '--radius-xl': '0'
};

// Tema bloğu ÇAPASI — bugün yalnız denetim için okunuyor (baskı paleti
// kullanıldığı için ekran renkleri belgeye girmiyor). `:root {` diye
// körlemesine aramak YANLIŞ BLOĞU alıyor: styles.css'te başka bir `:root`
// daha var ve ondan çıkan sahne renksiz çiziliyordu (ölçüldü).
var _GK_THEME_RE = /:root\s*,\s*\[data-theme\s*=\s*["']?slate["']?\]/;

// Sahne kutusunun kendi payı: iki yandan 12 px dolgu + 1 px kenarlık.
// `veGuideSceneCSS`'teki `.gk-sahne` kuralıyla AYNI sayı olmak zorunda.
var _GK_SAHNE_CERCEVE = 26;
// İşaretli sahnede dolgu 18 × 20 px (`.gk-sahne--isaret`): kenardaki hedefin
// rozeti sahnenin kendi kaydırma kutusunda kırpılmasın.
var _GK_SAHNE_CERCEVE_ISARET = 42;

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
//
// `icerir` (ops.): seçicinin HERHANGİ bir yerinde geçen önekler. Kılavuzun
// kendi sahneleri için (`veGuideSceneCSS(_, ek)`): `table.ve-izgara td` ya da
// `.ve-fp-sect .ve-ak-zem` baştan eşleşmez ama sahnenin öğesini çizer. Kapsanan
// kural sahnede eşleşmeyen bir atayı (`.ve-node.selected …`) isterse hiçbir şeye
// uymaz — zararsız.
function _gkTopRules(css, prefixes, icerir){
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
    var al = false;
    for(var p = 0; p < prefixes.length && !al; p++){
      if(sel.indexOf(prefixes[p]) === 0) al = true;
    }
    for(var q = 0; icerir && q < icerir.length && !al; q++){
      if(sel.indexOf(icerir[q]) >= 0) al = true;
    }
    if(al) out.push({ sel: sel, body: css.slice(ac + 1, kap) });
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
function veGuideSceneMissingTokens(reportCss, ek){
  if(reportCss === undefined) reportCss = _gkReportCssNow();
  var rules = _gkTopRules(_gkStyleText(), VE_GUIDE_SCENE_SEL, ek);
  var metin = rules.map(function(r){ return r.body; }).join('\n');
  // `var(--x, yedek)` biçimi EKSİK SAYILMAZ: yedeğin kendisi tasarımın
  // cevabıdır — jeton tanımlanmamışsa kural yine çalışır. Yedeksiz kullanım
  // ise gerçekten karşılıksız kalır.
  var kul = (metin.match(/var\(\s*--[a-z0-9-]+\s*[,)]/g) || [])
    .filter(function(x){ return x.charAt(x.length - 1) === ')'; })
    .map(function(x){ return 'var(' + x.slice(4).replace(/[\s,)]+$/, ''); });
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

// `ek` (ops.): kılavuza özgü sahne önekleri — seçicinin herhangi bir yerinde
// aranır (`_gkTopRules` → `icerir`). Ortak liste değişmez: FEAD kılavuzunun
// sahneleri bugünkü kurallarla çizilmeye devam eder.
function veGuideSceneCSS(reportCss, ek){
  if(reportCss === undefined) reportCss = _gkReportCssNow();
  var rules = _gkTopRules(_gkStyleText(), VE_GUIDE_SCENE_SEL, ek);
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
    + ' font-family:\'Inter\',system-ui,-apple-system,"Segoe UI",sans-serif;'
    + ' color:var(--text-primary); line-height:1.45;}\n'
    + '.appfig .gk-sahne *{box-sizing:border-box;}\n'
    // MUTLAK KONUMLU PARÇA SAHNEDE AKIŞA DÖNER. Katman paneli kanvasın
    // üstünde yüzmek için `position:absolute`; sahnede saracak bir kutu yok,
    // akıştan çıkıyor ve şekil 22 px yüksekliğe çöküyordu (baskıda ölçüldü).
    // Belge bir ekran değil: parça, anlatıldığı yerde AKIŞTA durmalı.
    + '.appfig .gk-sahne > [class*="-kat"], .appfig .gk-sahne > [class*="-panel"]'
    + '{position:static !important; right:auto; bottom:auto; max-height:none;}\n'
    // TEK SIRALIK ŞERİTLER SARAR. Kanvas kartının alt şeridi (seçiciler +
    // özet) uygulamada bir satıra sığıyor; belgenin sütunu daha dar ve şerit
    // 48 px taşıyordu (baskıda ölçüldü — sağdaki özet kırpılıyordu). Sarmak
    // doğru çare: içerik aynı, yalnız iki satıra iniyor.
    // TEK SIRALIK ŞERİTLER SARAR, HÜCRELER DARALABİLİR. Kanvas kartının alt
    // şeridi uygulamada bir satıra sığıyor; belgenin sütunu daha dar ve özet
    // 48 px taşıyordu (baskıda ölçüldü — "Σsarım 360,0°" sağdan kırpılıyordu).
    // `min-width:0` olmadan esnek kutular içeriklerinden küçülemez, yani
    // sarma tek başına yetmiyor.
    + '.appfig .gk-sahne [style*="display:flex"]{flex-wrap:wrap;}\n'
    // `min-width:0` HER torunda: esnek kutunun çocuğu varsayılan
    // `min-width:auto` ile içeriğinden küçülemez. Satır içi stile bakan bir
    // seçici yetmiyordu — taşan span, `display:flex`i SINIFTAN alan bir
    // düğmenin içindeydi (baskıda ölçülerek bulundu).
    + '.appfig .gk-sahne *{min-width:0;}\n'
    // DÜĞME İÇERİĞİNE GÖRE GENİŞLER. Uygulamada kart yeniden boyutlanabiliyor
    // ve şerit düğmeleri sabit genişlikte duruyor; belgede kart sabit ve
    // düğmenin yazısı dışarı taşıyordu (26 px, baskıda ölçüldü). Belge
    // etkileşimsiz olduğu için düğmenin ölçüsünü korumanın karşılığı yok.
    + '.appfig .gk-sahne button{width:auto; flex:0 0 auto; white-space:nowrap;}\n'
    // ÖLÜ: fare hiçbir şeye ulaşmaz. `_gkFlatten` klavyeyi ve işleyicileri
    // kesiyor; bu da fareyi. İkisi birden olmadan biri açığı kapatmıyor.
    + '.appfig .gk-sahne, .appfig .gk-sahne *{pointer-events:none;}\n'
    + '.appfig .gk-sahne input, .appfig .gk-sahne select,'
    + ' .appfig .gk-sahne button, .appfig .gk-sahne textarea{cursor:default;}\n'
    + '.gk-cip{display:inline-flex; vertical-align:middle; margin:0 2px;'
    + ' line-height:normal; pointer-events:none;}\n'
    + '.gk-cip *{pointer-events:none;}\n'
    // BASKI: belge ÇIKTI ALINIP okunuyor (kullanıcı kararı). Şekil sayfaya
    // sığıyorsa bölünmez; sığmıyorsa bölünebilmek ZORUNDA — `break-inside:
    // avoid` sayfadan uzun bir şekli kendi sayfasına atar ve orada yine taşar,
    // yani alt kısmı hiç basılmaz. Kart boyutunda şekiller (veGuideCard) bu
    // yüzden tercih ediliyor; yine de uzun kalan olursa bölünsün.
    + '@media print{.appfig{break-inside:auto;}'
    + ' .appfig .gk-sahne{overflow:visible; break-inside:auto;}'
    + ' .appfig figcaption{break-before:avoid;}}\n'
    // İŞARETİN HEDEFİ konum kabı olur — programın KURALLARINDAN ÖNCE: hedef
    // programda mutlak konumluysa onun kuralı (sonra gelen, eşit seçicilik) kazanır.
    + '.appfig .gk-hedef{position:relative;}\n'
    + rules.map(_gkScopeRule).join('\n') + '\n'
    + _GK_ISARET_CSS;
}

// ── İŞARETLER — şeklin üstünde numara, altında lejant, metinde aynı numara ──
//
// Kullanıcı isteği (2026-11-09): *"kullanıcı kılavuzunu baştan sona okuyan
// birisi, programı açtığı andan itibaren ne yaptığını bilmeli … bol bol
// görseller ile, yönlendirmeler ile, işaretler ile kullanıcı hep
// bilgilendirilmeli."*
//
// İŞARET ÖĞEYE BAĞLANIR, KOORDİNATA DEĞİL. Rozet hedefin İÇİNDE mutlak konumlu
// durur: yazı tipi, sayfa genişliği ya da ölçek (`zoom`) hedefi kaydırırsa rozet
// onunla gider. Koordinat yazılsaydı her yerleşim rötuşunda numara boşluğa düşerdi.
//
// NUMARA DİZİDEKİ SIRADIR. Aynı dizi şeklin rozetlerini, lejantı ve metnin
// içindeki numarayı (`veGuideNo`) besler — üçü tek kaynaktan.
//
// BULUNAMAYAN HEDEF SESSİZ DEĞİL. Lejant satırı yine yazılır (metin bilgisini
// kaybetmez) ve kayıp `veGuideIsaretKayip()` listesine düşer; kılavuz testleri
// o listenin boş olduğunu ölçer — program değişip öğe kaybolunca kapı kırmızı.
//
// Hedef tanımı (biri yeter):
//   s      CSS seçici (ilk eşleşen; `sira` ile n'inci)
//   bolum  bileşen penceresinin bölüm başlığı (`.ve-fp-sect > b`) → bölümün kartı
//   metin  kendi yazısı tam bu olan en derin öğe (ops. `s` kapsamında)
//   ust    bulunan öğenin bu seçiciye uyan atası (yazıdaki düğme: `ust: 'button'`)
// Lejant: `ad` (kalın) · `not` (HTML). Rozetin yeri `yer`: sol (varsayılan) ·
// sag · ic · ic-sag · sol-orta · sag-orta · alt · alt-sag.
var VE_GUIDE_ISARET_YER = ['sol', 'sag', 'ic', 'ic-sag', 'sol-orta', 'sag-orta', 'alt', 'alt-sag'];

// Rozetin rengi belgenin kendi paletinde değil: programın vurgusu (mavi)
// zaten sahnenin içinde; işaret ondan ayrılmalı. Beyaz rakamla 5,2:1.
var _GK_ISARET_CSS =
    '.page{--gk-isaret:#c2410c; --gk-fs:10.5px; --gk-fs-metin:9.5px;}\n'
  + '.gk-no{display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box;'
  + ' width:18px; height:18px; border-radius:50%; background:var(--gk-isaret,#c2410c); color:#fff;'
  + ' font-family:\'Inter\',system-ui,-apple-system,"Segoe UI",sans-serif; font-weight:700;'
  + ' font-size:var(--gk-fs); line-height:1;'
  + ' font-variant-numeric:tabular-nums; letter-spacing:0; text-transform:none; white-space:nowrap;'
  + ' vertical-align:middle; -webkit-print-color-adjust:exact; print-color-adjust:exact;}\n'
  + '.gk-no--metin{width:16px; height:16px; font-size:var(--gk-fs-metin); margin:0 2px; vertical-align:1px;}\n'
  + '.appfig .gk-sahne--isaret{padding:18px 20px;}\n'
  + '.appfig .gk-sahne .gk-hedef{outline:2px solid var(--gk-isaret,#c2410c) !important;'
  + ' outline-offset:2px !important; overflow:visible !important;}\n'
  + '.appfig .gk-sahne .gk-hedef-ata{overflow:visible !important;}\n'
  + '.appfig .gk-sahne span.gk-no{position:absolute !important; z-index:40 !important;'
  + ' width:18px !important; height:18px !important; min-width:18px !important; margin:0 !important;'
  + ' padding:0 !important; border:0 !important; transform:none !important; opacity:1 !important;'
  + ' background:var(--gk-isaret,#c2410c) !important; color:#fff !important;'
  + ' font-family:\'Inter\',system-ui,sans-serif !important; font-weight:700 !important;'
  + ' font-size:var(--gk-fs) !important; line-height:18px !important; text-align:center !important;'
  + ' box-shadow:0 0 0 2px #fff !important; top:auto; left:auto; right:auto; bottom:auto;}\n'
  + '.appfig .gk-sahne .gk-no--sol{top:-13px !important; left:-13px !important;}\n'
  + '.appfig .gk-sahne .gk-no--sag{top:-13px !important; right:-13px !important;}\n'
  + '.appfig .gk-sahne .gk-no--ic{top:3px !important; left:3px !important;}\n'
  + '.appfig .gk-sahne .gk-no--ic-sag{top:3px !important; right:3px !important;}\n'
  + '.appfig .gk-sahne .gk-no--sol-orta{top:50% !important; left:-28px !important; margin-top:-9px !important;}\n'
  + '.appfig .gk-sahne .gk-no--sag-orta{top:50% !important; right:-28px !important; margin-top:-9px !important;}\n'
  + '.appfig .gk-sahne .gk-no--alt{bottom:-13px !important; left:-13px !important;}\n'
  + '.appfig .gk-sahne .gk-no--alt-sag{bottom:-13px !important; right:-13px !important;}\n'
  + '.gk-lejant{list-style:none; margin:10px 0 0; padding:0; display:grid;'
  + ' grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px 22px; text-align:left;'
  + ' font-size:var(--gk-fs); line-height:1.45;}\n'
  + '.gk-lejant--tek{grid-template-columns:minmax(0,1fr);}\n'
  + '.gk-lejant li{display:flex; gap:8px; align-items:flex-start; margin:0; padding:0; break-inside:avoid;}\n'
  + '.gk-lejant li > .gk-no{flex:0 0 18px; margin-top:-1px;}\n'
  + '.gk-lejant b{font-weight:600;}\n'
  + '.gk-ekran{position:relative; margin:0 auto; border:1px solid var(--line); line-height:0;}\n'
  + '.gk-ekran img{display:block; width:100%; height:auto;}\n'
  + '.gk-ekran .gk-cerceve{position:absolute; box-sizing:border-box;'
  + ' border:2px solid var(--gk-isaret,#c2410c); pointer-events:none;}\n'
  + '.gk-ekran .gk-no{position:absolute; transform:translate(-50%,-50%); box-shadow:0 0 0 2px #fff; line-height:1;}\n'
  + '@media print{.gk-ekran{break-inside:avoid;} .gk-lejant{break-before:avoid;}}\n';

var _gkIsaretKayipListe = [];
function veGuideIsaretKayip(){ return _gkIsaretKayipListe.slice(); }

// Metnin içinde şekildeki numara: "… (2) Yükle'ye basın".
function veGuideNo(n){
  return '<span class="gk-no gk-no--metin">' + _gkEsc(n) + '</span>';
}

var _GK_BOS_OGE = /^(INPUT|SELECT|TEXTAREA|IMG|BR|HR|CANVAS|VIDEO|IFRAME|OPTION|svg)$/i;

// Kendi yazısı (çocuklarınınki dâhil) tam `metin` olan EN DERİN öğe.
function _gkMetinle(kok, metin){
  var hedef = String(metin).replace(/\s+/g, ' ').trim(), bulunan = null;
  var hepsi = kok.querySelectorAll('*');
  for(var i = 0; i < hepsi.length; i++){
    var t = (hepsi[i].textContent || '').replace(/\s+/g, ' ').trim();
    if(t === hedef) bulunan = hepsi[i];       // sonraki eşleşen daha derindir
  }
  return bulunan;
}

function _gkIsaretHedef(kok, i){
  var kapsam = kok;
  if(i.bolum){
    var bas = kok.querySelectorAll('.ve-fp-sect > b');
    for(var b = 0; b < bas.length; b++){
      if((bas[b].textContent || '').trim() !== i.bolum) continue;
      var sect = bas[b].parentNode;
      var kart = sect.closest ? sect.closest('section') : null;
      kapsam = kart || sect;
      break;
    }
    if(kapsam === kok) return null;
    if(!i.s && !i.metin) return kapsam;
  }
  var el = null;
  if(i.metin) el = _gkMetinle(i.s ? (kapsam.querySelector(i.s) || kapsam) : kapsam, i.metin);
  else if(i.s){
    var l = kapsam.querySelectorAll(i.s);
    el = l[i.sira || 0] || null;
  }
  // `ust`: bulunan öğenin bu seçiciye uyan atası (yazıdan bulunan düğmenin kendisi)
  if(el && i.ust && el.closest) el = el.closest(i.ust) || el;
  return el;
}

// Rozetin konağı: içine öğe alamayan (alan, liste, çizim) hedefte ebeveyni.
// SVG'nin içindeki öğe de kendi HTML atasına bağlanır.
function _gkIsaretKonak(el){
  var k = el;
  while(k && k.parentNode && (_GK_BOS_OGE.test(k.tagName || '')
        || (k.namespaceURI && k.namespaceURI.indexOf('svg') >= 0))) k = k.parentNode;
  return k;
}

// html'e işaretleri koy. Döner: { html, lejant: [{ no, ad, not, var }], kayip: [ad] }.
function veGuideIsaretle(html, isaretler){
  var liste = isaretler || [];
  var sonuc = { html: String(html || ''), lejant: [], kayip: [] };
  if(!liste.length || typeof document === 'undefined') return sonuc;
  var tpl = document.createElement('template');
  tpl.innerHTML = sonuc.html;
  var kok = tpl.content;
  liste.forEach(function(i, ix){
    var no = ix + 1;
    var el = _gkIsaretHedef(kok, i);
    var konak = el ? _gkIsaretKonak(el) : null;
    if(konak && konak.nodeType === 1){
      konak.classList.add('gk-hedef');
      konak.setAttribute('data-gk-no', String(no));
      // Ataları taşanı kırpmasın: rozet hedefin köşesinin DIŞINDA durur ve
      // `overflow:hidden` bir kap (aksonometrik çizimin kabı) onu siler.
      for(var a = konak.parentNode; a && a.nodeType === 1; a = a.parentNode) a.classList.add('gk-hedef-ata');
      var r = document.createElement('span');
      var yer = VE_GUIDE_ISARET_YER.indexOf(i.yer) >= 0 ? i.yer : 'sol';
      r.className = 'gk-no gk-no--' + yer;
      r.setAttribute('aria-hidden', 'true');
      r.textContent = String(no);
      konak.appendChild(r);
    } else {
      sonuc.kayip.push(i.ad || ('#' + no));
    }
    sonuc.lejant.push({ no: no, ad: i.ad || '', not: i.not || '', var: !!konak });
  });
  var kap = document.createElement('div');
  kap.appendChild(tpl.content.cloneNode(true));
  sonuc.html = kap.innerHTML;
  return sonuc;
}

function _gkLejant(satirlar){
  if(!satirlar || !satirlar.length) return '';
  var tek = satirlar.length < 4 || satirlar.some(function(s){ return String(s.not || '').length > 140; });
  return '<ol class="gk-lejant' + (tek ? ' gk-lejant--tek' : '') + '">'
    + satirlar.map(function(s){
        return '<li><span class="gk-no">' + s.no + '</span><span><b>' + _gkEsc(s.ad) + '</b>'
          + (s.not ? ' — ' + s.not : '') + '</span></li>';
      }).join('')
    + '</ol>';
}

// EKRAN GÖRÜNTÜSÜ ŞEKLİ — tuval ve 3B gibi HTML olarak çizilemeyen yüzeyler.
// `resim`: { src, g, y, isaret: { anahtar: [x0, y0, x1, y1] } } — kutular resmin
// oranı (0…1), görüntü alınırken DOM'dan ölçülür (tools/kilavuz-resim.js).
// `isaretler`: [{ k: anahtar, ad, not, yer, cerceve }] — sıra numaradır.
// `en`: gösterim genişliği (px); verilmezse sayfa ya da resim, küçüğü.
function veGuideEkran(resim, isaretler, altyazi, en){
  if(!resim || !resim.src) return '';
  _gkSahneNo++;
  var liste = isaretler || [];
  var sayfa = _gkPageWidth() || 760;
  var w = Math.min(Number(en) || resim.g || sayfa, sayfa);
  var y = function(v){ return (Math.round(v * 10000) / 100) + '%'; };   // makine: CSS yüzdesi
  var h = '<figure class="appfig"><div class="gk-ekran" data-gk-sahne="' + _gkSahneNo
    + '" style="max-width:' + Math.round(w) + 'px;">'
    + '<img src="' + resim.src + '" alt="" width="' + resim.g + '" height="' + resim.y + '">';
  var lejant = [];
  liste.forEach(function(i, ix){
    var no = ix + 1;
    var k = resim.isaret ? resim.isaret[i.k] : null;
    if(!k){
      _gkIsaretKayipListe.push({ sekil: _gkSahneNo, ad: i.ad || i.k });
    } else {
      if(i.cerceve !== false){
        h += '<span class="gk-cerceve" style="left:' + y(k[0]) + '; top:' + y(k[1])
          + '; width:' + y(k[2] - k[0]) + '; height:' + y(k[3] - k[1]) + ';"></span>';
      }
      var px = { 'sag': k[2], 'ic-sag': k[2], 'sag-orta': k[2], 'alt-sag': k[2] }[i.yer];
      var py = { 'alt': k[3], 'alt-sag': k[3], 'sol-orta': (k[1] + k[3]) / 2,
                 'sag-orta': (k[1] + k[3]) / 2 }[i.yer];
      // Rozet (18 px) resmin içinde kalır: kenardaki öğenin numarası dışarı taşmaz.
      var mx = 11 / w, my = 11 / (w * resim.y / resim.g);
      var bx = Math.min(Math.max(px === undefined ? k[0] : px, mx), 1 - mx);
      var by = Math.min(Math.max(py === undefined ? k[1] : py, my), 1 - my);
      h += '<span class="gk-no" data-gk-no="' + no + '" style="left:' + y(bx) + '; top:' + y(by) + ';">'
        + no + '</span>';
    }
    lejant.push({ no: no, ad: i.ad || '', not: i.not || '', var: !!k });
  });
  return h + '</div>' + _gkLejant(lejant)
    + '<figcaption><b>Şekil ' + _gkSahneNo + ' —</b> ' + (altyazi || '') + '</figcaption></figure>';
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
  var s = String(html || '');
  var topla = function(m){
    var t = 0;
    m.forEach(function(x){
      var v = /(\d+(?:\.\d+)?)px/.exec(x);
      if(v) t += Number(v[1]);
    });
    return t;
  };
  // 1) SÜTUNLU KART (Kayış Tablosu — Pafta): ölçü `<colgroup>`tan toplanır.
  //    Pay BASKIDA ÖLÇÜLDÜ (`fead-kilavuz-baski.spec.js`) — sütun toplamı
  //    hücre payını İÇERMEDİĞİ için 26 yetmiyordu, tablo sağdan kırpılıyordu.
  //    (Kart listesi döneminin `--fead-krt-en` taşıyıcısı Pafta'yla emekli:
  //    tablo yeniden `<colgroup>` taşıyor.)
  var m = s.match(/<col[^>]*width\s*:\s*(\d+(?:\.\d+)?)px/g);
  if(m && m.length) return topla(m) + 60;
  // 2) SÜTUNSUZ KART (kanvas şeması): kendi dış kutusunun width'i. Bu dal
  //    olmadan kanvas kartları sayfadan 48 px taşıyordu (baskıda ölçüldü).
  var w = /^[\s\S]{0,400}?width\s*:\s*(\d{3,4})px/.exec(s);
  return w ? Number(w[1]) + 26 : 0;
}

// ── SAHNE ÖLÜDÜR: GÖRÜNÜR, TIKLANMAZ ──────────────────────────────────────
//
// Kullanıcı isteği (2026-09-21): *"interaktif şeyler yapmışsın, işte
// tıklanabiliyor falan filan. Bunlara gerek yok, yani, düz ekran görüntüsü
// olsun. Kullanıcı kılavuzunu genel olarak çıktı alacağız."*
//
// Belge bir KILAVUZ, bir program kopyası değil: açılır liste açılıyor, alana
// yazılabiliyor, düğme basılabiliyor olmak kullanıcıya belgeyi program sanma
// hakkı veriyordu. Bileşen aynen çizilmeye devam eder (resmin değeri programa
// benzemesinde) ama HİÇBİR ŞEY YAPMAZ.
//
// Üç şey yapılır ve üçü de ayrı bir sebeple:
//   1. Olay işleyicileri SÖKÜLÜR — belgede çalışacak bir JS yok, ama dosyada
//      yük ve bir gün bir bağlamda çalışırlarsa kılavuz kullanıcının modelini
//      değiştirmeye kalkardı.
//   2. Odak sırasından çıkarılır (`tabindex="-1"`) — fare `pointer-events`
//      ile kesiliyor, klavye kesilmezse Tab'la alana girilip yazılabilirdi.
//   3. Kimlikler SAHNE NUMARASIYLA ÖNEKLENİR — aynı düğüm iki sahnede
//      çizilince `id` tekrarlanıyor; tekrarlı kimlik HTML'i geçersiz yapar ve
//      `label[for]` yanlış alana bağlanır.
function _gkFlatten(html, no){
  var s = String(html || '');
  s = s.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
       .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '');
  s = s.replace(/<(input|select|textarea|button|a)(\s|>)/gi, '<$1 tabindex="-1"$2');
  s = s.replace(/<input(\s)/gi, '<input readonly$1');
  s = s.replace(/\b(id|for)="([^"]*)"/gi, '$1="gk' + no + '-$2"');
  return s;
}

// ── BİR KARTI SÖK ─────────────────────────────────────────────────────────
//
// Panel üreticileri bütün kartları TEK gövdede veriyor ve o gövde A4 sayfadan
// uzun olabiliyor (gergi paneli ölçüldü: ~1700 px, sayfa ~1050). Baskıda bir
// şekil sayfaya sığmıyorsa ya kırpılır ya da kendi başına bir sayfaya atılıp
// yine taşar. Bu yüzden kılavuz PANELİ değil, anlattığı KARTI gösterir —
// şekil, açıkladığı paragrafın yanında durur.
//
// Söküm başlıkla yapılır çünkü başlık zaten kılavuzun metninde geçiyor
// (Ek A'nın kart adları kapısı onu programa karşı tutuyor); ikinci bir
// kimlik uydurmak, kartın adı değişince sessizce boş şekil demekti.
function veGuideCard(panelHtml, baslik){
  var s = String(panelHtml || '');
  // ÖNCE BÖLÜM BAŞLIĞI (`.ve-fp-sect > b`): ad metnin başka bir yerinde de
  // geçebilir — "Katalog modeli" kartı "Devir sınırları"nı anıyor. Pencere
  // sekmeliyken ilk geçiş sekmenin etiketiydi ve ayıklayıcı (yanlışlıkla)
  // BÜTÜN paneli döndürüyordu; tek gövdede (2026-10-16) ilk geçiş başka bir
  // kartın içine düşüyordu. Başlıkta yoksa eski arama.
  var bm = new RegExp('<div class="ve-fp-sect"[^>]*><b>' + baslik.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</b>').exec(s);
  var i = bm ? bm.index + bm[0].indexOf('>' + baslik + '<') : s.indexOf('>' + baslik + '<');
  if(i < 0) return '';
  // ── KART KUTUSU ARTIK BİR SINIF, SATIR İÇİ ÇERÇEVE DEĞİL ────────────────
  // FEAD panelleri ortak dile geçince (`.ve-fp-*`) kart kutusu
  // `<section class="ve-fp-card">` oldu ve satır içi `border:1px solid`
  // KALMADI. Aşağıdaki eski yol o çapayı arıyor, bulamayınca panelin İLK
  // div'ine kadar geri yürüyor ve ALAKASIZ bir parça döndürüyordu —
  // "Algılanan Model" sahnesi sessizce kayboldu (ölçüldü: kılavuzda o
  // yüzeyin resmi hiç yok, hata da çıkmıyor).
  var sec = _gkKapsayan(s, i, '<section', '</section>');
  if(sec) return sec;
  // Eski yol: kendi zeminini/çerçevesini satır içi yazan div (hâlâ öyle
  // çizen yüzeyler var — kaldırılırsa onlar sessizce kaybolur).
  var bas = s.lastIndexOf('<div', i);
  while(bas > 0){
    var onceki = s.lastIndexOf('<div', bas - 1);
    if(s.slice(bas, i).indexOf('border:1px solid') >= 0) break;
    if(onceki < 0) break;
    bas = onceki;
  }
  if(bas < 0) return '';
  return _gkKapat(s, bas, '<div', '</div>') || '';
}

// Verilen konumu SARAN en yakın etiketi bul ve derinlik sayarak kapat.
// `null` döner: o etikete hiç girilmemişse ya da kapanışı başlığı sarmıyorsa
// (yani başlık o kutunun İÇİNDE değil, ondan sonra geliyorsa).
function _gkKapsayan(s, i, ac, kapa){
  var bas = s.lastIndexOf(ac, i);
  while(bas >= 0){
    var tam = _gkKapat(s, bas, ac, kapa);
    if(tam && bas + tam.length > i) return tam;
    bas = s.lastIndexOf(ac, bas - 1);
  }
  return null;
}

function _gkKapat(s, bas, ac, kapa){
  var d = 0, k = bas;
  while(k < s.length){
    if(s.substr(k, ac.length) === ac){ d++; k += ac.length; continue; }
    if(s.substr(k, kapa.length) === kapa){
      d--; k += kapa.length;
      if(d === 0) return s.slice(bas, k);
      continue;
    }
    k++;
  }
  return null;
}

// CÜMLE İÇİNDE DÜĞME. Sahne bir figürdür ve okuma akışını böler; "şeritteki
// şu düğmeye bas" derken düğmenin kendisi CÜMLENİN İÇİNDE durmalı.
//
// `appfig` sınıfı burada da kullanılıyor ve bu bilinçli: o sınıf raporun
// şablonunda YALNIZ jeton bağlıyor (kutu/kenar stili taşımıyor), dolayısıyla
// satır içi bir kabuğa da takılabiliyor. İkinci bir jeton kabuğu açmak, aynı
// paletin iki yerden tanımlanması demekti.
var _gkCipNo = 0;
function veGuideBtn(html){
  if(!html) return '';
  _gkCipNo++;
  return '<span class="appfig gk-cip">' + _gkFlatten(html, 'c' + _gkCipNo) + '</span>';
}

// Şekil sayacı — elle "Şekil 3" yazmak, araya bir sahne girdiğinde sessizce
// kayardı (raporun tablo sayacındaki kuralın aynısı).
var _gkSahneNo = 0;
function veGuideSceneReset(){ _gkSahneNo = 0; _gkIsaretKayipListe = []; }
function veGuideSceneCount(){ return _gkSahneNo; }

// Bir bileşeni sahneye koy. `html` programın ÜRETİCİSİNDEN gelir; buraya elle
// yazılmış bir kopya konursa sahnenin bütün gerekçesi düşer.
//
// Kabuk raporun şekil kalıbıyla birebir: `<figure class="appfig">` +
// `<figcaption><b>Şekil N —</b> …`.
//
// `isaretler` (ops.): şeklin numaralı işaretleri (aşağıda, `veGuideIsaretle`);
// lejant şeklin altında, altyazının üstünde.
function veGuideScene(html, altyazi, dogalEn, isaretler){
  if(!html) return '';
  var lejant = '', isaretli = !!(isaretler && isaretler.length);
  if(isaretli){
    var r = veGuideIsaretle(html, isaretler);
    html = r.html;
    lejant = _gkLejant(r.lejant);
    r.kayip.forEach(function(ad){ _gkIsaretKayipListe.push({ sekil: _gkSahneNo + 1, ad: ad }); });
  }
  _gkSahneNo++;
  // SIĞMAYAN İÇERİK ÖLÇEKLENİR, KIRPILMAZ. Kayış Tablosu doğal hâlinde
  // sayfadan geniş; yatay kaydırma ekranda çare, BASKIDA değil — A4'e basılan
  // belgede sağdaki sütunlar kaybolurdu. Oran sayfanın kendi genişliğinden
  // türer (rapor şablonundan sökülür), elle ayarlanmaz.
  var stil = '';
  var en = Number(dogalEn);
  if(!Number.isFinite(en) || en <= 0) en = _gkNaturalWidth(html);
  if(Number.isFinite(en) && en > 0){
    // SAHNENİN KENDİ ÇERÇEVESİ DÜŞÜLÜR. Ölçek sayfa genişliğiyle
    // karşılaştırılıyordu, oysa içerik sahnenin dolgusu ve kenarlığı İÇİNE
    // sığmak zorunda: Kayış Tablosu 49 px taşıyordu (baskıda, öge bazlı
    // ölçüldü — sağdaki sütun kırpılıyordu).
    var sayfa = _gkPageWidth() - (isaretli ? _GK_SAHNE_CERCEVE_ISARET : _GK_SAHNE_CERCEVE);
    if(sayfa > 0 && en > sayfa){
      stil = ' style="zoom:' + (Math.floor(sayfa / en * 1000) / 1000) + '"';
    } else if(en > 0){
      // KENDİ TASARIM GENİŞLİĞİNDE. Sayfaya GERİLEN bir kart programdakinden
      // başka bir şey oluyor: tek satıra kurulmuş şeritler sütunu bulamayıp
      // taşıyor (kanvas kartında 48 px ölçüldü, sağdaki özet kırpılıyordu).
      // Kart kendi ölçüsünde, ortalanmış duruyor — ekranda olduğu gibi.
      stil = ' style="max-width:' + Math.round(en) + 'px; margin:0 auto;"';
    }
  }
  return '<figure class="appfig"><div class="gk-sahne' + (isaretli ? ' gk-sahne--isaret' : '')
    + '" data-gk-sahne="' + _gkSahneNo + '"' + stil + '>' + _gkFlatten(html, _gkSahneNo) + '</div>'
    + lejant
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
  h += '<div class="eyebrow">' + _gkEsc(o.eyebrow || 'MFSim · Kullanım kılavuzu') + '</div>';
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
// Kabuk sınıfları `.ve-help-*` — Klavye Kısayolları penceresiyle AYNI başlık ve
// perde. Gövde bir LİSTE (kullanıcı 2026-11-09, Canlı Not 91: *"yapısı güzel
// değil, butonlar kocaman"*): kılavuz başına tek satır — ad, sağda Aç · İndir
// (24 px). Önce iki sütunlu kartlar, "Hazır" rozeti, 156 px'lik Aç ve altta
// "3 / 3 kılavuz hazır · MFSim" satırı vardı. Durum yalnız kılavuz hazır
// DEĞİLKEN yazılır: düğmelerin varlığı hazır olduğunu zaten söyler.

var _gkBuilt = false;

function _gkKart(k){
  var hazir = veGuideKitReady(k), id = _gkEsc(k.id);
  var h = '<div class="ve-gk-satir"><span class="ve-gk-ad">' + _gkEsc(k.baslik) + '</span>';
  if(hazir){
    h += '<span class="ve-gk-eylem">'
      + '<button type="button" class="ve-gk-btn ve-gk-btn--ac" onclick="veGuideOpen(\'' + id + '\')">Aç</button>'
      + '<button type="button" class="ve-gk-btn" onclick="veGuideDownload(\'' + id + '\')">İndir</button></span>';
  } else {
    h += '<span class="ve-gk-durum">Hazırlanıyor</span>';
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
    '<div class="ve-help-panel ve-help-panel--kilavuz" role="dialog" aria-modal="true" aria-label="Kullanım kılavuzları">'
    + '<div class="ve-settings-header"><span><span class="mf-ico mf-ico-clipboard"></span> Kullanım kılavuzları</span>'
    + '<button class="ve-settings-close" type="button" title="Kapat (Esc)" aria-label="Kapat" '
    + 'onclick="veGuideKitClose()"><span class="mf-ico mf-ico-x"></span></button></div>'
    + '<div class="ve-gk-liste" id="ve-guide-kit-body"></div></div>';
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
  _gkStatus('Kılavuz indirildi (' + veSayi(html.length / 1024, 0) + ' KB).', 'success');
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
    veGuideIsaretle: veGuideIsaretle, veGuideIsaretKayip: veGuideIsaretKayip,
    veGuideNo: veGuideNo, veGuideEkran: veGuideEkran, _gkLejant: _gkLejant,
    VE_GUIDE_ISARET_YER: VE_GUIDE_ISARET_YER,
    veGuideBtn: veGuideBtn, veGuideCard: veGuideCard, _gkFlatten: _gkFlatten,
    veGuideSceneMissingTokens: veGuideSceneMissingTokens
  };
}
