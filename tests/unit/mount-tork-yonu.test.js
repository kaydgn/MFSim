/**
 * mount-tork-yonu.test.js — TORK YÖNÜ TRANSFERİN DÜZENİNDEN (F049)
 * ─────────────────────────────────────────────────────────────────────
 * Hüküm: ileri vites tork reaksiyonunun yönü (Tx = ±T_mil) elle seçilmez;
 * motorun önünün yönünden (dizilişten, _mntIleriOnerisi) ve Transfer
 * Kutusu'nun ÇIKIŞ DÖNÜŞÜNDEN (`donus`: krankla aynı · krankın tersi) türer.
 *
 *   · KURAL — motorun önü −X'te + krankla aynı → −X (T5 varsayılanı);
 *     ters → +X (Tulga'nın Adams'ı); motorun önü +X'te iki satır da çevrilir.
 *   · ÖNCELİK — transferde yazılı dönüş → projede yazılı eski torkYon
 *     (kayıtlı projenin sonucu değişmez) → dizilişin türettiği.
 *   · PENCERE — Transfer Kutusu'nun Çıkış dönüşü seçicisi ETKİN yönü
 *     gösterir (eski torkYon'lu projede de); seçim yazar.
 *   · SESSİZ HATA — Tulga'da dönüş varsayılana inerse iki tork durumu ters
 *     (Adams'tan 17,28 mm; mount-adams-tulga.test.js deftere yazar), burada
 *     yük kitabının işareti kilitli.
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

const ornek = (ad) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples', ad + '_topoloji.json'), 'utf8'));
function kur(t) {
  global.nodes = t.nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  global.connections = t.connections || [];
  global.veUpdateResultsTree = jest.fn();
  return global.nodes;
}
const cozucu = () => global.nodes.find((n) => n.type === 'mnt-solver');
const govde = (tip) => global.nodes.find((n) => n.type === tip);
const torkTx = () => {
  const g = cp._mntGatherForSolver(cozucu());
  const T = cp._mntYukDurumlari(g).filter((c) => /Torque/.test(c.name));
  return T.map((c) => Math.sign(c.T[0]));
};
beforeEach(() => { resetStubs(stubs); });

describe('KURAL — motorun önü × transferin dönüşü', () => {
  const L = (mx, don) => [
    { type: 'mnt-motor', data: { cgx: mx } },
    { type: 'mnt-gearbox', data: { cgx: 800 } },
    { type: 'mnt-transfer', data: don ? { cgx: 1400, donus: don } : { cgx: 1400 } }];
  test.each([
    [100, undefined, '-x'], [100, 'ayni', '-x'], [100, 'ters', '+x'],
    [2000, undefined, '+x'], [2000, 'ayni', '+x'], [2000, 'ters', '-x'],
  ])('motor X=%p, dönüş %p → %p', (mx, don, beklenen) => {
    expect(cp._mntTorkOnerisi(L(mx, don)).torkYon).toBe(beklenen);
  });
  test('diziliş yoksa −X, transfer tersse +X', () => {
    expect(cp._mntTorkOnerisi([]).torkYon).toBe('-x');
    expect(cp._mntTorkOnerisi([{ type: 'mnt-transfer', data: { donus: 'ters' } }]).torkYon).toBe('+x');
    expect(cp._mntTorkOnerisi([{ type: 'mnt-transfer', data: { donus: 'yan' } }]).yazili).toBe(false);
  });
});

describe('ÖNCELİK — yazılı dönüş · eski torkYon · türetilen', () => {
  test('Tulga: transfer ters → +X; dönüş silinince −X (iki tork durumu ters)', () => {
    kur(ornek('tulga'));
    expect(torkTx()).toEqual([1, -1]);                              // ileri +, geri −
    expect(cp._mntGatherForSolver(cozucu()).torkKaynak).toBe('transfer');
    delete govde('mnt-transfer').data.donus;
    expect(torkTx()).toEqual([-1, 1]);
    expect(cp._mntGatherForSolver(cozucu()).torkKaynak).toBe('dizilis');
  });
  test('eski proje: Çözücü\'de yazılı torkYon dönüş yazılı değilken korunur, yazılı dönüş onun önüne geçer', () => {
    kur(ornek('tulga'));
    delete govde('mnt-transfer').data.donus;
    cozucu().data.torkYon = '+x';
    expect(torkTx()).toEqual([1, -1]);
    expect(cp._mntGatherForSolver(cozucu()).torkKaynak).toBe('proje');
    govde('mnt-transfer').data.donus = 'ayni';
    expect(torkTx()).toEqual([-1, 1]);
  });
  test('öteki örneklerin hepsinde yön eskisiyle aynı (−X): kayıtlı sonuç değişmez', () => {
    ['asfat', 'hafif', 'kamyon', 'siper', 'tta10', 'kutu'].forEach((ad) => {
      kur(ornek(ad));
      const cz = cozucu(); if (!cz) return;
      expect(`${ad} ${cp._mntGatherForSolver(cz).yon.torkYon}`).toBe(`${ad} -x`);
    });
  });
  test('imza dönüşü taşır: dönüş değişince sonuç bayatlar', () => {
    kur(ornek('tulga'));
    global._veMntLast = cp._mntComputeResults(cozucu().id);
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
    govde('mnt-transfer').data.donus = 'ayni';
    expect(cp.veMntSonucDurumu().durum).toBe('bayat');
  });
});

describe('PENCERE — Çıkış dönüşü', () => {
  const sec = (n) => {
    document.body.innerHTML = cp._mntTransferSection(n);
    return document.getElementById('ve-mnt-donus-' + n.id);
  };
  test('seçici etkin dönüşü gösterir; seçim yazar', () => {
    kur(ornek('tulga'));
    const t = govde('mnt-transfer');
    expect(sec(t).value).toBe('ters');
    cp.veMntSetDonus(t.id, 'ayni');
    expect(t.data.donus).toBe('ayni');
    expect(global.saveState).toHaveBeenCalled();
    cp.veMntSetDonus(t.id, 'yan');
    expect(t.data.donus).toBe('ayni');
  });
  test('eski torkYon\'lu projede seçici o yönü veren dönüşü gösterir', () => {
    kur(ornek('tulga'));
    const t = govde('mnt-transfer');
    delete t.data.donus;
    expect(sec(t).value).toBe('ayni');
    cozucu().data.torkYon = '+x';
    expect(sec(t).value).toBe('ters');
  });
  test('rapor yönün kaynağını söyler', () => {
    kur(ornek('tulga'));
    const R = cp._mntComputeResults(cozucu().id);
    expect(rep._mntRepYonCumle(R)).toContain('tork momenti +X (motorun önü yönünde; Transfer Kutusu’nun çıkışı krankın tersi yönde döner)');
  });
});
