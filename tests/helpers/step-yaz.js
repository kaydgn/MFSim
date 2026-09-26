/**
 * step-yaz.js — testler için SENTETİK STEP (ISO 10303-21, AP242) yazıcısı.
 *
 * NEDEN VAR: gerçek bir 3DEXPERIENCE montajı (kullanıcının FEAD geometrisi)
 * okuyucuyu ve tanıyıcıyı ilk kez sınadı; dosyanın kendisi şimdilik depoya
 * girmiyor. Bu yazıcı o dosyanın KALIBINI taklit eder — testlerin kapıladığı
 * her tuzak orada ölçüldü:
 *   · montaj CDSR → RRWT → IDT; parçanın yerel ekseni dünyada DÖNÜK
 *   · gövdeler SHELL_BASED_SURFACE_MODEL / MANIFOLD_SOLID_BREP / BREP_WITH_VOIDS
 *   · dönel yüzler iki YARIM yüz, aynı yüzeyi paylaşarak
 *   · kaburga tepesi bir tor ve tepe noktası yüzün İÇİNDE (sınır çemberinde değil)
 *   · kanalın iki yanında kanaldan BÜYÜK omuz (en büyük çap ≠ dış çap)
 *   · Türkçe adlar ve "Ø" \X2\ ile
 * Sayılar (tor yarıçapları, yanak aralıkları) aynı dosyanın krank kasnağından.
 */
'use strict';

