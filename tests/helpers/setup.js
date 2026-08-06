/**
 * Ortak birim-test kurulumu
 * ─────────────────────────
 * jest.config.js "setupFiles" ile HER test dosyasından önce bir kez çalışır.
 * Amaç: yeni testlerde tekrar eden boilerplate'i (kaynak yükleme + ortak
 * yan-etki stub'ları) merkezileştirmek, böylece her yeni test dosyası 15
 * satır kurulum yerine 2-3 satırla başlasın.
 *
 * KULLANIM (yeni test dosyası):
 *   const stubs = stubGlobals();        // showToast/saveState/... = jest.fn()
 *   eval(loadSource('sensors.js'));     // üst-seviye fonksiyonlar test kapsamına gelir
 *   beforeEach(() => resetStubs(stubs));
 *
 * NOT: js/ modüllerinin çoğu tarayıcı için üst-seviye (global) fonksiyon
 * bildirimi kullanır; bu yüzden `require` yerine `eval(loadSource(...))`
 * gerekir. module.exports guard'ı olan modüller (mount-core, cp-mount,
 * cp-arac-performans, window-drag) doğrudan require() ile yüklenebilir.
 */
const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, '../../js');
const VIEWER_JS_DIR = path.join(__dirname, '../../viewer/js');

// js/<file> kaynağını string olarak okur.
global.loadSource = function loadSource(file) {
  return fs.readFileSync(path.join(JS_DIR, file), 'utf8');
};

// viewer/js/<file> kaynağını string olarak okur. Ölçüm Görüntüleyici ayrı bir
// programdır (bkz. viewer/README.md); modüllerinin yedisi js/'ten birebir
// kopya, biri (board.js) yalnızca orada var. Testi de yalnızca orada anlamlı.
global.loadViewerSource = function loadViewerSource(file) {
  return fs.readFileSync(path.join(VIEWER_JS_DIR, file), 'utf8');
};

// UI katmanının çağırdığı, çekirdek mantık açısından önemsiz olan ortak
// yan-etki fonksiyonlarını jest.fn() olarak global'e kurar. Testte hangi
// stub'lara ihtiyaç varsa `extra` ile eklenebilir/geçersiz kılınabilir.
global.stubGlobals = function stubGlobals(extra) {
  const stubs = Object.assign(
    {
      showToast: jest.fn(),
      saveState: jest.fn(),
      showNodeProperties: jest.fn(),
      render: jest.fn(),
      // Canvas çizimleri tema rengini bununla okur (js/theme.js); testte
      // sabit bir renk yeterli.
      veThemeRgba: jest.fn(() => 'rgba(0,0,0,1)'),
    },
    extra || {}
  );
  Object.keys(stubs).forEach(function (name) {
    global[name] = stubs[name];
  });
  return stubs;
};

// stubGlobals() ile dönen sözlükteki tüm jest.fn'leri temizler (beforeEach).
global.resetStubs = function resetStubs(stubs) {
  Object.keys(stubs || {}).forEach(function (name) {
    const fn = stubs[name];
    if (fn && typeof fn.mockClear === 'function') fn.mockClear();
  });
};
