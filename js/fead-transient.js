// ============================================================================
//  FEAD — GEÇİCİ REJİM: MOTOR ÇEVRİMİ SENARYOSU
// ============================================================================
// Kayış Yolu kartı bugüne kadar hep TEK BİR çalışma noktasını gösteriyordu:
// bir devir seç, o devrin kinematiği ve titreşimi oynasın. Gerçek bir tahrik
// ise sabit devirde çalışmaz — kontak döner, marş basar, motor ateşler,
// rölantiye oturur, hızlanır, yavaşlar. İlginç olayların çoğu tam da orada:
// ivme gerilmeyi ±%28 oynatıyor ve devir süpürmesi açıklık rezonanslarının
// İÇİNDEN geçiyor.
//
// Bu dosya o senaryonun fiziğidir. DOM'suz ve çekirdeğe DOKUNMAZ — kalıp
// js/fead-checks.js ile aynı: saf hesap, panel ve animatör aynı çağrıyı
// paylaşır.
//
// ── EN ÖNEMLİ AYRIM: NE TÜRETİLİYOR, NE DAYATILIYOR ─────────────────────────
//
// Devir geçmişi N(t) SİMÜLE EDİLMİYOR, DAYATILIYOR. Sebebi bir tercih değil
// bir veri eksikliği ve söylenmesi şart:
//
//   Krank milini hızlandıran denklem J·dω/dt = T_motor − T_yük. MFSim'de
//   T_motor VAR (motor kataloğunda 24 motorun tam yük tork eğrisi) ama J YOK.
//   Modeldeki "Krank ataleti" alanı BURULMA MODELİNİN ataletidir — Gates'in
//   FEAD ucundan gördüğü krank + damper + kasnak (BMC'de 0.70 kg·m²), volan ve
//   aktarma organları DEĞİL. Onunla integre etmek 1100 Nm / 0.70 = 15.000 d/dk/s
//   verirdi; gerçek bir ağır dizel serbest hızlanmada 1000–2000 d/dk/s yapar.
//   Yani "fizikten türetilmiş" görünen ama on kat yanlış bir rampa — bu
//   modülün belgelenmiş sessiz hata sınıfının ta kendisi.
//
//   Bunun yerine rampa MFSim'in ZATEN SORDUĞU alandan geliyor: Çözücü
//   panelindeki "İvmelenme / Yavaşlama [RPM/s]". Aynı alanı `peakEstimate`
//   de kullanıyor, yani animasyon ile tepe yük tablosu AYNI sayıyı anlatıyor.
//
// TÜRETİLEN ise rampanın ŞEKLİ: motor kataloğunda eğri varsa
//   α(N) ∝ T_motor(N) − T_aksesuar(N)
// yani motor tork platosunda hızlı, regülatöre yaklaşırken yavaş hızlanır.
// Büyüklük kullanıcının ilan ettiği ivme, şekil motorun kendi eğrisi; yeni
// serbest parametre YOK. Eğri yoksa rampa DOĞRUSAL olur ve kart bunu yazar.
//
// ── ÜÇ FAZ DAYATILMIŞTIR VE HER BİRİNİN SEBEBİ AYNI: VERİ YOK ───────────────
//   marş devri     → MFSim'de marş motoru verisi yok (varsayılan 250 d/dk)
//   yavaşlama      → motor freni/sürüklenme torku yok; sabit hızda iniyor
//   stop           → aynı
//
// ── DÖRDÜNCÜ SESSİZ TUZAK: RÖLANTİ ALTINDA AKSESUAR YÜKÜ ───────────────────
// Gerilme zinciri aksesuar yükünü kuvvete `P/v` ile çeviriyor ve devir sıfıra
// giderken v de sıfıra gidiyor. Üç aday, üçü de ölçüldü:
//
//   P sabit    → kuvvet ∞. ÖLÇÜLDÜ: 3.5 kW'lık bir kompresörle N=10 d/dk'da
//                span gerilmesi 41.927 N. Fiziksel değil, bölme kazası.
//   T sabit    → kuvvet SABİT. Patlama biter ama DURAN motorda 1350 N'luk bir
//                yük iddia eder. ÖLÇÜLDÜ (gerçek tarayıcı, BMC): "Durgun · 0
//                dev/dk · T 526–1350 N" — kayış boştayken gerilmiş görünüyordu.
//   T ∝ N      → kuvvet ∝ N. Sıfır devirde SIFIR, rölantide eğrinin kendi
//                değeri, arada sürekli. Seçilen bu.
//
// Üçüncüsü aynı zamanda gerçekte olan şey: aksesuarlar devir yükseldikçe
// "canlanır" — alternatör regülatörü devreye girer, klima kavraması kapanır,
// direksiyon pompası debi verir. Duran bir motorda hiçbiri yük çekmez.
// Yani yük rölanti altında (N/N_rölanti)² ile ölçeklenir (P ∝ N² ⇒ T ∝ N).
// Kural yalnız BU MODÜLDE geçerli; kararlı rejim çözümünün sayıları değişmiyor.
//
// ── GERİLME İVMEDE TAM DOĞRUSAL — ÖLÇÜLDÜ, VE BU BİR TASARIM DAYANAĞI ──────
// `peakEstimate` gerilmeyi zincir boyunca T[k] = T[k-1] ± (kW/v + J·α·i/r)
// diye yürütüyor; α yalnız toplanan bir terimde geçiyor, yani
//     T(N, α) = A(N) + α·B(N)
// ve bu YAKLAŞIK değil TAM. Üç devirde üç ivmeyle ölçüldü: sapma 0.00e+0 N.
// Dayanağı şu: animatörün kare başına çözücü koşturması yasak (mevcut kural).
// İki devir ızgarası (A ve B) önceden hesaplanıp yüke konuyor, animatör
// herhangi bir α için gerilmeyi TAM olarak yeniden kuruyor.
//
// ── İKİ SAAT ───────────────────────────────────────────────────────────────
// Senaryo saati GERÇEK saniyedir (10 saniyelik bir çevrim 10 saniye oynar).
// Dönüş ve titreşim ise mevcut ağır çekimde kalır (BMC'de ×1/139). Tek saat
// kullanılsaydı ya senaryo 23 dakika sürerdi ya da dönüş strob olurdu. Künye
// ikisini de yazar.

