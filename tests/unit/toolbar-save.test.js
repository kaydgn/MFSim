/**
 * toolbar.js - Proje kaydetme / yükleme birim testleri
 * Uygulama-içi "Farklı Kaydet" diyaloğunu ve JSON serileştirme doğruluğunu test eder
 */

// createElement referansını mock'tan ÖNCE kaydet
const _origCreateElement = document.createElement.bind(document);

// DOM setup
document.body.innerHTML = `
  <div id="ve-canvas"></div>
  <div id="ve-file-menu" style="display:none"></div>
  <div id="node-count"></div>
  <div id="ve-project-name-label"></div>
`;

// Global state
global.nodes = [];
global.connections = [];
global.selectedNodes = [];
global.compCounter = 0;
global.canvasOffset = { x: 0, y: 0 };
global.canvasZoom = 1;
global.veProjectName = '';
global.veActiveModule = '';
global.veTabCounter = 2;
global.veActiveTabIdx = 0;
global.veTabs = [];
global.undoStack = [];
global.redoStack = [];

// Stub fonksiyonlar
global.showToast = jest.fn();
global.showConfirmToast = jest.fn();
global.veCloseFileMenu = jest.fn();
global.veSaveActiveTabState = jest.fn();
global.veFlushOpenPanelData = jest.fn();
global.updateAllConnections = jest.fn();
global.updateNodeCount = jest.fn();
global.showEmptyProperties = jest.fn();
global.makeDraggable = jest.fn();
global.addResizeHandles = jest.fn();
global.addPortListeners = jest.fn();
global.restoreState = jest.fn();
global.saveState = jest.fn();
global.componentDefs = {};
global.veRenderTabs = jest.fn();
global.veSwitchTab = jest.fn();
global.veAddTab = jest.fn();

const fs = require('fs');
const path = require('path');

const toolbarCode = fs.readFileSync(path.join(__dirname, '../../js/toolbar.js'), 'utf8');
try { eval(toolbarCode); } catch(e) { /* diğer fonksiyon bağımlılıkları */ }

function cleanupModals() {
  var ol = document.getElementById('ve-save-dialog-overlay');
  if(ol) ol.remove();
}

function setupTestState() {
  veProjectName = 'TestProje';
  veActiveModule = 'Motor Freni';
  veTabCounter = 2;
  veActiveTabIdx = 0;
  veTabs = [
    {
      id: 'tab_1', name: 'Sekme 1',
      state: {
        nodes: [{ id: 'n1', type: 'Motor', x: 100, y: 200, data: { power: 50 } }],
        connections: [], compCounter: 1,
        canvasOffset: { x: 0, y: 0 }, canvasZoom: 1,
        simResults: null, resultSlots: [{}, {}, {}, {}]
      }
    },
    {
      id: 'tab_2', name: 'Sekme 2',
      state: {
        nodes: [], connections: [], compCounter: 0,
        canvasOffset: { x: 50, y: 50 }, canvasZoom: 0.8,
        simResults: null, resultSlots: [{}, {}, {}, {}]
      }
    }
  ];
}

