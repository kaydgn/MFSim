/**
 * state.js birim testleri
 * Undo/Redo stack yönetimi
 */

// jsdom ortamında global DOM öğelerini simüle et
document.body.innerHTML = '<div id="ve-canvas"></div>';

// Gerekli global değişkenler
global.nodes = [];
global.connections = [];
global.selectedNodes = [];
global.compCounter = 0;
global.canvasOffset = { x: 0, y: 0 };
global.canvasZoom = 1;

// Stub fonksiyonlar (state.js'nin bağımlılıkları)
global.showToast = jest.fn();
global.showEmptyProperties = jest.fn();
global.updateAllConnections = jest.fn();
global.updateNodeCount = jest.fn();
global.makeDraggable = jest.fn();
global.addResizeHandles = jest.fn();
global.addPortListeners = jest.fn();
global.veFlushOpenPanelData = jest.fn();
global.veSaveActiveTabState = jest.fn();
global.veRenderTabs = jest.fn();
global.componentDefs = {
  'Motor': { name: 'Motor', svg: '<svg></svg>', inputs: 0, outputs: 1 },
  'Gearbox': { name: 'Şanzıman', svg: '<svg></svg>', inputs: 1, outputs: 1 }
};
global.updateNodeHandles = jest.fn();
global.initNodeResize = jest.fn();
global.addConnectionListeners = jest.fn();

const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '../../js/state.js'), 'utf8');
eval(code);

// restoreState çok sayıda DOM bağımlılığına sahip, test ortamında
// sadece stack yönetimini test ediyoruz. restoreState'i noop yapıyoruz.
restoreState = jest.fn();

beforeEach(() => {
  // Her test öncesi temizle
  undoStack.length = 0;
  redoStack.length = 0;
  nodes = [];
  connections = [];
  showToast.mockClear();
});

describe('saveState', () => {
  test('undoStack\'e state ekler', () => {
    nodes = [{ id: 'n1', type: 'Motor', x: 100, y: 200, data: {} }];
    connections = [];
    saveState();
    expect(undoStack.length).toBe(1);
    expect(undoStack[0].nodes[0].id).toBe('n1');
  });

  test('deep copy yapar (referans paylaşmaz)', () => {
    nodes = [{ id: 'n1', type: 'Motor', x: 100, y: 200, data: { power: 50 } }];
    saveState();

    // Orijinal veriyi değiştir
    nodes[0].data.power = 999;
    nodes[0].x = 500;

    // Kaydedilen state değişmemiş olmalı
    expect(undoStack[0].nodes[0].data.power).toBe(50);
    expect(undoStack[0].nodes[0].x).toBe(100);
  });

  test('MAX_UNDO_STEPS sınırını korur', () => {
    for (let i = 0; i < 60; i++) {
      nodes = [{ id: 'n' + i, type: 'Motor', x: i, y: 0, data: {} }];
      saveState();
    }
    expect(undoStack.length).toBe(50);
    // İlk eklenen silinmiş, son eklenen kalmalı
    expect(undoStack[49].nodes[0].id).toBe('n59');
  });

  test('saveState redoStack\'i temizler', () => {
    nodes = [{ id: 'n1', type: 'Motor', x: 0, y: 0, data: {} }];
    saveState();
    saveState();
    undo(); // redoStack'e bir şey ekler
    expect(redoStack.length).toBe(1);

    saveState(); // Yeni işlem → redo temizlenmeli
    expect(redoStack.length).toBe(0);
  });

  test('connection verisini doğru serileştirir', () => {
    nodes = [];
    connections = [{
      id: 'c1',
      from: 'n1',
      to: 'n2',
      fromPort: 'output',
      toPort: 'input',
      lineType: 'curve',
      controlPoints: [{ x: 50, y: 50 }]
    }];
    saveState();
    expect(undoStack[0].connections[0].id).toBe('c1');
    expect(undoStack[0].connections[0].lineType).toBe('curve');
    expect(undoStack[0].connections[0].controlPoints).toEqual([{ x: 50, y: 50 }]);
  });
});

describe('undo', () => {
  test('stack boşken uyarı gösterir', () => {
    undo();
    expect(showToast).toHaveBeenCalledWith('Geri alınacak işlem yok', 'warning');
  });

  test('tek state varken uyarı gösterir (min 2 gerekli)', () => {
    nodes = [{ id: 'n1', type: 'Motor', x: 0, y: 0, data: {} }];
    saveState();
    undo();
    expect(showToast).toHaveBeenCalledWith('Geri alınacak işlem yok', 'warning');
  });

  test('undoStack\'ten redoStack\'e taşır', () => {
    nodes = [{ id: 'n1', type: 'Motor', x: 0, y: 0, data: {} }];
    saveState();
    nodes = [{ id: 'n1', type: 'Motor', x: 100, y: 0, data: {} }];
    saveState();

    expect(undoStack.length).toBe(2);
    expect(redoStack.length).toBe(0);

    undo();

    expect(undoStack.length).toBe(1);
    expect(redoStack.length).toBe(1);
  });
});

