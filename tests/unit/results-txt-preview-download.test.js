/**
 * results-txt-preview-download.test.js
 * ─────────────────────────────────────
 * TXT önizlemesindeki "HTML İndir" düğmesi, EKRANDAKİ TXT'yi indirir.
 *
 * Neden test edilmeye değer: js/results.js'te aynı adla İKİ üst-seviye
 * `veDownloadReportHTML` bildirimi vardı (satır ~2302 ve ~3467). İkincisi
 * birincisini eziyordu, dolayısıyla dört TXT önizleme panelindeki "HTML İndir"
 * düğmesi TXT'yi değil TASARIMLI raporu üretmeye çalışıyordu: kullanıcı ya
 * "Rapor verisi bulunamadı" uyarısı alıyor ya da baktığından başka bir belge
 * indiriyordu. 1229 üst-seviye fonksiyon içinde kimse fark etmemişti ve
 * tests/ altında bu adı geçiren tek bir satır yoktu.
 *
 * Ad çakışmasının kendisine karşı yapısal kapı: tests/unit/source-hygiene.test.js
 * Bu dosya ise DAVRANIŞI bağlar: indirilen belgenin içinde ekrandaki TXT var mı,
 * ve iki üretici gerçekten AYRI mı.
 */
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

// results.js kendi showToast'ını tanımlar; eval'lenmiş kod kendi kapsamındaki
// bağı görür, bu yüzden çıplak isme atanır (bkz. mount-results-tab.test.js).
let toasts = [];
showToast = jest.fn((msg, type) => toasts.push({ msg, type }));

// İndirme yolu: Blob → URL.createObjectURL → <a download>.click()
// jsdom'un Blob'unda .text() yok; içeriği okuyabilmek için parçaları saklayan
// küçük bir Blob yerine geçeni konur.
let capturedBlob = null;
let capturedName = null;
beforeEach(() => {
  toasts = [];
  capturedBlob = null;
  capturedName = null;
  global.Blob = function (parts, opts) {
    this.parts = parts;
    this.type = (opts && opts.type) || '';
    this.text = function () { return Promise.resolve(parts.join('')); };
  };
  global.URL.createObjectURL = jest.fn(b => { capturedBlob = b; return 'blob:test'; });
  global.URL.revokeObjectURL = jest.fn();
  const realCreate = document.createElement.bind(document);
  jest.spyOn(document, 'createElement').mockImplementation(tag => {
    const el = realCreate(tag);
    if (tag === 'a') {
      el.click = () => { capturedName = el.download; };
    }
    return el;
  });
  delete window._veTxtPreviewContent;
  delete window._veTxtPreviewFilename;
});
afterEach(() => { jest.restoreAllMocks(); });

describe('veDownloadTXTPreviewAsHTML — ekrandaki TXT’yi indirir', () => {
  test('iki üretici AYRI fonksiyondur (ad çakışması geri gelmemiş)', () => {
    expect(typeof veDownloadTXTPreviewAsHTML).toBe('function');
    expect(typeof veDownloadReportHTML).toBe('function');
    expect(veDownloadTXTPreviewAsHTML).not.toBe(veDownloadReportHTML);
  });

  test('indirilen HTML, önizlemedeki TXT içeriğini taşır', async () => {
    window._veTxtPreviewContent = 'BASLIK SATIRI\n  deger: 42\n  oran: 3 < 5 & dogru';
    window._veTxtPreviewFilename = 'BMC_TamGaz_Rapor_20260810_1200.txt';

    veDownloadTXTPreviewAsHTML();

    expect(capturedBlob).toBeTruthy();
    const html = await capturedBlob.text();
    expect(html).toContain('BASLIK SATIRI');
    expect(html).toContain('deger: 42');
    // HTML’e gömülürken kaçırılmış olmalı (ui-core.escapeHTML tek kaynak)
    expect(html).toContain('3 &lt; 5 &amp; dogru');
    expect(html).not.toContain('3 < 5 & dogru');
  });

  test('dosya adı .txt → .html olur', () => {
    window._veTxtPreviewContent = 'x';
    window._veTxtPreviewFilename = 'Topoloji_Detay.txt';
    veDownloadTXTPreviewAsHTML();
    expect(capturedName).toBe('Topoloji_Detay.html');
  });

  test('önizleme içeriği yokken indirmez, sebebini söyler', () => {
    veDownloadTXTPreviewAsHTML();
    expect(capturedBlob).toBeNull();
    expect(toasts.some(t => /bulunamadı/i.test(t.msg))).toBe(true);
  });
});

describe('düğme kablolaması — hangi düğme hangi üreticiye gidiyor', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../../js/results.js'), 'utf8');

  // Bandı artık TEK üretici kuruyor (veRepHeadHTML). Eskiden beş panel onu
  // satır içi stille kopyalıyordu ve düğme sayısı tek güvenceydi; kopyalar
  // gidince sayım anlamını yitirir — ölçülen şey artık ÜRETİLEN YÜZEY.
  const yuzey = veTxtPreviewHTML('Tam Gaz Hızlanma Raporu (TXT)', 'ORNEK SATIR');
  const dugmeler = yuzey.split('<button').slice(1).map((b) => b.split('</button>')[0]);
  const hedef = (etiket) => {
    const b = dugmeler.find((x) => x.includes(etiket));
    return b && (b.match(/onclick="(ve[A-Za-z]+)\(\)"/) || [])[1];
  };

  test('"HTML İndir" TXT önizleme üreticisine gider (tasarımlı rapora DEĞİL)', () => {
    expect(hedef('HTML İndir')).toBe('veDownloadTXTPreviewAsHTML');
  });

  test('"TXT İndir" ham metin indiricisine gider', () => {
    expect(hedef('TXT İndir')).toBe('veDownloadTXTFromPreview');
  });

  test('dört TXT panelinin hepsi AYNI kabuğa gider', () => {
    // Panel yalnız başlığını ve indirme adını verir; yüzeyi kuran tek yer
    // veTxtPreviewShow. Biri kendi bandını kurmaya kalkarsa burada düşer.
    ['veRenderTXTReport', 'veRenderSegmentDriveTXTReport',
     'veRenderObstacleCrossingTXTReport', 'veRenderTopologyTXTReport'].forEach((fn) => {
      const i = src.indexOf('function ' + fn + '(');
      expect(i).toBeGreaterThan(-1);
      const govde = src.slice(i, src.indexOf('\n}\n', i));
      expect(govde).toContain('veTxtPreviewShow(');
      expect(govde).not.toContain('<button');       // kendi düğmesini kurmuyor
      expect(govde).not.toContain('overlay.innerHTML');
    });
  });

  test('Detaylı Rapor TASARIMLI üreticiye gider, TXT üreticisine değil', () => {
    const i = src.indexOf('function veRenderDetailedReport(');
    const govde = src.slice(i, src.indexOf('\n}\n', i));
    expect(govde).toContain("onclick: 'veDownloadReportHTML()'");
    expect(govde).not.toContain('veDownloadTXTPreviewAsHTML');
  });
});
