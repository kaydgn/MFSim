/**
 * mount-library-dropdown.test.js — Takoz Özellikleri: AÇILIR takoz seçici
 * ──────────────────────────────────────────────────────────────────────
 * Kütüphane paneli 25+ gömülü takozu sol sütunda alt alta diziyordu; seçili
 * takozun özelliklerini takip etmek kaydırma gerektiriyordu. Liste artık
 * aranabilir bir açılır liste.
 *
 * Burada test edilen ŞEY DAVRANIŞ, etiket değil: aç/kapa durumu, dış-tık ve
 * Escape ile kapanma, arama filtresinin hangi satırı gizlediği, Enter'ın
 * ilk eşleşmeyi seçmesi ve ekle/sil sonrası seçimin nereye düştüğü. Sessiz
 * regresyonu (ör. silinen takozda asılı kalan seçim) gözle yakalamak zor.
 *
 * MARKA (kullanıcı 2026-11-10, Canlı Not 106): liste yalnız SEÇİLİ MARKANIN
 * tiplerini taşır — marka Marka listesinde seçilir; grup başlığı ve sayaç yok.
 * Katalog tipleri bu yüzden seçili tipin markası üzerinden aranır.
 *
 * SEÇİLİ SATIR (kullanıcı 2026-11-10, Canlı Not 112: *"tabloyu tekrar açtığımda,
 * tablonun en başına geliyor. Seçtiğim yere gelmiyor"*): liste açılınca seçili
 * tipin satırı listenin ortasına kayar; yalnız listenin kaydırması oynar.
 * jsdom'da yerleşim yok — satırların ölçüsü elle verilir; gerçek yerleşim
 * tests/e2e/mount-pencere.spec.js → *Takoz Özellikleri*.
 *
 * İŞARETSİZ (kullanıcı 2026-11-11, Canlı Not 122: *"Baştaki mavi butonlara ne
 * gerek var … sağ kısımdaki kırmızı ve mavi tike de ne gerek var"*): satırda ve
 * tetikleyicide yalnız ad ve kz; seçili satır zeminiyle ve kalın adıyla belli.
 *
 * OKLAR (kullanıcı 2026-11-11, Canlı Not 155: *"Şuraya pratik olarak takozlar
 * arasında gezebileceğimiz iki ok tuşu istiyorum, yukarı aşağı"*): Tip satırının
 * sonunda Önceki tip · Sonraki tip; listenin GÖRÜNEN sırasıyla komşu tipi seçer,
 * seçim listeden seçmenin aynısı (geri-al adımı yazmaz), uçta ok kapalı ve sebebi
 * ipucunda, tek tipli markada ok yok, odak yeniden kurulan okta kalır. Gerçek
 * yerleşim (oklar (i) gelip gidince yerinde) tests/e2e/mount-pencere.spec.js →
 * *Takoz Özellikleri*.
 *
 * ÖZET (kullanıcı 2026-11-13, Canlı Not 159: *"hangi markadan ne kadar var ve toplam
 * takoz sayısı gibi. Kullanıcı bilgilensin."*): pencerenin İLK bölümü, Takoz tipinin
 * üstünde. Satırlar Marka listesinin markaları ve sırası; Takoz o markanın Tip listesinin
 * satır sayısı (pencerenin kendi listesinden sayılır), Aile ve Tip üreticinin
 * veritabanından (js/mount-amc.js · mount-ap.js · mount-laspar.js, burada ondan bağımsız
 * sayılır), veritabanı olmayan markada "—"; Toplam sütunların toplamı; sayılar Türkçe
 * yazıcıdan (1.000'in binlik noktası).
 */
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const cp = require('../../js/cp-mount.js');

const stubs = stubGlobals();

// Panel HTML'ini gerçek DOM'a basar ve inline onclick/oninput'ların çözebilmesi
// için kütüphane fonksiyonlarını window'a bağlar (modül require ile yüklendiği
// için tarayıcıdaki global bağlam testte elle kurulur).
function mountPanel(node) {
  global.nodes = [node];
  document.body.innerHTML = '<div id="host">' + cp.getMntLibraryPropertiesHTML(node) + '</div>';
  ['veMntLibSelect', 'veMntLibDropdownToggle', 'veMntLibFilter', 'veMntLibSearchKey', 'veMntLibAdd']
    .forEach((fn) => { window[fn] = cp[fn]; });
  return {
    trigger: document.getElementById('mntlib-tr-' + node.id),
    dd: document.getElementById('mntlib-dd-' + node.id),
    search: document.getElementById('mntlib-q-' + node.id),
    list: document.getElementById('mntlib-list-' + node.id),
    none: document.getElementById('mntlib-none-' + node.id),
  };
}

const libNode = (mounts, secili) => ({
  id: 'lib1', type: 'mnt-library', def: { isMountLibrary: true },
  data: Object.assign({ mounts: mounts || [] }, secili ? { _selKey: secili } : {}),
});

const visibleOpts = (list) =>
  Array.from(list.querySelectorAll('.mntlib-opt')).filter((el) => !el.hidden);

beforeEach(() => {
  resetStubs(stubs);
  cp.veMntLibDropdownClose();
  document.body.innerHTML = '';
});
afterEach(() => { delete global.nodes; });

describe('_mntLibNorm — arama için Türkçe harf katlaması', () => {
  test('büyük/küçük ve Türkçe harfler tek biçime iner', () => {
    expect(cp._mntLibNorm('Şaşı ÖĞÜT çÇ')).toBe('sasi ogut cc');
    // 'İ' JS toLowerCase'te birleşik nokta üretir; önce eşlenmezse arama tutmaz
    expect(cp._mntLibNorm('İSTANBUL')).toBe('istanbul');
    expect(cp._mntLibNorm('Ilık')).toBe('ilik');
    expect(cp._mntLibNorm(null)).toBe('');
  });
});

