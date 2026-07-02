/**
 * cp-mount.test.js — Takoz Çökme-Titreşim bileşeni
 * Yardımcı/analiz bileşeni: kayıt (componentDefs + components dizisi), pencere
 * (getMountAnalysisPropertiesHTML) render'ı ve girdi persist handler'ı
 * (onVEMountAnalysisChange) test edilir. Matematiksel model henüz yok — yalnızca
 * bileşen + pencere kapsanır.
 */

// Minimal DOM (components.js sonundaki IIFE querySelector çağırır)
document.body.innerHTML = '<div class="ve-main"></div><div id="ve-module-overlay" style="display:none;"></div>';

// Global state / stub'lar
global.nodes = [];
global.selectedNodes = [];
global.veActiveModule = 'full-throttle';
global.showToast = jest.fn();
global.saveState = jest.fn();

const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../../js/cp-mount.js'), 'utf8'));

describe('Takoz Çökme-Titreşim — bileşen kaydı', () => {
  test('componentDefs girişi tanımlı ve doğru', () => {
    const def = componentDefs['mount-analysis'];
    expect(def).toBeDefined();
    expect(def.name).toBe('Takoz Çökme-Titreşim');
    expect(def.inputs).toBe(0);   // güç aktarma zincirine girmez
    expect(def.outputs).toBe(0);
    expect(def.maxInstances).toBe(1);
    expect(typeof def.svg).toBe('string');
    expect(def.svg.startsWith('<svg')).toBe(true);
  });

  test('components dizisinde mevcut', () => {
    expect(VE_MODULES['full-throttle'].components).toContain('mount-analysis');
  });
});

describe('Takoz Çökme-Titreşim — pencere (panel) render', () => {
  test('getMountAnalysisPropertiesHTML string döndürür ve bölümleri içerir', () => {
    const node = { id: 'comp-5', type: 'mount-analysis', def: componentDefs['mount-analysis'], data: {} };
    const html = getMountAnalysisPropertiesHTML(node);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(500);
    // Bölüm başlıkları
    expect(html).toContain('Motor-Şanzıman Grubu');
    expect(html).toContain('Takoz Düzeni & Rijitlik');
    expect(html).toContain('Uyarım');
    expect(html).toContain('Sonuçlar');
    // Hesapla butonu (stub)
    expect(html).toContain("veMountAnalysisCompute('comp-5')");
  });

  test('input id ve onchange TAM node id kullanır (tire içeren id bug regresyonu)', () => {
    const node = { id: 'comp-12', type: 'mount-analysis', def: componentDefs['mount-analysis'], data: {} };
    const html = getMountAnalysisPropertiesHTML(node);
    // Tam id: ...-comp-12
    expect(html).toContain('id="ve-mount-group-mass-comp-12"');
    // onchange tam node id ile çağrılmalı — kısaltılmış '12' DEĞİL
    expect(html).toContain("onVEMountAnalysisChange('comp-12')");
    expect(html).not.toContain("onVEMountAnalysisChange('12')");
  });

  test('mevcut node.data değerleri input value olarak yansır', () => {
    const node = { id: 'comp-7', type: 'mount-analysis', def: componentDefs['mount-analysis'], data: { groupMass: 650, strokeType: '2' } };
    const html = getMountAnalysisPropertiesHTML(node);
    expect(html).toContain('value="650"');
    // strokeType '2' seçili olmalı
    expect(html).toMatch(/<option value="2"\s+selected>/);
  });
});

describe('Takoz Çökme-Titreşim — girdi persist (onVEMountAnalysisChange)', () => {
  beforeEach(() => {
    global.nodes.length = 0;
    saveState.mockClear();
  });

  test('input değerleri node.data\'ya yazılır; boş → undefined', () => {
    const node = { id: 'comp-3', type: 'mount-analysis', data: {} };
    global.nodes.push(node);
    // Paneli DOM'a bas
    document.querySelector('.ve-main').innerHTML =
      '<div class="ve-properties-content">' + getMountAnalysisPropertiesHTML(node) + '</div>';

    document.getElementById('ve-mount-group-mass-comp-3').value = '720';
    document.getElementById('ve-mount-count-comp-3').value = '4';
    document.getElementById('ve-mount-count-comp-3').value = '';   // boş bırak
    document.getElementById('ve-mount-k-static-comp-3').value = '250';
    document.getElementById('ve-mount-stroke-comp-3').value = '2';

    onVEMountAnalysisChange('comp-3');

    expect(node.data.groupMass).toBe(720);
    expect(node.data.mountCount).toBeUndefined();  // boş → undefined
    expect(node.data.kStatic).toBe(250);
    expect(node.data.strokeType).toBe('2');
    expect(saveState).toHaveBeenCalled();
  });

  test('bilinmeyen nodeId sessizce döner (crash yok)', () => {
    expect(() => onVEMountAnalysisChange('yok-boyle-id')).not.toThrow();
  });
});

describe('Takoz Çökme-Titreşim — hesaplama stub', () => {
  test('veMountAnalysisCompute kullanıcıyı bilgilendirir (model henüz yok)', () => {
    showToast.mockClear();
    veMountAnalysisCompute('comp-1');
    expect(showToast).toHaveBeenCalled();
  });
});
