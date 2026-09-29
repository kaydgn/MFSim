/**
 * fead-surucu-pencere.test.js — SÜRÜCÜ KASNAĞIN PENCERESİ · İŞLETME DEPOSU ·
 * KAYNAKLI VARSAYILANLAR · AKSESUAR MODEL SEÇİCİSİ · ÇÖZÜCÜNÜN YÖNTEMLERİ
 *
 * Kullanıcı isteği (2026-09-28): motor, FEAD tahriki ve çalışma çevrimi
 * Çözücü'den KRANK KASNAĞINA; tasarım KAYIŞA; Çözücü'de yalnız sayısal
 * yöntemler. Atalet "silik" değil DEĞERİYLE yazılır, kaynağı 'i'de;
 * pencereden seçilen aksesuar modeli "bayat" kalmaz.
 *
 * Kapılar — her biri düzeltme geri alınınca DÜŞER (PR'de ölçüldü):
 *   TOHUM     çevrim sürücünün penceresi İLK kurulurken dolu
 *   DEPO      sürücünün sekmeleri depoya yazar; AÇIK pencere yeniden kurulur
 *   ATALET    pencerede yazan sayı = hesaba giren sayı (12 örnek, 52 kasnak)
 *   İPUCU     'i' metni ve varsayılan AYNI örneklemden
 *   MODEL     seçilen model çevrime ULAŞIR (elle kW silinir, yük eğriyi izler)
 *   MOTOR     devir sınırları ve eğri motordan; FEAD payı
 *   YÖNTEMLER listedeki her çağrı kodda var
 */
const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;
// Araç Performans katalogları ve ara değerleyicisi GLOBAL'de olmalı:
// `veFeadPresetLib` / `veFeadAutoKw` onları orada arıyor. Yüklenmezse AP
// modeli hiçbir yük getirmez ve MODEL kapısı yanlış sebepten düşer.
eval(loadSource('cp-accessories.js'));
global.VE_ALTERNATOR_PRESETS = VE_ALTERNATOR_PRESETS;
global.VE_AC_PRESETS = VE_AC_PRESETS;
global.VE_AIRCOMP_PRESETS = VE_AIRCOMP_PRESETS;
global.veAccInterpCurve = veAccInterpCurve;

const M = require('../../js/fead-model.js');
Object.keys(M).forEach((k) => { if (global[k] === undefined) global[k] = M[k]; });
global.FEADCore = require('../../js/fead-core.js');
['fead-accessories', 'fead-tensioners', 'fead-engines', 'fead-checks', 'fead-duty',
 'fead-belts', 'fead-transient'].forEach((f) => {
  const m = require('../../js/' + f + '.js');
  Object.keys(m).forEach((k) => { if (global[k] === undefined) global[k] = m[k]; });
});
const fead = require('../../js/cp-fead.js');
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });

const D = M.VE_FEAD_DEFAULTS;
const O = M.VE_FEAD_ORNEKLEM;

function ornek(key) {
  const pack = veFeadExampleNodes(key || 'AG00976_GATES_2025');
  global.nodes = pack.nodes.map((n) => ({
    id: n.id, type: n.type, def: componentDefs[n.type],
    customName: n.customName, data: JSON.parse(JSON.stringify(n.data)) }));
  return global.nodes;
}
const dugum = (id) => global.nodes.find((n) => n.id === id);
const depo = () => veFeadIsletmeDeposu(global.nodes);
const kopru = () => veFeadBuildFromCanvas();
const ciz = (html) => {
  const k = document.createElement('div');
  k.innerHTML = html;
  document.body.appendChild(k);
  return k;
};
function pencere(n) {
  const d = componentDefs[n.type] || {};
  if (d.isFeadTensioner) return getFeadTensionerPropertiesHTML(n);
  if (d.isFeadPulley) return getFeadPulleyPropertiesHTML(n);
  if (d.isFeadBelt) return getFeadBeltPropertiesHTML(n);
  if (d.isFeadSolver) return getFeadSolverPropertiesHTML(n);
  return '';
}
const sekme = (kap, k) => kap.querySelector('[id^="ve-fp-panes-"] > [data-k="' + k + '"]');
const motorEgrili = () => veFeadEngineList().map((e) => e.key)
  .find((k) => (veFeadEngineOf(k).curve || []).length >= 2);
