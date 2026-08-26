// ============================================================================
// FEAD — ÖZET RAPOR (tedarikçi çıktısının birebir düzeni)
// ============================================================================
// Ayrıntılı rapor (js/cp-fead-report.js) teoriyi ANLATIR. Bu belge onun yerine
// geçmez: tedarikçi (Gates) "Accessory Belt Drive System" çıktısının SONUÇ
// SAYFALARINI, o sayfaların kendi düzeniyle verir.
//
// KAYNAK SAYFALAR — AG00976-BMC_Otomotif ... 8PK1715HD ... 05June2025,
// Gates v13.02, 12 sayfalık çıktının 1 / 2 / 3 / 6 / 8. sayfaları:
//   1  Summary of Results          → kayış+gergi künyesi · şema · gerginlik
//                                    kontrol grafiği · B10 · doğal frekans
//                                    haritası · tepe yük · eksenel kaçıklık
//   2  Geometric Analysis 1/2      → yerleşim verisi · kayış/gergi girdisi ·
//                                    şema · SONUÇLAR: span/sarım/oran +
//                                    gerginlik kontrol grafiği
//   3  Geometric Analysis 2/2      → gergi geometrisi (10 satır × 6 konum) +
//                                    take-up grafiği
//   4  Belt Slip / Tension 2/2     → kayma duyarlılığı + kayma emniyet grafiği
//   5  Pulley Hubload (Mean)       → şema · yük koşulları · ortalama hubload ·
//                                    ortalama gerginlik
//
// HESAPLAR AYRINTILI RAPORDAN GELİR — İKİNCİ BİR ÜRETİCİ YOK:
//   sayı biçimi      _frF / _frFs / _frPct / _frEsc / _frNum
//   kayma hükmü      _frSlipStats
//   grafikler        _frTensionFigure / _frFreqFigure / _frTakeupFigure /
//                    _frSlipFigure  →  veFeadFigureRaw ile KÜÇÜK ve numarasız
//   yerleşim şeması  veFeadLayoutSVG (kanvastaki Kayış Yolu kartının çizicisi)
// İki belge aynı sayıyı farklı basamaz; ayrışma ancak sessiz olurdu.
//
// AD ÖNEKİ `_fsr…` — `_fr…` ve `_fead…` alınmış; aynı adı iki dosyada
// üst-seviye bildirmek `source-hygiene` kapısına takılır.
// ----------------------------------------------------------------------------

// SAYFA = KONU. Tedarikçi çıktısının sayfa adları ("Geometric Analysis 1/2")
// bir DOSYA numaralandırmasıydı; okuyucuya sayfanın neyi cevapladığını
// söylemiyordu. Beş sayfa beş soruya karşılık gelir:
//   nasıl duruyor · nerede duruyor · kol nasıl geziyor · ne kadar yükleniyor ·
//   ne kadar dayanıyor
var VE_FSR_SHEETS = [
  'Genel Bakış',
  'Geometri',
  'Gergi Çalışma Zarfı',
  'Yükler',
  'Dayanım'
];

// Tepe yük modelinin ÖLÇÜLMÜŞ sapması (AG00976 ↔ Gates tepe tablosu).
// Çekirdeğin `peakEstimate`'i yarı-statik; kendi notu "gergi kolu dinamigi
// dahil DEGIL" diyor. Kombinasyon taraması yapılsa bile yakınsamıyor.
var VE_FSR_PEAK_BAND = '−%10,5 … +%22,8';

// ─── KÜÇÜK YARDIMCILAR ──────────────────────────────────────────────────────
// KASNAK KISA KODU. Matrislerde sütun başlığı kasnak ADIYSA tablo taşıyor:
// "Otomatik Gergi (E9843)" tek başına 22 karakter, altı kasnakta satır A4'e
// sığmıyor (ÖLÇÜLDÜ: sayfa 5'te 40 px taşma) — sığdırmak için punto 8,2'ye
// düşürülmüştü, yani okunaksızlığın kökü buydu. Kod + künye ikilisi hem
// sığıyor hem eksiksiz. Tedarikçi çıktısının FAN/IDR/A_C/ALT/TEN kullanmasının
// sebebi de bu.
function _fsrCodes(sys){
  var ps = (sys && sys.pulleys) || [];
  function ham(p, i){
    var ad = String(p.name || '');
    // Parantez içi YALNIZ harfse ve 2-4 karakterse bir KODDUR (FAN, ALT, A_C).
    // "155 A" bir ölçü, "E9843" bir parça numarası — ikisi de kod değil.
    var m = ad.match(/\(([A-Za-z_\/]{2,4})\)/);
    if(m) return m[1].toUpperCase().replace(/[^A-Z_\/]/g, '');
    if(p.tensioner) return 'TEN';
    if(p.crank) return 'CRK';
    var sade = ad.replace(/\([^)]*\)/g, ' ').trim();
    var son  = (sade.match(/(\d+)\s*$/) || [])[1] || '';
    var kel  = sade.replace(/\d+\s*$/, '').split(/\s+/).filter(Boolean);
    var k = kel.length >= 2 ? kel.map(function(w){ return w[0]; }).join('') : (kel[0] || 'P').slice(0, 3);
    k = k.toLocaleUpperCase('tr').replace(/[^A-ZÇĞİÖŞÜ0-9]/g, '').slice(0, 3);
    return (k || ('P' + (i + 1))) + son;
  }
  var out = ps.map(ham), gor = {};
  return out.map(function(k, i){
    if(!gor[k]){ gor[k] = 1; return k; }
    gor[k]++; return k + gor[k];
  });
}
// Kod → ad künyesi. Kodun kullanıldığı her sayfada bir kez basılır: kısaltma
// ancak karşılığı aynı sayfada duruyorsa okunabilir.
function _fsrCodeLegend(sys){
  var ps = (sys && sys.pulleys) || [], k = _fsrCodes(sys);
  if(!ps.length) return '';
  return '<div class="legend">' + ps.map(function(p, i){
    return '<span><b>' + _frEsc(k[i]) + '</b> ' + _frEsc(p.name) + '</span>'; }).join('') + '</div>';
}

function _fsrLogo(){
  // Tedarikçi çıktısında üreticinin markası nerede duruyorsa burada müşterinin
  // markası duruyor. Vektör: belge tek dosya ve çevrimdışı.
  // viewBox 42 px'lik yazının çıkıntısını da SARAR: 0 0 132 46'da harflerin
  // tepesi 1 px dışarıda kalıyordu (ölçüldü) ve baskıda kırpılıyordu.
  return '<svg viewBox="-2 -3 138 52" role="img" aria-label="BMC">'
    // AĞIRLIK 800 DEĞİL 700: gömülü Archivo yalnız 400 ve 700 taşıyor, 800
    // istendiğinde tarayıcı glifleri kendisi şişiriyor (sentetik kalın).
    + '<text x="2" y="36" font-family="Archivo, Arial Narrow, sans-serif" font-size="42"'
    + ' font-weight="700" letter-spacing="-1.5" fill="#1d1d1b">BMC</text></svg>';
}

function _fsrIdLines(R, node){
  var sys = (R.build && R.build.sys) || {}, b = sys.belt || {}, t = sys.tensioner || {};
  var d = (node && node.data) || {};
  var L = [];
  if(d.projectName) L.push(String(d.projectName));
  if(d.driveName)   L.push(String(d.driveName));
  if(t.armLength != null)
    L.push('Gergi: kol ' + _frF(t.armLength, 0) + ' mm · yay ' + _frFs(t.preloadNm, 2)
         + ' + ' + _frFs(t.rateNmPerDeg, 3) + ' Nm/°');
  L.push((b.brand ? b.brand + ' ' : '') + (b.ribs ? b.ribs : '') + (b.profile || '')
       + (b.effLength ? ' · ' + _frFs(b.effLength, 1) + ' mm' : ''));
  if(t.pivot) L.push('Pivot @ ' + _frF(t.pivot[0], 0) + ' / ' + _frF(t.pivot[1], 0)
       + (d.docNo ? ' · ' + d.docNo : '') + (d.revision ? ' rev ' + d.revision : ''));
  return L;
}

