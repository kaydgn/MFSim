// Excel formülünün KÜÇÜK bir değerlendiricisi — Takoz Excel çıktısının (js/mount-param-excel.js)
// Sonuç ve Seçim sayfalarında kullandığı alt küme: IF · IFERROR · INDEX · MATCH (tam eşleşme) ·
// VALUE · TRIM · MID · SUBSTITUTE · REPT · ROW · OFFSET · SUBTOTAL(103); & · / · − · = işleçleri;
// 'Sayfa'!$A$1 ve 'Sayfa'!$A$1:$A$9 başvuruları (ızgara, satır içi aralık); dizi değerleri.
// Hücrenin değeri kitabın ÖNBELLEĞİNDEN değil, verilen hücre okuyucusundan (oku) gelir; gizli
// satır (süzgecin bıraktığı) gizli(sayfa, satır) ile söylenir. Excel'in hatası JS hatası olarak
// atılır (IFERROR onu yakalar).
'use strict';

function belirtecler(f) {
  const L = [];
  let i = 0;
  while (i < f.length) {
    const c = f[i];
    if (c === ' ') { i++; continue; }
    if (c === '"') {
      let s = ''; i++;
      for (;;) {
        if (i >= f.length) throw new Error('kapanmayan metin: ' + f);
        if (f[i] === '"') { if (f[i + 1] === '"') { s += '"'; i += 2; continue; } i++; break; }
        s += f[i++];
      }
      L.push({ t: 'metin', v: s }); continue;
    }
    let m = /^(?:'((?:[^']|'')+)'|([A-Za-z_][\wÇĞİÖŞÜçğıöşü]*))!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?/.exec(f.slice(i));
    if (m) {
      L.push({ t: 'bas', sayfa: (m[1] || m[2]).replace(/''/g, "'"), c1: sut(m[3]), r1: +m[4], c2: m[5] ? sut(m[5]) : sut(m[3]), r2: m[6] ? +m[6] : +m[4] });
      i += m[0].length; continue;
    }
    m = /^\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?(?![\w(])/.exec(f.slice(i));
    if (m) {
      L.push({ t: 'bas', sayfa: null, c1: sut(m[1]), r1: +m[2], c2: m[3] ? sut(m[3]) : sut(m[1]), r2: m[4] ? +m[4] : +m[2] });
      i += m[0].length; continue;
    }
    m = /^\d+(?:\.\d+)?/.exec(f.slice(i));
    if (m) { L.push({ t: 'sayi', v: +m[0] }); i += m[0].length; continue; }
    m = /^[A-Z][A-Z0-9.]*(?=\()/.exec(f.slice(i));
    if (m) { L.push({ t: 'islev', v: m[0] }); i += m[0].length; continue; }
    if ('(),&/-=+*'.indexOf(c) >= 0) { L.push({ t: c }); i++; continue; }
    throw new Error('tanınmayan belirteç: ' + f.slice(i, i + 20));
  }
  return L;
}
function sut(h) { let n = 0; for (const ch of h) n = n * 26 + ch.charCodeAt(0) - 64; return n; }

// Ayrıştırıcı: karşılaştırma < & < toplama < çarpma < tekli eksi < birincil.
function agac(f) {
  const L = belirtecler(f);
  let p = 0;
  const bak = () => L[p], al = (t) => { if (!L[p] || L[p].t !== t) throw new Error('beklenen ' + t + ': ' + f); return L[p++]; };
  function kars() { let a = birles(); while (bak() && bak().t === '=') { p++; a = { op: '=', a, b: birles() }; } return a; }
  function birles() { let a = topla(); while (bak() && bak().t === '&') { p++; a = { op: '&', a, b: topla() }; } return a; }
  function topla() { let a = carp(); while (bak() && (bak().t === '+' || bak().t === '-')) { const o = L[p++].t; a = { op: o, a, b: carp() }; } return a; }
  function carp() { let a = tekli(); while (bak() && (bak().t === '*' || bak().t === '/')) { const o = L[p++].t; a = { op: o, a, b: tekli() }; } return a; }
  function tekli() { if (bak() && bak().t === '-') { p++; return { op: 'eksi', a: tekli() }; } return bir(); }
  function bir() {
    const x = L[p++];
    if (!x) throw new Error('eksik ifade: ' + f);
    if (x.t === 'metin' || x.t === 'sayi') return { sabit: x.v };
    if (x.t === 'bas') return { bas: x };
    if (x.t === '(') { const a = kars(); al(')'); return a; }
    if (x.t === 'islev') {
      al('('); const arg = [];
      if (bak() && bak().t !== ')') { arg.push(kars()); while (bak() && bak().t === ',') { p++; arg.push(kars()); } }
      al(')'); return { islev: x.v, arg };
    }
    throw new Error('beklenmeyen ' + x.t + ': ' + f);
  }
  const a = kars();
  if (p !== L.length) throw new Error('artan belirteç: ' + f);
  return a;
}

