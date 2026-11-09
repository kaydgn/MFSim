// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ — PARAMETRİK ANALİZ · EXCEL ÇIKTISI (DOM'suz kurucu)
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı kararı (2026-11-09): "Bu konfigürasyon bizim programımızın temel
// konfigürasyonu olacak … Kullanıcı bu Excel formatında çıktı alacak." Düzen
// Canlı Not'ta kullanıcıyla 19 notta kuruldu (10 Ton TTA, R12); bu dosya o
// düzeni taramanın verisinden KURAR, hesaplamaz:
//   Özet  — başlık; konfigürasyon başına satır: K · Sayfa (o sayfaya bağlı) ·
//           grupların tipi · Uygunluk (TEK renkli sütun: en uygun koyu yeşil,
//           öteki uygunlar sırayla açılan yeşil, uygun olmayan renksiz) · dört
//           kesin kriter · frekans payı · TR · en düşük mod. Kriterin tanımı
//           başlığın NOTUNDA (fare üstüne gelince), tabloda değil.
//   Tarama — çözülen kombinasyonlar: modlar, f_b, TR, statik sehim, dört
//           kriter (✓/✗), frekans payı, grup başına statik ve azami yük, kapasite.
//   K0…Kn — konfigürasyon başına: gezinme düğmeleri (Özet · geri · ileri),
//           yük durumu × takoz × X/Y/Z yer değiştirme, modlar, TR.
// Her sayfada ızgara kapalı, kullanılmayan satır ve sütun gizli, sütun
// genişliği içeriğe göre (Calibri ölçüsü: aşağıdaki tablo), hücre değer
// taşır (formül yok). Takoz adındaki "ASR…" kaynak eki yazılmaz (kullanıcı
// 2026-11-09).
//
// Girdi E (cp-mount-param-sonuc.js → veMntParamExcel kurar):
//   { baslik, fAtes, rolanti, silindir, zeta, kutle,
//     gruplar:[ad], takozlar:[{ ad, grup }],
//     konfig:[{ K, mevcut, tipler:[grup başına ad], uygunluk, kriter:[4 × bool],
//               f:[Hz], T, takozTip:[takoz başına ad],
//               vakalar:[{ ad, d:[[x,y,z] mm] }], modlar:[{ f, ad }] }],
//     tarama:{ N, gruplar:[grup sırası], satirlar:[{ tipler:[ad], f:[Hz], fB, T, d,
//               k:[4 × bool], yuk:[kg], azami:[kg|null] }] } }
// Çıktı: js/xlsx-yaz.js'in kitap modeli.
// ═══════════════════════════════════════════════════════════════════════════

