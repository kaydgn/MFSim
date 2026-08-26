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

var VE_FSR_SHEETS = [
  'Sonuç Özeti',
  'Geometrik Analiz, Sayfa 1 / 2',
  'Geometrik Analiz, Sayfa 2 / 2',
  'Kayma / Gerginlik Analizi',
  'Kasnak Hubload Analizi (Ortalama)'
];

// Tepe yük modelinin ÖLÇÜLMÜŞ sapması (AG00976 ↔ Gates tepe tablosu).
// Çekirdeğin `peakEstimate`'i yarı-statik; kendi notu "gergi kolu dinamigi
// dahil DEGIL" diyor. Kombinasyon taraması yapılsa bile yakınsamıyor.
var VE_FSR_PEAK_BAND = '−%10,5 … +%22,8';

// ─── KÜÇÜK YARDIMCILAR ──────────────────────────────────────────────────────
function _fsrLogo(){
  // Tedarikçi çıktısında üreticinin markası nerede duruyorsa burada müşterinin
  // markası duruyor. Vektör: belge tek dosya ve çevrimdışı.
  return '<svg viewBox="0 0 132 46" role="img" aria-label="BMC">'
    + '<text x="2" y="36" font-family="Archivo, Arial Narrow, sans-serif" font-size="42"'
    + ' font-weight="800" font-stretch="75%" letter-spacing="-1" fill="#1d1d1b">BMC</text></svg>';
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
        { posMode: 'mean', compass: true, pivot: true, arrows: false });
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
function _fsrT(head, rows, opt){
  opt = opt || {};
  var h = '<table class="gt' + (opt.cls ? ' ' + opt.cls : '') + '">';
  if(opt.span) h += '<tr>' + opt.span + '</tr>';
  if(head) h += '<tr>' + head.map(function(c){ return '<th>' + c + '</th>'; }).join('') + '</tr>';
  rows.forEach(function(r){
    h += '<tr>' + r.map(function(c, i){
      return '<td' + (i === 0 ? ' class="l"' : '') + '>' + c + '</td>'; }).join('') + '</tr>';
  });
  return h + '</table>';
}
// Etiket/değer künyesi (Belt Data, Tensioner Data kalıbı)
function _fsrKV(baslik, rows, vurgu){
  var h = '<div class="kvblk"><div class="kvt' + (vurgu ? ' hl' : '') + '">' + baslik + '</div>';
  rows.forEach(function(r){
    h += '<div class="kvr"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
  });
  return h + '</div>';
}

// ═══════════════════ SAYFA 1 — SONUÇ ÖZETİ ══════════════════════════════════
function _fsrSheet1(R, node){
  var sys = R.build && R.build.sys, b = (sys && sys.belt) || {};
  var life = R.life || {}, duty = R.duty || [];
  var dcTop = 0; duty.forEach(function(r){ dcTop += _frNum(r.dcPct) || 0; });

  var h = '<div class="cols">';
  // ── sol sütun ────────────────────────────────────────────────────────────
  h += '<div class="col">';
  h += _fsrIdBlock(R, node);
  h += _fsrLayout(R, 430, 300);
  h += '<div class="blk"><div class="bt">Kayış Ömrü B10</div>'
     + _fsrT(['Çevrim payı', 'Yorulma modeli', 'Saat'], [[
         _frPct(dcTop, 2), _frEsc(R.fatigueModel || '—'),
         '<b>' + _frF(life.hoursB10, 0) + '</b>'
       ]], { cls: 'mini' })
     + (life.inValidRange ? '' :
        '<div class="nt">Kasnak çapı geçerlilik penceresinin dışında ('
        + _frEsc((life.outOfRange || []).join(', ')) + '); ampirik düzeltmeli değer <b>'
        + _frF(life.hoursB10Corrected, 0) + ' saat</b>.</div>')
     + '</div>';
  h += _fsrPeakBlock(R);
  h += '</div>';

  // ── sağ sütun ────────────────────────────────────────────────────────────
  h += '<div class="col">';
  h += _fsrKV('Kayış Verisi', [
    ['Kayış kodu', _frEsc((b.brand ? b.brand + ' ' : '') + (b.ribs || '') + (b.profile || ''))],
    ['Kaburga sayısı / kord', _frF(b.ribs, 0) + ' / polyester'],
    ['Efektif kayış boyu (ISO 9981)', _frFs(b.effLength, 1)]
  ], true);
  h += _fsrKV('Gergi Verisi', [
    ['Tip', 'Otomatik'],
    ['Tasarım gerginliği', _frF(sys && sys.designTensionN, 0) + ' N']
  ]);
  h += '<div class="blk"><div class="bt c">Kayış Gerginlik Kontrolü</div>'
     + _fsrFig(typeof _frTensionFigure === 'function' ? _frTensionFigure : null, R, 500, 320)
     + '</div>';
  h += '<div class="blk"><div class="bt c">Doğal Frekans Haritası</div>'
     + _fsrFig(typeof _frFreqFigure === 'function' ? _frFreqFigure : null, R, 500, 320)
     + '</div>';
  h += _fsrFatigueBlock(R);
  h += _fsrAxialBlock(R);
  h += '</div></div>';
  return h;
}

