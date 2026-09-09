/**
 * fead-spin-flip.test.js — TEMAS TARAFI ÇEVRİLİNCE NE DEĞİŞİR, NE DEĞİŞMEZ
 *
 * Kullanıcı sorusu (2026-09-09), iki ekran görüntüsüyle: *"Kasnak dönüş
 * yönlerini değiştirdiğimde kayış yolları ve uzunlukları değişiyor doğal
 * olarak. Ama bu programımızda böyle mi? … Özellikle spanlardaki gerilmeler
 * doğru mu? İki resimde de bu spanlardaki gerginlik aynı görünüyor."*
 *
 * Gözlem DOĞRU ve cevabı fizikte: gerilme zinciri ΔT = P/v ile yürüyor ve
 * SARIM AÇISI O DENKLEMDE YOK. Krank kaburgalı kaldığı için kayış hızı da
 * aynı → zincirin BÜTÜN basamakları birebir aynı kalıyor, yalnız ANKRAJ
 * (gerginin yay dengesi) kayıyor. Sarımın etkisi gerilmede değil KAYMA
 * EMNİYETİNDE ve HUBLOAD'da görünüyor. Bu dosya üçünü birden çiviliyor:
 * neyin değişmesi, neyin değişmemesi, neyin oranla kayması gerektiğini.
 *
 * ── ÇIPA GERÇEK BİR MODEL ───────────────────────────────────────────────────
 * Aşağıdaki iki yapılandırma kullanıcının ekran görüntülerinin BİREBİR
 * kendisidir (Kayış Tablosu'ndan okunan koordinat/çap/temas ile kuruldu ve
 * çekirdek sarım/span/boy sütunlarının tamamını 3 haneye kadar geri veriyor).
 * Uydurulmuş bir kurulum bu turun bulgusunu tekrar üretemezdi.
 *
 * ── DÜZELTİLEN KUSUR ────────────────────────────────────────────────────────
 * Boy özdeşliği \( L_{pitch}-L_{eff} = h_b\sum d_i\varphi_i \) İŞARET TAŞIR;
 * rapor onu sabit \( +2\pi h_b \) ile karşılaştırıyordu. Kaburgalı yüzü
 * ağırlıklı dışa bakan güzergâhta (Σişaretli = −360°) aynı çözülmüş model
 * Kayış Tablosu'nda ve uygunluk kriteri 1'de "✓", ayrıntılı raporun §8.6'sında
 * "✗ tutmuyor" basıyordu — bir programın üç yüzeyi, iki ayrı hüküm.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const TEN = require('../../js/fead-tensioners.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.FEADCore = F;
Object.keys(TEN).forEach((k) => { global[k] = TEN[k]; });
Object.keys(M).forEach((k) => { global[k] = M[k]; });
const fead = require('../../js/cp-fead.js');
Object.keys(fead).forEach((k) => { global[k] = fead[k]; });
const RP = require('../../js/cp-fead-report.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

/* Kayış Tablosu'ndan okunan model. Kol açısı −12,05° tasarım gerginliğini
   1. yapılandırmada 514,0 N veriyor — ekrandaki sayının ta kendisi. */
const ARM = -12.05;
const P = [
  ['FAN',  'fead-fan',        'Sürücü Kasnak (FAN)', 176,    0,     0    ],
  ['IDR1', 'fead-idler',      'Avara 1',              75,  130.1, 139.9  ],
  ['A_C',  'fead-ac',         'Klima Kompresörü',    152,  184.2, 314.5  ],
  ['IDR2', 'fead-idler',      'Avara 2',              75,    0,   267.4  ],
  ['ALT',  'fead-alternator', 'Alternatör (155 A)',   57, -281,   259.5  ],
];
const KW = { 'Avara 1': 0.01, 'Klima Kompresörü': 2.70, 'Avara 2': 0.01,
             'Alternatör (155 A)': 3.61, 'Otomatik Gergi (E9843)': 0.01 };

/** Kaburgalı yüz KRANKTA + üç aksesuarda (ekran görüntüsü 1). */
const A = ['grooved', 'back', 'grooved', 'back', 'grooved', 'back'];
/** Klima ve alternatör SIRTA çevrildi (ekran görüntüsü 2). */
const B = ['grooved', 'back', 'back',    'back', 'back',    'back'];

