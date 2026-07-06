/**
 * cp-mount-report.test.js — Takoz Çökme-Titreşim RAPOR ÜRETECİ
 *
 * Rapor, Çözücü'nün 6 SD sonuçlarını (_veMntLast) self-contained bir HTML'e
 * döker. Test edilen değer: (a) sayısal biçimlendirme, (b) dinamik §8'in doğru
 * model değerlerini içermesi, (c) şablon montajının token'ları doldurup
 * $$…$$ denklem sınırlayıcılarını BOZMAMASI (String.replace $$→$ tuzağı — gerçek
 * bir regresyondu), (d) gömülü teori şablonunun sınırlayıcılarının sağlamlığı.
 *
 * Çekirdek (veMountCore) ve rapor modülü module.exports guard'lı → doğrudan
 * require. Modül global `veMountCore` ve `_veMntLast` okur → global'e kurulur.
 */
const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.showToast = () => {};
const rep = require('../../js/cp-mount-report.js');

// ── Bilinen, çözülmüş bir model (R) kur (sample harness'in küçük hâli) ───────
function buildR() {
  const mm = 1e-3, kNmm = 1e3;
  const comps = [
    { name: 'Motor',    mass: 300, cgx: -200, cgy: 0, cgz: 400, Ixx: 20, Iyy: 40, Izz: 35, pointMass: false },
    { name: 'Şanzıman', mass: 150, cgx: 400,  cgy: 0, cgz: 300, Ixx: 8,  Iyy: 20, Izz: 18, pointMass: false },
    { name: 'Şaft payı',mass: 40,  cgx: 900,  cgy: 0, cgz: 150, pointMass: true },
  ];
  const mnts = [
    { name: 'Sağ Ön',   x: -150, y: 250,  z: 100, kxs: 800, kys: 800, kzs: 500, kxd: 1200, kyd: 1200, kzd: 800 },
    { name: 'Sol Ön',   x: -150, y: -250, z: 100, kxs: 800, kys: 800, kzs: 500, kxd: 1200, kyd: 1200, kzd: 800 },
    { name: 'Sağ Arka', x: 500,  y: 250,  z: 120, kxs: 800, kys: 800, kzs: 500, kxd: 1200, kyd: 1200, kzd: 800 },
    { name: 'Sol Arka', x: 500,  y: -250, z: 120, kxs: 800, kys: 800, kzs: 500, kxd: 1200, kyd: 1200, kzd: 800 },
  ];
  const torque = { Te: 400, Rstall: 1.8, g1: 3.5, gR: -3.2, iTransfer: 1.0, phiFwd: 1, phiRev: 1, derate: 1 };
  const compsSI = comps.map(c => ({ name: c.name, mass: c.mass, cg: [c.cgx * mm, c.cgy * mm, c.cgz * mm],
    I: [[c.Ixx || 0, 0, 0], [0, c.Iyy || 0, 0], [0, 0, c.Izz || 0]], pointMass: !!c.pointMass }));
  const mntsSI = mnts.map(m => ({ name: m.name, pos: [m.x * mm, m.y * mm, m.z * mm],
    kstat: [m.kxs * kNmm, m.kys * kNmm, m.kzs * kNmm], kdyn: [m.kxd * kNmm, m.kyd * kNmm, m.kzd * kNmm] }));
  const mp = core.combineMassProps(compsSI);
  const model = { m: mp.m, cg: mp.cg, Kstat: core.buildK(mntsSI, mp.cg, false), mounts: mntsSI, g: 9.81 };
  const AUTO = [
    { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] }, { name: 'Max Bump', n: [0, 0, -3], T: [0, 0, 0] },
    { name: 'Acceleration', n: [1, 0, -1], T: [0, 0, 0] }, { name: 'Braking', n: [-1, 0, -1], T: [0, 0, 0] },
    { name: 'Cornering L', n: [0, 1, -1], T: [0, 0, 0] }, { name: 'Cornering R', n: [0, -1, -1], T: [0, 0, 0] },
  ];
  const Tfwd = core.torqueChain({ Te: torque.Te, Rstall: torque.Rstall, iGear: torque.g1, iTransfer: torque.iTransfer, phiAxle: torque.phiFwd, derate: torque.derate });
  const Trev = core.torqueChain({ Te: torque.Te, Rstall: torque.Rstall, iGear: torque.gR, iTransfer: torque.iTransfer, phiAxle: torque.phiRev, derate: torque.derate });
  const cases = AUTO.concat([{ name: 'Forward Torque', n: [0, 0, -1], T: [-Tfwd, 0, 0] },
    { name: 'Reverse Torque', n: [0, 0, -1], T: [-Trev, 0, 0] }]);
  return {
    mp, mounts: mntsSI,
    allCases: core.solveAllCases(model, cases),
    modes: core.solveModal(core.buildK(mntsSI, mp.cg, true), core.buildM6(mp.m, mp.I_G), mntsSI, mp.cg),
    gather: { components: comps, mounts: mnts, torque }, matrixMode: 'delta',
  };
}

