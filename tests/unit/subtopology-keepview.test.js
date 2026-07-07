/**
 * subtopology-keepview.test.js — Alt-topoloji görünümünü koruyan kaydetme
 * ──────────────────────────────────────────────────────────────────────
 * Regresyon: Kullanıcı bir alt-topolojiye (Araç Performans / Takoz iç topolojisi)
 * girdikten sonra, arka-plan/yan işlemler (otomatik-kaydet, sonuç ağacı yenileme,
 * dosya kaydı, sekme çoğaltma, snapshot) program tarafından ANA topolojiye
 * atılmasına yol açıyordu.
 *
 * Neden: bu çağıranların hepsi veSaveActiveTabState() kullanıyordu; o da doğru
 * serileştirme için açık alt-topolojiyi köke çökertir (veAracCollapseToRoot /
 * veMntCollapseToRoot) ama kullanıcıyı geri getirmez.
 *
 * Çözüm: veSaveActiveTabStateKeepView() — köke çök → serialize → kullanıcıyı
 * bulunduğu alt-topolojiye SESSİZCE (veAracOpenEditor/veMntOpenEditor, _silent=true)
 * geri getir. TERMINAL akışlar (sekme değiştir/yükle) düz veSaveActiveTabState()
 * kullanmaya devam eder — bu test her iki davranışı da doğrular.
 */

// topology.js sonundaki sekme-init IIFE'si setTimeout kullanır → sahte timer.
jest.useFakeTimers();

const fs = require('fs');
const path = require('path');

// veSerializeCurrentState / veFlushOpenPanelData gibi topology.js'in KENDİ
// fonksiyonları gerçek çalışır; ihtiyaç duydukları global durum aşağıda sağlanır.
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

// Alt-topoloji stack'leri + open/collapse editörleri (cp-*.js'te tanımlı) → stub.
global.veAracOpenEditor = jest.fn();
global.veMntOpenEditor = jest.fn();
global.veAracCollapseToRoot = jest.fn(function () {
  while (global.veAracStack.length) global.veAracStack.pop();
});
global.veMntCollapseToRoot = jest.fn(function () {
  while (global.veMntStack.length) global.veMntStack.pop();
});
global.veAracStack = [];
global.veMntStack = [];

// topology.js'i yükle (üst-seviye fonksiyonlar test kapsamına gelir).
// veTabs/veActiveTabIdx gibi vars topology.js tarafından bildirildiği için
// eval SONRASI düz (bare) atama ile ayarlanır; global.* eval'in var'ını gölgelemez.
eval(fs.readFileSync(path.join(__dirname, '../../js/topology.js'), 'utf8'));

beforeEach(() => {
  veTabs = [{ id: 't1', name: 'Topoloji 1', state: null, nodeCount: 0, connCount: 0 }];
  veActiveTabIdx = 0;
  global.nodes = [];
  global.connections = [];
  global.veAracStack = [];
  global.veMntStack = [];
  veAracOpenEditor.mockClear();
  veMntOpenEditor.mockClear();
  veAracCollapseToRoot.mockClear();
  veMntCollapseToRoot.mockClear();
});

describe('veSaveActiveTabStateKeepView — kullanıcı alt-topolojide kalır', () => {
  test('Araç Performans içindeyken köke atılmaz, sessizce geri getirilir', () => {
    global.veAracStack = [{ nodeId: 'comp-5', parentState: {} }];

    veSaveActiveTabStateKeepView();

    // Doğru serileştirme için köke çöküldü (stack boşaldı, tab.state yazıldı)...
    expect(veAracCollapseToRoot).toHaveBeenCalled();
    expect(veAracStack.length).toBe(0);
    expect(veTabs[0].state).not.toBeNull();
    // ...ama kullanıcı aynı alt-topolojiye SESSİZCE geri getirildi.
    expect(veAracOpenEditor).toHaveBeenCalledTimes(1);
    expect(veAracOpenEditor).toHaveBeenCalledWith('comp-5', true);
    expect(veMntOpenEditor).not.toHaveBeenCalled();
  });

  test('İç içe (nested) alt-topolojide yol kök→derin sırayla geri girilir', () => {
    global.veAracStack = [
      { nodeId: 'a1', parentState: {} },
      { nodeId: 'a2', parentState: {} },
    ];

    veSaveActiveTabStateKeepView();

    expect(veAracOpenEditor.mock.calls).toEqual([
      ['a1', true],
      ['a2', true],
    ]);
  });

  test('Takoz iç topolojisinde de görünüm korunur', () => {
    global.veMntStack = [{ nodeId: 'm3', parentState: {} }];

    veSaveActiveTabStateKeepView();

    expect(veMntOpenEditor).toHaveBeenCalledWith('m3', true);
    expect(veAracOpenEditor).not.toHaveBeenCalled();
  });

  test('Ana topolojideyken (alt-topoloji yok) geri-giriş çağrısı yapılmaz', () => {
    veSaveActiveTabStateKeepView();

    expect(veTabs[0].state).not.toBeNull(); // kayıt yine yapılır
    expect(veAracOpenEditor).not.toHaveBeenCalled();
    expect(veMntOpenEditor).not.toHaveBeenCalled();
  });
});

describe('veSaveActiveTabState (TERMINAL) — davranış değişmedi', () => {
  test('Köke çökertir ve kullanıcıyı geri GETİRMEZ (sekme değiştir/yükle akışı)', () => {
    global.veAracStack = [{ nodeId: 'comp-9', parentState: {} }];

    veSaveActiveTabState();

    expect(veAracCollapseToRoot).toHaveBeenCalled();
    expect(veAracStack.length).toBe(0);
    // Terminal akış: geri-giriş YOK (çağıran zaten başka canvas yükleyecek).
    expect(veAracOpenEditor).not.toHaveBeenCalled();
  });
});
