/**
 * mount-kutle.test.js — KÜTLE, AĞIRLIK MERKEZİ, ATALET (Takoz adım 6, 2026-10-20)
 * ─────────────────────────────────────────────────────────────────────────
 * Ölçülen önce (main 03d38f0, sentetik kalıp tests/helpers/step-takoz.js →
 * kutleKalibi): yedi parçalı motorda TEK açık parça (üst yüzü olmayan kapak)
 * bütün birimi kutunun merkezine düşürüyordu — altı kapalı parçanın ağırlık
 * merkezinden 45,15 mm uzakta, atalet yok; iki malzemeli şanzımanın noktası
 * hacim merkeziydi, kütle merkezinden 68,18 mm uzakta; dosyada kütle kaynağı
 * yoktu (yoğunluk, malzeme, CATIA'nın doğrulama özellikleri okunmuyordu).
 *
 *   · OKUYUCU — CAx-IF doğrulama özellikleri (hacim · alan · merkez), yoğunluk
 *     ve malzeme; birimleriyle (SI · türetilmiş · inç); birimi okunamayan
 *     değer atlanır.
 *   · PARÇA PARÇA — birim parçaların toplamı; açık parça hacme katılmaz,
 *     adıyla ve yüzey payıyla söylenir; dosyanın hacmi ve merkezi ağınkinin
 *     yerine geçer (açık parça da böyle katılır, nokta kütle).
 *   · KÜTLE KAYNAĞI — elle · malzeme (ρ·V) · dosyadan (parçaların yoğunlukları,
 *     ağırlık merkezi ve tensör kütleyle ağırlıklı).
 *   · KAYIT — "S" işaretinin dayanağı; kaynak rolle birlikte projeye.
 *   · OTURUM — seçici, hesap, aktarım; kart ve pencere.
 * Gerçek tarayıcı (seçicinin yazısı kutusuna sığar, kaydet → aç → aynı
 * dosyada kaynak geri): tests/e2e/mount-kutle.spec.js.
 */
const stubs = stubGlobals({
  vePortStyleAttr: jest.fn(() => ''), escapeHTML: jest.fn((s) => String(s)),
  updateNodeHandles: jest.fn(), startResize: jest.fn(), enablePortContextMenu: jest.fn(),
  veAttachNodeDrag: jest.fn(), veAttachPortConnect: jest.fn(), getPortPosition: jest.fn(() => ({ x: 0, y: 0 })),
  updatePortPosition: jest.fn(), applyNodeLabelPos: jest.fn(), showLabelContextMenu: jest.fn(),
  updateNodeCount: jest.fn(), clearSelection: jest.fn(), veMinimapUpdate: jest.fn(), veUpdateBoundary: jest.fn(),
});
global.nodes = [];
global.connections = [];
global.compCounter = 0;
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
global.veSayi = require('../../js/sayi.js').veSayi;
global.veMountCore = require('../../js/mount-core.js');
const cp = require('../../js/cp-mount.js');
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
const P21 = require('../../js/step-p21.js');
const STP = require('../../js/mount-step.js');
Object.keys(STP).forEach((k) => { global[k] = STP[k]; });
const W = require('../../js/cp-mount-wizard.js');
Object.keys(W).forEach((k) => { if (global[k] === undefined) global[k] = W[k]; });
const CAD = require('../../js/cp-mount-cad.js');
const S = require('../helpers/step-takoz.js');
const Y = require('../helpers/step-yaz.js');

const uz = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const RIJIT = (p, i) => p.konum[i] + (S.KUTLE.montaj.find((m) => m.id === p.alt) || { konum: [0, 0, 0] }).konum[i];

// ── ANALİTİK CEVAPLAR (kalıbın tanımından; modülün koduyla değil) ──────────
// Parça: hacim, dünya merkezi, kendi merkezi etrafında birim yoğunluk tensörü (mm⁵)
function katı(p, alt) {
  const P = Object.assign({ alt }, p), c = [0, 1, 2].map((i) => RIJIT(P, i));
  if (p.sekil === 'silindir') {                       // eksen x (kalıptaki volan)
    const [r, L] = p.olcu, V = Math.PI * r * r * L;
    return { V, c, J: [[V * r * r / 2, 0, 0], [0, V * (3 * r * r + L * L) / 12, 0], [0, 0, V * (3 * r * r + L * L) / 12]] };
  }
  const [a, b, h] = p.olcu, V = a * b * h;
  return { V, c, J: [[V * (b * b + h * h) / 12, 0, 0], [0, V * (a * a + h * h) / 12, 0], [0, 0, V * (a * a + b * b) / 12]] };
}
// Toplam: ağırlık w = ρ·V; tensör merkezde, paralel eksen (Ixy = −∫xy)
function topla(liste, rho = () => 1) {
  let W = 0; const s = [0, 0, 0];
  liste.forEach((p) => { const w = rho(p) * p.V; W += w; for (let i = 0; i < 3; i++) s[i] += w * p.c[i]; });
  const c = s.map((x) => x / W), T = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  liste.forEach((p) => {
    const q = rho(p), d = p.c.map((x, i) => x - c[i]), dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) T[i][j] += q * (p.J[i][j] + p.V * ((i === j ? dd : 0) - d[i] * d[j]));
  });
  return { W, c, T };
}
const MOTOR = S.KUTLE.motor.map((p) => Object.assign(katı(p, 'MOTOR_ASM'), { ad: p.ad, acik: p.sekil === 'acik-kutu' }));
const SANZ = S.KUTLE.sanziman.map((p) => Object.assign(katı(p, 'SANZ_ASM'), { rho: p.yogunluk * 1e-9, malzeme: p.malzeme }));
const BRAKET = S.KUTLE.braket.map((p) => katı(p, 'BRAKET_ASM'));
const MOTOR_KAPALI = topla(MOTOR.filter((p) => !p.acik)), MOTOR_TAM = topla(MOTOR);
const SANZ_KUTLE = topla(SANZ, (p) => p.rho), SANZ_HACIM = topla(SANZ), BRAKET_H = topla(BRAKET);
// Tensörün göreli farkı (en büyük öğeye göre)
const tfark = (A, B) => {
  let m = 0, n = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { m = Math.max(m, Math.abs(A[i][j] - B[i][j])); n = Math.max(n, Math.abs(B[i][j])); }
  return m / n;
};

