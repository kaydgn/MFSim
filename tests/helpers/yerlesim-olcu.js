/**
 * yerlesim-olcu.js — EKRANDAKİ YAZI KUTUSUNA SIĞIYOR MU?
 * ───────────────────────────────────────────────────────────────────────────
 * `mufettis-sigma.spec.js` pencerenin SÜTUNA sığdığını ölçüyor (taşan öğe,
 * dar girdi). Sığan bir pencerenin İÇİNDE yazı yine bozulabiliyordu ve o kapı
 * bunu göremiyordu: Motor-Şanzıman Eşleştirme tablosunda "Şanzıman" sütunu
 * 15 px'e inip adları kırpıyordu; sihirbaz kapı tabloları 234 px'lik sütunda
 * kendi kabında yatay kayıyordu; lejant adları tirede bölünüyordu ("TC-/411").
 * Bu dosya ölçütü TEK yerde tutar; matematiği tests/unit/yerlesim-olcu.test.js'te
 * düşebiliyor.
 *
 * Ölçülen (görünen her HTML metin düğümü ve SVG yazısı):
 *   · kesik   yazı, onu kırpan bir atanın (overflow hidden/clip) kutusundan
 *             taşıyor — görünmeyen bir parça var. `text-overflow:ellipsis` ile
 *             kısaltılan yazı da kesiktir; tam metni `title` taşıyorsa sayılmaz.
 *   · kirik   bir sözcük iki satıra bölünmüş. Açık tirede bölünme ancak iki
 *             yanı da ≥ 4 harfse kabul ("Motor-/Şanzıman"); "TC-/411" kırıktır.
 *   · yatay   kaydırma kabı yatayda taşıyor (sütunda yatay kaydırma yok kuralı).
 *   · kucuk   ekranda 9,5 px'ten küçük yazı (ölçek tabanı 10 px).
 *   · binen   aynı çizimdeki (SVG) iki yazı üst üste — kutuları her iki eksende
 *             2 px'ten fazla kesişiyor.
 *   · yapisik topolojide iki düğüm ADI aynı satırda birbirine değiyor (arada
 *             4 px'ten az): "Koordinat Düzlemi" ile "3D Görüntüleyici" tek
 *             sözcük gibi okunuyordu ("Düzlemi3D").
 *   · cizgi   aynı çizimde bir çizgi (kontur: line · path · polyline · polygon
 *             · circle · ellipse · rect) yazının GÖRÜNEN kutusunun içinden
 *             geçiyor. Sayılmaz: yazıdan ÖNCE çizilen çizgi yazı zemin
 *             renginde hâle taşıyorsa (hâle onu örter), çizgiden SONRA
 *             çizilen dolgulu bir şeklin örttüğü nokta (göbek diski), saydam
 *             kontur (görünmez isabet yolu) ve kırpılmış yazı.
 *   · yapi    tipografik alt/üst simge (sınıfsız `<sub>`/`<sup>`) esnek ya da
 *             ızgara kabın DOĞRUDAN çocuğu: esnek öğede `vertical-align`
 *             işlemez, "L<sub>b</sub>" "L b" diye yan yana düşer.
 *   · yapiskan alta yapışan öğe (`position:sticky; bottom`) kaydırma kabının
 *             dibine oturmuyor: arada kalan şeritten kayan içerik görünüyor.
 *   · yetim   satır başında tek başına kalan kapanış noktalaması — "(limit:
 *             336 kW ✓" yukarıda, ")" alt satırda.
 * Kesik ölçüsü KAYDIRMAYI ayırır: kaydırma kabının içindeki yazı, kabın
 * görünmeyen kısmında kalınca kesik sayılmaz (kaydırılarak okunur); kabın
 * dışındaki kırpan ata o eksende yalnız kaba kadar sayılır. Kırpan kutunun
 * TAMAMEN dışındaki yazı da kesik değildir (yakınlaştırılmış görüntüleyici);
 * kesik = bir kısmı görünüyor.
 * Kapsam dışı: `aria-hidden`, kapalı `<details>`, yalnız ekran okuyucu için
 * gizlenmiş (≤ 2 px kırpılmış) kutu, `<option>`, tuval yazısı. Küçük yazıda:
 * alt/üst simge (simgenin parçası), ikon boyundaki çizim (≤ 64 px) ve
 * yakınlaştırılan topoloji tuvali (boyu kameranın).
 */

