$ErrorActionPreference = "Stop"

$TaskName = "00AI Harness Agent"
$InstallDir = Join-Path $env:LOCALAPPDATA "00AI\HarnessAgent"
$AgentPath = Join-Path $InstallDir "agent.py"

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -and $_.CommandLine.Contains($AgentPath)
} | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

$ExpectedDir = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "00AI\HarnessAgent"))
if ((Test-Path $ExpectedDir) -and ([IO.Path]::GetFullPath($InstallDir) -eq $ExpectedDir)) {
  Remove-Item -LiteralPath $ExpectedDir -Recurse -Force
}

Write-Host "00AI Harness PC Agent와 암호화 키를 제거했습니다."
