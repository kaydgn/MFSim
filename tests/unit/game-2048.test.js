/**
 * game-2048.js birim testleri
 * Saf oyun motoru: satır kaydırma/birleştirme, 4 yön hareket, spawn (enjekte rng),
 * hasMoves (oyun bitti tespiti), isWin ve maxTile. DOM'a dokunulmaz.
 */

const g = require('../../js/game-2048.js');

describe('mf2048SlideLine — satır kaydır + birleştir (sola)', () => {
  test('boş satır: hareket yok', () => {
    expect(g.mf2048SlideLine([0, 0, 0, 0])).toEqual({ line: [0, 0, 0, 0], gained: 0, moved: false });
  });

  test('iki eşit kare birleşir ve skor verir', () => {
    expect(g.mf2048SlideLine([2, 2, 0, 0])).toEqual({ line: [4, 0, 0, 0], gained: 4, moved: true });
  });

  test('aralıklı eşit kareler birleşir', () => {
    expect(g.mf2048SlideLine([2, 0, 2, 0])).toEqual({ line: [4, 0, 0, 0], gained: 4, moved: true });
    expect(g.mf2048SlideLine([2, 0, 0, 2])).toEqual({ line: [4, 0, 0, 0], gained: 4, moved: true });
  });

  test('üçlüde yalnız soldaki çift birleşir (2 2 2 → 4 2)', () => {
    expect(g.mf2048SlideLine([2, 2, 2, 0])).toEqual({ line: [4, 2, 0, 0], gained: 4, moved: true });
  });

  test('dört eşit kare iki ayrı birleşme yapar (tek hamlede zincir yok)', () => {
    expect(g.mf2048SlideLine([2, 2, 2, 2])).toEqual({ line: [4, 4, 0, 0], gained: 8, moved: true });
  });

  test('farklı çiftler ayrı ayrı birleşir', () => {
    expect(g.mf2048SlideLine([4, 4, 8, 8])).toEqual({ line: [8, 16, 0, 0], gained: 24, moved: true });
  });

  test('birleşme yoksa ama kayma varsa moved:true, gained:0', () => {
    expect(g.mf2048SlideLine([0, 0, 2, 4])).toEqual({ line: [2, 4, 0, 0], gained: 0, moved: true });
  });

  test('zaten yerleşik ve birleşemez satır: moved:false', () => {
    expect(g.mf2048SlideLine([2, 4, 2, 4])).toEqual({ line: [2, 4, 2, 4], gained: 0, moved: false });
  });

  test('girdi mutasyona uğramaz (saf)', () => {
    const input = [2, 2, 0, 0];
    g.mf2048SlideLine(input);
    expect(input).toEqual([2, 2, 0, 0]);
  });
});

describe('mf2048Move — dört yönde tahta hareketi', () => {
  test('sola', () => {
    const board = [
      [0, 2, 0, 2],
      [4, 0, 4, 0],
      [0, 0, 0, 0],
      [8, 0, 0, 8]
    ];
    const res = g.mf2048Move(board, 'left');
    expect(res.board).toEqual([
      [4, 0, 0, 0],
      [8, 0, 0, 0],
      [0, 0, 0, 0],
      [16, 0, 0, 0]
    ]);
    expect(res.gained).toBe(4 + 8 + 16);
    expect(res.moved).toBe(true);
  });

  test('sağa', () => {
    const board = [
      [2, 0, 2, 0],
      [0, 0, 0, 0],
      [4, 4, 0, 0],
      [0, 0, 0, 0]
    ];
    const res = g.mf2048Move(board, 'right');
    expect(res.board).toEqual([
      [0, 0, 0, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 8],
      [0, 0, 0, 0]
    ]);
    expect(res.gained).toBe(12);
  });

  test('yukarı', () => {
    const board = [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [4, 0, 0, 0]
    ];
    const res = g.mf2048Move(board, 'up');
    expect(res.board).toEqual([
      [4, 0, 0, 0],
      [4, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);
    expect(res.gained).toBe(4);
  });

  test('aşağı', () => {
    const board = [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [4, 0, 0, 0]
    ];
    const res = g.mf2048Move(board, 'down');
    expect(res.board).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [4, 0, 0, 0],
      [4, 0, 0, 0]
    ]);
  });

  test('hiçbir şey değişmiyorsa moved:false', () => {
    const board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2]
    ];
    expect(g.mf2048Move(board, 'left').moved).toBe(false);
    expect(g.mf2048Move(board, 'up').moved).toBe(false);
  });

  test('girdi tahtası mutasyona uğramaz (saf)', () => {
    const board = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];
    g.mf2048Move(board, 'left');
    expect(board[0]).toEqual([2, 2, 0, 0]);
  });
});

