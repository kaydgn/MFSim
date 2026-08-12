/**
 * arac-example-data.test.js
 * ─────────────────────────
 * ÖRNEK GİRDİLERİNİN iSCAAN RAPORLARIYLA DOĞRULANMIŞ DEĞERLERİ.
 *
 * `arac-example-calibration.test.js` örneklerin ÇIKTISINI (stall, tavan hız,
 * hızlanma) koruyor. Bu dosya GİRDİLERİNİ koruyor — kütle, alan, Cd, aks,
 * Crr, vites oranları, transfer kademeleri, governed devir, aksesuar kayıpları
 * ve pumpTorqueDrop.
 *
 * NEDEN AYRI BİR KAPI: pumpTorqueDrop hatası (ypa4x4'te 21.4 olması gerekirken
 * 69.8) hiçbir yapısal testi kırmıyordu ve simülasyon "makul ama yanlış" sonuç
 * üretiyordu. Ancak on üç örneğin HEPSİNE aynı türetmeyi uygulayınca ortaya
 * çıktı. Aşağıdaki değerler o sistematik denetimin çıktısıdır — 262 kontrol,
 * sıfır sapma. Elle bir örnek JSON'u düzenleyen biri artık sessizce
 * kaydıramaz.
 *
 * Değerlerin kaynağı (rapor bölümü):
 *   gvw       Input Summary / "Gross Vehicle Weight"
 *   alan      Input Summary / "Frontal Area"  (örnekte ftHeight × ftWidth)
 *   cd        Input Summary / "User Defined Wind Resistance Coefficient"
 *   aks, aux  Bölüm başlıkları: "... Axle Ratio = X, Aux Ratio = Y ..."
 *   crr       "Vehicle Wheel Power Requirements" tablosunun %0.00 eğim sütunu
 *             en küçük karelerle: P(v) = [Crr·f(v)·m·g + ½ρ·Cd·A·v²]·v
 *             f(v) MFSim'in hız düzeltmesi (getCrrEffective) — bu ÇARPAN
 *             hesaba katılmazsa Crr %25-45 yüksek çıkar ve sahte alarm verir.
 *   vites     "Gear F<n> (Ratio = …)" başlıkları
 *   governed  Input Summary / "Governed Speed"
 *   acc       "Accessory Losses (Power @ Governed Speed)" — User Defined sütunu
 *             sıra: fan, alternatör, kompresör, direksiyon pompası
 *   drop      [motor eğrisinin doğrusal net-fan-on değeri @stall] − T_türbin/τ
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const ISCAAN = {
  turan:             { gvw: 13060, alan: 6.111, cd: 0.75, aks: 5.904, crr: 0.00357, governed: 2800,
                       vites: [3.487, 1.864, 1.409, 1.000, 0.750, 0.652],
                       aux: [1.257, 2.337], acc: [20.2, 2.5, 1.3, 1.3], drop: 18.1 },
  tta2:              { gvw: 21100, alan: 9.000, cd: 0.75, aks: 6.540, crr: 0.00416, governed: 2100,
                       vites: [3.487, 1.864, 1.409, 1.000, 0.750, 0.653],
                       aux: [1.054, 2.337], acc: [22.4, 2.8, 1.4, 1.4], drop: 16.6 },
  isb340_tc411:      { gvw: 13150, alan: 6.111, cd: 0.75, aks: 5.833, crr: 0.00356, governed: 2800,
                       vites: [3.487, 1.864, 1.409, 1.000, 0.750, 0.652],
                       aux: [1.090, 2.470], acc: [20.2, 2.5, 1.3, 1.3], drop: 19.4 },
  isb340_tc413:      { gvw: 13150, alan: 6.111, cd: 0.75, aks: 5.833, crr: 0.00356, governed: 2800,
                       vites: [3.487, 1.864, 1.409, 1.000, 0.750, 0.652],
                       aux: [1.090, 2.470], acc: [20.2, 2.5, 1.3, 1.3], drop: 18.1 },
  isg430_4000sp:     { gvw: 30000, alan: 7.020, cd: 0.75, aks: 8.337, crr: 0.00422, governed: 1900,
                       vites: [3.510, 1.906, 1.429, 1.000, 0.737, 0.639],
                       aux: [0.874, 1.536], acc: [28.5, 3.1, 1.6, 1.6], drop: 30.8 },
  bmc10ton_380_32t:  { gvw: 32000, alan: 7.020, cd: 0.75, aks: 8.337, crr: 0.00422, governed: 1900,
                       vites: [4.695, 2.213, 1.529, 1.000, 0.765, 0.672],
                       aux: [0.874, 1.536], acc: [35.6, 2.8, 1.6, 1.6], drop: 32.2 },
  bmc10ton_380_30t:  { gvw: 30000, alan: 7.020, cd: 0.75, aks: 8.337, crr: 0.00422, governed: 1900,
                       vites: [4.695, 2.213, 1.529, 1.000, 0.765, 0.672],
                       aux: [0.874, 1.536], acc: [35.6, 2.8, 1.6, 1.6], drop: 32.2 },
  bmc10ton_400:      { gvw: 32000, alan: 7.020, cd: 0.75, aks: 8.337, crr: 0.00422, governed: 1900,
                       vites: [4.695, 2.213, 1.529, 1.000, 0.765, 0.672],
                       aux: [0.874, 1.536], acc: [37.5, 3.0, 1.7, 1.7], drop: 32.3 },
  bmc10ton_430_30t:  { gvw: 30000, alan: 7.020, cd: 0.75, aks: 8.337, crr: 0.00422, governed: 1900,
                       vites: [4.695, 2.213, 1.529, 1.000, 0.765, 0.672],
                       aux: [0.874, 1.536], acc: [40.2, 3.2, 1.8, 1.8], drop: 32.4 },
  bmc10ton_430_32t:  { gvw: 32000, alan: 7.020, cd: 0.75, aks: 8.337, crr: 0.00422, governed: 1900,
                       vites: [4.695, 2.213, 1.529, 1.000, 0.765, 0.672],
                       aux: [0.874, 1.536], acc: [40.2, 3.2, 1.8, 1.8], drop: 32.4 },
  bmc10ton_460:      { gvw: 32000, alan: 7.020, cd: 0.75, aks: 8.337, crr: 0.00422, governed: 1900,
                       vites: [4.695, 2.213, 1.529, 1.000, 0.765, 0.672],
                       aux: [0.874, 1.536], acc: [30.9, 3.4, 1.7, 1.7], drop: 32.7 },
  duramax:           { gvw: 11500, alan: 6.111, cd: 0.75, aks: 7.370, crr: 0.00356, governed: 3000,
                       vites: [3.487, 1.864, 1.409, 1.000, 0.750, 0.652],
                       aux: [1.000, 2.470], acc: [34.5, 3.5, 1.8, 1.8], drop: 14.4 },
  ypa4x4:            { gvw: 7650, alan: 5.750, cd: 0.75, aks: 1.706, crr: 0.00321, governed: 2500,
                       vites: [4.822, 3.512, 2.852, 1.896, 1.439, 1.000, 0.736, 0.643, 0.568],
                       aux: [3.430], acc: [16.1, 1.6, 0.8, 0.8], drop: 69.8 },
};

/**
 * KONVERTÖR EĞRİSİ PARMAK İZİ — tcData'nın rapordan alındığını sabitler.
 *
 * bmc10ton_400'de eğrinin ÜÇ noktası (sr 0.888/0.891/0.895) raporda yoktu;
 * yerlerine gerçek noktalar (0.866/0.882/0.884) alınmamıştı. Uydurulan üç
 * nokta gerçek eğrinin üzerinde durduğu için sonucu ölçülebilir biçimde
 * değiştirmiyordu (stall ve tavan hız aynı, 0-20 %0.3) — yani hiçbir davranış
 * testi yakalayamazdı. Satır SAYISI da aynı olduğu için basit bir uzunluk
 * kontrolü de kaçırırdı.
 *
 * Bu yüzden ızgaranın kendisi parmak iziyle sabitleniyor: satır sayısı ve
 * sr/τ/K sütun toplamları. Tek bir noktanın değişmesi toplamı kaydırır.
 * (jmma ve bmc4x4_25t kaynak raporları yalnız "Input Summary"; konvertör
 * eğrileri aynı donanımı kullanan raporlardan alındı — bkz. örnek uyarıları.)
 */