// Tepe yük — düzen tedarikçi çıktısıyla aynı, damgası üstünde.
function _fsrPeakBlock(R){
  var pk = _fsrPeak(R);
  var h = '<div class="blk"><div class="bt">Tepe Gerginlik ve Hubload'
        + ' <span class="stamp">kalibre değil</span></div>';
  if(!pk) return h + '<div class="nt">Tepe yük tahmini üretilemedi.</div></div>';
  var rows = pk.rows.map(function(r){
    return [_frEsc(r.name), _frF(pk.engineRpm, 0), _frF(r.accelRpmS, 0),
            _frF(r.tensionN, 0), _frF(r.hubloadN, 1),
            _frF(r.dirDeg, 0) + ' / ' + _frF(r.wrapDeg, 0)];
  });
  h += _fsrT(['Kasnak', 'Motor<br>d/d', 'İvme<br>d/d/s', 'Gerginlik', 'Hubload', 'Yön<br>/ Sarım'],
             rows, { cls: 'mini' });
  h += '<div class="nt"><b>Not:</b> tepe yükler, aksesuar güçlerinin %100/%10 kombinasyonları ve '
     + '± ivme taranarak kasnak başına en büyük değerden alınır. Model <b>yarı-statiktir ve gergi '
     + 'kolu dinamiğini içermez</b>; tedarikçi çıktısına karşı ölçülen sapma ' + VE_FSR_PEAK_BAND
     + '. Yatak/braket seçiminde tek başına kullanılmamalıdır.</div></div>';
  return h;
}

function _fsrFatigueBlock(R){
  var f = R.fatigue;
  if(!f || !f.perPulley || !f.perPulley.length) return '';
  var rows = f.perPulley.map(function(p){
    return [_frEsc(p.name), _frFs(p.dEffMm, 1),
            p.contact === 'back' ? 'sırt' : 'kaburgalı', _frFs(p.sharePct, 2)];
  });
  return '<div class="blk"><div class="bt">Kaburga Yorulma Dağılımı</div>'
    + _fsrT(['Kasnak', 'Efektif çap', 'Temas', 'Pay %'], rows, { cls: 'mini' })
    + '<div class="nt">Payı yüksek olan kasnak, çapı büyütülerek ömrü en çok uzatacak olandır. '
    + 'Bu dağılım bir ORANDIR ve mutlak ömrün çap penceresinden bağımsızdır.</div></div>';
}

// İzin verilen eksenel kaçıklık — çekirdekte hesap VAR ama düz kasnakların
// açısal kaçıklığını (ψ) GİRDİ olarak istiyor ve MFSim o alanı sormuyor.
// ψ=0 ile basılan sayı iyimser bir yalan olurdu; sebep yazılıyor.
function _fsrAxialBlock(R){
  return '<div class="blk"><div class="bt">İzin Verilen Kasnak Eksenel Kaçıklığı</div>'
    + '<div class="nt">Bu tablo, sırttan temas eden kasnakların <b>açısal kaçıklığını (ψ)</b> girdi '
    + 'olarak ister; tedarikçi onu montaj ölçümünden alır. MFSim bu alanı henüz sormuyor, '
    + 'ψ = 0 ile basılacak pay ise gerçekte olduğundan <b>iyimser</b> çıkardı — bu yüzden '
    + 'hesaplanmıyor.</div></div>';
}

