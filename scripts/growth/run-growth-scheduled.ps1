<#
.SYNOPSIS
    GetTrainMate daily growth runner for Windows Task Scheduler (local AWS credentials).
.DESCRIPTION
    Runs the automated growth sequence as a local Windows scheduled task:
    1. Syncs latest git changes (git pull --rebase origin main)
    2. Runs scripts/growth/run-weekday-growth.mjs (lock, Meta social publish, snapshot, SES email)
    3. Commits and pushes updated growth artifacts to GitHub
    4. Logs all execution details to docs/growth/logs/

.PARAMETER DryRun
    Runs checks and draft generation without live social publish, email send, or git push.
.PARAMETER SkipSocial
    Runs snapshot and email only, skipping owned-social publishing.
.PARAMETER SkipPush
    Runs growth tasks but skips git commit and push.
.PARAMETER ContentId
    Optional specific catalog content ID to publish.
.PARAMETER Notes
    Optional notes to attach to the growth report.
#>

[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$SkipSocial,
  [switch]$SkipPush,
  [string]$ContentId = "",
  [string]$Notes = ""
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $root

$logDir = Join-Path $root "docs\growth\logs"
if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
}
$date = Get-Date -Format "yyyy-MM-dd"
$log = Join-Path $logDir "$date-scheduled.log"
$mainLog = Join-Path $root "docs\growth\daily-task-runner.log"

function Log($msg, $level = "INFO") {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$level] $msg"
  Add-Content -Path $log -Value $line -Encoding utf8
  Add-Content -Path $mainLog -Value $line -Encoding utf8
  Write-Host $line
}

function Run-Git([string[]]$GitArgs) {
  $outLog = Join-Path $logDir "temp-git-out.log"
  $errLog = Join-Path $logDir "temp-git-err.log"
  # Quote arguments that contain spaces for Start-Process
  $escapedArgs = $GitArgs | ForEach-Object {
    if ($_ -match '\s' -and -not ($_ -match '^".*"$')) {
      "`"$_`""
    } else {
      $_
    }
  }
  $proc = Start-Process -FilePath "git" -ArgumentList ($escapedArgs -join " ") -WorkingDirectory $root -NoNewWindow -Wait -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
  if (Test-Path $outLog) {
    Get-Content $outLog | ForEach-Object { Log $_ }
    Remove-Item $outLog -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $errLog) {
    Get-Content $errLog | ForEach-Object { Log $_ "WARN" }
    Remove-Item $errLog -Force -ErrorAction SilentlyContinue
  }
  return $proc.ExitCode
}

Log "=== GetTrainMate scheduled run start ==="
try {
  # 1. Pull latest changes if remote main updated
  try {
    Log "Syncing with origin/main..."
    Run-Git @("fetch", "origin", "main") | Out-Null
    $rebaseCode = Run-Git @("pull", "--rebase", "origin", "main")
    if ($rebaseCode -ne 0) {
      Log "Git pull returned $rebaseCode; continuing with local working copy..." "WARN"
    }
  } catch {
    Log "Git pull failed or skipped: $_" "WARN"
  }

  # 2. Prepare node runner args
  $runnerScript = Join-Path $root "scripts\growth\run-weekday-growth.mjs"
  $runnerArgs = @($runnerScript)
  if ($DryRun) {
    $runnerArgs += "--dry-run"
  }
  if ($SkipSocial) {
    $runnerArgs += "--skip-social"
  }
  if ($ContentId) {
    $runnerArgs += "--content-id"
    $runnerArgs += $ContentId
  }
  if ($Notes) {
    $runnerArgs += "--notes"
    $runnerArgs += $Notes
  }

  Log "Executing: node $($runnerArgs -join ' ')"
  $outLog = Join-Path $logDir "temp-node-out.log"
  $errLog = Join-Path $logDir "temp-node-err.log"
  $proc = Start-Process -FilePath "node" -ArgumentList $runnerArgs -WorkingDirectory $root -NoNewWindow -Wait -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog

  if (Test-Path $outLog) {
    Get-Content $outLog | ForEach-Object { Log $_ }
    Remove-Item $outLog -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $errLog) {
    Get-Content $errLog | ForEach-Object { Log $_ "WARN" }
    Remove-Item $errLog -Force -ErrorAction SilentlyContinue
  }

  if ($proc.ExitCode -ne 0) {
    throw "run-weekday-growth.mjs exited with code $($proc.ExitCode)"
  }

  # 3. Commit & push updated artifacts to GitHub
  if (-not $DryRun -and -not $SkipPush) {
    Run-Git @("add", "docs/growth") | Out-Null

    $diffOut = Join-Path $logDir "temp-diff-out.log"
    $diffErr = Join-Path $logDir "temp-diff-err.log"
    $diffProc = Start-Process -FilePath "git" -ArgumentList @("diff", "--staged", "--quiet") -WorkingDirectory $root -NoNewWindow -Wait -PassThru -RedirectStandardOutput $diffOut -RedirectStandardError $diffErr
    Remove-Item $diffOut -Force -ErrorAction SilentlyContinue
    Remove-Item $diffErr -Force -ErrorAction SilentlyContinue

    if ($diffProc.ExitCode -ne 0) {
      Run-Git @("-c", "core.safecrlf=false", "commit", "-m", "chore(growth): daily publish snapshot [windows-task]") | Out-Null
      $pushCode = Run-Git @("push", "origin", "main")
      if ($pushCode -eq 0) {
        Log "Committed and pushed growth artifacts to origin/main"
      } else {
        Log "Warning: git push returned exit code $pushCode" "WARN"
      }
    } else {
      Log "No artifact changes to commit"
    }
  }

  Log "=== GetTrainMate scheduled run OK ==="
  exit 0
} catch {
  Log "=== GetTrainMate scheduled run FAILED: $_ ===" "ERROR"
  exit 1
}
