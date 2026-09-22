/**
 * belge-paleti.test.js
 * ────────────────────
 * DIŞA ÇIKAN BELGELER EKRANLA AYNI DİLİ KONUŞUYOR MU?
 *
 * Rapor ve kılavuz, uygulamanın stil sayfasını KULLANAMAZ: indirilen dosya tek
 * başına açılıyor ve `var(--accent-primary)` orada tanımsız. Bu yüzden her
 * belge üreticisi renkleri SABİT yazıyor — ve tam bu yüzden sessizce bayatlar.
 *
 * ÖLÇÜLEN KUSUR (2026-09-22): üç belge paleti de 2024'ün soğuk baskı
 * kimliğindeydi (prusya mavisi #24425f, soğuk kurşun #1b1e24, soğuk gri
 * #c9cdd3). Ekran Atölye'ye geçmişti; indirilen rapor geçmemişti. Hiçbir test
 * bakmıyordu — kullanıcı ancak bir rapor ÜRETİP açtığında görürdü.
 *
 * KÂĞIT BEYAZ KALIR. Atölye'nin açık zemini bej (#f0ede7) ama o bir EKRAN
 * zeminidir; kâğıda bej basmak bej mürekkep harcamak olurdu. Bağlanan şey
 * MÜREKKEPTİR: belge aksanı ekranın `--ink-*` jetonlarıyla birebir — o jetonlar
 * zaten "aksanı METİN olarak kullan" için ölçülmüş değerler.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const STYLES = read('css/styles.css');

// Uygulamanın VARSAYILAN kimliğinin jetonları
function varsayilanJetonlar() {
  const id = (STYLES.match(/:root,\s*\[data-theme="([\w-]+)"\]\s*\{/) || [])[1];
  const re = new RegExp('\\[data-theme="' + id + '"\\][^{]*\\{([^}]*)\\}', 'g');
  for (const m of STYLES.matchAll(re)) {
    if (!/--bg-primary\s*:/.test(m[1])) continue;
    const t = {};
    let x;
    const r2 = /--([\w-]+):\s*([^;]+);/g;
    while ((x = r2.exec(m[1])) !== null) t[x[1]] = x[2].trim().toLowerCase();
    return t;
  }
  return {};
}
const APP = varsayilanJetonlar();

// Belge jetonu → ekranın hangi jetonundan geliyor.
// Yalnız MÜREKKEP bağlanır; kâğıt ve soluk zeminler belgenin kendi işi.
const BAG = {
  '--ink': 'text-primary',
  '--vurgu': 'ink-accent',
  '--check': 'ink-success',
  '--warn': 'ink-warning',
};

// Belgelerin palet bildirimini taşıyan kaynaklar. Üretilen şablonlar
// (js/*-report-template.js) BURADA YOK — onlar bu kaynaklardan derleniyor ve
// tazelikleri kendi kapılarında.
const KAYNAKLAR = [
  'tools/report-assets/theory-source.html',
  'tools/report-assets/fead-theory-source.html',
  'js/cp-fead-summary.js',
  'js/results.js',          // Sonuçlar'ın TASARIMLI rapor kabuğu — dördüncü palet
];

function jetonDegeri(metin, ad) {
  const m = new RegExp(ad + '\\s*:\\s*(#[0-9a-fA-F]{3,8})').exec(metin);
  return m ? m[1].toLowerCase() : null;
}

describe('dışa çıkan belgelerin paleti ekranla bağlı', () => {
  test('ekranın varsayılan jetonları okunabildi (regex kayması erken yakalansın)', () => {
    expect(Object.keys(APP).length).toBeGreaterThan(20);
    Object.values(BAG).forEach((j) => expect(APP[j]).toMatch(/^#[0-9a-f]{6}$/));
  });

  KAYNAKLAR.forEach((f) => {
    test(`${f} — mürekkep ekranın --ink-* jetonlarıyla BİREBİR`, () => {
      const metin = read(f);
      const sapan = [];
      Object.keys(BAG).forEach((belge) => {
        const v = jetonDegeri(metin, belge);
        if (v === null) return;                   // bu belge o jetonu tanımlamıyor
        const bek = APP[BAG[belge]];
        if (v !== bek) sapan.push(`${belge}: ${v} ≠ --${BAG[belge]} (${bek})`);
      });
      expect(sapan).toEqual([]);
    });
  });

  // ADI YALAN OLAN JETON KALMADI: renk artık prusya mavisi değil.
  test('emekli `--prusya` adı hiçbir yerde kalmadı', () => {
    const kalan = [];
    ['js', 'tools/report-assets', 'tests/unit'].forEach((dir) => {
      const tam = path.join(ROOT, dir);
      fs.readdirSync(tam).forEach((f) => {
        const p = path.join(tam, f);
        if (!fs.statSync(p).isFile()) return;
        if (!/\.(js|html)$/.test(f)) return;
        if (p === __filename) return;   // kapının kendi yorumundaki ÖRNEKLER

        const s = fs.readFileSync(p, 'utf8');
        // KULLANIM aranır, ANMA değil: `var(--prusya)` ya da `--prusya:`.
        // Emekli adı bir yorumda anmak bu deponun istediği şeydir — kapı onu
        // kusur saysaydı kaydın kendisi silinmek zorunda kalırdı.
        if (/var\(\s*--prusya\b|--prusya(-soft)?\s*:/.test(s)) kalan.push(dir + '/' + f);
      });
    });
    expect(kalan).toEqual([]);
  });

  // KÂĞIT BEJ OLMADI — kural, gözlem değil.
  test('kâğıt beyaz kaldı (ekran zemini kâğıda taşınmadı)', () => {
    KAYNAKLAR.forEach((f) => {
      const v = jetonDegeri(read(f), '--paper');
      if (v === null) return;
      expect(v).toMatch(/^#(fff|ffffff|fdfdfb)$/);
      expect(v).not.toBe(APP['bg-primary']);
    });
  });
});

// BAĞLAMANIN KAZANCI: `--ink-*` jetonları ekranda DÖRT yüzeye karşı AA'ya
// zorlanıyor (theme-contrast.test.js) ve o yüzeylerden biri saf beyaz
// (--bg-input #ffffff). Kâğıt da beyaz olduğu için belge mürekkebi kontrast
// garantisini EKRANDAN MİRAS ALIYOR — ikinci bir aritmetik tutmaya gerek yok.
// Bu halka o mirasın gerçekten kurulduğunu ölçer: bağ koparsa (belge kendi
// rengini yazarsa) garanti de sessizce kopar.
describe('belge mürekkebi kontrast garantisini ekrandan miras alıyor', () => {
  const KAGIT = '#fdfdfb';
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const oran = (a, b) => {
    const L1 = lum(hex(a)); const L2 = lum(hex(b));
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  };

  test('ekranın --bg-input gerçekten beyaz (mirasın dayandığı varsayım)', () => {
    expect(APP['bg-input']).toBe('#ffffff');
  });

  test('her mürekkep jetonu kâğıt üzerinde AA', () => {
    const dusen = Object.keys(BAG)
      .map((belge) => ({ belge, r: oran(APP[BAG[belge]], KAGIT) }))
      .filter((x) => x.r < 4.5)
      .map((x) => `${x.belge}: ${x.r.toFixed(2)}`);
    expect(dusen).toEqual([]);
  });
});
