// ═══ MFSim Authentication System (SHA-256 + localStorage) ═══
var MFSIM_AUTH_HASH = 'd53f6563b0dcaf5d32b7bc2b3d9694c2f7d48b42b50c2fe07ac139d1834066a7';
var MFSIM_AUTH_KEY = 'mfsim_auth_token';
var MFSIM_AUTH_RL_KEY = 'mfsim_auth_rl';
var MFSIM_AUTH_MAX_ATTEMPTS = 5;       // sonra kilitlenir
var MFSIM_AUTH_LOCK_MS = 60 * 1000;    // 60 sn kilit

async function mfsimSHA256(text) {
  var encoder = new TextEncoder();
  var data = encoder.encode(text);
  var hashBuffer = await crypto.subtle.digest('SHA-256', data);
  var hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function mfsimGetRL() {
  try {
    var raw = localStorage.getItem(MFSIM_AUTH_RL_KEY);
    if(!raw) return { attempts: 0, lockUntil: 0 };
    var obj = JSON.parse(raw);
    return { attempts: obj.attempts | 0, lockUntil: obj.lockUntil | 0 };
  } catch(e) { return { attempts: 0, lockUntil: 0 }; }
}

function mfsimSetRL(state) {
  try { localStorage.setItem(MFSIM_AUTH_RL_KEY, JSON.stringify(state)); } catch(e) {}
}

function mfsimClearRL() {
  try { localStorage.removeItem(MFSIM_AUTH_RL_KEY); } catch(e) {}
}

async function mfsimLogin() {
  var pw = document.getElementById('mfsim-login-password').value;
  var errEl = document.getElementById('mfsim-login-error');
  if(!pw) { errEl.textContent = 'Lütfen şifre giriniz.'; return; }

  var now = Date.now();
  var rl = mfsimGetRL();
  if(rl.lockUntil > now) {
    var sec = Math.ceil((rl.lockUntil - now) / 1000);
    errEl.textContent = '🔒 Çok fazla hatalı deneme. ' + sec + ' sn sonra tekrar deneyin.';
    return;
  }

  var hash = await mfsimSHA256(pw);
  if(hash === MFSIM_AUTH_HASH) {
    mfsimClearRL();
    var remember = document.getElementById('mfsim-login-remember').checked;
    if(remember) {
      localStorage.setItem(MFSIM_AUTH_KEY, hash);
    } else {
      sessionStorage.setItem(MFSIM_AUTH_KEY, hash);
    }
    mfsimShowApp();
  } else {
    var attempts = rl.attempts + 1;
    if(attempts >= MFSIM_AUTH_MAX_ATTEMPTS) {
      mfsimSetRL({ attempts: attempts, lockUntil: now + MFSIM_AUTH_LOCK_MS });
      errEl.textContent = '🔒 Çok fazla hatalı deneme. ' + Math.ceil(MFSIM_AUTH_LOCK_MS / 1000) + ' sn kilitlendi.';
    } else {
      mfsimSetRL({ attempts: attempts, lockUntil: 0 });
      var left = MFSIM_AUTH_MAX_ATTEMPTS - attempts;
      errEl.textContent = '❌ Hatalı şifre. Kalan deneme: ' + left + '.';
    }
    document.getElementById('mfsim-login-password').value = '';
    document.getElementById('mfsim-login-password').focus();
  }
}

function mfsimShowApp() {
  // Loader varsa: login'i kapatip splash + modul yuklemesini baslat.
  // Loader yoksa (eski sayfa, fallback): sadece login overlay'ini gizle.
  if(window.MFSimLoader && typeof window.MFSimLoader.start === 'function') {
    window.MFSimLoader.start();
  } else {
    var overlay = document.getElementById('mfsim-login-overlay');
    if(overlay) {
      overlay.style.transition = 'opacity 0.3s ease';
      overlay.style.opacity = '0';
      setTimeout(function() { overlay.style.display = 'none'; }, 300);
    }
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
    // Zaten giriş yapılmış — login overlay'i hic gostermeden direk
    // splash + modul yuklemesine gec.
    var overlay = document.getElementById('mfsim-login-overlay');
    if(overlay) overlay.style.display = 'none';
    if(window.MFSimLoader && typeof window.MFSimLoader.start === 'function') {
      window.MFSimLoader.start();
    }
  } else {
    // Giriş gerekli — input'a focus
    setTimeout(function() {
      var inp = document.getElementById('mfsim-login-password');
      if(inp) inp.focus();
    }, 100);
  }
})();
