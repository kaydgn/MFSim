/**
 * Gruplama Çerçevesi / Yazı Etiketi — KALICILIK
 * ─────────────────────────────────────────────
 * Kullanıcı raporu: "Topolojide Gruplama Çerçevesi açtım, projeyi öyle
 * kaydettim; kayıtlı projeyi açtığımda çerçeve gelmiyor."
 *
 * Tuval açıklamaları türetilmiş veri DEĞİLDİR — kullanıcının elle çizdiği,
 * yeniden üretilemeyen içeriktir. Kaybolduğunda sessiz kaybolur (topoloji
 * yüklenmiş görünür, yalnız çerçeve yoktur), bu yüzden her serileştirme/geri
 * yükleme kapısı burada kilitlenir:
 *
 *   1) restoreState  — düğüm geri yüklemesi patlasa bile çerçeveler geri gelir
 *                      (eskiden annotasyon adımı fonksiyonun EN SONUNDAYDI ve
 *                       tek bozuk düğüm tüm çerçeveleri birlikte götürüyordu)
 *   2) restoreAnnotations — bozuk tek kayıt diğerlerini düşürmez
 *   3) Takoz iç topolojisi dışa/içe aktarımı — annotations alanını taşır
 *      (düşerse "Örneği Aktar" mevcut çerçeveleri sessizce siler)
 *   4) veResetSubtopoNav — proje yüklenince alt-topoloji gezinme yolu sıfırlanır
 *      (sıfırlanmazsa ilk arka-plan kaydı ÖNCEKİ projenin durumunu geri yazar
 *       ve yeni açılan projenin çerçeveleri kaybolur)
 */

const fs = require('fs');
const path = require('path');

const readJs = (f) => fs.readFileSync(path.join(__dirname, '../../js', f), 'utf8');

// ── 1) restoreState: annotasyonlar try/finally ile HER DURUMDA geri yüklenir ──
describe('restoreState — çerçeveler düğüm hatasına kurban gitmez', () => {
  let restoreAnnotationsMock;

  beforeAll(() => {
    global.nodes = [];
    global.connections = [];
    global.undoStack = [];
    global.redoStack = [];
    global.showToast = jest.fn();
    global.componentDefs = {};
    global.updateAllConnections = jest.fn();
    global.updateNodeCount = jest.fn();
    global.clearSelection = jest.fn();
    eval(readJs('state.js'));
    global.restoreState = restoreState;
  });

  beforeEach(() => {
    restoreAnnotationsMock = jest.fn();
    global.restoreAnnotations = restoreAnnotationsMock;
    global.nodes = [];
    global.connections = [];
  });

  test('düğüm geri yüklemesi PATLASA bile çerçeveler geri yüklenir', () => {
    const frames = [{ id: 'annot-1', type: 'frame', x: 10, y: 20, text: 'Grup' }];
    // nodes null → state.nodes.forEach TypeError atar (bozuk/eksik kayıt taklidi)
    const bozuk = { schemaVersion: 2, nodes: null, connections: [], annotations: frames };

    expect(() => global.restoreState(bozuk)).toThrow();      // hata YUTULMAZ
    expect(restoreAnnotationsMock).toHaveBeenCalledTimes(1); // ama çerçeveler kurtulur
    expect(restoreAnnotationsMock.mock.calls[0][0]).toEqual(frames);
  });

  test('annotations alanı yoksa boş dizi ile çağrılır (eski kayıtlar temizlenir)', () => {
    global.restoreState({ schemaVersion: 2, nodes: [], connections: [] });
    expect(restoreAnnotationsMock).toHaveBeenCalledWith([]);
  });
});

// ── 2) restoreAnnotations: kayıt başına dayanıklılık ──
describe('restoreAnnotations — bozuk kayıt diğerlerini düşürmez', () => {
  beforeAll(() => {
    document.body.innerHTML =
      '<div class="ve-canvas" id="ve-canvas"><svg class="ve-connections-layer" id="ve-connections-layer"></svg></div>';
    global.canvasZoom = 1;
    global.clearSelection = jest.fn();
    global.saveState = jest.fn();
    global.showToast = jest.fn();
    eval(readJs('annotations.js'));
    global.restoreAnnotations = restoreAnnotations;
    global.serializeAnnotations = serializeAnnotations;
  });

  beforeEach(() => {
    document.getElementById('ve-canvas').innerHTML =
      '<svg class="ve-connections-layer" id="ve-connections-layer"></svg>';
  });

  test('id\'siz kayıt ATILMAZ — yeni id üretilir, çerçeve geri gelir', () => {
    global.restoreAnnotations([
      { type: 'frame', x: 5, y: 6, text: 'ID YOK' },
      { id: 'annot-7', type: 'frame', x: 1, y: 2, text: 'SAĞLAM' },
    ]);
    const geri = global.serializeAnnotations();
    expect(geri.map((a) => a.text)).toEqual(['ID YOK', 'SAĞLAM']);
    expect(geri[0].id).toMatch(/^annot-\d+$/);
    expect(document.querySelectorAll('.ve-annotation-frame').length).toBe(2);
  });

  test('null / dizi-dışı kayıtlar atlanır, sağlamlar yüklenir', () => {
    global.restoreAnnotations([null, 'çöp', { id: 'annot-1', type: 'frame', x: 0, y: 0, text: 'A' }]);
    expect(global.serializeAnnotations().map((a) => a.text)).toEqual(['A']);
  });

  test('geçersiz koordinat 0\'a düşer, çerçeve yine görünür', () => {
    global.restoreAnnotations([{ id: 'annot-2', type: 'frame', x: 'abc', y: null, text: 'B' }]);
    const a = global.serializeAnnotations()[0];
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    expect(document.querySelectorAll('.ve-annotation-frame').length).toBe(1);
  });

  test('gidiş-dönüş: çerçeve alanları (metin/boyut/renk) birebir korunur', () => {
    const kaynak = [{ id: 'annot-3', type: 'frame', x: 40, y: 50, width: 320, height: 210, text: 'Güç Grubu', color: 'var(--accent-primary)', fontSize: 14 }];
    global.restoreAnnotations(kaynak);
    expect(global.serializeAnnotations()).toEqual(kaynak);
  });
});

