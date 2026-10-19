/**
 * arac-metin.test.js — ARAYÜZ ANLATMAZ, Araç Performans pencereleri (aşama 7)
 * ───────────────────────────────────────────────────────────────────────
 * Cırcır (metin-dili.test.js) yalnız sözlüğün işaretlediğini görür. Araç
 * Performans'ın temizliğinde kalkanların bir kısmı işaretsizdi: "hakkında"
 * açıklama pencereleri (bilgi düğmesi + `infoPopupData`), ekranda görünen
 * sonucu tekrarlayan bildirimler ("Referans noktası eklendi", "Profil yönü
 * çevrildi") ve "-- Motor Seçiniz --" kalıbındaki seçenek yer tutucuları.
 * Kurallar:
 *   · açıklama penceresi yok — açıklamanın tek yeri kılavuz (guide-arac.js)
 *   · bilgi bildirimi yalnız EKRANDA GÖRÜNMEYEN sonucu söyler (izin listesi)
 *   · dizgeler tarif fiili ("… ekleyin", "Önce … hesaplayın") taşımaz
 *   · seçenek yer tutucusu ad ve sayıdır ("— Motor (42 preset) —")
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

const DOSYALAR = ['js/cp-engine.js', 'js/cp-gearbox.js', 'js/cp-torque-converter.js', 'js/cp-matching.js',
  'js/cp-accessories.js', 'js/cp-drivetrain.js', 'js/component-extras.js', 'js/cp-arac-example.js',
  'js/cp-arac-performans.js', 'js/map.js'];

const TARIF = /(?<![\p{L}])(girin|giriniz|seçin|seçiniz|ekleyin|tıklayın|kontrol edin|önerilir|bırakın|yazın|verin|silin|açın|kurun|çevirin|düzeltin|kullanın|bağlayın|deneyin|hesaplayın|büyültün|çizin)(?![\p{L}])/iu;

describe('açıklama penceresi yok — açıklama kılavuzda', () => {
  test('"hakkında" pencereleri (infoPopupData · showInfoPopup) ve bilgi düğmeleri kalktı', () => {
    const js = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
    const kalan = js.filter((f) => /showInfoPopup|infoPopupData|closeInfoPopup/.test(oku('js/' + f)));
    expect(kalan).toEqual([]);
  });
});

// Ekranda görünmeyen sonuç: kayıt (pencere kapanınca), sayısı görünmeyen
// içe alma, BAŞKA bileşene yazılan değer, ağdaki iş (rota · rakım), örnek.
const IZIN = [/kaydedildi( \(‹› (vites|satır)\))?$/, /^‹› (satır yapıştırıldı|nokta alındı\.)$/,
  /^‹› → (Şanzıman|TC) bileşenine yüklendi$/, /^‹› (eğim )?segmenti? Senaryolar bileşenine aktarıldı$/,
  /^Master tekerlek: ‹› tekerlek senkronize edildi$/, /…/, /^Rota bulundu: /, /^Segment aralığı: /,
  /^Rakım verisi okundu: /, /^Şanzıman limitleri: /, /^Hesaplamaya hazır \(‹›\)\.$/, /^Örnek yüklendi — ‹›\.$/];

describe('Araç Performans bilgi bildirimi yalnız görünmeyen sonucu söyler', () => {
  test.each(DOSYALAR)('%s', (dosya) => {
    const sapan = bilgiBildirimleri(dosya).filter((b) => !IZIN.some((re) => re.test(b.metin)))
      .map((b) => dosya + ':' + b.satir + ' ' + b.metin);
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor: görünen sonucun bildirimi yakalanır', () => {
    ['Tablo temizlendi', '‹› yüklendi', 'Parametre eklendi: ‹›', 'Profil güncellendi', 'Hava yoğunluğu: ‹› kg/m³',
     'Referans noktası eklendi: ‹›', 'Lastik yüklendi: ‹› (r=‹› m)']
      .forEach((m) => expect(IZIN.some((re) => re.test(m))).toBe(false));
  });
});

describe('Araç Performans dizgeleri tarif taşımaz', () => {
  test('tarif fiili ve "Seçiniz" kalıbı yok', () => {
    const sapan = DOSYALAR.flatMap((f) => dizgeler(f)
      .filter((d) => TARIF.test(d.metin))
      .map((d) => f + ':' + d.satir + ' ' + d.metin.slice(0, 120)));
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor', () => {
    ['Haritaya tıklayarak nokta ekleyin', 'Önce haritadan rota hesaplayın', '-- Motor Seçiniz (42 preset) --',
     'Yükseklik ve sıcaklık giriniz', 'Özellikler için haritayı büyültün']
      .forEach((m) => expect(TARIF.test(m)).toBe(true));
    expect(TARIF.test('— Motor (42 preset) —')).toBe(false);
  });
});
