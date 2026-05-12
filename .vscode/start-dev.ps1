$port = 3000
$projectRoot = Split-Path $PSScriptRoot -Parent

if (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue) {
    Start-Process "chrome" "http://localhost:$port"
    exit 0
}

Start-Process -FilePath "cmd" `
    -ArgumentList "/c npm run dev" `
    -WindowStyle Hidden `
    -WorkingDirectory $projectRoot

$maxWait = 60
$elapsed = 0
$ready = $false

while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds 1
    $elapsed++
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$port" `
            -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -lt 500) { $ready = $true; break }
    } catch { }
}

if ($ready) {
    Start-Process "chrome" "http://localhost:$port"
}
