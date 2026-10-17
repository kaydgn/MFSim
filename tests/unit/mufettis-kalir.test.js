/**
 * mufettis-kalir.test.js — BİLEŞEN PENCERESİ AÇIK KALIR (kullanıcı isteği 2026-10-16)
 * ─────────────────────────────────────────────────────────────────────────
 * "Bileşen pencerelerine çift tıklayınca yanda açılan pencere kalsın, boşluğa
 * veya başka bir yere tıklayınca gitmesin. Başka bir bileşene tıklayınca da
 * onun penceresi gelecek."
 *
 * Ölçülen eski hâl (gerçek tarayıcı, AP örneği isb340_tc411, 1920×952): pencere
 * çift tıkla açılıyor; boş alana tık, başka bir bileşene tek tık (sütun ya da
 * modal tipi) ve Ctrl+Z — dördü de pencereyi kapatıyor, tuval 1.256 → 1.636 px
 * zıplıyordu. Sebep tek: seçim boşalınca showEmptyProperties pencereyi
 * kapatıyordu (başka bir bileşene tık da önce seçimi temizliyor).
 *
 * Gerçek fare, @media ve tarayıcının change olayı: tests/e2e/mufettis-sutun.spec.js → *KALIR*.
 */
const fs = require('fs');
const path = require('path');

global.nodes = [];
global.connections = [];
global.selectedNodes = [];
global.requestAnimationFrame = (f) => { f(); return 0; };
global.componentDefs = {
  'test-a': { name: 'Diferansiyel', svg: '<svg></svg>' },
  'test-b': { name: 'Propşaft', svg: '<svg></svg>' },
  'test-genis': { name: 'Motor', svg: '<svg></svg>' },
};

const stubs = stubGlobals();
eval(loadSource('cp-core.js'));
eval(loadSource('map.js'));
// Sütuna sığmayan bir tip — içeriği varsayılan paneldir (motorun gerçek paneli
// burada kurulmaz; ölçülen şey pencerenin davranışı).
VE_SUTUNA_SIGMAYAN.push('test-genis');
// Satır içi onclick global adı arar (tarayıcıda işlevler zaten global).
window.veMufettisSil = (id) => veMufettisSil(id);
window.veMufettisGenisAc = () => veMufettisGenisAc();

const genisEkran = (evet) => {
  window.matchMedia = (q) => ({ matches: !!evet && /min-width:\s*1280px/.test(q), media: q });
};

function kur() {
  document.body.innerHTML =
    '<div id="ve-properties-overlay" class="ve-properties-overlay" style="display:none;">'
    + '<div class="ve-properties" id="ve-properties"><div class="ve-properties-header">'
    + '<span id="ve-properties-title"></span></div><div class="ve-properties-content"></div></div></div>'
    + '<div class="ve-node" id="A"><div class="ve-node-box"></div></div>'
    + '<div class="ve-node" id="B"><div class="ve-node-box"></div></div>'
    + '<div class="ve-node" id="M"><div class="ve-node-box"></div></div>';
  const mk = (id, type) => ({ id, type, def: componentDefs[type], data: { x: 1 } });
  global.nodes = [mk('A', 'test-a'), mk('B', 'test-b'), mk('M', 'test-genis')];
  global.selectedNodes = [];
  _veLastPropNodeId = null;
  _veMufettisKart = false;
  _veModalSutundan = false;
  document.documentElement.className = '';
  genisEkran(true);
  return global.nodes;
}
const ov = () => document.getElementById('ve-properties-overlay');
const acik = () => ov().classList.contains('visible');
const baslik = () => document.getElementById('ve-properties-title').textContent;
const icerik = () => document.querySelector('.ve-properties-content');
const modal = () => document.getElementById('ve-properties').classList.contains('ve-properties--modal');
// Kullanıcının yolu: kutuya basmak (ui-core.js veAttachNodeDrag) ve çift tık.
const bas = (n) => { if(selectedNodes.indexOf(n) === -1) clearSelection(); addToSelection(n); };
const ciftTik = (n) => { bas(n); veTogglePropertiesPanel(true); };

