/* SUITE A — KAPALI BİÇİMLİ (ANALİTİK) SINAMALAR
 * Doğru cevap elle türetilir; Gates'e hiç bakılmaz. */
const { C } = require('./lib.js');
const DEG = Math.PI / 180;
const rows = [];
const T = (ad, olculen, beklenen, birim, tol) => {
  const dev = Math.abs(olculen - beklenen);
  const rel = dev / Math.max(1e-30, Math.abs(beklenen));
  rows.push({ ad, olculen, beklenen, birim, dev, rel, ok: rel < (tol || 1e-12) });
};

/* ---- A1..A3: düzgün n-kenarlı, EŞ kasnaklar ----------------------------
 * Eş yarıçapta dış teğet boyu = merkez mesafesi; her sarım = 360/n;
 * L = n·a + 2πr  (tam). */
for (const n of [3, 4, 5, 6, 8, 12]) {
  const Rc = 250, od = 90, hb = 1.2;
  const P = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2 * Math.PI / n;
    P.push({ name: 'P' + i, od, contact: 'grooved', x: Rc * Math.cos(a), y: Rc * Math.sin(a) });
  }
  const res = P.map(p => Object.assign({ name: p.name, contact: p.contact, c: [p.x, p.y] },
    C.radiiFromOD(p.od, p.contact, { hb, hr: 1.1 })));
  const g = C.solveGeometry(res);
  const a = 2 * Rc * Math.sin(Math.PI / n);
  T(`n=${n}: teğet boyu = kenar`, g.spans[0].L, a, 'mm');
  T(`n=${n}: sarım = 360/n`, g.wrapDeg(0), 360 / n, '°');
  T(`n=${n}: L_eff = n·a + 2πr`, g.LeffMm, n * a + 2 * Math.PI * (od / 2), 'mm');
  T(`n=${n}: L_pitch = n·a + 2π(r+hb)`, g.LpitchMm, n * a + 2 * Math.PI * (od / 2 + hb), 'mm');
}

/* ---- A4: iki eşit olmayan kasnak + avara, dış teğet ------------------- */
{
  const hb = 1.2, hr = 1.1;
  const P = [
    { name: 'A', od: 180, contact: 'grooved', x: 0, y: 0 },
    { name: 'B', od: 70, contact: 'grooved', x: 400, y: 0 },
    { name: 'K', od: 100, contact: 'grooved', x: 200, y: 330 },
  ];
  const res = P.map(p => Object.assign({ name: p.name, contact: p.contact, c: [p.x, p.y] },
    C.radiiFromOD(p.od, p.contact, { hb, hr })));
  const g = C.solveGeometry(res);
  const rA = 90 + hb, rB = 35 + hb, rK = 50 + hb;
  T('A→B dış teğet √(d²−Δr²)', g.spans[0].L, Math.sqrt(400 * 400 - (rA - rB) ** 2), 'mm');
  /* sarım açıları: dış teğet için sarım = π ± açılar; toplam 360 kapalı */
  T('Σ sarım = 360', Math.abs(g.signedWrapDeg), 360, '°', 1e-13);
}

/* ---- A5: SIRTTAN temas → İÇ (çaprazlanmış) teğet ---------------------- */
{
  const hb = 1.2, hr = 1.1;
  /* üç kaburgalı gövde + kirişi içe bastıran bir sırt avarası */
  const P = [
    { name: 'A', od: 160, contact: 'grooved', x: -250, y: -150 },
    { name: 'B', od: 160, contact: 'grooved', x: 250, y: -150 },
    { name: 'C', od: 120, contact: 'grooved', x: 0, y: 300 },
    { name: 'S', od: 70, contact: 'back', x: 0, y: -260 },      /* A→B kirişinin ALTINDA */
  ];
  /* kayış sırası: A → S → B → C  (S, A ile B arasında) */
  const ord = [P[0], P[3], P[1], P[2]];
  const res = ord.map(p => Object.assign({ name: p.name, contact: p.contact, c: [p.x, p.y] },
    C.radiiFromOD(p.od, p.contact, { hb, hr })));
  const g = C.solveGeometry(res);
  const rA = 80 + hb, rS = 35 + hr;
  const d = Math.hypot(0 - (-250), -260 - (-150));
  T('A→S iç teğet √(d²−(r₁+r₂)²)', g.spans[0].L, Math.sqrt(d * d - (rA + rS) ** 2), 'mm');
  T('sırtlı çevrimde Σ işaretli sarım = 360', Math.abs(g.signedWrapDeg), 360, '°', 1e-13);
  T('sırtlı çevrimde L_pitch−L_eff = 2π·hb', g.LpitchMm - g.LeffMm, 2 * Math.PI * hb, 'mm', 1e-13);
}