var VE_FEAD_SCN_VERSION = '1.0.0';

// Marş devri — DAYATILMIŞ (MFSim'de marş motoru verisi yok).
var VE_FEAD_SCN_CRANK_RPM = 250;
// Çözücüde ivme girilmemişse çekirdeğin kendi varsayılanı kullanılır.
var VE_FEAD_SCN_ACCEL_DEF = 1100;
var VE_FEAD_SCN_IDLE_DEF  = 700;
var VE_FEAD_SCN_PEAK_DEF  = 2500;
// Zaman ızgarası: yük yalnız sayı taşır, animatör bunun üstünde doğrusal
// aradeğerliyor. 12 örnek/s düzgün bir rampa için fazlasıyla yeter.
var VE_FEAD_SCN_HZ = 12;
// Devir ızgarası (gerilme A/B katsayıları). Gerilme devirde düzgün.
var VE_FEAD_SCN_GRID_N = 24;
// Izgaranın alt ucu: sıfır devirde kayış hızı sıfır ve P/v tanımsız.
var VE_FEAD_SCN_MIN_RPM = 40;

// Faz iskeleti. Süresi `s` olanlar sabit; `null` olanlar ivmeden TÜRETİLİR.
var VE_FEAD_SCN_PLAN = [
  { k: 'off',   ad: 'Durgun',     s: 0.8 },
  { k: 'crank', ad: 'Marş',       s: 1.0 },
  { k: 'fire',  ad: 'Ateşleme',   s: 0.6 },
  { k: 'idle',  ad: 'Rölanti',    s: 2.0 },
  { k: 'accel', ad: 'Hızlanma',   s: null },
  { k: 'hold',  ad: 'Tepe devir', s: 1.5 },
  { k: 'decel', ad: 'Yavaşlama',  s: null },
  { k: 'idle2', ad: 'Rölanti',    s: 1.5 },
  { k: 'stop',  ad: 'Stop',       s: 1.2 }
];

