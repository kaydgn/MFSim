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

const AA = 4.5;
const ZEMIN = ['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-input'];
const temalar = temalariOku();

describe('tema paleti — metin kontrastı (WCAG AA)', () => {
  test('on altı tema da okunabiliyor', () => {
    expect(temalar).toHaveLength(16);
  });

  temalar.forEach((t) => {
    describe(t.ad, () => {
      // Metin belirteci, konabileceği HER yüzeyde okunmalı — en kötü yüzey
      // hangisiyse ölçüt odur.
      ['text-muted', 'text-secondary', 'text-primary', 'text-heading'].forEach((k) => {
        test(`--${k} her yüzeyde AA`, () => {
          const fg = hex(coz(t, k));
          ZEMIN.forEach((z) => {
            if (!t[z] || !t[z].startsWith('#')) return;
            const r = oran(fg, hex(t[z]));
            expect(`${k} / ${z}: ${r.toFixed(2)}`)
              .toBe(`${k} / ${z}: ${Math.max(r, AA).toFixed(2)}`);
          });
        });
      });

      // Aksan ZEMİN olduğunda üstündeki metin --on-* ile yazılır.
      [['accent-primary', 'on-accent'], ['accent-success', 'on-success'],
        ['accent-warning', 'on-warning'], ['accent-danger', 'on-danger']].forEach(([a, o]) => {
        test(`--${o} → --${a} zemininde AA`, () => {
          const r = oran(hex(coz(t, o)), hex(t[a]));
          expect(`${o}: ${r.toFixed(2)}`).toBe(`${o}: ${Math.max(r, AA).toFixed(2)}`);
        });
      });

      // Aksan METİN olduğunda --ink-* kullanılır.
      [['accent-primary', 'ink-accent'], ['accent-success', 'ink-success'],
        ['accent-warning', 'ink-warning'], ['accent-danger', 'ink-danger']].forEach(([a, i]) => {
        test(`--${i} her yüzeyde AA`, () => {
          const fg = hex(coz(t, i));
          ZEMIN.forEach((z) => {
            if (!t[z] || !t[z].startsWith('#')) return;
            const r = oran(fg, hex(t[z]));
            expect(`${i} / ${z}: ${r.toFixed(2)}`)
              .toBe(`${i} / ${z}: ${Math.max(r, AA).toFixed(2)}`);
          });
        });
      });

      // Üç kademe AYIRT EDİLEBİLİR kalmalı. Yalnız eşiği tutturmak yetmez:
      // muted'ı 4,6'ya çekerken secondary 4,69'da bırakılsaydı iki kademe
      // gözle aynı görünür, hiyerarşi ikiye inerdi.
      test('muted < secondary < primary — kademeler ayrışıyor', () => {
        const en = (k) => Math.min(...ZEMIN
          .filter((z) => t[z] && t[z].startsWith('#'))
          .map((z) => oran(hex(coz(t, k)), hex(t[z]))));
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

  test('sabit yeşil tint temayı izliyor', () => {
    // .ve-xaxis-dropdown-item.active zemini rgba(45,138,90,.10) idi: on altı
    // temanın on beşinde aksanla ilgisi olmayan bir yeşil sızıyordu.
    expect(css).not.toMatch(/rgba\(45,\s*138,\s*90/);
  });
});
