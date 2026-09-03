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
  },
  {
    id: 'str',
    modul: 'Yapısal Analiz',
    baslik: 'Yapısal Analiz — STEP’ten Sonuca',
    ozet: 'STEP içe aktarma, malzeme atama, hesaplama ağı ve sınır koşulları '
        + 'zinciri.',
    uret: 'veGuideStrHTML',
    dosya: 'MFSim_Yapisal_Analiz_Kullanim_Kilavuzu'
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
  'fead-analysis': 'fead',
  'structural-analysis': 'str'
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
    veGuideOpenCurrent: veGuideOpenCurrent
  };
}
