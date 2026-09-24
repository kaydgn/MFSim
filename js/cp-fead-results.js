// ============================================================================
//  FEAD — SONUÇLAR SEKMESİ (sunum)
// ============================================================================
// Sonuçlar sayfasındaki "FEAD Kayış Tahriki" sekmesinin yüzleri:
//
//   • Veri Gezgini'nin üst satırı   sonuç durumu (güncel / BAYAT) + özet kısayolu
//   • Veri Gezgini'nin alt satırları özet penceresi · iki HTML rapor
//   • Boş panonun başlangıç kartı    özet kartları + tek tıklık hazır diyagramlar
//   • Sonuç Özeti penceresi          kasnak · çevrim · gergi · burulma · tepe
//                                    yük · hizalama · uygunluk tabloları
//
// HESAP YOK. Bütün sayılar sonuçtan (window.veFeadResults) ve onun veri
// kümelerinden (js/fead-signals.js) okunur; tepe yük tablosu Özet Rapor'un
// kendi üreticisinden (`_fsrPeak`) — iki yüzey aynı sayıyı farklı basamaz.
// Sonucun bayatlığı TEK çağrıdan (`veFeadResultState`, js/cp-fead.js):
// çözücü penceresi, bu sekme ve rapor aynı hükmü okur.
//
// GÖRÜNÜM CSS'TE (`.ve-fr-*`), satır içi stilde değil: satır içi CSS durum
// ifade edemez (`:hover`, `:focus-visible`) — FEAD panellerinin kuralı 14.
// Satır içinde kalan tek şey VERİ: mod şekli çubuğunun `--fr-v` oranı.
//
// Kaynak tablosuna (js/results.js veResultSources) üç kancayla bağlı:
// treeTop · treeBottom · emptyHTML. Ortak dosyalarda FEAD'e özgü dal YOK.
// ----------------------------------------------------------------------------

function _feadResR() { return (typeof window !== 'undefined') ? window.veFeadResults : null; }
function _feadResEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _feadResN(v, dec) {
  if(!(typeof v === 'number' && isFinite(v))) return '—';
  return (v < 0 ? '−' : '') + Math.abs(v).toFixed(dec == null ? 1 : dec).replace('.', ',');
}
function _feadResSets() {
  var R = _feadResR();
  return (R && R.ok && Array.isArray(R.signals)) ? R.signals : [];
}
function _feadResState(R) {
  return (typeof veFeadResultState === 'function') ? veFeadResultState(R || null)
    : { k: R ? 'bilinmiyor' : 'yok', metin: R ? 'var' : 'yok', R: R };
}

// Sonuç durumu çipi. Sözlük: ok · warn · no · off · info — KPI kartlarıyla aynı.
var VE_FEAD_RES_DURUM = {
  guncel:     { d: 'ok',   t: 'Güncel' },
  bayat:      { d: 'warn', t: 'Bayat — model değişti' },
  kayip:      { d: 'off',  t: 'Modeli projede yok' },
  bilinmiyor: { d: 'info', t: 'Son çözüm' },
  hata:       { d: 'no',   t: 'Çözüm hatası' },
  yok:        { d: 'off',  t: 'Sonuç yok' }
};
function veFeadResChipHTML(st) {
  var c = VE_FEAD_RES_DURUM[st && st.k] || VE_FEAD_RES_DURUM.yok;
  return '<span class="ve-fr-chip" data-d="' + c.d + '">' + _feadResEsc(c.t) + '</span>';
}

// "12 devir · 6 kasnak · 14:32" — sonucun künyesi.
function _feadResMeta(R) {
  if(!R || !R.ok) return '';
  var duty = (R.analysis && R.analysis.duty) || [];
  var kasnak = (R.build && R.build.sys && R.build.sys.pulleys) ? R.build.sys.pulleys.length : 0;
  var parca = [duty.length + ' devir', kasnak + ' kasnak'];
  if(R.solvedAt > 0) {
    var d = new Date(R.solvedAt);
    var p = function(x) { return (x < 10 ? '0' : '') + x; };
    parca.push('çözüldü ' + p(d.getHours()) + ':' + p(d.getMinutes()));
  }
  return parca.join(' · ');
}

// Kasnak kodu → ad künyesi. Kod bir KİMLİKTİR ve kullanıldığı her yüzeyde
// karşılığı aynı sayfada basılır (köprünün kuralı, veFeadPulleyCodes).
function _feadResCodes(R) {
  var P = (typeof veFeadSignals !== 'undefined' && R && R.build) ? veFeadSignals._pulleys(R) : [];
  if(!P.length) return '';
  return '<div class="ve-fr-codes"><span class="ve-fr-codes-t">Kasnak kodları</span>'
    + P.map(function(p) {
        return '<span class="ve-fr-code"><b>' + _feadResEsc(p.code) + '</b>' + _feadResEsc(p.name) + '</span>';
      }).join('') + '</div>';
}

