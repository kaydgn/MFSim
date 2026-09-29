/**
 * cp-fead-pano.test.js — FEAD A3 SONUÇ PANOSU (js/cp-fead-pano.js)
 *
 * Pano HESAPLAMAZ: her sayı çözümden okunur ve üreticisi öteki iki belgeyle
 * ortaktır. Kapı bu yüzden "etiket var mı"ya bakmaz — sayfanın her sayısını
 * çözümden BAĞIMSIZ bir yolla (ham satırları kaba kuvvetle tarayarak) yeniden
 * kurar ve karşılaştırır. Sessiz hata sınıfı burada da aynı: yanlış satırın
 * en büyüğü, yanlış kasnağın emniyeti, yeniden hesaplanan bir kapı — sayfa
 * yine basılır, hiçbir şey patlamaz.
 *
 * Kapsam ayrımı:
 *   cp-fead-summary.test.js   özet rapor + rapor türü seçimi
 *   BU DOSYA                  A3 pano: veri modeli · belge · ölçü · bağlantılar
 *   tests/e2e/fead-pano.spec.js  gerçek tarayıcıda sığma, punto ve baskı
 */
const fs = require('fs');
const path = require('path');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const CK = require('../../js/fead-checks.js');
const EN = require('../../js/fead-engines.js');
const AC = require('../../js/fead-accessories.js');
const { motorluOrnekler } = require('../helpers/fead-motor');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.FEADCore = F;
[EN, AC, CK].forEach((X) => Object.keys(X).forEach((k) => { global[k] = X[k]; }));
Object.keys(M).forEach((k) => { global[k] = M[k]; });
motorluOrnekler(M);
const CP = require('../../js/cp-fead.js');
Object.keys(CP).forEach((k) => { if (global[k] === undefined) global[k] = CP[k]; });
const RP = require('../../js/cp-fead-report.js');
Object.keys(RP).forEach((k) => { global[k] = RP[k]; });
const SU = require('../../js/cp-fead-summary.js');
Object.keys(SU).forEach((k) => { if (global[k] === undefined) global[k] = SU[k]; });
const PN = require('../../js/cp-fead-pano.js');
Object.keys(PN).forEach((k) => { if (global[k] === undefined) global[k] = PN[k]; });

