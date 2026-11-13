/**
 * sil-geri-al.test.js — BİLEŞEN SİLMEK BİR GERİ-AL ADIMIDIR
 * ─────────────────────────────────────────────────────────────────────────
 * CLAUDE.md: "BİR KULLANICI EYLEMİ = BİR GERİ-AL ADIMI". Bileşen silme yolu (Delete tuşu,
 * pencerenin çöp kutusu, bileşen menüsünün Sil'i, çoklu seçimin düğmesi — hepsi
 * deleteSelectedNodes) yığına adım YAZMIYORDU: Ctrl+Z, yığının tepesindeki silme öncesi
 * kaydı "şimdiki" sayıp bir öncekine dönüyordu — silmeden önceki son düzenleme de
 * gidiyordu (Tulga'da örnek yüklenip menüden Sil → Ctrl+Z: 19 bileşen → 0). Canlı Not 156'nın
 * ajanı ölçtü. Gerçek fare: tests/e2e/bilesen-menusu.spec.js (adlandırma Ctrl+Z'den sonra yerinde).
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../../js/map.js'), 'utf8');
const bas = src.indexOf('function deleteSelectedNodes()');
let i = src.indexOf('{', bas), der = 0, j = i;
for (; j < src.length; j++) { if (src[j] === '{') der++; else if (src[j] === '}' && --der === 0) break; }
const govde = src.slice(bas, j + 1);

describe('SİLME BİR GERİ-AL ADIMI', () => {
  test('silme tek kayıt yazar ve kayıt SİLİNMİŞ hâlin', () => {
    const a = { id: 'a', type: 'mnt-motor' }, b = { id: 'b', type: 'mnt-mount' };
    const G = { nodes: [a, b], connections: [{ id: 'c1', from: 'a', to: 'b' }], selectedNodes: [b] };
    const kayitlar = [];
    const sil = new Function('G', 'componentDefs', 'showToast', 'saveState',
      'var nodes = G.nodes, connections = G.connections, selectedNodes = G.selectedNodes;'
      + 'function veIsTCConnectedToGearbox(){ return false; }'
      + 'function showEmptyProperties(){} function updateAllConnections(){} function updateNodeCount(){}'
      + 'G.oku = function(){ return { n: nodes.map(function(x){ return x.id; }), c: connections.length }; };'
      + govde + '; deleteSelectedNodes();');
    sil(G, {}, jest.fn(), () => kayitlar.push(G.oku()));
    expect(kayitlar).toEqual([{ n: ['a'], c: 0 }]);
  });

  test('silinmez tek bileşende kayıt yazılmaz (bir şey değişmedi)', () => {
    const k = { id: 'k', type: 'fead-belt' };
    const G = { nodes: [k], connections: [], selectedNodes: [k] };
    const kayit = jest.fn();
    const sil = new Function('G', 'componentDefs', 'showToast', 'saveState',
      'var nodes = G.nodes, connections = G.connections, selectedNodes = G.selectedNodes;'
      + 'function veIsTCConnectedToGearbox(){ return false; }'
      + 'function showEmptyProperties(){} function updateAllConnections(){} function updateNodeCount(){}'
      + govde + '; deleteSelectedNodes();');
    sil(G, { 'fead-belt': { noDelete: 'Kayış silinmez.' } }, jest.fn(), kayit);
    expect(kayit).not.toHaveBeenCalled();
  });
});
