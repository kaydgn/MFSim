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
    expect(Math.abs(f - 2 * Math.sin(phi * Math.PI / 360))).toBeLessThan(1e-4);
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
    ['Kol boyu a', 'Yay ön yükü', 'Yay oranı k', 'Gergi pivotu']
      .forEach((ad) => expect(satir(ad)).toContain('<b>girdi</b>'));
    ['Gergi kasnağı sarımı', 'Hubload–kol açısı', 'Take-up oranı', 'Yay momenti']
      .forEach((ad) => expect(satir(ad)).toContain('<b>türev</b>'));
    // Tasarım gerginliği GİRDİ ve ankraj olduğu yazılı
    expect(satir('Tasarım gerginliği')).toContain('<b>girdi</b>');
    expect(satir('Tasarım gerginliği')).toMatch(/ankraj/i);
  });

  test('take-up bir girdi DEĞİL — ve rapor bunu söylüyor', () => {
    expect(HTML8).toContain('Take-up oranı bir girdi değildir');
    expect(HTML8).toMatch(/Panelde take-up diye bir alan yoktur/);
  });
});

describe('§8.7 — tasarım gerginliği: iki kanal', () => {
  test('tutan modelde iki kanal da basılıyor ve ✓ veriliyor', () => {
    const i = HTML8.indexOf('İki kanalın karşılaştırması');
    const blok = HTML8.slice(i, HTML8.indexOf('</table>', i));
    expect(blok).toContain('Girilen tasarım gerginliği');
    expect(blok).toContain('Yay dengesinden türetilen');
    expect(blok).toMatch(/eşiğinin içinde/);
    expect(HTML8).toContain('İki kanal birbirini doğruluyor');
  });

  // ÖLÇÜLDÜ (BMC): yay dengesi 650 N iken designTensionN 400 girilince BÜTÜN
  // gerilmeler ve hubloadlar 250 N kayıyor, hata mesajı çıkmıyor ve kayma
  // emniyeti bir ORAN olduğu için tabloya bakarak da anlaşılmıyor.
  test('uyuşmazlıkta KAÇ NEWTON kaydığı yazılıyor ve ✗ veriliyor', () => {
    const R = coz({ mutate: (ns) => {
      const s = ns.filter((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver)[0];
      s.data.designTensionN = 400;
    } });
    const H = RP._frSection8(R, NODE);
    const i = H.indexOf('İki kanalın karşılaştırması');
    const blok = H.slice(i, H.indexOf('</table>', i));
    expect(blok).toMatch(/eşiğinin dışında/);
    expect(H).toContain('Uyuşmazlık sessizdir');
    const m = /bütün açıklık gerilmeleri ve bütün\s+hubloadlar <b>(−?[\d,]+) N<\/b> kayar/.exec(H.replace(/\s+/g, ' '))
           || /hubloadlar <b>(−?[\d,]+) N<\/b> kayar/.exec(H);
    expect(m).toBeTruthy();
    expect(Math.abs(_sy(m[1]))).toBeCloseTo(250, 0);
    // ÖLÇÜLDÜ (800 d/d, 650→400 N): yük ÇEKEN kasnakların SF'i değişiyor
    // (Sürücü 5,348→4,024) ama yük çekmeyenlerde gerginlik oranı TAM 1 olduğu
    // için SF hiç değişmiyor — ve HÜKMÜ VEREN en düşük SF tam orada: %0,0.
    // Uyarının varlık sebebi bu: tablonun hükmü uyuşmazlığı göstermeyebiliyor.
    const s1 = R.analysis.duty[0].slip, s0 = R8.analysis.duty[0].slip;
    const cift = s0.map((x, k) => [x, s1[k]]);
    const yuksuz = cift.filter(([a]) => Math.abs(a.tensionRatio - 1) < 1e-9);
    expect(yuksuz.length).toBeGreaterThan(0);
    yuksuz.forEach(([a, b]) => expect(b.SF).toBeCloseTo(a.SF, 9));
    const yuklu = cift.filter(([a]) => Math.abs(a.tensionRatio - 1) > 1e-6);
    expect(yuklu.length).toBeGreaterThan(0);
    expect(yuklu.some(([a, b]) => Math.abs(b.SF / a.SF - 1) > 0.05)).toBe(true);
    expect(Math.min(...s1.map((x) => x.SF))).toBeCloseTo(Math.min(...s0.map((x) => x.SF)), 9);
    expect(H).toMatch(/ancak KISMEN gösterir/);
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
    expect(T).toMatch(/elle girilen tek büyüklük kol boyu/);
    expect(T).toMatch(/monoton bir fonksiyonu değildir/);
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
