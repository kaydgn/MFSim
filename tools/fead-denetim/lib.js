/* FEAD bağımsız denetim kütüphanesi — Gates verisi KULLANMAZ.
 * Her sınama ya kapalı biçimli bir analitik sonuca ya da bir değişmezliğe
 * (dönme/ötelenme/ölçek/etiketleme) dayanır. */
const C = require('../../js/fead-core.js');
const DEG = Math.PI / 180;

/* ---------------------------------------------------------- rastgelelik */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const U = (r, lo, hi) => lo + r() * (hi - lo);
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

/* ---------------------------------------------------------- yardımcılar */
const relErr = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));
const hypot = (x, y) => Math.hypot(x, y);
function rot(p, th) { return [p[0] * Math.cos(th) - p[1] * Math.sin(th), p[0] * Math.sin(th) + p[1] * Math.cos(th)]; }

/* ============================================================ ÜRETİCİ
 * Dışbükey bir gövde üzerine kaburgalı kasnaklar + istenirse dışa konmuş
 * SIRTTAN temaslı avaralar. Gergi bir kola bağlanır; kol, hubload yönüne
 * yakın dik konur (iyi take-up). Kayış boyu, hedef kol açısında ÇÖZÜLEN
 * boya eşitlenir — böylece çalışma noktası kurgu gereği bilinir. */
