/**
 * fead-cizim-masasi.test.js — ÇİZİM MASASI: KASNAK ÇİZİMDE SEÇİLİR VE TAŞINIR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Kullanıcı kararı (2026-09-23, tasarım tezgâhı II): *"Çizim Masası çok
 * güzel."* Kayış Yolu kartının çizimi giriş yüzeyi oldu. Kayış Tablosu bugün
 * kartın KATMANI — çizimin altında (Pafta, 2026-09-26; çekmece emekli).
 *
 * Hata sınıfı bu modülün her yerinde olduğu gibi SESSİZ:
 *   • ters köprü (ekran → mm) yanlışsa kasnak imlecin altından kaçar ama
 *     model yine çözülür;
 *   • kayışı koparan bir hamle yazılırsa model "çözüldü" der, Σ sarım 360'tan
 *     sapar ya da kayış bir kasnağın içinden geçer;
 *   • açıklığa bırakılan kasnak yanlış sıraya düşerse kayış boyu yüzlerce mm
 *     kayar (ölçülmüş: halkada yer değiştiren bir kasnak L 1714,61 → 2459,29);
 *   • etkileşim katmanı CSS'siz bir belgeye (kılavuzun baskısı) sızarsa her
 *     kasnağın arkasına siyah bir disk çizilir.
 *
 * Gerçek tarayıcı halkaları (sürükleme, paletten bırakma, kamera) ayrı:
 * `tests/e2e/fead-cizim-masasi.spec.js`.
 */
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
eval(loadSource('fead-belts.js'));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = []; global.connections = [];
  global.selectedNodes = [];
  document.body.innerHTML = '<div id="ve-canvas"></div>';
  delete global.createNode;
  delete global.veStateBatch;
});

// AG00976 — altı kasnak, iki sırttan avara, gergi son satırda.
function kurOrnek(key) {
  const pack = M.veFeadExampleNodes(key || 'AG00976_GATES_2025');
  const ns = pack.nodes.map((n) => {
    const d = componentDefs[n.type] || {};
    return { id: n.id, type: n.type, customName: n.customName || null, def: d,
             x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60,
             data: JSON.parse(JSON.stringify(n.data || {})) };
  });
  global.nodes = ns; global.connections = [];
  return { ns, build: M.veFeadBuildSystem(ns) };
}
const bul = (id) => global.nodes.find((n) => n.id === id);
const geom = (b) => F.tensionerState(b.sys, F.meanRel(b.sys)).geom;
const dom = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
// Model KOPYASI — "hiçbir şey değişmedi" kapıları derin eşitlikle bakıyor.
const anlik = () => JSON.stringify(global.nodes.map((n) => [n.id, n.type, n.data]));

