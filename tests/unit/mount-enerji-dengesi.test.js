/**
 * mount-enerji-dengesi.test.js — GEÇİCİ REJİMİN ENERJİ DENGESİ (Canlı Not 3002)
 * ─────────────────────────────────────────────────────────────────────────
 * Şok çözümü kaba adımla sert durdurucu temasında sayısal enerji KAZANABİLİR ve
 * sonuç sessizce on kat büyük çıkar (ölçüldü: Tulga 15 g, Newmark doğrusal ivme,
 * periyot başına 4 adım: 195 mm ↔ yakınsamış 21 mm). Çekirdek her adımda dış işi,
 * kinetik enerjiyi, takozların iç enerjisini ve sönümde harcananı biriktirir
 * (Abaqus ETOTAL'ın karşılığı); sapma sınırı aşarsa Sonuçlar'ın yorumu söyler.
 *
 *   · KORUNUM — lineer sistemde ortalama ivmeli Newmark enerjiyi ayrık olarak TAM korur.
 *   · α-YÖNTEMLERİ — HHT-α ve genelleştirilmiş-α temassız kaba adımda yanlış alarm vermez.
 *   · TEMAS — kaba adımda sapma sınırı aşar; adım inceltilince sıfıra yakınsar.
 *   · YORUM — sınır aşılınca uyarı, varsayılan adımda sessiz.
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.veMntSignals = require('../../js/mount-signals.js');
global.veMntBrief = require('../../js/mount-brief.js');
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');

function tulga(cozucuAyar, shockG) {
  const t = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples/tulga_topoloji.json'), 'utf8'));
  global.nodes = t.nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  global.connections = [];
  const n = global.nodes.find((x) => x.type === 'mnt-solver');
  if (cozucuAyar) n.data.cozucu = cozucuAyar;
  if (shockG) n.data.shockG = shockG;
  return cp._mntComputeResults(n.id);
}
function sok(R, ek) {
  const M6 = core.buildM6(R.mp.m, R.mp.I_G);
  return core.shockResponse(R.dinMounts || R.mounts, R.mp.cg, M6, R.damping,
    Object.assign({ dir: 2, aG: 3, dur: 0.02, useStop: true, q0: R.qStatic, kBasis: R.kBasis }, ek || {}));
}
beforeEach(() => { resetStubs(stubs); cp._mntForgetResults(); });

describe('KORUNUM ve α-YÖNTEMLERİ — lineer sistem (durdurucusuz)', () => {
  test('ortalama ivmeli Newmark: dış iş = kinetik + iç + sönüm, makine hassasiyetinde', () => {
    const R = tulga();
    const r = sok(R, { useStop: false, nonlinear: false });
    expect(r.enerji.kazanc).toBeLessThan(1e-9);
    expect(r.enerji.kayip).toBeLessThan(1e-9);
    expect(r.enerji.sonum).toBeGreaterThan(0);                       // sönüm enerji harcadı
  });
  // α-yöntemlerinde denge ara noktada (t_{n+1−α}) kurulur; uç noktalarda ölçülen enerji birinci
  // mertebe bir artık taşır (ölçüldü: periyot başına 8 adımda %1,4–2, 40 adımda %0,07). Ölçünün
  // işi büyük sapmayı yakalamak: doğru çalışan yöntemde YANLIŞ ALARM yok, artık adımla söner.
  test('HHT-α ve genelleştirilmiş-α, temas yokken kaba adımda: sapma sınırın çok altında', () => {
    const R = tulga();
    [{ entegrator: 'hht', alfa: -0.05 }, { entegrator: 'hht', alfa: -0.3 }, { entegrator: 'gen-alfa', rhoInf: 0.5 }]
      .forEach((e) => {
        const r = sok(R, Object.assign({ useStop: false, nonlinear: false, adimPeriyot: 8 }, e));
        expect([e.entegrator, Math.max(r.enerji.kazanc, r.enerji.kayip) < core.GECICI_ENERJI_SINIR]).toEqual([e.entegrator, true]);
        const r40 = sok(R, Object.assign({ useStop: false, nonlinear: false, adimPeriyot: 40 }, e));
        expect(Math.max(r40.enerji.kazanc, r40.enerji.kayip)).toBeLessThan(Math.max(r.enerji.kazanc, r.enerji.kayip) / 10);   // birinci mertebe: adımla söner
      });
    const n = sok(R, { useStop: false, nonlinear: false, adimPeriyot: 8 });   // Newmark: net sıfır
    expect(Math.abs(n.enerji.son)).toBeLessThan(1e-9);
  });
});

describe('TEMAS — kaba adımda sapma, incelince yakınsama', () => {
  test('15 g durdurucu teması: periyot başına 4 adımda sınır aşılır; 40 → 120 adımda sapma küçülür', () => {
    const R = tulga(null, 15);
    const sap = (N) => { const e = sok(R, { aG: 15, adimPeriyot: N }).enerji; return Math.max(e.kazanc, e.kayip); };
    const s4 = sap(4), s40 = sap(40), s120 = sap(120);
    expect(s4).toBeGreaterThan(core.GECICI_ENERJI_SINIR);
    expect(s40).toBeLessThan(core.GECICI_ENERJI_SINIR);
    expect(s120).toBeLessThan(s40);
    expect(s120).toBeLessThan(0.005);
  });
});

describe('YORUM — sınır aşılınca söylenir, varsayılanda sessiz', () => {
  const yorum = (R) => {
    const ds = R.signals.find((d) => d.key === 'shockz');
    const ch = ds.channels.find((c) => /bileşke sehim/.test(c.name));
    return global.veMntBrief.forLane(ds, R, [ch.id]).paras.join('\n');
  };
  test('kaba adım + temas: "Enerji dengesi %… sapıyor"; varsayılan: yok', () => {
    expect(yorum(tulga({ gecici: { adimPeriyot: 4 } }, 15))).toMatch(/Enerji dengesi %[\d,]+ sapıyor.*\(sayısal enerji kazancı\); eğri sayısal olarak güvenilmez\./);
    expect(yorum(tulga(null, 15))).not.toMatch(/Enerji dengesi/);
  });
});