// Tam yük tork eğrisinden devirdeki tork [Nm]. Uçlarda kenetlenir —
// `veFeadInterpKw` ile aynı kalıp; ikinci bir aradeğerleme yazmamak için
// biçimi de aynı tutuluyor.
function veFeadScnTorqueAt(curve, rpm){
  var p = Array.isArray(curve) ? curve : [];
  if(!p.length || !Number.isFinite(rpm)) return NaN;
  if(p.length === 1) return p[0].nm;
  if(rpm <= p[0].rpm) return p[0].nm;
  if(rpm >= p[p.length-1].rpm) return p[p.length-1].nm;
  for(var i=1;i<p.length;i++){
    if(rpm <= p[i].rpm){
      var a = p[i-1], b = p[i];
      if(b.rpm === a.rpm) return b.nm;
      return a.nm + (b.nm - a.nm) * (rpm - a.rpm) / (b.rpm - a.rpm);
    }
  }
  return p[p.length-1].nm;
}

// Senaryonun girdileri — hepsi MFSim'in ZATEN sorduğu alanlardan.
// Hangisinin nereden geldiği `kaynak` altında taşınır; kart onu yazıyor.
function veFeadScnInputs(build){
  var sd = (build && build.solver && build.solver.data) || {};
  var num = (typeof _feadNum === 'function')
    ? _feadNum : function(v, d){ var x = parseFloat(v); return Number.isFinite(x) ? x : d; };

  var idle = num(sd.idleRpm, NaN);
  if(!(idle > 0)) idle = VE_FEAD_SCN_IDLE_DEF;

  // Tepe devir: çalışma çevriminin en yükseği > regülatör devri > varsayılan.
  var peak = 0;
  if(typeof veFeadDutyRows === 'function')
    veFeadDutyRows(build && build.solver).forEach(function(r){ if(r.rpm > peak) peak = r.rpm; });
  var peakSrc = 'çalışma çevrimi';
  if(!(peak > idle)){ peak = num(sd.governedRpm, NaN); peakSrc = 'regülatör devri'; }
  if(!(peak > idle)){ peak = VE_FEAD_SCN_PEAK_DEF; peakSrc = 'varsayılan'; }

  var acc = num(sd.accelRpmS, NaN); var accVar = !(acc > 0);
  if(accVar) acc = VE_FEAD_SCN_ACCEL_DEF;
  var dec = num(sd.decelRpmS, NaN); var decVar = !(dec > 0);
  if(decVar) dec = acc;

  var cyl = num(sd.cylinders, 6); if(!(cyl > 0)) cyl = 6;

  // Tork eğrisi YALNIZ katalogtan gelen motorda var; elle kurulan motorda
  // yok ve rampa doğrusal olur. Uydurulmuyor, yazılıyor.
  var curve = null;
  if(sd.engineLib && typeof veFeadEngineOf === 'function'){
    var e = veFeadEngineOf(sd.engineLib);
    if(e && Array.isArray(e.curve) && e.curve.length >= 2) curve = e.curve;
  }
  return {
    idleRpm: idle, peakRpm: peak, crankRpm: VE_FEAD_SCN_CRANK_RPM,
    accelRpmS: acc, decelRpmS: dec, cylinders: cyl, curve: curve,
    kaynak: { peak: peakSrc, accelVarsayilan: accVar, decelVarsayilan: decVar,
              egri: !!curve }
  };
}

// Devirdeki aksesuar yükü [kW], kasnak adına göre.
// RÖLANTİ ALTINDA TORK DEVİRLE ORANTILI (dosya başındaki dördüncü tuzak):
// yük (N/N_rölanti)² ile ölçeklenir, yani kuvvet devirle doğru orantılı olur —
// sıfır devirde sıfır, rölantide eğrinin kendi değeri, arada sürekli.
function veFeadScnLoadsAt(build, rpm, idleRpm){
  var loads = {};
  if(!build || !build.ok || !build.sys) return loads;
  var alt = (rpm < idleRpm && idleRpm > 0);
  var ref = alt ? idleRpm : rpm;
  var u = alt ? (rpm / idleRpm) : 1;
  var olcek = alt ? (u * u) : 1;
  build.order.forEach(function(n, i){
    if(build.sys.pulleys[i] && build.sys.pulleys[i].crank) return;   // sürücü hesaplanır
    var kw = (typeof veFeadAutoKw === 'function')
      ? veFeadAutoKw(build.sys, i, n, ref) : null;
    loads[build.names[i]] = (kw === null || !Number.isFinite(kw)) ? 0 : kw * olcek;
  });
  return loads;
}