// Uygulamanın çözüm yolu (cp-fead.js → veFeadSolve): kapılar ve imza
// çözüm anında sonuca yazılır.
function coz(anahtar, ayar) {
  ayar = ayar || {};
  const pack = M.veFeadExampleNodes(anahtar);
  const ns = pack.nodes.map((n) => ({
    id: n.id, type: n.type, def: componentDefs[n.type],
    customName: n.customName, data: JSON.parse(JSON.stringify(n.data))
  }));
  const b0 = ns.find((n) => n.type === 'fead-belt');
  if (b0) b0.data.beltDataMode = ayar.kayisVeri || 'full';
  const solv = ns.filter((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver)[0];
  if (ayar.servis) M.veFeadServisSet(solv.data, ayar.servis);
  const build = veFeadBuildSystem(ns);
  const R = veFeadAnalyze(build, {
    rows: veFeadDutyRows(solv), cylinders: Number(solv.data.cylinders) || 6,
    crankInertia: Number(solv.data.crankInertia) || 0, fatigueModel: 'PK-2_2p-MT3',
    accelRpmS: Number(solv.data.accelRpmS) || undefined,
    decelRpmS: Number(solv.data.decelRpmS) || undefined
  });
  R.build = build; R.pulleyNames = build.names;
  R.solvedAt = Date.UTC(2026, 8, 29, 11, 46);
  R.checkOpt = veFeadCheckOpt(solv.data, veFeadDutyRows(solv));
  R.checks = veFeadChecks(build, R.checkOpt);
  return R;
}
const NODE = { id: 'rep1', type: 'fead-report', data: { docNo: 'FEAD-2026-001', revision: 'A', author: 'A. Kol' } };
const P = PN.VE_FEAD_PANO;

let R = null, V = null, DOC = '';
beforeAll(() => {
  R = coz('AG00976_GATES_2025');
  V = PN.veFeadPanoVeri(R, NODE);
  DOC = PN.veFeadPanoHTML(R, NODE);
});
beforeEach(() => resetStubs(stubs));

const duty = () => R.analysis.duty;
const enBuyuk = (dizi) => dizi.reduce((a, x) => (x.v > a.v ? x : a), { v: -Infinity });
const enKucuk = (dizi) => dizi.reduce((a, x) => (x.v < a.v ? x : a), { v: Infinity });

// ═══════════════════════════════════════════════════════════════════════════
describe('veri modeli — çözümden BAĞIMSIZ yeniden kurulum', () => {
  test('kasnak satırı: çevrimde en büyük hubload + yönü + devri, en büyük güç', () => {
    V.kas.forEach((k, i) => {
      const h = enBuyuk(duty().map((d) => ({ v: d.hubloads[i].FN, yon: d.hubloads[i].dirDeg, rpm: d.engineRpm })));
      expect(k.flDin).toBe(h.v);
      expect(k.flDinYon).toBe(h.yon);
      expect(k.flDinRpm).toBe(h.rpm);
      expect(k.pMax).toBe(Math.max(...duty().map((d) => d.perPulley[i].powerKw)));
    });
  });

  test('kasnak satırı: en düşük SF kasnağın ADIYLA eşlenir, yük taşıma oranın eşiğinden', () => {
    V.kas.forEach((k) => {
      const satir = duty().flatMap((d) => d.slip.filter((s) => s.name === k.ad).map((s) => ({ v: s.SF, rpm: d.engineRpm, r: s.tensionRatio })));
      expect(satir.length).toBe(duty().length);
      const e = enKucuk(satir);
      expect(k.sfMin).toBe(e.v);
      expect(k.sfRpm).toBe(e.rpm);
      expect(k.yuklu).toBe(satir.some((s) => s.r >= RP.VE_FR_SLIP_LOADED_RATIO));
    });
    // AG00976: FAN · KK · ALT yük taşır, avaralar ve gergi taşımaz.
    expect(V.kas.filter((k) => k.yuklu).map((k) => k.kod)).toEqual(['FAN', 'KK', 'ALT']);
  });

  test('n maks: çevrimin en yüksek devrinde aksesuar devri (çekirdeğin hız oranı)', () => {
    const nTepe = Math.max(...duty().map((d) => d.engineRpm));
    expect(V.nMax).toBe(nTepe);
    V.kas.forEach((k, i) => expect(k.nMax).toBeCloseTo(F.accessoryRpm(R.build.sys, i, nTepe), 9));
  });

  test('statik hubload: bütün açıklıklar tasarım gerginliğinde (motor durgun)', () => {
    const sys = R.build.sys;
    const g = F.tensionerState(sys, F.meanRel(sys)).geom;
    const Td = R.analysis.tensioner.tensionN;
    const h = F.hubloads(g, new Array(sys.pulleys.length).fill(Td));
    V.kas.forEach((k, i) => { expect(k.flStat).toBe(h[i].FN); expect(k.flStatYon).toBe(h[i].dirDeg); });
  });

  test('açıklık: T_maks çıkış gerilmesinin en büyüğü; f₁ ve f₁/f_ateş en küçüğü', () => {
    V.acik.forEach((a, j) => {
      expect(a.tMax).toBe(Math.max(...duty().map((d) => d.perPulley[j].exitTensionN)));
      const f = enKucuk(duty().map((d) => ({ v: d.frequencies[j].fHz[0], rpm: d.engineRpm })));
      expect(a.f1Min).toBe(f.v);
      const o = enKucuk(duty().map((d) => ({ v: d.frequencies[j].fHz[0] / d.firingHz, rpm: d.engineRpm })));
      expect(a.oranMin).toBe(o.v);
      expect(a.oranRpm).toBe(o.rpm);
    });
  });

  test('rezonans göstergesi: en küçük oran, yeri ve 1\'in altındaki hücre sayısı', () => {
    let alti = 0, hucre = 0;
    duty().forEach((d) => d.frequencies.forEach((fr) => { hucre++; if (fr.fHz[0] / d.firingHz < 1) alti++; }));
    expect(V.kpi.rez.alti).toBe(alti);
    expect(V.kpi.rez.hucre).toBe(hucre);
    expect(V.kpi.rez.oran).toBe(Math.min(...V.acik.map((a) => a.oranMin)));
    // AG00976: 72 hücrenin 2'si, AVA2 – ALT @2.750 (özet raporun hükmüyle aynı)
    expect([V.kpi.rez.alti, V.kpi.rez.hucre, V.kpi.rez.ad, V.kpi.rez.rpm]).toEqual([2, 72, 'AVA2 – ALT', 2750]);
  });

  test('göstergeler öteki belgelerle AYNI sayıyı taşır (ikinci üretici yok)', () => {
    expect(V.kpi.sf).toBe(RP._frMinSF(R));                         // kayma hükmü
    expect(V.kpi.Td).toBe(R.analysis.tensioner.tensionN);           // tasarım gerginliği
    expect(V.kpi.Lb).toBe(R.build.sys.belt.effLength);              // numara d_b'de
    // B10: manşette modelin en iyi kestirimi (özet raporun kuralı)
    const L = R.life;
    expect(V.kpi.b10).toBe(L.inValidRange ? L.hoursB10 : L.hoursB10Corrected);
    expect(V.kpi.b10Ham).toBe(L.hoursB10);
    // tepe yük özet raporun taramasından
    const pk = SU._fsrPeak(R);
    expect(V.tepe.T).toEqual(pk.rows.map((r) => r.tensionN));
    expect(V.tepe.F).toEqual(pk.rows.map((r) => r.hubloadN));
    expect(V.tepe.ivme).toBe(pk.accelRpmS);
  });

  test('çevrim satırı: P ve F_u SÜRÜCÜNÜN (çekirdeğin crank kasnağı), SF yalnız yük taşıyanlardan', () => {
    const c = R.build.sys._crkIdx;
    V.cev.forEach((row, q) => {
      const d = duty()[q];
      expect(row.P).toBe(d.perPulley[c].powerKw);
      expect(row.Fu).toBeCloseTo(d.perPulley[c].exitTensionN - d.perPulley[c].entryTensionN, 9);
      const yuklu = d.slip.filter((s) => s.tensionRatio >= RP.VE_FR_SLIP_LOADED_RATIO).map((s) => s.SF);
      expect(row.sf).toBe(Math.min(...yuklu));
    });
    // Aksesuar sütunları yük taşıyan aksesuarlar — avaralar (≈ 0 kW) düşer.
    expect(V.aks).toEqual(['KK', 'ALT']);
  });

  test('kayış eğilme frekansı köprüden: f_B = v · z / L_b', () => {
    expect(M.veFeadEgilmeFrekansi(23.67, 6, 1714.6)).toBeCloseTo(23.67 * 6 / 1.7146, 9);
    [[0, 6, 1714.6], [23.67, 0, 1714.6], [23.67, 6, 0], [NaN, 6, 1714.6], [null, 6, 1714.6]]
      .forEach((x) => expect(M.veFeadEgilmeFrekansi(...x)).toBeNaN());
    const vTepe = duty().filter((d) => d.engineRpm === V.nMax)[0].vMs;
    expect(V.kayis.fB).toBe(M.veFeadEgilmeFrekansi(vTepe, V.n, R.build.sys.belt.effLength));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('kapılar R.checks\'ten OKUNUR — yeniden hesaplanmaz (kural 16)', () => {
  test('durum ve cümle çözümün kapısından', () => {
    expect(V.kapilar.map((k) => k.durum)).toEqual([R.checks.speedLimit.durum,
      R.checks.centerDistance.durum, R.checks.ratioWindow.durum]);
    expect(V.kapilar.map((k) => k.durum)).toEqual(['ok', 'warn', 'no']);       // AG00976
    expect(V.kapilar[2].metin).toBe('ALT 5.812 < 6.000 d/d: çap küçültülmeli');
  });

  test('çözümden sonra değişen kapı sonucu değil, SONUCUN kapısı basılır', () => {
    // Sonucun kapısı değiştirilir: pano onu basmalı. Yeniden hesaplasaydı
    // canlı modelin (değişmemiş) hükmünü basardı.
    const R2 = Object.assign({}, R, { checks: JSON.parse(JSON.stringify(R.checks)) });
    R2.checks.speedLimit.durum = 'no';
    R2.checks.speedLimit.rows[0].kritik.ok = false;
    expect(PN.veFeadPanoVeri(R2, NODE).kapilar[0].durum).toBe('no');
    const R3 = Object.assign({}, R, { checks: null });
    expect(PN.veFeadPanoVeri(R3, NODE).kapilar.map((k) => k.durum)).toEqual(['wait', 'wait', 'wait']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('servis faktörü c₂ (kural 48) — satırlar tasarım yükünde, c₂ çözümden', () => {
  let R12 = null;
  beforeAll(() => { R12 = coz('AG00976_GATES_2025', { servis: 'orta.yuksek.10' }); });

  test('kayma göstergesi tasarım yükündeki satırlardan, eşik 1', () => {
    expect(R12.servis.deger).toBe(1.2);
    const V12 = PN.veFeadPanoVeri(R12, NODE);
    expect(V12.kpi.sf).toBe(RP._frMinSF(R12));
    expect(V12.kpi.sf).toBeLessThan(V.kpi.sf);              // yük büyüdü, emniyet düştü
    const h = PN.veFeadPanoHTML(R12, NODE);
    expect(h).toContain('c₂ = 1,2');
    expect(h).toContain('tasarım yükü · c₂ = 1,2');
  });

  test('seçilmemiş c₂ "seçilmedi" yazılır — varsayılan uydurulmaz', () => {
    expect(R.servis.kaynak).toBe('yok');
    expect(DOC).toContain('c₂ seçilmedi');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('belge', () => {
  test('tek sayfa, yatay A3, taşan yarım piksel yok', () => {
    expect((DOC.match(/<section class="pn/g) || []).length).toBe(1);
    expect(DOC).toMatch(/@page\{size:A3 landscape;margin:0\}/);
    expect(DOC).toContain('width:' + P.W + 'px;height:' + P.H + 'px');
    // 297 mm = 1.122,52 px — sayfa ondan UZUN olursa baskı ikinci sayfa açar
    expect(P.H).toBeLessThanOrEqual(297 / 25.4 * 96);
    expect(P.W).toBeLessThanOrEqual(420 / 25.4 * 96);
  });

  test('göstergeler Türkçe sayı yazar', () => {
    ['1.714,6', '543,9', '4,50', '2.552', '2.372', '0,85', '28,06°', 'kord 1.722,1']
      .forEach((s) => expect(DOC).toContain(s));
    expect(DOC).not.toMatch(/NaN|undefined|Infinity/);
  });

  test('geçerlilik sınırı sonucun İÇİNDE (kural 10)', () => {
    expect(DOC).toContain('<span class="dmg">kalibre değil</span>');
    expect(DOC).toContain(SU.VE_FSR_PEAK_BAND);
    expect(DOC).toContain('Yatak ve braket seçiminde tek başına kullanılmamalı.');
    // B10 çap penceresi dışında: düzeltmeli değer + ham değer yanında
    expect(R.life.inValidRange).toBe(false);
    expect(DOC).toContain('düzeltmeli · ham 1.403 h');
  });

  test('belgenin kullandığı HER var(--…) jetonu belgenin kendi CSS\'inde tanımlı', () => {
    // Çizici uygulamanın jetonlarını yazıyor; belgede tanımsız bir jeton
    // kalıtılan `stroke` için `none` demek — çizim görünmez olur, sessizce.
    // Tanım yeri iki: belgenin stil sayfası ve satır içi veri (`--sat`: orta
    // sütunun satır boyu, sayfa bütçesinden).
    const css = PN._fpnCss() + [...DOC.matchAll(/style="([^"]*)"/g)].map((m) => m[1]).join(';');
    const tanimli = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const kullanilan = new Set([...DOC.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((m) => m[1]));
    expect(kullanilan.size).toBeGreaterThan(15);
    expect([...kullanilan].filter((j) => !tanimli.has(j))).toEqual([]);
  });

  test('SVG yazısı 10 pt tabanında — kutunun ölçeğiyle çarpılınca', () => {
    let olculen = 0;
    // çizim: kutu 500 × H, viewBox W × H (meet)
    const cz = /<div class="cizim" style="height:(\d+)px">(<svg[\s\S]*?<\/svg>)/.exec(DOC);
    expect(cz).not.toBeNull();
    const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(cz[2]);
    const kC = Math.min(P.SUTUN[0] / +vb[1], +cz[1] / +vb[2]);
    [...cz[2].matchAll(/font-size="([\d.]+)"/g)].forEach((m) => { olculen++; expect(+m[1] * kC).toBeGreaterThanOrEqual(13.333); });
    // grafikler: kutu sağ sütunun eni, boyu viewBox'la orantılı
    const gr = [...DOC.matchAll(/<div class="graf" style="height:(\d+)px">(<svg[\s\S]*?<\/svg>)/g)];
    expect(gr.length).toBe(3);
    gr.forEach((g) => {
      const v2 = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(g[2]);
      const k = P.SUTUN[2] / +v2[1];
      expect(Math.abs(+v2[2] * k - +g[1])).toBeLessThanOrEqual(1);      // mektup kutusu yok
      [...g[2].matchAll(/font-size="([\d.]+)"/g)].forEach((m) => { olculen++; expect(+m[1] * k).toBeGreaterThanOrEqual(13.333); });
    });
    expect(olculen).toBeGreaterThan(60);
  });

  test('_fpnTaban yalnız YÜKSELTİR ve ikinci geçiş hiçbir şey değiştirmez', () => {
    const s = '<svg><text font-size="7">a</text><text font-size="9">b</text><text font-size="12">c</text></svg>';
    const t = PN._fpnTaban(s, 1.4822);
    expect(t).toContain('font-size="12"');
    [...t.matchAll(/font-size="([\d.]+)"/g)].forEach((m) => expect(+m[1] * 1.4822).toBeGreaterThanOrEqual(13.333));
    expect(PN._fpnTaban(t, 1.4822)).toBe(t);
  });

  test('kayış verisi kapalı: kalıbı bozulmaz, UYDURMA sayı basılmaz', () => {
    const Rn = coz('AG00976_GATES_2025', { kayisVeri: 'none' });
    const Vn = PN.veFeadPanoVeri(Rn, NODE);
    expect(Vn.kpi.b10).toBeNaN();
    expect(Vn.kpi.rez).toBeNull();
    expect(Vn.acik.every((a) => Number.isNaN(a.f1Min) && Number.isNaN(a.fStat))).toBe(true);
    const h = PN.veFeadPanoHTML(Rn, NODE);
    expect(h).toContain('Kayış verisi kapalı — açıklık frekansı üretilmedi.');
    expect((h.match(/kayış verisi kapalı/g) || []).length).toBe(2);        // B10 + rezonans
    expect(h).not.toMatch(/NaN|undefined|Infinity/);
  });

  test('çözüm yoksa belge ÜRETİLMEZ (boş belge sessiz başarısızlıktır)', () => {
    expect(PN.veFeadPanoVeri(null, NODE)).toBeNull();
    expect(PN.veFeadPanoVeri({ ok: false }, NODE)).toBeNull();
    expect(() => PN.veFeadPanoHTML({ ok: false }, NODE)).toThrow(/Çözüm yok/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('sayfa bütçesi — sütunlar gövdeye sığar', () => {
  test('gövde yüksekliği CSS\'in blok boylarından', () => {
    // .ust 56 · .cz 6+2 · .kpis 12+104 · .govde 16 → A3'ün kalanı
    expect(PN._fpnGovdeH()).toBe(P.H - 2 * P.PAY - P.UST - 8 - 12 - P.KPI - 16);
    const css = PN._fpnCss();
    expect(css).toContain('.pn .ust{height:' + P.UST + 'px');
    expect(css).toContain('.pn .kpis{height:' + P.KPI + 'px;margin-top:12px');
    expect(css).toContain('.pn .cz{height:2px;margin-top:6px');
    expect(css).toContain('.pn .govde{margin-top:16px');
  });

  test('orta sütun satır boyu sığacak kadar daralır, tabanın altına inmez', () => {
    const ol = (n, m) => PN._fpnOlcu({ n, cev: new Array(m).fill({}) });
    expect(PN._fpnOlcu(V).sat).toBe(20);                        // AG00976: 6 kasnak · 12 devir
    expect(ol(3, 6)).toMatchObject({ sat: P.SATIR, tasma: false });
    expect(ol(6, 17)).toMatchObject({ sat: P.SATIR_EN_AZ, tasma: false });   // 6 kasnak · 17 devir
    expect(ol(7, 15)).toMatchObject({ sat: P.SATIR_EN_AZ, tasma: false });   // 7 kasnak · 15 devir
    // sığmayan model KIRPILMAZ: sayfa uzar ve bunu sınıfıyla söyler
    expect(ol(12, 40)).toMatchObject({ sat: P.SATIR_EN_AZ, tasma: true });
  });

  test('sol sütun: çizim kutusu kalan yeri alır', () => {
    const O = PN._fpnOlcu(V);
    // iki künye tablosu (8 + 4 satır) ve çöken kenarlıklarının yarım pikselleri
    expect(O.cizimH).toBe(Math.floor(O.govde - 3 * P.BASLIK - 2 * P.BLOK - 12 * P.SATIR - 2 * P.TABLO_ALT));
  });

  test('bütün örnekler tek sayfaya basılır, sayı eksiksiz', () => {
    const keys = veFeadExampleKeys();
    expect(keys.length).toBeGreaterThanOrEqual(11);
    keys.forEach((k) => {
      const Rk = coz(k);
      const Vk = PN.veFeadPanoVeri(Rk, NODE);
      expect({ k, tasma: PN._fpnOlcu(Vk).tasma }).toEqual({ k, tasma: false });
      const h = PN.veFeadPanoHTML(Rk, NODE);
      expect({ k, bozuk: /NaN|undefined|Infinity/.test(h) }).toEqual({ k, bozuk: false });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('bağlantılar — tür listesi tek kaynak', () => {
  test('indirme yolu: "pano" A3 üreticisine gider, dosya adı türün eki', () => {
    const indirilen = [];
    const oTik = HTMLAnchorElement.prototype.click;
    const oURL = global.URL.createObjectURL, oRev = global.URL.revokeObjectURL;
    HTMLAnchorElement.prototype.click = function () { indirilen.push(this.download); };
    global.URL.createObjectURL = () => 'blob:x';
    global.URL.revokeObjectURL = () => {};
    window.FEAD_REPORT_TEMPLATE_B64 = 'eA==';
    window.MNT_REPORT_ASSETS = {};
    window.veFeadResults = R;
    const casus = jest.spyOn(PN, 'veFeadPanoHTML');
    const oPano = global.veFeadPanoHTML;
    global.veFeadPanoHTML = casus;
    try {
      global.nodes = [{ id: 'r9', type: 'fead-report', data: { docNo: 'FD 7', reportKind: 'pano' } }];
      expect(RP.veFeadGenerateReport('r9')).toBe(true);
      expect(casus).toHaveBeenCalledTimes(1);
      expect(indirilen[0]).toMatch(/^FD_7_A3_\d{8}\.html$/);
      global.nodes = [];
      expect(RP.veFeadGenerateReport(null, 'pano')).toBe(true);
      expect(indirilen[1]).toMatch(/^MFSim_FEAD_A3_Pano_\d{8}\.html$/);
    } finally {
      HTMLAnchorElement.prototype.click = oTik;
      global.URL.createObjectURL = oURL; global.URL.revokeObjectURL = oRev;
      global.veFeadPanoHTML = oPano;
      casus.mockRestore();
      delete window.veFeadResults; delete window.FEAD_REPORT_TEMPLATE_B64; delete window.MNT_REPORT_ASSETS;
    }
  });

  test('Rapor penceresi her türü bir kart olarak çizer', () => {
    const h = RP._frKindPicker({ id: 'n1', data: {} }, 'pano');
    RP.VE_FEAD_REPORT_KINDS.forEach((k) => expect(h).toContain("veFeadSetChoice('n1','reportKind','" + k.key + "')"));
    expect(h).toMatch(/aria-checked="true"[^>]*reportKind','pano'/);
  });

  test('Sonuçlar sekmesi her tür için bir bağlantı ve bir bant düğmesi taşır', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../js/cp-fead-results.js'), 'utf8');
    RP.VE_FEAD_REPORT_KINDS.forEach((k) => {
      const a1 = (src.match(new RegExp("veFeadGenerateReport\\(null,\\\\'" + k.key + "\\\\'\\)", 'g')) || []).length;
      const a2 = (src.match(new RegExp('veFeadGenerateReport\\(null,\'' + k.key + '\'\\)', 'g')) || []).length;
      expect({ tur: k.key, agac: a1, bant: a2 }).toEqual({ tur: k.key, agac: 1, bant: 1 });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('grafik yardımcısı — x ekseni yazı sıklığı', () => {
  test('ayar verilmezse çıktı BİREBİR eskisi; adım 2 yazıyı seyreltir, ızgarayı değil', () => {
    const esk = RP.veFeadFigureRaw(RP._frFreqFigure, R, 369, 181);
    expect(RP.veFeadFigureRaw(RP._frFreqFigure, R, 369, 181, undefined, { xEtiketAdim: 1 })).toBe(esk);
    const sey = RP.veFeadFigureRaw(RP._frFreqFigure, R, 369, 181, undefined, { xEtiketAdim: 2 });
    const yazi = (s) => (s.match(/text-anchor="middle" font-size="11"/g) || []).length;
    // ESKİ DURUM GERİ YÜKLENDİ — sızıntı RAW çağrıda görünmez (her RAW çağrı
    // adımı yeniden kurar), AYRINTILI RAPORUN hemen ardından gelen doğrudan
    // çağrısında görünür: şekil seyreltilmiş basılırdı (mutasyonla ölçüldü).
    expect(yazi(RP._frFreqFigure(R))).toBe(yazi(esk));
    const izgara = (s) => (s.match(/stroke="#e6e1d8"/g) || []).length;
    expect(izgara(sey)).toBe(izgara(esk));
    expect(yazi(esk)).toBe(9);                                   // 750 … 2.750, 250'lik adım
    expect(yazi(sey)).toBe(5);                                   // 750 · 1.250 · … · 2.750
    expect(RP.veFeadFigureRaw(RP._frFreqFigure, R, 369, 181)).toBe(esk);
  });
});
