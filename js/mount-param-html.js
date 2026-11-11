// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ — PARAMETRİK ANALİZ · HTML RAPORU (DOM'suz kurucu)
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı kararı (2026-11-11): "Tamam, şimdi HTML raporunun temelini kur. Biz
// parametrik analiz konusunda bazı büyük değişiklikler yapacağız … sadece temel
// yapıyı oluştur yeter." TEMEL YAPI: tek dosya, çevrimdışı; Excel'in girdisinden
// kurulur (E — js/mount-param-excel.js'in başlığı), iki çıktı aynı sayıyı yazar.
// Belge OKUR, hesaplamaz: tıklanan konfigürasyonun sonucu gömülü veriden çizilir
// (Excel makrosuz bir tıkla değer taşıyamadığı için her bloğu hazır yazar).
//   Özet   — K0…Kn: grupların tipi, Uygunluk, statik sehim, dört kesin kriter,
//            frekans payı, TR, en düşük mod
//   Tarama — çözülen kombinasyonlar, Excel'in sırası (sağlanan kriter sayısı, sonra
//            statik sehim); sayı sütununun başlığı sıralar; 100'lük sayfa
//   Sonuç  — seçilen konfigürasyon: yük durumu × takoz × X/Y/Z sehim, modlar; geri ·
//            ileri; adres (#K1 · #T25) tarayıcının geri tuşuyla
// Sayı programın yazıcısıyla (js/sayi.js — kaynağı belgeye gömülür); yüz arayüzün
// gömülü yüzü (veThemeFontFaceCss). Veri <script type="application/json">'da; büyük
// diziler (Excel'in Veri kodu: sehim mm/100, modlar) ikili, base64.
// Kurulum dilimli (UZUN İŞ ARAYÜZÜ KİLİTLEMEZ): is(E).adim() … bitir() → belge.
// ═══════════════════════════════════════════════════════════════════════════