function genSystem(r, o) {
  o = o || {};
  const nHull = o.nHull != null ? o.nHull : 3 + Math.floor(r() * 5);   // 3..7
  const Rc = o.Rc != null ? o.Rc : U(r, 150, 320);
  const step = 2 * Math.PI / nHull;
  const ang = [];
  for (let i = 0; i < nHull; i++) ang.push(i * step + (o.noJitter ? 0 : U(r, -step * 0.18, step * 0.18)));
  const cen = ang.map(a => [Rc * Math.cos(a), Rc * Math.sin(a)]);

  /* çaplar: krank en büyük, gerisi gerçekçi aralıktan; komşu açıklığı zorlarsa küçült */
  let dia = cen.map((_, i) => i === 0 ? U(r, 140, 210) : U(r, 55, 150));
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < nHull; i++) {
      const j = (i + 1) % nHull;
      const d = hypot(cen[j][0] - cen[i][0], cen[j][1] - cen[i][1]);
      const need = dia[i] / 2 + dia[j] / 2 + 12;
      if (need > d) { const f = (d - 12) / (dia[i] / 2 + dia[j] / 2) * 0.5; dia[i] *= f; dia[j] *= f; }
    }
  }
  if (Math.min.apply(null, dia) < 40) return null;

  const P = cen.map((c, i) => ({
    name: i === 0 ? 'KRANK' : 'AKS' + i, od: dia[i], contact: 'grooved',
    x: c[0], y: c[1], crank: i === 0,
  }));

  /* sırttan temaslı avara: gövdenin DIŞINA, kirişi içe bastıracak kadar */
  const nBack = o.nBack != null ? o.nBack : (r() < 0.5 ? 1 : 0);
  for (let b = 0; b < nBack; b++) {
    const i = 1 + Math.floor(r() * (P.length - 1));
    const j = (i + 1) % P.length;
    const M = [(P[i].x + P[j].x) / 2, (P[i].y + P[j].y) / 2];
    const nrm = hypot(M[0], M[1]);
    const dBack = U(r, 55, 80);
    const push = (dBack / 2) * U(r, 0.55, 0.9);
    const c = [M[0] * (1 + push / nrm), M[1] * (1 + push / nrm)];
    const ok = P.every(p => hypot(p.x - c[0], p.y - c[1]) > p.od / 2 + dBack / 2 + 8);
    if (!ok) continue;
    P.splice(j === 0 ? P.length : j, 0,
      { name: 'AVARA' + b, od: dBack, contact: 'back', x: c[0], y: c[1] });
  }

  /* gergi: kaburgalı ya da sırttan, rastgele bir avara/aksesuar konumu */
  const tIdx = o.tIdx != null ? o.tIdx : 1 + Math.floor(r() * (P.length - 1));
  P[tIdx].tensioner = true;
  const tCen = [P[tIdx].x, P[tIdx].y];

  /* hubload yönünü bulmak için geçici bir çözüm; kol ona dik konur */
  let hubDir = Math.atan2(-tCen[1], -tCen[0]);                 // içe doğru (kaba)
  try {
    const g0 = C.solveGeometry(P.map(p => ({
      name: p.name, contact: p.contact, c: [p.x, p.y],
      ...C.radiiFromOD(p.od, p.contact, C.beltProps(o.belt || { profile: 'PK', brand: 'GATES' })),
    })));
    const n = P.length;
    const uIn = g0.spans[(tIdx - 1 + n) % n].u, uOut = g0.spans[tIdx].u;
    hubDir = Math.atan2(uOut[1] - uIn[1], uOut[0] - uIn[0]);
  } catch (e) { /* kaba yön kalsın */ }

  const armLength = o.armLength != null ? o.armLength : U(r, 45, 110);
  const sgn = r() < 0.5 ? +1 : -1;
  const pAng = hubDir + sgn * Math.PI / 2;
  const pivot = [tCen[0] + armLength * Math.cos(pAng), tCen[1] + armLength * Math.sin(pAng)];
  const freeAngleDeg = Math.atan2(tCen[1] - pivot[1], tCen[0] - pivot[0]) / DEG;

  const belt = Object.assign({ profile: 'PK', brand: 'GATES', ribs: 4 + Math.floor(r() * 7) },
    o.belt || {});

  const cfg = {
    pulleys: P, belt,
    driveRatio: o.driveRatio != null ? o.driveRatio : 1,
    tensioner: {
      pivot, armLength,
      preloadNm: o.preloadNm != null ? o.preloadNm : U(r, 15, 55),
      rateNmPerDeg: o.rateNmPerDeg != null ? o.rateNmPerDeg : U(r, 0.05, 0.5),
      freeAngleDeg, armInertiaKgM2: U(r, 0.0008, 0.008), pulleyMassKg: U(r, 0.35, 0.9),
    },
  };
  delete cfg.pulleys[tIdx].x; delete cfg.pulleys[tIdx].y;

  /* atalet + yük */
  let sys;
  try { sys = C.makeSystem(cfg); } catch (e) { return null; }
  const relTarget = o.relTarget != null ? o.relTarget : U(r, 8, 28);
  let st;
  try { st = C.tensionerState(sys, relTarget); } catch (e) { return null; }
  if (!isFinite(st.tensionN) || st.tensionN <= 0) return null;
  sys.belt.effLength = st.driveLenMm;
  sys.designTensionN = st.tensionN;                 /* köprünün yaptığı gibi TÜRETİLİR */

  const loads = {};
  const accs = sys.pulleys.filter((p, i) => i !== sys._crkIdx && i !== sys._tenIdx && p.contact === 'grooved');
  const tot = o.totalKw != null ? o.totalKw : U(r, 1.5, 26);
  const wts = accs.map(() => U(r, 0.2, 1));
  const wsum = wts.reduce((a, b) => a + b, 0) || 1;
  accs.forEach((p, k) => { loads[p.name] = tot * wts[k] / wsum; });
  sys.pulleys.forEach((p, i) => {
    p.inertiaKgM2 = (i === sys._crkIdx) ? U(r, 0.03, 0.09) : U(r, 0.0006, 0.012);
  });

  return { sys, cfg, loads, relTarget, tIdx: sys._tenIdx, meta: { nHull, nBack, Rc } };
}

/* ======================================================= DEĞİŞMEZLİKLER
 * Her sınama {ad, ok, dev, not} döner. dev = ölçülen sapma (birimsiz oran
 * ya da mutlak, ad içinde yazılı). */
