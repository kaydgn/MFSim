/**
 * ayri-program-yon.test.js — YÖNLENDİRME, Ölçüm Görüntüleyici (E5, 2026-10-19)
 * ───────────────────────────────────────────────────────────────────────
 * Biçimi metin-dili.test.js ölçüyor (yön profili; statik HTML'de
 * `data-ve-yon`). Burada: YÖNLENDİRMEDEKİ AD EKRANDA VAR — cümle
 * olmayan bir denetime göndermesin. Ad değişirse cümle eskir; kapı ikisini
 * birlikte tutar. Görüntüleyici yuvayı `viewer/js/yon.js`'ten alır (js/yon.js
 * kopyası, senkron kapısı viewer-sync.test.js) ve onu panodan ÖNCE yükler.
 */
const fs = require('fs');
const path = require('path');
const T = require('../../tools/metin-dili.js');

const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');
const yonlar = (f) => T.metinler(f).filter((x) => x.baglam === 'yon').map((x) => x.metin);

describe('Ölçüm Görüntüleyici', () => {
  test('boş veri tablosu Veri Gezgini’ni gösteriyor; o ad ekranda', () => {
    expect(yonlar('viewer/js/board.js')).toContain('Veri Gezgini’nden sinyal seçin.');
    expect(oku('viewer/index.html')).toMatch(/<span class="mf-ico mf-ico-bar-chart"><\/span> Veri Gezgini<\/span>/);
  });
  test('yuva panodan önce yükleniyor', () => {
    const h = oku('viewer/index.html');
    const a = h.indexOf('js/yon.js'), b = h.indexOf('js/board.js');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
  });
});