let seq = 0;
function kur(contacts, ters) {
  const key = 'SPIN' + (seq++);
  M.VE_FEAD_EXAMPLES[key] = {
    name: 'x', note: '',
    belt: { profile: 'PK', brand: 'GATES', ribs: 8, tolerance: 0, wearPct: 0 },
    solver: { ratioMode: 'unity', cylinders: 6, serviceFact: 1.3, lengthOffsetMm: 0,
              accelRpmS: 1000, decelRpmS: 1000,
              duty: [{ rpm: 880, dcPct: 25, degC: 90,
                       kwByKey: { IDR1: 0.01, A_C: 2.70, IDR2: 0.01, ALT: 3.61, TEN: 0.01 } }] },
    pulleys: P.map((p, i) => ({
      key: p[0], type: p[1], name: p[2],
      data: { od: p[3], x: p[4], y: p[5], contact: contacts[i], driver: i === 0 },
    })).concat([{
      key: 'TEN', type: 'fead-tensioner', name: 'Otomatik Gergi (E9843)',
      data: { od: 75, contact: contacts[5], cenX: -161.97, cenY: 91.29,
              armLen: 90, armMeanDeg: ARM, preload: 8.60, kArm: 0.480, meanLoad: 22.07 },
    }]),
    route: ters ? ['FAN', 'TEN', 'ALT', 'IDR2', 'A_C', 'IDR1']
                : ['FAN', 'IDR1', 'A_C', 'IDR2', 'ALT', 'TEN'],
  };
  const pack = veFeadExampleNodes(key);
  pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
  global.nodes = pack.nodes; global.connections = [];
  const build = veFeadBuildSystem(pack.nodes);
  const geom = F.tensionerState(build.sys, F.meanRel(build.sys)).geom;
  const t = F.spanTensions(build.sys, { engineRpm: 880, loadsKw: KW });
  return { pack, build, geom, t,
           st: F.tensionerState(build.sys, F.meanRel(build.sys)),
           sf: F.slipSafety(geom, t.spanN),
           hub: F.hubloads(geom, t.spanN) };
}

/* ══════════════ ① EKRAN GÖRÜNTÜSÜNÜN BİREBİR ÇIPASI ════════════════════ */

describe('iki ekran görüntüsü birebir geri üretiliyor', () => {
  // Ekrandaki Kayış Tablosu'nun sarım / span sütunları.
  const EKRAN = {
    A: { wrap: [161.894, 55.591, 198.391, 64.317, 157.092, 37.470],
         span: [142.004, 141.430, 150.793, 272.688, 194.417, 135.038],
         pitch: [178.400, 77.200, 154.400, 77.200, 59.400, 77.200],
         spin: ['Sağ', 'Sol', 'Sağ', 'Sol', 'Sağ', 'Sol'],
         Lpitch: 1743.2, Leff: 1735.6, sigma: 360 },
    B: { wrap: [161.894, 4.122, 262.283, 2.885, 231.988, 20.617],
         span: [142.004, 178.689, 186.188, 280.967, 205.868, 135.038],
         pitch: [178.400, 77.200, 154.200, 77.200, 59.200, 77.200],
         spin: ['Sağ', 'Sol', 'Sol', 'Sol', 'Sol', 'Sol'],
         Lpitch: 1872.2, Leff: 1879.7, sigma: -360 },
  };
  [['A', A], ['B', B]].forEach(([ad, c]) => {
    test(ad + ' — sarım · span · pitch çapı · dönüş yönü · boy', () => {
      const { build, geom } = kur(c);
      const e = EKRAN[ad];
      const T = veFeadTableRows(build);
      geom.names.forEach((_, i) => {
        expect(geom.wrapDeg(i)).toBeCloseTo(e.wrap[i], 3);
        expect(geom.exitSpanLen(i)).toBeCloseTo(e.span[i], 3);
        expect(geom.pulleys[i].rPitch * 2).toBeCloseTo(e.pitch[i], 3);
        // "Kasnak Dönüş Yönü" hücresi çekirdeğin süpürme işareti `d`
        expect(T.rows[i].spin).toBe(e.spin[i]);
      });
      expect(geom.LpitchMm).toBeCloseTo(e.Lpitch, 1);
      expect(geom.LeffMm).toBeCloseTo(e.Leff, 1);
      expect(geom.signedWrapDeg).toBeCloseTo(e.sigma, 2);
    });
  });
});

