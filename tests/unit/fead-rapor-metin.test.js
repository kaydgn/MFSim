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
 *   · teori şablonu (aşama 11b): taban64 gömülü olduğu için cırcır görmüyor;
 *     düz metni dosyanın sonundaki blokta taranır
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

// ── Teori şablonu (aşama 11b) ─────────────────────────────────────────────
// Şablon js/fead-report-template.js'e taban64 gömülü: cırcır onu görmüyor.
// Düz metni ortak yardımcıyla taranır (Takoz kapısıyla AYNI ölçüt). Yazılımın
// davranışı ("köprü katmanı … yazar", "panelde aç/kapa, kanvasta rozet"),
// geliştirme geçmişi ("Bir dönem program bu açıyı seçiyordu"), test ölçümü
// ("SEÇİCİ değildir — ölçüldü … 14/14"), okuyucuya iş ("Nasıl okunmalı",
// "karıştırılmamalıdır") ve büyük harfle vurgu girmez.
const TS = require('../helpers/teori-sablon.js');
const sablon = () => TS.sablon('js/fead-report-template.js', 'FEAD_REPORT_TEMPLATE_B64');

// Kaynak düzenlenip şablon yeniden üretilmezse teslim edilen belge sessizce
// bayat kalır (Takoz şablonunun aynı kapısı: mount-rapor-doku.test.js → ŞABLON).
describe('ŞABLON — gömülü şablon kaynağıyla taze', () => {
  test('tools/report-assets/fead-theory-source.html → js/fead-report-template.js (üreteç belirlenimci)', () => {
    const os = require('os');
    const { execFileSync } = require('child_process');
    const gecici = path.join(os.tmpdir(), 'fead-sablon-' + process.pid + '.js');
    try {
      execFileSync(process.execPath, [path.join(ROOT, 'tools/report-assets/build-fead-report-template.js'),
        path.join(ROOT, 'tools/report-assets/fead-theory-source.html'), gecici], { stdio: 'pipe' });
      // BAYATSA: npm run build:fead-report
      expect(fs.readFileSync(gecici, 'utf8') === oku('js/fead-report-template.js')).toBe(true);
    } finally { try { fs.unlinkSync(gecici); } catch (e) { /* yok */ } }
  });
});

describe('teori şablonu yazılımı anlatmaz (aşama 11b)', () => {
  test('düz metin ve Ek A yorumları: yazılım davranışı, geçmiş, test ölçümü, okuyucuya iş yok', () => {
    expect(TS.yasakBulgulari(sablon())).toEqual([]);
  });

  test('büyük harfle vurgu yok (kısaltma ve Ek A kodu hariç)', () => {
    expect(TS.buyukHarfBulgulari(sablon(), ['FEAD'])).toEqual([]);
  });

  test('§4.1 girilen koordinatı 2026-09-01 tanımıyla söyler: avara kasnağının merkezi', () => {
    const t = sablon();
    expect(t).toContain('Girilen koordinat avara kasnağının merkezidir');
    expect(t).not.toMatch(/Girilen koordinat gövdenin montaj noktasıdır/);
    expect(t).not.toMatch(/gerginin <strong>tek<\/strong> koordinatıdır/);
  });

  test('kapı düşebiliyor: eski metinler yakalanır', () => {
    ['(4.9) bir seçici değildir — ölçüldü', 'Bir dönem program bu açıyı bir ölçütten seçiyordu',
     'köprü katmanı montaj konumunu (4.7) ile ondan türetip buraya yazar', 'Nasıl okunmalı',
     'hem panelde açık bir aç/kapa hem de kanvasta bir rozet olarak gösterilir',
     'Bu rapor, projede tanımlı FEAD modelinden otomatik üretilmiştir', 'İki büyüklük karıştırılmamalıdır.',
     'Bu bir kapıdır, bir sonuç değil']
      .forEach((m) => expect(TS.TEORI_YASAK.test(m)).toBe(true));
    expect(TS.TEORI_YASAK.test('Kapalı çevrim değişmezi')).toBe(false);
    expect(TS.TEORI_YASAK.test('kalibre edilmiştir')).toBe(false);
    expect(TS.buyukHarfBulgulari('<p>Bu, sistemin burulma modu DEĞİLDİR</p>', [])).toEqual(['DEĞİLDİR']);
  });
});
