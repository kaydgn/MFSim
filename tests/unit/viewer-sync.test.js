// ── Görüntüleyici kopyaları MFSim kaynağıyla senkron mu? ─────────────────────
//
// `viewer/js/` altındaki yedi dosya `js/`'ten kopyadır (altısı birebir,
// trace-view.js iki işaretli farkla). Kopyaların kaynaktan geride kalması
// SESSİZ bir kusur: MFSim'de düzeltilen bir hata görüntüleyicide yaşamaya
// devam eder ve iki program zamanla ayrışır — hiçbir test bunu görmez, çünkü
// her iki dosya da kendi başına doğrudur.
//
// Bu test o sessizliği bozar: `npm test` senkron bozulduğu anda kırmızıya
// döner. Düzeltmesi tek komut: `npm run sync:viewer`.
//
// Ayrıca senkronun KENDİSİ de sınanıyor: viewer/sync.js çapaları MFSim
// kaynağında bulamazsa patlar. Bu, elle uzlaştırmanın bir kez ürettiği
// sonuca karşı kapı — o sefer bellekten yazılan boş-durum bloğu var olmayan
// bir DOM düğümüne innerHTML atıyordu ve görüntüleyici açılışta hata veriyordu.

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('görüntüleyici senkronu', () => {
  test('viewer/js kopyaları MFSim kaynağıyla güncel', () => {
    let out = '';
    try {
      out = execFileSync('node', [path.join(ROOT, 'viewer', 'sync.js'), '--check'],
                         { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      throw new Error(
        'Görüntüleyici kopyaları geride kalmış.\n' +
        'Düzeltme: npm run sync:viewer && npm run build:viewer\n\n' +
        String(e.stderr || e.stdout || e.message));
    }
    expect(out).toMatch(/güncel/);
  });
});
