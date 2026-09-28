/**
 * step-ornek.js — SENTETİK FEAD MONTAJLARI (STEP metni)
 *
 * 2B bir FEAD düzenini, kullanıcının 3DEXPERIENCE montajının kalıbında bir
 * STEP dosyasına yerleştirir (yazıcı: ./step-yaz.js). Üç test yüzeyi AYNI
 * dosyayı kullanıyor — tanıyıcı (tests/unit/fead-step.test.js), sihirbazın
 * aktarımı (tests/unit/fead-wizard-step.test.js) ve gerçek tarayıcı
 * (tests/e2e/fead-step.spec.js) — yani üçü aynı düzeni ölçüyor.
 *
 * Dünya: kayış düzlemi X = duzlem; 2B (x, y) → dünya (Y = Yc − x, Z = Zc + y).
 * Orijin (0,0,0) düzlemin +X tarafında → "motor arkada" → önden bakış +X.
 * `opt.motor: '-X'` motoru düzlemin öbür yanına koyar (düzlem X = +250); önden
 * bakış o zaman −X yönüne bakar ve aynı 2B düzen Y = Yc + x ile yerleşir.
 */
const Y = require('./step-yaz.js');

const D = Math.PI / 180;
const X = [1, 0, 0];

function feadStep(parcalar, opt = {}) {
  const yz = new Y.StepYaz({ uzunluk: opt.uzunluk, aci: opt.aci });
  const eksi = opt.motor === '-X';
  const duzlem = opt.duzlem !== undefined ? opt.duzlem : (eksi ? 250 : -250), Yc = 40, Zc = 390;
  const dunya = (x, y, s) => [duzlem + s, eksi ? Yc + x : Yc - x, Zc + y];
  const kok = yz.urun('ROOT', opt.kokAd || 'PROGRAMLIK TEST');
  const takilar = [];
  for (const p of parcalar) {
    const u = yz.urun(p.id, p.ad);
    const yuzler = [];
    for (const g of p.geometri) {
      const eks = Y.eksen(g.yerel || [0, 0, 0], [0, 0, 1], [1, 0, 0]);
      yuzler.push(...Y.profilYuzleri(yz, eks, g.profil));
    }
    if (yuzler.length) yz.govde(u, yuzler, p.govde);
    const zDunya = p.ters ? [-1, 0, 0] : X;
    const xd = p.xDunya || [0, Math.cos(p.donus || 0), Math.sin(p.donus || 0)];
    const xDunya = eksi ? [xd[0], -xd[1], xd[2]] : xd;
    if (p.eskiz) {
      // Düzen (x, y) → dünya → parçanın yerel çerçevesi (yerleşimin tersi)
      const O = dunya(p.x, p.y, 0), zl = zDunya, xl = xDunya;
      const yl = [zl[1] * xl[2] - zl[2] * xl[1], zl[2] * xl[0] - zl[0] * xl[2], zl[0] * xl[1] - zl[1] * xl[0]];
      const yerel = (w) => { const d = [w[0] - O[0], w[1] - O[1], w[2] - O[2]]; const t = (e) => d[0] * e[0] + d[1] * e[1] + d[2] * e[2]; return [t(xl), t(yl), t(zl)]; };
      const nok = (q) => yerel(dunya(q[0], q[1], p.eskiz.s || 0));
      const nY = [X[0] * xl[0] + X[1] * xl[1] + X[2] * xl[2], X[0] * yl[0] + X[1] * yl[1] + X[2] * yl[2], X[0] * zl[0] + X[1] * zl[1] + X[2] * zl[2]];
      yz.eskiz(u, p.eskiz.ad || 'Sketch.2', p.eskiz.parcalar.map((q) => {
        if (q.tip === 'LINE') return { tip: 'LINE', p1: nok(q.a), p2: nok(q.b), ters: !!q.ters };
        const c = nok(q.c), p1 = nok(q.a), p2 = nok(q.b);
        const A = [p1[0] - c[0], p1[1] - c[1], p1[2] - c[2]], B = [p2[0] - c[0], p2[1] - c[1], p2[2] - c[2]];
        const cr = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
        let th = Math.atan2(cr[0] * nY[0] + cr[1] * nY[1] + cr[2] * nY[2], A[0] * B[0] + A[1] * B[1] + A[2] * B[2]);
        if (th <= 1e-12) th += 2 * Math.PI;
        const xa = Math.abs(nY[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        return { tip: 'CIRCLE', c, n: nY, x: xa, r: q.r, p1, p2, yon: Math.abs(th - q.aci) < 1e-6 ? 1 : -1, ters: !!q.ters };
      }));
    }
    yz.temsil(u);
    takilar.push(yz.tak(kok, u, p.id + '.1', dunya(p.x, p.y, 0), zDunya, xDunya, { ters: p.rrTers }));
  }
  yz.temsil(kok);
  takilar.forEach((t) => yz.bagla(t));
  return yz.metin();
}

// Gates AG00686 (8PK1475HD, 4 kasnak) — tests/unit/fead-model.test.js ile aynı düzen
const AG = {
  crk: { od: 160, x: 0, y: 0 },
  idr: { od: 75, x: -72, y: 267 },
  ac: { od: 127, x: -224, y: 448 },
  piv: { x: -180, y: 100 }, kol: 90, aci: 75.1,
};
AG.ten = { od: 75, x: AG.piv.x + AG.kol * Math.cos(AG.aci * D), y: AG.piv.y + AG.kol * Math.sin(AG.aci * D) };

function gergiParcasi(ad, c, p, opt = {}) {
  // Yerel: avara orijinde; pivot yerel +x'te kol kadar uzakta. Yerel x, dünyada
  // avaradan pivota bakan yön olur.
  const dx = p.x - c.x, dy = p.y - c.y, L = Math.hypot(dx, dy);
  return {
    id: opt.id || 'GERGI-1', ad, x: c.x, y: c.y,
    xDunya: [0, -dx / L, dy / L],
    // pivot göbeği: her parça 6,67 mm (düz kasnak eşiği 5 mm'nin ÜSTÜNDE —
    // yani gövde de bir "kasnak adayı" ve seçimi kazanmamalı)
    geometri: [
      { profil: Y.duzProfil({ od: 75 }) },
      { profil: Y.pivotProfil({ yuzSayisi: opt.pivotYuz || 6, s0: 20, s1: 20 + 6.67 * (opt.pivotYuz || 6) }), yerel: [L, 0, 0] },
    ],
  };
}

function ag00686Step(opt = {}) {
  return feadStep([
    { id: '147KASNAK', ad: 'KRANK KASNAK-Ø160\n 8PK', x: AG.crk.x, y: AG.crk.y, govde: 'kati', donus: 0.4,
      geometri: [{ profil: Y.kanalliProfil({ od: AG.crk.od, n: 8, omuz: 163.5 }) }] },
    { id: 'AVARA-1', ad: 'AVARA KASNAK Ø75x32,5', x: AG.idr.x, y: AG.idr.y, ters: true, donus: 1.1,
      geometri: [{ profil: Y.duzProfil({ od: AG.idr.od }) }] },
    { id: 'KLIMA-1', ad: 'KLİMA KOMPRESÖRÜ-Ø127-8PK', x: AG.ac.x, y: AG.ac.y, ters: true, donus: 2.3, rrTers: true,
      geometri: [{ profil: Y.kanalliProfil({ od: AG.ac.od, n: 8, omuz: 141, tepeBol: true, kenarYanak: true, tepeR: 0.25, icDuzlem: !!opt.klimaIcDuzlem }) }] },
    gergiParcasi('OTOMATİK GERGİ-T38624', AG.ten, AG.piv, { pivotYuz: 9 }),
    // Kayış katısı kullanıcının dosyasındaki gibi kanalsız bir bant; genişliği
    // kanal × adım (8 × 3,56) — tanıyıcı kanal sayısını buradan da sağlar.
    { id: 'KAYIS', ad: 'KAYIŞ - 8PK1475', x: 0, y: 0, geometri: [{ profil: Y.duzProfil({ od: 170, w: opt.kayisW || 28.48 }) }],
      eskiz: opt.eskiz ? agEskiz(opt.eskiz) : null },
  ], opt);
}

// KAYIŞ ESKİZİ — CAD'in kord çizgisi: kasnak yarıçapı + h_b (kaburgalı) /
// + h_r (sırt), teğetler ve sarımlar ÇEKİRDEĞİN geometrisinden (solveGeometry).
// Kullanıcının dosyasındaki gibi yay, doğru, yay… sırasıyla kapalı bir eğri.
// opt.ofset: kasnak başına ofseti ezer (tutarsız eskiz tuzağı); opt.kaydir:
// kasnağın eskizdeki merkezini kaydırır (eskiz o kasnaktan geçmez).
function agEskiz({ hb = 1.5, hr = 1.5, ofset = {}, kaydir = {}, sonTers = false, acik = false } = {}) {
  const F = require('../../js/fead-core.js');
  const K = [
    { name: 'CRK', c: [AG.crk.x, AG.crk.y], od: AG.crk.od, contact: 'grooved' },
    { name: 'IDR', c: [AG.idr.x, AG.idr.y], od: AG.idr.od, contact: 'back' },
    { name: 'A_C', c: [AG.ac.x, AG.ac.y], od: AG.ac.od, contact: 'grooved' },
    { name: 'TEN', c: [AG.ten.x, AG.ten.y], od: AG.ten.od, contact: 'back' },
  ].map((k) => Object.assign(k, { c: kaydir[k.name] ? [k.c[0] + kaydir[k.name][0], k.c[1] + kaydir[k.name][1]] : k.c,
    rPitch: k.od / 2 + (ofset[k.name] !== undefined ? ofset[k.name] : (k.contact === 'grooved' ? hb : hr)) })
  ).map((k) => Object.assign(k, { rEff: k.rPitch }));
  const g = F.solveGeometry(K);
  const n = K.length, parcalar = [];
  for (let i = 0; i < n; i++) {
    const gir = g.spans[(i - 1 + n) % n].Pj, cik = g.spans[i].Pi;
    parcalar.push({ tip: 'CIRCLE', c: K[i].c, r: K[i].rPitch, a: gir, b: cik, aci: g.wraps[i] });
    parcalar.push({ tip: 'LINE', a: g.spans[i].Pi, b: g.spans[i].Pj });
  }
  if (sonTers) parcalar[parcalar.length - 1].ters = true;   // son parça ters yazılır (same_sense .F.)
  if (acik) parcalar.pop();                                  // açık eğri: son doğru yok
  return { ad: 'Sketch.2', parcalar, L: g.LpitchMm, geom: g };
}

// Gates raporunun AG00686 sonuçları (gergi Mean konumu, rel 33,1°) — köprü
// zincirinin kapısı. Yay künyesi STEP'te YOK; kullanıcı sihirbazın gergi
// adımında girer — testler raporun künyesini buradan alır.
const AG_REF = {
  span: { CRK: 249.2, IDR: 212.6, A_C: 248.9, TEN: 212.6 },
  wrap: { CRK: 210.2, IDR: 26.7, A_C: 202.9, TEN: 26.4 },
  relMean: 33.1,
  yay: { preload: 8.59, kArm: 0.482, meanLoad: 24.5442, loadStopRelDeg: 62.4 },
};

// Tedarikçinin gergisi ALT MONTAJ (kasnak + kol ayrı parça), yanında bir krank.
// Kullanıcı: "STEP alt parçalı gelir; bir üst komple olur, onun altında
// parçalar olur" — rol üst düğüme verilir, iki parça tek birim olur.
function gergiAltMontaj() {
  const yz = new Y.StepYaz();
  const kok = yz.urun('ROOT', 'MONTAJ');
  const grg = yz.urun('GERGI-ASSY', 'OTOMATİK GERGİ');
  const kas = yz.urun('P1', 'KASNAK');
  const kol = yz.urun('P2', 'KOL');
  const krk = yz.urun('P3', 'KRANK');
  yz.govde(kas, Y.profilYuzleri(yz, Y.eksen(), Y.duzProfil({ od: 75 })));
  yz.govde(kol, Y.profilYuzleri(yz, Y.eksen([90, 0, 0]), Y.pivotProfil()));
  yz.govde(krk, Y.profilYuzleri(yz, Y.eksen(), Y.kanalliProfil({ od: 150, n: 8 })));
  [kas, kol, krk].forEach((u) => yz.temsil(u));
  const t1 = yz.tak(grg, kas, 'P1.1', [0, 0, 0]), t2 = yz.tak(grg, kol, 'P2.1', [0, 0, 0]);
  yz.temsil(grg);
  const t3 = yz.tak(kok, grg, 'GERGI-ASSY.1', [0, 120, 0]), t4 = yz.tak(kok, krk, 'P3.1', [0, -150, 0]);
  yz.temsil(kok);
  [t1, t2, t3, t4].forEach((t) => yz.bagla(t));
  return yz.metin();
}

// ── TUZAK MONTAJLAR — gergi önerisinin (veFeadStpOner) kuralları ──────────
// Her biri kuralların BİRİ kapanınca yanlış bir gergi işaretletir; bütün
// kurallar açıkken aday çıkmaz (tests/unit/fead-step-oner.test.js).
const halka = (r0, r1, s0, s1) => [
  { tip: 'dogru', s0, r0: r1, s1, r1 }, { tip: 'dogru', s0, r0, s1, r1: r0 },
  { tip: 'dogru', s0, r0, s1: s0, r1 }, { tip: 'dogru', s0: s1, r0, s1, r1 }];
const TUZAK = {
  // aksesuar: gövdesi kasnağıyla eşeksenli (r 60), gövdede kasnağa paralel bir kulak deliği 110 mm'de
  alternatorKulakR22: () => feadStep([
    { id: 'K', ad: 'PART-001', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 6 }) }] },
    { id: 'L', ad: 'PART-003', x: 200, y: 60, xDunya: [0, -1, 0], geometri: [
      { profil: Y.kanalliProfil({ od: 56, n: 6 }) },
      { profil: [{ tip: 'dogru', s0: 30, r0: 60, s1: 110, r1: 60 }, { tip: 'dogru', s0: 30, r0: 12, s1: 30, r1: 60 }] },
      { profil: halka(5, 22, 40, 60).concat(halka(5, 22, 90, 105)), yerel: [110, 0, 0] }] }]),
  alternatorKulakR12: () => feadStep([
    { id: 'K', ad: 'PART-001', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 6 }) }] },
    { id: 'L', ad: 'PART-003', x: 200, y: 60, xDunya: [0, -1, 0], geometri: [
      { profil: Y.kanalliProfil({ od: 56, n: 6 }) },
      { profil: halka(5, 12, 40, 60).concat(halka(5, 12, 90, 105)), yerel: [110, 0, 0] }] }]),
  ciftAvaraFarkli: () => feadStep([
    { id: 'K', ad: 'PART-001', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 8 }) }] },
    { id: 'A', ad: 'PART-004', x: 260, y: 160, geometri: [{ profil: Y.kanalliProfil({ od: 120, n: 8 }) }] },
    { id: 'D', ad: 'PART-005', x: 150, y: 20, xDunya: [0, -1, 0], geometri: [
      { profil: Y.duzProfil({ od: 75 }) }, { profil: Y.kanalliProfil({ od: 70, n: 8 }), yerel: [110, 0, 0] }] }]),
  // krank: cıvata dairesi — 6 eş delik 45 mm'de (disk içinde), her biri göbek ölçüsünde (r 20, 8 yüz)
  krankCivataDairesi: () => {
    const delik = [];
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      delik.push({ profil: Y.pivotProfil({ yuzSayisi: 8, s0: 20, s1: 60 }), yerel: [45 * Math.cos(a), 45 * Math.sin(a), 0] });
    }
    return feadStep([
      { id: 'K', ad: 'PART-001', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 8 }) }].concat(delik) },
      { id: 'A', ad: 'PART-004', x: 260, y: 160, geometri: [{ profil: Y.kanalliProfil({ od: 120, n: 8 }) }] }]);
  },
  // R1: kasnak diskinin İÇİNDE tek göbek (eş değil, göbek ölçüsünde) — krank
  diskIciGobek: () => feadStep([
    { id: 'K', ad: 'PART-001', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 8 }) },
      { profil: Y.pivotProfil({ yuzSayisi: 8, s0: 20, s1: 60 }), yerel: [45, 0, 0] }] },
    { id: 'A', ad: 'PART-004', x: 260, y: 160, geometri: [{ profil: Y.kanalliProfil({ od: 120, n: 8 }) }] }]),
  // R3: disk DIŞINDA üç EŞ göbek (bağlantı flanşı) — aksesuar
  disaridaEsGobek: () => {
    const g = [0, 1, 2].map((i) => ({ profil: Y.pivotProfil({ yuzSayisi: 8, s0: 20, s1: 60 }),
      yerel: [100 * Math.cos(i * 2 * Math.PI / 3), 100 * Math.sin(i * 2 * Math.PI / 3), 0] }));
    return feadStep([
      { id: 'K', ad: 'PART-001', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 8 }) }] },
      { id: 'A', ad: 'PART-004', x: 260, y: 160, geometri: [{ profil: Y.kanalliProfil({ od: 120, n: 8 }) }].concat(g) }]);
  },
  // RP: İKİNCİ kayışın gergisi — kayış düzleminin 60 mm gerisinde
  ikinciKayisGergisi: () => feadStep([
    { id: 'K', ad: 'PART-001', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 8 }) }] },
    { id: 'A', ad: 'PART-004', x: 260, y: 160, geometri: [{ profil: Y.kanalliProfil({ od: 120, n: 8 }) }] },
    { id: 'T', ad: 'PART-006', x: 120, y: 60, xDunya: [0, -1, 0], geometri: [
      { profil: Y.duzProfil({ od: 75 }), yerel: [0, 0, -60] },
      { profil: Y.pivotProfil({ yuzSayisi: 9, s0: -40, s1: 20 }), yerel: [90, 0, -60] }] }]),
  // R4: kulak 300 mm'de — kol aralığının dışında
  uzakKulak: () => feadStep([
    { id: 'K', ad: 'PART-001', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 6 }) }] },
    { id: 'L', ad: 'PART-003', x: 200, y: 60, xDunya: [0, -1, 0], geometri: [
      { profil: Y.duzProfil({ od: 75 }) },
      { profil: Y.pivotProfil({ yuzSayisi: 9, s0: 20, s1: 60 }), yerel: [300, 0, 0] }] }]),
  // R5: avara braketinin göbeği BAŞKA bir birimin kasnağıyla eşeksenli
  esEksenBraket: () => feadStep([
    { id: 'K', ad: 'PART-001', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 8 }) }] },
    { id: 'W', ad: 'PART-007', x: 120, y: 200, geometri: [{ profil: Y.kanalliProfil({ od: 110, n: 8 }) }] },
    { id: 'B', ad: 'PART-008', x: 120, y: 90, xDunya: [0, 0, 1], geometri: [
      { profil: Y.duzProfil({ od: 75 }) },
      { profil: Y.pivotProfil({ yuzSayisi: 9, s0: 20, s1: 60 }), yerel: [110, 0, 0] }] }]),
  kaburgaliGergiKol56: () => feadStep([
    { id: 'K', ad: 'PART-001', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 6 }) }] },
    { id: 'T', ad: 'PART-002', x: 150, y: 120, xDunya: [0, -1, 0], geometri: [
      { profil: Y.kanalliProfil({ od: 70, n: 6 }) },
      { profil: Y.pivotProfil({ yuzSayisi: 12, s0: 20, s1: 60 }), yerel: [56, 0, 0] }] }]),
  ikiIzliDamper: () => feadStep([
    { id: 'K', ad: 'KRANK DAMPER', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 8 }) }, { profil: Y.kanalliProfil({ od: 172, n: 6 }), yerel: [0, 0, -40] }] },
    { id: 'A', ad: 'KLİMA KOMPRESÖRÜ', x: 250, y: 200, geometri: [{ profil: Y.kanalliProfil({ od: 120, n: 8 }) }] },
    { id: 'I', ad: 'AVARA', x: 150, y: 20, geometri: [{ profil: Y.duzProfil({ od: 75 }) }] }]),
  kaburgaliAvara: () => feadStep([
    { id: 'K', ad: 'KRANK KASNAK', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 8 }) }] },
    { id: 'I', ad: 'AVARA KABURGALI', x: 140, y: 110, geometri: [{ profil: Y.kanalliProfil({ od: 70, n: 8 }) }] }]),
};
function tuzak(ad) { return TUZAK[ad](); }