// Kasnak ataletleri (burulma modelininkiyle AYNI kaynak; krank mili ayrı).
function veFeadScnInertias(build){
  var J = {};
  if(!build || !build.ok) return J;
  build.order.forEach(function(n, i){
    var v = (typeof _feadNum === 'function') ? _feadNum(n && n.data && n.data.inertia, NaN) : NaN;
    if(Number.isFinite(v) && v > 0) J[build.names[i]] = v;
  });
  return J;
}

// ── SENARYO KURULUMU ────────────────────────────────────────────────────────
// Dönen nesne YALNIZ SAYI ve sabit anahtar taşır: olduğu gibi animasyon yüküne
// (JSON) giriyor ve animatör kare başına çekirdeğe HİÇ dokunmuyor.
function veFeadScenarioBuild(build, opts){
  if(!build || !build.ok || !build.sys || typeof FEADCore === 'undefined') return null;
  var o = opts || {};
  var inp = veFeadScnInputs(build);
  var sys = build.sys, notlar = [];

  // Geometri: açıklık boyları ve kayış birim kütlesi frekans için gerekli.
  var rel = Number.isFinite(o.relDeg) ? o.relDeg : FEADCore.meanRel(sys);
  var geom, mPrime, v1;
  try {
    geom = FEADCore.tensionerState(sys, rel).geom;
    mPrime = FEADCore.massPerM(sys);
    v1 = FEADCore.beltSpeed(sys, 1);                 // kayış hızı devirde doğrusal
  } catch(e){ return null; }
  if(!(mPrime > 0) || !(v1 > 0)) return null;
  var spanL = geom.spans.map(function(s){ return s.L; });
  var adlar = geom.spans.map(function(s, i){
    return geom.names[i] + '→' + geom.names[(i+1) % geom.names.length];
  });

  // ── Devir ızgarası: A(N) ve B(N) ──────────────────────────────────────────
  // T(N, α) = A + α·B  (tam; dosya başındaki ölçüm). İki çekirdek çağrısı
  // ızgara noktası başına, kare başına SIFIR.
  var J = veFeadScnInertias(build);
  var gRpm = [], gA = [], gB = [];
  var lo = Math.max(VE_FEAD_SCN_MIN_RPM, inp.crankRpm * 0.4);
  var hi = inp.peakRpm;
  for(var g = 0; g < VE_FEAD_SCN_GRID_N; g++){
    var N = lo + (hi - lo) * g / (VE_FEAD_SCN_GRID_N - 1);
    var kwN = veFeadScnLoadsAt(build, N, inp.idleRpm);
    var a0, a1;
    try {
      a0 = FEADCore.peakEstimate(sys, { engineRpm: N, accelRpmS: 0, loadsKw: kwN, inertias: J }).accel.spanN;
      a1 = FEADCore.peakEstimate(sys, { engineRpm: N, accelRpmS: 1, loadsKw: kwN, inertias: J }).accel.spanN;
    } catch(e){ return null; }
    gRpm.push(N); gA.push(a0); gB.push(a1.map(function(x, i){ return x - a0[i]; }));
  }

  // ── Rampa şekli ───────────────────────────────────────────────────────────
  // α(N) ∝ hızlandırmaya KALAN TORK = T_motor(N) − T_aksesuar(N) [Nm].
  //
  // İLK YAZIMDA BURASI ORANDI — (Tm − Tacc)/Tm — ve bu SESSİZCE ETKİSİZDİ:
  // aksesuar torku motor torkunun yanında küçük olduğu için oran her devirde
  // ~1 çıkıyor, en büyüğüne bölününce şekil tamamen düzleşiyordu. ÖLÇÜLDÜ:
  // hızlanma süresi doğrusala göre %0.2 fark ediyordu ve faz içinde α en
  // büyük/en küçük oranı 1.00 — yani "tork eğrisinden şekillendirildi" diyen
  // bir kod hiçbir şey şekillendirmiyordu. Düşüşü sert bir motorda (ISM11 425,
  // son/tepe 0.69) bile fark %0.1'di.
  //
  // Doğrusu MUTLAK torkla çalışmak: ISB6.7'nin torku 800 d/dk'da 670 Nm,
  // platoda 1100 Nm — yani rölanti civarında hızlanma platodakinin %61'i.
  // Şekil oradan geliyor, büyüklük ise kullanıcının ilan ettiği ivmeden.
  function wAt(N){
    if(!inp.curve) return 1;
    var Tm = veFeadScnTorqueAt(inp.curve, N);
    if(!Number.isFinite(Tm) || !(Tm > 0)) return 1;
    // Aksesuarın çektiği tork: P = T·ω → T = P/ω, krank devrinde.
    var kwT = 0, kwN = veFeadScnLoadsAt(build, N, inp.idleRpm);
    Object.keys(kwN).forEach(function(k){ kwT += kwN[k]; });
    var om = 2 * Math.PI * N / 60;
    var Tacc = (om > 0) ? (kwT * 1000 / om) : 0;
    return Math.max(1e-3, Tm - Tacc);              // [Nm] — MUTLAK, oran DEĞİL
  }
  var wMax = 0, wq = [];
  for(var q = 0; q <= 40; q++){
    var Nq = inp.idleRpm + (inp.peakRpm - inp.idleRpm) * q / 40;
    var wv = wAt(Nq); wq.push({ rpm: Nq, w: wv });
    if(wv > wMax) wMax = wv;
  }
  if(!(wMax > 0)) wMax = 1;
  // Hızlanma süresi: dt = dN / (accel·w/wMax) — sayısal integral.
  var tAcc = 0;
  for(var q2 = 1; q2 < wq.length; q2++){
    var dN = wq[q2].rpm - wq[q2-1].rpm;
    var wm = 0.5 * (wq[q2].w + wq[q2-1].w) / wMax;
    tAcc += dN / (inp.accelRpmS * Math.max(0.05, wm));
  }
  var tDec = (inp.peakRpm - inp.idleRpm) / inp.decelRpmS;

  // ── Faz zaman çizelgesi ───────────────────────────────────────────────────
  var fazlar = [], t = 0;
  VE_FEAD_SCN_PLAN.forEach(function(P){
    var s = P.s;
    if(P.k === 'accel') s = tAcc;
    if(P.k === 'decel') s = tDec;
    var r0, r1;
    switch(P.k){
      case 'off':   r0 = 0; r1 = 0; break;
      case 'crank': r0 = 0; r1 = inp.crankRpm; break;
      case 'fire':  r0 = inp.crankRpm; r1 = inp.idleRpm; break;
      case 'idle':
      case 'idle2': r0 = inp.idleRpm; r1 = inp.idleRpm; break;
      case 'accel': r0 = inp.idleRpm; r1 = inp.peakRpm; break;
      case 'hold':  r0 = inp.peakRpm; r1 = inp.peakRpm; break;
      case 'decel': r0 = inp.peakRpm; r1 = inp.idleRpm; break;
      case 'stop':  r0 = inp.idleRpm; r1 = 0; break;
    }
    fazlar.push({ k: P.k, ad: P.ad, t0: t, t1: t + s, r0: r0, r1: r1 });
    t += s;
  });
  var T = t;

  // ── Zaman ızgarası (t → devir, ivme) ──────────────────────────────────────
  // Hızlanma fazının içi tork şekline göre; kalanı doğrusal.
  function rpmAtAccel(u){                       // u ∈ [0,1] faz içi zaman oranı
    var hedef = u * tAcc, acc = 0;
    for(var i2 = 1; i2 < wq.length; i2++){
      var dN2 = wq[i2].rpm - wq[i2-1].rpm;
      var wm2 = 0.5 * (wq[i2].w + wq[i2-1].w) / wMax;
      var dt2 = dN2 / (inp.accelRpmS * Math.max(0.05, wm2));
      if(acc + dt2 >= hedef)
        return wq[i2-1].rpm + dN2 * ((hedef - acc) / dt2);
      acc += dt2;
    }
    return inp.peakRpm;
  }
  var n = Math.max(8, Math.round(T * VE_FEAD_SCN_HZ)) + 1;
  var ts = [], rpms = [], als = [];
  for(var s2 = 0; s2 < n; s2++){
    var tt = T * s2 / (n - 1), f = fazlar[fazlar.length - 1];
    for(var fi = 0; fi < fazlar.length; fi++)
      if(tt <= fazlar[fi].t1){ f = fazlar[fi]; break; }
    var span = f.t1 - f.t0, u2 = (span > 0) ? (tt - f.t0) / span : 0;
    u2 = Math.max(0, Math.min(1, u2));
    var N2 = (f.k === 'accel') ? rpmAtAccel(u2) : (f.r0 + (f.r1 - f.r0) * u2);
    ts.push(tt); rpms.push(N2);
  }
  for(var s3 = 0; s3 < n; s3++){
    var i0 = Math.max(0, s3 - 1), i1 = Math.min(n - 1, s3 + 1);
    var dt3 = ts[i1] - ts[i0];
    als.push(dt3 > 0 ? (rpms[i1] - rpms[i0]) / dt3 : 0);
  }

  if(!inp.curve)
    notlar.push('Rampa DOĞRUSAL: motor katalogtan seçilmedi, tork eğrisi yok.');
  else
    notlar.push('Rampa şekli motorun tam yük tork eğrisinden; büyüklüğü ivme alanından.');
  notlar.push('Devir geçmişi DAYATILMIŞ — krank dinamiği simüle EDİLMİYOR (volan ataleti yok).');
  notlar.push('Marş devri ' + inp.crankRpm + ' d/dk ve yavaşlama sabit: MFSim\'de marş ve motor freni verisi yok.');
  if(inp.kaynak.accelVarsayilan)
    notlar.push('İvme girilmemiş, ' + VE_FEAD_SCN_ACCEL_DEF + ' d/dk/s varsayıldı.');
  notlar.push('Gergi kolu dinamiği DAHİL DEĞİL (çekirdeğin peakEstimate sınırı).');

  var r4 = function(v){ return Math.round(v * 1e4) / 1e4; };
  return {
    v: VE_FEAD_SCN_VERSION, T: r4(T),
    idle: inp.idleRpm, peak: inp.peakRpm, crank: inp.crankRpm,
    accel: inp.accelRpmS, decel: inp.decelRpmS, cyl: inp.cylinders,
    ph: fazlar.map(function(f){
      return { k: f.k, ad: f.ad, t0: r4(f.t0), t1: r4(f.t1) };
    }),
    t: ts.map(function(x){ return Math.round(x * 1e3) / 1e3; }),
    rpm: rpms.map(function(x){ return Math.round(x * 10) / 10; }),
    al: als.map(function(x){ return Math.round(x * 10) / 10; }),
    gRpm: gRpm.map(r4), gA: gA.map(function(a){ return a.map(r4); }),
    gB: gB.map(function(b){ return b.map(function(x){ return Math.round(x * 1e6) / 1e6; }); }),
    L: spanL.map(r4), adlar: adlar, mPrime: r4(mPrime), v1: Math.round(v1 * 1e8) / 1e8,
    Td: r4(sys.designTensionN),
    notlar: notlar, egri: !!inp.curve, peakSrc: inp.kaynak.peak
  };
}

