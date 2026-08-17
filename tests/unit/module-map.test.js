/**
 * module-map.test.js — modül düğümünün HARİTA biçimi + görünüm modu
 *
 * KULLANICI İSTEĞİ (2026-08-17): "bu topolojilerin tüm topoloji haritalarıyla
 * da yan yana durmalarını, topoloji çerçevelerinin uygun bir yerlerinde alt
 * topoloji isimlerinin yazmasını istiyorum … bu yapı ayarlardan seçilebilir
 * olsun."
 *
 * Buradaki testler ÇEKİRDEĞİ tutuyor:
 *   • biçim çözümü (düğüm tercihi > genel ayar > kamera eşiği)
 *   • ölçü kuralının biçme göre değişmesi — ve kullanıcının elle verdiği
 *     ölçünün korunması
 *   • haritanın DURUMDAN çizilmesi (canlı DOM yok, id yok → kimlik çakışması
 *     imkânsız) ve port geometrisinin ana kanvasla AYNI kaynaktan gelmesi
 *   • biçim değişince ad elemanının KAYBOLMAMASI — kart adı kopyalamıyor,
 *     TAŞIYOR; söküp yeniden kurarken kurtarılmazsa ad sessizce giderdi
 *
 * HTML dizgisi/etiket metni testleri yok (CLAUDE.md test politikası): sunum
 * için panel başına tek "üretiliyor mu / patlamıyor mu" smoke testi yeter.
 */

const stubs = stubGlobals();

document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];

// Uygulamadaki yükleme sırası: topo-mini.js → components.js
eval(loadSource('topo-mini.js'));
eval(loadSource('components.js'));

const setMode = (m) => { localStorage.setItem(VE_MODULE_VIEW_KEY, m); veApplyModuleViewSizes(); };

// Gerçek bir alt topoloji: iki düğüm + bir bağlantı (Motor → Şanzıman).
const altTopoloji = () => ({
  nodes: [
    { id: 'comp-1', type: 'engine',  x: 100, y: 100, width: 66, height: 76 },
    { id: 'comp-2', type: 'gearbox', x: 300, y: 110, width: 65, height: 60 }
  ],
  connections: [{ from: 'comp-1', to: 'comp-2', fromPort: 'output', toPort: 'input' }]
});

const modulDugum = (over) =>
  Object.assign({ id: 'm1', type: 'arac-performans', x: 0, y: 0,
                  width: VE_MODULE_CARD_W, height: VE_MODULE_CARD_H, data: {} }, over);

const doluModul = (over) => modulDugum(Object.assign({ data: { subTopology: altTopoloji() } }, over));

function iskelet(ad) {
  const el = document.createElement('div');
  el.className = 've-node';
  el.innerHTML =
    '<div class="ve-node-box"><svg data-rol="sembol"></svg></div>' +
    '<div class="ve-node-label">' + (ad || 'Araç Performans') + '</div>';
  return el;
}

beforeEach(() => {
  resetStubs(stubs);
  localStorage.clear();
  global.nodes = [];
  global.canvasZoom = 1;
  veApplyModuleViewSizes();
});

// ── Genel ayar ────────────────────────────────────────────────────────────
describe('veModuleViewSetting / veSetModuleViewSetting', () => {
  test('varsayılan biçim harita — kullanıcının asıl istediği manzara', () => {
    expect(veModuleViewSetting()).toBe(VE_MODULE_VIEW_DEFAULT);
    expect(VE_MODULE_VIEW_DEFAULT).toBe('map');
  });

  test('üç mod da yazılıp geri okunur', () => {
    VE_MODULE_VIEW_MODES.forEach((m) => {
      expect(veSetModuleViewSetting(m)).toBe(m);
      expect(veModuleViewSetting()).toBe(m);
    });
  });

  test('geçersiz/bozuk değer varsayılana düşer (eski kayıt patlatmaz)', () => {
    localStorage.setItem(VE_MODULE_VIEW_KEY, 'boyle-bir-mod-yok');
    expect(veModuleViewSetting()).toBe(VE_MODULE_VIEW_DEFAULT);
    expect(veSetModuleViewSetting('yok')).toBe(VE_MODULE_VIEW_DEFAULT);
  });
});

