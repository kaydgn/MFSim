// ============================================================================
// FEAD — ÖZET RAPOR ("Accessory Belt Drive System / Summary of Results")
// ============================================================================
// Tedarikçi (Gates) çıktısının SAYFA DÜZENİNİ birebir izleyen kısa rapor.
// Ayrıntılı rapor (js/cp-fead-report.js) teoriyi ANLATIR; bu rapor yalnız
// SONUÇ SAYFALARINI verir — mühendisin masaya koyup okuduğu beş sayfa.
//
// KAYNAK: AG00976-BMC_Otomotif ... 8PK1715HD ... 05June2025, Gates v13.02,
// 12 sayfalık çıktının 1 / 2 / 3 / 6 / 8. sayfaları. Bu rapor ZATEN doğrulama
// fixture'ımızda (tests/fixtures/fead-validation.js → AG00976) ve örnek olarak
// kayıtlı (VE_FEAD_EXAMPLES['AG00976_GATES_2025']); yani buradaki sayfaların
// sayıları uydurma değil, ölçülmüş referansı geri veren sayılar.
//
// SAYFA EŞLEMESİ
//   1  Sonuç Özeti             ← Gates "Summary of Results"        (s. 1/12)
//   2  Geometrik Analiz 1/2    ← "Geometric Analysis, Sheet 1"     (s. 2/12)
//   3  Geometrik Analiz 2/2    ← "Geometric Analysis, Sheet 2"     (s. 3/12)
//   4  Kayma ve Gerginlik      ← "Belt Slip / Tension Analysis"    (s. 6/12)
//   5  Hubload Analizi         ← "Pulley Hubload Analysis (Mean)"  (s. 8/12)
//
// AD ÖNEKİ `_fsr…` — cp-fead-report.js `_fr…`, cp-fead.js `_fead…` kullanıyor;
// aynı adı iki dosyada üst-seviye bildirmek `source-hygiene` kapısına takılır.
// SAYI BİÇİMİ ORTAK: `_frF`/`_frFs`/`_frPct`/`_frEsc`/`_frNum` ayrıntılı
// rapordan çağrılır. İkinci bir biçimleyici tutmak, iki belgenin aynı sayıyı
// farklı basması demekti (Türkçe virgül, gerçek eksi, boş değer '—').
// ----------------------------------------------------------------------------

var VE_FSR_SHEETS = [
  'Sonuç Özeti',
  'Geometrik Analiz — Sayfa 1/2',
  'Geometrik Analiz — Sayfa 2/2',
  'Kayma ve Gerginlik Analizi',
  'Kasnak Hubload Analizi (Ortalama)'
];

// Tepe yük modelinin ÖLÇÜLMÜŞ sapması. Çekirdeğin `peakEstimate` işlevi
// yarı-statik: gergi kolu dinamiği DAHİL DEĞİL (kendi notu). AG00976'nın Gates
// tepe tablosuna karşı ölçüldü — yük kombinasyonu taraması (aksesuarlar
// %100/%10, ivme ±1100 d/d/s) yapıldığında bile yakınsamıyor:
//   yük taşıyanlar −%7,2 … −%10,5   ·   alternatör +%22,8   ·   gergi %0,0
// Bu yüzden tablo BASILIR ama "kalibre değil" damgasıyla ve sapma bandıyla.
var VE_FSR_PEAK_BAND = '−%10,5 … +%22,8';

// ─── ORTAK KÜÇÜK YARDIMCILAR ────────────────────────────────────────────────
function _fsrLogo(){
  // BMC kelime markası. Tedarikçi çıktısında Gates'in markası nerede duruyorsa
  // burada müşterinin markası duruyor. Vektör: rapor tek dosya ve çevrimdışı,
  // bitmap gömmek gereksiz ağırlık olurdu.
  return '<svg class="fsr-logo" viewBox="0 0 132 46" role="img" aria-label="BMC">'
    + '<text x="0" y="36" font-family="Archivo, Arial Narrow, sans-serif" font-size="44"'
    + ' font-weight="800" font-stretch="75%" letter-spacing="-1" fill="#1d1d1b">BMC</text></svg>';
}

function _fsrDesignLines(R, node){
  var sys = (R.build && R.build.sys) || {}, b = sys.belt || {}, t = sys.tensioner || {};
  var d = (node && node.data) || {};
  var L = [];
  L.push(d.projectName ? String(d.projectName) : 'FEAD Sistemi');
  if(d.driveName) L.push(String(d.driveName));
  L.push((R.pulleyNames || []).length + ' kasnak · ' + (sys.pulleys ? _fsrRoleSummary(sys) : '—'));
  L.push('Gergi ' + (t.armLength != null ? _frF(t.armLength, 0) + ' mm kol · ' : '')
       + (t.preloadNm != null ? _frFs(t.preloadNm, 2) + ' + ' + _frFs(t.rateNmPerDeg, 3) + ' Nm/°' : '—'));
  L.push((b.profile || '—') + (b.ribs ? ' · ' + b.ribs + ' kaburga' : '')
       + (b.effLength ? ' · ' + _frFs(b.effLength, 1) + ' mm' : ''));
  return L;
}
function _fsrRoleSummary(sys){
  var g = 0, bk = 0;
  (sys.pulleys || []).forEach(function(p){ if(p.contact === 'back') bk++; else g++; });
  return g + ' kaburgalı / ' + bk + ' sırt';
}

