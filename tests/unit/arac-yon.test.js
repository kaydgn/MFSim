/**
 * arac-yon.test.js — YÖNLENDİRME, Araç Performans (E2, 2026-10-19)
 * ───────────────────────────────────────────────────────────────────────
 * Biçimi metin-dili.test.js ölçüyor (yön profili). Burada iki şey:
 *   · GİZLİ ETKİLEŞİMİN CÜMLESİ GERÇEK ETKİLEŞİMİ SÖYLER. Araştırmanın önerisi
 *     "Rakım profilinde sağ tıklayarak ekleyin." idi; koda bakınca referans
 *     noktası haritadaki ROTAYA tıklanınca ekleniyor, rakım grafiğinde sağ tık
 *     kaydırıyor. Etkileşim değişirse cümle eskir — kapı ikisini birlikte tutar.
 *   · KAPALI SEÇİCİNİN SEBEBİ: şanzıman ve konvertör seçicileri Eşleştirme
 *     varken kilitli ve sebep yanında yazılı; seçici o yazıya aria-describedby
 *     ile bağlı (ipucuna kopyalamak tekrar olurdu).
 */
const fs = require('fs');
const path = require('path');
const T = require('../../tools/metin-dili.js');

const oku = (f) => fs.readFileSync(path.join(__dirname, '../../js', f), 'utf8');
const yonlar = (f) => T.metinler('js/' + f).filter((x) => x.baglam === 'yon').map((x) => x.metin);
function govde(src, bas) {
  const i = src.indexOf(bas);
  expect(i).toBeGreaterThan(-1);
  return src.slice(i, src.indexOf('\n}', i));
}

describe('gizli etkileşimin cümlesi gerçek etkileşimi söyler', () => {
  const MAP = oku('map.js');

  test('referans noktası: haritada ROTAYA tıklanır — eklemenin tek çağıranı rota çizgisinin tıklaması', () => {
    expect(yonlar('map.js')).toContain('Güzergah Haritası’nda rotaya tıklayarak ekleyin.');
    const cagri = [...MAP.matchAll(/veAddRouteWaypoint\(/g)].length;
    expect(cagri).toBe(2);                                      // tanım + tek çağrı
    expect(govde(MAP, 'function _veAttachRouteClickForWaypoint')).toMatch(/line\.on\('click'[\s\S]*veAddRouteWaypoint\(/);
    // Rakım grafiğinde sağ tık eklemez, kaydırır (results.js'in grafik dinleyicisi)
    expect(oku('results.js')).toMatch(/function _drChartMouseDown\(e\) \{\s*if\(e\.button !== 2\) return;/);
  });

  test('eğim çizgisi: rakım profilinde iki tıkla çizilir (ilk tık başlatır, ikinci kaydeder)', () => {
    expect(yonlar('map.js')).toContain('Rakım profilinde iki noktaya tıklayarak çizin.');
    const g = govde(MAP, 'function _veAltAttachDrawEvents');
    expect(g).toMatch(/if\(e\.button !== 0\) return;/);
    expect(g).toMatch(/if\(!canvas\._altDrawState\)[\s\S]*veAltAddGradeLine\(/);
  });

  test('güzergah noktası: haritaya tıklanır', () => {
    expect(yonlar('map.js')).toContain('Haritaya tıklayarak nokta ekleyin.');
    expect(MAP).toMatch(/map\.on\('click', function\(e\) \{[\s\S]{0,2500}veRoadMarkers\[nodeId\]\.push\(marker\)/);
  });

  test('sensör: portundan bir bağlantının orta noktasına bağlanır', () => {
    expect(yonlar('component-extras.js')).toContain('Sensör portunu bir bağlantının orta noktasına bağlayın.');
    expect(oku('connections.js')).toMatch(/midpoint\.addEventListener\('mousedown'[\s\S]*connectingFrom\.node\.type === 'sensor'[\s\S]*veAttachSensorToConnection\(/);
  });
});

describe('kapalı seçicinin sebebi yanındaki yazıya bağlı', () => {
  const stubs = stubGlobals();
  global.veActiveModule = 'full-throttle';
  global.COMPONENT_SIGNALS = {};
  global.window = global.window || {};
  eval(loadSource('numerics.js'));
  eval(loadSource('cp-engine.js'));
  eval(loadSource('cp-gearbox.js'));
  eval(loadSource('cp-torque-converter.js'));
  beforeEach(() => resetStubs(stubs));

  const bagli = (html, secici) => {
    document.body.innerHTML = html;
    const s = document.querySelector(secici);
    expect(s).not.toBeNull();
    expect(s.disabled).toBe(true);
    const h = document.getElementById(s.getAttribute('aria-describedby') || '');
    expect(h).not.toBeNull();
    return h.textContent.trim();
  };

  test('şanzıman: Motor-Şanzıman Eşleştirme varken', () => {
    const gb = { id: 'gb1', type: 'gearbox', data: {} };
    global.nodes = [gb, { id: 'egm1', type: 'engine-gearbox-matching', data: {} }];
    global.connections = [];
    expect(bagli(getGearboxPropertiesHTML(gb), '#ve-ft-gb-preset-gb1')).toMatch(/Eşleştirme'den seçili\.$/);
  });

  test('konvertör: Motor-Konvertör Eşleştirme varken', () => {
    const tc = { id: 'tc1', type: 'torque-converter', data: {} };
    global.nodes = [tc, { id: 'ecm1', type: 'ec-matching', data: {} }];
    global.connections = [];
    expect(bagli(getTorqueConverterPropertiesHTML(tc), '#ve-tc-select-tc1')).toMatch(/Eşleştirme'den seçili\.$/);
  });

  test('eşleştirme yokken seçici açık ve bağsız', () => {
    const tc = { id: 'tc2', type: 'torque-converter', data: {} };
    global.nodes = [tc];
    document.body.innerHTML = getTorqueConverterPropertiesHTML(tc);
    const s = document.querySelector('#ve-tc-select-tc2');
    expect(s.disabled).toBe(false);
    expect(s.hasAttribute('aria-describedby')).toBe(false);
  });
});
