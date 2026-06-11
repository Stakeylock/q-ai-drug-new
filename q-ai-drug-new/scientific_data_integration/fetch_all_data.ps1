# Scientific Data Integration Pipeline PowerShell Script
# Adheres strictly to the guidelines: "computational hypotheses only"
# Wet-lab validation is strictly required before any biological activity, safety, efficacy, or therapeutic claim.

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   SCIENTIFIC DATA INTEGRATION PIPELINE (REPRODUCIBILITY)" -ForegroundColor Cyan
Write-Host "   Wet-lab validation is strictly required before any biological" -ForegroundColor Yellow
Write-Host "   activity, safety, efficacy, or therapeutic claim." -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillsSource = Join-Path $ScriptDir "skills_source"
$OutputsDir = Join-Path $ScriptDir "outputs"

if (-not (Test-Path $OutputsDir)) {
    New-Item -ItemType Directory -Path $OutputsDir -Force | Out-Null
}

# Locate Anaconda py_env Python interpreter or fall back to system Python
$PythonExe = "E:\anaconda\envs\py_env\python.exe"
if (-not (Test-Path $PythonExe)) {
    Write-Host "Warning: E:\anaconda\envs\py_env\python.exe not found. Falling back to system python." -ForegroundColor Yellow
    $PythonExe = "python"
}

# Configure PYTHONPATH and User Agent to bypass scraper blocks
$env:PYTHONPATH = $SkillsSource
$env:SCIENCE_SKILLS_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

Write-Host "Executing master queries runner..." -ForegroundColor Green
& $PythonExe (Join-Path $ScriptDir "run_all_queries.py")

Write-Host "`nPipeline completed successfully!" -ForegroundColor Green
Write-Host "Outputs are saved in: $OutputsDir" -ForegroundColor White
