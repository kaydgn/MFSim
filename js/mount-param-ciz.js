// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ — PARAMETRİK ANALİZ · DİYAGRAMLAR (DOM'suz çizici)
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı kararı (2026-10-18): "Önerilerini uygulayalım … Bileşen
// penceresinin içine entegre edersin." Taramanın diyagramları Parametrik
// Analiz penceresinin Sonuç kategorisinde durur — Takoz pencerelerinin
// "sonuç göstermez" kuralının bu pencereye özgü istisnası. Çizici yalnız SVG
// metni üretir; görünüm modeli pencereden gelir (js/cp-mount-param.js) ve
// çizim kabın gerçek genişliğinde 1:1 kurulur: yazının boyu ekrandaki boyudur.
//
// ÇİZİM SIRASI: zemin → ızgara → bölge → çizgi ve nokta → işaret → YAZI.
// Bütün yazılar en sonda ve zeminin renginde hâle taşır (css .ve-pd-y):
// altından geçen çizgiyi hâle örter. Yazı katmanı yazıları tahmini kutularıyla
// yerleştirir; çakışan düşük öncelikli yazı çizilmez (iki yazı üst üste gelmez).
// Renk CSS sınıfından (iki tema), yazı boyu çağırandan (veThemeFs).
//
// Saf modül: DOM'a dokunmaz. Kapı: tests/unit/mount-param-ciz.test.js.
// ═══════════════════════════════════════════════════════════════════════════

