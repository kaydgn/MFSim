// ═══════════════════════════════════════════════════════════════════════════
// PROGRAM ARŞİVİ — programlar/ klasöründeki tek dosyalık HTML programların kapısı
// ═══════════════════════════════════════════════════════════════════════════
//
// Şeritten (Araçlar → Arşiv) açılır. Kayıt defteri `programlar/kayit.json`;
// bu dosya onu ÇİZER, ikinci bir liste tutmaz.
//
// ── ÜÇ KARAR ───────────────────────────────────────────────────────────────
//
// 1 · KATALOG GÖMÜLÜR, PROGRAMLARIN GÖVDESİ GÖMÜLMEZ. Ölçüldü: arşivin 48
//     HTML dosyası `gzip -9` ile 17,40 MB. Gömülseydi gönderilen `.gz`
//     18,9 → ~36 MiB olurdu, yani teslim sınırının (30 MiB, CLAUDE.md) ÜSTÜ —
//     program artık sohbetle gönderilemezdi. Katalog ise 11,6 KB: o gömülüyor
//     (build.js → `window.__MFSIM_PROGRAMLAR`), liste her kopyada çiziliyor.
//     Ağırlık dağılımı da bunu destekliyor: 17,40 MB'ın 12,39 MB'ı yalnız ALTI
//     ekran görüntüsü ağırlıklı dosyada.
//
// 2 · ARŞİVİN YANINDA OLUP OLMADIĞI ÖLÇÜLÜR, VARSAYILMAZ. Katalog her kopyada
//     var ama dosyalar olmayabilir (indirilmiş tek dosyanın yanında klasör
//     yoksa). Ölçüm `file://` üzerinde de çalışmak zorunda: orada `fetch` iki
//     durumda da TypeError atıyor (ayrım yapmıyor), `<script>` etiketi ise
//     `onload`/`onerror` ile ayırıyor — Chromium'da ölçüldü. Hedef
//     `programlar/arsiv-var.js`. Ölçmeseydik kullanıcı listedeki her satıra
//     tıklayıp tarayıcının "dosya bulunamadı" sayfasına düşerdi.
//
// 3 · YOL = 'programlar/' + kayıttaki `dosya`. Kayıt yolları `programlar/`'a
//     görelidir ve üç ürün `../` ile başlar; tarayıcı normalize edince belge
//     diziniyle aynı yere düşerler. Aynı ifade hem depoda (index.html kökte)
//     hem dağıtılan kopyada (MFSim_Code.html'in yanında programlar/) doğru —
//     ürünlere ayrı bir dal yazmak gerekmiyor.
//
// Ad öneki `veProgram…` / `_vpa…` (source-hygiene kapısı: aynı adı iki dosyada
// üst-seviye bildirmek birincisini sessizce ezer).

// ── KATALOG ────────────────────────────────────────────────────────────────
// Tek dosyada build.js gömüyor; modüler index.html'de gömme yok → fetch'e
// düşülür (assets/examples ile AYNI kural, bkz. build.js 2c).

function veProgramlarKayit() {
  if(typeof window === 'undefined') return null;
  return window.__MFSIM_PROGRAMLAR || null;
}