describe('açılır liste — kapalı başlar, tetikleyici seçiliyi gösterir', () => {
  test('liste kapalı basılır; seçili markanın tipleri satır olarak içindedir', () => {
    const el = mountPanel(libNode());
    expect(el.dd.hidden).toBe(true);                     // panel açılışında kapalı
    const opts = el.list.querySelectorAll('.mntlib-opt');
    const builtins = cp.veMntGetLibraryList().filter((e) => e.builtin);
    // seçim yokken ilk gömülü seçilir → tetikleyici onu gösterir, liste onun markasını
    const marka = builtins[0].marka;
    const beklenen = builtins.filter((e) => e.marka === marka);
    expect(opts.length).toBe(beklenen.length);
    expect(opts.length).toBeLessThan(builtins.length);   // başka markanın tipi listede yok
    expect(el.trigger.textContent).toContain(builtins[0].name);
    expect(el.list.querySelectorAll('.mntlib-opt.sel').length).toBe(1);
  });

  test('liste grup başlığı ve sayaç taşımaz (marka Marka listesinde söylenir)', () => {
    const el = mountPanel(libNode());
    expect(el.list.querySelectorAll('.mntlib-group, .mntlib-count, .mntlib-note').length).toBe(0);
  });

  test('İŞARETSİZ (Canlı Not 122): satır ve tetikleyici yalnız ad + kz — tür noktası, eğri ve seçim ikonu yok', () => {
    const el = mountPanel(libNode(null, 'amc137961'));   // eğrili tip seçili: en çok işaretli hâl
    const opts = Array.from(el.list.querySelectorAll('.mntlib-opt'));
    expect(opts.length).toBeGreaterThan(1);
    opts.forEach((o) => expect(Array.from(o.children).map((c) => c.className)).toEqual(['mntlib-opt-name', 'mntlib-kz']));
    expect(el.list.querySelectorAll('.mf-ico').length).toBe(0);
    expect(Array.from(el.trigger.children).map((c) => c.classList[0])).toEqual(['mntlib-trigger-name', 'mntlib-kz', 'mf-ico']);
    expect(el.trigger.querySelector('.mf-ico').classList.contains('mntlib-caret')).toBe(true);   // tek ikon: aç/kapa oku
  });

  test('özel takoz seçili olarak "Özel takozlar" markasında listelenir', () => {
    const el = mountPanel(libNode([{ key: 'k1', name: 'Özel A', sz: 640 }]));
    const opts = Array.from(el.list.querySelectorAll('.mntlib-opt'));
    expect(opts).toHaveLength(1);
    expect(opts[0].textContent).toContain('Özel A');
    expect(opts[0].classList.contains('sel')).toBe(true);
    expect(el.trigger.textContent).toContain('Özel A');
    expect(document.getElementById('mntlib-marka-lib1').value).toBe('Özel takozlar');
  });
});

describe('aç / kapa', () => {
  test('tetikleyici tıkı açar, ikinci tık kapatır', () => {
    const el = mountPanel(libNode());
    el.trigger.click();
    expect(el.dd.hidden).toBe(false);
    expect(el.trigger.classList.contains('open')).toBe(true);
    expect(el.trigger.getAttribute('aria-expanded')).toBe('true');
    el.trigger.click();
    expect(el.dd.hidden).toBe(true);
    expect(el.trigger.getAttribute('aria-expanded')).toBe('false');
  });

  test('liste dışına tıklayınca kapanır; liste içi tık kapatmaz', () => {
    const el = mountPanel(libNode());
    el.trigger.click();
    el.search.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
    expect(el.dd.hidden).toBe(false);                    // arama kutusu liste içi
    document.getElementById('host').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
    expect(el.dd.hidden).toBe(true);
  });

  test('Escape listeyi kapatır ve olayı yutar (pencere açık kalsın)', () => {
    const el = mountPanel(libNode());
    el.trigger.click();
    const onDoc = jest.fn();
    document.addEventListener('keydown', onDoc);         // pencere katmanının dinleyicisi
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(el.dd.hidden).toBe(true);
    expect(onDoc).not.toHaveBeenCalled();                // ilk Escape listede tüketildi
    // liste kapalıyken sonraki Escape normal katman sırasına döner
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onDoc).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', onDoc);
  });

  test('panel kapandıysa (liste DOM dışı) Escape yutulmaz', () => {
    const el = mountPanel(libNode());
    el.trigger.click();
    document.body.innerHTML = '';                        // özellik penceresi kapandı
    const onDoc = jest.fn();
    document.addEventListener('keydown', onDoc);
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onDoc).toHaveBeenCalledTimes(1);              // ölü liste olayı yutmadı
    document.removeEventListener('keydown', onDoc);
  });
});