// Değerler: sayı · metin · başvuru { bas } · dizi (JS dizisi).
function hesapla(f, ortam) {
  const { oku, gizli, sayfa } = ortam;
  const ref = (b) => ({ sayfa: b.sayfa || sayfa, c1: b.c1, r1: b.r1, c2: b.c2, r2: b.r2 });
  const deger = (v) => {
    if (Array.isArray(v)) return v.map(deger);
    if (v && v.ref) {
      const r = v.ref;
      if (r.c1 !== r.c2 || r.r1 !== r.r2) throw new Error('aralık tek değer değil');
      const x = oku(r.sayfa, r.r1, r.c1);
      return x == null ? '' : x;
    }
    return v;
  };
  const sayi = (v) => {
    v = deger(v);
    if (typeof v === 'number') return v;
    if (v === '') return 0;
    const n = Number(String(v).trim());
    if (String(v).trim() === '' || !Number.isFinite(n)) throw new Error('#DEĞER!');
    return n;
  };
  const metin = (v) => { v = deger(v); return typeof v === 'number' ? String(v) : String(v); };
  const harita = (a, b, fn) => {
    if (Array.isArray(a) || Array.isArray(b)) {
      const n = Array.isArray(a) ? a.length : b.length;
      return Array.from({ length: n }, (_, i) => fn(Array.isArray(a) ? a[i] : a, Array.isArray(b) ? b[i] : b));
    }
    return fn(a, b);
  };
  function e(d) {
    if ('sabit' in d) return d.sabit;
    if (d.bas) return { ref: ref(d.bas) };
    if (d.op === 'eksi') return harita(e(d.a), 0, (x) => -sayi(x));
    if (d.op) {
      const a = e(d.a), b = e(d.b);
      return harita(a, b, (x, y) => {
        if (d.op === '&') return metin(x) + metin(y);
        if (d.op === '=') { x = deger(x); y = deger(y); return typeof x === 'string' && typeof y === 'string' ? x.toLowerCase() === y.toLowerCase() : x === y; }
        const u = sayi(x), w = sayi(y);
        if (d.op === '+') return u + w;
        if (d.op === '-') return u - w;
        if (d.op === '*') return u * w;
        if (w === 0) throw new Error('#SAYI/0!');
        return u / w;
      });
    }
    const A = d.arg, ad = d.islev;
    switch (ad) {
      case 'IF': { const k = deger(e(A[0])); return (k === true || (typeof k === 'number' && k !== 0)) ? e(A[1]) : (A.length > 2 ? e(A[2]) : false); }
      case 'IFERROR': try { const v = deger(e(A[0])); return v; } catch (er) { return e(A[1]); }
      case 'INDEX': {
        const r = e(A[0]).ref, k = sayi(e(A[1]));
        if (!r) throw new Error('INDEX başvuru ister');
        if (r.c1 !== r.c2) throw new Error('INDEX tek sütunluk aralık ister');
        if (!(k >= 1 && k <= r.r2 - r.r1 + 1) || k !== Math.floor(k)) throw new Error('#BAŞV!');
        return { ref: { sayfa: r.sayfa, c1: r.c1, c2: r.c1, r1: r.r1 + k - 1, r2: r.r1 + k - 1 } };
      }
      case 'MATCH': {
        const x = deger(e(A[0])), dz = e(A[1]), tur = A.length > 2 ? sayi(e(A[2])) : 1;
        if (tur !== 0) throw new Error('yalnız tam eşleşme');
        const L = Array.isArray(dz) ? dz.map(deger) : (() => { const r = dz.ref, o = []; for (let rr = r.r1; rr <= r.r2; rr++) o.push(deger({ ref: { sayfa: r.sayfa, c1: r.c1, c2: r.c1, r1: rr, r2: rr } })); return o; })();
        const i = L.findIndex((v) => v === x);
        if (i < 0) throw new Error('#YOK');
        return i + 1;
      }
      case 'ROW': { const r = e(A[0]).ref; if (r.r1 === r.r2) return r.r1; return Array.from({ length: r.r2 - r.r1 + 1 }, (_, i) => r.r1 + i); }
      case 'OFFSET': {
        const r = e(A[0]).ref, sat = e(A[1]), so = sayi(e(A[2]));
        const kay = (n) => ({ ref: { sayfa: r.sayfa, c1: r.c1 + so, c2: r.c2 + so, r1: r.r1 + sayi(n), r2: r.r2 + sayi(n) } });
        return Array.isArray(sat) ? sat.map(kay) : kay(sat);
      }
      case 'SUBTOTAL': {
        if (sayi(e(A[0])) !== 103) throw new Error('yalnız SUBTOTAL(103)');
        const say = (v) => {
          const r = v.ref; let n = 0;
          for (let rr = r.r1; rr <= r.r2; rr++) for (let cc = r.c1; cc <= r.c2; cc++) {
            if (gizli && gizli(r.sayfa, rr)) continue;
            const x = oku(r.sayfa, rr, cc); if (x != null && x !== '') n++;
          }
          return n;
        };
        const v = e(A[1]);
        return Array.isArray(v) ? v.map(say) : say(v);
      }
      case 'VALUE': {                                   // boş metin Excel'de #DEĞER! (boş hücre aritmetikte 0)
        const s = metin(e(A[0])).trim(), n = Number(s);
        if (s === '' || !Number.isFinite(n)) throw new Error('#DEĞER!');
        return n;
      }
      case 'TRIM': return metin(e(A[0])).replace(/ +/g, ' ').trim();
      case 'MID': { const s = metin(e(A[0])), b = sayi(e(A[1])), n = sayi(e(A[2])); return s.substr(b - 1, n); }
      case 'SUBSTITUTE': { const s = metin(e(A[0])), a = metin(e(A[1])), b = metin(e(A[2])); return a ? s.split(a).join(b) : s; }
      case 'REPT': return metin(e(A[0])).repeat(sayi(e(A[1])));
      default: throw new Error('desteklenmeyen işlev ' + ad);
    }
  }
  return deger(e(agac(f)));
}

