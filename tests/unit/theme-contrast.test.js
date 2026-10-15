// ── Tema renkleri: metin okunabilirliği ─────────────────────────────────────
//
// ÖLÇÜLEN KUSUR (16 temanın hepsinde):
//
//   --text-muted        2,04 … 3,05:1   (eşik 4,5)  — 16/16 tema
//   --text-secondary    3,90 … 4,29:1               —  4/16 tema
//   aksan üstünde beyaz 2,04 … 4,49:1               — 39/64 çift
//   aksan METİN olarak  2,27 … 4,49:1               — 43/64 çift
//
// Bunlar arayüzün en küçük yazıları: sinyalin birimi (1/min), rozet sayıları,
// durum çubuğu etiketleri, "Ölçüm penceresi" gibi bölüm başlıkları. 9–11 px
// metnin 2,3:1 kontrastla okunması istenecek bir şey değil ve program günün
// her saatinde açık duruyor.
//
// BELİRTEÇ AİLELERİ — hangi rengin nerede kullanılacağı:
//   --text-*    yüzey üstünde normal metin
//   --on-*      AKSAN ZEMİNİNİN üstünde metin   (beyaz her aksanda yetmiyor)
//   --ink-*     aksanın METİN sürümü            (aksanın kendisi zemin/kenarlık)
//
// Bu test paletin kendisini sınar, ekran görüntüsünü değil: bir tema eklenir
// ya da bir renk elle kurcalanırsa kırmızıya döner. Eşik WCAG 2.1 AA (4,5:1);
// aksanın ZEMİN/kenarlık olarak kullanımı bu testin konusu değil (orada 3:1
// yeterli ve renk kimliği bilerek korunuyor).

const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(
  path.join(__dirname, '../../css/styles.css'), 'utf8');

