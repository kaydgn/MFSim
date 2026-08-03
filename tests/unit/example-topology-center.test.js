/**
 * example-topology-center.test.js — Örnek topolojileri ızgaranın ORTASINA açar
 * ───────────────────────────────────────────────────────────────────────────
 * Bildirilen sorun: "örnek topolojileri açtığımızda ızgaranın en sol yukarısında,
 * ucunda veriyor." Kayıtlı örnek JSON'ları gerçekten yerel (300..1330, 150..650)
 * bandında, yani 6000×6000 kanvasın SOL-ÜST köşesinde üretilmiş. Yükleyici
 * (_mntTopoState) artık koordinatları kanvas merkezine taşıyor.
 *
 * Burada DEPODAKİ GERÇEK örnek dosyaları okunur — sentetik veri değil: senaryo
 * birebir yeniden üretilir. ESKİ kodda "yüklenen durum ortalanmış" beklentisi
 * kırılır (koordinatlar dosyadaki gibi köşede kalırdı), YENİ kodda geçer.
 */
const fs = require('fs');
const path = require('path');

const cs = require('../../js/canvas-space.js');
global.veCenterTopoState = cs.veCenterTopoState;   // cp-mount bunu global olarak arar

const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.showToast = jest.fn();
global.veShowSaveDialog = jest.fn();
global.veFlushOpenPanelData = jest.fn();
const cp = require('../../js/cp-mount.js');

const EX_DIR = path.join(__dirname, '../../assets/examples');
const exampleFiles = fs.readdirSync(EX_DIR).filter((f) => f.endsWith('.json'));

// Yerel koordinat sınır kutusunun merkezi
function centerOf(state) {
  const bb = cs.veTopoBBox(state.nodes, state.annotations);
  return { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2, bb };
}

// Köşede üretilmiş ESKİ örnekler — recentering bunlar için yazıldı. Uygulamadan
// BUGÜN "İç Topolojiyi JSON Dışa Aktar" ile alınan bir dosya zaten kanvas
// koordinatlarındadır (merkeze yakın); onu da "köşede olmalı" diye zorlamak,
// yeni her örneği yapay olarak sol-üste taşımaya mecbur bırakırdı. Asıl güvence
// zaten aşağıdaki "yüklenen durum kanvas merkezine oturur" testidir ve o, ham
// koordinat nerede olursa olsun HER dosya için koşar.
const LEGACY_CORNER = ['siper_topoloji.json', 'tulga_topoloji.json'];

describe('Kayıtlı örnek topolojileri (assets/examples/*.json)', () => {
  test('en az bir örnek dosyası var', () => {
    expect(exampleFiles.length).toBeGreaterThan(0);
  });

  test('regresyon kaydı: köşede üretilmiş eski örnekler hâlâ defterde', () => {
    // Bu dosyalar kaybolursa recentering'in çözdüğü senaryo test edilmez olur.
    const found = LEGACY_CORNER.filter((f) => exampleFiles.includes(f));
    expect(found.length).toBeGreaterThan(0);
    found.forEach((f) => {
      const c = centerOf(JSON.parse(fs.readFileSync(path.join(EX_DIR, f), 'utf8')));
      expect(c.x).toBeLessThan(cs.VE_CANVAS_CENTER / 2);   // 3000'in çok solunda
      expect(c.y).toBeLessThan(cs.VE_CANVAS_CENTER / 2);   // 3000'in çok yukarısında
    });
  });

  exampleFiles.forEach((file) => {
    describe(file, () => {
      const raw = JSON.parse(fs.readFileSync(path.join(EX_DIR, file), 'utf8'));

      test('yüklenen durum kanvas merkezine oturur', () => {
        const st = cp._mntTopoState(raw);
        expect(st).toBeTruthy();
        const c = centerOf(st);
        expect(c.x).toBeCloseTo(cs.VE_CANVAS_CENTER, 6);
        expect(c.y).toBeCloseTo(cs.VE_CANVAS_CENTER, 6);
      });

      test('her yönde ≥1000px boş alan kalır (topoloji birleştirme için yer)', () => {
        const { bb } = centerOf(cp._mntTopoState(raw));
        expect(bb.minX).toBeGreaterThan(1000);
        expect(bb.minY).toBeGreaterThan(1000);
        expect(cs.VE_CANVAS_SPAN - bb.maxX).toBeGreaterThan(1000);
        expect(cs.VE_CANVAS_SPAN - bb.maxY).toBeGreaterThan(1000);
      });

      test('topoloji bozulmaz: düğüm/bağlantı sayısı ve göreli mesafeler aynı', () => {
        const st = cp._mntTopoState(raw);
        expect(st.nodes.length).toBe(raw.nodes.length);
        expect(st.connections.length).toBe((raw.connections || []).length);
        const dxRaw = raw.nodes[1].x - raw.nodes[0].x;
        const dxNew = st.nodes[1].x - st.nodes[0].x;
        expect(dxNew).toBeCloseTo(dxRaw, 9);
      });

      test('düğüm verisi (kütle/atalet vb.) yükleme sırasında el değmeden gelir', () => {
        const st = cp._mntTopoState(raw);
        st.nodes.forEach((n, i) => {
          expect(n.id).toBe(raw.nodes[i].id);
          expect(n.type).toBe(raw.nodes[i].type);
          expect(n.data).toEqual(raw.nodes[i].data);
        });
      });

      test('kaynak JSON değişmez (aynı örnek ikinci kez de aynı yüklenir)', () => {
        const before = JSON.stringify(raw);
        const first = cp._mntTopoState(raw);
        expect(JSON.stringify(raw)).toBe(before);
        const second = cp._mntTopoState(raw);
        expect(second.nodes[0].x).toBeCloseTo(first.nodes[0].x, 9);
      });
    });
  });
});
