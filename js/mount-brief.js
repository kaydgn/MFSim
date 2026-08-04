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
  // atılır — "%2,0" değil "%2".
  function pct(v, dec) {
    var s = n(v, dec == null ? 1 : dec);
    if(s.indexOf(',') >= 0) s = s.replace(/,?0+$/, '');
    return '%' + s;
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

  // ── 1) Frekans yanıtı ────────────────────────────────────────────────────
  //
  // UZUNLUK BİR TASARIM KISITI: bu metin grafiğin ALTINDA duruyor ve şerit ne
  // kadar uzarsa eğriye o kadar az yer kalıyor. Altı paragraflık ilk sürüm
  // pencerenin yarısını yiyordu. Kural: en fazla üç paragraf, her cümle bir
  // SAYI taşısın. Genel tanım (eksen ne, birim ne) tek cümleye sıkışır;
  // yerini modelin kendi ölçümüne bırakır.
  function briefFRF(ds, R) {
    var f = ds.x.data;
    var T = chan(ds, 'T_2'), T0 = chan(ds, 'T0_2');
    if(!T) return null;
    var paras = [], marks = [];

    // P1 — eksenler + tepeler
    var modes = ((R && R.modes) || []).filter(function(m) { return m && m.f_Hz > 1e-6; });
    var pk = peaks(f, T.data, 1.05);
    var s1 = 'Yatay eksen titreşim frekansı, dikey eksen o titreşimin ne kadarının ' +
             'takozlardan geçip şasiye ulaştığı; 1 değeri "hiç azalmadan geçti" demek.';
    if(modes.length) {
      var fs = modes.map(function(m) { return m.f_Hz; });
      s1 += ' Tepeler güç grubunun doğal frekanslarıdır: ' + modes.length + ' tane, ' +
            na(Math.min.apply(null, fs)) + '–' + na(Math.max.apply(null, fs)) + ' Hz arasında.';
      modes.forEach(function(m) {
        marks.push({ axis: 'x', value: m.f_Hz, kind: 'mode',
                     label: na(m.f_Hz) + ' Hz · ' + modeShort(m.label) });
      });
    }
    if(pk.length) {
      var top = pk[0], near = null, bestD = Infinity;
      modes.forEach(function(m) {
        var d = Math.abs(Math.log10(m.f_Hz) - Math.log10(top.f));
        if(d < bestD) { bestD = d; near = m; }
      });
      s1 += ' En keskini ' + na(top.f) + ' Hz' +
            ((near && bestD < 0.05) ? ' (' + modeShort(near.label) + ')' : '') +
            ': orada şasiye giden kuvvet ' + na(top.v) + ' katına çıkıyor — takoz izole etmez, büyütür.';
    }
    paras.push(s1);

    // P2 — izolasyon bölgesi + ateşleme frekansı hükmü
    var cross = lastCrossBelow(f, T.data, 1);
    var s2 = '';
    if(isFinite(cross)) {
      s2 = na(cross) + ' Hz\'den sonra eğri kalıcı olarak 1\'in altında; takozun asıl ' +
           'işini yaptığı bölge orası.';
      marks.push({ axis: 'x', value: cross, kind: 'ref',
                   label: 'izolasyon başlangıcı ' + na(cross) + ' Hz' });
    }
    var eng = engineFiring(R);
    if(eng) {
      var Tf = interpAt(f, T.data, eng.f, true);
      s2 += (s2 ? ' ' : '') + 'Rölanti ateşleme frekansı ' + na(eng.f) + ' Hz (' +
            n(eng.rpm, 0) + ' d/dk, ' + n(eng.cyl, 0) + ' silindir)';
      if(isFinite(Tf)) {
        s2 += ' ve orada iletilebilirlik ' + na(Tf) + ' — titreşimin ' +
              pct((1 - Tf) * 100, 1) + '\'i takozda kalıyor. Hedef 0,2\'nin altı; ' +
              (Tf < 0.2 ? 'model sağlıyor.'
                        : (Tf < 1 ? 'model üstünde kalıyor, takozlar yumuşatılmalı.'
                                  : 'burada izolasyon yok, yerleşim değişmeli.'));
        marks.push({ axis: 'x', value: eng.f, kind: 'event',
                     label: 'rölanti ateşleme ' + na(eng.f) + ' Hz' });
      } else { s2 += '.'; }
    }
    marks.push({ axis: 'y', value: 1, unit: '−', kind: 'limit',
                 label: 'T = 1 · altı izolasyon, üstü büyütme' });
    if(s2) paras.push(s2);

    // P3 — okuma uyarıları (kullanıcının bildirdiği iki tuzak)
    var s3 = 'Sönümsüz kanal, kauçuğun sönüm payı çıkarılmış hâldir';
    if(T0 && pk.length) {
      var p0 = peaks(f, T0.data, 1.05);
      if(p0.length) s3 += ': tepeyi ' + na(p0[0].v) + '\'ten ' + na(pk[0].v) + '\'e indiriyor';
    }
    s3 += '. Onu ve izolasyon verimini AYRI şeritte okuyun — biri ölçeği ele geçirir, ' +
          'öteki rezonansta büyük eksi değerlere iner.';
    paras.push(s3);

    return {
      lead: 'Motorun ürettiği titreşimin ne kadarının şasiye geçtiğini, her titreşim hızı için ayrı ayrı gösterir.',
      paras: paras, marks: marks
    };
  }

  // ── 2) Kuvvet-deformasyon ────────────────────────────────────────────────
  function briefFdefl(ds, R) {
    var mounts = (R && R.mounts) || [];
    if(!mounts.length) return null;
    var paras = [], marks = [];

    var nl = mounts.filter(function(m) {
      return (m.curves && Object.keys(m.curves).length) || (m.fits && Object.keys(m.fits).length);
    }).length;

    paras.push(
      'Yatay eksen takozun şekil değiştirme miktarı (mm), dikey eksen bunun için gereken ' +
      'kuvvet; eksi değer basma, artı değer çekme. Eğrinin eğimi takozun sertliğidir.');

    paras.push(
      'Modelde ' + mounts.length + ' takoz var; ' +
      (nl === 0
        ? 'hepsi doğrusal, yani eğriler düz çizgi. Kütüphaneden eğri tanımlanırsa ' +
          'büyük ezilmedeki sertleşme de burada görünür.'
        : nl + ' tanesi nonlineer: yük arttıkça sertleşip dibe vurmayı geciktiriyor, ' +
          'kalan ' + (mounts.length - nl) + ' takoz doğrusal.'));

    var stat = staticCase(R);
    if(stat && stat.perMount && stat.perMount.length) {
      var worst = null, wi = -1;
      stat.perMount.forEach(function(pm, i) {
        var dz = Math.abs((pm.delta && pm.delta[2]) || 0);
        if(!worst || dz > worst) { worst = dz; wi = i; }
      });
      var wmm = worst * 1000;
      paras.push(
        'Araç kendi ağırlığındayken en çok yüklenen takoz "' + mountLabel(mounts[wi], wi) +
        '": düşeyde ' + na(wmm) + ' mm — doğrusal bandın (±10 mm) ' + pct(wmm / 10 * 100, 0) +
        '\'i. Metal metale değmeye ' + na(15 - wmm) + ' mm pay var.');
      marks.push({ axis: 'x', value: -wmm, kind: 'event',
                   label: 'çalışma noktası ' + na(-wmm) + ' mm' });
    }

    marks.push({ axis: 'x', value: -10, kind: 'limit', label: 'doğrusal bant −10 mm' });
    marks.push({ axis: 'x', value:  10, kind: 'limit', label: 'doğrusal bant +10 mm' });
    marks.push({ axis: 'x', value: -15, kind: 'stop',  label: 'durdurucu −15 mm' });
    marks.push({ axis: 'x', value:  15, kind: 'stop',  label: 'durdurucu +15 mm' });

    return {
      lead: 'Takozun ne kadar kuvvet altında ne kadar ezildiğini — yani ne kadar yumuşak olduğunu gösterir.',
      paras: paras, marks: marks
    };
  }

  // ── 3) İvme süpürmeleri ──────────────────────────────────────────────────
  var GS_TEXT = {
    gz: { yon: 'düşey', olay: 'araç çukura girip zıpladığında',
          sifir: '0 g\'de hiç yük yok; 1 g aracın düz zeminde durduğu hâl',
          tasarim: 3.5, tasarimAd: '3,5 g\'lik sert çukur darbesi' },
    gy: { yon: 'yanal', olay: 'araç virajda savrulduğunda',
          sifir: '0 g aracın düz gittiği hâl (düşey yük 1 g\'de sabit)',
          tasarim: 1, tasarimAd: '1 g\'lik viraj' },
    gx: { yon: 'boyuna', olay: 'sert frende veya hızlanmada',
          sifir: '0 g sabit hızda gidiş (düşey yük 1 g\'de sabit)',
          tasarim: 1, tasarimAd: '1 g\'lik fren' }
  };

  function briefSweep(ds, R) {
    var t = GS_TEXT[ds.key];
    if(!t) return null;
    var a = ds.x.data;
    var dmax = chan(ds, 'dmax'), nt = chan(ds, 'ntens'), nc = chan(ds, 'nclamp');
    if(!dmax) return null;
    var paras = [], marks = [];

    paras.push(
      'Yatay eksen ' + t.yon + ' ivme: ' + t.olay + ' takozlara binen yük. ' + t.sifir +
      '. "En büyük takoz çökmesi" kanalı hepsinin en kötüsünü tek eğride toplar.');

    var dAtDesign = interpAt(a, dmax.data, t.tasarim);
    var dAtEnd = dmax.data[dmax.data.length - 1];
    var dRef = isFinite(dAtDesign) ? dAtDesign : dAtEnd;
    var s = t.tasarimAd + ' altında en çok yüklenen takoz ' + na(dRef) + ' mm eziliyor';
    if(ds.key === 'gz') {
      var d1 = interpAt(a, dmax.data, 1);
      if(isFinite(d1)) s += ' (araç dururken ' + na(d1) + ' mm)';
    }
    s += '; ±15 mm sınırına ' + na(15 - dRef) + ' mm pay kalıyor.';
    paras.push(s);
    marks.push({ axis: 'x', value: t.tasarim, kind: 'event',
                 label: 'tasarım yükü ' + n(t.tasarim, 1).replace(',0', '') + ' g' });
    if(ds.key === 'gz') {
      marks.push({ axis: 'x', value: 1, kind: 'ref', label: 'araç dururken 1 g' });
    }

    var aT = nt ? firstNonZero(a, nt.data) : NaN;
    var aC = nc ? firstNonZero(a, nc.data) : NaN;
    var ev = [];
    if(isFinite(aT)) {
      ev.push('İlk çekme ' + na(aT) + ' g\'de: bir takozun üzerinden yük tamamen kalkıp ' +
              'asılmaya geçiyor — elastomer çekmede basmadaki gibi davranmaz.');
      marks.push({ axis: 'x', value: aT, kind: 'warn', label: 'ilk çekme ' + na(aT) + ' g' });
    }
    if(isFinite(aC)) {
      ev.push('İlk metal-metal temas ' + na(aC) + ' g\'de: yük artık kauçuktan değil ' +
              'çelikten geçiyor, eğrideki keskin kırılma orada.');
      marks.push({ axis: 'x', value: aC, kind: 'warn', label: 'durdurucu teması ' + na(aC) + ' g' });
    }
    paras.push(ev.length
      ? ev.join(' ')
      : 'Süpürmenin tamamında hiçbir takoz dayanağına oturmuyor, hiçbirinin üzerinden yük ' +
        'kalkmıyor — iki sayaç da sıfırda. Aranan sonuç budur.');

    return {
      lead: 'Takozların ' + t.olay + ' ne kadar ezildiğini ve ne kadar yüklendiğini gösterir.',
      paras: paras, marks: marks
    };
  }

  // ── Giriş noktası ────────────────────────────────────────────────────────
  //
  // Yorum üretilemezse null döner ve pano açıklama şeridini hiç çizmez.
  // Yarım bir yorum, yorumsuzluktan kötüdür.
  function build(ds, R) {
    if(!ds || !R || R.error) return null;
    try {
      if(ds.key === 'frf')   return briefFRF(ds, R);
      if(ds.key === 'fdefl') return briefFdefl(ds, R);
      return briefSweep(ds, R);
    } catch(e) { return null; }
  }

  return {
    build: build,
    modeTR: modeTR,
    modeShort: modeShort,
    interpAt: interpAt,
    peaks: peaks,
    lastCrossBelow: lastCrossBelow,
    firstNonZero: firstNonZero,
    engineFiring: engineFiring
  };
})();

if(typeof module !== 'undefined' && module.exports){ module.exports = veMntBrief; }
