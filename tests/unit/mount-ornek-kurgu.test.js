/**
 * mount-ornek-kurgu.test.js — KURGU doğrulama örnekleri (başlangıç sayfası)
 * ─────────────────────────────────────────────────────────────────────
 * Kullanıcı isteği (2026-10-16): "yaptığın örneklerden güzel olanlarını
 * başlangıç sayfasına örnek olarak ekleriz." Üç kurgu model sevk edildi
 * (js/mount-core.js MOUNT_EXAMPLES · `kurgu: true` · assets/examples/*_topoloji.json):
 *   kutu   — kapalı formu bilinen simetrik dörtlü kutu (B1'in aynısı)
 *   hafif  — 3 noktalı hafif ticari, bütün kriterleri işletir
 *   kamyon — nonlineer yasalı orta kamyon
 * Bu dosya üç şeyi kilitler:
 *   1. sevk edilen analitik kutu, programın KENDİ yolundan (JSON → çözücü)
 *      çözülünce bağımsız kapalı formu verir ve kartın künyesi o sayıları basar;
 *   2. kart SONUÇ İDDİASI TAŞIMAZ (TAKOZ PENCERESİ SONUÇ GÖSTERMEZ — açıklama
 *      künyedir); kurgunun tasarım özellikleri (kriterler tutuyor, hangi modlar
 *      8 Hz altında, 1. viteste kaç takoz çekmeye geçiyor) yine sayıyla
 *      kilitli — model değişirse sessizce kaymaz;
 *   3. iki kopya (kayıt defteri ↔ JSON) sayı sayı aynı — panel önizlemesi ve
 *      başlangıç sayfasının resmi modelden, "Örneği aktar" JSON'dan okur.
 * Hakem tarafı çekirdeğin fonksiyonlarını çağırmaz (kapalı form ve tork zinciri
 * burada yeniden yazılır).
 */
const fs = require('fs');
const path = require('path');
const H = require('../helpers/takoz-dogrulama.js');
const { core, rp } = H.kur();
const G = H.G;

const KURGU = core.getMountExampleList().filter((e) => e.kurgu);
const json = (e) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../', e.topology), 'utf8'));
const R = {};
KURGU.forEach((e) => { R[e.id] = H.coz(json(e)); });
const vites = (Rx, ad) => (Rx.gearCases || []).find((c) => c.name === ad).res;
const st = (U, no) => U.satirlar.find((s) => s.no === no).st;

describe('kayıt: üç kurgu örnek, gerçeklerden sonra ve ayrı işaretli', () => {
  test('kutu · hafif · kamyon kurgu; gerçek örnekler (siper · tulga · asfat) kurgu DEĞİL', () => {
    expect(KURGU.map((e) => e.id)).toEqual(['kutu', 'hafif', 'kamyon']);
    ['siper', 'tulga', 'asfat'].forEach((id) => expect(core.getMountExample(id).kurgu).toBeFalsy());
    KURGU.forEach((e) => expect(e.specs).toContainEqual(['Kaynak', 'Kurgu — gerçek bir aracı temsil etmez']));
  });
  test('her kurgu örnek hatasız çözülüyor (modal + bütün yük durumları)', () => {
    KURGU.forEach((e) => {
      expect(R[e.id].error).toBeUndefined();
      expect(R[e.id].modes).toHaveLength(6);
      R[e.id].allCases.concat(R[e.id].gearCases, R[e.id].designCases).forEach((rc) => expect(rc.res).toBeTruthy());
    });
  });
});