// ── Biçim çözümü: en dar kapsam kazanır ───────────────────────────────────
describe('veModuleLayoutFor — düğüm tercihi > genel ayar > kamera', () => {
  test('genel ayar biçmi belirler', () => {
    expect(veModuleLayoutFor(modulDugum(), { mode: 'card' })).toBe('card');
    expect(veModuleLayoutFor(modulDugum(), { mode: 'map' })).toBe('map');
  });

  test('düğümün kendi tercihi genel ayarı YENER (bir modülü katlamak diğerlerini etkilemez)', () => {
    const kapali = modulDugum({ data: { mapOpen: false } });
    const acik   = modulDugum({ data: { mapOpen: true } });
    expect(veModuleLayoutFor(kapali, { mode: 'map' })).toBe('card');
    expect(veModuleLayoutFor(acik,   { mode: 'card' })).toBe('map');
  });

  test('zoom modunda eşik kamerayı okur', () => {
    expect(veModuleLayoutFor(modulDugum(), { mode: 'zoom', zoom: VE_MODULE_ZOOM_THRESHOLD })).toBe('map');
    expect(veModuleLayoutFor(modulDugum(), { mode: 'zoom', zoom: VE_MODULE_ZOOM_THRESHOLD - 0.01 })).toBe('card');
  });

  test('zoom modunda düğüm tercihi yine kazanır', () => {
    const n = modulDugum({ data: { mapOpen: true } });
    expect(veModuleLayoutFor(n, { mode: 'zoom', zoom: 0.2 })).toBe('map');
  });

  test('düğümsüz çağrı (yeni düğümün varsayılanı) da çözülür', () => {
    expect(veModuleLayoutFor(null, { mode: 'map' })).toBe('map');
    expect(veModuleLayoutFor(null, { mode: 'zoom', zoom: 0.3 })).toBe('card');
  });
});

// ── Ölçü kuralı ───────────────────────────────────────────────────────────
// İki ölçü iki yerde tutulsaydı biri sessizce eskirdi; kural TEK yerde
// (veModuleSizeFor) ve "dokunulmamış ölçü" ölçütü tek yerde (veIsDefaultModuleSize).
describe('ölçü biçme göre değişir, kullanıcının ölçüsü korunur', () => {
  test('bilinen varsayılanların hepsi güncel biçmin ölçüsüne taşınır', () => {
    setMode('map');
    [[VE_MODULE_LEGACY_W, VE_MODULE_LEGACY_H], [VE_MODULE_CARD_W, VE_MODULE_CARD_H]].forEach(([w, h]) => {
      const n = modulDugum({ width: w, height: h });
      expect(veModuleSizeFor(n)).toEqual({ w: VE_MODULE_MAP_W, h: VE_MODULE_MAP_H, changed: true });
    });
    // Zaten harita ölçüsündeyse değişiklik yok (gereksiz DOM yazımı olmasın)
    const n = modulDugum({ width: VE_MODULE_MAP_W, height: VE_MODULE_MAP_H });
    expect(veModuleSizeFor(n).changed).toBe(false);
  });

  // Katla düğmesi kart genişliğini 214 → 236 yaptı. Eski dosyalarda 214×72
  // donmuş modül düğümleri var; listede anılmasalardı sonsuza dek o ölçüde
  // kalır ve adları kesilirdi (tam olarak düğmeyi eklerken kırdığımız şey).
  test('katla düğmesi öncesi kart ölçüsü (214×72) de "dokunulmamış" sayılır', () => {
    expect(VE_MODULE_LEGACY_SIZES).toEqual(expect.arrayContaining([[214, 72]]));
    setMode('card');
    const n = modulDugum({ width: 214, height: 72 });
    expect(veModuleSizeFor(n)).toEqual({ w: VE_MODULE_CARD_W, h: VE_MODULE_CARD_H, changed: true });
    setMode('map');
    expect(veModuleSizeFor(modulDugum({ width: 214, height: 72 })).w).toBe(VE_MODULE_MAP_W);
  });

  test('ayar karta dönünce harita ölçüsü de geri iner', () => {
    setMode('card');
    const n = modulDugum({ width: VE_MODULE_MAP_W, height: VE_MODULE_MAP_H });
    expect(veModuleSizeFor(n)).toEqual({ w: VE_MODULE_CARD_W, h: VE_MODULE_CARD_H, changed: true });
  });

  test('kullanıcının elle verdiği ölçü hiçbir modda değişmez', () => {
    VE_MODULE_VIEW_MODES.forEach((m) => {
      setMode(m);
      const n = modulDugum({ width: 412, height: 233 });
      expect(veNormalizeModuleSize(n)).toBe(false);
      expect([n.width, n.height]).toEqual([412, 233]);
    });
  });

  test('yeni düğümün varsayılan ölçüsü de ayara uyar (createNode / sınır çerçevesi buradan okur)', () => {
    setMode('map');
    expect(veNodeDefaultSize('arac-performans')).toEqual({ w: VE_MODULE_MAP_W, h: VE_MODULE_MAP_H });
    setMode('card');
    expect(veNodeDefaultSize('mount-analysis')).toEqual({ w: VE_MODULE_CARD_W, h: VE_MODULE_CARD_H });
  });

  test('SIRADAN bileşen bu kuralın dışında', () => {
    setMode('map');
    const n = { id: 'e1', type: 'engine', width: VE_MODULE_CARD_W, height: VE_MODULE_CARD_H, data: {} };
    expect(veNormalizeModuleSize(n)).toBe(false);
  });
});