// Sayfa kabuğu — Gates'in ALT künye bloğu (klasik teknik resim antedi):
// içerik yukarıda, kimlik aşağıda. Üst antet denendi ve tedarikçi çıktısının
// düzenini bozuyordu; oradaki blok gerçekten sayfanın altında duruyor.
function _fsrSheet(no, title, body, R, node){
  var d = (node && node.data) || {};
  var tarih = new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  var h = '<section class="sheet">';
  h += '<div class="sheet-body">' + body + '</div>';
  h += '<div class="titleblock">';
  h += '<div class="tb-main"><div class="tb-sys">Aksesuar Kayış Tahrik Sistemi</div>'
     + '<div class="tb-sheet">' + _frEsc(title) + '</div>'
     + '<div class="tb-user">' + (d.author ? 'Hazırlayan: ' + _frEsc(d.author) + ' · ' : '')
     + 'Doküman: ' + _frEsc(d.docNo || '—') + (d.revision ? ' · rev ' + _frEsc(d.revision) : '') + '</div></div>';
  h += '<div class="tb-logo">' + _fsrLogo() + '</div>';
  h += '<div class="tb-id">' + _fsrDesignLines(R, node).map(function(s){
         return '<div>' + _frEsc(s) + '</div>'; }).join('') + '</div>';
  h += '</div>';
  h += '<div class="footline"><span>' + _frEsc(tarih) + '</span>'
     + '<span>Sayfa ' + no + ' / ' + VE_FSR_SHEETS.length + '</span>'
     + '<span>MFSim · FEAD</span></div>';
  h += '</section>';
  return h;
}

// Yerleşim şeması — TEK ÇİZİCİ kuralı: kanvastaki Kayış Yolu kartını üreten
// fonksiyonun ta kendisi. class="appfig" ŞART: o çizici UYGULAMANIN palet
// jetonlarını kullanıyor, bu belgenin paleti başka; tanımsız var() kalıtılan
// `stroke` için `none` demek olurdu (ayrıntılı raporda ölçüldü: kayış, kasnak
// çemberleri ve pivot TAMAMEN görünmez kalmıştı).
function _fsrLayout(R, W, H){
  var svg = null;
  try {
    if(typeof veFeadLayoutSVG === 'function' && R.build)
      svg = veFeadLayoutSVG(R.build, W || 620, H || 300,
        { posMode: 'mean', compass: false, pivot: true, arrows: true });
  } catch(e){ svg = null; }
  if(!svg) return '<div class="nofig">Yerleşim şeması çizilemedi.</div>';
  return '<div class="appfig fsr-fig">' + svg + '</div>';
}

// Tablo kurucu: başlıklar + satırlar. Gates'in sayfaları dar sütunlu ve
// çerçeveli; okuma yönü SÜTUN (bir kasnağın devirle nasıl değiştiği).
function _fsrTable(cls, head, rows, cap){
  var h = '<table class="' + (cls || '') + '">';
  if(cap) h += '<caption>' + _frEsc(cap) + '</caption>';
  if(head && head.length){
    h += '<tr>';
    head.forEach(function(c){ h += '<th>' + c + '</th>'; });
    h += '</tr>';
  }
  rows.forEach(function(r){
    h += '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '>';
    (r.cells || r).forEach(function(c, i){
      h += '<td' + (i === 0 ? ' class="l"' : '') + '>' + c + '</td>';
    });
    h += '</tr>';
  });
  return h + '</table>';
}

// ═══════════════════ SAYFA 1 — SONUÇ ÖZETİ ══════════════════════════════════
function _fsrSheet1(R, node){
  var sys = R.build && R.build.sys, b = (sys && sys.belt) || {}, t = (sys && sys.tensioner) || {};
  var A = R.analysis || {}, life = R.life || {};
  var h = '<h1>Sonuç Özeti</h1>';

  h += '<div class="grid2">';

  // — kayış ve gergi künyesi
  var kunye = [];
  kunye.push(['Kayış profili', _frEsc(b.profile || '—') + (b.brand ? ' · ' + _frEsc(b.brand) : '')]);
  kunye.push(['Kaburga sayısı', _frF(b.ribs, 0)]);
  kunye.push(['Efektif boy (ISO 9981)', _frFs(b.effLength, 1) + ' mm']);
  kunye.push(['Boy toleransı', b.tolerance ? '± ' + _frFs(b.tolerance, 2) + ' mm' : '—']);
  kunye.push(['Uzama + aşınma payı', _frPct(_frNum(b.wearPct) * 100, 2)]);
  kunye.push(['Gergi tipi', 'Otomatik']);
  kunye.push(['Tasarım gerginliği', '<b>' + _frF(sys && sys.designTensionN, 0) + ' N</b>']);
  h += '<div class="box"><div class="bt">Kayış ve Gergi Künyesi</div>'
     + _fsrTable('kv', null, kunye) + '</div>';

  // — çalışma çevrimi ve ömür
  var duty = R.duty || [];
  var dcTop = 0; duty.forEach(function(r){ dcTop += _frNum(r.dcPct) || 0; });
  var omur = [];
  omur.push(['Devir noktası', duty.length + ' satır']);
  omur.push(['Toplam süre payı', _frPct(dcTop, 2)]);
  omur.push(['Eşdeğer kayış sıcaklığı', _frF(R.degCEq, 0) + ' °C']);
  omur.push(['Yorulma modeli', _frEsc(R.fatigueModel || '—')]);
  omur.push(['B10 ömrü', '<b>' + _frF(life.hoursB10, 0) + ' saat</b>'
    + (life.inValidRange ? '' : ' <span class="flag">çap penceresi dışında</span>')]);
  if(!life.inValidRange && Number.isFinite(_frNum(life.hoursB10Corrected)))
    omur.push(['B10 — ampirik düzeltmeli', _frF(life.hoursB10Corrected, 0) + ' saat']);
  h += '<div class="box"><div class="bt">Çalışma Çevrimi ve Ömür</div>'
     + _fsrTable('kv', null, omur) + '</div>';
  h += '</div>';

  h += _fsrLayout(R, 620, 290);

  // — TEPE GERGİNLİK VE HUBLOAD
  // Gates bu tabloyu "en kritik ivme + yük kombinasyonu" ARAMASIYLA kuruyor.
  // Bizim `peakEstimate` yarı-statik ve gergi kolu dinamiğini DIŞARIDA bırakıyor;
  // kombinasyon taraması yapılsa bile yakınsamıyor (ölçüldü). Tablo basılır —
  // düzen tedarikçi çıktısıyla aynı kalsın — ama damgası üstünde.
  h += _fsrPeakBlock(R);

  return h;
}