let R;
beforeEach(() => { R = buildR(); global._veMntLast = R; });

describe('Sayısal biçimlendirme (Türkçe virgül + sondaki sıfır kırpma)', () => {
  test('_rF sondaki sıfırları kırpar', () => {
    expect(rep._rF(20, 3)).toBe('20');          // "20.000" değil
    expect(rep._rF(110.7, 3)).toBe('110,7');     // "110.700" değil
    expect(rep._rF(3.2, 3)).toBe('3,2');
    expect(rep._rF(0, 2)).toBe('0');
  });
  test('_rF negatiflerde gerçek eksi (−), "−0" değil', () => {
    expect(rep._rF(-200, 2)).toBe('−200');
    expect(rep._rF(-0.765, 3)).toBe('−0,765');
    expect(rep._rF(-0.0001, 2)).toBe('0'); // yuvarlanır → "−0" olmamalı
  });
  test('_rFs işaret + kırpma', () => {
    expect(rep._rFs(-3.15, 2)).toBe('−3,15');
    expect(rep._rFs(1.5, 2)).toBe('+1,5');
    expect(rep._rFs(-3, 2)).toBe('−3');
  });
  test('geçersiz → —', () => {
    expect(rep._rF(NaN)).toBe('—');
    expect(rep._rF(undefined)).toBe('—');
  });
});

describe('Panel — Çözücü guard\'ı (çözülmemişse UYARIR)', () => {
  test('çözülmüş: "Rapor Oluştur" butonu etkin, uyarı yok', () => {
    global._veMntLast = R;
    const html = rep.getMntReportPropertiesHTML({ id: 'n1' });
    expect(html).toContain('veMntGenerateReport(\'n1\')');
    expect(html).toContain('Model çözüldü');
    expect(html).toContain('3 bileşen · 4 takoz');
    expect(html).not.toContain('disabled');
  });
  test('çözülmemiş: uyarı + devre dışı buton (rapor üretmez)', () => {
    global._veMntLast = null;
    const html = rep.getMntReportPropertiesHTML({ id: 'n1' });
    expect(html).toContain('Önce hesaplayın');
    expect(html).toContain('Çözücü');
    expect(html).toContain('disabled');
    expect(html).not.toContain('veMntGenerateReport(\'n1\')');
  });
});

describe('Veri erişimi', () => {
  test('_mntRepFindCase ada göre bulur', () => {
    expect(rep._mntRepFindCase(R, 'Static')).toBeTruthy();
    expect(rep._mntRepFindCase(R, 'Forward Torque')).toBeTruthy();
    expect(rep._mntRepFindCase(R, 'Yok')).toBeNull();
  });
  test('_mntRepGeom: birleşik CG mp\'den (mm), bileşen/takoz sayısı', () => {
    const g = rep._mntRepGeom(R);
    expect(g.comps).toHaveLength(3);
    expect(g.mounts).toHaveLength(4);
    expect(g.cg.x).toBeCloseTo(R.mp.cg[0] * 1000, 6);
    expect(g.cg.z).toBeCloseTo(R.mp.cg[2] * 1000, 6);
  });
});