// ── Renk aritmetiği (WCAG 2.1) ─────────────────────────────────────────────
const hex = (h) => [1, 3, 5].map((i) => parseInt(String(h).trim().slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const oran = (a, b) => {
  const L1 = lum(a); const L2 = lum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
};

// ── Tema bloklarını CSS'ten oku ────────────────────────────────────────────
function temalariOku() {
  const re = /(:root, \[data-theme="([\w-]+)"\]|\[data-theme="([\w-]+)"\])\s*\{([^}]*)\}/g;
  const out = [];
  let m;
  while ((m = re.exec(css)) !== null) {
    const t = { ad: m[2] || m[3] };
    let v;
    const vre = /--([\w-]+):\s*([^;]+);/g;
    while ((v = vre.exec(m[4])) !== null) t[v[1]] = v[2].trim();
    if (t['text-muted']) out.push(t);
  }
  return out;
}

// `--ink-*` aksan zaten yeterliyse doğrudan ona bağlanıyor (var(--accent-…)).
// O durumda çözülmüş değer aksanın kendisidir.
function coz(t, anahtar) {
  const v = t[anahtar];
  if (!v) return null;
  const m = v.match(/^var\(--([\w-]+)\)$/);
  return m ? coz(t, m[1]) : (v.startsWith('#') ? v : null);
}

// ÇÖZÜLEMEYEN JETON ARTIK SESSİZ GEÇMİYOR.
//
// ÖLÇÜLEN DELİK (2026-09-22): `coz()` hex olmayan değerde null dönüyordu,
// `hex(null)` NaN üretiyordu, `oran()` NaN veriyordu ve testin kendi kalıbı
// `expect('NaN').toBe('NaN')` YEŞİL geçiyordu. Üç atlama noktası bu deliği
// paylaşıyordu (--text-*, --on-*, --ink-* halkaları). Sonuç: `oklch()`,
// `color-mix()`, `rgb()` ya da 3 haneli hex ile yazılmış bir palet bu
// kapıdan HİÇ ÖLÇÜLMEDEN geçerdi — kapı yeşil yanar, kontrast bilinmezdi.
//
// Aynı delik ZEMİN tarafında da vardı: `if (!t[z].startsWith('#')) return;`
// hex olmayan bir yüzeyi ölçmeden ATLIYORDU. Artık zemin de buradan geçiyor.
function hexi(t, anahtar) {
  const v = coz(t, anahtar);
  if (!/^#[0-9a-fA-F]{6}$/.test(v || '')) {
    throw new Error(
      `${t.ad} · --${anahtar}: 6 haneli hex bekleniyordu, gelen "${t[anahtar]}". `
      + 'Kontrast ölçülemez — tema jetonları #rrggbb yazılmalı '
      + '(oklch/color-mix/rgb/3-hane bu kapıdan geçemez).');
  }
  return hex(v);
}

const AA = 4.5;
const ZEMIN = ['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-input'];
const temalar = temalariOku();

describe('tema paleti — metin kontrastı (WCAG AA)', () => {
  // İKİ ZEMİN. Ondokuz tema kaldırıldı; bu sayı bir hedef değil bir ÇAPA —
  // regex kayarsa (blok biçimi değişirse) dizi boşalır ve aşağıdaki bütün
  // halkalar sessizce HİÇ koşmaz. Sayı buradan okunur, sabit yazılmaz.
  test('iki zemin de okunabiliyor', () => {
    expect(temalar.map((t) => t.ad)).toEqual(['acik', 'koyu']);
  });

  temalar.forEach((t) => {
    describe(t.ad, () => {
      // Metin belirteci, konabileceği HER yüzeyde okunmalı — en kötü yüzey
      // hangisiyse ölçüt odur.
      ['text-muted', 'text-secondary', 'text-primary', 'text-heading'].forEach((k) => {
        test(`--${k} her yüzeyde AA`, () => {
          const fg = hexi(t, k);
          ZEMIN.forEach((z) => {
            const r = oran(fg, hexi(t, z));
            expect(`${k} / ${z}: ${r.toFixed(2)}`)
              .toBe(`${k} / ${z}: ${Math.max(r, AA).toFixed(2)}`);
          });
        });
      });

      // Aksan ZEMİN olduğunda üstündeki metin --on-* ile yazılır.
      [['accent-primary', 'on-accent'], ['accent-success', 'on-success'],
        ['accent-warning', 'on-warning'], ['accent-danger', 'on-danger']].forEach(([a, o]) => {
        test(`--${o} → --${a} zemininde AA`, () => {
          const r = oran(hexi(t, o), hexi(t, a));
          expect(`${o}: ${r.toFixed(2)}`).toBe(`${o}: ${Math.max(r, AA).toFixed(2)}`);
        });
      });

      // Aksan METİN olduğunda --ink-* kullanılır.
      [['accent-primary', 'ink-accent'], ['accent-success', 'ink-success'],
        ['accent-warning', 'ink-warning'], ['accent-danger', 'ink-danger']].forEach(([a, i]) => {
        test(`--${i} her yüzeyde AA`, () => {
          const fg = hexi(t, i);
          ZEMIN.forEach((z) => {
            const r = oran(fg, hexi(t, z));
            expect(`${i} / ${z}: ${r.toFixed(2)}`)
              .toBe(`${i} / ${z}: ${Math.max(r, AA).toFixed(2)}`);
          });
        });
      });

      // Üç kademe AYIRT EDİLEBİLİR kalmalı. Yalnız eşiği tutturmak yetmez:
      // muted'ı 4,6'ya çekerken secondary 4,69'da bırakılsaydı iki kademe
      // gözle aynı görünür, hiyerarşi ikiye inerdi.
      // Zeminler de ölçülebilir olmak zorunda: hex olmayan bir yüzey eskiden
      // sessizce ATLANIYORDU, yani o yüzeyin üstündeki hiçbir metin ölçülmemiş
      // oluyordu. Dördü birden hex değilse `Math.min(...[])` = Infinity'ye
      // düşüp kademe testi NaN'a çarpardı — gürültülü ama yanlış adresli.
      test('dört zemin de 6 haneli hex', () => {
        ZEMIN.forEach((z) => { expect(() => hexi(t, z)).not.toThrow(); });
      });

      test('muted < secondary < primary — kademeler ayrışıyor', () => {
        const en = (k) => Math.min(...ZEMIN.map((z) => oran(hexi(t, k), hexi(t, z))));
        const m = en('text-muted'); const s = en('text-secondary'); const p = en('text-primary');
        expect(s / m).toBeGreaterThan(1.15);
        expect(p / s).toBeGreaterThan(1.15);
      });
    });
  });
});

describe('aksan METİN olarak ham kullanılmıyor', () => {
  // Aksan zemin/kenarlık/gösterge olarak serbest (orada 3:1 yeterli), ama
  // METİN rengi olduğunda --ink-* kullanılmalı. Ölçülen kaçaklar: aktif sekme
  // etiketi (slate 3,38:1), bağlamsal şerit sekmesi (pearl 2,63:1), basılı
  // şerit düğmesinin etiketi (vscode 3,4:1), X ekseni listesinde aktif satır.
  const YASAK = /color:\s*var\(--accent-(primary|success|warning|danger)\)/g;

  test('bilinen metin kuralları --ink-* kullanıyor', () => {
    const kural = (sec) => {
      const i = css.indexOf(sec);
      expect(i).toBeGreaterThanOrEqual(0);
      return css.slice(i, css.indexOf('}', i));
    };
    expect(kural('.ve-rb-btn.is-pressed .ve-rb-lbl')).toMatch(/--ink-accent/);
    expect(kural('.ve-rb-tab.contextual{')).toMatch(/--ink-warning/);
    expect(kural('.ve-xaxis-dropdown-item.active')).toMatch(/--ink-accent/);
  });

  // JS'in ürettiği HTML'de satır içi `color:` HER ZAMAN bir yazının (ya da
  // yazı gibi duran ikonun) rengidir — zemin/kenar `background`/`border`
  // olarak ayrı yazılır. ÖLÇÜLEN (Tur 5, 2026-10-02): 138 satır içi
  // `color:var(--accent-*)`; açık temada birincil vurgu --bg-tertiary'de
  // 4,16:1, uyarı vurgusu 3,86:1 kalıyordu (çözücünün zincir adları, şanzıman
  // eşikleri, motor ızgarasının başlığı, takoz uyarısı). Ekran taraması
  // (tests/e2e/kontrast.spec.js) görünen yüzeyleri ölçer; bu kapı açılmamış
  // pencereyi, ipucunu, hata satırını da tutar. Yorum satırı sayılmaz.
  test('JS üretimi HTML\'de metin rengi --ink-*: satır içi color:var(--accent-*) yok', () => {
    const KOK = path.join(__dirname, '../..');
    const dosyalar = [];
    ['js', 'viewer/js', 'candbc/js'].forEach((d) => {
      fs.readdirSync(path.join(KOK, d)).filter((f) => /\.js$/.test(f) && f !== 'fead-core.js')
        .forEach((f) => dosyalar.push(d + '/' + f));
    });
    const METIN = /(?<![-\w])color\s*:\s*var\(--accent-(primary|success|warning|danger)\)/;
    const ATAMA = /\.color\s*=\s*\\?['"]var\(--accent-(primary|success|warning|danger)\)/;
    // `color:' + (koşul ? 'var(--accent-…)' : …) + '` — rengi koşul seçiyor
    const KOSUL = /color:\s*'\s*\+\s*\((?:[^()]|\([^()]*\))*var\(--accent-(primary|success|warning|danger)\)/;
    const bulunan = [];
    dosyalar.forEach((d) => {
      fs.readFileSync(path.join(KOK, d), 'utf8').split('\n').forEach((satir, i) => {
        if (/^\s*(\/\/|\*)/.test(satir)) return;
        if (METIN.test(satir) || ATAMA.test(satir) || KOSUL.test(satir)) bulunan.push(`${d}:${i + 1}`);
      });
    });
    expect(dosyalar.length).toBeGreaterThan(100);       // tarama gerçekten tarıyor
    expect(bulunan).toEqual([]);
  });

  test('JS üretimi HTML\'de yazı rengi temadan: satır içi sabit #renk yok', () => {
    // Sabit renk iki temanın birinde düşer: sensör başlığının #22c55e'si açık
    // panel zemininde (#faf8f4) 2,15:1; çözücü kartının #ef4444'ü kendi
    // --bg-tertiary zemininde 2,89:1.
    // Muaf: indirilen belgenin gövdesi (kâğıt zemini sabit; sınırı ikon
    // kapısıyla AYNI tablodan — `tools/ikon-dili.js` → BELGE · BELGE_DOSYA) ve
    // `// sabit renk: <sebep>` taşıyan satır (Leaflet'in beyaz kutusu gibi
    // zemini de sabit olan yüzey).
    const { yorumsuzJs, belgeMi } = require('../../tools/ikon-dili.js');
    const KOK = path.join(__dirname, '../..');
    const dosyalar = [];
    ['js', 'viewer/js', 'candbc/js'].forEach((d) => {
      fs.readdirSync(path.join(KOK, d)).filter((f) => /\.js$/.test(f) && f !== 'fead-core.js')
        .forEach((f) => dosyalar.push(d + '/' + f));
    });
    const HEX = '#[0-9a-fA-F]{3,6}\\b';
    const DESEN = [
      new RegExp('style=\\\\?"[^"]*?(?<![-\\w])color\\s*:\\s*' + HEX, 'g'),
      new RegExp('\\.color\\s*=\\s*\\\\?[\'"]' + HEX, 'g'),
      // `color:' + (koşul ? '#…' : …) + '` — rengi koşul seçiyor
      new RegExp('color:\\s*\'\\s*\\+\\s*\\((?:[^()]|\\([^()]*\\))*\'' + HEX + '\'', 'g')
    ];
    const bulunan = [];
    dosyalar.forEach((d) => {
      const ham = fs.readFileSync(path.join(KOK, d), 'utf8');
      const s = yorumsuzJs(ham);                         // yorum boşlukla; konumlar korunur
      const belge = belgeMi(d, s, true);
      const hamSatir = ham.split('\n');
      let bas = 0;
      s.split('\n').forEach((satir, i) => {
        if (!/\/\/ sabit renk:/.test(hamSatir[i])) {
          DESEN.forEach((re) => {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(satir))) if (!belge(bas + m.index + m[0].length - 1)) bulunan.push(`${d}:${i + 1}`);
          });
        }
        bas += satir.length + 1;
      });
    });
    expect(dosyalar.length).toBeGreaterThan(100);
    expect([...new Set(bulunan)]).toEqual([]);
  });

  test('sabit yeşil tint temayı izliyor', () => {
    // .ve-xaxis-dropdown-item.active zemini rgba(45,138,90,.10) idi: on altı
    // temanın on beşinde aksanla ilgisi olmayan bir yeşil sızıyordu.
    expect(css).not.toMatch(/rgba\(45,\s*138,\s*90/);
  });
});

// ── Gölge ve tül temayı izler ──────────────────────────────────────────────
// Tema yüzeyindeki sabit siyah gölge iki temada iki ayrı kusur: açıkta jetonun
// dört katı koyu bir leke (ipucunun 0,45'i ↔ --shadow-color 0,10), koyuda
// zemine karışıp kaybolur (Sonuçlar kartının 0,12'si ↔ 0,55). Pencere
// kabuklarının kapısı (source-hygiene → "pencere kabukları jeton konuşur")
// yalnız kabuğa bakıyordu; ipuçları, kartlar, radyo ve sihirbaz kutuları
// dışarıda kalmıştı. Gölge jetondan: --shadow-sm/md/lg/xl/inset ya da
// var(--shadow-color).
// Sabit beyaz tül (`rgba(255,255,255,…)` zemin) aynı kusurun öteki yüzü:
// grafiklerin artı imleci açık temada — varsayılan tema — açık zeminde HİÇ
// görünmüyordu; "en yakın" satırın %4'lük vurgusu iki temada da yoktu.
// Muaf: zemini de sabit olan yüzey — belge gövdesi (kâğıt sabit gri zeminde;
// sınırı ikon kapısıyla AYNI tablodan, `tools/ikon-dili.js` → BELGE_DOSYA),
// `// sabit renk: <sebep>` satırı (harita karosunun üstündeki Leaflet işareti)
// ve oyunlar (kendi dünyasını çiziyor — pencere-ailesi.test.js → OYUN).
describe('gölge ve tül temayı izler', () => {
  const { yorumsuzJs, yorumsuzCss, yorumsuzHtml, belgeMi } = require('../../tools/ikon-dili.js');
  const KOK = path.join(__dirname, '../..');
  const OYUN = ['js/easter-egg.js', 'js/game-2048.js'];
  const SIYAH = /(?:box-shadow\s*:|drop-shadow\()[^;"'}]*?(?:rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]|#000(?:000)?\b|\bblack\b)/g;
  const TUL = /background(?:-color)?\s*:\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,/g;

  function tara() {
    const bulunan = [];
    let taranan = 0;
    const ekle = (d, ham, s, belge) => {
      taranan++;
      const hamSatir = ham.split('\n');
      let bas = 0;
      s.split('\n').forEach((satir, i) => {
        if (!/\/\/ sabit renk:/.test(hamSatir[i])) {
          for (const re of [SIYAH, TUL]) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(satir))) if (!belge(bas + m.index)) bulunan.push(`${d}:${i + 1}`);
          }
        }
        bas += satir.length + 1;
      });
    };
    ['js', 'viewer/js', 'candbc/js'].forEach((dz) => {
      fs.readdirSync(path.join(KOK, dz)).filter((f) => /\.js$/.test(f) && f !== 'fead-core.js')
        .forEach((f) => {
          const d = dz + '/' + f;
          if (OYUN.includes(d)) return;
          const ham = fs.readFileSync(path.join(KOK, d), 'utf8');
          const s = yorumsuzJs(ham);
          ekle(d, ham, s, belgeMi(d, s, true));
        });
    });
    fs.readdirSync(path.join(KOK, 'css')).filter((f) => /\.css$/.test(f)).forEach((f) => {
      const ham = fs.readFileSync(path.join(KOK, 'css', f), 'utf8');
      ekle('css/' + f, ham, yorumsuzCss(ham), () => false);
    });
    ['index.html', 'viewer/index.html', 'candbc/index.html'].forEach((d) => {
      const ham = fs.readFileSync(path.join(KOK, d), 'utf8');
      ekle(d, ham, yorumsuzCss(yorumsuzHtml(ham)), () => false);
    });
    return { bulunan: [...new Set(bulunan)], taranan };
  }

  test('box-shadow sabit siyah, zemin sabit beyaz tül taşımıyor — tema yüzeyinde jetondan', () => {
    const { bulunan, taranan } = tara();
    expect(taranan).toBeGreaterThan(100);              // tarama gerçekten tarıyor
    expect(bulunan).toEqual([]);
  });

  test('desen gerçekten yakalıyor — kapı boşa taramıyor', () => {
    const yakala = (s) => [SIYAH, TUL].some((re) => { re.lastIndex = 0; return re.test(s); });
    expect(yakala('box-shadow:0 4px 16px rgba(0,0,0,0.45);')).toBe(true);
    expect(yakala('box-shadow:0 0 0 1px var(--accent-success), 0 2px 8px rgba(0,0,0,.14);')).toBe(true);
    expect(yakala('box-shadow:inset 0 1px 4px rgba(0, 0, 0, 0.35)')).toBe(true);
    expect(yakala('filter:drop-shadow(0 2px 3px #000)')).toBe(true);
    expect(yakala('box-shadow:var(--shadow-lg);')).toBe(false);
    expect(yakala('box-shadow:0 2px 8px var(--shadow-color);')).toBe(false);
    expect(yakala('box-shadow:0 0 0 6px rgba(201,162,75,.35)')).toBe(false);   // siyah değil
    expect(yakala('--shadow-color: rgba(0, 0, 0, 0.55);')).toBe(false);          // jetonun tanımı
    expect(yakala('width:1px; background:rgba(255,255,255,0.14); pointer-events:none;')).toBe(true);
    expect(yakala('background:var(--border-hover);')).toBe(false);
    // Jetonlar tema farkında: koyu temanın gölgesi açığınkinden koyu.
    const renk = [...css.matchAll(/--shadow-color:\s*rgba\(([^)]*)\)/g)].map((m) => Number(m[1].split(',')[3]));
    expect(renk.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...renk)).toBeGreaterThan(Math.min(...renk) * 3);
  });
});

