/**
 * Takoz kütüphanesi — AD KURALI
 * ─────────────────────────────
 * Kullanıcı kararı (2026-10-19): "Takoz adlarını güncelleyelim. Aynı olan
 * takozlar varsa kaldıralım … Takoz adları genel ve resmi olsun."
 *
 *   • ad = ürün + sertlik + (parça no), üreticinin adıyla — "Cone 38 60 ShA
 *     (AMC 137963)" · "TK040 45 ShA (57RS329001M)"; proje, rapor ve not ada
 *     girmez ("Cone 38 60Sh (AMC 137963 · BMC 8x8 çalışma noktası)", "Mount 1
 *     40 ShA (BMC FEA · parça no yok)" ve "AMC 55 ShA" — o parça LMT-1433-37 —
 *     böyleydi);
 *   • aynı parça TEK girdi (üç AMC parçası iki kez duruyordu: nominal + '-calc');
 *   • tek istisna 57RS313773/57RS313774: aynı kod iki kaynakta farklı değerlerle
 *     geçiyor, kullanıcı teyidi "farklı takozlar" — ad kaynağı taşır
 *     (bkz. mount-library-sources.test.js);
 *   • kaldırılan girdiye bağlı kayıtlı takoz değerlerini korur.
 */

const core = require('../../js/mount-core.js');
global.veMountCore = core;

const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; });

const L = cp.VE_MOUNT_LIBRARY;
const KAYNAKLI = { '57RS313773': 'A26', '57RS313774': 'A26', '57RS313773-sr116': 'ASR-SR-116', '57RS313774-sr116': 'ASR-SR-116' };
const ADLI = Object.keys(L).filter((k) => !KAYNAKLI[k]);
// ürün + sertlik + isteğe bağlı (parça no): büyük harf ve rakam, üretici önekiyle ("AMC 137963")
const BICIM = /^(\S+(?: \S+)*?) (\d{2}) ShA(?: \(((?:AMC )?[0-9A-Z]+)\))?$/;

describe('AD KURALI — ürün + sertlik + (parça no)', () => {
  test('her ad biçimde: proje, rapor ya da not yok', () => {
    ADLI.forEach((k) => expect([k, BICIM.test(L[k].name)]).toEqual([k, true]));
    Object.values(L).forEach((e) =>
      expect([e.name, /BMC|FEA|8x8|çalışma noktası|parça no|·/i.test(e.name)]).toEqual([e.name, false]));
  });

  test('istisna yalnız 57RS çiftleri: ad = kod (kaynak)', () => {
    Object.entries(KAYNAKLI).forEach(([k, kaynak]) =>
      expect(L[k].name).toBe(k.replace('-sr116', '') + ' (' + kaynak + ')'));
  });

  test('adlar tekil; aynı parça tek girdi', () => {
    const ad = Object.values(L).map((e) => e.name);
    expect(new Set(ad).size).toBe(ad.length);
    const parca = {};
    ADLI.forEach((k) => {
      const m = BICIM.exec(L[k].name), p = m[3] || L[k].name;          // parça no; yoksa adın kendisi
      parca[p] = (parca[p] || []).concat(k);
    });
    Object.keys(parca).forEach((p) => expect([p, parca[p]]).toEqual([p, parca[p].slice(0, 1)]));
  });

  test('sertlik kaynaktaki sertlik: anahtarı söyleyen girdide anahtarla, TK\'de test raporuyla', () => {
    const sh = (k) => Number(BICIM.exec(L[k].name)[2]);
    Object.keys(L).filter((k) => /-\d+sh$/.test(k)).forEach((k) => expect([k, sh(k)]).toEqual([k, Number(/-(\d+)sh$/.exec(k)[1])]));
    // MLMT-0216-33 test raporları: TK035 35 · TK040 45 · TK050 50 ShA
    expect([sh('TK035'), sh('TK040'), sh('TK050')]).toEqual([35, 45, 50]);
    expect(sh('amc55sha')).toBe(55);
  });

  test('Siper\'in takozu kendi parça adıyla: LMT-1433-37 55 ShA (A26\'nın "AMC 55 ShA"sı değil)', () => {
    expect(L.amc55sha.name).toBe('LMT-1433-37 55 ShA');
    const ex = core.MOUNT_EXAMPLES.siper.model.mounts;
    expect(ex).toHaveLength(6);
    ex.forEach((m) => {
      expect(m.kstat).toEqual([L.amc55sha.sx, L.amc55sha.sy, L.amc55sha.sz]);
      expect(m.kdyn).toEqual([L.amc55sha.dx, L.amc55sha.dy, L.amc55sha.dz]);
    });
  });
});

describe('Kaldırılan girdiye bağlı kayıtlı takoz', () => {
  // Kayıtlı proje takozu libKey ile bağlar; '-calc' girdileri artık yok. Değerler
  // düğümün kendisinde: sonuç değişmez, liste "— elle gir —", not sebebi söyler.
  test('değerler yerinde, eşleşme yok, not "girdi artık yok" der', () => {
    const d = { libKey: 'amc137963-calc', kxs: 2670, kys: 1065, kzs: 1180, kxd: 4265, kyd: 1690, kzd: 1715 };
    const n = { id: 'm1', type: 'mnt-mount', def: componentDefs['mnt-mount'], data: Object.assign({}, d) };
    global.nodes = [n];
    expect(L['amc137963-calc']).toBeUndefined();
    expect(cp._mntKutuphaneEslesme(n)).toBeNull();
    const h = document.createElement('div');
    h.innerHTML = cp._mntTakozTipGovde(n);
    const sel = h.querySelector('select[id="ve-mnt-libKey-m1"]');
    expect(sel.options[sel.selectedIndex].value).toBe('');
    expect(h.querySelector('#ve-mnt-libnot-m1').textContent).toContain('Seçili kütüphane girdisi artık yok');
    expect(n.data).toEqual(d);
  });
});