const f = (x) => {
  if (Number.isInteger(x)) return x + '.';
  const s = String(+x.toPrecision(15));
  return /[.eE]/.test(s) ? s : s + '.';
};
const X2 = (s) => s.replace(/[^\x20-\x7e]/g, (c) => '\\X2\\' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0') + '\\X0\\')
  .replace(/'/g, "''");

class StepYaz {
  constructor(opt = {}) {
    this.id = 0;
    this.satir = [];
    this.uzunluk = opt.uzunluk || 'mm';     // 'mm' | 'inch'
    this.aci = opt.aci || 'rad';            // 'rad' | 'derece'
    this.k = this.uzunluk === 'inch' ? 1 / 25.4 : 1;   // mm → dosya birimi
    this.baglam = this._baglam();
    this.pc = this.ekle("PRODUCT_CONTEXT(' ',#" + this.ekle("APPLICATION_CONTEXT('managed model based 3d engineering')") + ",'mechanical')");
    this.pdc = this.ekle("PRODUCT_DEFINITION_CONTEXT('part definition',#1,' ')");
  }
  ekle(metin) { const id = ++this.id; this.satir.push('#' + id + '=' + metin + ' ;'); return id; }
  L(x) { return x * this.k; }                               // uzunluk (mm) → dosya birimi
  A(rad) { return this.aci === 'derece' ? rad * 180 / Math.PI : rad; }
  nokta(p) { return this.ekle("CARTESIAN_POINT('',(" + p.map((v) => f(this.L(v))).join(',') + '))'); }
  yon(d) { return this.ekle("DIRECTION('',(" + d.map(f).join(',') + '))'); }
  cerceve(o, z = [0, 0, 1], x = [1, 0, 0]) { return this.ekle("AXIS2_PLACEMENT_3D('',#" + this.nokta(o) + ',#' + this.yon(z) + ',#' + this.yon(x) + ')'); }

  _baglam() {
    const dim = this.ekle('DIMENSIONAL_EXPONENTS(0.,0.,0.,0.,0.,0.,0.)');
    let len;
    if (this.uzunluk === 'inch') {
      const mm = this.ekle('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))');
      const olcu = this.ekle('LENGTH_MEASURE_WITH_UNIT(LENGTH_MEASURE(25.4),#' + mm + ')');
      len = this.ekle("(CONVERSION_BASED_UNIT('INCH',#" + olcu + ')LENGTH_UNIT()NAMED_UNIT(#' + dim + '))');
    } else len = this.ekle('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))');
    const rad = this.ekle('(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))');
    let ang = rad;
    if (this.aci === 'derece') {
      const olcu = this.ekle('PLANE_ANGLE_MEASURE_WITH_UNIT(PLANE_ANGLE_MEASURE(0.0174532925199433),#' + rad + ')');
      ang = this.ekle("(CONVERSION_BASED_UNIT('DEGREE',#" + olcu + ')NAMED_UNIT(#' + dim + ')PLANE_ANGLE_UNIT())');
    }
    const sr = this.ekle('(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())');
    const unc = this.ekle("UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(0.001),#" + len + ",'distance_accuracy_value','')");
    return this.ekle('(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#' + unc
      + '))GLOBAL_UNIT_ASSIGNED_CONTEXT((#' + len + ',#' + ang + ',#' + sr + "))REPRESENTATION_CONTEXT(' ',' '))");
  }

  // ── ürün ─────────────────────────────────────────────────────────────────
  urun(id, aciklama) {
    const pr = this.ekle("PRODUCT('" + X2(id) + "','" + X2(id) + "','" + X2(aciklama || '') + "',(#" + this.pc + '))');
    const pdf = this.ekle("PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE(' ',' ',#" + pr + ',.NOT_KNOWN.)');
    const pd = this.ekle("PRODUCT_DEFINITION('" + X2(id) + "',' ',#" + pdf + ',#' + this.pdc + ')');
    const pds = this.ekle("PRODUCT_DEFINITION_SHAPE(' ',' ',#" + pd + ')');
    const yer = this.cerceve([0, 0, 0]);
    return { pd, pds, yer, ogeler: [yer] };
  }
  // Temsili kapat (ürüne öğeler eklendikten sonra)
  temsil(u) {
    u.sr = this.ekle("SHAPE_REPRESENTATION(' ',(" + u.ogeler.map((o) => '#' + o).join(',') + '),#' + this.baglam + ')');
    this.ekle('SHAPE_DEFINITION_REPRESENTATION(#' + u.pds + ',#' + u.sr + ')');
    return u.sr;
  }
  // Çocuğu ebeveyne dünya çerçevesiyle tak (CAx-IF: rep_1 çocuk, rep_2 ebeveyn)
  tak(ebeveyn, cocuk, ornekAdi, o, z, x, { ters = false } = {}) {
    const ebeYer = this.cerceve(o, z, x);
    ebeveyn.ogeler.push(ebeYer);
    const nauo = this.ekle("NEXT_ASSEMBLY_USAGE_OCCURRENCE('" + X2(ornekAdi) + "','','',#" + ebeveyn.pd + ',#' + cocuk.pd + ",'')");
    const pds = this.ekle("PRODUCT_DEFINITION_SHAPE(' ',' ',#" + nauo + ')');
    const idt = ters
      ? this.ekle("ITEM_DEFINED_TRANSFORMATION(' ',' ',#" + ebeYer + ',#' + cocuk.yer + ')')
      : this.ekle("ITEM_DEFINED_TRANSFORMATION(' ',' ',#" + cocuk.yer + ',#' + ebeYer + ')');
    return { nauo, pds, idt, cocuk, ebeveyn, ters };
  }
  // Takılanların RRWT'leri, temsiller kapandıktan SONRA yazılır
  bagla(t) {
    const r1 = t.ters ? t.ebeveyn.sr : t.cocuk.sr, r2 = t.ters ? t.cocuk.sr : t.ebeveyn.sr;
    const rr = this.ekle("(REPRESENTATION_RELATIONSHIP(' ',' ',#" + r1 + ',#' + r2
      + ')REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(#' + t.idt + ')SHAPE_REPRESENTATION_RELATIONSHIP())');
    this.ekle('CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(#' + rr + ',#' + t.pds + ')');
  }

  // ── dönel yüzler ──────────────────────────────────────────────────────────
  // Yerel eksen: `merkez` noktasından `z` yönünde; profil (s, r) bu eksene göre.
  // Her dönel yüz İKİ YARIM yüz olarak yazılır ve aynı yüzeyi paylaşır.
  _cember(eks, s, r) {
    const c = eks.nokta(s);
    return this.ekle("CIRCLE('',#" + this.cerceve(c, eks.z, eks.x) + ',' + f(this.L(r)) + ')');
  }
  _kenar(egri, p1, p2) {
    const v1 = this.ekle("VERTEX_POINT('',#" + this.nokta(p1) + ')');
    const v2 = this.ekle("VERTEX_POINT('',#" + this.nokta(p2) + ')');
    const ec = this.ekle("EDGE_CURVE('',#" + v1 + ',#' + v2 + ',#' + egri + ',.T.)');
    return this.ekle("ORIENTED_EDGE('',*,*,#" + ec + ',.T.)');
  }
  _cizgi(p1, p2) {
    const d = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
    const L = Math.hypot(...d) || 1;
    const vec = this.ekle("VECTOR('',#" + this.yon(d.map((v) => v / L)) + ',' + f(this.L(L)) + ')');
    return this.ekle("LINE('',#" + this.nokta(p1) + ',#' + vec + ')');
  }
  _yuz(yuzey, kenarlar, ic) {
    const dongu = this.ekle("EDGE_LOOP('',(" + kenarlar.map((k) => '#' + k).join(',') + '))');
    const sinir = [this.ekle("FACE_OUTER_BOUND('',#" + dongu + ',.T.)')];
    if (ic) sinir.push(this.ekle("FACE_BOUND('',#" + this.ekle("EDGE_LOOP('',(" + ic.map((k) => '#' + k).join(',') + '))') + ',.T.)'));
    return this.ekle("ADVANCED_FACE('',(" + sinir.map((b) => '#' + b).join(',') + '),#' + yuzey + ',.T.)');
  }
  // Profil parçası → yüz(ler). parca: {tip:'dogru'|'yay', s0,r0,s1,r1, (yay için) sm, R, rk, bol}
  donel(eks, parca, yuzler) {
    const { s0, r0, s1, r1 } = parca;
    let yuzey;
    if (parca.tip === 'yay') {
      yuzey = this.ekle("TOROIDAL_SURFACE('',#" + this.cerceve(eks.nokta(parca.sm), eks.z, eks.x) + ',' + f(this.L(parca.R)) + ',' + f(this.L(parca.rk)) + ')');
    } else if (Math.abs(r1 - r0) < 1e-12) {
      yuzey = this.ekle("CYLINDRICAL_SURFACE('',#" + this.cerceve(eks.nokta(s0), eks.z, eks.x) + ',' + f(this.L(r0)) + ')');
    } else if (Math.abs(s1 - s0) < 1e-12) {
      yuzey = this.ekle("PLANE('',#" + this.cerceve(eks.nokta(s0), eks.z, eks.x) + ')');
      const dis = this._cember(eks, s0, Math.max(r0, r1)), ic = this._cember(eks, s0, Math.min(r0, r1));
      const p = eks.nokta(s0);
      const a = this._kenar(dis, eks.cevre(s0, Math.max(r0, r1), 0), eks.cevre(s0, Math.max(r0, r1), 0));
      const b = Math.min(r0, r1) > 0 ? this._kenar(ic, eks.cevre(s0, Math.min(r0, r1), 0), eks.cevre(s0, Math.min(r0, r1), 0)) : null;
      yuzler.push(this._yuz(yuzey, [a], b ? [b] : null));
      void p;
      return;
    } else {
      // Koni: yerleşim s0'da, yarıçap r0; eksen yönü yarıçapın BÜYÜDÜĞÜ taraf
      const yari = Math.atan(Math.abs(r1 - r0) / Math.abs(s1 - s0));
      const zk = (r1 > r0) === (s1 > s0) ? eks.z : eks.z.map((v) => -v);
      yuzey = this.ekle("CONICAL_SURFACE('',#" + this.cerceve(eks.nokta(s0), zk, eks.x) + ',' + f(this.L(r0)) + ',' + f(this.A(yari)) + ')');
    }
    // İki yarım yüz: 0–180° ve 180–360°
    const c0 = this._cember(eks, s0, r0), c1 = this._cember(eks, s1, r1);
    for (const [a0, a1] of [[0, Math.PI], [Math.PI, 2 * Math.PI]]) {
      const k1 = this._kenar(c0, eks.cevre(s0, r0, a0), eks.cevre(s0, r0, a1));
      const k2 = this._kenar(this._cizgi(eks.cevre(s0, r0, a1), eks.cevre(s1, r1, a1)), eks.cevre(s0, r0, a1), eks.cevre(s1, r1, a1));
      const k3 = this._kenar(c1, eks.cevre(s1, r1, a1), eks.cevre(s1, r1, a0));
      const k4 = this._kenar(this._cizgi(eks.cevre(s1, r1, a0), eks.cevre(s0, r0, a0)), eks.cevre(s1, r1, a0), eks.cevre(s0, r0, a0));
      yuzler.push(this._yuz(yuzey, [k1, k2, k3, k4]));
    }
  }
  // Yüz listesinden bir gövde (varsayılan: yüzey modeli, 3DEXPERIENCE gibi)
  govde(u, yuzler, tur = 'kabuk') {
    let oge;
    if (tur === 'kati') {
      const kabuk = this.ekle("CLOSED_SHELL('',(" + yuzler.map((y) => '#' + y).join(',') + '))');
      oge = this.ekle("MANIFOLD_SOLID_BREP('PartBody',#" + kabuk + ')');
    } else {
      const kabuk = this.ekle("OPEN_SHELL('',(" + yuzler.map((y) => '#' + y).join(',') + '))');
      oge = this.ekle("SHELL_BASED_SURFACE_MODEL('NONE',(#" + kabuk + '))');
    }
    u.ogeler.push(oge);
    return oge;
  }

  metin() {
    return ['ISO-10303-21;', 'HEADER;',
      "FILE_DESCRIPTION(('MFSim test STEP'),'2;1');",
      "FILE_NAME('SENTETIK.stp','2026-09-26T00:00:00',('none'),('none'),'MFSim step-yaz','step-yaz AP242','none');",
      "FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF { 1 0 10303 442 1 1 4 }'));",
      'ENDSEC;', 'DATA;', ...this.satir, 'ENDSEC;', 'END-ISO-10303-21;'].join('\r\n');
  }
}

// Yerel eksen: merkez + z; x ona dik. `nokta(s)` eksen üstünde, `cevre(s,r,a)` çemberde.
function eksen(merkez = [0, 0, 0], z = [0, 0, 1], x = [1, 0, 0]) {
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return {
    z, x,
    nokta: (s) => [merkez[0] + z[0] * s, merkez[1] + z[1] * s, merkez[2] + z[2] * s],
    cevre: (s, r, a) => [0, 1, 2].map((i) => merkez[i] + z[i] * s + r * (Math.cos(a) * x[i] + Math.sin(a) * y[i]))
  };
}

// ── PROFİLLER ────────────────────────────────────────────────────────────
// Kaburgalı kasnak (PK, gerçek krank kasnağının sayıları). Kanal merkezleri
// s = 1,78 + i·3,56; bölgenin ortası s = 0 olacak şekilde kaydırılır.
//   od        : kaburga tepesi çapı
//   n         : kanal sayısı
//   omuz      : kanalın iki yanındaki omuzun çapı (od'den BÜYÜK — tuzak)
//   tepeBol   : kaburga tepesi torunu tepe noktasından ikiye böl (klima gibi)
//   kenarYanak: bir uçta omuza çıkan tek bir 70° yanak (kanal DEĞİL — tuzak)
function kanalliProfil({ od, n, adim = 3.56, omuz = null, tepeBol = false, kenarYanak = false, tepeR: tepeR0 = 0.35 }) {
  // Kanal ölçüleri PK'nın (3,56) ölçüleridir ve adımla ölçeklenir; yanak
  // açısı ölçekten bağımsız 70° kalır (derinlik = boy · tan 70°).
  const k = adim / 3.56;
  const Rt = od / 2, tepeR = tepeR0 * k;
  const rTepeTor = Rt - tepeR;
  const rYanakUst = Rt - 0.23 * k, rYanakAlt = rYanakUst - 2.696 * k, rTabanTor = rYanakAlt + 0.1707 * k;
  const tepeYari = 0.329 * k, yanakBoy = 0.981 * k, tabanR = 0.5 * k;
  const P = [];
  const orta = (n - 1) * adim / 2 + adim / 2;      // bölge ortası (kaydırma)
  const S = (s) => s - orta;
  const omuzR = (omuz || od + 3.5) / 2;
  // sol omuz + alın + düzlük (düzlük kanalın ilk yarım tepesine kadar)
  P.push({ tip: 'dogru', s0: S(-8), r0: omuzR - 12, s1: S(-8), r1: omuzR });
  P.push({ tip: 'dogru', s0: S(-8), r0: omuzR, s1: S(-5.2), r1: omuzR });
  P.push({ tip: 'dogru', s0: S(-5.2), r0: omuzR, s1: S(-5.2), r1: Rt });
  P.push({ tip: 'dogru', s0: S(-5.2), r0: Rt, s1: S(0), r1: Rt });
  // ilk yarım tepe: düzlükten ilk yanağa
  P.push({ tip: 'yay', s0: S(0), r0: Rt, s1: S(tepeYari), r1: rYanakUst, sm: S(0), R: rTepeTor, rk: tepeR });
  for (let i = 0; i < n; i++) {
    const t = i * adim;                                     // bu kanalın solundaki tepe merkezi
    if (i > 0) {
      if (tepeBol) {
        P.push({ tip: 'yay', s0: S(t - tepeYari), r0: rYanakUst, s1: S(t), r1: Rt, sm: S(t), R: rTepeTor, rk: tepeR });
        P.push({ tip: 'yay', s0: S(t), r0: Rt, s1: S(t + tepeYari), r1: rYanakUst, sm: S(t), R: rTepeTor, rk: tepeR });
      } else P.push({ tip: 'yay', s0: S(t - tepeYari), r0: rYanakUst, s1: S(t + tepeYari), r1: rYanakUst, sm: S(t), R: rTepeTor, rk: tepeR });
    }
    P.push({ tip: 'dogru', s0: S(t + tepeYari), r0: rYanakUst, s1: S(t + tepeYari + yanakBoy), r1: rYanakAlt });
    P.push({ tip: 'yay', s0: S(t + tepeYari + yanakBoy), r0: rYanakAlt, s1: S(t + adim - tepeYari - yanakBoy), r1: rYanakAlt,
             sm: S(t + adim / 2), R: rTabanTor, rk: tabanR });
    P.push({ tip: 'dogru', s0: S(t + adim - tepeYari - yanakBoy), r0: rYanakAlt, s1: S(t + adim - tepeYari), r1: rYanakUst });
  }
  const son = n * adim;
  // son yarım tepe: son yanaktan düzlüğe
  P.push({ tip: 'yay', s0: S(son - tepeYari), r0: rYanakUst, s1: S(son), r1: Rt, sm: S(son), R: rTepeTor, rk: tepeR });
  P.push({ tip: 'dogru', s0: S(son), r0: Rt, s1: S(son + 5.1), r1: Rt });
  if (kenarYanak) {
    // omuza ÇIKAN tek bir 70° yanak (klimadaki gibi)
    const d = (omuzR - Rt) / Math.tan(70 * Math.PI / 180);
    P.push({ tip: 'dogru', s0: S(son + 5.1), r0: Rt, s1: S(son + 5.1 + d), r1: omuzR });
    P.push({ tip: 'dogru', s0: S(son + 5.1 + d), r0: omuzR, s1: S(son + 8), r1: omuzR });
  } else {
    P.push({ tip: 'dogru', s0: S(son + 5.1), r0: Rt, s1: S(son + 5.1), r1: omuzR });
    P.push({ tip: 'dogru', s0: S(son + 5.1), r0: omuzR, s1: S(son + 8), r1: omuzR });
  }
  // göbek: delik ve alın
  P.push({ tip: 'dogru', s0: S(-8), r0: 12, s1: S(son + 8), r1: 12 });
  return P.filter((p) => !(Math.abs(p.s1 - p.s0) < 1e-12 && Math.abs(p.r1 - p.r0) < 1e-12));
}

// Düz avara: kayış yüzeyi silindiri + yan alınlar + delik (genişlik w, ortası s = 0)
function duzProfil({ od, w = 31.48 }) {
  const R = od / 2, h = w / 2;
  return [
    { tip: 'dogru', s0: -h, r0: R, s1: h, r1: R },
    { tip: 'dogru', s0: -h, r0: 10, s1: -h, r1: R },
    { tip: 'dogru', s0: h, r0: 10, s1: h, r1: R },
    { tip: 'dogru', s0: -h, r0: 8.5, s1: h, r1: 8.5 }
  ];
}

// Pivot gövdesi: aynı eksende çok yüzlü bir göbek (düzlemin ARKASINDA)
function pivotProfil({ yuzSayisi = 6, s0 = 20, s1 = 60 } = {}) {
  const P = [];
  const adim = (s1 - s0) / yuzSayisi;
  for (let i = 0; i < yuzSayisi; i++)
    P.push({ tip: 'dogru', s0: s0 + i * adim, r0: 20 + (i % 3) * 6, s1: s0 + (i + 1) * adim, r1: 20 + (i % 3) * 6 });
  return P;
}

// Bir profili verilen eksende yüzlere çevir
function profilYuzleri(yz, eks, profil) {
  const yuzler = [];
  for (const p of profil) yz.donel(eks, p, yuzler);
  return yuzler;
}

module.exports = { StepYaz, eksen, kanalliProfil, duzProfil, pivotProfil, profilYuzleri };
