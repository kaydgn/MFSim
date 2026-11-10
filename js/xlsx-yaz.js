// ═══════════════════════════════════════════════════════════════════════════
// XLSX YAZICI — sıfır bağımlılık, saf JS (DOM'suz)
// ═══════════════════════════════════════════════════════════════════════════
//
// Okuyucunun (js/xlsx-read.js) karşılığı: programın ürettiği çalışma kitabı
// (Takoz · Parametrik Analiz'in Excel çıktısı) tek dosyaya gömülü ve
// çevrimdışı yazılır. Yalnız gereken alt küme: değer (sayı · metin), stil
// (yazı · dolgu · kenarlık · hizalama · sayı biçimi), sütun genişliği, satır
// yüksekliği, birleşik hücre, sayfa içi bağlantı, hücre notu, filtre, ızgara
// çizgisinin kapalı açılması, içeriğin dışında kalan satır ve sütunun gizli
// açılması, gizli sayfa, formül (önbellek değeriyle; kitap açılışta yeniden
// hesaplanır) ve satırı istendikçe üretilen büyük veri sayfası.
//
// KİTAP MODELİ
//   { sayfalar: [{
//       ad,                          // ≤ 31 karakter, [ ] : * ? / \ yok (temizlenir)
//       hucre: [[r, c, deger, stil]],// r, c 1 tabanlı; deger sayı | metin | formül
//       sutun: { c: genişlik },      // karakter birimi (Excel'in sütun genişliği)
//       satir: { r: yükseklik },     // pt
//       birlesik: ['D6:F6'],
//       bag: [[r, c, hedefSayfa, 'A1']],
//       not: [[r, c, metin, genişlikPx, yükseklikPx]],
//       filtre: 'A5:W581', izgara: false, gizle: true, yakin: 85,
//       gizli: true,                 // sayfa sekmesi gizli (formüller okur)
//       akis: { n, satir(i) → [deger] }   // hucre yerine: n satır, i. satırın değerleri
//   }] }
//   formül: { f:'IF(A1>0,1,0)', v:önbellek, dizi:true? } — '=' yazılmaz; dizi:
//     tek hücrelik dizi formülü (Ctrl+Shift+Enter karşılığı). Formül varsa
//     calcPr fullCalcOnLoad: Excel açılışta yeniden hesaplar.
//   akis: stilsiz, satırları sırayla yazılan sayfa (yüz binlerce hücre);
//     metin satır içi (inlineStr), sayı <v>.
//   stil: { b, boy, renk, alt, dolgu, kenar, yatay, dikey, sar, bicim }
//     renk/dolgu 'RRGGBB'; bicim '0.00' gibi sayı biçimi.
//   gizle: içeriğin son satırından ve son sütunundan BİR sonrası görünür,
//   ötesi gizli (sheetFormatPr zeroHeight + son sütundan sonrası hidden).
//
// ZIP: yerel başlık + merkezi dizin; sıkıştırmasız (stored) ya da varsa
// CompressionStream('deflate-raw') ile (zaman uyumsuz yol). Okuyucunun saf
// JS inflate'i ikisini de açar (gidiş-dönüş testi).
//
// DİLİMLİ YAZIM (is): sayfa XML'i parça parça üretilir; her parça UTF-8'e çevrilir,
// CRC'si yürür ve dosyanın sıkıştırıcısına yazılır — 13.824 satırlık kitap tek
// görevde 1,7 sn donduruyordu. Tek seferlik yollar (dosyalar, yaz) aynı üreteçten.
// ═══════════════════════════════════════════════════════════════════════════

