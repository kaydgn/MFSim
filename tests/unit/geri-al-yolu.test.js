/**
 * geri-al-yolu.test.js — GERİ-AL YOLU: YIĞINDAKİ DURUM BİR ANLIK GÖRÜNTÜDÜR
 * ─────────────────────────────────────────────────────────────────────────
 * state.test.js `restoreState`i SAHTE yapıyor (jest.fn) — yığının yönetimini
 * ölçüyor, geri yüklemenin kendisini değil. Bu dosya GERÇEK restoreState ile
 * koşar; aşağıdaki iki kusur ancak orada görünüyordu (ölçüldü, 2026-09-23,
 * gerçek tarayıcıda ok tuşu + Ctrl+Z ile):
 *
 *   1) GEÇMİŞ YENİDEN YAZILIYORDU. restoreState düğümün `data`sını durumun
 *      KENDİ nesnesinden alıyor ve undo/redo yığındaki kaydı doğrudan geri
 *      yüklüyordu. Geri-al'dan sonraki ilk yerinde düzenleme
 *      (`node.data.x = …`) o kaydı da değiştiriyor, sonraki Ctrl+Z "Geri
 *      alındı" deyip HİÇBİR ŞEYİ geri almıyordu. Her modülde, ana tuvalde de.
 *   2) FEAD KARTI BOŞ KALIYORDU. restoreState kartı düğümünü kurarken kuruyor;
 *      kart kasnaklardan ÖNCE geliyorsa (örnek, açılış kartını yeniden
 *      kullanıyor) model o an YARIM ve kart "henüz kasnak yok" basıyor.
 *      Ardından gelen tazeleme topoloji imzasına bağlıydı: imzaya girmeyen bir
 *      alan geri alınınca imza aynı kalıyor ve kart boş kalıyordu.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const B = require('../../js/fead-belts.js');
const fead = require('../../js/cp-fead.js');

const stubs = stubGlobals({
  // restoreState'in DOM kurarken çağırdığı kabuk yardımcıları — geri
  // yüklemenin ölçülen kısmı (düğüm verisi + kart içeriği) bunlara bağlı değil.
  vePortStyleAttr: jest.fn(() => ''), escapeHTML: jest.fn((s) => String(s)),
  updateNodeHandles: jest.fn(), startResize: jest.fn(), enablePortContextMenu: jest.fn(),
  veAttachNodeDrag: jest.fn(), veAttachPortConnect: jest.fn(), getPortPosition: jest.fn(() => ({ x: 0, y: 0 })),
  updatePortPosition: jest.fn(), applyNodeLabelPos: jest.fn(), showLabelContextMenu: jest.fn(),
  updateNodeCount: jest.fn(), clearSelection: jest.fn(), veMinimapUpdate: jest.fn(),
  veUpdateBoundary: jest.fn(),
});
document.body.innerHTML = '<div id="ve-canvas"></div>'
  + '<svg id="ve-connections-layer"></svg>';
global.nodes = [];
global.connections = [];
global.selectedNodes = [];
global.compCounter = 0;
global.canvasOffset = { x: 0, y: 0 };
global.canvasZoom = 1;
global.isConnecting = false;                // results.js'in globali (updateAllConnections okur)
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.VE_STANDALONE_TYPES = VE_STANDALONE_TYPES;
global.FEADCore = F;
Object.keys(B).forEach((k) => { global[k] = B[k]; });
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { global[k] = fead[k]; });
eval(loadSource('state.js'));
eval(loadSource('connections.js'));   // updateAllConnections + topoloji imzası
veStopAutoSync();
// cp-fead.js `require` ile yüklendi: çıplak saveState / updateAllConnections
// referansları GLOBAL'i arar. Gerçekleri verilmezse kasnak kaydırma sahte
// saveState'e yazar ve yığın hiç büyümez — kapı hiçbir şey ölçmezdi.
global.saveState = saveState;
global.updateAllConnections = updateAllConnections;

beforeEach(() => {
  resetStubs(stubs);
  undoStack.length = 0;
  redoStack.length = 0;
});

describe('yığın canlı modele BAĞLANMAZ — her modülde', () => {
  const arac = () => nodes.find((n) => n.type === 'vehicle');
  beforeEach(() => {
    restoreState({ schemaVersion: VE_SCHEMA_VERSION, connections: [],
      nodes: [{ id: 'comp-1', type: 'vehicle', x: 3100, y: 3000, data: { ftCd: 0.9 } }] });
    saveState();
  });

  test('geri al → yerinde düzenle → geri al: İKİNCİ geri-al da geri alır', () => {
    arac().data.ftCd = 0.5; saveState();
    undo();
    expect(arac().data.ftCd).toBe(0.9);
    arac().data.ftCd = 0.6; saveState();       // setter'ların kalıbı: önce yaz, sonra kaydet
    undo();
    expect(arac().data.ftCd).toBe(0.9);        // eskiden 0.6 — kayıt yeniden yazılmıştı
  });

  test('ileri-al da bağlamaz', () => {
    arac().data.ftCd = 0.5; saveState();
    undo(); redo();
    expect(arac().data.ftCd).toBe(0.5);
    arac().data.ftCd = 0.7; saveState();
    undo();
    expect(arac().data.ftCd).toBe(0.5);
  });

  test('geri yüklenen düğüm kaydın NESNESİNİ taşımaz — eşit ama ayrı', () => {
    arac().data.ftCd = 0.5; saveState();
    undo();
    const kayit = undoStack[undoStack.length - 1].nodes[0];
    expect(arac().data).toEqual(kayit.data);
    expect(arac().data).not.toBe(kayit.data);
  });
});

describe('FEAD: geri yüklenen Kayış Yolu kartı TAM modelle kurulur', () => {
  // Kart kasnaklardan ÖNCE — örnek, açılış yüzeyinin kartını yeniden
  // kullandığı için kurulmuş bir modelde sıra budur.
  const kur = () => {
    const ex = M.veFeadExampleNodes('AG00976_GATES_2025').nodes
      .filter((n) => n.id !== 'ex-run')
      .map((n) => Object.assign({ x: 3000, y: 3000 }, JSON.parse(JSON.stringify(n))));
    const kart = ex.find((n) => n.id === 'ex-layout');
    restoreState({ schemaVersion: VE_SCHEMA_VERSION, connections: [],
      nodes: [kart].concat(ex.filter((n) => n !== kart)) });
    saveState();
  };
  const kart = () => {
    const el = document.getElementById('ex-layout');
    const c = el && el.querySelector('.' + VE_FEAD_CARD_CLASS);
    if (!c) return 'KART YOK';
    if (c.querySelector('.ve-fead-kan-bos')) return 'BOŞ';
    return c.querySelector('svg') ? 'çizim' : '?';
  };
  const alt = () => nodes.find((n) => n.type === 'fead-alternator');
  beforeEach(kur);

  test('ön koşul: kart kasnaklardan önce ve çizimi var', () => {
    expect(nodes[0].id).toBe('ex-layout');
    expect(kart()).toBe('çizim');
  });

  test('İMZAYA GİRMEYEN bir alanın geri alınması kartı boşaltmaz', () => {
    const imza = veFeadTopoSignature();
    nodes.find((n) => n.type === 'fead-solver').data.denemeAlani = 1;
    saveState();
    undo();
    expect(veFeadTopoSignature()).toBe(imza);  // tazelemeyi imza tetiklemiyor
    expect(kart()).toBe('çizim');              // eskiden 'BOŞ'
  });

  test('kasnağı kaydır → geri al → kaydır → geri al: koordinat iki kez de döner', () => {
    const x0 = alt().data.x;
    expect(veFeadKasnakKaydir(alt().id, 1, 0)).toBe(true);
    undo();
    expect(alt().data.x).toBe(x0);
    expect(veFeadKasnakKaydir(alt().id, 1, 0)).toBe(true);
    undo();
    expect(alt().data.x).toBe(x0);             // eskiden x0 + 1
    expect(kart()).toBe('çizim');
  });
});
