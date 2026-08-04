// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ SİNYALLERİ — çözüm sonucu (R) → Sonuçlar panelinin kanal biçimi
// ═══════════════════════════════════════════════════════════════════════════
//
// NEDEN VAR: Rapor takoz sonuçlarını dondurulmuş tablo/şekil olarak basar.
// Sonuçlar panelinin yapabildiği ve Rapor'un yapısal olarak yapamadığı tek şey
// SÜPÜRÜLEBİLİR bir bağımsız eksen üzerinde imleçle gezinmektir. Bu yüzden
// buraya YALNIZCA gerçek sinyaller girer — yani X ekseni olan büyüklükler:
//
//   frf    X = frekans [Hz]   → iletilebilirlik T(f), izolasyon verimi
//   fdefl  X = deformasyon [mm] → takoz kuvvet-deformasyon yasası F(δ)
//   gz/gy/gx  X = ivme [g]    → takoz çökmesi ve kuvveti, ivme süpürmesi
//   campbell X = motor devri [d/dk] → mertebe çizgileri × mod çizgileri
//
// Tek sayı (modal frekans, ζ, TRA açısı) ve matris (KED, 6×6 K/M) BURAYA
// GİRMEZ — süpürülecek ekseni yoktur, yeri Rapor'dur. Bu ayrım kasıtlıdır:
// panonun "tek X ekseni" kuralı (js/measure-core.js) skalerleri zaten şeride
// sokamaz, zorlamak imleç ölçümünü anlamsızlaştırırdı.
//
// SAF MODÜL: DOM'a dokunmaz, global duruma yazmaz. Girdi R (+ nonlineer/
// durduruculu yolu koruyan solveOne), çıktı sayı dizileri. Jest'te doğrudan
// test edilir (tests/unit/mount-signals.test.js).
// ═══════════════════════════════════════════════════════════════════════════

