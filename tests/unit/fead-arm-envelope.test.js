/**
 * fead-arm-envelope.test.js — PİVOT GİRDİ, KOL AÇISI ZARFTAN SEÇİLİR
 *
 * Kullanıcı isteği (2026-08-28): *"Kullanıcı ilk olarak KIRMIZI NOKTA olarak
 * OTOMATİK GERGİ MONTAJ KOORDİNATLARInı verecek. Daha sonra program … bir
 * PİVOT NOKTASI ZARFI oluşturacak … bu sonsuz noktalar içinden en uygun
 * noktayı seçecek."* ve *"kayış boyu KESİNLİKLE BİR SONUÇ OLACAK."*
 *
 * Bu dosya üç ayrı şeyi tutuyor ve üçü farklı sınıftan:
 *
 *   1) YAPISAL — zarfın döndürdüğü nokta gerçekten ölçütün en iyisi mi,
 *      pivot türetilmiyor mu, kayış boyu gerçekten çıktı mı. Kalibrasyondan
 *      BAĞIMSIZ, sıkı toleransla.
 *   2) KALİBRASYON — 14 Gates sistemine karşı gevşek band (medyan ≤6°).
 *      Ölçüt tahmin değil, o 14 sistemden geriye çözüldü; test bunu
 *      SABİTLİYOR ki başka bir ölçüt sessizce yerine geçmesin.
 *   3) YÜZEY — panel/rozet kip kilidi, memo, sabitleme.
 *
 * Referans değerler tests/fixtures/fead-validation.js'ten okunuyor; İKİNCİ
 * KOPYA TUTULMUYOR.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const V = require('../fixtures/fead-validation.js');
const fead = require('../../js/cp-fead.js');
const RP = require('../../js/cp-fead-report.js');
const TEN = require('../../js/fead-tensioners.js');
Object.keys(TEN).forEach((k) => { global[k] = TEN[k]; });

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

/* ── Gates fixture sistemi → çekirdek yapılandırması ──────────────────────── */
function cfgOf(sys) {
  return {
    pulleys: sys.pulleys.map((p) => (p.tensioner
      ? { name: p.name, rPitch: p.rPitch, rEff: p.rEff, contact: p.contact, tensioner: true }
      : { name: p.name, rPitch: p.rPitch, rEff: p.rEff, contact: p.contact,
          x: p.x, y: p.y, crank: !!p.crank })),
    belt: sys.belt,
    tensioner: {
      pivot: sys.tensioner.pivot, armLength: sys.tensioner.armLength,
      preloadNm: sys.tensioner.preloadNm, rateNmPerDeg: sys.tensioner.rateNmPerDeg,
      freeAngleDeg: sys.tensioner.freeAngleDeg,
    },
    driveRatio: 1, lengthOffsetMm: sys.lengthOffsetMm || 0,
    geomOpt: { tolerant: true },
  };
}
const SYSTEMS = []
  .concat(Object.keys(V.AG00976).map((k) => ({ id: `AG00976/${k}`, d: V.AG00976[k], mk: () => V.buildAG00976(k) })))
  .concat(Object.keys(V.AG_MISC).map((k) => ({ id: k, d: V.AG_MISC[k], mk: () => V.buildMisc(k) })));
const w180 = (x) => { let v = x; while (v > 180) v -= 360; while (v < -180) v += 360; return v; };

function gatesCase(S) {
  const sys = S.mk();
  const mean = S.d.pos.find((p) => p.name === 'Mean');
  V.calibrated(sys, mean.rel, S.d.belt);
  return { sys, mean, cfg: cfgOf(sys),
           thG: sys.tensioner.freeAngleDeg + sys.tensioner.sense * mean.rel };
}

