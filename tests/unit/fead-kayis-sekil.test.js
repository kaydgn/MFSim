/**
 * fead-kayis-sekil.test.js — 3B'DE KAYIŞ SEÇİLİNCE: KESİT ŞEKLİ, HESAP ÇAPI, ÖLÇÜLER (7)
 *
 * Kullanıcı isteği (2026-09-29): *"Abi sana attığım bu resimi 3B görsel okuyucu
 * penceresine sağ tarafa yerleştireceksin. Kullanıcı hangi çapı kullanacağını
 * buradan kayışı seçtikten sonra seçecek. Orada görsel olarak belirecek yani.
 * Ayrıca 3B görsel okuyucu penceresinin sağ tarafında yazıların olduğu sütunu
 * biraz genişletelim."* Resim ContiTech'in "Available sizes" sayfası: Şekil 1
 * (kayış tek başına s · h; kasnağa oturmuş h_r · h_b · d_w · d_b) + Tablo 1
 * (profil başına karakteristik ölçüler).
 *
 * Şekli PROGRAM çizer, resim gömülmez: resmin tablosu tek markanın sayıları;
 * Gates seçili bir modelin yanında ContiTech'in h_b'si hesaptakiyle çelişirdi.
 *
 * Kapılar:
 *   · ŞEKİL ölçekli ve ANLAMLI: d_w ile d_b arası h_b, sırt ile d_w arası h_r
 *     (oranı sayıyla), s tam BİR kaburga adımı, iki görünüş aynı ölçekte;
 *     hesabın çizgisi seçimle (d_w ↔ d_b); CAD seçiliyse eskizin h_b · h_r'si
 *   · TABLO veriyle BİREBİR (`veFeadBeltGeom` — kural 40'ın tablosu): her hücre
 *     okunup geri çevrilince kaydın kendisi; satırda tek ondalık; kaynak damgası;
 *     kayışın profili vurgulu; ContiTech sütunları resmin Tablo 1'i
 *   · MATRİS: her hücre o seçeneğin hesap çapı (d_b + 2·h_b · sırtta OD + 2·h_r),
 *     tek sütun seçili, düğmeler TEK yazıcıyı çağırır; hesaptan önce kasnak yok
 *   · 3B PANELİ: bölüm yalnız KAYIŞ biriminde (birimin içindeki parça dâhil),
 *     hesaptan önce de; profil hesaptan önce kayışın ADINDAKİ koddan
 *   · kasnaktaki kesit GATES + PJ/PL/PM'de de çiziliyor (proje tablosuna düşer)
 */
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const B = require('../../js/fead-belts.js');
const P = require('../../js/step-p21.js');
const S = require('../../js/fead-step.js');
const U = require('../../js/step-ucgen.js');
const O = require('../helpers/step-ornek.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;
eval(loadSource('cp-accessories.js'));
global.VE_ALTERNATOR_PRESETS = VE_ALTERNATOR_PRESETS;
global.VE_AC_PRESETS = VE_AC_PRESETS;
global.VE_AIRCOMP_PRESETS = VE_AIRCOMP_PRESETS;
global.veAccInterpCurve = veAccInterpCurve;
[require('../../js/fead-duty.js'), B, require('../../js/fead-tensioners.js'),
  require('../../js/fead-engines.js'), require('../../js/fead-accessories.js'), require('../../js/fead-checks.js'), P, S, U]
  .forEach((m) => { Object.keys(m).forEach((k) => { global[k] = m[k]; }); });
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });
const G = require('../../js/cp-fead-3b.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

const kabuk = () => {
  document.body.innerHTML = '<div id="ve-canvas"></div>'
    + '<div id="ve-feadwiz-overlay" style="display:none;">'
    + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
};
const ROL = [[/GERG/, 'fead-tensioner'], [/KRANK/, 'fead-crank'], [/KL[İI]MA/, 'fead-ac'],
  [/AVARA/, 'fead-idler'], [/KAYI/, 'fead-belt']];
const ESKIZ = { eskiz: { hb: 1.5, hr: 1.5 } };
const dugum = (re) => wiz.veFeadWizStp().sonuc.agac.findIndex((d) => re.test(d.ad));
// Dosyayı oku, rolleri ver; `hesap` false ise hesaplama (kayış hesaptan önce seçilir)
const hazirla = (opt, hesap = true, kural = ROL) => {
  kabuk(); wiz.veFeadWizReset();
  wiz.veFeadWizStpOku(O.ag00686Step(opt), 'AG00686.stp');
  kural.forEach(([re, tip]) => { const i = dugum(re); if (i >= 0) wiz.veFeadWizStpRol(i, tip); });
  if (hesap) wiz.veFeadWizStpHesapla();
  return wiz.veFeadWizStp();
};
const dom = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
const sayi = (t) => Number(String(t).trim().replace(/\./g, '').replace(',', '.'));
const geo = (p, b) => { const g = B.veFeadBeltGeom(p, b); return { e: g.ribAdim, t: g.kalinlik, hb: g.hb, hr: g.hr }; };

// Şeklin ölçüsü, çizdiği yollardan: sağ görünüşteki kayışın sırtı (yolun ilk
// noktası) ile d_w · d_b çizgilerinin y'si; ölçek sol kayışın genişliğinden.
function sekilOlc(svg) {
  const d = dom(svg);
  const yolNok = (sec) => (d.querySelector(sec).getAttribute('d').match(/-?\d+(\.\d+)?/g) || []).map(Number);
  const sag = yolNok('[data-ve="sekil-kayis-kasnakta"]');
  const sol = yolNok('[data-ve="sekil-kayis"]');
  const y = (sec) => Number(d.querySelector(sec).getAttribute('y1'));
  return {
    d,
    sirt: sag[1],
    dw: y('[data-ve="sekil-dw"]'),
    db: y('[data-ve="sekil-db"]'),
    solGen: sol[2] - sol[0],          // M x0 y0 L x1 y0 → sırtın boyu
    sagGen: sag[2] - sag[0],
    hesap: [...d.querySelectorAll('[data-ve-hesap="1"]')].map((e) => e.getAttribute('data-ve')),
    olcu: (v) => d.querySelector('[data-ve-olcu="' + v + '"]').textContent.replace(/\s+/g, ' ').trim(),
  };
}

describe('ŞEKİL 1 — ölçekli ve anlamlı', () => {
  test('d_w ile d_b arası h_b, sırt ile d_w arası h_r — ORANI sayıyla, 14 bileşimin hepsinde', () => {
    let n = 0;
    B.VE_FEAD_BELT_PROFILES.forEach((p) => B.VE_FEAD_BELT_BRANDS.forEach((b) => {
      const g = geo(p, b);
      const svg = fead.veFeadKayisSekilSVG(g, { hesap: 'dw' });
      if (!g.t) { expect([p, b, svg]).toEqual([p, b, '']); return; }   // Gates PH üretilmiyor: kalınlık yok
      const o = sekilOlc(svg);
      const olcek = o.solGen / (2 * g.e);                               // iki diş
      expect([p, b, o.db > o.dw, o.dw > o.sirt]).toEqual([p, b, true, true]);
      expect((o.dw - o.sirt) / olcek).toBeCloseTo(g.hr, 1);
      expect((o.db - o.dw) / olcek).toBeCloseTo(g.hb, 1);
      expect(o.sagGen).toBeCloseTo(o.solGen, 6);                        // iki görünüş aynı ölçek
      n++;
    }));
    expect(n).toBe(14);
  });
  test('s TAM BİR kaburga adımı; yazılar çizilen kayışın sayıları (Türkçe)', () => {
    const g = geo('PK', 'GATES');
    const o = sekilOlc(fead.veFeadKayisSekilSVG(g, { hesap: 'dw' }));
    const olcek = o.solGen / (2 * g.e);
    const uz = [...o.d.querySelectorAll('line')].filter((l) => l.getAttribute('x1') === l.getAttribute('x2')
      && Number(l.getAttribute('y1')) > o.db);                            // diş tepelerinin altındaki iki uzantı
    const xs = uz.map((l) => Number(l.getAttribute('x1'))).sort((a, b) => a - b);
    expect(xs.length).toBe(2);
    expect((xs[1] - xs[0]) / olcek).toBeCloseTo(g.e, 1);
    expect([o.olcu('s'), o.olcu('h'), o.olcu('hr'), o.olcu('hb')]).toEqual(['s 3,56', 'h 4,60', 'hr 1,10', 'hb 1,20']);
  });
  test('hesabın çizgisi seçimle: dw → d_w dolu, db → d_b dolu, yoksa hiçbiri', () => {
    const g = geo('PK', 'CONTITECH');
    expect(sekilOlc(fead.veFeadKayisSekilSVG(g, { hesap: 'dw' })).hesap).toEqual(['sekil-dw']);
    expect(sekilOlc(fead.veFeadKayisSekilSVG(g, { hesap: 'db' })).hesap).toEqual(['sekil-db']);
    expect(sekilOlc(fead.veFeadKayisSekilSVG(g, {})).hesap).toEqual([]);
    const d = dom(fead.veFeadKayisSekilSVG(g, { hesap: 'db' }));
    expect(d.querySelector('[data-ve-cizgi="db"]').textContent).toMatch(/hesap/);
    expect(d.querySelector('[data-ve-cizgi="dw"]').textContent).not.toMatch(/hesap/);
  });
  test('geçersiz kesit çizilmez (h ≤ h_r + h_b, eksik sayı)', () => {
    expect(fead.veFeadKayisSekilSVG({ e: 3.56, t: 2, hb: 1.2, hr: 1.1 })).toBe('');
    expect(fead.veFeadKayisSekilSVG({ e: 3.56, t: 4.6, hb: 0, hr: 1.1 })).toBe('');
    expect(fead.veFeadKayisSekilSVG(null)).toBe('');
  });
  test('tarama deseni her çağrıda AYRI kimlik — iki şekil aynı sayfada birbirinin desenini çalmaz', () => {
    const a = dom(fead.veFeadKayisSekilSVG(geo('PK', 'GATES'))), b = dom(fead.veFeadKayisSekilSVG(geo('PK', 'GATES')));
    const id = (d) => d.querySelector('pattern').id;
    expect(id(a)).not.toBe(id(b));
    [a, b].forEach((d) => expect(d.querySelector('[data-ve="sekil-kasnak"]').getAttribute('fill')).toBe('url(#' + id(d) + ')'));
    // renk temadan (çıplak renk yok)
    expect(fead.veFeadKayisSekilSVG(geo('PK', 'GATES'))).not.toMatch(/#[0-9a-f]{3,6}"/i);
  });
});

describe('KARAKTERİSTİK ÖLÇÜLER — veriyle birebir', () => {
  const tablo = (b, p) => dom(fead.veFeadKayisOlcuHTML(b, p));
  test('her hücre okunup geri çevrilince kaydın KENDİSİ — üç marka × beş profil × yedi satır', () => {
    let n = 0;
    B.VE_FEAD_BELT_BRANDS.forEach((b) => {
      const d = tablo(b, 'PK');
      const prof = [...d.querySelectorAll('thead th[data-ve-profil]')].map((th) => th.getAttribute('data-ve-profil'));
      expect(prof).toEqual(B.VE_FEAD_BELT_PROFILES);
      fead.VE_FEAD_KAYIS_OLCU.forEach(([veri, , alan]) => {
        const hucre = [...d.querySelectorAll('tr[data-ve-olcu="' + veri + '"] td')].slice(1);
        hucre.forEach((td, i) => {
          const v = B.veFeadBeltGeom(prof[i], b)[alan];
          if (!Number.isFinite(v)) expect(td.textContent).toBe('—');
          else expect([b, prof[i], veri, sayi(td.textContent)]).toEqual([b, prof[i], veri, v]);
          n++;
        });
        // satırda TEK ondalık (0,0144 dördüncü basamağı isterse bütün satır ister)
        const ond = new Set(hucre.filter((td) => td.textContent !== '—')
          .map((td) => (td.textContent.split(',')[1] || '').length));
        expect([b, veri, ond.size]).toEqual([b, veri, 1]);
      });
    });
    expect(n).toBe(3 * 5 * 7);
  });
  test('ContiTech sütunları resmin Tablo 1\'i (s · h · h_b · h_r · d_b min · v · kg/m)', () => {
    const d = tablo('CONTITECH', 'PK');
    const satir = (v) => [...d.querySelectorAll('tr[data-ve-olcu="' + v + '"] td')].slice(1).map((td) => sayi(td.textContent));
    expect(satir('s')).toEqual([1.6, 2.34, 3.56, 4.7, 9.4]);
    expect(satir('h')).toEqual([2.7, 3.8, 5, 7.5, 14.5]);
    expect(satir('hb')).toEqual([0.8, 1.2, 1.5, 3, 4]);
    expect(satir('hr')).toEqual([1, 1.1, 1.5, 1.5, 2]);
    expect(satir('dbmin')).toEqual([13, 20, 45, 75, 180]);
    expect(satir('v')).toEqual([60, 60, 50, 40, 35]);
    expect(satir('kutle')).toEqual([0.005, 0.009, 0.021, 0.037, 0.12]);
  });
  test('kayışın profili vurgulu — her satırda TEK hücre, o profilin sütunu', () => {
    ['PH', 'PK', 'PM'].forEach((p) => {
      const d = tablo('GATES', p);
      const i = B.VE_FEAD_BELT_PROFILES.indexOf(p) + 1;
      [...d.querySelectorAll('tr')].forEach((tr) => {
        const on = [...tr.children].map((c, k) => (c.classList.contains('on') ? k : -1)).filter((k) => k >= 0);
        expect([p, on]).toEqual([p, [i]]);
      });
    });
    expect(tablo('GATES', 'XX').querySelectorAll('.on').length).toBe(0);
  });
  test('kaynak damgası: Gates PK defter, PJ/PL/PM ISO, PH üretmiyor; öteki iki marka üretici', () => {
    const damga = (b) => [...tablo(b, 'PK').querySelectorAll('tr[data-ve-olcu="kaynak"] td')].slice(1).map((td) => td.textContent);
    expect(damga('GATES')).toEqual(['üretmiyor', 'ISO', 'defter', 'ISO', 'ISO']);
    expect(damga('OPTIBELT')).toEqual(Array(5).fill('üretici'));
    expect(damga('CONTITECH')).toEqual(Array(5).fill('üretici'));
    // uzun cümle title'da (tek üretici VE_FEAD_BELT_GEOM_NOTE)
    const td = tablo('GATES', 'PK').querySelectorAll('tr[data-ve-olcu="kaynak"] td')[3];
    expect(td.getAttribute('title')).toBe(B.VE_FEAD_BELT_GEOM_NOTE.defter);
  });
});

describe('HESAP ÇAPI MATRİSİ — sütun seçenek, satır kasnak', () => {
  const matris = (s) => dom(wiz._fwStpHesapCapMatrisHTML(s));
  test('her hücre o seçeneğin hesap çapı: kaburgalı d_b + 2·h_b, sırtta OD + 2·h_r', () => {
    const s = hazirla(ESKIZ);
    const d = matris(s);
    const mod = [...d.querySelectorAll('thead [data-ve-hesapcap]')].map((b) => b.getAttribute('data-ve-hesapcap'));
    expect(mod).toEqual(['katalog', 'cad', 'db']);
    const of = { katalog: { hb: 1.2, hr: 1.1 }, cad: { hb: 1.5, hr: 1.5 }, db: { hb: 0, hr: 0 } };
    s.coz.kasnaklar.forEach((k, i) => {
      const hucre = [...d.querySelectorAll('tr[data-ve-hc-kasnak="' + i + '"] td')].slice(1).map((td) => sayi(td.textContent));
      const bek = mod.map((m) => k.od + 2 * (k.tur === 'kanalli' ? of[m].hb : of[m].hr));
      expect([k.tip, hucre]).toEqual([k.tip, bek.map((v) => Math.round(v * 100) / 100)]);
    });
    expect(d.querySelectorAll('tr[data-ve-hc-kasnak]').length).toBe(s.coz.kasnaklar.length);
  });
  test('TEK sütun seçili (varsayılan CAD); düğme tek yazıcıyı çağırır ve seçim sütunu taşır', () => {
    const s = hazirla(ESKIZ);
    const secili = (d) => [...d.querySelectorAll('thead th')].map((th, i) => (th.classList.contains('on') ? i : -1)).filter((i) => i >= 0);
    let d = matris(s);
    expect(secili(d)).toEqual([2]);
    expect([...d.querySelectorAll('[aria-pressed="true"]')].map((b) => b.getAttribute('data-ve-hesapcap'))).toEqual(['cad']);
    [...d.querySelectorAll('thead button')].forEach((b) =>
      expect(b.getAttribute('onclick')).toBe("veFeadWizStpHesapCap('" + b.getAttribute('data-ve-hesapcap') + "')"));
    wiz.veFeadWizStpHesapCap('db');
    d = matris(s);
    expect(secili(d)).toEqual([3]);
    // her satırda aynı sütun işaretli
    [...d.querySelectorAll('tbody tr[data-ve-hc-kasnak]')].forEach((tr) =>
      expect([...tr.children].findIndex((c) => c.classList.contains('on'))).toBe(3));
  });
  test('hesaptan ÖNCE: ofset satırı var, kasnak yok; CAD seçeneği eskiz okununca gelir', () => {
    const s = hazirla(ESKIZ, false);
    const d = matris(s);
    expect([...d.querySelectorAll('thead [data-ve-hesapcap]')].map((b) => b.getAttribute('data-ve-hesapcap'))).toEqual(['katalog', 'db']);
    expect(d.querySelector('tr[data-ve-hc="bekliyor"]')).not.toBeNull();
    expect(d.querySelectorAll('tr[data-ve-hc-kasnak]').length).toBe(0);
    expect([...d.querySelectorAll('tr[data-ve-hc="ofset"] td')].slice(1).map((td) => td.textContent)).toEqual(['1,20 · 1,10', '0,00 · 0,00']);
  });
});

describe('3B PANELİ — kayışın bölümü HEP görünür', () => {
  const panel = (s, secili) => dom(G.veFeadWiz3bPanelHTML(s, secili));
  // Kullanıcı (2026-09-30): "kayış görselinin hep görünmesini istiyorum" —
  // bölüm yalnız kayış seçilince açılıyordu.
  const BOLUM = ['[data-ve-3b-kayis-kesit]', '[data-ve-3b-hesapcap-bolum] [data-ve-hesapcap-matris]',
    '[data-ve-3b-kayis-olcu] [data-ve-kayis-olcu]', 'svg[data-ve="kayis-sekil"]'];
  test('kayış seçili, kasnak seçili ya da seçim yok: şekil + matris + ölçü tablosu her üçünde', () => {
    const s = hazirla(ESKIZ);
    [dugum(/KAYI/), dugum(/KRANK/), -1].forEach((sec) => {
      const d = panel(s, sec);
      BOLUM.forEach((q) => expect([sec, q, d.querySelectorAll(q).length]).toEqual([sec, q, 1]));
    });
    expect(panel(s, dugum(/KAYI/)).querySelector('[data-ve-3b-kesit]')).toBeNull();   // kasnağın kesiti değil
  });
  test('kayışa rol verilmemişken de bölüm çizilir ve bunu söyler', () => {
    const s = hazirla(ESKIZ);
    wiz.veFeadWizStpRol(dugum(/KAYI/), '');
    const d = panel(s, -1);
    BOLUM.forEach((q) => expect([q, !!d.querySelector(q)]).toEqual([q, true]));
    expect(d.querySelector('[data-ve-3b-kayis-tanim]').textContent).toMatch(/Kayışa rol verilmedi/);
  });
  test('birimin İÇİNDEKİ parça da kayışın bölümünü açar (en yakın rollü ata)', () => {
    const s = { sonuc: { agac: [{ ebeveyn: -1 }, { ebeveyn: 0 }, { ebeveyn: 1 }, { ebeveyn: 0 }] },
      roller: [null, 'fead-belt', null, 'fead-crank'] };
    expect([0, 1, 2, 3].map((i) => G._fw3bSeciliKayis(s, i))).toEqual([-1, 1, 1, -1]);
    expect(G._fw3bSeciliKayis(s, -1)).toBe(-1);
  });
  test('şeklin hesap çizgisi ve sayıları seçimle: CAD eskizin 1,50\'si, katalog Gates, d_b d_b çizgisi', () => {
    const s = hazirla(ESKIZ);
    const bel = dugum(/KAYI/);
    let o = sekilOlc(panel(s, bel).querySelector('svg[data-ve="kayis-sekil"]').outerHTML);
    expect([o.hesap, o.olcu('hb'), o.olcu('hr')]).toEqual([['sekil-dw'], 'hb 1,50', 'hr 1,50']);
    wiz.veFeadWizStpHesapCap('katalog');
    o = sekilOlc(panel(s, bel).querySelector('svg[data-ve="kayis-sekil"]').outerHTML);
    expect([o.hesap, o.olcu('hb'), o.olcu('hr')]).toEqual([['sekil-dw'], 'hb 1,20', 'hr 1,10']);
    wiz.veFeadWizStpHesapCap('db');
    o = sekilOlc(panel(s, bel).querySelector('svg[data-ve="kayis-sekil"]').outerHTML);
    expect(o.hesap).toEqual(['sekil-db']);
  });
  test('hesaptan ÖNCE de açılır; profil kayışın ADINDAKİ koddan (tanıyıcının ayrıştırıcısı)', () => {
    const s = hazirla(ESKIZ, false);
    const bel = dugum(/KAYI/);
    let d = panel(s, bel);
    expect(d.querySelector('[data-ve-3b-kayis-tanim]').textContent).toMatch(/^8PK1475 · 8 kanal/);
    expect(d.querySelector('[data-ve-kayis-olcu] thead th.on').textContent).toBe('PK');
    // ad ve parçaları birlikte (iki farklı kod → hiçbiri; tanıyıcının kuralı)
    s.sonuc.agac[bel].ad = 'KAYIŞ - 6PJ1200';
    s.sonuc.agac[bel].parcalar.forEach((pi) => { s.sonuc.parcalar[pi].ad = 'KAYIŞ - 6PJ1200'; });
    d = panel(s, bel);
    expect(wiz._fwStpKord(s).profile).toBe('PJ');
    expect(d.querySelector('[data-ve-kayis-olcu] thead th.on').textContent).toBe('PJ');
    expect(sekilOlc(d.querySelector('svg[data-ve="kayis-sekil"]').outerHTML).olcu('s')).toBe('s 2,34');
  });
  test('hesap bölümündeki kayış satırı bir bağlantı: kayışın birimini seçer', () => {
    const s = hazirla(ESKIZ);
    const b = panel(s, -1).querySelector('[data-ve-3b-kayis] button');
    expect(b.getAttribute('onclick')).toBe('veFeadWiz3bSec(' + s.coz.kayis.dugum + ')');
    expect(s.coz.kayis.dugum).toBe(dugum(/KAYI/));
  });
});

describe('KASNAKTAKİ KESİT — proje tablosuna düşer', () => {
  test('GATES + PJ/PL/PM artık çiziliyor (çekirdek bilmiyor); PH kalınlıksız, çizilmez', () => {
    ['PJ', 'PL', 'PM'].forEach((p) => expect([p, fead.veFeadKesitSVG(p, 'GATES').length > 0]).toEqual([p, true]));
    expect(fead.veFeadKesitSVG('PH', 'GATES')).toBe('');
  });
  test('çekirdeğin bildiği bileşimde değerler çekirdeğin (on bir bileşim) — çıktı değişmez', () => {
    let n = 0;
    B.VE_FEAD_BELT_PROFILES.forEach((p) => B.VE_FEAD_BELT_BRANDS.forEach((b) => {
      let bp = null;
      try { bp = F.beltProps({ profile: p, brand: b }); } catch (e) { bp = null; }
      if (!bp) return;
      const g = B.veFeadBeltGeom(p, b);
      expect([p, b, g.ribAdim, g.kalinlik, g.hb, g.hr]).toEqual([p, b, bp.ribPitch, bp.thickness, bp.hb, bp.hr]);
      n++;
    }));
    expect(n).toBe(11);
  });
});

describe('KILAVUZ — açıklama kılavuzda (pencere açıklama taşımaz, kural 45)', () => {
  test('§3.5 kayışın kesit şeklini, matrisi ve ölçü tablosunu; §8.6 3B yolunu anlatır', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../js/guide-fead.js'), 'utf8');
    expect(src).toMatch(/_gfNot\('Kayışın kesiti ve hesap çapı'/);
    expect(src).toMatch(/sütun bir seçenek, satır bir kasnaktır/);
    expect(src).toMatch(/karakteristik '\s*\+ 'ölçüleri<\/strong>/);
    expect(src).toMatch(/3B görüntüleyicide kayışa tıklayınca kesit şekliyle birlikte \(§3\.5\)/);
  });
});
