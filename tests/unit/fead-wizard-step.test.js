/**
 * fead-wizard-step.test.js — SİHİRBAZDA "STEP'TEN BAŞLA"
 * (js/cp-fead-wizard.js kartı + js/step-p21.js bayt → metin)
 *
 * Zincir: dosya baytları → veStepP21Metin (düz · gzip · zip) → veFeadStpOku
 * (tanıyıcı) → kullanıcının rol ve bakış onayı → veFeadStpKayit (örnek kaydı)
 * → _fwSeedKayit (ÖRNEK TOHUMUNUN AYNI YOLU) → veFeadWizNodes → köprü.
 *
 * Kapıların kilitlediği şeyler, her biri sessiz bir sınıfa karşı:
 *   · GİDİŞ-DÖNÜŞ (kural 20): kayıttaki her alan düğümde birebir — bir yöne
 *     eklenip ötekine eklenmeyen alan, sihirbazdan kurulan modelde sessizce yok olur
 *   · KAYIŞA DOKUNULMAZ (kullanıcı kararı): STEP kaydı kayış taşımıyor; eskiden
 *     `ex.belt || {}` profili ve kanal sayısını SİLERDİ
 *   · TEK KRANK, TEK GERGİ: ikinci gergi ötekinin üstüne yazılırdı
 *   · SIRA BİR VARSAYIM: dosya kayışın sırasını taşımıyor; uyarı kullanıcı sırayı
 *     değiştirene ya da onaylayana kadar Kasnaklar adımında
 *   · STEP ↔ KÜNYE: künye gerginin parça alanlarını yazar; CAD'deki parça başka
 *     ise fark adıyla söylenir
 * En değerli kapı: Gates AG00686 düzeni STEP dosyası olarak sihirbazdan geçiyor
 * ve köprü raporun açıklık boylarını ve sarımlarını veriyor.
 */
const zlib = require('zlib');
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const P = require('../../js/step-p21.js');
const S = require('../../js/fead-step.js');
const O = require('../helpers/step-ornek.js');
const Y = require('../helpers/step-yaz.js');

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
const DUTY = require('../../js/fead-duty.js');
const BELTS = require('../../js/fead-belts.js');
const TENS = require('../../js/fead-tensioners.js');
const E = require('../../js/fead-engines.js');
const A = require('../../js/fead-accessories.js');
const K = require('../../js/fead-checks.js');
[DUTY, BELTS, TENS, E, A, K, P, S].forEach((m) => {
  Object.keys(m).forEach((k) => { global[k] = m[k]; });
});
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
});

const kabuk = () => {
  document.body.innerHTML = '<div id="ve-canvas"></div>'
    + '<div id="ve-feadwiz-overlay" style="display:none;">'
    + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
};
const AG_METIN = O.ag00686Step();
const TIP_AD = { 'fead-crank': 'CRK', 'fead-idler': 'IDR', 'fead-ac': 'A_C', 'fead-tensioner': 'TEN' };
// KULLANICININ SEÇİMİ, testte açık bir eşlemeyle: düğüm ADINA göre rol.
// Program adlardan rol ÖNERMEZ (kullanıcı kararı 2026-09-26) — bu eşleme testin.
const ROL = [[/GERG/, 'fead-tensioner'], [/KRANK/, 'fead-crank'], [/KL[İI]MA/, 'fead-ac'], [/AVARA/, 'fead-idler']];
const dugum = (re) => wiz.veFeadWizStp().sonuc.agac.findIndex((d) => re.test(d.ad));
const rolVer = (kural = ROL) => kural.forEach(([re, tip]) => {
  const i = dugum(re);
  if (i >= 0) wiz.veFeadWizStpRol(i, tip);
});
const oku = (metin, ad) => { kabuk(); wiz.veFeadWizReset(); return wiz.veFeadWizStpOku(metin || AG_METIN, ad || 'AG00686.stp'); };
// Kullanıcının akışı: dosya → rolleri ver → "Hesapla"
const hazirla = (kural) => { oku(); rolVer(kural); return wiz.veFeadWizStpHesapla(); };
const yayGir = () => { Object.keys(O.AG_REF.yay).forEach((k) => wiz.veFeadWizTenSet(k, O.AG_REF.yay[k])); };
const kayitDugumleri = (kayit) => {
  const d = kayit.pulleys.map((p) => ({ id: 'st-' + p.key, type: p.type, customName: TIP_AD[p.type],
    def: componentDefs[p.type], data: Object.assign({}, O.AG_REF.yay, JSON.parse(JSON.stringify(p.data))) }));
  kayit.route.forEach((k, i) => { d.find((n) => n.id === 'st-' + k).data.beltIndex = i + 1; });
  d.push({ id: 'b', type: 'fead-belt', def: componentDefs['fead-belt'], data: { profile: 'PK', brand: 'GATES', ribs: 8, beltDataMode: 'none' } });
  d.push({ id: 's', type: 'fead-solver', def: componentDefs['fead-solver'], data: { ratioMode: 'derive' } });
  return d;
};