/* ═══════════════════════ 1) YAPISAL — kalibrasyondan bağımsız ═══════════ */
describe('zarf — yapısal özdeşlikler', () => {
  const S = SYSTEMS.find((x) => x.id === 'AG00976/1715@-250/110');

  test('döndürülen nokta ÖLÇÜTÜN en iyisidir (min take-up en büyük)', () => {
    const { cfg, mean } = gatesCase(S);
    const env = veFeadArmEnvelope(cfg, mean.rel);
    expect(env.ok).toBe(true);
    // Kaba ızgaranın HER geçerli örneği seçilenden kötü ya da eşit olmalı.
    const kotu = env.samples.filter((x) => x.ok && x.takeupMin > env.best.takeupMin + 1e-12);
    expect(kotu).toHaveLength(0);
    // ve seçilen açının kendisi gerçekten o değeri veriyor
    const yeniden = _feadEnvSample(cfg, env.armAbsDeg, mean.rel, VE_FEAD_ENV_TRAVEL_MULT);
    expect(yeniden.ok).toBe(true);
    expect(yeniden.takeupMin).toBeCloseTo(env.best.takeupMin, 9);
  });

  test('ölçüt EN KÜÇÜK take-up — ortalamaya ya da çalışma noktasına bakmaz', () => {
    const { cfg, mean } = gatesCase(S);
    const env = veFeadArmEnvelope(cfg, mean.rel);
    // Çalışma noktasındaki take-up'ı en büyük yapan açı BAŞKA bir açıdır:
    // ikisi çakışsaydı test hiçbir şey ayırt etmezdi.
    let enIyiCalisma = null;
    env.samples.forEach((x) => {
      if (x.ok && (!enIyiCalisma || x.takeupWork > enIyiCalisma.takeupWork)) enIyiCalisma = x;
    });
    expect(enIyiCalisma).toBeTruthy();
    expect(Math.abs(w180(enIyiCalisma.absDeg - env.armAbsDeg))).toBeGreaterThan(2);
  });

  test('gezinme aralığı KAYIŞ VERİSİNE bakmaz — yalnız yay künyesi', () => {
    const { cfg, mean } = gatesCase(S);
    const a = veFeadArmEnvelope(cfg, mean.rel).armAbsDeg;
    // Tolerans ve aşınma sıfırlansın: seçim DEĞİŞMEMELİ. (Kayış boyunun çıktı
    // olabilmesinin ön koşulu bu: seçim kayışı bilmeden yapılabilmeli.)
    const cfg2 = JSON.parse(JSON.stringify(cfg));
    cfg2.belt.tolerance = 0; cfg2.belt.wearPct = 0;
    expect(veFeadArmEnvelope(cfg2, mean.rel).armAbsDeg).toBeCloseTo(a, 6);
  });

  test('1.5 çarpanı ölçüte GERÇEKTEN giriyor (2.0 başka açı verir)', () => {
    const { cfg, mean } = gatesCase(S);
    const a = veFeadArmEnvelope(cfg, mean.rel).armAbsDeg;
    const b = veFeadArmEnvelope(cfg, mean.rel, { travelMult: 2.0 }).armAbsDeg;
    expect(Math.abs(w180(a - b))).toBeGreaterThan(1);
  });

  test('ince tarama kaba ızgarayı KESKİNLEŞTİRİR', () => {
    const { cfg, mean } = gatesCase(S);
    const env = veFeadArmEnvelope(cfg, mean.rel);
    const kaba = env.samples.reduce((b, x) => (x.ok && (!b || x.takeupMin > b.takeupMin) ? x : b), null);
    expect(env.best.takeupMin).toBeGreaterThanOrEqual(kaba.takeupMin);
    // seçilen açı kaba ızgaraya oturmuş OLMAMALI (aksi hâlde ince tarama ölü)
    expect(Math.abs(env.armAbsDeg % VE_FEAD_ENV_COARSE_DEG)).toBeGreaterThan(1e-9);
  });

  test('tohumlu YEREL arama genel taramayla aynı tepeyi bulur, daha az örnekle', () => {
    const { cfg, mean } = gatesCase(S);
    const g = veFeadArmEnvelope(cfg, mean.rel);
    const y = veFeadArmEnvelope(cfg, mean.rel, { seedDeg: g.armAbsDeg + 2, localSpan: 6 });
    expect(y.local).toBe(true);
    expect(Math.abs(w180(y.armAbsDeg - g.armAbsDeg))).toBeLessThan(0.6);
    expect(y.samples.length).toBeLessThan(g.samples.length);
  });

  test('yerel pencere ÇÖZÜLEMEZ bölgedeyse genel taramaya düşülür', () => {
    const { cfg, mean } = gatesCase(S);
    const g = veFeadArmEnvelope(cfg, mean.rel);
    // Kaba taramada geçerli hiçbir örneği olmayan bir bölgeden tohum seç.
    const kotu = g.samples.filter((x) => !x.ok);
    const uzak = kotu.reduce((b, x) => (Math.abs(w180(x.absDeg - g.armAbsDeg))
      > Math.abs(w180(b.absDeg - g.armAbsDeg)) ? x : b), kotu[0]);
    const y = veFeadArmEnvelope(cfg, mean.rel, { seedDeg: uzak.absDeg, localSpan: 3 });
    expect(y.local).toBe(false);
    expect(y.ok).toBe(true);
    expect(Math.abs(w180(y.armAbsDeg - g.armAbsDeg))).toBeLessThan(0.6);
  });

  test('yerel arama HER tohumda ya tepeyi bulur ya genel taramaya döner', () => {
    const { cfg, mean } = gatesCase(S);
    const g = veFeadArmEnvelope(cfg, mean.rel);
    [-90, -30, -6, 6, 30, 90].forEach((d) => {
      const y = veFeadArmEnvelope(cfg, mean.rel, { seedDeg: g.armAbsDeg + d, localSpan: 6 });
      expect(y.ok).toBe(true);
      if (!y.local) expect(Math.abs(w180(y.armAbsDeg - g.armAbsDeg))).toBeLessThan(0.6);
      // yerelde kaldıysa bulduğu nokta gerçekten pencerenin İÇİNDE bir tepedir
      else expect(Math.abs(w180(y.armAbsDeg - (g.armAbsDeg + d)))).toBeLessThan(6);
    });
  });

  // ── RAPOR YOLU: kurulmuş bir çözümden zarfı yeniden üret ─────────────────
  // Sıcak yol (selectArm:false + memo) taramayı ATLADIĞI için build.envelope
  // çoğu zaman yok; rapor ise zarf EĞRİSİNİ çizmek zorunda. Ayrı bir giriş
  // noktası olmasının sebebi bu — ve tek üretici kalması şart, ölçütün ikinci
  // bir kopyası bu modülün tekrar eden hata sınıfı.
  test('veFeadEnvelopeOf kurulmuş çözümden zarfı üretir, çözümü BOZMAZ', () => {
    const pack = veFeadExampleNodes('AG00976_GATES_2025');
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    ten.data.angleMode = 'envelope';
    delete ten.data.cenX; delete ten.data.cenY; delete ten.data.armMeanDeg;
    const b1 = veFeadBuildSystem(pack.nodes, pack.connections);
    expect(b1.ok).toBe(true);

    // (a) tarama zaten koştuysa AYNI nesne dönüyor — ikinci kez taramıyor
    expect(veFeadEnvelopeOf(b1)).toBe(b1.envelope);

    // (b) memo yüzünden tarama ATLANMIŞ bir çözümde de zarfı üretiyor
    const b2 = veFeadBuildSystem(pack.nodes, pack.connections, { selectArm: false });
    expect(b2.envelope).toBeUndefined();
    const env = veFeadEnvelopeOf(b2);
    expect(env).toBeTruthy();
    expect(env.ok).toBe(true);
    expect(env.samples.length).toBeGreaterThan(100);
    expect(Math.abs(env.armAbsDeg - b1.armAbsDeg)).toBeLessThan(0.2);

    // (c) çözümü BOZMUYOR: kayış boyu ve gerginlik aynı kalıyor
    expect(b2.beltLengthMm).toBeCloseTo(b1.beltLengthMm, 3);
    expect(b2.springTensionN).toBeCloseTo(b1.springTensionN, 3);

    // (d) yay künyesi eksikse null — uydurma bir eğri çizilmiyor
    const bad = { cfg: b2.cfg, mount: { relMeanDeg: NaN } };
    expect(veFeadEnvelopeOf(bad)).toBeNull();
    expect(veFeadEnvelopeOf(null)).toBeNull();
  });

  test('yay künyesi eksikse zarf SESSİZ kalmaz', () => {
    const { cfg } = gatesCase(S);
    const env = veFeadArmEnvelope(cfg, NaN);
    expect(env.ok).toBe(false);
    expect(env.note).toMatch(/nominal|yay/i);
  });

  test('çözülemeyen örnekler SEBEBİYLE işaretlenir', () => {
    const { cfg, mean } = gatesCase(S);
    const env = veFeadArmEnvelope(cfg, mean.rel);
    const kotu = env.samples.filter((x) => !x.ok);
    expect(kotu.length).toBeGreaterThan(0);
    expect(kotu.every((x) => typeof x.why === 'string' && x.why.length > 0)).toBe(true);
    // ve çözülebilen yay 360°'nin tamamı DEĞİL (paketleme dışı bir kısıt var)
    expect(env.feasibleDeg).toBeGreaterThan(0);
    expect(env.feasibleDeg).toBeLessThan(360);
  });
});