// ── KPI KARTLARI — tek üretici (veFeadSignals.summary) ─────────────────────
function veFeadResKpiHTML(R) {
  var list = (typeof veFeadSignals !== 'undefined') ? veFeadSignals.summary(R) : [];
  if(!list.length) return '';
  return '<div class="ve-fr-kpis">' + list.map(function(k) {
    return '<div class="ve-fr-kpi" data-d="' + _feadResEsc(k.durum) + '">'
      + '<span class="ve-fr-kpi-ad">' + _feadResEsc(k.ad) + '</span>'
      + '<span class="ve-fr-kpi-v"><b>' + _feadResEsc(k.deger) + '</b>'
      + (k.birim ? '<i>' + _feadResEsc(k.birim) + '</i>' : '') + '</span>'
      + (k.not ? '<span class="ve-fr-kpi-not">' + _feadResEsc(k.not) + '</span>' : '')
      + '</div>';
  }).join('') + '</div>';
}

// Bayat sonucun uyarısı — sebebi ve çaresiyle.
function _feadResStaleNote(st) {
  if(!st) return '';
  if(st.k === 'bayat')
    return '<div class="ve-fr-note" data-d="warn"><b>Bu sonuç eski modele ait.</b> Model çözümden sonra '
      + 'değişti; sayılar artık tuvaldeki modeli anlatmıyor. FEAD alt topolojisinde Çözücü → '
      + '<b>▶ Hesapla</b> ile yeniden çözün.</div>';
  if(st.k === 'kayip')
    return '<div class="ve-fr-note" data-d="off">Bu sonucun modeli artık projede yok (FEAD kartı '
      + 'silinmiş ya da başka bir proje sekmesinde).</div>';
  return '';
}

// ── VERİ GEZGİNİ — üst satır ────────────────────────────────────────────────
function veFeadResTreeTopHTML() {
  var R = _feadResR();
  if(!R || !R.ok) return '';
  var st = _feadResState(R);
  return '<div class="ve-fr-tree-top">'
    + '<div class="ve-fr-tree-row">' + veFeadResChipHTML(st)
    + '<span class="ve-fr-tree-meta">' + _feadResEsc(_feadResMeta(R)) + '</span>'
    + '<button type="button" class="ve-trace-btn ve-fr-tree-btn" onclick="veFeadResSummaryOpen()"'
    + ' title="Kasnak, çevrim, gergi, burulma, tepe yük ve uygunluk tabloları">'
    + '<span class="mf-ico mf-ico-clipboard"></span>Özet</button></div>'
    + (st.k === 'bayat' ? '<div class="ve-fr-tree-uyari">Model çözümden sonra değişti — yeniden hesaplayın.</div>' : '')
    + '</div>';
}

// ── VERİ GEZGİNİ — alt satırlar: özet + iki rapor ──────────────────────────
function veFeadResTreeReportHTML() {
  var h = '<div class="ve-fr-tree-rep">';
  h += '<button type="button" class="ve-fr-tree-link" onclick="veFeadResSummaryOpen()">'
     + '<span class="mf-ico mf-ico-clipboard"></span>FEAD Sonuç Özeti</button>';
  if(typeof veFeadGenerateReport === 'function') {
    h += '<button type="button" class="ve-fr-tree-link" onclick="veFeadGenerateReport(null,\'detailed\')"'
       + ' title="Teori + türetme + bu modelin çözümü — indirilir">'
       + '<span class="mf-ico mf-ico-file-text"></span>FEAD Detaylı Rapor (HTML)</button>';
    h += '<button type="button" class="ve-fr-tree-link" onclick="veFeadGenerateReport(null,\'summary\')"'
       + ' title="Tedarikçi sonuç sayfalarının düzeni — indirilir">'
       + '<span class="mf-ico mf-ico-file-text"></span>FEAD Özet Rapor (HTML)</button>';
  }
  return h + '</div>';
}

