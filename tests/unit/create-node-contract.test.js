/**
 * createNode dönüş sözleşmesi + veCloneNodeFrom veri güvenliği
 * ─────────────────────────────────────────────────────────────
 * Regresyon zemini: createNode maxInstances dolduğunda sessizce `undefined`
 * dönüyordu. veCloneNodeFrom ise dönüşü yok sayıp `nodes[nodes.length-1]`
 * alıyordu → reddedilen kopyalamada ALAKASIZ bir düğümün .data'sı eziliyordu
 * (Ctrl+D / Ctrl+V ile tetiklenebilir sessiz veri kaybı). Ayrıca reddetme
 * bildirimi hiç tanımlanmamış showNotification'a gidiyordu → tamamen sessiz.
 *
 * Burada test edilen şey mantık çekirdeği (dönüş sözleşmesi + veri
 * bütünlüğü), HTML çıktısı değil — CLAUDE.md test politikasına uygun.
 */

const stubs = stubGlobals({
  updateNodeHandles: jest.fn(),
  veAttachNodeDrag: jest.fn(),
  veAttachPortConnect: jest.fn(),
  enablePortContextMenu: jest.fn(),
  showNodeContextMenu: jest.fn(),
  showLabelContextMenu: jest.fn(),
  applyNodeLabelPos: jest.fn(),
  updatePortPosition: jest.fn(),
  startResize: jest.fn(),
  updateNodeCount: jest.fn(),
  clearSelection: jest.fn(),
  addToSelection: jest.fn(),
  nodePortCount: jest.fn(() => 1),
  updateAllConnections: jest.fn(),
});

// createNode DOM'a ekliyor → canvas kökü hazır olmalı
document.body.innerHTML = '<div id="ve-canvas"></div>';

global.componentDefs = {
  // Sınırsız bileşen
  engine: { name: 'Motor', inputs: 1, outputs: 1 },
  // Tek kopya ile sınırlı bileşen (gerçekte: obstacle-crossing, sensor-wizard, mnt-library)
  solo: { name: 'Tek Kopya', inputs: 0, outputs: 0, maxInstances: 1 },
};
global.nodes = [];
global.connections = [];
global.compCounter = 0;
global.selectedNodes = [];

eval(loadSource('ui-core.js'));

beforeEach(() => {
  resetStubs(stubs);
  nodes.length = 0;
  connections.length = 0;
  compCounter = 0;
  document.getElementById('ve-canvas').innerHTML = '';
});

describe('createNode dönüş sözleşmesi', () => {
  test('başarıda oluşturulan düğümü döndürür', () => {
    const n = createNode('engine', 100, 200);
    expect(n).toBeTruthy();
    expect(n.type).toBe('engine');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toBe(n);
  });

  test('bilinmeyen tip için null döndürür ve düğüm eklemez', () => {
    const n = createNode('boyle-bir-tip-yok', 0, 0);
    expect(n).toBeNull();
    expect(nodes).toHaveLength(0);
  });

  test('maxInstances dolduğunda null döndürür ve düğüm eklemez', () => {
    const first = createNode('solo', 0, 0);
    expect(first).toBeTruthy();
    expect(nodes).toHaveLength(1);

    const second = createNode('solo', 50, 50);
    expect(second).toBeNull();
    expect(nodes).toHaveLength(1); // ikinci kopya eklenmedi
  });

  test('maxInstances reddi kullanıcıya bildirilir (sessiz kalmaz)', () => {
    createNode('solo', 0, 0);
    stubs.showToast.mockClear();

    createNode('solo', 50, 50);

    expect(stubs.showToast).toHaveBeenCalledTimes(1);
    const [msg, type] = stubs.showToast.mock.calls[0];
    expect(msg).toContain('Tek Kopya');
    expect(type).toBe('warning');
  });
});

describe('veCloneNodeFrom veri güvenliği', () => {
  test('normal durumda kaynağın verisini YENİ düğüme kopyalar', () => {
    const src = createNode('engine', 0, 0);
    src.data = { ftCd: 0.75, nested: { a: 1 } };

    const clone = veCloneNodeFrom(src, 300, 300);

    expect(clone).toBeTruthy();
    expect(clone.id).not.toBe(src.id);
    expect(clone.data).toEqual({ ftCd: 0.75, nested: { a: 1 } });
    // derin kopya — klonu değiştirmek kaynağı bozmamalı
    clone.data.nested.a = 999;
    expect(src.data.nested.a).toBe(1);
  });

  test('createNode reddederse null döner ve BAŞKA düğümün verisi bozulmaz', () => {
    // Sıra önemli: sınırlı bileşen önce, kurban düğüm SONRA eklenir →
    // nodes[nodes.length-1] kurbanı gösterir. Eski kod tam burada patlıyordu.
    const solo = createNode('solo', 0, 0);
    solo.data = { soloVerisi: 'kaynak' };

    const victim = createNode('engine', 100, 100);
    victim.data = { kendiVerisi: 'korunmali' };
    expect(nodes[nodes.length - 1]).toBe(victim);

    const clone = veCloneNodeFrom(solo, 200, 200);

    expect(clone).toBeNull();
    // Kurban kendi verisini AYNEN korumalı
    expect(victim.data).toEqual({ kendiVerisi: 'korunmali' });
    expect(victim.data.soloVerisi).toBeUndefined();
    // Ne düğüm sayısı ne de kurbanın kimliği değişmeli
    expect(nodes).toHaveLength(2);
    expect(nodes[nodes.length - 1]).toBe(victim);
  });

  test('kurban düğümün customName/boyutu da bozulmaz', () => {
    const solo = createNode('solo', 0, 0);
    solo.data = {};
    solo.customName = 'Kaynak Ad';
    solo.width = 123;

    const victim = createNode('engine', 100, 100);
    victim.customName = 'Kurban Ad';
    victim.width = 65;

    expect(veCloneNodeFrom(solo, 200, 200)).toBeNull();

    expect(victim.customName).toBe('Kurban Ad');
    expect(victim.width).toBe(65);
  });
});
