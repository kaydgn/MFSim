/**
 * durum-seridi.test.js — DURUM ŞERİDİ YOK
 * ──────────────────────────────────────────────────────────────────────
 * Kullanıcı 2026-11-11, Canlı Not 129: *"Programdan şu kısmı kaldıralım. Hem
 * uyarılara, hem de sağ taraftaki açıklamalara gerek yok. Bu kısım zaten çok eski
 * kaldı. Programdan tamamen kaldıralım, alt çubuk da kalkacak zaten. Alan
 * kazanırız."* Tuvalin altındaki 24 px'lik şerit (Uyarılar düğmesi ve paneli,
 * "N bileşen, M bağlantı", yakınlık yüzdesi, "Hazır") kalktı.
 *
 * Kapı: sayfada şeridin hiçbir öğesi yok; ona yazan kod, Komutlar'daki ve komut
 * paletindeki "Uyarılar" komutu ve stilleri yok. Doğrula'nın sonucu bildirimde —
 * kapısı validation.test.js → *sonuç bildirimde*. Gerçek tarayıcı:
 * kabuk-sutun.spec.js → *DURUM ŞERİDİ YOK*.
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');

describe('DURUM ŞERİDİ YOK', () => {
  test('sayfada şerit, Uyarılar paneli, sayaç, yakınlık ve kip yazısı yok', () => {
    const HTML = oku('index.html');
    const ids = ['ve-status-bar', 've-warnings-panel', 've-warnings-chip', 've-warnings-body',
      've-warnings-count', 've-status-counts', 've-status-zoom', 've-status-mode'];
    expect(ids.filter((id) => HTML.includes('id="' + id + '"'))).toEqual([]);
  });

  test('şeride yazan kod, "Uyarılar" komutu ve stilleri yok', () => {
    const yasak = /veToggleWarnings|veSetWarningsOpen|veUpdateWarnings|veRenderWarningsPanel|veShowValidationInWarnings|veWarningsPanelOpen|veOpenWarningsPanel|ve-warnings-|ve-status-(zoom|counts|mode)\b|\.ve-toolbar-info/;
    const dosyalar = fs.readdirSync(path.join(KOK, 'js')).filter((f) => f.endsWith('.js'));
    expect(dosyalar.filter((f) => yasak.test(oku('js/' + f)))).toEqual([]);
    expect(oku('js/ribbon.js')).not.toMatch(/label:'Uyarılar'/);
    expect(oku('js/command-palette.js')).not.toMatch(/Uyarılar panelini/);
    expect(oku('css/styles.css')).not.toMatch(/\.ve-status-bar|\.ve-warnings-panel|\.ve-status-warnings|\.ve-warning-item|#ve-warnings-count/);
  });
});
