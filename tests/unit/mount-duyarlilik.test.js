/**
 * mount-duyarlilik.test.js — TAKOZ VE EKSEN BAŞINA FREKANS DUYARLILIĞI
 * ─────────────────────────────────────────────────────────────────────
 * Kullanıcı isteği (2026-10-16): optimizasyonun ilk adımı — "hangi takozun
 * hangi ekseni hangi modu ne kadar oynatıyor". Çekirdek (js/mount-core.js):
 *   modalSensitivity      ∂f/∂k analitik, esneklik e = (k/f)·∂f/∂k
 *   modesWithSpringScale  tek yay ölçeklenince KESİN (yeniden çözülmüş) modlar
 *   springScaleFor        bir ölçüt sınıra hangi ölçekte ulaşır (tarama + ikiye bölme)
 * Çözüm R.sensitivity'yi modları üreten AYNI tabandan yazar (cp-mount.js).
 *
 * HAKEM çekirdeğin özdeğer çözücüsünü ÇAĞIRMAZ: sonlu farkın özdeğerleri
 * det(K − λM) = 0'ın sekant köküdür; K ve M yardımcının bağımsız kurucularından
 * (tests/helpers/takoz-dogrulama.js → topla6 · M6of · det).
 */
const H = require('../helpers/takoz-dogrulama.js');
const { core } = H.kur();

const ORNEKLER = core.getMountExampleList().map((e) => e.id);
const R = {};
ORNEKLER.forEach((id) => { R[id] = H.coz(H.ornek(id)); });

// det(K − λM) = 0'ın λ0 yakınındaki kökü (sekant) — çekirdekten bağımsız özdeğer.
function ozdegerKok(K, M, l0) {
  const p = (l) => H.det(K.map((r, i) => r.map((v, j) => v - l * M[i][j])));
  let a = l0 * (1 - 1e-7), b = l0 * (1 + 1e-7), pa = p(a), pb = p(b);
  for (let it = 0; it < 80 && pb !== pa; it++) {
    const c = b - pb * (b - a) / (pb - pa);
    a = b; pa = pb; b = c; pb = p(b);
    if (Math.abs(b - a) <= 1e-15 * Math.abs(b)) break;
  }
  return b;
}
const taban = (Rx) => core.dynStiffBasis(Rx.mounts, Rx.kBasis);
const M6 = (Rx) => H.M6of(Rx.mp.m, Rx.mp.I_G);
const toplam = (s) => s.e.flat().reduce((a, b) => a + b, 0);

describe('esneklik toplamı: her modda Σ e = ½ (bütün yaylar aynı oranda → f karekökü kadar)', () => {
  test.each(ORNEKLER)('%s', (id) => {
    const S = R[id].sensitivity;
    expect(S).toHaveLength(6);
    S.forEach((s) => expect(Math.abs(toplam(s) - 0.5)).toBeLessThan(1e-12));
  });
  test('kamyon nonlineer: taban statik dengedeki dinamik TANJANT — nominal k_din ile toplam ½ değil', () => {
    const Rx = R.kamyon;
    expect(Rx.solvedNL).toBe(true);
    const yanlis = core.modalSensitivity(Rx.modes, M6(Rx), Rx.mounts, Rx.mp.cg, null);
    expect(Math.max(...yanlis.map((s) => Math.abs(toplam(s) - 0.5)))).toBeGreaterThan(0.01);
  });
});

