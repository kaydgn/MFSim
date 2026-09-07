/**
 * Örnek topolojiler ↔ gömülü takoz kütüphanesi tutarlılığı
 * ────────────────────────────────────────────────────────
 * ÖLÇÜLDÜ (Tulga örneği, 2026-09-07): `Sağ/Sol Ön Takoz` düğümleri TK040
 * (57RS329001M) takozunu taşıyor ve STATİK üçlüsü katalogla birebir aynıydı
 * (515/260/242) — ama DİNAMİK üçlüsü X ile Z yer değişmiş girilmişti:
 *
 *     katalog : dx 740  dy 355  dz 335
 *     örnekte : dx 335  dy 355  dz 740      ← X ↔ Z takas
 *
 * NEDEN SESSİZ KALDI: statik çözüm yalnız k_stat kullanır, dolayısıyla 14 yük
 * durumunun 210 çökme değerinin HİÇBİRİ değişmiyordu (ölçüldü: fark tam 0).
 * Hata yalnız k_dyn'in girdiği yerde görünür — modal frekanslar, frekans yanıtı,
 * sönüm katsayıları ve şok çözümü. Yani "çökme tablosu doğru" diye bakan bir
 * gözden tamamen kaçıyordu.
 *
 * İKİ KAPI:
 *   1. TAM EŞLEŞME — bir örnek takozunun statik üçlüsü kütüphanede TEK bir
 *      girdiyle eşleşiyorsa, dinamik üçlüsü de o girdininki olmak ZORUNDA.
 *      Takozun hangi katalog kaydı olduğu statikten belli; dinamiğin başka bir
 *      şey olması bir giriş hatasıdır.
 *   2. ORAN YAYILIMI — kütüphanedeki HER girdi ve her örnek takozu için, üç
 *      eksenin dinamik/statik oranları birbirine yakın olmalı. Dinamik büyütme
 *      çarpanı malzeme (sertlik) özelliğidir, eksen özelliği değil.
 *      Ölçüldü: 27 katalog girdisinin en kötü yayılımı 1,117. Takaslı TK040
 *      ise 4,701 verirdi. Eşik 1,5 — gerçek en kötüden %34 pay, hatadan 3 kat
 *      uzak. Bu kapı kütüphanede OLMAYAN takozlarda da çalışır.
 */

const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; });

const LIB = cp.veMntGetLibraryMap();
const EX_DIR = path.join(__dirname, '../../assets/examples');
const FILES = fs.readdirSync(EX_DIR).filter((f) => /_topoloji\.json$/.test(f));

// Örnek dosyalarındaki takoz düğümleri: { dosya, ad, s:[3], d:[3] }
function exampleMounts() {
  const out = [];
  FILES.forEach((f) => {
    const doc = JSON.parse(fs.readFileSync(path.join(EX_DIR, f), 'utf8'));
    (doc.nodes || []).filter((n) => n.type === 'mnt-mount').forEach((n) => {
      const m = n.data || {}, num = (v) => (v === undefined || v === '' ? NaN : Number(v));
      out.push({ file: f, name: n.customName || n.id,
                 s: [num(m.kxs), num(m.kys), num(m.kzs)],
                 d: [num(m.kxd), num(m.kyd), num(m.kzd)] });
    });
  });
  return out;
}
// Kayıt defterindeki (js/mount-core.js → MOUNT_EXAMPLES) AYNI modeller. Tulga
// modeli İKİ dosyada yaşıyor ve bu hata ikisinde birden vardı: JSON düzeltilip
// kayıt defteri unutulursa panel bir modeli okur, "Örneği Aktar" başkasını kurar
// (o ayrışmanın kapısı cp-mount.test.js'te; burası ikisini de KATALOGLA tutar).
function registryMounts() {
  const out = [];
  const EX = core.MOUNT_EXAMPLES || {};
  Object.keys(EX).forEach((k) => {
    ((EX[k].model || {}).mounts || []).forEach((m) => {
      out.push({ file: 'MOUNT_EXAMPLES.' + k, name: m.name,
                 s: m.kstat.slice(), d: m.kdyn.slice() });
    });
  });
  return out;
}
const MOUNTS = exampleMounts().concat(registryMounts());
const spread = (s, d) => {
  const r = [0, 1, 2].map((i) => d[i] / s[i]);
  return Math.max(...r) / Math.min(...r);
};

