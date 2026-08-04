/**
 * Takoz sonuç kanalları (js/mount-signals.js)
 * ──────────────────────────────────────────
 * Sonuçlar panosuna giden veriyi üreten katman. Burada test edilen şey çizim
 * değil, ÇİZİLECEK SAYILAR:
 *
 *   • FRF ızgarası Rapor §8.13 ile aynı bantta ve aynı çözünürlükte mi
 *   • kuvvet-deformasyon eğrisi çözücünün kullandığı YASADAN mı geliyor
 *   • ivme süpürmesi a = 1 g'de Statik yük durumuyla BİREBİR örtüşüyor mu
 *   • bir veri kümesinin kanalları kendi X ekseniyle mi eşleşiyor
 *   • eksik girdide (sönüm yok / çözücü yok) uydurma eğri üretilmiyor mu
 *
 * Bunlarda sessiz bir kayma "makul ama yanlış" bir eğri üretir: kullanıcı
 * imleci 25 Hz'e koyup yanlış bir iletilebilirlik okur ve fark etmez. Gözle
 * yakalanmayan sınıf — testin karşılığı burada.
 *
 * a = 1 g özdeşliği ayrıca bir MİMARİ KİLİTTİR: süpürme, çözücünün kendi
 * yolundan (solveOne) geçmek zorunda. Ayrı bir "gösterim için" çözüm yazılırsa
 * bu test kırılır — pano ile Rapor sessizce ayrışamaz.
 */
const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.veMntBrief = require('../../js/mount-brief.js');
const S = require('../../js/mount-signals.js');
const M = require('../../js/measure-core.js');

const mm = (v) => v / 1000, kN = (v) => v * 1000;
const G = 9.81;

// ── ASFAT 8x8 güç grubu (mount-frf.test.js ile aynı model) ───────────────────
const COMPS = [
  { name: 'Motor', mass: 1600, cg: [-314.94, -0.127, 857.56].map(mm),
    I: [[110.7, 0, 0], [0, 260.2, 0], [0, 0, 205.9]], pointMass: false },
  { name: 'Şanzıman', mass: 839, cg: [932.365, -13.003, 700.632].map(mm),
    I: [[44.6, 0, 0], [0, 97.8, 0], [0, 0, 94.6]], pointMass: false },
];
const ON = { s: [1045, 1045, 1800], d: [1045, 1045, 1800] };
const AR = { s: [462, 462, 2200], d: [630, 630, 3000] };
const MOUNTS = [['Ön Sol', -953.45, -50.67, 367, ON], ['Ön Sağ', -953.45, 50.67, 367, ON],
  ['Sol Ön', 535.31, -347.1, 615.77, AR], ['Sağ Ön', 535.31, 347.1, 615.77, AR],
  ['Sol Arka', 636.8, -347.1, 615.77, AR], ['Sağ Arka', 636.8, 347.1, 615.77, AR]]
  .map((h) => ({ name: h[0], pos: [h[1], h[2], h[3]].map(mm),
                 kstat: h[4].s.map(kN), kdyn: h[4].d.map(kN) }));

const MP = core.combineMassProps(COMPS);
const KSTAT = core.buildK(MOUNTS, MP.cg, false);
const STATIC_LC = { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] };
const STAT = core.solveCase(KSTAT, MOUNTS, MP.cg, MP.m, G, STATIC_LC);
const DAMP = core.mountDamping(MOUNTS, core.mountLoadShares(STAT, G), 0.02);

// Çözücünün (js/cp-mount.js prep.solveOne) yaptığının aynısı: durduruculu
// lineer yol. Süpürme bunu kara kutu olarak çağırır.
const solveOne = (lc) => ({
  name: lc.name, loadCase: lc,
  res: core.solveCaseStop(KSTAT, MOUNTS, MP.cg, MP.m, G, lc, { useStop: true })
});

