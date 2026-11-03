<#
.SYNOPSIS
    Unregisters the GetTrainMate Windows BACKUP growth task.
#>
$ErrorActionPreference = "Stop"
$setup = Join-Path $PSScriptRoot "setup-windows-task.ps1"
& $setup -Action Unregister
