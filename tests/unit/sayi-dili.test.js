/**
 * sayi-dili.test.js — TEK SAYI YAZICISI (kullanıcı kararı 7·C, 2026-09-26)
 * ───────────────────────────────────────────────────────────────────────────
 * Ekrana giden sayı Türkçe yazılır: ondalık VİRGÜL, binlik NOKTA — 1.716,2.
 * Karar sayfasındaki ölçüm: 213 sayı noktalı (1716.2), 17 sayı virgüllü
 * (1714,6), aynı modülde ikisi birden; günlük hız oranını "1.090" yazıyordu.
 *
 * Kapılar:
 *   · veSayi / veSayiOku davranışı — özellikle GİRDİ yolu: gruplanmış "1.716"
 *     okurken bin mi bir virgül mü belli değil; girdi alanı gruplamasız yazılır
 *     ve okuyucu kendi çıktısını geri okur (sessiz bin kat hataya karşı).
 *   · aşama dosyalarında işaretsiz toFixed/toExponential/toLocaleString yok
 *     (tools/sayi-dili.js) — makine biçimi `// makine: <sebep>` taşır.
 *   · Ölçüm Görüntüleyici aynı yazıcıyı taşıyor (viewer/sync.js birebir kopya).
 */
const fs = require('fs');
const path = require('path');
const T = require('../../tools/sayi-dili.js');
const { veSayi, veSayiUstel, veSayiOku } = require('../../js/sayi.js');

const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');

// KAPSAM: ürünün TAMAMI — js/ ve viewer/js/'teki her dosya; yeni dosya
// kendiliğinden girer. Kapsam aşama aşama büyüdü (1: grafik çekirdeği · 2a:
// Sonuçlar katmanı · 2c: bileşen pencereleri · 3a–3b: belgeler · 3c: çözücü
// günlüğü · 3d: kalan kabuk). Tek istisna dışarıdan gelen, birebir duran FEAD
// çekirdeği; CAN Çözümleyici (candbc/) kendi yazıcısıyla ayrıca taranır.
const ISTISNA = { 'js/fead-core.js': 'dışarıdan geldi, birebir durur (FEAD skill, kural 1)' };
const URUN = ['js', 'viewer/js'].flatMap((d) => fs.readdirSync(path.join(KOK, d))
  .filter((f) => f.endsWith('.js')).map((f) => d + '/' + f));

describe('veSayi — Türkçe yazım', () => {
  test.each([
    [1716.2, 1, '1.716,2'],
    [1714.64, 1, '1.714,6'],
    [1000, 0, '1.000'],
    [999.5, 0, '1.000'],              // yuvarlama gruplamadan ÖNCE
    [1.09, 3, '1,090'],               // günlüğün "1.090"u: artık bin doksan diye okunmaz
    [1234567.891, 2, '1.234.567,89'],
    [-12, 2, '-12,00'],
    [0.5, undefined, '0,5'],
    [42, undefined, '42']
  ])('%p (%p hane) → %s', (v, n, beklenen) => expect(veSayi(v, n)).toBe(beklenen));

  test('yuvarlanınca sıfıra inen eksi sayı işaretini bırakır ("-0,0" yok)', () => {
    expect(veSayi(-0.04, 1)).toBe('0,0');
    expect(veSayi(-0.0001, 0)).toBe('0');
    expect(veSayi(-0.06, 1)).toBe('-0,1');
  });

  test('sayı değilse tire; seçenekler: gruplamasız, belge eksisi, işaret', () => {
    [NaN, Infinity, null, undefined, '', 'abc'].forEach((v) => expect(veSayi(v, 1)).toBe('—'));
    expect(veSayi(1716.2, 1, { binlik: false })).toBe('1716,2');
    expect(veSayi(-3.5, 1, { eksi: '−' })).toBe('−3,5');
    expect(veSayi(25, 0, { isaret: true })).toBe('+25');
    expect(veSayi(0, 0, { isaret: true })).toBe('0');
    expect(veSayi('12.5', 1)).toBe('12,5');            // sayı dizgesi okunur
  });

  test('üstel yazımda ondalık virgül; toFixed\'in üstele kaçtığı büyüklükte de', () => {
    expect(veSayiUstel(0.000123, 2)).toBe('1,23e-4');
    expect(veSayiUstel(-4.5e-7, 1)).toBe('-4,5e-7');
    expect(veSayi(1e21, 0)).toBe('1,00e+21');
  });
});