describe('mf2048SpawnRandom — enjekte rng ile deterministik', () => {
  test('boş kareye 2 yerleştirir (rng ilk çağrı → kare, ikinci → değer)', () => {
    const board = g.mf2048NewBoard();
    // empties sırası satır-satır: index 0 = (0,0). rand()=0 → idx 0; rand()=0 (<0.9) → 2
    const seq = [0, 0];
    let i = 0;
    const placed = g.mf2048SpawnRandom(board, () => seq[i++]);
    expect(placed).toEqual({ r: 0, c: 0, value: 2 });
    expect(board[0][0]).toBe(2);
  });

  test('değer için rng>=0.9 ise 4 yerleşir', () => {
    const board = g.mf2048NewBoard();
    const seq = [0, 0.95];
    let i = 0;
    const placed = g.mf2048SpawnRandom(board, () => seq[i++]);
    expect(placed.value).toBe(4);
  });

  test('yalnız boş kareye yazar', () => {
    const board = g.mf2048NewBoard();
    board[0][0] = 2; // ilk kare dolu
    // empties[0] artık (0,1); rand()=0 → onu seç
    const seq = [0, 0];
    let i = 0;
    const placed = g.mf2048SpawnRandom(board, () => seq[i++]);
    expect(placed).toEqual({ r: 0, c: 1, value: 2 });
    expect(board[0][0]).toBe(2); // bozulmadı
  });

  test('tahta doluysa null döner ve tahtayı değiştirmez', () => {
    const board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2]
    ];
    expect(g.mf2048SpawnRandom(board, () => 0)).toBeNull();
  });
});

describe('mf2048HasMoves — oyun bitti tespiti', () => {
  test('boş kare varsa oynanabilir', () => {
    const board = g.mf2048NewBoard();
    board[0][0] = 2;
    expect(g.mf2048HasMoves(board)).toBe(true);
  });

  test('dolu ama komşu eşitler varsa oynanabilir', () => {
    const board = [
      [2, 2, 4, 8],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
      [16, 32, 64, 128]
    ];
    expect(g.mf2048HasMoves(board)).toBe(true);
  });

  test('dolu ve komşu eşit yoksa oyun biter', () => {
    const board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2]
    ];
    expect(g.mf2048HasMoves(board)).toBe(false);
  });
});

describe('mf2048MaxTile / mf2048IsWin', () => {
  test('maxTile en büyük kareyi bulur', () => {
    const board = g.mf2048NewBoard();
    board[1][2] = 256;
    board[3][3] = 64;
    expect(g.mf2048MaxTile(board)).toBe(256);
  });

  test('2048 varsa kazanma', () => {
    const board = g.mf2048NewBoard();
    board[0][0] = 2048;
    expect(g.mf2048IsWin(board)).toBe(true);
  });

  test('2048 yoksa kazanma değil', () => {
    const board = g.mf2048NewBoard();
    board[0][0] = 1024;
    expect(g.mf2048IsWin(board)).toBe(false);
  });

  test('özel hedef parametresi', () => {
    const board = g.mf2048NewBoard();
    board[0][0] = 512;
    expect(g.mf2048IsWin(board, 512)).toBe(true);
    expect(g.mf2048IsWin(board, 1024)).toBe(false);
  });
});

describe('mf2048NewBoard', () => {
  test('4x4 sıfır tahta, satırlar bağımsız (referans paylaşımı yok)', () => {
    const board = g.mf2048NewBoard();
    expect(board.length).toBe(4);
    expect(board[0].length).toBe(4);
    board[0][0] = 99;
    expect(board[1][0]).toBe(0); // diğer satır etkilenmedi
  });
});