// ── Sıkıştırılmış kaplar (CATIA .stpZ) ──────────────────────────────────
// gzip BAŞLIK ALANLARIYLA: ad (FNAME), yorum (FCOMMENT), ek alan (FEXTRA) ve
// başlık sağlaması (FHCRC) — açıcının atlaması gereken dört değişken uzunluklu
// parça. zlib.gzipSync bunların hiçbirini yazmıyor, yani yalnız onunla sınamak
// başlık okuyucusunu hiç sınamamak olurdu.
function gzipBaslikli(veri) {
  const ek = Buffer.from([0x41, 0x42, 2, 0, 0x01, 0x02]);
  const xlen = Buffer.alloc(2); xlen.writeUInt16LE(ek.length, 0);
  return Buffer.concat([
    Buffer.from([0x1f, 0x8b, 8, 4 | 8 | 16 | 2, 0, 0, 0, 0, 0, 3]), xlen, ek,
    Buffer.from('PROGRAMLIK GEOMETRI.stp\0', 'latin1'), Buffer.from('CATIA V5\0', 'latin1'),
    Buffer.from([0, 0]), zlib.deflateRawSync(veri), Buffer.alloc(8),
  ]);
}
function zipYap(girisler) {
  const yerel = [], merkez = [];
  let ofs = 0;
  for (const g of girisler) {
    const ad = Buffer.from(g.ad, 'utf8');
    const veri = g.yontem === 0 ? g.veri : zlib.deflateRawSync(g.veri);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(g.yontem, 8);
    lh.writeUInt32LE(veri.length, 18); lh.writeUInt32LE(g.veri.length, 22); lh.writeUInt16LE(ad.length, 26);
    yerel.push(lh, ad, veri);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(g.yontem, 10);
    ch.writeUInt32LE(veri.length, 20); ch.writeUInt32LE(g.veri.length, 24); ch.writeUInt16LE(ad.length, 28);
    ch.writeUInt32LE(ofs, 42);
    merkez.push(ch, ad);
    ofs += 30 + ad.length + veri.length;
  }
  const cd = Buffer.concat(merkez);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(girisler.length, 8); eocd.writeUInt16LE(girisler.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(ofs, 16);
  return Buffer.concat([...yerel, cd, eocd]);
}

// ═════════════════════════════════════════════════════════════════════════
describe('okuyucu: bayt → metin (.stp · .stpZ)', () => {
  const bayt = Buffer.from(AG_METIN, 'latin1');

  test('düz dosya birebir; kap "duz"', () => {
    const r = P.veStepP21Metin(new Uint8Array(bayt));
    expect(r.kap).toBe('duz');
    expect(r.metin).toBe(AG_METIN);
  });

  test('gzip — zlib çıktısı ve BAŞLIK ALANLI gzip aynı metni veriyor', () => {
    const a = P.veStepP21Metin(new Uint8Array(zlib.gzipSync(bayt)));
    const b = P.veStepP21Metin(new Uint8Array(gzipBaslikli(bayt)));
    expect(a).toEqual({ metin: AG_METIN, kap: 'gzip' });
    expect(b).toEqual({ metin: AG_METIN, kap: 'gzip' });
  });

  test('zip — dizin ve STEP olmayan giriş atlanır, .stp girişi seçilir', () => {
    const z = zipYap([
      { ad: 'OKUBENI.txt', veri: Buffer.from('ISO-10303-21 değil'), yontem: 0 },
      { ad: 'alt/', veri: Buffer.alloc(0), yontem: 0 },
      { ad: 'alt/PROGRAMLIK.STP', veri: bayt, yontem: 8 },
    ]);
    const r = P.veStepP21Metin(new Uint8Array(z));
    expect(r.kap).toBe('zip');
    expect(r.icerik).toBe('alt/PROGRAMLIK.STP');
    expect(r.metin).toBe(AG_METIN);
  });

  test('ham bayt: geçerli UTF-8 UTF-8 okunur, değilse ISO 8859-1', () => {
    const u = P.veStepP21Metin(Buffer.from("ISO-10303-21; 'KAYIŞ Ø147 ⌀'", 'utf8')).metin;
    const l = P.veStepP21Metin(Buffer.from("ISO-10303-21; 'KRANK \xD8147 \xE7'", 'latin1')).metin;
    expect(u).toBe("ISO-10303-21; 'KAYIŞ Ø147 ⌀'");
    expect(l).toBe("ISO-10303-21; 'KRANK Ø147 ç'");
  });

  test('bozuk gzip ADRESLİ hata atar, boş metin dönmez', () => {
    const z = zlib.gzipSync(bayt);
    expect(() => P.veStepP21Metin(new Uint8Array(z.subarray(0, 40)))).toThrow(/deflate|gzip/);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('STEP kartı: okuma rol ÖNERMEZ, hesap bir DÜĞMEDİR', () => {
  // Kullanıcı (2026-09-26): *"parçaları manuel olarak seçeceğiz, ardından bir
  // buton gibi bir şeye tıkladığımızda otomatik olarak çaplar, merkez
  // koordinatlar falan hesaplanacak ve … bir kanvas çizilecek."*
  test('okuma rol önermez, hesaplamaz; rol verilene kadar hesap düğmesi kapalı', () => {
    const s = oku();
    expect(s.durum).toBe('hazir');
    expect(s.roller.every((r) => r === null)).toBe(true);
    expect(s.coz).toBeNull();
    let h = wiz._fwStpKartHTML();
    expect(h).toMatch(/id="ve-fw-stp-hesapla"[^>]*disabled/);
    expect(h).not.toContain('id="ve-fw-stp-aktar"');
    expect(h).not.toContain('ve-fw-stp-svg');
    rolVer();
    expect(wiz.veFeadWizStp().coz).toBeNull();                 // rol vermek HESAPLAMAZ
    h = wiz._fwStpKartHTML();
    expect(h).not.toMatch(/id="ve-fw-stp-hesapla"[^>]*disabled/);
    expect(h).not.toContain('id="ve-fw-stp-aktar"');           // hesapsız aktarım yok
    expect(wiz.veFeadWizStpAktar()).toBeNull();
  });

  test('hesap yalnız rollü düğümler; rol değişince sonuç DÜŞER, bakış değişince düşmez', () => {
    const c = hazirla();
    expect(c.ok).toBe(true);
    expect(c.kasnaklar.map((k) => k.tip)).toEqual(['fead-crank', 'fead-idler', 'fead-ac', 'fead-tensioner']);
    wiz.veFeadWizStpAyna(true);
    expect(wiz.veFeadWizStp().coz).toBe(c);
    wiz.veFeadWizStpRol(dugum(/KL[İI]MA/), 'fead-alternator');
    expect(wiz.veFeadWizStp().coz).toBeNull();
  });

  test('STEP olmayan dosya: kart hata durumunda, aktarım yok, fırlatma yok', () => {
    const s = oku('bu bir STEP dosyası değil', 'notlar.txt');
    expect(s.durum).toBe('hata');
    expect(s.hata).toMatch(/ISO-10303-21/);
    const once = wiz.veFeadWizState();
    expect(wiz.veFeadWizStpHesapla()).toBeNull();
    expect(wiz.veFeadWizStpAktar()).toBeNull();
    expect(wiz.veFeadWizState()).toBe(once);
  });

  test('gzip baytları kartın bayt yolundan da aynı ağaca varıyor', () => {
    kabuk(); wiz.veFeadWizReset();
    const s = wiz.veFeadWizStpBayt(new Uint8Array(gzipBaslikli(Buffer.from(AG_METIN, 'latin1'))), 'AG.stpZ');
    expect(s.durum).toBe('hazir');
    expect(s.kap).toBe('gzip');
    expect(s.sonuc.agac).toHaveLength(6);                       // kök + 5 parça
  });

  test('sihirbaz BAŞKA bir düğüm için açılınca eski dosya karttan düşer', () => {
    kabuk();
    global.nodes = [{ id: 'w1', type: 'fead-wizard', data: {} }, { id: 'w2', type: 'fead-wizard', data: {} }];
    wiz.veFeadWizOpen('w1');
    wiz.veFeadWizStpOku(AG_METIN, 'AG.stp');
    wiz.veFeadWizClose(false);
    wiz.veFeadWizOpen('w1');
    expect(wiz.veFeadWizStp()).not.toBeNull();       // aynı düğüm: kart duruyor
    wiz.veFeadWizClose(false);
    wiz.veFeadWizOpen('w2');
    expect(wiz.veFeadWizStp()).toBeNull();
  });

  test('rol DÜĞÜME verilir: bir parça tek birime ait — ata ve torunların rolü düşer', () => {
    const yz = new Y.StepYaz();
    const kok = yz.urun('ROOT', 'kök');
    const grg = yz.urun('GERGI-ASSY', 'OTOMATİK GERGİ');
    const kas = yz.urun('P1', 'KASNAK');
    const kol = yz.urun('P2', 'KOL');
    yz.govde(kas, Y.profilYuzleri(yz, Y.eksen(), Y.duzProfil({ od: 75 })));
    yz.govde(kol, Y.profilYuzleri(yz, Y.eksen([90, 0, 0]), Y.pivotProfil()));
    yz.temsil(kas); yz.temsil(kol);
    const t1 = yz.tak(grg, kas, 'P1.1', [0, 0, 0]);
    const t2 = yz.tak(grg, kol, 'P2.1', [0, 0, 0]);
    yz.temsil(grg);
    const t3 = yz.tak(kok, grg, 'GERGI-ASSY.1', [0, 120, 0]);
    yz.temsil(kok);
    [t1, t2, t3].forEach((t) => yz.bagla(t));
    oku(yz.metin(), 'alt.stp');
    const s = wiz.veFeadWizStp(), i = (ad) => s.sonuc.agac.findIndex((d) => d.ad === ad);
    wiz.veFeadWizStpRol(i('KASNAK'), 'fead-idler');
    wiz.veFeadWizStpRol(i('OTOMATİK GERGİ'), 'fead-tensioner');   // ata: torunun rolü düşer
    expect(s.roller[i('KASNAK')]).toBeNull();
    expect(s.roller[i('OTOMATİK GERGİ')]).toBe('fead-tensioner');
    wiz.veFeadWizStpRol(i('KOL'), 'fead-idler');                   // torun: atanın rolü düşer
    expect(s.roller[i('OTOMATİK GERGİ')]).toBeNull();
    // Kart satırları: kök basılmaz, montaj ve parçalar girintili
    const h = wiz._fwStpKartHTML();
    expect((h.match(/data-ve-stp="\d+"/g) || []).length).toBe(3);
    expect(h).toMatch(/--stp-d:1;/);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('aktarım = örnek tohumunun AYNI yolu (kural 20 · kural 34)', () => {
  test('GİDİŞ-DÖNÜŞ: kayıttaki her alan düğümde birebir, sıra kayıttaki tablo sırası', () => {
    hazirla();
    const kayit = wiz.veFeadWizStpAktar();
    expect(kayit).not.toBeNull();
    const pack = wiz.veFeadWizNodes();
    const kasnak = pack.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley);
    expect(kasnak.map((n) => n.type).sort()).toEqual(kayit.pulleys.map((p) => p.type).sort());
    kayit.pulleys.forEach((p) => {
      const n = kasnak.find((x) => x.type === p.type);
      expect(n.customName).toBe(p.name);
      Object.keys(p.data).forEach((f) => {
        expect({ tip: p.type, f, v: n.data[f] }).toEqual({ tip: p.type, f, v: p.data[f] });
      });
    });
    // beltIndex: kaydın rotası (Gates tablo sırası) — tohum çevirir, düğüm geri çevirir
    const sira = kasnak.slice().sort((a, b) => a.data.beltIndex - b.data.beltIndex).map((n) => n.type);
    expect(sira).toEqual(kayit.route.map((k) => kayit.pulleys.find((p) => p.key === k).type));
  });

  test('KAYIŞA DOKUNULMAZ ve çözücü boş durumdan — STEP kaydı ikisini de taşımıyor', () => {
    hazirla();
    const kayit = wiz.veFeadWizStpAktar();
    const st = wiz.veFeadWizState(), bos = wiz.veFeadWizDefault();
    expect(st.belt).toEqual(bos.belt);
    expect(st.solver).toEqual(bos.solver);
    expect(st.seededFrom).toBeUndefined();          // örnek değil: "Sistem adı" alanı açık kalır
    // Ad dosyanın STEP BAŞLIĞINDAN (CAD'in yazdığı ad), düzenlenebilir
    expect(st.ad).toBe(kayit.name);
    expect(st.ad).toBe('SENTETIK');
    expect(wiz.veFeadWizStepHTML(0, wiz.veFeadWizBuild())).toMatch(/Sistem adı[\s\S]*value="SENTETIK"/);
  });

  test('kaynağın izi durumda: dosya, kasnak sayısı, gerginin STEP değerleri', () => {
    hazirla();
    wiz.veFeadWizStpAktar();
    const st = wiz.veFeadWizState();
    expect(st.siraKaynagi).toBe('agac');
    expect(st.stepKaynak).toEqual({ dosya: 'AG00686.stp', kasnak: 4, ayna: false,
      gergi: { od: 75, armLen: 90, tenPart: 'T38624' } });
    // tanıyıcının çıktısı durumda YOK (kaydedilmez): yalnız iz
    expect(JSON.stringify(st)).not.toContain('kasnaklar');
  });

  test('AG00686: yay künyesi girilince köprü raporun açıklıklarını veriyor — kayıttan kurulanla BİREBİR', () => {
    hazirla();
    const kayit = wiz.veFeadWizStpAktar();
    let b = wiz.veFeadWizBuild();
    // Yay verisi STEP'te yok: künyesiz model çözülmez ve sebebi gerginin adımında
    expect(b.ok).toBe(false);
    expect(wiz.veFeadWizIssues(b, 2).filter((x) => x.tur === 'err').length).toBeGreaterThanOrEqual(3);
    yayGir();
    b = wiz.veFeadWizBuild();
    expect(b.errors).toEqual([]);
    expect(b.ok).toBe(true);
    const g = F.tensionerState(b.sys, O.AG_REF.relMean).geom;
    const ref = F.tensionerState(veFeadBuildSystem(kayitDugumleri(kayit)).sys, O.AG_REF.relMean).geom;
    g.names.forEach((nm, i) => {
      const tip = b.order[i].type;
      expect(g.exitSpanLen(i)).toBeCloseTo(ref.exitSpanLen(i), 9);
      const hata = Math.abs(g.exitSpanLen(i) - O.AG_REF.span[TIP_AD[tip]]) / O.AG_REF.span[TIP_AD[tip]] * 100;
      expect({ tip, ok: hata < 0.5 }).toEqual({ tip, ok: true });
      expect(Math.abs(g.wrapDeg(i) - O.AG_REF.wrap[TIP_AD[tip]])).toBeLessThan(0.2);
    });
    expect(b.spin).toBe(-1);                        // krank önden saat yönünde
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('kullanıcının rol ve bakış seçimi', () => {
  test('rol verilmeyen parça modele girmez; rol türü aktarılır', () => {
    hazirla([[/GERG/, 'fead-tensioner'], [/KRANK/, 'fead-crank'], [/KL[İI]MA/, 'fead-alternator']]);
    expect(wiz.veFeadWizStpDenetim().engel).toEqual([]);
    wiz.veFeadWizStpAktar();
    expect(wiz.veFeadWizState().pulleys.map((p) => p.type).sort()).toEqual(['fead-alternator', 'fead-crank']);
  });

  test('İKİ GERGİ ya da İKİ KRANK hesabı durdurur — sonuç ve durum değişmez', () => {
    oku(); rolVer();
    wiz.veFeadWizStpRol(dugum(/AVARA/), 'fead-tensioner');
    let d = wiz.veFeadWizStpDenetim();
    expect(d.engel.join(' ')).toMatch(/2 parçada/);
    expect(wiz.veFeadWizStpHesapla()).toBeNull();
    expect(wiz._fwStpKartHTML()).toMatch(/id="ve-fw-stp-hesapla"[^>]*disabled/);
    const once = wiz.veFeadWizState();
    expect(wiz.veFeadWizStpAktar()).toBeNull();
    expect(wiz.veFeadWizState()).toBe(once);
    wiz.veFeadWizStpRol(dugum(/AVARA/), 'fead-idler');
    wiz.veFeadWizStpRol(dugum(/KL[İI]MA/), 'fead-crank');
    d = wiz.veFeadWizStpDenetim();
    expect(d.engel.join(' ')).toMatch(/2 parçada/);
  });

  test('ORİJİN kullanıcının seçtiği krank: rol başka kasnağa geçince koordinatlar ondan ölçülür', () => {
    hazirla([[/GERG/, 'fead-tensioner'], [/KRANK/, 'fead-idler'], [/KL[İI]MA/, 'fead-crank'], [/AVARA/, 'fead-idler']]);
    wiz.veFeadWizStpAktar();
    const kr = wiz.veFeadWizState().pulleys.find((p) => p.type === 'fead-crank');
    expect(kr.x).toBe(0);
    expect(kr.y).toBe(0);
    expect(kr.driver).toBe(true);
    const eski = wiz.veFeadWizState().pulleys.find((p) => p.od === 160);
    expect(eski.x).toBeCloseTo(-O.AG.ac.x, 3);      // krank klimaya göre
  });

  test('AYNA x eksenini ters çevirir; model yine çözülür ama krank TERS döner', () => {
    hazirla();
    wiz.veFeadWizStpAktar();
    yayGir();
    const a = { st: JSON.parse(JSON.stringify(wiz.veFeadWizState())), spin: wiz.veFeadWizBuild().spin };
    wiz.veFeadWizStpAyna(true);
    wiz.veFeadWizStpAktar();
    yayGir();
    const b = { st: wiz.veFeadWizState(), spin: wiz.veFeadWizBuild().spin };
    b.st.pulleys.forEach((p) => {
      const q = a.st.pulleys.find((x) => x.type === p.type);
      expect(p.x).toBeCloseTo(-q.x, 9);
      expect(p.y).toBeCloseTo(q.y, 9);
    });
    expect(b.st.ten.cenX).toBeCloseTo(-a.st.ten.cenX, 9);
    expect(a.spin).toBe(-1);
    expect(b.spin).toBe(1);
    expect(b.st.stepKaynak.ayna).toBe(true);
  });

  test('aktarımdan sonra rol değişip yeniden hesaplanırsa kart söyler, sihirbaz eski seçimle kalır', () => {
    hazirla();
    wiz.veFeadWizStpAktar();
    expect(wiz._fwStpKartHTML()).toMatch(/sihirbaza aktarıldı/);
    wiz.veFeadWizStpRol(dugum(/KL[İI]MA/), 'fead-alternator');
    wiz.veFeadWizStpHesapla();
    const h = wiz._fwStpKartHTML();
    expect(h).toMatch(/aktarımdan sonra değişti/);
    expect(h).toMatch(/Yeniden aktar/);
    expect(wiz.veFeadWizState().pulleys.map((p) => p.type)).toContain('fead-ac');
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('KAYIŞ DÜZLEMİ ÇİZİMİ — hesaptan hemen sonra', () => {
  const daire = (h, i) => {
    const g = new RegExp('data-ve-stp-kasnak="' + i + '"><circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"').exec(h);
    return g ? { x: +g[1], y: +g[2], r: +g[3] } : null;
  };
  test('hesaptan önce çizim yok; sonra her kasnak dış çapıyla, krank orijinde', () => {
    oku(); rolVer();
    expect(wiz._fwStpCizimSVG(wiz.veFeadWizStp())).toBe('');
    const c = wiz.veFeadWizStpHesapla();
    const h = wiz._fwStpCizimSVG(wiz.veFeadWizStp());
    expect((h.match(/data-ve-stp-kasnak=/g) || []).length).toBe(4);
    const kr = daire(h, c.kasnaklar.findIndex((k) => k.tip === 'fead-crank'));
    expect(kr).toEqual({ x: 0, y: 0, r: 80 });
    // SVG'de y aşağı: klima (−224 ; 448) → cx −224, cy −448
    const ac = daire(h, c.kasnaklar.findIndex((k) => k.tip === 'fead-ac'));
    expect(ac).toEqual({ x: O.AG.ac.x, y: -O.AG.ac.y, r: 63.5 });
    // Gergi kolu ve pivot çiziliyor
    expect(h).toMatch(/class="ve-fw-stp-kol"/);
    expect(h).toMatch(/class="ve-fw-stp-pivot"/);
    // Kayış yolu ÇİZİLMEZ (sıra dosyada yok; yol çekirdeğin işi)
    expect(h).not.toMatch(/<path class="ve-fw-stp-kayis/);
    // 1. adımda kartın içinde
    expect(wiz.veFeadWizStepHTML(0, wiz.veFeadWizBuild())).toContain('<svg class="ve-fw-stp-svg"');
  });

  test('bakış çizimi de çevirir (yeniden hesap gerekmez)', () => {
    const c = hazirla();
    wiz.veFeadWizStpAyna(true);
    const h = wiz._fwStpCizimSVG(wiz.veFeadWizStp());
    const ac = daire(h, c.kasnaklar.findIndex((k) => k.tip === 'fead-ac'));
    expect(ac.x).toBeCloseTo(-O.AG.ac.x, 6);
  });

  test('renk CSS\'te (tema jetonu), çizimde satır içi renk YOK', () => {
    const h = (hazirla(), wiz._fwStpCizimSVG(wiz.veFeadWizStp()));
    expect(h).not.toMatch(/(fill|stroke)="#|style="[^"]*(fill|stroke|color)/);
    const css = require('fs').readFileSync(require('path').join(__dirname, '../../css/styles.css'), 'utf8');
    expect(css).toMatch(/\.ve-fw-stp-kasnak circle\{[^}]*stroke:var\(--accent-primary\)/);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('kayış sırası bir VARSAYIM — Kasnaklar adımı söyler', () => {
  const sayi = () => wiz.veFeadWizIssues(wiz.veFeadWizBuild(), 1)
    .filter((x) => x.m === wiz.VE_FW_SIRA_AGAC).length;

  test('aktarımdan sonra 2. adım UYARI taşır; onay kaldırır', () => {
    hazirla(); wiz.veFeadWizStpAktar(); yayGir();
    expect(sayi()).toBe(1);
    expect(wiz.veFeadWizStepState(wiz.veFeadWizBuild(), 1).durum).toBe('warn');
    expect(wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild())).toContain('id="ve-fw-sira-onay"');
    expect(wiz.veFeadWizSiraOnay()).toBe(true);
    expect(sayi()).toBe(0);
    expect(wiz.veFeadWizStepState(wiz.veFeadWizBuild(), 1).durum).toBe('ok');
    expect(wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild())).not.toContain('id="ve-fw-sira-onay"');
  });

  test('sırayı ELLE değiştirmek de kaldırır (taşıma · yön çevirme)', () => {
    hazirla(); wiz.veFeadWizStpAktar();
    const r = wiz.veFeadWizRoute(wiz.veFeadWizState());
    expect(wiz.veFeadWizRouteMove(r[2], 1)).toBe(true);
    expect(sayi()).toBe(0);
    hazirla(); wiz.veFeadWizStpAktar();
    wiz.veFeadWizRouteReverse();
    expect(sayi()).toBe(0);
  });

  test('örnekten dolan sihirbazda uyarı YOK', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    expect(wiz.veFeadWizState().siraKaynagi).toBeUndefined();
    expect(sayi()).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('STEP ↔ KÜNYE: künye CAD\'deki gergiyi sessizce değiştirmez', () => {
  const uyarilar = () => wiz.veFeadWizIssues(wiz.veFeadWizBuild(), 2)
    .filter((x) => x.tur === 'warn').map((x) => x.m).join(' | ');

  test('aynı parçanın künyesi: fark yok', () => {
    hazirla(); wiz.veFeadWizStpAktar();
    wiz.veFeadWizTenLib('AG00686');                 // T38624 · kol 90 · Ø75
    expect(uyarilar()).not.toMatch(/STEP dosyası/);
  });

  test('başka parçanın künyesi: parça kodu ve kol boyu farkı ADIYLA', () => {
    hazirla(); wiz.veFeadWizStpAktar();
    wiz.veFeadWizTenLib('AG00879');                 // T38665 · kol 56
    const u = uyarilar();
    expect(u).toMatch(/künyenin parçası T38665, STEP dosyasındaki gergi T38624/);
    expect(u).toMatch(/kol boyu 56\.000 mm, STEP dosyasında 90\.000 mm/);
  });

  test('ELLE GİRİLEN değer kullanıcının kararı — uyarı yok', () => {
    hazirla(); wiz.veFeadWizStpAktar();
    wiz.veFeadWizTenSet('armLen', 88);
    expect(uyarilar()).not.toMatch(/STEP dosyası/);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('kart yüzeyi (sunum)', () => {
  test('1. adımda STEP kartı: bırakma alanı, ağaç satırları rolsüz, açıklama yüzeyi YOK', () => {
    oku();
    let h = wiz.veFeadWizStepHTML(0, wiz.veFeadWizBuild());
    expect(h).toContain('data-ve-dropzone="step"');
    expect(h).toContain('accept=".stp,.step,.stpz,.p21"');
    expect((h.match(/data-ve-stp="\d+"/g) || []).length).toBe(5);          // kök basılmaz
    expect(h).toMatch(/KAYIŞ - 8PK1475/);                                  // kayış da bir parça
    // hepsi rolsüz — sayım KARTIN içinde (adımın örnek listesinde "Boş başla" da value="")
    expect((wiz._fwStpKartHTML().match(/<option value="" selected>/g) || []).length).toBe(5);
    expect(h).not.toContain('ve-fw-hint');
    expect(h.indexOf("STEP'ten başla")).toBeLessThan(h.indexOf('Örnekten doldur'));
    rolVer(); wiz.veFeadWizStpHesapla();
    h = wiz.veFeadWizStepHTML(0, wiz.veFeadWizBuild());
    expect(h).toMatch(/8 × PK/);
  });

  test('1. adımda TEK birincil düğme — kartın düğmeleri "İleri →" ile yarışmaz', () => {
    // Ölçülmüş kusur: kartın düğmeleri `ve-fw-btn-primary` taşıyordu; iki dolu
    // düğme yarışıyordu ve "İleri"yi sınıfıyla arayan gerçek tarayıcı testi
    // (fead-sihirbaz-tablo.spec) iki elemana çarpıp düştü.
    const birincil = () => [...document.querySelectorAll('#ve-feadwiz-overlay .ve-fw-btn-primary')]
      .map((e) => e.textContent.trim());
    kabuk(); wiz.veFeadWizReset();
    expect(birincil()).toEqual(['İleri →']);
    wiz.veFeadWizStpOku(AG_METIN, 'AG.stp');
    expect(birincil()).toEqual(['İleri →']);
    rolVer(); wiz.veFeadWizStpHesapla();
    expect(birincil()).toEqual(['İleri →']);
    wiz.veFeadWizStpAktar();
    wiz.veFeadWizStpRol(dugum(/KL[İI]MA/), 'fead-alternator'); wiz.veFeadWizStpHesapla();
    expect(birincil()).toEqual(['İleri →']);
  });

  test('bırakma olayı dosyayı okur (DataTransfer)', async () => {
    kabuk(); wiz.veFeadWizReset();
    const dosya = { name: 'AG.stp', arrayBuffer: () => Promise.resolve(Buffer.from(AG_METIN, 'latin1')) };
    const el = document.createElement('div');
    const olay = { preventDefault: jest.fn(), currentTarget: el, dataTransfer: { files: [dosya] } };
    expect(wiz.veFeadWizStpDrop(olay)).toBe(true);
    expect(olay.preventDefault).toHaveBeenCalled();
    expect(wiz.veFeadWizStp().durum).toBe('okunuyor');
    await new Promise((r) => setTimeout(r, 60));
    expect(wiz.veFeadWizStp().durum).toBe('hazir');
    expect(wiz.veFeadWizStp().dosya).toBe('AG.stp');
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('tanıyıcının kaydı (sihirbazın girdisi)', () => {
  const rollerAd = (o, kural) => { const r = []; o.agac.forEach((d) => { const k = kural.find(([re]) => re.test(d.ad)); if (k && d.ebeveyn >= 0) r[d.i] = k[1]; }); return r; };
  test('ikinci gergi rolü aktarılmaz ve söylenir', () => {
    const o = S.veFeadStpOku(AG_METIN);
    const c = S.veFeadStpCoz(o, rollerAd(o, [[/GERG/, 'fead-tensioner'], [/KRANK/, 'fead-crank'], [/KL[İI]MA/, 'fead-ac'], [/AVARA/, 'fead-tensioner']]));
    const kayit = S.veFeadStpKayit(c, {});
    expect(kayit.pulleys.filter((p) => p.type === 'fead-tensioner').length).toBe(1);
    expect(kayit.uyarilar.join(' ')).toMatch(/ikinci gergi rolü/);
  });

  test('sayılar µm\'ye yuvarlanmış; ad tek satır', () => {
    const o = S.veFeadStpOku(AG_METIN);
    const kayit = S.veFeadStpKayit(S.veFeadStpCoz(o, rollerAd(o, ROL)), {});
    expect(kayit.pulleys).toHaveLength(4);
    kayit.pulleys.forEach((p) => {
      ['od', 'x', 'y', 'cenX', 'cenY', 'armLen'].forEach((f) => {
        if (p.data[f] === undefined) return;
        expect(Math.round(p.data[f] * 1000) / 1000).toBe(p.data[f]);
      });
      expect(p.name).not.toMatch(/\n|\s{2}/);
    });
  });
});

// Kanal sayısı dosyadan okunur ama KAYIŞA YAZILMAZ (kullanıcı kararı): 6 kanallı
// kasnaklar içeren bir dosya da kayışı boş durumun 8 kanalında bırakır.
test('KAYIŞA DOKUNULMAZ — dosya 6PK dese de kanal sayısı yazılmaz', () => {
  const metin = O.feadStep([
    { id: 'K', ad: 'KRANK KASNAK', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 6 }) }] },
    { id: 'A', ad: 'ALTERNATOR', x: 150, y: 250, geometri: [{ profil: Y.kanalliProfil({ od: 60, n: 6 }) }] },
  ]);
  oku(metin, '6PK.stp');
  rolVer([[/KRANK/, 'fead-crank'], [/ALTERNATOR/, 'fead-alternator']]);
  const c = wiz.veFeadWizStpHesapla();
  expect(c.kasnaklar.map((k) => k.kanal)).toEqual([6, 6]);
  wiz.veFeadWizStpAktar();
  expect(wiz.veFeadWizState().belt).toEqual(wiz.veFeadWizDefault().belt);
});