describe('kutu — sevk edilen JSON programın yolundan kapalı formu veriyor', () => {
  const j = json(core.getMountExample('kutu'));
  const g = j.nodes.find((n) => n.type === 'mnt-motor').data;
  const t = j.nodes.filter((n) => n.type === 'mnt-mount').map((n) => n.data);
  const m = g.mass, Lx = Math.abs(t[0].x - g.cgx) / 1000, Ly = Math.abs(t[0].y - g.cgy) / 1000;
  const kd = [t[0].kxd, t[0].kyd, t[0].kzd].map((v) => 4 * v * 1000);
  const f = { 'ileri-geri': H.fHz(kd[0] / m), yanal: H.fHz(kd[1] / m), 'zıplama': H.fHz(kd[2] / m),
              yalpalama: H.fHz(kd[2] * Ly * Ly / g.Ixx), 'baş-kıç': H.fHz(kd[2] * Lx * Lx / g.Iyy),
              savrulma: H.fHz((kd[0] * Ly * Ly + kd[1] * Lx * Lx) / g.Izz) };

  test('kutu geometrisi gerçekten ayrışık düzen: dört özdeş takoz, ağırlık merkezi yüksekliğinde, simetrik köşeler', () => {
    expect(t).toHaveLength(4);
    t.forEach((d) => {
      expect(d.z).toBe(g.cgz);
      expect(Math.abs(Math.abs(d.x - g.cgx) / 1000 - Lx)).toBeLessThan(1e-12);
      expect(Math.abs(Math.abs(d.y - g.cgy) / 1000 - Ly)).toBeLessThan(1e-12);
      expect([d.kxd, d.kyd, d.kzd]).toEqual([t[0].kxd, t[0].kyd, t[0].kzd]);
    });
    // atalet düzgün prizmanınki: 1100 × 700 × 800 mm
    expect([g.Ixx, g.Iyy, g.Izz]).toEqual(H.kutuAtalet(m, [1100, 700, 800]).map((r, i) => Math.round(r[i] * 1e9) / 1e9));
  });

  test('altı mod kapalı formla ≤ 10⁻⁹ (programın yolundan: JSON → toplayıcı → çözücü)', () => {
    const bek = Object.values(f).sort((a, b) => a - b);
    R.kutu.modes.forEach((md, i) => expect(H.bagil(md.f_Hz, bek[i])).toBeLessThan(1e-9));
  });

  test('statik sehim −m·g/(4·k_z,stat) her takozda', () => {
    const s = R.kutu.allCases.find((c) => c.name === 'Static').res;
    s.perMount.forEach((pm) => expect(Math.abs(pm.delta[2] + m * G / (4 * t[0].kzs * 1000))).toBeLessThan(1e-12));
  });

  test('kartın künyesi aynı sayıları basıyor (iki ondalık)', () => {
    const kunye = core.getMountExample('kutu').specs.map((r) => r[1]).join(' ');
    Object.keys(f).forEach((ad) => expect(kunye).toContain(ad + ' ' + veSayi(f[ad], 2)));
  });

  test('kriterler bilerek tutmuyor: rapor bu hükmü veriyor', () => {
    const U = rp.veMntUygunluk(R.kutu, {});
    expect([st(U, '1'), st(U, '1a'), st(U, '1b'), st(U, '2')]).toEqual(['ok', 'no', 'no', 'ok']);
  });
});

