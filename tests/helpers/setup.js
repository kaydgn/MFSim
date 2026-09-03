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

// candbc/js/<file> kaynağını string olarak okur. CAN Çözümleyici de ayrı bir
// programdır (bkz. candbc/README.md) ve js/ ile HİÇBİR dosya paylaşmaz —
// modülleri yalnızca orada anlamlı. Çekirdeği (DBC ayrıştırıcı, bit çıkarma,
// kayıt biçimleri) tek global kapsamda görsün diye eval ile yüklenir.
global.loadCanSource = function loadCanSource(file) {
  return fs.readFileSync(path.join(__dirname, '../../candbc/js', file), 'utf8');
};

// escapeHTML GERÇEK sürümüyle konur, jest.fn() ile DEĞİL.
//
// js/ui-core.js tarayıcıda her zaman ilk yüklenir ve HTML kuran her modül bu
// fonksiyonun var olduğunu varsayar. Testte eval edilen tek bir modül ise onu
// göremez ve ReferenceError alır — nitekim kaçış eklenince iki test tam olarak
// böyle düştü. Kimliğe dönen bir stub konsaydı daha kötü olurdu: kaçış
// testleri sessizce anlamsızlaşır, "kaçırılıyor" diye geçerdi.
// Kaynak ui-core.js'ten OKUNUYOR, elle kopyalanmıyor: iki sürüm ayrışmasın.
(function () {
  const src = fs.readFileSync(path.join(JS_DIR, 'ui-core.js'), 'utf8');
  const i = src.indexOf('function escapeHTML');
  if (i < 0) throw new Error('js/ui-core.js içinde escapeHTML bulunamadı');
  const end = src.indexOf('\n}', i) + 2;
  global.escapeHTML = new Function(src.slice(i, end) + '\nreturn escapeHTML;')();
})();

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
