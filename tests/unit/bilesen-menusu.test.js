/**
 * bilesen-menusu.test.js — BİLEŞEN MENÜSÜ (sağ tık)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı 2026-11-11, Canlı Not 143: "Bileşenlere sağ tık olayını getirelim. Sağ tıklayınca
 * işte silme, yeniden boyutlandırma falan filan neler olabilirse olsun. Güzel kullanışlı olsun."
 * Önce sağ tık yalnız port düzenini açıyordu (4 satır). Şimdi: Aç · Yeniden adlandır · Çoğalt ·
 * Kopyala · Boyut · Ad · port düzeni (portlu bileşende) · Sil; işlemler seçimin tamamına,
 * kısayollarla aynı işlevden. Gerçek sağ tık: tests/e2e/bilesen-menusu.spec.js.
 */
const stubs = stubGlobals();
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
global.veNodeDefaultSize = veNodeDefaultSize;
global.selectedNodes = [];
global.clearSelection = jest.fn(() => { global.selectedNodes.length = 0; });
global.addToSelection = jest.fn((n) => { if (global.selectedNodes.indexOf(n) < 0) global.selectedNodes.push(n); });
global.deleteSelectedNodes = jest.fn();
global.veSeciliCogalt = jest.fn(() => true);
global.veSeciliKopyala = jest.fn(() => true);
global.veTogglePropertiesPanel = jest.fn();
global.showNodeProperties = jest.fn();
global.veTekTikEylem = jest.fn(() => false);
global.updateAllConnections = jest.fn();
global.veUpdateBoundary = jest.fn();
global.updateNodeHandles = jest.fn();
const CM = require('../../js/context-menus.js');

const dugum = (type, ek) => Object.assign({ id: 'n' + Math.random().toString(36).slice(2, 7), type, x: 0, y: 0,
  def: componentDefs[type], data: {} }, ek || {});
const dom = (node, portlu) => {
  const el = document.createElement('div'); el.id = node.id;
  el.innerHTML = '<div class="ve-node-box"></div><div class="ve-node-label">' + (node.customName || node.def.name) + '</div>'
    + (portlu ? '<div class="ve-node-port" data-port="input"></div>' : '');
  document.body.appendChild(el);
  return el;
};
const menu = (node, secim) => { const d = document.createElement('div'); d.innerHTML = CM.veBilesenMenuHTML(node, secim); return d; };
const adlar = (d) => [...d.querySelectorAll('.ve-context-item')].map((o) => o.querySelector('.ve-context-ad').textContent);

beforeEach(() => {
  resetStubs(stubs);
  document.body.innerHTML = '';
  global.selectedNodes.length = 0;
  [global.deleteSelectedNodes, global.veSeciliCogalt, global.veSeciliKopyala, global.veTogglePropertiesPanel,
    global.showNodeProperties, global.updateAllConnections].forEach((f) => f.mockClear());
});

