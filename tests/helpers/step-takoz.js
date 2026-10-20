/**
 * step-takoz.js — SENTETİK GÜÇ GRUBU MONTAJI (STEP metni) — Takoz testleri için.
 *
 * Takoz'un "STEP'ten başla" kapısı (js/mount-step.js) gövdelerin hacim merkezini
 * ve ataletini, takozların konumunu üçgen ağından ölçer. Bu yazıcı ANALİTİK
 * cevabı bilinen katılar kurar — dikdörtgen kutu ve silindir — ve onları bir
 * montajda, gerçek bir CATIA dosyasının kalıbında (CDSR → RRWT → IDT, alt
 * montaj, döndürülmüş yerel eksen) dünyaya yerleştirir:
 *   kutu (a × b × c, kütle m)  : merkez = konum; Ixx = m(b²+c²)/12 …
 *   silindir (r, L, eksen z)   : Izz = m r²/2, Ixx = Iyy = m(3r² + L²)/12
 * Yüzler ISO 10303-42'nin yön kuralıyla yazılır (yüzün normali dışarı) —
 * üçgenleyici yönü yüzün bayrağından alır, hacmin işareti oradan gelir.
 */
const Y = require('./step-yaz.js');

const PI = Math.PI;
const cros = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const fark = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const nok = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Yerel eksende, orijin merkezli kutu: 8 köşe, 12 doğru kenar (paylaşılan),
// 6 düzlem yüz — döngü dış normalin çevresinde saat yönünün tersine.
function kutuYuzleri(yz, a, b, c) {
  const h = [a / 2, b / 2, c / 2];
  const P = {};
  const V = {};
  [0, 1].forEach((i) => [0, 1].forEach((j) => [0, 1].forEach((k) => {
    const id = '' + i + j + k;
    P[id] = [(i ? 1 : -1) * h[0], (j ? 1 : -1) * h[1], (k ? 1 : -1) * h[2]];
    V[id] = yz.tepe(P[id]);
  })));
  const kenar = {};
  const kenarAl = (p, q) => {
    const k = p < q ? p + q : q + p;
    if (!kenar[k]) {
      const [s, e] = p < q ? [p, q] : [q, p];
      kenar[k] = { bas: s, ec: yz.kenarEgri(V[s], V[e], yz._cizgi(P[s], P[e])) };
    }
    return yz.yonlu(kenar[k].ec, kenar[k].bas === p);
  };
  // [normal, dört köşe (herhangi bir dönme sırası)]
  const yuzTanim = [
    [[1, 0, 0], ['100', '110', '111', '101']], [[-1, 0, 0], ['000', '001', '011', '010']],
    [[0, 1, 0], ['010', '011', '111', '110']], [[0, -1, 0], ['000', '100', '101', '001']],
    [[0, 0, 1], ['001', '101', '111', '011']], [[0, 0, -1], ['000', '010', '110', '100']]
  ];
  return yuzTanim.map(([n, kose]) => {
    // Sıra dış normalin çevresinde saat tersine değilse çevir
    const e1 = fark(P[kose[1]], P[kose[0]]), e2 = fark(P[kose[2]], P[kose[1]]);
    const sira = nok(cros(e1, e2), n) > 0 ? kose : kose.slice().reverse();
    const merkez = [n[0] * h[0], n[1] * h[1], n[2] * h[2]];
    const xd = Math.abs(n[0]) > 0.5 ? [0, 1, 0] : [1, 0, 0];
    const yuzey = yz.ekle("PLANE('',#" + yz.cerceve(merkez, n, xd) + ')');
    const dongu = sira.map((p, i) => kenarAl(p, sira[(i + 1) % 4]));
    return yz.yuz(yuzey, dongu);
  });
}

