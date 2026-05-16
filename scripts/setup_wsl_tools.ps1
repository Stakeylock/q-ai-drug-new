param(
    [string]$Distro = ""
)

$ErrorActionPreference = "Stop"

function Quote-Bash {
    param([string]$Value)
    return "'" + ($Value -replace "'", "'\''") + "'"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$wslArgs = @()
if ($Distro) {
    $wslArgs += @("-d", $Distro)
}

& wsl.exe @wslArgs bash -lc "true" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "WSL is not available. Install Ubuntu for WSL first, then rerun this target."
}

$wslRepo = (& wsl.exe @wslArgs wslpath -a $repoRoot).Trim()
if ($LASTEXITCODE -ne 0 -or -not $wslRepo) {
    throw "Could not translate repository path to WSL path."
}

$command = "cd $(Quote-Bash $wslRepo) && bash scripts/setup_wsl_tools.sh"
& wsl.exe @wslArgs bash -lc $command
if ($LASTEXITCODE -ne 0) {
    throw "WSL tool setup failed. If sudo is required in non-interactive mode, set WSL_SUDO_PASSWORD for this shell session and rerun."
}
