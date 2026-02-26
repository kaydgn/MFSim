// ═══ MFSim Authentication System (SHA-256 + localStorage) ═══
var MFSIM_AUTH_HASH = 'd53f6563b0dcaf5d32b7bc2b3d9694c2f7d48b42b50c2fe07ac139d1834066a7';
var MFSIM_AUTH_KEY = 'mfsim_auth_token';

async function mfsimSHA256(text) {
  var encoder = new TextEncoder();
  var data = encoder.encode(text);
  var hashBuffer = await crypto.subtle.digest('SHA-256', data);
  var hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

async function mfsimLogin() {
  var pw = document.getElementById('mfsim-login-password').value;
  var errEl = document.getElementById('mfsim-login-error');
  if(!pw) { errEl.textContent = 'Lütfen şifre giriniz.'; return; }
  
  var hash = await mfsimSHA256(pw);
  if(hash === MFSIM_AUTH_HASH) {
    var remember = document.getElementById('mfsim-login-remember').checked;
    if(remember) {
      localStorage.setItem(MFSIM_AUTH_KEY, hash);
    } else {
      sessionStorage.setItem(MFSIM_AUTH_KEY, hash);
    }
    mfsimShowApp();
  } else {
    errEl.textContent = '❌ Hatalı şifre.';
    document.getElementById('mfsim-login-password').value = '';
    document.getElementById('mfsim-login-password').focus();
  }
}

function mfsimShowApp() {
  var overlay = document.getElementById('mfsim-login-overlay');
  if(overlay) {
    overlay.style.transition = 'opacity 0.3s ease';
    overlay.style.opacity = '0';
    setTimeout(function() { overlay.style.display = 'none'; }, 300);
  }
}

function mfsimLogout() {
  localStorage.removeItem(MFSIM_AUTH_KEY);
  sessionStorage.removeItem(MFSIM_AUTH_KEY);
  location.reload();
}

// Sayfa yüklendiğinde oturum kontrolü
(function() {
  var stored = localStorage.getItem(MFSIM_AUTH_KEY) || sessionStorage.getItem(MFSIM_AUTH_KEY);
  if(stored === MFSIM_AUTH_HASH) {
    // Zaten giriş yapılmış
    var overlay = document.getElementById('mfsim-login-overlay');
    if(overlay) overlay.style.display = 'none';
  } else {
    // Giriş gerekli — input'a focus
    setTimeout(function() {
      var inp = document.getElementById('mfsim-login-password');
      if(inp) inp.focus();
    }, 100);
  }
})();
