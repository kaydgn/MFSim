/**
 * subtopology-embed-sanitize.test.js — Gömülü/kaydedilen durumun hafifletilmesi
 * ────────────────────────────────────────────────────────────────────────────
 * Regresyon (RangeError: Invalid string length + autosave QuotaExceededError):
 *
 * veSerializeCurrentState() çıktısı `undoStack`/`redoStack` (50'şer anlık görüntü)
 * ve tam çözünürlüklü `simResults` içerir. Alt-topoloji çıkışında bu çıktı OLDUĞU
 * GİBİ node.data.subTopology'ye yazılıyordu; saveState() ise o node.data'yı (sub-
 * Topology dahil) HER undo adımına kopyalıyordu → çarpımsal iç içe geçme:
 *   N seviye × 50 undo × 50 alt-undo × her seviyede tam sim → JSON.stringify
 *   V8 string sınırını (~512 MB) aşar; localStorage kotasını taşırır.
 *
 * Çözüm: veSanitizeEmbeddedState() gömme/kayıt ÖNCESİ undo/redo'yu atar, sonuçları
 * seyreltir/siler ve iç içe subTopology'leri özyinelemeli temizler — GİRDİYİ
 * MUTASYONA UĞRATMADAN. Bu test o davranışın çekirdeğini doğrular.
 */

// topology.js sonundaki sekme-init IIFE'si setTimeout kullanır → sahte timer.
jest.useFakeTimers();

const fs = require('fs');
const path = require('path');

// topology.js'in kendi fonksiyonları gerçek çalışır; ihtiyaç duydukları global durum:
global.nodes = [];
global.connections = [];
global.compCounter = 0;
global.canvasOffset = { x: 0, y: 0 };
global.canvasZoom = 1;
global.undoStack = [];
global.redoStack = [];
global.veResultSlots = [{}, {}, {}, {}];
global.selectedNodes = [];
global.window.veSimResults = null;

// Alt-topoloji editör stub'ları (cp-*.js'te tanımlı) — topology.js init'i güvenli olsun.
global.veAracOpenEditor = jest.fn();
global.veMntOpenEditor = jest.fn();
global.veAracCollapseToRoot = jest.fn();
global.veMntCollapseToRoot = jest.fn();
global.veAracStack = [];
global.veMntStack = [];

// topology.js'i yükle → veSanitizeEmbeddedState / veSanitizeNodesSubtopology
// (ve VE_SUBTOPO_SANITIZE_MAX_DEPTH) test kapsamına gelir.
eval(fs.readFileSync(path.join(__dirname, '../../js/topology.js'), 'utf8'));

// Küçük bir seyreltme stub'ı: veDecimateSimResults toolbar.js'te; burada yok.
// typeof kontrolü sayesinde stub verilene kadar simResults referans olarak korunur.
function withDecimateStub(fn) {
  const spy = jest.fn(function (sim, maxPoints) {
    return { __decimated: true, maxPoints: maxPoints, srcLen: (sim && sim.time) ? sim.time.length : 0 };
  });
  global.veDecimateSimResults = spy;
  try { return fn(spy); }
  finally { delete global.veDecimateSimResults; }
}

// Tam bir serileştirilmiş durum taklidi (undo/sim dolu + iç içe subTopology).
function mkState(overrides) {
  return Object.assign({
    nodes: [{ id: 'a', type: 'engine', data: { power: 50 } }],
    connections: [{ id: 'c1', from: 'a', to: 'b' }],
    compCounter: 3,
    canvasOffset: { x: 10, y: 20 },
    canvasZoom: 1.5,
    undoStack: [{ nodes: [1] }, { nodes: [2] }, { nodes: [3] }],
    redoStack: [{ nodes: [9] }],
    simResults: { time: [0, 1, 2], mode: 'full' },
    resultSlots: [{ sensors: [{ id: 'a' }] }, {}, {}, {}],
    annotations: [{ id: 'note1' }]
  }, overrides || {});
}

describe('veSanitizeEmbeddedState — uçucu alanları atar', () => {
  test('undoStack ve redoStack boşaltılır', () => {
    var out = veSanitizeEmbeddedState(mkState());
    expect(out.undoStack).toEqual([]);
    expect(out.redoStack).toEqual([]);
  });

  test('yapısal alanlar (topoloji, canvas, panel konf.) KORUNUR', () => {
    var out = veSanitizeEmbeddedState(mkState());
    expect(out.connections).toHaveLength(1);
    expect(out.compCounter).toBe(3);
    expect(out.canvasOffset).toEqual({ x: 10, y: 20 });
    expect(out.canvasZoom).toBe(1.5);
    expect(out.resultSlots[0].sensors).toHaveLength(1);
    expect(out.annotations).toEqual([{ id: 'note1' }]);
    expect(out.nodes[0].type).toBe('engine');
  });

  test('GİRDİ mutasyona uğramaz (canlı tab.state/node.data korunur)', () => {
    var input = mkState();
    var origUndo = input.undoStack;
    veSanitizeEmbeddedState(input);
    expect(input.undoStack).toBe(origUndo);       // aynı referans
    expect(input.undoStack).toHaveLength(3);       // boşaltılmadı
    expect(input.redoStack).toHaveLength(1);
    expect(input.simResults).not.toBeNull();
  });

  test('null / ilkel / dizisiz girdi güvenli', () => {
    expect(veSanitizeEmbeddedState(null)).toBeNull();
    expect(veSanitizeEmbeddedState(undefined)).toBeUndefined();
    expect(veSanitizeEmbeddedState(42)).toBe(42);
    var noNodes = veSanitizeEmbeddedState({ compCounter: 1 });
    expect(noNodes.undoStack).toEqual([]);
    expect(noNodes.compCounter).toBe(1);
  });
});

