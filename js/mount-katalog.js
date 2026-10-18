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
      // Ad tek boşlukla: ekran art arda boşluğu birleştirir, ipucu (title) birleştirmez
      // (ASFAT: "Ön Sol   · 57RS313774").
      var ad = (uy.length === 1 ? String(T[i].name == null ? '' : T[i].name)
        : adla[i] ? ciftAdi(ay[i]) : T[uy[0]].name + ' + ' + T[uy[1]].name).replace(/\s+/g, ' ').trim();
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
  // Her kısıt İKİ ADIMDIR: ÖLÇÜ (OLCU — köşelerin kötüsü, sınırdan bağımsız)
  // ve HÜKÜM (HUKUM — ölçü ↔ sınır). Tarama ölçüyü kombinasyon başına saklar
  // (tarayıcının deposu); sınır, açıklık ve ağırlık değişince yalnız hüküm
  // yeniden kurulur — tarama yinelenmez (pencerenin canlı değerlendirmesi).
  // Hüküm { ok, v, deger, sinir, na } döner: v ≥ 0 normalleştirilmiş ihlal
  // (0 = sağlanıyor), en az ihlalli sıralamada toplanır. na: veri yok — kısıt
  // değerlendirilmedi (kütüphane girdisinde kapasite yoksa E4 · E9); ölçüsü NaN.
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
  // ÖLÇÜ — köşelerin kötüsü: üst sınırlı büyüklükte en büyük, alt sınırlıda en
  // küçük; bant ve aralık her köşede. NaN: veri yok.
  var OLCU = {
    k1: function(o){ return _max(_kose(o).map(function(x){ return _max(x.f); })); },
    k1a: function(o){ return _min(_kose(o).map(function(x){ return _aralik(x.f); })); },
    // Bant içindeki modların derinliği: Σ (uca uzaklık + 10⁻³) / yarım bant;
    // 0 = bantta mod yok (bant ucundaki mod da > 0 — iki uç dâhil).
    k1b: function(o){
      var lo = K1B[0], hi = K1B[1], v = 0;
      _kose(o).forEach(function(x){
        (x.f || []).forEach(function(f){
          if(f >= lo && f <= hi) v += (Math.min(f - lo, hi - f) + 1e-3) / ((hi - lo) / 2);
        });
      });
      return v;
    },
    k2: function(o){ return _max(_kose(o).map(function(x){ return x.T; })); },
    sehimAlt: function(o){ return _min(_kose(o).map(_sehim)); },
    sehim: function(o){ return _max(_kose(o).map(_sehim)); },
    altMod: function(o){ return _min(_kose(o).map(function(x){ return _min(x.f); })); },
    kapasite: function(o){
      var u = -Infinity;
      (o.pay || []).forEach(function(p, i){ var k = (o.kap || [])[i]; if(k > 0) u = Math.max(u, p / k); });
      return u === -Infinity ? NaN : u;
    },
    ayrisma: function(o){ return o.ked ? Math.min(o.ked.bounce, o.ked.roll) : NaN; },
    isletme: function(o){ return _max(_kose(o).map(function(x){ return _max(x.dIsl); })); },
    durdurucu: function(o){ return _max(_kose(o).map(function(x){ return _max(x.dSur); })); },
    cekme: function(o){ return _max(_kose(o).map(function(x){ return x.cekmeMm > 0 ? x.cekmeMm : 0; })); },
    darbe: function(o){
      var r = _max(_kose(o).map(function(x){ return x.darbeOran == null ? -Infinity : x.darbeOran; }));
      return r === -Infinity ? NaN : r;
    }
  };
  // HÜKÜM — ölçü ↔ sınır. Kesin kriterlerin sınırı sabit (Kriter 1'inki f_ateş'ten).
  function _h(ok, v, x, s){ return { ok:ok, v:_ihlal(ok, v), deger:x, sinir:s }; }
  function _na(s){ return { ok:true, v:0, deger:NaN, sinir:s, na:true }; }
  function _ust(x, u){ return _h(x <= u, (x - u) / u, x, u); }
  function _alt(x, a){ return _h(x >= a, (a - x) / a, x, a); }
  var HUKUM = {
    k1: function(x, c){ var lim = K1_ORAN * c.fAtes; return _h(x < lim, (x - lim) / lim, x, lim); },
    k1a: function(x){ return _h(x > K1A_HZ, (K1A_HZ - x) / K1A_HZ, x, K1A_HZ); },
    k1b: function(x){ return _h(!(x > 0), x, x, 0); },
    k2: function(x){ return _h(x < K2_T, Number.isFinite(x) ? (x - K2_T) / K2_T : 1e3, x, K2_T); },
    sehimAlt: function(x, c){ return _alt(x, c.s.sehimAlt); },
    sehim: function(x, c){ return _ust(x, c.s.sehimUst); },
    altMod: function(x, c){ return _alt(x, c.s.altMod); },
    kapasite: function(x, c){ return x !== x ? _na(c.s.kapasite) : _ust(x, c.s.kapasite); },
    ayrisma: function(x, c){ return x !== x ? _na(c.s.ayrisma) : _alt(x, c.s.ayrisma); },
    isletme: function(x, c){ return _ust(x, c.s.isletmeUst); },
    durdurucu: function(x, c){ return _ust(x, c.s.durdurucuUst); },
    cekme: function(x){ return _h(!(x > 0), x, x, 0); },
    darbe: function(x, c){ return x !== x ? _na(c.s.darbe) : _ust(x, c.s.darbe); }
  };
  function olcu(k, o){ return OLCU[k](o || {}); }
  function hukum(k, x, c){ return HUKUM[k](x, c); }
  // Sınırı değişen ek kısıtın yönü ve sınır anahtarı (sınır duyarlılığı).
  var YON = { sehimAlt:['alt', 'sehimAlt'], sehim:['ust', 'sehimUst'], altMod:['alt', 'altMod'],
              kapasite:['ust', 'kapasite'], ayrisma:['alt', 'ayrisma'], isletme:['ust', 'isletmeUst'],
              durdurucu:['ust', 'durdurucuUst'], darbe:['ust', 'darbe'] };

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
      var x = hukum(K.k, OLCU[K.k](o), c);
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

  // ── 4) TARAYICI ve DEPO ────────────────────────────────────────────────────
  // P = { G, adaylar:[{key, name}], sabit:{anahtar:true}, ctx (baglam girdisi),
  //       olc1(tipler) → o | null, olc2(tipler) → o2 | null, enIyi (25), tam }
  // tipler: grup başına kütüphane anahtarı ya da null (sabit grup: model olduğu gibi).
  // Dönüş: { N, adim(n) → { bitti, asama, i, n }, sonuc() → S, depo() → D }
  //
  // DEPO (D): kombinasyon başına anma T, δ_s, en küçük ve en büyük mod ve
  // BÜTÜN kısıtların ölçüsü (açık ya da kapalı). Kombinasyon numarası taranan
  // grupların aday sıralarıdır, ilk taranan grup en anlamlı basamak.
  // TAM (seçenek): ikinci aşama çözülen bütün kombinasyonlarda koşar — sınır
  // değişince (ozet(D, c)) birinci aşamayı yeni geçen kombinasyonun da ikinci
  // aşama ölçüsü hazırdır. Tam olmayan tarama ikinci aşamayı yalnız birinci
  // aşamayı geçenlerde (yoksa en az ihlalli `enIyi` kombinasyonda) koşar;
  // ikisinin özeti AYNIDIR (kapı: mount-katalog.test.js → TAM).
  function depo(G, A, taranan, N, tam, enIyi){
    var nA = A.length, D = {
      N: N, nA: nA, taranan: taranan, adaylar: A, tam: tam, enIyi: enIyi, sure: 0,
      T: new Float64Array(N), d: new Float64Array(N), fMin: new Float64Array(N), fMax: new Float64Array(N),
      d1: new Int8Array(N),       // 1 çözüldü · 0 çözülemedi
      d2: new Int8Array(N),       // 1 ölçüldü · 0 koşmadı · −1 çözülemedi
      X: {}
    };
    KISITLAR.forEach(function(K){ D.X[K.k] = new Float64Array(N).fill(NaN); });
    D.kod = function(idx){
      var k = [];
      for(var j = taranan.length - 1; j >= 0; j--){ k[j] = idx % nA; idx = Math.floor(idx / nA); }
      return k;
    };
    D.indeks = function(kod){ var idx = 0; for(var j = 0; j < taranan.length; j++) idx = idx * nA + kod[j]; return idx; };
    D.tipler = function(idx){
      var t = G.map(function(){ return null; }), k = D.kod(idx);
      taranan.forEach(function(g, j){ t[g] = A[k[j]].key; });
      return t;
    };
    return D;
  }

  // Açık kısıtların hükmü, kombinasyon başına: m (bit b = KISITLAR[b] ihlal),
  // v1 · v2 (aşama başına ihlal toplamı, KISITLAR sırasıyla). Çözülemeyen
  // kombinasyonda m = 0 ve v NaN; ikinci aşaması ölçülmemişte o aşamanın biti yok.
  function hukumler(D, c){
    var N = D.N, m = new Uint32Array(N), v1 = new Float64Array(N), v2 = new Float64Array(N), L = [];
    KISITLAR.forEach(function(K, b){ if(c.acik[K.k]) L.push({ k:K.k, a:K.asama, bit:(1 << b) >>> 0, X:D.X[K.k] }); });
    for(var x = 0; x < N; x++){
      if(D.d1[x] !== 1){ v1[x] = v2[x] = NaN; continue; }
      var b = 0, s1 = 0, s2 = 0, iki = D.d2[x] === 1;
      for(var j = 0; j < L.length; j++){
        var q = L[j];
        if(q.a === 2 && !iki) continue;
        var h = HUKUM[q.k](q.X[x], c);
        if(!h.ok){ b |= q.bit; if(q.a === 1) s1 += h.v; else s2 += h.v; }
      }
      m[x] = b >>> 0; v1[x] = s1; v2[x] = iki ? s2 : NaN;
    }
    return { m:m, v1:v1, v2:v2 };
  }
  function _bitler(c){
    var B = { b1:0, b2:0, K1:[], K2:[] };
    KISITLAR.forEach(function(K, b){
      if(!c.acik[K.k]) return;
      var bit = (1 << b) >>> 0;
      if(K.asama === 1){ B.K1.push([K, bit]); B.b1 |= bit; } else { B.K2.push([K, bit]); B.b2 |= bit; }
    });
    return B;
  }
  // İkinci aşamanın kombinasyonları: birinci aşamayı geçenler; hiçbiri geçmezse
  // en az ihlalli `enIyi` kombinasyon.
  function _ikinci(D, H, b1){
    var L = [], x;
    for(x = 0; x < D.N; x++) if(D.d1[x] === 1 && !(H.m[x] & b1)) L.push(x);
    if(!L.length){
      for(x = 0; x < D.N; x++) if(D.d1[x] === 1 && (H.m[x] & b1)) L.push(x);
      L.sort(function(a, b){ return H.v1[a] - H.v1[b] || a - b; });
      L = L.slice(0, D.enIyi);
    }
    return L;
  }

  // ÖZET (S) — huni, bağımsız red, uygun küme, Pareto, uzlaşı sırası, tip
  // sıklığı ve dağılım. Tarama sonunda ve sınır değişince AYNI işlevden.
  function ozet(D, c, H){
    H = H || hukumler(D, c);
    var N = D.N, B = _bitler(c), ikinci = _ikinci(D, H, B.b1), x;
    ikinci.forEach(function(x){ if(D.d2[x] === 0) throw new Error('ikinci aşama ölçülmedi'); });
    var iki = function(x){ return D.d2[x] === 1; };
    // Ardışık eleme (huni) — kısıt sırası KISITLAR'ın sırası.
    var huni = [], kalan = [];
    for(x = 0; x < N; x++) if(D.d1[x] === 1) kalan.push(x);
    huni.push({ k:'cozulen', kalan:kalan.length });
    B.K1.forEach(function(p){
      kalan = kalan.filter(function(x){ return !(H.m[x] & p[1]); });
      huni.push({ k:p[0].k, kalan:kalan.length });
    });
    B.K2.forEach(function(p){
      kalan = kalan.filter(function(x){ return iki(x) && !(H.m[x] & p[1]); });
      huni.push({ k:p[0].k, kalan:kalan.length });
    });
    // Bağımsız red sayısı — aşamanın ölçüldüğü bütün kombinasyonlarda (tam
    // taramada ikinci aşama da çözülen her kombinasyonda).
    var red = _red(D, H, B);

    var uygun = ikinci.filter(function(x){ return !(H.m[x] & B.b1) && iki(x) && !(H.m[x] & B.b2); });
    var P2 = uygun.map(function(x){ return { T:D.T[x], d:D.d[x] }; });
    var par = pareto(P2), U = uzlasi(P2, c.s.agirlik);
    var cephe = uygun.filter(function(x, k){ return par[k]; });
    cephe.sort(function(a, b){ return D.T[a] - D.T[b] || D.d[a] - D.d[b] || a - b; });
    var sira;
    if(uygun.length){
      sira = uygun.map(function(x, k){ return { idx:x, uz:U.uz[k], pareto:par[k] }; });
      sira.sort(function(a, b){ return a.uz - b.uz || D.T[a.idx] - D.T[b.idx] || D.d[a.idx] - D.d[b.idx] || a.idx - b.idx; });
    } else {
      sira = ikinci.filter(iki).map(function(x){ return { idx:x, v:H.v1[x] + H.v2[x], uz:NaN, pareto:false }; });
      sira.sort(function(a, b){ return a.v - b.v || D.T[a.idx] - D.T[b.idx] || a.idx - b.idx; });
    }
    // Grup başına tip sıklığı (uygun kümede).
    var siklik = (D.G || []).map(function(){ return {}; });
    uygun.forEach(function(x){ D.tipler(x).forEach(function(t, g){ if(t) siklik[g][t] = (siklik[g][t] || 0) + 1; }); });
    // Dağılım (rapor çizimi): çözülen bütün kombinasyonlar en çok ~2500 noktayla,
    // uygunlar en çok ~1500 noktayla — fazlası eşit adımla seyreltilir; cephe her zaman.
    var uyg = {}, nok = [], adm = Math.max(1, Math.ceil(N / 2500)), admU = Math.max(1, Math.ceil(uygun.length / 1500));
    uygun.forEach(function(x, k){ uyg[x] = { k:k, p:par[k] }; });
    for(x = 0; x < N; x++){
      if(D.d1[x] !== 1) continue;
      var u = uyg[x];
      if(u ? (u.p || u.k % admU === 0) : (x % adm === 0))
        nok.push({ T:D.T[x], d:D.d[x], uygun:!!u, pareto:!!(u && u.p) });
    }
    var hata = 0;
    for(x = 0; x < N; x++) if(D.d1[x] !== 1) hata++;
    return {
      N:N, nAday:D.nA, taranan:D.taranan, hata:hata, ikinciN:ikinci.length, uygunN:uygun.length,
      huni:huni, red:red, sira:sira.slice(0, D.enIyi).map(function(s, k){
        return { no:k + 1, idx:s.idx, tipler:D.tipler(s.idx), uz:s.uz, pareto:s.pareto, v:s.v }; }),
      paretoN:cephe.length, cephe:cephe, nokta:nok, seyrek:adm, seyrekU:admU, siklik:siklik,
      araliT:U.araliT, araliD:U.araliD, olc:U.olc, ctx:c, sure:D.sure, tam:D.tam
    };
  }
  function _red(D, H, B){
    var red = {};
    B.K1.concat(B.K2).forEach(function(p){
      var s = 0, a = p[0].asama;
      for(var x = 0; x < D.N; x++) if((a === 1 ? D.d1[x] === 1 : D.d2[x] === 1) && (H.m[x] & p[1])) s++;
      red[p[0].k] = s;
    });
    return red;
  }

  function tarayici(P){
    var G = P.G || [], A = P.adaylar || [], c = baglam(P.ctx), sabit = P.sabit || {};
    var enIyi = P.enIyi > 0 ? P.enIyi : 25;
    if(!(c.fAtes > 0)) throw new Error('f_ateş yok');
    var taranan = [];
    G.forEach(function(g, i){ if(!sabit[g.anahtar]) taranan.push(i); });
    var nA = A.length, N = (taranan.length && nA) ? Math.pow(nA, taranan.length) : 0;
    var D = depo(G, A, taranan, N, !!P.tam, enIyi);
    D.G = G; D.c = c;
    var K1 = KISITLAR.filter(function(K){ return K.asama === 1; });
    var K2 = KISITLAR.filter(function(K){ return K.asama === 2; });
    var asama = 1, i = 0, liste = null, j = 0, bitti = !N, S = null;
    var t0 = Date.now();

    function adim1(idx){
      var o = null;
      try { o = P.olc1(D.tipler(idx)); } catch(e){ o = null; }
      if(!o){ D.T[idx] = D.d[idx] = D.fMin[idx] = D.fMax[idx] = NaN; return; }
      D.d1[idx] = 1;
      D.T[idx] = o.T; D.d[idx] = _sehim(o); D.fMin[idx] = _min(o.f); D.fMax[idx] = _max(o.f);
      K1.forEach(function(K){ D.X[K.k][idx] = OLCU[K.k](o); });
    }
    function adim2(idx){
      var o = null;
      try { o = P.olc2(D.tipler(idx)); } catch(e){ o = null; }
      if(!o){ D.d2[idx] = -1; return; }
      D.d2[idx] = 1;
      K2.forEach(function(K){ D.X[K.k][idx] = OLCU[K.k](o); });
    }
    function ikinciListe(){
      if(!D.tam) return _ikinci(D, hukumler(D, c), _bitler(c).b1);
      var L = [];
      for(var x = 0; x < N; x++) if(D.d1[x] === 1) L.push(x);
      return L;
    }

    return {
      N: N,
      adim: function(n){
        var son = n > 0 ? n : Infinity;
        while(!bitti && son-- > 0){
          if(asama === 1){
            adim1(i++);
            if(i >= N){ asama = 2; liste = ikinciListe(); j = 0; }
          } else if(j < liste.length){
            adim2(liste[j++]);
          }
          if(asama === 2 && j >= liste.length){ D.sure = Date.now() - t0; S = ozet(D, c); bitti = true; }
        }
        return { bitti:bitti, asama:asama, i:(asama === 1 ? i : j), n:(asama === 1 ? N : (liste ? liste.length : 0)) };
      },
      sonuc: function(){ return S; },
      depo: function(){ return bitti ? D : null; }
    };
  }

  // UYGUN: çözülmüş, ikinci aşaması ölçülmüş ve bütün açık kısıtları sağlayan
  // kombinasyon. Tam depoda bu küme özetin uygun kümesinin AYNISIDIR (birinci
  // aşamayı geçen varsa hepsi ikinci aşamada; yoksa ikisi de boş).
  function _uygunMu(D, H, x){ return D.d1[x] === 1 && D.d2[x] === 1 && H.m[x] === 0; }

  // BAĞLAYICI KISITLAR — açık kısıt başına bağımsız ihlal (`red`, özetinkinin
  // aynısı) ve TEK ENGEL olduğu kombinasyon sayısı (`tek`: öteki bütün açık
  // kısıtları sağlıyor, yalnız bu kısıtı ihlal ediyor — kısıt gevşese uygun
  // olacak kombinasyonlar; iki aşaması da ölçülmüş kombinasyonlarda, tam depo).
  function baglayici(D, c, H){
    H = H || hukumler(D, c);
    var B = _bitler(c), red = _red(D, H, B), L = [], n = 0, uygun = 0;
    B.K1.concat(B.K2).forEach(function(p){ L.push({ k:p[0].k, bit:p[1], tek:0 }); });
    for(var x = 0; x < D.N; x++){
      if(D.d1[x] !== 1 || D.d2[x] !== 1) continue;
      n++;
      var m = H.m[x];
      if(!m){ uygun++; continue; }
      L.forEach(function(q){ if(m === q.bit) q.tek++; });
    }
    L.sort(function(a, b){ return _sira(a.k) - _sira(b.k); });
    return { n:n, uygun:uygun, kisit:L.map(function(q){ return { k:q.k, red:red[q.k], tek:q.tek }; }) };
  }
  function _sira(k){ for(var i = 0; i < KISITLAR.length; i++) if(KISITLAR[i].k === k) return i; return -1; }

  // SINIR DUYARLILIĞI — ek kısıt k'nin sınırı L olsaydı uygun kombinasyon
  // sayısı; öteki açık kısıtlar bugünkü sınırında. Dönüş: { k, yon, sinir,
  // deger (artan ölçüler), na (veri yok — her sınırda sağlar), sayi(L) }.
  // sayi(bugünkü sınır) k açıksa uygun sayısının aynısıdır.
  function duyarlilik(D, c, k, H){
    var Y = YON[k];
    if(!Y) return null;
    H = H || hukumler(D, c);
    var b = KISITLAR.map(function(K){ return K.k; }).indexOf(k), bit = (1 << b) >>> 0, X = D.X[k], v = [], na = 0;
    for(var x = 0; x < D.N; x++){
      if(D.d1[x] !== 1 || D.d2[x] !== 1 || (H.m[x] & ~bit)) continue;
      if(X[x] !== X[x]) na++; else v.push(X[x]);
    }
    v.sort(function(p, q){ return p - q; });
    var ilk = function(f){ var lo = 0, hi = v.length; while(lo < hi){ var m = (lo + hi) >> 1; if(f(v[m])) hi = m; else lo = m + 1; } return lo; };
    return {
      k:k, yon:Y[0], sinir:c.s[Y[1]], deger:v, na:na,
      sayi: function(L){
        return na + (Y[0] === 'ust' ? ilk(function(a){ return a > L; }) : v.length - ilk(function(a){ return a >= L; }));
      }
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
    pareto: pareto, uzlasi: uzlasi, tarayici: tarayici, ked: ked,
    olcu: olcu, hukum: hukum, hukumler: hukumler, ozet: ozet, baglayici: baglayici, duyarlilik: duyarlilik,
    uygunMu: _uygunMu
  };
})();

if(typeof module !== 'undefined' && module.exports){ module.exports = veMntKatalog; }
