/**
 * Kaydetme gidiş-dönüşü: schemaVersion + annotations korunumu
 * ───────────────────────────────────────────────────────────
 * Regresyon zemini: veBuildCleanTabState 7 anahtarlık bir beyaz liste
 * döndürüyordu ve veSerializeCurrentState'in ürettiği iki alanı düşürüyordu:
 *
 *   1) schemaVersion → damga düşünce restoreState state'i LEGACY sayar ve
 *      veMigrateNodeData kullanıcının kasıtlı Cd=0.75 girdisini 0.900 yapar.
 *      Ezilen değer sonraki kayıtta diske de yazıldığı için geri dönüşü yok.
 *   2) annotations  → tuval notları kaydedilen dosyada hiç yer almaz,
 *      açılışta restoreAnnotations([]) ile silinirler.
 *
 * Test edilen şey saf serileştirme/migrasyon mantığı — HTML çıktısı değil.
 */

const fs = require('fs');
const path = require('path');

const readJs = (f) => fs.readFileSync(path.join(__dirname, '../../js', f), 'utf8');

// ─── state.js: VE_SCHEMA_VERSION + veApplyLegacyMigrations ───
// (restoreState DOM'a dokunuyor; burada yalnız saf migrasyon yolunu kullanıyoruz)
global.nodes = [];
global.connections = [];
global.undoStack = [];
global.redoStack = [];
global.showToast = jest.fn();
eval(readJs('state.js'));

// ─── toolbar.js: veBuildCleanTabState ───
global.VE_SAVE_MAX_POINTS = 2000;
global.veDecimateSimResults = (sim) => sim;
global.veSanitizeNodesSubtopology = (n) => n;
try { eval(readJs('toolbar.js')); } catch (e) { /* diğer fonksiyonların bağımlılıkları */ }

// Kaydedilmiş dosyanın diske yazılıp geri okunmasını birebir taklit et
const diskRoundTrip = (o) => JSON.parse(JSON.stringify(o));

function makeTabState(extra) {
  return Object.assign({
    schemaVersion: VE_SCHEMA_VERSION,
    nodes: [
      { id: 'n1', type: 'vehicle', x: 0, y: 0, data: { ftCd: 0.75, ftHeight: 3, ftWidth: 2 } },
      { id: 'n2', type: 'wheel', x: 0, y: 0, data: { ftCrr: 0.015 } },
      { id: 'n3', type: 'differential', x: 0, y: 0, data: { efficiency: 98 } },
    ],
    connections: [],
    compCounter: 3,
    canvasOffset: { x: 0, y: 0 },
    canvasZoom: 1,
    simResults: null,
    resultSlots: [{}, {}, {}, {}],
    annotations: [{ type: 'note', x: 10, y: 20, text: 'ÖNEMLİ: korunmalı' }],
  }, extra || {});
}

describe('veBuildCleanTabState alan korunumu', () => {
  test('schemaVersion girdiden aynen taşınır', () => {
        const clean = veBuildCleanTabState(makeTabState(), {});
    expect(clean.schemaVersion).toBe(VE_SCHEMA_VERSION);
  });

  test('schemaVersion yoksa güncel sürümle doldurulur', () => {
    const st = makeTabState();
    delete st.schemaVersion;
    const clean = veBuildCleanTabState(st, {});
    expect(clean.schemaVersion).toBe(VE_SCHEMA_VERSION);
  });

  test('annotations korunur (içerik birebir)', () => {
    const clean = veBuildCleanTabState(makeTabState(), {});
    expect(clean.annotations).toHaveLength(1);
    expect(clean.annotations[0].text).toBe('ÖNEMLİ: korunmalı');
  });

  test('annotations yoksa boş dizi olur (undefined değil)', () => {
    const st = makeTabState();
    delete st.annotations;
    const clean = veBuildCleanTabState(st, {});
    expect(clean.annotations).toEqual([]);
  });

  test('stripResults yedek yolunda da iki alan korunur', () => {
    const clean = veBuildCleanTabState(makeTabState(), { stripResults: true });
    expect(clean.simResults).toBeNull();           // yedek: sonuçlar yazılmaz
    expect(clean.schemaVersion).toBe(VE_SCHEMA_VERSION);
    expect(clean.annotations).toHaveLength(1);
  });
});

describe('gidiş-dönüş: kullanıcı girdileri LEGACY migrasyonuyla ezilmez', () => {
  test('kaydet → diske yaz → oku → migrasyon: Cd=0.75 korunur', () => {
    const clean = veBuildCleanTabState(makeTabState(), {});
    const loaded = veApplyLegacyMigrations(diskRoundTrip(clean));

    const veh = loaded.nodes.find((n) => n.type === 'vehicle');
    expect(veh.data.ftCd).toBe(0.75);      // 0.900'e EZİLMEMELİ
    expect(veh.data.ftHeight).toBe(3);     // 3.200'e ezilmemeli
    expect(veh.data.ftWidth).toBe(2);      // 2.500'e ezilmemeli
  });

  test('gidiş-dönüş: wheel Crr ve diferansiyel verimi de korunur', () => {
    const clean = veBuildCleanTabState(makeTabState(), {});
    const loaded = veApplyLegacyMigrations(diskRoundTrip(clean));

    expect(loaded.nodes.find((n) => n.type === 'wheel').data.ftCrr).toBe(0.015);
    expect(loaded.nodes.find((n) => n.type === 'differential').data.efficiency).toBe(98);
  });

  test('gidiş-dönüş: notlar hayatta kalır', () => {
    const clean = veBuildCleanTabState(makeTabState(), {});
    const loaded = diskRoundTrip(clean);

    expect(loaded.annotations).toHaveLength(1);
    expect(loaded.annotations[0].text).toBe('ÖNEMLİ: korunmalı');
  });

  test('GERÇEK eski dosya (damgasız) hâlâ migrasyondan geçer', () => {
    // Damgayı korumak, asıl migrasyon işlevini bozmamalı: sürüm damgası
    // taşımayan eski dosyalar bir kez yeni varsayılanlara yükseltilmeli.
    const legacyFile = diskRoundTrip(makeTabState());
    delete legacyFile.schemaVersion;

    const loaded = veApplyLegacyMigrations(legacyFile);

    expect(loaded.nodes.find((n) => n.type === 'vehicle').data.ftCd).toBe(0.900);
    expect(loaded.nodes.find((n) => n.type === 'wheel').data.ftCrr).toBe(0.0035);
    expect(loaded.nodes.find((n) => n.type === 'differential').data.efficiency).toBe(96);
  });
});
