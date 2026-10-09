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
        $health = Invoke-RestMethod -Uri "$address/api/health" -TimeoutSec 1
    }
    catch {
        Start-Sleep -Milliseconds 250
        continue
    }

    if ($health.apiVersion -ne 2) {
        Write-Error 'Cổng 5000 đang chạy backend cũ hoặc bản release chưa được đóng gói lại. Hãy dừng backend cũ và chạy scripts\Build-Release.ps1.'
    }

    try { $auth = Invoke-RestMethod -Uri "$address/api/auth/csrf" -TimeoutSec 2 }
    catch { Write-Error 'Cổng 5000 đang chạy backend cũ hoặc sai phiên bản. Hãy dừng tiến trình đó rồi mở lại ứng dụng.' }
    if (-not $auth.token) {
        Write-Error 'Backend ở cổng 5000 chưa có chức năng đăng nhập. Hãy dừng bản cũ rồi chạy bản mới.'
    }
    Start-Process $address
    exit 0
}

Write-Error 'Ứng dụng không khởi động được. Hãy kiểm tra cổng 5000 và tệp dữ liệu.'
