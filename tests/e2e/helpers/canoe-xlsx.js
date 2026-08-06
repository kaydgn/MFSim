/**
 * CANoe tarzı .xlsx fixture üreteci — E2E testleri için ortak.
 *
 * Depoya ikili dosya eklemiyoruz: fixture testin içinde üretilir ve GERÇEK bir
 * ZIP olduğu için okuyucu (js/xlsx-read.js) tam yolu yürümek zorunda kalır —
 * deflate çözümü, sharedStrings, seyrek hücreler, hepsi.
 *
 * Kullananlar: tests/e2e/measure-import.spec.js (MFSim içindeki sihirbaz),
 *              tests/e2e/viewer.spec.js (tek dosyalık Ölçüm Görüntüleyici).
 */

const zlib = require('zlib');
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function zipBuild(files) {
  const locals = [], central = [];
  let offset = 0;
  for (const name of Object.keys(files)) {
    const raw = Buffer.from(files[name], 'utf8');
    const data = zlib.deflateRawSync(raw);
    const nb = Buffer.from(name, 'utf8');

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc32(raw), 14); lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nb.length, 26);
    locals.push(lh, nb, data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc32(raw), 16);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, nb);

    offset += 30 + nb.length + data.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

function colRef(i) {
  let s = '', n = i + 1;
  while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/**
 * Gerçek bir CANoe Excel çıktısının düzeni: üstte üstbilgi satırları, boş
 * ayırıcı, başlık, birim satırı, sonra veri. Tork ve mod sütunları SEYREK
 * (farklı CAN periyodu) — örnekle-ve-tut yolu da sınanır.
 */
function canoeXlsx(rowCount = 300) {
  const shared = [], sidx = new Map();
  const sid = (v) => {
    if (!sidx.has(v)) { sidx.set(v, shared.length); shared.push(v); }
    return sidx.get(v);
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const meta = [['Measurement:', 'Testfahrt_2026'], ['Exported:', '11.03.2026 14:22:07']];
  const hdr = ['Time', 'EngineData::EngSpeed [1/min]', 'VehicleData::VehSpeed',
    'Motor Sıcaklığı', 'GearBoxInfo::Gear', 'GearBoxInfo::Mode'];
  const units = ['s', '1/min', 'km/h', '°C', '', ''];

  const out = [];
  let r = 1;
  for (const m of meta) {
    out.push(`<row r="${r}">` + m.map((v, j) =>
      `<c r="${colRef(j)}${r}" t="s"><v>${sid(v)}</v></c>`).join('') + '</row>');
    r++;
  }
  out.push(`<row r="${r}"/>`); r++;
  out.push(`<row r="${r}">` + hdr.map((v, j) =>
    `<c r="${colRef(j)}${r}" t="s"><v>${sid(v)}</v></c>`).join('') + '</row>'); r++;
  out.push(`<row r="${r}">` + units.map((v, j) =>
    `<c r="${colRef(j)}${r}" t="s"><v>${sid(v)}</v></c>`).join('') + '</row>'); r++;

  for (let k = 0; k < rowCount; k++) {
    const t = k * 0.02;
    const rpm = 800 + 1500 * (1 - Math.exp(-t / 4));
    const v = Math.min(95, t * 3.4);
    const temp = 20 + 55 * (1 - Math.exp(-t / 9));
    const gear = Math.min(6, 1 + Math.floor(v / 16));
    let cells = '';
    [t, rpm, v, temp, gear].forEach((val, j) => {
      if (j === 3 && k % 5) return;                    // sıcaklık seyrek
      cells += `<c r="${colRef(j)}${r}"><v>${val.toPrecision(6)}</v></c>`;
    });
    if (k % 10 === 0) {
      const mode = gear <= 2 ? '1C' : (gear <= 4 ? '2L' : '2H');
      cells += `<c r="${colRef(5)}${r}" t="s"><v>${sid(mode)}</v></c>`;
    }
    out.push(`<row r="${r}">${cells}</row>`); r++;
  }

  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  return zipBuild({
    'xl/workbook.xml':
      `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets><sheet name="Measurement" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/sharedStrings.xml':
      `<?xml version="1.0"?><sst xmlns="${NS}" count="${shared.length}" uniqueCount="${shared.length}">` +
      shared.map((s) => `<si><t>${esc(s)}</t></si>`).join('') + `</sst>`,
    'xl/worksheets/sheet1.xml':
      `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${out.join('')}</sheetData></worksheet>`,
  });
}

module.exports = { canoeXlsx, zipBuild, crc32, colRef };
