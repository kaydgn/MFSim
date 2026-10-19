/**
 * mount-pencere.test.js — TAKOZ PENCERELERİ: FEAD KABUĞU + FÖY (2026-10-14)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı seçimi (tasarım tuvali): "Hepsi için B föy seçeneği" + C'nin
 * "Güç grubundaki yeri" krokisi. Pencereler girdiden TÜRETİLEN değerleri
 * taşıyor; bu yüzden sessiz hata sınıfı da pencereye taşındı. Son çözümün
 * sayılarını TAŞIMIYOR (kullanıcı kararı 2026-10-16: sonuç yalnız ayrıntılı
 * raporda — kapı pencere-kabuk.test.js → "ÇÖZÜMDEN BAĞIMSIZ"). Bu dosya o
 * sınıfın kapılarıdır:
 *
 *   · SONUÇ İMZASI — model hesaptan sonra değişince sonuç "bayat" görünür;
 *     yazım farkı ve ad değişikliği bayatlatmaz (Çözücü'nün notu, Rapor).
 *   · KİMLİKLE EŞLEME — raporun çizimi takozu R.mounts'ta SIRAYLA değil
 *     KİMLİKLE bulur.
 *   · TEK KAYNAK — CG farkı çekirdeğin combineMassProps'u, mil torku
 *     çözücünün tork durumu, Rapor'un girdileri raporun okuduğu yedekler.
 *   · ÇÖZÜCÜNÜN BOŞ ALAN KURALI — boş alan pencerede de 0'dır ve pencere
 *     bunu "eksik" diye söyler.
 *   · YERİNDE TAZELEME — düzenleme pencereyi kurmaz; türetilen alanlar
 *     tazelenir, odaktaki girdi aynı eleman kalır.
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
// Pencere raporun uygunluğunu ve yedek seçeneklerini GLOBAL olarak çağırır.
global.veMntUygunluk = rep.veMntUygunluk;
global.veMntRaporOpts = rep.veMntRaporOpts;
global._mntRepCaseTr = rep._mntRepCaseTr;
global._mntRepIsolation = rep._mntRepIsolation;
global._mntRepEngine = rep._mntRepEngine;
global._mntRepZeta = rep._mntRepZeta;
global.veMntAkso = require('../../js/mount-akso.js');

const TULGA = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples/tulga_topoloji.json'), 'utf8'));
function tulga() {
  global.nodes = JSON.parse(JSON.stringify(TULGA.nodes)).map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  return global.nodes;
}
const bul = (f) => global.nodes.find(f);
const cozucu = () => bul((n) => n.type === 'mnt-solver');
const onTakoz = () => bul((n) => n.customName === 'Ön Takoz');
const motor = () => bul((n) => n.type === 'mnt-motor');
const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
function coz() { const R = cp._mntComputeResults(cozucu().id); global._veMntLast = R; return R; }

beforeEach(() => { resetStubs(stubs); cp._mntForgetResults(); });

describe('SONUÇ İMZASI — güncel / bayat', () => {
  test('çözümden sonra güncel; bir rijitlik değişince bayat; geri alınınca yine güncel', () => {
    tulga();
    expect(cp.veMntSonucDurumu().durum).toBe('yok');
    const R = coz();
    expect(R.imza).toEqual(expect.any(String));
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
    onTakoz().data.kzs = '300';
    expect(cp.veMntSonucDurumu().durum).toBe('bayat');
    onTakoz().data.kzs = '290';
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
  });

  test('yazım farkı ("290" ↔ 290 ↔ "290.0") ve AD değişikliği bayatlatmaz — fiziğe girmez', () => {
    tulga(); coz();
    onTakoz().data.kzs = 290;
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
    onTakoz().data.kzs = '290.0';
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
    onTakoz().customName = 'Başka ad';
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
  });

  test('çözücü ayarı (ζ), silindir sayısı ve vites oranı da sonucun parçası — bayatlatır', () => {
    tulga(); coz();
    cozucu().data.zeta = 0.05;
    expect(cp.veMntSonucDurumu().durum).toBe('bayat');
    delete cozucu().data.zeta;
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
    motor().data.cylinders = 6;                       // uygunluk (K1/K2) değişir
    expect(cp.veMntSonucDurumu().durum).toBe('bayat');
    delete motor().data.cylinders;
    bul((n) => n.type === 'mnt-gearbox').data.g3 = '1.5';  // vites başına durum değişir
    expect(cp.veMntSonucDurumu().durum).toBe('bayat');
  });

  test('nokta kütlenin tensörü imzaya girmez (çözücü onu sıfırlar)', () => {
    tulga(); coz();
    const braket = bul((n) => n.type === 'mnt-bracket' && n.data.pointMass);
    braket.data.Ixx = 99;
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
  });

  test('çözücü topolojide yoksa sonuç bayat — başka bir modelin cevabı güncel sayılmaz', () => {
    tulga(); coz();
    global.nodes = global.nodes.filter((n) => n.type !== 'mnt-solver');
    expect(cp.veMntSonucDurumu().durum).toBe('bayat');
  });
});

describe('KİMLİKLE EŞLEME — raporun çizimi takozu sırayla değil kimlikle bulur', () => {
  // Pencere 2026-10-16'dan beri sonuç göstermiyor; eşleme raporun teknik
  // illüstrasyonunda (veMntAksoCozumModel → _mntAksoModelKur) yaşıyor.
  test('R.mounts düğüm kimliğini taşır; girdinin sırası ters çevrilse de her takozun kuvveti KENDİ satırından', () => {
    tulga();
    const R = coz();
    expect(R.mounts.map((m) => m.id)).toEqual(global.nodes.filter((n) => n.type === 'mnt-mount').map((n) => n.id));
    const g = JSON.parse(JSON.stringify(R.gather)); g.mounts.reverse();
    const m = cp.veMntAksoCozumModel(Object.assign({}, R, { gather: g }));
    const st = R.allCases.find((c) => c.name === 'Static').res;
    expect(m.takoz.map((t) => t.ad)[0]).toBe(R.mounts[R.mounts.length - 1].name);   // sıra gerçekten ters
    m.takoz.forEach((t) => {
      const j = R.mounts.findIndex((x) => x.id === t.id);
      expect(t.f).toEqual(st.perMount[j].f);
    });
  });
});

describe('TEK KAYNAK — pencere raporun ve çekirdeğin sayısını okur', () => {
  // Eski projede silindir sayısı Rapor düğümündeydi: rapor onu yedek olarak
  // okur, Rapor penceresinin girdileri de AYNI yedeği ve kaynağını gösterir.
  test('eski projenin Rapor düğümündeki silindir sayısı İKİ yüzeyde de görülür: raporun uygunluğu ve Rapor penceresinin girdileri', () => {
    tulga();
    const r = bul((n) => n.type === 'mnt-report');
    r.data = { cylinders: 6 };                        // yedek girdi
    motor().data.cylinders = '';
    const R = coz();
    const U = rep.veMntUygunluk(R, rep.veMntRaporOpts());
    expect(U.satirlar[0].st).not.toBe('wait');        // rapor yedeği görüyor
    expect(cp._mntRaporFrekansHTML(r)).toContain('<tr><td>Silindir sayısı</td><td>6</td><td class="sol">Rapor (eski)</td></tr>');
  });

  test('Birleşik CG\'ye Δ = gövde CG − çekirdeğin combineMassProps CG\'si (boş alan = 0, çözücü gibi)', () => {
    tulga();
    const M = cp._mntCanliModel();
    const cg = core.combineMassProps(cp._mntToSI(cp._mntGatherForSolver(), 9.81).components).cg.map((v) => v * 1000);
    expect(M.mp.cg.map((v) => v * 1000)).toEqual(cg);
    const html = cp.getMntMassPropertiesHTML(motor());
    const dx = html.match(/id="ve-mnt-amd-0-[^"]+" data-tazele>([^<]+)</)[1];
    expect(dx).toBe(veSayi(124.96 - cg[0], 1, { eksi: '−' }));
    expect(dx).toBe('−457,5');
    // Boş Y: pencere de 0 alır ve kategori durumu (bant) bunu söyler
    motor().data.cgy = '';
    expect(cp._mntKutleDurumu(motor()).yazi).toBe('CG eksik');
  });

  test('mil torku çözücünün ileri tork durumundan (T = −T_x) — ayrı çarpım yok', () => {
    tulga();
    const Z = cp._mntTorkZinciri();
    const fwd = cp._mntToSI(cp._mntGatherForSolver(), 9.81).loadCases.find((c) => c.name === 'Forward Torque');
    expect(Z.ileri).toBeCloseTo(-fwd.T[0], 9);
    expect(Math.round(Z.ileri)).toBe(12761);          // 760 · 1,58 · 3,10 · 3,428
    // Boş transfer oranı çözücüde 1'dir: zincir onu kullanır, Tahrik kategorisi eksik der
    bul((n) => n.type === 'mnt-transfer').data.iTransfer = '';
    expect(Math.round(cp._mntTorkZinciri().ileri)).toBe(Math.round(760 * 1.58 * 3.10));
    expect(cp._mntTahrikDurumu(bul((n) => n.type === 'mnt-transfer')).d).toBe('eksik');
  });

  test('aynı tork alanı iki gövdede doluysa çözücünün okuduğu söylenir (çakışma)', () => {
    tulga();
    const ikinci = { id: 'gb2', type: 'mnt-gearbox', def: componentDefs['mnt-gearbox'], customName: 'İkinci şanzıman',
      data: { mass: 10, cgx: 0, cgy: 0, cgz: 0, Ixx: 1, Iyy: 1, Izz: 1, g1: 9, Rstall: 2 } };
    global.nodes.push(ikinci);
    const D = cp._mntVitesDurumu(ikinci);
    expect(D.yazi).toBe('çakışma');
    expect(D.neden).toContain('Şanzıman');            // çözücü ilkini okuyor
  });
});

describe('KATEGORİ DURUMU — boş alan çözücüde 0 ya da ret demek', () => {
  test('atalet: geçerli → tamam · hane kayması (14,7 → 147) → fiziksel değil · boş → atalet yok', () => {
    tulga();
    expect(cp._mntKutleDurumu(motor()).d).toBe('ok');
    motor().data.Ixx = '147';
    const D = cp._mntKutleDurumu(motor());
    expect(D.yazi).toBe('fiziksel değil');
    expect(D.neden).toContain('Iyy + Izz < Ixx');
    motor().data.Ixx = ''; motor().data.Iyy = ''; motor().data.Izz = '';
    expect(cp._mntKutleDurumu(motor()).yazi).toBe('atalet yok');
    motor().data.pointMass = true;                    // nokta kütlede tensör sorulmaz
    expect(cp._mntKutleDurumu(motor()).d).toBe('ok');
  });

  test('asal momentler ve eşdeğer kutu çekirdekten (3B görünümle aynı kutu)', () => {
    tulga();
    const A = cp._mntAtalet(motor().data);
    expect(A.asal.map((v) => +v.toFixed(2))).toEqual([14.7, 19.1, 25]);
    expect(A.kutu.map((v) => Math.round(v * 1000))).toEqual([650, 355, 544]);
  });

  test('takoz: eksen takası (TK040 kalıbı) oran yayılımını 1,5 üstüne çıkarır → durum "oran?"', () => {
    tulga();
    const t = onTakoz();
    expect(cp._mntOranYayilim(t.data).yayilim).toBeCloseTo(1.042, 2);
    expect(cp._mntTakozTipDurumu(t).d).toBe('ok');
    const sx = t.data.kxd; t.data.kxd = t.data.kzd; t.data.kzd = sx;     // X ↔ Z dinamik takası
    expect(cp._mntOranYayilim(t.data).yayilim).toBeGreaterThan(cp._MNT_ORAN_YAYILIM_SINIR);
    expect(cp._mntTakozTipDurumu(t).yazi).toBe('oran?');
    expect(cp._mntTakozKonumDurumu(t).d).toBe('ok');                     // takas konumu ilgilendirmez
    t.data.y = '';
    expect(cp._mntTakozKonumDurumu(t).yazi).toBe('konum eksik');
  });

  test('motor: silindir sayısı boş → eksik (Kriter 1 ve 2); dolunca tamam', () => {
    tulga();
    expect(cp._mntMotorDurumu(motor()).neden).toContain('Silindir sayısı boş');
    motor().data.cylinders = 6;
    expect(cp._mntMotorDurumu(motor()).d).toBe('ok');
  });

  test('çözücü ön denetimi: rijitlik ≤ 0 Hesapla\'dan ÖNCE görünür', () => {
    tulga();
    onTakoz().data.kzs = '0';
    const html = cp.getMntSolverPropertiesHTML(cozucu());
    expect(html).toMatch(/id="ve-mnt-results"[^>]*>.*Statik rijitlik ≤ 0: Ön Takoz/);
    expect(cp._mntCozucuDurumlari(cozucu()).dur.yazi).toBe('çözülemez');
  });

  // TİP LİSTESİ = NOTUN EŞLEŞMESİ (kullanıcı turu 2026-10-19: "Örnek modelin
  // takozlarında tip listesi '— elle gir —' gösteriyor; tipin hangisi olduğunu
  // ancak altındaki nottan anlıyorum"). Örneklerin takozları bağsız
  // kaydedilmişti: liste "— elle gir —" derken not tipi adlandırıyor, Takoz
  // Özellikleri'nin Kullanım'ı hiçbirini saymıyordu. Kural, liste değil: her
  // örneğin her takozu.
  test('TİP LİSTESİ: her örnekte her takozun listesi ve Kullanım\'ı notun eşleşmesinden (17 tipli, 11 tipsiz takoz)', () => {
    const dir = path.join(__dirname, '../../assets/examples');
    let tipli = 0, tipsiz = 0, bagli = 0;
    fs.readdirSync(dir).filter((f) => /_topoloji\.json$/.test(f) && !/^ap_/.test(f)).forEach((f) => {
      const T = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      global.nodes = T.nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
      const say = {};
      global.nodes.filter((n) => n.type === 'mnt-mount').forEach((n) => {
        if (n.data.libKey) bagli++;
        const E = cp._mntKutuphaneEslesme(n), bek = E ? E.e.key : '';
        const d = dom(cp._mntTakozTipGovde(n));
        expect([f, n.id, d.querySelector('select').value]).toEqual([f, n.id, bek]);
        if (bek) {
          tipli++; say[bek] = (say[bek] || 0) + 1;
          expect(d.querySelector('[id^="ve-mnt-libnot-"]').textContent).toContain(E.e.name + ' ile 6/6 değer aynı');
        } else tipsiz++;
      });
      cp.veMntGetLibraryList().forEach((e) => {
        const n = dom(cp._mntLibKullanimHTML({ id: 'x' }, e)).querySelectorAll('tbody tr').length;
        expect([f, e.key, n]).toEqual([f, e.key, say[e.key] || 0]);
      });
    });
    expect([tipli, tipsiz, bagli]).toEqual([17, 11, 0]);
  });

  test('TİP LİSTESİ: bağ seçilen tipi gösterir; bağsız takozda bir değer değişince "— elle gir —"', () => {
    tulga();
    const t = onTakoz(), sec = () => dom(cp._mntTakozTipGovde(t)).querySelector('select').value;
    expect(sec()).toBe('TK050');
    t.data.kzs = '300';
    expect(sec()).toBe('');
    t.data.libKey = 'TK050';                                               // bağlı ve değeri sapmış: bağın tipi
    expect(sec()).toBe('TK050');
    t.data.libKey = 'yok-boyle-tip';
    expect(sec()).toBe('');
  });

  test('"— elle gir —" seçimi kütüphane BAĞINI kaldırır, değerlere dokunmaz', () => {
    tulga();
    const t = onTakoz();
    t.data.libKey = 'TK050';
    cp.veMntApplyLib(t.id, '');
    expect(t.data.libKey).toBeUndefined();
    expect(t.data.kzs).toBe('290');
  });
});

describe('KROKİ — güç grubundaki yeri: Görünümler\'in bileşeni, bileşen perdenin üstünde (2026-10-16)', () => {
  // Kullanıcı: "Diğer bileşen pencerelerinin içinde de 'Güç grubundaki yeri'
  // kısmında aksonometrik görünümün görünmesini istiyorum." İkinci tur: "o 3B
  // olmamış. Aynı 'Görünümler' bileşenindeki gibi olacak. Bileşene göre parçayı
  // belirgin gösterecek." Kroki Görünümler'in serbest kameralı bileşeni (başlık,
  // görünüm düğmeleri, sürükle-döndür, tam ekran; açı ortak), canlı modelden,
  // çözümsüz; bu bileşen perdenin ÜSTÜNDE (aydınlık), kalan model altında.
  // Önce: sabit dimetrik, etkileşimsiz, yalnız bileşenin adı.
  const yazilar = (svg) => [...svg.querySelectorAll('text')].map((t) => t.textContent)
    .filter((t) => !/^(X arka|Y sağ|Z)$/.test(t)).sort();
  const kroki = (node, M) => dom(cp._mntKrokiHTML(node, M || cp._mntCanliModel())).querySelector('.ve-mnt-yer');
  const akSet = (els) => new Set(els.flatMap((e) => [...(e.matches && e.matches('[data-ak]') ? [e] : []), ...e.querySelectorAll('[data-ak]')])
    .map((x) => x.getAttribute('data-ak')));
  afterEach(() => { cp.veMntAksoAyar('yok', 'sifirla'); });

  test('Görünümler\'in bileşeni: başlık, dört görünüm düğmesi, tam ekran bileşenle açılır; açı Görünümler\'le ORTAK', () => {
    tulga();
    const k = kroki(motor()), kap = k.querySelector('.ve-mnt-akso-kap');
    expect(kap.getAttribute('data-sec')).toBe(String(motor().id));
    expect(kap.getAttribute('data-w')).toBe('296');              // hep aynı genişlik (tazeleme kuralı)
    expect(k.querySelector('.ve-mnt-akso3b svg.ve-mnt2d-akso[tabindex="0"]')).not.toBeNull();
    const dg = [...k.querySelectorAll('.ve-mnt2d-zoomctl button')];
    expect(dg.map((b) => b.getAttribute('aria-label'))).toEqual(['Yakınlaştır', 'Uzaklaştır', 'Sıfırla — dimetrik bakış', 'Tam ekran']);
    expect(dg[3].getAttribute('onclick')).toBe("veMntAkso3BTamEkran('" + motor().id + "')");
    expect(k.querySelector('[data-ak3b-ad]').textContent).toBe('Dimetrik');
    const once = k.querySelector('svg').outerHTML;
    cp.VE_MNT_AKSO3B.az = 200; cp.VE_MNT_AKSO3B.el = 30;           // Görünümler'de döndürüldü
    const sonra = kroki(motor());
    expect(sonra.querySelector('svg').outerHTML).not.toBe(once);
    expect(sonra.querySelector('[data-ak3b-ad]').textContent).toBe('Serbest bakış');
  });

  test('bu gövde perdenin ÜSTÜNDE, adıyla; öteki gövdeler, takozlar, G ve yazıları perdenin ALTINDA', () => {
    tulga();
    const m = cp._mntAksoModel(), k = m.govde.find((g) => g.id === motor().id).k;
    const svg = kroki(motor()).querySelector('svg.ve-mnt2d-akso'), kids = [...svg.children];
    const perde = svg.querySelector(':scope > rect.ve-ak-perde'), odak = svg.querySelector(':scope > g.ve-ak-odak');
    expect(perde).not.toBeNull();
    expect(kids.indexOf(odak)).toBe(kids.indexOf(perde) + 1);
    expect(kids.indexOf(odak)).toBe(kids.length - 1);             // en üstte
    expect(akSet([odak])).toEqual(new Set([k]));
    expect(odak.querySelector('.ve-ak-g[data-sec]')).not.toBeNull();
    expect(odak.querySelector('.ve-ak-cip.sec-cip').textContent).toBe('Motor');
    const alt = akSet(kids.slice(0, kids.indexOf(perde)));
    m.takoz.forEach((t) => expect(alt.has(t.k)).toBe(true));
    m.govde.filter((g) => g.k !== k).forEach((g) => expect(alt.has(g.k)).toBe(true));
    expect(alt.has('G')).toBe(true);
    // Görünümler'in yazıları: öteki ana gövdeler adıyla, takozlar numarasıyla
    expect(yazilar(svg)).toEqual(expect.arrayContaining(['Şanzıman', 'Transfer Kutusu', 'T1', 'T2', 'T3', 'T4', 'T5', 'G', 'Motor']));
    expect(svg.getAttribute('aria-label')).toBe('Güç grubundaki yeri: Motor');
  });

  test('takoz ve nokta kütle: halka perdenin üstünde, işaretten sonra — önündeki bir küpün altında kalmaz', () => {
    tulga();
    const M = cp._mntCanliModel();
    const t = kroki(onTakoz(), M).querySelector('svg.ve-mnt2d-akso .ve-ak-odak');
    expect(t.querySelector('.ve-ak-t[data-sec]')).not.toBeNull();
    expect(t.querySelector('.ve-ak-cip.sec-cip').textContent).toBe('T1 Ön Takoz');
    // Tulga'nın arka braketi (nokta kütle) T3 küpünün arkasında
    const braket = bul((n) => n.type === 'mnt-bracket' && n.data.pointMass && Number(n.data.cgx) > 1300 && Number(n.data.cgy) > 0);
    const b = kroki(braket, M).querySelector('svg.ve-mnt2d-akso .ve-ak-odak');
    const sira = [...b.children].map((e) => e.getAttribute('class'));
    expect(sira.indexOf('ve-ak-sec-hale')).toBeGreaterThan(sira.indexOf('ve-ak-nokta'));
    expect(b.querySelector('.ve-ak-nokta[data-sec]')).not.toBeNull();
  });

  test('çözüm krokiye girmez: çözümden sonra ve model bayatken kroki birebir aynı', () => {
    tulga();
    const ciz = () => cp._mntKrokiHTML(onTakoz(), cp._mntCanliModel());
    const once = ciz();
    coz();
    expect(ciz()).toBe(once);
    expect(once).not.toMatch(/Statik yük|sehim/);
  });

  test('yerinde tazeleme krokiyi YENİDEN YAZMAZ: kroki hep aynı genişlikte kurulur, bırakınca kurulum dış HTML\'i değiştirmez', () => {
    tulga();
    const m = motor();
    document.body.innerHTML = '<div class="ve-properties-content">' + cp.getMntMassPropertiesHTML(m) + '</div>';
    const bolum = document.getElementById('ve-mnt-kroki-' + m.id), once = bolum.outerHTML;
    expect(cp._mntAksoKur('ve-mnt-yer-' + m.id)).toBe(true);     // sürükle bırak · düğme · tam ekrandan dönüş
    expect(document.getElementById('ve-mnt-kroki-' + m.id).outerHTML).toBe(once);
    cp.veMntPencereTazele();
    expect(document.getElementById('ve-mnt-kroki-' + m.id)).toBe(bolum);
  });

  test('model boşsa kroki çizmez, söyler', () => {
    global.nodes = [];
    const h = cp._mntKrokiHTML({ id: 'x', type: 'mnt-motor', data: {} }, cp._mntCanliModel());
    expect(h).toContain('Modelde gövde ya da takoz yok');
  });
});

describe('YERİNDE TAZELEME — pencere kurulmaz, odak kalır', () => {
  function ac(node) {
    document.body.innerHTML = '<div class="ve-properties-content">' + cp.getMntMassPropertiesHTML(node) + '</div>';
  }
  test('kütle değişince TOPLAM PAYI tazelenir; odaktaki girdi AYNI eleman ve değeri yerinde', () => {
    tulga();
    const m = motor();
    ac(m);
    const girdi = document.getElementById('ve-mnt-mass-' + m.id);
    girdi.focus();
    girdi.value = '500';
    m.data.mass = '500';
    const n = cp.veMntPencereTazele();
    expect(n).toBeGreaterThan(0);
    expect(document.getElementById('ve-mnt-mass-' + m.id)).toBe(girdi);   // yeniden kurulmadı
    expect(document.activeElement).toBe(girdi);
    expect(girdi.value).toBe('500');
    const toplam = global.nodes.filter((x) => x.def && x.def.isMountBody).reduce((t, x) => t + Number(x.data.mass || 0), 0);
    expect(document.getElementById('ve-mnt-pay-' + m.id).value)
      .toBe('%' + veSayi(500 / toplam * 100, 1, { eksi: '−' }) + ' · ' + veSayi(toplam, 1, { eksi: '−' }) + ' kg içinde');
  });

  test('silindir girilince kategori durumu "tamam"a döner ve eksik bandı kalkar', () => {
    tulga();
    const m = motor();
    ac(m);
    const kat = document.querySelector('#ve-fp-panes-' + m.id + ' > .ve-fp-kat[data-k="motor"]');
    expect(kat.getAttribute('data-d')).toBe('eksik');
    expect(document.getElementById('ve-fp-eksik-' + m.id)).not.toBeNull();
    m.data.cylinders = '6';
    cp.veMntPencereTazele();
    expect(document.querySelector('#ve-fp-panes-' + m.id + ' > .ve-fp-kat[data-k="motor"]')).toBe(kat);   // kurulmadı
    expect(kat.getAttribute('data-d')).toBe('ok');
    expect(document.getElementById('ve-fp-eksik-' + m.id)).toBeNull();
    m.data.cylinders = '';                                              // geri boşaltılınca bant geri gelir
    cp.veMntPencereTazele();
    expect(kat.getAttribute('data-d')).toBe('eksik');
    expect(document.getElementById('ve-fp-eksik-' + m.id).nextElementSibling.id).toBe('ve-fp-panes-' + m.id);
  });

  // Rapor penceresinin İÇERİK bölümü ve cevap kutusu raporun HAZIRLIĞIdır
  // (hangi çözümden üretilecek) ve yerinde tazelenir — kimliksiz kalsalar
  // pencere açıkken gelen çözüm cevap kutusunu "çözüldü"ye çevirir ama İçerik
  // "Hesaplanmadı" der. GİRDİLER canlı modelden (2026-10-16): çözümle değişmez.
  test('Rapor açıkken çözüm gelir: cevap kutusu ve İçerik AYNI çözümü söyler; Girdiler canlı modelden', () => {
    tulga();
    const r = bul((n) => n.type === 'mnt-report');
    document.body.innerHTML = '<div class="ve-properties-content">' + cp.getMntReportPropertiesHTML(r) + '</div>';
    const ic = () => document.getElementById('ve-mnt-rap-ic-' + r.id).textContent;
    const gir = () => document.getElementById('ve-mnt-rap-gir-' + r.id).outerHTML;
    expect(ic()).toContain('Hesaplanmadı');
    const girOnce = gir();
    expect(girOnce).toContain('varsayılan');                     // Tulga'nın çözücüsünde ζ girilmemiş
    coz();
    expect(cp.veMntPencereTazele()).toBeGreaterThan(0);
    expect(document.getElementById('ve-mnt-rap-coz-' + r.id).textContent).toContain('Model çözüldü');
    expect(ic()).not.toContain('Hesaplanmadı');
    const yuk = document.querySelector('#ve-mnt-rap-ic-' + r.id + ' input[value="' + global._veMntLast.allCases.length + '"]');
    expect(yuk).not.toBeNull();
    expect(gir()).toBe(girOnce);
    // Çözümden SONRA girdi değişir: pencere canlı değeri gösterir, çözümünkini
    // değil (çözümden okusaydı ζ 0,02 ve rölanti 800 kalırdı — aynı modelde
    // iki okuma ayırt edilemez, ayrım ancak burada görünür).
    cozucu().data.zeta = 0.05;
    motor().data.idleRpm = 650;
    cp.veMntPencereTazele();
    expect(gir()).toContain('<td>0,05</td><td class="sol">Çözücü</td>');
    expect(gir()).toContain('<td>Rölanti devri</td><td>650 d/dk</td><td class="sol">Motor</td>');
  });

  test('saveState kancası pencereyi tazeler (girdi değişti olayının tek kaynağı)', () => {
    const state = fs.readFileSync(path.join(__dirname, '../../js/state.js'), 'utf8');
    const govde = state.slice(state.indexOf('function saveState()'), state.indexOf('function _veStateKopya'));
    expect(govde).toMatch(/veMntPencereTazele\(\)/);
  });
});

describe('PENCERE DİLİ — görünüm CSS\'te, durum işareti tek sözleşmede', () => {
  test('satır içi stil yalnız VERİ taşır (sütun sayısı, sütun genişliği) — renk/kenar yok', () => {
    tulga(); coz();
    const html = [cp.getMntMassPropertiesHTML(motor()), cp.getMntMountPropertiesHTML(onTakoz()),
                  cp.getMntSolverPropertiesHTML(cozucu())].join('');
    const stiller = [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
    expect(stiller.length).toBeGreaterThan(10);
    stiller.forEach((st) => expect(st).toMatch(/^(--fp-k:\d+;|width:\d+%)$/));
  });

  // Kroki 2026-10-16'dan beri aksonometrinin çizicisi: yazının hâlesi
  // çizimin ZEMİNİNİN rengi (`.ve-ak-zem`), çizgiler yazının altından geçer.
  test('krokinin yazıları çizimin zemininin renginde hâle taşır', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
    const zem = /\.ve-ak-zem\{\s*fill:var\((--[a-z-]+)\);\s*\}/.exec(css);
    const hale = /\.ve-ak-yz, \.ve-ak-cvy, \.ve-ak-cvad\{([^}]*)\}/.exec(css);
    expect(zem && hale).toBeTruthy();
    expect(hale[1]).toMatch(/paint-order:stroke/);
    expect(hale[1]).toContain('stroke:var(' + zem[1] + ')');
    expect(css).not.toMatch(/\.ve-mk-[a-z]+[ ,{]/);                  // eski 2B krokinin kuralları gitti
  });

  test('FEAD\'in DOM sözleşmesi: tek gövde, kategoriler alt alta — şerit ve gizli kategori yok', () => {
    tulga();
    const html = cp.getMntMountPropertiesHTML(onTakoz());
    const id = onTakoz().id;
    expect(html).toContain('id="ve-fp-panes-' + id + '"');
    expect(html).not.toContain('ve-fp-tabs');
    expect(html).not.toMatch(/role="tabpanel"|\shidden[\s>]/);
    expect(html).toMatch(/<div class="ve-fp-kat" data-k="konum" data-d="ok" tabindex="-1" aria-label="Konum">/);
  });

  // İlerleme 2026-10-18'den beri eylem satırının çubuğunda (pencere kiti);
  // eskiden düğmenin içinde bir dolguydu — kompakt düğmede eni değişirdi.
  test('Hesapla ilerlemesi eylem satırının çubuğunda; düğme meşgul ve yazısı aynı; bitince satır bırakılır', () => {
    const PK = require('../../js/pencere-kabuk.js');
    global.vePencereIlerleme = PK.vePencereIlerleme;
    global.vePencereIlerlemeHTML = PK.vePencereIlerlemeHTML;
    document.body.innerHTML = PK.vePencereEylem('<button class="ve-fp-solve" id="b">Hesapla</button>', '<div class="ve-fp-solve-not">not</div>');
    const b = document.getElementById('b');
    cp._mntHesaplaIlerleme(b, 3, 12, 'Frenleme');
    expect(b.getAttribute('aria-busy')).toBe('true');
    expect(b.textContent).toBe('Hesapla');
    const il = document.querySelector('.ve-fp-yurut[data-is] .ve-fp-ilerleme');
    expect(il.getAttribute('aria-valuenow')).toBe('25');
    expect(il.querySelector('.ve-fp-ilerleme-y span').textContent).toBe('3 / 12 · Frenleme');
    cp._mntHesaplaIlerleme(b, 0, 0, null);
    expect(b.hasAttribute('aria-busy')).toBe(false);
    expect(document.querySelector('.ve-fp-ilerleme')).toBeNull();
    expect(document.querySelector('.ve-fp-yurut').hasAttribute('data-is')).toBe(false);
  });
});