// Sayfa kabuğu — tedarikçi çıktısının anteti: solda marka kutusu, ortada
// firma, sağda sistem adı + sayfa başlığı; altında kullanıcı/tasarım satırı.
function _fsrSheet(no, title, body, R, node){
  var d = (node && node.data) || {};
  var tarih = new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  var h = '<section class="sheet"><div class="hdr">';
  h += '<div class="hdr-logo">' + _fsrLogo() + '</div>';
  h += '<div class="hdr-org">' + _frEsc(d.orgName || 'Mühendislik') + '<br>'
     + _frEsc(d.orgAddr || '') + '</div>';
  h += '<div class="hdr-title"><b>Aksesuar Kayış Tahrik Sistemi</b><br>' + _frEsc(title) + '</div>';
  h += '</div>';
  h += '<div class="hdr-sub"><span>Hazırlayan: ' + _frEsc(d.author || '—') + '</span>'
     + '<span>Tasarım: ' + _frEsc(d.docNo || '—') + (d.revision ? ' · rev ' + _frEsc(d.revision) : '')
     + '</span></div>';
  h += '<div class="sheet-body">' + body + '</div>';
  h += '<div class="footline"><span>' + _frEsc(tarih) + '</span>'
     + '<span>Sayfa ' + no + ' / ' + VE_FSR_SHEETS.length + '</span>'
     + '<span>MFSim · FEAD</span></div></section>';
  return h;
}

function _fsrIdBlock(R, node){
  return '<div class="idblk">' + _fsrIdLines(R, node).map(function(s){
    return '<div>' + _frEsc(s) + '</div>'; }).join('') + '</div>';
}

// Yerleşim şeması — TEK ÇİZİCİ. class="appfig" ŞART: o çizici uygulamanın
// palet jetonlarını kullanıyor, bu belgenin paleti başka; tanımsız var()
// kalıtılan `stroke` için `none` demektir (ayrıntılı raporda ölçüldü).
function _fsrLayout(R, W, H){
  var svg = null;
  try {
    if(typeof veFeadLayoutSVG === 'function' && R.build)
      svg = veFeadLayoutSVG(R.build, W || 250, H || 210,
        { posMode: 'mean', compass: true, pivot: true, arrows: false,
          // Şemada KISA KOD: tam ad çerçeveyi taşırıyor ve kayış yolunun
          // üstüne biniyor. Sarım açıları da kapalı — aynı altı sayı bir
          // sonraki sayfada hizalı bir tabloda duruyor.
          names: _fsrCodes(R.build && R.build.sys), wrapLabels: false });
  } catch(e){ svg = null; }
  if(!svg) return '<div class="nofig">Yerleşim şeması çizilemedi.</div>';
  return '<div class="appfig fig">' + svg + '</div>';
}
// Ayrıntılı raporun grafiği — küçük ve numarasız.
function _fsrFig(fn, R, W, H, extra){
  if(typeof veFeadFigureRaw !== 'function' || typeof fn !== 'function') return '';
  var s = veFeadFigureRaw(fn, R, W, H, extra);
  return s ? '<div class="fig">' + s + '</div>' : '';
}

// Gates tablosu: ince çerçeve, sayısal sütunlar sağa yaslı.
// SÜTUN HİZASI ANLAM TAŞIR: metin sola, sayı sağa. Sayıyı ortalamak basamak
// hizasını bozar ve iki satırın hangisinin büyük olduğu okunmaz olur.
// BÜTÜN HÜCRELERİ AYNI OLAN SÜTUN TABLODA DURMAZ. ÖLÇÜLDÜ (AG00976): beş
// tabloda on bir sütun tamamen sabitti — 130 hücre, 11 farklı sayı. Sabit bir
// sütun okuyucuya satır başına hiçbir şey söylemiyor, ama kalan sütunlardan
// genişlik çalıyor ve tabloyu A4'e sığdırmak için punto düşürmeye zorluyor.
// Sabit değer bloğun künyesine bir kez yazılır; bilgi kaybı YOK.
//
// AYRIM: yalnız veri sütunları (ilk sol sütunlardan sonrası) taranır ve en az
// üç satır aranır — iki satırlık bir tabloda "sabit" tesadüf olabilir.
function _fsrConstCols(head, rows, solN){
  var sabit = [];
  if(rows.length < 3 || !head) return sabit;
  for(var c = solN; c < head.length; c++){
    var ilk = rows[0][c], hep = true;
    for(var r = 1; r < rows.length; r++){ if(rows[r][c] !== ilk){ hep = false; break; } }
    if(hep && ilk != null && String(ilk).trim() !== '' && String(ilk).trim() !== '—')
      sabit.push({ i: c, head: head[c], val: ilk });
  }
  return sabit;
}
function _fsrStripCols(head, rows, idx){
  var at = {}; idx.forEach(function(x){ at[x.i] = 1; });
  return {
    head: head.filter(function(_, i){ return !at[i]; }),
    rows: rows.map(function(r){ return r.filter(function(_, i){ return !at[i]; }); })
  };
}
// "Sıcaklık [°C] = 90 · AVA1 [kW] = 0,01" — künye cümlesi
function _fsrConstNote(sabit){
  if(!sabit.length) return '';
  return 'Bütün satırlarda aynı olduğu için tablodan çıkarıldı: '
    + sabit.map(function(x){
        return '<b>' + String(x.head).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
             + '</b> = ' + String(x.val).replace(/<[^>]+>/g, ''); }).join(' · ') + '.';
}

function _fsrT(head, rows, opt){
  opt = opt || {};
  var solN = opt.ilkIkiSol ? 2 : (opt.ilkSol === false ? 0 : 1);
  var vur = opt.vurguSutun || null;
  function hucre(tag, c, i){
    var cls = [];
    if(i < solN) cls.push('l');
    if(vur && vur[i - 1]) cls.push('hi');            // vurguSutun veri sütunlarını sayar
    return '<' + tag + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + '>' + c + '</' + tag + '>';
  }
  var h = '<table class="gt' + (opt.cls ? ' ' + opt.cls : '') + '">';
  if(head) h += '<tr>' + head.map(function(c, i){ return hucre('th', c, i); }).join('') + '</tr>';
  rows.forEach(function(r){
    h += '<tr>' + r.map(function(c, i){ return hucre('td', c, i); }).join('') + '</tr>';
  });
  return h + '</table>';
}

// Sayfa başlığı. Sayfanın KONUSUNU söyler; anteti (marka / belge künyesi)
// söylemez — o `_fsrSheet` kabuğunda ve her sayfada aynı.
function _fsrH1(baslik, alt){
  return '<div class="h1"><h1>' + _frEsc(baslik) + '</h1>'
       + (alt ? '<span>' + _frEsc(alt) + '</span>' : '') + '</div>';
}

// Blok = başlık + içerik + (varsa) ALTINDA duran açıklama.
// Açıklamanın yeri ölçülmüş bir karar: tablodan ÖNCE gelen bir paragraf,
// okuyucuyu sayıya ulaşmadan önce metinde tutuyor; sonra gelen ise sayıyı
// gördükten sonra "bu ne demek" sorusunu cevaplıyor.
function _fsrBlk(baslik, icerik, not){
  return '<div class="blk">'
       + (baslik ? '<div class="bt">' + baslik + '</div>' : '')
       + icerik
       + (not ? '<div class="nt">' + not + '</div>' : '')
       + '</div>';
}

// Etiket/değer — ama TABLO olarak: değerler tek bir sağ kenarda hizalanır.
// `_fsrKV` serbest genişlikte (künye kartı), bu ise sayıların karşılaştırıldığı yer.
function _fsrKVT(rows){
  return '<table class="gt kvt2">' + rows.map(function(r){
    return '<tr><td class="l">' + r[0] + '</td><td>' + r[1] + '</td></tr>';
  }).join('') + '</table>';
}

// Etiket/değer künyesi (Belt Data, Tensioner Data kalıbı)
function _fsrKV(baslik, rows, vurgu){
  var h = '<div class="kvblk"><div class="kvt' + (vurgu ? ' hl' : '') + '">' + baslik + '</div>';
  rows.forEach(function(r){
    h += '<div class="kvr"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
  });
  return h + '</div>';
}