const ROL = { Motor: 'mnt-motor', 'Şanzıman': 'mnt-gearbox', 'Arka braket': 'mnt-bracket' };
const dugum = (son, ad) => son.agac.findIndex((d) => d.ad === ad);
const roller = (son, rol = ROL) => {
  const r = son.agac.map(() => null);
  Object.keys(rol).forEach((a) => { r[dugum(son, a)] = rol[a]; });
  return r;
};
const coz = (opt = {}, cozOpt = {}) => {
  const son = STP.veMntStpOku(S.kutleKalibi(opt));
  expect(son.ok).toBe(true);
  const yog = {};
  Object.keys(cozOpt.yogunluk || {}).forEach((a) => { yog[dugum(son, a)] = cozOpt.yogunluk[a]; });
  return { son, c: STP.veMntStpCoz(son, roller(son), Object.assign({}, cozOpt, { yogunluk: yog })), yog };
};
const birim = (c, ad) => c.birimler.find((b) => b.ad === ad);
const parcaPd = (son, ad) => son._geo[son.parcalar.findIndex((p) => p.ad === ad)].pd;

// ── OKUYUCU ────────────────────────────────────────────────────────────────
describe('OKUYUCU — doğrulama özellikleri, yoğunluk, malzeme', () => {
  test('doğrulama özellikleri: parçanın tanımına, birimleriyle (mm³ · mm² · parçanın ekseninde mm)', () => {
    const son = STP.veMntStpOku(S.kutleKalibi({ dogrulama: true }));
    const oz = P21.veStepP21Ozellikler(son._model);
    const blok = oz[parcaPd(son, 'Motor blok')];
    expect(blok).toEqual({ hacim: 600 * 400 * 450, alan: 2 * (600 * 400 + 400 * 450 + 600 * 450), merkez: [0, 0, 0] });
    const volan = oz[parcaPd(son, 'Volan muhafazası')];
    expect(volan.hacim).toBeCloseTo(Math.PI * 250 * 250 * 150, 6);
    // yoğunluk ve malzeme: şanzımanın iki parçası (doğrulamasız)
    expect(oz[parcaPd(son, 'Şanzıman gövdesi')]).toEqual({ yogunluk: 7200, malzeme: 'EN-GJL-250' });
    expect(oz[parcaPd(son, 'Çan')]).toEqual({ yogunluk: 2700, malzeme: 'EN AC-46000' });
    // braket: hiçbir özellik yok
    expect(oz[parcaPd(son, 'Braket üst')]).toBeUndefined();
  });

  test('yoğunluğun birimi: g/cm³ · kg/m³ · kg/mm³ aynı kg/m³; ad "density measure" da okunur', () => {
    ['g/cm3', 'kg/m3', 'kg/mm3'].forEach((b) => {
      const son = STP.veMntStpOku(S.kutleKalibi({ yogunlukBirim: b }));
      const oz = P21.veStepP21Ozellikler(son._model);
      expect(oz[parcaPd(son, 'Şanzıman gövdesi')].yogunluk).toBeCloseTo(7200, 9);
      expect(oz[parcaPd(son, 'Çan')].yogunluk).toBeCloseTo(2700, 9);
    });
    const yz = new Y.StepYaz(), u = yz.urun('P', 'Parça');
    yz.govde(u, S.kutuYuzleri(yz, 10, 10, 10), 'kati'); yz.temsil(u);
    yz.yogunluk(u, 7850, { ad: 'density measure', birim: 'kg/m3' });
    const m = P21.veStepP21Oku(yz.metin());
    expect(Object.values(P21.veStepP21Ozellikler(m))).toEqual([{ yogunluk: 7850 }]);
  });

  test('birleşik temsil, CATIA\'nın "wetted area measure"ı, türetilmiş hacim birimi; inç dosyası', () => {
    const tek = (opt, uzunluk) => {
      const yz = new Y.StepYaz({ uzunluk }), u = yz.urun('P', 'Parça');
      yz.govde(u, S.kutuYuzleri(yz, 100, 50, 20), 'kati'); yz.temsil(u);
      yz.dogrulama(u, Object.assign({ hacim: 100000, alan: 16000, merkez: [1.5, -2, 3] }, opt));
      return Object.values(P21.veStepP21Ozellikler(P21.veStepP21Oku(yz.metin())))[0];
    };
    const cevap = { hacim: 100000, alan: 16000, merkez: [1.5, -2, 3] };
    expect(tek({ birlesik: true, alanAd: 'wetted area measure' })).toEqual(cevap);
    expect(tek({ hacimBirim: 'turetilmis' })).toEqual(cevap);
    const inc = tek({}, 'inch');
    expect(inc.hacim).toBeCloseTo(100000, 6);
    expect(inc.alan).toBeCloseTo(16000, 8);
    inc.merkez.forEach((v, i) => expect(v).toBeCloseTo(cevap.merkez[i], 10));
  });

  test('adlı birimin öneki tabana uygulanır, sonra üs: m³ · m² · cm³ · cm² (MILLI\'de iki yol aynı sayıyı verir)', () => {
    const oku = (hacim, hb, alan, ab) => {
      const yz = new Y.StepYaz(), u = yz.urun('P', 'Parça');
      yz.govde(u, S.kutuYuzleri(yz, 10, 10, 10), 'kati'); yz.temsil(u);
      const ogeler = [
        yz.ekle("MEASURE_REPRESENTATION_ITEM('volume measure',VOLUME_MEASURE(" + hacim + '),#'
          + yz.ekle('(NAMED_UNIT(*)SI_UNIT(' + hb + ',.CUBIC_METRE.)VOLUME_UNIT())') + ')'),
        yz.ekle("MEASURE_REPRESENTATION_ITEM('surface area measure',AREA_MEASURE(" + alan + '),#'
          + yz.ekle('(AREA_UNIT()NAMED_UNIT(*)SI_UNIT(' + ab + ',.SQUARE_METRE.))') + ')')
      ];
      const r = yz.ekle("REPRESENTATION('',(#" + ogeler.join(',#') + '),#' + yz.baglam + ')');
      yz.ekle('PROPERTY_DEFINITION_REPRESENTATION(#' + yz.ekle("PROPERTY_DEFINITION('geometric validation property','',#" + u.pds + ')') + ',#' + r + ')');
      return Object.values(P21.veStepP21Ozellikler(P21.veStepP21Oku(yz.metin())))[0];
    };
    const m = oku('0.0001', '$', '0.016', '$');
    expect(m.hacim).toBeCloseTo(100000, 6);
    expect(m.alan).toBeCloseTo(16000, 8);
    const c = oku('100.', '.CENTI.', '160.', '.CENTI.');
    expect(c.hacim).toBeCloseTo(100000, 6);
    expect(c.alan).toBeCloseTo(16000, 8);
  });

  test('doğrulama özelliği OLMAYAN tanımın hacmi ve merkezi okunmaz; birimi okunamayan yoğunluk atlanır', () => {
    const yz = new Y.StepYaz(), u = yz.urun('P', 'Parça');
    yz.govde(u, S.kutuYuzleri(yz, 10, 10, 10), 'kati'); yz.temsil(u);
    const hb = yz.ekle('(NAMED_UNIT(*)SI_UNIT(.MILLI.,.CUBIC_METRE.)VOLUME_UNIT())');
    const v = yz.ekle("MEASURE_REPRESENTATION_ITEM('volume measure',VOLUME_MEASURE(5.),#" + hb + ')');
    const p = yz.ekle("CARTESIAN_POINT('centre point',(1.,2.,3.))");
    const r = yz.ekle("REPRESENTATION('volume',(#" + v + ',#' + p + '),#' + yz.baglam + ')');
    const pd = yz.ekle("PROPERTY_DEFINITION('user defined property','volume',#" + u.pds + ')');
    yz.ekle('PROPERTY_DEFINITION_REPRESENTATION(#' + pd + ',#' + r + ')');
    // yoğunluk: birimi uzunluk⁻² (boyutu tutmuyor)
    const du = yz.ekle('DERIVED_UNIT((#' + yz.ekle('DERIVED_UNIT_ELEMENT(#' + yz.ekle('(MASS_UNIT()NAMED_UNIT(*)SI_UNIT(.KILO.,.GRAM.))') + ',1.)')
      + ',#' + yz.ekle('DERIVED_UNIT_ELEMENT(#' + yz.uzunlukBirim + ',-2.)') + '))');
    const mr = yz.ekle("MEASURE_REPRESENTATION_ITEM('density',POSITIVE_RATIO_MEASURE(7.85),#" + du + ')');
    const r2 = yz.ekle("REPRESENTATION('density',(#" + mr + '),#' + yz.baglam + ')');
    yz.ekle('PROPERTY_DEFINITION_REPRESENTATION(#' + yz.ekle("PROPERTY_DEFINITION('material property','density',#" + u.pds + ')') + ',#' + r2 + ')');
    expect(P21.veStepP21Ozellikler(P21.veStepP21Oku(yz.metin()))).toEqual({});
  });

  test('montajın doğrulama özelliği parçaya karışmaz: değer parçanın kendi tanımında', () => {
    const son = STP.veMntStpOku(S.kutleKalibi({ dogrulama: true }));
    const oz = P21.veStepP21Ozellikler(son._model);
    // yalnız yedi motor parçasının tanımı hacim taşır (şanzıman ve braket parçaları ile montajlar taşımaz)
    expect(Object.keys(oz).filter((k) => oz[k].hacim > 0)).toHaveLength(7);
  });
});

