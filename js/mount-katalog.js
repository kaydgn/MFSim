// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ — PARAMETRİK ANALİZ · KATALOGDAN SEÇİM (DOM'suz çekirdek)
// ═══════════════════════════════════════════════════════════════════════════
//
// Güç grubunun takoz GRUPLARINA kütüphanedeki tipler takılır ve her
// kombinasyon uygulamanın KENDİ çözüm yolundan geçirilir (ölçüm işlevleri
// çağırandan gelir: js/cp-mount-param.js → _mntPrepareFrom · solveOne ·
// solveModes). Bu dosya çözmez; gruplar, kombinasyonu çözer, kısıtı
// değerlendirir, Pareto cephesini ve uzlaşı sırasını kurar.
//
// GRUP (kullanıcı kararı 2026-10-16: "sağ ve sol takoz aynı tip olacak.
// Sadece konumları, ön, orta, arka gibi takoz grupları farklı olacak"):
//   (1) AD — adında tek bir yan sözcüğü (sağ/sol) olan iki takoz, o sözcük
//       çıkınca kalan ad aynıysa çifttir ("Sağ Ön Takoz" ↔ "Sol Ön Takoz",
//       "Ön Sağ · 57RS313774" ↔ "Ön Sol · 57RS313774").
//   (2) GEOMETRİ — eşleşmemiş iki takoz y'de ayna, x ve z'de aynıysa
//       (TOL_MM içinde) çifttir.
//   (3) Kalan takoz tek başına bir gruptur (orta hattaki takoz).
// Gruplar ortalama x'e göre sıralanır: x arkaya doğru artar (örneklerde ön
// takozlar küçük x'te).
//
// İKİ AŞAMA: (1) statik denge + modal — frekans kısıtları, iletilebilirlik,
// statik sehim, kapasite; (2) yalnız birinci aşamayı geçenlerde işletme
// yük durumları — sehim bandı ve çekme. Hiçbir kombinasyon birinci aşamayı
// geçmezse ikinci aşama en az ihlalli `enIyi` kombinasyonda koşar.
//
// AMAÇ: iletilebilirlik T (Kriter 2'nin tanımı) ve en büyük statik sehim —
// ikisi de küçülmek ister, birbirine karşı çalışır (yumuşak takoz T'yi
// düşürür, sehimi büyütür). Uygun kümede Pareto cephesi + uzlaşı uzaklığı
// (min–max normalleştirilmiş, ağırlıklı, ideal noktaya). En küçük uzaklık
// Pareto cephesindedir: baskın bir nokta, onu baskılayanın uzaklığını aşar.
//
// Saf modül: DOM'a dokunmaz, global duruma yazmaz. Jest'te doğrudan test edilir.
// ═══════════════════════════════════════════════════════════════════════════

