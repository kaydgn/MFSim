/**
 * matching-selection.test.js — "hangi şanzıman / konvertör seçili?" çözümü
 *
 * KULLANICI ŞİKÂYETİ (2026-08-13): "Motor-Konvertör ve Motor-Şanzıman
 * eşleşme modüllerinde, şanzıman ve konvertör önceden seçilmişse bu
 * modüllerin içinde belirtilmiyor — normalde bir tik işareti ile belirtilir."
 *
 * KÖK NEDEN: iki modül de düğümün DATA'sındaki preset ANAHTARINA bakıyordu
 * (ftGBPreset / tcPresetKey). Örnek topolojiler (assets/examples/ap_*.json)
 * ve onlardan türeyen kayıtlar o anahtarı HİÇ taşımıyordu — yalnız sayılar
 * (vites oranları, K/τ eğrisi) vardı. Sonuç: hiçbir satır işaretlenmiyordu.
 *
 * İki taraflı düzeltme:
 *   1) Örnek dosyalara doğru anahtar yazıldı (bu dosyadaki bütünlük kapısı).
 *   2) Anahtar yoksa SAYILARDAN çözen tek bir fonksiyon eklendi
 *      (veResolveGearboxPresetKey / veResolveTCPresetKey) — elle kurulmuş ve
 *      eski kayıtlar da işaretlenir.
 */

const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
eval(loadSource('cp-gearbox.js'));
eval(loadSource('cp-torque-converter.js'));

const gbNode = (data) => ({ id: 'g1', type: 'gearbox', data: data });
const tcNode = (data) => ({ id: 't1', type: 'torque-converter', data: data });

describe('veResolveGearboxPresetKey', () => {
  test('açıkça yazılmış anahtar aynen döner', () => {
    expect(veResolveGearboxPresetKey(gbNode({ ftGBPreset: '4500SP' }))).toBe('4500SP');
    expect(veResolveGearboxPresetKey(gbNode({ selectedGearbox: '4000SP' }))).toBe('4000SP');
  });

  test('büyük/küçük harf farkı tolere edilir', () => {
    expect(veResolveGearboxPresetKey(gbNode({ ftGBPreset: '4500sp' }))).toBe('4500SP');
  });

  test('ada göre çözer', () => {
    expect(veResolveGearboxPresetKey(gbNode({ gbName: VE_GEARBOX_PRESETS['4000SP'].name }))).toBe('4000SP');
  });

  test('anahtar yoksa vites oranlarından çözer (tek aday)', () => {
    const gears = VE_GEARBOX_PRESETS['4500SP'].gears
      .filter(g => g.gear !== 'R').map(g => ({ name: g.gear, ratio: g.ratio }));
    expect(veResolveGearboxPresetKey(gbNode({ ftGearData: gears }))).toBe('4500SP');
  });

  // 3000SP ve 3200SP AYNI oranlara sahip → oranlardan ayırt edilemez.
  // Yanlış şanzımana "seçili" demektense işaretsiz bırakılır.
  test('oranlar birden çok presete uyuyorsa boş döner (tahmin yok)', () => {
    const gears = VE_GEARBOX_PRESETS['3000SP'].gears
      .filter(g => g.gear !== 'R').map(g => ({ name: g.gear, ratio: g.ratio }));
    expect(veResolveGearboxPresetKey(gbNode({ ftGearData: gears }))).toBe('');
    // ama anahtar yazılıysa belirsizlik kalmaz
    expect(veResolveGearboxPresetKey(gbNode({ ftGearData: gears, ftGBPreset: '3000SP' }))).toBe('3000SP');
  });

  test('rapordan gelen 3 haneli oranlar 2 haneli presete oturur (%1 tolerans)', () => {
    // TURAN: 3.487 / 1.864 / 1.409 / 1 / 0.75 / 0.652 ↔ preset 3.49 / 1.86 / …
    const gears = [3.487, 1.864, 1.409, 1, 0.75, 0.652].map((r, i) => ({ name: String(i + 1), ratio: r }));
    const pre = VE_GEARBOX_PRESETS['3000SP'].gears.filter(g => g.gear !== 'R').map(g => +g.ratio);
    expect(veGearRatiosMatch(gears.map(g => g.ratio), pre)).toBe(true);
  });

  test('veri yoksa boş döner, çökmez', () => {
    expect(veResolveGearboxPresetKey(null)).toBe('');
    expect(veResolveGearboxPresetKey(gbNode({}))).toBe('');
    expect(veResolveGearboxPresetKey(gbNode({ ftGearData: [] }))).toBe('');
  });
});

