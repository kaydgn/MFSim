// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ — ASKI YAYININ TEKNİK RESMİ (DOM'suz çizici, 2026-11-13)
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı: *"bu analizde kullanılan yayın teknik resmini de attım. Onu da programa
// ekleyebiliriz."* Resmin taraması programa GİRMEZ (parça kodu — Canlı Not 1004; çizen
// ve onaylayanın adı; üreticinin çoğaltma kısıtı, program Pages'te yayında): program
// yayı resmin verisinden kendisi çizer (js/mount-yay.js → VE_MNT_YAY):
//   · yandan görünüş, serbest boyda — tel kesitleri, ön yüzün sarımları, eksen
//   · boy ölçüleri yığını, sağ yüz ortak: L0 · ilk · montaj · blok (resmin düzeni)
//   · kuvvet–boy doğrusu: her noktanın kuvveti boyunun sol ucunda, toleransıyla
//   · çaplar: dış (Do) solda, iç (Di) sağda, tel (d) altta
// Rapor modelin noktalarını da işaretler: `opt.model` [{ L mm, F kgf }] (statik, dolu
// daire) ve `opt.aralik` [Lmin, Lmax] mm (işletme, doğrunun üstünde kalın şerit).
//
// ÇİZİM SIRASI: zemin → eksen → yay → ölçü ve kılavuz çizgileri → doğru → işaret →
// YAZI (hâleli, en sonda: altından geçen çizgiyi hâle örter). Yerleşim sabit ve
// hesaplı; yazıların kutuları `cizim().kutular`la dışarı verilir — kapı çakışmayı onlarla
// ölçer. Renk CSS sınıfından (.ve-yay-*: programda iki tema, raporda kâğıt).
//
// Saf modül: DOM'a dokunmaz. Kapı: tests/unit/mount-yay-ciz.test.js.
// ═══════════════════════════════════════════════════════════════════════════

