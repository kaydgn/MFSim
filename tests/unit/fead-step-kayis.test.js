/**
 * fead-step-kayis.test.js — STEP'TE KAYIŞ 3B'DE SEÇİLİR (5.1)
 *
 * Kullanıcı isteği (2026-09-28): *"3B görüntüleyicide kayışı da seçelim."*
 * Kayış rolü ('fead-belt') verilen birim KASNAK SAYILMAZ: kodu adından
 * (8PK1410 → profil · kanal · numara), genişliği yan düzlemlerinden ölçülür,
 * kanal sayısı genişlikten sağlanır. Rol verilmezse kayışa yine DOKUNULMAZ
 * (fead-wizard-step.test.js → "KAYIŞA DOKUNULMAZ" kapıları duruyor).
 *
 * Kapılar:
 *   · KOD ADIN İÇİNDEN kesilir; klimadaki "8PK-24V", krankın "8PK"sı kod değil;
 *     iki farklı kod varsa hiçbiri seçilmez
 *   · KAYIŞ BİRİMİ kasnak adaylarına girmez; kanal genişlikten sağlanır, tutmazsa
 *     sebebiyle yazılır
 *   · AKTARIM: profil · kanal · kod boş durumun kayışına (marka varsayılan kalır);
 *     numara GİRDİ olarak yazılmaz, izi `stepKaynak.kayis`te
 *   · CAD'DEKİ KAYIŞ kartı: numara − gereken ve kolun oturduğu yer, yönüyle
 *   · TEK KAYIŞ; 3B paneli ve kartın seçicisi aynı rol listesinden
 */
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const P = require('../../js/step-p21.js');
const S = require('../../js/fead-step.js');
const U = require('../../js/step-ucgen.js');
const O = require('../helpers/step-ornek.js');
const Y = require('../helpers/step-yaz.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;
eval(loadSource('cp-accessories.js'));
global.VE_ALTERNATOR_PRESETS = VE_ALTERNATOR_PRESETS;
global.VE_AC_PRESETS = VE_AC_PRESETS;
global.VE_AIRCOMP_PRESETS = VE_AIRCOMP_PRESETS;
global.veAccInterpCurve = veAccInterpCurve;
[require('../../js/fead-duty.js'), require('../../js/fead-belts.js'), require('../../js/fead-tensioners.js'),
  require('../../js/fead-engines.js'), require('../../js/fead-accessories.js'), require('../../js/fead-checks.js'), P, S, U]
  .forEach((m) => { Object.keys(m).forEach((k) => { global[k] = m[k]; }); });
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });
const G = require('../../js/cp-fead-3b.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

const kabuk = () => {
  document.body.innerHTML = '<div id="ve-canvas"></div>'
    + '<div id="ve-feadwiz-overlay" style="display:none;">'
    + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
};
// Kullanıcının seçimi testte açık bir eşleme (program adlardan rol önermez)
const ROL = [[/GERG/, 'fead-tensioner'], [/KRANK/, 'fead-crank'], [/KL[İI]MA/, 'fead-ac'],
  [/AVARA/, 'fead-idler'], [/KAYI/, 'fead-belt']];
const dugum = (re) => wiz.veFeadWizStp().sonuc.agac.findIndex((d) => re.test(d.ad));
const oku = (metin) => { kabuk(); wiz.veFeadWizReset(); return wiz.veFeadWizStpOku(metin || O.ag00686Step(), 'AG00686.stp'); };
const hazirla = (metin, kural = ROL) => {
  oku(metin);
  kural.forEach(([re, tip]) => { const i = dugum(re); if (i >= 0) wiz.veFeadWizStpRol(i, tip); });
  return wiz.veFeadWizStpHesapla();
};
const yayGir = () => { Object.keys(O.AG_REF.yay).forEach((k) => wiz.veFeadWizTenSet(k, O.AG_REF.yay[k])); };
const duz = (h) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

describe('KOD ADIN İÇİNDEN kesilir — ikinci ayrıştırıcı yok', () => {
  test('açıklamadaki kod bulunur; klimanın "8PK-24V"si ve krankın "8PK"sı kod değil', () => {
    expect(S.veFeadStpKayisKodu(['KAYIS - 8PK1410', 'LZKG 55100000216']))
      .toEqual({ kod: '8PK1410', profile: 'PK', ribs: 8, lengthMm: 1410 });
    expect(S.veFeadStpKayisKodu(['ACE21 KLIMA KOMPRESORU-Ø137-8PK-24V'])).toBeNull();
    expect(S.veFeadStpKayisKodu(['KRANK KASNAK-Ø147\n 8PK'])).toBeNull();
    expect(S.veFeadStpKayisKodu(['1715 PK-8 kayış'])).toMatchObject({ profile: 'PK', ribs: 8, lengthMm: 1715 });
  });
  test('iki FARKLI kod varsa hiçbiri seçilmez; aynı kod iki kez yazılıysa seçilir', () => {
    expect(S.veFeadStpKayisKodu(['KAYIŞ - 8PK1475', 'yedek 6PK1200'])).toBeNull();
    expect(S.veFeadStpKayisKodu(['KAYIŞ - 8PK1475', '8PK1475'])).toMatchObject({ lengthMm: 1475 });
  });
});

describe('TANIYICI: kayış birimi kasnak değil', () => {
  test('rol verilince kod · kanal · genişlik; kasnak sayısı değişmez, kayış uyarısı yok', () => {
    const o = S.veFeadStpOku(O.ag00686Step());
    const rol = o.agac.map((d) => (ROL.find(([re]) => re.test(d.ad)) || [])[1] || null);
    const c = S.veFeadStpCoz(o, rol);
    expect(c.ok).toBe(true);
    expect(c.kasnaklar).toHaveLength(4);
    expect(c.kasnaklar.some((k) => k.tip === 'fead-belt')).toBe(false);
    // Kayışın yüzleri kasnak diye HİÇ incelenmez (gerçek dosyada kayışın yayları
    // kasnak eksenleriyle eşeksenli silindirler — aday üretir ve boşuna taranırdı)
    expect(c.birimler.find((b) => b.tip === 'fead-belt').adaylar).toEqual([]);
    expect(c.kayis).toMatchObject({ kod: '8PK1475', profil: 'PK', kanal: 8, kanalKaynak: 'kod', boy: 1475, kanalGenislikten: 8 });
    expect(c.kayis.genislik).toBeCloseTo(28.48, 6);
    expect(Math.abs(c.kayis.duzlemKacik)).toBeLessThan(1e-6);
    expect(c.uyarilar.filter((m) => /KAYIŞ/.test(m))).toEqual([]);
    // Rol verilmezse kayış hiç incelenmez
    const c2 = S.veFeadStpCoz(o, rol.map((r) => (r === 'fead-belt' ? null : r)));
    expect(c2.kayis).toBeUndefined();
  });
  test('genişlik kanal adımının katı değilse sebebi yazılır', () => {
    const o = S.veFeadStpOku(O.ag00686Step({ kayisW: 29 }));
    const c = S.veFeadStpCoz(o, o.agac.map((d) => (ROL.find(([re]) => re.test(d.ad)) || [])[1] || null));
    expect(c.kayis.kanalGenislikten).toBeNull();
    expect(c.kayis.kanal).toBe(8);                           // koddan
    expect(c.uyarilar.join(' ')).toMatch(/genişlik 29,00 mm, PK kanal adımının katı değil/);
  });
  test('adında kod yoksa: kanal GENİŞLİKTEN, profil kasnaklardan; sebep yazılır', () => {
    const metin = O.feadStep([
      { id: 'K', ad: 'KRANK KASNAK', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 6 }) }] },
      { id: 'A', ad: 'ALTERNATOR', x: 150, y: 250, geometri: [{ profil: Y.kanalliProfil({ od: 60, n: 6 }) }] },
      { id: 'B', ad: 'KAYIS', x: 0, y: 0, geometri: [{ profil: Y.duzProfil({ od: 170, w: 6 * 3.56 }) }] },
    ]);
    const o = S.veFeadStpOku(metin);
    const c = S.veFeadStpCoz(o, o.agac.map((d) => ({ 'KRANK KASNAK': 'fead-crank', ALTERNATOR: 'fead-alternator', KAYIS: 'fead-belt' })[d.ad] || null));
    expect(c.kayis).toMatchObject({ kod: null, profil: 'PK', kanal: 6, kanalKaynak: 'genislik' });
    expect(c.uyarilar.join(' ')).toMatch(/kayış kodu \(ör\. 8PK1410\) bulunamadı/);
  });
  test('kod ile genişlik ayrışırsa ikisi de yazılır', () => {
    const metin = O.feadStep([
      { id: 'K', ad: 'KRANK KASNAK', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 8 }) }] },
      { id: 'B', ad: 'KAYIŞ - 6PK1475', x: 0, y: 0, geometri: [{ profil: Y.duzProfil({ od: 170, w: 28.48 }) }] },
    ]);
    const o = S.veFeadStpOku(metin);
    const c = S.veFeadStpCoz(o, o.agac.map((d) => ({ 'KRANK KASNAK': 'fead-crank', 'KAYIŞ - 6PK1475': 'fead-belt' })[d.ad] || null));
    expect(c.kayis.kanal).toBe(6);
    expect(c.uyarilar.join(' ')).toMatch(/kodda 6 kanal, genişlik \(28,48 mm\) 8 kanal diyor/);
  });
});