// Sahte kurulum: createNode'un İKİ sözleşmesi — düğümü `nodes`e iter ve
// kendi saveState'ini çağırır (toplu kurulum sürmüyorsa). Toplu kurulumun
// kendisi state.test.js'te; burada yalnız kurucunun ONDAN GEÇİP GEÇMEDİĞİ.
function sahteKurulum() {
  let derinlik = 0, k = 0;
  global.veStateBatch = (fn) => {
    derinlik++; global.__topluDerinlik = derinlik;
    try { return fn(); } finally {
      derinlik--; global.__topluDerinlik = derinlik;
      if (!derinlik) saveState();
    }
  };
  global.createNode = jest.fn((type) => {
    const d = componentDefs[type] || {};
    const n = { id: 'yeni' + ++k, type, def: d, x: 3000, y: 3000, data: {} };
    global.nodes.push(n);
    if (!derinlik) saveState();
    return n;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  1) ÇİZİMİN KÖPRÜSÜ — ekran ↔ mm TEK DÖNÜŞÜMLE
// ═══════════════════════════════════════════════════════════════════════════
// Çizici ölçeğini kökte `data-fead-xf` olarak basıyor; sürükleme onu OKUYOR,
// ikinci bir ölçek hesabı yok. Kapı ters köprünün kasnak merkezlerini TAM
// olarak girdi koordinatlarına geri götürdüğünü ölçüyor — gergide girdi
// `cenX/cenY` (avara merkezi), öbürlerinde `x/y`.
describe('çizimin köprüsü — ekran ↔ mm', () => {
  test('her isabet halkası TERS köprüyle kasnağın KONUM GİRDİSİNE döner', () => {
    kurOrnek();
    const kart = { id: 'kart', type: 'fead-layout', def: componentDefs['fead-layout'], data: {} };
    global.nodes.push(kart);
    const d = dom(fead.veFeadLayoutCardHTML(kart));
    const svg = d.querySelector('.ve-fead-kanvas svg[data-fead-xf]');
    expect(svg).toBeTruthy();
    const xf = fead._feadCizimXf(svg);
    expect(xf).toBeTruthy();
    const halkalar = d.querySelectorAll('g[data-ve="hit"] circle');
    expect(halkalar).toHaveLength(6);
    halkalar.forEach((c) => {
      const n = bul(c.getAttribute('data-fead-k'));
      const ten = !!componentDefs[n.type].isFeadTensioner;
      const [x, y] = fead._feadCizimMm(xf, { x: +c.getAttribute('cx'), y: +c.getAttribute('cy') });
      expect(x).toBeCloseTo(ten ? n.data.cenX : n.data.x, 1);
      expect(y).toBeCloseTo(ten ? n.data.cenY : n.data.y, 1);
    });
  });

  test('YAZI KATSAYISI — çizim 1/k ölçüde üretilir, köprü yine girdiye döner', () => {
    // Arayüz ölçeği bir basamak büyüdü (`--fs-micro` 9 → 10 px) ama kartın
    // etiketleri kullanıcı biriminde yazılı ve kıpırdamıyordu (ölçüldü: 40
    // etiketin hepsi 7–9 px). Kart çizimi kartın 1/k ölçüsünde üretilip
    // viewBox'la büyütülüyor: yerleştirme ofsetleri aynı, ekranda k kat büyük.
    kurOrnek();
    const kart = { id: 'kart', type: 'fead-layout', def: componentDefs['fead-layout'], data: {} };
    global.nodes.push(kart);
    const svgOf = () => dom(fead.veFeadLayoutCardHTML(kart)).querySelector('.ve-fead-kanvas svg[data-fead-xf]');
    const vb = (svg) => svg.getAttribute('viewBox').split(' ').map(Number);
    const onceki = global.veThemeFs;
    try {
      delete global.veThemeFs;                                    // köprü yok → k = 1
      const s1 = svgOf();
      global.veThemeFs = (ad) => (ad === 'micro' ? 10 : 12);      // ölçek: micro 10 px
      const s2 = svgOf();
      expect(vb(s2)[2]).toBeCloseTo(vb(s1)[2] * 0.9, 6);
      expect(vb(s2)[3]).toBeCloseTo(vb(s1)[3] * 0.9, 6);
      // SVG kartın tamamını kaplıyor (inline: %100) — yani ekranda k = 10/9 büyük.
      expect(s2.getAttribute('style')).toMatch(/width:100%; height:100%/);
      // Ters köprü ölçekten bağımsız: halkalar yine KONUM GİRDİSİNE döner.
      const xf = fead._feadCizimXf(s2);
      const halkalar = s2.parentNode.querySelectorAll('g[data-ve="hit"] circle');
      expect(halkalar).toHaveLength(6);
      halkalar.forEach((c) => {
        const n = bul(c.getAttribute('data-fead-k'));
        const ten = !!componentDefs[n.type].isFeadTensioner;
        const [x, y] = fead._feadCizimMm(xf, { x: +c.getAttribute('cx'), y: +c.getAttribute('cy') });
        expect(x).toBeCloseTo(ten ? n.data.cenX : n.data.x, 1);
        expect(y).toBeCloseTo(ten ? n.data.cenY : n.data.y, 1);
      });
    } finally {
      if (onceki) global.veThemeFs = onceki; else delete global.veThemeFs;
    }
  });

  test('bozuk ölçek niteliği REDDEDİLİR — sürükleme uydurma bir ölçekle koşmaz', () => {
    const svg = (a) => ({ getAttribute: () => a });
    expect(fead._feadCizimXf(svg(null))).toBeNull();
    expect(fead._feadCizimXf(svg('1 2 3 4'))).toBeNull();          // eksik alan
    expect(fead._feadCizimXf(svg('0 2 3 4 5'))).toBeNull();        // ölçek 0
    expect(fead._feadCizimXf(svg('1 2 x 4 5'))).toBeNull();        // sayı değil
    expect(fead._feadCizimXf(svg('0.5 10 20 -300 400')))
      .toEqual({ s: 0.5, ox: 10, oy: 20, mx: -300, my: 400 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  2) ETKİLEŞİM KATMANI YALNIZ KARTTA — ve CSS'SİZ BELGEDE GÖRÜNMEZ
// ═══════════════════════════════════════════════════════════════════════════
// Rapor ve panel aynı çiziciyi çağırıyor; isabet halkaları ve işaret
// zeminleri orada bir işe yaramaz. Kart içinse görünmezlik CSS'e bırakılamaz:
// kılavuz kartın KENDİSİNİ gömüyor ve `[data-ve]` kuralları belgeye
// taşınmıyor — nitelik olmasa SVG varsayılanı SİYAH dolgudur (ölçüldü:
// kılavuzun sahne kapısı `.ve-fead-hit`i yakaladı).
describe('etkileşim katmanı', () => {
  test('kartta: her kasnağa bir isabet halkası, görünmez niteliklerle', () => {
    kurOrnek();
    const kart = { id: 'kart', type: 'fead-layout', def: componentDefs['fead-layout'], data: {} };
    global.nodes.push(kart);
    const d = dom(fead.veFeadLayoutCardHTML(kart));
    const hit = [...d.querySelectorAll('g[data-ve="hit"] circle')];
    expect(hit).toHaveLength(6);
    hit.forEach((c) => {
      expect(c.getAttribute('fill')).toBe('transparent');     // `none` isabet almaz
      expect(c.getAttribute('onmousedown'))
        .toBe("veFeadCizimBas(event,'kart','" + c.getAttribute('data-fead-k') + "')");
    });
    const hov = [...d.querySelectorAll('[data-ve="pulley-hov"]')];
    expect(hov).toHaveLength(6);
    hov.forEach((c) => {
      expect(c.getAttribute('fill')).toBe('none');
      expect(c.getAttribute('opacity')).toBe('0');
    });
  });

  test('raporun / panelin çizimi katmanı TAŞIMAZ', () => {
    const { build } = kurOrnek();
    const svg = fead.veFeadLayoutSVG(build, 440, 416);
    expect(svg).not.toContain('data-ve="hit"');
    expect(svg).not.toContain('pulley-hov');
    expect(svg).not.toContain('data-fead-xf');
    expect(svg).not.toContain('veFeadCizimBas');
  });

  test('isabet halkaları BÜYÜKTEN KÜÇÜĞE — küçük avara büyük kasnağın altında kalmaz', () => {
    kurOrnek();
    const kart = { id: 'kart', type: 'fead-layout', def: componentDefs['fead-layout'], data: {} };
    global.nodes.push(kart);
    const r = [...dom(fead.veFeadLayoutCardHTML(kart))
      .querySelectorAll('g[data-ve="hit"] circle')].map((c) => +c.getAttribute('r'));
    // SVG'de sonra gelen ÜSTTE: yarıçaplar azalan sırada olmalı.
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeLessThanOrEqual(r[i - 1]);
    // En küçüğü bile tutulabilir (dar kartta 77 mm'lik avara birkaç piksel).
    expect(Math.min(...r)).toBeGreaterThanOrEqual(11);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  2b) KAYIŞ ÇİZİMDE TIKLANIR (2026-09-26) — kutusu kalktı
// ═══════════════════════════════════════════════════════════════════════════
// Kullanıcı isteği: *"'kayış özellikleri' bileşenini de kaldırmanı istiyorum.
// Onun yerine kanvas üzerindeki kayış tıklanabilir olacak tıpkı diğer
// bileşenler gibi."* Kasnakların kalıbı: düğüm modelde, kanvasta kutusu yok,
// penceresi çizimdeki kayıştan açılır. Hata sınıfları:
//   • isabet yolu kasnak halkalarının ÜSTÜNDE olursa sarım yayındaki tık
//     kasnağı değil kayışı açar;
//   • yol CSS'siz belgeye (kılavuz) görünür nitelikle sızarsa kayışın üstüne
//     12 px'lik siyah bir şerit çizilir;
//   • mousedown durdurulmazsa kartın sürüklemesi başlar ve tık hiç gelmez.
describe('kayış çizimde tıklanır', () => {
  const kart = (id) => ({ id: id || 'kart', type: 'fead-layout', def: componentDefs['fead-layout'], data: {} });
  const secim = () => {
    global.clearSelection = () => { global.selectedNodes = []; };
    global.addToSelection = (n) => { global.selectedNodes.push(n); };
    global.veTogglePropertiesPanel = jest.fn();
  };
  afterEach(() => {
    ['clearSelection', 'addToSelection', 'veTogglePropertiesPanel'].forEach((k) => delete global[k]);
  });

  test('kartta: isabet yolu kasnak halkalarının ALTINDA, görünmez; hale opacity 0', () => {
    kurOrnek();
    const k = kart(); global.nodes.push(k);
    const d = dom(fead.veFeadLayoutCardHTML(k));
    const grup = d.querySelector('g[data-ve="hit"]');
    const yol = grup.querySelector('path.ve-fead-hit-kayis');
    expect(yol).not.toBeNull();
    // SVG'de önce gelen ALTTA: kasnak halkaları onun üstünde.
    expect(grup.firstElementChild).toBe(yol);
    expect(yol.getAttribute('data-fead-k')).toBe('ex-belt');
    expect(yol.getAttribute('stroke')).toBe('transparent');
    expect(yol.getAttribute('fill')).toBe('none');
    expect(yol.getAttribute('pointer-events')).toBe('stroke');
    expect(yol.getAttribute('onmousedown')).toBe('event.stopPropagation()');
    expect(yol.getAttribute('onclick')).toMatch(/veFeadKayisAc\(\)/);
    // AYNI eğri: görünen kayışla isabet yolu tek `d`.
    const kayis = d.querySelector('path[data-ve="belt"]');
    expect(yol.getAttribute('d')).toBe(kayis.getAttribute('d'));
    expect(kayis.getAttribute('data-fead-k')).toBe('ex-belt');
    const hale = d.querySelector('[data-ve="belt-hov"]');
    expect(hale.getAttribute('opacity')).toBe('0');
    expect(hale.getAttribute('pointer-events')).toBe('none');
  });

  test('raporun çizimi kayış kimliği, halesi ve isabet yolu TAŞIMAZ', () => {
    const { build } = kurOrnek();
    const svg = fead.veFeadLayoutSVG(build, 440, 416);
    expect(svg).not.toContain('ve-fead-hit-kayis');
    expect(svg).not.toContain('belt-hov');
    expect(svg).not.toContain('veFeadKayisAc');
    expect(dom(svg).querySelector('path[data-ve="belt"]').hasAttribute('data-fead-k')).toBe(false);
  });

  test('kayışa tık: kayış SEÇİLİR, penceresi AÇILIR, İKİ çizimde işaretli', () => {
    kurOrnek(); secim();
    ['k1', 'k2'].forEach((id) => {
      const k = kart(id); global.nodes.push(k);
      const el = document.createElement('div');
      el.id = id; el.className = 've-node';
      el.innerHTML = fead.veFeadLayoutCardHTML(k);
      document.body.appendChild(el);
    });
    expect(fead.veFeadKayisAc()).toBe(true);
    expect(global.selectedNodes.map((n) => n.id)).toEqual(['ex-belt']);
    // `addToSelection` yalnız İÇERİĞİ doldurur; pencereyi açan çağrı ayrı.
    expect(global.veTogglePropertiesPanel).toHaveBeenCalledWith(true);
    ['k1', 'k2'].forEach((id) => {
      const yanan = [...document.querySelectorAll('#' + id + ' [data-fead-k="ex-belt"].is-sel')];
      expect(yanan.length).toBe(3);                 // hale + kayış + isabet yolu
    });
    // Kasnakların hiçbiri seçili değil.
    expect(document.querySelectorAll('[data-fead-k].is-sel:not([data-fead-k="ex-belt"])')).toHaveLength(0);
  });

  test('fare altı kayışı iki çizimde yakar; kayış yoksa tık hiçbir şey açmaz', () => {
    kurOrnek(); secim();
    const k = kart(); global.nodes.push(k);
    const el = document.createElement('div');
    el.id = 'kart'; el.innerHTML = fead.veFeadLayoutCardHTML(k);
    document.body.appendChild(el);
    fead.veFeadCizimUzerinde('ex-belt');
    expect(document.querySelectorAll('[data-fead-k="ex-belt"].is-hov')).toHaveLength(3);
    fead.veFeadCizimUzerinde(null);
    global.nodes = global.nodes.filter((n) => n.type !== 'fead-belt');
    expect(fead.veFeadKayisAc()).toBe(false);
    expect(global.veTogglePropertiesPanel).not.toHaveBeenCalled();
  });

  test('veFeadKayisGaranti: yoksa KURAR ve seçimi bırakmaz; varsa dokunmaz', () => {
    sahteKurulum(); secim();
    global.nodes = [{ id: 'w', type: 'fead-wizard', def: componentDefs['fead-wizard'], data: {} }];
    global.createNode = jest.fn((type) => {
      const n = { id: 'yeni-' + type, type, def: componentDefs[type], x: 3000, y: 3000, data: {} };
      global.nodes.push(n); global.selectedNodes = [n];      // gerçek createNode da seçer
      return n;
    });
    const n = fead.veFeadKayisGaranti();
    expect(n.type).toBe('fead-belt');
    expect(global.selectedNodes).toEqual([]);
    expect(fead.veFeadKayisGaranti()).toBe(n);                 // ikinci çağrı: aynı düğüm
    expect(global.createNode).toHaveBeenCalledTimes(1);
  });

  test('kayış SİLİNMEZ — genel silme yolu onu ayıklar ve sebebini söyler', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../../js/map.js'), 'utf8');
    const bas = src.indexOf('function deleteSelectedNodes()');
    let i = src.indexOf('{', bas), der = 0, j = i;
    for (; j < src.length; j++) { if (src[j] === '{') der++; else if (src[j] === '}' && --der === 0) break; }
    const govde = src.slice(bas, j + 1);
    const kayis = { id: 'k', type: 'fead-belt' }, krank = { id: 'c', type: 'fead-crank' };
    const G = { nodes: [kayis, krank], connections: [], selectedNodes: [kayis, krank] };
    const toast = jest.fn();
    const sil = new Function('G', 'componentDefs', 'showToast',
      'var nodes = G.nodes, connections = G.connections, selectedNodes = G.selectedNodes;'
      + 'function veIsTCConnectedToGearbox(){ return false; }'
      + 'function showEmptyProperties(){} function updateAllConnections(){} function updateNodeCount(){}'
      + govde + '; deleteSelectedNodes(); G.nodes = nodes;');
    sil(G, componentDefs, toast);
    expect(G.nodes.map((n) => n.id)).toEqual(['k']);           // kasnak gitti, kayış kaldı
    expect(toast).toHaveBeenCalledWith(componentDefs['fead-belt'].noDelete, 'warning');
    // Penceresinde çöp kutusu da yok (cp-core.js — tip beyan ediyor).
    const core = fs.readFileSync(path.join(__dirname, '../../js/cp-core.js'), 'utf8');
    expect(core).toMatch(/if\(!\(componentDefs\[node\.type\] \|\| \{\}\)\.noDelete\)\s*\n\s*html \+= '<button class="ve-prop-del"/);
  });

  test('paletten kayış BIRAKILAMAZ — satırı yok (tek kopya zaten açılışta)', () => {
    // Satır geri gelirse bırakılan ikinci kayış `maxInstances` duvarına
    // çarpar: palette duran bir öğe her denemede yalnız "en fazla 1 tane"
    // derdi. Kasnak satırları DURUYOR — çizime bırakılarak ekleniyorlar.
    const fs = require('fs');
    const path = require('path');
    const idx = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
    expect(idx).not.toMatch(/data-type="fead-belt"/);
    expect(idx).toMatch(/data-type="fead-crank"/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  3) SEÇİM VE FARE ALTI SINIFLA — kart yeniden KURULMADAN
// ═══════════════════════════════════════════════════════════════════════════
describe('seçim ve fare altı', () => {
  test('fare altı İKİ çizimde ve tablo satırında aynı kasnağı yakar, kart kurulmaz', () => {
    kurOrnek();
    const kartlar = ['k1', 'k2'].map((id) =>
      ({ id, type: 'fead-layout', def: componentDefs['fead-layout'], data: {} }));
    global.nodes.push(...kartlar);
    kartlar.forEach((k) => {
      const el = document.createElement('div');
      el.id = k.id; el.className = 've-node';
      el.innerHTML = fead.veFeadLayoutCardHTML(k);
      document.body.appendChild(el);
    });
    const once = document.querySelector('#k1 .ve-fead-kanvas');
    expect(fead.veFeadCizimUzerinde('ex-ALT')).toBe(true);
    ['k1', 'k2'].forEach((id) => {
      const yanan = [...document.querySelectorAll('#' + id + ' [data-fead-k].is-hov')];
      expect(yanan.length).toBeGreaterThanOrEqual(2);          // zemin + çember (+ ad)
      yanan.forEach((e) => expect(e.getAttribute('data-fead-k')).toBe('ex-ALT'));
    });
    expect(document.querySelector('#k1 .ve-fead-kanvas')).toBe(once);   // KURULMADI
    // Aynı kasnağa ikinci kez gelmek iş yapmaz; boşalınca işaret kalkar.
    expect(fead.veFeadCizimUzerinde('ex-ALT')).toBe(false);
    fead.veFeadCizimUzerinde(null);
    expect(document.querySelectorAll('.is-hov')).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  4) KLAVYEYLE KAYDIRMA — sürüklemenin kapısının AYNISI
// ═══════════════════════════════════════════════════════════════════════════
describe('klavyeyle kaydırma', () => {
  // ADIM TAM, IZGARA YOK: ok tuşu bilinen bir değere bilinen bir adım
  // ekliyor. Bir dönem sonuç 0,1 mm'ye yuvarlanıyordu ve gerginin −161,97'si
  // tek basışta −163,0 oluyordu — girilmiş hassasiyet sessizce siliniyordu.
  test('ok 1 mm yazar, Shift 10 mm; gergide avara MERKEZİ oynar', () => {
    kurOrnek();
    const idr = bul('ex-IDR1');
    global.selectedNodes = [idr];
    const e = (key, shiftKey) => ({ key, shiftKey, preventDefault: jest.fn() });
    expect(fead.veFeadCizimTus(e('ArrowRight'))).toBe(true);
    expect(idr.data.x).toBeCloseTo(131.1, 6);
    expect(fead.veFeadCizimTus(e('ArrowUp', true))).toBe(true);   // +Y YUKARI
    expect(idr.data.y).toBeCloseTo(149.9, 6);
    expect(saveState).toHaveBeenCalledTimes(2);                    // basış başına bir adım

    const ten = bul('ex-TEN');
    const x0 = ten.data.x, y0 = ten.data.y;
    global.selectedNodes = [ten];
    fead.veFeadCizimTus(e('ArrowLeft'));
    expect(ten.data.cenX).toBeCloseTo(-162.97, 6);
    expect(ten.data.x).toBe(x0);                                   // montaj konumu YAZILMAZ
    expect(ten.data.y).toBe(y0);
  });

  test('KAYIŞI KOPARAN adım YAZILMAZ ve geri-al yığınına girmez', () => {
    kurOrnek();
    const idr = bul('ex-IDR1');
    const once = anlik();
    // Avarayı krankın merkezine taşı: kayış kasnağın içinden geçer.
    expect(fead.veFeadKasnakKaydir('ex-IDR1', -idr.data.x, -idr.data.y)).toBe(false);
    expect(anlik()).toBe(once);
    expect(saveState).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/^Buraya taşınamaz — /), 'warning');
  });

  test('model ZATEN bozuksa adım serbest — onaran kullanıcı kilitlenmesin', () => {
    kurOrnek();
    const alt = bul('ex-ALT'), idr = bul('ex-IDR1');
    alt.data.x = idr.data.x; alt.data.y = idr.data.y;           // iki kasnak üst üste
    expect(fead.veFeadYolDurumu(M.veFeadBuildSystem(global.nodes), 'mean').ok).toBe(false);
    expect(fead.veFeadKasnakKaydir('ex-ALT', -5, 0)).toBe(true);
    expect(alt.data.x).toBeCloseTo(idr.data.x - 5, 6);
  });

  test('seçili kasnak yoksa, ya da Ctrl basılıyken tuş YUTULMAZ', () => {
    kurOrnek();
    const e = { key: 'ArrowRight', preventDefault: jest.fn() };
    expect(fead.veFeadCizimTus(e)).toBe(false);                    // seçim yok
    global.selectedNodes = [bul('ex-IDR1')];
    expect(fead.veFeadCizimTus(Object.assign({}, e, { ctrlKey: true }))).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('Delete kasnağı sırayı kapatarak siler; GERGİ silinmez', () => {
    kurOrnek();
    global.selectedNodes = [bul('ex-TEN')];
    expect(fead.veFeadCizimTus({ key: 'Delete', preventDefault: jest.fn() })).toBe(true);
    expect(bul('ex-TEN')).toBeTruthy();
    global.selectedNodes = [bul('ex-IDR2')];
    fead.veFeadCizimTus({ key: 'Delete', preventDefault: jest.fn() });
    expect(bul('ex-IDR2')).toBeUndefined();
  });

  test('kökteki klavye dinleyicisi kancayı GİRİŞ KORUMASINDAN SONRA çağırıyor', () => {
    // Önce çağrılsaydı tablo hücresinde ok tuşu imleci değil kasnağı oynatırdı.
    const src = loadSource('ui-core.js');
    const kanca = src.indexOf('veFeadCizimTus(e)');
    expect(kanca).toBeGreaterThan(0);
    const koruma = src.lastIndexOf("tagName === 'INPUT'", kanca);
    expect(koruma).toBeGreaterThan(0);
    expect(koruma).toBeLessThan(kanca);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  5) KAYIŞ YOLUNUN SAĞLIĞI — TEK HÜKÜM
// ═══════════════════════════════════════════════════════════════════════════
describe('veFeadYolDurumu', () => {
  test('sağlıklı örnekte evet; eksik koordinatta sebebi söyler', () => {
    const { build } = kurOrnek();
    const d = fead.veFeadYolDurumu(build, 'mean');
    expect(d.ok).toBe(true);
    expect(d.sag).toMatch(/^Σsarım 360\.0°/);
    delete bul('ex-ALT').data.x;
    const b2 = fead.veFeadYolDurumu(M.veFeadBuildSystem(global.nodes), 'mean');
    expect(b2.ok).toBe(false);
    expect(b2.neden).toMatch(/konum/i);
  });

  test('çözülen ama KAPANMAYAN çevrim de hayır — çizildi demek doğru demek değil', () => {
    kurOrnek();
    const alt = bul('ex-ALT'), idr = bul('ex-IDR1');
    alt.data.x = idr.data.x; alt.data.y = idr.data.y;
    const b = M.veFeadBuildSystem(global.nodes);
    expect(b.ok).toBe(true);
    const d = fead.veFeadYolDurumu(b, 'mean');
    expect(d.ok).toBe(false);
    expect(d.neden).toMatch(/kapanmıyor|içinden geçiyor/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  6) KAYIŞIN ÜSTÜNE BIRAKARAK EKLE
// ═══════════════════════════════════════════════════════════════════════════
// Bağımsız kâhin: halkanın içi/dışı ışın sayımıyla (yön işaretinden değil).
function icindeMi(g, p) {
  const pts = [];
  g.spans.forEach((sp) => pts.push(sp.Pi, sp.Pj));
  let ic = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) ic = !ic;
  }
  return ic;
}
const orta = (sp, kay) => {
  const vx = sp.Pj[0] - sp.Pi[0], vy = sp.Pj[1] - sp.Pi[1], L = Math.hypot(vx, vy);
  return [(sp.Pi[0] + sp.Pj[0]) / 2 - vy / L * (kay || 0), (sp.Pi[1] + sp.Pj[1]) / 2 + vx / L * (kay || 0)];
};

describe('açıklık seçimi (saf)', () => {
  test('her açıklığın ortası O açıklığı seçer; komşular tablo sırasında', () => {
    const { build } = kurOrnek();
    const g = geom(build), N = build.order.length;
    g.spans.forEach((sp, i) => {
      const a = fead.veFeadAciklikSec(build, g, orta(sp));
      expect(a.i).toBe(i);
      expect(a.dMm).toBeLessThan(1e-6);
      expect(a.sol).toBe(build.order[i]);
      expect(a.sag).toBe(build.order[(i + 1) % N]);
      // YALNIZ gergi → sürücü açıklığı kapalı.
      expect(a.kapali).toBe(i === N - 1);
    });
  });

  test('halkanın İÇİ / DIŞI bağımsız kâhinle (ışın sayımı) aynı', () => {
    const { build } = kurOrnek();
    const g = geom(build);
    let ic = 0, dis = 0;
    g.spans.forEach((sp) => [-20, 20].forEach((kay) => {
      const p = orta(sp, kay);
      const a = fead.veFeadAciklikSec(build, g, p);
      expect(a.ic).toBe(icindeMi(g, p));
      a.ic ? ic++ : dis++;
    }));
    // İki taraf da gerçekten sınandı (hep aynı cevabı veren bir kural geçemez).
    expect(ic).toBe(6);
    expect(dis).toBe(6);
  });
});

// AYNALANMIŞ DÜZEN — halka SAAT YÖNÜNDE dolanıyor. Arşivdeki on iki örneğin
// on ikisi de saat yönünün tersine; iç/dış kuralı yönü okumasaydı (yalnız
// "açıklığın solu içtir" deseydi) örneklerin hiçbiri farkı göstermezdi —
// ölçüldü, o mutasyon aynalanmamış kapıdan YEŞİL geçti. Çekirdek iki yönü de
// kabul ediyor (Σ işaretli sarım −360°), kullanıcı düzeni aynalı girebilir.
function aynala(ns) {
  ns.forEach((n) => {
    if (!componentDefs[n.type] || !componentDefs[n.type].isFeadPulley) return;
    const d = n.data;
    if (Number.isFinite(d.x)) d.x = -d.x;
    if (Number.isFinite(d.cenX)) d.cenX = -d.cenX;
    if (Number.isFinite(d.armMeanDeg)) d.armMeanDeg = (540 - d.armMeanDeg) % 360;
    if (Number.isFinite(d.sense)) d.sense = -d.sense;
  });
  return M.veFeadBuildSystem(ns);
}

describe('aynalanmış düzen — halka saat yönünde', () => {
  test('model çözülüyor ve halka GERÇEKTEN ters yönde', () => {
    const { ns } = kurOrnek();
    const b = aynala(ns);
    expect(fead.veFeadYolDurumu(b, 'mean').ok).toBe(true);
    const g = geom(b), pts = [];
    g.spans.forEach((sp) => pts.push(sp.Pi, sp.Pj));
    let A = 0;
    for (let i = 0; i < pts.length; i++) {
      const u = pts[i], v = pts[(i + 1) % pts.length];
      A += u[0] * v[1] - v[0] * u[1];
    }
    expect(A).toBeLessThan(0);
  });

  test('iç / dış yine bağımsız kâhinle aynı', () => {
    const { ns } = kurOrnek();
    const b = aynala(ns), g = geom(b);
    let ic = 0, dis = 0;
    g.spans.forEach((sp) => [-20, 20].forEach((kay) => {
      const p = orta(sp, kay);
      const a = fead.veFeadAciklikSec(b, g, p);
      expect(a.ic).toBe(icindeMi(g, p));
      a.ic ? ic++ : dis++;
    }));
    expect(ic).toBe(6);
    expect(dis).toBe(6);
  });
});

describe('açıklığa aday — yazılmadan KOPYADA denetlenir', () => {
  const aciklik = (build, i, kay) => fead.veFeadAciklikSec(build, geom(build), orta(geom(build).spans[i], kay));

  test('AVARA bırakıldığı taraftan değer: içte kaburgalı, dışta sırt', () => {
    const { build } = kurOrnek();
    const [ice, disa] = [-20, 20].map((k) => aciklik(build, 3, k)).sort((a, b) => b.ic - a.ic);
    expect(ice.ic).toBe(true);
    expect(disa.ic).toBe(false);
    const a1 = fead.veFeadAradanAday('fead-idler', ice);
    const a2 = fead.veFeadAradanAday('fead-idler', disa);
    expect(a1.ok).toBe(true);
    expect(a1.data.contact).toBe('grooved');
    expect(a2.ok).toBe(true);
    expect(a2.data.contact).toBe('back');
    // Aksesuar tipin varsayılanında kalır.
    expect(fead.veFeadAradanAday('fead-alternator', ice).data.contact).toBe('grooved');
  });

  test('sıra SOLDAKİ komşunun hemen ardı; konum bırakılan nokta (0,1 mm)', () => {
    const { build } = kurOrnek();
    const a = aciklik(build, 3, 0);
    const d = fead.veFeadAradanAday('fead-idler', a).data;
    expect(d.beltIndex).toBe(a.sol.data.beltIndex + 0.5);
    expect(d.x).toBeCloseTo(a.mm[0], 1);
    expect(d.y).toBeCloseTo(a.mm[1], 1);
    // ÇAP YAZILMAZ — model eksik çapı varsayar ve uyarır (uydurma kalıcı olmasın).
    expect(d.od).toBeUndefined();
  });

  test('gergi ↔ sürücü açıklığı KAPALI; gergi tipi açıklığa girmez', () => {
    const { build } = kurOrnek();
    const kapali = aciklik(build, build.order.length - 1, 0);
    expect(fead.veFeadAradanAday('fead-idler', kapali))
      .toEqual({ ok: false, neden: expect.stringMatching(/gergi ile sürücü/) });
    expect(fead.veFeadAradanAday('fead-tensioner', aciklik(build, 2, 0)).ok).toBe(false);
    expect(fead.veFeadAradanAday('fead-layout', aciklik(build, 2, 0)).ok).toBe(false);
  });

  test('KAYIŞI KOPARAN ekleme reddedilir ve CANLI model HİÇ değişmez', () => {
    const { build } = kurOrnek();
    const klima = bul('ex-A_C');
    const a = fead.veFeadAciklikSec(build, geom(build), [klima.data.x, klima.data.y]);
    const once = anlik();
    const r = fead.veFeadAradanAday('fead-idler', a);
    expect(r.ok).toBe(false);
    expect(r.neden).toBeTruthy();
    // Normalize bile sıra numaralarını oynatmadı — denetim kopyada.
    expect(anlik()).toBe(once);
  });
});

describe('açıklığa ekle — TEK geri-al adımı', () => {
  test('eklenen kasnak iki komşunun ARASINA düşer, model çözülür, tek adım', () => {
    const { build } = kurOrnek();
    sahteKurulum();
    const a = fead.veFeadAciklikSec(build, geom(build), orta(geom(build).spans[3], 20));
    const sol = a.sol.id, sag = a.sag.id;
    // Yığına yazılan durum yeni kasnağın KONUMUNU ve SIRASINI taşımalı —
    // createNode'un kendi saveState'i veri yazılmadan önce koşsaydı İleri Al
    // konumsuz, sıranın sonuna düşmüş bir kasnağı geri getirirdi.
    const yazilan = [];
    saveState.mockImplementation(() => {
      const y = global.nodes.find((x) => /^yeni/.test(x.id));
      yazilan.push(y ? [y.data.x, y.data.beltIndex] : 'yok');
    });
    const n = fead.veFeadAradanEkle('fead-idler', a);
    expect(n).toBeTruthy();
    expect(createNode).toHaveBeenCalledTimes(1);
    expect(yazilan).toEqual([[n.data.x, a.sol.data.beltIndex + 0.5]]);
    saveState.mockReset();
    const sira = M.veFeadBeltOrder(global.nodes).map((x) => x.id);
    expect(sira.indexOf(n.id)).toBe(sira.indexOf(sol) + 1);
    expect(sira.indexOf(sag)).toBe(sira.indexOf(n.id) + 1);
    expect(sira[sira.length - 1]).toBe('ex-TEN');                  // gergi SONDA kaldı
    expect(fead.veFeadYolDurumu(M.veFeadBuildSystem(global.nodes), 'mean').ok).toBe(true);
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/eklendi — .+ ile .+ arasına$/), 'success');
  });

  test('reddedilen eklemede düğüm KURULMAZ, yığına adım girmez', () => {
    const { build } = kurOrnek();
    sahteKurulum();
    const kapali = fead.veFeadAciklikSec(build, geom(build),
      orta(geom(build).spans[build.order.length - 1]));
    expect(fead.veFeadAradanEkle('fead-idler', kapali)).toBeNull();
    expect(createNode).not.toHaveBeenCalled();
    expect(saveState).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/^Buraya eklenemez — /), 'warning');
  });

  // Kart kurulumu: düğüm DOM'u + tek tazeleme kapısı (çizim + tablo).
  const kurKart = (id, data) => {
    const d = componentDefs['fead-layout'];
    const n = { id, type: 'fead-layout', def: d, x: 0, y: 0,
                width: d.defaultWidth, height: d.defaultHeight, data: data || {} };
    global.nodes.push(n);
    const el = document.createElement('div');
    el.id = id;
    el.innerHTML = '<div class="ve-node-box"></div>';
    document.body.appendChild(el);
    return { n, el };
  };
  const kare = () => new Promise((r) => (typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(r) : setTimeout(r, 0)));

  test('paletten bırakma: kasnak olmayan tip FEAD\'in değil; çizim dışı TABLOYA gider', () => {
    kurOrnek();
    sahteKurulum();
    const kap = document.createElement('div');
    kap.id = 've-canvas-wrapper';
    document.body.appendChild(kap);
    // Hiçbir kartta tablo açık değil: bırakılan kasnağın satırı görünsün diye
    // geometri kartının tablosu açılır — ekleme ile birlikte TEK geri-al adımı.
    global.nodes = global.nodes.filter((n) => n.type !== 'fead-layout');
    const { n: kart } = kurKart('k1', { tablo: 0 });
    const e = { target: kap, clientX: 10, clientY: 10 };
    expect(fead.veFeadPaletBirak(e, 'fead-report')).toBe(false);   // kanvasın kendi yolu
    const once = global.nodes.length;
    // Gerçek saveState toplu kurulum sürerken YIĞINA YAZMAZ (state.js); sahte
    // olan yalnız saydığı için adım, toplu kurulumun DIŞINDA yapılan çağrıdır.
    const adim = [];
    saveState.mockImplementation(() => { if (!global.__topluDerinlik) adim.push(1); });
    expect(fead.veFeadPaletBirak(e, 'fead-waterpump')).toBe(true);
    expect(global.nodes.length).toBe(once + 1);
    expect(fead.veFeadTabloAcik(kart)).toBe(true);
    expect(adim).toHaveLength(1);
    saveState.mockImplementation(() => {});
    // Tablo zaten açıksa dokunulmaz.
    expect(fead.veFeadPaletBirak(e, 'fead-ps')).toBe(true);
    expect(fead.veFeadTabloAcik(kart)).toBe(true);
  });

  // KARTIN TABLOSU eklemeden SONRA tazelenir ve yeni kasnağı GERGİNİN ÖNÜNDE
  // gösterir. Tazeleme indis yazılmadan önce koşsaydı (ya da hiç koşmasaydı)
  // tablo eski satırları ya da yeni kasnağı gerginin ardında gösterirdi.
  test('tablonun ekleyicisi KARTIN TABLOSUNU tazeler — yeni satır gerginin önünde', async () => {
    kurOrnek();
    sahteKurulum();
    const { el } = kurKart('k1');
    fead.veFeadRefreshCards();
    await kare();
    expect(fead.veFeadTableAdd('fead-waterpump')).toBe(true);
    await kare();
    const satir = [...el.querySelectorAll('.ve-fead-pafta tr[data-ve-node]')]
      .map((x) => x.getAttribute('data-ve-node'));
    const yeni = global.nodes.find((n) => n.type === 'fead-waterpump').id;
    expect(satir).toHaveLength(7);
    expect(satir[satir.length - 1]).toBe('ex-TEN');
    expect(satir[satir.length - 2]).toBe(yeni);
  });

  test('tablonun ekleyicisi de TEK adım — yığındaki durum SIRAYI taşıyor', () => {
    kurOrnek();
    sahteKurulum();
    const yazilan = [];
    saveState.mockImplementation(() => {
      const n = global.nodes.find((x) => x.type === 'fead-waterpump');
      yazilan.push(n ? n.data.beltIndex : 'yok');
    });
    expect(fead.veFeadTableAdd('fead-waterpump')).toBe(true);
    // createNode'un kendi saveState'i indis yazılmadan ÖNCE koşsaydı yığındaki
    // durum gerginin ARDINDA duran bir kasnak taşırdı (İleri Al oraya koyar).
    expect(yazilan).toEqual([bul('ex-TEN').data.beltIndex - 0.5]);
    saveState.mockReset();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  7) KAYIŞ TABLOSU KARTIN İÇİNDE — ÇEKMECE EMEKLİ (Pafta, 2026-09-26)
// ═══════════════════════════════════════════════════════════════════════════
// Çekmece tuvalin altına yapışık bir pencereydi ve ölçüldü (1920×952,
// AG00810): kasnak ile satırı arası 659–785 px, açılınca tuval 870 → 604 px.
// Tablo artık kartın katmanı: kanvas alanına satır eklenmez, tuval kısalmaz,
// kamera oynamaz. Gerçek tarayıcı halkaları tests/e2e/fead-tablo.spec.js'te.
describe('Kayış Tablosu kartın içinde — çekmece emekli', () => {
  const KABUK = '<div class="ve-canvas-area"><div class="ve-doc-dock" id="ve-doc-dock"></div>'
    + '<div class="ve-split-container" id="ve-split-container"><div class="ve-split-pane focused">'
    + '<div class="ve-canvas-wrapper" id="ve-canvas-wrapper"></div></div></div>'
    + '<div id="ve-status-bar" class="ve-status-bar"></div></div>';
  const kare = () => new Promise((r) => (typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(r) : setTimeout(r, 0)));
  afterEach(() => { delete global.veFitViewToContent; });

  test('tablo KARTIN içinde — kanvas alanına satır eklenmiyor, kamera oynamıyor', async () => {
    document.body.innerHTML = KABUK;
    kurOrnek();
    const d = componentDefs['fead-layout'];
    global.nodes.push({ id: 'k1', type: 'fead-layout', def: d, x: 0, y: 0,
                        width: d.defaultWidth, height: d.defaultHeight, data: {} });
    const el = document.createElement('div');
    el.id = 'k1'; el.innerHTML = '<div class="ve-node-box"></div>';
    document.getElementById('ve-canvas-wrapper').appendChild(el);
    global.veFitViewToContent = jest.fn();
    const alan = document.querySelector('.ve-canvas-area');
    const cocuk0 = alan.children.length;
    fead.veFeadRefreshCards();
    await kare();
    expect(el.querySelector('.ve-fead-pafta tr[data-ve-node]')).toBeTruthy();
    expect(alan.children.length).toBe(cocuk0);                 // kabuğa satır YOK
    expect(document.getElementById('ve-fead-tablo')).toBeNull();
    // Tabloyu kapatıp açmak kamerayı OYNATMAZ (çekmece sığdırıyordu).
    fead.veFeadTabloToggle('k1');
    fead.veFeadTabloToggle('k1');
    expect(veFitViewToContent).not.toHaveBeenCalled();
  });

  test('FEAD\'den çıkarken kapatılacak pencere YOK; ana topolojide tablo YOK', async () => {
    const src = loadSource('cp-fead.js');
    const govde = src.slice(src.indexOf('function veFeadCloseEditor('), src.indexOf('function veFeadCollapseToRoot('));
    expect(govde).not.toMatch(/veFeadTablo/);
    // Ana topoloji: yalnız modül kartı — tazeleme kapısının tablo ayağı boş döner.
    document.body.innerHTML = KABUK;
    global.nodes = [{ id: 'm', type: 'fead-analysis', def: componentDefs['fead-analysis'], data: {} }];
    expect(fead.veFeadRefreshTableCards()).toBe(0);
    expect(document.querySelectorAll('.ve-fead-pafta')).toHaveLength(0);
  });
});
