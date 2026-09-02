/**
 * fead-arm-input.test.js — AVARA MERKEZİ GİRDİ, MONTAJ KONUMU ÇIKTI
 *
 * Kullanıcı kararı (2026-09-01): *"biz otomatik gergi için normalde 'otomatik
 * gerginin montaj noktasını' veriyorduk. Bu daha mantıklı oluyordu fakat şimdi
 * 'otomatik gergi avarasının orta noktasını' vereceğiz."*
 * ve (2026-08-29): *"Herhangi bir doğrulama gibi bir olay söz konusu değil."*
 *
 * Bu dosya dört şeyi tutuyor:
 *
 *   1) CEBİR — çevirme TAM. Merkez + kol açısı → montaj konumu → sistem
 *      yeniden kurulunca L_eff, sarım ve gerginlik BİREBİR aynı (14 sistem).
 *   2) MONTAJ ZARFI KALKTI — ve sebebi ÖLÇÜLDÜ: ölçüt bu yönde çöküyor.
 *      Kapı hem API'nin gittiğini hem ölçümün geçerliliğini tutuyor.
 *   3) KÖPRÜ — göç, zorunlu girdiler, ikinci koordinatın SİLİNMESİ.
 *   4) YÜZEY — panel/rapor/kanvas, ve kayış tipine bağlı çıktılar anahtarı.
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

const SYSTEMS = []
  .concat(Object.keys(V.AG00976).map((k) => ({ id: `AG00976/${k}`, mk: () => V.buildAG00976(k) })))
  .concat(Object.keys(V.AG_MISC).map((k) => ({ id: k, mk: () => V.buildMisc(k) })));

/* ═══════════════ 1) ÇEVİRME CEBİRSEL OLARAK TAM ═══════════════════════════
   Yön değişikliği bir yaklaşıklık değil, aynı denklemin öteki yüzü:
       p = c − a·(cos θ, sin θ)   ⇔   c = p + a·(cos θ, sin θ)
   Kapı bunu 14 Gates sisteminde ölçüyor. Tutmazsa yön çevirmenin kendisi
   sayıları kaydırıyor demektir ve bütün doğrulama kümesi anlamını yitirir. */
