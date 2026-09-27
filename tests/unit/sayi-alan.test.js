/**
 * sayi-alan.test.js — TÜRKÇE SAYI ALANI (kullanıcı kararı 7·C, 2026-09-27)
 * ───────────────────────────────────────────────────────────────────────────
 * `type="number"` alan virgülü tanımıyordu — ölçüldü (Chromium): "63,5"
 * yazınca değer "635", "1.716,2" yazınca "1.7162"; ikisi de sessiz on/bin kat
 * hata. Sayı alanı artık `type="text" inputmode="decimal"` ve js/sayi-alan.js
 * onu Türkçe gösterip `.value`'yu MAKİNE biçiminde geri veriyor — alanı okuyan
 * yüz kadar işleyici değişmeden doğru sayıyı alıyor.
 *
 * Kapılar:
 *   · saf işlevler: gösterim rakamlara dokunmaz, okuma veSayiOku'yla aynı sayı
 *   · jsdom'da alanın kendisi: gösterim, okuma, yazma, yapıştırma (gruplu tam
 *     sayı SESSİZ kalmaz), harf süzgeci, ↑/↓ adımı
 *   · kaynakta `type="number"` yok; katman panellerden ÖNCE yükleniyor
 *   · dönüşümün kırdığı tek okuyucu (şanzıman vites satırı) sayıyı buluyor
 */
const fs = require('fs');
const path = require('path');
const SA = require('../../js/sayi-alan.js');
const { yorumsuzJs, yorumsuzHtml } = require('../../tools/ikon-dili.js');

const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');
const yerli = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
const gorunen = (el) => yerli.get.call(el);
const kare = () => new Promise((r) => setTimeout(r, 0));   // MutationObserver teslimi

describe('saf işlevler', () => {
  test.each([
    ['1716.25', '1716,25'], ['3.510', '3,510'], ['-0.5', '-0,5'], ['12', '12'],
    ['1e-6', '1e-6'], ['1.5e-6', '1,5e-6'], [63.5, '63,5'], ['', ''], [null, ''],
    ['12,5', '12,5'], ['abc', 'abc'], ['1.716,2', '1.716,2']
  ])('gösterim %p → %p (rakamlar aynen; makine biçimi değilse dokunulmaz)', (v, b) =>
    expect(SA.veSayiAlanGoster(v)).toBe(b));

  test('okuma veSayiOku ile AYNI sayıyı verir; bozuk girdi boş (eski alan da boştu)', () => {
    for (const s of ['63,5', '63.5', '1.716,2', '1716,2', ' −2,5 ', '-2.5', '1e3', '2.480', '0,0001', '5.']) {
      expect([s, parseFloat(veSayiMakine(s))]).toEqual([s, veSayiOku(s)]);
    }
    for (const s of ['', '  ', 'abc', '1,2,3', '--2', '-', ',']) expect([s, veSayiMakine(s)]).toEqual([s, '']);
  });

  test('gösterim → okuma gidiş-dönüşü rakamı rakamına aynı', () => {
    for (const m of ['0', '12', '-12.5', '3.510', '1716.25', '0.0001', '1e-6', '2.5e+3']) {
      expect(veSayiMakine(SA.veSayiAlanGoster(m))).toBe(m);
    }
  });

  test.each([
    // [değer, yukarı, özellik, beklenen] — HTML sayı alanının adım kuralı
    [12, true, { step: '5', min: '0' }, 15],        // hizasız değer hizalıya gider
    [12, false, { step: '5', min: '0' }, 10],
    [15, true, { step: '5', min: '0' }, 20],
    [0.65, true, { step: '0.01' }, 0.66],
    [0.1, true, { step: '0.1' }, 0.2],             // kayan nokta artığı yok
    [0.655, true, { step: '0.01', taban: '0.655' }, 0.665],  // taban: yazılan değer
    [2.5, true, { step: 'any' }, 3.5],
    [99, true, { step: '5', max: '100' }, 100],
    [1, false, { step: '5', min: '0' }, 0],
    [NaN, true, { step: '1' }, 1]
  ])('adım: %p yukarı=%p %j → %p', (v, y, o, b) => expect(SA.veSayiAlanAdim(v, y, o)).toBe(b));
});

