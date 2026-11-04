/* =========================================================
   THEME TOGGLE
   ========================================================= */
(function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');
  function setTheme(t) {
    if (t === 'light') {
      root.setAttribute('data-theme', 'light');
      icon.textContent = 'light_mode';
    } else {
      root.removeAttribute('data-theme');
      icon.textContent = 'dark_mode';
    }
    try { localStorage.setItem('taratan_theme', t); } catch(e) {}
  }
  const current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  icon.textContent = current === 'light' ? 'light_mode' : 'dark_mode';
  btn.addEventListener('click', () => {
    const now = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    setTheme(now === 'light' ? 'dark' : 'light');
  });
})();

/* =========================================================
   STATE
   ========================================================= */
let allApps = [];
let selected = new Set();
let activeCategory = 'all';
let query = '';

/* =========================================================
   LOAD CATALOG
   ========================================================= */
fetch('apps.json')
  .then(r => r.json())
  .then(data => {
    allApps = data;
    renderChips();
    renderGrid();
  })
  .catch(() => {
    document.getElementById('appGrid').innerHTML =
      '<div class="empty"><span class="material-symbols-rounded">error</span><p>Could not load catalog.</p></div>';
  });

/* =========================================================
   HELPERS
   ========================================================= */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

function countByCategory() {
  const counts = { all: allApps.length };
  allApps.forEach(a => {
    counts[a.category] = (counts[a.category] || 0) + 1;
  });
  return counts;
}

/* =========================================================
   CHIPS
   ========================================================= */
function renderChips() {
  const container = document.getElementById('chips');
  const counts = countByCategory();
  const categories = [...new Set(allApps.map(a => a.category))];

  const iconMap = {
    'Browser': 'public', 'Zip Extractors': 'folder_zip',
    'Download Managers': 'download', 'Password Managers': 'password',
    'Note Taking': 'sticky_note_2', 'Media & PDF': 'perm_media',
    'File Sharing': 'share', 'Office': 'work',
    'Extra Tools': 'build', 'Developer Tools': 'code'
  };

  const chips = [{ key: 'all', label: 'All', icon: 'apps' }].concat(
    categories.map(c => ({ key: c, label: c, icon: iconMap[c] || 'folder' }))
  );

  container.innerHTML = chips.map(c => `
    <button class="chip${activeCategory === c.key ? ' active' : ''}" data-cat="${c.key}" role="tab">
      <span class="material-symbols-rounded" style="font-size:15px;">${c.icon}</span>
      ${escapeHtml(c.label)}
      <span class="count">${counts[c.key] || 0}</span>
    </button>
  `).join('');

  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', function() {
      activeCategory = this.dataset.cat;
      renderChips();
      renderGrid();
    });
  });
}

/* =========================================================
   FILTER + GRID
   ========================================================= */
function filteredApps() {
  return allApps.filter(app => {
    if (activeCategory !== 'all' && app.category !== activeCategory) return false;
    if (!query.trim()) return true;
    return (app.name + ' ' + app.category).toLowerCase().includes(query.toLowerCase());
  });
}

