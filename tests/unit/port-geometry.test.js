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

// createNode ile sınır çerçevesi (canvas-space.js veBoundaryBox) AYNI kuralı
// okumalı: ikisi ayrı sayı tutsaydı, ölçüsü kaydedilmemiş bir düğüm çerçeveyi
// olduğundan geniş/dar gösterirdi.
describe('veNodeDefaultSize — varsayılan kutu ölçüsü', () => {
  test('sıradan bileşen 65×60', () => {
    expect(veNodeDefaultSize('gearbox')).toEqual({ w: 65, h: 60 });
  });

  test('tipin kendi ölçüsü varsa o kazanır', () => {
    expect(veNodeDefaultSize('engine')).toEqual({ w: 66, h: 76 });
  });

  test('sensör küçük çizilir (33×33)', () => {
    componentDefs.sensor = { name: 'Sensör', inputs: 1, outputs: 0, isSensor: true };
    expect(veNodeDefaultSize('sensor')).toEqual({ w: 33, h: 33 });
    delete componentDefs.sensor;
  });

  test('sonlandırıcı da küçük', () => {
    componentDefs.terminator = { name: 'Sonlandırıcı', inputs: 1, outputs: 0, isTerminator: true };
    expect(veNodeDefaultSize('terminator')).toEqual({ w: 33, h: 33 });
    delete componentDefs.terminator;
  });

  test('bilinmeyen tip sıradan ölçüye düşer', () => {
    expect(veNodeDefaultSize('boyle-bir-tip-yok')).toEqual({ w: 65, h: 60 });
    expect(veNodeDefaultSize(undefined)).toEqual({ w: 65, h: 60 });
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

// ── GİDİŞ YÖNÜ İŞARETİ (kayış bağlantısı) ──────────────────────────────────
// Serpantin bir ÇEVRİM: aynı halka iki yönde de gezilebilir ve sarım açıları
// buna göre değişir. Yön topolojiden okunamıyordu; ok telin ORTASINDA, teğetine
// bakıyor. Eğri için kübik Bézier'in t = 0.5 noktası ve türevi analitik.
describe('veConnDirMark — telin ortasındaki yön oku', () => {
  const uclar = (el) => [...el.getAttribute('d').matchAll(/(-?[\d.]+) (-?[\d.]+)/g)]
    .map((m) => [+m[1], +m[2]]);

  test('kısa açıklıkta çizilmez (46 px eşiği)', () => {
    expect(veConnDirMark('straight', 0, 0, 30, 0, null)).toBeNull();
    expect(veConnDirMark('straight', 0, 0, 47, 0, null)).not.toBeNull();
  });

  test('düz telde ok ORTADA ve gidiş yönüne bakar', () => {
    const p = uclar(veConnDirMark('straight', 0, 0, 200, 0, null));
    // uç (tepe) ikinci nokta: orta + yön·s
    expect(p[1][0]).toBeCloseTo(104.4, 1);
    expect(p[1][1]).toBeCloseTo(0, 6);
    // kanatlar tepenin GERİSİNDE ve simetrik
    expect(p[0][0]).toBeCloseTo(95.6, 1);
    expect(p[2][0]).toBeCloseTo(95.6, 1);
    expect(p[0][1]).toBeCloseTo(-p[2][1], 6);
  });

  // Bézier'de "iki ucun ortası" YANLIŞ olurdu: kontrol kolları eğriyi bir yana
  // çekiyor ve ok telin üstünden kayardı. B(0.5) = (P0 + 3C1 + 3C2 + P3)/8.
  test('eğride ok Bézier ORTASINDA, iki ucun ortasında DEĞİL', () => {
    const cp = [0, 120, 200, 120];                       // her iki kol AŞAĞI
    const p = uclar(veConnDirMark('curve', 0, 0, 200, 0, cp));
    const by = (0 + 3 * 120 + 3 * 120 + 0) / 8;          // = 90
    expect(p[1][1]).toBeCloseTo(by, 0);                  // ok eğrinin üstünde
    expect(Math.abs(p[1][1])).toBeGreaterThan(10);       // iki ucun ortası y=0 olurdu
    expect(p[1][0]).toBeCloseTo(104.4, 0);               // teğet yatay → tepe sağda
  });

  test('yön TERS çevrilince ok da ters döner', () => {
    const ileri = uclar(veConnDirMark('straight', 0, 0, 200, 0, null));
    const geri  = uclar(veConnDirMark('straight', 200, 0, 0, 0, null));
    expect(ileri[1][0]).toBeGreaterThan(100);
    expect(geri[1][0]).toBeLessThan(100);
  });
});

// ── PORT DAİRESİ TELİ TAKİP EDER (dinamik kenar) ────────────────────────────
// KULLANICI ŞİKÂYETİ (2026-08-19, iki ekran görüntüsü): "topolojiyi el ile
// manuel olarak bağlamaya çalıştığımda çok kötü bağlanıyor, bağlantı portları
// denk gelmiyor."
//
// KÖK NEDEN: defaultPortSide artık DİNAMİK bir cevap verebiliyor — FEAD
// kayışında bir portun varsayılan kenarı KOMŞUSUNUN nerede olduğuna bakıyor
// (veFeadPortSideFor). Yani cevap, bir BAĞLANTI KURULUNCA ya da düğüm
// SÜRÜKLENİNCE değişiyor. Telin ucu bunu görüyordu (getPortPosition her
// tazelemede yeniden hesaplıyor); port DAİRESİ görmüyordu, çünkü DOM'a yazan
// iki yol (ui-core createNode / state restoreState) yalnız
// `def.portLayout || node.data.portPositions` varsa yazıyor — FEAD kasnağında
// ikisi de yok. Daire, düğüm kurulurken hesaplanan KLASİK kenarda çakılı
// kalıyordu.
//
// ÖLÇÜLDÜ (gerçek tarayıcı, elle bağlanan 5 kasnaklı halka): on uçtan altısı
// 36.8 · 42.4 · 48.8 · 54 · 72 px sapmıştı; düzeltmeden sonra onu da 0.00 px.
//
// Buradaki kanca gerçeğin AYNISI: tarayıcıda da defaultPortSide global bir
// veFeadPortSideFor'u çağırıyor (bkz. components.js). Gerçek fonksiyonun kendi
// testleri cp-fead.test.js'te.
describe('veSyncPortDom — port DOM\'u telin ucuyla aynı karede tazelenir', () => {
  const KENAR = {};                        // { 'nodeId|portId': 'top'|... }
  let eskiKanca;

  const kutu = (n) => {
    const el = document.createElement('div');
    el.id = n.id;
    el.innerHTML = '<div class="ve-node-box">'
      + '<div class="ve-node-port input" data-port="input" style="' + vePortStyleAttr(n, 'input') + '"></div>'
      + '<div class="ve-node-port output" data-port="output" style="' + vePortStyleAttr(n, 'output') + '"></div>'
      + '</div>';
    document.body.appendChild(el);
    return el;
  };
  const stil = (nid, pid) => {
    const e = document.querySelector('#' + nid + ' .ve-node-port[data-port="' + pid + '"]');
    return { left: e.style.left, top: e.style.top };
  };
  const beklenen = (n, pid) => {
    const s = vePortBoxStyle(n, pid);
    return { left: s.left + 'px', top: s.top + 'px' };
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="ve-canvas"></div>'
      + '<svg id="ve-connections-layer"></svg>';
    // updateAllConnections'ın tarayıcıda hazır bulduğu komşuları (geçici tel,
    // sınır çerçevesi, mini harita) test kapsamında sahteleriyle karşıla.
    global.isConnecting = false;
    global.veUpdateBoundary = () => {};
    global.veMinimapUpdate = () => {};
    Object.keys(KENAR).forEach((k) => delete KENAR[k]);
    eskiKanca = global.veFeadPortSideFor;
    global.veFeadPortSideFor = (n, p) => KENAR[n.id + '|' + p] || null;
    global.nodes = [];
    global.connections = [];
  });
  afterEach(() => { global.veFeadPortSideFor = eskiKanca; });

  test('kenar sonradan değişince daire onu takip eder (regresyon)', () => {
    const a = node({ id: 'a', x: 0, y: 0 });
    const b = node({ id: 'b', x: 300, y: 0 });
    global.nodes = [a, b];
    kutu(a); kutu(b);
    // Kuruluş anı: bağlantı yok → klasik kural (çıkış SAĞ, giriş SOL)
    expect(stil('a', 'output')).toEqual({ left: '60px', top: '25px' });

    // Kullanıcı bağlantıyı kurdu; komşu ALTTA kaldığı için kenar değişti
    global.connections = [{ id: 'c', from: 'a', to: 'b', fromPort: 'output', toPort: 'input' }];
    KENAR['a|output'] = 'bottom';
    KENAR['b|input'] = 'top';

    updateAllConnections();

    // Daire artık telin çıktığı kenarda — ve iki sayı da TEK kaynaktan
    expect(stil('a', 'output')).toEqual(beklenen(a, 'output'));
    expect(stil('b', 'input')).toEqual(beklenen(b, 'input'));
    expect(stil('a', 'output')).toEqual({ left: '27.5px', top: '55px' });
  });

  test('dairenin MERKEZİ ile telin ucu aynı noktada (sapma 0)', () => {
    const a = node({ id: 'a', x: 0, y: 0 });
    const b = node({ id: 'b', x: 0, y: 300 });
    global.nodes = [a, b];
    kutu(a); kutu(b);
    global.connections = [{ id: 'c', from: 'a', to: 'b', fromPort: 'output', toPort: 'input' }];
    KENAR['a|output'] = 'bottom';
    KENAR['b|input'] = 'top';
    updateAllConnections();

    const k = VE_NODE_BORDER + VE_PORT_SIZE / 2;   // dairenin sol-üstünden merkezine
    [[a, 'output'], [b, 'input']].forEach(([n, pid]) => {
      const s = stil(n.id, pid);
      const merkez = { x: n.x + parseFloat(s.left) + k, y: n.y + parseFloat(s.top) + k };
      const uc = getPortPosition(n, pid);
      expect(Math.hypot(merkez.x - uc.x, merkez.y - uc.y)).toBeCloseTo(0, 6);
    });
  });

  test('düğüm SÜRÜKLENİNCE de takip eder (kenar ters döner)', () => {
    const a = node({ id: 'a', x: 0, y: 0 });
    const b = node({ id: 'b', x: 300, y: 0 });
    global.nodes = [a, b];
    kutu(a); kutu(b);
    global.connections = [{ id: 'c', from: 'a', to: 'b', fromPort: 'output', toPort: 'input' }];
    KENAR['a|output'] = 'right';
    updateAllConnections();
    expect(stil('a', 'output').left).toBe('60px');

    b.x = -300;                       // komşu artık SOLDA
    KENAR['a|output'] = 'left';
    updateAllConnections();
    expect(stil('a', 'output')).toEqual(beklenen(a, 'output'));
    expect(stil('a', 'output').left).toBe('-5px');
  });

  // Elle taşınan port (node.data.portPositions) her zaman kazanır — senkron
  // onu EZMEMELİ, yoksa sağ tıkla port taşımak işe yaramaz hâle gelirdi.
  test('elle taşınan portu ezmez', () => {
    const a = node({ id: 'a', x: 0, y: 0, data: { portPositions: { output: { side: 'top' } } } });
    global.nodes = [a];
    kutu(a);
    KENAR['a|output'] = 'bottom';     // dinamik kural BAŞKA bir kenar diyor
    updateAllConnections();
    expect(stil('a', 'output')).toEqual(beklenen(a, 'output'));
    expect(stil('a', 'output').top).toBe('-5px');            // ÜST kenar korundu
  });

  // Klasik topolojilerde (Araç Performans, Takoz) kenar hiç değişmiyor: senkron
  // orada tek bir yazma bile yapmamalı. ÖLÇÜLDÜ (gerçek tarayıcı, 17 düğüm /
  // 12 bağlantılı örnek): bütün kenarlar left/right, bütün sapmalar 0.
  test('kenar değişmiyorsa DOM\'a yazmaz', () => {
    const a = node({ id: 'a', x: 0, y: 0 });
    const b = node({ id: 'b', x: 300, y: 0 });
    global.nodes = [a, b];
    kutu(a); kutu(b);
    global.connections = [{ id: 'c', from: 'a', to: 'b', fromPort: 'output', toPort: 'input' }];
    const el = document.querySelector('#a .ve-node-port[data-port="output"]');
    let yazma = 0;
    const gercek = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el.style), 'left');
    Object.defineProperty(el.style, 'left', {
      configurable: true,
      get() { return gercek.get.call(this); },
      set(v) { yazma++; gercek.set.call(this, v); },
    });
    updateAllConnections();
    expect(yazma).toBe(0);
  });
});
