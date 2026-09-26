/**
 * cumle-duzeni.test.js — ARAYÜZ ETİKETLERİ CÜMLE DÜZENİNDE (kullanıcı kararı 9·B)
 * ───────────────────────────────────────────────────────────────────────────
 * Kural: çok kelimeli bir etikette yalnız ilk kelime (ve bölüt başı) büyük
 * harfle başlar — "Klavye kısayolları", "Birime göre birleştir". Kullanıcı
 * Windows'un kendi dilini seçti. Kuralın TEK kaynağı tools/cumle-duzeni.js;
 * özel adların listesi de orada (bileşen adları componentDefs'ten okunur).
 *
 * Kapsam aşama aşama büyür:
 *   1 — kabuk: şerit, komut paleti, sağ tık, Ayarlar, Program Durumu,
 *       Kısayollar, Komuta, palet kategorileri, pencere başlıkları, Sonuçlar
 *       kabuğu, içe aktarma, görüntüleyici
 *   2 — bileşen panelleri: cp-*.js (rapor üreticileri hariç), yardımcı
 *       bileşenler, güzergâh haritası, çözücü ve üç modül kılavuzu (kılavuz
 *       kartı panelde BAŞLIĞIYLA arar — iki taraf aynı kuraldan geçmeli)
 *   3a — Sonuçlar: results.js, sensör paketleri, sinyal adları (COMPONENT_SIGNALS ·
 *       SW_DIAGRAM_SIGNALS — `name:` yalnız bu blokların içinde taranır) ve
 *       Çözücü günlüğü; kayıtlı panodaki eski ad açılışta tazelenir
 *       (sinyal-ad-tazele.test.js)
 *   3b — grafikler ve TXT raporları (graphics.js) ve rapor üreticileri (FEAD
 *       ayrıntılı + özet, takoz); özet raporun sayfa adları ADLA aranıyor —
 *       kapısı cp-fead-summary.test.js'te
 */
const fs = require('fs');
const path = require('path');
const { cumle, etiketler, sinyalAdlari, BIRLESTIRME, BILESEN, YUZEY, DEFTER, AD } = require('../../tools/cumle-duzeni.js');

const KOK = path.join(__dirname, '../..');
const ASAMA1 = ['index.html', 'viewer/index.html', 'js/ribbon.js', 'js/command-palette.js',
  'js/context-menus.js', 'js/settings.js', 'js/status.js', 'js/shortcuts-help.js', 'js/toolbar.js',
  'js/cp-komuta.js', 'js/guide-kit.js', 'js/kimlik.js', 'js/cp-programlar.js', 'js/tablo-pencere.js',
  'js/solver-pro.js', 'js/trace-view.js', 'js/measure-import-ui.js', 'js/signal-tree.js',
  'viewer/js/board.js', 'js/deploy-status.js', 'js/topology.js', 'js/ui-core.js', 'js/components.js'];
// Aşama 2: bileşen panelleri. Rapor üreticileri (cp-*-report, cp-fead-summary)
// aşama 3'te — indirilen belgeye yazıyorlar.
const RAPOR = /^cp-(fead-report|fead-summary|mount-report)\.js$/;
const ASAMA2 = fs.readdirSync(path.join(KOK, 'js'))
  .filter((f) => /^cp-.*\.js$/.test(f) && !RAPOR.test(f))
  .concat(['component-extras.js', 'map.js', 'solver.js', 'guide-fead.js', 'guide-arac.js', 'guide-mount.js'])
  .map((f) => 'js/' + f)
  .filter((f) => !ASAMA1.includes(f));

