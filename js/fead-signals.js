// ═══════════════════════════════════════════════════════════════════════════
// FEAD SİNYALLERİ — çözüm sonucu (R) → Sonuçlar panosunun kanal biçimi
// ═══════════════════════════════════════════════════════════════════════════
//
// NEDEN VAR: FEAD çözücüsünün hesapladığı büyüklüklerin çoğu yalnız TABLO
// olarak (çözücü penceresi · iki HTML rapor) ya da hiç (geçici rejim zaman
// serileri, burulma mod şekilleri, hizalama payı) görünüyordu. Sonuçlar
// panosunun raporun yapamadığı tek işi SÜPÜRÜLEBİLİR bir eksen üzerinde
// imleçle gezinmek; bu dosya o eksenleri kurar. Kalıp Takoz'unki
// (js/mount-signals.js) ve arayüz birebir aynı — pano iki modülü aynı
// kaynak tablosundan (js/results.js veResultSources) okuyor.
//
// DÖRT X EKSENİ, DÖRT VERİ KÜMESİ. Panonun "tek X ekseni" kuralı
// (js/measure-core.js) farklı eksendeki kanalların aynı pencereye girmesini
// reddeder; FEAD'in doğal eksenleri de dört tane:
//
//   cevrim    X = motor devri [d/dk]   çalışma çevriminin ÇÖZÜLMÜŞ noktaları
//   campbell  X = motor devri [d/dk]   mertebe doğruları × burulma modları ×
//                                      açıklık frekansları (düzgün ızgara)
//   kol       X = göreli kol açısı [°] gergi kolu taraması (Belt Tension Control)
//   senaryo   X = zaman [s]            motor çevrimi senaryosu (fead-transient)
//
// "cevrim" ile "campbell" aynı birimde ama AYNI ızgarada değil: biri
// çevrimin ayrık noktaları, öteki düzgün bir süpürme. Tek kümede birleşseler
// ya ayrık sayılar ara değerlenip "çözülmüş" gibi gösterilir ya da ızgara
// seyrekleşirdi.
//
// SAYI URETILMEZ, OKUNUR. Kararlı rejim sayılarının hepsi R.analysis'ten
// (çözücünün kendi çıktısı) gelir. Tarama ve senaryo ÇÖZÜLEN modelin
// (R.build) üzerinde koşar ve ÇÖZÜM ANINDA kurulur (cp-fead.js veFeadSolve):
// R.build canlı düğümlere bağlı, sonradan kurulsaydı çözümden SONRA
// değiştirilmiş bir alan panoya sızardı.
//
// GEÇERLİLİK SINIRI SONUCUN İÇİNDE (FEAD kuralı 10). Kayış tipine bağlı
// çıktılar KAPALIYSA (varsayılan) açıklık frekansları ve yorulma hiç
// üretilmez — boş şerit değil, OLMAYAN kanal; sebebi ağaçta ve özette yazılı.
//
// SAF MODÜL: DOM'a dokunmaz, global duruma yazmaz. Jest'te doğrudan test
// edilir (tests/unit/fead-signals.test.js).
// ═══════════════════════════════════════════════════════════════════════════

