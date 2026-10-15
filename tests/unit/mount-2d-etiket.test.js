/**
 * mount-2d-etiket.test.js — TAKOZ KESİT ÇİZİMİNİN YAZISI OKUNUR VE ÇAKIŞMAZ
 * ───────────────────────────────────────────────────────────────────────
 * Ölçülen (Tulga örneği, 1920 × 952, tests/e2e/yerlesim.spec.js):
 *   · çizim 980 birimlik sabit kutuda kurulup kaba sığdırılıyordu — eksen
 *     değerleri 7,8 px, takoz adları 8,8 px, bileşen adları 9,3 px
 *   · 9 yazı çifti üst üste: eski yerleştirici yalnız aynı yandaki
 *     etiketlerin YATAY aralıklarını kademeliyordu; farklı yükseklikteki
 *     işaretlerin etiketleri, öteki yanın etiketleri ve sabit yazılar ("Z = 0",
 *     eksen değeri, +X) hiç karşılaştırılmıyordu
 * Burada çizicinin kendi kutu tahminiyle ölçülür (hızlı kapı); gerçek kutular
 * tarayıcıda, yerleşim kapısında.
 */
const cp = require('../../js/cp-mount.js');
const ornek = require('../../assets/examples/tulga_topoloji.json');

const GOVDE = { 'mnt-motor': 'Motor', 'mnt-gearbox': 'Şanzıman', 'mnt-transfer': 'Transfer Kutusu', 'mnt-bracket': 'Braket' };
function tulga() {
  global.nodes = ornek.nodes.map((n) => Object.assign({}, n, {
    def: GOVDE[n.type] ? { isMountBody: true, name: GOVDE[n.type] } : (n.type === 'mnt-mount' ? { isMount: true, name: 'Takoz' } : {}),
  }));
  try { return cp._mnt2DGather(); } finally { delete global.nodes; }
}
// <text x y text-anchor font-size [font-weight]>içerik</text> → kutu (çizicinin tahmini)
function yazilar(svg) {
  const out = [];
  const re = /<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" font-size="([\d.]+)"[^>]*?(font-weight="700")?>([^<]*)<\/text>/g;
  let m;
  while ((m = re.exec(svg))) {
    const t = m[6].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    out.push({ t, px: Number(m[4]), k: cp._mnt2DYaziKutu(Number(m[1]), Number(m[2]), t, m[3], Number(m[4]), !!m[5]) });
  }
  return out;
}

describe('Takoz kesit çizimi (Tulga)', () => {
  const veri = tulga();
  const figurler = cp._mnt2DViewSVG(veri, 955).split('<svg class="ve-mnt2d-fig"').slice(1);

  test('örnek gerçekten dolu: beş takoz, bileşenler, birleşik CG, üç görünüş', () => {
    expect(veri.mounts.length).toBe(5);
    expect(veri.comps.length).toBeGreaterThanOrEqual(4);
    expect(veri.cg).toBeTruthy();
    expect(figurler.length).toBe(3);
  });

  test('görünüm kabın genişliğinde 1:1 kurulur (viewBox = kap); kap verilmezse 980', () => {
    expect(figurler[0]).toMatch(/^ viewBox="0 0 955 /);
    expect(cp._mnt2DViewSVG(veri)).toMatch(/viewBox="0 0 980 /);
    expect(cp._mnt2DViewSVG(veri, 300)).toMatch(/viewBox="0 0 640 /);   // taban: altı sıkışmaz
  });

  test('hiçbir yazı ölçek tabanının (10 px) altında değil', () => {
    const kucuk = [];
    figurler.forEach((f) => yazilar(f).forEach((y) => { if (y.px < 10) kucuk.push(`${y.t} ${y.px}`); }));
    expect(kucuk).toEqual([]);
  });

  // Çakışan değer yazılmıyor (çizgisi kalıyor) — ama kaçınılabilen bir
  // çakışma yüzünden değil: eksen göstergesi (+X/+Z okları) sol değer
  // sütununa düşüyordu ve yan/önden görünüşte en üst ızgaranın "500"ü,
  // okları saran tek dikdörtgen yüzünden üstten görünüşte "300" düşüyordu.
  test('her ızgara çizgisinin DEĞERİ yazılı — eksen göstergesi değer sütunundan kaçar', () => {
    const sayi = /^[−-]?[\d.]+$/;
    figurler.concat(cp._mnt2DViewSVG(veri, 640).split('<svg class="ve-mnt2d-fig"').slice(1)).forEach((f, i) => {
      const yatay = [...f.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="[-\d.]+" y2="\2" stroke="var\(--border-color\)" stroke-width="0.5"/g)].length;
      const dikey = [...f.matchAll(/<line x1="([-\d.]+)" y1="[-\d.]+" x2="\1" y2="[-\d.]+" stroke="var\(--border-color\)" stroke-width="0.5"/g)].length;
      const sol = [...f.matchAll(/<text x="[-\d.]+" y="[-\d.]+" text-anchor="end"[^>]*>([^<]*)<\/text>/g)].filter((m) => sayi.test(m[1])).length;
      const alt = [...f.matchAll(/<text x="[-\d.]+" y="[-\d.]+" text-anchor="middle"[^>]*>([^<]*)<\/text>/g)].filter((m) => sayi.test(m[1])).length;
      expect(yatay).toBeGreaterThan(3);
      expect(`${i}: ${sol}/${yatay} · ${alt}/${dikey}`).toBe(`${i}: ${yatay}/${yatay} · ${dikey}/${dikey}`);
    });
  });

  // Uçtaki veri noktası çizim alanının tam kenarına düşüyordu: Tulga'da
  // "Ön Takoz" işareti sol değer sütununa taşıp üstten görünüşün "0"ını
  // örtüyordu (yazı ↔ yazı ölçüsü bunu görmez — örten bir işaret).
  test('işaretler çizim alanının İÇİNDE — değer sütununa taşıp eksen değerini örtmez', () => {
    const PLOT_L = 66, PLOT_R = 40, disari = [];
    figurler.forEach((f, i) => {
      const W = Number(/^ viewBox="0 0 (\d+)/.exec(f)[1]);
      for (const g of f.matchAll(/<g data-mnt-info="([^"]*)">([\s\S]*?)<\/g>/g)) {
        const ad = g[1].split('&#10;')[0];
        for (const r of g[2].matchAll(/<rect x="([-\d.]+)" y="[-\d.]+" width="([\d.]+)"/g))
          if (+r[1] < PLOT_L - 0.5 || +r[1] + +r[2] > W - PLOT_R + 0.5) disari.push(`${i}: ${ad}`);
        for (const c of g[2].matchAll(/<circle cx="([-\d.]+)" cy="[-\d.]+" r="([\d.]+)"/g))
          if (+c[1] - +c[2] < PLOT_L - 0.5 || +c[1] + +c[2] > W - PLOT_R + 0.5) disari.push(`${i}: ${ad}`);
      }
    });
    expect(disari).toEqual([]);
  });

  test('aynı görünüşte iki yazı üst üste değil (etiketler, eksen değerleri, "Z = 0", +X)', () => {
    const binen = [];
    figurler.forEach((f, i) => {
      const y = yazilar(f);
      expect(y.length).toBeGreaterThan(15);
      for (let a = 0; a < y.length; a++) for (let b = a + 1; b < y.length; b++)
        if (cp._mnt2DKesisir(y[a].k, y[b].k, 0)) binen.push(`${i}: "${y[a].t}" ↔ "${y[b].t}"`);
    });
    expect(binen).toEqual([]);
  });
});