// Yorum katmanı çözümün TAMAMINI okur (modlar, statik durum, motor tanımı) —
// R bu yüzden gerçek bir çözüm gibi kurulur, yoksa yorum paragrafları sessizce
// düşer ve test onları hiç görmez.
const M6 = core.buildM6(MP.m, MP.I_G);
const MODES = core.solveModal(core.buildK(MOUNTS, MP.cg, true), M6, MOUNTS, MP.cg);
const R = {
  mp: MP, mounts: MOUNTS, damping: DAMP, g: G, zeta: 0.02, modes: MODES,
  allCases: [{ name: 'Static', loadCase: STATIC_LC, res: solveOne(STATIC_LC).res }],
  gather: { torque: { idleRpm: 750, cylinders: 6 } }
};
const SETS = S.build(R, { solveOne });
const setOf = (k) => SETS.find((d) => d.key === k);

const norm3 = (v) => Math.hypot(v[0], v[1], v[2]);

// Kanallar ADLARINDAN bulunur, kimlik biçiminden değil: kimlik biçimi bir
// uygulama detayı, "hangi takozun hangi büyüklüğü" ise sözleşme.
const chan = (ds, name) => ds.channels.find((c) => c.name === name);
const mchan = (ds, mnt, kind) => chan(ds, mnt.name + ' · ' + kind);

describe('build — hangi veri kümeleri üretiliyor', () => {
  test('beş küme: frekans yanıtı, kuvvet-deformasyon ve üç ivme süpürmesi', () => {
    expect(SETS.map((d) => d.key)).toEqual(['frf', 'fdefl', 'gz', 'gy', 'gx']);
  });

  test('her kümenin X ekseni ve en az bir kanalı var', () => {
    SETS.forEach((ds) => {
      expect(ds.x.data.length).toBeGreaterThan(1);
      expect(ds.channels.length).toBeGreaterThan(0);
      // Kanal uzunluğu X ile birebir — kısa dizi grafiği sessizce kırpardı
      ds.channels.forEach((ch) => expect(ch.data.length).toBe(ds.x.data.length));
    });
  });

  test('çözülemeyen model kanal üretmez', () => {
    expect(S.build(null, { solveOne })).toEqual([]);
    expect(S.build({ error: ['eksik girdi'] }, { solveOne })).toEqual([]);
  });
});

describe('frekans yanıtı (frf)', () => {
  const ds = setOf('frf');

  test('ızgara Rapor §8.13 ile aynı bantta (0.1–100 Hz), logaritmik ve artan', () => {
    expect(ds.x.unit).toBe('Hz');
    expect(ds.x.data.length).toBe(S.FRF_NPTS);
    expect(ds.x.data[0]).toBeCloseTo(S.FRF_FMIN, 9);
    expect(ds.x.data[ds.x.data.length - 1]).toBeCloseTo(S.FRF_FMAX, 9);
    // Logaritmik ve kesin artan: imleç ikili aramayla örnek kilitliyor
    for (let i = 1; i < ds.x.data.length; i++) {
      expect(ds.x.data[i]).toBeGreaterThan(ds.x.data[i - 1]);
    }
  });

  test('üç yönün her biri için sönümlü / sönümsüz / verim kanalı', () => {
    expect(ds.channels.map((c) => c.id)).toEqual([
      'T_0', 'T0_0', 'eta_0', 'T_1', 'T0_1', 'eta_1', 'T_2', 'T0_2', 'eta_2'
    ]);
  });

  test('statik limitte iletilebilirlik 1 — kuvvet olduğu gibi geçer', () => {
    ['T_0', 'T_1', 'T_2'].forEach((id) => {
      const T = ds.channels.find((c) => c.id === id).data;
      expect(T[0]).toBeCloseTo(1, 2);
    });
  });

  test('izolasyon bölgesinde T < 1, verim = (1−T)·100 ile tutarlı', () => {
    const T = ds.channels.find((c) => c.id === 'T_2').data;
    const eta = ds.channels.find((c) => c.id === 'eta_2').data;
    const last = T.length - 1;
    expect(T[last]).toBeLessThan(1);                 // 100 Hz izolasyon bölgesi
    expect(eta[last]).toBeGreaterThan(0);
    T.forEach((t, i) => expect(eta[i]).toBeCloseTo((1 - t) * 100, 9));
  });

  test('sönüm türetilemediyse frekans yanıtı hiç üretilmez', () => {
    // Uydurma bir ζ ile eğri çizmektense kanal yok: kullanıcı olmayan bir
    // sönüm modelini gerçek sanmasın.
    const keys = S.build({ mp: MP, mounts: MOUNTS, damping: null, g: G }, { solveOne })
      .map((d) => d.key);
    expect(keys).not.toContain('frf');
  });
});