/* ══════════════ ② YOL GERÇEKTEN DEĞİŞİYOR ══════════════════════════════ */

describe('temas tarafı çevrilince GEOMETRİ değişiyor', () => {
  test('sarım · span · kayış boyu hepsi kayıyor', () => {
    const a = kur(A), b = kur(B);
    expect(b.geom.LeffMm - a.geom.LeffMm).toBeCloseTo(144.1, 0);   // +144 mm
    // Avara sarımı 55,6° → 4,1°: kayış artık kasnağı yalayıp geçiyor
    expect(a.geom.wrapDeg(1)).toBeGreaterThan(50);
    expect(b.geom.wrapDeg(1)).toBeLessThan(6);
    // Klima ve alternatör sırta geçince pitch çapı 2h_b yerine 2h_r alıyor
    expect(a.geom.pulleys[2].rPitch - b.geom.pulleys[2].rPitch).toBeCloseTo(0.1, 6);
  });

  // İKİ YOL DA GEOMETRİK OLARAK GEÇERLİ: hiçbir span bir kasnağı kesmiyor ve
  // kayış kendi içinden geçmiyor. Bu bir hüküm değil ÖLÇÜM — "−360 çıktı,
  // demek ki yol bozuk" demek yanlış olurdu.
  test('iki yol da geçerli: kasnak kesilmiyor, kayış kendini kesmiyor', () => {
    const kesisim = (g) => {
      const n = g.spans.length, out = [];
      const x = (p1, p2, p3, p4) => {
        const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
        if (Math.abs(d) < 1e-12) return false;
        const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
        const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
        return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
      };
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        if (j === i + 1 || (i === 0 && j === n - 1)) continue;
        if (x(g.spans[i].Pi, g.spans[i].Pj, g.spans[j].Pi, g.spans[j].Pj))
          out.push(g.names[i] + '×' + g.names[j]);
      }
      return out;
    };
    [kur(A), kur(B)].forEach(({ geom, build }) => {
      expect(F.checkClearance(geom)).toEqual([]);
      expect(kesisim(geom)).toEqual([]);
      expect(build.errors).toEqual([]);
      expect((geom.violations || [])).toEqual([]);
    });
  });
});

/* ══════════════ ②b SIRA ÇEVRİLİNCE: AYNI KAYIŞ, TERS GİDİŞ ═════════════ */

// `d = grooved ? s : -s` — `s` merkez çokgeninin yönü. Satır sırasını çevirmek
// `s`i çeviriyor, dolayısıyla HER kasnağın süpürme işareti de çevriliyor: aynı
// kapalı eğri, ters yönde dolaşılıyor. Geometri BİREBİR aynı kalmak zorunda.
//
// BU BLOK OLMADAN `s` çarpanı ÖLÇÜLEMİYOR: yukarıdaki iki yapılandırmada da
// s = +1 olduğu için `d`den `s`i düşüren bir mutasyon SESSİZCE geçiyordu
// (mutasyonla ölçüldü).
describe('satır sırası çevrilince geometri BİREBİR aynı', () => {
  test('loopSense çevriliyor, sarım/span/boy değişmiyor', () => {
    const d = kur(A), r = kur(A, true);
    expect(d.geom.sense).toBe(1);
    expect(r.geom.sense).toBe(-1);
    // Sarımlar: ters sırada aynı kasnak aynı sarımı görüyor
    const ad = (g) => g.names.map((nm, i) => [nm, +g.wrapDeg(i).toFixed(6)]);
    const m1 = new Map(ad(d.geom)), m2 = new Map(ad(r.geom));
    m1.forEach((v, k) => expect(m2.get(k)).toBeCloseTo(v, 6));
    expect(r.geom.LeffMm).toBeCloseTo(d.geom.LeffMm, 6);
    expect(r.geom.LpitchMm).toBeCloseTo(d.geom.LpitchMm, 6);
    // İşaretli toplam TEMAS TARAFINDAN gelir, gidiş yönünden DEĞİL
    expect(r.geom.signedWrapDeg).toBeCloseTo(d.geom.signedWrapDeg, 6);
    // ama kayışın gerçek dönüşü Σ(d·φ) çevriliyor
    const dsum = (g) => g.pulleys.reduce((a2, p, i) => a2 + p.d * g.wraps[i], 0) * 180 / Math.PI;
    expect(dsum(d.geom)).toBeCloseTo(+360, 3);
    expect(dsum(r.geom)).toBeCloseTo(-360, 3);
  });
});

