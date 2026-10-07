$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$appPath = Join-Path $projectRoot 'release\backend.exe'
$address = 'http://127.0.0.1:5000'

if (-not (Test-Path -LiteralPath $appPath)) {
    Write-Error 'Chưa có bản phát hành. Hãy chạy scripts\Build-Release.ps1 trước.'
}

try {
    Invoke-RestMethod -Uri "$address/api/health" -TimeoutSec 1 | Out-Null
}
catch {
    Start-Process -FilePath $appPath -ArgumentList '--urls', $address -WorkingDirectory (Join-Path $projectRoot 'release') -WindowStyle Hidden
}

for ($attempt = 0; $attempt -lt 40; $attempt++) {
    try {
        Invoke-RestMethod -Uri "$address/api/health" -TimeoutSec 1 | Out-Null
        Start-Process $address
        exit 0
    }
    catch { Start-Sleep -Milliseconds 250 }
}

Write-Error 'Ứng dụng không khởi động được. Hãy kiểm tra cổng 5000 và tệp dữ liệu.'
