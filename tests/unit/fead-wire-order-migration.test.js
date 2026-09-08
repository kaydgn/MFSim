/**
 * fead-wire-order-migration.test.js — ESKİ KAYITLARIN KAYIŞ TELLERİ GÖÇ EDER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 2026-09-08: FEAD kanvasının kayış telleri artık kayışın GİDİŞ sırasında;
 * eskiden çekirdeğin liste (Gates tablo) sırasındaydı ve köprü onları olduğu
 * gibi veriyordu. Şimdi köprü telleri çeviriyor (veFeadRouteFlip). Eski bir
 * kayıt çevrilmeden açılsaydı: çekirdek tersine dönmüş bir listeyle koşar,
 * gergi gergin tarafa düşer, span gerilmeleri negatife iner — model yine
 * "çözülüyor" der. Bu dosya o kapıyı tutar:
 *
 *   1. şema sürümü 2 → kayış telleri bir kez çevrilir, damga 3'e yükselir;
 *   2. gömülü alt topoloji (fead-analysis → data.subTopology) de geçer ve
 *      DAMGALANIR — editör açılınca ikinci kez çevrilmez;
 *   3. sürüm 2'de düğüm verisi migrasyonu (Cd 0.75 → 0.90) ÇALIŞMAZ — kademeli
 *      kapı; sürümsüz (legacy) dosyada ikisi de çalışır;
 *   4. göç etmiş eski AG00976 kaydı çözülür, gergi gevşek tarafta, krank CW;
 *      göç ATLANIRSA gergi gergin tarafa düşer (mutasyon ölçüsü);
 *   5. kayış olmayan teller ve sürüm 3 dosyalar dokunulmaz.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = []; global.connections = []; global.selectedNodes = [];
global.compCounter = 0; global.canvasOffset = { x: 0, y: 0 }; global.canvasZoom = 1;
const stubs = stubGlobals();
eval(loadSource('components.js'));
eval(loadSource('state.js'));
// Kayıttaki düğümler `def` taşımaz; tarayıcıda _feadDefOf küresel
// componentDefs'ten okur — testte de öyle olsun.
global.componentDefs = componentDefs;
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

// Eski biçim: teller Gates TABLO sırasında (örneğin `route`u olduğu gibi).
function eskiKayit(key) {
  const ex = M.veFeadExampleOf(key);
  const pack = M.veFeadExampleNodes(key);
  const conns = [];
  ex.route.forEach((k, i) => {
    const next = ex.route[(i + 1) % ex.route.length];
    conns.push({ id: 'c' + i, from: 'ex-' + k, to: 'ex-' + next, fromPort: 'output', toPort: 'input' });
  });
  return { nodes: pack.nodes.map((n) => JSON.parse(JSON.stringify(n))), connections: conns };
}
const tellerOf = (st) => st.connections.map((c) => c.from + '>' + c.to).join(',');
const dutyRows = (ns) => (ns.find((n) => n.type === 'fead-solver').data.duty) || [];

describe('sürüm kapısı — kademeli', () => {
  test('sürüm 2 → kayış telleri çevrilir, damga 3', () => {
    const sub = Object.assign({ schemaVersion: 2 }, eskiKayit('AG00976_GATES_2025'));
    const once = tellerOf(sub);
    veApplyLegacyMigrations(sub);
    expect(tellerOf(sub)).not.toBe(once);
    expect(sub.schemaVersion).toBe(VE_SCHEMA_VERSION);
    expect(VE_SCHEMA_VERSION).toBe(3);
    // Çevrilmiş teller = örneğin bugünkü (gidiş) kablolaması.
    const yeni = M.veFeadExampleNodes('AG00976_GATES_2025');
    expect(sub.connections.map((c) => c.from + '>' + c.to).sort())
      .toEqual(yeni.connections.map((c) => c.from + '>' + c.to).sort());
  });

  test('sürüm 3 → dokunulmaz', () => {
    const sub = Object.assign({ schemaVersion: 3 }, eskiKayit('AG00976_GATES_2025'));
    const once = tellerOf(sub);
    veApplyLegacyMigrations(sub);
    expect(tellerOf(sub)).toBe(once);
  });

  test('gömülü alt topoloji de geçer ve DAMGALANIR — ikinci geçişte çevrilmez', () => {
    const sub = Object.assign({ schemaVersion: 2 }, eskiKayit('BMC_FEAD_2026'));
    const once = tellerOf(sub);
    const ana = { schemaVersion: 2, connections: [],
      nodes: [{ id: 'fa', type: 'fead-analysis', data: { subTopology: sub } }] };
    veApplyLegacyMigrations(ana);
    expect(tellerOf(sub)).not.toBe(once);
    expect(sub.schemaVersion).toBe(3);
    expect(ana.schemaVersion).toBe(3);
    const birinci = tellerOf(sub);
    // Editör açılışı: veLoadTabState → restoreState → aynı kapı, alt durumla.
    veApplyLegacyMigrations(sub);
    expect(tellerOf(sub)).toBe(birinci);
    // Ana durum yeniden geçse de değişmez.
    veApplyLegacyMigrations(ana);
    expect(tellerOf(sub)).toBe(birinci);
  });

  test('sürüm 2: düğüm verisi migrasyonu ÇALIŞMAZ (Cd 0.75 korunur) — kademeli kapı', () => {
    const st = { schemaVersion: 2, connections: [],
      nodes: [{ id: 'v', type: 'vehicle', data: { ftCd: 0.75 } }] };
    veApplyLegacyMigrations(st);
    expect(st.nodes[0].data.ftCd).toBe(0.75);
    expect(st.schemaVersion).toBe(3);
  });

  test('sürümsüz (legacy): ikisi de çalışır', () => {
    const k = eskiKayit('AG00976_GATES_2025');
    const st = { connections: k.connections,
      nodes: k.nodes.concat([{ id: 'v', type: 'vehicle', data: { ftCd: 0.75 } }]) };
    const once = tellerOf(st);
    veApplyLegacyMigrations(st);
    expect(st.nodes[st.nodes.length - 1].data.ftCd).toBe(0.9);
    expect(tellerOf(st)).not.toBe(once);
  });

  test('kayış olmayan teller dokunulmaz; kasnak olmayan uçlu tel de', () => {
    const k = eskiKayit('AG00976_GATES_2025');
    k.connections.push({ id: 'x', from: 'ex-solver', to: 'ex-layout', fromPort: 'output', toPort: 'input' });
    k.connections.push({ id: 'y', from: 'ex-FAN', to: 'ex-solver', fromPort: 'output', toPort: 'input' });
    const st = Object.assign({ schemaVersion: 2 }, k);
    veApplyLegacyMigrations(st);
    const x = st.connections.find((c) => c.id === 'x'), y = st.connections.find((c) => c.id === 'y');
    expect([x.from, x.to]).toEqual(['ex-solver', 'ex-layout']);
    expect([y.from, y.to]).toEqual(['ex-FAN', 'ex-solver']);
  });
});

describe('fizik — göç eden eski kayıt bugünkü örnekle BİREBİR', () => {
  const coz = (st) => {
    global.nodes = st.nodes; global.connections = st.connections;
    const b = M.veFeadBuildSystem(st.nodes, st.connections);
    const R = M.veFeadAnalyze(b, { rows: dutyRows(st.nodes), cylinders: 6 });
    return { b, R };
  };
  test('AG00976: göç → çözülür, gergi gevşek tarafta, krank CW, sayılar örnekle aynı', () => {
    const st = Object.assign({ schemaVersion: 2 }, eskiKayit('AG00976_GATES_2025'));
    veApplyLegacyMigrations(st);
    const { b, R } = coz(st);
    expect(b.ok).toBe(true);
    expect(b.spin).toBe(-1);
    expect(R.ok).toBe(true);
    expect(R.tensionerSide.ok).toBe(true);
    // Bugünkü örnekle aynı çözüm.
    const pack = M.veFeadExampleNodes('AG00976_GATES_2025');
    const b2 = M.veFeadBuildSystem(pack.nodes, pack.connections);
    expect(b.beltLengthMm).toBeCloseTo(b2.beltLengthMm, 9);
    expect(b.springTensionN).toBeCloseTo(b2.springTensionN, 9);
    expect(b.order.map((n) => n.id)).toEqual(b2.order.map((n) => n.id));
  });

  test('göç ATLANIRSA gergi gergin tarafa düşer — göçün ölçülmüş gerekçesi', () => {
    const st = Object.assign({ schemaVersion: 3 }, eskiKayit('AG00976_GATES_2025'));   // damga var → göç yok
    const { b, R } = coz(st);
    expect(b.ok).toBe(true);
    expect(b.spin).toBe(1);                                   // CCW — yanlış yön
    expect(R.tensionerSide.ok).toBe(false);
  });
});
