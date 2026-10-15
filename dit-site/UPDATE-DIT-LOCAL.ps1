param(
  [string]$JarvisRoot = (Join-Path $env:USERPROFILE 'JARVIS'),
  [string]$DitRoot = $PSScriptRoot
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# This updater touches source files only. It does not copy or print credentials.
if (-not (Test-Path -LiteralPath (Join-Path $JarvisRoot 'src\jarvis\__main__.py'))) {
  throw "JARVIS source not found at $JarvisRoot. Stop here; no folder was deleted."
}
if (-not (Test-Path -LiteralPath (Join-Path $DitRoot 'Start-DIT-With-JARVIS.ps1'))) {
  throw "The existing DIT dit-site folder was not found at $DitRoot."
}
foreach ($port in @(8768,4173)) {
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($listener) {
    throw "Port $port is still in use (PID $($listener.OwningProcess)). Stop the old JARVIS and DIT windows with Ctrl+C, then try again."
  }
}

$manifest = @(
  @{repo='1'; scope='jarvis'; path='src/jarvis/app.py'; branch='main'},
  @{repo='1'; scope='jarvis'; path='src/jarvis/agent_team.py'; branch='main'},
  @{repo='1'; scope='jarvis'; path='src/jarvis/ollama.py'; branch='main'},
  @{repo='1'; scope='jarvis'; path='src/jarvis/runtime.py'; branch='main'},
  @{repo='1'; scope='jarvis'; path='src/jarvis/web/index.html'; branch='main'},
  @{repo='1'; scope='jarvis'; path='src/jarvis/web/app.js'; branch='main'},
  @{repo='1'; scope='jarvis'; path='src/jarvis/web/styles.css'; branch='main'},
  @{repo='2'; scope='dit'; path='dit-site/dist/index.html'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/dist/control-room.js'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/dist/control-room.css'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/dist/live-research.js'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/dist/terminal-ui.js'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/dist/live-research.css'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/dist/operator.html'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/dist/operator.js'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/dist/operator-review.js'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/dist/operator.css'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/server/autonomous.mjs'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/server/operator.mjs'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/server/local.mjs'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/server/lib/routes.js'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/server/lib/concepts.js'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/server/lib/agents.js'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/server/lib/store-core.js'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/server/lib/market-snapshot.js'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/worker/provider-bridge.js'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/worker/market-bridge.js'; branch='dit-3d-assets'},
  @{repo='2'; scope='dit'; path='dit-site/Start-DIT-With-JARVIS.ps1'; branch='dit-3d-assets'}
)
$stage = Join-Path $env:TEMP ('DIT-update-' + [guid]::NewGuid().ToString('N'))
$backup = Join-Path $DitRoot ('.data\source-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $stage | Out-Null

try {
  Write-Host "Staging $($manifest.Count) source files. No files are overwritten until downloads finish." -ForegroundColor Cyan
  foreach ($entry in $manifest) {
    $rel = if ($entry.scope -eq 'dit') { $entry.path.Substring(9) } else { $entry.path }
    $target = Join-Path $stage (Join-Path $entry.scope $rel.Replace('/','\'))
    New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
    $url = "https://raw.githubusercontent.com/reixdd/$($entry.repo)/$($entry.branch)/$($entry.path)"
    Invoke-WebRequest -Uri $url -UseBasicParsing -OutFile $target -TimeoutSec 60
    if ((Get-Item -LiteralPath $target).Length -lt 20) { throw "Downloaded file was unexpectedly empty: $($entry.path)" }
  }
  $stagedIndex = Join-Path $stage 'dit\dist\index.html'
  if (-not (Select-String -LiteralPath $stagedIndex -Pattern 'id="dit-live-evidence-section"' -Quiet)) {
    throw 'The downloaded homepage lacks the live market component. No files have been replaced.'
  }
  if (-not (Select-String -LiteralPath (Join-Path $stage 'dit\dist\control-room.js') -Pattern 'mountControlRoom' -Quiet)) {
    throw 'The interactive machine shell was not downloaded. No files have been replaced.'
  }
  if (-not (Select-String -LiteralPath (Join-Path $stage 'jarvis\src\jarvis\app.py') -Pattern 'dit_stream_protocol' -Quiet)) {
    throw 'The downloaded JARVIS version does not contain the updated DIT stream protocol.'
  }
  Write-Host 'All downloads and version checks passed. Backing up only the files that will change.' -ForegroundColor Cyan

  foreach ($entry in $manifest) {
    $rel = if ($entry.scope -eq 'dit') { $entry.path.Substring(9) } else { $entry.path }
    $relative = $rel.Replace('/','\')
    $root = if ($entry.scope -eq 'dit') { $DitRoot } else { $JarvisRoot }
    $source = Join-Path $stage (Join-Path $entry.scope $relative)
    $target = Join-Path $root $relative
    $old = Join-Path $backup (Join-Path $entry.scope $relative)
    if (Test-Path -LiteralPath $target) {
      New-Item -ItemType Directory -Force -Path (Split-Path $old) | Out-Null
      Copy-Item -LiteralPath $target -Destination $old -Force
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
  }
  Write-Host 'DIT AND JARVIS SOURCE UPDATED.' -ForegroundColor Green
  Write-Host "Original files backed up under: $backup"
  Write-Host 'UNCHANGED: .env / .venv / data / history / Ollama models / Supabase credentials.'
  Write-Host 'Next: run START-DIT-WITH-JARVIS.cmd from the same dit-site folder.'
} finally {
  Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
}
