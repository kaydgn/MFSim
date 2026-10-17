/**
 * fead-rapor-metin.test.js — ARAYÜZ ANLATMAZ, FEAD raporları (aşama 10)
 * ───────────────────────────────────────────────────────────────────────
 * Belge mühendislik içeriği taşır: yöntem, varsayım, kaynak, kabul ölçütü,
 * geçerlilik sınırı. Yazılımın kendi davranışının gerekçesi ("Kol çalışma
 * açısını program seçmez", "Neden ayrıca sorulmuyor"), test ölçümü
 * ("ÖLÇÜLDÜ (14 tedarikçi sistemi, bu kodun kendisiyle)"), okuyucuya tarif
 * ("… olarak okuyunuz", "kaynak sütununa bakınız") ve büyük harfle vurgu
 * yazılmaz. Cırcır sözlüğün işaretlediği sınıfları tutar (üç belgede de
 * işaretli metin kalmadı); bu dosya sözlüğün görmediklerini tutar:
 *   · rapor türü kartlarının açıklama yuvası (`aciklama`)
 *   · pencere kartlarının alt satırı ("hangi belge indirilecek")
 *   · belgede yazılımın test ölçümü ve pencereye yönlendirme
 *   · "Uygunluk kapıları" (geliştirme dili) → "Uygunluk kriterleri"
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

const RP = require('../../js/cp-fead-report.js');
const BELGE = ['js/cp-fead-report.js', 'js/cp-fead-summary.js', 'js/cp-fead-pano.js'];

describe('rapor penceresi açıklama yuvası taşımaz', () => {
  test('rapor türleri yalnız ad ve dosya künyesi taşır (aciklama yok)', () => {
    expect(RP.VE_FEAD_REPORT_KINDS.length).toBe(3);
    RP.VE_FEAD_REPORT_KINDS.forEach((k) => {
      expect(k.ad).toBeTruthy();
      expect('aciklama' in k).toBe(false);
    });
  });
  test('Rapor türü ve Doküman künyesi kartlarının alt satırı yok', () => {
    const src = oku('js/cp-fead-report.js');
    expect(src).toMatch(/_feadCard\('Rapor türü', '',/);
    expect(src).toMatch(/_feadCard\('Doküman künyesi', '',/);
  });
});

// Yazılımın kendi davranışı ve test ölçümü belgeye girmez; okuyucuya tarif de.
const YASAK = /(?<![\p{L}])(program\p{L}*|yazılım\p{L}*|ölçüldü|ÖLÇÜLDÜ|bu kod\p{L}*|okuyucu\p{L}*|okuyunuz|bakınız|karşılaştırınız|yapabilesiniz|sorulmuyor|kapı\p{L}*|KAPI\p{L}*)(?![\p{L}])/u;

describe('FEAD belgeleri yazılımı anlatmaz', () => {
  test.each(BELGE)('%s', (f) => {
    const sapan = dizgeler(f).filter((d) => YASAK.test(d.metin)).map((d) => f + ':' + d.satir + ' ' + d.metin.slice(0, 120));
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor: yazılım gerekçesi ve test ölçümü yakalanır', () => {
    ['Kol çalışma açısını program seçmez', 'ÖLÇÜLDÜ (14 tedarikçi sistemi, bu kodun kendisiyle)',
     'Sonucu bir mertebe göstergesi olarak okuyunuz', 'Kayış özellikleri (kaynak sütununa bakınız)',
     'Neden ayrıca sorulmuyor', 'Bu bir SEÇİCİ değil, bir KAPIDIR']
      .forEach((m) => expect(YASAK.test(m)).toBe(true));
    // Kalibrasyondaki "uyduruldu" (eğri uydurma) bir yöntemdir, yasak değil
    expect(YASAK.test('sırt μ ayrı uyduruldu')).toBe(false);
  });
});

describe('"Uygunluk kapıları" emekli: kullanıcıya görünen ad "Uygunluk kriterleri"', () => {
  test.each(['js/cp-fead.js', 'js/cp-fead-wizard.js', 'js/cp-fead-results.js', 'js/cp-fead-report.js'])('%s', (f) => {
    const sapan = dizgeler(f).filter((d) => /Uygunluk kapı/i.test(d.metin)).map((d) => f + ':' + d.satir);
    expect(sapan).toEqual([]);
  });
  test('kart ve özet bölümü yeni adı taşır', () => {
    expect(oku('js/cp-fead.js')).toMatch(/_feadCard\('Uygunluk kriterleri'/);
    expect(oku('js/cp-fead-wizard.js')).toMatch(/_fwCard\('Uygunluk kriterleri'/);
    expect(oku('js/cp-fead-results.js')).toMatch(/_feadResSec\('Uygunluk kriterleri'/);
  });
});
