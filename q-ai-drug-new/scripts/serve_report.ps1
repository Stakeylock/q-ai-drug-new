param(
    [string]$ProjectDir = "outputs/cancer_proof_v1",
    [int]$Port = 8010,
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

$resolvedProject = (Resolve-Path $ProjectDir).Path
$reportPath = Join-Path $resolvedProject "report.html"
if (-not (Test-Path $reportPath)) {
    throw "Report not found at $reportPath. Run the research_all target first."
}

while (Test-LocalPort -PortToCheck $Port) {
    $Port += 1
}

$log = Join-Path $resolvedProject "report_server.log"
$serverCommand = @"
Set-Location -LiteralPath '$($resolvedProject.Replace("'", "''"))'
python -m http.server $Port --bind 127.0.0.1 *> '$($log.Replace("'", "''"))'
"@
$encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($serverCommand))
$process = Start-Process -FilePath "powershell" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-EncodedCommand", $encodedCommand) `
    -WindowStyle Hidden `
    -PassThru

Start-Sleep -Milliseconds 800
$url = "http://127.0.0.1:$Port/report.html"
$manifest = [ordered]@{
    url = $url
    pid = $process.Id
    project_dir = $resolvedProject
    started_at = (Get-Date).ToString("s")
    log = $log
}
$manifest | ConvertTo-Json | Set-Content -Path (Join-Path $resolvedProject "report_server.json") -Encoding UTF8

if (-not $NoOpen) {
    Start-Process $url
}

Write-Host "Research report server: $url (PID $($process.Id))"
