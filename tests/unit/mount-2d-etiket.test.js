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

/* ── ÇİZGİ YAZIYI KESMEZ (2026-10-15) ─────────────────────────────────────
 * Ölçülen (gerçek tarayıcı, yerleşim kapısının "çizgi" ölçütü): sihirbazın
 * masasında 9, 2D Görünüm panelinde 27 yazının içinden bir çizgi geçiyordu —
 * ızgara, referans ve kılavuz çizgileri hâlesiz yazının altından; ayrıca
 * "Ön Takoz Braketi"nin kılavuzu "Ön Takoz"un, "Braket"inki "Sağ Arka
 * Takoz"un ÜSTÜNDEN geçiyordu, masada uçtaki takozun karesi y ekseninin
 * "0"ını, panelde "Z = 0" yazısını örtüyordu. */
describe('Takoz kesit çizimi — çizgi yazının altında kalır, işaret yazıyı örtmez', () => {
  const veri = tulga();
  const panel = cp._mnt2DViewSVG(veri, 955).split('<svg class="ve-mnt2d-fig"').slice(1);
  const masa = [];
  [[1098, 824], [900, 640], [700, 520]].forEach(([W, H]) => ['ust', 'yan', 'on'].forEach((g) =>
    masa.push(cp.veMnt2DGorunusSVG(veri, W, H, { gorunus: g }))));
  const hepsi = panel.concat(masa);
  // Sırayla öğeler: yazı (kutusu) ve kılavuz (0,7 px çizgi)
  function ogeler(svg) {
    const out = [];
    const re = /<text ([^>]*)>([^<]*)<\/text>|<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)" stroke="var\(--border-color\)" stroke-width="0.7"\/>/g;
    let m;
    while ((m = re.exec(svg))) {
      if (m[1] !== undefined) {
        const a = (k) => { const q = new RegExp(k + '="([^"]*)"').exec(m[1]); return q ? q[1] : null; };
        const t = m[2].replace(/&amp;/g, '&');
        out.push({ tur: 'yazi', t, attr: m[1], k: cp._mnt2DYaziKutu(+a('x'), +a('y'), t, a('text-anchor'), +a('font-size'), a('font-weight') === '700') });
      } else out.push({ tur: 'kilavuz', s: [+m[3], +m[4], +m[5], +m[6]] });
    }
    return out;
  }
  const kesisir = (s, k) => {
    for (let i = 0; i <= 24; i++) {
      const x = s[0] + (s[2] - s[0]) * i / 24, y = s[1] + (s[3] - s[1]) * i / 24;
      if (x > k.l + 1 && x < k.r - 1 && y > k.t + 1 && y < k.b - 1) return true;
    }
    return false;
  };

  test('her yazı zeminin renginde hâle taşır — panelde dış kutunun, masada masanın', () => {
    const halesiz = [];
    hepsi.forEach((f, i) => ogeler(f).filter((o) => o.tur === 'yazi').forEach((o) => {
      if (!/paint-order="stroke"/.test(o.attr)) halesiz.push(`${i}: ${o.t}`);
    }));
    expect(halesiz).toEqual([]);
    expect(panel[0]).toMatch(/<text [^>]*stroke="var\(--bg-secondary\)"/);
    expect(masa[0]).toMatch(/<text [^>]*stroke="var\(--bg-input\)"/);
  });

  test('kılavuz, kendisinden ÖNCE yazılmış bir yazının üstünden geçmez', () => {
    const ustte = [];
    hepsi.forEach((f, i) => {
      const o = ogeler(f);
      o.forEach((k, j) => {
        if (k.tur !== 'kilavuz') return;
        for (let a = 0; a < j; a++) if (o[a].tur === 'yazi' && kesisir(k.s, o[a].k)) ustte.push(`${i}: "${o[a].t}"`);
      });
    });
    expect(ustte).toEqual([]);
  });

  // İşaretin kutusu: data-mnt-info grubunun dikdörtgeni ve dairesi
  function isaretler(svg) {
    const out = [];
    for (const g of svg.matchAll(/<g data-mnt-info="([^"]*)"[^>]*>([\s\S]*?)<\/g>/g)) {
      for (const r of g[2].matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g))
        out.push({ l: +r[1], t: +r[2], r: +r[1] + +r[3], b: +r[2] + +r[4] });
      for (const c of g[2].matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/g))
        if (!/fill="transparent"/.test(c[0])) out.push({ l: +c[1] - +c[3], t: +c[2] - +c[3], r: +c[1] + +c[3], b: +c[2] + +c[3] });
    }
    return out;
  }
  test('masada uçtaki işaret eksen değerini örtmez (iç pay)', () => {
    const sayi = /^[−-]?[\d.]+$/, ortulen = [];
    masa.forEach((f, i) => {
      const deger = ogeler(f).filter((o) => o.tur === 'yazi' && sayi.test(o.t));
      expect(deger.length).toBeGreaterThan(3);
      const is = isaretler(f);
      deger.forEach((d) => { if (is.some((k) => cp._mnt2DKesisir(d.k, k, 0))) ortulen.push(`${i}: ${d.t}`); });
    });
    expect(ortulen).toEqual([]);
  });

  test('panelde "Z = 0" yazısı işaretin altında kalmaz (yan ve ön görünüş)', () => {
    const ortulen = [];
    let n = 0;
    panel.forEach((f, i) => {
      ogeler(f).filter((o) => o.tur === 'yazi' && /^[YZ] = 0$/.test(o.t)).forEach((r) => {
        n++;
        if (isaretler(f).some((k) => cp._mnt2DKesisir(r.k, k, 0))) ortulen.push(`${i}: ${r.t}`);
      });
    });
    expect(n).toBe(2);                       // üstten görünüşte referans yazısı yok
    expect(ortulen).toEqual([]);
  });
});
