/**
 * port-geometry.test.js — bağlantı eğrisinin ucu ile port dairesi AYNI noktada
 *
 * KULLANICI ŞİKÂYETİ (2026-08-13): "bağlantıların girişi ve çıkışı garip
 * duruyor, sanki tam bağlanmamış gibi."
 *
 * KÖK NEDEN (tarayıcıda ölçüldü): port geometrisi ÜÇ ayrı yerde ayrı ayrı
 * yazılmıştı —
 *   • SVG ucu (getPortPosition / veSnapPortPos) → kenardan 7px DIŞARIDA
 *   • ilk çizimdeki port DOM'u (CSS .input{left:-5px} / .output{right:-5px})
 *     → merkez kenar çizgisinin üstünde
 *   • port yeniden kurulunca (updatePortPosition, -9px / margin -7px)
 *     → 4px daha dışarıda, 2px yukarıda
 * Ölçüm: eğrinin ucu port merkezinden 7.13px uzaktaydı (port dairesinin
 * yarıçapı 4px → eğri daireye DEĞMİYORDU).
 *
 * Düzeltme: tek gerçek kaynak → components.js vePortOffset / vePortBoxStyle.
 * Buradaki testler o sözleşmeyi tutar.
 */

const stubs = stubGlobals();

global.componentDefs = {
  engine: { name: 'Motor', inputs: 3, outputs: 1, defaultWidth: 66, defaultHeight: 76,
            portLayout: { inputs: ['left', 'left', 'left'], outputs: ['right'] } },
  gearbox: { name: 'Şanzıman', inputs: 1, outputs: 1 },
  transfer: { name: 'Transfer', inputs: 1, outputs: 2 },
};

eval(loadSource('components.js'));
eval(loadSource('connections.js'));

const node = (over) => Object.assign({ id: 'n1', type: 'gearbox', x: 1000, y: 2000, width: 65, height: 60, data: {} }, over);

describe('vePortOffset — port merkezi düğüm KENARININ üstünde', () => {
  test('klasik yerleşim: giriş sol kenarın ortası, çıkış sağ kenarın ortası', () => {
    const n = node();
    expect(vePortOffset(n, 'input')).toEqual({ dx: 0, dy: 30, side: 'left' });
    expect(vePortOffset(n, 'output')).toEqual({ dx: 65, dy: 30, side: 'right' });
  });

  test('aynı kenardaki çok port eşit aralıklanır (1/3, 2/3)', () => {
    const n = node({ type: 'transfer' });
    const a = vePortOffset(n, 'output-0'), b = vePortOffset(n, 'output-1');
    expect([a.dx, a.side]).toEqual([65, 'right']);
    expect([b.dx, b.side]).toEqual([65, 'right']);
    expect(a.dy).toBeCloseTo(20, 6);   // yüzde hesabı → kayan nokta artığı
    expect(b.dy).toBeCloseTo(40, 6);
  });

  test('üst/alt kenara taşınan port da kenarın üstünde durur', () => {
    const n = node({ data: { portPositions: { output: { side: 'top' }, input: { side: 'bottom' } } } });
    expect(vePortOffset(n, 'output')).toEqual({ dx: 32.5, dy: 0, side: 'top' });
    expect(vePortOffset(n, 'input')).toEqual({ dx: 32.5, dy: 60, side: 'bottom' });
  });

  test('aynalanmış düğümde kenarlar yer değiştirir', () => {
    const n = node({ mirrored: true });
    expect(vePortOffset(n, 'input').side).toBe('right');
    expect(vePortOffset(n, 'output').side).toBe('left');
  });

  test('düğüm ölçüsü büyüyünce port kenarla birlikte gider', () => {
    const n = node({ type: 'engine', width: 66, height: 76 });
    expect(vePortOffset(n, 'output')).toEqual({ dx: 66, dy: 38, side: 'right' });
    expect(vePortOffset(n, 'input-0').dy).toBeCloseTo(19, 6);
    expect(vePortOffset(n, 'input-1').dy).toBeCloseTo(38, 6);
    expect(vePortOffset(n, 'input-2').dy).toBeCloseTo(57, 6);
  });
});