describe('çevirme TAM — merkez + kol açısı → montaj konumu', () => {
  test('14 sistemde |Δp|, ΔL, ΔT ve Δsarım kayan nokta düzeyinde', () => {
    let wp = 0; let wl = 0; let wt = 0; let ww = 0; let n = 0;
    SYSTEMS.forEach((S) => {
      let sys; try { sys = S.mk(); } catch (e) { return; }
      const p = sys.tensioner.pivot; const a = sys.tensioner.armLength;
      const rel = F.meanRel(sys);
      const st = F.tensionerState(sys, rel);
      const c = st.center;
      // Kolun MUTLAK çalışma açısı — MFSim'in girdisi bu ikisi (c, θ).
      const th = Math.atan2(c[1] - p[1], c[0] - p[0]) * 180 / Math.PI;
      const p2 = M.veFeadTensionerPivot({ cenX: c[0], cenY: c[1], armLen: a, armMeanDeg: th });
      wp = Math.max(wp, Math.hypot(p2[0] - p[0], p2[1] - p[1]));
      const cfg = {
        pulleys: sys.pulleys.map((q) => (q.tensioner
          ? { name: q.name, rPitch: q.rPitch, rEff: q.rEff, contact: q.contact, tensioner: true }
          : { name: q.name, rPitch: q.rPitch, rEff: q.rEff, contact: q.contact,
              x: q.x, y: q.y, crank: !!q.crank })),
        belt: sys.belt,
        tensioner: { pivot: p2, armLength: a, preloadNm: sys.tensioner.preloadNm,
          rateNmPerDeg: sys.tensioner.rateNmPerDeg,
          freeAngleDeg: sys.tensioner.freeAngleDeg, sense: sys.tensioner.sense },
        driveRatio: 1, lengthOffsetMm: sys.lengthOffsetMm || 0, geomOpt: { tolerant: true },
      };
      const st2 = F.tensionerState(F.makeSystem(cfg), rel);
      wl = Math.max(wl, Math.abs(st2.requiredBeltMm - st.requiredBeltMm));
      wt = Math.max(wt, Math.abs(st2.tensionN - st.tensionN) / st.tensionN * 100);
      ww = Math.max(ww, Math.abs(st2.wrapDeg - st.wrapDeg));
      n++;
    });
    expect(n).toBeGreaterThanOrEqual(14);
    expect(wp).toBeLessThan(1e-9);
    expect(wl).toBeLessThan(1e-9);
    expect(wt).toBeLessThan(1e-9);
    expect(ww).toBeLessThan(1e-9);
  });

  test('okuyucu eksik girdide UYDURMUYOR', () => {
    expect(M.veFeadTensionerPivot({ cenX: 0, cenY: 0, armLen: 90 })).toBeNull();
    expect(M.veFeadTensionerPivot({ cenX: 0, cenY: 0, armMeanDeg: 344 })).toBeNull();
    expect(M.veFeadTensionerPivot({ armLen: 90, armMeanDeg: 344 })).toBeNull();
    expect(M.veFeadTensionerPivot(null)).toBeNull();
  });

  test('İŞARET: montaj konumu merkezin GERİSİNDE (θ yönünün tersinde)', () => {
    // Bir işaret hatası burada görünür ve BAŞKA HİÇBİR YERDE görünmez:
    // mesafe her iki işarette de kol boyu kadar çıkar.
    const p = M.veFeadTensionerPivot({ cenX: 0, cenY: 0, armLen: 10, armMeanDeg: 0 });
    expect(p[0]).toBeCloseTo(-10, 9);
    expect(p[1]).toBeCloseTo(0, 9);
    const q = M.veFeadTensionerPivot({ cenX: 0, cenY: 0, armLen: 10, armMeanDeg: 90 });
    expect(q[0]).toBeCloseTo(0, 9);
    expect(q[1]).toBeCloseTo(-10, 9);
  });

  test('çalışma açısında merkez okuyucusu GİRDİYİ birebir döndürür', () => {
    // Türetip geri dönmek ~1e−14'lük bir artık bırakırdı; "girilen sayı
    // çıkmıyor" diye okunacak bir fark olmamalı.
    const td = { cenX: -161.97, cenY: 91.29, armLen: 90, armMeanDeg: -11.9992 };
    expect(M.veFeadTensionerCenter(td)).toEqual([-161.97, 91.29]);
    expect(M.veFeadTensionerCenter(td, -11.9992)).toEqual([-161.97, 91.29]);
    // başka bir açıda merkez GEZER — ve tam kol boyu yarıçapında
    const c2 = M.veFeadTensionerCenter(td, -11.9992 + 30);
    const p = M.veFeadTensionerPivot(td);
    expect(Math.hypot(c2[0] - p[0], c2[1] - p[1])).toBeCloseTo(90, 9);
    expect(Math.hypot(c2[0] + 161.97, c2[1] - 91.29)).toBeGreaterThan(10);
  });
});

