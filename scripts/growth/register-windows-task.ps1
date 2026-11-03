# Register GetTrainMate Windows BACKUP growth task (YouTubeBooster pattern).
# Run: powershell -ExecutionPolicy Bypass -File scripts/growth/register-windows-task.ps1
$ErrorActionPreference = "Stop"
$setup = Join-Path $PSScriptRoot "setup-windows-task.ps1"
& $setup -Action Register @args
