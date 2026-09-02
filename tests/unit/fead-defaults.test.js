/**
 * fead-defaults.test.js — GİRİLMEYEN ALANLARIN ARŞİVDEN DOLDURULMASI
 *
 * Kullanıcı isteği (2026-09-02): *"Atalet momentlerini ben girmedim fakat
 * Gates raporlarındaki değerleri default olarak kullanabilirsin. Aynı şekilde
 * tolerans/aşınma, load stop, boy ofseti gibi değerleri Gates raporlarından
 * default olarak kullanırsın. Çünkü bunları el ile girmek zor."*
 *
 * BU DOSYA İKİ AYRI ŞEYİ TUTUYOR ve ikisi de sessiz hata sınıfına karşı:
 *
 *   ① SAYILAR KAYNAĞINDAN — `VE_FEAD_DEFAULTS`'taki her değer, doğrulama
 *     fixture'ı ve `docs/gates-reports/pdf/` arşivinden BURADA yeniden
 *     hesaplanıp karşılaştırılıyor. Elle yazılmış bir varsayılan, arşiv
 *     değişince sessizce eskir; bu kapı onu kırmızıya çevirir.
 *
 *   ② DAVRANIŞ — varsayılan yalnız BOŞ alana iner (`0` girilmişse ezmez),
 *     düğüme YAZILMAZ (kullanıcının modeli boş kalır), künyesi sonucun içinde
 *     taşınır (`build.defaults`) ve panel + rapor onu basar. Dördü de
 *     modülün 8. kuralının ("geçerlilik sınırı sonucun İÇİNDE taşınır")
 *     doğrudan karşılığı: varsayılan görünmezse model bilinmeyen bir sayıyla
 *     koşar ve hiçbir yerde yazmaz.
 *
 * ÖLÇÜLMÜŞ TUZAK — durdurucu varsayılanı YALNIZ DARALTIR: ilk sürüm onu
 * koşulsuz yazıyordu ve yay katsayısı bir ondalık kaymış bir modelde (k=0.048)
 * nominal dönüş 280.6°, varsayılan 505° oluyordu. Çekirdeğin 89°'lik yedeği o
 * modeli kenetliyor ve panel sebebini yazıyordu; 505°'lik sınırla kenetlenme
 * kalkıyor, `feasibleRelMax`in bisect'i monoton olmayan bir fonksiyonda başka
 * bir dala oturuyor ve model saçma bir açıyla "çözülmüş" görünüyordu.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const V = require('../fixtures/fead-validation.js');
const TEN = require('../../js/fead-tensioners.js');
const { vibrationOf } = require('../helpers/gates-vibration.js');

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

const D = M.VE_FEAD_DEFAULTS;
const RAPORLAR = ['AG00686', 'AG00686-1520', 'AG00810', 'AG00879',
                  'AG0868-4PK', 'AG0868-6PK', 'AG0868'];

/** Arşivdeki `belt`+`pos` taşıyan bütün doğrulama kayıtları. */
function tumSistemler() {
  const out = [];
  const gez = (o) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return;
    if (o.belt && o.pos) out.push(o);
    Object.keys(o).forEach((k) => gez(o[k]));
  };
  gez(V);
  return out;
}
const medyan = (a) => {
  const v = a.slice().sort((x, y) => x - y);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

function kur(key, yama) {
  const pack = veFeadExampleNodes(key || 'BMC_FEAD_2026');
  pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
  if (yama) yama(pack.nodes);
  global.nodes = pack.nodes; global.connections = pack.connections;
  return { pack, build: veFeadBuildSystem(pack.nodes, pack.connections) };
}
const alan = (build, re) => (build.defaults || []).filter((d) => re.test(d.field));

/* ══════════════ ① SAYILAR KAYNAĞINDAN ═══════════════════════════════════ */

describe('varsayılanlar arşivle uyuşuyor', () => {
  test('aşınma payı: 14 sistemin en sık ve EN BÜYÜK değeri', () => {
    const w = tumSistemler().map((d) => d.wear);
    expect(w.length).toBeGreaterThanOrEqual(14);
    // En sık değer
    const sayim = {};
    w.forEach((x) => { sayim[x] = (sayim[x] || 0) + 1; });
    const sik = Object.keys(sayim).reduce((a, b) => (sayim[b] > sayim[a] ? b : a));
    expect(D.wearPct * 100).toBeCloseTo(Number(sik), 6);
    // ve aynı zamanda en büyüğü — sapanlar hep ALTINDA, yani emniyetli yön
    expect(Math.max.apply(null, w)).toBeCloseTo(D.wearPct * 100, 6);
  });

  test('tolerans basamağı: arşivde İKİ değer var ve ayrım kayış boyunda', () => {
    const s = tumSistemler();
    const kisa = s.filter((d) => d.belt < D.beltTolBreakMm).map((d) => d.tol);
    const uzun = s.filter((d) => d.belt >= D.beltTolBreakMm).map((d) => d.tol);
    expect(kisa.length).toBeGreaterThan(0);
    expect(uzun.length).toBeGreaterThan(0);
    // Basamak TEMİZ: eşiğin altındaki her sistem aynı toleransta, üstündeki de.
    expect(new Set(kisa)).toEqual(new Set([D.beltTolShortMm]));
    expect(new Set(uzun)).toEqual(new Set([D.beltTolLongMm]));
    // ve fonksiyon o basamağı veriyor
    expect(veFeadDefaultBeltTol(1392)).toBe(D.beltTolShortMm);
    expect(veFeadDefaultBeltTol(1475)).toBe(D.beltTolLongMm);
    expect(veFeadDefaultBeltTol(D.beltTolBreakMm)).toBe(D.beltTolLongMm);
    expect(veFeadDefaultBeltTol(NaN)).toBe(D.beltTolShortMm);   // boy yoksa kısa
  });

  test('durdurucu katsayısı: ölçülen stop/nominal oranlarının bandında', () => {
    const oran = TEN.veFeadTensionerList()
      .filter((r) => r.loadStopRelDeg != null)
      .map((r) => r.loadStopRelDeg / ((r.meanNm - r.preloadNm) / r.rateNm));
    expect(oran.length).toBe(12);
    const ort = oran.reduce((a, b) => a + b, 0) / oran.length;
    expect(D.loadStopFactor).toBeCloseTo(ort, 1);
    expect(D.loadStopFactor).toBeGreaterThanOrEqual(Math.min.apply(null, oran));
    expect(D.loadStopFactor).toBeLessThanOrEqual(Math.max.apply(null, oran));
  });

  test('boy ofseti: ölçülen değerlerin ortalaması ve bandın içinde', () => {
    const off = tumSistemler().map((d) => d.lengthOffsetMm).filter((x) => x != null);
    // AG00879 örneği fixture'da taşımıyor; örnek tanımının kendisinden gelir.
    off.push(M.veFeadExampleOf('AG00879_GATES_2023').solver.lengthOffsetMm);
    expect(off.length).toBe(5);
    const ort = off.reduce((a, b) => a + b, 0) / off.length;
    expect(D.lengthOffsetMm).toBeCloseTo(ort, 1);
    expect(D.lengthOffsetMm).toBeGreaterThan(Math.min.apply(null, off));
    expect(D.lengthOffsetMm).toBeLessThan(Math.max.apply(null, off));
  });

  test('atalet varsayılanları: Gates titreşim sayfalarının MEDYANI', () => {
    // Rapor rolü → MFSim bileşen tipi
    const ROL = { IDR: 'fead-idler', A_C: 'fead-ac', ALT: 'fead-alternator',
                  TEN: 'fead-tensioner' };
    const topla = {};
    const kol = [], kutle = [], krank = [];
    RAPORLAR.forEach((k) => {
      const v = vibrationOf(k);
      Object.keys(v.accessoryInertia).forEach((ad) => {
        const t = ROL[ad]; if (!t) return;
        (topla[t] = topla[t] || []).push(v.accessoryInertia[ad]);
      });
      kol.push(v.armInertiaKgM2);
      kutle.push(v.pulleyMassKg);
      krank.push(v.crankInertiaKgM2);
    });
    Object.keys(ROL).forEach((ad) => {
      const t = ROL[ad];
      expect(topla[t] && topla[t].length).toBeGreaterThan(1);
      expect(D.inertiaKgM2[t]).toBeCloseTo(medyan(topla[t]), 6);
    });
    expect(D.tenArmInertiaKgM2).toBeCloseTo(medyan(kol), 6);
    expect(D.tenPulleyMassKg).toBeCloseTo(medyan(kutle), 6);
    expect(D.crankInertiaKgM2).toBeCloseTo(medyan(krank), 6);
  });

  // ÖLÇÜLMEMİŞ TİPE VARSAYILAN UYDURULMUYOR. Su pompası, direksiyon pompası ve
  // hava kompresörü arşivin yedi raporunun hiçbirinde geçmiyor; rotor ataleti
  // kasnak çapından türetilemez ve "makul ama yanlış" bir sayı bu modülün en
  // pahalı hata sınıfı.
  test('arşivde geçmeyen tipin varsayılanı YOK', () => {
    ['fead-waterpump', 'fead-ps', 'fead-aircomp', 'fead-fan'].forEach((t) => {
      expect(D.inertiaKgM2[t]).toBeUndefined();
      expect(veFeadDefaultInertia(t, false)).toBeNaN();
    });
    // ama SÜRÜCÜ rolündeyse krank mili ataletini alır — tipten bağımsız.
    expect(veFeadDefaultInertia('fead-fan', true)).toBe(D.crankInertiaKgM2);
  });

  test('gergi künyelerinin 12\'si ölçülmüş stop taşıyor, 2\'si TAŞIMIYOR', () => {
    const l = TEN.veFeadTensionerList();
    const varsa = l.filter((r) => r.loadStopRelDeg != null);
    expect(varsa.length).toBe(12);
    expect(l.length - varsa.length).toBe(2);
    // Her biri fixture'daki Load satırıyla birebir — teste elle yazılmadı.
    const s = V.AG_MISC || {};
    Object.keys(s).forEach((k) => {
      const rec = l.find((r) => r.key === k || r.key === k + '-8PK');
      const load = (s[k].pos || []).find((p) => p.name === 'Load');
      if (rec && load) expect(rec.loadStopRelDeg).toBeCloseTo(load.rel, 6);
    });
  });

  // Künye uygulanınca stop da yazılır; künye stop TAŞIMIYORSA eskisi SİLİNİR.
  // Kalsaydı önceki parçanın erişim sınırı yeni parçanınki sanılırdı ve Load
  // sütunu ile olanaklı açı bandı sessizce yanlış çıkardı.
  test('künye uygulaması stop\'u yazar; taşımayan künye eskiyi SİLER', () => {
    const td = {};
    TEN.veFeadTensionerApply(td, TEN.veFeadTensionerOf('AG00879'));
    expect(td.loadStopRelDeg).toBe(39.0);
    TEN.veFeadTensionerApply(td, TEN.veFeadTensionerOf('AG00976-1705'));
    expect(td.loadStopRelDeg).toBeUndefined();
  });
});

/* ══════════════ ② DAVRANIŞ ══════════════════════════════════════════════ */

describe('varsayılan yalnız BOŞ alana iner', () => {
  test('0 girilmişse EZİLMEZ — boş ile sıfır ayrı', () => {
    const { build } = kur('BMC_FEAD_2026');       // örnek tol/wear/off = 0 yazıyor
    expect(build.sys.belt.tolerance).toBe(0);
    expect(build.sys.belt.wearPct).toBe(0);
    expect(build.sys.lengthOffsetMm).toBe(0);
    expect(alan(build, /tolerans|aşınma|ofset/)).toHaveLength(0);
  });

  test('alan silinince varsayılan iner', () => {
    const { build } = kur('BMC_FEAD_2026', (ns) => {
      const b = ns.find((n) => n.type === 'fead-belt');
      delete b.data.tolerance; delete b.data.wearPct;
      delete ns.find((n) => n.type === 'fead-solver').data.lengthOffsetMm;
    });
    expect(build.sys.belt.wearPct).toBe(D.wearPct);
    expect(build.sys.lengthOffsetMm).toBe(D.lengthOffsetMm);
    // tolerans basamağı TÜRETİLEN boydan seçilir (serbest kip): 1715 mm → ±6
    expect(build.sys.belt.effLength).toBeGreaterThan(D.beltTolBreakMm);
    expect(build.sys.belt.tolerance).toBe(D.beltTolLongMm);
    expect(alan(build, /tolerans/)).toHaveLength(1);
    expect(alan(build, /aşınma/)).toHaveLength(1);
    expect(alan(build, /ofset/)).toHaveLength(1);
  });

  test('boş dize de BOŞ sayılır (panel alanı temizlenince)', () => {
    const { build } = kur('BMC_FEAD_2026', (ns) => {
      ns.find((n) => n.type === 'fead-belt').data.wearPct = '';
    });
    expect(build.sys.belt.wearPct).toBe(D.wearPct);
  });

  test('varsayılan DÜĞÜME YAZILMAZ — model boş kalır', () => {
    const { pack, build } = kur('BMC_FEAD_2026', (ns) => {
      ns.filter((n) => n.type === 'fead-ac').forEach((n) => { delete n.data.inertia; });
    });
    expect(alan(build, /^atalet · /)).toHaveLength(1);
    expect(pack.nodes.find((n) => n.type === 'fead-ac').data.inertia).toBeUndefined();
  });
});

describe('durdurucu varsayılanı YALNIZ DARALTIR', () => {
  test('normal modelde uygulanıyor ve nominal × katsayı', () => {
    const { build } = kur('BMC_FEAD_2026');
    const bek = build.spring.relMeanDeg * D.loadStopFactor;
    expect(build.sys.tensioner.loadStopRelDeg).toBeCloseTo(bek, 9);
    // KURULAN SİSTEM ile onun KÜNYESİ ayrışmıyor: cfg dışarıya verilen kayıt
    // (rapor · bant önbelleğinin anahtarı · testler) ve aynı stop'u taşımalı.
    expect(build.cfg.tensioner.loadStopRelDeg).toBe(build.sys.tensioner.loadStopRelDeg);
    expect(alan(build, /load stop/i)).toHaveLength(1);
  });

  test('çekirdeğin sınırından BÜYÜK olacaksa hiç uygulanmaz', () => {
    // k bir ondalık kaymış: nominal dönüş 280.6° → aday stop 505°.
    const { build } = kur('BMC_FEAD_2026', (ns) => {
      ns.find((n) => n.type === 'fead-tensioner').data.kArm = 0.048;
    });
    expect(build.spring.relMeanDeg).toBeGreaterThan(200);
    expect(build.sys.tensioner.loadStopRelDeg).toBeUndefined();
    expect(alan(build, /load stop/i)).toHaveLength(0);
    // ve kenetlenme uyarısı KORUNUYOR — asıl kapı bu
    expect((build.warnings || []).join(' ')).toMatch(/aralığın dışında|kenetlendi/);
  });

  test('künyede stop varsa varsayılan hiç devreye girmez', () => {
    const { build } = kur('AG00879_GATES_2023');
    expect(build.sys.tensioner.loadStopRelDeg).toBe(39.0);
    expect(alan(build, /load stop/i)).toHaveLength(0);
  });
});

describe('varsayılan künyesi YÜZEYE çıkıyor', () => {
  test('panel kutusu her alanı adıyla ve kaynağıyla basıyor', () => {
    const { build } = kur('BMC_FEAD_2026', (ns) => {
      ns.filter((n) => n.type === 'fead-idler').forEach((n) => { delete n.data.inertia; });
    });
    const h = veFeadDefaultsBox(build);
    expect(h).toMatch(/data-ve="fead-defaults"/);
    build.defaults.forEach((d) => {
      expect(h).toContain(d.field);
      expect(h).toContain(d.source);
    });
    // sayı da basılıyor (yalnız etiket değil)
    expect(h).toContain(String(D.inertiaKgM2['fead-idler']));
    // ve varsayılan yoksa kutu HİÇ çıkmıyor
    expect(veFeadDefaultsBox(kur('AG00879_GATES_2023').build)).toBe('');
  });

  // TEK ÜRETİCİ: uyarı kutusunu basan her panel varsayılan künyesini de basar.
  // Ayrı bir çağrı olsaydı üç panelden biri unutulurdu (modülün 9. kuralı).
  test('uyarı kutusunun geçtiği her yerde künye de var', () => {
    const { build } = kur('BMC_FEAD_2026');
    expect(veFeadWarningBox(build)).toMatch(/data-ve="fead-defaults"/);
  });

  test('rapor §8 künyeyi basıyor', () => {
    const { pack, build } = kur('BMC_FEAD_2026');
    const solv = pack.nodes.find((n) => n.type === 'fead-solver');
    const R = veFeadAnalyze(build, { rows: veFeadDutyRows(solv) });
    R.build = build;
    const h = RP._frDefaultsBox(R);
    expect(h).toMatch(/data-ve="fr-defaults"/);
    build.defaults.forEach((d) => expect(h).toContain(d.field));
    // "bu sistemin değeri değil" uyarısı raporda da duruyor
    expect(h).toMatch(/medyan/i);
  });
});

/* ══════════════ TAHRİK ORANI — ÜÇÜNCÜ KİP ══════════════════════════════ */

describe('tahrik oranı: tek kademeli düzen', () => {
  test('unity kipi 1 veriyor ve ÇAPA DA ORANA DA bakmıyor', () => {
    const d = veFeadDriveRatio({ ratioMode: 'unity', crankOD: 197.32, fanOD: 179.62,
                                 driveRatio: 3.7 });
    expect(d.mode).toBe('unity');
    expect(d.ratio).toBe(1);
    expect(d.ok).toBe(true);
  });

  test('öbür iki kip değişmedi', () => {
    expect(veFeadDriveRatio({ crankOD: 197.32, fanOD: 179.62 }).ratio)
      .toBeCloseTo(197.32 / 179.62, 9);
    expect(veFeadDriveRatio({ crankOD: 197.32, fanOD: 179.62 }).mode).toBe('derive');
    expect(veFeadDriveRatio({ ratioMode: 'direct', driveRatio: 1.43 }).ratio).toBe(1.43);
    // Kip yazılı değilse ve çap yoksa: oran girilmemiş sayılır (ok=false)
    expect(veFeadDriveRatio({}).ok).toBe(false);
  });

  test('unity ile direct-1 SAYICA aynı ama KİP ayrı — künye ikisini ayırıyor', () => {
    const u = veFeadDriveRatio({ ratioMode: 'unity' });
    const e = veFeadDriveRatio({ ratioMode: 'direct', driveRatio: 1 });
    expect(u.ratio).toBe(e.ratio);
    expect(veFeadDriveModeLabel(u.mode)).not.toBe(veFeadDriveModeLabel(e.mode));
    expect(veFeadDriveModeLabel('unity')).toMatch(/1:1|tek kademe/i);
  });

  test('panel kartı unity kipinde çap/oran alanı GÖSTERMİYOR', () => {
    const node = { id: 'sv', type: 'fead-solver', def: componentDefs['fead-solver'],
                   data: { ratioMode: 'unity', duty: [] } };
    const h = fead.veFeadDriveCard(node);
    expect(h).not.toMatch(/ve-fead-crankOD|ve-fead-fanOD|ve-fead-driveRatio/);
    expect(h).toMatch(/1,0000|1\.0000/);
    // öbür kiplerde alanlar duruyor
    node.data.ratioMode = 'derive';
    expect(fead.veFeadDriveCard(node)).toMatch(/ve-fead-crankOD/);
    node.data.ratioMode = 'direct';
    expect(fead.veFeadDriveCard(node)).toMatch(/ve-fead-driveRatio/);
  });

  test('seçenek listesinde üç kip de var', () => {
    const node = { id: 'sv', type: 'fead-solver', def: componentDefs['fead-solver'],
                   data: { duty: [] } };
    const h = fead.veFeadDriveCard(node);
    ['derive', 'unity', 'direct'].forEach((k) => expect(h).toContain('value="' + k + '"'));
  });

  test('unity kipi çözümde de 1 — aksesuar devirleri ölçeklenmiyor', () => {
    const { build } = kur('BMC_FEAD_2026', (ns) => {
      const sv = ns.find((n) => n.type === 'fead-solver').data;
      sv.ratioMode = 'unity';
    });
    expect(build.drive.mode).toBe('unity');
    expect(build.sys.driveRatio).toBe(1);
    // BMC örneği normalde 197.32/179.62 = 1.0985 ile koşuyor
    expect(kur('BMC_FEAD_2026').build.sys.driveRatio).toBeCloseTo(1.0985, 4);
  });
});