function renderGrid() {
  const grid = document.getElementById('appGrid');
  const list = filteredApps();

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty">
      <span class="material-symbols-rounded">search_off</span>
      <p>Nothing matches "${escapeHtml(query)}".</p>
    </div>`;
    return;
  }

  grid.innerHTML = list.map(app => {
    const isSelected = selected.has(app.id);
    const fallback = app.installer === 'fallback';
    return `
      <button class="app-card${isSelected ? ' selected' : ''}" data-id="${app.id}" aria-pressed="${isSelected}">
        <div class="app-card__check">
          <span class="material-symbols-rounded">check</span>
        </div>
        <div class="app-card__icon">
          <span class="material-symbols-rounded">${fallback ? 'open_in_new' : 'package_2'}</span>
        </div>
        <div class="app-card__body">
          <div class="app-card__name">${escapeHtml(app.name)}</div>
          <div class="app-card__cat">${escapeHtml(app.category)}</div>
          ${fallback ? '<div class="app-card__fallback"><span class="material-symbols-rounded">info</span> Opens official page</div>' : ''}
        </div>
      </button>`;
  }).join('');

  grid.querySelectorAll('.app-card').forEach(card => {
    card.addEventListener('click', function() {
      const id = this.dataset.id;
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      this.classList.toggle('selected');
      this.setAttribute('aria-pressed', selected.has(id));
      updateCount();
    });
  });
}

/* =========================================================
   COUNT + GENERATE
   ========================================================= */
function updateCount() {
  const n = selected.size;
  document.getElementById('countLabel').innerHTML = `<strong>${n}</strong> app${n === 1 ? '' : 's'} selected`;
  document.getElementById('generateBtn').disabled = n === 0;
}

document.getElementById('generateBtn').addEventListener('click', () => {
  const chosen = allApps.filter(a => selected.has(a.id));
  const installable = chosen.filter(a => a.installer !== 'fallback');
  const fallbacks = chosen.filter(a => a.installer === 'fallback');

  if (installable.length === 0 && fallbacks.length === 0) return;

  // Open fallback apps in new tabs
  fallbacks.forEach(app => {
    window.open(app.url, '_blank', 'noopener');
  });

  // Generate script for installable apps
  if (installable.length > 0) {
    const script = buildScript(installable);
    download('taratari-installer.ps1', script);
  }

  // If only fallbacks, show a quick message
  if (installable.length === 0 && fallbacks.length > 0) {
    alert('Selected app(s) open in a new tab. No script was generated.');
  }
});

/* =========================================================
   SCRIPT BUILDER
   ========================================================= */
function deriveFile(app) {
  if (app.file) return app.file;
  try {
    const base = new URL(app.url).pathname.split('/').pop();
    if (base && base.includes('.')) return base;
  } catch {}
  return app.name.replace(/[^a-z0-9]/gi, '_') + (app.installer === 'msi' ? '.msi' : '.exe');
}

function buildScript(apps) {
  const L = [];

  L.push('# Auto-generated by TaraTari Installer.');
  L.push('# Run this in an ELEVATED PowerShell window (Run as Administrator).');
  L.push('');
  L.push("$ErrorActionPreference = 'Continue'");
  L.push("$ProgressPreference    = 'SilentlyContinue'");
  L.push('');
  L.push('$isAdmin = ([Security.Principal.WindowsPrincipal]');
  L.push('  [Security.Principal.WindowsIdentity]::GetCurrent())');
  L.push('  .IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)');
  L.push('if (-not $isAdmin) {');
  L.push("  Write-Host 'ERROR: Please run as Administrator.' -ForegroundColor Red");
  L.push("  Read-Host 'Press Enter to exit'; exit 1");
  L.push('}');
  L.push('');
  L.push("$temp = Join-Path $env:TEMP ('taratari_' + [Guid]::NewGuid().ToString('N'))");
  L.push('New-Item -ItemType Directory -Path $temp -Force | Out-Null');
  L.push('$results = New-Object System.Collections.ArrayList');
  L.push('');
  L.push('function Install-Package {');
  L.push('  param($Name, $Url, $File, $Type, $Args)');
  L.push('  Write-Host "Installing $Name ..." -ForegroundColor Cyan');
  L.push('  $dest = Join-Path $temp $File');
  L.push('  try {');
  L.push('    Invoke-WebRequest -Uri $Url -OutFile $dest -UseBasicParsing -ErrorAction Stop');
  L.push('  } catch {');
  L.push('    Write-Host "  Download failed: $_" -ForegroundColor Red');
  L.push('    [void]$results.Add("$Name : DOWNLOAD FAILED"); return');
  L.push('  }');
  L.push('  try {');
  L.push("    if ($Type -eq 'msi') {");
  L.push('      $full = "/i \'" + $dest + "\' /qn /norestart " + $Args');
  L.push("      $p = Start-Process 'msiexec.exe' -ArgumentList $full -Wait -PassThru");
  L.push('    } else {');
  L.push('      $p = Start-Process -FilePath $dest -ArgumentList $Args -Wait -PassThru');
  L.push('    }');
  L.push('    if ($p.ExitCode -eq 0 -or $p.ExitCode -eq 3010) {');
  L.push('      [void]$results.Add("$Name : OK")');
  L.push('    } else {');
  L.push('      [void]$results.Add("$Name : EXIT CODE $($p.ExitCode)")');
  L.push('    }');
  L.push('  } catch {');
  L.push('    [void]$results.Add("$Name : INSTALL FAILED")');
  L.push('    Write-Host "  Install failed: $_" -ForegroundColor Red');
  L.push('  }');
  L.push('}');
  L.push('');

  apps.forEach(app => {
    const file = deriveFile(app);
    const args = app.args ? `'${app.args.replace(/'/g, "''")}'` : "''";
    L.push(
      `Install-Package -Name '${app.name.replace(/'/g, "''")}' ` +
      `-Url '${app.url.replace(/'/g, "''")}' ` +
      `-File '${file}' -Type '${app.installer}' -Args ${args}`
    );
  });

  L.push('');
  L.push("Write-Host ''; Write-Host '===== SUMMARY =====' -ForegroundColor Cyan");
  L.push('$results | ForEach-Object { Write-Host $_ }');
  L.push('Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue');
  L.push("Write-Host ''; Read-Host 'Done. Press Enter to close'");

  return L.join('\n');
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================================================
   SEARCH
   ========================================================= */
function debounce(fn, wait) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');

searchInput.addEventListener('input', debounce(function() {
  query = this.value;
  searchClear.hidden = !this.value;
  renderGrid();
}, 100));

searchClear.addEventListener('click', function() {
  searchInput.value = '';
  query = '';
  searchClear.hidden = true;
  renderGrid();
  searchInput.focus();
});

/* =========================================================
   INIT LOADER
   ========================================================= */
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('pageLoader').classList.add('done');
  }, 900);
});