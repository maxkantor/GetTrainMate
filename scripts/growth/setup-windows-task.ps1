<#
.SYNOPSIS
    Registers the GetTrainMate Daily Growth task in Windows Task Scheduler.
.DESCRIPTION
    Creates a scheduled task that executes .\scripts\growth\run-growth-scheduled.ps1
    daily at 10:00 AM (with a 10:30 AM backup retry).
    Features:
    - Runs automatically 7 days a week including weekends.
    - StartWhenAvailable enabled: if PC is asleep or off at 10:00 AM, it runs
      immediately when the machine wakes up or boots.
    - WakeToRun enabled: wakes computer to run if supported by system power policy.
    - Runs in the background (WindowStyle Hidden).
    - Logs all output to docs/growth/daily-task-runner.log and docs/growth/logs/.
    - Dedupes safely via S3 day guard (only one email/publish per calendar day).

.PARAMETER Time
    Primary time of day to run (default: "10:00AM"). Format: "HH:mm" or "hh:mmtt".
.PARAMETER BackupTime
    Secondary backup time of day to run (default: "10:30AM").

.EXAMPLE
    .\scripts\growth\setup-windows-task.ps1
#>

[CmdletBinding()]
param(
    [string]$Time = "10:00AM",
    [string]$BackupTime = "10:30AM"
)

$ErrorActionPreference = "Stop"

$TaskName = "GetTrainMate-GrowthDaily"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$RunnerScript = Join-Path $ScriptDir "run-growth-scheduled.ps1"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Registering Windows Scheduled Task: $TaskName" -ForegroundColor Green
Write-Host "Repository Root: $RepoRoot" -ForegroundColor Gray
Write-Host "Target Script:   $RunnerScript" -ForegroundColor Gray
Write-Host "Primary Time:    $Time Daily" -ForegroundColor Gray
Write-Host "Backup Time:     $BackupTime Daily" -ForegroundColor Gray
Write-Host "================================================================" -ForegroundColor Cyan

# Verify script exists
if (-not (Test-Path $RunnerScript)) {
    Write-Error "Runner script not found at $RunnerScript"
    exit 1
}

# Create Scheduled Task Action
$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunnerScript`"" `
    -WorkingDirectory $RepoRoot

# Create Scheduled Task Triggers (Daily at Primary & Backup times)
$Trigger1 = New-ScheduledTaskTrigger -Daily -At $Time
$Triggers = @($Trigger1)
if ($BackupTime -and $BackupTime -ne $Time) {
    $Trigger2 = New-ScheduledTaskTrigger -Daily -At $BackupTime
    $Triggers += $Trigger2
}

# Configure Settings:
# - StartWhenAvailable: Run as soon as possible if scheduled start was missed (e.g. computer was asleep/off)
# - AllowStartIfOnBatteries & DontStopIfGoingOnBatteries: Run on laptops even when unplugged
# - WakeToRun: Wake computer from sleep to run if supported
$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -WakeToRun `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

try {
    # Register the task for current user
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Triggers `
        -Settings $Settings `
        -Description "GetTrainMate Daily Paid Customer Growth automation runner (runs daily at $Time with $BackupTime backup)." `
        -Force | Out-Null

    Write-Host "`nTask '$TaskName' registered successfully!" -ForegroundColor Green

    # Verify task details
    $Registered = Get-ScheduledTask -TaskName $TaskName
    $Info = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "Task State:     $($Registered.State)" -ForegroundColor Green
    Write-Host "Next Run Time:  $($Info.NextRunTime)" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "To test the task manually right now:" -ForegroundColor Yellow
    Write-Host "  Start-ScheduledTask -TaskName `"$TaskName`"" -ForegroundColor Gray
    Write-Host "To check logs:" -ForegroundColor Yellow
    Write-Host "  .\scripts\growth\check-windows-task.ps1" -ForegroundColor Gray
    Write-Host "To remove the task when Cursor renewals resume:" -ForegroundColor Yellow
    Write-Host "  .\scripts\growth\remove-windows-task.ps1" -ForegroundColor Gray
    Write-Host "================================================================" -ForegroundColor Cyan
} catch {
    Write-Error "Failed to register scheduled task: $($_.Exception.Message)"
    exit 1
}
