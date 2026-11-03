<#
.SYNOPSIS
    Setup Windows Scheduled Task - BACKUP for GetTrainMate Daily Growth

.DESCRIPTION
    Primary trigger is Cursor Automation "GetTrainMate Customer Growth"
    (daily 10:00 AM America/New_York).

    This Windows task is the local BACKUP (YouTubeBooster pattern): it runs later
    the same morning so a disabled / rate-limited / usage-capped Cursor Automation
    still produces owned-social + Admin email when this PC is on.

    Dedupes via local success log + S3 Admin-email day guard (safe alongside
    Cursor and GitHub Actions).

.PARAMETER Action
    Register (default), Unregister, Status, or RunNow.

.PARAMETER Time
    Backup start time HH:mm (default: "10:30" - after Cursor's 10:00).

.EXAMPLE
    .\scripts\growth\setup-windows-task.ps1 -Action Register
    .\scripts\growth\setup-windows-task.ps1 -Action Status
    .\scripts\growth\setup-windows-task.ps1 -Action RunNow
    .\scripts\growth\setup-windows-task.ps1 -Action Unregister
#>

[CmdletBinding()]
param(
    [ValidateSet("Register", "Unregister", "Status", "RunNow")]
    [string]$Action = "Register",

    [string]$Time = "10:30"
)

$TaskName = "GetTrainMate-GrowthDaily"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$RunnerPs1 = Join-Path $ScriptDir "run-growth-scheduled.ps1"

function Show-Status {
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existing) {
        $info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
        $resultHex = if ($null -ne $info.LastTaskResult) { ("0x{0:X8}" -f [uint32]$info.LastTaskResult) } else { "n/a" }
        Write-Host "Task Name:        $($existing.TaskName)" -ForegroundColor Green
        Write-Host "State:            $($existing.State)" -ForegroundColor Green
        Write-Host "Role:             BACKUP (Cursor Automation is primary at 10:00 ET)" -ForegroundColor Cyan
        Write-Host "Last Run Time:    $($info.LastRunTime)"
        Write-Host "Last Result:      $($info.LastTaskResult) ($resultHex)"
        Write-Host "Next Run Time:    $($info.NextRunTime)"
        Write-Host "Script:           $RunnerPs1"
        Write-Host "Log folder:       $(Join-Path $RepoRoot 'docs\growth\logs')"
    } else {
        Write-Host "Task '$TaskName' is NOT registered." -ForegroundColor Yellow
    }
}

switch ($Action) {
    "Status" {
        Show-Status
    }

    "RunNow" {
        $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if (-not $existing) {
            Write-Host "Task not registered yet. Running script directly..." -ForegroundColor Yellow
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RunnerPs1
        } else {
            Write-Host "Triggering scheduled task '$TaskName'..." -ForegroundColor Cyan
            Start-ScheduledTask -TaskName $TaskName
            Start-Sleep -Seconds 3
            Show-Status
        }
    }

    "Unregister" {
        $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($existing) {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
            Write-Host "Task '$TaskName' removed successfully." -ForegroundColor Green
        } else {
            Write-Host "Task '$TaskName' does not exist." -ForegroundColor Yellow
        }
    }

    "Register" {
        if (-not (Test-Path $RunnerPs1)) {
            throw "Runner script missing: $RunnerPs1"
        }

        $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($existing) {
            Write-Host "Task '$TaskName' already exists. Updating..." -ForegroundColor Yellow
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        }

        $parsedTime = [datetime]::ParseExact($Time, "HH:mm", [System.Globalization.CultureInfo]::InvariantCulture)
        # Daily - matches Cursor Automation (7 days/week).
        $trigger = New-ScheduledTaskTrigger -Daily -At $parsedTime

        $powershellExe = (Get-Command powershell.exe).Source
        $argumentList = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunnerPs1`""
        $taskAction = New-ScheduledTaskAction -Execute $powershellExe -Argument $argumentList -WorkingDirectory $RepoRoot

        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -StartWhenAvailable `
            -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
            -WakeToRun `
            -MultipleInstances IgnoreNew

        # Interactive: logged-on user session (reliable PATH / AWS creds) - same as YouTubeBooster backup.
        $principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive -RunLevel Limited

        Register-ScheduledTask -TaskName $TaskName `
            -Trigger $trigger `
            -Action $taskAction `
            -Settings $settings `
            -Principal $principal `
            -Description "BACKUP for Cursor Automation 'GetTrainMate Customer Growth'. Primary = Cursor 10:00 ET daily; this task = $Time ET daily (owned-social + Admin email)." | Out-Null

        Write-Host "Scheduled task '$TaskName' registered as BACKUP." -ForegroundColor Green
        Write-Host "Primary:  Cursor Automation daily 10:00 ET" -ForegroundColor Cyan
        Write-Host "Backup:   Windows task daily $Time ET (this PC must be on / logged in)" -ForegroundColor Cyan
        Write-Host "Catch-up: StartWhenAvailable if the PC was asleep at $Time." -ForegroundColor Cyan
        Write-Host "Dedupes:  S3 Admin-email day guard + local success log." -ForegroundColor Cyan
        Write-Host ""
        Show-Status
    }
}
