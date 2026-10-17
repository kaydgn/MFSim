/**
 * mount-metin.test.js — ARAYÜZ ANLATMAZ, Takoz (metin temizliği aşama 6)
 * ───────────────────────────────────────────────────────────────────────
 * Cırcır (metin-dili.test.js) yalnız sözlüğün işaretlediğini görür. Takoz'un
 * temizliğinde kalkanların bir kısmı işaretsizdi: ekranda zaten görünen
 * sonucu tekrarlayan bildirimler ("Motor katalogdan yüklendi", "Boş kanvas
 * kuruldu"), aynı pencerede iki kez söylenen durum (eksik bandı + kategori
 * notu; rapor penceresinde cevap + eylem notu) ve kısa tarif kuyrukları
 * ("Takoz seçin…"). Kurallar:
 *   · bilgi bildirimi yalnız EKRANDA GÖRÜNMEYEN sonucu söyler (izin listesi)
 *   · Takoz dizgeleri tarif fiili ve dosya yolu taşımaz
 *   · eksik bandının söylediği durum kategoride ikinci kez not olmaz
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const { bilgiBildirimleri } = require('../helpers/bildirim-olcu.js');

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

const DOSYALAR = ['js/cp-mount.js', 'js/cp-mount-wizard.js', 'js/cp-mount-3b.js', 'js/mount-step.js',
  'js/mount-core.js', 'js/mount-akso.js', 'js/cp-mount-baslangic.js', 'js/cp-mount-viewer.js',
  'js/cp-mount-param.js', 'js/mount-katalog.js'];

// Ekranda görünmeyen sonuç: kurulan örneğin adı ve denetimin sayısı (pencere
// kapalıyken başka yerde yazmıyor).
const IZIN = [/^Örnek yüklendi( — ‹›)?\.$/, /^Örnek yüklendi — ‹› uyarı \(‹› hata\)\.$/];

const TARIF = /(?<![\p{L}])(girin|seçin|ekleyin|tıklayın|kontrol edin|önerilir|bırakın|yazın|verin|silin|açın|kurun|çevirin|düzeltin|kullanın|bağlayın|deneyin)(?![\p{L}])/u;

describe('Takoz bilgi bildirimi yalnız görünmeyen sonucu söyler', () => {
  test.each(DOSYALAR)('%s', (dosya) => {
    const sapan = bilgiBildirimleri(dosya).filter((b) => !IZIN.some((re) => re.test(b.metin)))
      .map((b) => dosya + ':' + b.satir + ' ' + b.metin);
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor: tekrar bildirimi yakalanır', () => {
    ['Motor katalogdan yüklendi: ‹› — kütle / CG / atalet elle girilir.', 'Boş kanvas kuruldu — ‹›', 'Model kuruldu.']
      .forEach((m) => expect(IZIN.some((re) => re.test(m))).toBe(false));
  });
});

describe('Takoz dizgeleri tarif ve dosya yolu taşımaz', () => {
  test('tarif fiili ("… girin", "Takoz seçin…") ve "(js/…)" yok', () => {
    const sapan = DOSYALAR.flatMap((f) => dizgeler(f)
      .filter((d) => TARIF.test(d.metin) || /\bjs\/[\w-]+\.js\b/.test(d.metin))
      .map((d) => f + ':' + d.satir + ' ' + d.metin.slice(0, 120)));
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor: tarifli ileti yakalanır', () => {
    ['Takoz seçin…', 'Motor bileşenine rölanti devri ve silindir sayısını girin', 'birini silin.']
      .forEach((m) => expect(TARIF.test(m)).toBe(true));
    expect(TARIF.test('Takoz seçilmedi')).toBe(false);
  });
});

describe('aynı durum aynı pencerede bir kez', () => {
  test('PTO çakışması eksik bandında; kategori ikinci kez not basmaz', () => {
    const src = oku('js/cp-mount.js');
    const i = src.indexOf('function _mntPtoSection(');
    const govde = src.slice(i, src.indexOf('\n}', i));
    expect(govde).not.toMatch(/_mntPtoConflict|çift sayım/);
    expect(src).toMatch(/function _mntPtoDurumu[\s\S]*?Olası çift sayım: PTO Toplam \('\+cf\.groups\.length/);
  });
});
