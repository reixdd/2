param(
  [int]$Port = 4173,
  [int]$JarvisPort = 8768,
  [string]$JarvisRoot = "$env:USERPROFILE\JARVIS"
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# Only use the user's existing installation. Never start duplicate Ollama or JARVIS instances.
$envFile = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw 'Missing private dit-site\.env. Configure the existing DIT SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY locally first. Do not commit or paste the key into chat.'
}
$entries = Get-Content -LiteralPath $envFile
foreach ($name in @('SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY')) {
  if (-not ($entries | Where-Object { $_ -match "^\s*$name\s*=\s*[^\s#]+" })) {
    throw "DIT .env must contain $name. Values are never logged."
  }
}
$node = (Get-Command node -ErrorAction Stop).Source
$major = [int]((& $node --version) -replace '^v(\d+).*$', '$1')
if ($major -lt 22) { throw "Node.js 22+ is required; found version $major" }

function Get-JarvisHealth {
  try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:$JarvisPort/health" -TimeoutSec 2
    return [bool]$h.ok
  } catch { return $false }
}
$startedJarvis = $false
if (-not (Get-JarvisHealth)) {
  $existing = Get-NetTCPConnection -LocalPort $JarvisPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existing) { throw "Port $JarvisPort has an unresponsive/other service; not starting a second JARVIS." }
  $python = Join-Path $JarvisRoot '.venv\Scripts\python.exe'
  if (-not (Test-Path -LiteralPath $python)) {
    throw "No healthy JARVIS on port $JarvisPort and no Python install at $python. Keep your existing JARVIS files; update/install them instead of creating another core."
  }
  Write-Host 'Starting the EXISTING JARVIS core, with automatic background agent jobs disabled for this session.'
  # Existing model/team APIs still handle intentional operator research on demand.
  $env:JARVIS_AGENTS_ENABLED = '0'
  $env:JARVIS_HOST = '127.0.0.1'
  $env:JARVIS_PORT = "$JarvisPort"
  $env:JARVIS_DATA_DIR = Join-Path $JarvisRoot 'data'
  $env:JARVIS_HISTORY_DIR = Join-Path $JarvisRoot 'history'
  Start-Process -FilePath $python -ArgumentList @('-m','jarvis') -WorkingDirectory $JarvisRoot | Out-Null
  $startedJarvis = $true
  for ($i=0; $i -lt 60 -and -not (Get-JarvisHealth); $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (Get-JarvisHealth)) { throw 'JARVIS did not become healthy; check its own local logs.' }
} else {
  Write-Host 'Reusing healthy JARVIS on port 8768 (no duplicate process started).'
}
# Refuse to call an outdated JARVIS API that lacks bounded "lite" mode.
$openapi = Invoke-RestMethod -Uri "http://127.0.0.1:$JarvisPort/openapi.json" -TimeoutSec 5
$modes = @($openapi.components.schemas.ChatRequest.properties.mode.enum)
if ('lite' -notin $modes -or -not $openapi.components.schemas.ChatRequest.properties.model) {
  throw 'JARVIS is running an older API without three-agent model routing. Update the existing reixdd/1 installation and restart JARVIS; do not launch a duplicate.'
}
try {
  $ollama = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3
  Write-Host ("Existing Ollama detected: {0} installed model entries; DIT does not start additional model servers." -f @($ollama.models).Count)
} catch {
  Write-Warning 'Ollama is not reachable at 127.0.0.1:11434. JARVIS will report unavailable models until it is started.'
}
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) { throw "DIT port $Port is in use (PID $($listener.OwningProcess)); not starting a duplicate DIT server." }

# Supabase is shared with the hosted site; cloud read-only sources already refresh there.
# One local operator, no duplicate DIT scheduler, and no independent DIT LLM runtime.
$env:PORT = "$Port"
$env:DIT_STORE = 'supabase'
$env:DIT_DEV_AUTH = '0'
$env:DIT_JARVIS_SHARED = '1'
$env:DIT_JARVIS_URL = "http://127.0.0.1:$JarvisPort"
$env:DIT_LLM_PROVIDER = 'off'
$env:DIT_START_SCHEDULER = '0'
# Three independently active DIT identities, two installed text models, no 14B/27B automatic use.
$env:DIT_JARVIS_PARALLEL = '3'
$env:DIT_AUTONOMOUS = '1'
$env:DIT_AUTONOMOUS_INTERVAL_MINUTES = '20'
$env:DIT_MIN_FREE_RAM_GB = '6'
$env:DIT_MAX_LOADED_VRAM_GB = '13'
$env:DIT_MODEL_GHOST = 'qwen3.5:4b'
$env:DIT_MODEL_NULL = 'qwen3.5:9b'
$env:DIT_MODEL_ECHO = 'qwen3.5:4b'
Write-Host ""
Write-Host 'DIT research console will open at http://127.0.0.1:4173/operator'
Write-Host 'GHOST, NULL, ECHO run independent 20-minute research cycles; up to 3 concurrent JARVIS-lite requests.'
Write-Host 'Models: GHOST 4B / NULL 9B / ECHO 4B; loaded-model GPU memory guard: 13 GB; free RAM floor: 6 GB.'
Write-Host 'Ollama service concurrency/settings must be configured on the daemon, not in this existing client.'
Write-Host 'No new scanning loop, token launches, transaction signing, or paid APIs.'
Write-Host 'Close this console (Ctrl+C) to stop only the DIT operator. JARVIS remains independent.'
Start-Process "http://127.0.0.1:$Port/operator" | Out-Null
& $node '--env-file=.env' 'server/local.mjs'