// ── PARÇA PARÇA ────────────────────────────────────────────────────────────
describe('PARÇA PARÇA — birim parçaların toplamı; açık parça ayrı', () => {
  test('ÖNCE ÖLÇÜLEN: kutunun merkezi altı kapalı parçanın ağırlık merkezinden 45,15 mm uzaktaydı', () => {
    const { c } = coz();
    const b = birim(c, 'Motor');
    const kutu = [0, 1, 2].map((i) => (b.kutu[i] + b.kutu[i + 3]) / 2);
    expect(uz(kutu, MOTOR_KAPALI.c)).toBeCloseTo(45.145, 2);
  });

  test('açık parça hacme KATILMAZ: nokta kapalı parçaların merkezi (kiriş payı içinde), atalet var, uyarı adıyla ve payıyla', () => {
    const { c } = coz();
    const b = birim(c, 'Motor');
    expect(b.kaynak).toBe('hacim');
    expect(b.kapali).toBe(true);
    expect(uz(b.konum, MOTOR_KAPALI.c)).toBeLessThan(0.5);
    expect(Math.abs(b.V / MOTOR_KAPALI.W - 1)).toBeLessThan(0.005);
    expect(b.say).toEqual({ ag: 6, dosya: 0, nokta: 0, acik: 1 });
    expect(b.acikParca.map((p) => p.ad)).toEqual(['Kayış kapağı']);
    // kapağın yüzey payı: beş yüzü / bütün parçaların yüzü (volanın ağı kirişli)
    const kapak = 2 * (60 * 500 + 500 * 400 + 60 * 400) - 60 * 500;
    expect(b.acikPay).toBeCloseTo(kapak / 3983719, 3);
    expect(c.uyarilar).toContain('"Motor": 1 parça kapalı değil, hacme katılmadı (Kayış kapağı); yüzey payı %12,0.');
    expect(tfark(b.J, MOTOR_KAPALI.T)).toBeLessThan(0.01);
  });

  test('bütün parçalar açıksa eski yol: kutunun merkezi, atalet yok, sebebi', () => {
    const son = STP.veMntStpOku(S.kutleKalibi());
    const r = son.agac.map(() => null);
    r[dugum(son, 'Kayış kapağı')] = 'mnt-pump';
    const c = STP.veMntStpCoz(son, r);
    const b = c.birimler[0];
    expect([b.kaynak, b.kapali, b.J]).toEqual(['kutu', false, null]);
    expect(b.konum).toEqual([-330, 0, 650]);
    expect(c.uyarilar).toEqual(['"Kayış kapağı": ağ kapalı değil (4 açık kenar): kutu merkezi, atalet yok.']);
  });

  test('DOĞRULAMA ÖZELLİKLERİ: dosyanın hacmi ve merkezi ağınkinin yerine; açık parça nokta kütle olarak katılır', () => {
    const { son, c } = coz({ dogrulama: true });
    const b = birim(c, 'Motor');
    expect(b.say).toEqual({ ag: 0, dosya: 6, nokta: 1, acik: 0 });
    expect(uz(b.konum, MOTOR_TAM.c)).toBeLessThan(1e-9);
    expect(b.V).toBeCloseTo(MOTOR_TAM.W, 3);
    expect(c.uyarilar.filter((u) => /Motor/.test(u))).toEqual([]);
    // kapalı ağ ↔ dosya: kutular birebir, volan kiriş payı kadar
    expect(b.sapma.c).toBeLessThan(0.01);
    expect(b.sapma.V).toBeGreaterThan(0);
    expect(b.sapma.V).toBeLessThan(0.005);
    // kapağın tensörü yok (ağ açık): toplam, kapak nokta kütle sayılarak
    const pi = son.parcalar.findIndex((p) => p.ad === 'Kayış kapağı');
    const p = STP.veMntStpParcaOzellik(son, pi, STP.veMntStpAgUret(son, [], [pi])[pi]);
    expect([p.kaynak, p.nokta, p.J]).toEqual(['dosya', true, null]);
    const noktali = topla(MOTOR.map((x) => x.acik ? Object.assign({}, x, { J: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] }) : x));
    expect(tfark(b.J, noktali.T)).toBeLessThan(0.002);
  });

  test('dosyanın merkezi parçanın EKSENİNDE: dünyaya parçanın yeri ve yönüyle taşınır', () => {
    const { son } = coz({ dogrulama: true });
    const pi = son.parcalar.findIndex((p) => p.ad === 'Volan muhafazası');
    const p = STP.veMntStpParcaOzellik(son, pi, null);              // ağsız: yalnız dosya
    expect(p.kaynak).toBe('dosya');
    expect(uz(p.c, [480, 0, 450])).toBeLessThan(1e-9);
  });

  test('açık kenar sayımı (sayısal karma) metin anahtarlı başvuruyla birebir: kalıbın on bir parçası + üçgeni eksik kutu', () => {
    const son = STP.veMntStpOku(S.kutleKalibi());
    const ag = STP.veMntStpAgUret(son, [], son.parcalar.map((p, i) => i));
    // Başvuru: köşe konumdan (1e-6 mm), bir kez kullanılan kenar (eski yazım)
    const basvuru = (a) => {
      const id = [], harita = {}, say = {};
      for (let i = 0; i < a.uc.length; i += 3) {
        const k = [0, 1, 2].map((j) => Math.round(a.uc[i + j] / 1e-6)).join(',');
        if (harita[k] === undefined) harita[k] = Object.keys(harita).length;
        id.push(harita[k]);
      }
      for (let j = 0; j < a.ucgen.length; j += 3) {
        const [A, B, C] = [0, 1, 2].map((k) => id[a.ucgen[j + k]]);
        if (A === B || B === C || A === C) continue;
        [[A, B], [B, C], [C, A]].forEach(([p, q]) => { const k = Math.min(p, q) + ':' + Math.max(p, q); say[k] = (say[k] || 0) + 1; });
      }
      return Object.values(say).filter((n) => n === 1).length;
    };
    const sayim = son.parcalar.map((p, i) => [STP.veMntStpAgOzellik([ag[i]]).acik, basvuru(ag[i])]);
    sayim.forEach(([a, b]) => expect(a).toBe(b));
    expect(sayim.map((x) => x[0]).filter((n) => n > 0)).toEqual([4]);          // yalnız kapak: üst yüzün dört kenarı
    // bir üçgeni düşürülmüş kutu: üç açık kenar
    const kutu = ag[son.parcalar.findIndex((p) => p.ad === 'Motor blok')];
    const eksik = Object.assign({}, kutu, { ucgen: kutu.ucgen.slice(3) });
    expect(STP.veMntStpAgOzellik([eksik]).acik).toBe(basvuru(eksik));
    expect(STP.veMntStpAgOzellik([eksik]).acik).toBe(3);
  });

  test('parçanın özelliği AĞ İŞİNDE (oz): ağla aynı anda üretilir; hesap önbellekten aynı sayıyı verir', () => {
    const son = STP.veMntStpOku(S.kutleKalibi({ dogrulama: true }));
    const ag = [], oz = {};
    const liste = son.parcalar.map((p, i) => i);
    STP.veMntStpAgIs(son, ag, { oz }).uret(liste);
    expect(Object.keys(oz).map(Number).sort((a, b) => a - b)).toEqual(liste);
    liste.forEach((i) => expect(oz[i]).toEqual(STP.veMntStpParcaOzellik(son, i, ag[i])));
    const r = roller(son), sade = STP.veMntStpCoz(son, r, { ag: (pi) => ag[pi] });
    const onb = STP.veMntStpCoz(son, r, { ag: () => null, oz });       // ağ verilmese de önbellekten
    expect(onb.birimler.map((b) => [b.ad, b.konum, b.V])).toEqual(sade.birimler.map((b) => [b.ad, b.konum, b.V]));
  });

  test('parçaların toplamı = bütünün tensörü (paralel eksen): iki plakalı braket birebir', () => {
    const { c } = coz();
    const b = birim(c, 'Arka braket');
    expect(uz(b.konum, BRAKET_H.c)).toBeLessThan(1e-9);
    expect(tfark(b.J, BRAKET_H.T)).toBeLessThan(1e-9);
  });
});

