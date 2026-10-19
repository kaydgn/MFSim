/**
 * yon-yuvasi.js — YÖNLENDİRME YUVASI (ARAYÜZ ANLATMAZ'ın dördüncü türü)
 * ───────────────────────────────────────────────────────────────────────
 * `veYon('…')` / `cdbYon('…')` çağrısının içi bir yuvadır: aşama kapılarının
 * "tarif taşımaz" ve "bilgi bildirimi" taramaları onu dışarıda bırakır;
 * biçimini tools/metin-dili.js (yön profili) ölçer. Çağrının adı TEK yerde:
 * tarayıcının `YON_CAGRI`sı.
 */
const { YON_CAGRI } = require('../../tools/metin-dili.js');

// Babel düğümü bir yönlendirme yuvası mı?
function yonYuvasi(n) {
  return !!(n && n.type === 'CallExpression' && n.callee && n.callee.type === 'Identifier'
    && YON_CAGRI.test(n.callee.name));
}

module.exports = { yonYuvasi };
