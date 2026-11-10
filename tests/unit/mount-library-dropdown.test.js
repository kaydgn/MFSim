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
