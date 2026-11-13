/**
 * mount-yay-ciz.test.js — ASKI YAYI: ÖN YÜK VE TEKNİK RESİM (2026-11-13)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı: *"bu yay muhabbetini programa iyi bir şekilde entegre edelim. Ön yük falan filan.
 * Hatta ben sana bu analizde kullanılan yayın teknik resmini de attım. Onu da programa
 * ekleyebiliriz."* Resmin taraması programa girmez (parça kodu — Canlı Not 1004; kişi adları;
 * üreticinin çoğaltma kısıtı): program yayı resmin verisinden çizer (js/mount-yay-ciz.js).
 *   · ÇİZİM — SVG geçerli, HTML öğesi yok; resmin bütün sayıları Türkçe yazımla (L0 · ilk ·
 *     montaj · blok, kuvvetleri ve toleransları, Do · Di · d); yazılar üst üste binmez, ≥ 9,5 px;
 *     sarımlar sol yüzden d/2'de başlar, sağ yüzden d/2'de biter, blok boyu nt·d.
 *   · SINIFLAR — çizicinin her sınıfının programda (css/styles.css) ve raporda kuralı var.
 *   · ÖN YÜK — "Tasarım konumundaki ön yük" (Adams'ın preload'u) tasarım boyu L0 − F·g/k ile
 *     AYNI çözüm; doğrulama cümleleri; pencerenin karşılığı.
 *   · RESİM — pencerede resmin noktaları ve "Resmin ön yükü" (tek adım, uygulanınca kapalı);
 *     (i) teknik resmi pencere ailesinin penceresinde açar; katalogsuz yayda ikisi de yok.
 *   · RAPOR — §8.20 "Askı yayı ve resmi": ISG (Adams, ön yük 0) ilk ve montaj ✗; resmin ön
 *     yüküyle ilk ✓, montaj sol ✓ sağ ✗ (CG −y'de); şekil yay başına statik noktayı taşır.
 */
const fs = require('fs');
const path = require('path');
const H = require('../helpers/takoz-dogrulama.js');
const { cp, rp } = H.kur();
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
Object.keys(rp).forEach((k) => { if (global[k] === undefined) global[k] = rp[k]; });
global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
Object.assign(global, require('../../js/mount-yay.js'));
global.veMntYayCiz = require('../../js/mount-yay-ciz.js');
global.veIkon = global.veIkon || require('../../js/ikon.js').veIkon;
const C = global.veMntYayCiz;
const E = global.veMntYay('tta-aski');
const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');

const svgDom = (svg) => new DOMParser().parseFromString(svg, 'image/svg+xml');
const yazilar = (svg) => [...svgDom(svg).querySelectorAll('text')].map((t) => t.textContent);
const aski = (t) => t.nodes.filter((n) => n.type === 'mnt-aski');
const isg = (P) => { const t = H.ornek('isg430askili'); if (P != null) aski(t).forEach((n) => { n.data.onyukF = P; }); return t; };
const tablo = (h) => h.split('Askı yayı ve resmi</caption>')[1].split('</table>')[0]
  .split('</tr>').slice(1, -1).map((r) => [...r.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim()));

