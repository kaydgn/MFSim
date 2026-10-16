/**
 * mount-pencere.test.js — TAKOZ PENCERELERİ: FEAD KABUĞU + FÖY (2026-10-14)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı seçimi (tasarım tuvali): "Hepsi için B föy seçeneği" + C'nin
 * "Güç grubundaki yeri" krokisi. Pencereler artık son çözümün sayılarını ve
 * girdiden TÜRETİLEN değerleri taşıyor; bu yüzden sessiz hata sınıfı da
 * pencereye taşındı. Bu dosya o sınıfın kapılarıdır:
 *
 *   · SONUÇ İMZASI — model hesaptan sonra değişince sonuç "bayat" görünür;
 *     yazım farkı ve ad değişikliği bayatlatmaz.
 *   · KİMLİKLE EŞLEME — takozun sonucu R.mounts'ta SIRAYLA değil KİMLİKLE bulunur.
 *   · TEK KAYNAK — pencerenin uygunluğu raporun satırları (veMntUygunluk),
 *     CG farkı çekirdeğin combineMassProps'u, mil torku çözücünün tork durumu.
 *   · ÇÖZÜCÜNÜN BOŞ ALAN KURALI — boş alan pencerede de 0'dır ve sekme
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

const TULGA = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples/tulga_topoloji.json'), 'utf8'));
function tulga() {
  global.nodes = JSON.parse(JSON.stringify(TULGA.nodes)).map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  return global.nodes;
}
const bul = (f) => global.nodes.find(f);
const cozucu = () => bul((n) => n.type === 'mnt-solver');
const onTakoz = () => bul((n) => n.customName === 'Ön Takoz');
const motor = () => bul((n) => n.type === 'mnt-motor');
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

describe('KİMLİKLE EŞLEME — takozun sonucu sırayla değil kimlikle', () => {
  test('R.mounts düğüm kimliğini taşır ve düğüm sırası değişse de doğru satır bulunur', () => {
    tulga();
    const R = coz();
    expect(R.mounts.map((m) => m.id)).toEqual(global.nodes.filter((n) => n.type === 'mnt-mount').map((n) => n.id));
    const id = onTakoz().id;
    global.nodes.reverse();                           // sıra değişti
    const T = cp._mntTakozSonucu(id);
    expect(T.R.mounts[T.j].id).toBe(id);
    expect(T.R.mounts[T.j].name).toBe('Ön Takoz');
  });

  test('pencerenin statik sehim hücresi O takozun statik durumundan', () => {
    tulga();
    const R = coz();
    const j = R.mounts.findIndex((m) => m.name === 'Ön Takoz');
    const st = R.allCases.find((c) => c.name === 'Static').res.perMount[j];
    const html = cp.getMntMountPropertiesHTML(onTakoz());
    const hucre = html.match(/id="ve-mnt-tstat-2-[^"]+" data-tazele[^>]*>([^<]+)</)[1];
    expect(hucre).toBe(veSayi(st.delta[2] * 1000, 2, { eksi: '−' }));
    expect(hucre).toBe('−6,80');                      // TULGA referansı
  });

  test('son çözümde OLMAYAN takoz "hesaplanmadı" der — başka takozun sayısını göstermez', () => {
    tulga(); coz();
    const yeni = { id: 'yeni-takoz', type: 'mnt-mount', def: componentDefs['mnt-mount'], customName: 'Yeni',
      data: { x: 0, y: 0, z: 0, kxs: 100, kys: 100, kzs: 100, kxd: 150, kyd: 150, kzd: 150 } };
    global.nodes.push(yeni);
    expect(cp._mntTakozSonucu('yeni-takoz').R).toBeNull();
    expect(cp._mntTakozYukDurumu(cp._mntTakozSonucu('yeni-takoz')).yazi).toBe('hesaplanmadı');
  });
});

describe('TEK KAYNAK — pencere raporun ve çekirdeğin sayısını okur', () => {
  test('Uygunluk satırları raporun veMntUygunluk satırlarıyla BİREBİR', () => {
    tulga();
    const R = coz();
    const U = rep.veMntUygunluk(R, rep.veMntRaporOpts());
    const html = cp._mntUygunlukHTML('x', cp.veMntSonucDurumu());
    U.satirlar.forEach((r) => {
      const m = html.match(new RegExp('data-d="(\\w+)"[^>]*><i></i>' + r.kisa + ' <small class="ve-mnt-kno">K' + r.no + '<'));
      expect(m && m[1]).toBe(r.st);
    });
    expect(U.satirlar.map((r) => r.st)).toEqual(['wait', 'ok', 'no', 'wait', 'ok', 'ok']);  // TULGA
  });

  test('eski projenin Rapor düğümündeki silindir sayısı İKİ yüzeyde de görülür', () => {
    tulga();
    bul((n) => n.type === 'mnt-report').data = { cylinders: 6 };   // yedek girdi
    motor().data.cylinders = '';
    const R = coz();
    const U = rep.veMntUygunluk(R, rep.veMntRaporOpts());
    expect(U.satirlar[0].st).not.toBe('wait');        // rapor yedeği görüyor
    const html = cp._mntUygunlukHTML('x', cp.veMntSonucDurumu());
    expect(html).toContain('data-d="' + U.satirlar[0].st + '"');
    expect(html).not.toMatch(/Modal bant <small class="ve-mnt-kno">K1<\/small><span>değerlendirilemedi/);
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
    // Boş Y: pencere de 0 alır ve sekme bunu söyler
    motor().data.cgy = '';
    expect(cp._mntKutleDurumu(motor()).yazi).toBe('CG eksik');
  });

  test('mil torku çözücünün ileri tork durumundan (T = −T_x) — ayrı çarpım yok', () => {
    tulga();
    const Z = cp._mntTorkZinciri();
    const fwd = cp._mntToSI(cp._mntGatherForSolver(), 9.81).loadCases.find((c) => c.name === 'Forward Torque');
    expect(Z.ileri).toBeCloseTo(-fwd.T[0], 9);
    expect(Math.round(Z.ileri)).toBe(12761);          // 760 · 1,58 · 3,10 · 3,428
    // Boş transfer oranı çözücüde 1'dir: zincir onu kullanır, Transfer sekmesi eksik der
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

describe('SEKME DURUMU — boş alan çözücüde 0 ya da ret demek', () => {
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

  test('takoz: eksen takası (TK040 kalıbı) oran yayılımını 1,5 üstüne çıkarır → sekme "oran?"', () => {
    tulga();
    const t = onTakoz();
    expect(cp._mntOranYayilim(t.data).yayilim).toBeCloseTo(1.042, 2);
    expect(cp._mntTakozYerDurumu(t).d).toBe('ok');
    const sx = t.data.kxd; t.data.kxd = t.data.kzd; t.data.kzd = sx;     // X ↔ Z dinamik takası
    expect(cp._mntOranYayilim(t.data).yayilim).toBeGreaterThan(cp._MNT_ORAN_YAYILIM_SINIR);
    expect(cp._mntTakozYerDurumu(t).yazi).toBe('oran?');
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
    expect(cp._mntCozucuDurumlari(cozucu(), null, { durum: 'yok', R: null }).dur.yazi).toBe('çözülemez');
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

describe('KROKİ — güç grubundaki yeri', () => {
  test('seçili bileşen halkayla, birleşik CG ve kol uzunluğu lejantta', () => {
    tulga();
    const M = cp._mntCanliModel();
    const h = cp._mntKrokiHTML(motor(), 'govde', M, null);
    expect(h).toContain('class="ve-mk-sec"');
    expect(h).toContain('class="ve-mk-am"');
    expect(h).toContain('kol 475 mm');
    expect(h).toContain('(125; 0; 550) mm');
  });

  test('takozun sehim oku yalnız GÜNCEL çözümde ve yandan görünüşte', () => {
    tulga(); coz();
    cp.VE_MNT_KROKI_GOR.takoz = 'yan';
    const ciz = () => cp._mntKrokiHTML(onTakoz(), 'takoz', cp._mntCanliModel(), cp._mntTakozSonucu(onTakoz().id));
    expect(ciz()).toContain('δz −6,80 mm (×10)');
    expect(ciz()).toContain('class="ve-mk-ok"');
    onTakoz().data.kxs = '700';                       // bayat
    expect(ciz()).not.toContain('class="ve-mk-ok"');
    onTakoz().data.kxs = '665';
    cp.VE_MNT_KROKI_GOR.takoz = 'ust';
    expect(ciz()).not.toContain('class="ve-mk-ok"');
    cp.VE_MNT_KROKI_GOR.takoz = 'yan';
  });

  test('model boşsa kroki çizmez, söyler', () => {
    global.nodes = [];
    const h = cp._mntKrokiHTML({ id: 'x', type: 'mnt-motor', data: {} }, 'govde', cp._mntCanliModel(), null);
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

  test('silindir girilince sekme durumu "tamam"a döner ve eksik bandı kalkar', () => {
    tulga();
    const m = motor();
    ac(m);
    expect(document.getElementById('ve-fp-eksik-' + m.id)).not.toBeNull();
    m.data.cylinders = '6';
    cp.veMntPencereTazele();
    const sekme = document.querySelector('#ve-fp-tabs-' + m.id + ' .ve-fp-tab[data-k="motor"]');
    expect(sekme.getAttribute('data-d')).toBe('ok');
    expect(document.getElementById('ve-fp-eksik-' + m.id)).toBeNull();
  });

  // Rapor penceresinin İÇERİK ve GİRDİLER bölümleri çözümden okur (2026-10-16:
  // iki kategoriye ayrıldı). Kimliksiz kalsalar pencere açıkken gelen çözüm
  // cevap kutusunu "çözüldü"ye çevirir ama İçerik "Hesaplanmadı" der — sessiz.
  test('Rapor açıkken çözüm gelir: cevap kutusu, İçerik ve Girdiler AYNI çözümü söyler', () => {
    tulga();
    const r = bul((n) => n.type === 'mnt-report');
    document.body.innerHTML = '<div class="ve-properties-content">' + cp.getMntReportPropertiesHTML(r) + '</div>';
    const ic = () => document.getElementById('ve-mnt-rap-ic-' + r.id).textContent;
    expect(ic()).toContain('Hesaplanmadı');
    coz();
    expect(cp.veMntPencereTazele()).toBeGreaterThan(0);
    expect(document.getElementById('ve-mnt-rap-coz-' + r.id).textContent).toContain('Model çözüldü');
    expect(ic()).not.toContain('Hesaplanmadı');
    const yuk = document.querySelector('#ve-mnt-rap-ic-' + r.id + ' input[value="' + global._veMntLast.allCases.length + '"]');
    expect(yuk).not.toBeNull();
    // ζ'nin kaynağı çözümden gelir: çözülmeden "varsayılan" ya da Rapor (eski)
    expect(document.getElementById('ve-mnt-rap-gir-' + r.id).textContent).toContain('Çözücü');
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

  // Bileşenden birleşik CG'ye uzanan kol ve ızgara yazının altından geçiyordu
  // (gerçek tarayıcı: "Ön Takoz" ve konum yazısı kolun üstünde). Hâle zeminin
  // rengi: krokinin kabı --bg-primary.
  test('krokinin yazıları zeminin renginde hâle taşır', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
    const kap = /\.ve-mnt-kroki\{([^}]*)\}/.exec(css);
    expect(kap[1]).toMatch(/background:var\(--bg-primary\)/);
    const hale = /\.ve-mk-y, \.ve-mk-yh, \.ve-mk-ym\{([^}]*)\}/.exec(css);
    expect(hale).not.toBeNull();
    expect(hale[1]).toMatch(/paint-order:stroke/);
    expect(hale[1]).toMatch(/stroke:var\(--bg-primary\)/);
  });

  test('FEAD\'in sekme DOM sözleşmesi: şerit ve gövde kimlikleri, gizli sekme `hidden`', () => {
    tulga();
    const html = cp.getMntMountPropertiesHTML(onTakoz());
    const id = onTakoz().id;
    expect(html).toContain('id="ve-fp-tabs-' + id + '"');
    expect(html).toContain('id="ve-fp-panes-' + id + '"');
    expect(html).toMatch(/<div data-k="yuk" role="tabpanel" hidden>/);
  });

  test('Hesapla ilerlemesi düğmenin içinde; bitince düğme bırakılır', () => {
    document.body.innerHTML = '<button id="b"></button>';
    const b = document.getElementById('b');
    cp._mntHesaplaIlerleme(b, 3, 12, 'Frenleme');
    expect(b.getAttribute('aria-busy')).toBe('true');
    expect(b.style.getPropertyValue('--ilerleme')).toBe('25%');
    expect(b.textContent).toContain('Çözülüyor · 3 / 12');
    cp._mntHesaplaIlerleme(b, 0, 0, null);
    expect(b.hasAttribute('aria-busy')).toBe(false);
    expect(b.textContent).toContain('Hesapla');
  });
});
