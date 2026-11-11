/**
 * canli-not-kopru.js — Canlı Not'un PROGRAM TARAFI (iframe'in içinde koşar)
 * ───────────────────────────────────────────────────────────────────────────
 * tools/canli-not.js bu dosyayı yayınlanan mfsim.html'e <meta charset>'ın
 * hemen arkasına gömer; MFSim'in kendi kodu DEĞİŞMEZ. Sayfayla (tools/canli-not.html)
 * postMessage üzerinden konuşur:  { cn: 1, tur: 'istek'|'cevap'|'olay', … }.
 *
 *   1. bağlam   — notun yazıldığı an programın durumu: sayfa, modül, açık
 *                 pencereler, pencerenin konusu, sürüm.
 *   2. öğeler   — çizilen bölgenin altındaki öğelerin künyesi (kimlik, sınıf,
 *                 metin, data-*, başlık zinciri). Kaynak bunlarla aranır.
 *   3. fotoğraf — DOM'un o anki hâli: betiksiz; girdi değeri, tuval pikseli,
 *                 kaydırma konumu taşınır. `node tools/canli-not.js goruntu`
 *                 aynı ekranı Playwright'ta yeniden çizer.
 *   4. ortam    — claude.ai çerçevesi confirm()/prompt()'u hep "hayır"
 *                 döndürüyor ve indirmeyi kapatıyor. Köprü soruyu sayfada
 *                 sorar, kabulde TETİKLEYEN olayı yeniden oynatır; indirmeyi
 *                 sayfanın `downloads` yetkisine taşır.
 *
 * Saf işlevler module.exports ile açılır (tests/unit/canli-not.test.js).
 * Tarayıcıda dosya kendini kurar — yalnız bir üst pencerenin içindeyse.
 */
