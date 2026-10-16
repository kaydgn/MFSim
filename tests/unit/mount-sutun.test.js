/**
 * mount-sutun.test.js — TAKOZ'UN HİÇBİR PENCERESİ MODAL DEĞİL (2026-10-15)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı kararı: "Hepsini sütuna al. Yani eski tipte hiçbir bileşen
 * kalmasın. Hepsi yeni sütun görüntüsünde olsun." Bir gün önce sekiz kütle
 * gövdesi, Takoz ve Çözücü föy diline geçmişti; kalan yedi pencere
 * (Takoz Özellikleri, 2D Görünüm, Örnek, Rapor, 3B, Koordinat, modül kartı)
 * bu turda geçti. Bu dosya o geçişin kapılarıdır:
 *
 *   · LİSTE — Takoz'un hiçbir tipi VE_SUTUNA_SIGMAYAN'da değil; iki
 *     görüntüleyici genişliği (1000 / 1040 px) kalktı.
 *   · DİL — on altı tipin ve modül kartının penceresi aynı kabukta ve hiçbir
 *     satır içi stil renk/zemin/kenar yazmıyor (eski hâlde 484 + 155).
 *   · 2D DAR ÇİZİM — sütun genişliğinde 1:1, yazı ölçek tabanında, çakışma
 *     yok; adlar çizimde NUMARA ve açılımı föyde.
 *   · TEK KAYNAK — eksen örnekleri 3B sahnenin renkleri; 2D'nin G'si
 *     çözücünün birleşik CG'si; kütüphanenin oran denetimi Takoz'unki.
 *   · DURUMLAR — kütüphane (sıfır rijitlik, eksen takası, kullanımdaki
 *     takozun tipten sapması), Rapor (kaynak, bayat çözüm), modül kartı
 *     (kayıtlı listenin imzası), Örnek (kanvastaki modelin denetimi).
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;

const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
global.veMntBrief = require('../../js/mount-brief.js');
const cp = require('../../js/cp-mount.js');
const rep = require('../../js/cp-mount-report.js');
['veMntUygunluk', 'veMntRaporOpts', '_mntRepCaseTr', '_mntRepIsolation', '_mntRepEngine', '_mntRepZeta']
  .forEach((k) => { global[k] = rep[k]; });

const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');
const TULGA = JSON.parse(oku('assets/examples/tulga_topoloji.json'));
function tulga() {
  global.nodes = JSON.parse(JSON.stringify(TULGA.nodes)).map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  return global.nodes;
}
const bul = (f) => global.nodes.find(f);
const cozucu = () => bul((n) => n.type === 'mnt-solver');
function coz() { const R = cp._mntComputeResults(cozucu().id); global._veMntLast = R; return R; }
const dugum = (type, data) => {
  let n = bul((x) => x.type === type);
  if (!n) { n = { id: type + '-t', type, def: componentDefs[type], data: data || {} }; global.nodes.push(n); }
  return n;
};

// Takoz'un palet tipleri (kökteki alt-sistem kartı ve sihirbaz hariç).
const TAKOZ_TIPLERI = Object.keys(componentDefs)
  .filter((t) => /^mnt-/.test(t) && !componentDefs[t].isSubsystem && !/wizard$/.test(t));
function pencere(n) {
  if (n.type === 'mount-analysis') return cp.getMntModulePropertiesHTML(n);
  if (n.type === 'mnt-mount') return cp.getMntMountPropertiesHTML(n);
  if (n.type === 'mnt-solver') return cp.getMntSolverPropertiesHTML(n);
  if (n.type === 'mnt-library') return cp.getMntLibraryPropertiesHTML(n);
  if (n.type === 'mnt-example') return cp.getMntExamplePropertiesHTML(n);
  if (n.type === 'mnt-viewer') return cp.getMntViewerPropertiesHTML(n);
  if (n.type === 'mnt-coordframe') return cp.getMntCoordFramePropertiesHTML(n);
  if (n.type === 'mnt-2dview') return cp.getMnt2DViewPropertiesHTML(n);
  if (n.type === 'mnt-report') return cp.getMntReportPropertiesHTML(n);
  return cp.getMntMassPropertiesHTML(n);
}

beforeEach(() => { resetStubs(stubs); cp._mntForgetResults(); });

describe('LİSTE — Takoz\'un hiçbir penceresi modal değil', () => {
  const coreSrc = oku('js/cp-core.js');
  const liste = (ad) => {
    const m = coreSrc.match(new RegExp('var ' + ad + ' = (\\[[\\s\\S]*?\\]);'));
    return (new Function('return ' + m[1]))();
  };

  test('tarama gerçekten tarıyor: on altı Takoz tipi', () => {
    expect(TAKOZ_TIPLERI.length).toBe(16);
  });

  test('VE_SUTUNA_SIGMAYAN\'da Takoz tipi yok', () => {
    expect(liste('VE_SUTUNA_SIGMAYAN').filter((t) => /^mnt-/.test(t))).toEqual([]);
  });

  // FEAD İLE AYNI PENCERE SINIFI (2026-10-16 — "tek tip kozmetik yapı"): her
  // Takoz tipi kompakt-sol kimliği veren iki listeden birinde, ve FEAD'de
  // karşılığı olan pencere FEAD'inkiyle AYNI listede — dar ekranın modalında
  // Rapor 980 px (Takoz) ↔ 560 px (FEAD) açılıyordu.
  test('her Takoz tipi kimlik satırı ailesinde; FEAD karşılığıyla aynı genişlik sınıfı', () => {
    const genis = liste('VE_WIDE_PANEL_TYPES'), kompakt = liste('VE_COMPACT_PANEL_TYPES');
    expect(TAKOZ_TIPLERI.filter((t) => genis.indexOf(t) < 0 && kompakt.indexOf(t) < 0)).toEqual([]);
    const sinif = (t) => (kompakt.indexOf(t) >= 0 ? 'kompakt' : genis.indexOf(t) >= 0 ? 'geniş' : 'yok');
    [['mount-analysis', 'fead-analysis'], ['mnt-report', 'fead-report'], ['mnt-solver', 'fead-solver']]
      .forEach(([tk, fd]) => expect(`${tk}: ${sinif(tk)}`).toBe(`${tk}: ${sinif(fd)}`));
  });

  test('görüntüleyici genişlikleri (2D 1000 px · kütüphane 1040 px) kalktı', () => {
    const css = oku('css/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(coreSrc).not.toMatch(/ve-properties--(2dview|mntlib)/);
    expect(css).not.toMatch(/ve-properties--(2dview|mntlib)/);
  });
});

describe('DİL — aynı kabuk, satır içi stil renk yazmıyor', () => {
  test('on altı tip + modül kartı: pencere kabuğu var, renk/zemin/kenar yazan satır içi stil yok', () => {
    tulga(); coz();
    const kart = { id: 'kart', type: 'mount-analysis', data: { subTopology: { nodes: JSON.parse(JSON.stringify(TULGA.nodes)), connections: [] } } };
    const bulgu = [];
    TAKOZ_TIPLERI.concat(['mount-analysis']).forEach((t) => {
      const n = t === 'mount-analysis' ? kart : dugum(t);
      const h = pencere(n);
      if (!/data-mnt-pencere="/.test(h)) bulgu.push(t + ': kabuk yok');
      [...h.matchAll(/style="([^"]*)"/g)].map((m) => m[1])
        .filter((st) => /(^|;)\s*(color|background|border)[\w-]*\s*:/.test(st))
        .forEach((st) => bulgu.push(t + ': ' + st));
    });
    expect(bulgu).toEqual([]);
  });

  test('3B eksen jetonları sahnedeki okların renkleri — iki temada da', () => {
    const viewer = oku('js/cp-mount-viewer.js');
    const ok = (v) => '#' + viewer.match(new RegExp('arrow\\(\\[' + v + '\\],\\s*0x([0-9a-f]{6})\\)'))[1];
    // three.js Y-yukarı: model X → [1,0,0], model Y → [0,0,1], model Z → [0,1,0]
    const sahne = { x: ok('1,0,0'), y: ok('0,0,1'), z: ok('0,1,0') };
    const css = oku('css/styles.css');
    ['x', 'y', 'z'].forEach((a) => {
      const tanim = [...css.matchAll(new RegExp('--eksen-' + a + ':\\s*(#[0-9a-fA-F]{6})', 'g'))].map((m) => m[1].toLowerCase());
      expect({ a, tanim }).toEqual({ a, tanim: [sahne[a], sahne[a]] });    // açık + koyu blok
    });
  });
});

describe('2D GÖRÜNÜM — sütunda tek görünüş, gerçek ölçek, numaralı işaret', () => {
  // <text x y text-anchor font-size [font-weight]>içerik</text> → çizicinin kutu tahmini
  function yazilar(svg) {
    const out = [];
    const re = /<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" font-size="([\d.]+)"[^>]*?(font-weight="700")?>([^<]*)<\/text>/g;
    let m;
    while ((m = re.exec(svg))) {
      out.push({ t: m[6], px: Number(m[4]), k: cp._mnt2DYaziKutu(Number(m[1]), Number(m[2]), m[6], m[3], Number(m[4]), !!m[5]) });
    }
    return out;
  }

  test('her görünüş sütunun genişliğinde 1:1, yazı ≥ 10 px, iki yazı üst üste değil', () => {
    tulga();
    const P = cp._mnt2DPencereVeri();
    const kucuk = [], binen = [];
    [338, 354].forEach((W) => ['ust', 'yan', 'on'].forEach((g) => {
      const svg = cp._mnt2DPencereSVG(P, g, W);
      expect(svg).toMatch(new RegExp('viewBox="0 0 ' + W + ' '));
      const y = yazilar(svg);
      expect(y.length).toBeGreaterThan(15);
      y.forEach((a) => { if (a.px < 10) kucuk.push(`${W}/${g}: ${a.t} ${a.px}`); });
      for (let i = 0; i < y.length; i++) for (let j = i + 1; j < y.length; j++)
        if (cp._mnt2DKesisir(y[i].k, y[j].k, 0)) binen.push(`${W}/${g}: "${y[i].t}" ↔ "${y[j].t}"`);
    }));
    expect(kucuk).toEqual([]);
    expect(binen).toEqual([]);
  });

  // Değer çizgisiz kalmaz: dar çizimde sabit sekiz hedef 200 mm'lik adımla
  // "1.000"leri 26 px aralığa diziyordu, sağ uçtakiler eksen adına çarpıp
  // düşüyordu ("1.200" · "1.400" yazılmıyordu, çizgileri duruyordu).
  test('her ızgara çizgisinin DEĞERİ yazılı — dar çizimde adım yazıya göre', () => {
    tulga();
    const P = cp._mnt2DPencereVeri();
    const deger = /^[−-]?[\d.]+$/;
    [338, 354].forEach((W) => ['ust', 'yan', 'on'].forEach((g) => {
      const f = cp._mnt2DPencereSVG(P, g, W);
      const yatay = [...f.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="[-\d.]+" y2="\2" stroke="var\(--border-color\)" stroke-width="0.5"/g)].length;
      const dikey = [...f.matchAll(/<line x1="([-\d.]+)" y1="[-\d.]+" x2="\1" y2="[-\d.]+" stroke="var\(--border-color\)" stroke-width="0.5"/g)].length;
      // değerler soluk yazıyla; işaret numaraları ikincil renkte
      const sol = [...f.matchAll(/<text [^>]*text-anchor="end"[^>]*fill="var\(--text-muted\)"[^>]*>([^<]*)<\/text>/g)].filter((m) => deger.test(m[1])).length;
      const alt = [...f.matchAll(/<text [^>]*text-anchor="middle"[^>]*fill="var\(--text-muted\)"[^>]*>([^<]*)<\/text>/g)].filter((m) => deger.test(m[1])).length;
      expect(dikey).toBeGreaterThan(2);
      expect(`${W}/${g}: ${sol}/${yatay} · ${alt}/${dikey}`).toBe(`${W}/${g}: ${yatay}/${yatay} · ${dikey}/${dikey}`);
    }));
  });

  test('çizimde ad YOK, numara var; her numaranın açılımı föyde (gövde 1…n, takoz T1…Tm, G)', () => {
    tulga();
    const P = cp._mnt2DPencereVeri();
    const svg = cp._mnt2DPencereSVG(P, 'ust', 354);
    const isaretler = yazilar(svg).map((y) => y.t).filter((t) => !/^[−-]?[\d.]+$/.test(t) || /^\d$/.test(t));
    // Eksen adları dışındaki her yazı bir numara: 1…8, T1…T5 ya da G
    const etiket = isaretler.filter((t) => !/\[mm\]$/.test(t));
    expect(etiket.every((t) => /^(\d+|T\d+|G)$/.test(t))).toBe(true);
    expect(etiket).toEqual(expect.arrayContaining(['G', '1', '8', 'T1', 'T5']));
    const html = cp.getMnt2DViewPropertiesHTML({ id: 'd2', type: 'mnt-2dview', data: {} });
    P.M.g.components.forEach((c, i) => expect(html).toContain(`<td>${i + 1}</td><td class="sol" title="${c.name}">`));
    P.M.g.mounts.forEach((m, i) => expect(html).toContain(`<td>T${i + 1}</td><td class="sol" title="${m.name}">`));
  });

  test('çizim ÇÖZÜCÜNÜN modeli: G birleşik CG (combineMassProps), boş konum 0\'da ve föyde "boş"', () => {
    tulga();
    const motor = bul((n) => n.type === 'mnt-motor');
    motor.data.cgy = '';                                    // boş alan: çözücü 0 alır
    const P = cp._mnt2DPencereVeri();
    const mp = cp._mntCanliModel().mp;
    expect(P.veri.cg.x).toBeCloseTo(mp.cg[0] * 1000, 6);
    expect(P.veri.cg.y).toBeCloseTo(mp.cg[1] * 1000, 6);
    // çizilmeseydi G, çizimde olmayan bir gövdeyi sayardı
    const m = P.veri.comps.find((c) => c.id === motor.id);
    expect(m && m.y).toBe(0);
    const html = cp.getMnt2DViewPropertiesHTML({ id: 'd3', type: 'mnt-2dview', data: {} });
    expect(html).toMatch(/<td class="eks">boş<\/td>/);
    expect(html).toContain('1 işaretin konumu eksik — çözücü boş konumu 0 alır');
  });

  test('tekerlek sütunu kaydırır; yakınlaştırma Ctrl + tekerlek', () => {
    tulga();
    const kap = document.createElement('div');
    kap.innerHTML = cp._mnt2DPencereSVG(cp._mnt2DPencereVeri(), 'ust', 354);
    document.body.appendChild(kap);
    cp._mnt2DAttachZoom(kap);
    const svg = kap.querySelector('svg.ve-mnt2d-fig');
    const duz = new window.WheelEvent('wheel', { deltaY: -1, bubbles: true, cancelable: true });
    svg.dispatchEvent(duz);
    expect(duz.defaultPrevented).toBe(false);
    const ctrl = new window.WheelEvent('wheel', { deltaY: -1, ctrlKey: true, bubbles: true, cancelable: true });
    svg.dispatchEvent(ctrl);
    expect(ctrl.defaultPrevented).toBe(true);
    kap.remove();
  });
});

describe('TAKOZ ÖZELLİKLERİ — sekme durumu ve kullanım', () => {
  function kutuphane(e) {
    tulga();
    const lib = dugum('mnt-library');
    lib.data = { mounts: [Object.assign({ key: 'k1', name: 'Deneme' }, e)], _selKey: 'k1' };
    return lib;
  }
  const durum = (h, k) => {
    const m = h.match(new RegExp('data-k="' + k + '" data-d="(\\w+)"[^>]*>[\\s\\S]*?<span class="ve-fp-tab-d"[^>]*><i[^>]*></i>([^<]*)</span>'));
    return m ? m[1] + ' ' + m[2] : null;
  };

  test('sıfır/boş rijitlik → "rijitlik eksik" (çözücü bu tipi taşıyan takozu reddeder)', () => {
    const h = cp.getMntLibraryPropertiesHTML(kutuphane({ sx: 0, sy: 0, sz: 290, dx: 0, dy: 0, dz: 0 }));
    expect(durum(h, 'rij')).toBe('eksik rijitlik eksik');
    expect(h).toContain('5 rijitlik değeri boş ya da ≤ 0');
  });

  test('dinamik X ile Z takaslı (TK040: 335/355/740 · statik 545/550/245) → "oran?"', () => {
    const h = cp.getMntLibraryPropertiesHTML(kutuphane({ sx: 545, sy: 550, sz: 245, dx: 335, dy: 355, dz: 740 }));
    expect(durum(h, 'rij')).toBe('eksik oran?');
  });

  test('tutarlı girdi → "tamam"; oran Takoz penceresinin AYNI denetiminden', () => {
    const h = cp.getMntLibraryPropertiesHTML(kutuphane({ sx: 665, sy: 335, sz: 290, dx: 1165, dy: 590, dz: 490 }));
    expect(durum(h, 'rij')).toBe('ok tamam');
    expect(h).toMatch(/id="ve-mnt-lib-orz-[^"]+" data-tazele>1,69</);    // 490 / 290
  });

  test('kullanım: tipi taşıyan takoz tipten saparsa söylenir (takoz uygulandığı anı KOPYALAR)', () => {
    const lib = kutuphane({ sx: 665, sy: 335, sz: 290, dx: 1165, dy: 590, dz: 490 });
    const tk = bul((n) => n.customName === 'Ön Takoz');
    Object.assign(tk.data, { libKey: 'k1', kxs: 665, kys: 335, kzs: 290, kxd: 1165, kyd: 590, kzd: 490 });
    expect(cp.getMntLibraryPropertiesHTML(lib)).toMatch(/Ön Takoz<\/td><td class="sol">tiple aynı/);
    tk.data.kzs = 300;
    const h = cp.getMntLibraryPropertiesHTML(lib);
    expect(h).toMatch(/Ön Takoz<\/td><td class="sol kr" title="kz stat\.">1 değer farklı/);
    expect(h).toContain('tip sonradan değişirse takoz eskisinde kalır');
  });

  test('eksen seçimi görünüm durumu: grafik o ekseni çizer, model değişmez', () => {
    const lib = kutuphane({ sx: 665, sy: 335, sz: 290, dx: 1165, dy: 590, dz: 490 });
    const once = JSON.stringify(lib.data);
    cp.veMntLibEksen(lib.id, 'x');
    const h = cp.getMntLibraryPropertiesHTML(lib);
    expect(h).toContain('F<sub>x</sub>');
    expect(h).toMatch(/aria-pressed="true" onclick="veMntLibEksen\('[^']+','x'\)"/);
    expect(JSON.stringify(lib.data)).toBe(once);
    cp.veMntLibEksen(lib.id, 'z');
  });
});

describe('RAPOR — kaynak, bayat çözüm, eylem', () => {
  test('değer Motor\'dan gelir; Motor\'da yoksa eski projenin Rapor düğümündeki yedek "Rapor (eski)"', () => {
    tulga(); coz();
    const r = dugum('mnt-report');
    r.data = { cylinders: 6 };                                   // TULGA motoru silindir taşımıyor
    const h = cp.getMntReportPropertiesHTML(r);
    expect(h).toMatch(/Rölanti devri<\/td><td>800 d\/dk<\/td><td class="sol">Motor<\/td>/);
    expect(h).toMatch(/Silindir sayısı<\/td><td>6<\/td><td class="sol">Rapor \(eski\)<\/td>/);
    expect(h).toContain('40 Hz');                               // (800/60)·(6/2)
  });

  test('model hesaptan sonra değişince "bayat" der; rapor yine üretilebilir (eski çözümden)', () => {
    tulga(); coz();
    const r = dugum('mnt-report');
    expect(cp.getMntReportPropertiesHTML(r)).toContain('<b>Model çözüldü</b>');
    bul((n) => n.customName === 'Ön Takoz').data.kzs = '300';
    const h = cp.getMntReportPropertiesHTML(r);
    expect(h).toContain('Model çözüldü, ama bayat');
    expect(h).toContain(`veMntGenerateReport('${r.id}')`);
    expect(h).toContain('Çözüm bayat — önce Çözücü penceresinde');
  });

  test('çözüm yokken eylem kapalı ve sebebi yazılı', () => {
    tulga();
    const h = cp.getMntReportPropertiesHTML(dugum('mnt-report'));
    expect(h).toMatch(/<button type="button" class="ve-fp-solve" disabled>/);
    expect(h).toContain('Çözüm yok — Çözücü → Hesapla.');
  });
});

describe('MODÜL KARTI — kayıtlı listenin modeli ve son çözümü', () => {
  function kart() {
    return { id: 'kart', type: 'mount-analysis', data: { subTopology: { nodes: JSON.parse(JSON.stringify(TULGA.nodes)), connections: [{}, {}] } } };
  }

  test('içerik ve CG kayıtlı listeden — canlı tuvalde başka model varken bile', () => {
    tulga(); coz();
    const k = kart();
    // kökteyiz: alt topoloji canlı değil, tuvalde kartla birlikte başka bir gövde var
    global.nodes = [k, { id: 'baska', type: 'mnt-motor', def: componentDefs['mnt-motor'], data: { mass: 100, cgx: 0, cgy: 0, cgz: 0 } }];
    const h = cp.getMntModulePropertiesHTML(k);
    // FEAD'in modül kartının grameri: salt okunur ızgara; son çözümün hükmü
    // sağ sütunun Uygunluk bölümünde (FEAD'in modül kartı gibi).
    const alan = (ad) => (h.match(new RegExp(ad + '(?: <u>[^<]*</u>)?</span><input class="ve-fp-inp" value="([^"]*)" readonly')) || [])[1];
    expect(alan('Kütle gövdesi')).toBe('8');
    expect(alan('Takoz')).toBe('5');
    expect(alan('Bağlantı')).toBe('2');
    expect(alan('Toplam kütle')).toBe('788,4');
    expect(h).toMatch(/<div class="ve-fp-side"><section class="ve-fp-card" id="ve-mnt-uyg-kart" data-tazele><div class="ve-fp-sect"><b>Uygunluk<\/b><em>son çözüm · 14 yük durumu<\/em>/);
  });

  test('kayıtlı model hesaptan sonra değiştiyse "bayat"; son çözüm başka kartınsa "yok"', () => {
    tulga(); const R = coz();
    const k = kart();
    global.nodes = [k];
    k.data.subTopology.nodes.find((n) => n.type === 'mnt-motor').data.mass = 500;
    const bayat = cp.getMntModulePropertiesHTML(k);
    expect(bayat).toMatch(/<b>Uygunluk<\/b><em>son çözüm · \d+ yük durumu · bayat<\/em>/);
    expect(bayat).toContain('<b>Bayat.</b> Model hesaptan sonra değişti');
    const baska = kart();
    baska.data.subTopology.nodes = baska.data.subTopology.nodes.filter((n) => n.id !== R.solverId);
    expect(cp.getMntModulePropertiesHTML(baska)).toMatch(/<i><\/i>Son çözüm yok<span>/);
  });
});

describe('ÖRNEK — kanvastaki modelin denetimi', () => {
  test('boş kanvas bir hata değil: "henüz model yok"', () => {
    global.nodes = [];
    const h = cp.getMntExamplePropertiesHTML({ id: 'e1', type: 'mnt-example', data: {} });
    expect(h).toContain('Kanvasta henüz model yok.');
  });

  test('uyarılar ve hatalar ayrı satırlarda, hata çözücünün reddi', () => {
    tulga();
    bul((n) => n.type === 'mnt-motor').data.mass = '';
    const h = cp.getMntExamplePropertiesHTML(dugum('mnt-example'));
    expect(h).toMatch(/<b>1 hata<\/b> — çözücü modeli reddeder\.<ul><li>Motor: kütle tanımsız\/sıfır\.<\/li><\/ul>/);
    expect(h).toMatch(/<b>\d+ uyarı<\/b>/);
  });
});