// ── Saf matematik (Node'da test edilir, sayfaya kaynak olarak taşınır) ──────
// Metni sözcüklere böl: [{s, i}] — i metindeki başlangıç konumu. Harf ya da
// rakam taşımayan parça (·, —, │) sözcük değildir.
function ySozcukler(t) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(String(t)))) if (/[0-9\p{L}]/u.test(m[0])) out.push({ s: m[0], i: m.index });
  return out;
}
// Bir sözcüğün satır kutularından kaç AYRI satıra yayıldığı (üst kenarı
// 2 px'ten fazla ayrışan kutu ayrı satırdır).
function ySatirSayisi(rects) {
  const ust = [];
  rects.filter((r) => r.width > 0.5 && r.height > 0.5).forEach((r) => {
    if (!ust.some((u) => Math.abs(u - r.top) <= 2)) ust.push(r.top);
  });
  return ust.length;
}
// İki satıra bölünmüş sözcük KABUL mü? Bölünme yeri `kesim` (ilk satırda kalan
// karakter sayısı). Açık tire ya da eğik çizgide bölünme, iki yanında ≥ 4 harf
// varsa kabul; harf ortası her zaman kırık.
function yKirikMi(sozcuk, kesim) {
  const sol = sozcuk.slice(0, kesim), sag = sozcuk.slice(kesim);
  if (!/[-–/]$/.test(sol)) return true;
  const harf = (x) => (x.match(/[\p{L}]/gu) || []).length;
  return harf(sol) < 4 || harf(sag) < 4;
}
// İki kutunun kesişimi (px; yatay ve dikey) — ikisi de > 2 ise üst üste.
function yKesisim(a, b) {
  return { x: Math.min(a.right, b.right) - Math.max(a.left, b.left), y: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) };
}
// Yazı kutusunun kırpan kutudan taşması (px; yatay ve dikey ayrı).
function yTasma(yazi, kap) {
  return {
    x: Math.max(0, kap.left - yazi.left, yazi.right - kap.right),
    y: Math.max(0, kap.top - yazi.top, yazi.bottom - kap.bottom),
  };
}

// Alta yapışan öğenin altında kalan şerit (px). Yapışkan konum kabın
// DOLGUSUNA saygı gösterir: yapışık öğenin alt kenarı `dip − dolgu − bottom`da
// durur. Öğe orada değilse doğal yerindedir ve şerit sayılmaz.
function yYapiskanSerit(dip, alt, dolgu, bottom) {
  const serit = dip - alt;
  return Math.abs(serit - (dolgu + bottom)) <= 1 && serit > 1 ? serit : 0;
}

// Bir çizginin yazıyı kesmesi SAYILIR mı? Kutunun içinde görünen (örtülmemiş)
// nokta yoksa hayır; çizgi yazıdan ÖNCE çizilmiş ve yazı hâle taşıyorsa hâle
// onu örter — hayır; yazıdan SONRA çizilen çizgiyi hâle örtmez.
function yCizgiSayilir(hale, cizgiSonra, gorunurNokta) {
  if (!(gorunurNokta > 0)) return false;
  return cizgiSonra || !hale;
}
// Noktalardan kutunun (kenarlar hariç) İÇİNDE kalanlar.
function yKutudaNoktalar(noktalar, k) {
  return noktalar.filter((p) => p.x > k.left && p.x < k.right && p.y > k.top && p.y < k.bottom);
}