/* ═══════════════════════ 2) KALİBRASYON — 14 Gates sistemi ═════════════ */
describe('zarf — Gates kalibrasyonu', () => {
  test('14 sistemde seçilen açı Gates’in çalışma açısına yakın', () => {
    const farklar = SYSTEMS.map((S) => {
      const { cfg, mean, thG } = gatesCase(S);
      const env = veFeadArmEnvelope(cfg, mean.rel);
      expect(env.ok).toBe(true);
      return Math.abs(w180(thG - env.armAbsDeg));
    }).sort((a, b) => a - b);
    const medyan = farklar[Math.floor(farklar.length / 2)];
    // ÖLÇÜLDÜ: medyan 4.6°, 8/14 sistem ±5° içinde. Eşik ölçülene göre
    // sıkılaştırıldı — gevşek bir eşik başka bir ölçütün sessizce yerine
    // geçmesini kaçırırdı (ölçülen alternatifler: T_ort 10.3° · T_tepe 20.3° ·
    // T oranı 23.5° · hubload 30.8° · sarım 53.1°).
    expect(medyan).toBeLessThan(6);
    expect(farklar.filter((v) => v <= 5).length).toBeGreaterThanOrEqual(7);
    expect(farklar.filter((v) => v <= 20).length).toBeGreaterThanOrEqual(12);
  });

  test('KAYIŞ BOYU kayışa hiç bakmadan geri üretiliyor', () => {
    const hatalar = SYSTEMS.map((S) => {
      const { cfg, mean } = gatesCase(S);
      const env = veFeadArmEnvelope(cfg, mean.rel);
      return Math.abs(env.best.beltMm - S.d.belt) / S.d.belt * 100;
    }).sort((a, b) => a - b);
    // ÖLÇÜLDÜ: 11/14 sistem ±%0.35 içinde, en kötü %1.98 (AG0868-4PK).
    expect(hatalar[Math.floor(hatalar.length / 2)]).toBeLessThan(0.4);
    expect(hatalar.filter((v) => v <= 0.35).length).toBeGreaterThanOrEqual(10);
    expect(hatalar[hatalar.length - 1]).toBeLessThan(2.5);
  });

  test('Gates’in noktasındaki ÖLÇÜT CEZASI küçük — tepe düz değil, isabet gerçek', () => {
    let toplam = 0; let n = 0; let platoToplam = 0;
    SYSTEMS.forEach((S) => {
      const { cfg, mean, thG } = gatesCase(S);
      const env = veFeadArmEnvelope(cfg, mean.rel);
      const sG = _feadEnvSample(cfg, thG, mean.rel, VE_FEAD_ENV_TRAVEL_MULT);
      if (!sG.ok) return;
      toplam += (1 - sG.takeupMin / env.best.takeupMin) * 100; n += 1;
      const plato = env.samples.filter((x) => x.ok && x.takeupMin >= 0.99 * env.best.takeupMin).length;
      platoToplam += plato * VE_FEAD_ENV_COARSE_DEG;
    });
    expect(n).toBeGreaterThanOrEqual(13);
    expect(toplam / n).toBeLessThan(15);           // ölçüldü: %6.1
    // KESKİNLİK: %1 platosu dar olmalı, yoksa "±5° içinde" ucuz bir isabet olurdu.
    expect(platoToplam / n).toBeLessThan(12);      // ölçüldü: 4.9°
  });
});

