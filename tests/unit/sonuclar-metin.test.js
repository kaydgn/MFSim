/**
 * sonuclar-metin.test.js — ARAYÜZ ANLATMAZ, Sonuçlar kabuğu (aşama 9a)
 * ───────────────────────────────────────────────────────────────────────
 * Cırcır (metin-dili.test.js) yalnız sözlüğün işaretlediğini görür. Sonuçlar
 * kabuğunda kalkanların bir kısmı işaretsizdi ya da bir YUVAYDI:
 *   · kaynak tablosunun çare yuvası (`cozum`): her modül bildirimin arkasına
 *     "… Hesapla ile yeniden çözün" ekliyordu
 *   · ekranda zaten görünen sonucu tekrarlayan bildirimler ("‹› diyagramı
 *     eklendi", "Grid gösteriliyor", "‹› birim ortak ölçekte toplandı")
 *   · boş durumun ve ipuçlarının tarifleri ("önce simülasyonu çalıştırın",
 *     "yorumu kaydırın", "Excel'e yapıştırabilirsiniz")
 * Kurallar:
 *   · kaynak tablosu açıklama yuvası taşımaz
 *   · bilgi bildirimi yalnız EKRANDA GÖRÜNMEYEN sonucu söyler (izin listesi)
 *   · kabuk dizgeleri tarif fiili taşımaz
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const { yonYuvasi } = require('../helpers/yon-yuvasi.js');
const { bilgiBildirimleri } = require('../helpers/bildirim-olcu.js');

const ROOT = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
function dizgeler(dosya) {
  const ast = parser.parse(oku(dosya), { sourceType: 'script', errorRecovery: true });
  const out = [];
  (function yuru(n) {
    if (!n || typeof n.type !== 'string') return;
    if (yonYuvasi(n)) return;           // yönlendirme yuvası (veYon) — biçimini metin-dili ölçer
    if (n.type === 'StringLiteral') out.push({ satir: n.loc.start.line, metin: n.value });
    for (const k in n) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(yuru); else if (v && typeof v.type === 'string') yuru(v);
    }
  })(ast.program);
  return out;
}

const KABUK = ['js/results.js', 'js/trace-view.js', 'js/signal-tree.js', 'js/sonuc-tablo.js',
  'js/panel-chart.js', 'js/measure-import-ui.js', 'js/measure-dropzone.js', 'js/sayi-alan.js'];

describe('kaynak tablosu açıklama yuvası taşımaz', () => {
  test('veResultSources: girişlerde çare (cozum) alanı yok', () => {
    const src = oku('js/results.js');
    const i = src.indexOf('var veResultSources = [');
    expect(i).toBeGreaterThan(-1);
    const govde = src.slice(i, src.indexOf('\n];', i));
    expect(govde).toMatch(/kanal: 'FEAD kanalı'/);
    expect(govde).not.toMatch(/\bcozum\s*:/);
    expect(src).not.toMatch(/src\.cozum/);
  });
});

// Ekranda görünmeyen sonuç: indirme, arka planda süren üretim, oturumdan
// düşen veri, göç, kopyalanan satır sayısı, davranış (hizalama) ve sayısı
// görünmeyen ayar.
const IZIN = [
  /^HTML rapor indirildi\.$/, /^HTML rapor indirildi \(‹› KB\)$/, /^TXT rapor indirildi$/,
  /^Detay matematik hesapları üretiliyor…$/, /^HTML rapor hazırlanıyor…$/,
  /^‹› ölçüm şeridi kaldırıldı: veri oturumda yok\.$/,
  /^Hizalama açık$/, /^Hizalama kapalı · Q basılıyken açık$/,
  /^Güç akışı animasyonu (açık|kapalı)$/, /^Grid: ‹› \(‹›px\)$/, /^Sınır opaklığı: %‹›$/,
  /^Aynı birimi paylaşan şerit yok\.$/, /^Birleştirmek için en az iki şerit gerekir\.$/,
  /^‹› sinyal eski panellerden ölçüm penceresine taşındı\.$/,
  /^3B panelin X\/Y\/Z sinyalleri ayrı eğriler olarak geldi\.$/,
  /^‹› satır panoya kopyalandı\.$/, /^CSV indirildi — ‹› satır, ‹› sinyal\.$/,
  /^‹› şerit kaldırıldı: ölçüm kendi zaman eksenini getiriyor\.$/,
  /^‹› sinyal içe aktarıldı — X ekseni: ‹›$/, /^‹› dosya bırakıldı; ilki açılıyor: ‹›\.$/
];

describe('Sonuçlar bilgi bildirimi yalnız görünmeyen sonucu söyler', () => {
  test.each(KABUK)('%s', (dosya) => {
    const sapan = bilgiBildirimleri(dosya).filter((b) => !IZIN.some((re) => re.test(b.metin)))
      .map((b) => dosya + ':' + b.satir + ' ' + b.metin);
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor: tekrar bildirimi yakalanır', () => {
    ['‹› diyagramı eklendi', 'Grid gösteriliyor', '‹› birim ortak ölçekte toplandı.',
     'X ekseni ‹› olarak ayarlandı', '‹› kaldırıldı']
      .forEach((m) => expect(IZIN.some((re) => re.test(m))).toBe(false));
  });
});

const TARIF = /(?<![\p{L}])(girin|seçin|ekleyin|tıklayın|kontrol edin|önerilir|bırakın|yazın|verin|silin|açın|kurun|çevirin|düzeltin|kullanın|bağlayın|deneyin|çalıştırın|okuyun|kaydırın|indirin|aktarın|çözün|yükleyin|bakın|değiştirin|yapıştırabilirsiniz|bırakabilirsiniz|lütfen)(?![\p{L}])/iu;

describe('Sonuçlar kabuğu dizgeleri tarif taşımaz', () => {
  test.each(KABUK)('%s', (f) => {
    const sapan = dizgeler(f).filter((d) => TARIF.test(d.metin)).map((d) => f + ':' + d.satir + ' ' + d.metin.slice(0, 120));
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor: tarifli ileti yakalanır', () => {
    ['Veri yok — önce simülasyonu çalıştırın', 'Devamı var — yorumu kaydırın',
     'Excel\'e yapıştırabilirsiniz.', 'Diğerlerini tek tek bırakabilirsiniz.', 'Dosyayı yeniden içe aktarın.']
      .forEach((m) => expect(TARIF.test(m)).toBe(true));
    expect(TARIF.test('Sinyal seçilmedi.')).toBe(false);
  });
});