// ── Sayfa tarafı: window.__yerlesim(kökSeçici) ─────────────────────────────
function yKur() {
  const gizli = (el) => !!el.closest('title, canvas, script, style, noscript, template, option, [aria-hidden="true"]');
  const yol = (el) => {
    const p = [];
    for (let e = el; e && e.nodeType === 1 && p.length < 4; e = e.parentElement)
      p.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : ''));
    return p.join(' > ');
  };
  // Kırpan atalar: overflow (eksen başına) hidden/clip. Kaydırma kabı
  // (auto/scroll) kırpmaz sayılır — içindeki yazı kaydırılarak okunur; yatay
  // kaydırma `yatay`da ayrıca sayılır. Kaydırma kabından SONRAKİ atalar o
  // eksende sayılmaz: kabın görünmeyen kısmındaki satır onların da dışında
  // kalır ama kesik değil, aşağıda.
  const kirpanlar = (el, kok) => {
    const out = [];
    let kayX = false, kayY = false;
    for (let e = el.parentElement || el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const kx = !kayX && /hidden|clip/.test(cs.overflowX), ky = !kayY && /hidden|clip/.test(cs.overflowY);
      if (kx || ky) {
        const r = e.getBoundingClientRect();
        const bl = parseFloat(cs.borderLeftWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
        out.push({ el: e, x: kx, y: ky, r: { left: r.left + bl, top: r.top + bt, right: r.left + bl + e.clientWidth, bottom: r.top + bt + e.clientHeight } });
      }
      if (/auto|scroll/.test(cs.overflowX)) kayX = true;
      if (/auto|scroll/.test(cs.overflowY)) kayY = true;
      if (e === kok) break;
    }
    return out;
  };
  const KAPANIS = /^[)\]}.,;:!?…»”’]+$/;
  window.__yerlesim = (kokSec) => {
    const kok = typeof kokSec === 'string' ? document.querySelector(kokSec) : kokSec;
    const out = { kesik: [], kirik: [], yatay: [], kucuk: [], kucukSvg: [], binen: [], cizgi: [], yapisik: [], yapi: [], yetim: [], yapiskan: [], olculen: 0 };
    if (!kok) { out.kesik.push({ metin: 'kök yok: ' + kokSec }); return out; }
    const gor = new Set();
    const ekle = (liste, k, v) => { if (gor.has(k)) return; gor.add(k); liste.push(v); };
    const tw = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = tw.nextNode())) {
      const ham = t.nodeValue;
      const s = ham.replace(/\s+/g, ' ').trim();
      const yalnizNokta = KAPANIS.test(s);              // ")" — yetim ölçüsüne girer
      if (!s || (!yalnizNokta && !/[0-9\p{L}]/u.test(s))) continue;
      const el = t.parentElement;
      if (!el || gizli(el)) continue;
      if (el.closest('details:not([open])') && !el.closest('summary')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || cs.display === 'none') continue;
      const rg = document.createRange(); rg.selectNodeContents(t);
      const rs = [...rg.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5);
      if (!rs.length) continue;
      const kutu = rg.getBoundingClientRect();
      if (kutu.bottom < 0 || kutu.right < 0 || kutu.top > innerHeight || kutu.left > innerWidth) continue;
      const kirp = kirpanlar(el, kok);
      // Yalnız ekran okuyucu için gizlenmiş kutu (≤ 2 px) kapsam dışı.
      if (kirp.some((k) => (k.r.right - k.r.left) <= 2 || (k.r.bottom - k.r.top) <= 2)) continue;
      const svgde = !!el.closest('svg');
      if (yalnizNokta) {
        if (!svgde) {
          // önceki YAZI: boşluk ve yazısız öğe (çizgi ikon) atlanır — "kW ✓)"da
          // ikon da alt satıra iner, yalnız kalan şey ikonla parantezdir
          let onc = t.previousSibling;
          while (onc && !(onc.textContent || '').trim()) onc = onc.previousSibling;
          if (onc) {
            let q = null;
            if (onc.nodeType === 3) { const r4 = document.createRange(); r4.selectNodeContents(onc); const l4 = [...r4.getClientRects()]; q = l4[l4.length - 1]; }
            else if (onc.nodeType === 1) { const l4 = [...onc.getClientRects()]; q = l4[l4.length - 1]; }
            if (q && rs[0].top > q.top + 2 && rs[0].left < q.left) ekle(out.yetim, 'p|' + s + '|' + yol(el), { metin: s, onceki: (onc.textContent || '').trim().slice(-24), yol: yol(el) });
          }
        }
        continue;
      }
      out.olculen++;
      // küçük yazı: SVG'de ekrandaki boy ölçeklenmiş boydur. Alt/üst simge
      // simgenin parçası; ikon boyundaki çizim bir resimdir; topoloji tuvali
      // kameranın boyunda çizilir.
      let px = parseFloat(cs.fontSize);
      let simge = !!el.closest('sub, sup') || !!el.closest('#ve-canvas');
      if (svgde) {
        const svgEl = el.closest('svg'), sr = svgEl.getBoundingClientRect();
        if (sr.width <= 64 && sr.height <= 64) simge = true;
        // SVG alt simgesi: ebeveyninden küçük yazılan tspan
        if (el.tagName.toLowerCase() === 'tspan' && el.parentElement && parseFloat(getComputedStyle(el.parentElement).fontSize) > px) simge = true;
        if (el.getScreenCTM) { const m = el.getScreenCTM(); if (m) px *= Math.hypot(m.a, m.b); }
      }
      if (!simge && px < 9.5) ekle(svgde ? out.kucukSvg : out.kucuk, 'k|' + s.slice(0, 30) + '|' + Math.round(px * 10), { metin: s.slice(0, 40), px: Math.round(px * 10) / 10, yol: yol(el) });
      // kesik
      for (const k of kirp) {
        // Tamamen dışarıda kalan yazı kesik değil, görünüm dışında (kaydırılmış
        // masa, yakınlaştırılmış çizim); kesik = bir kısmı görünüyor.
        const ic = rs.some((q) => { const z = yKesisim(q, k.r); return z.x > 0.5 && z.y > 0.5; });
        if (!ic) continue;
        let enx = 0, eny = 0;
        rs.forEach((q) => { const ts = yTasma(q, k.r); enx = Math.max(enx, ts.x); eny = Math.max(eny, ts.y); });
        const tx = k.x ? enx : 0, ty = k.y ? eny : 0;
        if (tx > 1.5 || ty > 1.5) {
          ekle(out.kesik, 'c|' + s.slice(0, 30) + '|' + yol(k.el), { metin: s.slice(0, 40), tasma: Math.round(Math.max(tx, ty)), yon: tx >= ty ? 'yatay' : 'dikey', yol: yol(el), kirpan: yol(k.el) });
          break;
        }
      }
      // üç noktayla kısaltılmış (tam metin title'da değilse)
      if (cs.textOverflow === 'ellipsis' && /hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) {
        const baslik = (el.closest('[title]') || {}).title || '';
        if (baslik.indexOf(s.slice(0, Math.min(12, s.length))) < 0)
          ekle(out.kesik, 'e|' + s.slice(0, 30), { metin: s.slice(0, 40), tasma: el.scrollWidth - el.clientWidth, yon: 'üç nokta', yol: yol(el), kirpan: '(title yok)' });
      }
      // kırık sözcük: yalnız birden çok satıra yayılan düğümde ara
      if (!svgde && rs.length > 1 && ySatirSayisi(rs) > 1) {
        for (const w of ySozcukler(ham)) {
          if (w.s.length > 30) continue;
          const r2 = document.createRange(); r2.setStart(t, w.i); r2.setEnd(t, w.i + w.s.length);
          const wr = [...r2.getClientRects()];
          if (ySatirSayisi(wr) < 2) continue;
          // bölünme yeri: ilk satırda kalan karakter sayısı
          let kesim = 1;
          const ilkUst = wr[0].top;
          for (let j = 1; j < w.s.length; j++) {
            const r3 = document.createRange(); r3.setStart(t, w.i + j); r3.setEnd(t, w.i + j + 1);
            const q = r3.getClientRects()[0];
            if (q && Math.abs(q.top - ilkUst) > 2) { kesim = j; break; }
          }
          if (yKirikMi(w.s, kesim)) ekle(out.kirik, 'w|' + w.s + '|' + yol(el), { metin: w.s.slice(0, kesim) + '|' + w.s.slice(kesim), yol: yol(el) });
        }
      }
    }
    // alt/üst simge esnek ya da ızgara kabın DOĞRUDAN çocuğu
    kok.querySelectorAll('sub:not([class]), sup:not([class])').forEach((u) => {
      if (gizli(u) || !u.getClientRects().length || !u.parentElement) return;
      const d = getComputedStyle(u.parentElement).display;
      if (/flex|grid/.test(d)) {
        const onceki = (u.previousSibling && u.previousSibling.textContent || '').trim().slice(-12);
        ekle(out.yapi, 'u|' + yol(u) + '|' + onceki, { metin: onceki + '<' + u.tagName.toLowerCase() + '>' + u.textContent.trim().slice(0, 12), kap: d, yol: yol(u) });
      }
    });
    // SVG yazıları üst üste (aynı çizimde). Hâle kopyası (aynı metin, aynı yer) sayılmaz.
    kok.querySelectorAll('svg').forEach((svg) => {
      if (gizli(svg) || !svg.getBoundingClientRect().width) return;
      const yazilar = [...svg.querySelectorAll('text')].filter((x) => !gizli(x) && /[0-9\p{L}]/u.test(x.textContent))
        .map((x) => ({ el: x, t: x.textContent.replace(/\s+/g, ' ').trim(), r: x.getBoundingClientRect() }))
        .filter((x) => x.r.width > 0.5 && x.r.height > 0.5 && getComputedStyle(x.el).visibility === 'visible');
      for (let i = 0; i < yazilar.length; i++) {
        for (let j = i + 1; j < yazilar.length; j++) {
          const a = yazilar[i], b = yazilar[j];
          if (a.t === b.t && Math.abs(a.r.left - b.r.left) < 1 && Math.abs(a.r.top - b.r.top) < 1) continue;
          const k = yKesisim(a.r, b.r);
          if (k.x > 2 && k.y > 2) ekle(out.binen, 'b|' + a.t + '|' + b.t, { a: a.t.slice(0, 30), b: b.t.slice(0, 30), x: Math.round(k.x), y: Math.round(k.y), yol: yol(svg) });
        }
      }
    });
    // DÜĞÜM ADLARI BİRBİRİNE DEĞMEZ (topoloji): aynı satırdaki iki ad arasında
    // en az 4 px. Ekranın dışındaki ad sayılmaz.
    const adlar = [...kok.querySelectorAll('.ve-node-label')].filter((e) => !gizli(e) && e.getClientRects().length && e.textContent.trim())
      .map((e) => ({ t: e.textContent.replace(/\s+/g, ' ').trim(), r: e.getBoundingClientRect() }))
      .filter((a) => a.r.width > 0.5 && a.r.right > 0 && a.r.left < innerWidth && a.r.bottom > 0 && a.r.top < innerHeight);
    for (let i = 0; i < adlar.length; i++) {
      for (let j = i + 1; j < adlar.length; j++) {
        const k = yKesisim(adlar[i].r, adlar[j].r);
        if (k.y > 4 && k.x > -4) ekle(out.yapisik, 'a|' + adlar[i].t + '|' + adlar[j].t, { a: adlar[i].t.slice(0, 30), b: adlar[j].t.slice(0, 30), ara: Math.round(-k.x) });
      }
    }
    // ÇİZGİ YAZIYI KESİYOR (aynı çizimde). Çizgi konturdan örneklenir
    // (getPointAtLength); örtülme `isPointInFill` ile, çizgiden SONRA çizilen
    // dolgulu şekillere sorulur.
    const saydam = (c) => !c || c === 'none' || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
    kok.querySelectorAll('svg').forEach((svg) => {
      if (gizli(svg) || !svg.getBoundingClientRect().width) return;
      const hepsi = [...svg.querySelectorAll('text, line, path, polyline, polygon, circle, ellipse, rect')]
        .filter((e) => !e.closest('defs, clipPath, mask, title, marker, pattern, symbol'));
      const sira = new Map(hepsi.map((e, i) => [e, i]));
      const cizgiler = [], dolgular = [];
      hepsi.forEach((e) => {
        if (e.tagName === 'text') return;
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility !== 'visible' || +cs.opacity === 0) return;
        if (!saydam(cs.fill) && +cs.fillOpacity > 0.5 && e.isPointInFill) dolgular.push(e);
        if (saydam(cs.stroke) || +cs.strokeOpacity === 0 || !(parseFloat(cs.strokeWidth) > 0)) return;
        cizgiler.push({ el: e, r: e.getBoundingClientRect(), n: null, kontur: cs.stroke + ' ' + cs.strokeWidth });
      });
      if (!cizgiler.length) return;
      const ornekle = (c) => {
        if (c.n) return c.n;
        const e = c.el, ctm = e.getScreenCTM(), L = e.getTotalLength ? e.getTotalLength() : 0;
        c.n = [];
        if (!ctm || !(L > 0)) return c.n;
        const n = Math.min(400, Math.ceil(L / 1.5));
        for (let k = 0; k <= n; k++) { const q = e.getPointAtLength(L * k / n); c.n.push(new DOMPoint(q.x, q.y).matrixTransform(ctm)); }
        return c.n;
      };
      const sr = svg.getBoundingClientRect();
      [...svg.querySelectorAll('text')].forEach((t) => {
        if (gizli(t) || !/[0-9\p{L}]/u.test(t.textContent)) return;
        const cs = getComputedStyle(t);
        if (cs.visibility !== 'visible' || cs.display === 'none' || +cs.opacity === 0) return;
        const r = t.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        // GÖRÜNEN kutu: çizimin ve kırpan ataların kesişimi; yarısından azı
        // görünüyorsa yazı kırpılmıştır (yakınlaştırılmış masa), ölçülmez.
        let g = { left: Math.max(r.left, sr.left), top: Math.max(r.top, sr.top), right: Math.min(r.right, sr.right), bottom: Math.min(r.bottom, sr.bottom) };
        kirpanlar(svg, kok).forEach((k) => { g = { left: Math.max(g.left, k.r.left), top: Math.max(g.top, k.r.top), right: Math.min(g.right, k.r.right), bottom: Math.min(g.bottom, k.r.bottom) }; });
        if (g.right <= g.left || g.bottom <= g.top || (g.right - g.left) * (g.bottom - g.top) < 0.5 * r.width * r.height) return;
        // içerden 1 px yatay, 2 px dikey pay: harfin kutusu satır aralığını da kapsıyor
        const kutu = { left: Math.max(r.left + 1, g.left), right: Math.min(r.right - 1, g.right), top: Math.max(r.top + 2, g.top), bottom: Math.min(r.bottom - 2, g.bottom) };
        const hale = /stroke/.test(cs.paintOrder || '') && !saydam(cs.stroke) && parseFloat(cs.strokeWidth) >= 1.5;
        const ti = sira.get(t);
        cizgiler.forEach((c) => {
          if (c.r.right < kutu.left || c.r.left > kutu.right || c.r.bottom < kutu.top || c.r.top > kutu.bottom) return;
          const ci = sira.get(c.el), sonra = ci > ti;
          if (!sonra && hale) return;
          const ic = yKutudaNoktalar(ornekle(c), kutu);
          if (!ic.length) return;
          const ortu = dolgular.filter((o) => sira.get(o) > ci && o !== t);
          const gorunur = ic.filter((p) => !ortu.some((o) => {
            const m = o.getScreenCTM(); if (!m) return false;
            try { return o.isPointInFill(new DOMPoint(p.x, p.y).matrixTransform(m.inverse())); } catch (e) { return false; }
          }));
          if (!yCizgiSayilir(hale, sonra, gorunur.length)) return;
          const ad = c.el.getAttribute('data-ve') || (typeof c.el.className === 'object' ? c.el.className.baseVal : '') || c.el.tagName.toLowerCase();
          ekle(out.cizgi, 'c|' + t.textContent.trim().slice(0, 30) + '|' + ad + '|' + Math.round(r.left) + ',' + Math.round(r.top),
            { metin: t.textContent.replace(/\s+/g, ' ').trim().slice(0, 40), cizgi: ad + (sonra ? ' (üstte)' : ''), nokta: gorunur.length, yol: yol(svg) });
        });
      });
    });
    // ALTA YAPIŞAN öğe kabın DİBİNE oturmalı: arada kalan şeritten kayan
    // içerik görünür. Kab dipteyken öğe doğal yerindedir ve altında kayan bir
    // şey yoktur.
    kok.querySelectorAll('*').forEach((e) => {
      const cs = getComputedStyle(e);
      if (cs.position !== 'sticky' || cs.bottom === 'auto' || gizli(e) || !e.getClientRects().length) return;
      let kab = e.parentElement;
      while (kab && kab !== document.documentElement && !/auto|scroll/.test(getComputedStyle(kab).overflowY)) kab = kab.parentElement;
      if (!kab || kab === document.documentElement || kab.scrollHeight <= kab.clientHeight + 1) return;
      if (kab.scrollTop + kab.clientHeight >= kab.scrollHeight - 1) return;
      const kcs = getComputedStyle(kab), kr = kab.getBoundingClientRect(), er = e.getBoundingClientRect();
      const dip = kr.top + (parseFloat(kcs.borderTopWidth) || 0) + kab.clientHeight;
      const serit = yYapiskanSerit(dip, er.bottom, parseFloat(kcs.paddingBottom) || 0, parseFloat(cs.bottom) || 0);
      if (serit) ekle(out.yapiskan, 's|' + yol(e), { serit: Math.round(serit), yol: yol(e) });
    });
    // yatay kaydırma
    [kok, ...kok.querySelectorAll('*')].forEach((e) => {
      if (gizli(e) || !e.clientWidth) return;
      const cs = getComputedStyle(e);
      if (!/auto|scroll/.test(cs.overflowX)) return;
      const fark = e.scrollWidth - e.clientWidth;
      if (fark > 1) ekle(out.yatay, 'y|' + yol(e), { tasma: fark, en: e.clientWidth, yol: yol(e) });
    });
    return out;
  };
}