// ── 3) Takoz iç topolojisi: dışa aktar → örneği aktar ──
describe('Takoz iç topolojisi — açıklamalar dışa/içe aktarımda korunur', () => {
  let mount;

  beforeAll(() => {
    global.showToast = jest.fn();
    global.veShowSaveDialog = jest.fn();
    global.veFlushOpenPanelData = jest.fn();
    mount = require('../../js/cp-mount.js');
  });

  const frames = [{ id: 'annot-1', type: 'frame', x: 12, y: 34, width: 250, height: 150, text: 'TAKOZ GRUBU', color: 'var(--text-muted)', fontSize: 11 }];

  test('_mntTopoState annotations alanını taşır', () => {
    const out = mount._mntTopoState({
      nodes: [{ id: 'comp-1', type: 'mnt-motor' }],
      connections: [],
      annotations: frames,
    });
    expect(out.annotations).toEqual(frames);
  });

  test('_mntTopoState: kaynakta yoksa boş dizi (undefined DEĞİL)', () => {
    const out = mount._mntTopoState({ nodes: [{ id: 'comp-1', type: 'mnt-motor' }] });
    expect(out.annotations).toEqual([]);
  });

  test('_mntTopoState tam proje kaydından da açıklamaları alır', () => {
    const out = mount._mntTopoState({
      activeTabIdx: 0,
      tabs: [{ state: { nodes: [{ id: 'comp-1', type: 'mnt-motor' }], connections: [], annotations: frames } }],
    });
    expect(out.annotations).toEqual(frames);
  });

  test('veMntExportTopology çıktısı annotations içerir', () => {
    global.veSerializeCurrentState = () => ({
      nodes: [{ id: 'comp-1', type: 'mnt-motor' }],
      connections: [],
      compCounter: 1,
      canvasOffset: { x: 3000, y: 3000 },
      canvasZoom: 1,
      annotations: frames,
    });
    const json = JSON.parse(mount.veMntExportTopology());
    expect(json.annotations).toEqual(frames);
  });

  test('dışa aktar → içe aktar gidiş-dönüşünde çerçeve hayatta kalır', () => {
    global.veSerializeCurrentState = () => ({
      nodes: [{ id: 'comp-1', type: 'mnt-motor' }],
      connections: [],
      compCounter: 1,
      canvasOffset: { x: 3000, y: 3000 },
      canvasZoom: 1,
      annotations: frames,
    });
    const disk = JSON.parse(mount.veMntExportTopology());
    expect(mount._mntTopoState(disk).annotations).toEqual(frames);
  });
});

// ── 4) Proje yüklenince alt-topoloji gezinme yolu sıfırlanır ──
describe('veResetSubtopoNav — proje yüklemesi eski gezinme yolunu taşımaz', () => {
  beforeAll(() => {
    // topology.js'in açılış IIFE'si ilk sekmeyi kurmasın (DOM/başka modül ister)
    window._veTabInitDone = true;
    document.body.innerHTML = '<div id="ve-split-container"></div><div class="ve-canvas" id="ve-canvas"></div>';
    global.nodes = [];
    global.connections = [];
    global.selectedNodes = [];
    global.compCounter = 0;
    global.canvasOffset = { x: 3000, y: 3000 };
    global.canvasZoom = 1;
    global.undoStack = [];
    global.redoStack = [];
    global.veResultSlots = [{}, {}, {}, {}];
    global.showToast = jest.fn();
    global.updateCanvasTransform = jest.fn();
    global.updateAllConnections = jest.fn();
    global.updateNodeCount = jest.fn();
    global.showEmptyProperties = jest.fn();
    eval(readJs('topology.js'));
    global.veResetSubtopoNav = veResetSubtopoNav;
  });

  test('her iki alt-sistem stack\'ini de boşaltır (dizi kimliği korunur)', () => {
    global.veAracStack = [{ nodeId: 'comp-1', parentState: { nodes: [] } }];
    global.veMntStack = [{ nodeId: 'comp-2', parentState: { nodes: [] } }];
    const aracRef = global.veAracStack;

    global.veResetSubtopoNav();

    expect(global.veAracStack.length).toBe(0);
    expect(global.veMntStack.length).toBe(0);
    expect(global.veAracStack).toBe(aracRef); // referansı koparmaz (modüller aynı diziyi tutar)
  });

  test('stack tanımsızken de patlamaz (modül yüklenmemiş olabilir)', () => {
    delete global.veAracStack;
    delete global.veMntStack;
    expect(() => global.veResetSubtopoNav()).not.toThrow();
  });

  test('proje yükleme yolları veResetSubtopoNav\'ı çağırır', () => {
    // Kancanın gerçekten bağlı olduğunu (yalnız fonksiyonun var olduğunu değil)
    // doğrula: her iki proje-yükleme girişi de sıfırlamayı tetiklemeli.
    expect(readJs('toolbar.js')).toContain('veResetSubtopoNav');
    expect(readJs('settings.js')).toContain('veResetSubtopoNav');
  });
});
