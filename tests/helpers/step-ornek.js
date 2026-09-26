/**
 * step-ornek.js — SENTETİK FEAD MONTAJLARI (STEP metni)
 *
 * 2B bir FEAD düzenini, kullanıcının 3DEXPERIENCE montajının kalıbında bir
 * STEP dosyasına yerleştirir (yazıcı: ./step-yaz.js). Üç test yüzeyi AYNI
 * dosyayı kullanıyor — tanıyıcı (tests/unit/fead-step.test.js), sihirbazın
 * aktarımı (tests/unit/fead-wizard-step.test.js) ve gerçek tarayıcı
 * (tests/e2e/fead-step.spec.js) — yani üçü aynı düzeni ölçüyor.
 *
 * Dünya: kayış düzlemi X = duzlem; 2B (x, y) → dünya (Y = Yc − x, Z = Zc + y).
 * Orijin (0,0,0) düzlemin +X tarafında → "motor arkada" → önden bakış +X.
 * `opt.motor: '-X'` motoru düzlemin öbür yanına koyar (düzlem X = +250); önden
 * bakış o zaman −X yönüne bakar ve aynı 2B düzen Y = Yc + x ile yerleşir.
 */
const Y = require('./step-yaz.js');

const D = Math.PI / 180;
const X = [1, 0, 0];

function feadStep(parcalar, opt = {}) {
  const yz = new Y.StepYaz({ uzunluk: opt.uzunluk, aci: opt.aci });
  const eksi = opt.motor === '-X';
  const duzlem = opt.duzlem !== undefined ? opt.duzlem : (eksi ? 250 : -250), Yc = 40, Zc = 390;
  const dunya = (x, y, s) => [duzlem + s, eksi ? Yc + x : Yc - x, Zc + y];
  const kok = yz.urun('ROOT', opt.kokAd || 'PROGRAMLIK TEST');
  const takilar = [];
  for (const p of parcalar) {
    const u = yz.urun(p.id, p.ad);
    const yuzler = [];
    for (const g of p.geometri) {
      const eks = Y.eksen(g.yerel || [0, 0, 0], [0, 0, 1], [1, 0, 0]);
      yuzler.push(...Y.profilYuzleri(yz, eks, g.profil));
    }
    yz.govde(u, yuzler, p.govde);
    yz.temsil(u);
    const zDunya = p.ters ? [-1, 0, 0] : X;
    const xd = p.xDunya || [0, Math.cos(p.donus || 0), Math.sin(p.donus || 0)];
    const xDunya = eksi ? [xd[0], -xd[1], xd[2]] : xd;
    takilar.push(yz.tak(kok, u, p.id + '.1', dunya(p.x, p.y, 0), zDunya, xDunya, { ters: p.rrTers }));
  }
  yz.temsil(kok);
  takilar.forEach((t) => yz.bagla(t));
  return yz.metin();
}

// Gates AG00686 (8PK1475HD, 4 kasnak) — tests/unit/fead-model.test.js ile aynı düzen
const AG = {
  crk: { od: 160, x: 0, y: 0 },
  idr: { od: 75, x: -72, y: 267 },
  ac: { od: 127, x: -224, y: 448 },
  piv: { x: -180, y: 100 }, kol: 90, aci: 75.1,
};
AG.ten = { od: 75, x: AG.piv.x + AG.kol * Math.cos(AG.aci * D), y: AG.piv.y + AG.kol * Math.sin(AG.aci * D) };

function gergiParcasi(ad, c, p, opt = {}) {
  // Yerel: avara orijinde; pivot yerel +x'te kol kadar uzakta. Yerel x, dünyada
  // avaradan pivota bakan yön olur.
  const dx = p.x - c.x, dy = p.y - c.y, L = Math.hypot(dx, dy);
  return {
    id: opt.id || 'GERGI-1', ad, x: c.x, y: c.y,
    xDunya: [0, -dx / L, dy / L],
    // pivot göbeği: her parça 6,67 mm (düz kasnak eşiği 5 mm'nin ÜSTÜNDE —
    // yani gövde de bir "kasnak adayı" ve seçimi kazanmamalı)
    geometri: [
      { profil: Y.duzProfil({ od: 75 }) },
      { profil: Y.pivotProfil({ yuzSayisi: opt.pivotYuz || 6, s0: 20, s1: 20 + 6.67 * (opt.pivotYuz || 6) }), yerel: [L, 0, 0] },
    ],
  };
}

function ag00686Step(opt = {}) {
  return feadStep([
    { id: '147KASNAK', ad: 'KRANK KASNAK-Ø160\n 8PK', x: AG.crk.x, y: AG.crk.y, govde: 'kati', donus: 0.4,
      geometri: [{ profil: Y.kanalliProfil({ od: AG.crk.od, n: 8, omuz: 163.5 }) }] },
    { id: 'AVARA-1', ad: 'AVARA KASNAK Ø75x32,5', x: AG.idr.x, y: AG.idr.y, ters: true, donus: 1.1,
      geometri: [{ profil: Y.duzProfil({ od: AG.idr.od }) }] },
    { id: 'KLIMA-1', ad: 'KLİMA KOMPRESÖRÜ-Ø127-8PK', x: AG.ac.x, y: AG.ac.y, ters: true, donus: 2.3, rrTers: true,
      geometri: [{ profil: Y.kanalliProfil({ od: AG.ac.od, n: 8, omuz: 141, tepeBol: true, kenarYanak: true, tepeR: 0.25 }) }] },
    gergiParcasi('OTOMATİK GERGİ-T38624', AG.ten, AG.piv, { pivotYuz: 9 }),
    { id: 'KAYIS', ad: 'KAYIŞ - 8PK1475', x: 0, y: 0, geometri: [{ profil: Y.duzProfil({ od: 170, w: 29 }) }] },
  ], opt);
}

// Gates raporunun AG00686 sonuçları (gergi Mean konumu, rel 33,1°) — köprü
// zincirinin kapısı. Yay künyesi STEP'te YOK; kullanıcı sihirbazın gergi
// adımında girer — testler raporun künyesini buradan alır.
const AG_REF = {
  span: { CRK: 249.2, IDR: 212.6, A_C: 248.9, TEN: 212.6 },
  wrap: { CRK: 210.2, IDR: 26.7, A_C: 202.9, TEN: 26.4 },
  relMean: 33.1,
  yay: { preload: 8.59, kArm: 0.482, meanLoad: 24.5442, loadStopRelDeg: 62.4 },
};

module.exports = { feadStep, AG, AG_REF, gergiParcasi, ag00686Step, D, X };
