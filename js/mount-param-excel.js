// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ — PARAMETRİK ANALİZ · EXCEL ÇIKTISI (DOM'suz kurucu)
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı kararı (2026-11-09): "Bu konfigürasyon bizim programımızın temel
// konfigürasyonu olacak … Kullanıcı bu Excel formatında çıktı alacak." Düzen
// Canlı Not'ta kullanıcıyla 19 notta kuruldu (10 Ton TTA, R12); bu dosya o
// düzeni taramanın verisinden KURAR, hesaplamaz:
//   Özet  — başlık; "Tarama →"; konfigürasyon başına satır: K · Sonuç (Sonuç'taki
//           bloğuna bağlı) · grupların tipi · Uygunluk (TEK renkli sütun: en uygun koyu
//           yeşil, öteki uygunlar sırayla açılan yeşil, uygun olmayan renksiz) · statik
//           sehim · dört kesin kriter · frekans payı · TR · en düşük mod. Kriterin tanımı
//           başlığın NOTUNDA (fare üstüne gelince).
//   Tarama — çözülen kombinasyonlar: No ve grupların tipi MAVİ BAĞLANTI (kullanıcı
//           2026-11-10: "o konfigürasyon yazılarının üstüne tıkladığında, o konfigürasyonun
//           sonucuna gitsin"), modlar, f_b, TR, statik sehim, dört kriter (✓/✗), frekans
//           payı, grup başına statik ve azami yük, kapasite; "← Özet".
//   Sonuç — bütün konfigürasyonların bloğu: Özet'in K0…Kn'si, sonra Tarama'nın her
//           satırı (yük durumu × takoz × X/Y/Z, modlar, TR; Özet/Tarama · geri · ileri).
//           Sekmeden açılınca boş (kullanıcı 2026-11-10: "Sonuç kısmı Excel açıldığında boş
//           gelsin"); bağlantı bloğu açar, bloklar arasındaki yüksek boş satırlar ekranda
//           yalnız o konfigürasyonu bırakır. Excel makrosuz bir tıkı başka sayfaya değer
//           olarak taşıyamaz: her konfigürasyonun sonucu dosyada hazır yazılı.
// Sekmeler görünür: Özet · Tarama · Sonuç (kullanıcı 2026-11-10).
// Her sayfada ızgara kapalı, kullanılmayan satır ve sütun gizli, sütun
// genişliği içeriğe göre (Calibri ölçüsü: aşağıdaki tablo). Takoz adındaki
// "ASR…" kaynak eki yazılmaz (kullanıcı 2026-11-09).
//
// Girdi E (cp-mount-param-sonuc.js → veMntParamExcel kurar):
//   { baslik, fAtes, rolanti, silindir, zeta, kutle,
//     gruplar:[ad], takozlar:[{ ad, grup }],
//     konfig:[{ K, mevcut, tipler:[grup başına ad], uygunluk, kriter:[4 × bool],
//               d (statik sehim, mm), f:[Hz], T, takozTip:[takoz başına ad],
//               vakalar:[{ ad, d:[[x,y,z] mm] }], modlar:[{ f, ad }] }],
//     tarama:{ N, gruplar:[grup sırası], adaylar:[[taranan grubun aday adları]],
//               satirlar:[{ tipler:[ad], f:[Hz], fB, T, d, k:[4 × bool], yuk:[kg], azami:[kg|null] }],
//               veri:{ vakaAdlari:[ad], nT, nM, kod:Int32Array, modF:Float64Array,
//                      modAd:Uint16Array, modAdlar:[ad] } } }
//   veri.kod[((i·nV + q)·nT + m)·3 + a]: i. satır, q. yük durumu, m. takoz, a. eksen;
//   mm'nin yüzde biri (BOS: sonuç yok). modF/modAd[i·nM + j]: frekansa göre sıralı.
// Çıktı: js/xlsx-yaz.js'in kitap modeli.
// ═══════════════════════════════════════════════════════════════════════════