/* ══════════════ ③ GERİLME ZİNCİRİ — NE DEĞİŞMEZ ════════════════════════ */

describe('span gerginlikleri: basamaklar SABİT, ankraj KAYAR', () => {
  // Kullanıcının gözlemi bu: iki resimde gerginlik deseni aynı görünüyor.
  // Doğru ve sebebi ΔT = P/v — sarım açısı bu denklemde YOK.
  test('ΔT basamakları BİREBİR aynı (sarımdan bağımsız)', () => {
    const a = kur(A), b = kur(B);
    expect(b.t.vMs).toBeCloseTo(a.t.vMs, 12);          // krank kaburgalı kaldı
    const adim = (r) => r.t.perPulley.map((p) => p.exitTensionN - p.entryTensionN);
    const da = adim(a), db = adim(b);
    da.forEach((v, i) => expect(db[i]).toBeCloseTo(v, 9));
    // ve basamaklar gerçekten P/v
    a.t.perPulley.forEach((p, i) => {
      const isaret = (p.name === 'Sürücü Kasnak (FAN)') ? +1 : -1;
      expect(da[i]).toBeCloseTo(isaret * p.powerKw * 1000 / a.t.vMs, 6);
    });
  });

  test('bütün zincir ANKRAJIN kaydığı kadar kayıyor', () => {
    const a = kur(A), b = kur(B);
    const kayma = b.build.springTensionN - a.build.springTensionN;
    expect(kayma).toBeCloseTo(562.5, 0);
    a.t.spanN.forEach((v, i) => expect(b.t.spanN[i] - v).toBeCloseTo(kayma, 6));
    // Ankraj GERGİNİN SARIMINDAN geliyor: 37,5° → 20,6° take-up'ı yarıya
    // indiriyor, T = M/(dL/dθ) da iki katına çıkıyor.
    expect(a.st.wrapDeg).toBeCloseTo(37.470, 2);
    expect(b.st.wrapDeg).toBeCloseTo(20.617, 2);
    expect(a.st.takeupMmPerDeg / b.st.takeupMmPerDeg)
      .toBeCloseTo(b.build.springTensionN / a.build.springTensionN, 6);
  });

  test('gergi HÂLÂ boş tarafta, krank çıkışı HÂLÂ en gergin', () => {
    [kur(A), kur(B)].forEach(({ t, build }) => {
      const ten = t.perPulley.find((p) => /Gergi/.test(p.name));
      expect(ten.exitTensionN).toBeCloseTo(Math.min.apply(null, t.spanN), 9);
      expect(ten.exitTensionN).toBeCloseTo(build.springTensionN, 6);
      const crk = t.perPulley.find((p) => /Sürücü/.test(p.name));
      expect(crk.exitTensionN).toBeCloseTo(Math.max.apply(null, t.spanN), 9);
      expect(Math.min.apply(null, t.spanN)).toBeGreaterThan(0);
    });
  });
});

/* ══════════════ ④ SARIMIN ETKİSİ NEREDE GÖRÜNÜYOR ══════════════════════ */