describe('hafif ve kamyon — kurgunun tasarım özellikleri tutuyor', () => {
  // Hakem tork zinciri: T = Te · Rstall · i_vites · i_transfer · φ_aks · düşüm
  const tork = (e) => { const g = json(e).nodes.find((n) => n.type === 'mnt-motor').data;
    const s = json(e).nodes.find((n) => n.type === 'mnt-gearbox').data; return g.Te * s.Rstall * s.g1; };

  test.each([['hafif', 1], ['kamyon', 2]])('%s: Kriter 1 · 1a · 1b · 2 tutuyor; 1. viteste %s takoz çekmede', (id, cek) => {
    const e = core.getMountExample(id), Rx = R[id];
    const U = rp.veMntUygunluk(Rx, {});
    expect([st(U, '1'), st(U, '1a'), st(U, '1b'), st(U, '2')]).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(vites(Rx, '1. Vites').checks.tensionCount).toBe(cek);
    expect(vites(Rx, '1. Vites').checks.clampCount).toBe(0);              // durdurucuya değmiyor
    // 1. vitesin torku bir GİRDİ (Te · R_stall · i₁), sonuç değil: künyede durur
    expect(e.specs.map((r) => r[1]).join(' ')).toContain(veSayi(tork(e), 0) + ' N·m');
  });

  test.each(['hafif', 'kamyon'])('%s: üç mod 8 Hz altında, üçü 10 Hz ile 0,5·f_ateş arasında', (id) => {
    const Rx = R[id], f = Rx.modes.map((m) => m.f_Hz);
    const t = Rx.gather.torque, lim = 0.5 * (t.idleRpm / 60) * (t.cylinders / 2);
    expect(f.slice(0, 3).every((v) => v < 8)).toBe(true);
    expect(f.slice(3).every((v) => v > 10 && v < lim)).toBe(true);
  });

  test('hafif: üç düşük mod yanal, ileri-geri ve savrulma', () => {
    expect(R.hafif.modes.slice(0, 3).map((m) => m.label).sort()).toEqual(['fore-aft', 'lateral', 'yaw']);
  });

  // TAKOZ PENCERESİ SONUÇ GÖSTERMEZ: örnek kartı ve penceresi açıklamayı
  // gösterir; açıklama kimlik ve kaynaktır, çözümün iddiası değil (frekans,
  // kriter hükmü, çekme, sehim). Eskiden kurgu kartları "Kriter 1, 1a ve 1b
  // tutar", "modları 8 Hz altında" diyordu.
  test('bütün örneklerin açıklaması sonuç iddiası taşımaz', () => {
    const SONUC = /\bHz\b|Kriter|çekme|sehim|tutar|tutmaz|izolasyon|%\s?\d/i;
    const hepsi = core.getMountExampleList();
    expect(hepsi.length).toBeGreaterThan(5);
    expect(hepsi.filter((e) => SONUC.test(e.description || '')).map((e) => e.id + ': ' + e.description)).toEqual([]);
  });

  test.each(['hafif', 'kamyon'])('%s: statik sehim 2–6 mm, durgunken çekme yok', (id) => {
    const s = R[id].allCases.find((c) => c.name === 'Static').res;
    s.perMount.forEach((pm) => {
      expect(-pm.delta[2] * 1000).toBeGreaterThan(2);
      expect(-pm.delta[2] * 1000).toBeLessThan(6);
    });
    expect(s.checks.tensionCount).toBe(0);
  });

  test('kamyon nonlineer (Newton) ve yasaları katalogla öz-tutarlı; hafif lineer', () => {
    expect(R.kamyon.solvedNL).toBe(true);
    R.kamyon.mounts.forEach((mt) => expect(core.lawCatalogMismatch(mt)).toEqual([]));
    expect(rp._mntRepNLNote(R.kamyon)).not.toMatch(/uyuşmazlığı/);
    expect(R.hafif.solvedNL).toBe(false);
  });
});

// Kayıt defteri (panel önizlemesi + başlangıç sayfasının resmi) ile JSON
// ("Örneği aktar") aynı modelin İKİ kopyası. Kurgu örneklerde JSON modelden
// üretildi: her sayı birebir aynı olmak zorunda.
describe('iki kopya sayı sayı aynı: kayıt defteri ↔ JSON', () => {
  test.each(KURGU.map((e) => [e.id, e]))('%s', (id, e) => {
    const j = json(e), M = e.model;
    const govde = j.nodes.filter((n) => ['mnt-motor', 'mnt-gearbox', 'mnt-pump'].includes(n.type));
    expect(govde.map((n) => n.customName).sort()).toEqual(M.components.map((c) => c.name).sort());
    M.components.forEach((c) => {
      const d = govde.find((n) => n.customName === c.name);
      expect(d.type).toBe(c.kind);
      expect([d.data.mass, d.data.cgx, d.data.cgy, d.data.cgz, d.data.Ixx, d.data.Iyy, d.data.Izz, !!d.data.pointMass])
        .toEqual([c.mass, c.cg[0], c.cg[1], c.cg[2], c.Ixx, c.Iyy, c.Izz, !!c.pointMass]);
      Object.keys(c.veri || {}).forEach((k) => expect(`${c.name}.${k} ${d.data[k]}`).toBe(`${c.name}.${k} ${c.veri[k]}`));
    });
    const takoz = j.nodes.filter((n) => n.type === 'mnt-mount');
    expect(takoz.map((n) => n.customName).sort()).toEqual(M.mounts.map((t) => t.name).sort());
    M.mounts.forEach((t) => {
      const d = takoz.find((n) => n.customName === t.name).data;
      expect([d.x, d.y, d.z, d.kxs, d.kys, d.kzs, d.kxd, d.kyd, d.kzd]).toEqual(t.pos.concat(t.kstat, t.kdyn));
      ['x', 'y', 'z'].forEach((a) => expect(d['fit' + a.toUpperCase()] || null).toEqual((t.fits && t.fits[a]) || null));
    });
    expect(j.nodes.find((n) => n.type === 'mnt-solver').data.zeta).toBe(M.cozucu.zeta);
    expect(j.nodes.find((n) => n.type === 'mnt-example').data.exampleKey).toBe(id);
  });
});
