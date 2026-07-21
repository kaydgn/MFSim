/**
 * tidy-layout.js birim testleri
 * ─────────────────────────────
 * Otomatik düzen (katmanlı yerleşim) çekirdeğini doğrular: bu SAF mantıktır —
 * sessiz bir regresyon "makul ama yanlış" bir yerleşim üretir (gözle
 * yakalanmaz), test buranın karşılığıdır.
 *
 * veTidyLayout global `nodes`/`connections` üzerinde çalışır ve düğüm
 * konumlarını (n.x/n.y) günceller. DOM/kamera yan-etkileri stub'lanır;
 * document.getElementById(nodeId) jsdom'da null döner → el.style atlanır.
 */
const { veTidyLayout } = require('../../js/tidy-layout.js');

function setup(nodes, connections) {
  global.nodes = nodes;
  global.connections = connections || [];
  global.saveState = jest.fn();
  global.updateAllConnections = jest.fn();
  global.updateNodeCount = jest.fn();
  global.veFitViewToContent = jest.fn();
  global.showToast = jest.fn();
  global.canvasZoom = 1;
  global.canvasOffset = { x: 0, y: 0 };
}

// İki dikdörtgen anlamlı biçimde örtüşüyor mu? (kenar teması sayılmaz)
function overlaps(a, b, margin) {
  margin = margin || 4;
  const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return ox > margin && oy > margin;
}

function chain(n) {
  const nodes = [];
  for (let i = 0; i < n; i++) {
    nodes.push({ id: 'n' + i, type: 't', x: 3000 + (i % 3) * 40 - 20, y: 3000 + (i * 37 % 200) - 100, width: 65, height: 60, def: {} });
  }
  const conns = [];
  for (let i = 0; i < n - 1; i++) conns.push({ from: 'n' + i, to: 'n' + (i + 1) });
  return { nodes, conns };
}

describe('veTidyLayout — katmanlı yerleşim', () => {
  test('zincir: her bağlantı soldan-sağa (to, from’un sağında)', () => {
    const { nodes, conns } = chain(6);
    setup(nodes, conns);
    veTidyLayout();
    const byId = {}; nodes.forEach(n => (byId[n.id] = n));
    conns.forEach(c => {
      expect(byId[c.to].x).toBeGreaterThan(byId[c.from].x);
    });
  });

  test('dallanma: tek kaynaktan çok hedef — hepsi bir katman sağda, örtüşmesiz', () => {
    const nodes = [
      { id: 'src', type: 't', x: 3200, y: 2900, width: 70, height: 62, def: {} },
      { id: 'a', type: 't', x: 2800, y: 3100, width: 60, height: 60, def: {} },
      { id: 'b', type: 't', x: 3300, y: 2850, width: 60, height: 60, def: {} },
      { id: 'c', type: 't', x: 2950, y: 3200, width: 60, height: 60, def: {} }
    ];
    const conns = [ { from: 'src', to: 'a' }, { from: 'src', to: 'b' }, { from: 'src', to: 'c' } ];
    setup(nodes, conns);
    veTidyLayout();
    const byId = {}; nodes.forEach(n => (byId[n.id] = n));
    ['a', 'b', 'c'].forEach(id => expect(byId[id].x).toBeGreaterThan(byId.src.x));
    // üç hedef aynı katmanda (aynı x)
    expect(byId.a.x).toBe(byId.b.x);
    expect(byId.b.x).toBe(byId.c.x);
    // örtüşme yok
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++)
        expect(overlaps(nodes[i], nodes[j])).toBe(false);
  });

  test('hiçbir düğüm çifti örtüşmez (10 düğümlü zincir)', () => {
    const { nodes, conns } = chain(10);
    setup(nodes, conns);
    veTidyLayout();
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++)
        expect(overlaps(nodes[i], nodes[j])).toBe(false);
  });

  test('yardımcı düğüm (sensör) bağlı olduğu bileşenin ALTINA yerleşir', () => {
    const nodes = [
      { id: 'host', type: 'gearbox', x: 3000, y: 3000, width: 74, height: 66, def: {} },
      { id: 'up', type: 'engine', x: 2800, y: 3000, width: 70, height: 64, def: {} },
      { id: 'sens', type: 'sensor', x: 3400, y: 2600, width: 32, height: 32, def: { isSensor: true } }
    ];
    const conns = [ { from: 'up', to: 'host' }, { from: 'host', to: 'sens' } ];
    setup(nodes, conns);
    veTidyLayout();
    const byId = {}; nodes.forEach(n => (byId[n.id] = n));
    expect(byId.sens.y).toBeGreaterThan(byId.host.y);          // altında
    expect(Math.abs(byId.sens.x - byId.host.x)).toBeLessThan(60); // hizasına yakın
  });

  test('geri alınabilir: saveState tam bir kez çağrılır', () => {
    const { nodes, conns } = chain(4);
    setup(nodes, conns);
    veTidyLayout();
    expect(global.saveState).toHaveBeenCalledTimes(1);
    expect(global.updateAllConnections).toHaveBeenCalled();
  });

  test('döngü güvenliği: 2-döngü sonlanır ve sonlu tamsayı konum üretir', () => {
    const nodes = [
      { id: 'a', type: 't', x: 3000, y: 3000, width: 65, height: 60, def: {} },
      { id: 'b', type: 't', x: 3100, y: 3050, width: 65, height: 60, def: {} }
    ];
    const conns = [ { from: 'a', to: 'b' }, { from: 'b', to: 'a' } ];
    setup(nodes, conns);
    expect(() => veTidyLayout()).not.toThrow();
    nodes.forEach(n => {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(Number.isInteger(n.x)).toBe(true);
    });
  });

  test('2’den az düğüm: uyarı verir, saveState çağrılmaz', () => {
    setup([{ id: 'only', type: 't', x: 3000, y: 3000, width: 65, height: 60, def: {} }], []);
    veTidyLayout();
    expect(global.saveState).not.toHaveBeenCalled();
    expect(global.showToast).toHaveBeenCalled();
  });
});
