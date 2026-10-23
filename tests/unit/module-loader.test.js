/**
 * module-loader.test.js — MODÜL GİRİŞ EKRANI + DOĞRUDAN GİRİŞ
 *
 * Kullanıcı isteği (2026-09-21): *"ana ekrandan FEAD modülüne tıkladıktan
 * sonra, direk program içine giriyor, yani güzel bir yükleme ekranı olur, ne
 * bileyim daha profesyonel bir görüntü olur."*
 *
 * İki ayrı şey ve ikisi de burada kapılı:
 *
 *   1) DOĞRUDAN GİRİŞ. Karşılama kartına tıklamak eskiden yalnız ana tuvale
 *      bir kart bırakıyordu; içeri girmek için o karta AYRICA çift tıklamak
 *      gerekiyordu ve bunu söyleyen hiçbir şey yoktu.
 *   2) GEÇİŞ EKRANI. Aradaki iş (kabuk + düğüm + iç topoloji) bu ekranın
 *      altında akıyor.
 *
 * EN SESSİZ HATA SINIFI BURADA: ekran gösterilemediğinde (kap yok, hareket
 * kısıtlı) işlerin YİNE DE koşması gerekiyor. Koşmazsa karta tıklamak
 * HİÇBİR ŞEY yapmaz ve hiçbir yerde hata çıkmaz — kullanıcı kartı tıklar,
 * program durur. O yüzden geri düşüş yolu ayrıca ölçülüyor.
 */
const fs = require('fs');
const path = require('path');

const IDX = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;
global.veStartModule = veStartModule;
global._veModuleEnterFn = _veModuleEnterFn;

const ML = require('../../js/module-loader.js');
// Tarayıcıda üst-seviye bildirimler global; testte `require` ile geldiği için
// components.js'in çıplak `veModuleLoaderRun` başvurusu global'i arıyor.
Object.keys(ML).forEach((k) => { global[k] = ML[k]; });

// Kabuk: js/module-loader.js kimlikleri id ile arıyor.
const kabuk = () => {
  document.body.innerHTML =
    '<div id="mfsim-module-loading" style="display:none;">'
    + '<div id="ve-modload-photo"></div>'
    + '<span id="ve-modload-ico"></span><span id="ve-modload-ad"></span>'
    + '<div id="ve-modload-alt"></div>'
    + '<ul id="ve-modload-stages"></ul>'
    + '<div id="ve-modload-message"></div>'
    + '<div id="ve-modload-bar"></div>'
    + '<div id="ve-modload-percent"></div>'
    + '</div>';
  return document.getElementById('mfsim-module-loading');
};

// rAF'ı EŞZAMANLI yapıyoruz: dizinin geri kalanı setTimeout'la yürüyor ve
// sahte zamanlayıcı onu sürebiliyor. Gerçek rAF ile dizi jsdom'da hiç ilerlemez.
// SIRA ÖNEMLİ: `jest.useFakeTimers()` requestAnimationFrame'i de sahteliyor
// ve stub'ı EZİYOR. Bir kez test içinde çağrıldı ve dizi hiç ilerlemedi —
// o yüzden sahte zamanlayıcı ÖNCE, stub SONRA kuruluyor.
let _rafEski;
beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  ML.veModuleLoaderKapat();
  jest.useFakeTimers();
  _rafEski = global.requestAnimationFrame;
  global.requestAnimationFrame = (fn) => { fn(); return 1; };
});
afterEach(() => {
  global.requestAnimationFrame = _rafEski;
  ML.veModuleLoaderKapat();
  jest.useRealTimers();
});

const adimlarKur = () => ([
  { ad: 'Bir', is: jest.fn() },
  { ad: 'İki', is: jest.fn() },
  { ad: 'Üç', is: jest.fn() },
]);

