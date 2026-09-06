<#
.SYNOPSIS
    Removes the GetTrainMate Daily Growth task from Windows Task Scheduler.
.DESCRIPTION
    Unregisters the task once Cursor Automations are restored or when no longer needed.
#>

[CmdletBinding()]
param()

$TaskName = "GetTrainMate-GrowthDaily"

Write-Host "Unregistering scheduled task '$TaskName'..." -ForegroundColor Cyan

try {
    $Existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($null -ne $Existing) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Task '$TaskName' has been successfully removed." -ForegroundColor Green
    } else {
        Write-Host "Task '$TaskName' was not found in Task Scheduler." -ForegroundColor Yellow
    }
} catch {
    Write-Warning "PowerShell Unregister-ScheduledTask error: $($_.Exception.Message)"
    Write-Host "Attempting schtasks.exe fallback..." -ForegroundColor Yellow
    & schtasks.exe /Delete /TN $TaskName /F
}