// ── KÜTLE KAYNAĞI ──────────────────────────────────────────────────────────
describe('KÜTLE KAYNAĞI — elle · malzeme · dosyadan', () => {
  test('ÖNCE ÖLÇÜLEN: iki malzemeli şanzımanın hacim merkezi kütle merkezinden 68,18 mm uzakta', () => {
    expect(uz(SANZ_HACIM.c, SANZ_KUTLE.c)).toBeCloseTo(68.18, 2);
    const { c } = coz();
    expect(uz(birim(c, 'Şanzıman').konum, SANZ_HACIM.c)).toBeLessThan(1e-9);    // seçilmezse hacim merkezi
  });

  test('DOSYADAN: kütle, kütle merkezi ve tensör parçaların yoğunluklarıyla — birebir', () => {
    const { c } = coz({}, { yogunluk: { 'Şanzıman': 'dosya' } });
    const b = birim(c, 'Şanzıman');
    expect(b.yogSay).toBe(2);
    expect(b.dosya.m).toBeCloseTo(SANZ_KUTLE.W, 9);
    expect(b.dosya.m).toBeCloseTo(654.84, 9);
    expect(uz(b.konum, SANZ_KUTLE.c)).toBeLessThan(1e-9);
    expect(b.dosya.malzeme).toEqual(['EN-GJL-250', 'EN AC-46000']);
    const K = STP.veMntStpKutle(b, 418, 'dosya');
    expect(K.kaynak).toBe('dosya');
    expect(K.m).toBeCloseTo(654.84, 9);
    expect(tfark(K.I, SANZ_KUTLE.T.map((r) => r.map((v) => v * 1e-6)))).toBeLessThan(1e-9);
    expect(K.I[0][2]).not.toBe(0);                                  // gövde ile çan x ve z'de kaymış: çarpım
    expect(K.not).toBe('dosyanın yoğunlukları (EN-GJL-250, EN AC-46000)');
  });

  test('MALZEME: kütle = ρ·V (yazılan kütle yok sayılır), tensör homojen; not malzemenin adı ve yoğunluğu', () => {
    const { c } = coz();
    const b = birim(c, 'Arka braket');
    const K = STP.veMntStpKutle(b, 99, 'celik');
    expect(K.kaynak).toBe('malzeme');
    expect(K.m).toBeCloseTo(7850 * 2 * 120 * 600 * 20 * 1e-9, 12);
    expect(K.m).toBeCloseTo(22.608, 12);
    expect(tfark(K.I, BRAKET_H.T.map((r) => r.map((v) => v * 7850e-9 * 1e-6)))).toBeLessThan(1e-9);
    expect(K.not).toBe('Çelik · 7.850 kg/m³');
    expect(STP.VE_MNT_STP_MALZEME.map((m) => m.k)).toEqual(['celik', 'dokme', 'sfero', 'aluminyum', 'magnezyum']);
    STP.VE_MNT_STP_MALZEME.forEach((m) => expect(STP.veMntStpKutle(b, 0, m.k).m).toBeCloseTo(m.rho * BRAKET_H.W * 1e-9, 12));
  });

  test('ELLE: kütle yazılan (virgüllü metin de), tensör homojen yoğunlukla; kütle yoksa atalet de yok', () => {
    const { c } = coz();
    const b = birim(c, 'Arka braket');
    const K = STP.veMntStpKutle(b, '20,5', undefined);
    expect([K.kaynak, K.m, K.not]).toEqual(['elle', 20.5, 'homojen yoğunluk']);
    expect(tfark(K.I, BRAKET_H.T.map((r) => r.map((v) => v * 20.5 / BRAKET_H.W * 1e-6)))).toBeLessThan(1e-9);
    const bos = STP.veMntStpKutle(b, '', undefined);
    expect([Number.isNaN(bos.m), bos.I]).toEqual([true, null]);
  });

  test('kaynak geçersizse elle: yoğunluğu eksik birimde "dosya", hacimsiz birimde malzeme, tanınmayan anahtar', () => {
    const { c } = coz();
    const mot = birim(c, 'Motor'), brk = birim(c, 'Arka braket');
    expect(mot.dosya).toBeUndefined();
    expect(STP.veMntStpKutle(mot, 418, 'dosya')).toMatchObject({ kaynak: 'elle', m: 418 });
    expect(STP.veMntStpKutle(brk, 5, 'titanyum')).toMatchObject({ kaynak: 'elle', m: 5 });
    const acik = { kapali: false, V: 0, J: null };
    expect(STP.veMntStpKutle(acik, 5, 'celik')).toMatchObject({ kaynak: 'elle', m: 5, I: null });
  });

  test('yoğunluk bazı parçalarda eksikse "dosya" yok; yoğunluklu parça sayısı birimde', () => {
    const son = STP.veMntStpOku(S.guçGrubuStep([
      { id: 'A', ad: 'Dolu', sekil: 'kutu', olcu: [100, 100, 100], konum: [0, 0, 0], alt: 'G', yogunluk: 7200 },
      { id: 'B', ad: 'Eksik', sekil: 'kutu', olcu: [100, 100, 100], konum: [200, 0, 0], alt: 'G' }
    ], { altMontajlar: [{ id: 'G', ad: 'Gövde', konum: [0, 0, 0] }] }));
    const r = son.agac.map(() => null);
    r[dugum(son, 'Gövde')] = 'mnt-gearbox';
    const g = STP.veMntStpCoz(son, r).birimler[0];
    expect([g.yogSay, g.dosya]).toEqual([1, undefined]);
    expect(STP.veMntStpKutle(g, 10, 'dosya').kaynak).toBe('elle');
    expect(birim(coz().c, 'Motor').yogSay).toBe(0);
  });
});

