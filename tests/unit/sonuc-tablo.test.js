/**
 * sonuc-tablo.test.js — Sonuçlar › Tablo kipi: FÖY (js/sonuc-tablo.js)
 *
 * Kullanıcı seçimi (2026-09-28, tasarım tuvali "C · Föy"). Eski tablonun
 * ÖLÇÜLEN kusurları ve bu dosyadaki kapıları:
 *
 *   1) Sayılar sinyal rengiyle yazılıyordu: açık zeminde 1,62–3,47:1 (metin
 *      eşiği 4,5). Kapı: hiçbir hücre satır içi stil taşımaz; renk yalnız
 *      başlıktaki noktada.
 *   2) Ondalık DEĞER başına seçiliyordu, X sütunu hep üç haneydi (880,000).
 *      Kapı: veFoyOndalik — sütun başına TEK hane.
 *   3) Seyreltme sessizdi: "#" sütunu 1, 2, 3 sayıyordu, 5.001 örnekli seride
 *      her 25. örneğin gösterildiği görünmüyordu. Kapı: veFoyNot.
 *   4) Özet tbody'nin sonundaydı (uzun tabloda görmek için sona kaydırmak
 *      gerekiyordu). Kapı: özet tfoot'ta; YAPIŞIKLIĞI tarayıcı ölçer
 *      (tests/e2e/sonuc-tablo.spec.js).
 *   5) CSV'nin düğmesi yoktu (veExportResultsCSV hiçbir yerden çağrılmıyordu)
 *      ve yalnız Araç Performans sonucunu okuyordu. Kapı: veFoyMetin — her
 *      kaynak, TÜM örnekler.
 *   6) Yorum şeridi tablo kipinde görünmüyordu (gizlenen grafik kabının
 *      içindeydi). Kapı: veTrShellHTML'de şerit kabın DIŞINDA.
 *
 * Veri gerçek: AG00976_GATES_2025 örneğinin çalışma çevrimi (FEAD çözücüsünün
 * kendi sayıları, kullanıcının ekranındaki tabloyla aynı).
 */