// ═══════════════════ SAYFA 1 — GENEL BAKIŞ ══════════════════════════════════
// TEK ŞEMA, TEK YERDE. İlk sürümlerde yerleşim şeması üç sayfada birden vardı;
// kullanıcı iki kez itiraz etti. Şema bir kez, BÜYÜK ve okunur çizilir — üç
// kez küçük çizmek ne bilgi ekliyor ne de yer bırakıyordu.
function _fsrSheet1(R, node){
  var sys = R.build && R.build.sys, b = (sys && sys.belt) || {}, t = (sys && sys.tensioner) || {};
  var A = R.analysis || {}, life = R.life || {}, duty = R.duty || [];
  var dcTop = 0; duty.forEach(function(r){ dcTop += _frNum(r.dcPct) || 0; });
  var st = (typeof _frSlipStats === 'function') ? _frSlipStats(R) : null;
  var sf = _frNum(R.serviceFact);

  var h = _fsrH1('Genel Bakış', 'Sistem künyesi, yerleşim ve kritik sonuçlar');

  // ŞEMANIN ÖLÇÜSÜ — kullanıcı bildirimi (2026-08-26): *"Şekiller çok büyük.
  // Gerçekten bu kadar büyük olmasına gerek yok."* ÖLÇÜLDÜ ve haklıydı: tam
  // genişlikteki şema 521 px, yani A4 içerik alanının (972 px) **%54'ü**;
  // sayfa 3'ün grafiği 623 px ile **%64'ü**. Teknik bir raporda şekil sayfanın
  // yarısını yemez — anlattığı şey bir tablo satırı kadar bilgi taşıyorsa
  // özellikle yemez.
  //
  // Küçültme ÖLÇEĞİ BOZMUYOR: çizicinin kabuğu `max-width:<W>px` taşıdığı ve
  // W kabın genişliğinden küçük seçildiği için oran 1 kalıyor, yani kullanıcı
  // birimindeki puntolar (ad 9) ekranda yine 9 px. Küçülen çizim, yazı DEĞİL.
  //
  // Şema SÜTUNA giriyor: kümenin doğal en-boy oranı ≈1,64 (yatay). Tam
  // genişlikte yükseklik zorunlu olarak 430 px'e çıkıyordu; 395 px'lik sütunda
  // aynı oran 242 px veriyor ve boşalan yeri künyeler dolduruyor.
  h += '<div class="cols c58">';
  h += '<div class="col">' + _fsrLayout(R, 395, 242) + '</div>';
  h += '<div class="col">';
  h += _fsrKV('Kayış', [
    ['Profil / marka', _frEsc((b.brand ? b.brand + ' ' : '') + (b.ribs || '') + (b.profile || ''))],
    ['Kaburga sayısı', _frF(b.ribs, 0)],
    ['Efektif boy (ISO 9981)', _frFs(b.effLength, 1) + ' mm'],
    ['Boy toleransı', b.tolerance ? '± ' + _frFs(b.tolerance, 2) + ' mm' : '—'],
    ['Uzama + aşınma payı', _frPct(_frNum(b.wearPct) * 100, 2)]
  ]);
  h += _fsrKV('Otomatik gergi', [
    ['Kol boyu', _frFs(t.armLength, 1) + ' mm'],
    ['Yay ön yükü / oranı', _frFs(t.preloadNm, 2) + ' Nm · ' + _frFs(t.rateNmPerDeg, 3) + ' Nm/°'],
    ['Pivot {X, Y}', _frFs(t.pivot && t.pivot[0], 1) + ' , ' + _frFs(t.pivot && t.pivot[1], 1)],
    ['Çalışma kol açısı', _frFs(A.meanRelDeg, 2) + '° (göreli)'],
    ['Take-up oranı', _frFs(A.tensioner && A.tensioner.takeupMmPerDeg, 3) + ' mm/°']
  ]);
  h += '</div></div>';

  // — kritik sonuçlar: okuyucunun ilk bakışta görmesi gereken beş sayı
  var sig = _fsrSignedWrap(R);
  var kapali = Number.isFinite(sig) && Math.abs(Math.abs(sig) - 360) <= 0.05;
  var sfOK = !(Number.isFinite(sf) && sf > 0) || (st && Number.isFinite(st.loadedMin) && st.loadedMin >= sf);
  var kart = [
    ['Tasarım gerginliği', _frF(sys && sys.designTensionN, 0) + ' N', 'yay dengesinden türetildi'],
    ['En düşük kayma emniyeti', st && Number.isFinite(st.loadedMin) ? _frFs(st.loadedMin, 2) : '—',
      (Number.isFinite(sf) && sf > 0 ? 'istenen ≥ ' + _frF(sf, 2) : 'yük taşıyan kasnaklarda'), sfOK ? 'ok' : 'no'],
    ['B10 kayış ömrü', _frF(life.hoursB10, 0) + ' saat',
      life.inValidRange ? 'çap penceresi içinde' : 'çap penceresi dışında — bkz. sayfa 5',
      life.inValidRange ? 'ok' : 'uy'],
    ['Kapalı çevrim', _frFs(sig, 2) + '°', 'Σ işaretli sarım · 360° olmalı', kapali ? 'ok' : 'no'],
    ['Çalışma çevrimi', duty.length + ' devir', 'toplam süre payı ' + _frPct(dcTop, 1)]
  ];
  h += '<div class="cards">' + kart.map(function(k){
    return '<div class="card' + (k[3] ? ' ' + k[3] : '') + '"><div class="ck">' + k[0] + '</div>'
         + '<div class="cv">' + k[1] + '</div><div class="cs">' + k[2] + '</div></div>';
  }).join('') + '</div>';

  h += _fsrWarnBox(R);
  h += _fsrScopeBlock();
  h += _fsrCodeLegend(sys);
  return h;
}

// BELGENİN KAPSAMI SONUCUN İÇİNDE DURUR. Bir özet raporun en pahalı sessiz
// hatası, İÇERMEDİĞİ bir kontrolün yapıldığı izlenimini bırakmasıdır: tablolar
// dolu görünür, hüküm verilir, ama okuyucu neyin denetlenmediğini bilmez.
function _fsrScopeBlock(){
  var var_ = ['kapalı çevrim geometrisi (Σ işaretli sarım = 360°)',
    'gergi kolunun altı konumu ve take-up oranı',
    'çalışma çevrimi boyunca ortalama gerginlik ve hubload',
    'kayma emniyet faktörü ve kaburga yorulma dağılımı',
    'B10 kayış ömrü (çap penceresi denetimiyle)'];
  var yok = ['sistem burulma modu / rezonans haritası — ayrı büyüklük',
    'kasnak eksenel kaçıklığı (ψ girdisi sorulmuyor; ψ=0 iyimser olurdu)',
    'kayma duyarlılığının TERS çözümü (gereken gerginlik artışı)',
    'Weibull dağılımı / 1000 adette arıza sayısı',
    'tepe tork eğrisi — bu belgedeki tork ORTALAMADIR'];
  return _fsrBlk('Belgenin Kapsamı',
    '<div class="cols"><div class="col"><div class="scope in"><b>Bu belge şunları verir</b><ul>'
    + var_.map(function(x){ return '<li>' + _frEsc(x) + '</li>'; }).join('')
    + '</ul></div></div><div class="col"><div class="scope out"><b>Bu belgede yer ALMAZ</b><ul>'
    + yok.map(function(x){ return '<li>' + _frEsc(x) + '</li>'; }).join('')
    + '</ul></div></div></div>',
    'Ayrıntılı rapor aynı çözümü teorisiyle birlikte anlatır; kapsam farkı sayıda değil, '
    + '<b>gerekçede</b>dir.');
}
function _fsrSignedWrap(R){
  var g = R.analysis && R.analysis.geometry, sys = R.build && R.build.sys;
  if(!g || !sys) return NaN;
  var t = 0;
  g.forEach(function(row, i){
    var p = sys.pulleys[i];
    t += ((p && p.contact !== 'back') ? 1 : -1) * _frNum(row.wrapDeg);
  });
  return t;
}
function _fsrWarnBox(R){
  var w = [];
  (R.warnings || []).forEach(function(x){ w.push(x); });
  ((R.build && R.build.warnings) || []).forEach(function(x){ w.push(x); });
  if(!w.length) return '';
  return '<div class="warnbox"><b>Çözümün taşıdığı uyarılar</b><ul>'
       + w.map(function(x){ return '<li>' + _frEsc(x) + '</li>'; }).join('') + '</ul></div>';
}