describe('kuvvet-deformasyon (fdefl)', () => {
  const ds = setOf('fdefl');

  test('eksen ±15 mm — metal-metal durdurucu boşluğunu kapsar', () => {
    expect(ds.x.unit).toBe('mm');
    expect(ds.x.data[0]).toBeCloseTo(-S.FD_LIM_MM, 9);
    expect(ds.x.data[ds.x.data.length - 1]).toBeCloseTo(S.FD_LIM_MM, 9);
    expect(ds.x.data.length).toBe(S.FD_NPTS);
  });

  test('takoz başına üç eksen kanalı, adlar ayırt edilebilir', () => {
    expect(ds.channels.length).toBe(MOUNTS.length * 3);
    const names = new Set(ds.channels.map((c) => c.name));
    expect(names.size).toBe(ds.channels.length);
  });

  test('lineer takozda eğri tam olarak F = k·δ', () => {
    // Çözücünün kullandığı mountStaticLaws'tan geliyorsa bu ÖZDEŞLİK tutar.
    // Ayrı bir gösterim eğrisi türetilseydi burada kayardı.
    ['X (boyuna)', 'Y (yanal)', 'Z (düşey)'].forEach((axName, ax) => {
      const ch = mchan(ds, MOUNTS[0], axName);
      ds.x.data.forEach((dmm, i) => {
        expect(ch.data[i]).toBeCloseTo(MOUNTS[0].kstat[ax] * (dmm / 1000), 6);
      });
    });
  });

  test('sıfır deformasyonda sıfır kuvvet', () => {
    const zero = ds.x.data.indexOf(0);
    expect(zero).toBeGreaterThanOrEqual(0);
    ds.channels.forEach((ch) => expect(ch.data[zero]).toBeCloseTo(0, 9));
  });
});