// ── KAYIT ──────────────────────────────────────────────────────────────────
describe('KAYIT — "S" işaretinin dayanağı; kaynak rolle birlikte projeye', () => {
  test('aktarım kaydı: kütle türediyse işaretli ve gramına yuvarlı; not her gövdede; konum dosyada kütle merkezi', () => {
    const { son, c, yog } = coz({}, { yogunluk: { 'Şanzıman': 'dosya', 'Arka braket': 'celik' } });
    const k = STP.veMntStpKayit(c, { [dugum(son, 'Motor')]: 418, [dugum(son, 'Arka braket')]: 99 }, yog);
    const sat = (ad) => k.kaynak[k.liste.findIndex((n) => n.customName === ad)];
    const veri = (ad) => k.liste.find((n) => n.customName === ad).data;
    expect(sat('Motor')).toEqual({ cg: true, I: true, not: 'homojen yoğunluk' });
    expect(sat('Şanzıman')).toEqual({ cg: true, mass: true, I: true, not: 'dosyanın yoğunlukları (EN-GJL-250, EN AC-46000)' });
    expect(sat('Arka braket')).toEqual({ cg: true, mass: true, I: true, not: 'Çelik · 7.850 kg/m³' });
    expect([veri('Motor').mass, veri('Şanzıman').mass, veri('Arka braket').mass]).toEqual([418, 654.84, 22.608]);
    expect(uz([veri('Şanzıman').cgx, veri('Şanzıman').cgy, veri('Şanzıman').cgz], SANZ_KUTLE.c)).toBeLessThan(0.001);
    expect(veri('Şanzıman').Ixz).toBeCloseTo(SANZ_KUTLE.T[0][2] * 1e-6, 4);
  });

  test('rol kaydı: gövdede geçerli kaynak yazılır, takozda ve tanınmayanda yazılmaz; aynı dosyada geri gelir', () => {
    const son = STP.veMntStpOku(S.kutleKalibi());
    const r = roller(son, Object.assign({ 'Braket üst': null }, ROL));
    const mot = dugum(son, 'Motor'), san = dugum(son, 'Şanzıman'), brk = dugum(son, 'Arka braket');
    const k = STP.veMntStpRolKaydi(son, r, {}, {}, {}, { [mot]: 'titanyum', [san]: 'dosya', [brk]: 'sfero' });
    expect(k.roller.map((x) => [x.ad, x.yog])).toEqual([['Motor', undefined], ['Şanzıman', 'dosya'], ['Arka braket', 'sfero']]);
    const u = STP.veMntStpRolKaydiUygula(STP.veMntStpOku(S.kutleKalibi()), k);
    expect(u.yogunluk).toEqual({ [san]: 'dosya', [brk]: 'sfero' });
    const r2 = r.slice();
    r2[brk] = 'mnt-mount';
    expect(STP.veMntStpRolKaydi(son, r2, {}, {}, {}, { [brk]: 'sfero' }).roller.find((x) => x.ad === 'Arka braket').yog).toBeUndefined();
  });

  test('kayıtta SONRAKİ satır gövdenin parçasına rol verirse gövde düşer, kaynağı da gider; bozuk anahtar okunmaz', () => {
    const son = STP.veMntStpOku(S.kutleKalibi());
    const san = dugum(son, 'Şanzıman');
    const k = STP.veMntStpRolKaydi(son, roller(son), {}, {}, {}, { [san]: 'dosya' });
    const k2 = JSON.parse(JSON.stringify(k));
    k2.roller.push({ yol: ['SANZ_ASM.1', 'GOVDE.1'], rol: 'mnt-pump', ad: 'Şanzıman gövdesi' });
    expect(STP.veMntStpRolKaydiUygula(son, k2).yogunluk).toEqual({});
    const k3 = JSON.parse(JSON.stringify(k));
    k3.roller.find((x) => x.yog).yog = 'altin';
    expect(STP.veMntStpRolKaydiUygula(son, k3).yogunluk).toEqual({});
  });
});