var veMntKatalog = (function() {
  'use strict';

  // ── 1) GRUPLAR ────────────────────────────────────────────────────────────
  var YAN = { 'sağ':'sag', 'sol':'sol', 'right':'sag', 'left':'sol' };
  var TOL_MM = 10;

  function _parca(ad){ return String(ad == null ? '' : ad).split(/([^\p{L}\p{N}]+)/u); }

  // Adı yan sözcüğünden ayırır. Tek bir yan sözcüğü yoksa null (iki yan
  // sözcüğü taşıyan ad belirsizdir; çift kurulmaz, geometriye kalır).
  function yanAyir(ad){
    var p = _parca(ad), yer = -1, yan = null, say = 0;
    for(var i = 0; i < p.length; i += 2){
      var y = YAN[p[i].toLocaleLowerCase('tr')];
      if(y){ say++; yer = i; yan = y; }
    }
    if(say !== 1) return null;
    var q = p.slice(); q[yer] = '';
    var anahtar = q.join('').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLocaleLowerCase('tr');
    return { yan: yan, anahtar: anahtar, yer: yer, p: p };
  }

  // Çiftin adı: ilk üyenin adında yan sözcüğü "Sağ/Sol" olur, yazım biçimi korunur.
  function ciftAdi(ay){
    var w = ay.p[ay.yer], tr = /^(sağ|sol)$/.test(w.toLocaleLowerCase('tr'));
    var e = tr ? 'Sağ/Sol' : 'Right/Left';
    if(w === w.toLocaleUpperCase('tr')) e = e.toLocaleUpperCase('tr');
    else if(w === w.toLocaleLowerCase('tr')) e = e.toLocaleLowerCase('tr');
    var q = ay.p.slice(); q[ay.yer] = e;
    return q.join('');
  }

  // takozlar: [{ id, name, x, y, z (mm), libKey? }]
  // Dönüş: [{ no, anahtar, ad, uyeler:[i], idler:[id], x, cift, tip }]
  function gruplar(takozlar){
    var T = takozlar || [], n = T.length, es = [];
    for(var i = 0; i < n; i++) es.push(-1);
    var ay = T.map(function(t){ return yanAyir(t.name); });
    var adla = {};
    for(i = 0; i < n; i++){
      if(es[i] >= 0 || !ay[i]) continue;
      for(var j = i + 1; j < n; j++){
        if(es[j] >= 0 || !ay[j]) continue;
        if(ay[i].anahtar === ay[j].anahtar && ay[i].yan !== ay[j].yan){ es[i] = j; es[j] = i; adla[i] = adla[j] = true; break; }
      }
    }
    var aday = [];
    for(i = 0; i < n; i++) for(j = i + 1; j < n; j++){
      if(es[i] >= 0 || es[j] >= 0) continue;
      var a = T[i], b = T[j];
      if(!(Math.abs(a.y) > TOL_MM && Math.abs(b.y) > TOL_MM && a.y * b.y < 0)) continue;
      var e = Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z), Math.abs(a.y + b.y));
      if(e <= TOL_MM) aday.push([e, i, j]);
    }
    aday.sort(function(p, q){ return p[0] - q[0] || p[1] - q[1] || p[2] - q[2]; });
    aday.forEach(function(c){ if(es[c[1]] < 0 && es[c[2]] < 0){ es[c[1]] = c[2]; es[c[2]] = c[1]; } });

    var G = [], gor = [];
    for(i = 0; i < n; i++){
      if(gor[i]) continue;
      gor[i] = true;
      var uy = [i];
      if(es[i] >= 0){ uy.push(es[i]); gor[es[i]] = true; }
      var ad = uy.length === 1 ? String(T[i].name == null ? '' : T[i].name)
        : adla[i] ? ciftAdi(ay[i]) : T[uy[0]].name + ' + ' + T[uy[1]].name;
      var tipler = uy.map(function(k){ return T[k].libKey || ''; });
      G.push({
        anahtar: uy.map(function(k){ return String(T[k].id); }).sort().join('|'),
        ad: ad, uyeler: uy, idler: uy.map(function(k){ return T[k].id; }),
        x: uy.reduce(function(s, k){ return s + T[k].x; }, 0) / uy.length,
        z: uy.reduce(function(s, k){ return s + T[k].z; }, 0) / uy.length,
        cift: uy.length === 2,
        tip: (tipler[0] && tipler.every(function(t){ return t === tipler[0]; })) ? tipler[0] : null
      });
    }
    G.sort(function(p, q){ return p.x - q.x || p.z - q.z || p.uyeler[0] - q.uyeler[0]; });
    G.forEach(function(g, k){ g.no = k + 1; });
    return G;
  }

  // Tek taramanın üst sınırı: aşama 1 kombinasyon başına ~0,5 ms (tarayıcıda
  // ölçülen Node değeri) → 200.000 kombinasyon ~2 dakika. Dört grup × 27 tip
  // 531.441'dir; o durumda grup sabitlenir ya da aday daraltılır.
  var MAKS_KOMB = 200000;

  // Taranan grup sayısı ve kombinasyon sayısı. sabit: { grupAnahtarı: true }.
  function kombinasyonSayisi(G, nAday, sabit){
    var s = sabit || {}, N = 1, t = 0;
    (G || []).forEach(function(g){ if(!s[g.anahtar]){ N *= nAday; t++; } });
    return t ? N : 0;
  }

  // ── 2) KISITLAR ───────────────────────────────────────────────────────────
  // Kriter 1 · 1a · 1b · 2 programın uygunluk tablosunun AYNISI (cp-mount-report.js
  // veMntUygunluk · çekirdek modePlacement): sınır, eşitlik yönü ve taban aynı.
  // Kullanıcı kararı (2026-10-16): bu dördü kesin — kapatılamaz, sınırı sabit.
  // Ek kısıtlar (E1–E9) literatüre ve üretici verisine dayanır; sınırı
  // değiştirilir, kapatılır. Dayanakları raporun §3'ünde (cp-mount-param-rapor.js).
  //
  // Her değerlendirme { ok, v, deger, sinir, na } döner: v ≥ 0 normalleştirilmiş
  // ihlal (0 = sağlanıyor), en az ihlalli sıralamada toplanır. na: veri yok —
  // kısıt değerlendirilmedi (kütüphane girdisinde kapasite yoksa E4 · E9).
  //
  // TOLERANS (seçenek): üretimde takoz rijitliği ±%15 saçılır (Shen 2024;
  // Torgal 2015). Açıksa ölçüm köşeleriyle gelir — anma (o), bütün takozlar
  // sert (o.sert) ve yumuşak (o.yumusak) — ve her kısıt kendi kötü köşesinde
  // sınanır: frekansın üst sınırı ve T sertte, sehim ve alt frekans yumuşakta,
  // bant ve aralık her köşede. Amaç (T, δ_s) anma değerdedir.
  var EPS_V = 1e-9;
  function _ihlal(ok, v){ return ok ? 0 : Math.max(v, EPS_V); }
  function _kose(o){ return [o, o.sert, o.yumusak].filter(Boolean); }
  function _min(a){ var m = Infinity; (a || []).forEach(function(v){ if(v < m) m = v; }); return m; }
  function _max(a){ var m = -Infinity; (a || []).forEach(function(v){ if(v > m) m = v; }); return m; }
  function _aralik(f){
    var s = (f || []).slice().sort(function(a, b){ return a - b; }), g = Infinity;
    for(var i = 1; i < s.length; i++) g = Math.min(g, s[i] - s[i - 1]);
    return g;
  }
  function _sehim(o){ return _max((o.dz || []).map(Math.abs)); }      // δ_s: en büyük |δ_z|, 1 g statik

  var KISITLAR = [
    { k:'k1',  no:'1',  asama:1, zorunlu:true, ad:'Modal bant' },
    { k:'k1a', no:'1a', asama:1, zorunlu:true, ad:'Modlar arası ayrıklık' },
    { k:'k1b', no:'1b', asama:1, zorunlu:true, ad:'Yaylandırılmamış kütle bandı' },
    { k:'k2',  no:'2',  asama:1, zorunlu:true, ad:'Rölanti iletilebilirliği' },
    { k:'sehimAlt', no:'E1', asama:1, ad:'Statik sehim, alt sınır' },
    { k:'sehim',    no:'E2', asama:1, ad:'Statik sehim, üst sınır' },
    { k:'altMod',   no:'E3', asama:1, ad:'En düşük mod' },
    { k:'kapasite', no:'E4', asama:1, ad:'Taşıma kapasitesi' },
    { k:'ayrisma',  no:'E5', asama:1, ad:'Mod ayrışması' },
    { k:'isletme',  no:'E6', asama:2, ad:'İşletme yüklerinde sehim' },
    { k:'durdurucu', no:'E7', asama:2, ad:'Durdurucu payı, sürünme dâhil' },
    { k:'cekme',    no:'E8', asama:2, ad:'Çekme' },
    { k:'darbe',    no:'E9', asama:2, ad:'Darbe yükü' }
  ];
  // Çekirdek birimi: mm, Hz, oran (kapasite · ayrışma · darbe · sürünme · tolerans · ağırlık).
  var SINIR_VARSAYILAN = { sehimAlt:3, sehimUst:5, altMod:5, kapasite:1, ayrisma:0.8, isletmeUst:10,
                           durdurucuUst:15, darbe:2, surunme:0.3, tolerans:0.15, agirlik:0.5 };
  var ACIK_VARSAYILAN = { sehimAlt:true, sehim:true, altMod:true, kapasite:true, ayrisma:false,
                          isletme:true, durdurucu:true, cekme:true, darbe:true, tolerans:false };
  // Geçerli aralık [alt, üst, alt dâhil değil mi]; listede olmayan sınır > 0.
  var SINIR_ARALIK = { agirlik:[0, 1], surunme:[0, 1], tolerans:[0, 0.5, true] };
  var K1_ORAN = 0.5, K1A_HZ = 0.5, K1B = [8, 10], K2_T = 0.5;

  // o (aşama 1): { f:[Hz], T, dz:[mm] (statik düşey sehim, basma eksi), pay:[kg],
  //                kap:[kg|null], ked:{bounce, roll} (0–1) | null, sert?, yumusak? }
  // o (aşama 2): { dIsl:[mm] (işletme durumlarında en büyük |δ|), dSur:[mm] (aynısı,
  //                sürünmüş çalışma noktasında), cekmeMm, darbeOran (darbe yükü /
  //                kapasite) | null, yumusak? }
  var DEG = {
    k1: function(o, c){
      var lim = K1_ORAN * c.fAtes, fm = _max(_kose(o).map(function(x){ return _max(x.f); }));
      var ok = fm < lim;
      return { ok:ok, v:_ihlal(ok, (fm - lim) / lim), deger:fm, sinir:lim };
    },
    k1a: function(o){
      var g = _min(_kose(o).map(function(x){ return _aralik(x.f); })), ok = g > K1A_HZ;
      return { ok:ok, v:_ihlal(ok, (K1A_HZ - g) / K1A_HZ), deger:g, sinir:K1A_HZ };
    },
    k1b: function(o){
      var lo = K1B[0], hi = K1B[1], v = 0, n = 0;
      _kose(o).forEach(function(x){
        (x.f || []).forEach(function(f){
          if(f >= lo && f <= hi){ n++; v += (Math.min(f - lo, hi - f) + 1e-3) / ((hi - lo) / 2); }
        });
      });
      return { ok:n === 0, v:_ihlal(n === 0, v), deger:n, sinir:0 };
    },
    k2: function(o){
      var T = _max(_kose(o).map(function(x){ return x.T; })), ok = T < K2_T;
      return { ok:ok, v:_ihlal(ok, Number.isFinite(T) ? (T - K2_T) / K2_T : 1e3), deger:T, sinir:K2_T };
    },
    sehimAlt: function(o, c){
      var d = _min(_kose(o).map(_sehim)), a = c.s.sehimAlt, ok = d >= a;
      return { ok:ok, v:_ihlal(ok, (a - d) / a), deger:d, sinir:a };
    },
    sehim: function(o, c){
      var d = _max(_kose(o).map(_sehim)), u = c.s.sehimUst, ok = d <= u;
      return { ok:ok, v:_ihlal(ok, (d - u) / u), deger:d, sinir:u };
    },
    altMod: function(o, c){
      var f = _min(_kose(o).map(function(x){ return _min(x.f); })), a = c.s.altMod, ok = f >= a;
      return { ok:ok, v:_ihlal(ok, (a - f) / a), deger:f, sinir:a };
    },
    kapasite: function(o, c){
      var u = -Infinity;
      (o.pay || []).forEach(function(p, i){ var k = (o.kap || [])[i]; if(k > 0) u = Math.max(u, p / k); });
      if(u === -Infinity) return { ok:true, v:0, deger:NaN, sinir:c.s.kapasite, na:true };
      var ok = u <= c.s.kapasite;
      return { ok:ok, v:_ihlal(ok, (u - c.s.kapasite) / c.s.kapasite), deger:u, sinir:c.s.kapasite };
    },
    ayrisma: function(o, c){
      var k = o.ked;
      if(!k) return { ok:true, v:0, deger:NaN, sinir:c.s.ayrisma, na:true };
      var m = Math.min(k.bounce, k.roll), ok = m >= c.s.ayrisma;
      return { ok:ok, v:_ihlal(ok, (c.s.ayrisma - m) / c.s.ayrisma), deger:m, sinir:c.s.ayrisma };
    },
    isletme: function(o, c){
      var d = _max(_kose(o).map(function(x){ return _max(x.dIsl); })), u = c.s.isletmeUst, ok = d <= u;
      return { ok:ok, v:_ihlal(ok, (d - u) / u), deger:d, sinir:u };
    },
    durdurucu: function(o, c){
      var d = _max(_kose(o).map(function(x){ return _max(x.dSur); })), u = c.s.durdurucuUst, ok = d <= u;
      return { ok:ok, v:_ihlal(ok, (d - u) / u), deger:d, sinir:u };
    },
    cekme: function(o){
      var d = _max(_kose(o).map(function(x){ return x.cekmeMm > 0 ? x.cekmeMm : 0; })), ok = !(d > 0);
      return { ok:ok, v:_ihlal(ok, d), deger:d, sinir:0 };
    },
    darbe: function(o, c){
      var r = _max(_kose(o).map(function(x){ return x.darbeOran == null ? -Infinity : x.darbeOran; }));
      if(r === -Infinity) return { ok:true, v:0, deger:NaN, sinir:c.s.darbe, na:true };
      var ok = r <= c.s.darbe;
      return { ok:ok, v:_ihlal(ok, (r - c.s.darbe) / c.s.darbe), deger:r, sinir:c.s.darbe };
    }
  };

  // İŞLETME yük durumu: 1 g düşey ile birlikte en çok 1 g yatay ivme, tork
  // durumları dâhil (statik, fren, hızlanma, viraj, fren + viraj, tahrik torku,
  // vites durumları, 1 g yanal · boyuna). Öteki durumlar DARBE: 3,5 g düşey,
  // çukur + fren, 1,55 g bordür, geri esneme — durdurucunun işi.
  function isletmeMi(lc){
    var n = (lc && lc.n) || [];
    return n[2] === -1 && Math.abs(n[0]) <= 1 && Math.abs(n[1]) <= 1;
  }

  // Bağlam: { fAtes, s:{sınırlar}, acik:{k:bool} } — eksik ya da geçersiz alan
  // varsayılana düşer. acik.tolerans kısıt değil seçenektir.
  function baglam(c){
    c = c || {};
    var s = {}, acik = {};
    Object.keys(SINIR_VARSAYILAN).forEach(function(k){
      var v = c.s ? Number(c.s[k]) : NaN, r = SINIR_ARALIK[k];
      var gecer = r ? ((r[2] ? v > r[0] : v >= r[0]) && v <= r[1]) : v > 0;
      s[k] = (Number.isFinite(v) && gecer) ? v : SINIR_VARSAYILAN[k];
    });
    var secim = function(k){ return (c.acik && typeof c.acik[k] === 'boolean') ? c.acik[k] : !!ACIK_VARSAYILAN[k]; };
    KISITLAR.forEach(function(K){ acik[K.k] = K.zorunlu ? true : secim(K.k); });
    acik.tolerans = secim('tolerans');
    return { fAtes: Number(c.fAtes), s: s, acik: acik };
  }

  // Bir aşamanın açık kısıtları → { k: sonuç }, v toplamı ve ihlal maskesi.
  function degerlendir(o, c, asama){
    var r = { sonuc: {}, v: 0, ok: true };
    KISITLAR.forEach(function(K){
      if(K.asama !== asama || !c.acik[K.k]) return;
      var x = DEG[K.k](o, c);
      r.sonuc[K.k] = x;
      if(!x.ok){ r.ok = false; r.v += x.v; }
    });
    return r;
  }

  // ── 3) PARETO ve UZLAŞI ───────────────────────────────────────────────────
  // P: [{ T, d }] — ikisi de küçülmek ister. Eşitlik nicemlenmiş anahtarla
  // (T 1e-9, d 1e-6 mm): Σk_z aynı iki kombinasyonun T'si toplama sırasından
  // son basamakta ayrışabilir ve bu, baskın bir noktayı cepheye sokardı.
  function pareto(P){
    var out = P.map(function(){ return false; });
    var ix = [];
    P.forEach(function(p, i){ if(Number.isFinite(p.T) && Number.isFinite(p.d)) ix.push(i); });
    var qT = function(i){ return Math.round(P[i].T * 1e9); }, qd = function(i){ return Math.round(P[i].d * 1e6); };
    ix.sort(function(a, b){ return qT(a) - qT(b) || qd(a) - qd(b) || a - b; });
    var enIyi = Infinity, k = 0;
    while(k < ix.length){
      var t = qT(ix[k]), m = qd(ix[k]), son = k;
      while(son < ix.length && qT(ix[son]) === t) son++;
      if(m < enIyi) for(var j = k; j < son && qd(ix[j]) === m; j++) out[ix[j]] = true;
      enIyi = Math.min(enIyi, m);
      k = son;
    }
    return out;
  }

  // Uzlaşı uzaklığı: aralık KÜMEDEN (min–max), ağırlık w iletilebilirliğe.
  function uzlasi(P, w){
    var Tn = [Infinity, -Infinity], dn = [Infinity, -Infinity];
    P.forEach(function(p){
      Tn[0] = Math.min(Tn[0], p.T); Tn[1] = Math.max(Tn[1], p.T);
      dn[0] = Math.min(dn[0], p.d); dn[1] = Math.max(dn[1], p.d);
    });
    var nr = function(v, a){ return (a[1] - a[0]) > 0 ? (v - a[0]) / (a[1] - a[0]) : 0; };
    var olc = function(p){ var t = nr(p.T, Tn), d = nr(p.d, dn); return Math.sqrt(w * t * t + (1 - w) * d * d); };
    return { uz: P.map(olc), olc: olc, araliT: Tn, araliD: dn };
  }

  // ── 4) TARAYICI ───────────────────────────────────────────────────────────
  // P = { G, adaylar:[{key, name}], sabit:{anahtar:true}, ctx (baglam girdisi),
  //       olc1(tipler) → o | null, olc2(tipler) → o2 | null, enIyi (25) }
  // tipler: grup başına kütüphane anahtarı ya da null (sabit grup: model olduğu gibi).
  // Dönüş: { adim(n) → { bitti, asama, i, n }, sonuc() }
  function tarayici(P){
    var G = P.G || [], A = P.adaylar || [], c = baglam(P.ctx), sabit = P.sabit || {};
    var enIyi = P.enIyi > 0 ? P.enIyi : 25;
    if(!(c.fAtes > 0)) throw new Error('f_ateş yok');
    var taranan = [];
    G.forEach(function(g, i){ if(!sabit[g.anahtar]) taranan.push(i); });
    var nA = A.length, N = (taranan.length && nA) ? Math.pow(nA, taranan.length) : 0;
    var tipler = function(idx){
      var t = G.map(function(){ return null; });
      for(var k = taranan.length - 1; k >= 0; k--){ t[taranan[k]] = A[idx % nA].key; idx = Math.floor(idx / nA); }
      return t;
    };
    var K1 = KISITLAR.filter(function(K){ return K.asama === 1 && c.acik[K.k]; });
    var K2 = KISITLAR.filter(function(K){ return K.asama === 2 && c.acik[K.k]; });
    var T1 = new Float64Array(N), D1 = new Float64Array(N), V1 = new Float64Array(N);
    var M1 = new Int32Array(N);          // birinci aşama ihlal maskesi (bit = K1 sırası)
    var hata = 0, asama = 1, i = 0, ikinci = null, j = 0, R2 = {}, bitti = !N, S = null;
    var t0 = Date.now();

    function adim1(idx){
      var o = null;
      try { o = P.olc1(tipler(idx)); } catch(e){ o = null; }
      if(!o){ hata++; T1[idx] = D1[idx] = V1[idx] = NaN; M1[idx] = -1; return; }
      var r = degerlendir(o, c, 1), m = 0;
      K1.forEach(function(K, b){ if(r.sonuc[K.k] && !r.sonuc[K.k].ok) m |= (1 << b); });
      T1[idx] = o.T; D1[idx] = _sehim(o); V1[idx] = r.v; M1[idx] = m;
    }
    function ikinciListe(){
      var L = [];
      for(var k = 0; k < N; k++) if(M1[k] === 0) L.push(k);
      if(!L.length){
        for(k = 0; k < N; k++) if(M1[k] > 0) L.push(k);
        L.sort(function(a, b){ return V1[a] - V1[b] || a - b; });
        L = L.slice(0, enIyi);
      }
      return L;
    }
    function adim2(idx){
      var o = null;
      try { o = P.olc2(tipler(idx)); } catch(e){ o = null; }
      if(!o){ R2[idx] = { hata:true }; return; }
      var r = degerlendir(o, c, 2), m = 0;
      K2.forEach(function(K, b){ if(r.sonuc[K.k] && !r.sonuc[K.k].ok) m |= (1 << b); });
      R2[idx] = { v:r.v, m:m };
    }
    function kapat(){
      var ad = function(K){ return K.k; };
      // Ardışık eleme (huni) — kısıt sırası KISITLAR'ın sırası.
      var huni = [], kalan = [];
      for(var k = 0; k < N; k++) if(M1[k] >= 0) kalan.push(k);
      huni.push({ k:'cozulen', kalan:kalan.length });
      K1.forEach(function(K, b){
        kalan = kalan.filter(function(x){ return !(M1[x] & (1 << b)); });
        huni.push({ k:ad(K), kalan:kalan.length });
      });
      K2.forEach(function(K, b){
        kalan = kalan.filter(function(x){ var r = R2[x]; return r && !r.hata && !(r.m & (1 << b)); });
        huni.push({ k:ad(K), kalan:kalan.length });
      });
      // Bağımsız red sayısı — birinci aşama hepsinde, ikinci aşama koşulduğu yerde.
      var red = {};
      K1.forEach(function(K, b){ var s = 0; for(var x = 0; x < N; x++) if(M1[x] > 0 && (M1[x] & (1 << b))) s++; red[K.k] = s; });
      K2.forEach(function(K, b){ var s = 0; ikinci.forEach(function(x){ var r = R2[x]; if(r && !r.hata && (r.m & (1 << b))) s++; }); red[K.k] = s; });

      var uygun = ikinci.filter(function(x){ var r = R2[x]; return M1[x] === 0 && r && !r.hata && r.m === 0; });
      var P2 = uygun.map(function(x){ return { T:T1[x], d:D1[x] }; });
      var par = pareto(P2), U = uzlasi(P2, c.s.agirlik);
      var sira;
      if(uygun.length){
        sira = uygun.map(function(x, k){ return { idx:x, uz:U.uz[k], pareto:par[k] }; });
        sira.sort(function(a, b){ return a.uz - b.uz || T1[a.idx] - T1[b.idx] || D1[a.idx] - D1[b.idx] || a.idx - b.idx; });
      } else {
        sira = ikinci.filter(function(x){ var r = R2[x]; return r && !r.hata; })
          .map(function(x){ return { idx:x, v:V1[x] + R2[x].v, uz:NaN, pareto:false }; });
        sira.sort(function(a, b){ return a.v - b.v || T1[a.idx] - T1[b.idx] || a.idx - b.idx; });
      }
      // Grup başına tip sıklığı (uygun kümede).
      var siklik = G.map(function(){ return {}; });
      uygun.forEach(function(x){ tipler(x).forEach(function(t, g){ if(t) siklik[g][t] = (siklik[g][t] || 0) + 1; }); });
      // Dağılım (rapor çizimi): çözülen bütün kombinasyonlar en çok ~2500 noktayla,
      // uygunlar en çok ~1500 noktayla — fazlası eşit adımla seyreltilir; cephe her zaman.
      var uyg = {}, nok = [], adm = Math.max(1, Math.ceil(N / 2500)), admU = Math.max(1, Math.ceil(uygun.length / 1500));
      uygun.forEach(function(x, k){ uyg[x] = { k:k, p:par[k] }; });
      for(var x = 0; x < N; x++){
        if(M1[x] < 0) continue;
        var u = uyg[x];
        if(u ? (u.p || u.k % admU === 0) : (x % adm === 0))
          nok.push({ T:T1[x], d:D1[x], uygun:!!u, pareto:!!(u && u.p) });
      }
      S = {
        N:N, nAday:nA, taranan:taranan, hata:hata, ikinciN:ikinci.length, uygunN:uygun.length,
        huni:huni, red:red, sira:sira.slice(0, enIyi).map(function(s, k){
          return { no:k + 1, tipler:tipler(s.idx), uz:s.uz, pareto:s.pareto, v:s.v }; }),
        paretoN:par.filter(Boolean).length, nokta:nok, seyrek:adm, seyrekU:admU, siklik:siklik,
        araliT:U.araliT, araliD:U.araliD, olc:U.olc, ctx:c, sure:Date.now() - t0
      };
    }

    return {
      N: N,
      adim: function(n){
        var son = n > 0 ? n : Infinity;
        while(!bitti && son-- > 0){
          if(asama === 1){
            adim1(i++);
            if(i >= N){ asama = 2; ikinci = ikinciListe(); j = 0; }
          } else if(j < ikinci.length){
            adim2(ikinci[j++]);
          }
          if(asama === 2 && j >= ikinci.length){ kapat(); bitti = true; }
        }
        return { bitti:bitti, asama:asama, i:(asama === 1 ? i : j), n:(asama === 1 ? N : (ikinci ? ikinci.length : 0)) };
      },
      sonuc: function(){ return S; }
    };
  }

  // Bir kombinasyonun iki aşamasının bütün kısıtları (rapor satırı, mevcut tasarım).
  function hepsi(o1, o2, ctx){
    var c = baglam(ctx), a = degerlendir(o1 || {}, c, 1), b = o2 ? degerlendir(o2, c, 2) : { sonuc:{}, v:0, ok:true };
    var sonuc = {};
    Object.keys(a.sonuc).forEach(function(k){ sonuc[k] = a.sonuc[k]; });
    Object.keys(b.sonuc).forEach(function(k){ sonuc[k] = b.sonuc[k]; });
    return { sonuc:sonuc, ok:a.ok && b.ok, v:a.v + b.v };
  }

  // Kinetik enerji dağılımı (Jeong & Singh 2000): modda serbestlik j'nin payı
  // KED_j = φ_j·Σ_k M_jk·φ_k / φᵀMφ (Σ_j KED_j = 1; bağlaşık atalette bir terim
  // eksi olabilir). φ ağırlık merkezi koordinatında [x y z rx ry rz].
  function ked(phi, M6){
    var mt = 0, p = [];
    for(var a = 0; a < 6; a++){
      var s = 0;
      for(var b = 0; b < 6; b++) s += M6[a][b] * phi[b];
      p.push(phi[a] * s); mt += phi[a] * s;
    }
    return mt > 0 ? p.map(function(v){ return v / mt; }) : null;
  }

  return {
    TOL_MM: TOL_MM, MAKS_KOMB: MAKS_KOMB, KISITLAR: KISITLAR, SINIR_VARSAYILAN: SINIR_VARSAYILAN,
    ACIK_VARSAYILAN: ACIK_VARSAYILAN, SINIR_ARALIK: SINIR_ARALIK,
    K1_ORAN: K1_ORAN, K1A_HZ: K1A_HZ, K1B: K1B, K2_T: K2_T,
    yanAyir: yanAyir, gruplar: gruplar, kombinasyonSayisi: kombinasyonSayisi,
    baglam: baglam, degerlendir: degerlendir, hepsi: hepsi, isletmeMi: isletmeMi,
    pareto: pareto, uzlasi: uzlasi, tarayici: tarayici, ked: ked
  };
})();

if(typeof module !== 'undefined' && module.exports){ module.exports = veMntKatalog; }
