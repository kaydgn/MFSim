// ============================================================================
// PROGRAM DURUMU MODALI
// ============================================================================
// Şeritteki (Araçlar → Program) "Program Durumu" öğesinden açılır. Mevcut deploy bilgisini
// (sağ-üstten taşındı) ve GitHub'dan son commit'leri (Son Güncellemeler) gösterir.
// deploy-status.js'in altyapısını yeniden kullanır: _veCheckDeploy çağrılır
// (popup açmadan), dot data attribute'undan mevcut durum okunur.
// ============================================================================

function veOpenStatusModal() {
  var ov = document.getElementById('ve-status-overlay');
  if(!ov) return;
  ov.style.display = 'flex';
  _veStatusRender();
  // Rozeti düşür — kullanıcı modalı açtı, haberi gördü
  _veStatusUpdateSeen = true;
  if(typeof veRibbonRefreshBadges === 'function') veRibbonRefreshBadges();
  document.addEventListener('keydown', _veStatusEscHandler);
}

// ── Güncelleme rozeti ──────────────────────────────────────────────────────
// Tek doğruluk kaynağı deploy-status.js'in dot'undaki class. Rozeti şerit çizer
// (Araçlar → Program Durumu butonu ve "Araçlar" sekmesi); burada yalnız
// "gösterilmeli mi?" sorusu yanıtlanır. Eskiden rozet marka menüsünün içinde
// duruyordu — menü kaldırıldı, haber ise kaldırılmadı.
var _veStatusUpdateSeen = false;

function veStatusUpdatePending() {
  if(_veStatusUpdateSeen) return false;
  var dot = document.getElementById('ve-deploy-dot');
  return !!(dot && dot.classList.contains('ve-deploy-update-available'));
}

