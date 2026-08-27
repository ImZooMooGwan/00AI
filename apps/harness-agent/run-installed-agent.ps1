$ErrorActionPreference = "Stop"

$InstallDir = Join-Path $env:LOCALAPPDATA "00AI\HarnessAgent"
$KeyPath = Join-Path $InstallDir "hasa-key.dpapi"
$AgentPath = Join-Path $InstallDir "agent.py"

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:43120/health" -TimeoutSec 1
  if ($health.status -eq "healthy") { exit 0 }
} catch {}

if (-not (Test-Path $KeyPath)) { throw "암호화 HASA 키가 없습니다. install-windows.ps1을 다시 실행하세요." }
if (-not (Test-Path $AgentPath)) { throw "agent.py가 없습니다. install-windows.ps1을 다시 실행하세요." }

$secureKey = Get-Content -Path $KeyPath -Raw | ConvertTo-SecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:HASA_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  Set-Location $InstallDir
  if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 $AgentPath --mode pc_agent
  } elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python $AgentPath --mode pc_agent
  } else {
    throw "Python을 찾을 수 없습니다."
  }
} finally {
  $env:HASA_API_KEY = $null
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