// ── BOŞ PANO — başlangıç kartı ─────────────────────────────────────────────
//
// Boş bir FEAD panosunda sorulacak ilk soru "hangi sinyali çizeyim" değil
// "tasarım tutuyor mu"; cevabı çözümde hazır. Kart onu verir ve en sık
// sorulan altı grafiği TEK TIKLA kurar. Veri Gezgini yine her kanala açık.
function veFeadResEmptyHTML() {
  var R = _feadResR();
  if(!R || !R.ok) return '';
  var sets = _feadResSets();
  var st = _feadResState(R);
  var pres = (typeof veFeadSignals !== 'undefined') ? veFeadSignals.presets(sets) : [];
  var h = '<div class="ve-fr-start">';
  h += '<div class="ve-fr-start-head">'
     + '<span class="ve-fr-start-title"><span class="mf-ico mf-ico-disc"></span>FEAD sonuçları</span>'
     + veFeadResChipHTML(st)
     + '<span class="ve-fr-start-meta">' + _feadResEsc(_feadResMeta(R)) + '</span>'
     + '<button type="button" class="ve-trace-btn" onclick="veFeadResSummaryOpen()">'
     + '<span class="mf-ico mf-ico-clipboard"></span>Sonuç Özeti</button></div>';
  h += _feadResStaleNote(st);
  h += veFeadResKpiHTML(R);
  if(pres.length) {
    h += '<div class="ve-fr-h">Hazır diyagramlar</div><div class="ve-fr-presets">';
    pres.forEach(function(p) {
      var ds = veFeadSignals.setOf(sets, p.sensorId);
      h += '<button type="button" class="ve-fr-preset" onclick="veFeadResPreset(\'' + p.k + '\')">'
         + '<span class="ve-fr-preset-ico"><span class="mf-ico mf-ico-' + _feadResEsc(p.ikon || 'trending-up') + '"></span></span>'
         + '<span class="ve-fr-preset-t"><b>' + _feadResEsc(p.ad) + '</b>'
         + '<i>' + _feadResEsc(p.alt) + '</i></span>'
         + '<span class="ve-fr-preset-x">' + _feadResEsc(ds ? ds.x.name : '') + ' · '
         + p.lanes.length + ' şerit</span></button>';
    });
    h += '</div>';
  }
  h += '<div class="ve-fr-foot">ya da <b>Veri Gezgini</b>\'nden kanal seçin — her küme kendi X ekseninde: '
     + 'çevrim ve Campbell <b>motor devri</b>, gergi kolu <b>kol açısı</b>, senaryo <b>zaman</b>.</div>';
  h += _feadResCodes(R);
  return h + '</div>';
}

// Hazır diyagramı panoya kurar. Pano TEMİZLENİP yeniden kurulur — sihirbaz
// diyagramlarının kuralı (results.js veAddWizardDiagramToSlot): başka
// eksendeki eski şeritlerle karışık bir pano tek-eksen kuralını çiğnerdi.
function veFeadResPreset(k) {
  if(typeof veFeadSignals === 'undefined' || typeof veResultSlots === 'undefined') return false;
  var sets = _feadResSets();
  var p = veFeadSignals.presets(sets).filter(function(x) { return x.k === k; })[0];
  if(!p) return false;
  var ds = veFeadSignals.setOf(sets, p.sensorId);
  if(!ds) return false;
  var idx = (typeof VE_BOARD === 'number') ? VE_BOARD : 0;
  var slot = { type: 'line', sensors: [], lanes: [], xAxis: veFeadSignals.xAxisOf(ds) };
  var key = function(id) {
    return (typeof veTrKey === 'function') ? veTrKey(p.sensorId, id) : (p.sensorId + '\u0000' + id);
  };
  var defH = (typeof VE_TR !== 'undefined' && VE_TR.LANE_DEF_H) ? VE_TR.LANE_DEF_H : 96;
  p.lanes.forEach(function(L) {
    L.forEach(function(id) {
      var ch = veFeadSignals.channelOf(sets, p.sensorId, id);
      if(ch) slot.sensors.push({ id: p.sensorId, name: ch.name, unit: ch.unit || '', signal: id });
    });
  });
  // İlk şerit asıl soru (gerginlik, Campbell, devir) — ötekilerden geniş.
  slot.lanes = p.lanes.map(function(L, i) {
    return { ids: L.map(key), h: (i === 0 && p.lanes.length > 1) ? Math.round(defH * 1.4) : defH,
             min: null, max: null };
  });
  veResultSlots[idx] = slot;
  if(typeof veTrResetView === 'function') veTrResetView();
  if(typeof veTrRefresh === 'function') veTrRefresh();
  if(typeof veSyncBoardState === 'function') veSyncBoardState();
  if(typeof veSigRefreshTree === 'function') veSigRefreshTree();
  return true;
}

// ── SONUÇLAR'DA AÇ — çözücü penceresinden ──────────────────────────────────
function veFeadOpenResults() {
  if(!_feadResSets().length) {
    if(typeof showToast === 'function') showToast('Önce Çözücü → ▶ Hesapla ile modeli çözün.', 'warning');
    return false;
  }
  // Müfettiş penceresi topoloji sayfasının yüzü; açık kalırsa Sonuçlar'da
  // panonun sağını örter (ölçüldü: 1600 px ekranda 380 px).
  if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(false);
  if(typeof veAdoptSolverTab === 'function') veAdoptSolverTab('fead');
  if(typeof veSubTabDegistir === 'function') veSubTabDegistir('sonuclar');
  else if(typeof veEnterResults === 'function') veEnterResults();
  return true;
}

