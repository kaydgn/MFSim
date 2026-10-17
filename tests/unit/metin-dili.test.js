/**
 * metin-dili.test.js — ARAYÜZ ANLATMAZ (kullanıcı kararı, 2026-10-16)
 * ───────────────────────────────────────────────────────────────────────────
 * Ekranda ve belgede yalnız ad, veri ve durum durur (CLAUDE.md). Kural ve
 * sözlük tek yerde: tools/metin-dili.js.
 *
 * Kapılar:
 *   · sözlük bilinen açıklamaları yakalar; adı, veriyi, durumu işaretlemez
 *   · çıkarma: '+' zinciri tek metin, HTML bölünür, kod dizesi metin değildir
 *   · ürünün tamamında YENİ işaretli metin yok — kuraldan öncekiler tabanda
 *   · taban yalnız küçülür: temizlenen metin tabanda kalmaz
 */
const fs = require('fs');
const path = require('path');
const T = require('../../tools/metin-dili.js');

const KOK = path.join(__dirname, '../..');

describe('sözlük — aday işaretleri', () => {
  test.each([
    ['Nereden başlayalım?', 'sohbet'],
    ['Seçtiğin kapı modeli kurar', 'sohbet'],
    ['kasnak rollerini 3B görüntüleyicide sen ver.', 'sohbet'],
    ['Aynı modelden ikinci bir kart açıp başka katmanlar seçebilirsin.', 'sohbet'],
    ['önerilen', 'sohbet'],
    ['Lütfen şifre giriniz.', 'sohbet'],
    ['Seçtiğiniz dosya okunamadı', 'sohbet'],
    ['Model seçilince eğri burada çizilir.', 'kendi'],
    ['Sayısal karşılığı aşağıdaki tablodadır.', 'kendi'],
    ['Bu pencere programı değiştirmez.', 'kendi'],
    ['Neden ayrıca sorulmuyor', 'gerekce'],
    ['Ayrıca girdi olarak istemek aynı bilgiyi ikinci kez sormak olurdu', 'gerekce'],
    ['çeliştiğinde hiçbir hata çıkmazdı', 'gerekce'],
    ['Kol çalışma açısını program seçmez', 'gerekce'],
    ['Bu bir SEÇİCİ değil, bir KAPIDIR', 'gelistirme'],
    ['Sayfa bir kapı seçilince çekilir.', 'gelistirme'],
    ['(ölçüldü: 4,55e−13 mm)', 'gelistirme'],
    ['Son hesap bayat — model hesaptan sonra değişti', 'gelistirme'],
    ['modlar sessizce yanlış çıkar', 'gelistirme'],
    ['Kayış Yolu kartını boş kur; kasnakları Kayış Tablosu\'ndan ekle.', 'tarif'],
    ['Hizalamak için en az 2 bileşen seçin', 'tarif'],
    ['Model çözümden sonra değişti — yeniden hesaplayın.', 'tarif'],
    ['Kasnakları çizime sürükleyin, sonra tablodan sıralayın.', 'tarif'],
    ['Kayış yolu henüz boş ve model kurulunca her şey çizimde değişir.', 'uzun']
  ])('%p → %s', (metin, isaret) => {
    expect(T.isaretle(metin, 'arayuz')).toContain(isaret);
  });

  test.each([
    'Sihirbazla kur', 'Hesapla', 'Boş çizim masası', 'Gates raporlarından başla', 'Sessize al',
    'Girdi', 'Kasnak girdisi', 'Kayış boyu ve tahrik oranı', 'Ara kademenin çapları eksik.',
    'TEKERLEK GÜCÜ DAĞILIMI (Ortalama)', 'SONUÇ ÖZETİ', 'FEAD · STEP · CATIA', 'Kayma emniyeti 1,2 — sınırın altında',
    'Değişikliği uygulamak için olduğunu varsaydığı değer', 'Kayış yolu kapanmıyor.',
    // etkileşim ipucu kısayol dilinde bir addır
    'Kayış boyu serbest — tıkla: sabit', 'Yön gülü — sürükle: taşı · çift tık: varsayılan yer',
    'Tekerlek: yakınlaştır · Sağ tık + sürükle: kaydır · Esc: kapat',
    // tire ile bağlı bileşik terim emir kipi değildir
    'Boş hücrede son değer (örnekle-ve-tut)'
  ])('%p işaretlenmez', (metin) => {
    expect(T.isaretle(metin, 'arayuz')).toEqual([]);
  });

  test('profil: kılavuz açıklamanın yeridir, belge mühendislik metni taşır', () => {
    const tarif = 'Kayış Yolu kartını boş kur; kasnakları Kayış Tablosu\'ndan ekle ve sonra çöz.';
    expect(T.isaretle(tarif, 'arayuz')).toEqual(expect.arrayContaining(['tarif', 'uzun']));
    expect(T.isaretle(tarif, 'kilavuz')).toEqual([]);
    expect(T.isaretle('Gerginlik açıklık boyunca sabit kabul edilmiş ve sürtünme katsayısı Gates kalibrasyonundandır.', 'belge')).toEqual([]);
    expect(T.isaretle('Kol çalışma açısını program seçmez.', 'kilavuz')).toEqual(['gerekce']);
    expect(T.isaretle('Bu bir SEÇİCİ değil, bir KAPIDIR', 'belge')).toEqual(['gelistirme']);
  });
});

