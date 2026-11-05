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
 *   SEÇİM      çevrelenen öğe arka plandan önce, okun ucu, başlığın yönü
 *   KÜNYE      görünen değer (Türkçe sayı alanı), CSS yolu
 *   FOTOĞRAF   betiksiz, canlı değerli, özgün belgeye dokunmaz
 *   BAĞLAM     programın global durumu
 *   ONAY       confirm/prompt sayfada sorulur; kabul tek kullanımlık
 *   YAYIN      köprü <meta charset>'ın arkasında; şablonun çapaları
 *   GÜNCELLİK  yayındaki künye ↔ ana dal; paketin girdileri build.js'in okuduğu
 *              her yolu kapsar (kapsamasaydı denetim değişen programa "aynı" derdi)
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