// ═══════════════════ SAYFA 2 — GEOMETRİK ANALİZ 1/2 ═════════════════════════
function _fsrSheet2(R, node){
  var sys = R.build && R.build.sys, b = (sys && sys.belt) || {}, t = (sys && sys.tensioner) || {};
  var A = R.analysis || {}, g = A.geometry || [];

  var h = '<div class="cols">';
  h += '<div class="col">' + _fsrIdBlock(R, node) + _fsrLayout(R, 430, 320) + '</div>';

  h += '<div class="col">';
  var mean = (A.positions || []).filter(function(p){ return p.position === 'Mean' && !p.error; })[0];
  var lay = sys.pulleys.map(function(p){
    var sirt = (p.contact === 'back'), x = p.x, y = p.y, isim = _frEsc(p.name);
    if(p.tensioner && mean){ x = mean.idlerX; y = mean.idlerY; isim += ' †'; }
    return [isim, _frFs(x, 2), _frFs(y, 2),
            sirt ? _frFs(p.od, 2) : '', _frFs(_frNum(p.rPitch) * 2, 2),
            _frFs(_frNum(p.rEff) * 2, 2)];
  });
  h += '<div class="blk"><div class="bt">Yerleşim Verisi</div>'
     + _fsrT(['Kasnak', 'X', 'Y', 'Düz', 'Pitch', 'Efektif'], lay, { cls: 'mini' })
     + (mean ? '<div class="nt">† Gergi kasnağının konumu bir girdi değildir: kol açısından türeyen '
             + 'çalışma (Ortalama) merkezidir.</div>' : '') + '</div>';
  h += _fsrKV('Kayış Verisi', [
    ['Kayış kodu', _frEsc((b.brand ? b.brand + ' ' : '') + (b.ribs || '') + (b.profile || ''))],
    ['Kaburga sayısı / kord', _frF(b.ribs, 0) + ' / polyester'],
    ['Uzama ve aşınma payı (boyun %)', _frFs(_frNum(b.wearPct) * 100, 2)],
    ['Kayış boy toleransı (±)', _frFs(b.tolerance, 2)]
  ]);
  h += _fsrKV('Gergi Verisi', [
    ['Tip', 'Otomatik'],
    ['Tasarım gerginliği', _frF(sys && sys.designTensionN, 0) + ' N'],
    ['Pivot {X, Y}', _frFs(t.pivot && t.pivot[0], 2) + ' , ' + _frFs(t.pivot && t.pivot[1], 2)],
    ['Kol boyu', _frFs(t.armLength, 1)],
    ['Yay ortalama momenti', _frFs(_frNum(t.preloadNm)
        + _frNum(t.rateNmPerDeg) * _frNum(A.meanRelDeg), 2)],
    ['Yay ön yükü', _frFs(t.preloadNm, 2)],
    ['Yay oranı', _frFs(t.rateNmPerDeg, 3)]
  ], true);
  h += '</div></div>';

  h += '<div class="band">SONUÇLAR</div>';
  h += '<div class="cols">';
  var geo = g.map(function(x){
    return [_frEsc(x.name), _frFs(x.exitSpanMm, 1), _frFs(x.wrapDeg, 1), _frFs(x.speedRatio, 3)];
  });
  h += '<div class="col"><div class="blk"><div class="bt">Kayış Tahrik Sistemi Geometrisi</div>'
     + _fsrT(['Kasnak', 'Açıklık<br>boyu', 'Sarım<br>açısı', 'Hız oranı<br>(motor ref.)'], geo)
     + '<div class="nt">Efektif tahrik boyu <b>' + _frFs(A.driveLenMm, 1) + ' mm</b> · gereken kayış '
     + 'boyu <b>' + _frFs(A.requiredBeltMm, 1) + ' mm</b>.</div></div></div>';
  h += '<div class="col"><div class="blk"><div class="bt c">Kayış Gerginlik Kontrolü</div>'
     + _fsrFig(typeof _frTensionFigure === 'function' ? _frTensionFigure : null, R, 500, 320)
     + '</div></div>';
  h += '</div>';
  return h;
}

