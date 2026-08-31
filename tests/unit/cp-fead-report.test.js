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
  // Ömür/yorulma/frekans katalog sabitlerine bağlı; varsayılan artık 'none'.
  // Rapor testleri belgenin TAMAMINI ölçtüğü için açıkça açıyor.
  const _b = ns.find((n) => n.type === 'fead-belt');
  if (_b) _b.data.beltDataMode = 'full';
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

  // Açıklık frekansı ile sistem burulma modu AYRI büyüklükler — ikisi de var.
  //
  // Bu test eskiden burulma modunun YOK olduğunu doğruluyordu ve doğruydu:
  // çekirdekte çok serbestlik dereceli model yoktu. Model girdikten sonra o
  // cümle YANLIŞ hâle geldi — tedarikçiye giden belgede kalan bir yanlış,
  // panelde kalandan pahalıdır. Kapı artık üç şeyi birden tutuyor: bölüm VAR,
  // açıklık titreşiminden AYRI, ve güven düzeyi farkı YAZILI.
  test('burulma bölümü var ve açıklık titreşiminden ayrıldığı yazılı', () => {
    expect(HTML8).toContain('8.18 Sistem burulma titreşimi');
    expect(HTML8).toContain('sistem burulması değil');   // 8.17'nin kutusu
    expect(R8.torsional).toBeTruthy();
    // Hesaplanan 1. elastik mod belgede gerçekten basılmış olmalı.
    const f = R8.torsional.firstElasticHz;
    expect(f).toBeGreaterThan(0);
    expect(HTML8).toContain(f.toFixed(1).replace('.', ','));   // TR sayı biçimi
  });

  // Bu bölümün SAYISINDAN çok GEÇERLİLİK SINIRI önemli: belgenin geri kalanı
  // deterministik (%0,33), burulma kalibre (RMS ~%8). Fark yazılmazsa okuyan
  // ikisini aynı güvenle okur.
  test('burulma bölümü KALİBRE olduğunu ve güven farkını yazıyor', () => {
    const i = HTML8.indexOf('8.18 Sistem burulma titreşimi');
    expect(i).toBeGreaterThan(0);
    const blok = HTML8.slice(i);
    expect(blok).toContain('KALİBRE');
    expect(blok).toMatch(/%0,33/);      // deterministik zincirin sapması
    expect(blok).toMatch(/RMS ~%8/);    // burulmanın sapması
    expect(blok).toContain('sertifikasyon');
    expect(blok).toContain('§9.2');
  });

  // Rijit cisim modu TAM BİR TANE olmalı; belge bunu yazıyor ki okuyan
  // modelin kopmadığını görebilsin.
  test('burulma bölümü rijit cisim modunu sayıyor', () => {
    expect(R8.torsional.rigidBodyModes).toBe(1);
    const blok = HTML8.slice(HTML8.indexOf('8.18 Sistem burulma titreşimi'));
    expect(blok).toContain('tam bir tane');
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
    // Zarf taranamayacak kadar bozuk bir yerleşim: kriter "değerlendirilemedi"
    // diye BASILIR, sessizce geçmiş sayılmaz.
    const R = coz({ mutate: (ns) => {
      const t = ns.filter((n) => n.type === 'fead-tensioner')[0];
      delete t.data.meanLoad;
    } });
    const h = RP._frCompliance(R);
    expect(h).toContain('değerlendirilemedi');
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
    const ac = (HTML8.match(/<figure[\s>]/g) || []).length;
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
// ŞEKİL 1 — KAVRAMSAL ŞEMA: GEOMETRİSİ ÇEKİRDEKTEN, GÖZ KARARI DEĞİL
//
// Bu kapı gerçek bir hatadan doğdu. Şeklin SVG'si elle yazılmıştı ve BEŞ yol
// ucunun BEŞİ de kasnak çemberinin dışındaydı: krankın "sarım yayı" r=70 ile
// (560,60)→(560,200) arasına çizildiği için merkezi (630,130) yerine
// (560,130)'a düşüyor, yani kasnağın MERKEZİNDEN geçiyordu; aksesuar yayının
// kirişi 2r'den uzun olduğu için SVG yarıçapı 62 → 64.2'ye büyütüp yayı
// kasnaktan 96 px uzağa oturtuyor ve kayış o kasnağa HİÇ DEĞMİYORDU. Belge
// üretiliyor, testler yeşil kalıyor, hata yalnız gözle görülüyordu.
//
// Ölçüt Kayış Yolu kartındakiyle AYNI: her yayın ÖRTÜK merkezi (SVG uç→merkez
// dönüşümü, spec F.6.5) o kasnağın merkezi olmak ZORUNDA.
describe('Şekil 1 — kavramsal şema geometrisi', () => {
  const FIG = RP._frConceptFigure();
  const VB = /viewBox="0 0 (\d+) (\d+)"/.exec(FIG);
  const W = VB && Number(VB[1]);

  // r > 5 olanlar kasnak çeperi; r = 3 olanlar merkez noktaları
  const cember = [...FIG.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/g)]
    .map((m) => ({ x: +m[1], y: +m[2], r: +m[3] })).filter((c) => c.r > 5);
  const yol = /<path d="(M[^"]+ Z)" fill="none" stroke="#c8781e"/.exec(FIG);

  // SVG uç→merkez dönüşümü (rx = ry, dönme yok)
  function yayMerkezi(p1, p2, r, fA, fS) {
    const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
    const dx = (p2[0] - p1[0]) / 2, dy = (p2[1] - p1[1]) / 2;
    const d = Math.hypot(dx, dy), h = Math.sqrt(Math.max(0, r * r - d * d));
    const sg = (fA !== fS) ? 1 : -1;
    return [mx + sg * h * (-dy) / d, my + sg * h * dx / d];
  }
  function enYakin(p) {
    let b = null;
    cember.forEach((c) => {
      const d = Math.hypot(p[0] - c.x, p[1] - c.y);
      if (!b || Math.abs(d - c.r) < Math.abs(b.d - b.c.r)) b = { c, d };
    });
    return b;
  }
  function gez() {
    const tok = yol[1].match(/[MLA][^MLAZ]*/g);
    let cur = null; const dogru = [], yay = [];
    tok.forEach((t) => {
      const v = t.slice(1).trim().split(/[\s,]+/).map(Number);
      if (t[0] === 'M') cur = [v[0], v[1]];
      else if (t[0] === 'L') { dogru.push(cur, [v[0], v[1]]); cur = [v[0], v[1]]; }
      else { yay.push({ p1: cur, p2: [v[5], v[6]], r: v[0], fA: v[3], fS: v[4] }); cur = [v[5], v[6]]; }
    });
    return { dogru, yay };
  }

  test('şekil üretiliyor ve dört kasnaklı', () => {
    expect(FIG).toContain('<figure>');
    expect(FIG).toContain('<b>Şekil 1 —');
    expect(cember.length).toBe(4);
    expect(yol).toBeTruthy();
  });

  test('her açıklık ucu kasnak ÇEPERİNDE (eskiden 13,7–29 px dışındaydı)', () => {
    gez().dogru.forEach((p) => {
      const b = enYakin(p);
      expect(Math.abs(b.d - b.c.r)).toBeLessThan(0.35);
    });
  });

  test('her sarım yayının ÖRTÜK merkezi o kasnağın merkezi', () => {
    const y = gez().yay;
    expect(y.length).toBe(4);                       // dört kasnağın dördünde de sarım
    y.forEach((a) => {
      const c = yayMerkezi(a.p1, a.p2, a.r, a.fA, a.fS);
      const b = enYakin(c);
      expect(Math.hypot(c[0] - b.c.x, c[1] - b.c.y)).toBeLessThan(0.35);
    });
  });

  test('KAYIŞ DÖRT KASNAĞIN DA ÜSTÜNDEN GEÇİYOR', () => {
    // Asıl kusur buydu: aksesuar kasnağına kayış hiç değmiyordu.
    const merkezler = gez().yay.map((a) => {
      const c = yayMerkezi(a.p1, a.p2, a.r, a.fA, a.fS);
      return enYakin(c).c;
    });
    cember.forEach((c) => {
      expect(merkezler.some((m) => Math.hypot(m.x - c.x, m.y - c.y) < 0.5)).toBe(true);
    });
  });

  test('hiçbir yazı çerçeveden taşmıyor (mono 0,6 em)', () => {
    // Rapor CSS'i svg text'i IBM Plex Mono'ya sabitliyor; eski alt künye
    // satırı 820'lik viewBox'ı 32 px aşıp "…sırt t" diye KIRPILIYORDU.
    const kutu = [];
    for (const m of FIG.matchAll(/<text x="([-\d.]+)"[^>]*>([^<]*)</g)) {
      const x = Number(m[1]), s = m[2];
      const fs = Number((/font-size="([\d.]+)"/.exec(m[0]) || [0, 12])[1]);
      const anc = (/text-anchor="(\w+)"/.exec(m[0]) || [0, 'start'])[1];
      const w = s.length * fs * 0.6;
      kutu.push([anc === 'middle' ? x - w / 2 : anc === 'end' ? x - w : x, w, s]);
    }
    expect(kutu.length).toBeGreaterThan(5);
    kutu.forEach(([x0, w, s]) => {
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(x0 + w).toBeLessThanOrEqual(W);
    });
  });

  test('çekirdek yoksa uydurma çizim değil, boşluk döner', () => {
    const yedek = global.FEADCore;
    global.FEADCore = null;
    const bos = RP._frConceptFigure();
    global.FEADCore = yedek;
    expect(bos).toBe('');
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

  // ── KANVASTAN GELEN ŞEKLİN PALETİ ────────────────────────────────────────
  // §8.5'teki şekli MFSim'in kendi çizicisi (veFeadLayoutSVG) üretiyor ve o
  // çizici UYGULAMANIN palet jetonlarını kullanıyor. Raporun paleti bambaşka:
  // tanımsız bir var() "invalid at computed-value time"dır ve kalıtılan bir
  // özellik olan `stroke` için sonuç `none` demektir.
  // ÖLÇÜLDÜ (gerçek tarayıcı): jetonlar tanımsızken kayış, altı kasnak çemberi,
  // kaburga dişleri, sarım yayları, gergi kolu ve pivot GÖRÜNMEZDİ; şeklin
  // künyesi olmayan bir çizimi anlatıyordu. Sayfa hatası yok, test yok, sessiz.
  test('§8.5 şeklinin kullandığı HER palet jetonu şablonda tanımlı', () => {
    const i = HTML8.indexOf('<figure class="appfig">');
    expect(i).toBeGreaterThan(-1);                       // sınıf düşerse çizim görünmez
    const blok = HTML8.slice(i, HTML8.indexOf('</figure>', i));
    const jeton = [...new Set([...blok.matchAll(/var\((--[a-z-]+)\)/g)].map((m) => m[1]))];
    expect(jeton.length).toBeGreaterThan(4);             // şekil gerçekten jeton kullanıyor
    const eksik = jeton.filter((j) => !new RegExp('\\' + j + '\\s*:').test(kaynak));
    expect(eksik).toEqual([]);
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

// ═══════════════════════════════════════════════════════════════════════════
// TASARIM GERGİNLİĞİNİN KAYNAĞI — φ, β, take-up ve iki kanal
//
// Bu blok bir mühendis sorusundan doğdu (2026-08-24): "Take-up oranı nasıl
// hesaplanıyor, bir girdi giriyor muyuz? φ ve β nasıl elde ediliyor?" — üçü de
// aynı şeyi sorguluyordu: TASARIM GERGİNLİĞİ nereden geliyor.
//
// Üretilince ÜÇ GERÇEK KUSUR çıktı ve üçünün de kapısı burada:
//
//  1) §8.7'nin TEK denklemi yanlış çevrim çarpanıyla basılıyordu:
//     "M/(dL/dθ) · (180/π) · (1/1000)" elle çalışıldığında 650 N yerine
//     2,13 N veriyordu (ÖLÇÜLDÜ). Basılan T doğruydu — ayrı bir alandan
//     geliyordu — yani aritmetiği denetleyen okuyucu RAPORUN yanlış olduğu
//     sonucuna varıyordu. Sorunun kaynağı büyük olasılıkla tam olarak buydu.
//  2) §8.9 eğrinin UÇTAN UCA ORTALAMA eğimini hesaplayıp ona "take-up oranı"
//     diyordu: 0,4481 mm/° — §8.7'nin ve tedarikçi raporunun kullandığı ANLIK
//     türevden (0,5984) %25,1 farklı. Aynı ad, iki farklı sayı.
//  3) Tasarım gerginliğinin GİRDİ olduğu, yay dengesinden türetilen değerin
//     ise AYRI bir kanal olduğu hiçbir yerde yazmıyordu.
const _sy = (x) => Number(String(x).replace(/\u2212/g, '-').replace(/\./g, '').replace(',', '.'));

describe('§8.7 — denklem zinciri ELLE ÇALIŞILABİLİR', () => {
  test('(8.2) |f| = 2 sin(φ/2) — basılan sayı özdeşliği sağlıyor', () => {
    const m = /\|\\mathbf\{f\}\| = \\big\|[^=]*\\big\| = 2\\sin\\frac\{\\varphi\}\{2\} = 2\\sin\\frac\{([\d,]+)\^\\circ\}\{2\} = ([\d,]+)/.exec(HTML8);
    expect(m).toBeTruthy();
    const phi = _sy(m[1]), f = _sy(m[2]);
    // Eşik basılan sayıların YUVARLAMASINDAN gelir (|f| 4 hane, φ 2 hane):
    // φ'nin son hanesindeki 0.005°'lik yuvarlama |f|'de ~4e-5 oynatır, iki
    // yuvarlama üst üste binince 1e-4'ü sıyırabiliyor. 5e-4 hâlâ çok sıkı —
    // gerçek bir işaret/formül hatası mertebelerce büyük sapma verir.
    expect(Math.abs(f - 2 * Math.sin(phi * Math.PI / 360))).toBeLessThan(5e-4);
    // basılan φ, çözümün gergi sarımı olmalı — şekil ile tablo ayrışmasın
    expect(phi).toBeCloseTo(R8.analysis.tensioner.wrapDeg, 2);
  });

  test('(8.3) dL/dθ = a·|f|·sinβ·(π/180) — çarpanlar basılan sonucu veriyor', () => {
    const m = /= ([\d,]+)\\cdot ([\d,]+)\\cdot ([\d,]+)\\cdot\\frac\{\\pi\}\{180\} = ([\d,]+)\\ \\text\{mm\/\}/.exec(HTML8);
    expect(m).toBeTruthy();
    const [a, f, sinB, tk] = [_sy(m[1]), _sy(m[2]), _sy(m[3]), _sy(m[4])];
    expect(a * f * sinB * Math.PI / 180).toBeCloseTo(tk, 3);
    expect(tk).toBeCloseTo(R8.analysis.tensioner.takeupMmPerDeg, 3);
    // sinβ gerçekten β'nın sinüsü olmalı (etiket doğru sayıyı taşısın)
    expect(sinB).toBeCloseTo(Math.sin(R8.analysis.tensioner.betaDeg * Math.PI / 180), 3);
  });

  // ★ ASIL KAPI: çevrim çarpanı bir kez TERS yazılmıştı.
  test('(8.4) mm/° → m/rad çevrimi DOĞRU YÖNDE ve basılan ara değeri veriyor', () => {
    const m = /\\frac\{([\d,]+)\}\{1000\}\\cdot\\frac\{180\}\{\\pi\} = ([\d,]+)\\ \\text\{m\/rad\}/.exec(HTML8);
    expect(m).toBeTruthy();                       // ters çarpanlı biçim eşleşmez
    const tk = _sy(m[1]), rad = _sy(m[2]);
    // tk BASILAN (4 ondalığa yuvarlı) değer; yuvarlama payı çarpanla taşınır
    expect(Math.abs(rad / (tk / 1000 * (180 / Math.PI)) - 1)).toBeLessThan(1e-4);
    // TERS çarpan bu değerin ~3280 katı küçüğünü verirdi — kapı orada ısırıyor
    expect(rad / (tk / (180 / Math.PI) / 1000)).toBeGreaterThan(1000);
  });

  test('(8.5) T = M/(dL/dθ) — BASILAN sayılarla BASILAN sonucu veriyor', () => {
    const m = /T = \\frac\{M\(\\theta\)\}\{[^}]*\}[^=]*= \\frac\{([\d,]+)\\ \\text\{Nm\}\}\{([\d,]+)\\ \\text\{m\/rad\}\} = ([\d,]+)\\ \\text\{N\}/.exec(HTML8);
    expect(m).toBeTruthy();
    const M = _sy(m[1]), rad = _sy(m[2]), T = _sy(m[3]);
    expect(M / rad).toBeCloseTo(T, 0);            // ← eski sürüm 2,13 veriyordu
    expect(T).toBeCloseTo(R8.analysis.tensioner.tensionN, 0);
  });

  test('denklem numaraları sayaçtan: §8 içinde 8.1..8.n, boşluksuz ve tekrarsız', () => {
    const nolar = [...HTML8.matchAll(/<span class="tag">\(8\.(\d+)\)<\/span>/g)].map((x) => Number(x[1]));
    expect(nolar.length).toBeGreaterThanOrEqual(5);
    expect(nolar).toEqual(nolar.map((_, i) => i + 1));
  });

  test('metindeki (8.x) atıfları GERÇEKTEN basılan bir denklemi gösteriyor', () => {
    const var_ = new Set([...HTML8.matchAll(/<span class="tag">\((8\.\d+)\)<\/span>/g)].map((x) => x[1]));
    const atif = [...HTML8.matchAll(/\((8\.\d+)\)/g)].map((x) => x[1]);
    expect(atif.length).toBeGreaterThan(var_.size);          // metinde de anılıyor
    atif.forEach((a) => expect(var_.has(a)).toBe(true));     // ölü atıf yok
  });
});

describe('§8.7 — hangi sayı GİRDİ, hangisi TÜREV', () => {
  test('kaynak envanteri girdiyi ve türevi AÇIKÇA ayırıyor', () => {
    const i = HTML8.indexOf('Bu bölümdeki her büyüklüğün kaynağı');
    const blok = HTML8.slice(i, HTML8.indexOf('</table>', i));
    const satir = (ad) => {
      const j = blok.indexOf(ad);
      expect(j).toBeGreaterThan(-1);
      return blok.slice(j, blok.indexOf('</tr>', j));
    };
    ['Kol boyu a', 'Yay ön yükü', 'Yay oranı k', 'Otomatik gergi montaj konumu']
      .forEach((ad) => expect(satir(ad)).toContain('<b>girdi</b>'));
    ['Gergi kasnağı sarımı', 'Hubload–kol açısı', 'Take-up oranı', 'Yay momenti']
      .forEach((ad) => expect(satir(ad)).toContain('<b>türev</b>'));
    // Tasarım gerginliği ARTIK TÜREV: alan kaldırıldı, yay dengesinden geliyor.
    // Eskiden burada '<b>girdi</b>' aranıyordu ve o doğruydu — Çözücü panelinde
    // bir alan vardı. Bağımsız veri olmadığı ölçülünce (10 Gates raporunda
    // girilen ↔ türeyen farkı %0.12) alan kaldırıldı; satır taraf değiştirdi.
    expect(satir('Tasarım gerginliği')).toContain('<b>türev</b>');
    expect(satir('Tasarım gerginliği')).toMatch(/ankraj/i);
    // ve "hiçbiri girilmez" ayracının ALTINDA olmalı — üstünde kalırsa belge
    // onu hâlâ girdi diye sunuyor demektir.
    expect(blok.indexOf('hiçbiri girilmez'))
      .toBeLessThan(blok.indexOf('Tasarım gerginliği'));
  });

  test('take-up bir girdi DEĞİL — ve rapor bunu söylüyor', () => {
    expect(HTML8).toContain('Take-up oranı bir girdi değildir');
    expect(HTML8).toMatch(/Panelde take-up diye bir alan yoktur/);
  });
});

// Bu blok eskiden İKİ KANALI (girilen ankraj ↔ yay dengesi) ve uyuşmazlık
// uyarısını sınıyordu. Alan kaldırıldığı için karşılaştırılacak ikinci sayı
// yok; bölüm artık KURULUŞ anlatıyor ve kapı da onu tutuyor.
describe('§8.7 — tasarım gerginliğinin kuruluşu (tek kanal)', () => {
  test('formül ve sayı basılıyor, "sorulmaz" olduğu yazılı', () => {
    expect(HTML8).toContain('Tasarım gerginliği nereden geliyor');
    expect(HTML8).toMatch(/<b>sorulmaz<\/b>/);
    // T = M/(dL/dθ) formülü belgede
    expect(HTML8).toMatch(/\\frac\{M\(\\theta\)\}\{dL\/d\\theta\}/);
    // ve hesaplanan değer TR biçiminde basılı
    const T = R8.build.springTensionN;
    expect(T).toBeGreaterThan(0);
    expect(HTML8).toContain(Math.round(T).toString());
  });

  test('neden sorulmadığı — sessiz kayma sınıfı belgede anlatılıyor', () => {
    expect(HTML8).toContain('Neden ayrıca sorulmuyor');
    expect(HTML8).toMatch(/çelişebilir/);
    expect(HTML8).toMatch(/ancak kısmen gösterir/i);
    // Değiştirilecek şeyin KÜNYE olduğu söyleniyor, bir alan değil
    expect(HTML8).toMatch(/gergi <b>künyesidir<\/b>/);
  });

  test('ESKİ karşılaştırma tablosu ARTIK YOK', () => {
    expect(HTML8).not.toContain('İki kanalın karşılaştırması');
    expect(HTML8).not.toContain('Girilen tasarım gerginliği');
    expect(HTML8).not.toContain('Uyuşmazlık sessizdir');
  });

  // Kullanıcı eski bir kayıttan gelen designTensionN taşısa bile rapor onu
  // KULLANMAMALI: ankraj her koşulda yay dengesinden gelir.
  test('eski kayıttaki designTensionN raporu ETKİLEMİYOR', () => {
    const R = coz({ mutate: (ns) => {
      const s = ns.filter((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver)[0];
      s.data.designTensionN = 400;
    } });
    expect(R.build.sys.designTensionN).toBeCloseTo(R8.build.sys.designTensionN, 6);
    // Envanterdeki tasarım gerginliği satırı türetileni göstermeli, 400'ü değil.
    // ("400" dizesini belgenin TAMAMINDA aramak yanlış olurdu: devir değerleri
    //  ve başka sayılar içinde meşru olarak geçiyor.)
    const H = RP._frSection8(R, NODE);
    const q = H.indexOf('Tasarım gerginliği (ankraj)');
    expect(q).toBeGreaterThan(-1);
    const satir = H.slice(q, H.indexOf('</tr>', q));
    expect(satir).toContain(Math.round(R8.build.springTensionN).toString());
    expect(satir).not.toContain('400');
    // gerilme zinciri de kaymamalı
    expect(R.analysis.duty[0].perPulley.map((p) => p.exitTensionN))
      .toEqual(R8.analysis.duty[0].perPulley.map((p) => p.exitTensionN));
  });
});

describe('§8.6 — sarım açısının kuruluşu (φ nereden geliyor)', () => {
  const W = () => RP._frWrapRows(R8);

  test('her satırın φ değeri, BASILAN iki θ değerinden yeniden çıkıyor', () => {
    const W_ = W();
    expect(W_.rows.length).toBe(R8.build.names.length);
    W_.rows.forEach((q) => {
      const el = (((q.d * (q.thOut - q.thIn)) % 360) + 360) % 360;
      expect(el).toBeCloseTo(q.wrapDeg, 6);       // (3.3) elle denetlenebilir
      expect(q.wrapCalc).toBeCloseTo(q.wrapDeg, 6);
    });
  });

  test('işaretli sarım toplamı 360° — kapalı çevrim değişmezi tabloda', () => {
    const t = W().rows.reduce((a, q) => a + (q.contact === 'back' ? -1 : 1) * q.wrapDeg, 0);
    expect(Math.abs(Math.abs(t) - 360)).toBeLessThan(0.05);
    const i = HTML8.indexOf('Sarım açılarının teğet açılarından kuruluşu');
    expect(i).toBeGreaterThan(-1);
    expect(HTML8.slice(i, HTML8.indexOf('</table>', i))).toContain('kapalı çevrim değişmezi');
  });

  test('φ denklemi (8.1) tabloyla AYNI sayıları taşıyor', () => {
    const m = /\\big\[\\, ([+-]1)\\cdot\\big\((\u2212?[\d,]+)\^\\circ - \((\u2212?[\d,]+)\^\\circ\)\\big\)\\big\]\\ \\mathrm\{mod\}\\ 360\^\\circ = ([\d,]+)/.exec(HTML8);
    expect(m).toBeTruthy();
    const d = Number(m[1]), out = _sy(m[2]), inn = _sy(m[3]), phi = _sy(m[4]);
    expect(((((d * (out - inn)) % 360) + 360) % 360)).toBeCloseTo(phi, 1);
    // en büyük sarımlı kasnak seçilmiş olmalı (küçük sarımda şekil okunmaz)
    const enBuyuk = Math.max(...W().rows.map((q) => q.wrapDeg));
    expect(phi).toBeCloseTo(enBuyuk, 1);
  });
});

describe('§8.9 — take-up: ANLIK türev ≠ ORTALAMA eğim', () => {
  const blk = () => {
    const i = HTML8.indexOf('8.9 Kayış take-up');
    return HTML8.slice(i, HTML8.indexOf('<h3>8.10', i));
  };

  test('take-up oranı ANLIK eğim olarak tanımlanıyor', () => {
    const blok = blk();
    expect(blok).toMatch(/ANLIK eğimidir/);
    expect(blok).toContain(RP._frFs(R8.analysis.tensioner.takeupMmPerDeg, 4));
  });

  // ★ Eski sürüm ortalama eğimi "take-up oranı" diye basıyordu (%25,1 sapma).
  test('ortalama eğim de basılıyor ama AÇIKÇA "ortalama" diye adlandırılıyor', () => {
    const blok = blk();
    const m = /ortalama eğimi ise <b>([\d,]+) mm\/°<\/b>/.exec(blok);
    expect(m).toBeTruthy();
    const ort = _sy(m[1]), anlik = R8.analysis.tensioner.takeupMmPerDeg;
    expect(Math.abs(ort - anlik) / anlik).toBeGreaterThan(0.05);   // farklı sayılar
    expect(blok).toMatch(/Hesaplarda kullanılan\s+<b>anlık<\/b> olandır/);
  });

  test('take-up oranı kol açısıyla MONOTON DEĞİL — tepe noktası çiziliyor', () => {
    const blok = blk();
    const sw = [];
    const C = global.FEADCore, sys = R8.build.sys;
    const hi = C.feasibleRelMax(sys);
    for (let k = 0; k <= 40; k++) {
      try { sw.push(C.tensionerState(sys, hi * k / 40).takeupMmPerDeg); } catch (e) { /* uç */ }
    }
    const enB = Math.max(...sw);
    expect(enB).toBeGreaterThan(sw[0]);                    // önce artıyor
    expect(enB).toBeGreaterThan(sw[sw.length - 1]);        // sonra azalıyor
    expect(blok).toMatch(/monoton değildir/);
    expect(blok).toMatch(/tepe [\d,]+ mm\/° @/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// YENİ ŞEKİLLERİN GEOMETRİSİ — Şekil 1'deki kapının aynısı
//
// Ölçüt Kayış Yolu kartı ve Şekil 1 ile AYNI: her sarım yayının ÖRTÜK merkezi
// (SVG uç→merkez dönüşümü, spec F.6.5) o kasnağın merkezi olmak ZORUNDA.
// Sweep bayrağı bu projede bir kez yanlış yazılmıştı: yarıçap ve teğet uçları
// doğru olduğu için yay yine iki uca değiyor ama AYNALANMIŞ çemberin üstünde
// kalıyor, yani kasnağın İÇİNDEN geçiyordu — ve yay SAYISINA bakan test yeşil
// kalmıştı.
describe('Şekil — φ ve β kuruluşlarının geometrisi', () => {
  function yayMerkezi(p1, p2, r, fA, fS) {
    const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
    const dx = (p2[0] - p1[0]) / 2, dy = (p2[1] - p1[1]) / 2;
    const d = Math.hypot(dx, dy), h = Math.sqrt(Math.max(0, r * r - d * d));
    const sg = (fA !== fS) ? 1 : -1;
    return [mx + sg * h * (-dy) / d, my + sg * h * dx / d];
  }
  const sekiller = () => [
    ['φ kuruluşu', RP._frWrapFigure(R8)],
    ['β / take-up', RP._frBetaFigure(R8)]
  ];

  test('ikisi de üretiliyor, figure/svg dengeli, künyesi var', () => {
    sekiller().forEach(([ad, svg]) => {
      expect(typeof svg).toBe('string');
      expect(svg.length).toBeGreaterThan(800);
      expect((svg.match(/<svg[\s>]/g) || []).length).toBe(1);
      expect((svg.match(/<\/svg>/g) || []).length).toBe(1);
      expect((svg.match(/<figure[\s>]/g) || []).length).toBe(1);
      expect((svg.match(/<\/figure>/g) || []).length).toBe(1);
      expect(svg).toMatch(/<b>Şekil \d+ —/);
    });
  });

  test('hiçbir koordinat NaN/Infinity değil — bozuk yol tarayıcıda SESSİZCE çizilmez', () => {
    sekiller().forEach(([ad, svg]) => {
      expect(svg).not.toMatch(/NaN|Infinity|undefined/);
      const say = [...svg.matchAll(/(?:^|\s)(?:cx|cy|r|x|y|x1|y1|x2|y2)="([-\d.]+)"/g)].map((m) => Number(m[1]));
      expect(say.length).toBeGreaterThan(10);
      say.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    });
  });

  test('★ sarım yayının ÖRTÜK merkezi kasnağın merkezinde (sweep bayrağı kapısı)', () => {
    sekiller().forEach(([ad, svg]) => {
      const cem = [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/g)]
        .map((m) => ({ x: +m[1], y: +m[2], r: +m[3] })).filter((c) => c.r > 10);
      expect(cem.length).toBe(1);
      const yay = [...svg.matchAll(/<path d="M([-\d.]+) ([-\d.]+) A([\d.]+) ([\d.]+) 0 ([01]) ([01]) ([-\d.]+) ([-\d.]+)"[^>]*stroke-width="5"/g)];
      expect(yay.length).toBe(1);                       // kayış kalınlığındaki tek yay
      const a = yay[0].slice(1).map(Number);
      expect(a[2]).toBeCloseTo(cem[0].r, 2);            // yay yarıçapı = çember yarıçapı
      const c = yayMerkezi([a[0], a[1]], [a[6], a[7]], a[2], a[4], a[5]);
      expect(Math.hypot(c[0] - cem[0].x, c[1] - cem[0].y)).toBeLessThan(0.05);
    });
  });

  test('yayın SÜPÜRMESİ sarım açısına eşit — kısa yola normalize edilmiyor', () => {
    // 198°'lik bir sarımda "kısa yol" 162° çizerdi: aynı iki uca değen ama
    // YANLIŞ yay. Şekil 1'deki hatanın kardeşi.
    const svg = RP._frWrapFigure(R8);
    const cem = [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/g)]
      .map((m) => ({ x: +m[1], y: +m[2], r: +m[3] })).filter((c) => c.r > 10)[0];
    const a = [...svg.matchAll(/<path d="M([-\d.]+) ([-\d.]+) A([\d.]+) ([\d.]+) 0 ([01]) ([01]) ([-\d.]+) ([-\d.]+)"[^>]*stroke-width="5"/g)][0]
      .slice(1).map(Number);
    const A1 = Math.atan2(a[1] - cem.y, a[0] - cem.x) * 180 / Math.PI;
    const A2 = Math.atan2(a[7] - cem.y, a[6] - cem.x) * 180 / Math.PI;
    let sw = A2 - A1;
    if (a[5] === 1) { while (sw < 0) sw += 360; } else { while (sw > 0) sw -= 360; }
    const enBuyuk = Math.max(...RP._frWrapRows(R8).rows.map((q) => q.wrapDeg));
    expect(Math.abs(Math.abs(sw) - enBuyuk)).toBeLessThan(0.05);
    expect(enBuyuk).toBeGreaterThan(180);               // BMC'de gerçekten > 180
  });

  // MUTASYON ÖLÇÜMÜ bu kapıyı EKSİK buldu: yukarıdaki test kayış yayını
  // (stroke-width 5) denetliyor, ama φ'yi GÖSTEREN işaret yayı _frAngMark'tan
  // çıkıyor ve ayrı bir yol. _frAngMark'ı "kısa yola normalize et" diye
  // değiştirmek 198°'lik sarımı 162° çizdiriyor ve bütün testler YEŞİL kalıyordu.
  test('★ φ İŞARET yayı da tam sarım kadar süpürüyor (kısa yola normalize edilmiyor)', () => {
    const svg = RP._frWrapFigure(R8);
    const cem = [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/g)]
      .map((m) => ({ x: +m[1], y: +m[2], r: +m[3] })).filter((c) => c.r > 10)[0];
    const m = /<path d="M([-\d.]+) ([-\d.]+) A([\d.]+) [\d.]+ 0 ([01]) ([01]) ([-\d.]+) ([-\d.]+)" fill="none" stroke="#c8781e" stroke-width="2"/.exec(svg);
    expect(m).toBeTruthy();
    const [x1, y1, rr, laf, sf, x2, y2] = m.slice(1).map(Number);
    const A1 = Math.atan2(y1 - cem.y, x1 - cem.x) * 180 / Math.PI;
    const A2 = Math.atan2(y2 - cem.y, x2 - cem.x) * 180 / Math.PI;
    let sw = A2 - A1;
    if (sf === 1) { while (sw < 0) sw += 360; } else { while (sw > 0) sw -= 360; }
    const phi = Math.max(...RP._frWrapRows(R8).rows.map((q) => q.wrapDeg));
    expect(Math.abs(Math.abs(sw) - phi)).toBeLessThan(0.1);
    expect(laf).toBe(phi > 180 ? 1 : 0);        // büyük yay bayrağı da doğru
    // işaret yayı da kasnakla EŞ MERKEZLİ olmalı
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = (x2 - x1) / 2, dy = (y2 - y1) / 2;
    const d = Math.hypot(dx, dy), h = Math.sqrt(Math.max(0, rr * rr - d * d));
    const sg = (laf !== sf) ? 1 : -1;
    expect(Math.hypot(mx + sg * h * (-dy) / d - cem.x, my + sg * h * dx / d - cem.y)).toBeLessThan(0.05);
  });

  test('|f| = 2 sin(φ/2) özdeşliği — köprü ile şekil aynı sayıyı taşıyor', () => {
    const K = RP._frTenConstruct(R8);
    expect(K.normF).toBeCloseTo(2 * Math.sin(K.st.wrapDeg * Math.PI / 360), 9);
    expect(K.armLen).toBeCloseTo(R8.build.sys.tensioner.armLength, 6);
    // take-up özdeşliği: a·|f|·sinβ·(π/180) = çekirdeğin değeri
    const el = K.armLen * K.normF * Math.sin(K.st.betaDeg * Math.PI / 180) * Math.PI / 180;
    expect(el).toBeCloseTo(K.st.takeupMmPerDeg, 9);
  });

  test('çizim SEMBOL taşır, sayı denklemde durur', () => {
    // Değerleri yay işaretlerinin yanına yazmak ölçüldü: etiket kutuları
    // yayların ve yarıçap doğrularının üstüne biniyordu.
    const svg = RP._frWrapFigure(R8);
    const yazi = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    expect(yazi.some((t) => /^θ_giriş$/.test(t))).toBe(true);
    expect(yazi.some((t) => /^θ_çıkış$/.test(t))).toBe(true);
    expect(yazi.some((t) => /^φ$/.test(t))).toBe(true);
    // sarım/teğet açısı SAYISI çizimde geçmiyor
    expect(yazi.some((t) => /θ_giriş\s+[−\d]/.test(t))).toBe(false);
  });
});

describe('etiket yerleştirici — çakışma önleme', () => {
  test('aynı çıpadan iki etiket ÜST ÜSTE BİNMEZ', () => {
    const LB = RP._frLabels(600, 400);
    const a = LB.ekle(300, 200, 1, 0, 'birinci etiket', '#000', 12, 20);
    const b = LB.ekle(300, 200, 1, 0, 'ikinci etiket', '#000', 12, 20);
    const kutu = (t) => {
      const m = /x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)</.exec(t);
      const w = String(m[4]).length * Number(m[3]) * 0.6;
      return { x: +m[1] - w / 2, y: +m[2], w, h: Number(m[3]) * 1.25 };
    };
    const A = kutu(a), B = kutu(b);
    const carpisma = !(A.x + A.w < B.x || B.x + B.w < A.x
                    || A.y < B.y - B.h || B.y < A.y - A.h);
    expect(carpisma).toBe(false);
  });

  test('kilitlenen alan (alt künye) etiket almaz', () => {
    const LB = RP._frLabels(600, 400);
    LB.kilit(0, 360, 600, 40);
    const t = LB.ekle(300, 355, 0, 1, 'aşağı', '#000', 12, 10);
    const y = Number(/y="([\d.]+)"/.exec(t)[1]);
    expect(y).toBeLessThan(360);
  });

  test('çember engeli: kayışın üstüne etiket konmaz', () => {
    const LB = RP._frLabels(600, 400);
    LB.engelCember(300, 200, 100, 10);
    const t = LB.ekle(300, 200, 1, 0, 'x', '#000', 12, 100);   // tam çember üstü
    const m = /x="([\d.]+)" y="([\d.]+)"/.exec(t);
    const d = Math.hypot(+m[1] - 300, +m[2] - 200);
    expect(Math.abs(d - 100)).toBeGreaterThan(4);              // çeperden itilmiş
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEORİ KAYNAĞI — (4.3) artık TÜRETİLİYOR, ankraj §5.1'de yazılı
//
// Eskiden (4.3) yalnız İDDİA ediliyordu ("dL/dθ = a sinβ · 2sin(φ/2)") ve
// §5.1 gerginliğin kasnaktan kasnağa nasıl DEĞİŞTİĞİNİ anlatıp mutlak
// SEVİYESİNİN nereden geldiğini hiç söylemiyordu — yani "tasarım gerginliği"
// belgede tanımsız bir büyüklüktü.
describe('teori kaynağı — türetme ve ankraj', () => {
  const fs = require('fs'), path = require('path');
  const T = fs.readFileSync(path.join(__dirname, '..', '..', 'tools',
    'report-assets', 'fead-theory-source.html'), 'utf8');

  test('§4.2 (4.3)\'ün türetmesini taşıyor', () => {
    expect(T).toContain("(4.3)'ün türetilmesi");
    // zincirin üç halkası da yazılı olmalı
    expect(T).toMatch(/\\frac\{\\mathrm\{d\}\\mathbf\{c\}_\{\\text\{ten\}\}\}\{\\mathrm\{d\}\\theta\} = a\\,\\mathbf\{t\}/);
    expect(T).toContain('\\mathbf{f} \\;=\\; \\mathbf{u}_{\\text{çıkış}} - \\mathbf{u}_{\\text{giriş}}');
    expect(T).toMatch(/\|\\mathbf\{f\}\| = 2\\sin\\frac\{\\varphi_\{\\text\{ten\}\}\}\{2\}/);
    expect(T).toMatch(/90\^\\circ - \\beta/);
  });

  test('take-up bir GİRDİ olmadığı teoride de yazılı', () => {
    expect(T).toContain('Take-up bir girdi değil, bir türevdir');
    // GİRDİ SAYISI İKİ. Bir dönem "elle girilen TEK büyüklük kol boyu"
    // yazıyordu ve yön tersine çevrilince (pivot bir GİRDİ oldu) bu cümle
    // take-up zincirinin EN DUYARLI girdisini gizler hâle geldi: pivot β'yı,
    // β take-up'ı, take-up gerginliği belirliyor.
    expect(T).toMatch(/elle girilen iki büyüklük vardır: kol boyu/);
    expect(T).toMatch(/pivot/i);
    expect(T).not.toMatch(/elle girilen tek büyüklük kol boyu/);
    expect(T).toMatch(/monoton bir fonksiyonu değildir/);
  });

  // ── YÖN TERSİNE ÇEVRİLDİ: teori de iki yolu anlatmak ZORUNDA ────────────
  // Bu belge tedarikçiye gidiyor. §4.3 bir dönem kol açısının TEK çözüm
  // yolunun (4.4)'ün kökü olduğunu söylüyordu; zarf kipinde o kök hiç
  // aranmıyor — ok tam ters yönde. Okuyucu, çözücünün gerçekte yapmadığı bir
  // hesabı yapıyor sanırdı.
  test('§4.3 İKİ YÖNÜ de anlatıyor — kök bulma ve zarftan seçim', () => {
    expect(T).toMatch(/Çalışma açısının çözümü — iki yön/);
    expect(T).toMatch(/tek bir serbestlik derecesini paylaşır/);
    expect(T).toMatch(/Kayış seçilmişse/);
    expect(T).toMatch(/Kayış henüz seçilmemişse/);
    expect(T).toMatch(/L_\{\\text\{eff\}\} \\;=\\; L_\{\\text\{gereken\}\}\(\\theta\^\{\*\}\)/);
    expect(T).toMatch(/\(4\.5\)/);
  });

  test('§4.5 MONTAJ ZARFI bölümü var ve ölçütü denklemle veriyor', () => {
    expect(T).toMatch(/4\.5 Montaj zarfı ve kol açısının seçimi/);
    expect(T).toMatch(/\\arg\\max/);
    expect(T).toMatch(/\(4\.6\)/);
    expect(T).toMatch(/\(4\.7\)/);
    // fiziksel gerekçe ve ölçülen sınır BASILMAK ZORUNDA
    expect(T).toMatch(/tepe gerginliği en küçük/);
    expect(T).toMatch(/42,7…59,5/);                       // β bandı
    expect(T).toMatch(/kalibrasyondur, bağımsız doğrulama değildir/);
    expect(T).toMatch(/153/);                             // paketleme aykırısı
  });

  test('AD ÇAKIŞMASI kapandı: servis zarfı ↔ montaj zarfı ayrı adlandırılıyor', () => {
    expect(T).toMatch(/servis zarfını/);
    expect(T).toMatch(/montaj zarfıyla/);
    // ve iki zarfın FARKI yazılı (hangisinde ne sabit)
    expect(T).toMatch(/montaj noktası sabit, kolun saati serbesttir/);
  });

  test('§1 dördüncü soruyu — hangi kayışı ısmarlamalıyım — sayıyor', () => {
    expect(T).toMatch(/Model dört soruyu birlikte cevaplar/);
    expect(T).toMatch(/hangi kayışı ısmarlamalıyım/);
    expect(T).not.toMatch(/Model üç soruyu birlikte cevaplar/);
  });

  test('§5.1 zincirin MUTLAK SEVİYESİNİ (ankraj) anlatıyor', () => {
    expect(T).toContain('Zincirin mutlak seviyesi: tasarım gerginliği');
    expect(T).toMatch(/mutlak seviyesini vermez/);
    expect(T).toMatch(/T_\{\\text\{gergi\}\} = T_\{\\text\{tasarım\}\}/);
    expect(T).toMatch(/bağımsız olarak/);
  });

  test('§10 yeni semboller listede', () => {
    ['\\mathbf{f}', '\\mathbf{t}', '\\mathrm{d}L/\\mathrm{d}\\theta', 'T_{\\text{tasarım}}']
      .forEach((s) => expect(T).toContain(s));
    expect(T).toMatch(/Take-up oranı \(türev, girdi değil\)/);
  });

  test('hubload atfı (5.5) — (5.3) sürücü gücü denklemidir, hubload değil', () => {
    const i = T.indexOf('4.2 Yay momenti');
    const blok = T.slice(i, T.indexOf('4.3 Çalışma açısının', i));
    expect(blok).toMatch(/aynı çarpan \(5\.5\)'te hubload'da da görünür/);
    expect(blok).not.toMatch(/\(5\.3\)'te hubload/);
  });

  test('teori metni ÜRETİLEN şablona gerçekten girmiş', () => {
    const tpl = fs.readFileSync(path.join(__dirname, '..', '..', 'js',
      'fead-report-template.js'), 'utf8');
    const b64 = /window\.FEAD_REPORT_TEMPLATE_B64 = "([^"]+)"/.exec(tpl)[1];
    const html = Buffer.from(b64, 'base64').toString('utf8');
    expect(html).toContain("(4.3)'ün türetilmesi");
    expect(html).toContain('Zincirin mutlak seviyesi: tasarım gerginliği');
    expect(html).toMatch(/h4\{font-size/);            // h4 kuralı şablon CSS'inde
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ŞEKİL AÇIKLAMA SÜTUNU — sembol tek başına ŞİFRE
//
// Kullanıcı bildirimi (2026-08-24): *"bu şekildeki tanımları biraz daha güzel
// yapalım; 'fi' ne demek falan çok belli olmamış."* Doğruydu: sayıların yay
// işaretlerinin üstüne binmesini önlemek için çizimde yalnız sembol
// bırakılmıştı, sembolün NE OLDUĞU ise yalnız künye metninde kalıyordu —
// okuyucu şekle bakarken orada değil.
//
// Aynı bildirimde şekiller "çok büyük" bulundu: 534 ve 452 px iken raporun
// diğer sekiz şekli 209–346 px bandındaydı. Kadraj yatayladı (viewBox
// oranı düştü) ve açığa çıkan sol şerit açıklamaya verildi.
describe('şekil açıklama sütunu ve ölçüsü', () => {
  const yaziGetir = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

  test('φ şekli sembolleri TANIMLIYOR', () => {
    const t = yaziGetir(RP._frWrapFigure(R8)).join(' | ');
    expect(t).toMatch(/φ — SARIM AÇISI/);
    expect(t).toMatch(/teğet noktaları/);
    expect(t).toMatch(/teğet açıları/);
    expect(t).toMatch(/d — sarım işareti/);
    // sembolün kendisi çizimde de duruyor
    expect(yaziGetir(RP._frWrapFigure(R8)).some((x) => x === 'φ')).toBe(true);
  });

  test('β şekli sembolleri TANIMLIYOR', () => {
    const t = yaziGetir(RP._frBetaFigure(R8)).join(' | ');
    ['a — gergi kol boyu', 't — merkezin hareket yönü', 'f — bileşke',
     'φ — gergi kasnağındaki sarım açısı', 'β — bileşke ile kol arasındaki açı']
      .forEach((x) => expect(t).toContain(x));
    // açıklama metni satırlara SARILIYOR: boşlukla birleştirip ara
    expect(yaziGetir(RP._frBetaFigure(R8)).join(' ')).toMatch(/Bu zincirdeki TEK\s+girdi/);
  });

  test('kadraj YATAY — şekil raporun diğer şekilleriyle aynı bantta', () => {
    // svg{width:100%} olduğu için ekrandaki yükseklik = genişlik × (H/W).
    // Diğer sekiz şeklin oranı 0,26–0,44 arasında; bu ikisi 0,81 ve 0,55'ti.
    [RP._frWrapFigure(R8), RP._frBetaFigure(R8)].forEach((svg) => {
      const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
      expect(m).toBeTruthy();
      expect(Number(m[2]) / Number(m[1])).toBeLessThan(0.45);
    });
  });

  test('açıklama sütunu ile çizim ÇAKIŞMAZ — sütun alanı kilitli', () => {
    const svg = RP._frWrapFigure(R8);
    const cem = [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/g)]
      .map((m) => ({ x: +m[1], r: +m[3] })).filter((c) => c.r > 10)[0];
    expect(cem.x - cem.r).toBeGreaterThan(300);        // çember sütunun sağında
  });

  test('uzun kasnak adı alt künyeyi çerçeveden TAŞIRMAZ', () => {
    // Şekil EN BÜYÜK SARIMLI kasnağı seçiyor; hangisi olduğunu bilmediğimiz
    // için hepsini yeniden adlandırıyoruz (tek birini adlandırmak kapıyı
    // sessizce boşa çıkarıyordu — mutasyon ölçümüyle yakalandı).
    const R = coz({ mutate: (ns) => {
      ns.forEach((n, k) => {
        if (n.data && n.data.od != null) n.customName = 'Ç'.repeat(180) + k;
      });
    } });
    const svg = RP._frWrapFigure(R);
    const W = Number(/viewBox="0 0 (\d+)/.exec(svg)[1]);
    [...svg.matchAll(/<text x="(\d+)" y="[\d.]+" font-size="(11)"[^>]*>([^<]*)</g)]
      .forEach((m) => expect(Number(m[1]) + String(m[3]).length * 11 * 0.6).toBeLessThan(W));
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  KULLANICI RAPOR İNCELEMESİ (2026-08-25) — "yanlış yerler var, eksik yerler de"
// ════════════════════════════════════════════════════════════════════════════
// Kullanıcı, AG00976 örneğinden üretilmiş bir raporu inceletti. Çıkan kusurlar
// iki sınıftaydı ve ikisi de SESSİZDİ: (a) çözüme hiç ulaşmayan bir girdi
// yüzünden bütün yük tablolarının yüksüz koşması, (b) modelin değişmesine
// rağmen güncellenmemiş metin/etiket/hüküm. Aşağıdaki kapılar ikisini de tutar.
describe('rapor incelemesi — etiket, bayat metin ve hüküm kapıları', () => {
  // Gates raporundan kurulmuş örnek: yük tabloları burada gerçekten dolu.
  function cozAG() {
    const pack = veFeadExampleNodes('AG00976_GATES_2025');
    const ns = pack.nodes.map((n) => ({
      id: n.id, type: n.type, def: componentDefs[n.type],
      customName: n.customName, data: JSON.parse(JSON.stringify(n.data)),
    }));
    const build = veFeadBuildSystem(ns, pack.connections);
    const solv = ns.filter((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver)[0];
    const R = veFeadAnalyze(build, {
      rows: veFeadDutyRows(solv), cylinders: 6, crankInertia: 0.70,
    });
    R.build = build;
    R.pulleyNames = build.names;
    R.serviceFact = Number(solv.data.serviceFact) || 0;
    return R;
  }
  let RA, H8, HU, HA;
  beforeAll(() => { RA = cozAG(); H8 = RP._frSection8(RA, NODE); HU = RP._frCompliance(RA); HA = RP._frAntet(RA); });

  test('§8.1 İKİ AYRI UZUNLUĞU ayrı adlandırıyor', () => {
    // Eskiden tek satırdı: "Kayış efektif boyu: 1716,2 mm · gereken 1714,6 mm".
    // Baştaki sayı TAHRİK boyudur (Gates "Effective Drive Length"), kayışın
    // künyesindeki efektif boy değil — okuyucu ikisini aynı sanıyordu.
    expect(H8).toMatch(/Tahrik boyu/);
    expect(H8).toMatch(/gereken kayış boyu/);
    expect(H8).toMatch(/künyedeki efektif boy/);
    // Eski, karıştıran biçim geri gelmemeli.
    expect(H8).not.toMatch(/Kayış efektif boyu:<\/strong> [\d.,]+ mm · gereken /);
  });

  test('ANTET efektif boyu BİR BASAMAKLA basıyor — 1714,6 ≠ "1715"', () => {
    // Tam sayıya yuvarlamak katalog adını (8PK1715HD) TÜREYEN efektif boyun
    // yerine koyardı. Boy artık bir ÇIKTI; model 1714,61 mm veriyor ve antet
    // bunu bir basamakla, yani 1714,6 olarak basıyor.
    expect(RA.build.sys.belt.effLength).toBeCloseTo(1714.6, 1);
    expect(HA).toMatch(/1714,6 mm/);
    expect(HA).not.toMatch(/8 kaburga · 1715 mm/);
    // İkinci uzunluk (tahrik boyu) da adlandırılmış olmalı: antette iki farklı
    // sayı adsız yan yana durunca fark yuvarlama sanılıyordu.
    expect(HA).toMatch(/tahrik boyu/);
  });

  test('§8.7 tasarım gerginliğini GİRDİ diye anlatmıyor (bayat metin)', () => {
    // Alan kaldırılıp ankraj türetilir olduktan sonra da giriş paragrafı
    // "kullanıcının girdiği ankraj" diyor ve "ikisinin karşılaştırması"
    // vaat ediyordu; okuyucu panelde olmayan bir alanı arıyordu.
    expect(H8).not.toMatch(/kullanıcının girdiği/);
    expect(H8).not.toMatch(/ikisinin karşılaştırması/);
    expect(H8).toMatch(/sorulmaz/);
  });

  test('UYGUNLUK #6 TOTOLOJİ DEĞİL — türetilen ankrajı adıyla yazıyor', () => {
    // "Tasarım gerginliği ↔ yay dengesi, sapma ≤ %2" bir totolojiydi: ankraj
    // artık yay dengesinin ta kendisi, sapma yapısal olarak sıfır. Geçen bir
    // kriter gibi görünüp hiçbir şey denetlemiyordu.
    expect(HU).not.toMatch(/sapma ≤ %2/);
    expect(HU).toMatch(/Tasarım gerginliği ankrajı/);
    expect(HU).toMatch(/türetildi: 544 N/);
  });

  test('§8.3 gergi kasnağının ÇALIŞMA KONUMUNU basıyor ve §8.8\'e yolluyor', () => {
    // X/Y "—" basılıyordu; oysa konum bilinmiyor değil, TÜRETİLMİŞ.
    // Ayrıca dipnot §8.7'ye yolluyordu — orada X/Y YOK, konum tablosu §8.8'de.
    expect(H8).toMatch(/−161,9\d|−162,0\d/);
    expect(H8).toMatch(/§8\.8/);
    expect(H8).toMatch(/girdi değildir/);
  });

  test('§8.13 aksesuar gücü yoksa BOŞ TABLO basmıyor, sebebini yazıyor', () => {
    // Bütün güçler sıfırken tablo tek sütunlu ve bomboş çıkıyordu; okuyucu
    // bunu "tork hesaplanamadı" diye okuyordu, oysa sebep eksik girdiydi.
    const bos = cozAG();
    bos.analysis.duty.forEach((d) => d.perPulley.forEach((q) => { q.powerKw = 0; }));
    const hb = RP._frSection8(bos, NODE);
    expect(hb).toMatch(/Aksesuar gücü girilmedi/);
    expect(hb).toMatch(/eksik\s*girdidir/);
    // Dolu modelde uyarı YOK ve tablo gerçekten dolu.
    expect(H8).not.toMatch(/Aksesuar gücü girilmedi/);
    expect(H8).toMatch(/Aksesuar ortalama mil torku/);
  });

  test('KAYMA HÜKMÜ yük taşıyan kasnaklara dayanır, öğüt de doğru olur', () => {
    // ÖLÇÜLDÜ (AG00976, 880 d/d): yük taşıyan üç kasnakta oran 1,348–2,538 ve
    // SF 4,58–16,73; yük taşımayan üçünde oran 1,0010–1,0024 ve SF 1,232–1,479.
    // Global en düşük (1,23) hükmü veriyordu ve çaresi "tasarım gerginliğini
    // yükseltin" diye yazılıyordu — oysa raporun kendi §8.7'si o kasnaklarda
    // SF'nin DEĞİŞMEYECEĞİNİ söylüyor. Yani önerilen çare etkisizdi.
    const d0 = RA.analysis.duty[0];
    const yuklu = d0.slip.filter((s) => s.tensionRatio >= 1.01);
    const bos = d0.slip.filter((s) => s.tensionRatio < 1.01);
    expect(yuklu.length).toBe(3);
    expect(bos.length).toBe(3);
    expect(Math.min.apply(null, yuklu.map((s) => s.SF))).toBeGreaterThan(4);
    expect(Math.max.apply(null, bos.map((s) => s.SF))).toBeLessThan(1.5);

    expect(H8).toMatch(/En kritik YÜK TAŞIYAN kasnak/);
    expect(H8).toMatch(/Yük taşımayan kasnaklarda SF bir MARJ değil/);
    // Yük taşımayanlar GİZLENMİYOR: tabloda da, açıklamada da adları geçiyor.
    expect(H8).toMatch(/Otomatik Gergi \(E9843\)/);
    // Etkisiz öğüt kalkmış olmalı.
    expect(H8).not.toMatch(/tasarım gerginliğini yükseltin/);
    // ETİKET DEĞİL SAYI: hükmü veren değer gerçekten yük taşıyanların en
    // düşüğü olmalı. (Yalnız başlığa bakan bir kapı, _frMinSF'i global en
    // düşüğe geri çeviren bir mutasyonu YEŞİL geçiriyordu — ölçüldü.)
    const yukluMin = Math.min.apply(null, RA.analysis.duty.flatMap(
      (d) => d.slip.filter((s) => s.tensionRatio >= 1.01).map((s) => s.SF)));
    const globalMin = Math.min.apply(null, RA.analysis.duty.flatMap(
      (d) => d.slip.map((s) => s.SF)));
    expect(yukluMin).toBeGreaterThan(globalMin * 2);          // iki küme ayrı
    const yaz = (x) => x.toFixed(2).replace('.', ',');
    expect(HU).toMatch(new RegExp(yaz(yukluMin)));
    expect(HU).toMatch(/yük taşıyan kasnaklarda en düşük/);
    // Hüküm servis faktörünü GEÇMELİ: global en düşük alınsaydı ✗ olurdu ve
    // "tasarım onaylanmamalıdır" hükmü kayması imkânsız bir kasnaktan gelirdi.
    expect(yukluMin).toBeGreaterThanOrEqual(RA.serviceFact);
    expect(globalMin).toBeLessThan(RA.serviceFact);
    expect(H8).toMatch(new RegExp('yük taşıyan kasnaklarda\\)[\\s\\S]{0,60}' + yaz(yukluMin)));
  });

  test('YÜK TAŞIYAN KASNAK YOKSA hüküm yine verilir (global en düşüğe düşer)', () => {
    // Ayrım bir kaçış kapısı olmamalı: bütün güçler sıfırsa "değerlendirilemedi"
    // demek yerine elde olan tek sayıya düşülür.
    const bos = cozAG();
    bos.analysis.duty.forEach((d) => d.slip.forEach((s) => { s.tensionRatio = 1.0; }));
    const hu = RP._frCompliance(bos);
    expect(hu).toMatch(/Kayma emniyeti/);
    expect(hu).not.toMatch(/değerlendirilemedi[\s\S]{0,80}Kayma/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  §8.7 — GERGİ PİVOTUNUN KURULUŞU (kullanıcı isteği, 2026-08-25)
// ════════════════════════════════════════════════════════════════════════════
// "Tensioner pivot noktası tedarikçiye girdi olarak gitmeyecek. İlk önce bu
// hesabın nasıl yapıldığını verelim." Blok pivotun bağımsız OLMADIĞINI kurar:
// kayış yolu pivota hiç bağlı değil, pivotun tek etkisi β → take-up → gerginlik.
describe('§8.7 montaj konumu ve avara hareketi', () => {
  // Kullanıcı kararı (2026-08-29): tek koordinat, doğrulama yok. Bu blok
  // eskiden pivotun TÜRETİLDİĞİNİ, kol boyu kontrolünün totoloji olduğunu ve
  // "gerçek denetim" dalını tutuyordu — üçü de kalktı.
  const R = () => coz();

  test('MONTAJ KONUMU bir GİRDİ, avara merkezi bir ÇIKTI olarak kuruluyor', () => {
    const h = RP._frPivotBlock(R());
    expect(h).toMatch(/Otomatik gergi montaj konumu ve avaranın hareketi/);
    expect(h).toMatch(/tek bir koordinat/);
    expect(h).toMatch(/bir <b>çıktıdır<\/b>/);
  });

  test('DENKLEM YÖNÜ: c = p + a(cosθ, sinθ) — avaranın hareketinin tanımı', () => {
    const h = RP._frPivotBlock(R());
    expect(h).toMatch(/\\mathbf\{c\}[\s\S]{0,40}\\mathbf\{p\}/);
    expect(h).not.toMatch(/\\mathbf\{p\}\s*\\;=\\;\s*\\mathbf\{c\}/);
  });

  test('DOĞRULAMA DİLİ YOK — "denetim", "totoloji", "ölçülmüş pivot" geçmiyor', () => {
    const h = RP._frPivotBlock(R());
    expect(h).not.toMatch(/DENETİM DEĞİLDİR/);
    expect(h).not.toMatch(/pivot ÖLÇÜLMÜŞ/);
    expect(h).not.toMatch(/gerçek bir denetimdir/);
    expect(h).not.toMatch(/kullanıcıdan <b>istenmez<\/b>/);
  });

  test('SIRA yazılı: montaj konumu → kol açısı → merkez ve kayış boyu', () => {
    const h = RP._frPivotBlock(R());
    expect(h).toMatch(/Sıra bu/);
    expect(h).toMatch(/montaj konumunu<\/b> girer/);
    expect(h).toMatch(/kayış boyu<\/b> ondan türer/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// KAYMA EŞİĞİ AYRINTILI RAPORDA DA — iki belge aynı çiziciyi kullanıyor
// (`_frTensionFigure`), yani eşik çizgisi tek yerden geliyor. Kapı burada
// AYRICA duruyor çünkü özet rapor kaldırılsa bile bu belge onu basmalı.
// ═══════════════════════════════════════════════════════════════════════════
describe('gerginlik grafiği · kayma eşiği çizgisi', () => {
  test('BMC: eşik çizgisi ve künyesi köprünün sayısını taşıyor', () => {
    const A = veFeadSlipThreshold(R8.build, R8.analysis.duty);
    expect(A).toBeTruthy();
    const fig = RP._frTensionFigure(R8);
    expect((fig.match(/data-ve="slip-threshold"/g) || []).length).toBe(1);
    expect(fig).toContain('kayma eşiği ' + Math.round(A.tensionN) + ' N');
    expect(fig).toContain('KAYMA EŞİĞİ (' + Math.round(A.tensionN) + ' N)');
    // Belirleyici kasnak ve devir künyede ADIYLA yazıyor.
    expect(fig).toContain(A.pulley);
    expect(fig).toContain(String(A.engineRpm) + ' d/d');
  });

  test('eşik çizgisi doğru YÜKSEKLİKTE — grafiğin kendi y ölçeğinde', () => {
    // Sayıyı künyeye doğru yazıp çizgiyi yanlış yere koymak SESSİZ bir kusur:
    // belge tutarlı görünür, grafik yalan söyler. Kapı, çizginin y'sini
    // grafiğin ekseninden BAĞIMSIZ olarak yeniden çözüyor.
    const A = veFeadSlipThreshold(R8.build, R8.analysis.duty);
    const fig = RP._frTensionFigure(R8);
    const g = fig.match(/data-ve="slip-threshold"[\s\S]*?<\/g>/);
    expect(g).toBeTruthy();
    const cz = g[0].match(/<line[^>]*y1="([\d.]+)"[^>]*y2="([\d.]+)"/);
    expect(cz).toBeTruthy();
    expect(Number(cz[1])).toBeCloseTo(Number(cz[2]), 6);     // gerçekten YATAY
    const y = Number(cz[1]);

    // Eksen etiketlerinden ölçeği geri kur. Y bölmeleri sola dayalı
    // (`text-anchor="end"`) yazılıyor; ölçeği onlardan çözmek, çizicinin
    // içindeki `sy`ye HİÇ başvurmadan bağımsız bir ölçüm veriyor.
    const tik = [];
    const re = /<text x="([\d.]+)" y="([\d.]+)" text-anchor="end" font-size="11"[^>]*>([^<]+)<\/text>/g;
    let m;
    while ((m = re.exec(fig))) {
      const v = Number(String(m[3]).replace(/\u2212/g, '-').replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(v)) tik.push({ y: Number(m[2]), v });
    }
    const ys = tik.filter((t, i, a) => a.findIndex((b) => b.v === t.v) === i)
      .sort((a, b) => a.v - b.v);
    expect(ys.length).toBeGreaterThan(1);
    const a0 = ys[0], a1 = ys[ys.length - 1];
    const egim = (a1.y - a0.y) / (a1.v - a0.v);

    // Etiket TEMEL ÇİZGİSİ bölmenin 4 px altına yazılıyor (`y="(Y + 4)"`),
    // ve bu ofset bütün bölmelerde AYNI olduğu için eğim etkilenmiyor —
    // yalnız kesişim 4 px kayıyor. ÖLÇÜLDÜ: fark −4,014 px (0,014'ü y'nin
    // bir ondalığa yuvarlanması).
    const OFS = 4;
    const bekY = a0.y + egim * (A.tensionN - a0.v) - OFS;

    // TOLERANS SIKI OLMAK ZORUNDA: bölme aralığı 48,4 px, yani "başka bir
    // bölmeye düşmesin" ölçütü 24 px'lik bir kapı demek ve 12 px'lik bir
    // kaymayı da, %50'lik bir ölçek hatasını da SESSİZCE geçiriyordu
    // (mutasyonla ölçüldü). Yarım piksel, yuvarlamanın hemen üstü.
    expect(Math.abs(y - bekY)).toBeLessThan(0.5);
  });

  test('AG00976: eşik Gates\'in bastığı 157,65 N DEĞİL (kopyalanmıyor)', () => {
    const RA = coz();
    const A = veFeadSlipThreshold(RA.build, RA.analysis.duty);
    // Gates s1 grafiğinde 157,65 N yazıyor ama KENDİ kayma sayfası (s6/12)
    // 66,6 N ima ediyor — aynı raporun iki sayfası 2,37 kat ayrışıyor. Model
    // kendi zincirinden türetiyor; basılı sayı kopyalanmıyor.
    expect(Math.abs(A.tensionN - 157.65)).toBeGreaterThan(20);
  });

  test('HAZIRLAYAN alanı panelde var ve düğüme YAZIYOR', () => {
    // Panelin kendisinden okunuyor: `_frDocFields` dışa açılmıyor, ve açmak
    // için imza değiştirmek kapının ölçtüğü şeyi (kullanıcının GÖRDÜĞÜ panel)
    // değiştirirdi.
    const eski = window.veFeadResults;
    let panel = '';
    try {
      window.veFeadResults = R8;      // künye alanları YALNIZ çözülmüş modelde
      panel = RP.getFeadReportPropertiesHTML({ id: 'r1', type: 'fead-report', data: {} });
    } finally { window.veFeadResults = eski; }
    expect(panel).toContain('Hazırlayan');
    // Alan düğüme GERÇEKTEN yazıyor — salt etiket değil.
    expect(panel).toContain("veFeadSet('r1','author',this.value)");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAYFA NUMARASI · MATEMATİK SINIRLAYICISI · TABLO 9'UN KURULUŞU (2026-08-28)
//
// Üçü de kullanıcı bildiriminden doğdu. Ortak yanları: belge YİNE üretiliyor,
// hata çıkmıyor, yalnız okunamıyor ya da doğrulanamıyor oluyor.
// ═══════════════════════════════════════════════════════════════════════════
describe('detay rapor · sayfa numarası, sınırlayıcı, Tablo 9 kuruluşu', () => {
  const fs2 = require('fs');
  const path2 = require('path');
  const kok = path2.join(__dirname, '..', '..');
  const sablon = () => {
    const tpl = fs2.readFileSync(path2.join(kok, 'js', 'fead-report-template.js'), 'utf8');
    const b64 = /window\.FEAD_REPORT_TEMPLATE_B64 = "([^"]+)"/.exec(tpl)[1];
    return Buffer.from(b64, 'base64').toString('utf8');
  };

  // ── 1) SAYFA NUMARASI ────────────────────────────────────────────────────
  test('BASKI sayfa numarası şablonda — @page kenar kutusunda counter(page)', () => {
    const css = sablon();
    // @page bloğu ve içindeki alt-orta kenar kutusu
    expect(css).toMatch(/@page\s*\{[^]*?@bottom-center\s*\{[^]*?counter\(page\)/);
    expect(css).toMatch(/counter\(pages\)/);
    // ÖLÇÜLDÜ (Chromium): kenar kutuları ve sayaçlar çalışıyor, `string()`
    // ÇALIŞMIYOR — akan bölüm başlığı denendi, kutu BOŞ çıkıyor. Kapı bunu
    // kilitliyor ki biri "bölüm adı da yazsın" diye sessizce ekleyip
    // üstbilgiyi boşaltmasın.
    expect(css).not.toMatch(/@page[^]*?string\(/);
    expect(css).not.toMatch(/string-set\s*:/);
  });

  test('sayfa numarası YALNIZ baskıda — ekranda kutu yok', () => {
    const css = sablon();
    const i = css.indexOf('@media print');
    expect(i).toBeGreaterThan(0);
    // @page kuralı baskı bloğunun İÇİNDE olmalı
    expect(css.indexOf('@bottom-center')).toBeGreaterThan(i);
  });

  // ── 2) MATEMATİK SINIRLAYICISI ───────────────────────────────────────────
  test('TANIMSIZ sınırlayıcı YOK: \\[…\\] hiçbir üretecin çıktısında geçmiyor', () => {
    // Otomatik render YALNIZ iki sınırlayıcı tanıyor ve boot yapılandırması
    // KaTeX'in kendi varsayılan listesini EZİYOR. `\[…\]` ile yazılan bir
    // denklem ham LaTeX olarak, düz yazı gibi basılır — sessiz, çünkü belge
    // yine üretilir ve hata çıkmaz. Bir kez tam olarak öyle oldu (§8.7).
    const boot = fs2.readFileSync(path2.join(kok, 'tools', 'report-assets',
      'build-fead-report-template.js'), 'utf8');
    // Boot'un TANIDIĞI sınırlayıcılar — tek kaynak, kapı buradan okuyor.
    expect(boot).toMatch(/left:"\$\$",right:"\$\$"/);
    expect(boot).toMatch(/left:"\\\\\\\\\(",right:"\\\\\\\\\)"/);
    expect(boot).not.toMatch(/left:"\\\\\\\\\[/);      // \[ KAYITLI DEĞİL

    ['js/cp-fead-report.js', 'js/cp-fead-summary.js',
     'tools/report-assets/fead-theory-source.html'].forEach((f) => {
      const src = fs2.readFileSync(path2.join(kok, f), 'utf8');
      expect({ dosya: f, adet: (src.match(/\\\[/g) || []).length })
        .toEqual({ dosya: f, adet: 0 });
    });
  });

  test('tasarım gerginliği denklemi $$…$$ ile ve NUMARALI', () => {
    const blok = RP._frDesignTensionBlock(R8);
    expect(blok).toContain('$$');
    expect(blok).not.toContain('\\[');
    expect(blok).toMatch(/T_\{\\text\{tasarım\}\}/);
    // Numarası var (atıf yapılabilsin) ve sayaçtan geliyor
    expect(blok).toMatch(/<span class="tag">\(8\.\d+\)<\/span>/);
  });

  test('ÜRETİLEN §8 + Uygunluk gövdesinde ham LaTeX kalmıyor', () => {
    // Yalnız ÜRETEÇ çıktısı taranır. Tam belge şablonu da içeriyor ve gömülü
    // KaTeX paketi kendi varsayılan sınırlayıcı listesinde o diziyi taşıyor —
    // o bizim metnimiz değil, taransaydı kapı yanlış yerden kırmızı olurdu.
    const s8 = RP._frSection8(R8, NODE) + RP._frCompliance(R8);
    expect((s8.match(/\\\[/g) || []).length).toBe(0);
    expect((s8.match(/\\\]/g) || []).length).toBe(0);
  });

  // ── 3) TABLO 9'UN KURULUŞU ───────────────────────────────────────────────
  test('Tablo 9 · her ölçüt AMAÇ FONKSİYONUNU ve YÖNÜNÜ taşıyor (tek kaynak)', () => {
    RP.VE_FR_ENV_CRITERIA.forEach((c) => {
      expect(typeof c.J).toBe('string');
      expect(c.J.length).toBeGreaterThan(3);
      expect(['max', 'min']).toContain(c.yon);
    });
    // Kazanan ölçüt EN BÜYÜKLENEN take-up minimumu — (4.x)'in ta kendisi
    const win = RP.VE_FR_ENV_CRITERIA.filter((c) => c.win)[0];
    expect(win.yon).toBe('max');
    expect(win.J).toMatch(/\\min/);
    expect(win.J).toMatch(/dL/);
  });

  test('Tablo 9 · formüller TABLODA basılıyor, ikinci kopyadan değil', () => {
    const env = RP._frEnvelopeBlock(R8);
    RP.VE_FR_ENV_CRITERIA.forEach((c) => {
      expect(env).toContain(c.J);          // satırın kendi J'si belgede
      expect(env).toContain(c.ad);
    });
    expect(env).toContain('Amaç fonksiyonu');
  });

  test('Tablo 9 · üç sütunun da KURULUŞU denklemle yazılı', () => {
    const env = RP._frEnvelopeBlock(R8);
    // yoklama kümesi Θ — bant sürekli değil, dört noktada örnekleniyor
    expect(env).toMatch(/\\Theta\s*\\;=\\;/);
    expect(env).toMatch(/\\tfrac\{1\}\{2\}\\theta_\{\\text\{nom\}\}/);
    // argopt
    expect(env).toMatch(/arg\\,opt/);
    // Δ SARMALANMIŞ — çember üzerinde fark başka türlü tanımsız
    expect(env).toMatch(/\\operatorname\{wrap\}/);
    expect(env).toMatch(/N = 14/);
    // medyan ve isabet sayımı
    expect(env).toMatch(/\\operatorname\{med\}/);
    expect(env).toMatch(/\\le 5\^\\circ/);
    // plato ve ceza
    expect(env).toMatch(/0\{,\}99\\,\s*J\(\\theta\^\{\*\}\)/);
    expect(env).toMatch(/1 - \\frac\{J\(\\theta_\{\\text\{ted\}\}\)\}/);
  });

  test('Tablo 9 · yoklama kümesi BANT ÇARPANINDAN, elle yazılmıyor', () => {
    // Yalnız "1,5 basılıyor mu" diye bakmak YETMEZ: sabit elle yazılsaydı da
    // aynı dizgi çıkardı (mutasyonla ölçüldü, kapı geçiyordu). Kapı bu yüzden
    // ÇARPANI DEĞİŞTİRİP çıktının onu izlediğini ölçüyor.
    const env = RP._frEnvelopeBlock(R8);
    expect(env).toContain(String(RP._frEnvMult()).replace('.', ',')
      + '\\,\\theta_{\\text{nom}}');
    const eski = global.VE_FEAD_ENV_TRAVEL_MULT;
    try {
      global.VE_FEAD_ENV_TRAVEL_MULT = 1.9;
      expect(RP._frEnvMult()).toBe(1.9);
      const e2 = RP._frEnvelopeBlock(R8);
      expect(e2).toContain('1,9\\,\\theta_{\\text{nom}}');       // yoklama kümesi
      expect(e2).toContain('1,9\\cdot\\theta_{\\text{nom}}');    // servis bandı
    } finally { global.VE_FEAD_ENV_TRAVEL_MULT = eski; }
  });

  test('Tablo 9 · kuruluş bloğu TABLODAN ÖNCE geliyor', () => {
    const env = RP._frEnvelopeBlock(R8);
    const iK = env.indexOf('büyüklükleri nasıl kuruldu');
    const iT = env.indexOf('Seçim ölçütü 14 tedarikçi');
    expect(iK).toBeGreaterThan(-1);
    expect(iT).toBeGreaterThan(iK);
  });

  test('h5 ara başlığı şablon CSS\'inde tanımlı (varsayılana düşmüyor)', () => {
    const css = sablon();
    expect(css).toMatch(/h5\{[^}]*font-size/);
    expect(css).toMatch(/h1,h2,h3,h4,h5\{font-family/);
    expect(RP._frEnvelopeBlock(R8)).toContain('<h5>');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BAYAT ATIFLAR — belge kendi yol tarifini yalanlamamalı (2026-08-31)
// ═══════════════════════════════════════════════════════════════════════════
describe('detay rapor · bölüm atıfları ve sıralama', () => {
  test('türeyen kayış boyu atfı GERÇEKTEN o bölümde basılıyor', () => {
    // Atıf bir dönem §8.4'ü (gergi künyesi) gösteriyordu, oysa kayış boyu
    // orada YOK — okuyucu belgenin kendi yol tarifiyle boşa çıkıyordu.
    // Kapı sayıyı DEĞİL, sayının işaret ettiği bölümün İÇERİĞİNİ ölçüyor.
    const no = RP.VE_FR_SEC_BELTLEN;
    expect(no).toMatch(/^8\.\d+$/);
    const h8 = RP._frSection8(R8, NODE);
    // O numaralı h3 var mı?
    const bas = new RegExp('<h3>' + no.replace('.', '\\.') + ' ');
    expect(h8).toMatch(bas);
    // …ve türeyen kayış boyu O bölümün içinde mi (bir sonraki h3'e kadar)?
    const i = h8.search(bas);
    const j = h8.indexOf('<h3>', i + 4);
    const bolum = h8.slice(i, j < 0 ? h8.length : j);
    expect(bolum).toContain('Türeyen efektif kayış boyu');
  });

  test('iki atıf da AYNI kaynaktan — ikinci kopya yok', () => {
    const h8 = RP._frSection8(R8, NODE);
    const kac = (h8.match(/çözülen kol açısından \(§8\.\d+\)/g) || []);
    expect(kac.length).toBe(1);
    expect(kac[0]).toContain('§' + RP.VE_FR_SEC_BELTLEN);
    // Kapsam kutusu yalnız kayış tipine bağlı çıktılar kapalıyken basılıyor;
    // basıldığında aynı numarayı taşımalı.
    const kutu = RP._frBeltDataBox({ beltDataOff: ['X'] });
    expect(kutu).toContain('(§' + RP.VE_FR_SEC_BELTLEN + ')');
  });

  test('§4 alt bölümleri ARTAN sırada (teori şablonunda)', () => {
    // 4.5 bir dönem 4.4'ten ÖNCE geliyordu: okuyucu 4.1·4.2·4.3·4.5·4.4
    // görüyordu. Atıflar doğruydu, bozuk olan yalnız sıraydı.
    const fs2 = require('fs');
    const path2 = require('path');
    const src = fs2.readFileSync(path2.join(__dirname, '..', '..', 'tools',
      'report-assets', 'fead-theory-source.html'), 'utf8');
    const nolar = (src.match(/<h3>(\d+\.\d+)\s/g) || [])
      .map((x) => /<h3>(\d+\.\d+)\s/.exec(x)[1]);
    expect(nolar.length).toBeGreaterThan(10);
    // Her ana bölüm içinde alt numaralar artmalı
    const grup = {};
    nolar.forEach((n) => {
      const [a, b] = n.split('.').map(Number);
      (grup[a] = grup[a] || []).push(b);
    });
    Object.keys(grup).forEach((a) => {
      const g = grup[a];
      expect({ bolum: a, sira: g }).toEqual({ bolum: a, sira: g.slice().sort((x, y) => x - y) });
    });
  });
});
