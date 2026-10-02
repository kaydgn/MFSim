/**
 * kontrast-olcu.js — EKRANDAKİ YAZI ZEMİNİNE KARŞI OKUNUR MU? (WCAG 2.1 AA)
 * ───────────────────────────────────────────────────────────────────────────
 * `theme-contrast.test.js` PALETİ sınar: her metin jetonu her yüzeyde 4,5:1.
 * Ekrandaki yazı ise renk başka yollardan da alıyordu ve palet testi onları
 * göremez: sabit renk (`#c88a20`), metin olarak ham aksan (`--accent-*`),
 * opaklıkla soldurulmuş jeton (`opacity:.62`). Bu dosya ölçütü TEK yerde
 * tutar; MFSim'in yüzey taraması (tests/e2e/kontrast.spec.js), CAN
 * Çözümleyici ve Ölçüm Görüntüleyici aynı ölçeri sayfaya kurar. Matematiğin
 * kendisi tests/unit/kontrast-olcu.test.js'te düşebiliyor.
 *
 * Ölçülen: görünen her HTML metin düğümünün EKRANDAKİ rengi — atalardan gelen
 * opaklık ve yarı saydam zeminler katman katman birleştirilerek — altındaki
 * dolu zemine karşı. Eşik 4,5:1; büyük yazıda (≥ 24 px ya da ≥ 18,66 px kalın)
 * 3:1. Kapsam dışı (WCAG istisnası ya da DOM'dan zemini okunamayan): devre
 * dışı denetim, `aria-hidden`, SVG/tuval yazısı, kapalı `<details>`, harf ya da
 * rakam taşımayan süs (·, —). Degrade zeminde EN KÖTÜ durak ölçülür; zemini
 * resim olan yazı ATLANIR ve SAYILIR; okunamayan renk biçimi ise ihlal olarak
 * döner — sessiz delik olmasın (Chromium `color-mix()`i `color(srgb …)` diye
 * verir). Alanların (input · select) değeri de ölçülür.
 */

