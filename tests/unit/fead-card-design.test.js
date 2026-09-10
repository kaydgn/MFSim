/**
 * fead-card-design.test.js — KAYIŞ YOLU KARTININ YENİ SUNUMU
 *
 * Kullanıcı, tasarım denemelerinden bir bileşim seçti (kısa ad · gerilme
 * haritası · künye tablosu · tek satır künye · ad-açı çakışma kapısı). Bu
 * dosya o seçimin dört sessiz kusurunu kilitliyor:
 *
 *   1. Ad, sarım açısının üstüne düşüyordu — iki yazı da görünür, ikisi de
 *      okunmaz. Kullanıcı bildirimi (AG00976, "Avara 1" ile 52.83°).
 *   2. Kısa ad ÇİZİME özgüdür: panel, rapor ve dışa aktarma tam adı basmaya
 *      devam etmeli, yoksa "155 A" hangi alternatör olduğunu söyleyen tek
 *      işaretti ve belgeden sessizce düşerdi.
 *   3. Sarım açısı tabloya taşındı — ama tablo çizimi EZEMEZ: dar kartta tablo
 *      düşer ve açılar çizime geri döner. Sayı hiçbir kipte kaybolmamalı.
 *   4. Gerilme haritasının ankrajı ÇİZİLEN KONUMDAN gelir. Gelmeseydi şema bir
 *      kol konumunu, renk başka bir konumu anlatırdı; ikisi de "makul" görünür.
 */
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (!global[k]) global[k] = fead[k]; });
global.requestAnimationFrame = () => 0;

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  document.body.innerHTML = '<div id="ve-canvas"></div>';
});

/** Kullanıcının bildirdiği sistem: Gates AG00976, altı kasnak, duty tablolu. */
function kur(key) {
  const pack = veFeadExampleNodes(key || 'AG00976_GATES_2025');
  pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
  global.nodes = pack.nodes;
  global.connections = pack.connections;
  const build = veFeadBuildSystem(pack.nodes);
  // KART İKİYE BÖLÜNDÜ (2026-09-10): `layout` = Kayış Yolu (donuk geometri),
  // `run` = Çalışma Noktası (gerilme haritası · animasyon · titreşim).
  const layout = pack.nodes.find((n) => n.type === 'fead-layout');
  const run = pack.nodes.find((n) => n.type === 'fead-run');
  return { pack, build, layout, run };
}
const geomOf = (build, rel) =>
  F.tensionerState(build.sys, rel == null ? F.meanRel(build.sys) : rel).geom;

