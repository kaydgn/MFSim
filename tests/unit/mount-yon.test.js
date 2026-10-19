/**
 * mount-yon.test.js — YÖNLENDİRME, Takoz (E4, 2026-10-19)
 * ───────────────────────────────────────────────────────────────────────
 * Biçimi metin-dili.test.js ölçüyor (yön profili). Burada:
 *   · KAPALI DENETİM SEBEBİNİ SÖYLER: Parametrik Analiz'in Tara'sı ve Rapor'un
 *     düğmesi görünür sebebe bağlı (aria-describedby); Kütüphane'nin Fabrika'sı
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

describe('Kütüphane: Fabrika kapalıyken sebebi ipucunda', () => {
  test('değiştirilmemiş gömülü tip', () => {
    modelKur('kamyon');
    const lib = global.nodes.find((n) => n.type === 'mnt-library') || { id: 'lb', type: 'mnt-library', data: {} };
    const d = dom(cp.getMntLibraryPropertiesHTML(lib));
    const f = [...d.querySelectorAll('button')].find((x) => /Fabrika/.test(x.textContent));
    expect(f).toBeTruthy();
    expect(f.getAttribute('aria-disabled')).toBe('true');
    expect(f.getAttribute('title')).toBe('Fabrika değerlerinde.');
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
