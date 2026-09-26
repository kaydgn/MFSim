/**
 * ikon.js — TEK İKON AİLESİ (kullanıcı kararı 10·B, 2026-09-26)
 * ───────────────────────────────────────────────────────────────────────────
 * Arayüzde ikon işi gören her şey css/icons.css'teki çizgi ikondur. Sembol
 * karakteri (▶ ▼ ✓ ✕ ⚠ ★) ikon diye YAZILMAZ: yazı tipinden çizilir —
 * Windows'ta Segoe UI Symbol'dan — ve kalınlığı, boyu, taban çizgisi çizgi
 * ikonlarla uyuşmaz. Kapı: tests/unit/ikon-dili.test.js (tarayıcı
 * tools/ikon-dili.js). İkonlar tools/ikonlar.json'dan ÜRETİLİR.
 *
 * Bilinmeyen bir ad SESSİZCE dolu bir kare çizer (maske yok, zemin
 * currentColor): kapı kaynaktaki her adın tanımlı olduğunu ölçer.
 *
 * `index.html`'de yükleyiciden ÖNCE yüklenir: açılış ekranı da kullanıyor.
 * Ölçüm Görüntüleyici ile paylaşılan dosyalar (signal-tree.js, trace-view.js)
 * bu yardımcıyı ÇAĞIRMAZ — görüntüleyicide yok; işaretlemeyi kendileri yazar.
 */

// İkonun işaretlemesi. `etiket` verilirse ikon tek başına anlam taşıyordur
// (yanında metin yok): ekran okuyucuya adıyla okunur. Verilmezse süstür.
function veIkon(ad, sinif, etiket) {
  var a = etiket
    ? ' role="img" aria-label="' + String(etiket).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"'
    : ' aria-hidden="true"';
  return '<span class="mf-ico mf-ico-' + ad + (sinif ? ' ' + sinif : '') + '"' + a + '></span>';
}

// Öğenin ikonunu değiştirir; ikon dışındaki sınıflarına dokunmaz.
// (Aç/kapa okları eskiden textContent'e '▼'/'▶' yazıyordu.)
function veIkonDegis(el, ad) {
  if(!el) return;
  var s = String(el.getAttribute('class') || '').split(/\s+/).filter(function(c) {
    return c && !/^mf-ico-/.test(c);
  });
  if(s.indexOf('mf-ico') < 0) s.unshift('mf-ico');
  s.push('mf-ico-' + ad);
  el.setAttribute('class', s.join(' '));
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veIkon: veIkon, veIkonDegis: veIkonDegis };
}