function _vpaKatalogYukle(cb) {
  var k = veProgramlarKayit();
  if(k) { cb(k); return; }
  if(typeof fetch !== 'function') { cb(null); return; }
  fetch('programlar/kayit.json').then(function(r) {
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function(j) {
    if(typeof window !== 'undefined') window.__MFSIM_PROGRAMLAR = j;
    cb(j);
  })['catch'](function() { cb(null); });
}

function veProgramlarListe() {
  var k = veProgramlarKayit();
  return (k && Array.isArray(k.programlar)) ? k.programlar : [];
}

// Yol tek yerden kurulur (karar 3).
function veProgramlarUrl(p) {
  if(!p || !p.dosya) return '';
  return 'programlar/' + String(p.dosya);
}

// GÖSTERİM için sadeleştirilmiş yol. Tarayıcıya giden yol `veProgramlarUrl`
// (normalizasyonu o yapıyor); burası yalnız okunurluk: ürünler kayıtta `../`
// ile başlıyor ve "programlar/../MFSim_Code.html" satırda gürültü.
function veProgramlarYolMetni(p) {
  var y = veProgramlarUrl(p);
  if(!y) return '';
  var par = [];
  y.split('/').forEach(function(x) {
    if(x === '.' || x === '') return;
    if(x === '..') { par.pop(); return; }
    par.push(x);
  });
  return par.join('/');
}

// ── VARLIK YOKLAMASI (karar 2) ─────────────────────────────────────────────
// YALNIZ olumlu sonuç önbelleğe alınır: klasör oturum ortasında yanına konursa
// bir sonraki açılış onu GÖRSÜN. Olumsuz sonuç önbelleklenseydi kullanıcı
// klasörü koyduktan sonra da "yok" okumaya devam ederdi.
var _vpaVar = null;

function veProgramArsiviYokla(cb) {
  if(_vpaVar === true) { cb(true); return; }
  if(typeof document === 'undefined') { cb(false); return; }
  var s = document.createElement('script');
  var bitti = false;
  function son(v) {
    if(bitti) return;
    bitti = true;
    if(v) _vpaVar = true;
    if(s.parentNode) s.parentNode.removeChild(s);
    cb(v);
  }
  s.src = 'programlar/arsiv-var.js';
  s.onload = function() { son(true); };
  s.onerror = function() { son(false); };
  document.head.appendChild(s);
  setTimeout(function() { son(false); }, 4000);
}

// ── BİÇİMLEME ──────────────────────────────────────────────────────────────

function _vpaEsc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// `boyut` YALNIZ donmuş dosyalarda var: üretilen üç ürünün boyutu her build'de
// değişir, kayda yazılsa ilk build'de bayatlardı (programlar/README.md).
function veProgramlarBoyut(n) {
  if(typeof n !== 'number' || !isFinite(n) || n <= 0) return '';
  if(n < 1024) return n + ' B';
  if(n < 1048576) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

var VE_PROGRAMLAR_KUMELER = [
  { anahtar: 'urun',      baslik: 'MFSim ürünleri',
    not: 'Build hattının çıktısı — programın yanında durur' },
  { anahtar: 'artifact',  baslik: 'Artifact arşivi',
    not: 'Sohbette üretilmiş tek dosyalık HTML programlar' },
  { anahtar: 'disaridan', baslik: 'Dışarıdan gelenler',
    not: 'MFSim üretmedi; kaynak araç olarak duruyor' }
];

function veProgramlarSuz(liste, q) {
  var s = String(q || '').trim().toLocaleLowerCase('tr');
  if(!s) return liste.slice();
  return liste.filter(function(p) {
    return (String(p.ad || '') + ' ' + String(p.dosya || '') + ' ' + String(p.not || ''))
      .toLocaleLowerCase('tr').indexOf(s) >= 0;
  });
}

// ── PENCERE ────────────────────────────────────────────────────────────────
// Kabuk sınıfları `.ve-help-*` — Kılavuz Kiti ve Klavye Kısayolları ile AYNI.
// İkinci bir pencere stili yazmak css/styles.css'e dokunmak demekti; o dosya
// ÜÇ ürüne birden giriyor ve ikisinin dağıtım dosyasını bayatlatıyor (CLAUDE.md).

var _vpaKuruldu = false;

function _vpaSatir(p, i, varMi) {
  var url = veProgramlarUrl(p);
  var boy = veProgramlarBoyut(p.boyut);
  var alt = [];
  if(p.tarih) alt.push(_vpaEsc(p.tarih));
  if(boy) alt.push(_vpaEsc(boy));
  alt.push('<span style="font-family:ui-monospace,monospace; opacity:.75;">'
    + _vpaEsc(veProgramlarYolMetni(p)) + '</span>');

  var h = '<div style="display:flex; align-items:center; gap:10px; padding:8px 10px; '
    + 'border:1px solid var(--border-color); background:var(--bg-primary);">';
  h += '<span style="font-size:var(--fs-h2); line-height:1; flex:none;">'
    + _vpaEsc(p.simge || '📄') + '</span>';
  h += '<div style="flex:1; min-width:0;">'
    + '<div style="font-size:var(--fs-micro); font-weight:600; color:var(--text-primary); '
    + 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + _vpaEsc(p.ad) + '</div>'
    + '<div style="font-size:var(--fs-micro); color:var(--text-muted); margin-top:2px; '
    + 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + alt.join(' · ') + '</div>'
    + '</div>';
  h += '<button type="button" onclick="veProgramArsiviAc(' + i + ')"'
    + (varMi ? '' : ' disabled')
    + ' style="flex:none; padding:6px 12px; font-size:var(--fs-micro); font-weight:600; '
    + 'border:none; cursor:' + (varMi ? 'pointer' : 'not-allowed') + '; '
    + 'background:' + (varMi ? 'var(--accent-primary)' : 'var(--bg-tertiary)') + '; '
    + 'color:' + (varMi ? '#fff' : 'var(--text-muted)') + ';">Aç</button>';
  return h + '</div>';
}

// Arşiv yoksa liste GİZLENMEZ, pasif çizilir: kullanıcı neyin var olduğunu
// görmeli — kapının kapalı olması içeridekini de silmez.
function _vpaDurumSeridi(varMi, n) {
  if(varMi) {
    return '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-micro); '
      + 'background:rgba(16,185,129,.12); color:var(--text-primary); '
      + 'border-left:3px solid var(--accent-success);">'
      + '<b>Arşiv yanınızda.</b> ' + n + ' program açılmaya hazır.</div>';
  }
  return '<div style="padding:10px; margin-bottom:10px; font-size:var(--fs-micro); '
    + 'line-height:1.55; background:var(--bg-tertiary); color:var(--text-primary); '
    + 'border-left:3px solid var(--accent-warning);">'
    + '<b>Arşiv klasörü bu kopyanın yanında değil.</b> Liste aşağıda duruyor ama '
    + 'dosyalar açılamıyor.<br>Bu programlar <code>programlar/</code> klasöründe '
    + 'durur; klasörü <b>MFSim_Code.html ile aynı dizine</b> çıkarınca satırlar '
    + 'etkinleşir.<br><span style="color:var(--text-muted);">Katalog gömülü, '
    + 'dosyalar değil: arşiv sıkıştırılmış 17,4 MB ve gömülseydi program '
    + 'sohbetle gönderilemeyecek kadar büyürdü.</span></div>';
}

// TEK SÜTUN KAPSAYICI ŞART. `.ve-help-body` iki sütunlu bir grid (Kılavuz
// Kiti'nin kart ızgarası için); blokları doğrudan çocuk yapsaydık her biri bir
// hücreye düşerdi — ölçüldü: durum şeridi dar bir şeride sıkışıyor, "Aç"
// düğmeleri sıfır genişliğe iniyordu. Kapsayıcı iki sütunu birden kaplıyor,
// böylece css/styles.css'e dokunmak gerekmiyor (o dosya üç ürüne birden girer).
function _vpaCiz() {
  var b = document.getElementById('ve-programlar-body');
  if(!b) return;
  var liste = veProgramlarListe();
  if(!liste.length) {
    b.innerHTML = '<div style="padding:14px; font-size:var(--fs-micro); '
      + 'color:var(--text-muted);">Program kataloğu okunamadı '
      + '(<code>programlar/kayit.json</code>).</div>';
    return;
  }

  var giris = document.getElementById('ve-programlar-ara');
  var q = giris ? giris.value : '';
  // Odak ölçümü yenilemeden ÖNCE alınır: innerHTML kutuyu yok ediyor, sonra
  // bakılsaydı `giris` kopmuş bir düğüm olur ve karşılaştırma hep false dönerdi.
  var odakli = !!(giris && typeof document !== 'undefined' && giris === document.activeElement);
  var varMi = (_vpaVar === true);
  var bulunan = veProgramlarSuz(liste, q);

  var h = '<div style="grid-column:1/-1; min-width:0;">' + _vpaDurumSeridi(varMi, liste.length);
  h += '<input type="search" id="ve-programlar-ara" placeholder="Ara — ad, dosya, not" '
    + 'value="' + _vpaEsc(q) + '" oninput="_vpaCiz()" '
    + 'style="width:100%; box-sizing:border-box; padding:7px 10px; margin-bottom:10px; '
    + 'font-size:var(--fs-micro); background:var(--bg-primary); color:var(--text-primary); '
    + 'border:1px solid var(--border-color);">';

  var yazildi = 0;
  VE_PROGRAMLAR_KUMELER.forEach(function(k) {
    var uyan = bulunan.filter(function(p) { return p.kume === k.anahtar; });
    if(!uyan.length) return;
    yazildi += uyan.length;
    h += '<div style="margin:12px 0 6px;">'
      + '<div style="font-size:var(--fs-micro); font-weight:700; letter-spacing:.06em; '
      + 'text-transform:uppercase; color:var(--text-primary);">' + _vpaEsc(k.baslik)
      + ' <span style="font-weight:400; color:var(--text-muted);">(' + uyan.length + ')</span></div>'
      + '<div style="font-size:var(--fs-micro); color:var(--text-muted); margin-top:2px;">'
      + _vpaEsc(k.not) + '</div></div>';
    h += '<div style="display:flex; flex-direction:column; gap:6px;">';
    uyan.forEach(function(p) { h += _vpaSatir(p, liste.indexOf(p), varMi); });
    h += '</div>';
  });

  if(!yazildi) {
    h += '<div style="padding:14px; font-size:var(--fs-micro); color:var(--text-muted);">'
      + 'Aramaya uyan program yok.</div>';
  }

  b.innerHTML = h + '</div>';
  // Arama kutusu innerHTML ile YENİDEN kuruluyor → odak ve imleç elle geri
  // konur, yoksa her harfte odak kaybolur ve kutuya tek karakter yazılabilirdi.
  var yeni = document.getElementById('ve-programlar-ara');
  if(yeni && odakli) {
    yeni.focus();
    try { yeni.setSelectionRange(yeni.value.length, yeni.value.length); } catch(e) {}
  }

  var f = document.getElementById('ve-programlar-foot');
  if(f) {
    f.textContent = liste.length + ' program · katalog gömülü, dosyalar '
      + 'programlar/ klasöründe';
  }
}

function veProgramArsiviAc(i) {
  var liste = veProgramlarListe();
  var p = liste[i];
  if(!p) return;
  var url = veProgramlarUrl(p);
  if(!url) return;
  window.open(url, '_blank', 'noopener');
}

function _vpaKur() {
  if(_vpaKuruldu) return;
  var ov = document.createElement('div');
  ov.className = 've-help-overlay';
  ov.id = 've-programlar';
  ov.setAttribute('hidden', '');
  ov.innerHTML =
    '<div class="ve-help-panel" role="dialog" aria-modal="true" aria-label="Program arşivi">'
    + '<div class="ve-help-head"><h3>Program Arşivi</h3>'
    + '<button class="ve-help-close" type="button" title="Kapat (Esc)" aria-label="Kapat" '
    + 'onclick="veProgramArsiviClose()">'
    + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" '
    + 'stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/>'
    + '<line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>'
    + '<div class="ve-help-body" id="ve-programlar-body"></div>'
    + '<div class="ve-help-foot"><span id="ve-programlar-foot"></span>'
    + '<span class="ve-help-brand">MFSim</span></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('mousedown', function(e) { if(e.target === ov) veProgramArsiviClose(); });
  _vpaKuruldu = true;
}

function veProgramArsiviOpen() {
  _vpaKur();
  var ov = document.getElementById('ve-programlar');
  if(!ov) return;
  ov.removeAttribute('hidden');
  void ov.offsetWidth;
  ov.classList.add('open');
  document.addEventListener('keydown', _vpaEscTus);
  // Katalog ve yoklama BAĞIMSIZ: pencere ikisini de beklemeden çiziliyor,
  // her cevap geldiğinde yeniden çiziliyor. Böyle olmasaydı yoklamanın 4 sn'lik
  // zaman aşımı boş bir pencere demekti.
  _vpaCiz();
  _vpaKatalogYukle(function() { _vpaCiz(); });
  veProgramArsiviYokla(function() { _vpaCiz(); });
}

function veProgramArsiviClose() {
  var ov = document.getElementById('ve-programlar');
  if(!ov || !ov.classList.contains('open')) return;
  ov.classList.remove('open');
  ov.setAttribute('hidden', '');
  document.removeEventListener('keydown', _vpaEscTus);
}

function _vpaEscTus(e) {
  if(e.key !== 'Escape') return;
  var t = e.target;
  if(t && (t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  veProgramArsiviClose();
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veProgramlarUrl: veProgramlarUrl,
    veProgramlarYolMetni: veProgramlarYolMetni,
    veProgramlarBoyut: veProgramlarBoyut,
    veProgramlarSuz: veProgramlarSuz,
    VE_PROGRAMLAR_KUMELER: VE_PROGRAMLAR_KUMELER
  };
}
