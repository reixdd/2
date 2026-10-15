param([string]$JarvisRoot=(Join-Path $env:USERPROFILE 'JARVIS'))
$ErrorActionPreference='Stop'
$root=Join-Path $JarvisRoot 'src\jarvis'
$python=Join-Path $JarvisRoot '.venv\Scripts\python.exe'
if(-not (Test-Path -LiteralPath $root) -or -not (Test-Path -LiteralPath $python)){throw "Existing JARVIS installation not found. Stopping without creating another one: $JarvisRoot"}
$active=Get-NetTCPConnection -LocalPort 8768 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if($active){throw "JARVIS is still running (PID $($active.OwningProcess)). Stop its CMD window with Ctrl+C before updating source."}
$backup=Join-Path $JarvisRoot ('dit-source-backup-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Write-Host "Backup location: $backup"
$files=@('app.py','agent_team.py')
foreach($name in $files){
 $target=Join-Path $root $name
 if(Test-Path -LiteralPath $target){Copy-Item -LiteralPath $target -Destination (Join-Path $backup $name) -Force}
 $tmp=Join-Path $env:TEMP ('dit-'+[guid]::NewGuid().ToString('N')+'-'+$name)
 $url="https://raw.githubusercontent.com/reixdd/1/main/src/jarvis/$name"
 try{
  Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -TimeoutSec 30
  if((Get-Item $tmp).Length -lt 1000){throw "Downloaded file is unexpectedly small: $name"}
  Copy-Item -LiteralPath $tmp -Destination $target -Force
  Write-Host "Updated: $name"
 } finally {Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue}
}
$web=Join-Path $root 'web'
New-Item -ItemType Directory -Path $web -Force | Out-Null
foreach($name in @('index.html','app.js','styles.css')){
 $target=Join-Path $web $name
 if(-not (Test-Path -LiteralPath $target)){
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/reixdd/1/main/src/jarvis/web/$name" -OutFile $target -UseBasicParsing -TimeoutSec 30
  Write-Host "Restored missing workbench file: $name"
 }
}
Write-Host 'Checking Python syntax in existing virtual environment...'
& $python -m py_compile (Join-Path $root 'app.py') (Join-Path $root 'agent_team.py')
if($LASTEXITCODE -ne 0){throw "Syntax verification failed. Backups preserved at $backup"}
Write-Host ''
Write-Host 'JARVIS files updated. Existing virtualenv, data, history, GMGN code and Ollama models were preserved.'
Write-Host 'Now start START-DIT-WITH-JARVIS.cmd from the updated DIT folder.'