var veMntParamCiz = (function(){
  'use strict';

  // ── Ortak ─────────────────────────────────────────────────────────────────
  function R(v){ return Math.round(v * 10) / 10; }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function sayi(v, b){ return (typeof veSayi === 'function') ? veSayi(v, b, { eksi:'−' }) : String(Math.round(v)); }
  // Yazının genişlik TAHMİNİ: harf ~0,6 em (bilerek cömert — tahmin gerçek
  // kutudan küçük kalırsa çakışma kaçar). Alt simge işareti (_) sayılmaz.
  function gen(t, px, kalin){ return String(t).replace(/_/g, '').length * px * (kalin ? 0.64 : 0.6); }
  // Kutu: harfin yüksekliği ~0,96 em yukarı, ~0,3 em aşağı; alt simge aşağı uzatır.
  function kutu(x, y, t, px, a, kalin){
    var w = gen(t, px, kalin), l = a === 'end' ? x - w : a === 'middle' ? x - w / 2 : x;
    return { l:l, r:l + w, t:y - px * 0.96, b:y + px * (String(t).indexOf('_') >= 0 ? 0.62 : 0.3) };
  }
  function kesis(p, q, pay){ pay = pay || 0; return p.l < q.r + pay && q.l < p.r + pay && p.t < q.b + pay && q.t < p.b + pay; }
  // ALT SİMGE: metindeki `_x` (x harf/rakam dizisi) SVG alt simgesine döner —
  // HTML öğesi SVG'ye girmez (<sub> çizimin kalanını siler).
  function metin(t, px){
    return esc(t).replace(/_([\p{L}\p{N}]+)/gu, function(m, a){
      return '<tspan baseline-shift="sub" font-size="' + R(px * 0.8) + '">' + a + '</tspan>';
    });
  }
  function cizgi(x1, y1, x2, y2, s, ek){
    return '<line class="' + s + '" x1="' + R(x1) + '" y1="' + R(y1) + '" x2="' + R(x2) + '" y2="' + R(y2) + '"' + (ek || '') + '/>';
  }
  function ip(t){ return t ? ' data-ip="' + esc(t) + '"' : ''; }
  function olcek(a, b, p, q){ var k = (q - p) / ((b - a) || 1); return function(v){ return p + (v - a) * k; }; }

  // İşaret adımı 1 · 2 · 5 × 10ⁿ; b: işaret yazısının ondalık hanesi.
  function adim(a, b, hedef){
    var r = (b - a) / Math.max(1, hedef);
    if(!(r > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log(r) / Math.LN10)), m = r / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  function isaretler(a, b, hedef){
    var s = adim(a, b, hedef), v = [];
    for(var x = Math.ceil(a / s - 1e-9) * s; x <= b + s * 1e-6; x += s) v.push(Math.round(x / s) * s);
    return { v:v, s:s, b:Math.max(0, -Math.floor(Math.log(s) / Math.LN10 + 1e-9)) };
  }
  // Eksenin üst ucu bir işarete oturur (veri en büyüğünü kapsar).
  function ust(a, b, hedef){
    var I = isaretler(a, b, hedef);
    if(I.v[I.v.length - 1] < b - 1e-12) I.v.push(I.v[I.v.length - 1] + I.s);
    return I;
  }

  // YAZI KATMANI — yazılar önceliğe göre yerleşir; tahmini kutusu önceki bir
  // yazıyla ya da çizim sınırıyla çakışan yazı çizilmez (düşük öncelikli
  // işaret yazısı seyrelir, ad ve veri kalır).
  function katman(W, H){
    var L = [];
    return {
      ekle: function(x, y, t, px, o){ L.push({ x:x, y:y, t:t, px:px, o:o || {} }); },
      kutular: function(){ return L.map(function(e){ return kutu(e.x, e.y, e.t, e.px, e.o.a, e.o.kalin); }); },
      ciz: function(engel){
        var yer = (engel || []).slice(), out = '';
        L.map(function(e, i){ return { e:e, i:i }; })
          .sort(function(p, q){ return (q.e.o.pri || 0) - (p.e.o.pri || 0) || p.i - q.i; })
          .forEach(function(p){
            var e = p.e, k = kutu(e.x, e.y, e.t, e.px, e.o.a, e.o.kalin);
            if(k.l < 1 || k.r > W - 1 || k.t < 0 || k.b > H) return;
            if(yer.some(function(q){ return kesis(k, q, 1.5); })) return;
            yer.push(k);
            e.html = '<text class="ve-pd-y' + (e.o.s ? ' ' + e.o.s : '') + '" x="' + R(e.x) + '" y="' + R(e.y) + '" font-size="' + e.px + '"'
              + (e.o.a ? ' text-anchor="' + e.o.a + '"' : '') + (e.o.kalin ? ' font-weight="600"' : '') + ip(e.o.ip) + '>' + metin(e.t, e.px) + '</text>';
          });
        L.forEach(function(e){ if(e.html) out += e.html; });
        return out;
      }
    };
  }
  // İşarete bağlı ad: sekiz yönde denenir, yazılarla ve çizim sınırıyla
  // çakışmayan ilk yer; hiçbiri boş değilse ad çizilmez.
  function adYeri(x, y, r, t, px, yer, F){
    var w = gen(t, px, true), h = px * 1.1, d = r + 4;
    var yon = [[1, -1], [1, 1], [-1, -1], [-1, 1], [1, 0], [-1, 0], [0, -1], [0, 1]];
    for(var i = 0; i < yon.length; i++){
      var dx = yon[i][0], dy = yon[i][1];
      var a = dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle';
      var bx = x + dx * d, by = y + dy * d + (dy > 0 ? px * 0.8 : dy < 0 ? 0 : px * 0.35);
      var k = kutu(bx, by, t, px, a, true);
      if(k.l < F.l + 1 || k.r > F.r - 1 || k.t < F.t + 1 || k.b > F.b - 1) continue;
      if(yer.some(function(q){ return kesis(k, q, 2); })) continue;
      return { x:bx, y:by, a:a, k:k, w:w, h:h };
    }
    return null;
  }

  function svgAc(W, H, ad){
    return '<svg class="ve-pd" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(ad) + '">'
      + '<rect class="ve-pd-zem" x="0" y="0" width="' + W + '" height="' + H + '"/>';
  }

  // Yatay eksen işaretleri: ızgara çizgisi şekil katmanına, yazı katmana.
  function xEksen(F, I, X, px, Y, ek){
    var s = '';
    I.v.forEach(function(v){
      var x = X(v);
      if(x < F.l - 0.5 || x > F.r + 0.5) return;
      s += cizgi(x, F.t, x, F.b, 've-pd-izg');
      Y.ekle(x, F.b + px + 5, sayi(v, I.b), px, { a:'middle', s:'s', pri:(ek && ek[v]) || 1 });
    });
    return s;
  }
  function yEksen(F, I, Yo, px, Y){
    var s = '';
    I.v.forEach(function(v){
      var y = Yo(v);
      if(y < F.t - 0.5 || y > F.b + 0.5) return;
      s += cizgi(F.l, y, F.r, y, 've-pd-izg');
      Y.ekle(F.l - 6, y + px * 0.35, sayi(v, I.b), px, { a:'end', s:'s', pri:1 });
    });
    return s;
  }
  function solPay(I, px){ return Math.max.apply(null, I.v.map(function(v){ return gen(sayi(v, I.b), px); })) + 12; }

  // ── GÖSTERGE (HTML) — çizimin işaretleriyle aynı sınıflar ──────────────────
  // L: [{ s (sınıf), sekil: nokta | cizgi | kesik | halka | karo | alan, ad, n? }]
  function ornek(e){
    var s = e.s, ic = e.sekil === 'cizgi' || e.sekil === 'kesik' ? '<line class="' + s + '" x1="1" y1="5" x2="15" y2="5"/>'
      : e.sekil === 'dik' ? '<line class="' + s + '" x1="8" y1="0.5" x2="8" y2="9.5"/>'
      : e.sekil === 'halka' ? '<circle class="' + s + '" cx="8" cy="5" r="3.6"/>'
      : e.sekil === 'karo' ? '<path class="' + s + '" d="M8 .8 12.2 5 8 9.2 3.8 5Z"/>'
      : e.sekil === 'alan' ? '<rect class="' + s + '" x="2" y="1" width="12" height="8"/>'
      : '<circle class="' + s + '" cx="8" cy="5" r="' + (e.r || 3) + '"/>';
    return '<svg class="ve-pd-lj-s" viewBox="0 0 16 10" width="16" height="10" aria-hidden="true">' + ic + '</svg>';
  }
  function gosterge(L){
    return '<div class="ve-pd-lj">' + L.map(function(e){
      return '<span class="ve-pd-lj-o">' + ornek(e) + '<span>' + esc(e.ad) + (e.n != null ? ' · ' + sayi(e.n, 0) : '') + '</span></span>';
    }).join('') + '</div>';
  }

  // ── D11 · PARETO CEPHESİ — iletilebilirlik × en büyük statik sehim ──────────
  // V: { nokta:[{ x, y, s:'k'|'e'|'u', i }], cephe:[{ x, y, i }] (x artan),
  //      uzlasi:{ x, y, i, ad }|null, mevcut:{ x, y, ip }|null,
  //      biyik:[{ a:[x, y] (yumuşak), b:[x, y] (sert), i }], e1, e2 (mm|null),
  //      k2 (%), xMax, yMax, dis (ölçek dışı) }
  var NOKTA = { k:['ve-pd-n0', 1.6], e:['ve-pd-n1', 2.2], u:['ve-pd-n2', 2.8] };
  function pareto(V, o){
    var W = o.W, px = o.fs.k;
    var H = o.H || Math.round(Math.max(270, Math.min(430, W * 0.56)));
    var Iy = ust(0, V.yMax, Math.max(3, Math.floor((H - 80) / 36)));
    var F = { l:solPay(Iy, px), r:W - 14, t:30, b:H - 38 };
    var Ix = ust(0, V.xMax, Math.max(3, Math.floor((F.r - F.l) / (px * 4.5))));
    var X = olcek(0, Ix.v[Ix.v.length - 1], F.l, F.r), Yo = olcek(0, Iy.v[Iy.v.length - 1], F.b, F.t);
    var Y = katman(W, H), s = svgAc(W, H, 'Pareto cephesi');
    s += xEksen(F, Ix, X, px, Y) + yEksen(F, Iy, Yo, px, Y);
    var ici = function(x, y){ return x >= F.l - 0.5 && x <= F.r + 0.5 && y >= F.t - 0.5 && y <= F.b + 0.5; };
    // sınırlar
    if(V.e1 != null && X(V.e1) <= F.r){ s += cizgi(X(V.e1), F.t, X(V.e1), F.b, 've-pd-sinir'); Y.ekle(X(V.e1) - 3, F.t - 6, 'E1', px, { a:'end', pri:5 }); }
    if(V.e2 != null && X(V.e2) <= F.r){ s += cizgi(X(V.e2), F.t, X(V.e2), F.b, 've-pd-sinir'); Y.ekle(X(V.e2) + 3, F.t - 6, 'E2', px, { a:'start', pri:5 }); }
    if(V.k2 != null && Yo(V.k2) >= F.t){ s += cizgi(F.l, Yo(V.k2), F.r, Yo(V.k2), 've-pd-sinir'); Y.ekle(F.r - 4, Yo(V.k2) - 5, 'K2', px, { a:'end', pri:5 }); }
    // noktalar: elenen → uygun (uygun üstte)
    ['k', 'e', 'u'].forEach(function(c){
      V.nokta.forEach(function(p){
        if(p.s !== c) return;
        var x = X(p.x), y = Yo(p.y);
        if(!ici(x, y)) return;
        s += '<circle class="' + NOKTA[c][0] + '" cx="' + R(x) + '" cy="' + R(y) + '" r="' + NOKTA[c][1] + '" data-i="' + p.i + '"/>';
      });
    });
    // tolerans köşeleri: yumuşak → sert
    (V.biyik || []).forEach(function(q){
      var a = [X(q.a[0]), Yo(q.a[1])], b = [X(q.b[0]), Yo(q.b[1])];
      if(!ici(a[0], a[1]) && !ici(b[0], b[1])) return;
      s += cizgi(Math.max(F.l, Math.min(F.r, a[0])), Math.max(F.t, Math.min(F.b, a[1])),
                 Math.max(F.l, Math.min(F.r, b[0])), Math.max(F.t, Math.min(F.b, b[1])), 've-pd-biyik', ' data-i="' + q.i + '"');
    });
    // cephe
    var cp = (V.cephe || []).map(function(p){ return [X(p.x), Yo(p.y), p.i]; }).filter(function(p){ return ici(p[0], p[1]); });
    if(cp.length > 1){
      var d = 'M' + R(cp[0][0]) + ' ' + R(cp[0][1]);
      for(var k = 1; k < cp.length; k++) d += ' H' + R(cp[k][0]) + ' V' + R(cp[k][1]);   // basamak: cephe baskın bölgenin sınırı
      s += '<path class="ve-pd-cephe" d="' + d + '"/>';
    }
    cp.forEach(function(p){ s += '<circle class="ve-pd-n3" cx="' + R(p[0]) + '" cy="' + R(p[1]) + '" r="3.2" data-i="' + p[2] + '"/>'; });
    // uzlaşı ve mevcut
    var adlar = [], engel = [];
    if(V.mevcut){
      var mx = X(V.mevcut.x), my = Yo(V.mevcut.y);
      if(ici(mx, my)){
        s += '<path class="ve-pd-mev" d="M' + R(mx) + ' ' + R(my - 6.5) + 'L' + R(mx + 6.5) + ' ' + R(my) + 'L' + R(mx) + ' ' + R(my + 6.5) + 'L' + R(mx - 6.5) + ' ' + R(my) + 'Z"' + ip(V.mevcut.ip) + '/>';
        adlar.push([mx, my, 7, 'Mevcut']);
        engel.push({ l:mx - 7, r:mx + 7, t:my - 7, b:my + 7 });
      }
    }
    if(V.uzlasi){
      var ux = X(V.uzlasi.x), uy = Yo(V.uzlasi.y);
      if(ici(ux, uy)){
        s += '<circle class="ve-pd-uz" cx="' + R(ux) + '" cy="' + R(uy) + '" r="7" data-i="' + V.uzlasi.i + '"/>';
        adlar.unshift([ux, uy, 8, V.uzlasi.ad || 'Uzlaşı']);
        engel.push({ l:ux - 8, r:ux + 8, t:uy - 8, b:uy + 8 });
      }
    }
    if(V.dis > 0) Y.ekle(F.r - 4, F.t + px + 2, 'Ölçek dışı ' + sayi(V.dis, 0), px, { a:'end', s:'s', pri:4 });
    Y.ekle(4, 14, 'T [%]', px, { a:'start', pri:9 });
    Y.ekle((F.l + F.r) / 2, H - 9, 'δ_s [mm]', px, { a:'middle', pri:9 });
    var yer = Y.kutular().concat(engel);
    adlar.forEach(function(a){
      var p = adYeri(a[0], a[1], a[2], a[3], o.fs.o, yer, F);
      if(!p) return;
      yer.push(p.k);
      Y.ekle(p.x, p.y, a[3], o.fs.o, { a:p.a, s:'b', kalin:true, pri:8 });
    });
    return { svg:s + Y.ciz() + '</svg>', h:H };
  }

  // ── D7 · MOD YERLEŞİMİ — satır başına bir tasarım, çentik başına bir mod ──
  // V: { satir:[{ ad, f:[Hz], dik:[bool], ip:[metin], kose:{ a:[Hz], b:[Hz] }|null }],
  //      e3 (Hz|null), bant:[8, 10], k1 (Hz), k1a (Hz), xMax }
  function modlar(V, o){
    var W = o.W, px = o.fs.k, sat = 26;
    var adG = Math.max.apply(null, V.satir.map(function(r){ return gen(r.ad, px); })) + 16;
    var F = { l:adG, r:W - 12, t:24, b:24 + V.satir.length * sat };
    var H = F.b + 40;
    var Ix = ust(0, V.xMax, Math.max(3, Math.floor((F.r - F.l) / (px * 4))));
    var X = olcek(0, Ix.v[Ix.v.length - 1], F.l, F.r), Y = katman(W, H), s = svgAc(W, H, 'Mod yerleşimi');
    // sınırların dışı gölgeli: E3 altı, 1b bandı, K1 üstü
    var bolge = [];
    if(V.e3 != null) bolge.push(['E3', 0, V.e3]);
    bolge.push(['1b', V.bant[0], V.bant[1]]);
    bolge.push(['K1', V.k1, Ix.v[Ix.v.length - 1]]);
    bolge.forEach(function(b){
      var x0 = X(b[1]), x1 = Math.min(F.r, X(b[2]));
      if(!(x1 > x0)) return;
      s += '<rect class="ve-pd-bolge" x="' + R(x0) + '" y="' + F.t + '" width="' + R(x1 - x0) + '" height="' + (F.b - F.t) + '"/>';
      Y.ekle((x0 + x1) / 2, F.t - 8, b[0], px, { a:'middle', pri:6 });
    });
    // işaretler: düzenli adım + sınırların kendisi
    var ozel = {};
    [V.e3, V.bant[0], V.bant[1], V.k1].forEach(function(v){ if(v != null){ ozel[v] = 3; if(Ix.v.indexOf(v) < 0) Ix.v.push(v); } });
    Ix.v.sort(function(a, b){ return a - b; });
    Ix.b = Math.max(Ix.b, V.k1 % 1 ? 1 : 0);
    s += xEksen(F, Ix, X, px, Y, ozel);
    V.satir.forEach(function(r, j){
      var y = F.t + (j + 0.5) * sat;
      s += cizgi(F.l, F.t + (j + 1) * sat, F.r, F.t + (j + 1) * sat, 've-pd-izg');
      Y.ekle(F.l - 8, y + px * 0.35, r.ad, px, { a:'end', s:r.vurgu ? 'b' : '', kalin:!!r.vurgu, pri:7 });
      if(r.kose) r.f.forEach(function(f, i){
        var a = X(r.kose.a[i]), b = X(r.kose.b[i]);
        if(Number.isFinite(a) && Number.isFinite(b)) s += cizgi(Math.max(F.l, Math.min(a, b)), y, Math.min(F.r, Math.max(a, b)), y, 've-pd-kose');
      });
      // birbirine K1a'dan yakın iki mod: altlarında köprü
      var f = r.f.slice().sort(function(a, b){ return a - b; });
      for(var i = 1; i < f.length; i++) if(f[i] - f[i - 1] <= V.k1a)
        s += cizgi(X(f[i - 1]), y + 11, Math.min(F.r, X(f[i])), y + 11, 've-pd-yakin');
      r.f.forEach(function(fi, i){
        var x = X(fi);
        if(!(x >= F.l && x <= F.r)) return;
        s += cizgi(x, y - 9, x, y + 9, 've-pd-mod' + (r.dik[i] ? ' d' : ''))
          + '<rect class="ve-pd-hit" x="' + R(x - 4) + '" y="' + R(y - 11) + '" width="8" height="22"' + ip(r.ip && r.ip[i]) + '/>';
      });
    });
    Y.ekle((F.l + F.r) / 2, H - 6, 'f [Hz]', px, { a:'middle', pri:9 });
    return { svg:s + Y.ciz() + '</svg>', h:H };
  }

  // ── D9 · BAĞLAYICI KISITLAR — bağımsız ihlal ve tek engel ─────────────────
  // V: { kisit:[{ no, ad, red, tek, ip }] }. Satır başına bir kısıt, iki çubuk
  // sütunu (kendi ölçekleriyle): ihlal eden · yalnız bunu ihlal eden. Dar
  // kapta satırın adı kısıtın numarası, tam adı ipucunda.
  function baglayici(V, o){
    var W = o.W, px = o.fs.k, sat = 20, K = V.kisit, bas = 26;
    var uzun = W >= 520, ad = function(q){ return uzun ? q.no + ' · ' + q.ad : q.no; };
    var adG = Math.max.apply(null, K.map(function(q){ return gen(ad(q), px); })) + 14;
    var H = bas + K.length * sat + 8;
    var Y = katman(W, H), s = svgAc(W, H, 'Bağlayıcı kısıtlar'), ara = 14, cw = (W - adG - ara - 8) / 2;
    var sutun = function(k, x0, x1, baslik){
      var en = Math.max(1, Math.max.apply(null, K.map(function(q){ return q[k]; })));
      var yw = gen(sayi(en, 0), px) + 8, X = olcek(0, en, x0, x1 - yw);
      Y.ekle(x0, 15, baslik, px, { a:'start', s:'b', kalin:true, pri:9 });
      s += cizgi(x0, bas - 4, x0, bas + K.length * sat, 've-pd-eks');
      K.forEach(function(q, j){
        var y = bas + j * sat, w = X(q[k]) - x0;
        if(q[k] > 0) s += '<rect class="ve-pd-cubuk" x="' + R(x0) + '" y="' + R(y + 4) + '" width="' + R(Math.max(1.5, w)) + '" height="' + (sat - 8) + '"' + ip(q.ip) + '/>';
        Y.ekle(x0 + Math.max(1.5, w) + 4, y + sat / 2 + px * 0.35, sayi(q[k], 0), px, { a:'start', pri:6 });
      });
    };
    K.forEach(function(q, j){ Y.ekle(adG - 10, bas + j * sat + sat / 2 + px * 0.35, ad(q), px, { a:'end', pri:7, ip:q.ip }); });
    var dar = gen('Yalnız bunu ihlal eden', px, true) > cw - 4;
    sutun('red', adG, adG + cw, dar ? 'İhlal' : 'İhlal eden');
    sutun('tek', adG + cw + ara, W - 8, dar ? 'Yalnız bu' : 'Yalnız bunu ihlal eden');
    return { svg:s + Y.ciz() + '</svg>', h:H };
  }

  // ── D10 · SINIR DUYARLILIĞI — sınır değişince uygun kombinasyon sayısı ────
  // V: { panel:[{ no, ad, kisa, yon:'ust'|'alt', deger:[artan], na, sinir, xMin, xMax }] } — dar
  // panelde başlık kısa adla.
  // sayi(L) = na + #{ölçü ≤ L} (üst sınır) · na + #{ölçü ≥ L} (alt sınır).
  function _say(P){
    var v = P.deger, n = v.length;
    var ilk = function(f){ var lo = 0, hi = n; while(lo < hi){ var m = (lo + hi) >> 1; if(f(v[m])) hi = m; else lo = m + 1; } return lo; };
    return {
      az: function(L){ return ilk(function(a){ return a >= L; }); },      // #{< L}
      esit: function(L){ return ilk(function(a){ return a > L; }); },     // #{≤ L}
      sayi: function(L){ return P.na + (P.yon === 'ust' ? ilk(function(a){ return a > L; }) : n - ilk(function(a){ return a >= L; })); }
    };
  }
  function basamak(P){
    var S = _say(P), v = P.deger, n = v.length, out = [[P.xMin, S.sayi(P.xMin)]], once = null;
    for(var i = 0; i < n; i++){
      var u = v[i];
      if(u === once || !(u > P.xMin) || !(u < P.xMax)) continue;
      once = u;
      if(P.yon === 'ust') out.push([u, P.na + S.az(u)], [u, P.na + S.esit(u)]);
      else out.push([u, P.na + n - S.az(u)], [u, P.na + n - S.esit(u)]);
    }
    out.push([P.xMax, S.sayi(P.xMax)]);
    return out;
  }
  function duyarlilik(V, o){
    var W = o.W, px = o.fs.k, ara = 14, P = V.panel;
    var kol = Math.max(1, Math.min(P.length, Math.floor((W + ara) / (165 + ara))));
    var pw = (W - (kol - 1) * ara) / kol, ph = pw < 230 ? 150 : 168, sira = Math.ceil(P.length / kol);
    var H = sira * ph + (sira - 1) * 10;
    var Y = katman(W, H), s = svgAc(W, H, 'Sınır duyarlılığı');
    P.forEach(function(p, k){
      var x0 = (k % kol) * (pw + ara), y0 = Math.floor(k / kol) * (ph + 10);
      var pts = basamak(p), en = Math.max(1, Math.max.apply(null, pts.map(function(q){ return q[1]; })));
      var Iy = ust(0, en, 3);
      Iy.v = Iy.v.filter(function(v){ return v === Math.round(v); }); Iy.b = 0;
      var F = { l:x0 + solPay(Iy, px) + 2, r:x0 + pw - 10, t:y0 + 32, b:y0 + ph - 30 };
      var Ix = isaretler(p.xMin, p.xMax, Math.max(2, Math.floor((F.r - F.l) / (px * 4.5))));
      var X = olcek(p.xMin, p.xMax, F.l, F.r), Yo = olcek(0, Iy.v[Iy.v.length - 1], F.b, F.t);
      var bas = p.no + ' · ' + (gen(p.no + ' · ' + p.ad, px, true) <= pw - 6 || !p.kisa ? p.ad : p.kisa);
      Y.ekle(x0 + 2, y0 + 13, bas, px, { a:'start', s:'b', kalin:true, pri:9 });
      s += xEksen(F, Ix, X, px, Y) + yEksen(F, Iy, Yo, px, Y);
      var d = 'M' + R(X(pts[0][0])) + ' ' + R(Yo(pts[0][1]));
      for(var i = 1; i < pts.length; i++) d += ' L' + R(X(pts[i][0])) + ' ' + R(Yo(pts[i][1]));
      s += '<path class="ve-pd-basamak" d="' + d + '"/>';
      if(p.sinir >= p.xMin && p.sinir <= p.xMax){
        var xs = X(p.sinir), n = _say(p).sayi(p.sinir);
        s += cizgi(xs, F.t, xs, F.b, 've-pd-sinir') + '<circle class="ve-pd-n3" cx="' + R(xs) + '" cy="' + R(Yo(n)) + '" r="3.2"/>';
        Y.ekle(xs + 5, Yo(n) - 5, sayi(n, 0), px, { a:'start', s:'b', pri:8 });
      }
    });
    return { svg:s + Y.ciz() + '</svg>', h:H };
  }

  // ── D8 · ANA ETKİLER — uzlaşıdan yalnız bir grubun tipi değişince ─────────
  // V: { tip:[{ kz }] (k_z sırasıyla), seri:[{ no, T:[%], d:[mm], ok:[bool], i:[komb.], uz:sıra }],
  //      k2 (%), e1, e2 (mm|null) }
  function _etkiPanel(V, o, k, x0, w, y0, h, Y, eksenAd, sinir){
    var px = o.fs.k, n = V.tip.length, s = '';
    var deg = []; V.seri.forEach(function(q){ q[k].forEach(function(v){ if(Number.isFinite(v)) deg.push(v); }); });
    sinir.forEach(function(L){ if(L[1] != null) deg.push(L[1]); });
    var Iy = ust(0, Math.max.apply(null, deg.concat([1e-9])) * 1.04, 4);
    var sonG = Math.max.apply(null, V.seri.map(function(q){ return gen(String(q.no), px, true); })) + 12;
    var F = { l:x0 + solPay(Iy, px), r:x0 + w - sonG, t:y0 + 30, b:y0 + h - 36 };
    var X = olcek(0, Math.max(1, n - 1), F.l, F.r), Yo = olcek(0, Iy.v[Iy.v.length - 1], F.b, F.t);
    s += yEksen(F, Iy, Yo, px, Y);
    // x: k_z — sığdığı kadar (yazılar arası ≥ 6 px)
    var kw = Math.max.apply(null, V.tip.map(function(t){ return gen(sayi(t.kz, 0), px); })) + 6;
    var her = Math.max(1, Math.ceil(kw / Math.max(1e-9, (F.r - F.l) / Math.max(1, n - 1))));
    V.tip.forEach(function(t, i){
      var x = X(i);
      s += cizgi(x, F.b, x, F.b + 3, 've-pd-eks');
      if(i % her === 0) Y.ekle(x, F.b + px + 5, sayi(t.kz, 0), px, { a:'middle', s:'s', pri:1 });
    });
    s += cizgi(F.l, F.b, F.r, F.b, 've-pd-eks');
    sinir.forEach(function(L){
      if(L[1] == null) return;
      var y = Yo(L[1]);
      if(y < F.t || y > F.b) return;
      s += cizgi(F.l, y, F.r, y, 've-pd-sinir');
      Y.ekle(F.l + 4, y - 4, L[0], px, { a:'start', pri:5 });
    });
    var son = [];
    V.seri.forEach(function(q, j){
      var c = 've-pd-s' + Math.min(j + 1, 5), d = '', y1 = null;
      q[k].forEach(function(v, i){ if(Number.isFinite(v)){ d += (d ? ' L' : 'M') + R(X(i)) + ' ' + R(Yo(v)); y1 = Yo(v); } });
      if(d) s += '<path class="ve-pd-etki ' + c + '" d="' + d + '"/>';
      q[k].forEach(function(v, i){
        if(!Number.isFinite(v)) return;
        s += '<circle class="ve-pd-im ' + c + (q.ok[i] ? ' dolu' : '') + '" cx="' + R(X(i)) + '" cy="' + R(Yo(v)) + '" r="2.7" data-i="' + q.i[i] + '"/>';
      });
      if(q.uz != null && Number.isFinite(q[k][q.uz])) s += '<circle class="ve-pd-uz" cx="' + R(X(q.uz)) + '" cy="' + R(Yo(q[k][q.uz])) + '" r="6" data-i="' + q.i[q.uz] + '"/>';
      if(y1 != null) son.push({ y:y1, t:String(q.no) });
    });
    // seri adları sağ uçta, dikeyde aralanmış
    son.sort(function(a, b){ return a.y - b.y; });
    for(var i = 1; i < son.length; i++) if(son[i].y - son[i - 1].y < px + 2) son[i].y = son[i - 1].y + px + 2;
    son.forEach(function(e){ Y.ekle(F.r + 6, e.y + px * 0.35, e.t, px, { a:'start', s:'b', kalin:true, pri:8 }); });
    Y.ekle(x0 + 2, y0 + 13, eksenAd, px, { a:'start', pri:9 });
    Y.ekle((F.l + F.r) / 2, y0 + h - 9, 'k_z [N/mm]', px, { a:'middle', pri:9 });
    return s;
  }
  function anaEtki(V, o){
    var W = o.W, yan = W >= 600, ara = 18;
    var h = o.H ? Math.round(Math.max(250, Math.min(520, yan ? o.H : (o.H - 10) / 2))) : 250;
    var H = yan ? h : 2 * h + 10;
    var Y = katman(W, H), s = svgAc(W, H, 'Ana etkiler'), pw = yan ? (W - ara) / 2 : W;
    s += _etkiPanel(V, o, 'T', 0, pw, 0, h, Y, 'T [%]', [['K2', V.k2]]);
    s += _etkiPanel(V, o, 'd', yan ? pw + ara : 0, pw, yan ? 0 : h + 10, h, Y, 'δ_s [mm]', [['E1', V.e1], ['E2', V.e2]]);
    return { svg:s + Y.ciz() + '</svg>', h:H };
  }

  // ── KESİT ORTAK — iki grubun tipi eksenlerde (k_z sırasıyla), öteki gruplar
  // sabit; hücre başına bir kombinasyon. Hücreler sınıf başına TEK yolda çizilir
  // (27 × 27 hücre 729 öğe değil, birkaç yol). Hücre (i, j): i yatay, j düşey
  // (aşağıdan yukarı); dizideki yeri j·n + i.
  // Kenarlar TAM piksele oturur ve komşu hücreyle ORTAKTIR: kenarı ayrı ayrı
  // yuvarlanan hücreler arasında 1 px'lik dikiş kalıyordu. Satırdaki ardışık
  // hücreler tek dikdörtgen.
  function izgara(n, gx, gy, c){
    return { X:function(i){ return Math.round(gx + i * c); }, Y:function(j){ return Math.round(gy + (n - j) * c); } };
  }
  function hucreler(n, gx, gy, c, f){
    var d = '', Z = izgara(n, gx, gy, c);
    for(var j = 0; j < n; j++){
      for(var i = 0; i < n;){
        if(!f(j * n + i)){ i++; continue; }
        var k = i;
        while(k < n && f(j * n + k)) k++;
        d += 'M' + Z.X(i) + ' ' + Z.Y(j + 1) + 'H' + Z.X(k) + 'V' + Z.Y(j) + 'H' + Z.X(i) + 'Z';
        i = k;
      }
    }
    return d;
  }
  // İki komşu hücrenin hükmü ayrışıyorsa aralarındaki kenar sınırdır.
  function sinirYolu(n, gec, gx, gy, c){
    var d = '', Z = izgara(n, gx, gy, c);
    for(var j = 0; j < n; j++) for(var i = 0; i < n; i++){
      var a = gec[j * n + i] === 1;
      if(i + 1 < n && a !== (gec[j * n + i + 1] === 1)) d += 'M' + Z.X(i + 1) + ' ' + Z.Y(j + 1) + 'V' + Z.Y(j);
      if(j + 1 < n && a !== (gec[(j + 1) * n + i] === 1)) d += 'M' + Z.X(i) + ' ' + Z.Y(j + 1) + 'H' + Z.X(i + 1);
    }
    return d;
  }
  function yol(d, s, ek){ return d ? '<path class="' + s + '" d="' + d + '"' + (ek || '') + '/>' : ''; }
  // Hücrenin ipucu katmanı: görünmez dolgu, kombinasyon numarasıyla (araç ipucu).
  function hucreIp(n, gx, gy, c, ix){
    var s = '';
    for(var j = 0; j < n; j++) for(var i = 0; i < n; i++){
      var x = ix[j * n + i];
      if(x >= 0) s += '<rect class="ve-pd-hit" x="' + R(gx + i * c) + '" y="' + R(gy + (n - 1 - j) * c) + '" width="' + R(c) + '" height="' + R(c) + '" data-i="' + x + '"/>';
    }
    return s;
  }
  // Eksenin k_z yazıları: sığdığı kadar, uçlar önce.
  function kzEksen(V, gx, gy, c, px, Y, yatay){
    var n = V.n, w = Math.max.apply(null, V.kz.map(function(k){ return gen(sayi(k, 0), px); })) + 6;
    var her = Math.max(1, Math.ceil((yatay ? w : px * 1.4) / c));
    for(var i = 0; i < n; i++){
      if(i % her && i !== n - 1) continue;
      var t = Number.isFinite(V.kz[i]) ? sayi(V.kz[i], 0) : '—';
      if(yatay) Y.ekle(gx + (i + 0.5) * c, gy + n * c + px + 5, t, px, { a:'middle', s:'s', pri:i === 0 || i === n - 1 ? 3 : 1 });
      else Y.ekle(gx - 5, gy + (n - 1 - i + 0.5) * c + px * 0.35, t, px, { a:'end', s:'s', pri:i === 0 || i === n - 1 ? 3 : 1 });
    }
  }

  // ── D5 · KISIT HARİTALARI — kesitte kısıt başına bir harita ──────────────
  // V: { n, kz:[], panel:[{ ad, say, gec:Uint8Array(n·n) — 1 sağlıyor · 0 bozuyor
  //      · 2 çözülemedi }], uz:[i, j]|null, ix:Int32Array(n·n) }. Son panel bütün
  // kısıtların kesişimi.
  function haritalar(V, o){
    var W = o.W, px = o.fs.k, ara = 12, n = V.n, P = V.panel;
    var kol = Math.max(1, Math.min(P.length, Math.floor((W + ara) / (140 + ara))));
    var pw = (W - (kol - 1) * ara) / kol, side = pw - 2, c = side / n, ph = 20 + side + 10;
    var sira = Math.ceil(P.length / kol), H = sira * ph;
    var Y = katman(W, H), s = svgAc(W, H, 'Kısıt haritaları');
    P.forEach(function(p, k){
      var x0 = (k % kol) * (pw + ara), y0 = Math.floor(k / kol) * ph, gx = x0 + 1, gy = y0 + 20;
      s += '<rect class="ve-pd-cerceve" x="' + R(gx) + '" y="' + R(gy) + '" width="' + R(side) + '" height="' + R(side) + '"/>'
        + yol(hucreler(n, gx, gy, c, function(q){ return p.gec[q] === 2; }), 've-pd-cozme')
        + yol(hucreler(n, gx, gy, c, function(q){ return p.gec[q] === 1; }), 've-pd-gec');
      if(V.uz) s += '<circle class="ve-pd-uz k" cx="' + R(gx + (V.uz[0] + 0.5) * c) + '" cy="' + R(gy + (n - 1 - V.uz[1] + 0.5) * c) + '" r="' + R(Math.max(3.5, c * 0.75)) + '"/>';
      Y.ekle(x0 + 1, y0 + 13, p.ad + ' · ' + sayi(p.say, 0), px, { a:'start', s:p.hepsi ? 'b' : '', kalin:!!p.hepsi, pri:9 });
    });
    return { svg:s + Y.ciz() + '</svg>', h:H };
  }

  // ── D4 · İLETİLEBİLİRLİK HARİTASI — kesitte T ve kısıt sınırları ─────────
  // V: { n, kz:[], T:Float64Array(n·n) (%), sinir:[{ ad, s, gec }], kesin, uygun
  //      (Uint8Array), uz:[i, j]|null, ix, xAd, yAd }. T sınıfları %10 adımlı,
  //      son sınıf Kriter 2'nin ötesi.
  var T_SINIF = [10, 20, 30, 40, 50];
  function tSinif(t){ for(var k = 0; k < T_SINIF.length; k++) if(t < T_SINIF[k]) return k; return T_SINIF.length; }
  function tHaritasi(V, o){
    var W = o.W, px = o.fs.k, n = V.n;
    var kw = Math.max.apply(null, V.kz.map(function(k){ return gen(sayi(k, 0), px); }));
    var gx = kw + 10, gy = 24, side = Math.min(W - gx - 12, o.H ? o.H - gy - 40 : 560), c = side / n;
    var H = gy + side + 40;
    var Y = katman(W, H), s = svgAc(W, H, 'İletilebilirlik haritası');
    for(var k = 0; k <= T_SINIF.length; k++)
      s += yol(hucreler(n, gx, gy, c, function(q){ return Number.isFinite(V.T[q]) && tSinif(V.T[q]) === k; }), 've-pd-t' + k);
    s += yol(hucreler(n, gx, gy, c, function(q){ return !Number.isFinite(V.T[q]); }), 've-pd-cozme');
    s += '<rect class="ve-pd-cerceve" x="' + R(gx) + '" y="' + R(gy) + '" width="' + R(side) + '" height="' + R(side) + '"/>';
    V.sinir.forEach(function(b){ s += yol(sinirYolu(n, b.gec, gx, gy, c), 've-pd-sh ' + b.s); });
    var r = Math.max(1.6, c * 0.22);
    for(var j = 0; j < n; j++) for(var i = 0; i < n; i++){
      var q = j * n + i, cx = gx + (i + 0.5) * c, cy = gy + (n - 1 - j + 0.5) * c;
      if(V.uygun[q]) s += '<circle class="ve-pd-n3" cx="' + R(cx) + '" cy="' + R(cy) + '" r="' + R(r + 0.6) + '"/>';
      else if(V.kesin[q]) s += '<circle class="ve-pd-kesin" cx="' + R(cx) + '" cy="' + R(cy) + '" r="' + R(r) + '"/>';
    }
    if(V.uz) s += '<circle class="ve-pd-uz" cx="' + R(gx + (V.uz[0] + 0.5) * c) + '" cy="' + R(gy + (n - 1 - V.uz[1] + 0.5) * c) + '" r="' + R(Math.max(5, c * 0.8)) + '"/>';
    s += hucreIp(n, gx, gy, c, V.ix);
    kzEksen(V, gx, gy, c, px, Y, true);
    kzEksen(V, gx, gy, c, px, Y, false);
    Y.ekle(4, 14, V.yAd, px, { a:'start', pri:9 });
    Y.ekle(gx + side / 2, H - 9, V.xAd, px, { a:'middle', pri:9 });
    return { svg:s + Y.ciz() + '</svg>', h:H };
  }

  // ── 3B ORTAK — veri kübü [−1, 1]³'e eşlenir; kamera Görünümler'inki
  // (veMntAkso: azimut · yükseliş, Z yukarı). Sığdırma kübü çevreleyen
  // küreden: döndürürken ölçek değişmez. Sıra: arka duvarlar ve ızgaraları →
  // pencere kutusunun yüzleri → yüzey dörtgenleri ve noktalar derinliğe göre
  // (arkadan öne) → pencere kutusunun kenarları → eksen çizgileri → YAZI.
  // V: { ad, kam:{ az, el }, eks:[{ ad, min, max, I:{ v, b }, kat? }] × 3,
  //      nokta:[{ p:[x, y, z], s, r, i }], dortgen:[{ p:[4 köşe], s, i }],
  //      kutu:{ a:[x, y, z], b:[x, y, z] }|null, isaret:[{ p, ad, s, r, i?, ip? }] }
  var EL_ALT = 4, EL_UST = 88;
  function ucKamera(kam){
    var el = Math.max(EL_ALT, Math.min(EL_UST, Number(kam && kam.el) || 0));
    return { az:((Number(kam && kam.az) || 0) % 360 + 360) % 360, el:el };
  }
  function uc(V, o){
    var W = o.W, px = o.fs.k, H = o.H || Math.round(Math.max(300, Math.min(520, W * 0.9)));
    var kam = ucKamera(V.kam), v = veMntAkso.kamYon(kam), K = veMntAkso.kamera(null, null, v);
    var E = V.eks, pay = 40, k = Math.max(20, (Math.min(W, H) - 2 * pay) / (2 * Math.sqrt(3))), cx = W / 2, cy = H / 2 + 4;
    var Q = function(p){ return [0, 1, 2].map(function(i){ var e = E[i]; return ((p[i] - e.min) / ((e.max - e.min) || 1)) * 2 - 1; }); };
    var S = function(n){ var q = K.P(n); return [cx + k * q[0], cy + k * q[1]]; };
    var nk = function(n){ var q = S(n); return R(q[0]) + ' ' + R(q[1]); };
    var sg = [v[0] >= 0 ? 1 : -1, v[1] >= 0 ? 1 : -1, 1];
    var Y = katman(W, H), s = svgAc(W, H, V.ad);
    var tn = function(e, t){ return ((t - e.min) / ((e.max - e.min) || 1)) * 2 - 1; };
    // arka duvarlar: her eksende izleyicinin TERS yanı (taban her zaman alt)
    [0, 1, 2].forEach(function(i){
      var j = (i + 1) % 3, l = (i + 2) % 3, c = i === 2 ? -1 : -sg[i];
      var kose = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function(t){ var n = [0, 0, 0]; n[i] = c; n[j] = t[0]; n[l] = t[1]; return nk(n); });
      s += '<path class="ve-pd-duvar" d="M' + kose.join(' L') + 'Z"/>';
      [[j, l], [l, j]].forEach(function(e){
        E[e[0]].I.v.forEach(function(t){
          var a = [0, 0, 0], b = [0, 0, 0];
          a[i] = b[i] = c; a[e[0]] = b[e[0]] = tn(E[e[0]], t); a[e[1]] = -1; b[e[1]] = 1;
          if(Math.abs(a[e[0]]) <= 1.0001) s += '<path class="ve-pd-izg" d="M' + nk(a) + ' L' + nk(b) + '"/>';
        });
      });
    });
    // pencere kutusu (yüzler)
    var kb = null;
    if(V.kutu){
      var a = Q(V.kutu.a), b = Q(V.kutu.b);
      for(var t = 0; t < 3; t++){ a[t] = Math.max(-1, Math.min(1, a[t])); b[t] = Math.max(-1, Math.min(1, b[t])); }
      kb = { a:a, b:b };
      [0, 1, 2].forEach(function(i){
        [a[i], b[i]].forEach(function(c){
          var j = (i + 1) % 3, l = (i + 2) % 3;
          var kose = [[a[j], a[l]], [b[j], a[l]], [b[j], b[l]], [a[j], b[l]]].map(function(u){ var n = [0, 0, 0]; n[i] = c; n[j] = u[0]; n[l] = u[1]; return nk(n); });
          s += '<path class="ve-pd-kutu-y" d="M' + kose.join(' L') + 'Z"/>';
        });
      });
    }
    // yüzey ve noktalar derinliğe göre
    var L = [];
    (V.dortgen || []).forEach(function(d){
      var n = d.p.map(Q), z = 0;
      n.forEach(function(m){ z += K.derin(m); });
      L.push({ z:z / 4, h:'<path class="' + d.s + '" d="M' + n.map(nk).join(' L') + 'Z"' + (d.i != null ? ' data-i="' + d.i + '"' : '') + '/>' });
    });
    (V.nokta || []).forEach(function(p){
      var n = Q(p.p);
      if(n.some(function(c){ return !(c >= -1.0001 && c <= 1.0001); })) return;
      var q = S(n);
      L.push({ z:K.derin(n), h:'<circle class="' + p.s + '" cx="' + R(q[0]) + '" cy="' + R(q[1]) + '" r="' + (p.r || 2) + '"' + (p.i != null ? ' data-i="' + p.i + '"' : '') + '/>' });
    });
    L.sort(function(p, q){ return p.z - q.z; });
    L.forEach(function(e){ s += e.h; });
    // düzlem (yüzeyin sınır seviyesi): yalnız çerçevesi — dolgusu yüzeyle kesişirdi
    if(V.duzlem){
      var zd = tn(E[2], V.duzlem.z);
      if(zd >= -1 && zd <= 1) s += '<path class="ve-pd-kutu" d="M' + [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function(u){ return nk([u[0], u[1], zd]); }).join(' L') + 'Z"/>';
    }
    // pencere kutusu (kenarlar)
    if(kb){
      var ks = [kb.a, kb.b];
      for(var i = 0; i < 3; i++){
        var j = (i + 1) % 3, l = (i + 2) % 3;
        [0, 1].forEach(function(u){ [0, 1].forEach(function(w){
          var p1 = [0, 0, 0], p2 = [0, 0, 0];
          p1[i] = kb.a[i]; p2[i] = kb.b[i]; p1[j] = p2[j] = ks[u][j]; p1[l] = p2[l] = ks[w][l];
          s += '<path class="ve-pd-kutu" d="M' + nk(p1) + ' L' + nk(p2) + '"/>';
        }); });
      }
    }
    // işaretler (uzlaşı · mevcut) — noktaların üstünde
    var engel = [];
    (V.isaret || []).forEach(function(m){
      var n = Q(m.p);
      if(n.some(function(c){ return !(c >= -1.0001 && c <= 1.0001); })) return;
      var q = S(n), r = m.r || 7;
      if(m.s === 've-pd-mev') s += '<path class="ve-pd-mev" d="M' + R(q[0]) + ' ' + R(q[1] - r) + 'L' + R(q[0] + r) + ' ' + R(q[1]) + 'L' + R(q[0]) + ' ' + R(q[1] + r) + 'L' + R(q[0] - r) + ' ' + R(q[1]) + 'Z"' + ip(m.ip) + '/>';
      else s += '<circle class="' + m.s + '" cx="' + R(q[0]) + '" cy="' + R(q[1]) + '" r="' + r + '"' + (m.i != null ? ' data-i="' + m.i + '"' : '') + '/>';
      engel.push({ l:q[0] - r, r:q[0] + r, t:q[1] - r, b:q[1] + r, x:q[0], y:q[1], rr:r, ad:m.ad });
    });
    // eksenler: X ve Y tabanın ön kenarında, Z soldaki dikey kenarda
    var kenar = [
      function(t){ return [t, sg[1], -1]; }, function(t){ return [sg[0], t, -1]; }, null
    ];
    var z1 = [sg[0], -sg[1]], z2 = [-sg[0], sg[1]];
    var zk = S([z1[0], z1[1], 0])[0] <= S([z2[0], z2[1], 0])[0] ? z1 : z2;
    kenar[2] = function(t){ return [zk[0], zk[1], t]; };
    var merkez = function(i, n){ var m = [0, 0, 0]; m[i] = n[i]; return m; };   // kenara paralel merkez ekseni
    E.forEach(function(e, i){
      s += '<path class="ve-pd-eks" d="M' + nk(kenar[i](-1)) + ' L' + nk(kenar[i](1)) + '"/>';
      var yaz = function(n, t, d, opt){
        var q = S(n), m = S(merkez(i, n)), dx = q[0] - m[0], dy = q[1] - m[1], L0 = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= L0; dy /= L0;
        var a = dx > 0.35 ? 'start' : dx < -0.35 ? 'end' : 'middle';
        Y.ekle(q[0] + dx * d, q[1] + dy * d + px * 0.35, t, px, Object.assign({ a:a }, opt));
      };
      e.I.v.forEach(function(t, z){
        var n = kenar[i](tn(e, t));
        if(Math.abs(n[i]) > 1.0001) return;
        yaz(n, e.kat ? e.kat[z] : sayi(t, e.I.b), px * 0.9 + 3, { s:'s', pri:(z === 0 || z === e.I.v.length - 1) ? 3 : 1 });
      });
      // düşey eksenin adı kenarın üst ucunda (yan tarafta dar çizimde sığmıyordu)
      if(i === 2){ var u = S(kenar[2](1)); Y.ekle(u[0], u[1] - px - 4, e.ad, px, { a:'middle', pri:9 }); }
      else yaz(kenar[i](0), e.ad, px * 3.6 + 6, { pri:9 });
    });
    var yer = Y.kutular().concat(engel);
    engel.forEach(function(m){
      if(!m.ad) return;
      var p = adYeri(m.x, m.y, m.rr, m.ad, o.fs.o, yer, { l:0, r:W, t:0, b:H });
      if(!p) return;
      yer.push(p.k);
      Y.ekle(p.x, p.y, m.ad, o.fs.o, { a:p.a, s:'b', kalin:true, pri:8 });
    });
    return { svg:s + Y.ciz() + '</svg>', h:H };
  }

  // ══ SONUÇ'UN İKİ SADE GRAFİĞİ (kullanıcı kararı 2026-10-18: "Tablo + iki
  // sade grafik") — pencerede her zaman çizilir; kısıtlar kodsuz, eksenler adıyla.

  // ── MODLAR — mevcut ve öneri, çentik başına bir mod ──────────────────────
  // V: { satir:[{ ad, f:[Hz], kotu:[bool], ip:[metin], kose:{ a:[Hz], b:[Hz] }|null, vurgu }],
  //      bolge:[[Hz, Hz]] (sınır dışı; üst ucu Infinity olabilir), bant:[8, 10],
  //      k1a (Hz; daha yakın iki mod köprülenir), ozel:[Hz] (sınırın işareti), xMax }
  function modSerit(V, o){
    var W = o.W, px = o.fs.k, sat = 28;
    var adG = Math.max.apply(null, V.satir.map(function(r){ return gen(r.ad, px, r.vurgu); })) + 16;
    var F = { l:adG, r:W - 12, t:px + 10, b:px + 10 + V.satir.length * sat };
    var H = F.b + 2 * px + 16;
    var Ix = ust(0, V.xMax, Math.max(3, Math.floor((F.r - F.l) / (px * 7))));
    var xM = Ix.v[Ix.v.length - 1], X = olcek(0, xM, F.l, F.r), Y = katman(W, H), s = svgAc(W, H, 'Modlar');
    var dilim = function(a, b){ var x0 = X(Math.max(0, a)), x1 = X(Math.min(b, xM)); return x1 > x0 ? [x0, x1] : null; };
    (V.bolge || []).concat([V.bant]).forEach(function(b){
      var d = dilim(b[0], b[1]);
      if(d) s += '<rect class="ve-pd-bolge" x="' + R(d[0]) + '" y="' + F.t + '" width="' + R(d[1] - d[0]) + '" height="' + (F.b - F.t) + '"/>';
    });
    var db = dilim(V.bant[0], V.bant[1]);
    if(db) Y.ekle((db[0] + db[1]) / 2, F.t - 5, sayi(V.bant[0], 0) + '–' + sayi(V.bant[1], 0), px, { a:'middle', s:'s', pri:6 });
    var ozel = {};
    (V.ozel || []).forEach(function(v){ if(v > 0 && v < xM){ ozel[v] = 3; if(Ix.v.indexOf(v) < 0) Ix.v.push(v); } });
    Ix.v.sort(function(a, b){ return a - b; });
    if((V.ozel || []).some(function(v){ return v % 1; })) Ix.b = Math.max(Ix.b, 1);
    s += xEksen(F, Ix, X, px, Y, ozel);
    V.satir.forEach(function(r, j){
      var y = F.t + (j + 0.5) * sat;
      if(j) s += cizgi(F.l, F.t + j * sat, F.r, F.t + j * sat, 've-pd-izg');
      Y.ekle(F.l - 8, y + px * 0.35, r.ad, px, { a:'end', s:r.vurgu ? 'b' : '', kalin:!!r.vurgu, pri:7 });
      if(r.kose) r.f.forEach(function(f, i){
        var a = X(r.kose.a[i]), b = X(r.kose.b[i]);
        if(Number.isFinite(a) && Number.isFinite(b)) s += cizgi(Math.max(F.l, Math.min(a, b)), y, Math.min(F.r, Math.max(a, b)), y, 've-pd-kose');
      });
      var f = r.f.slice().sort(function(a, b){ return a - b; });
      for(var i = 1; i < f.length; i++) if(f[i] - f[i - 1] <= V.k1a && X(f[i - 1]) < F.r)
        s += cizgi(X(f[i - 1]), y + 12, Math.min(F.r, X(f[i])), y + 12, 've-pd-yakin');
      r.f.forEach(function(fi, i){
        var x = X(fi);
        if(!(x >= F.l && x <= F.r)) return;
        s += cizgi(x, y - 9, x, y + 9, 've-pd-tik' + (r.kotu && r.kotu[i] ? ' k' : ''))
          + '<rect class="ve-pd-hit" x="' + R(x - 4) + '" y="' + R(y - 11) + '" width="8" height="22"' + ip(r.ip && r.ip[i]) + '/>';
      });
    });
    Y.ekle((F.l + F.r) / 2, H - 6, 'Frekans [Hz]', px, { a:'middle', pri:9 });
    return { svg:s + Y.ciz() + '</svg>', h:H };
  }

  // ── STATİK SEHİM VE İLETİLEBİLİRLİK — mevcut → öneri, yakın seçenekler ───
  // V: { mevcut:{ x (mm), y (%), ip }|null, oneri:{ x, y, i, ad }|null,
  //      yakin:[{ x, y, i }], e1, e2 (mm|null; aralarındaki bant gölgeli), k2 (%) }
  function sehimT(V, o){
    var W = o.W, px = o.fs.k;
    var H = o.H || Math.round(Math.max(200, Math.min(300, W * 0.58)));
    var P = [V.mevcut, V.oneri].concat(V.yakin || []).filter(Boolean);
    var xm = Math.max.apply(null, P.map(function(p){ return p.x; }).concat([V.e1 || 0, V.e2 || 0, 1]));
    var ym = Math.max.apply(null, P.map(function(p){ return p.y; }).concat([5]));
    var F = { l:0, r:W - 14, t:px + 16, b:H - 2 * px - 18 };
    var Iy = ust(0, ym * 1.15, Math.max(3, Math.floor((F.b - F.t) / 34)));
    F.l = solPay(Iy, px);
    var Ix = ust(0, xm * 1.12, Math.max(3, Math.floor((F.r - F.l) / (px * 6))));
    var xM = Ix.v[Ix.v.length - 1], yM = Iy.v[Iy.v.length - 1];
    var X = olcek(0, xM, F.l, F.r), Yo = olcek(0, yM, F.b, F.t), Y = katman(W, H);
    var s = svgAc(W, H, 'Statik sehim ve iletilebilirlik');
    if(V.e1 != null || V.e2 != null){
      var a = X(V.e1 != null ? V.e1 : 0), b = X(V.e2 != null ? Math.min(V.e2, xM) : xM);
      if(b > a) s += '<rect class="ve-pd-kabul" x="' + R(a) + '" y="' + F.t + '" width="' + R(b - a) + '" height="' + (F.b - F.t) + '"/>';
    }
    s += xEksen(F, Ix, X, px, Y) + yEksen(F, Iy, Yo, px, Y);
    if(V.k2 != null && V.k2 <= yM){
      s += cizgi(F.l, Yo(V.k2), F.r, Yo(V.k2), 've-pd-sinir');
      Y.ekle(F.r - 4, Yo(V.k2) - 5, '%' + sayi(V.k2, 0), px, { a:'end', pri:5 });
    }
    (V.yakin || []).forEach(function(p){
      s += '<circle class="ve-pd-yk" cx="' + R(X(p.x)) + '" cy="' + R(Yo(p.y)) + '" r="3.6" data-i="' + p.i + '"/>';
    });
    var adlar = [], engel = [];
    var m = V.mevcut ? [X(V.mevcut.x), Yo(V.mevcut.y)] : null, u = V.oneri ? [X(V.oneri.x), Yo(V.oneri.y)] : null;
    // ok: mevcuttan öneriye; uçlar işaretlerin dışında, ucu dolu üçgen
    if(m && u){
      var dx = u[0] - m[0], dy = u[1] - m[1], L = Math.sqrt(dx * dx + dy * dy);
      if(L > 30){
        var ux = dx / L, uy = dy / L, tx = u[0] - ux * 10, ty = u[1] - uy * 10, bx = tx - ux * 7, by = ty - uy * 7;
        s += cizgi(m[0] + ux * 9, m[1] + uy * 9, bx, by, 've-pd-ok')
          + '<path class="ve-pd-ok-uc" d="M' + R(tx) + ' ' + R(ty) + 'L' + R(bx - uy * 3.6) + ' ' + R(by + ux * 3.6)
          + 'L' + R(bx + uy * 3.6) + ' ' + R(by - ux * 3.6) + 'Z"/>';
      }
    }
    if(m){
      s += '<path class="ve-pd-mev" d="M' + R(m[0]) + ' ' + R(m[1] - 6.5) + 'L' + R(m[0] + 6.5) + ' ' + R(m[1]) + 'L' + R(m[0]) + ' ' + R(m[1] + 6.5)
        + 'L' + R(m[0] - 6.5) + ' ' + R(m[1]) + 'Z"' + ip(V.mevcut.ip) + '/>';
      adlar.push([m[0], m[1], 7, 'Mevcut']);
      engel.push({ l:m[0] - 7, r:m[0] + 7, t:m[1] - 7, b:m[1] + 7 });
    }
    if(u){
      s += '<circle class="ve-pd-n3" cx="' + R(u[0]) + '" cy="' + R(u[1]) + '" r="3.6" data-i="' + V.oneri.i + '"/>'
        + '<circle class="ve-pd-uz" cx="' + R(u[0]) + '" cy="' + R(u[1]) + '" r="7.5" data-i="' + V.oneri.i + '"/>';
      adlar.unshift([u[0], u[1], 8.5, V.oneri.ad || 'Öneri']);
      engel.push({ l:u[0] - 8.5, r:u[0] + 8.5, t:u[1] - 8.5, b:u[1] + 8.5 });
    }
    Y.ekle(4, px + 4, 'İletilebilirlik [%]', px, { a:'start', pri:9 });
    Y.ekle((F.l + F.r) / 2, H - 6, 'Statik sehim [mm]', px, { a:'middle', pri:9 });
    var yer = Y.kutular().concat(engel);
    adlar.forEach(function(q){
      var p = adYeri(q[0], q[1], q[2], q[3], o.fs.o, yer, F);
      if(!p) return;
      yer.push(p.k);
      Y.ekle(p.x, p.y, q[3], o.fs.o, { a:p.a, s:'b', kalin:true, pri:8 });
    });
    return { svg:s + Y.ciz() + '</svg>', h:H };
  }

  return {
    R:R, esc:esc, gen:gen, kutu:kutu, kesis:kesis, isaretler:isaretler, adim:adim, gosterge:gosterge,
    pareto:pareto, modlar:modlar, baglayici:baglayici, duyarlilik:duyarlilik, basamak:basamak, anaEtki:anaEtki,
    haritalar:haritalar, tHaritasi:tHaritasi, sinirYolu:sinirYolu, T_SINIF:T_SINIF, uc:uc, ucKamera:ucKamera,
    modSerit:modSerit, sehimT:sehimT
  };
})();

if(typeof module !== 'undefined' && module.exports){ module.exports = veMntParamCiz; }