// ── OTURUM ─────────────────────────────────────────────────────────────────
describe('OTURUM — kaynak seçicisi, hesap, aktarım', () => {
  let ev = null;
  beforeEach(() => {
    resetStubs(stubs);
    W._mwStpSifirla();
    global.veMntStack = [{ nodeId: 'mod-1' }];
    ev = { id: 'v1', type: 'mnt-viewer', def: componentDefs['mnt-viewer'], data: {} };
    global.nodes = [ev];
  });
  afterEach(() => { delete global.veMntStack; });
  const ac = (opt) => {
    const s = W.veMntWizStpOku(S.kutleKalibi(opt), 'kutle.stp');
    Object.keys(ROL).forEach((a) => W.veMntWizStpRol(dugum(s.sonuc, a), ROL[a]));
    W.veMntWizStpHesapla();
    return s;
  };
  const b = (s, ad) => s.coz.birimler.find((x) => x.ad === ad);
  const tablo = (s) => {
    const d = document.createElement('div');
    d.innerHTML = W._mwStpKutleHTML(s);
    return d;
  };

  test('seçici: hesap yenilenir, kayda yazılır; "dosya" ağırlık merkezini kütleyle ağırlıklar; aynı değer ve geçersiz seçim false', () => {
    const s = ac(), san = dugum(s.sonuc, 'Şanzıman'), brk = dugum(s.sonuc, 'Arka braket'), mot = dugum(s.sonuc, 'Motor');
    expect(uz(b(s, 'Şanzıman').konum, SANZ_HACIM.c)).toBeLessThan(1e-9);
    expect(W.veMntWizStpYogunluk(san, 'dosya')).toBe(true);
    expect(uz(b(s, 'Şanzıman').konum, SANZ_KUTLE.c)).toBeLessThan(1e-9);
    expect(ev.data.cad.roller.find((x) => x.ad === 'Şanzıman').yog).toBe('dosya');
    expect(W.veMntWizStpYogunluk(san, 'dosya')).toBe(false);              // değişmedi
    expect(W.veMntWizStpYogunluk(mot, 'dosya')).toBe(false);              // motorda yoğunluk yok
    expect(W.veMntWizStpYogunluk(brk, 'titanyum')).toBe(false);
    expect(W.veMntWizStpYogunluk(brk, 'aluminyum')).toBe(true);
    expect(W._mwStpKutleK(s, b(s, 'Arka braket')).m).toBeCloseTo(2700 * BRAKET_H.W * 1e-9, 12);
    expect(W.veMntWizStpYogunluk(san, '')).toBe(true);                   // elle
    expect(uz(b(s, 'Şanzıman').konum, SANZ_HACIM.c)).toBeLessThan(1e-9);
    expect(ev.data.cad.roller.find((x) => x.ad === 'Şanzıman').yog).toBeUndefined();
  });

  test('oturumun ağ işi parçanın kütle özelliğini hesabın önbelleğine yazar: hesap yalnız toplar', () => {
    const s = ac();
    expect(s.agIs.oz).toBe(s.oz);
    const rollu = [];
    STP.veMntStpBirimler(s.sonuc, s.roller).forEach((x) => x.parcalar.forEach((i) => rollu.push(i)));
    expect(rollu.every((i) => !!s.oz[i])).toBe(true);
  });

  test('takoz birimine kaynak verilmez; rolü düşen ya da takoza dönen birimin kaynağı gider', () => {
    const s = ac(), brk = dugum(s.sonuc, 'Arka braket');
    W.veMntWizStpYogunluk(brk, 'celik');
    W.veMntWizStpRol(brk, 'mnt-mount');
    expect(s.yogunluk[brk]).toBeUndefined();
    expect(W.veMntWizStpYogunluk(brk, 'celik')).toBe(false);
    W.veMntWizStpRol(brk, 'mnt-bracket');
    W.veMntWizStpYogunluk(brk, 'celik');
    W.veMntWizStpRol(brk, '');
    expect(s.yogunluk).toEqual({});
  });

  test('aynı dosya yeniden okununca kaynak kayıttan gelir; aktarım imzası kaynağı içerir', () => {
    const s = ac(), san = dugum(s.sonuc, 'Şanzıman');
    const i0 = W._mwStpImza(s);
    W.veMntWizStpYogunluk(san, 'dosya');
    expect(W._mwStpImza(s)).not.toBe(i0);
    W.veMntWizStpKapat();
    const s2 = W.veMntWizStpOku(S.kutleKalibi(), 'kutle.stp');
    expect(s2.yogunluk).toEqual({ [san]: 'dosya' });
    W.veMntWizStpHesapla();
    expect(uz(b(s2, 'Şanzıman').konum, SANZ_KUTLE.c)).toBeLessThan(1e-9);
  });

  test('KÜTLE TABLOSU: kaynak sütunu (Dosyadan yalnız yoğunluğu tam birimde), türetilen kütle değer, atalet ikonu ve sebebi', () => {
    const s = ac(), brk = dugum(s.sonuc, 'Arka braket');
    W.veMntWizStpKutle(dugum(s.sonuc, 'Motor'), '418');
    W.veMntWizStpYogunluk(brk, 'dokme');
    const d = tablo(s);
    expect(Array.from(d.querySelectorAll('thead th')).map((t) => t.firstChild.textContent)).toEqual(['Gövde', 'Hacim', 'Kaynak', 'Kütle', 'Atalet']);
    const sec = (ad) => Array.from(d.querySelectorAll('select[data-mw-stp-yog]')).find((x) => x.getAttribute('aria-label') === 'Kütle kaynağı — ' + ad);
    const se = (ad) => Array.from(sec(ad).options).map((o) => o.textContent);
    const MZ = ['Çelik', 'Dökme demir', 'Sfero döküm', 'Alüminyum', 'Magnezyum'];
    expect(se('Motor')).toEqual(['Elle'].concat(MZ));
    expect(se('Şanzıman')).toEqual(['Elle', 'Dosyadan'].concat(MZ));
    expect(sec('Arka braket').value).toBe('dokme');
    expect(sec('Motor').getAttribute('title')).toBe(null);
    // kütle hücresi: elle → alan; malzeme → değer, ipucunda dayanağı
    const satir = (ad) => d.querySelector('tr[data-mw-stp-govde="' + b(s, ad).dugum + '"]');
    expect(satir('Motor').querySelector('input[data-mw-stp-kutle]').value).toBe('418');
    const kg = satir('Arka braket').querySelector('[data-mw-stp-kutle-deger]');
    expect(satir('Arka braket').querySelector('input[data-mw-stp-kutle]')).toBe(null);
    expect([kg.textContent, kg.getAttribute('title')]).toEqual(['20,7', 'Dökme demir · 7.200 kg/m³']);
    // atalet: türetilir (dayanağı ve nokta kütle) · kütle bekliyor
    const at = (ad) => satir(ad).querySelector('.ve-mw-stp-atalet').getAttribute('title');
    expect(at('Motor')).toBe('Atalet tensörü türetilir · homojen yoğunluk');
    expect(at('Arka braket')).toBe('Atalet tensörü türetilir · Dökme demir · 7.200 kg/m³');
    expect(at('Şanzıman')).toBe('Kütle bekliyor.');
    // yoğunluk dosyada var: başlıkta durum yok
    expect(d.querySelectorAll('thead th')[2].getAttribute('title')).toBe(null);
  });

  test('kaynak seçicinin sebebi: yoğunluğu eksik parça sayısı; hacimsiz birimde kapalı; dosyada hiç yoğunluk yoksa başlıkta', () => {
    const s = ac(), san = dugum(s.sonuc, 'Şanzıman');
    const govde = s.coz.birimler.find((x) => x.dugum === san);
    const d1 = document.createElement('div');
    d1.innerHTML = W._mwStpKutleHTML(Object.assign({}, s, { coz: Object.assign({}, s.coz, {
      birimler: [Object.assign({}, govde, { yogSay: 1, dosya: undefined }), Object.assign({}, govde, { dugum: 999, ad: 'Kapak', kapali: false, V: 0, yogSay: 0, dosya: undefined })]
    }) }));
    const [a, k] = d1.querySelectorAll('select[data-mw-stp-yog]');
    expect([a.disabled, a.getAttribute('title')]).toEqual([false, '1 parçada yoğunluk yok.']);
    expect([k.disabled, k.getAttribute('title'), k.options.length]).toEqual([true, 'Hacim ölçülemedi.', 1]);
    W.veMntWizStpKapat();
    const s2 = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp');
    W.veMntWizStpRol(dugum(s2.sonuc, 'Motor bloğu'), 'mnt-motor');
    W.veMntWizStpHesapla();
    const d2 = document.createElement('div');
    d2.innerHTML = W._mwStpKutleHTML(s2);
    expect(d2.querySelectorAll('thead th')[2].getAttribute('title')).toBe('STEP dosyasında yoğunluk yok.');
  });

  test('aktarım: malzemeden kütle sihirbaza "S" işaretiyle; işaretin ipucu dayanağı; kütle yazılınca işaret düşer', () => {
    const s = ac(), brk = dugum(s.sonuc, 'Arka braket');
    W.veMntWizAc();
    W.veMntWizStpYogunluk(brk, 'celik');
    expect(W.veMntWizStpAktar()).not.toBeNull();
    const g = W.veMntWizState().govdeler.find((x) => x.ad === 'Arka braket');
    expect(g.mass).toBe(22.608);
    expect(g.kaynak).toEqual({ cg: true, mass: true, I: true, not: 'Çelik · 7.850 kg/m³' });
    const isaret = (alan) => {
      const d = document.createElement('div');
      d.innerHTML = W._mwKaynakIsaret(g, alan);
      return d.querySelector('sup') && d.querySelector('sup').getAttribute('title');
    };
    expect(isaret('mass')).toBe('STEP geometrisinden · Çelik · 7.850 kg/m³');
    expect(isaret('cg')).toBe('STEP geometrisinden · Çelik · 7.850 kg/m³');
    W._mwSet('govde.' + g.key + '.mass', '25');
    expect(g.kaynak).toEqual({ cg: true, I: true, not: 'Çelik · 7.850 kg/m³' });
    expect(W._mwKaynakIsaret({ kaynak: { konum: true, not: 'homojen yoğunluk' } }, 'konum')).toMatch(/title="STEP geometrisinden"/);
    W.veMntWizKapat(false);
  });

  test('aktarımdan sonra kaynak değişince uyarı söylenir', () => {
    const s = ac(), brk = dugum(s.sonuc, 'Arka braket');
    W.veMntWizAc();
    W.veMntWizStpAktar();
    W.veMntWizStpYogunluk(brk, 'celik');
    expect(W._mwStpOnizleme()).toBe(true);
    const d = document.createElement('div');
    d.innerHTML = W._mwStpKartHTML();
    expect(d.textContent).toMatch(/Aktarımdan sonra seçimler değişti\./);
    W.veMntWizKapat(false);
  });

  test('açık parçalı gövdenin satırı uyarı işareti taşır', () => {
    const s = ac();
    expect(W.veMntWizStpKonumUyari(b(s, 'Motor'))).toBe(true);
    expect(W.veMntWizStpKonumUyari(b(s, 'Şanzıman'))).toBe(false);
  });
});

// ── PENCERE — kayıtlı roller föyü ──────────────────────────────────────────
describe('PENCERE — kayıtlı roller föyünde kütlenin kaynağı', () => {
  test('malzeme adıyla (ipucunda yoğunluk), dosyadan, yazılan kütle', () => {
    const k = { roller: [
      { yol: ['BRAKET_ASM.1'], rol: 'mnt-bracket', ad: 'Arka braket', yog: 'celik', kg: 20 },
      { yol: ['SANZ_ASM.1'], rol: 'mnt-gearbox', ad: 'Şanzıman', yog: 'dosya' },
      { yol: ['MOTOR_ASM.1'], rol: 'mnt-motor', ad: 'Motor', kg: 418 }] };
    const d = document.createElement('div');
    d.innerHTML = CAD._mntCadKayitHTML(k);
    expect(Array.from(d.querySelectorAll('tbody tr')).map((tr) => tr.cells[2].textContent.trim())).toEqual(['Çelik', 'Dosyadan', '418,0']);
    expect(d.querySelector('tbody tr td:nth-child(3)').getAttribute('title')).toBe('Çelik · 7.850 kg/m³');
  });
});
