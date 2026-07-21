/**
 * align-nodes.js birim testleri
 * ─────────────────────────────
 * Hizalama & dağıtma SAF konum matematiğidir — sessiz bir regresyon "makul ama
 * yanlış" hizalama üretir. DOM yan-etkileri stub'lanır (getElementById jsdom'da
 * null → el.style atlanır); fonksiyonlar global selectedNodes üzerinde çalışır.
 */
const { veAlignNodes, veDistributeNodes } = require('../../js/align-nodes.js');

function setup(sel) {
  global.selectedNodes = sel;
  global.saveState = jest.fn();
  global.updateAllConnections = jest.fn();
  global.updateNodeCount = jest.fn();
  global.showToast = jest.fn();
}
function node(id, x, y, w, h) { return { id, x, y, width: w || 60, height: h || 60 }; }

describe('veAlignNodes', () => {
  test('sola hizala: hepsi minX', () => {
    setup([node('a', 100, 0, 60), node('b', 250, 40, 80), node('c', 175, 90, 40)]);
    veAlignNodes('left');
    expect(global.selectedNodes.map(n => n.x)).toEqual([100, 100, 100]);
  });

  test('sağa hizala: hepsi maxX’e yaslanır (x + w sabit kenar)', () => {
    const nodes = [node('a', 100, 0, 60), node('b', 250, 40, 80), node('c', 175, 90, 40)];
    setup(nodes);
    const maxRight = Math.max(...nodes.map(n => n.x + n.width)); // 330
    veAlignNodes('right');
    global.selectedNodes.forEach(n => expect(n.x + n.width).toBe(maxRight));
  });

  test('yatay ortala: merkezler bbox merkezine gelir', () => {
    const nodes = [node('a', 100, 0, 60), node('b', 250, 40, 80)];
    setup(nodes);
    const cx = (100 + (250 + 80)) / 2; // (minX + maxX)/2 = (100+330)/2 = 215
    veAlignNodes('hcenter');
    global.selectedNodes.forEach(n => expect(n.x + n.width / 2).toBeCloseTo(cx, 6));
  });

  test('üste hizala: hepsi minY', () => {
    setup([node('a', 0, 30, 60), node('b', 40, 90, 60), node('c', 90, 10, 60)]);
    veAlignNodes('top');
    expect(global.selectedNodes.map(n => n.y)).toEqual([10, 10, 10]);
  });

  test('geri alınabilir: saveState bir kez; <2 seçim uyarı verir', () => {
    setup([node('a', 0, 0), node('b', 50, 50)]);
    veAlignNodes('left');
    expect(global.saveState).toHaveBeenCalledTimes(1);

    setup([node('solo', 0, 0)]);
    veAlignNodes('left');
    expect(global.saveState).not.toHaveBeenCalled();
    expect(global.showToast).toHaveBeenCalled();
  });
});

describe('veDistributeNodes', () => {
  test('yatay dağıt: orta elemanın merkezi ilk-son arasında ortada; uçlar sabit', () => {
    // centers: a=30, c=230 (uçlar), b başlangıçta 60 → ortaya (130) taşınmalı
    const a = node('a', 0, 0, 60);    // center 30
    const b = node('b', 30, 0, 60);   // center 60
    const c = node('c', 200, 0, 60);  // center 230
    setup([a, b, c]);
    veDistributeNodes('h');
    const center = n => n.x + n.width / 2;
    expect(center(a)).toBeCloseTo(30, 6);   // ilk sabit
    expect(center(c)).toBeCloseTo(230, 6);  // son sabit
    expect(center(b)).toBeCloseTo(130, 6);  // ortada (30 + (230-30)/2)
  });

  test('dikey dağıt: 4 eleman eşit merkez aralığı', () => {
    const ns = [node('a', 0, 0, 60, 40), node('b', 0, 500, 60, 40), node('c', 0, 120, 60, 40), node('d', 0, 300, 60, 40)];
    setup(ns);
    veDistributeNodes('v');
    const cy = n => n.y + n.height / 2;
    const sorted = ns.slice().sort((x, y) => cy(x) - cy(y));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) gaps.push(cy(sorted[i]) - cy(sorted[i - 1]));
    // konumlar tamsayıya yuvarlanır → aralıklar ~1px içinde eşit
    gaps.forEach(g => expect(Math.abs(g - gaps[0])).toBeLessThanOrEqual(1.5));
  });

  test('<3 seçimde dağıtmaz, uyarı verir', () => {
    setup([node('a', 0, 0), node('b', 100, 0)]);
    veDistributeNodes('h');
    expect(global.saveState).not.toHaveBeenCalled();
    expect(global.showToast).toHaveBeenCalled();
  });
});
