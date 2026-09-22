/**
 * komut-kapsami.test.js — PALET ŞERİDİ KAPSIYOR MU?
 * ──────────────────────────────────────────────────
 *
 * Şerit gövdesi artık VARSAYILAN OLARAK KATLI açılıyor (üst bant Atölye
 * maketine geçti: marka · modül adı · komut arama · birincil eylem). Bu, tek
 * bir koşulla meşru: şeritteki her komut palette de bulunabilsin.
 *
 * Koşul sağlanmazsa hata SESSİZDİR — komut kaybolmaz, sadece BULUNAMAZ.
 * Kullanıcı şeridi açmayı bilmiyorsa o komut yok demektir ve hiçbir test
 * bunu görmez: fonksiyon duruyor, çağrısı duruyor, düğmesi ekranda değil.
 *
 * ÖLÇÜLDÜ (2026-09-22): şerit 42 komut, palet 30 — ON BİRİ palette YOKTU
 * (sınır çerçevesi, kılavuzlar, Komuta penceresi, radyo ve Sonuç sayfasının
 * beş şerit komutu).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const rb = fs.readFileSync(path.join(ROOT, 'js/ribbon.js'), 'utf8');
const cp = fs.readFileSync(path.join(ROOT, 'js/command-palette.js'), 'utf8');

const seritKomutlari = [...new Set(
  [...rb.matchAll(/run:\s*'([A-Za-z]+)'/g)].map((m) => m[1])
)].sort();

const paletBlok = cp.slice(
  cp.indexOf('function _cmdkStaticCommands'),
  cp.indexOf('// Aktif modülün')
);
const paletKomutlari = [...new Set(
  [...paletBlok.matchAll(/_cmdkCall\(\s*'([A-Za-z]+)'/g)].map((m) => m[1])
)].sort();

// TEK MEŞRU İSTİSNA: paleti açan komut palette aranmaz. Kendini açan bir
// satır, açıkken zaten oradadır — ve listeye konması onu her aramada
// gürültüye çevirirdi.
const ISTISNA = ['veCmdkOpen'];

describe('komut paleti şeridi kapsıyor', () => {
  test('iki kaynak da okunabildi (regex kayması erken yakalansın)', () => {
    expect(seritKomutlari.length).toBeGreaterThan(30);
    expect(paletKomutlari.length).toBeGreaterThan(30);
    expect(paletBlok.length).toBeGreaterThan(2000);
  });

  test('şeritteki HER komut palette de var', () => {
    const eksik = seritKomutlari
      .filter((k) => ISTISNA.indexOf(k) < 0)
      .filter((k) => paletKomutlari.indexOf(k) < 0);
    expect(eksik).toEqual([]);
  });

  // İSTİSNA LİSTESİ YALNIZ AŞAĞI İNER: bir komutu "istisna" ilan ederek
  // kapıdan kaçmak, kapının kendisini kaldırmaktır.
  test('istisna listesi TEK maddede kalıyor', () => {
    expect(ISTISNA).toEqual(['veCmdkOpen']);
    // ve o madde gerçekten şeritte var (ölü bir istisna taşımayalım)
    expect(seritKomutlari).toContain('veCmdkOpen');
  });

  test('palet komutları GERÇEK global fonksiyonlara bağlı', () => {
    // `_cmdkCall` adı dizeyle çağırıyor; yazım hatası çalışma anında sessizce
    // hiçbir şey yapardı. Her ad şeritte ya da js/ içinde tanımlı olmalı.
    const kaynak = fs.readdirSync(path.join(ROOT, 'js'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'))
      .join('\n');
    const tanimsiz = paletKomutlari.filter((k) =>
      !new RegExp('function\\s+' + k + '\\s*\\(').test(kaynak)
      && !new RegExp('\\b' + k + '\\s*[:=]\\s*function').test(kaynak));
    expect(tanimsiz).toEqual([]);
  });
});