(function (kok) {
  'use strict';

  var SURUM = 1;

  // ── küçük yardımcılar ────────────────────────────────────────────────────
  function kirp(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function yuvarla(r) {
    return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  }
  // Boş alanı atar: Artifact deposundaki belge 256 KiB ile sınırlı.
  function temizle(o) {
    Object.keys(o).forEach(function (k) {
      var v = o[k];
      if (v === undefined || v === null || v === '' ||
          (Array.isArray(v) && !v.length) ||
          (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) delete o[k];
    });
    return o;
  }
  function sinifi(el) {
    var c = el.getAttribute && el.getAttribute('class');
    return c ? c.split(/\s+/).filter(Boolean).slice(0, 6).join(' ') : '';
  }

  // ── CSS yolu: en yakın kimlikli ataya kadar etiket + nth-of-type ─────────
  function cssKacis(s) {
    return String(s).replace(/([^A-Za-z0-9_-])/g, '\\$1');
  }
  function cssYol(el) {
    var parcalar = [];
    for (var d = el, adim = 0; d && d.nodeType === 1 && adim < 12; d = d.parentElement, adim++) {
      var ad = d.tagName.toLowerCase();
      if (d.id) { parcalar.unshift('#' + cssKacis(d.id)); break; }
      if (ad === 'html' || ad === 'body') { parcalar.unshift(ad); break; }
      var sira = 1;
      for (var k = d.previousElementSibling; k; k = k.previousElementSibling) {
        if (k.tagName === d.tagName) sira++;
      }
      var kardes = false;
      for (var s = d.nextElementSibling; s && !kardes; s = s.nextElementSibling) {
        if (s.tagName === d.tagName) kardes = true;
      }
      parcalar.unshift(sira > 1 || kardes ? ad + ':nth-of-type(' + sira + ')' : ad);
    }
    return parcalar.join(' > ');
  }

  // ── öğenin künyesi ───────────────────────────────────────────────────────
  // Girdinin GÖRÜNEN değeri yerli alıcıdan okunur: js/sayi-alan.js örneğin
  // `value`sunu makine biçimine çeviriyor (ekranda 1716,25, .value 1716.25).
  var YERLI_DEGER = (typeof HTMLInputElement !== 'undefined')
    ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') : null;
  function gorunenDeger(el) {
    try {
      if (YERLI_DEGER && el instanceof HTMLInputElement) return YERLI_DEGER.get.call(el);
    } catch (e) { /* yerli alıcı yoksa .value */ }
    return el.value;
  }

  function kunye(el, kutuAl) {
    var k = {
      etiket: el.tagName.toLowerCase(),
      id: el.id || '',
      sinif: sinifi(el),
      metin: kirp(metni(el), 120),
      ad: kirp(el.getAttribute('aria-label') || el.getAttribute('title') ||
        el.getAttribute('placeholder') || el.getAttribute('alt') || el.getAttribute('name') || '', 80)
    };
    var data = {}, n = 0;
    for (var i = 0; i < el.attributes.length && n < 8; i++) {
      var a = el.attributes[i];
      if (a.name.indexOf('data-') === 0) { data[a.name.slice(5)] = kirp(a.value, 60); n++; }
    }
    k.data = data;
    var etiket = k.etiket;
    if (etiket === 'input' || etiket === 'select' || etiket === 'textarea') {
      var t = (el.getAttribute('type') || '').toLowerCase();
      if (t === 'checkbox' || t === 'radio') k.isaretli = !!el.checked;
      else k.deger = kirp(etiket === 'input' ? gorunenDeger(el) : el.value, 60);
    }
    var durum = [];
    if (el.disabled) durum.push('disabled');
    ['aria-disabled', 'aria-pressed', 'aria-expanded', 'aria-selected'].forEach(function (a) {
      var v = el.getAttribute(a);
      if (v !== null) durum.push(a.slice(5) + '=' + v);
    });
    k.durum = durum.join(' ');
    if (kutuAl) { try { k.kutu = yuvarla(kutuAl(el)); } catch (e) { /* kutu yok */ } }
    k.yol = cssYol(el);
    return temizle(k);
  }

  // ── anlamlı öğe: kaynakta aranabilir bir şey taşıyan ilk ata ─────────────
  var ANLAMLI_ETIKET = /^(button|a|input|select|textarea|label|td|th|li|h[1-6]|summary|option|legend|caption|img|canvas|text|tspan)$/;
  function kendiMetni(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3 && /\S/.test(c.nodeValue)) return true;
    }
    return false;
  }
  function anlamli(el) {
    if (!el || el.nodeType !== 1) return false;
    var ad = el.tagName.toLowerCase();
    if (ad === 'html' || ad === 'body') return false;
    if (el.id || ANLAMLI_ETIKET.test(ad) || el.getAttribute('role')) return true;
    for (var i = 0; i < el.attributes.length; i++) {
      if (el.attributes[i].name.indexOf('data-') === 0) return true;
    }
    return kendiMetni(el);
  }
  function anlamliAta(el) {
    for (var d = el, adim = 0; d && d.nodeType === 1 && adim < 6; d = d.parentElement, adim++) {
      if (anlamli(d)) return d;
    }
    return (el && el.nodeType === 1 && !/^(html|body)$/i.test(el.tagName)) ? el : null;
  }

  function ortakAta(liste) {
    if (!liste.length) return null;
    var zincir = [];
    for (var d = liste[0]; d; d = d.parentElement) zincir.push(d);
    var ortak = null;
    for (var i = 0; i < zincir.length && !ortak; i++) {
      var aday = zincir[i], hepsi = true;
      for (var j = 1; j < liste.length && hepsi; j++) hepsi = aday.contains(liste[j]);
      if (hepsi) ortak = aday;
    }
    return (ortak && !/^(html|body)$/i.test(ortak.tagName)) ? ortak : null;
  }

  // ── başlık zinciri: öğeden yukarı, her atanın adı ───────────────────────
  // Ad, atanın aria-label'ı (pencere kategorisi `.ve-fp-kat` böyle taşır) ya da
  // doğrudan çocuğu olan başlık: pencere başlığı, bölüm başlığı (`.ve-fp-sect`'in
  // <b>'si), h1–h6. Genel `header`/`*-head` sınıfı SAYILMAZ: başlığın altındaki
  // alt yazıyla birleşip "FEADKayış YoluGerginlik…" üretiyordu (ölçüldü).
  var BASLIK_SECICI = '.ve-settings-header, .ve-fp-sect, .ve-settings-section-title, [class*="baslik"], ' +
    '[class*="-title"], h1, h2, h3, h4, h5, h6, legend, caption, summary';
  function metni(el) {
    return (typeof el.innerText === 'string' && el.innerText) ? el.innerText : el.textContent;
  }
  function baslikMetni(el) {
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
      if (/^(B|STRONG)$/.test(c.tagName)) return kirp(c.textContent, 60);
    }
    return kirp(String(metni(el) || '').split('\n').filter(function (s) { return s.trim(); })[0] || '', 60);
  }
  // Başlık hedefin ÖNÜNDE olmalı: atanın, hedefi taşıyan dalından önceki en
  // yakın başlık çocuğu. Sonraki kardeşin başlığı başka bir bölümün adıdır
  // (ölçüldü: "Kılavuz" düğmesi sayfanın altındaki "Gates raporlarından başla"
  // başlığını alıyordu).
  function basliklar(el) {
    var cikti = [];
    for (var dal = el, d = el && el.parentElement; d && d.nodeType === 1 && !/^(html|body)$/i.test(d.tagName); dal = d, d = d.parentElement) {
      var ad = '';
      for (var c = dal.previousElementSibling; c && !ad; c = c.previousElementSibling) {
        if (c.matches && c.matches(BASLIK_SECICI)) ad = baslikMetni(c);
      }
      if (ad && cikti.indexOf(ad) < 0) cikti.unshift(ad);
      var etiket = kirp(d.getAttribute('aria-label') || '', 60);
      if (etiket && cikti.indexOf(etiket) < 0) cikti.unshift(etiket);
      if (cikti.length >= 6) break;
    }
    if (el && el.nodeType === 1) {
      var kendi = kirp(el.getAttribute('aria-label') || '', 60);
      if (kendi && cikti.indexOf(kendi) < 0) cikti.push(kendi);
    }
    return cikti;
  }

  // ── bölgeden öğe seçimi ──────────────────────────────────────────────────
  // bolgeler: [[x, y, g, y], …] iframe'in görüş alanında CSS px — daire, kutu
  // ve elle çizginin kutusu. Okun gövdesi bölge DEĞİL (geçtiği yer değil,
  // gösterdiği yer önemli): ucu `uclar`la ayrıca okunur. Bölge ızgarayla
  // örneklenir; her noktanın EN ÜSTTEKİ öğesi (kullanıcının gördüğü) anlamlı
  // atasına çıkar. Kutusunun yarısından çoğu bölgede kalan öğe ÇEVRELENMİŞTİR
  // ve arka plandan önce gelir: düğmenin çevresine daire çizen kullanıcı
  // düğmeyi kastediyor, altındaki sayfayı değil (ölçüldü: isabet sırası
  // sayfanın kendisini %59'la başa koyuyordu).
  function ogeleriSec(doc, bolgeler, secenek) {
    secenek = secenek || {};
    var noktada = secenek.noktada || function (x, y) {
      return doc.elementsFromPoint ? doc.elementsFromPoint(x, y) : [];
    };
    var kutuAl = secenek.kutuAl || function (el) { return el.getBoundingClientRect(); };
    var isabet = new Map(), icPay = new Map(), sira = [], toplam = 0;
    function pay(el, b) {
      var r;
      try { r = kutuAl(el); } catch (e) { return 0; }
      if (!(r && r.width > 0 && r.height > 0)) return 0;
      var x0 = Math.max(r.left, b[0]), y0 = Math.max(r.top, b[1]);
      var x1 = Math.min(r.left + r.width, b[0] + b[2]), y1 = Math.min(r.top + r.height, b[1] + b[3]);
      return (x1 > x0 && y1 > y0) ? ((x1 - x0) * (y1 - y0)) / (r.width * r.height) : 0;
    }
    (bolgeler || []).forEach(function (b) {
      var x = b[0], y = b[1], g = Math.max(1, b[2]), h = Math.max(1, b[3]);
      var nx = Math.max(2, Math.min(9, Math.round(g / 24) + 1));
      var ny = Math.max(2, Math.min(9, Math.round(h / 24) + 1));
      for (var i = 0; i < nx; i++) {
        for (var j = 0; j < ny; j++) {
          toplam++;
          var ust = (noktada(x + g * (0.08 + 0.84 * i / (nx - 1)), y + h * (0.08 + 0.84 * j / (ny - 1))) || [])[0];
          var a = ust ? anlamliAta(ust) : null;
          if (!a) continue;
          if (!isabet.has(a)) { isabet.set(a, 0); sira.push(a); }
          isabet.set(a, isabet.get(a) + 1);
          var p = pay(a, b);
          if (!(icPay.get(a) >= p)) icPay.set(a, p);
        }
      }
    });
    sira.sort(function (p, q) { return isabet.get(q) - isabet.get(p); });
    var cevrili = sira.filter(function (el) { return icPay.get(el) >= 0.5; });
    var cevre = sira.filter(function (el) { return !(icPay.get(el) >= 0.5); });
    var yaz = function (el) {
      var k = kunye(el, kutuAl);
      k.pay = Math.round(100 * isabet.get(el) / Math.max(1, toplam));
      k.ic = Math.round(100 * (icPay.get(el) || 0));
      return k;
    };
    var oklar = [];
    (secenek.uclar || []).forEach(function (u) {
      var ust = (noktada(u[0], u[1]) || [])[0];
      var a = ust ? anlamliAta(ust) : null;
      if (a && oklar.indexOf(a) < 0) oklar.push(a);
    });
    var odak = cevrili.concat(oklar);
    // Kap, odaktakileri taşıyan ata; tek öğe çevriliyse onun anlamlı atası.
    var kap = ortakAta(odak.length ? odak : sira);
    if (kap && odak.indexOf(kap) >= 0) kap = kap.parentElement ? anlamliAta(kap.parentElement) : null;
    return temizle({
      ic: cevrili.slice(0, 10).map(yaz),
      cevre: cevre.slice(0, 4).map(yaz),
      ok: oklar.map(function (el) { return kunye(el, kutuAl); }),
      kap: kap ? kunye(kap, kutuAl) : null,
      basliklar: basliklar(odak[0] || kap || sira[0] || null)
    });
  }

  // ── bağlam: MFSim'in global durumu (hepsi `var`, yani pencerenin alanı) ──
  function gorunurMu(el) {
    return !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length));
  }
  function baglam(win, secenek) {
    secenek = secenek || {};
    var gorunur = secenek.gorunur || gorunurMu;
    var al = function (ad) { try { return win[ad]; } catch (e) { return undefined; } };
    var b = {};
    var surum = al('__MFSIM_BUILD');
    if (surum) { b.surum = surum.shortSha || ''; b.pr = surum.prNumber || ''; }
    b.sayfa = al('currentSubTab');
    b.kapsam = al('veSidebarScope');
    b.modul = al('veActiveModule');
    var derinlik = {};
    [['fead', 'veFeadStack'], ['takoz', 'veMntStack'], ['arac', 'veAracStack']].forEach(function (p) {
      var s = al(p[1]);
      if (s && s.length) derinlik[p[0]] = s.length;
    });
    b.derinlik = derinlik;
    var sekmeler = al('veTabs'), i = al('veActiveTabIdx');
    if (sekmeler && sekmeler[i]) b.sekme = sekmeler[i].name;
    b.proje = al('veProjectName');
    var konuFn = al('veMufettisKonusu');
    if (typeof konuFn === 'function') {
      try {
        var n = konuFn();
        if (n) {
          var defs = al('componentDefs');
          b.konu = temizle({
            tip: n.type,
            ad: n.customName || (defs && defs[n.type] && defs[n.type].name) || n.type,
            id: n.id
          });
        }
      } catch (e) { /* konu yok */ }
    }
    var doc = win.document, pencereler = [];
    if (doc) {
      var bas = doc.querySelectorAll('.ve-settings-header');
      for (var j = 0; j < bas.length && pencereler.length < 6; j++) {
        if (gorunur(bas[j])) pencereler.push(kirp(bas[j].textContent, 60));
      }
      b.tema = doc.documentElement.getAttribute('data-theme') || '';
    }
    b.pencereler = pencereler;
    b.ekran = { g: win.innerWidth, y: win.innerHeight, dpr: win.devicePixelRatio || 1 };
    return temizle(b);
  }

  // ── program hazır mı: giriş ekranı ve açılış perdesi kapandı, kayıt
  // işlevleri tanımlı. Önceki durum ancak bundan sonra geri yüklenir —
  // yükleyici modülleri girişten SONRA kuruyor (js/loader.js).
  function programDurumu(win) {
    var doc = win.document;
    var acik = function (id) {
      var el = doc.getElementById(id);
      if (!el) return false;
      var st = win.getComputedStyle ? win.getComputedStyle(el) : el.style;
      return st.display !== 'none' && st.visibility !== 'hidden';
    };
    var giris = acik('mfsim-login-overlay');
    var perde = acik('mfsim-loading-screen');
    var islev = typeof win._veSettingsApplyProjectData === 'function' && Array.isArray(win.veTabs);
    return { giris: giris, perde: perde, hazir: !giris && !perde && islev };
  }

  // ── DOM fotoğrafı ────────────────────────────────────────────────────────
  // Klon ÖNCE özgün öğelerle eşlenir (betik silinince sıralar kayar), sonra
  // betikler atılır. Girdinin canlı değeri özniteliğe, tuvalin pikseli
  // <img>'ye, kaydırma `data-cn-kaydir`a yazılır.
  function foto(doc) {
    var kokEl = doc.documentElement;
    var klon = kokEl.cloneNode(true);
    var asil = kokEl.getElementsByTagName('*');
    var kopya = klon.getElementsByTagName('*');
    var asilL = Array.prototype.slice.call(asil), kopyaL = Array.prototype.slice.call(kopya);
    var degisim = [];
    for (var i = 0; i < asilL.length && i < kopyaL.length; i++) {
      var a = asilL[i], k = kopyaL[i], ad = a.tagName;
      if (ad === 'INPUT') {
        var t = (a.getAttribute('type') || '').toLowerCase();
        if (t === 'checkbox' || t === 'radio') {
          if (a.checked) k.setAttribute('checked', ''); else k.removeAttribute('checked');
        } else if (t !== 'file' && t !== 'password') {
          k.setAttribute('value', gorunenDeger(a));
        }
      } else if (ad === 'TEXTAREA') {
        k.textContent = a.value;
      } else if (ad === 'SELECT') {
        var sa = a.options, sk = k.options;
        for (var o = 0; o < sa.length && o < sk.length; o++) {
          if (sa[o].selected) sk[o].setAttribute('selected', ''); else sk[o].removeAttribute('selected');
        }
      } else if (ad === 'CANVAS') {
        degisim.push([a, k]);
      }
      if (a.scrollTop || a.scrollLeft) k.setAttribute('data-cn-kaydir', a.scrollLeft + ',' + a.scrollTop);
    }
    degisim.forEach(function (p) {
      try {
        var url = p[0].toDataURL('image/png');
        var img = doc.createElement('img');
        ['id', 'class', 'style'].forEach(function (n) {
          var v = p[1].getAttribute(n);
          if (v !== null) img.setAttribute(n, v);
        });
        var r = p[0].getBoundingClientRect();
        img.setAttribute('width', String(Math.round(r.width) || p[0].width));
        img.setAttribute('height', String(Math.round(r.height) || p[0].height));
        img.setAttribute('src', url);
        p[1].parentNode.replaceChild(img, p[1]);
      } catch (e) { /* kirli ya da desteksiz tuval: olduğu gibi kalır */ }
    });
    var at = klon.querySelectorAll('script, noscript');
    for (var s = 0; s < at.length; s++) at[s].parentNode.removeChild(at[s]);
    var win = doc.defaultView;
    if (win) klon.setAttribute('data-cn-pencere', (win.scrollX || 0) + ',' + (win.scrollY || 0));
    return '<!doctype html>\n' + klon.outerHTML;
  }

  // ── odak: programı bir bileşende açar ────────────────────────────────────
  // Kullanıcı 2026-11-11: bir bileşene ayrılmış Canlı Not (çekirdek → ODAKLAR). Sayfa
  // her açılışta — taşınan proje yüklendikten SONRA — tarifi adıyla ister. Tarif
  // YERİNDEKİNİ KULLANIR: Takoz'daysa modüle yeniden girmez, model varsa örnek yüklemez,
  // bileşen varsa yenisini kurmaz; Güncelle ve Yenile kullanıcıyı aynı pencereye getirir.
  // Tarif KENDİ BAŞINA durur (yalnız `win`, yani programın globalleri):
  // `tools/canli-not.js sonuc --odak` onu metin olarak sonucun sayfasına da koyar.
  var ODAKLAR = {
    parametrik: function (win) {
      var ORNEK = 'tulga', TIP = 'mnt-parametric';
      var kurulan = false;
      function kosul(f, sure) {
        return new Promise(function (coz, red) {
          var t0 = Date.now();
          (function yokla() {
            var v = null;
            try { v = f(); } catch (e) { v = null; }
            if (v) { coz(v); return; }
            if (Date.now() - t0 > sure) { red(new Error('odak: ' + TIP + ' açılamadı')); return; }
            win.setTimeout(yokla, 100);
          })();
        });
      }
      function dugum(tip) {
        return (win.nodes || []).filter(function (n) { return n && n.type === tip; })[0] || null;
      }
      function takozda() { return !!(win.veMntStack && win.veMntStack.length); }
      function modelVar() {
        var defs = win.componentDefs || {};
        return (win.nodes || []).some(function (n) { var d = (n && defs[n.type]) || {}; return d.isMountBody || d.isMount; });
      }
      // Araç şeridinde boş yer: Rapor'un altı, solu, sağı — ne bir kutuya ne de bir gruplama
      // çerçevesinin çizgisine değen ilk aday. Ad kutunun altında ve iki yana taşar: kutular
      // arasında 22 px (şeridin 105 px adımı sığar), çerçeveye karşı bileşenin uzun adı (45 px).
      function yer(def) {
        var w = def.defaultWidth || 60, h = def.defaultHeight || 56, alt = 24;
        var carpar = function (a, b) { return a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1]; };
        var icinde = function (a, b) { return a[0] >= b[0] && a[1] >= b[1] && a[0] + a[2] <= b[0] + b[2] && a[1] + a[3] <= b[1] + b[3]; };
        var cerceveler = (win.annotations || []).filter(function (a) { return a && a.type === 'frame'; })
          .map(function (a) { return [a.x, a.y, a.width || 0, a.height || 0]; });
        var bos = function (p) {
          var k = [p[0] - 22, p[1], w + 44, h + alt], ad = [p[0] - 45, p[1], w + 90, h + alt];
          return !(win.nodes || []).some(function (n) { return carpar(k, [n.x - 22, n.y, (n.width || 60) + 44, (n.height || 56) + alt]); }) &&
            !cerceveler.some(function (c) { return carpar(ad, c) && !icinde(ad, c); });
        };
        var r = dugum('mnt-report');
        var adaylar = r ? [[r.x, r.y + 160], [r.x - 105, r.y + 160], [r.x + 105, r.y]] : [];
        for (var i = 0; i < adaylar.length; i++) if (bos(adaylar[i])) return adaylar[i];
        // Hiçbiri boş değilse her şeyin sağı (kutular ve çerçeveler), en üst sırada.
        var sag = -Infinity, ust = Infinity;
        (win.nodes || []).forEach(function (n) { sag = Math.max(sag, n.x + (n.width || 60)); ust = Math.min(ust, n.y); });
        cerceveler.forEach(function (c) { sag = Math.max(sag, c[0] + c[2]); });
        return isFinite(sag) && isFinite(ust) ? [sag + 90, ust] : [3000, 3000];
      }
      var bekle = function (ms) { return new Promise(function (r) { win.setTimeout(r, ms); }); };
      var n = null;
      return Promise.resolve().then(function () {
        if (takozda()) return true;
        var kart = dugum('mount-analysis');
        if (kart) {
          // Taşınan proje: kart kökte. Karşılama açıksa kapanır, kartın içine girilir.
          var kap = win.document.getElementById('ve-module-overlay');
          if (kap && kap.style.display !== 'none' && typeof win.veSelectModuleFromOverlay === 'function') win.veSelectModuleFromOverlay('arac-performans');
          win.veMntOpenEditor(kart.id);
        } else {
          kurulan = true;
          win.veStartModule('mount-analysis');                 // karşılamanın Takoz satırının yolu
        }
        return kosul(takozda, 30000);
      }).then(function () {
        if (modelVar()) return true;
        kurulan = true;
        win.veMntOrnekYukle(ORNEK);
        return kosul(modelVar, 30000);
      }).then(function () {
        n = dugum(TIP);
        if (n) return true;
        kurulan = true;
        var p = yer((win.componentDefs || {})[TIP] || {});
        n = win.createNode(TIP, p[0], p[1]);
        if (!n) throw new Error('odak: ' + TIP + ' kurulamadı');
        return bekle(80);                                      // createNode seçimini bir kare sonra yapıyor
      }).then(function () {
        // Açılış durumu geri alınamaz: Ctrl+Z kurulan odağı sökmesin.
        if (kurulan && typeof win.veStateResetBaseline === 'function') win.veStateResetBaseline();
        win.clearSelection();
        win.addToSelection(n);
        win.veTogglePropertiesPanel(true);
        // Pencere bileşenin: kitin kökü (data-mnt-pencere) açık sütunda — içeriği ne olursa olsun
        // (Canlı Not 1001'den beri pencere boş, yeniden kuruluyor).
        return kosul(function () { return win.document.querySelector('.ve-properties-content [data-mnt-pencere="' + n.id + '"]'); }, 15000);
      }).then(function () { return { tip: TIP, id: n.id, kurulan: kurulan }; });
    }
  };

  // ═══ kurulum (yalnız tarayıcıda, bir üst pencerenin içinde) ═════════════
  function kur(win) {
    if (!win || win.parent === win || win.__cnKopru) return;
    win.__cnKopru = SURUM;
    var doc = win.document;
    var ust = win.parent;

    function yolla(tur, ad, veri, no) {
      try { ust.postMessage({ cn: 1, tur: tur, ad: ad, no: no, veri: veri }, '*'); } catch (e) { /* üst yok */ }
    }

    // ortam yoklaması: eval kapalıysa üç özellik başka davranır
    var ortam = { eval: true, indir: true };
    try { (0, win.eval)('1'); } catch (e) { ortam.eval = false; }

    // ── onay: confirm/prompt sayfada sorulur, kabulde olay yeniden oynar ──
    var son = null, bekleyen = null, hazirCevap = null;
    ['click', 'dblclick', 'keydown'].forEach(function (tur) {
      doc.addEventListener(tur, function (e) {
        if (!e.isTrusted) return;
        son = { hedef: e.target, tur: tur, zaman: Date.now(),
          x: e.clientX, y: e.clientY, key: e.key, code: e.code,
          ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey };
      }, true);
    });
    function sor(tur, mesaj, varsayilan) {
      mesaj = String(mesaj == null ? '' : mesaj);
      if (hazirCevap && hazirCevap.mesaj === mesaj && Date.now() - hazirCevap.zaman < 15000) {
        var c = hazirCevap; hazirCevap = null;
        return c.deger;
      }
      var olay = (son && Date.now() - son.zaman < 3000) ? son : null;
      bekleyen = { tur: tur, mesaj: mesaj, olay: olay };
      yolla('olay', 'onay', { tur: tur, mesaj: mesaj, varsayilan: varsayilan == null ? '' : String(varsayilan), tekrar: !!olay });
      return tur === 'prompt' ? null : false;
    }
    function oynat(o) {
      if (!o || !o.hedef || !o.hedef.isConnected) return false;
      var ev;
      if (o.tur === 'keydown') {
        ev = new win.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: o.key, code: o.code,
          ctrlKey: o.ctrl, shiftKey: o.shift, altKey: o.alt, metaKey: o.meta });
      } else {
        ev = new win.MouseEvent(o.tur, { bubbles: true, cancelable: true, view: win,
          clientX: o.x, clientY: o.y, detail: o.tur === 'dblclick' ? 2 : 1 });
      }
      o.hedef.dispatchEvent(ev);
      return true;
    }
    win.confirm = function (m) { return sor('confirm', m); };
    win.prompt = function (m, d) { return sor('prompt', m, d); };
    win.alert = function (m) { yolla('olay', 'uyari', { mesaj: String(m == null ? '' : m) }); };

    // ── indirme: blob/data bağlantısı sayfanın downloads yetkisine gider ──
    // URL.createObjectURL'ün haritası ŞART: MFSim a.click()'ten hemen sonra
    // revokeObjectURL çağırıyor, yani adres sonradan okunamaz.
    var bloblar = new Map();
    var asilAdres = win.URL.createObjectURL;
    win.URL.createObjectURL = function (nesne) {
      var u = asilAdres.call(win.URL, nesne);
      if (nesne instanceof win.Blob) {
        bloblar.set(u, nesne);
        if (bloblar.size > 40) bloblar.delete(bloblar.keys().next().value);
      }
      return u;
    };
    var asilTik = win.HTMLAnchorElement.prototype.click;
    win.HTMLAnchorElement.prototype.click = function () {
      var href = this.getAttribute('href') || '';
      if (this.hasAttribute('download') && /^(blob:|data:)/.test(href)) {
        var veri = href.indexOf('blob:') === 0 ? bloblar.get(href) : href;
        if (veri) { yolla('olay', 'indir', { ad: this.getAttribute('download') || 'dosya', veri: veri }); return; }
      }
      return asilTik.call(this);
    };
    // Kaydet penceresi alt çerçevede açılmıyor; MFSim bağlantı yoluna düşsün.
    try { win.showSaveFilePicker = undefined; } catch (e) { /* salt okunur */ }

    // ── kısayol: Alt+N kalemi açar (odak programdayken de) ───────────────
    doc.addEventListener('keydown', function (e) {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyN') {
        e.preventDefault(); e.stopPropagation();
        yolla('olay', 'kisayol', { ad: 'kalem' });
      }
    }, true);

    // ── istekler ─────────────────────────────────────────────────────────
    win.addEventListener('message', function (e) {
      var m = e.data;
      if (!m || m.cn !== 1 || m.tur !== 'istek' || e.source !== ust) return;
      var cevap = function (veri) { yolla('cevap', m.ad, veri, m.no); };
      try {
        if (m.ad === 'baglam') cevap(baglam(win));
        else if (m.ad === 'ogeler') cevap(ogeleriSec(doc, m.veri.bolgeler, { uclar: m.veri.uclar }));
        else if (m.ad === 'foto') cevap(foto(doc));
        else if (m.ad === 'proje') {
          var f = win._veSettingsBuildProjectData;
          cevap(typeof f === 'function' ? f() : null);
        } else if (m.ad === 'yukle') {
          var y = win._veSettingsApplyProjectData;
          cevap(typeof y === 'function' && m.veri ? !!y(m.veri) : false);
        } else if (m.ad === 'durum') {
          cevap(programDurumu(win));
        } else if (m.ad === 'odak') {
          var tarif = Object.prototype.hasOwnProperty.call(ODAKLAR, String(m.veri)) ? ODAKLAR[m.veri] : null;
          if (!tarif) cevap({ hata: 'odak yok: ' + m.veri });
          else tarif(win).then(cevap, function (h) { cevap({ hata: String(h && h.message || h) }); });
        } else if (m.ad === 'onay') {
          // Kabulde cevap 15 sn hazır bekler: olay yeniden oynatılamazsa
          // (tetikleyen öğe kapandı) kullanıcı işlemi yineleyince geçer.
          var b = bekleyen, oynadi = false; bekleyen = null;
          if (b && m.veri && m.veri.kabul) {
            hazirCevap = { mesaj: b.mesaj, deger: b.tur === 'prompt' ? String(m.veri.deger == null ? '' : m.veri.deger) : true, zaman: Date.now() };
            oynadi = oynat(b.olay);
          }
          cevap({ oynadi: oynadi });
        } else cevap(null);
      } catch (hata) {
        yolla('cevap', m.ad, { hata: String(hata && hata.message || hata) }, m.no);
      }
    });

    yolla('olay', 'basladi', { ortam: ortam, surum: SURUM });
    var hazir = function () { yolla('olay', 'hazir', { ortam: ortam }); };
    if (doc.readyState === 'complete') hazir();
    else win.addEventListener('load', hazir);
  }

  var api = {
    kirp: kirp, cssYol: cssYol, kunye: kunye, anlamli: anlamli, anlamliAta: anlamliAta,
    ortakAta: ortakAta, basliklar: basliklar, ogeleriSec: ogeleriSec, baglam: baglam,
    foto: foto, programDurumu: programDurumu, ODAKLAR: ODAKLAR, kur: kur
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kur(kok);
})(typeof window !== 'undefined' ? window : this);