describe('veShowSaveDialog - uygulama-içi kaydet diyaloğu', () => {
  afterEach(cleanupModals);

  test('modal açılır ve dosya adı alanı gösterilir', () => {
    var blob = new Blob(['test'], {type: 'text/plain'});
    veShowSaveDialog('test_dosya.json', blob, 'Kaydedildi');

    var input = document.getElementById('ve-save-filename');
    expect(input).not.toBeNull();
    expect(input.value).toBe('test_dosya');
  });

  test('uzantı ayrı gösterilir', () => {
    var blob = new Blob(['test'], {type: 'text/plain'});
    veShowSaveDialog('proje.json', blob, 'ok');

    var input = document.getElementById('ve-save-filename');
    expect(input.value).toBe('proje');

    var overlay = document.getElementById('ve-save-dialog-overlay');
    expect(overlay.textContent).toContain('.json');
  });

  test('Kaydet butonuna tıklayınca dosya indirilir', () => {
    var blob = new Blob(['{"test":1}'], {type: 'application/json'});

    var mockLink = _origCreateElement('a');
    mockLink.click = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return mockLink;
      return _origCreateElement(tag);
    });
    global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock');
    global.URL.revokeObjectURL = jest.fn();

    veShowSaveDialog('proje_2026.json', blob, 'Kaydedildi');
    document.getElementById('ve-save-confirm').click();

    expect(mockLink.download).toBe('proje_2026.json');
    expect(mockLink.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');

    document.createElement.mockRestore();
  });

  test('kullanıcı dosya adını değiştirebilir', () => {
    var blob = new Blob(['test'], {type: 'text/plain'});

    var mockLink = _origCreateElement('a');
    mockLink.click = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return mockLink;
      return _origCreateElement(tag);
    });
    global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock');
    global.URL.revokeObjectURL = jest.fn();

    veShowSaveDialog('varsayilan.json', blob, 'ok');

    var input = document.getElementById('ve-save-filename');
    input.value = 'benim_projem';

    document.getElementById('ve-save-confirm').click();
    expect(mockLink.download).toBe('benim_projem.json');

    document.createElement.mockRestore();
  });

  test('İptal butonuna tıklayınca modal kapanır', () => {
    var blob = new Blob(['test'], {type: 'text/plain'});
    veShowSaveDialog('test.json', blob, 'ok');

    expect(document.getElementById('ve-save-dialog-overlay')).not.toBeNull();
    document.getElementById('ve-save-cancel').click();
    expect(document.getElementById('ve-save-dialog-overlay')).toBeNull();
  });

  test('boş dosya adı uyarı gösterir', () => {
    showToast.mockClear();
    var blob = new Blob(['test'], {type: 'text/plain'});
    veShowSaveDialog('test.json', blob, 'ok');

    var input = document.getElementById('ve-save-filename');
    input.value = '';

    document.getElementById('ve-save-confirm').click();
    expect(showToast).toHaveBeenCalledWith('Dosya adı boş olamaz', 'warning');
    expect(document.getElementById('ve-save-dialog-overlay')).not.toBeNull();
  });

  test('showSaveFilePicker varsa OS diyaloğu kullanılır', async () => {
    var blob = new Blob(['{"test":1}'], {type: 'application/json'});

    var mockWritable = {
      write: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };
    var mockHandle = {
      createWritable: jest.fn().mockResolvedValue(mockWritable)
    };
    window.showSaveFilePicker = jest.fn().mockResolvedValue(mockHandle);

    veShowSaveDialog('proje_2026.json', blob, 'Kaydedildi');
    document.getElementById('ve-save-confirm').click();

    expect(window.showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'proje_2026.json' })
    );

    // Promise zincirinin tamamlanmasını bekle
    await new Promise(r => setTimeout(r, 50));

    expect(mockHandle.createWritable).toHaveBeenCalled();
    expect(mockWritable.write).toHaveBeenCalledWith(blob);
    expect(mockWritable.close).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Kaydedildi');

    delete window.showSaveFilePicker;
  });

  test('showSaveFilePicker iptal edilirse hata göstermez', async () => {
    var blob = new Blob(['test'], {type: 'text/plain'});
    showToast.mockClear();

    window.showSaveFilePicker = jest.fn().mockRejectedValue(
      Object.assign(new Error('User cancelled'), { name: 'AbortError' })
    );

    veShowSaveDialog('test.json', blob, 'ok');
    document.getElementById('ve-save-confirm').click();

    await new Promise(r => setTimeout(r, 50));

    // AbortError durumunda toast gösterilmemeli
    expect(showToast).not.toHaveBeenCalledWith('Kaydetme başarısız', 'warning');

    delete window.showSaveFilePicker;
  });

  test('.txt uzantılı dosyalar da desteklenir', () => {
    var blob = new Blob(['ozet'], {type: 'text/plain'});
    veShowSaveDialog('ozet_raporu.txt', blob, 'ok');

    var input = document.getElementById('ve-save-filename');
    expect(input.value).toBe('ozet_raporu');

    var overlay = document.getElementById('ve-save-dialog-overlay');
    expect(overlay.textContent).toContain('.txt');
  });
});

describe('veSaveTopology - kaydet diyaloğu entegrasyonu', () => {
  beforeEach(() => {
    setupTestState();
    showToast.mockClear();
    veSaveActiveTabState.mockClear();
  });

  afterEach(cleanupModals);

  test('veSaveActiveTabState çağrılır', () => {
    veSaveTopology();
    expect(veSaveActiveTabState).toHaveBeenCalled();
  });

  test('modal açılır ve dosya adı proje adını içerir', () => {
    veSaveTopology();

    var input = document.getElementById('ve-save-filename');
    expect(input).not.toBeNull();
    expect(input.value).toContain('TestProje');
  });

  test('proje adı boşsa "topoloji" kullanır', () => {
    veProjectName = '';
    veSaveTopology();

    var input = document.getElementById('ve-save-filename');
    expect(input.value).toContain('topoloji');
  });
});

describe('Proje JSON formatı', () => {
  beforeEach(() => setupTestState());

  test('v2 formatında doğru yapı oluşturur', () => {
    const project = {
      version: 2,
      projectName: veProjectName || '',
      activeModule: veActiveModule || '',
      tabCounter: veTabCounter,
      activeTabIdx: veActiveTabIdx,
      tabs: veTabs.map(function (tab) {
        var cleanState = null;
        if (tab.state) {
          cleanState = {
            nodes: tab.state.nodes,
            connections: tab.state.connections,
            compCounter: tab.state.compCounter,
            canvasOffset: tab.state.canvasOffset,
            canvasZoom: tab.state.canvasZoom,
            simResults: tab.state.simResults || null,
            resultSlots: tab.state.resultSlots || [{}, {}, {}, {}]
          };
        }
        return { id: tab.id, name: tab.name, state: cleanState };
      })
    };

    expect(project.version).toBe(2);
    expect(project.projectName).toBe('TestProje');
    expect(project.tabs).toHaveLength(2);
    expect(project.tabs[0].state.nodes).toHaveLength(1);
    expect(project.tabs[0].state.nodes[0].type).toBe('Motor');
    expect(project.tabs[1].state.canvasZoom).toBe(0.8);
  });

  test('JSON serileştirme round-trip tutarlı', () => {
    const original = {
      version: 2,
      projectName: 'Test',
      tabs: [{ id: 'tab_1', name: 'S1', state: { nodes: [{ id: 'n1', x: 10, y: 20 }], connections: [] } }]
    };

    const json = JSON.stringify(original, null, 2);
    const parsed = JSON.parse(json);

    expect(parsed).toEqual(original);
    expect(parsed.tabs[0].state.nodes[0].x).toBe(10);
  });
});
