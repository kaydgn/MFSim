/**
 * sinyal-ad-tazele.test.js — KAYITLI PANODA SİNYAL ADI TAZELENİR (karar 9·B)
 * ───────────────────────────────────────────────────────────────────────────
 * Pano şeridin adını KOPYA olarak saklıyor ("Motor — Motor Devri"); eşleme
 * ise hep kimlikle (id + signal). Sinyal adları cümle düzenine geçince eski
 * proje eski yazımla açılıyor ve yeni eklenen şeridin yanında iki düzen
 * duruyordu. veResSinyalAdTazele Sonuçlar'a girişte yalnız SİNYAL kısmının
 * harfini güncel tablodan tazeler:
 *   · kaynak kısmı (düğümün adı, sekme öneki) kullanıcınındır — dokunulmaz
 *   · modül kanallarının (takoz, FEAD) kendi tazeleyicisi var — dokunulmaz
 *   · harf farkı olmayan ya da tabloda olmayan ad — dokunulmaz
 */
const S = require('../../js/mount-signals.js');
global.veMntSignals = S;
stubGlobals();
global.COMPONENT_SIGNALS = {
  engine: { outputs: [{ id: 'rpm', name: 'Motor devri', unit: 'rpm' }] },
  vehicle: { outputs: [{ id: 'v_speed', name: 'Araç hızı', unit: 'km/h' }] }
};
global.SW_DIAGRAM_SIGNALS = {
  'v-t': { x: { target: 'time' }, y: [{ target: 'vehicle', signal: 'v_speed', name: 'Araç hızı', unit: 'km/h' }] }
};
global.componentDefs = {};
global.connections = [];
global.nodes = [];
global.veTabs = [{ id: 't1', name: 'T1', state: { simResults: null, nodes: [], connections: [] } }];
global.veActiveTabIdx = 0;
global.SENSOR_PACKAGES = [];

eval(loadSource('measure-core.js'));
eval(loadSource('signal-tree.js'));
eval(loadSource('trace-view.js'));
eval(loadSource('results.js'));

function pano(sensors, xAxis) {
  veResultSlots = [{ type: 'line', sensors: sensors, xAxis: xAxis }, {}, {}, {}];
  return veResultSlots[0];
}

describe('veResSinyalAdTazele', () => {
  test('eski yazım tazelenir, kaynak kısmı ve sekme öneki kalır', () => {
    const s = pano([
      { id: 'n1', signal: 'rpm', name: 'Motor — Motor Devri', unit: 'rpm' },
      { id: 'n2', signal: 'rpm', name: 'MOTOR X — Motor Devri', unit: 'rpm' },
      { id: '@0:n3', signal: 'rpm', name: '[T1] Ana Motor — Motor Devri', unit: 'rpm' }
    ]);
    expect(veResSinyalAdTazele()).toBe(3);
    expect(s.sensors.map((x) => x.name)).toEqual([
      'Motor — Motor devri', 'MOTOR X — Motor devri', '[T1] Ana Motor — Motor devri']);
  });

  test('diyagram paketinin çıplak adı ve X ekseninin "ad [birim]" biçimi', () => {
    const s = pano([{ id: '~vehicle', signal: 'v_speed', name: 'Araç Hızı', unit: 'km/h' }],
      { id: '~vehicle:v_speed', name: 'Araç Hızı [km/h]', unit: 'km/h' });
    expect(veResSinyalAdTazele()).toBe(2);
    expect(s.sensors[0].name).toBe('Araç hızı');
    expect(s.xAxis.name).toBe('Araç hızı [km/h]');
  });

  test('tabloda olmayan ad, güncel ad ve modül kanalı DOKUNULMAZ; ikinci tur 0', () => {
    const s = pano([
      { id: 'n1', signal: 'x', name: 'Motor — Özel Kanal', unit: '' },
      { id: 'n1', signal: 'rpm', name: 'Motor — Motor devri', unit: 'rpm' },
      { id: S.SENSOR_PREFIX + 'frf', signal: 'a', name: 'Motor Devri', unit: '' }
    ]);
    expect(veResSinyalAdTazele()).toBe(0);
    expect(s.sensors.map((x) => x.name)).toEqual(['Motor — Özel Kanal', 'Motor — Motor devri', 'Motor Devri']);
  });

  test('Sonuçlar\'a giriş tazeleyiciyi çağırıyor', () => {
    const src = loadSource('results.js');
    const giris = src.slice(src.indexOf('function veEnterResults('));
    // satır başında: yoruma alınmış çağrı sayılmaz
    expect(giris.slice(0, giris.indexOf('\n}\n'))).toMatch(/^\s+veResSinyalAdTazele\(\);/m);
  });
});
