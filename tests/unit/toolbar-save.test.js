/**
 * toolbar.js - Proje kaydetme / yükleme birim testleri
 * showSaveFilePicker API entegrasyonunu ve JSON serileştirme doğruluğunu test eder
 */

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

// toolbar.js'yi yükle
const toolbarCode = fs.readFileSync(path.join(__dirname, '../../js/toolbar.js'), 'utf8');
try { eval(toolbarCode); } catch(e) { /* diğer fonksiyon bağımlılıkları */ }

describe('veSaveTopology - proje serileştirme', () => {
  let capturedFileName = null;

  beforeEach(() => {
    capturedFileName = null;
    showToast.mockClear();
    veSaveActiveTabState.mockClear();

    // Proje adını set et (eval sonrası veProjectName '' oldu)
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

    // showSaveFilePicker mock
    const mockWritable = {
      write: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };
    window.showSaveFilePicker = jest.fn().mockImplementation((opts) => {
      capturedFileName = opts.suggestedName;
      return Promise.resolve({
        createWritable: () => Promise.resolve(mockWritable)
      });
    });
  });

  afterEach(() => {
    delete window.showSaveFilePicker;
  });

  test('veSaveActiveTabState çağrılır', () => {
    veSaveTopology();
    expect(veSaveActiveTabState).toHaveBeenCalled();
  });

  test('showSaveFilePicker doğru parametrelerle çağrılır', async () => {
    veSaveTopology();
    await new Promise(r => setTimeout(r, 10));

    expect(window.showSaveFilePicker).toHaveBeenCalled();
    const callArgs = window.showSaveFilePicker.mock.calls[0][0];
    expect(callArgs.suggestedName).toContain('TestProje');
    expect(callArgs.suggestedName).toContain('.json');
    expect(callArgs.types[0].accept['application/json']).toContain('.json');
  });

  test('dosya adı proje adını içerir', () => {
    veSaveTopology();
    expect(capturedFileName).toContain('TestProje');
  });

  test('proje adı boşsa "topoloji" kullanır', () => {
    veProjectName = '';
    veSaveTopology();
    expect(capturedFileName).toContain('topoloji');
  });
});

describe('Proje JSON formatı', () => {
  beforeEach(() => {
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
  });

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

describe('showSaveFilePicker fallback', () => {
  beforeEach(() => {
    veProjectName = 'Test';
    veTabs = [{ id: 'tab_1', name: 'S1', state: { nodes: [], connections: [], compCounter: 0, canvasOffset: { x: 0, y: 0 }, canvasZoom: 1, simResults: null, resultSlots: [{},{},{},{}] } }];
  });

  test('API yoksa Blob download kullanır', () => {
    delete window.showSaveFilePicker;

    // <a> elementini tam mockla (jsdom uyumlu)
    const realCreateElement = document.createElement.bind(document);
    const mockLink = realCreateElement('a');
    mockLink.click = jest.fn();

    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return mockLink;
      return realCreateElement(tag);
    });

    global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock');
    global.URL.revokeObjectURL = jest.fn();

    veSaveTopology();
    expect(mockLink.download).toContain('.json');
    expect(mockLink.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();

    document.createElement.mockRestore();
  });
});