describe('AKTARIM: kayış yalnız rolü verildiyse', () => {
  test('kayıt kayışı taşır; numara girdi değil, izi ayrı', () => {
    const c = hazirla();
    const k = S.veFeadStpKayit(c, {});
    expect(k.belt).toEqual({ profile: 'PK', ribs: 8, beltType: '8PK1475' });
    expect(k.belt.effLength).toBeUndefined();
    expect(k.kayisCad).toMatchObject({ kod: '8PK1475', boy: 1475, kanal: 8, genislik: 28.48 });
  });
  test('sihirbaz: profil · kanal · kod boş durumun kayışına, marka varsayılan; düğüm kodu taşır', () => {
    hazirla();
    wiz.veFeadWizStpAktar();
    const st = wiz.veFeadWizState();
    expect(st.belt).toEqual(Object.assign(wiz.veFeadWizDefault().belt, { profile: 'PK', ribs: 8, beltType: '8PK1475' }));
    expect(st.stepKaynak.kayis).toMatchObject({ kod: '8PK1475', boy: 1475 });
    const bn = wiz.veFeadWizNodes(st).nodes.find((n) => n.type === 'fead-belt');
    expect(bn.data).toMatchObject({ profile: 'PK', brand: 'GATES', ribs: 8, beltType: '8PK1475' });
    expect(bn.data.effLength).toBeUndefined();
  });
  test('TEK KAYIŞ: iki parçaya kayış rolü hesabı durdurur', () => {
    oku();
    wiz.veFeadWizStpRol(dugum(/KAYI/), 'fead-belt');
    wiz.veFeadWizStpRol(dugum(/AVARA/), 'fead-belt');
    expect(wiz.veFeadWizStpHesapla()).toBeNull();
  });
});