describe('SEÇİLİ SATIR — liste açılınca seçili tipe kayar (Canlı Not 112)', () => {
  const SATIR = 24, ARA = 4, BOY = 200;
  // Yerleşimin elle ölçüsü: liste 100 px'te, satırlar 24 px, dolgu 4 px; kaydırma satırları yukarı taşır.
  function olcuVer(el) {
    Object.defineProperty(el.list, 'clientHeight', { value: BOY, configurable: true });
    el.list.getBoundingClientRect = () => ({ top: 100, height: BOY });
    const opts = Array.from(el.list.querySelectorAll('.mntlib-opt'));
    opts.forEach((o, j) => { o.getBoundingClientRect = () => ({ top: 100 + ARA + j * SATIR - el.list.scrollTop, height: SATIR }); });
    return opts;
  }
  test('seçili satır listenin ortasında açılır; kapatıp yeniden açmak aynı yere getirir', () => {
    const el = mountPanel(libNode([], 'amc137982'));            // notun tipi: Cone 39 50 ShA
    const opts = olcuVer(el);
    const i = opts.findIndex((o) => o.classList.contains('sel'));
    expect(opts[i].textContent).toContain('AMC 137982');
    expect(i).toBeGreaterThan(10);                              // listenin başında değil
    const beklenen = Math.round(ARA + i * SATIR - (BOY - SATIR) / 2);
    el.trigger.click();
    expect(el.dd.hidden).toBe(false);
    expect(el.list.scrollTop).toBe(beklenen);
    el.list.scrollTop = 0;                                      // kullanıcı başa kaydırıp kapatır
    el.trigger.click();
    expect(el.dd.hidden).toBe(true);
    el.trigger.click();
    expect(el.list.scrollTop).toBe(beklenen);                   // yeniden açılış yine seçili satırda
    const host = document.getElementById('host');
    expect(host.scrollTop).toBe(0);                             // pencerenin kaydırması oynamaz
  });
  test('ilk satır seçiliyse ya da seçili satır yoksa liste başta kalır', () => {
    const el = mountPanel(libNode());                           // ilk gömülü tip seçili
    olcuVer(el);
    expect(el.list.querySelector('.mntlib-opt').classList.contains('sel')).toBe(true);
    el.trigger.click();
    expect(el.list.scrollTop).toBe(0);
    el.trigger.click();
    el.list.querySelector('.mntlib-opt.sel').classList.remove('sel');
    el.list.scrollTop = 30;
    el.trigger.click();
    expect(el.list.scrollTop).toBe(30);                         // seçili satır yok: kaydırma olduğu gibi
  });
});

describe('arama filtresi', () => {
  test('ada göre süzer; eşleşmeyen satır gizlenir', () => {
    const el = mountPanel(libNode([], 'amc137982'));     // seçili tip AMC → liste AMC'nin tipleri
    el.trigger.click();
    el.search.value = 'cone 39';
    cp.veMntLibFilter('lib1');
    const vis = visibleOpts(el.list);
    expect(vis.length).toBeGreaterThan(0);
    expect(vis.length).toBeLessThan(el.list.querySelectorAll('.mntlib-opt').length);
    expect(vis.every((o) => /Cone 39/i.test(o.textContent))).toBe(true);
    expect(el.none.hidden).toBe(true);
  });

  test('arama yalnız seçili markanın tiplerinde yapılır', () => {
    const el = mountPanel(libNode([], 'amc137982'));
    el.trigger.click();
    el.search.value = 'tk050';                           // Diğer markasının tipi
    cp.veMntLibFilter('lib1');
    expect(visibleOpts(el.list)).toHaveLength(0);
    expect(el.none.hidden).toBe(false);
  });

  test('anahtar koduyla da eşleşir; Türkçe harf farkı aramayı bozmaz', () => {
    let el = mountPanel(libNode([], 'amc137963'));
    el.trigger.click();
    el.search.value = 'amc137982';                       // ad değil, kütüphane anahtarı
    cp.veMntLibFilter('lib1');
    expect(visibleOpts(el.list).map((o) => o.textContent).join()).toContain('Cone 39 50 ShA (AMC 137982)');
    cp.veMntLibDropdownClose();
    el = mountPanel(libNode([{ key: 'kx', name: 'Ön Şasi Takozu', sz: 100 }]));
    el.trigger.click();
    el.search.value = 'on sasi';                         // aksansız yazım
    cp.veMntLibFilter('lib1');
    expect(visibleOpts(el.list).map((o) => o.textContent).join()).toContain('Ön Şasi Takozu');
  });

  test('hiç eşleşme yoksa "eşleşen yok" satırı görünür; arama silinince liste döner', () => {
    const el = mountPanel(libNode());
    el.trigger.click();
    el.search.value = 'zzz-yok';
    cp.veMntLibFilter('lib1');
    expect(visibleOpts(el.list)).toHaveLength(0);
    expect(el.none.hidden).toBe(false);
    el.search.value = '';
    cp.veMntLibFilter('lib1');
    expect(visibleOpts(el.list).length).toBe(el.list.querySelectorAll('.mntlib-opt').length);
    expect(el.none.hidden).toBe(true);
  });
});

describe('seçim', () => {
  test('satır tıklaması seçimi taşır ve listeyi kapatır', () => {
    const node = libNode([], 'TK035');                   // TK040 ile aynı marka
    const el = mountPanel(node);
    el.trigger.click();
    const target = Array.from(el.list.querySelectorAll('.mntlib-opt'))
      .find((o) => /TK040/.test(o.textContent));
    target.click();
    expect(node.data._selKey).toBe('TK040');
    expect(el.dd.hidden).toBe(true);
    expect(stubs.showNodeProperties).toHaveBeenCalledWith(node);
  });

  test('aramada Enter ilk görünen satırı seçer', () => {
    const node = libNode([], 'TK035');
    const el = mountPanel(node);
    el.trigger.click();
    el.search.value = 'tk050';
    cp.veMntLibFilter('lib1');
    cp.veMntLibSearchKey({ key: 'Enter', preventDefault() {} }, 'lib1');
    expect(node.data._selKey).toBe('TK050');
  });

  test('Enter eşleşme yokken sessiz kalır', () => {
    const node = libNode();
    const el = mountPanel(node);
    el.trigger.click();
    el.search.value = 'zzz-yok';
    cp.veMntLibFilter('lib1');
    cp.veMntLibSearchKey({ key: 'Enter', preventDefault() {} }, 'lib1');
    expect(node.data._selKey).toBeUndefined();
  });
});