// Kitap modelinin (js/xlsx-yaz.js'e giden { sayfalar }) hücre okuyucusu: değer hücresi
// kendi değeri, formül hücresi formülünün değeri (önbellek DEĞİL), akışlı sayfa satırından.
function kitapOrtami(kitap, gizli) {
  const S = {}, onbellek = new Map();
  kitap.sayfalar.forEach((s) => { S[s.ad] = s; });
  const hucreler = {};
  function hucre(ad, r, c) {
    const s = S[ad];
    if (!s) throw new Error('sayfa yok: ' + ad);
    if (s.akis) { const L = s.akis.satir(r - 1); return L ? L[c - 1] : null; }
    if (!hucreler[ad]) { const m = new Map(); (s.hucre || []).forEach((h) => m.set(h[0] + ',' + h[1], h[2])); hucreler[ad] = m; }
    return hucreler[ad].get(r + ',' + c);
  }
  function oku(ad, r, c) {
    const h = hucre(ad, r, c);
    if (h && typeof h === 'object' && 'f' in h) {
      const k = ad + '!' + r + ',' + c;
      if (!onbellek.has(k)) onbellek.set(k, hesapla(h.f, { oku, gizli, sayfa: ad }));
      return onbellek.get(k);
    }
    return h && typeof h === 'object' && 'v' in h ? h.v : h;
  }
  return { oku, hucre };
}

// Yazılmış DOSYANIN hücre okuyucusu: değer okuyucunun (js/xlsx-read.js) satırlarından, formül
// sayfanın XML'inden (yazıcının kaçışı dâhil) — önbellek okunmaz, formül hesaplanır.
function dosyaOrtami(R, bayt, gizli) {
  const wb = R.veXlsOpen(bayt), z = R.veXlsZipRead(bayt), ad2i = {}, satir = {}, formul = {}, onbellek = new Map();
  wb.sheets.forEach((s, i) => { ad2i[s.name] = i; });
  const ac = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  function sayfa(ad) {
    if (satir[ad]) return;
    const i = ad2i[ad];
    if (i == null) throw new Error('sayfa yok: ' + ad);
    satir[ad] = wb.readSheet(i).rows;
    const x = R.veXlsUtf8(z.read(wb.sheets[i].path)), F = new Map(), re = /<c r="([A-Z]+)(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g;
    let m;
    while ((m = re.exec(x))) {
      const f = m[3] && /<f[^>]*>([\s\S]*?)<\/f>/.exec(m[3]);
      if (f) F.set(m[2] + ',' + sut(m[1]), ac(f[1]));
    }
    formul[ad] = F;
  }
  function hucre(ad, r, c) {
    sayfa(ad);
    if (formul[ad].has(r + ',' + c)) return { f: formul[ad].get(r + ',' + c) };
    const L = satir[ad][r - 1];
    return L ? L[c - 1] : null;
  }
  function oku(ad, r, c) {
    const h = hucre(ad, r, c);
    if (h && typeof h === 'object' && 'f' in h) {
      const k = ad + '!' + r + ',' + c;
      if (!onbellek.has(k)) onbellek.set(k, hesapla(h.f, { oku, gizli, sayfa: ad }));
      return onbellek.get(k);
    }
    return h;
  }
  return { oku, hucre, formuller: (ad) => { sayfa(ad); return formul[ad]; } };
}

module.exports = { hesapla, kitapOrtami, dosyaOrtami, agac };