(function _veStatusInitBadgeWatcher() {
  function attach() {
    var dot = document.getElementById('ve-deploy-dot');
    if(!dot) { setTimeout(attach, 500); return; }
    var wasUpdate = dot.classList.contains('ve-deploy-update-available');
    new MutationObserver(function() {
      var isUpdate = dot.classList.contains('ve-deploy-update-available');
      // Yeni bir güncelleme geldiyse "görüldü" sıfırlanır: bir sonraki sürüm
      // de haber vermeli, ilk modal açılışı sonsuza dek susturmamalı.
      if(isUpdate && !wasUpdate) _veStatusUpdateSeen = false;
      wasUpdate = isUpdate;
      if(typeof veRibbonRefreshBadges === 'function') veRibbonRefreshBadges();
    }).observe(dot, { attributes: true, attributeFilter: ['class'] });
    if(typeof veRibbonRefreshBadges === 'function') veRibbonRefreshBadges();
  }
  attach();
})();

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
  var updateAvailable = dotClass === 've-deploy-update-available';

  var html = '';
  // Güncelleme banner'ı — yalnız update mevcutsa görünür
  if(updateAvailable) {
    html += '<div class="ve-status-update-banner">';
    html += '<div class="ve-status-update-banner-info">';
    html += '<div class="ve-status-update-banner-title"><span class="mf-ico mf-ico-bell"></span> Yeni Sürüm Mevcut</div>';
    html += '<div class="ve-status-update-banner-desc">Yeni sürüm indirildi; uygulanması için sayfanın yenilenmesi gerekiyor.</div>';
    html += '</div>';
    html += '<button class="ve-status-update-banner-btn" onclick="_veApplyUpdate()"><span class="mf-ico mf-ico-refresh"></span> Şimdi Güncelle</button>';
    html += '</div>';
  }

  html += '<h3 class="ve-settings-section-title">Mevcut Sürüm</h3>';
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
    html += '<div class="ve-settings-value"><code style="font-size:var(--fs-body);">' + info.headSha.slice(0,8) + '</code></div></div>';
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
  html += '<div id="ve-status-commits"><div style="color:var(--text-muted);font-size:var(--fs-body);padding:10px 0;">Yükleniyor...</div></div>';

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
        el.innerHTML = '<div style="color:var(--text-muted);font-size:var(--fs-body);">Commit bulunamadı.</div>';
        return;
      }
      // Tarihe göre grupla: Bugün / Dün / Bu hafta / Eski
      var now = new Date();
      var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      var yesterdayStart = todayStart - 86400000;
      var weekStart = todayStart - 7 * 86400000;
      var groups = { today: [], yesterday: [], thisWeek: [], older: [] };
      commits.forEach(function(c) {
        var d = c.commit && c.commit.author && c.commit.author.date;
        if(!d) { groups.older.push(c); return; }
        var t = new Date(d).getTime();
        if(t >= todayStart) groups.today.push(c);
        else if(t >= yesterdayStart) groups.yesterday.push(c);
        else if(t >= weekStart) groups.thisWeek.push(c);
        else groups.older.push(c);
      });
      var groupLabels = { today: 'Bugün', yesterday: 'Dün', thisWeek: 'Bu hafta', older: 'Eski' };
      var html = '';
      ['today','yesterday','thisWeek','older'].forEach(function(key) {
        if(!groups[key].length) return;
        html += '<div class="ve-settings-subhead" style="margin-top:14px;">' + groupLabels[key] + '</div>';
        html += '<ul class="ve-status-commit-list">';
        groups[key].forEach(function(c) {
        var fullMsg = (c.commit && c.commit.message) || '';
        var lines = fullMsg.split('\n');
        var subject = lines[0];
        var body = lines.slice(1).join('\n').trim();
        var subjectShort = subject.length > 75 ? subject.slice(0, 75) + '…' : subject;
        var when = _veStatusFmtAgo(c.commit && c.commit.author && c.commit.author.date);
        var sha = (c.sha || '').slice(0, 7);
        var fullSha = c.sha || '';
        var url = c.html_url || '#';
        var author = (c.commit && c.commit.author && c.commit.author.name) || 'Bilinmiyor';
        var authorLogin = (c.author && c.author.login) || '';
        var date = c.commit && c.commit.author && c.commit.author.date;
        var dateStr = date ? new Date(date).toLocaleString('tr-TR') : '';

        html += '<li class="ve-status-commit" data-sha="' + fullSha + '">';
        html += '<div class="ve-status-commit-row" onclick="_veStatusToggleCommit(\'' + fullSha + '\')">';
        html += '<span class="ve-status-commit-arrow">▸</span>';
        html += '<code class="ve-status-commit-sha">' + sha + '</code>';
        html += '<span class="ve-status-commit-msg">' + _veStatusEsc(subjectShort) + '</span>';
        html += '<small class="ve-status-commit-when">' + when + '</small>';
        html += '</div>';
        html += '<div class="ve-status-commit-detail">';
        if(body) {
          html += '<pre class="ve-status-commit-body">' + _veStatusEsc(body) + '</pre>';
        }
        html += '<div class="ve-status-commit-meta">';
        html += '<div><span class="ve-status-commit-meta-label">Yazar</span>' + _veStatusEsc(author);
        if(authorLogin) html += ' <small style="opacity:0.7;">(@' + _veStatusEsc(authorLogin) + ')</small>';
        html += '</div>';
        if(dateStr) html += '<div><span class="ve-status-commit-meta-label">Tarih</span>' + _veStatusEsc(dateStr) + '</div>';
        html += '<div><span class="ve-status-commit-meta-label">Commit</span><code style="font-size:var(--fs-tiny);opacity:0.85;">' + _veStatusEsc(fullSha) + '</code></div>';
        html += '</div>';
        html += '<div class="ve-status-commit-actions"><a href="' + url + '" target="_blank" rel="noopener" class="ve-settings-btn"><span class="mf-ico mf-ico-link"></span> GitHub\'da Aç</a></div>';
        html += '</div>';
        html += '</li>';
        });
        html += '</ul>';
      });
      el.innerHTML = html;
    })
    .catch(function(e) {
      var el = document.getElementById('ve-status-commits');
      if(el) el.innerHTML = '<div style="color:var(--accent-warning);font-size:var(--fs-body);padding:10px 0;">Güncellemeler alınamadı: ' + _veStatusEsc(e.message) + '</div>';
    });
}

function _veStatusToggleCommit(sha) {
  var li = document.querySelector('.ve-status-commit[data-sha="' + sha + '"]');
  if(li) li.classList.toggle('expanded');
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
