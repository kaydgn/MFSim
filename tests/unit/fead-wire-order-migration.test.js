/**
 * fead-wire-order-migration.test.js — ESKİ KAYITLARIN KAYIŞ SIRASI GÖÇ EDER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * İKİ GÖÇ, İKİ SÜRÜM — ve sırası önemli:
 *
 *   SÜRÜM 3 (2026-09-08): kayış telleri çekirdeğin liste (Gates tablo)
 *     sırasından kayışın GİDİŞ sırasına alındı.
 *   SÜRÜM 4 (2026-09-09): kasnaklar arası BAĞLANTI KALDIRILDI — sıra artık
 *     node.data.beltIndex. Teller okunup indise yazılır ve SİLİNİR.
 *
 * Sürüm 2 damgalı bir dosya İKİSİNDEN DE geçer: önce telleri çevrilir, sonra o
 * tellerden indisi kurulur. Ters sırada koşsalardı 2'den gelen her dosya ters
 * numaralanırdı — ve hata sessiz olurdu: gergi kayışın gergin tarafına düşer,
 * span gerilmeleri negatife iner, model yine "çözülüyor" der.
 *
 * Bu dosya o kapıyı tutar:
 *
 *   1. sürüm 2 → teller çevrilir + indis kurulur + teller silinir, damga 4;
 *   2. sürüm 3 → yalnız indis kurulur (teller zaten gidiş sırasında);
 *   3. gömülü alt topoloji (fead-analysis → data.subTopology) de geçer ve
 *      DAMGALANIR — editör açılınca ikinci kez göç etmez;
 *   4. sürüm 2'de düğüm verisi migrasyonu (Cd 0.75 → 0.90) ÇALIŞMAZ — kademeli
 *      kapı; sürümsüz (legacy) dosyada ikisi de çalışır;
 *   5. göç eden eski AG00976 kaydı bugünkü örnekle BİREBİR aynı çözülür;
 *      göç ATLANIRSA gergi gergin tarafa düşer (mutasyon ölçüsü);
 *   6. kayış olmayan teller SİLİNMEZ.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = []; global.connections = []; global.selectedNodes = [];
global.compCounter = 0; global.canvasOffset = { x: 0, y: 0 }; global.canvasZoom = 1;
const stubs = stubGlobals();
eval(loadSource('components.js'));
// components.js'teki yüklem GLOBAL'e yazılır: cp-fead.js / state.js require ile
// yükleniyor, dolayısıyla çıplak `veIsCanvasHidden` referansı bu dosyanın
// kapsamını DEĞİL global'i arar. Yazılmazsa kutusuz düğüm kapısı sessizce
// atlanır ve testler kutuların hâlâ kurulduğu bir dünyayı ölçer.
global.veIsCanvasHidden = veIsCanvasHidden;
eval(loadSource('state.js'));
// Kayıttaki düğümler `def` taşımaz; tarayıcıda _feadDefOf küresel
// componentDefs'ten okur — testte de öyle olsun.
global.componentDefs = componentDefs;
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

// Eski biçim: teller Gates TABLO sırasında (örneğin `route`u olduğu gibi),
// düğümlerde beltIndex YOK — sıra yalnız tellerde.
//
// DÜĞÜM DİZİSİ BİLEREK TERS: gerçek bir kayıtta dizi sırası kullanıcının
// bileşenleri EKLEME sırasıdır ve kayış yoluyla ilgisi yoktur. Örneğin kendi
// dizi sırası tesadüfen kayış sırasıyla örtüşüyor; öyle bırakılsaydı göç
// ATLANDIĞINDA bile doğru sıra çıkardı ve aşağıdaki mutasyon kapısı hiçbir
// şey ölçmezdi.
function eskiKayit(key) {
  const ex = M.veFeadExampleOf(key);
  const conns = [];
  ex.route.forEach((k, i) => {
    const next = ex.route[(i + 1) % ex.route.length];
    conns.push({ id: 'c' + i, from: 'ex-' + k, to: 'ex-' + next, fromPort: 'output', toPort: 'input' });
  });
  const nodes = M.veFeadExampleNodes(key).nodes
    .map((n) => JSON.parse(JSON.stringify(n))).reverse();
  nodes.forEach((n) => { if (n.data) delete n.data.beltIndex; });
  return { nodes, connections: conns };
}
const tellerOf = (st) => st.connections.map((c) => c.from + '>' + c.to).join(',');
// Kasnak sırası — kimliklerden ('ex-FAN' → 'FAN').
const siraOf = (st) => M.veFeadBeltOrder(st.nodes).map((n) => n.id.replace(/^ex-/, '')).join(',');
const kasnakTeli = (st) => st.connections.filter(
  (c) => /^ex-(FAN|SRC|IDR1|IDR2|A_C|ALT|TEN)$/.test(c.from)
      && /^ex-(FAN|SRC|IDR1|IDR2|A_C|ALT|TEN)$/.test(c.to)).length;
const dutyRows = (ns) => (ns.find((n) => n.type === 'fead-solver').data.duty) || [];

describe('şema 5 — kart ikiye bölündü, ÇALIŞMA NOKTASI eklenir', () => {
  // Kayış Yolu kartı 2026-09-10'da ikiye ayrıldı. Göç olmasaydı eski bir proje
  // açıldığında gerilme haritası, animasyon ve titreşim SESSİZCE kaybolurdu:
  // kart yine çizilir, yalnız üç yüzey yok olur.
  const eski = () => ({
    schemaVersion: 4,
    nodes: [{ id: 'lay-1', type: 'fead-layout', x: 100, y: 60, width: 440, height: 500, data: {} },
            { id: 'tbl-1', type: 'fead-table', x: 100, y: 600, data: {} }],
    connections: []
  });

  test('eski kayda Çalışma Noktası eklenir — şemanın sağına', () => {
    const st = eski();
    veApplyLegacyMigrations(st);
    const run = st.nodes.filter((n) => n.type === 'fead-run');
    expect(run).toHaveLength(1);
    expect(run[0].x).toBe(100 + 440 + 24);        // şemanın sağı, kart genişliği + boşluk
    expect(run[0].y).toBe(60);
    expect(st.schemaVersion).toBe(VE_SCHEMA_VERSION);
  });

  test('İKİNCİ geçişte ikinci kart kurulmaz — damga tutuyor', () => {
    const st = eski();
    veApplyLegacyMigrations(st);
    veApplyLegacyMigrations(st);
    expect(st.nodes.filter((n) => n.type === 'fead-run')).toHaveLength(1);
  });

  test('kart zaten varsa dokunulmaz; şema yoksa hiç eklenmez', () => {
    const varOlan = eski();
    varOlan.nodes.push({ id: 'run-0', type: 'fead-run', x: 9, y: 9, data: {} });
    expect(M.veFeadMigrateRunCard(varOlan)).toBe(0);
    expect(varOlan.nodes.filter((n) => n.type === 'fead-run')).toHaveLength(1);
    // Kayış Yolu kartı olmayan bir topolojide (ör. yalnız tablo) eklenecek bir
    // şey yok — kart bir GÖRÜNÜM, kendi başına anlamı yok.
    const semasiz = { schemaVersion: 4, nodes: [{ id: 't', type: 'fead-table', data: {} }], connections: [] };
    expect(M.veFeadMigrateRunCard(semasiz)).toBe(0);
    expect(semasiz.nodes.filter((n) => n.type === 'fead-run')).toHaveLength(0);
  });

  test('GÖMÜLÜ alt topoloji de geçer — FEAD kanvası orada yaşıyor', () => {
    const st = { schemaVersion: 4, nodes: [{ id: 'mod', type: 'fead-analysis',
      data: { subTopology: eski() } }], connections: [] };
    veApplyLegacyMigrations(st);
    expect(st.nodes[0].data.subTopology.nodes.filter((n) => n.type === 'fead-run')).toHaveLength(1);
  });
});

describe('sürüm kapısı — kademeli', () => {
  test('sürüm 2 → teller çevrilir, indis kurulur, teller SİLİNİR, damga güncel', () => {
    const sub = Object.assign({ schemaVersion: 2 }, eskiKayit('AG00976_GATES_2025'));
    expect(kasnakTeli(sub)).toBe(6);
    veApplyLegacyMigrations(sub);
    expect(sub.schemaVersion).toBe(VE_SCHEMA_VERSION);
    expect(VE_SCHEMA_VERSION).toBeGreaterThanOrEqual(4);
    // Kasnak telleri gitti; sıra indise geçti ve Gates TABLO sırası.
    expect(kasnakTeli(sub)).toBe(0);
    expect(siraOf(sub)).toBe('FAN,IDR1,A_C,IDR2,ALT,TEN');
    expect(M.veFeadBeltOrder(sub.nodes).map((n) => n.data.beltIndex)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('sürüm 3 → teller zaten gidiş sırasında; yalnız indis kurulur', () => {
    // Sürüm 3 biçimi: teller GİDİŞ sırasında (tablo sırasının çevrilmişi).
    const st = Object.assign({ schemaVersion: 3 }, eskiKayit('AG00976_GATES_2025'));
    st.connections = M.veFeadRouteFlip(['FAN', 'IDR1', 'A_C', 'IDR2', 'ALT', 'TEN'])
      .map((k, i, a) => ({ id: 'c' + i, from: 'ex-' + k, to: 'ex-' + a[(i + 1) % a.length],
                           fromPort: 'output', toPort: 'input' }));
    veApplyLegacyMigrations(st);
    expect(st.schemaVersion).toBe(5);
    expect(kasnakTeli(st)).toBe(0);
    expect(siraOf(st)).toBe('FAN,IDR1,A_C,IDR2,ALT,TEN');
  });

  test('sürüm 4 → dokunulmaz', () => {
    const st = Object.assign({ schemaVersion: 4 }, eskiKayit('AG00976_GATES_2025'));
    const once = tellerOf(st);
    veApplyLegacyMigrations(st);
    expect(tellerOf(st)).toBe(once);                       // teller olduğu gibi
    expect(st.nodes.every((n) => !n.data || n.data.beltIndex === undefined)).toBe(true);
  });

  test('gömülü alt topoloji de geçer ve DAMGALANIR — ikinci geçişte göç etmez', () => {
    const sub = Object.assign({ schemaVersion: 2 }, eskiKayit('BMC_FEAD_2026'));
    const ana = { schemaVersion: 2, connections: [],
      nodes: [{ id: 'fa', type: 'fead-analysis', data: { subTopology: sub } }] };
    veApplyLegacyMigrations(ana);
    expect(sub.schemaVersion).toBe(5);
    expect(ana.schemaVersion).toBe(5);
    const birinci = siraOf(sub);
    expect(birinci).toBe('SRC,IDR1,A_C,IDR2,ALT,TEN');
    // Editör açılışı: veLoadTabState → restoreState → aynı kapı, alt durumla.
    veApplyLegacyMigrations(sub);
    expect(siraOf(sub)).toBe(birinci);
    veApplyLegacyMigrations(ana);
    expect(siraOf(sub)).toBe(birinci);
  });

  test('sürüm 2: düğüm verisi migrasyonu ÇALIŞMAZ (Cd 0.75 korunur) — kademeli kapı', () => {
    const st = { schemaVersion: 2, connections: [],
      nodes: [{ id: 'v', type: 'vehicle', data: { ftCd: 0.75 } }] };
    veApplyLegacyMigrations(st);
    expect(st.nodes[0].data.ftCd).toBe(0.75);
    expect(st.schemaVersion).toBe(5);
  });

  test('sürümsüz (legacy): ikisi de çalışır', () => {
    const k = eskiKayit('AG00976_GATES_2025');
    const st = { connections: k.connections,
      nodes: k.nodes.concat([{ id: 'v', type: 'vehicle', data: { ftCd: 0.75 } }]) };
    veApplyLegacyMigrations(st);
    expect(st.nodes[st.nodes.length - 1].data.ftCd).toBe(0.9);
    expect(siraOf(st)).toBe('FAN,IDR1,A_C,IDR2,ALT,TEN');
  });

  test('kayış olmayan teller SİLİNMEZ — göç yalnız kasnak-kasnak telini alır', () => {
    const k = eskiKayit('AG00976_GATES_2025');
    k.connections.push({ id: 'x', from: 'ex-solver', to: 'ex-layout', fromPort: 'output', toPort: 'input' });
    k.connections.push({ id: 'y', from: 'ex-FAN', to: 'ex-solver', fromPort: 'output', toPort: 'input' });
    const st = Object.assign({ schemaVersion: 2 }, k);
    veApplyLegacyMigrations(st);
    const x = st.connections.find((c) => c.id === 'x'), y = st.connections.find((c) => c.id === 'y');
    expect([x.from, x.to]).toEqual(['ex-solver', 'ex-layout']);
    expect([y.from, y.to]).toEqual(['ex-FAN', 'ex-solver']);
    expect(kasnakTeli(st)).toBe(0);
  });
});

describe('fizik — göç eden eski kayıt bugünkü örnekle BİREBİR', () => {
  const coz = (st) => {
    global.nodes = st.nodes; global.connections = st.connections;
    const b = M.veFeadBuildSystem(st.nodes);
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
    const b2 = M.veFeadBuildSystem(pack.nodes);
    expect(b.beltLengthMm).toBeCloseTo(b2.beltLengthMm, 9);
    expect(b.springTensionN).toBeCloseTo(b2.springTensionN, 9);
    expect(b.order.map((n) => n.id)).toEqual(b2.order.map((n) => n.id));
  });

  test('göç ATLANIRSA gergi gergin tarafa düşer — göçün ölçülmüş gerekçesi', () => {
    // Damga 4 → göç koşmaz. İndis olmadığı için sıra DİZİ sırasına düşüyor ve
    // dizi kullanıcının ekleme sırası: burada kayışın tersi. Ölçülen bedel bu.
    const st = Object.assign({ schemaVersion: 4 }, eskiKayit('AG00976_GATES_2025'));
    expect(siraOf(st)).toBe('FAN,TEN,ALT,IDR2,A_C,IDR1');     // ters
    const { b, R } = coz(st);
    expect(b.ok).toBe(true);
    expect(b.spin).toBe(1);                                   // CCW — yanlış yön
    expect(R.tensionerSide.ok).toBe(false);
  });
});