// ═══════════════════ SAYFA 3 — GEOMETRİK ANALİZ 2/2 ═════════════════════════
function _fsrSheet3(R, node){
  var A = R.analysis || {}, pos = A.positions || [], T = A.tensioner || {};
  var TR = (typeof VE_FEAD_POSITIONS !== 'undefined')
    ? VE_FEAD_POSITIONS.reduce(function(o, p){ o[p.core] = p.label; return o; }, {}) : {};

  var h = _fsrIdBlock(R, node);
  h += '<div class="blk"><div class="bt hl">Gergi Geometrisi</div>';
  h += '<div class="kvr wide"><span>Kayış take-up / gergi kolu oranı</span><b>'
     + _frFs(T.takeupMmPerDeg, 3) + ' mm/°</b></div>';

  var head = ['Konum tanımı'].concat(pos.map(function(p){
    return (p.position === 'Mean' ? '<span class="hi">' : '<span>')
         + _frEsc(TR[p.position] || p.position) + '</span>'; }));
  function sat(k, f, d){
    return [k].concat(pos.map(function(p){
      return p.error ? 'Hata' : _frFs(f(p), d); }));
  }
  var rows = [
    sat('Kol konumu',                 function(p){ return p.absDeg; }, 1),
    sat('Gergi kasnağı X',            function(p){ return p.idlerX; }, 1),
    sat('Gergi kasnağı Y',            function(p){ return p.idlerY; }, 1),
    sat('Hubload–kol açısı',          function(p){ return p.betaDeg; }, 1),
    sat('Hubload yönü',               function(p){ return p.hubDirDeg; }, 1),
    sat('Hubload',                    function(p){ return p.hubloadN; }, 1),
    sat('Gerginlik',                  function(p){ return p.tensionN; }, 1),
    sat('Gergi sarım açısı',          function(p){ return p.wrapDeg; }, 1),
    sat('Efektif tahrik boyu',        function(p){ return p.driveLenMm; }, 1),
    sat('Gereken efektif kayış boyu', function(p){ return p.requiredBeltMm; }, 1)
  ];
  var span = '<th></th><th colspan="' + pos.length + '">Kayış tahrik boyu</th>';
  h += _fsrT(head, rows, { span: span, cls: 'pos' });
  h += '<div class="nt"><b>Load bir mekanik durdurucudur</b>, çalışma noktası değildir: orada sarım '
     + 'sıfıra yaklaştığı için gerginlik tekilleşir. Çalışma noktası <b>Ortalama</b> sütunudur.</div>';
  h += '</div>';

  h += '<div class="cols">';
  h += '<div class="col"><div class="blk"><div class="bt c">Kayış Take-up</div>'
     + _fsrFig(typeof _frTakeupChartRaw === 'function' ? _frTakeupChartRaw : null, R, 460, 300)
     + '</div></div>';
  h += '<div class="col">' + _fsrSpanFreqBlock(R) + '</div>';
  h += '</div>';
  return h;
}

// Take-up grafiğinin yanındaki boşluğa: açıklık frekansları (tedarikçi bunu
// ayrı bir sayfada verir; burada boş kalan sütuna konuyor).
function _fsrSpanFreqBlock(R){
  var duty = (R.analysis && R.analysis.duty) || [];
  var d0 = duty[0];
  if(!d0 || !d0.frequencies || !d0.frequencies.length) return '';
  var rows = d0.frequencies.map(function(s0, i){
    var L = NaN, lo = Infinity, hi = -Infinity, flut = false;
    duty.forEach(function(d){
      var s = (d.frequencies || [])[i]; if(!s) return;
      L = _frNum(s.LMm);
      var f = (s.fHz && s.fHz.length) ? _frNum(s.fHz[0]) : NaN;
      if(Number.isFinite(f)){ if(f < lo) lo = f; if(f > hi) hi = f; }
      if(s.flutter) flut = true;
    });
    return [_frEsc(s0.span), _frFs(L, 1), _frFs(lo, 1) + ' – ' + _frFs(hi, 1),
            flut ? '<b class="bad">var</b>' : '✓'];
  });
  var f1 = _frNum(d0.firingHz), f2 = _frNum(duty[duty.length - 1].firingHz);
  return '<div class="blk"><div class="bt">Serbest Açıklık Titreşimi</div>'
    + _fsrT(['Açıklık', 'Boy', 'f₁ aralığı [Hz]', 'Çırpınma'], rows, { cls: 'mini' })
    + '<div class="nt">Ateşleme frekansı <b>' + _frFs(f1, 1) + ' – ' + _frFs(f2, 1) + ' Hz</b>. '
    + 'Bunlar açıklıkların <b>enine</b> titreşimidir.</div></div>';
}

