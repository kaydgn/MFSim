/**
 * autosave-subtopology.test.js — Otomatik kaydet alt-topolojiden atmasın
 * ─────────────────────────────────────────────────────────────────────
 * Regresyon: Kullanıcı bir alt-topolojiye (Araç Performans / Takoz iç topolojisi)
 * girdikten sonra, otomatik-kaydet aralığı dolunca (5/10/30 dk) program kullanıcıyı
 * ana topolojiye geri atıyordu.
 *
 * Neden: _veAutosaveNow() → _veSettingsBuildProjectData() → veSaveActiveTabState()
 * kancası, doğru serileştirme için açık alt-topolojiyi köke çökertir. Sekme değiştir/
 * dosya kaydet gibi terminal akışlarda bu istenir; ancak arka-plan yedeğinde kullanıcı
 * bulunduğu alt-topolojiden koparılıyordu.
 *
 * Düzeltme: _veAutosaveNow() yedek almadan önce gezinme yolunu yakalar
 * (_veCaptureSubtopoNav) ve yedekten sonra kullanıcıyı aynı alt-topolojiye SESSİZCE
 * (veAracOpenEditor/veMntOpenEditor'a _silent=true) geri götürür.
 */

const fs = require('fs');
const path = require('path');

// setTimeout'lu init IIFE'sinin gerçek zamanlayıcı sızdırmaması için sahte timer.
jest.useFakeTimers();

// _veSettingsBuildProjectData() → veSaveActiveTabState() kancasını gerçekçi taklit et:
// gerçek kanca (topology.js) veAracCollapseToRoot()/veMntCollapseToRoot() ile stack'leri
// köke boşaltır. Testte de aynısını yaparak "köke çöktükten sonra geri gel" doğrulanır.
global.veTabs = [{ id: 'tab-1', name: 'Topoloji 1', state: null }];
global.veActiveTabIdx = 0;
global.veTabCounter = 1;
global.veActiveModule = 'full-throttle';
global.veProjectName = '';

global.veAracStack = [];
global.veMntStack = [];
global.veAracOpenEditor = jest.fn();
global.veMntOpenEditor = jest.fn();
global.veSaveActiveTabState = jest.fn(function () {
  // Gerçek kancanın yaptığı gibi: açık alt-topolojileri köke çökert (stack'leri boşalt).
  while (global.veAracStack.length) global.veAracStack.pop();
  while (global.veMntStack.length) global.veMntStack.pop();
});

// settings.js üst-seviye fonksiyon bildirir → eval ile test kapsamına al.
eval(fs.readFileSync(path.join(__dirname, '../../js/settings.js'), 'utf8'));

beforeEach(() => {
  global.veAracStack = [];
  global.veMntStack = [];
  veAracOpenEditor.mockClear();
  veMntOpenEditor.mockClear();
  veSaveActiveTabState.mockClear();
  try { localStorage.clear(); } catch (e) {}
});

describe('Otomatik kaydet — alt-topoloji gezinmesini koru', () => {
  test('Araç Performans alt-topolojisindeyken kullanıcı köke atılmaz, geri getirilir', () => {
    global.veAracStack = [{ nodeId: 'comp-5', parentState: {} }];

    _veAutosaveNow();

    // Yedek gerçekten köke çökertti (kanca çağrıldı, stack boşaldı)...
    expect(veSaveActiveTabState).toHaveBeenCalled();
    expect(veAracStack.length).toBe(0);
    // ...ama kullanıcı SESSİZCE aynı alt-topolojiye geri getirildi.
    expect(veAracOpenEditor).toHaveBeenCalledTimes(1);
    expect(veAracOpenEditor).toHaveBeenCalledWith('comp-5', true);
    expect(veMntOpenEditor).not.toHaveBeenCalled();
  });

  test('İç içe (nested) alt-topolojide yol kök→derin sırayla geri girilir', () => {
    global.veAracStack = [
      { nodeId: 'a1', parentState: {} },
      { nodeId: 'a2', parentState: {} },
    ];

    _veAutosaveNow();

    expect(veAracOpenEditor.mock.calls).toEqual([
      ['a1', true],
      ['a2', true],
    ]);
  });

  test('Takoz iç topolojisindeyken de aynı şekilde geri getirilir', () => {
    global.veMntStack = [{ nodeId: 'm3', parentState: {} }];

    _veAutosaveNow();

    expect(veMntOpenEditor).toHaveBeenCalledTimes(1);
    expect(veMntOpenEditor).toHaveBeenCalledWith('m3', true);
    expect(veAracOpenEditor).not.toHaveBeenCalled();
  });

  test('Ana topolojideyken (alt-topoloji yok) geri-giriş çağrısı yapılmaz', () => {
    _veAutosaveNow();

    expect(veSaveActiveTabState).toHaveBeenCalled(); // yedek yine alınır
    expect(veAracOpenEditor).not.toHaveBeenCalled();
    expect(veMntOpenEditor).not.toHaveBeenCalled();
  });

  test('Yedek gerçekten localStorage\'a yazılır (yol geri yüklenirken)', () => {
    global.veAracStack = [{ nodeId: 'comp-9', parentState: {} }];

    _veAutosaveNow();

    const raw = localStorage.getItem('mf-autosave-data');
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw);
    expect(data.version).toBe(2);
    expect(Array.isArray(data.tabs)).toBe(true);
    expect(veAracOpenEditor).toHaveBeenCalledWith('comp-9', true);
  });

  test('localStorage.setItem hata verse bile kullanıcı alt-topolojisine geri getirilir', () => {
    global.veAracStack = [{ nodeId: 'comp-7', parentState: {} }];
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });

    expect(() => _veAutosaveNow()).not.toThrow();
    expect(veAracOpenEditor).toHaveBeenCalledWith('comp-7', true);

    spy.mockRestore();
  });
});