describe('sarım gerginlikte değil, KAPASİTEDE ve HUBLOAD\'da', () => {
  test('kayma emniyeti sarımla çöküyor', () => {
    const a = kur(A), b = kur(B);
    const sf = (r, i) => r.sf[i].SF;
    expect(sf(a, 1)).toBeCloseTo(1.40, 1);      // Avara 1 · sarım 55,6°
    expect(sf(b, 1)).toBeCloseTo(1.02, 1);      //          · sarım  4,1°
    expect(sf(a, 3)).toBeGreaterThan(1.3);
    expect(sf(b, 3)).toBeLessThan(1.1);         // Avara 2 · sarım 2,9°
    // capstan: SF = kapasite / oran, kapasite = e^(μφ) → φ küçüldükçe 1'e iner
    b.sf.forEach((x, i) => {
      const n = b.geom.spans.length;
      const Tin = b.t.spanN[(i - 1 + n) % n], Tout = b.t.spanN[i];
      const oran = Math.max(Tin, Tout) / Math.min(Tin, Tout);
      expect(x.tensionRatio).toBeCloseTo(oran, 9);
      expect(x.SF).toBeCloseTo(x.capstanCapacity / oran, 9);
    });
    // Kapasite YALNIZ sarıma ve temas tarafının sürtünmesine bağlı:
    // ln(kapasite)/φ aynı temas tarafındaki bütün kasnaklarda AYNI sayı.
    [a, b].forEach((r) => {
      const mu = {};
      r.sf.forEach((x, i) => {
        const c = r.geom.pulleys[i].contact;
        const m = Math.log(x.capstanCapacity) / r.geom.wraps[i];
        if (mu[c] == null) mu[c] = m; else expect(m).toBeCloseTo(mu[c], 9);
      });
      expect(mu.grooved).toBeGreaterThan(mu.back);   // kanal sürtünmeyi büyütür
    });
  });

  test('hubload sarımla değişiyor (gerginlik sabitken bile)', () => {
    const a = kur(A), b = kur(B);
    expect(a.hub[1].FN).toBeCloseTo(1198, -1);   // Avara 1 · 55,6°
    expect(b.hub[1].FN).toBeCloseTo(133, -1);    //          ·  4,1°
    expect(a.hub[0].FN).toBeLessThan(b.hub[0].FN);
  });
});

/* ══════════════ ⑤ BOY ÖZDEŞLİĞİ İŞARET TAŞIR ═══════════════════════════ */

describe('L_pitch − L_eff = h_b·Σ(d·φ) — işaretli', () => {
  test('değişmez ±360 ve fark onunla ölçekli', () => {
    [kur(A), kur(B)].forEach(({ geom }) => {
      expect(Math.abs(Math.abs(geom.signedWrapDeg) - 360)).toBeLessThan(0.05);
      expect(geom.LpitchMm - geom.LeffMm)
        .toBeCloseTo(1.2 * geom.signedWrapDeg * Math.PI / 180, 6);
    });
    // ve iki yönün ikisi de gerçekten çıkıyor
    expect(kur(A).geom.signedWrapDeg).toBeGreaterThan(0);
    expect(kur(B).geom.signedWrapDeg).toBeLessThan(0);
  });

  // ASIL KAPI: üç yüzey AYNI hükmü vermeli. Sabit +2πh_b ile karşılaştıran
  // sürüm B'de rapora "✗ tutmuyor" bastırıyordu.
  test('Kayış Tablosu · uygunluk kriteri 1 · rapor §8.6 ÜÇÜ DE aynı hükümde', () => {
    [kur(A), kur(B)].forEach(({ pack, build, geom }) => {
      const solv = pack.nodes.find((n) => n.type === 'fead-solver');
      const R = veFeadAnalyze(build, { rows: veFeadDutyRows(solv) });
      R.build = build;
      const T = veFeadTableRows(build);
      const tabloOK = Math.abs(Math.abs(T.signedWrapDeg) - 360) <= 0.05;
      const rapor = String(RP._frGeometryTable(R));
      expect(tabloOK).toBe(true);
      expect(rapor).toMatch(/tutuyor/);
      expect(rapor).not.toMatch(/tutmuyor/);
      // beklenen değer artık işaretli sarımdan türüyor, sabit değil
      expect(rapor).toContain(_frBeklenen(geom));
    });
  });

  test('"360 olmalı" metni MUTLAK değeri söylüyor', () => {
    const { build } = kur(B);
    const node = { id: 'tbl', type: 'fead-layout', data: {} };
    const h = veFeadTableCardHTML
      ? String(veFeadTableCardHTML(node)) : '';
    if (h) {
      expect(h).toContain('|Σ| 360 olmalı');
      expect(h).not.toMatch(/°\s*\(360 olmalı\)/);
    }
    expect(build.ok).toBe(true);
  });
});

/* Raporun bastığı "beklenen" sayısı — testin kendi formülü, kopya değil. */
function _frBeklenen(geom) {
  const v = 1.2 * geom.signedWrapDeg * Math.PI / 180;
  return v.toFixed(4).replace('.', ',').replace('-', '−');
}
