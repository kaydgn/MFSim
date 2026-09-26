/**
 * Çözücü günlüğünün uyarı özeti — js/solver-pro.js › veSolverUyariOzeti
 * ─────────────────────────────────────────────────────────────────────
 * Ölçüldü (gerçek tarayıcı, Araç Performans örneği isb340_tc411): günlük
 * "Uyarılar (8)" deyip "HESAP TAMAMLANDI — 1 topoloji (18 uyarı)" diye
 * bitiyordu. Özet satırları 'warn' tipiyle yazılıyordu ve o tip her satırı
 * uyarı listesine BİR KEZ DAHA ekliyordu (8 + başlık 1 + 9 = 18); özetin
 * kendi başlığı listenin sonunda "⚠ Uyarılar (8):" diye dokuzuncu uyarı gibi
 * görünüyordu; zaten "⚠" ile gelen iki uyarı "⚠ ⚠" basılıyordu.
 */
eval(loadSource('solver-pro.js'));

describe('veSolverUyariOzeti — özet saymaz, "⚠" bir kez', () => {
  const OLCULEN = [
    '  ⚠ Lockup modda motor devri governed aşıyor: 2870 > 2800 rpm',
    '1.090 (HIZLI) sonuç: 1 uyarı/hata tespit edildi',
    '0 → 70 km/h : ulaşılamadı',
    '0 → 80 km/h : ulaşılamadı',
    '0 → 90 km/h : ulaşılamadı',
    '0 → 100 km/h : ulaşılamadı',
    '  ⚠ Lockup modda motor devri governed aşıyor: 2976 > 2800 rpm',
    '2.470 (YAVAŞ) sonuç: 1 uyarı/hata tespit edildi',
  ];

  test('8 uyarı → 8 satır, başlık 8 diyor', () => {
    const o = veSolverUyariOzeti(OLCULEN);
    expect(o.sayi).toBe(8);
    expect(o.baslik).toBe('Uyarılar (8):');
    expect(o.satirlar).toHaveLength(8);
  });

  test('hiçbir satırda iki "⚠" yok, her satır tam bir "⚠" ile başlıyor', () => {
    veSolverUyariOzeti(OLCULEN).satirlar.forEach((s) => {
      expect((s.match(/⚠/g) || []).length).toBe(1);
      expect(s).toMatch(/^ {2}⚠ \S/);
    });
  });

  test('girdi listesi DEĞİŞMEZ (özet sayıyı büyütmez)', () => {
    const liste = OLCULEN.slice();
    veSolverUyariOzeti(liste);
    expect(liste).toEqual(OLCULEN);
  });

  test('boş ve eksik liste çökmez', () => {
    expect(veSolverUyariOzeti([]).sayi).toBe(0);
    expect(veSolverUyariOzeti(undefined).satirlar).toEqual([]);
  });
});

describe('çözücü özeti yardımcıdan geçiyor (kaynak kapısı)', () => {
  const src = loadSource('solver-pro.js');
  test('özet SAYILMAYAN tiple yazılıyor; eski "warn" yolu yok', () => {
    expect(src).toMatch(/veSolverUyariOzeti\(warnings\)/);
    expect(src).toMatch(/log\(uyariOzet\.baslik,\s*'warn-ozet'\)/);
    expect(src).not.toMatch(/log\('Uyarılar \(' \+ warnings\.length/);
    expect(src).not.toMatch(/warnings\.forEach\(function\(w\) \{ log\('  ⚠ ' \+ w, 'warn'\)/);
  });
  test("'warn-ozet' tipi uyarı listesine EKLEMİYOR", () => {
    const satir = src.split('\n').find((l) => /type === 'warn-ozet'/.test(l)) || '';
    expect(satir).not.toMatch(/warnings\.push/);
  });
});
