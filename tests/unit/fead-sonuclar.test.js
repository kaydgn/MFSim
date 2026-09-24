/**
 * fead-sonuclar.test.js — FEAD SONUÇLAR SEKMESİNİN VERİ KATMANI + dört kusur
 *
 * Sonuçlar sayfasının FEAD sekmesi (js/fead-signals.js · js/fead-brief.js ·
 * js/cp-fead-results.js) çözücünün hesapladığı ama çoğu yalnız tablo olarak
 * ya da HİÇ görünmeyen büyüklükleri süpürülebilir eksenlere döküyor. Bu dosya
 * iki şeyi kilitler:
 *
 *   1) DÖRT ÖLÇÜLMÜŞ KUSURUN KAPISI (her biri düzeltme geri alınınca düştü):
 *        • "Son hesap" satırı çözümden sonra da "yok" diyordu
 *        • sonuç model değişince BAYAT olduğunu söylemiyordu
 *        • kayış verisi KAPALIYKEN senaryo açıklık frekansı üretip
 *          "⚠ REZONANS" yazıyordu (panel "üretilmiyor" derken)
 *        • (dördüncüsü — "Sonuçları Temizle" — fead-sonuclar-sekme.test.js'te)
 *
 *   2) PANO SAYI ÜRETMEZ, OKUR: kanalların değerleri çözümün kendi
 *      sayılarıyla BİREBİR; tarama raporunkiyle aynı ızgara; özetin kayma
 *      hükmü raporun `_frSlipStats` kümesiyle aynı. Ayrışma sessiz olurdu —
 *      iki yüzey kendi başına tutarlı görünür.
 */
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const rapor = require('../../js/cp-fead-report.js');
const ozet = require('../../js/cp-fead-summary.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const TR = require('../../js/fead-transient.js');

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
  return { R, sv };
}
const kume = (R, k) => R.signals.find((d) => d.key === k);
const kanal = (ds, id) => ds.channels.find((c) => c.id === id);
const ORNEKLER = M.veFeadExampleKeys();