/* Kutu kuralları YERLEŞTİRİCİNİN kendisiyle aynı (bkz. `aday` / `yumusak`). */
const adKutulari = (svg) =>
  [...svg.matchAll(/<text data-ve="name" x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" font-size="9"[^>]*>([^<]*)</g)]
    .map((m) => {
      const x = +m[1], y = +m[2], an = m[3], w = m[4].length * 9 * 0.6;
      const x0 = an === 'middle' ? x - w / 2 : an === 'start' ? x : x - w;
      return { ad: m[4], x0, x1: x0 + w, y0: y - 8, y1: y + 2 };
    });
const aciKutulari = (svg) =>
  [...svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="middle" font-size="8" fill="var\(--accent-warning\)">([-\d.]+)°</g)]
    .map((m) => {
      const w = (m[3] + '°').length * 8 * 0.6;
      return { x0: +m[1] - w / 2, x1: +m[1] + w / 2, y0: +m[2] - 8, y1: +m[2] + 2 };
    });
const ortusur = (a, b) => !(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1);
const cakisma = (adlar, acilar) => {
  let n = 0;
  adlar.forEach((a) => acilar.forEach((b) => { if (ortusur(a, b)) n++; }));
  return n;
};

// Kartın ölçeği sarım etiketlerinden ETKİLENMEZ (etiket payı yalnız ADI sayar),
// yani iki çizim aynı dönüşümü paylaşır ve kutuları karşılaştırılabilir.
const OLCULER = [[440, 458], [440, 398], [420, 340], [380, 320], [340, 298]];

/* ══════════════════════════════════════════════════════════════════════════
   KART İKİYE BÖLÜNDÜ (2026-09-10) — geometri ↔ işletme
   ──────────────────────────────────────────────────────────────────────────
   Tek kart on beş işi taşıyordu ve üç seçici (kol · devir · titreşim) aynı
   22 px'lik şeride sıkışıyordu. Bölme ÖLÇÜYE göre değil SORUYA göre:
   `fead-layout` "kayış nereden geçiyor" sorusunu model KURULURKEN cevaplar ve
   DONUKTUR; `fead-run` "bu devirde ne oluyor" sorusunu DEVİR SEÇİLİNCE.
   ══════════════════════════════════════════════════════════════════════════ */
describe('iki kart — geometri ↔ işletme', () => {
  test('geometri kartı DONUK: animasyon yükü ve gerilme haritası YOK', () => {
    const { layout } = kur();
    const kart = fead.veFeadLayoutCardHTML(layout);
    expect(kart).not.toMatch(/data-fead-anim/);
    expect(kart).not.toMatch(/data-ve="belt-tension"/);
    expect(kart).not.toMatch(/data-ve="spoke"/);
    expect(kart).toMatch(/data-ve="spin"/);          // animasyon yokken dönüş oku geri gelir
    expect(kart).toMatch(/data-ve="belt"/);
  });

  test('çalışma kartı CANLI: yük + gerilme haritası var, sarım açıları yok', () => {
    const { build, run } = kur();
    const kart = fead.veFeadLayoutCardHTML(run);
    expect(kart).toMatch(/data-fead-anim/);
    expect(kart).toMatch(new RegExp('data-fead-node="' + run.id + '"'));
    expect([...kart.matchAll(/data-ve="belt-tension"/g)]).toHaveLength(build.order.length);
    expect(aciKutulari(kart).length).toBe(0);
  });

  // ÜÇ SEÇİCİ ÜÇE BÖLÜNDÜ. İkisi de aynı kartta kalsaydı bölmenin ölçülebilir
  // tek kazancı (her seçiciye tam genişlik) hiç doğmazdı.
  test('seçiciler bölündü: Kol geometride, Devir + Titreşim çalışmada', () => {
    const { layout, run } = kur();
    const g = fead.veFeadLayoutCardHTML(layout), c = fead.veFeadLayoutCardHTML(run);
    expect(g).toMatch(/'posMode'/);
    expect(g).not.toMatch(/'animRpm'/);
    expect(g).not.toMatch(/'vibMode'/);
    expect(c).toMatch(/'animRpm'/);
    expect(c).toMatch(/'vibMode'/);
    expect(c).not.toMatch(/'posMode'/);
  });

  // KOL KONUMU TEK ALANDA (Kayış Yolu düğümünde). İkinci bir alan tutulsaydı
  // iki kart FARKLI kol konumu çizerdi ve fark sessiz olurdu: ikisi de kendi
  // içinde tutarlı görünür.
  test('kol konumu paylaşılır: şemadaki seçim çalışma kartını da çevirir', () => {
    const { layout, run } = kur();
    expect(fead.veFeadLayoutCardHTML(run)).toMatch(/Çalışma \(Mean\)/);
    layout.data.posMode = 'free';
    expect(fead.veFeadPosModeShared(run)).toBe('free');
    const c = fead.veFeadLayoutCardHTML(run);
    expect(c).toMatch(/Serbest kol/);
    expect(c).not.toMatch(/Çalışma \(Mean\) ·/);
    // Çalışma kartına kendi alanı yazılsa bile şemanınki kazanır.
    run.data.posMode = 'min';
    expect(fead.veFeadPosModeShared(run)).toBe('free');
  });

  // TAZELEME TEK KAPIDAN (modül kuralı 11): iki kart HEP BİRLİKTE. Kart başına
  // ayrı çağrı, altı düzenleme yolundan birinde birinin unutulması demek.
  test('veFeadRefreshCards üç kartı da kurar', () => {
    const { pack } = kur();
    const hedef = pack.nodes.filter((n) => ['fead-layout', 'fead-run', 'fead-table'].includes(n.type));
    expect(hedef).toHaveLength(3);
    document.body.innerHTML = '<div id="ve-canvas"></div>' + hedef.map((n) =>
      '<div id="' + n.id + '" class="ve-node"><div class="ve-node-box"></div></div>').join('');
    expect(veFeadRefreshCards()).toBe(3);
    hedef.forEach((n) => {
      const el = document.getElementById(n.id);
      expect(el.querySelector('.ve-fead-layout-card, .ve-fead-table-card')).not.toBeNull();
    });
  });

  test('örnek KULLANIMA HAZIR gelir — iki kart da kurulur', () => {
    ['AG00976_GATES_2025', 'BMC_FEAD_2026'].forEach((k) => {
      const { pack } = kur(k);
      expect(pack.nodes.filter((n) => n.type === 'fead-layout')).toHaveLength(1);
      expect(pack.nodes.filter((n) => n.type === 'fead-run')).toHaveLength(1);
    });
  });
});

describe('ad, sarım açısının üstüne DÜŞMEZ', () => {
  test('hiçbir ölçüde ad kutusu açı kutusuna binmiyor', () => {
    const { build } = kur();
    OLCULER.forEach(([W, H]) => {
      const svg = fead.veFeadLayoutSVG(build, W, H, { nodeId: 'lay' });
      const adlar = adKutulari(svg), acilar = aciKutulari(svg);
      expect(adlar.length).toBe(build.order.length);
      expect(acilar.length).toBe(build.order.length);
      expect(cakisma(adlar, acilar)).toBe(0);
    });
  });

  // KAPI BOŞ DEĞİL: engel kaldırıldığında (wrapLabels:false — yerleştirici o
  // hâlde ESKİ kuralın aynısını koşuyor) çakışma gerçekten doğuyor. Aynı
  // dönüşümü paylaştıkları için açı kutuları öteki çizimden alınabiliyor.
  test('engel olmadan aynı yerleşimde çakışma VAR — eski hâlin ölçüsü', () => {
    const { build } = kur();
    let toplam = 0;
    OLCULER.forEach(([W, H]) => {
      const acili = fead.veFeadLayoutSVG(build, W, H, { nodeId: 'lay' });
      const acisiz = fead.veFeadLayoutSVG(build, W, H, { nodeId: 'lay', wrapLabels: false });
      toplam += cakisma(adKutulari(acisiz), aciKutulari(acili));
    });
    expect(toplam).toBeGreaterThan(0);
  });

  // AÇI ETİKETİ YUMUŞAK, GÜL SERT. Tek listeye konsaydı ad, sayıdan kaçarken
  // gülün üstüne düşerdi — sert engeli örtmek yapısal bilgiyi yok eder (yön
  // etiketleri, kayışın kendisi, hangi adın hangi kasnağa ait olduğu); bir
  // SAYIYA binmek ise daha küçük zarar.
  //
  // ÖLÇÜT SIFIR ÇAKIŞMA DEĞİL, ARTMAMASI: eski yerleştirici de gül konumlarının
  // bir kısmında çakışıyor ve bunlar onun kendi ilan ettiği geri düşüşü (dört
  // adayın hiçbiri temiz değilse ad üste döner, KAYBOLMAZ). Sıfır aransaydı kapı
  // doğru sebepten değil o geri düşüş yüzünden kırmızı olurdu.
  //
  // İKİ MODEL BİRDEN: 64 gül konumunda ölçüldü — açı SERT engel yapılınca
  // BMC 4 → 6, AG00976 11 → 12 çakışmaya çıkıyor. Tek model yetmezdi.
  test('sayıdan kaçmak GÜL çakışmasını ARTIRMIYOR', () => {
    ['AG00976_GATES_2025', 'BMC_FEAD_2026'].forEach((anahtar) => {
      const { build } = kur(anahtar);
      let yeni = 0, eski = 0, fark = 0;
      for (let i = 1; i <= 8; i++) for (let j = 1; j <= 8; j++) {
        const pos = { fx: i / 9, fy: j / 9 };
        const A = fead.veFeadLayoutSVG(build, 440, 458, { nodeId: 'lay', compassPos: pos });
        const B = fead.veFeadLayoutSVG(build, 440, 458,
          { nodeId: 'lay', compassPos: pos, wrapLabels: false });
        const g = /data-cx="([-\d.]+)" data-cy="([-\d.]+)"/.exec(A);
        const m = fead.VE_FEAD_ROSE_HALF + 3;
        const r = { x0: +g[1] - m, x1: +g[1] + m, y0: +g[2] - m, y1: +g[2] + m };
        const a = adKutulari(A), b = adKutulari(B);
        a.forEach((x) => { if (ortusur(x, r)) yeni++; });
        b.forEach((x) => { if (ortusur(x, r)) eski++; });
        if (JSON.stringify(a) !== JSON.stringify(b)) fark++;
      }
      expect(yeni).toBeLessThanOrEqual(eski);
      expect(fark).toBeGreaterThan(30);        // engel gerçekten iş yapıyor (61–64/64)
    });
  });
});

describe('kısa ad YALNIZ çizimde', () => {
  test('parantezli ek atılır, tamamen parantezli ad korunur', () => {
    expect(fead.veFeadShortName('Alternatör (155 A)')).toBe('Alternatör');
    expect(fead.veFeadShortName('Otomatik Gergi (E9843)')).toBe('Otomatik Gergi');
    expect(fead.veFeadShortName('Avara 1')).toBe('Avara 1');
    expect(fead.veFeadShortName('(E9843)')).toBe('(E9843)');      // boş etiket olmaz
    expect(fead.veFeadShortName('')).toBe('');
  });

  test('kartta kısa, VARSAYILAN çağrıda (panel/rapor) tam ad', () => {
    const { build, layout } = kur();
    const kart = fead.veFeadLayoutCardHTML(layout);
    const varsayilan = fead.veFeadLayoutSVG(build, 440, 416);
    expect(varsayilan).toMatch(/Alternatör \(155 A\)/);
    const kartAdlari = adKutulari(kart).map((a) => a.ad);
    expect(kartAdlari).toContain('Alternatör');
    kartAdlari.forEach((a) => expect(a).not.toMatch(/\(/));
  });

  test('tam ad KAYIŞ TABLOSU kartında duruyor — bilgi yer değiştirdi, kaybolmadı', () => {
    const { pack } = kur();
    const tablo = pack.nodes.find((n) => n.type === 'fead-table');
    expect(tablo).toBeTruthy();
    const kart = fead.veFeadTableCardHTML(tablo);
    expect(kart).toMatch(/Alternatör \(155 A\)/);
    expect(kart).toMatch(/Otomatik Gergi \(E9843\)/);
  });
});

describe('künye tablosu KARTTA DEĞİL — Kayış Tablosu kartında', () => {
  // Kart içindeki künye tablosu (ad · Ø · sarım · devir · güç) kanvastaki
  // KAYIŞ TABLOSU kartının sütunlarını ikinci kez yazıyordu: aynı sayı iki
  // yüzeyde. Kalkınca sarım açıları çizime geri döndü.
  test('iki kartın hiçbirinde tablo yok, sarım açıları çizimde', () => {
    const { build, layout, run } = kur();
    [layout, run].forEach((n) => {
      expect(fead.veFeadLayoutCardHTML(n)).not.toMatch(/<tbody>/);
    });
    // Sarım açısı GEOMETRİ kartında; çalışma kartında açıklık gerilmesi var.
    expect(aciKutulari(fead.veFeadLayoutCardHTML(layout)).length).toBe(build.order.length);
    expect(aciKutulari(fead.veFeadLayoutCardHTML(run)).length).toBe(0);
  });
});

describe('gerilme haritası', () => {
  test('ANKRAJ ÇİZİLEN KONUMDAN: kol konumu değişince harita da değişir', () => {
    const { build } = kur();
    const satirlar = veFeadPositionRows(build).filter((r) => r.ok);
    const serbest = satirlar.find((r) => r.key === 'free');
    const mean = satirlar.find((r) => r.key === 'mean');
    const a = veFeadSpanTensionMap(build, serbest.relDeg, 2750);
    const b = veFeadSpanTensionMap(build, mean.relDeg, 2750);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    // Ankraj = o konumun gergi açıklığı gerilmesi (çekirdeğin `slackN`'i).
    expect(a.min).toBeCloseTo(serbest.tensionN, 3);
    expect(b.min).toBeCloseTo(mean.tensionN, 3);
    expect(b.min - a.min).toBeGreaterThan(200);            // ölçüldü: 260 → 544 N
  });

  test('devir yoksa harita YOK — gerilme hız ve güç olmadan tanımsız', () => {
    const { build } = kur();
    expect(veFeadSpanTensionMap(build, F.meanRel(build.sys), 0)).toBeNull();
    expect(veFeadSpanTensionMap(build, F.meanRel(build.sys), null)).toBeNull();
  });

  test('kartta her açıklık kendi rengiyle ve kendi sayısıyla çiziliyor', () => {
    const { build, run } = kur();
    const kart = fead.veFeadLayoutCardHTML(run);
    const yollar = [...kart.matchAll(/data-ve="belt-tension" data-span="(\d+)"/g)];
    expect(yollar.length).toBe(build.order.length);
    const ten = veFeadSpanTensionMap(build, F.meanRel(build.sys), veFeadAnimRpmOf(build, run));
    const sayilar = [...kart.matchAll(/data-ve="span-tension"[^>]*>(\d+) N</g)].map((m) => +m[1]);
    expect(sayilar.sort((x, y) => x - y))
      .toEqual(ten.spanN.map((v) => Math.round(v)).sort((x, y) => x - y));
    // Ölçek çizilir: renk bir SIRALAMA, sayıya çevrilebilmesi için uçlar yazılı.
    expect(kart).toMatch(/data-ve="tension-scale"/);
    expect(kart).toContain(Math.round(ten.min) + ' N');
    expect(kart).toContain(Math.round(ten.max) + ' N');
  });

  test('renk gerilmeyle MONOTON — en gergin açıklık en sıcak', () => {
    const { build } = kur();
    const ten = veFeadSpanTensionMap(build, F.meanRel(build.sys), 2750);
    const kirmizi = (t) => +/rgb\((\d+),/.exec(fead.veFeadTensionColor(t, ten.min, ten.max))[1];
    expect(kirmizi(ten.max)).toBeGreaterThan(kirmizi(ten.min));
    expect(fead.veFeadTensionColor(ten.min, ten.min, ten.max))
      .not.toBe(fead.veFeadTensionColor(ten.max, ten.min, ten.max));
  });

  test('"Durgun" seçilince kayış temel amberine döner', () => {
    const { run } = kur();
    run.data.animRpm = 'off';
    const kart = fead.veFeadLayoutCardHTML(run);
    expect(kart).not.toMatch(/data-ve="belt-tension"/);
    expect(kart).toMatch(/data-ve="belt"/);
  });
});

/* ── GERİLME SAYILARI OKUNUR OLMALI ────────────────────────────────────────
   Kullanıcı bildirimi: "kanvas üzerindeki kayış gerginlikleri iyi
   görülmüyor". Üç ayrı sebep vardı ve üçü de sessizdi — sayı yine
   çiziliyordu, yalnız okunmuyordu. */
const sayiKutulari = (svg) =>
  [...svg.matchAll(/<text data-ve="span-tension" x="([-\d.]+)" y="([-\d.]+)"[^>]*>([^<]*)</g)]
    .map((m) => {
      const x = +m[1], y = +m[2], w = m[3].length * 9 * 0.6;
      return { v: m[3], x, y, x0: x - w / 2, x1: x + w / 2, y0: y - 8, y1: y + 2 };
    });
const gerilmeUclari = (svg) =>
  [...svg.matchAll(/data-ve="belt-tension" data-span="(\d+)" d="M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)"/g)]
    .map((m) => ({ i: +m[1], ax: +m[2], ay: +m[3], bx: +m[4], by: +m[5] }));
const kasnakMerkezleri = (svg) =>
  [...svg.matchAll(/<circle data-ve="pulley" cx="([-\d.]+)" cy="([-\d.]+)"/g)]
    .map((m) => ({ x: +m[1], y: +m[2] }));
/* Doğru parçası ↔ dikdörtgen (yerleştiricinin kendi ölçütü). */
const kesisir = (g, r) => {
  const [x1, y1, x2, y2] = g;
  if (Math.max(x1, x2) < r.x0 || Math.min(x1, x2) > r.x1) return false;
  if (Math.max(y1, y2) < r.y0 || Math.min(y1, y2) > r.y1) return false;
  if ((x1 >= r.x0 && x1 <= r.x1 && y1 >= r.y0 && y1 <= r.y1)
   || (x2 >= r.x0 && x2 <= r.x1 && y2 >= r.y0 && y2 <= r.y1)) return true;
  const dx = x2 - x1, dy = y2 - y1, yan = (x, y) => dx * (y - y1) - dy * (x - x1);
  const a = yan(r.x0, r.y0), b = yan(r.x1, r.y0), c = yan(r.x1, r.y1), d = yan(r.x0, r.y1);
  return !((a > 0 && b > 0 && c > 0 && d > 0) || (a < 0 && b < 0 && c < 0 && d < 0));
};

describe('gerilme sayısı okunur', () => {
  const KART = [[440, 374], [440, 458], [380, 330], [340, 298]];

  test('sayı ÇERÇEVENİN İÇİNDE — sağdaki açıklıkta kırpılmıyor', () => {
    // AG00879 @800 dev/dk · 440×458 KAYNAK VAKA: kenetleme olmadan "1231 N"
    // kartın sağ kenarından taşıp kırpılıyor (kullanıcının gönderdiği kart).
    [['AG00976_GATES_2025', 2750], ['AG00879_GATES_2023', 800],
     ['AG00879_GATES_2023', 2750], ['BMC_FEAD_2026', 2750]].forEach(([anahtar, rpm]) => {
      const { build } = kur(anahtar);
      const ten = veFeadSpanTensionMap(build, F.meanRel(build.sys), rpm);
      expect(ten).not.toBeNull();
      KART.forEach(([W, H]) => {
        const svg = fead.veFeadLayoutSVG(build, W, H, { nodeId: 'lay', tension: ten });
        const kutu = sayiKutulari(svg);
        expect(kutu.length).toBe(build.order.length);
        kutu.forEach((b) => {
          expect(b.x0).toBeGreaterThanOrEqual(0);
          expect(b.x1).toBeLessThanOrEqual(W);
          expect(b.y0).toBeGreaterThanOrEqual(0);
          expect(b.y1).toBeLessThanOrEqual(H);
        });
      });
    });
  });

  // SABİT NORMAL yarı yarıya çizimin İÇİNE bakıyordu: sayı kalabalığın üstüne
  // düşüyordu. Yön artık kümenin ağırlık merkezinden DIŞA seçiliyor.
  test('sayı açıklığın DIŞ tarafında — merkezden uzaklaşıyor', () => {
    const { build } = kur('AG00879_GATES_2023');
    const ten = veFeadSpanTensionMap(build, F.meanRel(build.sys), 800);
    const svg = fead.veFeadLayoutSVG(build, 440, 374, { nodeId: 'lay', tension: ten });
    const uc = gerilmeUclari(svg), say = sayiKutulari(svg), mrk = kasnakMerkezleri(svg);
    expect(uc.length).toBe(build.order.length);
    const cx = mrk.reduce((a, p) => a + p.x, 0) / mrk.length;
    const cy = mrk.reduce((a, p) => a + p.y, 0) / mrk.length;
    const uzak = (x, y) => Math.hypot(x - cx, y - cy);
    let disari = 0;
    uc.forEach((g, k) => {
      const orta = uzak((g.ax + g.bx) / 2, (g.ay + g.by) / 2);
      // Ölçüt "hepsi uzaklaşsın" DEĞİL: çerçeve kenetlemesi bir etiketi geri
      // çekebiliyor ve merkeze göre teğet bir açıklıkta radyal fark zaten
      // sıfıra yakın (ölçüldü: −1,3 px). Aranan şey hiçbir etiketin İÇERİ
      // sürüklenmemesi, ve biri hariç hepsinin gerçekten dışarı çıkması —
      // sabit normale dönülürse yarısı içeri düşüyor.
      expect(uzak(say[k].x, say[k].y)).toBeGreaterThan(orta - 2);
      if (uzak(say[k].x, say[k].y) > orta + 3) disari++;
    });
    expect(disari).toBeGreaterThanOrEqual(uc.length - 1);
  });

  // Sayı YUMUŞAK engeldir (gül ve açıklıklar sert): kart daraltılınca ad,
  // sert engellerden kaçarken bir sayının üstüne düşebilir — ölçüldü, yalnız
  // 340×298 ve 380×330'da ve engel olmasa da düşüyordu. Bu yüzden iki ayrı
  // ölçüt: KULLANIMDAKİ ölçülerde sıfır, her ölçüde ARTMAMA.
  test('kart ölçüsünde sayı ile ad çakışmıyor', () => {
    ['AG00976_GATES_2025', 'AG00879_GATES_2023', 'BMC_FEAD_2026'].forEach((anahtar) => {
      const { build } = kur(anahtar);
      const ten = veFeadSpanTensionMap(build, F.meanRel(build.sys), 2750);
      [[440, 374], [440, 458]].forEach(([W, H]) => {
        const svg = fead.veFeadLayoutSVG(build, W, H,
          { nodeId: 'lay', tension: ten, shortNames: true, wrapLabels: false });
        const say = sayiKutulari(svg), ad = adKutulari(svg);
        say.forEach((a) => ad.forEach((b) => expect(ortusur(a, b)).toBe(false)));
      });
    });
  });

  test('sayıyı engel saymak çakışmayı ARTIRMIYOR — dar kartta da', () => {
    ['AG00976_GATES_2025', 'AG00879_GATES_2023', 'BMC_FEAD_2026'].forEach((anahtar) => {
      const { build } = kur(anahtar);
      const ten = veFeadSpanTensionMap(build, F.meanRel(build.sys), 2750);
      let yeni = 0, eski = 0;
      KART.forEach(([W, H]) => {
        const o = { nodeId: 'lay', shortNames: true, wrapLabels: false };
        const A = fead.veFeadLayoutSVG(build, W, H, Object.assign({ tension: ten }, o));
        const B = fead.veFeadLayoutSVG(build, W, H, o);     // sayı engeli YOK
        const say = sayiKutulari(A);
        adKutulari(A).forEach((b) => say.forEach((a) => { if (ortusur(a, b)) yeni++; }));
        adKutulari(B).forEach((b) => say.forEach((a) => { if (ortusur(a, b)) eski++; }));
      });
      expect(yeni).toBeLessThanOrEqual(eski);
    });
  });

  // HÂLE ŞART: sayı kayışın, dişlerin ve kasnak çemberinin ÜSTÜNDE duruyor.
  // Renk rampadan ALINMAZ — rampanın orta durağı kayışın amberi olmak zorunda
  // ve o amber açık temada beyaz üstünde okunmuyor.
  test('sayı zemin renginde hâle taşır, metin rengiyle yazılır', () => {
    const { build } = kur();
    const ten = veFeadSpanTensionMap(build, F.meanRel(build.sys), 2750);
    const svg = fead.veFeadLayoutSVG(build, 440, 374, { nodeId: 'lay', tension: ten });
    const et = /<text data-ve="span-tension"[^>]*>/.exec(svg)[0];
    expect(et).toMatch(/paint-order="stroke"/);
    expect(et).toMatch(/stroke="var\(--bg-input\)"/);
    expect(et).toMatch(/fill="var\(--text-primary\)"/);
    expect(et).not.toMatch(/fill="rgb\(/);
    expect(et).toMatch(/font-weight="600"/);
    expect(et).toMatch(/font-size="9"/);   // kutu tahmini bu puntodan türer
  });
});

describe('künye TEK SATIR — ama damgalar kalır', () => {
  test('kinematik ve titreşim aynı satırda; ağır çekim ve KALİBRE DEĞİL yerinde', () => {
    const { run } = kur();
    run.data.vibMode = 'span';
    const kart = fead.veFeadLayoutCardHTML(run);
    const satir = [...kart.matchAll(/data-ve="anim-label"[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(satir.length).toBe(1);
    expect(satir[0]).toMatch(/ağır çekim/);
    expect(satir[0]).toMatch(/KALİBRE DEĞİL/);
    expect(satir[0]).toMatch(/dev\/dk/);
  });
});
