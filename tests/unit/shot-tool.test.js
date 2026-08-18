/**
 * tools/shot.js — ÖNCESİ/SONRASI ekran görüntüsü aracının SAYISAL/AYRIŞTIRMA
 * çekirdeği.
 *
 * Neden test var: aracın çıktısı bir PNG, yani "yeşil/kırmızı" diye bakılabilen
 * bir şey değil. Yanlış ayrıştırılan bir bayrak görüntü ÜRETMEYE DEVAM eder —
 * ama başka bir ekranın görüntüsünü. Karşılaştırmayı sessizce yalan yapan sınıf
 * budur; kapı burada.
 *
 * Tarayıcı gerektiren yollar (shoot/compose) BURADA DEĞİL: onların karşılığı
 * aracı elle bir kez koşturmak.
 */
const shot = require('../../tools/shot.js');

describe('parseArgs — bayraklar', () => {
  test('varsayılanlar', () => {
    const o = shot.parseArgs([]);
    expect(o.mode).toBe('shot');
    expect(o.file).toBe('index');
    expect(o.size).toBe('1600x1000');
    expect(o.dpr).toBe('2');
    expect(o.out).toBe('.shots/shot.png');
    expect(o.fit).toBe(false);
    expect(o.hideToast).toBe(false);
  });

  test('değerli bayrak — hem "--x y" hem "--x=y"', () => {
    expect(shot.parseArgs(['--module', 'fead-analysis']).module).toBe('fead-analysis');
    expect(shot.parseArgs(['--module=fead-analysis']).module).toBe('fead-analysis');
  });

  test('tireli bayrak camelCase anahtara düşer (--hide-toast → hideToast)', () => {
    expect(shot.parseArgs(['--hide-toast']).hideToast).toBe(true);
  });

  test('BİLİNMEYEN bayrak patlar — sessizce yutulmaz', () => {
    // "--modul" yutulsaydı araç görüntü almaya devam ederdi: yanlış ekranın.
    expect(() => shot.parseArgs(['--modul', 'fead-analysis'])).toThrow(/Bilinmeyen seçenek/);
  });

  test('değersiz kalan bayrak patlar', () => {
    expect(() => shot.parseArgs(['--out'])).toThrow(/değer ister/);
  });

  test('--compose iki dosya ister ve kipi değiştirir', () => {
    const o = shot.parseArgs(['--compose', 'a.png', 'b.png']);
    expect(o.mode).toBe('compose');
    expect(o.compose).toEqual(['a.png', 'b.png']);
    expect(o.out).toBe('.shots/karsilastirma.png');
    expect(() => shot.parseArgs(['--compose', 'a.png'])).toThrow(/iki PNG/);
  });
});

describe('parseSize / resolveTarget', () => {
  test('ölçü ayrıştırma ve doğrulama', () => {
    expect(shot.parseSize('1600x1000')).toEqual({ width: 1600, height: 1000 });
    expect(() => shot.parseSize('1600*1000')).toThrow(/GENİŞLİK/);
    expect(() => shot.parseSize('16x10')).toThrow();
  });

  test('hedef takma adları', () => {
    expect(shot.resolveTarget('index')).toBe('index.html');
    expect(shot.resolveTarget('built')).toBe('MFSim_Code.html');
    expect(shot.resolveTarget('viewer')).toBe('MFSim_Olcum_Goruntuleyici.html');
    expect(shot.resolveTarget('assets/examples/x.json')).toBe('assets/examples/x.json');
  });
});

describe('PNG ölçüsü ve karşılaştırma yerleşimi', () => {
  // 8 baytlık imza + IHDR uzunluğu/tipi + genişlik/yükseklik — resim kitaplığı yok.
  function fakePng(w, h) {
    const b = Buffer.alloc(24);
    b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4);
    b.writeUInt32BE(13, 8); b.write('IHDR', 12);
    b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
    return b;
  }

  test('IHDR başlığından ölçü', () => {
    expect(shot.pngSize(fakePng(3200, 2000))).toEqual({ w: 3200, h: 2000 });
    expect(() => shot.pngSize(Buffer.alloc(24))).toThrow(/PNG değil/);
  });

  test('İKİ GÖRÜNTÜ TEK ÖLÇEKLE küçülür — boyut farkı yalan söylemesin', () => {
    // Farklı genişlikte iki çekim: oran KORUNMALI (biri diğerine göre büyük
    // görünüyorsa bu gerçek bir fark olmalı, ölçek artefaktı değil).
    const plan = shot.composePlan(fakePng2(3200, 2000), fakePng2(1600, 2000), {});
    expect(plan.wA / plan.wB).toBeCloseTo(2, 2);   // yuvarlama payı
    expect(plan.width).toBeLessThanOrEqual(2800);

    function fakePng2(w, h) { return { w: w, h: h }; }
  });

  test('küçük görüntüler BÜYÜTÜLMEZ (ölçek ≤ 1)', () => {
    const plan = shot.composePlan({ w: 400, h: 300 }, { w: 400, h: 300 }, {});
    expect(plan.k).toBeLessThanOrEqual(1);
    expect(plan.wA).toBe(400);
  });

  test('karşılaştırma sayfası iki künyeyi de taşır', () => {
    const a = { name: 'oncesi.png', uri: 'data:image/png;base64,AA', w: 800, h: 600 };
    const b = { name: 'sonrasi.png', uri: 'data:image/png;base64,BB', w: 800, h: 600 };
    const html = shot.composeHtml(a, b, shot.composePlan(a, b, {}), { title: 'x' });
    expect(html).toContain('ÖNCESİ');
    expect(html).toContain('SONRASI');
  });
});