/* ═══════════════ 2) MONTAJ ZARFI KALKTI — ve sebebi ÖLÇÜLDÜ ═══════════════ */
describe('montaj zarfı — API gitti, gerekçe ölçülü', () => {
  test('zarf API’si HİÇBİR katmanda yok', () => {
    ['veFeadArmEnvelope', 'veFeadEnvelopeOf', '_feadEnvSample',
     'VE_FEAD_ENV_TRAVEL_MULT', 'VE_FEAD_ENV_COARSE_DEG'].forEach((k) => {
      expect(M[k]).toBeUndefined();
    });
    expect(fead.veFeadEnvelopeReadout).toBeUndefined();
    expect(fead.veFeadSetPinArm).toBeUndefined();
    expect(fead.veFeadReselectArm).toBeUndefined();
    expect(RP._frEnvelopeBlock).toBeUndefined();
    expect(RP.VE_FR_ENV_CRITERIA).toBeUndefined();
  });

  // ÖLÇÜMÜN KENDİSİ — kapı burada. Ölçüt kaldırıldı çünkü bu yönde ÇÖKÜYOR;
  // biri onu geri getirmek isterse önce bu sayıyı çürütmek zorunda.
  //
  // Merkez SABİTKEN kayış yolu kol açısından bağımsızdır (ölçüldü: 4,55e−13 mm,
  // 6 sistem × 548 açı), dolayısıyla ölçüt eğrisi DÜZLEŞİR — %1 platosu
  // 2,1° → 24,1°. Ölçüt yanlış bir yeri seçmiyor, hiçbir yeri seçemiyor.
  test('ölçüt merkez SABİTKEN çöküyor: ±5° isabet ≤ 4/14', () => {
    const w180 = (x) => { let v = x; while (v > 180) v -= 360; while (v < -180) v += 360; return v; };
    const orne = (sys, c, a, absDeg, relNom) => {
      const r = absDeg * Math.PI / 180;
      const p = [c[0] - a * Math.cos(r), c[1] - a * Math.sin(r)];
      const cfg = {
        pulleys: sys.pulleys.map((q) => (q.tensioner
          ? { name: q.name, rPitch: q.rPitch, rEff: q.rEff, contact: q.contact, tensioner: true }
          : { name: q.name, rPitch: q.rPitch, rEff: q.rEff, contact: q.contact,
              x: q.x, y: q.y, crank: !!q.crank })),
        belt: sys.belt,
        tensioner: { pivot: p, armLength: a, preloadNm: sys.tensioner.preloadNm,
          rateNmPerDeg: sys.tensioner.rateNmPerDeg, freeAngleDeg: absDeg },
        driveRatio: 1, lengthOffsetMm: sys.lengthOffsetMm || 0, geomOpt: { tolerant: true },
      };
      let s2; try { s2 = F.makeSystem(cfg); } catch (e) { return null; }
      s2.tensioner.freeAngleDeg = absDeg - s2.tensioner.sense * relNom;
      s2._cache = {};
      let tk = Infinity; let ok = true; let beta = NaN;
      [0, 0.5 * relNom, relNom, 1.5 * relNom].forEach((pr) => {
        if (!ok) return;
        let st; try { st = F.tensionerState(s2, pr); } catch (e) { ok = false; return; }
        if (!st || !(st.tensionN > 0) || !(st.wrapDeg > 1)) { ok = false; return; }
        if (st.geom && st.geom.violations && st.geom.violations.length) { ok = false; return; }
        tk = Math.min(tk, st.takeupMmPerDeg);
        if (pr === relNom) beta = st.betaDeg;
      });
      return ok ? { absDeg, takeupMin: tk, beta } : null;
    };
    const hata = []; let isabet = 0;
    SYSTEMS.forEach((S) => {
      let sys; try { sys = S.mk(); } catch (e) { return; }
      const p = sys.tensioner.pivot; const a = sys.tensioner.armLength;
      const relNom = F.meanRel(sys);
      const st = F.tensionerState(sys, relNom);
      const c = st.center;
      const thG = Math.atan2(c[1] - p[1], c[0] - p[0]) * 180 / Math.PI;
      let best = null;
      for (let i = 0; i * 2 < 360; i++) {
        const s = orne(sys, c, a, -180 + i * 2, relNom);
        if (s && (!best || s.takeupMin > best.takeupMin)) best = s;
      }
      if (!best) return;
      const e = Math.abs(w180(best.absDeg - thG));
      hata.push(e);
      if (e <= 5) isabet++;
    });
    expect(hata.length).toBeGreaterThanOrEqual(14);
    // Pivot GİRDİYKEN aynı ölçüt 8/14 tutuyordu, medyan 4,0°. Merkez girdiyken:
    expect(isabet).toBeLessThanOrEqual(4);
    hata.sort((x, y) => x - y);
    const med = hata.length % 2 ? hata[(hata.length - 1) / 2]
      : (hata[hata.length / 2 - 1] + hata[hata.length / 2]) / 2;
    expect(med).toBeGreaterThan(10);
  });

  test('KOL AÇISI ZORUNLU — uydurulmuş varsayılan yok', () => {
    const pack = veFeadExampleNodes(KEY);
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    delete ten.data.armMeanDeg;
    const b = veFeadBuildSystem(pack.nodes, pack.connections);
    expect(b.ok).toBe(false);
    expect(b.errors.join(' ')).toMatch(/çalışma açısı .*girilmedi/i);
    expect(b.pivot).toBeNull();
    // ve model KENDİLİĞİNDEN bir açı yazmıyor
    expect(ten.data.armMeanDeg).toBeUndefined();
  });
});