// ── Harita çizimi (SAF) ───────────────────────────────────────────────────
describe('veTopoMiniBox — içerik sınır kutusu', () => {
  test('kutu düğümleri kapsar ve pay bırakır', () => {
    const box = veTopoMiniBox(altTopoloji().nodes, 10);
    // en sağ kenar 300+65=365, en alt kenar 100+76=176
    expect(box).toEqual({ x: 90, y: 90, w: (365 - 100) + 20, h: (176 - 100) + 20 });
  });

  test('ölçüsü kaydedilmemiş düğümde tipin varsayılanı kullanılır (sabit 65 değil)', () => {
    const box = veTopoMiniBox([{ id: 's1', type: 'sensor', x: 0, y: 0 }], 0);
    expect([box.w, box.h]).toEqual([veNodeDefaultSize('sensor').w, veNodeDefaultSize('sensor').h]);
  });

  test('koordinatsız/boş girdide null (çizilecek bir şey yok)', () => {
    expect(veTopoMiniBox([])).toBeNull();
    expect(veTopoMiniBox(null)).toBeNull();
    expect(veTopoMiniBox([{ id: 'x', type: 'engine' }])).toBeNull();
  });
});

describe('veTopoMiniSVG — harita DURUMDAN çizilir', () => {
  const sub = altTopoloji();

  test('viewBox içerik kutusuna oturur → ölçek bedava', () => {
    const svg = veTopoMiniSVG(sub.nodes, sub.connections);
    const box = veTopoMiniBox(sub.nodes);
    expect(svg).toContain('viewBox="' + box.x + ' ' + box.y + ' ' + box.w + ' ' + box.h + '"');
  });

  test('her düğüm bir kutu + tipin KENDİ sembolü, her bağlantı bir eğri', () => {
    const svg = veTopoMiniSVG(sub.nodes, sub.connections);
    const el = document.createElement('div');
    el.innerHTML = svg;
    // Düğüm kutusunu sembolün kendi dikdörtgenlerinden ayıran işaret:
    // vector-effect yalnız kutuda var (sembolün içi ölçekle küçülür).
    expect(el.querySelectorAll('rect[vector-effect]')).toHaveLength(2);
    expect(el.querySelectorAll('path[d^="M "]')).toHaveLength(1);
    // Sembol gövdesi componentDefs'ten geliyor (ikinci kopya tutulmuyor)
    expect(svg).toContain(componentDefs.engine.svg.replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''));
  });

  test('KİMLİK YOK — kanvastaki düğümlerle çakışamaz', () => {
    // DOM klonlansaydı içerideki comp-1 ile dışarıdaki comp-1 aynı belgede
    // olurdu; getElementById ile çalışan her yol yanlış düğümü bulabilirdi.
    expect(veTopoMiniSVG(sub.nodes, sub.connections)).not.toContain('id="comp-1"');
  });

  test('bağlantı ucu port geometrisinin TEK kaynağından okunur', () => {
    const svg = veTopoMiniSVG(sub.nodes, sub.connections);
    const f = vePortOffset(sub.nodes[0], 'output');
    const t = vePortOffset(sub.nodes[1], 'input');
    const x1 = sub.nodes[0].x + f.dx, y1 = sub.nodes[0].y + f.dy;
    const x2 = sub.nodes[1].x + t.dx, y2 = sub.nodes[1].y + t.dy;
    expect(svg).toContain('M ' + x1 + ' ' + y1);
    expect(svg).toContain(x2 + ' ' + y2 + '"');
  });

  test('çizgi kalınlığı ölçekle küçülmez (0,29 ölçekte bağlantılar kaybolurdu)', () => {
    expect(veTopoMiniSVG(sub.nodes, sub.connections)).toContain('vector-effect="non-scaling-stroke"');
  });

  test('ucu boşta / eksik düğümlü bağlantı sessizce atlanır', () => {
    const el = document.createElement('div');
    el.innerHTML = veTopoMiniSVG(sub.nodes, [{ from: 'comp-1', to: 'yok' }, null]);
    expect(el.querySelectorAll('path[d^="M "]')).toHaveLength(0);
  });

  test('boş topolojide boş dize (çağıran "harita yok" diyebilsin)', () => {
    expect(veTopoMiniSVG([], [])).toBe('');
    expect(veModuleMapSVG(modulDugum())).toBe('');
    expect(veModuleMapSVG(modulDugum({ data: { subTopology: { nodes: [] } } }))).toBe('');
  });

  test('yerleştirme nitelikleri dışa aktarma için verilebilir', () => {
    const svg = veModuleMapSVG(doluModul(), { x: 5, y: 9, w: 100, h: 60 });
    expect(svg).toContain('x="5" y="9" width="100" height="60"');
  });
});