describe('redo', () => {
  test('stack boşken uyarı gösterir', () => {
    redo();
    expect(showToast).toHaveBeenCalledWith('İleri alınacak işlem yok', 'warning');
  });

  test('redoStack\'ten undoStack\'e taşır', () => {
    nodes = [{ id: 'n1', type: 'Motor', x: 0, y: 0, data: {} }];
    saveState();
    nodes = [{ id: 'n1', type: 'Motor', x: 100, y: 0, data: {} }];
    saveState();
    undo();

    expect(redoStack.length).toBe(1);
    redo();
    expect(redoStack.length).toBe(0);
    expect(undoStack.length).toBe(2);
  });
});

describe('şema sürümü damgası', () => {
  test('saveState state\'e VE_SCHEMA_VERSION damgası koyar', () => {
    nodes = [{ id: 'n1', type: 'vehicle', x: 0, y: 0, data: { ftCd: 0.75 } }];
    saveState();
    expect(undoStack[0].schemaVersion).toBe(VE_SCHEMA_VERSION);
  });
});

describe('veMigrateNodeData (LEGACY eski→yeni varsayılan)', () => {
  test('vehicle: Cd 0.75 → 0.90 yükseltir', () => {
    const node = { type: 'vehicle', data: { ftCd: 0.75 } };
    veMigrateNodeData(node);
    expect(node.data.ftCd).toBe(0.900);
  });

  test('vehicle: H=3.0→3.2, W=2.0→2.5 yükseltir', () => {
    const node = { type: 'vehicle', data: { ftHeight: 3.0, ftWidth: 2.0 } };
    veMigrateNodeData(node);
    expect(node.data.ftHeight).toBe(3.200);
    expect(node.data.ftWidth).toBe(2.500);
  });

  test('wheel: Crr 0.015 → 0.0035; differential: verim 98 → 96', () => {
    const wheel = { type: 'wheel', data: { ftCrr: 0.015 } };
    const diff = { type: 'differential', data: { efficiency: 98 } };
    veMigrateNodeData(wheel);
    veMigrateNodeData(diff);
    expect(wheel.data.ftCrr).toBe(0.0035);
    expect(diff.data.efficiency).toBe(96);
  });

  test('eski varsayılana EŞİT OLMAYAN kasıtlı değerlere dokunmaz', () => {
    const node = { type: 'vehicle', data: { ftCd: 0.76, ftHeight: 3.5, ftWidth: 2.5 } };
    veMigrateNodeData(node);
    expect(node.data.ftCd).toBe(0.76);
    expect(node.data.ftHeight).toBe(3.5);
    expect(node.data.ftWidth).toBe(2.5);
  });
});

describe('veApplyLegacyMigrations (sürüm-kapılı migrasyon)', () => {
  test('LEGACY state (sürümsüz): Cd 0.75 → 0.90', () => {
    const state = { nodes: [{ type: 'vehicle', data: { ftCd: 0.75 } }] };
    veApplyLegacyMigrations(state);
    expect(state.nodes[0].data.ftCd).toBe(0.900);
  });

  // Kullanıcının bildirdiği bug'ın regresyon kilidi: 0.75 yaz → hep 0.9 hesaplanıyordu.
  // Sürümlü state'te (undo/redo, sekme değiştirme, güncel kayıt) migrasyon ÇALIŞMAMALI.
  test('SÜRÜMLÜ state: kasıtlı Cd=0.75 KORUNUR (0.90\'a ezilmez)', () => {
    const state = { schemaVersion: VE_SCHEMA_VERSION, nodes: [{ type: 'vehicle', data: { ftCd: 0.75 } }] };
    veApplyLegacyMigrations(state);
    expect(state.nodes[0].data.ftCd).toBe(0.75);
  });

  test('saveState çıktısı (sürümlü) tekrar migrasyona sokulsa bile 0.75 korunur', () => {
    nodes = [{ id: 'v1', type: 'vehicle', x: 0, y: 0, data: { ftCd: 0.75 } }];
    saveState();
    const saved = undoStack[undoStack.length - 1];
    veApplyLegacyMigrations(saved); // undo/redo yeniden yükleme simülasyonu
    expect(saved.nodes[0].data.ftCd).toBe(0.75);
  });
});

describe('undo-redo döngüsü', () => {
  test('birden fazla undo-redo tutarlı', () => {
    for (let i = 0; i < 5; i++) {
      nodes = [{ id: 'n1', type: 'Motor', x: i * 10, y: 0, data: {} }];
      saveState();
    }
    expect(undoStack.length).toBe(5);

    undo();
    undo();
    undo();
    expect(undoStack.length).toBe(2);
    expect(redoStack.length).toBe(3);

    redo();
    expect(undoStack.length).toBe(3);
    expect(redoStack.length).toBe(2);

    // Yeni işlem redo'yu temizler
    nodes = [{ id: 'new', type: 'Motor', x: 999, y: 0, data: {} }];
    saveState();
    expect(redoStack.length).toBe(0);
    expect(undoStack.length).toBe(4);
  });
});
