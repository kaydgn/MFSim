/* =========================================================================
 * fead-core.js  v2.0 — FEAD (Front End Accessory Drive) hesap çekirdeği
 * =========================================================================
 * Gates AG00686 (4 kasnak) ve AG00976'nın dört revizyonu (6 kasnak) ile
 * sayısal olarak doğrulanmıştır. Bağımlılık yok.
 *
 *   Tarayıcı : <script src="fead-core.js"></script>  ->  window.FEADCore
 *   Node.js  : const FEADCore = require('./fead-core.js');
 *
 * ----------------------------------------------------------------- BİRİMLER
 *   uzunluk mm · kuvvet N · tork Nm · güç kW · açı derece (API), rad (iç)
 *   hubload yönü: +x'ten CCW, 0..360 (Gates pusula konvansiyonu)
 *
 * ------------------------------------------------------------ KONVANSİYONLAR
 * 1) KASNAK SIRASI = KAYIŞIN GİDİŞ YÖNÜ.
 *    Yerleşim çiziminden okunduğu gibi girilir. Gates raporlarının
 *    "Layout Data" sırası da budur.
 *
 * 2) span[i] = kasnak i'den kasnak i+1'e giden serbest kayış parçası,
 *    yani i'nin ÇIKIŞ spanı. Gates her kasnak satırında o kasnağın çıkış
 *    spanının boyunu ve gerilmesini raporlar; perPulley[i] birebir örtüşür.
 *
 * 3) Gerilme, gidiş yönünde her yük kasnağında AZALIR, sürücüde ARTAR.
 *    Ankraj gergi kasnağıdır: T[gergi] = designTension (slack).
 *    Sürücünün gücü, diğer tüm kasnakların güçlerinin toplamıdır (çevrim
 *    kapanır); loadsKw içinde sürücü için değer verilirse tutarlılık
 *    kontrol edilir.
 *
 * 3b) TEMAS TARAFI (grooved/back) BİR GİRDİDİR, çıkarsanamaz. Ters
 *    verilirse kod BAŞKA BİR GEÇERLİ güzergâh hesaplar (kapalı çevrim ve
 *    sarım değişmezi yine tutar) — sessizce yanlış tasarım. Bu alan mutlaka
 *    yerleşim çizimiyle karşılaştırılmalıdır. Sarım değişmezi kasnak SIRASI
 *    hatalarını, checkClearance() ise yolun kasnak içinden geçmesini yakalar.
 *
 * 4) ÇAP KATMANI (Gates "Layout Data" tablosuyla doğrulandı):
 *      kaburgalı : rPitch = OD/2 + hb        rEff = OD/2
 *      sırttan   : rPitch = OD/2 + hr        rEff = OD/2 + hr + hb
 *    hb = effective line difference, hr = back height (BELT_DB).
 *    Teğet geometrisi ve hız oranları pitch, kayış boyu effective üzerinden.
 *    Özdeşlik: Lpitch - Leff = 2*pi*hb (kapalı çevrim, layout'tan bağımsız).
 *
 * 5) GERGİ KOL AÇISI birincil olarak GÖRELİ verilir: rel = 0 serbest kol,
 *    artan rel = yaya yüklenme yönü. Yay torku = önYük + rate*rel.
 *    Mutlak açı = freeAngleDeg + sense*rel; sense verilmezse otomatik
 *    bulunur (kayış boyunun kısaldığı yön). Gates'in "Relative"/"Absolute"
 *    satırları birebir bu ikilidir.
 *
 * 6) GERGİ DENGESİ sanal iş ile: T = M / (dL/dtheta),
 *      dL/dtheta = r_kol * sin(beta) * 2 sin(phi/2)
 *    Gates'in "Belt Takeup / Tensioner Arm Ratio" değeri tam olarak bu
 *    türevdir (mm/derece); "Hubload to Arm Angle" ise beta'dır.
 *
 * --------------------------------------------------------- KALİBRASYON NOTU
 * Sabitlerin izlenebilirliği için CALIBRATION nesnesine bakınız. Kaynağı
 * belirsiz hiçbir sayı bu dosyada gömülü değildir.
 * ========================================================================= */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.FEADCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEG = Math.PI / 180;
  const TWO_PI = 2 * Math.PI;

  /* ==================================================== 0) SABİT KÜTÜPHANE */

  /* Kayış profil sabitleri.
   * hb = effective line difference [mm], hr = back height [mm]
   * massPerRibKgM = kaburga başına birim kütle [kg/m]
   * Kaynak: KIRPI II 'Kayışlar' sayfası (üretici katalogları).
   * UYARI: Gates PK için katalog kütlesi 0.0144 kg/m/kaburga, ancak
   *   (a) kesit tahmini 8*3.56mm x 4.6mm x ~1200 kg/m3 -> 0.157 kg/m (8PK)
   *   (b) AG00686 frekans haritasindan geri-hesap    -> 0.157 kg/m (8PK)
   *   ikisi de ~0.0196 kg/m/kaburga veriyor. Frekans hesabi icin
   *   massPerRibKgM'i acikca gecmek (veya belt.massPerM vermek) onerilir. */
  const BELT_DB = {
    PK: {
      GATES:     { hb: 1.2, hr: 1.1, ribPitch: 3.56, thickness: 4.6, minPulleyDia: 45, maxSpeedMs: 50, massPerRibKgM: 0.0144, cordStiffnessNPerRib: 11000 },
      OPTIBELT:  { hb: 1.6, hr: 1.1, ribPitch: 3.56, thickness: 4.6, minPulleyDia: 45, maxSpeedMs: 50, massPerRibKgM: 0.021 },
      CONTITECH: { hb: 1.5, hr: 1.5, ribPitch: 3.56, thickness: 5.0, minPulleyDia: 45, maxSpeedMs: 50, massPerRibKgM: 0.021 },
    },
    PJ: {
      OPTIBELT:  { hb: 1.25, hr: 1.1, ribPitch: 2.34, thickness: 3.3, minPulleyDia: 20, maxSpeedMs: 60, massPerRibKgM: 0.009 },
      CONTITECH: { hb: 1.2,  hr: 1.1, ribPitch: 2.34, thickness: 3.8, minPulleyDia: 20, maxSpeedMs: 60, massPerRibKgM: 0.009 },
    },
    PH: {
      OPTIBELT:  { hb: 0.8, hr: 1.0, ribPitch: 1.6, thickness: 2.5, minPulleyDia: 13, maxSpeedMs: 60, massPerRibKgM: 0.005 },
      CONTITECH: { hb: 0.8, hr: 1.0, ribPitch: 1.6, thickness: 2.7, minPulleyDia: 13, maxSpeedMs: 60, massPerRibKgM: 0.005 },
    },
    PL: {
      OPTIBELT:  { hb: 3.5, hr: 1.5, ribPitch: 4.7, thickness: 7.0, minPulleyDia: 75, maxSpeedMs: 40, massPerRibKgM: 0.037 },
      CONTITECH: { hb: 3.0, hr: 1.5, ribPitch: 4.7, thickness: 7.5, minPulleyDia: 75, maxSpeedMs: 40, massPerRibKgM: 0.037 },
    },
    PM: {
      OPTIBELT:  { hb: 5.0, hr: 2.0, ribPitch: 9.4, thickness: 13.0, minPulleyDia: 180, maxSpeedMs: 30, massPerRibKgM: 0.12 },
      CONTITECH: { hb: 4.0, hr: 2.0, ribPitch: 9.4, thickness: 14.5, minPulleyDia: 180, maxSpeedMs: 35, massPerRibKgM: 0.12 },
    },
  };

  /* Kalibre edilmiş / varsayılan sabitler — her birinin kaynağı yazılı. */
  const CALIBRATION = {
    tensionerArmInertiaKgM2: {
      value: null, byGatesVersion: null,        // TEK EVRENSEL DEGER YOK
      measured: { 'T38624': { armKgM2: 0.0076, pulleyKg: 0.50 },
                  'E9843':  { armKgM2: 0.0009, pulleyKg: 0.80 } },
      note: 'Raporun "Natural Frequency" degeri BIZIM tensionerMode() ' +
            'modelimizle uretilemez. Kanit: (a) ayni Gates surumunde (v9.40) ' +
            'AG00686 -> 11.87 Hz, AG00894 -> 22.46 Hz; ima edilen J 4.97e-3 vs ' +
            '1.37e-3, yani surum hipotezi de CURUK. (b) Raporun kendi verdigi ' +
            'kol ataleti ile f = sqrt(k/J)/(2pi) tutmuyor: AG00686 9.59 vs ' +
            '11.87 Hz (%-19), AG0868 28.4 vs 45.6 Hz (%-38). (c) Raporun ' +
            '"System Vibration Analysis" sayfasi KRANK ATALETI, silindir ' +
            'sayisi ve TUM aksesuar ataletlerini girdi olarak listeliyor -> ' +
            'bu, kayis spanlariyla kuplajli COK SERBESTLIK DERECELI bir ' +
            'burulma modu, tek serbestlik dereceli kol modu degil. ' +
            'tensionerMode() sadece KOL MODU tahmini verir ve raporun ' +
            'Natural Frequency degeriyle KARSILASTIRILMAMALIDIR. ' +
            'measured: raporlardan okunan gercek kol ataletleri.',
    },
    muEffGrooved: {
      value: 0.90,
      note: 'AG00976 "Belt Slip Safety Factor" grafiginden geri-okuma (A_C ve ' +
            'ALT egrilerinden bagimsiz olarak ~0.88-0.90). GRAFIK OKUMASI, ' +
            'kesin degil. mu/sin(alpha/2) seklindeki V-kayis kama faktoru PK ' +
            'icin GECERSIZDIR (~1.17 verir, fazla iyimser).',
    },
    muBackside: {
      value: 0.35,
      note: 'Tipik lastik-metal degeri. Kalibre EDILMEDI; duz kasnaklarda ' +
            'gerilme orani ~1 oldugu icin sonuca etkisi ihmal edilebilir.',
    },
    fleetingLimitDeg: {
      value: 0.90,
      note: 'AG00976 "Permissible Grooved Pulley Axial Offset Allowance / For ' +
            '0.90 Belt Entry Angle" basligindan. Duz kasnak acisal kacikligi ' +
            '-> eksenel ofset donusumu HENUZ KALIBRE EDILMEDI.',
    },
    lengthOffsetMm: {
      value: 0,
      note: 'requiredBeltMm = driveLenMm - lengthOffsetMm. Dogru tanim: ' +
            'lengthOffsetMm = EDL(Mean) - L_nominal. AG00976 x4 icin ' +
            '0.0 / 1.9 / 1.9 / 1.2 mm; bu degerle Replace/Max/Min konumlari ' +
            'Gates ile <0.07 derece ortusuyor. Gerilmeyle olceklenmiyor ' +
            '(elastik uzama DEGIL); kurali bilinmiyor -> tasarim basina girdi. ' +
            'calibrateLengthOffset(sys,{relDeg,beltLengthMm}) ile bulunur. ' +
            'NOT: raporun bastigi "Required Eff. Belt Length" kolonu bundan ' +
            '0-0.4 mm daha kucuktur; konum cozumu icin EDL tabanli tanim gecerlidir.',
    },
    torsional: {
      cordStiffnessNPerRib: 11000, beltFactor: 0.0,
      note: 'Burulma modeli (torsionalModel) sabitleri. Gates "System ' +
            'Resonance (Mode 1)" degerlerine 6 sistemde kalibre edildi ' +
            '(AG00686 x2, AG0868 4/6/8PK, AG00810; 4-10 kaburga, uc farkli ' +
            'tahrik): RMS %8.4, en buyuk sapma %16.9 (AG00810). Kaburga ' +
            'olceklemesi doğru cikiyor: AG0868 ailesinde model 29.3/35.8/41.2 ' +
            'Hz, Gates 28.3/37.6/45.6 Hz. beltFactor=0 -> kavis payi yok, yani ' +
            'kayis yalnizca SERBEST span boyunca uzuyor (kasnakta kaymiyor); ' +
            'tez 0.5 kullaniyor, Gates verisi 0 istiyor. 8PK icin Kb = 88 kN; ' +
            'kayis uzamasindan geri-hesaplanan EA (140-320 kN, +-%50 sacilma) ' +
            'ile ayni mertebede ama daha dusuk. DETERMINISTIK DEGIL: %8 ' +
            'seviyesindeki bir kalibre model, %0.33 olan statik zincirle ayni ' +
            'guven duzeyinde degildir.',
    },
    fatigue: { note: 'FATIGUE nesnesine ve beltLifeB10() fonksiyonuna bakiniz.' },
  };

  /* ------------------------------------------------------------ vektörler */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, s) => [a[0] * s, a[1] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const norm = (a) => Math.hypot(a[0], a[1]);
  const angOf = (a) => Math.atan2(a[1], a[0]);
  const unit = (t) => [Math.cos(t), Math.sin(t)];
  const rotM90 = (u) => [u[1], -u[0]];
  const mod360 = (d) => ((d % 360) + 360) % 360;

  /* Bracket kontrollü ikiye bölme. Kök kuşatılmamışsa AÇIKÇA hata verir —
   * v1'de bu kontrol yoktu ve sessizce uç noktayı döndürüyordu. */
  function bisect(fn, target, lo, hi, opt = {}) {
    const { iters = 100, label = 'bisect', tol = 1e-10 } = opt;
    const flo = fn(lo), fhi = fn(hi);
    let fa = flo - target;
    const fb = fhi - target;
    if (!isFinite(fa) || !isFinite(fb))
      throw new Error(`FEADCore/${label}: uc noktalarda cozum tanimsiz`);
    if (fa * fb > 0)
      throw new Error(
        `FEADCore/${label}: hedef ${target} erisilebilir araligin disinda ` +
        `[${Math.min(flo, fhi).toFixed(4)} .. ${Math.max(flo, fhi).toFixed(4)}] ` +
        `(arama araligi ${lo}..${hi})`);
    let a = lo, b = hi;
    for (let k = 0; k < iters; k++) {
      const m = 0.5 * (a + b), fm = fn(m) - target;
      if (Math.abs(fm) < tol || (b - a) < 1e-12) return m;
      if (fa * fm <= 0) { b = m; } else { a = m; fa = fm; }
    }
    return 0.5 * (a + b);
  }

  /* ==================================================== 1) ÇAP KATMANI */

  function beltProps(belt) {
    if (belt.hb != null && belt.hr != null) return belt;
    const prof = BELT_DB[(belt.profile || 'PK').toUpperCase()];
    if (!prof) throw new Error(`FEADCore: bilinmeyen kayis profili "${belt.profile}"`);
    const brand = prof[(belt.brand || 'GATES').toUpperCase()];
    if (!brand) throw new Error(
      `FEADCore: "${belt.profile || 'PK'}" profilinde "${belt.brand}" markasi yok ` +
      `(mevcut: ${Object.keys(prof).join(', ')})`);
    if (brand.hb == null || brand.hr == null) throw new Error(
      `FEADCore: ${belt.profile}/${belt.brand} icin hb/hr katalogda yok; ` +
      `belt.hb ve belt.hr elle verilmeli`);
    return Object.assign({}, brand, belt);
  }

  function radiiFromOD(od, contact, bp) {
    if (contact === 'grooved') return { rPitch: od / 2 + bp.hb, rEff: od / 2 };
    if (contact === 'back')    return { rPitch: od / 2 + bp.hr, rEff: od / 2 + bp.hr + bp.hb };
    throw new Error(`FEADCore: contact "grooved" veya "back" olmali, "${contact}" geldi`);
  }

  /* ==================================================== 2) GEOMETRİ */

  function loopSense(centers) {                       // +1 CCW, -1 CW
    let s = 0;
    for (let i = 0; i < centers.length; i++) {
      const a = centers[i], b = centers[(i + 1) % centers.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return s >= 0 ? +1 : -1;
  }

  function tangent(ci, ri, di, cj, rj, dj, nmI, nmJ) {
    const w = sub(cj, ci), d = norm(w);
    const rho = ri * di - rj * dj;
    if (d <= Math.abs(rho))
      throw new Error(
        `FEADCore/geometri: ${nmI}-${nmJ} arasi teget cozulemedi ` +
        `(merkez mesafesi ${d.toFixed(1)} mm, gerekli >${Math.abs(rho).toFixed(1)} mm). ` +
        `Kasnaklar cakisiyor veya temas taraflari (grooved/back) yanlis.`);
    const L = Math.sqrt(d * d - rho * rho);
    for (const s of [+1, -1]) {
      const A = angOf(w) + s * Math.atan2(rho, L);
      const u = unit(A);
      const Pi = add(ci, mul(rotM90(u), ri * di));
      const Pj = add(cj, mul(rotM90(u), rj * dj));
      const seg = sub(Pj, Pi);
      if (Math.abs(norm(seg) - L) < 1e-6 * Math.max(1, L) && dot(seg, u) > 0)
        return { L, u, Pi, Pj };
    }
    throw new Error(`FEADCore/geometri: ${nmI}-${nmJ} tegeti icin kok bulunamadi`);
  }

  /* resolved: [{name, c:[x,y], rPitch, rEff, contact}] — KAYIŞ GİDİŞ SIRASINDA */
  function solveGeometry(resolved) {
    const n = resolved.length;
    if (n < 3) throw new Error('FEADCore: en az 3 kasnak gerekli');
    const s = loopSense(resolved.map(p => p.c));
    const ps = resolved.map(p => Object.assign({}, p,
      { d: (p.contact === 'grooved' ? s : -s) }));

    const spans = [];
    for (let i = 0; i < n; i++) {
      const a = ps[i], b = ps[(i + 1) % n];
      spans.push(tangent(a.c, a.rPitch, a.d, b.c, b.rPitch, b.d, a.name, b.name));
    }
    const wraps = [], names = [];
    let Leff = 0, Lpitch = 0, signedWrapDeg = 0;
    for (let i = 0; i < n; i++) {
      const p = ps[i];
      const aIn = angOf(sub(spans[(i - 1 + n) % n].Pj, p.c));
      const aOut = angOf(sub(spans[i].Pi, p.c));
      let wr = (p.d * (aOut - aIn)) % TWO_PI;
      if (wr < 0) wr += TWO_PI;
      wraps.push(wr); names.push(p.name);
      Leff += wr * p.rEff; Lpitch += wr * p.rPitch;
      signedWrapDeg += (p.contact === 'grooved' ? +1 : -1) * wr / DEG;
    }
    for (const sp of spans) { Leff += sp.L; Lpitch += sp.L; }

    /* Kapalı çevrim değişmezi: işaretli sarım toplamı tam 360 olmalı. */
    if (Math.abs(Math.abs(signedWrapDeg) - 360) > 0.05)
      throw new Error(
        `FEADCore/geometri: isaretli sarim toplami ${signedWrapDeg.toFixed(2)} ` +
        `(360 olmali). Kasnak sirasi kayis gidis yonunde mi, temas taraflari ` +
        `(grooved/back) dogru mu?`);

    const geom = {
      pulleys: ps, spans, wraps, names, sense: s, signedWrapDeg,
      LeffMm: Leff, LpitchMm: Lpitch,
      exitSpanLen: (i) => spans[i].L,                       // Gates satırı
      entrySpanLen: (i) => spans[(i - 1 + n) % n].L,
      wrapDeg: (i) => wraps[i] / DEG,
      indexOf: (nm) => names.indexOf(nm),
    };
    const clash = checkClearance(geom);
    if (clash.length) throw new Error(
      'FEADCore/geometri: kayis yolu kasnaklarin icinden geciyor -> ' +
      clash.map(c => `${c.span} spani ${c.pulley} kasnagini ` +
        `${(-c.clearanceMm).toFixed(1)} mm kesiyor`).join('; ') +
      '. Temas taraflari (grooved/back) ve kasnak sirasi kontrol edilmeli.');
    geom.clearance = clash;
    return geom;
  }

  /* Serbest spanların, kendi teğet kasnakları dışındaki kasnakların pitch
   * çemberini kesip kesmediğini denetler. Sarım değişmezi kasnak SIRASI
   * hatalarını yakalar ama TEMAS TARAFI (grooved/back) hatalarını
   * yakalamaz: yanlış taraf da kapalı ve tutarlı bir çevrim üretir.
   * Bu kontrol onu yakalar — yol fiziksel olarak bir kasnağın içinden geçer. */
  function checkClearance(geom, opt) {
    opt = opt || {};
    const marginMm = opt.marginMm != null ? opt.marginMm : 0.05;
    const n = geom.pulleys.length, out = [];
    geom.spans.forEach((sp, i) => {
      const a = sp.Pi, b = sp.Pj, ab = sub(b, a), L2 = dot(ab, ab);
      geom.pulleys.forEach((p, k) => {
        if (k === i || k === (i + 1) % n) return;            // kendi teğet kasnakları
        const ap = sub(p.c, a);
        const t = Math.max(0, Math.min(1, L2 > 0 ? dot(ap, ab) / L2 : 0));
        const d = norm(sub(p.c, add(a, mul(ab, t))));
        if (d < p.rPitch - marginMm) out.push({
          span: `${geom.names[i]}->${geom.names[(i + 1) % n]}`,
          pulley: p.name, clearanceMm: d - p.rPitch,
        });
      });
    });
    return out;
  }

  /* ==================================================== 3) SİSTEM */

  function makeSystem(cfg) {
    const sys = JSON.parse(JSON.stringify(cfg));
    if (!Array.isArray(sys.pulleys) || !sys.pulleys.length)
      throw new Error('FEADCore: pulleys dizisi gerekli');
    sys.belt = sys.belt || {};
    sys._bp = beltProps(sys.belt);

    sys._crkIdx = sys.pulleys.findIndex(p => p.crank);
    sys._tenIdx = sys.pulleys.findIndex(p => p.tensioner);
    if (sys._crkIdx < 0) throw new Error('FEADCore: crank:true kasnak tanimlanmali');
    if (sys._tenIdx < 0) throw new Error('FEADCore: tensioner:true kasnak tanimlanmali');
    if (sys.pulleys.filter(p => p.crank).length > 1)
      throw new Error('FEADCore: birden fazla crank:true kasnak var');
    if (sys.pulleys.filter(p => p.tensioner).length > 1)
      throw new Error('FEADCore: birden fazla tensioner:true kasnak var (desteklenmiyor)');
    sys._n = sys.pulleys.length;
    sys.driveRatio = sys.driveRatio != null ? sys.driveRatio : 1;
    sys.lengthOffsetMm = sys.lengthOffsetMm != null
      ? sys.lengthOffsetMm : CALIBRATION.lengthOffsetMm.value;

    sys.pulleys.forEach((p, i) => {
      if (p.name == null) p.name = `P${i}`;
      if (p.rPitch == null || p.rEff == null) {
        if (p.od == null) throw new Error(
          `FEADCore: "${p.name}" kasnagi icin od (dis cap) veya rPitch/rEff gerekli`);
        Object.assign(p, radiiFromOD(p.od, p.contact, sys._bp));
      }
      if (!p.tensioner && (p.x == null || p.y == null))
        throw new Error(`FEADCore: "${p.name}" kasnagi icin x,y gerekli`);
    });

    const t = sys.tensioner;
    if (!t) throw new Error('FEADCore: tensioner blogu gerekli');
    for (const k of ['pivot', 'armLength', 'preloadNm', 'rateNmPerDeg', 'freeAngleDeg'])
      if (t[k] == null) throw new Error(`FEADCore: tensioner.${k} gerekli`);

    /* kol dönüş yönü: verilmemişse kayış boyunun kısaldığı yön */
    if (t.sense == null) {
      const probe = (sg) => {
        t.sense = sg;
        try { return geometryAt(sys, 3).LeffMm; } catch (e) { return NaN; }
      };
      const Lp = probe(+1), Lm = probe(-1);
      t.sense = +1;
      const L0 = geometryAtRaw(sys, t.freeAngleDeg).LeffMm;
      if (isFinite(Lp) && isFinite(Lm)) t.sense = (Lp < L0) ? +1 : -1;
      else t.sense = isFinite(Lp) ? +1 : -1;
      sys._senseAuto = true;
    }
    sys._cache = {};
    return sys;
  }

  const armAbsDeg = (sys, rel) => sys.tensioner.freeAngleDeg + sys.tensioner.sense * rel;
  const tenCenterAbs = (sys, absDeg) =>
    add(sys.tensioner.pivot, mul(unit(absDeg * DEG), sys.tensioner.armLength));
  const tenCenter = (sys, rel) => tenCenterAbs(sys, armAbsDeg(sys, rel));
  const springTorque = (sys, rel) =>
    sys.tensioner.preloadNm + sys.tensioner.rateNmPerDeg * rel;

  function resolveAt(sys, center) {
    return sys.pulleys.map((p, i) => ({
      name: p.name, rPitch: p.rPitch, rEff: p.rEff, contact: p.contact,
      c: (i === sys._tenIdx) ? center : [p.x, p.y],
    }));
  }
  const geometryAtRaw = (sys, absDeg) =>
    solveGeometry(resolveAt(sys, tenCenterAbs(sys, absDeg)));
  const geometryAt = (sys, rel) => solveGeometry(resolveAt(sys, tenCenter(sys, rel)));

  /* ==================================================== 4) GERGİ DENGESİ */

  function tensionerState(sys, rel) {
    const g = geometryAt(sys, rel);
    const i = sys._tenIdx, n = sys._n;
    const uIn = g.spans[(i - 1 + n) % n].u, uOut = g.spans[i].u;
    const f = sub(uOut, uIn);                       // birim-T bileşke yönü
    const phi = g.wraps[i];
    const c = tenCenter(sys, rel);
    const armv = sub(sys.tensioner.pivot, c);       // merkez -> pivot
    const beta = Math.acos(Math.max(-1, Math.min(1,
      dot(f, armv) / (norm(f) * norm(armv)))));
    const dLdthRad = (sys.tensioner.armLength / 1000) * Math.sin(beta) * 2 * Math.sin(phi / 2);
    if (!(dLdthRad > 1e-9))
      throw new Error(
        `FEADCore/gergi: rel=${rel} konumunda take-up ~0 ` +
        `(sarim ${(phi / DEG).toFixed(2)} derece)`);
    const M = springTorque(sys, rel);
    const T = M / dLdthRad;
    return {
      relDeg: rel, absDeg: mod360(armAbsDeg(sys, rel)), geom: g, center: c,
      springNm: M, tensionN: T,
      hubloadN: 2 * T * Math.sin(phi / 2),
      hubDirDeg: mod360(angOf(f) / DEG),
      betaDeg: beta / DEG, wrapDeg: phi / DEG,
      takeupMmPerDeg: dLdthRad * 1000 * DEG,
      driveLenMm: g.LeffMm,
      requiredBeltMm: g.LeffMm - sys.lengthOffsetMm,
    };
  }

  const relMax = (sys) => sys.tensioner.loadStopRelDeg != null
    ? sys.tensioner.loadStopRelDeg : 89;

  /* Kolun fiziksel olarak ulaşabildiği en büyük göreli açı. Yük stopu
   * verilmemişse ya da stoptan önce geometri çözülemez hale geliyorsa
   * (sarım sıfıra iner, teğet kaybolur) sınır burada bulunur. */
  function feasibleRelMax(sys, hardMax) {
    const hi0 = hardMax != null ? hardMax : relMax(sys);
    const ok = (r) => { try { tensionerState(sys, r); return true; } catch (e) { return false; } };
    if (ok(hi0)) return hi0;
    let lo = 0, hi = hi0;
    if (!ok(lo)) throw new Error('FEADCore: serbest kol konumunda bile geometri cozulemiyor');
    for (let k = 0; k < 60; k++) { const m = 0.5 * (lo + hi); if (ok(m)) lo = m; else hi = m; }
    return lo;
  }

  function solveArmForBeltLength(sys, Lreq, opt = {}) {
    const hi = opt.hi != null ? opt.hi : feasibleRelMax(sys);
    const fn = (r) => -tensionerState(sys, r).requiredBeltMm;
    return bisect(fn, -Lreq, 0, hi, { label: 'solveArmForBeltLength', tol: 1e-7 });
  }
  function solveArmForTension(sys, TN, opt = {}) {
    const hi = opt.hi != null ? opt.hi : feasibleRelMax(sys);
    return bisect((r) => tensionerState(sys, r).tensionN, TN, 1e-6, hi,
      { label: 'solveArmForTension', tol: 1e-6 });
  }

  /* Boy ofsetini bilinen bir referanstan kalibre et.
   *   ref = { relDeg, beltLengthMm }  veya  { tensionN, beltLengthMm } */
  function calibrateLengthOffset(sys, ref) {
    const saved = sys.lengthOffsetMm;
    sys.lengthOffsetMm = 0;
    try {
      const rel = ref.relDeg != null ? ref.relDeg : solveArmForTension(sys, ref.tensionN);
      return tensionerState(sys, rel).driveLenMm - ref.beltLengthMm;
    } finally { sys.lengthOffsetMm = saved; }
  }

  /* Gates "Tensioner Geometry" tablosu.
   * Replace = L + tol + wear*L | Max = L + tol | Mean = L | Min = L - tol */
  function positionTable(sys) {
    const b = sys.belt, out = [];
    if (b.effLength == null) throw new Error('FEADCore: belt.effLength gerekli');
    const tol = b.tolerance || 0, wear = b.wearPct || 0;
    const hi = feasibleRelMax(sys);
    const push = (position, rel) => {
      try {
        const st = tensionerState(sys, rel);
        out.push({
          position, relDeg: rel, absDeg: st.absDeg,
          idlerX: st.center[0], idlerY: st.center[1],
          betaDeg: st.betaDeg, hubDirDeg: st.hubDirDeg,
          hubloadN: st.hubloadN, tensionN: st.tensionN, wrapDeg: st.wrapDeg,
          driveLenMm: st.driveLenMm, requiredBeltMm: st.requiredBeltMm,
          springNm: st.springNm, takeupMmPerDeg: st.takeupMmPerDeg,
        });
      } catch (e) { out.push({ position, error: e.message }); }
    };
    const at = (L, name) => {
      try { push(name, solveArmForBeltLength(sys, L, { hi })); }
      catch (e) { out.push({ position: name, error: 'Err. — ' + e.message }); }
    };
    push('FreeArm', 0);
    at(b.effLength + tol + wear * b.effLength, 'Replace');
    at(b.effLength + tol, 'MaxBelt');
    at(b.effLength, 'Mean');
    at(b.effLength - tol, 'MinBelt');
    if (sys.tensioner.loadStopRelDeg != null) push('Load', sys.tensioner.loadStopRelDeg);
    return out;
  }
  const meanRel = (sys) => {
    if (sys._cache.meanRel == null)
      sys._cache.meanRel = solveArmForBeltLength(sys, sys.belt.effLength);
    return sys._cache.meanRel;
  };

  /* ==================================================== 5) HIZ & GERİLME */

  const crankPitchRadiusM = (sys) => sys.pulleys[sys._crkIdx].rPitch / 1000;
  const beltSpeed = (sys, engineRpm) =>
    engineRpm * sys.driveRatio * TWO_PI / 60 * crankPitchRadiusM(sys);
  const speedRatio = (sys, i) =>
    sys.driveRatio * sys.pulleys[sys._crkIdx].rPitch / sys.pulleys[i].rPitch;
  const accessoryRpm = (sys, i, engineRpm) => engineRpm * speedRatio(sys, i);

  function spanTensions(sys, opts = {}) {
    const { loadsKw = {}, slackN } = opts;
    const N = opts.engineRpm != null ? opts.engineRpm : opts.rpm;
    if (N == null) throw new Error('FEADCore: engineRpm gerekli');
    const v = beltSpeed(sys, N);
    if (!(v > 0)) throw new Error('FEADCore: kayis hizi sifir');
    const n = sys._n, c = sys._crkIdx, t = sys._tenIdx;
    const kw = sys.pulleys.map(p => loadsKw[p.name] || 0);
    const others = kw.reduce((a, x, i) => a + (i === c ? 0 : x), 0);
    if (kw[c] > 0 && Math.abs(kw[c] - others) > 1e-6 * Math.max(1, others))
      throw new Error(
        `FEADCore/gerilme: surucu gucu (${kw[c]} kW) diger kasnaklarin toplamina ` +
        `(${others.toFixed(3)} kW) esit degil; cevrim kapanmaz`);
    kw[c] = others;

    const T = new Array(n).fill(NaN);
    const anchor = slackN != null ? slackN : sys.designTensionN;
    if (anchor == null) throw new Error('FEADCore: designTensionN veya slackN gerekli');
    T[t] = anchor;
    for (let j = 1; j < n; j++) {
      const k = (t + j) % n, prev = (k - 1 + n) % n;
      T[k] = T[prev] + (k === c ? +1 : -1) * (kw[k] * 1000) / v;
    }
    const minT = Math.min.apply(null, T);
    const perPulley = sys.pulleys.map((p, i) => ({
      name: p.name,
      exitTensionN: T[i],                          // Gates satırı
      entryTensionN: T[(i - 1 + n) % n],
      powerKw: kw[i], accessoryRpm: accessoryRpm(sys, i, N),
      speedRatio: speedRatio(sys, i),
    }));
    return {
      vMs: v, spanN: T, perPulley, engineRpm: N,
      warnings: minT < 0
        ? [`Negatif span gerilmesi: kayis gevsiyor (T_min=${minT.toFixed(1)} N)`] : [],
    };
  }

  function hubloads(geom, spanN) {
    const n = geom.spans.length;
    return geom.pulleys.map((p, i) => {
      const F = sub(mul(geom.spans[i].u, spanN[i]),
        mul(geom.spans[(i - 1 + n) % n].u, spanN[(i - 1 + n) % n]));
      return { name: p.name, FN: norm(F), dirDeg: mod360(angOf(F) / DEG) };
    });
  }

  /* Euler-Eytelwein. SF = e^(mu*phi) / (T_gergin/T_gevsek); SF<1 -> kayma. */
  function slipSafety(geom, spanN, opt = {}) {
    const muG = opt.muGrooved != null ? opt.muGrooved : CALIBRATION.muEffGrooved.value;
    const muB = opt.muBack != null ? opt.muBack : CALIBRATION.muBackside.value;
    const n = geom.spans.length;
    return geom.pulleys.map((p, i) => {
      const Tin = spanN[(i - 1 + n) % n], Tout = spanN[i];
      const ratio = Math.max(Tin, Tout) / Math.max(Math.min(Tin, Tout), 1e-9);
      const mu = p.contact === 'grooved' ? muG : muB;
      const cap = Math.exp(mu * geom.wraps[i]);
      return { name: p.name, tensionRatio: ratio, capstanCapacity: cap, SF: cap / ratio };
    });
  }

  /* ==================================================== 6) TİTREŞİM */

  const massPerM = (sys) => {
    if (sys.belt.massPerM != null) return sys.belt.massPerM;
    const m = sys.belt.massPerRibKgM != null ? sys.belt.massPerRibKgM : sys._bp.massPerRibKgM;
    if (m == null || sys.belt.ribs == null)
      throw new Error('FEADCore: belt.massPerM veya (massPerRibKgM + ribs) gerekli');
    return m * sys.belt.ribs;
  };

  /* Eksenel hareketli tel: f_n = n*(c^2 - v^2)/(2*L*c),  c = sqrt(T/m').
   * v1'deki sqrt(c^2-v^2)/(2L) formu YANLISTI (3000 rpm'de %7 hata). */
  function spanFrequencies(sys, geom, spanN, opt = {}) {
    const { engineRpm, modes = 1 } = opt;
    const mp = opt.mPrime != null ? opt.mPrime : massPerM(sys);
    const v = engineRpm != null ? beltSpeed(sys, engineRpm) : 0;
    const n = geom.names.length;
    return geom.spans.map((sp, i) => {
      const L = sp.L / 1000, T = spanN[i];
      const c = Math.sqrt(Math.max(T, 0) / mp);
      const f1 = c > v ? (c * c - v * v) / (2 * L * c) : 0;
      return {
        span: `${geom.names[i]}->${geom.names[(i + 1) % n]}`,
        LMm: sp.L, TN: T, waveSpeedMs: c, beltSpeedMs: v,
        fHz: Array.from({ length: modes }, (_, k) => (k + 1) * f1),
        flutter: c <= v,
      };
    });
  }
  const firingFrequencyHz = (engineRpm, cylinders, strokes = 4) =>
    engineRpm / 60 * cylinders / (strokes / 2);

  /* Gergi KOL MODU tahmini (tek serbestlik dereceli, yay + kol ataleti).
   * DIKKAT: bu, Gates raporundaki "Natural Frequency" DEGILDIR — o, krank ve
   * aksesuar ataletlerini de iceren cok serbestlik dereceli bir sistem modudur
   * (bkz. CALIBRATION.tensionerArmInertiaKgM2.note). Kol ataleti raporun
   * "System Vibration Analysis" sayfasindan okunmali; bilinen degerler
   * CALIBRATION...measured icinde. */
  function tensionerMode(sys, opt = {}) {
    const kRad = sys.tensioner.rateNmPerDeg / DEG;
    const J = opt.armInertiaKgM2 != null ? opt.armInertiaKgM2
      : sys.tensioner.armInertiaKgM2;
    if (J == null) throw new Error(
      'FEADCore/tensionerMode: armInertiaKgM2 zorunlu. Esdeger atalet icin ' +
      'evrensel bir sabit YOK ve raporun Natural Frequency degeri bu modelle ' +
      'uretilemez. Ayrinti: CALIBRATION.tensionerArmInertiaKgM2.note');
    return {
      fHz: Math.sqrt(kRad / J) / TWO_PI, kNmPerRad: kRad, inertiaKgM2: J,
      isGatesNaturalFrequency: false,
      note: 'Sadece kol modu tahmini; raporun Natural Frequency degeri degil.',
    };
  }

  /* ------------------------------- Burulma (dönel) titreşim modeli ---------
   * Kaynak: Olatunde (2008, Toronto Ü.) B-ISG tezinin 7-SD modelinin N kasnak
   * icin genellestirilmis hali. Tezin ara denklemlerindeki indis hatalarindan
   * kacinmak icin dogrudan enerji formulasyonundan kuruldu:
   *   serbestlikler q = [theta_1..theta_n, delta_kol]
   *   span uzamasi  e_i = R_{i+1} th_{i+1} - R_i th_i + a_i * delta
   *   V = 1/2 SUM k_i e_i^2 + 1/2 k_yay delta^2      ->  K = B' diag(k) B + yay
   *   T = 1/2 SUM I_j thd_j^2 + 1/2 I_kol deltad^2   ->  M = diag(I)
   * K tekildir (rijit cisim modu, tum sistem birlikte doner) -> f=0 beklenir;
   * ilk SIFIRDAN FARKLI frekans sistemin 1. elastik modudur.
   * a_i (kol -> span uzunlugu turevi) sonlu farkla, gercek geometriden alinir;
   * toplamlari take-up oranina esit olmalidir (donuste kontrol edilir).
   * DIKKAT: kalibrasyonu acik, bkz. CALIBRATION.torsional.note */

  /* Span eksenel rijitligi [N/m]. Yay uzunlugu = serbest span + kavis payi. */
  function spanStiffness(sys, geom, opt = {}) {
    const Kb = opt.cordStiffnessN != null ? opt.cordStiffnessN
      : (sys.belt.cordStiffnessN != null ? sys.belt.cordStiffnessN
        : (sys._bp.cordStiffnessNPerRib != null && sys.belt.ribs != null
          ? sys._bp.cordStiffnessNPerRib * sys.belt.ribs : null));
    if (Kb == null) throw new Error(
      'FEADCore/spanStiffness: kayis kord rijitligi yok. opt.cordStiffnessN ' +
      'veya belt.ribs + BELT_DB.cordStiffnessNPerRib gerekli.');
    const kb = opt.beltFactor != null ? opt.beltFactor : CALIBRATION.torsional.beltFactor;
    const n = geom.pulleys.length;
    return geom.spans.map((sp, i) => {
      const j = (i + 1) % n;
      const arc = kb * (geom.pulleys[i].rPitch * geom.wraps[i] / 2
                      + geom.pulleys[j].rPitch * geom.wraps[j] / 2) / 1000;
      return { span: `${geom.names[i]}->${geom.names[j]}`,
               effLenM: sp.L / 1000 + arc, kNPerM: Kb / (sp.L / 1000 + arc) };
    });
  }

  /* Simetrik ozdeger (Jacobi). n kucuk oldugu icin fazlasiyla yeterli. */
  function jacobiEig(Ain, n) {
    const A = Ain.map(r => r.slice());
    const V = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 200; sweep++) {
      let off = 0, p = 0, q = 1;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        off += A[i][j] * A[i][j];
        if (Math.abs(A[i][j]) > Math.abs(A[p][q])) { p = i; q = j; }
      }
      if (off < 1e-26) break;
      const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]);
      const c = Math.cos(th), sn = Math.sin(th);
      for (let k = 0; k < n; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c * a - sn * b; A[k][q] = sn * a + c * b; }
      for (let k = 0; k < n; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c * a - sn * b; A[q][k] = sn * a + c * b; }
      for (let k = 0; k < n; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - sn * b; V[k][q] = sn * a + c * b; }
    }
    return { values: A.map((r, i) => r[i]), vectors: V };
  }

  function torsionalModel(sys, opt = {}) {
    const rel = opt.relDeg != null ? opt.relDeg : meanRel(sys);
    const n = sys._n, t = sys._tenIdx, N = n + 1;
    const st = tensionerState(sys, rel), geom = st.geom;

    /* atalet toplama — eksikse acik hata */
    const inert = sys.pulleys.map(p => {
      const J = (opt.inertias && opt.inertias[p.name] != null) ? opt.inertias[p.name] : p.inertiaKgM2;
      if (J == null) throw new Error(
        `FEADCore/torsionalModel: "${p.name}" kasnaginin atalet momenti yok. ` +
        `inertiaKgM2 verin (Gates raporunun "System Vibration Analysis" sayfasi).`);
      return J;
    });
    let armJ = opt.armInertiaKgM2 != null ? opt.armInertiaKgM2 : sys.tensioner.armInertiaKgM2;
    if (armJ == null) throw new Error(
      'FEADCore/torsionalModel: tensioner.armInertiaKgM2 gerekli.');
    /* Kol, kasnagi kol boyu yariçapinda nokta kutle olarak tasir. Raporlarin
     * "Tensioner Pulley Mass" satiri bunun icindir; ihmal edilirse 1. mod
     * belirgin sekilde yuksek cikar (kalibrasyonda %28 -> %17 fark etti). */
    const mp = opt.tensionerPulleyMassKg != null ? opt.tensionerPulleyMassKg
      : sys.tensioner.pulleyMassKg;
    const armLm = sys.tensioner.armLength / 1000;
    if (mp != null) armJ += mp * armLm * armLm;

    const R = sys.pulleys.map(p => p.rPitch / 1000);
    const kSpan = spanStiffness(sys, geom, opt).map(x => x.kNPerM);

    /* Kol -> span uzunlugu turevi a_i [m/rad].
     * Serbest span boyunun sonlu farki DEGIL, PROJEKSIYON kullanilir:
     *   a_giris = u_giris . v ,  a_cikis = -u_cikis . v ,  v = dC/d(delta)
     * Bu ikisinin toplami tam olarak take-up oranina esittir; cunku
     * (u_giris - u_cikis).v = 2 sin(phi/2) * r_kol * sin(beta). Serbest span
     * boylarinin sonlu farki bunu VERMEZ (sarim degisimi teget noktalarini
     * kaydirir ve kavis terimi disarida kalir) -> once o denendi, take-up
     * kontrolu %3-49 sapiyordu. Sadece gergiye komsu iki span sifirdan farkli;
     * sabit kasnaklar arasindaki spanlarin boyu kol hareketinden etkilenmez. */
    const h = 0.02;
    const cP = tenCenter(sys, rel + h), cM = tenCenter(sys, rel - h);
    const vC = [(cP[0] - cM[0]) / 1000 / (2 * h * DEG),
                (cP[1] - cM[1]) / 1000 / (2 * h * DEG)];
    const a = geom.spans.map(() => 0);
    const iIn = (t - 1 + n) % n;
    a[iIn] = dot(geom.spans[iIn].u, vC);
    a[t]   = -dot(geom.spans[t].u, vC);
    const takeupSum = a.reduce((x, y) => x + y, 0);

    /* uyum matrisi ve K */
    const B = Array.from({ length: n }, () => Array(N).fill(0));
    for (let i = 0; i < n; i++) { B[i][i] = -R[i]; B[i][(i + 1) % n] = R[(i + 1) % n]; B[i][n] = a[i]; }
    const K = Array.from({ length: N }, () => Array(N).fill(0));
    for (let i = 0; i < n; i++) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++)
      K[r][c] += kSpan[i] * B[i][r] * B[i][c];
    K[n][n] += sys.tensioner.rateNmPerDeg / DEG;

    const M = [...inert, armJ];
    const S = M.map(x => 1 / Math.sqrt(x));
    const A2 = Array.from({ length: N }, (_, r) =>
      Array.from({ length: N }, (_, c) => K[r][c] * S[r] * S[c]));
    const e = jacobiEig(A2, N);
    const idx = e.values.map((v, i) => i).sort((i, j) => e.values[i] - e.values[j]);
    const dofNames = [...sys.pulleys.map(p => p.name), 'ARM'];
    const modes = idx.map(i => ({
      fHz: Math.sqrt(Math.max(e.values[i], 0)) / TWO_PI,
      shape: dofNames.map((nm, r) => ({ dof: nm, amp: e.vectors[r][i] * S[r] })),
    }));
    const elastic = modes.filter(m => m.fHz > 1e-6);
    return {
      relDeg: rel, dofNames, modes,
      rigidBodyModes: modes.length - elastic.length,
      firstElasticHz: elastic.length ? elastic[0].fHz : null,
      elasticHz: elastic.map(m => m.fHz),
      spanStiffnessNPerM: kSpan, armTakeupMPerRad: a,
      takeupCheck: { sumMPerRad: takeupSum,
        stateMPerRad: st.takeupMmPerDeg / 1000 / DEG,
        errPct: Math.abs(Math.abs(takeupSum) / (st.takeupMmPerDeg / 1000 / DEG) - 1) * 100 },
      matrices: { K, M }, armInertiaUsedKgM2: armJ,
      isGatesNaturalFrequency: false,
      caveat: CALIBRATION.torsional.note,
    };
  }

  /* ==================================================== 7) PEAK (yaklaşık) */
  function peakEstimate(sys, opts) {
    const { engineRpm, accelRpmS, loadsKw = {}, inertias = {} } = opts;
    const v = beltSpeed(sys, engineRpm);
    const alpha = accelRpmS * sys.driveRatio * TWO_PI / 60;
    const n = sys._n, c = sys._crkIdx, t = sys._tenIdx;
    const kw = sys.pulleys.map(p => loadsKw[p.name] || 0);
    kw[c] = kw.reduce((a, x, i) => a + (i === c ? 0 : x), 0);
    const out = {};
    for (const sgn of [+1, -1]) {
      const T = new Array(n).fill(NaN);
      T[t] = sys.designTensionN;
      for (let j = 1; j < n; j++) {
        const k = (t + j) % n, prev = (k - 1 + n) % n, p = sys.pulleys[k];
        const J = inertias[p.name] != null ? inertias[p.name] : (p.inertiaKgM2 || 0);
        const dInertia = J * (sgn * alpha) * speedRatio(sys, k) / (p.rPitch / 1000);
        T[k] = T[prev] + (k === c ? +1 : -1) * ((kw[k] * 1000) / v + dInertia);
      }
      out[sgn > 0 ? 'accel' : 'decel'] = {
        spanN: T, maxN: Math.max.apply(null, T), minN: Math.min.apply(null, T),
      };
    }
    out.note = 'Yari-statik yaklasim; gergi kolu dinamigi dahil DEGIL.';
    return out;
  }

  /* ==================================================== 8) HİZALAMA (iskelet) */
  function alignmentAllowance(geom, opt = {}) {
    const lim = opt.fleetingLimitDeg != null ? opt.fleetingLimitDeg
      : CALIBRATION.fleetingLimitDeg.value;
    const kFlat = opt.kFlat != null ? opt.kFlat : 0.70;
    const psiMap = opt.flatMisalignDeg || {};
    const n = geom.pulleys.length, res = [];
    geom.pulleys.forEach((p, i) => {
      if (p.contact !== 'grooved') return;
      const prev = geom.pulleys[(i - 1 + n) % n];
      const psi = psiMap[prev.name] || 0;
      const fleet = kFlat * psi;
      const remain = Math.sqrt(Math.max(lim * lim - fleet * fleet, 0));
      res.push({
        groovedPulley: p.name,
        flatBefore: prev.contact === 'back' ? prev.name : null,
        flatMisalignDeg: psi, resultingFleetingDeg: fleet,
        axialOffsetAllowMm: geom.entrySpanLen(i) * Math.tan(remain * DEG),
        calibrated: false,
      });
    });
    return res;
  }

  /* ================================================ 9) KAYIŞ ÖMRÜ (B10) */
  /* Miner + egilme + sicaklik. Hasar orani:
   *   D = SUM_duty dc * (v/L) * SUM_kasnak w_i * (T_ort,i + Kb/d_eff,i)^m
   *       * 2^((degC - 80)/dT)
   * T_ort = kasnaktaki giris/cikis span gerilmelerinin ortalamasi
   * w = 1 kaburgali, w = wRev sirttan (ters bukulme)
   * Omur = C / D   [saat]
   * Sabitler FATIGUE icinde, kaynak ve gecerlilik notu ile birlikte. */
  const FATIGUE = {
    /* ===== A) DAGILIM — KANITLANMIS =====================================
     * Gates "Pulley Contributions to Belt Rib Fatigue %" tablolarindan
     * DOGRUDAN turetildi ve 5 sistemde dogrulandi (RMS 0.7 yuzde puani):
     *   hasar_i ~ w_i * d_eff,i^(-m)     w=1 kaburgali, w=wBackside sirttan
     * Turetme: kaburgali-kaburgali cift -> m: AG00686 5.57, AG0868 5.65
     *          sirttan/kaburgali        -> w: AG00686 0.301, AG0868 0.319
     * GERILMEDEN BAGIMSIZ: AG00686'da IDR (T~1209 N) ve TEN (T~766 N)
     * katkilari birebir esit (43.3 = 43.3). Ayrica AG0868'in 4PK/6PK/8PK
     * varyantlari (farkli gerilme, farkli sarim) AYNI katkilari veriyor
     * (2.7 / 25.0 / 72.4) -> dagilim SADECE cap ve temas tarafina bagli.
     * Devir basina yuk katkisi = dc% * kayis hizi (kayis gecis sayisi). */
    m: 5.6, wBackside: 0.31,
    validDiameterMm: [79.6, 176.0],     // katkilardan kalibre edilen aralik
    /* Sabitler KAYIS YORULMA MODELINE gore degisiyor. Raporun "Pulley
     * Contributions to Belt Rib Fatigue" basligindaki model adi kullanilir. */
    byModel: {
      'PK-2_2p-MT3': { m: 5.6,  wBackside: 0.31, dRangeMm: [79.6, 175.0], nSystems: 8,
        derived: 'AG00686-1475 m=5.57 w=0.301 | AG0868 m=5.65 w=0.319 | ' +
                 'AG00686-1520 m=5.98 w=0.239 -> m=5.6+-0.2, w=0.29+-0.04' },
      'PK-2_2a-MT3': { m: 4.05, wBackside: 1.10, dRangeMm: [55.0, 176.0], nSystems: 1,
        derived: 'AG00810 tek sistem: 3 farkli cap, 2 bilinmeyen -> BELIRLENMIS ' +
                 'ama DOGRULANMAMIS. Kaburga sayisi 10, ALT capi 55 mm.' },
    },
    modelNote: 'PK-2_2p ve PK-2_2a sabitleri cok farkli (m 5.6 vs 4.05, ' +
      'wSirt 0.31 vs 1.10). Iki aday aciklama VERIYLE AYRILAMIYOR: ' +
      '(a) sabitler kayis yapisina bagli; (b) tek bir f(d) egrisi var ve kucuk ' +
      'capta yassilasiyor, guc yasasi uydurunca aralik farkli m veriyor. ' +
      '(b) lehine ipucu: 57-58.8 mm alternatorlu sistemlerin 0.55x omur ' +
      'sapmasindan geri-hesaplanan etkin us ~3.4 idi; AG00810 dogrudan 4.05 ' +
      'olcuyor — ayni yon. Ayirt etmek icin kucuk kasnakli bir 2p raporu veya ' +
      'hepsi buyuk kasnakli bir 2a raporu gerekli.',

    /* ===== B) KABURGA / GERILME OLCEKLEMESI — KONTROLLU DENEY ==========
     * AG0868 4PK / 6PK / 8PK: AYNI kasnaklar, AYNI duty, AYNI 90 C,
     * sadece kaburga sayisi ve tasarim gerginligi degisiyor.
     *   omur ~ L * (kaburga / T_tasarim)^q
     * Uc ciftten: q = 1.136 / 1.131 / 1.121  ->  q = 1.13 (+-%0.7) */
    ribTensionExp: 1.13,

    /* ===== C) MUTLAK OMUR — GECERLILIK ALANI SINIRLI ===================
     *   D = [SUM_i w_i d_i^-m] * [SUM_duty dc*(v/L)] * (T_tas/kaburga)^q
     *       * 2^((degC - 80)/dT)
     *   B10 = C / D   [saat]
     * Tum kasnaklar 79.6-175 mm araliginda olan 5 sistemde RMS %2.4
     * (0.98x - 1.04x). AG00894 bu aralikta ama 1.9x sapiyor -> nedeni
     * BILINMIYOR, tekil aykiri deger.
     * ARALIK DISI: 57-58.8 mm alternator kasnagi olan 5 sistemde model
     * omru SISTEMATIK olarak 0.55x veriyor (sacilma sadece +-%8) ->
     * d^-5.6 yasasi kucuk caplarda hasari ~1.8 kat FAZLA sayiyor; etkin
     * us ~3.4'e dusuyor. Tek bir kucuk cap noktasi oldugu icin egri
     * uydurulmadi; smallPulleyBias ampirik duzeltme carpanidir. */
    absolute: { tensionExp: 0.96, halvingDegC: 23, C: 1.475304e-4,
                refDegC: 80, rmsPct: 2.4, nSystems: 5 },
    smallPulleyBias: 0.55,
    absoluteNote: 'Mutlak omur SADECE tum kasnak caplari 79.6-175 mm ' +
      'araliginda oldugunda gecerli (5 sistem, RMS %2.4). Aralik disinda ' +
      'model omru ~0.55x verir (sistematik). AG00894 aralik icinde olmasina ' +
      'ragmen 1.9x sapiyor. Sertifikasyon icin degil.',
  };

  /* Kasnak basina kayis kaburga yorulmasi PAYI (%) — dogrulanmis model. */
  function ribFatigueDistribution(sys, opt = {}) {
    const { duty } = opt;
    if (!Array.isArray(duty) || !duty.length)
      throw new Error('FEADCore/ribFatigueDistribution: duty dizisi gerekli');
    const mdl = opt.fatigueModel ? FATIGUE.byModel[opt.fatigueModel] : null;
    if (opt.fatigueModel && !mdl) throw new Error(
      `FEADCore/ribFatigueDistribution: "${opt.fatigueModel}" icin sabit yok ` +
      `(mevcut: ${Object.keys(FATIGUE.byModel).join(', ')})`);
    const m = opt.m != null ? opt.m : (mdl ? mdl.m : FATIGUE.m);
    const wB = opt.wBackside != null ? opt.wBackside : (mdl ? mdl.wBackside : FATIGUE.wBackside);
    const L = sys.belt.effLength / 1000;
    const acc = sys.pulleys.map(() => 0);
    const byRpm = [];
    for (const u of duty) {
      const t = spanTensions(sys, u);
      const dc = (u.dcPct != null ? u.dcPct : 100 / duty.length) / 100;
      const passes = dc * (t.vMs / L);
      let sub = 0;
      sys.pulleys.forEach((p, i) => {
        const w = p.contact === 'grooved' ? 1 : wB;
        const d = w * Math.pow(2 * p.rEff, -m) * passes;
        acc[i] += d; sub += d;
      });
      byRpm.push({ engineRpm: t.engineRpm, vMs: t.vMs, damage: sub });
    }
    const tot = acc.reduce((a, b) => a + b, 0);
    const bySum = byRpm.reduce((a, b) => a + b.damage, 0);
    return {
      perPulley: sys.pulleys.map((p, i) => ({
        name: p.name, dEffMm: 2 * p.rEff, contact: p.contact,
        sharePct: acc[i] / tot * 100,
      })),
      perLoadPct: byRpm.map(x => ({ engineRpm: x.engineRpm, vMs: x.vMs,
        sharePct: x.damage / bySum * 100 })),
      constants: { m, wBackside: wB, fatigueModel: opt.fatigueModel || 'PK-2_2p-MT3' },
      note: FATIGUE.distributionNote, modelNote: FATIGUE.modelNote,
    };
  }

  function beltLifeB10(sys, opt = {}) {
    const { duty, degC } = opt;
    if (!Array.isArray(duty) || !duty.length)
      throw new Error('FEADCore/beltLifeB10: duty dizisi gerekli');
    if (degC == null) throw new Error(
      'FEADCore/beltLifeB10: degC (duty tablosundaki T sutunu) gerekli — ' +
      'sicaklik omru ' + FATIGUE.absolute.halvingDegC + ' C basina 2 kat degistirir');
    if (sys.belt.ribs == null)
      throw new Error('FEADCore/beltLifeB10: belt.ribs gerekli');
    const P = Object.assign({}, FATIGUE.absolute, opt.constants);
    const m = opt.m != null ? opt.m : FATIGUE.m;
    const wB = opt.wBackside != null ? opt.wBackside : FATIGUE.wBackside;
    const [dLo, dHi] = FATIGUE.validDiameterMm;
    const outside = sys.pulleys
      .filter(p => 2 * p.rEff < dLo - 1e-6 || 2 * p.rEff > dHi + 1e-6)
      .map(p => `${p.name} (d=${(2 * p.rEff).toFixed(1)} mm)`);

    const geomSum = sys.pulleys.reduce((a, p) =>
      a + (p.contact === 'grooved' ? 1 : wB) * Math.pow(2 * p.rEff, -m), 0);
    const L = sys.belt.effLength / 1000;
    let passes = 0, dcSum = 0;
    for (const u of duty) {
      const t = spanTensions(sys, u);
      const dc = (u.dcPct != null ? u.dcPct : 100 / duty.length) / 100;
      dcSum += dc; passes += dc * (t.vMs / L);
    }
    const D = geomSum * passes
      * Math.pow(sys.designTensionN / sys.belt.ribs, P.tensionExp)
      * Math.pow(2, (degC - P.refDegC) / P.halvingDegC);
    const raw = P.C / D;
    return {
      hoursB10: raw, hoursB10Corrected: outside.length ? raw / FATIGUE.smallPulleyBias : raw,
      damageRate: D, dutyCoverage: dcSum, geomSum, passesPerSec: passes,
      inValidRange: outside.length === 0, outOfRange: outside,
      warnings: outside.length ? [
        `Kasnak capi gecerlilik araliginin (${dLo}-${dHi} mm) disinda: ` +
        outside.join(', ') + '. Model bu durumda omru sistematik olarak ' +
        '~0.55x veriyor; hoursB10Corrected ampirik duzeltmeyi icerir.'] : [],
      constants: P, caveat: FATIGUE.absoluteNote,
    };
  }

  const weibull = {
    cdf: (t, beta, eta) => 1 - Math.exp(-Math.pow(t / eta, beta)),
    bLife: (pct, beta, eta) => eta * Math.pow(-Math.log(1 - pct / 100), 1 / beta),
    etaFromBLife: (bHours, pct, beta) => bHours / Math.pow(-Math.log(1 - pct / 100), 1 / beta),
  };

  /* ==================================================== 10) ÜST SEVİYE */
  function analyze(sys, opt = {}) {
    const { duty = [], cylinders = 6, mu, modes = 1 } = opt;
    const rel = meanRel(sys);
    const st = tensionerState(sys, rel);
    const geom = st.geom;
    return {
      meanRelDeg: rel, meanAbsDeg: st.absDeg,
      tensioner: {
        tensionN: st.tensionN, hubloadN: st.hubloadN, hubDirDeg: st.hubDirDeg,
        betaDeg: st.betaDeg, wrapDeg: st.wrapDeg,
        takeupMmPerDeg: st.takeupMmPerDeg, springNm: st.springNm,
      },
      geometry: geom.names.map((nm, i) => ({
        name: nm, exitSpanMm: geom.exitSpanLen(i), wrapDeg: geom.wrapDeg(i),
        speedRatio: speedRatio(sys, i),
      })),
      driveLenMm: st.driveLenMm, requiredBeltMm: st.requiredBeltMm,
      lengthOffsetMm: sys.lengthOffsetMm,
      positions: positionTable(sys),
      tensionerMode: (() => { try { return tensionerMode(sys, opt); }
                              catch (e) { return { error: e.message }; } })(),
      torsional: opt.torsional === false ? null
        : (() => { try { return torsionalModel(sys, opt.torsionalOpt || {}); }
                   catch (e) { return { error: e.message }; } })(),
      duty: duty.map(d => {
        const t = spanTensions(sys, d);
        return {
          engineRpm: t.engineRpm, dcPct: d.dcPct, vMs: t.vMs,
          perPulley: t.perPulley,
          hubloads: hubloads(geom, t.spanN),
          slip: slipSafety(geom, t.spanN, mu),
          frequencies: spanFrequencies(sys, geom, t.spanN,
            { engineRpm: t.engineRpm, modes }),
          firingHz: firingFrequencyHz(t.engineRpm, cylinders),
          warnings: t.warnings,
        };
      }),
    };
  }

  /* ------------------------------------------------------------ dışa aç */
  return {
    VERSION: '2.0',
    BELT_DB, CALIBRATION, beltProps, radiiFromOD,
    solveGeometry, geometryAt, loopSense, checkClearance,
    makeSystem, tensionerState, positionTable, meanRel,
    solveArmForBeltLength, solveArmForTension, calibrateLengthOffset, feasibleRelMax,
    springTorque, tenCenter, armAbsDeg,
    beltSpeed, speedRatio, accessoryRpm, spanTensions, hubloads, slipSafety,
    spanFrequencies, firingFrequencyHz, tensionerMode, massPerM,
    spanStiffness, torsionalModel, jacobiEig,
    peakEstimate, alignmentAllowance, weibull, beltLifeB10,
  ribFatigueDistribution, FATIGUE,
    analyze, bisect,
  };
}));
