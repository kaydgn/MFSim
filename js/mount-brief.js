// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ DİYAGRAM YORUMU — çözüm sonucunu OKUYUP cümleye çeviren katman
// ═══════════════════════════════════════════════════════════════════════════
//
// NEDEN AYRI DOSYA: js/mount-signals.js panoya SAYI üretir; burası o sayıları
// ve çözümün kendisini (R) okuyup Türkçe yorum yazar. İkisi ayrı sorumluluk:
// biri veri, öteki anlatı. Yorum bozulursa eğriler etkilenmez.
//
// TASARIM KARARI — genel geçer metin YOK. Her cümle ya modelin kendi
// sayısından türer (tepe frekansı, ateşleme frekansındaki iletilebilirlik,
// ilk çekmenin başladığı ivme) ya da hiç yazılmaz. "Bu grafik iletilebilirliği
// gösterir" cümlesi beş diyagramda da aynıdır ve kimseye bir şey öğretmez;
// "6,5 Hz'deki tepe yalpalama modu, orada kuvvet 325 katına çıkıyor" cümlesi
// yalnız BU modele aittir.
//
// SAYI UYDURULMAZ: hesaplanamayan büyüklüğün cümlesi düşer. Motor tanımı yoksa
// ateşleme frekansı paragrafı hiç yazılmaz — "bilinmiyor" yazan bir cümle,
// olmayan bir cümleden kötüdür.
//
// YORUM ŞERİT BAŞINADIR, veri kümesi başına değil. Kullanıcı tek bir kanal
// açtıysa o kanalın yorumu; alt alta iki şerit açtıysa iki başlıklı iki yorum;
// bir kümenin tüm kanallarını TEK şeritte birleştirdiyse o birleşime özel bir
// yorum gelir. Aynı diyagramın "düşey iletilebilirlik" hâliyle "dokuz kanal
// üst üste" hâli farklı şeyler anlatır — tek bir metin ikisine birden hizmet
// edemez.
//
// VURGU: sayılar `**...**` ile işaretlenir. Bu, mount-brief'in HTML üretmediği
// anlamına gelir — işaretleme sunum katmanında (js/trace-view.js) kaçırılarak
// <b>'ye çevrilir. Yorum motoru HTML yazsaydı, üretilen her cümle bir enjeksiyon
// yüzeyi olurdu.
//
// Saf modül: DOM'a dokunmaz, global duruma yazmaz. Jest'te doğrudan test edilir.
// ═══════════════════════════════════════════════════════════════════════════

