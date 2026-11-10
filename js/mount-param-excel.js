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
//           kriter (✓/✗), frekans payı, grup başına statik ve azami yük, kapasite;
//           "Sonuçlar →" Sonuç sayfasının panosuna gider.
//   Sonuç — üstte SEÇİLİ KOMBİNASYON panosu: No girilmişse o, girilmemişse
//           Tarama süzgecinde kalan ilk satır; değerler gizli Veri sayfasından
//           formülle. Altında K0…Kn blokları (gezinme düğmeleri Özet · geri ·
//           ileri; yük durumu × takoz × X/Y/Z yer değiştirme, modlar, TR) —
//           Özet'in bağlantıları bloklara gider (kullanıcı 2026-11-10: K sonuçları
//           açık sayfa olarak durmasın, tıklanınca açılsın; Excel bağlantıyla
//           gizli sayfaya gidemez, bloklar tek sayfada).
//   Veri  — GİZLİ: Tarama'nın her satırı (No = satır) için bütün sonuç; yük
//           durumu başına tek hücre, takoz × X/Y/Z yer değiştirmesi mm'nin yüzde
//           biri tam sayı, ';' ayraçlı (yerel ondalık ayarından bağımsız okunur).
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
  function ozet(E, adlar, capa){
    var S = { ad:'Özet', hucre:[], birlesik:[], bag:[], not:[], izgara:false, gizle:true, yakin:85, satir:{ 2:24 }, sutun:{ 1:2 } };
    var HR = 4, N = notlar(E), G = E.gruplar.map(kok);
    S.hucre.push([2, 2, E.baslik || 'Takoz konfigürasyonları', BASLIK]);
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
      S.bag.push([r, 2, 'Sonuç', capa[n]], [r, 3, 'Sonuç', capa[n]]);
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
  function taramaBasla(E){
    var T = E.tarama, S = { ad:'Tarama', hucre:[], birlesik:[], izgara:false, gizle:true, yakin:85, satir:{}, sutun:{} };
    var G = T.gruplar.map(function(g){ return kok(E.gruplar[g]); });
    var L = T.satirlar, nMod = L.reduce(function(m, x){ return Math.max(m, (x.f || []).length); }, 0) || 6;
    var ust = L.length < T.N ? 'ilk ' + tr(L.length, 0) + ' / ' + tr(T.N, 0) : tr(T.N, 0);
    S.hucre.push([1, 1, 'Tarama — ' + ust + ' kombinasyon (' + G.join(' × ') + ')', { b:true, boy:12, yatay:'left', dikey:'center' }]);
    S.hucre.push([2, 1, 'Ateşleme frekansı [Hz]', ETIKET], [2, 4, E.fAtes, sayiStil('0.00')]);
    S.hucre.push([3, 1, 'Sönüm oranı ζ', ETIKET], [3, 4, E.zeta, sayiStil('0.00')]);
    S.bag = [];
    if(T.veri){ S.hucre.push([3, 6, 'Sonuçlar →', DUGME]); S.bag.push([3, 6, 'Sonuç', 'C2']); }
    var bas = ['No'].concat(G);
    for(var i = 1; i <= nMod; i++) bas.push('Mod ' + i + ' [Hz]');
    bas = bas.concat(['Zıplama f_b [Hz]', 'TR [%]', 'Statik sehim [mm]', 'Kriter 1', '1a', '1b', '2', 'Dört kriter', 'Frekans payı [Hz]'])
      .concat(G.map(function(g){ return g + ' statik yük [kg]'; })).concat(G.map(function(g){ return g + ' azami yük [kg]'; }))
      .concat(['Kapasite']);
    bas.forEach(function(b, c){ S.hucre.push([5, c + 1, b, BAS]); });
    var o = olcBasla(S);
    olcEkle(o, S.hucre, 0, S.hucre.length);
    return { S:S, G:G, L:L, nMod:nMod, nSut:bas.length, olc:o };
  }
  function taramaSatir(Z, E, n0, n1){
    var S = Z.S, G = Z.G, nMod = Z.nMod, i0 = S.hucre.length;
    for(var n = n0; n < n1; n++){
      var x = Z.L[n], r = 6 + n, c = 1;
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
    var Z = taramaBasla(E);
    taramaSatir(Z, E, 0, Z.L.length);
    return taramaBitir(Z);
  }

  // ── Sonuç sayfası: seçili kombinasyon panosu + K blokları ──────────────
  var BOS = -2147483648;                     // veri.kod'da "sonuç yok"
  // Paketli metinden t. belirteç: ';' yerine W boşluk konur, MID(t·W + 1, W) yalnız
  // t. belirteci tutar — W metnin TAMAMINDAN uzunsa (öncekilerin boyu pencereyi kaydırır:
  // sabit 40, altı takozun 18 belirtecinde 5. ve 6. takozu yanlış okuyordu). W: en uzun
  // belirtecin boyu + 1, belirteç sayısı kadar. En küçük ve en büyük belirteç veri.uc'ta
  // (paketlerken), yoksa koddan.
  function pencereBoyu(V){
    var en = 0, ek = 0;
    if(V.uc){ ek = Math.min(0, V.uc[0]); en = Math.max(0, V.uc[1]); }
    else for(var k = V.kod, i = 0; i < k.length; i++){ var v = k[i]; if(v === BOS) continue; if(v > en) en = v; if(v < ek) ek = v; }
    return (Math.max(String(en).length, String(ek).length) + 1) * 3 * V.nT;
  }
  var GIRDI = { kenar:true, yatay:'center', dikey:'center', dolgu:'FFF2CC' };
  var KALIN = { b:true, kenar:true, yatay:'center', dikey:'center' };
  function fx(s){ return String(s).replace(/"/g, '""'); }
  function yuvarla(v, d){ var k = Math.pow(10, d); return Number.isFinite(v) ? Math.round(v * k) / k : null; }

  // Veri sayfasının sütunları (1 tabanlı): No · taranan grupların tipi · dört kriter ·
  // Dört kriter · TR · statik sehim · frekans payı · mod f · mod tipi · yük durumları.
  function veriSutun(E){
    var T = E.tarama, V = T.veri, nG = T.gruplar.length, nM = V.nM, nV = V.vakaAdlari.length, c = 2;
    var o = { no:1, tip:[], k:[], modF:[], modAd:[], vaka:[] };
    for(var i = 0; i < nG; i++) o.tip.push(c++);
    for(i = 0; i < 4; i++) o.k.push(c++);
    o.dort = c++; o.T = c++; o.d = c++; o.pay = c++;
    for(i = 0; i < nM; i++) o.modF.push(c++);
    for(i = 0; i < nM; i++) o.modAd.push(c++);
    for(i = 0; i < nV; i++) o.vaka.push(c++);
    o.son = c - 1;
    return o;
  }
  function veriSatiri(E, i){
    var T = E.tarama, V = T.veri, x = T.satirlar[i], nM = V.nM, nV = V.vakaAdlari.length, nT = V.nT;
    var f = (x.f || []).slice().sort(function(a, b){ return a - b; }), k = x.k || [];
    var L = [i + 1];
    T.gruplar.forEach(function(g, j){ L.push(temiz(x.tipler[j])); });
    for(var j = 0; j < 4; j++) L.push(k[j] ? '✓' : '✗');   // metin: belgenin ✓/✗ işareti
    L.push(k.length === 4 && k.every(Boolean) ? 'Uygun' : '—');
    L.push(yuvarla(x.T * 100, 4), yuvarla(x.d, 3), yuvarla(frekansPayi(f, E.fAtes), 3));
    for(j = 0; j < nM; j++) L.push(yuvarla(V.modF[i * nM + j], 3));
    for(j = 0; j < nM; j++){ var a = V.modAd[i * nM + j]; L.push(a < V.modAdlar.length ? modAdi(V.modAdlar[a]) : ''); }
    for(var q = 0; q < nV; q++){
      var b = ((i * nV + q) * nT) * 3, p = [];
      for(var e = 0; e < nT * 3; e++){ var z = V.kod[b + e]; p.push(z === BOS ? '' : String(z)); }
      L.push(p.join(';'));
    }
    return L;
  }
  function veri(E){
    var T = E.tarama, V = T.veri, C = veriSutun(E), bas = [];
    var G = T.gruplar.map(function(g){ return kok(E.gruplar[g]); });
    bas[C.no - 1] = 'No';
    G.forEach(function(g, j){ bas[C.tip[j] - 1] = g; });
    ['Kriter 1', '1a', '1b', '2'].forEach(function(t, j){ bas[C.k[j] - 1] = t; });
    bas[C.dort - 1] = 'Dört kriter'; bas[C.T - 1] = 'TR [%]'; bas[C.d - 1] = 'Statik sehim [mm]'; bas[C.pay - 1] = 'Frekans payı [Hz]';
    C.modF.forEach(function(c, j){ bas[c - 1] = 'Mod ' + (j + 1) + ' [Hz]'; });
    C.modAd.forEach(function(c, j){ bas[c - 1] = 'Mod ' + (j + 1) + ' tipi'; });
    C.vaka.forEach(function(c, q){ bas[c - 1] = V.vakaAdlari[q] + ' [mm/100]'; });
    return { ad:'Veri', gizli:true, akis:{ n:T.satirlar.length + 1, satir:function(i){ return i ? veriSatiri(E, i - 1) : bas; } } };
  }

  // Blokun satırları: başlık b, düğmeler b+2, tablo b+4'ten (tip · ad · X/Y/Z), yük durumları
  // b+7'den, modlar dört satır sonra, TR modlardan üç satır sonra.
  function blokBoyu(E, k){
    var V = (k.vakalar || []).length, M = Math.max((k.modlar || []).length, 1);
    return 7 + V + 4 + M + 3 + 1;
  }
  function blokTablo(S, E, b, tipHucre, vakaHucre, V, modlar, trHucre){
    var TK = E.takozlar;
    TK.forEach(function(t, i){
      var c0 = 4 + 4 * i;
      S.hucre.push([b + 4, c0, tipHucre(i), { yatay:'center', dikey:'center' }]);
      birles(S, b + 4, c0, c0 + 2);
      for(var j = 0; j < 3; j++){
        S.hucre.push([b + 5, c0 + j, j ? '' : kok(t.ad), BAS1]);
        S.hucre.push([b + 6, c0 + j, 'XYZ'.charAt(j), BAS1]);
      }
      birles(S, b + 5, c0, c0 + 2);
    });
    V.forEach(function(ad, q){
      var r = b + 7 + q;
      S.hucre.push([r, 3, ad, BAS1]);
      TK.forEach(function(t, i){
        for(var j = 0; j < 3; j++) S.hucre.push([r, 4 + 4 * i + j, vakaHucre(q, i, j), sayiStil('0.0')]);
      });
    });
    var mh = b + 7 + V.length + 4;
    S.hucre.push([mh, 2, 'Mod', BAS1], [mh, 3, 'Mod Tipi', BAS1], [mh, 4, 'Hz', BAS1]);
    modlar.forEach(function(m, i){
      S.hucre.push([mh + 1 + i, 2, i + 1, BAS1], [mh + 1 + i, 3, m[0], HUC], [mh + 1 + i, 4, m[1], sayiStil('0.00')]);
    });
    var tr_ = mh + Math.max(modlar.length, 1) + 3;
    S.hucre.push([tr_, 2, 'TR (%)', HUC], [tr_, 3, trHucre, sayiStil('0.00')]);
    return tr_;
  }
  // K bloku: çözümün değerleri (formülsüz).
  function kBlok(S, E, k, n, b, capa){
    var G = E.gruplar.map(kok);
    S.satir[b - 1] = 30; S.satir[b] = 24; S.satir[b + 2] = 22;
    S.hucre.push([b, 3, 'K' + k.K + ' — ' + G.map(function(g, i){ return g + ': ' + temiz(k.tipler[i] || '—'); }).join(' · '), BASLIK]);
    var TK = E.takozlar, son = TK.length < 2 ? 8 : 4 + 4 * (TK.length - 1);
    S.hucre.push([b + 2, 3, '← Özet sayfasına dön', DUGME]); S.bag.push([b + 2, 3, 'Özet', 'A1']);
    if(n > 0){
      for(var c = 4; c <= 6; c++) S.hucre.push([b + 2, c, c === 4 ? '← Geri konfigürasyon (K' + E.konfig[n - 1].K + ')' : '', DUGME]);
      birles(S, b + 2, 4, 6); S.bag.push([b + 2, 4, 'Sonuç', capa[n - 1]]);
    }
    if(n < E.konfig.length - 1){
      for(c = son; c <= son + 2; c++) S.hucre.push([b + 2, c, c === son ? 'İleri konfigürasyon (K' + E.konfig[n + 1].K + ') →' : '', DUGME]);
      birles(S, b + 2, son, son + 2); S.bag.push([b + 2, son, 'Sonuç', capa[n + 1]]);
    }
    var V = k.vakalar || [];
    var M = (k.modlar || []).slice().sort(function(a, b){ return a.f - b.f; });
    blokTablo(S, E, b, function(i){ return temiz((k.takozTip || [])[i] || ''); },
      function(q, i, j){ var d = (V[q].d || [])[i] || []; return Number.isFinite(d[j]) ? d[j] : ''; },
      V.map(function(v){ return v.ad; }), M.map(function(m){ return [modAdi(m.ad), m.f]; }),
      Number.isFinite(k.T) ? k.T * 100 : '');
  }
  // Pano: gösterilen No = girilen No (D7), girilmemişse Tarama süzgecinde kalan ilk satır
  // (D8: SUBTOTAL görünmeyen satırı saymaz). Değerler Veri'den INDEX ile; önbellek No 1'in.
  function pano(S, E){
    var T = E.tarama, V = T.veri, C = veriSutun(E), n = T.satirlar.length, nT = V.nT, nM = V.nM;
    var G = E.gruplar.map(kok), taranan = {};
    T.gruplar.forEach(function(g, j){ taranan[g] = j; });
    var rng = function(c){ var h = harf(c); return '\'Veri\'!$' + h + '$2:$' + h + '$' + (n + 1); };
    var idx = function(c){ return 'INDEX(' + rng(c) + ',$D$6)'; };
    var ilk = veriSatiri(E, 0);
    var oku = function(c){ return ilk[c - 1]; };
    S.satir[1] = 30; S.satir[2] = 24; S.satir[4] = 22;
    // başlık: No ve grupların tipi
    var parca = [], onb = [];
    E.gruplar.forEach(function(g, gi){
      var lit = '"' + fx(G[gi] + ': ') + '"';
      if(gi in taranan){ parca.push(lit + '&' + idx(C.tip[taranan[gi]])); onb.push(G[gi] + ': ' + oku(C.tip[taranan[gi]])); }
      else { var sabit = temiz((E.konfig[0] && E.konfig[0].tipler[gi]) || '—'); parca.push('"' + fx(G[gi] + ': ' + sabit) + '"'); onb.push(G[gi] + ': ' + sabit); }
    });
    S.hucre.push([2, 3, { f:'IFERROR("No "&$D$6&" — "&' + parca.join('&" · "&') + ',"")', v:'No 1 — ' + onb.join(' · ') }, BASLIK]);
    S.hucre.push([4, 3, '← Özet sayfasına dön', DUGME]); S.bag.push([4, 3, 'Özet', 'A1']);
    for(var c = 4; c <= 6; c++) S.hucre.push([4, c, c === 4 ? '← Tarama' : '', DUGME]);
    birles(S, 4, 4, 6); S.bag.push([4, 4, 'Tarama', 'A1']);
    // seçim
    var tA = '\'Tarama\'!$A$6:$A$' + (5 + n);
    S.hucre.push([6, 3, 'Gösterilen No', BAS1], [6, 4, { f:'IF(ISNUMBER($D$7),$D$7,$D$8)', v:1 }, KALIN]);
    S.hucre.push([7, 3, 'No', BAS1], [7, 4, '', GIRDI]);
    S.hucre.push([8, 3, 'Süzgecin ilk satırı', BAS1], [8, 4, { f:'IFERROR(INDEX(' + tA + ',MATCH(1,SUBTOTAL(103,OFFSET(\'Tarama\'!$A$6,ROW(' + tA
      + ')-ROW(\'Tarama\'!$A$6),0)),0)),"")', v:1, dizi:true }, HUC]);
    // kriterler
    var kr = [['Kriter 1', C.k[0], HUC], ['1a', C.k[1], HUC], ['1b', C.k[2], HUC], ['2', C.k[3], HUC], ['Dört kriter', C.dort, HUC],
      ['TR [%]', C.T, sayiStil('0.0')], ['Statik sehim [mm]', C.d, sayiStil('0.00')], ['Frekans payı [Hz]', C.pay, sayiStil('0.000')]];
    kr.forEach(function(x, j){
      S.hucre.push([10, 4 + j, x[0], BAS]);
      S.hucre.push([11, 4 + j, { f:'IFERROR(' + idx(x[1]) + ',"")', v:oku(x[1]) }, x[2]]);
    });
    // tablo: tip · ad · X/Y/Z 13–15, yük durumları 16'dan (blokTablo'nun b'si 9)
    var grupOf = E.takozlar.map(function(t){ return t.grup; });
    var uzun = function(gi){
      var A = (T.adaylar && T.adaylar[taranan[gi]]) || [];
      return A.reduce(function(m, a){ a = temiz(a); return a.length > m.length ? a : m; }, '');
    };
    var tipHucre = function(i){
      var gi = grupOf[i];
      if(gi in taranan) return { f:'IFERROR(' + idx(C.tip[taranan[gi]]) + ',"")', v:oku(C.tip[taranan[gi]]), olc:uzun(gi) };
      return temiz((E.konfig[0] && E.konfig[0].tipler[gi]) || '');
    };
    var ilkV = V.vakaAdlari.map(function(ad, q){ return String(oku(C.vaka[q]) || '').split(';'); });
    var W = pencereBoyu(V);
    var vakaHucre = function(q, i, j){
      var t = 3 * i + j, z = ilkV[q][t];
      return { f:'IFERROR(VALUE(TRIM(MID(SUBSTITUTE(' + idx(C.vaka[q]) + ',";",REPT(" ",' + W + ')),' + (t * W + 1) + ',' + W + ')))/100,"")',
               v:(z === '' || z == null) ? '' : Number(z) / 100 };
    };
    var modlar = [];
    for(var j = 0; j < nM; j++){
      modlar.push([{ f:'IFERROR(' + idx(C.modAd[j]) + ',"")', v:oku(C.modAd[j]) }, { f:'IFERROR(' + idx(C.modF[j]) + ',"")', v:oku(C.modF[j]) }]);
    }
    return blokTablo(S, E, 9, tipHucre, vakaHucre, V.vakaAdlari, modlar, { f:'IFERROR(' + idx(C.T) + ',"")', v:oku(C.T) });
  }
  function sonuc(E, capa){
    var S = { ad:'Sonuç', hucre:[], birlesik:[], bag:[], izgara:false, gizle:true, yakin:85, satir:{}, sutun:{} };
    var b = (E.tarama && E.tarama.veri && E.tarama.satirlar.length) ? pano(S, E) + 6 : 2;
    E.konfig.forEach(function(k, n){ capa[n] = 'C' + b; b += blokBoyu(E, k) + 2; });
    E.konfig.forEach(function(k, n){ kBlok(S, E, k, n, +capa[n].slice(1), capa); });
    var o = olc(S);
    S.sutun = o.sutun; Object.assign(S.satir, o.satir);
    return S;
  }

  // Dilimli kurulum (uzun iş arayüzü kilitlemez): adim() bir adım yapar — Özet ve
  // Sonuç, Tarama'nın başı, KAC satırı, sonu — ve iş yaptıysa true döner;
  // Veri'nin satırları yazılırken üretilir. kitap(E) adımların tek seferi.
  var KAC = 100;
  function kitapIs(E){
    var T = E.tarama, N = (T && T.satirlar) ? T.satirlar.length : 0, evre = 0, n = 0;
    var capa = [], OZ = null, SON = null, Z = null, TA = null;
    return {
      adim: function(){
        if(evre === 0){
          var adlar = E.konfig.map(function(k){ return sayfaAdi(k, k.tipler || []); });
          SON = sonuc(E, capa); OZ = ozet(E, adlar, capa);
          evre = N ? 4 : 3;
          return true;
        }
        if(evre === 4){ Z = taramaBasla(E); evre = 1; return true; }
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
        if(N && T.veri) sayfalar.push(veri(E));
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
