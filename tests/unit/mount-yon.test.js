/**
 * mount-yon.test.js — YÖNLENDİRME, Takoz (E4, 2026-10-19)
 * ───────────────────────────────────────────────────────────────────────
 * Biçimi metin-dili.test.js ölçüyor (yön profili). Burada:
 *   · KAPALI DENETİM SEBEBİNİ SÖYLER: Parametrik Analiz'in Tara'sı ve Rapor'un
 *     düğmesi görünür sebebe bağlı (aria-describedby); Kütüphane'nin Fabrika'sı (Canlı Not 65'te kalktı)
 *     sebebi ipucunda. Araştırma turunda üçü de sebepsizdi.
 *   · ÇARE YALNIZ YOLU PENCERENİN DIŞINDA OLAN EKSİKTE: Tara'nın rölanti ve
 *     silindir eksiği Motor penceresine gönderir; aday, sabit grup ve
 *     kombinasyon sınırı aynı pencerede — yönlendirmesiz.
 *   · YÖNLENDİRMEDEKİ AD EKRANDA VAR: Motor penceresinin iki alanı, sihirbazın
 *     Gövde ekle ve Takoz ekle denetimi, paletteki Çözücü.
 */
const H = require('../helpers/takoz-dogrulama.js');

const { cp, rp } = H.kur();
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
Object.keys(rp).forEach((k) => { if (global[k] === undefined) global[k] = rp[k]; });
global.veMntKatalog = require('../../js/mount-katalog.js');
const P = require('../../js/cp-mount-param.js');
Object.keys(P).forEach((k) => { if (global[k] === undefined) global[k] = P[k]; });
global.veIkon = global.veIkon || require('../../js/ikon.js').veIkon;
global.veDurumIkon = global.veDurumIkon || require('../../js/ikon.js').veDurumIkon;
const fs = require('fs');
const path = require('path');

const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; document.body.appendChild(d); return d; };
function modelKur(ad) {
  const t = H.ornek(ad);
  global.nodes = JSON.parse(JSON.stringify(t.nodes));
  global.connections = t.connections || [];
  return t;
}
const pnode = () => { const n = { id: 'pa', type: 'mnt-parametric', data: {} }; global.nodes.push(n); return n; };
const bagli = (d, sec) => {
  const b = d.querySelector(sec);
  expect(b).not.toBeNull();
  const h = document.getElementById(b.getAttribute('aria-describedby') || '');
  expect(h).not.toBeNull();
  return { b, metin: h.textContent.replace(/\s+/g, ' ').trim() };
};

afterEach(() => { document.body.innerHTML = ''; });

describe('Parametrik Analiz: Tara kapalıyken sebebine bağlı', () => {
  test('rölanti ve silindir yokken: sebep + Motor penceresine yönlendirme', () => {
    modelKur('kamyon');
    const m = global.nodes.find((n) => n.type === 'mnt-motor');
    delete m.data.idleRpm; delete m.data.cylinders;
    const n = pnode();
    expect(P._mntParamHazirlik(n).eksik).toBe('Rölanti devri ve silindir sayısı yok');
    const { b, metin } = bagli(dom(P.getMntParamPropertiesHTML(n)), '#ve-mnt-param-btn-pa');
    expect(b.disabled).toBe(true);
    expect(metin).toBe('Rölanti devri ve silindir sayısı yok. Motor penceresinde girin.');
  });
  test('aday kalmayınca: sebep aynı penceredeki adaylar — yönlendirmesiz, yine bağlı', () => {
    modelKur('kamyon');
    const n = pnode();
    P.veMntParamAdayHepsi('pa', false);
    const { b, metin } = bagli(dom(P.getMntParamPropertiesHTML(n)), '#ve-mnt-param-btn-pa');
    expect(b.disabled).toBe(true);
    expect(metin).toBe('Aday tip yok');
  });
  test('hazırken Tara açık ve bağsız', () => {
    modelKur('kamyon');
    const b = dom(P.getMntParamPropertiesHTML(pnode())).querySelector('#ve-mnt-param-btn-pa');
    expect(b.disabled).toBe(false);
    expect(b.hasAttribute('aria-describedby')).toBe(false);
  });
  test('yönlendirmedeki ad: Motor penceresinde Rölanti ve Silindir sayısı', () => {
    expect(componentDefs['mnt-motor'].name).toBe('Motor');
    modelKur('kamyon');
    const m = global.nodes.find((n) => n.type === 'mnt-motor');
    const d = dom(cp.getMntMassPropertiesHTML(m));
    const t = d.textContent;
    expect(t).toContain('Rölanti');
    expect(t).toContain('Silindir sayısı');
  });
});

describe('Rapor: kapalı düğme durum yazısına bağlı', () => {
  test('çözümsüz model', () => {
    modelKur('kamyon');
    global.veMntResults = null;
    const r = global.nodes.find((n) => n.type === 'mnt-report') || { id: 'rp', type: 'mnt-report', data: {} };
    const { b, metin } = bagli(dom(cp.getMntReportPropertiesHTML(r)), '.ve-fp-solve');
    expect(b.disabled).toBe(true);
    expect(metin).toBe('Model çözülmedi. Çözücü penceresinde Hesapla ile çözün.');
  });
});