describe('sonlu fark hakemi: analitik e = merkezî fark (özdeğer det köklerinden)', () => {
  test.each(ORNEKLER)('%s — bütün takoz · eksen · mod', (id) => {
    const Rx = R[id], kb = taban(Rx), M = M6(Rx), h = 1e-5;
    let enKotu = 0, enKotuF = 0;
    Rx.mounts.forEach((_, i) => [0, 1, 2].forEach((ax) => {
      const kp = kb.map((r) => r.slice()); kp[i][ax] *= 1 + h;
      const km = kb.map((r) => r.slice()); km[i][ax] *= 1 - h;
      const Kp = H.topla6(Rx.mounts, Rx.mp.cg, kp), Km = H.topla6(Rx.mounts, Rx.mp.cg, km);
      Rx.modes.forEach((md, r) => {
        const l0 = Math.pow(2 * Math.PI * md.f_Hz, 2), lp = ozdegerKok(Kp, M, l0), lm = ozdegerKok(Km, M, l0);
        const eFD = (lp - lm) / (4 * h * l0);
        enKotu = Math.max(enKotu, Math.abs(Rx.sensitivity[r].e[i][ax] - eFD));
        // mutlak türev Hz/(N/m): f = √λ/2π'nin farkı, esneklikten AYRI yazım
        const dfFD = (Math.sqrt(lp) - Math.sqrt(lm)) / (2 * Math.PI) / (2 * h * kb[i][ax]);
        enKotuF = Math.max(enKotuF, Math.abs(Rx.sensitivity[r].dfdk[i][ax] - dfFD) * kb[i][ax] / md.f_Hz);
      });
    }));
    expect(enKotu).toBeLessThan(1e-7);
    expect(enKotuF).toBeLessThan(1e-7);
  });
});

describe('kutu — kapalı form (ayrışık dörtlü, ağırlık merkezi yüksekliğinde)', () => {
  const j = H.ornek('kutu');
  const g = j.nodes.find((n) => n.type === 'mnt-motor').data;
  const t = j.nodes.filter((n) => n.type === 'mnt-mount').map((n) => n.data);
  const Lx = Math.abs(t[0].x - g.cgx), Ly = Math.abs(t[0].y - g.cgy);
  const kx = t[0].kxd, ky = t[0].kyd;
  // [mod etiketi] → takoz başına [e_x, e_y, e_z] (dört takoz özdeş)
  const BEK = {
    bounce: [0, 0, 1 / 8], roll: [0, 0, 1 / 8], pitch: [0, 0, 1 / 8],
    lateral: [0, 1 / 8, 0], 'fore-aft': [1 / 8, 0, 0],
    yaw: [kx * Ly * Ly, ky * Lx * Lx, 0].map((v) => v / (8 * (kx * Ly * Ly + ky * Lx * Lx))),
  };
  test('altı modun her biri, dört takozun her ekseni ≤ 10⁻¹²', () => {
    const Rx = R.kutu;
    expect(Rx.modes.map((m) => m.label).sort()).toEqual(Object.keys(BEK).sort());
    Rx.modes.forEach((md, r) => Rx.sensitivity[r].e.forEach((row) =>
      row.forEach((v, ax) => expect(Math.abs(v - BEK[md.label][ax])).toBeLessThan(1e-12))));
  });
});

describe('çakışık mod: mod şekli tek değil → kümenin ortalaması, işaretli', () => {
  // Kare dörtlü, k_x = k_y, takozlar ağırlık merkezi yüksekliğinde: ileri-geri ile
  // yanal AYNI frekans. Tek tek türev keyfi tabana bağlı; kümenin toplamı değil.
  const model = (kyCarpan) => H.kurguModel({
    govdeler: [{ ad: 'Gövde', m: 1200, cg: [0, 0, 500], kutu: [1100, 700, 800] }],
    takozlar: H.dortluTakoz([0, 0, 500], 400, 400, 0, [900, 900, 400], [1400, 1400 * kyCarpan, 600]),
  });
  // Tam eşit ve YUVARLAMA DÜZEYİNDE farklı (10⁻¹⁰) iki hâl de küme: ikincisinde iki
  // frekans bit bit aynı çıkmaz, sıfır toleranslı bir karşılaştırma onu kaçırırdı.
  test.each([['tam eşit', 1], ['10⁻¹⁰ farklı', 1 + 1e-10]])('%s k_x = k_y: iki mod çakışık, değerler ortalama (1/16), toplam yine ½', (_, carpan) => {
    const Rx = H.coz(model(carpan));
    const c = Rx.sensitivity.map((s, r) => (s.cakisik ? r : -1)).filter((r) => r >= 0);
    expect(c).toHaveLength(2);
    c.forEach((r) => {
      Rx.sensitivity[r].e.forEach((row) => {
        expect(Math.abs(row[0] - 1 / 16)).toBeLessThan(1e-9);
        expect(Math.abs(row[1] - 1 / 16)).toBeLessThan(1e-9);
        expect(Math.abs(row[2])).toBeLessThan(1e-12);
      });
      // küme üyelerinin λ'sı farkın mertebesinde ayrık → toplam ½'den o kadar sapar
      expect(Math.abs(toplam(Rx.sensitivity[r]) - 0.5)).toBeLessThan(1e-9);
    });
  });
  test('binde bir asimetri: çakışma YOK, modlar kendi eksenine döner (1/8 · 0)', () => {
    const Rx = H.coz(model(1.001));
    expect(Rx.sensitivity.some((s) => s.cakisik)).toBe(false);
    const fa = Rx.modes.findIndex((m) => m.label === 'fore-aft');
    Rx.sensitivity[fa].e.forEach((row) => {
      expect(Math.abs(row[0] - 1 / 8)).toBeLessThan(1e-9);
      expect(Math.abs(row[1])).toBeLessThan(1e-9);
    });
  });
});

