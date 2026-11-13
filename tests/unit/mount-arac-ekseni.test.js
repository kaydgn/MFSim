/**
 * mount-arac-ekseni.test.js — ARACIN İLERİ YÖNÜ · TORK YÖNÜ · KALDIRIM DARBESİ
 * ─────────────────────────────────────────────────────────────────────
 * Çözücü'nün ayarı (2026-11-02, iki Adams defterinden: mount-adams-tulga ·
 * mount-adams-ttar). Yük kitabının TEK üreticisi (_mntYukDurumlari) üç ayarı
 * okur; kapılar:
 *
 *   · VARSAYILAN ESKİ DAVRANIŞTIR — ayarsız proje birebir eski yük kitabını
 *     çözer (MNT_AUTO_CASES + Tx = −T_shaft): kayıtlı hiçbir projenin sonucu
 *     değişmez.
 *   · İLERİ +X yalnız n_x ve n_y'yi çevirir — n_z ve tork aynı. Tasarım yük
 *     durumları ve ivme süpürmeleri aynı çeviriden geçer.
 *   · TORK YÖNÜ ileri yönden TÜRETİLMEZ (krankın modeldeki dönüşü ve
 *     aktarmanın çevirmesi): ayrı ayar, vites başına durumlar da okur.
 *   · KALDIRIM DARBESİ ivme ve yön; L ile R ayna.
 *   · Ayar imzaya girer (sonuç bayatlar, parametrik tarama eskir); pencere yük
 *     kitabını yerinde tazeler; varsayılan seçim alan yazmaz.
 *   · Örneğin iki kopyası (JSON topolojisi + çekirdek modeli) aynı ayarı taşır.
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.veMntSignals = require('../../js/mount-signals.js');
global.veMntBrief = require('../../js/mount-brief.js');
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');
const rep = require('../../js/cp-mount-report.js');
global.veMntUygunluk = rep.veMntUygunluk;
global.veMntRaporOpts = rep.veMntRaporOpts;
global._mntRepCaseTr = rep._mntRepCaseTr;
global._mntRepIsolation = rep._mntRepIsolation;
global._mntRepEngine = rep._mntRepEngine;
global._mntRepZeta = rep._mntRepZeta;

const ornek = (ad) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples', ad + '_topoloji.json'), 'utf8'));
function kur(ad) {
  const t = ornek(ad);
  global.nodes = t.nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  global.connections = t.connections || [];
  return global.nodes;
}
const cozucu = () => global.nodes.find((n) => n.type === 'mnt-solver');
const durum = (L, ad) => L.find((c) => c.name === ad);
const TQ = { Te: 3000, Rstall: 1.62, iTransfer: 1.407, g1: 3.51, g2: 2.0, gR: -4.8, phiFwd: 1 / 3.6, phiRev: 2.6 / 3.6 };

beforeEach(() => { resetStubs(stubs); cp._mntForgetResults(); global._veMntLast = null; });

describe('AYAR — doğrulama ve varsayılan', () => {
  // Kaldırım darbesi STANDART 2,5 g (Canlı Not 144 — Tulga'nın yük kitabı; önce 1,55 g)
  test('boş ayar varsayılan: ileri −X · tork −X · kaldırım 2,5 g virajın tersi', () => {
    const V = { ileri: '-x', kaldirimG: 2.5, kaldirimYon: 'ters', torkYon: '-x' };
    expect(cp._mntYonAyari()).toEqual(V);
    expect(cp._mntYonAyari({})).toEqual(V);
    expect([cp.MNT_ILERI, cp.MNT_KALDIRIM_G, cp.MNT_KALDIRIM_YON, cp.MNT_TORK_YON]).toEqual(['-x', 2.5, 'ters', '-x']);
  });
  test('tanınmayan değer varsayılana düşer; kaldırım ivmesi > 0 olmalı', () => {
    expect(cp._mntYonAyari({ ileri: 'x', torkYon: '+X', kaldirimYon: 'sol', kaldirimG: 0 }))
      .toEqual({ ileri: '-x', kaldirimG: 2.5, kaldirimYon: 'ters', torkYon: '-x' });
    expect(cp._mntYonAyari({ kaldirimG: '-2' }).kaldirimG).toBe(2.5);
    expect(cp._mntYonAyari({ kaldirimG: 'abc' }).kaldirimG).toBe(2.5);
    expect(cp._mntYonAyari({ ileri: '+x', torkYon: '+x', kaldirimYon: 'ayni', kaldirimG: '3.5' }))
      .toEqual({ ileri: '+x', kaldirimG: 3.5, kaldirimYon: 'ayni', torkYon: '+x' });
  });
});

describe('YÜK KİTABI — tek üretici', () => {
  test('VARSAYILAN ESKİ DAVRANIŞTIR: g-durumları MNT_AUTO_CASES, Tx = −T_shaft', () => {
    const L = cp._mntYukDurumlari({ torque: TQ });
    const eski = cp.MNT_AUTO_CASES.concat(cp._mntTorqueCases(TQ));
    expect(L.map((c) => [c.name, c.n, c.T])).toEqual(eski.map((c) => [c.name, c.n, c.T]));
    const f = durum(L, 'Forward Torque');
    expect(f.T[0]).toBeCloseTo(-f.Tshaft, 9);
    expect(f.Tshaft).toBeCloseTo(6667.07, 0);                         // SPEC T5
    expect(durum(L, 'Reverse Torque').T[0]).toBeGreaterThan(0);
  });

  test('İLERİ +X: n_x ve n_y çevrilir, n_z ve tork aynı', () => {
    const A = cp._mntYukDurumlari({ torque: TQ });
    const B = cp._mntYukDurumlari({ torque: TQ, yon: cp._mntYonAyari({ ileri: '+x' }) });
    expect(B.length).toBe(A.length);
    A.forEach((a, i) => {
      const b = B[i];
      expect(b.name).toBe(a.name);
      expect([b.n[0] + 0, b.n[1] + 0, b.n[2]]).toEqual([-a.n[0] + 0, -a.n[1] + 0, a.n[2]]);
      expect(b.T).toEqual(a.T);
    });
    expect(durum(B, 'Braking').n).toEqual([1, -0, -1]);
    expect(durum(B, 'Cornering Left').n[1]).toBe(-0.6);
  });

  test('TORK YÖNÜ ayrı ayar: +X → Tx = +T_shaft; ileri yön torku çevirmez', () => {
    const tork = (yon) => cp._mntYukDurumlari({ torque: TQ, yon: cp._mntYonAyari(yon) })
      .filter((c) => c.Tshaft != null).map((c) => c.T[0] / c.Tshaft);
    expect(tork({})).toEqual([-1, -1]);
    expect(tork({ ileri: '+x' })).toEqual([-1, -1]);
    expect(tork({ torkYon: '+x' })).toEqual([1, 1]);
    expect(tork({ ileri: '+x', torkYon: '+x' })).toEqual([1, 1]);
    // vites başına durumlar (Kriter 3) aynı işaretten
    const v = (yon) => cp._mntGearTorqueCases(TQ, cp._mntYonAyari(yon)).map((c) => Math.sign(c.T[0]) * Math.sign(c.Tshaft));
    expect(v({})).toEqual([-1, -1, -1]);
    expect(v({ torkYon: '+x' })).toEqual([1, 1, 1]);
  });

  test('KALDIRIM DARBESİ: ivme ve yön, L ile R ayna', () => {
    const ky = (yon) => {
      const L = cp._mntYukDurumlari({ yon: cp._mntYonAyari(yon) });
      return [durum(L, 'Kerb Strike L').n, durum(L, 'Kerb Strike R').n, durum(L, 'Cornering Left').n[1]];
    };
    let [l, r, vL] = ky({});
    expect(l).toEqual([0, -2.5, -1]);
    expect(r).toEqual([0, 2.5, -1]);
    expect(Math.sign(l[1])).toBe(-Math.sign(vL));                    // virajın tersi
    [l, r, vL] = ky({ kaldirimG: 3.5, kaldirimYon: 'ayni' });
    expect(l).toEqual([0, 3.5, -1]);
    expect(r).toEqual([0, -3.5, -1]);
    expect(Math.sign(l[1])).toBe(Math.sign(vL));                     // virajla aynı
    [l, r, vL] = ky({ ileri: '+x', kaldirimG: 3.5, kaldirimYon: 'ayni' });
    expect(l[1]).toBe(-3.5);                                          // ileri +X çevirisinden de geçer
    expect(Math.sign(l[1])).toBe(Math.sign(vL));
  });

  test('MNT_AUTO_CASES MUTASYONA UĞRAMAZ (üretici kopya döndürür)', () => {
    const once = JSON.stringify(cp.MNT_AUTO_CASES);
    const L = cp._mntYukDurumlari({ yon: cp._mntYonAyari({ ileri: '+x', kaldirimG: 3, kaldirimYon: 'ayni' }) });
    L.forEach((c) => { c.n[0] = 99; });
    expect(JSON.stringify(cp.MNT_AUTO_CASES)).toBe(once);
  });
});

describe('ÇÖZÜM — ayarın gittiği her yer', () => {
  test('toplayıcı ayarı Çözücü\'den okur; çözücü verilmezse listedekinden', () => {
    const L = kur('siper');
    expect(cp._mntGatherForSolver().yon).toEqual(cp._mntYonAyari(cozucu().data));
    expect(cp._mntGatherForSolver(null, L).yon.ileri).toBe('+x');
    expect(cp._mntGatherForSolver({ data: {} }, L).yon.ileri).toBe('-x');
  });

  test('tasarım yük durumları çevrilir; R.yon süpürmeye gider', () => {
    kur('siper');
    const R = cp._mntComputeResults(cozucu().id);
    expect(R.error).toBeUndefined();
    expect(R.yon).toEqual({ ileri: '+x', kaldirimG: 3.5, kaldirimYon: 'ayni', torkYon: '-x' });
    const tas = (ad) => R.designCases.find((c) => c.name === ad).loadCase.n;
    expect(tas('1g Boyuna (fren)')).toEqual([1, -0, -1]);
    expect(tas('1g Yanal')).toEqual([-0, -1, -1]);
    expect(tas('3,5g Düşey')).toEqual([-0, -0, -3.5]);
  });

  test('ivme süpürmesi aracın ekseninde: ileri +X\'te yanal ve boyuna vektör çevrilir', () => {
    const gor = [];
    const solveOne = (lc) => { gor.push(lc); return null; };
    const R = { mounts: [{ name: 'a', pos: [0, 0, 0] }], yon: { ileri: '+x' } };
    global.veMntSignals.build(R, { solveOne });
    const ilk = (k) => gor.filter((c) => c.name.indexOf(k + '@') === 0).pop().n;
    expect(ilk('gy')[0] + 0).toBe(0);
    expect(ilk('gy')[1]).toBeLessThan(0);                             // [0, a, −1] → [0, −a, −1]
    expect(ilk('gx')[0]).toBeGreaterThan(0);                          // [−a, 0, −1] → [a, 0, −1]
    gor.length = 0;
    global.veMntSignals.build(Object.assign({}, R, { yon: { ileri: '-x' } }), { solveOne });
    expect(ilk('gy')[1]).toBeGreaterThan(0);
    expect(ilk('gx')[0]).toBeLessThan(0);
  });

  test('rapor §8.4 mil torkunu yük durumunun T_shaft\'ından okur — işaretten değil', () => {
    expect(rep._mntRepTshaft({ loadCase: { T: [9000, 0, 0], Tshaft: 9000 } })).toBe(9000);
    expect(rep._mntRepTshaft({ loadCase: { T: [-9000, 0, 0], Tshaft: 9000 } })).toBe(9000);
    expect(rep._mntRepTshaft({ loadCase: { T: [-9000, 0, 0] } })).toBe(9000);      // eski çözüm: Tx = −T_shaft
    expect(rep._mntRepTshaft(null)).toBeNaN();
    kur('tulga');
    const R = cp._mntComputeResults(cozucu().id);
    const f = R.allCases.find((c) => c.name === 'Forward Torque');
    expect(f.loadCase.T[0]).toBeGreaterThan(0);                       // Tulga: tork yönü +X
    expect(rep._mntRepTshaft(f)).toBeCloseTo(12760.66, 1);
  });
});

describe('RAPOR — eksen varsayımı belgede, bordürün adında sabit ivme yok', () => {
  test('§8.5\'in cümlesi Çözücü\'nün ayarından; eski çözümde (R.yon yok) varsayılanlar', () => {
    expect(rep._mntRepCaseTr('Kerb Strike L')).toBe('Yanal bordür darbesi — sol');
    expect(rep._mntRepCaseTr('Kerb Strike R')).toBe('Yanal bordür darbesi — sağ');
    expect(rep._mntRepYonCumle({ yon: cp._mntYonAyari({ ileri: '+x', kaldirimG: 3.5, kaldirimYon: 'ayni' }) }))
      .toBe('<p>Araç ekseni: ileri yön +X; ileri vites tork momenti −X; yanal bordür darbesi 3,5 g, virajla aynı yönde.</p>');
    expect(rep._mntRepYonCumle({}))
      .toBe('<p>Araç ekseni: ileri yön −X; ileri vites tork momenti −X; yanal bordür darbesi 1,55 g, virajın tersi yönde.</p>');
    kur('tulga');
    const R = cp._mntComputeResults(cozucu().id);
    expect(rep._mntRepYonCumle(R)).toContain('tork momenti +X');
  });
});

describe('İMZA — ayar sonucu bayatlatır', () => {
  test('her ayar ayrı ayrı bayatlatır, geri alınınca güncel', () => {
    kur('tulga');
    global._veMntLast = cp._mntComputeResults(cozucu().id);
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
    const d = cozucu().data;
    const tr = global.nodes.find((x) => x.type === 'mnt-transfer').data;   // tork yönü transferin dönüşünden (F049)
    tr.donus = 'ayni';
    expect(cp.veMntSonucDurumu().durum).toBe('bayat');
    tr.donus = 'ters';
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
    [['ileri', '+x'], ['kaldirimG', 2], ['kaldirimYon', 'ayni']].forEach(([k, v]) => {
      const once = d[k];
      d[k] = v;
      expect(`${k} ${cp.veMntSonucDurumu().durum}`).toBe(`${k} bayat`);
      if (once === undefined) delete d[k]; else d[k] = once;
      expect(cp.veMntSonucDurumu().durum).toBe('guncel');
    });
  });
  test('varsayılanı yazmak bayatlatmaz (aynı fizik)', () => {
    kur('siper');
    global._veMntLast = cp._mntComputeResults(cozucu().id);
    const d = cozucu().data;
    d.torkYon = '-x';
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
  });
});

describe('PENCERE — Çözücü\'nün "Yük durumları" kategorisi', () => {
  const ac = (n) => { document.body.innerHTML = '<div class="ve-properties-content">' + cp.getMntSolverPropertiesHTML(n) + '</div>'; };
  // KALDIRIM DARBESİNİN BÖLÜMÜ YOK (kullanıcı 2026-11-11, Canlı Not 144: "Bunu kullanıcıya
  // girdirmeyelim … standart olarak verelim"): girdisi yok, değeri yük kitabının Kerb Strike
  // satırında — Siper'in kaydındaki Adams değeri (3,5 g virajla aynı) okunur. Araç ekseni de yok
  // (Canlı Not 121).
  test('Kaldırım darbesi bölümü YOK; Araç ekseni bölümü yok; örneğin kaydı yük kitabında', () => {
    kur('siper');
    const n = cozucu();
    ac(n);
    const bolumler = [...document.querySelectorAll('.ve-fp-kat[data-k="dur"] .ve-fp-sect b')].map((b) => b.textContent);
    expect(bolumler).toEqual(['Yük kitabı']);
    ['ileri', 'torkYon', 'kaldirimYon', 'kaldirimG'].forEach((k) => expect(document.getElementById('ve-mnt-' + k + '-' + n.id)).toBeNull());
    const kerb = [...document.querySelectorAll('#ve-mnt-cdur-' + n.id + ' tbody tr')]
      .find((tr) => tr.firstChild && tr.firstChild.getAttribute('title') === rep._mntRepCaseTr('Kerb Strike L'));
    expect(kerb.children[2].textContent.replace('−', '-')).toMatch(/^-?3,5/);
    expect(document.querySelector('#ve-mnt-cdur-' + n.id + ' .ve-fp-sect em').textContent).toMatch(/ · ileri \+X · tork −X$/);
  });

  test('ayar değişince yük kitabı YERİNDE tazelenir; seçici kurulmaz', () => {
    kur('tulga');
    const n = cozucu();
    ac(n);
    const sec = document.getElementById('ve-mnt-solveMode-' + n.id);
    const ad = rep._mntRepCaseTr('Braking');
    const fren = () => [...document.querySelectorAll('#ve-mnt-cdur-' + n.id + ' tbody tr')]
      .find((tr) => tr.firstChild && tr.firstChild.getAttribute('title') === ad);
    const nx = () => fren().children[1].textContent;
    const once = nx();
    cp.veMntSetYon(n.id, 'ileri', '+x');                                // projede yazılı yön (programın yazıcısı)
    expect(cp.veMntPencereTazele()).toBeGreaterThan(0);
    expect(sec).toBeTruthy();
    expect(document.getElementById('ve-mnt-solveMode-' + n.id)).toBe(sec);
    expect(nx()).not.toBe(once);
  });

  test('yazıcı: varsayılan alan yazmaz (ileri yön hariç — onay); geçersiz ivme varsayılana döner; saveState mutasyondan sonra', () => {
    kur('tulga');
    const n = cozucu();
    let gorulen = null;
    global.saveState.mockImplementation(() => { gorulen = JSON.stringify(n.data); });
    cp.veMntSetYon(n.id, 'ileri', '+x');
    expect(n.data.ileri).toBe('+x');
    expect(JSON.parse(gorulen).ileri).toBe('+x');
    cp.veMntSetYon(n.id, 'ileri', '-x');
    expect(n.data.ileri).toBe('-x');                                  // ileri yönde seçim ONAYDIR (F048)
    cp.veMntSetYon(n.id, 'torkYon', '-x');
    expect('torkYon' in n.data).toBe(false);
    cp.veMntSetYon(n.id, 'kaldirimG', '3.5');
    expect(n.data.kaldirimG).toBe(3.5);
    cp.veMntSetYon(n.id, 'kaldirimG', '0');
    expect('kaldirimG' in n.data).toBe(false);
    cp.veMntSetYon(n.id, 'kaldirimYon', 'ayni');
    expect(n.data.kaldirimYon).toBe('ayni');
    cp.veMntSetYon(n.id, 'kaldirimYon', 'ters');
    expect('kaldirimYon' in n.data).toBe(false);
    const k = global.saveState.mock.calls.length;
    cp.veMntSetYon(n.id, 'zeta', '0.5');                              // tanınmayan alan yazılmaz
    expect(global.saveState.mock.calls.length).toBe(k);
    expect('zeta' in n.data).toBe(false);
  });
});

// YÖNTEM YAN YANA (Canlı Not 165, kullanıcı: *"'sönüm oranı' yazısının yanındaki 'tüm montaj'
// ifadesini de kaldıralım. Ek olarak, çözüm modu ve sönüm oranı satırlarını yan yana verelim, (i)
// butonu sönüm oranı yazısının yanında olsun."*). Önce: iki alan alt alta, her biri sütunun tam
// eninde; ζ'nin adı "Sönüm oranı ζ · tüm montaj", 'i' girdinin sağında. Şimdi: tek satır iki
// sütun, ad üstte; 'i' adın satırında, girdi sütunun tam eninde. Gerçek tarayıcıda 379 px sütunda
// iki denetim 176 px, en uzun seçenek ("Lineer (statik rijitlik)") 102 px / 151 px iç en.
describe('YÖNTEM YAN YANA (Canlı Not 165)', () => {
  const ac = (n) => { document.body.innerHTML = '<div class="ve-properties-content">' + cp.getMntSolverPropertiesHTML(n) + '</div>'; };
  const yontem = () => [...document.querySelectorAll('.ve-fp-card')]
    .find((s) => { const b = s.querySelector(':scope > .ve-fp-sect > b'); return b && b.textContent === 'Yöntem'; });

  test('"tüm montaj" yok: ad yalnız "Sönüm oranı ζ", başlığın yanında ek yok', () => {
    kur('tulga');
    const n = cozucu();
    ac(n);
    expect(document.body.textContent.toLocaleLowerCase('tr')).not.toContain('tüm montaj');
    const l = document.querySelector('label[for="ve-mnt-zeta-' + n.id + '"]');
    expect(l.textContent).toBe('Sönüm oranı ζ');
    expect(yontem().querySelector('.ve-fp-sect em')).toBeNull();
  });

  test('iki denetim TEK satırda: aynı iki sütunlu ızgaranın iki hücresi, ad üstte', () => {
    kur('tulga');
    const n = cozucu();
    ac(n);
    const sec = document.getElementById('ve-mnt-solveMode-' + n.id), z = document.getElementById('ve-mnt-zeta-' + n.id);
    const izgara = sec.closest('.ve-fp-grid');
    expect(izgara).toBe(z.closest('.ve-fp-grid'));
    expect(izgara.getAttribute('style')).toContain('--fp-k:2;');
    const hucre = [...izgara.children];
    expect(hucre.length).toBe(2);
    expect([hucre[0].contains(sec), hucre[1].contains(z)]).toEqual([true, true]);
    hucre.forEach((h) => expect(h.firstElementChild.classList.contains('ve-fp-l')).toBe(true));   // ad üstte
    expect(yontem().querySelectorAll('.ve-fp-grid').length).toBe(1);
    expect([...sec.options].map((o) => o.textContent)).toEqual(['Otomatik', 'Nonlineer (Newton)', 'Lineer (statik rijitlik)']);
  });

  test('(i) Sönüm oranı adının satırında, girdinin yanında değil; işlevi aynı (kaynak ipucu)', () => {
    kur('tulga');
    const n = cozucu();
    ac(n);
    const z = document.getElementById('ve-mnt-zeta-' + n.id);
    const alan = z.closest('[data-mnt-vars]');
    const ad = alan.querySelector('.ve-fp-l');
    const i = alan.querySelector('.ve-fp-i');
    expect(ad.contains(i)).toBe(true);
    expect(ad.querySelector('label').contains(i)).toBe(false);               // <label> yalnız adı sarar
    expect(z.parentElement).toBe(alan);                                      // girdi sütunun tam eninde
    expect(alan.querySelector('.ve-fp-deger')).toBeNull();
    expect([i.getAttribute('data-kaynak'), i.getAttribute('data-ipucu'), i.getAttribute('aria-label')])
      .toEqual(['varsayilan', 'Varsayılan — şirket kabulü.', 'Varsayılan — şirket kabulü.']);
  });

  test('ζ yazmak Çözücü\'nün alanını değiştirir; tek kayıt, değişiklikten SONRA', () => {
    kur('tulga');
    const n = cozucu();
    ac(n);
    global.veMntSetZeta = cp.veMntSetZeta;
    const kayit = [];
    stubs.saveState.mockImplementation(() => kayit.push(n.data.zeta));
    try {
      const z = document.getElementById('ve-mnt-zeta-' + n.id);
      z.value = '0.05'; z.dispatchEvent(new Event('change'));
      expect(kayit).toEqual([0.05]);
      expect(n.data.zeta).toBe(0.05);
    } finally {
      stubs.saveState.mockReset();
      delete global.veMntSetZeta;
    }
  });
});

describe('ÖRNEKLER — iki kopya aynı ayarı taşır', () => {
  const ALANLAR = ['ileri', 'torkYon', 'kaldirimG', 'kaldirimYon'];
  test('JSON\'un Çözücü ayarı = çekirdek modelinin solver alanı (yoksa varsayılan)', () => {
    let n = 0;
    core.getMountExampleList().forEach((e) => {
      const ex = core.getMountExample(e.id);
      if (!ex || !ex.topology) return;
      const t = JSON.parse(fs.readFileSync(path.join(__dirname, '../..', ex.topology), 'utf8'));
      const cz = (t.nodes.find((x) => x.type === 'mnt-solver') || {}).data || {};
      expect(`${e.id} ${JSON.stringify(cp._mntYonAyari(cz))}`)
        .toBe(`${e.id} ${JSON.stringify(cp._mntYonAyari(ex.model.solver))}`);
      ALANLAR.forEach((k) => { if (cz[k] != null) n++; });
      const tj = (t.nodes.find((x) => x.type === 'mnt-transfer') || {}).data || {};
      const tc = ex.model.components.find((c) => c.kind === 'mnt-transfer') || {};
      expect(`${e.id} ${tj.donus}`).toBe(`${e.id} ${tc.donus}`);     // transferin dönüşü (F049)
    });
    expect(n).toBe(5);                                                // Siper 3 · Tulga 2 (tork transferde)
  });

  test('Siper: ileri +X, kaldırım 3,5 g virajla aynı · Tulga: tork yönü +X, kaldırım 2,5 g', () => {
    expect(cp._mntYonAyari(core.getMountExample('siper').model.solver))
      .toEqual({ ileri: '+x', kaldirimG: 3.5, kaldirimYon: 'ayni', torkYon: '-x' });
    const T = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples/tulga_topoloji.json'), 'utf8')).nodes;
    expect(cp._mntYonAyari(core.getMountExample('tulga').model.solver, cp._mntIleriOnerisi(T), cp._mntTorkOnerisi(T)))
      .toEqual({ ileri: '-x', kaldirimG: 2.5, kaldirimYon: 'ters', torkYon: '+x' });
  });

  test('rölanti ve silindir: JSON Motor\'u = çekirdek modelinin torque alanı', () => {
    ['siper', 'tulga'].forEach((id) => {
      const ex = core.getMountExample(id);
      const mo = ornek(id).nodes.find((x) => x.type === 'mnt-motor').data;
      expect(`${id} ${+mo.idleRpm} ${+mo.cylinders}`).toBe(`${id} ${ex.model.torque.idleRpm} ${ex.model.torque.cylinders}`);
    });
  });

  test('programatik kurucu (JSON\'suz yol) örneğin ayarını Çözücü\'ye yazar; örnekte olmayanı siler', () => {
    jest.useFakeTimers();
    try {
      let k = 0;
      global.createNode = jest.fn((type, x, y) => {
        global.nodes.push({ id: 'n' + (++k), type, def: componentDefs[type], x, y, width: 80, height: 60, data: {} });
      });
      global.confirm = () => true;
      global.nodes = [{ id: 'cz', type: 'mnt-solver', def: componentDefs['mnt-solver'], data: { torkYon: '+x' } }];
      global.connections = [];
      cp._mntLoadExampleFromModel('siper');
      const d = cozucu().data;
      expect(cp._mntYonAyari(d)).toEqual({ ileri: '+x', kaldirimG: 3.5, kaldirimYon: 'ayni', torkYon: '-x' });
      expect('torkYon' in d).toBe(false);
      const mo = global.nodes.find((x) => x.type === 'mnt-motor').data;
      expect([mo.mass, mo.idleRpm, mo.cylinders]).toEqual([1386.26, 700, 6]);
      global.nodes = [];                                             // çözücü yoksa kurulur ve ayar ona yazılır
      cp._mntLoadExampleFromModel('tulga');
      expect(global.nodes.find((x) => x.type === 'mnt-transfer').data.donus).toBe('ters');
      expect(cp._mntTorkOnerisi(global.nodes).torkYon).toBe('+x');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
      delete global.createNode;
    }
  });

  test('Siper motoru Adams\'ın kütlesi: toplam 2.294,482 kg', () => {
    kur('siper');
    const R = cp._mntComputeResults(cozucu().id);
    expect(R.mp.m).toBeCloseTo(2294.482, 6);
  });
});