/* ═══════════════════════ 3) KÖPRÜ ════════════════════════════════════════ */
const KEY = 'AG00976_GATES_2025';

describe('köprü — tek koordinat, göç, zorunlu girdiler', () => {
  test('GÖÇ: montaj konumlu eski kayıt avara merkezine iner', () => {
    // 2026-08-28…09-01 arası "zarf kipi" biçimi.
    const td = { pivotX: -256.59, pivotY: 123.97, armLen: 90, armMeanDeg: 344,
                 armPinned: true, angleMode: 'envelope',
                 preload: 8.6, kArm: 0.48, meanLoad: 22.07 };
    expect(veFeadMigrateTensioner(td)).toBe(true);
    expect(td.cenX).toBeCloseTo(-170.076, 2);
    expect(td.cenY).toBeCloseTo(99.163, 2);
    expect(td.armMeanDeg).toBe(344);                 // kol açısı KORUNUR
    ['pivotX', 'pivotY', 'angleMode', 'freeAngleDeg', 'verifyCenX', 'verifyCenY',
     'armPinned', 'armAuto'].forEach((k) => expect(td[k]).toBeUndefined());
    // ikinci kez koşmak bir şey değiştirmez
    expect(veFeadMigrateTensioner(td)).toBe(false);
  });

  test('GİRİLEN merkez KAZANIR — montaj konumundan yeniden türetilmez', () => {
    const td = { pivotX: -250, pivotY: 110, cenX: -161.97, cenY: 91.29,
                 armLen: 90, armMeanDeg: -11.9992 };
    veFeadMigrateTensioner(td);
    expect(td.cenX).toBe(-161.97);
    expect(td.cenY).toBe(91.29);
    expect(td.pivotX).toBeUndefined();
  });

  test('EN ESKİ (mount) kayıt BEDAVA göç eder — alan zaten doğru', () => {
    const td = { cenX: -170.08, cenY: 99.16, armLen: 90, armMeanDeg: 344,
                 angleMode: 'mount' };
    expect(veFeadMigrateTensioner(td)).toBe(true);
    expect(td.cenX).toBe(-170.08);
    expect(td.angleMode).toBeUndefined();
  });

  test('GÖÇ KÖPRÜDE DE KOŞAR — panel hiç açılmadan çözülen model de iner', () => {
    // Göçü yalnız panele bağlamak, paneli açmadan çözülen bir modelde eski
    // alanların CANLI kalması demekti (kart · rapor · sürükleme hepsi köprüden
    // geçiyor). Kapı köprüyü doğrudan koşturuyor.
    const pack = veFeadExampleNodes(KEY);
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    delete ten.data.cenX; delete ten.data.cenY;
    ten.data.pivotX = -250; ten.data.pivotY = 110;
    ten.data.armPinned = true; ten.data.angleMode = 'envelope';

    const b = veFeadBuildSystem(pack.nodes, pack.connections);
    expect(b.ok).toBe(true);
    expect(ten.data.pivotX).toBeUndefined();        // göç KÖPRÜDE koştu
    expect(ten.data.angleMode).toBeUndefined();
    expect(ten.data.armPinned).toBeUndefined();
    expect(ten.data.cenX).toBeCloseTo(-161.97, 1);
  });

  test('MONTAJ KONUMU AVARA MERKEZİ YERİNE GEÇEMEZ — sessiz %48 hatası', () => {
    // Göç türetemiyorsa (kol açısı yok) merkez YOK ve model ÇÖZÜLMEZ.
    // Montaj konumunu merkez saymak ölçülmüş hata: gerginlik medyan +%1526.
    const pack = veFeadExampleNodes(KEY);
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    delete ten.data.cenX; delete ten.data.cenY; delete ten.data.armMeanDeg;
    ten.data.pivotX = -250; ten.data.pivotY = 110;

    const b = veFeadBuildSystem(pack.nodes, pack.connections);
    expect(b.ok).toBe(false);
    expect(b.errors.join(' ')).toMatch(/merkez koordinatı \(X \/ Y\) girilmedi/);
    expect(b.center).toBeNull();
  });

  test('İKİNCİ KOORDİNAT TÜRETİLEMESE BİLE SİLİNİR', () => {
    const td = { pivotX: -250, pivotY: 110 };        // kol boyu/açısı YOK
    veFeadMigrateTensioner(td);
    expect(td.cenX).toBeUndefined();
    expect(td.pivotX).toBeUndefined();              // yine de SİLİNDİ
  });

  test('KARŞILIKLI DOĞRULAMA API’si YOK', () => {
    ['veFeadArmCheck', 'veFeadTensionerMount', 'veFeadFreeAngleFrom',
     'veFeadPivotFromArm', 'veFeadAngleMode'].forEach((k) => {
      expect(M[k]).toBeUndefined();
    });
  });

  test('AG00976 avara merkezinden Gates’i geri üretiyor', () => {
    const pack = veFeadExampleNodes(KEY);
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const b = veFeadBuildSystem(pack.nodes, pack.connections);
    expect(b.ok).toBe(true);
    // Kayış boyu bir ÇIKTI ve raporun REBL sütununa oturuyor.
    expect(Math.abs(b.beltLengthMm - 1714.6) / 1714.6 * 100).toBeLessThan(0.05);
    // Tasarım gerginliği yay dengesinden TÜRÜYOR — Gates 544 N.
    expect(Math.abs(b.springTensionN - 544) / 544 * 100).toBeLessThan(1);
    // ...ve türeyen montaj konumu raporun KENDİ Tensioner Data satırına oturuyor.
    // Bu bir KAPI değil bir ÖLÇÜ: o satır modele hiç girmiyor.
    expect(Math.hypot(b.pivot[0] + 250, b.pivot[1] - 110)).toBeLessThan(0.01);
  });
});