describe('Rayleigh: sertleşen yay hiçbir frekansı düşürmez (kaldıraç aramasının dayanağı)', () => {
  test.each(ORNEKLER)('%s — her yay ×1,1 yeniden çözülür', (id) => {
    const Rx = R[id];
    Rx.sensitivity.forEach((s) => s.e.flat().forEach((v) => expect(v).toBeGreaterThanOrEqual(0)));
    Rx.mounts.forEach((_, i) => [0, 1, 2].forEach((ax) => {
      const md = core.modesWithSpringScale(Rx.mounts, Rx.mp.cg, M6(Rx), Rx.kBasis, i, ax, 1.1);
      md.forEach((m, r) => expect(m.f_Hz).toBeGreaterThanOrEqual(Rx.modes[r].f_Hz * (1 - 1e-12)));
    }));
  });
  test('ölçek 1: yeniden çözüm çözümün kendi modlarını verir (aynı taban)', () => {
    ORNEKLER.forEach((id) => {
      const Rx = R[id];
      const md = core.modesWithSpringScale(Rx.mounts, Rx.mp.cg, M6(Rx), Rx.kBasis, 0, 2, 1);
      md.forEach((m, r) => expect(H.bagil(m.f_Hz, Rx.modes[r].f_Hz)).toBeLessThan(1e-12));
    });
  });
});

describe('springScaleFor: ölçüt sınıra hangi ölçekte ulaşır', () => {
  const Rx = R.hafif, M = M6(Rx);
  const en = (r) => { let b = null; Rx.sensitivity[r].e.forEach((row, i) => row.forEach((v, ax) => { if (!b || v > b.e) b = { i, ax, e: v }; })); return b; };
  const fmax = (md) => md[md.length - 1].f_Hz;
  test('Kriter 1 payı: bulunan ölçekte en yüksek mod tam sınırda; doğrusal tahminle %5 içinde', () => {
    const L = 12.5, b = en(5);
    const z = core.springScaleFor(Rx.mounts, Rx.mp.cg, M, Rx.kBasis, b.i, b.ax, fmax, L, +1);
    expect(z).not.toBeNull();
    expect(z.s).toBeGreaterThan(1);
    expect(Math.abs(fmax(z.modes) - L)).toBeLessThan(1e-6);
    const dogrusal = 1 + (L / fmax(Rx.modes) - 1) / b.e;
    expect(H.bagil(z.s - 1, dogrusal - 1)).toBeLessThan(0.05);
  });
  test('yumuşatma yönü: ölçek < 1 ve hedefi geçen taraf döner', () => {
    const b = en(3), f4 = (md) => md[3].f_Hz;
    const z = core.springScaleFor(Rx.mounts, Rx.mp.cg, M, Rx.kBasis, b.i, b.ax, f4, 10, -1);
    expect(z.s).toBeLessThan(1);
    expect(f4(z.modes)).toBeLessThanOrEqual(10);
    expect(10 - f4(z.modes)).toBeLessThan(1e-6);
  });
  test('etkisiz kaldıraç: aralıkta ulaşılamaz → null', () => {
    const K = R.kutu, km = M6(K);
    const fa = K.modes.findIndex((m) => m.label === 'fore-aft');
    // ileri-geri modunu k_z oynatmaz (e = 0): ×10'da bile kıpırdamaz
    const z = core.springScaleFor(K.mounts, K.mp.cg, km, K.kBasis, 0, 2, (md) => md[fa].f_Hz, K.modes[fa].f_Hz + 1, +1);
    expect(z).toBeNull();
  });
  test('tekdüze olmayan ölçüt (iki modun aralığı): tarama ilk geçişi bulur', () => {
    const gap = (md) => Math.min(...md.slice(1).map((m, k) => m.f_Hz - md[k].f_Hz));
    const g0 = gap(Rx.modes);
    let bulundu = 0;
    Rx.mounts.forEach((_, i) => [0, 1, 2].forEach((ax) => [-1, +1].forEach((yon) => {
      const z = core.springScaleFor(Rx.mounts, Rx.mp.cg, M, Rx.kBasis, i, ax, gap, 0.5, yon);
      if (!z) return;
      bulundu++;
      expect(Math.abs(gap(z.modes) - 0.5)).toBeLessThan(1e-6);
    })));
    expect(g0).toBeGreaterThan(0.5);
    expect(bulundu).toBeGreaterThan(0);
  });
});