// SADE TİP (kullanıcı 2026-11-06, Canlı Not 65: *"'Fabrika' falan yazıyor. 'Gömülü' falan
// yazıyor. Kaldıralım … Taşıma kapasitesi kısmını da kaldır"*): Takoz Özellikleri'nin Tip
// bölümünde tür rozeti, Fabrika düğmesi, tipin sayacı ve Taşıma kapasitesi yok; özel tipte Sil
// durur. Takoz penceresinin tip listesi aynı adlarla, sayaçsız.
describe('SADE TİP — Takoz Özellikleri ve Takoz penceresinin tip seçimi', () => {
  test('katalog tipinde ne rozet ne Fabrika ne sayaç ne Taşıma kapasitesi; özel tipte Sil', () => {
    modelKur('kamyon');
    const lib = global.nodes.find((n) => n.type === 'mnt-library') || { id: 'lb', type: 'mnt-library', data: {} };
    const d = dom(cp.getMntLibraryPropertiesHTML(lib));
    const metin = d.querySelector('.ve-fp-kat[data-k="tip"]').textContent;      // Tip bölümü
    expect([...d.querySelectorAll('button')].some((x) => /Fabrika/.test(x.textContent))).toBe(false);
    expect(d.querySelector('.ve-mnt-rozet')).toBeNull();
    expect(metin).not.toMatch(/gömülü|Gömülü/);
    expect(metin).not.toMatch(/Taşıma kapasitesi|Maks\. eksenel yük/i);
    expect(d.querySelector('[id^="ve-mnt-lib-maxLoad-"]')).toBeNull();
    expect(metin).not.toMatch(/\d+\s*özel/);
    lib.data = lib.data || {}; lib.data.mounts = [{ key: 'k1', name: 'Deneme', sx: 1, sy: 1, sz: 1, dx: 1, dy: 1, dz: 1 }]; lib.data._selKey = 'k1';
    const o = dom(cp.getMntLibraryPropertiesHTML(lib));
    expect([...o.querySelectorAll('button')].some((x) => /Sil/.test(x.textContent))).toBe(true);
  });
  test('Takoz penceresinin tip listesi: Katalog · Özel takozlar, sayaç yok', () => {
    modelKur('kamyon');
    const t = global.nodes.find((n) => n.type === 'mnt-mount');
    const d = dom(cp.getMntMountPropertiesHTML(t));
    const gr = [...d.querySelectorAll('optgroup')].map((g) => g.getAttribute('label'));
    expect(gr).toContain('Katalog');
    expect(gr).not.toContain('Gömülü');
    const bas = [...d.querySelectorAll('.ve-fp-sect')].find((x) => /Takoz tipi/i.test(x.textContent));
    expect(bas.textContent).not.toMatch(/gömülü|\d+\s*özel/);
  });
});

// SADE PENCERE (kullanıcı 2026-11-06, Canlı Not 66: *"Burayı komple kaldır … gereksiz
// bilgiler var"*): Takoz Özellikleri'nde Kullanım ve Katalog bölümleri, sağ sütun ve katalog
// tipinin yasasının altındaki not YOK; pencere tek sütun. Bölümler: Takoz tipi · Rijitlik ·
// Kuvvet–sehim (Yasa). Özel tipte eğri föyü durur.
describe('SADE PENCERE — Takoz Özellikleri tek sütun, Kullanım · Katalog · not yok', () => {
  const bolumler = (d) => [...d.querySelectorAll('.ve-fp-sect > b')].map((b) => b.textContent.trim());
  test('katalog tipi: sağ sütun yok, bölüm başlıklarında Kullanım ve Katalog yok, "gömülü" hiç yok', () => {
    modelKur('kamyon');
    const lib = global.nodes.find((n) => n.type === 'mnt-library') || { id: 'lb', type: 'mnt-library', data: {} };
    const d = dom(cp.getMntLibraryPropertiesHTML(lib));
    expect(d.querySelector('.ve-fp-side')).toBeNull();
    expect(d.querySelector('.ve-fp-split--tek')).not.toBeNull();
    expect(bolumler(d)).not.toEqual(expect.arrayContaining(['Kullanım']));
    expect(bolumler(d)).not.toEqual(expect.arrayContaining(['Katalog']));
    expect(d.textContent).not.toMatch(/gömülü|Gömülü|GÖMÜLÜ/);
    expect(d.textContent).not.toMatch(/fabrika değeri|salt okunur|hiçbir takoza uygulanmamış|Nonlineer yasalı/i);
    expect(d.querySelectorAll('.ve-fp-kat[data-k="egri"] .ve-fp-not').length).toBe(0);
  });
  test('özel tip: tek sütun, eğri föyü durur; seçim bulunamayınca da sağ sütun yok', () => {
    modelKur('kamyon');
    const lib = { id: 'lb', type: 'mnt-library', data: { mounts: [{ key: 'k1', name: 'Deneme', sx: 1, sy: 1, sz: 1, dx: 1, dy: 1, dz: 1 }], _selKey: 'k1' } };
    const d = dom(cp.getMntLibraryPropertiesHTML(lib));
    expect(d.querySelector('.ve-fp-side')).toBeNull();
    expect(bolumler(d)).toEqual(expect.arrayContaining(['Takoz tipi', 'Rijitlik', 'Yasa', 'Düşey (z) eğrisi']));
    const bos = dom(cp.getMntLibraryPropertiesHTML({ id: 'lb2', type: 'mnt-library', data: { mounts: [], _selKey: 'yok' } }));
    expect(bos.querySelector('.ve-fp-side')).toBeNull();
  });
});

describe('ad ekranda var', () => {
  test('sihirbazın Gövde ekle ve Takoz ekle denetimleri; paletteki Çözücü', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../js/cp-mount-wizard.js'), 'utf8');
    expect(src).toContain('aria-label="Gövde ekle"');
    expect(src).toContain("' Takoz ekle</button>");
    const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
    expect(html).toMatch(/data-type="mnt-solver"/);
  });
});