// ═══════════════════ SAYFA 4 — KAYMA / GERGİNLİK ════════════════════════════
function _fsrSheet4(R, node){
  var duty = (R.analysis && R.analysis.duty) || [];
  var h = _fsrIdBlock(R, node) + '<div class="band">SONUÇLAR</div>';
  if(!duty.length) return h + '<div class="nofig">Çalışma çevrimi tanımlı değil.</div>';

  var sf = _frNum(R.serviceFact);
  // Kayma duyarlılığı — tedarikçi sayfasının biçimi: kasnak başına EN KRİTİK
  // yük kombinasyonu ve ivme. Kombinasyonu tepe taraması zaten buluyor.
  var pk = _fsrPeak(R);
  if(pk && pk.yuk.length){
    var rows = pk.rows.map(function(r){
      var c = [_frEsc(r.name), _frF(r.accelRpmS, 0)];
      pk.yuk.forEach(function(k){ c.push(_frF(r.combo[k] * 100, 0)); });
      c.push('—');
      return c;
    });
    var span = '<th></th><th colspan="' + (1 + pk.yuk.length) + '">En kritik yük koşulu</th>'
             + '<th>Gereken artış</th>';
    h += '<div class="blk"><div class="bt">Kayma Duyarlılığı</div>'
       + _fsrT(['Kasnak', 'İvme<br>d/d/s'].concat(pk.yuk.map(function(k){
           return _frEsc(k) + '<br>yük %'; })).concat(['Gerginlik / sarım']), rows, { span: span })
       + '<div class="nt">"Gereken artış" sütunu, emniyet faktörü eşiğin altına düşen kasnaklar için '
       + 'doldurulur; bu modelde hiçbir kasnak eşiğin altında değilse boş kalır.</div></div>';
  }

  var adlar = (duty[0].slip || []).map(function(s){ return _frEsc(s.name); });
  var mrows = duty.map(function(d){
    var c = [_frF(d.engineRpm, 0)];
    (d.slip || []).forEach(function(s){
      var v = _frNum(s.SF);
      var kotu = Number.isFinite(sf) && sf > 0 && Number.isFinite(v) && v < sf;
      c.push(kotu ? '<b class="bad">' + _frFs(v, 2) + '</b>' : _frFs(v, 2));
    });
    return c;
  });
  h += '<div class="cols"><div class="col">';
  h += '<div class="blk"><div class="bt">Kayma Emniyet Faktörü'
     + (Number.isFinite(sf) && sf > 0 ? ' <span class="kvi">alt sınır ' + _frF(sf, 2) + '</span>' : '')
     + '</div>' + _fsrT(['Motor d/d'].concat(adlar), mrows, { cls: 'mini' });
  var st = (typeof _frSlipStats === 'function') ? _frSlipStats(R) : null;
  if(st && Number.isFinite(st.loadedMin)){
    var ok = !(Number.isFinite(sf) && sf > 0) || st.loadedMin >= sf;
    h += '<div class="nt ' + (ok ? 'ok' : 'bad') + '"><b>Hüküm:</b> yük taşıyan kasnakların en düşük '
       + 'emniyet faktörü <b>' + _frFs(st.loadedMin, 2) + '</b>'
       + (st.loadedName ? ' (' + _frEsc(st.loadedName) + ')' : '') + (ok ? ' ✓' : ' ✗')
       + '. Yük taşımayan avara ve gergide gerginlik oranı 1\'e yakındır; oradaki sayı bir marj '
       + 'değil, o sarım açısının <b>kapasitesidir</b>.</div>';
  }
  h += '</div></div>';
  h += '<div class="col"><div class="blk"><div class="bt c">Kayma Emniyet Faktörü</div>'
     + _fsrFig(typeof _frSlipFigure === 'function' ? _frSlipFigure : null, R, 500, 330,
               Number.isFinite(sf) && sf > 0 ? sf : undefined)
     + '</div></div></div>';
  return h;
}