describe('ivme süpürmesi (gz / gy / gx)', () => {
  const gz = setOf('gz');

  test('eksen 0 → 3.5 g: tasarım yük durumu "3.5g Düşey" ızgarada', () => {
    expect(gz.x.unit).toBe('g');
    expect(gz.x.data[0]).toBeCloseTo(0, 9);
    expect(gz.x.data[gz.x.data.length - 1]).toBeCloseTo(S.GS_MAX, 9);
    expect(gz.x.data.length).toBe(S.GS_NPTS);
  });

  test('a = 1 g düşey süpürme, Statik yük durumuyla BİREBİR aynı', () => {
    // Süpürmenin çözücünün kendi yolundan geçtiğinin kanıtı. Pano ile Rapor
    // aynı fizikten okumazsa bu özdeşlik kırılır.
    const i1 = gz.x.data.findIndex((a) => Math.abs(a - 1) < 1e-9);
    expect(i1).toBeGreaterThan(0);
    const ref = solveOne(STATIC_LC).res;
    MOUNTS.forEach((mnt, k) => {
      const d = mchan(gz, mnt, 'bileşke çökme').data[i1];
      const f = mchan(gz, mnt, 'bileşke kuvvet').data[i1];
      expect(d).toBeCloseTo(norm3(ref.perMount[k].delta) * 1000, 9);
      expect(f).toBeCloseTo(norm3(ref.perMount[k].f), 6);
    });
  });

  test('sıfır ivmede yük yok — çökme sıfır', () => {
    MOUNTS.forEach((mnt) => {
      expect(mchan(gz, mnt, 'bileşke çökme').data[0]).toBeCloseTo(0, 9);
    });
    expect(chan(gz, 'En büyük takoz çökmesi').data[0]).toBeCloseTo(0, 9);
  });

  test('lineer modelde çökme ivmeyle tekdüze artar', () => {
    const d0 = mchan(gz, MOUNTS[0], 'bileşke çökme').data;
    for (let i = 1; i < d0.length; i++) expect(d0[i]).toBeGreaterThan(d0[i - 1] - 1e-12);
  });

  test('en büyük çökme kanalı gerçekten takozların maksimumu', () => {
    const dmax = chan(gz, 'En büyük takoz çökmesi').data;
    const per = MOUNTS.map((m) => mchan(gz, m, 'bileşke çökme').data);
    dmax.forEach((v, i) => expect(v).toBeCloseTo(Math.max(...per.map((p) => p[i])), 9));
  });

  test('yanal ve boyuna süpürmede düşey 1 g sabit — a = 0 Statik demektir', () => {
    const ref = solveOne(STATIC_LC).res;
    ['gy', 'gx'].forEach((key) => {
      const d0 = mchan(setOf(key), MOUNTS[0], 'bileşke çökme').data[0];
      expect(d0).toBeCloseTo(norm3(ref.perMount[0].delta) * 1000, 9);
    });
  });

  test('çözücü verilmezse süpürme üretilmez', () => {
    const keys = S.build(R, {}).map((d) => d.key);
    expect(keys).toEqual(['frf', 'fdefl']);
  });
});