var veMntBrief = (function() {
  'use strict';

  // ── Sayı biçimi: Türkçe ondalık ayracı ──────────────────────────────────
  function n(v, dec) {
    if(!isFinite(v)) return '—';
    var d = (dec == null) ? 2 : dec;
    return v.toFixed(d).replace('.', ',');
  }
  // Büyüklüğe göre otomatik ondalık — 0,004 ile 325 aynı kuralla yazılamaz.
  function na(v) {
    if(!isFinite(v)) return '—';
    var a = Math.abs(v);
    if(a >= 100) return n(v, 0);
    if(a >= 10)  return n(v, 1);
    if(a >= 1)   return n(v, 2);
    if(a >= 0.01) return n(v, 3);
    return n(v, 4);
  }
  // Türkçede yüzde işareti sayının ÖNÜNDE durur: %98,3. Gereksiz ",0" kuyruğu
  // atılır ("%2,0" değil "%2"). Eksi işareti yüzdenin de ÖNÜNDE kalır —
  // "%-1295" değil "−%1295".
  //
  // EK ALMAZ: metinlerde "%96,4'i" gibi iyelik eki KULLANILMAZ. Türkçede ek,
  // sayının okunuşundaki son ünlüye göre değişir (%2'si, %4'ü, %6'sı, %9'u);
  // basamaktan kural çıkarmak yuvarlak sayılarda ("%20" → "yirmi") kırılır.
  // Cümleler "%96,4 kadarı" biçiminde, eksiz kurulur.
  function pct(v, dec) {
    var neg = v < 0;
    var s = n(Math.abs(v), dec == null ? 1 : dec);
    if(s.indexOf(',') >= 0) s = s.replace(/,?0+$/, '');
    return (neg ? '−%' : '%') + s;
  }
  // Kuyruktaki sıfırları atan biçim: girdi olarak GİRİLEN bir sayıyı ("3 g",
  // "20 ms") "3,00 g" diye yazmak, olmayan bir hassasiyet iddia eder.
  function nz(v, dec) {
    if(!isFinite(v)) return '—';
    var s = n(v, dec == null ? 2 : dec);
    if(s.indexOf(',') >= 0) s = s.replace(/,?0+$/, '');
    return s;
  }

  // Çekirdeğin mod etiketleri (classifyMode) İngilizce kısaltmalardır. Panoyu
  // okuyan herkes bunları bilmek zorunda değil: Türkçe karşılık + parantezde
  // aslı. Bileşik mod ("bounce+pitch") parçalanıp ayrı ayrı çevrilir.
  var MODE_TR = {
    'bounce':   'düşey zıplama (bounce)',
    'fore-aft': 'ileri-geri (fore-aft)',
    'lateral':  'yanal (lateral)',
    'roll':     'yalpalama (roll)',
    'pitch':    'baş-kıç vurma (pitch)',
    'yaw':      'savrulma (yaw)'
  };
  function modeTR(label) {
    if(!label) return 'mod';
    return String(label).split('+').map(function(p) {
      return MODE_TR[p.trim()] || p.trim();
    }).join(' + ');
  }

  // Grafik üzerindeki dik etiket için kısa biçim: uzun ad dar eksende okunmaz.
  var MODE_SHORT = {
    'bounce': 'zıplama', 'fore-aft': 'ileri-geri', 'lateral': 'yanal',
    'roll': 'yalpalama', 'pitch': 'baş-kıç', 'yaw': 'savrulma'
  };
  function modeShort(label) {
    if(!label) return 'mod';
    return String(label).split('+').map(function(p) {
      return MODE_SHORT[p.trim()] || p.trim();
    }).join('+');
  }

  // ── Ortak yardımcılar ────────────────────────────────────────────────────

  function chan(ds, id) {
    if(!ds || !ds.channels) return null;
    for(var i = 0; i < ds.channels.length; i++) {
      if(ds.channels[i].id === id) return ds.channels[i];
    }
    return null;
  }

  // x0 noktasındaki y — komşu iki örnek arasında ara değer.
  //
  // isLog ÇAĞIRAN TARAFINDAN SÖYLENİR, ızgaraya bakıp TAHMİN EDİLMEZ. Önceki
  // sürüm "ardışık iki x'in oranı 1'den büyükse log'dur" diye kestiriyordu;
  // bu, artan HER pozitif ızgarayı log sayar. 36 noktalı ivme süpürmesinde
  // (0–3,5 g, eşit aralıklı) bu sessizce yanlış sayı üretiyordu: [1,2] arası
  // 1,5 sorulduğunda 15 yerine 15,85 dönüyordu. Yorum cümlesi akıcı, sayı
  // yanlış — en tehlikeli tür.
  //
  // Sıfır içeren aralıkta log tanımsızdır; orada her hâlükârda doğrusal.
  function interpAt(x, y, x0, isLog) {
    if(!x || !y || !x.length || x.length !== y.length) return NaN;
    if(!(x0 >= x[0]) || !(x0 <= x[x.length - 1])) return NaN;
    for(var i = 0; i < x.length - 1; i++) {
      if(x0 >= x[i] && x0 <= x[i + 1]) {
        var t;
        if(isLog && x[i] > 0 && x[i + 1] > x[i]) {
          var a = Math.log10(x[i]), b = Math.log10(x[i + 1]);
          t = (Math.log10(x0) - a) / (b - a);
        } else {
          t = (x[i + 1] > x[i]) ? (x0 - x[i]) / (x[i + 1] - x[i]) : 0;
        }
        return y[i] + t * (y[i + 1] - y[i]);
      }
    }
    return NaN;
  }

  // Yerel en büyükler. Gürültü tepesi sayılmasın diye komşularından belirgin
  // yüksek olma şartı var; ayrıca eşiğin altındaki küçük dalgalanmalar elenir.
  function peaks(x, y, minVal) {
    var out = [];
    if(!x || !y) return out;
    for(var i = 1; i < y.length - 1; i++) {
      if(!isFinite(y[i])) continue;
      if(y[i] > y[i - 1] && y[i] >= y[i + 1] && y[i] >= minVal) {
        out.push({ f: x[i], v: y[i] });
      }
    }
    return out.sort(function(a, b) { return b.v - a.v; });
  }

  // Eğrinin KALICI olarak eşiğin altına indiği nokta (sağdan tarayarak).
  function lastCrossBelow(x, y, level) {
    if(!x || !y) return NaN;
    for(var i = y.length - 1; i > 0; i--) {
      if(isFinite(y[i - 1]) && y[i - 1] >= level && isFinite(y[i]) && y[i] < level) {
        var t = (y[i - 1] - level) / (y[i - 1] - y[i]);
        return x[i - 1] + t * (x[i] - x[i - 1]);
      }
    }
    return NaN;
  }

  // Süpürmede bir sayacın ilk kez sıfırdan büyüdüğü x — "ilk çekme hangi
  // ivmede başlıyor" sorusunun cevabı.
  function firstNonZero(x, y) {
    if(!x || !y) return NaN;
    for(var i = 0; i < y.length; i++) {
      if(isFinite(y[i]) && y[i] > 0) return x[i];
    }
    return NaN;
  }

  function engineFiring(R) {
    var tq = (R && R.gather && R.gather.torque) || {};
    var rpm = Number(tq.idleRpm), cyl = Number(tq.cylinders);
    if(!(rpm > 0) || !(cyl > 0)) return null;
    return { rpm: rpm, cyl: cyl, f: (rpm / 60) * (cyl / 2) };
  }

  // Statik yük durumu — çalışma noktası cümlelerinin kaynağı.
  function staticCase(R) {
    var all = (R && R.allCases) || [];
    for(var i = 0; i < all.length; i++) {
      if(all[i] && all[i].name === 'Static' && all[i].res) return all[i].res;
    }
    return null;
  }

  function mountLabel(mnt, i) {
    var s = (mnt && mnt.name) ? String(mnt.name).trim() : '';
    return s ? s : ('Takoz ' + (i + 1));
  }

  // ── Taşıma kapasitesi kullanımı ─────────────────────────────────────────
  // mnt.fCap [N] OPSİYONEL katalog verisidir (cp-mount.js _mntToSI: kg × g).
  // Tanımsızsa hiçbir cümle kurulmaz — "kapasite bilinmiyor" yazan bir cümle,
  // olmayan bir cümleden kötüdür.
  //
  // Statik düşey kuvvetin kapasiteye oranı. Sıra numarası ADLA eşleşir: şeritte
  // takoz adı görünür, kimlik değil.
  function capOf(R, name) {
    var mounts = (R && R.mounts) || [];
    for(var i = 0; i < mounts.length; i++) {
      if(mountLabel(mounts[i], i) === name) return (mounts[i].fCap > 0) ? mounts[i].fCap : NaN;
    }
    return NaN;
  }

  function capUse(R, name) {
    var mounts = (R && R.mounts) || [], stat = staticCase(R);
    if(!stat || !stat.perMount) return null;
    for(var i = 0; i < mounts.length; i++) {
      if(mountLabel(mounts[i], i) !== name) continue;
      var fc = mounts[i].fCap;
      var pm = stat.perMount[i];
      if(!(fc > 0) || !pm) return null;
      var fz = Math.abs((pm.f || [])[2] || 0);
      return { fCap: fc, f: fz, pct: fz / fc * 100 };
    }
    return null;
  }

  var GS_TEXT = {
    gz: { yon: 'düşey', baslik: 'Düşey ivme süpürmesi',
          sifir: '1 g statik yük durumudur',
          tasarim: 3.5, tasarimAd: '3,5 g düşey' },
    gy: { yon: 'yanal', baslik: 'Yanal ivme süpürmesi',
          sifir: 'düşey yük 1 g\'de sabit tutulur',
          tasarim: 1, tasarimAd: '1 g yanal' },
    gx: { yon: 'boyuna', baslik: 'Boyuna ivme süpürmesi',
          sifir: 'düşey yük 1 g\'de sabit tutulur',
          tasarim: 1, tasarimAd: '1 g boyuna' }
  };

  // Vurgu işaretleyici — sayılar bu sarmalın içine girer, sunum katmanı
  // (js/trace-view.js _veTrRich) bunu <b>'ye çevirir.
  function b(x) { return '**' + x + '**'; }

  var AX_TR = ['boyuna (X)', 'yanal (Y)', 'düşey (Z)'];

  // ── Kanal kimliği çözümleme ──────────────────────────────────────────────
  // FRF:      T_<dir> | T0_<dir> | eta_<dir>
  // fdefl:    m.<slug>.<eksen>
  // süpürme:  m.<slug>.d | m.<slug>.f | dmax | ntens | nclamp
  // campbell: ord.<mertebe> | mode.<no>
  function parseId(id) {
    // Takoz kırılımı sistem kanallarından ÖNCE denenir: 'Tm_2_m.on_sol'
    // kimliğinin başı 'T'..' ile karışmasın.
    var m = /^Tm_([012])_(m\..+)$/.exec(id);
    if(m) return { kind: 'Tm', dir: +m[1], mount: m[2] };
    m = /^(T0|T|eta)_([012])$/.exec(id);
    if(m) return { kind: m[1], dir: +m[2] };
    m = /^ord\.([0-9]+(?:_[0-9]+)?)$/.exec(id);
    if(m) return { kind: 'order', order: parseFloat(m[1].replace('_', '.')) };
    m = /^mode\.([0-9]+)$/.exec(id);
    if(m) return { kind: 'mode', no: +m[1] };
    m = /^(m\..+)\.([012dfDF])$/.exec(id);
    if(m) return { kind: 'mount', mount: m[1], part: m[2] };
    return { kind: id };
  }

  // Kanalın adından takoz adını çıkar ("Ön Sol · bileşke çökme" → "Ön Sol").
  function chanMount(ch) {
    var s = (ch && ch.name) ? String(ch.name) : '';
    var i = s.indexOf(' · ');
    return i > 0 ? s.substring(0, i) : s;
  }

  // Bir takozun düşey (Z) F(δ) kanalının kimliği. Kanal ADINDAN değil KİMLİK
  // biçiminden ve takoz adından bulunur: ad "(nonlineer)" gibi ekler alabilir,
  // kimlik biçimi (m.<slug>.<eksen>) almaz.
  function zChanId(ds, label) {
    for(var i = 0; i < ((ds && ds.channels) || []).length; i++) {
      var ch = ds.channels[i], p = parseId(ch.id);
      if(p.kind === 'mount' && +p.part === 2 && chanMount(ch) === label) return ch.id;
    }
    return null;
  }

  // Eğrinin bir noktadaki eğimi — kuvvet-deformasyon şeridinde "sertlik".
  // δ = ±1 mm arasındaki fark alınır: sıfırdaki teğet, nonlineer eğride
  // çalışma bandını temsil etmiyor.
  function slopeAt0(x, y) {
    var lo = interpAt(x, y, -1), hi = interpAt(x, y, 1);
    if(!isFinite(lo) || !isFinite(hi)) return NaN;
    return (hi - lo) / 2;      // N/mm
  }

  // ═══════════ 1) FREKANS YANITI — şerit yorumu ═══════════
  function frfLane(ds, R, chans) {
    var f = ds.x.data;
    var eng = engineFiring(R);
    var modes = ((R && R.modes) || []).filter(function(m) { return m && m.f_Hz > 1e-6; });
    var paras = [];

    var damped = [], undamped = [], effs = [], perM = [];
    chans.forEach(function(ch) {
      var p = parseId(ch.id);
      if(p.kind === 'T') damped.push({ ch: ch, dir: p.dir });
      else if(p.kind === 'T0') undamped.push({ ch: ch, dir: p.dir });
      else if(p.kind === 'eta') effs.push({ ch: ch, dir: p.dir });
      else if(p.kind === 'Tm') perM.push({ ch: ch, dir: p.dir, mount: chanMount(ch) });
    });

    var full = chans.length === ds.channels.length;
    var title = full ? 'Frekans yanıtı — birleşik (' + chans.length + ' kanal)'
      : (damped.length && !undamped.length && !effs.length
          ? 'Frekans yanıtı — ' + (damped.length === 3 ? 'üç yön birlikte' : AX_TR[damped[0].dir])
          : 'Frekans yanıtı');

    // Her sönümlü kanal için tepe + ateşleme frekansındaki değer
    function line(e) {
      var pk = peaks(f, e.ch.data, 1.05);
      var s = b(AX_TR[e.dir]) + ': ';
      if(pk.length) {
        var near = null, bestD = Infinity;
        modes.forEach(function(m) {
          var d = Math.abs(Math.log10(m.f_Hz) - Math.log10(pk[0].f));
          if(d < bestD) { bestD = d; near = m; }
        });
        s += 'en yüksek tepe ' + b(na(pk[0].f) + ' Hz') +
             (near && bestD < 0.05 ? ' (' + modeShort(near.label) + ')' : '') +
             ', orada kuvvet ' + b(na(pk[0].v) + '×') + ' büyüyor';
      } else { s += 'belirgin tepe yok'; }
      if(eng) {
        var Tf = interpAt(f, e.ch.data, eng.f, true);
        if(isFinite(Tf)) s += '; ateşlemede ' + b(na(Tf)) +
          ' (titreşimin ' + b(pct((1 - Tf) * 100, 1)) + ' kadarı takozda kalıyor)';
      }
      return s + '.';
    }

    // ── BİRLEŞİK: kümenin tüm kanalları tek şeritte ──
    if(full) {
      paras.push(
        b(chans.length + ' kanal') + ' üst üste: üç yönün sönümlü ve sönümsüz ' +
        'iletilebilirliği, izolasyon verimi' +
        (perM.length ? ' ve ' + b(perM.length + ' takoz kırılımı') : '') +
        '. Birimler karışık (iletilebilirlik birimsiz, verim ' + b('%') + '); ' +
        'kanallar tek ölçeğe oturmuyor.');
      var worst = null;
      damped.forEach(function(e) {
        var pk = peaks(f, e.ch.data, 1.05);
        if(pk.length && (!worst || pk[0].v > worst.v)) worst = { v: pk[0].v, f: pk[0].f, dir: e.dir };
      });
      var pk0 = [];
      undamped.forEach(function(e) { var q = peaks(f, e.ch.data, 1.05); if(q.length) pk0.push(q[0].v); });
      var s = '';
      if(worst) s += 'En kötü durum ' + b(AX_TR[worst.dir]) + ' yönde: ' + b(na(worst.f) + ' Hz') +
                     '\'de kuvvet ' + b(na(worst.v) + '×') + ' büyüyor. ';
      if(pk0.length) s += 'Ölçeği ele geçiren eğri sönümsüz olandır — tepesi ' +
                          b(na(Math.max.apply(null, pk0)) + '×') + '. ';
      s += 'Verim kanalı rezonansta ' + b('eksi') + ' değerlere iner; dikey eksen ' +
           'bu yüzden iki tarafa birden gerilir.';
      paras.push(s);
      return { title: title, paras: paras };
    }

    // ── Takoz başına iletilebilirlik ──
    // Tedarikçi raporlarındaki "destek başına eğri". Buradaki asıl mesele,
    // sayıların sistem toplamıyla neden örtüşmediği: kuvvetler karmaşıktır,
    // toplam VEKTÖREL alınır. Söylenmezse kullanıcı bunu bir hata sanar.
    if(perM.length && !undamped.length && !effs.length) {
      var dirsUsed = {};
      perM.forEach(function(e) { dirsUsed[e.dir] = 1; });
      var dks = Object.keys(dirsUsed);
      var titleM = 'Takoz başına iletilebilirlik' +
        (dks.length === 1 ? ' — ' + AX_TR[+dks[0]] : '');
      paras.push(b(perM.length + ' takozun') + ' ayrı iletilebilirliği: her eğri o ' +
        'takozun şasiye geçirdiği kuvvettir, sistem eğrisi hepsinin toplamıdır.');

      // Ateşleme frekansında sıralama — asıl kullanım noktası burası.
      if(eng) {
        var rows = perM.map(function(e) {
          return { name: e.mount, dir: e.dir, v: interpAt(f, e.ch.data, eng.f, true) };
        }).filter(function(o) { return isFinite(o.v); }).sort(function(a, c) { return c.v - a.v; });
        if(rows.length) {
          var sum = 0;
          rows.forEach(function(o) { sum += o.v; });
          var s = 'Rölanti ateşleme frekansında (' + b(na(eng.f) + ' Hz') + ') en çok ' +
            'kuvvet geçiren takoz ' + b(rows[0].name) + ' (' + b(na(rows[0].v)) + ')';
          if(rows.length > 1) {
            s += ', en az geçiren ' + b(rows[rows.length - 1].name) + ' (' +
                 b(na(rows[rows.length - 1].v)) + ')';
            if(rows[rows.length - 1].v > 0) {
              s += ' — aralarında ' + b(na(rows[0].v / rows[rows.length - 1].v) + ' kat') + ' fark var';
            }
          }
          paras.push(s + '.');
        }
      }

      // Tepe frekansları takoz başına
      var pkRows = perM.map(function(e) {
        var q = peaks(f, e.ch.data, 0);
        return q.length ? { name: e.mount, f: q[0].f, v: q[0].v } : null;
      }).filter(Boolean).sort(function(a, c) { return c.v - a.v; });
      if(pkRows.length) {
        paras.push('En yüksek tepe ' + b(pkRows[0].name) + ' takozunda: ' +
          b(na(pkRows[0].f) + ' Hz') + '\'de ' + b(na(pkRows[0].v) + '×') +
          '. Tepe frekansları bütün takozlarda ortaktır: tepeler yapının ' +
          'modlarına aittir, takoza değil.');
      }

      paras.push('Takoz eğrilerinin aritmetik toplamı sistem eğrisini vermez: ' +
        'kuvvetler ' + b('genlik ve faz') + ' taşır, toplam vektöreldir. Zıt fazlı ' +
        'iki takozda tekil genlikler büyük, sistem toplamı küçük çıkar.');
      return { title: titleM, paras: paras };
    }

    // ── Yalnız sönümlü iletilebilirlik ──
    if(damped.length && !undamped.length && !effs.length && !perM.length) {
      if(damped.length === 1) {
        var e = damped[0];
        paras.push(b(AX_TR[e.dir]) + ' yönde iletilebilirlik: şasiye geçen kuvvetin ' +
                   'motor kuvvetine oranı. ' + b('1') + ' = azalma yok.');
        var pk = peaks(f, e.ch.data, 1.05);
        if(pk.length) {
          var det = pk.slice(0, 3).map(function(q) {
            var near = null, bd = Infinity;
            modes.forEach(function(m) {
              var d = Math.abs(Math.log10(m.f_Hz) - Math.log10(q.f));
              if(d < bd) { bd = d; near = m; }
            });
            return b(na(q.f) + ' Hz') + (near && bd < 0.05 ? ' (' + modeShort(near.label) + ')' : '') +
                   ' → ' + b(na(q.v) + '×');
          });
          paras.push('Tepeler güç grubunun doğal frekanslarıdır. ' +
                     (modes.length ? 'Toplam ' + b(modes.length + ' mod') + ' var, ' : '') +
                     'bu yönde ' + b(pk.length + ' tanesi') + ' belirgin tepe veriyor: ' +
                     det.join(', ') + '. Diğer modlar bu yönde uyarılmıyor.');
        }
        var cross = lastCrossBelow(f, e.ch.data, 1);
        var s3 = '';
        if(isFinite(cross)) s3 += b(na(cross) + ' Hz') + '\'den sonra eğri kalıcı olarak ' +
                                  b('1') + '\'in altında — izolasyon bölgesi orası. ';
        if(eng) {
          var Tf2 = interpAt(f, e.ch.data, eng.f, true);
          if(isFinite(Tf2)) s3 += 'Rölanti ateşleme frekansı ' + b(na(eng.f) + ' Hz') +
            ' ve orada iletilebilirlik ' + b(na(Tf2)) + ' — yani ' +
            b('izolasyon ' + pct((1 - Tf2) * 100, 1)) + '. Tedarikçi raporlarındaki ' +
            b('"Isolation %"') + ' sütunu bu sayıdır. Yaygın tasarım hedefi ' +
            b('T < 0,2') + ' (≥ %80 izolasyon); model bunu ' +
            (Tf2 < 0.2 ? b('sağlıyor') : b('sağlamıyor')) + '.';
        }
        if(s3) paras.push(s3);
      } else {
        paras.push(b(damped.length + ' yönün') + ' iletilebilirliği ortak eksende.');
        damped.sort(function(a, c) { return a.dir - c.dir; }).forEach(function(e) {
          paras.push(line(e));
        });
      }
      return { title: title, paras: paras };
    }

    // ── Sönümlü + sönümsüz karşılaştırması ──
    if(damped.length && undamped.length) {
      paras.push('Sönümlü ve sönümsüz iletilebilirlik birlikte; aradaki fark sönümün ' +
                 'katkısıdır.');
      damped.forEach(function(e) {
        var u = null;
        undamped.forEach(function(q) { if(q.dir === e.dir) u = q; });
        if(!u) return;
        var pd = peaks(f, e.ch.data, 1.05), pu = peaks(f, u.ch.data, 1.05);
        if(!pd.length || !pu.length) return;
        paras.push(b(AX_TR[e.dir]) + ': sönümsüz tepe ' + b(na(pu[0].v) + '×') +
                   ', sönümlü tepe ' + b(na(pd[0].v) + '×') + ' — sönüm tepeyi ' +
                   b(na(pu[0].v / pd[0].v) + ' kat') + ' bastırıyor' +
                   (isFinite(R.zeta) ? ' (kritik sönüm payı ' + b(pct(R.zeta * 100, 1)) + ')' : '') + '.');
      });
      paras.push('Sönümsüz tepe çok daha yüksek olduğu için ortak eksende sönümlü eğri ' +
                 'düz görünür; karşılaştırma sayısaldır.');
      return { title: 'Frekans yanıtı — sönüm karşılaştırması', paras: paras };
    }

    // ── Yalnız izolasyon verimi ──
    if(effs.length && !damped.length && !undamped.length) {
      paras.push('İzolasyon verimi = (1 − iletilebilirlik) × 100. ' + b('%100') +
                 ' tam izolasyon, ' + b('%0') + ' azalma yok.');
      effs.forEach(function(e) {
        var y = e.ch.data, last = y[y.length - 1];
        var mn = Infinity, mnf = NaN;
        y.forEach(function(v, i) { if(isFinite(v) && v < mn) { mn = v; mnf = f[i]; } });
        paras.push(b(AX_TR[e.dir]) + ': ' + b(na(f[f.length - 1]) + ' Hz') + '\'de verim ' +
                   b(pct(last, 1)) + '; en kötü nokta ' + b(na(mnf) + ' Hz') + '\'de ' +
                   b(pct(mn, 0)) + '.');
      });
      paras.push('Rezonansta değer eksiye iner (iletilebilirlik > 1); ölçek bu yüzden ' +
                 'iletilebilirlik kanallarıyla ortak eksende açılır.');
      return { title: 'Frekans yanıtı — izolasyon verimi', paras: paras };
    }

    // ── Karışık ──
    paras.push(b(chans.length + ' kanal') + ' ortak eksende.');
    damped.forEach(function(e) { paras.push(line(e)); });
    return { title: title, paras: paras };
  }

  // ═══════════ 2) KUVVET-DEFORMASYON — şerit yorumu ═══════════
  function fdeflLane(ds, R, chans) {
    var x = ds.x.data, paras = [];
    var mounts = (R && R.mounts) || [];
    var stat = staticCase(R);

    var items = chans.map(function(ch) {
      var p = parseId(ch.id);
      return { ch: ch, mount: chanMount(ch), ax: +p.part, k: slopeAt0(x, ch.data),
               nl: /nonlineer/.test(ch.name || '') };
    }).filter(function(it) { return it.ax >= 0 && it.ax <= 2; });
    if(!items.length) return null;

    var uniqMounts = {}, uniqAx = {};
    items.forEach(function(it) { uniqMounts[it.mount] = 1; uniqAx[it.ax] = 1; });
    var nM = Object.keys(uniqMounts).length, nA = Object.keys(uniqAx).length;

    // Statik çalışma noktası (düşey) — takoz adına göre
    function workPoint(name) {
      if(!stat || !stat.perMount) return NaN;
      for(var i = 0; i < stat.perMount.length; i++) {
        var nm = mounts[i] ? mountLabel(mounts[i], i) : null;
        if(nm === name) return Math.abs((stat.perMount[i].delta || [])[2] || 0) * 1000;
      }
      return NaN;
    }

    paras.push('Yatay eksen çökme (' + b('mm') + '), dikey eksen kuvvet; eğim ' +
               b('sertlik') + ' verir.' +
      // Nokta işaretleri yalnız düşey eksen çizildiğinde görünür (datasetMarks
      // Z kanalına bağlar); yoksa olmayan bir işareti anlatmış oluruz.
      ((stat && items.some(function(i2) { return i2.ax === 2; }))
        ? ' Eğri üstündeki ' + b('noktalar') + ' statik çalışma noktalarıdır; ömür ve ' +
          'izolasyon o noktadaki eğimden türer, sıfırdaki eğimden değil.'
        : ''));

    var title = 'Kuvvet-deformasyon';
    if(nM === 1 && nA > 1) {
      // Tek takoz, birden çok eksen → yön farkı (anizotropi)
      var mn = Object.keys(uniqMounts)[0];
      title += ' — ' + mn;
      var byAx = items.slice().sort(function(a, c) { return a.ax - c.ax; });
      paras.push(b(mn) + ' takozunun ' + b(byAx.length + ' ekseni') + ': ' +
        byAx.map(function(it) { return AX_TR[it.ax] + ' ' + b(na(it.k) + ' N/mm'); }).join(', ') + '.');
      var ks = byAx.map(function(it) { return it.k; }).filter(isFinite);
      if(ks.length > 1) {
        var mx = Math.max.apply(null, ks), mnk = Math.min.apply(null, ks);
        if(mnk > 0) paras.push('En sert eksen en yumuşağın ' + b(na(mx / mnk) + ' katı') +
          ' (anizotropi).');
      }
    } else if(nA === 1 && nM > 1) {
      // Aynı eksen, birden çok takoz → yük paylaşımı
      var axi = +Object.keys(uniqAx)[0];
      title += ' — ' + AX_TR[axi] + ' eksen';
      paras.push(b(nM + ' takozun') + ' ' + b(AX_TR[axi]) + ' eksen eğrisi.');
      var srt = items.slice().sort(function(a, c) { return c.k - a.k; });
      paras.push('En sert: ' + b(srt[0].mount) + ' ' + b(na(srt[0].k) + ' N/mm') +
        ' · en yumuşak: ' + b(srt[srt.length - 1].mount) + ' ' + b(na(srt[srt.length - 1].k) + ' N/mm') + '.');
    } else if(items.length === 1) {
      var it = items[0];
      title += ' — ' + it.mount + ' · ' + AX_TR[it.ax];
      paras.push(b(it.mount) + ' takozunun ' + b(AX_TR[it.ax]) + ' eksen yasası. ' +
        'Sertlik ' + b(na(it.k) + ' N/mm') + '; eğri ' +
        (it.nl ? b('nonlineer') + ' (yük arttıkça sertleşiyor).' : b('doğrusal') + '.'));
      var wp = workPoint(it.mount);
      if(it.ax === 2 && isFinite(wp)) {
        paras.push('Statik çökme ' + b(na(wp) + ' mm') + ': doğrusal bandın (' + b('±10 mm') +
          ') ' + b(pct(wp / 10 * 100, 0)) + ' kadarı; durdurucuya ' + b(na(15 - wp) + ' mm') +
          ' pay kalıyor.');
      }
    } else {
      title += ' — ' + items.length + ' kanal';
      var kk = items.map(function(i2) { return i2.k; }).filter(isFinite);
      if(kk.length) paras.push(b(items.length + ' eğri') + '; sertlikler ' +
        b(na(Math.min.apply(null, kk)) + ' N/mm') + ' ile ' +
        b(na(Math.max.apply(null, kk)) + ' N/mm') + ' arasında.');
    }

    // ── Katalog kapasitesine göre kullanım ──
    // Tedarikçi raporlarının "Load (%)" sütununun karşılığı. Kapasite girilmiş
    // takoz yoksa bu paragraf hiç yazılmaz.
    var uses = [];
    Object.keys(uniqMounts).forEach(function(nm) {
      var u = capUse(R, nm);
      if(u) uses.push({ name: nm, u: u });
    });
    if(uses.length) {
      uses.sort(function(a, c) { return c.u.pct - a.u.pct; });
      var top = uses[0];
      var s2 = (uses.length === 1 ? b(top.name) + ' takozu' : 'En çok yüklenen takoz (' + b(top.name) + ')') +
        ' araç kendi ağırlığındayken ' + b(na(top.u.f / 1000) + ' kN') + ' taşıyor: katalog ' +
        'kapasitesinin (' + b(na(top.u.fCap / 1000) + ' kN') + ') ' + b(pct(top.u.pct, 1)) + ' kadarı. ';
      s2 += (top.u.pct > 100)
        ? b('Kapasite aşılıyor') + ' — statik yük tek takozun katalog sınırının üstünde.'
        : (top.u.pct > 50
            ? 'Tipik tasarım bandı ' + b('%25–50') + '; değer bandın ' + b('üstünde') +
              ' — dinamik darbeler için pay az.'
            : (top.u.pct < 15
                ? 'Tipik tasarım bandı ' + b('%25–50') + '; değer bandın ' + b('altında') +
                  ' — takoz gereğinden sert olabilir.'
                : 'Tipik tasarım bandı ' + b('%25–50') + '; değer band ' + b('içinde') + '.'));
      paras.push(s2);
    }

    var anyNL = items.some(function(i2) { return i2.nl; });
    paras.push(anyNL
      ? 'Sertleşen eğri, büyük darbede durdurucuya oturmayı geciktirir; ' + b('±15 mm') +
        ' metal-metal temas sınırıdır.'
      : 'Doğrusal eğri, takoz için sabit bir rijitlik girildiğini gösterir; nonlineer yasa ' +
        'Takoz Özellikleri\'nde tanımlanır.');
    return { title: title, paras: paras };
  }

  // ═══════════ 3) İVME SÜPÜRMESİ — şerit yorumu ═══════════
  function sweepLane(ds, R, chans) {
    var t = GS_TEXT[ds.key];
    if(!t) return null;
    var a = ds.x.data, paras = [];

    var defl = [], forc = [], sums = [], counters = [];
    chans.forEach(function(ch) {
      var p = parseId(ch.id);
      if(p.kind === 'mount' && (p.part === 'd')) defl.push(ch);
      else if(p.kind === 'mount' && (p.part === 'f')) forc.push(ch);
      else if(ch.id === 'dmax') sums.push(ch);
      else counters.push(ch);
    });

    var title = t.baslik;
    paras.push('Yatay eksen ' + b(t.yon + ' ivme') + ', dikey eksen takoz çökmesi ve ' +
               'kuvveti; ' + t.sifir + '.');

    function atDesign(ch) { return interpAt(a, ch.data, t.tasarim); }

    if(defl.length) {
      var srt = defl.map(function(ch) {
        return { name: chanMount(ch), v: atDesign(ch) };
      }).filter(function(o) { return isFinite(o.v); }).sort(function(p2, q) { return q.v - p2.v; });
      if(srt.length === 1) {
        title += ' — ' + srt[0].name;
        paras.push(b(srt[0].name) + ' takozu ' + b(t.tasarimAd) + ' altında ' +
          b(na(srt[0].v) + ' mm') + ' eziliyor; ' + b('±15 mm') + ' sınırına ' +
          b(na(15 - srt[0].v) + ' mm') + ' pay kalıyor.');
      } else if(srt.length > 1) {
        title += ' — ' + srt.length + ' takoz';
        paras.push(b(srt.length + ' takozun') + ' çökmesi. ' +
          b(t.tasarimAd) + ' altında en çok yüklenen ' + b(srt[0].name) + ' (' +
          b(na(srt[0].v) + ' mm') + '), en az yüklenen ' + b(srt[srt.length - 1].name) + ' (' +
          b(na(srt[srt.length - 1].v) + ' mm') + '). Aradaki fark ' +
          b(na(srt[0].v - srt[srt.length - 1].v) + ' mm') + ' (yük dağılımı dengesizliği).');
      }
    }

    if(forc.length) {
      var fs = forc.map(function(ch) { return { name: chanMount(ch), v: atDesign(ch) }; })
        .filter(function(o) { return isFinite(o.v); }).sort(function(p2, q) { return q.v - p2.v; });
      if(fs.length) {
        var sF = (fs.length === 1 ? b(fs[0].name) + ' takozuna' : 'En çok yüklenen takoza (' + b(fs[0].name) + ')') +
                 ' ' + b(t.tasarimAd) + ' altında ' + b(na(fs[0].v) + ' N') + ' bileşke kuvvet biniyor.';
        // Katalog kapasitesi EKSENEL BASMA için verilir; bileşke ondan biraz
        // büyüktür. Oran yine de anlamlıdır — ama cümle bunu saklamaz.
        var fc = capOf(R, fs[0].name);
        if(isFinite(fc)) {
          var r = fs[0].v / fc * 100;
          sF += ' Katalog kapasitesi ' + b(na(fc / 1000) + ' kN') + ', yani bu yükte kapasitenin ' +
                b(pct(r, 0)) + ' kadarı' +
                (r > 100 ? ' — ' + b('kapasite aşılıyor') + '.' : '.') +
                ' (Kapasite eksenel basma için verilir; buradaki bileşke kuvvet yanal ' +
                'bileşenleri de içerdiği için biraz büyüktür.)';
        }
        paras.push(sF);
      }
    }

    if(sums.length) {
      var dMax = sums[0];
      var vD = atDesign(dMax), vEnd = dMax.data[dMax.data.length - 1];
      var v1 = interpAt(a, dMax.data, 1);
      var s = '"En büyük takoz çökmesi" kanalı her ivmede en kötü takozu izler: ' +
              b(t.tasarimAd) + ' altında ' + b(na(isFinite(vD) ? vD : vEnd) + ' mm');
      if(ds.key === 'gz' && isFinite(v1)) s += ', araç dururken ' + b(na(v1) + ' mm');
      s += '; ' + b('±15 mm') + ' sınırına ' + b(na(15 - (isFinite(vD) ? vD : vEnd)) + ' mm') + ' pay var.';
      paras.push(s);
    }

    // Olaylar — bu şeritte sayaç olmasa bile kritik bilgi
    var nt = null, nc = null;
    ds.channels.forEach(function(ch) {
      if(ch.id === 'ntens') nt = ch;
      if(ch.id === 'nclamp') nc = ch;
    });
    var aT = nt ? firstNonZero(a, nt.data) : NaN;
    var aC = nc ? firstNonZero(a, nc.data) : NaN;
    var ev = [];
    if(isFinite(aT)) ev.push('İlk çekme (lift-off) ' + b(na(aT) + ' g') + '\'de.');
    if(isFinite(aC)) ev.push('İlk metal-metal temas ' + b(na(aC) + ' g') + '\'de; eğrideki ' +
      'keskin kırılma orada.');
    paras.push(ev.length ? ev.join(' ')
      : 'Süpürme boyunca çekme ve durdurucu teması yok.');

    if(counters.length) {
      paras.push('Sayaç kanallarının birimi ' + b('adet') + '\'tir (mm değil): çekmeye geçen ' +
        've durdurucuya oturan takoz sayısı.');
    }
    return { title: title, paras: paras };
  }

  // ═══════════ 4) CAMPBELL DİYAGRAMI — şerit yorumu ═══════════
  //
  // Campbell'in cevapladığı soru frekans yanıtınınkinden FARKLIDIR: "hangi
  // frekansta rezonans var" değil, "motor hangi DEVİRDE o frekansı üretir".
  // 13,6 Hz'lik bir mod, motorun o frekansı hiç üretmediği bir devir bandında
  // çalışıyorsa zararsızdır. Yorum bu yüzden kesişim DEVİRLERİNİ sayar ve
  // her birinin çalışma bandının içinde mi dışında mı olduğunu söyler.

  // İzolasyonun başlayabilmesi için uyarma frekansının doğal frekansın √2
  // katından yukarıda olması gerekir (T < 1 koşulu). Bu, takoz seçiminin
  // klasik ilk ölçütüdür.
  var ISO_RATIO = Math.SQRT2;

  function campbellCrossings(ords, mds, rpmTop) {
    var out = [];
    ords.forEach(function(od) {
      mds.forEach(function(md) {
        if(!(od.o > 0) || !(md.f > 0)) return;
        var r = md.f * 60 / od.o;
        if(!(r > 0) || r > rpmTop) return;
        out.push({ rpm: r, o: od.o, firing: !!od.firing, no: md.no, f: md.f, label: md.label });
      });
    });
    return out.sort(function(a, c) { return a.rpm - c.rpm; });
  }

  // "271 d/dk (yalpalama)" — kesişimin okunur hâli.
  function crossTxt(c) {
    return b(n(c.rpm, 0) + ' d/dk') + (c.label ? ' (' + c.label + ')' : '');
  }
  // Mertebe adı. Ondalıklı olabilir (5 silindirde 2,5) ama tam sayılarda
  // gereksiz ",0" kuyruğu taşımaz.
  function ordTxt(o) { return n(o, 1).replace(',0', '') + '. mertebe'; }

  function campbellLane(ds, R, chans) {
    var meta = ds.meta || {};
    var idle = meta.idleRpm, top = meta.maxRpm, rpmTop = meta.rpmTop;
    var bandHi = isFinite(top) ? top : NaN;
    var modes = (R && R.modes) || [];
    var paras = [];

    var firingOrder = NaN;
    (meta.orders || []).forEach(function(od) { if(od.firing) firingOrder = od.o; });

    var ords = [], mds = [];
    chans.forEach(function(ch) {
      var p = parseId(ch.id);
      if(p.kind === 'order') {
        ords.push({ ch: ch, o: p.order, firing: (p.order === firingOrder) });
      } else if(p.kind === 'mode') {
        var md = modes[p.no - 1];
        mds.push({ ch: ch, no: p.no, f: (md && md.f_Hz) || ch.data[0],
                   label: md ? modeShort(md.label) : '' });
      }
    });
    ords.sort(function(a, c) { return a.o - c.o; });
    mds.sort(function(a, c) { return a.f - c.f; });

    paras.push('Yatay eksen ' + b('motor devri') + ', dikey eksen ' + b('frekans') + '. ' +
      b('Eğik') + ' çizgiler motorun ürettiği uyarmalardır — devir arttıkça frekansları ' +
      'büyür. ' + b('Yatay') + ' çizgiler güç grubunun kendi doğal frekanslarıdır; devirden ' +
      'bağımsız, sabit. İkisinin kesiştiği devirde motor o modu tam frekansından besler: ' +
      b('rezonans') + ' orada olur.');

    // ── Çalışma bandı ──
    var bandTxt = '';
    if(isFinite(idle) && isFinite(bandHi)) {
      bandTxt = 'Çalışma bandı ' + b(n(idle, 0) + ' d/dk') + ' rölanti ile ' +
                b(n(bandHi, 0) + ' d/dk') + ' arasında. ';
    } else if(isFinite(idle)) {
      bandTxt = 'Rölanti ' + b(n(idle, 0) + ' d/dk') + '; motorun en yüksek devri modelde ' +
                'tanımlı değil, bu yüzden bandın üst ucu çizilemiyor (Motor bileşenine ' +
                b('@ Devir') + ' girilirse görünür). ';
    }
    if(bandTxt) {
      bandTxt += 'Bandın ' + b('altındaki') + ' kesişimler yalnız kalkış ve durmada geçilir; ' +
                 b('içindeki') + ' kesişimler motor o devirde çalıştığı sürece devam eder.';
      paras.push(bandTxt);
    }

    // ── Şerit eksikse önce onu söyle ──
    if(!ords.length || !mds.length) {
      paras.push(ords.length
        ? 'Şeritte yalnız ' + b('mertebe çizgileri') + ' var; kesişim için en az bir ' +
          b('mod') + ' çizgisi gerekir.'
        : 'Şeritte yalnız ' + b('mod çizgileri') + ' var — devirden bağımsız yatay doğrular; ' +
          'kesişim için en az bir ' + b('mertebe') + ' çizgisi gerekir.');
      return { title: 'Campbell diyagramı', paras: paras };
    }

    // ── Kesişimler ──
    var cr = campbellCrossings(ords, mds, rpmTop);
    var inBand = [], below = [];
    cr.forEach(function(c) {
      if(isFinite(idle) && c.rpm < idle) below.push(c);
      else if(isFinite(bandHi) && c.rpm > bandHi) { /* bandın üstü — motor oraya çıkmıyor */ }
      else inBand.push(c);
    });

    var fir = cr.filter(function(c) { return c.firing; });
    if(fir.length) {
      var firIn = fir.filter(function(c) { return !(isFinite(idle) && c.rpm < idle) &&
                                                 !(isFinite(bandHi) && c.rpm > bandHi); });
      var s = 'Uyarmanın baskın bileşeni ' + b(ordTxt(firingOrder)) +
              ' (ateşleme). Modları şu devirlerde kesiyor: ' +
              fir.slice(0, 6).map(crossTxt).join(', ') + '. ';
      if(!firIn.length) {
        s += 'Hiçbiri çalışma bandının içinde değil; bu rezonanslar yalnız kalkış ve ' +
             'durmada geçiliyor.';
      } else {
        s += b(firIn.length + ' tanesi') + ' çalışma bandının içinde (' +
             firIn.map(function(c) { return b(n(c.rpm, 0) + ' d/dk'); }).join(', ') +
             '); ilgili mod o devirde sürekli besleniyor.';
      }
      paras.push(s);
    } else if(inBand.length) {
      paras.push('Çalışma bandının içinde ' + b(inBand.length + ' kesişim') + ' var: ' +
        inBand.slice(0, 6).map(crossTxt).join(', ') + '.');
    } else if(below.length) {
      paras.push('Çizili mertebelerin tüm kesişimleri (' + b(below.length + ' adet') +
        ') rölantinin altında kalıyor: ' + below.slice(0, 4).map(crossTxt).join(', ') +
        (below.length > 4 ? ' …' : '') + '. Çalışma bandında doğrudan uyarma yok.');
    }

    // Ateşleme temiz çıksa bile iş bitmez: krank balanssızlığı (1. mertebe) ve
    // ateşlemenin harmonikleri kendi kesişimlerini yapar. Bunları söylememek,
    // "bandın içinde rezonans yok" izlenimi bırakırdı — yanlış olurdu.
    var other = inBand.filter(function(c) { return !c.firing; });
    if(fir.length && other.length) {
      paras.push('Bandın içinde ateşleme dışı ' + b(other.length + ' kesişim') + ' daha var: ' +
        other.slice(0, 5).map(function(c) {
          return b(n(c.rpm, 0) + ' d/dk') + ' (' + ordTxt(c.o) +
                 (c.label ? ' × ' + c.label : '') + ')';
        }).join(', ') + (other.length > 5 ? ' …' : '') + '. Kaynakları ateşlemeden zayıftır ' +
        '(' + b('1. mertebe') + ' krank/volan balanssızlığı, üst mertebeler ateşleme ' +
        'harmonikleri) ama band içinde sürekli etkindir.');
    }

    // ── Asıl ölçüt: rölantide izolasyon var mı? ──
    var eng = engineFiring(R);
    var fMax = 0;
    mds.forEach(function(m2) { if(m2.f > fMax) fMax = m2.f; });
    if(eng && fMax > 0) {
      var ratio = eng.f / fMax;
      paras.push('Rölanti ölçütü: ateşleme frekansı ' + b(na(eng.f) + ' Hz') +
        ', en yüksek mod ' + b(na(fMax) + ' Hz') + ', oran ' + b(na(ratio)) +
        '. İzolasyon koşulu oran > ' + b('√2 ≈ 1,41') + '; model bunu ' +
        (ratio > ISO_RATIO ? b('sağlıyor') : b('sağlamıyor')) +
        (ratio > ISO_RATIO ? '.' : ' — en yüksek mod rölantide büyütme bölgesinde.'));
    }

    var title = 'Campbell diyagramı';
    if(ords.length === 1 && mds.length) title += ' — ' + n(ords[0].o, 1).replace(',0', '') + '. mertebe';
    else if(ords.length && mds.length === 1) title += ' — mod ' + mds[0].no;
    else if(chans.length === ds.channels.length) title += ' — birleşik (' + chans.length + ' kanal)';
    return { title: title, paras: paras };
  }

  // ═══════════ 5) ŞOK / GEÇİCİ REJİM — şerit yorumu ═══════════
  //
  // Buradaki asıl bilgi TEPE DEĞERLER ve SÖNÜM SÜRESİDİR: darbede ne kadar
  // ezildi, ne kadar kuvvet geçti, salınım ne zaman bitti. Frekans yanıtı bu
  // üçünü de söyleyemez.

  // Serinin tepe genliğinin %5'ine kalıcı olarak indiği an — "salınım ne kadar
  // sürdü" sorusunun sayısal karşılığı. Sağdan taranır ki geçici bir dip
  // erken bitiş gibi okunmasın.
  function settleTime(t, y, frac) {
    if(!t || !y || t.length !== y.length) return NaN;
    var pk = 0, i;
    for(i = 0; i < y.length; i++) { var a = Math.abs(y[i]); if(a > pk) pk = a; }
    if(!(pk > 0)) return NaN;
    var lim = pk * (frac == null ? 0.05 : frac);
    for(i = y.length - 1; i >= 0; i--) {
      if(Math.abs(y[i]) > lim) return t[i];
    }
    return t[0];
  }

  function minMax(y) {
    var mn = Infinity, mx = -Infinity;
    (y || []).forEach(function(v) {
      if(!isFinite(v)) return;
      if(v < mn) mn = v;
      if(v > mx) mx = v;
    });
    return isFinite(mn) ? { min: mn, max: mx } : null;
  }

  // Metal-metal durdurucu boşluğu (js/mount-signals.js FD_LIM_MM ile aynı).
  // Şok çözümü LİNEERDİR: durdurucu devrede değildir. Genlik bu değeri aşarsa
  // çözüm oradan sonra geçersizdir ve bunu SÖYLEMEK zorundayız — sessizce
  // geçmek, gerçekte çelikten geçen bir yükü kauçuktan geçiyormuş gibi
  // raporlamak olurdu.
  var STOP_MM = 15;
  var SHOCK_KEYS = ['shockz', 'shocky', 'shockx'];

  function shockLane(ds, R, chans) {
    var t = ds.x.data, meta = ds.meta || {}, paras = [];
    var yon = (meta.ax || '').toLowerCase();

    var acc = null, cg = [], defl = [], forc = [], dmax = null;
    chans.forEach(function(ch) {
      var p = parseId(ch.id);
      if(ch.id === 'aIn') acc = ch;
      else if(/^q[012]$/.test(ch.id)) cg.push({ ch: ch, c: +ch.id.charAt(1) });
      else if(p.kind === 'mount' && p.part === 'd') defl.push(ch);
      else if(p.kind === 'mount' && p.part === 'f') forc.push(ch);
      else if(ch.id === 'dmax') dmax = ch;
    });

    // Giriş TEK CÜMLE: aynı panoda üç şerit açıldığında bu paragraf üç kez
    // tekrarlanıyor. Uzun bir tanım üçe katlanınca yorum penceresi asıl
    // bilgiyi (tepe değerler, sönme süresi) aşağı itiyordu.
    paras.push('Yatay eksen ' + b('zaman') + '; güç grubuna ' + b(yon) + ' yönde ' +
      b(nz(meta.aPeak) + ' g') + ' tepeli ' + b(nz(meta.dur * 1000, 1) + ' ms') +
      '\'lik ' + b('yarım sinüs darbe') + ' uygulanıyor. Darbe sonrası, sistemin kendi ' +
      'doğal frekanslarıyla sönümlü serbest salınımıdır.');

    // ── Ağırlık merkezi yer değiştirmesi ──
    if(cg.length) {
      var parts = cg.sort(function(a, c) { return a.c - c.c; }).map(function(e) {
        var mm2 = minMax(e.ch.data);
        return mm2 ? b(AX_TR[e.c]) + ' ' + b(na(mm2.min) + ' … ' + na(mm2.max) + ' mm') : null;
      }).filter(Boolean);
      if(parts.length) {
        paras.push('Ağırlık merkezinin şasiye göre yer değiştirme aralığı: ' +
          parts.join(', ') + '. Tedarikçi raporlarındaki "shock response" referans nokta ' +
          'yer değiştirmesi bu büyüklüktür.');
      }
    }

    // ── Takoz çökmesi ve durdurucu kontrolü ──
    var dSrc = dmax ? [dmax] : defl;
    if(dSrc.length) {
      var worst = 0, worstName = '';
      dSrc.forEach(function(ch) {
        var mm3 = minMax(ch.data);
        if(mm3 && mm3.max > worst) { worst = mm3.max; worstName = chanMount(ch); }
      });
      if(worst > 0) {
        var s = (dmax ? 'Darbe boyunca en çok yüklenen takoz ' : b(worstName) + ' takozu ') +
          b(na(worst) + ' mm') + ' eziliyor';
        if(worst >= STOP_MM) {
          s += ' — ' + b('metal-metal durdurucu boşluğunu (±' + STOP_MM + ' mm) aşıyor') +
               '. Şok çözümü lineerdir, durdurucu modelde yoktur: bu genlikten sonrası ' +
               b('geçerli değildir') + '.';
        } else {
          s += '; ' + b('±' + STOP_MM + ' mm') + ' durdurucu sınırına ' +
               b(na(STOP_MM - worst) + ' mm') + ' pay kalıyor.';
        }
        paras.push(s);
      }
    }

    // ── Takoz kuvvetleri ──
    if(forc.length) {
      var fRows = forc.map(function(ch) {
        var mm4 = minMax(ch.data);
        return mm4 ? { name: chanMount(ch), v: mm4.max } : null;
      }).filter(Boolean).sort(function(a, c) { return c.v - a.v; });
      if(fRows.length) {
        var sf = (fRows.length === 1 ? b(fRows[0].name) + ' takozuna' :
                  'En çok zorlanan takoza (' + b(fRows[0].name) + ')') +
          ' darbede ' + b(na(fRows[0].v / 1000) + ' kN') + ' tepe kuvvet biniyor';
        var fc = capOf(R, fRows[0].name);
        if(isFinite(fc)) {
          sf += ' — katalog kapasitesinin (' + b(na(fc / 1000) + ' kN') + ') ' +
                b(pct(fRows[0].v / fc * 100, 0)) + ' kadarı';
        }
        paras.push(sf + '. Ömür hesabının dinamik yük girdisi budur.');
      }
    }

    // ── Sönüm süresi ──
    var sRef = dmax || (defl.length ? defl[0] : (cg.length ? cg[0].ch : null));
    if(sRef) {
      var ts = settleTime(t, sRef.data, 0.05);
      if(isFinite(ts) && ts > meta.dur) {
        paras.push('Salınım tepe genliğinin ' + b('%5') + '\'ine ' + b(na(ts * 1000) + ' ms') +
          '\'de iniyor; darbe süresi ' + b(nz(meta.dur * 1000, 1) + ' ms') + ', oran ' +
          b(na(ts / meta.dur) + '×') + '. Sönme süresi yalnız ' + b('sönüme') + ' bağlıdır (ζ' +
          (isFinite(R.zeta) ? ' = ' + b(pct(R.zeta * 100, 1)) : '') + ').');
      }
    }

    if(acc && chans.length === 1) {
      paras.push('Şeritte yalnız ' + b('uygulanan darbe') + ' var — sistemin yanıtı değil, ' +
        'girdinin kendisi.');
    }

    return { title: (ds.name || 'Şok yanıtı') +
             (chans.length === ds.channels.length ? ' — birleşik (' + chans.length + ' kanal)' : ''),
             paras: paras };
  }

  // ── Şerit yorumu: giriş noktası ──────────────────────────────────────────
  //
  // ids = O ŞERİTTE çizili kanal kimlikleri. Aynı şeritte hangi kanalların
  // birlikte durduğu yorumu değiştirir; bu yüzden yorum çözüm anında değil,
  // ÇİZİM anında üretilir.
  function forLane(ds, R, ids) {
    if(!ds || !R || R.error || !ids || !ids.length) return null;
    try {
      var chans = ids.map(function(id) { return chan(ds, id); }).filter(Boolean);
      if(!chans.length) return null;
      if(ds.key === 'frf')      return frfLane(ds, R, chans);
      if(ds.key === 'campbell') return campbellLane(ds, R, chans);
      if(ds.key === 'fdefl')    return fdeflLane(ds, R, chans);
      if(SHOCK_KEYS.indexOf(ds.key) >= 0) return shockLane(ds, R, chans);
      return sweepLane(ds, R, chans);
    } catch(e) { return null; }
  }

  // ── Veri kümesi düzeyi: grafik üstü işaretler + tek satır özet ───────────
  // Şerit yorumu değişkendir, işaretler değil: mod frekansları ve sınırlar
  // hangi kanalın çizildiğinden bağımsızdır.
  function datasetMarks(ds, R) {
    var marks = [];
    if(ds.key === 'frf') {
      ((R.modes) || []).forEach(function(m) {
        if(!(m.f_Hz > 1e-6)) return;
        marks.push({ axis: 'x', value: m.f_Hz, kind: 'mode',
                     label: na(m.f_Hz) + ' Hz · ' + modeShort(m.label) });
      });
      var T = chan(ds, 'T_2');
      if(T) {
        var cross = lastCrossBelow(ds.x.data, T.data, 1);
        if(isFinite(cross)) marks.push({ axis: 'x', value: cross, kind: 'ref',
          label: 'izolasyon başlangıcı ' + na(cross) + ' Hz' });
      }
      var eng = engineFiring(R);
      if(eng) marks.push({ axis: 'x', value: eng.f, kind: 'event',
        label: 'rölanti ateşleme ' + na(eng.f) + ' Hz' });
      marks.push({ axis: 'y', value: 1, unit: '−', kind: 'limit',
                   label: 'T = 1 · altı izolasyon, üstü büyütme' });
    } else if(ds.key === 'campbell') {
      var mt = ds.meta || {};
      if(isFinite(mt.idleRpm)) marks.push({ axis: 'x', value: mt.idleRpm, kind: 'event',
        label: 'rölanti ' + n(mt.idleRpm, 0) + ' d/dk' });
      if(isFinite(mt.maxRpm)) marks.push({ axis: 'x', value: mt.maxRpm, kind: 'limit',
        label: 'en yüksek devir ' + n(mt.maxRpm, 0) + ' d/dk' });
      // Uyarı çizgileri YALNIZ fiziksel olarak baskın iki uyarma için: ateşleme
      // (z/2) ve krank/volan balanssızlığı (1. mertebe). Dört mertebe × altı
      // mod = 24 kesişim; hepsini çizmek diyagramı okunmaz yapardı. Yüksek
      // harmonikler zaten ateşlemeden zayıftır — yorumda sayılır, çizilmez.
      var fo = NaN;
      (mt.orders || []).forEach(function(od) { if(od.firing) fo = od.o; });
      var key = [1];
      if(isFinite(fo) && fo > 0 && key.indexOf(fo) < 0) key.push(fo);
      key.forEach(function(o) {
        ((R.modes) || []).forEach(function(m2) {
          if(!(m2 && m2.f_Hz > 1e-6)) return;
          var r = m2.f_Hz * 60 / o;
          if(!(r > 0) || r > mt.rpmTop) return;
          if(isFinite(mt.idleRpm) && r < mt.idleRpm) return;      // bandın altı
          if(isFinite(mt.maxRpm) && r > mt.maxRpm) return;        // bandın üstü
          marks.push({ axis: 'x', value: r, kind: 'warn',
            label: 'rezonans ' + n(r, 0) + ' d/dk · ' + ordTxt(o) + ' × ' + modeShort(m2.label) });
        });
      });
    } else if(ds.key === 'fdefl') {
      var stat = staticCase(R), mounts = (R.mounts) || [];
      // Taşıma kapasitesi çizgisi (opsiyonel katalog verisi, mnt.fCap [N]).
      // Takozlar farklı tipte olabilir → farklı kapasite. Tek bir çizgi çizmek
      // yanlış olurdu; AYRI DEĞERLER ayrı çizgi alır. Üçten fazla ayrı değerde
      // grafiği doldurmamak için yalnız EN DÜŞÜĞÜ çizilir — sınırı ilk zorlayan
      // odur, kritik olan da odur.
      var caps = [];
      mounts.forEach(function(mt) {
        if(!(mt && mt.fCap > 0)) return;
        if(caps.indexOf(mt.fCap) < 0) caps.push(mt.fCap);
      });
      caps.sort(function(a, c) { return a - c; });
      (caps.length > 3 ? [caps[0]] : caps).forEach(function(fc) {
        var who = mounts.filter(function(mt) { return mt && mt.fCap === fc; });
        var tag = (caps.length === 1) ? '' :
                  (caps.length > 3 ? ' (en düşük)' :
                   (who.length === 1 ? ' · ' + mountLabel(who[0], mounts.indexOf(who[0])) : ''));
        // Basma tarafı NEGATİF (çekirdek işaret sözleşmesi): kapasite çizgisi
        // eğrinin ezilme kolunda durmalı, yansımasında değil.
        marks.push({ axis: 'y', value: -fc, unit: 'N', kind: 'limit',
                     label: 'taşıma kapasitesi ' + na(fc / 1000) + ' kN' + tag });
      });
      // ── Takoz başına statik çalışma noktası ──
      //
      // Eskiden tek bir DİKEY ÇİZGİ vardı: en çok ezilen takozun δ'sı. İki şeyi
      // birden kaybediyordu — öteki beş takozun nerede çalıştığını ve her
      // birinin o noktada TAŞIDIĞI KUVVETİ. Tedarikçi raporları bunu nokta
      // olarak basar, çünkü çalışma noktası (δ, F) çiftidir.
      //
      // Nokta, ait olduğu kanalın kimliğini taşır (chanId): şeritte o takozun
      // eğrisi yoksa nokta da çizilmez. Başka bir takozun eğrisi üstünde duran
      // bir çalışma noktası, o takozun sanki oradaymış gibi okunurdu.
      //
      // Yalnız Z (düşey): statik durumda yükü taşıyan eksen odur, x/y bileşenler
      // simetrik modelde sıfıra yakındır ve altı nokta daha eklemek grafiği
      // doldurmaktan başka bir şey yapmazdı.
      if(stat && stat.perMount) {
        stat.perMount.forEach(function(pm, i) {
          var mnt = mounts[i];
          if(!mnt || !pm) return;
          var dz = ((pm.delta || [])[2] || 0) * 1000, fz = (pm.f || [])[2];
          if(!isFinite(dz) || !isFinite(fz)) return;
          var label = mountLabel(mnt, i);
          var id = zChanId(ds, label);
          if(!id) return;
          marks.push({ axis: 'point', value: dz, y: fz, unit: 'N', kind: 'event',
                       chanId: id,
                       label: label + ' · ' + na(dz) + ' mm · ' + na(fz / 1000) + ' kN' });
        });
      }
      marks.push({ axis: 'x', value: -10, kind: 'limit', label: 'doğrusal bant −10 mm' });
      marks.push({ axis: 'x', value:  10, kind: 'limit', label: 'doğrusal bant +10 mm' });
      marks.push({ axis: 'x', value: -15, kind: 'stop',  label: 'durdurucu −15 mm' });
      marks.push({ axis: 'x', value:  15, kind: 'stop',  label: 'durdurucu +15 mm' });
    } else if(SHOCK_KEYS.indexOf(ds.key) >= 0) {
      var mt2 = ds.meta || {};
      if(mt2.dur > 0) {
        marks.push({ axis: 'x', value: mt2.dur, kind: 'event',
                     label: 'darbe biter ' + na(mt2.dur * 1000) + ' ms' });
      }
      // Durdurucu sınırı mm şeridinde: lineer çözümün NEREDE geçersizleştiği
      // grafiğin üstünde görünsün.
      marks.push({ axis: 'y', value: STOP_MM, unit: 'mm', kind: 'stop',
                   label: 'durdurucu ' + STOP_MM + ' mm — üstü lineer çözümün dışı' });
      var dm = chan(ds, 'dmax');
      if(dm) {
        var ts2 = settleTime(ds.x.data, dm.data, 0.05);
        if(isFinite(ts2) && ts2 > mt2.dur) {
          marks.push({ axis: 'x', value: ts2, kind: 'ref',
                       label: 'salınım %5\'e iner ' + na(ts2 * 1000) + ' ms' });
        }
      }
    } else {
      var t = GS_TEXT[ds.key];
      if(t) {
        marks.push({ axis: 'x', value: t.tasarim, kind: 'event',
                     label: 'tasarım yükü ' + n(t.tasarim, 1).replace(',0', '') + ' g' });
        if(ds.key === 'gz') marks.push({ axis: 'x', value: 1, kind: 'ref', label: 'araç dururken 1 g' });
        var a = ds.x.data, nt = chan(ds, 'ntens'), nc = chan(ds, 'nclamp');
        var aT = nt ? firstNonZero(a, nt.data) : NaN;
        var aC = nc ? firstNonZero(a, nc.data) : NaN;
        if(isFinite(aT)) marks.push({ axis: 'x', value: aT, kind: 'warn', label: 'ilk çekme ' + na(aT) + ' g' });
        if(isFinite(aC)) marks.push({ axis: 'x', value: aC, kind: 'warn', label: 'durdurucu teması ' + na(aC) + ' g' });
      }
    }
    return marks;
  }

  // Pano kapalıyken görünen tek satır: çizilen BÜYÜKLÜĞÜN adı ve ekseni.
  // Kullanım anlatmaz, sonuç yorumlamaz — o iş şerit yorumunun.
  var LEADS = {
    frf:    'Frekansa göre iletilebilirlik: şasiye geçen kuvvetin motor kuvvetine oranı.',
    campbell: 'Motor uyarma mertebeleri ile güç grubu doğal frekanslarının devir düzlemindeki kesişimi.',
    fdefl:  'Takoz kuvvet–sehim yasası ve statik çalışma noktaları.',
    gz:     'Düşey ivme süpürmesi: takoz çökmesi ve kuvveti.',
    gy:     'Yanal ivme süpürmesi: takoz çökmesi ve kuvveti.',
    gx:     'Boyuna ivme süpürmesi: takoz çökmesi ve kuvveti.',
    shockz: 'Düşey yarım-sinüs darbeye geçici rejim yanıtı.',
    shocky: 'Yanal yarım-sinüs darbeye geçici rejim yanıtı.',
    shockx: 'Boyuna yarım-sinüs darbeye geçici rejim yanıtı.'
  };

  function build(ds, R) {
    if(!ds || !R || R.error || !LEADS[ds.key]) return null;
    try {
      return { lead: LEADS[ds.key], marks: datasetMarks(ds, R) };
    } catch(e) { return null; }
  }

  return {
    build: build,
    forLane: forLane,
    modeTR: modeTR,
    modeShort: modeShort,
    interpAt: interpAt,
    peaks: peaks,
    lastCrossBelow: lastCrossBelow,
    firstNonZero: firstNonZero,
    engineFiring: engineFiring,
    slopeAt0: slopeAt0,
    parseId: parseId,
    campbellCrossings: campbellCrossings,
    settleTime: settleTime,
    ISO_RATIO: ISO_RATIO,
    STOP_MM: STOP_MM
  };
})();

if(typeof module !== 'undefined' && module.exports){ module.exports = veMntBrief; }
