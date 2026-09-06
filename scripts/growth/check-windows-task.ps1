<#
.SYNOPSIS
    Checks the status of the GetTrainMate Daily Growth Windows Scheduled Task.
.DESCRIPTION
    Shows task status, next run time, last run result, and the last 20 log entries.
#>

[CmdletBinding()]
param()

$TaskName = "GetTrainMate-GrowthDaily"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$LogFile = Join-Path $RepoRoot "docs\growth\daily-task-runner.log"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Windows Scheduled Task Status: $TaskName" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan

try {
    $Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($null -eq $Task) {
        Write-Host "Task '$TaskName' is NOT currently registered in Windows Task Scheduler." -ForegroundColor Yellow
        Write-Host "To register it, run:" -ForegroundColor Gray
        Write-Host "  .\scripts\growth\setup-windows-task.ps1" -ForegroundColor Gray
    } else {
        $Info = Get-ScheduledTaskInfo -TaskName $TaskName
        Write-Host "Task Name:        $($Task.TaskName)"
        Write-Host "State:            $($Task.State)"
        Write-Host "Next Run Time:    $($Info.NextRunTime)"
        Write-Host "Last Run Time:    $($Info.LastRunTime)"
        Write-Host "Last Task Result: $($Info.LastTaskResult)"
        Write-Host "Number of Misses: $($Info.NumberOfMissedRuns)"
    }
} catch {
    Write-Warning "Could not inspect scheduled task: $($_.Exception.Message)"
}

Write-Host "`nRecent Runner Log Entries ($LogFile):" -ForegroundColor Cyan
if (Test-Path $LogFile) {
    Get-Content $LogFile -Tail 25
} else {
    Write-Host "Log file does not exist yet. Run .\scripts\growth\run-growth-scheduled.ps1 to generate logs." -ForegroundColor Gray
}
Write-Host "================================================================" -ForegroundColor Cyan
