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

  // MFSim'in asil dagitim bicimi TEK DOSYA: kullanici indirip cift tikliyor,
  // file:// uzerinde ve cogu zaman agsiz. Orada version.json goreli yol olarak
  // cozulup CORS'a takiliyordu — OLCULDU: acilistan 2 sn sonra 1 ag istegi +
  // 3 konsol hatasi, yani projenin kendi teslim kapisi ("0 ag istegi / 0 konsol
  // hatasi") gecmiyordu. Kapi sessiz degil ama zararsiz da degildi.
  test('_veIsLocalFile KARSILASTIRMASI — file: true, digerleri false', () => {
    // Asagidaki iki test _veIsLocalFile'i STUB'liyor; bu test yuklemin
    // KENDISINI tutuyor, yoksa stub'li testler totolojik olurdu. Olculdu:
    // argumansiz surumde 'file:' -> 'https:' mutasyonu YESIL geciyordu.
    expect(_veIsLocalFile('file:')).toBe(true);
    ['https:', 'http:', 'blob:', 'data:', 'about:'].forEach((p) => {
      expect(_veIsLocalFile(p)).toBe(false);
    });
    // Argumansiz cagri gercek protokolu okuyor (jsdom http(s)).
    expect(_veIsLocalFile()).toBe(false);
    expect(location.protocol).not.toBe('file:');
  });

  test('file:// uzerinde otomatik kontrol KAPALI — cevrimdisi tek dosya', () => {
    // jsdom location'i yeniden tanimlatmiyor; protokol okumasi bu yuzden
    // _veIsLocalFile() icinde ve testte o degistiriliyor.
    const eski = _veIsLocalFile;
    _veIsLocalFile = () => true;
    try {
      localStorage.removeItem('ve-deploy-autocheck');   // varsayilan ACIK
      expect(_veAutoCheckEnabled()).toBe(false);        // yine de kapali
    } finally {
      _veIsLocalFile = eski;
    }
  });

  test('http(s) uzerinde ACIK kalir — kapatma yalnizca file:// icin', () => {
    const eski = _veIsLocalFile;
    _veIsLocalFile = () => false;
    try {
      localStorage.removeItem('ve-deploy-autocheck');
      expect(_veAutoCheckEnabled()).toBe(true);
    } finally {
      _veIsLocalFile = eski;
    }
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

// ── Cevrimdisi kapisinin KARSI kapisi ───────────────────────────────────────
// tests/unit/deploy-status-offline.test.js "file:// uzerinde aga cikilmaz"i
// olcuyor. Tek basina yeterli degil: agi TAMAMEN kapatan bir degisiklik de
// oradan gecerdi. Bu blok http(s) uzerinde yoklamanin hala yapildigini tutar.
describe('http(s) — ag yolu HALA calisiyor', () => {
  test('protokol kapisi kapali (jsdom varsayilani http)', () => {
    expect(location.protocol).toBe('http:');
    expect(_veOfflineOnly()).toBe(false);
  });

  test('_veCheckDeploy once kendi version.json\'unu ceker', () => {
    var kunye = { runId: '7', status: 'completed', conclusion: 'success', date: new Date().toISOString() };
    global.fetch = jest.fn(function() {
      return Promise.resolve({ ok: true, json: function() { return Promise.resolve(kunye); } });
    });

    return new Promise(function(cozul) {
      _veCheckDeploy(function(info) {
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(String(fetch.mock.calls[0][0])).toContain('version.json');
        expect(info.runId).toBe('7');
        cozul();
      });
    });
  });

  test('gomulu kunye VARSA bile http yolunda ag tercih edilir', () => {
    // Pages kopyasi gomulu kunyeyi degil YAYINI gostermeli: gomulu olan
    // dosyanin kendi kimligi, yayin ise "guncel mi" sorusunun cevabi.
    window.__MFSIM_BUILD = { sha: 'abc1234', shortSha: 'abc1234', changes: [], source: 'embedded' };
    global.fetch = jest.fn(function() {
      return Promise.resolve({ ok: true, json: function() { return Promise.resolve({ runId: '9', status: 'completed', conclusion: 'success', date: new Date().toISOString() }); } });
    });

    return new Promise(function(cozul) {
      _veCheckDeploy(function(info) {
        expect(fetch).toHaveBeenCalled();
        expect(info.runId).toBe('9');
        expect(info.source).toBeUndefined();
        delete window.__MFSIM_BUILD;
        cozul();
      });
    });
  });
});
