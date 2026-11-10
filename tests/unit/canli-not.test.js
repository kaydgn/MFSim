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
 *   SONUÇ      `sonuc` komutu (her oturumun aynı kalıbı): bayraklar sessizce
 *              yutulmaz; giriş js/auth.js'in özetinden, modülün açıcısı programda var
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

  // İKİ SINIR (kullanıcı 2026-11-10: "Canlı notu güncelleyelim"): AMC görselleri programı 14,5 →
  // 17,8 MB yaptı. Tek 16 MB denetimi programın GÜNCELLEMESİNİ de durduruyordu; oysa güncelleme
  // varlık olarak gider (metin varlığı 20 MiB) ve 17,8 MiB'lık kopya kabul edildi. 16 MB yalnız
  // sayfanın gömdüğü kopya içindir.
  test('SINIR: varlık 20 MiB\'a, sayfaya gömülü kopya 16 MiB\'a kadar; ikisi ayrı hüküm', () => {
    const MiB = 1048576;
    expect(T.SINIR).toBe(16 * MiB);
    expect(T.VARLIK_SINIRI).toBe(20 * MiB);
    expect(T.sinirHukmu(11.4 * MiB)).toEqual({ varlik: true, sayfa: true });          // Not 27 çağındaki program
    expect(T.sinirHukmu(16 * MiB)).toEqual({ varlik: true, sayfa: true });            // sınırın kendisi sığar
    expect(T.sinirHukmu(16 * MiB + 1)).toEqual({ varlik: true, sayfa: false });       // yalnız varlık
    expect(T.sinirHukmu(18675972)).toEqual({ varlik: true, sayfa: false });           // AMC görselleriyle program
    expect(T.sinirHukmu(20 * MiB)).toEqual({ varlik: true, sayfa: false });
    expect(T.sinirHukmu(20 * MiB + 1)).toEqual({ varlik: false, sayfa: false });      // hiçbiri
  });

  test('hazırla: 16 MB\'ı aşan program varlık olarak hazırlanır (durmaz), sayfa yayını kapalı söylenir', () => {
    const arac = fs.readFileSync(path.join(KOK, 'tools/canli-not.js'), 'utf8');
    expect(arac).toMatch(/if \(!hukum\.varlik\) \{\s*throw new Error/);              // yalnız 20 MB aşılınca durur
    expect(arac).not.toMatch(/if \(boyut > SINIR\) \{\s*throw/);                     // eski tek sınır dönmedi
    expect(arac).toContain("'YAPILAMAZ (program 16 MB\\'ı aşıyor)'");                  // sayfa yayını sebebiyle kapalı
  });
});