describe('§8 dinamik içerik — modelin gerçek değerleri', () => {
  let s8;
  beforeEach(() => { s8 = rep._mntRepSection8(R); });
  test('tüm tablolar ve figürler var', () => {
    ['Tablo 1', 'Tablo 2', 'Tablo 3', 'Tablo 4', 'Tablo 5', 'Şekil 2', 'Şekil 3'].forEach(t =>
      expect(s8).toContain(t));
  });
  test('bileşen ve takoz adları geçiyor', () => {
    ['Motor', 'Şanzıman', 'Şaft payı', 'Sağ Ön', 'Sol Arka'].forEach(n => expect(s8).toContain(n));
  });
  test('kütle birleştirme değeri (m ≈ 490 kg) raporda', () => {
    expect(R.mp.m).toBeCloseTo(490, 3);
    expect(s8).toContain('490');
  });
  test('tork durumu var → §8.4 süperpozisyon tablosu üretiliyor', () => {
    expect(s8).toContain('Süperpozisyon');
    expect(s8).toContain('2520'); // T_s [N·m]
  });
  test('modal frekanslar (6 mod) raporda', () => {
    expect(R.modes).toHaveLength(6);
    // ilk modun frekansı metinde geçmeli (virgüllü)
    expect(s8).toContain(rep._rF(R.modes[0].f_Hz, 3));
  });
  test('tork durumu YOKKEN §8.4 uyarı verir (süperpozisyon tablosu yok)', () => {
    const R2 = buildR();
    R2.allCases = R2.allCases.filter(c => c.name !== 'Forward Torque');
    global._veMntLast = R2;
    const h = rep._mntRepStep4Torque(R2);
    expect(h).toContain('tork yük durumu tanımlı değil');
    expect(h).not.toContain('Tablo 4');
  });
});

describe('§8 zenginleştirmeleri', () => {
  test('Kritik Sonuç Özeti: maks sehim/kuvvet + lift-off (tüm durumları tarar)', () => {
    const h = rep._mntRepCritical(R);
    expect(h).toContain('Kritik Sonuç Özeti');
    expect(h).toContain('Maks düşey sehim');
    expect(h).toContain('Maks takoz kuvveti');
    expect(h).toContain('note warn');           // bu modelde lift-off var → amber
    expect(h).toMatch(/Modal bant/);
  });
  test('Yük durumu matrisi: 8 durum (Türkçe adlı) + tension işareti', () => {
    const h = rep._mntRepLoadCaseMatrix(R);
    ['Statik', 'Tümsek', 'Hızlanma', 'Frenleme', 'Viraj', 'İleri tork', 'Geri tork'].forEach(n =>
      expect(h).toContain(n));
    expect(h).toContain('outline:2px solid #a855f7'); // en az bir çekme hücresi
  });
  test('§8.6 üç-eksen çökme detayı: her takoz için δx/δy/δz tablosu', () => {
    const h = rep._mntRepDeflectionDetail(R);
    expect(h).toContain('üç-eksen çökme detayı');
    ['δ_x', 'δ_y', 'δ_z'].forEach(l => expect(h).toContain(l));
    // her takoz için bir tablo
    expect((h.match(/<table>/g) || []).length).toBe(R.mounts.length);
    R.mounts.forEach(m => expect(h).toContain(m.name));
    // δx/δy sıfır-olmayan (yalnız δz değil): viraj durumunda δy dolu olmalı
    expect(h).toMatch(/−|\+/); // işaretli değerler var
  });
  test('Mod şekli matrisi: 6 mod × 6 SD, ortalanmış veri-çubuğu', () => {
    const h = rep._mntRepModeMatrix(R.modes);
    ['u_x', 'u_y', 'u_z', 'θ_x', 'θ_y', 'θ_z'].forEach(l => expect(h).toContain(l));
    expect(h).toContain('linear-gradient');            // ortalanmış çubuk (heatmap değil)
    expect(h).toContain('rgba(36,66,95,0.20)');
    expect(h).toContain('class="modeshape"');
    expect((h.match(/<tr>/g) || []).length).toBe(7);   // başlık + 6 mod
  });
  test('Figür: X–Z görünüşte çakışan takozlar kümelenir (kare sayısı azalır)', () => {
    const geom = rep._mntRepGeom(R);
    const svg = rep._mntRepFigure(geom, 'xz', 3, 'test');
    // buildR: Sağ Ön & Sol Ön X–Z\'de çakışır (x=−150,z=100); Sağ/Sol Arka da (x=500,z=120)
    const squares = (svg.match(/<rect /g) || []).length;
    expect(squares).toBeLessThan(4);   // 4 takoz → 2 küme (2 kare)
    expect(svg).toContain(' · ');        // birleşik etiket (ör. "Sağ Ön · Sol Ön")
  });
  test('§8.4 geri tork tablosu (Reverse case varsa)', () => {
    const h = rep._mntRepStep4Torque(R);
    expect(h).toContain('İleri (Forward)');
    expect(h).toContain('Geri (Reverse)');
  });
  test('Frekans yerleşimi: girdi varsa üretilir, yoksa boş', () => {
    expect(rep._mntRepFreqPlacement(R, {})).toBe('');
    expect(rep._mntRepFreqPlacement(R, { idleRpm: 0, cylinders: 6 })).toBe('');
    const h = rep._mntRepFreqPlacement(R, { idleRpm: 650, cylinders: 6 });
    expect(h).toContain('Frekans yerleşimi');
    expect(h).toContain('32,5');                 // f_ateş = (650/60)*(6/2)
    expect(h).toMatch(/note (check|warn)/);
  });
  test('_mntRepCaseTr yük durumu adlarını Türkçeleştirir', () => {
    expect(rep._mntRepCaseTr('Max Bump')).toContain('Tümsek');
    expect(rep._mntRepCaseTr('Bilinmeyen')).toBe('Bilinmeyen');
  });
  test('Dinamik numaralandırma: Tablo 1..N boşluksuz artar', () => {
    const s8 = rep._mntRepSection8(R, { idleRpm: 650, cylinders: 6 });
    const nums = (s8.match(/Tablo (\d+) —/g) || []).map(s => +s.match(/\d+/)[0]);
    expect(nums.length).toBeGreaterThanOrEqual(8);
    nums.forEach((n, i) => expect(n).toBe(i + 1)); // 1,2,3,... kesintisiz
  });
});

