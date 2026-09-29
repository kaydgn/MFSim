/**
 * fead-kayma-gates.test.js — KAYMA EMNİYETİ GATES KOŞULUNDA · SÜRTÜNME SEÇİMİ (kural 49)
 *
 * Kullanıcı kararı (2026-09-29): *"Bir Gates raporları üzerinden ilerliyoruz
 * fakat bu değerin seçimini yine kullanıcıya bırakmamız gerekiyor … Gates
 * kalibrasyonu en büyük verimiz şu anda."*
 *
 * Gates raporlarının kayma grafikleri sayıya çevrildi (docs/gates-reports/kayma)
 * ve MFSim'in hesabından iki yerde ayrıştığı ölçüldü: SF'nin TANIMI (oran →
 * kapasite) ve kaymanın arandığı YÜK DURUMU (çevrim satırı → ±ivme × %10/%100
 * tepe yük × avara sürtünmesi). İkisi köprüde kapandı; μ ve küçük kasnak kaybı
 * kullanıcının seçimi (Gates kalibrasyonu · Literatür · Elle).
 *
 * Kapının en değerli iki parçası:
 *   ZİNCİR  — yeni zincir, ivmesiz ve sürtünmesiz çevrim yükünde çekirdeğin
 *             kararlı çözümünü BİREBİR veriyor (bağımsız yol: FEADCore.spanTensions).
 *   GATES   — köprünün hesabı, Gates'in girdileriyle (ivme, atalet, raporun
 *             tepe güç grafiği) beslenince Gates'in 11 raporundaki kayma
 *             eğrilerini üretiyor; Literatür seçeneğinin bilinen iyimserliği de
 *             sayıyla çivili.
 */
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const E = require('../../js/fead-engines.js');
const A = require('../../js/fead-accessories.js');
const CK = require('../../js/fead-checks.js');
const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;
eval(loadSource('cp-accessories.js'));
global.VE_ALTERNATOR_PRESETS = VE_ALTERNATOR_PRESETS;
global.VE_AC_PRESETS = VE_AC_PRESETS;
global.VE_AIRCOMP_PRESETS = VE_AIRCOMP_PRESETS;
global.veAccInterpCurve = veAccInterpCurve;
const DUTY = require('../../js/fead-duty.js');
const BELTS = require('../../js/fead-belts.js');
const TENS = require('../../js/fead-tensioners.js');
[DUTY, BELTS, TENS, E, A, CK].forEach((m) => {
  Object.keys(m).forEach((k) => { global[k] = m[k]; });
});
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
});

const kabuk = () => {
  document.body.innerHTML = '<div id="ve-canvas"></div>'
    + '<div id="ve-feadwiz-overlay" style="display:none;">'
    + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
};

