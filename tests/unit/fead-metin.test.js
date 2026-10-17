/**
 * fead-metin.test.js — ARAYÜZ ANLATMAZ, FEAD tuvali ve pencereleri (aşama 3)
 * ───────────────────────────────────────────────────────────────────────
 * Cırcır (metin-dili.test.js) yalnız sözlüğün işaretlediğini görür. FEAD'in
 * temizliğinde kalkanların bir kısmı işaretsizdi: "Kartlar düzenlendi",
 * "‹kasnak› silindi", "‹motor› künyesi yüklendi", "FEAD çözüldü — 7 devir
 * noktası" gibi ekranda zaten görünen sonucu tekrarlayan bildirimler ve
 * katman satırlarının açıklama yuvası (`ip`). Kurallar:
 *   · bilgi bildirimi yalnız EKRANDA GÖRÜNMEYEN sonucu söyler (izin listesi)
 *   · katman ve ön ayar satırı açıklama yuvası taşımaz
 *   · FEAD araçları penceresinin düğme ipucu yalnız ad (ya da kısayol dili)
 *   · Hesapla'nın sebebi tarif vermez; eksiğin yeri bir YOL verisidir
 */
const fs = require('fs');
const path = require('path');
const { bilgiBildirimleri } = require('../helpers/bildirim-olcu.js');

const ROOT = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// Ekranda görünmeyen sonuçlar: başka sekmedeki silme, kurulan örnek, sayısı
// görünmeyen toplu doldurma, doldurulamama sebebi.
const IZIN = [/^Çevrimdeki ‹› elle kW silindi\.$/, /^‹› kuruldu\.$/, /^‹› hücre katalogdan dolduruldu$/,
  /^Katalog modeli seçili aksesuar yok$/];

describe('FEAD bilgi bildirimi yalnız görünmeyen sonucu söyler', () => {
  test.each(['js/cp-fead.js', 'js/cp-fead-araclar.js'])('%s', (dosya) => {
    const sapan = bilgiBildirimleri(dosya).filter((b) => !IZIN.some((re) => re.test(b.metin)))
      .map((b) => dosya + ':' + b.satir + ' ' + b.metin);
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor: tekrar bildirimi yakalanır', () => {
    ['Kartlar düzenlendi', '‹› silindi', '‹› künyesi yüklendi', 'FEAD çözüldü — ‹› devir noktası']
      .forEach((m) => expect(IZIN.some((re) => re.test(m))).toBe(false));
  });
});

describe('katman ve ön ayar açıklama yuvası taşımaz', () => {
  test('VE_FEAD_KATMANLAR ve VE_FEAD_ON_AYARLAR: yalnız ad ve bayrak', () => {
    const src = oku('js/cp-fead.js');
    ['var VE_FEAD_KATMANLAR = [', 'var VE_FEAD_ON_AYARLAR = ['].forEach((bas) => {
      const i = src.indexOf(bas);
      expect(i).toBeGreaterThan(-1);
      const govde = src.slice(i, src.indexOf('];', i));
      expect(govde).not.toMatch(/\bip\s*:/);
    });
  });

  test('katman notunun kuralı CSS\'te de yok', () => {
    expect(/\.ve-fead-kat-not\b/.test(oku('css/styles.css'))).toBe(false);
  });
});

describe('FEAD araçları penceresi', () => {
  test('düğme ipucu yalnız ad ya da kısayol dili ("tıkla: …")', () => {
    const src = oku('js/cp-fead-araclar.js');
    const ipucu = [...src.matchAll(/title="([^"']+)"/g)].map((m) => m[1]);
    expect(ipucu.length).toBeGreaterThan(5);
    expect(ipucu.filter((t) => / — /.test(t) && !/(tıkla|sürükle|çift tık):/i.test(t))).toEqual([]);
  });

  test('Hesapla\'nın sebebi tarif vermez: eksiğin yeri "· Sahip › Sekme"', () => {
    const src = oku('js/cp-fead-araclar.js');
    const i = src.indexOf('function _feadAracIsletmeYeri');
    const govde = src.slice(i, src.indexOf('\n}', i));
    const yerler = [...govde.matchAll(/return ' · ([^']+)';/g)].map((m) => m[1]);
    expect(yerler.length).toBe(3);
    yerler.forEach((y) => expect(y).toMatch(/^(Aksesuar|Sürücü kasnak) › \S+$/));
    expect(govde).not.toMatch(/girin|tamamlayın|seçin/);
  });
});
