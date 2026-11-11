/**
 * mount-param-konum.test.js — Parametrik Analiz · KONUM TARAMASI (F007)
 * ─────────────────────────────────────────────────────────────────────────
 * Taramanın ikinci analizi: tip modeldeki gibi, grubun takozları boyuna (Δx)
 * ve düşey (Δz) kayar. Kapılar:
 *   ÇEKİRDEK — aday ızgarası sıfırdan dışa adımlanır (mevcut konum adaydır),
 *              anahtar makine biçiminde ve geri okunur, geçersiz ayar varsayılana
 *   TEK YOL  — taramanın ölçtüğü, kaydırılmış modelin Çözücü'yle çözümünün AYNISI
 *              (frekans, statik sehim, işletme sehimi); Δ 0 mevcut tasarım
 *   PENCERE  — analiz seçimi, Konum kategorisi, gruplarda z (tip sütunu yok); katalog değişmez
 *   SONUÇ    — K listesi kaymayla, seçilen K konumla ve mod ayrışmasıyla, tip ekseninin diyagramları yok; Modele uygula x · z
 *              yazar (tip alanları yerinde), tek geri-al adımı, tarama eskir
 *   RAPOR    — konum taramasının başlığı, konum aralığı, grup başına konum
 * Açı taraması bu dosyada YOK: takozun eğim açısı modelde yok (F044).
 */
const H = require('../helpers/takoz-dogrulama.js');

const { cp, rp } = H.kur();
Object.keys(cp.VE_MOUNT_LIBRARY).slice(24).forEach((k) => { delete cp.VE_MOUNT_LIBRARY[k]; });
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
Object.keys(rp).forEach((k) => { if (global[k] === undefined) global[k] = rp[k]; });
global.veMntKatalog = require('../../js/mount-katalog.js');
const P = require('../../js/cp-mount-param.js');
const RP = require('../../js/cp-mount-param-rapor.js');
Object.keys(P).forEach((k) => { if (global[k] === undefined) global[k] = P[k]; });
global.veMntParamRaporHTML = RP.veMntParamRaporHTML;
global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
global.veMntAkso = global.veMntAkso || require('../../js/mount-akso.js');
global.veMntParamCiz = require('../../js/mount-param-ciz.js');
const PS = require('../../js/cp-mount-param-sonuc.js');
Object.keys(PS).forEach((k) => { if (global[k] === undefined) global[k] = PS[k]; });
global.veIkon = global.veIkon || require('../../js/ikon.js').veIkon;
global.veDurumIkon = global.veDurumIkon || require('../../js/ikon.js').veDurumIkon;
require('../../js/mount-report-template.js');
require('../../js/mount-report-assets.js');

const K = global.veMntKatalog;
const bagil = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));
const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };

function modelKur(ad) {
  const t = H.ornek(ad);
  global.nodes = JSON.parse(JSON.stringify(t.nodes));
  global.connections = t.connections || [];
  return t;
}
// Konum taraması: Δx ∈ {−50, 0, 50}, Δz ∈ {−20, 0, 20} → 9 aday.
function dugum(ek) {
  const n = { id: 'pa', type: 'mnt-parametric', data: Object.assign({ analiz: 'konum', konum: { dxAdim: 50, dzAdim: 20 } }, ek || {}) };
  global.nodes.push(n);
  return n;
}
function taraSakla(n) {
  const Hz = P._mntParamHazirlik(n);
  const O = P._mntParamOlcucu(Hz.M, K.baglam(Hz.ctx));
  const it = K.tarayici({ G: Hz.M.G, adaylar: Hz.aday, sabit: Hz.sabit, ctx: Hz.ctx, olc1: O.olc1, olc2: O.olc2, enIyi: 25, tam: true });
  it.adim(Infinity);
  PS._mntParamSonucKaydet(n.id, Hz, O, it.depo());
  return { Hz, O, S: it.sonuc(), D: it.depo() };
}
// Kombinasyonu topolojinin KENDİ düğümlerine yazar (takozun x · z'si) ve Çözücü'yle çözer.
function kaydirCoz(topo, Hz, tipler) {
  const t = JSON.parse(JSON.stringify(topo));
  Hz.M.G.forEach((g, gi) => {
    const k = tipler[gi] && K.konumOku(tipler[gi]);
    if (!k) return;
    g.idler.forEach((id) => {
      const d = t.nodes.find((x) => x.id === id).data;
      d.x = Number(d.x) + k.dx; d.z = Number(d.z) + k.dz;
    });
  });
  return H.coz(t);
}

