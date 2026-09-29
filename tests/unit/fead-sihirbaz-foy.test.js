/**
 * fead-sihirbaz-foy.test.js — SİHİRBAZIN FÖY DİLİ (js/cp-fead-wizard.js)
 *
 * Kullanıcı kararı (2026-09-29, tasarım tuvali "Adım içerikleri" · E): *"E föy
 * olacak."* Şikâyet: *"pencerelerin içerikleri biraz hoşuma gitmiyor … Çok
 * sıradan duruyor."* Ölçüm: altı adımda 25 kart aynı başlık bandını ve sol
 * renk şeridini taşıyordu; şeritteki 8 renk hiçbir DURUM anlatmıyordu.
 * Geometrinin girildiği Kasnaklar adımında (48 girdi) hiç çizim yoktu. İki
 * metin bayattı: "7. adımdaki iki kapı" (6 adım var) ve kurulacaklar arasında
 * artık bileşen olmayan "tablo".
 *
 * Kapılar: bölümler adım numarasıyla numaralı · adım numarası metne ELLE
 * yazılmıyor · kurulacaklar listesi kurulumun KENDİSİNDEN · antet durumun
 * kendisinden · Kasnaklar adımının şekli çiziciden ve canlı · künyeden gelen
 * alan K işaretli · SONUÇ satırı föyün dibinde ve damga rayla aynı sayıyı
 * söylüyor · renk şeridi gitti. Gerçek tarayıcı (yapışık SONUÇ, tek satır
 * başlık, taşma yok): tests/e2e/fead-wizard.spec.js · fead-wizard-tablo.spec.js.
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
 require('../../js/fead-accessories.js'), require('../../js/fead-engines.js')]
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
    + '<div id="ve-feadwiz-overlay" style="display:none;">'
    + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>'
    + '<div id="ve-fw-ang" style="display:none;"></div>';
};
const adimDOM = (i) => {
  const d = document.createElement('div');
  d.innerHTML = wiz.veFeadWizStepHTML(i, wiz.veFeadWizBuild());
  return d;
};
const ADIM = wiz.VE_FW_STEPS.length;

describe('BÖLÜM — kutu değil föyün numaralı bölümü', () => {
  test('her adımda bölümler "adım.sıra" numarası taşıyor, sıra 1\'den ardışık', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    for (let i = 0; i < ADIM; i++) {
      const no = [...adimDOM(i).querySelectorAll('.ve-fw-card-h .ve-fw-bno')].map((e) => e.textContent);
      expect(no.length).toBeGreaterThan(0);
      expect(no).toEqual(no.map((_, k) => (i + 1) + '.' + (k + 1)));
    }
  });

  test('gövde dışında kurulan bölüm numara ALMAZ (yanlış numara yerine hiç)', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    // Adım basılırken sayaç açık, bitince kapalı: sonradan kurulan bir bölüm
    // (motor künyesi penceresi) önceki adımın sayacını sürdürmemeli.
    wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild());
    const d = document.createElement('div');
    d.innerHTML = wiz.veFeadWizEngHTML();
    expect(d.querySelectorAll('.ve-fw-card').length).toBeGreaterThan(0);
    expect(d.querySelectorAll('.ve-fw-bno').length).toBe(0);
  });

  test('RENK ŞERİDİ YOK: bölüm satır içi renk taşımıyor, CSS\'te --fw-accent kalmadı', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    for (let i = 0; i < ADIM; i++) {
      adimDOM(i).querySelectorAll('.ve-fw-card').forEach((c) => expect(c.getAttribute('style')).toBeNull());
    }
    expect(CSS).not.toMatch(/--fw-accent/);
  });
});

describe('ADIM NUMARASI METNE ELLE YAZILMAZ', () => {
  test('kaynakta görünür metinde elle yazılmış "N. adım" yok — _fwAdimNo(anahtar)', () => {
    // Yorum satırları tarih anlatır ve kapsam dışı; kapı yalnız kod satırında,
    // tırnak içindeki metne bakar.
    const kod = WIZ_SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    const elle = kod.match(/['"][^'"\n]*\b\d+\. adım[^'"\n]*['"]/g) || [];
    expect(elle).toEqual([]);
  });

  test('ÜRETİLEN metinde adım numarası adım sayısını AŞMIYOR ve adın adımını gösteriyor', () => {
    // Ölçülen kusur: "7. adımdaki iki kapı" — adım sayısı 6.
    for (const tohum of ['AG00976_GATES_2025', null]) {
      kabuk();
      if (tohum) wiz.veFeadWizSeed(tohum); else wiz.veFeadWizReset();
      for (let i = 0; i < ADIM; i++) {
        const t = adimDOM(i).textContent;
        (t.match(/\b(\d+)\. adım/g) || []).forEach((m) => {
          expect(parseInt(m, 10)).toBeLessThanOrEqual(ADIM);
        });
      }
    }
    expect(wiz._fwAdimNo('gergi')).toBe(wiz.VE_FW_STEPS.findIndex((s) => s.key === 'gergi') + 1);
    expect(wiz._fwAdimNo('ozet')).toBe(ADIM);
    expect(wiz._fwAdimNo('yok')).toBe(0);
  });
});

describe('KURULACAKLAR LİSTESİ KURULUMUN KENDİSİNDEN', () => {
  test('AG00976: sayı ve adlar veFeadWizNodes\'tan — "tablo" yok', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const liste = wiz.veFeadWizNodes(wiz.veFeadWizState()).nodes;
    const ozet = wiz._fwKurulumOzet(liste);
    expect(ozet.startsWith(liste.length + ' — ')).toBe(true);
    expect(ozet).toContain('6 kasnak (gergi dâhil)');
    expect(ozet).toContain('2 ' + componentDefs['fead-layout'].name);
    expect(ozet).toContain(componentDefs['fead-solver'].name);
    expect(ozet).toContain(componentDefs['fead-report'].name);
    expect(ozet.toLowerCase()).not.toMatch(/\btablo\b/);
    // Özet adımı bu satırı basıyor.
    expect(adimDOM(ADIM - 1).textContent).toContain(ozet);
  });

  test('bir düğüm tipi eklenirse liste KENDİLİĞİNDEN söyler (elle yazılmış liste yok)', () => {
    const ozet = wiz._fwKurulumOzet([{ type: 'fead-crank' }, { type: 'fead-belt' }, { type: 'fead-wizard' }]);
    expect(ozet).toBe('3 — 1 kasnak (gergi dâhil) · ' + componentDefs['fead-belt'].name
      + ' · ' + componentDefs['fead-wizard'].name);
  });
});

describe('ANTET — sistem · kaynak · sayfa, durumun kendisinden', () => {
  const antet = (i) => [...adimDOM(i).querySelectorAll('.ve-fw-antet-h')]
    .map((h) => [h.querySelector('i').textContent, h.querySelector('b').textContent]);

  test('Gates örneğinde sistem adı ve rapor kodu; sayfa "n / 6"', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const a = antet(2);
    expect(a[0]).toEqual(['Sistem', 'BMC Otomotif FEAD 5']);
    expect(a[1]).toEqual(['Kaynak', 'Gates AG00976']);
    expect(a[2]).toEqual(['Sayfa', '3 / ' + ADIM]);
  });

  test('boş başlangıçta kaynak "elle" — uydurulan kaynak yok', () => {
    kabuk(); wiz.veFeadWizReset();
    expect(antet(0)[1]).toEqual(['Kaynak', 'elle']);
  });

  test('başlık TEK satırın elemanları: numara · ad · ipucu aynı kapta (kapı ≤ 24 px e2e\'de)', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const d = adimDOM(1);
    const bas = d.querySelector('.ve-fw-foy-bas .ve-fw-head');
    expect(bas.querySelector('.ve-fw-head-no').textContent).toBe('2');
    expect(bas.querySelector('h2').textContent).toBe(wiz.VE_FW_STEPS[1].ad);
    expect(bas.querySelector('p').textContent).toBe(wiz.VE_FW_STEPS[1].ipucu);
  });
});

describe('KASNAKLAR ADIMININ ŞEKLİ — çiziciden ve canlı', () => {
  test('şekil var, göbek numaraları tablonun satır sayısı kadar, satır numarası tabloda', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const d = adimDOM(1);
    const sekil = d.querySelector('#ve-fw-sekil');
    expect(sekil).not.toBeNull();
    const no = [...sekil.querySelectorAll('[data-ve="sira-no"] text')].map((t) => t.textContent);
    const satir = d.querySelectorAll('.ve-fw-tbl-kasnak tbody tr');
    expect(no).toEqual([...satir].map((_, k) => String(k + 1)));
    expect([...d.querySelectorAll('.ve-fw-tbl-kasnak .ve-fw-sira')].map((e) => e.textContent))
      .toEqual(no);
  });

  test('çözüm yokken şekil SAYI UYDURMAZ, söyler', () => {
    kabuk(); wiz.veFeadWizReset();
    const s = adimDOM(1).querySelector('#ve-fw-sekil');
    expect(s.querySelector('svg')).toBeNull();
    expect(s.querySelector('.ve-fw-sekil-bos')).not.toBeNull();
  });

  test('CANLI YAMA şekli tazeler — yazılan koordinat şekilde görünür', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    document.getElementById('ve-feadwiz-overlay').style.display = 'flex';
    wiz.veFeadWizGoto(1);
    const once = document.getElementById('ve-fw-sekil').innerHTML;
    const alt = wiz.veFeadWizState().pulleys.find((p) => p.type === 'fead-alternator');
    wiz.veFeadWizPulleySet(alt.key, 'x', -300);
    wiz.veFeadWizLive();
    const sonra = document.getElementById('ve-fw-sekil').innerHTML;
    expect(sonra).not.toBe(once);
    expect(sonra).toContain('data-ve="sira-no"');
  });

  test('çizici tek kaynak: veFeadLayoutSVG — sunum kendi geometrisini kurmaz', () => {
    const govde = WIZ_SRC.slice(WIZ_SRC.indexOf('function _fwKasnakSekilHTML('));
    const g = govde.slice(0, govde.indexOf('\n}\n'));
    expect(g).toContain('veFeadLayoutSVG(');
    expect(g).toMatch(/siraNo: true/);
    expect(g).not.toMatch(/FEADCore\./);
  });
});

describe('KÜNYEDEN GELEN ALAN "K" İŞARETLİ', () => {
  test('künye seçiliyken kilitli alanlar K taşır, elle girilen modelde K yok', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
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
    // Kasnaklar tablosundaki gergi satırı da aynı okuyucudan.
    expect(adimDOM(1).querySelectorAll('.ve-fw-tr-ten .ve-fw-kun').length).toBeGreaterThan(0);
    wiz.veFeadWizTenLib('');                     // "— elle gir —"
    expect(adimDOM(2).querySelectorAll('.ve-fw-kun').length).toBe(0);
  });
});

describe('SONUÇ SATIRI — föyün dibinde, damga rayla aynı sayı', () => {
  test('SONUÇ adımın SON öğesi; uyarı kutusu ondan önce', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    for (let i = 0; i < ADIM; i++) {
      const d = adimDOM(i);
      const son = d.lastElementChild;
      expect(son.id).toBe('ve-fw-live');
      expect(son.querySelector('.ve-fw-live-ad').textContent).toBe('Sonuç');
      if (i < ADIM - 1) expect(son.previousElementSibling.id).toBe('ve-fw-issue');
    }
  });

  test('damga: çözülen modelde adımın eksik/uyarı sayısı (veFeadWizStepState)', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const b = wiz.veFeadWizBuild();
    for (let i = 0; i < ADIM; i++) {
      wiz.veFeadWizGoto(i);
      const d = document.createElement('div');
      d.innerHTML = wiz.veFeadWizLiveHTML(b);
      const s = wiz.veFeadWizStepState(b, i);
      const damga = d.querySelector('.ve-fw-pill-ok').textContent;
      expect(damga).toContain(s.warn ? s.warn + ' uyarı' : 'eksik girdi yok');
    }
  });

  test('çözülemeyen modelde damga eksik SAYISINI yazar, sebep yanında', () => {
    kabuk(); wiz.veFeadWizReset();
    const b = wiz.veFeadWizBuild();
    const d = document.createElement('div');
    d.innerHTML = wiz.veFeadWizLiveHTML(b);
    expect(d.querySelector('.ve-fw-pill-err').textContent).toContain(b.errors.length + ' eksik');
    expect(d.querySelector('.ve-fw-pill-dim').textContent).toBe(b.errors[0]);
  });

  test('CSS: SONUÇ yapışık ve dipte, alanın dili noktalı alt çizgi', () => {
    expect(CSS).toMatch(/\.ve-fw-body > #ve-fw-live\{[^}]*position:sticky;[^}]*bottom:0;[^}]*margin-top:auto/);
    expect(CSS).toMatch(/\.ve-fw-inp\{[^}]*border-bottom:1px dotted/);
    expect(CSS).toMatch(/\.ve-fw-inp\.ve-fw-lock\{[^}]*border-bottom-color:transparent/);
  });
});