/* ═══════════════════════ 3) KÖPRÜ — pivot girdi, boy çıktı ═════════════ */
function kur(key, tenPatch) {
  const pack = veFeadExampleNodes(key);
  pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
  const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
  if (tenPatch) tenPatch(ten.data);
  return { pack, ten, build: (opt) => veFeadBuildSystem(pack.nodes, pack.connections, opt) };
}
const ZARF = (td) => {
  td.angleMode = 'envelope';
  delete td.cenX; delete td.cenY; delete td.armMeanDeg;
};
const KEY = 'AG00976_GATES_2025';
const G = V.AG00976['1715@-250/110'];

describe('köprü — zarf kipi', () => {
  test('kip çözümü: cenX/cenY varsa mount, yalnız pivot varsa envelope, hiçbiri yoksa envelope', () => {
    expect(veFeadAngleMode({ cenX: 1, cenY: 2 })).toBe('mount');
    expect(veFeadAngleMode({ freeAngleDeg: 42 })).toBe('direct');
    expect(veFeadAngleMode({ pivotX: -250, pivotY: 110 })).toBe('envelope');
    expect(veFeadAngleMode({})).toBe('envelope');
    expect(veFeadAngleMode({ angleMode: 'mount', pivotX: 1, pivotY: 2 })).toBe('mount');
  });

  test('PİVOT TÜRETİLMEZ: montaj merkezi + kol açısı verilse bile zarf kipinde pivot GİRDİDİR', () => {
    const td = { angleMode: 'envelope', cenX: -170.08, cenY: 99.16, armLen: 90, armMeanDeg: 344 };
    // mount kipinde bu üçlü pivot üretiyor…
    expect(veFeadPivotFromArm(td)).toBeTruthy();
    // …ama zarf kipinde köprü onu KULLANMIYOR ve sebebini yazıyor.
    const { build } = kur(KEY, (d) => { ZARF(d); delete d.pivotX; delete d.pivotY;
      d.cenX = -170.08; d.cenY = 99.16; d.armMeanDeg = 344; });
    const b = build();
    expect(b.ok).toBeFalsy();
    expect(b.errors.join(' ')).toMatch(/montaj koordinatları/i);
    expect(b.errors.join(' ')).toMatch(/GİRDİ/);
  });

  test('KAYIŞ BOYU ÇIKTI: lengthMode ne yazarsa yazsın çözüm değişmiyor', () => {
    const sonuc = ['fixed', 'free', null].map((lm) => {
      const { pack, build } = kur(KEY, ZARF);
      const belt = pack.nodes.find((n) => n.type === 'fead-belt');
      if (lm) belt.data.lengthMode = lm; else delete belt.data.lengthMode;
      const b = build();
      expect(b.ok).toBe(true);
      expect(b.beltMode).toBe('free');
      return b.beltLengthMm;
    });
    expect(sonuc[1]).toBeCloseTo(sonuc[0], 9);
    expect(sonuc[2]).toBeCloseTo(sonuc[0], 9);
    // ve girilen efektif boy da sonucu değiştirmiyor
    const { pack, build } = kur(KEY, ZARF);
    pack.nodes.find((n) => n.type === 'fead-belt').data.effLength = 1500;
    expect(build().beltLengthMm).toBeCloseTo(sonuc[0], 6);
  });

  test('AG00976 zarftan çözülünce Gates’i geri üretiyor', () => {
    const b = kur(KEY, ZARF).build();
    expect(b.ok).toBe(true);
    expect(b.angleMode).toBe('envelope');
    expect(b.armSelected).toBe(true);
    // KAYIŞ BOYU — raporun REBL sütunu 1714.6 mm; kayış çözüme hiç girmedi.
    expect(Math.abs(b.beltLengthMm - G.belt) / G.belt * 100).toBeLessThan(0.5);
    // TASARIM GERGİNLİĞİ — raporun Design Tension satırı.
    expect(Math.abs(b.springTensionN - G.design) / G.design * 100).toBeLessThan(2);
    // SARIM AÇILARI — raporun kendi tablosu, 1° içinde.
    const g = F.geometryAt(b.sys, b.relDeg);
    g.names.forEach((nm, i) => {
      const ref = G.wrap[Object.keys(G.wrap)[i]];
      if (ref != null) expect(Math.abs(g.wrapDeg(i) - ref)).toBeLessThan(1.0);
    });
  });

  test('memo: seçilen açı düğüme yazılır ve selectArm:false onu KULLANIR', () => {
    const { ten, build } = kur(KEY, ZARF);
    expect(ten.data.armMeanDeg).toBeUndefined();
    const b1 = build();
    expect(ten.data.armMeanDeg).toBeCloseTo(b1.armAbsDeg, 3);
    expect(ten.data.armAuto).toBe(true);
    // ikinci kurulum tarama YAPMADAN aynı açıyı kullanır
    const b2 = build({ selectArm: false });
    expect(b2.armFromCache).toBe(true);
    expect(b2.envelope).toBeUndefined();
    expect(b2.armAbsDeg).toBeCloseTo(ten.data.armMeanDeg, 9);
    expect(b2.beltLengthMm).toBeCloseTo(b1.beltLengthMm, 2);
  });

  test('memo saveState ÇAĞIRMAZ (hesabın ara sonucu, kullanıcı kararı değil)', () => {
    kur(KEY, ZARF).build();
    expect(stubs.saveState).not.toHaveBeenCalled();
  });

  test('SABİTLENMİŞ açı birebir kullanılır, zarf hiç taranmaz', () => {
    const { build } = kur(KEY, (d) => { ZARF(d); d.armMeanDeg = -30; d.armPinned = true; });
    const b = build();
    expect(b.ok).toBe(true);
    expect(b.armPinned).toBe(true);
    expect(b.armSelected).toBeUndefined();
    expect(b.envelope).toBeUndefined();
    expect(b.armAbsDeg).toBeCloseTo(-30, 9);
    // sabitlenen açı gerçekten çözüme giriyor: seçilenden farklı boy verir
    const serbest = kur(KEY, ZARF).build();
    expect(Math.abs(b.beltLengthMm - serbest.beltLengthMm)).toBeGreaterThan(1);
  });

  test('GERİYE DÖNÜK: montaj merkezli eski kayıt aynen mount kipinde ve TABAN korunuyor', () => {
    const b = kur(KEY).build();
    expect(b.angleMode).toBe('mount');
    expect(b.beltMode).toBe('fixed');
    expect(b.relDeg).toBeCloseTo(28.0750, 3);
    expect(b.beltLengthMm).toBeCloseTo(1714.6, 4);
    expect(b.springTensionN).toBeCloseTo(544.05, 1);
    const bmc = kur('BMC_FEAD_2026').build();
    expect(bmc.ok).toBe(true);
    expect(bmc.relDeg).toBeCloseTo(28.4271, 3);
    expect(bmc.beltLengthMm).toBeCloseTo(1715.0, 4);
    expect(bmc.springTensionN).toBeCloseTo(532.14, 1);
  });
});

