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

// Parça tanımı: { id, ad, sekil:'kutu'|'silindir', olcu:[a,b,c] | [r, L],
//   konum:[x,y,z], z?:[..], x?:[..] (yerel eksenin dünyadaki yönü), alt?: 'MONTAJ_ID' }
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
    yz.govde(u, yuzler, 'kati');
    yz.temsil(u);
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

module.exports = { kutuYuzleri, silindirYuzleri, guçGrubuStep, gucGrubu, GUC };
