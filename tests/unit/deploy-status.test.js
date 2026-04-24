/**
 * deploy-status.js - Deploy gostergesi yardimci fonksiyon birim testleri
 * HTML escape, tarih formatlama, dot durumu, otomatik kontrol toggle.
 */

const fs = require('fs');
const path = require('path');

document.body.innerHTML = `
  <span id="ve-deploy-dot" class="ve-deploy-dot ve-deploy-unknown"></span>
  <span id="ve-deploy-refresh"></span>
`;

const src = fs.readFileSync(path.join(__dirname, '../../js/deploy-status.js'), 'utf8');
// DOMContentLoaded handler register eder ama test ortaminda zaten yuklenmis
// sayfada yeni DOMContentLoaded tetiklemez; eval guvenli.
eval(src);

beforeEach(() => {
  localStorage.clear();
  var popup = document.getElementById('ve-deploy-popup');
  if(popup) popup.remove();
});

describe('_veEscHtml', () => {
  test('< > & karakterlerini kacar', () => {
    expect(_veEscHtml('<script>x</script>')).toBe('&lt;script&gt;x&lt;/script&gt;');
    expect(_veEscHtml('a & b')).toBe('a &amp; b');
  });

  test('null/undefined bos string dondurur', () => {
    expect(_veEscHtml(null)).toBe('');
    expect(_veEscHtml(undefined)).toBe('');
  });

  test('sayi ve diger degerleri string yapar', () => {
    expect(_veEscHtml(42)).toBe('42');
  });
});

describe('_veFormatDeployDate', () => {
  test('bos degerde bos string', () => {
    expect(_veFormatDeployDate('')).toBe('');
    expect(_veFormatDeployDate(null)).toBe('');
  });

  test('30 sn once -> "Az once"', () => {
    var iso = new Date(Date.now() - 30 * 1000).toISOString();
    expect(_veFormatDeployDate(iso)).toBe('Az önce');
  });

  test('5 dk once -> "5 dk once"', () => {
    var iso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(_veFormatDeployDate(iso)).toBe('5 dk önce');
  });

  test('3 saat once -> "3 saat once"', () => {
    var iso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(_veFormatDeployDate(iso)).toBe('3 saat önce');
  });

  test('3 gun once -> tarih/saat formati', () => {
    var iso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    var out = _veFormatDeployDate(iso);
    // gun/ay/yil + saat:dakika bekleniyor; yerel formata gore degisir ama rakam icermeli
    expect(out).toMatch(/\d/);
    expect(out).not.toBe('Az önce');
  });
});

describe('_veApplyDotState', () => {
  test('completed+success -> success class', () => {
    var dot = document.getElementById('ve-deploy-dot');
    _veApplyDotState(dot, { status: 'completed', conclusion: 'success' });
    expect(dot.className).toContain('ve-deploy-success');
    expect(dot.title).toContain('Güncel');
  });

  test('in_progress -> pending class', () => {
    var dot = document.getElementById('ve-deploy-dot');
    _veApplyDotState(dot, { status: 'in_progress' });
    expect(dot.className).toContain('ve-deploy-pending');
  });

  test('basarisiz -> error class', () => {
    var dot = document.getElementById('ve-deploy-dot');
    _veApplyDotState(dot, { status: 'completed', conclusion: 'failure' });
    expect(dot.className).toContain('ve-deploy-error');
  });

  test('null info hata vermez', () => {
    expect(() => _veApplyDotState(null, { status: 'completed' })).not.toThrow();
    var dot = document.getElementById('ve-deploy-dot');
    expect(() => _veApplyDotState(dot, null)).not.toThrow();
  });
});

describe('Otomatik kontrol toggle', () => {
  test('varsayilan acik (localStorage bosken)', () => {
    expect(_veAutoCheckEnabled()).toBe(true);
  });

  test("'off' kapatir", () => {
    _veToggleAutoCheck(false);
    expect(localStorage.getItem('ve-deploy-autocheck')).toBe('off');
    expect(_veAutoCheckEnabled()).toBe(false);
  });

  test("'on' geri acar", () => {
    _veToggleAutoCheck(false);
    _veToggleAutoCheck(true);
    expect(localStorage.getItem('ve-deploy-autocheck')).toBe('on');
    expect(_veAutoCheckEnabled()).toBe(true);
  });
});

describe('_veDismissPopup', () => {
  test('popup yoksa hata vermez', () => {
    expect(() => _veDismissPopup()).not.toThrow();
  });

  test('popup kapatir ve last-seen-pr kaydeder', () => {
    var popup = document.createElement('div');
    popup.id = 've-deploy-popup';
    popup.setAttribute('data-pr-number', '123');
    document.body.appendChild(popup);

    _veDismissPopup();

    expect(document.getElementById('ve-deploy-popup')).toBeNull();
    expect(localStorage.getItem('ve-deploy-last-seen-pr')).toBe('123');
  });

  test('pr-number=0 ise last-seen yazmaz', () => {
    var popup = document.createElement('div');
    popup.id = 've-deploy-popup';
    popup.setAttribute('data-pr-number', '0');
    document.body.appendChild(popup);

    _veDismissPopup();

    expect(document.getElementById('ve-deploy-popup')).toBeNull();
    expect(localStorage.getItem('ve-deploy-last-seen-pr')).toBeNull();
  });
});
