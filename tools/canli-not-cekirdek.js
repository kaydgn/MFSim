/**
 * canli-not-cekirdek.js — Canlı Not'un SAF çekirdeği (DOM'suz)
 * ───────────────────────────────────────────────────────────────────────────
 * Sayfa (tools/canli-not.html, yayında satır içi) ile araç (tools/canli-not.js)
 * AYNI dosyayı okur: çizimin yol verisi, notun yer özeti, Claude'a giden yorum
 * metni ve notun doğrulaması tek yerde. Ayrışsaydı sayfanın çizdiği ile
 * aracın yeniden çizdiği iki ayrı resim olurdu.
 *
 * Koordinatlar iframe'in görüş alanında CSS px (programın kendi ekranı).
 */
(function (kok) {
  'use strict';

  var DURUMLAR = {
    bekliyor: 'Bekliyor',
    uygulaniyor: 'Uygulanıyor',
    uygulandi: 'Uygulandı',
    soru: 'Soru',
    iptal: 'İptal'
  };
  var ARACLAR = { kalem: 'Kalem', daire: 'Daire', ok: 'Ok', kutu: 'Kutu' };
  var MODULLER = {
    top: 'Ana topoloji',
    'fead-analysis': 'FEAD',
    'mount-analysis': 'Takoz',
    'arac-performans': 'Araç Performans'
  };
  var SAYFALAR = { 'arac-performans': 'Topoloji', sonuclar: 'Sonuçlar' };
  var YORUM_SINIR = 3800;   // bayt; yorumun sınırı 4 KiB

  function sayi(n) { return Math.round(n * 10) / 10; }   // makine: yol verisi
  function nokta(p) { return sayi(p[0]) + ' ' + sayi(p[1]); }

  // ── Ramer–Douglas–Peucker: elle çizginin noktalarını seyreltir ──────────
  function sadelestir(noktalar, tolerans) {
    if (noktalar.length < 3) return noktalar.slice();
    var t2 = tolerans * tolerans;
    function uzaklik2(p, a, b) {
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var l2 = dx * dx + dy * dy;
      var u = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
      var x = a[0] + u * dx - p[0], y = a[1] + u * dy - p[1];
      return x * x + y * y;
    }
    var tut = new Array(noktalar.length);
    tut[0] = tut[noktalar.length - 1] = true;
    var yigin = [[0, noktalar.length - 1]];
    while (yigin.length) {
      var ab = yigin.pop(), a = ab[0], b = ab[1], enUzak = -1, enD = t2;
      for (var i = a + 1; i < b; i++) {
        var d = uzaklik2(noktalar[i], noktalar[a], noktalar[b]);
        if (d > enD) { enD = d; enUzak = i; }
      }
      if (enUzak > 0) { tut[enUzak] = true; yigin.push([a, enUzak], [enUzak, b]); }
    }
    return noktalar.filter(function (p, i) { return tut[i]; });
  }

  function kutuNoktalar(noktalar) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    noktalar.forEach(function (p) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    });
    if (!isFinite(x0)) return [0, 0, 0, 0];
    return [Math.round(x0), Math.round(y0), Math.round(x1 - x0), Math.round(y1 - y0)];
  }

  // ── şekil: aracın adı + iki uç (ya da elle çizginin noktaları) → yol ────
  function sekilKur(arac, noktalar) {
    if (!ARACLAR[arac]) throw new Error('bilinmeyen araç: ' + arac);
    if (!noktalar || !noktalar.length) throw new Error('nokta yok');
    var a = noktalar[0], b = noktalar[noktalar.length - 1];
    var s = { arac: arac };
    if (arac === 'kalem') {
      var sade = sadelestir(noktalar, 1.5);
      s.d = 'M ' + nokta(sade[0]) + (sade.length > 1 ? ' L ' + sade.slice(1).map(nokta).join(' L ') : ' l 0 0');
      s.kutu = kutuNoktalar(noktalar);
    } else if (arac === 'kutu' || arac === 'daire') {
      var x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]);
      var g = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
      if (arac === 'kutu') {
        s.d = 'M ' + nokta([x, y]) + ' H ' + sayi(x + g) + ' V ' + sayi(y + h) + ' H ' + sayi(x) + ' Z';
      } else {
        var rx = g / 2, ry = h / 2, cx = x + rx, cy = y + ry;
        s.d = 'M ' + nokta([cx - rx, cy]) + ' A ' + sayi(rx) + ' ' + sayi(ry) + ' 0 1 0 ' + nokta([cx + rx, cy]) +
          ' A ' + sayi(rx) + ' ' + sayi(ry) + ' 0 1 0 ' + nokta([cx - rx, cy]) + ' Z';
      }
      s.kutu = [Math.round(x), Math.round(y), Math.round(g), Math.round(h)];
    } else {   // ok: a'dan b'ye, ucu b'de
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      var ux = dx / l, uy = dy / l, boy = Math.min(16, Math.max(8, l * 0.3));
      var k1 = [b[0] - boy * (ux * 0.87 - uy * 0.5), b[1] - boy * (uy * 0.87 + ux * 0.5)];
      var k2 = [b[0] - boy * (ux * 0.87 + uy * 0.5), b[1] - boy * (uy * 0.87 - ux * 0.5)];
      s.d = 'M ' + nokta(a) + ' L ' + nokta(b) + ' M ' + nokta(k1) + ' L ' + nokta(b) + ' L ' + nokta(k2);
      s.uc = [Math.round(b[0]), Math.round(b[1])];
      s.kutu = kutuNoktalar([a, b]);
    }
    return s;
  }

  // Şekiller boşken null: bölgesiz not yok.
  function kutuBirlesim(sekiller) {
    if (!sekiller || !sekiller.length) return null;
    var n = [];
    sekiller.forEach(function (s) {
      n.push([s.kutu[0], s.kutu[1]], [s.kutu[0] + s.kutu[2], s.kutu[1] + s.kutu[3]]);
    });
    return kutuNoktalar(n);
  }

  // Öğe seçiminin girdisi: okun gövdesi bölge değil, yalnız ucu okunur.
  function bolgeler(sekiller) {
    return (sekiller || []).filter(function (s) { return s.arac !== 'ok'; }).map(function (s) { return s.kutu; });
  }
  function uclar(sekiller) {
    return (sekiller || []).filter(function (s) { return s.arac === 'ok' && s.uc; }).map(function (s) { return s.uc; });
  }

  // ── yer özeti: "FEAD › Kayış Tablosu" ─────────────────────────────────────
  // Başlık zinciri en sağlam iz (kullanıcının gördüğü ad); yoksa açık pencere,
  // pencerenin konusu, modül, sayfa.
  function yerOzeti(baglam, secim) {
    baglam = baglam || {}; secim = secim || {};
    var parca = [];
    var sayfa = SAYFALAR[baglam.sayfa];
    if (sayfa === 'Sonuçlar') parca.push(sayfa);
    else if (baglam.kapsam && baglam.kapsam !== 'top' && MODULLER[baglam.kapsam]) parca.push(MODULLER[baglam.kapsam]);
    // Sayfanın adı ("Topoloji") başlık zincirinde de geçer; bir kez yeter.
    var bas = (secim.basliklar || []).filter(function (b) { return b !== sayfa; }).slice(-2);
    if (bas.length) parca = parca.concat(bas);
    else if (baglam.pencereler && baglam.pencereler.length) parca.push(baglam.pencereler[baglam.pencereler.length - 1]);
    else if (baglam.konu && baglam.konu.ad) parca.push(baglam.konu.ad);
    if (!parca.length) parca.push(sayfa || 'Program');
    var cikti = [];
    parca.forEach(function (p) { if (cikti.indexOf(p) < 0) cikti.push(p); });
    return cikti.join(' › ');
  }

  function baytBoyu(s) {
    return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : unescape(encodeURIComponent(s)).length;
  }
  function baytKirp(s, sinir) {
    if (baytBoyu(s) <= sinir) return s;
    var lo = 0, hi = s.length;
    while (lo < hi) {
      var m = (lo + hi + 1) >> 1;
      if (baytBoyu(s.slice(0, m)) + 3 <= sinir) lo = m; else hi = m - 1;
    }
    return s.slice(0, lo) + '…';
  }

  // Claude'a giden yorumun metni: numara + yer ilk satırda, not altında.
  function yorumMetni(not) {
    var bas = 'Not ' + not.no + (not.yer ? ' · ' + not.yer : '');
    return baytKirp(bas + '\n' + String(not.metin || '').trim(), YORUM_SINIR);
  }

  // ── doğrulama: araç bozuk notu SESSİZCE çizmez ───────────────────────────
  function notDogrula(n) {
    var h = [];
    if (!n || typeof n !== 'object') return ['not bir nesne olmalı'];
    if (!(Number.isInteger(n.no) && n.no > 0)) h.push('no pozitif tam sayı olmalı');
    if (typeof n.metin !== 'string' || !n.metin.trim()) h.push('metin boş');
    if (!DURUMLAR[n.durum]) h.push('durum ' + Object.keys(DURUMLAR).join(' | ') + ' olmalı');
    if (typeof n.sira !== 'number') h.push('sira sayı olmalı');
    var c = n.cizim;
    if (!c || typeof c !== 'object') h.push('çizim yok');
    else {
      if (!(c.g > 0 && c.y > 0)) h.push('çizimin ekran ölçüsü yok');
      if (!Array.isArray(c.sekiller) || !c.sekiller.length) h.push('çizimde şekil yok');
      else c.sekiller.forEach(function (s, i) {
        if (!s || !ARACLAR[s.arac] || typeof s.d !== 'string' || !/^M /.test(s.d)) h.push('şekil ' + (i + 1) + ' bozuk');
      });
    }
    return h;
  }

  // İŞ SIRASI eskiden yeniye (notlar sırayla uygulanır — `canli-not.js liste`)
  function siraliNotlar(liste) {
    return liste.slice().sort(function (a, b) {
      return (a.sira - b.sira) || (a.no - b.no);
    });
  }
  // SAYFANIN LİSTESİ yeniden eskiye (kullanıcı 2026-11-05: *"Yeni güncellemeler en
  // alta geliyor. Onu düzeltelim, en son güncellemeler en tepeden başlasın."*)
  function yenidenEskiye(liste) {
    return siraliNotlar(liste).reverse();
  }

  // KATEGORİLER (kullanıcı 2026-11-10: *"Notlar içine 'uygulanan' 'uygulanıyor'
  // 'uygulanacak' 'girdi bekleniyor' gibi kategoriler koyalım. Notları takip
  // ederiz."*): Notlar listesi notun DURUMUNDAN türeyen kategorilere ayrılır.
  // Sıra dikkat sırası — önce kullanıcının girdisini bekleyenler, sonra işlenen,
  // sonra kuyruktakiler, en sonda biten; her kategoride yeniden eskiye. Durumların
  // adı (DURUMLAR) bildirimde ve araçta aynı kalır. Tanınmayan durum SESSİZCE
  // düşmez: `diger` kategorisinde görünür.
  var KATEGORILER = [
    { kod: 'girdi', ad: 'Girdi bekleniyor', durumlar: ['soru'] },
    { kod: 'uygulaniyor', ad: 'Uygulanıyor', durumlar: ['uygulaniyor'] },
    { kod: 'uygulanacak', ad: 'Uygulanacak', durumlar: ['bekliyor'] },
    { kod: 'uygulanan', ad: 'Uygulanan', durumlar: ['uygulandi'] },
    { kod: 'iptal', ad: 'İptal', durumlar: ['iptal'], bosGizli: true },
    { kod: 'diger', ad: 'Diğer', durumlar: [], bosGizli: true }
  ];
  function kategorile(liste) {
    var sirali = yenidenEskiye(liste || []);
    var bilinen = {};
    KATEGORILER.forEach(function (k) { k.durumlar.forEach(function (d) { bilinen[d] = true; }); });
    return KATEGORILER.map(function (k) {
      return {
        kod: k.kod, ad: k.ad, bosGizli: !!k.bosGizli,
        notlar: sirali.filter(function (n) { return k.kod === 'diger' ? !bilinen[n.durum] : k.durumlar.indexOf(n.durum) >= 0; })
      };
    });
  }
  // Açık not: kuyrukta, işlenirken ya da kullanıcının girdisini beklerken —
  // Notlar düğmesinin sayacındaki kehribar işaret.
  function acikNot(n) {
    return !!n && (n.durum === 'bekliyor' || n.durum === 'uygulaniyor' || n.durum === 'soru');
  }

  // ── yayın: programın güncellemesi ────────────────────────────────────────
  // Kullanıcı 2026-11-05: *"artifaktı otomatik olarak yenileme … güncelleme
  // geldiğinde uyarı popup çıkar, oradan güncelle dediğimde HTML'i yenilersin."*
  // Sayfa yeniden yayınlanınca açık görünüm kendiliğinden tazeleniyordu; yeni
  // program artık varlık deposuna (metin, text/plain) konur ve kaydın
  // `yayin/son` belgesi onu gösterir: { surum, sha, pr, zaman, boyut,
  // program: { id, boyut }, notlar: [no…] }. Sayfa açılışta en yeniyi yükler,
  // açıkken gelen yayını SORAR.
  var VARLIK = /^[0-9a-f]{32}$/;
  function yayinDogrula(y) {
    if (!y || typeof y !== 'object') return ['yayın bir nesne olmalı'];
    var h = [];
    if (typeof y.surum !== 'string' || !/^[0-9a-f]{7,40}$/.test(y.surum)) h.push('surum kısa sha olmalı');
    if (!y.program || !VARLIK.test(String(y.program.id || ''))) h.push('program.id varlık kimliği olmalı');
    if (y.notlar !== undefined && !(Array.isArray(y.notlar) && y.notlar.every(function (n) { return Number.isInteger(n) && n > 0; }))) {
      h.push('notlar pozitif tam sayılar olmalı');
    }
    return h;
  }
  // Açılışta yüklenecek program: kayıttaki geçerli yayın sayfanın gömülü
  // programından (mfsim.html) başkaysa varlık, değilse dosya.
  function programKaynagi(yayin, gomulu) {
    if (yayin && !yayinDogrula(yayin).length && yayin.surum !== (gomulu || '')) {
      return { tur: 'varlik', id: yayin.program.id, surum: yayin.surum, pr: yayin.pr || '' };
    }
    return { tur: 'dosya' };
  }
  // Açık programın yerine gelecek yayın: "Sonra" denen sürüm yeniden SORULMAZ
  // (`ertelenen`), şeritteki düğme yine görünür.
  function guncellemeVar(yayin, yuklu, ertelenen) {
    if (!yayin || yayinDogrula(yayin).length) return false;
    return yayin.surum !== (yuklu || '') && yayin.surum !== (ertelenen || '');
  }
  // Not numaraları kısa: [6, 8, 9, 10, 12] → "6 · 8–10 · 12"
  function noAraligi(nolar) {
    var s = (nolar || []).filter(function (n) { return Number.isInteger(n) && n > 0; })
      .sort(function (a, b) { return a - b; })
      .filter(function (n, i, a) { return i === 0 || n !== a[i - 1]; });
    var parca = [];
    for (var i = 0; i < s.length;) {
      var j = i;
      while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
      parca.push(j - i >= 2 ? s[i] + '–' + s[j] : (j > i ? s[i] + ' · ' + s[j] : String(s[i])));
      i = j + 1;
    }
    return parca.join(' · ');
  }
  // Notun sonuç görüntüsü (Claude'un çektiği, uygulanan değişiklik):
  // `sonuc: { foto: varlık kimliği, g, y }` → varlığın kökten yolu; yoksa ''.
  function sonucYolu(n) {
    var s = n && n.sonuc;
    return s && VARLIK.test(String(s.foto || '')) ? '/_blob/' + s.foto : '';
  }

  var api = {
    DURUMLAR: DURUMLAR, ARACLAR: ARACLAR, MODULLER: MODULLER, SAYFALAR: SAYFALAR, YORUM_SINIR: YORUM_SINIR,
    sadelestir: sadelestir, sekilKur: sekilKur, kutuBirlesim: kutuBirlesim, bolgeler: bolgeler, uclar: uclar, yerOzeti: yerOzeti,
    yorumMetni: yorumMetni, baytBoyu: baytBoyu, notDogrula: notDogrula, siraliNotlar: siraliNotlar, yenidenEskiye: yenidenEskiye,
    KATEGORILER: KATEGORILER, kategorile: kategorile, acikNot: acikNot,
    yayinDogrula: yayinDogrula, programKaynagi: programKaynagi, guncellemeVar: guncellemeVar,
    noAraligi: noAraligi, sonucYolu: sonucYolu
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.CanliNot = api;
})(typeof window !== 'undefined' ? window : this);
