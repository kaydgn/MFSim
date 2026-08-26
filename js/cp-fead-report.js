// ============================================================================
// FEAD (KAYIŞ-KASNAK) — RAPOR ÜRETECİ (fead-report bileşeni)
// ============================================================================
// Çözücü'nün (window.veFeadResults) ürettiği sonuçları, Takoz raporuyla AYNI
// görsel dilde, TAMAMEN ÇEVRİMDIŞI / self-contained bir HTML dosyasına döker.
// Teori (§1–7, 9, 10, Ek A) sabittir ve şablonda durur; §8 "Sayısal Örnek" ile
// "FEAD Sistem Uygunluğu" bu modelin gerçek çözümünden üretilir.
//
// İÇERİK ÖLÇÜSÜ: tedarikçi (Gates) "Accessory Belt Drive System" çıktısının
// 11 sayfası. Karşılığı OLMAYAN kalemler UYDURULMAZ — §9'da yokluğu yazılır
// (sistem burulma frekansı, hizalama duyarlılığı, Weibull, kayma taraması).
//
// Bağımlılıklar TALEP ÜZERİNE yüklenir (uygulama açılışını şişirmez):
//   js/fead-report-template.js   → window.FEAD_REPORT_TEMPLATE_B64 (teori şablonu)
//   js/mount-report-assets.js    → window.MNT_REPORT_ASSETS (KaTeX + fontlar)
// KaTeX ve fontlar Takoz raporuyla ORTAKTIR: ~1 MB'lık varlığın ikinci bir
// kopyasını taşımanın hiçbir karşılığı yok (js/results.js de aynısını yapıyor).
//
// AD ÖNEKİ `_fr…` — cp-mount-report.js `_r…`, cp-fead.js/fead-model.js `_fead…`
// öneklerini kullanıyor; aynı adı iki dosyada üst-seviye bildirmek
// `source-hygiene` kapısına takılır.
// ----------------------------------------------------------------------------

// ─── Küçük yardımcılar ───────────────────────────────────────────────────────
function _frEsc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// Number(null) === 0 ve Number('') === 0 — bu iki değer rapora "0" olarak
// basılsaydı, GİRİLMEMİŞ bir alan sıfır ölçülmüş gibi okunurdu.
function _frNum(v){
  if(v === null || v === undefined || v === '') return NaN;
  var n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
// Sayı biçimi TÜRKÇE: ondalık ayırıcı virgül, eksi işareti GERÇEK eksi (−).
// ASCII '-' ile U+2212 farkı raporun dizgisinde göze çarpıyor; Takoz raporu da
// aynı kuralı uyguluyor. Geçersiz/boş değer '—' (em dash) basılır: boş hücre
// "sıfır" gibi okunurdu.
function _frF(v, d){
  var n = _frNum(v);
  if(!Number.isFinite(n)) return '—';
  d = (d == null) ? 1 : d;
  var s = Math.abs(n).toFixed(d);
  if(d > 0) s = s.replace(/\.?0+$/, '');
  s = s.replace('.', ',');
  if(s === '' || s === '0' && Object.is(n, -0)) return '0';
  return (n < 0 && Number(Math.abs(n).toFixed(d)) !== 0 ? '−' : '') + s;
}
// Sabit basamaklı (tabloda hizalı sütun için): ondalık kırpılmaz.
function _frFs(v, d){
  var n = _frNum(v);
  if(!Number.isFinite(n)) return '—';
  d = (d == null) ? 1 : d;
  var s = Math.abs(n).toFixed(d).replace('.', ',');
  return (n < 0 && Number(Math.abs(n).toFixed(d)) !== 0 ? '−' : '') + s;
}
function _frPct(v, d){ var s = _frFs(v, d == null ? 1 : d); return s === '—' ? s : ('%' + s); }

// Tablo / şekil numaraları — her rapor üretiminde sıfırlanır.
var _frTblNo = 0, _frFigNo = 0, _frEqNo = 0;
function _frTbl(){ return ++_frTblNo; }
// §8'in kendi denklem numaraları. Elle '(8.1)' yazmak, araya bir denklem
// girdiğinde sessizce kayardı — tablo ve şekil sayaçlarındaki kuralın aynısı.
function _frEq(){ return '8.' + (++_frEqNo); }
// Denklem numaraları METİNDE de anılıyor ("(8.4) ile bağımsız olarak üretir").
// Numara sayaçtan gelirken atıf elle yazılsaydı, araya bir denklem girdiğinde
// gövde metni sessizce YANLIŞ denklemi gösterirdi. İkisi de buradan okunur.
var _frEqRef = {};
function _frFig(){ return ++_frFigNo; }

function _frCore(){
  if(typeof FEADCore !== 'undefined') return FEADCore;
  return (typeof window !== 'undefined') ? window.FEADCore : null;
}
function _frResults(){ return (typeof window !== 'undefined') ? window.veFeadResults : null; }

// Bölüm kimlikleri TEK KAYNAKTAN. Şablondaki içindekiler (.toc) bu id'lere
// bağlanıyor ama başlıkları ÜRETEÇ basıyor; ikisi ayrı yerde yazılsaydı bir
// gün sessizce ayrışır ve içindekiler ölü bağlantıya dönerdi (testi var).
var VE_FEAD_REP_SECTIONS = [
  { id: 's8',       no: '8', t: 'Sayısal Örnek: Bu Modelin Çözümü' },
  { id: 'uygunluk', no: '✓', t: 'FEAD Sistem Uygunluğu' }
];
function _frH2(idx){
  var s = VE_FEAD_REP_SECTIONS[idx];
  return '<h2 id="' + s.id + '"><span class="no">' + s.no + '</span>' + s.t + '</h2>';
}

// ═══════════════════ BİLEŞEN PANELİ ═════════════════════════════════════════
// RAPOR TÜRÜ. İki belge AYNI çözümden üretilir, farkı OKUYUCUSU:
//   detailed  teoriyi anlatır (§1-10 + Ek A) — nasıl hesaplandığını gösterir
//   summary   yalnız sonuç sayfaları — tedarikçi çıktısının beş sayfası
// Varsayılan `detailed`: alanı olmayan eski projeler bugüne kadarki
// davranışlarını birebir korusun.
var VE_FEAD_REPORT_KINDS = [
  { key: 'detailed', ad: 'Detaylı Rapor',
    aciklama: 'Teori + türetme + bu modelin çözümü. Akademik biçim, KaTeX matematik.' },
  { key: 'summary',  ad: 'Özet Rapor',
    aciklama: 'Beş sonuç sayfası: özet, geometri, gergi zarfı, kayma, hubload.' }
];
function veFeadReportKind(node){
  var k = node && node.data && node.data.reportKind;
  return (k === 'summary') ? 'summary' : 'detailed';
}

function getFeadReportPropertiesHTML(node){
  if(!node.data) node.data = {};
  var R = _frResults();
  var solved = !!(R && R.ok);
  var kind = veFeadReportKind(node);
  var html = '<div class="sw-panel">';
  html += _frKindPicker(node, kind);
  if(solved){
    var nP = (R.pulleyNames || []).length;
    var nD = (R.duty || []).length;
    html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); background:var(--bg-tertiary); border:1px solid var(--border-color); color:var(--text-primary);">'
          + '<span style="color:var(--accent-success); font-weight:700;">✓ Model çözüldü</span> — '
          + nP + ' kasnak · ' + nD + ' devir noktası. Rapor güncel çözüme göre üretilir.</div>';
    html += _frDocFields(node);
    var kAd = (kind === 'summary') ? 'Özet Raporu' : 'Detaylı Raporu';
    html += '<button onclick="veFeadGenerateReport(\'' + node.id + '\')" style="width:100%; padding:13px 16px; font-size:var(--fs-lg); font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.02em; border-radius:var(--radius-sm);" onmouseover="this.style.filter=\'brightness(1.12)\'" onmouseout="this.style.filter=\'none\'">📄 ' + kAd + ' Oluştur ve İndir</button>';
  } else {
    html += '<div style="padding:10px 12px; margin-bottom:10px; background:rgba(245,158,11,0.12); border:1px solid var(--accent-warning); color:var(--accent-warning); font-size:var(--fs-body); line-height:1.5;">'
          + '<b>Model çözülmedi.</b> Rapor, Çözücü sonuçlarından üretilir.</div>';
    html += '<button disabled style="width:100%; padding:13px 16px; font-size:var(--fs-lg); font-weight:700; background:var(--bg-tertiary); color:var(--text-muted); border:1px solid var(--border-color); cursor:not-allowed; border-radius:var(--radius-sm);">📄 Raporu Oluştur ve İndir</button>';
  }
  html += '<div id="ve-fead-report-status" style="margin-top:8px; font-size:var(--fs-tiny); color:var(--text-muted);"></div>';
  html += '</div>';
  return html;
}

// Rapor türü seçici. İki durumlu bir anahtar değil İKİ KART: her türün ne
// olduğu seçim yapılmadan ÖNCE okunabilsin. Seçim `saveState` çağırır ve
// paneli yeniden çizer (veFeadSetChoice kalıbı) — tür bir görünüm tercihi
// değil, hangi belgenin indirileceğini belirleyen bir karar.
function _frKindPicker(node, kind){
  var h = '<div style="margin:0 0 10px;">'
    + '<div style="font-size:var(--fs-tiny); font-weight:600; color:var(--text-heading); margin-bottom:5px;">Rapor türü</div>';
  VE_FEAD_REPORT_KINDS.forEach(function(k){
    var on = (k.key === kind);
    h += '<div onclick="veFeadSetChoice(\'' + node.id + '\',\'reportKind\',\'' + k.key + '\')"'
      + ' style="cursor:pointer; margin-bottom:5px; padding:7px 9px; border:1px solid '
      + (on ? 'var(--accent-primary)' : 'var(--border-color)') + '; background:'
      + (on ? 'rgba(59,130,246,0.10)' : 'var(--bg-secondary)') + ';">'
      + '<div style="display:flex; align-items:center; gap:7px;">'
      + '<span style="width:11px; height:11px; flex:none; border-radius:50%; border:2px solid '
      + (on ? 'var(--accent-primary)' : 'var(--text-muted)') + '; background:'
      + (on ? 'var(--accent-primary)' : 'transparent') + ';"></span>'
      + '<b style="font-size:var(--fs-tiny); color:var(--text-heading);">' + k.ad + '</b></div>'
      + '<div style="font-size:var(--fs-micro); color:var(--text-muted); margin-top:3px; line-height:1.4;">'
      + k.aciklama + '</div></div>';
  });
  return h + '</div>';
}

// Doküman künyesi — antete ve §8.18'e akan üç alan. Tedarikçi sayfasının
// künyesinde de bunlar var (doküman no, revizyon, tasarım notları).
function _frDocFields(node){
  var d = node.data || {};
  function inp(key, label, ph){
    return '<div style="margin-bottom:7px;">'
      + '<label style="display:block; font-size:var(--fs-micro); color:var(--text-muted); margin-bottom:2px;">' + label + '</label>'
      + '<input type="text" value="' + _frEsc(d[key] == null ? '' : d[key]) + '" placeholder="' + _frEsc(ph) + '"'
      + ' oninput="veFeadSet(\'' + node.id + '\',\'' + key + '\',this.value)"'
      + ' style="width:100%; padding:5px 7px; font-size:var(--fs-tiny); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);"></div>';
  }
  var h = '<div style="margin:0 0 10px; padding:9px 10px; background:var(--bg-secondary); border:1px solid var(--border-color);">'
    + '<div style="font-size:var(--fs-tiny); font-weight:600; color:var(--text-heading); margin-bottom:6px;">Doküman künyesi</div>';
  h += inp('docNo', 'Doküman no', 'FEAD-2026-001');
  h += inp('revision', 'Revizyon', 'A');
  h += '<div><label style="display:block; font-size:var(--fs-micro); color:var(--text-muted); margin-bottom:2px;">Tasarım notları (her satır bir not)</label>'
     + '<textarea rows="3" oninput="veFeadSet(\'' + node.id + '\',\'notes\',this.value)"'
     + ' placeholder="2026-08-18 | Gergi pivotu 5 mm sola alındı"'
     + ' style="width:100%; padding:5px 7px; font-size:var(--fs-tiny); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); resize:vertical;">'
     + _frEsc(d.notes == null ? '' : d.notes) + '</textarea></div>';
  h += '</div>';
  return h;
}

// ═══════════════════ TALEP-ÜZERİNE VARLIK YÜKLEME ═══════════════════════════
// Takoz üretecindeki tuzağın AYNISI burada da geçerli: SAYAÇ DÖNGÜDEN ÖNCE
// kurulur. Artışı döngünün içine koymak, tek dosya build'inde (MFSim_Code.html,
// iki yer tutucu da INLINE ve senkron çalışıyor) ilk yinelemede sayacı sıfıra
// düşürüp done()'u erken ateşliyor; o an ikinci varlık henüz yüklenmemiş
// oluyor ve `finished` mandalı yanlış kararı KALICI yapıyor. index.html'de
// görünmez, yalnız yayınlanan tek dosyada kırılır.
var _frAssetsTried = false;
function _frEnsureAssets(cb){
  var haveT = (typeof window !== 'undefined') && window.FEAD_REPORT_TEMPLATE_B64;
  var haveA = (typeof window !== 'undefined') && window.MNT_REPORT_ASSETS;
  if(haveT && haveA){ cb(true); return; }
  var phs = document.querySelectorAll('script[type="text/x-mfsim-report"]');
  if(!phs.length){ cb(!!(window.FEAD_REPORT_TEMPLATE_B64 && window.MNT_REPORT_ASSETS)); return; }
  var pending = phs.length, finished = false;
  function done(){
    if(finished) return; finished = true;
    cb(!!(window.FEAD_REPORT_TEMPLATE_B64 && window.MNT_REPORT_ASSETS));
  }
  Array.prototype.forEach.call(phs, function(ph){
    var s = document.createElement('script');
    if(ph.src){
      s.src = ph.src;
      s.onload  = function(){ if(--pending <= 0) done(); };
      s.onerror = function(){ if(--pending <= 0) done(); };
      document.head.appendChild(s);
    } else {
      s.textContent = ph.textContent;
      document.head.appendChild(s);
      if(--pending <= 0) done();
    }
  });
}

// ═══════════════════ GİRİŞ NOKTASI ══════════════════════════════════════════
function _frStatus(msg, renk){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-fead-report-status');
  if(el){ el.textContent = msg; el.style.color = renk || 'var(--text-muted)'; }
}
function _frFindReportNode(nodeId){
  if(typeof nodes === 'undefined') return null;
  var n = null;
  if(nodeId) n = nodes.find(function(x){ return x.id === nodeId; });
  if(n) return n;
  return nodes.filter(function(x){
    var d = (typeof componentDefs !== 'undefined' && componentDefs[x.type]) || x.def || {};
    return !!d.isFeadReport;
  })[0] || null;
}

function veFeadGenerateReport(nodeId){
  var node = _frFindReportNode(nodeId);
  var R = _frResults();
  var kind = veFeadReportKind(node);
  // ÇÖZÜLMEMİŞ MODELDE İNDİRME YOK. Boş/yarım bir belge indirmek, kullanıcıya
  // "rapor üretildi" izlenimi verip içinde hiçbir sayı olmayan bir dosya
  // bırakırdı — sessiz başarısızlığın ders kitabı hâli.
  if(!R || !R.ok){
    _frStatus('Rapor üretilemedi: model çözülmemiş. Önce Çözücü → ▶ Çöz.', 'var(--accent-warning)');
    if(typeof showToast === 'function') showToast('Önce Çözücü ile modeli çözün.', 'warning');
    return null;
  }
  _frStatus('Rapor varlıkları yükleniyor (KaTeX + fontlar, ~1 MB)…');
  _frAssetsTried = true;
  _frEnsureAssets(function(ok){
    if(!ok){
      _frStatus('Rapor varlıkları yüklenemedi.', 'var(--accent-danger)');
      if(typeof showToast === 'function') showToast('Rapor varlıkları yüklenemedi.', 'error');
      return;
    }
    var html;
    try {
      html = (kind === 'summary') ? veFeadSummaryHTML(R, node) : _frBuildReportHTML(R, node);
    } catch(e){
      _frStatus('Rapor üretilemedi: ' + (e && e.message ? e.message : e), 'var(--accent-danger)');
      if(typeof showToast === 'function') showToast('Rapor üretilemedi.', 'error');
      return;
    }
    var ad = (kind === 'summary') ? 'MFSim_FEAD_Ozet' : 'MFSim_FEAD_Raporu';
    if(node && node.data && node.data.docNo) ad = String(node.data.docNo).replace(/[^\w.-]+/g, '_')
      + (kind === 'summary' ? '_Ozet' : '');
    _frDownload(html, ad + '_' + _frDateStamp() + '.html');
    _frStatus('Rapor indirildi (' + Math.round(html.length / 1024) + ' KB).', 'var(--accent-success)');
    if(typeof showToast === 'function') showToast('FEAD raporu indirildi.', 'success');
  });
  return true;
}