test('örnek dosyaları ve kütüphane gerçekten okunuyor (kapı boşa düşmesin)', () => {
  expect(FILES.length).toBeGreaterThanOrEqual(3);
  expect(MOUNTS.length).toBeGreaterThanOrEqual(30);   // JSON + kayıt defteri
  expect(Object.keys(LIB).length).toBeGreaterThanOrEqual(20);
  MOUNTS.forEach((m) => m.s.concat(m.d).forEach((v) => expect(Number.isFinite(v)).toBe(true)));
});

describe('kapı 1 — statik üçlü katalogla eşleşiyorsa dinamik de eşleşmeli', () => {
  test('her örnek takozu kendi katalog kaydının dinamik değerlerini taşıyor', () => {
    const bad = [];
    let matched = 0;
    MOUNTS.forEach((m) => {
      const hits = Object.keys(LIB).filter((k) => {
        const e = LIB[k];
        return e.sx === m.s[0] && e.sy === m.s[1] && e.sz === m.s[2];
      });
      if (hits.length !== 1) return;                  // kütüphanede yok ya da belirsiz → kapı 2'ye kalır
      matched++;
      const e = LIB[hits[0]];
      const want = [e.dx, e.dy, e.dz];
      if (want.some((v, i) => v !== m.d[i])) {
        const swapped = m.d[0] === want[2] && m.d[1] === want[1] && m.d[2] === want[0];
        bad.push(`${m.file} · ${m.name} → ${e.name}: katalog dyn=[${want}] ama örnekte [${m.d}]` +
                 (swapped ? '  (X ↔ Z TAKAS)' : ''));
      }
    });
    expect(matched).toBeGreaterThanOrEqual(30);       // kapının gerçekten iş gördüğü
    expect(bad).toEqual([]);
  });
});

describe('kapı 2 — dinamik/statik oranı eksene göre değişemez', () => {
  const LIMIT = 1.5;

  test('kütüphanenin her girdisi eşiğin altında', () => {
    const bad = [];
    Object.keys(LIB).forEach((k) => {
      const e = LIB[k];
      if (!(e.sx > 0 && e.sy > 0 && e.sz > 0)) return;   // 'Yeni Takoz' gibi boş şablon
      const sp = spread([e.sx, e.sy, e.sz], [e.dx, e.dy, e.dz]);
      if (sp > LIMIT) bad.push(`${e.name}: yayılım ${sp.toFixed(3)}`);
    });
    expect(bad).toEqual([]);
  });

  test('her örnek takozu eşiğin altında', () => {
    const bad = [];
    MOUNTS.forEach((m) => {
      const sp = spread(m.s, m.d);
      if (sp > LIMIT) bad.push(`${m.file} · ${m.name}: yayılım ${sp.toFixed(3)} ` +
        `(oranlar ${[0, 1, 2].map((i) => (m.d[i] / m.s[i]).toFixed(3)).join(' ')})`);
    });
    expect(bad).toEqual([]);
  });

  test('eşik gerçek en kötü katalog girdisinin ÜSTÜNDE ama takası yakalar', () => {
    // Eşiği ne körelmiş ne de kırılgan tutan çivi: gerçek veriyle hata arasında.
    const worst = Math.max(...Object.keys(LIB).map((k) => {
      const e = LIB[k];
      return (e.sx > 0 && e.sy > 0 && e.sz > 0) ? spread([e.sx, e.sy, e.sz], [e.dx, e.dy, e.dz]) : 0;
    }));
    expect(worst).toBeLessThan(LIMIT);
    const tk = LIB.TK040;
    expect(spread([tk.sx, tk.sy, tk.sz], [tk.dz, tk.dy, tk.dx])).toBeGreaterThan(LIMIT * 2);
  });
});

describe('TK040 — düzeltilen kaydın kendisi', () => {
  test('katalog: dx 740 · dy 355 · dz 335 (MLMT-0216-33-TK040)', () => {
    const e = LIB.TK040;
    expect([e.sx, e.sy, e.sz]).toEqual([515, 260, 242]);
    expect([e.dx, e.dy, e.dz]).toEqual([740, 355, 335]);
    // dinamik rijitlik hiçbir eksende statiğin altına düşmez (elastomer)
    expect(e.dx).toBeGreaterThanOrEqual(e.sx);
    expect(e.dz).toBeGreaterThanOrEqual(e.sz);
  });

  test('Tulga örneğindeki iki TK040 takozu katalogla aynı', () => {
    const t = MOUNTS.filter((m) => m.file === 'tulga_topoloji.json' &&
      m.s[0] === 515 && m.s[1] === 260 && m.s[2] === 242);
    expect(t.length).toBe(2);
    t.forEach((m) => expect(m.d).toEqual([740, 355, 335]));
  });
});
