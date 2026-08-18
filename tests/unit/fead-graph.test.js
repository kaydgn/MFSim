/**
 * fead-graph.test.js — FEAD GRAF YÜZÜ (js/fead-graph.js)
 *
 * KAPSAM AYRIMI — FEAD'in dört test dosyası:
 *   fead-core.test.js    çekirdek doğru mu (17 Gates raporu, 2095 değer)
 *   fead-model.test.js   köprü çekirdeğe doğru veriyi mi veriyor
 *   cp-fead.test.js      sunum katmanının sözleşmesi
 *   BU DOSYA             topolojinin GRAF YÜZÜ: yerleşim, port açısı, biçim
 *
 * Buradaki testler HTML etiketi saymıyor; ölçülen şey GEOMETRİ:
 * yerleşim mm düzlemine sadık mı, kayış yolu kendini kesiyor mu, port
 * gerçekten komşuya mı bakıyor, dairenin çapı gerçekten çap mı.
 * Bunlar sessizce bozulabilecek şeyler — bir etiket adı değil.
 */
const M = require('../../js/fead-model.js');
const G = require('../../js/fead-graph.js');
const F = require('../../js/fead-core.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
// componentDefs ve model yardımcıları GLOBAL'e konur: tarayıcıda hepsi global
// kapsamda yükleniyor ve fead-graph.js onları oradan çağırıyor. Testte eval
// edilen kaynak yalnız bu dosyanın kapsamına girdiği için köprü elle kurulur —
// yoksa _feadDefOf/_feadIsPulley görünmez ve gergi sıradan kasnak sanılır.
global.componentDefs = componentDefs;
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(G).forEach((k) => { global[k] = G[k]; });

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
});

