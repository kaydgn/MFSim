/**
 * node-label-anchor.test.js — düğüm ADININ çizim çıpası tek kaynaktan
 *
 * node.data.labelPos ile ad kutunun altına/üstüne/soluna/sağına konabiliyor
 * (sağ tık → Etiket Konumu). Canlı kanvas bunu okuyordu; SVG/HTML çizicileri
 * OKUMUYORDU:
 *   • js/export-topology.js adı her zaman kutunun ALTINA yazıyordu
 *   • js/topology.js şerit paneli .lbl-* sınıfını hiç eklemiyordu
 * Sonuç sessizdi — ekranda üste alınmış bir ad, dışa aktarılan PNG/SVG'de ve
 * şerit önizlemesinde yine altta, yani tellerin şeridinde çıkıyordu. Araç
 * Performans örneklerinde motor ve transfer adları tam bu yüzden taşınmıştı.
 *
 * Kural artık tek yerde: js/components.js → veNodeLabelAnchor. Buradaki
 * testler o sözleşmeyi ve iki çizicinin ondan okuduğunu tutuyor.
 */
const stubs = stubGlobals();
eval(loadSource('components.js'));

const n = (labelPos) => ({ x: 100, y: 200, data: labelPos ? { labelPos } : {} });

describe('veNodeLabelAnchor', () => {
  test('varsayılan ALT; taban çizgisi uzaklığı çiziciden geliyor', () => {
    expect(veNodeLabelAnchor(n(), 65, 60, 14)).toEqual({ x: 132.5, y: 274, anchor: 'middle', pos: 'bottom' });
    expect(veNodeLabelAnchor(n('bottom'), 65, 60, 13).y).toBe(273);
  });

  test('gap verilmezse 14 varsayılıyor', () => {
    expect(veNodeLabelAnchor(n(), 65, 60).y).toBe(274);
    expect(veNodeLabelAnchor(n(), 65, 60, NaN).y).toBe(274);
  });

  test('üst / sol / sağ — CSS .lbl-* ile aynı taraf ve hizalama', () => {
    // css/styles.css: .lbl-top{bottom:100%; margin-bottom:4px}
    //                 .lbl-left{right:100%; margin-right:7px; text-align:right}
    //                 .lbl-right{left:100%; margin-left:7px; text-align:left}
    expect(veNodeLabelAnchor(n('top'), 65, 60, 14)).toEqual({ x: 132.5, y: 195, anchor: 'middle', pos: 'top' });
    expect(veNodeLabelAnchor(n('left'), 65, 60, 14)).toEqual({ x: 93, y: 234, anchor: 'end', pos: 'left' });
    expect(veNodeLabelAnchor(n('right'), 65, 60, 14)).toEqual({ x: 172, y: 234, anchor: 'start', pos: 'right' });
  });

  test('tanınmayan değer ALTA düşüyor (eski/bozuk kayıt sessizce patlamasın)', () => {
    expect(veNodeLabelAnchor(n('yok-böyle'), 65, 60, 14).pos).toBe('bottom');
    expect(veNodeLabelAnchor({ x: 0, y: 0 }, 65, 60, 14).pos).toBe('bottom');
  });

  test('ölçü çıpayı gerçekten kaydırıyor (motor 66×76)', () => {
    expect(veNodeLabelAnchor(n('top'), 66, 76, 14).x).toBe(133);
    expect(veNodeLabelAnchor(n(), 66, 76, 14).y).toBe(290);       // 200 + 76 + 14
  });
});

describe('çiziciler bu çıpadan okuyor', () => {
  const fs = require('fs');
  const path = require('path');
  const src = f => fs.readFileSync(path.join(__dirname, '..', '..', 'js', f), 'utf8');

  test('export-topology.js sabit "kutunun altı" yerine çıpayı kullanıyor', () => {
    const s = src('export-topology.js');
    expect(s).toContain('veNodeLabelAnchor(n, w, h, 14)');
    // ESKİ kusurun kapısı: sabit ly = n.y + h + 14 ile yazılmıyor.
    expect(s).not.toMatch(/ly\s*=\s*n\.y\s*\+\s*h\s*\+\s*14/);
    expect(s).toContain("text-anchor=\"' + _la.anchor + '\"");
  });

  test('topology.js şerit paneli .lbl-* sınıfını basıyor', () => {
    const s = src('topology.js');
    expect(s).toContain("' lbl-' + _lp");
    expect(s).toContain('ve-node-label');
  });

  test('DOM yolu (context-menus.js) ile aynı üç değer geçerli', () => {
    const s = src('context-menus.js');
    ['top', 'left', 'right'].forEach(p => expect(s).toContain("'lbl-" + p + "'"));
  });
});
