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

function Test-AlreadyRanToday {
  if (-not (Test-Path $mainLog)) { return $false }
  $today = Get-Date -Format "yyyy-MM-dd"
  $recent = Get-Content $mainLog -Tail 80 -ErrorAction SilentlyContinue
  if ($null -eq $recent) { return $false }
  foreach ($line in $recent) {
    if ($line -match "^$today .* scheduled run (OK|FAILED)") {
      return $true
    }
  }
  return $false
}

if (Test-AlreadyRanToday) {
  Log "Skipping duplicate Windows trigger — today's scheduled run already logged in daily-task-runner.log"
  exit 0
}

Log "=== GetTrainMate scheduled run start ==="
try {
  # 1. Pull latest changes if remote main updated
  try {
    Log "Syncing with origin/main..."
    Invoke-LoggedCommand -Label "git fetch" -FilePath "git" -ArgumentList @("fetch", "origin", "main") | Out-Null
    $rebaseCode = Invoke-LoggedCommand -Label "git pull" -FilePath "git" -ArgumentList @("pull", "--rebase", "origin", "main")
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

  # 3. Commit & push updated artifacts to GitHub
  if (-not $DryRun -and -not $SkipPush) {
    Invoke-LoggedCommand -Label "git add" -FilePath "git" -ArgumentList @("add", "docs/growth") | Out-Null

    $diffCode = Invoke-LoggedCommand -Label "git diff" -FilePath "git" -ArgumentList @("diff", "--staged", "--quiet")
    if ($diffCode -ne 0) {
      Invoke-LoggedCommand -Label "git commit" -FilePath "git" -ArgumentList @(
        "-c", "core.safecrlf=false", "commit", "-m", "chore(growth): daily publish snapshot [windows-task]"
      ) | Out-Null
      $pushCode = Invoke-LoggedCommand -Label "git push" -FilePath "git" -ArgumentList @("push", "origin", "main")
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
