/**
 * topology-save-reentrancy.test.js
 * ─────────────────────────────────
 * Regresyon: "Araç Performans" (veya Takoz) ALT-TOPOLOJİSİ içindeyken sonuç ağacı
 * yenilenmesi / kaydetme, yeniden-girişli olarak veSaveActiveTabState'i tetikler.
 *
 * Hata (düzeltilmeden önce): veAracOpenEditor → veLoadTabState → veUpdateResultsTree
 * → veSaveActiveTabStateKeepView zinciri, _veAracBusy=true iken (atomik canvas takası
 * ortasında) veSaveActiveTabState'e sıçrar; iç veAracCollapseToRoot _veAracBusy
 * korumasına takılıp köke ÇÖKEMEZ, canlı canvas hâlâ DÜZ alt-topoloji olduğu için
 * tab.state'e composite yerine 16 düğümlü düz topoloji yazılır → "Araç Performans"
 * sarmalayıcısı kaybolur, kaydedilen dosya bozulur.
 *
 * Düzeltme: veSaveActiveTabState, bir alt-topoloji giriş/çıkışı SÜRERKEN
 * (_veAracBusy/_veMntBusy true) çağrılırsa sessizce çıkar; dıştaki işlem bitince
 * doğru kök durumu zaten yazılır.
 */
const stubs = stubGlobals();
eval(loadSource('topology.js'));

// topology.js üst-seviye `var` bildiren değişkenler (veTabs, veActiveTabIdx) eval
// kapsamında yaşar → bunlara ÇIPLAK atama yapılmalı ki hem test hem de eval'lenen
// fonksiyonlar aynı binding'i görsün (bkz. tests/helpers/setup.js notu).
function setup(collapseCounter) {
  _veAracBusy = false;
  _veMntBusy = false;
  nodes = [{ id: 'a', type: 'arac-performans' }];
  connections = [];
  compCounter = 0;
  canvasOffset = { x: 0, y: 0 };
  canvasZoom = 1;
  undoStack = [];
  redoStack = [];
  veResultSlots = [{}, {}, {}, {}];
  veTabs = [{ id: 't1', name: 'T1', state: { nodes: [{ id: 'a', type: 'arac-performans' }], connections: [] } }];
  veActiveTabIdx = 0;
  veAracCollapseToRoot = function() { collapseCounter.n++; };
  veMntCollapseToRoot = function() {};
  veFlushOpenPanelData = function() {};
}

describe('veSaveActiveTabState — alt-topoloji giriş/çıkışı sırasında yeniden-giriş koruması', () => {
  let counter;
  beforeEach(() => { counter = { n: 0 }; setup(counter); });

  test('_veAracBusy=true iken NO-OP: çökme çağrılmaz, tab.state yeniden yazılmaz', () => {
    _veAracBusy = true;
    const before = veTabs[0].state;
    veSaveActiveTabState();
    expect(counter.n).toBe(0);             // köke çökme denenmedi
    expect(veTabs[0].state).toBe(before);  // tab.state aynı referans — bozulmadı
  });

  test('_veMntBusy=true iken de NO-OP (Takoz alt-topolojisi simetrisi)', () => {
    _veMntBusy = true;
    const before = veTabs[0].state;
    veSaveActiveTabState();
    expect(counter.n).toBe(0);
    expect(veTabs[0].state).toBe(before);
  });

  test('busy=false iken normal çalışır: köke çöker ve tab.state yeniden yazılır', () => {
    const before = veTabs[0].state;
    veSaveActiveTabState();
    expect(counter.n).toBe(1);                  // köke çökme yapıldı
    expect(veTabs[0].state).not.toBe(before);   // tab.state yeniden serialize edildi
    expect(veTabs[0].state.nodes[0].type).toBe('arac-performans');
  });
});