describe('diyagram yorumu — ŞERİT BAŞINA', () => {
  // Yorum artık veri kümesine değil, O ŞERİTTE ÇİZİLİ KANALLARA ait. Tek bir
  // kanalın yorumu ile dokuz kanalın üst üste bindiği hâlin yorumu farklı
  // şeyler anlatır; tek metin ikisine birden hizmet edemez.
  const B = require('../../js/mount-brief.js');
  const lane = (key, ids) => B.forLane(setOf(key), R, ids);
  const text = (br) => br.paras.join(' ');

  test('kümenin kendisi tek satır özet + grafik işaretleri taşır', () => {
    SETS.forEach((ds) => {
      expect(ds.brief.lead.length).toBeGreaterThan(20);
      expect(ds.brief.marks.length).toBeGreaterThan(0);
    });
    const leads = SETS.map((d) => d.brief.lead);
    expect(new Set(leads).size).toBe(leads.length);
  });

  test('tek kanal: o yönün kendi sayıları', () => {
    const br = lane('frf', ['T_2']);
    expect(br.title).toContain('düşey');
    expect(text(br)).toMatch(/\d+,\d+ Hz/);
    expect(text(br)).toContain('ateşleme');
  });

  test('üç yön birlikte: yön yön karşılaştırma', () => {
    const br = lane('frf', ['T_0', 'T_1', 'T_2']);
    expect(br.title).toContain('üç yön');
    const t = text(br);
    ['boyuna', 'yanal', 'düşey'].forEach((ax) => expect(t).toContain(ax));
    // Tek kanallık yorumdan FARKLI olmalı — asıl sözleşme bu
    expect(t).not.toBe(text(lane('frf', ['T_2'])));
  });

  test('sönümlü + sönümsüz: sönümün katkısı sayıyla', () => {
    const br = lane('frf', ['T_2', 'T0_2']);
    expect(br.title).toContain('sönüm');
    expect(text(br)).toMatch(/kat\b/);
  });

  test('BİRLEŞİK: tüm kanallar tek şeritteyken kendine özel yorum', () => {
    const ds = setOf('frf');
    const br = lane('frf', ds.channels.map((c) => c.id));
    expect(br.title).toContain('birleşik');
    const t = text(br);
    expect(t).toContain('9 kanal');
    // Okuma tuzaklarını söylemeli: ölçeği ele geçiren eğri ve eksi verim
    expect(t).toMatch(/sönümsüz/);
    expect(t).toMatch(/eksi/);
    // Ve diğer hiçbir şerit yorumuyla aynı olmamalı
    [['T_2'], ['T_0', 'T_1', 'T_2'], ['T_2', 'T0_2'], ['eta_2']]
      .forEach((ids) => expect(t).not.toBe(text(lane('frf', ids))));
  });

  test('yalnız verim kanalı: yüzde okuması ve eksi değer açıklaması', () => {
    const br = lane('frf', ['eta_2']);
    expect(br.title).toContain('verim');
    expect(text(br)).toContain('%');
  });

  test('kuvvet-deformasyon: tek takoz çok eksen → yön farkı', () => {
    const ds = setOf('fdefl');
    const ids = ds.channels.filter((c) => c.name.indexOf(MOUNTS[0].name) === 0).map((c) => c.id);
    const br = B.forLane(ds, R, ids);
    expect(br.title).toContain(MOUNTS[0].name);
    expect(text(br)).toMatch(/N\/mm/);
    expect(text(br)).toMatch(/kat/);
  });

  test('kuvvet-deformasyon: tek kanal → o eksenin sertliği ve çalışma noktası', () => {
    const ds = setOf('fdefl');
    const id = ds.channels.find((c) => c.name === MOUNTS[0].name + ' · Z (düşey)').id;
    const t = text(B.forLane(ds, R, [id]));
    // kstat_z = 1800 N/mm; eğriden okunan eğim bunu vermeli
    expect(t).toContain('1800 N/mm');
    expect(t).toMatch(/mm.*eziliyor|eziliyor/);
  });

  test('süpürme: çok takoz → en çok ve en az yüklenen', () => {
    const ds = setOf('gz');
    const ids = ds.channels.filter((c) => /bileşke çökme/.test(c.name)).map((c) => c.id);
    const br = B.forLane(ds, R, ids);
    const t = text(br);
    expect(t).toContain('en çok yüklenen');
    expect(t).toContain('en az yüklenen');
    expect(t).toMatch(/mm/);
  });

  test('süpürme: dmax tek başına → en kötü takozun izi', () => {
    const t = text(lane('gz', ['dmax']));
    expect(t).toContain('En büyük takoz çökmesi');
    expect(t).toMatch(/mm/);
  });

  test('sayılar vurgulanmış — düz yazı değil', () => {
    // Vurgu `**...**` ile işaretlenir; sunum katmanı <b>'ye çevirir.
    const cases = [['frf', ['T_2']], ['frf', ['T_0', 'T_1', 'T_2']], ['gz', ['dmax']]];
    cases.forEach(([k, ids]) => {
      const t = text(lane(k, ids));
      expect((t.match(/\*\*[^*]+\*\*/g) || []).length).toBeGreaterThanOrEqual(3);
    });
  });

  test('yüzde eksi değerde de doğru yazılır', () => {
    // "%-1295" değil "−%1295"; ayrıca sayıya Türkçe iyelik eki takılmaz
    const t = text(lane('frf', ['eta_2']));
    expect(t).not.toMatch(/%-/);
    expect(t).not.toMatch(/%\d[\d,]*'[iıuü]/);
  });

  test('çizilmemiş kanal için yorum üretilmez', () => {
    expect(B.forLane(setOf('frf'), R, [])).toBeNull();
    expect(B.forLane(setOf('frf'), R, ['yok'])).toBeNull();
    expect(B.forLane(null, R, ['T_2'])).toBeNull();
  });

  test('frekans yanıtı ekseni logaritmik olarak işaretlenmiş', () => {
    expect(setOf('frf').x.scale).toBe('log');
    expect(S.xAxisOf(setOf('frf')).scale).toBe('log');
    expect(S.xAxisOf(setOf('gz')).scale).toBeUndefined();
    expect(S.xAxisOf(setOf('fdefl')).scale).toBeUndefined();
  });
});

describe('kanal çözümleme ve X ekseni kuralı', () => {
  test('series: X ekseni de kanallar gibi okunur', () => {
    const ds = setOf('frf');
    expect(S.series(SETS, ds.sensorId, 'f')).toBe(ds.x.data);
    expect(S.series(SETS, ds.sensorId, 'T_2')).toBe(
      ds.channels.find((c) => c.id === 'T_2').data);
  });

  test('series: bilinmeyen küme/kanal null — uydurma dizi yok', () => {
    expect(S.series(SETS, '~mnt-yok', 'f')).toBeNull();
    expect(S.series(SETS, '~mnt-frf', 'yok')).toBeNull();
  });

  test('her kümenin sensör kimliği ~mnt- önekli ve benzersiz', () => {
    const ids = SETS.map((d) => d.sensorId);
    ids.forEach((id) => expect(id.indexOf(S.SENSOR_PREFIX)).toBe(0));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('farklı kümeler farklı X kimliği üretir — aynı pencereye giremezler', () => {
    // js/measure-core.js "pencerenin tek X ekseni" kuralı bu kimlik üzerinden
    // işler. İki küme aynı kimliği üretseydi frekans eğrisi ivme ekseninde
    // çizilebilirdi.
    const keys = SETS.map((ds) => M.veXAxisKeyOf(S.xAxisOf(ds), ''));
    expect(new Set(keys).size).toBe(SETS.length);
    expect(keys).not.toContain('time');
  });

  test('xAxisOf: kimlik "<sensör>:<kanal>" biçiminde, ad birimi taşır', () => {
    const ax = S.xAxisOf(setOf('gz'));
    expect(ax.id).toBe('~mnt-gz:a');
    expect(ax.unit).toBe('g');
    expect(ax.name).toContain('[g]');
  });

  test('groups: ağaç grup/satır biçimi sinyal ağacınınkiyle aynı', () => {
    const gs = S.groups(SETS);
    expect(gs.length).toBe(SETS.length);
    gs.forEach((g, i) => {
      expect(g.gid).toBe('mnt:' + SETS[i].key);
      expect(g.dragId).toBe(SETS[i].sensorId);
      expect(g.items.length).toBe(SETS[i].channels.length);
      g.items.forEach((it) => {
        expect(it.sensorId).toBe(SETS[i].sensorId);
        expect(typeof it.signalId).toBe('string');
        expect(it.virtual).toBe(true);
      });
    });
  });

  test('kanal kimliği KONUMDAN değil TAKOZ ADINDAN türer', () => {
    // Bir takoz silinip yeniden çözüldüğünde KALAN takozların kimlikleri
    // değişmemeli. Kimlik sıra numarasından türeseydi "d1" silmeden önce
    // "Ön Sağ", sonra "Sol Ön" olurdu: şerit etiketi eski takozu söylerken
    // başka bir takozun çökmesi çizilirdi — makul ama yanlış.
    const less = MOUNTS.filter((m) => m.name !== 'Ön Sol');
    const K2 = core.buildK(less, MP.cg, false);
    const stat2 = core.solveCase(K2, less, MP.cg, MP.m, G, STATIC_LC);
    const R2 = { mp: MP, mounts: less, g: G,
                 damping: core.mountDamping(less, core.mountLoadShares(stat2, G), 0.02) };
    const sets2 = S.build(R2, {
      solveOne: (lc) => ({ name: lc.name, loadCase: lc,
        res: core.solveCaseStop(K2, less, MP.cg, MP.m, G, lc, { useStop: true }) })
    });

    const idOf = (sets, key, mnt, kind) => {
      const ds = sets.find((d) => d.key === key);
      return ds.channels.find((c) => c.name === mnt.name + ' · ' + kind).id;
    };
    less.forEach((mnt) => {
      expect(idOf(sets2, 'gz', mnt, 'bileşke çökme'))
        .toBe(idOf(SETS, 'gz', mnt, 'bileşke çökme'));
      expect(idOf(sets2, 'fdefl', mnt, 'Z (düşey)'))
        .toBe(idOf(SETS, 'fdefl', mnt, 'Z (düşey)'));
    });
    // Silinen takozun kimliği ARTIK YOK — başka takoza devredilmedi
    const goneId = idOf(SETS, 'gz', MOUNTS.find((m) => m.name === 'Ön Sol'), 'bileşke çökme');
    expect(S.series(sets2, '~mnt-gz', goneId)).toBeNull();
  });

  test('aynı adlı iki takoz ayrı kimlik alır', () => {
    const twins = [
      { name: 'Aynı', pos: [0.4, 0.3, 0.2], kstat: [1e6, 1e6, 1e6], kdyn: [1e6, 1e6, 1e6] },
      { name: 'Aynı', pos: [0.4, -0.3, 0.2], kstat: [1e6, 1e6, 1e6], kdyn: [1e6, 1e6, 1e6] },
      { name: 'Aynı', pos: [-0.4, 0, 0.2], kstat: [1e6, 1e6, 1e6], kdyn: [1e6, 1e6, 1e6] }
    ];
    const ds = S.build({ mp: MP, mounts: twins, damping: null, g: G }, {})
      .find((d) => d.key === 'fdefl');
    const ids = ds.channels.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);   // çakışma yok
  });

  test('takoz adı sabit kimliklerle çakışamaz', () => {
    // "dmax"/"ntens" adlı bir takoz, kümenin özet kanallarının kimliğini
    // ezmemeli — "m." öneki bunu yapısal olarak imkânsız kılar.
    const evil = [{ name: 'dmax', pos: [0.4, 0.3, 0.2], kstat: [1e6, 1e6, 1e6], kdyn: [1e6, 1e6, 1e6] }];
    const sets = S.build({ mp: MP, mounts: evil, damping: null, g: G }, {
      solveOne: (lc) => ({ name: lc.name, loadCase: lc, res: null })
    });
    const gz = sets.find((d) => d.key === 'gz');
    if (gz) {
      const ids = gz.channels.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain('dmax');
    }
    const fd = sets.find((d) => d.key === 'fdefl');
    expect(fd.channels.every((c) => c.id.indexOf('m.') === 0)).toBe(true);
  });

  test('setOfSlot: pencerenin hangi kümeyi gösterdiği çizili sinyalden çözülür', () => {
    const slot = { sensors: [{ id: '~mnt-gz', signal: 'dmax' }],
                   xAxis: { id: '~mnt-gz:a' } };
    expect(S.setOfSlot(SETS, slot).key).toBe('gz');
  });

  test('setOfSlot: sinyal yoksa X eksenine düşer, araç panosunda null', () => {
    expect(S.setOfSlot(SETS, { sensors: [], xAxis: { id: '~mnt-frf:f' } }).key).toBe('frf');
    expect(S.setOfSlot(SETS, { sensors: [{ id: '~engine', signal: 'rpm' }],
                               xAxis: { id: 'time' } })).toBeNull();
    expect(S.setOfSlot(SETS, null)).toBeNull();
  });

  test('channelOf: ad ve birim panoya eklerken buradan gelir', () => {
    const ch = S.channelOf(SETS, '~mnt-frf', 'T_2');
    expect(ch.unit).toBe('−');
    expect(ch.name).toContain('düşey');
    expect(S.channelOf(SETS, '~mnt-frf', 'yok')).toBeNull();
  });
});
