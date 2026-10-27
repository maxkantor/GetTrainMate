<#
.SYNOPSIS
    GetTrainMate daily growth runner for Windows Task Scheduler (local AWS credentials).
.DESCRIPTION
    Runs the automated growth sequence as a local Windows scheduled task:
    1. Syncs latest git changes (git pull --rebase origin main)
    2. Runs scripts/growth/run-weekday-growth.mjs (lock, Meta social publish, snapshot, SES email)
    3. Keeps growth artifacts local (published-log, snapshots) — does NOT push to GitHub by default
    4. Logs all execution details to docs/growth/logs/

    Daily push of docs/growth was removed: it triggered a full Amplify web redeploy for
    log-only changes (wasted build minutes / storage). Pass -PushArtifacts only when you
    intentionally want that commit on origin/main.

.PARAMETER DryRun
    Runs checks and draft generation without live social publish, email send, or git push.
.PARAMETER SkipSocial
    Runs snapshot and email only, skipping owned-social publishing.
.PARAMETER SkipPush
    Deprecated alias — push is already off by default. Kept so older task args still work.
.PARAMETER PushArtifacts
    Opt-in: git add/commit/push docs/growth (triggers Amplify). Off for the daily scheduled task.
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
  [switch]$PushArtifacts,
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

function Invoke-LoggedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$ArgumentList = @()
  )

  Log "Executing: $Label $($ArgumentList -join ' ')"
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $FilePath @ArgumentList 2>&1
    $exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }
    foreach ($line in @($output)) {
      if ($null -eq $line) { continue }
      if ($line -is [System.Management.Automation.ErrorRecord]) {
        Log $line.ToString() "WARN"
      } else {
        Log ([string]$line)
      }
    }
    return $exitCode
  } finally {
    $ErrorActionPreference = $prevEap
  }
}

function Test-AlreadySucceededToday {
  # 10:30 backup must not rerun after a 10:00 success (email + Facebook/Instagram).
  # A FAILED morning run does not match, so the backup can still retry.
  if ($DryRun) { return $false }
  $today = Get-Date -Format "yyyy-MM-dd"
  $dayLog = Join-Path $logDir "$today-scheduled.log"
  $lines = @()
  if (Test-Path $dayLog) {
    $lines = @(Get-Content $dayLog -ErrorAction SilentlyContinue)
  } elseif (Test-Path $mainLog) {
    $lines = @(Get-Content $mainLog -Tail 500 -ErrorAction SilentlyContinue | Where-Object { $_ -like "$today*" })
  }
  if ($lines.Count -eq 0) { return $false }

  $ok = $false
  $email = $false
  $social = $false
  foreach ($line in $lines) {
    if ($line -notlike "$today*") { continue }
    # Success lines are "=== GetTrainMate scheduled run OK ===" — do not anchor on end-of-line.
    if ($line -match "scheduled run OK" -and $line -notmatch "dry-run") { $ok = $true }
    if ($line -match "DAILY REPORT EMAIL SENT") { $email = $true }
    if ($line -match "EMAIL SKIPPED \(already sent today\)") { $email = $true }
    if ($line -match '"published": true') { $social = $true }
    if ($line -match '"socialSkippedDuplicate": true') { $social = $true }
  }
  return ($ok -and $email -and $social)
}

if (Test-AlreadySucceededToday) {
  Log "Skipping 30-minute backup: today's run already sent the admin email and published owned social."
  exit 0
}

# Cross-runner guard: Cursor cloud / GitHub may have already claimed today's Admin email in S3.
function Test-AdminEmailAlreadySentInS3 {
  try {
    $iso = Get-Date -Format "yyyy-MM-dd"
    $probe = & node -e @"
import { readAdminEmailDayMarker } from './scripts/growth/lib/admin-email-day-guard.mjs';
const r = readAdminEmailDayMarker({ isoDate: '$iso' });
const m = r?.marker;
const sent = m && (m.status === 'sent' || Boolean(m.messageId));
process.stdout.write(sent ? 'SENT' : 'OPEN');
"@
    return ($probe -eq 'SENT')
  } catch {
    return $false
  }
}

if (-not $DryRun -and (Test-AdminEmailAlreadySentInS3)) {
  Log "Skipping Windows scheduled run: Admin email already sent today (S3 day guard — another runner finished first)."
  exit 0
}

Log "=== GetTrainMate scheduled run start ==="
try {
  # 1. Pull latest changes if remote main updated
  try {
    Log "Syncing with origin/main..."
    Invoke-LoggedCommand -Label "git" -FilePath "git" -ArgumentList @("fetch", "origin", "main") | Out-Null
    $rebaseCode = Invoke-LoggedCommand -Label "git" -FilePath "git" -ArgumentList @("pull", "--rebase", "origin", "main")
    if ($rebaseCode -ne 0) {
      Log "Git pull returned $rebaseCode; continuing with local working copy..." "WARN"
    }
  } catch {
    Log "Git pull failed or skipped: $_" "WARN"
  }

  # 2. Run node growth runner
  $runnerScript = Join-Path $root "scripts\growth\run-weekday-growth.mjs"
  $runnerArgs = @($runnerScript)
  if ($DryRun) { $runnerArgs += "--dry-run" }
  if ($SkipSocial) { $runnerArgs += "--skip-social" }
  if ($ContentId) {
    $runnerArgs += "--content-id"
    $runnerArgs += $ContentId
  }
  if ($Notes) {
    $runnerArgs += "--notes"
    $runnerArgs += $Notes
  }

  $nodeCode = Invoke-LoggedCommand -Label "node" -FilePath "node" -ArgumentList $runnerArgs
  if ($nodeCode -ne 0) {
    throw "run-weekday-growth.mjs exited with code $nodeCode"
  }

  # 3. Artifacts stay local unless explicitly opted in (avoids daily Amplify redeploys).
  if ($DryRun) {
    Log "Skipping git push (dry-run)"
  } elseif ($SkipPush -or -not $PushArtifacts) {
    Log "Keeping growth artifacts local (no git push — avoids Amplify rebuild on published-log only)"
  } else {
    Invoke-LoggedCommand -Label "git" -FilePath "git" -ArgumentList @("add", "docs/growth") | Out-Null

    $diffCode = Invoke-LoggedCommand -Label "git" -FilePath "git" -ArgumentList @("diff", "--staged", "--quiet")
    if ($diffCode -ne 0) {
      Invoke-LoggedCommand -Label "git" -FilePath "git" -ArgumentList @(
        "-c", "core.safecrlf=false", "commit", "-m", "chore(growth): daily publish snapshot [windows-task]"
      ) | Out-Null
      $pushCode = Invoke-LoggedCommand -Label "git" -FilePath "git" -ArgumentList @("push", "origin", "main")
      if ($pushCode -eq 0) {
        Log "Committed and pushed growth artifacts to origin/main"
      } else {
        Log "Warning: git push returned exit code $pushCode" "WARN"
      }
    } else {
      Log "No artifact changes to commit"
    }
  }

  if ($DryRun) {
    Log "=== GetTrainMate scheduled run OK (dry-run) ==="
  } else {
    Log "=== GetTrainMate scheduled run OK ==="
  }
  exit 0
} catch {
  Log "=== GetTrainMate scheduled run FAILED: $_ ===" "ERROR"
  exit 1
}
