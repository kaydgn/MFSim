/**
 * fead-acilis.test.js — FEAD AÇILIŞI: MOTORA İNİŞ + SİHİRBAZIN ANTETİ
 *
 * Kullanıcı bildirimi (2026-09-18): *"FEAD modülünü seçince, modülün
 * açılmasını, başlangıç sihirbazının gelmesini falan, hoş bulmuyorum…
 * profesyonellik olarak biraz amatör duruyor."*
 *
 * Ölçüldü — üç ayrı kusur, üçü de bu dosyada kapılı:
 *
 *   K3  SİHİRBAZ KESMEYLE GELİYORDU. `ov.style.display = 'flex'`, 0 ms.
 *       Uygulamanın her yerinde geçiş var (kabuk 420 ms, uçuş 460 ms, tuval
 *       300 ms) ve tam da en büyük pencere animasyonsuz ekrana çarpıyordu.
 *   K5  CANLI ŞERİT DURUMA GÖRE YENİDEN DİZİLİYORDU: çözülmeyen modelde iki
 *       hap, çözülende beş. Canlı yama 220 ms'de bir koştuğu için yazarken
 *       şerit sürekli oynuyordu — ve şerit modelin KİMLİĞİNİ (ad · kayış ·
 *       kasnak sayısı) hiç taşımıyordu.
 *   K6  GİRİŞ MODÜLDEN BAĞIMSIZDI. Üç modül de aynı 300 ms'lik `veTopoEnter`
 *       ile açılıyordu; FEAD'in girişinde FEAD'e ait hiçbir şey yoktu.
 *
 * KAPI ÇİFT, bu deponun kuralı gereği: JS'in ürettiği yüzey bir tarafta, o
 * yüzeyi görünür kılan CSS kuralı öbür tarafta. Tek başına hiçbiri bir şey
 * ifade etmez — sınıf basılıp CSS bloğu silinse bütün JS kapıları yeşil
 * kalırdı (bkz. `fead-table.test.js` › "DURUM KURALLARI CSS'te").
 */
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

const M = require('../../js/fead-model.js');
Object.keys(M).forEach((k) => { if (global[k] === undefined) global[k] = M[k]; });
require('../../js/fead-core.js');
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');

const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  document.body.innerHTML = '<div id="ve-canvas"></div>';
});

// Süre jetonunu CSS metninden söker: iki animasyonun SIRALAMASI bir
// değişmez ve yalnız sayıyı okuyarak denetlenebilir.
const sure = (ad) => {
  const m = CSS.match(new RegExp('animation:\\s*' + ad + '\\s+(\\d+)ms'));
  return m ? Number(m[1]) : NaN;
};

// `@media (prefers-reduced-motion: reduce)` bloklarını SINIRIYLA söker.
// Düz bir regex burada işe yaramaz: blok kendi içinde süslü parantez taşıyor,
// yani "şu medya sorgusundan sonra şu metin geçiyor" biçimindeki bir arama
// dosyanın bambaşka bir yerindeki kuralı yakalayıp yeşil kalabilir.
const kisitliBloklar = (() => {
  const out = [];
  const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
  let m;
  while ((m = re.exec(CSS))) {
    let i = m.index + m[0].length, derinlik = 1;
    while (i < CSS.length && derinlik > 0) {
      if (CSS[i] === '{') derinlik++;
      else if (CSS[i] === '}') derinlik--;
      i++;
    }
    out.push(CSS.slice(m.index, i));
  }
  return out;
})();
const kisitliIceriyor = (s) => kisitliBloklar.some((b) => b.includes(s));

// Antet hücrelerini ÜRETİLEN DOM'dan okur — dize aramak hücre SAYISINI
// ölçemez, oysa bu turun asıl konusu tam olarak o.
const hucreler = (b) => {
  const kap = document.createElement('div');
  kap.innerHTML = wiz.veFeadWizLiveHTML(b);
  return [...kap.querySelectorAll('.ve-fw-pill')];
};
const metin = (b) => hucreler(b).map((c) => c.textContent).join(' | ');

