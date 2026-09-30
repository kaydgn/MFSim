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
 * "E · Dolu pano — 8 pt" (kullanıcı kararı 2026-09-30): dört sütun, blokların
 * dizilimi ÖLÇÜMDEN (`_fpnDizilim`), tablo sütunlarının eni İÇERİKTEN
 * (`_fpnSutunlar`). Bütçe burada, gerçek yazıyla sığma e2e'de.
 *
 * Kapsam ayrımı:
 *   cp-fead-summary.test.js   özet rapor + rapor türü seçimi
 *   cp-fead-report.test.js    ayrıntılı rapor (uygunluk ve §8.18'in kendisi)
 *   BU DOSYA                  A3 pano: veri modeli · ortak üreticiler · belge · bütçe · bağlantılar
 *   tests/e2e/fead-pano.spec.js  gerçek tarayıcıda sığma, punto ve baskı
 */
const fs = require('fs');
const path = require('path');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const CK = require('../../js/fead-checks.js');
const EN = require('../../js/fead-engines.js');
const AC = require('../../js/fead-accessories.js');
const TR = require('../../js/fead-transient.js');
const SG = require('../../js/fead-signals.js');
const { motorluOrnekler } = require('../helpers/fead-motor');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.FEADCore = F;
global.veFeadSignals = SG;
[EN, AC, CK, TR].forEach((X) => Object.keys(X).forEach((k) => { global[k] = X[k]; }));
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

// Uygulamanın çözüm yolu (cp-fead.js → veFeadSolve): kapılar, imza ve
// Sonuçlar panosunun veri kümeleri çözüm anında sonuca yazılır.
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
  if (ayar.surtunme) M.veFeadSurtunmeSet(solv.data, ayar.surtunme, ayar.surtunmeDeger);
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
  R.signals = SG.build(R);
  return R;
}
const NODE = { id: 'rep1', type: 'fead-report', data: { docNo: 'FEAD-2026-001', revision: 'A', author: 'A. Kol' } };
const P = PN.VE_FEAD_PANO;
const TABAN = 32 / 3 - 0.001;              // 8 pt = 10,667 px

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
const blokSirasi = (h) => h.split('<div class="sut">').slice(1)
  .map((x) => [...x.matchAll(/data-blok="(\w+)"/g)].map((m) => m[1]));