var veMntYayCiz = (function(){
  'use strict';

  function R(v){ return Math.round(v * 10) / 10; }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function sayi(v, b){ return (typeof veSayi === 'function') ? veSayi(v, b) : String(v); }
  function onda(v){ return Math.abs(v % 1) > 1e-9 ? 1 : 0; }   // 93,5 · 117
  // Yazının genişlik TAHMİNİ (mount-param-ciz.js'in kuralı): harf ~0,6 em, alt simgenin
  // harfi 0,8 boyunda. Bilerek cömert — tahmin gerçek kutudan küçük kalırsa çakışma kaçar.
  function gen(t, px){
    var w = 0, alt = false;
    String(t).split('').forEach(function(c){
      if(c === '_'){ alt = true; return; }
      if(c === ' ' || c === '=') alt = false;
      w += px * 0.6 * (alt ? 0.8 : 1);
    });
    return w;
  }
  // `_x` alt simgeye döner (HTML öğesi SVG'ye girmez — <sub> çizimin kalanını siler).
  function metin(t, px){
    return esc(t).replace(/_([\p{L}\p{N}]+)/gu, function(m, a){
      return '<tspan baseline-shift="sub" font-size="' + R(px * 0.8) + '">' + a + '</tspan>';
    });
  }
  function cizgi(x1, y1, x2, y2, s){
    return '<line class="' + s + '" x1="' + R(x1) + '" y1="' + R(y1) + '" x2="' + R(x2) + '" y2="' + R(y2) + '"/>';
  }
  // Ok ucu: (x, y) uçta, yön birim vektör (ux, uy) okun gösterdiği yön.
  function ok(x, y, ux, uy){
    var b = 6, e = 2.4, px_ = -uy, py_ = ux;
    return '<path class="ve-yay-ok" d="M' + R(x) + ' ' + R(y) + 'L' + R(x - ux * b + px_ * e) + ' ' + R(y - uy * b + py_ * e)
      + 'L' + R(x - ux * b - px_ * e) + ' ' + R(y - uy * b - py_ * e) + 'Z"/>';
  }
  // Ölçü çizgisi iki uçta okla (içe değil dışa, uzatma çizgilerine dayanır).
  function olcu(x1, y1, x2, y2){
    var L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    return cizgi(x1, y1, x2, y2, 've-yay-olcu') + ok(x2, y2, ux, uy) + ok(x1, y1, -ux, -uy);
  }

  // Resmin noktaları: serbest boy (F = 0), ilk · montaj (toleranslı), blok. Resimde blok
  // yoksa katalogun blok boyu, kuvveti doğrudan.
  function boylar(e){
    var N = {};
    (e.noktalar || []).forEach(function(p){ N[p.ad] = p; });
    var k = e.kgfmm > 0 ? e.kgfmm : NaN, L = [{ k:'0', L:e.L0, F:0 }];
    if(N.ilk) L.push({ k:'ilk', L:N.ilk.L, F:N.ilk.F, tol:N.ilk.tol });
    if(N.montaj) L.push({ k:'montaj', L:N.montaj.L, F:N.montaj.F, tol:N.montaj.tol });
    if(N.st) L.push({ k:'st', L:N.st.L, F:N.st.F, min:true });
    else if(e.Lc > 0 && Number.isFinite(k)) L.push({ k:'c', L:e.Lc, F:k * (e.L0 - e.Lc) });
    return L;
  }

  // Sarımın yarım tur noktaları (sol yüzden mm): ölü sarımlarda yarım adım d/2, aktiflerde
  // p/2; p = (L0 − (1 + 2nd)·d)/n, nd = (nt − n)/2 uç başına ölü sarım. Kapalı ve taşlanmış
  // uçta blok boyu nt·d (resim 7 · 9 = 63).
  function sarimlar(e){
    var nt = e.nt > 0 ? e.nt : (e.n > 0 ? e.n + 2 : 7), n = e.n > 0 ? e.n : nt - 2;
    var nd = Math.max(0, (nt - n) / 2), d = e.d, p = (e.L0 - (1 + 2 * nd) * d) / n;
    var u = [d / 2];
    for(var k = 0; k < 2 * nt; k++){
      var olu = k < 2 * nd || k >= 2 * nt - 2 * nd;
      u.push(u[u.length - 1] + (olu ? d / 2 : p / 2));
    }
    return u;
  }

  // ── çizim ────────────────────────────────────────────────────────────────
  // opt: { px (yazı boyu), olcek (px/mm), model:[{ L, F }], aralik:[Lmin, Lmax], ad }
  function cizim(e, opt){
    opt = opt || {};
    var px = opt.px > 0 ? opt.px : 11, s = opt.olcek > 0 ? opt.olcek : 2.2;
    var Do = e.Do > 0 ? e.Do : (e.D > 0 && e.d > 0 ? e.D + e.d : NaN);
    var Di = e.Di > 0 ? e.Di : (Do > 0 ? Do - 2 * e.d : NaN);
    var D = Do - e.d, r = e.d / 2 * s;
    var B = boylar(e), yaz = [], kat = { cizgi:'', yay:'', isaret:'' };
    var F = B.map(function(b){ return b.F; }), Fmax = Math.max.apply(null, F);
    // Kuvvet ölçeği: Fmax ~110 px; komşu iki kuvvet yazısı (alt simgeli kutu ~1,6 em) üst üste binmez
    var dF = Infinity;
    for(var i = 1; i < B.length; i++) dF = Math.min(dF, Math.abs(B[i].F - B[i - 1].F));
    var fs = Math.max(110 / (Fmax || 1), Number.isFinite(dF) && dF > 0 ? 1.7 * px / dF : 0);
    // Kuvvet yazıları ve sol sütunun genişliği
    var kAd = function(b){ return b.k === '0' ? '0' : b.k === 'c' ? 'c' : b.k; };
    B.forEach(function(b){
      b.fYazi = 'F_' + kAd(b) + ' = ' + (b.F ? sayi(b.F, onda(b.F)) + (b.tol ? ' ± ' + sayi(b.tol, onda(b.tol)) : '') + ' kgf' : '0');
      b.lYazi = 'L_' + kAd(b) + ' = ' + sayi(b.L, onda(b.L)) + (b.min ? ' min' : '');
    });
    var solW = Math.max.apply(null, B.map(function(b){ return gen(b.fYazi, px); }));
    var X0 = 8, xL0 = Math.max(X0 + solW + 14, X0 + 70), xR = xL0 + e.L0 * s;
    var x = function(L){ return xR - L * s; };
    var yF0 = px + 9 + Fmax * fs, y = function(Fk){ return yF0 - Fk * fs; };
    // Boy ölçüleri: en kısa en üstte (resmin düzeni), her biri ayrı katta
    var sira = B.slice().sort(function(a, b){ return a.L - b.L; }), kAr = px + 10;
    sira.forEach(function(b, j){ b.yOl = yF0 + kAr * (j + 1); });
    var yUst = yF0 + kAr * sira.length + 16;                  // dış çapın üstü
    var yAx = yUst + Do / 2 * s, yT = yAx - D / 2 * s, yB = yAx + D / 2 * s;
    var W = xR + 64, H = yB + r + 14 + px + 8;

    // eksen
    kat.cizgi += cizgi(xL0 - 10, yAx, xR + 10, yAx, 've-yay-eksen');
    // yay: ön yüzün sarımları (üst kesitten alttakine), kesitler, taşlanmış uçlar
    var u = sarimlar(e), xs = u.map(function(v){ return xL0 + v * s; });
    for(var k = 0; k + 1 < xs.length; k += 2){
      var x1 = xs[k], x2 = xs[k + 1], vx = x2 - x1, vy = yB - yT, l = Math.hypot(vx, vy), nx = -vy / l * r, ny = vx / l * r;
      kat.yay += cizgi(x1 + nx, yT + ny, x2 + nx, yB + ny, 've-yay-tel') + cizgi(x1 - nx, yT - ny, x2 - nx, yB - ny, 've-yay-tel');
    }
    xs.forEach(function(cx, k){
      kat.yay += '<circle class="ve-yay-kesit" cx="' + R(cx) + '" cy="' + R(k % 2 ? yB : yT) + '" r="' + R(r) + '"/>';
    });
    kat.yay += cizgi(xL0, yT - r, xL0, yB + r, 've-yay-yuz') + cizgi(xR, yT - r, xR, yB + r, 've-yay-yuz');

    // boy ölçüleri: sağ yüz ortak uzatma çizgisi; her boyun sol ucundan kuvvet noktasına
    kat.cizgi += cizgi(xR, yT - r - 3, xR, sira[0].yOl - 4, 've-yay-uzat');
    B.forEach(function(b){
      var xb = x(b.L);
      kat.cizgi += olcu(xb, b.yOl, xR, b.yOl);
      kat.cizgi += cizgi(xb, y(b.F), xb, b.yOl + 4, 've-yay-uzat');
      yaz.push({ x:(xb + xR) / 2, y:b.yOl - 8, t:b.lYazi, a:'middle' });
      // kuvvet kılavuzu: soldaki yazıdan noktaya
      var yy = y(b.F);
      kat.cizgi += cizgi(X0 + gen(b.fYazi, px) + 4, yy, xb, yy, 've-yay-kilavuz');
      yaz.push({ x:X0, y:yy - 3, t:b.fYazi, a:'start' });
    });
    // kuvvet–boy doğrusu ve noktalar (toleranslı noktada çubuk)
    var son = B[B.length - 1];
    kat.cizgi += cizgi(x(e.L0), y(0), x(son.L), y(son.F), 've-yay-dogru');
    B.forEach(function(b){
      var xb = x(b.L), yy = y(b.F);
      if(b.tol){
        kat.isaret += cizgi(xb, y(b.F + b.tol), xb, y(b.F - b.tol), 've-yay-tol')
          + cizgi(xb - 3, y(b.F + b.tol), xb + 3, y(b.F + b.tol), 've-yay-tol')
          + cizgi(xb - 3, y(b.F - b.tol), xb + 3, y(b.F - b.tol), 've-yay-tol');
      }
      kat.isaret += '<rect class="ve-yay-nokta" x="' + R(xb - 3) + '" y="' + R(yy - 3) + '" width="6" height="6"/>';
    });
    // modelin işletme aralığı ve statik noktaları (rapor)
    var kgfmm = e.kgfmm > 0 ? e.kgfmm : NaN;
    var Lsin = function(L){ return Math.min(e.L0, Math.max(son.L, L)); };
    var Fl = function(L){ return Number.isFinite(kgfmm) ? Math.max(0, kgfmm * (e.L0 - L)) : NaN; };
    if(opt.aralik && opt.aralik.length === 2 && opt.aralik.every(Number.isFinite)){
      var a0 = Lsin(Math.max(opt.aralik[0], opt.aralik[1])), a1 = Lsin(Math.min(opt.aralik[0], opt.aralik[1]));
      if(Number.isFinite(Fl(a0))) kat.isaret = cizgi(x(a0), y(Fl(a0)), x(a1), y(Fl(a1)), 've-yay-aralik') + kat.isaret;
    }
    (opt.model || []).forEach(function(m){
      if(!m || !Number.isFinite(m.L)) return;
      var Lm = Lsin(m.L), Fm = Number.isFinite(m.F) ? m.F : Fl(Lm);
      if(!Number.isFinite(Fm)) return;
      kat.isaret += '<circle class="ve-yay-model" cx="' + R(x(Lm)) + '" cy="' + R(y(Math.max(0, Math.min(Fmax, Fm)))) + '" r="3.6"/>';
    });

    // çaplar: dış çap solda, iç çap sağda, tel çapı altta
    var xDo = xL0 - 22, xDi = xR + 20;
    kat.cizgi += cizgi(xDo - 4, yAx - Do / 2 * s, xs[0], yAx - Do / 2 * s, 've-yay-uzat')
      + cizgi(xDo - 4, yAx + Do / 2 * s, xs[1], yAx + Do / 2 * s, 've-yay-uzat')
      + olcu(xDo, yAx - Do / 2 * s, xDo, yAx + Do / 2 * s);
    yaz.push({ x:xDo - 5, y:yAx - 6, t:'Ø' + sayi(Do, onda(Do)), a:'end' });
    var xn = xs[xs.length - 1], xp = xs[xs.length - 2];
    kat.cizgi += cizgi(xn, yAx - Di / 2 * s, xDi + 4, yAx - Di / 2 * s, 've-yay-uzat')
      + cizgi(xp, yAx + Di / 2 * s, xDi + 4, yAx + Di / 2 * s, 've-yay-uzat')
      + olcu(xDi, yAx - Di / 2 * s, xDi, yAx + Di / 2 * s);
    yaz.push({ x:xDi + 5, y:yAx - 6, t:'Ø' + sayi(Di, onda(Di)), a:'start' });
    var kd = Math.floor(xs.length / 2) | 1, xd = xs[kd];            // alttaki (tek) bir kesit
    kat.cizgi += cizgi(xd + r * 0.7, yB + r * 0.7, xd + 14, yB + r + 12, 've-yay-kilavuz');
    yaz.push({ x:xd + 16, y:yB + r + 12 + px * 0.35, t:'d = Ø' + sayi(e.d, onda(e.d)), a:'start' });

    // yazılar en sonda; kutular kapı için
    var kutular = [], ys = '';
    yaz.forEach(function(o){
      var w = gen(o.t, px), l = o.a === 'end' ? o.x - w : o.a === 'middle' ? o.x - w / 2 : o.x;
      kutular.push({ t:o.t, l:l, r:l + w, ust:o.y - px * 0.96, alt:o.y + px * (o.t.indexOf('_') >= 0 ? 0.62 : 0.3) });
      ys += '<text class="ve-yay-y" x="' + R(o.x) + '" y="' + R(o.y) + '" font-size="' + px + '"'
        + (o.a !== 'start' ? ' text-anchor="' + o.a + '"' : '') + '>' + metin(o.t, px) + '</text>';
    });
    var ad = opt.ad || ((e.ad || 'Askı yayı') + ' · teknik resim');
    var svg = '<svg class="ve-yay" viewBox="0 0 ' + R(W) + ' ' + R(H) + '" width="' + R(W) + '" height="' + R(H) + '" role="img" aria-label="' + esc(ad) + '">'
      + '<rect class="ve-yay-zem" x="0" y="0" width="' + R(W) + '" height="' + R(H) + '"/>'
      + kat.cizgi + kat.yay + kat.isaret + ys + '</svg>';
    return { svg:svg, W:W, H:H, kutular:kutular, x:x, y:y };
  }

  // Resmin verisi föyün satırları: [ad, değer] — pencere ve rapor aynı listeden.
  function veri(e){
    var S = [], ek = function(a, v){ if(v != null && v !== '') S.push([a, v]); };
    var nmm = (typeof veMntYayNmm === 'function') ? veMntYayNmm(e) : NaN;
    ek('Yay sabiti', e.kgfmm > 0 ? sayi(e.kgfmm, 2) + (e.kgfmmTol ? ' ± ' + sayi(e.kgfmmTol, onda(e.kgfmmTol)) : '') + ' kgf/mm'
      + (Number.isFinite(nmm) ? ' (' + sayi(nmm, 1) + ' N/mm)' : '') : null);
    ek('Sarım', (e.nt > 0 ? 'toplam ' + sayi(e.nt, 0) : '') + (e.n > 0 ? (e.nt > 0 ? ' · ' : '') + 'aktif ' + sayi(e.n, 0) : ''));
    ek('Uç', e.uc);
    ek('Sarım yönü', e.yon);
    ek('Ön gerilim', e.onGerilimli === true ? 'var' : e.onGerilimli === false ? 'yok' : null);
    ek('Kumlama', e.kumlama);
    ek('Blok boyuna sıkıştırma', e.blokSikistirma === true ? 'evet' : e.blokSikistirma === false ? 'hayır' : null);
    ek('Malzeme', e.malzeme);
    ek('Çekme dayanımı', e.Rm > 0 ? sayi(e.Rm, 0) + ' MPa' : null);
    ek('Tolerans', e.tolerans);
    return S;
  }

  return { cizim:cizim, veri:veri, boylar:boylar, sarimlar:sarimlar, gen:gen };
})();

if(typeof module !== 'undefined' && module.exports){ module.exports = veMntYayCiz; }