describe('çıkarma', () => {
  const gecici = (ad, icerik) => {
    const f = path.join('tests/fixtures', '_metin-dili-' + ad);
    fs.writeFileSync(path.join(KOK, f), icerik);
    return f;
  };
  afterAll(() => {
    fs.readdirSync(path.join(KOK, 'tests/fixtures')).filter((f) => f.startsWith('_metin-dili-'))
      .forEach((f) => fs.unlinkSync(path.join(KOK, 'tests/fixtures', f)));
  });

  test('+ zinciri tek metin; HTML blok etiketi böler, satır içi etiket bölmez; öznitelik ayrı öğe', () => {
    const f = gecici('a.js', [
      "var h = '<div class=\"x\" title=\"Bu düğme ne yapar diye anlatan uzun bir ipucu cümlesi\">'",
      "  + '<h2>Başlık</h2><p>Kayış <b>gergin</b> taraftan ' + ad + ' kasnağına girer.</p></div>';"
    ].join('\n'));
    const m = T.metinler(f).map((x) => [x.baglam, x.metin]);
    expect(m).toEqual(expect.arrayContaining([
      ['title', 'Bu düğme ne yapar diye anlatan uzun bir ipucu cümlesi'],
      ['metin', 'Başlık'],
      ['metin', 'Kayış gergin taraftan ‹› kasnağına girer.']
    ]));
  });

  test('kod dizesi metin değildir; geri çağırmanın içindeki bildirim metindir', () => {
    const f = gecici('b.js', [
      "console.log('Bu konsol satırı uzun bir açıklama cümlesidir ve sayılmaz');",
      "if (x === 'Bu karşılaştırma da uzun bir cümle gibi görünür ama koddur') {}",
      "var o = { 'Bu anahtar da metin değildir ve sayılmaz hiç': 1 };",
      "el.querySelector('.bu-secici .metin-degil .hic-sayilmaz .uzun-olsa-da');",
      "el.addEventListener('click', function(){ showToast('Kayış Yolu kartını boş kur; kasnakları ekle.'); });",
      "el.setAttribute('title', 'Bu alan seçilince modele yazılır');"
    ].join('\n'));
    const m = T.metinler(f).map((x) => [x.baglam, x.metin]);
    expect(m).toEqual([
      ['bildirim', 'Kayış Yolu kartını boş kur; kasnakları ekle.'],
      ['title', 'Bu alan seçilince modele yazılır']
    ]);
  });

  test('dize içindeki stil, betik ve CSS yorumu metin değildir', () => {
    const f = gecici('c.js', "var d = '<style>/* Bu yorum cümlesi sayılmaz hiçbir zaman */ p{margin:0}</style><p>Gövde</p>';");
    expect(T.metinler(f).map((x) => x.metin)).toEqual(['Gövde']);
  });
});

describe('kapsam', () => {
  test('istisna listesindeki her dosya diskte var; js/ altındaki öteki her dosya kapsamda', () => {
    Object.keys(T.ISTISNA).forEach((f) => expect(fs.existsSync(path.join(KOK, f))).toBe(true));
    const k = new Set(T.kapsam());
    fs.readdirSync(path.join(KOK, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f)
      .filter((f) => !T.ISTISNA[f]).forEach((f) => expect(k.has(f)).toBe(true));
    ['index.html', 'viewer/index.html', 'candbc/index.html', 'viewer/js/app.js', 'candbc/js/can-app.js']
      .forEach((f) => expect(k.has(f)).toBe(true));
  });
});

describe('cırcır — taban yalnız küçülür', () => {
  const taban = T.tabanOku();
  const simdi = T.isaretliler();
  const yaz = (x) => x.dosya + ':' + x.satir + ' [' + x.isaret.join(' ') + '] ' + x.metin.slice(0, 140);

  test('taban dosyası var ve boş değil', () => {
    expect(fs.existsSync(T.TABAN)).toBe(true);
    expect(Object.keys(taban).length).toBeGreaterThan(0);
  });

  test('yeni işaretli metin yok (ARAYÜZ ANLATMAZ — CLAUDE.md)', () => {
    const yeni = simdi.filter((x) => !(taban[x.dosya] && Object.prototype.hasOwnProperty.call(taban[x.dosya], x.id)));
    if (yeni.length) {
      throw new Error(yeni.length + ' yeni işaretli metin — ekranda ve belgede yalnız ad, veri, durum:\n  '
        + yeni.map(yaz).join('\n  ')
        + '\n\nMetin bir ad, veri ya da durum değilse kaldır; durumsa kısalt ve tarifini çıkar.'
        + '\nİşaret yanlışsa sözlüğü (tools/metin-dili.js) düzelt; kullanıcı "kalsın" dediyse: node tools/metin-dili.js --taban --kabul');
    }
  });

  test('taban bayat değil: temizlenen metin tabandan düşmüş', () => {
    const var_ = new Set(simdi.map((x) => x.dosya + ' ' + x.id));
    const bayat = [];
    Object.entries(taban).forEach(([f, kayit]) => Object.entries(kayit).forEach(([id, onizleme]) => {
      if (!var_.has(f + ' ' + id)) bayat.push(f + ' ' + id + ' ' + onizleme);
    }));
    if (bayat.length) {
      throw new Error(bayat.length + ' kayıt artık kaynakta yok — tabanı küçült: node tools/metin-dili.js --taban\n  '
        + bayat.slice(0, 40).join('\n  '));
    }
  });
});