describe('veSayiOku — girdi iki yazımı da kabul eder, SESSİZ bin kat hata yok', () => {
  test.each([
    ['63,5', 63.5], ['63.5', 63.5], ['1.716,2', 1716.2], ['1716,2', 1716.2],
    [' −2,5 ', -2.5], ['-2.5', -2.5], ['1e3', 1000], [12, 12]
  ])('%p → %p', (s, v) => expect(veSayiOku(s)).toBe(v));

  test('bozuk ya da boş girdi NaN — sıfır değil', () => {
    ['', '   ', 'abc', '1,2,3', '--2', null, undefined].forEach((s) => expect(veSayiOku(s)).toBeNaN());
  });

  test('virgülsüz nokta ONDALIKTIR: "1.716" bugünkü gibi 1,716 okunur', () => {
    // Bu yüzden girdi alanı gruplamasız yazılır — aşağıdaki gidiş-dönüş kapısı.
    expect(veSayiOku('1.716')).toBe(1.716);
  });

  const TOHUM = [0, 1, -1, 0.5, 12.25, 999.99, 1000, 1716.2, -1716.25, 12345.678, 1234567.5, -0.004];

  test('gidiş-dönüş: GRUPLAMASIZ çıktı her zaman aynı sayıya döner (girdi alanının yolu)', () => {
    for (const v of TOHUM) {
      for (const n of [0, 1, 2, 3]) {
        const beklenen = Number(v.toFixed(n)) || 0;   // yazıcı "-0" yazmaz (yukarıda)
        expect([v, n, veSayiOku(veSayi(v, n, { binlik: false }))]).toEqual([v, n, beklenen]);
      }
    }
  });

  test('gidiş-dönüş: gruplu çıktı ONDALIK taşıyorsa döner (virgül binliği belirler)', () => {
    for (const v of TOHUM) {
      for (const n of [1, 2, 3]) {
        expect([v, n, veSayiOku(veSayi(v, n))]).toEqual([v, n, Number(v.toFixed(n)) || 0]);
      }
    }
  });

  test('gruplanmış TAM SAYI geri okunamaz: "1.000" → 1 — girdi alanına gruplu sayı YAZILMAZ', () => {
    // Bilerek: okuyucu virgülsüz noktayı ondalık sayar, çünkü dişli oranı
    // "1.000" / "2.480" bugün böyle yazılıyor. Kapının ilk sürümü tam bu
    // bin kat hatayı yakaladı (999,99 → "1.000" → 1).
    expect(veSayi(999.99, 0)).toBe('1.000');
    expect(veSayiOku(veSayi(999.99, 0))).toBe(1);
    expect(veSayiOku(veSayi(999.99, 0, { binlik: false }))).toBe(1000);
  });
});

describe('tarayıcının kuralı', () => {
  const yakalar = (m) => T.tara(m, 'a.js').map((x) => x.satir);
  test('ekrana giden toFixed / toExponential / toLocaleString yakalanır', () => {
    expect(yakalar("h += v.toFixed(1) + ' mm';")).toEqual([1]);
    expect(yakalar('s = x.toExponential(2);')).toEqual([1]);
    expect(yakalar('s = n.toLocaleString();')).toEqual([1]);
  });
  test('sebebi yazılı makine biçimi, yorum ve veSayi geçer; sebepsiz işaret geçmez', () => {
    expect(yakalar("row += n.toFixed(4);   // makine: CSV hücresi")).toEqual([]);
    expect(yakalar('// eskiden v.toFixed(1) yazılıyordu')).toEqual([]);
    expect(yakalar("h += veSayi(v, 1) + ' mm';")).toEqual([]);
    expect(yakalar('row += n.toFixed(4);   // makine:')).toEqual([1]);
  });
});

