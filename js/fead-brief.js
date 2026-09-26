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
  // Eğrinin x'teki değeri (doğrusal ara değer; aralık dışı NaN).
  function _at(xs, ys, x) {
    for(var i = 1; i < xs.length; i++) {
      if(x >= xs[i - 1] && x <= xs[i]) {
        var a = ys[i - 1], b = ys[i], d = xs[i] - xs[i - 1];
        if(!isFinite(a) || !isFinite(b)) return NaN;
        return d > 0 ? a + (b - a) * (x - xs[i - 1]) / d : a;
      }
    }
    return NaN;
  }
  function _endsWith(s, suf) { return s.slice(-suf.length) === suf; }
  // Birime göre ondalık — yedek aralık cümlesi için.
  var DEC = { 'N': 0, 'd/dk': 0, 'd/dk/s': 0, '×': 2, 'mm/°': 3 };
  function _dec(u) { return Object.prototype.hasOwnProperty.call(DEC, u) ? DEC[u] : 1; }
  // Hiçbir cümlenin anlatmadığı kanal için: adı ve aralığı. Şerit boş kalmaz
  // ve cümle kanalın adını taşıdığı için iki şeritte aynı paragraf olamaz.
  function _aralik(c, x) {
    var e = _ext(c.data, x);
    if(!e.ok) return '**' + c.name + '**: bu çözümde değer yok.';
    var d = _dec(c.unit);
    return '**' + c.name + '**: ' + n(e.lo, d) + '–' + n(e.hi, d) + (c.unit ? ' ' + c.unit : '') + '.';
  }
  // Gerginlik ailesinin SAHİP kanalı: gerginin çıkış açıklığı; gergi yoksa zarf.
  function _tSahip(ds) {
    var t = ds.meta && ds.meta.tenKey;
    return (t && _chan(ds, t + '.T')) ? t + '.T' : 'tmin';
  }
  // Şeridin anlatılmamış kanalları için yedek cümleler.
  function _kalan(chans, soylendi, x, p) {
    chans.forEach(function(c) { if(!soylendi[c.id]) p.push(_aralik(c, x)); });
  }

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
  //
  // ŞERİT YALNIZ KENDİ KANALLARINI ANLATIR. Kümenin geneline dair bir cümle
  // (ankraj, kayma eşiği, servis faktörü hükmü, kalibrasyon notu) TEK bir
  // SAHİP kanalın şeridine düşer — ya da aynı aileden birden çok kanalı
  // toplayan şeride. Sahipler: gerginin çıkış açıklığı (ankraj gerginliğini
  // o taşır; gergi yoksa `tmin`) · `sfmin` · `tc` · `tmod.1`. Yoksa "Ayır"
  // sonrası aynı paragraf kanal sayısı kadar yazılıyordu — ölçüldü: 22
  // örnek×kayış durumunda, Ayır · ön ayar · ön ayar→Ayır düzenlerinde 3 527
  // fazla kopya (kapı: tests/unit/fead-sonuclar.test.js → "TEKRAR ETMEZ").
  function cevrimLane(ds, R, chans) {
    var x = ds.x.data, m = ds.meta || {}, p = [], soylendi = {};
    var ids = chans.map(function(c) { return c.id; });
    var has = function(id) { return ids.indexOf(id) >= 0; };
    var aile = function(suf) { return chans.filter(function(c) { return _endsWith(c.id, suf); }); };
    var say = function(list) { list.forEach(function(c) { soylendi[c.id] = true; }); };
    // Ailenin en uç değeri ve sahibi (kanalın adı)
    var uc = function(list, enBuyuk) {
      var r = null;
      list.forEach(function(c) {
        var e = _ext(c.data, x);
        if(!e.ok) return;
        var v = enBuyuk ? e.hi : e.lo, vx = enBuyuk ? e.hiX : e.loX;
        if(!r || (enBuyuk ? v > r.v : v < r.v)) r = { v: v, x: vx, ad: _head(c.name) };
      });
      return r;
    };
    var NEG = ' Gerginlik **negatif**: kayış o devirde gevşiyor.';

    // ── Gerginlik: açıklık kanalları + zarf (tmax/tmin)
    var tA = aile('.T');
    var tO = chans.filter(function(c) { return c.id === 'tmax' || c.id === 'tmin'; });
    if(tA.length || tO.length) {
      var kay = tA.length ? tA : tO;
      var hi = uc(kay, true), lo = uc(kay, false);
      if(hi && lo) {
        if(kay.length === 1 && !tA.length)
          p.push(tO[0].id === 'tmax'
            ? 'Açıklıkların en yüksek gerginliği **' + n(hi.v, 0) + ' N** (' + n(hi.x, 0) + ' d/dk).'
            : 'Açıklıkların en düşük gerginliği **' + n(lo.v, 0) + ' N** (' + n(lo.x, 0) + ' d/dk).'
              + (lo.v < 0 ? NEG : ''));
        else if(kay.length === 1)
          p.push('**' + hi.ad + '** gerginliği **' + n(lo.v, 0) + '–' + n(hi.v, 0) + ' N** (en yüksek '
            + n(hi.x, 0) + ' d/dk, en düşük ' + n(lo.x, 0) + ' d/dk).' + (lo.v < 0 ? NEG : ''));
        else
          p.push('En yüksek gerginlik **' + n(hi.v, 0) + ' N** (' + (tA.length ? hi.ad + ', ' : '') + n(hi.x, 0)
            + ' d/dk); en düşüğü **' + n(lo.v, 0) + ' N** (' + (tA.length ? lo.ad + ', ' : '') + n(lo.x, 0)
            + ' d/dk).' + (lo.v < 0 ? NEG : ''));
      }
      if(tA.length >= 2 || has(_tSahip(ds))) {
        var an = R.analysis && R.analysis.tensioner && R.analysis.tensioner.tensionN;
        var tmn = _chan(ds, 'tmin'), eg = tmn ? _ext(tmn.data, x) : null;
        if(isFinite(an))
          p.push('Gergi ankrajı **' + n(an, 0) + ' N** — yay dengesinden.'
            + (eg && eg.ok && eg.lo < 0 ? ' Yükseltilemez; bir açıklık gevşiyorsa çekilen güç ya da '
              + 'gerginin yeri gözden geçirilmeli.' : ''));
        if(m.slipThreshold && m.slipThreshold.tensionN > 0)
          p.push('Kaymamak için gereken en düşük ankraj **' + n(m.slipThreshold.tensionN, 0) + ' N** ('
            + m.slipThreshold.pulley + ', ' + n(m.slipThreshold.engineRpm, 0) + ' d/dk); tasarım gerginliği '
            + 'bunun **' + n(m.slipThreshold.margin, 2) + ' katı**.');
        if(m.ters)
          p.push('Gergi kayışın **gergin tarafında**: kayma emniyeti bu modelde hüküm vermez ve çizilmez.');
      }
      say(tA); say(tO);
    }

    // ── Kayma emniyeti: zarf (sfmin) kümenin hükmünü taşır
    var sA = aile('.sf');
    if(has('sfmin')) {
      var e = _ext(_chan(ds, 'sfmin').data, x);
      if(e.ok) {
        var enK = uc(ds.channels.filter(function(c) { return _endsWith(c.id, '.sf'); }), false);
        p.push('En düşük kayma emniyeti **' + n(e.lo, 2) + '** — ' + (enK ? enK.ad + ' kasnağında, ' : '')
          + n(e.loX, 0) + ' d/dk\'da. ' + (e.lo < 1 ? '**SF 1\'in altında: kayış o devirde kayar.**'
            : 'SF 1\'in üstünde: kayma yok.'));
        if(m.serviceFact > 0)
          p.push('İstenen servis faktörü **' + n(m.serviceFact, 2) + '** — en kötü nokta **'
            + (e.lo >= m.serviceFact ? 'GEÇTİ' : 'KALDI') + '**.');
      }
      p.push('Yalnız YÜK TAŞIYAN kasnaklar çizilir: gerginlik oranı ≈ 1 olan avarada SF bir marj değil, '
        + 'o sarım açısının kapasitesidir.');
      say(sA); soylendi.sfmin = true;
    } else if(sA.length) {
      var sl = sA.map(function(c) {
        var ee = _ext(c.data, x);
        return ee.ok ? { ad: _head(c.name), v: ee.lo, x: ee.loX } : null;
      }).filter(Boolean);
      if(sl.length === 1)
        p.push('**' + sl[0].ad + '** kasnağında en düşük kayma emniyeti **' + n(sl[0].v, 2) + '** ('
          + n(sl[0].x, 0) + ' d/dk).' + (sl[0].v < 1 ? ' **SF 1\'in altında: o devirde kayar.**' : ''));
      else if(sl.length)
        p.push('Kasnak başına en düşük kayma emniyeti: ' + sl.map(function(q) {
          return q.ad + ' **' + n(q.v, 2) + '** (' + n(q.x, 0) + ' d/dk)';
        }).join(' · ') + '.' + (sl.some(function(q) { return q.v < 1; })
          ? ' **SF 1\'in altındaki kasnak o devirde kayar.**' : ''));
      say(sl.length ? sA : []);
    }

    // ── Hubload büyüklüğü ve yönü
    var hA = aile('.hub');
    if(hA.length) {
      var hb = uc(hA, true);
      if(hb) {
        p.push((hA.length === 1 ? '**' + hb.ad + '** hubload\'u en fazla **' + n(hb.v, 0) + ' N** ('
            + n(hb.x, 0) + ' d/dk).'
          : 'En büyük hubload **' + n(hb.v, 0) + ' N** — ' + hb.ad + ', ' + n(hb.x, 0) + ' d/dk.')
          + ' Kasnak rulmanı ve aksesuar mili bu kuvveti taşır.');
        say(hA);
      }
    }
    var dA = aile('.dir');
    if(dA.length) {
      var dy = null;
      dA.forEach(function(c) {
        var e3 = _ext(c.data, x);
        if(e3.ok && (!dy || e3.hi - e3.lo > dy.v)) dy = { v: e3.hi - e3.lo, ad: _head(c.name) };
      });
      if(dy) {
        p.push((dA.length === 1 ? '**' + dy.ad + '** kasnağında hubload yönü çevrim boyunca **' + n(dy.v, 1)
            + '°** değişiyor.'
          : 'Hubload yönü en çok **' + dy.ad + '** kasnağında değişiyor: çevrim boyunca **' + n(dy.v, 1) + '°**.')
          + ' Yön +x\'ten saat yönünün tersine (Gates pusula konvansiyonu).');
        say(dA);
      }
    }

    // ── Aksesuar: devir, tork, güç
    var rA = aile('.rpm');
    if(rA.length) {
      var rp = uc(rA, true);
      if(rp) {
        p.push((rA.length === 1 ? '**' + rp.ad + '** kasnağı en fazla **' + n(rp.v, 0) + ' d/dk** döner (motor '
            + n(rp.x, 0) + ' d/dk).'
          : 'En hızlı dönen kasnak **' + rp.ad + '**: **' + n(rp.v, 0) + ' d/dk** (motor ' + n(rp.x, 0) + ' d/dk).')
          + ' Aksesuar devir sınırı uygunluk kapısında denetlenir.');
        say(rA);
      }
    }
    var qA = aile('.nm');
    if(qA.length) {
      var q = uc(qA, true);
      if(q) {
        p.push((qA.length === 1 ? '**' + q.ad + '** mil torku en fazla **' + n(q.v, 1) + ' Nm** (' + n(q.x, 0)
            + ' d/dk).'
          : 'En büyük ortalama mil torku **' + n(q.v, 1) + ' Nm** — ' + q.ad + ', ' + n(q.x, 0) + ' d/dk.')
          + ' Q = 9549·P/n; hızlanmadaki atalet tepeleri bu değere dâhil DEĞİL.');
        say(qA);
      }
    }
    var kA = aile('.kw');
    if(kA.length) {
      var kw = uc(kA, true);
      if(kw) {
        if(kA.length === 1) {
          var ek = _ext(kA[0].data, x);
          p.push('**' + kw.ad + '** aksesuarı **' + n(ek.lo, 1) + '–' + n(ek.hi, 1) + ' kW** çekiyor (en çok '
            + n(kw.x, 0) + ' d/dk\'da).');
        } else
          p.push('En çok güç çeken aksesuar **' + kw.ad + '**: **' + n(kw.v, 1) + ' kW** (' + n(kw.x, 0) + ' d/dk).');
        say(kA);
      }
    }
    if(has('pkw')) {
      var ep = _ext(_chan(ds, 'pkw').data, x);
      if(ep.ok) {
        p.push('Sürücünün çektiği güç **' + n(ep.lo, 1) + '–' + n(ep.hi, 1) + ' kW** (aksesuarların toplamı).');
        soylendi.pkw = true;
      }
    }
    if(has('v')) {
      var ev = _ext(_chan(ds, 'v').data, x);
      if(ev.ok) { p.push('Kayış hızı **' + n(ev.lo, 1) + '–' + n(ev.hi, 1) + ' m/s**.'); soylendi.v = true; }
    }

    // ── Açıklık frekansı ve merkezkaç: kalibrasyon notu tek sahipte
    var fA = aile('.f1');
    if(fA.length) {
      var fl = uc(fA, false);
      if(fl) {
        p.push(fA.length === 1
          ? '**' + fl.ad + '** açıklık frekansı en düşük **' + n(fl.v, 1) + ' Hz** (' + n(fl.x, 0) + ' d/dk).'
          : 'En düşük açıklık frekansı **' + n(fl.v, 1) + ' Hz** (' + fl.ad + ', ' + n(fl.x, 0) + ' d/dk).');
        say(fA);
      }
    }
    if(has('tc')) {
      var et = _ext(_chan(ds, 'tc').data, x);
      if(et.ok) {
        p.push('Merkezkaç gerginliği m′v² **' + n(et.lo, 0) + '–' + n(et.hi, 0) + ' N** — kayış hızının '
          + 'karesiyle büyür.');
        soylendi.tc = true;
      }
    }
    if(fA.length >= 2 || has('tc'))
      p.push('Frekans merkezkaç payıyla GERÇEK gerginlikten; bu düzeltme türetilmiştir, tedarikçiye '
        + 'kalibre değildir.');
    if(has('fat')) {
      var e7 = _ext(_chan(ds, 'fat').data, x);
      if(e7.ok) {
        p.push('Kaburga yorulmasının en büyük payı **%' + n(e7.hi, 1) + '** ile **' + n(e7.hiX, 0)
          + ' d/dk** satırından — devir × çevrim yüzdesi × kayış geçiş sayısı.');
        soylendi.fat = true;
      }
    }
    _kalan(chans, soylendi, x, p);
    var title = chans.length === 1 ? chans[0].name : (ds.name + ' — ' + chans.length + ' kanal');
    return { title: title, paras: p };
  }

  // ŞERİT İÇERİĞİNE GÖRE: tam Campbell (mertebe + yatay çizgi) bandı ve
  // kesişimleri anlatır; "Ayır" ile bölünmüş tek bir mertebe ya da mod
  // şeridi YALNIZ kendi kesişimlerini söyler. Aynı paragrafın on bir şeritte
  // on bir kez yazılması bir yorum değil gürültüdür (senaryo/kol kuralı).
  function campbellLane(ds, R, chans) {
    var m = ds.meta || {}, p = [];
    var cr = (m.crossings || []);
    var ords = chans.filter(function(c) { return c.id.indexOf('ord.') === 0; });
    var mods = chans.filter(function(c) { return c.id.indexOf('tmod.') === 0; });
    var spns = chans.filter(function(c) { return _endsWith(c.id, '.f1'); });
    var tam = ords.length && (mods.length || spns.length);
    var title = chans.length === 1 ? chans[0].name : (ds.name + ' — ' + chans.length + ' kanal');
    if(tam) {
      var tors = cr.filter(function(c) { return c.kind === 'tors'; });
      var span = cr.filter(function(c) { return c.kind === 'span'; });
      p.push('Çalışma bandı **' + n(m.rpmLo, 0) + '–' + n(m.rpmHi, 0) + ' d/dk** (çevrimin uçları). '
        + 'Mertebeler: dönme ve ateşlemenin 1×–4× katı (' + n(m.cyl, 0) + ' silindir).');
      if(mods.length) {
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
          + 'katalogdan gelir). Kayış Özellikleri penceresinden (çizimde kayışa tıklayın) açılabilir.');
      } else if(spns.length && span.length) {
        p.push('Açıklık frekansı kesişimleri: ' + span.slice(0, 6).map(function(c) {
          return c.span + ' × ' + c.label + ' → **' + n(c.rpm, 0) + ' d/dk**';
        }).join(' · ') + (span.length > 6 ? ' · (+' + (span.length - 6) + ')' : '') + '.');
      }
      return { title: title, paras: p };
    }
    // Yalnız mertebe doğruları
    ords.forEach(function(c) {
      // Kimlik mertebeyi 1e-3'e yuvarlıyor (fead-signals `_ordId`); mertebe
      // künyeden AYNI yuvarlamayla bulunur — kimliği sayıya geri çevirmek
      // yuvarlanmış değeri kesişimin gerçek mertebesiyle karşılaştırırdı.
      var od = null;
      (m.orders || []).forEach(function(q) {
        if('ord.' + String(Math.round(q.o * 1000) / 1000).replace('.', '_') === c.id) od = q;
      });
      if(!od) return;
      var o = od.o;
      var bu = cr.filter(function(k) { return k.o === o; });
      p.push('**' + _head(c.name) + '**: f = ' + n(o, o % 1 ? 1 : 0) + '·N/60 — bantta **'
        + n(o * m.rpmLo / 60, 1) + '–' + n(o * m.rpmHi / 60, 1) + ' Hz**. '
        + (bu.length ? 'Kesişimler: ' + bu.map(function(k) {
            return (k.kind === 'tors' ? 'mod ' + k.mode : k.span) + ' → **' + n(k.rpm, 0) + ' d/dk**';
          }).join(' · ') + '.' : 'Bantta kesişim yok.'));
    });
    // Yalnız burulma modu çizgileri — kalibrasyon notu 1. modun şeridinde
    mods.forEach(function(c) {
      var k = Number(c.id.slice(5));
      var bu = cr.filter(function(x) { return x.kind === 'tors' && x.mode === k; });
      p.push('**Mod ' + k + '** (' + n(c.data[0], 1) + ' Hz): ' + (bu.length
        ? 'bantta ' + bu.map(function(x) { return x.label + ' → **' + n(x.rpm, 0) + ' d/dk**'; }).join(' · ') + '.'
        : 'çalışma bandında hiçbir mertebeyle kesişmiyor.'));
    });
    if(mods.some(function(c) { return c.id === 'tmod.1'; })) {
      p.push('Burulma modeli KALİBRE bir modeldir (Gates System Resonance\'a 6 sistemde RMS ~%8) — '
        + 'bir mertebe göstergesi olarak okuyun.');
      if(!m.beltOn)
        p.push('Açıklık frekansları **çizilmiyor**: kayış tipine bağlı çıktılar kapalı (birim kütle '
          + 'katalogdan gelir). Kayış Özellikleri penceresinden (çizimde kayışa tıklayın) açılabilir.');
    }
    // Yalnız açıklık frekansları
    spns.forEach(function(c) {
      var ad = _head(c.name);
      var bu = cr.filter(function(x) { return x.kind === 'span' && x.span === ad; });
      p.push('**' + ad + '**: ' + (bu.length
        ? bu.map(function(x) { return x.label + ' → **' + n(x.rpm, 0) + ' d/dk**'; }).join(' · ') + '.'
        : 'çalışma bandında hiçbir mertebeyle kesişmiyor.'));
    });
    if(!p.length) chans.forEach(function(c) { p.push(_aralik(c, ds.x.data)); });
    return { title: title, paras: p };
  }

  // Kol şeritleri de İÇERİĞİNE göre: gerginlik/hubload şeridi çalışma
  // noktasını ve gezme aralığını, take-up şeridi oranı, sarım şeridi sarımı
  // anlatır — üç şeritte aynı iki cümle yazılıyordu (ölçüldü, gerçek tarayıcı).
  function kolLane(ds, R, chans) {
    var m = ds.meta || {}, p = [], x = ds.x.data;
    var ids = chans.map(function(c) { return c.id; });
    var has = function(id) { return ids.indexOf(id) >= 0; };
    var mean = null, load = null;
    (m.positions || []).forEach(function(q) {
      if(q.position === 'Mean') mean = q;
      if(q.position === 'Load') load = q;
    });
    var deger = function(id) {
      var c = _chan(ds, id);
      return (c && mean && isFinite(mean.rel)) ? _at(x, c.data, mean.rel) : NaN;
    };
    // Gerginlik ve hubload: her biri Mean'deki KENDİ değerini ve gezme
    // aralığını söyler; ikisi aynı şeritteyse tek cümlede.
    if(has('T') || has('hub')) {
      var parca = [], gez = [];
      if(mean) {
        if(has('T')) parca.push('gerginlik **' + n(mean.T, 0) + ' N**');
        if(has('hub')) parca.push('gergi hubload **' + n(mean.hub, 0) + ' N**');
        p.push('Çalışma noktası (Mean) **' + n(mean.rel, 1) + '°** — ' + parca.join(', ') + '.');
      }
      ['T', 'hub'].forEach(function(id) {
        if(!has(id)) return;
        var e = _ext(_chan(ds, id).data, x);
        if(e.ok) gez.push((id === 'T' ? 'gerginlik' : 'hubload') + ' **' + n(e.lo, 0) + '–' + n(e.hi, 0) + ' N**');
      });
      if(gez.length)
        p.push('Kol serbest konumdan ' + (load ? 'load stop\'a (**' + n(load.rel, 1) + '°**)' : 'erişim sınırına')
          + ' giderken ' + gez.join(', ') + ' arasında geziyor.'
          + (has('T') && isFinite(m.cutAt) ? ' Eğri kolun ucunda tekilleşir; konum gerginliklerinin 1,6 katında (**'
              + n(m.tCap, 0) + ' N**) kesildi.' : ''));
    }
    // Mean'deki değer çözülemezse (konum listesi hatalı) cümle aralığa düşer;
    // yön VARSAYILMAZ — taramanın gerçek başı → sonu yazılır.
    var uclar = function(id) {
      var d = _chan(ds, id).data, a = NaN, b = NaN;
      for(var i = 0; i < d.length; i++) if(isFinite(d[i])) { if(!isFinite(a)) a = d[i]; b = d[i]; }
      return { a: a, b: b };
    };
    if(has('tk')) {
      var vt = deger('tk'), et = _ext(_chan(ds, 'tk').data, x);
      p.push((isFinite(vt) ? 'Take-up oranı Mean\'de **' + n(vt, 3) + ' mm/°**'
          + (et.ok ? ' (tarama boyunca ' + n(et.lo, 3) + '–' + n(et.hi, 3) + ')' : '')
        : 'Take-up oranı **' + n(et.lo, 3) + '–' + n(et.hi, 3) + ' mm/°**')
        + '. Gerginlik T = M/(dL/dθ) olduğu için oran küçüldükçe gerginlik büyür.');
    }
    if(has('phi')) {
      var vp = deger('phi'), up = uclar('phi');
      p.push((isFinite(vp) ? 'Gergi sarım açısı Mean\'de **' + n(vp, 1) + '°**; kol ilerledikçe '
          : 'Gergi sarım açısı kol ilerledikçe ')
        + n(up.a, 1) + '° → ' + n(up.b, 1) + '°. Sarım daraldıkça gergi kasnağı kayışı daha az kavrar.');
    }
    if(has('beta')) {
      var vb = deger('beta'), eb = _ext(_chan(ds, 'beta').data, x);
      p.push('Hubload–kol açısı β ' + (isFinite(vb) ? 'Mean\'de **' + n(vb, 1) + '°**'
        : '**' + n(eb.lo, 1) + '–' + n(eb.hi, 1) + '°**') + ' — take-up oranı sin β ile orantılı.');
    }
    if(has('M')) {
      var vm = deger('M'), em = _ext(_chan(ds, 'M').data, x);
      p.push('Yay momenti **' + n(em.lo, 1) + '–' + n(em.hi, 1) + ' Nm**'
        + (isFinite(vm) ? ' (Mean\'de ' + n(vm, 1) + ' Nm)' : '') + ' — yay torku ön yük + katsayı × göreli açı.');
    }
    if(has('L')) {
      var ul = uclar('L');
      p.push('Tahrik boyu kol ilerledikçe **' + n(ul.a, 1) + ' → ' + n(ul.b, 1) + ' mm** — '
        + 'gergi kayışın boyunu bu kadar topluyor.');
    }
    if(!p.length) chans.forEach(function(c) { p.push(_aralik(c, x)); });
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
    var m = ds.meta || {}, p = [], x = ds.x.data, soylendi = {};
    var ids = chans.map(function(c) { return c.id; });
    var has = function(id) { return ids.indexOf(id) >= 0; };
    var aile = function(suf) { return chans.filter(function(c) { return _endsWith(c.id, suf); }); };
    var not = function(tur) {
      (m.notes || []).forEach(function(t) { if(_scnTur(t) === tur) p.push(t); });
    };
    var rpmC = _chan(ds, 'rpm');
    var devirde = function(t) {                 // o andaki motor devri
      return rpmC ? _at(x, rpmC.data, t) : NaN;
    };
    // Devir: çevrimin künyesi ve rampa notları devir kanalının şeridinde
    if(has('rpm')) {
      p.push('Çevrim **' + n(m.T, 1) + ' s**: rölanti **' + n(m.idle, 0) + '**, tepe **' + n(m.peak, 0)
        + ' d/dk**; ivme **' + n(m.accel, 0) + '**, yavaşlama **' + n(m.decel, 0) + ' d/dk/s**.');
      not('devir');
      soylendi.rpm = true;
    }
    if(has('alpha')) {
      var ea = _ext(_chan(ds, 'alpha').data, x);
      if(ea.ok) {
        p.push('Devir ivmesi **' + n(ea.lo, 0) + '…' + n(ea.hi, 0) + ' d/dk/s** — en büyük ivme **'
          + n(ea.hiX, 1) + ' s**\'de, en sert yavaşlama **' + n(ea.loX, 1) + ' s**\'de.');
        soylendi.alpha = true;
      }
    }
    if(has('v')) {
      var ev = _ext(_chan(ds, 'v').data, x);
      if(ev.ok) {
        p.push('Kayış hızı **' + n(ev.lo, 1) + '–' + n(ev.hi, 1) + ' m/s** (tepe **' + n(ev.hiX, 1) + ' s**).');
        soylendi.v = true;
      }
    }
    // Gerginlik: açıklık kanalı kendi aralığını, zarf/çoklu şerit kümeyi anlatır
    var tA = aile('.T');
    var tO = chans.filter(function(c) { return c.id === 'tmax' || c.id === 'tmin'; });
    tO.forEach(function(c) {
      var e = _ext(c.data, x);
      if(!e.ok) return;
      p.push(c.id === 'tmax'
        ? 'Açıklıkların en yüksek gerginliği **' + n(e.hi, 0) + ' N** (**' + n(e.hiX, 1) + ' s**, '
          + n(devirde(e.hiX), 0) + ' d/dk).'
        : 'Açıklıkların en düşük gerginliği **' + n(e.lo, 0) + ' N** (**' + n(e.loX, 1) + ' s**, '
          + n(devirde(e.loX), 0) + ' d/dk).');
      soylendi[c.id] = true;
    });
    if(tA.length === 1) {
      var e1 = _ext(tA[0].data, x);
      if(e1.ok)
        p.push('**' + _head(tA[0].name) + '** gerginliği **' + n(e1.lo, 0) + '–' + n(e1.hi, 0) + ' N** (en yüksek **'
          + n(e1.hiX, 1) + ' s**, ' + n(devirde(e1.hiX), 0) + ' d/dk).');
    } else if(tA.length) {
      var hi = null, lo = null;
      tA.forEach(function(c) {
        var e = _ext(c.data, x);
        if(!e.ok) return;
        if(!hi || e.hi > hi.v) hi = { v: e.hi, t: e.hiX, ad: _head(c.name) };
        if(!lo || e.lo < lo.v) lo = { v: e.lo, t: e.loX, ad: _head(c.name) };
      });
      if(hi) p.push('En yüksek **' + n(hi.v, 0) + ' N** (' + hi.ad + ', ' + n(hi.t, 1) + ' s); en düşüğü **'
        + n(lo.v, 0) + ' N** (' + lo.ad + ', ' + n(lo.t, 1) + ' s).');
    }
    tA.forEach(function(c) { soylendi[c.id] = true; });
    if(tA.length >= 2 || has(_tSahip(ds))) {
      p.push('Açıklık gerginlikleri çevrim boyunca **' + n(m.tMin, 0) + '–' + n(m.tMax, 0) + ' N** '
        + 'arasında geziyor; ivme gerilmeyi doğrusal oynatır (T = A(N) + α·B(N)).');
      not('gerg');
    }
    // Frekans: açıklık kanalı kendi rezonansını; çoklu şerit hepsini sayar.
    // Frekans kapalıysa (fOff) sebebi ateşleme kanalının şeridinde.
    var fA = aile('.f1');
    var rez = m.resonances || [];
    var rezYaz = function(r) {
      return (m.spanNames[r.si] || 'açıklık') + ' × ' + r.k + '. mertebe (**' + n(r.t, 1) + ' s**, '
        + n(r.rpm, 0) + ' d/dk)';
    };
    if(fA.length === 1) {
      var ad = _head(fA[0].name), ef = _ext(fA[0].data, x);
      var bu = rez.filter(function(r) { return m.spanNames[r.si] === ad; });
      p.push('**' + ad + '** açıklık frekansı ' + (ef.ok ? '**' + n(ef.lo, 1) + '–' + n(ef.hi, 1) + ' Hz**' : '—')
        + (bu.length ? '; rezonans geçişleri: ' + bu.slice(0, 5).map(function(r) {
            return r.k + '. mertebe (**' + n(r.t, 1) + ' s**, ' + n(r.rpm, 0) + ' d/dk)';
          }).join(' · ') + '.'
          : '; ateşlemenin 1×–4× katına %4\'ten yakın geçmiyor.'));
    } else if(fA.length) {
      p.push(rez.length
        ? 'Rezonans geçişleri: ' + rez.slice(0, 5).map(rezYaz).join(' · ')
          + (rez.length > 5 ? ' · (+' + (rez.length - 5) + ')' : '') + '.'
        : 'Çevrim boyunca hiçbir açıklık ateşlemenin 1×–4× katına %4\'ten yakın geçmiyor.');
    }
    fA.forEach(function(c) { soylendi[c.id] = true; });
    if(has('fire')) {
      var ei = _ext(_chan(ds, 'fire').data, x);
      if(ei.ok) {
        p.push('Ateşleme frekansı **' + n(ei.lo, 1) + '–' + n(ei.hi, 1) + ' Hz**.');
        soylendi.fire = true;
      }
      if(m.fOff) not('frek');
    }
    _kalan(chans, soylendi, x, p);
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