function _frDateStamp(){
  var d = new Date();
  function p(n){ return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
}
function _frDownload(html, filename){
  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
}

// ═══════════════════ RAPOR MONTAJI ══════════════════════════════════════════
function _frBuildReportHTML(R, node){
  var A = window.MNT_REPORT_ASSETS;
  var tpl = decodeURIComponent(escape(atob(window.FEAD_REPORT_TEMPLATE_B64)));
  var assetsCss = A.fontsCss + '\n' + A.katexCss;
  // '>' ARANMAZ — tarayıcı "<\/script" + boşluk / '/' / '>' ile de kapatır.
  // (Aynı kaçış cp-mount-report.js ve results.js'te de var; üçü aynı kuralı uygular.)
  var katexJs = A.katexJs.replace(/<\/script/gi, '<\\/script');

  var antet   = _frAntet(R, node);
  var figure1 = _frConceptFigure();
  var sec8    = _frSection8(R, node);
  var uygun   = _frCompliance(R);

  // Fonksiyon-replacer ŞART: dinamik HTML içindeki $$…$$ ve $& gibi desenler
  // String.replace'in özel kısaltmalarıyla bozulmasın.
  return tpl
    .replace('@@ASSETS_CSS@@', function(){ return assetsCss; })
    .replace('@@KATEX_JS@@',   function(){ return katexJs; })
    .replace('@@ANTET@@',      function(){ return antet; })
    .replace('@@FIGURE1@@',    function(){ return figure1; })
    .replace('@@SECTION8@@',   function(){ return sec8; })
    .replace('@@COMPLIANCE@@', function(){ return uygun; });
}

// ─── Antet (dinamik başlık bloğu) ────────────────────────────────────────────
function _frAntet(R, node){
  var b = (R.build && R.build.sys && R.build.sys.belt) || {};
  var C = _frCore();
  var bp = null;
  try { bp = C && C.beltProps ? C.beltProps(b) : null; } catch(e){ bp = null; }
  var nP = (R.pulleyNames || []).length;
  var d  = (node && node.data) || {};
  var dok = (d.docNo ? String(d.docNo) : '—') + (d.revision ? ' · rev ' + d.revision : '');
  var kayis = (b.profile || '—') + (b.ribs ? ' · ' + b.ribs + ' kaburga' : '')
            // BİR BASAMAK ŞART: efektif boy tam sayıya yuvarlanınca 1714,6 →
            // "1715" oluyordu, yani KATALOG ADI gibi okunuyordu. Aradaki
            // 0,4 mm kolu 0,56° döndürüp gerginliği %1,5 kaydırıyor (AG00976
            // raporunda ölçüldü), yani bu yuvarlama anlam taşıyan bir farkı
            // gizliyordu.
            + (b.effLength ? ' · ' + _frF(b.effLength, 1) + ' mm' : '');
  var geom = R.analysis && R.analysis.geometry;
  var Leff = (R.analysis && R.analysis.driveLenMm) || (b.effLength || NaN);
  var tarih = new Date().toLocaleDateString('tr-TR', { year:'numeric', month:'long', day:'numeric' });

  var h = '<div class="antet">';
  h += '<div class="band">';
  h += '<div class="eyebrow">MFSim · FEAD Modülü · Otomatik Rapor</div>';
  h += '<h1>Aksesuar Kayış Tahrik Sistemi (FEAD)</h1>';
  h += '<div class="sub">Geometri · Gerginlik ve Hubload · Kayma Emniyeti · Kaburga Yorulması ve B10 Ömrü</div>';
  h += '</div>';
  h += '<div class="fields">';
  h += '<div class="f"><div class="k">Doküman</div><div class="v">' + _frEsc(dok) + '</div></div>';
  h += '<div class="f"><div class="k">Kayış</div><div class="v">' + _frEsc(kayis) + '</div></div>';
  // Antette iki farklı uzunluk yan yana duruyor (kayış künyesi ↔ çözülmüş
  // tahrik boyu) ve ikincisi adsızdı: okuyucu aynı sayının iki kez basıldığını
  // sanıp aradaki farkı yuvarlama zannediyordu.
  h += '<div class="f"><div class="k">Sistem</div><div class="v">' + nP + ' kasnak · tahrik boyu '
     + _frF(Leff, 1) + ' mm</div></div>';
  h += '<div class="f"><div class="k">Çözüm</div><div class="v">Yarı-statik · kalibre çekirdek</div></div>';
  h += '<div class="f"><div class="k">Tarih</div><div class="v">' + _frEsc(tarih) + '</div></div>';
  h += '</div></div>';
  return h;
}

// ─── Şekil 1 — kavramsal çizim (teoride, modele bağlı DEĞİL) ────────────────
// Dört kasnaklı şematik bir FEAD: sürücü krank, bir aksesuar, sırttan temas
// eden bir avara ve bir gergi. Modelin hiçbir sayısını almaz — §2'nin görsel
// karşılığıdır ve her raporda AYNI çizilir.
//
// GEOMETRİ ÇEKİRDEKTEN GELİR, ELLE YAZILMAZ. Önceki sürümde yol koordinatları
// elle yazılmıştı ve BEŞ ucun BEŞİ de yanlış yerdeydi (ölçüldü): krankın
// "sarım yayı" kasnak çeperinden 29 px uzakta başlıyor, yarıçapı 70 olduğu
// için merkezi (630,130) yerine (560,130)'a düşüyor ve kasnağın MERKEZİNDEN
// geçen bir yarım çember çiziyordu; aksesuar yayının kirişi 2r'den uzun olduğu
// için SVG yarıçapı 62 → 64.2'ye büyütüp merkezi kasnaktan 96 px uzağa
// oturtuyordu — kayış o kasnağa hiç DEĞMİYORDU. Hepsi tek sebepten: teğet
// noktası göz kararı yazılamaz, çözülmesi gerekir.
//
// `FEADCore.solveGeometry` teğet noktalarını, sarım açılarını ve dönüş
// yönlerini çözer; üstelik kapalı çevrim değişmezini (Σ işaretli sarım = 360°)
// ve kayış yolunun bir kasnağın içinden geçmediğini DOĞRULAR — yani bu şekil
// kurulduğu anda geçerlidir, gözle denetlenmesi gerekmez. Yerleşim, doğrulama
// takımındaki AG00686'nın topolojisiyle aynı ailedendir (iki kaburgalı büyük
// kasnak, ana eksenin karşı taraflarında iki sırt kasnağı): sarımlar
// 216 / 32 / 200 / 23° çıkıyor, referansın 208 / 27 / 201 / 22°'sine komşu.
var _FR_CONCEPT = {
  pulleys: [                                    // kayış GİDİŞ sırasında
    { name:'Krank',    etiket:'Krank (sürücü)',      c:[   0,   0], r:85, contact:'grooved', altta:true  },
    { name:'Avara',    etiket:'Avara (sırt teması)', c:[-185,  55], r:38, contact:'back',    altta:false },
    { name:'Aksesuar', etiket:'Aksesuar',            c:[-500,   0], r:65, contact:'grooved', altta:true  },
    { name:'Gergi',    etiket:'Gergi (sırt teması)', c:[-300, -65], r:38, contact:'back',    altta:true  }
  ],
  pivot: [-400, -95],                           // gergi kolu dayanağı
  phi: 0,                                       // sarım açısı işaretini taşıyan kasnak
  phiRingMm: 16                                 // işaret halkasının çeperden açıklığı
};

// Rapor CSS'i SVG yazılarını IBM Plex Mono'ya sabitliyor (`svg text` kuralı),
// yani karakter genişliği SABİT: 0.6 em. Eski şekilde bu hesaba katılmamıştı
// ve alt künye satırı 820'lik viewBox'ı 32 px aşıp KIRPILIYORDU — ekranda
// "…kesikli: sırt t" diye kesiliyordu (ölçüldü). Etiketler artık bu genişlikle
// yerleştiriliyor; çerçeveye sığdıkları testle kilitli.
function _frTxtW(s, fs){ return String(s).length * fs * 0.6; }

function _frConceptFigure(){
  var C = _frCore();
  if(!C || !C.solveGeometry) return '';
  var P = _FR_CONCEPT.pulleys, geo;
  try {
    geo = C.solveGeometry(P.map(function(p){
      return { name:p.name, c:p.c.slice(), rPitch:p.r, rEff:p.r, contact:p.contact };
    }));
  } catch(e){ return ''; }                      // çekirdek gerilerse şekil yerine boşluk

  var W = 820, H = 330, padX = 26, padT = 34, padB = 54;
  var n = P.length, PHI = _FR_CONCEPT.phi, phiR = _FR_CONCEPT.phiRingMm, pv = _FR_CONCEPT.pivot;

  // SINIRLARA İŞARETLER DE GİRER: sarım halkası çeperden 16 mm dışarıda, φ
  // etiketi daha da dışarıda, pivot ise kasnak kümesinin tamamen dışında.
  // Ölçeğe katılmazlarsa çerçeveden taşıp kırpılırlar.
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  P.forEach(function(p, i){
    var r = p.r + (i === PHI ? phiR + 14 : 0);
    minX = Math.min(minX, p.c[0]-r); maxX = Math.max(maxX, p.c[0]+r);
    minY = Math.min(minY, p.c[1]-r); maxY = Math.max(maxY, p.c[1]+r);
  });
  minX = Math.min(minX, pv[0]); maxX = Math.max(maxX, pv[0]);
  minY = Math.min(minY, pv[1]); maxY = Math.max(maxY, pv[1]);

  var spanX = maxX-minX, spanY = maxY-minY;
  var s = Math.min((W-2*padX)/spanX, (H-padT-padB)/spanY);
  var offX = padX + ((W-2*padX) - spanX*s)/2;
  var offY = padT + ((H-padT-padB) - spanY*s)/2;
  // ty() mm düzlemini EKRANDA AYNI YÖNDE gösterir (yönelim korunur); SVG'nin
  // açı sistemi y-aşağı olduğu için mm düzleminde CCW olan (d > 0) yay SVG'de
  // NEGATİF yöndedir → sweep = 0. Kayış Yolu kartındaki kuralın AYNISI; iki
  // çizim aynı konvansiyonu paylaşmazsa biri sessizce aynalanır.
  function tx(x){ return offX + (x-minX)*s; }
  function ty(y){ return offY + (maxY-y)*s; }
  function f(v){ return Math.round(v*100)/100; }
  function pt(c){ return f(tx(c[0])) + ' ' + f(ty(c[1])); }

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Kavramsal FEAD şeması">';
  svg += '<defs><marker id="frArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7"'
       + ' orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#8a5a1e"/></marker></defs>';

  // ── gergi kolu ve pivotu (kayışın ALTINDA kalsın diye önce çizilir) ─────
  svg += '<line x1="' + f(tx(pv[0])) + '" y1="' + f(ty(pv[1])) + '" x2="' + f(tx(P[3].c[0]))
       + '" y2="' + f(ty(P[3].c[1])) + '" stroke="#2e7d4f" stroke-width="1.8" stroke-dasharray="5 4"/>';
  var px = f(tx(pv[0])), py = f(ty(pv[1])), a = 7;
  svg += '<g stroke="#2e7d4f" stroke-width="2">'
       + '<line x1="' + f(px-a) + '" y1="' + py + '" x2="' + f(px+a) + '" y2="' + py + '"/>'
       + '<line x1="' + px + '" y1="' + f(py-a) + '" x2="' + px + '" y2="' + f(py+a) + '"/></g>';
  svg += '<text x="' + f(px-11) + '" y="' + f(py+4) + '" text-anchor="end" font-size="12" fill="#2e7d4f">pivot</text>';

  // ── kayış yolu: çekirdeğin teğet uçları + işaretli sarım yayları ────────
  var d = '';
  for(var i=0;i<n;i++){
    var sp = geo.spans[i], q = geo.pulleys[(i+1)%n], spN = geo.spans[(i+1)%n];
    if(i === 0) d += 'M' + pt(sp.Pi);
    d += ' L' + pt(sp.Pj);
    var R = f(q.rPitch*s), wrap = geo.wraps[(i+1)%n];
    d += ' A' + R + ' ' + R + ' 0 ' + (wrap > Math.PI ? 1 : 0) + ' ' + (q.d > 0 ? 0 : 1) + ' ' + pt(spN.Pi);
  }
  svg += '<path d="' + d + ' Z" fill="none" stroke="#c8781e" stroke-width="5" stroke-linejoin="round"/>';

  // ── kasnaklar: düz çeper = kaburgalı temas, kesikli = sırt teması ───────
  P.forEach(function(p){
    var cx = f(tx(p.c[0])), cy = f(ty(p.c[1]));
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + f(p.r*s) + '" fill="none"'
         + ' stroke="#24425f" stroke-width="2"' + (p.contact === 'back' ? ' stroke-dasharray="6 5"' : '') + '/>'
         + '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="#24425f"/>';
  });

  // ── ETİKET YERLEŞTİRİCİ: çakışana kadar iter ─────────────────────────────
  // İstenen yönde adım adım ilerleyip bütün kasnak çemberlerinden ve çerçeveden
  // çıkan ilk konumu seçer. Elle ayarlanmış bir koordinat daha yazmak, bu
  // şekilde düzeltmeye çalıştığımız hatanın ta kendisi olurdu.
  function _yerlestir(ax, ay, dx, dy, metin, fs){
    var w = _frTxtW(metin, fs), hh = fs*1.2;
    var X = tx(ax), Y = ty(ay), DX = dx, DY = -dy;          // ekran yönü: y ters
    var L2 = Math.sqrt(DX*DX+DY*DY) || 1; DX /= L2; DY /= L2;
    var cx = X + DX*16, cy = Y + DY*16;
    for(var adim=0; adim<48; adim++){
      cx = X + DX*(16 + adim*5); cy = Y + DY*(16 + adim*5);
      var sol = cx - w/2, ust = cy - hh, alt = cy + 3;
      if(sol < 6 || sol + w > W-6 || ust < 4 || alt > H-22) continue;
      var carpti = false;
      P.forEach(function(p){
        var qx = tx(p.c[0]), qy = ty(p.c[1]), rp = p.r*s + 3;
        var ddx = Math.max(Math.abs(qx-cx) - w/2, 0);
        var ddy = Math.max(Math.abs(qy-(cy-hh/2)) - hh/2, 0);
        if(ddx*ddx + ddy*ddy < rp*rp) carpti = true;
      });
      if(!carpti) break;
    }
    return { x:cx, y:cy, ax:X, ay:Y, w:w, h:hh };
  }
  function _leader(L){                                       // etikete ince kılavuz
    var vx = L.x - L.ax, vy = L.y - L.ay, vl = Math.sqrt(vx*vx+vy*vy) || 1;
    var ex = L.x - vx/vl*(L.w*0.28), ey = L.y - vy/vl*7 - 4;
    return '<path d="M' + f(L.ax) + ' ' + f(L.ay) + ' L' + f(ex) + ' ' + f(ey)
         + '" stroke="#5a6270" stroke-width="1" stroke-dasharray="3 3" opacity="0.85"/>';
  }

  // ── sarım açısı işareti: kasnağın GERÇEK giriş/çıkış teğetleri arasındaki
  // açı, klasik teknik resim gösterimiyle — merkezden iki teğet noktasına ince
  // birer yarıçap, aralarında küçük bir yay, ortada φ.
  // ÖNCE kasnağın DIŞINA, çeperden 16 mm açıklıkta bir halka olarak çizilmişti
  // ve tarayıcıda ölçüldü: 216°'lik o yay ikinci bir kayış gibi okunuyor,
  // çerçevenin sağ ucuna dayanıyor ve "Krank (sürücü)" etiketinin üstünden
  // geçiyordu. Açı işareti kasnağın İÇİNDE hiçbir şeyle yarışmıyor.
  var pP = P[PHI], gP = geo.pulleys[PHI];
  var Tin  = geo.spans[(PHI-1+n)%n].Pj, Tout = geo.spans[PHI].Pi;
  var aIn  = Math.atan2(Tin[1]-pP.c[1], Tin[0]-pP.c[0]);
  var wrapP = geo.wraps[PHI], dirP = (gP.d > 0) ? 1 : -1, ri = pP.r*0.46;
  function onRing(ang, rad){ return [pP.c[0] + rad*Math.cos(ang), pP.c[1] + rad*Math.sin(ang)]; }
  svg += '<path d="M' + pt(pP.c) + ' L' + pt(Tin) + ' M' + pt(pP.c) + ' L' + pt(Tout)
       + '" stroke="#8a5a1e" stroke-width="1.1" stroke-dasharray="4 3" opacity="0.9"/>';
  svg += '<path d="M' + pt(onRing(aIn, ri)) + ' A' + f(ri*s) + ' ' + f(ri*s) + ' 0 '
       + (wrapP > Math.PI ? 1 : 0) + ' ' + (dirP > 0 ? 0 : 1) + ' ' + pt(onRing(aIn + dirP*wrapP, ri))
       + '" fill="none" stroke="#8a5a1e" stroke-width="1.8" marker-end="url(#frArr)"/>';
  var phiLb = onRing(aIn + dirP*wrapP/2, ri + 15);
  svg += '<text x="' + f(tx(phiLb[0])) + '" y="' + f(ty(phiLb[1])+5) + '" text-anchor="middle"'
       + ' font-size="14" fill="#8a5a1e">φ</text>';

  // ── serbest açıklık (span) künyesi: EN UZUN açıklığın dışına ────────────
  // Ölçü çizgisi o açıklığın GERÇEK teğet uçlarından ofsetlenir ve iki ucu
  // çentiklidir; eski şekilde bağımsız bir doğruydu ve hiçbir açıklığı
  // göstermiyordu. Yazı ölçü çizgisinin ÜSTÜNE değil, yerleştiriciyle boş
  // alana konur — çizginin üstüne basılınca ikisi de okunmuyordu (ölçüldü).
  var best = 0;
  for(var k=1;k<n;k++) if(geo.spans[k].L > geo.spans[best].L) best = k;
  var spB = geo.spans[best];
  var ux = spB.Pj[0]-spB.Pi[0], uy = spB.Pj[1]-spB.Pi[1], LB = Math.sqrt(ux*ux+uy*uy);
  if(LB > 1){
    ux /= LB; uy /= LB;
    var nx = -uy, ny = ux;                                   // dışa doğru normal
    var mx = (spB.Pi[0]+spB.Pj[0])/2, my = (spB.Pi[1]+spB.Pj[1])/2;
    if((mx-(minX+maxX)/2)*nx + (my-(minY+maxY)/2)*ny < 0){ nx = -nx; ny = -ny; }
    var off = 13/s, tick = 5/s;
    function onSpan(t, o){ return [spB.Pi[0] + ux*LB*t + nx*o, spB.Pi[1] + uy*LB*t + ny*o]; }
    svg += '<path d="M' + pt(onSpan(0,0)) + ' L' + pt(onSpan(0,off+tick)) + '" stroke="#5a6270" stroke-width="1"/>'
         + '<path d="M' + pt(onSpan(1,0)) + ' L' + pt(onSpan(1,off+tick)) + '" stroke="#5a6270" stroke-width="1"/>'
         + '<path d="M' + pt(onSpan(0,off)) + ' L' + pt(onSpan(1,off)) + '" stroke="#5a6270" stroke-width="1"'
         + ' stroke-dasharray="4 3"/>';
    var anc = onSpan(0.5, off);
    var Lb = _yerlestir(anc[0], anc[1], nx, ny, 'serbest açıklık (span) L', 12);
    svg += _leader(Lb);
    svg += '<text x="' + f(Lb.x) + '" y="' + f(Lb.y) + '" text-anchor="middle" font-size="12"'
         + ' fill="#5a6270">serbest açıklık (span) L</text>';
  }

  // ── kasnak etiketleri: çeperin dışına, çerçeveye SIĞACAK biçimde ────────
  P.forEach(function(p){
    var fs = 12.5, w = _frTxtW(p.etiket, fs);
    var x = Math.max(w/2 + 4, Math.min(W - w/2 - 4, tx(p.c[0])));
    var y = p.altta ? (ty(p.c[1]-p.r) + 16) : (ty(p.c[1]+p.r) - 9);
    svg += '<text x="' + f(x) + '" y="' + f(y) + '" text-anchor="middle" font-size="' + fs
         + '" fill="#24425f">' + _frEsc(p.etiket) + '</text>';
  });

  // ── alt künye: çeper dokusunun ve renklerin ne anlattığı ────────────────
  svg += '<text x="14" y="' + (H-10) + '" font-size="12" fill="#5a6270">'
       + 'düz çeper: kaburgalı yüz teması · kesikli çeper: sırt teması · turuncu: kayış · yeşil: gergi kolu</text>';
  svg += '</svg>';

  // ŞEKİL NUMARASI SABİT 1: bu şekil teoride, §8'in sayaç sıfırlamasından
  // ÖNCE üretiliyor. _frFig() çağırmak numarayı önceki üretimden devralırdı.
  return '<figure>' + svg + '<figcaption><b>Şekil 1 —</b> Kavramsal FEAD şeması. Kayış krank kasnağından '
    + 'çıkar, aksesuarları dolaşır ve krank girişine döner. Kaburgalı yüzden temas eden kasnaklar kayışın '
    + 'bir yüzünü, sırttan temas edenler (kesikli çeper) öbür yüzünü görür; bu fark sarım açılarının '
    + 'işaretini ve dolayısıyla kapalı çevrim değişmezini belirler (§3.4). Şeklin bütün teğet noktaları, '
    + 'sarım yayları ve dönüş yönleri §3\'ün çözücüsüyle hesaplanmıştır — çizimde elle yerleştirilmiş '
    + 'koordinat yoktur.</figcaption></figure>';
}

// ═══════════════════ §8 — SAYISAL ÖRNEK (dinamik) ═══════════════════════════
function _frSection8(R, node){
  // Sayaçlar BURADA sıfırlanır, montaj fonksiyonunda değil: §8 her üretimde
  // 1'den başlamalı ve Uygunluk bölümü numaralandırmayı SÜRDÜRMELİ.
  // Şekil 1 teoride (kavramsal çizim) olduğu için dinamik şekiller 2'den başlar.
  _frTblNo = 0; _frFigNo = 1; _frEqNo = 0; _frEqRef = {};
  var h = _frH2(0);
  h += '<p>Bölüm 3–7\'deki yöntem, projede tanımlı FEAD modeline uygulanır. Kasnaklar, kayış künyesi, '
     + 'gergi parametreleri ve çalışma çevrimi iç topolojiden otomatik toplanır; girdiler aşağıda '
     + 'listelenir, ardından geometri, gergi çalışma noktası, gerginlik zinciri, hubload\'lar, kayma '
     + 'emniyeti, kaburga yorulması ve ömür bu modelin gerçek değerleriyle çözülür. Uzunluk mm, '
     + 'kuvvet N, güç kW, açı derece.</p>';
  h += _frWarnBox(R);
  h += _frSummary(R);
  h += _frBeltTable(R);
  h += _frPulleyTable(R);
  h += _frTensionerTable(R);
  h += _frLayoutFigure(R);
  h += _frGeometryTable(R);
  h += _frOperatingPoint(R);
  h += _frPositionTable(R);
  h += _frTakeupFigure(R);
  h += _frDutyInputTable(R);
  h += _frTensionTables(R);
  h += _frSlipSection(R);
  h += _frTorqueSection(R);
  h += _frFatigueSection(R);
  h += _frLoadContribTable(R);
  h += _frLifeSection(R);
  h += _frFreqSection(R);
  h += _frTorsionalSection(R);
  h += _frNotesSection(node);
  return h;
}

// 8.0 — çözümün taşıdığı uyarılar
function _frWarnBox(R){
  var w = [];
  (R.warnings || []).forEach(function(x){ w.push(x); });
  var b = R.build || {};
  (b.warnings || []).forEach(function(x){ w.push(x); });
  if(!w.length) return '';
  var h = '<div class="note warn"><span class="t">Çözümün taşıdığı uyarılar</span><ul style="margin:4px 0 0 18px;">';
  w.forEach(function(x){ h += '<li>' + _frEsc(x) + '</li>'; });
  h += '</ul></div>';
  return h;
}

// 8.1 — kritik sonuç özeti
function _frSummary(R){
  var A = R.analysis || {}, g = R.build && R.build.sys;
  var sigma = _frSignedWrap(R);
  var kapali = Number.isFinite(sigma) && Math.abs(Math.abs(sigma) - 360) <= 0.05;
  var minSF = _frMinSF(R);
  var sf = _frNum(R.serviceFact);
  var sfOK = !Number.isFinite(sf) || !(sf > 0) || (Number.isFinite(minSF) && minSF >= sf);
  var life = R.life || {};
  var iyi = kapali && sfOK;
  var h = '<h3>8.1 Kritik sonuç özeti</h3>';
  h += '<div class="note ' + (iyi ? 'check' : 'warn') + '">';
  h += '<span class="t">' + (iyi ? 'Model tutarlı' : 'Dikkat gerektiren bulgu var') + '</span>';
  function sat(k, v){ return '<div style="margin:3px 0;"><strong style="color:var(--prusya);">' + k + ':</strong> ' + v + '</div>'; }
  h += sat('Kapalı çevrim', 'Σ işaretli sarım = <b>' + _frFs(sigma, 2) + '°</b> '
        + (kapali ? '<span class="ok">✓</span>' : '<b>(360° olmalı)</b>'));
  // İKİ AYRI UZUNLUK, tek başlık altında basılıyordu ve baştaki sayı kayışın
  // künyesindeki boy sanılıyordu. driveLenMm kayışın o güzergâhta kat ettiği
  // TAHRİK boyudur (Gates "Effective Drive Length"); requiredBeltMm ise o
  // güzergâhı veren kayışın efektif boyudur (Gates "Required Eff. Belt
  // Length") ve künyedeki değerle karşılaştırılacak olan budur. §8.8'in
  // tablosu ikisini zaten bu adlarla ayırıyor; özet satırı ayırmıyordu.
  var bEff = _frNum(g && g.belt && g.belt.effLength);
  h += sat('Tahrik boyu', _frFs(A.driveLenMm, 1) + ' mm · gereken kayış boyu <b>'
        + _frFs(A.requiredBeltMm, 1) + '</b> mm'
        + (Number.isFinite(bEff) ? ' · künyedeki efektif boy ' + _frFs(bEff, 1) + ' mm' : ''));
  h += sat('Gergi çalışma noktası', 'kol ' + _frFs(A.meanRelDeg, 1) + '° (göreli) · '
        + _frFs(A.meanAbsDeg, 1) + '° (mutlak) · gerginlik <b>' + _frF(A.tensioner && A.tensioner.tensionN, 0) + ' N</b>');
  h += sat('En düşük kayma emniyeti (yük taşıyan kasnaklarda)', Number.isFinite(minSF)
        ? ('<b>' + _frFs(minSF, 2) + '</b>' + (Number.isFinite(sf) && sf > 0 ? ' (istenen ≥ ' + _frF(sf, 2) + ')' : '')
           + (sfOK ? ' <span class="ok">✓</span>' : ' <b>✗</b>'))
        : '—');
  h += sat('B10 kayış ömrü', Number.isFinite(_frNum(life.hoursB10))
        ? (_frF(life.hoursB10, 0) + ' saat' + (life.inValidRange ? ' <span class="ok">✓ geçerlilik penceresinde</span>'
            : ' <b>(çap penceresi dışında — §8.16)</b>'))
        : '—');
  h += sat('Çalışma çevrimi', ((R.duty || []).length) + ' devir noktası · toplam duty '
        + _frF(_frDutySum(R), 1) + '%');
  h += '</div>';
  return h;
}
function _frSignedWrap(R){
  var g = R.analysis && R.analysis.geometry;
  var sys = R.build && R.build.sys;
  if(!g || !sys) return NaN;
  var t = 0;
  g.forEach(function(row, i){
    var p = sys.pulleys[i];
    var isG = p && p.contact !== 'back';
    t += (isG ? 1 : -1) * _frNum(row.wrapDeg);
  });
  return t;
}
// KAYMA EMNİYETİ İKİ AYRI SORUYU CEVAPLIYOR ve tek bir "en düşük SF" ikisini
// birbirine karıştırıyordu.
//
// SF = capstan kapasitesi / fiili gerginlik oranı. Yük ÇEKMEYEN bir kasnakta
// (avara, gergi) fiili oran ~1,00'dir; SF o zaman kapasitenin ta kendisi olur —
// yani bir MARJ değil, o sarım açısının taşıyabileceği azami orandır. Servis
// faktörü ise TALEBİN üzerine konan bir marjdır; talep yokken anlamsızdır.
//
// ÖLÇÜLDÜ (AG00976, 880 d/d): yük taşıyan üç kasnakta oran 1,348–2,538 ve
// SF 4,58–16,73; yük taşımayan üçünde oran 1,0010–1,0024 ve SF 1,232–1,479.
// İki küme arasında iki mertebe fark var, yani ayrımın eşiği kritik değil.
// Eski kod global en düşüğü (1,23) alıp servis faktörüyle karşılaştırıyor,
// "tasarım onaylanmamalıdır" hükmü veriyor ve çaresini "tasarım gerginliğini
// yükseltin" diye yazıyordu — oysa raporun kendi §8.7'si "yük çekmeyen
// kasnaklarda gerginlik oranı 1'dir ve SF hiç değişmez" diyor: önerilen çare
// o kasnakta ÖLÇÜLEBİLİR BİR ETKİ YAPMAZ. Gates'in aynı sistem için bastığı
// "Belt Slip Sensitivity" sayfası da altı kasnağın hiçbirinde artış istemiyor.
//
// Ayrım gizleme değil: tablo bütün kasnakları ve bütün sayıları basmaya devam
// eder, yalnız HÜKÜM yük taşıyanlara dayanır ve taşımayanlar ayrıca yazılır.
var VE_FR_SLIP_LOADED_RATIO = 1.01;   // bu oranın altı "yük taşımıyor" sayılır

function _frSlipStats(R){
  var out = { min: NaN, minName: '', minRpm: NaN, minRatio: NaN,
              loadedMin: NaN, loadedName: '', loadedRpm: NaN,
              idle: [] , anyLoaded: false };
  var m = Infinity, lm = Infinity, gorulen = {};
  ((R.analysis && R.analysis.duty) || []).forEach(function(d){
    (d.slip || []).forEach(function(s){
      var v = _frNum(s.SF), r = _frNum(s.tensionRatio);
      if(!Number.isFinite(v)) return;
      if(v < m){ m = v; out.minName = s.name; out.minRpm = d.engineRpm; out.minRatio = r; }
      if(Number.isFinite(r) && r >= VE_FR_SLIP_LOADED_RATIO){
        out.anyLoaded = true;
        if(v < lm){ lm = v; out.loadedName = s.name; out.loadedRpm = d.engineRpm; }
      } else if(!gorulen[s.name]){
        gorulen[s.name] = 1;
        out.idle.push({ name: s.name, SF: v, ratio: r, cap: _frNum(s.capstanCapacity) });
      }
    });
  });
  out.min = Number.isFinite(m) ? m : NaN;
  out.loadedMin = Number.isFinite(lm) ? lm : NaN;
  return out;
}
// Hükmü veren sayı: yük taşıyan kasnakların en düşüğü. Hiç yük taşıyan kasnak
// yoksa (bütün güçler sıfır) global en düşüğe düşülür — orada da bir hüküm
// vermek gerekiyor ve tek elde olan o.
function _frMinSF(R){
  var st = _frSlipStats(R);
  return st.anyLoaded ? st.loadedMin : st.min;
}
function _frDutySum(R){
  var t = 0;
  (R.duty || []).forEach(function(d){ t += _frNum(d.dcPct) || 0; });
  return t;
}

// 8.2 — kayış künyesi
function _frBeltTable(R){
  var sys = R.build && R.build.sys; if(!sys) return '';
  var b = sys.belt || {}, C = _frCore(), bp = null;
  try { bp = C && C.beltProps ? C.beltProps(b) : null; } catch(e){}
  var h = '<h3>8.2 Kayış künyesi</h3>';
  h += '<table><caption>Tablo ' + _frTbl() + ' — Kayış özellikleri (girdi ve profil sabitleri)</caption>';
  h += '<tr><th>Büyüklük</th><th>Değer</th><th>Birim</th><th>Kaynak</th></tr>';
  function tr(k, v, u, src){ return '<tr><td class="l">' + k + '</td><td>' + v + '</td><td class="c">' + (u || '—') + '</td><td class="l">' + src + '</td></tr>'; }
  h += tr('Profil', _frEsc(b.profile || '—'), '—', 'girdi');
  h += tr('Marka / tip', _frEsc((b.brand || '—') + (b.beltType ? ' · ' + b.beltType : '')), '—', 'girdi');
  h += tr('Kaburga (kanal) sayısı', _frF(b.ribs, 0), '—', 'girdi');
  h += tr('Efektif boy L<sub>eff</sub>', _frFs(b.effLength, 1), 'mm', 'girdi');
  h += tr('Boy toleransı ±', _frFs(b.tolerance, 1), 'mm', 'girdi');
  // BİRİM TUZAĞI: wearPct çekirdekte ORAN (0,007), tedarikçi sayfasında YÜZDE
  // (%0,70). Ham basılsaydı raporda "%0,007" görünür ve okuyan kişi payı
  // yüz kat küçük sanırdı. Testi var.
  h += tr('Uzama + aşınma payı', _frPct(_frNum(b.wearPct) * 100, 2), '% (boyun)', 'girdi (oran olarak saklanır)');
  if(bp){
    h += tr('Kaburgalı yüz kord ofseti h<sub>b</sub>', _frFs(bp.hb, 2), 'mm', 'profil sabiti');
    h += tr('Sırt kord ofseti h<sub>r</sub>', _frFs(bp.hr, 2), 'mm', 'profil sabiti');
    h += tr('Kaburga adımı', _frFs(bp.ribPitch, 2), 'mm', 'profil sabiti');
    h += tr('Kayış kalınlığı', _frFs(bp.thickness, 2), 'mm', 'profil sabiti');
    h += tr('Birim uzunluk kütlesi m′', _frFs(_frNum(bp.massPerRibKgM) * _frNum(b.ribs), 4), 'kg/m', 'profil sabiti × kaburga');
    h += tr('En küçük kasnak çapı', _frFs(bp.minPulleyDia, 0), 'mm', 'profil sınırı');
    h += tr('Azami kayış hızı', _frFs(bp.maxSpeedMs, 0), 'm/s', 'profil sınırı');
  }
  h += '</table>';
  return h;
}

// 8.3 — kasnak yerleşimi
function _frPulleyTable(R){
  var sys = R.build && R.build.sys; if(!sys) return '';
  var h = '<h3>8.3 Kasnak yerleşimi ve temas tarafı</h3>';
  h += '<p>Konumlar kayış düzleminde, kasnak merkezlerinin koordinatlarıdır. <b>Temas tarafı bir GİRDİDİR</b> '
     +'ve ters verilirse model geçerli ama başka bir güzergâh çözer (§3.4) — bu yüzden burada tekrar basılır.</p>';
  h += '<table><caption>Tablo ' + _frTbl() + ' — Kasnak yerleşim verisi (kayış gidiş sırasında)</caption>';
  h += '<tr><th>#</th><th>Kasnak</th><th>X</th><th>Y</th><th>Dış çap</th><th>Pitch Ø</th><th>Efektif Ø</th><th>Temas</th><th>Rol</th><th>Atalet</th></tr>';
  // GERGİ SATIRININ X/Y'Sİ "—" BASILIYORDU ve tablo o yüzden yarım okunuyordu:
  // gergi kasnağının konumu bir GİRDİ değil ama BİLİNMEYEN de değil — çözülmüş
  // çalışma (Mean) merkezidir ve §8.8'in tablosunda zaten var. Burada da
  // basılıyor, ama TÜREV olduğu işaretli kalsın diye eğik ve † ile.
  var tenC = (R.analysis && R.analysis.tensioner && R.analysis.tensioner.center) || null;
  var gergiTurev = false;
  sys.pulleys.forEach(function(p, i){
    var rol = p.crank ? 'sürücü' : (p.tensioner ? 'gergi' : (_frNum(p.inertiaKgM2) >= 0 ? 'aksesuar/avara' : '—'));
    var px = _frNum(p.x), py = _frNum(p.y), tur = false;
    if(p.tensioner && !(Number.isFinite(px) && Number.isFinite(py)) && tenC){
      px = _frNum(tenC[0]); py = _frNum(tenC[1]);
      tur = Number.isFinite(px) && Number.isFinite(py);
      if(tur) gergiTurev = true;
    }
    var hx = tur ? '<em>' + _frFs(px, 2) + '</em>†' : _frFs(px, 2);
    var hy = tur ? '<em>' + _frFs(py, 2) + '</em>' : _frFs(py, 2);
    h += '<tr><td class="c">' + (i + 1) + '</td><td class="l">' + _frEsc(p.name) + '</td>'
      + '<td>' + hx + '</td><td>' + hy + '</td>'
      + '<td>' + _frFs(p.od, 1) + '</td><td>' + _frFs(_frNum(p.rPitch) * 2, 1) + '</td>'
      + '<td>' + _frFs(_frNum(p.rEff) * 2, 1) + '</td>'
      + '<td class="c">' + (p.contact === 'back' ? 'sırt' : 'kaburgalı') + '</td>'
      + '<td class="c">' + rol + '</td>'
      + '<td>' + (Number.isFinite(_frNum(p.inertiaKgM2)) ? _frFs(p.inertiaKgM2, 4) : '—') + '</td></tr>';
  });
  h += '</table>';
  // §8.7'nin tablosunda X/Y YOKTUR (kol açısı, sarım, β, take-up, moment,
  // gerginlik, hubload var); konum tablosu §8.8'dedir. Referans oraya
  // gidiyordu ve okuyucu bulamıyordu.
  h += '<p style="font-size:13px;color:#5a6270;">Pitch ve efektif çaplar dış çaptan (3.1) ile türetilir. '
     + (gergiTurev
         ? '<b>†</b> Gergi kasnağının X/Y değeri bir <b>girdi değildir</b>: kolun çalışma (Mean) '
           + 'açısından çözülür (§8.7) ve kayış boyu değiştikçe kayar — altı konumun tamamı §8.8\'dedir.'
         : 'Gergi kasnağının konumu çalışma noktasından çözülür (§8.8).')
     + '</p>';
  return h;
}

// 8.4 — gergi künyesi
function _frTensionerTable(R){
  var sys = R.build && R.build.sys; if(!sys || !sys.tensioner) return '';
  var t = sys.tensioner, b = R.build || {}, A = R.analysis || {};
  var h = '<h3>8.4 Otomatik gergi künyesi</h3>';
  h += '<table><caption>Tablo ' + _frTbl() + ' — Gergi parametreleri</caption>';
  h += '<tr><th>Büyüklük</th><th>Değer</th><th>Birim</th></tr>';
  function tr(k, v, u){ return '<tr><td class="l">' + k + '</td><td>' + v + '</td><td class="c">' + (u || '—') + '</td></tr>'; }
  h += tr('Pivot X / Y', _frFs(t.pivot && t.pivot[0], 2) + ' / ' + _frFs(t.pivot && t.pivot[1], 2), 'mm');
  h += tr('Kol boyu a', _frFs(t.armLength, 1), 'mm');
  h += tr('Yay ön yükü M<sub>0</sub>', _frFs(t.preloadNm, 2), 'Nm');
  h += tr('Yay oranı k', _frFs(t.rateNmPerDeg, 3), 'Nm/°');
  h += tr('Serbest kol açısı θ<sub>serbest</sub>', _frFs(t.freeAngleDeg, 2), '°');
  h += tr('Sarım yönü (sense)', (t.sense > 0 ? '+1 (CCW)' : '−1 (CW)'), '—');
  if(b.angleMode)
    h += tr('Açı kipi', b.angleMode === 'mount' ? 'montaj merkezinden türetildi' : 'serbest açı doğrudan girildi', '—');
  if(b.mount && b.mount.ok){
    h += tr('Montaj merkezi (girdi)', _frFs(b.mount.cen[0], 2) + ' / ' + _frFs(b.mount.cen[1], 2), 'mm');
    h += tr('Koordinatlardan kol boyu', _frFs(b.mount.armFromCoords, 3), 'mm');
  }
  if(A.tensioner) h += tr('Çalışma noktası yay momenti', _frFs(A.tensioner.springNm, 2), 'Nm');
  h += '</table>';
  return h;
}

// 8.5 — yerleşim şeması (canlı kart üreteci yeniden kullanılır)
function _frLayoutFigure(R){
  var svg = null;
  try {
    if(typeof veFeadLayoutSVG === 'function' && R.build)
      svg = veFeadLayoutSVG(R.build, 820, 360, { posMode: 'mean', compass: true, pivot: true, arrows: true });
  } catch(e){ svg = null; }
  if(!svg) return '';
  // class="appfig": bu şekil UYGULAMANIN çizicisinden geliyor ve onun palet
  // jetonlarını kullanıyor; şablon CSS'i o jetonları bu sınıf altında raporun
  // baskı paletine bağlıyor. Sınıf düşerse çizim görünmez olur (testi var).
  return '<h3>8.5 Çözülmüş kayış yolu</h3>'
    + '<figure class="appfig">' + svg + '<figcaption><b>Şekil ' + _frFig() + ' —</b> Çalışma (Mean) konumunda çözülmüş kayış yolu: '
    + 'teğet noktaları, işaretli sarım yayları, gergi pivotu ve kolu, dönüş yönleri. Yol üstündeki dişler '
    + 'kayışın kaburgalı yüzünü gösterir — kaburgalı temas eden kasnakta içeri, sırttan temas edende dışarı bakar. '
    + 'Çizim mm ölçeğindedir ve kanvastaki düğüm konumlarından bağımsızdır.</figcaption></figure>';
}

// 8.6 — çözülmüş geometri
// ═══════════════ AÇILARIN KURULUŞU — φ, β ve take-up ════════════════════════
// Mühendis sorusu (2026-08-24): "Take-up oranı nasıl hesaplanıyor, bir girdi
// giriyor muyuz? φ ve β nasıl elde ediliyor?" — üçü de aynı şeyi sorguluyordu:
// TASARIM GERGİNLİĞİ nereden geliyor. Rapor bugüne kadar bu zincirin yalnız
// SONUÇLARINI basıyordu (φ, β, dL/dθ birer tablo satırıydı); kuruluşunu
// göstermiyordu, o yüzden okuyan kişi hangisinin girdi hangisinin türev
// olduğunu ayırt edemiyordu.
//
// Aşağıdaki üreteçler o kuruluşu ÇÖZÜLMÜŞ GEOMETRİDEN çıkarır. Şekil 1'deki
// kuralın aynısı geçerli: hiçbir şekilde elle yerleştirilmiş koordinat yok —
// her nokta çekirdeğin teğet çözümünden gelir, yani şekil modelle birlikte
// değişir ve modelle birlikte doğrudur.

// Açı yayı işareti. Sweep AÇIKÇA verilir (da, EKRAN düzleminde işaretli
// radyan): kısa yola normalize eden bir sürüm 180°'den büyük SARIM açısını
// sessizce kırpardı — krank kasnağında sarım tipik olarak 200°'nin üstündedir.
function _frAngMark(cx, cy, rr, a1, da, renk, kal, dash){
  if(!Number.isFinite(da) || Math.abs(da) < 1e-6) return '';
  if(Math.abs(da) > 2 * Math.PI - 1e-6) da = (da > 0 ? 1 : -1) * (2 * Math.PI - 1e-3);
  var x1 = cx + rr * Math.cos(a1), y1 = cy + rr * Math.sin(a1);
  var x2 = cx + rr * Math.cos(a1 + da), y2 = cy + rr * Math.sin(a1 + da);
  return '<path d="M' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' A' + rr.toFixed(2) + ' ' + rr.toFixed(2)
    + ' 0 ' + (Math.abs(da) > Math.PI ? 1 : 0) + ' ' + (da > 0 ? 1 : 0) + ' '
    + x2.toFixed(2) + ' ' + y2.toFixed(2)
    + '" fill="none" stroke="' + renk + '" stroke-width="' + (kal || 1.4) + '"'
    + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
}

// mm kutusunu çerçeveye oturtan ölçekleyici. ty() mm düzlemini EKRANDA AYNI
// YÖNDE gösterir (yönelim korunur) — Şekil 1 ve Kayış Yolu kartıyla aynı
// konvansiyon; paylaşılmazsa çizimlerden biri sessizce aynalanır.
function _frFitter(pts, W, H, pad){
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(function(p){
    if(!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return;
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  });
  if(!Number.isFinite(minX)) return null;
  var spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6);
  var s = Math.min((W - pad.l - pad.r) / spanX, (H - pad.t - pad.b) / spanY);
  var offX = pad.l + ((W - pad.l - pad.r) - spanX * s) / 2;
  var offY = pad.t + ((H - pad.t - pad.b) - spanY * s) / 2;
  return { s: s,
    tx: function(x){ return offX + (x - minX) * s; },
    ty: function(y){ return offY + (maxY - y) * s; } };
}

// SVG metni satır kaydırmaz: sarmayı elle yapmak zorundayız.
function _frWrap(metin, maxCh){
  var kel = String(metin).split(' '), sat = [], cur = '';
  kel.forEach(function(k){
    if(!cur) cur = k;
    else if((cur + ' ' + k).length <= maxCh) cur += ' ' + k;
    else { sat.push(cur); cur = k; }
  });
  if(cur) sat.push(cur);
  return sat;
}

// Şeklin AÇIKLAMA SÜTUNU. Kullanıcı bildirimi (2026-08-24): "'fi' ne demek
// falan çok belli olmamış." Doğru: çizimde yalnız sembol bırakınca (sayıların
// yay işaretlerinin üstüne binmesini önlemek için gerekiyordu) sembolün NE
// OLDUĞU yalnız künye metninde kalıyor — okuyucu şekle bakarken orada değil.
// Açıklama artık şeklin YANINDA, boşta duran şeritte; ayrıca kadraj yataya
// döndüğü için şekil de kısalıyor (ölçüldü: 534 → 310 px).
function _frLegend(x0, y0, genislik, satirlar, fs){
  var g = '', y = y0, maxCh = Math.floor(genislik / (fs * 0.6));
  satirlar.forEach(function(sr){
    g += '<text x="' + x0 + '" y="' + (y + fs).toFixed(1) + '" font-size="' + (fs + 1)
       + '" fill="' + sr[2] + '" font-weight="600">' + _frEsc(sr[0]) + '</text>';
    y += (fs + 1) * 1.35;
    _frWrap(sr[1], maxCh - 3).forEach(function(t){
      g += '<text x="' + (x0 + 10) + '" y="' + (y + fs * 0.85).toFixed(1) + '" font-size="' + fs
         + '" fill="#5a6270">' + _frEsc(t) + '</text>';
      y += fs * 1.3;
    });
    y += 7;
  });
  return g;
}

// Çakışmayan etiket yerleştirici. Elle koordinat yazmak yerine, istenen yönde
// adım adım ilerleyip HEM çerçeveden HEM daha önce konmuş etiketlerden çıkan
// ilk yeri seçer. Kavramsal şekildeki (_yerlestir) fikrin aynısı, ama orada
// yalnız kasnak çemberlerine bakılıyordu; burada asıl çakışma ETİKET-ETİKET:
// ölçüldü, "θ_çıkış" ile "φ" ve "β" ile "f" üst üste biniyordu.
function _frLabels(W, H){
  var kutular = [];
  function carpar(b){
    return kutular.some(function(o){
      return !(b.x + b.w < o.x - 2 || b.x > o.x + o.w + 2 ||
               b.y + b.h < o.y - 2 || b.y > o.y + o.h + 2);
    });
  }
  return {
    // (ax,ay) çıpa, (dx,dy) TERCİH edilen yön, minR ilk deneme yarıçapı.
    // Arama YARIÇAP-BASKIN, yön ikincil: istenen yön en küçük yarıçapta
    // denenir, tutmazsa aynı yarıçapta yana sapılır. Yalnız radyal ilerleyen
    // sürümde 'u_çıkış' etiketi çerçevenin dışına itilip KAYBOLUYORDU (ölçüldü).
    ekle: function(ax, ay, dx, dy, metin, renk, fs, minR){
      var w = _frTxtW(metin, fs), hh = fs * 1.25;
      var L = Math.sqrt(dx * dx + dy * dy) || 1;
      var a0 = Math.atan2(dy / L, dx / L);
      var sapma = [0, 0.44, -0.44, 0.87, -0.87, 1.31, -1.31, 1.75, -1.75, 2.20, -2.20, Math.PI];
      var r0 = (minR == null ? 14 : minR), kutu = null, X = ax + Math.cos(a0) * r0, Y = ay + Math.sin(a0) * r0;
      for(var adim = 0; adim < 26 && !kutu; adim++){
        var rr = r0 + adim * 7;
        for(var k = 0; k < sapma.length && !kutu; k++){
          var a = a0 + sapma[k];
          var bx = ax + Math.cos(a) * rr, by = ay + Math.sin(a) * rr;
          var b = { x: bx - w / 2, y: by - hh / 2, w: w, h: hh };
          if(b.x < 4 || b.x + b.w > W - 4 || b.y < 2 || b.y + b.h > H - 2) continue;
          if(!carpar(b)){ kutu = b; X = bx; Y = by; }
        }
      }
      if(!kutu) kutu = { x: Math.max(4, Math.min(W - 4 - w, X - w / 2)),
                         y: Math.max(2, Math.min(H - 2 - hh, Y - hh / 2)), w: w, h: hh };
      kutular.push(kutu);
      return '<text x="' + (kutu.x + w / 2).toFixed(1) + '" y="' + (kutu.y + hh * 0.76).toFixed(1)
        + '" text-anchor="middle" font-size="' + fs + '" fill="' + renk + '">' + _frEsc(metin) + '</text>';
    },
    // Çizimin dışında kalması gereken alanı (alt künye) rezerve eder.
    kilit: function(x, y, w, h){ kutular.push({ x: x, y: y, w: w, h: h }); },
    // Kasnak çemberini (ve üstündeki sarım yayını) ENGEL yapar: etiketler
    // ölçüldü, kayışın üstünden geçiyordu — sayı okunmuyordu. Çember örnek
    // noktalarla temsil edilir; kutu-kutu testi zaten var.
    engelCember: function(cx, cy, r, kal){
      var n = 40, yc = (kal || 8) / 2;
      for(var i = 0; i < n; i++){
        var a = i / n * 2 * Math.PI;
        kutular.push({ x: cx + r * Math.cos(a) - yc, y: cy + r * Math.sin(a) - yc, w: yc * 2, h: yc * 2 });
      }
    },
    // Yarıçap doğruları ve referans ışını da engeldir: etiket onların üstüne
    // oturunca sayı okunmuyor (ölçüldü — 'θ_giriş' yarıçap doğrusunun üstündeydi).
    engelDogru: function(x1, y1, x2, y2, kal){
      var yc = (kal || 8) / 2, L = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
      var n = Math.max(2, Math.round(L / 10));
      for(var i = 0; i <= n; i++){
        var u = i / n, X = x1 + (x2 - x1) * u, Y = y1 + (y2 - y1) * u;
        kutular.push({ x: X - yc, y: Y - yc, w: yc * 2, h: yc * 2 });
      }
    }
  };
}

// Çalışma (Mean) konumunda çözülmüş geometriden kasnak başına giriş/çıkış
// teğet açıları. (3.3)'ün SAYISAL olarak denetlenebilmesi için wrapCalc,
// basılan θ değerlerinden YENİDEN hesaplanır: tabloya bakan kişi aritmetiği
// elle tekrarlayabilsin diye.
function _frWrapRows(R){
  var C = _frCore(), sys = R.build && R.build.sys;
  if(!C || !sys || !C.meanRel || !C.tensionerState) return null;
  var st;
  try { st = C.tensionerState(sys, C.meanRel(sys)); } catch(e){ return null; }
  var g = st && st.geom;
  if(!g || !g.spans || !g.pulleys || !g.pulleys.length) return null;
  var n = g.pulleys.length, out = [], i;
  for(i = 0; i < n; i++){
    var p = g.pulleys[i];
    var pIn = g.spans[(i - 1 + n) % n].Pj, pOut = g.spans[i].Pi;
    var thIn  = Math.atan2(pIn[1]  - p.c[1], pIn[0]  - p.c[0]) * 180 / Math.PI;
    var thOut = Math.atan2(pOut[1] - p.c[1], pOut[0] - p.c[0]) * 180 / Math.PI;
    var w = (p.d * (thOut - thIn)) % 360; if(w < 0) w += 360;
    out.push({ name: g.names[i], contact: p.contact, d: p.d, c: p.c, rPitch: p.rPitch,
               Pin: pIn, Pout: pOut, uIn: g.spans[(i - 1 + n) % n].u, uOut: g.spans[i].u,
               thIn: thIn, thOut: thOut, wrapDeg: g.wraps[i] * 180 / Math.PI, wrapCalc: w });
  }
  return { rows: out, geom: g, st: st, sense: g.sense, signedWrapDeg: g.signedWrapDeg,
           tenIdx: sys._tenIdx };
}

// Gergi kolundaki kuruluş: kol vektörü, teğet noktaları, birim açıklık
// doğrultuları, bileşke f = û_çıkış − û_giriş ve β.
function _frTenConstruct(R){
  var W = _frWrapRows(R), sys = R.build && R.build.sys;
  if(!W || !sys || !sys.tensioner) return null;
  var i = W.tenIdx;
  if(!(i >= 0) || !W.rows[i]) return null;
  var row = W.rows[i], st = W.st;
  var f = [row.uOut[0] - row.uIn[0], row.uOut[1] - row.uIn[1]];
  var arm = [sys.tensioner.pivot[0] - st.center[0], sys.tensioner.pivot[1] - st.center[1]];
  var nf = Math.sqrt(f[0] * f[0] + f[1] * f[1]);
  var na = Math.sqrt(arm[0] * arm[0] + arm[1] * arm[1]);
  if(!(nf > 1e-9) || !(na > 1e-9)) return null;
  return { row: row, st: st, sys: sys, idx: i, f: f, arm: arm, normF: nf, armLen: na,
           pivot: sys.tensioner.pivot, center: st.center };
}

// ── ŞEKİL: sarım açısı φ teğet noktalarından ────────────────────────────────
// En büyük sarımlı kasnak seçilir: aynı kuruluş her kasnakta geçerli, ama
// küçük sarımda yay ile etiketler üst üste biner ve şekil hiçbir şey anlatmaz.
function _frWrapFigure(R){
  var W = _frWrapRows(R);
  if(!W) return '';
  var best = 0, i;
  for(i = 1; i < W.rows.length; i++) if(W.rows[i].wrapDeg > W.rows[best].wrapDeg) best = i;
  var q = W.rows[best], r = q.rPitch, c = q.c;
  var Wd = 820, Hd = 310, pad = { l: 330, r: 30, t: 20, b: 34 };
  var stub = r * 1.05, ref = r * 1.5;
  var pIn0 = [q.Pin[0] - q.uIn[0] * stub, q.Pin[1] - q.uIn[1] * stub];
  var pOut1 = [q.Pout[0] + q.uOut[0] * stub, q.Pout[1] + q.uOut[1] * stub];
  var fit = _frFitter([[c[0] - r * 1.35, c[1] - r * 1.35], [c[0] + ref, c[1] + r * 1.35],
                       pIn0, pOut1, q.Pin, q.Pout], Wd, Hd, pad);
  if(!fit) return '';
  var tx = fit.tx, ty = fit.ty, s = fit.s;
  function f2(v){ return Math.round(v * 100) / 100; }
  function X(p){ return f2(tx(p[0])); }
  function Y(p){ return f2(ty(p[1])); }
  function P(p){ return X(p) + ' ' + Y(p); }
  var cx = tx(c[0]), cy = ty(c[1]), rs = r * s;
  // EKRAN açısı = −(mm açısı): ty() y'yi ters çevirir.
  var sIn = -q.thIn * Math.PI / 180, sOut = -q.thOut * Math.PI / 180;

  var g = '<svg viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="Sarım açısının teğet noktalarından kuruluşu">';
  g += '<defs><marker id="frW1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7"'
     + ' orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#c8781e"/></marker></defs>';
  // +X referans ışını ve 0° işareti
  g += '<line x1="' + f2(cx) + '" y1="' + f2(cy) + '" x2="' + f2(tx(c[0] + ref)) + '" y2="' + f2(cy)
     + '" stroke="#9aa2ad" stroke-width="1" stroke-dasharray="5 4"/>';
  g += '<text x="' + f2(tx(c[0] + ref) + 4) + '" y="' + f2(cy + 4) + '" font-size="11.5" fill="#9aa2ad">0° (+X)</text>';
  // kasnak çemberi
  g += '<circle cx="' + f2(cx) + '" cy="' + f2(cy) + '" r="' + f2(rs) + '" fill="none" stroke="#24425f"'
     + ' stroke-width="2"' + (q.contact === 'back' ? ' stroke-dasharray="6 5"' : '') + '/>';
  g += '<circle cx="' + f2(cx) + '" cy="' + f2(cy) + '" r="3.2" fill="#24425f"/>';
  // yarıçap doğruları (teğet noktalarına)
  [q.Pin, q.Pout].forEach(function(z){
    g += '<line x1="' + f2(cx) + '" y1="' + f2(cy) + '" x2="' + X(z) + '" y2="' + Y(z)
       + '" stroke="#24425f" stroke-width="1.2" stroke-dasharray="4 3"/>';
  });
  // açıklık parçaları + sarım yayı (kayış rengi)
  g += '<path d="M' + P(pIn0) + ' L' + P(q.Pin) + '" fill="none" stroke="#c8781e" stroke-width="4" marker-end="url(#frW1)"/>';
  g += '<path d="M' + P(q.Pout) + ' L' + P(pOut1) + '" fill="none" stroke="#c8781e" stroke-width="4" marker-end="url(#frW1)"/>';
  var wrapRad = q.wrapDeg * Math.PI / 180;
  g += '<path d="M' + P(q.Pin) + ' A' + f2(rs) + ' ' + f2(rs) + ' 0 ' + (q.wrapDeg > 180 ? 1 : 0)
     + ' ' + (q.d > 0 ? 0 : 1) + ' ' + P(q.Pout) + '" fill="none" stroke="#c8781e" stroke-width="5"/>';
  // θ işaretleri (+X'ten teğet noktalarına)
  g += _frAngMark(cx, cy, rs * 0.34, 0, sIn,  '#5a6270', 1.3, '3 3');
  g += _frAngMark(cx, cy, rs * 0.50, 0, sOut, '#5a6270', 1.3, '3 3');
  // sIn/sOut atan2'den geldiği için |·| ≤ π: doğrudan sweep olarak verilebilir.
  var LB = _frLabels(Wd, Hd);
  LB.kilit(0, 0, pad.l - 14, Hd);        // açıklama sütunu
  LB.kilit(0, Hd - 26, Wd, 26);          // alt künye satırı
  LB.engelCember(cx, cy, rs, 9);         // kayışın üstüne etiket konmasın
  LB.engelDogru(cx, cy, tx(q.Pin[0]),  ty(q.Pin[1]),  9);    // yarıçap doğruları
  LB.engelDogru(cx, cy, tx(q.Pout[0]), ty(q.Pout[1]), 9);
  LB.engelDogru(cx, cy, tx(c[0] + ref), cy, 5);              // +X referans ışını
  function etk(ang, rr, metin, renk, fs){
    return LB.ekle(cx, cy, Math.cos(ang), Math.sin(ang), metin, renk, fs, rr);
  }
  // ÇİZİM SEMBOL TAŞIR, SAYI DENKLEMDE DURUR. Değerleri yayların yanına
  // yazmak ölçüldü: metin kutuları yay işaretlerinin ve yarıçap doğrularının
  // üstüne biniyordu. Sayılar hemen alttaki denklemde ve tabloda zaten var.
  // Etiketler açıortaya DEĞİL, kendi yarıçap doğrultularına konur: iki
  // teğet noktası çevrenin karşıt yerlerinde olduğu için etiketler YAPISAL
  // olarak ayrılır. Açıortayda ikisi de üst-sağ dörtte bire düşüp sıkışıyordu
  // (ölçüldü — kadraj küçüldükten sonra iç bölge dar).
  g += etk(sIn,  rs * 0.30 + 15, 'θ_giriş', '#5a6270', 12);
  g += etk(sOut, rs * 0.46 + 15, 'θ_çıkış', '#5a6270', 12);
  // φ yayı — kasnağın İÇİNDE, klasik teknik resim gösterimi
  var phiSweep = (q.d > 0 ? -1 : 1) * wrapRad;      // mm CCW → ekranda negatif
  g += _frAngMark(cx, cy, rs * 0.74, sIn, phiSweep, '#c8781e', 2, null);
  // φ etiketi kayışın DIŞINDA: 198°'lik bir sarımda yay ortası ile θ_çıkış
  // açıortayı neredeyse aynı yöne düşüyor ve iki etiket yan yana yapışıyordu.
  g += etk(sIn + phiSweep / 2, rs + 24, 'φ', '#c8781e', 15);
  // teğet noktaları — künye bu adlara atıf yaptığı için ŞEKİLDE de yazılı
  [[q.Pin, 'P_giriş'], [q.Pout, 'P_çıkış']].forEach(function(z){
    var zx = tx(z[0][0]), zy = ty(z[0][1]);
    g += '<circle cx="' + f2(zx) + '" cy="' + f2(zy) + '" r="3.6" fill="#c8781e"/>';
    g += LB.ekle(zx, zy, zx - cx, zy - cy, z[1], '#c8781e', 11.5, 13);
  });
  // Şeklin İÇİNDE sayısal türetme YOK: SVG metni KaTeX ile dizilemez ve
  // belgenin geri kalanının tipografisinden kopuk görünür. Aritmetik şeklin
  // ALTINDA KaTeX denklemi olarak durur — kaynak aynı, dizgi tutarlı.
  // ── açıklama sütunu ──────────────────────────────────────────────────
  g += '<line x1="' + (pad.l - 20) + '" y1="14" x2="' + (pad.l - 20) + '" y2="' + (Hd - 34)
     + '" stroke="#e4e6e9" stroke-width="1"/>';
  g += _frLegend(14, 16, pad.l - 44, [
    ['P_giriş · P_çıkış — teğet noktaları', 'Kayışın kasnağa değdiği ve ayrıldığı '
      + 'noktalar; §3.2\'nin ortak teğet çözümünden gelir.', '#c8781e'],
    ['θ_giriş · θ_çıkış — teğet açıları', 'Bu iki noktanın, merkezden +X eksenine '
      + '(kesikli gri ışın) göre ölçülen açısı.', '#5a6270'],
    ['φ — SARIM AÇISI', 'Kayışın kasnağı sardığı yay: iki teğet açısının, sarım '
      + 'işareti d ile çarpılmış farkı. Aşağıdaki denklem bu kasnak için birebir gösterir.', '#c8781e'],
    ['d — sarım işareti', 'Temas tarafından gelir: kaburgalı yüzden temas edende +1, '
      + 'sırttan temas edende −1 (çeper kesikli çizilir).', '#24425f']
  ], 10.2);
  // Uzun kasnak adı alt künyeyi çerçeveden taşırırdı (SVG metni kırpılmaz).
  var kunye = q.name + ' — ' + (q.contact === 'back' ? 'sırttan temas, d = −1' : 'kaburgalı temas, d = +1');
  var enCok = Math.floor((Wd - 28) / (11 * 0.6));
  if(kunye.length > enCok) kunye = kunye.slice(0, enCok - 1) + '…';
  g += '<text x="14" y="' + (Hd - 10) + '" font-size="11" fill="#1b1e24">' + _frEsc(kunye) + '</text>';
  var fig = _frFigWrap(g, 'Sarım açısının kuruluşu (3.3). Kayış kasnağa <b>P<sub>giriş</sub></b> teğet '
    + 'noktasında değer, çeperi izler ve <b>P<sub>çıkış</sub></b>\'te ayrılır; iki teğet noktası '
    + '§3.2\'nin ortak teğet çözümünden gelir. θ açıları merkezden <b>+X eksenine göre</b> ölçülür '
    + '(kesikli gri ışın). Sarım açısı bu iki açının, kasnağın dönüş işareti <b>d</b> ile çarpılmış '
    + 'farkıdır — şeklin altındaki denklem aritmetiği bu kasnak için birebir gösterir. İşaret d, temas tarafından '
    + 'gelir: kaburgalı yüzden temas edende \\( d = +s \\), sırttan temas edende \\( d = -s \\) '
    + '(§3.2). Aynı kuruluş her kasnakta geçerlidir; burada en büyük sarımlı kasnak seçilmiştir.');
  var esit = '<div class="eqno">$$ \\varphi = \\big[\\, d\\,\\big(\\theta_{\\text{çıkış}} '
    + '- \\theta_{\\text{giriş}}\\big) \\big]\\ \\mathrm{mod}\\ 360^\\circ = \\big[\\, '
    + (q.d > 0 ? '+1' : '-1') + '\\cdot\\big(' + _frFs(q.thOut, 2) + '^\\circ - ('
    + _frFs(q.thIn, 2) + '^\\circ)\\big)\\big]\\ \\mathrm{mod}\\ 360^\\circ = '
    + _frFs(q.wrapCalc, 2) + '^\\circ $$<span class="tag">(' + _frEq() + ')</span></div>';
  return fig + esit;
}

// ── TABLO: her kasnak için θ_giriş, θ_çıkış, d, φ ──────────────────────────
function _frWrapAngleTable(R){
  var W = _frWrapRows(R);
  if(!W) return '';
  var h = '<table><caption>Tablo ' + _frTbl() + ' — Sarım açılarının teğet açılarından kuruluşu (3.3)</caption>';
  h += '<tr><th>Kasnak</th><th>Temas</th><th>θ<sub>giriş</sub> [°]</th><th>θ<sub>çıkış</sub> [°]</th>'
     + '<th>d</th><th>φ hesaplanan [°]</th><th>d·φ [°]</th></tr>';
  var toplam = 0;
  W.rows.forEach(function(q){
    var isaretli = (q.contact === 'back' ? -1 : 1) * q.wrapDeg;
    toplam += isaretli;
    h += '<tr><td class="l">' + _frEsc(q.name) + '</td>'
      + '<td class="c">' + (q.contact === 'back' ? 'sırt' : 'kaburgalı') + '</td>'
      + '<td>' + _frFs(q.thIn, 2) + '</td><td>' + _frFs(q.thOut, 2) + '</td>'
      + '<td class="c">' + (q.d > 0 ? '+1' : '−1') + '</td>'
      + '<td>' + _frFs(q.wrapCalc, 2) + '</td>'
      + '<td>' + _frFs(isaretli, 2) + '</td></tr>';
  });
  h += '<tr class="sum"><td class="l" colspan="6">Σ d·φ — kapalı çevrim değişmezi (3.5)</td>'
     + '<td>' + _frFs(toplam, 2) + '</td></tr></table>';
  h += '<p>Her satırın φ sütunu, <b>o satırdaki iki θ değerinden</b> yeniden hesaplanmıştır; '
     + 'yani tablo kendi aritmetiğini taşır ve elle denetlenebilir. Son satır (3.5) değişmezidir: '
     + 'işaretli sarım toplamı ' + (Math.abs(Math.abs(toplam) - 360) <= 0.05
        ? '<span class="ok">✓ 360°</span>' : '<b>✗ 360° değil</b>') + '.</p>';
  return h;
}

// ── ŞEKİL: β ve take-up oranının kuruluşu (gergi kolunda) ──────────────────
// Take-up oranı bir GİRDİ DEĞİL: kol boyu a (girdi) ile çözülmüş geometriden
// gelen φ ve β'nın çarpımı. Bu şekil o üç büyüklüğü aynı karede gösterir.
function _frBetaFigure(R){
  var K = _frTenConstruct(R);
  if(!K) return '';
  var q = K.row, c = K.center, p = K.pivot, r = q.rPitch;
  var Wd = 820, Hd = 330, pad = { l: 344, r: 34, t: 26, b: 26 };
  var Lv = r * 1.35, stub = r * 0.95;
  // birim vektörler: kayışın kasnağı ÇEKTİĞİ iki doğrultu
  var vIn  = [-q.uIn[0], -q.uIn[1]];              // giriş açıklığı geriye çeker
  var vOut = [ q.uOut[0],  q.uOut[1]];            // çıkış açıklığı ileriye çeker
  var fv   = [ K.f[0], K.f[1]];                   // bileşke = vIn + vOut
  var uArm = [(c[0] - p[0]) / K.armLen, (c[1] - p[1]) / K.armLen];   // pivot → merkez
  var tHat = [-uArm[1], uArm[0]];                                     // merkezin hareket yönü
  function ek(v, k){ return [c[0] + v[0] * k, c[1] + v[1] * k]; }
  var eIn = ek(vIn, Lv), eOut = ek(vOut, Lv), eF = ek(fv, Lv), eT = ek(tHat, Lv * 0.8);
  var pIn0  = [q.Pin[0]  - q.uIn[0]  * stub, q.Pin[1]  - q.uIn[1]  * stub];
  var pOut1 = [q.Pout[0] + q.uOut[0] * stub, q.Pout[1] + q.uOut[1] * stub];
  var fit = _frFitter([[c[0] - r * 1.2, c[1] - r * 1.2], [c[0] + r * 1.2, c[1] + r * 1.2],
                       p, eIn, eOut, eF, eT, pIn0, pOut1], Wd, Hd, pad);
  if(!fit) return '';
  var tx = fit.tx, ty = fit.ty, s = fit.s;
  function f2(v){ return Math.round(v * 100) / 100; }
  function X(z){ return f2(tx(z[0])); }
  function Y(z){ return f2(ty(z[1])); }
  function P(z){ return X(z) + ' ' + Y(z); }
  var cx = tx(c[0]), cy = ty(c[1]), rs = r * s;
  var sIn = -q.thIn * Math.PI / 180;
  var wrapRad = q.wrapDeg * Math.PI / 180;

  var g = '<svg viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="Hubload-kol açısı beta ve take-up oranının kuruluşu">';
  g += '<defs>'
     + '<marker id="frB1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
     + '<path d="M0 0 L10 5 L0 10 z" fill="#c8781e"/></marker>'
     + '<marker id="frB2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">'
     + '<path d="M0 0 L10 5 L0 10 z" fill="#a8321f"/></marker>'
     + '<marker id="frB3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
     + '<path d="M0 0 L10 5 L0 10 z" fill="#5a6270"/></marker>'
     + '<marker id="frB4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
     + '<path d="M0 0 L10 5 L0 10 z" fill="#2e7d4f"/></marker></defs>';

  // kol + pivot (kayışın altında kalsın diye önce)
  g += '<line x1="' + X(p) + '" y1="' + Y(p) + '" x2="' + f2(cx) + '" y2="' + f2(cy)
     + '" stroke="#2e7d4f" stroke-width="2" stroke-dasharray="5 4"/>';
  var px = X(p), py = Y(p), aa = 7;
  g += '<g stroke="#2e7d4f" stroke-width="2">'
     + '<line x1="' + f2(px - aa) + '" y1="' + py + '" x2="' + f2(px + aa) + '" y2="' + py + '"/>'
     + '<line x1="' + px + '" y1="' + f2(py - aa) + '" x2="' + px + '" y2="' + f2(py + aa) + '"/></g>';
  g += '<text x="' + f2(px) + '" y="' + f2(py + 20) + '" text-anchor="middle" font-size="12" fill="#2e7d4f">pivot</text>';

  // açıklıklar + sarım yayı
  g += '<path d="M' + P(pIn0) + ' L' + P(q.Pin) + '" fill="none" stroke="#c8781e" stroke-width="4" marker-end="url(#frB1)"/>';
  g += '<path d="M' + P(q.Pout) + ' L' + P(pOut1) + '" fill="none" stroke="#c8781e" stroke-width="4" marker-end="url(#frB1)"/>';
  g += '<path d="M' + P(q.Pin) + ' A' + f2(rs) + ' ' + f2(rs) + ' 0 ' + (q.wrapDeg > 180 ? 1 : 0)
     + ' ' + (q.d > 0 ? 0 : 1) + ' ' + P(q.Pout) + '" fill="none" stroke="#c8781e" stroke-width="5"/>';
  // kasnak
  g += '<circle cx="' + f2(cx) + '" cy="' + f2(cy) + '" r="' + f2(rs) + '" fill="none" stroke="#24425f"'
     + ' stroke-width="2"' + (q.contact === 'back' ? ' stroke-dasharray="6 5"' : '') + '/>';
  g += '<circle cx="' + f2(cx) + '" cy="' + f2(cy) + '" r="3.2" fill="#24425f"/>';
  // φ yayı (kasnağın içinde)
  g += _frAngMark(cx, cy, rs * 0.62, sIn, (q.d > 0 ? -1 : 1) * wrapRad, '#c8781e', 2, null);

  // ── vektör üçgeni: f = û_çıkış + (−û_giriş) ─────────────────────────────
  g += '<g data-ve="unit-vec">';
  [[eIn, '−u_giriş'], [eOut, 'u_çıkış']].forEach(function(z){
    g += '<line x1="' + f2(cx) + '" y1="' + f2(cy) + '" x2="' + X(z[0]) + '" y2="' + Y(z[0])
       + '" stroke="#5a6270" stroke-width="1.8" marker-end="url(#frB3)"/>';
  });
  g += '</g>';
  // paralelkenar kapanışı
  g += '<g data-ve="parallelogram" stroke="#5a6270" stroke-width="1" stroke-dasharray="3 3" opacity="0.75">'
     + '<line x1="' + X(eIn) + '" y1="' + Y(eIn) + '" x2="' + X(eF) + '" y2="' + Y(eF) + '"/>'
     + '<line x1="' + X(eOut) + '" y1="' + Y(eOut) + '" x2="' + X(eF) + '" y2="' + Y(eF) + '"/></g>';
  // bileşke f  (= hubload doğrultusu)
  g += '<line data-ve="resultant" x1="' + f2(cx) + '" y1="' + f2(cy) + '" x2="' + X(eF) + '" y2="' + Y(eF)
     + '" stroke="#a8321f" stroke-width="3" marker-end="url(#frB2)"/>';
  // merkezin hareket yönü t (kola dik)
  g += '<line data-ve="that" x1="' + f2(cx) + '" y1="' + f2(cy) + '" x2="' + X(eT) + '" y2="' + Y(eT)
     + '" stroke="#2e7d4f" stroke-width="1.8" stroke-dasharray="6 4" marker-end="url(#frB4)"/>';
  // β yayı: bileşke ile KOL (merkez → pivot) arasında
  var aF   = Math.atan2(ty(eF[1]) - cy, tx(eF[0]) - cx);
  var aArm = Math.atan2(py - cy, px - cx);
  var dB = aArm - aF;
  while(dB >  Math.PI) dB -= 2 * Math.PI;
  while(dB < -Math.PI) dB += 2 * Math.PI;
  g += _frAngMark(cx, cy, rs * 0.50, aF, dB, '#a8321f', 1.8, null);

  var LB = _frLabels(Wd, Hd);
  LB.kilit(0, 0, pad.l - 14, Hd);        // açıklama sütunu
  LB.engelCember(cx, cy, rs, 9);         // kasnak çeperi/kayış etiket almasın
  LB.engelDogru(px, py, cx, cy, 9);      // gergi kolu
  LB.kilit(px - 30, py + 6, 60, 20);     // 'pivot' yazısı (satır içi çiziliyor)
  [eIn, eOut, eF, eT].forEach(function(e){   // çizilen vektörlerin gövdeleri
    LB.engelDogru(cx, cy, tx(e[0]), ty(e[1]), 11);
  });
  // Uç etiketi: çıpa vektörün UCU, yön merkezden dışarı.
  function ucEtk(e, metin, renk, fs){
    var ex = tx(e[0]), ey = ty(e[1]);
    return LB.ekle(ex, ey, ex - cx, ey - cy, metin, renk, fs, 20);
  }
  // SIRA = ÖNCELİK: yerleştirici ilk geleni en iyi yere koyar, sonrakileri
  // iter. Şeklin KONUSU β ve φ olduğu için onlar önce yerleşir; birim vektör
  // etiketleri (uzun ve ikincil) en sona kalır. Ters sırada β, yayından
  // kopup û_çıkış'ın yanına düşüyordu (ölçüldü).
  g += LB.ekle(cx, cy, Math.cos(aF + dB / 2), Math.sin(aF + dB / 2),
               'β', '#a8321f', 15, rs * 0.42);
  var aPhiMid = sIn + (q.d > 0 ? -1 : 1) * wrapRad / 2;
  g += LB.ekle(cx, cy, Math.cos(aPhiMid), Math.sin(aPhiMid),
               'φ', '#c8781e', 15, rs * 0.58);
  g += LB.ekle((px + cx) / 2, (py + cy) / 2, -(cy - py), (cx - px),
               'a', '#2e7d4f', 15, 15);
  g += ucEtk(eF,   'f', '#a8321f', 14);
  g += ucEtk(eT,   't', '#2e7d4f', 14);
  g += ucEtk(eIn,  '−u_giriş', '#5a6270', 12);
  g += ucEtk(eOut, 'u_çıkış',  '#5a6270', 12);
  // Sayısal türetme şeklin İÇİNDE değil ALTINDA (KaTeX, §8.7): φ şeklindeki
  // gerekçenin aynısı. Şekil yalnız SEMBOLLERİ taşır — a, φ, β, f, t.
  // ── açıklama sütunu ──────────────────────────────────────────────────
  g += '<line x1="' + (pad.l - 22) + '" y1="16" x2="' + (pad.l - 22) + '" y2="' + (Hd - 16)
     + '" stroke="#e4e6e9" stroke-width="1"/>';
  g += _frLegend(14, 14, pad.l - 46, [
    ['a — gergi kol boyu', 'Pivottan kasnak merkezine. Bu zincirdeki TEK girdi.', '#2e7d4f'],
    ['t — merkezin hareket yönü', 'Kola dik. Kol dθ dönünce merkez t yönünde a·dθ yol alır.', '#2e7d4f'],
    ['u_giriş · u_çıkış — açıklık doğrultuları', 'Kayışın kasnağı çektiği iki birim vektör.', '#5a6270'],
    ['f — bileşke', 'f = u_çıkış − u_giriş. Hem hubload doğrultusu (5.4) hem take-up\'ın '
      + 'kaynağı. Boyu yalnız sarıma bağlı: |f| = 2 sin(φ/2).', '#a8321f'],
    ['φ — gergi kasnağındaki sarım açısı', '|f|\'i belirler.', '#c8781e'],
    ['β — bileşke ile kol arasındaki açı', 'f\'nin hareket yönü t üzerindeki izdüşümü '
      + '|f|·sin β olur; take-up oranı bunun a ile çarpımıdır.', '#a8321f']
  ], 10.2);
  return _frFigWrap(g, 'Take-up oranının ve β açısının kuruluşu. Gergi kasnağı, pivot etrafında dönen '
    + '<b>a</b> boyundaki kolun ucundadır; kol \\( \\mathrm{d}\\theta \\) kadar dönerse merkez, kola '
    + '<b>dik</b> olan <b>t</b> yönünde \\( a\\,\\mathrm{d}\\theta \\) kadar yol alır (yeşil kesikli ok). '
    + 'Kayışın kasnağı çektiği iki doğrultu <b>−u<sub>giriş</sub></b> ve <b>u<sub>çıkış</sub></b>; '
    + 'bileşkeleri <b>f</b> (kırmızı) hem hubload doğrultusudur (5.4) hem de kayış boyunun merkez '
    + 'hareketine duyarlılığıdır. İki birim vektör arasındaki açı sarım açısı φ olduğundan '
    + '\\( |f| = 2\\sin(\\varphi/2) \\); <b>β</b> ise f ile kol arasındaki açıdır, dolayısıyla f\'nin '
    + 'hareket yönü t üzerindeki izdüşümü \\( |f|\\sin\\beta \\) olur. Take-up oranı bu izdüşümün '
    + 'kol boyuyla çarpımıdır; aritmetiği aşağıdaki denklemler bu model için birebir gösterir. '
    + '<b>Elle girilen bir take-up değeri yoktur:</b> girdi yalnız kol boyu a\'dır, φ ve β çözülmüş '
    + 'geometriden gelir.');
}

// ── 8.7 — gergi çalışma noktası VE tasarım gerginliğinin kaynağı ───────────
// Bu bölüm eskiden yalnız sonucu basıyordu ve TEK denklemi de yanlış çevrim
// çarpanıyla yazıyordu: "M/(dL/dθ) · (180/π) · (1/1000)" elle çalışıldığında
// 650 N yerine 2,13 N veriyordu (ölçüldü). Basılan T doğruydu — çünkü ayrı bir
// alandan geliyordu — yani aritmetiği elle denetleyen okuyucu raporun yanlış
// olduğu sonucuna varıyordu. Çarpan artık doğru yönde ve ARA DEĞER de basılıyor.
function _frOperatingPoint(R){
  var A = R.analysis || {}, T = A.tensioner || {}, b = R.build || {};
  var sys = b.sys, t = (sys && sys.tensioner) || {};
  var K = _frTenConstruct(R);
  var takeup = _frNum(T.takeupMmPerDeg);
  var takeupRad = Number.isFinite(takeup) ? (takeup / 1000) * (180 / Math.PI) : NaN;
  var h = '<h3>8.7 Gergi çalışma noktası ve tasarım gerginliğinin kaynağı</h3>';
  // BU PARAGRAF BAYATLAMIŞTI. Tasarım gerginliği bir girdi olduğu dönemde
  // yazılmıştı ("kullanıcının girdiği ankraj") ve "ikisinin karşılaştırması"
  // vaat ediyordu; alan kaldırılıp ankraj yay dengesinden türetilir olunca
  // ortada karşılaştırılacak iki kanal kalmadı ama metin kaldı. Okuyucu
  // panelde olmayan bir alanı arıyordu.
  h += '<p>Bu bölüm, <b>tasarım gerginliğinin nereden geldiğini</b> baştan sona kurar. '
     + 'Gerilme zincirinin ankrajı olan bu sayı <b>sorulmaz</b>: gergi kolunun taşıyabileceği '
     + 'gerginlik yay dengesinden zaten belirlidir. Aşağıda önce hangi büyüklüğün girdi hangisinin '
     + 'türev olduğu dökülür, sonra ankraj adım adım kurulur.</p>';

  // (a) girdi ↔ türev envanteri
  h += '<table><caption>Tablo ' + _frTbl() + ' — Bu bölümdeki her büyüklüğün kaynağı</caption>';
  h += '<tr><th>Büyüklük</th><th>Değer</th><th>Birim</th><th>Kaynak</th></tr>';
  function gr(k, v, u, src){
    return '<tr><td class="l">' + k + '</td><td>' + v + '</td><td class="c">' + (u || '—')
      + '</td><td class="l">' + src + '</td></tr>';
  }
  h += gr('Kasnak merkezleri ve dış çapları', '§8.3', '—', '<b>girdi</b> — yerleşim çizimi');
  h += gr('Kayış efektif boyu L<sub>eff</sub>', _frFs(sys && sys.belt && sys.belt.effLength, 1), 'mm', '<b>girdi</b> — kayış künyesi');
  h += gr('Gergi pivotu', _frFs(t.pivot && t.pivot[0], 2) + ' / ' + _frFs(t.pivot && t.pivot[1], 2), 'mm', '<b>girdi</b>');
  h += gr('Kol boyu a', _frFs(t.armLength, 1), 'mm', '<b>girdi</b>'
        + (b.mount && b.mount.ok ? ' — montaj merkezi ile denetlendi (§8.4)' : ''));
  h += gr('Yay ön yükü M<sub>0</sub>', _frFs(t.preloadNm, 2), 'Nm', '<b>girdi</b>');
  h += gr('Yay oranı k', _frFs(t.rateNmPerDeg, 3), 'Nm/°', '<b>girdi</b>');
  h += gr('Serbest kol açısı θ<sub>serbest</sub>', _frFs(t.freeAngleDeg, 2), '°',
          b.angleMode === 'mount' ? '<b>türev</b> — montaj merkezinden (§8.4)' : '<b>girdi</b>');
  h += '<tr class="sum"><td class="l" colspan="4">— aşağıdakilerin hiçbiri girilmez —</td></tr>';
  h += gr('Kol açısı θ (göreli / mutlak)', _frFs(A.meanRelDeg, 2) + ' / ' + _frFs(A.meanAbsDeg, 2), '°',
          '<b>türev</b> — (4.4) kökü: L<sub>gereken</sub>(θ) = L<sub>eff</sub>');
  h += gr('Gergi kasnağı sarımı φ', _frFs(T.wrapDeg, 2), '°', '<b>türev</b> — (3.3), teğet noktalarından');
  h += gr('Hubload–kol açısı β', _frFs(T.betaDeg, 2), '°', '<b>türev</b> — bileşke f ile kol arasındaki açı');
  h += gr('Take-up oranı dL/dθ', _frFs(T.takeupMmPerDeg, 4), 'mm/°', '<b>türev</b> — a·sinβ·2sin(φ/2)');
  h += gr('Yay momenti M(θ)', _frFs(T.springNm, 2), 'Nm', '<b>türev</b> — (4.2): M<sub>0</sub> + k·θ<sub>göreli</sub>');
  h += gr('Yay dengesinden gerginlik', _frF(T.tensionN, 0), 'N', '<b>türev</b> — (4.3): M/(dL/dθ)');
  h += gr('<b>Tasarım gerginliği (ankraj)</b>', '<b>' + _frF(sys && sys.designTensionN, 0) + '</b>', 'N',
          '<b>türev</b> — yay dengesinin ta kendisi; §8.11 zincirinin ankrajı');
  h += '</table>';
  h += '<div class="note"><span class="t">Take-up oranı bir girdi değildir</span>'
     + 'Panelde take-up diye bir alan yoktur ve olamaz: dL/dθ, kol boyu <b>a</b> (girdi) ile çözülmüş '
     + 'geometriden gelen <b>φ</b> ve <b>β</b>\'nın çarpımıdır. Kol açısı değiştikçe φ küçülür ama β '
     + 'büyür; çarpımları bu yüzden <b>monoton değildir</b> ve bir tepe noktasından geçer (§8.9).</div>';

  // (b) β ve take-up kuruluşu — şekil
  h += _frBetaFigure(R);

  // (c) take-up sayısal kuruluşu
  if(K && Number.isFinite(takeup)){
    var sinB = Math.sin(_frNum(T.betaDeg) * Math.PI / 180);
    _frEqRef.f = _frEq();
    h += '<p>Bileşke doğrultunun boyu yalnız gergi kasnağındaki sarım açısına bağlıdır:</p>';
    h += '<div class="eqno">$$ |\\mathbf{f}| = \\big|\\mathbf{u}_{\\text{çıkış}} '
       + '- \\mathbf{u}_{\\text{giriş}}\\big| = 2\\sin\\frac{\\varphi}{2} = 2\\sin\\frac{'
       + _frFs(T.wrapDeg, 2) + '^\\circ}{2} = ' + _frFs(K.normF, 4)
       + ' $$<span class="tag">(' + _frEqRef.f + ')</span></div>';
    _frEqRef.takeup = _frEq();
    h += '<p>Take-up oranı, bu bileşkenin hareket yönü \\( \\mathbf{t} \\) üzerindeki '
       + 'izdüşümünün kol boyuyla çarpımıdır (4.3):</p>';
    h += '<div class="eqno">$$ \\frac{\\mathrm{d}L}{\\mathrm{d}\\theta} = a\\,|\\mathbf{f}|\\,\\sin\\beta'
       + '\\cdot\\frac{\\pi}{180} = ' + _frFs(K.armLen, 1) + '\\cdot ' + _frFs(K.normF, 4) + '\\cdot '
       + _frFs(sinB, 4) + '\\cdot\\frac{\\pi}{180} = ' + _frFs(takeup, 4)
       + '\\ \\text{mm/}^\\circ $$<span class="tag">(' + _frEqRef.takeup + ')</span></div>';
  }

  // (d) yay dengesi → gerginlik. ÇEVRİM ÇARPANI AÇIK YAZILIR.
  if(Number.isFinite(takeupRad)){
    h += '<p>Kol açısı, "gereken kayış boyu = kayışın efektif boyu" koşulundan (4.4) çözülür. Bulunan '
       + 'açıda yay momenti ile take-up oranı, kayış gerginliğini (4.3) ile verir. Bölme <b>m/rad</b> '
       + 'biriminde yapılmalıdır; mm/° değeri önce çevrilir:</p>';
    h += '<div class="eqno">$$ \\left(\\frac{\\mathrm{d}L}{\\mathrm{d}\\theta}\\right)_{\\text{m/rad}} = '
       + '\\frac{' + _frFs(takeup, 4) + '}{1000}\\cdot\\frac{180}{\\pi} = ' + _frFs(takeupRad, 6)
       + '\\ \\text{m/rad} $$<span class="tag">(' + (_frEqRef.conv = _frEq()) + ')</span></div>';
    h += '<div class="eqno">$$ T = \\frac{M(\\theta)}{(\\mathrm{d}L/\\mathrm{d}\\theta)_{\\text{m/rad}}} = '
       + '\\frac{' + _frFs(T.springNm, 2) + '\\ \\text{Nm}}{' + _frFs(takeupRad, 6) + '\\ \\text{m/rad}} = '
       + _frF(T.tensionN, 0) + '\\ \\text{N} $$<span class="tag">(' + (_frEqRef.T = _frEq()) + ')</span></div>';
  }

  h += '<table><caption>Tablo ' + _frTbl() + ' — Çalışma (Mean) konumu</caption>';
  h += '<tr><th>Büyüklük</th><th>Değer</th><th>Birim</th></tr>';
  function tr(k, v, u){ return '<tr><td class="l">' + k + '</td><td>' + v + '</td><td class="c">' + u + '</td></tr>'; }
  h += tr('Kol açısı (göreli / mutlak)', _frFs(A.meanRelDeg, 2) + ' / ' + _frFs(A.meanAbsDeg, 2), '°');
  h += tr('Gergi kasnağı sarımı', _frFs(T.wrapDeg, 2), '°');
  h += tr('Hubload–kol açısı β', _frFs(T.betaDeg, 2), '°');
  h += tr('Take-up oranı dL/dθ', _frFs(T.takeupMmPerDeg, 4), 'mm/°');
  h += tr('Yay momenti M(θ)', _frFs(T.springNm, 2), 'Nm');
  h += tr('Kayış gerginliği T', _frF(T.tensionN, 0), 'N');
  h += tr('Gergi hubload', _frF(T.hubloadN, 0) + ' @ ' + _frFs(T.hubDirDeg, 1) + '°', 'N');
  h += '</table>';

  h += _frPivotBlock(R);
  h += _frDesignTensionBlock(R);
  h += _frTensionFigure(R);
  return h;
}

// ── Tasarım gerginliği: GİRİLEN ↔ TÜRETİLEN ───────────────────────────────
// ── Tasarım gerginliğinin kaynağı ──────────────────────────────────────────
// Bu bölüm eskiden İKİ KANALI karşılaştırıyordu: kullanıcının girdiği ankraj ve
// yay dengesinden türetilen değer. Karşılaştırma anlamlıydı çünkü ankraj bir
// GİRDİYDİ ve çeliştiğinde çekirdek girileni kullanıp yay dengesini yok
// sayıyordu — bütün gerilmeler sessizce kayıyordu.
//
// Alan KALDIRILDI: tasarım gerginliği bağımsız bir veri değil. ÖLÇÜLDÜ (10
// Gates raporu): girilen ile türeyen arasındaki fark en çok %0.12, RMS %0.08 —
// tamamı yuvarlama, çünkü Gates tam sayı basıyor (766 ↔ 765.9). İki kanal
// zaten tek kanaldı. Artık bölüm karşılaştırma değil KURULUŞ anlatıyor.
// ─── Gergi PİVOTU nereden geliyor ───────────────────────────────────────────
//
// Kullanıcı bildirimi (2026-08-25): "Otomatik gergi bileşeninde kol ve pivot
// kısmına kullanıcı girdi girmeyecek. Kullanıcının girdiği koordinat gergi
// KASNAĞININ merkezi; pivot noktası sonra hesaplanıyor."
//
// Doğru ve zincir kapanıyor. Kapanışı gerginin PARÇA ÇİZİMİ veriyor:
//   "E9843 PIN POSITION FOR THE 344° MEAN ANGLE AND 22.5 Nm SPRING TORQUE
//    @ 28° FREEARM-MEAN ROTATION"
// yani kolun ÇALIŞMA konumundaki MUTLAK açısı bir parça künyesidir.
//
//     pivot = c − a·(cos θ_kol , sin θ_kol)
//
// İKİ AYRI DURUM VE İKİSİ AYNI ŞEY DEĞİL:
//   • pivot TÜRETİLDİ  → blok kuruluşu anlatır; kol boyu çapraz kontrolü
//                         TOTOLOJİKTİR ve blok bunu SÖYLER
//   • pivot GİRİLDİ    → (tedarikçi raporundan ölçülmüş) türetme bağımsız bir
//                         DENETİM olur: iki ayrı kaynak aynı noktayı vermeli
function _frPivotBlock(R){
  var sys = R.build && R.build.sys, A = R.analysis || {}, T = A.tensioner || {};
  if(!sys || !sys.tensioner) return '';
  var t = sys.tensioner, b = R.build || {};
  var a = _frNum(t.armLength);
  var C = _frCore(), cen = [];
  try { cen = C.tensionerState(sys, _frNum(A.meanRelDeg)).center || []; } catch(e){ cen = []; }
  var cx = _frNum(cen[0]), cy = _frNum(cen[1]);
  var px = _frNum(t.pivot && t.pivot[0]), py = _frNum(t.pivot && t.pivot[1]);
  if(![a, cx, cy, px, py].every(Number.isFinite)) return '';

  var D = Math.PI / 180;
  // Kolun MUTLAK açısı: pivottan merkeze bakan doğrultu.
  var kolDeg = Math.atan2(cy - py, cx - px) / D;
  var kol360 = (kolDeg % 360 + 360) % 360;
  var turev = !!b.pivotDerived;
  var mount = b.mount || {};
  var relMean = _frNum(mount.relMeanDeg);

  var h = '<h4>Gergi pivotu nereden geliyor</h4>';
  h += '<p>Pivot, tedarikçiye giden sayfada <b>bulunmaz</b> ve kullanıcıdan <b>istenmez</b>. '
     + 'Koordinat tablosunda gerginin satırı da diğer bütün kasnaklarla aynı şeydir: '
     + '<b>gergi kasnağının merkezi</b>. (Alternatör satırı bunun en açık örneğidir — orada da '
     + 'alternatör gövdesinin değil, ona takılı küçük kasnağın merkezi yazar.) Pivot bu '
     + 'merkezden ve gerginin <b>parça künyesinden</b> çıkar.</p>';
  h += '<p>Kapanışı veren sayı, gergi üreticisinin parça çiziminde yazan <b>kolun çalışma '
     + '(Mean) konumundaki mutlak açısıdır</b>. Kol boyu da künyededir; pivot kolun öbür '
     + 'ucudur:</p>';
  h += '<div class="eq">$$ \\mathbf{p} \;=\; \\mathbf{c} \;-\; a\\,\\big(\\cos\\theta_{\\text{kol}},\\ '
     + '\\sin\\theta_{\\text{kol}}\\big) \;=\; \\big(' + _frF(cx, 2) + ',\\ ' + _frF(cy, 2) + '\\big)'
     + ' - ' + _frF(a, 1) + '\\big(\\cos ' + _frF(kol360, 2) + '^\\circ,\\ \\sin '
     + _frF(kol360, 2) + '^\\circ\\big) = \\big(' + _frF(px, 2) + ',\\ ' + _frF(py, 2) + '\\big)'
     + ' $$<span class="tag">(' + (_frEqRef.pivot = _frEq()) + ')</span></div>';

  h += '<table><caption>Tablo ' + _frTbl() + ' — Pivotun kuruluşu</caption>';
  h += '<tr><th>Büyüklük</th><th>Değer</th><th>Birim</th><th>Kaynak</th></tr>';
  function tr(k, v, u, src){ return '<tr><td class="l">' + k + '</td><td>' + v + '</td><td class="c">'
    + (u || '—') + '</td><td class="l">' + src + '</td></tr>'; }
  h += tr('Gergi <b>kasnağının</b> merkezi <b>c</b>', _frFs(cx, 2) + ' / ' + _frFs(cy, 2), 'mm',
          '<b>girdi</b> — koordinat tablosu, diğer kasnaklarla aynı');
  h += tr('Kol boyu a', _frFs(a, 1), 'mm', '<b>girdi</b> — gergi parça künyesi');
  h += tr('Kolun çalışma açısı θ<sub>kol</sub>', _frFs(kol360, 2), '°',
          turev ? '<b>girdi</b> — gergi parça çizimi (MEAN ANGLE)'
                : 'türev — girilen pivottan geri okundu');
  if(Number.isFinite(relMean))
    h += tr('Serbest→çalışma dönüşü', _frFs(relMean, 2), '°',
            'türev — (M<sub>çalışma</sub> − M<sub>ön</sub>)/k, parça çizimiyle karşılaştırılabilir');
  h += tr('<b>Gergi pivotu p</b>', '<b>' + _frFs(px, 2) + ' / ' + _frFs(py, 2) + '</b>', 'mm',
          turev ? '<b>türev</b> — (' + _frEqRef.pivot + ')' : '<b>girdi</b> — ölçülmüş/raporlanmış');
  h += '</table>';

  if(turev){
    h += '<div class="note"><span class="t">Kol boyu çapraz kontrolü burada bir DENETİM DEĞİLDİR</span>'
       + 'Pivot, merkezden tam kol boyu kadar uzağa <b>konularak</b> hesaplandığı için '
       + '|merkez − pivot| = kol boyu <b>yapısal olarak</b> sağlanır; sıfır sapma bir şey '
       + 'ölçmez. Bu kontrol ancak pivot <b>ayrıca ölçülmüş</b>se (tedarikçi raporu, montaj '
       + 'resmi) anlam taşır — o zaman iki bağımsız sayı karşılaştırılıyordur.</div>';
    h += '<div class="note check"><span class="t">Sıra bu</span>'
       + 'Kullanıcı yalnız gergi <b>kasnağının</b> merkezini girer → parça künyesindeki kol boyu '
       + 've kol açısıyla <b>pivot hesaplanır</b> → kol açısı kayış boyundan çözülür → kayış yolu, '
       + 'gerginlik, hubload ve ömür bu pivota göre kurulur. Belgedeki bütün sayılar bu zincirin '
       + 'sonucudur.</div>';
  } else {
    h += '<div class="note check"><span class="t">Bu modelde pivot ÖLÇÜLMÜŞ</span>'
       + 'Pivot burada bir tedarikçi raporundan geliyor, yani türetilmedi. O yüzden kol boyu '
       + 'çapraz kontrolü <b>gerçek bir denetimdir</b>: koordinatlardan çıkan kol boyu '
       + '(' + _frFs(_frNum(mount.armFromCoords), 3) + ' mm) ile künyedeki kol boyu '
       + '(' + _frFs(a, 1) + ' mm) iki <b>bağımsız</b> sayıdır ve tutmak zorundadır.</div>';
  }

  // KAYIŞ YOLU PİVOTA BAĞLI DEĞİL — bu, pivotun neden ayrı çözülebildiğinin sebebi.
  h += '<p><b>Kayış yolu pivota bağlı değildir.</b> Geometri yalnız gergi <b>kasnağının</b> '
     + 'merkezine bakar (§3.2\'nin teğet çözümü merkez farklarından kurulur): sarım açıları, '
     + 'açıklıklar ve kayış boyu pivot kaydırılsa da <b>değişmez</b>. Pivotun tek etkisi kolun '
     + 'hangi yönde hareket ettiğidir — yani \\( \\beta \\), yani take-up, yani gerginlik '
     + '(§8.7\'nin geri kalanı). Zincirin bu şekilde ayrılabilmesi, pivotun ayrı bir adımda '
     + 'çözülebilmesinin sebebidir.</p>';
  return h;
}

function _frDesignTensionBlock(R){
  var sys = R.build && R.build.sys, A = R.analysis || {}, T = A.tensioner || {};
  if(!sys) return '';
  var yay = _frNum(R.build && R.build.springTensionN);
  if(!Number.isFinite(yay)) yay = _frNum(T.tensionN);
  var h = '<h4>Tasarım gerginliği nereden geliyor</h4>';
  h += '<p>Gerilme zinciri (§8.11) gergi kasnağından başlar ve tasarım gerginliğine ankrajlanır: '
     + '\\( T_{\\text{gergi}} = T_{\\text{tasarım}} \\). Bu sayı <b>sorulmaz</b> — gergi kolunun '
     + 'taşıyabileceği gerginlik yay dengesinden zaten belirlidir'
     + (_frEqRef.T ? ' (' + _frEqRef.T + ')' : '') + ':</p>';
  h += '<div class="eq">\\[ T_{\\text{tasarım}} \\;=\\; \\frac{M(\\theta)}{dL/d\\theta} '
     + '\\;=\\; \\frac{M_0 + k\\,\\theta}{a\\,\\sin\\beta\\;2\\sin(\\varphi/2)} \\]</div>';
  h += '<p>Sağdaki büyüklüklerin hiçbiri serbest değildir: <b>a</b>, <b>M<sub>0</sub></b> ve '
     + '<b>k</b> gergi künyesinden okunur, <b>θ</b>, <b>φ</b> ve <b>β</b> ise çözülmüş '
     + 'geometriden gelir (yukarıdaki envanter). Bu sistemde sonuç '
     + '<b>' + _frF(yay, 0) + ' N</b>\'dur.</p>';
  h += '<div class="note"><span class="t">Neden ayrıca sorulmuyor</span>'
     + 'Bu değer bir tasarım tercihi değil, kurulan gerginin <em>sonucudur</em>. Ayrıca girdi olarak '
     + 'istemek aynı bilgiyi ikinci kez ve <b>çelişebilir</b> biçimde sormak olurdu: çeliştiğinde '
     + 'zincir girilen değerle ankrajlanır, bütün açıklık gerilmeleri ve hubloadlar farkı kadar '
     + 'kayar ve hiçbir hata çıkmazdı. Kayma emniyeti bir <em>oran</em> olduğundan (5.6) bu kaymayı '
     + 'ancak kısmen gösterir — yük çekmeyen kasnaklarda gerginlik oranı 1\'dir ve SF hiç değişmez. '
     + 'Farklı bir gerginlik isteniyorsa değiştirilecek şey gergi <b>künyesidir</b> (yay ön yükü, '
     + 'yay oranı, kol boyu), bir sayı alanı değil. '
     + 'Tedarikçi sayfasında basılı bir tasarım gerginliği varsa yukarıdaki değerle karşılaştırınız: '
     + 'ayrışıyorlarsa sayfadan okunan gergi künyesi ya da kasnak yerleşimi hatalıdır.</div>';
  return h;
}
// ── 8.9 — take-up: ANLIK TÜREV ile ORTALAMA EĞİM ayrı şeylerdir ────────────
// Eski sürüm L(θ) eğrisinin uçtan uca ORTALAMA eğimini hesaplayıp ona
// "take-up oranı" diyordu. ÖLÇÜLDÜ (BMC): ortalama eğim 0,4481 mm/°, çalışma
// noktasındaki gerçek türev 0,5984 mm/° — %25,1 fark. §8.7 ve tedarikçi
// raporunun "Belt Takeup / Tensioner Arm Ratio" satırı ANLIK türevdir; iki
// farklı sayının aynı adı taşıması raporun kendi içinde çelişmesi demekti.
function _frTakeupFigure(R){
  var ç = _frTakeupChart(R);
  if(!ç) return '';
  var sw = ç.sw, K = ç.K, g = ç.g, anlik = ç.anlik, ort = ç.ort;
  return _frTakeupSection(R, sw, K, g, anlik, ort);
}
// Yalnız GRAFİK — iki belge de bunu çizer, ikinci bir çizici yok.
function _frTakeupChart(R){
  var sw = _frArmSweep(R);
  if(!sw) return null;
  var K = _frTenConstruct(R);
  var Ls = sw.pts.map(function(p){ return p.L; });
  var lo = Math.min.apply(null, Ls), hi = Math.max.apply(null, Ls);
  var pad = (hi - lo) * 0.08 || 1;
  var c = _frChart({ xMin: 0, xMax: sw.relMax, yMin: lo - pad, yMax: hi + pad,
                     xLabel: 'Gergi kol açısı — göreli [°]', yLabel: 'Gereken tahrik boyu [mm]',
                     xDec: 0, yDec: 1, H: (_FR_RAW ? _FR_H : 280), alt: 'Kayış take-up eğrisi' });
  var g = c.svg;
  g += '<g data-ve="takeup-curve">' + _frPolyline(c, sw.pts.map(function(p){ return [p.rel, p.L]; }), '#24425f', 2.4) + '</g>';
  var t0 = sw.pts[0], t1 = sw.pts[sw.pts.length - 1];
  var ort = Math.abs((t1.L - t0.L) / (t1.rel - t0.rel));
  var anlik = K ? _frNum(K.st.takeupMmPerDeg) : NaN;

  // ÇALIŞMA NOKTASINDAKİ TEĞET: eğimi take-up oranının TA KENDİSİ.
  if(K && Number.isFinite(anlik)){
    var rm = _frNum(K.st.relDeg), Lm = _frNum(K.st.driveLenMm);
    var yari = sw.relMax * 0.18;
    var r1 = Math.max(0, rm - yari), r2 = Math.min(sw.relMax, rm + yari);
    g += '<g data-ve="tangent">'
       + _frPolyline(c, [[r1, Lm + anlik * (rm - r1)], [r2, Lm - anlik * (r2 - rm)]], '#a8321f', 2.2, '6 4')
       + '</g>';
    var XM = c.sx(rm), YM = c.sy(Lm);
    g += '<line data-ve="mean-line" x1="' + XM.toFixed(1) + '" y1="' + c.pad.t + '" x2="' + XM.toFixed(1)
       + '" y2="' + (c.H - c.pad.b) + '" stroke="#2e7d4f" stroke-width="1.6" stroke-dasharray="4 3"/>';
    g += '<circle cx="' + XM.toFixed(1) + '" cy="' + YM.toFixed(1) + '" r="4" fill="#2e7d4f"/>';
    var et = 'teğetin eğimi = dL/dθ = ' + _frFs(anlik, 4) + ' mm/°';
    var xe = Math.min(XM + 10, c.W - _frTxtW(et, 11.5) - 8);
    g += '<text x="' + xe.toFixed(1) + '" y="' + (YM - 12).toFixed(1) + '" font-size="11.5" fill="#a8321f">'
       + _frEsc(et) + '</text>';
    g += '<text x="' + (XM + 6).toFixed(1) + '" y="' + (c.pad.t + 12) + '" font-size="11" fill="#2e7d4f">Mean</text>';
  }
  return { g: g, sw: sw, K: K, anlik: anlik, ort: ort };
}
function _frTakeupChartRaw(R){
  var ç = _frTakeupChart(R);
  return ç ? (ç.g + '</svg>') : '';
}
function _frTakeupSection(R, sw, K, g, anlik, ort){
  var h = '<h3>8.9 Kayış take-up</h3>';
  h += '<p>Kol açısı arttıkça gergi kasnağı kayışı içeri alır ve gereken tahrik boyu azalır. '
     + '<b>Take-up oranı, bu eğrinin çalışma noktasındaki ANLIK eğimidir</b> (mm/°) — '
     + (_frEqRef.takeup ? '(' + _frEqRef.takeup + ') ile ' : '')
     + 'hesaplanan ve §8.7\'de basılan değer budur, tedarikçi raporunun "Belt Take-up / Tensioner Arm '
     + 'Ratio" satırı da aynı büyüklüktür.</p>';
  h += _frFigWrap(g, 'Gereken tahrik boyunun kol açısıyla değişimi. Kesikli kırmızı doğru, çalışma '
     + '(Mean) noktasındaki teğettir; <b>eğimi take-up oranıdır</b>. Kayışın tolerans ve aşınma payı '
     + 'bu eğri üzerinde bir aralığa karşılık gelir ve kol o aralıkta gezer (§4.4).');

  if(Number.isFinite(anlik) && Number.isFinite(ort)){
    h += '<p>Eğri <b>doğru değildir</b>, bu yüzden anlık eğim ile uçtan uca ortalama eğim aynı sayı '
       + 'değildir: bu modelde çalışma noktasındaki türev <b>' + _frFs(anlik, 4) + ' mm/°</b>, '
       + '0°–' + _frFs(sw.relMax, 1) + '° aralığının ortalama eğimi ise <b>' + _frFs(ort, 4) + ' mm/°</b> '
       + '(' + _frPct(Math.abs(anlik - ort) / anlik * 100, 1) + ' fark). Hesaplarda kullanılan '
       + '<b>anlık</b> olandır; ortalama yalnız eğrinin ne kadar büküldüğünü gösterir.</p>';
  }
  h += _frTakeupRateFigure(R, sw);
  return h;
}

// ── ŞEKİL: take-up oranının kol açısıyla değişimi (φ ↓ ile β ↑ yarışı) ─────
function _frTakeupRateFigure(R, sw){
  if(!sw) sw = _frArmSweep(R);
  if(!sw) return '';
  var pts = sw.pts.filter(function(p){ return Number.isFinite(p.tk); });
  if(pts.length < 4) return '';
  var K = _frTenConstruct(R);
  var vals = pts.map(function(p){ return p.tk; });
  var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  var pad = (hi - lo) * 0.15 || 0.05;
  var c = _frChart({ xMin: 0, xMax: sw.relMax, yMin: Math.max(0, lo - pad), yMax: hi + pad,
                     xLabel: 'Gergi kol açısı — göreli [°]', yLabel: 'Take-up oranı dL/dθ [mm/°]',
                     xDec: 0, yDec: 3, H: 260, alt: 'Take-up oranının kol açısıyla değişimi' });
  var g = c.svg;
  g += '<g data-ve="takeup-rate">' + _frPolyline(c, pts.map(function(p){ return [p.rel, p.tk]; }), '#24425f', 2.4) + '</g>';
  // tepe noktası
  var tepe = pts[0];
  pts.forEach(function(p){ if(p.tk > tepe.tk) tepe = p; });
  g += '<circle cx="' + c.sx(tepe.rel).toFixed(1) + '" cy="' + c.sy(tepe.tk).toFixed(1)
     + '" r="4" fill="#8a5a1e"/>';
  var tm = 'tepe ' + _frFs(tepe.tk, 4) + ' mm/° @ ' + _frFs(tepe.rel, 1) + '°';
  // Tepe ile Mean çok yakın olabiliyor (BMC: 26,6° ↔ 28,5°) ve iki etiket üst
  // üste biniyordu (ölçüldü). Yakınsa tepe etiketi ALTA ve SOLA alınır.
  var rmT = K ? _frNum(K.st.relDeg) : NaN;
  var yakin = Number.isFinite(rmT) && Math.abs(tepe.rel - rmT) < sw.relMax * 0.14;
  var tmW = _frTxtW(tm, 11);
  var tmX = yakin ? Math.max(c.pad.l + 4, c.sx(tepe.rel) - tmW - 10)
                  : Math.min(c.sx(tepe.rel) + 8, c.W - tmW - 8);
  g += '<text x="' + tmX.toFixed(1) + '" y="' + (c.sy(tepe.tk) + (yakin ? 20 : -9)).toFixed(1)
     + '" font-size="11" fill="#8a5a1e">' + _frEsc(tm) + '</text>';
  if(K){
    var rm = rmT, tkm = _frNum(K.st.takeupMmPerDeg);
    var XM = c.sx(rm);
    g += '<line x1="' + XM.toFixed(1) + '" y1="' + c.pad.t + '" x2="' + XM.toFixed(1) + '" y2="'
       + (c.H - c.pad.b) + '" stroke="#2e7d4f" stroke-width="1.6" stroke-dasharray="4 3"/>';
    g += '<circle cx="' + XM.toFixed(1) + '" cy="' + c.sy(tkm).toFixed(1) + '" r="4" fill="#2e7d4f"/>';
    g += '<text x="' + (XM + 6).toFixed(1) + '" y="' + (c.pad.t + 12) + '" font-size="11" fill="#2e7d4f">Mean</text>';
  }
  var ilk = pts[0], son = pts[pts.length - 1];
  var aciklama = '';
  if(Number.isFinite(ilk.phi) && Number.isFinite(son.phi) && Number.isFinite(ilk.beta) && Number.isFinite(son.beta)){
    aciklama = ' Kol 0°\'den ' + _frFs(son.rel, 1) + '°\'ye giderken sarım açısı φ '
      + _frFs(ilk.phi, 1) + '° → ' + _frFs(son.phi, 1) + '° <b>düşer</b> (yani 2sin(φ/2) küçülür), '
      + 'buna karşılık β ' + _frFs(ilk.beta, 1) + '° → ' + _frFs(son.beta, 1) + '° <b>yükselir</b> '
      + '(yani sin β büyür). Çarpımları önce artar, sonra azalır.';
  }
  return _frFigWrap(g, 'Take-up oranının kol açısıyla değişimi. Eğri <b>monoton değildir</b>, çünkü '
    + '(4.3)\'ün iki çarpanı ters yönde çalışır.' + aciklama + ' Bu, take-up oranının neden tek bir '
    + 'sabit sayı olarak girilemeyeceğinin doğrudan gösterimidir: her kol konumunda başka bir değer alır '
    +'ve hesaplarda kullanılan, çalışma noktasındaki değerdir (yeşil).');
}

// 8.6 — çözülmüş geometri
function _frGeometryTable(R){
  var g = (R.analysis && R.analysis.geometry) || [];
  if(!g.length) return '';
  var sys = R.build && R.build.sys;
  var C = _frCore(), bp = null, b = sys && sys.belt;
  try { bp = (C && C.beltProps && b) ? C.beltProps(b) : null; } catch(e){}
  var sigma = _frSignedWrap(R);
  var h = '<h3>8.6 Çözülmüş geometri: açıklık, sarım, hız oranı</h3>';
  h += '<table><caption>Tablo ' + _frTbl() + ' — Kayış gidiş sırasında geometri</caption>';
  h += '<tr><th>Kasnak</th><th>Çıkış açıklığı</th><th>Sarım</th><th>İşaret</th><th>Hız oranı</th></tr>';
  var sumSpan = 0, sumArc = 0;
  g.forEach(function(row, i){
    var p = sys && sys.pulleys[i];
    var isG = !p || p.contact !== 'back';
    sumSpan += _frNum(row.exitSpanMm) || 0;
    if(p) sumArc += (_frNum(row.wrapDeg) * Math.PI / 180) * _frNum(p.rEff);
    h += '<tr><td class="l">' + _frEsc(row.name) + '</td>'
      + '<td>' + _frFs(row.exitSpanMm, 1) + '</td>'
      + '<td>' + _frFs(row.wrapDeg, 2) + '</td>'
      + '<td class="c">' + (isG ? '+' : '−') + '</td>'
      + '<td>' + _frFs(row.speedRatio, 3) + '</td></tr>';
  });
  h += '<tr class="sum"><td class="l">Toplam</td><td>' + _frFs(sumSpan, 1) + '</td>'
     + '<td colspan="2" class="c">Σ işaretli = ' + _frFs(sigma, 2) + '°</td><td class="c">—</td></tr>';
  h += '</table>';
  var Lp = _frNum(R.analysis && R.analysis.driveLenMm);
  var h1 = '';
  if(bp && Number.isFinite(Lp)){
    var Lpitch = sumSpan + _frSumArcPitch(g, sys);
    var fark = Lpitch - (sumSpan + sumArc);
    var bek = 2 * Math.PI * _frNum(bp.hb);
    h1 = '<p>Boy özdeşliği (3.6) denetimi: '
       + '\\( L_{\\text{pitch}} - L_{\\text{eff}} = \\) <b>' + _frFs(fark, 4) + ' mm</b>, '
       + 'beklenen \\( 2\\pi h_b = \\) <b>' + _frFs(bek, 4) + ' mm</b> — '
       + (Math.abs(fark - bek) < 1e-3 ? '<span class="ok">✓ tutuyor</span>' : '<b>✗ tutmuyor</b>') + '.</p>';
  }
  // φ'nin KURULUŞU: tabloda sarım açıları bir SONUÇ olarak duruyordu; bir
  // mühendis "bu açı nereden çıktı" diye sorduğunda cevap yalnız §3.3'ün
  // formülüydü. Şekil + tablo o formülü BU MODELİN sayılarıyla gösterir.
  var h2 = '<p>Yukarıdaki sarım açıları bir girdi değildir: her biri, kayışın kasnağa değdiği '
    + '<b>iki teğet noktasından</b> (3.3) ile hesaplanır. Aşağıda önce kuruluş bir kasnak üzerinde '
    + 'çizilmiş, ardından bütün kasnaklar için aritmetiği tablo hâlinde verilmiştir.</p>';
  return h + h1 + h2 + _frWrapFigure(R) + _frWrapAngleTable(R);
}
function _frSumArcPitch(g, sys){
  var t = 0;
  g.forEach(function(row, i){
    var p = sys && sys.pulleys[i];
    if(p) t += (_frNum(row.wrapDeg) * Math.PI / 180) * _frNum(p.rPitch);
  });
  return t;
}

// Konum etiketleri — model katmanının sözlüğünden (kisa=true → grafik etiketi).
function _frPosLabels(kisa){
  var out = {};
  var L = (typeof VE_FEAD_POSITIONS !== 'undefined') ? VE_FEAD_POSITIONS : null;
  if(L) L.forEach(function(p){ out[p.core] = kisa ? p.kisa : p.label; });
  return out;
}

// 8.8 — konum tablosu (Gates s.3'ün karşılığı)
function _frPositionTable(R){
  var pos = (R.analysis && R.analysis.positions) || [];
  if(!pos.length) return '';
  // Etiketler TEK KAYNAKTAN: model katmanındaki VE_FEAD_POSITIONS. Rapor kendi
  // sözlüğünü tutsaydı panelle ve kanvastaki kartla bir gün ayrışırdı.
  var TR = _frPosLabels();
  var h = '<h3>8.8 Gergi kolunun gezdiği zarf — altı konum</h3>';
  h += '<p>Kayış boyu tolerans ve aşınmayla değiştikçe kol döner; her konumda kayış yolu, sarım açıları ve '
     + 'gerginlik başkadır (§4.4). Aşağıdaki tablo bu zarfı verir. <b>Load bir mekanik durdurucudur, '
     + 'çalışma noktası değildir.</b></p>';
  h += '<table><caption>Tablo ' + _frTbl() + ' — Gergi kolu konum tablosu</caption>';
  h += '<tr><th>Büyüklük</th>';
  pos.forEach(function(p){
    var ad = TR[p.position] || p.position;
    var vurgu = (p.position === 'Mean') ? ' style="background:#eef2f6;"' : '';
    h += '<th' + vurgu + '>' + _frEsc(ad) + '</th>';
  });
  h += '</tr>';
  function sat(k, f, d){
    var s = '<tr><td class="l">' + k + '</td>';
    pos.forEach(function(p){
      var vurgu = (p.position === 'Mean') ? ' style="background:#f7f8f9;"' : '';
      s += '<td' + vurgu + '>' + (p.error ? '<span title="' + _frEsc(p.error) + '">Err.</span>' : _frFs(f(p), d)) + '</td>';
    });
    return s + '</tr>';
  }
  h += sat('Kol açısı — göreli [°]',  function(p){ return p.relDeg; }, 1);
  h += sat('Kol açısı — mutlak [°]',  function(p){ return p.absDeg; }, 1);
  h += sat('Gergi kasnağı X [mm]',    function(p){ return p.idlerX; }, 1);
  h += sat('Gergi kasnağı Y [mm]',    function(p){ return p.idlerY; }, 1);
  h += sat('Hubload–kol açısı β [°]', function(p){ return p.betaDeg; }, 1);
  h += sat('Hubload yönü [°]',        function(p){ return p.hubDirDeg; }, 1);
  h += sat('Hubload [N]',             function(p){ return p.hubloadN; }, 1);
  h += sat('Gerginlik [N]',           function(p){ return p.tensionN; }, 1);
  h += sat('Gergi sarımı [°]',        function(p){ return p.wrapDeg; }, 1);
  h += sat('Yay momenti [Nm]',        function(p){ return p.springNm; }, 2);
  h += sat('Take-up [mm/°]',          function(p){ return p.takeupMmPerDeg; }, 3);
  h += sat('Tahrik boyu [mm]',        function(p){ return p.driveLenMm; }, 1);
  h += sat('Gereken kayış boyu [mm]', function(p){ return p.requiredBeltMm; }, 1);
  h += '</table>';

  var hatali = pos.filter(function(p){ return !!p.error; });
  if(hatali.length){
    h += '<div class="note warn"><span class="t">Çözülemeyen konum</span>'
       + hatali.map(function(p){ return '<b>' + _frEsc(TR[p.position] || p.position) + '</b>: ' + _frEsc(p.error); }).join('<br>')
       + '<br>Bu konum kayışın çözüm aralığının dışına çıkıyor; tablodaki sütun <code>Err.</code> ile işaretlendi.</div>';
  }
  var b = R.build && R.build.sys && R.build.sys.belt;
  if(b && !(_frNum(b.tolerance) > 0) && !(_frNum(b.wearPct) > 0)){
    h += '<div class="note"><span class="t">Zarf daralmış</span>'
       + 'Kayış boy toleransı ve aşınma payı <b>0</b> girildiği için Değiştirme / Maks. / Çalışma / Min. '
       + 'konumları aynı kol açısına oturuyor — tablo tek anlamlı çalışma sütununa iner. '
       + 'Gerçek tolerans girildiğinde zarf açılır.</div>';
  }
  return h;
}

// 8.10 — çalışma çevrimi girdisi
function _frDutyInputTable(R){
  var rows = R.duty || [];
  if(!rows.length) return '';
  var names = R.pulleyNames || [];
  var sys = R.build && R.build.sys;
  var surucu = '';
  if(sys) sys.pulleys.forEach(function(p){ if(p.crank) surucu = p.name; });
  var yuk = names.filter(function(n){ return n !== surucu; });
  var h = '<h3>8.10 Çalışma çevrimi (duty cycle) girdisi</h3>';
  h += '<p>Her satır bir motor devri noktasıdır: süre payı (duty cycle), kayış sıcaklığı ve aksesuarların '
     + 'o devirde çektiği güç. <b>Sürücü kasnağın gücü tabloda yoktur</b> — çevrimin kapanabilmesi için '
     + 'aksesuar güçlerinin toplamı olarak hesaplanır (5.3).</p>';
  h += '<table><caption>Tablo ' + _frTbl() + ' — Çalışma çevrimi girdisi</caption>';
  h += '<tr><th>Motor devri</th><th>Süre payı</th><th>Sıcaklık</th>';
  yuk.forEach(function(n){ h += '<th>' + _frEsc(n) + '</th>'; });
  h += '<th>Σ (sürücü)</th></tr>';
  rows.forEach(function(r){
    var top = 0;
    h += '<tr><td>' + _frF(r.engineRpm, 0) + ' d/d</td><td>' + _frPct(r.dcPct, 1) + '</td>'
       + '<td>' + _frF(r.degC, 0) + ' °C</td>';
    yuk.forEach(function(n){
      var v = _frNum(r.loadsKw && r.loadsKw[n]);
      if(Number.isFinite(v)) top += v;
      h += '<td>' + (Number.isFinite(v) ? _frFs(v, 2) : '—') + '</td>';
    });
    h += '<td><b>' + _frFs(top, 2) + '</b></td></tr>';
  });
  h += '<tr class="sum"><td class="l">Toplam süre payı</td><td>' + _frPct(_frDutySum(R), 1) + '</td>'
     + '<td colspan="' + (yuk.length + 2) + '" class="c">güçler kW</td></tr>';
  h += '</table>';
  return h;
}

// 8.11 — ortalama gerginlik ve hubload
// BİÇİM: devir SATIR, kasnak SÜTUN — tedarikçi sayfasının ("Mean Tensions N",
// "Mean Hubloads N") biçimi. Devir başına ayrı tablo basmak aynı veriyi dokuz
// kez, her seferinde aynı span boylarıyla tekrarlıyordu (ölçüldü: belge 41 000
// px'e çıkıyor ve okuyan kişi devirler arası farkı göremiyor). Matris hâlinde
// bir sütunu yukarıdan aşağı okumak, o kasnağın devirle nasıl değiştiğini
// doğrudan gösteriyor.
function _frTensionTables(R){
  var duty = (R.analysis && R.analysis.duty) || [];
  if(!duty.length) return '';
  var adlar = (duty[0].perPulley || []).map(function(q){ return q.name; });
  var h = '<h3>8.11 Ortalama gerginlik ve hubload</h3>';
  h += '<p>Gerginlik kayış boyunca sabit değildir: sürücü kasnakta yükselir, her güç çeken kasnakta bir '
     + 'basamak düşer, avara ve gergide değişmez (§5.1). Aşağıdaki değer, o kasnaktan <b>sonraki</b> '
     + 'açıklığın gerginliğidir. Hız oranları §8.6\'da; aksesuar devri = motor devri × hız oranı.</p>';

  function matris(baslik, oku, dec){
    var t = '<table><caption>Tablo ' + _frTbl() + ' — ' + baslik + '</caption>';
    t += '<tr><th>Motor devri</th><th>Süre payı</th>';
    adlar.forEach(function(n){ t += '<th>' + _frEsc(n) + '</th>'; });
    t += '</tr>';
    duty.forEach(function(d){
      t += '<tr><td>' + _frF(d.engineRpm, 0) + '</td><td>' + _frPct(d.dcPct, 1) + '</td>';
      adlar.forEach(function(n, i){ t += '<td>' + _frFs(oku(d, i, n), dec) + '</td>'; });
      t += '</tr>';
    });
    return t + '</table>';
  }
  h += matris('Ortalama çıkış gerginliği [N]', function(d, i){ return (d.perPulley[i] || {}).exitTensionN; }, 0);
  h += matris('Ortalama hubload [N]', function(d, i){ return ((d.hubloads || [])[i] || {}).FN; }, 0);
  h += matris('Hubload yönü [°]', function(d, i){ return ((d.hubloads || [])[i] || {}).dirDeg; }, 1);
  h += matris('Aksesuar devri [d/d]', function(d, i){ return (d.perPulley[i] || {}).accessoryRpm; }, 0);
  h += '<p style="font-size:13px;color:#5a6270;">Hubload büyüklüğü ve yönü (5.4)\'ten gelir; yön kayış '
     + 'düzleminde +X\'ten saat yönünün tersine ölçülür. Yatak seçimi ve braket tasarımı bu yöne bağlıdır.</p>';
  return h;
}

// 8.12 — kayma emniyeti
function _frSlipSection(R){
  var duty = (R.analysis && R.analysis.duty) || [];
  if(!duty.length) return '';
  var sf = _frNum(R.serviceFact);
  var esik = (Number.isFinite(sf) && sf > 0) ? sf : NaN;
  var h = '<h3>8.12 Kayma emniyeti</h3>';
  h += '<p>Kayışın kasnak üzerinde kaymadan taşıyabileceği gerginlik oranı capstan bağıntısıyla '
     + 'sınırlıdır (5.6). Emniyet faktörü, kapasitenin fiili orana bölümüdür (5.7); '
     + '\\( \\mathrm{SF}=1 \\) kayma eşiğidir'
     + (Number.isFinite(esik) ? ', istenen alt sınır <b>servis faktörü ' + _frF(esik, 2) + '</b>' : '')
     + '.</p>';
  var st = _frSlipStats(R);
  h += '<table><caption>Tablo ' + _frTbl() + ' — Kayma emniyet faktörü (her devir noktası × kasnak)</caption>';
  h += '<tr><th>Motor devri</th>';
  ((duty[0] && duty[0].slip) || []).forEach(function(s){ h += '<th>' + _frEsc(s.name) + '</th>'; });
  h += '<th>En düşük</th></tr>';
  duty.forEach(function(d){
    var mn = Infinity;
    h += '<tr><td>' + _frF(d.engineRpm, 0) + ' d/d</td>';
    (d.slip || []).forEach(function(s){
      var v = _frNum(s.SF);
      if(v < mn) mn = v;
      var kotu = Number.isFinite(esik) && Number.isFinite(v) && v < esik;
      h += '<td' + (kotu ? ' style="color:#a8321f;font-weight:600;"' : '') + '>' + _frFs(v, 2) + '</td>';
    });
    h += '<td><b>' + _frFs(mn, 2) + '</b></td></tr>';
  });
  h += '</table>';
  h += _frSlipFigure(R, esik);
  if(st.anyLoaded && Number.isFinite(st.loadedMin)){
    var ok = !Number.isFinite(esik) || st.loadedMin >= esik;
    h += '<div class="note ' + (ok ? 'check' : 'warn') + '"><span class="t">En kritik YÜK TAŞIYAN kasnak</span>'
       + '<b>' + _frEsc(st.loadedName) + '</b>, ' + _frF(st.loadedRpm, 0) + ' d/d — SF = <b>'
       + _frFs(st.loadedMin, 2) + '</b>. '
       + (ok ? 'Servis faktörünün üstünde.'
             : 'Servis faktörünün ALTINDA: sarım açısını artırın ya da gergi künyesini '
               + '(yay ön yükü / oranı / kol boyu) güçlendirin.')
       + '</div>';
  }
  // YÜK TAŞIMAYAN KASNAKLAR AYRI YAZILIR — gizlenmez, ama hükme girmez.
  if(st.idle.length){
    var ib = st.idle.map(function(q){
      return _frEsc(q.name) + ' (oran ' + _frFs(q.ratio, 4) + ' · kapasite ' + _frFs(q.cap, 2) + ')';
    }).join(' · ');
    h += '<div class="note"><span class="t">Yük taşımayan kasnaklarda SF bir MARJ değil, KAPASİTEDİR</span>'
       + 'Aşağıdaki kasnaklarda gerginlik oranı 1,00\'e eşit sayılacak kadar yakındır, yani kayışın '
       + 'kayması için bir talep yoktur; SF sayısı o sarım açısının taşıyabileceği azami orandır. '
       + '<b>Bu kasnaklarda tasarım gerginliğini yükseltmek SF\'yi DEĞİŞTİRMEZ</b> — gergin ve boş '
       + 'taraf birlikte yükselir, oran 1\'de kalır (§8.7). Tek etkili değişken sarım açısıdır. '
       + 'Bu yüzden yukarıdaki hüküm yalnız yük taşıyan kasnaklara dayanır: ' + ib + '.</div>';
  }
  h += '<p style="font-size:13px;color:#5a6270;">Kaburgalı temasta etkin sürtünme kanal geometrisiyle '
     + 'büyür; sırttan temas eden avara ve gergi kasnaklarında düz yüzey sürtünmesi geçerlidir ve emniyet '
     + 'payı dardır. Sürtünme katsayıları çekirdeğin kalibrasyon sabitleridir.</p>';
  return h;
}

// 8.13 — aksesuar torku (ORTALAMA — tepe değil)
function _frTorqueSection(R){
  var duty = (R.analysis && R.analysis.duty) || [];
  if(!duty.length) return '';
  var h = '<h3>8.13 Aksesuar mil torku (ortalama)</h3>';
  h += '<p>Mil torku güçten ve devirden çıkar: \\( Q = 9549\\,P/n \\) (5.1). Aşağıdaki değerler '
     + '<b>ortalama</b> çalışma torklarıdır; motorun hızlanma/yavaşlamasında atalet momentlerinden '
     + 'doğan tepe torklar (5.8) bu tabloda <b>yoktur</b> (§9.5).</p>';
  // HİÇBİR AKSESUARA GÜÇ GİRİLMEMİŞSE tablo tek sütunlu ve bomboş çıkıyordu:
  // on iki devir satırı, hiçbir sayı, hiçbir açıklama. Okuyucu bunu "tork
  // hesaplanamadı" diye okuyordu; oysa sebep girdinin kendisi. Sebep yazılıyor
  // ve boş tablo hiç basılmıyor.
  var yukler = ((duty[0] && duty[0].perPulley) || []).filter(function(q){ return _frNum(q.powerKw) > 0; });
  if(!yukler.length){
    h += '<div class="note warn"><span class="t">Aksesuar gücü girilmedi</span>'
       + 'Çalışma çevrimi tablosundaki (§8.10) hiçbir aksesuar için sıfırdan büyük bir güç yok, '
       + 'dolayısıyla mil torku hesaplanacak bir yük de yok. Bu bir hesap hatası değil, eksik '
       + 'girdidir: aksesuar güçleri girilmeden §8.11\'deki gerginlikler de tasarım gerginliğine '
       + 'düzleşir ve sistem yüksüz görünür.</div>';
    return h;
  }
  h += '<table><caption>Tablo ' + _frTbl() + ' — Aksesuar ortalama mil torku [Nm]</caption>';
  h += '<tr><th>Motor devri</th>';
  yukler.forEach(function(q){ h += '<th>' + _frEsc(q.name) + '</th>'; });
  h += '</tr>';
  duty.forEach(function(d){
    h += '<tr><td>' + _frF(d.engineRpm, 0) + ' d/d</td>';
    yukler.forEach(function(ref){
      var q = (d.perPulley || []).filter(function(x){ return x.name === ref.name; })[0];
      var Q = (q && _frNum(q.accessoryRpm) > 0) ? 9549 * _frNum(q.powerKw) / _frNum(q.accessoryRpm) : NaN;
      h += '<td>' + _frFs(Q, 2) + '</td>';
    });
    h += '</tr>';
  });
  h += '</table>';
  return h;
}

// 8.14 — kaburga yorulma dağılımı
function _frFatigueSection(R){
  var f = R.fatigue;
  if(!f || !f.perPulley || !f.perPulley.length) return '';
  var h = '<h3>8.14 Kaburga yorulma dağılımı</h3>';
  h += '<p>Her kasnağın kayış kaburga yorulmasına katkısı (6.2). Payı yüksek olan kasnak, çapı '
     + 'büyütülerek ya da temas tarafı değiştirilerek ömrü en çok uzatacak olandır. '
     + '<b>Bu dağılım bir orandır ve mutlak ömrün geçerlilik penceresinden bağımsızdır</b> (§9.3).</p>';
  h += '<table><caption>Tablo ' + _frTbl() + ' — Kasnak başına yorulma payı</caption>';
  h += '<tr><th>Kasnak</th><th>Efektif çap</th><th>Temas</th><th>Pay</th></tr>';
  var toplam = 0;
  f.perPulley.forEach(function(p){
    toplam += _frNum(p.sharePct) || 0;
    h += '<tr><td class="l">' + _frEsc(p.name) + '</td><td>' + _frFs(p.dEffMm, 1) + '</td>'
       + '<td class="c">' + (p.contact === 'back' ? 'sırt' : 'kaburgalı') + '</td>'
       + '<td>' + _frFs(p.sharePct, 2) + '</td></tr>';
  });
  h += '<tr class="sum"><td class="l">Toplam</td><td colspan="2" class="c">—</td><td>'
     + _frFs(toplam, 2) + '</td></tr></table>';
  h += _frFatigueFigure(R);
  return h;
}

// 8.15 — yük durumu katkısı
function _frLoadContribTable(R){
  var f = R.fatigue;
  if(!f || !f.perLoadPct || !f.perLoadPct.length) return '';
  var duty = (R.analysis && R.analysis.duty) || [];
  var h = '<h3>8.15 Yük durumunun yorulmaya katkısı</h3>';
  h += '<p>Her devir noktasının toplam hasara katkısı (6.3): süre payı, tur sayısı ve o noktadaki '
     + 'gergin/boş taraf gerginlikleri birlikte belirler.</p>';
  h += '<table><caption>Tablo ' + _frTbl() + ' — Devir noktası başına yorulma katkısı</caption>';
  h += '<tr><th>Motor devri</th><th>Kayış hızı</th><th>Gergin taraf T<sub>t</sub></th>'
     + '<th>Boş taraf T<sub>s</sub></th><th>Katkı</th></tr>';
  var toplam = 0;
  f.perLoadPct.forEach(function(r){
    var d = duty.filter(function(x){ return _frNum(x.engineRpm) === _frNum(r.engineRpm); })[0];
    var Tt = NaN, Ts = NaN;
    if(d && d.perPulley && d.perPulley.length){
      var vals = d.perPulley.map(function(q){ return _frNum(q.exitTensionN); }).filter(Number.isFinite);
      if(vals.length){ Tt = Math.max.apply(null, vals); Ts = Math.min.apply(null, vals); }
    }
    toplam += _frNum(r.sharePct) || 0;
    h += '<tr><td>' + _frF(r.engineRpm, 0) + ' d/d</td><td>' + _frFs(r.vMs, 1) + ' m/s</td>'
       + '<td>' + _frF(Tt, 0) + '</td><td>' + _frF(Ts, 0) + '</td>'
       + '<td>' + _frFs(r.sharePct, 1) + '</td></tr>';
  });
  h += '<tr class="sum"><td class="l">Toplam</td><td colspan="3" class="c">—</td><td>'
     + _frFs(toplam, 1) + '</td></tr></table>';
  return h;
}

// 8.16 — B10 ömrü
function _frLifeSection(R){
  var L = R.life;
  if(!L) return '';
  var h = '<h3>8.16 B10 kayış ömrü</h3>';
  h += '<table><caption>Tablo ' + _frTbl() + ' — Ömür sonucu ve kalibrasyon sabitleri</caption>';
  h += '<tr><th>Büyüklük</th><th>Değer</th><th>Birim</th></tr>';
  function tr(k, v, u){ return '<tr><td class="l">' + k + '</td><td>' + v + '</td><td class="c">' + (u || '—') + '</td></tr>'; }
  h += tr('B10 ömrü', '<b>' + _frF(L.hoursB10, 0) + '</b>', 'saat');
  if(Number.isFinite(_frNum(L.hoursB10Corrected)) && !L.inValidRange)
    h += tr('B10 — ampirik düzeltmeli', _frF(L.hoursB10Corrected, 0), 'saat');
  h += tr('Hasar hızı', _frNum(L.damageRate).toExponential(3).replace('.', ','), '1/s');
  h += tr('Tur/saniye', _frFs(L.passesPerSec, 2), '1/s');
  h += tr('Çalışma çevrimi kapsamı', _frPct(_frNum(L.dutyCoverage) * 100, 1), '—');
  if(L.constants){
    h += tr('Sıcaklık yarılanması', _frF(L.constants.halvingDegC, 0), '°C');
    h += tr('Referans sıcaklık', _frF(L.constants.refDegC, 0), '°C');
    h += tr('Gerginlik üsteli', _frFs(L.constants.tensionExp, 3), '—');
  }
  h += '</table>';
  if(!L.inValidRange){
    h += '<div class="note warn"><span class="t">Mutlak ömür geçerlilik penceresinin dışında</span>'
       + (L.outOfRange && L.outOfRange.length
          ? 'Pencere dışındaki kasnak(lar): <b>' + _frEsc(L.outOfRange.join(', ')) + '</b>. '
          : '')
       + 'Model bu durumda mutlak saati sistematik olarak düşük veriyor; yukarıdaki "ampirik düzeltmeli" '
       + 'satır bu sapmayı kabaca telafi eder. <b>Kasnak katkı payları (§8.14) ve yük durumu katkıları '
       + '(§8.15) bu pencereden bağımsız olarak geçerlidir</b> — tasarım kararı için onları kullanın.</div>';
  } else {
    h += '<div class="note check"><span class="t">Geçerlilik penceresinde</span>'
       + 'Tüm kasnak çapları kalibrasyon aralığında; mutlak saat değeri kullanılabilir.</div>';
  }
  if(L.caveat)
    h += '<p style="font-size:13px;color:#5a6270;">' + _frEsc(L.caveat) + '</p>';
  return h;
}

// 8.17 — açıklık doğal frekansları
// Span BOYLARI devirle değişmiyor (geometri sabit); devir başına ayrı tablo
// aynı boyu dokuz kez basıyordu. Özet tablo her açıklığın f1 ARALIĞINI verir,
// devir-devir seyri ise grafikte.
function _frFreqSection(R){
  var duty = (R.analysis && R.analysis.duty) || [];
  if(!duty.length || !duty[0].frequencies) return '';
  var spans = duty[0].frequencies.map(function(s){ return s.span; });
  var h = '<h3>8.17 Serbest açıklık titreşimi</h3>';
  h += '<p>Her açıklığın temel enine titreşim frekansı (7.2) ile hesaplanır ve motorun ateşleme '
     + 'frekansıyla (7.3) karşılaştırılır. İkisi yakınsa o açıklık çırpınır (flutter). Aşağıdaki tablo '
     + 'çalışma çevrimi boyunca görülen aralığı verir; devir-devir seyir grafikte.</p>';
  h += '<table><caption>Tablo ' + _frTbl() + ' — Açıklık frekans aralıkları (çalışma çevrimi boyunca)</caption>';
  h += '<tr><th>Açıklık</th><th>Boy</th><th>Gerginlik (en az–en çok)</th><th>f<sub>1</sub> (en az–en çok)</th><th>Çırpınma</th></tr>';
  spans.forEach(function(sp, i){
    var L = NaN, Tlo = Infinity, Thi = -Infinity, flo = Infinity, fhi = -Infinity, flut = false;
    duty.forEach(function(d){
      var s = (d.frequencies || [])[i]; if(!s) return;
      L = _frNum(s.LMm);
      var T = _frNum(s.TN); if(T < Tlo) Tlo = T; if(T > Thi) Thi = T;
      var f = (s.fHz && s.fHz.length) ? _frNum(s.fHz[0]) : NaN;
      if(Number.isFinite(f)){ if(f < flo) flo = f; if(f > fhi) fhi = f; }
      if(s.flutter) flut = true;
    });
    h += '<tr><td class="l">' + _frEsc(sp) + '</td><td>' + _frFs(L, 1) + '</td>'
      + '<td>' + _frF(Tlo, 0) + ' – ' + _frF(Thi, 0) + '</td>'
      + '<td>' + _frFs(flo, 1) + ' – ' + _frFs(fhi, 1) + '</td>'
      + '<td class="c">' + (flut ? '<b style="color:#a8321f;">var</b>' : '<span class="ok">✓ yok</span>') + '</td></tr>';
  });
  h += '</table>';
  var fLo = _frNum(duty[0].firingHz), fHi = _frNum(duty[duty.length - 1].firingHz);
  h += '<p>Ateşleme frekansı çalışma çevrimi boyunca <b>' + _frFs(fLo, 1) + ' – ' + _frFs(fHi, 1)
     + ' Hz</b> aralığındadır (7.3).</p>';
  h += _frFreqFigure(R);
  h += '<div class="note"><span class="t">Bu tablo AÇIKLIK titreşimidir, sistem burulması değil</span>'
     + 'Yukarıdaki değerler açıklıkların <b>enine</b> titreşimidir — kayışın o parçasının teli gibi '
     + 'salınması. Tedarikçi raporundaki "Natural Frequency" / "System Resonance" satırları ise krank, '
     + 'aksesuar ataletleri ve gergi kolunun birlikte çözüldüğü çok serbestlik dereceli bir '
     + '<b>burulma</b> modudur. İkisi ayrı büyüklüktür; burulma modeli 8.18\'de ayrıca verilmiştir.';
  h += '</div>';
  return h;
}

// 8.18 — sistem burulma titreşimi
// ESKİDEN YOKTU ve rapor bunu "hesaplanmamıştır" diye yazıyordu; doğruydu.
// Çekirdeğe torsionalModel() girdikten sonra o cümle YANLIŞ hâle geldi — rapor
// tedarikçiye giden belge olduğu için orada kalan bir yanlış, panelde kalandan
// daha pahalı. Bölüm, sayıyı da geçerlilik sınırını da birlikte taşıyor.
function _frTorsionalSection(R){
  var T = R && R.torsional;
  var h = '<h3>8.18 Sistem burulma titreşimi</h3>';
  if(!T || !Number.isFinite(T.firstElasticHz)){
    // Hesaplanamadıysa SEBEBİ yazılır; boş bölüm "yok" sanılır.
    h += '<div class="note warn"><span class="t">Hesaplanamadı</span>'
       + 'Burulma modeli her kasnağın atalet momentini, gergi kolunun ataletini ve gergi kasnağının '
       + 'kütlesini ister. Bunlardan biri eksikse model kurulamaz — eksik olan alan Çözücü panelindeki '
       + 'uyarı satırında yazılıdır. Tedarikçi raporunun "System Vibration Analysis" sayfası bu '
       + 'değerleri listeler.</div>';
    return h;
  }
  h += '<p>Krank–kayış–aksesuar–gergi zinciri, açıklıkların yay gibi davrandığı çok serbestlik dereceli '
     + 'bir burulma sistemidir. Serbestlikler kasnak açıları ve gergi kolu açısıdır; açıklık eksenel '
     + 'rijitlikleri (7.4) yayları, kasnak ve kol ataletleri kütleleri oluşturur. Özdeğer çözümü '
     + 'sistem modlarını verir.</p>';

  h += '<table><caption>Tablo ' + _frTbl() + ' — Sistem burulma modları (çalışma konumunda)</caption>';
  h += '<tr><th>Mod</th><th>Frekans</th><th>Karşılık gelen motor devri<sup>*</sup></th></tr>';
  var d0 = (R.analysis && R.analysis.duty && R.analysis.duty[0]) || null;
  var rpmOf = function(f){
    return (d0 && d0.firingHz > 0) ? (f / d0.firingHz * d0.engineRpm) : NaN;
  };
  h += '<tr><td class="l">Rijit cisim</td><td>0,0</td><td>—</td></tr>';
  (T.elasticHz || []).forEach(function(f, i){
    h += '<tr><td class="l">' + (i + 1) + '. elastik</td><td>' + _frFs(f, 1) + '</td>'
      + '<td>' + _frFs(rpmOf(f), 0) + '</td></tr>';
  });
  h += '</table>';
  h += '<p><sup>*</sup> Ateşleme mertebesinin o frekansa ulaştığı motor devri (7.3). Rijit cisim modu '
     + 'sistemin bütün olarak dönmesidir; frekansı sıfırdır ve <b>tam bir tane</b> olmak zorundadır — '
     + 'fazlası modelin koptuğunu gösterir (bu çözümde ' + T.rigidBodyModes + ' tane).</p>';

  // Ateşleme bandıyla örtüşme — hüküm değil, gözlem.
  var duty = (R.analysis && R.analysis.duty) || [];
  if(duty.length){
    var fs = duty.map(function(d){ return _frNum(d.firingHz); });
    var lo = Math.min.apply(null, fs), hi = Math.max.apply(null, fs);
    var ic = (T.elasticHz || []).filter(function(f){ return f >= lo && f <= hi; });
    h += '<div class="note ' + (ic.length ? 'warn' : 'check') + '">'
       + '<span class="t">Ateşleme bandıyla örtüşme</span>'
       + 'Çalışma çevrimi boyunca ateşleme frekansı <b>' + _frFs(lo, 1) + ' – ' + _frFs(hi, 1)
       + ' Hz</b> aralığındadır. '
       + (ic.length
          ? 'Bu aralığın içine <b>' + ic.length + ' elastik mod</b> düşüyor ('
            + ic.map(function(f){ return _frFs(f, 1); }).join(' · ') + ' Hz ≈ '
            + ic.map(function(f){ return _frFs(rpmOf(f), 0); }).join(' · ')
            + ' d/dk). Ateşleme mertebesi bu devirlerde ilgili modu uyarır; sönüm ve uyarma '
            + 'genliği bu modelin kapsamı dışındadır, dolayısıyla bu bir <b>işaret</b>tir, hüküm değil.'
          : 'Hiçbir elastik mod bu aralığın içine düşmüyor.')
       + '</div>';
  }

  // Modelin kendi iç tutarlılık kapısı.
  if(T.takeupCheck && Number.isFinite(T.takeupCheck.errPct)){
    h += '<p>İç tutarlılık: kol açısının açıklık boylarına türevlerinin toplamı, gergi take-up oranıyla '
       + '<b>%' + _frFs(T.takeupCheck.errPct, 3) + '</b> farkla örtüşmektedir (aynı büyüklüğün iki ayrı '
       + 'yoldan hesabı; ayrışması geometri ile dinamik modelin farklı şeyi anlattığını gösterirdi).</p>';
  }

  h += '<div class="note warn"><span class="t">Güven düzeyi: bu bölüm KALİBRE bir modeldir</span>'
     + 'Bu belgenin geometri ve gerginlik zinciri 17 tedarikçi raporunun 2095 değerine <b>%0,33</b> '
     + 'ile oturan deterministik bir hesaptır. Burulma modeli öyle değildir: iki serbest parametresi '
     + 'vardır (kayış kord rijitliği ve kavis payı) ve tedarikçi raporlarının "System Resonance '
     + '(Mode 1)" satırına altı sistemde <b>RMS ~%8</b> ile kalibre edilmiştir. Sonucu bir '
     + '<b>mertebe göstergesi</b> olarak okuyunuz; sertifikasyon dayanağı değildir (§9.2).</div>';
  return h;
}

// 8.19 — tasarım notları
function _frNotesSection(node){
  var raw = node && node.data && node.data.notes;
  if(!raw || !String(raw).trim()) return '';
  var satirlar = String(raw).split(/\r?\n/).filter(function(s){ return s.trim(); });
  if(!satirlar.length) return '';
  var h = '<h3>8.19 Tasarım notları</h3>';
  h += '<table><caption>Tablo ' + _frTbl() + ' — Tasarım notları</caption>';
  h += '<tr><th>Tarih</th><th>Not</th></tr>';
  satirlar.forEach(function(s){
    var i = s.indexOf('|');
    var t = (i > 0) ? s.slice(0, i).trim() : '—';
    var n = (i > 0) ? s.slice(i + 1).trim() : s.trim();
    h += '<tr><td class="c">' + _frEsc(t) + '</td><td class="l">' + _frEsc(n) + '</td></tr>';
  });
  h += '</table>';
  return h;
}

// ═══════════════════ ŞEKİLLER (SVG) ═════════════════════════════════════════
// Ortak XY çizer. Renkler ve yazı tipi rapor CSS'inden gelir (svg text kuralı
// global); burada yalnız geometri var. Eksen etiketleri her zaman basılır —
// birimsiz bir eğri okunamaz.
var _FR_W = 820, _FR_H = 300;
// ── EKSEN BÖLMESİ YUVARLAK SAYIYA OTURUR ────────────────────────────────────
// Eskiden aralık beşe/dörde eşit bölünüyordu ve bölmeler ham veri ucundan
// türüyordu: gerginlik grafiğinde X `0 · 12,1 · 24,2 · 36,2 · 48,3 · 60,4`,
// Y `0 · 293 · 585 · 878 · 1170` çıkıyordu (ÖLÇÜLDÜ). `36,2` bir bölme değil,
// 12,08'lik adımın yuvarlama artığı — okuyucu ondan bir değer okuyamıyor,
// üstelik iki komşu etiket arasındaki fark her seferinde başka.
//
// Adım 1 · 2 · 2,5 · 5 × 10ⁿ kümesinden seçilir ve aralık ADIMA GÖRE DIŞA
// yuvarlanır (veriye kırpılmaz) — böylece hem etiketler okunur sayılar olur
// hem de eğrinin uçları eksene yapışmaz.
// EN YAKIN aday seçilir, YUKARI yuvarlanmaz. Yukarı yuvarlama bir kez denendi
// ve ÖLÇÜLDÜ: 0…60,4 aralığı (ham adım 12,08) adımı 20'ye çıkarıyor, eksen
// 0…80 oluyordu — verinin bittiği yerden sonra çizim alanının dörtte biri boş.
// En yakın aday 10 veriyor, eksen 0…70 oluyor.
function _frNiceStep(ham){
  if(!(ham > 0) || !Number.isFinite(ham)) return 1;
  var us = Math.pow(10, Math.floor(Math.log10(ham))), k = ham / us;
  var aday = [1, 2, 2.5, 5, 10], en = aday[0], d = Infinity;
  aday.forEach(function(a){
    var q = Math.abs(Math.log(k / a));          // ORANSAL yakınlık: 1↔2 ile 5↔10 eşit uzak
    if(q < d){ d = q; en = a; }
  });
  return en * us;
}
function _frNiceAxis(v0, v1, hedef){
  if(!(v1 > v0)) v1 = v0 + 1;
  var n = Math.max(2, hedef || 5);
  var st = _frNiceStep((v1 - v0) / n);
  var a = Math.floor(v0 / st) * st, b = Math.ceil(v1 / st) * st;
  // Kayan nokta artığı: 0.30000000000000004 gibi bir bölme etiketi basılmasın.
  var ond = Math.max(0, -Math.floor(Math.log10(st)) + 1);
  var t = [];
  for(var v = a; v <= b + st * 1e-6; v += st) t.push(Number(v.toFixed(ond)));
  return { min: a, max: b, step: st, ticks: t };
}

function _frChart(opt){
  // SAĞ PAY ÇAĞIRANDAN GELEBİLİR: göstergesi olan bir grafikte gösterge çizim
  // alanının DIŞINDA durmalı. İçeride durduğunda eğrilerin üstüne biniyordu —
  // ÖLÇÜLDÜ (doğal frekans haritası): yedi girdilik gösterge çizim alanının
  // %42'sini kaplıyor ve altı eğrinin dördünü kesiyordu.
  var pad = { l: 62, r: (opt.padR || 18), t: 16, b: 42 };
  var W = opt.W || _FR_W, H = opt.H || _FR_H;
  var x0 = opt.xMin, x1 = opt.xMax, y0 = opt.yMin, y1 = opt.yMax;
  if(!(x1 > x0)) x1 = x0 + 1;
  if(!(y1 > y0)) y1 = y0 + 1;
  // `nice:false` ham aralığı korur (kalibrasyon çizimleri için kaçış kapağı).
  var axX = null, axY = null;
  if(opt.nice !== false){
    axX = _frNiceAxis(x0, x1, opt.nX || 6); x0 = axX.min; x1 = axX.max;
    axY = _frNiceAxis(y0, y1, opt.nY || 5); y0 = axY.min; y1 = axY.max;
  }
  var sx = function(v){ return pad.l + (v - x0) / (x1 - x0) * (W - pad.l - pad.r); };
  var sy = function(v){ return H - pad.b - (v - y0) / (y1 - y0) * (H - pad.t - pad.b); };
  var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + _frEsc(opt.alt || '') + '">';
  // ızgara + eksen
  var tX = axX ? axX.ticks : null, tY = axY ? axY.ticks : null;
  var nX = tX ? tX.length - 1 : 5, nY = tY ? tY.length - 1 : 4, i;
  for(i = 0; i <= nX; i++){
    var xv = tX ? tX[i] : x0 + (x1 - x0) * i / nX, X = sx(xv);
    g += '<line x1="' + X.toFixed(1) + '" y1="' + pad.t + '" x2="' + X.toFixed(1) + '" y2="' + (H - pad.b)
       + '" stroke="#e4e6e9" stroke-width="1"/>';
    g += '<text x="' + X.toFixed(1) + '" y="' + (H - pad.b + 15) + '" text-anchor="middle" font-size="11" fill="#5a6270">'
       + _frF(xv, opt.xDec == null ? 0 : opt.xDec) + '</text>';
  }
  for(i = 0; i <= nY; i++){
    var yv = tY ? tY[i] : y0 + (y1 - y0) * i / nY, Y = sy(yv);
    g += '<line x1="' + pad.l + '" y1="' + Y.toFixed(1) + '" x2="' + (W - pad.r) + '" y2="' + Y.toFixed(1)
       + '" stroke="#e4e6e9" stroke-width="1"/>';
    g += '<text x="' + (pad.l - 7) + '" y="' + (Y + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="#5a6270">'
       + _frF(yv, opt.yDec == null ? 0 : opt.yDec) + '</text>';
  }
  g += '<line x1="' + pad.l + '" y1="' + pad.t + '" x2="' + pad.l + '" y2="' + (H - pad.b) + '" stroke="#1b1e24" stroke-width="1.2"/>';
  g += '<line x1="' + pad.l + '" y1="' + (H - pad.b) + '" x2="' + (W - pad.r) + '" y2="' + (H - pad.b) + '" stroke="#1b1e24" stroke-width="1.2"/>';
  g += '<text x="' + ((pad.l + W - pad.r) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11.5" fill="#1b1e24">'
     + _frEsc(opt.xLabel || '') + '</text>';
  g += '<text transform="translate(14,' + ((pad.t + H - pad.b) / 2) + ') rotate(-90)" text-anchor="middle" font-size="11.5" fill="#1b1e24">'
     + _frEsc(opt.yLabel || '') + '</text>';
  return { svg: g, sx: sx, sy: sy, W: W, H: H, pad: pad };
}
function _frPolyline(c, pts, renk, kal, dash){
  if(!pts.length) return '';
  var d = pts.map(function(p, i){ return (i ? 'L' : 'M') + c.sx(p[0]).toFixed(1) + ' ' + c.sy(p[1]).toFixed(1); }).join(' ');
  return '<path d="' + d + '" fill="none" stroke="' + renk + '" stroke-width="' + (kal || 2)
    + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' stroke-linejoin="round"/>';
}
function _frFigWrap(svg, caption){
  if(_FR_RAW) return svg + '</svg>';        // özet rapor: numarasız ham SVG
  return '<figure>' + svg + '</svg><figcaption><b>Şekil ' + _frFig() + ' —</b> ' + caption + '</figcaption></figure>';
}
var _FR_RAW = false;
// Aynı figür işlevini KÜÇÜK ölçüde ve numarasız çalıştırır. Sayaçlara
// dokunmaz: özet rapor ayrıntılı raporun şekil numaralandırmasını kaydırmamalı.
function veFeadFigureRaw(fn, R, W, H, extra){
  var oW = _FR_W, oH = _FR_H, oR = _FR_RAW;
  _FR_W = W; _FR_H = H; _FR_RAW = true;
  try { return fn(R, extra); }
  catch(e){ return ''; }
  finally { _FR_W = oW; _FR_H = oH; _FR_RAW = oR; }
}

// Gergi kolu taraması — Belt Tension Control ve Take-up grafiklerinin ortak verisi.
function _frArmSweep(R){
  var C = _frCore(), sys = R.build && R.build.sys;
  if(!C || !sys || !C.tensionerState) return null;
  var hi = 60;
  try { if(C.feasibleRelMax) hi = C.feasibleRelMax(sys); } catch(e){}
  if(!(hi > 0)) return null;
  var pts = [], N = 90, i;
  for(i = 0; i <= N; i++){
    var rel = hi * i / N;
    try {
      var st = C.tensionerState(sys, rel);
      if(st && Number.isFinite(st.tensionN))
        pts.push({ rel: rel, abs: st.absDeg, T: st.tensionN, L: st.driveLenMm, tk: st.takeupMmPerDeg,
                   phi: st.wrapDeg, beta: st.betaDeg });
    } catch(e){}
  }
  return pts.length > 3 ? { pts: pts, relMax: hi } : null;
}

// Şekil — Belt Tension Control
// ÖLÇEK TUZAĞI: kol açısı çözüm aralığının ucuna yaklaşırken gergi sarımı
// sıfıra gider ve (4.3)'ün paydası daraldığı için gerginlik TEKİLLEŞİR —
// taramanın son noktalarında T milyarlarca newton çıkar. Eksen ham veriye
// göre ölçeklenirse grafik tamamen okunmaz olur: çalışma noktaları x ekseninin
// üstünde düz bir çizgiye yapışır, y etiketleri 9 haneli sayıya döner
// (ölçüldü). Bu yüzden y ekseni ÇALIŞMA KONUMLARININ gerginliğine göre
// sınırlanır ve eğri o sınırı aştığı yerde kesilir — Gates çıktısı da tam
// olarak böyle davranıyor (grafiği 1400 N'de bitiriyor).
function _frTensionFigure(R){
  var sw = _frArmSweep(R);
  if(!sw) return '';
  var pos = ((R.analysis && R.analysis.positions) || []).filter(function(p){ return !p.error; });
  var konumT = pos.filter(function(p){ return p.position !== 'Load'; })
                  .map(function(p){ return _frNum(p.tensionN); }).filter(Number.isFinite);
  var tasarim = _frNum(R.build && R.build.sys && R.build.sys.designTensionN);
  var taban = Math.max.apply(null, konumT.concat([Number.isFinite(tasarim) ? tasarim : 0, 1]));
  var yMax = taban * 1.6;
  // Eğriyi eksenin dışına taşan ilk noktada KES; x eksenini de oraya kadar al.
  var kesik = [], i;
  for(i = 0; i < sw.pts.length; i++){
    kesik.push(sw.pts[i]);
    if(sw.pts[i].T > yMax) break;
  }
  var xMax = kesik[kesik.length - 1].rel;
  // Konum çizgileri eksende kalmalı; en sağdaki konum kesim noktasının
  // dışındaysa ekseni ona kadar aç.
  pos.forEach(function(p){ var r = _frNum(p.relDeg); if(Number.isFinite(r) && r > xMax) xMax = r; });
  if(!(xMax > 0)) xMax = sw.relMax;
  var c = _frChart({ xMin: 0, xMax: xMax, yMin: 0, yMax: yMax,
                     xLabel: 'Gergi kol açısı — göreli [°]', yLabel: 'Kayış gerginliği [N]',
                     xDec: 1, yDec: 0, alt: 'Gerginlik kontrol eğrisi' });
  var g = c.svg;
  var icinde = kesik.filter(function(p){ return p.rel <= xMax && p.T <= yMax; });
  g += '<g data-ve="band" opacity="0.6">';
  g += _frPolyline(c, icinde.filter(function(p){ return p.T * 1.1 <= yMax; }).map(function(p){ return [p.rel, p.T * 1.1]; }), '#7f9bb5', 1.2, '4 3');
  g += _frPolyline(c, icinde.map(function(p){ return [p.rel, p.T * 0.9]; }), '#7f9bb5', 1.2, '4 3');
  g += '</g>';
  g += '<g data-ve="tension-curve">' + _frPolyline(c, icinde.map(function(p){ return [p.rel, p.T]; }), '#1b1e24', 2.4) + '</g>';

  // KONUM ÇİZGİLERİ. Tolerans ve aşınma 0 girildiğinde dört orta konum AYNI
  // açıya oturuyor; ayrı ayrı yazılsalardı etiketler üst üste binerdi
  // (ölçüldü). Aynı açıdaki konumlar tek çizgide birleştirilir.
  var TR = _frPosLabels(true);
  var kume = [];
  pos.forEach(function(p){
    var r = _frNum(p.relDeg);
    if(!Number.isFinite(r) || r < 0 || r > xMax) return;
    var k = kume.filter(function(q){ return Math.abs(q.rel - r) < 0.05; })[0];
    if(k){ k.adlar.push(TR[p.position] || p.position); if(p.position === 'Mean') k.mean = true; }
    else  kume.push({ rel: r, adlar: [TR[p.position] || p.position], mean: (p.position === 'Mean') });
  });
  g += '<g data-ve="pos-line">';
  kume.forEach(function(k, idx){
    var X = c.sx(k.rel);
    var renk = k.mean ? '#2e7d4f' : '#8a5a1e';
    g += '<line x1="' + X.toFixed(1) + '" y1="' + c.pad.t + '" x2="' + X.toFixed(1) + '" y2="' + (c.H - c.pad.b)
       + '" stroke="' + renk + '" stroke-width="' + (k.mean ? 2 : 1.3) + '" stroke-dasharray="4 3"/>';
    var sag = (X < c.W * 0.75);
    g += '<text x="' + (X + (sag ? 4 : -4)).toFixed(1) + '" y="' + (c.pad.t + 11 + (idx % 2) * 12)
       + '" text-anchor="' + (sag ? 'start' : 'end') + '" font-size="10.5" fill="' + renk + '">'
       + _frEsc(k.adlar.join(' / ')) + '</text>';
  });
  g += '</g>';
  var kesildi = (kesik.length < sw.pts.length);
  return _frFigWrap(g, 'Kayış gerginliğinin gergi kol açısına bağımlılığı (4.3). Kesikli mavi eğriler ±%10 '
    + 'bandı, düşey çizgiler kolun çalışma konumlarıdır (§8.8); yeşil olan çalışma (Mean) noktasıdır. '
    + 'Kol açısı büyüdükçe gergi sarımı küçülür ve (4.3)\'ün paydası daralarak gerginliği hızla yükseltir'
    + (kesildi ? '; eğri, çalışma konumlarının ' + _frF(1.6, 1) + ' katını aştığı yerde kesilmiştir '
              + '(tekilliğe kadar çizmek grafiği okunmaz yapardı).' : '.'));
}

// Şekil — kayma emniyeti çubukları
function _frSlipFigure(R, esik){
  var duty = (R.analysis && R.analysis.duty) || [];
  if(!duty.length) return '';
  var isim = (duty[0].slip || []).map(function(s){ return s.name; });
  if(!isim.length) return '';
  var mins = isim.map(function(n){
    var m = Infinity;
    duty.forEach(function(d){
      (d.slip || []).forEach(function(s){ if(s.name === n){ var v = _frNum(s.SF); if(v < m) m = v; } });
    });
    return m;
  });
  // YÜK TAŞIYAN ↔ TAŞIMAYAN AYRIMI GRAFİKTE DE GEÇERLİ. Kırmızı çubuk
  // "eşiğin altında kaldı" demek; ama gerginlik oranı 1,00 olan bir kasnakta
  // (avara, gergi) o sayı bir MARJ değil o sarım açısının KAPASİTESİDİR ve
  // tasarım gerginliğini yükseltmek onu değiştirmez. Ayrım yapılmayınca
  // grafik, aynı sayfadaki hükmün TERSİNİ söylüyordu (ölçüldü: AG00976'da
  // üç kasnak kırmızı, oysa hükmü veren 4,51 ile FAN).
  var esk = (typeof VE_FR_SLIP_LOADED_RATIO === 'number') ? VE_FR_SLIP_LOADED_RATIO : 1.01;
  var yukTasir = isim.map(function(n){
    var t = false;
    duty.forEach(function(d){
      (d.slip || []).forEach(function(x){
        if(x.name === n && _frNum(x.tensionRatio) >= esk) t = true;
      });
    });
    return t;
  });
  // Etiket KISA KOD: tam ad sol payı 190 px'e zorluyor ve çubuklara yer
  // bırakmıyor. Kod → ad künyesi belgede aynı sayfada duruyor.
  var kodF = (typeof veFeadPulleyCodes === 'function' && R.build && R.build.sys)
    ? veFeadPulleyCodes(R.build.sys) : null;
  var ps = (R.build && R.build.sys && R.build.sys.pulleys) || [];
  var etAd = isim.map(function(n){
    if(!kodF) return n;
    for(var i = 0; i < ps.length; i++) if(ps[i].name === n) return kodF[i];
    return n;
  });
  var maxV = Math.max.apply(null, mins.concat([Number.isFinite(esik) ? esik * 1.4 : 2]));
  // Boy çubuk SAYISINDAN türüyor (sabit bir H anlamsız olurdu); RAW kipte
  // satır aralığı daralıyor — özet raporda şekil küçük basılıyor.
  var W = _FR_W, satir = (_FR_RAW ? 19 : 30), H = 26 + isim.length * satir + 30;
  // SAĞ PAY DEĞER ETİKETİNİ SIĞDIRMAK ZORUNDA. Sabit 30 px, "14,95" gibi beş
  // karakterlik bir etiketi kesiyordu — ÖLÇÜLDÜ (özet rapor, sayfa 5):
  // yazı viewBox'ı 10 px aşıyor ve kırpılıyordu. Pay artık en uzun etiketin
  // ölçülen genişliğinden türüyor (_frTxtW, eş aralıklı 0,6 em).
  var enSol = 0;
  etAd.forEach(function(t){ enSol = Math.max(enSol, _frTxtW(t, 12)); });
  var L = Math.min(190, Math.ceil(enSol) + 16);
  var enGenis = 0;
  mins.forEach(function(v){ enGenis = Math.max(enGenis, _frTxtW(_frFs(v, 2), 11.5)); });
  var R2 = Math.max(30, Math.ceil(enGenis) + 10);
  // ALT ŞERİT KUTUYA SIĞMAK ZORUNDA. Uzun hâli 780 birimlik kutuda sığıyor,
  // 390 birimlik (yarım sütun) kutuda viewBox'ı 209 px aşıyordu — ÖLÇÜLDÜ.
  // Sığmayan ikinci cümle DÜŞER; aynı bilgi bloğun kendi notunda zaten var.
  var uzunAlt = 'çubuk boyu = SF · SF = 1 kayma eşiği · soluk çubuk = yük taşımayan kasnak (kapasite)';
  var kisaAlt = 'çubuk boyu = SF · SF = 1 kayma eşiği';
  var altYazi = (L + _frTxtW(uzunAlt, 11) <= W - 4) ? uzunAlt : kisaAlt;
  var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Kayma emniyet faktörü">';
  isim.forEach(function(n, i){
    var y = 24 + i * satir;
    var w = (mins[i] / maxV) * (W - L - R2);
    var kotu = yukTasir[i] && Number.isFinite(esik) && mins[i] < esik;
    var dolgu = kotu ? '#a8321f' : (yukTasir[i] ? '#24425f' : '#9aa3ad');
    g += '<text x="' + (L - 8) + '" y="' + (y + 13) + '" text-anchor="end" font-size="12" fill="'
       + (yukTasir[i] ? '#1b1e24' : '#5a6270') + '">' + _frEsc(etAd[i]) + '</text>';
    g += '<rect data-ve="sf-bar" x="' + L + '" y="' + y + '" width="' + Math.max(1, w).toFixed(1) + '" height="18" '
       + 'fill="' + dolgu + '" opacity="' + (yukTasir[i] ? '0.82' : '0.55') + '"/>';
    var etX = Math.min(L + w + 6, W - R2 + 4);
    g += '<text x="' + etX.toFixed(1) + '" y="' + (y + 13) + '" font-size="11.5" fill="#1b1e24">' + _frFs(mins[i], 2) + '</text>';
  });
  if(Number.isFinite(esik) && esik > 0){
    var X = L + (esik / maxV) * (W - L - R2);
    g += '<line data-ve="sf-limit" x1="' + X.toFixed(1) + '" y1="14" x2="' + X.toFixed(1) + '" y2="' + (24 + isim.length * satir)
       + '" stroke="#a8321f" stroke-width="1.8" stroke-dasharray="5 4"/>';
    // Etiket ÇİZGİNİN ÜSTÜNDE: alt şeride yazılınca "SF = 1 kayma eşiği"
    // yazısıyla üst üste biniyordu (ölçüldü).
    g += '<text x="' + (X + 4).toFixed(1) + '" y="12" font-size="11" fill="#a8321f">servis faktörü '
       + _frF(esik, 2) + '</text>';
  }
  g += '<text x="' + L + '" y="' + (H - 12) + '" font-size="11" fill="#5a6270">' + _frEsc(altYazi) + '</text>';
  return _frFigWrap(g, 'Kasnak başına EN DÜŞÜK kayma emniyet faktörü (tüm devir noktaları üzerinden). '
    + 'Kesikli kırmızı çizgi istenen servis faktörüdür; altında kalan çubuk kırmızı basılır.');
}

// Şekil — yorulma payı çubukları
function _frFatigueFigure(R){
  var f = R.fatigue;
  if(!f || !f.perPulley || !f.perPulley.length) return '';
  var W = _FR_W, satir = 28, H = 24 + f.perPulley.length * satir + 26, L = 190, R2 = 60;
  var maxV = Math.max.apply(null, f.perPulley.map(function(p){ return _frNum(p.sharePct) || 0; })) || 1;
  var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Kaburga yorulma dağılımı">';
  f.perPulley.forEach(function(p, i){
    var y = 18 + i * satir;
    var v = _frNum(p.sharePct) || 0;
    var w = (v / maxV) * (W - L - R2);
    g += '<text x="' + (L - 8) + '" y="' + (y + 13) + '" text-anchor="end" font-size="12" fill="#1b1e24">' + _frEsc(p.name) + '</text>';
    g += '<rect data-ve="fatigue-bar" x="' + L + '" y="' + y + '" width="' + Math.max(1, w).toFixed(1) + '" height="17" '
       + 'fill="' + (p.contact === 'back' ? '#8a5a1e' : '#24425f') + '" opacity="0.82"/>';
    g += '<text x="' + (L + w + 6).toFixed(1) + '" y="' + (y + 13) + '" font-size="11.5" fill="#1b1e24">'
       + _frFs(v, 1) + '%</text>';
  });
  g += '<text x="' + L + '" y="' + (H - 8) + '" font-size="11" fill="#5a6270">lacivert: kaburgalı temas · kahve: sırt teması</text>';
  return _frFigWrap(g, 'Kasnakların kayış kaburga yorulmasına katkı payı (6.2). Küçük çaplı kasnaklar kayışı '
    + 'daha sert bükdüğü için payları büyüktür; sırttan temas eden kasnaklar kaburgaları ters yöne açar.');
}

// Şekil — açıklık doğal frekans haritası
function _frFreqFigure(R){
  var duty = (R.analysis && R.analysis.duty) || [];
  if(duty.length < 2 || !duty[0].frequencies) return '';
  var spans = duty[0].frequencies.map(function(s){ return s.span; });
  var rpmLo = _frNum(duty[0].engineRpm), rpmHi = _frNum(duty[duty.length - 1].engineRpm);
  var tumF = [];
  duty.forEach(function(d){
    (d.frequencies || []).forEach(function(s){ if(s.fHz && s.fHz.length) tumF.push(s.fHz[0]); });
    if(Number.isFinite(_frNum(d.firingHz))) tumF.push(_frNum(d.firingHz));
  });
  if(!tumF.length) return '';
  var yMax = Math.max.apply(null, tumF) * 1.1;
  // AÇIKLIK ADI KISALTILIR. Ham ad "Sürücü Kasnak (FAN)->Avara 1" = 28 karakter;
  // yedi girdilik bir gösterge o adlarla 262 px'e çıkıyor ve grafiği yiyordu.
  // Kısa kod köprü katmanının kendi kuralı (veFeadPulleyCodes); burada yoksa
  // ham ada düşülür — grafik yine çizilir, yalnız gösterge genişler.
  var kod = (typeof veFeadPulleyCodes === 'function' && R.build && R.build.sys)
    ? veFeadPulleyCodes(R.build.sys) : null;
  var adlar = (R.build && R.build.sys && R.build.sys.pulleys) || [];
  function kisaSpan(sp){
    var t = String(sp);
    if(kod) adlar.forEach(function(p, i){ t = t.split(p.name).join(kod[i]); });
    return t.replace(/\s*->\s*/g, ' → ');
  }
  var etiket = spans.map(kisaSpan).concat(['ateşleme frekansı']);
  var gW = 0;
  etiket.forEach(function(t){ gW = Math.max(gW, _frTxtW(t, 9.5)); });
  var padR = Math.ceil(gW) + 34;                      // çizgi örneği + boşluk
  var c = _frChart({ xMin: rpmLo, xMax: rpmHi, yMin: 0, yMax: yMax, padR: padR,
                     xLabel: 'Motor devri [d/d]', yLabel: 'Frekans [Hz]', xDec: 0, yDec: 0,
                     // RAW kipte (özet rapor) istenen boy geçerli: orada şekil
                     // küçük basılıyor. Sabit 300 yazmak _FR_H'yi sessizce
                     // yutuyordu — özet raporda sayfa taşıyordu (ölçüldü).
                     H: (_FR_RAW ? _FR_H : 300), alt: 'Doğal frekans haritası' });
  var g = c.svg;
  var renk = ['#24425f', '#8a5a1e', '#2e7d4f', '#a8321f', '#5a6270', '#7a4fa8'];
  spans.forEach(function(sp, si){
    var pts = [];
    duty.forEach(function(d){
      var s = (d.frequencies || [])[si];
      if(s && s.fHz && s.fHz.length) pts.push([_frNum(d.engineRpm), s.fHz[0]]);
    });
    g += '<g data-ve="span-freq">' + _frPolyline(c, pts, renk[si % renk.length], 1.8) + '</g>';
  });
  var fire = duty.map(function(d){ return [_frNum(d.engineRpm), _frNum(d.firingHz)]; })
                 .filter(function(p){ return Number.isFinite(p[1]); });
  g += '<g data-ve="firing-line">' + _frPolyline(c, fire, '#a8321f', 2.2, '6 4') + '</g>';
  // GÖSTERGE ÇİZİM ALANININ DIŞINDA — sağ payda, dikey liste.
  var lx = c.W - c.pad.r + 6, ly = c.pad.t + 10;
  var adim = Math.min(13, (c.H - c.pad.t - c.pad.b) / (spans.length + 1));
  spans.forEach(function(sp, si){
    var y = ly + si * adim;
    g += '<line x1="' + lx + '" y1="' + (y - 4).toFixed(1) + '" x2="' + (lx + 16) + '" y2="' + (y - 4).toFixed(1)
       + '" stroke="' + renk[si % renk.length] + '" stroke-width="2"/>';
    g += '<text x="' + (lx + 21) + '" y="' + y.toFixed(1) + '" font-size="9.5" fill="#5a6270">'
       + _frEsc(etiket[si]) + '</text>';
  });
  var yf = ly + spans.length * adim;
  g += '<line x1="' + lx + '" y1="' + (yf - 4).toFixed(1) + '" x2="' + (lx + 16) + '" y2="' + (yf - 4).toFixed(1)
     + '" stroke="#a8321f" stroke-width="2" stroke-dasharray="6 4"/>';
  g += '<text x="' + (lx + 21) + '" y="' + yf.toFixed(1) + '" font-size="9.5" fill="#a8321f">ateşleme frekansı</text>';
  return _frFigWrap(g, 'Açıklıkların temel enine titreşim frekansı ve motorun ateşleme frekansı (7.2)–(7.3). '
    + 'İki eğri kesişirse o devirde ilgili açıklık rezonansa girer. Bu grafik yalnız AÇIKLIK '
    + 'titreşimini gösterir; sistem burulma modları 8.18\'de ayrı tablodadır.');
}

// ═══════════════════ UYGUNLUK HÜKMÜ ════════════════════════════════════════
// Rapor bir sonuç listesi değil, bir HÜKÜM belgesidir: her kriter için hedef,
// bulgu ve karar aynı satırda durur. "bekliyor" hâli, veri olmadığı için
// değerlendirilemeyen kriteri gizlemek yerine AÇIKÇA yazar.
function _frCompliance(R){
  var C = _frCore(), sys = R.build && R.build.sys, A = R.analysis || {};
  var bp = null;
  try { bp = (C && C.beltProps && sys) ? C.beltProps(sys.belt) : null; } catch(e){}
  var satirlar = [];
  function ekle(kriter, hedef, bulgu, durum){ satirlar.push([kriter, hedef, bulgu, durum]); }
  function rozet(d){
    if(d === 'ok')   return '<span class="ok">✓ Uygun</span>';
    if(d === 'wait') return '<span style="color:#5a6270;">— değerlendirilemedi</span>';
    return '<b style="color:#a8321f;">✗ Kontrol</b>';
  }

  // 1 — kapalı çevrim
  var sig = _frSignedWrap(R);
  ekle('Kapalı çevrim değişmezi', '|Σ işaretli sarım| = 360° ± 0,05',
       _frFs(sig, 2) + '°',
       Number.isFinite(sig) ? (Math.abs(Math.abs(sig) - 360) <= 0.05 ? 'ok' : 'no') : 'wait');

  // 2 — kayma emniyeti
  var minSF = _frMinSF(R), sf = _frNum(R.serviceFact);
  // Kriter YÜK TAŞIYAN kasnakların en düşüğüne dayanır (_frMinSF). Global en
  // düşük alınsaydı, yük çekmeyen bir avaranın capstan KAPASİTESİ bir MARJ gibi
  // okunur ve "tasarım onaylanmamalıdır" hükmü, kayması fiziksel olarak mümkün
  // olmayan bir kasnaktan gelirdi (§8.12'de ölçümüyle yazılı).
  var slipSt = _frSlipStats(R);
  ekle('Kayma emniyeti — yük taşıyan kasnaklarda en düşük',
       (Number.isFinite(sf) && sf > 0) ? ('SF ≥ ' + _frF(sf, 2)) : 'SF > 1',
       Number.isFinite(minSF)
         ? (_frFs(minSF, 2) + (slipSt.anyLoaded && slipSt.loadedName
              ? ' (' + _frEsc(slipSt.loadedName) + ')' : ''))
         : '—',
       !Number.isFinite(minSF) ? 'wait'
         : ((Number.isFinite(sf) && sf > 0) ? (minSF >= sf ? 'ok' : 'no') : (minSF > 1 ? 'ok' : 'no')));

  // 3 — en küçük kasnak çapı
  if(sys && bp && Number.isFinite(_frNum(bp.minPulleyDia))){
    var enKucuk = Infinity, adi = '';
    sys.pulleys.forEach(function(p){ var d = _frNum(p.od); if(d < enKucuk){ enKucuk = d; adi = p.name; } });
    ekle('En küçük kasnak çapı', '≥ ' + _frF(bp.minPulleyDia, 0) + ' mm (profil sınırı)',
         _frF(enKucuk, 1) + ' mm (' + _frEsc(adi) + ')',
         enKucuk >= _frNum(bp.minPulleyDia) ? 'ok' : 'no');
  } else ekle('En küçük kasnak çapı', 'profil sınırı', '—', 'wait');

  // 4 — kayış hızı
  var vMax = 0;
  ((A.duty) || []).forEach(function(d){ var v = _frNum(d.vMs); if(v > vMax) vMax = v; });
  if(bp && Number.isFinite(_frNum(bp.maxSpeedMs)) && vMax > 0)
    ekle('Azami kayış hızı', '≤ ' + _frF(bp.maxSpeedMs, 0) + ' m/s',
         _frFs(vMax, 1) + ' m/s', vMax <= _frNum(bp.maxSpeedMs) ? 'ok' : 'no');
  else ekle('Azami kayış hızı', 'profil sınırı', '—', 'wait');

  // 5 — gergi çalışma aralığı
  var rel = _frNum(A.meanRelDeg), relMax = NaN;
  try { if(C && C.feasibleRelMax && sys) relMax = C.feasibleRelMax(sys); } catch(e){}
  ekle('Gergi kolu çalışma aralığı',
       Number.isFinite(relMax) ? ('0° ≤ θ ≤ ' + _frF(relMax, 1) + '°') : 'çözüm aralığı içinde',
       Number.isFinite(rel) ? (_frFs(rel, 1) + '°') : '—',
       (Number.isFinite(rel) && Number.isFinite(relMax)) ? ((rel >= 0 && rel <= relMax) ? 'ok' : 'no') : 'wait');

  // 6 — ankraj türetilebildi mi
  //
  // ESKİDEN "tasarım gerginliği ↔ yay dengesi, sapma ≤ %2" yazıyordu ve bu bir
  // TOTOLOJİYDİ: tasarım gerginliği artık kullanıcıdan alınmıyor, yay
  // dengesinin ta kendisi oluyor (§8.7), dolayısıyla sapma yapısal olarak
  // sıfır. Geçen bir kriter gibi görünüp hiçbir şey denetlemiyordu. Gerçekten
  // denetlenebilen şey TÜRETMENİN BAŞARILI OLUP OLMADIĞI: kayış boyu gergi
  // kolunun erişemeyeceği kadar kısa/uzunsa meanRel çözülemez, ankraj YOKTUR
  // ve köprü bunu uyarı olarak taşır.
  var uy = ((R.build && R.build.warnings) || []).filter(function(w){ return /gerginli/i.test(w); });
  var ankraj = _frNum(R.build && R.build.sys && R.build.sys.designTensionN);
  ekle('Tasarım gerginliği ankrajı (§8.7)', 'yay dengesinden türetilebilmeli',
       uy.length ? _frEsc(uy[0])
                 : (Number.isFinite(ankraj) && ankraj > 0
                     ? ('türetildi: ' + _frF(ankraj, 0) + ' N')
                     : 'türetilemedi'),
       uy.length ? 'no' : ((Number.isFinite(ankraj) && ankraj > 0) ? 'ok' : 'no'));

  // 7 — kol boyu ↔ montaj merkezi
  var m = R.build && R.build.mount;
  if(m && m.ok && Number.isFinite(_frNum(m.armFromCoords)) && sys && sys.tensioner){
    var fark = Math.abs(_frNum(m.armFromCoords) - _frNum(sys.tensioner.armLength));
    ekle('Kol boyu ↔ montaj merkezi tutarlılığı', '|fark| ≤ 0,5 mm',
         _frFs(fark, 3) + ' mm', fark <= 0.5 ? 'ok' : 'no');
  } else ekle('Kol boyu ↔ montaj merkezi tutarlılığı', '|fark| ≤ 0,5 mm', 'montaj merkezi girilmedi', 'wait');

  // 8 — span gerginliği pozitif
  var negatif = false;
  ((A.duty) || []).forEach(function(d){
    (d.perPulley || []).forEach(function(q){ if(_frNum(q.exitTensionN) <= 0) negatif = true; });
  });
  ekle('Açıklık gerginliği', 'her açıklıkta T > 0',
       negatif ? 'negatif/sıfır gerginlik var' : 'tüm açıklıklarda pozitif', negatif ? 'no' : 'ok');

  // 9 — B10 geçerlilik penceresi
  var L = R.life;
  if(L) ekle('B10 çap geçerlilik penceresi', 'tüm çaplar kalibrasyon aralığında',
             L.inValidRange ? 'aralık içinde' : ('aralık dışında: ' + _frEsc((L.outOfRange || []).join(', '))),
             L.inValidRange ? 'ok' : 'no');
  else ekle('B10 çap geçerlilik penceresi', 'kalibrasyon aralığı', '—', 'wait');

  // 10 — çalışma çevrimi kapsamı
  var dc = _frDutySum(R);
  ekle('Çalışma çevrimi kapsamı', 'Σ süre payı ≈ %100',
       _frPct(dc, 1), (dc >= 95 && dc <= 105) ? 'ok' : (dc > 0 ? 'no' : 'wait'));

  var nOK = satirlar.filter(function(s){ return s[3] === 'ok'; }).length;
  var nNo = satirlar.filter(function(s){ return s[3] === 'no'; }).length;
  var nW  = satirlar.filter(function(s){ return s[3] === 'wait'; }).length;

  var h = _frH2(1);
  h += '<p>Aşağıdaki kriterler, bu modelin çözümünden doğrudan okunur. "Değerlendirilemedi" satırları '
     + 'eksik girdiyi işaret eder ve <b>uygunluk sayılmaz</b>.</p>';
  h += '<table><caption>Tablo ' + _frTbl() + ' — FEAD sistem uygunluk hükmü</caption>';
  h += '<tr><th>#</th><th>Kriter</th><th>Hedef</th><th>Bulgu</th><th>Sonuç</th></tr>';
  satirlar.forEach(function(s, i){
    h += '<tr><td class="c">' + (i + 1) + '</td><td class="l">' + s[0] + '</td>'
      + '<td class="l">' + s[1] + '</td><td class="l">' + s[2] + '</td>'
      + '<td class="c">' + rozet(s[3]) + '</td></tr>';
  });
  h += '</table>';
  h += '<div class="note ' + (nNo === 0 ? 'check' : 'warn') + '"><span class="t">Genel hüküm</span>'
     + nOK + ' kriter uygun · ' + nNo + ' kriter kontrol istiyor · ' + nW + ' kriter değerlendirilemedi. '
     + (nNo === 0
        ? 'Modelde kapıya takılan bir bulgu yok; Bölüm 9\'daki geçerlilik sınırları geçerlidir.'
        : 'Kontrol isteyen kriterler giderilmeden tasarım onaylanmamalıdır.')
     + '</div>';
  if((R.limits || []).length){
    h += '<div class="note"><span class="t">Çekirdeğin bildirdiği sınırlar</span><ul style="margin:4px 0 0 18px;">';
    (R.limits || []).forEach(function(x){ h += '<li>' + _frEsc(x) + '</li>'; });
    h += '</ul></div>';
  }
  return h;
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    getFeadReportPropertiesHTML: getFeadReportPropertiesHTML,
    veFeadReportKind: veFeadReportKind,
    veFeadFigureRaw: veFeadFigureRaw,
    _frTakeupChartRaw: _frTakeupChartRaw,
    _frTensionFigure: _frTensionFigure, _frFreqFigure: _frFreqFigure,
    _frTakeupFigure: _frTakeupFigure, _frSlipFigure: _frSlipFigure,
    _frArmSweep: _frArmSweep,
    VE_FEAD_REPORT_KINDS: VE_FEAD_REPORT_KINDS,
    _frKindPicker: _frKindPicker,
    veFeadGenerateReport: veFeadGenerateReport,
    _frBuildReportHTML: _frBuildReportHTML,
    _frSection8: _frSection8,
    _frCompliance: _frCompliance,
    _frAntet: _frAntet,
    _frEnsureAssets: _frEnsureAssets,
    _frConceptFigure: _frConceptFigure,
    _frOperatingPoint: _frOperatingPoint,
    _frGeometryTable: _frGeometryTable,
    _frTakeupFigure: _frTakeupFigure,
    _frWrapRows: _frWrapRows,
    _frTenConstruct: _frTenConstruct,
    _frWrapFigure: _frWrapFigure,
    _frWrapAngleTable: _frWrapAngleTable,
    _frBetaFigure: _frBetaFigure,
    _frLabels: _frLabels,
    _frTakeupRateFigure: _frTakeupRateFigure,
    _frDesignTensionBlock: _frDesignTensionBlock,
    _frPivotBlock: _frPivotBlock,
    _frF: _frF, _frFs: _frFs, _frPct: _frPct, _frEsc: _frEsc, _frNum: _frNum,
    _frSlipStats: _frSlipStats,
    _frNiceStep: _frNiceStep, _frNiceAxis: _frNiceAxis,
    VE_FR_SLIP_LOADED_RATIO: VE_FR_SLIP_LOADED_RATIO,
    VE_FEAD_REP_SECTIONS: VE_FEAD_REP_SECTIONS
  };
}
