$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

if (-not $env:HASA_API_KEY) {
  $secure = Read-Host "HASA API Key (화면에 표시되지 않음)" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $env:HASA_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

Write-Host "00AI Harness PC Agent를 시작합니다. 이 창을 닫으면 에이전트도 종료됩니다."
python agent.py --mode pc_agent