var veFeadSignals = (function() {
  'use strict';

  var SENSOR_PREFIX = '~fead-';
  // Kanal yönlendirmesi ÖNEKLE DEĞİL bu tam listeyle (gerekçesi
  // mount-signals.js SET_KEYS): alt topolojide 'fead-crank', 'fead-solver'
  // gibi bileşen tipleri var ve sihirbazın sanal sensörü '~' + tip biçiminde.
  var SET_KEYS = ['cevrim', 'campbell', 'kol', 'senaryo'];

  var CAMP_NPTS = 121;          // Campbell ızgarası — Takoz'unkiyle aynı
  var KOL_NPTS = 90;            // kol taraması — raporun Şekil'iyle aynı ızgara
  var KOL_T_KAT = 1.6;          // raporun y tavanı: konum gerginliklerinin 1,6 katı
  var TORK_K = 9549;            // Q = 9549·P/n — raporun (5.1)'i, aynı sabit
  var REZ_TOL = 0.04;           // senaryo: |k·f_ateş − f|/f — kartın HUD eşiği

  function isFeadSensor(sensorId) {
    if(typeof sensorId !== 'string' || sensorId.indexOf(SENSOR_PREFIX) !== 0) return false;
    return SET_KEYS.indexOf(sensorId.substring(SENSOR_PREFIX.length)) >= 0;
  }

  function _num(v) {
    var x = (typeof v === 'string') ? Number(v.replace(',', '.')) : v;
    return (typeof x === 'number' && isFinite(x)) ? x : NaN;
  }
  function _core() {
    if(typeof FEADCore !== 'undefined' && FEADCore) return FEADCore;
    if(typeof window !== 'undefined' && window.FEADCore) return window.FEADCore;
    return null;
  }
  function _brief() {
    if(typeof veFeadBrief !== 'undefined' && veFeadBrief) return veFeadBrief;
    if(typeof window !== 'undefined' && window.veFeadBrief) return window.veFeadBrief;
    return null;
  }
  function _loadedRatio() {
    return (typeof VE_FEAD_SLIP_LOADED_RATIO === 'number') ? VE_FEAD_SLIP_LOADED_RATIO : 1.01;
  }
  // Sayı biçimi: Türkçe ondalık ayracı (kanal adında ve özet metninde).
  function _tr(v, dec) {
    if(!isFinite(v)) return '—';
    return (v < 0 ? '−' : '') + Math.abs(v).toFixed(dec == null ? 1 : dec).replace('.', ',');
  }

  // Kayış tipine bağlı çıktılar açık mı — SONUCUN beyanından. Çözüm
  // frekansları silip `beltDataOff` listesini yazıyor; pano aynı listeye bakar.
  function beltOn(R) {
    return !(R && Array.isArray(R.beltDataOff) && R.beltDataOff.length);
  }

  // ── Kanal kimliği: KONUM DEĞİL KİMLİK ────────────────────────────────────
  // Kimlikler panoya ve projeye kaydediliyor; sıra numarasından türeseydi
  // kasnak eklenip yeniden çözülünce AYNI kimlik BAŞKA bir kasnağa bağlanırdı
  // (Takoz'un ölçülmüş dersi). Kimlik kasnağın ADINDAN; ad değişirse kanal
  // düşer, sessizce başkasına bağlanmaz.
  var _FOLD = { 'İ':'i','I':'i','ı':'i','Ş':'s','ş':'s','Ğ':'g','ğ':'g',
                'Ü':'u','ü':'u','Ö':'o','ö':'o','Ç':'c','ç':'c' };
  function _slug(s) {
    var out = '', i, c;
    s = String(s == null ? '' : s);
    for(i = 0; i < s.length; i++) {
      c = s.charAt(i);
      c = _FOLD[c] || c.toLowerCase();
      out += /[a-z0-9]/.test(c) ? c : '_';
    }
    out = out.replace(/_+/g, '_').replace(/^_|_$/g, '');
    return out || 'kasnak';
  }
  function _keys(names) {
    var seen = {};
    return (names || []).map(function(nm) {
      var b = _slug(nm);
      seen[b] = (seen[b] || 0) + 1;
      return 'k.' + b + (seen[b] > 1 ? '_' + seen[b] : '');
    });
  }

  // Kasnak listesi: ad · kısa kod · kimlik kökü · rol. Kod köprünün kuralı
  // (veFeadPulleyCodes) — raporla aynı kimlik, aynı sayfada künyesiyle.
  function _pulleys(R) {
    var sys = R && R.build && R.build.sys;
    var ps = (sys && sys.pulleys) || [];
    var names = (R && R.pulleyNames && R.pulleyNames.length === ps.length)
      ? R.pulleyNames : ps.map(function(p) { return p.name; });
    var kod = (typeof veFeadPulleyCodes === 'function' && sys) ? veFeadPulleyCodes(sys) : null;
    var keys = _keys(names);
    return ps.map(function(p, i) {
      return { i: i, name: names[i], code: (kod && kod[i]) || names[i], key: keys[i],
               crank: !!p.crank, tensioner: !!p.tensioner, contact: p.contact };
    });
  }
  // i'nin ÇIKIŞ açıklığı i → i+1 (çekirdeğin konvansiyonu: perPulley[i] ↔ span[i]).
  function _spanName(P, i) {
    var n = P.length;
    return P[i].code + ' → ' + P[(i + 1) % n].code;
  }

  // Çevrim satırları devre göre SIRALI (girilen sıra değil). Aynı devirde iki
  // satır varsa girilen sıra korunur.
  function _dutyRows(R) {
    var d = (R && R.analysis && R.analysis.duty) || [];
    return d.map(function(x, i) { return { d: x, i: i }; })
      .sort(function(a, b) { return (a.d.engineRpm - b.d.engineRpm) || (a.i - b.i); })
      .map(function(x) { return x.d; });
  }

  // Yük taşıyan kasnak: herhangi bir çevrim satırında gerginlik oranı eşiğin
  // üstünde. Oran ≈ 1 olan kasnakta SF bir MARJ değil kapasitedir — raporun
  // `_frSlipStats` kuralı, aynı eşik (köprünün VE_FEAD_SLIP_LOADED_RATIO'su).
  function _loadedSet(rows) {
    var thr = _loadedRatio(), out = {};
    rows.forEach(function(d) {
      (d.slip || []).forEach(function(s, i) {
        if(_num(s.tensionRatio) >= thr) out[i] = true;
      });
    });
    return out;
  }

  // Ateşleme mertebesi (krank devri başına) — silindir sayısı ÇÖZÜM ANINDAKİ
  // değerden: duty satırındaki ateşleme frekansı N·z/120 ile yazıldı. Çözücü
  // düğümüne sonradan bakmak (R.build.solver canlı düğüm) çözümden sonra
  // değişen bir alanı panoya sızdırırdı.
  function _cylOf(rows) {
    for(var i = 0; i < rows.length; i++) {
      var f = _num(rows[i].firingHz), N = _num(rows[i].engineRpm);
      if(f > 0 && N > 0) return Math.round(f * 120 / N * 1000) / 1000;
    }
    return NaN;
  }

  // ── 1) ÇALIŞMA ÇEVRİMİ — X = çözülmüş devir noktaları ─────────────────────
  function _cevrimSet(R) {
    var rows = _dutyRows(R);
    if(rows.length < 2) return null;       // tek nokta bir eğri değildir
    var P = _pulleys(R);
    if(!P.length) return null;
    var n = P.length, on = beltOn(R);
    var ten = R.tensionerSide;
    var ters = !!(ten && ten.ok === false);
    var loaded = _loadedSet(rows);

    var x = rows.map(function(d) { return _num(d.engineRpm); });
    var chans = [], groups = [];
    function grp(k, ad, ids) { if(ids.length) groups.push({ k: k, ad: ad, ids: ids }); }
    function add(id, name, unit, data, src) {
      chans.push({ id: id, name: name, unit: unit, data: data, src: src || '' });
      return id;
    }

    // Kayış ve yük
    var g1 = [];
    g1.push(add('v', 'Kayış hızı', 'm/s', rows.map(function(d) { return _num(d.vMs); })));
    g1.push(add('fire', 'Ateşleme frekansı', 'Hz', rows.map(function(d) { return _num(d.firingHz); })));
    var ci = -1;
    P.forEach(function(p) { if(p.crank) ci = p.i; });
    if(ci >= 0) g1.push(add('pkw', 'Sürücü gücü (' + P[ci].code + ')', 'kW', rows.map(function(d) {
      var q = d.perPulley && d.perPulley[ci];
      return q ? _num(q.powerKw) : NaN;
    }), P[ci].name));
    g1.push(add('tmax', 'En yüksek açıklık gerginliği', 'N', rows.map(function(d) {
      return Math.max.apply(null, (d.perPulley || []).map(function(q) { return _num(q.exitTensionN); }));
    })));
    g1.push(add('tmin', 'En düşük açıklık gerginliği', 'N', rows.map(function(d) {
      return Math.min.apply(null, (d.perPulley || []).map(function(q) { return _num(q.exitTensionN); }));
    })));
    grp('yuk', 'Kayış ve yük', g1);

    // Açıklık gerginlikleri (i'nin çıkış açıklığı)
    grp('gerg', 'Açıklık gerginlikleri', P.map(function(p) {
      return add(p.key + '.T', _spanName(P, p.i) + ' · gerginlik', 'N', rows.map(function(d) {
        var q = d.perPulley && d.perPulley[p.i];
        return q ? _num(q.exitTensionN) : NaN;
      }), p.name + ' çıkış açıklığı');
    }));

    // Hubload — büyüklük ve yön ayrı gruplar: iki birim, iki ölçek
    grp('hub', 'Hubload', P.map(function(p) {
      return add(p.key + '.hub', p.code + ' · hubload', 'N', rows.map(function(d) {
        var h = d.hubloads && d.hubloads[p.i];
        return h ? _num(h.FN) : NaN;
      }), p.name);
    }));
    grp('yon', 'Hubload yönü', P.map(function(p) {
      return add(p.key + '.dir', p.code + ' · hubload yönü', '°', rows.map(function(d) {
        var h = d.hubloads && d.hubloads[p.i];
        return h ? _num(h.dirDeg) : NaN;
      }), p.name);
    }));

    // Kayma emniyeti — YALNIZ yük taşıyanlar, ve gergi GERGİN taraftayken
    // HİÇ: o hâlde SF −0,00/0,00 çıkar, bir emniyet faktörü değil sayısal
    // gölgedir (çözücü penceresinin kuralı, aynı sebep).
    if(!ters) {
      var sfIds = [];
      P.forEach(function(p) {
        if(!loaded[p.i]) return;
        sfIds.push(add(p.key + '.sf', p.code + ' · kayma emniyeti', '×', rows.map(function(d) {
          var s = d.slip && d.slip[p.i];
          return s ? _num(s.SF) : NaN;
        }), p.name));
      });
      if(sfIds.length) {
        sfIds.unshift(add('sfmin', 'En düşük kayma emniyeti', '×', rows.map(function(d) {
          var m = Infinity;
          (d.slip || []).forEach(function(s, i) { if(loaded[i]) m = Math.min(m, _num(s.SF)); });
          return isFinite(m) ? m : NaN;
        })));
      }
      grp('sf', 'Kayma emniyeti', sfIds);
    }

    // Aksesuar devri — avaralar dâhil (rulman devri de bir sonuç)
    grp('devir', 'Kasnak devirleri', P.map(function(p) {
      return add(p.key + '.rpm', p.code + ' · devir', 'd/dk', rows.map(function(d) {
        var q = d.perPulley && d.perPulley[p.i];
        return q ? _num(q.accessoryRpm) : NaN;
      }), p.name);
    }));

    // Aksesuar gücü ve mil torku — yalnız güç çeken aksesuarlar
    var gIds = [];
    P.forEach(function(p) {
      if(p.crank) return;
      var var_ = rows.some(function(d) {
        var q = d.perPulley && d.perPulley[p.i];
        return q && _num(q.powerKw) > 0.05;
      });
      if(!var_) return;
      gIds.push(add(p.key + '.kw', p.code + ' · güç', 'kW', rows.map(function(d) {
        var q = d.perPulley && d.perPulley[p.i];
        return q ? _num(q.powerKw) : NaN;
      }), p.name));
      gIds.push(add(p.key + '.nm', p.code + ' · mil torku', 'Nm', rows.map(function(d) {
        var q = d.perPulley && d.perPulley[p.i];
        var nn = q ? _num(q.accessoryRpm) : NaN;
        return (nn > 0) ? TORK_K * _num(q.powerKw) / nn : NaN;
      }), p.name));
    });
    grp('guc', 'Aksesuar gücü ve torku', gIds);

    // Açıklık frekansları — kayış verisine bağlı; kapalıysa kanal YOK
    if(on && rows.some(function(d) { return Array.isArray(d.frequencies); })) {
      var fIds = P.map(function(p) {
        return add(p.key + '.f1', _spanName(P, p.i) + ' · açıklık frekansı', 'Hz', rows.map(function(d) {
          var s = d.frequencies && d.frequencies[p.i];
          return (s && s.fHz && !s.flutter) ? _num(s.fHz[0]) : NaN;
        }), p.name + ' çıkış açıklığı');
      });
      fIds.push(add('tc', 'Merkezkaç gerginliği m′v²', 'N', rows.map(function(d) {
        var s = d.frequencies && d.frequencies[0];
        return s ? _num(s.TcN) : NaN;
      })));
      grp('frek', 'Açıklık frekansları', fIds);
    }

    // Yorulma — devir başına hasar payı (kayış verisine bağlı)
    var fat = R.fatigue && R.fatigue.perLoadPct;
    if(on && Array.isArray(fat) && fat.length) {
      grp('yor', 'Kaburga yorulması', [add('fat', 'Yorulma hasarı payı', '%', rows.map(function(d) {
        var hit = null;
        fat.forEach(function(q) { if(_num(q.engineRpm) === _num(d.engineRpm)) hit = q; });
        return hit ? _num(hit.sharePct) : NaN;
      }))]);
    }

    return {
      key: 'cevrim', sensorId: SENSOR_PREFIX + 'cevrim',
      name: 'Çalışma çevrimi', short: 'Çevrim',
      icon: '<span class="mf-ico mf-ico-gauge"></span>',
      x: { id: 'rpm', name: 'Motor devri', unit: 'd/dk', data: x },
      channels: chans, groups: groups,
      meta: { n: rows.length, dc: rows.map(function(d) { return _num(d.dcPct); }),
              loaded: Object.keys(loaded).map(Number), ters: ters, beltOn: on,
              serviceFact: _num(R.serviceFact),
              slipThreshold: (typeof veFeadSlipThreshold === 'function' && R.build)
                ? veFeadSlipThreshold(R.build, (R.analysis && R.analysis.duty) || []) : null }
    };
  }

  // ── 2) CAMPBELL — X = düzgün devir ızgarası ──────────────────────────────
  //
  // MERTEBE KÜMESİ İKİ RAPOR YÜZEYİNİN BİRLEŞİMİ. Raporun açıklık haritası
  // ateşlemenin 1×–4× katlarını çiziyor (açıklıklar oralarda kesişiyor);
  // §8.18 burulma tablosu Takoz'un kümesini (1 · ateşleme · 2× · 4×) sayıyor
  // (BMC'nin 12 Hz'lik kol modu 1. mertebeyle rölantide kesişiyor). Bu grafik
  // İKİSİNİ BİRDEN üst üste çizdiği için iki kümenin birleşimi: 1 · 1×–4×
  // ateşleme. Uydurulmuş bir üçüncü küme değil, iki bilinen kümenin toplamı.
  function _orders(cyl) {
    if(!(cyl > 0)) return [];
    var f = cyl / 2;
    var out = [{ o: 1, label: 'dönme' }];
    [1, 2, 3, 4].forEach(function(k) {
      out.push({ o: k * f, label: (k === 1 ? 'ateşleme' : k + '× ateşleme'), firing: k });
    });
    return out;
  }
  function _ordId(o) { return 'ord.' + String(Math.round(o * 1000) / 1000).replace('.', '_'); }

  // Devir ızgarasında y(N) ayrık noktalarından doğrusal ara değer; aralık
  // DIŞINDA NaN (çevrimin dışına uzatmak çözülmemiş bir sayı iddia ederdi).
  function _interp(xs, ys, X) {
    if(!(X >= xs[0]) || !(X <= xs[xs.length - 1])) return NaN;
    for(var i = 1; i < xs.length; i++) {
      if(X <= xs[i]) {
        var a = ys[i - 1], b = ys[i];
        if(!isFinite(a) || !isFinite(b)) return NaN;
        var d = xs[i] - xs[i - 1];
        return d > 0 ? a + (b - a) * (X - xs[i - 1]) / d : b;
      }
    }
    return NaN;
  }

  function _campbellSet(R) {
    var rows = _dutyRows(R);
    if(!rows.length) return null;
    var cyl = _cylOf(rows);
    var orders = _orders(cyl);
    if(!orders.length) return null;
    var T = R.torsional;
    var modes = (T && Array.isArray(T.elasticHz)) ? T.elasticHz.filter(function(f) { return f > 0; }) : [];
    var P = _pulleys(R);
    var on = beltOn(R);
    var spanF = [];
    if(on && rows.length >= 2 && rows.some(function(d) { return Array.isArray(d.frequencies); })) {
      P.forEach(function(p) {
        spanF.push({ p: p, ys: rows.map(function(d) {
          var s = d.frequencies && d.frequencies[p.i];
          return (s && s.fHz && !s.flutter) ? _num(s.fHz[0]) : NaN;
        }) });
      });
    }
    if(!modes.length && !spanF.length) return null;   // yatay çizgi yoksa kesişim de yok

    var xsDuty = rows.map(function(d) { return _num(d.engineRpm); });
    var rpmLo = xsDuty[0], rpmHi = xsDuty[xsDuty.length - 1];
    var rpmTop = Math.ceil(rpmHi * 1.1 / 100) * 100;
    if(!(rpmTop > 0)) return null;

    var fMax = 0;
    modes.forEach(function(f) { if(f > fMax) fMax = f; });
    spanF.forEach(function(s) { s.ys.forEach(function(f) { if(f > fMax) fMax = f; }); });
    // Y tavanı: en yüksek yatay çizginin 1,15 katı. Üstünde mertebe doğrusu
    // bilgi taşımıyor (kesişim kalmadı) ama ölçeği ele geçirir.
    var fCap = fMax * 1.15;
    if(!(fCap > 0)) return null;

    var rpm = [], i;
    for(i = 0; i < CAMP_NPTS; i++) rpm.push(rpmTop * i / (CAMP_NPTS - 1));

    var chans = [], gOrd = [], gMod = [], gSpan = [];
    orders.forEach(function(od) {
      var id = _ordId(od.o);
      chans.push({ id: id, name: _tr(od.o, 1).replace(',0', '') + '. mertebe — ' + od.label,
                   unit: 'Hz', data: rpm.map(function(N) {
                     var f = od.o * N / 60;
                     return f <= fCap ? f : NaN;
                   }) });
      gOrd.push(id);
    });
    modes.forEach(function(f, k) {
      var id = 'tmod.' + (k + 1);
      chans.push({ id: id, name: 'Burulma modu ' + (k + 1) + ' — ' + _tr(f, 1) + ' Hz',
                   unit: 'Hz', data: rpm.map(function() { return f; }) });
      gMod.push(id);
    });
    spanF.forEach(function(s) {
      var id = s.p.key + '.f1';
      chans.push({ id: id, name: _spanName(P, s.p.i) + ' · açıklık frekansı', unit: 'Hz',
                   src: s.p.name + ' çıkış açıklığı',
                   data: rpm.map(function(N) { return _interp(xsDuty, s.ys, N); }) });
      gSpan.push(id);
    });

    // Kesişimler — BURADA bir kez hesaplanır, yorum katmanı yeniden türetmez.
    var cross = [];
    modes.forEach(function(f, k) {
      orders.forEach(function(od) {
        var N = 60 * f / od.o;
        if(N >= rpmLo && N <= rpmHi)
          cross.push({ kind: 'tors', mode: k + 1, o: od.o, label: od.label, rpm: N, f: f });
      });
    });
    spanF.forEach(function(s) {
      orders.forEach(function(od) {
        for(var j = 1; j < xsDuty.length; j++) {
          var a = s.ys[j - 1] - od.o * xsDuty[j - 1] / 60;
          var b = s.ys[j] - od.o * xsDuty[j] / 60;
          if(!isFinite(a) || !isFinite(b) || a * b > 0 || a === b) continue;
          var u = a / (a - b);
          var N = xsDuty[j - 1] + u * (xsDuty[j] - xsDuty[j - 1]);
          cross.push({ kind: 'span', span: _spanName(P, s.p.i), o: od.o, label: od.label,
                       rpm: N, f: od.o * N / 60 });
        }
      });
    });
    cross.sort(function(a, b) { return a.rpm - b.rpm; });

    var groups = [{ k: 'ord', ad: 'Uyarma mertebeleri', ids: gOrd }];
    if(gMod.length) groups.push({ k: 'mod', ad: 'Burulma modları', ids: gMod });
    if(gSpan.length) groups.push({ k: 'span', ad: 'Açıklık frekansları', ids: gSpan });

    return {
      key: 'campbell', sensorId: SENSOR_PREFIX + 'campbell',
      name: 'Campbell diyagramı', short: 'Campbell',
      icon: '<span class="mf-ico mf-ico-git-branch"></span>',
      x: { id: 'rpm', name: 'Motor devri', unit: 'd/dk', data: rpm },
      channels: chans, groups: groups,
      meta: { cyl: cyl, orders: orders, rpmLo: rpmLo, rpmHi: rpmHi, rpmTop: rpmTop,
              fCap: fCap, modes: modes, crossings: cross, beltOn: on,
              rigidBodyModes: T ? T.rigidBodyModes : NaN }
    };
  }

  // ── 3) GERGİ KOLU TARAMASI — X = göreli kol açısı ────────────────────────
  // Rapordaki "Belt Tension Control" ve take-up şekillerinin verisi; ızgara
  // köprünün ortak taramasından (veFeadArmSweep), raporun çizdiğiyle AYNI.
  // Gerginlik kolun ucunda TEKİLLEŞİR (sarım sıfıra giderken payda daralıyor);
  // raporun kuralı aynen: konum gerginliklerinin 1,6 katında kesilir.
  function _kolSet(R) {
    if(typeof veFeadArmSweep !== 'function' || !R.build) return null;
    var sw = veFeadArmSweep(R.build, KOL_NPTS);
    if(!sw || !sw.pts || sw.pts.length < 4) return null;
    var pos = ((R.analysis && R.analysis.positions) || []).filter(function(p) { return !p.error; });
    var konumT = pos.filter(function(p) { return p.position !== 'Load'; })
      .map(function(p) { return _num(p.tensionN); }).filter(isFinite);
    var tasarim = _num(R.build.sys && R.build.sys.designTensionN);
    var taban = Math.max.apply(null, konumT.concat([isFinite(tasarim) ? tasarim : 0, 1]));
    var tCap = taban * KOL_T_KAT;
    // Kesme noktası: gerginliğin tavanı İLK aştığı yer; sonrası NaN.
    var kes = sw.pts.length;
    for(var i = 0; i < sw.pts.length; i++) { if(sw.pts[i].T > tCap) { kes = i + 1; break; } }
    var pts = sw.pts;
    function col(f) { return pts.map(function(p, j) { return j < kes ? f(p) : NaN; }); }

    var chans = [
      { id: 'T',    name: 'Gergi gerginliği',          unit: 'N',    data: col(function(p) { return p.T; }) },
      { id: 'hub',  name: 'Gergi hubload',             unit: 'N',    data: col(function(p) { return p.hub; }) },
      { id: 'tk',   name: 'Take-up oranı dL/dθ',       unit: 'mm/°', data: col(function(p) { return p.tk; }) },
      { id: 'L',    name: 'Tahrik boyu',               unit: 'mm',   data: col(function(p) { return p.L; }) },
      { id: 'phi',  name: 'Gergi sarım açısı',         unit: '°',    data: col(function(p) { return p.phi; }) },
      { id: 'beta', name: 'Hubload–kol açısı β',        unit: '°',    data: col(function(p) { return p.beta; }) },
      { id: 'M',    name: 'Yay momenti',               unit: 'Nm',   data: col(function(p) { return p.M; }) }
    ];
    return {
      key: 'kol', sensorId: SENSOR_PREFIX + 'kol',
      name: 'Gergi kolu taraması', short: 'Kol',
      icon: '<span class="mf-ico mf-ico-sliders"></span>',
      x: { id: 'rel', name: 'Kol açısı (göreli)', unit: '°', data: pts.map(function(p) { return p.rel; }) },
      channels: chans,
      groups: [{ k: 'kol', ad: 'Gergi kolu', ids: chans.map(function(c) { return c.id; }) }],
      meta: { relMax: sw.relMax, tCap: tCap, cutAt: kes < pts.length ? pts[kes - 1].rel : NaN,
              positions: pos.map(function(p) {
                return { position: p.position, rel: _num(p.relDeg), T: _num(p.tensionN),
                         hub: _num(p.hubloadN) };
              }),
              slipThreshold: (typeof veFeadSlipThreshold === 'function')
                ? veFeadSlipThreshold(R.build, (R.analysis && R.analysis.duty) || []) : null }
    };
  }

  // ── 4) MOTOR ÇEVRİMİ SENARYOSU — X = zaman ──────────────────────────────
  // Durgun → marş → ateşleme → rölanti → hızlanma → tepe → yavaşlama →
  // rölanti → stop. Devir geçmişi DAYATILMIŞ (fead-transient.js başlığı);
  // senaryonun künye notları kümeyle birlikte taşınır ve yorumda yazılır.
  function _senaryoSet(R) {
    if(typeof veFeadScenarioBuild !== 'function' || typeof veFeadScnStateAt !== 'function') return null;
    var scn = null;
    try { scn = veFeadScenarioBuild(R.build); } catch(e) { scn = null; }
    if(!scn || !Array.isArray(scn.t) || scn.t.length < 4) return null;
    var P = _pulleys(R);
    var nS = scn.L.length;
    var T = scn.T > 0 ? scn.T : 1;
    // Son örnek T'de: veFeadScnStateAt döngüsel oynatır (t mod T) ve T'yi
    // 0'a sarardı — çevrimin son karesi ilk kareye (durgun) dönüşürdü.
    var st = scn.t.map(function(t) { return veFeadScnStateAt(scn, Math.min(t, T * (1 - 1e-9))); });

    var chans = [], gDev = [], gT = [], gF = [];
    function add(arr, id, name, unit, data, src) {
      chans.push({ id: id, name: name, unit: unit, data: data, src: src || '' });
      arr.push(id);
    }
    add(gDev, 'rpm', 'Motor devri', 'd/dk', st.map(function(s) { return s.rpm; }));
    add(gDev, 'alpha', 'Devir ivmesi', 'd/dk/s', st.map(function(s) { return s.alpha; }));
    add(gDev, 'v', 'Kayış hızı', 'm/s', st.map(function(s) { return s.beltMs; }));
    add(gDev, 'fire', 'Ateşleme frekansı', 'Hz', st.map(function(s) { return s.firingHz; }));
    for(var k = 0; k < nS && k < P.length; k++) {
      (function(k) {
        add(gT, P[k].key + '.T', _spanName(P, k) + ' · gerginlik', 'N',
            st.map(function(s) { return s.spanN[k]; }), P[k].name + ' çıkış açıklığı');
      })(k);
    }
    add(gT, 'tmax', 'En yüksek açıklık gerginliği', 'N', st.map(function(s) { return s.Tmax; }));
    add(gT, 'tmin', 'En düşük açıklık gerginliği', 'N', st.map(function(s) { return s.Tmin; }));
    // Frekans kanalları YALNIZ kayış verisi açıkken — senaryo kapıyı kendisi
    // uyguluyor (`fOff`) ve o zaman frekans hiç üretilmiyor.
    var fOn = !scn.fOff && st.some(function(s) { return s.spanF && s.spanF.length; });
    var rez = [];
    if(fOn) {
      for(var k2 = 0; k2 < nS && k2 < P.length; k2++) {
        (function(k) {
          add(gF, P[k].key + '.f1', _spanName(P, k) + ' · açıklık frekansı', 'Hz',
              st.map(function(s) { return (s.spanF[k] > 0) ? s.spanF[k] : NaN; }),
              P[k].name + ' çıkış açıklığı');
        })(k2);
      }
      // Rezonans ANLARI — kartın HUD'uyla aynı kural (|k·f_ateş − f|/f < %4,
      // k = 1…4). Ardışık örnekler tek olay sayılır.
      var acik = null;
      st.forEach(function(s, j) {
        var en = null;
        (s.spanF || []).forEach(function(f, si) {
          if(!(f > 0) || !(s.firingHz > 0)) return;
          for(var kk = 1; kk <= 4; kk++) {
            var dd = Math.abs(kk * s.firingHz - f) / f;
            if(dd < REZ_TOL && (!en || dd < en.d)) en = { d: dd, si: si, k: kk, f: f };
          }
        });
        var anahtar = en ? (en.si + ':' + en.k) : null;
        if(en && (!acik || acik.key !== anahtar)) {
          acik = { key: anahtar, t: scn.t[j], si: en.si, k: en.k, f: en.f, rpm: s.rpm };
          rez.push(acik);
        } else if(!en) acik = null;
      });
    }

    var groups = [{ k: 'devir', ad: 'Devir ve kayış', ids: gDev },
                  { k: 'gerg', ad: 'Açıklık gerginlikleri', ids: gT }];
    if(gF.length) groups.push({ k: 'frek', ad: 'Açıklık frekansları', ids: gF });

    return {
      key: 'senaryo', sensorId: SENSOR_PREFIX + 'senaryo',
      name: 'Motor çevrimi senaryosu', short: 'Senaryo',
      icon: '<span class="mf-ico mf-ico-play"></span>',
      x: { id: 't', name: 'Zaman', unit: 's', data: scn.t.slice() },
      channels: chans, groups: groups,
      meta: { T: T, phases: scn.ph, idle: scn.idle, peak: scn.peak, crank: scn.crank,
              accel: scn.accel, decel: scn.decel, notes: (scn.notlar || []).slice(),
              curve: !!scn.egri, fOff: !!scn.fOff, resonances: rez,
              spanNames: P.slice(0, nS).map(function(p) { return _spanName(P, p.i); }),
              tMax: Math.max.apply(null, st.map(function(s) { return s.Tmax; })),
              tMin: Math.min.apply(null, st.map(function(s) { return s.Tmin; })) }
    };
  }

  // ── Kurulum ───────────────────────────────────────────────────────────────
  // Üretilemeyen küme SESSİZCE atlanır (burulma yoksa ve frekans kapalıysa
  // Campbell yok; tek devir satırında çevrim yok) — yarım veriyle uydurma
  // eğri çizmektense o kanal hiç görünmesin. Sebep özette yazılıdır.
  function build(R) {
    if(!R || !R.ok || R.error || !R.analysis) return [];
    var sets = [], s;
    try { s = _cevrimSet(R);   if(s) sets.push(s); } catch(e) {}
    try { s = _campbellSet(R); if(s) sets.push(s); } catch(e) {}
    try { s = _kolSet(R);      if(s) sets.push(s); } catch(e) {}
    try { s = _senaryoSet(R);  if(s) sets.push(s); } catch(e) {}
    var B = _brief();
    sets.forEach(function(ds) {
      try { ds.brief = B ? B.build(ds, R) : null; } catch(e) { ds.brief = null; }
    });
    return sets;
  }

  // Veri kümeleri → Veri Gezgini grupları. Bir küme BİRDEN ÇOK gruba ayrılır
  // (çevrimin 40+ kanalı tek listede okunmazdı); gruplar aynı kümeye, yani
  // aynı X eksenine bağlı kalır. Grup sürüklemesi YOK (dragId boş): bir alt
  // grubu sürüklemek kümenin TAMAMINI eklerdi — onay kutusu yalnız o grubun
  // kanallarını ekliyor, doğru yol o.
  function groups(sets) {
    var out = [];
    (sets || []).forEach(function(ds) {
      var byId = {};
      ds.channels.forEach(function(ch) { byId[ch.id] = ch; });
      var gl = (ds.groups && ds.groups.length) ? ds.groups
        : [{ k: 'tum', ad: ds.name, ids: ds.channels.map(function(c) { return c.id; }) }];
      var tek = gl.length === 1;
      gl.forEach(function(g) {
        var items = g.ids.map(function(id) { return byId[id]; }).filter(Boolean).map(function(ch) {
          return {
            sensorId: ds.sensorId, signalId: ch.id, name: ch.name, unit: ch.unit || '',
            dir: 'comp', compType: 'fead-analysis',
            source: (ch.src ? ch.src + ' · ' : '') + 'FEAD çözücü — X: ' + ds.x.name,
            virtual: true
          };
        });
        if(!items.length) return;
        out.push({
          gid: 'fead:' + ds.key + ':' + g.k, key: 'fead:' + ds.key + ':' + g.k,
          name: tek ? ds.name : (ds.short + ' · ' + g.ad),
          icon: ds.icon, dragId: tek ? ds.sensorId : null, items: items
        });
      });
    });
    return out;
  }

  function series(sets, sensorId, signalId) {
    var ds = setOf(sets, sensorId);
    if(!ds) return null;
    if(ds.x && ds.x.id === signalId) return ds.x.data || null;
    for(var j = 0; j < ds.channels.length; j++)
      if(ds.channels[j].id === signalId) return ds.channels[j].data || null;
    return null;
  }
  function setOf(sets, sensorId) {
    for(var i = 0; i < (sets || []).length; i++)
      if(sets[i].sensorId === sensorId) return sets[i];
    return null;
  }
  function setOfSlot(sets, slot) {
    if(!slot) return null;
    var i;
    for(i = 0; i < ((slot.sensors) || []).length; i++) {
      var ds = setOf(sets, slot.sensors[i].id);
      if(ds) return ds;
    }
    var xid = (slot.xAxis && slot.xAxis.id) ? String(slot.xAxis.id) : '';
    var c = xid.indexOf(':');
    return setOf(sets, c > 0 ? xid.substring(0, c) : xid);
  }
  function xAxisOf(ds) {
    if(!ds || !ds.x) return null;
    return { id: ds.sensorId + ':' + ds.x.id, name: ds.x.name + ' [' + ds.x.unit + ']', unit: ds.x.unit };
  }
  function channelOf(sets, sensorId, signalId) {
    var ds = setOf(sets, sensorId);
    if(!ds) return null;
    if(ds.x && ds.x.id === signalId) return { id: ds.x.id, name: ds.x.name, unit: ds.x.unit };
    for(var i = 0; i < ds.channels.length; i++)
      if(ds.channels[i].id === signalId) return ds.channels[i];
    return null;
  }

  // ── HAZIR DİYAGRAMLAR ─────────────────────────────────────────────────────
  // Boş panonun tek tıklık kısayolları. Her biri BİR veri kümesine ve o
  // kümenin kanallarından kurulmuş ŞERİTLERE karşılık gelir (şerit = aynı
  // eksende birlikte okunacak kanallar). Tanım burada, kurulumu pano yapar:
  // kimlikler kümede yoksa (kayış verisi kapalı, gergi ters taraf) o şerit
  // SESSİZCE düşer — var olmayan kanal için boş şerit çizilmez.
  function presets(sets) {
    var out = [];
    var ds = setOf(sets, SENSOR_PREFIX + 'cevrim');
    function ids(d, fn) { return d.channels.filter(fn).map(function(c) { return c.id; }); }
    function end(id, suf) { return id.slice(-suf.length) === suf; }
    if(ds) {
      out.push({ k: 'gerg', ad: 'Gerginlik ve kayma', ikon: 'activity', alt: 'Açıklık gerginlikleri · en düşük kayma emniyeti',
                 sensorId: ds.sensorId,
                 lanes: [ids(ds, function(c) { return end(c.id, '.T'); }),
                         ids(ds, function(c) { return c.id === 'sfmin' || end(c.id, '.sf'); })] });
      out.push({ k: 'hub', ad: 'Hubload', ikon: 'crosshair', alt: 'Kasnak başına büyüklük ve yön',
                 sensorId: ds.sensorId,
                 lanes: [ids(ds, function(c) { return end(c.id, '.hub'); }),
                         ids(ds, function(c) { return end(c.id, '.dir'); })] });
      out.push({ k: 'aks', ad: 'Aksesuar yükü', ikon: 'zap', alt: 'Güç · mil torku · kasnak devri',
                 sensorId: ds.sensorId,
                 lanes: [ids(ds, function(c) { return end(c.id, '.kw') || c.id === 'pkw'; }),
                         ids(ds, function(c) { return end(c.id, '.nm'); }),
                         ids(ds, function(c) { return end(c.id, '.rpm'); })] });
    }
    var cb = setOf(sets, SENSOR_PREFIX + 'campbell');
    if(cb) out.push({ k: 'camp', ad: 'Campbell diyagramı', ikon: 'git-branch', alt: 'Uyarma mertebeleri × doğal frekanslar',
                      sensorId: cb.sensorId, lanes: [cb.channels.map(function(c) { return c.id; })] });
    var kl = setOf(sets, SENSOR_PREFIX + 'kol');
    if(kl) out.push({ k: 'kol', ad: 'Gergi kolu', ikon: 'sliders', alt: 'Gerginlik kontrol eğrisi · take-up',
                      sensorId: kl.sensorId, lanes: [['T', 'hub'], ['tk'], ['phi']] });
    var sn = setOf(sets, SENSOR_PREFIX + 'senaryo');
    if(sn) out.push({ k: 'sen', ad: 'Motor çevrimi', ikon: 'play', alt: 'Marştan stopa devir ve gerginlik',
                      sensorId: sn.sensorId,
                      lanes: [['rpm'],
                              ids(sn, function(c) { return end(c.id, '.T'); }),
                              ids(sn, function(c) { return end(c.id, '.f1') || c.id === 'fire'; })] });
    // Kümede olmayan kimlik düşer; boş kalan şerit de.
    out.forEach(function(p) {
      var d = setOf(sets, p.sensorId);
      var var_ = {};
      d.channels.forEach(function(c) { var_[c.id] = true; });
      p.lanes = p.lanes.map(function(L) { return L.filter(function(id) { return var_[id]; }); })
        .filter(function(L) { return L.length; });
    });
    return out.filter(function(p) { return p.lanes.length; });
  }

  // ── ÖZET — pencerenin ilk ekranı ve çözücü penceresinin Sonuç sekmesi ─────
  //
  // TEK üretici: Sonuçlar sekmesinin kartları ile çözücü penceresinin özeti
  // aynı listeyi basar. Durum sözlüğü: ok · warn · no · wait (veri eksik,
  // uygun SAYILMAZ) · off (bilerek kapalı) · info (hüküm yok, bilgi).
  // EŞİK UYDURULMAZ: hüküm yalnız modelin kendi ölçütü olan yerde var (SF < 1
  // kayma, SF < servis faktörü, uygunluk kapılarının kendi durumu); kayma
  // eşiğinin payı ya da tepe yük bir BİLGİ'dir.
  function summary(R) {
    var out = [];
    if(!R || !R.ok || !R.analysis) return out;
    var A = R.analysis;
    var rows = _dutyRows(R);
    var P = _pulleys(R);
    var loaded = _loadedSet(rows);
    var ten = R.tensionerSide;
    var ters = !!(ten && ten.ok === false);

    // 1) Kayma
    var m = { v: Infinity, rpm: NaN, i: -1 };
    rows.forEach(function(d) {
      (d.slip || []).forEach(function(s, i) {
        var yuk = Object.keys(loaded).length ? loaded[i] : true;
        var v = _num(s.SF);
        if(yuk && v < m.v) { m.v = v; m.rpm = _num(d.engineRpm); m.i = i; }
      });
    });
    var sfIst = _num(R.serviceFact);
    if(ters) {
      out.push({ k: 'kayma', ad: 'Kayma emniyeti', deger: '—', birim: '', durum: 'no',
                 not: 'Gergi kayışın GERGİN tarafında — kayma emniyeti hüküm vermez' });
    } else if(isFinite(m.v)) {
      var d1 = m.v < 1 ? 'no' : ((sfIst > 0 && m.v < sfIst) ? 'warn' : 'ok');
      // Birim YOK: SF boyutsuz bir oran; kartta "×" başıboş bir harf gibi okunuyordu.
      out.push({ k: 'kayma', ad: 'Kayma emniyeti (en düşük)', deger: _tr(m.v, 2), birim: '', durum: d1,
                 not: (P[m.i] ? P[m.i].code : '') + ' · ' + _tr(m.rpm, 0) + ' d/dk'
                   + (sfIst > 0 ? ' · istenen ≥ ' + _tr(sfIst, 2) : '') });
    }

    // 2) Kayma eşiği — hüküm değil bilgi
    var thr = (typeof veFeadSlipThreshold === 'function' && R.build)
      ? veFeadSlipThreshold(R.build, A.duty || []) : null;
    if(thr && !ters) {
      var ti = -1;
      P.forEach(function(p) { if(p.name === thr.pulley) ti = p.i; });
      out.push({ k: 'esik', ad: 'Kayma eşiği', deger: _tr(thr.tensionN, 0), birim: 'N', durum: 'info',
                 not: (ti >= 0 ? P[ti].code : thr.pulley) + ' · ' + _tr(thr.engineRpm, 0) + ' d/dk · tasarım '
                   + _tr(thr.margin, 2) + ' katı' });
    }

    // 3) Gergi tarafı
    if(ten) out.push({ k: 'taraf', ad: 'Gergi konumu', deger: ten.ok === false ? 'Gergin taraf' : 'Gevşek taraf',
                       birim: '', durum: ten.ok === false ? 'no' : 'ok',
                       not: ten.ok === false ? 'Otomatik gergi gevşek tarafa konur' : 'Kayış gidişinde doğru yerde' });

    // 4) Çalışma noktası
    var tn = A.tensioner || {};
    out.push({ k: 'ankraj', ad: 'Tasarım gerginliği', deger: _tr(_num(tn.tensionN), 0), birim: 'N', durum: 'info',
               not: 'gergi hubload ' + _tr(_num(tn.hubloadN), 0) + ' N · ' + _tr(_num(tn.hubDirDeg), 0) + '°' });

    // 5) Kayış boyu
    out.push({ k: 'boy', ad: 'Gereken kayış boyu', deger: _tr(_num(A.requiredBeltMm), 1), birim: 'mm', durum: 'info',
               not: 'tahrik boyu ' + _tr(_num(A.driveLenMm), 1) + ' mm · ofset ' + _tr(_num(A.lengthOffsetMm), 2) + ' mm' });

    // 6) Burulma — gözlem (çözücü penceresinin kartı gibi hüküm değil)
    var T = R.torsional;
    if(T && isFinite(_num(T.firstElasticHz))) {
      var fs = rows.map(function(d) { return _num(d.firingHz); }).filter(isFinite);
      var lo = fs.length ? Math.min.apply(null, fs) : NaN, hi = fs.length ? Math.max.apply(null, fs) : NaN;
      var ic = (T.elasticHz || []).filter(function(f) { return f >= lo && f <= hi; });
      out.push({ k: 'burulma', ad: '1. burulma modu', deger: _tr(T.firstElasticHz, 1), birim: 'Hz',
                 durum: ic.length ? 'warn' : 'ok',
                 not: ic.length ? ic.map(function(f) { return _tr(f, 1); }).join(' · ')
                                  + ' Hz ateşleme bandında (' + _tr(lo, 0) + '–' + _tr(hi, 0) + ' Hz)'
                                : 'ateşleme bandının (' + _tr(lo, 0) + '–' + _tr(hi, 0) + ' Hz) dışında' });
    } else {
      out.push({ k: 'burulma', ad: 'Burulma modeli', deger: '—', birim: '', durum: 'wait',
                 not: 'ataletler eksik — model çözülmedi' });
    }

    // 7) B10 ömrü
    var L = R.life;
    if(!beltOn(R)) {
      out.push({ k: 'omur', ad: 'B10 kayış ömrü', deger: 'Kapalı', birim: '', durum: 'off',
                 not: 'kayış tipine bağlı çıktılar kapalı' });
    } else if(L && _num(L.damageRate) > 0) {
      var saat = L.inValidRange ? _num(L.hoursB10) : _num(L.hoursB10Corrected);
      out.push({ k: 'omur', ad: 'B10 kayış ömrü', deger: _tr(saat, 0), birim: 'saat', durum: 'info',
                 not: L.inValidRange ? 'çap penceresi içinde' : 'çap penceresi DIŞINDA — ampirik düzeltmeli' });
    } else {
      out.push({ k: 'omur', ad: 'B10 kayış ömrü', deger: '—', birim: '', durum: 'wait',
                 not: 'çevrim yüzdeleri girilmedi' });
    }

    // 8) Uygunluk kapıları — kapıların KENDİ durumu
    var C = R.checks;
    if(C) {
      [['centerDistance', 'Merkez mesafesi'], ['ratioWindow', 'Çevrim oranı'],
       ['speedLimit', 'Aksesuar devri']].forEach(function(p) {
        var c = C[p[0]];
        if(!c) return;
        var durum = c.durum === 'ok' ? 'ok' : (c.durum === 'warn' ? 'warn' : (c.durum === 'no' ? 'no' : 'wait'));
        var deger = durum === 'ok' ? 'Uygun' : (durum === 'warn' ? 'Sınırda' : (durum === 'no' ? 'Uygun değil' : 'Değerlendirilemedi'));
        var not = c.note || '';
        if(!not && p[0] === 'centerDistance' && c.worst)
          not = 'en yakın çift ' + c.worst.cift + ' · pay %' + _tr(c.worst.payPct, 1);
        out.push({ k: 'kapi-' + p[0], ad: p[1], deger: deger, birim: '', durum: durum, not: not });
      });
    }
    return out;
  }

  return {
    build: build, groups: groups, series: series, setOf: setOf, setOfSlot: setOfSlot,
    xAxisOf: xAxisOf, channelOf: channelOf, isFeadSensor: isFeadSensor,
    presets: presets, summary: summary, beltOn: beltOn,
    SENSOR_PREFIX: SENSOR_PREFIX, SET_KEYS: SET_KEYS,
    CAMP_NPTS: CAMP_NPTS, KOL_NPTS: KOL_NPTS, KOL_T_KAT: KOL_T_KAT, TORK_K: TORK_K,
    _orders: _orders, _pulleys: _pulleys
  };
})();

// Node/Jest ortamında modül olarak da erişilebilir olsun (tarayıcıda no-op).
if(typeof module !== 'undefined' && module.exports) { module.exports = veFeadSignals; }