const TC_IZ = {
  bmc10ton_380_30t:  { n: 23, sr: 15.291, tau: 28.010, k: 1225.55 },
  bmc10ton_380_32t:  { n: 23, sr: 15.291, tau: 28.010, k: 1225.55 },
  bmc10ton_400:      { n: 23, sr: 15.249, tau: 28.031, k: 1219.94 },
  bmc10ton_430_30t:  { n: 23, sr: 15.191, tau: 28.105, k: 1215.97 },
  bmc10ton_430_32t:  { n: 23, sr: 15.191, tau: 28.105, k: 1215.97 },
  bmc10ton_460:      { n: 23, sr: 14.834, tau: 28.519, k: 1227.12 },
  bmc4x4_25t:        { n: 23, sr: 14.844, tau: 28.745, k: 1731.83 },
  duramax:           { n: 24, sr: 15.899, tau: 32.034, k: 2431.18 },
  isb340_tc411:      { n: 23, sr: 15.038, tau: 31.699, k: 2832.29 },
  isb340_tc413:      { n: 23, sr: 14.892, tau: 31.355, k: 2354.16 },
  isg430_4000sp:     { n: 22, sr: 14.761, tau: 25.509, k: 940.44 },
  jmma:              { n: 23, sr: 14.892, tau: 31.355, k: 2354.16 },
  tta2:              { n: 23, sr: 14.844, tau: 28.745, k: 1731.83 },
  turan:             { n: 23, sr: 14.892, tau: 31.355, k: 2354.16 },
  ypa4x4:            { n: 23, sr: 15.389, tau: 27.987, k: 2461.98 },
};