var veMntParamExcel = (function(){
  'use strict';

  var _sayi = (typeof veSayi === 'function') ? veSayi
    : (typeof require === 'function' ? require('./sayi.js').veSayi : null);
  function tr(x, d){ return _sayi ? _sayi(x, d) : String(x); }

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
  function sayfaAdi(k, tipler){
    if(k.mevcut) return 'K' + k.K + ' Mevcut';
    var s = 'K' + k.K, ek = tipler.map(kisa).filter(Boolean).join(' + ');
    if(!ek) return s;
    var w = (s + ' ' + ek).split(' '), out = '';
    w.forEach(function(p){ var a = out ? out + ' ' + p : p; if(a.length <= 31) out = a; });
    return out.replace(/\s*\+$/, '');
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
    if(typeof v !== 'number') return String(v == null ? '' : v);
    var d = (f && f.indexOf('.') >= 0) ? f.split('.')[1].length : 0;
    return tr(v, d);
  }

  // Sütun genişliği ve sarılı satırın yüksekliği hücrelerden: kenarlıksız
  // hücre (başlık, etiket) ve birleşik hücrenin içi ölçüye girmez — onlar
  // komşu boş hücreye taşabilir; birleşik hücrenin yazısı sütunlarına dağılır.
  function olc(S){
    var kapali = {}, gerek = {}, sarili = [];
    (S.birlesik || []).forEach(function(b){
      var a = aralik(b);
      for(var r = a.r1; r <= a.r2; r++) for(var c = a.c1; c <= a.c2; c++) kapali[r + ',' + c] = a;
    });
    S.hucre.forEach(function(h){
      var st = h[3] || {};
      if(!st.kenar || kapali[h[0] + ',' + h[1]] || h[2] === '' || h[2] == null) return;
      var t = goster(h[2], st.bicim), p;
      if(st.sar){
        var uzun = 0; t.split(/\s+/).forEach(function(w){ uzun = Math.max(uzun, px(w, st.b)); });
        var top = px(t, st.b);
        p = Math.max(uzun, Math.min(top, Math.max(top / 3, TEK_SATIR)));
        sarili.push(h);
      } else p = px(t, st.b);
      gerek[h[1]] = Math.max(gerek[h[1]] || 0, p);
    });
    var sutun = {};
    Object.keys(gerek).forEach(function(c){ sutun[c] = birim(gerek[c]); });
    (S.birlesik || []).forEach(function(b){
      var a = aralik(b), h = null;
      S.hucre.forEach(function(x){ if(x[0] === a.r1 && x[1] === a.c1) h = x; });
      if(!h || h[2] === '' || h[2] == null) return;
      var p = px(goster(h[2], (h[3] || {}).bicim), (h[3] || {}).b), n = a.c2 - a.c1 + 1, var_ = 0;
      for(var c = a.c1; c <= a.c2; c++) var_ += sutun[c] || 8.43;
      var eksik = (p + PAY - 5 * n) / 7 - var_;
      if(eksik > 0) for(c = a.c1; c <= a.c2; c++) sutun[c] = Math.ceil(((sutun[c] || 8.43) + eksik / n) * 2) / 2;
    });
    var satir = {};
    sarili.forEach(function(h){
      var w = (sutun[h[1]] || 8.43) * 7 + 5 - 8;
      satir[h[0]] = Math.max(satir[h[0]] || 15, satirSay(goster(h[2]), (h[3] || {}).b, w) * 15 + 4);
    });
    return { sutun:sutun, satir:satir };
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
      uygunluk: 'En uygun: dört kesin kriter sağlanıyor; sıralamada ilk.\n'
        + 'Uygun: dört kesin kriter ve bütün açık ek kısıtlar sağlanıyor.\n'
        + 'Kısmen uygun: dört kesin kriter sağlanıyor; açık ek kısıtlardan en az biri sağlanmıyor.\n'
        + 'Uygun değil: dört kesin kriterden en az biri sağlanmıyor.\n'
        + 'Sıra: önce bütün açık kısıtları sağlayanlar (uzlaşı), sonra ek kısıt ihlali en küçük olanlar; '
        + 'renk açıldıkça sıra düşer.',
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
  function ozet(E, adlar){
    var S = { ad:'Özet', hucre:[], birlesik:[], bag:[], not:[], izgara:false, gizle:true, yakin:85, satir:{ 2:24 }, sutun:{ 1:2 } };
    var HR = 4, N = notlar(E), G = E.gruplar.map(kok);
    S.hucre.push([2, 2, E.baslik || 'Takoz konfigürasyonları', BASLIK]);
    var bas = [['K'], ['Sayfa']].concat(G.map(function(g){ return [g]; })).concat([
      ['Uygunluk', N.uygunluk], ['Kriter 1 · Modal bant < ' + tr(E.fAtes / 2, 2) + ' Hz', N.k1],
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
      S.bag.push([r, 2, adlar[n], 'A1'], [r, 3, adlar[n], 'A1']);
      G.forEach(function(g, i){ S.hucre.push([r, 4 + i, temiz(k.tipler[i] || '—'), SOL]); });
      var st = { kenar:true, yatay:'center', dikey:'center' };
      if(en){ st.dolgu = KOYU; st.renk = 'FFFFFF'; st.b = true; }
      else if(k.uygunluk === 'Uygun' || k.uygunluk === 'Kısmen uygun'){
        st.dolgu = k.mevcut ? (k.uygunluk === 'Uygun' ? ACIK[0] : ACIK[5]) : ACIK[Math.min(sira++, ACIK.length - 1)];
      }
      S.hucre.push([r, cU, k.uygunluk || '—', st]);
      (k.kriter || []).forEach(function(ok, j){ S.hucre.push([r, cU + 1 + j, ok ? 'Uygun' : 'Uygun değil', HUC]); });
      var f = (k.f || []).filter(Number.isFinite);
      S.hucre.push([r, cU + 5, frekansPayi(f, E.fAtes), sayiStil('0.000')]);
      S.hucre.push([r, cU + 6, Number.isFinite(k.T) ? k.T * 100 : '', sayiStil('0.0')]);
      S.hucre.push([r, cU + 7, f.length ? Math.min.apply(null, f) : '', sayiStil('0.00')]);
    });
    var o = olc(S);
    Object.assign(S.sutun, o.sutun); Object.assign(S.satir, o.satir);
    return S;
  }

  // ── Tarama ───────────────────────────────────────────────────────────────
  function tarama(E){
    var T = E.tarama, S = { ad:'Tarama', hucre:[], birlesik:[], izgara:false, gizle:true, yakin:85, satir:{}, sutun:{} };
    var G = T.gruplar.map(function(g){ return kok(E.gruplar[g]); });
    var L = T.satirlar, nMod = L.reduce(function(m, x){ return Math.max(m, (x.f || []).length); }, 0) || 6;
    var ust = L.length < T.N ? 'ilk ' + tr(L.length, 0) + ' / ' + tr(T.N, 0) : tr(T.N, 0);
    S.hucre.push([1, 1, 'Tarama — ' + ust + ' kombinasyon (' + G.join(' × ') + ')', { b:true, boy:12, yatay:'left', dikey:'center' }]);
    S.hucre.push([2, 1, 'Ateşleme frekansı [Hz]', ETIKET], [2, 4, E.fAtes, sayiStil('0.00')]);
    S.hucre.push([3, 1, 'Sönüm oranı ζ', ETIKET], [3, 4, E.zeta, sayiStil('0.00')]);
    var bas = ['No'].concat(G);
    for(var i = 1; i <= nMod; i++) bas.push('Mod ' + i + ' [Hz]');
    bas = bas.concat(['Zıplama f_b [Hz]', 'TR [%]', 'Statik sehim maks [mm]', 'Kriter 1', '1a', '1b', '2', 'Dört kriter', 'Frekans payı [Hz]'])
      .concat(G.map(function(g){ return g + ' statik yük [kg]'; })).concat(G.map(function(g){ return g + ' azami yük [kg]'; }))
      .concat(['Kapasite']);
    bas.forEach(function(b, c){ S.hucre.push([5, c + 1, b, BAS]); });
    L.forEach(function(x, n){
      var r = 6 + n, c = 1;
      S.hucre.push([r, c++, n + 1, HUC]);
      G.forEach(function(g, j){ S.hucre.push([r, c++, temiz(x.tipler[j]), SOL]); });
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
    });
    S.filtre = 'A5:' + harf(bas.length) + Math.max(6, 5 + L.length);
    var o = olc(S);
    S.sutun = o.sutun; S.satir = o.satir;
    return S;
  }

  // ── konfigürasyon sayfası ────────────────────────────────────────────────
  function konfig(E, k, n, adlar){
    var S = { ad:adlar[n], hucre:[], birlesik:[], bag:[], izgara:false, gizle:true, yakin:85, satir:{ 1:30, 2:24, 4:22 }, sutun:{} };
    var G = E.gruplar.map(kok), TK = E.takozlar;
    S.hucre.push([2, 3, 'K' + k.K + ' — ' + G.map(function(g, i){ return g + ': ' + temiz(k.tipler[i] || '—'); }).join(' · '), BASLIK]);
    // gezinme düğmeleri (sayfa içi bağlantı)
    var son = 4 + 4 * Math.max(0, TK.length - 1);
    if(TK.length < 2) son = 8;
    S.hucre.push([4, 3, '← Özet sayfasına dön', DUGME]); S.bag.push([4, 3, 'Özet', 'A1']);
    if(n > 0){
      for(var c = 4; c <= 6; c++) S.hucre.push([4, c, c === 4 ? '← Geri konfigürasyon (K' + E.konfig[n - 1].K + ')' : '', DUGME]);
      birles(S, 4, 4, 6); S.bag.push([4, 4, adlar[n - 1], 'A1']);
    }
    if(n < E.konfig.length - 1){
      for(c = son; c <= son + 2; c++) S.hucre.push([4, c, c === son ? 'İleri konfigürasyon (K' + E.konfig[n + 1].K + ') →' : '', DUGME]);
      birles(S, 4, son, son + 2); S.bag.push([4, son, adlar[n + 1], 'A1']);
    }
    // yük durumu × takoz × X/Y/Z
    TK.forEach(function(t, i){
      var c0 = 4 + 4 * i;
      S.hucre.push([6, c0, temiz((k.takozTip || [])[i] || ''), { yatay:'center', dikey:'center' }]);
      birles(S, 6, c0, c0 + 2);
      for(var j = 0; j < 3; j++){
        S.hucre.push([7, c0 + j, j ? '' : kok(t.ad), BAS1]);
        S.hucre.push([8, c0 + j, 'XYZ'.charAt(j), BAS1]);
      }
      birles(S, 7, c0, c0 + 2);
    });
    var V = k.vakalar || [];
    V.forEach(function(v, q){
      var r = 9 + q;
      S.hucre.push([r, 3, v.ad, BAS1]);
      TK.forEach(function(t, i){
        var d = (v.d || [])[i] || [];
        for(var j = 0; j < 3; j++) S.hucre.push([r, 4 + 4 * i + j, Number.isFinite(d[j]) ? d[j] : '', sayiStil('0.0')]);
      });
    });
    var mh = 9 + V.length + 4, M = (k.modlar || []).slice().sort(function(a, b){ return a.f - b.f; });
    S.hucre.push([mh, 2, 'Mod', BAS1], [mh, 3, 'Mod Tipi', BAS1], [mh, 4, 'Hz', BAS1]);
    M.forEach(function(m, i){
      S.hucre.push([mh + 1 + i, 2, i + 1, BAS1], [mh + 1 + i, 3, modAdi(m.ad), HUC], [mh + 1 + i, 4, m.f, sayiStil('0.00')]);
    });
    var tr_ = mh + Math.max(M.length, 1) + 3;
    S.hucre.push([tr_, 2, 'TR (%)', HUC], [tr_, 3, Number.isFinite(k.T) ? k.T * 100 : '', sayiStil('0.00')]);
    return S;
  }

  function kitap(E){
    var adlar = E.konfig.map(function(k){ return sayfaAdi(k, k.tipler || []); });
    var K = E.konfig.map(function(k, n){ return konfig(E, k, n, adlar); });
    // K sayfaları aynı düzende: genişlik hepsinin en genişi
    var gen = {};
    K.forEach(function(S){ var o = olc(S); Object.keys(o.sutun).forEach(function(c){ gen[c] = Math.max(gen[c] || 0, o.sutun[c]); }); S._yuk = o.satir; });
    K.forEach(function(S){ S.sutun = Object.assign({}, gen); Object.assign(S.satir, S._yuk); delete S._yuk; });
    var sayfalar = [ozet(E, adlar)];
    if(E.tarama && E.tarama.satirlar && E.tarama.satirlar.length) sayfalar.push(tarama(E));
    return { sayfalar:sayfalar.concat(K) };
  }

  return { kitap:kitap, frekansPayi:frekansPayi, kapasite:kapasite, sayfaAdi:sayfaAdi, kisa:kisa, temiz:temiz,
           kok:kok, modAdi:modAdi, px:px, olc:olc };
})();

if(typeof module !== 'undefined' && module.exports){ module.exports = veMntParamExcel; }
