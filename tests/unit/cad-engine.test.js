/**
 * CAD Engine birim testleri (Faz-1: çoklu primitif kompozisyonu)
 * - Model CRUD (add, remove, update, get, move)
 * - Serialize / deserialize roundtrip
 * - Backend bilgi
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// fea-primitives bağımlılıkları (defaults / labels) için yükle
eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cad-engine.js'), 'utf8'));

describe('CAD Engine — Model CRUD', () => {
  test('boş model oluşturur', () => {
    const m = veCADCreateModel();
    expect(m.version).toBe(1);
    expect(Array.isArray(m.features)).toBe(true);
    expect(m.features.length).toBe(0);
  });

  test('Box feature ekler, varsayılan parametreleri alır', () => {
    const m = veCADCreateModel();
    const f = veCADAddFeature(m, 'box');
    expect(f).not.toBeNull();
    expect(f.type).toBe('box');
    expect(f.op).toBe('add');
    expect(f.visible).toBe(true);
    expect(typeof f.params.width).toBe('number');
    expect(typeof f.params.height).toBe('number');
    expect(typeof f.params.depth).toBe('number');
    expect(m.features.length).toBe(1);
  });

  test('parametre override ile feature ekler', () => {
    const m = veCADCreateModel();
    const f = veCADAddFeature(m, 'box', { width: 100, height: 50 });
    expect(f.params.width).toBe(100);
    expect(f.params.height).toBe(50);
    // override edilmeyen depth varsayılan değerinde
    expect(typeof f.params.depth).toBe('number');
  });

  test('aynı tip için artan otomatik isim üretir', () => {
    const m = veCADCreateModel();
    const f1 = veCADAddFeature(m, 'box');
    const f2 = veCADAddFeature(m, 'box');
    const f3 = veCADAddFeature(m, 'cylinder');
    expect(f1.name).toMatch(/1$/);
    expect(f2.name).toMatch(/2$/);
    expect(f3.name).toMatch(/1$/);
    expect(f1.name).not.toBe(f2.name);
  });

  test('bilinmeyen tip için null döner', () => {
    const m = veCADCreateModel();
    const f = veCADAddFeature(m, 'unicorn');
    expect(f).toBeNull();
    expect(m.features.length).toBe(0);
  });

  test('feature siler', () => {
    const m = veCADCreateModel();
    const f = veCADAddFeature(m, 'box');
    expect(veCADRemoveFeature(m, f.id)).toBe(true);
    expect(m.features.length).toBe(0);
    expect(veCADRemoveFeature(m, 'nope')).toBe(false);
  });

  test('feature parametre günceller', () => {
    const m = veCADCreateModel();
    const f = veCADAddFeature(m, 'box');
    expect(veCADUpdateFeature(m, f.id, { params: { width: 200 } })).toBe(true);
    const updated = veCADGetFeature(m, f.id);
    expect(updated.params.width).toBe(200);
    // diğer paramlar korunur
    expect(typeof updated.params.height).toBe('number');
  });

  test('feature transform günceller', () => {
    const m = veCADCreateModel();
    const f = veCADAddFeature(m, 'box');
    expect(veCADUpdateFeature(m, f.id, { transform: { tx: 10, rz: 45 } })).toBe(true);
    const updated = veCADGetFeature(m, f.id);
    expect(updated.transform.tx).toBe(10);
    expect(updated.transform.rz).toBe(45);
    expect(updated.transform.ty).toBe(0);
  });

  test('feature görünürlüğü ve ismi günceller', () => {
    const m = veCADCreateModel();
    const f = veCADAddFeature(m, 'box');
    veCADUpdateFeature(m, f.id, { visible: false, name: 'YeniIsim' });
    const u = veCADGetFeature(m, f.id);
    expect(u.visible).toBe(false);
    expect(u.name).toBe('YeniIsim');
  });

  test('feature sıralama (move up/down)', () => {
    const m = veCADCreateModel();
    const a = veCADAddFeature(m, 'box');
    const b = veCADAddFeature(m, 'cylinder');
    const c = veCADAddFeature(m, 'sphere');
    expect(m.features[0].id).toBe(a.id);
    veCADMoveFeature(m, c.id, 'up');
    expect(m.features[1].id).toBe(c.id);
    veCADMoveFeature(m, c.id, 'up');
    expect(m.features[0].id).toBe(c.id);
    // sınırı aşmaz
    expect(veCADMoveFeature(m, c.id, 'up')).toBe(false);
    expect(m.features[0].id).toBe(c.id);
  });
});

describe('CAD Engine — Persist (serialize/deserialize)', () => {
  test('roundtrip korunur (eklenen 3 feature)', () => {
    const m = veCADCreateModel();
    veCADAddFeature(m, 'box', { width: 100 });
    const cyl = veCADAddFeature(m, 'cylinder', { radius: 25, height: 80 });
    veCADUpdateFeature(m, cyl.id, { transform: { tx: 50, rz: 90 } });
    veCADAddFeature(m, 'shaft');

    const serialized = veCADSerialize(m);
    expect(serialized.version).toBe(1);
    expect(serialized.features.length).toBe(3);

    // JSON-safe (geçici olarak JSON.stringify/parse)
    const json = JSON.parse(JSON.stringify(serialized));
    const restored = veCADDeserialize(json);
    expect(restored.features.length).toBe(3);
    expect(restored.features[0].type).toBe('box');
    expect(restored.features[0].params.width).toBe(100);
    expect(restored.features[1].type).toBe('cylinder');
    expect(restored.features[1].params.radius).toBe(25);
    expect(restored.features[1].transform.tx).toBe(50);
    expect(restored.features[1].transform.rz).toBe(90);
    expect(restored.features[2].type).toBe('shaft');
  });

  test('boş model deserialize edilir', () => {
    const m = veCADDeserialize({});
    expect(m.features.length).toBe(0);
  });

  test('null/undefined için boş model döner', () => {
    expect(veCADDeserialize(null).features.length).toBe(0);
    expect(veCADDeserialize(undefined).features.length).toBe(0);
  });

  test('bilinmeyen tip atlanır', () => {
    const m = veCADDeserialize({ features: [{ type: 'unicorn' }, { type: 'box' }] });
    expect(m.features.length).toBe(1);
    expect(m.features[0].type).toBe('box');
  });
});

describe('CAD Engine — Backend / Özet', () => {
  test('Faz-1: boolean yok', () => {
    expect(veCADHasBoolean()).toBe(false);
    expect(typeof veCADBackendLabel()).toBe('string');
  });

  test('summary label feature sayısını yansıtır', () => {
    const m = veCADCreateModel();
    expect(veCADSummaryLabel(m)).toMatch(/boş/i);
    veCADAddFeature(m, 'box');
    expect(veCADSummaryLabel(m)).toMatch(/1 parça/);
    veCADAddFeature(m, 'cylinder');
    expect(veCADSummaryLabel(m)).toMatch(/2 parça/);
  });
});