describe('ÇEKİRDEK — konum adayları', () => {
  test('varsayılan: Δx −50…50 adım 25, Δz −20…20 adım 10 → 25 aday; Δ 0 aday', () => {
    const A = K.konumAdaylari({});
    expect(A.ax).toEqual([-50, -25, 0, 25, 50]);
    expect(A.az).toEqual([-20, -10, 0, 10, 20]);
    expect(A.adaylar.length).toBe(25);
    expect(A.adaylar[0]).toEqual({ key: 'konum:-50:-20', dx: -50, dz: -20 });
    expect(A.adaylar.some((a) => a.dx === 0 && a.dz === 0)).toBe(true);
  });
  test('seri sıfırdan dışa: bölünmeyen aralıkta uç düşer, sıfır kalır; tek yönlü aralık', () => {
    const A = K.konumAdaylari({ dxMin: -30, dxMax: 50, dxAdim: 20, dzMin: 0, dzMax: 0, dzAdim: 5 });
    expect(A.ax).toEqual([-20, 0, 20, 40]);
    expect(A.az).toEqual([0]);
    expect(K.konumAdaylari({ dxAdim: 2.5, dxMin: -5, dxMax: 5 }).ax).toEqual([-5, -2.5, 0, 2.5, 5]);
  });
  test('geçersiz ayar varsayılana; eksen başına en çok KONUM_EKSEN_MAKS değer', () => {
    expect(K.konumAyar({ dxMin: 10, dxMax: -5, dxAdim: 0, dzAdim: -1 })).toEqual(K.KONUM_VARSAYILAN);
    expect(K.konumAdaylari({ dxMin: -1000, dxMax: 1000, dxAdim: 1 }).ax.length).toBe(K.KONUM_EKSEN_MAKS);
  });
  test('anahtar geri okunur; kütüphane anahtarı konum değil', () => {
    expect(K.konumOku(K.konumAnahtar(-12.5, 7))).toEqual({ dx: -12.5, dz: 7 });
    expect(K.konumOku('TK040')).toBeNull();
    expect(K.konumOku(null)).toBeNull();
  });
});

describe('TEK YOL — taramanın ölçtüğü, kaydırılmış modelin Çözücü çözümü', () => {
  const topo = modelKur('kamyon');
  const n = dugum();
  const { Hz, O, S, D } = taraSakla(n);

  test('kamyon: 2 grup × 9 konum = 81 kombinasyon, hepsi çözülüyor; tip modeldeki', () => {
    expect(Hz.analiz).toBe('konum');
    expect(Hz.aday.length).toBe(9);
    expect(S.N).toBe(81);
    expect(S.hata).toBe(0);
  });
  test('sıranın ilk üçü ve bir köşe: frekans, statik sehim, işletme sehimi Çözücü\'yle birebir', () => {
    const O0 = P._mntParamOlcucu(Hz.M, K.baglam(Object.assign({}, Hz.ctx, { s: { surunme: 0 } })));
    const kose = [K.konumAnahtar(-50, 20), K.konumAnahtar(50, -20)];
    S.sira.slice(0, 3).map((r) => r.tipler).concat([kose]).forEach((tipler) => {
      const o1 = O0.olc1(tipler), o2 = O0.olc2(tipler);
      const R = kaydirCoz(topo, Hz, tipler);
      expect(R && !R.error).toBe(true);
      R.modes.forEach((m, i) => expect(bagil(o1.f[i], m.f_Hz)).toBeLessThan(1e-9));
      const st = R.allCases.find((c) => c.name === 'Static');
      st.res.perMount.forEach((pm, i) => expect(Math.abs(o1.dz[i] - pm.delta[2] * 1000)).toBeLessThan(1e-9));
      const dIsl = R.mounts.map(() => 0);
      R.allCases.concat(R.gearCases, R.designCases).filter((rc) => rc.res && K.isletmeMi(rc.loadCase)).forEach((rc) => rc.res.perMount.forEach((pm, i) => {
        dIsl[i] = Math.max(dIsl[i], ...pm.delta.map((d) => Math.abs(d) * 1000));
      }));
      dIsl.forEach((d, i) => expect(Math.abs(o2.dIsl[i] - d)).toBeLessThan(1e-9));
    });
  });
  test('Δ 0 kombinasyonu mevcut tasarımın aynısı; konum frekansı ve ayrışmayı gerçekten değiştiriyor', () => {
    const sifir = Hz.M.G.map(() => K.konumAnahtar(0, 0));
    const m = O.olc1(Hz.M.G.map(() => null)), o = O.olc1(sifir);
    expect(JSON.stringify(o.f)).toBe(JSON.stringify(m.f));
    const x0 = D.indeks(sifir.map((k) => Hz.aday.findIndex((a) => a.key === k)));
    const yay = (A) => Math.max(...A) - Math.min(...A);
    const fMax = [], ked = [];
    for (let x = 0; x < D.N; x++) { fMax.push(D.fMax[x]); ked.push(D.X.ayrisma[x]); }
    expect(D.fMax[x0]).toBeCloseTo(Math.max(...m.f), 9);
    expect(yay(fMax)).toBeGreaterThan(0.05);
    expect(yay(ked)).toBeGreaterThan(0.005);
  });
});

