// ═══════════════════════════════════════════════════════════════════════════
// FEAD DİYAGRAM YORUMU — veri kümesini ve çözümü OKUYUP cümleye çeviren katman
// ═══════════════════════════════════════════════════════════════════════════
//
// js/fead-signals.js panoya SAYI üretir; burası o sayıları ve çözümün
// kendisini (R) okuyup Türkçe yorum yazar. Takoz'un yorum motoruyla
// (js/mount-brief.js) aynı sözleşme:
//
//   build(ds, R)        → { lead, marks }   küme düzeyinde tek satır + işaretler
//   forLane(ds, R, ids) → { title, paras }  ŞERİT başına yorum (çizim anında)
//
// GENEL GEÇER METİN YOK. Her cümle ya bu modelin sayısından türer ya da hiç
// yazılmaz: "en düşük kayma emniyeti 1,23 — ALT'ta, 880 d/dk'da" bu modele
// aittir, "bu grafik kayma emniyetini gösterir" kimseye bir şey öğretmez.
//
// EŞİK UYDURULMAZ. Hüküm yalnız modelin kendi ölçütü olan yerde verilir
// (SF < 1 kayma, SF < servis faktörü); kayma eşiğinin payı bir bilgidir.
//
// VURGU `**...**` ile — HTML üretilmez; sunum katmanı (js/trace-view.js
// `_veTrRich`) önce kaçırır sonra <b>'ye çevirir.
//
// Saf modül: DOM'a dokunmaz, global duruma yazmaz.
// ═══════════════════════════════════════════════════════════════════════════