describe('alanın kendisi (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = ''; global.showToast = jest.fn(); });

  const kur = async (html) => {
    document.body.innerHTML = html;
    await kare();
    return document.body.firstElementChild;
  };
  const yapistir = (el, metin) => {
    el.focus();
    const e = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'clipboardData', { value: { getData: () => metin } });
    el.dispatchEvent(e);
    return e;
  };

  test('Türkçe görünür, makine biçiminde okunur; yer tutucu da Türkçe', async () => {
    const el = await kur('<input type="text" inputmode="decimal" value="1716.25" placeholder="Örn. 49.97">');
    expect(gorunen(el)).toBe('1716,25');
    expect(el.value).toBe('1716.25');
    expect(el.getAttribute('placeholder')).toBe('Örn. 49,97');
  });

  test('kullanıcının yazdığı her iki biçim de doğru sayıya döner', async () => {
    const el = await kur('<input type="text" inputmode="decimal" value="">');
    for (const [yazi, beklenen] of [['12,5', '12.5'], ['1.716,2', '1716.2'], ['63.5', '63.5'], ['abc', ''], ['', '']]) {
      yerli.set.call(el, yazi);
      expect([yazi, el.value]).toEqual([yazi, beklenen]);
    }
  });

  test('koddan yazılan değer Türkçe görünür ve rakamları korunur', async () => {
    const el = await kur('<input type="text" inputmode="decimal" value="">');
    el.value = 63.5;
    expect(gorunen(el)).toBe('63,5');
    el.value = '3.510';
    expect([gorunen(el), el.value]).toEqual(['3,510', '3.510']);
  });

  test('inputmode taşımayan metin alanına dokunulmaz; sonradan eklenen alan da kurulur', async () => {
    const el = await kur('<input type="text" value="1.5">');
    expect([gorunen(el), el.value]).toEqual(['1.5', '1.5']);
    const yeni = document.createElement('input');
    yeni.setAttribute('inputmode', 'decimal');
    yeni.setAttribute('value', '0.25');
    document.body.appendChild(yeni);
    await kare();
    expect([gorunen(yeni), yeni.value]).toEqual(['0,25', '0.25']);
  });

  test('YAPIŞTIRMA: Türkçe ve birimli sayı alanın biçimine çevrilir', async () => {
    const el = await kur('<input type="text" inputmode="decimal" value="">');
    const oninput = jest.fn();
    el.addEventListener('input', oninput);
    expect(yapistir(el, '1.716,2').defaultPrevented).toBe(true);
    expect([gorunen(el), el.value]).toEqual(['1716,2', '1716.2']);
    expect(oninput).toHaveBeenCalled();
    yerli.set.call(el, '');
    yapistir(el, '1.714,6 mm\n');
    expect(el.value).toBe('1714.6');
    expect(showToast).not.toHaveBeenCalled();
  });

  test('YAPIŞTIRMA: gruplu TAM SAYI sessiz kalmaz — ondalık okunur, alan işaretlenir, bildirim çıkar', async () => {
    const el = await kur('<input type="text" inputmode="decimal" value="">');
    yapistir(el, '1.800');
    expect([gorunen(el), el.value]).toEqual(['1,800', '1.800']);
    expect(el.classList.contains('ve-sayi-belirsiz')).toBe(true);
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/1\.800.*1,8.*1800/), 'warning');
    el.dispatchEvent(new Event('input', { bubbles: true }));   // bir sonraki yazım
    expect(el.classList.contains('ve-sayi-belirsiz')).toBe(false);
  });

  test('YAPIŞTIRMA: sayı olmayan metin alana girmez ve söylenir', async () => {
    const el = await kur('<input type="text" inputmode="decimal" value="5">');
    expect(yapistir(el, 'kW 12').defaultPrevented).toBe(true);
    expect(el.value).toBe('5');
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/sayı değil/), 'warning');
  });

  test('harf yazılmaz (eski sayı alanı gibi); rakam, virgül, eksi yazılır', async () => {
    const el = await kur('<input type="text" inputmode="decimal" value="">');
    const dene = (data) => {
      const e = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(['a', 'x1', ' '].map(dene)).toEqual([true, true, true]);
    expect(['5', ',', '.', '-', 'e', '12,5'].map(dene)).toEqual([false, false, false, false, false, false]);
  });

  test('↑/↓ `step` taşıyan alanda adım atar, input + change ateşler; step yoksa dokunmaz', async () => {
    const el = await kur('<input type="text" inputmode="decimal" value="0.65" step="0.01" min="0">');
    const olay = [];
    el.addEventListener('input', () => olay.push('input'));
    el.addEventListener('change', () => olay.push('change'));
    const tus = (hedef, key) => {
      const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      hedef.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(tus(el, 'ArrowUp')).toBe(true);
    expect([gorunen(el), el.value, olay.join(',')]).toEqual(['0,66', '0.66', 'input,change']);
    tus(el, 'ArrowDown'); tus(el, 'ArrowDown');
    expect(el.value).toBe('0.64');
    document.body.insertAdjacentHTML('beforeend', '<input type="text" inputmode="decimal" value="7">');
    await kare();
    const adimsiz = document.body.lastElementChild;
    expect(tus(adimsiz, 'ArrowUp')).toBe(false);
    expect(adimsiz.value).toBe('7');
  });

  test('salt okunur alan Türkçe görünür ama yapıştırma/adım almaz', async () => {
    const el = await kur('<input type="text" inputmode="decimal" value="0.2150" step="1" readonly>');
    expect(gorunen(el)).toBe('0,2150');
    expect(yapistir(el, '5').defaultPrevented).toBe(false);
    expect(el.value).toBe('0.2150');
  });
});