describe('PENCERE — analiz seçimi ve Konum kategorisi', () => {
  test('katalog varsayılan; konumda Gruplar · Konum · Kriterler, gruplarda z, özet aday sayısı', () => {
    modelKur('kamyon');
    PS.veMntParamUnut();
    const k = { id: 'pk', type: 'mnt-parametric', data: {} };
    global.nodes.push(k);
    const d0 = dom(P._mntParamEskiPencereHTML(k));
    expect([...d0.querySelectorAll('.ve-fp-kat')].map((t) => t.getAttribute('aria-label'))).toEqual(['Gruplar', 'Adaylar', 'Kriterler']);
    const n = dugum();
    const d = dom(P._mntParamEskiPencereHTML(n));
    expect([...d.querySelectorAll('.ve-fp-kat')].map((t) => t.getAttribute('aria-label'))).toEqual(['Gruplar', 'Konum', 'Kriterler']);
    expect(d.querySelector('.ve-fp-side select').value).toBe('konum');
    expect([...d.querySelectorAll('.ve-fp-side input')].map((i) => i.value)).toEqual(['2', '9', '81']);
    expect([...d.querySelectorAll('.ve-fp-kat[data-k="grup"] th')].map((t) => t.textContent)).toEqual(['No', 'Grup', 'x [mm]', 'z [mm]', 'Tara']);
    const kon = d.querySelector('.ve-fp-kat[data-k="konum"]');
    expect([...kon.querySelectorAll('tbody tr')].map((r) => r.children[0].textContent)).toEqual(['Boyuna Δx', 'Düşey Δz']);
    expect([...kon.querySelectorAll('input')].map((i) => i.value)).toEqual(['-50', '50', '50', '-20', '20', '20']);
    expect(kon.querySelector('.ve-fp-sect em').textContent).toBe('9 aday');
  });
  test('ayarlar: geçersiz değer ve varsayılan alanı siler; analiz katalog alanı siler', () => {
    modelKur('kamyon');
    const n = dugum({ konum: {} });
    global.saveState = jest.fn(); global.showNodeProperties = jest.fn();
    P.veMntParamKonum('pa', 'dxMax', '80');
    P.veMntParamKonum('pa', 'dzMin', '5');                 // en az > 0 geçersiz
    P.veMntParamKonum('pa', 'dzAdim', '10');               // varsayılan
    expect(n.data.konum).toEqual({ dxMax: 80 });
    expect(global.saveState).toHaveBeenCalledTimes(3);
    P.veMntParamKonum('pa', 'dxMax', '');
    expect(n.data.konum).toBeUndefined();
    P.veMntParamAnaliz('pa', 'katalog');
    expect(n.data.analiz).toBeUndefined();
    expect(P._mntParamAnaliz(n)).toBe('katalog');
    P.veMntParamAnaliz('pa', 'konum');
    expect(n.data.analiz).toBe('konum');
  });
});