describe('kural', () => {
  test.each([
    ['Birime Göre Birleştir', 'Birime göre birleştir'],
    ['Ölçüm İçe Aktar', 'Ölçüm içe aktar'],
    ['Tümünü Sığdır (Zaman Ekseni)', 'Tümünü sığdır (zaman ekseni)'],
    ['Klima Kompresörü Ekle', 'Klima Kompresörü ekle'],        // bileşen adı
    ['Program Durumu', 'Program Durumu'],                      // yüzey adı
    ['FEAD Kasnakları', 'FEAD kasnakları'],                    // kısaltma
    ['Kapat (Esc)', 'Kapat (Esc)'],                            // tuş
    ["GitHub'da Aç", "GitHub'da aç"],                          // marka
    ['FEAD: Sonuçlar sekmesi', 'FEAD: Sonuçlar sekmesi'],      // iki noktadan sonra yeni bölüt
    ['Dikey Aynala (Üst ↔ Alt)', 'Dikey aynala (üst ↔ alt)'],  // "Alt" burada yön, tuş değil
    ['Toplam Lastik/Jant Ataleti', 'Toplam lastik/jant ataleti'],   // birleşik kelime
    ['Ağ. Merkezi–Ön Aks', 'Ağ. merkezi–ön aks'],                  // kısaltma cümle bitirmez
    ['Henüz nokta yok. Grafikte ekleyin.', 'Henüz nokta yok. Grafikte ekleyin.'],   // yeni cümle
    ['Yuvarlanma Direnci Katsayısı', 'Yuvarlanma direnci katsayısı'],   // sinyal adı özel ad değil
    ['Adım büyüklüğü Δt [s]', 'Adım büyüklüğü Δt [s]'],       // Yunan harfi sembol
    ['Bu seçim yalnız ▶ Hesapla ile uygulanır.', 'Bu seçim yalnız ▶ Hesapla ile uygulanır.'],   // düğmenin adı
    ['Segmentleri Senaryolar Bileşenine Aktar', 'Segmentleri Senaryolar bileşenine aktar'],   // tek kelimelik bileşen
    ['Governed Speed Eşiği', 'Governed Speed eşiği'],         // İngilizce terim (8·A)
    ['FEAD — Kayış-Kasnak Sistemi', 'FEAD — Kayış-kasnak sistemi'],   // tireli birleşik kelime
    ['Coast-Down Parametreleri', 'Coast-Down parametreleri'], // tireli terimin bütünü (8·A)
    ['Yakınsama · Newton-Raphson', 'Yakınsama · Newton-Raphson'],   // kişi adları
    ['Otomatik → Lineer', 'Otomatik → Lineer'],               // ok sonrası sonucun adı
    ['Efektif Çap', 'Efektif Çap'],                           // defter sütunu
    ['3 · Otomatik Gergi', '3 · Otomatik Gergi'],             // sihirbazın gergi adı
    ['Motor Devri – Araç Hızı', 'Motor devri – Araç hızı'],   // " – " iki büyüklüğü ayırır
    ['Scroll — Yakınlaştır  │  Sağ Tık + Sürükle — Kaydır', 'Scroll — Yakınlaştır  │  Sağ tık + sürükle — Kaydır'],
    ['  │  Motor Gücü (P_engine)    │ ', '  │  Motor gücü (P_engine)    │ '],   // günlük tablosu
    ['Speed Ratio (SR)', 'Speed Ratio (SR)'],                 // İngilizce terim (8·A)
    ['Doğrulanmamıştır (Not 1).', 'Doğrulanmamıştır (Not 1).'],   // numaralı atıf
    ['Kriter 1 ve Kriter 2', 'Kriter 1 ve Kriter 2'],
    ['Küme Takoz Modülüyle Aynıdır', 'Küme Takoz modülüyle aynıdır'],   // modülün adı
    ['Güç / Ağırlık Oranı', 'Güç / ağırlık oranı'],           // " / " bölüt başlatmaz…
    ['Klima / Alternatör / Hava Kompresörü', 'Klima / Alternatör / Hava Kompresörü'],   // …ardındaki bileşen adı kalır
    ['Güç Grubu Müdürlüğü — Görsel Editör', 'Güç Grubu Müdürlüğü — Görsel editör'],   // birim adı
    ['Ag. Merkezi-On Aks (a1)', 'Ag. merkezi-on aks (a1)'],   // ASCII kısaltma cümle bitirmez
    ['Rapor No', 'Rapor No'],                                 // numara kısaltması
    ['Rapor, Çözücü Sonuçlarından Üretilir.', 'Rapor, Çözücü sonuçlarından üretilir.'],   // bileşenin sonuçları
  ])('%s → %s', (a, b) => expect(cumle(a)).toBe(b));

  test('bileşen adları componentDefs\'ten okunuyor — sinyal adları değil', () => {
    expect(BILESEN.length).toBeGreaterThan(40);
    expect(BILESEN).toContain('Klima Kompresörü');
    expect(BILESEN).not.toContain('Yuvarlanma Direnci');
  });

  // Defter sütunları ve gergi adı KAYNAKTAN okunur: liste bulunamazsa koruma
  // sessizce boşalır ve "Efektif Çap" küçülürdü.
  // Sinyal tablosu bileşen tablosuyla aynı dosyada ve ikisi de `name:` yazıyor:
  // okuyucu yalnız bloğun içini almalı, yoksa bileşen adları da "düzeltilirdi".
  test('sinyal adları yalnız sinyal bloklarından okunuyor', () => {
    const src = fs.readFileSync(path.join(KOK, 'js/components.js'), 'utf8');
    const ad = sinyalAdlari(src);
    expect(ad.length).toBeGreaterThan(60);
    expect(ad).toContain('Motor devri');
    expect(ad).not.toContain('Tork Konvertörü');
  });

  // Günlük ve TXT raporu hizası BOŞLUKLA kurulu: dönüşüm uzunluğu değiştirseydi
  // tablo sütunları kayardı. Türkçe küçük harf ('İ' → 'i', 'I' → 'ı') tek karakter.
  test('dönüşüm metnin uzunluğunu korur', () => {
    const t = ['İvme – Araç Hızı', 'Isı Reddi', '  │  Güç Aktarma Kaybı (P_dt) │ ', 'TC Isı Kaybı (P_TC)'];
    t.forEach((x) => expect(cumle(x).length).toBe(x.length));
  });

  // "+ Satır ekle" düğmesi "+" taşıyor ama birleştirme değil; ' + ad + ' ise öyle.
  test('birleştirme süzgeci düğmenin "+"sını atlamıyor; etiket taşıyan dizeyi atlıyor', () => {
    expect(BIRLESTIRME.test('<h3>8.1 Kritik sonuç özeti</h3>')).toBe(true);   // metnini `>…<` tarıyor
    expect(BIRLESTIRME.test('+ Satır Ekle')).toBe(false);
    expect(BIRLESTIRME.test("' + ad + '")).toBe(true);
    expect(BIRLESTIRME.test('Toplam: ' + "' + n")).toBe(true);
  });

  test('defter sütunları ve sihirbazın gergi adı kaynaktan okunuyor', () => {
    expect(DEFTER).toEqual(expect.arrayContaining(['Efektif Çap', 'Kasnak Dönüş Yönü', 'Sarım Açısı', 'Span Uzunluğu']));
    expect(AD).toEqual(['Otomatik Gergi']);
  });
});