describe('kaynak', () => {
  const URUN_JS = [
    ...fs.readdirSync(path.join(KOK, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f),
    ...fs.readdirSync(path.join(KOK, 'viewer/js')).filter((f) => f.endsWith('.js')).map((f) => 'viewer/js/' + f),
    ...fs.readdirSync(path.join(KOK, 'candbc/js')).filter((f) => f.endsWith('.js')).map((f) => 'candbc/js/' + f)
  ];

  test('ürünün hiçbir yerinde `type="number"` alan yok (yorumlar hariç)', () => {
    const bulunan = [];
    for (const f of URUN_JS) {
      yorumsuzJs(oku(f)).split('\n').forEach((l, i) => { if (/type=\\?["']?number/.test(l)) bulunan.push(f + ':' + (i + 1)); });
    }
    for (const f of ['index.html', 'viewer/index.html', 'candbc/index.html']) {
      yorumsuzHtml(oku(f)).split('\n').forEach((l, i) => { if (/type=\\?["']?number/.test(l)) bulunan.push(f + ':' + (i + 1)); });
    }
    expect(bulunan).toEqual([]);
  });

  test('katman sayı yazıcısından SONRA, yükleyiciden ve panellerden ÖNCE yükleniyor; görüntüleyici birebir taşıyor', () => {
    const h = oku('index.html');
    const yer = (s) => h.indexOf('src="js/' + s + '"');
    expect(yer('sayi-alan.js')).toBeGreaterThan(yer('sayi.js'));
    expect(yer('sayi-alan.js')).toBeLessThan(yer('loader.js'));
    expect(oku('viewer/js/sayi-alan.js')).toBe(oku('js/sayi-alan.js'));
    const v = oku('viewer/index.html');
    const vy = (s) => v.indexOf('src="js/' + s + '"');
    expect(vy('sayi-alan.js')).toBeGreaterThan(vy('sayi.js'));
    expect(vy('sayi-alan.js')).toBeLessThan(vy('trace-view.js'));
    expect(vy('sayi-alan.js')).toBeLessThan(vy('measure-import-ui.js'));
  });

  test('sabit seçicilerin hepsi geçerli CSS — dönüşüm bir seçiciyi bir kez bozdu', () => {
    // `input[type="number"]` metnin içinde de değişmişti ve geçersiz seçici
    // querySelectorAll'da PATLAR: şanzıman vites tablosu hiç okunmazdı.
    const bozuk = [];
    for (const f of URUN_JS.filter((x) => x.startsWith('js/'))) {
      const s = oku(f), re = /querySelector(?:All)?\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g;
      let m;
      while ((m = re.exec(s))) {
        const sec = m[1].replace(/\\'/g, "'");
        try { document.querySelector(sec); } catch (e) { bozuk.push(f + ': ' + sec); }
      }
    }
    expect(bozuk).toEqual([]);
  });
});

describe('dönüşümün okuyucuları', () => {
  test('şanzıman vites satırı: ad metin alanından, oran ve verim sayı alanından okunuyor', () => {
    const stubs = stubGlobals();
    eval(loadSource('cp-gearbox.js'));
    global.nodes = [{ id: 'g1', type: 'ft-gearbox', data: {} }];
    document.body.innerHTML = '<table><tbody id="ve-ftgear-table-g1">'
      + getVEFTGearRowHTML('g1', '1C', 3.487, 98.93, false)
      + getVEFTGearRowHTML('g1', '2C', 1.864, 99.1, true) + '</tbody></table>';
    // Kullanıcı virgülle yazdı: alan (kurulmuşsa) makine biçimini veriyor.
    document.querySelectorAll('input[inputmode="decimal"]').forEach((el) => SA.veSayiAlanKur(el));
    yerli.set.call(document.querySelectorAll('input[inputmode="decimal"]')[0], '3,5');
    onVEFTGearDataChange('g1');
    expect(global.nodes[0].data.ftGearData).toEqual([
      { name: '1C', ratio: 3.5, eff: 98.93, lockup: false },
      { name: '2C', ratio: 1.864, eff: 99.1, lockup: true }
    ]);
    resetStubs(stubs);
  });
});