// Yerel eksende orijin merkezli ŞİŞKİN KUTU — döküm yüzeyinin kalıbı: altı
// yüzün her biri bikübik B-spline (n × n kontrol noktası, kelepçeli düğüm),
// kenarlar kutunun 12 doğrusu (paylaşılan), iç noktalar dış normal boyunca
// h·sin(πu)·sin(πv) kadar şişkin. Kelepçeli düğümde parametre yay boyuna
// düzgün dağılmaz: kenar boyunca eşit aralıklı kontrol noktaları kenarın
// uçlarına yakın sıkışan bir parametre verir (üçgenleyicinin tuzağı).
function bsKutuYuzleri(yz, a, b, c, n = 10, h = 5) {
  const hh = [a / 2, b / 2, c / 2];
  const P = {};
  const V = {};
  [0, 1].forEach((i) => [0, 1].forEach((j) => [0, 1].forEach((k) => {
    const id = '' + i + j + k;
    P[id] = [(i ? 1 : -1) * hh[0], (j ? 1 : -1) * hh[1], (k ? 1 : -1) * hh[2]];
    V[id] = yz.tepe(P[id]);
  })));
  const kenar = {};
  const kenarAl = (p, q) => {
    const k = p < q ? p + q : q + p;
    if (!kenar[k]) {
      const [s, e] = p < q ? [p, q] : [q, p];
      kenar[k] = { bas: s, ec: yz.kenarEgri(V[s], V[e], yz._cizgi(P[s], P[e])) };
    }
    return yz.yonlu(kenar[k].ec, kenar[k].bas === p);
  };
  const yuzTanim = [
    [[1, 0, 0], ['100', '110', '111', '101']], [[-1, 0, 0], ['000', '001', '011', '010']],
    [[0, 1, 0], ['010', '011', '111', '110']], [[0, -1, 0], ['000', '100', '101', '001']],
    [[0, 0, 1], ['001', '101', '111', '011']], [[0, 0, -1], ['000', '010', '110', '100']]
  ];
  const kat = [4].concat(Array(n - 4).fill(1)).concat([4]).join(',');
  const dugum = Array.from({ length: n - 2 }, (_, i) => i + '.').join(',');
  return yuzTanim.map(([nrm, kose]) => {
    const e1 = fark(P[kose[1]], P[kose[0]]), e2 = fark(P[kose[2]], P[kose[1]]);
    const sira = nok(cros(e1, e2), nrm) > 0 ? kose : kose.slice().reverse();
    const K = sira.map((x) => P[x]);
    // S(u,v) çift doğrusal: K0 → K1 u yönü, K0 → K3 v yönü; ∂u × ∂v dış normal
    const satirlar = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), satir = [];
      for (let j = 0; j < n; j++) {
        const v = j / (n - 1), w = h * Math.sin(PI * u) * Math.sin(PI * v);
        satir.push('#' + yz.nokta([0, 1, 2].map((d) => (1 - u) * (1 - v) * K[0][d] + u * (1 - v) * K[1][d]
          + u * v * K[2][d] + (1 - u) * v * K[3][d] + nrm[d] * w)));
      }
      satirlar.push('(' + satir.join(',') + ')');
    }
    const yuzey = yz.ekle("B_SPLINE_SURFACE_WITH_KNOTS('',3,3,(" + satirlar.join(',') + '),.UNSPECIFIED.,.F.,.F.,.F.,('
      + kat + '),(' + kat + '),(' + dugum + '),(' + dugum + '),.UNSPECIFIED.)');
    return yz.yuz(yuzey, sira.map((p, i) => kenarAl(p, sira[(i + 1) % 4])));
  });
}

// Yerel eksende z boyunca, orijin MERKEZLİ silindir (step-ucgen.test.js'in
// silindirKati'si, alt disk −L/2'de): iki yarım yan yüz + iki disk.
function silindirYuzleri(yz, r, L) {
  const z = [0, 0, 1], x = [1, 0, 0], s0 = -L / 2, s1 = L / 2;
  const P3 = (a, s) => [r * Math.cos(a), r * Math.sin(a), s];
  const c0 = yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, s0], z, x) + ',' + yz.L(r) + ')');
  const c1 = yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, s1], z, x) + ',' + yz.L(r) + ')');
  const v00 = yz.tepe(P3(0, s0)), v0p = yz.tepe(P3(PI, s0)), v10 = yz.tepe(P3(0, s1)), v1p = yz.tepe(P3(PI, s1));
  const alt1 = yz.kenarEgri(v00, v0p, c0), alt2 = yz.kenarEgri(v0p, v00, c0);
  const ust1 = yz.kenarEgri(v10, v1p, c1), ust2 = yz.kenarEgri(v1p, v10, c1);
  const y0 = yz.kenarEgri(v00, v10, yz._cizgi(P3(0, s0), P3(0, s1)));
  const yp = yz.kenarEgri(v0p, v1p, yz._cizgi(P3(PI, s0), P3(PI, s1)));
  const o = (e, d) => yz.yonlu(e, d);
  const yuzey = (tip, merkez, ...sayi) => yz.ekle(tip + "('',#" + yz.cerceve(merkez, z, x) + (sayi.length ? ',' + sayi.join(',') : '') + ')');
  const cyl = yuzey('CYLINDRICAL_SURFACE', [0, 0, s0], yz.L(r));
  return [
    yz.yuz(cyl, [o(alt1, true), o(yp, true), o(ust1, false), o(y0, false)]),
    yz.yuz(cyl, [o(alt2, true), o(y0, true), o(ust2, false), o(yp, false)]),
    yz.yuz(yuzey('PLANE', [0, 0, s1]), [o(ust1, true), o(ust2, true)]),
    yz.yuz(yuzey('PLANE', [0, 0, s0]), [o(alt2, false), o(alt1, false)], [], false)
  ];
}