beforeEach(() => resetStubs(stubs));

describe('seçim boşalınca pencere KAPANMAZ', () => {
  test('boş alana tık: pencere açık, içerik ve başlık konuda kalır', () => {
    const [A] = kur();
    ciftTik(A);
    expect(acik()).toBe(true);
    clearSelection();                     // boş tuvale basmak (ui-core.js)
    expect(selectedNodes).toHaveLength(0);
    expect(acik()).toBe(true);
    expect(baslik()).toContain('Diferansiyel');
    expect(icerik().querySelector('#ve-node-name-display-A')).not.toBeNull();
    expect(document.documentElement.classList.contains('ve-mufettis-acik')).toBe(true);
  });

  test('konu tuvalde işaretli; pencere kapanınca işaret söner', () => {
    const [A, B] = kur();
    ciftTik(A);
    clearSelection();
    expect(document.getElementById('A').classList.contains('ve-node--mufettis')).toBe(true);
    bas(B);
    expect(document.getElementById('A').classList.contains('ve-node--mufettis')).toBe(false);
    expect(document.getElementById('B').classList.contains('ve-node--mufettis')).toBe(true);
    veTogglePropertiesPanel(false);
    expect(document.querySelectorAll('.ve-node--mufettis')).toHaveLength(0);
  });
});

describe('başka bir bileşene tık: onun penceresi YERİNDE gelir', () => {
  test('pencere kapanıp açılmaz, içerik değişir', () => {
    const [A, B] = kur();
    ciftTik(A);
    let kapandi = 0;
    new MutationObserver(() => { if(!acik()) kapandi++; }).observe(ov(), { attributes: true, attributeFilter: ['class'] });
    bas(B);
    return Promise.resolve().then(() => {
      expect(kapandi).toBe(0);
      expect(acik()).toBe(true);
      expect(baslik()).toContain('Propşaft');
      expect(icerik().querySelector('#ve-node-name-display-B')).not.toBeNull();
    });
  });

  test('odak, içerik DEĞİŞMEDEN önce bırakılır — alan eski bileşene yazılabilsin', () => {
    const [A, B] = kur();
    ciftTik(A);
    const g = document.createElement('input');
    icerik().appendChild(g);
    g.focus();
    let bagliyken = null;
    g.addEventListener('blur', () => { bagliyken = g.isConnected && !!icerik().querySelector('#ve-node-name-display-A'); });
    bas(B);
    expect(bagliyken).toBe(true);
  });

  test('çoklu seçim konu taşımaz: seçim boşalınca pencere boş hâline iner', () => {
    const [A, B] = kur();
    ciftTik(A);
    addToSelection(B);                    // Ctrl ile ikinci bileşen
    expect(icerik().textContent).toContain('2 bileşen seçili');
    clearSelection();
    expect(acik()).toBe(true);
    expect(icerik().textContent).toContain('Seçili bileşen yok');
    expect(baslik()).toBe('Özellikler');
  });
});

