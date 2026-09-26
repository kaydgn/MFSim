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

// Durum işareti — tabloda ya da satırda tek başına anlam taşıyan onay /
// uyarı / ret. Eskiden her panel kendi satır içi stilli karakterini yazıyordu
// ('<span style="color:var(--accent-success);font-weight:700;">✓</span>', aynı
// dosyada on dört kopya). Renk CSS'te (.ve-durum-*, --ink-*: zeminde okunur);
// ekran okuyucu adını okur.
var VE_DURUM_IKON = {
  ok:   ['check', 'Uygun'],
  warn: ['alert-triangle', 'Sınırda'],
  err:  ['x', 'Uygun değil']
};
function veDurumIkon(tur, etiket) {
  var d = VE_DURUM_IKON[tur] || VE_DURUM_IKON.warn;
  return veIkon(d[0], 've-durum ve-durum-' + (VE_DURUM_IKON[tur] ? tur : 'warn'), etiket || d[1]);
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veIkon: veIkon, veIkonDegis: veIkonDegis, veDurumIkon: veDurumIkon, VE_DURUM_IKON: VE_DURUM_IKON };
}