// Örnekten düğümler — `mut(solverData)` sürtünmeyi, ivmeyi ya da yükü değiştirir.
function kur(anahtar, mut) {
  const pack = M.veFeadExampleNodes(anahtar);
  const ns = pack.nodes.map((n) => ({
    id: n.id, type: n.type, def: componentDefs[n.type],
    customName: n.customName, data: JSON.parse(JSON.stringify(n.data))
  }));
  const sv = ns.find((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver);
  if (mut) mut(sv.data, ns);
  global.nodes = ns;
  return { ns, sv, build: M.veFeadBuildSystem(ns) };
}
function coz(anahtar, mut) {
  const k = kur(anahtar, mut);
  const R = M.veFeadAnalyze(k.build, { rows: M.veFeadDutyRows(k.sv), cylinders: 6 });
  R.build = k.build;
  return Object.assign(k, { R });
}
const yukluMin = (R, alan) => Math.min.apply(null, R.analysis.duty.flatMap((d) =>
  (d[alan || 'slip'] || []).filter((s) => M.veFeadSlipYukTasir(s)).map((s) => s.SF)));

// ═══════════════════════════════════════════════════════════════ ZİNCİR ══
describe('ZİNCİR — çekirdeğin kararlı çözümüyle birebir', () => {
  // Bağımsız yol: çekirdeğin `spanTensions`i. Kayma zinciri ivmesiz,
  // sürtünmesiz ve çevrimin kendi yükleriyle beslenince aynı açıklık
  // gerginliklerini vermek ZORUNDA — ayrışırsa kayma, gerilme tablosundan
  // başka bir kayışı hesaplıyordur.
  test('12 örneğin bütün devirlerinde |ΔT| < 1e−9 N', () => {
    let satir = 0;
    M.veFeadExampleKeysAll().forEach((anahtar) => {
      const { sv, build } = kur(anahtar);
      expect(build.ok).toBe(true);
      const K = M.veFeadKaymaBaglam(build, {}, M.veFeadSurtunme({}));
      const n = build.sys._n;
      M.veFeadDutyToCore(build, M.veFeadDutyRows(sv)).forEach((d) => {
        const t = F.spanTensions(build.sys, d);
        const K0 = Object.assign({}, K, {
          ivme: [0], yukIdx: [], kayitliIdx: [],
          suruk: build.sys.pulleys.map((p, i) => (i === build.sys._crkIdx ? 0 : (d.loadsKw[p.name] || 0)))
        });
        const r = M.veFeadKaymaDevir(build, K0, d.engineRpm, 1);
        r.slip.forEach((s, i) => {
          const Tin = t.spanN[(i - 1 + n) % n], Tout = t.spanN[i];
          expect(Math.abs(s.TgerginN - Math.max(Tin, Tout))).toBeLessThan(1e-9);
          expect(Math.abs(s.TgevsekN - Math.min(Tin, Tout))).toBeLessThan(1e-9);
        });
        satir++;
      });
    });
    expect(satir).toBeGreaterThan(70);
  });
});

// ═══════════════════════════════════════════════════════════════ TANIM ══
describe('TANIM — kapasite: SF = T_gevşek·(e^(μφ) − 1) / (T_gergin − T_gevşek)', () => {
  test('satırın SF\'si kendi oranı ve kapasitesinden; sınırda oran tanımıyla aynı hüküm', () => {
    const { R } = coz('AG00976_GATES_2025');
    let n = 0;
    R.analysis.duty.forEach((d) => d.slip.forEach((s) => {
      const bek = s.TgevsekN * (s.capstanCapacity - 1) / (s.TgerginN - s.TgevsekN);
      expect(s.SF).toBeCloseTo(bek, 9);
      expect(s.SF).toBeCloseTo((s.capstanCapacity - 1) / (s.tensionRatio - 1), 6);
      // Hüküm iki tanımda AYNI: SF ≥ 1 ⇔ oran ≤ e^(μφ).
      expect(s.SF >= 1).toBe(s.tensionRatio <= s.capstanCapacity);
      n++;
    }));
    expect(n).toBeGreaterThan(60);
  });

  test('pay torkla DOĞRUSAL — talebi iki katına çıkarmak (c₂ = 2 değil, tam 2×) SF\'yi yarıya indirir', () => {
    // Gevşek taraf sabit tutulursa kapasite tanımı bir tork oranıdır.
    const { build } = kur('AG00810_GATES_2021', (sd) => { sd.accelRpmS = 1000; sd.decelRpmS = 1000; });
    const K = M.veFeadKaymaBaglam(build, {}, M.veFeadSurtunme({}));
    const K1 = Object.assign({}, K, { ivme: [0], yukIdx: [], kayitliIdx: [], suruk: K.suruk.map((x, i) => (i === 2 ? 3 : 0)) });
    const K2 = Object.assign({}, K1, { suruk: K1.suruk.map((x) => x * 2) });
    const r1 = M.veFeadKaymaDevir(build, K1, 1200, 1).slip[2];
    const r2 = M.veFeadKaymaDevir(build, K2, 1200, 1).slip[2];
    // Sürülen kasnağın gevşek tarafı gergiye bağlıysa T_gevşek sabit kalır.
    expect(r2.TgevsekN).toBeCloseTo(r1.TgevsekN, 9);
    expect(r2.SF).toBeCloseTo(r1.SF / 2, 9);
  });
});

// ═══════════════════════════════════════════════════════════════ KOŞUL ══
describe('KOŞUL — her devirde ±ivme × %10/%100 tepe yük × avara sürtünmesinin en kötüsü', () => {
  test('satır kritik koşulu taşır ve o koşul gerçekten en küçüğü verir', () => {
    const { R, build } = coz('AG00976_GATES_2025');
    const K = M.veFeadKaymaBaglam(build, {}, R.surtunme);
    expect(K.ivme).toEqual([1100, 0, -1100]);
    expect(K.yukIdx.length).toBe(2);
    const d = R.analysis.duty[1];
    d.slip.forEach((s, i) => {
      expect([1100, 0, -1100]).toContain(s.kritik.ivme);
      Object.values(s.kritik.yuk).forEach((y) => expect([10, 100]).toContain(y));
      // Kritik koşulu tek başına koştur: aynı sayı.
      const tek = Object.assign({}, K, { ivme: [s.kritik.ivme] });
      const r = M.veFeadKaymaDevir(build, tek, d.engineRpm, R.servis.deger).slip[i];
      expect(r.SF).toBeLessThanOrEqual(s.SF + 1e-9);
    });
  });

  test('BAĞIMSIZ SAĞLAMA: AG00810 tepe gerginliği Gates\'in 2.530 N\'una %0,2 içinde', () => {
    // Gates s.1: CRK 2530 N @ 600 d/dk, +1000 d/dk/s, ALT 9,0 kW. Sürtünmeden
    // bağımsız bir sayı: zincirin kendisi, atalet ve bir kez uygulanan ivmeyle.
    const { build } = kur('AG00810_GATES_2021', (sd) => { sd.accelRpmS = 1000; });
    const K = M.veFeadKaymaBaglam(build, {}, M.veFeadSurtunme({}));
    const alt = build.names.findIndex((x) => /Alternat/.test(x));
    const Kt = Object.assign({}, K, { ivme: [1000], yukIdx: [], kayitliIdx: [],
      suruk: K.suruk.map((x, i) => (i === alt ? 9.0 : 0)) });
    // Gates'in kayma sayfasındaki atalet: ALT 0,014 · avaralar 0,0002 / 0,0004
    const r = M.veFeadKaymaDevir(build, Kt, 600, 1);
    const tepe = Math.max.apply(null, r.slip.map((s) => s.TgerginN));
    expect(Math.abs(tepe / 2530 - 1)).toBeLessThan(0.002);
  });

  test('ivme yoksa yalnız sabit devir koşulu — ve bu sonuçta YAZILI', () => {
    const { R } = coz('AG00810_GATES_2021', (sd) => { delete sd.accelRpmS; delete sd.decelRpmS; });
    R.analysis.duty.forEach((d) => d.slip.forEach((s) => expect(s.kritik.ivme).toBe(0)));
    expect(R.limits.join(' ')).toMatch(/ivmelenme ve yavaşlama girilmedi/);
    expect(R.kaymaKosul).toMatchObject({ ivmelenme: null, yavaslama: null, suruklemeKw: 0.01 });
  });

  test('tepe güç eğrisi yoksa çevrimin yükü %100 sayılır — ve bu YAZILI; eğri varsa ondan', () => {
    const g = coz('AG00976_GATES_2025').R;
    expect(g.kaymaKosul.yuk.map((y) => y.kaynak)).toEqual(['cevrim', 'cevrim']);
    expect(g.limits.join(' ')).toMatch(/tepe güç eğrisi yok — çevrimin kayıtlı yükü %100 sayıldı/);
    const b = coz('BMC_FEAD_2026').R;
    expect(b.kaymaKosul.yuk.map((y) => y.kaynak)).toEqual(['egri', 'egri']);
    expect(b.limits.join(' ')).not.toMatch(/tepe güç eğrisi yok/);
  });
});

// ════════════════════════════════════════════════════════════════ ROL ══
describe('ROL — yük taşıma rolden gelir, oran eşiğinden değil', () => {
  // Gates koşulunda avara da atalet görür ve kritik koşulda oranı 1,01'i
  // aşar — ölçüldü, AG00976'da altı kasnağın beşi "yük taşıyan" çıkıyordu.
  test('AG00976: oranı 1,01\'i aşan avara yine YÜK TAŞIMAZ; hüküm ve eşik ona dayanmaz', () => {
    const { R } = coz('AG00976_GATES_2025');
    const d0 = R.analysis.duty[0];
    const avara = d0.slip.filter((s) => /Avara|Gergi/.test(s.name));
    expect(avara.length).toBe(3);
    expect(avara.some((s) => s.tensionRatio > M.VE_FEAD_SLIP_LOADED_RATIO)).toBe(true);
    avara.forEach((s) => expect(M.veFeadSlipYukTasir(s)).toBe(false));
    expect(d0.slip.filter((s) => M.veFeadSlipYukTasir(s)).map((s) => s.name))
      .toEqual(['Sürücü Kasnak (FAN)', 'Klima Kompresörü', 'Alternatör (155 A)']);
    const esik = M.veFeadSlipThreshold(R.build, R.analysis.duty, R.servis.deger);
    expect(/Avara|Gergi/.test(esik.pulley)).toBe(false);
  });

  test('rolü taşımayan eski satır oran eşiğine düşer', () => {
    expect(M.veFeadSlipYukTasir({ tensionRatio: 1.2 })).toBe(true);
    expect(M.veFeadSlipYukTasir({ tensionRatio: 1.001 })).toBe(false);
    expect(M.veFeadSlipYukTasir({ tensionRatio: 1.2, yukTasir: false })).toBe(false);
    expect(M.veFeadSlipYukTasir(null)).toBe(false);
  });

  // AVARAYA YAZILMIŞ GÜÇ DÜŞÜRÜLMEZ: gerilme tablosu onu kullanıyor.
  test('AG00902: çevrimde gücü yazılı avara kaymaya katılır, yük taşır ve sonuçta söylenir', () => {
    const { R } = coz('AG00902_1275_GATES_2023');
    const idr = R.analysis.duty[0].slip.find((s) => /^Avara/.test(s.name));
    expect(M.veFeadSlipYukTasir(idr)).toBe(true);
    expect(yukluMin(R)).toBeLessThan(1);                       // eski hükümle aynı: kayıyor
    expect(R.limits.join(' ')).toMatch(/Avara güç çekmeyen bir kasnak ama çevrimde gücü yazılı/);
    // Gergiye yazılı 0,01 kW sürtünmenin kendisi — not ona düşmez.
    expect(R.limits.join(' ')).not.toMatch(/Otomatik Gergi[^.]*gücü yazılı/);
  });
});

// ═══════════════════════════════════════════════════════════════ EŞİK ══
describe('EŞİK — ankraj eşiğe inince yük taşıyanların en küçük SF\'si tam 1', () => {
  ['AG00976_GATES_2025', 'BMC_FEAD_2026'].forEach((anahtar) => {
    test(anahtar + ': eşik ↔ SF = 1 (tasarım yükünde)', () => {
      const { R, build, sv } = coz(anahtar);
      const T = M.veFeadSlipThreshold(build, R.analysis.duty, R.servis.deger);
      expect(T.tensionN).toBeGreaterThan(0);
      build.sys.designTensionN = T.tensionN;
      const R2 = M.veFeadAnalyze(build, { rows: M.veFeadDutyRows(sv), cylinders: 6 });
      expect(yukluMin(R2)).toBeCloseTo(1, 9);
    });
  });
});

// ═══════════════════════════════════════════════ GATES KALİBRASYONU ══
// Köprünün hesabı Gates'in girdileriyle beslenir: raporun ivmesi, kayma
// sayfasındaki ataletler ve tepe güç grafiği (docs/gates-reports/kayma —
// sayısallaştırılmış, eksen etiketleri dışında gözle okuma yok). Karşılaştırma
// kasnak başına devir boyunca en küçük SF: model ⁄ Gates.
describe('GATES KALİBRASYONU — köprü, Gates\'in 11 raporunun kayma eğrilerini üretir', () => {
  const KAYMA = path.join(__dirname, '../../docs/gates-reports/kayma');
  const G = JSON.parse(fs.readFileSync(path.join(KAYMA, 'gates-girdi.json'), 'utf8'));
  const SAY = JSON.parse(fs.readFileSync(path.join(KAYMA, 'sayisal.json'), 'utf8'));
  // Kuşkulu veri (docs/gates-reports/kayma/README.md) — kapıya girmez.
  const kusku = (r, k) => (/^AG00902/.test(r) && /^(CRK|A_C|TEN)$/.test(k))
    || (r === 'AG00894_8PK1738HD' && /^(TM31|SD7H15|IDR1|IDR2)$/.test(k))
    || (r === 'AG00976_8PK1715HD' && /^(IDR1|IDR2|TEN)$/.test(k))
    || (/^AG00686/.test(r) && k === 'TEN') || (r === 'AG00879_8PK1392HD' && k === 'IDR');
  const tekil = (nok) => {
    const m = new Map();
    (nok || []).forEach(([r, v]) => { const k = Math.round(r); if (!m.has(k)) m.set(k, []); m.get(k).push(v); });
    return [...m.entries()].map(([r, vs]) => [r, vs.reduce((a, b) => a + b, 0) / vs.length]).sort((a, b) => a[0] - b[0]);
  };
  const ara = (n, r) => {
    if (!n.length || r < n[0][0] || r > n[n.length - 1][0]) return null;
    for (let i = 1; i < n.length; i++)
      if (n[i - 1][0] <= r && r <= n[i][0]) return n[i - 1][1] + (n[i][1] - n[i - 1][1]) * (r - n[i - 1][0]) / Math.max(1e-9, n[i][0] - n[i - 1][0]);
    return null;
  };
  function olc(onayar) {
    const out = [];
    Object.entries(G).forEach(([ad, g]) => {
      if (ad[0] === '_' || /Takas/.test(ad)) return;
      const k0 = kur(g.ornek, (sd) => { sd.accelRpmS = g.A; sd.decelRpmS = g.A; sd.surtunme = onayar; });
      const anahtar = k0.build.order.map((o) => String(o.id).replace(/^ex-/, ''));
      if (g.J) anahtar.forEach((k, i) => { if (g.J[k] != null) k0.build.order[i].data.inertia = g.J[k]; });
      const sf = SAY[ad].sf, pp = SAY[ad].pp;
      if (g.pp && pp && pp.egriler) g.pp.forEach((k, j) => {
        const e = pp.egriler[j], i = anahtar.indexOf(k);
        if (!e || i < 0 || !(componentDefs[k0.build.order[i].type] || {}).isFeadAccessory) return;
        const oran = F.speedRatio(k0.build.sys, i);
        const nok = tekil(e.nokta).filter(([r]) => r <= sf.xmax + 1);
        if (!nok.length || Math.max(...nok.map((a) => a[1])) <= 0.5) return;
        k0.build.order[i].data.pwrCurve = nok.map(([r, v]) => ({ rpm: r * oran,
          kw: g.birim === 'Nm' ? v * r * oran * 2 * Math.PI / 60 / 1000 : v }));
      });
      const build = M.veFeadBuildSystem(k0.ns);
      const K = M.veFeadKaymaBaglam(build, {}, M.veFeadSurtunme(k0.sv.data));
      const gc = anahtar.map((k, i) => tekil(sf.egriler[i] && sf.egriler[i].nokta));
      const rmin = Math.ceil(Math.min(...gc.map((n) => (n.length ? n[0][0] : 1e9))) / 25) * 25;
      const rmax = Math.floor(Math.max(...gc.map((n) => (n.length ? n[n.length - 1][0] : 0))) / 25) * 25;
      const iz = []; for (let r = rmin; r <= rmax; r += 50) iz.push(r);
      const sat = iz.map((r) => M.veFeadKaymaDevir(build, K, r, 1).slip);
      anahtar.forEach((k, i) => {
        const gv = iz.map((r) => ara(gc[i], r));
        const ok = gv.map((v) => v > 0);
        if (!ok.some(Boolean)) return;
        const gm = Math.min(...gv.filter((v, a) => ok[a]));
        const mm = Math.min(...sat.filter((_, a) => ok[a]).map((s) => s[i].SF));
        out.push({ ad, k, oluk: K.oluk[i], kusku: kusku(ad, k), oran: mm / gm });
      });
    });
    return out;
  }
  let GATES = null, LIT = null;
  beforeAll(() => { GATES = olc('gates'); LIT = olc('literatur'); });
  const aralik = (L, f) => L.filter((x) => !x.kusku && f(x)).map((x) => x.oran);

  test('45 kasnak, 29\'u kuşkusuz — veri kapıya gerçekten giriyor', () => {
    expect(GATES.length).toBe(45);
    expect(GATES.filter((x) => !x.kusku).length).toBe(29);
  });

  test('oluklu kasnaklar (alternatör dâhil) Gates\'in ×0,85–1,20 içinde', () => {
    const v = aralik(GATES, (x) => x.oluk && !(x.ad === 'AG00902_8PK1275HD' || x.ad === 'AG00902_8PK1300HD'));
    expect(v.length).toBe(18);
    expect(Math.min(...v)).toBeGreaterThan(0.85);
    expect(Math.max(...v)).toBeLessThan(1.20);
  });

  test('sırt kasnakları Gates\'in ×0,70–1,05 içinde — AG00902 avarası HARİÇ ve sebebiyle', () => {
    const v = aralik(GATES, (x) => !x.oluk && !/^AG00902/.test(x.ad));
    expect(v.length).toBe(9);
    expect(Math.min(...v)).toBeGreaterThan(0.70);
    expect(Math.max(...v)).toBeLessThan(1.05);
    // AG00902: çevrim IDR'ye 0,8–4 kW yazıyor; ürün o yükü katıyor, Gates'in
    // kayma analizi katmıyor (ROL testine bak) — iki mertebe ayrışma bilinçli.
    aralik(GATES, (x) => !x.oluk && /^AG00902/.test(x.ad)).forEach((o) => expect(o).toBeLessThan(0.05));
  });

  test('LİTERATÜR seçeneği: küçük kasnak kaybı olmadan alternatörde ×1,4\'ten İYİMSER', () => {
    // Seçeneğin bilinen sınırı — rapor bunu yazar (`_frSurtunmeKokeni`).
    const alt = aralik(LIT, (x) => x.k === 'ALT');
    expect(alt.length).toBe(3);
    alt.forEach((o) => expect(o).toBeGreaterThan(1.4));
    const altG = aralik(GATES, (x) => x.k === 'ALT');
    altG.forEach((o) => expect(o).toBeLessThan(1.2));
  });
});

// ═══════════════════════════════════════════════════════════ SÜRTÜNME ══
describe('SÜRTÜNME SEÇİMİ — üç seçenek, varsayılan Gates, tek yazıcı', () => {
  test('seçenekler ve varsayılan', () => {
    expect(M.VE_FEAD_SURTUNME.secenek.map((o) => o.k)).toEqual(['gates', 'literatur', 'elle']);
    expect(M.veFeadSurtunme({})).toMatchObject({ anahtar: 'gates', muOluk: 0.92, muSirt: 0.60, kayipMm: 7, secildi: false });
    expect(M.veFeadSurtunme({ surtunme: 'gates' }).secildi).toBe(true);
  });

  test('LİTERATÜR çekirdeğin kalibrasyonudur — ikinci bir kopya yok', () => {
    const L = M.veFeadSurtunme({ surtunme: 'literatur' });
    expect(L.muOluk).toBe(F.CALIBRATION.muEffGrooved.value);
    expect(L.muSirt).toBe(F.CALIBRATION.muBackside.value);
    expect(L.kayipMm).toBe(0);
  });

  test('ELLE seçilince alanlar o an geçerli değerlerle tohumlanır; ön ayar alanları SİLER', () => {
    const sd = { surtunme: 'literatur' };
    expect(M.veFeadSurtunmeSet(sd, 'elle')).toBe(true);
    expect(sd).toMatchObject({ surtunme: 'elle', muOluk: 0.90, muSirt: 0.35, kucukKasnakMm: 0 });
    expect(M.veFeadSurtunmeSet(sd, 'elle', { muSirt: '0,5' })).toBe(true);
    expect(M.veFeadSurtunme(sd).muSirt).toBe(0.5);
    expect(M.veFeadSurtunmeSet(sd, 'gates')).toBe(true);
    expect(sd).toEqual({ surtunme: 'gates' });
  });

  test('aralık dışı elle değer YAZILMAZ ve false döner (sessizce kırpılmaz)', () => {
    const sd = {};
    M.veFeadSurtunmeSet(sd, 'elle');
    expect(M.veFeadSurtunmeSet(sd, 'elle', { muOluk: 5 })).toBe(false);
    expect(M.veFeadSurtunmeSet(sd, 'elle', { kucukKasnakMm: -1 })).toBe(false);
    expect(M.veFeadSurtunmeSet(sd, 'elle', { muOluk: 'abc' })).toBe(false);
    expect(sd).toMatchObject({ muOluk: 0.92, kucukKasnakMm: 7 });
    expect(M.veFeadSurtunmeSet(sd, 'yok')).toBe(false);
  });

  test('tanınmayan seçim ve eksik elle alan SÖYLENİR', () => {
    expect(M.veFeadSurtunme({ surtunme: 'xyz' }).uyari).toMatch(/Tanınmayan sürtünme seçimi/);
    const e = M.veFeadSurtunme({ surtunme: 'elle', muOluk: 0.8 });
    expect(e).toMatchObject({ muOluk: 0.8, muSirt: 0.60, kayipMm: 7 });
    expect(e.uyari).toMatch(/sırt μ, küçük kasnak kaybı girilmedi/);
  });

  test('ÇÖZÜM seçimi DONDURUR ve seçim sonucu gerçekten değiştirir', () => {
    const a = coz('AG00810_GATES_2021', (sd) => { sd.accelRpmS = 1000; sd.decelRpmS = 1000; });
    const b = coz('AG00810_GATES_2021', (sd) => { sd.accelRpmS = 1000; sd.decelRpmS = 1000; sd.surtunme = 'literatur'; });
    expect(a.R.surtunme.anahtar).toBe('gates');
    expect(b.R.surtunme.anahtar).toBe('literatur');
    M.veFeadSurtunmeSet(a.sv.data, 'literatur');
    expect(a.R.surtunme.anahtar).toBe('gates');
    // Alternatör Literatür'de daha İYİMSER (kayıp yok), sırt daha temkinli.
    const s = (R, re) => Math.min(...R.analysis.duty.map((d) => d.slip.find((x) => re.test(x.name)).SF));
    expect(s(b.R, /Alternat/)).toBeGreaterThan(s(a.R, /Alternat/) * 1.3);
    expect(s(b.R, /^Avara/)).toBeLessThan(s(a.R, /^Avara/));
  });

  test('KÜÇÜK KASNAK KAYBI yalnız oluklu temasta: φ_etkin = φ − 2ℓ/r', () => {
    const { build } = kur('AG00810_GATES_2021');
    const g = F.tensionerState(build.sys, F.meanRel(build.sys)).geom;
    const K = M.veFeadKaymaBaglam(build, {}, M.veFeadSurtunme({}));
    let oluk = 0, sirt = 0;
    build.sys.pulleys.forEach((p, i) => {
      if (g.pulleys[i].contact === 'grooved') {
        expect(K.phiEt[i]).toBeCloseTo(g.wraps[i] - 2 * 7 / p.rPitch, 12);
        expect(K.kap[i]).toBeCloseTo(Math.exp(0.92 * K.phiEt[i]), 12);
        oluk++;
      } else {
        expect(K.phiEt[i]).toBe(g.wraps[i]);
        expect(K.kap[i]).toBeCloseTo(Math.exp(0.60 * g.wraps[i]), 12);
        sirt++;
      }
    });
    expect(oluk).toBe(2); expect(sirt).toBe(2);
  });

  test('sınanmamış çaptaki oluklu kasnak sonuçta YAZILI — sınanmış çapta sessiz', () => {
    // On iki örneğin oluklu kasnakları sınanan aralıkların İÇİNDE (aralıklar
    // onlardan geliyor): not orada çıkmaz. Ø90'lık bir alternatör çıkarır.
    expect(coz('BMC_FEAD_2026').R.limits.join(' ')).not.toMatch(/Küçük kasnak kaybı/);
    const buyut = (sd, ns) => { ns.find((n) => /ALT$/.test(n.id)).data.od = 88; };
    const { R } = coz('BMC_FEAD_2026', buyut);
    expect(R.limits.join(' ')).toMatch(/Küçük kasnak kaybı \(7 mm\) Gates'e karşı yalnız Ø57–62 ve Ø120–179 oluklu kasnaklarda sınandı; Alternatör \(Ø90/);
    const L = coz('BMC_FEAD_2026', (sd, ns) => { buyut(sd, ns); sd.surtunme = 'literatur'; }).R;
    expect(L.limits.join(' ')).not.toMatch(/Küçük kasnak kaybı/);
  });
});

// ═══════════════════════════════════════════════════════════ YÜZEYLER ══
describe('YÜZEYLER — kayış penceresi ve sihirbaz aynı seçiciyi basar', () => {
  const kurBMC = () => {
    const pack = M.veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((x) => { x.def = componentDefs[x.type]; });
    global.nodes = pack.nodes;
    global.connections = pack.connections;
    return pack.nodes;
  };
  const dugme = (h) => (h.match(/class="ve-fead-mu-b"/g) || []).length;

  test('kayışın Tasarım sekmesinde seçici var; üç düğme, yazıcısı depoya', () => {
    const ns = kurBMC();
    const depo = M.veFeadIsletmeDeposu(ns);
    const h = fead.getFeadBeltPropertiesHTML(ns.find((n) => n.type === 'fead-belt'));
    expect(h).toContain('data-ve="surtunme"');
    expect(dugme(h)).toBe(3);
    expect(h).toContain("veFeadSurtunmeSec('" + depo.id + "','literatur')");
  });

  test('sihirbazın Kayış adımında AYNI seçici; yazıcısı sihirbazın durumuna', () => {
    kabuk(); wiz.veFeadWizReset(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const h = wiz._fwStepKayis(null);
    expect(h).toContain('data-ve="surtunme"');
    expect(dugme(h)).toBe(3);
    expect(h).toContain("veFeadWizSurtunmeSec('elle')");
  });

  test('iki yüzeyin seçicisi yazıcısı dışında BİREBİR (tek üretici)', () => {
    const ns = kurBMC();
    const depo = M.veFeadIsletmeDeposu(ns);
    const X = (k, a) => 'X(\'' + k + '\'' + (a ? ',\'' + a + '\'' : '') + ')';
    const pencere = fead.veFeadSurtunmeHTML(depo.data, X);
    kabuk(); wiz.veFeadWizReset(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    expect(fead.veFeadSurtunmeHTML(wiz.veFeadWizState().solver, X)).toBe(pencere);
  });

  test('ön ayarda alanlar salt okunur; ELLE\'de girilir ve makine biçimi taşır', () => {
    const on = fead.veFeadSurtunmeHTML({}, () => '');
    expect((on.match(/aria-pressed="true"/g) || []).length).toBe(1);
    expect(on).toMatch(/data-ve-mu="gates" aria-pressed="true"/);
    expect((on.match(/readonly/g) || []).length).toBe(3);
    expect(on).toContain('Gates kalibrasyonu</b> · varsayılan');
    const el = fead.veFeadSurtunmeHTML({ surtunme: 'elle', muOluk: 0.85, muSirt: 0.5, kucukKasnakMm: 6 },
      (k, a) => 'Y(\'' + k + '\'' + (a ? ',\'' + a + '\',this.value' : '') + ')');
    expect(el).not.toMatch(/readonly/);
    expect(el).toMatch(/inputmode="decimal" data-ve-mu-alan="muOluk" value="0\.85"/);
    expect(el).toContain("Y('elle','kucukKasnakMm',this.value)");
  });

  test('pencerenin yazıcısı depoya yazar, aralık dışını söyler ve geri-al adımı açar', () => {
    const ns = kurBMC();
    const depo = M.veFeadIsletmeDeposu(ns);
    fead.veFeadSurtunmeSec(depo.id, 'elle');
    expect(depo.data.surtunme).toBe('elle');
    fead.veFeadSurtunmeSec(depo.id, 'elle', 'muOluk', '0,8');
    expect(depo.data.muOluk).toBe(0.8);
    expect(stubs.saveState).toHaveBeenCalled();
    fead.veFeadSurtunmeSec(depo.id, 'elle', 'muOluk', '9');
    expect(depo.data.muOluk).toBe(0.8);
    expect(stubs.showToast).toHaveBeenCalledWith(expect.stringMatching(/Değer yazılmadı/), 'warning');
    fead.veFeadSurtunmeSec(depo.id, 'gates');
    expect(depo.data.muOluk).toBeUndefined();
  });

  test('GİDİŞ-DÖNÜŞ: sihirbazda seçilen sürtünme kurulan modelin deposuna taşınır', () => {
    kabuk(); wiz.veFeadWizReset(); wiz.veFeadWizSeed('AG00879_GATES_2023');
    wiz.veFeadWizSurtunmeSec('elle');
    wiz.veFeadWizSurtunmeSec('elle', 'kucukKasnakMm', '5');
    const depo = M.veFeadIsletmeDeposu(wiz.veFeadWizNodes(wiz.veFeadWizState()).nodes);
    expect(M.veFeadSurtunme(depo.data)).toMatchObject({ anahtar: 'elle', muOluk: 0.92, muSirt: 0.60, kayipMm: 5 });
    wiz.veFeadWizSurtunmeSec('literatur');
    const d2 = M.veFeadIsletmeDeposu(wiz.veFeadWizNodes(wiz.veFeadWizState()).nodes);
    expect(d2.data).toMatchObject({ surtunme: 'literatur' });
    expect(d2.data.muOluk).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════ ÖRNEKLERİN İVMESİ ══
// Kayma koşulu ivmeyi okur; ivmesiz örnek atalet talebini hiç görmez.
// Kural 19: kaynak söylüyorsa sayı örneğe gelir — ve SÖYLEDİĞİ sayı olmak
// zorunda. On bir Gates raporunun on biri s1'de "Accel. RPM/s" yazıyor.
describe('ÖRNEKLER raporun ivmesini taşır (kural 19)', () => {
  test('her Gates örneğinin ivme ve yavaşlaması kendi PDF\'inin "Accel. RPM/s" değeri', () => {
    const { gatesPdfText, numberAfter } = require('../helpers/gates-pdf.js');
    const DIR = path.join(__dirname, '../../docs/gates-reports/pdf');
    const pdfler = fs.readdirSync(DIR).filter((f) => f.endsWith('.pdf'));
    const bad = [];
    let n = 0;
    Object.keys(M.VE_FEAD_EXAMPLES).filter((k) => /_GATES_/.test(k)).forEach((key) => {
      const ex = M.VE_FEAD_EXAMPLES[key];
      const pdf = pdfler.find((f) => f.startsWith(key.split('_')[0] + '_' + ex.belt.beltType + '_'));
      if (!pdf) { bad.push(key + ': PDF arşivde yok'); return; }
      const a = numberAfter(gatesPdfText(path.join(DIR, pdf)), 'Accel.');
      if (!(a > 0)) { bad.push(key + ': raporda ivme okunamadı'); return; }
      if (ex.solver.accelRpmS !== a || ex.solver.decelRpmS !== a)
        bad.push(key + ': örnek ' + ex.solver.accelRpmS + '/' + ex.solver.decelRpmS + ' · rapor ' + a);
      n++;
    });
    expect(bad).toEqual([]);
    expect(n).toBe(11);
  });
});