describe('Şablon montajı — token doldurma + $$ sınırlayıcı korunması', () => {
  const B64 = (s) => Buffer.from(s, 'utf8').toString('base64');
  test('_mntBuildReportHTML tokenları doldurur, $$ BOZMAZ, artık token bırakmaz', () => {
    // Küçük sahte şablon: bir $$ denklemi + tüm tokenlar
    const tpl = '<style>@@ASSETS_CSS@@</style><body>@@ANTET@@ @@SECTION8@@'
      + '<script>@@KATEX_JS@@</script>$$ \\mathbf{K}\\mathbf{q}=\\mathbf{F} $$</body>';
    window.MNT_REPORT_TEMPLATE_B64 = B64(tpl);
    window.MNT_REPORT_ASSETS = { fontsCss: '/*FONTS*/', katexCss: '/*KATEX_CSS*/', katexJs: 'KATEX_JS_BODY' };
    const html = rep._mntBuildReportHTML(R);
    expect(html).not.toContain('@@');                 // tüm tokenlar dolduruldu
    expect(html).toContain('/*FONTS*/');
    expect(html).toContain('/*KATEX_CSS*/');
    expect(html).toContain('KATEX_JS_BODY');
    expect(html).toContain('490');                    // antet kütle (dinamik)
    expect(html).toContain('Tablo 1');                // §8 enjekte edildi
    // KRİTİK: $$ sınırlayıcılar tek $'a düşmemeli (String.replace $$→$ tuzağı).
    // Şablon denklemi sağlam + §8 dinamik denklemleri de eklendiğinden toplam
    // "$$" sayısı çift (tüm sınırlayıcılar eşli) ve şablonunkinden fazla olmalı.
    expect(html).toContain('$$ \\mathbf{K}\\mathbf{q}=\\mathbf{F} $$');
    const dd = (html.match(/\$\$/g) || []).length;
    expect(dd).toBeGreaterThan(2);
    expect(dd % 2).toBe(0);
  });
});

describe('Gömülü teori şablonu — sınırlayıcı sağlamlığı (regresyon)', () => {
  test('boot renderMathInElement delimiter\'ı "$$" (tek "$" DEĞİL)', () => {
    require('../../js/mount-report-template.js'); // window.MNT_REPORT_TEMPLATE_B64
    const t = decodeURIComponent(escape(atob(window.MNT_REPORT_TEMPLATE_B64)));
    expect(t).toContain('left:"$$",right:"$$"');
    expect(t).not.toContain('left:"$",right:"$"');
    // teori denklemleri sağlam: $$ çift sayıda (açılış/kapanış eşli)
    const dd = (t.match(/\$\$/g) || []).length;
    expect(dd).toBeGreaterThan(0);
    expect(dd % 2).toBe(0);
    // tokenlar hâlâ yerinde (üreteç bunları dolduracak)
    ['@@ASSETS_CSS@@', '@@KATEX_JS@@', '@@ANTET@@', '@@SECTION8@@'].forEach(k =>
      expect(t).toContain(k));
  });
});
