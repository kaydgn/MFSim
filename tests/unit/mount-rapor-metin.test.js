/**
 * mount-rapor-metin.test.js — ARAYÜZ ANLATMAZ, Takoz raporu (aşama 11)
 * ───────────────────────────────────────────────────────────────────────
 * Belge mühendislik içeriği taşır: yöntem, varsayım, kaynak, kabul ölçütü,
 * geçerlilik sınırı. Cırcır sözlüğün işaretlediğini tutar (iki belgede de
 * işaretli metin kalmadı); bu dosya sözlüğün görmediği sınıfları tutar:
 *   · yazılım anlatısı ("modelden otomatik üretilmiştir", "iç topolojiden
 *     otomatik toplanır") — teori şablonunun alt bilgisi dâhil
 *   · okuma tarifi ve okuyucuya iş ("ayrıntı için aşağıdaki adımlar",
 *     "yeniden okunmalıdır", "karşılaştırma buradan yapılmalıdır",
 *     "… kinematiğini doldurun")
 *   · hükmün arkasına eklenen öneri ("rijitliği düşürmek önerilir",
 *     "yerleşim gözden geçirilmelidir")
 *   · sayıdan bağımsız doğrulama iddiası: §8.13 "kestirim tam çözüme çok
 *     yakındır; … bu model için geçerli olduğunu doğrular" cümlesini fark ne
 *     çıkarsa çıksın basıyordu
 *   · bayat tarif: §8.7 mod matrisini "renk yoğunluğuyla (koyu = baskın)"
 *     anlatıyordu; tablo çubukla çiziliyor
 *   · büyük harfle vurgu (DEĞİL, KULLANILIR, TAMAMINI, AYNI)
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
function dizgeler(dosya) {
  const ast = parser.parse(oku(dosya), { sourceType: 'script', errorRecovery: true });
  const out = [];
  (function yuru(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'StringLiteral') out.push({ satir: n.loc.start.line, metin: n.value });
    for (const k in n) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(yuru); else if (v && typeof v.type === 'string') yuru(v);
    }
  })(ast.program);
  return out;
}

const BELGE = ['js/cp-mount-report.js', 'js/cp-mount-param-rapor.js'];

// Yazılım anlatısı, okuma tarifi ve hükme eklenen öneri belgeye girmez.
const YASAK = /(?<![\p{L}-])(otomatik (?:üretil|toplan)\p{L}*|iç topoloji\p{L}*|yazılım\p{L}*|ölçüldü|kapı\p{L}*|okuyucu\p{L}*|okuyunuz|bakınız|bkz\.|aşağıda\p{L}*|yukarıda\p{L}*|inceleyin|gözden geçir\p{L}*|önerilir|doldurun|girin|okunmalı\p{L}*|yapılmalı\p{L}*|tekrarlanmalı\p{L}*|değerlendirilmeli\p{L}*|doğrulanmalı\p{L}*|karşılaştırılmalı\p{L}*|geçerli olduğunu doğrular)(?![\p{L}])/u;

describe('Takoz belgeleri yazılımı anlatmaz, tarif ve öneri taşımaz', () => {
  test.each(BELGE)('%s', (f) => {
    const sapan = dizgeler(f).filter((d) => YASAK.test(d.metin)).map((d) => f + ':' + d.satir + ' ' + d.metin.slice(0, 120));
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor: eski metinler yakalanır', () => {
    ['projede tanımlı modelden otomatik üretilmiştir', 'Tüm kütle ve takozlar iç topolojiden otomatik toplanır',
     'ayrıntı için aşağıdaki adımlar ve yük durumu matrisi.', 'Seçim kesinleşmeden §8.5, §8.6 ve §8.10 yeniden okunmalıdır.',
     'karşılaştırma buradan yapılmalıdır.', 'Motor/Şanzıman kinematiğini doldurun',
     'takoz dinamik rijitliklerini düşürmek (mod bandını aşağı taşımak) önerilir.', 'yerleşim gözden geçirilmelidir',
     'bu, §8.8 değerlendirmesinin bu model için geçerli olduğunu doğrular.', '(serbest mod — bkz. §8.7)']
      .forEach((m) => expect(YASAK.test(m)).toBe(true));
    // Geçerlilik sınırı ve yöntem cümlesi yasak değil
    expect(YASAK.test('Rezonans civarında tek-serbestlik kestirimi geçerli değildir.')).toBe(false);
    expect(YASAK.test('Son eşitlik bağımsız bir doğrulamadır')).toBe(false);
    expect(YASAK.test('önden-soldan-yukarıdan')).toBe(false);   // görünüş yönü, kendini anlatma değil
  });

  test('§8.7 mod matrisini bayat tarifle anlatmaz (tablo çubukla çiziliyor)', () => {
    const src = oku('js/cp-mount-report.js');
    expect(src).not.toMatch(/renk yoğunluğu/);
    expect(src).toMatch(/çubuk = merkezden katılım/);
  });
});

// Büyük harfle vurgu: kısaltma ve özel ad dışında tümü büyük sözcük yok.
const BUYUK = /(?<![\p{L}\p{N}_@])([A-ZÇĞİÖŞÜ]{4,})(?![\p{L}\p{N}_@])/gu;
const AD = new Set(['CATIA', 'IJIRSET', 'OJAV', 'LORD']);
describe('Takoz belgelerinde büyük harfle vurgu yok', () => {
  test.each(BELGE)('%s', (f) => {
    const sapan = [];
    dizgeler(f).forEach((d) => {
      for (const m of d.metin.matchAll(BUYUK)) if (!AD.has(m[1])) sapan.push(f + ':' + d.satir + ' ' + m[1]);
    });
    expect(sapan).toEqual([]);
  });
});

describe('§8.13 kestirimin farkı SAYIYLA söylenir', () => {
  const core = require('../../js/mount-core.js');
  global.veMountCore = core;
  const rep = require('../../js/cp-mount-report.js');
  const mm = (v) => v / 1000, kN = (v) => v * 1000;
  const MP = core.combineMassProps([
    { name: 'Motor', mass: 1600, cg: [-314.94, -0.127, 857.56].map(mm), I: [[110.7, 0, 0], [0, 260.2, 0], [0, 0, 205.9]], pointMass: false },
    { name: 'Şanzıman', mass: 839, cg: [932.365, -13.003, 700.632].map(mm), I: [[44.6, 0, 0], [0, 97.8, 0], [0, 0, 94.6]], pointMass: false }]);
  const K = { s: [1045, 1045, 1800], d: [1045, 1045, 1800] };
  const MOUNTS = [['Ön Sol', -953.45, -50.67, 367], ['Ön Sağ', -953.45, 50.67, 367],
    ['Sol Arka', 636.8, -347.1, 615.77], ['Sağ Arka', 636.8, 347.1, 615.77]]
    .map((h) => ({ name: h[0], pos: [h[1], h[2], h[3]].map(mm), kstat: K.s.map(kN), kdyn: K.d.map(kN) }));
  const STAT = core.solveCase(core.buildK(MOUNTS, MP.cg, false), MOUNTS, MP.cg, MP.m, 9.81,
    { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
  const R = { zeta: 0.02, mp: MP, mounts: MOUNTS, damping: core.mountDamping(MOUNTS, core.mountLoadShares(STAT, 9.81), 0.02),
    gather: { torque: { idleRpm: 600, cylinders: 6 }, components: [] },
    modes: [{ f_Hz: 11.3, phi: [0, 0, 1, 0, 0, 0], label: 'bounce' }] };

  test('fark yazılır; "çok yakındır / doğrular" iddiası basılmaz', () => {
    const h = rep._mntRepFRF(R, {});
    expect(h).toMatch(/Kestirimin tam çözümden farkı: %[0-9]/);
    expect(h).toContain('Rezonans civarında tek-serbestlik kestirimi geçerli değildir.');
    expect(h).not.toMatch(/çok yakındır|doğrular/);
  });
});

describe('teori şablonu yazılımı anlatmaz', () => {
  // FEAD kapısıyla AYNI ölçüt (tests/helpers/teori-sablon.js): şablon taban64
  // gömülü, cırcır görmüyor.
  const TS = require('../helpers/teori-sablon.js');
  test('düz metin: yazılım davranışı, geçmiş, test ölçümü, okuyucuya iş yok; büyük harf vurgusu yok', () => {
    const h = TS.sablon('js/mount-report-template.js', 'MNT_REPORT_TEMPLATE_B64');
    expect(TS.yasakBulgulari(h)).toEqual([]);
    expect(TS.buyukHarfBulgulari(h, [])).toEqual([]);
  });

  test('alt bilgi ve §1 özeti: "otomatik üretilmiştir" ve "harici referans yerine" yok', () => {
    global.window = global.window || {};
    require('../../js/mount-report-template.js');
    const h = Buffer.from(window.MNT_REPORT_TEMPLATE_B64, 'base64').toString('utf8');
    expect(h).not.toMatch(/otomatik üretil/);
    expect(h).not.toMatch(/Harici bir referans/);
    expect(h).not.toMatch(/bileşen ve takoz tanımlarından alınır/);
    expect(h).toContain('model içi tutarlılık kontrolleriyle denetlenir');
  });
});