describe('ÇİZİM — resmin verisinden teknik resim', () => {
  const r = C.cizim(E, { px: 11 });
  test('SVG geçerli; HTML öğesi yok; resmin sayıları Türkçe yazımla', () => {
    expect(svgDom(r.svg).querySelector('parsererror')).toBeNull();
    expect(r.svg).not.toMatch(/<(sub|sup|span|div|b|br)[\s>]/);
    expect(yazilar(r.svg).sort()).toEqual(['F0 = 0', 'Filk = 93,5 ± 8 kgf', 'Fmontaj = 117 ± 10 kgf', 'Fst = 158 kgf',
      'L0 = 90', 'Lilk = 74', 'Lmontaj = 70', 'Lst = 63 min', 'd = Ø9', 'Ø52', 'Ø70'].sort());
  });
  test('yazılar üst üste binmez, çizim alanında; yazı boyu ≥ 9,5 px (alt simge tspan)', () => {
    const K = r.kutular;
    for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) {
      const p = K[i], q = K[j];
      expect([p.t, q.t, p.l < q.r && q.l < p.r && p.ust < q.alt && q.ust < p.alt]).toEqual([p.t, q.t, false]);
    }
    K.forEach((k) => { expect(k.l).toBeGreaterThanOrEqual(0); expect(k.r).toBeLessThanOrEqual(r.W); expect(k.ust).toBeGreaterThanOrEqual(0); expect(k.alt).toBeLessThanOrEqual(r.H); });
    [...svgDom(r.svg).querySelectorAll('text')].forEach((t) => expect(+t.getAttribute('font-size')).toBeGreaterThanOrEqual(9.5));
  });
  test('kuvvet yazıları çizimin solunda: bağımsız genişlik ölçüsüyle yazı serbest boyun sol ucuna değmez', () => {
    // çizicinin tahmininden BAĞIMSIZ: harf 0,6 em, alt simgenin harfi 0,8 boyunda (gerçek kutudan cömert)
    const gen = (t) => [...t].reduce((w, c, i, a) => w + 11 * 0.6 * (a.slice(0, i).includes('_') && !a.slice(a.indexOf('_'), i).includes(' ') ? 0.8 : 1), 0);
    const xL0 = r.x(E.L0);
    [...svgDom(r.svg).querySelectorAll('text')].filter((t) => /^F/.test(t.textContent)).forEach((t) => {
      const ham = t.textContent.replace(/^F/, 'F_');
      expect([t.textContent, +t.getAttribute('x') + gen(ham) < xL0 - 4]).toEqual([t.textContent, true]);
    });
  });
  test('sarımlar: sol yüzden d/2, sağ yüzden d/2; 2·nt + 1 kesit; blok boyu nt·d', () => {
    const u = C.sarimlar(E);
    expect(u.length).toBe(2 * E.nt + 1);
    expect(u[0]).toBeCloseTo(E.d / 2, 9);
    expect(u[u.length - 1]).toBeCloseTo(E.L0 - E.d / 2, 9);
    expect(E.nt * E.d).toBe(E.Lc);
    expect(svgDom(r.svg).querySelectorAll('circle.ve-yay-kesit').length).toBe(2 * E.nt + 1);
  });
  test('kuvvet ölçeği: noktalar boylarının sol ucunda, kuvvetleriyle; model ve aralık yalnız istenince', () => {
    C.boylar(E).forEach((b) => {
      const kare = [...svgDom(r.svg).querySelectorAll('rect.ve-yay-nokta')]
        .find((q) => Math.abs(+q.getAttribute('x') + 3 - r.x(b.L)) < 0.06 && Math.abs(+q.getAttribute('y') + 3 - r.y(b.F)) < 0.06);
      expect([b.k, !!kare]).toEqual([b.k, true]);
    });
    expect(r.svg).not.toMatch(/ve-yay-model|ve-yay-aralik/);
    const m = C.cizim(E, { px: 11, model: [{ L: 85.5, F: 26.1 }, { L: 86.1, F: 22.8 }], aralik: [80, 88] });
    expect(svgDom(m.svg).querySelectorAll('circle.ve-yay-model').length).toBe(2);
    expect(svgDom(m.svg).querySelectorAll('line.ve-yay-aralik').length).toBe(1);
  });
  test('resmin verisi: yay sabiti toleransıyla ve N/mm, sarım, uç, yön, ön gerilim, kumlama, malzeme, tolerans', () => {
    expect(C.veri(E)).toEqual([
      ['Yay sabiti', '5,85 ± 0,5 kgf/mm (57,4 N/mm)'], ['Sarım', 'toplam 7 · aktif 5'], ['Uç', 'kapalı, taşlanmış'],
      ['Sarım yönü', 'sağ'], ['Ön gerilim', 'var'], ['Kumlama', '31A–35A'], ['Blok boyuna sıkıştırma', 'evet'],
      ['Malzeme', 'SAE 9262H (60SiCr7)'], ['Çekme dayanımı', '1.481 MPa'], ['Tolerans', 'DIN 2095 sınıf 1']]);
  });
});