// ── ANİMATÖRÜN KARE BAŞINA ÇAĞIRDIĞI TEK FONKSİYON ─────────────────────────
// SAF SAYI: çekirdek yok, DOM yok, çözücü yok. Yükün kendisiyle çalışır,
// dolayısıyla JSON'dan geri okunmuş bir senaryoyla da aynı sonucu verir.
function veFeadScnStateAt(scn, t){
  if(!scn || !Array.isArray(scn.t) || !scn.t.length) return null;
  var T = scn.T > 0 ? scn.T : 1;
  var tt = ((t % T) + T) % T;                       // senaryo döngüsel oynar

  // Zaman ızgarasında doğrusal aradeğerleme (ızgara eşit aralıklı).
  var n = scn.t.length, u = tt / T * (n - 1);
  var i = Math.min(n - 2, Math.max(0, Math.floor(u))), fr = u - i;
  var rpm = scn.rpm[i] + (scn.rpm[i+1] - scn.rpm[i]) * fr;
  var al  = scn.al[i]  + (scn.al[i+1]  - scn.al[i])  * fr;

  var faz = scn.ph[scn.ph.length - 1];
  for(var p = 0; p < scn.ph.length; p++)
    if(tt <= scn.ph[p].t1){ faz = scn.ph[p]; break; }

  var v = scn.v1 * rpm;                              // kayış hızı [m/s]
  var fire = rpm * scn.cyl / 120;                    // 4 zamanlı ateşleme [Hz]

  // Gerilme: devir ızgarasında A ve B aradeğerlenir, sonra T = A + α·B.
  var gN = scn.gRpm, m = gN.length;
  var j = 0;
  if(rpm <= gN[0]) j = 0;
  else if(rpm >= gN[m-1]) j = m - 2;
  else { while(j < m - 2 && gN[j+1] < rpm) j++; }
  var gd = gN[j+1] - gN[j];
  var w = (gd > 0) ? Math.max(0, Math.min(1, (rpm - gN[j]) / gd)) : 0;
  // IZGARANIN ALTINDA — kayış hızı sıfıra giderken ızgaranın en alt noktasını
  // KENETLEMEK yanlış olurdu: duran kayışta aksesuar yükü yok, gerilme tasarım
  // gerginliğidir. Yük kuralı (T ∝ N ⇒ kuvvet ∝ N) tam olarak bunu söylüyor,
  // yani tasarımdan SAPMA da devirle orantılı sönmeli.
  // ÖLÇÜLDÜ: kenetlemeyle durgun kayış 798.6 N görünüyordu (tasarım 766).
  var alt = (rpm < gN[0] && gN[0] > 0) ? Math.max(0, rpm / gN[0]) : 1;
  var Td = Number.isFinite(scn.Td) ? scn.Td : 0;

  var spanN = [], spanF = [], k;
  for(k = 0; k < scn.L.length; k++){
    var A = scn.gA[j][k] + (scn.gA[j+1][k] - scn.gA[j][k]) * w;
    if(alt < 1) A = Td + (A - Td) * alt;
    var B = scn.gB[j][k] + (scn.gB[j+1][k] - scn.gB[j][k]) * w;
    var Tk = A + al * B;
    spanN.push(Tk);
    // Eksenel hareketli tel: f1 = (c² − v²)/(2Lc). Kayış gevşerse (T ≤ 0)
    // ya da dalga hızı kayış hızının altına düşerse duran dalga YOKTUR.
    var c = Math.sqrt(Math.max(Tk, 0) / scn.mPrime);
    var L = scn.L[k] / 1000;
    spanF.push((c > v && L > 0) ? (c*c - v*v) / (2 * L * c) : 0);
  }
  return {
    t: tt, faz: faz.k, fazAd: faz.ad, rpm: rpm, alpha: al,
    beltMs: v, firingHz: fire, spanN: spanN, spanF: spanF,
    Tmin: Math.min.apply(null, spanN), Tmax: Math.max.apply(null, spanN)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_SCN_VERSION: VE_FEAD_SCN_VERSION,
    VE_FEAD_SCN_CRANK_RPM: VE_FEAD_SCN_CRANK_RPM,
    VE_FEAD_SCN_ACCEL_DEF: VE_FEAD_SCN_ACCEL_DEF,
    VE_FEAD_SCN_IDLE_DEF: VE_FEAD_SCN_IDLE_DEF,
    VE_FEAD_SCN_PEAK_DEF: VE_FEAD_SCN_PEAK_DEF,
    VE_FEAD_SCN_HZ: VE_FEAD_SCN_HZ,
    VE_FEAD_SCN_GRID_N: VE_FEAD_SCN_GRID_N,
    VE_FEAD_SCN_MIN_RPM: VE_FEAD_SCN_MIN_RPM,
    VE_FEAD_SCN_PLAN: VE_FEAD_SCN_PLAN,
    veFeadScnTorqueAt: veFeadScnTorqueAt,
    veFeadScnInputs: veFeadScnInputs,
    veFeadScnLoadsAt: veFeadScnLoadsAt,
    veFeadScnInertias: veFeadScnInertias,
    veFeadScenarioBuild: veFeadScenarioBuild,
    veFeadScnStateAt: veFeadScnStateAt
  };
}