describe('veResolveTCPresetKey', () => {
  test('açıkça yazılmış anahtar aynen döner', () => {
    expect(veResolveTCPresetKey(tcNode({ tcPresetKey: 'tc413' }))).toBe('tc413');
  });

  test('büyük/küçük harf farkı tolere edilir', () => {
    expect(veResolveTCPresetKey(tcNode({ tcPresetKey: 'TC413' }))).toBe('tc413');
  });

  test('"manual" seçim preset değildir', () => {
    expect(veResolveTCPresetKey(tcNode({ tcPresetKey: 'manual' }))).toBe('');
  });

  test('ada göre çözer', () => {
    expect(veResolveTCPresetKey(tcNode({ tcName: VE_FT_TC_PRESETS.tc551.name }))).toBe('tc551');
  });

  test('anahtar yoksa K/τ eğrisinden çözer', () => {
    expect(veResolveTCPresetKey(tcNode({ tcData: VE_FT_TC_PRESETS.tc421.data }))).toBe('tc421');
  });

  // Örnekler iSCAAN raporlarından DAHA SIK örneklenmiş (23 nokta ↔ preset 18);
  // nokta-nokta karşılaştırma bu yüzden yetmiyordu.
  test('daha sık örneklenmiş eğri de aynı konvertörü verir', () => {
    const src = VE_FT_TC_PRESETS.tc411.data;
    const dense = [];
    for (let i = 0; i < src.length - 1; i++) {
      dense.push(src[i]);
      dense.push({ sr: (src[i].sr + src[i + 1].sr) / 2,
                   kpump: (src[i].kpump + src[i + 1].kpump) / 2,
                   tau: (src[i].tau + src[i + 1].tau) / 2 });
    }
    dense.push(src[src.length - 1]);
    expect(veResolveTCPresetKey(tcNode({ tcData: dense }))).toBe('tc411');
  });

  test('hiçbir presete uymayan eğri boş döner', () => {
    const uydurma = [{ sr: 0, kpump: 10, tau: 5 }, { sr: 0.5, kpump: 12, tau: 3 }, { sr: 1, kpump: 14, tau: 1 }];
    expect(veResolveTCPresetKey(tcNode({ tcData: uydurma }))).toBe('');
  });

  test('veri yoksa boş döner, çökmez', () => {
    expect(veResolveTCPresetKey(null)).toBe('');
    expect(veResolveTCPresetKey(tcNode({}))).toBe('');
  });

  // Eğri eşleştirmesi ancak TEKİL olduğunda anlamlı: iki preset birbirine
  // karışıyorsa "seçili" işareti yanlış satıra düşerdi.
  test('presetlerin hiçbiri bir diğeriyle karışmıyor', () => {
    const keys = Object.keys(VE_FT_TC_PRESETS);
    keys.forEach(function (k) {
      const hits = keys.filter(k2 => veTCCurveMatches(VE_FT_TC_PRESETS[k].data, VE_FT_TC_PRESETS[k2].data));
      expect(hits).toEqual([k]);
    });
  });
});

// ── BÜTÜNLÜK KAPISI: örnek dosyalar preset anahtarını taşımalı ──────────────
// Kullanıcının gördüğü arıza tam olarak buydu: örnek yüklenince eşleştirme
// modüllerinde hiçbir satır işaretlenmiyordu. Anahtar SAYILARLA da tutarlı
// olmalı — yanlış anahtar, doğru görünen ama yanlış bir tik demektir.
describe('Örnek topolojiler preset anahtarı taşır ve sayılarla tutarlıdır', () => {
  const dir = path.join(__dirname, '../../assets/examples');
  const files = fs.readdirSync(dir).filter(f => /^ap_.*_topoloji\.json$/.test(f));

  test('en az 10 araç performans örneği var', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  files.forEach(function (f) {
    test(f.replace('_topoloji.json', '') + ' — şanzıman ve konvertör anahtarı doğru', () => {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const gb = (j.nodes || []).find(n => n.type === 'gearbox');
      const tc = (j.nodes || []).find(n => n.type === 'torque-converter');

      expect(gb).toBeDefined();
      const gk = gb.data.ftGBPreset;
      expect(VE_GEARBOX_PRESETS[gk]).toBeDefined();
      // Anahtar, dosyadaki vites oranlarını gerçekten anlatıyor mu?
      expect(veGearRatiosMatch(veGearRatioList(gb.data.ftGearData, 'name'),
                               veGearRatioList(VE_GEARBOX_PRESETS[gk].gears, 'gear'))).toBe(true);

      expect(tc).toBeDefined();
      const tk = tc.data.tcPresetKey;
      expect(VE_FT_TC_PRESETS[tk]).toBeDefined();
      expect(veTCCurveMatches(tc.data.tcData, VE_FT_TC_PRESETS[tk].data)).toBe(true);

      // Çözücü de aynı sonuca varmalı (anahtar silinse bile sayılar yeter mi
      // diye DEĞİL — anahtar varken çözücünün onu bozmadığını bağlar).
      expect(veResolveGearboxPresetKey(gb)).toBe(gk);
      expect(veResolveTCPresetKey(tc)).toBe(tk);
    });
  });
});