/* ═══════════════════════ 4) YÜZEY — kip kilidi ve panel ═══════════════ */
describe('yüzey — kayış kipi zarf kipinde KİLİTLİ', () => {
  function kanvas() {
    const pack = veFeadExampleNodes(KEY);
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    ZARF(ten.data);
    global.nodes = pack.nodes;
    global.connections = pack.connections;
    return pack;
  }

  test('veFeadBeltModeLocked yalnız zarf kipinde true', () => {
    const pack = kanvas();
    expect(veFeadBeltModeLocked()).toBe(true);
    pack.nodes.find((n) => n.type === 'fead-tensioner').data.angleMode = 'mount';
    expect(veFeadBeltModeLocked()).toBe(false);
  });

  test('panel kipi SERBEST (kilitli) gösterir ve seçici sunmaz', () => {
    const pack = kanvas();
    const belt = pack.nodes.find((n) => n.type === 'fead-belt');
    const h = fead.getFeadBeltPropertiesHTML(belt);
    expect(h).toMatch(/SERBEST \(kilitli\)/);
    expect(h).not.toMatch(/id="ve-fead-lengthMode-/);
    // kilit kalkınca seçici geri gelir
    pack.nodes.find((n) => n.type === 'fead-tensioner').data.angleMode = 'mount';
    expect(fead.getFeadBeltPropertiesHTML(belt)).toMatch(/id="ve-fead-lengthMode-/);
  });

  test('kip ROZETİ kilitliyken tıklansa da yazmıyor (DOM yolu)', () => {
    const pack = kanvas();
    const belt = pack.nodes.find((n) => n.type === 'fead-belt');
    belt.data.lengthMode = 'fixed';
    const kutu = () => {
      const d = document.createElement('div');
      d.className = 've-node';
      d.innerHTML = '<div class="ve-node-box"></div>';
      fead.veFeadApplyBadge(d, belt);
      return d.querySelector('.ve-fead-badge');
    };
    // Kilitliyken rozet SERBEST der ve tık hiçbir şey yazmaz.
    const r1 = kutu();
    expect(r1.textContent).toBe('SERBEST');
    r1.onclick({ stopPropagation() {}, preventDefault() {} });
    expect(belt.data.lengthMode).toBe('fixed');
    // Kilit kalkınca aynı tık gerçekten çeviriyor — yani test tıkı ölçüyor,
    // "hiçbir şey olmaması"nı değil.
    pack.nodes.find((n) => n.type === 'fead-tensioner').data.angleMode = 'mount';
    const r2 = kutu();
    expect(r2.textContent).toBe('SABİT');
    r2.onclick({ stopPropagation() {}, preventDefault() {} });
    expect(belt.data.lengthMode).toBe('free');
  });

  test('kip rozeti kilitliyken TIKLAMAYI reddeder', () => {
    const pack = kanvas();
    const belt = pack.nodes.find((n) => n.type === 'fead-belt');
    belt.data.lengthMode = 'fixed';
    expect(fead.veFeadToggleBeltMode(belt.id)).toBeNull();
    expect(belt.data.lengthMode).toBe('fixed');       // yazılmadı
    pack.nodes.find((n) => n.type === 'fead-tensioner').data.angleMode = 'mount';
    expect(fead.veFeadToggleBeltMode(belt.id)).toBe('free');
  });

  test('gergi paneli zarf kipinde MONTAJ KOORDİNATLARINI sorar, montaj merkezini sormaz', () => {
    const pack = kanvas();
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    const h = fead.getFeadTensionerPropertiesHTML(ten);
    expect(h).toMatch(/Otomatik Gergi Montaj Koordinatları/);
    expect(h).toMatch(/id="ve-fead-pivotX-/);
    expect(h).not.toMatch(/id="ve-fead-cenX-/);
    expect(h).not.toMatch(/Türetilen pivot/);
    // mount kipinde tam tersi
    ten.data.angleMode = 'mount';
    const h2 = fead.getFeadTensionerPropertiesHTML(ten);
    expect(h2).toMatch(/id="ve-fead-cenX-/);
    expect(h2).not.toMatch(/Otomatik Gergi Montaj Koordinatları/);
  });

  test('gergi paneli KÜNYE KÜTÜPHANESİ kartını basar ve künye uygulanabiliyor', () => {
    const pack = kanvas();
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    const h = fead.getFeadTensionerPropertiesHTML(ten);
    expect(h).toMatch(/Gergi Künye Kütüphanesi/);
    expect(h).toMatch(/veFeadApplyTenLib/);
    expect(h).toMatch(/AG0868/);                     // kayıtlar listede
    expect(h).toMatch(/SERTİFİKA değil/);            // geçerlilik sınırı kartın İÇİNDE
    // uygulanınca alanlar yazılıyor, pivot KORUNUYOR
    const pv = [ten.data.pivotX, ten.data.pivotY];
    fead.veFeadApplyTenLib(ten.id, 'AG0868-4PK');
    expect(ten.data.kArm).toBe(0.505);
    expect(ten.data.meanLoad).toBe(16.07);
    expect(ten.data.tenLib).toBe('AG0868-4PK');
    expect([ten.data.pivotX, ten.data.pivotY]).toEqual(pv);
    expect(stubs.saveState).toHaveBeenCalled();
  });

  test('zarf okuması seçilen açıyı, TÜREYEN kasnak merkezini ve ÇIKAN boyu basar', () => {
    const pack = kanvas();
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    // PANELİN KENDİSİNDEN okunuyor, üreteciden değil: okuma fonksiyonunu
    // doğrudan çağıran bir test, onu panelden düşüren mutasyonu GEÇİRİYORDU.
    const h = fead.getFeadTensionerPropertiesHTML(ten);
    expect(h).toMatch(/SEÇİLDİ/);
    expect(h).toMatch(/kasnak merkezi \(türedi\)/);
    expect(h).toMatch(/Gereken KAYIŞ BOYU \(çıktı\)/);
    // sayı gerçekten basılıyor (— değil)
    expect(h).toMatch(/171[0-9][,.]/);
    // ve modelin SINIRI sonucun içinde taşınıyor
    expect(h).toMatch(/paketleme/i);
  });

  test('sabitleme anahtarı açılırken seçilen açıyı düğüme YAZAR', () => {
    const pack = kanvas();
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    delete ten.data.armMeanDeg;
    fead.veFeadSetPinArm(ten.id, true);
    expect(ten.data.armPinned).toBe(true);
    expect(Number.isFinite(ten.data.armMeanDeg)).toBe(true);
    expect(stubs.saveState).toHaveBeenCalled();
  });

  test('KART YOLU zarfı taramaz: sürükleme karesinde seçilen açı DONUYOR', () => {
    const pack = kanvas();
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    const layout = pack.nodes.find((n) => n.type === 'fead-layout');
    veFeadBuildSystem(pack.nodes, pack.connections);          // memo dolsun
    const donmus = ten.data.armMeanDeg;
    expect(Number.isFinite(donmus)).toBe(true);
    // Yerleşimi oynat: en iyi saat KESİNLİKLE kaydı (aşağıda ölçülüyor).
    const alt = pack.nodes.find((n) => n.type === 'fead-alternator');
    alt.data.x += 25;
    const h = fead.veFeadLayoutCardHTML(layout);
    expect(typeof h).toBe('string');
    // Kart yeni geometriyi ÇİZİYOR ama açıyı yeniden seçmiyor: memo aynı.
    expect(ten.data.armMeanDeg).toBe(donmus);
    // …ve bu gerçekten bir fark: tarama koşsaydı açı değişirdi.
    const yeniden = veFeadBuildSystem(pack.nodes, pack.connections);
    expect(Math.abs(yeniden.armAbsDeg - donmus)).toBeGreaterThan(0.05);
  });

  test('sürükleme bitince zarf yeniden çözülür — SABİTLİYSE çözülmez', () => {
    const pack = kanvas();
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    veFeadBuildSystem(pack.nodes, pack.connections);        // memo dolsun
    const ilk = ten.data.armMeanDeg;
    // alternatörü kaydır: en iyi saat de kayar
    const alt = pack.nodes.find((n) => n.type === 'fead-alternator');
    alt.data.x = alt.data.x + 25;
    expect(fead.veFeadReselectArm()).toBe(true);
    expect(ten.data.armMeanDeg).not.toBeCloseTo(ilk, 3);
    // Hiçbir şey değişmediyse kart BOŞUNA tazelenmez (ikinci çağrı false).
    expect(fead.veFeadReselectArm()).toBe(false);
    // sabitliyken hiç dokunmaz
    ten.data.armPinned = true;
    const sabit = ten.data.armMeanDeg;
    alt.data.x = alt.data.x + 25;
    expect(fead.veFeadReselectArm()).toBe(false);
    expect(ten.data.armMeanDeg).toBeCloseTo(sabit, 9);
  });
});

/* ═══════════════════════ 5) RAPOR — envanter yönü değişiyor ════════════ */
describe('rapor — zarf kipinde kayış boyu ÇIKTI tarafında', () => {
  function coz(zarf) {
    const pack = veFeadExampleNodes(KEY);
    const ns = pack.nodes.map((n) => ({
      id: n.id, type: n.type, def: componentDefs[n.type],
      customName: n.customName, data: JSON.parse(JSON.stringify(n.data)),
    }));
    if (zarf) ZARF(ns.find((n) => n.type === 'fead-tensioner').data);
    const build = veFeadBuildSystem(ns, pack.connections);
    const solv = ns.filter((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver)[0];
    const R = veFeadAnalyze(build, {
      rows: veFeadDutyRows(solv), cylinders: 6, fatigueModel: 'PK-2_2p-MT3',
    });
    R.build = build; R.pulleyNames = build.names;
    R.serviceFact = (solv && solv.data && Number(solv.data.serviceFact)) || 0;
    return RP._frSection8(R, { id: 'rep1', type: 'fead-report', data: {} });
  }

  test('kip satırı ZARF der, kol açısı basılır', () => {
    const h = coz(true);
    expect(h).toMatch(/ZARF çözüldü/);
    expect(h).toMatch(/Kol çalışma açısı/);
    expect(h).toMatch(/Zarf ölçütü/);
  });

  test('envanterde kayış boyu GİRDİ değil TÜREV', () => {
    const z = coz(true);
    // "— aşağıdakilerin hiçbiri girilmez —" ayracının ALTINDA olmalı
    const ayrac = z.indexOf('aşağıdakilerin hiçbiri girilmez');
    const boy = z.indexOf('Kayış efektif boyu');
    expect(ayrac).toBeGreaterThan(0);
    expect(boy).toBeGreaterThan(ayrac);
    expect(z).not.toMatch(/Kayış efektif boyu[^<]*<\/td>[\s\S]{0,160}girdi<\/b> — kayış künyesi/);
    // pivot ise GİRDİ tarafında ve adı değişmiş
    expect(z).toMatch(/Gergi montaj koordinatı \(pivot\)/);
    // mount kipinde tam tersi: boy GİRDİ, pivot "Gergi pivotu"
    const m = coz(false);
    expect(m.indexOf('Kayış efektif boyu')).toBeLessThan(m.indexOf('aşağıdakilerin hiçbiri girilmez'));
    expect(m).toMatch(/Gergi pivotu/);
  });
});

/* ═══════════════ 6) KAYIŞ TİPİNE BAĞLI ÇIKTILAR — ŞİMDİLİK KAPALI ═══════ */
describe('kayış tipine bağlı çıktılar', () => {
  function coz(zarf, override) {
    const pack = veFeadExampleNodes(KEY);
    const ns = pack.nodes.map((n) => ({
      id: n.id, type: n.type, def: componentDefs[n.type],
      customName: n.customName, data: JSON.parse(JSON.stringify(n.data)),
    }));
    if (zarf) ZARF(ns.find((n) => n.type === 'fead-tensioner').data);
    if (override) ns.find((n) => n.type === 'fead-belt').data.beltDataMode = override;
    const build = veFeadBuildSystem(ns, pack.connections);
    const solv = ns.filter((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver)[0];
    return { build, R: veFeadAnalyze(build, {
      rows: veFeadDutyRows(solv), cylinders: 6, fatigueModel: 'PK-2_2p-MT3' }), ns };
  }

  test('kip çözümü: zarfta none, diğerlerinde full, açık seçim ezer', () => {
    expect(veFeadBeltDataMode({}, 'envelope')).toBe('none');
    expect(veFeadBeltDataMode({}, 'mount')).toBe('full');
    expect(veFeadBeltDataMode({}, 'direct')).toBe('full');
    expect(veFeadBeltDataMode({ beltDataMode: 'full' }, 'envelope')).toBe('full');
    expect(veFeadBeltDataMode({ beltDataMode: 'none' }, 'mount')).toBe('none');
  });

  test('KAPALIYKEN ömür, yorulma ve açıklık frekansları ÜRETİLMİYOR', () => {
    const { R } = coz(true);
    expect(R.ok).toBe(true);
    expect(R.beltDataMode).toBe('none');
    expect(R.life).toBeNull();
    expect(R.fatigue).toBeNull();
    expect(R.analysis.duty.length).toBeGreaterThan(0);
    R.analysis.duty.forEach((d) => { expect(d.frequencies).toBeUndefined(); });
    // …ama kalan zincir ÇALIŞIYOR: gerilme, hubload, kayma, tork
    R.analysis.duty.forEach((d) => {
      expect(d.perPulley.length).toBeGreaterThan(0);
      expect(d.hubloads.length).toBeGreaterThan(0);
      expect(d.slip.length).toBeGreaterThan(0);
    });
  });

  test('SESSİZ DEĞİL: kapatılanlar adıyla listeleniyor', () => {
    const { R } = coz(true);
    expect(Array.isArray(R.beltDataOff)).toBe(true);
    expect(R.beltDataOff.length).toBe(4);
    expect(R.beltDataOff.join(' ')).toMatch(/B10/);
    expect(R.beltDataOff.join(' ')).toMatch(/frekans/i);
  });

  test('AÇIKKEN hepsi geri geliyor — kapatma gerçekten bir fark', () => {
    const { R } = coz(true, 'full');
    expect(R.beltDataMode).toBe('full');
    expect(R.beltDataOff).toBeUndefined();
    expect(R.life).toBeTruthy();
    expect(R.fatigue).toBeTruthy();
    R.analysis.duty.forEach((d) => { expect(d.frequencies).toBeTruthy(); });
  });

  test('GERİYE DÖNÜK: mount kipindeki eski kayıt full kalıyor', () => {
    const { R } = coz(false);
    expect(R.beltDataMode).toBe('full');
    expect(R.life).toBeTruthy();
    expect(R.fatigue).toBeTruthy();
  });

  test('PROFİL KAPATILMIYOR — geometri hâlâ hb/hr ile çözülüyor', () => {
    const kapali = coz(true).build;
    const acik = coz(true, 'full').build;
    // Aynı kol açısı, aynı geometri: anahtar sayıları DEĞİŞTİRMİYOR.
    expect(kapali.armAbsDeg).toBeCloseTo(acik.armAbsDeg, 6);
    expect(kapali.beltLengthMm).toBeCloseTo(acik.beltLengthMm, 6);
    expect(kapali.springTensionN).toBeCloseTo(acik.springTensionN, 6);
    // ve pitch yarıçapı gerçekten hb taşıyor (OD/2 değil)
    const p = kapali.sys.pulleys.find((x) => !x.tensioner);
    expect(p.rPitch).toBeGreaterThan(p.rEff);
  });

  test('RAPOR kapatılanları adıyla ve sebebiyle yazıyor', () => {
    const { R } = coz(true);
    R.build = R.build || null;
    // BELGENİN KENDİSİNDEN okunuyor, üreteciden değil: kutuyu doğrudan çağıran
    // bir test, onu §8'den düşüren mutasyonu GEÇİRİYORDU.
    R.pulleyNames = R.build && R.build.names;
    R.serviceFact = 1.3;
    const h = RP._frSection8(R, { id: 'rep1', type: 'fead-report', data: {} });
    expect(h).toMatch(/YER ALMIYOR/);
    expect(h).toMatch(/B10 kayış ömrü/);
    expect(h).toMatch(/kapatılamaz/);
    // açıkken kutu HİÇ basılmıyor (yanlış alarm yok)
    const a = coz(true, 'full'); a.R.pulleyNames = a.build.names; a.R.serviceFact = 1.3;
    expect(RP._frSection8(a.R, { id: 'r2', type: 'fead-report', data: {} }))
      .not.toMatch(/YER ALMIYOR/);
    expect(RP._frBeltDataBox(a.R)).toBe('');
  });

  test('panel anahtarı ve KAPATILANLARIN listesi kayış panelinde', () => {
    const pack = veFeadExampleNodes(KEY);
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    ZARF(pack.nodes.find((n) => n.type === 'fead-tensioner').data);
    global.nodes = pack.nodes; global.connections = pack.connections;
    const belt = pack.nodes.find((n) => n.type === 'fead-belt');
    const h = fead.getFeadBeltPropertiesHTML(belt);
    expect(h).toMatch(/Kayış Tipine Bağlı Çıktılar/);
    expect(h).toMatch(/id="ve-fead-beltDataMode-/);
    expect(h).toMatch(/B10 kayış ömrü/);
    expect(h).toMatch(/Profil .* yine soruluyor/);
    // açıkken metin değişiyor
    belt.data.beltDataMode = 'full';
    const h2 = fead.getFeadBeltPropertiesHTML(belt);
    expect(h2).not.toMatch(/üretilmiyor/);
  });
});
