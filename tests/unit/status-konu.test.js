/**
 * status-konu.test.js — PROGRAM DURUMU'NUN KONU SATIRI
 * ───────────────────────────────────────────────────────────────────────
 * Birleşme commit'inin ilk satırı "Merge pull request #1077 from
 * kaydgn/claude/…" — Program Durumu bunu basıyordu: dal adı kullanıcıya bir
 * şey söylemiyor, asıl başlık (PR başlığı) gövdenin ilk satırında duruyordu.
 * Gömülü künye (build.js) de GitHub API'si de aynı biçimi veriyor.
 */
const stubs = stubGlobals();
eval(loadSource('status.js'));
beforeEach(() => resetStubs(stubs));

describe('_veStatusKonu', () => {
  test('birleşme: konu PR başlığı, numara ayrı, gövde başlıktan sonrası', () => {
    const k = _veStatusKonu('Merge pull request #1082 from kaydgn/claude/youthful-faraday-y2od34\n\nKalan sabit renkli yazılar AA\'ya bağlandı\n\nayrıntı satırı');
    expect(k).toEqual({ konu: 'Kalan sabit renkli yazılar AA\'ya bağlandı', govde: 'ayrıntı satırı', pr: 1082 });
  });

  test('gövdesi boş birleşme: konu satırı kalır, numara yine ayrılır', () => {
    expect(_veStatusKonu('Merge pull request #7 from a/b')).toEqual({ konu: 'Merge pull request #7 from a/b', govde: '', pr: 7 });
  });

  test('düz commit olduğu gibi', () => {
    expect(_veStatusKonu('Boyut defteri: satır\n\ngövde')).toEqual({ konu: 'Boyut defteri: satır', govde: 'gövde', pr: null });
    expect(_veStatusKonu('')).toEqual({ konu: '', govde: '', pr: null });
  });

  test('liste konu satırını bu işlevden alıyor — dal adı listede yok', () => {
    document.body.innerHTML = '<div id="ve-status-commits"></div>';
    _veStatusRenderCommits([{ sha: 'abcdef1234567', html_url: '#', commit: {
      message: 'Merge pull request #1085 from kaydgn/claude/practical-fermi-mfcbyn\n\nFEAD kılavuzu: güncellik turu',
      author: { name: 'x', date: new Date().toISOString() } } }]);
    const el = document.getElementById('ve-status-commits');
    expect(el.querySelector('.ve-status-commit-msg').textContent).toBe('FEAD kılavuzu: güncellik turu');
    expect(el.querySelector('.ve-status-commit-pr').textContent).toBe('#1085');
    expect(el.textContent).not.toMatch(/Merge pull request/);
  });
});