var veMntParamHtml = (function(){
  'use strict';

  var SAYI = (typeof veSayi === 'function') ? { veSayi:veSayi, veSayiUstel:veSayiUstel }
    : (typeof require === 'function' ? require('./sayi.js') : null);
  var XL = (typeof veMntParamExcel !== 'undefined') ? veMntParamExcel
    : (typeof require === 'function' ? require('./mount-param-excel.js') : null);
  function tr(x, d){ return SAYI ? SAYI.veSayi(x, d) : String(x); }

  var SAYFA = 100;                         // Tarama'nın bir sayfasındaki satır
  var PARCA = 3 * 16384;                   // base64'e bir çağrıda giden bayt (3'ün katı)
  var BOS32 = -2147483648, BOS16 = -32768;  // "sonuç yok" (Excel'in Veri tabanı · Int16 karşılığı)

  function yuv(v, n){
    if(!Number.isFinite(v)) return null;
    var p = Math.pow(10, n);
    return Math.round(v * p) / p;
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function b64(u8, a, b){
    var s = '';
    for(var i = a; i < b; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(b, i + 0x8000)));
    return btoa(s);
  }
  function tarih(d){
    var iki = function(n){ return (n < 10 ? '0' : '') + n; };
    return iki(d.getDate()) + '.' + iki(d.getMonth() + 1) + '.' + d.getFullYear();
  }
  // Kesin kriterlerin adı ve sınırı — Excel'in başlıklarıyla aynı.
  function kriterler(E){
    var trS = XL ? XL.trSinir(E) : 0.15;
    return [
      { ad:'Kriter 1', s:'Modal bant < ' + tr(E.fAtes / 2, 2) + ' Hz' },
      { ad:'Kriter 1a', s:'Mod ayrıklığı > 0,5 Hz' },
      { ad:'Kriter 1b', s:'8–10 Hz bandında mod yok' },
      { ad:'Kriter 2', s:'TR < %' + tr(trS * 100, 0) }
    ];
  }
  function temiz(s){ return XL ? XL.temiz(s) : String(s == null ? '' : s); }
  function kok(s){ return XL ? XL.kok(s) : String(s == null ? '' : s); }
  function modAdi(s){ return XL ? XL.modAdi(s) : String(s == null ? '' : s); }
  function pay(f, fAtes){ return XL ? XL.frekansPayi(f, fAtes) : NaN; }
  function bit(k){ var b = 0; (k || []).forEach(function(ok, j){ if(ok) b |= 1 << j; }); return b; }
  function enKucuk(f){ var s = (f || []).filter(Number.isFinite); return s.length ? Math.min.apply(null, s) : NaN; }

  // ── veri: belgeye giden model (JSON'a uygun; ikili diziler ayrı) ─────────
  function bas(E, opt){
    var T = E.tarama || {}, V = T.veri || null, L = T.satirlar || [];
    var D = {
      v:1, baslik:E.baslik || 'Takoz konfigürasyonları', tarih:tarih((opt && opt.tarih) || new Date()),
      fAtes:yuv(E.fAtes, 4), trSinir:XL ? XL.trSinir(E) : 0.15, rolanti:yuv(E.rolanti, 1), silindir:E.silindir || null,
      zeta:yuv(E.zeta, 4), kutle:yuv(E.kutle, 1),
      gruplar:(E.gruplar || []).map(kok), takozlar:(E.takozlar || []).map(function(t){ return { ad:kok(t.ad), grup:t.grup }; }),
      kriter:kriterler(E),
      konfig:(E.konfig || []).map(function(k){
        return { K:k.K, m:k.mevcut ? 1 : 0, tip:(k.tipler || []).map(temiz), u:k.uygunluk || '', k:bit(k.kriter),
          d:yuv(k.d, 4), T:yuv(k.T, 6), pay:yuv(pay(k.f, E.fAtes), 4), fMin:yuv(enKucuk(k.f), 4),
          tt:(k.takozTip || []).map(temiz),
          vaka:(k.vakalar || []).map(function(v){ return { ad:v.ad, d:(v.d || []).map(function(x){ return (x || []).map(function(y){ return yuv(y, 3); }); }) }; }),
          mod:(k.modlar || []).slice().sort(function(a, b){ return a.f - b.f; }).map(function(m){ return [yuv(m.f, 4), modAdi(m.ad)]; }) };
      }),
      tarama:null
    };
    if(L.length){
      var tg = T.gruplar || [];
      D.tarama = { N:T.N || L.length, n:L.length, gruplar:tg.slice(), adlar:tg.map(function(){ return []; }),
        tip:tg.map(function(){ return []; }), d:[], T:[], fB:[], k:[], pay:[],
        vaka:V ? V.vakaAdlari.slice() : [], nT:V ? V.nT : 0, nM:V ? V.nM : 0,
        modAdlar:V ? V.modAdlar.map(modAdi) : [], kod:null, modF:null, modAd:null };
    }
    return D;
  }
  // Tarama'nın n0…n1 satırları: tipler ad dizinine, sayılar yuvarlanmış.
  function satirlar(D, E, ix, n0, n1){
    var T = D.tarama, L = E.tarama.satirlar;
    for(var n = n0; n < n1; n++){
      var x = L[n];
      T.gruplar.forEach(function(g, j){
        var ad = temiz(x.tipler[j]), i = ix[j][ad];
        if(i === undefined){ i = ix[j][ad] = T.adlar[j].length; T.adlar[j].push(ad); }
        T.tip[j].push(i);
      });
      T.d.push(yuv(x.d, 4)); T.T.push(yuv(x.T, 6)); T.fB.push(yuv(x.fB, 4));
      T.k.push(bit(x.k)); T.pay.push(yuv(pay(x.f, E.fAtes), 4));
    }
  }
  // Excel'in Veri kodu (Int32, mm/100) Int16'ya sığıyorsa Int16.
  function kodDizisi(V){
    var k = V.kod, sig = true;
    for(var i = 0; i < k.length && sig; i++) if(k[i] !== BOS32 && (k[i] > 32767 || k[i] < -32767)) sig = false;
    if(!sig) return { t:'i32', a:k };
    var a = new Int16Array(k.length);
    for(var j = 0; j < k.length; j++) a[j] = k[j] === BOS32 ? BOS16 : k[j];
    return { t:'i16', a:a };
  }

  // ── belge ────────────────────────────────────────────────────────────────
  var CSS = [
    ':root{color-scheme:light;--kagit:#ffffff;--zemin:#f3f5f8;--ink:#1b2430;--soluk:#5a6573;--cizgi:#d6dbe2;',
    '  --cizgi-koyu:#aab3bf;--vurgu:#1d5fa6;--vurgu-zemin:#e7f0fa;--iyi:#1c6e3b;--iyi-zemin:#dcefe3;--kotu:#b42318;',
    "  --radius-sm:2px;--yuz:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;",
    '  --fs-kucuk:12px;--fs-govde:13px;--fs-h2:15px;--fs-h1:18px;}',
    '*{box-sizing:border-box}',
    'body{margin:0;background:var(--zemin);color:var(--ink);font-family:var(--yuz);font-size:var(--fs-govde);line-height:1.45;',
    '  font-variant-numeric:tabular-nums}',
    'header{background:var(--kagit);border-bottom:1px solid var(--cizgi);padding:16px 24px 0}',
    'h1{margin:0;font-size:var(--fs-h1);font-weight:600}',
    '.kunye{margin:4px 0 12px;color:var(--soluk)}',
    'nav{display:flex;gap:0}',
    'nav a{padding:8px 14px;color:var(--soluk);text-decoration:none;border-bottom:2px solid transparent;font-weight:500}',
    'nav a:hover{color:var(--ink)}',
    'nav a[aria-current="page"]{color:var(--vurgu);border-bottom-color:var(--vurgu)}',
    'main{padding:16px 24px 32px}',
    'section[hidden]{display:none}',
    'h2{margin:0 0 10px;font-size:var(--fs-h2);font-weight:600}',
    'h3{margin:18px 0 8px;font-size:var(--fs-govde);font-weight:600}',
    '.kap{background:var(--kagit);border:1px solid var(--cizgi);overflow-x:auto}',
    'table{border-collapse:collapse;width:100%}',
    'th,td{padding:5px 10px;border-bottom:1px solid var(--cizgi);text-align:right;white-space:nowrap}',
    'th{background:var(--zemin);font-weight:600;color:var(--ink);position:sticky;top:0}',
    'th.sol,td.sol{text-align:left}',
    'th[data-sira]{cursor:pointer}',
    'th[aria-sort="ascending"]::after{content:" \\2191"}',
    'th[aria-sort="descending"]::after{content:" \\2193"}',
    'tbody tr[data-s]{cursor:pointer}',
    'tbody tr[data-s]:hover td{background:var(--vurgu-zemin)}',
    'td a{color:var(--vurgu);text-decoration:none;font-weight:600}',
    '.ok{color:var(--iyi);font-weight:600}',
    '.no{color:var(--kotu);font-weight:600}',
    'td.u-en{background:var(--iyi);color:#ffffff;font-weight:600}',
    'td.u-uy{background:var(--iyi-zemin)}',
    '.arac{display:flex;align-items:center;gap:8px;margin:0 0 10px;flex-wrap:wrap}',
    '.arac .bosluk{flex:1}',
    'button,.dugme{font:inherit;color:var(--ink);background:var(--kagit);border:1px solid var(--cizgi-koyu);',
    '  border-radius:var(--radius-sm);padding:4px 10px;cursor:pointer;text-decoration:none;display:inline-block}',
    'button:hover,.dugme:hover{border-color:var(--vurgu);color:var(--vurgu)}',
    'button[disabled]{color:var(--soluk);border-color:var(--cizgi);cursor:default}',
    '.izgara{display:flex;flex-wrap:wrap;background:var(--kagit);border-top:1px solid var(--cizgi);',
    '  border-left:1px solid var(--cizgi);margin:0 0 4px}',
    '.izgara div{flex:1 1 150px;padding:6px 10px;border-right:1px solid var(--cizgi);border-bottom:1px solid var(--cizgi)}',
    'th.grup{text-align:center}',
    'th.ayir,td.ayir{border-left:1px solid var(--cizgi)}',
    '.kap.dar{max-width:560px}',
    '.izgara b{display:block;font-weight:500;color:var(--soluk);font-size:var(--fs-kucuk)}',
    '.tipler{color:var(--soluk);margin:-4px 0 12px}',
    '.sayac{color:var(--soluk)}'
  ].join('\n');

  // Belgenin betiği: bu işlev KENDİ kaynağıyla belgeye yazılır (_sayfa.toString())
  // ve orada çalışır — programın değişkenlerine dokunmaz.
  function _sayfa(){
    var V = JSON.parse(document.getElementById('ve-veri').textContent), T = V.tarama;
    function cozu(x){
      if(!x) return null;
      var s = atob(x.b), u = new Uint8Array(s.length);
      for(var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      return x.t === 'i16' ? new Int16Array(u.buffer) : x.t === 'i32' ? new Int32Array(u.buffer)
        : x.t === 'u16' ? new Uint16Array(u.buffer) : new Float32Array(u.buffer);
    }
    var KOD = T ? cozu(T.kod) : null, MODF = T ? cozu(T.modF) : null, MODAD = T ? cozu(T.modAd) : null;
    var BOS = T && T.kod && T.kod.t === 'i16' ? -32768 : -2147483648;
    var $ = function(id){ return document.getElementById(id); };
    function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function s(v, d){ return veSayi(v == null ? NaN : v, d); }
    function yuzde(v){ return v == null || !isFinite(v) ? '—' : '%' + veSayi(v * 100, 1); }
    function tik(ok){ return ok ? '<span class="ok">✓</span>' : '<span class="no">✗</span>'; }
    function kriterHucre(b){ var h = ''; for(var j = 0; j < 4; j++) h += '<td>' + tik(b & (1 << j)) + '</td>'; return h; }
    function sag(b){ var n = 0; for(var j = 0; j < 4; j++) if(b & (1 << j)) n++; return n; }
    function kBas(){ return V.kriter.map(function(q){ return '<th title="' + esc(q.s) + '">' + esc(q.ad) + '</th>'; }).join(''); }
    var K1 = V.konfig.length > 1 ? 1 : 0;

    // ── Özet ──
    function ozet(){
      var h = '<table><thead><tr><th class="sol">K</th>'
        + V.gruplar.map(function(g){ return '<th class="sol">' + esc(g) + '</th>'; }).join('')
        + '<th class="sol">Uygunluk</th><th>Statik sehim [mm]</th>' + kBas()
        + '<th>Frekans payı [Hz]</th><th>TR [%]</th><th>En düşük mod [Hz]</th></tr></thead><tbody>';
      V.konfig.forEach(function(k, n){
        var u = k.u === 'En uygun' ? ' class="sol u-en"' : k.u === 'Uygun' ? ' class="sol u-uy"' : ' class="sol"';
        h += '<tr data-s="K' + n + '"><td class="sol"><a href="#K' + n + '">K' + k.K + '</a></td>'
          + V.gruplar.map(function(g, i){ return '<td class="sol">' + esc(k.tip[i] || '—') + '</td>'; }).join('')
          + '<td' + u + '>' + esc(k.u || '—') + '</td><td>' + s(k.d, 2) + '</td>' + kriterHucre(k.k)
          + '<td>' + s(k.pay, 3) + '</td><td>' + yuzde(k.T) + '</td><td>' + s(k.fMin, 2) + '</td></tr>';
      });
      $('ve-ozet').innerHTML = h + '</tbody></table>';
    }

    // ── Tarama ──
    var sira = [], anahtar = 'no', yon = 1, sayfa = 0, ADIM = T ? T.sayfa : 100;
    if(T) for(var i = 0; i < T.n; i++) sira.push(i);
    var DEGER = {
      no:function(i){ return i; }, d:function(i){ return T.d[i]; }, T:function(i){ return T.T[i]; },
      fB:function(i){ return T.fB[i]; }, sag:function(i){ return sag(T.k[i]); }, pay:function(i){ return T.pay[i]; }
    };
    function sirala(a){
      if(a === anahtar) yon = -yon; else { anahtar = a; yon = (a === 'sag' || a === 'pay') ? -1 : 1; }
      var f = DEGER[a];
      sira.sort(function(p, q){
        var x = f(p), y = f(q), xn = x == null || !isFinite(x), yn = y == null || !isFinite(y);
        if(xn || yn) return xn === yn ? p - q : (xn ? 1 : -1);
        return (x - y) * yon || p - q;
      });
      sayfa = 0; tarama();
    }
    function tipAdi(j, i){ return T.adlar[j][T.tip[j][i]]; }
    function tarama(){
      if(!T){ $('ve-tarama').innerHTML = ''; return; }
      var son = Math.ceil(T.n / ADIM) - 1;
      sayfa = Math.max(0, Math.min(son, sayfa));
      var a = sayfa * ADIM, b = Math.min(T.n, a + ADIM);
      var bs = function(k, ad, sol){
        return '<th data-sira="' + k + '"' + (sol ? ' class="sol"' : '') + (anahtar === k ? ' aria-sort="' + (yon > 0 ? 'ascending' : 'descending') + '"' : '') + '>' + ad + '</th>';
      };
      var h = '<div class="arac"><span class="sayac">' + s(a + 1, 0) + '–' + s(b, 0) + ' / ' + s(T.n, 0)
        + (T.N > T.n ? ' (' + s(T.N, 0) + ' kombinasyon)' : '') + '</span><span class="bosluk"></span>'
        + '<button type="button" data-sayfa="-1" aria-label="Önceki sayfa"' + (sayfa <= 0 ? ' disabled' : '') + '>‹</button>'
        + '<span class="sayac">' + s(sayfa + 1, 0) + ' / ' + s(son + 1, 0) + '</span>'
        + '<button type="button" data-sayfa="1" aria-label="Sonraki sayfa"' + (sayfa >= son ? ' disabled' : '') + '>›</button></div>'
        + '<div class="kap"><table><thead><tr>' + bs('no', 'No', true)
        + T.gruplar.map(function(g){ return '<th class="sol">' + esc(V.gruplar[g]) + '</th>'; }).join('')
        + bs('d', 'Statik sehim [mm]') + bs('T', 'TR [%]') + bs('fB', 'Zıplama f<sub>b</sub> [Hz]') + kBas()
        + bs('sag', 'Sağlanan') + bs('pay', 'Frekans payı [Hz]') + '</tr></thead><tbody>';
      for(var r = a; r < b; r++){
        var x = sira[r];
        h += '<tr data-s="T' + (x + 1) + '"><td class="sol"><a href="#T' + (x + 1) + '">' + s(x + 1, 0) + '</a></td>'
          + T.gruplar.map(function(g, j){ return '<td class="sol">' + esc(tipAdi(j, x)) + '</td>'; }).join('')
          + '<td>' + s(T.d[x], 2) + '</td><td>' + yuzde(T.T[x]) + '</td><td>' + s(T.fB[x], 2) + '</td>' + kriterHucre(T.k[x])
          + '<td>' + sag(T.k[x]) + ' / 4</td><td>' + s(T.pay[x], 3) + '</td></tr>';
      }
      $('ve-tarama').innerHTML = h + '</tbody></table></div>';
    }

    // ── Sonuç ──
    var secili = 'K' + K1;
    function konu(id){
      var m = /^([KT])(\d+)$/.exec(id || '');
      if(!m) return null;
      var n = +m[2];
      if(m[1] === 'K') return n < V.konfig.length ? { tur:'K', n:n } : null;
      return T && n >= 1 && n <= T.n ? { tur:'T', n:n - 1 } : null;
    }
    function k0Tip(g){ return (V.konfig[0] && V.konfig[0].tip[g]) || '—'; }
    function sonuc(){
      var c = konu(secili), h = '';
      if(!c){ $('ve-sonuc').innerHTML = ''; return; }
      var ad, tipG, tt, vaka, deger, modlar, ust, liste, yer, d, TR, fB, kb, pay_;
      if(c.tur === 'K'){
        var k = V.konfig[c.n];
        ad = 'K' + k.K + (k.m ? ' · Mevcut' : ''); tipG = k.tip; tt = k.tt; vaka = k.vaka.map(function(v){ return v.ad; });
        deger = function(q, m, a){ var x = (k.vaka[q].d[m] || [])[a]; return x == null ? NaN : x; };
        modlar = k.mod; d = k.d; TR = k.T; fB = null; kb = k.k; pay_ = k.pay;
        ust = ['#ozet', '← Özet']; liste = V.konfig.map(function(x, n){ return 'K' + n; }); yer = c.n;
      } else {
        var i = c.n, nV = T.vaka.length, nT = T.nT, nM = T.nM;
        ad = 'No ' + s(i + 1, 0);
        tipG = V.gruplar.map(function(g, gi){ var j = T.gruplar.indexOf(gi); return j >= 0 ? tipAdi(j, i) : k0Tip(gi); });
        tt = V.takozlar.map(function(t){ return tipG[t.grup]; }); vaka = T.vaka;
        deger = function(q, m, a){ var v = KOD[((i * nV + q) * nT + m) * 3 + a]; return v === BOS ? NaN : v / 100; };
        modlar = [];
        for(var j = 0; j < nM; j++){
          var f = MODF[i * nM + j], e = MODAD[i * nM + j];
          if(isFinite(f)) modlar.push([f, e === 65535 ? '' : T.modAdlar[e]]);
        }
        d = T.d[i]; TR = T.T[i]; fB = T.fB[i]; kb = T.k[i]; pay_ = T.pay[i];
        ust = ['#tarama', '← Tarama']; liste = sira.map(function(x){ return 'T' + (x + 1); }); yer = sira.indexOf(i);
      }
      var etiket = function(id){ var q = konu(id); return q.tur === 'K' ? 'K' + V.konfig[q.n].K : 'No ' + s(q.n + 1, 0); };
      var geri = yer > 0 ? liste[yer - 1] : null, ileri = yer < liste.length - 1 ? liste[yer + 1] : null;
      h += '<div class="arac"><a class="dugme" href="' + ust[0] + '">' + ust[1] + '</a><span class="bosluk"></span>'
        + (geri ? '<a class="dugme" href="#' + geri + '">← ' + etiket(geri) + '</a>' : '')
        + (ileri ? '<a class="dugme" href="#' + ileri + '">' + etiket(ileri) + ' →</a>' : '') + '</div>';
      h += '<h2>' + ad + '</h2><div class="tipler">'
        + V.gruplar.map(function(g, gi){ return esc(g) + ': ' + esc(tipG[gi] || '—'); }).join(' · ') + '</div>';
      var oz = [['Statik sehim [mm]', s(d, 2)], ['TR [%]', yuzde(TR)]];
      if(fB != null) oz.push(['Zıplama f<sub>b</sub> [Hz]', s(fB, 2)]);
      oz.push(['Frekans payı [Hz]', s(pay_, 3)]);
      if(c.tur === 'K') oz.unshift(['Uygunluk', esc(V.konfig[c.n].u || '—')]);
      V.kriter.forEach(function(q, j){ oz.push(['<span title="' + esc(q.s) + '">' + esc(q.ad) + '</span>', tik(kb & (1 << j))]); });
      h += '<div class="izgara">' + oz.map(function(x){ return '<div><b>' + x[0] + '</b>' + x[1] + '</div>'; }).join('') + '</div>';
      h += '<h3>Sehim [mm]</h3><div class="kap"><table><thead><tr><th class="sol" rowspan="2">Yük durumu</th>'
        + V.takozlar.map(function(t, m){ return '<th colspan="3" class="grup ayir" title="' + esc(tt[m] || '') + '">' + esc(t.ad) + '</th>'; }).join('')
        + '</tr><tr>' + V.takozlar.map(function(){ return '<th class="ayir">X</th><th>Y</th><th>Z</th>'; }).join('') + '</tr></thead><tbody>';
      vaka.forEach(function(va, q){
        h += '<tr><td class="sol">' + esc(va) + '</td>';
        for(var m = 0; m < V.takozlar.length; m++) for(var a = 0; a < 3; a++) h += '<td' + (a ? '' : ' class="ayir"') + '>' + s(deger(q, m, a), 2) + '</td>';
        h += '</tr>';
      });
      h += '</tbody></table></div><h3>Modlar</h3><div class="kap dar"><table><thead><tr><th class="sol">Mod</th>'
        + '<th class="sol">Mod tipi</th><th>f [Hz]</th></tr></thead><tbody>';
      modlar.forEach(function(md, j){ h += '<tr><td class="sol">' + (j + 1) + '</td><td class="sol">' + esc(md[1]) + '</td><td>' + s(md[0], 2) + '</td></tr>'; });
      $('ve-sonuc').innerHTML = h + '</tbody></table></div>';
    }

    // ── gezinme: adres → görünüm ──
    var GORUNUM = ['ozet', 'tarama', 'sonuc'];
    function goster(){
      var a = (location.hash || '').replace(/^#/, ''), g = 'ozet';
      if(konu(a)){ secili = a; g = 'sonuc'; sonuc(); }
      else if(a === 'tarama' || a === 'sonuc') g = a;
      if(g === 'sonuc' && !konu(a)) sonuc();
      GORUNUM.forEach(function(x){
        $('v-' + x).hidden = x !== g;
        var l = $('n-' + x);
        if(x === g) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
      });
      if(typeof window.scrollTo === 'function' && !/jsdom/i.test(navigator.userAgent)) window.scrollTo(0, 0);
    }
    document.addEventListener('click', function(e){
      var t = e.target;
      var th = t.closest && t.closest('th[data-sira]');
      if(th){ sirala(th.getAttribute('data-sira')); return; }
      var sb = t.closest && t.closest('button[data-sayfa]');
      if(sb){ sayfa += +sb.getAttribute('data-sayfa'); tarama(); return; }
      var tr_ = t.closest && t.closest('tr[data-s]');
      if(tr_ && !(t.closest && t.closest('a'))){ location.hash = '#' + tr_.getAttribute('data-s'); goster(); }
    });
    window.addEventListener('hashchange', goster);
    ozet(); tarama(); sonuc(); goster();
    window.veRapor = { goster:goster, sirala:sirala, secili:function(){ return secili; } };
  }

  // ── iş: dilimli kurulum ──────────────────────────────────────────────────
  // adim() bir parça işler, iş sürüyorsa true döner; bitir() belgeyi verir.
  function is(E, opt){
    opt = opt || {};
    var D = bas(E, opt), T = D.tarama, L = (E.tarama && E.tarama.satirlar) || [], V = (E.tarama && E.tarama.veri) || null;
    var ix = T ? T.gruplar.map(function(){ return {}; }) : [], n = 0;
    var ikili = [], parca = [];          // [{ ad, t, u8 }] · base64 parçaları
    var evre = T ? 0 : 3, k = 0, a = 0, ROW = 2000;
    function ekle(ad, t, dizi){ ikili.push({ ad:ad, t:t, u8:new Uint8Array(dizi.buffer, dizi.byteOffset, dizi.byteLength) }); parca.push([]); }
    function adim(){
      if(evre === 0){                     // Tarama satırları
        var b = Math.min(L.length, n + ROW);
        satirlar(D, E, ix, n, b); n = b;
        if(n >= L.length){
          T.sayfa = SAYFA;
          if(V){
            var kd = kodDizisi(V);
            ekle('kod', kd.t, kd.a);
            var mf = new Float32Array(V.modF.length);
            for(var j = 0; j < V.modF.length; j++) mf[j] = V.modF[j];
            ekle('modF', 'f32', mf);
            ekle('modAd', 'u16', V.modAd);
          }
          evre = ikili.length ? 1 : 3;
        }
        return true;
      }
      if(evre === 1){                     // ikili diziler → base64, parça parça
        var x = ikili[k], son = Math.min(x.u8.length, a + 8 * PARCA);
        for(var p = a; p < son; p += PARCA) parca[k].push(b64(x.u8, p, Math.min(son, p + PARCA)));
        a = son;
        if(a >= x.u8.length){ k++; a = 0; if(k >= ikili.length) evre = 3; }
        return true;
      }
      return false;
    }
    function oran(){
      if(evre === 3) return 1;
      if(evre === 0) return L.length ? 0.2 * n / L.length : 0.2;
      var top = 0, bit_ = 0;
      ikili.forEach(function(x, i){ top += x.u8.length; if(i < k) bit_ += x.u8.length; });
      return 0.2 + 0.8 * (top ? (bit_ + a) / top : 1);
    }
    // Belge PARÇA PARÇA: base64 parçaları birleştirilmez (indirici onları dilim dilim
    // dosyaya katar — tek görevde birleşik belge ve UTF-8 kodlaması 88 ms tutuyordu).
    function parcalar(){
      while(adim()){ /* kalan */ }
      ikili.forEach(function(x, i){ T[x.ad] = { t:x.t, b:'@@B' + i + '@@' }; });
      var json = JSON.stringify(D).replace(/</g, '\\u003c'), govde = [];
      json.split(/@@B(\d+)@@/).forEach(function(p, j){ if(j % 2) Array.prototype.push.apply(govde, parca[+p]); else govde.push(p); });
      var yuz = (typeof veThemeFontFaceCss === 'function') ? veThemeFontFaceCss() : '';
      var sayi = SAYI ? [SAYI.veSayi, SAYI.veSayiUstel].map(String).join('\n') : 'function veSayi(v){ return String(v); }';
      var T0 = D.tarama;
      var kunye = [
        'Ateşleme frekansı ' + tr(D.fAtes, 2) + ' Hz',
        D.rolanti ? 'Rölanti ' + tr(D.rolanti, 0) + ' dev/dk' : '',
        D.silindir ? tr(D.silindir, 0) + ' silindir' : '',
        Number.isFinite(D.zeta) ? 'ζ ' + tr(D.zeta, 3) : '',
        D.kutle > 0 ? 'Kütle ' + tr(D.kutle, 1) + ' kg' : '',
        T0 ? tr(T0.N, 0) + ' kombinasyon' : '',
        D.tarih
      ].filter(Boolean).join(' · ');
      var ust = '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n'
        + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        + '<title>' + esc(D.baslik) + '</title>\n<style>\n' + yuz + '\n' + CSS + '\n</style>\n</head>\n<body>\n'
        + '<header><h1>' + esc(D.baslik) + '</h1><div class="kunye">' + esc(kunye) + '</div>'
        + '<nav><a id="n-ozet" href="#ozet">Özet</a>' + (T0 ? '<a id="n-tarama" href="#tarama">Tarama</a>' : '<a id="n-tarama" href="#tarama" hidden>Tarama</a>')
        + '<a id="n-sonuc" href="#sonuc">Sonuç</a></nav></header>\n<main>\n'
        + '<section id="v-ozet"><div class="kap" id="ve-ozet"></div></section>\n'
        + '<section id="v-tarama" hidden><div id="ve-tarama"></div></section>\n'
        + '<section id="v-sonuc" hidden><div id="ve-sonuc"></div></section>\n</main>\n'
        + '<script type="application/json" id="ve-veri">';
      var alt = '<\/script>\n<script>\n' + sayi + '\n(' + _sayfa.toString() + ')();\n<\/script>\n</body>\n</html>\n';
      return [ust].concat(govde, [alt]);
    }
    function bitir(){ return parcalar().join(''); }
    return { adim:adim, oran:oran, parcalar:parcalar, bitir:bitir, veri:function(){ return D; } };
  }
  // Zaman uyumlu kurulum (test ve küçük tarama): bütün iş tek çağrıda.
  function belge(E, opt){ return is(E, opt).bitir(); }

  return { is:is, belge:belge, SAYFA:SAYFA };
})();

if(typeof module !== 'undefined' && module.exports){ module.exports = veMntParamHtml; }
