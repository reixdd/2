# DEAD INTERNET THEORY / SAFE LOCAL RESEARCH TEST
# Reuses the existing JARVIS installation, existing treasury secret and isolated DIT file store.
# Does NOT connect to the hosted Supabase database, sign transactions or launch tokens.
param(
 [int]$Port=4173,
 [int]$JarvisPort=8768,
 [string]$JarvisRoot="$env:USERPROFILE\JARVIS"
)
$ErrorActionPreference='Stop'
$ditRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $ditRoot
$node=(Get-Command node.exe -ErrorAction Stop).Source
$version=[int]((& $node --version) -replace '^v(\d+).*$', '$1')
if($version -lt 22){ throw "Node 22 or newer required (found $version)." }
$jarvisUrl="http://127.0.0.1:$JarvisPort"
function JarvisHealthy {
 try { $status=Invoke-RestMethod -Uri "$jarvisUrl/health" -TimeoutSec 2; return $status.ok -eq $true }
 catch { return $false }
}
Write-Host "DIT LOCAL RESEARCH / safe, test-only startup" -ForegroundColor Cyan
if(-not (JarvisHealthy)){
 $listening=Get-NetTCPConnection -LocalPort $JarvisPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
 if($listening){ throw "Port $JarvisPort is occupied but JARVIS /health is not healthy. Do not start a second JARVIS; inspect PID $($listening.OwningProcess)." }
 $python=Join-Path $JarvisRoot '.venv\Scripts\python.exe'
 if(-not (Test-Path -LiteralPath $python)){ throw "Existing JARVIS Python missing: $python. No installation was modified." }
 $logs=Join-Path $ditRoot '.data'
 New-Item -ItemType Directory -Force -Path $logs | Out-Null
 $env:PYTHONPATH=(Join-Path $JarvisRoot 'src')+[IO.Path]::PathSeparator+$env:PYTHONPATH
 $env:JARVIS_HOST='127.0.0.1'
 $env:JARVIS_PORT="$JarvisPort"
 $env:JARVIS_AGENTS_ENABLED='0'
 $env:JARVIS_DATA_DIR=Join-Path $JarvisRoot 'data'
 $env:JARVIS_HISTORY_DIR=Join-Path $JarvisRoot 'history'
 $stdout=Join-Path $logs 'jarvis-local-stdout.log'
 $stderr=Join-Path $logs 'jarvis-local-stderr.log'
 Write-Host "Starting your EXISTING JARVIS at $JarvisRoot (no installs or duplicate schedulers)."
 $proc=Start-Process -FilePath $python -ArgumentList @('-m','jarvis') -WorkingDirectory $JarvisRoot -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
 for($i=0;$i -lt 60 -and -not (JarvisHealthy);$i++){
  if($proc.HasExited){ break }
  Start-Sleep -Milliseconds 500
 }
 if(-not (JarvisHealthy)){ throw "JARVIS failed health check. Check $stderr and $stdout. DIT was not started." }
}
Write-Host "JARVIS healthy on $jarvisUrl" -ForegroundColor Green
foreach($route in @('/api/operator/gmgn/trenches?chain=sol&limit=1','/api/operator/gmgn/trending?chain=sol&interval=5m&limit=1','/api/operator/radar?limit=1','/api/tape?limit=1')){
 try{
  $reply=Invoke-WebRequest -UseBasicParsing -Uri ($jarvisUrl+$route) -TimeoutSec 5
  Write-Host "JARVIS MARKET OK: $route ($($reply.StatusCode))"
 }catch{
  Write-Warning "JARVIS MARKET route unavailable: $route. DIT will identify this as unavailable, not manufacture feed data."
 }
}
$listener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if($listener){
 $other=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
 if($other.Name -ne 'node.exe' -or $other.CommandLine -notmatch 'server[\\/]+local\.mjs'){
  throw "Port $Port is owned by a different process (PID $($listener.OwningProcess)); nothing was stopped."
 }
 $decision=Read-Host "Old DIT test is using port $Port (PID $($listener.OwningProcess)). Stop that Node server and restart? (Y/N)"
 if($decision -notin @('y','Y','yes','YES')){ throw 'Existing DIT left running. Stop it manually when ready.' }
 Stop-Process -Id $listener.OwningProcess -ErrorAction Stop
 for($i=0;$i -lt 20;$i++){ if(-not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)){break}; Start-Sleep -Milliseconds 250 }
 if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw "Port $Port is still occupied. DIT was not started."}
}
# Ask for the SAME existing secret only when the current PowerShell session does not have it.
if(-not $env:DIT_SIMULATION_SECRET -or $env:DIT_SIMULATION_SECRET.Length -lt 32){
 $secure=Read-Host 'Enter your EXISTING DIT_SIMULATION_SECRET (hidden; not saved)' -AsSecureString
 $env:DIT_SIMULATION_SECRET=([System.Net.NetworkCredential]::new('', $secure)).Password
}
if($env:DIT_SIMULATION_SECRET.Length -lt 32){throw 'Existing secret must be 32+ characters. No new secret was generated.'}
# Force isolated file-backed research, never hosted Supabase.
$env:SUPABASE_URL=''
$env:NEXT_PUBLIC_SUPABASE_URL=''
$env:SUPABASE_SERVICE_ROLE_KEY=''
$env:PORT="$Port"
$env:DIT_STORE='file'
$env:DIT_STORE_FILE=Join-Path $ditRoot '.data\dit-local-test.json'
$env:DIT_DEV_AUTH='1'
$env:DIT_JARVIS_SHARED='1'
$env:DIT_JARVIS_URL=$jarvisUrl
$env:DIT_AUTONOMOUS='1'
$env:DIT_AUTONOMOUS_INTERVAL_MINUTES='20'
$env:DIT_START_SCHEDULER='0'
$env:DIT_LLM_PROVIDER='off'
$env:DIT_SIMULATION_ENABLED='1'
Write-Host "Starting DIT on http://127.0.0.1:$Port with local-only research and your EXISTING simulation secret." -ForegroundColor Green
Write-Host "Check http://127.0.0.1:$Port/api/observatory after 10 seconds for actual ONLINE status."
Write-Host 'Ctrl+C stops DIT. JARVIS remains running independently. No hosted database changes.'
& $node 'server/local.mjs'
