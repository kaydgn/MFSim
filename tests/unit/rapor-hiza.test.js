/**
 * Rapor tablosunda sayı SAĞA yaslı — kullanıcı kararı 14·B (2026-09-26)
 * ─────────────────────────────────────────────────────────────────────
 * Ayrıntılı rapordaki 1517 sayı hücresinin 1364'ü ortalıydı, sağa yaslı
 * hiç yoktu: ondalık basamaklar alt alta gelmiyor, sütun okunmuyordu.
 * Kural: tamamı sayı olan sütun, başlığıyla birlikte sağa; ad ve metin
 * sütunu solda; ✓/✗ gibi işaret sütunu ortada. Vites adı ("1C") sayı değil.
 *
 * Aynı turda: `.dr-body table td { color:… !important }` 212 hücrenin anlam
 * rengini eziyordu (kırmızı uyarılar dâhil) — o zorlama da kalktı.
 *
 * Gerçek tarayıcıda raporun TAMAMI: tests/e2e/rapor-hiza.spec.js. Bu dosya
 * en büyük tabloyu (vites geçişleri) ve CSS kuralını hızlı tutar.
 */
const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
global.COMPONENT_SIGNALS = {};
global.componentDefs = {};
global.connections = [];
global.nodes = [];
global.veTabs = [{ id: 't1', name: 'T1', state: { simResults: null, nodes: [], connections: [] } }];
global.veActiveTabIdx = 0;
global.canvasOffset = { x: 0, y: 0 };
global.canvasZoom = 1;
global.compCounter = 0;
global.veProjectName = 'Test';
global.SENSOR_PACKAGES = [];
eval(loadSource('measure-core.js'));
eval(loadSource('signal-tree.js'));
eval(loadSource('trace-view.js'));
eval(loadSource('results.js'));
beforeEach(() => resetStubs(stubs));

const SAYI = /^[-−+]?\d+([.,]\d+)?$/;

function tablo(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.querySelector('table');
}

// Tamamı sayı olan her sütunun hücre ve başlık hizası
function sayiSutunlari(t) {
  const ths = [...t.tHead.rows[0].cells];
  const satirlar = [...t.tBodies[0].rows];
  return ths.map((th, i) => {
    const hucre = satirlar.map((tr) => tr.cells[i]).filter(Boolean);
    const sayi = hucre.length && hucre.every((td) => SAYI.test(td.textContent.trim()));
    return sayi ? { baslik: th.textContent.trim(), th: th.style.textAlign, td: [...new Set(hucre.map((td) => td.style.textAlign))] } : null;
  }).filter(Boolean);
}

describe('vites geçişi tablosu (_ftBuildTable)', () => {
  const adimlar = [
    { gear: '1C', speed: 12.34, engineRPM: 2100.4, outputRPM: 610.2, te: 45.678, dp: 30.1, wheelPower: 180.3, netGrade: 12.34, heatRejection: 55.5, matchPoint: 'Stall' },
    { gear: '2C', speed: 24.5, engineRPM: 1800, outputRPM: 1220.9, te: 25.1, dp: -1.25, wheelPower: 190.1, netGrade: -0.5, heatRejection: 20.25, matchPoint: '' },
  ];
  const t = tablo(_ftBuildTable(adimlar));

  test('sekiz sayı sütunu hücresiyle ve başlığıyla SAĞA yaslı', () => {
    const s = sayiSutunlari(t);
    expect(s.length).toBe(8);
    s.forEach((c) => expect({ [c.baslik]: [c.th, ...c.td] }).toEqual({ [c.baslik]: ['right', 'right'] }));
  });

  test('vites adı ve eşleşme noktası solda — sayı değiller', () => {
    const r = t.tBodies[0].rows[0];
    expect(r.cells[0].textContent).toBe('1C');
    expect(['', 'left']).toContain(r.cells[0].style.textAlign);
    expect(r.cells[9].style.textAlign).toBe('left');
  });
});

describe('rapor hücresinin rengi zorlanmıyor', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  test('`.dr-body table td` rengi !important ile ezmiyor', () => {
    const govde = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => /\.dr-body\s+table\s+td\s*$/.test(m[1].trim()) || m[1].split(',').some((p) => /\.dr-body\s+table\s+td\s*$/.test(p.trim())))
      .map((m) => m[2]).join(';');
    expect(govde).not.toMatch(/(^|;)\s*color\s*:[^;]*!important/);
  });

  test('ayrıntılı raporun hücre üreticilerinde sabit onaltılık renk yok', () => {
    // Zorlama kalkınca sabit renk koyu temada yine görünür olurdu (#333 böyleydi)
    const src = fs.readFileSync(path.join(__dirname, '../../js/results.js'), 'utf8');
    const bas = src.indexOf('function veRenderDetailedReport(');
    const son = src.indexOf('\nfunction ', bas + 10);
    const govde = src.slice(bas, son) + (src.match(/function _ftBuildTable[\s\S]*?\n}\n/) || [''])[0];
    expect(govde.length).toBeGreaterThan(5000);
    expect(govde.match(/<td[^>]*color:#[0-9a-fA-F]{3,6}|'#[0-9a-fA-F]{3,6}'/g) || []).toEqual([]);
  });
});
