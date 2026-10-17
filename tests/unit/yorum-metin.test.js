/**
 * yorum-metin.test.js — ARAYÜZ ANLATMAZ, Sonuçlar modül sekmeleri ve
 * diyagram yorumları (metin temizliği aşama 9b)
 * ───────────────────────────────────────────────────────────────────────
 * Şerit yorumu bulgu söyler: sayı, ölçüt, hüküm, geçerlilik sınırı. Bu
 * aşamada kalkanlar:
 *   · öncü satır yuvası (`brief.lead`): her kümenin "ne çizildiğini" anlatan
 *     sabit cümlesi — kalıp açıklama yuvası
 *   · okuma tarifi ve eksen anlatımı ("Yatay eksen …, dikey eksen …",
 *     "… olarak okuyun", "Tedarikçi raporlarındaki … bu sayıdır")
 *   · fizik açıklaması ve tekrar ("Takoz eğrilerinin aritmetik toplamı …",
 *     şerit başlığındaki kanal sayısının paragrafta ikinci kez yazılması)
 * Açıklamanın yeri kılavuzdur (Takoz kılavuzu §11.3).
 * Kurallar:
 *   · yorum motoru öncü satır üretmez, sunum onun yuvasını çizmez
 *   · yorum ve sekme dizgeleri okuma tarifi ve tarif fiili taşımaz
 *   · geçerlilik sınırı kalır (FEAD kural 10): kalibrasyon, sönümsüz tepe
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
function dizgeler(dosya) {
  const ast = parser.parse(oku(dosya), { sourceType: 'script', errorRecovery: true });
  const out = [];
  (function yuru(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'StringLiteral') out.push({ satir: n.loc.start.line, metin: n.value });
    for (const k in n) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(yuru); else if (v && typeof v.type === 'string') yuru(v);
    }
  })(ast.program);
  return out;
}

const YORUM = ['js/fead-brief.js', 'js/mount-brief.js'];
const SEKME = ['js/cp-fead-results.js', 'js/cp-mount-results.js', 'js/fead-signals.js'];

describe('öncü satır yuvası yok', () => {
  test.each(YORUM)('%s: küme özeti yalnız işaret taşır (LEADS yok)', (f) => {
    const src = oku(f);
    expect(src).not.toMatch(/\bLEADS\b/);
    expect(src).not.toMatch(/\blead\s*:/);
    expect(src).toMatch(/return \{ marks: /);
  });
  test('sunum yuvayı çizmez: veTrNoteLead ve .ve-trace-note-line yok', () => {
    expect(oku('js/trace-view.js')).not.toMatch(/veTrNoteLead|ve-trace-note-line/);
    expect(oku('css/styles.css')).not.toMatch(/\.ve-trace-note-line\b/);
  });
});

// Okuma tarifi ve eksen anlatımı: yorum bulgu söyler, grafiğin nasıl
// okunacağını anlatmaz.
const OKUMA = /(?:Yatay|Dikey) eksen|dikey eksen|okuyun|Tedarikçi raporlarındaki|Çare |gözden geçirilmeli|yeniden çözün|tıklayın|açılabilir|girilirse görünür|kesişim için en az/;
const TARIF = /(?<![\p{L}])(girin|seçin|ekleyin|tıklayın|kontrol edin|önerilir|bırakın|yazın|verin|silin|açın|kurun|çevirin|düzeltin|kullanın|bağlayın|deneyin|çalıştırın|okuyun|çözün|değiştirin)(?![\p{L}])/u;

describe('yorum ve sekme dizgeleri okuma tarifi taşımaz', () => {
  test.each(YORUM.concat(SEKME))('%s', (f) => {
    const sapan = dizgeler(f).filter((d) => OKUMA.test(d.metin) || TARIF.test(d.metin))
      .map((d) => f + ':' + d.satir + ' ' + d.metin.slice(0, 120));
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor: okuma tarifi yakalanır', () => {
    ['Yatay eksen zaman; güç grubuna düşey yönde darbe uygulanıyor.',
     'Burulma modeli KALİBRE bir modeldir — bir mertebe göstergesi olarak okuyun.',
     'Tedarikçi raporlarındaki "Isolation %" sütunu bu sayıdır.',
     'Kayış Özellikleri penceresinden (çizimde kayışa tıklayın) açılabilir.']
      .forEach((m) => expect(OKUMA.test(m) || TARIF.test(m)).toBe(true));
    expect(OKUMA.test('Çalışma bandı 750–2.300 d/dk rölanti ile en yüksek devir arasında.')).toBe(false);
  });
});

describe('geçerlilik sınırı kalır', () => {
  test('FEAD: burulma kalibrasyonu ve merkezkaç düzeltmesi şerit yorumunda', () => {
    const src = oku('js/fead-brief.js');
    expect(src).toMatch(/Burulma modeli Gates System Resonance\\'a kalibre \(RMS ~%8\)/);
    expect(src).toMatch(/\(türetilmiş, kalibre değil\)/);
  });
  test('Takoz: sönümsüz tepe sınırı ve lineer çözümün durdurucu sınırı', () => {
    const src = oku('js/mount-brief.js');
    expect(src).toMatch(/Sönümsüz tepe rezonansta sınırsız; yükseklik örneklemeye bağlı/);
    expect(src).toMatch(/lineer çözümde durdurucu yok/);
  });
});

describe('açıklama kılavuzda', () => {
  test('Takoz kılavuzu §11.3: iletilebilirlik, vektörel toplam, Campbell okuması', () => {
    const src = oku('js/guide-mount.js');
    expect(src).toMatch(/11\.3 Frekans yanıtı ve Campbell diyagramı/);
    expect(src).toMatch(/toplam vektöreldir/);
    expect(src).toMatch(/eğik çizgiler motorun uyarma mertebeleridir/);
  });
});