// ── Kart kurulumu (smoke) ─────────────────────────────────────────────────
describe('veApplyModuleCard — harita biçimi', () => {
  test('harita biçiminde başlık + harita kurulur', () => {
    setMode('map');
    const el = iskelet();
    expect(veApplyModuleCard(el, doluModul())).toBe(true);
    expect(el.querySelector('.ve-mod-card--map')).toBeTruthy();
    expect(el.querySelector('.ve-mod-head')).toBeTruthy();
    expect(el.querySelector('.ve-mod-map svg')).toBeTruthy();
  });

  test('kart biçiminde harita alanı hiç kurulmaz', () => {
    setMode('card');
    const el = iskelet();
    veApplyModuleCard(el, doluModul());
    expect(el.querySelector('.ve-mod-card--card')).toBeTruthy();
    expect(el.querySelector('.ve-mod-map')).toBeNull();
  });

  test('boş modülde harita alanı boş bırakılmaz, ne yapılacağını söyler', () => {
    setMode('map');
    const el = iskelet();
    veApplyModuleCard(el, modulDugum());
    expect(el.querySelector('.ve-mod-map').classList.contains('is-empty')).toBe(true);
    expect(el.querySelector('.ve-mod-map-hint').textContent).toBe('Boş — çift tıklayın');
  });

  test('ad elemanı harita biçiminde de TAŞINIR (kopya yok)', () => {
    setMode('map');
    const el = iskelet('Araç Performans');
    const once = el.querySelector('.ve-node-label');
    veApplyModuleCard(el, doluModul());
    expect(el.querySelectorAll('.ve-node-label')).toHaveLength(1);
    expect(el.querySelector('.ve-node-label')).toBe(once);
    expect(el.querySelector('.ve-mod-head').contains(once)).toBe(true);
  });

  test('katla düğmesi her iki biçimde de var ve yönü doğru', () => {
    setMode('map');
    const acik = iskelet();
    veApplyModuleCard(acik, doluModul());
    expect(acik.querySelector('.ve-mod-toggle').textContent).toBe('▴');

    setMode('card');
    const kapali = iskelet();
    veApplyModuleCard(kapali, doluModul());
    expect(kapali.querySelector('.ve-mod-toggle').textContent).toBe('▾');
  });
});

