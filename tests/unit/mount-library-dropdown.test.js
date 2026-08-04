/**
 * mount-library-dropdown.test.js — Takoz Özellikleri: AÇILIR takoz seçici
 * ──────────────────────────────────────────────────────────────────────
 * Kütüphane paneli 25+ gömülü takozu sol sütunda alt alta diziyordu; seçili
 * takozun özelliklerini takip etmek kaydırma gerektiriyordu. Liste artık
 * aranabilir bir açılır liste.
 *
 * Burada test edilen ŞEY DAVRANIŞ, etiket değil: aç/kapa durumu, dış-tık ve
 * Escape ile kapanma, arama filtresinin hangi satırı/grubu gizlediği, Enter'ın
 * ilk eşleşmeyi seçmesi ve ekle/sil sonrası seçimin nereye düştüğü. Sessiz
 * regresyonu (ör. filtre grubu boşalınca başlığın asılı kalması, silinen
 * takozda asılı kalan seçim) gözle yakalamak zor.
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

const libNode = (mounts) => ({
  id: 'lib1', type: 'mnt-library', def: { isMountLibrary: true },
  data: { mounts: mounts || [] },
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
  test('liste kapalı basılır; tüm gömülü girdiler satır olarak içindedir', () => {
    const el = mountPanel(libNode());
    expect(el.dd.hidden).toBe(true);                     // panel açılışında kapalı
    const opts = el.list.querySelectorAll('.mntlib-opt');
    const builtins = cp.veMntGetLibraryList().filter((e) => e.builtin);
    expect(opts.length).toBe(builtins.length);           // gömülü katalog tam
    // seçim yokken ilk gömülü seçilir → tetikleyici onu gösterir
    expect(el.trigger.textContent).toContain(builtins[0].name);
    expect(el.list.querySelectorAll('.mntlib-opt.sel').length).toBe(1);
  });

  test('özel takozlar gömülülerden önce ve seçili olarak listelenir', () => {
    const el = mountPanel(libNode([{ key: 'k1', name: 'Özel A', sz: 640 }]));
    const opts = Array.from(el.list.querySelectorAll('.mntlib-opt'));
    expect(opts[0].textContent).toContain('Özel A');
    expect(opts[0].classList.contains('sel')).toBe(true);
    expect(el.trigger.textContent).toContain('Özel A');
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

describe('arama filtresi', () => {
  test('ada göre süzer; eşleşmeyen satır ve boşalan grup başlığı gizlenir', () => {
    const el = mountPanel(libNode([{ key: 'k1', name: 'Özel A', sz: 640 }]));
    el.trigger.click();
    el.search.value = 'cone 39';
    cp.veMntLibFilter('lib1');
    const vis = visibleOpts(el.list);
    expect(vis.length).toBeGreaterThan(0);
    expect(vis.every((o) => /Cone 39/i.test(o.textContent))).toBe(true);
    const groups = Array.from(el.list.querySelectorAll('.mntlib-group'));
    expect(groups[0].hidden).toBe(true);                 // "Özel Takozlar" boşaldı → gizli
    expect(groups[1].hidden).toBe(false);                // "Gömülü Katalog" eşleşme taşıyor
    expect(el.none.hidden).toBe(true);
  });

  test('yalnız özel eşleşince SON grup başlığı ("Gömülü Katalog") da gizlenir', () => {
    const el = mountPanel(libNode([{ key: 'k1', name: 'Özel A', sz: 640 }]));
    el.trigger.click();
    el.search.value = 'özel a';
    cp.veMntLibFilter('lib1');
    const groups = Array.from(el.list.querySelectorAll('.mntlib-group'));
    expect(visibleOpts(el.list)).toHaveLength(1);
    expect(groups[0].hidden).toBe(false);
    expect(groups[1].hidden).toBe(true);                // döngü sonrası kapanış: son grup
  });

  test('anahtar koduyla da eşleşir; Türkçe harf farkı aramayı bozmaz', () => {
    const el = mountPanel(libNode([{ key: 'kx', name: 'Ön Şasi Takozu', sz: 100 }]));
    el.trigger.click();
    el.search.value = 'amc137982';                       // ad değil, kütüphane anahtarı
    cp.veMntLibFilter('lib1');
    expect(visibleOpts(el.list).map((o) => o.textContent).join()).toContain('AMC 137982');
    el.search.value = 'on sasi';                         // aksansız yazım
    cp.veMntLibFilter('lib1');
    expect(visibleOpts(el.list).map((o) => o.textContent).join()).toContain('Ön Şasi Takozu');
  });

  test('grup sayacı arama boyunca EŞLEŞEN sayısını gösterir, sonra toplama döner', () => {
    const el = mountPanel(libNode());
    el.trigger.click();
    const gomulu = () => el.list.querySelectorAll('.mntlib-count')[1];
    const toplam = gomulu().textContent;
    expect(Number(toplam)).toBeGreaterThan(3);
    el.search.value = 'cone 39';
    cp.veMntLibFilter('lib1');
    expect(gomulu().textContent).toBe(String(visibleOpts(el.list).length));
    el.search.value = '';
    cp.veMntLibFilter('lib1');
    expect(gomulu().textContent).toBe(toplam);          // aramasız hâlde katalog toplamı
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
    const node = libNode();
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
    const node = libNode();
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
