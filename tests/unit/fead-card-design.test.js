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
  const build = veFeadBuildSystem(pack.nodes, pack.connections);
  const layout = pack.nodes.find((n) => n.type === 'fead-layout');
  return { pack, build, layout };
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

  test('tam ad kartın TABLOSUNDA duruyor — bilgi yer değiştirdi, kaybolmadı', () => {
    const { layout } = kur();
    const kart = fead.veFeadLayoutCardHTML(layout);
    expect(kart).toMatch(/Alternatör \(155 A\)/);
    expect(kart).toMatch(/Otomatik Gergi \(E9843\)/);
  });
});

describe('künye tablosu — sayılar şemayla AYNI konumdan', () => {
  const hucreler = (html) => {
    const govde = /<tbody>([\s\S]*?)<\/tbody>/.exec(html);
    return (govde ? [...govde[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)] : [])
      .map((r) => [...r[1].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((c) => c[1]));
  };

  test('her kasnak bir satır; sarım · Ø · devir · güç çekirdekle birebir', () => {
    const { build, layout } = kur();
    const kart = fead.veFeadLayoutCardHTML(layout);
    const sat = hucreler(kart);
    expect(sat.length).toBe(build.order.length);
    const geom = geomOf(build);
    const rpm = veFeadAnimRpmOf(build, layout);
    const ten = veFeadSpanTensionMap(build, F.meanRel(build.sys), rpm);
    expect(ten).not.toBeNull();
    sat.forEach((c, i) => {
      expect(c[0]).toBe(build.names[i]);                       // TAM ad
      expect(+c[1]).toBeCloseTo(build.order[i].data.od, 6);    // dış çap
      expect(parseFloat(c[2])).toBeCloseTo(geom.wrapDeg(i), 1);
      expect(+c[3]).toBe(Math.round(ten.perPulley[i].accessoryRpm));
      expect(parseFloat(c[4])).toBeCloseTo(ten.perPulley[i].powerKw, 2);
    });
  });

  test('sarım açıları ÇİZİMDEN kalkar — iki kez yazılmaz', () => {
    const { layout } = kur();
    expect(aciKutulari(fead.veFeadLayoutCardHTML(layout)).length).toBe(0);
  });

  // TABLO ÇİZİMİ EZEMEZ. Kart daraltılınca tablo düşüyor ve açılar çizime GERİ
  // dönüyor: sayı hiçbir kipte kaybolmuyor — ya tabloda ya kasnağın altında.
  test('dar kartta tablo düşer, açılar çizime geri döner', () => {
    const { build, layout } = kur();
    layout.height = 210;
    const dar = fead.veFeadLayoutCardHTML(layout);
    expect(dar).not.toMatch(/<tbody>/);
    expect(aciKutulari(dar).length).toBe(build.order.length);
    layout.height = VE_FEAD_LAYOUT_H;
    const genis = fead.veFeadLayoutCardHTML(layout);
    expect(genis).toMatch(/<tbody>/);
    expect(aciKutulari(genis).length).toBe(0);
  });

  test('devir seçili değilse devir ve güç sütunu "—" — uydurulmuş sayı yok', () => {
    const { layout } = kur();
    layout.data.animRpm = 'off';
    const sat = hucreler(fead.veFeadLayoutCardHTML(layout));
    expect(sat.length).toBeGreaterThan(0);
    sat.forEach((c) => { expect(c[3]).toBe('—'); expect(c[4]).toBe('—'); });
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
    const { build, layout } = kur();
    const kart = fead.veFeadLayoutCardHTML(layout);
    const yollar = [...kart.matchAll(/data-ve="belt-tension" data-span="(\d+)"/g)];
    expect(yollar.length).toBe(build.order.length);
    const ten = veFeadSpanTensionMap(build, F.meanRel(build.sys), veFeadAnimRpmOf(build, layout));
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
    const { layout } = kur();
    layout.data.animRpm = 'off';
    const kart = fead.veFeadLayoutCardHTML(layout);
    expect(kart).not.toMatch(/data-ve="belt-tension"/);
    expect(kart).toMatch(/data-ve="belt"/);
  });
});

describe('künye TEK SATIR — ama damgalar kalır', () => {
  test('kinematik ve titreşim aynı satırda; ağır çekim ve KALİBRE DEĞİL yerinde', () => {
    const { layout } = kur();
    layout.data.vibMode = 'span';
    const kart = fead.veFeadLayoutCardHTML(layout);
    const satir = [...kart.matchAll(/data-ve="anim-label"[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(satir.length).toBe(1);
    expect(satir[0]).toMatch(/ağır çekim/);
    expect(satir[0]).toMatch(/KALİBRE DEĞİL/);
    expect(satir[0]).toMatch(/dev\/dk/);
  });
});