/* ---- A6: take-up oranı — analitik türev ile karşılaştırma -------------
 * Eş kasnaklı simetrik düzende gergi kolunu elle konumlandır; dL/dθ'yı
 * MERKEZ HAREKETİNİN spanlara izdüşümünden bağımsız hesapla. */
{
  const belt = { profile: 'PK', brand: 'GATES', ribs: 6 };
  const bp = C.beltProps(belt);
  const cfg = {
    pulleys: [
      { name: 'KRANK', od: 180, contact: 'grooved', x: 0, y: 0, crank: true },
      { name: 'ALT', od: 70, contact: 'grooved', x: 340, y: 120 },
      { name: 'GERGI', od: 80, contact: 'grooved', tensioner: true },
      { name: 'AC', od: 130, contact: 'grooved', x: 60, y: 360 },
    ],
    belt,
    tensioner: { pivot: [330, 330], armLength: 80, preloadNm: 30, rateNmPerDeg: 0.25,
                 freeAngleDeg: 200, sense: +1, armInertiaKgM2: 0.002, pulleyMassKg: 0.5 },
  };
  const sys = C.makeSystem(cfg);
  const rel = 12;
  const st = C.tensionerState(sys, rel);
  /* bağımsız yol: merkez hız vektörünün giriş/çıkış span birim vektörlerine izdüşümü */
  const n = sys._n, t = sys._tenIdx;
  const h = 1e-5;
  const cP = C.tenCenter(sys, rel + h), cM = C.tenCenter(sys, rel - h);
  const v = [(cP[0] - cM[0]) / (2 * h), (cP[1] - cM[1]) / (2 * h)];   // mm/derece
  const uIn = st.geom.spans[(t - 1 + n) % n].u, uOut = st.geom.spans[t].u;
  const dLdth = (uIn[0] - uOut[0]) * v[0] + (uIn[1] - uOut[1]) * v[1];
  /* işaret kolun dönüş yönüne bağlı; çekirdek büyüklüğü döner */
  T('take-up = |(u_in−u_out)·dC/dθ|', st.takeupMmPerDeg, Math.abs(dLdth), 'mm/°', 1e-7);
  /* ve sayısal boy türevi */
  const num = -(C.tensionerState(sys, rel + 1e-4).driveLenMm
    - C.tensionerState(sys, rel - 1e-4).driveLenMm) / 2e-4;
  T('take-up = −dL_eff/dθ (sayısal)', st.takeupMmPerDeg, num, 'mm/°', 1e-7);
  /* T = M/(dL/dθ) birim çevrimi: mm/° → m/rad */
  const dLdthRad = st.takeupMmPerDeg / 1000 / DEG;
  T('T = M/(dL/dθ)', st.tensionN, st.springNm / dLdthRad, 'N', 1e-12);
  T('hubload = 2T·sin(φ/2)', st.hubloadN,
    2 * st.tensionN * Math.sin(st.wrapDeg * DEG / 2), 'N', 1e-12);
}