const IDS = Object.keys(ISCAAN);
const topo = {};
beforeAll(() => {
  IDS.forEach(id => {
    topo[id] = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'assets', 'examples', `ap_${id}_topoloji.json`), 'utf8'));
  });
});

const bul = (id, tip, bayrak) => {
  const ns = topo[id].nodes.filter(n => n.type === tip);
  return (bayrak && ns.find(n => n[bayrak])) || ns[0];
};

describe('araç ve yol yükü', () => {
  test.each(IDS)('%s', id => {
    const r = ISCAAN[id];
    const v = bul(id, 'vehicle').data;
    const w = bul(id, 'wheel', 'isMasterWheel').data;
    expect(parseFloat(v.ftGVW)).toBe(r.gvw);
    expect(parseFloat(v.ftHeight) * parseFloat(v.ftWidth)).toBeCloseTo(r.alan, 2);
    expect(parseFloat(v.ftCd)).toBeCloseTo(r.cd, 3);
    // Crr toleransı 4e-4: rapordan en küçük karelerle türetiliyor, tablo
    // çözünürlüğü (0.1 kW) bu mertebede belirsizlik bırakıyor.
    expect(Math.abs(parseFloat(w.ftCrr) - r.crr)).toBeLessThan(0.0004);
  });
});

describe('güç aktarma oranları', () => {
  test.each(IDS)('%s — aks, vitesler, transfer kademeleri', id => {
    const r = ISCAAN[id];
    expect(parseFloat(bul(id, 'differential', 'isMasterDiff').data.diffRatio)).toBeCloseTo(r.aks, 3);

    const ileri = bul(id, 'gearbox').data.ftGearData
      .filter(g => String(g.name || '').toUpperCase().charAt(0) !== 'R');
    expect(ileri.length).toBe(r.vites.length);
    ileri.forEach((g, i) => expect(parseFloat(g.ratio)).toBeCloseTo(r.vites[i], 3));

    const kad = bul(id, 'transfer').data.ftTrGears.map(g => parseFloat(g.ratio)).sort((a, b) => a - b);
    expect(kad.length).toBe(r.aux.length);
    kad.forEach((x, i) => expect(x).toBeCloseTo(r.aux[i], 3));
  });
});

