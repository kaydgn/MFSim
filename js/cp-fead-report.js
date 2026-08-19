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
var _frTblNo = 0, _frFigNo = 0;
function _frTbl(){ return ++_frTblNo; }
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
function getFeadReportPropertiesHTML(node){
  if(!node.data) node.data = {};
  var R = _frResults();
  var solved = !!(R && R.ok);
  var html = '<div class="sw-panel">';
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-primary);">'
        + '<b style="color:var(--text-heading);">Rapor — FEAD kayış-kasnak.</b> '
        + 'Çözücü sonuçlarını akademik bir <b>HTML rapora</b> döker: teori (§1–7) + bu modelin '
        + 'geometrisi, gerginlikleri, kayma emniyeti ve kaburga yorulması. '
        + 'Dosya <b>tamamen çevrimdışı</b>; matematik ve fontlar gömülüdür — her yerde açılır, yazdırılabilir.</div>';

  if(solved){
    var nP = (R.pulleyNames || []).length;
    var nD = (R.duty || []).length;
    html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); background:var(--bg-tertiary); border:1px solid var(--border-color); color:var(--text-primary);">'
          + '<span style="color:var(--accent-success); font-weight:700;">✓ Model çözüldü</span> — '
          + nP + ' kasnak · ' + nD + ' devir noktası. Rapor güncel çözüme göre üretilir.</div>';
    html += _frDocFields(node);
    html += '<button onclick="veFeadGenerateReport(\'' + node.id + '\')" style="width:100%; padding:13px 16px; font-size:var(--fs-lg); font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.02em; border-radius:var(--radius-sm);" onmouseover="this.style.filter=\'brightness(1.12)\'" onmouseout="this.style.filter=\'none\'">📄 Raporu Oluştur ve İndir</button>';
  } else {
    html += '<div style="padding:10px 12px; margin-bottom:10px; background:rgba(245,158,11,0.12); border:1px solid var(--accent-warning); color:var(--accent-warning); font-size:var(--fs-body); line-height:1.5;">'
          + '<b>Önce çözün.</b> Rapor, <b>Çözücü</b> bileşenindeki <b>▶ Çöz</b> ile üretilen sonuçları kullanır. '
          + 'Çözücüyü çalıştırdıktan sonra buraya dönün.</div>';
    html += '<button disabled style="width:100%; padding:13px 16px; font-size:var(--fs-lg); font-weight:700; background:var(--bg-tertiary); color:var(--text-muted); border:1px solid var(--border-color); cursor:not-allowed; border-radius:var(--radius-sm);">📄 Raporu Oluştur ve İndir</button>';
  }
  html += '<div id="ve-fead-report-status" style="margin-top:8px; font-size:var(--fs-tiny); color:var(--text-muted);"></div>';
  html += '</div>';
  return html;
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
      html = _frBuildReportHTML(R, node);
    } catch(e){
      _frStatus('Rapor üretilemedi: ' + (e && e.message ? e.message : e), 'var(--accent-danger)');
      if(typeof showToast === 'function') showToast('Rapor üretilemedi.', 'error');
      return;
    }
    var ad = 'MFSim_FEAD_Raporu';
    if(node && node.data && node.data.docNo) ad = String(node.data.docNo).replace(/[^\w.-]+/g, '_');
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
            + (b.effLength ? ' · ' + _frF(b.effLength, 0) + ' mm' : '');
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
  h += '<div class="f"><div class="k">Sistem</div><div class="v">' + nP + ' kasnak · ' + _frF(Leff, 1) + ' mm</div></div>';
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
  _frTblNo = 0; _frFigNo = 1;
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
  h += sat('Kayış efektif boyu', _frFs(A.driveLenMm, 1) + ' mm · gereken ' + _frFs(A.requiredBeltMm, 1) + ' mm');
  h += sat('Gergi çalışma noktası', 'kol ' + _frFs(A.meanRelDeg, 1) + '° (göreli) · '
        + _frFs(A.meanAbsDeg, 1) + '° (mutlak) · gerginlik <b>' + _frF(A.tensioner && A.tensioner.tensionN, 0) + ' N</b>');
  h += sat('En düşük kayma emniyeti', Number.isFinite(minSF)
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
function _frMinSF(R){
  var m = Infinity;
  ((R.analysis && R.analysis.duty) || []).forEach(function(d){
    (d.slip || []).forEach(function(s){ var v = _frNum(s.SF); if(Number.isFinite(v) && v < m) m = v; });
  });
  return Number.isFinite(m) ? m : NaN;
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
  sys.pulleys.forEach(function(p, i){
    var rol = p.crank ? 'sürücü' : (p.tensioner ? 'gergi' : (_frNum(p.inertiaKgM2) >= 0 ? 'aksesuar/avara' : '—'));
    h += '<tr><td class="c">' + (i + 1) + '</td><td class="l">' + _frEsc(p.name) + '</td>'
      + '<td>' + _frFs(p.x, 2) + '</td><td>' + _frFs(p.y, 2) + '</td>'
      + '<td>' + _frFs(p.od, 1) + '</td><td>' + _frFs(_frNum(p.rPitch) * 2, 1) + '</td>'
      + '<td>' + _frFs(_frNum(p.rEff) * 2, 1) + '</td>'
      + '<td class="c">' + (p.contact === 'back' ? 'sırt' : 'kaburgalı') + '</td>'
      + '<td class="c">' + rol + '</td>'
      + '<td>' + (Number.isFinite(_frNum(p.inertiaKgM2)) ? _frFs(p.inertiaKgM2, 4) : '—') + '</td></tr>';
  });
  h += '</table>';
  h += '<p style="font-size:13px;color:#5a6270;">Pitch ve efektif çaplar dış çaptan (3.1) ile türetilir; '
     + 'gergi kasnağının X/Y değeri çalışma konumundan (§8.7) gelir, bir girdi değildir.</p>';
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
  return h + h1;
}
function _frSumArcPitch(g, sys){
  var t = 0;
  g.forEach(function(row, i){
    var p = sys && sys.pulleys[i];
    if(p) t += (_frNum(row.wrapDeg) * Math.PI / 180) * _frNum(p.rPitch);
  });
  return t;
}

// 8.7 — gergi çalışma noktası + gerginlik kontrol grafiği
function _frOperatingPoint(R){
  var A = R.analysis || {}, T = A.tensioner || {};
  var h = '<h3>8.7 Gergi çalışma noktası</h3>';
  h += '<p>Kol açısı, "gereken kayış boyu = kayışın efektif boyu" koşulundan (4.4) çözülür. Bulunan açıda '
     + 'yay momenti ve take-up oranı, kayış gerginliğini (4.3) ile verir:</p>';
  h += '<div class="eqno">$$ T = \\frac{M(\\theta)}{\\mathrm{d}L/\\mathrm{d}\\theta} = \\frac{'
     + _frFs(T.springNm, 2) + '\\ \\text{Nm}}{' + _frFs(T.takeupMmPerDeg, 4)
     + '\\ \\text{mm/}^\\circ} \\cdot \\frac{180}{\\pi}\\cdot\\frac{1}{1000} = '
     + _frF(T.tensionN, 0) + '\\ \\text{N} $$</div>';
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
  h += _frTensionFigure(R);
  return h;
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
  var enKotu = { SF: Infinity };
  duty.forEach(function(d){
    (d.slip || []).forEach(function(s){
      var v = _frNum(s.SF);
      if(Number.isFinite(v) && v < enKotu.SF) enKotu = { SF: v, name: s.name, rpm: d.engineRpm };
    });
  });
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
  if(Number.isFinite(enKotu.SF)){
    var ok = !Number.isFinite(esik) || enKotu.SF >= esik;
    h += '<div class="note ' + (ok ? 'check' : 'warn') + '"><span class="t">En kritik nokta</span>'
       + '<b>' + _frEsc(enKotu.name) + '</b> kasnağı, ' + _frF(enKotu.rpm, 0) + ' d/d — SF = <b>'
       + _frFs(enKotu.SF, 2) + '</b>. '
       + (ok ? 'Servis faktörünün üstünde.' : 'Servis faktörünün ALTINDA: sarım açısını artırın ya da tasarım gerginliğini yükseltin.')
       + '</div>';
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
  h += '<table><caption>Tablo ' + _frTbl() + ' — Aksesuar ortalama mil torku [Nm]</caption>';
  h += '<tr><th>Motor devri</th>';
  var yukler = ((duty[0] && duty[0].perPulley) || []).filter(function(q){ return _frNum(q.powerKw) > 0; });
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
function _frChart(opt){
  var pad = { l: 62, r: 18, t: 16, b: 42 };
  var W = opt.W || _FR_W, H = opt.H || _FR_H;
  var x0 = opt.xMin, x1 = opt.xMax, y0 = opt.yMin, y1 = opt.yMax;
  if(!(x1 > x0)) x1 = x0 + 1;
  if(!(y1 > y0)) y1 = y0 + 1;
  var sx = function(v){ return pad.l + (v - x0) / (x1 - x0) * (W - pad.l - pad.r); };
  var sy = function(v){ return H - pad.b - (v - y0) / (y1 - y0) * (H - pad.t - pad.b); };
  var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + _frEsc(opt.alt || '') + '">';
  // ızgara + eksen
  var nX = 5, nY = 4, i;
  for(i = 0; i <= nX; i++){
    var xv = x0 + (x1 - x0) * i / nX, X = sx(xv);
    g += '<line x1="' + X.toFixed(1) + '" y1="' + pad.t + '" x2="' + X.toFixed(1) + '" y2="' + (H - pad.b)
       + '" stroke="#e4e6e9" stroke-width="1"/>';
    g += '<text x="' + X.toFixed(1) + '" y="' + (H - pad.b + 15) + '" text-anchor="middle" font-size="11" fill="#5a6270">'
       + _frF(xv, opt.xDec == null ? 0 : opt.xDec) + '</text>';
  }
  for(i = 0; i <= nY; i++){
    var yv = y0 + (y1 - y0) * i / nY, Y = sy(yv);
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
  return '<figure>' + svg + '</svg><figcaption><b>Şekil ' + _frFig() + ' —</b> ' + caption + '</figcaption></figure>';
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
        pts.push({ rel: rel, abs: st.absDeg, T: st.tensionN, L: st.driveLenMm, tk: st.takeupMmPerDeg });
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
  var konumT = pos.map(function(p){ return _frNum(p.tensionN); }).filter(Number.isFinite);
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

// Şekil — Belt Take-up
function _frTakeupFigure(R){
  var sw = _frArmSweep(R);
  if(!sw) return '';
  var Ls = sw.pts.map(function(p){ return p.L; });
  var lo = Math.min.apply(null, Ls), hi = Math.max.apply(null, Ls);
  var pad = (hi - lo) * 0.08 || 1;
  var c = _frChart({ xMin: 0, xMax: sw.relMax, yMin: lo - pad, yMax: hi + pad,
                     xLabel: 'Gergi kol açısı — göreli [°]', yLabel: 'Tahrik boyu [mm]',
                     xDec: 0, yDec: 1, H: 260, alt: 'Kayış take-up eğrisi' });
  var g = c.svg;
  g += '<g data-ve="takeup-curve">' + _frPolyline(c, sw.pts.map(function(p){ return [p.rel, p.L]; }), '#24425f', 2.4) + '</g>';
  var t0 = sw.pts[0], t1 = sw.pts[sw.pts.length - 1];
  var ort = (t1.L - t0.L) / (t1.rel - t0.rel);
  return '<h3>8.9 Kayış take-up</h3>'
    + '<p>Kol açısı arttıkça gergi kasnağı kayışı içeri alır ve gereken tahrik boyu azalır. Eğrinin eğimi '
    + '<b>take-up oranıdır</b> (mm/°); ortalama eğim bu modelde <b>' + _frFs(Math.abs(ort), 4) + ' mm/°</b>. '
    + 'Küçük take-up oranı, kayış boyundaki küçük bir değişimin gerginliği çok değiştirmesi demektir.</p>'
    + _frFigWrap(g, 'Gereken tahrik boyunun kol açısıyla değişimi. Kayışın tolerans ve aşınma payı bu eğri '
      + 'üzerinde bir aralığa karşılık gelir; kol o aralıkta gezer (§4.4).');
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
  var maxV = Math.max.apply(null, mins.concat([Number.isFinite(esik) ? esik * 1.4 : 2]));
  var W = _FR_W, satir = 30, H = 34 + isim.length * satir + 34;
  var L = 190, R2 = 30;
  var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Kayma emniyet faktörü">';
  isim.forEach(function(n, i){
    var y = 24 + i * satir;
    var w = (mins[i] / maxV) * (W - L - R2);
    var kotu = Number.isFinite(esik) && mins[i] < esik;
    g += '<text x="' + (L - 8) + '" y="' + (y + 13) + '" text-anchor="end" font-size="12" fill="#1b1e24">' + _frEsc(n) + '</text>';
    g += '<rect data-ve="sf-bar" x="' + L + '" y="' + y + '" width="' + Math.max(1, w).toFixed(1) + '" height="18" '
       + 'fill="' + (kotu ? '#a8321f' : '#24425f') + '" opacity="0.82"/>';
    g += '<text x="' + (L + w + 6).toFixed(1) + '" y="' + (y + 13) + '" font-size="11.5" fill="#1b1e24">' + _frFs(mins[i], 2) + '</text>';
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
  g += '<text x="' + L + '" y="' + (H - 12) + '" font-size="11" fill="#5a6270">çubuk boyu = SF · SF = 1 kayma eşiği</text>';
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
  var c = _frChart({ xMin: rpmLo, xMax: rpmHi, yMin: 0, yMax: yMax,
                     xLabel: 'Motor devri [d/d]', yLabel: 'Frekans [Hz]', xDec: 0, yDec: 0,
                     H: 300, alt: 'Doğal frekans haritası' });
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
  // gösterge
  var lx = c.pad.l + 8, ly = c.pad.t + 12;
  spans.forEach(function(sp, si){
    g += '<line x1="' + lx + '" y1="' + (ly + si * 13 - 4) + '" x2="' + (lx + 16) + '" y2="' + (ly + si * 13 - 4)
       + '" stroke="' + renk[si % renk.length] + '" stroke-width="2"/>';
    g += '<text x="' + (lx + 21) + '" y="' + (ly + si * 13) + '" font-size="9.5" fill="#5a6270">' + _frEsc(sp) + '</text>';
  });
  g += '<line x1="' + lx + '" y1="' + (ly + spans.length * 13 - 4) + '" x2="' + (lx + 16) + '" y2="' + (ly + spans.length * 13 - 4)
     + '" stroke="#a8321f" stroke-width="2" stroke-dasharray="6 4"/>';
  g += '<text x="' + (lx + 21) + '" y="' + (ly + spans.length * 13) + '" font-size="9.5" fill="#a8321f">ateşleme frekansı</text>';
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
  ekle('Kayma emniyeti (en düşük)',
       (Number.isFinite(sf) && sf > 0) ? ('SF ≥ ' + _frF(sf, 2)) : 'SF > 1',
       Number.isFinite(minSF) ? _frFs(minSF, 2) : '—',
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

  // 6 — tasarım gerginliği ↔ yay dengesi
  var uy = ((R.build && R.build.warnings) || []).filter(function(w){ return /gerginli/i.test(w); });
  ekle('Tasarım gerginliği ↔ yay dengesi', 'sapma ≤ %2',
       uy.length ? _frEsc(uy[0]) : 'sapma eşiğin altında', uy.length ? 'no' : 'ok');

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
    veFeadGenerateReport: veFeadGenerateReport,
    _frBuildReportHTML: _frBuildReportHTML,
    _frSection8: _frSection8,
    _frCompliance: _frCompliance,
    _frAntet: _frAntet,
    _frEnsureAssets: _frEnsureAssets,
    _frConceptFigure: _frConceptFigure,
    _frF: _frF, _frFs: _frFs, _frPct: _frPct, _frEsc: _frEsc,
    VE_FEAD_REP_SECTIONS: VE_FEAD_REP_SECTIONS
  };
}
