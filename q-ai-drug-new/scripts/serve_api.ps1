param(
    [int]$Port = 8000,
    [string]$OpenPath = "/docs",
    [switch]$NoOpen
)

$ErrorActionPreference = "Stop"

function Test-LocalPort {
    param([int]$PortToCheck)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect("127.0.0.1", $PortToCheck, $null, $null)
        $connected = $async.AsyncWaitHandle.WaitOne(250, $false)
        if ($connected) {
            $client.EndConnect($async)
        }
        $client.Close()
        return $connected
    } catch {
        return $false
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
while (Test-LocalPort -PortToCheck $Port) {
    $Port += 1
}

$outDir = Join-Path $repoRoot "outputs"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$log = Join-Path $outDir "api_server.stdout.log"
$errLog = Join-Path $outDir "api_server.stderr.log"
$process = Start-Process -FilePath "python" `
    -ArgumentList @("-m", "uvicorn", "q_ai_drug.service.main:app", "--host", "127.0.0.1", "--port", "$Port") `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $log `
    -RedirectStandardError $errLog `
    -PassThru

Start-Sleep -Milliseconds 1200
$url = "http://127.0.0.1:$Port$OpenPath"
$manifest = [ordered]@{
    url = $url
    pid = $process.Id
    repo_root = $repoRoot
    started_at = (Get-Date).ToString("s")
    log = $log
    error_log = $errLog
}
$manifest | ConvertTo-Json | Set-Content -Path (Join-Path $outDir "api_server.json") -Encoding UTF8

if (-not $NoOpen) {
    Start-Process $url
}

Write-Host "Research API server: $url (PID $($process.Id))"