describe('bütün ürün — işaretsiz sayı yazımı yok', () => {
  test('js/ ve viewer/js/ TAMAMI (istisna dışında)', () => {
    expect(URUN.length).toBeGreaterThan(100);   // ölçüldü: 114 dosya
    const s = URUN.filter((f) => !ISTISNA[f]).flatMap(T.sapmalar).map((x) => x.dosya + ':' + x.satir + ' ' + x.metin);
    expect(s).toEqual([]);
  });
  // İstisna bir susturucu olmasın: dosya gerçekten var ve gerçekten sapıyor.
  // Çekirdek dışarıdan güncellenip temizlenirse bu test istisnayı kaldırtır.
  test('istisna listesi yalnız gerçekten sapan dosyayı tutuyor', () => {
    for (const f of Object.keys(ISTISNA)) {
      expect(fs.existsSync(path.join(KOK, f))).toBe(true);
      expect(T.sapmalar(f).length).toBeGreaterThan(0);
    }
  });
});

describe('aşama 2a — modüllerin Sonuçlar katmanı (FEAD · Takoz)', () => {
  test('kanal KİMLİĞİ sayıyı yazıcıdan geçirmez — biçim değişse de kayıtlı pano kanalını bulur', () => {
    for (const f of ['js/fead-signals.js', 'js/mount-signals.js']) {
      const s = oku(f), i = s.indexOf('function _ordId(');
      const govde = s.slice(i, s.indexOf('}', i));
      expect([f, /veSayi|_tr\(|_nTr\(/.test(govde)]).toEqual([f, false]);
    }
  });
});

describe('aşama 2c — bileşen pencereleri', () => {
  // Seçenek metni elle yazılır ve `toFixed` taşımaz — tarayıcı onu görmez.
  // Çözücünün Δt listesi "0.05 (hızlı)" yazıyordu. DEĞER makine kalır.
  test('<option> METNİ noktalı ondalık taşımaz (değeri makine biçiminde kalır)', () => {
    const { yorumsuzJs } = require('../../tools/ikon-dili.js');
    const re = />[^<>]*?(?<![\w.,])\d+\.\d+[^<>]*<\/option>/;
    const bulunan = [];
    const dosyalar = fs.readdirSync(path.join(KOK, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
    for (const f of dosyalar.concat(['index.html'])) {
      const metin = f.endsWith('.js') ? yorumsuzJs(oku(f)) : oku(f);
      metin.split('\n').forEach((l, i) => { if (re.test(l)) bulunan.push(f + ':' + (i + 1) + ' ' + l.match(re)[0]); });
    }
    expect(bulunan).toEqual([]);
    expect(re.test('<option value="0.05">0.05 (hızlı)</option>')).toBe(true);    // kapı düşebiliyor
    expect(re.test('<option value="0.05">0,05 (hızlı)</option>')).toBe(false);
  });
});

// Aşama 3a: Araç Performans belgeleri. Belgenin kendisi sayi-belge.spec.js'te.
describe('aşama 3a — Araç Performans belgeleri', () => {
  test('eğim yazıcısı Türkçe: rapor ve TXT aynı biçimi paylaşıyor', () => {
    const src = oku('js/ft-performance.js');
    expect(src).toMatch(/function veGradeDisplay[\s\S]{0,400}veSayi\(/);
  });
});

// Aşama 3b: FEAD ve takoz belgeleri — FEAD raporu, FEAD özeti, takoz raporu
// ve iki kuram şablonu. Virgül yazıyorlardı ama binliği gruplamıyordu; SVG
// koordinatı makine kalır. Formüle giden sayı `{,}` taşır (_frTeX · _rTeX) —
// onu yalnız gerçek belge ölçer (sayi-belge.spec.js → texTara).
// mount-core.js'in öz-testi (selfTest) kapsam DIŞI: yalnız birim testleri
// çağırıyor, hiçbir yüzeye yazmıyor.

describe('aşama 3b — FEAD ve takoz belgeleri', () => {
  test('formül yazıcıları ondalık virgülü {,} yapıyor, binlik noktaya dokunmuyor', () => {
    for (const [f, ad] of [['js/cp-fead-report.js', '_frTeX'], ['js/cp-mount-report.js', '_rTeX']]) {
      const m = oku(f).match(new RegExp('function ' + ad + '\\(s\\)\\{[^\\n]*\\}'));
      expect(m).not.toBeNull();
      const yaz = new Function('return (' + m[0] + ')')();
      expect(yaz('−12.760,7')).toBe('−12.760{,}7');
      expect(yaz('1.500')).toBe('1.500');
    }
  });
});

// Aşama 3c: çözücü günlüğü — Araç Performans'ın çözüm penceresi, eski hesap
// yolunun kartı ve öteki topolojilerin satırları. Günlüğün kendisi
// sayi-belge.spec.js'te (zaman damgası dâhil, kutu hizası damga ayıklanarak).

describe('aşama 3c — çözücü günlüğü', () => {
  // Hız hesabı süreyi YAZIDAN okuyordu: parseFloat("0,759") = 0 → "Infinityk
  // adım/s". Sayısal kopya ayrı tutulur.
  test('günlükteki süre yazıdan geri okunmuyor', () => {
    expect(oku('js/solver-pro.js')).not.toMatch(/parseFloat\(elapsed\)/);
  });
});

describe('ekrandaki YAZI sayıya geri okunmaz', () => {
  // Türkçe yazı "0,00650" parseFloat'ta 0, "1.000 m" parseInt'te 1 olur ve
  // hiçbir şey patlamaz. Yazıdan sayı okuyan iki yer vardı: sahil testi
  // sihirbazının Crr'si (aktarılan değer 0 olurdu) ve yol haritasının segment
  // düğmesi. Değer artık yazıdan değil, kendi niteliğinden okunuyor.
  const { yorumsuzJs } = require('../../tools/ikon-dili.js');
  test('ürün kaynağında `parseFloat/parseInt/Number(… .textContent/.innerText/.innerHTML)` yok', () => {
    const bulunan = [];
    for (const d of ['js', 'viewer/js', 'candbc/js']) {
      for (const f of fs.readdirSync(path.join(KOK, d)).filter((x) => x.endsWith('.js'))) {
        yorumsuzJs(oku(d + '/' + f)).split('\n').forEach((l, i) => {
          if (/\b(parseFloat|parseInt|Number)\s*\([^;]*\.(textContent|innerText|innerHTML)\b/.test(l)) bulunan.push(d + '/' + f + ':' + (i + 1));
        });
      }
    }
    expect(bulunan).toEqual([]);
  });

  test('sahil testi Crr\'si ekrandaki Türkçe yazıdan değil kendi niteliğinden aktarılır', () => {
    const stubs = stubGlobals();
    eval(loadSource('component-extras.js'));
    global.nodes = [{ id: 'cd1', type: 'coast-down', data: {} }];
    document.body.innerHTML = '<span id="cdw-crr-mean"></span><input id="cdw-cd-input" value="">';
    const el = document.getElementById('cdw-crr-mean');
    el.textContent = veSayi(0.0065, 5);                 // "0,00650" — parseFloat'ta 0
    el.setAttribute('data-deger', (0.0065).toFixed(5)); // makine: hesaplayıcının yazdığı
    cdwApplyResults('cd1');
    expect(global.nodes[0].data.crr).toBe(0.0065);
    // Sıfırlanan özet eski değeri taşımaz: aktarılacak bir şey yok.
    cdwResetSummaries();
    global.nodes[0].data = {};
    cdwApplyResults('cd1');
    expect(global.nodes[0].data.crr).toBeUndefined();
    resetStubs(stubs);
  });
});

describe('aşama 1 — grafik çekirdeği (eksen · imleç · sinyal ağacı · pano)', () => {
  test('eksen ve ipucu yazıcıları (graphics.js + görüntüleyici kopyası) veSayi\'den geçiyor', () => {
    for (const f of ['js/graphics.js', 'viewer/js/board.js']) {
      const s = oku(f);
      for (const ad of ['veFormatTooltipVal', 'veFormatAxisVal']) {
        const i = s.indexOf('function ' + ad + '(');
        const govde = s.slice(i, s.indexOf('\n}\n', i));
        expect([f, ad, T.tara(govde, f).length]).toEqual([f, ad, 0]);
        expect([f, ad, /veSayi\(/.test(govde)]).toEqual([f, ad, true]);
      }
    }
  });
  test('yazıcı yükleyiciden ÖNCE yüklenir (MFSim) ve görüntüleyici onu birebir taşır', () => {
    const html = oku('index.html');
    expect(html.indexOf('src="js/sayi.js"')).toBeGreaterThan(-1);
    expect(html.indexOf('src="js/sayi.js"')).toBeLessThan(html.indexOf('src="js/loader.js"'));
    expect(oku('viewer/js/sayi.js')).toBe(oku('js/sayi.js'));
    const v = oku('viewer/index.html');
    expect(v.indexOf('src="js/sayi.js"')).toBeLessThan(v.indexOf('src="js/board.js"'));
  });
});
