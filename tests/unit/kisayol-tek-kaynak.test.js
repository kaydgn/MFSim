/**
 * kisayol-tek-kaynak.test.js — KISAYOL LİSTESİ TEK, VE GERÇEK
 * ───────────────────────────────────────────────────────────────────────
 * Ayarlar → Klavye kısayolları kendi tablosunu tutuyordu ve "?" penceresinden
 * ayrışmıştı: "Mouse: Sol sürükle → Canvas alanını kaydır" yazıyordu; oysa sol
 * sürükleme SEÇİM KUTUSU açar, kaydırma sağ tıkla (ui-core.js). Liste artık
 * tek çiziciden (shortcuts-help.js → veKisayolGruplariHTML) ve buradaki kapı
 * listenin her satırının programda bir dinleyicisi olduğunu ölçer — yazılan
 * kısayol çalışmalı. Mac'te pencere ⌘ yazıyor; Kaydet/Geri al/İleri al
 * dinleyicisi yalnız Ctrl'e bakıyordu, Kaydet ise listede hiç yoktu.
 */
const fs = require('fs');
const path = require('path');

const JS = (f) => fs.readFileSync(path.join(__dirname, '../../js', f), 'utf8');

const stubs = stubGlobals();
eval(loadSource('shortcuts-help.js'));
eval(loadSource('settings.js'));
beforeEach(() => resetStubs(stubs));

const UI = JS('ui-core.js'), STATE = JS('state.js'), CMDK = JS('command-palette.js');

// Tuş → onu dinleyen kaynak. Değiştirici ⌘/Ctrl her ikisini de kabul etmeli.
const DINLEYICI = {
  Z: [STATE, /\(e\.key === 'z' \|\| e\.key === 'Z'\)/],
  Y: [STATE, /\(e\.key === 'y' \|\| e\.key === 'Y'\)/],
  S: [STATE, /\(e\.key === 's' \|\| e\.key === 'S'\)/],
  C: [UI, /\(e\.ctrlKey \|\| e\.metaKey\) && e\.key === 'c'/],
  V: [UI, /\(e\.ctrlKey \|\| e\.metaKey\) && e\.key === 'v'/],
  A: [UI, /\(e\.ctrlKey \|\| e\.metaKey\) && e\.key === 'a'/],
  D: [UI, /\(e\.ctrlKey \|\| e\.metaKey\) && e\.key === 'd'/],
  K: [CMDK, /\(e\.ctrlKey \|\| e\.metaKey\)[^\n]*e\.key === 'k'/],
};

describe('kısayol listesi tek kaynaktan', () => {
  test('Ayarlar bölümü kısayol penceresinin çizicisini kullanır — her satır orada', () => {
    const html = _veSettingsRenderShortcuts();
    const satir = _veHelpGroups().reduce((n, g) => n + g.items.length, 0);
    expect(satir).toBeGreaterThan(10);
    expect((html.match(/class="ve-help-row"/g) || []).length).toBe(satir);
    _veHelpGroups().forEach((g) => g.items.forEach((it) => expect(html).toContain(it.label)));
  });

  test('eski yanlış satır yok: sol sürükleme kaydırmaz', () => {
    const html = _veSettingsRenderShortcuts();
    expect(html).not.toMatch(/Canvas alanını kaydır|Sol sürükle/);
    expect(JS('settings.js')).not.toMatch(/\['Mouse:/);
  });
});

describe('listedeki her kısayolun programda dinleyicisi var', () => {
  const kisayollar = () => [].concat(..._veHelpGroups().map((g) => g.items));

  test('değiştiricili tuşlar: dinleyici var ve ⌘ (metaKey) da kabul ediliyor', () => {
    const tuslar = kisayollar().filter((it) => it.keys.length === 2 && /^[A-Z]$/.test(it.keys[1])).map((it) => it.keys[1]);
    expect(tuslar).toEqual(expect.arrayContaining(['Z', 'Y', 'C', 'V', 'D', 'A', 'K', 'S']));
    tuslar.forEach((t) => {
      const d = DINLEYICI[t];
      expect(`${t}: ${!!d}`).toBe(`${t}: true`);
      expect(d[0]).toMatch(d[1]);
    });
    // state.js'in üç kısayolu ortak değiştiriciden geçer
    expect(STATE).toMatch(/var mod = e\.ctrlKey \|\| e\.metaKey;/);
    expect(STATE).not.toMatch(/if\(e\.ctrlKey && \(e\.key === 'z'/);
  });

  test('fare: sol sürükle seçim kutusu, sağ tık + sürükle kaydırır', () => {
    const fare = kisayollar().filter((it) => /sürükle/.test(it.keys.join(' ')));
    const sol = fare.find((it) => it.keys[0] === 'Sol');
    const sag = fare.find((it) => it.keys[0] === 'Sağ tık');
    expect(sol.label).toMatch(/Seçim kutusu/);
    expect(sag.label).toMatch(/kaydır/);
    expect(UI).toMatch(/if\(e\.button === 2\) \{ \/\/ Sağ tık - pan[\s\S]{0,200}isPanning = true/);
    expect(UI).toMatch(/if\(e\.button === 0\) \{ \/\/ Sol tık[\s\S]{0,1500}isSelecting = true/);
  });
});