/* ---- A7: BURULMA — halka (periyodik zincir) analitik özdeğerleri -------
 * n eş kasnak, eş span, kol yayı çok sert (kol kilitli) →
 *   ω_k = 2·√(k_span·R²/I)·|sin(πk/n)| */
{
  for (const n of [4, 6, 8]) {
    const Rc = 300, od = 100, hb = 1.2, I = 0.004, Kb = 66000;
    const P = [];
    for (let i = 0; i < n; i++) {
      const a = i * 2 * Math.PI / n;
      P.push({ name: 'P' + i, od, contact: 'grooved', x: Rc * Math.cos(a), y: Rc * Math.sin(a),
        inertiaKgM2: I, crank: i === 0 });
    }
    /* gergi = son kasnak; pivotu öyle koy ki rel=0'da tam köşede olsun */
    const last = P[n - 1];
    const cx = last.x, cy = last.y;
    const armLength = 90;
    const pivot = [cx + armLength, cy];             // kol yönü 180°
    delete last.x; delete last.y; last.tensioner = true;
    const cfg = {
      pulleys: P, belt: { profile: 'PK', brand: 'GATES', ribs: 6, cordStiffnessN: Kb, effLength: 100 },
      tensioner: { pivot, armLength, preloadNm: 30, rateNmPerDeg: 1e7,   /* kol KİLİTLİ */
        freeAngleDeg: 180, sense: +1, armInertiaKgM2: 1e-6 },
    };
    const sys = C.makeSystem(cfg);
    const tor = C.torsionalModel(sys, { relDeg: 0, beltFactor: 0 });
    const a = 2 * Rc * Math.sin(Math.PI / n);        // span boyu
    const k = Kb / (a / 1000);                        // N/m
    const R = (od / 2 + hb) / 1000;
    const analit = [];
    for (let kk = 1; kk < n; kk++)
      analit.push(2 * Math.sqrt(k * R * R / I) * Math.abs(Math.sin(Math.PI * kk / n)) / (2 * Math.PI));
    analit.sort((x, y) => x - y);
    const model = tor.elasticHz.slice(0, n - 1).sort((x, y) => x - y);
    let worst = 0, wi = -1;
    analit.forEach((f, i) => { const rr = Math.abs(model[i] - f) / f; if (rr > worst) { worst = rr; wi = i; } });
    rows.push({ ad: `burulma halkası n=${n}: ω_k = 2√(kR²/I)|sin(πk/n)|`,
      olculen: model[wi], beklenen: analit[wi], birim: 'Hz', dev: Math.abs(model[wi] - analit[wi]),
      rel: worst, ok: worst < 2e-4 });
  }
}

/* ---- A8: span frekansı — durağan tel limiti f1 = c/2L ------------------ */
{
  const mp = 0.12, Tn = 800, L = 0.25;
  const c = Math.sqrt(Tn / mp);
  /* çekirdeğin formülü v=0'da c/2L vermeli */
  const fake = { spans: [{ L: L * 1000 }], names: ['A', 'B'], pulleys: [{}, {}] };
  const sysFake = { belt: { massPerM: mp }, _bp: {}, pulleys: [], driveRatio: 1 };
  const f = C.spanFrequencies(sysFake, fake, [Tn], { mPrime: mp });
  T('durağan tel f1 = c/2L', f[0].fHz[0], c / (2 * L), 'Hz');
  T('v=0 flutter yok', f[0].flutter ? 1 : 0, 0, '-', 1e-9);
  /* T=0 → dalga hızı 0 → f=0 ve flutter işareti */
  const f3 = C.spanFrequencies(sysFake, fake, [0], { mPrime: mp });
  T('T=0 → f=0', f3[0].fHz[0], 0, 'Hz', 1e-9);
}

let bad = 0;
console.log('SUITE A — KAPALI BİÇİMLİ SINAMALAR\n');
rows.forEach(r => {
  if (!r.ok) bad++;
  console.log(`${r.ok ? '✓' : '✗'} ${r.ad.padEnd(46)} ölçülen=${Number(r.olculen).toPrecision(10)} beklenen=${Number(r.beklenen).toPrecision(10)} ${r.birim}  bağıl=${r.rel.toExponential(2)}`);
});
console.log(`\n${rows.length} sınama, ${bad} başarısız`);
