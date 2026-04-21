/**
 * cp-torque-converter.js / cp-gearbox.js — preset seçimi
 * Panel DOM'u açık olmasa bile (nameEl yok) node.data.tcName / gbName
 * güncellenmelidir. Aksi halde Topoloji Raporu'nda eski isim takılı kalır.
 */

// Minimal DOM
document.body.innerHTML = '<div id="ve-canvas"></div>';

// Global state
global.nodes = [];
global.selectedNodes = [];
global.veActiveModule = 'full-throttle';

// Stub'lar
global.showToast = jest.fn();
global.updateVETCCharts = jest.fn();
global.addVETCRow = jest.fn();
global.saveVEFTGearData = jest.fn();
global.getVETCRowHTML = () => '<tr></tr>';
global.getVEFTGearRowHTML = () => '<tr></tr>';
global.showNodeProperties = jest.fn();
global.veRefreshTCDropdownForFamily = jest.fn();

const fs = require('fs');
const path = require('path');
const tcCode = fs.readFileSync(path.join(__dirname, '../../js/cp-torque-converter.js'), 'utf8');
const gbCode = fs.readFileSync(path.join(__dirname, '../../js/cp-gearbox.js'), 'utf8');
eval(tcCode);
eval(gbCode);

describe('Konvertör preset seçimi → node.data.tcName güncellemesi', () => {
  beforeEach(() => {
    global.nodes.length = 0;
    showToast.mockClear();
  });

  test('Panel DOM elemanı olmadan da tcName güncellenir', () => {
    const node = { id: 'tc-1', type: 'torque-converter', data: {} };
    global.nodes.push(node);

    // Panelde input yok — eski hatada tcName hiç yazılmıyordu
    expect(document.getElementById('ve-tc-name-tc-1')).toBeNull();

    onVEFTTCSelect('tc-1', 'tc421');
    expect(node.data.tcPresetKey).toBe('tc421');
    expect(node.data.tcName).toBe('TC-421');
    expect(node.data.pumpTorqueDrop).toBeGreaterThan(0);
    expect(Array.isArray(node.data.tcData)).toBe(true);
    expect(node.data.tcData.length).toBeGreaterThan(0);
  });

  test('Farklı bir konvertöre geçince tcName yeni isme güncellenir', () => {
    const node = { id: 'tc-2', type: 'torque-converter', data: {} };
    global.nodes.push(node);

    onVEFTTCSelect('tc-2', 'tc421');
    expect(node.data.tcName).toBe('TC-421');

    onVEFTTCSelect('tc-2', 'tc411');
    expect(node.data.tcPresetKey).toBe('tc411');
    expect(node.data.tcName).toBe('TC-411');
    // Veri de karakteristiğe uygun değişmeli (stall τ farklı)
    expect(node.data.tcData[0].tau).toBeCloseTo(2.71, 2);
  });

  test('Manuel seçimde tcName temizlenir', () => {
    const node = { id: 'tc-3', type: 'torque-converter', data: { tcName: 'TC-421' } };
    global.nodes.push(node);

    onVEFTTCSelect('tc-3', 'manual');
    expect(node.data.tcName).toBe('');
    expect(node.data.pumpTorqueDrop).toBe(0);
    expect(node.data.tcData).toEqual([]);
  });
});

describe('Şanzıman preset seçimi → node.data.gbName güncellemesi', () => {
  beforeEach(() => {
    global.nodes.length = 0;
  });

  test('Panel DOM elemanı olmadan da gbName güncellenir', () => {
    const node = { id: 'gb-1', type: 'gearbox', data: {} };
    global.nodes.push(node);

    expect(document.getElementById('ve-gb-name-gb-1')).toBeNull();

    const firstKey = Object.keys(VE_GEARBOX_PRESETS)[0];
    onVEFTGBPresetSelect('gb-1', firstKey);

    expect(node.data.ftGBPreset).toBe(firstKey);
    expect(node.data.gbName).toBe(VE_GEARBOX_PRESETS[firstKey].name);
    expect(node.data.forwardGears).toBeGreaterThan(0);
  });
});
