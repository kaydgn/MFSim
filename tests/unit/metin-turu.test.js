/**
 * metin-turu.test.js — ARAYÜZ ANLATMAZ temizliğinin ekran turu (tools/metin-turu.js)
 * ───────────────────────────────────────────────────────────────────────────
 * Tarayıcı açan kısım Node'da koşmaz; buradaki kapı turun KAYNAK EŞLEMESİ ve
 * bayrak ayrıştırması. Eşleme yanlışsa karar tahtası metni yanlış dosyaya bağlar
 * ve uygulama yanlış satırı siler — sessiz bir hata.
 */
const T = require('../../tools/metin-turu.js');
const { sozcukSay } = require('../../tools/metin-dili.js');

const dizin = (...metinler) => T.kaynakDizini(metinler.map((m, i) => ({ dosya: 'js/x' + i + '.js', satir: i + 1, metin: m, sozcuk: sozcukSay(m) })));

describe('kaynak eşlemesi', () => {
  test('yer tutuculu kaynak metin ekrandaki metne bütünüyle oturur', () => {
    const d = dizin('‹› rapor · raporun modeli birebir yüklenir, sonra her şey değiştirilebilir');
    expect(T.esle(d, '11 rapor · raporun modeli birebir yüklenir, sonra her şey değiştirilebilir')).toEqual([{ dosya: 'js/x0.js', satir: 1 }]);
  });

  test('kısa yer tutuculu kalıp uzun bir satırı sahiplenmez ("Takoz ‹›")', () => {
    const d = dizin('Takoz ‹›‹›');
    expect(T.esle(d, "Takoz örnek şeması: araç adı componentDefs'ten — kayıttaki 40 ad kopyası kalktı")).toEqual([]);
  });

  test('düz metin yalnız kendisiyle eşleşir', () => {
    const d = dizin('Yükle');
    expect(T.esle(d, 'Yükle')).toHaveLength(1);
    expect(T.esle(d, 'Yükleme bitti')).toEqual([]);
  });

  test('iki dizeden kurulan blok, payının yarısını taşıyan parçaya bağlanır', () => {
    const d = dizin('Sihirbazla kur', 'önerilen');
    expect(T.esle(d, 'Sihirbazla kur önerilen')).toEqual([{ dosya: 'js/x0.js', satir: 1, parca: true }]);
  });

  test('çok yer tutuculu kalıp uzun metinde geri izlemeye boğulmaz', () => {
    const kalip = Array.from({ length: 12 }, (_, i) => 'parça' + i + ' ‹›').join(' ');
    const d = dizin(kalip);
    const uzun = 'parça0 ' + 'x'.repeat(4000);
    const t0 = Date.now();
    expect(T.esle(d, uzun)).toEqual([]);
    expect(Date.now() - t0).toBeLessThan(200);
  });
});

describe('bayraklar ve aşamalar', () => {
  test('bilinmeyen bayrak sessizce yutulmaz', () => {
    expect(() => T.ayristir(['--asama', '1', '--bilinmeyen'])).toThrow(/bilinmeyen bayrak/);
    expect(T.ayristir(['--asama', '1']).asama).toBe('1');
  });

  test('aşama 1 yedi yüzeyi kökleriyle tanımlar', () => {
    const y = T.ASAMALAR[1].yuzeyler;
    expect(y.map((x) => x.ad)).toEqual(['Şifre ekranı', 'Açılış ekranı', 'Karşılama', 'Modül giriş ekranı',
      'FEAD başlangıç sayfası', 'Takoz başlangıç sayfası', 'Boş tuval']);
    y.forEach((x) => { expect(typeof x.kok).toBe('string'); expect(typeof x.ac).toBe('function'); });
  });

  test('aşama 2 kabuğun yüzeylerini tanımlar; adlar tekil (görüntü dosyası addan)', () => {
    const y = T.ASAMALAR[2].yuzeyler;
    expect(y.length).toBeGreaterThanOrEqual(25);
    expect(new Set(y.map((x) => x.ad)).size).toBe(y.length);
    ['Şerit · Giriş', 'Komut paleti', 'Ayarlar · Hakkında', 'Program Arşivi', 'Komuta · tezgâh'].forEach((ad) => {
      expect(y.map((x) => x.ad)).toContain(ad);
    });
    y.forEach((x) => { expect(typeof x.kok).toBe('string'); expect(typeof x.ac).toBe('function'); });
  });
});