// ── Kenar tonu zeminden AYRIŞIR (2026-09-25) ──────────────────────────────
// Kullanıcı: "programın dokusunda bir bulanıklık var." Kenar çizgisi tuvale
// karşı 1,22:1, panele karşı 1,34:1'di; panel ile tuvalin kendisi 1,10:1 —
// kenar seçilmeyince göz bütün yüzeyleri tek bir soluk alan olarak okuyordu.
// Kullanıcı iki tonu kendi ekranında karşılaştırdı ve koyusunu seçti
// (1,56:1). Taban o seçimin altı: 1,5. Hover dinlenmedekinden belirgin kalmalı,
// yoksa "üstüne geldim" hiçbir şey demez.
const KENAR_TABAN = 1.5;
describe('tema paleti — kenar tonu zeminden ayrışır', () => {
  temalar.forEach((t) => {
    test(`${t.ad}: --border-color tuvale ve panele karşı ≥ ${KENAR_TABAN}:1`, () => {
      ['bg-primary', 'bg-secondary'].forEach((z) => {
        const r = oran(hexi(t, 'border-color'), hexi(t, z));
        expect(`border-color / ${z}: ${r.toFixed(2)}`)
          .toBe(`border-color / ${z}: ${Math.max(r, KENAR_TABAN).toFixed(2)}`);
      });
    });
    test(`${t.ad}: hover kenarı dinlenmedekinden belirgin (×1,2)`, () => {
      const dinlen = oran(hexi(t, 'border-color'), hexi(t, 'bg-primary'));
      const hover = oran(hexi(t, 'border-hover'), hexi(t, 'bg-primary'));
      expect(hover).toBeGreaterThan(dinlen * 1.2);
    });
  });
});
