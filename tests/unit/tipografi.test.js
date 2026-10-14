/**
 * tipografi.test.js — ARAYÜZ METNİNİN YAZIMI TEK
 * ───────────────────────────────────────────────────────────────────────
 * Ekrandaki metin üç yazımı birden kullanıyordu:
 *   · üç nokta   "Ara...", "Hesaplanıyor...", açılışın 98 modül adı "…..." —
 *                tipografik üç nokta (…) tek karakterdir, yer tutucuda ve
 *                açılış ekranında iki biçim yan yana duruyordu
 *   · etkileşim  aynı jest beş ayrı adla: "Scroll", "Zoom", "Ctrl + tekerlek",
 *                "Sağ Tık+Sürükle", "Sağ tık + sürükle"; kapat "ESC — Kapat"
 *                ve "Esc" — kısayol penceresinin dili tek ölçüdür
 *   · iki nokta  günlükte "km/h : 12,3 s" (Türkçede iki noktadan önce boşluk yok)
 * Kapsam: js/ ve index.html'deki dize ve işaretleme (yorum satırları hariç).
 * Düz metin çıktıdaki TXT rapor hizası bu kapının dışında (o dosyalar kendi
 * düzenini boşlukla kuruyor: sayi-belge.spec.js).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const DOSYALAR = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'))
  .filter((f) => f !== 'fead-core.js')                 // dışarıdan geldi, birebir durur
  .map((f) => 'js/' + f).concat(['index.html']);

// Yorum satırları ve satır sonu yorumları dışarıda; kalan satırlar [dosya, no, metin].
function satirlar() {
  const out = [];
  DOSYALAR.forEach((f) => {
    fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((l, i) => {
      const t = l.trim();
      if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--')) return;
      out.push([f, i + 1, l.replace(/\s\/\/ .*$/, '')]);
    });
  });
  return out;
}
const bul = (re) => satirlar().filter((x) => re.test(x[2])).map((x) => `${x[0]}:${x[1]}  ${x[2].trim().slice(0, 110)}`);

describe('arayüz metninin yazımı', () => {
  test('üç nokta tek karakter (…): harften sonra "..." ve ardından tırnak/etiket yok', () => {
    expect(bul(/[A-Za-zçğıöşüÇĞİÖŞÜ)]\.\.\.(?=['"<])/)).toEqual([]);
  });

  test('etkileşim ipuçları tek dilde: "Scroll", "Zoom", "Sağ Tık", "Çift Tık", "ESC —" yok', () => {
    // tanımlayıcılar (preventScroll, scrollIntoView, _veTrScroll) metin değil
    const metin = /['">][^'"<>\n]*(\bScroll\b|\bZoom\b|Sağ Tık|Çift Tık|ESC —)[^'"<>\n]*['"<]/;
    expect(bul(metin)).toEqual([]);
  });

  test('iki noktadan önce boşluk yok (birim + " : ")', () => {
    // yalnız dizenin İÇİNDE: kodda `a ? b.rpm : c` üçlü işlecidir
    expect(bul(/'[^'\n]*\d?\s?(km\/h|m\/s|kW|N·m|d\/dk) : [^'\n]*'/)).toEqual([]);
  });

  test('kapı kendini boşa çıkarmıyor: tarama gerçekten dosya okuyor', () => {
    expect(DOSYALAR.length).toBeGreaterThan(100);
    expect(satirlar().length).toBeGreaterThan(50000);
  });
});