describe('SONUÇ — öneri, galeri, Modele uygula', () => {
  test('K listesi kaymayla, seçilen K grubun konumuyla ve mod ayrışmasıyla; tip ekseninin diyagramları yok', () => {
    modelKur('kamyon');
    const n = dugum();
    const { S } = taraSakla(n), ent = PS._MNT_PARAM_SONUC.pa;
    const d = dom(P._mntParamEskiPencereHTML(n)), kat = d.querySelector('.ve-fp-kat[data-k="sonuc"]');
    expect(kat).not.toBeNull();
    const k1 = kat.querySelector('.ve-prm-k[data-k="1"] .ve-prm-k-ad').textContent;
    expect(k1).toMatch(/^Δx .* mm \+ Δx .* mm$/);
    const satir = [...kat.querySelectorAll('.ve-prm-og-s .ve-prm-og-t')].map((t) => t.textContent);
    expect(satir.length).toBe(2);
    satir.forEach((s) => expect(s).toMatch(/x .* · z .* mm/));
    const etiket = [...kat.querySelectorAll('.ve-prm-og ~ .ve-fp-grid .ve-fp-l')].map((l) => l.textContent);
    expect(etiket).toEqual(['Statik sehim [mm]', 'TR [%]', 'Mod ayrışması [%]']);
    expect(PS._mntPrmGaleri(ent).map((g) => g[0])).toEqual(['d11', 'd7', 'd9']);
    expect(S.sira[0].tipler.every((k) => K.konumOku(k))).toBe(true);
  });
  test('Modele uygula: x · z = taban + kayma, tip alanları yerinde, tek geri-al adımı; tarama eskir', () => {
    modelKur('kamyon');
    const n = dugum();
    taraSakla(n);
    const ent = PS._MNT_PARAM_SONUC.pa, G = ent.M.G;
    const idx = ent.D.indeks([K.konumAnahtar(50, -20), K.konumAnahtar(-50, 20)].map((k) => ent.D.adaylar.findIndex((a) => a.key === k)));
    const tk = () => global.nodes.filter((x) => x.type === 'mnt-mount');
    const once = tk().map((x) => JSON.parse(JSON.stringify(x.data)));
    global.saveState = jest.fn(); global.showNodeProperties = jest.fn();
    expect(PS.veMntParamUygula('pa', idx)).toBe(4);
    expect(global.saveState).toHaveBeenCalledTimes(1);
    tk().forEach((m, i) => {
      const gi = G.findIndex((g) => g.idler.indexOf(m.id) >= 0), k = gi ? { dx: -50, dz: 20 } : { dx: 50, dz: -20 };
      const bek = Object.assign({}, once[i], { x: Number(once[i].x) + k.dx, z: Number(once[i].z) + k.dz });
      expect(m.data).toEqual(bek);
    });
    expect(PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n)).taze).toBe(false);
    expect(PS.veMntParamUygula('pa', idx)).toBe(0);                // eskimiş taramada uygulanmaz
  });
  test('Δ 0 öneriyse Uygula kapalı; ipucu ve Excel adı konumla', () => {
    modelKur('kamyon');
    const n = dugum();
    taraSakla(n);
    const ent = PS._MNT_PARAM_SONUC.pa;
    const x0 = ent.D.indeks(ent.M.G.map(() => ent.D.adaylar.findIndex((a) => a.dx === 0 && a.dz === 0)));
    expect(PS._mntPrmModelde(ent, x0)).toBe(true);
    expect(PS._mntParamIpucu ? PS._mntParamIpucu('pa', x0) : P._mntParamAdayAdi(ent.M, K.konumAnahtar(0, 0))).toContain('Δx 0 · Δz 0 mm');
    expect(P._mntParamMevcutAdi(ent.M, ent.M.G[0])).toBe('Δx 0 · Δz 0 mm');
    expect(P._mntParamAdayAdi(ent.M, K.konumAnahtar(-50, 20))).toBe('Δx −50 · Δz +20 mm');
  });
});

describe('RAPOR — konum taramasının belgesi', () => {
  test('başlık, konum aralığı, grup başına konum; aday tip tablosu yok', () => {
    modelKur('kamyon');
    const n = dugum();
    const { Hz } = taraSakla(n), ent = PS._MNT_PARAM_SONUC.pa;
    global.window = global.window || {};
    const E = PS._mntParamZenginlestir(ent, PS._mntParamOzet(ent, K.baglam(Hz.ctx)), Hz);
    const h = RP.veMntParamRaporHTML(E);
    expect(h).toContain('<title>Takoz konumu taraması</title>');
    expect(h).toContain('Konum aralığı (grubun bütün takozları aynı kayar, mm)');
    expect(h).toContain(': grup başına konum</caption>');
    expect(h).not.toContain('Aday tipler (statik ve dinamik rijitlik');
    expect(h).toContain('Δx ');
  });
});
