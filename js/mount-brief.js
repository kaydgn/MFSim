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
    gz: { yon: 'düşey', baslik: 'Düşey ivme süpürmesi', olay: 'araç çukura girip zıpladığında',
          sifir: '0 g\'de hiç yük yok, 1 g aracın düz zeminde durduğu hâl',
          tasarim: 3.5, tasarimAd: '3,5 g\'lik sert çukur darbesi' },
    gy: { yon: 'yanal', baslik: 'Yanal ivme süpürmesi', olay: 'araç virajda savrulduğunda',
          sifir: '0 g aracın düz gittiği hâl, düşey yük 1 g\'de sabit',
          tasarim: 1, tasarimAd: '1 g\'lik viraj' },
    gx: { yon: 'boyuna', baslik: 'Boyuna ivme süpürmesi', olay: 'sert frende veya hızlanmada',
          sifir: '0 g sabit hızda gidiş, düşey yük 1 g\'de sabit',
          tasarim: 1, tasarimAd: '1 g\'lik fren' }
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
    var m = /^(T0|T|eta)_([012])$/.exec(id);
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

    var damped = [], undamped = [], effs = [];
    chans.forEach(function(ch) {
      var p = parseId(ch.id);
      if(p.kind === 'T') damped.push({ ch: ch, dir: p.dir });
      else if(p.kind === 'T0') undamped.push({ ch: ch, dir: p.dir });
      else if(p.kind === 'eta') effs.push({ ch: ch, dir: p.dir });
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
        'Bu şeritte kümenin ' + b(chans.length + ' kanalı') + ' üst üste: üç yönün ' +
        'sönümlü ve sönümsüz iletilebilirliği ile izolasyon verimi. Toplu bakış için ' +
        'iyi, okuma için zor — çünkü birimler farklı (iletilebilirlik birimsiz, verim ' +
        b('%') + ') ve ölçekler bir arada durmuyor.');
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
      s += 'Verim kanalı rezonansta ' + b('eksi') + ' değerlere iner (titreşim azalmıyor, katlanıyor), ' +
           'bu yüzden dikey eksen iki tarafa birden gerilir.';
      paras.push(s);
      paras.push(
        'Okumak için: "Birime Göre Birleştir" ile kanalları birimlerine ayırın ya da ' +
        'yalnız sönümlü üç yönü bırakın. Sayıları imleçle okumak isterseniz tek yön ' +
        'tek şerit en nettir.');
      return { title: title, paras: paras };
    }

    // ── Yalnız sönümlü iletilebilirlik ──
    if(damped.length && !undamped.length && !effs.length) {
      if(damped.length === 1) {
        var e = damped[0];
        paras.push('Bu şeritte ' + b(AX_TR[e.dir]) + ' yönde iletilebilirlik var: motorun o ' +
                   'yöndeki titreşiminin ne kadarının şasiye geçtiği. ' + b('1') +
                   ' değeri "hiç azalmadan geçti" demek.');
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
            ' ve orada iletilebilirlik ' + b(na(Tf2)) + '; hedef ' + b('0,2') + '\'nin altı, ' +
            (Tf2 < 0.2 ? 'model ' + b('sağlıyor') + '.' : 'model ' + b('sağlamıyor') + '.');
        }
        if(s3) paras.push(s3);
      } else {
        paras.push('Bu şeritte ' + b(damped.length + ' yönün') + ' iletilebilirliği üst üste. ' +
                   'Aynı eksende okundukları için hangi yönün daha kötü izole edildiği ' +
                   'doğrudan görünür.');
        damped.sort(function(a, c) { return a.dir - c.dir; }).forEach(function(e) {
          paras.push(line(e));
        });
      }
      return { title: title, paras: paras };
    }

    // ── Sönümlü + sönümsüz karşılaştırması ──
    if(damped.length && undamped.length) {
      paras.push('Bu şeritte sönümlü ve sönümsüz iletilebilirlik birlikte. Sönümsüz eğri, ' +
                 'kauçuğun titreşimi ısıya çevirme payı çıkarılmış hâldir; aradaki fark ' +
                 'sönümün katkısıdır.');
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
      paras.push('Dikkat: sönümsüz tepe çok daha yüksek olduğu için ortak eksende sönümlü ' +
                 'eğri düz görünür. Karşılaştırmayı sayıyla yapın, gözle değil.');
      return { title: 'Frekans yanıtı — sönüm karşılaştırması', paras: paras };
    }

    // ── Yalnız izolasyon verimi ──
    if(effs.length && !damped.length && !undamped.length) {
      paras.push('İzolasyon verimi, iletilebilirliğin yüzde cinsinden hâli: ' + b('%100') +
                 ' "titreşimin tamamı takozda kaldı", ' + b('%0') + ' "hiç azalmadan geçti" demek.');
      effs.forEach(function(e) {
        var y = e.ch.data, last = y[y.length - 1];
        var mn = Infinity, mnf = NaN;
        y.forEach(function(v, i) { if(isFinite(v) && v < mn) { mn = v; mnf = f[i]; } });
        paras.push(b(AX_TR[e.dir]) + ': ' + b(na(f[f.length - 1]) + ' Hz') + '\'de verim ' +
                   b(pct(last, 1)) + '; en kötü nokta ' + b(na(mnf) + ' Hz') + '\'de ' +
                   b(pct(mn, 0)) + '.');
      });
      paras.push('Eksi değer bir hata değil: rezonansta titreşim azalmaz, katlanır. ' +
                 'Bu yüzden bu kanalı iletilebilirlikle aynı şeride koymayın — ölçek çok açılır.');
      return { title: 'Frekans yanıtı — izolasyon verimi', paras: paras };
    }

    // ── Karışık ──
    paras.push('Bu şeritte ' + b(chans.length + ' kanal') + ' birlikte çiziliyor.');
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

    paras.push('Yatay eksen takozun ezilme miktarı (' + b('mm') + '), dikey eksen bunun için ' +
               'gereken kuvvet. Eğrinin eğimi = takozun sertliği; dik eğri sert, yatık eğri ' +
               'yumuşak takoz demek.');

    var title = 'Kuvvet-deformasyon';
    if(nM === 1 && nA > 1) {
      // Tek takoz, birden çok eksen → yön farkı (anizotropi)
      var mn = Object.keys(uniqMounts)[0];
      title += ' — ' + mn;
      var byAx = items.slice().sort(function(a, c) { return a.ax - c.ax; });
      paras.push('Bu şeritte ' + b(mn) + ' takozunun ' + b(byAx.length + ' ekseni') + ' var: ' +
        byAx.map(function(it) { return AX_TR[it.ax] + ' ' + b(na(it.k) + ' N/mm'); }).join(', ') + '.');
      var ks = byAx.map(function(it) { return it.k; }).filter(isFinite);
      if(ks.length > 1) {
        var mx = Math.max.apply(null, ks), mnk = Math.min.apply(null, ks);
        if(mnk > 0) paras.push('En sert eksen en yumuşağın ' + b(na(mx / mnk) + ' katı') +
          '. Takozun yön yön farklı sertlikte olması tasarımın kendisidir: titreşimi ' +
          'yumuşak eksende yutar, yükü sert eksende taşır.');
      }
    } else if(nA === 1 && nM > 1) {
      // Aynı eksen, birden çok takoz → yük paylaşımı
      var axi = +Object.keys(uniqAx)[0];
      title += ' — ' + AX_TR[axi] + ' eksen';
      paras.push('Bu şeritte ' + b(nM + ' takozun') + ' ' + b(AX_TR[axi]) + ' eksen eğrisi var. ' +
        'Eğriler üst üste düşüyorsa takozlar aynı, ayrışıyorsa farklı sertlikte demektir.');
      var srt = items.slice().sort(function(a, c) { return c.k - a.k; });
      paras.push('En sert: ' + b(srt[0].mount) + ' ' + b(na(srt[0].k) + ' N/mm') +
        ' · en yumuşak: ' + b(srt[srt.length - 1].mount) + ' ' + b(na(srt[srt.length - 1].k) + ' N/mm') + '.');
    } else if(items.length === 1) {
      var it = items[0];
      title += ' — ' + it.mount + ' · ' + AX_TR[it.ax];
      paras.push('Bu şerit ' + b(it.mount) + ' takozunun ' + b(AX_TR[it.ax]) + ' eksen yasası. ' +
        'Sertlik ' + b(na(it.k) + ' N/mm') + '; eğri ' +
        (it.nl ? b('nonlineer') + ' — yük arttıkça sertleşiyor.' : b('doğrusal') + ' — her yükte aynı sertlikte.'));
      var wp = workPoint(it.mount);
      if(it.ax === 2 && isFinite(wp)) {
        paras.push('Araç kendi ağırlığındayken bu takoz ' + b(na(wp) + ' mm') + ' eziliyor: ' +
          'doğrusal bandın (' + b('±10 mm') + ') ' + b(pct(wp / 10 * 100, 0)) + ' kadarı, metal metale ' +
          'değmeye ' + b(na(15 - wp) + ' mm') + ' pay var.');
      }
    } else {
      title += ' — ' + items.length + ' kanal';
      var kk = items.map(function(i2) { return i2.k; }).filter(isFinite);
      if(kk.length) paras.push('Bu şeritte ' + b(items.length + ' eğri') + ' var; sertlikler ' +
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
        ? b('Kapasite aşılıyor') + ' — bu takoz statik yükü tek başına taşıyamaz, daha büyük ' +
          'bir tip ya da daha fazla takoz gerekir.'
        : (top.u.pct > 50
            ? 'Tedarikçi raporlarında tipik tasarım hedefi ' + b('%25–50') + ' bandıdır; bu değer ' +
              'bandın üstünde — statik yük yüksek, dinamik darbelerde pay az kalıyor.'
            : (top.u.pct < 15
                ? 'Tipik tasarım hedefi ' + b('%25–50') + '; bu değer bandın altında — takoz ' +
                  'gereğinden büyük seçilmiş olabilir, gereksiz sertlik izolasyonu kötüleştirir.'
                : 'Tedarikçi raporlarının tipik tasarım hedefi olan ' + b('%25–50') + ' bandının ' +
                  'içinde — ' + b('aranan sonuç budur') + '.'));
      paras.push(s2);
    }

    var anyNL = items.some(function(i2) { return i2.nl; });
    paras.push(anyNL
      ? 'Yukarı kıvrılan eğri, büyük darbede dibe vurmayı geciktirir. ' + b('±15 mm') +
        ' metal metale değme sınırıdır.'
      : 'Doğrusal eğri, modelde takoz için sabit bir oran girildiği anlamına gelir. ' +
        'Kütüphaneden eğri tanımlanırsa büyük ezilmedeki sertleşme de burada görünür.');
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
    paras.push('Yatay eksen ' + b(t.yon + ' ivme') + ': ' + t.olay + ' takozlara binen yük. ' +
               t.sifir + '.');

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
        paras.push('Bu şeritte ' + b(srt.length + ' takozun') + ' çökmesi karşılaştırılıyor. ' +
          b(t.tasarimAd) + ' altında en çok yüklenen ' + b(srt[0].name) + ' (' +
          b(na(srt[0].v) + ' mm') + '), en az yüklenen ' + b(srt[srt.length - 1].name) + ' (' +
          b(na(srt[srt.length - 1].v) + ' mm') + '). Aradaki fark ' +
          b(na(srt[0].v - srt[srt.length - 1].v) + ' mm') + ' — yük dağılımının ne kadar ' +
          'dengesiz olduğunu bu gösterir.');
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
      var s = '"En büyük takoz çökmesi" kanalı her ivmede en kötü takozu izler. ' +
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
    if(isFinite(aT)) ev.push('İlk çekme ' + b(na(aT) + ' g') + '\'de: bir takozun üzerinden yük ' +
      'tamamen kalkıp asılmaya geçiyor.');
    if(isFinite(aC)) ev.push('İlk metal-metal temas ' + b(na(aC) + ' g') + '\'de: yük artık ' +
      'kauçuktan değil çelikten geçiyor, eğrideki keskin kırılma orada.');
    paras.push(ev.length ? ev.join(' ')
      : 'Süpürmenin tamamında hiçbir takoz dayanağına oturmuyor, hiçbirinin üzerinden yük ' +
        'kalkmıyor — ' + b('aranan sonuç budur') + '.');

    if(counters.length) {
      paras.push('Sayaç kanalları ' + b('adet') + ' gösterir, mm değil: kaç takozun çekmeye ' +
        'geçtiğini / dayanağa oturduğunu sayar. Basamaklı görünmeleri normaldir.');
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
      bandTxt += 'Bandın ' + b('altına') + ' düşen kesişimler yalnız kalkış ve durma ' +
                 'sırasında bir anda geçilir — tehlikeleri geçici, süresi kısadır. Bandın ' +
                 b('içine') + ' düşen kesişimler ise motor o devirde ÇALIŞIRKEN sürer.';
      paras.push(bandTxt);
    }

    // ── Şerit eksikse önce onu söyle ──
    if(!ords.length || !mds.length) {
      paras.push(ords.length
        ? 'Bu şeritte yalnız ' + b('mertebe çizgileri') + ' var. Kesişimi görebilmek için ' +
          'ağaçtan en az bir ' + b('mod') + ' çizgisini de aynı şeride ekleyin — tek başına ' +
          'eğik çizgi "motor bu devirde şu frekansı üretir" der, "bu kötü mü" demez.'
        : 'Bu şeritte yalnız ' + b('mod çizgileri') + ' var: güç grubunun doğal frekansları, ' +
          'devirden bağımsız yatay doğrular. Hangi devirde uyarıldıklarını görmek için ' +
          'ağaçtan bir ' + b('mertebe') + ' çizgisi ekleyin.');
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
        s += 'Hiçbiri çalışma bandının içinde değil — ' + b('aranan sonuç budur') + ': motor ' +
             'bu rezonansların üstünden yalnız kalkarken ve dururken geçer.';
      } else {
        s += b(firIn.length + ' tanesi') + ' çalışma bandının içinde (' +
             firIn.map(function(c) { return b(n(c.rpm, 0) + ' d/dk'); }).join(', ') +
             '); motor o devirde çalışırken ilgili modu sürekli besler. ' +
             'Takoz sertliğini düşürmek mod frekansını aşağı çeker ve kesişimi bandın ' +
             'altına iter.';
      }
      paras.push(s);
    } else if(inBand.length) {
      paras.push('Çalışma bandının içinde ' + b(inBand.length + ' kesişim') + ' var: ' +
        inBand.slice(0, 6).map(crossTxt).join(', ') + '.');
    } else if(below.length) {
      paras.push('Çizili mertebelerin tüm kesişimleri (' + b(below.length + ' adet') +
        ') rölantinin altında kalıyor: ' + below.slice(0, 4).map(crossTxt).join(', ') +
        (below.length > 4 ? ' …' : '') + '. Motor çalışırken bu modların hiçbiri ' +
        'doğrudan uyarılmıyor.');
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
        }).join(', ') + (other.length > 5 ? ' …' : '') + '. Bunlar ateşlemeden zayıf ' +
        'uyarmalardır — ' + b('1. mertebe') + ' krank/volan balanssızlığı, yüksek mertebeler ' +
        'ateşlemenin harmonikleri — ama bandın içinde oldukları için motor o devirde ' +
        'çalıştığı sürece devam eder.');
    }

    // ── Asıl ölçüt: rölantide izolasyon var mı? ──
    var eng = engineFiring(R);
    var fMax = 0;
    mds.forEach(function(m2) { if(m2.f > fMax) fMax = m2.f; });
    if(eng && fMax > 0) {
      var ratio = eng.f / fMax;
      paras.push('Tasarımın asıl ölçütü rölantidir: rölantide ateşleme frekansı ' +
        b(na(eng.f) + ' Hz') + ', bu şeritteki en yüksek mod ' + b(na(fMax) + ' Hz') +
        ' — oran ' + b(na(ratio)) + '. İzolasyonun başlaması için oranın ' +
        b('√2 ≈ 1,41') + ' üstünde olması gerekir; ' +
        (ratio > ISO_RATIO
          ? 'model bunu ' + b('sağlıyor') + ': rölantide bile takozlar titreşimi azaltıyor.'
          : 'model bunu ' + b('sağlamıyor') + ' — rölantide en yüksek mod hâlâ büyütme ' +
            'bölgesinde, yani takoz titreşimi azaltmak yerine katlıyor. Çare ya daha ' +
            'yumuşak takoz (mod frekansı düşer) ya da daha yüksek rölanti devri.'));
    }

    var title = 'Campbell diyagramı';
    if(ords.length === 1 && mds.length) title += ' — ' + n(ords[0].o, 1).replace(',0', '') + '. mertebe';
    else if(ords.length && mds.length === 1) title += ' — mod ' + mds[0].no;
    else if(chans.length === ds.channels.length) title += ' — birleşik (' + chans.length + ' kanal)';
    return { title: title, paras: paras };
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
      if(stat && stat.perMount) {
        var worst = 0;
        stat.perMount.forEach(function(pm) {
          var dz = Math.abs((pm.delta || [])[2] || 0);
          if(dz > worst) worst = dz;
        });
        if(worst > 0) marks.push({ axis: 'x', value: -worst * 1000, kind: 'event',
          label: 'çalışma noktası ' + na(-worst * 1000) + ' mm' });
      }
      marks.push({ axis: 'x', value: -10, kind: 'limit', label: 'doğrusal bant −10 mm' });
      marks.push({ axis: 'x', value:  10, kind: 'limit', label: 'doğrusal bant +10 mm' });
      marks.push({ axis: 'x', value: -15, kind: 'stop',  label: 'durdurucu −15 mm' });
      marks.push({ axis: 'x', value:  15, kind: 'stop',  label: 'durdurucu +15 mm' });
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

  var LEADS = {
    frf:   'Motorun ürettiği titreşimin ne kadarının şasiye geçtiğini, her titreşim hızı için ayrı ayrı gösterir.',
    campbell: 'Motorun hangi devirde güç grubunun doğal frekanslarını uyardığını — yani rezonans devirlerini gösterir.',
    fdefl: 'Takozun ne kadar kuvvet altında ne kadar ezildiğini — yani ne kadar yumuşak olduğunu gösterir.',
    gz:    'Takozların araç çukura girip zıpladığında ne kadar ezildiğini ve yüklendiğini gösterir.',
    gy:    'Takozların araç virajda savrulduğunda ne kadar ezildiğini ve yüklendiğini gösterir.',
    gx:    'Takozların sert frende veya hızlanmada ne kadar ezildiğini ve yüklendiğini gösterir.'
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
    ISO_RATIO: ISO_RATIO
  };
})();

if(typeof module !== 'undefined' && module.exports){ module.exports = veMntBrief; }