// ═══════════════════ SAYFA 2 — GEOMETRİ ═════════════════════════════════════
function _fsrSheet2(R, node){
  var sys = R.build && R.build.sys, A = R.analysis || {}, g = A.geometry || [];
  var kod = _fsrCodes(sys);
  var mean = (A.positions || []).filter(function(p){ return p.position === 'Mean' && !p.error; })[0];

  var h = _fsrH1('Geometri', 'Kasnak yerleşimi ve çözülmüş kayış yolu');

  // GERGİ KASNAĞININ X/Y'si BİR GİRDİ DEĞİL: kol açısından türeyen çalışma
  // merkezidir. Boş bırakmak "konum bilinmiyor" gibi okunuyordu.
  var lay = sys.pulleys.map(function(p, i){
    var sirt = (p.contact === 'back'), x = p.x, y = p.y, ek = '';
    if(p.tensioner && mean){ x = mean.idlerX; y = mean.idlerY; ek = ' †'; }
    return ['<b>' + _frEsc(kod[i]) + '</b>', _frEsc(p.name) + ek,
            _frFs(x, 2), _frFs(y, 2), _frFs(p.od, 1),
            _frFs(_frNum(p.rPitch) * 2, 2), _frFs(_frNum(p.rEff) * 2, 2),
            sirt ? 'sırt' : 'kaburgalı',
            Number.isFinite(_frNum(p.inertiaKgM2)) ? _frFs(p.inertiaKgM2, 4) : '—'];
  });
  h += _fsrBlk('Kasnak Yerleşimi',
    _fsrT(['Kod', 'Kasnak', 'X<br>[mm]', 'Y<br>[mm]', 'Dış çap<br>[mm]', 'Pitch Ø<br>[mm]',
           'Efektif Ø<br>[mm]', 'Temas', 'Atalet<br>[kg·m²]'], lay, { ilkIkiSol: true }),
    mean ? '† Gergi kasnağının konumu bir girdi değildir: kol açısından türeyen çalışma merkezidir.' : '');

  var geo = g.map(function(x, i){
    return ['<b>' + _frEsc(kod[i]) + '</b>', _frEsc(x.name),
            _frFs(x.exitSpanMm, 1), _frFs(x.wrapDeg, 2),
            (sys.pulleys[i].contact === 'back' ? '−' : '+'), _frFs(x.speedRatio, 3)];
  });
  var sig = _fsrSignedWrap(R);
  h += _fsrBlk('Çözülmüş Kayış Yolu',
    _fsrT(['Kod', 'Kasnak', 'Çıkış açıklığı<br>[mm]', 'Sarım açısı<br>[°]', 'İşaret',
           'Hız oranı<br>(motor ref.)'], geo, { ilkIkiSol: true }),
    'Açıklık, o kasnaktan <b>çıkan</b> serbest kayış parçasıdır. Σ işaretli sarım = <b>'
    + _frFs(sig, 2) + '°</b> (kapalı çevrim koşulu 360°). Efektif tahrik boyu <b>'
    + _frFs(A.driveLenMm, 1) + ' mm</b>, gereken kayış boyu <b>' + _frFs(A.requiredBeltMm, 1) + ' mm</b>.');

  // HIZ ORANI GEOMETRİDEN GELİR, ELLE YAZILMAZ. Aksesuar devri kasnak PITCH
  // çaplarından çıkar; elle yazılmış bir oran bütün güç okumalarını kaydırır
  // (spesifikasyon §2.3'te belgelenmiş sınıf).
  var ad = (A.duty || []);
  if(ad.length){
    var rows = ad.map(function(d){
      var c = [_frF(d.engineRpm, 0)];
      (d.perPulley || []).forEach(function(x){ c.push(_frF(x.accessoryRpm, 0)); });
      return c;
    });
    h += _fsrBlk('Aksesuar Devirleri [d/d]',
      _fsrT(['Motor devri<br>[d/d]'].concat(kod), rows, { ilkSol: true }),
      'Her sütun, o kasnağın motor devrine göre <b>pitch çapından</b> hesaplanan devridir; '
      + 'aksesuarın güç eğrisi bu devirden okunur. Oranlar sayfanın üstündeki tabloda.');
  }

  // BOY DENGESİ ELLE TOPLANABİLİR OLMALI. "Efektif tahrik boyu 1716,2 mm"
  // tek başına doğrulanamaz bir sayıdır; parçalarına ayrılınca okuyucu
  // toplamı kendisi yapabilir ve modelin kapandığını GÖRÜR.
  var topYay = 0, topSpan = 0;
  var bal = g.map(function(x, i){
    var p = sys.pulleys[i];
    var rEff = _frNum(p.rEff);
    var yay = rEff * _frNum(x.wrapDeg) * Math.PI / 180;
    var sp = _frNum(x.exitSpanMm);
    if(Number.isFinite(yay)) topYay += yay;
    if(Number.isFinite(sp)) topSpan += sp;
    return ['<b>' + _frEsc(kod[i]) + '</b>', _frFs(rEff * 2, 2), _frFs(x.wrapDeg, 2),
            _frFs(yay, 2), _frFs(sp, 2)];
  });
  bal.push(['<b>Σ</b>', '', '', '<b>' + _frFs(topYay, 2) + '</b>', '<b>' + _frFs(topSpan, 2) + '</b>']);
  h += _fsrBlk('Kayış Boyu Dengesi',
    _fsrT(['Kod', 'Efektif Ø<br>[mm]', 'Sarım<br>[°]', 'Sarım yayı<br>[mm]',
           'Çıkış açıklığı<br>[mm]'], bal, { ilkSol: true }),
    'Kayışın efektif boyu iki parçadan oluşur: kasnaklara <b>saran</b> yaylar ve aralarındaki '
    + '<b>serbest açıklıklar</b>. Toplamları ' + _frFs(topYay, 2) + ' + ' + _frFs(topSpan, 2)
    + ' = <b>' + _frFs(topYay + topSpan, 2) + ' mm</b>, efektif tahrik boyu <b>'
    + _frFs(A.driveLenMm, 1) + ' mm</b>. Sırttan temas eden kasnakta yay kayışı <b>uzatır</b> '
    + 'ama sarım işareti eksidir; kapalı çevrim koşulu bu yüzden işaretli toplamda aranır.');

  h += _fsrCodeLegend(sys);
  return h;
}

// ═══════════════════ SAYFA 3 — GERGİ ÇALIŞMA ZARFI ══════════════════════════
function _fsrSheet3(R, node){
  var A = R.analysis || {}, pos = A.positions || [], T = A.tensioner || {};
  var TR = (typeof VE_FEAD_POSITIONS !== 'undefined')
    ? VE_FEAD_POSITIONS.reduce(function(o, p){ o[p.core] = p.label; return o; }, {}) : {};

  var h = _fsrH1('Gergi Çalışma Zarfı', 'Kol açısı, kayış boyu ve gerginliğin birlikte değişimi');

  var head = ['Büyüklük'].concat(pos.map(function(p){
    return (p.position === 'Mean' ? '<span class="hi">' : '<span>')
         + _frEsc(TR[p.position] || p.position) + '</span>'; }));
  function sat(k, br, f, d){
    return ['<span class="q">' + k + '</span><span class="u">' + br + '</span>']
      .concat(pos.map(function(p){ return p.error ? '<span class="err">—</span>' : _frFs(f(p), d); }));
  }
  var rows = [
    sat('Kol konumu', '°', function(p){ return p.absDeg; }, 1),
    sat('Gergi kasnağı X', 'mm', function(p){ return p.idlerX; }, 1),
    sat('Gergi kasnağı Y', 'mm', function(p){ return p.idlerY; }, 1),
    sat('Hubload–kol açısı β', '°', function(p){ return p.betaDeg; }, 1),
    sat('Hubload yönü', '°', function(p){ return p.hubDirDeg; }, 1),
    sat('Hubload', 'N', function(p){ return p.hubloadN; }, 1),
    sat('Gerginlik', 'N', function(p){ return p.tensionN; }, 1),
    sat('Gergi sarım açısı', '°', function(p){ return p.wrapDeg; }, 1),
    sat('Efektif tahrik boyu', 'mm', function(p){ return p.driveLenMm; }, 1),
    sat('Gereken efektif kayış boyu', 'mm', function(p){ return p.requiredBeltMm; }, 1)
  ];
  h += _fsrBlk('Altı Kol Konumu <span class="kvi">take-up oranı ' + _frFs(T.takeupMmPerDeg, 3)
      + ' mm/°</span>',
    _fsrT(head, rows, { ilkSol: true, vurguSutun: pos.map(function(p){ return p.position === 'Mean'; }) }),
    '<b>Load bir mekanik durdurucudur</b>, çalışma noktası değildir: orada sarım sıfıra yaklaştığı '
    + 'için gerginlik tekilleşir. Tasarımın çalışma noktası <b>Çalışma (Mean)</b> sütunudur; '
    + 'kayış toleransı ve aşınma payı kolu bu zarf boyunca gezdirir.');

  // TEK GRAFİK. Zarfın anlattığı şeyin görsel karşılığı bu eğri; diğer
  // grafikler aynı bilgiyi ikinci kez anlatıyordu.
  h += _fsrBlk('Gerginliğin Kol Açısına Bağımlılığı',
    _fsrFig(typeof _frTensionFigure === 'function' ? _frTensionFigure : null, R, 780, 390),
    'Kalın eğri hesaplanan gerginlik, <b>soluk kesikli iki eğri onun ±%10 bandıdır</b> — '
    + 'yay imalat saçılması, sürtünme ve montaj payı için alışılmış tolerans zarfı. '
    + 'Kesikli dikey çizgiler yukarıdaki altı kol konumunu işaretler. Eğri, kol açısı çözüm '
    + 'aralığının ucuna yaklaşırken tekilleşir; eksen bu yüzden çalışma konumlarına göre '
    + 'sınırlanmıştır.');
  return h;
}

