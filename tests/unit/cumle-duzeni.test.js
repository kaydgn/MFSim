/**
 * cumle-duzeni.test.js — ARAYÜZ ETİKETLERİ CÜMLE DÜZENİNDE (kullanıcı kararı 9·B)
 * ───────────────────────────────────────────────────────────────────────────
 * Kural: çok kelimeli bir etikette yalnız ilk kelime (ve "—", "·", ":"
 * sonrası bölütün ilk kelimesi) büyük harfle başlar — "Klavye kısayolları",
 * "Birime göre birleştir". Kullanıcı Windows'un kendi dilini seçti.
 *
 * Özel adlar olduğu gibi kalır:
 *   · bileşen adları — `componentDefs`'in `name` alanından OKUNUR (Klima
 *     Kompresörü, Tork Konvertörü); ikinci bir liste tutulmaz
 *   · yüzey adları — aşağıdaki YUZEY: kararın istisna listesi. Belgeler bu
 *     yüzeyleri özel ad olarak anıyor (Kayış Tablosu, Komuta Penceresi…)
 *   · ürünün adı ve künyesi, kısaltmalar (FEAD, PTO), tuşlar (Esc, Ctrl),
 *     markalar (GitHub, Vector CANoe) ve İngilizce terimler (karar 8·A)
 *
 * AŞAMA 1 — KABUK: şerit, komut paleti, sağ tık menüleri, Ayarlar, Program
 * Durumu, Kısayollar, Komuta, palet kategorileri, pencere başlıkları, Sonuçlar
 * kabuğu, içe aktarma ve görüntüleyici. Bileşen panelleri, kılavuzlar ve
 * raporlar sonraki aşamalar; o dosyalar eklendikçe KABUK listesi büyür.
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');

const KABUK = ['index.html', 'viewer/index.html', 'js/ribbon.js', 'js/command-palette.js',
  'js/context-menus.js', 'js/settings.js', 'js/status.js', 'js/shortcuts-help.js', 'js/toolbar.js',
  'js/cp-komuta.js', 'js/guide-kit.js', 'js/kimlik.js', 'js/cp-programlar.js', 'js/tablo-pencere.js',
  'js/solver-pro.js', 'js/trace-view.js', 'js/measure-import-ui.js', 'js/signal-tree.js',
  'viewer/js/board.js'];

// ── Özel adlar ────────────────────────────────────────────────────────────
const BILESEN = [...oku('js/components.js').matchAll(/\bname:\s*'([^']+)'/g)].map((m) => m[1]);
const YUZEY = ['Araç Performans', 'Takoz Çökme-Titreşim', 'Komuta Penceresi', 'Program Arşivi',
  'Program Durumu', 'Kayış Tablosu', 'Kayış Yolu', 'Çizim Masası', 'Veri Gezgini', 'Sonuç Özeti',
  'Ölçüm Görüntüleyici', 'CAN Çözümleyici'];
const URUN = ['MFSim — Araç Performans Simülasyonu', 'Araç Performans Simülasyon Yazılımı'];
const TEK = new Set(['Esc', 'Ctrl', 'Shift', 'Enter', 'Tab', 'Del', 'Space', 'Cmd', 'Home', 'End',
  'Vector', 'CANoe', 'Excel', 'GitHub', 'Windows', 'Gates', 'Allison', 'Cummins', 'Lucide', 'Edge',
  'Inter', 'Segoe', 'Workflow', 'Run', 'Grid', 'Minimap', 'Coast-Down', 'Hubload', 'Mean', 'Governed',
  'Deploy', 'Pages', 'Actions']);
const COK = [...new Set([...BILESEN, ...YUZEY])].filter((a) => /\s/.test(a)).sort((a, b) => b.length - a.length);

// ── Kural: Başlık Düzeni → Cümle düzeni (uzunluk korunur) ─────────────────
function cumle(t) {
  if (URUN.includes(t)) return t;
  const tut = [];
  let s = t;
  COK.forEach((a) => { s = s.split(a).join('\u0000' + (tut.push(a) - 1) + '\u0001'); });
  let bas = true;
  s = s.replace(/(\S+)(\s*)/g, (tam, w, bosluk) => {
    let out = w;
    if (/^[—:·|]$/.test(w)) { bas = true; return w + bosluk; }
    const cip = w.replace(/^[(“"']+|[.,)”"':]+$/g, '').replace(/['’]\p{Ll}+$/u, '');
    if (!bas && !TEK.has(cip) && /^[(“"']?\p{Lu}[\p{Ll}'’]+[.,)]?$/u.test(w)) {
      out = w.replace(/^([(“"']?)(\p{Lu})/u, (m, p, h) => p + h.toLocaleLowerCase('tr'));
    }
    if (/\p{L}|\u0000/u.test(w)) bas = false;
    if (/:$/.test(w)) bas = true;
    return out + bosluk;
  });
  return s.replace(/\u0000(\d+)\u0001/g, (m, i) => tut[+i]);
}

// ── Etiketler: kaynaktaki arayüz metni ────────────────────────────────────
const DESEN = [/label:\s*'([^'\n]{3,70})'/g, />\s*([^<>{}\n]{3,70}?)\s*</g,
  /(?:title|aria-label|placeholder)="([^"\n]{3,70})"/g, /title:\s*'([^'\n]{3,70})'/g, /\bad:\s*'([^'\n]{3,70})'/g];
function etiketler(f) {
  const s = oku(f), out = [];
  for (const re of DESEN) {
    let m; re.lastIndex = 0;
    while ((m = re.exec(s))) {
      const t = m[1].replace(/\\n/g, ' ');
      if (/[{}=;$+]|\bfunction\b/.test(t)) continue;
      out.push(t);
    }
  }
  return out;
}

describe('kural', () => {
  test.each([
    ['Birime Göre Birleştir', 'Birime göre birleştir'],
    ['Ölçüm İçe Aktar', 'Ölçüm içe aktar'],
    ['Tümünü Sığdır (Zaman Ekseni)', 'Tümünü sığdır (zaman ekseni)'],
    ['Klima Kompresörü Ekle', 'Klima Kompresörü ekle'],        // bileşen adı
    ['Program Durumu', 'Program Durumu'],                      // yüzey adı
    ['FEAD Kasnakları', 'FEAD kasnakları'],                    // kısaltma
    ['Kapat (Esc)', 'Kapat (Esc)'],                            // tuş
    ["GitHub'da Aç", "GitHub'da aç"],                          // marka
    ['FEAD: Sonuçlar sekmesi', 'FEAD: Sonuçlar sekmesi'],      // iki noktadan sonra yeni bölüt
    ['Dikey Aynala (Üst ↔ Alt)', 'Dikey aynala (üst ↔ alt)'],  // "Alt" burada yön, tuş değil
  ])('%s → %s', (a, b) => expect(cumle(a)).toBe(b));

  test('bileşen adları componentDefs\'ten okunuyor', () => {
    expect(BILESEN.length).toBeGreaterThan(40);
    expect(BILESEN).toContain('Klima Kompresörü');
  });
});

describe('aşama 1 — kabuk', () => {
  const HEPSI = KABUK.flatMap((f) => etiketler(f).map((t) => ({ f, t })));

  test('tarama boşa çalışmıyor', () => {
    expect(HEPSI.length).toBeGreaterThan(400);
  });

  test('her çok kelimeli etiket cümle düzeninde (özel adlar hariç)', () => {
    const sapan = HEPSI.filter(({ t }) => cumle(t) !== t).map(({ f, t }) => `${f}: "${t}" → "${cumle(t)}"`);
    expect([...new Set(sapan)]).toEqual([]);
  });

  test('yüzey adı küçültülmüyor ("Program durumu" değil "Program Durumu")', () => {
    const sapan = [];
    HEPSI.forEach(({ f, t }) => YUZEY.forEach((a) => {
      const re = new RegExp('(^|[^\\p{L}])(' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![\\p{L}])', 'giu');
      let m;
      while ((m = re.exec(t))) if (m[2] !== a) sapan.push(`${f}: "${t}"`);
    }));
    expect([...new Set(sapan)]).toEqual([]);
  });
});