function checks(S, opt) {
  opt = opt || {};
  const out = [];
  const add = (ad, ok, dev, not) => out.push({ ad, ok: !!ok, dev, not: not || '' });
  const sys = S.sys, loads = S.loads;
  const n = sys._n, t = sys._tenIdx, c = sys._crkIdx;
  const rel = C.meanRel(sys);
  const st = C.tensionerState(sys, rel);
  const g = st.geom;
  const rpm = opt.rpm != null ? opt.rpm : 1800;

  /* 1) kapalı çevrim: işaretli sarım toplamı tam 360 */
  add('sarım toplamı = 360° [derece]', Math.abs(Math.abs(g.signedWrapDeg) - 360) < 1e-6,
    Math.abs(Math.abs(g.signedWrapDeg) - 360));

  /* 2) özdeşlik Lpitch - Leff = 2*pi*hb  (yerleşimden BAĞIMSIZ) */
  const hb = sys._bp.hb;
  add('Lpitch−Leff = 2π·hb [mm]', Math.abs(g.LpitchMm - g.LeffMm - 2 * Math.PI * hb) < 1e-7,
    Math.abs(g.LpitchMm - g.LeffMm - 2 * Math.PI * hb));

  /* 3) boy = Σspan + Σ(sarım·r) — bağımsız yeniden toplama */
  let Ls = 0, Lw = 0;
  g.spans.forEach(s => Ls += s.L);
  g.pulleys.forEach((p, i) => Lw += g.wraps[i] * p.rEff);
  add('L_eff yeniden toplandı [bağıl]', relErr(Ls + Lw, g.LeffMm) < 1e-12, relErr(Ls + Lw, g.LeffMm));

  /* 4) teğet boyu kapalı biçim: dış/iç teğet */
  let tgWorst = 0;
  g.spans.forEach((s, i) => {
    const a = g.pulleys[i], b = g.pulleys[(i + 1) % n];
    const d = hypot(b.c[0] - a.c[0], b.c[1] - a.c[1]);
    const same = (a.contact === b.contact);
    const rho = same ? Math.abs(a.rPitch - b.rPitch) : (a.rPitch + b.rPitch);
    const Lan = Math.sqrt(d * d - rho * rho);
    tgWorst = Math.max(tgWorst, relErr(s.L, Lan));
  });
  add('teğet boyu = √(d²−ρ²) [bağıl]', tgWorst < 1e-12, tgWorst);

  /* 5) teğet noktaları kasnak çemberi üzerinde ve span teğete dik */
  let tanWorst = 0, perpWorst = 0;
  g.spans.forEach((s, i) => {
    const a = g.pulleys[i], b = g.pulleys[(i + 1) % n];
    tanWorst = Math.max(tanWorst,
      Math.abs(hypot(s.Pi[0] - a.c[0], s.Pi[1] - a.c[1]) - a.rPitch),
      Math.abs(hypot(s.Pj[0] - b.c[0], s.Pj[1] - b.c[1]) - b.rPitch));
    const ra = [s.Pi[0] - a.c[0], s.Pi[1] - a.c[1]];
    const u = s.u;
    perpWorst = Math.max(perpWorst, Math.abs(ra[0] * u[0] + ra[1] * u[1]) / a.rPitch);
  });
  add('teğet noktası çemberde [mm]', tanWorst < 1e-8, tanWorst);
  add('span yarıçapa dik [bağıl]', perpWorst < 1e-9, perpWorst);

  /* 6) take-up = −dL/dθ (sayısal türev) — analitik formülün bağımsız sınaması */
  const h = 1e-4;
  const Lp = C.tensionerState(sys, rel + h).driveLenMm;
  const Lm = C.tensionerState(sys, rel - h).driveLenMm;
  const num = -(Lp - Lm) / (2 * h);
  add('take-up = −dL/dθ [bağıl]', relErr(st.takeupMmPerDeg, num) < 2e-6,
    relErr(st.takeupMmPerDeg, num));

  /* 7) pivot momenti: teğet noktalarından hesaplanan moment = yay torku */
  const uIn = g.spans[(t - 1 + n) % n].u, uOut = g.spans[t].u;
  const Pin = g.spans[(t - 1 + n) % n].Pj, Pout = g.spans[t].Pi;
  const piv = sys.tensioner.pivot;
  const T = st.tensionN;
  const crossZ = (rx, ry, fx, fy) => rx * fy - ry * fx;
  const Mz = crossZ(Pout[0] - piv[0], Pout[1] - piv[1], T * uOut[0], T * uOut[1])
    + crossZ(Pin[0] - piv[0], Pin[1] - piv[1], -T * uIn[0], -T * uIn[1]);
  add('pivot momenti = yay torku [bağıl]',
    relErr(Math.abs(Mz) / 1000, st.springNm) < 1e-9, relErr(Math.abs(Mz) / 1000, st.springNm));

  /* 8) hubload = |T·(u_out − u_in)| */
  const hl = T * hypot(uOut[0] - uIn[0], uOut[1] - uIn[1]);
  add('hubload = |T·Δu| [bağıl]', relErr(st.hubloadN, hl) < 1e-12, relErr(st.hubloadN, hl));

  /* 9) hız tutarlılığı: v = ω_i·r_i her kasnakta */
  const tn = C.spanTensions(sys, { engineRpm: rpm, loadsKw: loads });
  let vWorst = 0;
  tn.perPulley.forEach((pp, i) => {
    const v_i = pp.accessoryRpm * 2 * Math.PI / 60 * (sys.pulleys[i].rPitch / 1000);
    vWorst = Math.max(vWorst, relErr(v_i, tn.vMs));
  });
  add('v = ω_i·r_i [bağıl]', vWorst < 1e-12, vWorst);

  /* 10) gerilme zinciri KAPANIYOR: gergi avarası girişte=çıkışta */
  const closure = Math.abs(tn.perPulley[t].entryTensionN - tn.perPulley[t].exitTensionN);
  add('gerilme çevrimi kapanıyor (ort.) [N]', closure < 1e-8, closure);

  /* 11) güç dengesi: her kasnakta ΔT·v = P */
  let pWorst = 0;
  sys.pulleys.forEach((p, i) => {
    const dT = tn.perPulley[i].exitTensionN - tn.perPulley[i].entryTensionN;
    const kw = (i === c ? tn.perPulley[c].powerKw : (loads[p.name] || 0)) * (i === c ? 1 : -1);
    pWorst = Math.max(pWorst, Math.abs(dT * tn.vMs / 1000 - kw));
  });
  add('ΔT·v = P her kasnakta [kW]', pWorst < 1e-9, pWorst);

  /* 12) Σ hubload vektörü = 0 (dış kuvvet yok) */
  const hubs = C.hubloads(g, tn.spanN);
  let sx = 0, sy = 0;
  hubs.forEach(h2 => { sx += h2.FN * Math.cos(h2.dirDeg * DEG); sy += h2.FN * Math.sin(h2.dirDeg * DEG); });
  const hSum = hypot(sx, sy) / Math.max.apply(null, hubs.map(x => x.FN));
  add('Σ hubload = 0 [bağıl]', hSum < 1e-12, hSum);

  /* 13) gergi hubload'u: gerilme zinciri ile yay dengesi aynı sayıyı vermeli */
  add('gergi hubload: zincir = yay [bağıl]', relErr(hubs[t].FN, st.hubloadN) < 1e-6,
    relErr(hubs[t].FN, st.hubloadN));

  /* 14) span frekansı: hareketli tel kapalı biçimi */
  const fr = C.spanFrequencies(sys, g, tn.spanN, { engineRpm: rpm, modes: 3 });
  let fWorst = 0, fMode = 0;
  fr.forEach((f, i) => {
    const mp = C.massPerM(sys);
    const cc = Math.sqrt(Math.max(tn.spanN[i], 0) / mp);
    const L = g.spans[i].L / 1000;
    const an = cc > tn.vMs ? (cc * cc - tn.vMs * tn.vMs) / (2 * L * cc) : 0;
    fWorst = Math.max(fWorst, relErr(f.fHz[0], an));
    if (f.fHz[0] > 0) fMode = Math.max(fMode, relErr(f.fHz[2], 3 * f.fHz[0]));
  });
  add('span frekansı = (c²−v²)/2Lc [bağıl]', fWorst < 1e-12, fWorst);
  add('harmonikler n·f1 [bağıl]', fMode < 1e-12, fMode);

  /* 15) kayma emniyeti Euler–Eytelwein ile birebir */
  const sl = C.slipSafety(g, tn.spanN);
  let slWorst = 0;
  sl.forEach((s, i) => {
    const mu = g.pulleys[i].contact === 'grooved' ? 0.90 : 0.35;
    slWorst = Math.max(slWorst, relErr(s.capstanCapacity, Math.exp(mu * g.wraps[i])));
  });
  add('kapstan kapasitesi = e^(μφ) [bağıl]', slWorst < 1e-12, slWorst);

  /* 16) ÖLÇEK DEĞİŞMEZLİĞİ: tüm uzunluklar ×s → açı aynı, T ∝ 1/s */
  const s = 2.0;
  const S2 = scaleSystem(S, s);
  if (S2) {
    const rel2 = C.meanRel(S2.sys), st2 = C.tensionerState(S2.sys, rel2);
    add('ölçek: kol açısı değişmez [derece]', Math.abs(rel2 - rel) < 1e-6, Math.abs(rel2 - rel));
    add('ölçek: sarım değişmez [derece]',
      Math.abs(st2.wrapDeg - st.wrapDeg) < 1e-6, Math.abs(st2.wrapDeg - st.wrapDeg));
    add('ölçek: T ∝ 1/s [bağıl]', relErr(st2.tensionN * s, st.tensionN) < 1e-7,
      relErr(st2.tensionN * s, st.tensionN));
    add('ölçek: L ∝ s [bağıl]', relErr(st2.driveLenMm, st.driveLenMm * s) < 1e-9,
      relErr(st2.driveLenMm, st.driveLenMm * s));
  }

  /* 17) DÖNME DEĞİŞMEZLİĞİ: yerleşimi 37° döndür */
  const th = 37 * DEG;
  const S3 = rotateSystem(S, th);
  if (S3) {
    const rel3 = C.meanRel(S3.sys), st3 = C.tensionerState(S3.sys, rel3);
    add('dönme: T değişmez [bağıl]', relErr(st3.tensionN, st.tensionN) < 1e-9,
      relErr(st3.tensionN, st.tensionN));
    add('dönme: L değişmez [bağıl]', relErr(st3.driveLenMm, st.driveLenMm) < 1e-10,
      relErr(st3.driveLenMm, st.driveLenMm));
    const d0 = st.hubDirDeg + 37, d1 = st3.hubDirDeg;
    const dd = Math.abs(((d1 - d0) % 360 + 540) % 360 - 180);
    add('dönme: hubload yönü +37° [derece]', dd < 1e-7, dd);
  }

  /* 18) ETİKETLEME DEĞİŞMEZLİĞİ: kasnak listesini çevrimsel kaydır */
  const S4 = cyclicShift(S, 1 + (S.sys._n > 3 ? 1 : 0));
  if (S4) {
    const rel4 = C.meanRel(S4.sys), st4 = C.tensionerState(S4.sys, rel4);
    add('çevrimsel kaydırma: T aynı [bağıl]', relErr(st4.tensionN, st.tensionN) < 1e-9,
      relErr(st4.tensionN, st.tensionN));
    add('çevrimsel kaydırma: L aynı [bağıl]', relErr(st4.driveLenMm, st.driveLenMm) < 1e-10,
      relErr(st4.driveLenMm, st.driveLenMm));
    const tn4 = C.spanTensions(S4.sys, { engineRpm: rpm, loadsKw: loads });
    const m0 = Math.max.apply(null, tn.spanN), m4 = Math.max.apply(null, tn4.spanN);
    add('çevrimsel kaydırma: T_max aynı [bağıl]', relErr(m4, m0) < 1e-9, relErr(m4, m0));
  }

  /* 19) monotonluk. GERÇEKÇİ kol yolu (≤45°) kapıdır; çekirdeğin izin
   *     verdiği TÜM aralıkta durağan nokta ayrıca ÖLÇÜLÜR (bisection'ın tek
   *     kök varsayımı orada çöker). */
  const hiRel = C.feasibleRelMax(sys);
  const sweep = (hi) => {
    let monoL = true, monoT = true, prevL = Infinity, prevT = -Infinity, statRel = null;
    for (let k = 0; k <= 60; k++) {
      const rr = hi * k / 60 * 0.999 + 1e-4;
      let s2; try { s2 = C.tensionerState(sys, rr); } catch (e) { break; }
      if (s2.driveLenMm > prevL + 1e-9) { if (monoL) statRel = rr; monoL = false; }
      if (s2.tensionN < prevT - 1e-9) monoT = false;
      prevL = s2.driveLenMm; prevT = s2.tensionN;
    }
    return { monoL, monoT, statRel };
  };
  const swReal = sweep(Math.min(hiRel, 45));
  const swFull = sweep(hiRel);
  add('L(θ) azalan (kol yolu ≤45°)', swReal.monoL, 0);
  add('T(θ) artan (kol yolu ≤45°)', swReal.monoT, 0);
  out._hiRel = hiRel; out._statRel = swFull.statRel; out._monoFull = swFull.monoL;

  /* 20) burulma modeli: bir rijit cisim modu + take-up toplamı */
  let tor = null;
  try { tor = C.torsionalModel(sys, { relDeg: rel }); } catch (e) { }
  if (tor && !tor.error) {
    add('burulma: tek rijit cisim modu', tor.rigidBodyModes === 1, tor.rigidBodyModes);
    add('burulma: take-up toplamı [%]', tor.takeupCheck.errPct < 1e-3, tor.takeupCheck.errPct);
    /* K simetrik ve yarı-pozitif */
    let sym = 0, neg = 0;
    const K = tor.matrices.K, N = K.length;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++)
      sym = Math.max(sym, Math.abs(K[i][j] - K[j][i]) / Math.max(1, Math.abs(K[i][j])));
    tor.modes.forEach(m => { if (!(m.fHz >= 0)) neg++; });
    add('burulma: K simetrik [bağıl]', sym < 1e-12, sym);
    add('burulma: frekanslar reel', neg === 0, neg);
    /* rijit cisim modu θ_i ∝ 1/R_i */
    const rb = tor.modes[0].shape;
    let rbW = 0;
    const base = rb[0].amp * sys.pulleys[0].rPitch;
    sys.pulleys.forEach((p, i) => { rbW = Math.max(rbW, relErr(rb[i].amp * p.rPitch, base)); });
    add('burulma: rijit mod θ∝1/R [bağıl]', rbW < 1e-6, rbW);
  }

  return { out, rel, st, g, tn, tor, hubs, sl, fr };
}