function _fsrPeakBlock(R){
  var pk = _fsrPeak(R);
  var h = '<div class="box wide"><div class="bt">Tepe Gerginlik ve Hubload'
        + ' <span class="stamp">kalibre değil</span></div>';
  if(!pk){
    h += '<div class="nofig">Tepe yük tahmini üretilemedi: çözülmüş geometri ya da '
       + 'çalışma çevrimi eksik.</div></div>';
    return h;
  }
  var head = ['Kasnak', 'Devir<br>[d/d]', 'İvme<br>[d/d/s]', 'Tepe gerginlik<br>[N]',
              'Tepe hubload<br>[N]', 'Yön<br>[°]', 'Sarım<br>[°]'];
  var rows = pk.rows.map(function(r){
    return [_frEsc(r.name), _frF(pk.engineRpm, 0), _frF(pk.accelRpmS, 0),
            _frF(r.tensionN, 0), _frF(r.hubloadN, 1), _frF(r.dirDeg, 0), _frFs(r.wrapDeg, 1)];
  });
  h += _fsrTable('mat', head, rows);
  h += '<div class="note">Tepe yükler, aksesuar güçlerinin %100/%10 kombinasyonları ve '
     + '±' + _frF(pk.accelRpmS, 0) + ' d/d/s ivme taranarak kasnak başına en büyük değerden alınır. '
     + '<b>Model yarı-statiktir ve gergi kolu dinamiğini içermez</b>; tedarikçi çıktısına karşı '
     + 'ölçülen sapma ' + VE_FSR_PEAK_BAND + ' bandındadır. Bu tablo yatak ve braket seçiminde '
     + '<b>tek başına kullanılmamalıdır</b>; ortalama yükler için sayfa 5\'e bakınız.</div>';
  h += '</div>';
  return h;
}

// Tepe yük taraması — köprü katmanında, çekirdeğe DOKUNMADAN.
function _fsrPeak(R){
  var C = (typeof FEADCore !== 'undefined') ? FEADCore
        : ((typeof window !== 'undefined') ? window.FEADCore : null);
  var sys = R.build && R.build.sys;
  var duty = R.duty || [];
  if(!C || !C.peakEstimate || !sys || !duty.length) return null;

  // Referans satır: süre payı en büyük olan devir noktası (baskın çalışma).
  var ref = duty[0];
  duty.forEach(function(r){ if((_frNum(r.dcPct) || 0) > (_frNum(ref.dcPct) || 0)) ref = r; });
  var rpm = _frNum(ref.engineRpm);
  if(!Number.isFinite(rpm) || rpm <= 0) return null;
  var accel = _frNum(R.peakAccelRpmS);
  if(!Number.isFinite(accel) || accel <= 0) accel = 1100;   // tedarikçi sayfasının değeri

  var kw0 = (ref && ref.loadsKw) ? ref.loadsKw : null;
  if(!kw0){
    try {
      var cr = (typeof veFeadDutyToCore === 'function') ? veFeadDutyToCore(R.build, [ref]) : null;
      kw0 = (cr && cr[0] && cr[0].loadsKw) || {};
    } catch(e){ kw0 = {}; }
  }

  var yuk = Object.keys(kw0).filter(function(k){ return _frNum(kw0[k]) > 0.05; });
  if(yuk.length > 8) yuk = yuk.slice(0, 8);                 // 2^8 = 256 kombinasyon tavanı

  var geom = null;
  try { geom = C.tensionerState(sys, C.meanRel(sys)).geom; } catch(e){ return null; }

  var n = sys.pulleys.length;
  var best = [];
  for(var i = 0; i < n; i++) best.push(-Infinity);
  for(var m = 0; m < (1 << yuk.length); m++){
    var kw = {};
    Object.keys(kw0).forEach(function(k){ kw[k] = kw0[k]; });
    for(var j = 0; j < yuk.length; j++) if(m >> j & 1) kw[yuk[j]] = kw0[yuk[j]] * 0.10;
    [accel, -accel].forEach(function(a){
      var pe;
      try { pe = C.peakEstimate(sys, { engineRpm: rpm, accelRpmS: a, loadsKw: kw }); }
      catch(e){ return; }
      ['accel', 'decel'].forEach(function(br){
        (pe[br].spanN || []).forEach(function(T, i2){ if(T > best[i2]) best[i2] = T; });
      });
    });
  }
  if(!best.every(function(v){ return Number.isFinite(v); })) return null;

  var hb = [];
  try { hb = C.hubloads(geom, best); } catch(e){ hb = []; }
  var rows = sys.pulleys.map(function(p, i){
    var g = geom.pulleys[i];
    return {
      name: p.name, tensionN: best[i],
      hubloadN: hb[i] ? hb[i].FN : NaN,
      dirDeg: hb[i] ? hb[i].dirDeg : NaN,
      wrapDeg: (geom.wraps[i] * 180 / Math.PI)
    };
  });
  return { engineRpm: rpm, accelRpmS: accel, rows: rows };
}