describe('OKLAR — Tip satırında önceki · sonraki tip (Canlı Not 155)', () => {
  const ok = (yon) => document.getElementById('mntlib-adim-' + (yon < 0 ? 'onceki' : 'sonraki') + '-lib1');
  // Listenin GÖRÜNEN sırası: satırın tıkladığı anahtar (onclick'in ikinci bağımsız değişkeni)
  const siraAnahtar = (list) => Array.from(list.querySelectorAll('.mntlib-opt'))
    .map((o) => /veMntLibSelect\('lib1','([^']+)'\)/.exec(o.getAttribute('onclick'))[1]);
  // Pencerenin yeniden kurulması: showNodeProperties paneli aynı yere yeniden basar
  function yenidenKur() {
    stubs.showNodeProperties.mockImplementation((n) => {
      document.getElementById('host').innerHTML = cp.getMntLibraryPropertiesHTML(n);
    });
  }
  afterEach(() => stubs.showNodeProperties.mockReset());
  beforeEach(() => { window.veMntLibAdim = cp.veMntLibAdim; });

  test('Tip satırının sonunda, (i)nin sağında bitişik iki ok: adları, ikonları, ipuçları', () => {
    const el = mountPanel(libNode([], 'amc137982'));
    const tip = el.trigger.closest('.mntlib-tip');
    expect(Array.from(tip.children).map((c) => c.classList[0])).toEqual(['mntlib-picker', 'mntlib-bilgi', 'mntlib-adimlar']);
    const [on, so] = Array.from(tip.querySelectorAll('.mntlib-adimlar > button'));
    expect([on.getAttribute('aria-label'), on.title, on.getAttribute('aria-disabled')]).toEqual(['Önceki tip', 'Önceki tip', null]);
    expect([so.getAttribute('aria-label'), so.title, so.getAttribute('aria-disabled')]).toEqual(['Sonraki tip', 'Sonraki tip', null]);
    expect(on.querySelector('.mf-ico').classList.contains('mf-ico-arrow-up')).toBe(true);     // ikon ailesinden, karakter değil
    expect(so.querySelector('.mf-ico').classList.contains('mf-ico-arrow-down')).toBe(true);
    expect(on.textContent.trim() + so.textContent.trim()).toBe('');
  });

  test('ok listenin GÖRÜNEN sırasında komşu tipi seçer — satırı tıklamakla aynı sonuç, geri-al adımı yok', () => {
    const node = libNode([], 'amc137982');
    let el = mountPanel(node);
    const sira = siraAnahtar(el.list);
    const i = sira.indexOf('amc137982');
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(sira.length - 1);
    // Beklenen: listede bir alttaki satırın tıkı
    el.list.querySelectorAll('.mntlib-opt')[i + 1].click();
    const satirla = JSON.stringify(node.data);
    expect(node.data._selKey).toBe(sira[i + 1]);
    // Aynı başlangıçtan ok
    node.data._selKey = 'amc137982';
    resetStubs(stubs);
    el = mountPanel(node);
    ok(1).click();
    expect(JSON.stringify(node.data)).toBe(satirla);
    expect(stubs.showNodeProperties).toHaveBeenCalledTimes(1);
    expect(stubs.showNodeProperties).toHaveBeenCalledWith(node);
    expect(stubs.saveState).not.toHaveBeenCalled();             // listeden seçim gibi: görünüm durumu
    // Önceki tip iki adım geri: bir üstteki satır
    el = mountPanel(node);
    ok(-1).click();
    el = mountPanel(node);
    ok(-1).click();
    expect(node.data._selKey).toBe(sira[i - 1]);
    expect(stubs.saveState).not.toHaveBeenCalled();
  });

  test('uçta ok kapalı (aria-disabled), sebebi ipucunda; tıkı bir şey yapmaz', () => {
    let node = libNode();                                       // seçim yok → listenin ilk tipi
    let el = mountPanel(node);
    const sira = siraAnahtar(el.list);
    expect(el.list.querySelector('.mntlib-opt').classList.contains('sel')).toBe(true);
    expect([ok(-1).getAttribute('aria-disabled'), ok(-1).title, ok(-1).getAttribute('aria-label')])
      .toEqual(['true', 'İlk tip seçili.', 'Önceki tip']);
    expect(ok(1).getAttribute('aria-disabled')).toBeNull();
    ok(-1).click();
    expect(cp.veMntLibAdim('lib1', -1)).toBe(false);
    expect(node.data._selKey).toBeUndefined();
    expect(stubs.showNodeProperties).not.toHaveBeenCalled();
    node = libNode([], sira[sira.length - 1]);                  // listenin son tipi
    el = mountPanel(node);
    expect([ok(1).getAttribute('aria-disabled'), ok(1).title, ok(1).getAttribute('aria-label')])
      .toEqual(['true', 'Son tip seçili.', 'Sonraki tip']);
    expect(ok(-1).getAttribute('aria-disabled')).toBeNull();
    ok(1).click();
    expect(node.data._selKey).toBe(sira[sira.length - 1]);      // dönmez: listenin başına sarmaz
    expect(stubs.showNodeProperties).not.toHaveBeenCalled();
  });

  test('ok yalnız seçili markanın tiplerinde gezer; tek tipli markada ok yok', () => {
    const tek = mountPanel(libNode([{ key: 'k1', name: 'Özel A', sz: 640 }]));
    expect(tek.trigger.closest('.mntlib-tip').querySelector('.mntlib-adimlar')).toBeNull();
    const node = libNode([{ key: 'k1', name: 'Özel A', sz: 640 }, { key: 'k2', name: 'Özel B', sz: 700 }]);
    mountPanel(node);
    expect(ok(-1).getAttribute('aria-disabled')).toBe('true');
    ok(1).click();
    expect(node.data._selKey).toBe('k2');                       // Özel takozlar içinde
    mountPanel(node);
    expect(ok(1).getAttribute('aria-disabled')).toBe('true');   // markanın sonu: katalog tipine geçmez
    expect(cp.veMntLibAdim('lib1', 1)).toBe(false);
    expect(node.data._selKey).toBe('k2');
  });

  test('pencere yeniden kurulunca odak AYNI okta kalır (art arda basmak yerinden kaymaz)', () => {
    const node = libNode([], 'amc137982');
    const el = mountPanel(node);
    const sira = siraAnahtar(el.list), i = sira.indexOf('amc137982');
    yenidenKur();
    let eski = ok(1);
    eski.focus();
    eski.click();
    expect(ok(1)).not.toBe(eski);                               // pencere gerçekten yeniden kuruldu
    expect(document.activeElement).toBe(ok(1));
    eski = ok(1);
    eski.click();
    expect(node.data._selKey).toBe(sira[i + 2]);
    expect(document.activeElement).toBe(ok(1));
    // Tetikleyici ve listenin seçili satırı yeni tipi gösterir
    const sec = document.querySelector('#mntlib-list-lib1 .mntlib-opt.sel');
    expect(/veMntLibSelect\('lib1','([^']+)'\)/.exec(sec.getAttribute('onclick'))[1]).toBe(sira[i + 2]);
    expect(document.getElementById('mntlib-tr-lib1').textContent).toContain(cp.veMntGetLibraryMap()[sira[i + 2]].name);
    // Odak okta değilse (Safari'de tık odak vermez) oka TAŞINMAZ
    document.getElementById('mntlib-marka-lib1').focus();
    ok(-1).click();
    expect(node.data._selKey).toBe(sira[i + 1]);
    expect(document.activeElement.classList.contains('mntlib-adim')).toBe(false);
  });
});

