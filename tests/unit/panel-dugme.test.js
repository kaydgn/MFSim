/**
 * Panel düğme satırı — css/styles.css › .sw-btn-row / .sw-btn
 * ───────────────────────────────────────────────────────────
 * Satır kaydırmasız bir flex'ti: dar pencerede düğmeler büzülüyor ve yazı
 * İÇLERİNDE kırılıyordu. Ölçüldü (gerçek tarayıcı, motor penceresi): "+ Satır
 * Ekle", "Tümünü Sil", "Veriyi Temizle" 89–104 px'e sıkışıp iki satıra
 * iniyordu; "Kaydet" simgesini yazının üstüne alıyordu. Asıl ölçüm gerçek
 * tarayıcıda: tests/e2e/mufettis-sigma.spec.js → "düğme yazısı N satır".
 * Bu dosya yalnız hızlı geri bildirim: kuralın kendisi yerinde mi.
 */
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
const kural = (sec) => (css.match(new RegExp('\\n' + sec.replace(/[.-]/g, '\\$&') + '\\{([^}]*)\\}')) || [])[1] || '';

test('düğme yazısı kırılmaz', () => {
  expect(kural('.sw-btn')).toMatch(/white-space:\s*nowrap/);
});

test('sığmayan düğme alt satıra geçer (satır kayar)', () => {
  expect(kural('.sw-btn-row')).toMatch(/flex-wrap:\s*wrap/);
});