// ═══════════════════ SAYFA 2 — GEOMETRİK ANALİZ 1/2 ═════════════════════════
function _fsrSheet2(R, node){
  var sys = R.build && R.build.sys, b = (sys && sys.belt) || {}, t = (sys && sys.tensioner) || {};
  var A = R.analysis || {};
  var g = A.geometry || [];
  var h = '<h1>Geometrik Analiz <span class="sub">Sayfa 1/2</span></h1>';

  // — Yerleşim verisi: kasnak SÜTUN (tedarikçi sayfasının biçimi)
  var ad = sys.pulleys.map(function(p){ return _frEsc(p.name); });
  var rows = [];
  function sat(k, f, d){
    var c = [k];
    sys.pulleys.forEach(function(p, i){ c.push(f(p, i)); });
    return c;
  }
  rows.push(sat('X [mm]', function(p){ return _frFs(p.x, 2); }));
  rows.push(sat('Y [mm]', function(p){ return _frFs(p.y, 2); }));
  rows.push(sat('Dış çap [mm]', function(p){ return _frFs(p.od, 2); }));
  rows.push(sat('Pitch çapı [mm]', function(p){ return _frFs(_frNum(p.rPitch) * 2, 2); }));
  rows.push(sat('Efektif çap [mm]', function(p){ return _frFs(_frNum(p.rEff) * 2, 2); }));
  rows.push(sat('Temas', function(p){ return p.contact === 'back' ? 'sırt' : 'kaburgalı'; }));
  rows.push(sat('Atalet [kg·m²]', function(p){
    return Number.isFinite(_frNum(p.inertiaKgM2)) ? _frFs(p.inertiaKgM2, 4) : '—'; }));
  h += '<div class="box wide"><div class="bt">Yerleşim Verisi</div>'
     + _fsrTable('mat', ['Büyüklük'].concat(ad), rows) + '</div>';

  h += '<div class="grid2">';
  // — kayış ve gergi girdisi
  var kv1 = [
    ['Kayış profili', _frEsc(b.profile || '—') + (b.brand ? ' · ' + _frEsc(b.brand) : '')],
    ['Kaburga sayısı', _frF(b.ribs, 0)],
    ['Efektif boy', _frFs(b.effLength, 1) + ' mm'],
    ['Uzama + aşınma payı', _frPct(_frNum(b.wearPct) * 100, 2)],
    ['Boy toleransı', b.tolerance ? '± ' + _frFs(b.tolerance, 2) + ' mm' : '—']
  ];
  h += '<div class="box"><div class="bt">Kayış Verisi</div>' + _fsrTable('kv', null, kv1) + '</div>';
  var kv2 = [
    ['Tip', 'Otomatik'],
    ['Tasarım gerginliği', _frF(sys && sys.designTensionN, 0) + ' N'],
    ['Pivot {X, Y}', _frFs(t.pivot && t.pivot[0], 2) + ' , ' + _frFs(t.pivot && t.pivot[1], 2)],
    ['Kol boyu', _frFs(t.armLength, 1) + ' mm'],
    ['Yay ortalama momenti', _frFs(_frNum(t.preloadNm) + _frNum(t.rateNmPerDeg) * _frNum(A.meanRelDeg), 2) + ' Nm'],
    ['Yay ön yükü', _frFs(t.preloadNm, 2) + ' Nm'],
    ['Yay oranı', _frFs(t.rateNmPerDeg, 3) + ' Nm/°']
  ];
  h += '<div class="box"><div class="bt">Gergi Verisi</div>' + _fsrTable('kv', null, kv2) + '</div>';
  h += '</div>';

  // — SONUÇLAR
  var rr = [];
  rr.push(['Açıklık boyu [mm]'].concat(g.map(function(x){ return _frFs(x.exitSpanMm, 1); })));
  rr.push(['Sarım açısı [°]'].concat(g.map(function(x){ return _frFs(x.wrapDeg, 1); })));
  rr.push(['Hız oranı (motor ref.)'].concat(g.map(function(x){ return _frFs(x.speedRatio, 3); })));
  h += '<div class="box wide"><div class="bt">Sonuçlar — Kayış Tahrik Geometrisi</div>'
     + _fsrTable('mat', ['Büyüklük'].concat(g.map(function(x){ return _frEsc(x.name); })), rr)
     + '<div class="note">Açıklık, o kasnaktan <b>çıkan</b> serbest kayış parçasının boyudur. '
     + 'Efektif tahrik boyu <b>' + _frFs(A.driveLenMm, 1) + ' mm</b>, gereken kayış boyu <b>'
     + _frFs(A.requiredBeltMm, 1) + ' mm</b>.</div></div>';

  h += _fsrLayout(R, 620, 260);
  return h;
}

