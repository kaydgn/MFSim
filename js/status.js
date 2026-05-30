// ============================================================================
// PROGRAM DURUMU MODALI
// ============================================================================
// Proje menüsündeki "Program Durumu" öğesinden açılır. Mevcut deploy bilgisini
// (sağ-üstten taşındı) ve GitHub'dan son commit'leri (Son Güncellemeler) gösterir.
// deploy-status.js'in altyapısını yeniden kullanır: _veCheckDeploy çağrılır
// (popup açmadan), dot data attribute'undan mevcut durum okunur.
// ============================================================================

function veOpenStatusModal() {
  if(typeof veCloseFileMenu === 'function') veCloseFileMenu();
  var ov = document.getElementById('ve-status-overlay');
  if(!ov) return;
  ov.style.display = 'flex';
  _veStatusRender();
  document.addEventListener('keydown', _veStatusEscHandler);
}

function veCloseStatusModal() {
  var ov = document.getElementById('ve-status-overlay');
  if(ov) ov.style.display = 'none';
  document.removeEventListener('keydown', _veStatusEscHandler);
}

function _veStatusEscHandler(e) {
  if(e.key !== 'Escape') return;
  var t = e.target;
  if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  veCloseStatusModal();
}

function veStatusRefreshNow() {
  var btn = document.getElementById('ve-status-refresh-btn');
  if(btn) btn.disabled = true;
  if(typeof _veCheckDeploy === 'function') {
    _veCheckDeploy(function() { _veStatusRender(); });
  } else {
    if(btn) btn.disabled = false;
  }
}

function _veStatusRender() {
  var content = document.getElementById('ve-status-content');
  if(!content) return;

  // Mevcut deploy durumu — deploy-status.js dot üzerinde tutuyor
  var dot = document.getElementById('ve-deploy-dot');
  var dotClass = null;
  if(dot) {
    var cls = Array.from(dot.classList);
    var found = cls.find(function(c) { return c.indexOf('ve-deploy-') === 0 && c !== 've-deploy-dot' && c !== 've-deploy-refresh'; });
    dotClass = found || 've-deploy-unknown';
  }
  var rawInfo = dot ? dot.getAttribute('data-deploy-info') : null;
  var info = null;
  try { info = rawInfo ? JSON.parse(rawInfo) : null; } catch(e) {}

  var labels = {
    've-deploy-success':          'Program güncel',
    've-deploy-pending':           'Deploy devam ediyor',
    've-deploy-update-available':  'Güncelleme mevcut',
    've-deploy-error':             'Deploy başarısız',
    've-deploy-unknown':           'Henüz kontrol edilmedi',
    've-deploy-offline':           'Çevrimdışı',
    've-deploy-ratelimit':         'API limiti aşıldı'
  };
  var statusLbl = labels[dotClass] || 'Bilinmiyor';

  var html = '<h3 class="ve-settings-section-title">Mevcut Sürüm</h3>';
  html += '<div class="ve-settings-row"><span class="ve-settings-label">Durum</span>';
  html += '<div class="ve-settings-value" style="display:flex;align-items:center;gap:10px;">';
  html += '<span class="ve-deploy-dot ' + dotClass + '" style="position:relative;margin:0;width:11px;height:11px;cursor:default;"></span>';
  html += '<span>' + statusLbl + '</span>';
  html += '</div></div>';

  if(info && info.runId) {
    html += '<div class="ve-settings-row"><span class="ve-settings-label">Workflow Run</span>';
    html += '<div class="ve-settings-value"><a href="https://github.com/kaydgn/MFSim/actions/runs/' + info.runId + '" target="_blank" rel="noopener">#' + info.runId + '</a></div></div>';
  }
  if(info && info.headSha) {
    html += '<div class="ve-settings-row"><span class="ve-settings-label">Commit</span>';
    html += '<div class="ve-settings-value"><code style="font-size:0.7rem;">' + info.headSha.slice(0,8) + '</code></div></div>';
  }
  if(info && (info.updated_at || info.timestamp)) {
    var ts = info.updated_at || info.timestamp;
    html += '<div class="ve-settings-row"><span class="ve-settings-label">Yayınlanma</span>';
    html += '<div class="ve-settings-value">' + _veStatusFmtAgo(ts) + '</div></div>';
  }

  html += '<div class="ve-settings-btn-row">';
  html += '<button id="ve-status-refresh-btn" class="ve-settings-btn" onclick="veStatusRefreshNow()"><span class="mf-ico mf-ico-refresh"></span> Tekrar Kontrol Et</button>';
  html += '</div>';

  // Son güncellemeler bölümü — GitHub commits API
  html += '<h3 class="ve-settings-section-title" style="margin-top:24px;">Son Güncellemeler</h3>';
  html += '<p class="ve-settings-desc">main branch\'ine yapılan son commit\'ler.</p>';
  html += '<div id="ve-status-commits"><div style="color:var(--text-muted);font-size:0.72rem;padding:10px 0;">Yükleniyor...</div></div>';

  content.innerHTML = html;
  _veStatusLoadCommits();
}

function _veStatusLoadCommits() {
  fetch('https://api.github.com/repos/kaydgn/MFSim/commits?per_page=10')
    .then(function(r) {
      if(!r.ok) throw new Error('HTTP ' + r.status + (r.status === 403 ? ' (API limiti)' : ''));
      return r.json();
    })
    .then(function(commits) {
      var el = document.getElementById('ve-status-commits');
      if(!el) return;
      if(!Array.isArray(commits) || !commits.length) {
        el.innerHTML = '<div style="color:var(--text-muted);font-size:0.72rem;">Commit bulunamadı.</div>';
        return;
      }
      var html = '<table class="ve-settings-table"><tbody>';
      commits.forEach(function(c) {
        var msg = (c.commit && c.commit.message || '').split('\n')[0];
        if(msg.length > 70) msg = msg.slice(0, 70) + '…';
        var when = _veStatusFmtAgo(c.commit && c.commit.author && c.commit.author.date);
        var sha = (c.sha || '').slice(0, 7);
        var url = c.html_url || '#';
        html += '<tr>';
        html += '<td style="width:60px;"><a href="' + url + '" target="_blank" rel="noopener"><code style="font-size:0.65rem;opacity:0.75;">' + sha + '</code></a></td>';
        html += '<td>' + _veStatusEsc(msg) + '</td>';
        html += '<td style="width:90px;text-align:right;"><small style="opacity:0.7;white-space:nowrap;">' + when + '</small></td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      el.innerHTML = html;
    })
    .catch(function(e) {
      var el = document.getElementById('ve-status-commits');
      if(el) el.innerHTML = '<div style="color:var(--accent-warning);font-size:0.72rem;padding:10px 0;">Güncellemeler alınamadı: ' + _veStatusEsc(e.message) + '</div>';
    });
}

function _veStatusEsc(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

function _veStatusFmtAgo(ts) {
  if(!ts) return '—';
  var d = new Date(ts);
  if(isNaN(d)) return String(ts);
  var diff = Date.now() - d.getTime();
  if(diff < 0) return 'şimdi';
  var sec = Math.floor(diff / 1000);
  if(sec < 60) return sec + ' sn önce';
  var min = Math.floor(sec / 60);
  if(min < 60) return min + ' dk önce';
  var h = Math.floor(min / 60);
  if(h < 24) return h + ' sa önce';
  var dy = Math.floor(h / 24);
  if(dy < 30) return dy + ' gün önce';
  return d.toLocaleDateString('tr-TR');
}