describe('SINIFLAR — çizicinin her sınıfının kuralı programda ve raporda', () => {
  test('styles.css ve raporun CSS\'i her ve-yay-* sınıfını tanır', () => {
    const m = C.cizim(E, { px: 11, model: [{ L: 80, F: 50 }], aralik: [78, 82] }).svg;
    const siniflar = [...new Set([...m.matchAll(/class="([^"]+)"/g)].flatMap((x) => x[1].split(/\s+/)))];
    expect(siniflar.length).toBeGreaterThan(12);
    siniflar.forEach((s) => {
      expect([s, new RegExp('\\.' + s + '[\\s,{:.]').test(CSS)]).toEqual([s, true]);
      if (s !== 've-yay') expect([s, rp._MNT_REP_YAY_CSS.indexOf('.' + s) >= 0]).toEqual([s, true]);
    });
  });
});

describe('ÖN YÜK — tasarım konumundaki ön yük', () => {
  test('tasarım boyu L0 − F·g/k ile aynı çözüm; çekirdeğe tasarım boyu olarak girer', () => {
    const [h] = cp._mntAskilarSI([{ name: 'A', x: 0, y: 0, z: 0, k: 57.39, L0: 90, Lc: 63, kurulum: 'onyuk', onyukF: 93.5 }], 9.81);
    expect([h.kurulum, h.giris]).toEqual(['tasarim', 'onyuk']);
    expect(h.P).toBeCloseTo(93.5 * 9.81, 9);
    expect(h.Ld * 1000).toBeCloseTo(90 - 93.5 * 9.81 / 57.39, 9);
    const t = isg(93.5), t2 = isg();
    aski(t2).forEach((n) => { n.data.kurulum = 'tasarim'; n.data.tasarimL = 90 - 93.5 * 9.81 / 57.39; });
    const d = (R) => R.allCases.find((rc) => rc.name === 'Static').res.perMount.map((m) => m.delta[2]);
    expect(d(H.coz(t))).toEqual(d(H.coz(t2)).map((v) => expect.closeTo(v, 12)));
  });
  test('doğrulama: boş, negatif, bloka indiren ön yük modeli durdurur', () => {
    [['', 'ön yük girilmedi.'], [-5, 'ön yük negatif.'], [300, 'ön yük yayı blok boyuna indiriyor.']].forEach(([v, m]) => {
      const t = isg(); aski(t)[0].data.onyukF = v;
      expect(H.coz(t).error.join(' ')).toContain('Sol askı yayı: ' + m);
    });
    expect(H.coz(isg(0)).error).toBeUndefined();
  });
  test('pencere: dört biçim; ön yükün karşılığı tasarım boyu, tasarım boyununki ön yük', () => {
    global.nodes = isg(93.5).nodes;
    const n = aski({ nodes: global.nodes })[0];
    const d = document.createElement('div'); d.innerHTML = cp.getMntAskiPropertiesHTML(n);
    expect([...d.querySelectorAll('#ve-mnt-kurulum-' + n.id + ' option')].map((o) => [o.value, o.textContent])).toEqual([
      ['kuvvet', 'Statik montaj kuvveti'], ['boy', 'Statik montaj boyu'], ['onyuk', 'Tasarım konumundaki ön yük'], ['tasarim', 'Tasarım konumundaki boy']]);
    expect(d.querySelector('#ve-mnt-onyukF-' + n.id).value).toBe('93.5');
    expect(d.querySelector('#ve-mnt-askikarsi-' + n.id).value).toBe('74,02');
    expect(cp._mntAskiKarsilik({ k: 57.39, L0: 90, kurulum: 'tasarim', tasarimL: 74 })).toEqual({ ad: 'Ön yük <u>[kgf]</u>', deger: '93,6' });
    expect(cp._mntAskiKarsilik({ k: 57.39, L0: 90, kurulum: 'onyuk', onyukF: '' }).deger).toBe('—');
  });
});

describe('RESİM — resmin noktaları, "Resmin ön yükü" ve (i)', () => {
  beforeEach(() => { global.nodes = isg().nodes; });
  test('Kurulum\'da resmin noktaları; Resmin ön yükü ön yükü resmin ilk kuvvetine çevirir, sonra kapalı', () => {
    const n = aski({ nodes: global.nodes })[0];
    const kur = () => { const d = document.createElement('div'); d.innerHTML = cp.getMntAskiPropertiesHTML(n); return d; };
    let d = kur();
    const b = d.querySelector('#ve-mnt-askiresim-' + n.id);
    expect(b.querySelector('.ve-fp-sect b').textContent).toBe('Resmin noktaları');
    expect([...b.querySelectorAll('tbody tr')].map((r) => [...r.cells].map((c) => c.textContent))).toEqual([
      ['İlk', '74', '93,5 ± 8'], ['Montaj', '70', '117 ± 10'], ['Blok', '63 min', '158']]);
    expect(d.querySelector('#ve-mnt-askionyuk-' + n.id).getAttribute('aria-disabled')).toBeNull();
    const kayit = global.saveState.mock ? global.saveState.mock.calls.length : 0;
    cp.veMntAskiResimOnYuk(n.id);
    expect([n.data.kurulum, n.data.onyukF]).toEqual(['onyuk', 93.5]);
    if (global.saveState.mock) expect(global.saveState.mock.calls.length).toBe(kayit + 1);
    d = kur();
    expect(d.querySelector('#ve-mnt-askionyuk-' + n.id).getAttribute('aria-disabled')).toBe('true');
    expect(d.querySelector('#ve-mnt-askikarsi-' + n.id).value).toBe('74,02');
  });
  test('(i) Katalog\'un adında; teknik resmi ve resmin verisini pencerede açar; katalogsuz yayda yok', () => {
    const n = aski({ nodes: global.nodes })[0];
    const d = document.createElement('div'); d.innerHTML = cp.getMntAskiPropertiesHTML(n);
    const i = d.querySelector('.ve-mnt-yay-resim');
    expect([i.dataset.yay, i.getAttribute('aria-label'), i.closest('.ve-fp-l').querySelector('label').textContent]).toEqual(['tta-aski', 'Teknik resim', 'Katalog']);
    global.veBasResimGoster = jest.fn(() => true);
    expect(cp.veMntAskiResimAc(i)).toBe(true);
    const o = global.veBasResimGoster.mock.calls[0][0];
    expect(o.ad).toBe('BMC Şanzıman askı yayı · teknik resim');
    expect(o.html).toContain('<svg class="ve-yay"');
    expect(o.html).toContain('<th scope="row">Yay sabiti</th><td>5,85 ± 0,5 kgf/mm (57,4 N/mm)</td>');
    expect(o.html).not.toMatch(/2K6|BRS|ZERDAL|TAYGUR|KATRANCI/);              // parça kodu, standart kodu, kişi adı yok
    delete global.veBasResimGoster;
    n.data.yay = '';
    const d2 = document.createElement('div'); d2.innerHTML = cp.getMntAskiPropertiesHTML(n);
    expect(d2.querySelector('.ve-mnt-yay-resim')).toBeNull();
    expect(d2.querySelector('#ve-mnt-askiresim-' + n.id)).toBeNull();
  });
});

describe('RAPOR — §8.20 askı yayı ve resmi', () => {
  test('ISG (Adams, ön yük 0): ilk ve montaj resmin dışında; resmin ön yüküyle ilk ✓, montaj sol ✓ sağ ✗', () => {
    const h0 = rp._mntRepAski(H.coz(isg()));
    expect(h0).toContain('<td class="l">ön yük 0 kgf</td>');
    expect(tablo(h0)).toEqual([
      ['Sol askı yayı', '90', '0', '✗ −93,5', '85,53', '26,1', '✗ −90,9'],
      ['Sağ askı yayı', '90', '0', '✗ −93,5', '86,11', '22,8', '✗ −94,2']]);
    const h = rp._mntRepAski(H.coz(isg(93.5)));
    expect(h).toContain('<td class="l">ön yük 93,5 kgf</td>');
    expect(tablo(h)).toEqual([
      ['Sol askı yayı', '74,02', '93,5', '✓ 0', '71,68', '107,2', '✓ −9,8'],
      ['Sağ askı yayı', '74,02', '93,5', '✓ 0', '72,26', '103,8', '✗ −13,2']]);
    const fig = h.split('<figure class="rp-yay">')[1].split('</figure>')[0];
    expect(svgDom(fig.split('<figcaption>')[0]).querySelectorAll('circle.ve-yay-model').length).toBe(2);
    expect(h).toContain('<style>' + rp._MNT_REP_YAY_CSS + '</style>');
  });
  test('resmi olmayan yayda bölüm yok', () => {
    const t = isg(); aski(t).forEach((n) => { n.data.yay = ''; });
    const h = rp._mntRepAski(H.coz(t));
    expect(h).not.toContain('Askı yayı ve resmi');
    expect(h).not.toContain('rp-yay');
  });
});