// Parça tanımı: { id, ad, sekil:'kutu'|'silindir'|'acik-kutu', olcu:[a,b,c] | [r, L],
//   konum:[x,y,z], z?:[..], x?:[..] (yerel eksenin dünyadaki yönü), alt?: 'MONTAJ_ID',
//   dogrulama?: true | { …veri, opt } (CAx-IF doğrulama özellikleri — analitik
//   hacim, alan, merkez; veri verilirse o yazılır), yogunluk?: kg/m³,
//   malzeme?: ad, yogunlukBirim?: 'g/cm3' | 'kg/m3' | 'kg/mm3' }
// 'acik-kutu': kutunun ÜST yüzü yok — açık kabuk (yüzey modeli), ağı kapalı değil.
// Alt montaj: { id, ad, konum, z?, x? } — parçalar `alt` ile ona takılır.
function guçGrubuStep(parcalar, opt = {}) {
  const yz = new Y.StepYaz({ uzunluk: opt.uzunluk });
  const kok = yz.urun('GUC_GRUBU', opt.kokAd || 'GÜÇ GRUBU');
  const altlar = {};
  (opt.altMontajlar || []).forEach((a) => { altlar[a.id] = { tanim: a, urun: yz.urun(a.id, a.ad), taklar: [] }; });
  const kokTak = [];
  for (const p of parcalar) {
    const u = yz.urun(p.id, p.ad);
    const yuzler = p.sekil === 'silindir' ? silindirYuzleri(yz, p.olcu[0], p.olcu[1]) : kutuYuzleri(yz, p.olcu[0], p.olcu[1], p.olcu[2]);
    if (p.sekil === 'acik-kutu') yz.govde(u, yuzler.filter((_, i) => i !== 4), 'kabuk');     // üst yüz (+z) yok
    else yz.govde(u, yuzler, 'kati');
    yz.temsil(u);
    if (p.dogrulama) yz.dogrulama(u, Object.assign(analitik(p), p.dogrulama === true ? {} : p.dogrulama));
    if (p.yogunluk) yz.yogunluk(u, p.yogunluk, { malzeme: p.malzeme, birim: p.yogunlukBirim });
    const ebe = p.alt ? altlar[p.alt] : null;
    const t = yz.tak(ebe ? ebe.urun : kok, u, p.ornek || (p.id + '.1'), p.konum, p.z || [0, 0, 1], p.x || [1, 0, 0]);
    (ebe ? ebe.taklar : kokTak).push(t);
  }
  Object.keys(altlar).forEach((k) => {
    const a = altlar[k];
    yz.temsil(a.urun);
    kokTak.push(yz.tak(kok, a.urun, a.tanim.ornek || (a.tanim.id + '.1'), a.tanim.konum, a.tanim.z || [0, 0, 1], a.tanim.x || [1, 0, 0]));
  });
  yz.temsil(kok);
  Object.keys(altlar).forEach((k) => altlar[k].taklar.forEach((t) => yz.bagla(t)));
  kokTak.forEach((t) => yz.bagla(t));
  return yz.metin();
}

// Parçanın analitik hacmi, yüzey alanı ve merkezi (kendi ekseninde, mm) —
// doğrulama özelliğinin yazdığı CATIA sayısının yerine
function analitik(p) {
  if (p.sekil === 'silindir') {
    const [r, L] = p.olcu;
    return { hacim: PI * r * r * L, alan: 2 * PI * r * r + 2 * PI * r * L, merkez: [0, 0, 0] };
  }
  const [a, b, c] = p.olcu;
  return { hacim: a * b * c, alan: 2 * (a * b + b * c + c * a), merkez: [0, 0, 0] };
}