describe('veSanitizeEmbeddedState — simResults politikası', () => {
  test('stripResults=true → sonuçlar tamamen düşer', () => {
    var out = veSanitizeEmbeddedState(mkState(), { stripResults: true });
    expect(out.simResults).toBeNull();
  });

  test('veDecimateSimResults yoksa simResults referans olarak korunur', () => {
    var input = mkState();
    var out = veSanitizeEmbeddedState(input);          // stub yok
    expect(out.simResults).toBe(input.simResults);
  });

  test('veDecimateSimResults varsa simResults seyreltilir (maxPoints iletilir)', () => {
    withDecimateStub(function (spy) {
      var out = veSanitizeEmbeddedState(mkState(), { maxPoints: 500 });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][1]).toBe(500);
      expect(out.simResults.__decimated).toBe(true);
    });
  });
});

describe('veSanitizeEmbeddedState — iç içe subTopology (çarpımsal büyüme freni)', () => {
  // Her seviyede undo + sim taşıyan 3 seviyeli iç içe yapı kur.
  function mkNested() {
    var lvl3 = mkState({ nodes: [{ id: 'w', type: 'wheel', data: {} }] });
    var lvl2 = mkState({ nodes: [{ id: 'arac2', type: 'arac-performans', data: { subTopology: lvl3 } }] });
    var lvl1 = mkState({ nodes: [{ id: 'arac1', type: 'arac-performans', data: { subTopology: lvl2 } }] });
    return lvl1;
  }

  test('TÜM seviyelerde undo/redo boşaltılır (blowup önlenir)', () => {
    var out = veSanitizeEmbeddedState(mkNested());
    var l1 = out;
    var l2 = l1.nodes[0].data.subTopology;
    var l3 = l2.nodes[0].data.subTopology;
    [l1, l2, l3].forEach(function (lvl) {
      expect(lvl.undoStack).toEqual([]);
      expect(lvl.redoStack).toEqual([]);
    });
  });

  test('iç içe temizleme GİRDİYİ mutasyona uğratmaz', () => {
    var input = mkNested();
    var innerUndo = input.nodes[0].data.subTopology.undoStack;
    veSanitizeEmbeddedState(input);
    expect(innerUndo).toHaveLength(3); // orijinal iç undo dokunulmadı
    expect(input.nodes[0].data.subTopology.undoStack).toBe(innerUndo);
  });

  test('stripResults iç içe seviyelere de uygulanır', () => {
    var out = veSanitizeEmbeddedState(mkNested(), { stripResults: true });
    expect(out.simResults).toBeNull();
    expect(out.nodes[0].data.subTopology.simResults).toBeNull();
    expect(out.nodes[0].data.subTopology.nodes[0].data.subTopology.simResults).toBeNull();
  });

  test('subTopology olmayan düğüm alt-topoloji dalına girmez (aynı dizi referansı)', () => {
    var input = mkState(); // düğümlerinde subTopology yok
    var out = veSanitizeEmbeddedState(input);
    expect(out.nodes).toBe(input.nodes); // gereksiz kopya üretilmedi
  });

  test('aşırı derinlikte güvenlik freni: daha derini kesilir (yığın taşması yok)', () => {
    // MAX_DEPTH+2 seviyeli zincir kur → en derin subTopology null'a düşmeli.
    var depth = VE_SUBTOPO_SANITIZE_MAX_DEPTH + 2;
    var cur = mkState({ nodes: [{ id: 'leaf', type: 'wheel', data: {} }] });
    for (var i = 0; i < depth; i++) {
      cur = mkState({ nodes: [{ id: 'n' + i, type: 'arac-performans', data: { subTopology: cur } }] });
    }
    var out;
    expect(function () { out = veSanitizeEmbeddedState(cur); }).not.toThrow();
    // Zinciri in → bir yerde subTopology null olmalı (kesim gerçekleşti).
    var node = out.nodes[0];
    var cutFound = false;
    for (var g = 0; g < depth + 5 && node; g++) {
      var sub = node.data && node.data.subTopology;
      if (sub === null) { cutFound = true; break; }
      if (!sub || !sub.nodes || !sub.nodes.length) break;
      node = sub.nodes[0];
    }
    expect(cutFound).toBe(true);
  });
});

describe('veSanitizeNodesSubtopology — düğüm dizisi düzeyi', () => {
  test('dizi olmayan girdi aynen döner', () => {
    expect(veSanitizeNodesSubtopology(null)).toBeNull();
    expect(veSanitizeNodesSubtopology(undefined)).toBeUndefined();
  });

  test('subTopology içeren düğüm için undo iç seviyede temizlenir; diğerleri aynen', () => {
    var plain = { id: 'p', type: 'engine', data: { power: 1 } };
    var withSub = { id: 's', type: 'arac-performans', data: { subTopology: mkState() } };
    var out = veSanitizeNodesSubtopology([plain, withSub]);
    expect(out[0]).toBe(plain);                                   // dokunulmadı (aynı ref)
    expect(out[1]).not.toBe(withSub);                             // kopyalandı
    expect(out[1].data.subTopology.undoStack).toEqual([]);       // iç undo temizlendi
    expect(withSub.data.subTopology.undoStack).toHaveLength(3);  // orijinal korundu
  });
});