// ═══════════════════ SAYFA 3 — GEOMETRİK ANALİZ 2/2 ═════════════════════════
function _fsrSheet3(R, node){
  var A = R.analysis || {}, pos = A.positions || [], T = A.tensioner || {};
  var h = '<h1>Geometrik Analiz <span class="sub">Sayfa 2/2</span></h1>';
  var TR = (typeof VE_FEAD_POSITIONS !== 'undefined')
    ? VE_FEAD_POSITIONS.reduce(function(o, p){ o[p.core] = p.label; return o; }, {}) : {};

  h += '<div class="box wide"><div class="bt">Gergi Geometrisi'
     + ' <span class="kv-inline">Kayış take-up / gergi kolu oranı: <b>'
     + _frFs(T.takeupMmPerDeg, 3) + ' mm/°</b></span></div>';

  var head = ['Konum'].concat(pos.map(function(p){
    return '<span' + (p.position === 'Mean' ? ' class="hi"' : '') + '>'
         + _frEsc(TR[p.position] || p.position) + '</span>'; }));
  function sat(k, f, d){
    return [k].concat(pos.map(function(p){
      return p.error ? '<span title="' + _frEsc(p.error) + '">Hata</span>' : _frFs(f(p), d);
    }));
  }
  var rows = [
    sat('Kol konumu [°]',            function(p){ return p.absDeg; }, 1),
    sat('Gergi kasnağı X [mm]',      function(p){ return p.idlerX; }, 1),
    sat('Gergi kasnağı Y [mm]',      function(p){ return p.idlerY; }, 1),
    sat('Hubload–kol açısı β [°]',   function(p){ return p.betaDeg; }, 1),
    sat('Hubload yönü [°]',          function(p){ return p.hubDirDeg; }, 1),
    sat('Hubload [N]',               function(p){ return p.hubloadN; }, 1),
    sat('Gerginlik [N]',             function(p){ return p.tensionN; }, 1),
    sat('Gergi sarım açısı [°]',     function(p){ return p.wrapDeg; }, 1),
    sat('Efektif tahrik boyu [mm]',  function(p){ return p.driveLenMm; }, 1),
    sat('Gereken kayış boyu [mm]',   function(p){ return p.requiredBeltMm; }, 1)
  ];
  h += _fsrTable('mat pos', head, rows);
  h += '<div class="note"><b>Load bir mekanik durdurucudur</b>, çalışma noktası değildir: '
     + 'orada sarım sıfıra yaklaştığı için gerginlik tekilleşir. Çalışma noktası '
     + '<b>Ortalama</b> sütunudur.</div></div>';

  h += _fsrBeltLengthFigure(R);
  return h;
}