var veMntParamExcel = (function(){
  'use strict';

  var _sayi = (typeof veSayi === 'function') ? veSayi
    : (typeof require === 'function' ? require('./sayi.js').veSayi : null);
  function tr(x, d){ return _sayi ? _sayi(x, d) : String(x); }
  // yönlendirme yuvası (js/yon.js): tarayıcıda genel işlev, Node'da modül
  var veYon = (typeof globalThis !== 'undefined' && typeof globalThis.veYon === 'function') ? globalThis.veYon
    : (typeof require === 'function' ? require('./yon.js').veYon : function(s){ return s; });

  // ── yazı ölçüsü: Calibri 11 pt (14,67 px), Carlito'dan ölçüldü — px × 10 ──
  var KAR = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ğüşıöçĞÜŞİÖÇâÂ–—·±√ζ²←→✓✗×≤≥…';
  var GEN = [33,48,59,73,74,105,100,32,44,44,73,73,37,45,37,57,74,74,74,74,74,74,74,74,74,74,39,39,73,73,73,68,131,85,80,78,90,72,67,92,91,37,47,76,62,125,95,97,76,99,80,67,71,94,83,130,76,71,69,45,57,45,73,73,43,70,77,62,77,73,45,69,77,34,35,67,34,117,77,77,77,77,51,57,49,77,66,105,63,66,58,46,68,46,73,69,77,57,34,77,62,92,94,67,37,97,78,70,85,73,133,37,73,73,51,49,133,133,74,74,73,73,73,101];
  var GEN_B = [33,48,64,73,74,107,103,34,46,46,73,73,38,45,39,63,74,74,74,74,74,74,74,74,74,74,40,40,73,73,73,68,132,89,82,78,92,72,67,93,92,39,49,80,62,128,97,99,78,101,82,69,72,96,87,133,81,76,70,48,63,48,73,73,44,72,79,61,79,74,46,70,79,36,38,70,36,119,79,79,79,79,52,58,51,79,69,109,67,69,58,50,70,50,73,70,79,58,36,79,61,93,96,69,39,99,78,72,89,73,133,39,73,73,53,50,133,133,74,74,73,73,73,104];
  function px(s, kalin){
    var t = 0, L = kalin ? GEN_B : GEN;
    for(var ch of String(s)){ var i = KAR.indexOf(ch); t += i < 0 ? (kalin ? 83 : 80) : L[i]; }
    return t / 10;
  }
  var PAY = 11, TEK_SATIR = 90;
  function birim(p){ return Math.max(4, Math.ceil((p + PAY) / 7 * 2) / 2); }
  function satirSay(metin, kalin, genPx){
    var n = 1, s = '';
    String(metin).split(/\s+/).forEach(function(w){
      if(!w) return;
      var a = s ? s + ' ' + w : w;
      if(px(a, kalin) <= genPx || !s) s = a; else { n++; s = w; }
    });
    return n;
  }

  // ── adlar ────────────────────────────────────────────────────────────────
  // "ASR…" kaynak eki yazılmaz; " · tip" eki grubun ve takozun adından düşer.
  function temiz(ad){ return String(ad == null ? '' : ad).replace(/\s*\(ASR[^)]*\)/g, '').trim(); }
  function kok(ad){ return temiz(String(ad == null ? '' : ad).split(' · ')[0]); }
  // Sayfa adı için kısa tip: katalog numarası düşer, sertlik tireyle bitişik
  // ("Cone 39 50 ShA (AMC 137982)" → "Cone39-50", "57RS313773 (A26)" → "57RS313773 A26").
  function kisa(ad){
    var s = temiz(ad), m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(s), ek = '';
    if(m){ s = m[1]; if(m[2].length <= 5) ek = m[2]; }
    s = s.replace(/\s*ShA\b/g, '').trim();
    var aile = /^([A-Za-z]+)-[\d-]+(\s+\d+)?$/.exec(s);
    if(aile) s = aile[1] + (aile[2] || '');
    var h = /^(.*\S)\s+(\d+)$/.exec(s);
    if(h) s = h[1].replace(/\s+/g, '') + '-' + h[2];
    return (s + (ek ? ' ' + ek : '')).trim();
  }
  // Konfigürasyonun Özet'teki adı (Sonuç'taki blokuna bağlı): K + grupların kısa tipi.
  function sayfaAdi(k, tipler){
    if(k.mevcut) return 'K' + k.K + ' Mevcut';
    var s = 'K' + k.K, ek = tipler.map(kisa).filter(Boolean).join(' + ');
    return ek ? s + ' ' + ek : s;
  }
  function modAdi(l){
    return String(l == null ? '' : l).split('+').map(function(p){
      p = p.trim(); return p ? p.charAt(0).toLocaleUpperCase('tr') + p.slice(1) : p;
    }).join(' + ');
  }

  // ── stiller ──────────────────────────────────────────────────────────────
  var BASLIK = { b:true, boy:14, yatay:'left', dikey:'center' };
  var ETIKET = { yatay:'left', dikey:'center' };
  var BAS = { b:true, kenar:true, yatay:'center', dikey:'center', sar:true };
  var BAS1 = { b:true, kenar:true, yatay:'center', dikey:'center' };
  var HUC = { kenar:true, yatay:'center', dikey:'center' };
  var SOL = { kenar:true, yatay:'left', dikey:'center' };
  function sayiStil(f){ return { kenar:true, yatay:'center', dikey:'center', bicim:f }; }
  function bagStil(kalin, sol){ return { kenar:true, yatay:sol ? 'left' : 'center', dikey:'center', renk:'0563C1', alt:true, b:!!kalin }; }
  var DUGME = { b:true, kenar:true, yatay:'center', dikey:'center', renk:'1F1F1F', dolgu:'EDEDED' };
  // Uygunluk: en uygun koyu yeşil (beyaz yazı); öteki uygunlar sırayla açılan yeşil.
  var KOYU = '1F7A3D', ACIK = ['6BC782', '7BCD90', '8CD39E', '9CDAAC', 'ADE0B9', 'BDE6C7', 'CDECD5', 'DEF2E3'];

  function goster(v, f){
    if(v && typeof v === 'object') v = v.olc != null ? v.olc : v.v;
    if(typeof v !== 'number') return String(v == null ? '' : v);
    var d = (f && f.indexOf('.') >= 0) ? f.split('.')[1].length : 0;
    return tr(v, d);
  }

  // Sütun genişliği ve sarılı satırın yüksekliği hücrelerden: kenarlıksız
  // hücre (başlık, etiket) ve birleşik hücrenin içi ölçüye girmez — onlar
  // komşu boş hücreye taşabilir; birleşik hücrenin yazısı sütunlarına dağılır.
  // Ölçü parça parça birikir (Tarama'nın satırları adım adım eklenir): olcBasla →
  // olcEkle(hücrelerin bir aralığı) … → olcBitir; olc(S) üçünün tek seferi.
  function olcBasla(S){
    var kapali = null;
    (S.birlesik || []).forEach(function(b){
      var a = aralik(b);
      kapali = kapali || {};
      for(var r = a.r1; r <= a.r2; r++) for(var c = a.c1; c <= a.c2; c++) kapali[r + ',' + c] = a;
    });
    return { S:S, kapali:kapali, gerek:{}, sarili:[] };
  }
  function olcEkle(o, H, i0, i1){
    for(var i = i0; i < i1; i++){
      var h = H[i], st = h[3] || {};
      if(!st.kenar || (o.kapali && o.kapali[h[0] + ',' + h[1]]) || h[2] === '' || h[2] == null) continue;
      var t = goster(h[2], st.bicim), p;
      if(t === '') continue;
      if(st.sar){
        var uzun = 0; t.split(/\s+/).forEach(function(w){ uzun = Math.max(uzun, px(w, st.b)); });
        var top = px(t, st.b);
        p = Math.max(uzun, Math.min(top, Math.max(top / 3, TEK_SATIR)));
        o.sarili.push(h);
      } else p = px(t, st.b);
      o.gerek[h[1]] = Math.max(o.gerek[h[1]] || 0, p);
    }
  }
  function olcBitir(o){
    var S = o.S, gerek = o.gerek, sutun = {};
    Object.keys(gerek).forEach(function(c){ sutun[c] = birim(gerek[c]); });
    (S.birlesik || []).forEach(function(b){
      var a = aralik(b), h = null;
      S.hucre.forEach(function(x){ if(x[0] === a.r1 && x[1] === a.c1) h = x; });
      if(!h || h[2] === '' || h[2] == null) return;
      var p = px(goster(h[2], (h[3] || {}).bicim), (h[3] || {}).b), n = a.c2 - a.c1 + 1, var_ = 0;
      if(!p) return;
      for(var c = a.c1; c <= a.c2; c++) var_ += sutun[c] || 8.43;
      var eksik = (p + PAY - 5 * n) / 7 - var_;
      if(eksik > 0) for(c = a.c1; c <= a.c2; c++) sutun[c] = Math.ceil(((sutun[c] || 8.43) + eksik / n) * 2) / 2;
    });
    var satir = {};
    o.sarili.forEach(function(h){
      var w = (sutun[h[1]] || 8.43) * 7 + 5 - 8;
      satir[h[0]] = Math.max(satir[h[0]] || 15, satirSay(goster(h[2]), (h[3] || {}).b, w) * 15 + 4);
    });
    return { sutun:sutun, satir:satir };
  }
  function olc(S){
    var o = olcBasla(S);
    olcEkle(o, S.hucre || [], 0, (S.hucre || []).length);
    return olcBitir(o);
  }
  function harf(c){ var s = ''; while(c > 0){ var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
  function sutunNo(h){ var n = 0; for(var i = 0; i < h.length; i++) n = n * 26 + (h.charCodeAt(i) - 64); return n; }
  function aralik(b){
    var m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(b);
    return { c1:sutunNo(m[1]), r1:+m[2], c2:sutunNo(m[3]), r2:+m[4] };
  }
  function birles(S, r, c1, c2){ if(c2 > c1) S.birlesik.push(harf(c1) + r + ':' + harf(c2) + r); }

  // ── frekans payı ve kapasite ─────────────────────────────────────────────
  // Payı: Kriter 1 · 1a · 1b'den sınırına en yakının uzaklığı (eksi: sağlanmıyor).
  function frekansPayi(f, fAtes){
    var s = (f || []).filter(Number.isFinite).slice().sort(function(a, b){ return a - b; });
    if(!s.length) return NaN;
    var p = fAtes / 2 - s[s.length - 1];
    for(var i = 1; i < s.length; i++) p = Math.min(p, s[i] - s[i - 1] - 0.5);
    s.forEach(function(v){ p = Math.min(p, v < 8 ? 8 - v : v > 10 ? v - 10 : -Math.min(v - 8, 10 - v)); });
    return p;
  }
  function kapasite(yuk, azami){
    var bilinen = 0, asar = false;
    (azami || []).forEach(function(a, i){ if(a > 0){ bilinen++; if(yuk[i] > a) asar = true; } });
    if(!bilinen) return 'Katalogda yok';
    if(asar) return 'Aşıyor';
    return bilinen < azami.length ? 'Bilinen yeter' : 'Yeter';
  }

  // ── notlar (başlığın üstüne gelince) ─────────────────────────────────────
  function notlar(E){
    var y = E.fAtes / 2;
    return {
      uygunluk: 'En uygun: dört kesin kriteri sağlayanlar arasında statik sehimi en küçük olan.\n'
        + 'Uygun: dört kesin kriter sağlanıyor.\n'
        + 'Uygun değil: dört kesin kriterden en az biri sağlanmıyor.\n'
        + 'Sıra: statik sehim küçükten büyüğe; renk açıldıkça sehim artar.',
      sehim: '1 g statik yükte takozların düşey sehiminin en büyüğü: max |δz|.',
      k1: 'Güç grubunun altı rijit gövde modunun hepsi ateşleme frekansının yarısının altında.\n'
        + 'f_ateş = ' + tr(E.rolanti, 0) + ' d/dk (rölanti) / 60 × ' + tr(E.silindir, 0) + ' silindir / 2 = ' + tr(E.fAtes, 2) + ' Hz\n'
        + 'Sınır: her mod < ' + tr(y, 2) + ' Hz',
      k1a: 'Frekansa göre sıralı iki komşu mod arasındaki en küçük fark. '
        + 'Birbirine çok yakın iki mod tek bir geniş rezonans gibi davranır.\nSınır: > 0,5 Hz',
      k1b: 'Hiçbir mod 8–10 Hz bandında değil. Bu bant aks ve lastiklerin (yaylandırılmamış kütle) modlarının bandı; '
        + 'güç grubu modu banda düşerse süspansiyonla enerji alışverişi olur.\nSınır: 8–10 Hz bandında mod yok',
      k2: 'Rölantide ateşleme titreşiminin takozlardan şasiye iletilen oranı, düşey zıplama frekansına göre:\n'
        + 'TR = √[(1 + (2ζr)²) / ((1 − r²)² + (2ζr)²)]\n'
        + 'r = f_ateş / f_b;  f_b = √(Σk_z,din / m) / 2π\n'
        + 'ζ = ' + tr(E.zeta, 3) + ';  m = ' + tr(E.kutle, 1) + ' kg\n'
        + 'Sınır: < %50 (referans %10)',
      pay: 'Kriter 1, 1a ve 1b\'den sınırına en yakın olanın sınıra uzaklığı: en küçüğü '
        + '(' + tr(y, 2) + ' − en yüksek mod; en küçük ayrıklık − 0,5; modların 8–10 Hz bandına uzaklığı).\n'
        + 'Eksi değer: kriter sağlanmıyor.'
    };
  }
  function notKutusu(metin){
    var satir = metin.split('\n').reduce(function(s, p){ return s + Math.max(1, Math.ceil(p.length / 48)); }, 0);
    return [330, satir * 15 + 12];
  }

  // ── Özet ─────────────────────────────────────────────────────────────────
  function ozet(E, adlar, D){
    var S = { ad:'Özet', hucre:[], birlesik:[], bag:[], not:[], izgara:false, gizle:true, yakin:85, satir:{ 2:24, 4:22 }, sutun:{ 1:2 } };
    var HR = 6, N = notlar(E), G = E.gruplar.map(kok);
    S.hucre.push([2, 2, E.baslik || 'Takoz konfigürasyonları', BASLIK]);
    if(E.tarama && E.tarama.satirlar && E.tarama.satirlar.length){ S.hucre.push([4, 3, 'Tarama →', DUGME]); S.bag.push([4, 3, 'Tarama', 'A1']); }
    var bas = [['K'], ['Sonuç']].concat(G.map(function(g){ return [g]; })).concat([
      ['Uygunluk', N.uygunluk], ['Statik sehim [mm]', N.sehim], ['Kriter 1 · Modal bant < ' + tr(E.fAtes / 2, 2) + ' Hz', N.k1],
      ['Kriter 1a · Mod ayrıklığı > 0,5 Hz', N.k1a], ['Kriter 1b · 8–10 Hz bandında mod yok', N.k1b],
      ['Kriter 2 · TR < %50', N.k2], ['Frekans payı [Hz]', N.pay], ['TR [%]'], ['En düşük mod [Hz]']]);
    bas.forEach(function(b, i){
      S.hucre.push([HR, 2 + i, b[0], BAS]);
      if(b[1]){ var k = notKutusu(b[1]); S.not.push([HR, 2 + i, b[1], k[0], k[1]]); }
    });
    var cU = 4 + G.length, sira = 0;
    E.konfig.forEach(function(k, n){
      var r = HR + 1 + n, en = k.uygunluk === 'En uygun';
      S.hucre.push([r, 2, 'K' + k.K, bagStil(en)]);
      S.hucre.push([r, 3, adlar[n], bagStil(en, true)]);
      S.bag.push([r, 2, 'Sonuç', D.serit(n)], [r, 3, 'Sonuç', D.serit(n)]);   // Sonuç'taki bloğu
      G.forEach(function(g, i){ S.hucre.push([r, 4 + i, temiz(k.tipler[i] || '—'), SOL]); });
      var st = { kenar:true, yatay:'center', dikey:'center' };
      if(en){ st.dolgu = KOYU; st.renk = 'FFFFFF'; st.b = true; }
      else if(k.uygunluk === 'Uygun' || k.uygunluk === 'Kısmen uygun'){
        st.dolgu = k.mevcut ? (k.uygunluk === 'Uygun' ? ACIK[0] : ACIK[5]) : ACIK[Math.min(sira++, ACIK.length - 1)];
      }
      S.hucre.push([r, cU, k.uygunluk || '—', st]);
      S.hucre.push([r, cU + 1, Number.isFinite(k.d) ? k.d : '', sayiStil('0.00')]);
      (k.kriter || []).forEach(function(ok, j){ S.hucre.push([r, cU + 2 + j, ok ? 'Uygun' : 'Uygun değil', HUC]); });
      var f = (k.f || []).filter(Number.isFinite);
      S.hucre.push([r, cU + 6, frekansPayi(f, E.fAtes), sayiStil('0.000')]);
      S.hucre.push([r, cU + 7, Number.isFinite(k.T) ? k.T * 100 : '', sayiStil('0.0')]);
      S.hucre.push([r, cU + 8, f.length ? Math.min.apply(null, f) : '', sayiStil('0.00')]);
    });
    var o = olc(S);
    Object.assign(S.sutun, o.sutun); Object.assign(S.satir, o.satir);
    return S;
  }

  // ── Tarama ───────────────────────────────────────────────────────────────
  // Satırlar adım adım eklenir (kitapIs); başlık ve ölçü taramaBasla'da, süzgeç ve
  // sütun genişliği taramaBitir'de.
  function taramaBasla(E, D){
    var T = E.tarama, S = { ad:'Tarama', hucre:[], birlesik:[], izgara:false, gizle:true, yakin:85, satir:{}, sutun:{} };
    var G = T.gruplar.map(function(g){ return kok(E.gruplar[g]); });
    var L = T.satirlar, nMod = L.reduce(function(m, x){ return Math.max(m, (x.f || []).length); }, 0) || 6;
    var ust = L.length < T.N ? 'ilk ' + tr(L.length, 0) + ' / ' + tr(T.N, 0) : tr(T.N, 0);
    S.hucre.push([1, 1, 'Tarama — ' + ust + ' kombinasyon (' + G.join(' × ') + ')', { b:true, boy:12, yatay:'left', dikey:'center' }]);
    S.hucre.push([2, 1, 'Ateşleme frekansı [Hz]', ETIKET], [2, 4, E.fAtes, sayiStil('0.00')]);
    S.hucre.push([3, 1, 'Sönüm oranı ζ', ETIKET], [3, 4, E.zeta, sayiStil('0.00')]);
    S.bag = [];
    S.hucre.push([2, 6, '← Özet', DUGME]); S.bag.push([2, 6, 'Özet', 'A1']);
    var bas = ['No'].concat(G);
    for(var i = 1; i <= nMod; i++) bas.push('Mod ' + i + ' [Hz]');
    bas = bas.concat(['Zıplama f_b [Hz]', 'TR [%]', 'Statik sehim [mm]', 'Kriter 1', '1a', '1b', '2', 'Dört kriter', 'Frekans payı [Hz]'])
      .concat(G.map(function(g){ return g + ' statik yük [kg]'; })).concat(G.map(function(g){ return g + ' azami yük [kg]'; }))
      .concat(['Kapasite']);
    bas.forEach(function(b, c){ S.hucre.push([5, c + 1, b, BAS]); });
    var o = olcBasla(S);
    olcEkle(o, S.hucre, 0, S.hucre.length);
    return { S:S, G:G, L:L, nMod:nMod, nSut:bas.length, olc:o, D:D };
  }
  function taramaSatir(Z, E, n0, n1){
    var S = Z.S, G = Z.G, nMod = Z.nMod, i0 = S.hucre.length;
    for(var n = n0; n < n1; n++){
      var x = Z.L[n], r = 6 + n, c = 1;
      // No ve taranan grupların tipi: Sonuç'taki bloğun bağlantısı (formül: süzgeç ve
      // sıralama hücreyle taşır; değer formülün son değeri)
      var hedef = Z.D && n < Z.D.nT ? '#\'Sonuç\'!' + Z.D.serit(Z.D.nK + n) : null;
      S.hucre.push(hedef ? [r, c++, { f:'HYPERLINK("' + hedef + '",' + (n + 1) + ')', v:n + 1 }, BAG_NO] : [r, c++, n + 1, HUC]);
      G.forEach(function(g, j){
        var ad = temiz(x.tipler[j]);
        S.hucre.push(hedef ? [r, c++, { f:'HYPERLINK("' + hedef + '","' + fx(ad) + '")', v:ad }, BAG_TIP] : [r, c++, ad, SOL]);
      });
      var f = (x.f || []).slice().sort(function(a, b){ return a - b; });
      for(var i = 0; i < nMod; i++) S.hucre.push([r, c++, Number.isFinite(f[i]) ? f[i] : '', sayiStil('0.00')]);
      S.hucre.push([r, c++, x.fB, sayiStil('0.00')], [r, c++, x.T * 100, sayiStil('0.0')], [r, c++, x.d, sayiStil('0.0')]);
      var k = x.k || [];
      for(i = 0; i < 4; i++) S.hucre.push([r, c++, k[i] ? '✓' : '✗', HUC]);   // metin: belgenin ✓/✗ işareti
      S.hucre.push([r, c++, k.length === 4 && k.every(Boolean) ? 'Uygun' : '—', HUC]);
      S.hucre.push([r, c++, frekansPayi(f, E.fAtes), sayiStil('0.000')]);
      G.forEach(function(g, j){ S.hucre.push([r, c++, x.yuk[j], sayiStil('0')]); });
      G.forEach(function(g, j){ S.hucre.push([r, c++, x.azami[j] > 0 ? x.azami[j] : '', sayiStil('0')]); });
      S.hucre.push([r, c, kapasite(x.yuk, x.azami), HUC]);
    }
    olcEkle(Z.olc, S.hucre, i0, S.hucre.length);
  }
  function taramaBitir(Z){
    var S = Z.S;
    S.filtre = 'A5:' + harf(Z.nSut) + Math.max(6, 5 + Z.L.length);
    var o = olcBitir(Z.olc);
    S.sutun = o.sutun; S.satir = o.satir;
    return S;
  }
  function tarama(E){
    var Z = taramaBasla(E, sonucDuzen(E));
    taramaSatir(Z, E, 0, Z.L.length);
    return taramaBitir(Z);
  }

  // ── Sonuç: bütün konfigürasyonların sonuç blokları (biçimli akış) ────────
  // Sayfanın başı (1–6): yönlendirme, Özet · Tarama düğmeleri, iki yüksek boş satır —
  // sekmeden açılınca sonuç görünmez. Ardından her `adim` satırda bir blok: önce Özet'in
  // konfigürasyonları (K0…Kn), sonra Tarama'nın satırları (No sırası). Blok (s ilk satırı):
  // s boşluk (30 pt) · s+1 başlık · s+3 düğmeler · s+5 tip · s+6 ad · s+7 X/Y/Z · s+8… yük
  // durumları · dört satır sonra modlar · üç satır sonra TR; ardından iki yüksek (409 pt) boş
  // satır. Özet'in K'sı ve Tarama'nın konfigürasyon yazıları bloğun ŞERİDİNİ (A sütunu,
  // s…s+H−1) açar: ekranda yalnız o konfigürasyon. K bloğu çözümün değerleri (tam
  // duyarlık), tarama satırınınki mm'nin yüzde biri (veri.kod).
  var BOS = -2147483648;                     // veri.kod'da "sonuç yok"
  var UST = 6, YUKSEK = 409, SATIR_SINIR = 1048576;
  var BOS_SONUC = veYon('Özet’te ya da Tarama’da konfigürasyonu seçin.');
  function fx(s){ return String(s).replace(/"/g, '""'); }
  // Birleşik görünüşlü kutu, birleştirmesiz (bloklar binlerce): yazı ilk hücrede, üç hücre
  // ortalanmış (centerContinuous), kenarlık dıştan.
  function kutu(st, yan){ return Object.assign({}, st, { yatay:'centerContinuous', kenar:yan }); }
  var KUTU_AD = [kutu(BAS1, 'ltb'), kutu(BAS1, 'tb'), kutu(BAS1, 'trb')];
  var KUTU_DUGME = [kutu(DUGME, 'ltb'), kutu(DUGME, 'tb'), kutu(DUGME, 'trb')];
  var TIP = { yatay:'center', dikey:'center' };          // ortadaki hücrede: yazı iki boş komşusuna taşar
  var SAYI1 = sayiStil('0.0'), SAYI2 = sayiStil('0.00');
  var BAG_NO = bagStil(false), BAG_TIP = bagStil(false, true);

  // Blokun tablosu (b: başlık satırı): tip b+4 (takozun ortadaki sütununda) · ad b+5 · X/Y/Z
  // b+6 · yük durumları b+7'den, modlar dört satır sonra, TR modlardan üç satır sonra. Kutular
  // ölçü için S.birlesik'te (sütun genişliği birleşik hücre gibi dağıtılır); sayfaya birleştirme
  // yazılmaz.
  function blokTablo(S, E, b, tipHucre, vakaHucre, V, modlar, trHucre){
    var TK = E.takozlar;
    TK.forEach(function(t, i){
      var c0 = 4 + 4 * i;
      S.hucre.push([b + 4, c0 + 1, tipHucre(i), TIP]);
      for(var j = 0; j < 3; j++){
        S.hucre.push([b + 5, c0 + j, j ? '' : kok(t.ad), KUTU_AD[j]]);
        S.hucre.push([b + 6, c0 + j, 'XYZ'.charAt(j), BAS1]);
      }
      birles(S, b + 5, c0, c0 + 2);
    });
    V.forEach(function(ad, q){
      var r = b + 7 + q;
      S.hucre.push([r, 3, ad, BAS1]);
      TK.forEach(function(t, i){
        for(var j = 0; j < 3; j++) S.hucre.push([r, 4 + 4 * i + j, vakaHucre(q, i, j), SAYI1]);
      });
    });
    var mh = b + 7 + V.length + 4;
    S.hucre.push([mh, 2, 'Mod', BAS1], [mh, 3, 'Mod Tipi', BAS1], [mh, 4, 'Hz', BAS1]);
    modlar.forEach(function(m, i){
      S.hucre.push([mh + 1 + i, 2, i + 1, BAS1], [mh + 1 + i, 3, m[0], HUC], [mh + 1 + i, 4, m[1], SAYI2]);
    });
    var tr_ = mh + Math.max(modlar.length, 1) + 3;
    S.hucre.push([tr_, 2, 'TR (%)', HUC], [tr_, 3, trHucre, SAYI2]);
    return tr_;
  }
  // Blokun başı: başlık; dönüş (C), geri (D–F) ve ileri (son takozun sütunları) düğmesi —
  // [metin, hedef sayfa, hedef hücre]; geri ve ileri bağlantısı düğmenin üç hücresini kaplar.
  function blokBasi(S, E, b, baslik, don, geri, ileri){
    S.hucre.push([b, 3, baslik, BASLIK]);
    S.hucre.push([b + 2, 3, don[0], DUGME]); S.bag.push([b + 2, 3, don[1], don[2]]);
    var TK = E.takozlar, son = TK.length < 2 ? 8 : 4 + 4 * (TK.length - 1);
    [[geri, 4], [ileri, son]].forEach(function(x){
      if(!x[0]) return;
      for(var j = 0; j < 3; j++) S.hucre.push([b + 2, x[1] + j, j ? '' : x[0][0], KUTU_DUGME[j]]);
      birles(S, b + 2, x[1], x[1] + 2);
      S.bag.push([b + 2, x[1], x[0][1], x[0][2], x[1] + 2]);
    });
  }
  // Düzen: blok sayısı (Özet'in konfigürasyonları nK, Tarama'nın satırları nT), blok boyu H,
  // adım (blok + iki yüksek satır; Excel'in satır sınırını aşacaksa bir yüksek satır, o da
  // aşarsa sığan kadar tarama satırı), bloğun ilk satırı ve şeridi (bağlantının hedefi).
  function sonucDuzen(E){
    var T = E.tarama || {}, V = T.veri, L = T.satirlar || [], nK = E.konfig.length;
    var nV = V ? V.vakaAdlari.length : 0, nM = V ? V.nM : 0;
    E.konfig.forEach(function(k){ nV = Math.max(nV, (k.vakalar || []).length); nM = Math.max(nM, (k.modlar || []).length); });
    var H = nV + Math.max(nM, 1) + 16, adim = H + 2, nT = V ? L.length : 0;
    if(UST + (nK + nT) * adim + 1 > SATIR_SINIR) adim = H + 1;
    if(UST + (nK + nT) * adim + 1 > SATIR_SINIR) nT = Math.max(0, Math.floor((SATIR_SINIR - 1 - UST) / adim) - nK);
    var ilk = function(j){ return UST + 1 + j * adim; };
    return { nK:nK, nT:nT, H:H, adim:adim, n:UST + (nK + nT) * adim, ilk:ilk,
             serit:function(j){ var s0 = ilk(j); return '$A$' + s0 + ':$A$' + (s0 + H - 1); } };
  }
  // Tarama satırının grup başına tipi: taranan grup satırdan, öteki grup mevcut tasarımınki.
  function grupTipleri(E, x){
    var taranan = {};
    E.tarama.gruplar.forEach(function(g, j){ taranan[g] = j; });
    return E.gruplar.map(function(g, gi){
      return temiz(gi in taranan ? x.tipler[taranan[gi]] : ((E.konfig[0] && E.konfig[0].tipler[gi]) || '—'));
    });
  }
  // Özet'in n. konfigürasyonunun bloğu: çözümün değerleri, formülsüz.
  function kBlok(E, D, n){
    var k = E.konfig[n], G = E.gruplar.map(kok), b = D.ilk(n) + 1, S = { hucre:[], birlesik:[], bag:[] };
    blokBasi(S, E, b, 'K' + k.K + ' — ' + G.map(function(g, i){ return g + ': ' + temiz(k.tipler[i] || '—'); }).join(' · '),
      ['← Özet sayfasına dön', 'Özet', 'A1'],
      n > 0 ? ['← Geri konfigürasyon (K' + E.konfig[n - 1].K + ')', 'Sonuç', D.serit(n - 1)] : null,
      n < E.konfig.length - 1 ? ['İleri konfigürasyon (K' + E.konfig[n + 1].K + ') →', 'Sonuç', D.serit(n + 1)] : null);
    var V = k.vakalar || [];
    var M = (k.modlar || []).slice().sort(function(a, c){ return a.f - c.f; });
    blokTablo(S, E, b, function(i){ return temiz((k.takozTip || [])[i] || ''); },
      function(q, i, j){ var d = (V[q].d || [])[i] || []; return Number.isFinite(d[j]) ? d[j] : ''; },
      V.map(function(v){ return v.ad; }), M.map(function(m){ return [modAdi(m.ad), m.f]; }),
      Number.isFinite(k.T) ? k.T * 100 : '');
    return S;
  }
  // Tarama'nın i. satırının (No i + 1) bloğu: veri.kod'dan (mm'nin yüzde biri).
  function tBlok(E, D, i){
    var T = E.tarama, V = T.veri, x = T.satirlar[i], G = E.gruplar.map(kok), j = D.nK + i, b = D.ilk(j) + 1, no = i + 1;
    var S = { hucre:[], birlesik:[], bag:[] }, nV = V.vakaAdlari.length, nT = V.nT, nM = V.nM, tip = grupTipleri(E, x);
    blokBasi(S, E, b, 'No ' + tr(no, 0) + ' — ' + G.map(function(g, gi){ return g + ': ' + tip[gi]; }).join(' · '),
      ['← Tarama sayfasına dön', 'Tarama', '$A$' + (5 + no)],
      i > 0 ? ['← Geri konfigürasyon (No ' + tr(no - 1, 0) + ')', 'Sonuç', D.serit(j - 1)] : null,
      i < D.nT - 1 ? ['İleri konfigürasyon (No ' + tr(no + 1, 0) + ') →', 'Sonuç', D.serit(j + 1)] : null);
    var grupOf = E.takozlar.map(function(t){ return t.grup; }), M = [];
    for(var m = 0; m < nM; m++){
      var f = V.modF[i * nM + m], a = V.modAd[i * nM + m];
      if(Number.isFinite(f)) M.push([a < V.modAdlar.length ? modAdi(V.modAdlar[a]) : '', f]);
    }
    blokTablo(S, E, b, function(k){ return tip[grupOf[k]] || ''; },
      function(q, k, a){ var z = V.kod[((i * nV + q) * nT + k) * 3 + a]; return z === BOS ? '' : z / 100; },
      V.vakaAdlari, M, Number.isFinite(x.T) ? x.T * 100 : '');
    return S;
  }
  // Sonuç sayfası: satırları istendikçe (blok blok) üretilen biçimli akış. Sütun genişliği
  // sayfanın başından, K bloklarından, ilk ve son tarama satırının bloğundan ve en uzun mod
  // adından; bağlantılar satırlar üretilirken birikir (bag yazımın sonunda okunur).
  function sonucSayfa(E, D){
    var ust = { hucre:[[2, 3, BOS_SONUC, BASLIK], [4, 3, '← Özet sayfasına dön', DUGME]], birlesik:[], bag:[[4, 3, 'Özet', 'A1']] };
    for(var j = 0; j < 3; j++) ust.hucre.push([4, 4 + j, j ? '' : '← Tarama', KUTU_DUGME[j]]);
    birles(ust, 4, 4, 6); ust.bag.push([4, 4, 'Tarama', 'A1', 6]);
    function grupla(S){
      var m = {};
      S.hucre.forEach(function(h){ (m[h[0]] || (m[h[0]] = [])).push([h[1], h[2], h[3]]); });
      Object.keys(m).forEach(function(r){ m[r].sort(function(a, c){ return a[0] - c[0]; }); });
      return m;
    }
    var olcS = { hucre:ust.hucre.slice(), birlesik:ust.birlesik.slice() }, ekle = function(S){
      olcS.hucre = olcS.hucre.concat(S.hucre); olcS.birlesik = olcS.birlesik.concat(S.birlesik);
    };
    for(var n = 0; n < D.nK; n++) ekle(kBlok(E, D, n));
    if(D.nT){ ekle(tBlok(E, D, 0)); if(D.nT > 1) ekle(tBlok(E, D, D.nT - 1)); }
    var V = E.tarama && E.tarama.veri;
    if(V) (V.modAdlar || []).forEach(function(a){ olcS.hucre.push([D.n + 2, 3, modAdi(a), HUC]); });
    var o = olc(olcS), sonC = 1;
    olcS.hucre.forEach(function(h){ if(h[1] > sonC) sonC = h[1]; });
    var ustR = grupla(ust), BAG = [], bj = -1, satir = null;
    return { ad:'Sonuç', izgara:false, gizle:'sutun', yakin:85, sutun:o.sutun, bag:function(){ return BAG; },
      akis:{ n:D.n, sutun:sonC,
        hucre:function(r){
          if(r === 1){ BAG = ust.bag.slice(); bj = -1; }
          if(r <= UST) return ustR[r] || null;
          var jj = Math.floor((r - UST - 1) / D.adim);
          if(jj !== bj){
            bj = jj;
            var S = jj < D.nK ? kBlok(E, D, jj) : tBlok(E, D, jj - D.nK);
            satir = grupla(S); BAG.push.apply(BAG, S.bag);
          }
          return satir[r] || null;
        },
        ht:function(r){
          if(r <= UST) return r === 2 ? 24 : r === 4 ? 22 : r >= 5 ? YUKSEK : undefined;
          var x = (r - UST - 1) % D.adim;
          return x === 0 ? 30 : x === 1 ? 24 : x === 3 ? 22 : x >= D.H ? YUKSEK : undefined;
        } } };
  }

  // Dilimli kurulum (uzun iş arayüzü kilitlemez): adim() bir adım yapar — Özet ve Sonuç'un
  // düzeni, Tarama'nın başı, KAC satırı, sonu — ve iş yaptıysa true döner; Sonuç'un
  // blokları yazılırken üretilir. kitap(E) adımların tek seferi.
  var KAC = 100;
  function kitapIs(E){
    var T = E.tarama, N = (T && T.satirlar) ? T.satirlar.length : 0, evre = 0, n = 0;
    var OZ = null, SON = null, Z = null, TA = null, D = null;
    return {
      adim: function(){
        if(evre === 0){
          D = sonucDuzen(E);
          var adlar = E.konfig.map(function(k){ return sayfaAdi(k, k.tipler || []); });
          OZ = ozet(E, adlar, D);
          SON = sonucSayfa(E, D);
          evre = N ? 4 : 3;
          return true;
        }
        if(evre === 4){ Z = taramaBasla(E, D); evre = 1; return true; }
        if(evre === 1){
          var son = Math.min(N, n + KAC);
          taramaSatir(Z, E, n, son); n = son;
          if(n >= N) evre = 2;
          return true;
        }
        if(evre === 2){ TA = taramaBitir(Z); evre = 3; return true; }
        return false;
      },
      oran: function(){ return evre === 3 ? 1 : (evre === 0 ? 0 : (evre === 4 ? 0.05 : 0.05 + 0.9 * n / N)); },
      kitap: function(){
        if(evre !== 3) throw new Error('Kitap kurulmadı');
        var sayfalar = [OZ];
        if(N) sayfalar.push(TA);
        sayfalar.push(SON);
        return { sayfalar:sayfalar };
      }
    };
  }
  function kitap(E){
    var I = kitapIs(E);
    while(I.adim());
    return I.kitap();
  }

  return { kitap:kitap, kitapIs:kitapIs, frekansPayi:frekansPayi, kapasite:kapasite, sayfaAdi:sayfaAdi, kisa:kisa, temiz:temiz,
           kok:kok, modAdi:modAdi, px:px, olc:olc };
})();

if(typeof module !== 'undefined' && module.exports){ module.exports = veMntParamExcel; }