function sapmalar(dosyalar) {
  const out = [];
  dosyalar.forEach((f) => new Set(etiketler(f)).forEach((t) => {
    if (cumle(t) !== t) out.push(`${f}: "${t}" → "${cumle(t)}"`);
  }));
  return out;
}
// Etiketin KENDİSİ bir yüzey adıysa büyük yazılır ("Program Durumu" düğmesi).
// Cümle içindeki genel isim ayrı: "Kayış yolu bu yerleşimle çözülemiyor" kayışın
// yolundan söz ediyor, Kayış Yolu kartından değil.
function kucukYuzey(dosyalar) {
  const out = [];
  dosyalar.forEach((f) => etiketler(f).forEach((t) => {
    const k = t.trim().replace(/^[^\p{L}]+/u, '');
    YUZEY.forEach((a) => {
      if (k !== a && k.toLocaleLowerCase('tr') === a.toLocaleLowerCase('tr')) out.push(`${f}: "${t}"`);
    });
  }));
  return [...new Set(out)];
}

const ASAMA3 = ['js/results.js', 'js/sensors.js', 'js/graphics.js',
  'js/cp-fead-report.js', 'js/cp-fead-summary.js', 'js/cp-mount-report.js'];

describe.each([['aşama 1 — kabuk', ASAMA1, 400], ['aşama 2 — bileşen panelleri', ASAMA2, 300],
  ['aşama 3 — Sonuçlar ve raporlar', ASAMA3, 300]])('%s', (ad, dosyalar, enAz) => {
  test('tarama boşa çalışmıyor', () => {
    expect(dosyalar.flatMap(etiketler).length).toBeGreaterThan(enAz);
  });
  test('her çok kelimeli etiket cümle düzeninde (özel adlar hariç)', () => {
    expect(sapmalar(dosyalar)).toEqual([]);
  });
  test('yüzey adı küçültülmüyor ("Program durumu" değil "Program Durumu")', () => {
    expect(kucukYuzey(dosyalar)).toEqual([]);
  });
});

// Kılavuzun sahneleri panel kartını BAŞLIĞIYLA arar (veGuideCard: '>' + başlık
// + '<'). Başlık yalnız bir tarafta değişirse sahne SESSİZCE boş döner — hata
// yok, kılavuzda resim yok.
describe('kılavuz sahneleri panel kartını buluyor', () => {
  const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');
  const PANEL = oku('js/cp-fead.js');
  const arananlar = [...oku('js/guide-fead.js').matchAll(/_gfSahneKart2\('\w+',\s*'([^']+)'/g)].map((m) => m[1]);
  test('en az beş kart aranıyor', () => expect(arananlar.length).toBeGreaterThanOrEqual(5));
  test.each(arananlar)('"%s" panelde kart başlığı', (b) => {
    expect(PANEL.includes("_feadCard('" + b + "'") || PANEL.includes('>' + b + '<')).toBe(true);
  });
});