// ── Ortak yardımcılar ──────────────────────────────────────────────────────
function bmcPlan() {
  const pack = veFeadExampleNodes('BMC_FEAD_2026');
  return { pack, plan: veFeadGraphPlan(pack.nodes, pack.connections) };
}
function mmOf(pack, id) {
  const n = pack.nodes.find((x) => x.id === id);
  return veFeadEnteredCenter(n);
}
// İki doğru parçası GERÇEKTEN kesişiyor mu (uç paylaşımı sayılmaz).
function segmentsCross(p1, p2, p3, p4) {
  const s = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d1 = s(p3.cx, p3.cy, p4.cx, p4.cy, p1.cx, p1.cy);
  const d2 = s(p3.cx, p3.cy, p4.cx, p4.cy, p2.cx, p2.cy);
  const d3 = s(p1.cx, p1.cy, p2.cx, p2.cy, p3.cx, p3.cy);
  const d4 = s(p1.cx, p1.cy, p2.cx, p2.cy, p4.cx, p4.cy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// ═══════════════════════════════════════════════════════════════════════════
describe('Kasnağın GİRİLEN merkezi', () => {
  test('sıradan kasnak data.x/data.y', () => {
    const c = veFeadEnteredCenter({ type: 'fead-ac', data: { x: 184.19, y: 314.49 } });
    expect(c.ok).toBe(true);
    expect(c.x).toBeCloseTo(184.19, 6);
    expect(c.y).toBeCloseTo(314.49, 6);
    expect(c.from).toBe('xy');
  });

  test('konum girilmemişse ok:false — uydurma bir merkez üretilmez', () => {
    expect(veFeadEnteredCenter({ type: 'fead-ac', data: {} }).ok).toBe(false);
  });

  // GERGİ AYRI: konumu yay dengesinden ÇÖZÜLÜR, girilmez. Ama tedarikçi
  // sayfası MONTAJ MERKEZİNİ veriyor ve graf bir GİRDİ yüzeyi — gösterdiği
  // şey tam olarak kullanıcının yazdığı sayı olmak zorunda.
  test('gergi montaj merkezinden (cenX/cenY) yerleşir', () => {
    const c = veFeadEnteredCenter({
      type: 'fead-tensioner',
      data: { pivotX: -259.94, pivotY: 104.15, cenX: -170.08, cenY: 99.16, armLen: 90 }
    });
    expect(c.ok).toBe(true);
    expect(c.from).toBe('mount');
    expect(c.x).toBeCloseTo(-170.08, 6);
    expect(c.y).toBeCloseTo(99.16, 6);
  });

  test('montaj merkezi yoksa pivot + kol + serbest açıdan türetilir', () => {
    const c = veFeadEnteredCenter({
      type: 'fead-tensioner',
      data: { pivotX: 0, pivotY: 0, armLen: 100, freeAngleDeg: 90 }
    });
    expect(c.ok).toBe(true);
    expect(c.from).toBe('arm');
    expect(c.x).toBeCloseTo(0, 6);
    expect(c.y).toBeCloseTo(100, 6);
  });

  test('yalnız pivot varsa kasnak pivota düşer (çizim boş kalmaz)', () => {
    const c = veFeadEnteredCenter({ type: 'fead-tensioner', data: { pivotX: 5, pivotY: 7 } });
    expect(c.ok).toBe(true);
    expect(c.from).toBe('pivot');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Ölçek: 1 px = 1 mm, alt/üst sınırlı', () => {
  test('girilen çap ekrandaki çaptır', () => {
    expect(veFeadGraphDiaInfo({ type: 'fead-ac', data: { od: 152 } })).toEqual(
      { dia: 152, hasOD: true, toScale: true }
    );
  });

  // Tipe göre bir varsayılan çap (krank 180 mm) EKRANA YAZILMAZ: kullanıcının
  // hiç girmediği bir sayıyı ölçekli göstermek, biçimin taşıdığı tek bilgiyi
  // yalan yapardı. Nötr ölçü + ayrı bir işaret.
  test('çap girilmemişse nötr ölçü ve hasOD:false — tip varsayılanı ÇİZİLMEZ', () => {
    const info = veFeadGraphDiaInfo({ type: 'fead-crank', data: {} });
    expect(info.hasOD).toBe(false);
    expect(info.dia).toBe(VE_FEAD_NODIA_DIA);
    expect(info.dia).not.toBe(veFeadOD({ type: 'fead-crank', data: {} }));  // 180 mm
  });

  test('alt/üst sınıra çarpan çap ölçekli DEĞİL ve bu işaretlenir', () => {
    const kucuk = veFeadGraphDiaInfo({ type: 'fead-idler', data: { od: 12 } });
    expect(kucuk.dia).toBe(VE_FEAD_MIN_DIA);
    expect(kucuk.toScale).toBe(false);
    const buyuk = veFeadGraphDiaInfo({ type: 'fead-crank', data: { od: 900 } });
    expect(buyuk.dia).toBe(VE_FEAD_MAX_DIA);
    expect(buyuk.toScale).toBe(false);
  });

  // TEK KAYNAK KAPISI: componentDefs'teki varsayılan ölçü ile "çapı girilmemiş
  // kasnağın nötr ölçüsü" AYNI sayı olmak zorunda. Ayrışırlarsa yeni bırakılan
  // kasnak önce bir ölçüde çizilir, ilk saveState'te sessizce zıplar.
  test('componentDefs varsayılanı ↔ VE_FEAD_NODIA_DIA (kare ve aynı)', () => {
    const pulleys = Object.keys(componentDefs).filter((t) => componentDefs[t].isFeadPulley);
    expect(pulleys.length).toBeGreaterThanOrEqual(9);
    pulleys.forEach((t) => {
      expect(componentDefs[t].defaultWidth).toBe(VE_FEAD_NODIA_DIA);
      expect(componentDefs[t].defaultHeight).toBe(VE_FEAD_NODIA_DIA);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Yerleşim planı — BMC tedarikçi sayfası', () => {
  test('altı kasnak da yerleşiyor, eksik/kırpılmış yok', () => {
    const { plan } = bmcPlan();
    expect(plan.ok).toBe(true);
    expect(plan.items).toHaveLength(6);
    expect(plan.missing).toEqual([]);
    expect(plan.clipped).toEqual([]);
  });

  // GEOMETRİK SADAKAT: ekrandaki her mesafe mm düzlemindeki mesafeyle AYNI
  // (ölçek 1). Bu tutmazsa yerleşim "kabaca doğru" bir çizim olur ve kanvastaki
  // Kayış Yolu kartıyla karşılaştırılamaz hâle gelir — iki yüzeyin bir arada
  // durmasının tek sebebi bu karşılaştırma.
  test('düğümler arası mesafe mm mesafesine EŞİT (ölçek 1 px = 1 mm)', () => {
    const { pack, plan } = bmcPlan();
    for (let i = 0; i < plan.items.length; i++) {
      for (let j = i + 1; j < plan.items.length; j++) {
        const a = plan.items[i], b = plan.items[j];
        const am = mmOf(pack, a.id), bm = mmOf(pack, b.id);
        const dPx = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        const dMm = Math.hypot(am.x - bm.x, am.y - bm.y);
        expect(dPx).toBeCloseTo(dMm * VE_FEAD_GRAPH_SCALE, 6);
      }
    }
  });

  // Y İŞARETİ: mm düzlemi y-yukarı, kanvas y-aşağı. Kayış Yolu kartı da aynı
  // çevirmeyi yapıyor; işaret ters olsaydı graf kartın AYNASI çıkardı ve iki
  // resim aynı modeli anlatmasına rağmen üst üste binmezdi.
  test('mm y-yukarı → ekran y-aşağı: en büyük mm-y en ÜSTTE çizilir', () => {
    const { pack, plan } = bmcPlan();
    const withMm = plan.items.map((it) => ({ it, mm: mmOf(pack, it.id) }));
    const enBuyukY = withMm.reduce((a, b) => (b.mm.y > a.mm.y ? b : a));
    const enUst = withMm.reduce((a, b) => (b.it.cy < a.it.cy ? b : a));
    expect(enBuyukY.it.id).toBe(enUst.it.id);
  });

  // ASIL İDDİA: kesişim 3 → 0. Kayış fiziksel olarak kendini kesmeyen kapalı
  // bir eğri; düğümler gerçek koordinatına oturunca graf bu özelliği MİRAS
  // ALIR. Bugünkü serbest yerleşimde BMC örneğinde 3 kesişim vardı.
  test('kayış yolu kendini kesmiyor (kesişim = 0)', () => {
    const { plan } = bmcPlan();
    const byId = {};
    plan.items.forEach((i) => { byId[i.id] = i; });
    const ord = plan.order;
    const segs = ord.map((id, i) => [byId[id], byId[ord[(i + 1) % ord.length]]]);
    let n = 0;
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const a = segs[i], b = segs[j];
        if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) continue;
        if (segmentsCross(a[0], a[1], b[0], b[1])) n++;
      }
    }
    expect(n).toBe(0);
  });

  test('kasnaklar birbirinin içine girmiyor', () => {
    const { plan } = bmcPlan();
    for (let i = 0; i < plan.items.length; i++) {
      for (let j = i + 1; j < plan.items.length; j++) {
        const a = plan.items[i], b = plan.items[j];
        const gap = Math.hypot(a.cx - b.cx, a.cy - b.cy) - (a.w + b.w) / 2;
        expect(gap).toBeGreaterThan(0);
      }
    }
  });

  // Ad, halka biçiminde dizilmiş kasnaklarda sabit "kutunun altında" kalsaydı
  // yarısı kayış telinin üstüne düşerdi. Dışa doğru yerleşim tek kuralla çözer.
  test('düğüm adı kümenin DIŞINA bakar', () => {
    const { plan } = bmcPlan();
    plan.items.forEach((it) => {
      if (Math.abs(it.cx) > Math.abs(it.cy)) expect(it.labelPos).toBe(it.cx >= 0 ? 'right' : 'left');
      else expect(it.labelPos).toBe(it.cy >= 0 ? 'bottom' : 'top');
    });
  });

  test('konumu girilmemiş kasnak missing listesine düşer, plan yine kurulur', () => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    const hedef = pack.nodes.find((n) => n.type === 'fead-alternator');
    delete hedef.data.x; delete hedef.data.y;
    const plan = veFeadGraphPlan(pack.nodes, pack.connections);
    expect(plan.ok).toBe(true);
    expect(plan.missing).toEqual([hedef.id]);
    expect(plan.items).toHaveLength(5);
  });

  test('iki kasnaktan azı yerleşebiliyorsa plan kurulmaz ve SEBEBİ yazar', () => {
    const nodesX = [
      { id: 'a', type: 'fead-crank', data: { x: 0, y: 0, driver: true } },
      { id: 'b', type: 'fead-idler', data: {} }
    ];
    const plan = veFeadGraphPlan(nodesX, [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }]);
    expect(plan.ok).toBe(false);
    expect(plan.reason).toMatch(/en az iki kasnağın merkez koordinatı/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Port = komşuya bakan açı', () => {
  // Bugüne kadar her düğümde giriş SOLDA, çıkış SAĞDA sabitti. Kayış sağdan
  // sola dönerken tel düğümün ÜSTÜNDEN geri geçmek zorunda kalıyordu — kesişim
  // sebeplerinden ikincisi. Açı ile port kayışın gittiği yöne oturur.
  test('çıkış portu SIRADAKİ, giriş portu ÖNCEKİ kasnağa bakar', () => {
    const { plan } = bmcPlan();
    const byId = {};
    plan.items.forEach((i) => { byId[i.id] = i; });
    const ord = plan.order;
    ord.forEach((id, i) => {
      const me = byId[id];
      const nx = byId[ord[(i + 1) % ord.length]];
      const pv = byId[ord[(i - 1 + ord.length) % ord.length]];
      const bekOut = Math.atan2(nx.cy - me.cy, nx.cx - me.cx) * 180 / Math.PI;
      const bekIn = Math.atan2(pv.cy - me.cy, pv.cx - me.cx) * 180 / Math.PI;
      expect(plan.ports[id].output).toBeCloseTo(bekOut, 6);
      expect(plan.ports[id].input).toBeCloseTo(bekIn, 6);
    });
  });

  // vePortOffset TEK GEOMETRİ KAYNAĞI: port DOM'u (vePortBoxStyle), bağlantı
  // ucu (getPortPosition) ve pano (veSnapPortPos) hep oradan okuyor. Açısal dal
  // eklenince üçü birden doğru olur; ayrı hesaplansaydı ikisi zamanla ayrışırdı.
  test("vePortOffset açısal dalı: 0°=sağ, 90°=AŞAĞI, 180°=sol, -90°=yukarı", () => {
    const n = { width: 100, height: 100, data: { portPositions: {} } };
    const at = (deg) => {
      n.data.portPositions.output = { side: 'angle', deg: deg };
      return vePortOffset(n, 'output');
    };
    expect(at(0).dx).toBeCloseTo(100, 6);   expect(at(0).dy).toBeCloseTo(50, 6);
    expect(at(90).dx).toBeCloseTo(50, 6);   expect(at(90).dy).toBeCloseTo(100, 6);
    expect(at(180).dx).toBeCloseTo(0, 6);   expect(at(180).dy).toBeCloseTo(50, 6);
    expect(at(-90).dx).toBeCloseTo(50, 6);  expect(at(-90).dy).toBeCloseTo(0, 6);
    expect(at(0).side).toBe('angle');
  });

  test('port dairenin ÇEPERİNDE durur — her açıda yarıçap sabit', () => {
    const n = { width: 152, height: 152, data: { portPositions: {} } };
    [-173.4, -90, -12.7, 0, 44.2, 137.9, 180].forEach((deg) => {
      n.data.portPositions.input = { side: 'angle', deg: deg };
      const o = vePortOffset(n, 'input');
      expect(Math.hypot(o.dx - 76, o.dy - 76)).toBeCloseTo(76, 6);
    });
  });

  // Uçtan uca: plan → node.data.portPositions → vePortOffset. Çıkış portunun
  // DÜNYA konumu, komşunun merkezine giden doğrultunun üzerinde olmalı.
  test('plandan yazılan port, komşu merkezine giden doğrultuda çıkar', () => {
    const { plan } = bmcPlan();
    const byId = {};
    plan.items.forEach((i) => { byId[i.id] = i; });
    const ord = plan.order;
    ord.forEach((id, i) => {
      const it = byId[id];
      const nx = byId[ord[(i + 1) % ord.length]];
      const node = {
        width: it.w, height: it.h,
        data: { portPositions: { output: { side: 'angle', deg: plan.ports[id].output } } }
      };
      const o = vePortOffset(node, 'output');
      // Düğümün sol-üst köşesi (merkez − yarım ölçü) → portun dünya konumu
      const px = it.cx - it.w / 2 + o.dx, py = it.cy - it.h / 2 + o.dy;
      const uzunluk = Math.hypot(nx.cx - it.cx, nx.cy - it.cy);
      const ux = (nx.cx - it.cx) / uzunluk, uy = (nx.cy - it.cy) / uzunluk;
      // port = merkez + R·u  →  çapraz çarpım sıfır, iç çarpım pozitif
      expect((px - it.cx) * uy - (py - it.cy) * ux).toBeCloseTo(0, 6);
      expect((px - it.cx) * ux + (py - it.cy) * uy).toBeCloseTo(it.w / 2, 6);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Kasnak biçimi (DOM)', () => {
  function mk(node) {
    const el = document.createElement('div');
    el.innerHTML = '<div class="ve-node-box"></div>';
    veFeadApplyPulleyForm(el, node);
    return el;
  }

  test('kasnak dairesel sınıfı alır, kasnak olmayan almaz', () => {
    expect(mk({ id: 'p', type: 'fead-ac', data: { od: 152 } })
      .classList.contains('ve-node--fead-pulley')).toBe(true);
    expect(mk({ id: 'b', type: 'fead-belt', data: {} })
      .classList.contains('ve-node--fead-pulley')).toBe(false);
  });

  // Temas tarafı bu modülün EN PAHALI SESSİZ HATASI: ters verilirse çekirdek
  // geçerli ama BAŞKA bir güzergâh çözer, hata vermez. Çeperin dokusu (kesikli
  // = sırttan) bunu rozet okumadan görünür kılıyor.
  test('sırttan temas → ayrı sınıf (çeper kesikli çizilir)', () => {
    expect(mk({ id: 'i', type: 'fead-idler', data: { od: 75 } })
      .classList.contains('ve-fead-back')).toBe(true);
    expect(mk({ id: 'a', type: 'fead-ac', data: { od: 152 } })
      .classList.contains('ve-fead-back')).toBe(false);
    // Tip varsayılanı kullanıcı seçimiyle EZİLİR (tek okuma noktası: veFeadContactOf)
    expect(mk({ id: 'i2', type: 'fead-idler', data: { od: 75, contact: 'grooved' } })
      .classList.contains('ve-fead-back')).toBe(false);
  });

  // Sürücülük ROL, tip değil (Gates AG00976'da sürücü kasnak FAN).
  test('sürücü rolü tipe değil bayrağa bakar', () => {
    expect(mk({ id: 'f', type: 'fead-fan', data: { od: 150, driver: true } })
      .classList.contains('ve-fead-driver')).toBe(true);
    expect(mk({ id: 'c', type: 'fead-crank', data: { od: 162 } })
      .classList.contains('ve-fead-driver')).toBe(false);
  });

  test('çapsız / ölçekten kırpılmış kasnak işaretlenir', () => {
    expect(mk({ id: 'n', type: 'fead-crank', data: {} })
      .classList.contains('ve-fead-nodia')).toBe(true);
    const kirpik = mk({ id: 'k', type: 'fead-idler', data: { od: 10 } });
    expect(kirpik.classList.contains('ve-fead-nodia')).toBe(false);
    expect(kirpik.classList.contains('ve-fead-notoscale')).toBe(true);
    expect(mk({ id: 'ok', type: 'fead-ac', data: { od: 152 } })
      .classList.contains('ve-fead-notoscale')).toBe(false);
  });

  test('veFeadSyncPulleySize ölçüyü ÇAPTAN yazar, değişmediyse dokunmaz', () => {
    const n = { id: 'x', type: 'fead-ac', width: 64, height: 64, data: { od: 152 } };
    expect(veFeadSyncPulleySize(n)).toBe(true);
    expect(n.width).toBe(152);
    expect(n.height).toBe(152);
    expect(veFeadSyncPulleySize(n)).toBe(false);
    // kasnak olmayan düğüme dokunmaz
    const b = { id: 'b', type: 'fead-belt', width: 60, height: 54, data: {} };
    expect(veFeadSyncPulleySize(b)).toBe(false);
    expect(b.width).toBe(60);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Dışa aktarma da kasnağı DAİRE çiziyor', () => {
  // node.data.labelPos ile yaşanan hatanın aynı sınıfı: ekranda daire olan
  // kasnak, dışa aktarılan SVG/PNG'de kutu çıkarsa aynı belgenin iki farklı
  // hâli olur ve kullanıcı çıktıda kendi modelini tanıyamaz
  // (bkz. tests/unit/node-label-anchor.test.js).
  const exp = require('../../js/export-topology.js');

  function svgOf(list) {
    global.nodes = list;
    global.connections = [];
    document.body.innerHTML = '<div id="ve-canvas"></div>';
    return exp.veBuildTopologySVG();
  }

  test('kasnak rx=ry=yarıçap; kasnak olmayan köşe yarıçapı 6 kalıyor', () => {
    const svg = svgOf([
      { id: 'p', type: 'fead-ac', x: 0, y: 0, width: 152, height: 152, data: { od: 152 } },
      { id: 'b', type: 'fead-belt', x: 400, y: 0, width: 60, height: 54, data: {} }
    ]);
    expect(svg).toContain('width="152" height="152" rx="76" ry="76"');
    expect(svg).toContain('width="60" height="54" rx="6" ry="6"');
  });

  test('sırttan temas eden kasnak çıktıda da KESİKLİ çeper', () => {
    const back = svgOf([{ id: 'i', type: 'fead-idler', x: 0, y: 0, width: 75, height: 75, data: { od: 75 } }]);
    expect(back).toContain('stroke-dasharray="5 4"');
    const groove = svgOf([{ id: 'a', type: 'fead-ac', x: 0, y: 0, width: 152, height: 152, data: { od: 152 } }]);
    expect(groove).not.toContain('stroke-dasharray');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Yerleştirici yönlendirmesi', () => {
  // Genel "Otomatik Düzenle" katmanlı (Sugiyama tarzı) bir DAG düzeni kurar;
  // FEAD ise bir ÇEVRİM. Katmanlamak çevrimi keyfî bir yerden kırar ve dönüş
  // kenarını her şeyin üstünden geçirir — üstelik FEAD'de düğümün konumu
  // keyfî değil, girilmiş bir mm koordinatı var.
  test('FEAD alt topolojisinde veTidyLayout kendi yerleştiricisine gider', () => {
    eval(loadSource('tidy-layout.js'));
    const cagrildi = [];
    global.veFeadInSubTopology = () => true;
    global.veFeadArrangeGraph = (o) => { cagrildi.push(o || {}); return { ok: true }; };
    global.nodes = [{ id: 'a' }, { id: 'b' }];
    veTidyLayout({ maxZoom: 1.2 });
    expect(cagrildi).toHaveLength(1);
    delete global.veFeadInSubTopology;
    delete global.veFeadArrangeGraph;
  });
});