// Sayfaya kurulan kaynak: saf fonksiyonlar + kurucu, tek IIFE (global kirletmez).
const KAYNAK = '(function(){' + [ySozcukler, ySatirSayisi, yKirikMi, yKesisim, yTasma, yYapiskanSerit, yCizgiSayilir, yKutudaNoktalar, yKur].map((f) => f.toString()).join('\n')
  + '\nyKur();})()';

async function yerlesimKur(page) { await page.evaluate(KAYNAK); }

// Okunur satırlar: yer · tür · "metin" ölçü. `cizim:false` SVG çizimlerinin
// iki ölçüsünü (küçük yazı · binen) dışarıda bırakır — HTML yazısının kapısı.
function yerlesimOzet(r, yer, opt) {
  const on = yer ? yer + ' · ' : '';
  const cizim = !(opt && opt.cizim === false);
  return [].concat(
    r.kesik.map((x) => `${on}kesik "${x.metin}" ${x.tasma} px ${x.yon} — ${x.kirpan}`),
    r.kirik.map((x) => `${on}kırık "${x.metin}" — ${x.yol}`),
    r.yatay.map((x) => `${on}yatay kaydırma ${x.tasma}/${x.en} px — ${x.yol}`),
    r.kucuk.map((x) => `${on}küçük yazı "${x.metin}" ${x.px} px — ${x.yol}`),
    cizim ? r.kucukSvg.map((x) => `${on}çizimde küçük yazı "${x.metin}" ${x.px} px — ${x.yol}`) : [],
    cizim ? r.binen.map((x) => `${on}binen "${x.a}" ↔ "${x.b}" ${x.x}×${x.y} px — ${x.yol}`) : [],
    cizim ? (r.cizgi || []).map((x) => `${on}çizgi yazıyı kesiyor "${x.metin}" ← ${x.cizgi} — ${x.yol}`) : [],
    (r.yapisik || []).map((x) => `${on}yapışık ad "${x.a}" ↔ "${x.b}" ara ${x.ara} px`),
    r.yapi.map((x) => `${on}alt simge esnek kapta "${x.metin}" (${x.kap}) — ${x.yol}`),
    r.yetim.map((x) => `${on}yetim "${x.metin}" (önceki satır "${x.onceki}") — ${x.yol}`),
    r.yapiskan.map((x) => `${on}yapışkan öğenin altında ${x.serit} px'lik şerit — ${x.yol}`));
}

module.exports = { ySozcukler, ySatirSayisi, yKirikMi, yKesisim, yTasma, yYapiskanSerit, yCizgiSayilir, yKutudaNoktalar, KAYNAK, yerlesimKur, yerlesimOzet };