/* ═══════════ 4) YÜZEY — kayış kipi kilitli, panel, rapor ═════════════════ */
describe('yüzey — kayış kipi KİLİTLİ', () => {
  const kurKanvas = () => {
    const pack = veFeadExampleNodes(KEY);
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    global.nodes = pack.nodes; global.connections = pack.connections;
    return pack;
  };

  test('veFeadBeltModeLocked: gergi varsa TRUE (kayış boyu her zaman çıktı)', () => {
    const pack = kurKanvas();
    expect(veFeadBeltModeLocked(pack.nodes)).toBe(true);
    // Kilit KÖPRÜDE uygulanıyor: kayış düğümü 'fixed' taşısa bile çözüm
    // serbest kipte koşuyor ve boy TÜREV olarak işaretleniyor.
    const b = veFeadBuildSystem(pack.nodes, pack.connections);
    expect(b.beltMode).toBe('free');
    expect(b.beltLengthDerived).toBe(true);
  });

  test('panel kipi SERBEST (kilitli) gösterir ve seçici sunmaz', () => {
    const pack = kurKanvas();
    const h = fead.getFeadBeltPropertiesHTML(pack.nodes.find((n) => n.type === 'fead-belt'));
    expect(h).toMatch(/kilitli/i);
    expect(h).not.toMatch(/veFeadSetChoice\('[^']+','lengthMode'/);
  });

  test('gergi paneli avara merkezini SORAR, montaj konumunu OKUTUR', () => {
    const pack = kurKanvas();
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    const h = fead.getFeadTensionerPropertiesHTML(ten);
    expect(h).toMatch(/veFeadSet\('[^']+','cenX'/);
    // Kol YÖNÜ nispi gösteriliyor: alan mutlak `armMeanDeg`i doğrudan değil,
    // tek üreticili çeviriciden geçerek yazıyor (kullanıcı isteği, 2026-09-01).
    expect(h).toMatch(/veFeadSetArmShown\('[^']+'/);
    expect(h).not.toMatch(/veFeadSet\('[^']+','armMeanDeg'/);
    expect(h).not.toMatch(/veFeadSet\('[^']+','pivotX'/);
    expect(h).toMatch(/montaj konumu \(türedi\)/);
    expect(h).toMatch(/-250\.00 \/ 110\.00/);
  });

  test('avara hareketi okuması ÇIKAN boyu ve gerginliği basar', () => {
    const pack = kurKanvas();
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    const h = fead.veFeadArmReadout(ten);
    expect(h).toMatch(/Gereken KAYIŞ BOYU \(çıktı\)/);
    expect(h).toMatch(/Serbest kol açısı \(türedi\)/);
    expect(h).toMatch(/Tasarım gerginliği \(türedi\)/);
    expect(h).not.toMatch(/undefined|NaN/);
  });
});

describe('rapor — kayış boyu ÇIKTI, montaj konumu TÜREV', () => {
  function coz() {
    const pack = veFeadExampleNodes(KEY);
    const ns = pack.nodes.map((n) => ({
      id: n.id, type: n.type, def: componentDefs[n.type],
      customName: n.customName, data: JSON.parse(JSON.stringify(n.data)),
    }));
    const build = veFeadBuildSystem(ns, pack.connections);
    const solv = ns.filter((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver)[0];
    const R = veFeadAnalyze(build, {
      rows: veFeadDutyRows(solv), cylinders: 6, fatigueModel: 'PK-2_2p-MT3',
    });
    R.build = build; R.pulleyNames = build.names;
    R.serviceFact = (solv && solv.data && Number(solv.data.serviceFact)) || 0;
    return RP._frSection8(R, { id: 'rep1', type: 'fead-report', data: {} });
  }

  test('envanterde kayış boyu ve montaj konumu TÜREV tarafında', () => {
    const z = coz();
    const ayrac = z.indexOf('aşağıdakilerin hiçbiri girilmez');
    expect(ayrac).toBeGreaterThan(0);
    expect(z.indexOf('Kayış efektif boyu')).toBeGreaterThan(ayrac);
    expect(z.indexOf('Gövdenin montaj konumu')).toBeGreaterThan(ayrac);
    // ...ve avara merkezi GİRDİ tarafında
    expect(z.indexOf('Gergi avarasının merkezi')).toBeLessThan(ayrac);
    expect(z).not.toMatch(/Gergi pivotu/);
  });
});

/* ═══════════ 5) KAYIŞ TİPİNE BAĞLI ÇIKTILAR — ŞİMDİLİK KAPALI ═══════════ */
describe('kayış tipine bağlı çıktılar', () => {
  function coz(_yok, override) {
    const pack = veFeadExampleNodes(KEY);
    const ns = pack.nodes.map((n) => ({
      id: n.id, type: n.type, def: componentDefs[n.type],
      customName: n.customName, data: JSON.parse(JSON.stringify(n.data)),
    }));
    if (override) ns.find((n) => n.type === 'fead-belt').data.beltDataMode = override;
    const build = veFeadBuildSystem(ns, pack.connections);
    const solv = ns.filter((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver)[0];
    return { build, R: veFeadAnalyze(build, {
      rows: veFeadDutyRows(solv), cylinders: 6, fatigueModel: 'PK-2_2p-MT3' }), ns };
  }

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
