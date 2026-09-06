# Unregister daily growth task for GetTrainMate when Cursor renewal is active.
# Run: powershell -ExecutionPolicy Bypass -File scripts/growth/unregister-windows-task.ps1
$ErrorActionPreference = "Stop"
$remove = Join-Path $PSScriptRoot "remove-windows-task.ps1"
& $remove @args