// ═══════════════════ SAYFA 5 — HUBLOAD ANALİZİ ══════════════════════════════
function _fsrSheet5(R, node){
  var duty = (R.analysis && R.analysis.duty) || [], raw = R.duty || [];
  var h = '<div class="cols"><div class="col">' + _fsrIdBlock(R, node) + '</div>'
        + '<div class="col">' + _fsrLayout(R, 430, 280) + '</div></div>';
  if(!duty.length) return h + '<div class="nofig">Çalışma çevrimi tanımlı değil.</div>';

  var sys = R.build && R.build.sys, surucu = '';
  if(sys) sys.pulleys.forEach(function(p){ if(p.crank) surucu = p.name; });
  var yukAd = (R.pulleyNames || []).filter(function(n){ return n !== surucu; });
  var adlar = (duty[0].perPulley || []).map(function(q){ return _frEsc(q.name); });
  var dcTop = 0; raw.forEach(function(r){ dcTop += _frNum(r.dcPct) || 0; });
  var basSon = ' — çevrim payı ' + _frPct(dcTop, 0);

  var lc = raw.map(function(r){
    var c = [_frFs(r.dcPct, 2), _frF(r.engineRpm, 0), _frF(r.degC, 0)];
    yukAd.forEach(function(n){
      var v = _frNum(r.loadsKw && r.loadsKw[n]);
      c.push(Number.isFinite(v) ? _frFs(v, 2) : '—');
    });
    return c;
  });
  h += '<div class="cols"><div class="col">';
  h += '<div class="blk"><div class="bt hl">Yük Koşulları' + basSon + '</div>'
     + _fsrT(['%', 'Motor<br>d/d', 'T<br>°C'].concat(yukAd.map(function(n){ return _frEsc(n); })),
             lc, { cls: 'mini' })
     + '<div class="nt">Sürücü kasnağın gücü bir girdi değildir; aksesuar güçlerinin toplamı olarak '
     + 'hesaplanır.</div></div></div>';

  function mat(baslik, oku, dec){
    var rows = duty.map(function(d, k){
      var c = [_frFs(raw[k] ? raw[k].dcPct : NaN, 2), _frF(d.engineRpm, 0)];
      adlar.forEach(function(n, i){ c.push(_frFs(oku(d, i), dec)); });
      return c;
    });
    return '<div class="blk"><div class="bt hl">' + baslik + basSon + '</div>'
         + _fsrT(['%', 'Motor<br>d/d'].concat(adlar), rows, { cls: 'mini' }) + '</div>';
  }
  h += '<div class="col">'
     + mat('Ortalama Hubloadlar', function(d, i){ return ((d.hubloads || [])[i] || {}).FN; }, 0)
     + '</div></div>';
  h += mat('Ortalama Gerginlikler', function(d, i){ return (d.perPulley[i] || {}).exitTensionN; }, 0);
  h += '<div class="nt">Gerginlik değeri, o kasnaktan <b>sonraki</b> açıklığın gerginliğidir. Hubload '
     + 'kasnak yatağına binen bileşke kuvvettir; yön +X\'ten saat yönünün tersine ölçülür.</div>';
  return h;
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

function _fsrCss(){
  return [
    ':root{--ink:#1b1e24;--paper:#fff;--line:#9aa0a8;--soft:#d8dce1;--prusya:#24425f;',
    '  --band:#c0392b;--head:#eef2f6;--warn:#8a5a1e;--bad:#a8321f;--ok:#2e7d4f;--hl:#fff6b8;}',
    // Kanvastan gelen şekil uygulamanın palet jetonlarını kullanıyor.
    '.appfig{--accent-primary:#24425f;--accent-success:#2e7d4f;--accent-warning:#c8781e;',
    '  --accent-danger:#a8321f;--text-secondary:#3c4350;--text-muted:#5a6270;',
    '  --bg-input:#fff;--border-color:#c9cdd3;--radius-sm:2px;--fs-tiny:11px;--fs-micro:10px;}',
    '*{box-sizing:border-box}',
    'body{margin:0;background:#8d9199;color:var(--ink);',
    "  font-family:'Source Serif 4',Georgia,serif;font-size:10px;line-height:1.35}",
    // A4 DİKEY — tedarikçi çıktısının sayfası da dikey.
    '.sheet{position:relative;width:210mm;min-height:297mm;margin:8mm auto;padding:8mm 9mm 6mm;',
    '  background:var(--paper);box-shadow:0 2px 12px rgba(0,0,0,.28);display:flex;flex-direction:column}',
    '.sheet-body{flex:1}',
    '.hdr{display:grid;grid-template-columns:86px 1fr 1.25fr;align-items:center;gap:8px}',
    '.hdr-logo svg{width:78px;height:27px;display:block}',
    ".hdr-org{font-family:'Archivo',sans-serif;font-size:9px;font-weight:600;line-height:1.3}",
    ".hdr-title{font-family:'Archivo',sans-serif;font-size:14px;line-height:1.25;color:#000}",
    '.hdr-title b{font-size:15px}',
    '.hdr-sub{display:flex;justify-content:space-between;font-size:7.5px;color:#3c4350;',
    '  border-top:1px solid var(--line);border-bottom:1px solid var(--line);',
    '  padding:1px 0;margin:3px 0 5px}',
    ".idblk{font-family:'Archivo',sans-serif;font-weight:700;font-size:11.5px;line-height:1.5;",
    '  color:#000;margin-bottom:5px}',
    '.cols{display:grid;grid-template-columns:1fr 1fr;gap:7px;align-items:start}',
    '.col{min-width:0}',
    '.band{background:#fff;border-top:1.5px solid var(--band);border-bottom:1.5px solid var(--band);',
    "  color:var(--band);font-family:'Archivo',sans-serif;font-weight:700;font-size:10px;",
    '  padding:1px 3px;margin:6px 0 5px}',
    '.blk{margin:0 0 7px}',
    ".bt{font-family:'Archivo',sans-serif;font-size:10px;font-weight:700;color:#000;",
    '  margin-bottom:2px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
    '.bt.c{justify-content:center}',
    '.bt.hl,.kvt.hl{background:var(--hl);display:inline-block;padding:0 4px}',
    '.kvi{font-weight:400;color:#3c4350;font-size:8.5px}',
    '.stamp{font-weight:700;color:var(--warn);border:1px solid var(--warn);padding:0 4px;',
    '  font-size:7.5px;letter-spacing:.05em;text-transform:uppercase}',
    'table.gt{border-collapse:collapse;width:100%;font-size:9px}',
    'table.gt th,table.gt td{border:1px solid var(--line);padding:1px 3px;text-align:right;',
    "  font-family:'IBM Plex Mono',ui-monospace,monospace;white-space:nowrap}",
    "table.gt th{background:#fff;font-family:'Archivo',sans-serif;font-weight:700;",
    '  text-align:center;font-size:8px;line-height:1.15}',
    'table.gt td.l{text-align:left;font-family:inherit;font-weight:600}',
    'table.gt.mini{font-size:8.2px}',
    'table.gt.mini th{font-size:7.4px}',
    'table.gt.pos td.l{font-size:9px}',
    'table.gt .hi{background:var(--hl);padding:0 3px}',
    ".kvblk{margin:0 0 6px}.kvt{font-family:'Archivo',sans-serif;font-size:9.5px;font-weight:700;",
    '  color:#000;margin-bottom:1px}',
    '.kvr{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted var(--soft);',
    '  padding:0 2px;font-size:9px}',
    ".kvr b{font-family:'IBM Plex Mono',monospace;font-weight:600}",
    '.kvr.wide{border:1px solid var(--line);padding:1px 4px;margin-bottom:3px}',
    '.nt{font-size:7.8px;color:#3c4350;line-height:1.35;padding:2px 1px}',
    '.nt.ok{color:var(--ok)}.nt.bad{color:var(--bad)}',
    '.bad{color:var(--bad)}',
    '.fig{margin:2px 0}.fig svg{width:100%;height:auto;display:block}',
    ".fig text{font-family:'IBM Plex Mono',monospace}",
    '.nofig{padding:8px;color:#5a6270;font-size:9px}',
    '.footline{display:flex;justify-content:space-between;font-size:7.5px;color:#3c4350;',
    '  border-top:1px solid var(--line);padding-top:2px;margin-top:4px}',
    '@media print{',
    '  body{background:#fff}',
    '  .sheet{width:auto;min-height:0;margin:0;box-shadow:none;padding:7mm;',
    '    page-break-after:always;break-after:page}',
    '  .sheet:last-child{page-break-after:auto;break-after:auto}',
    '  .blk,table{break-inside:avoid}',
    '  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}',
    '}',
    '@page{size:A4 portrait;margin:7mm}'
  ].join('\n');
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veFeadSummaryHTML: veFeadSummaryHTML,
    _fsrSheet1: _fsrSheet1, _fsrSheet2: _fsrSheet2, _fsrSheet3: _fsrSheet3,
    _fsrSheet4: _fsrSheet4, _fsrSheet5: _fsrSheet5,
    _fsrPeak: _fsrPeak, _fsrLogo: _fsrLogo, _fsrCss: _fsrCss, _fsrLayout: _fsrLayout,
    VE_FSR_SHEETS: VE_FSR_SHEETS, VE_FSR_PEAK_BAND: VE_FSR_PEAK_BAND
  };
}