// ═══════════════════ SAYFA 4 — YÜKLER ═══════════════════════════════════════
function _fsrSheet4(R, node){
  var duty = (R.analysis && R.analysis.duty) || [], raw = R.duty || [];
  var sys = R.build && R.build.sys;
  var h = _fsrH1('Yükler', 'Çalışma çevrimi boyunca gerginlik ve yatak kuvvetleri');
  if(!duty.length) return h + '<div class="nofig">Çalışma çevrimi tanımlı değil.</div>';

  var kod = _fsrCodes(sys);
  var surucu = '';
  if(sys) sys.pulleys.forEach(function(p){ if(p.crank) surucu = p.name; });
  var yukIdx = [];
  sys.pulleys.forEach(function(p, i){ if(p.name !== surucu) yukIdx.push(i); });

  var lc = raw.map(function(r){
    var c = [_frF(r.engineRpm, 0), _frFs(r.dcPct, 2), _frF(r.degC, 0)];
    var top = 0;
    yukIdx.forEach(function(i){
      var v = _frNum(r.loadsKw && r.loadsKw[sys.pulleys[i].name]);
      if(Number.isFinite(v)) top += v;
      c.push(Number.isFinite(v) ? _frFs(v, 2) : '—');
    });
    c.push('<b>' + _frFs(top, 2) + '</b>');
    return c;
  });
  var lcHead = ['Motor devri<br>[d/d]', 'Süre payı<br>[%]', 'Sıcaklık<br>[°C]']
    .concat(yukIdx.map(function(i){ return kod[i] + '<br>[kW]'; })).concat(['Σ sürücü<br>[kW]']);
  var lcSbt = _fsrConstCols(lcHead, lc, 1), lcSade = _fsrStripCols(lcHead, lc, lcSbt);
  h += _fsrBlk('Çalışma Çevrimi Girdisi',
    _fsrT(lcSade.head, lcSade.rows, { ilkSol: true }),
    '<b>Sürücü kasnağın gücü bir girdi değildir</b>: çevrimin kapanabilmesi için aksesuar '
    + 'güçlerinin toplamı olarak hesaplanır. ' + _fsrConstNote(lcSbt));

  function mat(baslik, oku, dec, not){
    var rows = duty.map(function(d, k){
      var c = [_frF(d.engineRpm, 0)];
      sys.pulleys.forEach(function(p, i){ c.push(_frFs(oku(d, i), dec)); });
      return c;
    });
    return _fsrBlk(baslik,
      _fsrT(['Motor devri<br>[d/d]'].concat(kod.map(function(k){ return k; })), rows, { ilkSol: true }),
      not);
  }
  h += mat('Ortalama Gerginlikler [N]',
    function(d, i){ return (d.perPulley[i] || {}).exitTensionN; }, 0,
    'Değer, o kasnaktan <b>sonraki</b> açıklığın gerginliğidir: sürücüde yükselir, güç çeken her '
    + 'kasnakta bir basamak düşer, avara ve gergide değişmez.');
  h += mat('Ortalama Hubloadlar [N]',
    function(d, i){ return ((d.hubloads || [])[i] || {}).FN; }, 0,
    'Hubload, kasnak yatağına binen bileşke kuvvettir; yatak ve braket seçimi bu değere bakar.');

  h += _fsrCodeLegend(sys);
  return h;
}

// ═══════════════════ SAYFA 5 — DAYANIM ══════════════════════════════════════
function _fsrSheet5(R, node){
  var duty = (R.analysis && R.analysis.duty) || [], sys = R.build && R.build.sys;
  var h = _fsrH1('Dayanım', 'Kayma emniyeti, kaburga yorulması, ömür ve titreşim');
  if(!duty.length) return h + '<div class="nofig">Çalışma çevrimi tanımlı değil.</div>';
  var kod = _fsrCodes(sys), sf = _frNum(R.serviceFact);

  // VURGU HÜKÜMLE ÇELİŞEMEZ. İlk sürüm SF < servis faktörü olan her hücreyi
  // kırmızı kalın basıyordu; AG00976'da bu, gerginlik oranı 1,00 olan üç
  // sütunun (avara ×2 + gergi) OTUZ ALTI hücresini birden kırmızıya boyuyordu.
  // Ama sayfanın kendi hükmü *"yük taşımayanlarda o sayı bir marj değil,
  // KAPASİTEDİR"* diyor — yani vurgu, metnin tam tersini bağırıyordu.
  // Kırmızı artık yalnız hükmü verebilen kümede; ötekiler soluk basılıyor ve
  // başlıklarında bunu YAZIYOR. Sayı gizlenmiyor, sınıfı işaretleniyor.
  var esik = (typeof VE_FR_SLIP_LOADED_RATIO === 'number') ? VE_FR_SLIP_LOADED_RATIO : 1.01;
  var yukTasir = (sys.pulleys || []).map(function(){ return false; });
  duty.forEach(function(d){
    (d.slip || []).forEach(function(x, i){
      if(_frNum(x.tensionRatio) >= esik) yukTasir[i] = true;
    });
  });
  var mrows = duty.map(function(d){
    var c = [_frF(d.engineRpm, 0)];
    (d.slip || []).forEach(function(x, i){
      var v = _frNum(x.SF);
      if(!yukTasir[i]) return c.push('<span class="pas">' + _frFs(v, 2) + '</span>');
      var kotu = Number.isFinite(sf) && sf > 0 && Number.isFinite(v) && v < sf;
      c.push(kotu ? '<b class="bad">' + _frFs(v, 2) + '</b>' : _frFs(v, 2));
    });
    return c;
  });
  var slipHead = ['Motor devri<br>[d/d]'].concat(kod.map(function(k, i){
    return yukTasir[i] ? k : k + '<br><span class="kh">yük taşımaz</span>'; }));
  var st = (typeof _frSlipStats === 'function') ? _frSlipStats(R) : null;
  var hukum = '';
  if(st && Number.isFinite(st.loadedMin)){
    var ok = !(Number.isFinite(sf) && sf > 0) || st.loadedMin >= sf;
    hukum = '<b>Hüküm:</b> yük taşıyan kasnakların en düşük emniyet faktörü <b>'
      + _frFs(st.loadedMin, 2) + '</b>' + (st.loadedName ? ' (' + _frEsc(st.loadedName) + ')' : '')
      + (Number.isFinite(sf) && sf > 0 ? ', istenen ≥ ' + _frF(sf, 2) : '') + (ok ? ' ✓' : ' ✗')
      + '. Yük taşımayan avara ve gergide gerginlik oranı 1\'e yakındır; oradaki sayı bir marj '
      + 'değil, o sarım açısının <b>kapasitesidir</b>.';
  }
  h += _fsrBlk('Kayma Emniyet Faktörü'
      + (Number.isFinite(sf) && sf > 0 ? ' <span class="kvi">servis faktörü ' + _frF(sf, 2) + '</span>' : ''),
    _fsrT(slipHead, mrows, { ilkSol: true }), hukum);
  void 0;

  h += '<div class="cols">';
  var f = R.fatigue;
  if(f && f.perPulley && f.perPulley.length){
    var fr = f.perPulley.map(function(p, i){
      return ['<b>' + _frEsc(kod[i]) + '</b>', _frFs(p.dEffMm, 1),
              p.contact === 'back' ? 'sırt' : 'kaburgalı', _frFs(p.sharePct, 2)];
    });
    h += '<div class="col">' + _fsrBlk('Kaburga Yorulma Dağılımı',
      _fsrT(['Kod', 'Efektif Ø<br>[mm]', 'Temas', 'Pay<br>[%]'], fr, { ilkSol: true }),
      'Payı yüksek olan kasnak, çapı büyütülerek ömrü en çok uzatacak olandır. Bu dağılım bir '
      + '<b>orandır</b> ve mutlak ömrün çap penceresinden bağımsızdır.') + '</div>';
  }
  var life = R.life || {};
  var om = [
    ['B10 ömrü', '<b>' + _frF(life.hoursB10, 0) + ' saat</b>'],
    ['Yorulma modeli', _frEsc(R.fatigueModel || '—')],
    ['Eşdeğer kayış sıcaklığı', _frF(R.degCEq, 0) + ' °C'],
    ['Tur / saniye', _frFs(life.passesPerSec, 2)]
  ];
  if(!life.inValidRange && Number.isFinite(_frNum(life.hoursB10Corrected)))
    om.push(['Ampirik düzeltmeli', _frF(life.hoursB10Corrected, 0) + ' saat']);
  h += '<div class="col">' + _fsrBlk('Kayış Ömrü', _fsrKVT(om),
    life.inValidRange ? 'Tüm kasnak çapları kalibrasyon aralığında; mutlak saat kullanılabilir.'
      : '<b>Çap penceresi dışında:</b> ' + _frEsc((life.outOfRange || []).join(', '))
        + '. Model bu durumda ömrü sistematik olarak düşük verir; düzeltmeli satır bu sapmayı '
        + 'kabaca telafi eder. <b>Yorulma payları bundan bağımsız olarak geçerlidir.</b>') + '</div>';
  h += '</div>';

  var d0 = duty[0];
  if(d0 && d0.frequencies && d0.frequencies.length){
    var rows = d0.frequencies.map(function(s0, i){
      var L = NaN, lo = Infinity, hi = -Infinity, flut = false;
      duty.forEach(function(d){
        var s = (d.frequencies || [])[i]; if(!s) return;
        L = _frNum(s.LMm);
        var fq = (s.fHz && s.fHz.length) ? _frNum(s.fHz[0]) : NaN;
        if(Number.isFinite(fq)){ if(fq < lo) lo = fq; if(fq > hi) hi = fq; }
        if(s.flutter) flut = true;
      });
      var ad = String(s0.span);
      (sys.pulleys || []).forEach(function(p, k){ ad = ad.split(p.name).join(kod[k]); });
      ad = ad.replace(/\s*->\s*/g, ' → ');        // ASCII ok, belgenin geri kalanı Unicode
      return [_frEsc(ad), _frFs(L, 1), _frFs(lo, 1) + ' – ' + _frFs(hi, 1),
              flut ? '<b class="bad">var</b>' : '<span class="ok">yok</span>'];
    });
    var f1 = _frNum(d0.firingHz), f2 = _frNum(duty[duty.length - 1].firingHz);
    var vHead = ['Açıklık', 'Boy<br>[mm]', 'f₁ aralığı<br>[Hz]', 'Çırpınma'];
    var vSbt = _fsrConstCols(vHead, rows, 1), vSade = _fsrStripCols(vHead, rows, vSbt);
    h += _fsrBlk('Serbest Açıklık Titreşimi',
      _fsrT(vSade.head, vSade.rows, { ilkSol: true }),
      'Ateşleme frekansı çalışma çevrimi boyunca <b>' + _frFs(f1, 1) + ' – ' + _frFs(f2, 1)
      + ' Hz</b>. Bunlar açıklıkların <b>enine</b> titreşimidir; sistem burulma modu ayrı bir '
      + 'büyüklüktür ve bu belgede yer almaz. ' + _fsrConstNote(vSbt));
  }
  h += _fsrPeakBlock(R, kod);
  h += _fsrCodeLegend(sys);
  return h;
}

