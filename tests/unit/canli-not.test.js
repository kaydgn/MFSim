/**
 * Canlı Not — tools/canli-not-cekirdek.js · tools/canli-not-kopru.js · tools/canli-not.js
 *
 * Kullanıcı programı claude.ai'da açar, üstüne çizer ve notu yazar; Claude
 * notu kayıttan okur, ekranı yeniden çizer ve sırayla uygular. Buradaki her
 * hata SESSİZDİR: yanlış öğe seçilirse Claude yanlış yeri değiştirir, yol
 * verisi ayrışırsa yeniden çizilen ekran kullanıcınınkiyle örtüşmez, onay
 * köprüsü bozulursa programın düğmesi claude.ai'da hiçbir şey yapmaz.
 *
 *   ÇİZİM      şeklin yol verisi ve kutusu (sayfa ile aracın ortak dili)
 *   YER        notun yer özeti, Claude'a giden yorumun sınırı
 *   DOĞRULAMA  bozuk not sessizce çizilmez; sıra
 *   KATEGORİ   Notlar listesi durumdan türeyen bölümlere ayrılır (girdi bekleniyor ·
 *              uygulanıyor · uygulanacak · uygulanan); hiçbir not düşmez
 *   SEÇİM      çevrelenen öğe arka plandan önce, okun ucu, başlığın yönü
 *   KÜNYE      görünen değer (Türkçe sayı alanı), CSS yolu
 *   FOTOĞRAF   betiksiz, canlı değerli, özgün belgeye dokunmaz
 *   BAĞLAM     programın global durumu
 *   ONAY       confirm/prompt sayfada sorulur; kabul tek kullanımlık
 *   YAYIN      köprü <meta charset>'ın arkasında; şablonun çapaları
 *   GÜNCELLİK  yayındaki künye ↔ ana dal; paketin girdileri build.js'in okuduğu
 *              her yolu kapsar (kapsamasaydı denetim değişen programa "aynı" derdi)
 *   GÜNCELLEME program kayıttaki yayından (yayin/son); açık sayfa kendiliğinden
 *              YENİLENMEZ, pencere sorar, Güncelle yükler; notta sonucun görüntüsü
 *   PARÇALI YAYIN  program yuvalara ayrılır (kod + uzun satırlar), geri kurma bire
 *              bir; değişmeyen yuva yeniden yüklenmez ve indirilmez; sayfa program gömmez
 *   İKİ KAPI   tek yazar (yalnız oturum/aktif yayınlar) · sıra (yayın geri gitmez)
 *   ÇAĞRI      sayfa BAĞLI oturumu Claude'a giden bir yorumla uyandırır (oturum açamaz); oturum
 *              geldiğini sahiplik kaydını yeniden yazarak söyler (iki saat karşılaştırılmaz)
 *   SONUÇ      `sonuc` komutu (her oturumun aynı kalıbı): bayraklar sessizce
 *              yutulmaz; giriş js/auth.js'in özetinden, modülün açıcısı programda var
 *   ODAK       bir bileşene ayrılmış sayfa: tarifin dokunduğu her işlev programda var,
 *              tarif yerindekini kullanır, proje önce yüklenir; not numarası aralıkta
 */
const fs = require('fs');
const path = require('path');
const CN = require('../../tools/canli-not-cekirdek.js');
const K = require('../../tools/canli-not-kopru.js');
const T = require('../../tools/canli-not.js');

const KOK = path.join(__dirname, '..', '..');

// ═══ ÇİZİM ═════════════════════════════════════════════════════════════════
describe('ÇİZİM — şeklin yol verisi ve kutusu', () => {
  test('kalem: doğru üstündeki noktalar seyrelir, iki uç kalır, kutu ham noktalardan', () => {
    const nok = [];
    for (let x = 0; x <= 100; x += 2) nok.push([x, 10]);
    nok.push([100, 60]);
    const s = CN.sekilKur('kalem', nok);
    expect(s.d.startsWith('M 0 10')).toBe(true);
    expect(s.d.split(' L ').length).toBe(3);   // (0,10) → (100,10) → (100,60)
    expect(s.kutu).toEqual([0, 10, 100, 50]);
  });

  test('daire ve kutu: sürükleme yönünden bağımsız aynı kutu', () => {
    const a = CN.sekilKur('kutu', [[50, 80], [10, 20]]);
    const b = CN.sekilKur('kutu', [[10, 20], [50, 80]]);
    expect(a.kutu).toEqual([10, 20, 40, 60]);
    expect(a.d).toBe(b.d);
    const d = CN.sekilKur('daire', [[10, 20], [50, 80]]);
    expect(d.kutu).toEqual([10, 20, 40, 60]);
    expect((d.d.match(/ A /g) || []).length).toBe(2);
  });

  test('ok: uç SON noktada; bölge sayılmaz, ucu ayrıca okunur', () => {
    const ok = CN.sekilKur('ok', [[200, 10], [40, 90]]);
    expect(ok.uc).toEqual([40, 90]);
    const daire = CN.sekilKur('daire', [[0, 0], [30, 30]]);
    expect(CN.bolgeler([ok, daire])).toEqual([daire.kutu]);
    expect(CN.uclar([ok, daire])).toEqual([[40, 90]]);
  });

  test('kutu birleşimi; şekilsiz taslak bölgesizdir', () => {
    expect(CN.kutuBirlesim([])).toBeNull();
    const s = [CN.sekilKur('kutu', [[10, 10], [20, 20]]), CN.sekilKur('kutu', [[50, 5], [60, 40]])];
    expect(CN.kutuBirlesim(s)).toEqual([10, 5, 50, 35]);
  });

  test('bilinmeyen araç SESSİZCE çizilmez', () => {
    expect(() => CN.sekilKur('silgi', [[0, 0]])).toThrow(/bilinmeyen araç/);
  });
});

// ═══ YER ═══════════════════════════════════════════════════════════════════
describe('YER — notun yer özeti ve yorum metni', () => {
  test('modül + son iki başlık; sayfanın adı ve tekrar düşer', () => {
    expect(CN.yerOzeti({ sayfa: 'arac-performans', kapsam: 'fead-analysis' },
      { basliklar: ['Topoloji', 'Kasnak', 'Kasnak', 'Geometri'] })).toBe('FEAD › Kasnak › Geometri');
    expect(CN.yerOzeti({ sayfa: 'sonuclar', kapsam: 'mount-analysis' }, { basliklar: ['Sonuçlar', 'Föy'] }))
      .toBe('Sonuçlar › Föy');
  });

  test('başlık yoksa açık pencere, o da yoksa pencerenin konusu, en son sayfa', () => {
    expect(CN.yerOzeti({ kapsam: 'top', pencereler: ['Ayarlar'] }, {})).toBe('Ayarlar');
    expect(CN.yerOzeti({ kapsam: 'mount-analysis', konu: { ad: 'Motor' } }, {})).toBe('Takoz › Motor');
    expect(CN.yerOzeti({ sayfa: 'arac-performans' }, {})).toBe('Topoloji');
  });

  test('yorum: ilk satır numara ve yer; çok baytlı metin sınırda kesilir', () => {
    const kisa = CN.yorumMetni({ no: 4, yer: 'FEAD › Kayış Tablosu', metin: ' Sütunu daralt. ' });
    expect(kisa).toBe('Not 4 · FEAD › Kayış Tablosu\nSütunu daralt.');
    const uzun = CN.yorumMetni({ no: 1, yer: 'Ş', metin: 'ğüşıöç'.repeat(2000) });
    expect(CN.baytBoyu(uzun)).toBeLessThanOrEqual(CN.YORUM_SINIR);
    expect(uzun.endsWith('…')).toBe(true);
  });
});

// ═══ DOĞRULAMA ═════════════════════════════════════════════════════════════
describe('DOĞRULAMA — bozuk not çizilmez, sıra korunur', () => {
  const gecerli = () => ({
    no: 1, sira: 5, metin: 'x', durum: 'bekliyor',
    cizim: { g: 800, y: 600, sekiller: [CN.sekilKur('kutu', [[1, 1], [9, 9]])] }
  });
  test('geçerli not geçer, eksikler adıyla söylenir', () => {
    expect(CN.notDogrula(gecerli())).toEqual([]);
    const n = gecerli(); n.durum = 'bitti'; n.metin = ' '; n.cizim.sekiller = [{ arac: 'kutu', d: 'x' }];
    const h = CN.notDogrula(n).join(' · ');
    expect(h).toMatch(/durum/); expect(h).toMatch(/metin/); expect(h).toMatch(/şekil 1/);
    expect(CN.notDogrula({ no: 2, sira: 1, metin: 'a', durum: 'soru' }).join()).toMatch(/çizim yok/);
  });
  test('sıra: önce `sira`, eşitse numara', () => {
    const l = [{ no: 3, sira: 20 }, { no: 2, sira: 10 }, { no: 1, sira: 10 }];
    expect(CN.siraliNotlar(l).map((n) => n.no)).toEqual([1, 2, 3]);
  });
  // Kullanıcı 2026-11-05: "Yeni güncellemeler en alta geliyor. Onu düzeltelim, en son
  // güncellemeler en tepeden başlasın." Sayfanın listesi yeniden eskiye; iş kuyruğu
  // (`liste`) eskiden yeniye kalır — notlar sırayla uygulanır.
  test('sayfanın listesi yeniden eskiye; iş sırası eskiden yeniye', () => {
    const l = [{ no: 3, sira: 20 }, { no: 2, sira: 10 }, { no: 1, sira: 10 }, { no: 4, sira: 30 }];
    expect(CN.yenidenEskiye(l).map((n) => n.no)).toEqual([4, 3, 2, 1]);
    expect(CN.siraliNotlar(l).map((n) => n.no)).toEqual([1, 2, 3, 4]);
    expect(l.map((n) => n.no)).toEqual([3, 2, 1, 4]);              // girdi değişmez
  });
});

