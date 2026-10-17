/**
 * arac-rapor-metin.test.js — ARAYÜZ ANLATMAZ, Araç Performans raporları (aşama 12)
 * ───────────────────────────────────────────────────────────────────────
 * İki belge ailesi: Sonuçlar'ın HTML raporu (`js/results.js` → `_veRepSec*` ·
 * `_veReportAntet` · `_veReportAssemble` · `_veMakeReportHelpers`) ve TXT
 * raporları (`js/graphics.js` → tam gaz · hesap izi · topoloji · segment sürüş ·
 * engel aşma). İşlev listesi tek yerde: `tools/ikon-dili.js` → BELGE.
 *
 * Cırcır sözlüğün işaretlediğini tutar; bu dosya sözlüğün görmediği sınıfları:
 *   · yazılım anlatısı ("modelden otomatik üretilmiştir", "regresyon testiyle
 *     kilitlidir", "bir yazılım hatasına işaret ederdi")
 *   · kendini anlatma ("Bu bölüm, … özetler" — on bölümün açılışı; "Bu bölümde
 *     … açıklanmaktadır")
 *   · okuma tarifi ("aşağıdaki tablo", "yukarıdaki nota bakınız", "\">>>\" ile
 *     başlayan satırlar önemli olayları gösterir")
 *   · hükme eklenen öneri ("… değerlendirilmelidir", "… teyit edilmelidir")
 *   · ikinci kişi ("Sizin değerleriniz", "sizin kendi girdileriniz")
 *   · TXT raporlarının ASCII Türkçesi: beş `ascii()` yardımcısı belgeyi Türkçe
 *     harften arındırıyordu ("CEKIS KUVVETI", "Pompa emisi"); belge Türkçe yazılır.
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const { BELGE } = require('../../tools/ikon-dili.js');

const ROOT = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const DOSYALAR = ['js/results.js', 'js/graphics.js'];

// Adı BELGE listesinde olan işlevlerin (sonu * ise önek) içindeki dize sabitleri
function belgeDizgeleri(dosya) {
  const adlar = BELGE[dosya];
  const eslesir = (ad) => adlar.some((a) => (a.endsWith('*') ? ad.startsWith(a.slice(0, -1)) : ad === a));
  const ast = parser.parse(oku(dosya), { sourceType: 'script', errorRecovery: true });
  const out = [];
  (function yuru(n, icinde) {
    if (!n || typeof n.type !== 'string') return;
    let ic = icinde;
    if (n.type === 'FunctionDeclaration' && n.id && eslesir(n.id.name)) ic = true;
    if (ic && n.type === 'StringLiteral') out.push({ satir: n.loc.start.line, metin: n.value });
    if (ic && n.type === 'TemplateLiteral') n.quasis.forEach((q) => out.push({ satir: q.loc.start.line, metin: q.value.cooked || '' }));
    for (const k in n) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((x) => yuru(x, ic)); else if (v && typeof v.type === 'string') yuru(v, ic);
    }
  })(ast.program, false);
  return out;
}

test('BELGE listesi iki dosyada da işlev buluyor', () => {
  DOSYALAR.forEach((f) => expect(belgeDizgeleri(f).length).toBeGreaterThan(500));
});

// Yazılım anlatısı, kendini anlatma, okuma tarifi, hükme eklenen öneri ve ikinci kişi belgeye girmez.
const YASAK = /(?<![\p{L}-])(otomatik üretil\p{L}*|regresyon test\p{L}*|yazılım hata\p{L}*|program\p{L}*|bu bölüm\p{L}*|bu rapor\p{L}*|(?<!yokuş\s)(?:aşağıda|yukarıda)\p{L}*|bakınız|bkz\.|okunmalı\p{L}*|okunması gereken|önerilir|değerlendirilmeli\p{L}*|teyit edilmeli\p{L}*|açıklanmaktadır|araştırılmaktadır|önemli olayları gösterir|sizin|siz|girdileriniz|değerleriniz|simülasyonunuz\p{L}*|konfigürasyonunuz)(?![\p{L}])/iu;

describe('Araç Performans belgeleri yazılımı anlatmaz, tarif, öneri ve hitap taşımaz', () => {
  test.each(DOSYALAR)('%s', (f) => {
    const sapan = belgeDizgeleri(f).filter((d) => YASAK.test(d.metin)).map((d) => f + ':' + d.satir + ' ' + d.metin.slice(0, 120));
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor: eski metinler yakalanır', () => {
    ['projede tanımlı güç aktarma modelinden otomatik üretilmiştir.',
     'Bu bölüm, aracın aerodinamik ve kütle parametreleri ile lastik özelliklerini özetler.',
     'Çeviri bu yüzden tek noktada toplanmıştır ve regresyon testiyle kilitlidir.',
     'Son satırın sıfır olması beklenen sonuçtur (yukarıdaki nota bakınız); sıfırdan sapması ancak bir yazılım hatasına işaret ederdi.',
     'Aşağıdaki tablo bu bütçenin bu koşudaki dağılımıdır', 'tablo noktaları (bkz. Sayısal Yöntemler)',
     'Tasarım kararlarında sonuçlar güncel tedarikçi ve test verisiyle teyit edilmelidir.',
     'Daha uygun vites veya güzergah seçimi değerlendirilmelidir.',
     '  Bu bölümde raporun dayandığı fiziksel model ve matematiksel', '  formüller açıklanmaktadır. Her adımda sizin kendi girdileriniz',
     '  Sizin değerleriniz:', '  Sizin konfigürasyonunuz (stall):', '  koşullar araştırılmaktadır.',
     ' ms aralıkla kaydedilmiştir. ">>>" ile başlayan satırlar önemli olayları gösterir.)',
     'Program hız üzerinden bir integral almaz;']
      .forEach((m) => expect([m, YASAK.test(m)]).toEqual([m, true]));
    // Yöntem, kabul ölçütü ve geçerlilik sınırı yasak değil
    ['Modelin geçerlilik sınırları: rijit araç gövdesi, boyuna tek serbestlik derecesi.',
     'Son satır tanım gereği sıfırdır.', 'T_motor(N) − Düşürme = T_pompa(N) denklemi bisection ile çözülmüştür.',
     'J_fluid ~ 3,0 kg.m2 = TC kabuğundaki ATF sıvı ataleti, CAN-bus dN/dt ölçümleriyle kalibre edilmiştir.',
     'Hesaplama bu noktada durduruldu.', 'eğim kuvveti yokuş yukarıda <strong>direnç</strong> olarak pozitiftir']
      .forEach((m) => expect([m, YASAK.test(m)]).toEqual([m, false]));
  });
});

// ASCII Türkçe: belge sözlüğünde Türkçe harfle geçen bir sözcüğün harfleri düşmüş yazımı
// ("cekis" ↔ "çekiş"). Simge altindisi (F_cekis, aktif_egim) ad sayılır, taranmaz.
const katla = (s) => s.toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
  .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
const TR = /[ÇĞİÖŞÜçğıöşü]/;
const SOZCUK = /(?<![\p{L}\p{N}_\\])\p{L}+(?![\p{L}\p{N}_])/gu;
// İki yazımı da doğru Türkçe olan sözcükler: "alt ucu" ↔ "üçü"
const IKI_YAZIM = new Set(['ucu']);

function asciiTurkce(dizgeler) {
  const sozluk = new Map();
  dizgeler.forEach((d) => { for (const w of d.metin.matchAll(SOZCUK)) if (TR.test(w[0])) sozluk.set(katla(w[0]), w[0].toLocaleLowerCase('tr')); });
  const out = [];
  dizgeler.forEach((d) => {
    if (/^[\w.]+(?:[-_][\w.]+)+$/.test(d.metin)) return;   // kimlik ya da anahtar: 've-rapor-hazirlayan'
    for (const w of d.metin.matchAll(SOZCUK)) {
      const s = w[0];
      if (TR.test(s) || s.length < 3 || IKI_YAZIM.has(s.toLowerCase())) continue;
      const tr = sozluk.get(katla(s));
      if (tr && tr !== s.toLocaleLowerCase('tr')) out.push(d.satir + ' ' + s + ' → ' + tr);
    }
  });
  return out;
}

describe('belge Türkçe harfle yazılır', () => {
  test.each(DOSYALAR)('%s: harfi düşmüş sözcük yok', (f) => {
    expect(asciiTurkce(belgeDizgeleri(f))).toEqual([]);
  });

  test('kapı düşebiliyor: harfi düşmüş yazım yakalanır', () => {
    const d = [{ satir: 1, metin: 'ÇEKİŞ KUVVETİ' }, { satir: 2, metin: 'Pompa emişi' }, { satir: 3, metin: 'PROPŞAFT (KARDAN MİLİ)' },
      { satir: 4, metin: 'CEKIS KUVVETI = F_cekis' }, { satir: 5, metin: 'Pompa emisi' }, { satir: 6, metin: 'PROPSAFT' },
      { satir: 7, metin: 'Verimin Alt Ucu Sıfırdır · ölçeğin üçü' }];
    expect(asciiTurkce(d)).toEqual(['4 CEKIS → çekiş', '4 KUVVETI → kuvveti', '5 emisi → emişi', '6 PROPSAFT → propşaft']);
  });

  test('hazırlayan yokken belgeye uydurma iletişim adresi yazılmaz', () => {
    // eski: "İletişim : belirtilmemis@bmc.com.tr" — adres addan türetiliyor, ad yer tutucusuydu
    const m = /function veNameToEmail\(name\) \{[\s\S]*?\n\}/.exec(oku('js/graphics.js'));
    const veNameToEmail = new Function(m[0] + '\nreturn veNameToEmail;')();
    expect(veNameToEmail('Belirtilmemiş')).toBe('');
    expect(veNameToEmail('Belirtilmemis')).toBe('');
    expect(veNameToEmail('Ayşe Güneş')).toBe('ayse.gunes@bmc.com.tr');
  });

  test('TXT raporlarında harf arındıran yardımcı yok', () => {
    // eski: function ascii(s) { return String(s).replace(/ğ/g,'g') … } — beş kopya
    const src = oku('js/graphics.js');
    expect(src).not.toMatch(/function ascii\s*\(/);
    expect(src).not.toMatch(/\.replace\(\/[çğıöşüÇĞİÖŞÜ]\/g,\s*'[cgiosuCGIOSU]'\)/);
  });
});