describe('ekle / sil sonrası seçim', () => {
  test('yeni takoz eklenince O SEÇİLİR (kapalı listede kaybolmasın)', () => {
    const node = libNode();
    global.nodes = [node];
    cp.veMntLibSelect('lib1', 'TK035');                  // önce bir gömülü seçili
    cp.veMntLibAdd('lib1');
    const yeni = node.data.mounts[0];
    expect(node.data._selKey).toBe(yeni.key);
    // panel yeniden çizildiğinde tetikleyici yeni takozu gösterir
    const el = mountPanel(node);
    expect(el.trigger.textContent).toContain(yeni.name);
  });

  test('seçili takoz silinince seçim ilk sıradakine düşer, asılı kalmaz', () => {
    const node = libNode();
    global.nodes = [node];
    cp.veMntLibAdd('lib1');
    const key = node.data.mounts[0].key;
    node.data._curveEditKey = key;
    cp.veMntLibRemove('lib1', key);
    expect(node.data._selKey).toBeNull();
    expect(node.data._curveEditKey).toBeNull();
    const el = mountPanel(node);
    const builtins = cp.veMntGetLibraryList().filter((e) => e.builtin);
    expect(el.trigger.textContent).toContain(builtins[0].name);
  });
});

describe('ÖZET — markaların takoz sayıları, Takoz tipinin üstünde (Canlı Not 159)', () => {
  const AMC = require('../../js/mount-amc.js');
  const AP = require('../../js/mount-ap.js');
  const LP = require('../../js/mount-laspar.js');
  // Üreticinin veritabanı ondan bağımsız sayılır: kodun tipi (KOD[kod][0]) ve tipin ailesi (TIP[tip][0]).
  const VERITABANI = {};
  [AMC, AP, LP].forEach((M) => {
    const tip = new Set(Object.keys(M.KOD).map((k) => M.KOD[k][0]));
    VERITABANI[M.MARKA] = { aile: new Set([...tip].map((t) => M.TIP[t][0])).size, tip: tip.size };
  });
  const kategoriler = (d) => [...d.querySelectorAll('.ve-fp-govde > .ve-fp-kat')].map((k) => k.getAttribute('data-k'));
  // Özet tablosu: başlığın adıyla sütun, satır başına { marka, aile, tip, takoz } (hücre YAZISI).
  function ozet(d) {
    const kat = d.querySelector('.ve-fp-kat[data-k="ozet"]');
    const tablo = kat.querySelector('table');
    const sutun = [...tablo.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    const satir = [...tablo.querySelectorAll('tbody tr')].map((tr) => {
      const h = [...tr.children].map((td) => td.textContent.trim());
      return { marka: h[sutun.indexOf('Marka')], aile: h[sutun.indexOf('Aile')], tip: h[sutun.indexOf('Tip')],
        takoz: h[sutun.indexOf('Takoz')], top: tr.classList.contains('top') };
    });
    return { kat, sutun, satir };
  }
  // Markanın Tip listesinin satır sayısı: o markanın bir tipi seçiliyken pencerenin KENDİ listesi.
  function tipListesi(mounts, marka) {
    const n = libNode(mounts);
    const g = cp._mntLibSecim(n).markalar.find((x) => x.ad === marka);
    n.data._selKey = g.girdiler[0].key;
    const el = mountPanel(n);
    expect(document.getElementById('mntlib-marka-lib1').value).toBe(marka);
    return el.list.querySelectorAll('.mntlib-opt').length;
  }
  const sayi = (v) => global.veSayi(v, 0);

  test('pencerenin İLK bölümü, Takoz tipinden önce; başlığı Özet, künyesi yok', () => {
    [libNode(), libNode([], 'TK040'), libNode([{ key: 'k1', name: 'Özel A', sz: 640 }])].forEach((n) => {
      mountPanel(n);
      const d = document.getElementById('host');
      const k = kategoriler(d);
      expect(k[0]).toBe('ozet');
      expect(k[1]).toBe('tip');
      const kat = d.querySelector('.ve-fp-kat[data-k="ozet"]');
      expect(kat.getAttribute('aria-label')).toBe('Özet');
      expect(kat.querySelector('.ve-fp-sect > b').textContent).toBe('Özet');
      expect(kat.querySelector('.ve-fp-sect > em')).toBeNull();               // toplam başlıkta ikinci kez yazılmaz
      expect(d.querySelectorAll('.ve-fp-sect > b')[0].textContent).toBe('Özet');
    });
  });

  test('satırlar Marka listesinin markaları ve sırası; Takoz o markanın Tip listesinin satır sayısı', () => {
    const ozel = [{ key: 'k1', name: 'Özel A', sz: 640 }, { key: 'k2', name: 'Özel B', sz: 700 }];
    [[], ozel].forEach((mounts) => {
      mountPanel(libNode(mounts));
      const d = document.getElementById('host');
      const marka = [...d.querySelectorAll('select.mntlib-marka option')].map((o) => o.value);
      const O = ozet(d);
      expect(O.sutun).toEqual(['Marka', 'Aile', 'Tip', 'Takoz']);
      const govde = O.satir.filter((r) => !r.top);
      expect(govde.map((r) => r.marka)).toEqual(marka);
      expect(marka).toEqual(mounts.length ? [...cp.VE_MNT_LIB_MARKALAR, cp.VE_MNT_LIB_MARKA_OZEL] : cp.VE_MNT_LIB_MARKALAR);
      govde.forEach((r) => expect(r.takoz).toBe(sayi(tipListesi(mounts, r.marka))));
    });
  });

  test('Aile ve Tip üreticinin veritabanından; veritabanı olmayan markada (Diğer, Özel takozlar) "—"', () => {
    mountPanel(libNode([{ key: 'k1', name: 'Özel A', sz: 640 }]));
    const O = ozet(document.getElementById('host'));
    const bul = (m) => O.satir.find((r) => r.marka === m);
    [AMC.MARKA, AP.MARKA, LP.MARKA].forEach((m) => {
      expect(VERITABANI[m].tip).toBeGreaterThan(0);                           // kâhin boş değil
      expect([bul(m).aile, bul(m).tip]).toEqual([sayi(VERITABANI[m].aile), sayi(VERITABANI[m].tip)]);
    });
    ['Diğer', cp.VE_MNT_LIB_MARKA_OZEL].forEach((m) => expect([bul(m).aile, bul(m).tip]).toEqual(['—', '—']));
    // LASPAR'ın Tip listesinde programın kendi takozları da var: Takoz'da sayılır, tipte değil
    expect(Number(bul(LP.MARKA).takoz)).toBeGreaterThan(Object.keys(LP.KOD).length);
  });

  test('Toplam son satır, kalın: sütunların toplamı', () => {
    mountPanel(libNode([{ key: 'k1', name: 'Özel A', sz: 640 }]));
    const O = ozet(document.getElementById('host'));
    const son = O.satir[O.satir.length - 1];
    expect(O.satir.filter((r) => r.top)).toEqual([son]);
    expect(son.marka).toBe('Toplam');
    const govde = O.satir.filter((r) => !r.top);
    const topla = (alan) => govde.reduce((t, r) => t + (r[alan] === '—' ? 0 : Number(r[alan])), 0);
    expect([son.aile, son.tip, son.takoz]).toEqual([sayi(topla('aile')), sayi(topla('tip')), sayi(topla('takoz'))]);
    expect(son.takoz).toBe(sayi(cp.veMntGetLibraryList().filter((e) => e.builtin).length + 1));
  });

  test('sayılar Türkçe yazıcıdan: 1.000 özel takozda binlik noktası; liste değişince özet de', () => {
    const cok = Array.from({ length: 1000 }, (_, i) => ({ key: 'u' + i, name: 'Özel ' + i, sz: 100 }));
    mountPanel(libNode(cok, 'TK040'));
    const O = ozet(document.getElementById('host'));
    const katalog = cp.veMntGetLibraryList().filter((e) => e.builtin).length;
    expect(O.satir.find((r) => r.marka === cp.VE_MNT_LIB_MARKA_OZEL).takoz).toBe('1.000');
    expect(O.satir[O.satir.length - 1].takoz).toBe(sayi(katalog + 1000));
    expect(O.satir[O.satir.length - 1].takoz).toMatch(/^\d\.\d{3}$/);
    // Yeni takoz pencereyi yeniden kurar: Özel takozlar satırı listeyle birlikte gelir
    const node = libNode();
    global.nodes = [node];
    cp.veMntLibAdd('lib1');
    mountPanel(node);
    const S = ozet(document.getElementById('host')).satir;
    expect(S.find((r) => r.marka === cp.VE_MNT_LIB_MARKA_OZEL).takoz).toBe('1');
    expect(S[S.length - 1].takoz).toBe(sayi(katalog + 1));
  });
});

// TAKOZ PENCERESİNDE SEÇİCİ (kullanıcı 2026-11-13, Canlı Not 160: *"Takoz bileşen penceresindeki
// takoz seçimini tıpkı 'takoz özellikleri' bileşenindeki gibi yapalım."*): Takoz penceresinin Takoz
// tipi bölümü tek uzun yerel listeydi ("— elle gir —", Cone 00 …); şimdi Takoz Özellikleri'nin
// seçicisi — Marka · Tip (aranır) · (i) · oklar, AYNI üreticiden ve AYNI işleyicilerle. Fark yalnız
// bağlamda: tip seçmek tipi TAKOZA uygular (tek geri-al adımı; Takoz Özellikleri'nde görünüm durumu),
// Marka listesinin sonunda Elle (bağı kaldırır, değerler yerinde, Tip satırı yok), Yeni takoz yok.
describe('TAKOZ PENCERESİNDE SEÇİCİ (Canlı Not 160)', () => {
  const L = () => cp.veMntGetLibraryMap();
  const takoz = (data) => ({ id: 'tk1', type: 'mnt-mount', def: { name: 'Takoz', isMount: true }, data: Object.assign({}, data) });
  const degerler = (k) => { const e = L()[k]; return { kxs: e.sx, kys: e.sy, kzs: e.sz, kxd: e.dx, kyd: e.dy, kzd: e.dz }; };
  // Takoz penceresini gerçek DOM'a basar; showNodeProperties pencereyi aynı yere yeniden kurar
  function takozPanel(node) {
    global.nodes = [node];
    document.body.innerHTML = '<div id="host">' + cp.getMntMountPropertiesHTML(node) + '</div>';
    ['veMntLibSelect', 'veMntLibDropdownToggle', 'veMntLibFilter', 'veMntLibSearchKey', 'veMntLibAdim', 'veMntLibMarka']
      .forEach((fn) => { window[fn] = cp[fn]; });
    stubs.showNodeProperties.mockImplementation((n) => {
      document.getElementById('host').innerHTML = cp.getMntMountPropertiesHTML(n);
    });
    return document.getElementById('host');
  }
  const sec = () => document.querySelector('#host .mntlib-sec');
  const tr = () => document.getElementById('mntlib-tr-tk1');
  const marka = () => document.getElementById('mntlib-marka-tk1');
  const ok = (yon) => document.getElementById('mntlib-adim-' + (yon < 0 ? 'onceki' : 'sonraki') + '-tk1');
  const siraAnahtar = (id) => Array.from(document.querySelectorAll('#mntlib-list-' + id + ' .mntlib-opt'))
    .map((o) => new RegExp("veMntLibSelect\\('" + id + "','([^']+)'\\)").exec(o.getAttribute('onclick'))[1]);
  const sinif = (el) => Array.from(el.children).map((c) => c.classList[0]);
  afterEach(() => stubs.showNodeProperties.mockReset());

  test('Takoz tipi Takoz Özellikleri\'nin seçicisi: Marka listesi, Tip tetikleyicisi, (i), oklar — aynı sınıflar, aynı satırlar; yerel tip listesi yok', () => {
    mountPanel(libNode([], 'amc137982'));
    const libSec = sec(), libTip = libSec.querySelector('.mntlib-tip');
    const libTr = libTip.querySelector('.mntlib-trigger').outerHTML.replace(/lib1/g, 'X');
    const libSira = siraAnahtar('lib1');
    const libMarka = Array.from(document.getElementById('mntlib-marka-lib1').options).map((o) => o.value);
    const libSinif = [sinif(libSec), sinif(libTip)];
    takozPanel(takoz({ libKey: 'amc137982' }));
    const s = sec();
    expect(document.querySelector('#host select[id^="ve-mnt-libKey-"]')).toBeNull();      // eski yerel liste kalktı
    expect(document.querySelectorAll('#host optgroup')).toHaveLength(0);
    expect(s.closest('.ve-fp-card').querySelector('.ve-fp-sect > b').textContent).toBe('Takoz tipi');
    expect(s.classList.contains('mntlib-sec--takoz')).toBe(true);
    expect(sinif(s)).toEqual(['mntlib-et', 've-fp-sel', 'mntlib-et', 'mntlib-tip']);          // Yeni takoz YOK
    expect(libSinif[0]).toEqual(['mntlib-et', 've-fp-sel', 'mntlib-et', 'mntlib-tip', 'mntlib-add']);
    expect([s.children[0].textContent, s.children[2].textContent]).toEqual(['Marka', 'Tip']);
    expect(marka().classList.contains('mntlib-marka')).toBe(true);
    const tip = s.querySelector('.mntlib-tip');
    expect(sinif(tip)).toEqual(libSinif[1]);                                                   // tetikleyici · (i) · oklar
    expect(sinif(tip)).toEqual(['mntlib-picker', 'mntlib-bilgi', 'mntlib-adimlar']);
    expect(tr().outerHTML.replace(/tk1/g, 'X')).toBe(libTr);                                   // aynı üretici
    expect(tr().getAttribute('data-k')).toBe('amc137982');
    expect(siraAnahtar('tk1')).toEqual(libSira);                                               // markanın tipleri, aynı sıra
    // Marka listesi Takoz Özellikleri'ninki, sonunda Elle
    expect(Array.from(marka().options).map((o) => o.value)).toEqual(libMarka.concat(['']));
    expect(marka().options[marka().options.length - 1].textContent).toBe('Elle');
    expect(marka().value).toBe('AMC Mecanocaucho');
  });

  test('listeden tip seçmek tipi takoza UYGULAR: rijitlik, bağ; tek geri-al adımı, pencere yeniden kurulur', () => {
    const node = takoz(Object.assign({ libKey: 'TK040' }, degerler('TK040')));
    takozPanel(node);
    expect(marka().value).toBe('LASPAR');
    const satir = Array.from(document.querySelectorAll('#mntlib-list-tk1 .mntlib-opt')).find((o) => /^TK050 /.test(o.textContent));
    satir.click();
    expect(node.data.libKey).toBe('TK050');
    expect(node.data).toMatchObject(degerler('TK050'));
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
    expect(stubs.showNodeProperties).toHaveBeenCalledWith(node);
    expect(tr().getAttribute('data-k')).toBe('TK050');
    expect(document.getElementById('mntlib-dd-tk1').hidden).toBe(true);
    // Bağlı tipin satırı bir şey yazmaz
    resetStubs(stubs);
    document.querySelector('#mntlib-list-tk1 .mntlib-opt.sel').click();
    expect(stubs.saveState).not.toHaveBeenCalled();
    // Aramada Enter da aynı yoldan
    tr().click();
    document.getElementById('mntlib-q-tk1').value = 'TK035';
    cp.veMntLibFilter('tk1');
    cp.veMntLibSearchKey({ key: 'Enter', preventDefault() {} }, 'tk1');
    expect(node.data.libKey).toBe('TK035');
    expect(node.data).toMatchObject(degerler('TK035'));
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
  });

  test('oklar listenin sırasıyla komşu tipi UYGULAR (tek geri-al adımı); odak okta kalır; uçta ok kapalı', () => {
    const node = takoz({ libKey: 'amc137982' });
    takozPanel(node);
    const sira = siraAnahtar('tk1'), i = sira.indexOf('amc137982');
    expect(i).toBeGreaterThan(0);
    const eski = ok(1);
    eski.focus();
    eski.click();
    expect(node.data.libKey).toBe(sira[i + 1]);
    expect(node.data).toMatchObject(degerler(sira[i + 1]));
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
    expect(ok(1)).not.toBe(eski);                                     // pencere yeniden kuruldu
    expect(document.activeElement).toBe(ok(1));
    ok(-1).click();
    ok(-1).click();
    expect(node.data.libKey).toBe(sira[i - 1]);
    expect(stubs.saveState).toHaveBeenCalledTimes(3);
    // Listenin ucunda ok kapalı ve bir şey yazmaz
    node.data = { libKey: sira[0] };
    resetStubs(stubs);
    takozPanel(node);
    expect([ok(-1).getAttribute('aria-disabled'), ok(-1).title]).toEqual(['true', 'İlk tip seçili.']);
    ok(-1).click();
    expect(node.data.libKey).toBe(sira[0]);
    expect(stubs.saveState).not.toHaveBeenCalled();
  });

  test('Marka seçmek o markanın ilk tipini uygular (tek geri-al adımı); aynı marka bir şey yazmaz', () => {
    const node = takoz(Object.assign({ libKey: 'TK040' }, degerler('TK040')));
    takozPanel(node);
    cp.veMntLibMarka('tk1', 'LASPAR');
    expect(stubs.saveState).not.toHaveBeenCalled();
    marka().value = 'AMC Mecanocaucho';
    marka().dispatchEvent(new Event('change'));
    expect(node.data.libKey).toBe('amc137007');                       // listenin ilki: Cone 00 45 ShA (Canlı Not 134)
    expect(node.data).toMatchObject(degerler('amc137007'));
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
    expect(marka().value).toBe('AMC Mecanocaucho');
  });

  test('Elle bağı kaldırır, değerler yerinde ve düzenlenebilir; Tip satırı yok; değeri tiple aynı takoz Elle\'de kalır', () => {
    const node = takoz(Object.assign({ libKey: 'TK040' }, degerler('TK040')));
    takozPanel(node);
    marka().value = '';
    marka().dispatchEvent(new Event('change'));
    expect(node.data.libKey).toBeUndefined();
    expect(node.data.libElle).toBe(true);
    expect(node.data).toMatchObject(degerler('TK040'));
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
    expect(marka().value).toBe('');
    expect(sinif(sec())).toEqual(['mntlib-et', 've-fp-sel']);
    expect(tr()).toBeNull();
    ['kxs', 'kys', 'kzs', 'kxd', 'kyd', 'kzd'].forEach((k) => {
      const inp = document.getElementById('ve-mnt-' + k + '-tk1');
      expect([inp.readOnly, inp.disabled, inp.getAttribute('onchange')]).toEqual([false, false, "veMntSet('tk1','" + k + "',this.value)"]);
    });
    // Durum satırı eşleşmeyi yine söyler; seçim Elle'de kalır (eşleşme TK040'a döndürmez)
    expect(document.getElementById('ve-mnt-libnot-tk1').textContent).toContain('TK040 45 ShA ile 6/6 değer aynı');
    expect(cp._mntTakozSecim(node).grup).toBeNull();
    // Elle'yken Elle bir şey yazmaz; tip seçmek Elle'yi siler
    resetStubs(stubs);
    cp.veMntLibMarka('tk1', '');
    expect(stubs.saveState).not.toHaveBeenCalled();
    marka().value = 'LASPAR';
    marka().dispatchEvent(new Event('change'));
    expect(node.data.libElle).toBeUndefined();
    expect(node.data.libKey).toBe(siraAnahtar('tk1')[0]);
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
  });

  test('eşleşmeyen takozda Marka Elle; bağsız ama altı değeri bir tiple aynı takoz o tipi gösterir; değer değişince seçici YERİNDE Elle\'ye düşer', () => {
    takozPanel(takoz({ kxs: 1, kys: 2, kzs: 3, kxd: 4, kyd: 5, kzd: 6 }));
    expect(marka().value).toBe('');
    expect(tr()).toBeNull();
    const node = takoz(degerler('TK050'));
    global.nodes = [node];
    document.body.innerHTML = '<div class="ve-properties-content"><div id="host">' + cp.getMntMountPropertiesHTML(node) + '</div></div>';
    expect([marka().value, tr().getAttribute('data-k')]).toEqual(['LASPAR', 'TK050']);
    node.data.kzs = 300;
    cp.veMntPencereTazele();
    expect([marka().value, tr()]).toEqual(['', null]);
    expect(document.getElementById('ve-mnt-libnot-tk1').textContent).toBe('Kütüphanede eşleşen takoz yok.');
  });

  test('teknik resmi olan tipte (i) Tip satırında, olmayanda yok — Takoz Özellikleri\'nin düğmesi', () => {
    takozPanel(takoz({ libKey: 'amc137982' }));
    const b = document.querySelector('#host .mntlib-tip > button.mntlib-bilgi');
    expect(b.getAttribute('data-amc')).toBeTruthy();
    expect(b.getAttribute('onclick')).toBe('veMntLibCizimAc(this)');
    expect(b.id).toBe('mntlib-bilgi-tk1');
    takozPanel(takoz({ libKey: 'TK040' }));
    expect(document.querySelector('#host .mntlib-bilgi')).toBeNull();
    expect(sinif(document.querySelector('#host .mntlib-tip'))).toEqual(['mntlib-picker', 'mntlib-adimlar']);
  });

  test('Takoz Özellikleri\'nin seçimi değişmedi: tip seçmek görünüm durumu (geri-al adımı yok), Elle yok', () => {
    const lib = libNode([], 'TK040');
    mountPanel(lib);
    expect(document.getElementById('mntlib-marka-lib1').querySelector('option[value=""]')).toBeNull();
    cp.veMntLibSelect('lib1', 'TK050');
    cp.veMntLibMarka('lib1', 'AMC Mecanocaucho');
    cp.veMntLibAdim('lib1', 1);
    expect(stubs.saveState).not.toHaveBeenCalled();
    expect(Object.keys(lib.data).sort()).toEqual(['_selKey', 'mounts']);
  });
});