// ═══ KATEGORİ ══════════════════════════════════════════════════════════════
// Kullanıcı 2026-11-10: "Notlar içine 'uygulanan' 'uygulanıyor' 'uygulanacak' 'girdi
// bekleniyor' gibi kategoriler koyalım. Notları takip ederiz." Kategori notun
// DURUMUNDAN türer; hata sessiz olurdu — bir not hiçbir bölümde görünmezse kullanıcı
// o notun kaybolduğunu sanır.
describe('KATEGORİ — Notlar listesi durumdan türeyen bölümlere ayrılır', () => {
  const n = (no, durum) => ({ no, sira: no, durum });
  test('sıra dikkat sırası; her not tek kategoride, kategoride yeniden eskiye; girdi değişmez', () => {
    const l = [n(1, 'uygulandi'), n(2, 'bekliyor'), n(3, 'uygulaniyor'), n(4, 'soru'), n(5, 'uygulandi'), n(6, 'bekliyor')];
    const k = CN.kategorile(l);
    expect(k.map((x) => x.ad)).toEqual(['Girdi bekleniyor', 'Uygulanıyor', 'Uygulanacak', 'Uygulanan', 'İptal', 'Diğer']);
    expect(k.map((x) => x.notlar.map((m) => m.no))).toEqual([[4], [3], [6, 2], [5, 1], [], []]);
    expect(l.map((m) => m.no)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('tanınmayan durum düşmez (Diğer); İptal ve Diğer boşken gizli, dört ana kategori hep var', () => {
    const k = CN.kategorile([n(1, 'bitti'), n(2, 'iptal')]);
    expect(k.find((x) => x.kod === 'diger').notlar.map((m) => m.no)).toEqual([1]);
    expect(k.find((x) => x.kod === 'iptal').notlar.map((m) => m.no)).toEqual([2]);
    const bos = CN.kategorile([]);
    expect(bos.filter((x) => !x.bosGizli).map((x) => x.kod)).toEqual(['girdi', 'uygulaniyor', 'uygulanacak', 'uygulanan']);
    expect(bos.every((x) => x.notlar.length === 0)).toBe(true);
  });

  test('her durum bir kategoriye bağlı (yeni durum eklenirse bu test söyler); açık not = kuyruk · işlenen · girdi bekleyen', () => {
    const baglanan = [].concat(...CN.KATEGORILER.map((k) => k.durumlar)).sort();
    expect(baglanan).toEqual(Object.keys(CN.DURUMLAR).sort());
    ['bekliyor', 'uygulaniyor', 'soru'].forEach((d) => expect(CN.acikNot(n(1, d))).toBe(true));
    ['uygulandi', 'iptal'].forEach((d) => expect(CN.acikNot(n(1, d))).toBe(false));
  });
});

// ═══ SEÇİM ═════════════════════════════════════════════════════════════════
// jsdom yerleşim yapmaz: kutular ve "noktadaki öğe" elle verilir.
function sahne() {
  document.body.innerHTML =
    '<section id="pen" aria-label="Kayış Özellikleri">' +
    '  <h3 id="hA">Geometri</h3>' +
    '  <div class="satir" id="satirA"><button id="kaydet">Kaydet<span id="ic">!</span></button></div>' +
    '  <h3 id="hB">Sonuç</h3>' +
    '  <div class="satir" id="satirB"><span id="deger">12,5</span></div>' +
    '</section>';
  const kutular = {
    pen: [0, 0, 800, 600], hA: [10, 10, 300, 20], satirA: [10, 40, 780, 40], kaydet: [100, 45, 80, 30],
    ic: [160, 50, 10, 20], hB: [10, 300, 300, 20], satirB: [10, 330, 780, 40], deger: [400, 335, 60, 30]
  };
  const kutuAl = (el) => { const k = kutular[el.id] || [0, 0, 0, 0]; return { left: k[0], top: k[1], width: k[2], height: k[3] }; };
  // En üstteki öğe: noktayı içeren EN KÜÇÜK kutu (yığın düzeni).
  const noktada = (x, y) => Object.keys(kutular)
    .filter((id) => { const k = kutular[id]; return x >= k[0] && x <= k[0] + k[2] && y >= k[1] && y <= k[1] + k[3]; })
    .sort((a, b) => kutular[a][2] * kutular[a][3] - kutular[b][2] * kutular[b][3])
    .map((id) => document.getElementById(id));
  return { kutuAl, noktada };
}

describe('SEÇİM — çizilen bölgenin altındaki öğeler', () => {
  test('çevrelenen düğme arka plandan ÖNCE; kap ve başlık zinciri', () => {
    const { kutuAl, noktada } = sahne();
    const s = K.ogeleriSec(document, [[90, 38, 100, 44]], { kutuAl, noktada });
    expect(s.ic[0].id).toBe('kaydet');
    expect(s.ic[0].ic).toBe(100);
    expect(s.ic.map((k) => k.id)).not.toContain('pen');
    expect(s.kap.id).toBe('satirA');   // kimlikli en yakın kap
    // Hedefin ÖNÜNDEKİ başlık sayılır; sonraki bölümün başlığı ("Sonuç") değil.
    expect(s.basliklar).toEqual(['Kayış Özellikleri', 'Geometri']);
  });

  test('okun ucu ayrı okunur; gövdesi bölge sayılmaz', () => {
    const { kutuAl, noktada } = sahne();
    const s = K.ogeleriSec(document, [], { kutuAl, noktada, uclar: [[420, 350]] });
    expect(s.ok.map((k) => k.id)).toEqual(['deger']);
    expect(s.ic).toBeUndefined();
    expect(s.basliklar).toEqual(['Kayış Özellikleri', 'Sonuç']);
  });

  test('anlamlı ata: kimliksiz, metinsiz sarmalayıcı atlanır', () => {
    document.body.innerHTML = '<div id="kok"><div><div><i></i></div></div></div>';
    const i = document.querySelector('i');
    expect(K.anlamliAta(i).id).toBe('kok');
  });
});

// ═══ KÜNYE ═════════════════════════════════════════════════════════════════
describe('KÜNYE — öğenin aranabilir izi', () => {
  test('Türkçe sayı alanının GÖRÜNEN değeri okunur (js/sayi-alan.js .value\'yu çeviriyor)', () => {
    document.body.innerHTML = '<input id="boy" inputmode="decimal" data-alan="L" data-birim="mm">';
    const el = document.getElementById('boy');
    el.value = '1716,25';
    Object.defineProperty(el, 'value', { configurable: true, get: () => '1716.25', set: () => {} });
    const k = K.kunye(el);
    expect(k.deger).toBe('1716,25');
    expect(k.data).toEqual({ alan: 'L', birim: 'mm' });
  });

  test('onay kutusu işaretiyle; CSS yolu en yakın kimlikte durur', () => {
    document.body.innerHTML = '<div id="p"><ul><li>a</li><li><input type="checkbox" checked></li></ul></div>';
    const k = K.kunye(document.querySelector('input'));
    expect(k.isaretli).toBe(true);
    expect(k.yol).toBe('#p > ul > li:nth-of-type(2) > input');
  });
});

// ═══ FOTOĞRAF ══════════════════════════════════════════════════════════════
describe('FOTOĞRAF — DOM\'un o anki hâli', () => {
  test('betiksiz, canlı değerli, kaydırma işaretli; özgün belgeye dokunmaz', () => {
    document.body.innerHTML =
      '<script>window.__x = 1;</script>' +
      '<input id="a" value="eski"><textarea id="t">eski</textarea>' +
      '<select id="s"><option>bir</option><option>iki</option></select>' +
      '<div id="liste" style="overflow:auto;height:20px"><p>1</p><p>2</p></div>';
    document.getElementById('a').value = 'yeni';
    document.getElementById('t').value = 'yeni metin';
    document.getElementById('s').selectedIndex = 1;
    document.getElementById('liste').scrollTop = 40;
    const html = K.foto(document);
    expect(document.querySelectorAll('script').length).toBe(1);
    const d = new DOMParser().parseFromString(html, 'text/html');
    expect(d.querySelectorAll('script').length).toBe(0);
    expect(d.getElementById('a').getAttribute('value')).toBe('yeni');
    expect(d.getElementById('t').textContent).toBe('yeni metin');
    expect(d.querySelectorAll('#s option')[1].hasAttribute('selected')).toBe(true);
    expect(d.getElementById('liste').getAttribute('data-cn-kaydir')).toBe('0,40');
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });
});

// ═══ BAĞLAM ════════════════════════════════════════════════════════════════
describe('BAĞLAM — programın global durumu', () => {
  test('sürüm, sayfa, kapsam, derinlik, konu ve açık pencereler', () => {
    document.body.innerHTML = '<div class="ve-settings-header">Kasnak · K1</div><div class="ve-settings-header">Gizli</div>';
    const [acik] = document.querySelectorAll('.ve-settings-header');
    const win = {
      document, innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1.25,
      __MFSIM_BUILD: { shortSha: 'abc1234', prNumber: 12 },
      currentSubTab: 'arac-performans', veSidebarScope: 'fead-analysis', veActiveModule: 'full-throttle',
      veFeadStack: [{}], veMntStack: [], veTabs: [{ name: 'Topoloji 1' }], veActiveTabIdx: 0,
      veMufettisKonusu: () => ({ id: 'n7', type: 'fead-pulley', customName: '' }),
      componentDefs: { 'fead-pulley': { name: 'Kasnak' } }
    };
    const b = K.baglam(win, { gorunur: (el) => el === acik });
    expect(b).toMatchObject({
      surum: 'abc1234', pr: 12, sayfa: 'arac-performans', kapsam: 'fead-analysis',
      derinlik: { fead: 1 }, sekme: 'Topoloji 1',
      konu: { tip: 'fead-pulley', ad: 'Kasnak', id: 'n7' },
      pencereler: ['Kasnak · K1'], ekran: { g: 1600, y: 900, dpr: 1.25 }
    });
    expect(b.derinlik.takoz).toBeUndefined();
  });
});

// ═══ ONAY ve İNDİRME ═══════════════════════════════════════════════════════
// claude.ai çerçevesi confirm()'ü hep false döndürüyor: köprü soruyu sayfaya
// taşır, kabulden sonra AYNI soru 15 sn içinde bir kez true alır.
describe('ONAY — confirm/prompt sayfada sorulur', () => {
  function kurulu() {
    const fr = document.createElement('iframe');
    document.body.appendChild(fr);
    const w = fr.contentWindow;
    w.URL.createObjectURL = () => 'blob:cn-test';
    K.kur(w);
    const gelen = [];
    const dinle = (e) => { if (e.data && e.data.cn === 1) gelen.push(e.data); };
    window.addEventListener('message', dinle);
    const istek = (ad, veri) => w.dispatchEvent(new w.MessageEvent('message', {
      data: { cn: 1, tur: 'istek', ad, no: 9, veri }, source: window
    }));
    const bekle = () => new Promise((r) => setTimeout(r, 20));
    return { w, gelen, istek, bekle, kapat: () => window.removeEventListener('message', dinle) };
  }

  test('ilk çağrı false döner ve soruyu yollar; kabulden sonra bir kez true', async () => {
    const { w, gelen, istek, bekle, kapat } = kurulu();
    expect(w.confirm('Örnek silinsin mi?')).toBe(false);
    await bekle();
    const soru = gelen.find((m) => m.ad === 'onay');
    expect(soru.veri).toMatchObject({ tur: 'confirm', mesaj: 'Örnek silinsin mi?', tekrar: false });
    istek('onay', { kabul: true });
    await bekle();
    expect(w.confirm('Başka soru')).toBe(false);          // kabul o soruya ait
    expect(w.confirm('Örnek silinsin mi?')).toBe(true);   // yinelenen işlem geçer
    expect(w.confirm('Örnek silinsin mi?')).toBe(false);  // bir kez
    kapat();
  });

  test('prompt: kabulün değeri döner, ret hiçbir şey vermez', async () => {
    const { w, istek, bekle, kapat } = kurulu();
    expect(w.prompt('Sekme adı:', 'Topoloji 1')).toBeNull();
    istek('onay', { kabul: true, deger: 'Kamyon' });
    await bekle();
    expect(w.prompt('Sekme adı:', 'Topoloji 1')).toBe('Kamyon');
    expect(w.prompt('Sekme adı:', 'Topoloji 1')).toBeNull();   // tek kullanımlık
    istek('onay', { kabul: false });
    await bekle();
    expect(w.prompt('Sekme adı:', 'x')).toBeNull();
    kapat();
  });

  test('indirme: blob bağlantısı sayfaya gider, kaydet penceresi kapanır', async () => {
    const { w, gelen, bekle, kapat } = kurulu();
    expect(w.showSaveFilePicker).toBeUndefined();
    const blob = new w.Blob(['{"a":1}'], { type: 'application/json' });
    const a = w.document.createElement('a');
    a.href = w.URL.createObjectURL(blob);
    a.download = 'proje.json';
    a.click();
    await bekle();
    const ind = gelen.find((m) => m.ad === 'indir');
    expect(ind.veri.ad).toBe('proje.json');
    expect(ind.veri.veri.size).toBe(7);
    kapat();
  });
});

// ═══ YAYIN ═════════════════════════════════════════════════════════════════
describe('YAYIN — köprü ve sayfa', () => {
  test('köprü <meta charset>\'ın ARKASINA girer (kodlama ilk 1024 baytta aranır)', () => {
    const html = '<!DOCTYPE html>\n<html><head>\n<meta charset="UTF-8" />\n<title>x</title></head><body></body></html>';
    const cikti = T.kopruGom(html, 'var a = "</script>";');
    expect(cikti.indexOf('<meta charset')).toBeLessThan(cikti.indexOf('canli-not köprüsü'));
    expect(cikti).toContain('<\\/script>');
    expect(() => T.kopruGom('<html><head><title>x</title></head></html>', '')).toThrow(/charset/);
  });

  test('gerçek index.html\'de charset ilk 1024 baytta (yayın bunu varsayıyor)', () => {
    const index = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
    expect(() => T.kopruGom(index, '1')).not.toThrow();
  });

  test('şablonun iki çapası var; ayar ve çekirdek yerine girer, $ dizileri genişlemez', () => {
    const sablon = fs.readFileSync(path.join(KOK, 'tools', 'canli-not.html'), 'utf8');
    expect(sablon).toContain(T.CEKIRDEK_CAPA);
    expect(sablon).toContain(T.AYAR_CAPA);
    const s = T.sayfaKur(sablon, 'window.CanliNot = {}; // $& $1', { surum: 'abc', pr: 7 });
    expect(s).toContain('// $& $1');
    expect(s).toContain('{"surum":"abc","pr":7}');
    expect(s).not.toContain(T.AYAR_CAPA);
  });

  test('sayfa, köprünün verdiği bütün olayları karşılar', () => {
    const sablon = fs.readFileSync(path.join(KOK, 'tools', 'canli-not.html'), 'utf8');
    const kopru = fs.readFileSync(path.join(KOK, 'tools', 'canli-not-kopru.js'), 'utf8');
    const olaylar = [...kopru.matchAll(/yolla\('olay', '([a-z-]+)'/g)].map((m) => m[1]);
    expect(olaylar.sort()).toEqual(['basladi', 'hazir', 'indir', 'kisayol', 'onay', 'uyari']);
    olaylar.forEach((ad) => expect(sablon).toContain("ad === '" + ad + "'"));
    const istekler = [...sablon.matchAll(/kopru\('([a-z]+)'/g)].map((m) => m[1]);
    new Set(istekler).forEach((ad) => expect(kopru).toContain("m.ad === '" + ad + "'"));
  });

  test('döküm iki biçimde de okunur (sarmalı ve çıplak)', () => {
    expect(T.govde({ id: 'n1', version: 3, data: { no: 1, metin: 'a' } })).toEqual({ no: 1, metin: 'a', id: 'n1', __surum: 3 });
    expect(T.govde({ no: 2, metin: 'b' })).toEqual({ no: 2, metin: 'b' });
  });

});

// ═══ GÜNCELLİK ═════════════════════════════════════════════════════════════
// Kullanıcı 2026-11-05: "güncelliğinden emin olalım, öyle devam edelim".
// SAYFA PROGRAM GÖMMEZ (2026-11-11, parçalı yayın): gömülü kopya 16 MB'a sığmıyordu ve
// eskiyordu; program hep kayıttaki yayından yüklenir. `sayfa` yalnız sayfayı kurar —
// şablon ve çekirdek bugünkü, ayar sayfanın KENDİ künyesi.
describe('SAYFA — yalnız sayfa kurulur, program gömülmez', () => {
  test('sayfa bugünkü şablon ve çekirdekle; ayar sayfanın künyesi; yayın dosyasız', () => {
    const os = require('os');
    const sablon = fs.readFileSync(path.join(KOK, 'tools', 'canli-not.html'), 'utf8');
    const cekirdek = fs.readFileSync(path.join(KOK, 'tools', 'canli-not-cekirdek.js'), 'utf8');
    const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-sayfa-'));
    const cikti = [];
    const gunluk = jest.spyOn(console, 'log').mockImplementation((m) => cikti.push(String(m)));
    let r;
    try { r = T.sayfaYayini({ konum: [], dal: true, cikti: dizin }); } finally { gunluk.mockRestore(); }
    const yeni = fs.readFileSync(r.sayfa, 'utf8');
    expect(T.sayfaHukmu(yeni, sablon, cekirdek)).toEqual({ guncel: true, ayar: r.ayar });
    expect(Object.keys(r.ayar).sort()).toEqual(['pr', 'surum', 'zaman']);          // gömülü programın boyutu yok
    expect(fs.readdirSync(dizin)).toEqual(['canli-not.html']);                     // program derlenmedi, gömülmedi
    expect(cikti.join('\n')).toMatch(/files YOK/);
    expect(sablon).not.toContain('mfsim.html');                                    // sayfa gömülü dosyaya başvurmaz
    expect(r.boyut).toBeLessThan(16 * 1048576);
  });
});

describe('GÜNCELLİK — yayındaki program ana dalın kendisi mi', () => {
  test('künye build.js\'in yazdığı biçimden geri okunur (</script> kaçışı dâhil)', () => {
    const kunye = { sha: 'a'.repeat(40), shortSha: 'aaaaaaa', branch: 'main', prNumber: 1240, prTitle: 'x </script> y' };
    // build.js'in gömme satırının aynısı
    const html = '<script>window.__MNT_TOPOLOGIES = {};\n' +
      'window.__MFSIM_BUILD = ' + JSON.stringify(kunye).replace(/</g, '\\u003c') + ';\n' +
      'window.__MFSIM_KARSILAMA = {};</script>';
    expect(T.kunyeOku(html)).toEqual(kunye);
    expect(() => T.kunyeOku('<html></html>')).toThrow(/künye/);
  });

  test('hüküm: aynı sha güncel; girdi değiştiyse yayınla; yalnız künye eskiyse yayınlama', () => {
    const a = 'a'.repeat(40), b = 'b'.repeat(40);
    expect(T.guncellikHukmu(a, a, [], [])).toEqual({ durum: 'guncel', yayinla: false });
    expect(T.guncellikHukmu(a, b, ['b1 Merge #2'], ['js/cp-fead.js'])).toMatchObject({ durum: 'program', yayinla: true });
    expect(T.guncellikHukmu(a, b, ['b1 Merge #2'], [])).toMatchObject({ durum: 'kunye', yayinla: false });
    // yayındaki commit sığ klonda yok: bilinmeyen eski sayılır, yayınlanır
    expect(T.guncellikHukmu(a, b, [], null)).toMatchObject({ durum: 'bilinmiyor', yayinla: true });
  });

  test('paketin girdileri build.js\'in okuduğu HER yolu kapsar', () => {
    const build = fs.readFileSync(path.join(KOK, 'build.js'), 'utf8');
    const yollar = new Set();
    for (const m of build.matchAll(/path\.join\(ROOT,\s*((?:'[^']+'\s*,?\s*)+)\)/g)) {
      yollar.add([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).join('/'));
    }
    for (const m of build.matchAll(/require\('\.\/([^']+)'\)/g)) yollar.add(m[1]);
    const index = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
    for (const m of index.matchAll(/(?:src|href)="((?:js|css|vendor)\/[^"]+)"/g)) yollar.add(m[1]);
    const disarida = ['MFSim_Code.html', 'assets/karsilama'];   // çıktı · bu yayında gömülmeyen kareler
    const kapsanmayan = [...yollar].filter((y) => !disarida.includes(y) &&
      !T.GIRDILER.some((g) => y === g || y.startsWith(g + '/')));
    expect(kapsanmayan).toEqual([]);
    expect(yollar.size).toBeGreaterThan(20);   // tarama gerçekten bir şey buldu
    // Programa giren Canlı Not dosyaları girdi (paketleyici, köprü); sayfanın dosyaları
    // DEĞİL — sayfa değişikliği programın yayınını istemez (2026-11-11: #1340 kilit
    // değişikliğinden sonra hüküm "programı güncelle" diyordu, program aynıydı).
    ['tools/canli-not-kopru.js', 'tools/canli-not.js'].forEach((f) => expect(T.GIRDILER).toContain(f));
    ['tools/canli-not.html', 'tools/canli-not-cekirdek.js'].forEach((f) => expect(T.GIRDILER).not.toContain(f));
    const pkt = fs.readFileSync(path.join(KOK, 'tools', 'canli-not.js'), 'utf8');
    expect(pkt).toMatch(/const html = kopruGom\(fs\.readFileSync\(mfsim, 'utf8'\), fs\.readFileSync\(KOPRU, 'utf8'\)\);/);
  });

  test('--dal bayrağı tanınır, bilinmeyen bayrak SESSİZCE yutulmaz', () => {
    expect(T.ayristir(['hazirla', '--dal']).dal).toBe(true);
    expect(T.ayristir(['denetle', 'x.html']).konum).toEqual(['x.html']);
    expect(() => T.ayristir(['hazirla', '--zorla'])).toThrow(/bilinmeyen bayrak/);
  });
});

// ═══ GÜNCELLEME ════════════════════════════════════════════════════════════
// Kullanıcı 2026-11-05: "artifaktı otomatik olarak yenileme, güncellemeleri
// 'Notlar' kısmından göster, oraya ufak bir ekran görüntüsü alıp resim koy …
// güncelleme geldiğinde uyarı popup çıkar, oradan güncelle dediğimde HTML'i
// yenilersin." Eskiden her yayın açık görünümü kendiliğinden tazeliyordu.
describe('GÜNCELLEME — yayın kaydı, pencere, sonucun görüntüsü', () => {
  const ID = (c) => c.repeat(32);
  const yayinB = (surum, id, notlar) => ({ surum, sha: surum + '0'.repeat(33), pr: 1300, program: { id, boyut: 9 }, notlar });

  test('yayın kaydı: kısa sha + varlık kimliği; bozuk kayıt güncelleme sayılmaz', () => {
    expect(CN.yayinDogrula(yayinB('abcdef1', ID('a'), [6, 8]))).toEqual([]);
    expect(CN.yayinDogrula({ surum: 'xyz', program: { id: 'kisa' } }).join(' · ')).toMatch(/surum.*program\.id/);
    expect(CN.yayinDogrula(yayinB('abcdef1', ID('a'), [0])).join()).toMatch(/notlar/);
    expect(CN.guncellemeVar({ surum: 'abcdef1', program: { id: 'x' } }, 'bbbbbbb', '')).toBe(false);
  });

  test('programın kaynağı kayıttaki yayın: parçalı ya da tek varlık; geçerli yayın yoksa program da yok', () => {
    expect(CN.programKaynagi(yayinB('abcdef2', ID('b')))).toEqual({ tur: 'varlik', id: ID('b'), surum: 'abcdef2', pr: 1300 });
    const parcalar = [{ yuva: 0, id: ID('a'), ozet: 'o0', sik: 'gzip' }, { yuva: 1, id: ID('b'), ozet: 'o1', sik: 'yok' }];
    expect(CN.programKaynagi({ surum: 'abcdef3', pr: 1301, program: { boyut: 9, uzunluk: 7, parcalar } }))
      .toEqual({ tur: 'parcali', parcalar, uzunluk: 7, surum: 'abcdef3', pr: 1301 });
    expect(CN.programKaynagi(null)).toEqual({ tur: 'yok' });
    expect(CN.programKaynagi({ surum: 'abcdef2' })).toEqual({ tur: 'yok' });
    expect(CN.programKaynagi({ surum: 'abcdef2', program: { parcalar: [] } })).toEqual({ tur: 'yok' });
  });

  test('güncelleme sorusu: yüklü sürüm sorulmaz, "Sonra" denen sürüm yeniden sorulmaz', () => {
    const y = yayinB('abcdef2', ID('b'));
    expect(CN.guncellemeVar(y, 'abcdef1', '')).toBe(true);
    expect(CN.guncellemeVar(y, 'abcdef2', '')).toBe(false);
    expect(CN.guncellemeVar(y, 'abcdef1', 'abcdef2')).toBe(false);
    expect(CN.guncellemeVar(yayinB('abcdef3', ID('c')), 'abcdef1', 'abcdef2')).toBe(true);
  });

  test('not numaraları kısa; sonucun görüntüsü yalnız varlık kimliğiyle', () => {
    expect(CN.noAraligi([21, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20])).toBe('6 · 8–21');
    expect(CN.noAraligi([1, 2, 4, 4, 7])).toBe('1 · 2 · 4 · 7');
    expect(CN.noAraligi([])).toBe('');
    expect(CN.sonucYolu({ sonuc: { foto: ID('d'), g: 640, y: 400 } })).toBe('/_blob/' + ID('d'));
    expect(CN.sonucYolu({ sonuc: { foto: '../x' } })).toBe('');
    expect(CN.sonucYolu({})).toBe('');
  });

  test('araç: --notlar aralığı; kayıt künyeden; döküm iki biçimde okunur', () => {
    expect(T.notlarAyristir('6, 8-10,12')).toEqual([6, 8, 9, 10, 12]);
    expect(() => T.notlarAyristir('6,x')).toThrow(/okunamadı/);
    expect(() => T.notlarAyristir('9-3')).toThrow(/bozuk/);
    const oz = '0123456789abcdef';
    const o = T.ayristir(['yayin', '--parca', oz + '=' + ID('e'), '--parca', oz + '.2=' + ID('f'), '--notlar', '6,8-9', '--ilk']);
    expect([o.komut, o.parca, o.notlar, o.ilk]).toEqual(['yayin', { [oz]: ID('e'), [oz + '.2']: ID('f') }, [6, 8, 9], true]);
    expect(() => T.ayristir(['yayin', '--parca', 'kisa=' + ID('e')])).toThrow(/--parca/);
    expect(() => T.ayristir(['yayin', '--parca', oz + '=kisa'])).toThrow(/--parca/);
    const k = { sha: 'f'.repeat(40), shortSha: 'fffffff', prNumber: 1301 };
    // eski biçim (tek varlık) hâlâ kurulur ve okunur
    const y = T.yayinKaydi(k, { id: ID('e'), boyut: 11 }, [6], '2026-11-05T12:00:00Z');
    expect(y).toEqual({ surum: 'fffffff', sha: 'f'.repeat(40), pr: 1301, zaman: '2026-11-05T12:00:00Z', program: { id: ID('e'), boyut: 11 }, notlar: [6] });
    expect(() => T.yayinKaydi(k, { id: 'kisa' }, [])).toThrow(/program\.id/);
    // parçalı biçim: boyut · uzunluk · parçalar; yayınlayan oturum kayıtta
    const parcalar = [{ yuva: 0, id: ID('a'), ozet: oz, boyut: 5, sik: 'gzip', ad: 'kod' }];
    const y2 = T.yayinKaydi(k, { boyut: 11, uzunluk: 10, parcalar }, [], '2026-11-11T09:00:00Z', 'https://claude.ai/code/session_x');
    expect(y2.program).toEqual({ boyut: 11, uzunluk: 10, parcalar });
    expect(y2.oturum).toBe('https://claude.ai/code/session_x');
    expect(() => T.yayinKaydi(k, { parcalar: [{ yuva: 1, id: ID('a'), sik: 'gzip' }] }, [])).toThrow(/yuva 0 yok/);
    expect(T.yayinOku({ id: 'son', version: 2, data: y })).toEqual({ sha: 'f'.repeat(40), shortSha: 'fffffff', prNumber: 1301 });
    expect(T.yayinOku(y2).shortSha).toBe('fffffff');
    expect(() => T.yayinOku({ no: 1 })).toThrow(/yayın belgesi/);
  });

  // Sayfanın KENDİSİ (şablon + çekirdek, sayfaKur) bu pencerede: işaretleme
  // gövdeye, betikler genel kapsamda; sahte kayıt ve varlık deposu. Çerçeve
  // kaynaksız başlar, kaynağı kayıt seçer.
  const bekle = (ms) => new Promise((r) => setTimeout(r, ms || 15));
  function sayfa(opt) {
    opt = opt || {};
    const sablon = fs.readFileSync(path.join(KOK, 'tools', 'canli-not.html'), 'utf8');
    const cekirdek = fs.readFileSync(path.join(KOK, 'tools', 'canli-not-cekirdek.js'), 'utf8');
    const tam = T.sayfaKur(sablon, cekirdek, Object.assign({ surum: 'aaaaaaa', pr: 1290 }, opt.ayar || {}));
    const dinle = {}, getirilen = [], yazilan = [];
    const db = {
      collection: (p) => ({ orderBy: () => ({ onSnapshot: (f) => { dinle[p] = f; f({ docs: [] }); return () => {}; } }) }),
      doc: (p) => ({ onSnapshot: (f) => { dinle[p] = f; return () => {}; },
        update: (v) => { yazilan.push(['update', p, v]); return Promise.resolve(); },
        set: (v) => { yazilan.push(['set', p, v]); return Promise.resolve(); } })
    };
    document.body.innerHTML = tam.replace(/<script>[\s\S]*?<\/script>/g, '');
    const yetkiler = { db, comments: opt.yorum || null, mcp: opt.mcp || null };
    window.claude = { use: (ad) => Promise.resolve(yetkiler[ad] || null) };
    // Varlık deposu: `opt.varlik` kimlik → metin (null: indirilemez); yoksa adresini taşıyan tam
    // belge. `opt.getir(u)`: indirmeyi bekleten söz (kilit testleri).
    const yanit = (u) => {
      const v = opt.varlik ? opt.varlik[u.replace('/_blob/', '')] : undefined;
      return { ok: v !== null, status: v === null ? 404 : 200,
        text: () => Promise.resolve(v !== undefined ? v : '<!doctype html><html><body>' + u + '</body></html>') };
    };
    window.fetch = (u) => { getirilen.push(u); return opt.getir ? opt.getir(u).then(() => yanit(u)) : Promise.resolve(yanit(u)); };
    [...tam.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m) => (0, eval)(m[1]));
    const d = document;
    const yayinGonder = (y) => dinle['yayin/son']({ exists: !!y, data: () => y, metadata: { fromCache: false } });
    const notGonder = (liste) => dinle.notlar({ docs: liste.map((n) => ({ id: n.id, data: () => n })) });
    const istekGonder = (v) => dinle['istek/guncelle']({ exists: !!v, data: () => v });
    const belgeGonder = (yol, v) => dinle[yol]({ exists: !!v, data: () => v });
    return { d, getirilen, yazilan, yayinGonder, notGonder, istekGonder, belgeGonder, cerceve: d.getElementById('cn-program'), gizli: (id) => d.getElementById(id).hidden };
  }

  // PROGRAMI GÜNCELLE (kullanıcı 2026-11-11: *"Canlı notun içine de belli bir yere programı
  // güncelleyen bir buton koyalım. Yani şu an güncelle dediğimiz zaman sanırım canlı not
  // üzerinden yaptığımız değişiklikleri güncelliyor"*): Güncelleme yalnız bir oturumun
  // yayınladığını yükler; düğme ana dalın SON hâlini ister.
  test('istek: durum kayıttan; 30 dakikadan eski "bekliyor" ESKİ; yorumun metni başlıkla', () => {
    const simdi = Date.parse('2026-11-11T08:00:00Z');
    expect(CN.istekDurumu(null, simdi)).toBe('yok');
    expect(CN.istekDurumu({ durum: 'garip' }, simdi)).toBe('yok');
    expect(CN.istekDurumu({ durum: 'bekliyor', zaman: '2026-11-11T07:50:00Z' }, simdi)).toBe('bekliyor');
    expect(CN.istekDurumu({ durum: 'yapiliyor', zaman: '2026-11-11T07:20:00Z' }, simdi)).toBe('eski');
    expect(CN.istekDurumu({ durum: 'bekliyor' }, simdi)).toBe('eski');
    expect(CN.istekDurumu({ durum: 'tamam', zaman: '2026-11-01T00:00:00Z' }, simdi)).toBe('tamam');
    expect(CN.istekMetni({ surum: 'abcdef1', pr: 1335 })).toBe('Program güncelleme isteği · açık sürüm abcdef1 · #1335');
    expect(CN.istekMetni({}).startsWith(CN.ISTEK_BASLIK)).toBe(true);
  });

  test('PROGRAMI GÜNCELLE: kayda istek + Claude\'a yorum; çalışırken kapalı; yeni yayın SORMADAN yüklenir', async () => {
    const gonderilen = [];
    const yorum = { canSendToClaude: () => Promise.resolve('available'), anchorFor: (el) => Promise.resolve({ el: el.id }),
      sendToClaude: (t) => { gonderilen.push(t); return Promise.resolve({ threadId: 'konu-1' }); } };
    const a = sayfa({ yorum });
    await bekle();
    a.yayinGonder(yayinB('aaaaaaa', ID('a'), []));               // açık program: kayıttaki yayın
    await bekle();
    const b = a.d.getElementById('cn-istek');
    expect([b.disabled, b.textContent]).toEqual([false, 'Programı güncelle']);
    b.click();
    await bekle(30);
    expect(a.yazilan.filter((w) => w[1] === 'istek/guncelle').map((w) => [w[0], w[2].durum || '', w[2].konu || '', w[2].sayfaSurum || '']))
      .toEqual([['set', 'bekliyor', '', 'aaaaaaa'], ['update', '', 'konu-1', '']]);
    expect(gonderilen).toEqual([{ anchor: { el: 'cn-istek' }, text: 'Program güncelleme isteği · açık sürüm aaaaaaa · #1300' }]);
    expect([b.disabled, b.textContent]).toEqual([true, 'Güncelleniyor…']);
    a.istekGonder({ durum: 'yapiliyor', zaman: new Date().toISOString() });
    await bekle();
    expect(b.disabled).toBe(true);
    // oturum yayınladı: pencere sormaz, program yüklenir (proje taşınır)
    a.yayinGonder(yayinB('eeeeeee', ID('e'), []));
    await bekle();
    expect(a.getirilen).toEqual(['/_blob/' + ID('a'), '/_blob/' + ID('e')]);
    expect(a.gizli('cn-guncel')).toBe(true);
    expect(a.d.getElementById('cn-surum').textContent).toBe('eeeeeee · #1300');
    a.istekGonder({ durum: 'tamam', zaman: new Date().toISOString(), surum: 'eeeeeee' });
    await bekle();
    expect([b.disabled, b.textContent]).toEqual([false, 'Programı güncelle']);
    // istek düğmeden gelmediyse yeni yayın yine sorar
    a.yayinGonder(yayinB('fffffff', ID('f'), []));
    await bekle(25);
    expect(a.gizli('cn-guncel')).toBe(false);
  });

  test('yayın zaten ana dalsa "güncel" bildirilir; oturum yoksa istek kayıtta kalır', async () => {
    const a = sayfa();                                          // yorum katmanı yok
    await bekle();
    a.yayinGonder(null);
    await bekle();
    a.d.getElementById('cn-istek').click();
    await bekle(30);
    expect(a.yazilan.filter((w) => w[1] === 'istek/guncelle').map((w) => w[0])).toEqual(['set']);
    expect(a.d.getElementById('cn-bildirim').textContent).toBe('Claude oturumu bağlı değil; istek kayıtta.');
    a.istekGonder({ durum: 'guncel', zaman: new Date().toISOString(), surum: 'aaaaaaa' });
    await bekle();
    expect(a.d.getElementById('cn-bildirim').textContent).toBe('Program güncel · aaaaaaa');
    expect(a.d.getElementById('cn-istek').disabled).toBe(false);
  });

  // KİLİT (kullanıcı 2026-11-11: *"Programı güncelle dediğim zaman … 'güncelleniyor' yazısı
  // çıkıyor butonda. Böyle olduğu zaman programı kilitlemesini istiyorum. Şu anda güncel
  // olarak program kilitlenmiyor, hala kullanılabiliyor."*)
  const yorumVar = () => ({ canSendToClaude: () => Promise.resolve('available'), anchorFor: (el) => Promise.resolve({ el: el.id }),
    sendToClaude: () => Promise.resolve({ threadId: 'konu-1' }) });
  const kilit = (a) => [a.gizli('cn-kilit'), a.cerceve.hasAttribute('inert'), a.d.getElementById('cn-yenile').disabled,
    a.d.getElementById('cn-kilit-asama').textContent];
  const basladi = (a) => window.dispatchEvent(new MessageEvent('message',
    { data: { cn: 1, tur: 'olay', ad: 'basladi', veri: {} }, source: a.cerceve.contentWindow }));

  test('KİLİT: istek sürerken ve yeni program yüklenirken kilitli; eskiyen istek kilitlemez', () => {
    const simdi = Date.parse('2026-11-11T08:00:00Z');
    expect(CN.kilitDurumu(null, simdi)).toEqual({ kilitli: false, asama: 'yok', metin: '', kalan: 0 });
    expect(CN.kilitDurumu({ durum: 'bekliyor', zaman: '2026-11-11T07:50:00Z' }, simdi))
      .toEqual({ kilitli: true, asama: 'bekliyor', metin: 'İstek gönderildi', kalan: 20 * 60 * 1000 });
    expect(CN.kilitDurumu({ durum: 'yapiliyor', zaman: '2026-11-11T07:59:00Z' }, simdi).metin).toBe('Derleniyor');
    expect(CN.kilitDurumu({ durum: 'yapiliyor', zaman: '2026-11-11T07:20:00Z' }, simdi).kilitli).toBe(false);
    ['tamam', 'guncel', 'hata', 'iptal'].forEach((durum) =>
      expect(CN.kilitDurumu({ durum, zaman: '2026-11-11T07:59:00Z' }, simdi).kilitli).toBe(false));
    expect(CN.istekDurumu({ durum: 'iptal', zaman: '2026-11-11T07:59:00Z' }, simdi)).toBe('iptal');
    expect(CN.kilitDurumu({ durum: 'tamam' }, simdi, 'eeeeeee'))
      .toEqual({ kilitli: true, asama: 'yukleme', metin: 'Yükleniyor · eeeeeee', kalan: 0 });
  });

  // Varlık yüklenirken görülsün diye indirme elle bırakılır (jsdom'da köprü yok: açılan
  // çerçeve "basladi" demez — "Program açılmadı" yolu çerçevenin yükleme olayıyla).
  const tutulan = () => { const t = { bekleyen: [] }; t.getir = () => new Promise((r) => t.bekleyen.push(r)); t.birak = () => t.bekleyen.splice(0).forEach((r) => r()); return t; };

  test('KİLİT: "Güncelleniyor…" iken program perdeli ve inert, Yenile kapalı; yeni program açılınca açılır', async () => {
    const indirme = tutulan();
    const a = sayfa({ yorum: yorumVar(), getir: indirme.getir });
    await bekle();
    a.yayinGonder(yayinB('aaaaaaa', ID('a'), []));           // açık program: kayıttaki yayın
    await bekle();
    indirme.birak();
    await bekle(30);
    expect(kilit(a)).toEqual([true, false, false, '']);
    a.d.getElementById('cn-istek').click();
    await bekle(30);
    expect(kilit(a)).toEqual([false, true, true, 'İstek gönderildi']);
    expect(a.gizli('cn-kilit-vazgec')).toBe(false);
    a.istekGonder({ durum: 'yapiliyor', zaman: new Date().toISOString(), konu: 'konu-1' });
    await bekle();
    expect(kilit(a)).toEqual([false, true, true, 'Derleniyor']);
    a.yayinGonder(yayinB('eeeeeee', ID('e'), []));          // yüklenirken de kilitli, Vazgeç yok
    await bekle();
    expect(kilit(a)).toEqual([false, true, true, 'Yükleniyor · eeeeeee']);
    expect(a.gizli('cn-kilit-vazgec')).toBe(true);
    a.istekGonder({ durum: 'tamam', zaman: new Date().toISOString(), surum: 'eeeeeee' });
    await bekle();
    expect(kilit(a)[0]).toBe(false);                       // yeni program henüz açılmadı
    basladi(a);
    await bekle();
    expect(kilit(a)).toEqual([true, false, false, '']);
    indirme.birak();
    await bekle();
    // başka görünümün isteği de kilitler (durum ortak)
    a.istekGonder({ durum: 'bekliyor', zaman: new Date().toISOString() });
    await bekle();
    expect(kilit(a)).toEqual([false, true, true, 'İstek gönderildi']);
    a.istekGonder({ durum: 'hata', zaman: new Date().toISOString(), cevap: 'x' });
    await bekle();
    expect(kilit(a)[0]).toBe(true);
  });

  test('KİLİT: Vazgeç isteği bırakır ve kilidi açar; açık program yayından eskiyse "güncel" de yükler', async () => {
    const indirme = tutulan();
    const a = sayfa({ yorum: yorumVar(), getir: indirme.getir });
    await bekle();
    a.yayinGonder(yayinB('aaaaaaa', ID('a'), []));           // açık program: kayıttaki yayın
    await bekle();
    indirme.birak();
    await bekle(30);
    a.d.getElementById('cn-istek').click();
    await bekle(30);
    expect(kilit(a)[0]).toBe(false);
    a.d.getElementById('cn-kilit-vazgec').click();
    await bekle();
    expect(a.yazilan.filter((w) => w[1] === 'istek/guncelle' && w[2].durum === 'iptal').length).toBe(1);
    expect(kilit(a)).toEqual([true, false, false, '']);
    expect([a.d.getElementById('cn-istek').disabled, a.d.getElementById('cn-bildirim').textContent]).toEqual([false, 'İstek bırakıldı.']);
    a.istekGonder({ durum: 'iptal', zaman: new Date().toISOString() });
    await bekle();
    expect(kilit(a)[0]).toBe(true);
    // yayın açık programdan yeni (pencere sorar), istek "güncel" döner: yayın yüklenir
    a.yayinGonder(yayinB('bbbbbbb', ID('b'), []));
    await bekle(25);
    expect(a.gizli('cn-guncel')).toBe(false);
    a.d.getElementById('cn-istek').click();
    await bekle(30);
    a.istekGonder({ durum: 'guncel', zaman: new Date().toISOString(), surum: 'bbbbbbb' });
    await bekle();
    expect(a.getirilen).toEqual(['/_blob/' + ID('a'), '/_blob/' + ID('b')]);
    expect(kilit(a)).toEqual([false, true, true, 'Yükleniyor · bbbbbbb']);
    indirme.birak();
    await bekle(30);
    // çerçeve yüklendi ama köprü konuşmadı (jsdom srcdoc'u yüklemez: olay elle): program açılmadı, kilit kalkar
    a.cerceve.dispatchEvent(new Event('load'));
    expect(kilit(a)[0]).toBe(true);
    expect(a.d.getElementById('cn-acilis').textContent).toBe('Program açılmadı.');
  });

  test('KİLİT: perde programın ve kalemin üstünde, notların altında; düğmesiz kalmaz', () => {
    const sablon = fs.readFileSync(path.join(KOK, 'tools', 'canli-not.html'), 'utf8');
    const sira = ['id="cn-program"', 'id="cn-cizim"', 'id="cn-kilit"', 'id="cn-kart"', 'id="cn-liste"'].map((s) => sablon.indexOf(s));
    expect(sira.every((v, i) => v > 0 && (i === 0 || v > sira[i - 1]))).toBe(true);
    expect(sablon).toMatch(/\.cn-kilit \{[^}]*z-index: 2;/);
    expect(sablon).toMatch(/\.cn-liste \{[^}]*z-index: 2;/);
    expect(sablon).toMatch(/\.cn-kart \{[^}]*z-index: 3;/);
    expect(sablon).toContain("cerceve.toggleAttribute('inert', k.kilitli)");
    expect(sablon).toContain("$('cn-kilit-vazgec').addEventListener('click', istekBirak)");
    // inert programın kendi focus() çağrısını durdurmuyor (Chromium'da ölçüldü): odak karta döner
    expect(sablon).toMatch(/function kilitOdak\(\) \{\s*if \(!\$\('cn-kilit'\)\.hidden && document\.activeElement === cerceve\)/);
    expect(sablon).toContain("window.addEventListener('blur', function () { setTimeout(kilitOdak, 0); });");
  });
  afterAll(() => { delete window.claude; delete window.fetch; delete window.CanliNot; document.body.innerHTML = ''; });

  test('şablon: çerçeve KAYNAKSIZ başlar; sayfa yeniden yüklenmez; gizli kural ezilmez', () => {
    const sablon = fs.readFileSync(path.join(KOK, 'tools', 'canli-not.html'), 'utf8');
    expect(sablon).toMatch(/<iframe class="cn-program" id="cn-program" title="MFSim"><\/iframe>/);
    expect(sablon).not.toMatch(/location\.reload|location\.href\s*=/);
    expect(sablon).toMatch(/\[hidden\] \{ display: none !important; \}/);
    expect(sablon).toContain("yetki.db.doc('yayin/son').onSnapshot(");
  });

  test('açılış: program kayıttaki yayından yüklenir; yayın yoksa program da yok, sonradan gelen yayın yüklenir', async () => {
    const a = sayfa();
    await bekle();
    a.yayinGonder(yayinB('bbbbbbb', ID('b'), [6]));
    await bekle();
    expect(a.getirilen).toEqual(['/_blob/' + ID('b')]);
    expect(a.cerceve.getAttribute('srcdoc')).toContain(ID('b'));
    expect(a.cerceve.hasAttribute('src')).toBe(false);
    expect(a.d.getElementById('cn-surum').textContent).toBe('bbbbbbb · #1300');
    expect(a.d.getElementById('cn-surum').title).toBe('Sayfa aaaaaaa · #1290');   // sayfanın kendi künyesi ipucunda
    expect(a.gizli('cn-guncel')).toBe(true);                    // açılışta sormaz: yüklenen zaten en yenisi
    const b = sayfa();
    await bekle();
    b.yayinGonder(null);
    await bekle();
    expect(b.getirilen).toEqual([]);
    expect(b.cerceve.hasAttribute('src')).toBe(false);          // gömülü dosya yok
    expect(b.cerceve.hasAttribute('srcdoc')).toBe(false);
    expect([b.gizli('cn-acilis'), b.d.getElementById('cn-acilis').textContent]).toEqual([false, 'Program yayını yok.']);
    expect(b.d.getElementById('cn-surum').textContent).toBe('');
    b.yayinGonder(yayinB('ccccccc', ID('c'), []));               // yayın sonradan geldi: sormadan yüklenir
    await bekle();
    expect(b.getirilen).toEqual(['/_blob/' + ID('c')]);
    expect(b.gizli('cn-guncel')).toBe(true);
    // indirilemeyen varlık: durum yazılır, yeni yayın yeniden denenir
    const c = sayfa({ varlik: { [ID('d')]: null } });
    await bekle();
    c.yayinGonder(yayinB('ddddddd', ID('d'), []));
    await bekle();
    expect(c.d.getElementById('cn-acilis').textContent).toBe('Program indirilemedi.');
    c.yayinGonder(yayinB('eeeeeee', ID('e'), []));
    await bekle();
    expect(c.d.getElementById('cn-surum').textContent).toBe('eeeeeee · #1300');
  });

  test('açıkken gelen yayın programı DEĞİŞTİRMEZ: pencere sorar; Güncelle yükler, Sonra erteler', async () => {
    const a = sayfa();
    await bekle();
    a.yayinGonder(yayinB('aaaaaaa', ID('a'), []));
    await bekle();
    const once = a.cerceve.getAttribute('srcdoc');
    a.yayinGonder(yayinB('ccccccc', ID('c'), [6, 8, 9, 10]));
    await bekle();
    expect(a.getirilen).toEqual(['/_blob/' + ID('a')]);          // kendiliğinden yüklenmedi
    expect(a.cerceve.getAttribute('srcdoc')).toBe(once);
    expect(a.gizli('cn-guncel')).toBe(false);
    expect(a.gizli('cn-guncel-ac')).toBe(false);
    expect(a.d.getElementById('cn-guncel-surum').textContent).toBe('ccccccc · #1300');
    expect(a.d.getElementById('cn-guncel-not').textContent).toBe('Not 6 · 8–10 uygulandı');
    // Sonra: pencere kapanır, şeritteki düğme kalır; aynı sürüm yeniden sorulmaz
    a.d.getElementById('cn-guncel-sonra').click();
    expect(a.gizli('cn-guncel')).toBe(true);
    expect(a.gizli('cn-guncel-ac')).toBe(false);
    a.yayinGonder(yayinB('ccccccc', ID('c'), [6, 8, 9, 10]));
    await bekle();
    expect(a.gizli('cn-guncel')).toBe(true);
    // daha yeni yayın yeniden sorar; Güncelle yükler, pencere ve düğme kapanır
    a.yayinGonder(yayinB('ddddddd', ID('d'), [11]));
    await bekle();
    expect(a.gizli('cn-guncel')).toBe(false);
    a.d.getElementById('cn-guncel-evet').click();
    await bekle();
    expect(a.getirilen).toEqual(['/_blob/' + ID('a'), '/_blob/' + ID('d')]);
    expect(a.cerceve.getAttribute('srcdoc')).toContain(ID('d'));
    expect(a.cerceve.hasAttribute('src')).toBe(false);
    expect(a.gizli('cn-guncel')).toBe(true);
    expect(a.gizli('cn-guncel-ac')).toBe(true);
    expect(a.d.getElementById('cn-surum').textContent).toBe('ddddddd · #1300');
  });

  // Kullanıcı 2026-11-05: "canlı not içine yenileme butonu ekler misin … F5 yapıp sayfayı
  // tamamen yenilemek istemiyorum." Yenile yalnız programı yeniden yükler: sayfa (notlar,
  // kart) yerinde; yeni yayın varsa onu yükler.
  test('Yenile: yalnız program yeniden yüklenir; yeni yayın varsa o; program yokken yayını dener', async () => {
    const a = sayfa();
    await bekle();
    const yenile = a.d.getElementById('cn-yenile');
    expect([yenile.textContent, yenile.title]).toEqual(['Yenile', 'Programı yeniden yükle']);
    // varlıktan açılmış program: aynı varlık yeniden getirilir
    a.yayinGonder(yayinB('bbbbbbb', ID('b'), [6]));
    await bekle();
    a.notGonder([{ id: 'n1', no: 1, sira: 1, metin: 'x', durum: 'bekliyor', zaman: '2026-11-05T10:00:00Z', cizim: { g: 800, y: 600, sekiller: [] } }]);
    const li = a.d.querySelector('#not-n1');
    yenile.click();
    await bekle();
    expect(a.getirilen).toEqual(['/_blob/' + ID('b'), '/_blob/' + ID('b')]);
    expect(a.cerceve.getAttribute('srcdoc')).toContain(ID('b'));
    expect(a.d.querySelector('#not-n1')).toBe(li);                // sayfa yeniden kurulmadı
    // yeni yayın gelmişse Yenile onu yükler (Güncelle'nin yolu)
    a.yayinGonder(yayinB('ccccccc', ID('c'), [7]));
    await bekle();
    yenile.click();
    await bekle();
    expect(a.getirilen[a.getirilen.length - 1]).toBe('/_blob/' + ID('c'));
    expect(a.d.getElementById('cn-surum').textContent).toBe('ccccccc · #1300');
    expect(a.gizli('cn-guncel')).toBe(true);
    // program yokken (yayın yok) Yenile bir şey indirmez
    const b = sayfa();
    await bekle();
    b.yayinGonder(null);
    await bekle();
    b.d.getElementById('cn-yenile').click();
    await bekle();
    expect(b.getirilen).toEqual([]);
    expect(b.d.getElementById('cn-acilis').textContent).toBe('Program yayını yok.');
  });

  test('Notlar listesi yeniden eskiye: en yeni not en üstte, yeni gelen tepeye oturur', async () => {
    const a = sayfa();
    await bekle();
    const not = (id, no) => ({ id, no, sira: no, metin: 'x', durum: 'uygulandi', zaman: '2026-11-05T10:00:00Z', cizim: { g: 800, y: 600, sekiller: [] } });
    const sira = () => [...a.d.querySelectorAll('#cn-notlar .cn-not')].map((li) => li.id);
    a.notGonder([not('a', 1), not('b', 2), not('c', 3)]);
    expect(sira()).toEqual(['not-c', 'not-b', 'not-a']);
    a.notGonder([not('a', 1), not('b', 2), not('c', 3), not('d', 4)]);
    expect(sira()).toEqual(['not-d', 'not-c', 'not-b', 'not-a']);
  });

  // Kullanıcı 2026-11-10: "Notlar içine 'uygulanan' 'uygulanıyor' 'uygulanacak' 'girdi
  // bekleniyor' gibi kategoriler koyalım. Notları takip ederiz." Bölümler sayfada
  // sırayla, başlıkta sayı; satır durumuna göre bölümde, durum değişince AYNI satır
  // öteki bölüme taşınır (çizim, sonuç görüntüsü ve yorum çapası yerinde kalır).
  test('Notlar kategorilere ayrılır: başlık ve sayı, satır bölümünde, durum değişince satır TAŞINIR', async () => {
    window.localStorage.removeItem('cn-kat-kapali');
    const a = sayfa();
    await bekle();
    const not = (id, no, durum) => ({ id, no, sira: no, metin: 'x', durum, zaman: '2026-11-10T10:00:00Z', cizim: { g: 800, y: 600, sekiller: [] } });
    const bolum = (kod) => a.d.querySelector('.cn-kat[data-kat="' + kod + '"]');
    const satirlar = (kod) => [...bolum(kod).querySelectorAll('.cn-not')].map((li) => li.id);
    const sayilar = () => [...a.d.querySelectorAll('.cn-kat:not([hidden])')].map((s) =>
      s.querySelector('.cn-kat-ad').textContent + ' ' + s.querySelector('.cn-kat-say').textContent);
    a.notGonder([not('a', 1, 'uygulandi'), not('b', 2, 'bekliyor'), not('c', 3, 'uygulaniyor'), not('d', 4, 'soru'), not('e', 5, 'uygulandi')]);
    expect(sayilar()).toEqual(['Girdi bekleniyor 1', 'Uygulanıyor 1', 'Uygulanacak 1', 'Uygulanan 2']);
    expect(satirlar('girdi')).toEqual(['not-d']);
    expect(satirlar('uygulanan')).toEqual(['not-e', 'not-a']);          // her bölümde en yeni en üstte
    expect(a.d.querySelectorAll('.cn-cip').length).toBe(0);             // durum bölümün başlığında, satırda ikinci kez yazılmaz
    // açık not sayacı: kuyruk · işlenen · girdi bekleyen (3), biten sayılmaz
    expect(a.d.getElementById('cn-sayac').textContent).toBe('5');
    expect(a.d.getElementById('cn-sayac').getAttribute('data-bekleyen')).toBe('3');
    // durum değişince satır öteki bölüme TAŞINIR: aynı eleman, bölümler sırayla
    const b = a.d.querySelector('#not-b');
    a.notGonder([not('a', 1, 'uygulandi'), not('b', 2, 'uygulaniyor'), not('c', 3, 'uygulaniyor'), not('d', 4, 'soru'), not('e', 5, 'uygulandi')]);
    expect(a.d.querySelector('#not-b')).toBe(b);
    expect(satirlar('uygulaniyor')).toEqual(['not-c', 'not-b']);
    expect(satirlar('uygulanacak')).toEqual([]);
    // boş kategori başlığıyla kalır (sayı 0) ve tıklanamaz; İptal ve Diğer boşken gizli
    expect(sayilar()).toEqual(['Girdi bekleniyor 1', 'Uygulanıyor 2', 'Uygulanacak 0', 'Uygulanan 2']);
    expect(bolum('uygulanacak').querySelector('button').disabled).toBe(true);
    expect(bolum('iptal').hidden).toBe(true);
    expect(bolum('diger').hidden).toBe(true);
    a.notGonder([not('a', 1, 'iptal')]);
    expect(bolum('iptal').hidden).toBe(false);
    expect(satirlar('iptal')).toEqual(['not-a']);
    expect(a.d.getElementById('cn-bos').hidden).toBe(true);
  });

  test('bölüm başlığı bölümü kapatır ve açar; kapalı olanlar hatırlanır', async () => {
    window.localStorage.removeItem('cn-kat-kapali');
    const a = sayfa();
    await bekle();
    const not = (id, no) => ({ id, no, sira: no, metin: 'x', durum: 'uygulandi', zaman: '2026-11-10T10:00:00Z', cizim: { g: 800, y: 600, sekiller: [] } });
    a.notGonder([not('a', 1), not('b', 2)]);
    const bolum = a.d.querySelector('.cn-kat[data-kat="uygulanan"]'), dugme = bolum.querySelector('button');
    expect([dugme.getAttribute('aria-expanded'), bolum.getAttribute('data-kapali')]).toEqual(['true', '0']);
    dugme.click();
    expect([dugme.getAttribute('aria-expanded'), bolum.getAttribute('data-kapali')]).toEqual(['false', '1']);
    expect(window.localStorage.getItem('cn-kat-kapali')).toBe('["uygulanan"]');
    // başka bir açılışta kapalı gelir; satırlar yine de DOM'da (yorum çapası bozulmaz)
    const b = sayfa();
    await bekle();
    b.notGonder([not('a', 1), not('b', 2)]);
    const bolumB = b.d.querySelector('.cn-kat[data-kat="uygulanan"]');
    expect(bolumB.getAttribute('data-kapali')).toBe('1');
    expect(bolumB.querySelectorAll('.cn-not').length).toBe(2);
    bolumB.querySelector('button').click();
    expect(bolumB.getAttribute('data-kapali')).toBe('0');
    expect(window.localStorage.getItem('cn-kat-kapali')).toBe('[]');
  });

  test('notun satırında sonucun görüntüsü; tıklanınca büyük, Esc kapatır', async () => {
    const a = sayfa();
    await bekle();
    a.notGonder([
      { id: 'n1', no: 9, sira: 1, metin: 'x', durum: 'uygulandi', cevap: 'Yapıldı.', yer: 'Takoz › 3B', zaman: '2026-11-05T10:00:00Z',
        cizim: { g: 800, y: 600, sekiller: [] }, sonuc: { foto: ID('f'), g: 640, y: 360 } },
      { id: 'n2', no: 10, sira: 2, metin: 'y', durum: 'bekliyor', zaman: '2026-11-05T10:01:00Z', cizim: { g: 800, y: 600, sekiller: [] } }
    ]);
    const s1 = a.d.querySelector('#not-n1 .cn-sonuc'), s2 = a.d.querySelector('#not-n2 .cn-sonuc');
    expect(s1.hidden).toBe(false);
    expect(s1.querySelector('img').getAttribute('src')).toBe('/_blob/' + ID('f'));
    expect([s1.querySelector('img').width, s1.querySelector('img').height]).toEqual([640, 360]);
    expect(s1.getAttribute('aria-label')).toBe('Not 9 sonucu');
    expect(s2.hidden).toBe(true);                                // sonucu olmayan notta görüntü yok
    s1.click();
    expect(a.gizli('cn-buyuk')).toBe(false);
    expect(a.d.getElementById('cn-buyuk-resim').getAttribute('src')).toBe('/_blob/' + ID('f'));
    expect(a.d.getElementById('cn-buyuk-no').textContent).toBe('Not 9');
    a.d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(a.gizli('cn-buyuk')).toBe(true);
  });

  // PARÇALI YAYIN sayfada (kullanıcı 2026-11-11: boyut sınırı): yuvalar ayrı varlık; sayfa
  // indirir, birleştirir, çerçeveye koyar. Güncellemede yalnız DEĞİŞEN yuva indirilir;
  // Yenile hiçbir şey indirmez. Sıkıştırılmış yuvayı açan kod tarayıcının akışı: `duman` koşar.
  const parcaliB = (surum, parcalar, uzunluk) => ({ surum, sha: surum + '0'.repeat(33), pr: 1300, program: { boyut: uzunluk, uzunluk, parcalar }, notlar: [] });
  const parca = (yuva, id, ozet, sik) => ({ yuva, id, ozet, boyut: 1, sik: sik || 'yok' });

  test('parçalı yayın: yuvalar indirilir ve birleşir; güncellemede yalnız değişen yuva; Yenile indirmez', async () => {
    const iskelet = (v) => '<!doctype html><html><body>' + v + '\n@@CN-YUVA:1@@\n@@CN-YUVA:2@@\n</body></html>';
    const varlik = { [ID('1')]: iskelet('kod-1'), [ID('2')]: 'TAKOZ-', [ID('3')]: 'GORSELI', [ID('4')]: 'BELGE', [ID('5')]: iskelet('kod-2') };
    const tam1 = iskelet('kod-1').replace('@@CN-YUVA:1@@', 'TAKOZ-GORSELI').replace('@@CN-YUVA:2@@', 'BELGE');
    const a = sayfa({ varlik });
    await bekle();
    // yuva 1 iki parça (bölünmüş): saklanan metinler sırayla eklenir
    a.yayinGonder(parcaliB('bbbbbbb', [parca(0, ID('1'), 'oz-kod1'), parca(1, ID('2'), 'oz-takoz'), parca(1, ID('3'), 'oz-takoz'), parca(2, ID('4'), 'oz-belge')], tam1.length));
    await bekle(30);
    expect(a.getirilen.slice().sort()).toEqual([ID('1'), ID('2'), ID('3'), ID('4')].map((i) => '/_blob/' + i));
    expect(a.cerceve.getAttribute('srcdoc')).toBe(tam1);
    expect(a.d.getElementById('cn-surum').textContent).toBe('bbbbbbb · #1300');
    // yeni yayın: yalnız kod değişti → Güncelle yalnız yuva 0'ı indirir
    const tam2 = tam1.replace('kod-1', 'kod-2');
    a.yayinGonder(parcaliB('ccccccc', [parca(0, ID('5'), 'oz-kod2'), parca(1, ID('2'), 'oz-takoz'), parca(1, ID('3'), 'oz-takoz'), parca(2, ID('4'), 'oz-belge')], tam2.length));
    await bekle();
    expect(a.gizli('cn-guncel')).toBe(false);
    expect(a.getirilen.length).toBe(4);                           // sormadan indirilmedi
    a.d.getElementById('cn-guncel-evet').click();
    await bekle(30);
    expect(a.getirilen.slice(4)).toEqual(['/_blob/' + ID('5')]);
    expect(a.cerceve.getAttribute('srcdoc')).toBe(tam2);
    expect(a.d.getElementById('cn-surum').textContent).toBe('ccccccc · #1300');
    basladi(a);                                                   // yeni program açıldı: kilit kalkar
    await bekle();
    // Yenile: yuvalar bellekte, hiçbir şey indirilmez
    a.d.getElementById('cn-yenile').click();
    await bekle(30);
    expect(a.getirilen.length).toBe(5);
    expect(a.d.getElementById('cn-bildirim').textContent).toBe('Program yenilendi.');
  });

  test('parçalı yayın: eksik birleşen program çerçeveye konmaz; durum yazılır', async () => {
    const iskelet = '<!doctype html><html><body>\n@@CN-YUVA:1@@\n</body></html>';
    // kayıttaki uzunluk tutmuyor (yarım ya da yanlış parça)
    const a = sayfa({ varlik: { [ID('1')]: iskelet, [ID('2')]: 'X' } });
    await bekle();
    a.yayinGonder(parcaliB('bbbbbbb', [parca(0, ID('1'), 'k'), parca(1, ID('2'), 'v')], 999));
    await bekle(30);
    expect(a.cerceve.hasAttribute('srcdoc')).toBe(false);
    expect(a.d.getElementById('cn-acilis').textContent).toBe('Program indirilemedi.');
    // iskelette imi olan yuva kayıtta yok
    const b = sayfa({ varlik: { [ID('1')]: iskelet + '\n@@CN-YUVA:2@@', [ID('2')]: 'X' } });
    await bekle();
    b.yayinGonder(parcaliB('bbbbbbb', [parca(0, ID('1'), 'k'), parca(1, ID('2'), 'v')], 0));
    await bekle(30);
    expect(b.cerceve.hasAttribute('srcdoc')).toBe(false);
    // sıkıştırılmış yuva bu pencerede açılamıyor (akış yok): yarım program yerine durum
    const c = sayfa({ varlik: { [ID('1')]: 'H4sIAAAA', [ID('2')]: 'X' } });
    await bekle();
    c.yayinGonder(parcaliB('bbbbbbb', [parca(0, ID('1'), 'k', 'gzip'), parca(1, ID('2'), 'v')], 0));
    await bekle(30);
    expect(c.cerceve.hasAttribute('srcdoc')).toBe(false);
    expect(c.d.getElementById('cn-acilis').textContent).toBe('Program indirilemedi.');
  });

  // OTURUMU ÇAĞIR (kullanıcı 2026-11-11: *"HTML üzerinden Claude'a komutlar göndersin"* · *"bu iş
  // olabildiğince kolay olsun"*): her değişiklikte yeni oturum açmak pratik değil. Ölçüldü: sayfa
  // oturum AÇAMIYOR (o komutlar sayfaya kapalı; elle çalıştırılan görev var olan oturumu
  // uyandırmadı, depo bağlı olmayan yeni bir oturum açtı). Çalışan yol yorum: düğme sayfaya
  // BAĞLI oturumu uyandırır; oturum geldiğini sahiplik kaydını yeniden yazarak söyler. Buradaki
  // hata sessizdir: düğme "çağrıldı" der ve kimse gelmez, ya da oturum gelmiştir ve düğme on
  // dakika kapalı kalır.
  test('çağrı: sahiplik kaydı değişince GELDİ; 10 dakikada eskir; bağlı oturum yoksa durum ve çare', () => {
    const simdi = Date.parse('2026-11-11T11:00:00Z');
    const d = (c, k, s) => CN.cagriDurumu(c, k, s === undefined ? simdi : s).durum;
    expect(d(null, { zaman: 'A' })).toBe('hazir');
    const cagri = { zaman: '2026-11-11T10:58:00Z', onceki: 'A' };
    expect(CN.cagriDurumu(cagri, { zaman: 'A' }, simdi)).toEqual({ durum: 'cagrildi', kalan: 8 * 60 * 1000 });
    expect(d(cagri, null)).toBe('cagrildi');                              // sahiplik kaydı henüz okunmadı
    expect(d(cagri, { zaman: 'B' })).toBe('geldi');                       // oturum kaydı yeniden yazdı
    // saatler KARŞILAŞTIRILMAZ: oturumun yazdığı zaman çağrıdan eski görünse de geldi
    expect(d({ zaman: '2026-11-11T10:58:00Z', onceki: '2026-11-11T10:00:00Z' }, { zaman: '2026-11-11T10:30:00Z' })).toBe('geldi');
    expect(d(cagri, { zaman: 'A' }, simdi + 9 * 60 * 1000)).toBe('hazir');              // 11 dakika: eskidi
    expect(d({ zaman: '2026-11-11T10:59:00Z', durum: 'hata', onceki: 'A' }, { zaman: 'B' })).toBe('hazir');
    expect(CN.cagriMetni({ bekleyen: 3 })).toBe('Oturum çağrısı · bekleyen 3 not');
    expect(CN.cagriMetni({})).toBe(CN.CAGRI_BASLIK);
    expect(CN.cagriEngeli('available')).toBe('');
    expect(CN.cagriEngeli('no_session')).toBe('Claude oturumu bağlı değil. Yeni oturumda “Canlı Not’u getir” yazın.');
    expect(CN.cagriEngeli('off')).toBe('Claude’a gönderim kapalı.');
    expect(CN.cagriEngeli()).toBe('Claude’a gönderim kapalı.');
    // oturumun tarafı skill'de: yorumun başlığı, çağrının kaydı ve emekli görevin ölçümü
    const skill = fs.readFileSync(path.join(KOK, '.claude', 'skills', 'canli-not', 'SKILL.md'), 'utf8');
    [CN.CAGRI_BASLIK, 'oturum/cagri', 'emekli-oturum-gorevi.md'].forEach((x) => expect(skill).toContain(x));
    expect(fs.existsSync(path.join(KOK, '.claude', 'skills', 'canli-not', 'references', 'emekli-oturum-gorevi.md'))).toBe(true);
  });

  const cagriNotu = (id, no, durum) => ({ id, no, sira: no, metin: 'x', durum, zaman: '2026-11-11T10:00:00Z', cizim: { g: 800, y: 600, sekiller: [] } });
  test('OTURUMU ÇAĞIR: bağlı oturuma yorum gider, çağrı kayda yazılır; oturum gelene dek kapalı', async () => {
    const gonderilen = [];
    const yorum = { canSendToClaude: () => Promise.resolve('available'), anchorFor: (el) => Promise.resolve({ el: el.id }),
      sendToClaude: (t) => { gonderilen.push(t); return Promise.resolve({ threadId: 'konu-9' }); } };
    const a = sayfa({ yorum });
    await bekle();
    const b = a.d.getElementById('cn-cagir');
    expect([b.textContent, b.disabled]).toEqual(['Oturumu çağır', false]);
    a.belgeGonder('oturum/aktif', { oturum: 'https://claude.ai/code/session_x', zaman: 'A' });
    a.notGonder([cagriNotu('a', 1, 'bekliyor'), cagriNotu('b', 2, 'uygulandi'), cagriNotu('c', 3, 'bekliyor')]);
    b.click(); b.click();                                        // çift tık tek çağrı
    await bekle(30);
    expect(gonderilen).toEqual([{ anchor: { el: 'cn-cagir' }, text: 'Oturum çağrısı · bekleyen 2 not' }]);
    const w = a.yazilan.filter((x) => x[1] === 'oturum/cagri');
    expect(w.map((x) => x[0])).toEqual(['set']);
    expect(w[0][2]).toMatchObject({ onceki: 'A', konu: 'konu-9' });
    expect(Number.isFinite(Date.parse(w[0][2].zaman))).toBe(true);
    expect(a.d.getElementById('cn-bildirim').textContent).toBe('Oturum çağrıldı.');
    expect([b.textContent, b.disabled, b.getAttribute('aria-busy')]).toEqual(['Çağrılıyor…', true, 'true']);
    // kayıt aynı zamanla yeniden gelirse (başka görünüm) durum değişmez
    a.belgeGonder('oturum/aktif', { oturum: 'https://claude.ai/code/session_x', zaman: 'A' });
    expect(b.disabled).toBe(true);
    expect(a.d.getElementById('cn-bildirim').textContent).toBe('Oturum çağrıldı.');
    // oturum sahipliği yeniden yazdı: geldi
    a.belgeGonder('oturum/aktif', { oturum: 'https://claude.ai/code/session_x', zaman: 'B' });
    expect(a.d.getElementById('cn-bildirim').textContent).toBe('Oturum geldi.');
    expect([b.textContent, b.disabled, b.getAttribute('aria-busy')]).toEqual(['Oturumu çağır', false, 'false']);
    expect(gonderilen.length).toBe(1);
  });

  test('bağlı oturum yoksa çağrı gitmez: durum ve çare söylenir; gönderim düşerse söylenir; düğme açık kalır', async () => {
    const dene = async (yorum) => {
      const gonderilen = [];
      if (yorum && !yorum.sendToClaude) yorum.sendToClaude = (t) => { gonderilen.push(t); return Promise.resolve({ threadId: 'k' }); };
      if (yorum && !yorum.anchorFor) yorum.anchorFor = (el) => Promise.resolve({ el: el.id });
      const a = sayfa({ yorum });
      await bekle();
      a.belgeGonder('oturum/aktif', { oturum: 'x', zaman: 'A' });
      const b = a.d.getElementById('cn-cagir');
      b.click();
      await bekle(30);
      return { bildirim: a.d.getElementById('cn-bildirim').textContent, kapali: b.disabled, yazi: b.textContent, gonderilen,
        w: a.yazilan.filter((x) => x[1] === 'oturum/cagri').map((x) => x[2]) };
    };
    const yok = await dene({ canSendToClaude: () => Promise.resolve('no_session') });
    expect(yok.bildirim).toBe('Claude oturumu bağlı değil. Yeni oturumda “Canlı Not’u getir” yazın.');
    expect(yok.gonderilen).toEqual([]);
    expect(yok.w).toHaveLength(1);
    expect(yok.w[0]).toMatchObject({ durum: 'hata', hata: 'no_session' });
    expect([yok.kapali, yok.yazi]).toEqual([false, 'Oturumu çağır']);
    const kapali = await dene(null);                             // bu görünümde yorum yetkisi yok
    expect(kapali.bildirim).toBe('Claude’a gönderim kapalı.');
    expect(kapali.w[0]).toMatchObject({ durum: 'hata' });
    expect(kapali.kapali).toBe(false);
    const duser = await dene({ canSendToClaude: () => Promise.resolve('available'),
      sendToClaude: () => Promise.reject({ code: 'claude_unavailable' }) });
    expect(duser.bildirim).toBe('Oturum çağrılamadı.');
    expect(duser.w[0]).toMatchObject({ durum: 'hata', hata: 'claude_unavailable' });
    expect([duser.kapali, duser.yazi]).toEqual([false, 'Oturumu çağır']);
    // bağlantı açılışta yoktu, oturum sonradan bağlandı: düğme tıkta YENİDEN yoklar
    let sayac = 0;
    const sonra = await dene({ canSendToClaude: () => Promise.resolve(sayac++ ? 'available' : 'no_session') });
    expect(sonra.bildirim).toBe('Oturum çağrıldı.');
    expect(sonra.gonderilen).toHaveLength(1);
    expect(sonra.w[0]).toMatchObject({ onceki: 'A', konu: 'k' });
  });

  // ODAK — sayfa (kullanıcı 2026-11-11: Parametrik Analiz'e ayrılmış Canlı Not). Şeritte
  // bileşenin adı; program hazır olunca — taşınan proje YÜKLENDİKTEN SONRA (yoksa proje
  // odağın açtığını ezerdi) — köprüden odak istenir, sonucu #cn[data-odak]'ta. Köprü sahte:
  // çerçevenin postMessage'ı cevabı hemen yollar.
  // Proje yüklemesi GEÇ cevaplanır: odak, cevabı beklemeden istenirse sıra bozulur.
  const sahteKopru = (a, cevaplar) => {
    const istenen = [];
    const w = a.cerceve.contentWindow;
    w.postMessage = (m) => {
      const ad = m.ad + (typeof m.veri === 'string' ? ':' + m.veri : '');
      istenen.push(ad);
      const v = cevaplar[m.ad];
      setTimeout(() => {
        istenen.push(ad + ' ✓');
        window.dispatchEvent(new MessageEvent('message', { data: { cn: 1, tur: 'cevap', ad: m.ad, no: m.no, veri: v }, source: w }));
      }, m.ad === 'yukle' ? 20 : 0);
    };
    return { istenen, w };
  };
  const programOlayi = (a, ad) => window.dispatchEvent(new MessageEvent('message',
    { data: { cn: 1, tur: 'olay', ad, veri: {} }, source: a.cerceve.contentWindow }));

  test('ODAK: şeritte bileşenin adı; program hazır olunca odak istenir, taşınan proje ÖNCE yüklenir', async () => {
    const a = sayfa({ ayar: { odak: 'parametrik' } });
    await bekle();
    expect([a.gizli('cn-odak'), a.d.getElementById('cn-odak').textContent]).toEqual([false, 'Parametrik Analiz']);
    a.yayinGonder(yayinB('bbbbbbb', ID('b'), []));
    await bekle();
    const k = sahteKopru(a, { durum: { hazir: true }, yukle: true, odak: { tip: 'mnt-parametric', id: 'comp-9', kurulan: true } });
    programOlayi(a, 'basladi'); programOlayi(a, 'hazir');
    await bekle(40);
    expect(k.istenen).toEqual(['durum', 'durum ✓', 'odak:parametrik', 'odak:parametrik ✓']);
    expect(a.d.getElementById('cn').getAttribute('data-odak')).toBe('tamam');
    // Yenile: açık proje taşınır; yeni programda önce proje, sonra odak
    k.w._veSettingsBuildProjectData = () => ({ proje: 1 });
    a.d.getElementById('cn-yenile').click();
    await bekle();
    const k2 = sahteKopru(a, { durum: { hazir: true }, yukle: true, odak: { tip: 'mnt-parametric', id: 'comp-9', kurulan: false } });
    programOlayi(a, 'basladi'); programOlayi(a, 'hazir');
    await bekle(60);
    expect(k2.istenen).toEqual(['durum', 'durum ✓', 'yukle', 'yukle ✓', 'odak:parametrik', 'odak:parametrik ✓']);
    expect(a.d.getElementById('cn').getAttribute('data-odak')).toBe('tamam');
  });

  test('ODAK: açılamayan bileşen söylenir; odaksız sayfa odak istemez', async () => {
    const a = sayfa({ ayar: { odak: 'parametrik' } });
    await bekle();
    a.yayinGonder(yayinB('bbbbbbb', ID('b'), []));
    await bekle();
    sahteKopru(a, { durum: { hazir: true }, odak: { hata: 'odak: mnt-parametric açılamadı' } });
    programOlayi(a, 'basladi'); programOlayi(a, 'hazir');
    await bekle(40);
    expect(a.d.getElementById('cn').getAttribute('data-odak')).toBe('hata');
    expect(a.d.getElementById('cn-bildirim').textContent).toBe('Parametrik Analiz açılamadı.');
    const b = sayfa();
    await bekle();
    expect(b.gizli('cn-odak')).toBe(true);
    b.yayinGonder(yayinB('bbbbbbb', ID('b'), []));
    await bekle();
    const k = sahteKopru(b, { durum: { hazir: true } });
    programOlayi(b, 'basladi'); programOlayi(b, 'hazir');
    await bekle(40);
    expect(k.istenen).toEqual(['durum', 'durum ✓']);
    expect(b.d.getElementById('cn').hasAttribute('data-odak')).toBe(false);
  });
});

// ═══ PARÇALI YAYIN ═════════════════════════════════════════════════════════
// Kullanıcı 2026-11-11 (boyut sınırı; "Tamam yapalım bakalım"). Program tek metin varlığıydı
// (sınırı 20 MiB) ve 17,2 MiB'a gelmişti — bir haftada 5,3 MiB görsel; sayfanın gömdüğü kopya
// 16 MB'ı çoktan aşmıştı. Artık uzun satırlar (gömülü veri, kütüphane) kendi yuvasında, kalan
// kod iskelette durur. Buradaki hata SESSİZDİR: yanlış birleşen program açılır ama bozuktur.
describe('PARÇALI YAYIN — program yuvalara ayrılır, geri kurma bire bir', () => {
  const crypto = require('crypto');
  const ID = (c) => c.repeat(32);
  // sıkışmayan metin (taban64 görselin yerine): özet zinciri — her koşuda aynı
  const karisik = (n) => Array.from({ length: n }, (_, i) => crypto.createHash('sha256').update('k' + i).digest('base64')).join('');
  const veri = (ad, govde) => 'window.__MFSIM_' + ad + ' = {"a":"data:image/webp;base64,' + govde + '"};';
  const TAKOZ = veri('TAKOZ', karisik(60)), BELGE = veri('BELGE', karisik(40));
  const html = ['<!doctype html>', '<html><head><meta charset="utf-8">', '<script>', 'var kisa = "ğüş $& $1";', TAKOZ, 'var b = 2;', BELGE,
    '</script></head><body>çÇ</body></html>'].join('\n');
  const kunye = { shortSha: 'abcdef1', sha: 'a'.repeat(40), prNumber: 7 };
  const KUCUK = { esik: 1000, sinir: 700 };

  test('uzun satır kendi yuvasında, iskelette yerinde imi; adı globalden; im taşıyan program ayrılmaz', () => {
    const y = T.parcala(html, 1000);
    expect(y.map((x) => x.ad)).toEqual(['kod', 'takoz', 'belge']);
    expect(y[0].metin.split('\n')).toEqual(['<!doctype html>', '<html><head><meta charset="utf-8">', '<script>', 'var kisa = "ğüş $& $1";',
      '@@CN-YUVA:1@@', 'var b = 2;', '@@CN-YUVA:2@@', '</script></head><body>çÇ</body></html>']);
    expect([y[1].metin, y[2].metin]).toEqual([TAKOZ, BELGE]);
    expect(CN.programBirlestir(y.map((x) => x.metin))).toBe(html);
    expect(T.parcala(html).length).toBe(1);                       // gerçek eşik 512 KiB: bu satırlar iskelette kalır
    expect(T.parcala('a\n' + 'x'.repeat(1200) + '\nb', 1000)[1].ad).toBe('satir');   // adsız uzun satır (kütüphane)
    expect(() => T.parcala('a\n@@CN-YUVA:1@@\nb')).toThrow(/yuva imi/);
  });

  test('saklanan biçim: sıkışan yuva gzip, sıkışmayan olduğu gibi, ASCII dışı hep gzip; açınca aynı metin', () => {
    const kod = 'function a() { return 1; }\n'.repeat(500), rasgele = karisik(120);
    expect(T.paketle(kod).sik).toBe('gzip');
    expect(T.paketle(kod).veri.length).toBeLessThan(kod.length / 10);
    expect(T.paketle(rasgele)).toEqual({ sik: 'yok', veri: rasgele });
    expect(T.paketle(rasgele + 'ğ').sik).toBe('gzip');             // saklanan metin ASCII kalır: karakter = bayt
    [kod, rasgele, rasgele + 'ğ', ''].forEach((m) => { const p = T.paketle(m); expect(T.paketAc(p.sik, p.veri)).toBe(m); });
    expect(() => T.paketAc('lz4', 'x')).toThrow(/sıkıştırma/);
    expect(T.bol('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
    expect(T.bol('', 3)).toEqual(['']);
  });

  test('plan: özet içeriğin; sınırı aşan yuva bölünür; plan programı bire bir geri kurar', () => {
    const plan = T.planKur(html, kunye, KUCUK);
    expect([plan.surum, plan.sha, plan.pr, plan.boyut, plan.uzunluk]).toEqual(['abcdef1', 'a'.repeat(40), 7, Buffer.byteLength(html), html.length]);
    expect(plan.boyut).toBeGreaterThan(plan.uzunluk);             // Türkçe harf: bayt ≠ karakter
    expect(plan.yuvalar.map((y) => [y.yuva, y.ad, y.sik, y.parcalar.length])).toEqual([[0, 'kod', 'gzip', 1], [1, 'takoz', 'yok', 4], [2, 'belge', 'yok', 3]]);
    plan.yuvalar.forEach((y) => y.parcalar.forEach((v) => expect(v.length).toBeLessThanOrEqual(700)));
    expect(plan.yuvalar[1].ozet).toBe(T.ozetle(TAKOZ));           // özet İÇERİĞİN: sıkıştırmanın baytına bağlı değil
    expect(plan.yuvalar[1].ozet).toMatch(/^[0-9a-f]{16}$/);
    expect(T.planBirlestir(plan)).toBe(html);
    expect(T.parcaAnahtari(plan.yuvalar[0], 0)).toBe(plan.yuvalar[0].ozet);
    expect(T.parcaAnahtari(plan.yuvalar[1], 1)).toBe(plan.yuvalar[1].ozet + '.2');
    // sabitler: parça sınırı deponun metin varlığı sınırının altında
    expect([T.ESIK, T.PARCA_SINIRI, T.VARLIK_SINIRI]).toEqual([512 * 1024, 12 * 1048576, 20 * 1048576]);
  });

  test('derleme gömülü veriyi TEK satıra yazar (ayrımın dayandığı biçim)', () => {
    const build = fs.readFileSync(path.join(KOK, 'build.js'), 'utf8');
    const satirlar = [...build.matchAll(/'window\.__MFSIM_([A-Z_]+) = ' \+ JSON\.stringify\(([^()]*)\)([^\n]*)/g)];
    expect(satirlar.map((m) => m[1])).toEqual(expect.arrayContaining(['KARSILAMA', 'DEGISIKLIK', 'BELGE', 'TAKOZ', 'KILAVUZ']));
    satirlar.forEach((m) => {
      expect({ ad: m[1], girintisiz: !m[2].includes(',') }).toEqual({ ad: m[1], girintisiz: true });
      expect({ ad: m[1], satirSonu: /';\\n' \+$|';<\/script>';$/.test(m[3]) }).toEqual({ ad: m[1], satirSonu: true });
    });
  });

  test('yayın kaydı: yerinde duran yuva önceki varlığı taşır, yalnız değişen yüklenir; kimliksiz parça adıyla söylenir', () => {
    const dosyala = (plan) => {
      plan.yuvalar.forEach((y) => { y.parcalar = y.parcalar.map((v, i) => ({ dosya: 'parca/' + y.ad + '-' + T.parcaAnahtari(y, i) + '.txt', boyut: v.length })); });
      return plan;
    };
    const p1 = dosyala(T.planKur(html, kunye, KUCUK));
    const anahtarlar = [].concat(...p1.yuvalar.map((y) => y.parcalar.map((_, i) => T.parcaAnahtari(y, i))));
    expect(anahtarlar.length).toBe(8);
    // hiç kimlik verilmedi: hepsi eksik, dosyasıyla
    const bos = T.yayinKur(p1, null, {});
    expect(bos.eksik.map((e) => e.anahtar)).toEqual(anahtarlar);
    expect(bos.eksik[0]).toMatchObject({ ad: 'kod', dosya: p1.yuvalar[0].parcalar[0].dosya });
    // ilk yayın: bütün parçalar yeni
    const verilen = {};
    anahtarlar.forEach((a, i) => { verilen[a] = ID('12345678'[i]); });
    const k1 = T.yayinKur(p1, null, verilen);
    expect([k1.eksik.length, k1.yeni, k1.artik]).toEqual([0, 8, []]);
    expect(k1.parcalar.map((p) => p.yuva)).toEqual([0, 1, 1, 1, 1, 2, 2, 2]);
    const y1 = T.yayinKaydi(kunye, { boyut: p1.boyut, uzunluk: p1.uzunluk, parcalar: k1.parcalar }, [6], '2026-11-11T09:00:00Z');
    expect(CN.yayinDogrula(y1)).toEqual([]);
    expect(T.yayinVarliklari(y1).length).toBe(8);
    // kod değişti: yalnız yuva 0 yüklenir; görseller önceki varlıklarıyla; eski kodun varlığı artık
    const p2 = dosyala(T.planKur(html.replace('var b = 2;', 'var b = 3;'), kunye, KUCUK));
    expect(T.planKarsilastir(p2, y1).map((y) => y.yerinde)).toEqual([false, true, true]);
    expect(T.planKarsilastir(p2, null).map((y) => y.yerinde)).toEqual([false, false, false]);
    expect(T.yayinKur(p2, y1, {}).eksik.map((e) => e.ad)).toEqual(['kod']);
    const k2 = T.yayinKur(p2, y1, { [p2.yuvalar[0].ozet]: ID('9') });
    expect([k2.eksik.length, k2.yeni, k2.artik]).toEqual([0, 1, [ID('1')]]);
    expect(k2.parcalar.slice(1).map((p) => p.id)).toEqual(y1.program.parcalar.slice(1).map((p) => p.id));
    expect(k2.parcalar[0]).toMatchObject({ yuva: 0, id: ID('9'), ad: 'kod', sik: 'gzip' });
    // bölünme sınırı değişse de içerik aynıysa yuva yerinde: önceki parçalar OLDUĞU GİBI taşınır
    const p3 = dosyala(T.planKur(html, kunye, { esik: 1000, sinir: 900 }));
    expect(p3.yuvalar[1].parcalar.length).toBe(3);                // önceki yayında dört parçaydı
    expect(T.planKarsilastir(p3, y1).map((y) => y.yerinde)).toEqual([true, true, true]);
    expect(T.yayinKur(p3, y1, {}).parcalar.map((p) => p.id)).toEqual(y1.program.parcalar.map((p) => p.id));
    // bölünmüş yuvanın yalnız bir parçası yüklendiyse öteki eksik sayılır (yarım yuva kurulmaz)
    const yarim = T.yayinKur(p3, null, { [T.parcaAnahtari(p3.yuvalar[1], 0)]: ID('a') });
    expect(yarim.eksik.map((e) => e.anahtar)).toEqual(expect.arrayContaining([T.parcaAnahtari(p3.yuvalar[1], 1), T.parcaAnahtari(p3.yuvalar[1], 2)]));
    // eski biçimden (tek varlık) geçiş: hepsi yüklenir, eski varlık silinecekler arasında
    const k3 = T.yayinKur(p1, { surum: 'abcdef0', program: { id: ID('e'), boyut: 1 } }, verilen);
    expect([k3.yeni, k3.artik]).toEqual([8, [ID('e')]]);
  });

  test('kayıt doğrulaması: yuva 0 şart, yuvalar sıralı ve boşluksuz, sıkıştırma bilinen; birleştirme eksik yuvayı geçirmez', () => {
    const p = (yuva, sik) => ({ yuva, id: ID('a'), ozet: 'o', sik: sik || 'yok' });
    const y = (parcalar) => ({ surum: 'abcdef1', program: { parcalar } });
    expect(CN.yayinDogrula(y([p(0), p(1), p(1), p(2)]))).toEqual([]);
    expect(CN.yayinDogrula(y([])).join()).toMatch(/parcalar boş/);
    expect(CN.yayinDogrula(y([p(1)])).join()).toMatch(/yuva 0 yok/);
    expect(CN.yayinDogrula(y([p(0), p(2)])).join()).toMatch(/yuva 1 yok/);
    expect(CN.yayinDogrula(y([p(1), p(0)])).join()).toMatch(/sırasız/);
    expect(CN.yayinDogrula(y([p(0, 'lz4')])).join()).toMatch(/sik/);
    expect(CN.yayinDogrula(y([{ yuva: 0, id: 'kisa', sik: 'yok' }])).join()).toMatch(/varlık kimliği/);
    expect(CN.yuvaPlani([p(0), p(1), p(1), p(2)]).map((g) => g.length)).toEqual([1, 2, 1]);
    expect(CN.yuvaImi(3)).toBe('@@CN-YUVA:3@@');
    const iskelet = 'a\n@@CN-YUVA:1@@\nb $& \n@@CN-YUVA:2@@';
    expect(CN.programBirlestir([iskelet, 'X $1', 'Y'])).toBe('a\nX $1\nb $& \nY');      // $ dizileri genişlemez
    expect(() => CN.programBirlestir([iskelet, 'X'])).toThrow(/eksik yuva: 2/);
    expect(() => CN.programBirlestir([iskelet, 'X', 'Y', 'Z'])).toThrow(/yuva sayısı/);
    expect(CN.programBirlestir(['satır içi @@CN-YUVA:1@@ im değil'])).toBe('satır içi @@CN-YUVA:1@@ im değil');
  });

  test('duman kaydı: plan sayfanın okuduğu biçimde; her parçanın dosyası kimliğiyle', () => {
    const plan = T.planKur(html, kunye, KUCUK);
    plan.yuvalar.forEach((y) => { y.parcalar = y.parcalar.map((v, i) => ({ dosya: 'parca/' + y.ad + '-' + i + '.txt', boyut: v.length })); });
    const d = T.dumanKaydi(plan);
    expect(CN.yayinDogrula(d.kayit)).toEqual([]);
    expect(CN.programKaynagi(d.kayit)).toMatchObject({ tur: 'parcali', uzunluk: html.length, surum: 'abcdef1' });
    expect(Object.keys(d.dosya).length).toBe(8);
    expect(new Set(d.kayit.program.parcalar.map((p) => p.id)).size).toBe(8);   // bölünmüş yuvanın parçaları ayrı kimlikte
    d.kayit.program.parcalar.forEach((p) => expect(d.dosya[p.id]).toMatch(/^parca\//));
  });
});

// ═══ İKİ KAPI ══════════════════════════════════════════════════════════════
// Kullanıcı 2026-11-11: "diğer sessionlardan gelen güncellemelerle de bazen karışabiliyor".
// Ölçüldü: her oturum her birleşmeden sonra Canlı Not'taki programı yeniliyordu (üç günde 57
// birleşme; yayın kaydı 6 günde 74 kez yazıldı) ve kaydın sırası denetlenmiyordu — son yazan
// kazanıyor, eski sürüm yenisinin üstüne yazabiliyordu.
describe('İKİ KAPI — tek yazar ve sıra', () => {
  const A = 'https://claude.ai/code/session_01KpdSQRdhtgMzMJyCqXgQ4V', B = 'https://claude.ai/code/session_01KpdSQVRcjQYjKzbhpxWn1H';
  const ID = (c) => c.repeat(32);

  test('oturumun kimliği adresten ve ortamdan; yayını yalnız oturum/aktif\'in gösterdiği oturum yapar', () => {
    expect(T.oturumKimligi(A)).toBe('01KpdSQRdhtgMzMJyCqXgQ4V');
    expect(T.oturumKimligi('')).toBe('');
    const ortam = { CLAUDE_CODE_REMOTE_SDK_URL: 'https://api.anthropic.com/v1/code/sessions/cse_01KpdSQVRcjQYjKzbhpxWn1H' };
    expect(T.oturumAdresi({}, ortam)).toBe(B);                    // bulut oturumunun kimliği ortamdan
    expect(T.oturumAdresi({ oturum: A }, ortam)).toBe(A);         // bayrak ortamın önünde
    expect(T.oturumAdresi({}, { MFSIM_OTURUM: A })).toBe(A);
    expect(T.oturumAdresi({}, {})).toBe('');
    expect(T.sahipHukmu({ oturum: A }, A)).toEqual({ sahip: true });
    expect(T.sahipHukmu({ oturum: A, zaman: 'x' }, B)).toEqual({ sahip: false, sebep: 'Canlı Not şu oturumda: ' + A });
    expect(T.sahipHukmu(null, B).sebep).toMatch(/sahiplik kaydı okunmadı/);
    expect(T.sahipHukmu({ oturum: A }, '').sebep).toMatch(/--oturum/);
  });

  test('sıra: ileri ve aynı sürüm yayınlanır, KESİN geri gidiş yayınlanmaz, bilinmeyen engellemez', () => {
    const tablo = (t) => (a, b) => (a + '>' + b in t ? t[a + '>' + b] : null);
    expect(T.siraHukmu('a', 'a', () => { throw new Error('sorulmaz'); })).toEqual({ durum: 'ayni', yayinla: true });
    expect(T.siraHukmu('', 'b', tablo({}))).toEqual({ durum: 'ayni', yayinla: true });                           // ilk yayın
    expect(T.siraHukmu('a', 'b', tablo({ 'a>b': true }))).toEqual({ durum: 'ileri', yayinla: true });
    expect(T.siraHukmu('b', 'a', tablo({ 'b>a': false, 'a>b': true }))).toEqual({ durum: 'geri', yayinla: false });
    expect(T.siraHukmu('a', 'b', tablo({ 'a>b': false, 'b>a': false }))).toEqual({ durum: 'bilinmiyor', yayinla: true });   // ayrışmış
    expect(T.siraHukmu('a', 'b', tablo({}))).toEqual({ durum: 'bilinmiyor', yayinla: true });                    // sığ klon: commit yerelde yok
  });

  test('yayin komutu: sahibi olmayan oturum, dal kurulumu ve yüklenmemiş parça kaydı YAZAMAZ; sahibi yazar', () => {
    const os = require('os');
    const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-yayin-')), dokum = path.join(dizin, 'dokum');
    fs.mkdirSync(path.join(dokum, 'oturum'), { recursive: true });
    fs.mkdirSync(path.join(dokum, 'yayin'), { recursive: true });
    const oz = ['1111111111111111', '2222222222222222'];
    const plan = { surum: 'abcdef1', sha: 'a'.repeat(40), pr: 9, boyut: 30, uzunluk: 28, yuvalar: [
      { yuva: 0, ad: 'kod', ozet: oz[0], sik: 'gzip', uzunluk: 10, parcalar: [{ dosya: 'parca/kod-' + oz[0] + '.txt', boyut: 12 }] },
      { yuva: 1, ad: 'takoz', ozet: oz[1], sik: 'yok', uzunluk: 18, parcalar: [{ dosya: 'parca/takoz-' + oz[1] + '.txt', boyut: 18 }] }] };
    const planYol = path.join(dizin, 'yayin-plan.json'), sonYol = path.join(dizin, 'yayin-son.json');
    const yaz = (yol, v) => fs.writeFileSync(yol, JSON.stringify(v));
    yaz(planYol, plan);
    // yayında aynı sürüm, eski biçimde (tek varlık) — sıra "aynı": git'e sorulmaz
    yaz(path.join(dokum, 'yayin', 'son.json'), { id: 'son', version: 74, data: { surum: 'abcdef1', sha: 'a'.repeat(40), pr: 9, program: { id: ID('e'), boyut: 30 }, notlar: [] } });
    const kos = (ek) => T.yayin(Object.assign({ kaynak: planYol, dokum, oturum: B }, ek));
    const kimlikler = { [oz[0]]: ID('a'), [oz[1]]: ID('b') };
    const gunluk = [];
    const casus = jest.spyOn(console, 'log').mockImplementation((m) => gunluk.push(String(m)));
    try {
      expect(() => kos({ parca: kimlikler })).toThrow(/TEK YAZAR[\s\S]*sahiplik kaydı okunmadı/);
      yaz(path.join(dokum, 'oturum', 'aktif.json'), { id: 'aktif', version: 2, data: { oturum: A, zaman: 'x' } });
      expect(() => kos({ parca: kimlikler })).toThrow(new RegExp('TEK YAZAR[\\s\\S]*' + A));
      expect(fs.existsSync(sonYol)).toBe(false);                   // sahibi olmayan hiçbir şey yazmadı
      yaz(path.join(dokum, 'oturum', 'aktif.json'), { oturum: B, zaman: 'x' });     // çıplak döküm de okunur
      expect(() => kos({})).toThrow(new RegExp('yüklenmemiş parça[\\s\\S]*--parca ' + oz[0] + '=<id>[\\s\\S]*takoz-' + oz[1]));
      expect(() => kos({ program: ID('a') })).toThrow(/--program kalktı/);
      expect(fs.existsSync(sonYol)).toBe(false);
      // sahibi, bütün parçalar yüklü: kayıt yazılır; sürüm kilidi ve silinecek eski varlık söylenir
      const r = kos({ parca: kimlikler, notlar: [6] });
      const kayit = JSON.parse(fs.readFileSync(sonYol, 'utf8'));
      expect(kayit).toEqual(r.kayit);
      expect(CN.yayinDogrula(kayit)).toEqual([]);
      expect([kayit.oturum, kayit.notlar, kayit.program.parcalar.map((p) => p.id)]).toEqual([B, [6], [ID('a'), ID('b')]]);
      expect([kayit.program.boyut, kayit.program.uzunluk]).toEqual([30, 28]);
      expect([r.artik, r.sira.durum, r.surum]).toEqual([[ID('e')], 'ayni', 74]);
      expect(gunluk.join('\n')).toMatch(/if_version:74/);
      expect(gunluk.join('\n')).toMatch(new RegExp('Artifact delete url:<adres> path:' + ID('e')));
      // dal kurulumu yayınlanmaz
      yaz(planYol, Object.assign({}, plan, { dal: true }));
      expect(() => kos({ parca: kimlikler })).toThrow(/DAL KURULUMU/);
      // önceki yayın okunmadıysa yazılmaz (kayıt hiç yoksa --ilk)
      yaz(planYol, plan);
      fs.unlinkSync(path.join(dokum, 'yayin', 'son.json'));
      expect(() => kos({ parca: kimlikler })).toThrow(/önceki yayın okunmadı/);
      expect(kos({ parca: kimlikler, ilk: true }).artik).toEqual([]);
    } finally { casus.mockRestore(); }
  });

  test('kural yazılı: teslim akışında Canlı Not\'u yalnız sahibi günceller', () => {
    const kural = fs.readFileSync(path.join(KOK, 'CLAUDE.md'), 'utf8');
    expect(kural).toMatch(/CANLI NOT'U YALNIZ SAHİBİ OTURUM GÜNCELLER/);
    const skill = fs.readFileSync(path.join(KOK, '.claude', 'skills', 'canli-not', 'SKILL.md'), 'utf8');
    expect(skill).toMatch(/TEK YAZAR/);
    expect(skill).toMatch(/node tools\/canli-not\.js yayin --parca/);
    expect(skill).not.toMatch(/yayin --program/);                  // eski tek varlık komutu belgede kalmadı
  });
});

// ═══ SONUÇ ═════════════════════════════════════════════════════════════════
// Kullanıcı 2026-11-05: "yeni session açıp, 'bana Canlı Not'u getir' dediğim
// zaman, aynı bu yapıda, aynı bu şekilde, değişmeden canlı not özelliğinin o
// sessiona gelmesini istiyorum." Sonucun görüntüsü her oturumda elle yazılan
// bir Playwright kalıbıydı; komut onun yerine — kalıbın parçaları burada tutulur.
describe('SONUÇ — sonucun görüntüsü tek komutla', () => {
  test('bayraklar: modül, örnek, hazırlık, seçici, pay, ekran; bozuk değer SESSİZCE yutulmaz', () => {
    const o = T.ayristir(['sonuc', '36', '--modul', 'takoz', '--ornek', 'tulga', '--hazirlik', 'h.js', '--secici', '#x .y', '--pay', '6', '--ekran', '1366x768']);
    expect(o.komut).toBe('sonuc');
    expect(o.konum).toEqual(['36']);
    expect([o.modul, o.ornek, path.basename(o.hazirlik), o.secici, o.pay]).toEqual(['takoz', 'tulga', 'h.js', '#x .y', 6]);
    expect(o.ekran).toEqual({ width: 1366, height: 768 });
    expect(() => T.ayristir(['sonuc', '1', '--ekran', '1366*768'])).toThrow(/--ekran/);
    expect(() => T.ayristir(['sonuc', '1', '--modul', 'takozlar'])).toThrow(/--modul: takoz · fead · arac/);
    expect(() => T.ayristir(['sonuc', '1', '--ornek', 'tulga'])).toThrow(/yalnız --modul takoz/);
    expect(() => T.ayristir(['sonuc', '1', '--modul', 'fead', '--ornek', 'tulga'])).toThrow(/yalnız --modul takoz/);
    expect(() => T.ayristir(['sonuc', '1', '--pay', '-3'])).toThrow(/--pay/);
    expect(() => T.ayristir(['sonuc', '1', '--seçici', 'x'])).toThrow(/bilinmeyen bayrak/);
    expect(T.ayristir(['sonuc', '33', '--alan', '0, 0, 520, 220']).alan).toEqual({ x: 0, y: 0, width: 520, height: 220 });
    ['0,0,520', '0,0,0,220', '-1,0,10,10', 'a,b,c,d'].forEach((v) => expect(() => T.ayristir(['sonuc', '1', '--alan', v])).toThrow(/--alan x,y,g,y/));
    expect(() => T.ayristir(['sonuc', '1', '--alan', '0,0,10,10', '--secici', '#x'])).toThrow(/birlikte olmaz/);
  });
  test('giriş programın kendi özetinden (sabit yazılmaz); modülün kartı ve açıcısı programda var', () => {
    const auth = fs.readFileSync(path.join(KOK, 'js', 'auth.js'), 'utf8');
    expect(T.girisAnahtari()).toMatch(/^[0-9a-f]{64}$/);
    expect(auth).toContain("var MFSIM_AUTH_HASH = '" + T.girisAnahtari() + "'");
    expect(auth).toMatch(/MFSIM_AUTH_KEY = 'mfsim_auth_token'/);   // komutun yazdığı anahtar
    const comp = fs.readFileSync(path.join(KOK, 'js', 'components.js'), 'utf8');
    const js = fs.readdirSync(path.join(KOK, 'js')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(KOK, 'js', f), 'utf8')).join('\n');
    Object.entries(T.MODUL_GIRIS).forEach(([ad, g]) => {
      expect({ ad, tip: comp.includes("'" + g.tip + "': {") }).toEqual({ ad, tip: true });
      expect({ ad, acici: new RegExp('^function ' + g.ac + '\\(', 'm').test(js) }).toEqual({ ad, acici: true });
    });
    // örneği kuran ve karşılamayı kapatan çağrılar da programda
    expect(js).toMatch(/^function veMntOrnekYukle\(/m);
    expect(js).toMatch(/^function veSelectModuleFromOverlay\(/m);
  });
  test('yayındaki sayfa bugünkü kaynaktan mı: ayar satırı hariç aynı; şablon değişince ESKİ, künyesi okunur', () => {
    const sablon = fs.readFileSync(path.join(KOK, 'tools', 'canli-not.html'), 'utf8');
    const cekirdek = fs.readFileSync(path.join(KOK, 'tools', 'canli-not-cekirdek.js'), 'utf8');
    const ayar = { surum: 'abc1234', pr: '1246', zaman: '2026-11-05T12:00:00.000Z', boyut: 11980000 };
    const yayinda = T.sayfaKur(sablon, cekirdek, ayar);
    expect(T.sayfaHukmu(yayinda, sablon, cekirdek)).toEqual({ guncel: true, ayar });
    // platformun iskeleti sarsa da (sayfa <title> ile başlıyor) aynı
    expect(T.sayfaHukmu('<!doctype html><html><head>' + yayinda + '</body></html>', sablon, cekirdek).guncel).toBe(true);
    // başka zaman, başka boyut: yine güncel (ayar satırı karşılaştırılmaz)
    expect(T.sayfaHukmu(T.sayfaKur(sablon, cekirdek, Object.assign({}, ayar, { zaman: 'x', boyut: 1 })), sablon, cekirdek).guncel).toBe(true);
    // şablon ya da çekirdek değişti: ESKİ, künye yine okunur
    const eski = T.sayfaKur(sablon.replace('</title>', ' </title>'), cekirdek, ayar);
    expect(T.sayfaHukmu(eski, sablon, cekirdek)).toEqual({ guncel: false, ayar });
    expect(T.sayfaHukmu(T.sayfaKur(sablon, cekirdek + '\n', ayar), sablon, cekirdek).guncel).toBe(false);
  });
  test('yardım komutu anlatır; sonucun yeri notun numarasıyla', () => {
    const yardim = fs.readFileSync(path.join(KOK, 'tools', 'canli-not.js'), 'utf8');
    expect(yardim).toMatch(/node tools\/canli-not\.js sonuc <N>/);
    expect(yardim).toMatch(/'\.canli-not', 'sonuc', 'not-' \+ no \+ '\.png'/);
  });
});

// ═══ ODAK ══════════════════════════════════════════════════════════════════
// Kullanıcı 2026-11-11: *"'takoz çökme ve titreşim' modülünün sadece 'parametrik analiz'
// bileşeni ile uğraşacağız … sadece bu bileşene ait bir 'canlı not' oluşturmanı istiyorum"*.
// Odaklı sayfa ayrı bir Artifact; program her açılışta o bileşende açılır. İki hata da
// SESSİZ: tarif programda olmayan bir işlevi çağırırsa sayfa açılır ama pencere açılmaz;
// iki sayfa aynı numarayı verirse "Canlı not N"in görseli başka notun görselini ezer.
describe('ODAK — bileşene ayrılmış Canlı Not', () => {
  const jsKaynak = () => fs.readdirSync(path.join(KOK, 'js')).filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(KOK, 'js', f), 'utf8')).join('\n');

  test('odaklar çekirdekte, tarifleri köprüde; tarifin dokunduğu her şey programda var', () => {
    expect(Object.keys(K.ODAKLAR).sort()).toEqual(Object.keys(CN.ODAKLAR).sort());
    const js = jsKaynak();
    Object.keys(CN.ODAKLAR).forEach((ad) => {
      const o = CN.ODAKLAR[ad], kaynak = K.ODAKLAR[ad].toString();
      expect(Boolean(o.ad && o.baslik && o.tip && o.taban > 0)).toBe(true);
      expect(js).toContain("'" + o.tip + "': {");
      expect(kaynak).toContain("TIP = '" + o.tip + "'");
      const islevler = [...new Set([...kaynak.matchAll(/win\.([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]))]
        .filter((f) => f !== 'setTimeout');
      expect(islevler.length).toBeGreaterThan(6);
      islevler.forEach((f) => expect([f, new RegExp('^function ' + f + '\\(', 'm').test(js)]).toEqual([f, true]));
      ['nodes', 'componentDefs', 'veMntStack'].forEach((g) => expect([g, new RegExp('^var ' + g + '\\b', 'm').test(js)]).toEqual([g, true]));
      const ornek = /ORNEK = '([a-z]+)'/.exec(kaynak)[1];
      expect(fs.readFileSync(path.join(KOK, 'js', 'mount-core.js'), 'utf8')).toMatch(new RegExp('\\n {4}' + ornek + ': \\{'));
      expect(kaynak).toContain("'ve-mnt-param-btn-'");                  // pencerenin Tara düğmesi
      expect(fs.readFileSync(path.join(KOK, 'js', 'cp-mount-param.js'), 'utf8')).toContain("ve-mnt-param-btn-'");
    });
    expect(CN.odakBul('yok')).toBeNull();
    expect(CN.odakBul('toString')).toBeNull();
  });

  test('not numarası: odaklı sayfa kendi aralığında; ana sayfa odakların aralığını atlar', () => {
    const n = (no) => ({ no });
    expect(CN.sonrakiNo([], 'parametrik')).toBe(1001);
    expect(CN.sonrakiNo([n(1001), n(1004)], 'parametrik')).toBe(1005);
    expect(CN.sonrakiNo([])).toBe(1);
    expect(CN.sonrakiNo([n(131), n(132)])).toBe(133);
    expect(CN.sonrakiNo([n(999)])).toBe(1000);
    expect(CN.sonrakiNo([n(1000)])).toBe(1000 + CN.NO_ARALIK + 1);    // ana sayfa aralığa girmez
    const sablon = fs.readFileSync(path.join(KOK, 'tools', 'canli-not.html'), 'utf8');
    expect(sablon).toContain('CN.sonrakiNo(notlar, AYAR.odak)');
  });

  // Sahte program: yalnız tarifin dokunduğu globaller. `w` verilirse (köprünün jsdom
  // çerçevesi) işlevler ona takılır ve gerçek belge kullanılır.
  function sahteProgram(o, w) {
    o = o || {};
    w = w || { document: { getElementById: (id) => w.__dom[id] || null }, setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 5)) };
    w.__dom = {};
    const gercek = typeof w.document.createElement === 'function';
    const dugumYaz = (id) => { if (gercek) { const e = w.document.createElement('button'); e.id = id; w.document.body.appendChild(e); } else w.__dom[id] = {}; };
    if (o.karsilama) { if (gercek) { const e = w.document.createElement('div'); e.id = 've-module-overlay'; w.document.body.appendChild(e); } else w.__dom['ve-module-overlay'] = { style: { display: 'flex' } }; }
    Object.assign(w, {
      nodes: (o.nodes || []).slice(), veMntStack: o.takozda ? [{}] : [], cagri: [], secili: null,
      componentDefs: { 'mnt-motor': { isMountBody: true }, 'mnt-mount': { isMount: true }, 'mnt-report': {}, 'mnt-wizard': {},
        'mnt-parametric': { defaultWidth: 60, defaultHeight: 56 }, 'mount-analysis': {} }
    });
    let say = 0;
    w.veSelectModuleFromOverlay = (m) => w.cagri.push(['karsilama', m]);
    w.veStartModule = (t) => { w.cagri.push(['modul', t]); setTimeout(() => w.veMntStack.push({}), 5); };
    w.veMntOpenEditor = (id) => { w.cagri.push(['kart', id]); w.veMntStack.push({}); w.nodes = (o.ic || []).slice(); };
    w.veMntOrnekYukle = (k) => {                                     // Tulga'nın araç şeridi
      w.cagri.push(['ornek', k]);
      w.nodes.push({ id: 'm', type: 'mnt-motor', x: 540, y: 392, width: 108, height: 76 },
        { id: 'r', type: 'mnt-report', x: 1345, y: 163, width: 60, height: 56 },
        { id: 's', type: 'mnt-wizard', x: 1240, y: 163, width: 60, height: 56 });
    };
    w.createNode = (t, x, y) => {
      if (o.kurulmaz) return null;
      const n = { id: 'p' + (++say), type: t, x, y, width: 60, height: 56 };
      w.nodes.push(n); w.cagri.push(['kur', t, x, y]); return n;
    };
    w.veStateResetBaseline = () => w.cagri.push(['taban']);
    w.clearSelection = () => { w.secili = null; };
    w.addToSelection = (n) => { w.secili = n; };
    w.veTogglePropertiesPanel = (acik) => { w.cagri.push(['pencere', acik, w.secili && w.secili.id]); if (w.secili) dugumYaz('ve-mnt-param-btn-' + w.secili.id); };
    return w;
  }
  const tarif = (w) => K.ODAKLAR.parametrik(w);

  test('tarif, boş programda: karşılamanın Takoz yolu → örnek → bileşen araç şeridinin boş yerinde → pencere; açılış geri alınamaz', async () => {
    const w = sahteProgram({ karsilama: true });
    const r = await tarif(w);
    expect(w.cagri).toEqual([['modul', 'mount-analysis'], ['ornek', 'tulga'], ['kur', 'mnt-parametric', 1345, 323],
      ['taban'], ['pencere', true, 'p1']]);
    expect(r).toEqual({ tip: 'mnt-parametric', id: 'p1', kurulan: true });
  });

  test('tarif YERİNDEKİNİ kullanır: Takoz içindeyken ve bileşen varken hiçbir şey kurmaz, geri-al tabanına dokunmaz', async () => {
    const ic = [{ id: 'm', type: 'mnt-motor', x: 540, y: 392 }, { id: 'p7', type: 'mnt-parametric', x: 1240, y: 323 }];
    const w = sahteProgram({ takozda: true, nodes: ic });
    expect(await tarif(w)).toEqual({ tip: 'mnt-parametric', id: 'p7', kurulan: false });
    expect(w.cagri).toEqual([['pencere', true, 'p7']]);
    // taşınan proje kökte: karşılama kapanır, kartın İÇİNE girilir (modül yeniden kurulmaz)
    const k = sahteProgram({ karsilama: true, nodes: [{ id: 'kart', type: 'mount-analysis', x: 0, y: 0 }], ic });
    expect((await tarif(k)).kurulan).toBe(false);
    expect(k.cagri).toEqual([['karsilama', 'arac-performans'], ['kart', 'kart'], ['pencere', true, 'p7']]);
    // dolu yer atlanır: Rapor'un altı doluysa solu (şeridin 105 px adımı adlarla sığar)
    const rapor = { id: 'r', type: 'mnt-report', x: 1345, y: 163, width: 60, height: 56 };
    const d = sahteProgram({ takozda: true, nodes: [{ id: 'm', type: 'mnt-motor', x: 540, y: 392 }, rapor,
      { id: 'v', type: 'mnt-viewer', x: 1345, y: 323, width: 60, height: 56 }] });
    await tarif(d);
    expect(d.cagri[0]).toEqual(['kur', 'mnt-parametric', 1240, 323]);
    // gruplama çerçevesinin çizgisine adı değen aday atlanır (Tulga'da Görselleştirici)
    const c = sahteProgram({ takozda: true, nodes: [{ id: 'm', type: 'mnt-motor', x: 540, y: 392 }, rapor] });
    c.annotations = [{ type: 'frame', x: 1000, y: 293, width: 330, height: 130 }, { type: 'text', x: 0, y: 0 }];
    await tarif(c);
    expect(c.cagri[0]).toEqual(['kur', 'mnt-parametric', 1450, 163]);
    // hiçbir aday boş değilse her şeyin sağı, en üst sırada
    const e = sahteProgram({ takozda: true, nodes: [{ id: 'm', type: 'mnt-motor', x: 540, y: 392, width: 108, height: 76 }, rapor,
      { id: 'v', type: 'mnt-viewer', x: 1345, y: 323, width: 60, height: 56 },
      { id: 'g', type: 'mnt-2dview', x: 1240, y: 323, width: 60, height: 56 }, { id: 'l', type: 'mnt-library', x: 1450, y: 163, width: 60, height: 56 }] });
    await tarif(e);
    expect(e.cagri[0]).toEqual(['kur', 'mnt-parametric', 1600, 163]);
  });

  test('tarif kurulamayan bileşeni söyler (sessizce bitmez)', async () => {
    await expect(tarif(sahteProgram({ takozda: true, nodes: [{ id: 'm', type: 'mnt-motor', x: 0, y: 0 }], kurulmaz: true })))
      .rejects.toThrow(/kurulamadı/);
  });

  test('köprü: "odak" isteği tarifi koşar ve sonucunu cevaplar; bilinmeyen odak hata döner', async () => {
    const fr = document.createElement('iframe');
    document.body.appendChild(fr);
    const w = fr.contentWindow;
    K.kur(w);
    sahteProgram({ takozda: true, nodes: [{ id: 'm', type: 'mnt-motor', x: 0, y: 0 }, { id: 'p3', type: 'mnt-parametric', x: 1, y: 1 }] }, w);
    const gelen = [];
    const dinle = (e) => { if (e.data && e.data.cn === 1 && e.data.tur === 'cevap') gelen.push(e.data); };
    window.addEventListener('message', dinle);
    const istek = (veri, no) => w.dispatchEvent(new w.MessageEvent('message', { data: { cn: 1, tur: 'istek', ad: 'odak', no, veri }, source: window }));
    istek('parametrik', 1); istek('yok', 2);
    await new Promise((r) => setTimeout(r, 400));
    window.removeEventListener('message', dinle);
    expect(gelen.find((m) => m.no === 1).veri).toEqual({ tip: 'mnt-parametric', id: 'p3', kurulan: false });
    expect(gelen.find((m) => m.no === 2).veri).toEqual({ hata: 'odak yok: yok' });
    expect(w.document.getElementById('ve-mnt-param-btn-p3')).not.toBeNull();
  });

  test('sayfa: odaklı sayfanın adı kendi başlığı; denetim onu tanır ve güncel bulur; şablon değişince ESKİ', () => {
    const sablon = fs.readFileSync(path.join(KOK, 'tools', 'canli-not.html'), 'utf8');
    const cekirdek = fs.readFileSync(path.join(KOK, 'tools', 'canli-not-cekirdek.js'), 'utf8');
    expect(sablon).toContain(T.BASLIK_CAPA);
    const ana = T.sayfaKur(sablon, cekirdek, { surum: 'abc1234', pr: 7 });
    const odakli = T.sayfaKur(sablon, cekirdek, { surum: 'abc1234', pr: 7, odak: 'parametrik' });
    expect(ana).toContain('<title>MFSim Canlı Not</title>');
    expect(odakli).toContain('<title>' + CN.ODAKLAR.parametrik.baslik + '</title>');
    expect(odakli).not.toContain(T.BASLIK_CAPA);
    expect(T.sayfaHukmu(odakli, sablon, cekirdek)).toEqual({ guncel: true, ayar: { surum: 'abc1234', pr: 7, odak: 'parametrik' } });
    expect(T.sayfaHukmu(odakli, sablon.replace('Kayda bağlanıyor…', 'Kayda bağlanılıyor…'), cekirdek).guncel).toBe(false);
    const os = require('os');
    const dosya = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cn-odak-')), 'index.html');
    fs.writeFileSync(dosya, odakli);
    const cikti = [];
    const gunluk = jest.spyOn(console, 'log').mockImplementation((m) => cikti.push(String(m)));
    try { expect(T.denetle({ konum: [dosya] }).guncel).toBe(true); } finally { gunluk.mockRestore(); }
    expect(cikti.join('\n')).toMatch(/Sayfa güncel .*odak Parametrik Analiz/);
  });

  test('araç: --odak tanınır, dizinleri ayrı; bilinmeyen odak ve --modul ile birlikte SESSİZCE yutulmaz', () => {
    const o = T.ayristir(['hazirla', '--odak', 'parametrik']);
    expect(o.odak).toBe('parametrik');
    expect(path.relative(KOK, T.yayinDizini(o))).toBe(path.join('.canli-not', 'parametrik', 'yayin'));
    expect(path.relative(KOK, T.dokumDizini(o))).toBe(path.join('.canli-not', 'parametrik', 'dokum'));
    expect(path.relative(KOK, T.yayinDizini({}))).toBe(path.join('.canli-not', 'yayin'));
    expect(path.relative(KOK, T.dokumDizini({}))).toBe(path.join('.canli-not', 'dokum'));
    expect(() => T.ayristir(['hazirla', '--odak', 'yok'])).toThrow(/--odak: parametrik/);
    expect(() => T.ayristir(['sonuc', '5', '--odak', 'parametrik', '--modul', 'takoz'])).toThrow(/--odak/);
    expect(T.ayristir(['sonuc', '1001', '--odak', 'parametrik', '--secici', '#ve-properties']).odak).toBe('parametrik');
  });
});
