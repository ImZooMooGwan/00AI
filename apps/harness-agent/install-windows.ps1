$ErrorActionPreference = "Stop"

$TaskName = "00AI Harness Agent"
$InstallDir = Join-Path $env:LOCALAPPDATA "00AI\HarnessAgent"
$KeyPath = Join-Path $InstallDir "hasa-key.dpapi"
$AgentPath = Join-Path $InstallDir "agent.py"
$RunnerPath = Join-Path $InstallDir "run-installed-agent.ps1"
$RawBase = "https://raw.githubusercontent.com/ImZooMooGwan/00AI/main/apps/harness-agent"

function Test-Python {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)"
    if ($LASTEXITCODE -eq 0) { return }
  }
  if (Get-Command python -ErrorAction SilentlyContinue) {
    & python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)"
    if ($LASTEXITCODE -eq 0) { return }
  }
  throw "Python 3.10 이상이 필요합니다. https://www.python.org/downloads/windows/ 에서 설치한 뒤 다시 실행하세요."
}

Write-Host "00AI Harness PC Agent 자동 설치를 시작합니다."
Test-Python
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

if (-not (Test-Path $KeyPath)) {
  $secureKey = Read-Host "HASA API Key (최초 1회, 화면에 표시되지 않음)" -AsSecureString
  if ($secureKey.Length -eq 0) { throw "HASA API Key가 비어 있습니다." }
  $secureKey | ConvertFrom-SecureString | Set-Content -Path $KeyPath -Encoding UTF8
  Write-Host "HASA 키를 현재 Windows 사용자용 DPAPI로 암호화해 저장했습니다."
} else {
  Write-Host "기존 암호화 HASA 키를 유지합니다."
}

Invoke-WebRequest -UseBasicParsing -Uri "$RawBase/agent.py" -OutFile $AgentPath
Invoke-WebRequest -UseBasicParsing -Uri "$RawBase/run-installed-agent.ps1" -OutFile $RunnerPath

$UserId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$TaskArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$RunnerPath`""
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $TaskArgs
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $UserId
$Principal = New-ScheduledTaskPrincipal -UserId $UserId -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description "00AI Harness local PC agent" -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName
$ready = $false
for ($attempt = 0; $attempt -lt 15; $attempt++) {
  Start-Sleep -Milliseconds 500
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:43120/health" -TimeoutSec 2
    if ($health.status -eq "healthy") { $ready = $true; break }
  } catch {}
}

if ($ready) {
  Write-Host "설치 완료: PC 에이전트가 실행 중입니다."
  Write-Host "https://harness.00ai.kr 에서 PC 에이전트를 선택하면 자동 연결됩니다."
} else {
  Write-Warning "설치는 완료됐지만 실행기 응답을 아직 확인하지 못했습니다. Windows 작업 스케줄러에서 '$TaskName' 상태를 확인하세요."
}

Read-Host "Enter를 누르면 창을 닫습니다"