// ════════════════════════════════════════════════════════════════════════════
//  SONUÇ ÖZETİ PENCERESİ
// ════════════════════════════════════════════════════════════════════════════
// Panonun yapısal olarak gösteremediği şeyler — tek sayılar ve tablolar —
// burada. Takoz'da bu iş rapora düşüyordu; FEAD'in raporu indirilen bir belge,
// bu pencere ise ekranda kalan ve çözümle birlikte tazelenen bir özet.
function veFeadResSummaryOpen() {
  if(typeof document === 'undefined') return false;
  var overlay = document.getElementById('ve-report-overlay');
  var R = _feadResR();
  if(!overlay) return false;
  if(!R || !R.ok) {
    if(typeof showToast === 'function') showToast('FEAD sonucu yok — önce Çözücü ile çözün.', 'warning');
    return false;
  }
  var bant = (typeof veRepHeadHTML === 'function') ? veRepHeadHTML({
    icon: 'disc', title: 'FEAD Sonuç Özeti',
    actions: [
      { onclick: "veFeadGenerateReport(null,'detailed')", icon: 'download', label: 'Detaylı Rapor',
        title: 'Teori + türetme + bu modelin çözümü (HTML)' },
      { onclick: "veFeadGenerateReport(null,'summary')", icon: 'download', label: 'Özet Rapor',
        title: 'Tedarikçi sonuç sayfalarının düzeni (HTML)' },
      { onclick: 'veCloseDetailedReport()', label: '✕ Kapat', danger: true }
    ]
  }) : '';
  overlay.innerHTML = bant + '<div class="ve-fr-doc">' + veFeadResSummaryHTML(R) + '</div>';
  overlay.style.display = 'flex';
  return true;
}

function _feadResSec(baslik, alt, govde, ton) {
  if(!govde) return '';
  return '<section class="ve-fr-sec"' + (ton ? ' data-d="' + ton + '"' : '') + '>'
    + '<div class="ve-fr-sec-h"><b>' + _feadResEsc(baslik) + '</b>'
    + (alt ? '<em>' + _feadResEsc(alt) + '</em>' : '') + '</div>' + govde + '</section>';
}
function _feadResTbl(head, rows) {
  var h = '<div class="ve-fr-tbl-wrap"><table class="ve-pnl-tbl ve-fr-tbl"><thead><tr>';
  head.forEach(function(c) { h += '<th class="' + (c.l ? 'lbl' : 'num') + '">' + c.t + '</th>'; });
  h += '</tr></thead><tbody>';
  rows.forEach(function(r) {
    h += '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '>';
    r.c.forEach(function(v, i) {
      h += '<td class="' + (head[i] && head[i].l ? 'lbl' : 'num') + '">' + v + '</td>';
    });
    h += '</tr>';
  });
  return h + '</tbody></table></div>';
}

// Referans devir: çevrim yüzdesi en büyük satır — Özet Rapor'un tepe tablosu
// da aynı satırı seçiyor (`_fsrPeak`).
function _feadResRefRow(R) {
  var duty = (R.analysis && R.analysis.duty) || [];
  var ref = duty[0] || null;
  duty.forEach(function(d) { if((Number(d.dcPct) || 0) > (Number(ref.dcPct) || 0)) ref = d; });
  return ref;
}