// ═══════════════ RAPOR §8.17 ═══════════════
const { rp, cp } = H.kur();
const dom = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
const yuzde = (s) => ((s < 1) ? '−' : '+') + '%' + veSayi(+Math.abs((s - 1) * 100).toFixed(1), null);   // makine: raporun yuvarlamasının aynısı

describe('rapor §8.17 — matris çözümün sayısını basıyor', () => {
  test.each(ORNEKLER)('%s — hücreler R.sensitivity (iki ondalık · nokta < 0,005), toplam satırı 0,50', (id) => {
    const Rx = R[id], html = rp._mntRepSensitivity(Rx, {});
    expect(html).toContain('<h3>8.17 ');
    const satir = [...dom(html).querySelector('table').querySelectorAll('tr')];
    expect(satir).toHaveLength(1 + 3 * Rx.mounts.length + 1);
    Rx.mounts.forEach((_, i) => [0, 1, 2].forEach((ax) => {
      const tds = [...satir[1 + 3 * i + ax].querySelectorAll('td')].slice(ax === 0 ? 2 : 1);
      expect(tds).toHaveLength(6);
      tds.forEach((td, r) => {
        const v = Rx.sensitivity[r].e[i][ax];
        expect(td.textContent).toBe(v >= 0.005 ? veSayi(v, 2, { eksi: '−' }) : '·');
      });
    }));
    expect([...satir[satir.length - 1].querySelectorAll('td')].slice(1).map((td) => td.textContent)).toEqual(Array(6).fill('0,50'));
  });
  test('her mod sütununda TAM bir kalın hücre ve o, çekirdeğin `en` kaldıracı', () => {
    ORNEKLER.forEach((id) => {
      const Rx = R[id], satir = [...dom(rp._mntRepSensitivity(Rx, {})).querySelector('table').querySelectorAll('tr')];
      Rx.sensitivity.forEach((s, r) => {
        const kalin = [];
        Rx.mounts.forEach((_, i) => [0, 1, 2].forEach((ax) => {
          const td = [...satir[1 + 3 * i + ax].querySelectorAll('td')].slice(ax === 0 ? 2 : 1)[r];
          if (/font-weight:700/.test(td.getAttribute('style') || '')) kalin.push([i, ax]);
        }));
        expect(kalin).toEqual([[s.en.i, s.en.ax]]);
      });
    });
  });
  test('bölüm raporda §8.16\'dan SONRA ve gövdenin sonunda', () => {
    global._veMntLast = R.hafif;   // kütle tablosu son çözümü globalden okur
    const h = rp._mntRepSection8(R.hafif, {});
    expect(h.indexOf('<h3>8.17 ')).toBeGreaterThan(h.indexOf('<h3>8.16 '));
    expect(h.indexOf('<h3>8.16 ')).toBeGreaterThan(0);
  });
});