// Gergi PARÇASI bir ara montajın içinde (ÖN BLOK › gergi + avara): bayrak
// en küçük birime — parçaya — gider, ara montaja değil.
function gergiIcIceMontaj() {
  const yz = new Y.StepYaz();
  const kok = yz.urun('ROOT', 'MONTAJ');
  const blok = yz.urun('BLOK', 'ÖN BLOK');
  const grg = yz.urun('G1', 'OTOMATİK GERGİ');
  const avr = yz.urun('A1', 'AVARA');
  const krk = yz.urun('K1', 'KRANK');
  yz.govde(grg, Y.profilYuzleri(yz, Y.eksen(), Y.duzProfil({ od: 75 }))
    .concat(Y.profilYuzleri(yz, Y.eksen([90, 0, 0]), Y.pivotProfil({ yuzSayisi: 9 }))));
  yz.govde(avr, Y.profilYuzleri(yz, Y.eksen(), Y.duzProfil({ od: 70 })));
  yz.govde(krk, Y.profilYuzleri(yz, Y.eksen(), Y.kanalliProfil({ od: 150, n: 8 })));
  [grg, avr, krk].forEach((u) => yz.temsil(u));
  const t1 = yz.tak(blok, grg, 'G1.1', [0, 0, 0]), t2 = yz.tak(blok, avr, 'A1.1', [0, 160, 0]);
  yz.temsil(blok);
  const t3 = yz.tak(kok, blok, 'BLOK.1', [0, 120, 0]), t4 = yz.tak(kok, krk, 'K1.1', [0, -150, 0]);
  yz.temsil(kok);
  [t1, t2, t3, t4].forEach((t) => yz.bagla(t));
  return yz.metin();
}

module.exports = { gergiAltMontaj, feadStep, AG, AG_REF, gergiParcasi, ag00686Step, agEskiz, D, X, tuzak, TUZAK, gergiIcIceMontaj };