var veXlsxYaz = (function(){
  'use strict';

  var NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  var NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
  var BAS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  // ── metin ────────────────────────────────────────────────────────────────
  // XML 1.0'da yasak denetim karakterleri atılır; satır sonu ve sekme kalır.
  function kac(s){
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var KODLAYICI = (typeof TextEncoder === 'function') ? new TextEncoder() : null;
  function utf8(s){
    if(KODLAYICI) return KODLAYICI.encode(String(s));
    var out = [], i, c;
    s = String(s);
    for(i = 0; i < s.length; i++){
      c = s.charCodeAt(i);
      if(c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length){
        var d = s.charCodeAt(i + 1);
        if(d >= 0xDC00 && d <= 0xDFFF){ c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; }
      }
      if(c < 0x80) out.push(c);
      else if(c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if(c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }

  // ── hücre adresi ─────────────────────────────────────────────────────────
  function harf(c){ var s = ''; while(c > 0){ var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
  function adres(r, c){ return harf(c) + r; }
  function sayfaAdi(ad, kullanilan){
    var s = String(ad == null ? '' : ad).replace(/[\[\]:*?\/\\]/g, ' ').replace(/^'+|'+$/g, '').trim() || 'Sayfa';
    s = s.slice(0, 31);
    var k = 2, aday = s;
    while(kullanilan[aday.toLocaleLowerCase('tr')]){ var ek = ' (' + k++ + ')'; aday = s.slice(0, 31 - ek.length) + ek; }
    kullanilan[aday.toLocaleLowerCase('tr')] = true;
    return aday;
  }
  // Sayfa içi bağlantının hedefi: 'Ad'!A1 (tırnak içindeki ' iki kez).
  function konum(ad, hucre){ return '\'' + String(ad).replace(/'/g, '\'\'') + '\'!' + (hucre || 'A1'); }

  // ── stiller ──────────────────────────────────────────────────────────────
  // Yazı, dolgu, kenarlık ve hücre biçimi tekilleştirilir; 0 sırası Excel'in
  // varsayılanı (Calibri 11, dolgusuz, kenarsız). 1 sıralı dolgu gray125 —
  // Excel bu iki dolgunun yerinde olmasını bekler.
  var YERLESIK = { 'General':0, '0':1, '0.00':2, '#,##0':3, '#,##0.00':4 };
  function stilKaydi(){
    var yazi = ['b0|11||0'], dolgu = ['', 'gray125'], bicim = {}, xf = ['0|0|0|0||||'], dizin = {}, bicimSira = 164;
    function yaziNo(s){
      var k = (s.b ? 'b1' : 'b0') + '|' + (s.boy || 11) + '|' + (s.renk || '') + '|' + (s.alt ? 1 : 0);
      var i = yazi.indexOf(k); if(i < 0){ yazi.push(k); i = yazi.length - 1; } return i;
    }
    function dolguNo(s){
      if(!s.dolgu) return 0;
      var i = dolgu.indexOf(s.dolgu); if(i < 0){ dolgu.push(s.dolgu); i = dolgu.length - 1; } return i;
    }
    function bicimNo(s){
      var f = s.bicim || 'General';
      if(f in YERLESIK) return YERLESIK[f];
      if(!(f in bicim)) bicim[f] = bicimSira++;
      return bicim[f];
    }
    function no(s){
      if(!s) return 0;
      var k = [bicimNo(s), yaziNo(s), dolguNo(s), s.kenar ? 1 : 0, s.yatay || '', s.dikey || '', s.sar ? 1 : '', ''].join('|');
      if(k in dizin) return dizin[k];
      xf.push(k); dizin[k] = xf.length - 1;
      return xf.length - 1;
    }
    function xml(){
      var h = BAS + '<styleSheet xmlns="' + NS_MAIN + '">';
      var fk = Object.keys(bicim);
      if(fk.length) h += '<numFmts count="' + fk.length + '">' + fk.map(function(f){
        return '<numFmt numFmtId="' + bicim[f] + '" formatCode="' + kac(f) + '"/>'; }).join('') + '</numFmts>';
      h += '<fonts count="' + yazi.length + '">' + yazi.map(function(k){
        var p = k.split('|');
        return '<font>' + (p[0] === 'b1' ? '<b/>' : '') + (p[3] === '1' ? '<u/>' : '') + '<sz val="' + p[1] + '"/>'
          + '<color rgb="FF' + (p[2] || '000000') + '"/><name val="Calibri"/><family val="2"/></font>';
      }).join('') + '</fonts>';
      h += '<fills count="' + dolgu.length + '">' + dolgu.map(function(d, i){
        if(i === 0) return '<fill><patternFill patternType="none"/></fill>';
        if(i === 1) return '<fill><patternFill patternType="gray125"/></fill>';
        return '<fill><patternFill patternType="solid"><fgColor rgb="FF' + d + '"/><bgColor indexed="64"/></patternFill></fill>';
      }).join('') + '</fills>';
      var ince = '<color rgb="FF000000"/>';
      h += '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'
        + '<border><left style="thin">' + ince + '</left><right style="thin">' + ince + '</right><top style="thin">' + ince
        + '</top><bottom style="thin">' + ince + '</bottom><diagonal/></border></borders>';
      h += '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>';
      h += '<cellXfs count="' + xf.length + '">' + xf.map(function(k, i){
        var p = k.split('|');
        if(i === 0) return '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>';
        var hiz = (p[4] || p[5] || p[6] === '1')
          ? '<alignment' + (p[4] ? ' horizontal="' + p[4] + '"' : '') + (p[5] ? ' vertical="' + p[5] + '"' : '')
            + (p[6] === '1' ? ' wrapText="1"' : '') + '/>' : '';
        return '<xf numFmtId="' + p[0] + '" fontId="' + p[1] + '" fillId="' + p[2] + '" borderId="' + p[3] + '" xfId="0"'
          + (p[0] !== '0' ? ' applyNumberFormat="1"' : '') + (p[1] !== '0' ? ' applyFont="1"' : '')
          + (p[2] !== '0' ? ' applyFill="1"' : '') + (p[3] !== '0' ? ' applyBorder="1"' : '')
          + (hiz ? ' applyAlignment="1">' + hiz + '</xf>' : '/>');
      }).join('') + '</cellXfs>';
      h += '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
      return h;
    }
    return { no:no, xml:xml };
  }

  // ── paylaşılan metin ─────────────────────────────────────────────────────
  function metinKaydi(){
    var L = [], dizin = {}, adet = 0;
    return {
      no:function(s){ adet++; s = String(s); if(!(s in dizin)){ dizin[s] = L.length; L.push(s); } return dizin[s]; },
      xml:function(){
        return BAS + '<sst xmlns="' + NS_MAIN + '" count="' + adet + '" uniqueCount="' + L.length + '">'
          + L.map(function(s){ return '<si><t xml:space="preserve">' + kac(s) + '</t></si>'; }).join('') + '</sst>';
      }
    };
  }

  // ── sayfa ────────────────────────────────────────────────────────────────
  function sayi(v){ return Number.isFinite(v) ? String(v) : null; }
  function formulMu(v){ return !!(v && typeof v === 'object' && typeof v.f === 'string'); }
  // Formül hücresi: önbellek değeri metinse t="str", sayıysa türsüz; yoksa <v> yazılmaz.
  function formulXml(ref, so, F){
    var v = F.v, t = typeof v === 'string' ? ' t="str"' : (typeof v === 'boolean' ? ' t="b"' : '');
    var f = '<f' + (F.dizi ? ' t="array" ref="' + ref + '"' : '') + '>' + kac(F.f) + '</f>';
    var deger = '';
    if(typeof v === 'string') deger = '<v>' + kac(v) + '</v>';
    else if(typeof v === 'boolean') deger = '<v>' + (v ? 1 : 0) + '</v>';
    else if(typeof v === 'number' && sayi(v) !== null) deger = '<v>' + sayi(v) + '</v>';
    return '<c r="' + ref + '"' + so + t + '>' + f + deger + '</c>';
  }
  // ── sayfa üreteci ────────────────────────────────────────────────────────
  // Sayfanın XML'i PARÇA PARÇA: sonraki() en çok ~PARCA karakterlik parça döndürür
  // ('' = bu adımda çıktı yok, sürüyor; null = bitti). Dilimli yazımın (is) ve tek
  // seferlik yazımın (dosyalar) ortak yolu — ikisinin çıktısı bayt bayt aynı.
  var PARCA = 1 << 17;                       // ~128 K karakter: bir parçanın üretimi, kodlaması ve sıkıştırması birkaç ms
  var GRUP = 50000;                          // bir adımda satırına dağıtılan hücre
  function sayfaUretec(S, ilk, stil, metin, notVar, durum){
    if(S.akis) return akisUretec(S);
    var H = S.hucre || [], satirlar = {}, sonR = 1, sonC = 1, gi = 0, evre = 0, r = 1, gorR = 1;
    var gizle = !!S.gizle, yuk = S.satir || {};
    function grupla(){
      for(var son = Math.min(H.length, gi + GRUP); gi < son; gi++){
        var h = H[gi], rr = h[0], c = h[1];
        (satirlar[rr] || (satirlar[rr] = [])).push(h);
        if(rr > sonR) sonR = rr;
        if(c > sonC) sonC = c;
      }
      return gi >= H.length;
    }
    function bas(){
      (S.birlesik || []).forEach(function(b){
        var m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(b);
        if(!m) return;
        var c2 = 0; for(var i = 0; i < m[3].length; i++) c2 = c2 * 26 + (m[3].charCodeAt(i) - 64);
        if(+m[4] > sonR) sonR = +m[4];
        if(c2 > sonC) sonC = c2;
      });
      gorR = gizle ? sonR + 1 : sonR;
      var h = BAS + '<worksheet xmlns="' + NS_MAIN + '" xmlns:r="' + NS_R + '">';
      h += '<dimension ref="A1:' + adres(sonR, sonC) + '"/>';
      var yakin = S.yakin && S.yakin !== 100 ? ' zoomScale="' + S.yakin + '" zoomScaleNormal="' + S.yakin + '"' : '';
      h += '<sheetViews><sheetView workbookViewId="0"' + (ilk ? ' tabSelected="1"' : '') + (S.izgara === false ? ' showGridLines="0"' : '')
        + yakin + '/></sheetViews>';
      h += '<sheetFormatPr defaultRowHeight="15"' + (gizle ? ' zeroHeight="1"' : '') + '/>';
      var sut = S.sutun || {}, ck = Object.keys(sut).map(Number).filter(function(c){ return c >= 1; }).sort(function(a, b){ return a - b; });
      if(ck.length || gizle){
        h += '<cols>';
        ck.forEach(function(c){
          if(gizle && c > sonC + 1) return;
          h += '<col min="' + c + '" max="' + c + '" width="' + (+sut[c]).toFixed(4) + '" customWidth="1"/>';   // makine: XML özniteliği
        });
        if(gizle && sonC + 2 <= 16384) h += '<col min="' + (sonC + 2) + '" max="16384" width="9.140625" hidden="1"/>';
        h += '</cols>';
      }
      return h + '<sheetData>';
    }
    function satirXml(r){
      var L = satirlar[r], ht = yuk[r];
      if(!L && !gizle && ht == null) return '';
      var ozn = ' r="' + r + '"' + ((ht != null || gizle) ? ' ht="' + (ht != null ? ht : 15) + '" customHeight="1"' : '');
      if(!L) return '<row' + ozn + '/>';
      L.sort(function(a, b){ return a[1] - b[1]; });
      var h = '<row' + ozn + '>';
      L.forEach(function(x){
        var s = stil.no(x[3]), v = x[2], ref = adres(x[0], x[1]), so = s ? ' s="' + s + '"' : '';
        if(v === null || v === undefined || v === '') { h += '<c r="' + ref + '"' + so + '/>'; return; }
        if(formulMu(v)){ durum.formul = true; h += formulXml(ref, so, v); return; }
        if(typeof v === 'number'){
          var n = sayi(v);
          h += n === null ? '<c r="' + ref + '"' + so + '/>' : '<c r="' + ref + '"' + so + '><v>' + n + '</v></c>';
          return;
        }
        h += '<c r="' + ref + '"' + so + ' t="s"><v>' + metin.no(v) + '</v></c>';
      });
      return h + '</row>';
    }
    function son(){
      var h = '</sheetData>';
      if(S.filtre) h += '<autoFilter ref="' + S.filtre + '"/>';
      if(S.birlesik && S.birlesik.length) h += '<mergeCells count="' + S.birlesik.length + '">'
        + S.birlesik.map(function(b){ return '<mergeCell ref="' + b + '"/>'; }).join('') + '</mergeCells>';
      if(S.bag && S.bag.length) h += '<hyperlinks>' + S.bag.map(function(b){
        return '<hyperlink ref="' + adres(b[0], b[1]) + '" location="' + kac(konum(b[2], b[3])) + '"/>'; }).join('') + '</hyperlinks>';
      h += '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>';
      if(notVar) h += '<legacyDrawing r:id="rId2"/>';
      return h + '</worksheet>';
    }
    return {
      sonraki: function(){
        if(evre === 0){ if(!grupla()) return ''; evre = 1; return bas(); }
        if(evre === 1){
          var h = '';
          while(r <= gorR && h.length < PARCA) h += satirXml(r++);
          if(r > gorR) evre = 2;
          return h;
        }
        if(evre === 2){ evre = 3; return son(); }
        return null;
      },
      oran: function(){ return evre === 0 ? 0.1 * gi / Math.max(1, H.length) : (evre >= 2 ? 1 : 0.1 + 0.9 * (r - 1) / gorR); }
    };
  }
  // Satırı istendikçe üretilen sayfa: stil, birleşik hücre ve bağlantı yok; boyutun
  // son sütunu ilk satırın uzunluğu (akis.sutun verilirse o).
  function akisUretec(S){
    var A = S.akis, i = 0, evre = 0, ilkL = null;
    function satirXml(i){
      var L = (i === 0 ? ilkL : A.satir(i)) || [], r = i + 1, s = '<row r="' + r + '">';
      for(var c = 0; c < L.length; c++){
        var v = L[c];
        if(v === null || v === undefined || v === '') continue;
        if(typeof v === 'number'){
          var n = sayi(v);
          if(n !== null) s += '<c r="' + adres(r, c + 1) + '"><v>' + n + '</v></c>';
        } else s += '<c r="' + adres(r, c + 1) + '" t="inlineStr"><is><t>' + kac(v) + '</t></is></c>';
      }
      return s + '</row>';
    }
    return {
      sonraki: function(){
        if(evre === 0){
          ilkL = A.n > 0 ? (A.satir(0) || []) : [];
          evre = 1;
          return BAS + '<worksheet xmlns="' + NS_MAIN + '" xmlns:r="' + NS_R + '">'
            + '<dimension ref="A1:' + adres(Math.max(1, A.n), Math.max(1, A.sutun || ilkL.length)) + '"/>'
            + '<sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>';
        }
        if(evre === 1){
          var h = '';
          while(i < A.n && h.length < PARCA) h += satirXml(i++);
          if(i >= A.n) evre = 2;
          return h;
        }
        if(evre === 2){
          evre = 3;
          return '</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';
        }
        return null;
      },
      oran: function(){ return A.n ? i / A.n : 1; }
    };
  }
  // Tek parçalık dosya: üretimi sırası gelince (sayfalardan sonra yazılanlar
  // — stiller, paylaşılan metin, kitap — sayfaların kaydını okur).
  function tekUretec(f){
    var bitti = false;
    return { sonraki: function(){ if(bitti) return null; bitti = true; return f(); }, oran: function(){ return bitti ? 1 : 0; } };
  }
  function notXml(S){
    return BAS + '<comments xmlns="' + NS_MAIN + '"><authors><author>MFSim</author></authors><commentList>'
      + S.not.map(function(n){
        return '<comment ref="' + adres(n[0], n[1]) + '" authorId="0"><text><r><rPr><sz val="9"/><color rgb="FF000000"/>'
          + '<rFont val="Tahoma"/><family val="2"/></rPr><t xml:space="preserve">' + kac(n[2]) + '</t></r></text></comment>';
      }).join('') + '</commentList></comments>';
  }
  // Not kutusu (VML): Excel'in kendi yazdığı biçim; konum Anchor'da, boyut stilde.
  function vmlXml(S, sayfaNo){
    var h = '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"'
      + ' xmlns:x="urn:schemas-microsoft-com:office:excel">'
      + '<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="' + sayfaNo + '"/></o:shapelayout>'
      + '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe">'
      + '<v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>';
    S.not.forEach(function(n, k){
      var w = n[3] || 330, y = n[4] || 100, r0 = n[0] - 1, c0 = n[1] - 1;
      h += '<v:shape id="_x0000_s' + (sayfaNo * 1024 + 1 + k) + '" type="#_x0000_t202" style="position:absolute;'
        + 'margin-left:59.25pt;margin-top:1.5pt;width:' + Math.round(w * 0.75) + 'pt;height:' + Math.round(y * 0.75) + 'pt;'
        + 'z-index:' + (k + 1) + ';visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto">'
        + '<v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/>'
        + '<v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox>'
        + '<x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/>'
        + '<x:Anchor>' + (c0 + 1) + ', 15, ' + Math.max(0, r0 - 1) + ', 10, ' + (c0 + 4) + ', 15, ' + (r0 + 6) + ', 4</x:Anchor>'
        + '<x:AutoFill>False</x:AutoFill><x:Row>' + r0 + '</x:Row><x:Column>' + c0 + '</x:Column></x:ClientData></v:shape>';
    });
    return h + '</xml>';
  }

  // ── kitap → dosyalar ─────────────────────────────────────────────────────
  // Plan: dosyalar ÜRETİM sırasıyla (önce sayfalar ve notları; stiller, paylaşılan
  // metin ve kitap sayfaların kaydını okuduğu için sonra) ve ZIP'in sırası (Excel'in
  // beklediği: içerik türleri başta).
  function plan(kitap){
    var stil = stilKaydi(), metin = metinKaydi(), kul = {}, durum = { formul:false };
    var S = (kitap.sayfalar || []).map(function(s){ return Object.assign({}, s, { ad:sayfaAdi(s.ad, kul) }); });
    if(!S.length) throw new Error('Sayfa yok');
    var adEsle = {};
    (kitap.sayfalar || []).forEach(function(s, i){ adEsle[s.ad] = S[i].ad; });
    S.forEach(function(s){ if(s.bag) s.bag = s.bag.map(function(b){ return [b[0], b[1], adEsle[b[2]] || b[2], b[3]]; }); });
    var F = [], notNo = 0, tur = [];
    S.forEach(function(s, i){
      var notVar = !!(s.not && s.not.length);
      F.push({ yol:'xl/worksheets/sheet' + (i + 1) + '.xml', uretec:sayfaUretec(s, i === 0, stil, metin, notVar, durum),
               agirlik:s.akis ? s.akis.n * 40 : (s.hucre || []).length });
      tur.push('<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
      if(notVar){
        var no = ++notNo;
        F.push({ yol:'xl/comments' + no + '.xml', uretec:tekUretec(function(){ return notXml(s); }) });
        F.push({ yol:'xl/drawings/vmlDrawing' + no + '.vml', uretec:tekUretec(function(){ return vmlXml(s, no); }) });
        F.push({ yol:'xl/worksheets/_rels/sheet' + (i + 1) + '.xml.rels', uretec:tekUretec(function(){
          return BAS + '<Relationships xmlns="' + NS_PKG + '">'
            + '<Relationship Id="rId1" Type="' + NS_R + '/comments" Target="../comments' + no + '.xml"/>'
            + '<Relationship Id="rId2" Type="' + NS_R + '/vmlDrawing" Target="../drawings/vmlDrawing' + no + '.vml"/>'
            + '</Relationships>'; }) });
        tur.push('<Override PartName="/xl/comments' + no + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>');
      }
    });
    function wb(){
      var tanim = [];
      S.forEach(function(s, i){
        if(!s.filtre) return;
        var m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(s.filtre);
        if(m) tanim.push('<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">'
          + kac(konum(s.ad, '$' + m[1] + '$' + m[2] + ':$' + m[3] + '$' + m[4])) + '</definedName>');
      });
      // Formül varsa kitap açılışta yeniden hesaplanır (önbellek değeri ilk görünüş içindir).
      return BAS + '<workbook xmlns="' + NS_MAIN + '" xmlns:r="' + NS_R + '"><bookViews><workbookView activeTab="0"/></bookViews><sheets>'
        + S.map(function(s, i){
          return '<sheet name="' + kac(s.ad) + '" sheetId="' + (i + 1) + '"' + (s.gizli && i > 0 ? ' state="hidden"' : '') + ' r:id="rId' + (i + 1) + '"/>';
        }).join('')
        + '</sheets>' + (tanim.length ? '<definedNames>' + tanim.join('') + '</definedNames>' : '')
        + (durum.formul ? '<calcPr calcId="191029" fullCalcOnLoad="1"/>' : '') + '</workbook>';
    }
    function wbr(){
      return BAS + '<Relationships xmlns="' + NS_PKG + '">'
        + S.map(function(s, i){ return '<Relationship Id="rId' + (i + 1) + '" Type="' + NS_R + '/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('')
        + '<Relationship Id="rId' + (S.length + 1) + '" Type="' + NS_R + '/styles" Target="styles.xml"/>'
        + '<Relationship Id="rId' + (S.length + 2) + '" Type="' + NS_R + '/sharedStrings" Target="sharedStrings.xml"/>'
        + '</Relationships>';
    }
    function ct(){
      return BAS + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        + tur.join('') + '</Types>';
    }
    function rels(){
      return BAS + '<Relationships xmlns="' + NS_PKG + '"><Relationship Id="rId1" Type="' + NS_R
        + '/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    }
    var BASI = [['[Content_Types].xml', ct], ['_rels/.rels', rels], ['xl/workbook.xml', wb], ['xl/_rels/workbook.xml.rels', wbr],
                ['xl/styles.xml', function(){ return stil.xml(); }], ['xl/sharedStrings.xml', function(){ return metin.xml(); }]];
    var uretim = F.concat(BASI.map(function(b){ return { yol:b[0], uretec:tekUretec(b[1]) }; }));
    uretim.forEach(function(d){ if(!(d.agirlik > 1)) d.agirlik = 1; });
    return { uretim:uretim, sira:BASI.map(function(b){ return b[0]; }).concat(F.map(function(d){ return d.yol; })) };
  }
  // Dönüş: [[yol, metin]] — ZIP'in girdileri, sırası Excel'in beklediği (tek seferlik yol).
  function dosyalar(kitap){
    var P = plan(kitap), M = {};
    P.uretim.forEach(function(d){ var h = '', p; while((p = d.uretec.sonraki()) !== null) h += p; M[d.yol] = h; });
    return P.sira.map(function(y){ return [y, M[y]]; });
  }

  // ── ZIP ──────────────────────────────────────────────────────────────────
  var CRC = (function(){
    var t = new Uint32Array(256);
    for(var n = 0; n < 256; n++){ var c = n; for(var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
  })();
  // CRC parça parça yürür: c = crcYuru(c, parça) — başlangıç 0xFFFFFFFF, son crcSon(c).
  function crcYuru(c, b){
    for(var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
    return c;
  }
  function crcSon(c){ return (c ^ 0xFFFFFFFF) >>> 0; }
  function crc32(b){ return crcSon(crcYuru(0xFFFFFFFF, b)); }
  function birlestir(L){
    if(L.length === 1) return L[0];
    var top = 0, i; for(i = 0; i < L.length; i++) top += L[i].length;
    var out = new Uint8Array(top), p = 0;
    for(i = 0; i < L.length; i++){ out.set(L[i], p); p += L[i].length; }
    return out;
  }
  // girdiler: [{ ad, crc, boy (ham bayt), veri (Uint8Array — sıkıştırılmış ya da ham), yontem 0|8 }]
  function zipKur(girdiler, tarih){
    var t = tarih || new Date();
    var dosZaman = (t.getHours() << 11) | (t.getMinutes() << 5) | Math.floor(t.getSeconds() / 2);
    var dosTarih = ((Math.max(1980, t.getFullYear()) - 1980) << 9) | ((t.getMonth() + 1) << 5) | t.getDate();
    var parca = [], merkez = [], konumu = 0;
    function u16(a, v){ a.push(v & 255, (v >>> 8) & 255); }
    function u32(a, v){ a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }
    girdiler.forEach(function(g){
      var ad = utf8(g.ad), b = [];
      u32(b, 0x04034b50); u16(b, 20); u16(b, 0x0800); u16(b, g.yontem); u16(b, dosZaman); u16(b, dosTarih);
      u32(b, g.crc); u32(b, g.veri.length); u32(b, g.boy); u16(b, ad.length); u16(b, 0);
      var bas = new Uint8Array(b.length + ad.length); bas.set(b, 0); bas.set(ad, b.length);
      parca.push(bas, g.veri);
      var m = [];
      u32(m, 0x02014b50); u16(m, 20); u16(m, 20); u16(m, 0x0800); u16(m, g.yontem); u16(m, dosZaman); u16(m, dosTarih);
      u32(m, g.crc); u32(m, g.veri.length); u32(m, g.boy); u16(m, ad.length); u16(m, 0); u16(m, 0); u16(m, 0); u16(m, 0);
      u32(m, 0); u32(m, konumu);
      var mb = new Uint8Array(m.length + ad.length); mb.set(m, 0); mb.set(ad, m.length);
      merkez.push(mb);
      konumu += bas.length + g.veri.length;
    });
    var mBoy = merkez.reduce(function(s, x){ return s + x.length; }, 0), son = [];
    u32(son, 0x06054b50); u16(son, 0); u16(son, 0); u16(son, girdiler.length); u16(son, girdiler.length);
    u32(son, mBoy); u32(son, konumu); u16(son, 0);
    return birlestir(parca.concat(merkez, [new Uint8Array(son)]));
  }
  // Sıkıştırmasız (zaman uyumlu): testlerin ve CompressionStream'siz ortamın yolu.
  function zipDuz(F, tarih){
    return zipKur(F.map(function(f){ var b = utf8(f[1]); return { ad:f[0], crc:crc32(b), boy:b.length, veri:b, yontem:0 }; }), tarih);
  }

  // ── dilimli yazım ────────────────────────────────────────────────────────
  // Uzun iş arayüzü kilitlemez: is.adim() BİR parça işler — sayfanın ~256 K
  // karakterlik satırları ya da küçük bir dosya: UTF-8'e çevirir, CRC'sini yürütür,
  // dosyanın sıkıştırıcısına yazar (CompressionStream('deflate-raw'), dosya başına
  // bir akış) — ve iş yaptıysa true döner. Çağıran adımları kendi dilim bütçesiyle
  // döndürür; sıkıştırma yazılan parçayla aynı görevde ilerler. bitir(): ZIP.
  var HAM_SINIR = 1 << 20;                   // bundan büyük dosyanın ham baytı tutulmaz (sıkıştırılmışı her zaman küçük)
  function havuz(sikistir){
    var crc = 0xFFFFFFFF, boy = 0, ham = [], w = null, cikti = null, hata = null;
    var yut = function(e){ if(!hata) hata = e; };
    if(sikistir){
      var cs = new CompressionStream('deflate-raw'), oku = cs.readable.getReader(), cik = [];
      w = cs.writable.getWriter();
      cikti = (function al(){
        return oku.read().then(function(r){ if(r.done) return birlestir(cik); cik.push(r.value); return al(); });
      })();
      cikti.catch(yut);
    }
    return {
      yaz: function(s){
        var b = utf8(s);
        crc = crcYuru(crc, b); boy += b.length;
        if(ham){ ham.push(b); if(w && boy > HAM_SINIR) ham = null; }
        if(w) w.write(b).catch(yut);
        return b.length;
      },
      kapat: function(){
        var c = crcSon(crc);
        if(!w) return Promise.resolve({ crc:c, boy:boy, veri:birlestir(ham), yontem:0 });
        w.close().catch(yut);
        return cikti.then(function(v){
          if(hata) throw hata;
          if(ham && v.length >= boy) return { crc:c, boy:boy, veri:birlestir(ham), yontem:0 };
          return { crc:c, boy:boy, veri:v, yontem:8 };
        });
      }
    };
  }
  function isKur(kitap, o){
    o = o || {};
    var P = plan(kitap), k = 0, akim = null, G = {}, bitti = 0, bayt = 0;
    var sikistir = o.sikistir !== false && typeof CompressionStream === 'function';
    var topA = P.uretim.reduce(function(s, d){ return s + d.agirlik; }, 0);
    return {
      adim: function(){
        if(k >= P.uretim.length) return false;
        var d = P.uretim[k];
        if(!akim) akim = havuz(sikistir);
        var s = d.uretec.sonraki();
        if(s === null){ G[d.yol] = akim.kapat(); akim = null; bitti += d.agirlik; k++; return true; }
        if(s) bayt += akim.yaz(s);
        return true;
      },
      bayt: function(){ return bayt; },          // yazılan ham bayt: çağıran dilimde sıkıştırılacak miktarı sınırlar
      oran: function(){
        var d = P.uretim[k];
        return Math.min(1, (bitti + (d ? d.agirlik * d.uretec.oran() : 0)) / topA);
      },
      bitir: function(){
        if(k < P.uretim.length) return Promise.reject(new Error('Yazım sürüyor'));
        return Promise.all(P.sira.map(function(y){ return G[y]; })).then(function(L){
          return zipKur(L.map(function(g, i){ return { ad:P.sira[i], crc:g.crc, boy:g.boy, veri:g.veri, yontem:g.yontem }; }), o.tarih);
        });
      }
    };
  }

  return {
    dosyalar: dosyalar, yaz: function(kitap, tarih){ return zipDuz(dosyalar(kitap), tarih); },
    is: function(kitap, o){ return isKur(kitap, o); },   // o: { tarih, sikistir:false — sıkıştırmasız }
    yazSikistir: function(kitap, tarih){
      try { var I = isKur(kitap, { tarih:tarih }); while(I.adim()); return I.bitir(); } catch(e){ return Promise.reject(e); }
    },
    harf: harf, adres: adres, sayfaAdi: sayfaAdi, crc32: crc32, utf8: utf8,
    MIME: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
})();
if(typeof module !== 'undefined' && module.exports){ module.exports = veXlsxYaz; }
