#!/usr/bin/env node
/**
 * cumle-duzeni.js — ARAYÜZ ETİKETLERİNİN CÜMLE DÜZENİ KURALI (kullanıcı kararı 9·B)
 * ───────────────────────────────────────────────────────────────────────────
 * Kuralın TEK kaynağı: kapı (tests/unit/cumle-duzeni.test.js) bu dosyayı
 * çağırır, sonraki aşamalar da buradan tarar. İki kopya tutulursa kapı bir
 * şeyi, dönüştürme başka bir şeyi ölçer.
 *
 * Kural: çok kelimeli etikette yalnız ilk kelime büyük harfle başlar
 * ("Klavye kısayolları"). Bölüt başı: ilk kelime; "—", "·", "|", ":" ya da bir
 * ikon karakteri (▶ ✓ ⚠ …) sonrası; cümle sonu ("." — "Ort.", "Maks." gibi
 * kısaltmalar cümle bitirmez). "Lastik/Jant", "Merkezi–Ön" gibi birleşik
 * kelimenin her parçası ayrı kelimedir. Yalnız LATİN büyük harf küçülür
 * ("Δt" bir semboldür).
 *
 * Özel adlar olduğu gibi kalır:
 *   · bileşen adları — componentDefs'in `name` alanından OKUNUR; tek kelimelik
 *     bileşen adı yalnız ardından "bileşen…" gelince ("Senaryolar bileşenine")
 *   · yüzey adları (YUZEY), yer adları (YER), ürünün adı ve künyesi (URUN)
 *   · Kayış Tablosu'nun defter sütunları (DEFTER — VE_FEAD_TABLE_COLS'tan okunur)
 *   · sihirbazın gergiye verdiği ad (AD — VE_FW_TEN_AD'dan okunur)
 *   · tuşlar, markalar, semboller ve İngilizce terimler (TEK; karar 8·A)
 *
 * Kullanım: node tools/cumle-duzeni.js js/cp-engine.js …   → sapmaları ve öneriyi yazar
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');

// YALNIZ componentDefs adları (`  'tip': {\n    name: '…'`) — sinyal adları
// (`name:'Motor Devri'`) bileşen adı değil, onlar da cümle düzenine uyar.
const BILESEN = [...oku('js/components.js').matchAll(/^  '[a-z0-9-]+':\s*\{\s*\n\s+name:\s*'([^']+)'/gm)].map((m) => m[1]);
const YUZEY = ['Araç Performans', 'Takoz Çökme-Titreşim', 'Komuta Penceresi', 'Program Arşivi',
  'Program Durumu', 'Kayış Tablosu', 'Kayış Yolu', 'Çizim Masası', 'Veri Gezgini', 'Sonuç Özeti',
  'Ölçüm Görüntüleyici', 'CAN Çözümleyici', 'Çalışma Noktası'];
const YER = ['Bolu Tüneli'];
// Kayış Tablosu'nun sütun adları kullanıcının hesap DEFTERİNİN başlıklarıdır
// ("Efektif Çap", "Sarım Açısı"): tablo ve kılavuz onları defterle
// karşılaştırılsın diye birebir taşır. Listeden OKUNUR, elle yazılmaz.
const _kolon = oku('js/cp-fead.js').match(/var VE_FEAD_TABLE_COLS = \[([\s\S]*?)\n\];/);
const DEFTER = _kolon ? [..._kolon[1].matchAll(/\bt:'([^']+)'/g)].map((m) => m[1]) : [];
// Sihirbazın gergiye verdiği ad ("Otomatik Gergi", kullanıcı kararı 2026-08-31):
// adımın başlığı, satırın tipi ve kurulan düğümün adı üçü de bu. Tek üreticiden OKUNUR.
const _ten = oku('js/cp-fead-wizard.js').match(/var VE_FW_TEN_AD = '([^']+)'/);
const AD = _ten ? [_ten[1]] : [];
const URUN = ['MFSim — Araç Performans Simülasyonu', 'Araç Performans Simülasyon Yazılımı'];
const TEK = new Set(['Esc', 'Ctrl', 'Shift', 'Enter', 'Tab', 'Del', 'Space', 'Cmd', 'Home', 'End',
  'Vector', 'CANoe', 'Excel', 'GitHub', 'Windows', 'Gates', 'Allison', 'Cummins', 'Lucide', 'Edge',
  'Inter', 'Segoe', 'Workflow', 'Run', 'Grid', 'Minimap', 'Coast-Down', 'Hubload', 'Mean', 'Governed',
  'Deploy', 'Pages', 'Actions', 'Speed', 'Spline', 'Data', 'Mode', 'Recommended', 'Wide', 'Case',
  'Studio', 'Pitch', 'Arm', 'Length', 'Load', 'Notes', 'Schedule', 'Controller', 'Converter', 'Ref',
  'Offset', 'Engine', 'Turbine', 'Torque', 'Upshift', 'Downshift', 'Layout', 'Lockup', 'Stall',
  'Duramax', 'Plotly', 'Cd', 'Crr', 'Nm', 'SP', 'DynActive', 'Sonuçlar', 'Topoloji',
  'Tensioner', 'Pivot', 'Point', 'Duty', 'Cycle', 'Geometri', 'İşletme', 'Measure', 'Inertia',
  // kişi adları (yöntemler, diyagramlar)
  'Euler', 'Newton', 'Raphson', 'Newmark', 'Heun', 'Ralston', 'Runge', 'Kutta', 'Dormand', 'Prince', 'Campbell',
  'Rayleigh', 'Hermite', 'Fritsch', 'Carlson', 'Coulomb', 'Fourier', 'Bode', 'Nyquist', 'Kelvin', 'Voigt',
  'Info', 'Log']);
const KISALTMA = new Set(['Ort', 'Ağ', 'Ör', 'Örn', 'Maks', 'Min', 'Max', 'vb', 'vs', 'No', 'Nr', 'Ref',
  'Std', 'Yakl', 'bkz', 'Bkz', 'yak']);
const COK = [...new Set([...BILESEN, ...YUZEY, ...YER, ...DEFTER, ...AD])].filter((a) => /\s/.test(a)).sort((a, b) => b.length - a.length);

const kucult = (p) => p.replace(/^([(“"']?)([A-ZÇĞİÖŞÜ])(?=[\p{Ll}'’]+[.,)”"':;]*$)/u, (m, o, h) => o + h.toLocaleLowerCase('tr'));

// Başlık Düzeni → Cümle düzeni. Uzunluğu korur (tr küçültme tek karakter).
function cumle(t) {
  if (URUN.includes(t)) return t;
  const tut = [];
  let s = t;
  COK.forEach((a) => { s = s.split(a).join('\u0000' + (tut.push(a) - 1) + '\u0001'); });
  // "PTO/Pompa": eğik çizgiyle dizilmiş bileşen adlarının hepsi bileşen adıdır.
  s = s.replace(/[A-ZÇĞİÖŞÜ][\p{L}]*(?:\/[A-ZÇĞİÖŞÜ][\p{L}]*)+/gu,
    (m) => (m.split('/').every((x) => BILESEN.includes(x)) ? '\u0000' + (tut.push(m) - 1) + '\u0001' : m));
  // Tek kelimelik bileşen adı, ardından "(adet) bileşen…" ya da "panel…" geliyorsa bileşenin adıdır.
  s = s.replace(/(^|\s)([A-ZÇĞİÖŞÜ][\p{Ll}]+)(?=\s+(?:\([^)]*\)\s+)?(?:[Bb]ileşen|panel))/gu,
    (m, o, a) => (BILESEN.includes(a) ? o + '\u0000' + (tut.push(a) - 1) + '\u0001' : m));
  let bas = true;
  s = s.replace(/(\S+)(\s*)/g, (tam, w, bosluk) => {
    // " / " ile dizilmiş seçenekler de ayrı bölüttür ("Klima / Alternatör"); ok da
    // ("Otomatik → Lineer": sonucun adı).
    if (/^[—:·|/→⇒]$/.test(w) || /^[▶▷►✓✔✗✕⚠●○＋+↓↑⚙★☆📄]+$/u.test(w)) { bas = true; return w + bosluk; }
    if (/^[“"]/.test(w)) bas = true;                          // tırnak içindeki ad kendi bölütüdür
    // Tireli birleşik kelime de parçalanır ("Kayış-Kasnak"); bütünü bir terimse ("Coast-Down") kalır.
    const butun = w.replace(/^[(“"']+|[.,)”"':;]+$/g, '');
    const out = (TEK.has(butun) ? [w] : w.split(/([/–-])/)).map((p, i) => {
      if (i % 2 === 1) return p;
      const cip = p.replace(/^[(“"']+|[.,)”"':;]+$/g, '').replace(/['’]\p{Ll}+$/u, '');
      // Kesme işaretiyle ek alan kelime Türkçede özel addır ("Motor’a", "GitHub'da").
      if (/^[A-ZÇĞİÖŞÜ][\p{L}]*['’]\p{Ll}+/u.test(p.replace(/^[(“"']+/, ''))) return p;
      return (!(bas && i === 0) && !TEK.has(cip)) ? kucult(p) : p;
    }).join('');
    if (/[A-Za-zÇĞİÖŞÜçğıöşü]|\u0000/.test(w)) bas = false;   // sembol (τ, η, Δ) ilk kelime sayılmaz
    if (/:$/.test(w)) bas = true;
    const son = w.replace(/<[^>]*>/g, '').replace(/[)”"']+$/, '');   // "kayıt.</b> Elle" da cümle sonu
    if (/[.!?]$/.test(son) && !KISALTMA.has(son.replace(/^[(“"']+/, '').slice(0, -1))) bas = true;
    return out + bosluk;
  });
  return s.replace(/\u0000(\d+)\u0001/g, (m, i) => tut[+i]);
}

// Kaynaktaki arayüz metni: etiket alanları, etiketler arası metin, ipucu ve aria.
// Başlığı İLK argüman alan yardımcılar da (_feadCard('Temas tarafı', …),
// _fwField, _gfNot …): bu desen olmadan panellerin kart başlıkları taramaya hiç
// girmiyordu ve aynı pencerede iki düzen yan yana kalıyordu. Kılavuzun kart
// araması (_gfSahneKart2(fn, 'Başlık')) panelin başlığıyla BİREBİR eşleşmek
// zorunda (veGuideCard metinle arar) — o yüzden o argüman da taranır.
const YARDIMCI = /\b_?[A-Za-z0-9]*(?:Card|Kart|Row|Field|Read|Title|Hint|Badge|Tablo|Not|Uyari|Onay|H1|H2|Blk|KV|Label|Sect|Grp|Overlay|Btn|Dugme|Note)[A-Za-z0-9]*\(\s*'([^'\n]{3,70})'/g;
// Başlık bir üçlü koşuldan da gelebilir: _feadCard(k === 'dev' ? 'Devir sınırları' : 'Güç eğrisi', …).
const YARDIMCI_UCLU = new RegExp(YARDIMCI.source.replace("\\(\\s*'([^'\\n]{3,70})'",
  "\\(\\s*(?:[^'(),\\n]|'[^'\\n]*')*?\\?\\s*'([^'\\n]{3,70})'\\s*:\\s*'([^'\\n]{3,70})'"), 'g');
const DESEN = [/label:\s*'([^'\n]{3,70})'/g, />\s*([^<>{}\n]{3,70}?)\s*</g,
  /(?:title|aria-label|placeholder)="([^"\n]{3,70})"/g, /title:\s*'([^'\n]{3,70})'/g, /eyebrow:\s*'([^'\n]{3,70})'/g, /\bph:\s*'([^'\n]{3,70})'/g, /\bbaslik:\s*'([^'\n]{3,70})'/g, /\bad:\s*'([^'\n]{3,70})'/g,
  YARDIMCI, YARDIMCI_UCLU, /data-ve-tablo-baslik="([^"\n]{3,70})"/g,
  /\['[gam](?:\d+|Ek)',\s*'[^'\n]*',\s*'([^'\n]{3,70})'\]/g,   // kılavuz bölüm başlıkları (VE_GUIDE_*_SECTIONS)
  /_gfSahneKart2\('\w+',\s*'([^'\n]{3,70})'/g, /_feadBosDugme\([^,]+,\s*'([^'\n]{3,70})'/g];
// Yakalanan parça bir dize BİRLEŞTİRMESİNİN içiyse (' + ad + ') etiket değildir.
// Çıplak "+" yetmez: "+ Satır ekle" düğmesinin kendisi "+" taşıyor ve süzgeç
// bir dönem onu bu yüzden hiç taramıyordu.
const BIRLESTIRME = /[{}=;$]|\bfunction\b|'\s*,\s*'|['"]\s*\+|\+\s*['"]/;
function etiketler(f) {
  const s = oku(f), out = [];
  for (const re of DESEN) {
    let m; re.lastIndex = 0;
    while ((m = re.exec(s))) {
      for (let g = 1; g < m.length; g++) {
        if (m[g] === undefined) continue;
        const t = m[g].replace(/\\n/g, ' ');
        if (BIRLESTIRME.test(t)) continue;                             // dize birleştirmesinin parçası
        out.push(t);
      }
    }
  }
  return out;
}

module.exports = { cumle, etiketler, DESEN, BIRLESTIRME, BILESEN, YUZEY, DEFTER, AD, TEK, URUN };

if (require.main === module) {
  let n = 0;
  process.argv.slice(2).forEach((f) => {
    new Set(etiketler(f)).forEach((t) => {
      const c = cumle(t);
      if (c !== t) { n++; console.log(f + ': ' + JSON.stringify(t) + ' → ' + JSON.stringify(c)); }
    });
  });
  console.log(n ? n + ' sapma' : 'sapma yok');
  process.exitCode = n ? 1 : 0;
}