function veFeadResSummaryHTML(R) {
  var S = (typeof veFeadSignals !== 'undefined') ? veFeadSignals : null;
  if(!S || !R || !R.ok) return '';
  var st = _feadResState(R);
  var A = R.analysis || {};
  var P = S._pulleys(R);
  var sys = R.build && R.build.sys;
  var geo = A.geometry || [];
  var ref = _feadResRefRow(R);
  var loadedThr = (typeof VE_FEAD_SLIP_LOADED_RATIO === 'number') ? VE_FEAD_SLIP_LOADED_RATIO : 1.01;
  var h = '<div class="ve-fr-sum">';

  h += '<div class="ve-fr-sum-head"><span class="ve-fr-start-title"><span class="mf-ico mf-ico-disc"></span>'
     + 'FEAD çözümü</span>' + veFeadResChipHTML(st)
     + '<span class="ve-fr-start-meta">' + _feadResEsc(_feadResMeta(R)) + '</span></div>';
  h += _feadResStaleNote(st);
  h += veFeadResKpiHTML(R);
  h += _feadResCodes(R);

  // 1) Kasnaklar — geometri
  h += _feadResSec('Kasnaklar', 'geometri · çalışma (Mean) konumunda', _feadResTbl(
    [{ t: 'Kod', l: 1 }, { t: 'Kasnak', l: 1 }, { t: 'Rol', l: 1 }, { t: 'Temas', l: 1 },
     { t: 'Ø pitch [mm]' }, { t: 'Sarım [°]' }, { t: 'Hız oranı' }, { t: 'Çıkış açıklığı [mm]' }],
    P.map(function(p) {
      var sp = sys && sys.pulleys && sys.pulleys[p.i];
      var g = geo[p.i] || {};
      return { c: ['<b>' + _feadResEsc(p.code) + '</b>', _feadResEsc(p.name),
        p.crank ? 'sürücü' : (p.tensioner ? 'gergi' : ''),
        p.contact === 'back' ? 'sırttan' : 'kaburgalı',
        _feadResN(sp ? 2 * sp.rPitch : NaN, 1), _feadResN(g.wrapDeg, 1),
        _feadResN(g.speedRatio, 3), _feadResN(g.exitSpanMm, 1)] };
    })));

  // 2) Kasnaklar — referans devirde yük
  if(ref) {
    var fat = (R.fatigue && R.fatigue.perPulley) || [];
    var head = [{ t: 'Kod', l: 1 }, { t: 'Çıkış gerginliği [N]' }, { t: 'Hubload [N]' }, { t: 'Yön [°]' },
                { t: 'Kayma SF' }, { t: 'Devir [d/dk]' }, { t: 'Güç [kW]' }, { t: 'Tork [Nm]' }];
    if(fat.length) head.push({ t: 'Yorulma payı [%]' });
    h += _feadResSec('Kasnak yükleri', _feadResN(ref.engineRpm, 0) + ' d/dk — en sık çalışılan devir (%'
      + _feadResN(Number(ref.dcPct), 1) + ')', _feadResTbl(head, P.map(function(p) {
        var q = (ref.perPulley || [])[p.i] || {}, hb = (ref.hubloads || [])[p.i] || {},
            sl = (ref.slip || [])[p.i] || {};
        var yuk = Number(sl.tensionRatio) >= loadedThr;
        var nn = Number(q.accessoryRpm), kw = Number(q.powerKw);
        var satir = ['<b>' + _feadResEsc(p.code) + '</b>', _feadResN(q.exitTensionN, 0), _feadResN(hb.FN, 0),
          _feadResN(hb.dirDeg, 1), yuk ? _feadResN(sl.SF, 2) : '<span class="ve-fr-mute">yüksüz</span>',
          _feadResN(nn, 0), p.crank ? _feadResN(kw, 2) : (kw > 0.05 ? _feadResN(kw, 2) : '—'),
          (!p.crank && kw > 0.05 && nn > 0) ? _feadResN(9549 * kw / nn, 1) : '—'];
        if(fat.length) satir.push(fat[p.i] ? _feadResN(fat[p.i].sharePct, 1) : '—');
        return { c: satir };
      })));
  }

  // 3) Çalışma çevrimi — devir × kasnak gerginlik matrisi (panelde duran tablo)
  var rows = ((A.duty) || []).slice().sort(function(a, b) { return a.engineRpm - b.engineRpm; });
  if(rows.length) {
    var ten = R.tensionerSide, ters = !!(ten && ten.ok === false);
    var sfIst = Number(R.serviceFact);
    var mh = [{ t: 'Devir' }, { t: '%' }, { t: 'Kayış [m/s]' }];
    P.forEach(function(p) { mh.push({ t: _feadResEsc(p.code) }); });
    mh.push({ t: 'En düşük SF' });
    h += _feadResSec('Çıkış gerginlikleri', 'çevrim satırı başına [N] — kasnağın ÇIKIŞ açıklığı',
      _feadResTbl(mh, rows.map(function(d) {
        var m = Infinity;
        (d.slip || []).forEach(function(s) { if(Number(s.tensionRatio) >= loadedThr) m = Math.min(m, s.SF); });
        var cls = (!ters && isFinite(m)) ? (m < 1 ? 'is-no' : ((sfIst > 0 && m < sfIst) ? 'is-warn' : '')) : '';
        var c = [_feadResN(d.engineRpm, 0), _feadResN(Number(d.dcPct), 1), _feadResN(d.vMs, 2)];
        (d.perPulley || []).forEach(function(q) { c.push(_feadResN(q.exitTensionN, 0)); });
        c.push(ters ? '—' : _feadResN(m, 2));
        return { c: c, cls: cls };
      })) + (ters ? '<div class="ve-fr-note" data-d="no">Gergi kayışın <b>gergin tarafında</b>: kayma '
        + 'emniyeti hüküm vermez. Çare kayış dönüş yönünü çevirmek ya da gergiyi sürücünün önüne almaktır.</div>'
        : (sfIst > 0 ? '<div class="ve-fr-mute ve-fr-alt">Servis faktörü ' + _feadResN(sfIst, 2)
          + ' — altında kalan satır sarı, SF &lt; 1 kırmızı.</div>' : '')));
    var hh = [{ t: 'Devir' }];
    P.forEach(function(p) { hh.push({ t: _feadResEsc(p.code) }); });
    h += _feadResSec('Hubload', 'büyüklük [N] / yön [°] — +x\'ten saat yönünün tersine',
      _feadResTbl(hh, rows.map(function(d) {
        var c = [_feadResN(d.engineRpm, 0)];
        (d.hubloads || []).forEach(function(x) {
          c.push(_feadResN(x.FN, 0) + ' <span class="ve-fr-mute">/ ' + _feadResN(x.dirDeg, 0) + '°</span>');
        });
        return { c: c };
      })));
  }

  // 4) Gergi kolu konumları
  var pos = A.positions || [];
  if(pos.length) {
    var TR = {};
    if(typeof VE_FEAD_POSITIONS !== 'undefined') VE_FEAD_POSITIONS.forEach(function(p) { TR[p.core] = p.label; });
    h += _feadResSec('Gergi kolu konumları', 'kayış toleransı ve aşınmayla kolun gezdiği zarf', _feadResTbl(
      [{ t: 'Konum', l: 1 }, { t: 'Göreli [°]' }, { t: 'Mutlak [°]' }, { t: 'Gerginlik [N]' },
       { t: 'Hubload [N]' }, { t: 'Yön [°]' }, { t: 'Sarım [°]' }, { t: 'Take-up [mm/°]' }, { t: 'Kayış boyu [mm]' }],
      pos.map(function(p) {
        if(p.error) return { c: [_feadResEsc(TR[p.position] || p.position),
          '<span class="ve-fr-mute" title="' + _feadResEsc(p.error) + '">çözülemedi</span>', '', '', '', '', '', '', ''] };
        return { cls: p.position === 'Mean' ? 'is-ref' : '',
          c: [_feadResEsc(TR[p.position] || p.position), _feadResN(p.relDeg, 1), _feadResN(p.absDeg, 1),
              _feadResN(p.tensionN, 0), _feadResN(p.hubloadN, 0), _feadResN(p.hubDirDeg, 1),
              _feadResN(p.wrapDeg, 1), _feadResN(p.takeupMmPerDeg, 3), _feadResN(p.requiredBeltMm, 1)] };
      })));
  }

  // 5) Burulma modları + ŞEKİLLERİ (bugüne dek yalnız animasyonda görünüyordu)
  var T = R.torsional;
  if(T && Array.isArray(T.elastic) && T.elastic.length) {
    var dofAd = (T.dofNames || []).map(function(nm) {
      if(nm === 'ARM') return 'KOL';
      for(var i = 0; i < P.length; i++) if(P[i].name === nm) return P[i].code;
      return nm;
    });
    var duty0 = (A.duty || []).map(function(d) { return Number(d.firingHz); }).filter(isFinite);
    var fLo = duty0.length ? Math.min.apply(null, duty0) : NaN, fHi = duty0.length ? Math.max.apply(null, duty0) : NaN;
    var mh2 = [{ t: 'Mod' }, { t: 'f [Hz]' }, { t: 'Baskın', l: 1 }];
    dofAd.forEach(function(a) { mh2.push({ t: _feadResEsc(a) }); });
    h += _feadResSec('Burulma modları', 'çalışma (Mean) konumunda · kalibre model (RMS ~%8) · şekil en büyük genliğe normlu',
      _feadResTbl(mh2, T.elastic.map(function(m, k) {
        var amps = (m.shape || []).map(function(s) { return Number(s.amp); });
        var mx = 0, bi = -1;
        amps.forEach(function(a, i) { if(Math.abs(a) > mx) { mx = Math.abs(a); bi = i; } });
        var c = [String(k + 1), _feadResN(m.fHz, 1), bi >= 0 ? '<b>' + _feadResEsc(dofAd[bi]) + '</b>' : '—'];
        amps.forEach(function(a) {
          var v = mx > 0 ? a / mx : 0;
          c.push('<span class="ve-fr-bar' + (v < 0 ? ' neg' : '') + '" style="--fr-v:' + Math.abs(v).toFixed(3)
            + '" title="' + _feadResN(v, 2) + '"><i></i></span>');
        });
        return { c: c, cls: (m.fHz >= fLo && m.fHz <= fHi) ? 'is-warn' : '' };
      }))
      + '<div class="ve-fr-mute ve-fr-alt">Sarı satır: frekansı çevrimin ateşleme bandında ('
      + _feadResN(fLo, 0) + '–' + _feadResN(fHi, 0) + ' Hz). Rijit cisim modu ' + T.rigidBodyModes
      + ' (1 olmalı) listelenmez.'
      // TAKE-UP ÖZDEŞLİĞİ — modelin kendi iç tutarlılık kapısı: kol→açıklık
      // uzama türevlerinin toplamı gergi take-up oranına EŞİT olmak zorunda.
      + ((T.takeupCheck && isFinite(T.takeupCheck.errPct))
          ? ' Take-up özdeşliği %' + _feadResN(T.takeupCheck.errPct, 3) + ' farkla '
            + (T.takeupCheck.errPct < 1 ? 'tutuyor.' : '<b>TUTMUYOR</b> — geometri ile dinamik model ayrışıyor.')
          : '') + '</div>');
  }

  // 5b) Kayış ömrü ve kaburga yorulması — kayış verisine bağlı
  var L = R.life, F = R.fatigue;
  if(L || F) {
    var oh = '';
    if(L && Number(L.damageRate) > 0) {
      var gec = !!L.inValidRange;
      oh += '<div class="ve-fr-big"><b>' + _feadResN(gec ? L.hoursB10 : L.hoursB10Corrected, 0) + '</b>'
         + '<i>saat (B10)' + (gec ? '' : ' — ampirik düzeltmeli') + '</i>'
         + '<span class="ve-fr-mute">ham ' + _feadResN(L.hoursB10, 0) + ' saat · eşdeğer sıcaklık '
         + _feadResN(Number(R.degCEq), 0) + ' °C · çevrim kapsamı %' + _feadResN(Number(L.dutyCoverage) * 100, 1)
         + '</span></div>';
      // SEÇİLEN YORULMA MODELİ MUTLAK ÖMRE GEÇMİYOR — bunu bölümün kendisi söyler.
      if(L.modelMismatch)
        oh += '<div class="ve-fr-note" data-d="warn"><b>Seçilen yorulma modeline göre DEĞİL.</b> Saat değeri '
           + _feadResEsc(L.calibratedModel || 'PK-2_2p-MT3') + ' sabitleriyle kalibre; çözücüde '
           + _feadResEsc(L.modelMismatch) + ' seçili. Aşağıdaki DAĞILIM seçtiğiniz modeli kullanır.</div>';
      if(!gec)
        oh += '<div class="ve-fr-note" data-d="warn"><b>Geçerlilik alanı dışında.</b> Mutlak ömür yalnız bütün '
           + 'kasnak çapları 79,6–176 mm iken doğrulanıyor; aralık dışında sistematik ~0,55× (düzeltme '
           + 'sayıya dâhil). Aralık dışı: ' + _feadResEsc((L.outOfRange || []).join(', '))
           + '. Sertifikasyon için kullanmayın.</div>';
    }
    if(F && F.perPulley && F.perPulley.length) {
      oh += _feadResTbl([{ t: 'Kod', l: 1 }, { t: 'd_eff [mm]' }, { t: 'Temas', l: 1 }, { t: 'Hasar payı [%]' }],
        F.perPulley.map(function(q, i) {
          return { c: ['<b>' + _feadResEsc(P[i] ? P[i].code : q.name) + '</b>', _feadResN(q.dEffMm, 1),
            q.contact === 'back' ? 'sırttan' : 'kaburgalı', _feadResN(q.sharePct, 1)] };
        }))
        + '<div class="ve-fr-mute ve-fr-alt">Dağılım YALNIZ çapa ve temas tarafına bağlı (gerilmeden bağımsız): '
        + 'hasar ∝ w·d<sub>eff</sub><sup>−m</sup>, m = ' + _feadResEsc(F.constants && F.constants.m)
        + ' — göreli karşılaştırmanın güvenilir ölçütü budur, mutlak ömür değil.</div>';
    }
    h += _feadResSec('Kayış ömrü ve kaburga yorulması', F && F.constants ? F.constants.fatigueModel : '', oh);
  }

  // 6) Tepe yükler — Özet Rapor'un üreticisinden (hesaplanıyor, DOĞRULANMIYOR)
  var pk = (typeof _fsrPeak === 'function') ? _fsrPeak(R) : null;
  if(pk && pk.rows && pk.rows.length) {
    h += _feadResSec('Tepe yükler', 'KALİBRE DEĞİL — ' + _feadResN(pk.engineRpm, 0) + ' d/dk, ±'
      + _feadResN(pk.accelRpmS, 0) + ' d/dk/s; aksesuar gücü %100/%10 kombinasyonları', _feadResTbl(
      [{ t: 'Kod', l: 1 }, { t: 'Tepe gerginlik [N]' }, { t: 'Durum', l: 1 }, { t: 'Tepe hubload [N]' }, { t: 'Yön [°]' }],
      pk.rows.map(function(r, i) {
        return { c: ['<b>' + _feadResEsc(P[i] ? P[i].code : r.name) + '</b>', _feadResN(r.tensionN, 0),
          r.accelRpmS > 0 ? 'hızlanma' : 'yavaşlama', _feadResN(r.hubloadN, 0), _feadResN(r.dirDeg, 1)] };
      })) + '<div class="ve-fr-mute ve-fr-alt">Yarı-statik yaklaşım; gergi kolu dinamiği dâhil değil. '
      + 'Doğrulama kümesinde tepe değeri yok — sayı bir mertebe göstergesidir.</div>', 'warn');
  }

  // 7) Hizalama payı — çekirdek hesaplıyordu, hiçbir yüzey göstermiyordu
  var C = (typeof FEADCore !== 'undefined') ? FEADCore : null;
  var al = null;
  if(C && C.alignmentAllowance && sys) {
    try { al = C.alignmentAllowance(C.tensionerState(sys, C.meanRel(sys)).geom); } catch(e) { al = null; }
  }
  if(al && al.length) {
    var kodu = function(nm) { for(var i = 0; i < P.length; i++) if(P[i].name === nm) return P[i].code; return nm; };
    h += _feadResSec('Hizalama payı', 'KALİBRE EDİLMEDİ — kaburgalı kasnağa giriş açıklığında izin verilen eksenel kaçıklık',
      _feadResTbl([{ t: 'Kaburgalı kasnak', l: 1 }, { t: 'Önceki düz kasnak', l: 1 }, { t: 'İzin [mm]' }],
        al.map(function(a) {
          return { c: ['<b>' + _feadResEsc(kodu(a.groovedPulley)) + '</b>',
            a.flatBefore ? _feadResEsc(kodu(a.flatBefore)) : '—', _feadResN(a.axialOffsetAllowMm, 2)] };
        })) + '<div class="ve-fr-mute ve-fr-alt">Kayışın kasnağa giriş (fleeting) açısı sınırından; düz '
      + 'kasnak açısal kaçıklığı girilmediği için 0 alındı. Sertifikasyon için değil.</div>', 'warn');
  }

  // 8) Uygunluk kapıları — kapıların KENDİ durumu ve satırları
  var K = R.checks;
  if(K) {
    var kh = '';
    var gate = function(c, ad, satirF, bas) {
      if(!c) return;
      var d = c.durum === 'ok' ? 'ok' : (c.durum === 'warn' ? 'warn' : (c.durum === 'no' ? 'no' : 'off'));
      kh += '<div class="ve-fr-gate" data-d="' + d + '"><div class="ve-fr-gate-h"><b>' + _feadResEsc(ad) + '</b>'
         + '<span class="ve-fr-chip" data-d="' + d + '">' + (d === 'ok' ? 'Uygun' : (d === 'warn' ? 'Sınırda'
           : (d === 'no' ? 'Uygun değil' : 'Değerlendirilemedi'))) + '</span></div>';
      if(c.rows && c.rows.length && satirF) kh += _feadResTbl(bas, c.rows.map(satirF));
      if(c.note) kh += '<div class="ve-fr-mute ve-fr-alt">' + _feadResEsc(c.note) + '</div>';
      kh += '</div>';
    };
    gate(K.centerDistance, 'Kasnak merkez mesafesi', function(r) {
      return { cls: r.ok ? '' : 'is-warn', c: [_feadResEsc(r.cift), _feadResN(r.lo, 1), _feadResN(r.a, 1),
        _feadResN(r.hi, 1), _feadResN(r.payPct, 1)] };
    }, [{ t: 'Çift', l: 1 }, { t: 'Alt [mm]' }, { t: 'Mesafe [mm]' }, { t: 'Üst [mm]' }, { t: 'Pay [%]' }]);
    gate(K.ratioWindow, 'Çevrim oranı penceresi', null, null);
    gate(K.speedLimit, 'Aksesuar devir sınırı', null, null);
    h += _feadResSec('Uygunluk kapıları', '0,7·(d₁+d₂) ≤ a ≤ 2·(d₁+d₂) · oran penceresi · devir sınırı', kh);
  }

  // 9) Geçerlilik — sınır sonucun İÇİNDE taşınır (FEAD kuralı 10)
  var lim = [];
  if(Array.isArray(R.beltDataOff) && R.beltDataOff.length)
    lim.push('<b>Kayış tipine bağlı çıktılar kapalı</b> — üretilmiyor: ' + R.beltDataOff.map(_feadResEsc).join(' · ') + '.');
  (R.warnings || []).forEach(function(w) { lim.push(_feadResEsc(w)); });
  // R.limits satırları köprünün KENDİ yazdığı, bilinen etiketli metin (veFeadLimitsBox da HTML basıyor).
  (R.limits || []).forEach(function(w) { lim.push(String(w)); });
  if(lim.length)
    h += _feadResSec('Geçerlilik ve uyarılar', 'sayının yanında sınırı', '<ul class="ve-fr-lim">'
      + lim.map(function(x) { return '<li>' + x + '</li>'; }).join('') + '</ul>');

  return h + '</div>';
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFeadResTreeTopHTML: veFeadResTreeTopHTML, veFeadResTreeReportHTML: veFeadResTreeReportHTML,
    veFeadResEmptyHTML: veFeadResEmptyHTML, veFeadResPreset: veFeadResPreset,
    veFeadResSummaryOpen: veFeadResSummaryOpen, veFeadResSummaryHTML: veFeadResSummaryHTML,
    veFeadResKpiHTML: veFeadResKpiHTML, veFeadResChipHTML: veFeadResChipHTML,
    veFeadOpenResults: veFeadOpenResults, VE_FEAD_RES_DURUM: VE_FEAD_RES_DURUM
  };
}