// ════════════════════════════════════════════════════════════════════════════
//  KUSUR 1 — "Son hesap" satırı
// ════════════════════════════════════════════════════════════════════════════
describe('KUSUR 1 · çözücü penceresinin "Son hesap" satırı SONUCUN kendisinden', () => {
  const sonHesap = (html) => {
    const i = html.indexOf('Son hesap');
    const m = /value="([^"]*)"/.exec(html.slice(i, i + 200));
    return m ? m[1] : null;
  };
  test('çözümden ÖNCE "yok", SONRA "güncel" — sonuç düğüme göre anahtarlı bir sözlük DEĞİL', () => {
    kur();
    const sv = global.nodes.find((n) => n.type === 'fead-solver');
    expect(sonHesap(fead.getFeadSolverPropertiesHTML(sv))).toBe('yok');
    fead.veFeadSolve(sv.id);
    global.veFeadResults = window.veFeadResults;
    // Eski kod `veFeadResults[node.id]` arıyordu → her zaman "yok" (ölçüldü).
    expect(sonHesap(fead.getFeadSolverPropertiesHTML(sv))).toBe('güncel');
  });
  test('BAŞKA bir çözücünün sonucu bu çözücünün "son hesabı" değildir', () => {
    kur();
    const sv = global.nodes.find((n) => n.type === 'fead-solver');
    fead.veFeadSolve(sv.id);
    global.veFeadResults = window.veFeadResults;
    const baska = { id: 'baska-cozucu', type: 'fead-solver', data: {} };
    expect(fead.veFeadResultState(null, baska.id).k).toBe('yok');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  KUSUR 2 — sonuç BAYATLADIĞINI söylemiyordu
// ════════════════════════════════════════════════════════════════════════════
describe('KUSUR 2 · sonuç hangi modele ait — model değişince BAYAT', () => {
  test('çözüm bir model İMZASI taşır ve hemen sonra "güncel"dir', () => {
    const { R } = coz();
    expect(R.sig).toMatch(/^[0-9a-f]{8}$/);
    expect(R.solvedAt).toBeGreaterThan(0);
    expect(fead.veFeadResultState(R).k).toBe('guncel');
  });

  test('sürücü çapı değişince BAYAT — ve sayılar gerçekten eskiyor (%8)', () => {
    const { R, sv } = coz();
    const drv = global.nodes.find((n) => n.data && n.data.driver);
    drv.data.od = +(drv.data.od * 1.1).toFixed(2);
    expect(fead.veFeadResultState(R).k).toBe('bayat');
    // Ölçülen fark: kapının neden var olduğunun kanıtı, eşik değil.
    const guncel = M.veFeadAnalyze(M.veFeadBuildFromCanvas(), { rows: M.veFeadDutyRows(sv) });
    const eski = R.analysis.duty[0].perPulley[0].exitTensionN;
    const yeni = guncel.analysis.duty[0].perPulley[0].exitTensionN;
    expect(Math.abs(yeni - eski) / eski).toBeGreaterThan(0.05);
    // Çözücü penceresi bunu SÖYLER.
    const h = fead.getFeadSolverPropertiesHTML(sv);
    expect(h).toMatch(/BAYAT — model değişti/);
    expect(h).toMatch(/Model çözümden sonra değişti/);
  });

  test('çevrim satırı değişince de BAYAT (çözücünün verisi imzada)', () => {
    const { R, sv } = coz();
    sv.data.duty[0].dcPct = Number(sv.data.duty[0].dcPct) + 1;
    expect(fead.veFeadResultState(R).k).toBe('bayat');
  });

  test('GÖRÜNÜM değişikliği bayatlatmaz: kanvasın katmanı, rapor künyesi, sihirbaz', () => {
    const { R } = coz();
    const lay = global.nodes.find((n) => n.type === 'fead-layout');
    lay.data.kat = { ad: false };
    lay.data.animRpm = 'scn';
    const rep = global.nodes.find((n) => n.type === 'fead-report');
    if (rep) rep.data.docNo = 'X-1';
    expect(fead.veFeadResultState(R).k).toBe('guncel');
  });

  test('alan SIRASI imzayı değiştirmez (geri yüklenen düğüm aynı anlam)', () => {
    kur();
    const s1 = M.veFeadModelSig(global.nodes);
    global.nodes.forEach((n) => {
      const d = n.data || {};
      n.data = Object.keys(d).reverse().reduce((o, k) => { o[k] = d[k]; return o; }, {});
    });
    expect(M.veFeadModelSig(global.nodes)).toBe(s1);
  });

  test('modeli projede olmayan sonuç "kayıp" — sessizce "güncel" DEMEZ', () => {
    const { R } = coz();
    global.nodes = [];
    expect(fead.veFeadResultState(R).k).toBe('kayip');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  KUSUR 3 — kayış verisi kapısı iki yüzeyde ayrışıyordu
// ════════════════════════════════════════════════════════════════════════════
describe('KUSUR 3 · kayış verisi KAPALIYKEN hiçbir yüzey açıklık frekansı üretmez', () => {
  // Ölçülen kusur: çözüm frekansları siliyor, panel "üretilmiyor" diyordu;
  // senaryo aynı frekansı katalog birim kütlesinden yeniden kurup 11 örneğin
  // 11'inde 401 karenin 29…223'ünde "⚠ REZONANS" yazıyordu.
  test.each(ORNEKLER)('%s — varsayılan KAPALI: senaryo durumu frekans taşımıyor, HUD rezonans yazmıyor', (key) => {
    const { R } = coz(key);
    expect(R.beltDataMode).toBe('none');
    expect(R.analysis.duty[0].frequencies).toBeUndefined();
    const scn = TR.veFeadScenarioBuild(R.build);
    expect(scn.fOff).toBe(true);
    let rez = 0;
    for (let i = 0; i <= 200; i++) {
      const st = TR.veFeadScnStateAt(scn, scn.T * i / 200 * 0.9999);
      expect(st.spanF).toEqual([]);
      if (/REZONANS/.test(fead._feadScnHud(scn, st))) rez++;
    }
    expect(rez).toBe(0);
  });

  test('AÇIKKEN frekans var ve rezonans HÂLÂ bulunuyor (kapı her şeyi susturmuyor)', () => {
    const { R } = coz('AG00976_GATES_2025', 'full');
    const scn = TR.veFeadScenarioBuild(R.build);
    expect(scn.fOff).toBe(false);
    let rez = 0;
    for (let i = 0; i <= 200; i++) {
      const st = TR.veFeadScnStateAt(scn, scn.T * i / 200 * 0.9999);
      if (/REZONANS/.test(fead._feadScnHud(scn, st))) rez++;
    }
    expect(rez).toBeGreaterThan(0);
  });

  test('kartın ÇIRPMA katmanı da aynı kapıdan: kapalıyken yük yok, seçenek seçilemez', () => {
    kur();
    const b = M.veFeadBuildFromCanvas();
    expect(M.veFeadVibSpanPayload(b, 2750, 0.00717, 6)).toBeNull();
    kur('AG00976_GATES_2025', 'full');
    expect(M.veFeadVibSpanPayload(M.veFeadBuildFromCanvas(), 2750, 0.00717, 6)).not.toBeNull();
  });

  test('Sonuçlar panosu da kapıyı izler: kapalıyken frekans KANALI yok, açıkken var', () => {
    const kapali = coz('AG00976_GATES_2025').R;
    const ids = (R) => R.signals.reduce((a, d) => a.concat(d.channels.map((c) => d.key + '/' + c.id)), []);
    expect(ids(kapali).filter((x) => /\.f1$/.test(x))).toEqual([]);
    const acik = coz('AG00976_GATES_2025', 'full').R;
    const f1 = ids(acik).filter((x) => /\.f1$/.test(x));
    expect(f1.some((x) => x.indexOf('cevrim/') === 0)).toBe(true);
    expect(f1.some((x) => x.indexOf('campbell/') === 0)).toBe(true);
    expect(f1.some((x) => x.indexOf('senaryo/') === 0)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  PANO SAYI ÜRETMEZ, OKUR
// ════════════════════════════════════════════════════════════════════════════
describe('veri kümeleri — çözümün KENDİ sayıları', () => {
  test.each(ORNEKLER)('%s — dört küme, her kanal X ile aynı uzunlukta, kimlikler tekil', (key) => {
    const { R } = coz(key);
    expect(R.signals.map((d) => d.key)).toEqual(['cevrim', 'campbell', 'kol', 'senaryo']);
    R.signals.forEach((ds) => {
      expect(S.isFeadSensor(ds.sensorId)).toBe(true);
      const n = ds.x.data.length;
      const gor = {};
      ds.channels.forEach((c) => {
        expect(c.data.length).toBe(n);
        expect(gor[c.id]).toBeUndefined();
        gor[c.id] = 1;
        // Tamamı NaN bir kanal boş bir şerit çizer — o kanal hiç kurulmamalıydı.
        expect(c.data.some((v) => Number.isFinite(v))).toBe(true);
      });
      // Gruplar kümenin kanallarını BİRER kez kapsar
      const grp = ds.groups.reduce((a, g) => a.concat(g.ids), []);
      expect(grp.slice().sort()).toEqual(ds.channels.map((c) => c.id).sort());
    });
  });

  test('çevrim: gerginlik · hubload · SF · devir çözümle BİREBİR (devre göre sıralı)', () => {
    const { R } = coz();
    const ds = kume(R, 'cevrim');
    const P = S._pulleys(R);
    const rows = R.analysis.duty.slice().sort((a, b) => a.engineRpm - b.engineRpm);
    expect(ds.x.data).toEqual(rows.map((d) => d.engineRpm));
    P.forEach((p) => {
      expect(kanal(ds, p.key + '.T').data).toEqual(rows.map((d) => d.perPulley[p.i].exitTensionN));
      expect(kanal(ds, p.key + '.hub').data).toEqual(rows.map((d) => d.hubloads[p.i].FN));
      expect(kanal(ds, p.key + '.rpm').data).toEqual(rows.map((d) => d.perPulley[p.i].accessoryRpm));
      const sf = kanal(ds, p.key + '.sf');
      if (sf) expect(sf.data).toEqual(rows.map((d) => d.slip[p.i].SF));
      const nm = kanal(ds, p.key + '.nm');
      if (nm) expect(nm.data).toEqual(rows.map((d) =>
        9549 * d.perPulley[p.i].powerKw / d.perPulley[p.i].accessoryRpm));   // raporun (5.1)'i
    });
  });

  test('kayma: yalnız YÜK TAŞIYANLAR — avaranın "SF"si kapasitedir, kanal kurulmaz', () => {
    const { R } = coz();
    const ds = kume(R, 'cevrim');
    const avara = S._pulleys(R).filter((p) => /Avara/.test(p.name));
    expect(avara.length).toBeGreaterThan(0);
    avara.forEach((p) => expect(kanal(ds, p.key + '.sf')).toBeUndefined());
  });

  test.each(ORNEKLER)('%s — özetin kayma hükmü RAPORUN kümesiyle aynı sayı (_frSlipStats)', (key) => {
    const { R } = coz(key);
    const st = rapor._frSlipStats(R);
    const rapSF = st.anyLoaded ? st.loadedMin : st.min;
    const k = S.summary(R).find((x) => x.k === 'kayma');
    expect(k.deger).toBe(rapSF.toFixed(2).replace('.', ','));
    const sfmin = kanal(kume(R, 'cevrim'), 'sfmin');
    expect(Math.min(...sfmin.data)).toBeCloseTo(rapSF, 12);
  });

  test('gergi kolu taraması RAPORUN ızgarası: tek kaynak (veFeadArmSweep)', () => {
    const { R } = coz();
    const ds = kume(R, 'kol');
    const sw = rapor._frArmSweep(R);
    expect(ds.x.data).toEqual(sw.pts.map((p) => p.rel));
    // Kesim noktasına dek gerginlik çekirdeğin tensionerState'i
    const T = kanal(ds, 'T').data;
    sw.pts.forEach((p, i) => {
      if (Number.isFinite(T[i])) expect(T[i]).toBe(F.tensionerState(R.build.sys, p.rel).tensionN);
    });
    // Tekilleşen uç KESİLİR (raporun kuralı: konum gerginliklerinin 1,6 katı)
    expect(T.some((v) => !Number.isFinite(v))).toBe(true);
    expect(Math.max(...T.filter(Number.isFinite))).toBeLessThan(ds.meta.tCap * 1.25);
  });

  test('Campbell: mertebeler iki rapor kümesinin BİRLEŞİMİ, kesişimler doğru üzerinde', () => {
    const { R } = coz();
    const ds = kume(R, 'campbell');
    expect(ds.meta.orders.map((o) => o.o)).toEqual([1, 3, 6, 9, 12]);   // 6 silindir
    expect(ds.meta.crossings.length).toBeGreaterThan(0);
    ds.meta.crossings.forEach((c) => {
      expect(c.o * c.rpm / 60).toBeCloseTo(c.f, 9);
      expect(c.rpm).toBeGreaterThanOrEqual(ds.meta.rpmLo);
      expect(c.rpm).toBeLessThanOrEqual(ds.meta.rpmHi);
    });
    // Burulma modları R.torsional'dan birebir
    expect(ds.meta.modes).toEqual(R.torsional.elasticHz);
  });

  test('senaryo: devir ve gerginlik fead-transient\'in KENDİ durumu, son örnek sarılmaz', () => {
    const { R } = coz();
    const ds = kume(R, 'senaryo');
    const scn = TR.veFeadScenarioBuild(R.build);
    const n = ds.x.data.length;
    // Son örnek STOP fazında kalır: veFeadScnStateAt döngüsel (t mod T) ve
    // t = T'yi 0'a — "Durgun"a — sarardı. Zaman ızgarası ms'ye yuvarlı.
    const tSon = Math.min(ds.x.data[n - 1], scn.T * (1 - 1e-9));
    const son = TR.veFeadScnStateAt(scn, tSon);
    expect(kanal(ds, 'rpm').data[n - 1]).toBe(son.rpm);
    expect(son.faz).toBe('stop');
    expect(TR.veFeadScnStateAt(scn, scn.T).faz).toBe('off');   // sarılan hâl
    const orta = Math.floor(n / 2);
    expect(kanal(ds, 'rpm').data[orta]).toBe(TR.veFeadScnStateAt(scn, ds.x.data[orta]).rpm);
  });

  test('kimlik KONUMDAN değil ADDAN: kasnak yeniden adlandırılınca kanal düşer, başkasına bağlanmaz', () => {
    const a = coz().R;
    const id0 = kume(a, 'cevrim').channels.find((c) => /\.hub$/.test(c.id)).id;
    const alt = global.nodes.find((n) => n.customName === 'Alternatör (155 A)');
    alt.customName = 'Alternatör (220 A)';
    const sv = global.nodes.find((n) => n.type === 'fead-solver');
    const b = fead.veFeadSolve(sv.id);
    const ids = kume(b, 'cevrim').channels.map((c) => c.id);
    expect(ids).toContain(id0);   // ilk kasnak (sürücü) aynı adda
    expect(ids).not.toContain('k.alternator_155_a.hub');
    expect(ids).toContain('k.alternator_220_a.hub');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  ÖZET · HAZIR DİYAGRAMLAR · YORUM
// ════════════════════════════════════════════════════════════════════════════
describe('özet kartları — hüküm yalnız modelin kendi ölçütü olan yerde', () => {
  test('AG00976: on kart, durumları modelin cevabı', () => {
    const { R } = coz();
    const d = {};
    S.summary(R).forEach((k) => { d[k.k] = k.durum; });
    expect(d).toEqual({
      kayma: 'ok', esik: 'info', taraf: 'ok', ankraj: 'info', boy: 'info',
      burulma: 'warn', omur: 'off',
      'kapi-centerDistance': 'warn', 'kapi-ratioWindow': 'wait', 'kapi-speedLimit': 'ok'
    });
  });
  test('servis faktörü eşiği KULLANICININ: 5,0 istenince kayma kartı "warn"', () => {
    const { R } = coz();
    R.serviceFact = 5.0;
    expect(S.summary(R).find((k) => k.k === 'kayma').durum).toBe('warn');
    R.serviceFact = 0;
    expect(S.summary(R).find((k) => k.k === 'kayma').not).not.toMatch(/istenen/);
  });
  test('gergi GERGİN taraftaysa kayma kartı hüküm vermez, SF kanalı kurulmaz', () => {
    kur();
    fead.veFeadReverseRoute ? fead.veFeadReverseRoute(global.nodes) : M.veFeadReverseRoute(global.nodes);
    const sv = global.nodes.find((n) => n.type === 'fead-solver');
    const R = fead.veFeadSolve(sv.id);
    expect(R.tensionerSide.ok).toBe(false);
    const k = S.summary(R).find((x) => x.k === 'kayma');
    expect(k.durum).toBe('no');
    expect(k.deger).toBe('—');
    expect(kume(R, 'cevrim').channels.some((c) => /\.sf$|^sfmin$/.test(c.id))).toBe(false);
  });
});

describe('hazır diyagramlar — var olmayan kanal için şerit yok', () => {
  test.each([['none', false], ['full', true]])('kayış verisi %s', (bd, frek) => {
    const { R } = coz('AG00976_GATES_2025', bd);
    const P = S.presets(R.signals);
    expect(P.map((p) => p.k)).toEqual(['gerg', 'hub', 'aks', 'camp', 'kol', 'sen']);
    P.forEach((p) => {
      const ds = S.setOf(R.signals, p.sensorId);
      p.lanes.forEach((L) => {
        expect(L.length).toBeGreaterThan(0);
        L.forEach((id) => expect(kanal(ds, id)).toBeTruthy());
      });
    });
    const sen = P.find((p) => p.k === 'sen');
    expect(sen.lanes[2].some((id) => /\.f1$/.test(id))).toBe(frek);
  });
});

describe('diyagram yorumu — sayı modelden, genel geçer metin yok', () => {
  test('dört kümenin de öncü satırı ve işaretleri var', () => {
    const { R } = coz();
    R.signals.forEach((ds) => {
      expect(ds.brief && ds.brief.lead).toBeTruthy();
      expect(ds.brief.marks.length).toBeGreaterThan(0);
    });
  });
  test('kayma şeridi en düşük SF\'yi ve servis faktörü hükmünü modelin sayısıyla yazar', () => {
    const { R } = coz();
    const ds = kume(R, 'cevrim');
    const br = B.forLane(ds, R, ['sfmin']);
    const st = rapor._frSlipStats(R);
    expect(br.paras.join(' ')).toContain('**' + st.loadedMin.toFixed(2).replace('.', ',') + '**');
    expect(br.paras.join(' ')).toMatch(/GEÇTİ/);
  });
  test('senaryonun künye notları şeride KONUSUNA göre düşer — üç şeritte üç kez yazılmaz', () => {
    const { R } = coz();
    const ds = kume(R, 'senaryo');
    const devir = B.forLane(ds, R, ['rpm']).paras.join('\n');
    const gerg = B.forLane(ds, R, [ds.channels.find((c) => /\.T$/.test(c.id)).id]).paras.join('\n');
    expect(devir).toMatch(/DAYATILMIŞ/);
    expect(gerg).not.toMatch(/DAYATILMIŞ/);
    expect(gerg).toMatch(/Gerilme ÇİZİLEN/);
    expect(devir).not.toMatch(/Gerilme ÇİZİLEN/);
  });
  test('yorum HTML üretmez — vurgu `**` işaretiyle, kaçırma sunumun işi', () => {
    const { R } = coz();
    R.signals.forEach((ds) => {
      const br = B.forLane(ds, R, ds.channels.map((c) => c.id));
      br.paras.forEach((p) => expect(p).not.toMatch(/<[a-z]/i));
    });
  });
});

describe('sunum — Sonuç Özeti ve başlangıç kartı (duman testi + taşınan damgalar)', () => {
  test('özet penceresi: bölümler var, undefined/NaN yok, ömür damgaları taşındı', () => {
    const { R } = coz('AG00976_GATES_2025', 'full');
    const h = RS.veFeadResSummaryHTML(R);
    ['Kasnaklar', 'Kasnak yükleri', 'Çıkış gerginlikleri', 'Hubload', 'Gergi kolu konumları',
     'Burulma modları', 'Tepe yükler', 'Hizalama payı', 'Uygunluk kapıları',
     'Kayış ömrü ve kaburga yorulması', 'Geçerlilik ve uyarılar'].forEach((b) => expect(h).toContain(b));
    expect(h).not.toMatch(/undefined|NaN|\[object/);
    expect(h).toMatch(/KALİBRE DEĞİL/);        // tepe yük
    expect(h).toMatch(/KALİBRE EDİLMEDİ/);     // hizalama payı
    expect(h).toMatch(/Take-up özdeşliği/);    // burulmanın iç tutarlılık kapısı
  });
  test('başlangıç kartı: KPI + altı hazır diyagram + kod künyesi', () => {
    coz();
    const h = RS.veFeadResEmptyHTML();
    expect((h.match(/class="ve-fr-kpi"/g) || []).length).toBe(10);
    expect((h.match(/veFeadResPreset\('/g) || []).length).toBe(6);
    expect(h).toContain('Kasnak kodları');
    expect(h).not.toMatch(/undefined|NaN/);
  });
});