// ═══════════════════════════════════════════════════════════════════════════
describe('GERİ DÜŞÜŞ — ekran yoksa iş YİNE DE yapılıyor', () => {
  test('kap yokken bütün adımlar EŞZAMANLI koşuyor ve false dönüyor', () => {
    document.body.innerHTML = '<div id="ve-canvas"></div>';   // kap YOK
    const a = adimlarKur();
    expect(ML.veModuleLoaderRun({ ad: 'X' }, a)).toBe(false);
    a.forEach((s) => expect(s.is).toHaveBeenCalledTimes(1));
  });

  test('hareket kısıtlıyken de işler koşuyor — ekran yalnız KOREOGRAFİ', () => {
    kabuk();
    const eski = window.matchMedia;
    window.matchMedia = () => ({ matches: true });
    try {
      const a = adimlarKur();
      expect(ML.veModuleLoaderRun({ ad: 'X' }, a)).toBe(false);
      a.forEach((s) => expect(s.is).toHaveBeenCalledTimes(1));
      expect(document.getElementById('mfsim-module-loading').style.display).toBe('none');
    } finally { window.matchMedia = eski; }
  });

  test('PATLAYAN adım diziyi durdurmuyor', () => {
    // Bir adımın patlaması, ondan sonrakilerin hiç koşmaması demek olurdu —
    // yani modül yarı açık kalırdı.
    document.body.innerHTML = '<div id="ve-canvas"></div>';
    const a = [
      { ad: 'Bir', is: () => { throw new Error('patladı'); } },
      { ad: 'İki', is: jest.fn() },
    ];
    expect(() => ML.veModuleLoaderRun({ ad: 'X' }, a)).not.toThrow();
    expect(a[1].is).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('EKRAN — adımlar, çubuk, kapanış', () => {
  test('gösteriliyor, adımlar SIRAYLA koşuyor, sonunda kapanıyor', () => {
    const kap = kabuk();
    const a = adimlarKur();
    {
      expect(ML.veModuleLoaderRun({ ad: 'FEAD', alt: 'alt', svg: '<svg></svg>' }, a)).toBe(true);
      // SENKRON GÖSTERİM: ilk boyamada ekran çoktan kapalı olmalı, yoksa
      // arada boş tuval parlar.
      expect(kap.style.display).toBe('flex');
      expect(document.getElementById('ve-modload-ad').textContent).toBe('FEAD');
      expect(document.getElementById('ve-modload-ico').innerHTML).toBe('<svg></svg>');

      // rAF eşzamanlı → ilk adım hemen koştu, kalanlar zamanlayıcıyla.
      expect(a[0].is).toHaveBeenCalledTimes(1);
      expect(a[2].is).not.toHaveBeenCalled();

      jest.advanceTimersByTime(ML.VE_MODLOAD_DURUS * 3 + 30);
      a.forEach((s) => expect(s.is).toHaveBeenCalledTimes(1));
      expect(document.getElementById('ve-modload-percent').textContent).toBe('%100');
      expect(document.getElementById('ve-modload-bar').style.width).toBe('100%');

      jest.advanceTimersByTime(ML.VE_MODLOAD_DURUS + ML.VE_MODLOAD_CIKIS + 40);
      expect(kap.style.display).toBe('none');
      expect(ML.veModuleLoaderMesgul()).toBe(false);
    }
  });

  test('KADEME SAYISI adım listesinden yazılıyor — çentik dolguyla hizalansın', () => {
    const kap = kabuk();
    {
      ML.veModuleLoaderRun({ ad: 'X' }, adimlarKur());
      expect(kap.style.getPropertyValue('--mfsim-kademe')).toBe('3');
      ML.veModuleLoaderKapat();
      ML.veModuleLoaderRun({ ad: 'X' }, [{ ad: 'tek', is: jest.fn() }]);
      expect(kap.style.getPropertyValue('--mfsim-kademe')).toBe('1');
    }
  });

  test('MESAJ adım adını TEKRARLAMAZ — çalışırken boş, sonunda yalnız "Hazır"', () => {
    // Adımın adı listede yazılı; mesaj onu ikinci kez söylüyordu, adımın
    // "ayrıntısı" (`not`) da bir anlatımdı ("Bileşen paneli ve şerit yerine
    // oturuyor") — ARAYÜZ ANLATMAZ, aşama 1 kararı 2026-10-16. Verilen `not`
    // da basılmaz: kalıp açıklama yuvası taşımaz.
    kabuk();
    const a = adimlarKur();
    a[1].not = 'ikinci ayrıntı';
    const msg = () => document.getElementById('ve-modload-message').textContent;
    {
      ML.veModuleLoaderRun({ ad: 'X' }, a);
      expect(a[0].bitti).toBe(true);
      expect(msg()).toBe('');
      jest.advanceTimersByTime(ML.VE_MODLOAD_DURUS + 10);
      expect(a[1].bitti).toBe(true);
      expect(msg()).toBe('');
      jest.advanceTimersByTime(ML.VE_MODLOAD_DURUS * 2 + 30);
      expect(msg()).toBe('Hazır');
    }
  });

  test('bitmiş adım onay ikonu alıyor, çubuk q ORANINDAN geliyor', () => {
    kabuk();
    {
      ML.veModuleLoaderRun({ ad: 'X' }, adimlarKur());
      const li = document.querySelectorAll('#ve-modload-stages li');
      expect(li.length).toBe(3);
      expect(li[0].className).toContain('is-done');
      expect(li[0].querySelector('.mf-ico-check')).not.toBeNull();   // çizgi ikon (karar 10·B)
      // Yuvarlanmış yüzdeden DEĞİL: '33%' yazılsaydı dolgu çentiğin 0,3 punto
      // gerisinde kalırdı (açılış ekranında ölçülmüş aynı tuzak).
      const w = document.getElementById('ve-modload-bar').style.width;
      expect(w).not.toBe('33%');
      expect(parseFloat(w)).toBeCloseTo(100 / 3, 6);
      expect(document.getElementById('ve-modload-percent').textContent).toBe('%33');
    }
  });

  test('ikinci çağrı ÜSTÜNE BİNMİYOR', () => {
    kabuk();
    {
      ML.veModuleLoaderRun({ ad: 'X' }, adimlarKur());
      expect(ML.veModuleLoaderMesgul()).toBe(true);
      const b = adimlarKur();
      // Meşgulken ikinci çağrı ekranı yeniden kurmuyor ama işleri YİNE yapıyor
      // (yapmasaydı ikinci tıklama sessizce yutulurdu).
      expect(ML.veModuleLoaderRun({ ad: 'Y' }, b)).toBe(false);
      b.forEach((s) => expect(s.is).toHaveBeenCalledTimes(1));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('DOĞRUDAN GİRİŞ — veStartModule', () => {
  const sahne = () => {
    document.body.innerHTML =
      '<div class="ve-main"><div class="ve-canvas-wrapper" id="ve-canvas-wrapper"></div>'
      + '<div id="ve-module-overlay"></div></div>';
    global.canvasZoom = 1;
    global.canvasOffset = { x: 3000, y: 3000 };
    let k = 0;
    global.createNode = jest.fn((type, x, y) => {
      const n = { id: 'c' + (++k), type, x, y, data: {} };
      global.nodes.push(n);
      return n;
    });
  };
  const sok = () => { delete global.createNode; delete global.veFeadOpenEditor; };

  test('FEAD ve Takoz doğrudan girişi BEYAN EDİYOR, Araç Performans etmiyor', () => {
    // Kayıt TİPTE duruyor ki ikinci bir modül aynı davranışı tek satırla alsın —
    // ikincisi Takoz oldu (2026-10-14: FEAD'inki gibi bir başlangıç sayfası).
    expect(componentDefs['fead-analysis'].moduleEnter).toBe('veFeadOpenEditor');
    expect(componentDefs['mount-analysis'].moduleEnter).toBe('veMntOpenEditor');
    expect(componentDefs['arac-performans'].moduleEnter).toBeUndefined();
  });

  test('FEAD: açıcı ÇAĞRILIYOR, uçuş ve toast KURULMUYOR', () => {
    sahne();
    const acan = jest.fn();
    global.veFeadOpenEditor = acan;
    try {
      veStartModule('fead-analysis');
      // Kap yok → işler eşzamanlı koştu.
      expect(global.nodes.length).toBe(1);
      expect(acan).toHaveBeenCalledTimes(1);
      expect(acan.mock.calls[0][0]).toBe(global.nodes[0].id);
      // Uçuş --z-widget, toast 5000, ekran 9001: ikisi de ekranın ALTINDA
      // kalırdı. Görünmeyen bir animasyon kurmanın karşılığı yok.
      expect(document.querySelectorAll('.ve-welcome-flyer').length).toBe(0);
      expect(stubs.showToast).not.toHaveBeenCalled();
    } finally { sok(); }
  });

  test('açıcı YÜKLENMEMİŞSE eski yol birebir duruyor', () => {
    // `veFeadOpenEditor` global'de yoksa (modül yüklenmemiş) doğrudan giriş
    // sessizce kapanır ve kullanıcı yine kartı alır.
    sahne();
    try {
      veStartModule('fead-analysis');
      expect(global.nodes.length).toBe(1);
    } finally { sok(); }
  });

  test('doğrudan girişi OLMAYAN modülde "‹ad› eklendi" bildirimi YOK', () => {
    // Uçan kart eklendiğini gösteriyor; bildirim ekranda olanı ikinci kez
    // söylüyordu (ARAYÜZ ANLATMAZ, aşama 1 kararı 2026-10-16).
    sahne();
    try {
      veStartModule('arac-performans');
      expect(global.nodes.length).toBe(1);
      expect(stubs.showToast).not.toHaveBeenCalled();
    } finally { sok(); }
  });

  test('_veModuleEnterFn: beyan yoksa ya da işlev değilse NULL', () => {
    expect(_veModuleEnterFn('arac-performans')).toBe(null);
    global.veFeadOpenEditor = 'işlev değil';
    try { expect(_veModuleEnterFn('fead-analysis')).toBe(null); }
    finally { delete global.veFeadOpenEditor; }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('KABUK VE KURALLAR', () => {
  test('index.html kimlikleri taşıyor ve script bağlı', () => {
    expect(IDX).toContain('id="mfsim-module-loading"');
    Object.keys(ML.VE_MODLOAD_ELS).forEach((k) => {
      expect(IDX).toContain('id="' + ML.VE_MODLOAD_ELS[k] + '"');
    });
    expect(IDX).toContain('js/module-loader.js');
  });

  test('AİLENİN DİLİ — kesik karşılamanınki, içi .mfsim-loading-* ailesi', () => {
    // Üçüncü bir pencere dili kurmanın karşılığı yok: ekran karşılamanın
    // kesiğini taşır (2026-10-23'ten beri; geometrisi loader-splash.test.js
    // → KESİĞİNDE), içi kademe çubuğu ve öbek listesiyle .mfsim-loading-*
    // ailesinin sınıfları.
    const ekran = IDX.slice(IDX.indexOf('id="mfsim-module-loading"'));
    ['ve-kesik', 've-kesik-cizgi', 've-kesik-ic', 'mfsim-loading-panel', 'mfsim-loading-stages',
     'mfsim-loading-bar', 'mfsim-loading-bar-notches', 'mfsim-loading-sep'].forEach((c) => {
      expect(ekran).toMatch(new RegExp('class="(?:[^"]* )?' + c + '(?: [^"]*)?"'));
    });
  });

  test('ÇIKIŞ SÜRESİ CSS ile JS\'te AYNI', () => {
    // JS `display:none`ı bu sürenin sonunda yazıyor. Kısa olsaydı ekran
    // solmayı bitirmeden kaybolur, uzun olsaydı saydam bir kaplama tıklamayı
    // yutardı — ikisi de sessiz.
    const m = CSS.match(/\.mfsim-module-loading\.is-cikis\{[^}]*animation:ve-modload-cikis\s+(\d+)ms/);
    expect(m).toBeTruthy();
    expect(Number(m[1])).toBe(ML.VE_MODLOAD_CIKIS);
  });

  test('DURUŞ, ÇUBUĞUN GEÇİŞİNDEN UZUN — dolgu oturabilsin', () => {
    // Kademe çubuğu `--mfsim-kademe-sure` ile genişliyor. Duruş ondan kısa
    // olursa dolgu HİÇ OTURAMADAN bir sonraki adım geliyor ve çubuk sürekli
    // yolda görünüyor — ölçüldü, 170 ms'lik ilk değerde tam olarak buydu.
    const m = CSS.match(/--mfsim-kademe-sure:\s*(\d+)ms/);
    expect(m).toBeTruthy();
    expect(ML.VE_MODLOAD_DURUS).toBeGreaterThan(Number(m[1]));
  });

  test('KAPLAMA ANINDA GELİYOR — panelin koreografisi ayrı', () => {
    // Kaplamanın kendisi solarak gelseydi ilk karede arkasındaki boş tuval
    // görünürdü; koreografi bu yüzden PANELE ait.
    expect(CSS).toMatch(/\.mfsim-module-loading\{[^}]*opacity:1/);
    expect(CSS).toMatch(/\.mfsim-module-loading \.mfsim-loading-panel\{[^}]*animation:ve-modload-panel/);
    expect(CSS).toMatch(/@keyframes ve-modload-panel\{/);
  });

  test('hareket kısıtlıyken CSS de susuyor', () => {
    const bloklar = [];
    const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
    let m;
    while ((m = re.exec(CSS))) {
      let i = m.index + m[0].length, d = 1;
      while (i < CSS.length && d > 0) {
        if (CSS[i] === '{') d++; else if (CSS[i] === '}') d--;
        i++;
      }
      bloklar.push(CSS.slice(m.index, i));
    }
    expect(bloklar.some((b) => b.includes('mfsim-module-loading'))).toBe(true);
  });
});
