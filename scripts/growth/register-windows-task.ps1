# Register daily growth task for GetTrainMate (uses local AWS credentials).
# Run once: powershell -ExecutionPolicy Bypass -File scripts/growth/register-windows-task.ps1
$ErrorActionPreference = "Stop"
$setup = Join-Path $PSScriptRoot "setup-windows-task.ps1"
& $setup @args
