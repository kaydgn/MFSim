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

  test('Hesapla\'nın sebebi tarif vermez: eksiğin yeri "· Sahip › Bölüm"', () => {
    const src = oku('js/cp-fead-araclar.js');
    const i = src.indexOf('function _feadAracIsletmeYeri');
    const govde = src.slice(i, src.indexOf('\n}', i));
    const yerler = [...govde.matchAll(/return ' · ([^']+)';/g)].map((m) => m[1]);
    expect(yerler.length).toBe(3);
    // Bölüm, pencerenin bölüm BAŞLIĞIDIR (2026-10-16'dan beri sekme yok) ve boşluk
    // taşıyabilir ("Çalışma çevrimi"); başlığın pencerede var olduğu
    // fead-isletme.test.js → "sebep eksiğin YERİNİ söyler"de ölçülür.
    yerler.forEach((y) => expect(y).toMatch(/^(Aksesuar|Sürücü kasnak) › [^·›]+$/));
    expect(govde).not.toMatch(/girin|tamamlayın|seçin/);
  });
});

// ── Aşama 4 · sihirbaz, STEP okuyucusu, 3B görüntüleyici ─────────────────
const parser = require('@babel/parser');
const { yonYuvasi } = require('../helpers/yon-yuvasi.js');
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

describe('FEAD sihirbazı ve STEP', () => {
  test('sihirbazın ve 3B görüntüleyicinin bilgi bildirimi yalnız "Model kuruldu."', () => {
    ['js/cp-fead-wizard.js', 'js/cp-fead-3b.js'].forEach((f) => {
      const sapan = bilgiBildirimleri(f).filter((b) => b.metin !== 'Model kuruldu.')
        .map((b) => f + ':' + b.satir + ' ' + b.metin);
      expect(sapan).toEqual([]);
    });
  });

  test('ileti dosya yolu taşımaz ("(js/…)" geliştiricinin dili)', () => {
    const sapan = ['js/cp-fead.js', 'js/cp-fead-araclar.js', 'js/cp-fead-wizard.js', 'js/cp-fead-3b.js',
      'js/fead-step.js', 'js/step-p21.js']
      .flatMap((f) => dizgeler(f).filter((d) => /\bjs\/[\w-]+\.js\b/.test(d.metin)).map((d) => f + ':' + d.satir + ' ' + d.metin));
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor: dosya yollu ileti yakalanır', () => {
    expect(/\bjs\/[\w-]+\.js\b/.test('Hesap çekirdeği yüklenmedi (js/fead-core.js).')).toBe(true);
  });
});

// ── Aşama 5 · köprünün iletileri (fead-model.js) ─────────────────────────
// Hata, uyarı ve sınır metni olanı söyler: arkasına tarif ("… girin",
// "… kontrol edin") ve dosya yolu eklenmez.
const TARIF = /(?<![\p{L}])(ekleyin|girin|işaretleyin|kontrol edin|önerilir|bırakın|değiştirin|tıklayın|seçin|yazın|kurun|çevirin|düzeltin|kullanın)(?![\p{L}])/u;

describe('FEAD köprüsünün iletileri', () => {
  test('dizgeler tarif fiili ve dosya yolu taşımaz', () => {
    const sapan = dizgeler('js/fead-model.js')
      .filter((d) => TARIF.test(d.metin) || /\bjs\/[\w-]+\.js\b/.test(d.metin))
      .map((d) => d.satir + ' ' + d.metin);
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor: tarifli ileti yakalanır', () => {
    ['Gergi kolunun çalışma açısını girin.', 'Kasnak sırasını kontrol edin.', 'Gergi eklenmesi önerilir.']
      .forEach((m) => expect(TARIF.test(m)).toBe(true));
    expect(TARIF.test('Gergi avarasının merkez koordinatı (X / Y) girilmedi.')).toBe(false);
  });
});