describe('BİLEŞEN MENÜSÜ (Canlı Not 143)', () => {
  test('tek bileşen: Aç · Yeniden adlandır · Çoğalt · Kopyala · Sil; Boyut ve Ad bölmeli, şimdiki basılı', () => {
    const d = { ...veNodeDefaultSize('mnt-motor') };
    const n = dugum('mnt-motor', { width: d.w, height: d.h });
    dom(n, false);
    const m = menu(n, [n]);
    expect(adlar(m)).toEqual(['Aç', 'Yeniden adlandır', 'Çoğalt', 'Kopyala', 'Sil']);
    const seg = (ad) => [...m.querySelectorAll('.ve-context-seg[aria-label="' + ad + '"] button')].map((b) => [b.textContent, b.getAttribute('aria-checked')]);
    expect(seg('Boyut')).toEqual([['Küçük', 'false'], ['Varsayılan', 'true'], ['Büyük', 'false']]);
    expect(seg('Ad')).toEqual([['Üst', 'false'], ['Alt', 'true'], ['Sol', 'false'], ['Sağ', 'false']]);
    // kısayollar kısayol listesiyle aynı
    expect([...m.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['Çift tık', 'Ctrl+D', 'Ctrl+C', 'Delete']);
    expect(m.querySelector('[data-action="sil"]').getAttribute('aria-disabled')).toBeNull();
  });

  test('portlu bileşende port düzeni de var; portsuzda yok', () => {
    const n = dugum('engine'); dom(n, true);
    expect(adlar(menu(n, [n]))).toEqual(['Aç', 'Yeniden adlandır', 'Çoğalt', 'Kopyala',
      'Portları dikeye çevir', 'Yatay aynala', 'Dikey aynala', 'Portları varsayılana döndür', 'Sil']);
    const m = dugum('mnt-motor'); dom(m, false);
    expect(adlar(menu(m, [m]))).not.toContain('Yatay aynala');
  });

  test('silinmez tipte Sil kapalı, sebebi ipucunda; tıklanınca bir şey olmaz', () => {
    const w = dugum('fead-wizard'); dom(w, false);
    const s = menu(w, [w]).querySelector('[data-action="sil"]');
    expect(s.getAttribute('aria-disabled')).toBe('true');
    expect(s.getAttribute('title')).toBe(componentDefs['fead-wizard'].noDelete);
    CM.showNodeContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 10, clientY: 10 }, w);
    document.querySelector('#ve-node-context-menu [data-action="sil"]').click();
    expect(global.deleteSelectedNodes).not.toHaveBeenCalled();
  });

  test('çoklu seçim: başlık sayıyı söyler, Aç ve adlandırma yok; Boyut seçimin tamamına', () => {
    const a = dugum('mnt-motor'), b = dugum('mnt-gearbox');
    dom(a); dom(b);
    global.selectedNodes.push(a, b);
    const m = menu(a, [a, b]);
    expect(m.querySelector('.ve-context-bas').textContent).toBe('2 bileşen');
    expect(adlar(m)).toEqual(['Çoğalt', 'Kopyala', '2 bileşeni sil']);
    CM.veBilesenMenuEylem('boyut:buyuk', a);
    [a, b].forEach((x) => {
      const d = veNodeDefaultSize(x.type);
      expect([x.width, x.height]).toEqual([Math.round(d.w * 1.5), Math.round(d.h * 1.5)]);
      expect(CM.veBilesenBoyutu(x)).toBe('buyuk');
      expect(document.getElementById(x.id).querySelector('.ve-node-box').style.width).toBe(x.width + 'px');
    });
    expect(stubs.saveState).toHaveBeenCalledTimes(1);                                  // tek geri-al adımı
    expect(global.updateAllConnections).toHaveBeenCalled();
    CM.veBilesenMenuEylem('boyut:varsayilan', a);
    expect(CM.veBilesenBoyutu(a)).toBe('varsayilan');
  });

  test('Ad konumu: üst yazılır, alt varsayılana döner (alan silinir); seçimin tamamına', () => {
    const a = dugum('mnt-motor'), b = dugum('mnt-gearbox');
    dom(a); dom(b);
    global.selectedNodes.push(a, b);
    CM.veBilesenMenuEylem('ad:top', a);
    expect([a.data.labelPos, b.data.labelPos]).toEqual(['top', 'top']);
    expect(document.getElementById(a.id).querySelector('.ve-node-label').classList.contains('lbl-top')).toBe(true);
    CM.veBilesenMenuEylem('ad:bottom', b);
    expect(['labelPos' in a.data, 'labelPos' in b.data]).toEqual([false, false]);
  });

  test('Çoğalt · Kopyala · Sil kısayolların işlevinden; Aç pencereyi açar', () => {
    const n = dugum('mnt-motor'); dom(n);
    global.selectedNodes.push(n);
    CM.veBilesenMenuEylem('cogalt', n); CM.veBilesenMenuEylem('kopyala', n); CM.veBilesenMenuEylem('sil', n);
    expect([global.veSeciliCogalt.mock.calls.length, global.veSeciliKopyala.mock.calls.length, global.deleteSelectedNodes.mock.calls.length]).toEqual([1, 1, 1]);
    CM.veBilesenMenuEylem('ac', n);
    expect(global.veTogglePropertiesPanel).toHaveBeenCalledWith(true);
    expect(global.showNodeProperties).toHaveBeenCalledWith(n);
  });

  test('sağ tık seçili olmayan bileşeni seçer; seçimin içindekinde seçim korunur', () => {
    const a = dugum('mnt-motor'), b = dugum('mnt-gearbox'), c = dugum('mnt-transfer');
    dom(a); dom(b); dom(c);
    global.selectedNodes.push(a, b);
    const e = { preventDefault() {}, stopPropagation() {}, clientX: 5, clientY: 5 };
    CM.showNodeContextMenu(e, b);
    expect(global.selectedNodes).toEqual([a, b]);
    CM.showNodeContextMenu(e, c);
    expect(global.selectedNodes).toEqual([c]);
    expect(document.getElementById('ve-node-context-menu').getAttribute('role')).toBe('menu');
  });

  test('YENİDEN ADLANDIR tuvalde: Enter uygular (tek geri-al), Esc vazgeçer, boş ad tipin adına döner', () => {
    const n = dugum('mnt-motor', { customName: 'Motor' }); const el = dom(n);
    const lbl = el.querySelector('.ve-node-label');
    expect(CM.veBilesenAdDuzenle(n)).toBe(true);
    const inp = lbl.querySelector('input');
    expect(inp.value).toBe('Motor');
    inp.value = 'Ön motor';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect([n.customName, lbl.textContent]).toEqual(['Ön motor', 'Ön motor']);
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
    CM.veBilesenAdDuzenle(n);
    lbl.querySelector('input').value = 'Başka';
    lbl.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(n.customName).toBe('Ön motor');
    CM.veBilesenAdDuzenle(n);
    lbl.querySelector('input').value = '  ';
    lbl.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(n.customName).toBe(componentDefs['mnt-motor'].name);
  });
});