// Varsayılan güç grubu: motor (kutu) + şanzıman (silindir, eksen x) + dört
// takoz (küçük silindir) + bir braket alt montajı (iki kutu) — sayılar
// gerçek mertebede, sonuçları analitik.
const GUC = {
  motor: { id: 'MOTOR', ad: 'Motor bloğu', sekil: 'kutu', olcu: [900, 700, 800], konum: [-300, 5, 850] },
  sanziman: { id: 'SANZ', ad: 'Şanzıman gövdesi', sekil: 'silindir', olcu: [260, 700], konum: [600, 10, 700],
              z: [1, 0, 0], x: [0, 1, 0] },
  takozlar: [
    { id: 'TK-SAG-ON', ad: 'Sağ ön takoz', sekil: 'silindir', olcu: [45, 60], konum: [-650, 380, 420] },
    { id: 'TK-SOL-ON', ad: 'Sol ön takoz', sekil: 'silindir', olcu: [45, 60], konum: [-650, -380, 420] },
    { id: 'TK-SAG-ARKA', ad: 'Sağ arka takoz', sekil: 'silindir', olcu: [40, 50], konum: [700, 300, 520] },
    { id: 'TK-SOL-ARKA', ad: 'Sol arka takoz', sekil: 'silindir', olcu: [40, 50], konum: [700, -300, 520] }
  ],
  braket: { id: 'BRAKET_ASM', ad: 'Arka braket', konum: [700, 0, 450],
            parcalar: [
              { id: 'BRK-UST', ad: 'Braket üst', sekil: 'kutu', olcu: [120, 600, 20], konum: [0, 0, 40] },
              { id: 'BRK-ALT', ad: 'Braket alt', sekil: 'kutu', olcu: [120, 600, 20], konum: [0, 0, -40] }
            ] }
};
function gucGrubu(opt = {}) {
  const p = [GUC.motor, GUC.sanziman].concat(GUC.takozlar)
    .concat(GUC.braket.parcalar.map((b) => Object.assign({ alt: GUC.braket.id }, b)));
  return guçGrubuStep(p, Object.assign({ altMontajlar: [{ id: GUC.braket.id, ad: GUC.braket.ad, konum: GUC.braket.konum }] }, opt));
}

// AYNI PARÇA BİRDEN ÇOK KEZ TAKILI (cıvata, braket gibi): şişkin kutu braket üç
// örnekle (üç ayrı dünya dönüşümü, AYNI temsil) + tek örnekli bir gövde. Ağ işi
// aynı şekli bir kez üçgenleyip örneklere taşımalı (js/mount-step.js).
function tekrarliMontaj(opt = {}) {
  const yz = new Y.StepYaz({ uzunluk: opt.uzunluk });
  const kok = yz.urun('MONTAJ', 'TEKRARLI MONTAJ');
  const brk = yz.urun('BRK', 'Braket');
  yz.govde(brk, bsKutuYuzleri(yz, 120, 60, 40, 8, 4), 'kati');
  yz.temsil(brk);
  const tek = yz.urun('GOVDE', 'Gövde');
  yz.govde(tek, kutuYuzleri(yz, 400, 300, 200), 'kati');
  yz.temsil(tek);
  const taklar = [
    yz.tak(kok, brk, 'BRK.1', [0, 0, 0], [0, 0, 1], [1, 0, 0]),
    yz.tak(kok, tek, 'GOVDE.1', [500, 0, 0], [0, 0, 1], [1, 0, 0]),
    yz.tak(kok, brk, 'BRK.2', [0, 300, 50], [0, 0.6, 0.8], [1, 0, 0]),
    yz.tak(kok, brk, 'BRK.3', [-200, -100, 300], [0.6, 0, 0.8], [0, 1, 0])
  ];
  yz.temsil(kok);
  taklar.forEach((t) => yz.bagla(t));
  return yz.metin();
}