// ═══ GÜNCELLİK ═════════════════════════════════════════════════════════════
// Kullanıcı 2026-11-05: "güncelliğinden emin olalım, öyle devam edelim".
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
    // Canlı Not'un kendi dosyaları da girdi
    ['tools/canli-not.html', 'tools/canli-not-kopru.js', 'tools/canli-not-cekirdek.js', 'tools/canli-not.js']
      .forEach((f) => expect(T.GIRDILER).toContain(f));
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

  test('açılışın kaynağı: kayıttaki yayın gömülü programdan başkaysa varlık, değilse dosya', () => {
    expect(CN.programKaynagi(yayinB('abcdef1', ID('a')), 'abcdef1')).toEqual({ tur: 'dosya' });
    expect(CN.programKaynagi(yayinB('abcdef2', ID('b')), 'abcdef1')).toEqual({ tur: 'varlik', id: ID('b'), surum: 'abcdef2', pr: 1300 });
    expect(CN.programKaynagi(null, 'abcdef1')).toEqual({ tur: 'dosya' });
    expect(CN.programKaynagi({ surum: 'abcdef2' }, 'abcdef1')).toEqual({ tur: 'dosya' });
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
    const o = T.ayristir(['yayin', '--program', ID('e'), '--notlar', '6,8-9']);
    expect([o.komut, o.program, o.notlar]).toEqual(['yayin', ID('e'), [6, 8, 9]]);
    const k = { sha: 'f'.repeat(40), shortSha: 'fffffff', prNumber: 1301 };
    const y = T.yayinKaydi(k, { id: ID('e'), boyut: 11 }, [6], '2026-11-05T12:00:00Z');
    expect(y).toEqual({ surum: 'fffffff', sha: 'f'.repeat(40), pr: 1301, zaman: '2026-11-05T12:00:00Z', program: { id: ID('e'), boyut: 11 }, notlar: [6] });
    expect(() => T.yayinKaydi(k, { id: 'kisa' }, [])).toThrow(/program\.id/);
    expect(T.yayinOku({ id: 'son', version: 2, data: y })).toEqual({ sha: 'f'.repeat(40), shortSha: 'fffffff', prNumber: 1301 });
    expect(T.yayinOku(y).shortSha).toBe('fffffff');
    expect(() => T.yayinOku({ no: 1 })).toThrow(/yayın belgesi/);
  });

  // Sayfanın KENDİSİ (şablon + çekirdek, sayfaKur) bu pencerede: işaretleme
  // gövdeye, betikler genel kapsamda; sahte kayıt ve varlık deposu. Çerçeve
  // kaynaksız başlar, kaynağı kayıt seçer.
  const bekle = (ms) => new Promise((r) => setTimeout(r, ms || 15));
  function sayfa() {
    const sablon = fs.readFileSync(path.join(KOK, 'tools', 'canli-not.html'), 'utf8');
    const cekirdek = fs.readFileSync(path.join(KOK, 'tools', 'canli-not-cekirdek.js'), 'utf8');
    const tam = T.sayfaKur(sablon, cekirdek, { surum: 'aaaaaaa', pr: 1290 });
    const dinle = {}, getirilen = [];
    const db = {
      collection: (p) => ({ orderBy: () => ({ onSnapshot: (f) => { dinle[p] = f; f({ docs: [] }); return () => {}; } }) }),
      doc: (p) => ({ onSnapshot: (f) => { dinle[p] = f; return () => {}; }, update: () => Promise.resolve(), set: () => Promise.resolve() })
    };
    document.body.innerHTML = tam.replace(/<script>[\s\S]*?<\/script>/g, '');
    window.claude = { use: (ad) => Promise.resolve(ad === 'db' ? db : null) };
    window.fetch = (u) => { getirilen.push(u); return Promise.resolve({ ok: true, text: () => Promise.resolve('<!doctype html><html><body>' + u + '</body></html>') }); };
    [...tam.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m) => (0, eval)(m[1]));
    const d = document;
    const yayinGonder = (y) => dinle['yayin/son']({ exists: !!y, data: () => y, metadata: { fromCache: false } });
    const notGonder = (liste) => dinle.notlar({ docs: liste.map((n) => ({ id: n.id, data: () => n })) });
    return { d, getirilen, yayinGonder, notGonder, cerceve: d.getElementById('cn-program'), gizli: (id) => d.getElementById(id).hidden };
  }
  afterAll(() => { delete window.claude; delete window.fetch; delete window.CanliNot; document.body.innerHTML = ''; });

  test('şablon: çerçeve KAYNAKSIZ başlar; sayfa yeniden yüklenmez; gizli kural ezilmez', () => {
    const sablon = fs.readFileSync(path.join(KOK, 'tools', 'canli-not.html'), 'utf8');
    expect(sablon).toMatch(/<iframe class="cn-program" id="cn-program" title="MFSim"><\/iframe>/);
    expect(sablon).not.toMatch(/location\.reload|location\.href\s*=/);
    expect(sablon).toMatch(/\[hidden\] \{ display: none !important; \}/);
    expect(sablon).toContain("yetki.db.doc('yayin/son').onSnapshot(");
  });

  test('açılış: kayıttaki yeni yayın varlıktan yüklenir; yayın yoksa dosya', async () => {
    const a = sayfa();
    await bekle();
    a.yayinGonder(yayinB('bbbbbbb', ID('b'), [6]));
    await bekle();
    expect(a.getirilen).toEqual(['/_blob/' + ID('b')]);
    expect(a.cerceve.getAttribute('srcdoc')).toContain(ID('b'));
    expect(a.cerceve.hasAttribute('src')).toBe(false);
    expect(a.d.getElementById('cn-surum').textContent).toBe('bbbbbbb · #1300');
    expect(a.gizli('cn-guncel')).toBe(true);                    // açılışta sormaz: yüklenen zaten en yenisi
    const b = sayfa();
    await bekle();
    b.yayinGonder(null);
    await bekle();
    expect(b.getirilen).toEqual([]);
    expect(b.cerceve.getAttribute('src')).toBe('mfsim.html');
    expect(b.d.getElementById('cn-surum').textContent).toBe('aaaaaaa · #1290');
  });

  test('açıkken gelen yayın programı DEĞİŞTİRMEZ: pencere sorar; Güncelle yükler, Sonra erteler', async () => {
    const a = sayfa();
    await bekle();
    a.yayinGonder(null);
    await bekle();
    const once = a.cerceve.getAttribute('src');
    a.yayinGonder(yayinB('ccccccc', ID('c'), [6, 8, 9, 10]));
    await bekle();
    expect(a.getirilen).toEqual([]);                             // kendiliğinden yüklenmedi
    expect(a.cerceve.getAttribute('src')).toBe(once);
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
    expect(a.getirilen).toEqual(['/_blob/' + ID('d')]);
    expect(a.cerceve.getAttribute('srcdoc')).toContain(ID('d'));
    expect(a.cerceve.hasAttribute('src')).toBe(false);
    expect(a.gizli('cn-guncel')).toBe(true);
    expect(a.gizli('cn-guncel-ac')).toBe(true);
    expect(a.d.getElementById('cn-surum').textContent).toBe('ddddddd · #1300');
  });

  // Kullanıcı 2026-11-05: "canlı not içine yenileme butonu ekler misin … F5 yapıp sayfayı
  // tamamen yenilemek istemiyorum." Yenile yalnız programı yeniden yükler: sayfa (notlar,
  // kart) yerinde; yeni yayın varsa onu yükler.
  test('Yenile: yalnız program yeniden yüklenir — varlık yeniden, dosya yeniden; yeni yayın varsa o', async () => {
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
    // dosyadan açılmış program: çerçeve dosyayı yeniden açar, varlık getirilmez
    const b = sayfa();
    await bekle();
    b.yayinGonder(null);
    await bekle();
    const kayit = [];
    new MutationObserver((m) => m.forEach((x) => kayit.push(x.attributeName))).observe(b.cerceve, { attributes: true });
    b.d.getElementById('cn-yenile').click();
    await bekle();
    expect(kayit).toContain('src');
    expect(b.cerceve.getAttribute('src')).toBe('mfsim.html');
    expect(b.getirilen).toEqual([]);
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