const medyan = (a) => {
  const v = a.slice().sort((x, y) => x - y);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const ort = (a) => a.reduce((s, x) => s + x, 0) / a.length;

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  delete global._veLastPropNodeId;
  document.body.innerHTML = '<div id="ve-canvas"></div>';
});

// ═══════════════════════════════════════════════════════════════════════════
describe('TOHUM — çevrim sürücünün penceresi İLK kurulurken dolu', () => {
  test('tohumsuz depo: pencere kurulunca varsayılan çevrim yüklü ve Çevrim sekmesinde satırlar var', () => {
    ornek();
    const sv = depo();
    delete sv.data.duty; delete sv.data.dutySeeded; delete sv.data.dutyLib;
    const kap = ciz(getFeadPulleyPropertiesHTML(dugum('ex-FAN')));
    const n = veFeadDutyRowsOf(VE_FEAD_DUTY_DEFAULT).length;
    expect(n).toBeGreaterThan(0);
    expect(sv.data.duty.length).toBe(n);
    expect(sv.data.dutyLib).toBe(VE_FEAD_DUTY_DEFAULT);
    expect(sekme(kap, 'cev').querySelectorAll(
      'input[onchange*="veFeadDutySet(\'ex-solver\',"][onchange*=",\'rpm\',"]').length).toBe(n);
  });

  test('kullanıcının boşalttığı tablo (tohum atılmış) YENİDEN doldurulmaz', () => {
    ornek();
    Object.assign(depo().data, { duty: [], dutySeeded: true });
    getFeadPulleyPropertiesHTML(dugum('ex-FAN'));
    expect(depo().data.duty).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('DEPO — veri çözücü düğümünde, pencere sürücününki', () => {
  test('motor seçimi depoya yazar ve AÇIK pencereyi (sürücü) kurar — Çözücü\'nünkini değil', () => {
    ornek();
    global._veLastPropNodeId = 'ex-FAN';
    const key = motorEgrili();
    veFeadApplyEngineLib('ex-solver', key);
    expect(depo().data.engineLib).toBe(key);
    expect(stubs.showNodeProperties).toHaveBeenCalledTimes(1);
    expect(stubs.showNodeProperties.mock.calls[0][0].id).toBe('ex-FAN');
  });

  test('çevrime satır eklemek de açık pencereyi kurar; açık pencere yoksa yazılan düğüm', () => {
    ornek();
    const satir = depo().data.duty.length;
    global._veLastPropNodeId = 'ex-FAN';
    veFeadDutyAdd('ex-solver');
    expect(depo().data.duty.length).toBe(satir + 1);
    expect(stubs.showNodeProperties.mock.calls.pop()[0].id).toBe('ex-FAN');
    delete global._veLastPropNodeId;
    veFeadDutyAdd('ex-solver');
    expect(stubs.showNodeProperties.mock.calls.pop()[0].id).toBe('ex-solver');
  });

  test('sürücü kasnak SİLİNSE de motor ve çevrim durur; yeni sürücü aynı depoyu gösterir', () => {
    ornek();
    const key = motorEgrili();
    veFeadApplyEngineLib('ex-solver', key);
    const satir = depo().data.duty.length;
    global.nodes = global.nodes.filter((n) => n.id !== 'ex-FAN');
    dugum('ex-ALT').data.driver = true;
    expect(depo().data.duty.length).toBe(satir);
    const kap = ciz(getFeadPulleyPropertiesHTML(dugum('ex-ALT')));
    expect(sekme(kap, 'mot').querySelector('select[onchange*="veFeadApplyEngineLib(\'ex-solver\'"]').value)
      .toBe(key);
    expect(sekme(kap, 'cev').querySelectorAll('input[onchange*=",\'rpm\',"]').length).toBe(satir);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Beklenen: modelin KENDİ kullandığı sayı (build), pencereninkinden bağımsız.
function kullanilan(tur, n, b) {
  const i = b.order.findIndex((x) => x.id === n.id);
  if (tur === 'kasnak' || tur === 'gergi-kasnak' || tur === 'krank') return b.sys.pulleys[i].inertiaKgM2;
  if (tur === 'gergi-kol') return b.sys.tensioner.armInertiaKgM2;
  if (tur === 'gergi-kutle') return b.sys.tensioner.pulleyMassKg || 0;
  if (tur === 'boy-ofseti') return b.cfg.lengthOffsetMm;
  if (tur === 'kayis-kutle') return b.sys.belt.massPerRibKgM;
  if (tur === 'kayis-tolerans') return b.sys.belt.tolerance;
  if (tur === 'kayis-asinma') return b.sys.belt.wearPct;
  throw new Error('bilinmeyen tür ' + tur);
}

describe('ATALET — pencerede yazan sayı hesaba giren sayı', () => {
  const ORNEKLER = Object.keys(M.VE_FEAD_EXAMPLES);

  test('12 örnek: her kasnakta TEK atalet alanı ve değeri modelinki; gergi, boy ofseti, kayışın kütlesi, toleransı ve aşınması da', () => {
    let kasnakAlani = 0, kasnak = 0;
    const sayac = {}, fark = [];
    ORNEKLER.forEach((key) => {
      ornek(key);
      const b = kopru();
      expect({ key, ok: b.ok }).toEqual({ key, ok: true });
      kasnak += b.order.length;
      global.nodes.forEach((n) => {
        const kap = ciz(pencere(n));
        const alanlar = [...kap.querySelectorAll('[data-ve-varsayilan]')];
        const atalet = alanlar.filter((el) => /^(kasnak|krank|gergi-kasnak)$/.test(el.getAttribute('data-ve-varsayilan')));
        if (b.order.includes(n)) expect({ n: n.id, atalet: atalet.length }).toEqual({ n: n.id, atalet: 1 });
        kasnakAlani += atalet.length;
        alanlar.forEach((el) => {
          const tur = el.getAttribute('data-ve-varsayilan');
          sayac[tur] = (sayac[tur] || 0) + 1;
          const inp = el.querySelector('input');
          expect(inp.hasAttribute('placeholder')).toBe(false);          // silik değil — DEĞER
          const v = Number(inp.value), ist = kullanilan(tur, n, b);
          if (!(inp.value !== '' && Math.abs(v - ist) <= 1e-12)) fark.push([key, n.id, tur, inp.value, ist]);
          if (tur === 'krank') expect(b.order.indexOf(n)).toBe(b.sys._crkIdx);
        });
        kap.remove();
      });
    });
    expect(fark).toEqual([]);
    expect(kasnak).toBe(52);
    expect(kasnakAlani).toBe(kasnak);
    expect(sayac).toEqual({ krank: 12, kasnak: 28, 'gergi-kasnak': 12, 'gergi-kol': 12,
                            'gergi-kutle': 12, 'boy-ofseti': 12, 'kayis-kutle': 12,
                            'kayis-tolerans': 12, 'kayis-asinma': 12 });
  });

  test('burulma modelinin krank serbestliği de AYNI sayı (çözücünün geçirdiği opsiyonla)', () => {
    ORNEKLER.forEach((key) => {
      ornek(key);
      const b = kopru();
      const i = b.sys._crkIdx;
      const o = veFeadTorsionalOpt(b, { crankInertia: Number(b.solver.data.crankInertia) || 0 });
      const J = o.inertias ? o.inertias[b.names[i]] : b.sys.pulleys[i].inertiaKgM2;
      const kap = ciz(pencere(b.order[i]));
      expect({ key, J: Number(kap.querySelector('[data-ve-varsayilan="krank"] input').value) })
        .toEqual({ key, J });
      kap.remove();
    });
  });

  test('alanlar BOŞKEN: değer varsayılanın kendisi, kaynak "varsayilan" ve hesap onu kullanıyor', () => {
    ornek('BMC_FEAD_2026');
    global.nodes.forEach((n) => {
      ['inertia', 'armInertia', 'pulleyMass', 'massPerRibKgM', 'tolerance', 'wearPct']
        .forEach((k) => { delete n.data[k]; });
    });
    delete depo().data.crankInertia;
    delete depo().data.lengthOffsetMm;
    const b = kopru();
    let n = 0;
    global.nodes.forEach((x) => {
      const kap = ciz(pencere(x));
      kap.querySelectorAll('[data-ve-varsayilan]').forEach((el) => {
        const tur = el.getAttribute('data-ve-varsayilan');
        expect({ x: x.id, tur, k: el.getAttribute('data-kaynak') }).toEqual({ x: x.id, tur, k: 'varsayilan' });
        expect(Number(el.querySelector('input').value)).toBe(kullanilan(tur, x, b));
        n++;
      });
      kap.remove();
    });
    expect(n).toBe(12);                     // 6 kasnak + kol + kütle + ofset + kayışın üçü
    const J = (id) => b.sys.pulleys[b.order.findIndex((x) => x.id === id)].inertiaKgM2;
    expect(J('ex-SRC')).toBe(D.crankInertiaKgM2);
    expect(J('ex-A_C')).toBe(D.inertiaKgM2['fead-ac']);
    expect(b.sys.tensioner.armInertiaKgM2).toBe(D.tenArmInertiaKgM2);
    expect(b.cfg.lengthOffsetMm).toBe(D.lengthOffsetMm);
  });

  // Pencere her kayışta soluk bir '6' yazıyordu; köprü 1.400 mm'den kısada 5
  // kullanıyor (12 örneğin 7'si o boyda). Serbest kipte basamağı ÇÖZÜLEN boy seçer.
  test('tolerans basamağı KULLANILAN boydan: kısa kayışta 5, uzunda 6 — pencere de hesap da', () => {
    [['AG0868_4PK_GATES_2022', 5], ['AG00976_GATES_2025', 6]].forEach(([key, beklenen]) => {
      ornek(key);
      const belt = global.nodes.find((x) => x.type === 'fead-belt');
      delete belt.data.tolerance;
      const b = kopru();
      expect({ key, t: b.sys.belt.tolerance }).toEqual({ key, t: beklenen });
      const el = ciz(pencere(belt)).querySelector('[data-ve-varsayilan="kayis-tolerans"]');
      expect({ key, v: Number(el.querySelector('input').value), k: el.getAttribute('data-kaynak') })
        .toEqual({ key, v: beklenen, k: 'varsayilan' });
      expect(el.querySelector('.ve-fp-i').getAttribute('data-ipucu')).toMatch(/Gates basamağı/);
      document.body.innerHTML = '';
    });
    // SERBEST kipte girilmiş boy yok: basamağı ÇÖZÜLEN boy seçer (≈1.715 mm → 6).
    // Girilen boya bakan pencere burada 5 yazardı.
    ornek('BMC_FEAD_2026');
    const belt = global.nodes.find((x) => x.type === 'fead-belt');
    delete belt.data.tolerance; delete belt.data.effLength;
    const b = kopru();
    expect(veFeadBeltMode(belt.data)).toBe('free');
    expect(b.sys.belt.effLength).toBeGreaterThan(D.beltTolBreakMm);
    expect(b.sys.belt.tolerance).toBe(D.beltTolLongMm);
    expect(Number(ciz(pencere(belt)).querySelector('[data-ve-varsayilan="kayis-tolerans"] input').value))
      .toBe(D.beltTolLongMm);
  });

  test('eski kayıt: krank boş, sürücünün KENDİ ataleti dolu → pencere de hesap da onu okur, kaynak "kasnak"', () => {
    ornek('BMC_FEAD_2026');
    delete depo().data.crankInertia;
    dugum('ex-SRC').data.inertia = 0.064;
    const b = kopru();
    expect(b.sys.pulleys[b.sys._crkIdx].inertiaKgM2).toBe(0.064);
    const el = ciz(pencere(dugum('ex-SRC'))).querySelector('[data-ve-varsayilan="krank"]');
    expect(el.getAttribute('data-kaynak')).toBe('kasnak');
    expect(Number(el.querySelector('input').value)).toBe(0.064);
  });

  test('sürücüde krank mili ataleti kasnağın kendi alanından ÖNCE gelir — rapor 0,064 basıyordu', () => {
    ornek('BMC_FEAD_2026');
    expect(Number(depo().data.crankInertia)).toBe(0.7);
    dugum('ex-SRC').data.inertia = 0.064;
    const b = kopru();
    expect(b.sys.pulleys[b.sys._crkIdx].inertiaKgM2).toBe(0.7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("İPUCU — 'i' metni ve varsayılan AYNI örneklemden", () => {
  test('her varsayılan örneklemin medyanı (boy ofseti: ortalaması)', () => {
    const ayni = (a, b) => Math.abs(a - b) < 1e-12;           // (0,0002 + 0,0004)/2 kayan nokta
    ['fead-idler', 'fead-ac', 'fead-alternator', 'fead-tensioner'].forEach((t) =>
      expect({ t, ayni: ayni(D.inertiaKgM2[t], medyan(O[t])) }).toEqual({ t, ayni: true }));
    expect(ayni(D.crankInertiaKgM2, medyan(O.krank))).toBe(true);
    expect(ayni(D.tenArmInertiaKgM2, medyan(O.gergiKol))).toBe(true);
    expect(ayni(D.tenPulleyMassKg, medyan(O.gergiKutle))).toBe(true);
    expect(D.lengthOffsetMm).toBeCloseTo(ort(O.boyOfseti), 1);
  });

  test('metin örneklem sayısını, istatistiği ve aralığı örneklemden yazar; örneklemsizde kaynak YOK', () => {
    Object.keys(O).forEach((k) => {
      const s = O[k].slice().sort((a, b) => a - b);
      const t = veFeadVarsayilanKaynagi(k);
      expect(t).toMatch(/^Gates /);
      expect(t).toContain(s.length + ' ölçümün ' + (k === 'boyOfseti' ? 'ortalaması' : 'medyanı'));
      expect(t).toContain('(' + veSayi(s[0]) + ' … ' + veSayi(s[s.length - 1]) + ')');
    });
    expect(veFeadVarsayilanKaynagi('fead-waterpump')).toBe('');
  });

  test("pencerede: varsayılanın 'i'si kaynağı söyler; yazınca 'Girilen değer', silince varsayılan DEĞER olarak döner", () => {
    ornek('BMC_FEAD_2026');
    delete dugum('ex-A_C').data.inertia;
    const kap = ciz(getFeadPulleyPropertiesHTML(dugum('ex-A_C')));
    const el = () => kap.querySelector('[data-ve-varsayilan="kasnak"]');
    const ib = () => el().querySelector('.ve-fp-i');
    const idx = () => { const b = kopru(); return b.sys.pulleys[b.order.findIndex((x) => x.id === 'ex-A_C')]; };
    expect(el().getAttribute('data-kaynak')).toBe('varsayilan');
    expect(el().querySelector('input').value).toBe(String(D.inertiaKgM2['fead-ac']));
    expect(ib().getAttribute('data-ipucu')).toBe('Varsayılan — ' + veFeadVarsayilanKaynagi('fead-ac')
      + '. Alan boş kaldıkça hesaba bu değer girer.');
    expect(ib().getAttribute('aria-label')).toBe(ib().getAttribute('data-ipucu'));

    veFeadVarsayilanSet('ex-A_C', 'inertia', '0.0123', 'ex-A_C');
    expect(dugum('ex-A_C').data.inertia).toBe('0.0123');
    expect(el().getAttribute('data-kaynak')).toBe('elle');
    expect(ib().getAttribute('data-ipucu')).toMatch(/^Girilen değer/);
    expect(idx().inertiaKgM2).toBe(0.0123);

    veFeadVarsayilanSet('ex-A_C', 'inertia', '', 'ex-A_C');
    expect('inertia' in dugum('ex-A_C').data).toBe(false);
    expect(el().querySelector('input').value).toBe(String(D.inertiaKgM2['fead-ac']));
    expect(el().getAttribute('data-kaynak')).toBe('varsayilan');
    expect(idx().inertiaKgM2).toBe(D.inertiaKgM2['fead-ac']);
  });

  test('ipucu kutusu: üstüne gelince ve odakla açılır, BELGENİN GÖVDESİNDE durur, çıkınca kapanır', () => {
    ornek('BMC_FEAD_2026');
    const kap = ciz(getFeadPulleyPropertiesHTML(dugum('ex-A_C')));
    const btn = kap.querySelector('[data-ve-varsayilan] .ve-fp-i');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.querySelector('.mf-ico')).toBeTruthy();                 // tek ikon ailesi
    btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const ip = document.querySelector('.ve-ipucu');
    expect(ip).toBeTruthy();
    expect(ip.parentNode).toBe(document.body);                         // kaydırma kabı kırpmasın
    expect(ip.getAttribute('role')).toBe('tooltip');
    expect(ip.textContent).toBe(btn.getAttribute('data-ipucu'));
    expect(ip.hidden).toBe(false);
    btn.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    expect(ip.hidden).toBe(true);
    btn.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(ip.hidden).toBe(false);
    btn.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(ip.hidden).toBe(true);
  });

  test('ipucu düğmesinden UZUN YAŞAMAZ: başka öğe, tık, ESC ve pencerenin yeniden kurulması kapatır', async () => {
    ornek('BMC_FEAD_2026');
    const kap = ciz(getFeadPulleyPropertiesHTML(dugum('ex-A_C')));
    const btn = () => kap.querySelector('[data-ve-varsayilan] .ve-fp-i');
    const ac = () => btn().dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const ip = () => document.querySelector('.ve-ipucu');
    ac(); expect(ip().hidden).toBe(false);
    kap.querySelector('input').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(ip().hidden).toBe(true);                                    // başka öğe
    ac(); document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(ip().hidden).toBe(true);                                    // tık
    ac();
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const alttaki = jest.fn();
    document.addEventListener('keydown', alttaki);
    document.body.dispatchEvent(esc);
    document.removeEventListener('keydown', alttaki);
    expect(ip().hidden).toBe(true);                                    // ESC önce ipucunu kapatır
    expect(alttaki).not.toHaveBeenCalled();                            // tek tuş, tek katman
    ac(); kap.innerHTML = getFeadPulleyPropertiesHTML(dugum('ex-ALT')); // pencere yeniden kuruldu
    await new Promise((r) => setTimeout(r, 400));
    expect(ip().hidden).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('MODEL — seçilen aksesuar modeli çevrime ULAŞIR', () => {
  // Ölçülen bildirim (AG00976 alternatör): pencereden BMC künyesi de AP modeli
  // de seçilse on iki satırın yükü 3,61 … 4,02 kW'ta KALIYORDU.
  const altYuk = () => {
    const b = kopru();
    const i = b.order.findIndex((n) => n.id === 'ex-ALT');
    return veFeadDutyToCore(b, veFeadDutyRows(b.solver)).map((r) => r.loadsKw[b.names[i]]);
  };
  const altDevir = () => {
    const b = kopru();
    const i = b.order.findIndex((n) => n.id === 'ex-ALT');
    return veFeadDutyRows(b.solver).filter((r) => r.rpm > 0)
      .map((r) => FEADCore.accessoryRpm(b.sys, i, r.rpm));
  };
  const secenek = (on, sart) => veFeadAccModelOpts('fead-alternator').map((o) => o[0])
    .find((v) => v.indexOf(on) === 0 && sart(v));

  test('BMC künyesi: elle kW\'lar silinir, yük künyenin eğrisini izler', () => {
    ornek();
    const once = altYuk();
    const elle = veFeadDutyElleKw(veFeadDutyRows(depo()), 'ex-ALT');
    expect(elle).toBeGreaterThan(0);
    expect(ciz(getFeadPulleyPropertiesHTML(dugum('ex-ALT'))).textContent).toMatch(/elle kW yazılı/);

    const val = secenek('bmc:', (v) => (veFeadAccOf(v.slice(4)).curve || []).length >= 2);
    veFeadApplyAccModel('ex-ALT', val);
    expect(veFeadDutyElleKw(veFeadDutyRows(depo()), 'ex-ALT')).toBe(0);
    expect(stubs.showToast.mock.calls.pop()[0]).toContain(elle + ' elle kW silindi');

    const egri = veFeadPowerCurve({ data: { pwrCurve: veFeadAccOf(val.slice(4)).curve } });
    const sonra = altYuk();
    altDevir().forEach((rpm, r) => expect(sonra[r]).toBeCloseTo(veFeadInterpKw(egri, rpm), 9));
    expect(sonra).not.toEqual(once);
    document.body.innerHTML = '';
    expect(ciz(getFeadPulleyPropertiesHTML(dugum('ex-ALT'))).textContent).not.toMatch(/elle kW yazılı/);
  });

  const apSec = () => secenek('ap:', (v) => (VE_ALTERNATOR_PRESETS[v.slice(3)].curve || []).length >= 2);

  test('Araç Performans modeli: elle kW\'lar silinir, yük katalog eğrisini izler, eğri PENCEREDE', () => {
    ornek();
    expect(veFeadDutyElleKw(veFeadDutyRows(depo()), 'ex-ALT')).toBeGreaterThan(0);
    const val = apSec(), pre = VE_ALTERNATOR_PRESETS[val.slice(3)];
    veFeadApplyAccModel('ex-ALT', val);
    expect(dugum('ex-ALT').data.accPreset).toBe(val.slice(3));
    expect(veFeadDutyElleKw(veFeadDutyRows(depo()), 'ex-ALT')).toBe(0);
    const sonra = altYuk();
    altDevir().forEach((rpm, r) => expect(sonra[r]).toBeCloseTo(veAccInterpCurve(pre.curve, rpm), 9));
    const tb = sekme(ciz(getFeadPulleyPropertiesHTML(dugum('ex-ALT'))), 'egr')
      .querySelector('[data-ve-tablo^="fead-curve:"] tbody');
    expect(tb.querySelectorAll('tr').length).toBe(pre.curve.length);
  });

  test('model DEĞİŞTİRMEK: BMC künyesinden AP modeline geçince künyenin eğrisi temizlenir, yeni seçimi ezmez', () => {
    ornek();
    veFeadApplyAccModel('ex-ALT', secenek('bmc:', (v) => (veFeadAccOf(v.slice(4)).curve || []).length >= 2));
    expect(veFeadPowerCurve(dugum('ex-ALT')).length).toBeGreaterThan(1);
    const val = apSec(), pre = VE_ALTERNATOR_PRESETS[val.slice(3)];
    veFeadApplyAccModel('ex-ALT', val);
    expect(dugum('ex-ALT').data.accLib).toBeUndefined();
    expect(veFeadPowerCurve(dugum('ex-ALT'))).toEqual([]);
    const sonra = altYuk();
    altDevir().forEach((rpm, r) => expect(sonra[r]).toBeCloseTo(veAccInterpCurve(pre.curve, rpm), 9));
  });

  test('pencerede aksesuar başına TEK model seçicisi; seçenekler köprünün listesi', () => {
    ornek();
    const kap = ciz(getFeadPulleyPropertiesHTML(dugum('ex-ALT')));
    const sel = kap.querySelectorAll('select[onchange*="veFeadApplyAccModel"]');
    expect(sel.length).toBe(1);
    expect(kap.querySelectorAll('select[onchange*="accPreset"], select[onchange*="veFeadApplyAccLib"]').length).toBe(0);
    expect([...sel[0].options].map((o) => o.value).filter(Boolean))
      .toEqual(veFeadAccModelOpts('fead-alternator').map((o) => o[0]));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('MOTOR — sürücüde seçilir; devir sınırları ve eğri motordan', () => {
  test('seçim devir sınırlarını depoya yazar ve sürücünün Motor sekmesi onları seçicinin altında gösterir', () => {
    ornek();
    const key = motorEgrili(), e = veFeadEngineOf(key);
    veFeadApplyEngineLib('ex-solver', key);
    const kap = ciz(getFeadPulleyPropertiesHTML(dugum('ex-FAN')));
    [['idleRpm', e.idleRpm], ['governedRpm', e.governedRpm], ['overspeedRpm', e.overspeedRpm]].forEach(([k, v]) => {
      expect(Number(depo().data[k])).toBe(v);
      expect(Number(sekme(kap, 'mot').querySelector('#ve-fead-' + k + '-ex-solver').value)).toBe(v);
    });
    // Senaryo rölantiyi motordan alıyor; varsayılanı YOK (FEAD kural 46).
    const g = veFeadScnInputs(kopru());
    expect(g.idleRpm).toBe(e.idleRpm);
    expect(g.eksik).not.toContain('rölanti devri');
  });

  test('Güç eğrisi kartı motorun tam yük eğrisi — nokta sayısı ve değerleri katalogdan', () => {
    ornek();
    const key = motorEgrili(), e = veFeadEngineOf(key);
    const bos = sekme(ciz(getFeadPulleyPropertiesHTML(dugum('ex-FAN'))), 'mot');
    expect(bos.querySelector('[data-ve-tablo^="fead-motor-egri:"]')).toBeNull();
    veFeadApplyEngineLib('ex-solver', key);
    const tb = sekme(ciz(getFeadPulleyPropertiesHTML(dugum('ex-FAN'))), 'mot')
      .querySelector('[data-ve-tablo^="fead-motor-egri:"] tbody');
    const tr = tb.querySelectorAll('tr');
    expect(tr.length).toBe(e.curve.length);
    const td = tr[tr.length - 1].querySelectorAll('td');
    const son = e.curve[e.curve.length - 1];
    expect([...td].map((x) => x.textContent)).toEqual([veSayi(son.rpm, 0), veSayi(son.nm, 0), veSayi(son.kw, 1)]);
    expect(veFeadScnInputs(kopru()).curve).toBe(e.curve);
  });

  test('FEAD payı: her satırda Σ aksesuar gücü / motorun o devirdeki tam yük gücü — sürücü sayılmaz', () => {
    ornek();
    const key = motorEgrili();
    veFeadApplyEngineLib('ex-solver', key);
    const b = kopru(), rows = veFeadDutyRows(depo());
    const pay = veFeadMotorPayi(b, depo().data, rows), core = veFeadDutyToCore(b, rows);
    expect(pay.length).toBe(core.length);
    expect(pay.length).toBeGreaterThan(0);
    expect(Object.keys(core[0].loadsKw)).not.toContain(b.names[b.sys._crkIdx]);
    pay.forEach((p, i) => {
      const f = Object.keys(core[i].loadsKw).reduce((s, k) => s + core[i].loadsKw[k], 0);
      expect(p.feadKw).toBeCloseTo(f, 9);
      expect(p.motorKw).toBeCloseTo(veFeadEngineAt(key, core[i].engineRpm).kw, 9);
      expect(p.payPct).toBeCloseTo(100 * f / p.motorKw, 9);
    });
    const tb = sekme(ciz(getFeadPulleyPropertiesHTML(dugum('ex-FAN'))), 'mot')
      .querySelector('[data-ve-tablo^="fead-motor-pay:"] tbody');
    expect(tb.querySelectorAll('tr').length).toBe(pay.length);
    expect(tb.querySelector('tr td:last-child').textContent).toBe('%' + veSayi(pay[0].payPct, 1));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('YÖNTEMLER — Çözücü\'nün temeli: her satır bir ÇAĞRIYA bağlı', () => {
  const KAYNAK = fs.readdirSync(path.join(__dirname, '../../js'))
    .filter((f) => /\.js$/.test(f))
    .map((f) => fs.readFileSync(path.join(__dirname, '../../js', f), 'utf8')).join('\n');

  test('listedeki her çağrı kodda var (çekirdekte FEADCore.<ad>, köprüde fonksiyon bildirimi)', () => {
    expect(VE_FEAD_YONTEMLER.length).toBeGreaterThanOrEqual(10);
    const yok = VE_FEAD_YONTEMLER.filter((y) => {
      const m = /^FEADCore\.(\w+)$/.exec(y.fn);
      return m ? typeof FEADCore[m[1]] !== 'function'
               : !new RegExp('\\bfunction ' + y.fn + '\\(').test(KAYNAK);
    }).map((y) => y.fn);
    expect(yok).toEqual([]);
    expect(new Set(VE_FEAD_YONTEMLER.map((y) => y.k)).size).toBe(VE_FEAD_YONTEMLER.length);
  });

  test('Çözücü penceresinin Yöntemler sekmesi listeyi SIRASIYLA basar ve girdi SORMAZ', () => {
    ornek();
    const kap = ciz(getFeadSolverPropertiesHTML(depo()));
    const yon = sekme(kap, 'yon');
    const metin = yon.textContent;
    let son = -1;
    VE_FEAD_YONTEMLER.forEach((y) => {
      const i = metin.indexOf(y.ad);
      expect({ ad: y.ad, var: i > son }).toEqual({ ad: y.ad, var: true });
      son = i;
    });
    expect(kap.querySelectorAll('[id^="ve-fp-panes-"] input:not([readonly]), [id^="ve-fp-panes-"] select, '
      + '[id^="ve-fp-panes-"] textarea').length).toBe(0);
  });
});