describe('rapor §8.17 — kriter kaldıraçları çekirdeğin aramasıyla AYNI sayı', () => {
  const maks = (md) => Math.max(...md.map((m) => m.f_Hz));
  test('hafif: üç kriter tutuyor; kaldıraçlar ve paylar yeniden çözümle doğrulanıyor', () => {
    const Rx = R.hafif, K = rp._mntRepKaldiraclar(Rx, {});
    expect(K.map((k) => [k.no, k.durum])).toEqual([['1', 'ok'], ['1a', 'ok'], ['1b', 'ok']]);
    // K1: en yüksek mod (6) — Sol Motor k_z sertleşince sınıra (½·f_ateş = 12,5 Hz) değer
    expect([Rx.mounts[K[0].b.i].name, K[0].b.ax]).toEqual(['Sol Motor Takozu', 2]);
    expect(Math.abs(maks(K[0].z.modes) - 12.5)).toBeLessThan(1e-6);
    expect(K[0].sonuc).toBe(yuzde(K[0].z.s) + ' sertleşmede sınıra değer');
    expect(K[0].sonuc).toBe('+%7,4 sertleşmede sınıra değer');
    // K1b: 10,24 Hz'teki mod 4 — Sağ Motor k_z yumuşayınca banda (10 Hz) iner
    expect([Rx.mounts[K[2].b.i].name, K[2].b.ax]).toEqual(['Sağ Motor Takozu', 2]);
    expect(Math.abs(K[2].z.modes[3].f_Hz - 10)).toBeLessThan(1e-6);
    expect(K[2].sonuc).toBe('−%5,3 yumuşamada banda girer');
    // K1a: en küçük aralık 0,5 Hz'e iner
    const gap = (md) => Math.min(...md.slice(1).map((m, k) => m.f_Hz - md[k].f_Hz));
    expect(Math.abs(gap(K[1].z.modes) - 0.5)).toBeLessThan(1e-6);
  });
  test('her satırda yeniden çözüm doğrusal tahminle AYNI YÖNDE; hafifte kapanan çift 1–2', () => {
    let n = 0;
    ORNEKLER.forEach((id) => rp._mntRepKaldiraclar(R[id], {}).forEach((k) => {
      if (!k.z || !(k.dogrusal > 0)) return;
      n++;
      expect(`${id} ${k.no} ${Math.sign(k.z.s - 1)}`).toBe(`${id} ${k.no} ${Math.sign(k.dogrusal - 1)}`);
    }));
    expect(n).toBeGreaterThanOrEqual(12);
    const a = rp._mntRepKaldiraclar(R.hafif, {}).find((k) => k.no === '1a'), md = a.z.modes;
    expect(a.cift).toEqual([0, 1]);
    expect(Math.abs(md[1].f_Hz - md[0].f_Hz - 0.5)).toBeLessThan(1e-6);
  });
  test('bantta mod: YAKIN kenar seçilir — iki yön ayrı ayrı çözülüp kıyaslanır', () => {
    let n = 0;
    ['kutu', 'siper'].forEach((id) => {
      const Rx = R[id], km = M6(Rx);
      rp._mntRepKaldiraclar(Rx, {}).filter((k) => k.no === '1b' && k.durum === 'no').forEach((k) => {
        const fr = (md) => md[k.mod].f_Hz;
        const za = core.springScaleFor(Rx.mounts, Rx.mp.cg, km, Rx.kBasis, k.b.i, k.b.ax, fr, 8, -1);
        const zu = core.springScaleFor(Rx.mounts, Rx.mp.cg, km, Rx.kBasis, k.b.i, k.b.ax, fr, 10, +1);
        const yakin = [za, zu].filter(Boolean).sort((x, y) => Math.abs(Math.log(x.s)) - Math.abs(Math.log(y.s)))[0];
        expect(k.z.s).toBe(yakin.s);
        n++;
      });
    });
    expect(n).toBe(3);
  });
  test('kutu: 1a ihlal (iki mod 0,01 Hz\'ten yakın) aralığı açan yönde; 1b bantta İKİ mod — tek kaldıraç birini çıkarır, öteki kalır', () => {
    const K = rp._mntRepKaldiraclar(R.kutu, {});
    const a = K.find((k) => k.no === '1a');
    expect(a.durum).toBe('no');
    const m = R.kutu.modes;
    expect(a.kritik).toBe('mod 4–5 · ' + veSayi(m[4].f_Hz - m[3].f_Hz, 3) + ' Hz');
    expect(m[4].f_Hz - m[3].f_Hz).toBeLessThan(0.01);
    expect(a.sonuc).toMatch(/ile aralık 0,5 Hz'i geçer$/);
    const b = K.filter((k) => k.no === '1b');
    expect(b).toHaveLength(2);
    b.forEach((k) => { expect(k.durum).toBe('no'); expect(k.sonuc).toMatch(/— ama 1 mod bantta kalır$/); });
  });
  test('ASFAT: Kriter 1 tek kaldıraçla sağlanmıyor — ×0,1\'de bile en yüksek mod sınırın üstünde', () => {
    const Rx = R.asfat, K = rp._mntRepKaldiraclar(Rx, {});
    expect(K[0].durum).toBe('no');
    expect(K[0].z).toBeNull();
    expect(K[0].sonuc).toMatch(/tek kaldıraç yetmez/);
    const md = core.modesWithSpringScale(Rx.mounts, Rx.mp.cg, M6(Rx), Rx.kBasis, K[0].b.i, K[0].b.ax, 0.1);
    expect(maks(md)).toBeGreaterThan(15);
  });
  test('SİPER: rölanti girdisi yok — Kriter 1 bekliyor, kaldıraç aranmıyor', () => {
    const K = rp._mntRepKaldiraclar(R.siper, {});
    expect(K[0]).toMatchObject({ no: '1', durum: 'wait', b: null });
  });
});

// ═══════════════ PENCERELER ═══════════════
// Bileşen pencereleri sonuç göstermez (kullanıcı kararı 2026-10-16): duyarlılık
// yalnız raporun §8.17'sinde. Çözüm R.sensitivity'yi yine yazar — rapor OKUR.
describe('pencereler duyarlılığı göstermez — yalnız rapor §8.17', () => {
  global.veMntUygunluk = rp.veMntUygunluk;
  global.veMntRaporOpts = rp.veMntRaporOpts;
  global._mntRepCaseTr = rp._mntRepCaseTr;
  global._mntRepIsolation = rp._mntRepIsolation;
  const kurHafif = () => {
    global.nodes = H.ornek('hafif').nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
    global.connections = [];
    const s = global.nodes.find((n) => n.type === 'mnt-solver');
    const Rx = cp._mntComputeResults(s.id); global._veMntLast = Rx;
    return { s, Rx };
  };
  const sekmeler = (d) => [...d.querySelectorAll('.ve-fp-tab .ve-fp-tab-ad')].map((x) => x.textContent);
  const bolumler = (d) => [...d.querySelectorAll('.ve-fp-sect b')].map((x) => x.textContent);
  test('çözüm R.sensitivity yazar; Çözücü\'de Modlar · Kaldıraçlar, takozda Duyarlılık yok', () => {
    const { s, Rx } = kurHafif();
    expect(Rx.sensitivity).toHaveLength(6);
    const cz = dom(cp.getMntSolverPropertiesHTML(s));
    expect(sekmeler(cz)).toEqual(['Yük durumları', 'Ayarlar']);   // pencere gerçekten kuruldu
    expect(bolumler(cz)).not.toContain('Kaldıraçlar');
    const n = global.nodes.find((x) => x.customName === 'Sol Motor Takozu');
    const tk = dom(cp.getMntMountPropertiesHTML(n));
    expect(sekmeler(tk)).toEqual(['Tip ve rijitlik', 'Konum']);
    expect(bolumler(tk)).not.toContain('Duyarlılık');
    expect(tk.querySelector('td.en')).toBeNull();
  });
  test('rapor §8.17 aynı çözümden basılıyor', () => {
    const { Rx } = kurHafif();
    expect(rp._mntRepSensitivity(Rx, {})).toContain('8.17 Takoz ve eksen başına frekans duyarlılığı');
  });
});
