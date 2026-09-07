<#
.SYNOPSIS
    Removes legacy Windows growth tasks for other apps (HybridRaceWorkouts, Cooking, etc.).
.DESCRIPTION
    Keeps GetTrainMate-GrowthDaily. Unregisters older per-app growth tasks that still fire
    failure emails when their copied runner scripts crash before Node starts.

.EXAMPLE
    .\scripts\growth\remove-legacy-windows-growth-tasks.ps1
    .\scripts\growth\remove-legacy-windows-growth-tasks.ps1 -WhatIf
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param()

$KeepTaskName = "GetTrainMate-GrowthDaily"
$LegacyNamePatterns = @(
  "*HybridRaceWorkouts*Growth*",
  "*Hybrid*Race*Growth*",
  "*Cooking*Growth*",
  "*Max Kantor Cooking*"
)

Write-Host "Legacy Windows growth task cleanup" -ForegroundColor Cyan
Write-Host "Keeping: $KeepTaskName" -ForegroundColor Green

$tasks = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object {
  $name = $_.TaskName
  if ($name -eq $KeepTaskName) { return $false }
  foreach ($pattern in $LegacyNamePatterns) {
    if ($name -like $pattern) { return $true }
  }
  return $false
}

if (-not $tasks -or $tasks.Count -eq 0) {
  Write-Host "No legacy growth tasks matched. Current growth-related tasks:" -ForegroundColor Yellow
  Get-ScheduledTask -ErrorAction SilentlyContinue |
    Where-Object { $_.TaskName -match "Growth|HybridRace|Cooking" } |
    ForEach-Object { Write-Host "  - $($_.TaskName)" -ForegroundColor Gray }
  exit 0
}

foreach ($task in $tasks) {
  $name = $task.TaskName
  if ($PSCmdlet.ShouldProcess($name, "Unregister scheduled task")) {
    try {
      Unregister-ScheduledTask -TaskName $name -Confirm:$false
      Write-Host "Removed: $name" -ForegroundColor Green
    } catch {
      Write-Warning "Failed to remove '$name': $($_.Exception.Message)"
      & schtasks.exe /Delete /TN $name /F 2>$null
    }
  }
}

Write-Host "Done. Re-run GetTrainMate only via:" -ForegroundColor Cyan
Write-Host "  Start-ScheduledTask -TaskName `"$KeepTaskName`"" -ForegroundColor Gray