describe('motor ve aksesuarlar', () => {
  test.each(IDS)('%s', id => {
    const r = ISCAAN[id];
    const e = bul(id, 'engine').data;
    expect(parseFloat(e.motorSpecs.governedSpeed)).toBe(r.governed);
    // Motor eğrisi BRÜT girilmeli — MFSim aksesuarı kendi düşüyor. Brüt eğri
    // net'ten her zaman yüksektir; governed civarındaki değer net eğriye
    // düşerse çift düşüm olur ve stall sessizce kayar.
    expect(e.torqueData.length).toBeGreaterThan(8);
    const sirali = e.torqueData.slice().sort((a, b) => a.rpm - b.rpm);
    expect(sirali[0].rpm).toBeLessThan(1100);

    const beklenen = ['fan', 'alternat', 'kompres', 'direksiyon'];
    beklenen.forEach((anahtar, i) => {
      const a = (e.accessories || []).find(x => (x.name || '').toLowerCase().includes(anahtar));
      expect(a).toBeTruthy();
      expect(parseFloat(a.userLoss)).toBeCloseTo(r.acc[i], 1);
    });
  });
});

describe('konvertör pompa tork düşürmesi', () => {
  // ypa4x4 tam burada yanlıştı (21.4 yerine 69.8 olmalıydı) ve hiçbir yapısal
  // test kırılmıyordu — stall %3.1 sapıyor ama sonuç "makul" görünüyordu.
  test.each(IDS)('%s', id => {
    expect(parseFloat(bul(id, 'torque-converter').data.pumpTorqueDrop))
      .toBeCloseTo(ISCAAN[id].drop, 1);
  });

  test('ypa4x4 düzeltmesi geri alınmasın — 69.8, eski yanlış değer 21.4 değil', () => {
    expect(parseFloat(bul('ypa4x4', 'torque-converter').data.pumpTorqueDrop)).toBeGreaterThan(60);
  });
});

describe('konvertör eğrisi rapordan alınmış olarak kalsın', () => {
  const TC_IDS = Object.keys(TC_IZ);

  test.each(TC_IDS)('%s — parmak izi tutuyor', id => {
    const j = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'assets', 'examples', `ap_${id}_topoloji.json`), 'utf8'));
    const tc = j.nodes.find(n => n.type === 'torque-converter').data.tcData;
    const iz = TC_IZ[id];
    expect(tc.length).toBe(iz.n);
    const top = f => tc.reduce((a, p) => a + parseFloat(p[f]), 0);
    expect(top('sr')).toBeCloseTo(iz.sr, 2);
    expect(top('tau')).toBeCloseTo(iz.tau, 2);
    expect(top('kpump')).toBeCloseTo(iz.k, 1);
  });

  test.each(TC_IDS)('%s — sr KESİN ARTAN (pchipCreate şartı)', id => {
    const j = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'assets', 'examples', `ap_${id}_topoloji.json`), 'utf8'));
    const sr = j.nodes.find(n => n.type === 'torque-converter').data.tcData.map(p => parseFloat(p.sr));
    for (let i = 1; i < sr.length; i++) expect(sr[i]).toBeGreaterThan(sr[i - 1]);
  });
});
