/**
 * fead-sihirbaz-masa.test.js — SİHİRBAZIN ÇİZİM MASASI (js/cp-fead-wizard.js)
 *
 * Kullanıcı kararı (2026-09-29, tasarım tuvali "Adım içerikleri" · F): *"Bu
 * tasarımı beğenmedim, başka tasarıma geçeceğiz. Yeni tasarımımız 'F çizim
 * masası' olacak."* Föy (E) aynı gün geri alındı. Her adım: solda MASA
 * (milimetrik zemin üstünde adımın konusu, sol üstte sonuç çipi, sol altta
 * lejant), sağda DENETİM SÜTUNU. Kasnaklar masada seçilir, sürüklenir ve ok
 * tuşuyla oynatılır.
 *
 * Kapılar — her biri sessiz bir sınıfa karşı: çizim TEK kaynaktan
 * (veFeadLayoutSVG; masa katmanı çizicinin dönüşümünü okur, kendi geometrisini
 * kurmaz) · göbek numarası = liste numarası · koparan konum YAZILMAZ · ızgara
 * mm eksenine hizalı · gergi konumları ve göbek yükü çekirdekten · grafiklerin
 * sayıları uygunluk kapısının kaynaklarından · sınırdaki merkez mesafesi =
 * kapının satırları · çip = rayın durumu · iç pencerelerde Esc tek katman.
 * Gerçek tarayıcı (sürükleme, odak, kaydırma, taşma): tests/e2e/fead-wizard*.
 */
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const fs = require('fs');
const path = require('path');

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
[require('../../js/fead-duty.js'), require('../../js/fead-belts.js'), require('../../js/fead-tensioners.js'),
 require('../../js/fead-accessories.js'), require('../../js/fead-engines.js'), require('../../js/fead-checks.js')]
  .forEach((mod) => Object.keys(mod).forEach((k) => { global[k] = mod[k]; }));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });

const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
const WIZ_SRC = fs.readFileSync(path.join(__dirname, '../../js/cp-fead-wizard.js'), 'utf8');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
});
const kabuk = () => {
  document.body.innerHTML = '<div id="ve-canvas"></div>'
    + '<div id="ve-feadwiz-overlay" style="display:flex;">'
    + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div>'
    + '<div id="ve-fw-ang" style="display:none;"></div>'
    + '<div id="ve-fw-eng" style="display:none;"></div>'
    + '<div id="ve-fw-cevrim" style="display:none;"></div></div>';
};
const ornek = () => { kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025'); return wiz.veFeadWizState(); };
const adimDOM = (i) => {
  const d = document.createElement('div');
  d.innerHTML = wiz.veFeadWizStepHTML(i, wiz.veFeadWizBuild());
  return d;
};
const ADIM = wiz.VE_FW_STEPS.length;
const KAT = () => wiz._fwMasaDurum().kat;
// Basılan liste sırası (Gates tablo sırası: sürücü ilk, gergi son).
const sira = (st) => M.veFeadRouteFlip(wiz.veFeadWizRoute(st));
// Kural gövdesi (seçici tam eşleşme).
const kural = (sec) => {
  const m = CSS.match(new RegExp(sec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : '';
};

// ═══════════════════════════════════════════════════════════ MASA DÜZENİ ══
describe('MASA DÜZENİ — her adım masa + denetim sütunu', () => {
  test('masa adımın anahtarını taşır; grafik adımı işaretli; sütun her adımda', () => {
    ornek();
    for (let i = 0; i < ADIM; i++) {
      const d = adimDOM(i);
      const key = wiz.VE_FW_STEPS[i].key;
      expect(d.querySelector('.ve-fw-masa-duzen').getAttribute('data-adim')).toBe(key);
      expect(d.querySelector('#ve-fw-masa').getAttribute('data-adim')).toBe(key);
      expect(d.querySelector('#ve-fw-yan')).not.toBeNull();
      expect(d.querySelector('#ve-fw-masa').getAttribute('data-tur')).toBe(key === 'cevrim' ? 'grafik' : null);
    }
  });

  test('CSS: gövde KAYMAZ, sütun kayar, özet paneli yüzer, dar gövdede alt alta', () => {
    expect(kural('.ve-fw-body')).toMatch(/overflow:hidden/);
    expect(kural('.ve-fw-yan')).toMatch(/overflow-y:auto/);
    expect(kural('.ve-fw-masa-duzen')).toMatch(/grid-template-columns:minmax\(0,1fr\) 316px/);
    expect(CSS).toMatch(/\.ve-fw-masa-duzen\[data-adim="ozet"\] > \.ve-fw-yan\{[^}]*position:absolute/);
    expect(CSS).toMatch(/@container vefw \(max-width: 760px\)\{[\s\S]{0,400}grid-template-columns:minmax\(0,1fr\); grid-template-rows/);
  });

  // Özet paneli masanın sağında 288 px; JS'teki pay ile CSS'teki genişlik
  // ayrışırsa çizim panelin ALTINA girer — sessizce.
  test('özet panelinin eni JS ile CSS\'te birebir', () => {
    expect(CSS).toMatch(new RegExp('\\[data-adim="ozet"\\] > \\.ve-fw-yan\\{[^}]*width:'
      + wiz.VE_FW_OZET_PANEL + 'px'));
  });

  test('RENK ŞERİDİ YOK: blok satır içi renk taşımıyor, CSS\'te --fw-accent yok', () => {
    ornek();
    for (let i = 0; i < ADIM; i++)
      adimDOM(i).querySelectorAll('.ve-fw-card').forEach((c) => expect(c.getAttribute('style')).toBeNull());
    expect(CSS).not.toMatch(/--fw-accent/);
  });
});

// ═══════════════════════════════════════════════════════════ SONUÇ ÇİPİ ══
describe('SONUÇ ÇİPİ — masanın sol üstünde, damga rayla aynı', () => {
  // RENK DE RAYIN (2026-09-29): kayış yolu çözülüp bir adımda eksik kalabiliyor
  // (işletme girdisi, kural 46). Damga o adımda yeşil basarsa rayla çelişir.
  test('damga: rayın DURUMU ve adımın eksik/uyarı sayısı (veFeadWizStepState)', () => {
    ornek();
    const b = wiz.veFeadWizBuild();
    expect(b.ok).toBe(true);
    const durumlar = [];
    for (let i = 0; i < ADIM; i++) {
      wiz.veFeadWizGoto(i);
      const d = document.createElement('div');
      d.innerHTML = wiz.veFeadWizLiveHTML(b);
      const s = wiz.veFeadWizStepState(b, i);
      const damga = d.querySelector('.ve-fw-damga');
      expect(damga.dataset.model).toBe('ok');
      expect(damga.dataset.durum).toBe(s.durum);
      expect(damga.classList.contains('ve-fw-pill-' + s.durum)).toBe(true);
      expect(damga.textContent).toContain(s.err ? s.err + ' eksik' : s.warn ? s.warn + ' uyarı' : 'Çözülüyor');
      durumlar.push(s.durum);
    }
    // Kapı boşa koşmasın: örnekte hem temiz hem eksikli adım var.
    expect(durumlar).toContain('ok');
    expect(durumlar).toContain('err');
  });

  test('çip masanın İÇİNDE (canlı yamanın kabı) ve kol yönünü GÖSTERİLEN açıyla yazar', () => {
    ornek();
    const b = wiz.veFeadWizBuild();
    const d = adimDOM(1);
    expect(d.querySelector('#ve-fw-masa #ve-fw-live .ve-fw-live')).not.toBeNull();
    // "kol" tek başına üç ayrı büyüklüğün adıydı; çip adını söyler.
    expect(d.querySelector('#ve-fw-live').textContent)
      .toContain('kol yönü ' + veSayi(M.veFeadArmShownDeg(b.armAbsDeg), 2) + '°');
  });

  test('damganın üç rengi rayın jetonlarından', () => {
    const renk = (sinif) => [...CSS.matchAll(new RegExp('\\.' + sinif + '\\{([^}]*)\\}', 'g'))]
      .map((m) => m[1]).join(' ');
    expect(renk('ve-fw-pill-ok')).toMatch(/--(ink|accent)-success/);
    expect(renk('ve-fw-pill-warn')).toMatch(/--(ink|accent)-warning/);
    expect(renk('ve-fw-pill-err')).toMatch(/--(ink|accent)-danger/);
  });

  test('çözülemeyen modelde damga eksik SAYISINI yazar, sebep yanında', () => {
    kabuk(); wiz.veFeadWizReset();
    const b = wiz.veFeadWizBuild();
    const d = document.createElement('div');
    d.innerHTML = wiz.veFeadWizLiveHTML(b);
    expect(d.querySelector('.ve-fw-pill-err').textContent).toContain(b.errors.length + ' eksik');
    expect(d.querySelector('.ve-fw-damga').dataset.model).toBe('no');
    expect(d.querySelector('.ve-fw-pill-dim').textContent).toBe(b.errors[0]);
  });
});

// ═══════════════════════════════════════════════════ KASNAKLAR MASASI ══
describe('KASNAKLAR MASASI — çiziciden, eksenli; tıkla seç, sürükle kaydır', () => {
  test('göbek numaraları listenin numaralarıyla BİREBİR', () => {
    const st = ornek();
    const d = adimDOM(1);
    const no = [...d.querySelectorAll('#ve-fw-masa [data-ve="sira-no"] text')].map((t) => t.textContent);
    const liste = [...d.querySelectorAll('#ve-fw-kl-liste .ve-fw-kl-no')].map((e) => e.textContent);
    expect(no.length).toBe(sira(st).length);
    expect(no).toEqual(liste);
  });

  test('isabet halkası HER satıra, anahtarı listenin anahtarı (gergi dâhil)', () => {
    const st = ornek();
    const d = adimDOM(1);
    const hit = [...d.querySelectorAll('#ve-fw-masa .ve-fw-hit')].map((c) => c.getAttribute('data-fw-k'));
    expect(hit.slice().sort()).toEqual(sira(st).slice().sort());
    expect(hit).toContain('__ten__');
  });

  test('çözüm yokken masa SAYI UYDURMAZ, söyler', () => {
    kabuk(); wiz.veFeadWizReset();
    const m = adimDOM(1).querySelector('#ve-fw-masa-cizim');
    expect(m.querySelector('svg')).toBeNull();
    expect(m.querySelector('.ve-fw-masa-bos')).not.toBeNull();
  });

  test('CANLI YAMA masayı tazeler — yazılan koordinat çizimde görünür', () => {
    ornek();
    wiz.veFeadWizGoto(1);
    const once = document.getElementById('ve-fw-masa-cizim').innerHTML;
    const alt = wiz.veFeadWizState().pulleys.find((p) => p.type === 'fead-alternator');
    wiz.veFeadWizPulleySet(alt.key, 'x', -300);
    wiz.veFeadWizLive();
    const sonra = document.getElementById('ve-fw-masa-cizim').innerHTML;
    expect(sonra).not.toBe(once);
    expect(sonra).toContain('data-ve="sira-no"');
  });

  test('çizici tek kaynak: veFeadLayoutSVG — masa kendi geometrisini kurmaz', () => {
    // Görünüm katmanı (`_fwLayout`) çiziciyi çağırır, geometri kurmaz.
    const k0 = WIZ_SRC.slice(WIZ_SRC.indexOf('function _fwLayout('));
    const katman = k0.slice(0, k0.indexOf('\n}\n'));
    expect(katman).toContain('veFeadLayoutSVG(');
    expect(katman).not.toMatch(/FEADCore\.(geometryAt|solve)/);
    ['_fwKasnakMasa', '_fwGergiMasa', '_fwKayisMasa', '_fwOzetMasa', '_fwKaynakMasa'].forEach((ad) => {
      const g = WIZ_SRC.slice(WIZ_SRC.indexOf('function ' + ad + '('));
      const govde = g.slice(0, g.indexOf('\n}\n'));
      expect(govde).toContain('_fwLayout(');
      // Geometri çekirdeğe SORULMAZ — çizicinin dönüşümü (T) okunur.
      expect(govde).not.toMatch(/FEADCore\.(geometryAt|solve)/);
    });
  });

  test('seçim: liste satırı, çizimdeki hale ve X/Y okuması AYNI kasnak', () => {
    const st = ornek();
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    wiz.veFeadWizSec(alt.key);
    const d = adimDOM(1);
    expect(d.querySelector('#ve-fw-kl-liste .ve-fw-kl.on').getAttribute('data-fw-k')).toBe(alt.key);
    expect(d.querySelector('#ve-fw-masa [data-ve="secim-x"]').textContent).toBe('X ' + veSayi(Number(alt.x), 1));
    expect(d.querySelector('#ve-fw-masa [data-ve="secim-y"]').textContent).toBe('Y ' + veSayi(Number(alt.y), 1));
    expect(d.querySelector('#ve-fw-ed').getAttribute('data-fw-k')).toBe(alt.key);
  });

  // MASA BİR GÖRÜNTÜLEYİCİ (kullanıcı isteği 2026-09-29): *"Yakınlaştırma-
  // uzaklaştırma sağa sola pan yapma gibi özellikler gelsin … Tutup hareket
  // etmeyi de kaldıralım."* Sürüklemek görünümü kaydırır — kasnağın ÜSTÜNDEN
  // başlasa da; koordinat yalnız editörde değişir.
  const olay = (x, y, hedef) => ({ button: 0, clientX: x, clientY: y, target: hedef, preventDefault() {} });
  test('SÜRÜKLEMEK KAYDIRIR, kasnak TAŞINMAZ — kasnağın üstünden başlasa da', () => {
    const st = ornek();
    wiz.veFeadWizGoto(1);
    const once = st.pulleys.map((p) => [p.x, p.y]);
    const ten0 = [st.ten.cenX, st.ten.cenY];
    const hit = document.querySelector('#ve-fw-masa .ve-fw-hit');
    wiz.veFeadWizMasaBas(olay(100, 100, hit));
    wiz.veFeadWizMasaKaydir(olay(160, 130));
    wiz.veFeadWizMasaBirak();
    expect(st.pulleys.map((p) => [p.x, p.y])).toEqual(once);
    expect([st.ten.cenX, st.ten.cenY]).toEqual(ten0);
    const g = wiz._fwMasaDurum().gor, k = KAT();
    expect(g.z).toBe(1);
    expect(g.tx).toBeCloseTo(60 / k, 9);            // ekran px / ölçek = çizim birimi
    expect(g.ty).toBeCloseTo(30 / k, 9);
    expect(WIZ_SRC).not.toMatch(/function _fwKasnakTasi\b/);   // taşıma yolu YOK
  });

  test('oynamadan bırakılan basış bir TIK: altındaki kasnağı seçer, görünüm oynamaz', () => {
    const st = ornek();
    wiz.veFeadWizGoto(1);
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    const hit = document.querySelector('#ve-fw-masa .ve-fw-hit[data-fw-k="' + alt.key + '"]');
    wiz.veFeadWizMasaBas(olay(200, 200, hit));
    wiz.veFeadWizMasaKaydir(olay(202, 201));        // eşiğin altında: el titremesi
    wiz.veFeadWizMasaBirak();
    expect(wiz._fwMasaDurum().sec).toBe(alt.key);
    expect(wiz._fwMasaDurum().gor).toEqual({ z: 1, tx: 0, ty: 0 });
    expect(document.querySelector('#ve-fw-ed').getAttribute('data-fw-k')).toBe(alt.key);
  });

  test('ok tuşu masayı KAYDIRIR (kasnağı oynatmaz); yalnız masa odaktayken', () => {
    const st = ornek();
    wiz.veFeadWizGoto(1);
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    wiz.veFeadWizSec(alt.key);
    const x0 = alt.x, y0 = alt.y;
    expect(wiz._fwMasaTus({ key: 'ArrowRight', preventDefault() {} })).toBe(false);  // odak alanda
    document.getElementById('ve-fw-masa').focus();
    expect(wiz._fwMasaTus({ key: 'ArrowRight', preventDefault() {} })).toBe(true);
    expect(wiz._fwMasaDurum().gor.tx).toBeCloseTo(-40 / KAT(), 9);
    expect([alt.x, alt.y]).toEqual([x0, y0]);
    document.getElementById('ve-fw-masa').focus();
    expect(wiz._fwMasaTus({ key: '+', preventDefault() {} })).toBe(true);
    expect(wiz._fwMasaDurum().gor.z).toBeCloseTo(1.4, 9);
    // Alt+ok sihirbazın adım gezinmesi — masa almaz.
    expect(wiz._fwMasaTus({ key: 'ArrowLeft', altKey: true, preventDefault() {} })).toBe(false);
  });

  test('yakınlık: ×1,4 adım, aralık 0,5–12, "Sığdır" 1 — ölçek gerçekten büyür', () => {
    ornek();
    wiz.veFeadWizGoto(1);
    const s0 = wiz._fwMasaDurum().xf.s;
    wiz.veFeadWizZoom(1);
    expect(wiz._fwMasaDurum().gor.z).toBeCloseTo(1.4, 9);
    expect(wiz._fwMasaDurum().xf.s / s0).toBeCloseTo(1.4, 6);
    for (let i = 0; i < 12; i++) wiz.veFeadWizZoom(1);
    expect(wiz._fwMasaDurum().gor.z).toBe(wiz.VE_FW_GOR_Z[1]);
    for (let i = 0; i < 20; i++) wiz.veFeadWizZoom(-1);
    expect(wiz._fwMasaDurum().gor.z).toBe(wiz.VE_FW_GOR_Z[0]);
    wiz.veFeadWizZoom(0);
    expect(wiz._fwMasaDurum().gor).toEqual({ z: 1, tx: 0, ty: 0 });
    expect(wiz._fwMasaDurum().xf.s).toBeCloseTo(s0, 9);
  });

  // Tekerlek imlecin ALTINDAKİ mm noktasını yerinde tutar (harita gibi):
  // yakınlaşmadan önce ve sonra aynı ekran noktası aynı mm'yi göstermeli.
  test('tekerlek İMLECİN ALTINDAKİ noktaya yakınlaşır', () => {
    ornek();
    wiz.veFeadWizGoto(1);
    const cz = document.getElementById('ve-fw-masa-cizim');
    cz.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 700, right: 800, bottom: 700 });
    const px = 300, py = 220, k = KAT();
    const mm = () => { const x = wiz._fwMasaDurum().xf; return [x.mx + (px / k - x.ox) / x.s, x.my - (py / k - x.oy) / x.s]; };
    const a = mm();
    wiz.veFeadWizMasaTeker({ deltaY: -300, deltaMode: 0, clientX: px, clientY: py, preventDefault() {} });
    expect(wiz._fwMasaDurum().gor.z).toBeGreaterThan(1.4);
    const b = mm();
    expect(b[0]).toBeCloseTo(a[0], 6);
    expect(b[1]).toBeCloseTo(a[1], 6);
  });

  // GÖRÜNÜM TEK KATMANDAN: beş çizim adımının hepsinde aynı ölçek çarpanı —
  // biri katmanı atlasaydı o adımda düğme bir şey yapmaz, sessizce.
  test('GÖRÜNÜM bütün çizim adımlarında — ölçek ×2, ızgara mm\'ye hizalı', () => {
    [[0, null], [1, null], [2, 'yakin'], [2, 'yol'], [3, null], [5, null]].forEach(([adim, gg]) => {
      ornek();
      wiz.veFeadWizGoto(adim);
      wiz._fwMasaDurum({ gergi: gg || 'yakin' });
      wiz._fwMasaDurum({ gor: { z: 1, tx: 0, ty: 0 } });
      wiz._fwMasaCizim(adim, wiz.veFeadWizBuild(), 800, 700);
      const s0 = wiz._fwMasaDurum().xf.s;
      wiz._fwMasaDurum({ gor: { z: 2, tx: 12, ty: -7 } });
      wiz._fwMasaCizim(adim, wiz.veFeadWizBuild(), 800, 700);
      const d = wiz._fwMasaDurum();
      expect([adim, gg, d.xf.s / s0]).toEqual([adim, gg, expect.any(Number)]);
      expect(d.xf.s / s0).toBeCloseTo(2, 6);
      expect(d.izgara).not.toBeNull();                // eksensiz adımda da ızgara çizimle kayar
      wiz._fwMasaDurum({ gor: { z: 1, tx: 0, ty: 0 } });
    });
    wiz._fwMasaDurum({ gergi: 'yakin' });
    ['_fwKasnakMasa', '_fwGergiMasa', '_fwKayisMasa', '_fwOzetMasa', '_fwKaynakMasa'].forEach((ad) => {
      const g = WIZ_SRC.slice(WIZ_SRC.indexOf('function ' + ad + '('));
      const govde = g.slice(0, g.indexOf('\n}\n'));
      expect([ad, /veFeadLayoutSVG\(/.test(govde)]).toEqual([ad, false]);   // çizici YALNIZ katmandan
      expect(govde).toContain('_fwLayout(');
    });
  });

  // IZGARA EKSENLE HİZALI: zemin çizgisi çentiklerin ARASINDAN geçseydi mm
  // okuması yanıltırdı. Izgara ekran px'inde, çizim masaya k kat büyüyor.
  test('zemin ızgarası mm eksenine hizalı — her çentik bir ızgara çizgisinde', () => {
    ornek();
    const h = wiz._fwMasaHTML(1, wiz.veFeadWizBuild());
    const d = document.createElement('div'); d.innerHTML = h;
    const stil = d.querySelector('#ve-fw-masa').getAttribute('style');
    const v = (a) => Number((stil.match(new RegExp('--izg-' + a + ':([\\d.]+)px')) || [])[1]);
    const k = Number((stil.match(/--masa-k:([\d.]+)/) || [])[1]);
    expect(k).toBe(KAT());
    expect(v('b')).toBeGreaterThan(20);
    // İki eksen de: X çentikleri dikey, Y çentikleri yatay KISA çizgiler
    // (eksenlerin kendisi uzun). Tolerans PİKSEL: AG00976'da X ofseti adımın
    // %98,9'u — adım oranıyla ölçülen gevşek bir tolerans ofseti hiç yazmayan
    // bir ızgarayı da geçiriyordu (mutasyonla ölçüldü).
    const cizgi = [...d.querySelectorAll('[data-ve="eksen"] line')].map((l) =>
      ['x1', 'y1', 'x2', 'y2'].map((a) => Number(l.getAttribute(a))));
    const kisa = (c) => Math.hypot(c[2] - c[0], c[3] - c[1]) <= 8;
    const centX = cizgi.filter((c) => kisa(c) && c[0] === c[2]).map((c) => c[0]);
    const centY = cizgi.filter((c) => kisa(c) && c[1] === c[3]).map((c) => c[1]);
    expect(centX.length).toBeGreaterThan(2);
    expect(centY.length).toBeGreaterThan(2);
    const hizali = (p, ofs) => {
      const n = Math.round((p * k - ofs) / v('b'));
      return Math.abs(p * k - ofs - n * v('b'));
    };
    centX.forEach((x) => expect(hizali(x, v('x'))).toBeLessThan(0.15));
    centY.forEach((y) => expect(hizali(y, v('y'))).toBeLessThan(0.15));
  });
});

// ═══════════════════════════════════════════════════════ GERGİ MASASI ══
describe('GERGİ MASASI — konumlar ve göbek yükü çekirdekten', () => {
  test('Mean açısı, gerginlik ve göbek yükü çekirdeğin sayısı', () => {
    ornek();
    const b = wiz.veFeadWizBuild();
    const v = wiz._fwGergiVeri(b);
    const rows = M.veFeadPositionRows(b).filter((r) => r.ok && r.cen);
    rows.forEach((r) => expect(v.by[r.key].relDeg).toBe(r.relDeg));
    const ts = F.tensionerState(b.sys, F.meanRel(b.sys));
    const h = wiz._fwMasaCizim(2, b, 640, 600);
    expect(h).toContain('Mean ' + veSayi(v.by.mean.relDeg, 2) + '°');
    expect(h).toContain('göbek ' + veSayi(ts.hubloadN, 1) + ' N');
    // Gövde noktası: panelin okumasıyla AYNI üretici.
    const t = wiz.veFeadWizState().ten;
    const p = M.veFeadTensionerPivot({ cenX: Number(t.cenX), cenY: Number(t.cenY),
      armLen: Number(t.armLen), armMeanDeg: Number(t.armMeanDeg) });
    expect(h).toContain('gövde p (' + veSayi(v.pv[0], 2) + '; ' + veSayi(v.pv[1], 2) + ')');
    expect(v.pv[0]).toBeCloseTo(p[0], 6);
    expect(v.pv[1]).toBeCloseTo(p[1], 6);
  });

  test('lejantın çalışma bandı konum tablosunun Maks/Min açısı', () => {
    ornek();
    const b = wiz.veFeadWizBuild();
    wiz._fwMasaDurum({ gergi: 'yakin' });
    const v = wiz._fwGergiVeri(b);
    const lj = wiz._fwMasaLejantHTML('gergi', b);
    expect(lj).toContain('Maks ' + veSayi(v.by.max.relDeg, 1) + '° → Min ' + veSayi(v.by.min.relDeg, 1) + '°');
    expect(lj).toContain(veSayi(F.tensionerState(b.sys, F.meanRel(b.sys)).hubDirDeg, 1) + '°');
  });

  test('"Tüm yol" görünümü yakın katmanı çizmez; düğme basılı durumu söyler', () => {
    ornek();
    const b = wiz.veFeadWizBuild();
    wiz._fwMasaDurum({ gergi: 'yol' });
    expect(wiz._fwMasaCizim(2, b, 640, 600)).not.toContain('data-ve="gergi-yakin"');
    const d = document.createElement('div'); d.innerHTML = wiz._fwMasaHTML(2, b);
    expect(d.querySelector('.ve-fw-masa-btn[aria-pressed="true"]').textContent).toBe('Tüm yol');
    wiz._fwMasaDurum({ gergi: 'yakin' });
    expect(wiz._fwMasaCizim(2, b, 640, 600)).toContain('data-ve="gergi-yakin"');
  });

  test('yay doğrusu künyenin alanlarından: ön yük + katsayı × dönme', () => {
    ornek();
    const t = wiz.veFeadWizState().ten;
    const h = wiz._fwYayGrafikHTML(t, wiz.veFeadWizBuild());
    expect(h).toContain('ön yük ' + veSayi(Number(t.preload), 2));
    expect(h).toContain(veSayi(Number(t.kArm), 3) + ' Nm/°');
    // Katsayı yoksa doğru ÇİZİLMEZ (uydurulan doğru yok).
    expect(wiz._fwYayGrafikHTML(Object.assign({}, t, { kArm: '' }), null)).toBe('');
  });

  // Sabit ofsetli eski yerleşimde AG00976'da üç etiketin üçünü de doğru
  // kesiyordu (gerçek tarayıcıda 14 künyenin hepsinde). Kutu karakterden
  // tahmin (10 px: 6 px/karakter, kalın 6,4); gerçek yazı kutusuyla aynı
  // kapı tests/e2e/fead-wizard-tur3.spec.js → "YAY DOĞRUSU".
  test('yay doğrusunun etiketleri doğruyu KESMEZ ve üst üste BİNMEZ — 14 künye', () => {
    ornek();
    const keys = VE_FEAD_TENSIONER_DB.map((r) => r.key);
    expect(keys.length).toBe(14);
    keys.forEach((key) => {
      wiz.veFeadWizTenLib(key);
      const d = document.createElement('div');
      d.innerHTML = wiz._fwYayGrafikHTML(wiz.veFeadWizState().ten, wiz.veFeadWizBuild());
      const ln = d.querySelector('.ve-fw-yay-dogru');
      expect(ln).not.toBeNull();
      const [lx1, ly1, lx2, ly2] = ['x1', 'y1', 'x2', 'y2'].map((a) => Number(ln.getAttribute(a)));
      const dy = (x) => ly1 + (ly2 - ly1) * (Math.min(Math.max(x, lx1), lx2) - lx1) / (lx2 - lx1);
      const kutu = [...d.querySelectorAll('.ve-fw-yay-yazi text')].map((el) => {
        const w = el.textContent.length * (el.classList.contains('ve-fw-yay-mean-y') ? 6.4 : 6);
        const x = Number(el.getAttribute('x')), y = Number(el.getAttribute('y'));
        const a = el.getAttribute('text-anchor');
        const xs = a === 'end' ? x - w : (a === 'middle' ? x - w / 2 : x);
        return { t: el.textContent, xs, xe: xs + w, yu: y - 8, ya: y + 2 };
      });
      // Çizim alanındaki etiketler: x ekseninin ÜSTÜNDE başlayan (eksen yazıları altında).
      const eksenY = Number(d.querySelector('.ve-fw-yay-eksen line').getAttribute('y1'));
      const ic = kutu.filter((k) => k.xe > lx1 && k.xs < lx2 && k.yu < eksenY);
      expect(ic.length).toBeGreaterThanOrEqual(3);     // ön yük · katsayı · Mean (+ Nm)
      ic.forEach((k) => {
        const alt = dy(k.xs), ust = dy(k.xe);         // doğru sağa doğru yükselir
        expect([key, k.t, alt < k.yu || ust > k.ya]).toEqual([key, k.t, true]);
        expect([key, k.t, k.xs >= lx1]).toEqual([key, k.t, true]);   // y eksenini de kesmez
      });
      for (let i = 0; i < kutu.length; i++) for (let j = i + 1; j < kutu.length; j++) {
        const a = kutu[i], c = kutu[j];
        const biner = a.xs < c.xe && c.xs < a.xe && a.yu < c.ya && c.yu < a.ya;
        expect([key, a.t, c.t, biner]).toEqual([key, a.t, c.t, false]);
      }
    });
  });
});

// ═════════════════════════════════════════════════════ ÇEVRİM MASASI ══
describe('MOTOR VE ÇEVRİM MASASI — tahrik zinciri + devir pencereleri, sayılar kapıdan', () => {
  // Kullanıcı bildirimi (2026-09-29): *"ortadaki iki kocaman diyagram çok
  // gereksiz olmuş. Buraya başka diyagramlar ekleyerek anlatımı güçlendirelim."*
  const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
  const rsOf = (b) => b.sys || b.ratioSys;
  const yuk = (b) => {                            // yük taşıyan aksesuarların indisleri
    const rs = rsOf(b), out = [];
    rs.pulleys.forEach((q, i) => {
      if (i === rs._crkIdx || i === (b.sys && b.sys._tenIdx)) return;
      const def = componentDefs[b.order[i].type] || {};
      if (def.isFeadIdler || def.isFeadTensioner) return;
      out.push(i);
    });
    return out;
  };

  test('ZİNCİR: halkanın çarpanı çekirdeğin speedRatio\'su, sürücününki tahrik oranı', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const b = wiz.veFeadWizBuild();
    const d = dom(wiz._fwMasaCizim(4, b, 800, 700));
    const z = d.querySelector('[data-ve="tahrik-zinciri"]');
    expect(z).not.toBeNull();
    const oranlar = [...z.querySelectorAll('.ve-fw-zn-oran')].map((t) => t.textContent);
    expect(oranlar).toContain('× ' + veSayi(b.drive.ratio, 4));         // 197,32 / 179,62
    yuk(b).forEach((i) => expect(oranlar).toContain('× ' + veSayi(F.speedRatio(rsOf(b), i), 4)));
    expect(z.textContent).toContain('ara kademe ' + veSayi(197.32, 2) + ' / ' + veSayi(179.62, 2));
  });

  test('ZİNCİR KOPUK: oran çözülmediyse söyler, aksesuar oranı SÜRÜCÜYE göre', () => {
    kabuk(); wiz.veFeadWizSeed('AG00686_1475_GATES_2023');
    const s = wiz.veFeadWizState().solver;
    s.ratioMode = 'derive'; s.crankOD = '156'; delete s.fanOD;
    const d = dom(wiz._fwMasaCizim(4, wiz.veFeadWizBuild(), 800, 700));
    expect(d.querySelectorAll('.ve-fw-zn-kayis.kopuk').length).toBe(2);
    expect(d.textContent).toContain('oran çözülmedi — çap eksik');
    expect(d.textContent).toContain('sürücüye göre');
  });

  test('PENCERELER: her satırda her çevrim noktası; sınır motor devrine çevrilmiş', () => {
    const st = ornek();
    const b = wiz.veFeadWizBuild();
    const d = dom(wiz._fwMasaCizim(4, b, 800, 700));
    const nokta = st.solver.duty.filter((r) => Number(r.rpm) > 0).length;
    expect(d.querySelectorAll('[data-ve="cevrim-nokta"]').length).toBe(nokta);
    expect(d.querySelectorAll('[data-ve="aksesuar-nokta"]').length).toBe(nokta * yuk(b).length);
    // Bilinen her sınır (sürekli · anlık · optimum) bir işaret — ya da eksenin ötesinde.
    let bilinen = 0;
    st.pulleys.forEach((p) => {
      const def = componentDefs[p.type] || {};
      if (p.driver || def.isFeadIdler || def.isFeadTensioner) return;
      const L = veFeadAccLimits(p);
      ['optimum', 'maxCont', 'maxPeak'].forEach((k) => { if (L[k].rpm > 0) bilinen++; });
    });
    expect(bilinen).toBeGreaterThan(0);
    expect(d.querySelectorAll('[data-ve="devir-sinir"]').length).toBeLessThanOrEqual(bilinen);
    expect(d.querySelectorAll('[data-ve="devir-sinir"]').length).toBeGreaterThan(0);
  });

  // Ölçülen kusur (2026-09-29, teslimden önce): 12 örnekteki 18 aksesuar
  // sınırının 11'i eksenin ötesinde kaldığı için pencerede ne çizgi ne yazı
  // olarak görünüyordu — üstteki kapı yalnız "≤ bilinen" dediği için geçiyordu.
  test('EKSEN DIŞI SINIR SESSİZCE DÜŞMEZ — her sınır eksende ya da sağ uçta; sürekli sınır eksende', () => {
    let eksenTop = 0, ucTop = 0;
    M.veFeadExampleKeysAll().forEach((k) => {
      kabuk(); wiz.veFeadWizSeed(k);
      const b = wiz.veFeadWizBuild();
      const v = wiz._fwCevrimVeri(b);
      const g = dom(wiz._fwMasaCizim(4, b, 800, 700)).querySelector('[data-ve="devir-pencere"]');
      if (!g || !v.duty.length) return;
      let bekle = 0, surekli = 0;
      v.acc.forEach((a) => {
        const L = a.lim || {};
        if (L.maxCont && L.maxCont.rpm > 0) { bekle++; surekli++; }
        if (L.maxPeak && L.maxPeak.rpm > 0) bekle++;
      });
      const eksen = g.querySelectorAll('text.ve-fw-md-sinir-y').length;
      // Oluk: ilk satır sınırlar ("anlık 6.000"), ikinci satır motor devri.
      const uc = [...g.querySelectorAll('[data-ve="sinir-disari"]')].reduce((t, e) => {
        const [s1, s2] = [...e.querySelectorAll('tspan')].map((x) => x.textContent);
        expect(s2).toMatch(/^motorda /);
        return t + s1.split(' · ').length;
      }, 0);
      expect({ k, gorunen: eksen + uc }).toEqual({ k, gorunen: bekle });
      // Bugünkü örneklerde bütün sürekli sınırlar tabanın VE_FW_PENCERE_PAY
      // katı içinde (en uzağı 1,38): pay bir yazı değil bir ARALIK.
      expect(g.querySelectorAll('line.ve-fw-md-sinir').length).toBeGreaterThanOrEqual(surekli);
      eksenTop += eksen; ucTop += uc;
    });
    expect(eksenTop).toBeGreaterThan(0);               // iki yol da gerçekten koştu
    expect(ucTop).toBeGreaterThan(0);
  });

  // Oluk AYRI bir sütun: çizimdeki yazılar (sınır · kritik) oraya taşmaz, sağda
  // yer yoksa çizginin/halkanın soluna geçer. Tarayıcının çakışma taraması bunu
  // görmüyor — oluğa uzanan kritik yazısı oluğun yazısının ALTINDA kalıyor
  // (ölçüldü: yazıyı hep sağa zorlayan değişiklik o kapıdan geçti).
  test('ÇİZİMİN YAZISI ÇİZİM ALANINDA — kritik ve sınır yazısı oluğa/sol sütuna taşmaz', () => {
    let sola = 0;
    M.veFeadExampleKeysAll().forEach((k) => {
      kabuk(); wiz.veFeadWizSeed(k);
      const g = dom(wiz._fwMasaCizim(4, wiz.veFeadWizBuild(), 800, 700)).querySelector('[data-ve="devir-pencere"]');
      const eksen = g && g.querySelector('line.ve-fw-md-eksen');
      if (!eksen) return;
      const x0 = +eksen.getAttribute('x1'), x1 = +eksen.getAttribute('x2');
      g.querySelectorAll('[data-ve="kritik-y"], text.ve-fw-md-sinir-y').forEach((t) => {
        const x = +t.getAttribute('x'), en = t.textContent.length * wiz.VE_FW_HARF;
        const sol = t.getAttribute('text-anchor') === 'end';
        if (sol) sola++;
        const [a, b] = sol ? [x - en, x] : [x, x + en];
        expect({ k, t: t.textContent, tasar: a < x0 - 0.5 || b > x1 + 0.5 }).toEqual({ k, t: t.textContent, tasar: false });
      });
    });
    expect(sola).toBeGreaterThan(0);                   // sola geçiş yolu gerçekten koştu
  });

  test('KRİTİK NOKTA kapının satırı — sayı ve hüküm yeniden hesaplanmaz', () => {
    const st = ornek();
    const b = wiz.veFeadWizBuild();
    const d = dom(wiz._fwMasaCizim(4, b, 800, 700));
    const R = veFeadChecks(b, veFeadCheckOpt(st.solver, st.solver.duty));
    expect(R.speedLimit.rows.length).toBeGreaterThan(0);
    const yazi = [...d.querySelectorAll('[data-ve="kritik-y"]')].map((t) => t.textContent);
    R.speedLimit.rows.forEach((r) => {
      const k = r.kritik;
      expect(yazi).toContain(k.ad + ' ' + veSayi(k.accRpm, 0) + ' / ' + veSayi(k.limit, 0));
      expect(d.textContent).toContain('pay %' + veSayi(k.payPct, 1));
    });
  });

  // Nokta rengi = kapının karşılaştırması (accRpm > sürekli → uyarı, > anlık → hata).
  test('NOKTA DURUMU kapıyla aynı karşılaştırma — sınırı düşürünce aşan noktalar işaretlenir', () => {
    const st = ornek();
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    alt.maxContRpm = 4000; alt.maxPeakRpm = 5000;
    const b = wiz.veFeadWizBuild();
    const d = dom(wiz._fwMasaCizim(4, b, 800, 700));
    const i = b.order.findIndex((n) => n.id === 'wz-' + alt.key);
    const oran = F.speedRatio(rsOf(b), i);
    const bekle = st.solver.duty.filter((r) => Number(r.rpm) > 0).map((r) => {
      const acc = Number(r.rpm) * oran;
      return acc > 5000 ? 'err' : acc > 4000 ? 'warn' : 'ok';
    });
    const noktalar = [...d.querySelectorAll('[data-ve="aksesuar-nokta"]')]
      .filter((c) => c.querySelector('title').textContent.includes(alt.name || 'Alternatör'));
    expect(noktalar.map((c) => c.getAttribute('data-durum'))).toEqual(bekle);
    expect(bekle).toContain('err');
    expect(d.querySelector('.ve-fw-md-alt-err').textContent).toMatch(/aşıyor %/);
  });

  test('GÜÇ SATIRI: çubuk = her noktada aksesuarların _fwKwEff toplamı', () => {
    const st = ornek();
    const b = wiz.veFeadWizBuild();
    const d = dom(wiz._fwMasaCizim(4, b, 800, 700));
    const cub = [...d.querySelectorAll('[data-ve="guc-cubuk"]')];
    const duty = st.solver.duty.map((r, i) => ({ r, i })).filter((x) => Number(x.r.rpm) > 0);
    expect(cub.length).toBe(duty.length);
    const loads = st.pulleys.filter((p) => {
      const def = componentDefs[p.type] || {};
      return !(p.driver || def.isFeadIdler || def.isFeadTensioner);
    });
    duty.forEach((x, k) => {
      const t = loads.reduce((a, p) => a + wiz._fwKwEff(b, st, x.i, p).kw, 0);
      expect(cub[k].querySelector('title').textContent).toContain(veSayi(t, 2) + ' kW');
    });
  });

  test('governed/overspeed yoksa pencere kapının NOTUNU söyler', () => {
    const st = ornek();
    delete st.solver.governedRpm; delete st.solver.overspeedRpm;
    const b = wiz.veFeadWizBuild();
    const R = veFeadChecks(b, veFeadCheckOpt(st.solver, st.solver.duty));
    const d = dom(wiz._fwMasaCizim(4, b, 800, 700));
    if (R.speedLimit.note) expect(d.querySelector('[data-ve="pencere-not"]').textContent).toBe(R.speedLimit.note);
    expect(d.querySelectorAll('[data-ve="motor-sinir"]').length)
      .toBe(['idleRpm', 'governedRpm', 'overspeedRpm'].filter((k) => Number(st.solver[k]) > 0).length);
  });

  test('TEK EKSEN: iki diyagramda da ikinci bir değer ekseni yok; renk yalnız durum', () => {
    const d = dom((ornek(), wiz._fwMasaCizim(4, wiz.veFeadWizBuild(), 800, 700)));
    expect(d.querySelectorAll('svg').length).toBe(2);
    // Seri paleti (kimlik rengi) kullanılmıyor — durum renkleriyle çakışıyordu.
    expect(d.innerHTML).not.toMatch(/--seri-\d/);
    expect(WIZ_SRC).not.toMatch(/VE_FW_SERI/);
    // Güç bir büyüklük: vurgu ya da durum tonu taşımaz (vurgu tonu açık temada
    // "anlık sınırın üstü" bölgesinin pembesine düşüyordu).
    expect(kural('.ve-fw-md-guc')).toMatch(/fill:/);
    expect(kural('.ve-fw-md-guc')).not.toMatch(/--accent-/);
  });

  test('grafik adımı 1:1 — öteki masalar k kat', () => {
    ornek();
    const b = wiz.veFeadWizBuild();
    wiz._fwMasaCizim(4, b, 700, 640);
    expect(KAT()).toBe(1);
    wiz._fwMasaCizim(1, b, 700, 640);
    expect(KAT()).toBeGreaterThan(1);
  });
});

// ═══════════════════════════════════════════════════════ ÖZET MASASI ══
describe('ÖZET MASASI — sınırdaki merkez mesafesi kapının satırları', () => {
  test('kesikli çizgi sayısı = merkez mesafesi kapısının ihlal satırı', () => {
    ornek();
    const b = wiz.veFeadWizBuild();
    const s = wiz.veFeadWizState().solver;
    const R = veFeadChecks(b, veFeadCheckOpt(s, s.duty));
    const ihlal = R.centerDistance.rows.filter((r) => !r.ok);
    expect(ihlal.length).toBeGreaterThan(0);                 // örnekte 1 çift
    const d = document.createElement('div'); d.innerHTML = wiz._fwMasaCizim(5, b, 910, 766);
    expect(d.querySelectorAll('[data-ve="merkez-sinir"] line').length).toBe(ihlal.length);
    ihlal.forEach((r) => expect(d.textContent).toContain('a = ' + veSayi(r.a, 1)));
  });

  test('geniş masada çizim yüzen panelin SOLUNDA kalır', () => {
    ornek();
    const b = wiz.veFeadWizBuild();
    const W = 910, H = 766;
    const d = document.createElement('div'); d.innerHTML = wiz._fwMasaCizim(5, b, W, H);
    const k = KAT();
    const sag = Math.max(...[...d.querySelectorAll('circle[data-ve="pulley"]')].map((c) =>
      Number(c.getAttribute('cx')) + Number(c.getAttribute('r'))));
    expect(sag * k).toBeLessThanOrEqual(W - wiz.VE_FW_OZET_PANEL - 12);
  });

  test('kapılar kapı başına TEK satır hüküm + satırların tamamı ayrıntıda', () => {
    ornek();
    const h = wiz._fwChecksCard(wiz.veFeadWizBuild());
    const d = document.createElement('div'); d.innerHTML = h;
    const kapi = [...d.querySelectorAll('.ve-fw-gate')];
    expect(kapi.length).toBe(3);
    kapi.forEach((g) => expect(['ok', 'warn', 'no', 'wait']).toContain(g.dataset.durum));
    // Hüküm kapının kendi durumundan; öznitelik ile satır AYNI sırada.
    const durum = d.querySelector('[data-ve-fw-checks]').getAttribute('data-ve-fw-checks-durum').split('/');
    expect(kapi.map((g) => g.dataset.durum)).toEqual(durum);
  });
});

// ════════════════════════════════════════════════════ ÇEVRİM PENCERESİ ══
describe('ÇEVRİM TABLOSU PENCEREDE — canlı ve Esc tek katman', () => {
  test('açılır; kW okuması yerinde tazelenir, girdi kutusu YENİDEN KURULMAZ', () => {
    ornek();
    wiz.veFeadWizGoto(4);
    wiz.veFeadWizCevrimAc();
    const ov = document.getElementById('ve-fw-cevrim');
    expect(ov.style.display).toBe('flex');
    const st = wiz.veFeadWizState();
    expect(ov.querySelectorAll('tbody tr').length).toBe(st.solver.duty.length);
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    // Kayıtlı kW yoksa okuma devirle değişir: kaydı temizle.
    st.solver.duty.forEach((r) => { if (r.kw) delete r.kw[alt.key]; });
    alt.accPreset = 'prestolite_180a';
    wiz.veFeadWizCevrimRender();
    const girdi = ov.querySelector('tbody tr input');
    const hucre = () => ov.querySelector('[data-fw-kw="0:' + alt.key + '"]').textContent;
    const once = hucre();
    wiz.veFeadWizDutySet(0, 'rpm', String(Number(st.solver.duty[0].rpm) + 900));
    wiz.veFeadWizLive();
    expect(ov.querySelector('tbody tr input')).toBe(girdi);   // aynı düğüm
    expect(hucre()).not.toBe(once);
  });

  test('Esc önce pencereyi kapatır, sihirbaz açık kalır; kapanış iç pencereleri kapatır', () => {
    ornek();
    wiz.veFeadWizCevrimAc();
    wiz.veFeadWizKey({ key: 'Escape' });
    expect(document.getElementById('ve-fw-cevrim').style.display).toBe('none');
    expect(document.getElementById('ve-feadwiz-overlay').style.display).toBe('flex');
    wiz.veFeadWizCevrimAc();
    wiz.veFeadWizEngOpen();
    wiz.veFeadWizClose(false);
    expect(document.getElementById('ve-fw-cevrim').style.display).toBe('none');
    expect(document.getElementById('ve-fw-eng').style.display).toBe('none');
  });

  test('sayfada tablo YOK — seçici, okumalar ve satır sayılı düğme', () => {
    const st = ornek();
    const d = adimDOM(4);
    expect(d.querySelector('#ve-fw-yan table')).toBeNull();
    expect(d.querySelector('#ve-fw-cevrim-ac').textContent).toContain(st.solver.duty.length + ' satır');
  });
});

// ════════════════════════════════════════════ AÇIKLAMA YÜZEYİ YOK (masa) ══
describe('masada yönerge YOK — lejant bir ANAHTAR', () => {
  // Kullanıcı kararı (2026-09-02): sihirbazda açıklama yüzeyi yok. Masada
  // "sürükle: taşı" gibi yönerge yalnız ipucunda (title) durur.
  test('görünür metinde sürükle/tıkla/fareyle yok — her adım, her görünüm', () => {
    ornek();
    const b = wiz.veFeadWizBuild();
    for (let i = 0; i < ADIM; i++) {
      const d = document.createElement('div');
      d.innerHTML = wiz._fwMasaHTML(i, b);
      d.querySelectorAll('title').forEach((t) => t.remove());
      expect(d.textContent).not.toMatch(/sürükle|tıkla|fareyle/i);
    }
  });
});

// ═════════════════════════════════════════════════ ÇİZİCİNİN KÜNYESİ ══
describe('ÇİZİCİNİN KÜNYESİ masada çizilmez — kanvas kartında durur', () => {
  test('masa çizimlerinde pos-label ve rib-legend YOK; varsayılan çağrıda VAR', () => {
    ornek();
    const b = wiz.veFeadWizBuild();
    [0, 1, 2, 3, 5].forEach((i) => {
      const h = wiz._fwMasaCizim(i, b, 640, 600);
      expect(h).not.toContain('data-ve="pos-label"');
      expect(h).not.toContain('data-ve="rib-legend"');
    });
    const kart = fead.veFeadLayoutSVG(b, 440, 400, { posMode: 'mean' });
    expect(kart).toContain('data-ve="pos-label"');
    expect(kart).toContain('data-ve="rib-legend"');
  });

  test('masa katmanının yazısı --masa-k\'ya bölünür (ekranda jetonun boyu)', () => {
    ['.ve-fw-eksen-yazi text', '.ve-fw-secim text', '.ve-fw-g-yazi', '.ve-fw-merkez text']
      .forEach((sec) => expect(kural(sec)).toMatch(/font-size:calc\(var\(--fs-[a-z]+\) \/ var\(--masa-k, 1\)\)/));
    expect(wiz._fwMasaHTML(1, (ornek(), wiz.veFeadWizBuild()))).toMatch(/--masa-k:1\.35/);
  });
});

// ════════════════════════════════════════════ ADIM NUMARASI · KURULUM · K ══
describe('ADIM NUMARASI METNE ELLE YAZILMAZ', () => {
  test('kaynakta görünür metinde elle yazılmış "N. adım" yok — _fwAdimNo(anahtar)', () => {
    const kod = WIZ_SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    const elle = kod.match(/['"][^'"\n]*\b\d+\. adım[^'"\n]*['"]/g) || [];
    expect(elle).toEqual([]);
  });

  test('ÜRETİLEN metinde adım numarası adım sayısını AŞMIYOR', () => {
    for (const tohum of ['AG00976_GATES_2025', null]) {
      kabuk();
      if (tohum) wiz.veFeadWizSeed(tohum); else wiz.veFeadWizReset();
      for (let i = 0; i < ADIM; i++) {
        (adimDOM(i).textContent.match(/\b(\d+)\. adım/g) || []).forEach((m) => {
          expect(parseInt(m, 10)).toBeLessThanOrEqual(ADIM);
        });
      }
    }
    expect(wiz._fwAdimNo('ozet')).toBe(ADIM);
  });
});

describe('KURULACAKLAR LİSTESİ KURULUMUN KENDİSİNDEN', () => {
  test('AG00976: sayı ve adlar veFeadWizNodes\'tan — özet panelinde basılı', () => {
    ornek();
    const liste = wiz.veFeadWizNodes(wiz.veFeadWizState()).nodes;
    const ozet = wiz._fwKurulumOzet(liste);
    expect(ozet.startsWith(liste.length + ' — ')).toBe(true);
    expect(ozet).toContain('6 kasnak (gergi dâhil)');
    expect(ozet.toLowerCase()).not.toMatch(/\btablo\b/);
    expect(adimDOM(ADIM - 1).textContent).toContain(ozet);
  });
});

describe('KÜNYEDEN GELEN ALAN "K" İŞARETLİ', () => {
  test('künye seçiliyken kilitli alanlar K taşır — gergi adımı ve gerginin editörü', () => {
    ornek();
    expect(wiz.veFeadWizTenLocked(wiz.veFeadWizState())).toBe(true);
    const d = adimDOM(2);
    const kilitli = d.querySelectorAll('.ve-fw-lock');
    expect(kilitli.length).toBeGreaterThan(0);
    kilitli.forEach((el) => {
      const kap = el.closest('.ve-fw-kun-kap');
      expect(kap).not.toBeNull();
      expect(kap.querySelector('.ve-fw-kun').textContent).toBe('K');
      expect(kap.querySelector('.ve-fw-kun').getAttribute('title')).toBeTruthy();
    });
    wiz.veFeadWizSec('__ten__');
    expect(adimDOM(1).querySelectorAll('#ve-fw-ed .ve-fw-kun').length).toBeGreaterThan(0);
    wiz.veFeadWizTenLib('');                     // "— elle gir —"
    expect(adimDOM(2).querySelectorAll('.ve-fw-kun').length).toBe(0);
  });
});