// ═══════════════════════════════════════════════════════════════════════════
describe('ANTET — künye hücreleri (K5)', () => {
  test('HÜCRE SAYISI DURUMA GÖRE DEĞİŞMİYOR — asıl kusur buydu', () => {
    wiz.veFeadWizReset();
    const bos = hucreler(null).length;
    const bozuk = hucreler({ ok: false, errors: ['kasnak gerekli'] }).length;
    const cozulen = hucreler({
      ok: true, beltLengthMm: 1715.27, springTensionN: 543.9,
      armAbsDeg: 344.0, spin: 1,
    }).length;

    // Eski şerit: 2 · 2 · 5. Yenisi üçünde de AYNI — göz sabit bir yere bakıyor.
    expect(bos).toBe(bozuk);
    expect(bozuk).toBe(cozulen);
    expect(cozulen).toBe(8);   // 7 künye hücresi + damga
  });

  test('KİMLİK ÇÖZÜM OLMADAN DA DOLU — durumdan okunuyor, köprüden değil', () => {
    wiz.veFeadWizReset();
    const st = wiz.veFeadWizState();
    st.ad = 'Deneme Sistemi';
    st.belt = { profile: 'PK', brand: 'GATES', ribs: 8 };
    st.pulleys = [{ key: 'p1' }, { key: 'p2' }, { key: 'p3' }];

    // Köprü HİÇ çözmemiş olsa bile:
    const m = metin(null);
    expect(m).toContain('Deneme Sistemi');
    expect(m).toContain('8PK');
    expect(m).toContain('GATES');
    // Kasnak sayısı +1: otomatik gergi `st.ten`de, `st.pulleys` dizisinde DEĞİL.
    expect(hucreler(null)[2].textContent).toContain('4');
  });

  test('değeri olmayan hücre "—" gösteriyor, BİRİMSİZ', () => {
    wiz.veFeadWizReset();
    const m = metin(null);
    expect(m).toContain('—');
    // "— mm" okunur bir şey değil: birim yalnız sayı varken yazılır.
    expect(m).not.toMatch(/—\s*mm/);
    expect(m).not.toMatch(/—\s*N\b/);
  });

  test('METİN SÖZLEŞMESİ DURUYOR — üç E2E kapısı bundan okuyor', () => {
    // fead-wizard.spec.js `.ve-fw-pill` metinlerinde mm/N/CCW arıyor,
    // fead-wizard-tur3.spec.js `.ve-fw-live` innerText'inde yön arıyor.
    // Sözleşme Node'da da tutuluyor ki kaçak bir E2E turunda değil 3 sn'de görünsün.
    const yap = (spin) => metin({
      ok: true, beltLengthMm: 1715.27, springTensionN: 543.9, armAbsDeg: 344.0, spin,
    });
    const m = yap(1);
    expect(m).toMatch(/mm/);
    expect(m).toMatch(/N/);
    // `veFeadSpinLabel` İŞARETLİ SAYI bekliyor (+1 CCW / -1 CW); dize verilirse
    // sessizce '—' döner — bu fikstür bir kez öyle yazıldı ve kapı yakaladı.
    expect(m).toMatch(/CCW/);
    expect(yap(-1)).toMatch(/CW/);
    expect(yap(0)).toContain('—');
  });

  test('derece sayıya BİTİŞİK, ölçü birimi AYRIK', () => {
    const m = metin({ ok: true, beltLengthMm: 1715.27, springTensionN: 543.9, armAbsDeg: 344.0, spin: 1 });
    expect(m).toContain('344.00\u00b0');
    expect(m).not.toContain('344.00 \u00b0');
    expect(m).toContain('1715.3 mm');
  });

  test('DAMGA üç durumu da ayırıyor ve sınıf sözleşmesini koruyor', () => {
    wiz.veFeadWizReset();
    const damga = (b) => {
      const kap = document.createElement('div');
      kap.innerHTML = wiz.veFeadWizLiveHTML(b);
      return kap.querySelector('.ve-fw-damga');
    };
    expect(damga(null).className).toContain('ve-fw-pill-dim');
    expect(damga(null).textContent).toBe('ÇÖZÜM YOK');

    const ok = damga({ ok: true });
    expect(ok.className).toContain('ve-fw-pill-ok');
    expect(ok.textContent).toBe('ONAY');

    const err = damga({ ok: false, errors: ['Sürücü kasnak yok'] });
    expect(err.className).toContain('ve-fw-pill-err');
    expect(err.textContent).toBe('EKSİK');
    // Sebep GİZLENMİYOR, ipucuna taşınıyor (hücre dar).
    expect(err.getAttribute('title')).toBe('Sürücü kasnak yok');
  });

  test('damga "Modeli Kur"un kapısı DEĞİL — yalnız çözüm durumu', () => {
    // `veFeadWizCanCreate` iç topolojideki kasnakları da sayar; ikisini tek
    // işarete bindirmek çözülen ama kurulamayan modeli onaylanmış gösterirdi.
    wiz.veFeadWizReset();
    global.nodes = [{ id: 'k1', type: 'fead-crank', data: { od: 162 } }];
    expect(wiz.veFeadWizCanCreate().ok).toBe(false);      // kurulamaz
    const kap = document.createElement('div');
    kap.innerHTML = wiz.veFeadWizLiveHTML({ ok: true });
    expect(kap.querySelector('.ve-fw-damga').textContent).toBe('ONAY');  // ama çözülüyor
  });

  test('DURUM KURALLARI CSS\'te — JS tarafı tek başına hiçbir şey ifade etmez', () => {
    // JS `<i>` etiketi ve ızgara basıyor; CSS onları görünür kılmazsa antet
    // eski hâline göre DAHA kötü okunur (etiket ile değer ayrışmaz).
    expect(CSS).toMatch(/\.ve-fw-live\{[^}]*display:grid/);
    expect(CSS).toMatch(/\.ve-fw-pill i\{/);
    expect(CSS).toMatch(/\.ve-fw-damga\{/);
    expect(CSS).toMatch(/\.ve-fw-pill-ok\{[^}]*--accent-success/);
    expect(CSS).toMatch(/\.ve-fw-pill-err\{[^}]*--accent-danger/);
    // Saç teli ızgarası: hücre KENARLIĞI değil `gap` + ızgara zemini —
    // sekiz hücre dar modalda sarıyor ve border satır uçlarında asılı kalırdı.
    expect(CSS).toMatch(/\.ve-fw-live\{[^}]*gap:1px/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('SİHİRBAZ AÇILIŞI — kesme değil (K3)', () => {
  const kabuk = () => {
    document.body.innerHTML = '<div id="ve-canvas"></div>'
      + '<div id="ve-feadwiz-overlay" style="display:none;">'
      + '<div class="ve-settings-modal ve-fw-modal"></div>'
      + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div>'
      + '</div><div id="ve-fw-ang" style="display:none;"></div>';
    return document.getElementById('ve-feadwiz-overlay');
  };

  test('açılış sınıfı KONUYOR ve pencere görünür oluyor', () => {
    const ov = kabuk();
    expect(wiz.veFeadWizOpen(null)).toBe(true);
    expect(ov.style.display).toBe('flex');
    expect(ov.classList.contains('ve-fw-acilis')).toBe(true);
  });

  test('KABARAN OLAY SINIFI DÜŞÜRMÜYOR — modal daha yoldayken', () => {
    // Modalın kendi animasyonu kaba kabarıyor. Süzülmeseydi sınıf modalın
    // 380 ms'lik inişi sürerken kalkar ve iniş YARIDA kesilirdi.
    const ov = kabuk();
    wiz.veFeadWizOpen(null);
    const modal = ov.querySelector('.ve-fw-modal');
    modal.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(ov.classList.contains('ve-fw-acilis')).toBe(true);

    // Kaplamanın KENDİ olayı ise sınıfı kaldırır.
    ov.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(ov.classList.contains('ve-fw-acilis')).toBe(false);
  });

  test('sınıf asılı kalmıyor — İKİNCİ açılış da animasyonlu', () => {
    // Temizlik hiç koşmasa (arka plan sekmesi: `animationend` gelmez) sınıf
    // zaten duruyor olurdu ve @keyframes YENİDEN TETİKLENMEZDİ.
    const ov = kabuk();
    wiz.veFeadWizOpen(null);
    wiz.veFeadWizClose(false);
    wiz.veFeadWizOpen(null);
    expect(ov.classList.contains('ve-fw-acilis')).toBe(true);
  });

  test('KAPLAMANIN SÜRESİ MODALINKİNDEN KISA OLAMAZ', () => {
    // Temizlik kaplamanın kendi `animationend`ine bağlı. Kaplama daha kısa
    // olsaydı sınıf modal hâlâ inerken kalkardı — sessiz, çünkü animasyon
    // bir yerde duruyor ve kimse hata vermiyor.
    const kaplama = sure('veFwAcilis');
    const modal = sure('veFwModalIn');
    expect(Number.isFinite(kaplama)).toBe(true);
    expect(Number.isFinite(modal)).toBe(true);
    expect(kaplama).toBeGreaterThanOrEqual(modal);
  });

  test('hareket kısıtlıysa animasyon YOK — iki taraftan da', () => {
    expect(kisitliIceriyor('ve-fw-acilis')).toBe(true);
    // JS tarafı: matchMedia "reduce" derse sınıf hiç konmuyor.
    const ov = kabuk();
    const eski = window.matchMedia;
    window.matchMedia = () => ({ matches: true });
    try {
      wiz.veFeadWizOpen(null);
      expect(ov.classList.contains('ve-fw-acilis')).toBe(false);
      expect(ov.style.display).toBe('flex');     // pencere YİNE açılıyor
    } finally { window.matchMedia = eski; }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('MODÜL GİRİŞİ — motorun ön yüzüne iniş (K6)', () => {
  const tuval = () => {
    document.body.innerHTML = '<div class="ve-canvas-wrapper" id="ve-canvas-wrapper">'
      + '<div id="ve-canvas"></div></div>';
    return document.getElementById('ve-canvas-wrapper');
  };

  test('sınıf ve siluet KONUYOR', () => {
    const wrap = tuval();
    expect(fead.veFeadAnimateEnter()).toBe(true);
    expect(wrap.classList.contains('ve-fead-enter')).toBe(true);
    const blok = wrap.querySelector('.ve-fead-blok');
    expect(blok).toBeTruthy();
    expect(blok.querySelector('svg')).toBeTruthy();
    expect(blok.getAttribute('aria-hidden')).toBe('true');
  });

  test('SİLUET GÖMÜLÜ — çevrimdışı kurulumda da var', () => {
    // Çalışma anında çekilen bir görsel, yanında vendor/ olmayan tek dosya
    // kurulumda "yok" demektir (kök CLAUDE.md › AĞIR VARLIKLAR GÖMÜLÜR).
    const s = fead.VE_FEAD_BLOK_SVG;
    expect(s).toContain('<svg');
    expect(s).not.toMatch(/https?:/);
    expect(s).not.toMatch(/\bsrc=/);
    expect(s).not.toMatch(/url\(/);
  });

  test('TEMİZLİK: sınıf kalkıyor ve siluet DOM\'dan SİLİNİYOR', () => {
    const wrap = tuval();
    fead.veFeadAnimateEnter();
    wrap.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(wrap.classList.contains('ve-fead-enter')).toBe(false);
    expect(wrap.querySelector('.ve-fead-blok')).toBe(null);
  });

  test('SİLUETİN KENDİ OLAYI TEMİZLİĞİ TETİKLEMİYOR', () => {
    // Siluetin animasyonu da kaba kabarıyor; süzülmeseydi iniş daha ilk
    // karelerde sökülürdü.
    const wrap = tuval();
    fead.veFeadAnimateEnter();
    const blok = wrap.querySelector('.ve-fead-blok');
    blok.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(wrap.classList.contains('ve-fead-enter')).toBe(true);
    expect(wrap.querySelector('.ve-fead-blok')).toBeTruthy();
  });

  test('hareket kısıtlıysa HİÇBİR ŞEY kurulmuyor ve false dönüyor', () => {
    const wrap = tuval();
    const eski = window.matchMedia;
    window.matchMedia = () => ({ matches: true });
    try {
      expect(fead.veFeadAnimateEnter()).toBe(false);
      expect(wrap.querySelector('.ve-fead-blok')).toBe(null);
      expect(wrap.classList.contains('ve-fead-enter')).toBe(false);
    } finally { window.matchMedia = eski; }
  });

  test('kap yoksa PATLAMIYOR, false dönüyor — çağıran genel geçişe düşer', () => {
    document.body.innerHTML = '';
    expect(fead.veFeadAnimateEnter()).toBe(false);
  });

  test('ÇIKIŞ genel geçişte KALIYOR — modülden çıkmak bir iniş değil', () => {
    const SRC = fs.readFileSync(path.join(__dirname, '../../js/cp-fead.js'), 'utf8');
    const kapat = SRC.slice(SRC.indexOf('function veFeadCloseEditor'),
      SRC.indexOf('function veFeadCollapseToRoot'));
    expect(kapat).toContain("veAnimateCanvasTransition('exit')");
    expect(kapat).not.toContain('veFeadAnimateEnter');
  });

  test('GİRİŞ KURALLARI CSS\'te — sınıf basılıp kural düşerse iniş sessizce yok', () => {
    expect(CSS).toMatch(/\.ve-canvas-wrapper\.ve-fead-enter\{[^}]*animation:veFeadEnter/);
    expect(CSS).toMatch(/@keyframes veFeadEnter\{/);
    expect(CSS).toMatch(/\.ve-fead-blok\{[^}]*position:absolute/);
    expect(CSS).toMatch(/\.ve-fead-blok\{[^}]*pointer-events:none/);
    expect(CSS).toMatch(/@keyframes veFeadBlokOut\{/);
    expect(kisitliIceriyor('ve-fead-blok')).toBe(true);
    expect(kisitliIceriyor('ve-fead-enter')).toBe(true);
  });

  test('siluet MİNİMAP\'İ ÖRTMÜYOR', () => {
    // Minimap z-index:40 ve kabın içinde duruyor; siluet onun ÜSTÜNE
    // çıksaydı iniş boyunca minimap kaybolurdu.
    const blok = CSS.match(/\.ve-fead-blok\{([^}]*)\}/);
    const z = Number((blok[1].match(/z-index:(\d+)/) || [])[1]);
    const mini = Number((CSS.match(/\.ve-minimap\{[\s\S]*?z-index:\s*(\d+)/) || [])[1]);
    expect(z).toBeLessThan(mini);
  });

  test('İKİ SÜRE DE AYNI — siluet daha uzun sürseydi yarıda kesilirdi', () => {
    // Temizlik kabın `animationend`ine bağlı; siluet ondan uzun olamaz.
    expect(sure('veFeadBlokOut')).toBeLessThanOrEqual(sure('veFeadEnter'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('HER ANİMASYON GÖRÜNDÜĞÜ YERDE', () => {
  // Taze topolojide sihirbaz ekranın ~%88'ini kaplayarak hemen açılıyor, yani
  // kamera inişi onun ARKASINDA görünmeden akardı. Sihirbazı geciktirmek
  // denendi ve GERİ ALINDI: gecikme bir YARIŞ açıyor — "pencere daha
  // açılmadı" diye düğüme çift tıklayan çağıran pencereyi kendi açıyor,
  // sonra geciken açılış `veFeadWizOpen`i ikinci kez çağırıp o ana kadar
  // yazılanı sıfırlıyor. Beş E2E spec'i birden bunu gösterdi.
  const kur = (data) => {
    document.body.innerHTML =
      '<div class="ve-canvas-wrapper" id="ve-canvas-wrapper"><div id="ve-canvas"></div></div>';
    global.nodes = [{ id: 'fa1', type: 'fead-analysis', data }];
    global.connections = [];
    const iz = { wiz: 0, genel: 0 };
    global.veSerializeCurrentState = () => ({ nodes: [], connections: [] });
    global.veClearCanvasDOM = () => {};
    global.veLoadTabState = () => {};
    global.veFeadWizOpen = () => { iz.wiz++; return true; };
    global.veAnimateCanvasTransition = () => { iz.genel++; };
    let k = 0;
    global.createNode = (type, x, y) => {
      const d = componentDefs[type] || {};
      if (d.maxInstances && global.nodes.filter((n) => n.type === type).length >= d.maxInstances) return null;
      const n = { id: 'oe' + ++k, type, def: d, x, y, data: {} };
      global.nodes.push(n); return n;
    };
    return iz;
  };
  const sok = () => ['veSerializeCurrentState', 'veClearCanvasDOM', 'veLoadTabState',
    'veFeadWizOpen', 'veAnimateCanvasTransition', 'createNode']
    .forEach((k) => { delete global[k]; });

  test('TAZE topoloji: sihirbaz EŞZAMANLI açılıyor, iniş KOŞMUYOR', () => {
    const iz = kur({});
    const wrap = document.getElementById('ve-canvas-wrapper');
    try {
      fead.veFeadOpenEditor('fa1');
      expect(iz.wiz).toBe(1);                                   // gecikme yok → yarış yok
      expect(wrap.querySelector('.ve-fead-blok')).toBe(null);   // modal onu örterdi
      expect(wrap.classList.contains('ve-fead-enter')).toBe(false);
      expect(iz.genel).toBe(1);                                 // genel geçişe düşüldü
    } finally { sok(); }
  });

  test('KURULMUŞ model: iniş koşuyor, GENEL geçiş koşmuyor', () => {
    const iz = kur({ subTopology: {
      nodes: [{ id: 'x', type: 'fead-crank', data: {} }], connections: [] } });
    const wrap = document.getElementById('ve-canvas-wrapper');
    try {
      fead.veFeadOpenEditor('fa1');
      expect(iz.wiz).toBe(0);                                   // kurulmuş modele sihirbaz gelmez
      expect(wrap.querySelector('.ve-fead-blok')).toBeTruthy();
      expect(wrap.classList.contains('ve-fead-enter')).toBe(true);
      expect(iz.genel).toBe(0);                                 // iniş genel geçişin YERİNE
    } finally { sok(); }
  });
});
