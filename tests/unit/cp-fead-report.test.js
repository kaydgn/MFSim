/**
 * cp-fead-report.test.js — FEAD ÇEVRİMDIŞI RAPOR ÜRETECİ (js/cp-fead-report.js)
 *
 * Rapor, çözücünün sayılarını kullanıcıya TESLİM eden belgedir: bir birim
 * hatası ya da bir "undefined" burada sessizce doğru görünür. Bu yüzden
 * testler etiket saymıyor, ÜRETİLEN SAYIYI ve HÜKMÜ ölçüyor.
 *
 * Kapsam ayrımı:
 *   fead-core.test.js    çekirdek doğru mu (17 Gates raporu, 2095 değer)
 *   fead-model.test.js   köprü çekirdeğe doğru veriyi mi veriyor
 *   cp-fead.test.js      panel/kanvas sunum sözleşmesi
 *   BU DOSYA             raporun İÇERİĞİ: birim, tutarlılık, sessiz yalan yok
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const RP = require('../../js/cp-fead-report.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
// Yerleşim şekli üreteci sunum katmanında; rapor onu YENİDEN YAZMAZ, çağırır.
const CP = require('../../js/cp-fead.js');
Object.keys(CP).forEach((k) => { if (global[k] === undefined) global[k] = CP[k]; });

// ── BMC tedarikçi örneğinden gerçek bir çözüm ──────────────────────────────
function coz(opts) {
  opts = opts || {};
  const pack = veFeadExampleNodes('BMC_FEAD_2026');
  const ns = pack.nodes.map((n) => ({
    id: n.id, type: n.type, def: componentDefs[n.type],
    customName: n.customName, data: JSON.parse(JSON.stringify(n.data))
  }));
  if (opts.mutate) opts.mutate(ns);
  const build = veFeadBuildSystem(ns, pack.connections);
  const solv = ns.filter((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver)[0];
  const R = veFeadAnalyze(build, {
    rows: veFeadDutyRows(solv), cylinders: 6, fatigueModel: 'PK-2_2p-MT3'
  });
  R.build = build;
  R.pulleyNames = build.names;
  R.serviceFact = (solv && solv.data && Number(solv.data.serviceFact)) || 0;
  return R;
}
const NODE = { id: 'rep1', type: 'fead-report', data: {} };

let R8 = null, HTML8 = '', HTMLU = '';
beforeAll(() => {
  R8 = coz();
  HTML8 = RP._frSection8(R8, NODE);
  HTMLU = RP._frCompliance(R8);
});
beforeEach(() => resetStubs(stubs));

// ═══════════════════════════════════════════════════════════════════════════
describe('sayı biçimi — Türkçe ve dürüst', () => {
  test('ondalık virgül, gereksiz sıfır kırpılır', () => {
    expect(RP._frF(20.000, 3)).toBe('20');
    expect(RP._frF(1521.7, 1)).toBe('1521,7');
    expect(RP._frFs(1521.7, 2)).toBe('1521,70');
  });

  // Boş hücre "sıfır" gibi okunur; '—' okunmaz.
  test('geçersiz değer — em dash, sıfır DEĞİL', () => {
    expect(RP._frF(NaN)).toBe('—');
    expect(RP._frF(undefined)).toBe('—');
    expect(RP._frF(null)).toBe('—');
    expect(RP._frF(0)).toBe('0');
  });

  // ASCII '-' ile gerçek eksi (U+2212) dizgide farklı görünür.
  test('eksi işareti GERÇEK eksi; −0 üretilmez', () => {
    expect(RP._frF(-3.5, 1)).toBe('−3,5');
    expect(RP._frF(-0.0004, 2)).toBe('0');
    expect(RP._frF(-3.5, 1).charCodeAt(0)).toBe(0x2212);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('§8 — girdi tabloları', () => {
  test('bölüm ve alt bölümler üretiliyor', () => {
    expect(HTML8).toContain('id="s8"');
    ['8.1', '8.2', '8.3', '8.4', '8.6', '8.7', '8.8', '8.10', '8.11', '8.12', '8.13', '8.14', '8.15', '8.16', '8.17']
      .forEach((n) => expect(HTML8).toContain(n + ' '));
  });

  // BİRİM TUZAĞI: wearPct çekirdekte ORAN (0,007), tedarikçi sayfasında %0,70.
  // Ham basılsaydı okuyan kişi payı yüz kat küçük sanırdı.
  test('aşınma payı ORAN → YÜZDE çevrilerek basılır', () => {
    const R = coz({ mutate: (ns) => {
      const b = ns.filter((n) => n.type === 'fead-belt')[0];
      b.data.wearPct = 0.007; b.data.tolerance = 6;
    } });
    const h = RP._frSection8(R, NODE);
    expect(h).toContain('%0,70');
    expect(h).not.toContain('%0,007');
  });

  test('kasnak tablosu dış çapı ve temas tarafını SİSTEMDEN basıyor', () => {
    const sys = R8.build.sys;
    sys.pulleys.forEach((p) => {
      expect(HTML8).toContain(RP._frEsc(p.name));
    });
    // BMC: Ø162 krank, Ø152 klima, Ø57 alternatör
    expect(HTML8).toContain('162,0');
    expect(HTML8).toContain('152,0');
    expect(HTML8).toContain('57,0');
    expect(HTML8).toContain('sırt');
    expect(HTML8).toContain('kaburgalı');
  });

  test('sürücü kasnağın kW sütunu duty tablosunda YOK (çevrim kapanışı)', () => {
    const surucu = R8.build.sys.pulleys.filter((p) => p.crank)[0].name;
    const i = HTML8.indexOf('Çalışma çevrimi (duty cycle) girdisi');
    const j = HTML8.indexOf('</table>', i);
    const blok = HTML8.slice(i, j);
    expect(blok).toContain('Σ (sürücü)');
    expect(blok.indexOf('<th>' + surucu + '</th>')).toBe(-1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('§8 — çözüm sayıları', () => {
  // geom.wraps RADYAN, wrapDeg DERECE. Karıştırılırsa 154° yerine 2,7 basılır.
  test('sarım açıları DERECE olarak basılıyor', () => {
    const g = R8.analysis.geometry;
    const toplam = g.reduce((a, r) => a + r.wrapDeg, 0);
    expect(toplam).toBeGreaterThan(300);          // radyan olsaydı ~10
    g.forEach((r) => expect(HTML8).toContain(RP._frFs(r.wrapDeg, 2)));
  });

  test('kapalı çevrim değişmezi 360° olarak basılıyor', () => {
    expect(HTML8).toMatch(/Σ işaretli\s*=\s*360,00°/);
  });

  test('boy özdeşliği L_pitch − L_eff = 2πh_b denetimi basılıyor ve TUTUYOR', () => {
    expect(HTML8).toContain('tutuyor');
    const bp = F.beltProps(R8.build.sys.belt);
    expect(HTML8).toContain(RP._frFs(2 * Math.PI * bp.hb, 4));
  });

  test('span boyları çözümle aynı', () => {
    R8.analysis.geometry.forEach((r) => {
      expect(HTML8).toContain(RP._frFs(r.exitSpanMm, 1));
    });
  });

  test('gerginlik zinciri: her duty satırı için giriş/çıkış gerginlikleri basılı', () => {
    R8.analysis.duty.forEach((d) => {
      d.perPulley.forEach((q) => {
        expect(HTML8).toContain(RP._frF(q.exitTensionN, 0));
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('§8.8 — gergi konum tablosu', () => {
  // Etiketler model katmanının sözlüğünden gelir (VE_FEAD_POSITIONS); rapor
  // kendi sözlüğünü tutsaydı panelle ayrışırdı.
  test('çözümdeki her konum, MODELİN etiketiyle sütun oluyor', () => {
    const etiket = {};
    VE_FEAD_POSITIONS.forEach((p) => { etiket[p.core] = p.label; });
    expect(R8.analysis.positions.length).toBeGreaterThanOrEqual(5);
    R8.analysis.positions.forEach((p) => {
      expect(etiket[p.position]).toBeTruthy();
      expect(HTML8).toContain(etiket[p.position]);
    });
    expect(HTML8).toContain('Çalışma (Mean)');
  });

  // Çözülemeyen konum SATIRI GİZLENMEZ: sütun kalır, hücre "Err." olur ve
  // sebep dipnotta yazar. Gizlenseydi kullanıcı eksik sütunu fark etmezdi.
  test('çözülemeyen konum Err. ile işaretlenir, sebebi yazılır', () => {
    const hatali = R8.analysis.positions.filter((p) => p.error);
    if (hatali.length) {
      expect(HTML8).toContain('Err.');
      expect(HTML8).toContain('Çözülemeyen konum');
    } else {
      expect(HTML8).not.toContain('Err.');
    }
  });

  test('tolerans ve aşınma 0 iken zarfın daraldığı DİPNOTLA yazılır', () => {
    // BMC örneğinde ikisi de 0 → dört orta konum aynı açıya oturuyor.
    expect(R8.build.sys.belt.tolerance).toBe(0);
    expect(HTML8).toContain('Zarf daralmış');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('dürüstlük kapıları', () => {
  // ribFatigueDistribution().note her zaman undefined; rapora sızarsa
  // belgede "undefined" dizesi görünür.
  test('hiçbir yerde "undefined" / "NaN" / "[object" sızmıyor', () => {
    [HTML8, HTMLU].forEach((h) => {
      expect(h).not.toMatch(/undefined/);
      expect(h).not.toMatch(/\bNaN\b/);
      expect(h).not.toMatch(/\[object /);
    });
  });

  // Ortalama torku "Peak" diye basmak, olmayan bir analizi varmış gibi gösterir.
  test('tork bölümü ORTALAMA diyor, "tepe/peak" demiyor', () => {
    expect(HTML8).toContain('Aksesuar mil torku (ortalama)');
    // Çıpa BAŞLIK METNİ — ham "8.13" araması SVG yol koordinatına düşüyor.
    const i = HTML8.indexOf('8.13 Aksesuar mil torku');
    expect(i).toBeGreaterThan(0);
    const blok = HTML8.slice(i, i + 1400);
    expect(blok).not.toMatch(/\bpeak\b/i);
    expect(blok).toContain('yoktur');
  });

  // Açıklık frekansı ile sistem burulma modu ayrı büyüklükler.
  test('frekans bölümü sistem burulma modunun YOK olduğunu yazıyor', () => {
    expect(HTML8).toContain('Sistem burulma frekansı DEĞİL');
    expect(HTML8).toContain('§9.2');
  });

  test('B10 geçerlilik penceresi dışındaysa açıkça uyarılıyor', () => {
    expect(R8.life.inValidRange).toBe(false);      // BMC: alternatör Ø57
    expect(HTML8).toContain('geçerlilik penceresinin dışında');
    expect(HTML8).toContain('bağımsız olarak geçerlidir');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('uygunluk hükmü', () => {
  test('on kriter ve hüküm kutusu üretiliyor', () => {
    expect(HTMLU).toContain('id="uygunluk"');
    expect(HTMLU).toContain('Genel hüküm');
    const satir = (HTMLU.match(/<tr><td class="c">\d+<\/td>/g) || []).length;
    expect(satir).toBeGreaterThanOrEqual(10);
  });

  test('kapalı çevrim kriteri UYGUN çıkıyor', () => {
    expect(HTMLU).toContain('Kapalı çevrim değişmezi');
    expect(HTMLU).toContain('✓ Uygun');
  });

  // "Değerlendirilemedi" uygunluk SAYILMAZ — gizlenirse eksik girdi
  // sessizce "geçti" gibi okunur.
  test('değerlendirilemeyen kriter gizlenmiyor', () => {
    const R = coz({ mutate: (ns) => {
      const t = ns.filter((n) => n.type === 'fead-tensioner')[0];
      delete t.data.cenX; delete t.data.cenY; t.data.angleMode = 'direct'; t.data.freeAngleDeg = 25;
    } });
    const h = RP._frCompliance(R);
    expect(h).toContain('değerlendirilemedi');
    expect(h).toContain('montaj merkezi girilmedi');
  });

  test('servis faktörü hükümde kullanılıyor (sabit 1,3 değil)', () => {
    const R = coz({ mutate: (ns) => {
      const s = ns.filter((n) => n.type === 'fead-solver')[0];
      s.data.serviceFact = 9.9;                    // ulaşılamaz eşik
    } });
    const h = RP._frCompliance(R);
    expect(h).toContain('SF ≥ 9,9');
    expect(h).toContain('✗ Kontrol');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('şekiller', () => {
  test('yerleşim şekli kayış yolu kartından geliyor (kendi geometrisini yazmıyor)', () => {
    expect(HTML8).toContain('data-ve="belt"');
    expect(HTML8).toContain('<figcaption>');
  });

  test('gerginlik kontrol, take-up, kayma ve yorulma şekilleri var', () => {
    ['data-ve="tension-curve"', 'data-ve="takeup-curve"', 'data-ve="sf-bar"', 'data-ve="fatigue-bar"']
      .forEach((h) => expect(HTML8).toContain(h));
  });

  // Grafik ekseni ters çizilirse eğri aynalanır ama testler yeşil kalır.
  // Konum çizgisinin X'i, eğrinin o rel değerindeki X'iyle AYNI olmalı.
  test('konum çizgileri eğriyle AYNI X ekseninde', () => {
    const i = HTML8.indexOf('data-ve="tension-curve"');
    const j = HTML8.indexOf('</figure>', i);
    const blok = HTML8.slice(i, j);
    const egri = /<path d="M([\d.]+) /.exec(blok);
    expect(egri).toBeTruthy();
    // Mean konumu göreli açısı > 0 olduğu için çizgisi eğrinin başlangıcından sağda
    const cizgiler = [...blok.matchAll(/<line x1="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(cizgiler.length).toBeGreaterThan(0);
    cizgiler.forEach((x) => expect(x).toBeGreaterThanOrEqual(Number(egri[1]) - 0.6));
  });

  test('her şekil kapanıyor ve numaralanıyor', () => {
    const ac = (HTML8.match(/<figure>/g) || []).length;
    const kap = (HTML8.match(/<\/figure>/g) || []).length;
    expect(ac).toBe(kap);
    const nolar = [...HTML8.matchAll(/<b>Şekil (\d+) —/g)].map((m) => Number(m[1]));
    expect(nolar.length).toBe(ac);
    // Şekil 1 teoride (kavramsal çizim) → dinamik şekiller 2'den başlar, boşluksuz
    nolar.forEach((n, k) => expect(n).toBe(k + 2));
  });

  test('tablo numaraları boşluksuz artıyor ve her üretimde sıfırlanıyor', () => {
    const oku = (h) => [...h.matchAll(/Tablo (\d+) —/g)].map((m) => Number(m[1]));
    const a = oku(HTML8);
    expect(a.length).toBeGreaterThan(8);
    a.forEach((n, k) => expect(n).toBe(k + 1));
    const b = oku(RP._frSection8(R8, NODE));   // ikinci üretim
    expect(b).toEqual(a);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('şablon ve içindekiler bağı', () => {
  const fs = require('fs');
  const path = require('path');
  const kaynak = fs.readFileSync(
    path.join(__dirname, '..', '..', 'tools', 'report-assets', 'fead-theory-source.html'), 'utf8');

  test('şablondaki tokenlar tam bir kez geçiyor', () => {
    ['@@ASSETS_CSS@@', '@@ANTET@@', '@@FIGURE1@@', '@@SECTION8@@', '@@COMPLIANCE@@']
      .forEach((t) => expect(kaynak.split(t).length - 1).toBe(1));
  });

  // İçindekiler şablonda, başlıklar üreteçte: id'ler ayrışırsa bağlantı ölür.
  test('içindekilerdeki dinamik id\'ler üretecin bastığı id\'lerle aynı', () => {
    RP.VE_FEAD_REP_SECTIONS.forEach((s) => {
      expect(kaynak).toContain('href="#' + s.id + '"');
    });
    expect(HTML8).toContain('id="s8"');
    expect(HTMLU).toContain('id="uygunluk"');
  });

  test('şablon çevrimdışı — harici URL yok', () => {
    const dis = (kaynak.replace(/https?:\/\/www\.w3\.org\/[^"')\s]*/g, '').match(/https?:\/\/[^"')\s]+/g) || []);
    expect(dis).toEqual([]);
  });

  test('üretilen şablon modülü kaynakla güncel', () => {
    const tpl = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'fead-report-template.js'), 'utf8');
    const m = /FEAD_REPORT_TEMPLATE_B64 = "([^"]+)"/.exec(tpl);
    expect(m).toBeTruthy();
    const html = Buffer.from(m[1], 'base64').toString('utf8');
    expect(html).toContain('@@SECTION8@@');
    expect(html).toContain('@@KATEX_JS@@');
    expect(html).toContain('Kayış–Kasnak Geometrisi');
  });
});