// ── TAKOZ KALIPLARI (Takoz adım 5 — takoz noktası) ───────────────────────
// Tulga sunusundaki beş takoz noktası (CATIA ölçümü: takozun üst bağlantı
// yüzeyindeki dairenin merkezi). Kalıp bu noktaya ÜST PLAKANIN ÜST YÜZÜ gelecek
// biçimde dört silindirden kurulur: taban flanşı · kauçuk · üst plaka ·
// saplama; `somun` varyantında saplamanın üstünde 12 mm'lik braket boşluğu,
// pul ve somun (braket birimin dışında — dosyada hiç yok). Hacim merkezi bu
// noktanın 37,97 mm (somunluda 37,44 mm) altına düşüyordu (ölçüldü).
const TULGA_TAKOZ = [
  ['TK-ON', 'Ön takoz', [-196.034, 0.047, 179.682]],
  ['TK-SAG-ON', 'Sağ ön takoz', [439.961, 356.042, 499.855]],
  ['TK-SOL-ON', 'Sol ön takoz', [439.957, -355.957, 499.855]],
  ['TK-SAG-ARKA', 'Sağ arka takoz', [1381.672, 305.873, 43.452]],
  ['TK-SOL-ARKA', 'Sol arka takoz', [1381.671, -304.131, 51.439]]
];
// Dilimler: s alt montajın ekseninde, üst plakanın üstü s = 0
const TAKOZ_DILIM = {
  duz: [
    { k: 'FLANS', ad: 'taban flanşı', r: 60, s0: -68, s1: -58 },
    { k: 'KAUCUK', ad: 'kauçuk', r: 45, s0: -58, s1: -8 },
    { k: 'PLAKA', ad: 'üst plaka', r: 35, s0: -8, s1: 0 },
    { k: 'SAPLAMA', ad: 'saplama', r: 6, s0: 0, s1: 35 }
  ],
  somun: [
    { k: 'PUL', ad: 'pul', r: 12, s0: 12, s1: 15 },
    { k: 'SOMUN', ad: 'somun', r: 10, s0: 15, s1: 25 }
  ],
  // Konik takoz kalıbı: geniş flanş altta, üstte dar göbek (saplamasız)
  konik: [
    { k: 'FLANS', ad: 'flanş', r: 70, s0: -72, s1: -60 },
    { k: 'KAUCUK', ad: 'kauçuk', r: 50, s0: -60, s1: -20 },
    { k: 'GOBEK', ad: 'göbek', r: 20, s0: -20, s1: 0 }
  ]
};
// opt: { varyant: 'duz'|'somun'|'konik', z, x (alt montajın yönü), govde (motor
// vb. kutular, varsayılan var), civata (flanşta eksen dışı iki cıvata — dosyada
// takozun dilimlerinden ÖNCE), saplama (false: saplama yok — braket boşluğu
// boş kalır) }
function tulgaKalibi(opt = {}) {
  const v = opt.varyant || 'duz';
  const parcalar = opt.govde === false ? [] : [
    { id: 'MOTOR', ad: 'Motor bloğu', sekil: 'kutu', olcu: [600, 500, 600], konum: [124.96, 0.05, 750.03] },
    { id: 'SANZ', ad: 'Şanzıman gövdesi', sekil: 'kutu', olcu: [400, 300, 300], konum: [814.55, 40.817, 365.138] },
    { id: 'TC', ad: 'Transfer gövdesi', sekil: 'kutu', olcu: [300, 300, 200], konum: [1431.449, 54.419, 302.336] }
  ];
  const dilim = (v === 'konik' ? TAKOZ_DILIM.konik : TAKOZ_DILIM.duz.concat(v === 'somun' ? TAKOZ_DILIM.somun : []))
    .filter((d) => !(opt.saplama === false && d.k === 'SAPLAMA'));
  const altlar = [];
  TULGA_TAKOZ.forEach(([id, ad, p]) => {
    altlar.push({ id: id + '_ASM', ad, konum: p, z: opt.z, x: opt.x });
    // cıvata: true (30 mm) ya da boyu — flanşın üstünde durur
    const L = opt.civata === true ? 30 : opt.civata, f = (v === 'konik' ? TAKOZ_DILIM.konik : TAKOZ_DILIM.duz)[0].s1;
    if (opt.civata) [-1, 1].forEach((y, k) => parcalar.push({ id: id + '-CIVATA' + k, ad: ad + ' cıvata ' + (k + 1), sekil: 'silindir',
      olcu: [5, L], konum: [0, y * 52, f + L / 2], alt: id + '_ASM' }));
    dilim.forEach((d) => parcalar.push({ id: id + '-' + d.k, ad: ad + ' ' + d.ad, sekil: 'silindir', olcu: [d.r, d.s1 - d.s0],
      konum: [0, 0, (d.s0 + d.s1) / 2], alt: id + '_ASM' }));
  });
  return guçGrubuStep(parcalar, { altMontajlar: altlar });
}

