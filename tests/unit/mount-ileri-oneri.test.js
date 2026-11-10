/**
 * mount-ileri-oneri.test.js — İLERİ YÖNÜN ÖNERİSİ güç grubunun dizilişinden (F048)
 * ─────────────────────────────────────────────────────────────────────
 * Hüküm: aracın ileri yönü motor ile şanzımanın (yoksa transfer kutusunun)
 * X sırasından ÖNERİLİR — motorun önü aracın önüne bakar varsayımıyla — ve
 * Çözücü'de ONAYLANIR. Onaysız modelde etkin yön önerinin kendisi; onay
 * `data.ileri`dir (−X de yazılır). Motorun önü geriye bakan araçta (TTAR)
 * öneri tutmaz: onay o yüzden ayrı ve onaysız yön durumla söylenir.
 *
 *   · ÖNERİ — bütün örneklerde motor şanzımandan −X tarafta → −X; CAD ekseni
 *     Z etrafında 180° dönük modelde → +X; şanzımansız güç grubunda transfer;
 *     eş X'te öneri yok.
 *   · SESSİZ HATA — 180° dönük Tulga onaysız çözülür: yük durumları asıl
 *     Tulga'nın döndürülmüşü (öneri). Sabit −X varsayımıyla aynı model boyuna
 *     ve yanal durumlarda ters çıkıyordu (fark burada ölçülür).
 *   · ESKİ PROJE — örneklerin hepsinde öneri eski varsayılanla (−X) aynı ya da
 *     yön onaylı: kayıtlı hiçbir projenin sonucu değişmez.
 *   · PENCERE — onaysız yön "Onaylanmadı." + Onayla; Onayla yazar ve not
 *     düşer; gövde taşınınca seçici ve not yerinde izler; onaylı yön öneriyle
 *     ayrışıyorsa öneri durum satırında (TTAR).
 *   · İmza önerili yönü taşır; rapor onaysız yönü söyler.
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
global.veMntIleriOnayla = cp.veMntIleriOnayla;           // pencerenin onclick'i

const ORNEKLER = ['asfat', 'hafif', 'kamyon', 'siper', 'tta10', 'tulga', 'kutu'];
const ornek = (ad) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples', ad + '_topoloji.json'), 'utf8'));
function kur(t) {
  global.nodes = t.nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  global.connections = t.connections || [];
  global.veUpdateResultsTree = jest.fn();
  return global.nodes;
}
const cozucu = () => global.nodes.find((n) => n.type === 'mnt-solver');
const govde = (tip) => global.nodes.find((n) => n.type === tip);

// CAD ekseni Z etrafında 180° dönük kopya: x → −x, y → −y (Ixz, Iyz işaret değiştirir)
function dondur(t) {
  t.nodes.forEach((n) => {
    const d = n.data || {};
    ['cgx', 'cgy', 'x', 'y'].forEach((k) => { if (d[k] != null && d[k] !== '') d[k] = -Number(d[k]); });
    ['Ixz', 'Iyz'].forEach((k) => { if (d[k] != null && d[k] !== '') d[k] = -Number(d[k]); });
  });
  return t;
}
const GDURUM = (R) => R.allCases.filter((c) => c.res && c.loadCase && (c.loadCase.T || [0, 0, 0]).every((v) => v === 0));

beforeEach(() => { resetStubs(stubs); cp._mntForgetResults(); global._veMntLast = null; });

describe('ÖNERİ — motor ile şanzımanın X sırası', () => {
  test('bütün örneklerde motor şanzımandan −X tarafta: öneri −X', () => {
    ORNEKLER.forEach((ad) => {
      kur(ornek(ad));
      const O = cp._mntIleriOnerisi();
      if (!govde('mnt-gearbox') && !govde('mnt-transfer')) { expect(`${ad} ${O}`).toBe(`${ad} null`); return; }
      expect(`${ad} ${O && O.ileri}`).toBe(`${ad} -x`);
    });
  });
  test('180° dönük CAD ekseninde öneri +X', () => {
    kur(dondur(ornek('tulga')));
    expect(cp._mntIleriOnerisi()).toMatchObject({ ileri: '+x', arka: 'mnt-gearbox' });
  });
  test('şanzıman yoksa transfer kutusu; eş X\'te ve motorsuz öneri yok', () => {
    kur(ornek('tulga'));
    global.nodes = global.nodes.filter((n) => n.type !== 'mnt-gearbox');
    expect(cp._mntIleriOnerisi()).toMatchObject({ ileri: '-x', arka: 'mnt-transfer' });
    govde('mnt-transfer').data.cgx = govde('mnt-motor').data.cgx;
    expect(cp._mntIleriOnerisi()).toBeNull();
    global.nodes = global.nodes.filter((n) => n.type !== 'mnt-motor');
    expect(cp._mntIleriOnerisi()).toBeNull();
  });
});

describe('ETKİN YÖN — onaysız modelde öneri, onaylıda onay', () => {
  test('onaysız: öneri; onaylı: alan; öneri yoksa varsayılan −X', () => {
    kur(dondur(ornek('tulga')));
    delete cozucu().data.ileri;
    let g = cp._mntGatherForSolver(cozucu());
    expect([g.yon.ileri, g.ileriOnay]).toEqual(['+x', false]);
    cozucu().data.ileri = '-x';
    g = cp._mntGatherForSolver(cozucu());
    expect([g.yon.ileri, g.ileriOnay]).toEqual(['-x', true]);
    expect(cp._mntYonAyari({}).ileri).toBe('-x');
  });

  test('ESKİ PROJE: örneklerin etkin yönü değişmez (öneri −X ya da yön onaylı)', () => {
    const BEKLENEN = { siper: '+x', tulga: '-x' };
    ORNEKLER.forEach((ad) => {
      kur(ornek(ad));
      const cz = cozucu();
      if (!cz) return;
      expect(`${ad} ${cp._mntGatherForSolver(cz).yon.ileri}`).toBe(`${ad} ${BEKLENEN[ad] || '-x'}`);
    });
  });

  test('SESSİZ HATA: 180° dönük Tulga onaysız çözülünce asıl Tulga\'nın döndürülmüşü', () => {
    kur(ornek('tulga'));
    const A = cp._mntComputeResults(cozucu().id);
    expect(A.error).toBeUndefined();
    const coz = (ileri) => {
      kur(dondur(ornek('tulga')));
      const cz = cozucu();
      if (ileri) cz.data.ileri = ileri; else delete cz.data.ileri;
      cz.data.torkYon = '-x';                                         // tork F049'un konusu; g-durumları kıyaslanır
      const R = cp._mntComputeResults(cz.id);
      expect(R.error).toBeUndefined();
      return R;
    };
    const fark = (R) => {
      let m = 0;
      GDURUM(A).forEach((c) => {
        const b = R.allCases.find((x) => x.name === c.name);
        c.res.perMount.forEach((pm, i) => {
          const d = b.res.perMount[i].delta;
          m = Math.max(m, Math.abs(-pm.delta[0] - d[0]), Math.abs(-pm.delta[1] - d[1]), Math.abs(pm.delta[2] - d[2]));
        });
      });
      return m * 1000;                                                 // mm
    };
    expect(GDURUM(A).length).toBeGreaterThan(10);
    expect(fark(coz(null))).toBeLessThan(1e-6);                       // öneri: birebir
    expect(fark(coz('-x'))).toBeGreaterThan(10);                      // eski sabit −X: ters (ölçülen 24,6 mm)
  });

  test('imza önerili yönü taşır: motor şanzımanın öbür yanına geçince onaysız sonuç bayatlar', () => {
    kur(ornek('tulga'));
    delete cozucu().data.ileri;
    global._veMntLast = cp._mntComputeResults(cozucu().id);
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
    govde('mnt-motor').data.cgx = 2000;
    expect(cp.veMntSonucDurumu().durum).toBe('bayat');
  });
});

describe('PENCERE — onay', () => {
  const ac = (n) => { document.body.innerHTML = '<div class="ve-properties-content">' + cp.getMntSolverPropertiesHTML(n) + '</div>'; };
  const not = (n) => document.getElementById('ve-mnt-ileri-not-' + n.id);

  test('onaysız: seçici öneride, "Onaylanmadı." + Onayla; Onayla yazar, not düşer', () => {
    kur(dondur(ornek('tulga')));
    const n = cozucu();
    delete n.data.ileri;
    ac(n);
    expect(document.getElementById('ve-mnt-ileri-' + n.id).value).toBe('+x');
    expect(not(n).querySelector('.ve-fp-not').getAttribute('data-d')).toBe('warn');
    expect(not(n).textContent).toContain('Onaylanmadı.');
    expect(not(n).textContent).toContain('+X');
    not(n).querySelector('button').click();
    expect(n.data.ileri).toBe('+x');
    cp.veMntPencereTazele();
    expect(not(n).textContent).toBe('');
  });

  test('onaysız modelde gövde taşınınca seçici ve not yerinde izler; seçici kurulmaz', () => {
    kur(ornek('tulga'));
    const n = cozucu();
    delete n.data.ileri;
    ac(n);
    const sec = document.getElementById('ve-mnt-ileri-' + n.id);
    expect(sec.value).toBe('-x');
    govde('mnt-motor').data.cgx = 2000;
    expect(cp.veMntPencereTazele()).toBeGreaterThan(0);
    expect(document.getElementById('ve-mnt-ileri-' + n.id)).toBe(sec);
    expect(sec.value).toBe('+x');
    expect(not(n).textContent).toContain('+X');
  });

  test('TTAR: onaylı +X öneriyle (−X) ayrışır — öneri uyarısız durum satırında', () => {
    kur(ornek('siper'));
    const n = cozucu();
    ac(n);
    expect(document.getElementById('ve-mnt-ileri-' + n.id).value).toBe('+x');
    const s = not(n).querySelector('.ve-fp-not');
    expect(s.hasAttribute('data-d')).toBe(false);
    expect(s.textContent).toBe('Diziliş önerisi −X.');
    expect(not(n).querySelector('button')).toBeNull();
  });
});

describe('RAPOR — onaysız yön söylenir', () => {
  test('R.ileriOnay false → "(onaylanmadı)"; onaylıda yok', () => {
    kur(ornek('tulga'));
    let R = cp._mntComputeResults(cozucu().id);
    expect(R.ileriOnay).toBe(true);
    expect(rep._mntRepYonCumle(R)).not.toContain('onaylanmadı');
    delete cozucu().data.ileri;
    R = cp._mntComputeResults(cozucu().id);
    expect(R.ileriOnay).toBe(false);
    expect(rep._mntRepYonCumle(R)).toContain('ileri yön −X (onaylanmadı)');
  });
});