/* ------------------------------------------------- dönüşümler */
function cloneCfg(S) {
  const cfg = JSON.parse(JSON.stringify(S.cfg));
  /* çözülmüş sys'ten türetilmiş alanları taşı */
  cfg.belt.effLength = S.sys.belt.effLength;
  cfg.designTensionN = S.sys.designTensionN;
  S.sys.pulleys.forEach((p, i) => { cfg.pulleys[i].inertiaKgM2 = p.inertiaKgM2; });
  return cfg;
}
function rebuild(cfg, S) {
  let sys; try { sys = C.makeSystem(cfg); } catch (e) { return null; }
  sys.belt.effLength = cfg.belt.effLength;
  sys.designTensionN = cfg.designTensionN;
  return { sys, cfg, loads: S.loads, relTarget: S.relTarget, tIdx: sys._tenIdx, meta: S.meta };
}
function scaleSystem(S, s) {
  const cfg = cloneCfg(S);
  cfg.pulleys.forEach(p => { p.od *= s; if (p.x != null) { p.x *= s; p.y *= s; } });
  cfg.tensioner.pivot = [cfg.tensioner.pivot[0] * s, cfg.tensioner.pivot[1] * s];
  cfg.tensioner.armLength *= s;
  cfg.belt = Object.assign({}, cfg.belt, {
    hb: S.sys._bp.hb * s, hr: S.sys._bp.hr * s,
    effLength: cfg.belt.effLength * s, massPerM: C.massPerM(S.sys),
  });
  return rebuild(cfg, S);
}
function rotateSystem(S, th) {
  const cfg = cloneCfg(S);
  cfg.pulleys.forEach(p => { if (p.x != null) { const q = rot([p.x, p.y], th); p.x = q[0]; p.y = q[1]; } });
  cfg.tensioner.pivot = rot(cfg.tensioner.pivot, th);
  cfg.tensioner.freeAngleDeg += th / DEG;
  if (S.sys.tensioner.sense != null) cfg.tensioner.sense = S.sys.tensioner.sense;
  return rebuild(cfg, S);
}
function cyclicShift(S, k) {
  const cfg = cloneCfg(S);
  const n = cfg.pulleys.length;
  cfg.pulleys = cfg.pulleys.slice(k % n).concat(cfg.pulleys.slice(0, k % n));
  if (S.sys.tensioner.sense != null) cfg.tensioner.sense = S.sys.tensioner.sense;
  return rebuild(cfg, S);
}

module.exports = { C, rng, U, pick, genSystem, checks, relErr, scaleSystem, rotateSystem, cyclicShift, cloneCfg, rebuild, DEG };
