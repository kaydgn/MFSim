/**
 * fead-ders-notu.test.js — "Kayış-Kasnak Mekanizmaları" ders notundan
 * (V. Temiz, İTÜ Makina Elemanları II) FEAD'e alınan dört bağıntının kapısı.
 *
 *   HİZALAMA      s.51  — pay kayışın kasnağa GİRDİĞİ açıklıkta (Gates s.4)
 *   KORD KUVVETİ  s.25–28, s.37 — T_etkin + m′v², hesaba girmez, gösterilir
 *   SÜRÜNME       s.34  — kasnak yüzeyi giriş açıklığının hızıyla döner
 *   c₂ GRUBU      s.65  — silindir sayısı sürücü grubunu ÖNERİR, seçmez
 *
 * Kayma emniyetinin kapasite tanımı (s.29, s.42) bu dosyada DEĞİL: kural 49
 * ile zaten geldi (fead-kayma-gates.test.js).
 */
const path = require('path');
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const rapor = require('../../js/cp-fead-report.js');
const ozet = require('../../js/cp-fead-summary.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const TR = require('../../js/fead-transient.js');
const { gatesPdfPages } = require('../helpers/gates-pdf.js');

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
[require('../../js/fead-duty.js'), require('../../js/fead-belts.js'),
 require('../../js/fead-tensioners.js'), require('../../js/fead-accessories.js'),
 require('../../js/fead-engines.js'), require('../../js/fead-checks.js')].forEach((lib) => {
  Object.keys(lib).forEach((k) => { global[k] = lib[k]; });
});
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
// Örnekler motorlu: Gates raporları motorun devir sınırlarını taşımıyor ve
// işletme hesabı onlarsız yapılmaz (tests/helpers/fead-motor.js).
require('../helpers/fead-motor').motorluOrnekler(M);
Object.keys(TR).forEach((k) => { global[k] = TR[k]; });
const B = require('../../js/fead-brief.js');
const S = require('../../js/fead-signals.js');
global.veFeadBrief = B;
global.veFeadSignals = S;
[fead, rapor, ozet, wiz].forEach((mod) => {
  Object.keys(mod).forEach((k) => { if (global[k] === undefined) global[k] = mod[k]; });
});
const RS = require('../../js/cp-fead-results.js');
Object.keys(RS).forEach((k) => { global[k] = RS[k]; });

beforeEach(() => {
  resetStubs(stubs);
  global.veFeadResults = null;
  window.veFeadResults = null;
});

function kur(key, bd) {
  const pack = M.veFeadExampleNodes(key || 'AG00976_GATES_2025');
  global.nodes = pack.nodes.map((n) => {
    const d = componentDefs[n.type] || {};
    return { id: n.id, type: n.type, customName: n.customName || null, def: d,
             x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60,
             data: JSON.parse(JSON.stringify(n.data || {})) };
  });
  if (bd) global.nodes.find((n) => n.type === 'fead-belt').data.beltDataMode = bd;
  return global.nodes;
}
function coz(key, bd) {
  kur(key, bd);
  const sv = global.nodes.find((n) => n.type === 'fead-solver');
  const R = fead.veFeadSolve(sv.id);
  global.veFeadResults = window.veFeadResults;
  return R;
}

// ════════════════════════════════════════════════════════════════════════════
//  HİZALAMA — pay kayışın kasnağa GİRDİĞİ açıklıkta
// ════════════════════════════════════════════════════════════════════════════
// Gates'in "Pulley Alignment Sensitivity" sayfası (tam raporların 4. sayfası,
// altı rapor) çiftleri KAYIŞIN GİDİŞ yönünde yazıyor: "A_C->CRK" = kayış
// A_C'den çıkıp aradaki düz kasnaktan geçerek CRK'ye GİRİYOR. Köprünün listesi
// gidişin TERSİ (kural 7) ve Sonuçlar sayfası çekirdeğe o listeyi veriyordu:
// "giriş açıklığı" fiziksel çıkış açıklığı, "önceki düz kasnak" fiziksel
// SONRAKİ kasnak oluyordu. Ölçülen (ψ = 0, sayfanın gösterdiği): AG0868'de
// CRK için 0,89–0,94 mm — Gates 4,11 mm diyor.
const RAPOR_HIZA = {
  AG00686_1475_GATES_2023: 'AG00686_8PK1475HD_T38624-24.6Nm_2023-09-07.pdf',
  AG00686_1520_GATES_2023: 'AG00686_8PK1520HD_T38624-22.2Nm_2023-09-07.pdf',
  AG00810_GATES_2021: 'AG00810_10PK1215HD_T38519-v8_2021-09-16.pdf',
  AG0868_4PK_GATES_2022: 'AG0868_4PK1013HD_E9843-16Nm_2022-12-27.pdf',
  AG0868_6PK_GATES_2022: 'AG0868_6PK1018HD_E9843-19Nm_2022-12-27.pdf',
  AG0868_8PK_GATES_2022: 'AG0868_8PK1020HD_E9843-22.5Nm_2022-12-27.pdf',
};
// Sayfanın okunuşu: çiftler, izinler (INCAPABLE = 0), düz kasnaklar ve ψ.
// Düz kasnak girmeyen çiftte "Grooved Pulley Axial Offset %" 100'dür; düz
// kasnaklar sırayla kalan çiftlere düşer (AG0868 8PK: ikinci çift INCAPABLE,
// yüzdesi basılmıyor).
function gatesHiza(dosya) {
  const P = gatesPdfPages(path.join(__dirname, '../../docs/gates-reports/pdf', dosya));
  const t = P.find((p) => p.includes('Alignment Data'))
    .replace(/\s*\n+\s*/g, ' ').replace(/\s*-\s*>\s*/g, '->');
  const ara = (a, b) => { const i = t.indexOf(a) + a.length; return t.slice(i, t.indexOf(b, i)).trim(); };
  const psi = {};
  const re = /(\w+) Angular Misalignment (\d+\.\d+)/g;
  const blok = ara('Alignment Data', 'RESULTS');
  let m;
  while ((m = re.exec(blok))) psi[m[1]] = Number(m[2]);
  const ciftler = ara('Adjacent Grooved Pulleys', 'Flat Pulley').split(' ').map((s) => s.split('->'));
  const duzler = ara('Flat Pulley Angular Misalignment °', 'Axial Offset').split(' ')
    .filter((s) => s && s[0] !== '(');
  const izin = ara('Axial Offset Allowance mm', 'Grooved Pulley').split(' ')
    .map((s) => (s === 'INCAPABLE' ? 0 : Number(s)));
  const oluklu = ara('Grooved Pulley Axial Offset %', 'Attributed to').split(' ').filter(Boolean).map(Number);
  let k = 0;
  return { psi, satir: ciftler.map(([nereden, nereye], i) => ({
    nereden, nereye, izin: izin[i], duz: oluklu[i] === 100 ? null : duzler[k++] })) };
}
function sysOf(key) {
  kur(key);
  const b = M.veFeadBuildFromCanvas();
  expect(b.ok).toBe(true);
  return b.sys;
}
// Gates kodu → modeldeki kasnak adı (örneğin kendi künyesinden).
function adlar(key) {
  const ad = {};
  M.veFeadExampleNodes(key).example.pulleys.forEach((q) => { ad[q.key] = q.name; });
  return ad;
}
// Çözümün satırları Gates kodlarıyla (psi de koda göre okunur).
function hizaGates(key, psi) {
  const ad = adlar(key), kod = {};
  Object.keys(ad).forEach((k) => { kod[ad[k]] = k; });
  const psiAd = {};
  Object.keys(psi || {}).forEach((k) => { psiAd[ad[k]] = psi[k]; });
  return M.veFeadHizalamaPayi(sysOf(key), { psi: psiAd }).map((r) =>
    Object.assign({}, r, { kasnak: kod[r.kasnak], onceki: kod[r.onceki] }));
}

describe('HİZALAMA — pay kasnağa GİREN açıklıkta (ders notu s.51 · Gates s.4)', () => {
  test('okuyucu altı raporun sayfasını okuyor: 12 çift, düz kasnaklar, ψ', () => {
    const say = Object.keys(RAPOR_HIZA).map((k) => gatesHiza(RAPOR_HIZA[k]));
    expect(say.map((g) => g.satir.length)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(say[0]).toEqual({ psi: { IDR: 0.33, TEN: 1.2 }, satir: [
      { nereden: 'A_C', nereye: 'CRK', izin: 3.93, duz: 'IDR' },
      { nereden: 'CRK', nereye: 'A_C', izin: 1.49, duz: 'TEN' }] });
    expect(say[5].satir).toEqual([
      { nereden: 'A_C', nereye: 'CRK', izin: 4.11, duz: null },
      { nereden: 'CRK', nereye: 'A_C', izin: 0, duz: 'TEN' }]);
  });

  test('ÇİFT GATES\'İNKİ: kaburgalı kasnağın önündeki kasnak kayışın gidişinde — 12/12', () => {
    Object.keys(RAPOR_HIZA).forEach((key) => {
      const G = gatesHiza(RAPOR_HIZA[key]);
      const H = hizaGates(key, G.psi);
      G.satir.forEach((g) => {
        const r = H.find((x) => x.kasnak === g.nereye);
        expect({ key, cift: g.nereden + '->' + g.nereye, onceki: r.onceki, duz: r.oncekiDuz })
          .toEqual({ key, cift: g.nereden + '->' + g.nereye, onceki: g.duz || g.nereden, duz: !!g.duz });
      });
    });
  });

  test('düz kasnak girmeyen çiftte izin Gates\'le birebir (AG0868 ×3: 4,11 mm)', () => {
    let n = 0;
    Object.keys(RAPOR_HIZA).forEach((key) => {
      const G = gatesHiza(RAPOR_HIZA[key]);
      const H = hizaGates(key, G.psi);
      G.satir.filter((g) => !g.duz).forEach((g) => {
        const r = H.find((x) => x.kasnak === g.nereye);
        expect({ key, sapma: Math.abs(r.izinMm / g.izin - 1) < 0.005 }).toEqual({ key, sapma: true });
        n++;
      });
    });
    expect(n).toBe(3);
  });

  // Küçük ψ'li (avara, 0,33°) çiftte model Gates'e %4–6 yakın. Büyük ψ'li gergi
  // satırı AÇIK AYRIŞMA: çekirdeğin sabit kFlat'ı (0,70) Gates'in geometriye
  // bağlı "Resulting Fleeting Angle"ından (1,20°'de 0,80–0,91°) ayrışıyor ve
  // sınıra yakın olduğu için izin ×0,7–1,4 oynuyor. Sayfa ψ'yi sormadığı için
  // (0 geçer) ekrandaki sayıyı bu ayrışma etkilemiyor.
  test('küçük ψ\'li çiftte izin Gates\'e %7 içinde (AG00686 ×2 · AG00810)', () => {
    let n = 0;
    Object.keys(RAPOR_HIZA).forEach((key) => {
      const G = gatesHiza(RAPOR_HIZA[key]);
      const H = hizaGates(key, G.psi);
      G.satir.filter((g) => g.duz && G.psi[g.duz] < 0.5).forEach((g) => {
        const r = H.find((x) => x.kasnak === g.nereye);
        expect({ key, sapma: Math.abs(r.izinMm / g.izin - 1) < 0.07 }).toEqual({ key, sapma: true });
        n++;
      });
    });
    expect(n).toBe(3);
  });

  test('çözüm payı TAŞIR, Sonuçlar OKUR (yeniden kurmaz)', () => {
    const R = coz();
    expect(R.hizalama).toEqual(M.veFeadHizalamaPayi(R.build.sys));
    // AG00976, gidiş: FAN → TEN → ALT → IDR2 → A_C → IDR1 → FAN.
    const ad = adlar('AG00976_GATES_2025');
    expect(R.hizalama.map((a) => [a.kasnak, a.onceki, a.oncekiDuz]))
      .toEqual([[ad.FAN, ad.IDR1, true], [ad.ALT, ad.TEN, true], [ad.A_C, ad.IDR2, true]]);
    // Sayfa çözümün satırlarını basar: satır değişirse sayfa da değişir.
    R.hizalama = [{ kasnak: 'ALT', onceki: 'TEN', oncekiDuz: true, acikMm: 123.45, izinMm: 9.87, limDeg: 0.9 }];
    const h = RS.veFeadResSummaryHTML(R);
    const i = h.indexOf('Hizalama payı');
    const bol = h.slice(i, h.indexOf('ve-fr-sec', i + 20));
    expect(bol).toContain('123,5');
    expect(bol).toContain('9,87');
    expect(bol).toMatch(/Giren açıklık/);
    expect(bol).toMatch(/· düz/);
  });

  test('Sonuçlar sayfası çekirdeğe KENDİSİ sormuyor', () => {
    const src = loadSource('cp-fead-results.js');
    expect(src).not.toMatch(/alignmentAllowance\s*\(/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  KORD KUVVETİ — T_etkin + m′v², hesaba girmez, gösterilir
// ════════════════════════════════════════════════════════════════════════════
// Zincir etkin gerginlik taşıyor (kural 28); kordun gerçek kuvveti hiçbir
// yüzeyde yoktu, m′v² yalnız Sonuçlar'ın `tc` kanalındaydı.
describe('KORD KUVVETİ — etkin gerginlik + m′v² (ders notu s.25–28 · s.37)', () => {
  test('bağımsız yoldan: her çevrim satırında en gergin açıklık + m′v²', () => {
    const R = coz('AG00976_GATES_2025', 'full');
    const sys = R.build.sys;
    const mp = F.massPerM(sys);
    const duty = R.analysis.duty;
    expect(R.kord.satir).toHaveLength(duty.length);
    duty.forEach((d, j) => {
      const T = Math.max(...d.perPulley.map((p) => p.exitTensionN));
      const v = F.beltSpeed(sys, d.engineRpm);
      expect(R.kord.satir[j].kordN).toBeCloseTo(T + mp * v * v, 9);
    });
    const en = Math.max(...R.kord.satir.map((s) => s.kordN));
    expect(R.kord.enBuyuk.kordN).toBe(en);
    // AG00976: gergin taraf sürücüye (FAN) giren açıklık, 1.000 d/dk.
    expect(R.kord.enBuyuk.span).toBe(adlar('AG00976_GATES_2025').FAN);
    expect(R.kord.enBuyuk.engineRpm).toBe(1000);
  });

  test('açıklık frekansı ile kord kuvveti AYNI gerçek gerginliği okur', () => {
    const R = coz('AG00976_GATES_2025', 'full');
    R.analysis.duty.forEach((d) => d.frequencies.forEach((s) => {
      expect(s.kordN).toBeCloseTo(s.TN > 0 ? s.TN + s.TcN : s.TN, 9);
    }));
  });

  test('hesaba GİRMEZ: kayış verisi açık/kapalı iki çözümde gerilme, hubload, kayma BİREBİR', () => {
    const A = coz('AG00976_GATES_2025', 'full'), K = coz('AG00976_GATES_2025', 'none');
    const iz = (R) => R.analysis.duty.map((d) => [d.perPulley.map((p) => p.exitTensionN),
      d.hubloads.map((h) => h.FN), d.slip.map((s) => s.SF)]);
    expect(iz(A)).toEqual(iz(K));
  });

  test('kayış verisi kapalıyken üretilmez ve adıyla listelenir', () => {
    const R = coz('AG00976_GATES_2025', 'none');
    expect(R.kord).toBeUndefined();
    expect(R.beltDataOff).toContain('Kord kuvveti (etkin gerginlik + m′v²)');
    expect(S.summary(R).find((k) => k.k === 'kord')).toBeUndefined();
  });

  test('yüzeyler çözümün sayısını basar: özet kartı · rapor §8.17', () => {
    const R = coz('AG00976_GATES_2025', 'full');
    const k = S.summary(R).find((x) => x.k === 'kord');
    expect(k.deger).toBe(veSayi(R.kord.enBuyuk.kordN, 0));
    expect(k.not).toMatch(/^FAN girişi · 1\.000 d\/dk · m′v² 11,6 N$/);
    const h = rapor._frSection8(R, null);
    const i = h.indexOf('<h3>8.17');
    expect(h.slice(i)).toMatch(/<th>Kord kuvveti \(en az–en çok\)<\/th>/);
    expect(h.slice(i)).toContain('<b>' + veSayi(Math.round(R.kord.enBuyuk.kordN), null) + ' N</b>');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  SÜRÜNME — kasnak yüzeyi GİRİŞ açıklığının hızıyla döner
// ════════════════════════════════════════════════════════════════════════════
describe('SÜRÜNME — aksesuarın gerçek devri (ders notu s.34)', () => {
  // Bağımsız yol: giriş açıklığı KAYIŞIN GİDİŞİNDEN bulunur (önceki kasnakla
  // arasındaki açıklık), köprünün "exitTensionN = fiziksel giriş" kabulünden
  // değil. Açıklığın gerginliği tablo sırasındaki kendi satırından.
  function beklenen(R, j, EA) {
    const sys = R.build.sys, d = R.analysis.duty[j];
    const ad = sys.pulleys.map((p) => p.name), n = ad.length;
    const gidis = M.veFeadRouteFlip(ad);
    const T = d.perPulley.map((p) => p.exitTensionN);
    const acik = (a, b) => {                          // a–b açıklığının tablo satırı
      for (let k = 0; k < n; k++) {
        const u = ad[k], w = ad[(k + 1) % n];
        if ((u === a && w === b) || (u === b && w === a)) return k;
      }
      return -1;
    };
    const Tc = F.massPerM(sys) * F.beltSpeed(sys, d.engineRpm) ** 2;
    const K = (x) => T[acik(x, gidis[(gidis.indexOf(x) - 1 + n) % n])] + Tc;
    const s = ad[sys._crkIdx];
    const out = {};
    ad.forEach((x) => { if (x !== s) out[x] = 100 * (1 - (1 + K(x) / EA) / (1 + K(s) / EA)); });
    return out;
  }

  test('bağıntı bağımsız yoldan: giriş açıklığının kord kuvveti, sürücüye göre — iki EA ucu', () => {
    const R = coz('AG00976_GATES_2025', 'full');
    const ribs = R.build.sys.belt.ribs;
    expect(R.surunme.eaKaburgaN).toEqual([43000, 18000]);
    R.surunme.satir.forEach((s, j) => {
      [0, 1].forEach((u) => {
        const b = beklenen(R, j, R.surunme.eaKaburgaN[u] * ribs);
        s.kasnak.forEach((q) => expect(q.kayipPct[u]).toBeCloseTo(b[q.ad], 9));
      });
    });
  });

  test('işaret: her kasnak sürücüden YAVAŞ döner; en çok gevşek taraftan beslenen (AG00976: ALT)', () => {
    const R = coz('AG00976_GATES_2025', 'full');
    R.surunme.satir.forEach((s) => s.kasnak.forEach((q) => expect(q.kayipPct[0]).toBeGreaterThan(0)));
    expect(R.surunme.enBuyuk.ad).toBe(adlar('AG00976_GATES_2025').ALT);
  });

  // Balta, Sönmez, Cengiz 2015 (kaburgalı kayışta ölçülen hız kaybı %0,2–1,2).
  // Kaburga sayısıyla çarpılmayan EA ×8, yüzdeye çevrilmeyen oran ×1/100 verir.
  test('büyüklük ölçülen bantta: 11 Gates örneğinin en büyük kaybı %0,2–1,2', () => {
    M.veFeadExampleKeys().forEach((key) => {
      const R = coz(key, 'full');
      const u = R.surunme.enBuyuk.kayipPct[1];
      expect({ key, bantta: u >= 0.2 && u <= 1.2 }).toEqual({ key, bantta: true });
    });
  });

  test('kayıp güç Σ P·ψ; EA çekirdeğin burulma değeri DEĞİL', () => {
    const R = coz('AG00976_GATES_2025', 'full');
    R.surunme.satir.forEach((s, j) => {
      const per = R.analysis.duty[j].perPulley;
      [0, 1].forEach((u) => {
        const P = s.kasnak.reduce((t, q) => t + per[q.index].powerKw * q.kayipPct[u] / 100, 0);
        expect(s.kayipKw[u]).toBeCloseTo(P, 12);
      });
    });
    expect(R.surunme.eaKaburgaN).not.toContain(F.BELT_DB.PK.GATES.cordStiffnessNPerRib);
  });

  test('hesaba GİRMEZ: aksesuar devri ve devir sınırı kapısı kinematik kalır', () => {
    const A = coz('AG00976_GATES_2025', 'full'), K = coz('AG00976_GATES_2025', 'none');
    expect(A.analysis.duty.map((d) => d.perPulley.map((p) => p.accessoryRpm)))
      .toEqual(K.analysis.duty.map((d) => d.perPulley.map((p) => p.accessoryRpm)));
    expect(A.checks.speedLimit).toEqual(K.checks.speedLimit);
  });

  test('PK dışında sayı uydurulmaz; kayış verisi kapalıyken üretilmez', () => {
    const R = coz('AG00976_GATES_2025', 'full');
    const sys = JSON.parse(JSON.stringify(R.build.sys));
    sys.belt.profile = 'PJ';
    expect(M.veFeadSurunme(sys, R.analysis.duty)).toBeNull();
    const K = coz('AG00976_GATES_2025', 'none');
    expect(K.surunme).toBeUndefined();
    expect(K.beltDataOff).toContain('Sürünme ile gerçek aksesuar devri');
  });

  test('yüzeyler çözümün sayısını basar: özet kartı · rapor §8.11 tablosu', () => {
    const R = coz('AG00976_GATES_2025', 'full');
    const k = S.summary(R).find((x) => x.k === 'surunme');
    const en = R.surunme.enBuyuk;
    expect(k.deger).toBe('%' + veSayi(en.kayipPct[0], 2) + '–' + veSayi(en.kayipPct[1], 2));
    expect(k.not).toBe('ALT · 1.000 d/dk · EA 18–43 kN/kaburga');
    const h = rapor._frSection8(R, null);
    const i = h.indexOf('<h3>8.11'), j = h.indexOf('<h3>8.12');
    const b = h.slice(i, j);
    expect(b).toMatch(/Sürünmeyle devir kaybı \[%\] \(EA 43 … 18 kN\/kaburga\)/);
    const r0 = R.surunme.satir[0];
    expect(b).toContain('<td>' + veSayi(r0.kasnak[0].kayipPct[0], 2) + '–' + veSayi(r0.kasnak[0].kayipPct[1], 2) + '</td>');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  c₂ GRUBU — silindir sayısı sürücü grubunu ÖNERİR, seçmez
// ════════════════════════════════════════════════════════════════════════════
// Ders notunun tablosu (s.65) sürücüyü silindir sayısıyla ayırır; ContiTech
// 600 d/dk ile. Kullanıcı kararı: tablo ContiTech'te kalır, ölçüt öneri olarak
// gelir.
describe('c₂ GRUBU — silindir sayısından öneri (ders notu s.65)', () => {
  // Ders notunun tablosu, s.65 (satır: yük; sütun: normal ≤10/10–16/>16 · yüksek …)
  const DERS = {
    hafif: { normal: [1.1, 1.1, 1.2], yuksek: [1.1, 1.2, 1.3] },
    orta: { normal: [1.1, 1.2, 1.3], yuksek: [1.2, 1.3, 1.4] },
    agir: { normal: [1.2, 1.3, 1.4], yuksek: [1.4, 1.5, 1.6] },
    cokAgir: { normal: [1.3, 1.4, 1.5], yuksek: [1.5, 1.6, 1.8] },
  };

  test('tablo ContiTech\'te kalır: 24 hücrenin 23\'ü aynı, tek fark Hafif · normal · ≤ 10 sa', () => {
    const fark = [];
    M.VE_FEAD_SERVIS.yuk.forEach((y) => ['normal', 'yuksek'].forEach((g) => y.deger[g].forEach((v, i) => {
      if (v !== DERS[y.k][g][i]) fark.push([y.k, g, i, v, DERS[y.k][g][i]]);
    })));
    expect(fark).toEqual([['hafif', 'normal', 0, 1.0, 1.1]]);
  });

  test('öneri: 4 ve daha fazla silindir normal, azı yüksek kalkış; silindir yoksa öneri yok', () => {
    expect(M.veFeadServisOneri({ cylinders: 3 }).k).toBe('yuksek');
    expect(M.veFeadServisOneri({ cylinders: 4 }).k).toBe('normal');
    expect(M.veFeadServisOneri({ cylinders: 6 }).k).toBe('normal');
    expect(M.veFeadServisOneri({})).toBeNull();
  });

  test('çelişki: seçili hücrenin grubu öneriyle ayrışırsa aynı yük ve sürenin hücresi önerilir', () => {
    const on = M.veFeadServisOneri({ cylinders: 3, servisHucre: 'agir.normal.16', serviceFact: 1.3 });
    expect(on.celiski.anahtar).toBe('agir.yuksek.16');
    expect(on.celiski.deger).toBe(1.5);
    expect(M.veFeadServisOneri({ cylinders: 6, servisHucre: 'agir.normal.16' }).celiski).toBeNull();
    // Öneri seçimi DEĞİŞTİRMEZ: etkin c₂ seçili hücrenin.
    expect(M.veFeadServisFaktoru({ cylinders: 3, servisHucre: 'agir.normal.16' }).deger).toBe(1.3);
  });

  test('tabloda: seçim yokken grup, çelişkide uyarı + önerilen hücre AYNI yazıcıyla; uyumluysa satır yok', () => {
    const X = (k) => 'X(\'' + k + '\')';
    const bos = fead.veFeadServisTabloHTML({ cylinders: 3 }, X);
    expect(bos).toMatch(/data-ve="servis-oneri">.*3 silindir: <b>yüksek kalkış<\/b> grubu \(4'ten az silindir\)/);
    const cel = fead.veFeadServisTabloHTML({ cylinders: 3, servisHucre: 'agir.normal.16', serviceFact: 1.3 }, X);
    expect(cel).toMatch(/data-ve="servis-oneri" data-uyari="1"/);
    expect(cel).toContain('— seçili hücre normal kalkış');
    expect(cel).toContain('onclick="X(\'agir.yuksek.16\')">Önerilen hücre (c₂ 1,5)</button>');
    const uyum = fead.veFeadServisTabloHTML({ cylinders: 6, servisHucre: 'agir.normal.16', serviceFact: 1.3 }, X);
    expect(uyum).not.toContain('servis-oneri');
    // Hücre düğmesi sayısı değişmez (24).
    expect((cel.match(/class="ve-fead-c2-h"/g) || []).length).toBe(24);
  });

  test('çözüm çelişkiyi uyarılarına yazar, hesabın c₂\'si seçili hücrenin', () => {
    kur('AG00976_GATES_2025');
    const sv = global.nodes.find((n) => n.type === 'fead-solver');
    M.veFeadServisSet(sv.data, 'agir.normal.16');
    sv.data.cylinders = 3;
    const R = fead.veFeadSolve(sv.id);
    expect(R.servis.deger).toBe(1.3);
    expect(R.warnings.join(' ')).toMatch(/Servis faktörü: 3 silindirli motor silindir ölçütüyle \(4'ten az silindir\) yüksek kalkış grubunda; seçili hücre normal kalkış\. Aynı yük ve sürede c₂ 1,5 \(hesapta 1,3\)\./);
    sv.data.cylinders = 6;
    expect(fead.veFeadSolve(sv.id).warnings.join(' ')).not.toMatch(/Servis faktörü:/);
  });
});