// ── KÜTLE KALIBI (Takoz adım 6 — kütle, ağırlık merkezi, atalet) ──────────
// Motor: yedi parça — altı kapalı katı ve bir AÇIK kabuk (kayış kapağı, üst
// yüzü yok: üçgenlenemeyen yüzün kalıbı). Şanzıman: iki malzeme (dökme demir
// gövde + alüminyum çan), dosyada yoğunluk ve malzemenin adı. Braket: iki
// plaka (alt montaj). opt.dogrulama: motor parçalarında CAx-IF doğrulama
// özellikleri (analitik hacim, alan, merkez — CATIA'nın yazdığı sayıların
// yerine); opt.yogunlukBirim · opt.uzunluk.
const KUTLE = {
  motor: [
    { id: 'BLOK', ad: 'Motor blok', sekil: 'kutu', olcu: [600, 400, 450], konum: [100, 0, 500] },
    { id: 'KAFA', ad: 'Silindir kafası', sekil: 'kutu', olcu: [580, 300, 150], konum: [110, 0, 800] },
    { id: 'KARTER', ad: 'Karter', sekil: 'kutu', olcu: [500, 350, 120], konum: [80, 0, 215] },
    { id: 'VOLAN', ad: 'Volan muhafazası', sekil: 'silindir', olcu: [250, 150], konum: [480, 0, 450], z: [1, 0, 0], x: [0, 1, 0] },
    { id: 'ALT', ad: 'Alternatör', sekil: 'kutu', olcu: [180, 160, 160], konum: [-260, 230, 600] },
    { id: 'KOMP', ad: 'Klima kompresörü', sekil: 'kutu', olcu: [200, 150, 150], konum: [-250, -220, 420] },
    { id: 'KAPAK', ad: 'Kayış kapağı', sekil: 'acik-kutu', olcu: [60, 500, 400], konum: [-330, 0, 650] }
  ],
  sanziman: [
    { id: 'GOVDE', ad: 'Şanzıman gövdesi', sekil: 'kutu', olcu: [500, 380, 380], konum: [814, 40, 365], yogunluk: 7200, malzeme: 'EN-GJL-250' },
    { id: 'CAN', ad: 'Çan', sekil: 'kutu', olcu: [200, 500, 500], konum: [480, 40, 400], yogunluk: 2700, malzeme: 'EN AC-46000' }
  ],
  braket: [
    { id: 'BRK-UST', ad: 'Braket üst', sekil: 'kutu', olcu: [120, 600, 20], konum: [0, 0, 40] },
    { id: 'BRK-ALT', ad: 'Braket alt', sekil: 'kutu', olcu: [120, 600, 20], konum: [0, 0, -40] }
  ],
  montaj: [
    { id: 'MOTOR_ASM', ad: 'Motor', konum: [0, 0, 0] },
    { id: 'SANZ_ASM', ad: 'Şanzıman', konum: [0, 0, 0] },
    { id: 'BRAKET_ASM', ad: 'Arka braket', konum: [1300, 0, 300] }
  ]
};
function kutleKalibi(opt = {}) {
  const p = KUTLE.motor.map((x) => Object.assign({ alt: 'MOTOR_ASM' }, x, opt.dogrulama ? { dogrulama: true } : {}))
    .concat(KUTLE.sanziman.map((x) => Object.assign({ alt: 'SANZ_ASM' }, x, opt.yogunlukBirim ? { yogunlukBirim: opt.yogunlukBirim } : {})))
    .concat(KUTLE.braket.map((x) => Object.assign({ alt: 'BRAKET_ASM' }, x)));
  return guçGrubuStep(p, { altMontajlar: KUTLE.montaj, uzunluk: opt.uzunluk });
}

module.exports = { kutuYuzleri, bsKutuYuzleri, silindirYuzleri, guçGrubuStep, gucGrubu, GUC, tekrarliMontaj,
  TULGA_TAKOZ, TAKOZ_DILIM, tulgaKalibi, analitik, KUTLE, kutleKalibi };