// Tepe yük — düzen tedarikçi çıktısıyla aynı, damgası üstünde.
function _fsrPeakBlock(R, kod){
  var pk = _fsrPeak(R);
  if(!pk) return '';
  var sys = R.build && R.build.sys;
  if(!kod) kod = _fsrCodes(sys);
  var rows = pk.rows.map(function(r, i){
    return ['<b>' + _frEsc(kod[i]) + '</b>', _frF(pk.engineRpm, 0), _frF(r.accelRpmS, 0),
            _frF(r.tensionN, 0), _frF(r.hubloadN, 0), _frF(r.dirDeg, 0)];
  });
  var pHead = ['Kod', 'Motor devri<br>[d/d]', 'İvme<br>[d/d/s]', 'Tepe gerginlik<br>[N]',
               'Tepe hubload<br>[N]', 'Yön<br>[°]'];
  var pSbt = _fsrConstCols(pHead, rows, 1), pSade = _fsrStripCols(pHead, rows, pSbt);
  return _fsrBlk('Tepe Gerginlik ve Hubload <span class="stamp">kalibre değil</span>',
    _fsrT(pSade.head, pSade.rows, { ilkSol: true }),
    'Tepe yükler, aksesuar güçlerinin %100/%10 kombinasyonları ve ± ivme taranarak kasnak başına '
    + 'en büyük değerden alınır. <b>Model yarı-statiktir ve gergi kolu dinamiğini içermez</b>; '
    + 'tedarikçi çıktısına karşı ölçülen sapma ' + VE_FSR_PEAK_BAND + ' bandındadır. Yatak ve '
    + 'braket seçiminde <b>tek başına kullanılmamalıdır</b>. ' + _fsrConstNote(pSbt));
}

// ─── TEPE YÜK TARAMASI (köprü katmanında, çekirdeğe dokunmadan) ─────────────
function _fsrPeak(R){
  var C = (typeof FEADCore !== 'undefined') ? FEADCore
        : ((typeof window !== 'undefined') ? window.FEADCore : null);
  var sys = R.build && R.build.sys, duty = R.duty || [];
  if(!C || !C.peakEstimate || !sys || !duty.length) return null;

  var ref = duty[0];
  duty.forEach(function(r){ if((_frNum(r.dcPct) || 0) > (_frNum(ref.dcPct) || 0)) ref = r; });
  var rpm = _frNum(ref.engineRpm);
  if(!Number.isFinite(rpm) || rpm <= 0) return null;
  var accel = _frNum(R.peakAccelRpmS);
  if(!Number.isFinite(accel) || accel <= 0) accel = 1100;

  // R.duty ZATEN çekirdek biçiminde (kW kasnak ADIYLA anahtarlı). İkinci kez
  // veFeadDutyToCore'dan geçirmek anahtarları kaçırıyor ve bütün aksesuarlar
  // 0 kW ile koşuyordu — tepe gerginlik ORTALAMANIN ALTINA düşüyordu (ölçüldü).
  var kw0 = (ref && ref.loadsKw) ? ref.loadsKw : null;
  if(!kw0){
    try {
      var cr = (typeof veFeadDutyToCore === 'function') ? veFeadDutyToCore(R.build, [ref]) : null;
      kw0 = (cr && cr[0] && cr[0].loadsKw) || {};
    } catch(e){ kw0 = {}; }
  }
  var yuk = Object.keys(kw0).filter(function(k){ return _frNum(kw0[k]) > 0.05; });
  if(yuk.length > 8) yuk = yuk.slice(0, 8);          // 2^8 kombinasyon tavanı

  var geom = null;
  try { geom = C.tensionerState(sys, C.meanRel(sys)).geom; } catch(e){ return null; }

  var n = sys.pulleys.length, best = [];
  for(var i = 0; i < n; i++) best.push({ T: -Infinity, combo: null, a: accel });
  for(var m = 0; m < (1 << yuk.length); m++){
    var kw = {}, f = {};
    Object.keys(kw0).forEach(function(k){ kw[k] = kw0[k]; });
    for(var j = 0; j < yuk.length; j++){
      f[yuk[j]] = (m >> j & 1) ? 0.10 : 1.00;
      kw[yuk[j]] = kw0[yuk[j]] * f[yuk[j]];
    }
    [accel, -accel].forEach(function(a){
      var pe;
      try { pe = C.peakEstimate(sys, { engineRpm: rpm, accelRpmS: a, loadsKw: kw }); }
      catch(e){ return; }
      ['accel', 'decel'].forEach(function(br){
        (pe[br].spanN || []).forEach(function(T, i2){
          if(T > best[i2].T) best[i2] = { T: T, combo: f, a: a };
        });
      });
    });
  }
  if(!best.every(function(v){ return Number.isFinite(v.T); })) return null;

  var hb = [];
  try { hb = C.hubloads(geom, best.map(function(v){ return v.T; })); } catch(e){ hb = []; }
  var rows = sys.pulleys.map(function(p, i){
    return {
      name: p.name, tensionN: best[i].T, accelRpmS: best[i].a,
      combo: best[i].combo || {},
      hubloadN: hb[i] ? hb[i].FN : NaN,
      dirDeg: hb[i] ? hb[i].dirDeg : NaN,
      wrapDeg: geom.wraps[i] * 180 / Math.PI
    };
  });
  return { engineRpm: rpm, accelRpmS: accel, yuk: yuk, rows: rows };
}