describe('getPortPosition — eğrinin ucu port MERKEZİNE gider', () => {
  test('kanvas koordinatı = düğüm konumu + port ofseti', () => {
    const n = node();
    const inp = getPortPosition(n, 'input');
    const out = getPortPosition(n, 'output');
    expect({ x: inp.x, y: inp.y }).toEqual({ x: 1000, y: 2030 });
    expect({ x: out.x, y: out.y }).toEqual({ x: 1065, y: 2030 });
  });

  // ESKİ kodun kapısı: uç kenardan 7px DIŞARIDAYDI (x = node.x + w + 7).
  test('uç artık kenarın 7px dışında DEĞİL', () => {
    const n = node();
    expect(getPortPosition(n, 'output').x).not.toBe(n.x + n.width + 7);
    expect(getPortPosition(n, 'input').x).not.toBe(n.x - 7);
  });

  test('dört kenarın hepsinde vePortOffset ile birebir aynı', () => {
    ['left', 'right', 'top', 'bottom'].forEach(function (side) {
      const n = node({ data: { portPositions: { input: { side: side } } } });
      const o = vePortOffset(n, 'input');
      const g = getPortPosition(n, 'input');
      expect({ x: g.x, y: g.y, side: g.side }).toEqual({ x: n.x + o.dx, y: n.y + o.dy, side: side });
    });
  });
});

describe('vePortBoxStyle — port DOM\'u da AYNI merkeze oturur', () => {
  // .ve-node-port 8×8 (border-box), .ve-node-box kenarlığı 1px. Konumlama kabı
  // kutunun PADDING kutusu → left/top = ofset − (kenarlık + yarıçap).
  const K = VE_NODE_BORDER + VE_PORT_SIZE / 2;   // = 5

  test('dairenin merkezi vePortOffset ile aynı noktaya düşer', () => {
    const n = node({ type: 'transfer' });
    ['input', 'output-0', 'output-1'].forEach(function (p) {
      const o = vePortOffset(n, p);
      const s = vePortBoxStyle(n, p);
      // DOM merkezi = kenarlık + left + yarıçap  (kutunun dış köşesine göre)
      expect(VE_NODE_BORDER + s.left + VE_PORT_SIZE / 2).toBeCloseTo(o.dx, 6);
      expect(VE_NODE_BORDER + s.top + VE_PORT_SIZE / 2).toBeCloseTo(o.dy, 6);
    });
  });

  test('sabitler CSS ile aynı (8px daire, 1px kutu kenarlığı)', () => {
    expect(VE_PORT_SIZE).toBe(8);
    expect(VE_NODE_BORDER).toBe(1);
    expect(K).toBe(5);
  });

  test('vePortStyleAttr aynı sayıları px olarak yazar', () => {
    const n = node();
    const s = vePortBoxStyle(n, 'output');
    expect(vePortStyleAttr(n, 'output')).toBe('left:' + s.left + 'px; top:' + s.top + 'px;');
  });
});

describe('Bilinmeyen/eksik girdide çökmez', () => {
  test('ölçüsü olmayan düğüm varsayılan 65×60 sayılır', () => {
    const n = { id: 'x', type: 'gearbox', x: 0, y: 0, data: {} };
    expect(vePortOffset(n, 'output')).toEqual({ dx: 65, dy: 30, side: 'right' });
  });

  test('tanımsız kenar adı sol kenara düşer', () => {
    const n = node({ data: { portPositions: { input: { side: 'kuzeybatı' } } } });
    expect(vePortOffset(n, 'input')).toEqual({ dx: 0, dy: 30, side: 'left' });
  });
});