describe("CAD'DEKİ KAYIŞ kartı — o kayış bu düzende ne yapar", () => {
  const kayisAdimi = () => wiz.VE_FW_STEPS.findIndex((a) => a.key === 'kayis');
  const kart = () => {
    const b = wiz.veFeadWizBuild();
    const h = wiz.veFeadWizStepHTML(kayisAdimi(), b);
    const d = document.createElement('div');
    d.innerHTML = h;
    const k = d.querySelector('[data-ve="cad-kayis"]');
    return { b, h, t: k ? k.textContent.replace(/\s+/g, ' ').trim() : '' };
  };
  const hazir = () => { hazirla(); wiz.veFeadWizStpAktar(); yayGir(); };

  test('numara − gereken ve kolun yeri, gereken boyla tutarlı', () => {
    hazir();
    const { b, t } = kart();
    expect(b.ok).toBe(true);
    const fark = 1475 - b.beltLengthMm;
    expect(t).toContain('8PK1475');
    expect(t).toContain((fark < 0 ? '−' : '+') + veSayi(Math.round(Math.abs(fark) * 10) / 10, 1) + ' mm');
    expect(t).toMatch(/Bu kayışla kol/);
  });
  test('YÖN: uzun kayış kolu serbest uca, kısa kayış yük stopuna götürür', () => {
    hazir();
    const b = wiz.veFeadWizBuild();
    const st = wiz.veFeadWizState();
    st.stepKaynak.kayis.boy = Math.round(b.beltLengthMm) + 5;
    expect(kart().t).toMatch(/nominalden [\d,]+° serbest uca doğru/);
    st.stepKaynak.kayis.boy = Math.round(b.beltLengthMm) - 5;
    expect(kart().t).toMatch(/nominalden [\d,]+° yük stopuna doğru/);
    st.stepKaynak.kayis.boy = b.beltLengthMm + 200;             // gerginin erişemeyeceği boy
    expect(kart().t).toMatch(/sığmıyor — kayış uzun, kol serbest ucuna dayanır/);
  });
  test('kayış rolü verilmediyse kart YOK', () => {
    hazirla(undefined, ROL.filter(([, t]) => t !== 'fead-belt'));
    wiz.veFeadWizStpAktar();
    yayGir();
    expect(kart().h).not.toMatch(/data-ve="cad-kayis"/);
  });
});

describe('KART VE 3B AYNI rol listesinden', () => {
  test('kartın seçicisinde Kayış var; kayış satırı kod · kanal · genişlik yazar', () => {
    hazirla();
    const h = wiz.veFeadWizStepHTML(0, null);
    expect(h).toMatch(/<option value="fead-belt"[^>]*>Kayış<\/option>/);
    const i = h.indexOf('data-ve-stp="' + dugum(/KAYI/) + '"');
    expect(duz(h.slice(i, h.indexOf('</tr>', i)))).toContain('8PK1475 · 8 kanal · 28,48 mm');
  });
  test('3B paneli hesaptan sonra kayış satırını basar', () => {
    hazirla();
    const s = wiz.veFeadWizStp();
    const h = G.veFeadWiz3bPanelHTML(s, -1);
    expect(duz(h)).toContain('Kayış 8PK1475 · 8 kanal · 28,48 mm');
    expect(h).toMatch(/data-ve-3b-kayis/);
  });
});