// Kayış boyu ↔ kol açısı eğrisi (Gates "Belt-Drive Length" grafiği).
function _fsrBeltLengthFigure(R){
  var A = R.analysis || {}, pos = (A.positions || []).filter(function(p){ return !p.error; });
  if(pos.length < 2) return '';
  var W = 620, H = 230, pad = 46;
  var xs = pos.map(function(p){ return _frNum(p.relDeg); });
  var ys = pos.map(function(p){ return _frNum(p.requiredBeltMm); });
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  if(!(x1 > x0)) { x1 = x0 + 1; }
  if(!(y1 > y0)) { y1 = y0 + 1; }
  var mx = (x1 - x0) * 0.08, my = (y1 - y0) * 0.12;
  x0 -= mx; x1 += mx; y0 -= my; y1 += my;
  function tx(v){ return pad + (v - x0) / (x1 - x0) * (W - pad - 16); }
  function ty(v){ return H - pad + 6 - (v - y0) / (y1 - y0) * (H - pad - 24); }
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="fsr-chart" role="img"'
        + ' aria-label="Kayış boyu — kol açısı">';
  s += '<rect x="' + pad + '" y="18" width="' + (W - pad - 16) + '" height="' + (H - pad - 12)
     + '" fill="#fff" stroke="#c9cdd3"/>';
  // eksen etiketleri
  for(var i = 0; i <= 4; i++){
    var yv = y0 + (y1 - y0) * i / 4, yy = ty(yv);
    s += '<line x1="' + pad + '" y1="' + yy.toFixed(1) + '" x2="' + (W - 16) + '" y2="' + yy.toFixed(1)
       + '" stroke="#e4e6e9"/>'
       + '<text x="' + (pad - 5) + '" y="' + (yy + 3.5).toFixed(1) + '" text-anchor="end"'
       + ' font-size="9">' + _frF(yv, 0) + '</text>';
  }
  var pts = pos.map(function(p){ return tx(_frNum(p.relDeg)).toFixed(1) + ',' + ty(_frNum(p.requiredBeltMm)).toFixed(1); });
  s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#24425f" stroke-width="2"/>';
  var TR = (typeof VE_FEAD_POSITIONS !== 'undefined')
    ? VE_FEAD_POSITIONS.reduce(function(o, p){ o[p.core] = p.kisa || p.label; return o; }, {}) : {};
  pos.forEach(function(p){
    var X = tx(_frNum(p.relDeg)), Y = ty(_frNum(p.requiredBeltMm));
    s += '<circle cx="' + X.toFixed(1) + '" cy="' + Y.toFixed(1) + '" r="3" fill="#c8781e"/>'
       + '<text x="' + X.toFixed(1) + '" y="' + (Y - 7).toFixed(1) + '" text-anchor="middle"'
       + ' font-size="9" fill="#8a5a1e">' + _frEsc(TR[p.position] || p.position) + '</text>';
  });
  s += '<text x="' + (W / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10">'
     + 'Gergi kolu göreli açısı [°]</text>';
  s += '<text x="12" y="14" font-size="10">Gereken kayış boyu [mm]</text>';
  s += '</svg>';
  return '<div class="box wide"><div class="bt">Kayış Boyu — Gergi Kolu Açısı</div>'
       + '<div class="fsr-fig">' + s + '</div>'
       + '<div class="note">Kayış uzadıkça (tolerans + aşınma) kol döner ve gergi kasnağının '
       + 'merkezi kayar; her konumda kayış yolu başka bir eğridir.</div></div>';
}

// ═══════════════════ SAYFA 4 — KAYMA VE GERGİNLİK ═══════════════════════════
function _fsrSheet4(R, node){
  var duty = (R.analysis && R.analysis.duty) || [];
  var h = '<h1>Kayma ve Gerginlik Analizi</h1>';
  if(!duty.length) return h + '<div class="nofig">Çalışma çevrimi tanımlı değil.</div>';

  var sf = _frNum(R.serviceFact);
  var adlar = (duty[0].slip || []).map(function(s){ return _frEsc(s.name); });
  var rows = duty.map(function(d){
    var c = [_frF(d.engineRpm, 0) + ' d/d'];
    (d.slip || []).forEach(function(s){
      var v = _frNum(s.SF);
      var kotu = Number.isFinite(sf) && sf > 0 && Number.isFinite(v) && v < sf;
      c.push((kotu ? '<b class="bad">' : '<span>') + _frFs(v, 2) + (kotu ? '</b>' : '</span>'));
    });
    return c;
  });
  h += '<div class="box wide"><div class="bt">Kayma Emniyet Faktörü'
     + (Number.isFinite(sf) && sf > 0 ? ' <span class="kv-inline">istenen alt sınır: <b>'
        + _frF(sf, 2) + '</b></span>' : '') + '</div>'
     + _fsrTable('mat', ['Motor devri'].concat(adlar), rows);

  // Hükmü VEREN kasnak: yalnız YÜK TAŞIYANLAR. Yük taşımayan avara/gergide
  // gerginlik oranı ~1'dir ve SF bir MARJ değil KAPASİTEDİR — o sayıyı hükme
  // sokmak, çaresi olmayan bir kasnaktan "tasarım onaylanmasın" hükmü çıkarır.
  var st = (typeof _frSlipStats === 'function') ? _frSlipStats(R) : null;
  if(st && Number.isFinite(st.loadedMin)){
    var ok = !(Number.isFinite(sf) && sf > 0) || st.loadedMin >= sf;
    h += '<div class="note ' + (ok ? 'ok' : 'bad') + '">'
       + '<b>Hüküm:</b> yük taşıyan kasnakların en düşük emniyet faktörü <b>'
       + _frFs(st.loadedMin, 2) + '</b>' + (st.loadedName ? ' (' + _frEsc(st.loadedName) + ')' : '')
       + (Number.isFinite(sf) && sf > 0 ? ' — istenen ≥ ' + _frF(sf, 2) : '')
       + (ok ? ' ✓' : ' ✗') + '. Yük taşımayan avara ve gergi kasnaklarında gerginlik oranı 1\'e '
       + 'yakındır; oradaki sayı bir marj değil, o sarım açısının <b>kapasitesidir</b>.</div>';
  }
  h += '<div class="note">Tedarikçi çıktısındaki <i>Belt Slip Sensitivity</i> sayfası, en kritik '
     + 'ivme ve yük kombinasyonunu <b>arayarak</b> gereken gerginlik/sarım artışını verir. Bu ters '
     + 'çözüm modelde yoktur; yukarıdaki tablo her devir noktasında fiili emniyet faktörünü '
     + 'doğrudan verir.</div></div>';

  // — açıklık titreşimi (Gates'in gerginlik sayfasının yanındaki bilgi)
  var d0 = duty[0];
  if(d0 && d0.frequencies && d0.frequencies.length){
    var spans = d0.frequencies.map(function(s){ return s.span; });
    var fr = spans.map(function(sp, i){
      var L = NaN, lo = Infinity, hi = -Infinity, flut = false;
      duty.forEach(function(d){
        var s2 = (d.frequencies || [])[i]; if(!s2) return;
        L = _frNum(s2.LMm);
        var f = (s2.fHz && s2.fHz.length) ? _frNum(s2.fHz[0]) : NaN;
        if(Number.isFinite(f)){ if(f < lo) lo = f; if(f > hi) hi = f; }
        if(s2.flutter) flut = true;
      });
      return [_frEsc(sp), _frFs(L, 1), _frFs(lo, 1) + ' – ' + _frFs(hi, 1),
              flut ? '<b class="bad">var</b>' : '<span class="ok">yok</span>'];
    });
    var f1 = _frNum(d0.firingHz), f2 = _frNum(duty[duty.length - 1].firingHz);
    h += '<div class="box wide"><div class="bt">Serbest Açıklık Titreşimi</div>'
       + _fsrTable('mat', ['Açıklık', 'Boy [mm]', 'f₁ aralığı [Hz]', 'Çırpınma'], fr)
       + '<div class="note">Ateşleme frekansı çalışma çevrimi boyunca <b>' + _frFs(f1, 1) + ' – '
       + _frFs(f2, 1) + ' Hz</b>. Bunlar açıklıkların <b>enine</b> titreşimidir; sistem burulma '
       + 'modu ayrı bir büyüklüktür.</div></div>';
  }
  return h;
}

// ═══════════════════ SAYFA 5 — HUBLOAD ANALİZİ ══════════════════════════════
function _fsrSheet5(R, node){
  var duty = (R.analysis && R.analysis.duty) || [];
  var raw = R.duty || [];
  var h = '<h1>Kasnak Hubload Analizi <span class="sub">Ortalama</span></h1>';
  if(!duty.length) return h + '<div class="nofig">Çalışma çevrimi tanımlı değil.</div>';

  var sys = R.build && R.build.sys;
  var surucu = '';
  if(sys) sys.pulleys.forEach(function(p){ if(p.crank) surucu = p.name; });
  var yukAd = (R.pulleyNames || []).filter(function(n){ return n !== surucu; });

  // — yük koşulları (duty girdisi)
  var lc = raw.map(function(r){
    var c = [_frPct(r.dcPct, 2), _frF(r.engineRpm, 0), _frF(r.degC, 0)];
    var top = 0;
    yukAd.forEach(function(n){
      var v = _frNum(r.loadsKw && r.loadsKw[n]);
      if(Number.isFinite(v)) top += v;
      c.push(Number.isFinite(v) ? _frFs(v, 2) : '—');
    });
    c.push('<b>' + _frFs(top, 2) + '</b>');
    return c;
  });
  h += '<div class="box wide"><div class="bt">Yük Koşulları</div>'
     + _fsrTable('mat', ['Süre payı', 'Motor devri<br>[d/d]', 'Sıcaklık<br>[°C]']
         .concat(yukAd.map(function(n){ return _frEsc(n); })).concat(['Σ (sürücü)<br>[kW]']), lc)
     + '<div class="note"><b>Sürücü kasnağın gücü bir girdi değildir</b>: çevrimin kapanabilmesi '
     + 'için aksesuar güçlerinin toplamı olarak hesaplanır.</div></div>';

  var adlar = (duty[0].perPulley || []).map(function(q){ return _frEsc(q.name); });
  function matris(baslik, oku, dec, cap){
    var rows = duty.map(function(d){
      var c = [_frF(d.engineRpm, 0)];
      adlar.forEach(function(n, i){ c.push(_frFs(oku(d, i), dec)); });
      return c;
    });
    return '<div class="box wide"><div class="bt">' + baslik + '</div>'
         + _fsrTable('mat', ['Motor devri<br>[d/d]'].concat(adlar), rows)
         + (cap ? '<div class="note">' + cap + '</div>' : '') + '</div>';
  }
  h += matris('Ortalama Gerginlikler [N]',
        function(d, i){ return (d.perPulley[i] || {}).exitTensionN; }, 0,
        'Değer, o kasnaktan <b>sonraki</b> açıklığın gerginliğidir. Gerginlik sürücü kasnakta '
      + 'yükselir, güç çeken her kasnakta bir basamak düşer, avara ve gergide değişmez.');
  h += matris('Ortalama Hubloadlar [N]',
        function(d, i){ return ((d.hubloads || [])[i] || {}).FN; }, 0,
        'Hubload, kasnak yatağına binen bileşke kuvvettir; yön kayış düzleminde +X\'ten saat '
      + 'yönünün tersine ölçülür.');
  h += matris('Hubload Yönü [°]',
        function(d, i){ return ((d.hubloads || [])[i] || {}).dirDeg; }, 1, '');

  h += _fsrLayout(R, 620, 250);
  return h;
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
    + '<style>' + fonts + '</style>'
    + '<style>' + _fsrCss() + '</style>'
    + '</head><body>' + body + '</body></html>';
}

function _fsrCss(){
  return [
    ':root{--ink:#1b1e24;--paper:#fff;--line:#c9cdd3;--line-soft:#e4e6e9;',
    '  --prusya:#24425f;--head:#eef2f6;--warn:#8a5a1e;--bad:#a8321f;--ok:#2e7d4f;}',
    // KANVASTAN GELEN ŞEKİL: uygulamanın palet jetonları bu belgede tanımsız
    // olurdu; tanımsız var() kalıtılan `stroke` için `none` demektir.
    '.appfig{--accent-primary:#24425f;--accent-success:#2e7d4f;--accent-warning:#c8781e;',
    '  --accent-danger:#a8321f;--text-secondary:#3c4350;--text-muted:#5a6270;',
    '  --bg-input:#fff;--border-color:#c9cdd3;--radius-sm:2px;--fs-tiny:11px;--fs-micro:10px;}',
    '*{box-sizing:border-box}',
    'body{margin:0;background:#8d9199;color:var(--ink);',
    "  font-family:'Source Serif 4',Georgia,serif;font-size:12px;line-height:1.45}",
    // A4 YATAY: tedarikçi çıktısı da yatay. Ekranda sayfa sayfa, baskıda birebir.
    '.sheet{position:relative;width:297mm;min-height:210mm;margin:10mm auto;padding:10mm 10mm 6mm;',
    '  background:var(--paper);box-shadow:0 2px 12px rgba(0,0,0,.28);display:flex;flex-direction:column}',
    '.sheet-body{flex:1}',
    "h1{font-family:'Archivo',system-ui,sans-serif;color:var(--prusya);font-size:19px;",
    '  margin:0 0 8px;font-stretch:87%;letter-spacing:.01em}',
    'h1 .sub{font-size:13px;color:#5a6270;font-weight:500}',
    '.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.box{border:1px solid var(--line);margin:0 0 8px;background:#fff}',
    '.box.wide{grid-column:1/-1}',
    ".bt{font-family:'Archivo',sans-serif;font-size:11px;font-weight:700;color:var(--prusya);",
    '  background:var(--head);border-bottom:1px solid var(--line);padding:4px 8px;',
    '  display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.kv-inline{font-weight:400;color:#3c4350;margin-left:auto}',
    '.stamp{font-weight:700;color:var(--warn);border:1px solid var(--warn);',
    '  padding:0 5px;font-size:9px;letter-spacing:.06em;text-transform:uppercase}',
    'table{border-collapse:collapse;width:100%;font-size:10.5px}',
    "table.mat th,table.mat td{border:1px solid var(--line-soft);padding:2px 5px;text-align:right;",
    "  font-family:'IBM Plex Mono',ui-monospace,monospace}",
    'table.mat th{background:#f6f8fa;font-weight:600;text-align:center;font-size:9.5px;',
    "  font-family:'Archivo',sans-serif;color:var(--prusya)}",
    'table.mat td.l{text-align:left;font-family:inherit}',
    'table.kv td{border-bottom:1px solid var(--line-soft);padding:2px 8px}',
    'table.kv td.l{color:#3c4350;width:52%}',
    "table.kv td:last-child{text-align:right;font-family:'IBM Plex Mono',monospace}",
    'table.pos th .hi{background:#dfe8f0;padding:0 4px}',
    '.note{font-size:9.5px;color:#4a5160;padding:4px 8px;border-top:1px solid var(--line-soft)}',
    '.note.ok{color:var(--ok)} .note.bad{color:var(--bad)}',
    '.bad{color:var(--bad)} .ok{color:var(--ok)}',
    '.flag{color:var(--warn);font-size:9px;border:1px solid var(--warn);padding:0 4px}',
    '.fsr-fig{padding:6px 8px}',
    '.fsr-fig svg{width:100%;height:auto;display:block}',
    ".fsr-chart text{font-family:'IBM Plex Mono',monospace;fill:#3c4350}",
    '.nofig{padding:10px;color:#5a6270;font-size:10.5px}',
    // ALT KÜNYE — klasik teknik resim antedi (tedarikçi çıktısındaki yer)
    '.titleblock{display:grid;grid-template-columns:1fr auto 1.1fr;gap:0;',
    '  border:1px solid var(--ink);margin-top:6px}',
    '.titleblock>div{padding:5px 9px}',
    '.tb-main{border-right:1px solid var(--ink)}',
    ".tb-sys{font-family:'Archivo',sans-serif;font-weight:700;font-size:13px;color:var(--prusya)}",
    '.tb-sheet{font-size:11px;color:#3c4350}',
    '.tb-user{font-size:9px;color:#5a6270;margin-top:2px}',
    '.tb-logo{border-right:1px solid var(--ink);display:flex;align-items:center;padding:4px 14px}',
    '.fsr-logo{width:74px;height:26px;display:block}',
    '.tb-id{font-size:9.5px;color:#3c4350;line-height:1.35}',
    '.footline{display:flex;justify-content:space-between;font-size:8.5px;color:#5a6270;',
    '  padding:3px 2px 0}',
    '@media print{',
    '  body{background:#fff}',
    '  .sheet{width:auto;min-height:0;margin:0;box-shadow:none;padding:8mm;',
    '    page-break-after:always;break-after:page}',
    '  .sheet:last-child{page-break-after:auto;break-after:auto}',
    '  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}',
    '}',
    '@page{size:A4 landscape;margin:8mm}'
  ].join('\n');
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veFeadSummaryHTML: veFeadSummaryHTML,
    _fsrSheet1: _fsrSheet1, _fsrSheet2: _fsrSheet2, _fsrSheet3: _fsrSheet3,
    _fsrSheet4: _fsrSheet4, _fsrSheet5: _fsrSheet5,
    _fsrPeak: _fsrPeak, _fsrLogo: _fsrLogo, _fsrCss: _fsrCss,
    VE_FSR_SHEETS: VE_FSR_SHEETS, VE_FSR_PEAK_BAND: VE_FSR_PEAK_BAND
  };
}