const S = require('../../js/sayi.js');
global.veSayi = S.veSayi;
global.veSayiUstel = S.veSayiUstel;
const T = require('../../js/sonuc-tablo.js');
const TV = require('../../js/trace-view.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const oku = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const X = [880, 1000, 1100, 1200, 1400, 1500, 1600, 1700, 1800, 2000, 2500, 2750];
// Çözücünün HAM sayıları (tam hassasiyet): yuvarlanmış 1380.838 "üç hanede tam"
// sayılır ve tablo 1.380,838 yazar — gerçek veri öyle değil.
const FAN = [1380.837828273393, 1404.705789214845, 1373.9731492415594, 1347.3945201695883, 1295.6705466586666, 1269.55962099326,
  1227.834693698487, 1227.2367521991077, 1209.2795249479113, 1166.554232033542, 1056.4236582736028, 1027.570884250573];
const KK = [1023.0824402682202, 985.3267055931354, 950.4752582007497, 920.4642896128619, 871.6446033846388, 850.5677756759104,
  813.2476840932305, 816.5363623398157, 802.0339081961433, 776.7988786953604, 730.6787966461031, 714.541520398962];
const PKW = [6.34, 7.409999999999999, 7.859999999999999, 8.299999999999999, 9.059999999999999, 9.37,
  9.42, 10, 10.309999999999999, 10.72, 11.03, 11.45];
const SF = [4.582677569111234, 4.5048113211989556, 4.605573657463249, 4.696422946274332, 4.883907069221809, 4.984353974063847,
  5.15373492432253, 5.1562459573261705, 5.2328137636179015, 5.424466662966768, 5.989959134907862, 6.158148930838801];

function model(ek) {
  return Object.assign({
    baslik: 'Çalışma çevrimi', kaynak: 'FEAD kayış tahriki',
    x: { ad: 'Motor devri [d/dk]', birim: 'd/dk', veri: X },
    sutunlar: [
      { ad: 'FAN → AVA1 · gerginlik', birim: 'N', renk: '#3b82f6', veri: FAN },
      { ad: 'KK → AVA2 · gerginlik', birim: 'N', renk: '#ef4444', veri: KK },
      { ad: 'Sürücü gücü (FAN)', birim: 'kW', renk: '#22c55e', veri: PKW },
      { ad: 'En düşük kayma emniyeti', birim: '×', renk: '#f59e0b', veri: SF }
    ]
  }, ek || {});
}

function kur(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d;
}
const metin = (el) => el.textContent.replace(/ /g, ' ').trim();

// ════════════════════════════════════════════════════════════════════════════
describe('1 · sütunun TEK ondalığı — virgüller alt alta', () => {
  test('devir tam sayı → 0 hane: 1.000 (eskiden 880,000)', () => {
    const sey = T.veFoySeyrelt(X.length);
    const d = T.veFoyOndalik(X, sey.idx);
    expect(d).toBe(0);
    expect(X.slice(0, 3).map((v) => T.veFoyHucre(v, d))).toEqual(['880', '1.000', '1.100']);
  });

  test('hesaplanmış gerginlik büyüklükten 1 hane: 1.380,8 — "tam hane" payı sıkı', () => {
    // Göreli 1e-7 payı 1.380,838'i "dört hanede tam" sayıyordu: tablo
    // 1.380,8378 yazdı (tarayıcıda ölçüldü). Pay kayan noktanın hatası kadar.
    expect(T.veFoyOndalik(FAN)).toBe(1);
    expect(T.veFoyHucre(FAN[0], T.veFoyOndalik(FAN))).toBe('1.380,8');
    expect(T.veFoyOndalik(KK)).toBe(1);
    expect(T.veFoyOndalik(SF)).toBe(2);
  });

  test('sütunun bütün hücreleri AYNI haneyle — 100\'ü geçen sütunda da', () => {
    const v = [99.5, 100.2, 101.37, 98.04];
    const d = T.veFoyOndalik(v);
    const hane = v.map((x) => T.veFoyHucre(x, d).split(',')[1].length);
    expect(new Set(hane).size).toBe(1);
  });

  test('ölçüm dosyasının kendi hassasiyeti korunur (812,25) — en az üç farklı değer', () => {
    expect(T.veFoyOndalik([800.5, 812.25, 825, 790.75])).toBe(2);
  });

  test('sabit sütunun rastlantısal ikili kesri UZATMAZ: 543,875 → 543,9 (komşusu gibi)', () => {
    // FEAD senaryosunda ALT → TEN gerginliği sabit 543,875 N; "üç hanede tam"
    // sayılıp 543,875 yazılıyordu, yanındaki sütun 543,9 (ölçüldü).
    expect(T.veFoyOndalik([543.875, 543.875, 543.875])).toBe(1);
  });

  test('daha az hanede tam olan sütun KIRPILIR: 2,7 · 7,4 → bir hane', () => {
    expect(T.veFoyOndalik([2.7, 7.4, 3.1])).toBe(1);
    expect(T.veFoyOndalik(PKW)).toBe(2);
  });

  test('X sütununda ekranda alt alta iki farklı değer AYNI yazılamaz', () => {
    const xs = Array.from({ length: 1000 }, (_, i) => i * 0.001234);
    const sey = T.veFoySeyrelt(xs.length);
    const d = T.veFoyOndalik(xs, sey.idx);
    const yaz = sey.idx.map((i) => T.veFoyHucre(xs[i], d));
    for (let k = 1; k < yaz.length; k++) expect(yaz[k]).not.toBe(yaz[k - 1]);
  });

  test('metin ya da boş sütun null; hücre metni kaçışlanır; eksik değer "—"', () => {
    expect(T.veFoyOndalik(['1C', '2L'])).toBeNull();
    expect(T.veFoyOndalik(null)).toBeNull();
    expect(T.veFoyHucre('<b>1C</b>', null)).toBe('&lt;b&gt;1C&lt;/b&gt;');
    expect(T.veFoyHucre(null, 1)).toBe('—');
    expect(T.veFoyHucre(NaN, 1)).toBe('—');
  });

  test('eksi tipografik (−), sayı metin olarak gelse de sayıdır', () => {
    expect(T.veFoyHucre(-583.3, 1)).toBe('−583,3');
    expect(T.veFoyHucre('12.5', 2)).toBe('12,50');
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('2 · seyreltme GÖRÜNÜR — not satırı söyler', () => {
  test('kısa seri: tamamı', () => {
    const sey = T.veFoySeyrelt(12);
    expect(sey).toEqual({ idx: X.map((_, i) => i), adim: 1 });
    expect(T.veFoyNot(12, sey)).toBe('Satır: 12 · tamamı');
  });

  test('uzun seri: her k. örnek + SON örnek, sayılar Türkçe', () => {
    const sey = T.veFoySeyrelt(5001);
    expect(sey.adim).toBe(25);
    expect(sey.idx.length).toBe(201);
    expect(sey.idx[sey.idx.length - 1]).toBe(5000);
    expect(T.veFoyNot(5001, sey))
      .toBe('Satır: 201 / 5.001 · her 25. örnek gösteriliyor — Kopyala ve CSV tamamını alır');
  });

  test('adım sonu atlarsa SON örnek yine eklenir (tablonun sonu serinin sonu)', () => {
    const sey = T.veFoySeyrelt(451);
    expect(sey.adim).toBe(2);
    expect(sey.idx[sey.idx.length - 1]).toBe(450);
  });

  test('föyde: gövde yalnız gösterilen satırlar, not tfoot\'ta', () => {
    const n = 501;
    const xs = Array.from({ length: n }, (_, i) => i * 0.02);
    const v = xs.map((t) => Math.sin(t));
    const d = kur(T.veFoyHTML({ baslik: 'Ölçüm', x: { ad: 'Zaman [s]', birim: 's', veri: xs },
      sutunlar: [{ ad: 'Sinüs', birim: '', renk: '#3b82f6', veri: v }] }, 0));
    expect(d.querySelectorAll('#ve-table-body-0 tr').length).toBe(T.veFoySeyrelt(n).idx.length);
    expect(metin(d.querySelector('tfoot .ve-foy-not'))).toMatch(/^Satır: 251 \/ 501 · her 2\. örnek/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('3 · föyün yapısı — sayı mürekkepte, renk yalnız noktada', () => {
  const d = kur(T.veFoyHTML(model(), 0));

  test('HİÇBİR hücre satır içi stil taşımaz (eski: her sayı sinyal renginde)', () => {
    expect(d.querySelectorAll('td[style], th[style], tr[style]').length).toBe(0);
    const noktalar = [...d.querySelectorAll('.ve-foy-nokta')];
    expect(noktalar.map((n) => n.style.background)).toEqual(
      ['rgb(59, 130, 246)', 'rgb(239, 68, 68)', 'rgb(34, 197, 94)', 'rgb(245, 158, 11)']);
    expect(d.querySelectorAll('[style]').length).toBe(4);
  });

  test('kimlikler eski yüzeyle AYNI: #ve-table-0 · #ve-table-body-0 (e2e ve dış çağrılar)', () => {
    expect(d.querySelector('table#ve-table-0.ve-foy-tablo')).not.toBeNull();
    expect(d.querySelector('tbody#ve-table-body-0')).not.toBeNull();
  });

  test('başlık: ad ile birim ayrı satırda, birim addan ayıklanır; künye başlıkta', () => {
    const th = [...d.querySelectorAll('thead th')];
    expect(th.map((t) => metin(t.querySelector('.ve-foy-sad')))).toEqual(
      ['Motor devri', 'FAN → AVA1 · gerginlik', 'KK → AVA2 · gerginlik', 'Sürücü gücü (FAN)', 'En düşük kayma emniyeti']);
    expect(th.map((t) => metin(t.querySelector('.ve-foy-birim')))).toEqual(['(d/dk)', '(N)', '(N)', '(kW)', '(×)']);
    expect(metin(d.querySelector('.ve-foy-ad'))).toBe('Çalışma çevrimi');
    expect(metin(d.querySelector('.ve-foy-kaynak'))).toBe('FEAD kayış tahriki');
    // "·" önceki sözcüğe bağlı: satır "· gerginlik" diye başlamaz
    expect(th[1].querySelector('.ve-foy-sad').textContent).toContain('AVA1 ·');
  });

  test('gövde: ekrandaki tabloyla birebir (12 satır, sütun ondalıkları)', () => {
    const satir = [...d.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map(metin));
    expect(satir.length).toBe(12);
    expect(satir[0]).toEqual(['880', '1.380,8', '1.023,1', '6,34', '4,58']);
    expect(satir[11]).toEqual(['2.750', '1.027,6', '714,5', '11,45', '6,16']);
    expect(satir.some((r) => r.length !== 5)).toBe(false);   // "#" sütunu yok
  });

  test('özet tfoot\'ta: en düşük → ortalama → en yüksek, sayılar serinin kendisinden', () => {
    const oz = [...d.querySelectorAll('tfoot tr.ve-foy-ozet')].map((tr) => [...tr.children].map(metin));
    expect(oz).toEqual([
      ['En düşük', '1.027,6', '714,5', '6,34', '4,50'],
      ['Ortalama', '1.248,9', '854,6', '9,27', '5,11'],
      ['En yüksek', '1.404,7', '1.023,1', '11,45', '6,16']
    ]);
    expect(metin(d.querySelector('tfoot .ve-foy-not'))).toBe('Satır: 12 · tamamı');
  });

  test('dört satırda bir nefes payı', () => {
    const grup = [...d.querySelectorAll('tbody tr')].map((tr, i) => tr.classList.contains('ve-foy-grup') ? i : -1).filter((i) => i >= 0);
    expect(grup).toEqual([4, 8]);
  });

  test('tam sayı sütununun ortalaması bir hane alır (vites ortalaması 3,5)', () => {
    const h = kur(T.veFoyHTML({ baslik: 'V', x: { ad: 't', birim: 's', veri: [0, 1, 2, 3, 4, 5] },
      sutunlar: [{ ad: 'Vites', birim: '', renk: '#3b82f6', veri: [1, 2, 3, 4, 5, 6] }] }, 0));
    const ort = [...h.querySelectorAll('tfoot tr.ve-foy-ozet')][1];
    expect(metin(ort.children[1])).toBe('3,5');
  });

  test('ad KULLANICI VERİSİDİR — HTML çalıştırılmaz; renk yalnız renk sözdizimiyse yazılır', () => {
    const h = kur(T.veFoyHTML(model({ sutunlar: [
      { ad: 'Basinc <img src=x onerror="window.__SIZDI=1">', birim: 'bar', renk: 'red;background:url(x)', veri: FAN }
    ] }), 0));
    expect(h.querySelector('img')).toBeNull();
    expect(metin(h.querySelectorAll('thead th')[1].querySelector('.ve-foy-sad'))).toContain('<img');
    expect(h.querySelectorAll('.ve-foy-nokta').length).toBe(0);
  });

  test('verisi olmayan ve metin taşıyan sütun tabloyu patlatmaz: "—"', () => {
    const h = kur(T.veFoyHTML(model({ sutunlar: [
      { ad: 'Yok', birim: 'N', renk: '#3b82f6', veri: null },
      { ad: 'Vites kipi', birim: '', renk: '#ef4444', veri: X.map((_, i) => (i % 2 ? '1C' : '2L')) }
    ] }), 0));
    const ilk = [...h.querySelector('tbody tr').children].map(metin);
    expect(ilk).toEqual(['880', '—', '2L']);
    const enDusuk = [...h.querySelector('tfoot tr.ve-foy-ozet').children].map(metin);
    expect(enDusuk).toEqual(['En düşük', '—', '—']);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('4 · Kopyala ve CSV — TÜM örnekler, her kaynak', () => {
  test('CSV: ";" ayraç, NOKTALI ondalık (makine biçimi, karar 7·C), başlıkta birim', () => {
    const s = T.veFoyMetin(model(), 'csv').split('\r\n');
    expect(s[0]).toBe('Motor devri [d/dk];FAN → AVA1 · gerginlik [N];KK → AVA2 · gerginlik [N];' +
                      'Sürücü gücü (FAN) [kW];En düşük kayma emniyeti [×]');
    // 12 anlamlı basamak: dışa aktarma ekranın yuvarlamasını taşımaz
    expect(s[1]).toBe('880;1380.83782827;1023.08244027;6.34;4.58267756911');
    expect(s.length).toBe(1 + 12 + 1);   // başlık + 12 satır + son satır sonu
  });

  test('pano: sekme ayraç, VİRGÜLLÜ ondalık, binlik YOK — Türkçe Excel\'e yapıştırılır', () => {
    // Noktalı "1380.838" Türkçe Excel'de BİNLİK okunur (1.380.838): sessiz bin kat.
    const s = T.veFoyMetin(model(), 'pano').split('\r\n');
    expect(s[1]).toBe('880\t1380,83782827\t1023,08244027\t6,34\t4,58267756911');
    expect(s[1]).not.toMatch(/\d\.\d/);
  });

  test('seyreltme dökümü etkilemez: 5.001 örnek → 5.001 satır', () => {
    const xs = Array.from({ length: 5001 }, (_, i) => i * 0.01);
    const s = T.veFoyMetin({ x: { ad: 'Zaman [s]', birim: 's', veri: xs },
      sutunlar: [{ ad: 'v', birim: '', veri: xs.map((t) => t * 2) }] }, 'csv').trim().split('\r\n');
    expect(s.length).toBe(1 + 5001);
    expect(s[s.length - 1]).toBe('50;100');
  });

  test('kayan nokta artığı yazılmaz; metin kanalı CSV\'de gerekirse tırnaklanır', () => {
    const s = T.veFoyMetin({ x: { ad: 't', birim: '', veri: [0.1 + 0.2] },
      sutunlar: [{ ad: 'a;b', birim: '', veri: ['x;"y"'] }] }, 'csv').split('\r\n');
    expect(s[0]).toBe('t;"a;b"');
    expect(s[1]).toBe('0.3;"x;""y"""');
  });

  test('dosya adı başlıktan, ASCII', () => {
    expect(T.veFoyDosyaAdi({ baslik: 'Çalışma çevrimi' }, new Date(2026, 8, 28, 7, 5)))
      .toBe('MFSim_Tablo_Calisma_cevrimi_20260928_0705.csv');
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('5 · araç çubuğu ve kabuk (js/trace-view.js)', () => {
  test('Tablo kipinin araçları: Kopyala + CSV; sinyal yoksa pasif', () => {
    const var4 = TV.veTrTabloAraclari(4);
    expect(var4).toMatch(/data-act="tablo-kopyala"(?![^>]*disabled)/);
    expect(var4).toMatch(/data-act="tablo-csv"(?![^>]*disabled)/);
    expect((TV.veTrTabloAraclari(0).match(/ disabled/g) || []).length).toBe(2);
  });

  test('tablo kipinde iz araçları (log, yakınlaştırma, şerit) ÇİZİLMEZ', () => {
    const src = oku('js/trace-view.js');
    const govde = src.slice(src.indexOf('function veTrRenderToolbar('), src.indexOf('function veTrIzAraclari('));
    expect(govde).toMatch(/\(mode === 'table'\) \? veTrTabloAraclari\(n\) : veTrIzAraclari\(slot, n, zoomed\)/);
    expect(govde).not.toMatch(/data-act="xlog"|data-act="fit"|data-act="split-all"/);
  });

  test('yorum şeridi grafik kabının DIŞINDA — Tablo kipinde de görünür', () => {
    const d = kur(TV.veTrShellHTML());
    const not = d.querySelector('#ve-trace-note');
    expect(not).not.toBeNull();
    expect(d.querySelector('#ve-trace-graph').contains(not)).toBe(false);
    expect(not.parentElement.classList.contains('ve-trace-body')).toBe(true);
  });

  test('MFSim ve görüntüleyici AYNI üreticiyi çağırır (veri çözümü ayrı)', () => {
    [oku('js/graphics.js'), oku('viewer/js/board.js')].forEach((src) => {
      const g = src.slice(src.indexOf('function veRenderTable('));
      expect(g.slice(0, g.indexOf('\n}\n'))).toMatch(/veFoyHTML\(veFoyModel|kap\.innerHTML = veFoyHTML\(m, slotIdx\)/);
    });
    expect(oku('viewer/index.html')).toMatch(/<script src="js\/sonuc-tablo\.js"><\/script>/);
    expect(oku('index.html')).toMatch(/src="js\/sonuc-tablo\.js"/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('6 · görünüm CSS\'te — ortak tablo kuralı', () => {
  const css = oku('css/styles.css');
  const kural = (sec) => {
    const i = css.indexOf(sec + '{');
    return i < 0 ? '' : css.slice(i, css.indexOf('}', i));
  };

  test('fare SATIRI boyar; zebra ve dikey çizgi yok', () => {
    expect(kural('.ve-foy-tablo tbody tr:hover td')).toMatch(/background:var\(--accent-tint-6\)/);
    const foy = css.slice(css.indexOf('.ve-foy-zemin{'), css.indexOf('.ve-foy-pano{'));
    expect(foy).not.toMatch(/nth-child/);
    expect(foy).not.toMatch(/border-(left|right)\s*:/);
  });

  test('sayı sağda, başlığıyla birlikte', () => {
    expect(kural('.ve-foy-tablo th,.ve-foy-tablo td')).toMatch(/text-align:right/);
  });

  test('eski tablonun iki çakışan bloğu ve kopuk parçası gitti', () => {
    expect(css).not.toMatch(/\.ve-result-table/);
    expect(css).not.toMatch(/\.ve-result-card|\.ve-results-chart/);
  });
});
