/**
 * build-freshness.test.js — GİT'E DÂHİL ÜRETİLEN DOSYALAR TAZE Mİ
 *
 * NEDEN VAR: `css/styles.css` ÜÇ ürüne birden giriyor (MFSim_Code.html,
 * MFSim_Olcum_Goruntuleyici.html, MFSim_CAN_Cozumleyici.html) ve son ikisi
 * git'e dâhil. Bir tema rötuşu ikisini birden bayatlatıyor, ama rötuş
 * `viewer/` ya da `candbc/` altında hiçbir şeye dokunmadığı için `npm test`
 * bunu GÖRMÜYORDU: kapı yalnız CI'daydı.
 *
 * ÖLÇÜLDÜ (son 10 CI koşusu): tam olarak bu sınıf iki kez kırmızıya döndü
 * (5a705f6, d3ded7f). Her düşüş bir CI turu (ort. 7 dk 19 sn) + bir düzeltme
 * commit'i + bir tur daha demek. Aynı kapı burada 1 sn'de ısırıyor.
 *
 * Karşılaştırma GEÇİCİ bir dosyaya derleyip yapılıyor (MFSIM_BUILD_OUT),
 * yani test çalışma ağacını KİRLETMİYOR — kapı bir kontrol, bir düzeltme
 * aracı değil.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');

/** Betiği geçici çıktıya koştur, üretilen metni döndür. */
function derle(betik) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-fresh-')), 'out.html');
  execFileSync(process.execPath, [path.join(ROOT, betik)], {
    cwd: ROOT,
    env: { ...process.env, MFSIM_BUILD_OUT: out },
    stdio: 'pipe',
  });
  const metin = fs.readFileSync(out, 'utf8');
  fs.rmSync(path.dirname(out), { recursive: true, force: true });
  return metin;
}

/** İlk farkın satır numarası — "6 MB eşit değil" demekten çok daha kullanışlı. */
function ilkFark(a, b) {
  const A = a.split('\n'), B = b.split('\n');
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (A[i] !== B[i]) return { satir: i + 1, depo: (A[i] || '(dosya bitti)').slice(0, 120),
                                uretilen: (B[i] || '(dosya bitti)').slice(0, 120) };
  }
  return null;
}

describe.each([
  ['MFSim_Olcum_Goruntuleyici.html', 'viewer/build.js',  'npm run build:viewer'],
  ['MFSim_CAN_Cozumleyici.html',     'candbc/build.js',  'npm run build:can'],
])('%s kaynaklarıyla uyumlu', (urun, betik, komut) => {
  test(`kaynaktan yeniden üretilince BİREBİR aynı (değilse: ${komut})`, () => {
    const depodaki = fs.readFileSync(path.join(ROOT, urun), 'utf8');
    const uretilen = derle(betik);
    const fark = ilkFark(depodaki, uretilen);
    expect(fark && `${urun} BAYAT — ilk fark satır ${fark.satir}\n` +
                   `  depoda   : ${fark.depo}\n` +
                   `  üretilen : ${fark.uretilen}\n` +
                   `  düzeltme : ${komut} çalıştırıp sonucu commit'leyin`).toBeNull();
  }, 60000);
});

/**
 * three.js KÖKEN KAPISI.
 *
 * `three` npm bağımlılığı KALDIRILDI: kod onu hiç `require` etmiyor, program
 * `vendor/three.min.js`'i kullanıyor ve o dosya npm'deki kopyayla birebir
 * aynıydı. Bağımlılık yalnız bir köken kaydıydı ve her kurulumda 31 MB
 * indiriyordu (ölçüldü: node_modules 135 → 104 MB).
 *
 * Kayıt SİLİNMEDİ, kapıya çevrildi: sürüm hem gömülü dosyada hem index.html'de
 * yazılı olmak zorunda. İkisi ayrışırsa "hangi sürümü vendorladık" sorusunun
 * cevabı kaybolur — OCCT/TetGen için depoda kaynak tutma kuralının aynısı.
 */
describe('vendor/three.min.js kökeni', () => {
  const SURUM = '0.149.0';

  test('index.html hangi npm sürümünden geldiğini YAZIYOR', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(idx).toContain(`three@${SURUM}`);
  });

  test('gömülü dosya o sürümün REVISION\'ını taşıyor', () => {
    const three = fs.readFileSync(path.join(ROOT, 'vendor/three.min.js'), 'utf8');
    // 0.149.0 → REVISION "149". Minify değişkeni değiştirse de dizge kalır.
    expect(three).toContain(`"${SURUM.split('.')[1]}"`);
  });

  test('npm bağımlılığı GERİ EKLENMEMİŞ (31 MB kuruluma geri döner)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect((pkg.dependencies || {}).three).toBeUndefined();
    expect((pkg.devDependencies || {}).three).toBeUndefined();
  });

  test('kod three\'yi npm\'den DEĞİL vendor\'dan alıyor', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(idx).toContain('vendor/three.min.js');
    expect(idx).not.toContain('node_modules/three');
  });
});