// ── Saf matematik (Node'da test edilir, sayfaya kaynak olarak taşınır) ──────
function kLin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function kLum(r) { return 0.2126 * kLin(r[0]) + 0.7152 * kLin(r[1]) + 0.0722 * kLin(r[2]); }
function kOran(a, b) {
  const L1 = kLum(a), L2 = kLum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
// `a`yı `b`nin ÜSTÜNE koy (a[3] = a'nın alfası). Sonuç opak.
function kUst(a, b) { return [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).concat(1); }
// Hesaplanan CSS rengi → [r, g, b, a] (0–255, 0–1). Tanınmazsa null.
function kRenk(s) {
  s = String(s || '').trim();
  if (s === 'transparent') return [0, 0, 0, 0];
  let m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (p.length < 3 || p.some((x) => !Number.isFinite(x))) return null;
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  m = /^color\(srgb\s+([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1].split(/[\s/]+/).filter(Boolean).map(parseFloat);
    if (p.length < 3 || p.some((x) => !Number.isFinite(x))) return null;
    const k = (v) => Math.max(0, Math.min(255, v * 255));
    return [k(p[0]), k(p[1]), k(p[2]), p.length > 3 ? p[3] : 1];
  }
  return null;
}
// Büyük yazı (WCAG): ≥ 24 px, ya da ≥ 18,66 px ve kalın.
function kEsik(px, agirlik) { return (px >= 24 || (agirlik >= 700 && px >= 18.66)) ? 3 : 4.5; }

// ── Sayfa tarafı: window.__kontrast(kökSeçici) ─────────────────────────────
// Dönen: { kotu: [{metin, oran, px, renk, zemin}], atlanan: sayı, olculen: sayı }
function kKur() {
  const opaklik = (el) => {
    let o = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
    return o;
  };
  // Yazının altındaki zemin: katmanları yukarıdan aşağı topla, alttan üste
  // birleştir. Degrade bir katman DURAKLARININ her biri olarak sayılır ve en
  // kötü durak ölçülür; resim zemini ölçülemez → atla.
  const zemin = (el) => {
    const katman = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const bi = cs.backgroundImage;
      const c = kRenk(cs.backgroundColor);
      if (!c) return { hata: cs.backgroundColor };
      // Küçük, tekrarsız degrade bir SÜS (listenin oku: 3 × 3 px) — yazının
      // altındaki zemin değil; yok sayılır, alanın kendi rengi ölçülür.
      const sus = bi && bi !== 'none' && /no-repeat/.test(cs.backgroundRepeat)
        && (cs.backgroundSize.match(/[\d.]+px/g) || []).length > 0
        && cs.backgroundSize.split(',').every((b) => /^\s*[\d.]+px\s+[\d.]+px\s*$/.test(b) && Math.max(...b.match(/[\d.]+/g).map(Number)) <= 32);
      if (bi && bi !== 'none' && !sus) {
        if (/url\(/.test(bi)) return { atla: true };
        const duraklar = (bi.match(/rgba?\([^)]*\)|color\(srgb[^)]*\)/g) || []).map(kRenk);
        if (!duraklar.length || duraklar.some((d) => !d)) return { atla: true };
        katman.push(duraklar);                       // resim, kendi zemin renginin ÜSTÜNDE
        if (c[3] > 0) katman.push([c]);
        if (duraklar.every((d) => d[3] >= 1) || c[3] >= 1) break;
        continue;
      }
      if (c[3] > 0) { katman.push([c]); if (c[3] >= 1) break; }
    }
    let zler = [[255, 255, 255, 1]];
    for (let i = katman.length - 1; i >= 0; i--) {
      const yeni = [];
      zler.forEach((z) => katman[i].forEach((k) => yeni.push(kUst(k, z))));
      zler = yeni.slice(0, 32);
    }
    return { zler };
  };
  // En kötü zemine karşı oran.
  const enKotu = (fg, zler) => {
    let en = Infinity, zen = null;
    zler.forEach((z) => { const o = kOran(kUst(fg, z), z); if (o < en) { en = o; zen = z; } });
    return { oran: en, z: zen };
  };
  window.__kontrast = (kokSec) => {
    const kok = typeof kokSec === 'string' ? document.querySelector(kokSec) : kokSec;
    const out = { kotu: [], atlanan: 0, olculen: 0 };
    if (!kok) { out.kotu.push({ metin: 'kök yok: ' + kokSec, oran: 0 }); return out; }
    const gor = new Set();
    const tw = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = tw.nextNode())) {
      const s = t.nodeValue.replace(/\s+/g, ' ').trim();
      if (!s || !/[0-9\p{L}%°]/u.test(s)) continue;
      const el = t.parentElement;
      if (!el || el.closest('svg, canvas, script, style, noscript, template, option, [aria-hidden="true"], :disabled, [aria-disabled="true"]')) continue;
      if (el.closest('details:not([open])') && !el.closest('summary')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || cs.display === 'none') continue;
      const rg = document.createRange(); rg.selectNodeContents(t);
      const r = [...rg.getClientRects()].find((q) => q.width > 1 && q.height > 1);
      if (!r || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
      const fg = kRenk(cs.color);
      const zz = zemin(el);
      const anahtar = (x) => s.slice(0, 28) + '|' + cs.color + '|' + x;
      if (!fg || zz.hata) {
        const k = anahtar('?');
        if (!gor.has(k)) { gor.add(k); out.kotu.push({ metin: s.slice(0, 40), oran: 0, px: parseFloat(cs.fontSize), renk: 'okunamadı: ' + (fg ? zz.hata : cs.color) }); }
        continue;
      }
      if (zz.atla) { out.atlanan++; continue; }
      const a = fg[3] * opaklik(el);
      if (a <= 0) continue;
      out.olculen++;
      const ek = enKotu([fg[0], fg[1], fg[2], a], zz.zler);
      const oran = ek.oran;
      const px = parseFloat(cs.fontSize);
      if (oran + 1e-6 < kEsik(px, parseInt(cs.fontWeight, 10))) {
        const k = anahtar(Math.round(oran * 100));
        if (gor.has(k)) continue;
        gor.add(k);
        out.kotu.push({ metin: s.slice(0, 40), oran: Math.round(oran * 100) / 100, px, renk: cs.color,
          zemin: 'rgb(' + ek.z.slice(0, 3).map(Math.round).join(',') + ')' });
      }
    }
    // Alanın DEĞERİ metin düğümü değil (salt okunur sonuç alanları dâhil):
    // ayrıca ölçülür. Yer tutucu kapsam dışı.
    kok.querySelectorAll('input, select, textarea').forEach((el) => {
      if (/^(checkbox|radio|range|color|hidden|file|button|submit|reset|image)$/.test(el.type || '')) return;
      if (el.disabled || el.closest('[aria-hidden="true"], details:not([open])')) return;
      const s = (el.tagName === 'SELECT' ? (el.selectedOptions[0] || {}).text : el.value) || '';
      if (!/[0-9\p{L}%°]/u.test(s)) return;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (cs.visibility !== 'visible' || !r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return;
      const fg = kRenk(cs.color), zz = zemin(el);
      if (!fg || zz.hata) { out.kotu.push({ metin: s.slice(0, 40), oran: 0, px: parseFloat(cs.fontSize), renk: 'okunamadı: ' + (fg ? zz.hata : cs.color) }); return; }
      if (zz.atla) { out.atlanan++; return; }
      out.olculen++;
      const ek = enKotu([fg[0], fg[1], fg[2], fg[3] * opaklik(el)], zz.zler);
      const oran = ek.oran;
      const px = parseFloat(cs.fontSize);
      if (oran + 1e-6 < kEsik(px, parseInt(cs.fontWeight, 10))) {
        const k = s.slice(0, 28) + '|' + cs.color + '|' + Math.round(oran * 100);
        if (gor.has(k)) return;
        gor.add(k);
        out.kotu.push({ metin: '⟨alan⟩ ' + s.slice(0, 34), oran: Math.round(oran * 100) / 100, px, renk: cs.color,
          zemin: 'rgb(' + ek.z.slice(0, 3).map(Math.round).join(',') + ')' });
      }
    });
    return out;
  };
}

// Sayfaya kurulan kaynak: saf fonksiyonlar + kurucu, tek IIFE (global kirletmez).
const KAYNAK = '(function(){' + [kLin, kLum, kOran, kUst, kRenk, kEsik, kKur].map((f) => f.toString()).join('\n')
  + '\nkKur();})()';

async function kontrastKur(page) { await page.evaluate(KAYNAK); }

// Ölçüm listesini okunur satırlara çevir (yer · "metin" oran:1 @ px renk / zemin).
function kontrastOzet(liste) {
  return liste.map((x) => `${x.yer ? x.yer + ' · ' : ''}"${x.metin}" ${x.oran}:1 @ ${x.px}px ${x.renk}${x.zemin ? ' / ' + x.zemin : ''}`);
}

module.exports = { kLin, kLum, kOran, kUst, kRenk, kEsik, KAYNAK, kontrastKur, kontrastOzet };