var veMntSignals = (function() {
  'use strict';

  // ── Süpürme çözünürlükleri ────────────────────────────────────────────────
  // FRF sınırları Rapor §8.13 ile AYNI (cp-mount-report.js _FRF_FMIN/_FRF_FMAX):
  // aynı büyüklüğün iki yerde farklı banttan okunması karşılaştırmayı bozardı.
  var FRF_FMIN = 0.1, FRF_FMAX = 100, FRF_NPTS = 240;
  // Kuvvet-deformasyon: ±15 mm metal-metal durdurucu boşluğunu (STOP_GAP_M)
  // kapsar — kullanıcı çalışma noktasının durdurucuya ne kadar yakın olduğunu
  // eğri üzerinde görsün.
  var FD_LIM_MM = 15, FD_NPTS = 121;
  // İvme süpürmesi: 0 → 3.5 g. Üst sınır tasarım yük durumu "3.5g Düşey" ile
  // aynı (cp-mount.js designDefs) — süpürme o noktayı İÇERMELİ, yoksa tasarım
  // durumu eğrinin dışında kalır ve ikisi karşılaştırılamaz.
  var GS_MAX = 3.5, GS_NPTS = 36;
  // Campbell: devir ekseni doğrusal örneklenir. Mertebe çizgileri devirde
  // DOĞRUSAL (f = mertebe·N/60) olduğu için iki uç nokta yeterdi; yine de
  // ızgara açılır ki imleç ara devirlerde de sayı okusun.
  var CAMP_NPTS = 121;

  var SENSOR_PREFIX = '~mnt-';

  // Tanınan veri kümesi anahtarları. Kanal yönlendirmesi ÖNEKLE DEĞİL bu tam
  // listeyle yapılır: alt-topolojide 'mnt-motor', 'mnt-mount', 'mnt-solver' gibi
  // BİLEŞEN tipleri var ve sihirbazın sanal sensör kimliği '~' + bileşen tipidir.
  // Salt önek kontrolü, ileride o bileşenlerden birine sinyal tanımlandığı gün
  // '~mnt-motor'u sessizce buraya çeker ve o sensör ölür. Beyaz liste bu sınıf
  // hatayı bugünden kapatır.
  var SET_KEYS = ['frf', 'fdefl', 'gz', 'gy', 'gx', 'campbell'];

  function isMountSensor(sensorId) {
    if(typeof sensorId !== 'string' || sensorId.indexOf(SENSOR_PREFIX) !== 0) return false;
    return SET_KEYS.indexOf(sensorId.substring(SENSOR_PREFIX.length)) >= 0;
  }

  // ── Diyagram yorumu ───────────────────────────────────────────────────────
  //
  // Grafiğin altındaki açıklama, sabit bir metin DEĞİL: js/mount-brief.js
  // çözümün kendisini okuyup bu modele ait sayılarla yazar (tepe frekansları,
  // ateşleme frekansındaki iletilebilirlik, ilk çekmenin başladığı ivme...).
  // Beş diyagramda tekrarlanan genel geçer bir paragraf kimseye bir şey
  // öğretmiyordu; yorum modele bağlı olmazsa yazılmaması daha iyidir.
  function _brief() {
    if(typeof veMntBrief !== 'undefined' && veMntBrief) return veMntBrief;
    if(typeof window !== 'undefined' && window.veMntBrief) return window.veMntBrief;
    return null;
  }

  function _core() {
    if(typeof veMountCore !== 'undefined' && veMountCore) return veMountCore;
    if(typeof window !== 'undefined' && window.veMountCore) return window.veMountCore;
    return null;
  }

  function _num(v) { return (typeof v === 'number' && isFinite(v)) ? v : NaN; }

  function _norm3(v) {
    if(!v) return NaN;
    return Math.sqrt(_num(v[0]) * _num(v[0]) + _num(v[1]) * _num(v[1]) + _num(v[2]) * _num(v[2]));
  }

  // Takoz adı — kanal etiketinde kullanılır. Adsız takoz sıra numarasıyla anılır
  // ki iki kanal aynı ada sahip olmasın (ağaçta ayırt edilemezdi).
  function _mountLabel(mnt, i) {
    var n = (mnt && mnt.name) ? String(mnt.name).trim() : '';
    return n ? n : ('Takoz ' + (i + 1));
  }

  // ── Kanal kimliği: KONUM DEĞİL KİMLİK ────────────────────────────────────
  //
  // Kanal kimlikleri panoya ve projeye kaydediliyor. Sıra numarasından
  // türetilirlerse ("d0", "d1"…) kullanıcı bir takoz ekleyip/silip yeniden
  // çözdüğünde AYNI kimlik BAŞKA bir takoza bağlanır: şerit hâlâ "Ön Sağ"
  // yazarken artık "Sol Arka"nın çökmesini çizer. Sayı makul, etiket yanlış —
  // gözle yakalanmaz. Bu yüzden kimlik takozun ADINDAN türetilir.
  //
  // Ad da değişebilir; o durumda kanal kaybolur (şerit düşer), sessizce başka
  // bir takoza bağlanmaz. Kaybolmak yanlış veriden iyidir.
  var _SLUG_FOLD = { 'İ':'i','I':'i','ı':'i','Ş':'s','ş':'s','Ğ':'g','ğ':'g',
                     'Ü':'u','ü':'u','Ö':'o','ö':'o','Ç':'c','ç':'c' };

  function _slug(s) {
    var out = '', i, c;
    s = String(s == null ? '' : s);
    for(i = 0; i < s.length; i++) {
      c = s.charAt(i);
      c = _SLUG_FOLD[c] || c.toLowerCase();
      out += /[a-z0-9]/.test(c) ? c : '_';
    }
    out = out.replace(/_+/g, '_').replace(/^_|_$/g, '');
    return out || 'takoz';
  }

  // Takoz başına benzersiz kimlik kökü. Aynı ada sahip iki takoz varsa ikincisi
  // "_2" ile ayrılır — kimlikler çakışırsa iki kanal tek satıra düşerdi.
  // "m." öneki, kümenin sabit kimlikleriyle (dmax / ntens / nclamp) çakışmayı
  // yapısal olarak imkânsız kılar.
  function _mountKeys(mounts) {
    var seen = {}, keys = [];
    (mounts || []).forEach(function(mnt, i) {
      var base = _slug(_mountLabel(mnt, i));
      seen[base] = (seen[base] || 0) + 1;
      keys.push('m.' + base + (seen[base] > 1 ? ('_' + seen[base]) : ''));
    });
    return keys;
  }

  var AXIS_NAMES = ['X (boyuna)', 'Y (yanal)', 'Z (düşey)'];

  // ── 1) Frekans yanıtı ─────────────────────────────────────────────────────
  //
  // Çekirdeğin frequencyResponse'u yön başına ayrı çağrılır (dir 0/1/2). Rapor
  // yalnız düşeyi (dir=2) basar; burada üçü de verilir, çünkü panonun değeri
  // "hangi yönde izolasyon zayıf?" sorusunu imleçle karşılaştırmakta.
  //
  // Sönümsüz eğri (T0) da kanal olarak açılır: sönümün rezonans tepesini ne
  // kadar bastırdığı aynı şeritte üst üste görünsün.
  function _frfSet(R) {
    var C = _core();
    if(!C || !C.frequencyResponse || !C.buildM6) return null;
    if(!R || !R.mounts || !R.mounts.length || !R.mp || !R.damping) return null;

    var M6 = C.buildM6(R.mp.m, R.mp.I_G);
    if(!M6) return null;

    var f = null, chans = [], perChans = [];
    var keys = _mountKeys(R.mounts);
    for(var dir = 0; dir < 3; dir++) {
      var pts = C.frequencyResponse(R.mounts, R.mp.cg, M6, R.damping,
        { fMin: FRF_FMIN, fMax: FRF_FMAX, nPts: FRF_NPTS, dir: dir, perMount: true });
      if(!pts || !pts.f || !pts.f.length) return null;
      if(!f) f = pts.f;
      var ax = AXIS_NAMES[dir];
      chans.push({ id: 'T_' + dir,  name: 'İletilebilirlik T — ' + ax,
                   unit: '−', data: pts.T });
      chans.push({ id: 'T0_' + dir, name: 'İletilebilirlik T (sönümsüz) — ' + ax,
                   unit: '−', data: pts.T0 });
      // Verim = (1−T)·100. T > 1 (rezonans bölgesi) NEGATİF verim demektir ve
      // öyle bırakılır — sıfıra kırpmak "kötü değil" izlenimi verirdi.
      chans.push({ id: 'eta_' + dir, name: 'İzolasyon verimi — ' + ax, unit: '%',
                   data: pts.T.map(function(t) {
                     return isFinite(t) ? (1 - t) * 100 : NaN;
                   }) });
      // ── Takoz başına iletilebilirlik ──
      // Tedarikçi raporları (AMC) destek başına AYRI eğri basar: "hangi takoz
      // şasiye en çok kuvvet geçiriyor" sorusu sistem toplamından okunamaz.
      // Toplam ile parçalar aynı çözümden gelir (mount-core frfForces), ayrı
      // bir hesap yolu yok — ikisi sessizce ayrışamaz.
      //
      // Sistem kanallarının ARDINDAN eklenir: ağaçta önce üç yönün toplamı,
      // sonra takoz kırılımı görünsün.
      if(pts.Tm) {
        (function(dirLocal, Tm) {
          R.mounts.forEach(function(mnt, mi) {
            perChans.push({
              id: 'Tm_' + dirLocal + '_' + keys[mi],
              name: _mountLabel(mnt, mi) + ' · iletilebilirlik T — ' + AXIS_NAMES[dirLocal],
              unit: '−', data: Tm[mi]
            });
          });
        })(dir, pts.Tm);
      }
    }
    chans = chans.concat(perChans);

    return {
      key: 'frf',
      sensorId: SENSOR_PREFIX + 'frf',
      name: 'Frekans yanıtı',
      icon: '<span class="mf-ico mf-ico-activity"></span>',
      // scale:'log' — ızgara logaritmik örneklendiği için eksen de öyle
      // çizilmeli. Lineer eksende 0,1–100 Hz'in üç dekatı sıkışır: rijit gövde
      // modlarının tamamı genişliğin ~%10'una düşer ve tepe tek piksele iner.
      // Kullanıcı araç çubuğundaki "log x" ile lineere geçebilir.
      x: { id: 'f', name: 'Frekans', unit: 'Hz', scale: 'log', data: f },
      channels: chans
    };
  }

  // ── 2) Kuvvet-deformasyon eğrisi ──────────────────────────────────────────
  //
  // Takozun statik yasası: nonlineer eğri/analitik fit tanımlıysa o, yoksa
  // lineer kstat. Aynı çözücünün kullandığı mountStaticLaws çağrılır — panoda
  // görünen eğri ile çözümün kullandığı yasa AYNI olsun (ayrı bir "gösterim
  // için" eğri üretmek, sessizce ayrışan iki model demekti).
  //
  // İşaret sözleşmesi çekirdekle aynı: δ < 0 BASMA (compression).
  function _fdeflSet(R) {
    var C = _core();
    if(!C || !C.mountStaticLaws) return null;
    if(!R || !R.mounts || !R.mounts.length) return null;

    var x = [], i;
    for(i = 0; i < FD_NPTS; i++) {
      x.push(-FD_LIM_MM + (2 * FD_LIM_MM) * i / (FD_NPTS - 1));
    }

    var chans = [], keys = _mountKeys(R.mounts);
    R.mounts.forEach(function(mnt, mi) {
      var laws = C.mountStaticLaws(mnt);
      if(!laws) return;
      var label = _mountLabel(mnt, mi);
      for(var ax = 0; ax < 3; ax++) {
        var law = laws[ax];
        if(!law || typeof law.force !== 'function') continue;
        var data = x.map(function(dmm) {
          var v = law.force(dmm / 1000);       // yasa SI (m) alır, N döner
          return isFinite(v) ? v : NaN;
        });
        chans.push({
          id: keys[mi] + '.' + ax,
          name: label + ' · ' + AXIS_NAMES[ax] + (law.curve ? ' (nonlineer)' : ''),
          unit: 'N',
          data: data
        });
      }
    });
    if(!chans.length) return null;

    return {
      key: 'fdefl',
      sensorId: SENSOR_PREFIX + 'fdefl',
      name: 'Kuvvet-deformasyon',
      icon: '<span class="mf-ico mf-ico-ruler"></span>',
      x: { id: 'd', name: 'Deformasyon', unit: 'mm', data: x },
      channels: chans
    };
  }

  // ── 3) İvme süpürmesi ─────────────────────────────────────────────────────
  //
  // Yük durumları AYRIK noktalardır (Static, Max Bump, Cornering…). Aradaki
  // davranış tabloda görünmez: nonlineerlik ve metal-metal durdurucu hangi
  // ivmede devreye giriyor, çekme (lift-off) nerede başlıyor? Bunlar eğrinin
  // KIRILMA noktalarıdır — süpürme onları görünür kılar.
  //
  // solveOne çözücünün kendi yoludur (nonlineerse Newton, değilse durduruculu
  // lineer). Ayrı bir çözüm yolu yazılmaz: pano ile Rapor aynı fizikten okur.
  //
  // Düşey süpürmede n = [0,0,−a]: a yerçekimi DAHİL toplam düşey ivme katsayısı
  // (çekirdek sözleşmesi, solveCase yorumu). Yani a = 1 tam olarak Static
  // durumudur — çalışma noktası eğrinin üstünde okunabilir.
  // Yanal/boyunada düşey 1 g sabit tutulur, süpürülen eksen a'dır.
  var GS_DEFS = [
    { key: 'gz', name: 'Düşey ivme süpürmesi',  short: 'düşey',
      icon: '<span class="mf-ico mf-ico-trending-up"></span>',
      xName: 'Düşey ivme',  vec: function(a) { return [0, 0, -a]; } },
    { key: 'gy', name: 'Yanal ivme süpürmesi',  short: 'yanal',
      icon: '<span class="mf-ico mf-ico-shuffle"></span>',
      xName: 'Yanal ivme',  vec: function(a) { return [0, a, -1]; } },
    { key: 'gx', name: 'Boyuna ivme süpürmesi', short: 'boyuna',
      icon: '<span class="mf-ico mf-ico-route"></span>',
      xName: 'Boyuna ivme', vec: function(a) { return [-a, 0, -1]; } }
  ];

  function _gSweepSet(R, solveOne, def) {
    if(typeof solveOne !== 'function') return null;
    if(!R || !R.mounts || !R.mounts.length) return null;

    var nM = R.mounts.length;
    var x = [], dPer = [], fPer = [], dMax = [], nTens = [], nClamp = [];
    var i, mi;
    for(mi = 0; mi < nM; mi++) { dPer.push([]); fPer.push([]); }

    for(i = 0; i < GS_NPTS; i++) {
      var a = GS_MAX * i / (GS_NPTS - 1);
      x.push(a);
      var rc = null;
      try {
        rc = solveOne({ name: def.key + '@' + a.toFixed(3), n: def.vec(a), T: [0, 0, 0] });
      } catch(e) { rc = null; }
      var res = (rc && rc.res) ? rc.res : null;
      var pm = (res && res.perMount) ? res.perMount : null;
      var worst = NaN;
      for(mi = 0; mi < nM; mi++) {
        var e = pm ? pm[mi] : null;
        var dmm = e ? _norm3(e.delta) * 1000 : NaN;
        dPer[mi].push(dmm);
        fPer[mi].push(e ? _norm3(e.f) : NaN);
        if(isFinite(dmm) && (!isFinite(worst) || dmm > worst)) worst = dmm;
      }
      dMax.push(worst);
      var ck = (res && res.checks) ? res.checks : null;
      nTens.push(ck ? (ck.tensionCount || 0) : NaN);
      nClamp.push(ck ? (ck.clampCount || 0) : NaN);
    }

    var chans = [], keys = _mountKeys(R.mounts);
    R.mounts.forEach(function(mnt, k) {
      var label = _mountLabel(mnt, k);
      chans.push({ id: keys[k] + '.d', name: label + ' · bileşke çökme',  unit: 'mm', data: dPer[k] });
      chans.push({ id: keys[k] + '.f', name: label + ' · bileşke kuvvet', unit: 'N',  data: fPer[k] });
    });
    chans.push({ id: 'dmax',  name: 'En büyük takoz çökmesi',        unit: 'mm',    data: dMax });
    chans.push({ id: 'ntens', name: 'Çekmedeki (lift-off) takoz',    unit: 'adet',  data: nTens });
    chans.push({ id: 'nclamp', name: 'Durdurucuya oturan takoz',     unit: 'adet',  data: nClamp });

    return {
      key: def.key,
      sensorId: SENSOR_PREFIX + def.key,
      name: def.name,
      icon: def.icon,
      x: { id: 'a', name: def.xName, unit: 'g', data: x },
      channels: chans
    };
  }

  // ── 4) Campbell diyagramı ─────────────────────────────────────────────────
  //
  // Frekans yanıtı "hangi frekansta rezonans var?" sorusunu cevaplar; Campbell
  // "motor HANGİ DEVİRDE o frekansı üretir?" sorusunu. İkisi aynı şey değildir
  // ve tasarımı belirleyen ikincisidir: 13,6 Hz'lik bir mod, motor onu hiç
  // uyarmıyorsa zararsızdır.
  //
  // Diyagram iki çizgi ailesinden oluşur:
  //   EĞİK  mertebe çizgileri  f = mertebe · N/60   (uyarma, devirle büyür)
  //   YATAY mod çizgileri      f = sabit            (yapının doğal frekansı)
  // Kesişimleri REZONANS devirleridir. Çalışma bandının içine düşen kesişim
  // tasarım sorunudur; dışına düşen (ör. rölantinin altı) yalnız kalkış/durma
  // sırasında geçilir.
  //
  // 4 zamanlı motorda ateşleme mertebesi z/2'dir — silindir sayısı girilmemişse
  // hangi mertebenin ateşleme olduğu BİLİNEMEZ ve o etiket hiç yazılmaz.
  function _nTr(v, dec) {
    if(!isFinite(v)) return '—';
    return v.toFixed(dec == null ? 2 : dec).replace('.', ',');
  }

  function _engineSpec(R) {
    var tq = (R && R.gather && R.gather.torque) || {};
    var idle = Number(tq.idleRpm), cyl = Number(tq.cylinders);
    var top = 0;
    [tq.TeRpm, tq.PmaxRpm].forEach(function(v) {
      var x = Number(v);
      if(isFinite(x) && x > top) top = x;
    });
    return {
      idle: (isFinite(idle) && idle > 0) ? idle : NaN,
      cyl:  (isFinite(cyl)  && cyl  > 0) ? cyl  : NaN,
      top:  top > 0 ? top : NaN
    };
  }

  // Çizilecek mertebeler. AMC raporu 6 silindir için 1 · 3 · 6 · 12 çiziyor —
  // dönme, ateşleme, ikinci ve dördüncü harmonik. Aynı kural z'den türetilir.
  function _campOrders(cyl) {
    if(isFinite(cyl) && cyl > 0) {
      var main = cyl / 2;
      return [
        { o: 1,        label: 'dönme (balanssızlık)' },
        { o: main,     label: 'ateşleme', firing: true },
        { o: 2 * main, label: '2. harmonik' },
        { o: 4 * main, label: '4. harmonik' }
      ];
    }
    return [ { o: 1, label: 'dönme' }, { o: 2, label: '' },
             { o: 4, label: '' }, { o: 6, label: '' } ];
  }

  // Mertebe kimliği ondalıklı olabilir (5 silindirde ana mertebe 2,5). Nokta
  // kimlikte ayraç olduğu için alt çizgiye çevrilir: 'ord.2_5'.
  function _ordId(o) { return 'ord.' + String(o).replace('.', '_'); }

  function _campbellSet(R) {
    if(!R) return null;
    var modes = ((R.modes) || []).filter(function(m) { return m && m.f_Hz > 1e-6; });
    if(!modes.length) return null;     // yatay çizgi yoksa kesişim de yok
    var eng = _engineSpec(R);
    var orders = _campOrders(eng.cyl);
    var oMin = orders[0].o;

    var fMax = 0;
    modes.forEach(function(m) { if(m.f_Hz > fMax) fMax = m.f_Hz; });
    if(!(fMax > 0)) return null;

    // Y tavanı: en yüksek modun 1,6 katı (rölanti ateşleme frekansı daha
    // yukarıdaysa o). Tavanın üstünde mertebe çizgisinin taşıyacağı bilgi yok
    // — kesişim kalmadı — ama ölçeği ele geçirip mod çizgilerini dibe
    // yapıştırırdı. Tavan üstü NaN: çizgi grafiğin üstünden çıkar, Campbell
    // diyagramlarında olağan görüntü budur.
    var eF = (isFinite(eng.idle) && isFinite(eng.cyl)) ? (eng.idle / 60) * (eng.cyl / 2) : NaN;
    var fCap = Math.max(1.6 * fMax, isFinite(eF) ? 1.25 * eF : 0);

    // Devir tavanı: motorun bilinen en yüksek devri (+%10), yoksa rölantinin
    // 3 katı. Her hâlükârda EN DÜŞÜK mertebenin EN YÜKSEK modu kestiği devir
    // içeride kalır — yoksa aranan kesişim grafiğin dışında olurdu.
    var rpmTop = 0;
    if(isFinite(eng.top))  rpmTop = eng.top * 1.1;
    if(isFinite(eng.idle)) rpmTop = Math.max(rpmTop, eng.idle * 3);
    rpmTop = Math.max(rpmTop, fMax * 60 / oMin * 1.15);
    rpmTop = Math.ceil(rpmTop / 100) * 100;
    if(!(rpmTop > 0)) return null;

    var rpm = [], i;
    for(i = 0; i < CAMP_NPTS; i++) rpm.push(rpmTop * i / (CAMP_NPTS - 1));

    var B = _brief();
    var chans = [];
    orders.forEach(function(od) {
      chans.push({
        id: _ordId(od.o),
        name: _nTr(od.o, 1).replace(',0', '') + '. mertebe' + (od.label ? ' — ' + od.label : ''),
        unit: 'Hz',
        data: rpm.map(function(N) {
          var f = od.o * N / 60;
          return f <= fCap ? f : NaN;
        })
      });
    });
    modes.forEach(function(m, k) {
      var sh = (B && B.modeShort) ? B.modeShort(m.label) : (m.label || 'mod');
      chans.push({
        id: 'mode.' + (k + 1),
        name: 'Mod ' + (k + 1) + ' · ' + sh + ' — ' + _nTr(m.f_Hz, 2) + ' Hz',
        unit: 'Hz',
        data: rpm.map(function() { return m.f_Hz; })
      });
    });

    return {
      key: 'campbell',
      sensorId: SENSOR_PREFIX + 'campbell',
      name: 'Campbell diyagramı',
      icon: '<span class="mf-ico mf-ico-git-branch"></span>',
      x: { id: 'rpm', name: 'Motor devri', unit: 'd/dk', data: rpm },
      channels: chans,
      // Yorum katmanı bu değerleri yeniden türetmesin: kesişim devirleri ve
      // çalışma bandı burada bir kez hesaplandı, orada tekrar hesaplanırsa
      // ikisi sessizce ayrışabilir.
      meta: { idleRpm: eng.idle, maxRpm: isFinite(eng.top) ? eng.top : NaN,
              cyl: eng.cyl, rpmTop: rpmTop, fCap: fCap, orders: orders }
    };
  }

  // ── Kurulum ───────────────────────────────────────────────────────────────

  // R (+ opts.solveOne) → veri kümeleri dizisi. Üretilemeyen küme SESSİZCE
  // atlanır (sönüm yoksa FRF yok, solveOne yoksa süpürme yok) — yarım veriyle
  // uydurma eğri çizmektense o kanal hiç görünmesin.
  function build(R, opts) {
    opts = opts || {};
    if(!R || R.error) return [];
    var sets = [];
    var s;
    s = _frfSet(R);      if(s) sets.push(s);
    s = _campbellSet(R); if(s) sets.push(s);
    s = _fdeflSet(R);    if(s) sets.push(s);
    GS_DEFS.forEach(function(def) {
      var g = _gSweepSet(R, opts.solveOne, def);
      if(g) sets.push(g);
    });
    // Yorum kümenin bir parçası: panonun altındaki şerit (js/trace-view.js)
    // hangi kümeye baktığını bilir, yorumu oradan okur. Üretilemezse null
    // kalır ve şerit hiç çizilmez.
    var B = _brief();
    sets.forEach(function(ds) {
      ds.brief = B ? B.build(ds, R) : null;
    });
    return sets;
  }

  // Veri kümeleri → Veri Gezgini grup listesi. Grup/satır biçimi sinyal
  // ağacınınkiyle birebir aynı (js/signal-tree.js veSigCollectGroups) — ağaç
  // takoz kanallarını araç sinyallerinden ayırt etmek zorunda kalmasın.
  function groups(sets) {
    return (sets || []).map(function(ds) {
      return {
        gid: 'mnt:' + ds.key,
        key: 'mnt:' + ds.key,
        name: ds.name,
        icon: ds.icon,
        dragId: ds.sensorId,
        items: ds.channels.map(function(ch) {
          return {
            sensorId: ds.sensorId,
            signalId: ch.id,
            name: ch.name,
            unit: ch.unit || '',
            dir: 'comp',
            compType: 'mount-analysis',
            source: 'Takoz çözücü',
            virtual: true
          };
        })
      };
    });
  }

  // sensorId + signalId → sayı dizisi. X kanalı da (ds.x.id) buradan okunur:
  // pano X eksenini normal bir sinyal gibi çözer (js/trace-view.js veTrResolveX).
  function series(sets, sensorId, signalId) {
    var i, j;
    for(i = 0; i < (sets || []).length; i++) {
      var ds = sets[i];
      if(ds.sensorId !== sensorId) continue;
      if(ds.x && ds.x.id === signalId) return ds.x.data || null;
      for(j = 0; j < ds.channels.length; j++) {
        if(ds.channels[j].id === signalId) return ds.channels[j].data || null;
      }
      return null;
    }
    return null;
  }

  // sensorId → veri kümesi (X ekseni tanımı ve etiketler için).
  function setOf(sets, sensorId) {
    for(var i = 0; i < (sets || []).length; i++) {
      if(sets[i].sensorId === sensorId) return sets[i];
    }
    return null;
  }

  // Ölçüm penceresi hangi veri kümesini gösteriyor? Önce çizili sinyallere,
  // yoksa panonun X eksenine bakılır. Pano tek X ekseninde çalıştığı için
  // (js/measure-core.js) cevap TEK bir kümedir; karışık pano oluşamaz.
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

  // Kümenin X ekseni → panonun xAxis biçimi. Pano tek eksen kuralını
  // (js/measure-core.js veXAxisKeyOf) bu kimlik üzerinden uygular: farklı
  // küme = farklı kimlik = aynı pencereye giremez.
  function xAxisOf(ds) {
    if(!ds || !ds.x) return null;
    var ax = {
      id: ds.sensorId + ':' + ds.x.id,
      name: ds.x.name + ' [' + ds.x.unit + ']',
      unit: ds.x.unit
    };
    // Ölçek önerisi eksenin bir parçası: pano bunu görüp log çizer
    // (js/trace-view.js veTrXLogOn). Kullanıcı elle değiştirirse onun seçimi
    // (slot.xLog) öneriyi ezer.
    if(ds.x.scale) ax.scale = ds.x.scale;
    return ax;
  }

  // Bir kanalın tanımı (ad/birim) — panoya eklerken etiket buradan gelir.
  function channelOf(sets, sensorId, signalId) {
    var ds = setOf(sets, sensorId);
    if(!ds) return null;
    if(ds.x && ds.x.id === signalId) return { id: ds.x.id, name: ds.x.name, unit: ds.x.unit };
    for(var i = 0; i < ds.channels.length; i++) {
      if(ds.channels[i].id === signalId) return ds.channels[i];
    }
    return null;
  }

  return {
    build: build,
    groups: groups,
    series: series,
    setOf: setOf,
    setOfSlot: setOfSlot,
    xAxisOf: xAxisOf,
    channelOf: channelOf,
    isMountSensor: isMountSensor,
    SENSOR_PREFIX: SENSOR_PREFIX,
    SET_KEYS: SET_KEYS,
    FRF_FMIN: FRF_FMIN, FRF_FMAX: FRF_FMAX, FRF_NPTS: FRF_NPTS,
    FD_LIM_MM: FD_LIM_MM, FD_NPTS: FD_NPTS,
    GS_MAX: GS_MAX, GS_NPTS: GS_NPTS,
    CAMP_NPTS: CAMP_NPTS
  };
})();

// Node/Jest ortamında modül olarak da erişilebilir olsun (tarayıcıda no-op).
if(typeof module !== 'undefined' && module.exports){ module.exports = veMntSignals; }