// ── Söküp yeniden kurma ───────────────────────────────────────────────────
// EN KRİTİK KAPI: kart adı KOPYALAMIYOR, TAŞIYOR (module-card.test.js'teki
// sözleşme). Biçim değişirken kart sökülüyor; ad kurtarılmazsa düğüm adını
// sessizce kaybederdi ve bunu kimse fark etmezdi.
describe('veModuleCardTeardown / veRefreshModuleNode — ad hayatta kalır', () => {
  function kanvasaKoy(node) {
    const el = iskelet(node.customName || 'Araç Performans');
    el.id = node.id;
    document.getElementById('ve-canvas').appendChild(el);
    veApplyModuleCard(el, node);
    global.nodes = [node];
    return el;
  }

  afterEach(() => { document.getElementById('ve-canvas').innerHTML = ''; });

  test('söküm ad ve sembolü kartın dışına geri taşır', () => {
    setMode('map');
    const n = doluModul();
    const el = kanvasaKoy(n);
    const etiket = el.querySelector('.ve-node-label');

    expect(veModuleCardTeardown(el)).toBe(true);
    expect(el.querySelector('.ve-mod-card')).toBeNull();
    expect(el.querySelector('.ve-node-label')).toBe(etiket);          // AYNI eleman
    expect(el.querySelector('.ve-node-box svg[data-rol="sembol"]')).toBeTruthy();
    expect(el.classList.contains('ve-node--module')).toBe(false);
  });

  test('biçim değişince ad kaybolmaz ve ikinci kopya üremez', () => {
    setMode('map');
    const n = doluModul({ customName: 'Kamyon Zinciri' });
    const el = kanvasaKoy(n);
    el.querySelector('.ve-node-label').textContent = 'Kamyon Zinciri';

    setMode('card');
    veRefreshModuleNode(n);
    expect(el.querySelectorAll('.ve-node-label')).toHaveLength(1);
    expect(el.querySelector('.ve-node-label').textContent).toBe('Kamyon Zinciri');
    expect(el.querySelectorAll('svg[data-rol="sembol"]')).toHaveLength(1);

    setMode('map');
    veRefreshModuleNode(n);
    expect(el.querySelector('.ve-node-label').textContent).toBe('Kamyon Zinciri');
    expect(el.querySelector('.ve-mod-map svg')).toBeTruthy();
  });

  test('tazeleme ölçüyü DOM ile birlikte günceller', () => {
    setMode('card');
    const n = doluModul();
    const el = kanvasaKoy(n);

    setMode('map');
    veRefreshModuleNode(n);
    expect([n.width, n.height]).toEqual([VE_MODULE_MAP_W, VE_MODULE_MAP_H]);
    expect(el.style.width).toBe(VE_MODULE_MAP_W + 'px');
    expect(el.querySelector('.ve-node-box').style.height).toBe(VE_MODULE_MAP_H + 'px');
  });

  test('düğmesi tek düğümü çevirir, genel ayara dokunmaz', () => {
    setMode('map');
    const n = doluModul();
    const el = kanvasaKoy(n);

    el.querySelector('.ve-mod-toggle').click();
    expect(n.data.mapOpen).toBe(false);
    expect(el.querySelector('.ve-mod-map')).toBeNull();
    expect(veModuleViewSetting()).toBe('map');          // genel ayar yerinde

    el.querySelector('.ve-mod-toggle').click();
    expect(n.data.mapOpen).toBe(true);
    expect(el.querySelector('.ve-mod-map svg')).toBeTruthy();
  });

  test('veRefreshModuleCards yalnız modül düğümlerini sayar', () => {
    setMode('map');
    const m = doluModul();
    kanvasaKoy(m);
    global.nodes = [m, { id: 'e1', type: 'engine', x: 0, y: 0, data: {} }];
    expect(veRefreshModuleCards()).toBe(1);
  });
});

// ── 'zoom' modunda kamera eşiği ───────────────────────────────────────────
describe('veSyncModuleZoomLayout — eşik geçilmedikçe iş yapmaz', () => {
  test('zoom modu dışında hiç çalışmaz', () => {
    setMode('map');
    expect(veSyncModuleZoomLayout()).toBe(false);
  });

  test('yalnız eşik geçişinde tazeler (her pan karesinde değil)', () => {
    setMode('zoom');
    global.canvasZoom = 1;
    expect(veSyncModuleZoomLayout()).toBe(true);    // ilk çağrı: biçim saptanır
    expect(veSyncModuleZoomLayout()).toBe(false);   // değişmedi → iş yok
    global.canvasZoom = 0.2;
    expect(veSyncModuleZoomLayout()).toBe(true);    // eşik geçildi
    expect(veSyncModuleZoomLayout()).toBe(false);
  });
});