const blokHTML = (h, id) => {
  const i = h.indexOf('data-blok="' + id + '"');
  const j = h.indexOf('<div class="blok"', i + 1);
  return h.slice(i, j < 0 ? h.length : j);
};
const metin = (h) => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

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

  test('kasnak satırı: en düşük SF kasnağın ADIYLA eşlenir, yük taşıma satırın ROLÜNDEN (kural 49)', () => {
    V.kas.forEach((k) => {
      const satir = duty().flatMap((d) => d.slip.filter((s) => s.name === k.ad).map((s) => ({ v: s.SF, rpm: d.engineRpm, y: s.yukTasir })));
      expect(satir.length).toBe(duty().length);
      const e = enKucuk(satir);
      expect(k.sfMin).toBe(e.v);
      expect(k.sfRpm).toBe(e.rpm);
      expect(k.yuklu).toBe(satir.some((s) => s.y === true));
    });
    // AG00976: FAN · KK · ALT yük taşır, avaralar ve gergi taşımaz. Gates
    // koşulunda oran eşiği (1,01) altısının beşini "yük taşıyan" sayıyordu.
    expect(V.kas.filter((k) => k.yuklu).map((k) => k.kod)).toEqual(['FAN', 'KK', 'ALT']);
    const oranla = V.kas.filter((k) => duty().some((d) => d.slip.some((s) => s.name === k.ad && s.tensionRatio >= 1.01)));
    expect(oranla.length).toBeGreaterThan(3);
  });

  test('kasnak yerleşimi: çözülmüş sistemin çapı, kord çapı ve ataleti; gergide avara merkezi (girdi)', () => {
    const sys = R.build.sys;
    V.kas.forEach((k, i) => {
      const p = sys.pulleys[i];
      expect(k.od).toBe(p.od);
      expect(k.ef).toBe(2 * p.rPitch);
      // Hesaba giren atalet (veFeadKasnakAtalet): sürücüde krank mili — rapor
      // 0,064 basarken model 0,70 ile çözüyordu (kural 43).
      expect(k.J).toBe(p.inertiaKgM2);
      expect(k.temas).toBe(p.contact === 'back' ? 'S' : 'K');
      if (p.tensioner) expect([k.x, k.y]).toEqual(R.build.center);
      else expect([k.x, k.y]).toEqual([p.x, p.y]);
    });
    expect(V.kas[0].J).toBe(0.7);
  });

  test('mil torku: çözüm anında kurulan veri kümesinden OKUNUR — bağımsız yol 9549·P/n ile aynı', () => {
    const sys = R.build.sys;
    V.kas.forEach((k, i) => {
      // Bağımsız yol: yalnız güç çeken aksesuar (sürücü hariç), aksesuar devriyle.
      const q = duty().map((d) => {
        const pp = d.perPulley[i];
        return (pp.accessoryRpm > 0) ? 9549 * pp.powerKw / pp.accessoryRpm : NaN;
      }).filter(Number.isFinite);
      const cekenMi = duty().some((d) => d.perPulley[i].powerKw > 0.05) && !sys.pulleys[i].crank;
      if (cekenMi) expect(k.qMax).toBeCloseTo(Math.max(...q), 9);
      else expect(k.qMax).toBeNaN();
    });
    expect(V.kas.map((k) => (Number.isFinite(k.qMax) ? RP._frFs(k.qMax, 1) : '—'))).toEqual(['—', '—', '32,9', '—', '14,2', '—']);
    // OKUR, hesaplamaz: kümenin kanalı değişirse pano onu basar; küme yoksa NaN.
    const R2 = Object.assign({}, R, { signals: JSON.parse(JSON.stringify(R.signals)) });
    const ds = R2.signals.find((s) => s.key === 'cevrim');
    ds.channels.filter((c) => /\.nm$/.test(c.id)).forEach((c) => { c.data = c.data.map(() => 1); });
    expect(PN.veFeadPanoVeri(R2, NODE).kas[2].qMax).toBe(1);
    expect(PN.veFeadPanoVeri(Object.assign({}, R, { signals: null }), NODE).kas[2].qMax).toBeNaN();
  });

  test('n maks: çevrimin en yüksek devrinde aksesuar devri (çekirdeğin hız oranı)', () => {
    const nTepe = Math.max(...duty().map((d) => d.engineRpm));
    expect(V.nMax).toBe(nTepe);
    V.kas.forEach((k, i) => expect(k.nMax).toBeCloseTo(F.accessoryRpm(R.build.sys, i, nTepe), 9));
  });

  test('statik hubload tasarım gerginliğinde (motor durgun); tepe hubload özet raporun taramasından', () => {
    const sys = R.build.sys;
    const g = F.tensionerState(sys, F.meanRel(sys)).geom;
    const Td = R.analysis.tensioner.tensionN;
    const h = F.hubloads(g, new Array(sys.pulleys.length).fill(Td));
    V.kas.forEach((k, i) => { expect(k.flStat).toBe(h[i].FN); expect(k.flStatYon).toBe(h[i].dirDeg); });
    const pk = SU._fsrPeak(R);
    expect(V.kas.map((k) => k.flTepe)).toEqual(pk.rows.map((r) => r.hubloadN));
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
    // kayma eşiği (ankraj) köprünün eşiğinden, yeri koduyla
    const e = veFeadSlipThreshold(R.build, duty(), R.servis && R.servis.deger);
    expect(V.kpi.esik).toEqual({ T: e.tensionN, pay: e.margin, rpm: e.engineRpm, kod: V.kod[e.index] });
    expect([RP._frFs(V.kpi.esik.T, 1), V.kpi.esik.kod, V.kpi.esik.rpm]).toEqual(['188,9', 'FAN', 2750]);
  });

  test('çevrim satırı: P ve F_u SÜRÜCÜNÜN, SF yalnız yük taşıyanlardan; açıklık gerilmeleri, kasnak başına SF, yorulma payı', () => {
    const c = R.build.sys._crkIdx;
    const sys = R.build.sys;
    V.cev.forEach((row, q) => {
      const d = duty()[q];
      expect(row.P).toBe(d.perPulley[c].powerKw);
      expect(row.Fu).toBeCloseTo(d.perPulley[c].exitTensionN - d.perPulley[c].entryTensionN, 9);
      const yuklu = d.slip.filter((s) => s.yukTasir === true).map((s) => s.SF);
      expect(row.sf).toBe(Math.min(...yuklu));
      expect(row.gerg).toEqual(d.perPulley.map((p) => p.exitTensionN));
      expect(row.tMax).toBe(Math.max(...row.gerg));
      d.slip.forEach((s) => {
        const i = sys.pulleys.findIndex((p) => p.name === s.name);
        expect([row.sfK[i], row.yukK[i]]).toEqual([s.SF, s.yukTasir === true]);
      });
      const y = R.fatigue.perLoadPct[q];
      expect(y.engineRpm).toBe(d.engineRpm);
      expect(row.yorulma).toBe(y.sharePct);
    });
    // Aksesuar sütunları yük taşıyan aksesuarlar — avaralar (≈ 0 kW) düşer.
    expect(V.aks).toEqual(['KK', 'ALT']);
  });

  test('kasnak başına SF ADLA eşlenir: slip satırlarının sırası karışsa da kasnağına düşer', () => {
    const A2 = JSON.parse(JSON.stringify(R.analysis));
    A2.duty.forEach((d) => d.slip.reverse());
    const V2 = PN.veFeadPanoVeri(Object.assign({}, R, { analysis: A2 }), NODE);
    V2.cev.forEach((row, q) => expect(row.sfK).toEqual(V.cev[q].sfK));
  });

  test('kayış eğilme frekansı köprüden: f_B = v · z / L_b', () => {
    expect(M.veFeadEgilmeFrekansi(23.67, 6, 1714.6)).toBeCloseTo(23.67 * 6 / 1.7146, 9);
    [[0, 6, 1714.6], [23.67, 0, 1714.6], [23.67, 6, 0], [NaN, 6, 1714.6], [null, 6, 1714.6]]
      .forEach((x) => expect(M.veFeadEgilmeFrekansi(...x)).toBeNaN());
    const vTepe = duty().filter((d) => d.engineRpm === V.nMax)[0].vMs;
    expect(V.kayis.fB).toBe(M.veFeadEgilmeFrekansi(vTepe, V.n, R.build.sys.belt.effLength));
  });

  test('gergi kolu zarfı: çekirdeğin konum tablosu (§8.8), çalışma konumu dâhil altı konum', () => {
    const pos = R.analysis.positions;
    expect(V.zarf.map((z) => z.konum)).toEqual(pos.map((p) => p.position));
    expect(V.zarf.length).toBe(6);
    V.zarf.forEach((z, i) => {
      const p = pos[i];
      expect([z.rel, z.abs, z.T, z.FL, z.sarim, z.Lb]).toEqual([p.relDeg, p.absDeg, p.tensionN, p.hubloadN, p.wrapDeg, p.requiredBeltMm]);
    });
    // etiketler §8.8'in sözlüğünden (tek kaynak), Mean vurgulu
    const zarf = blokHTML(DOC, 'zarf');
    expect(metin(zarf)).toContain('SerbestDeğişt.MaksMeanMinLoad');
    expect((zarf.match(/class="mean"/g) || []).length).toBe(7);          // başlık + altı satır
  });

  test('burulma: elastik modlar ve bantta kesişmeler — kaba kuvvetle yeniden kurulur', () => {
    const T = R.torsional;
    const d0 = duty()[0];
    const a = d0.firingHz * 60 / d0.engineRpm;                      // ateşleme mertebesi
    const rpms = duty().map((d) => d.engineRpm);
    const lo = Math.min(...rpms), hi = Math.max(...rpms);
    const bek = [];
    T.elasticHz.forEach((f, i) => [1, a, 2 * a, 4 * a].forEach((o) => {
      const rp = 60 * f / o;
      if (rp >= lo && rp <= hi) bek.push([i + 1, o, rp]);
    }));
    const pano = V.burulma.modlar.flatMap((md) => md.kes.map((k) => [md.mod, k.o, k.rpm]));
    expect(pano.sort((x, y) => x[2] - y[2])).toEqual(bek.sort((x, y) => x[2] - y[2]));
    expect(V.burulma.kesisim).toBe(8);
    expect(V.burulma.modlar.map((md) => md.f)).toEqual(T.elasticHz);
    V.burulma.modlar.forEach((md) => expect(md.atesRpm).toBeCloseTo(60 * md.f / a, 9));
    expect(V.gergi.kolHz).toBe(R.analysis.tensionerMode.fHz);
  });

  test('motor çevrimi: senaryo kümesi OKUNUR (çözüm anında kurulan), yeniden kurulmaz', () => {
    const ds = R.signals.find((s) => s.key === 'senaryo');
    const ch = (id) => ds.channels.find((c) => c.id === id).data;
    expect(V.senaryo.t).toBe(ds.x.data);
    expect(V.senaryo.rpm).toBe(ch('rpm'));
    expect(V.senaryo.tmax).toBe(ch('tmax'));
    expect(V.senaryo.tmin).toBe(ch('tmin'));
    expect(V.senaryo.faz).toBe(ds.meta.phases);
    const tm = ch('tmax');
    expect(tm[V.senaryo.iTepe]).toBe(Math.max(...tm));
    // Küme yoksa grafik yok, sebebi yazılı.
    const R2 = Object.assign({}, R, { signals: R.signals.filter((s) => s.key !== 'senaryo') });
    expect(PN.veFeadPanoVeri(R2, NODE).senaryo).toBeNull();
    expect(PN.veFeadPanoHTML(R2, NODE)).toContain('Senaryo çözümde yok');
    // Kümenin serisi değişirse pano onu çizer (okuma kanıtı).
    const R3 = Object.assign({}, R, { signals: JSON.parse(JSON.stringify(R.signals)) });
    R3.signals.find((s) => s.key === 'senaryo').channels.find((c) => c.id === 'tmax').data[3] = 9999;
    expect(PN.veFeadPanoHTML(R3, NODE)).toContain('tepe 9.999 N');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('uygunluk — ayrıntılı raporun ölçütleri, TEK üretici', () => {
  test('pano ayrıntılı raporun satırlarını basar: aynı ölçüt, aynı hüküm, aynı sıra', () => {
    const S = RP._frUygunlukSatirlari(R);
    expect(V.uyg).toEqual(S);
    expect(S.length).toBe(13);
    // Ayrıntılı raporun hüküm tablosu aynı satırlardan
    const tablo = /FEAD sistem uygunluk hükmü<\/caption>([\s\S]*?)<\/table>/.exec(RP._frCompliance(R))[1];
    const kriter = [...tablo.matchAll(/<tr><td class="c">\d+<\/td><td class="l">([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    expect(kriter).toEqual(S.map((s) => s.kriter));
  });

  test('kısa yazım: kasnak KODUYLA ve sayılar uzun yazımla aynı kaynaktan (AG00976)', () => {
    expect(V.uyg.map((u) => [u.durum, u.kisa, u.kisaBulgu])).toEqual([
      ['ok', 'Kapalı çevrim (Σ sarım)', '360,00°'],
      ['ok', 'Kayma emniyeti (yük taşıyan)', 'SF 4,78 · FAN @1.000'],
      ['ok', 'En küçük kasnak çapı', 'Ø57 ALT ≥ 45'],
      ['ok', 'Azami kayış hızı', '23,7 ≤ 50 m/s'],
      ['ok', 'Gergi kolu çalışma aralığı', 'θ 28,1° ∈ [0; 60,4]'],
      ['ok', 'Tasarım gerginliği ankrajı', 'yay dengesi: 544 N'],
      ['ok', 'Gergi gövdesi montaj konumu', 'pivot (−250; 110)'],
      ['ok', 'Açıklık gerginliği > 0', 'bütün açıklıklarda'],
      ['no', 'B10 çap penceresi', 'ALT Ø57 ∉ 79,6–176'],
      ['ok', 'Çalışma çevrimi kapsamı', 'Σ %100,0'],
      ['warn', 'Kasnak merkez mesafesi', 'AVA2–ALT 281,1 > 273,2'],
      ['no', 'Çevrim oranı penceresi', 'ALT 5.812 < 6.000 d/d'],
      ['ok', 'Aksesuar devir sınırı', 'ALT %4,9 pay (7.611 / 8.000)']
    ]);
    expect(DOC).toContain('<span class="ok">10 ✓</span> <span class="warn">1 ⚠</span> <span class="no">2 ✗</span>');
    expect(DOC).toContain('B10 çap penceresi · Çevrim oranı penceresi');
  });

  test('son üç satır R.checks\'ten OKUNUR — çözümden sonra değişen kapı sonucu değil, SONUCUN kapısı', () => {
    expect(V.uyg.slice(10).map((u) => u.durum)).toEqual([R.checks.centerDistance.durum,
      R.checks.ratioWindow.durum, R.checks.speedLimit.durum]);
    const R2 = Object.assign({}, R, { checks: JSON.parse(JSON.stringify(R.checks)) });
    R2.checks.speedLimit.durum = 'no';
    R2.checks.speedLimit.rows[0].kritik.ok = false;
    const u2 = PN.veFeadPanoVeri(R2, NODE).uyg[12];
    expect([u2.durum, u2.kisaBulgu]).toEqual(['no', 'ALT 7.611 > 8.000 d/d']);
    const R3 = Object.assign({}, R, { checks: null });
    expect(PN.veFeadPanoVeri(R3, NODE).uyg.slice(10).map((u) => [u.durum, u.kisaBulgu]))
      .toEqual([['wait', 'çözümde kapı yok'], ['wait', 'çözümde kapı yok'], ['wait', 'çözümde kapı yok']]);
  });

  test('§8.18\'in mertebe kesişmeleri panoyla TEK üreticiden', () => {
    const K = RP._frBurulmaKesisim(R);
    const tablo = /Mertebe kesişmeleri[\s\S]*?<\/caption>([\s\S]*?)<\/table>/.exec(RP._frTorsionalSection(R))[1];
    const satir = [...tablo.matchAll(/<tr><td class="l">(\d+)\. elastik<\/td>/g)].map((m) => +m[1]);
    expect(satir).toEqual(K.satir.map((x) => x.mod));
    expect(satir.length).toBe(V.burulma.kesisim);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('servis faktörü c₂ (kural 48) — satırlar tasarım yükünde, c₂ çözümden', () => {
  let R12 = null;
  beforeAll(() => { R12 = coz('AG00976_GATES_2025', { servis: 'orta.yuksek.10' }); });

  test('kayma göstergesi ve haritası tasarım yükündeki satırlardan, eşik 1', () => {
    expect(R12.servis.deger).toBe(1.2);
    const V12 = PN.veFeadPanoVeri(R12, NODE);
    expect(V12.kpi.sf).toBe(RP._frMinSF(R12));
    expect(V12.kpi.sf).toBeLessThan(V.kpi.sf);              // yük büyüdü, emniyet düştü
    const h = PN.veFeadPanoHTML(R12, NODE);
    expect(h).toContain('≥ 1 · c₂ = 1,2');
    expect(h).toContain('SF · c₂ = 1,2 · soluk: yük taşımaz');
    expect(h).toContain('Varsayım: c₂ = 1,2');
  });

  test('seçilmemiş c₂ "seçilmedi" yazılır — varsayılan uydurulmaz', () => {
    expect(R.servis.kaynak).toBe('yok');
    expect(DOC).toContain('≥ 1 · c₂ seçilmedi');
    expect(DOC).toContain('Varsayım: c₂ seçilmedi');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('kayma Gates koşulunda, sürtünme ÇÖZÜMÜN seçimi (kural 49)', () => {
  const kv = (h) => {
    const m = /<td class="l e">Sürtünme μ: ([^<]*)<\/td><td class="v">([^<]*)<\/td>/.exec(h);
    return m ? [m[1], m[2]] : null;
  };

  test('varsayılan Gates kalibrasyonu: ad ve üç sayı basılır', () => {
    expect(R.surtunme.anahtar).toBe('gates');
    expect(V.surtunme).toBe(R.surtunme);
    expect(kv(DOC)).toEqual(['Gates kalibrasyonu', 'oluklu 0,92 · sırt 0,60 · ℓ 7 mm']);
  });

  test('Literatür seçilirse sayılar çekirdeğin kalibrasyonundan, kayıp yazılmaz', () => {
    const RL = coz('AG00976_GATES_2025', { surtunme: 'literatur' });
    const cal = F.CALIBRATION;
    expect(RL.surtunme.anahtar).toBe('literatur');
    const h = PN.veFeadPanoHTML(RL, NODE);
    expect(kv(h)).toEqual(['Literatür', 'oluklu ' + RP._frFs(cal.muEffGrooved.value, 2)
      + ' · sırt ' + RP._frFs(cal.muBackside.value, 2)]);
    const VL = PN.veFeadPanoVeri(RL, NODE);
    expect(VL.kpi.sf).toBe(RP._frMinSF(RL));
    expect(VL.kpi.sf).not.toBe(V.kpi.sf);
  });

  test('Elle: kullanıcının üç sayısı, kayıp ondalığıyla', () => {
    const RE = coz('AG00976_GATES_2025', { surtunme: 'elle', surtunmeDeger: { muOluk: 0.85, muSirt: 0.5, kucukKasnakMm: 12.5 } });
    expect(kv(PN.veFeadPanoHTML(RE, NODE))).toEqual(['Elle', 'oluklu 0,85 · sırt 0,50 · ℓ 12,5 mm']);
  });

  test('çözümden sonra değişen seçim belgeye SIZMAZ (dondurulan R.surtunme)', () => {
    const R2 = Object.assign({}, R, { build: Object.assign({}, R.build,
      { solver: { data: Object.assign({}, R.build.solver.data, { surtunme: 'literatur' }) } }) });
    expect(kv(PN.veFeadPanoHTML(R2, NODE))[0]).toBe('Gates kalibrasyonu');
  });

  test('SF ayrıntılı raporun yazımıyla: avaranın yüzlük payı ondalıksız', () => {
    const Rk = coz('AG00879_GATES_2023');
    const Vk = PN.veFeadPanoVeri(Rk, NODE);
    const h = PN.veFeadPanoHTML(Rk, NODE);
    const hucre = [...h.matchAll(/<td class="sf">(?:<span class="no">)?([^<]*)/g)].map((m) => m[1]);
    expect(hucre).toEqual(Vk.kas.map((k) => RP._frSfYaz(k.sfMin)));
    expect(hucre.some((x) => /^\d{3}$/.test(x))).toBe(true);              // AVA: 369
  });

  test('kayma haritası: yük taşımayan soluk ve zeminsiz, yük taşıyan SF düştükçe koyulaşır, 1\'in altı kırmızı', () => {
    const satir = (h, rpm) => {
      const m = new RegExp('<tr><td>' + rpm.replace('.', '\\.') + '</td>([\\s\\S]*?)</tr>').exec(blokHTML(h, 'kay'));
      return [...m[1].matchAll(/<td(?: class="([^"]*)")?>([\s\S]*?)<\/td>/g)].map((x) => ({ c: x[1] || '', h: x[2] }));
    };
    const hucre = satir(DOC, '2.750');
    expect(hucre.length).toBe(6);
    // AVA1 · AVA2 · TEN yük taşımaz
    expect(hucre.filter((x) => /span class="dim"/.test(x.h)).map((x) => x.c)).toEqual(['', '', '']);
    // FAN 7,34 · ALT 12,0 · KK 29,3 — küçük SF daha koyu sınıf
    const isi = hucre.filter((x) => /^i\d$/.test(x.c))
      .map((x) => [parseFloat(x.h.replace(',', '.')), +x.c.slice(1)]).sort((a, b) => a[0] - b[0]);
    expect(isi.map((x) => x[1])).toEqual([3, 2, 1]);
    const A2 = JSON.parse(JSON.stringify(R.analysis));
    A2.duty[0].slip.find((s) => s.name === R.build.sys.pulleys[0].name).SF = 0.6;
    expect(blokHTML(PN.veFeadPanoHTML(Object.assign({}, R, { analysis: A2 }), NODE), 'kay'))
      .toContain('<td class="kotu"><span class="no">0,60</span></td>');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('belge', () => {
  test('tek sayfa, yatay A3, dört sütun sayfanın iç enini tam doldurur', () => {
    expect((DOC.match(/<section class="pn/g) || []).length).toBe(1);
    expect(DOC).toMatch(/@page\{size:A3 landscape;margin:0\}/);
    expect(DOC).toContain('width:' + P.W + 'px;height:' + P.H + 'px');
    // 297 mm = 1.122,52 px — sayfa ondan UZUN olursa baskı ikinci sayfa açar
    expect(P.H).toBeLessThanOrEqual(297 / 25.4 * 96);
    expect(P.W).toBeLessThanOrEqual(420 / 25.4 * 96);
    expect(P.SUTUN.length).toBe(4);
    expect(P.SUTUN.reduce((a, x) => a + x, 0) + 3 * P.ARA).toBe(P.W - 2 * P.PAY);
  });

  test('göstergeler ve başlık bloğu Türkçe sayı yazar; imza satırları künyeden', () => {
    ['1.714,6', '543,9', '4,78', '188,9', '2.552', '2.372', '0,85', '12,9', '28,06°', 'kord 1.722,1', 'pay 2,88×',
     'kol modu 27,8 Hz', 'bantta 8 kesişme', '6 kasnak · tahrik boyu 1.716,2 mm', '12 nokta · %100']
      .forEach((s) => expect(DOC).toContain(s));
    expect(DOC).not.toMatch(/NaN|undefined|Infinity/);
    const h = PN.veFeadPanoHTML(R, { id: 'r', type: 'fead-report', data: { author: 'A. Kol', checker: 'B. Kontrol', approver: 'C. Onay' } });
    expect(h).toContain('<span><i>Kontrol</i>B. Kontrol</span>');
    expect(h).toContain('<span><i>Onay</i>C. Onay</span>');
    expect(DOC).toContain('<span><i>Kontrol</i>—</span>');                 // boş: kâğıtta elle
  });

  test('Rapor penceresi Kontrol ve Onay alanlarını sorar ve düğüme YAZAR (tüketicisi A3 pano)', () => {
    const eski = window.veFeadResults;
    let panel = '';
    try {
      window.veFeadResults = R;
      panel = RP.getFeadReportPropertiesHTML({ id: 'r1', type: 'fead-report', data: {} });
    } finally { window.veFeadResults = eski; }
    expect(panel).toContain("veFeadSet('r1','checker',this.value)");
    expect(panel).toContain("veFeadSet('r1','approver',this.value)");
  });

  test('geçerlilik sınırı sonucun İÇİNDE (kural 10)', () => {
    expect(DOC).toContain('<span class="dmg">tepe: kalibre değil</span>');
    expect(DOC).toContain('Tepe @880 d/d ±1.100 d/d/s · sapma ' + SU.VE_FSR_PEAK_BAND);
    // B10 çap penceresi dışında: düzeltmeli değer + ham değer yanında, sebebi notlarda
    expect(R.life.inValidRange).toBe(false);
    expect(DOC).toContain('düzeltmeli · ham 1.403 h');
    expect(DOC).toContain('Burulma kalibre model (Gates Mode 1, RMS ~%8)');
  });

  test('tasarım notları: kullanıcının notları önce, sınırlar yapısal alanlardan; sığmayan SAYISIYLA söylenir', () => {
    expect(V.notlar.map((n) => n.metin)).toEqual([
      'Kayma: KK, ALT için tepe güç eğrisi yok — çevrim yükü %100 sayıldı.',
      'B10: ALT Ø57 çap penceresi (79,6–176 mm) dışında — göstergede düzeltmeli değer.',
      'Burulma kalibre model (Gates Mode 1, RMS ~%8); tepe yük ve motor çevrimi yarı statik.',
      'Varsayım: c₂ seçilmedi · yorulma PK-2_2p-MT3 · 90 °C.'
    ]);
    expect(V.notKalan).toBe(0);
    // Çekirdeğin cümlesi noktalı ondalıkla yazıyor ("79.6-176"); pano basmaz.
    expect(metin(DOC)).not.toContain('79.6-176');
    expect(metin(DOC)).not.toContain('d=57.0');
    const not = Array.from({ length: 12 }, (_, i) => '2026-09-' + (10 + i) + ' | Gergi montaj konumu ' + i + ' mm sola alındı');
    const dugum = { id: 'r', type: 'fead-report', data: { notes: not.join('\n') } };
    const Vn = PN.veFeadPanoVeri(R, dugum);
    expect(Vn.notlar[0].metin).toBe('2026-09-10 — Gergi montaj konumu 0 mm sola alındı');
    expect(Vn.notSatir).toBeLessThanOrEqual(P.NOT_EN_COK);
    expect(Vn.notKalan).toBeGreaterThan(0);
    expect(Vn.notKalan).toBe(12 + 4 - Vn.notlar.length);
    expect(PN.veFeadPanoHTML(R, dugum)).toContain('+' + Vn.notKalan + ' not daha — ayrıntılı raporda.');
  });

  test('belgenin kullandığı HER var(--…) jetonu belgenin kendi CSS\'inde tanımlı', () => {
    // Çizici uygulamanın jetonlarını yazıyor; belgede tanımsız bir jeton
    // kalıtılan `stroke` için `none` demek — çizim görünmez olur, sessizce.
    // Tanım yeri iki: belgenin stil sayfası ve satır içi veri (`--uzun`:
    // çevrim tablolarının satır boyu, sayfa bütçesinden).
    const css = PN._fpnCss() + [...DOC.matchAll(/style="([^"]*)"/g)].map((m) => m[1]).join(';');
    const tanimli = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const kullanilan = new Set([...DOC.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((m) => m[1]));
    expect(kullanilan.size).toBeGreaterThan(15);
    expect([...kullanilan].filter((j) => !tanimli.has(j))).toEqual([]);
  });

  test('SVG yazısı 8 pt tabanında — bloğun durduğu sütunun enine göre ölçek', () => {
    let olculen = 0;
    const tur = [];
    blokSirasi(DOC).forEach((ids, c) => ids.forEach((id) => {
      const m = /<div class="(cizim|graf)" style="height:(\d+)px">(<svg[\s\S]*?<\/svg>)/.exec(blokHTML(DOC, id));
      if (!m) return;
      tur.push(id);
      const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(m[3]);
      const k = Math.min(P.SUTUN[c] / +vb[1], +m[2] / +vb[2]);
      [...m[3].matchAll(/font-size="([\d.]+)"/g)].forEach((f) => { olculen++; expect(+f[1] * k).toBeGreaterThanOrEqual(TABAN); });
    }));
    // iki çizim (kayış yolu · hubload) ve üç grafik (gerginlik · motor çevrimi · frekans)
    expect(tur).toEqual(['yol', 'egri', 'motor', 'frek', 'hub']);
    expect(olculen).toBeGreaterThan(80);
  });

  test('HTML yazısı: gövde 8 pt; 7 pt yalnız birim satırı · alt başlık · damga', () => {
    const css = PN._fpnCss();
    expect(css).toContain('--f-govde:10.667px');
    expect(css).toContain('--f-ikincil:9.333px');
    const ikincil = [...css.matchAll(/([^{}\n]+)\{[^}]*font-size:var\(--f-ikincil\)/g)].map((m) => m[1].trim());
    expect(ikincil.sort()).toEqual(['.pn .dmg', '.pn h2 small', '.pn th i']);
    // Piksel yazılı başka yazı boyu yok — yalnız jetonlar
    expect(css.replace(/--f-[\w-]+:[\d.]+px/g, '').replace(/--fs-[\w-]+:[\d.]+px/g, '')).not.toMatch(/font-size:\s*[\d.]+px/);
  });

  test('_fpnTaban yalnız YÜKSELTİR ve ikinci geçiş hiçbir şey değiştirmez', () => {
    const s = '<svg><text font-size="7">a</text><text font-size="9">b</text><text font-size="12">c</text></svg>';
    const t = PN._fpnTaban(s, 1.1856);
    expect(t).toContain('font-size="12"');
    [...t.matchAll(/font-size="([\d.]+)"/g)].forEach((m) => expect(+m[1] * 1.1856).toBeGreaterThanOrEqual(TABAN));
    expect(PN._fpnTaban(t, 1.1856)).toBe(t);
  });

  test('kayış yolu çiziminde sarım açısı YOK (β kasnak tablosunda); kasnak adı 8 pt', () => {
    const yol = blokHTML(DOC, 'yol');
    expect(yol).not.toContain('data-ve="wrap"');
    expect(yol).toContain('data-ve="name"');
    expect(yol).toContain('data-ve="span-tension"');
    expect(metin(blokHTML(DOC, 'kas'))).toMatch(/β\[°\]/);
    expect(P.TABAN / P.CIZIM_YAZI * 9).toBeGreaterThanOrEqual(TABAN);
  });

  test('kayış verisi kapalı: kalıbı bozulmaz, UYDURMA sayı basılmaz', () => {
    const Rn = coz('AG00976_GATES_2025', { kayisVeri: 'none' });
    const Vn = PN.veFeadPanoVeri(Rn, NODE);
    expect(Vn.kpi.b10).toBeNaN();
    expect(Vn.kpi.rez).toBeNull();
    expect(Vn.acik.every((a) => Number.isNaN(a.f1Min) && Number.isNaN(a.fStat))).toBe(true);
    expect(Vn.cev.every((c) => Number.isNaN(c.yorulma))).toBe(true);
    const h = PN.veFeadPanoHTML(Rn, NODE);
    expect(h).toContain('Kayış verisi kapalı — açıklık frekansı üretilmedi.');
    expect((h.match(/kayış verisi kapalı/g) || []).length).toBe(2);        // B10 + rezonans
    // Yorulma sütunu verisi yoksa açılmaz; frekans bloğu nottur, çizim değil
    expect(blokHTML(h, 'cev')).not.toContain('Yorulma');
    expect(blokHTML(h, 'frek')).not.toContain('<svg');
    // değerlendirilemeyen ölçüt göstergenin DEĞERİNE değil alt satırına:
    // dört grup gösterge kutusuna sığmıyordu (ölçüldü, 149 / 144 px)
    const uygKpi = /<span class="k">Uygunluk \(13 ölçüt\)<\/span><b>([\s\S]*?)<\/b><span class="s">([\s\S]*?)<\/span>/.exec(h);
    expect(uygKpi[1]).toBe('<span class="ok">10 ✓</span> <span class="warn">1 ⚠</span> <span class="no">1 ✗</span>');
    expect(uygKpi[2]).toContain('1 değerlendirilemedi');
    expect(h).not.toMatch(/NaN|undefined|Infinity/);
  });

  test('çözüm yoksa belge ÜRETİLMEZ (boş belge sessiz başarısızlıktır)', () => {
    expect(PN.veFeadPanoVeri(null, NODE)).toBeNull();
    expect(PN.veFeadPanoVeri({ ok: false }, NODE)).toBeNull();
    expect(() => PN.veFeadPanoHTML({ ok: false }, NODE)).toThrow(/Çözüm yok/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('tablo üreticisi — sütun eni İÇERİKTEN', () => {
  test('yazı tahmini: rakam tabular (0,648 em), alt indis 0,72 em, kalın karakter başına ek; %3 geniş', () => {
    expect(PN._fpnYaziGen('1.000', 10)).toBeCloseTo((4 * 0.648 + 0.28) * 10 * 1.03, 9);
    expect(PN._fpnYaziGen('P<sub>maks</sub>', 10)).toBeCloseTo(PN._fpnYaziGen('P', 10) + PN._fpnYaziGen('maks', 7.2), 9);
    expect(PN._fpnYaziGen('T', 10, true) - PN._fpnYaziGen('T', 10)).toBeCloseTo(0.07 * 10 * 1.03, 9);
    expect(PN._fpnYaziGen('a', 10, true) - PN._fpnYaziGen('a', 10)).toBeCloseTo(0.03 * 10 * 1.03, 9);
    expect(PN._fpnYaziGen('<b>x</b>&amp;', 10)).toBeCloseTo(PN._fpnYaziGen('x&', 10), 9);
  });

  test('toplam sütunun eni; ihtiyaç yazı + dolgu + 1 px; sığmazsa en büyük önceliğin GRUBU birlikte düşer', () => {
    const kol = (b, h, ek) => Object.assign({ b, u: '', h }, ek || {});
    const S = PN._fpnSutunlar([kol('n', ['1.000']), kol('P', ['11,45'])], 200);
    expect(S.gen.reduce((a, x) => a + x, 0)).toBe(200);
    expect(S.gen[0] - 6).toBeGreaterThanOrEqual(PN._fpnYaziGen('1.000', P.TABAN) + 1);
    const K = () => [kol('a', ['1.000.000']), kol('b', ['1.000.000'], { dus: 1 }),
      kol('c', ['1.000.000'], { dus: 1 }), kol('d', ['1.000.000'], { dus: 2 })];
    const w = PN._fpnSutunlar(K(), 1000).kol[0]._w;                       // bir sütunun ihtiyacı
    expect(PN._fpnSutunlar(K(), 4 * w).kol.map((k) => k.b)).toEqual(['a', 'b', 'c', 'd']);
    expect(PN._fpnSutunlar(K(), 4 * w - 1).kol.map((k) => k.b)).toEqual(['a', 'b', 'c']);
    expect(PN._fpnSutunlar(K(), 3 * w - 1).kol.map((k) => k.b)).toEqual(['a']);
    // CSS'in eklediği dolgu ihtiyaca girer (gergi künyesinin ikinci etiketi)
    const p0 = PN._fpnSutunlar([kol('x', ['Göbek yükü'])], 500).kol[0]._w;
    const p7 = PN._fpnSutunlar([kol('x', ['Göbek yükü'], { pad: 7 })], 500).kol[0]._w;
    expect(p7 - p0).toBe(7);
  });

  test('çevrim tablosu sığmazsa önce T_maks, sonra aksesuar sütunları BİRLİKTE düşer — toplam güç kalır', () => {
    // AG00976: iki aksesuar sığar, T_maks (ısı haritasının satır tepesi) düşer.
    expect(metin(blokHTML(DOC, 'cev'))).toMatch(/KK\[kW\]ALT\[kW\]P\[kW\]/);
    expect(blokHTML(DOC, 'cev')).not.toContain('T<sub>maks</sub>');
    // Tek aksesuarlı AG00810: hepsi sığar.
    expect(blokHTML(PN.veFeadPanoHTML(coz('AG00810_GATES_2021'), NODE), 'cev')).toContain('T<sub>maks</sub>');
    const Vc = Object.assign({}, V, { aks: ['A1', 'A2', 'A3', 'A4'],
      cev: V.cev.map((c) => Object.assign({}, c, { kw: [11.11, 22.22, 33.33, 44.44] })) });
    const h = PN._fpnCevrim(Vc, 363);
    expect(h).not.toContain('T<sub>maks</sub>');
    expect(h).not.toContain('A1');
    expect(metin(h)).toMatch(/P\[kW\]/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('sayfa bütçesi — dört sütun, dizilim ölçümden', () => {
  test('gövde yüksekliği ve blok boyları CSS\'le birebir', () => {
    // .ust 54 · .cz 4+2 · .kpis 10+73 · .govde 10 → A3'ün kalanı
    expect(PN._fpnGovdeH()).toBe(P.H - 2 * P.PAY - P.UST - 6 - 10 - P.KPI - 10);
    const css = PN._fpnCss();
    expect(css).toContain('.pn .ust{height:' + P.UST + 'px');
    expect(css).toContain('.pn .kpis{height:' + P.KPI + 'px;margin-top:10px');
    expect(css).toContain('.pn .cz{height:2px;margin-top:4px');
    expect(css).toContain('.pn .govde{margin-top:10px');
    expect(css).toContain('.pn h2{height:' + (P.BASLIK - 3) + 'px;margin:0 0 3px');
    expect(css).toContain('.pn th{height:' + P.TH + 'px');
    expect(css).toContain('.pn td{height:' + P.SATIR + 'px');
    expect(css).toContain('.pn .sut{display:flex;flex-direction:column;gap:' + P.BLOK + 'px');
    expect(css).toContain('.pn .not{margin:0;height:' + P.NOT + 'px');
    expect(css).toContain('.pn .notlar li{line-height:' + P.MADDE + 'px}');
  });

  test('bloğun boyu: başlık + tablo (başlık satırı + satırlar + çöken kenarın yarısı) + not', () => {
    const bl = PN._fpnBloklar(V, 16);
    const h = (id) => bl.find((b) => b.id === id).h;
    expect(h('kas')).toBe(P.BASLIK + P.TH + 6 * P.SATIR + P.TABLO_ALT);
    expect(h('cev')).toBe(P.BASLIK + P.TH + 12 * 16 + P.TABLO_ALT);
    expect(h('yer')).toBe(P.BASLIK + P.TH + 6 * P.SATIR + P.TABLO_ALT + P.NOT);
    expect(h('kayis')).toBe(P.BASLIK + 8 * P.SATIR + P.TABLO_ALT);
    expect(h('uyg')).toBe(P.BASLIK + 13 * P.SATIR + P.TABLO_ALT);
    expect(h('hub')).toBe(P.BASLIK + P.TH + 6 * P.SATIR + P.TABLO_ALT + P.NOT);
    expect(h('not')).toBe(P.BASLIK + V.notSatir * P.MADDE);
    expect(bl.filter((b) => b.esnek).map((b) => b.id)).toEqual(['yol', 'egri', 'motor', 'frek', 'hub']);
  });

  test('AG00976 tasarımın dizilişinde: ev sütunları, çevrim satırı 16 px, sütun başına boşluk ≤ 16 px', () => {
    const O = PN._fpnOlcu(V);
    expect(O.tasma).toBe(false);
    expect(O.uzun).toBe(16);
    expect(O.sutunlar.map((s) => s.blok.map((b) => b.id))).toEqual([
      ['yol', 'yer', 'acik', 'kayis'], ['kas', 'cev', 'gerg', 'kay'],
      ['gergi', 'zarf', 'egri', 'motor', 'bur'], ['frek', 'hub', 'uyg', 'not']]);
    expect(blokSirasi(DOC)).toEqual(O.sutunlar.map((s) => s.blok.map((b) => b.id)));
    O.sutunlar.forEach((s) => {
      expect(s.bos).toBeGreaterThanOrEqual(0);
      expect(s.bos).toBeLessThanOrEqual(16);
      expect(s.dolu + s.bos).toBeCloseTo(O.govde, 6);
    });
    expect(DOC).toContain('--uzun:16px');
    expect(DOC).toContain('<div class="govde" style="height:' + O.govde + 'px">');
  });

  test('dağıtım: esnek kutular tercihleri oranında, [en az, en çok] içinde', () => {
    const E = [{ min: 100, pref: 200, max: 300 }, { min: 100, pref: 100, max: 150 }];
    expect(PN._fpnDagit(E, 300)).toEqual([200, 100]);
    expect(PN._fpnDagit(E, 600)).toEqual([300, 150]);                       // ikisi de tavanda
    expect(PN._fpnDagit(E, 230)).toEqual([130, 100]);                       // ikincisi tabanda
    const E2 = [{ min: 100, pref: 200, max: 300 }, { min: 100, pref: 100, max: 120 }];
    expect(PN._fpnDagit(E2, 420)).toEqual([300, 120]);                      // tavandaki sabitlenir, kalan ötekine
  });

  test('eşit boşluklu bölümlerden tasarımın (ev) sütunları seçilir', () => {
    // Beş esnek blok, dört sütun: dört bölümün dördü de sütunu tam doldurur ve
    // birer sütunda iki blok taşır — ayıran tek şey ev sütunu.
    const E = { min: 10, pref: 100, max: 1000 };
    const bl = [['a', 0], ['b', 1], ['c', 1], ['d', 2], ['e', 3]].map(([id, ev]) => ({ id, ev, h: 0, esnek: E }));
    const d = PN._fpnDizilim(bl, 100);
    expect(d.sutunlar.map((s) => bl.slice(s.a, s.b).map((b) => b.id))).toEqual([['a'], ['b', 'c'], ['d'], ['e']]);
  });

  test('dizilim BİTİŞİK: sütun sırası okuma sırasıdır; hiçbir bölüm sığmazsa null', () => {
    const bl = PN._fpnBloklar(V, 16);
    const d = PN._fpnDizilim(bl, PN._fpnGovdeH());
    const sira = [];
    d.sutunlar.forEach((s) => { for (let i = s.a; i < s.b; i++) sira.push(bl[i].id); });
    expect(sira).toEqual(bl.map((b) => b.id));
    expect(PN._fpnDizilim(bl, 300)).toBeNull();
  });

  test('küçük modelde blok komşu sütuna kayar ve satır büyür — sütun boş kalmaz', () => {
    const R6 = coz('AG00686_1475_GATES_2023');
    const O = PN._fpnOlcu(PN.veFeadPanoVeri(R6, NODE));
    expect(O.tasma).toBe(false);
    expect(O.uzun).toBeGreaterThan(16);
    expect(O.sutunlar[1].blok.map((b) => b.id)).toContain('kayis');         // ev sütunu 0'dı
    O.sutunlar.forEach((s) => expect(s.bos).toBeLessThanOrEqual(45));
  });

  test('uzun çevrim: satır 14 px\'e iner; sığmayan model KIRPILMAZ, sayfa uzar ve bunu söyler', () => {
    const cogalt = (m) => Object.assign({}, V, { cev: Array.from({ length: m }, (_, i) => V.cev[i % V.cev.length]) });
    expect(PN._fpnOlcu(cogalt(14))).toMatchObject({ tasma: false, uzun: 14 });
    const O30 = PN._fpnOlcu(cogalt(30));
    expect(O30).toMatchObject({ tasma: true, uzun: 14, sayfa: 2 });
    // taşan sayfada ev dizilişi — tablo kesilmez, sayfa uzar
    expect(O30.sutunlar[1].blok.map((b) => b.id)).toEqual(['kas', 'cev', 'gerg', 'kay']);
  });

  test('bütün örnekler tek sayfaya basılır, sayı eksiksiz, sütun boşluğu ≤ 45 px', () => {
    const keys = veFeadExampleKeys();
    expect(keys.length).toBeGreaterThanOrEqual(11);
    keys.forEach((k) => {
      const Rk = coz(k);
      const Vk = PN.veFeadPanoVeri(Rk, NODE);
      const O = PN._fpnOlcu(Vk);
      expect({ k, tasma: O.tasma }).toEqual({ k, tasma: false });
      O.sutunlar.forEach((s, i) => expect({ k, i, bos: s.bos <= 45 }).toEqual({ k, i, bos: true }));
      const h = PN.veFeadPanoHTML(Rk, NODE);
      expect({ k, bozuk: /NaN|undefined|Infinity/.test(h) }).toEqual({ k, bozuk: false });
      expect({ k, blok: blokSirasi(h).flat().length }).toEqual({ k, blok: 17 });
      // Yük taşıma satırın ROLÜNDEN — oran eşiği AG00686'da gergiyi (SF 5,37)
      // yük taşıyan sayar ve çevrimin en düşüğü olarak basardı.
      const d = Rk.analysis.duty;
      Vk.kas.forEach((q) => expect({ k, kod: q.kod, y: q.yuklu })
        .toEqual({ k, kod: q.kod, y: d.some((r) => r.slip.some((s) => s.name === q.ad && s.yukTasir === true)) }));
      Vk.cev.forEach((c, i) => {
        const y = d[i].slip.filter((s) => s.yukTasir === true).map((s) => s.SF);
        expect({ k, rpm: c.rpm, sf: c.sf }).toEqual({ k, rpm: c.rpm, sf: y.length ? Math.min(...y) : NaN });
      });
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