describe('konu kalmayınca ve bağlam değişince', () => {
  test('silinen konu: pencere açık kalır, boş hâline iner', () => {
    const [A] = kur();
    ciftTik(A);
    global.nodes = global.nodes.filter((n) => n.id !== 'A');
    global.selectedNodes = [];
    showEmptyProperties();                // deleteSelectedNodes'un sonu
    expect(acik()).toBe(true);
    expect(icerik().textContent).toContain('Seçili bileşen yok');
    expect(baslik()).toBe('Özellikler');
  });

  test('bağlam değişti (veMufettisKapat): pencere kapanır ve konusunu bırakır', () => {
    const [A] = kur();
    ciftTik(A);
    veMufettisKapat();
    expect(acik()).toBe(false);
    expect(veMufettisKonusu()).toBeNull();
    expect(icerik().textContent).toContain('Seçili bileşen yok');
  });

  test('çöp kutusu pencerenin KONUSUNU siler, seçimi değil', () => {
    const [A] = kur();
    ciftTik(A);
    clearSelection();
    const sil = jest.fn(() => selectedNodes.map((n) => n.id));
    const asil = deleteSelectedNodes;
    deleteSelectedNodes = sil;
    try {
      icerik().querySelector('.ve-prop-del').click();
    } finally { deleteSelectedNodes = asil; }
    expect(sil).toHaveBeenCalledTimes(1);
    expect(sil.mock.results[0].value).toEqual(['A']);
  });

  test('geri-al: pencere konunun YENİ düğümüyle kurulur (restoreState çağırıyor)', () => {
    const [A] = kur();
    A.customName = 'Eski ad';
    ciftTik(A);
    // restoreState düğüm nesnelerini yeniden yaratır
    global.nodes = [{ id: 'A', type: 'test-a', def: componentDefs['test-a'], customName: 'Geri alınan ad', data: {} }];
    clearSelection();
    veMufettisTazele();
    expect(acik()).toBe(true);
    expect(baslik()).toContain('Geri alınan ad');
    const src = fs.readFileSync(path.join(__dirname, '../../js/state.js'), 'utf8');
    const i = src.indexOf('function _veRestoreStateInner') >= 0 ? src.indexOf('function _veRestoreStateInner') : src.indexOf('clearSelection();');
    expect(src.slice(i).indexOf('veMufettisTazele()')).toBeGreaterThan(0);
  });
});

describe('sütuna sığmayan bileşen (VE_SUTUNA_SIGMAYAN) açık sütunda KART olarak gelir', () => {
  test('tek tık kart · çift tık geniş pencere · kapatınca karta, ikinci kapatışta kapanır', () => {
    const [A, , M] = kur();
    ciftTik(A);
    bas(M);                                // sütun açıkken tek tık
    expect(acik()).toBe(true);
    expect(modal()).toBe(false);           // perde yok, sütun yerinde
    expect(icerik().querySelector('.ve-prop-genis')).not.toBeNull();
    veTogglePropertiesPanel(true);         // çift tık
    expect(modal()).toBe(true);
    expect(icerik().querySelector('.ve-prop-genis')).toBeNull();
    veTogglePropertiesPanel(false);        // ✕ / Esc
    expect(acik()).toBe(true);
    expect(modal()).toBe(false);
    expect(icerik().querySelector('.ve-prop-genis')).not.toBeNull();
    veTogglePropertiesPanel(false);
    expect(acik()).toBe(false);
  });

  test('kartın düğmesi geniş pencereyi açar', () => {
    const [A, , M] = kur();
    ciftTik(A);
    bas(M);
    icerik().querySelector('.ve-prop-genis button').click();
    expect(modal()).toBe(true);
    expect(acik()).toBe(true);
  });

  test('pencere kapalıyken ya da dar ekranda kart YOK — tam içerik (eski davranış)', () => {
    const [, , M] = kur();
    bas(M);
    expect(icerik().querySelector('.ve-prop-genis')).toBeNull();
    expect(modal()).toBe(true);
    kur();
    genisEkran(false);
    ciftTik(global.nodes[0]);
    bas(global.nodes[2]);
    expect(icerik().querySelector('.ve-prop-genis')).toBeNull();
  });

  test('aynı bileşenin kendini yenilemesi açık geniş pencereyi karta İNDİRMEZ', () => {
    const [A, , M] = kur();
    ciftTik(A);
    bas(M);
    veTogglePropertiesPanel(true);
    showNodeProperties(M);                 // panelin kendi tazelemesi
    expect(modal()).toBe(true);
    expect(icerik().querySelector('.ve-prop-genis')).toBeNull();
  });
});

describe('veFlushOpenPanelData içeriği o bileşenin değilse okumaz', () => {
  test('kaynakta iki kapı: konu kimliği ve kart', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../js/topology.js'), 'utf8');
    const i = src.indexOf('function veFlushOpenPanelData');
    const govde = src.slice(i, src.indexOf('switch(node.type)', i));
    expect(govde).toMatch(/_veLastPropNodeId !== nid\) return/);
    expect(govde).toMatch(/_veMufettisKart\) return/);
  });
});