// ═══════════════════ BELGE MONTAJI ══════════════════════════════════════════
function veFeadSummaryHTML(R, node){
  var A = (typeof window !== 'undefined') ? window.MNT_REPORT_ASSETS : null;
  var fonts = (A && A.fontsCss) ? A.fontsCss : '';
  var body = _fsrSheet(1, VE_FSR_SHEETS[0], _fsrSheet1(R, node), R, node)
           + _fsrSheet(2, VE_FSR_SHEETS[1], _fsrSheet2(R, node), R, node)
           + _fsrSheet(3, VE_FSR_SHEETS[2], _fsrSheet3(R, node), R, node)
           + _fsrSheet(4, VE_FSR_SHEETS[3], _fsrSheet4(R, node), R, node)
           + _fsrSheet(5, VE_FSR_SHEETS[4], _fsrSheet5(R, node), R, node);
  return '<!DOCTYPE html>\n<html lang="tr"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<title>FEAD — Sonuç Özeti</title>'
    + '<style>' + fonts + '</style><style>' + _fsrCss() + '</style>'
    + '</head><body>' + body + '</body></html>';
}

// ─── GÖRSEL ÖLÇEK ───────────────────────────────────────────────────────────
// ÖLÇÜLDÜ (gerçek tarayıcı, önceki sürüm): belgede 17 AYRI punto vardı ve
// 651 öge 8,5 px'in altındaydı (gövde 8,2 px). Okunmazlığın kökü buydu — ve
// sebebi tipografi tercihi değil YERLEŞİMDİ: kasnak ADI sütun başlığı olunca
// matrisler A4'e sığmıyor, sığdırmak için punto düşürülüyordu. Kısa kod +
// künye o baskıyı kaldırdı, yani punto artık serbest.
//
// ÖLÇEK BEŞ BASAMAK — ve hepsi TEK yerde tanımlı. Bir bloğun kendi puntosunu
// satır içinde yazması, bu belgenin bugüne kadarki en pahalı hatasıydı.
function _fsrCss(){
  return [
    ':root{',
    '  --ink:#1b1e24;--paper:#fff;--line:#b3b9c0;--rule:#8b929b;--soft:#e2e6ea;',
    '  --prusya:#24425f;--band:#c0392b;--head:#eef2f6;--zebra:#f6f8fa;',
    '  --warn:#8a5a1e;--bad:#a8321f;--ok:#2e7d4f;--hl:#fff3cd;--dim:#4a525e;',
    // beş basamaklı ölçek — 1,15 oranlı, tabanı 9 px (A4 baskıda ≈ 6,8 pt)
    '  --f-xl:16px;--f-lg:11.5px;--f-md:10px;--f-sm:9.4px;--f-xs:8.8px;',
    '  --lh:1.4;',
    '}',
    // Kanvastan gelen şekil uygulamanın palet jetonlarını kullanıyor; tanımsız
    // var() kalıtılan `stroke` için `none` demek → çizim GÖRÜNMEZ olur.
    '.appfig{--accent-primary:#24425f;--accent-success:#2e7d4f;--accent-warning:#c8781e;',
    '  --accent-danger:#a8321f;--text-secondary:#3c4350;--text-muted:#5a6270;',
    '  --bg-input:#fff;--border-color:#c9cdd3;--radius-sm:2px;--fs-tiny:11px;--fs-micro:10px;}',
    '*{box-sizing:border-box}',
    // ── KALINLIK GÖMÜLÜ AĞIRLIKLARA BAĞLI ──────────────────────────────────
    // Belge çevrimdışı: yazı tipleri `mount-report-assets.js` içinde GÖMÜLÜ ve
    // küme sınırlı — Archivo 400/700, Source Serif 4 400/600, IBM Plex Mono
    // 400/500. Olmayan bir ağırlık istendiğinde tarayıcı **sentetik kalın**
    // üretir: glifleri kendi kendine şişirir. Eş aralıklı bir yüzde bu, 9 px
    // civarında harflerin birbirine girmesi demek — kullanıcının "yazılar
    // komik bir şekilde kötü duruyor" dediği şeyin ölçülebilir yarısı.
    // Kural: Archivo → 700, serif → 600, mono → 500. Kapı bunu tutuyor.
    'b,strong{font-weight:600}',                       // Source Serif 4 tavanı
    'body{margin:0;background:#8d9199;color:var(--ink);',
    "  font-family:'Source Serif 4',Georgia,serif;font-size:var(--f-md);line-height:var(--lh);",
    '  -webkit-font-smoothing:antialiased}',

    // ── SAYFA ── A4 dikey.
    // `overflow:hidden` + sabit `height` bir kez denendi ve SESSİZ: ekranda
    // taşan içerik kırpılıyor, baskıda ise `height:auto` yüzünden altıncı
    // sayfaya düşüyordu — iki yüzey birbirinden habersiz, ikisi de uyarısız.
    // `min-height` ile sayfa taşarsa EKRANDA da uzuyor: kardeşlerinden uzun
    // duran bir sayfa gözle görünür, yani hata kendini gösterir.
    '.sheet{position:relative;width:210mm;min-height:297mm;margin:9mm auto;padding:11mm 12mm 8mm;',
    '  background:var(--paper);box-shadow:0 3px 14px rgba(0,0,0,.30);',
    '  display:flex;flex-direction:column}',
    '.sheet-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:6px}',

    // ── ANTET ──
    '.hdr{display:grid;grid-template-columns:82px 1fr auto;align-items:center;gap:12px}',
    '.hdr-logo svg{width:74px;height:26px;display:block}',
    ".hdr-org{font-family:'Archivo',sans-serif;font-size:var(--f-xs);font-weight:700;",
    '  line-height:1.3;color:var(--dim)}',
    ".hdr-title{font-family:'Archivo',sans-serif;font-size:var(--f-xs);line-height:1.3;",
    '  color:var(--dim);text-align:right}',
    '.hdr-title b{display:block;font-size:var(--f-sm);font-weight:700;color:#000;',
    '  letter-spacing:.01em}',
    '.hdr-sub{display:flex;justify-content:space-between;gap:12px;font-size:var(--f-xs);',
    '  color:var(--dim);border-top:2px solid var(--prusya);padding-top:2px;margin-top:5px}',

    // ── SAYFA BAŞLIĞI ── belgenin tek büyük puntosu
    '.h1{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;',
    '  border-bottom:1px solid var(--rule);padding-bottom:3px;margin:8px 0 2px}',
    ".h1 h1{font-family:'Archivo',sans-serif;font-size:var(--f-xl);font-weight:700;",
    '  letter-spacing:-.01em;margin:0;color:#000}',
    '.h1 span{font-size:var(--f-sm);color:var(--dim)}',

    // ── BLOK ──
    '.blk{margin:0}',
    ".bt{font-family:'Archivo',sans-serif;font-size:var(--f-lg);font-weight:700;color:#000;",
    '  margin:0 0 3px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;',
    '  border-left:3px solid var(--prusya);padding-left:6px}',
    '.kvi{font-weight:400;color:var(--dim);font-size:var(--f-xs);',
    "  font-family:'Source Serif 4',Georgia,serif}",
    '.stamp{font-weight:700;color:var(--warn);background:#fdf4e6;border:1px solid var(--warn);',
    "  padding:0 5px;font-size:var(--f-xs);letter-spacing:.06em;text-transform:uppercase;",
    "  font-family:'Archivo',sans-serif}",
    // Açıklama: tablonun ALTINDA, ölçülü satır uzunluğuyla.
    '.nt{font-size:var(--f-xs);color:var(--dim);line-height:1.45;padding:3px 2px 0;',
    '  max-width:64em}',
    '.nt b{color:var(--ink)}',

    // ── TABLO ── tek çerçeve dili: dış çizgi koyu, iç çizgiler açık, zebra.
    // Her hücreyi kutulamak (eski hâl) sayfayı ızgaraya çeviriyor ve gözün
    // satır takip etmesini zorlaştırıyordu.
    'table.gt{border-collapse:collapse;width:100%;font-size:var(--f-sm);',
    '  border:1px solid var(--rule)}',
    'table.gt th,table.gt td{padding:2px 5px;text-align:right;white-space:nowrap;',
    "  font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;",
    '  border-bottom:1px solid var(--soft)}',
    "table.gt th{background:var(--head);font-family:'Archivo',sans-serif;font-weight:700;",
    '  text-align:right;font-size:var(--f-xs);line-height:1.2;color:#000;',
    '  border-bottom:1px solid var(--rule);vertical-align:bottom}',
    'table.gt th.l,table.gt td.l{text-align:left}',
    // ETİKET SÜTUNU ARTAN GENİŞLİĞİ YUTMAZ. Otomatik yerleşimde `width:100%`
    // olan bir tabloda boşluğun tamamı ilk (metin) sütuna gidiyor: sayısal
    // sütunlar birbirine yapışıyor, ilk sütunun sağında yarım tablo boş
    // kalıyor. `width:1px` + `nowrap` o sütunu METNİ KADAR yapar, kalanı
    // sayısal sütunlar paylaşır.
    'table.gt th.l,table.gt td.l{width:1px}',
    "table.gt td.l{font-family:'Source Serif 4',Georgia,serif;font-weight:600}",
    'table.gt tr:nth-child(even) td{background:var(--zebra)}',
    'table.gt tr:last-child td{border-bottom:none}',
    'table.gt td.hi,table.gt th.hi{background:var(--hl)}',
    'table.gt tr:nth-child(even) td.hi{background:#fdecb8}',
    '.hi{background:var(--hl);padding:0 3px}',
    // konum tablosunda büyüklük adı ve birimi tek hücrede, iki hizada
    'table.gt td.l .q{display:inline}',
    'table.gt td.l .u{color:var(--dim);font-weight:400;font-size:var(--f-xs);margin-left:4px}',
    "table.gt .err{color:var(--dim)}",
    // etiket/değer tablosu — iki sütun, değerler tek kenarda
    'table.gt.kvt2 td{font-size:var(--f-sm)}',
    'table.gt.kvt2 td.l{width:62%}',

    // ── KÜNYE KARTI ──
    ".kvblk{border:1px solid var(--line);border-top:2px solid var(--prusya);padding:4px 7px 3px;",
    '  margin:0 0 7px}',
    ".kvt{font-family:'Archivo',sans-serif;font-size:var(--f-sm);font-weight:700;color:#000;",
    '  margin-bottom:2px}',
    '.kvr{display:flex;justify-content:space-between;gap:10px;padding:1px 0;',
    '  border-bottom:1px dotted var(--soft);font-size:var(--f-sm)}',
    '.kvr:last-child{border-bottom:none}',
    '.kvr span{color:var(--dim)}',
    ".kvr b{font-family:'IBM Plex Mono',monospace;font-weight:500;text-align:right;",
    '  font-variant-numeric:tabular-nums;white-space:nowrap}',

    // ── KRİTİK SONUÇ KARTLARI (sayfa 1) ──
    '.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:2px 0 0}',
    '.card{border:1px solid var(--line);border-top:3px solid var(--prusya);padding:4px 6px 5px;',
    '  min-width:0}',
    '.card.ok{border-top-color:var(--ok)}.card.no{border-top-color:var(--bad)}',
    '.card.uy{border-top-color:var(--warn)}',
    ".card .ck{font-family:'Archivo',sans-serif;font-size:var(--f-xs);font-weight:700;",
    '  color:var(--dim);text-transform:uppercase;letter-spacing:.04em;line-height:1.2}',
    ".card .cv{font-family:'IBM Plex Mono',monospace;font-size:var(--f-lg);font-weight:500;",
    '  color:#000;margin:2px 0 1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.card.no .cv{color:var(--bad)}.card.uy .cv{color:var(--warn)}',
    '.card .cs{font-size:var(--f-xs);color:var(--dim);line-height:1.3}',

    // ── KOD KÜNYESİ ── kısaltma ancak karşılığı aynı sayfadaysa okunur
    '.legend{display:flex;flex-wrap:wrap;gap:3px 14px;font-size:var(--f-xs);color:var(--dim);',
    '  border-top:1px solid var(--soft);padding-top:3px;margin-top:auto}',
    ".legend b{font-family:'IBM Plex Mono',monospace;font-weight:500;color:#000;margin-right:3px}",

    // ── UYARI KUTUSU ──
    '.warnbox{border:1px solid var(--warn);border-left:3px solid var(--warn);background:#fdf9f2;',
    '  padding:4px 8px;font-size:var(--f-xs);color:var(--ink);line-height:1.4}',
    ".warnbox b{font-family:'Archivo',sans-serif;font-weight:700;display:block;margin-bottom:1px}",
    '.warnbox ul{margin:0;padding-left:14px}',

    // ── SÜTUNLAR ── `c58` = şema geniş, künye dar
    '.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}',
    '.cols.c58{grid-template-columns:1.35fr 1fr}',
    '.col{min-width:0}',

    // ── ŞEKİL ── SVG hiçbir zaman kutusundan taşmaz
    '.fig{margin:0;overflow:hidden}',
    '.fig svg{width:100%;height:auto;display:block;max-width:100%}',
    ".fig text{font-family:'IBM Plex Mono',ui-monospace,monospace}",
    '.nofig{border:1px dashed var(--line);padding:10px;color:var(--dim);',
    '  font-size:var(--f-sm);text-align:center}',

    '.bad{color:var(--bad);font-weight:500}.ok{color:var(--ok)}',
    // Hükmü VEREMEYEN sayı: gizlenmez, ama vurgulanmaz da.
    '.pas{color:#8a919b}',
    ".kh{font-weight:400;font-size:var(--f-xs);color:var(--dim);text-transform:none;",
    '  letter-spacing:0}',
    // Sayısal hücreler MONO (tavan 500), ilk sütun SERİF (tavan 600).
    'table.gt td b{font-weight:500}',
    'table.gt td.l b{font-weight:600}',

    // ── KAPSAM ── ne var / ne yok, yan yana
    '.scope{border:1px solid var(--line);border-left:3px solid var(--ok);padding:4px 8px 5px;',
    '  font-size:var(--f-xs);line-height:1.45;height:100%}',
    '.scope.out{border-left-color:var(--dim)}',
    ".scope b{font-family:'Archivo',sans-serif;font-weight:700;font-size:var(--f-sm);display:block;",
    '  margin-bottom:2px;color:#000}',
    '.scope ul{margin:0;padding-left:13px}',
    '.scope li{margin-bottom:1px}',

    // ── ALT ŞERİT ──
    '.footline{display:flex;justify-content:space-between;gap:12px;font-size:var(--f-xs);',
    '  color:var(--dim);border-top:1px solid var(--rule);padding-top:3px;margin-top:6px}',

    '@media print{',
    '  body{background:#fff}',
    '  .sheet{width:auto;height:auto;min-height:0;margin:0;box-shadow:none;padding:0;',
    '    page-break-after:always;break-after:page;overflow:visible}',
    '  .sheet:last-child{page-break-after:auto;break-after:auto}',
    '  .blk,table,.card,.kvblk{break-inside:avoid}',
    '  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}',
    '}',
    '@page{size:A4 portrait;margin:11mm 12mm}'
  ].join('\n');
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veFeadSummaryHTML: veFeadSummaryHTML,
    _fsrSheet1: _fsrSheet1, _fsrSheet2: _fsrSheet2, _fsrSheet3: _fsrSheet3,
    _fsrSheet4: _fsrSheet4, _fsrSheet5: _fsrSheet5,
    _fsrPeak: _fsrPeak, _fsrLogo: _fsrLogo, _fsrCss: _fsrCss, _fsrLayout: _fsrLayout,
    _fsrCodes: _fsrCodes, _fsrCodeLegend: _fsrCodeLegend,
    _fsrConstCols: _fsrConstCols, _fsrStripCols: _fsrStripCols, _fsrConstNote: _fsrConstNote,
    VE_FSR_SHEETS: VE_FSR_SHEETS, VE_FSR_PEAK_BAND: VE_FSR_PEAK_BAND
  };
}