var veFeadBrief = (function() {
  'use strict';

  // Türkçe ondalık ayracı, binlik ayraç YOK — Takoz'un yorumuyla aynı biçim
  // ("1381 N", "2750 d/dk"); iki modülün şeritleri yan yana aynı dili konuşsun.
  function n(v, dec) {
    if(!isFinite(v)) return '—';
    return (v < 0 ? '−' : '') + Math.abs(v).toFixed(dec == null ? 1 : dec).replace('.', ',');
  }
  function _chan(ds, id) {
    for(var i = 0; i < ds.channels.length; i++) if(ds.channels[i].id === id) return ds.channels[i];
    return null;
  }
  function _ext(arr, xs) {
    var lo = { v: Infinity, i: -1 }, hi = { v: -Infinity, i: -1 };
    (arr || []).forEach(function(v, i) {
      if(!isFinite(v)) return;
      if(v < lo.v) lo = { v: v, i: i };
      if(v > hi.v) hi = { v: v, i: i };
    });
    return { lo: lo.v, loX: lo.i >= 0 ? xs[lo.i] : NaN, hi: hi.v, hiX: hi.i >= 0 ? xs[hi.i] : NaN,
             ok: lo.i >= 0 };
  }
  function _head(name) { return String(name || '').split(' · ')[0]; }
  function _endsWith(s, suf) { return s.slice(-suf.length) === suf; }

  var LEADS = {
    cevrim:   'Çalışma çevriminin çözülmüş devir noktaları: gerginlik, hubload, kayma emniyeti ve aksesuar yükü.',
    campbell: 'Motor uyarma mertebeleri ile FEAD doğal frekanslarının devir düzlemindeki kesişimi.',
    kol:      'Gergi kolunun açısına göre gerginlik, hubload ve take-up — kolun çalışma zarfı.',
    senaryo:  'Marştan stopa bir motor çevrimi — devir geçmişi DAYATILMIŞ (volan ataleti yok), gergi kolu dinamiği dâhil değil.'
  };

  // ── Küme işaretleri — hangi kanalın çizildiğinden bağımsız ───────────────
  function marks(ds, R) {
    var M = [], m = ds.meta || {}, x = ds.x.data;
    if(ds.key === 'cevrim') {
      // En sık çalışılan nokta (çevrim yüzdesi en büyük satır)
      var best = -1;
      (m.dc || []).forEach(function(v, i) { if(isFinite(v) && (best < 0 || v > m.dc[best])) best = i; });
      if(best >= 0 && m.dc[best] > 0)
        M.push({ axis: 'x', value: x[best], kind: 'ref', label: 'en sık · %' + n(m.dc[best], 1) });
      var sf = _chan(ds, 'sfmin');
      if(sf) {
        var e = _ext(sf.data, x);
        if(e.ok) M.push({ axis: 'x', value: e.loX, kind: e.lo < 1 ? 'warn' : 'event',
                          label: 'en düşük SF ' + n(e.lo, 2) });
        M.push({ axis: 'y', value: 1, unit: '×', kind: 'limit', label: 'kayma sınırı SF = 1' });
        if(m.serviceFact > 0)
          M.push({ axis: 'y', value: m.serviceFact, unit: '×', kind: 'stop',
                   label: 'istenen SF ' + n(m.serviceFact, 2) });
      }
      if(m.slipThreshold && m.slipThreshold.tensionN > 0)
        M.push({ axis: 'y', value: m.slipThreshold.tensionN, unit: 'N', kind: 'limit',
                 label: 'kayma eşiği ' + n(m.slipThreshold.tensionN, 0) + ' N' });
    } else if(ds.key === 'campbell') {
      M.push({ axis: 'x', value: m.rpmLo, kind: 'ref', label: 'çevrim ' + n(m.rpmLo, 0) });
      M.push({ axis: 'x', value: m.rpmHi, kind: 'ref', label: 'çevrim ' + n(m.rpmHi, 0) });
      (m.crossings || []).forEach(function(c) {
        M.push({ axis: 'point', value: c.rpm, y: c.f, unit: 'Hz', kind: 'warn',
                 label: n(c.rpm, 0) + ' d/dk' });
      });
    } else if(ds.key === 'kol') {
      // Aynı açıya oturan konumlar (tolerans 0 → Maks = Mean = Min) TEK işaret.
      var TR = {};
      if(typeof VE_FEAD_POSITIONS !== 'undefined')
        VE_FEAD_POSITIONS.forEach(function(p) { TR[p.core] = p.kisa; });
      var kume = [];
      (m.positions || []).forEach(function(p) {
        if(!isFinite(p.rel)) return;
        var k = null;
        kume.forEach(function(q) { if(Math.abs(q.rel - p.rel) < 0.05) k = q; });
        if(!k) { k = { rel: p.rel, ad: [], mean: false, load: false }; kume.push(k); }
        k.ad.push(TR[p.position] || p.position);
        if(p.position === 'Mean') k.mean = true;
        if(p.position === 'Load') k.load = true;
      });
      kume.forEach(function(k) {
        M.push({ axis: 'x', value: k.rel, kind: k.mean ? 'event' : (k.load ? 'stop' : 'ref'),
                 label: k.ad.join(' · ') });
      });
      if(m.slipThreshold && m.slipThreshold.tensionN > 0)
        M.push({ axis: 'y', value: m.slipThreshold.tensionN, unit: 'N', kind: 'limit',
                 label: 'kayma eşiği ' + n(m.slipThreshold.tensionN, 0) + ' N' });
    } else if(ds.key === 'senaryo') {
      (m.phases || []).forEach(function(p, i) {
        if(i === 0) return;                            // "Durgun" t = 0'da
        M.push({ axis: 'x', value: p.t0, kind: 'ref', label: p.ad });
      });
      (m.resonances || []).forEach(function(r) {
        M.push({ axis: 'x', value: r.t, kind: 'warn',
                 label: (m.spanNames[r.si] || 'açıklık') + ' × ' + r.k + '. mertebe' });
      });
    }
    return M;
  }

  // ── Şerit yorumları ──────────────────────────────────────────────────────
  function cevrimLane(ds, R, chans) {
    var x = ds.x.data, m = ds.meta || {}, p = [];
    var ids = chans.map(function(c) { return c.id; });
    var has = function(suf) { return ids.some(function(id) { return id === suf || _endsWith(id, suf); }); };

    if(has('.T') || has('tmax') || has('tmin')) {
      var hi = { v: -Infinity }, lo = { v: Infinity };
      // Açıklık kanalı varsa ad ONDAN (hangi açıklık); yalnız özet kanallar
      // (en yüksek/en düşük) çiziliyse onlardan — ad o zaman açıklığı söylemez.
      var acik = has('.T');
      chans.forEach(function(c) {
        if(c.unit !== 'N') return;
        if(acik ? !_endsWith(c.id, '.T') : !(c.id === 'tmax' || c.id === 'tmin')) return;
        var e = _ext(c.data, x);
        if(!e.ok) return;
        if(e.hi > hi.v) hi = { v: e.hi, x: e.hiX, ad: _head(c.name) };
        if(e.lo < lo.v) lo = { v: e.lo, x: e.loX, ad: _head(c.name) };
      });
      if(isFinite(hi.v))
        p.push('En yüksek gerginlik **' + n(hi.v, 0) + ' N** (' + (acik ? hi.ad + ', ' : '') + n(hi.x, 0) + ' d/dk); '
          + 'en düşüğü **' + n(lo.v, 0) + ' N** (' + (acik ? lo.ad + ', ' : '') + n(lo.x, 0) + ' d/dk).'
          + (R.analysis && R.analysis.tensioner && isFinite(R.analysis.tensioner.tensionN)
              ? ' Gergi ankrajı **' + n(R.analysis.tensioner.tensionN, 0) + ' N** — yay dengesinden.' : ''));
      if(lo.v < 0)
        p.push('Bir açıklıkta gerginlik **negatif**: kayış o devirde gevşiyor. Ankraj yay dengesinden '
          + 'türediği için yükseltilemez; çekilen güç ya da gerginin yeri gözden geçirilmeli.');
      if(m.slipThreshold && m.slipThreshold.tensionN > 0)
        p.push('Kaymamak için gereken en düşük ankraj **' + n(m.slipThreshold.tensionN, 0) + ' N** ('
          + m.slipThreshold.pulley + ', ' + n(m.slipThreshold.engineRpm, 0) + ' d/dk); tasarım gerginliği '
          + 'bunun **' + n(m.slipThreshold.margin, 2) + ' katı**.');
    }
    if(has('.sf') || has('sfmin')) {
      var s = _chan(ds, 'sfmin');
      var e = s ? _ext(s.data, x) : null;
      if(e && e.ok) {
        var enK = null;
        chans.forEach(function(c) {
          if(!_endsWith(c.id, '.sf')) return;
          var ee = _ext(c.data, x);
          if(ee.ok && (!enK || ee.lo < enK.v)) enK = { v: ee.lo, ad: _head(c.name) };
        });
        p.push('En düşük kayma emniyeti **' + n(e.lo, 2) + '** — ' + (enK ? enK.ad + ' kasnağında, ' : '')
          + n(e.loX, 0) + ' d/dk\'da. ' + (e.lo < 1 ? '**SF 1\'in altında: kayış o devirde kayar.**'
            : 'SF 1\'in üstünde: kayma yok.'));
        if(m.serviceFact > 0)
          p.push('İstenen servis faktörü **' + n(m.serviceFact, 2) + '** — en kötü nokta **'
            + (e.lo >= m.serviceFact ? 'GEÇTİ' : 'KALDI') + '**.');
      }
      p.push('Yalnız YÜK TAŞIYAN kasnaklar çizilir: gerginlik oranı ≈ 1 olan avarada SF bir marj değil, '
        + 'o sarım açısının kapasitesidir.');
    } else if(m.ters && has('.T')) {
      p.push('Gergi kayışın **gergin tarafında**: kayma emniyeti bu modelde hüküm vermez ve çizilmez.');
    }
    if(has('.hub')) {
      var hb = { v: -Infinity };
      chans.forEach(function(c) {
        if(!_endsWith(c.id, '.hub')) return;
        var e2 = _ext(c.data, x);
        if(e2.ok && e2.hi > hb.v) hb = { v: e2.hi, x: e2.hiX, ad: _head(c.name) };
      });
      if(isFinite(hb.v))
        p.push('En büyük hubload **' + n(hb.v, 0) + ' N** — ' + hb.ad + ', ' + n(hb.x, 0) + ' d/dk. '
          + 'Kasnak rulmanı ve aksesuar mili bu kuvveti taşır.');
    }
    if(has('.dir')) {
      var dy = { v: -1 };
      chans.forEach(function(c) {
        if(!_endsWith(c.id, '.dir')) return;
        var e3 = _ext(c.data, x);
        if(e3.ok && e3.hi - e3.lo > dy.v) dy = { v: e3.hi - e3.lo, ad: _head(c.name) };
      });
      if(dy.v >= 0)
        p.push('Hubload yönü en çok **' + dy.ad + '** kasnağında değişiyor: çevrim boyunca **'
          + n(dy.v, 1) + '°**. Yön +x\'ten saat yönünün tersine (Gates pusula konvansiyonu).');
    }
    if(has('.rpm')) {
      var rp = { v: -Infinity };
      chans.forEach(function(c) {
        if(!_endsWith(c.id, '.rpm')) return;
        var e4 = _ext(c.data, x);
        if(e4.ok && e4.hi > rp.v) rp = { v: e4.hi, x: e4.hiX, ad: _head(c.name) };
      });
      if(isFinite(rp.v))
        p.push('En hızlı dönen kasnak **' + rp.ad + '**: **' + n(rp.v, 0) + ' d/dk** (motor '
          + n(rp.x, 0) + ' d/dk). Aksesuar devir sınırı uygunluk kapısında denetlenir.');
    }
    if(has('.nm')) {
      var q = { v: -Infinity };
      chans.forEach(function(c) {
        if(!_endsWith(c.id, '.nm')) return;
        var e5 = _ext(c.data, x);
        if(e5.ok && e5.hi > q.v) q = { v: e5.hi, x: e5.hiX, ad: _head(c.name) };
      });
      if(isFinite(q.v))
        p.push('En büyük ortalama mil torku **' + n(q.v, 1) + ' Nm** — ' + q.ad + ', ' + n(q.x, 0)
          + ' d/dk (Q = 9549·P/n). Hızlanmadaki atalet tepeleri bu değere dâhil DEĞİL.');
    }
    if(has('.f1')) {
      var fl = { v: Infinity };
      chans.forEach(function(c) {
        if(!_endsWith(c.id, '.f1')) return;
        var e6 = _ext(c.data, x);
        if(e6.ok && e6.lo < fl.v) fl = { v: e6.lo, x: e6.loX, ad: _head(c.name) };
      });
      if(isFinite(fl.v))
        p.push('En düşük açıklık frekansı **' + n(fl.v, 1) + ' Hz** (' + fl.ad + ', ' + n(fl.x, 0)
          + ' d/dk). Frekans merkezkaç payıyla GERÇEK gerginlikten; bu düzeltme türetilmiştir, '
          + 'tedarikçiye kalibre değildir.');
    }
    if(has('fat')) {
      var f7 = _chan(ds, 'fat'), e7 = f7 ? _ext(f7.data, x) : null;
      if(e7 && e7.ok)
        p.push('Kaburga yorulmasının en büyük payı **%' + n(e7.hi, 1) + '** ile **' + n(e7.hiX, 0)
          + ' d/dk** satırından — devir × çevrim yüzdesi × kayış geçiş sayısı.');
    }
    if(has('v') || has('fire') || has('pkw')) {
      var v = _chan(ds, 'v'), pk = _chan(ds, 'pkw');
      var ev = v ? _ext(v.data, x) : null, ep = pk ? _ext(pk.data, x) : null;
      if(ev && ev.ok)
        p.push('Kayış hızı **' + n(ev.lo, 1) + '–' + n(ev.hi, 1) + ' m/s**'
          + (ep && ep.ok ? '; sürücünün çektiği güç **' + n(ep.lo, 1) + '–' + n(ep.hi, 1) + ' kW** (aksesuarların toplamı).' : '.'));
    }
    if(!p.length) p.push('Çalışma çevriminin ' + (m.n || x.length) + ' çözülmüş devir noktası.');
    var title = chans.length === 1 ? chans[0].name : (ds.name + ' — ' + chans.length + ' kanal');
    return { title: title, paras: p };
  }

  function campbellLane(ds, R, chans) {
    var m = ds.meta || {}, p = [];
    var cr = (m.crossings || []);
    var tors = cr.filter(function(c) { return c.kind === 'tors'; });
    var span = cr.filter(function(c) { return c.kind === 'span'; });
    p.push('Çalışma bandı **' + n(m.rpmLo, 0) + '–' + n(m.rpmHi, 0) + ' d/dk** (çevrimin uçları). '
      + 'Mertebeler: dönme ve ateşlemenin 1×–4× katı (' + n(m.cyl, 0) + ' silindir).');
    if(m.modes && m.modes.length) {
      p.push(tors.length
        ? 'Bantta **' + tors.length + ' burulma kesişimi**: ' + tors.slice(0, 6).map(function(c) {
            return 'mod ' + c.mode + ' (' + n(c.f, 1) + ' Hz) × ' + c.label + ' → **' + n(c.rpm, 0) + ' d/dk**';
          }).join(' · ') + (tors.length > 6 ? ' · (+' + (tors.length - 6) + ')' : '') + '.'
        : 'Bantta burulma modu kesişimi yok: ' + m.modes.length + ' elastik modun hiçbiri çalışma '
          + 'devirlerinde bir mertebeyle çakışmıyor.');
      p.push('Burulma modeli KALİBRE bir modeldir (Gates System Resonance\'a 6 sistemde RMS ~%8) — '
        + 'bir mertebe göstergesi olarak okuyun.');
    }
    if(!m.beltOn) {
      p.push('Açıklık frekansları **çizilmiyor**: kayış tipine bağlı çıktılar kapalı (birim kütle '
        + 'katalogdan gelir). Kayış Özellikleri panelinden açılabilir.');
    } else if(span.length) {
      p.push('Açıklık frekansı kesişimleri: ' + span.slice(0, 6).map(function(c) {
        return c.span + ' × ' + c.label + ' → **' + n(c.rpm, 0) + ' d/dk**';
      }).join(' · ') + (span.length > 6 ? ' · (+' + (span.length - 6) + ')' : '') + '.');
    }
    var title = chans.length === 1 ? chans[0].name : (ds.name + ' — ' + chans.length + ' kanal');
    return { title: title, paras: p };
  }

  function kolLane(ds, R, chans) {
    var m = ds.meta || {}, p = [], x = ds.x.data;
    var mean = null, free = null, load = null;
    (m.positions || []).forEach(function(q) {
      if(q.position === 'Mean') mean = q;
      if(q.position === 'FreeArm') free = q;
      if(q.position === 'Load') load = q;
    });
    if(mean)
      p.push('Çalışma noktası (Mean) **' + n(mean.rel, 1) + '°** — gerginlik **' + n(mean.T, 0)
        + ' N**, gergi hubload **' + n(mean.hub, 0) + ' N**.');
    var T = _chan(ds, 'T'), e = T ? _ext(T.data, x) : null;
    if(e && e.ok)
      p.push('Kol serbest konumdan ' + (load ? 'load stop\'a (**' + n(load.rel, 1) + '°**)' : 'erişim sınırına')
        + ' giderken gerginlik **' + n(e.lo, 0) + '–' + n(e.hi, 0) + ' N** arasında geziyor.'
        + (isFinite(m.cutAt) ? ' Eğri kolun ucunda tekilleşir; konum gerginliklerinin 1,6 katında (**'
            + n(m.tCap, 0) + ' N**) kesildi.' : ''));
    if(chans.some(function(c) { return c.id === 'tk'; }))
      p.push('Take-up oranı dL/dθ gerginin kayış boyunu ne hızla topladığıdır; gerginlik T = M/(dL/dθ) '
        + 'olduğu için oran küçüldükçe gerginlik büyür.');
    if(!p.length) p.push('Gergi kolu taraması: ' + x.length + ' nokta.');
    var title = chans.length === 1 ? chans[0].name : (ds.name + ' — ' + chans.length + ' kanal');
    return { title: title, paras: p };
  }

  // Senaryo künyesinin notları KONUSUNA göre şeride düşer — üç şerit açıkken
  // aynı altı cümle üç kez yazılıyordu (ölçüldü, gerçek tarayıcı). Devir
  // şeridi rampanın nereden geldiğini, gerginlik şeridi hangi ankrajdan
  // yürüdüğünü, frekans şeridi frekansın varlığını anlatır.
  var SCN_NOT = [
    { re: /Rampa|DAYATILMIŞ|Marş devri|İvme girilmemiş/, tur: 'devir' },
    { re: /Gergi kolu dinamiği|Gerilme ÇİZİLEN/,          tur: 'gerg' },
    { re: /Açıklık frekansları/,                          tur: 'frek' }
  ];
  function _scnTur(t) {
    for(var i = 0; i < SCN_NOT.length; i++) if(SCN_NOT[i].re.test(t)) return SCN_NOT[i].tur;
    return 'devir';
  }
  function senaryoLane(ds, R, chans) {
    var m = ds.meta || {}, p = [];
    var ids = chans.map(function(c) { return c.id; });
    var devir = ids.some(function(id) { return id === 'rpm' || id === 'alpha' || id === 'v'; });
    var gerg = ids.some(function(id) { return _endsWith(id, '.T') || id === 'tmax' || id === 'tmin'; });
    var frek = ids.some(function(id) { return _endsWith(id, '.f1') || id === 'fire'; });
    var not = function(tur) {
      (m.notes || []).forEach(function(t) { if(_scnTur(t) === tur) p.push(t); });
    };
    if(devir) {
      p.push('Çevrim **' + n(m.T, 1) + ' s**: rölanti **' + n(m.idle, 0) + '**, tepe **' + n(m.peak, 0)
        + ' d/dk**; ivme **' + n(m.accel, 0) + '**, yavaşlama **' + n(m.decel, 0) + ' d/dk/s**.');
      not('devir');
    }
    if(gerg) {
      p.push('Açıklık gerginlikleri çevrim boyunca **' + n(m.tMin, 0) + '–' + n(m.tMax, 0) + ' N** '
        + 'arasında geziyor; ivme gerilmeyi doğrusal oynatır (T = A(N) + α·B(N)).');
      not('gerg');
    }
    if(frek) {
      if(m.fOff) not('frek');
      else if((m.resonances || []).length)
        p.push('Rezonans geçişleri: ' + m.resonances.slice(0, 5).map(function(r) {
          return (m.spanNames[r.si] || 'açıklık') + ' × ' + r.k + '. mertebe (**' + n(r.t, 1) + ' s**, '
            + n(r.rpm, 0) + ' d/dk)';
        }).join(' · ') + '.');
      else
        p.push('Çevrim boyunca hiçbir açıklık ateşlemenin 1×–4× katına %4\'ten yakın geçmiyor.');
    }
    if(!p.length) p.push('Motor çevrimi senaryosu: ' + ds.x.data.length + ' örnek, ' + n(m.T, 1) + ' s.');
    var title = chans.length === 1 ? chans[0].name : (ds.name + ' — ' + chans.length + ' kanal');
    return { title: title, paras: p };
  }

  function forLane(ds, R, ids) {
    if(!ds || !R || !ids || !ids.length) return null;
    try {
      var chans = ids.map(function(id) { return _chan(ds, id); }).filter(Boolean);
      if(!chans.length) return null;
      if(ds.key === 'cevrim')   return cevrimLane(ds, R, chans);
      if(ds.key === 'campbell') return campbellLane(ds, R, chans);
      if(ds.key === 'kol')      return kolLane(ds, R, chans);
      if(ds.key === 'senaryo')  return senaryoLane(ds, R, chans);
      return null;
    } catch(e) { return null; }
  }

  function build(ds, R) {
    if(!ds || !R || !LEADS[ds.key]) return null;
    try { return { lead: LEADS[ds.key], marks: marks(ds, R) }; }
    catch(e) { return null; }
  }

  return { build: build, forLane: forLane, LEADS: LEADS, _n: n };
})();

if(typeof module !== 'undefined' && module.exports) { module.exports = veFeadBrief; }