describe('KONU KENDİ PENCERESİNİN ALTINDA KALMAZ — sütun tuvali sağdan daraltır', () => {
  // Ölçülen eski hâl (AP örneği, 1366×768): sütun açılınca 17 bileşenin 6'sı
  // onun altına düşüyordu; sağdaki tekerleğe çift tık tekerleği kendi
  // penceresinin altına sokuyordu. Ekran kutuları elle (jsdom yerleşim yapmaz):
  // tuval 0–1000 px, sütun açıkken 0–620. Kutu kameranın ötelemesiyle kayar.
  const X0 = 3000;
  const GENIS_KAP = { left: 0, right: 1000, top: 0, bottom: 700 };
  const DAR_KAP = { left: 0, right: 620, top: 0, bottom: 700 };
  function sahne(kutular) {
    const wr = document.createElement('div');
    wr.id = 've-canvas-wrapper';
    document.body.appendChild(wr);
    wr.getBoundingClientRect = () => (document.documentElement.classList.contains('ve-mufettis-acik') ? DAR_KAP : GENIS_KAP);
    Object.keys(kutular).forEach((id) => {
      const [l, w] = kutular[id], el = document.getElementById(id);
      Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => w });
      el.getBoundingClientRect = () => {
        const L = l + (global.canvasOffset.x - X0);
        return { left: L, right: L + w, top: 300, bottom: 360, width: w, height: 60 };
      };
    });
  }
  const kutu = (id) => document.getElementById(id).getBoundingClientRect();
  beforeEach(() => {
    global.canvasOffset = { x: X0, y: X0 };
    global.canvasZoom = 0.8;
    global.updateCanvasTransform = jest.fn();
  });

  test('sağdaki konu: kamera onu görünür alana alacak kadar, yalnız yatayda kayar; ölçek değişmez', () => {
    const [, B] = kur();
    sahne({ B: [800, 120] });                 // 800–920: sütun açılınca 620'nin ötesinde
    ciftTik(B);
    expect(kutu('B').right).toBe(620 - VE_MUFETTIS_KADRAJ_PAY);
    expect(canvasOffset.y).toBe(X0);
    expect(canvasZoom).toBe(0.8);
    expect(updateCanvasTransform).toHaveBeenCalledTimes(1);
  });

  test('daralan tuvalde görünen konu: kamera oynamaz', () => {
    const [A] = kur();
    sahne({ A: [100, 120] });
    ciftTik(A);
    expect(canvasOffset.x).toBe(X0);
    expect(updateCanvasTransform).not.toHaveBeenCalled();
  });

  test('açılıştan önce de görünmeyen konu: kullanıcının kadrajına dokunulmaz', () => {
    const [, B] = kur();
    sahne({ B: [1100, 120] });
    ciftTik(B);
    expect(canvasOffset.x).toBe(X0);
  });

  test('yalnız sütunu AÇAN çağrı kaydırır: açık sütunda geçiş kamerayı oynatmaz', () => {
    const [A, B] = kur();
    sahne({ A: [100, 120], B: [800, 120] });
    ciftTik(A);
    bas(B);
    veTogglePropertiesPanel(true);            // açık sütunda çift tık
    expect(canvasOffset.x).toBe(X0);
  });

  test('dar ekran (modal) ve geniş pencere tipi tuvali daraltmaz — kamera oynamaz', () => {
    let [, B] = kur();
    genisEkran(false);
    sahne({ B: [800, 120] });
    ciftTik(B);
    expect(canvasOffset.x).toBe(X0);
    const n = kur();
    sahne({ M: [800, 120] });
    ciftTik(n[2]);                            // pencere kapalıyken: geniş pencere
    expect(modal()).toBe(true);
    expect(canvasOffset.x).toBe(X0);
  });

  test('görünür alandan geniş kutu: sol kenarı görünür kalır', () => {
    const [, B] = kur();
    sahne({ B: [300, 700] });                 // 300–1000
    ciftTik(B);
    expect(kutu('B').left).toBe(VE_MUFETTIS_KADRAJ_PAY);
  });
});
