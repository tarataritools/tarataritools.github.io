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
   NUMBERED CATEGORIES
   ========================================================= */
const CATEGORY_ORDER = [
  'Browser',
  'Zip Extractors',
  'Download Managers',
  'Password Managers',
  'Note Taking',
  'Media & PDF',
  'File Sharing',
  'Office',
  'Extra Tools',
  'Developer Tools'
];

const CATEGORY_ICONS = {
  'Browser': 'public',
  'Zip Extractors': 'folder_zip',
  'Download Managers': 'download',
  'Password Managers': 'password',
  'Note Taking': 'sticky_note_2',
  'Media & PDF': 'perm_media',
  'File Sharing': 'share',
  'Office': 'work',
  'Extra Tools': 'build',
  'Developer Tools': 'code'
};

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
    document.getElementById('appContainer').innerHTML =
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
  allApps.forEach(a => { counts[a.category] = (counts[a.category] || 0) + 1; });
  return counts;
}

function categoryIndex(cat) {
  const i = CATEGORY_ORDER.indexOf(cat);
  return i >= 0 ? (i + 1) : 0;
}

/* =========================================================
   CHIPS
   ========================================================= */
function renderChips() {
  const container = document.getElementById('chips');
  const counts = countByCategory();
  const categories = CATEGORY_ORDER.filter(c => counts[c]);

  const chips = [{ key: 'all', label: 'All', icon: 'apps', num: '' }]
    .concat(categories.map(c => ({
      key: c,
      label: c,
      icon: CATEGORY_ICONS[c] || 'folder',
      num: String(categoryIndex(c))
    })));

  container.innerHTML = chips.map(c => `
    <button class="chip${activeCategory === c.key ? ' active' : ''}" data-cat="${c.key}" role="tab">
      ${c.num ? `<span class="chip__num">${c.num}</span>` : `<span class="material-symbols-rounded" style="font-size:15px;">${c.icon}</span>`}
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

function appCardHTML(app) {
  const isSelected = selected.has(app.id);
  const fallback = app.installer === 'fallback';
  const icon = app.icon
    ? `<img src="${escapeHtml(app.icon)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : `<span class="material-symbols-rounded">${fallback ? 'open_in_new' : 'package_2'}</span>`;

  return `
    <button class="app-card${isSelected ? ' selected' : ''}" data-id="${app.id}" aria-pressed="${isSelected}">
      <div class="app-card__check">
        <span class="material-symbols-rounded">check</span>
      </div>
      <div class="app-card__icon">${icon}</div>
      <div class="app-card__body">
        <div class="app-card__name">${escapeHtml(app.name)}</div>
        <div class="app-card__cat">${escapeHtml(app.category)}</div>
        ${fallback ? '<div class="app-card__fallback"><span class="material-symbols-rounded">info</span> Opens official page</div>' : ''}
      </div>
    </button>`;
}

function bindCardClicks(root) {
  root.querySelectorAll('.app-card').forEach(card => {
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

function renderGrid() {
  const container = document.getElementById('appContainer');
  const list = filteredApps();

  if (list.length === 0) {
    container.innerHTML = `<div class="empty">
      <span class="material-symbols-rounded">search_off</span>
      <p>Nothing matches "${escapeHtml(query)}".</p>
    </div>`;
    return;
  }

  // Grouped view (All + no search)
  if (activeCategory === 'all' && !query.trim()) {
    const byCat = {};
    list.forEach(a => {
      if (!byCat[a.category]) byCat[a.category] = [];
      byCat[a.category].push(a);
    });

    const ordered = CATEGORY_ORDER.filter(c => byCat[c]);
    container.innerHTML = ordered.map(cat => {
      const items = byCat[cat];
      return `
        <section class="app-section">
          <h2 class="app-section__title">
            <span class="app-section__num">${categoryIndex(cat)}</span>
            ${escapeHtml(cat)}
            <span class="app-section__count">${items.length}</span>
          </h2>
          <div class="app-grid">
            ${items.map(appCardHTML).join('')}
          </div>
        </section>`;
    }).join('');
    bindCardClicks(container);
    return;
  }

  // Flat view
  container.innerHTML = `<div class="app-grid">${list.map(appCardHTML).join('')}</div>`;
  bindCardClicks(container);
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

  // Open fallback URLs synchronously inside the click handler
  fallbacks.forEach(app => window.open(app.url, '_blank', 'noopener'));

  // Download .bat for installable apps
  if (installable.length > 0) {
    const psScript = buildPowerShell(installable);
    const bat = buildBat(psScript);
    downloadFile('taratari-installer.bat', bat);
  } else if (fallbacks.length > 0) {
    // Only fallbacks — nothing else to do
  }
});

/* =========================================================
   FILE DOWNLOAD HELPER
   ========================================================= */
function downloadFile(filename, text) {
  const blob = new Blob([text], { type: 'application/octet-stream' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =========================================================
   POWERSHELL SCRIPT BUILDER
   ========================================================= */
function deriveFile(app) {
  if (app.file) return app.file;
  try {
    const base = new URL(app.url).pathname.split('/').pop();
    if (base && base.includes('.')) return base;
  } catch {}
  return app.name.replace(/[^a-z0-9]/gi, '_') + (app.installer === 'msi' ? '.msi' : '.exe');
}

function buildPowerShell(apps) {
  const lines = [];

  lines.push("$ErrorActionPreference = 'SilentlyContinue'");
  lines.push("Add-Type -AssemblyName System.Windows.Forms");
  lines.push("Add-Type -AssemblyName System.Drawing");
  lines.push("");
  lines.push("$apps = @(");
  apps.forEach(app => {
    const name = String(app.name).replace(/\|/g, '-');
    const url  = String(app.url).replace(/\|/g, '%7C');
    const file = deriveFile(app).replace(/\|/g, '-');
    const type = app.installer;
    const args = String(app.args || '').replace(/\|/g, ' ');
    lines.push(`"${name}|${url}|${file}|${type}|${args}"`);
  });
  lines.push(")");
  lines.push("");

  lines.push(String.raw`
$temp = Join-Path $env:TEMP ("taratari_" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp -Force | Out-Null

$bgColor     = [System.Drawing.Color]::FromArgb(19, 19, 22)
$fgColor     = [System.Drawing.Color]::FromArgb(228, 228, 231)
$mutedColor  = [System.Drawing.Color]::FromArgb(161, 161, 170)
$accentColor = [System.Drawing.Color]::FromArgb(102, 255, 102)
$surfaceColor= [System.Drawing.Color]::FromArgb(28, 28, 32)
$borderColor = [System.Drawing.Color]::FromArgb(39, 39, 42)
$warnColor   = [System.Drawing.Color]::FromArgb(245, 158, 11)

$form = New-Object System.Windows.Forms.Form
$form.Text = "TaraTari Installer"
$form.Size = New-Object System.Drawing.Size(560, 460)
$form.StartPosition = "CenterScreen"
$form.BackColor = $bgColor
$form.ForeColor = $fgColor
$form.FormBorderStyle = "FixedSingle"
$form.MaximizeBox = $false
$form.MinimizeBox = $false

$title = New-Object System.Windows.Forms.Label
$title.Text = "TaraTari Installer"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 20, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = $accentColor
$title.Location = New-Object System.Drawing.Point(24, 20)
$title.Size = New-Object System.Drawing.Size(500, 40)
$form.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = "Installing your selected apps"
$subtitle.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$subtitle.ForeColor = $mutedColor
$subtitle.Location = New-Object System.Drawing.Point(24, 62)
$subtitle.Size = New-Object System.Drawing.Size(500, 20)
$form.Controls.Add($subtitle)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = "Preparing..."
$statusLabel.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$statusLabel.ForeColor = $fgColor
$statusLabel.Location = New-Object System.Drawing.Point(24, 100)
$statusLabel.Size = New-Object System.Drawing.Size(500, 22)
$form.Controls.Add($statusLabel)

$progress = New-Object System.Windows.Forms.ProgressBar
$progress.Location = New-Object System.Drawing.Point(24, 130)
$progress.Size = New-Object System.Drawing.Size(496, 22)
$progress.Minimum = 0
$progress.Maximum = 100
$form.Controls.Add($progress)

$logBox = New-Object System.Windows.Forms.ListBox
$logBox.Location = New-Object System.Drawing.Point(24, 170)
$logBox.Size = New-Object System.Drawing.Size(496, 170)
$logBox.BackColor = $surfaceColor
$logBox.ForeColor = $fgColor
$logBox.BorderStyle = "FixedSingle"
$logBox.Font = New-Object System.Drawing.Font("Consolas", 9)
$form.Controls.Add($logBox)

$closeBtn = New-Object System.Windows.Forms.Button
$closeBtn.Text = "Please wait..."
$closeBtn.Location = New-Object System.Drawing.Point(408, 360)
$closeBtn.Size = New-Object System.Drawing.Size(112, 36)
$closeBtn.BackColor = $surfaceColor
$closeBtn.ForeColor = $mutedColor
$closeBtn.FlatStyle = "Flat"
$closeBtn.FlatAppearance.BorderColor = $borderColor
$closeBtn.Enabled = $false
$form.Controls.Add($closeBtn)
$closeBtn.Add_Click({ $form.Close() })

$form.Add_Shown({
    $total = $apps.Count
    $i = 0
    $ok = 0
    $failed = 0

    foreach ($entry in $apps) {
        $parts = $entry -split '\|'
        $name = $parts[0]
        $url  = $parts[1]
        $file = $parts[2]
        $type = $parts[3]
        $appArgs = if ($parts.Count -ge 5) { $parts[4] } else { '' }

        $statusLabel.Text = "Installing $name..."
        $form.Refresh()
        [System.Windows.Forms.Application]::DoEvents()

        $dest = Join-Path $temp $file
        $dlOk = $true

        try {
            Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -ErrorAction Stop
        } catch {
            $dlOk = $false
            $logBox.Items.Add("X  $name : download failed")
            $logBox.TopIndex = $logBox.Items.Count - 1
            $failed++
        }

        if ($dlOk) {
            try {
                if ($type -eq 'msi') {
                    $msiArgs = "/i `"$dest`" /qn /norestart $appArgs"
                    $p = Start-Process 'msiexec.exe' -ArgumentList $msiArgs -Wait -PassThru -WindowStyle Hidden
                } elseif ($appArgs -ne '') {
                    $p = Start-Process -FilePath $dest -ArgumentList $appArgs -Wait -PassThru -WindowStyle Hidden
                } else {
                    $p = Start-Process -FilePath $dest -Wait -PassThru -WindowStyle Hidden
                }

                if ($p.ExitCode -eq 0 -or $p.ExitCode -eq 3010) {
                    $logBox.Items.Add("OK $name")
                    $ok++
                } else {
                    $logBox.Items.Add("!! $name : exit $($p.ExitCode)")
                    $failed++
                }
            } catch {
                $logBox.Items.Add("X  $name : install failed")
                $failed++
            }
            $logBox.TopIndex = $logBox.Items.Count - 1
        }

        $i++
        $progress.Value = [int][math]::Round(($i / $total) * 100)
        $form.Refresh()
        [System.Windows.Forms.Application]::DoEvents()
    }

    if ($failed -eq 0) {
        $statusLabel.Text = "All done! $ok of $total installed."
        $statusLabel.ForeColor = $accentColor
    } else {
        $statusLabel.Text = "Done: $ok installed, $failed failed"
        $statusLabel.ForeColor = $warnColor
    }
    $subtitle.Text = "You can close this window."
    $closeBtn.Text = "Close"
    $closeBtn.BackColor = $accentColor
    $closeBtn.ForeColor = [System.Drawing.Color]::Black
    $closeBtn.Enabled = $true
    $form.Refresh()

    Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue
})

[System.Windows.Forms.Application]::Run($form)
`);

  return lines.join('\r\n');
}

/* =========================================================
   BATCH WRAPPER (self-elevating, hidden, GUI)
   ========================================================= */
function psToBase64Utf16Le(script) {
  // UTF-16LE with BOM
  const buf = new ArrayBuffer(2 + script.length * 2);
  const view = new Uint8Array(buf);
  view[0] = 0xFF;
  view[1] = 0xFE;
  for (let i = 0; i < script.length; i++) {
    const code = script.charCodeAt(i);
    view[2 + i * 2]     = code & 0xFF;
    view[2 + i * 2 + 1] = (code >> 8) & 0xFF;
  }
  let binary = '';
  for (let i = 0; i < view.length; i++) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary);
}

function chunkBase64(b64, size) {
  const chunks = [];
  for (let i = 0; i < b64.length; i += size) {
    chunks.push(b64.slice(i, i + size));
  }
  return chunks;
}

function buildBat(psScript) {
  const b64 = psToBase64Utf16Le(psScript);
  const lines = chunkBase64(b64, 76);
  const echoLines = lines.map(l => `echo ${l}`).join('\r\n');

  return [
    '@echo off',
    'setlocal enabledelayedexpansion',
    '',
    'net session >nul 2>&1',
    'if %errorLevel% neq 0 (',
    '    powershell -Command "Start-Process -FilePath \'%~f0\' -Verb RunAs"',
    '    exit /b',
    ')',
    '',
    'set "TMPD=%TEMP%\\taratari_%RANDOM%_%RANDOM%"',
    'mkdir "!TMPD!" 2>nul',
    '',
    '(',
    echoLines,
    ') > "!TMPD!\\s.b64"',
    '',
    'powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -Command "[IO.File]::WriteAllBytes(\'!TMPD!\\s.ps1\', [Convert]::FromBase64String(((Get-Content -Raw \'!TMPD!\\s.b64\') -replace \'\\s\',\'\')))"',
    'powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "!TMPD!\\s.ps1"',
    '',
    'rmdir /s /q "!TMPD!" 2>nul',
    'exit'
  ].join('\r\n');
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
   INIT
   ========================================================= */
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('pageLoader').classList.add('done');
  }, 900);
});
