/**
 * Gruplama çerçevesi İÇERİĞİYLE taşınır — js/annotations.js + js/ui-core.js
 * ──────────────────────────────────────────────────────────────────────
 * Kullanıcı 2026-11-11, Canlı Not 130: *"Bileşenleri böyle tutup hareket
 * ettirdiğim zaman hareket ediyorlar fakat kurduğum çerçeve hareket etmiyor.
 * Düzeltelim."* Seçim kutusu çerçeveyi de seçiyordu ama bileşen sürüklemesi
 * yalnız seçili bileşenleri taşıyordu; çerçeve sürüklemesi de yalnız çerçeveyi.
 *
 * Kural: bileşenler sürüklenince seçili açıklamalar ve içeriğinin TAMAMI
 * sürüklenen çerçeveler onlarla gider; çerçeve sürüklenince içeriği (kutusu
 * içinde kalan bileşenler ve yazılar) onunla gider. Tek bileşeni çerçeveden
 * çıkarmak çerçeveyi oynatmaz. Gerçek fare: tests/e2e/annotations.spec.js →
 * *İÇERİĞİYLE TAŞINIR*.
 */
const fs = require('fs');
const path = require('path');

global.veIkon = () => '';
global.escapeHTML = (s) => String(s);
eval(fs.readFileSync(path.join(__dirname, '../../js/annotations.js'), 'utf8')
  .replace(/^var annotations = \[\];/m, 'global.annotations = [];')
  .replace(/^var selectedAnnotations = \[\];/m, 'global.selectedAnnotations = [];')
  + '\nglobal.veCerceveIcerigi = veCerceveIcerigi; global.veCerceveTasinan = veCerceveTasinan;'
  + '\nglobal.veDugumleTasinanAcik = veDugumleTasinanAcik; global.veAcikKaydir = veAcikKaydir;');

const dugum = (id, x, y) => ({ id, x, y, width: 60, height: 50 });
let A, B, C, F, G, T;
beforeEach(() => {
  A = dugum('a', 110, 110); B = dugum('b', 200, 110); C = dugum('c', 500, 110);
  global.nodes = [A, B, C];
  F = { id: 'f', type: 'frame', x: 100, y: 100, width: 200, height: 100 };   // A ve B içinde
  G = { id: 'g', type: 'frame', x: 480, y: 90, width: 120, height: 100 };    // C içinde
  T = { id: 't', type: 'text', x: 120, y: 170, width: 40, height: 20 };      // F'nin içinde yazı
  global.annotations.length = 0; global.annotations.push(F, G, T);
  global.selectedAnnotations.length = 0;
});

describe('İÇERİK — kutusu çerçevenin içinde kalanlar', () => {
  test('F: A, B ve yazı; G: C; kısmen taşan içerik sayılmaz', () => {
    expect(veCerceveIcerigi(F).dugum).toEqual([A, B]);
    expect(veCerceveIcerigi(F).acik).toEqual([T]);
    expect(veCerceveIcerigi(G).dugum).toEqual([C]);
    B.x = 280;                                                         // sağ kenar 340 > 300
    expect(veCerceveIcerigi(F).dugum).toEqual([A]);
  });
});

describe('BİLEŞENLERLE — sürüklenen bileşenlerle giden açıklamalar', () => {
  test('içeriğin TAMAMI sürükleniyorsa çerçeve (ve içindeki yazı) gider', () => {
    expect(veDugumleTasinanAcik([A, B])).toEqual([F, T]);
    expect(veDugumleTasinanAcik([A, B, C])).toEqual([F, G, T]);
  });
  test('tek bileşeni çerçeveden çıkarmak çerçeveyi oynatmaz', () => {
    expect(veDugumleTasinanAcik([A])).toEqual([]);
  });
  test('seçim kutusuyla seçilmiş çerçeve her durumda gider', () => {
    global.selectedAnnotations.push(G);
    expect(veDugumleTasinanAcik([A])).toEqual([G]);
  });
});

describe('ÇERÇEVEYLE — sürüklenen çerçevenin içeriği', () => {
  test('çerçeve sürüklenince içindeki bileşenler ve yazılar gider, kendisi listede yok', () => {
    expect(veCerceveTasinan([F])).toEqual({ dugum: [A, B], acik: [T] });
    expect(veCerceveTasinan([F, G]).dugum).toEqual([A, B, C]);
    expect(veCerceveTasinan([T]).dugum).toEqual([]);                  // yazı çerçeve değil
  });
  test('kaydırma modelde yazılır', () => {
    veAcikKaydir([F, T], 30, -20);
    expect([F.x, F.y, T.x, T.y]).toEqual([130, 80, 150, 150]);
  });
});
