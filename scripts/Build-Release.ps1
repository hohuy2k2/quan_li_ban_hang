$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Không build được giao diện React.' }
    }
    finally { Pop-Location }

    $webRoot = Join-Path $projectRoot 'backend\wwwroot'
    New-Item -ItemType Directory -Force -Path $webRoot | Out-Null
    Copy-Item -Path (Join-Path $projectRoot 'frontend\dist\*') -Destination $webRoot -Recurse -Force

    Push-Location (Join-Path $projectRoot 'storefront')
    try {
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Không build được website khách hàng.' }
    }
    finally { Pop-Location }
    $storeRoot = Join-Path $webRoot 'store'
    New-Item -ItemType Directory -Force -Path $storeRoot | Out-Null
    Copy-Item -Path (Join-Path $projectRoot 'storefront\dist\*') -Destination $storeRoot -Recurse -Force

    dotnet publish (Join-Path $projectRoot 'backend\backend.csproj') -c Release -r win-x64 --self-contained true -o (Join-Path $projectRoot 'release')
    if ($LASTEXITCODE -ne 0) { throw 'Không đóng gói được backend.' }
    Write-Host 'Đã tạo bản chạy tại thư mục release.'
}
finally { Pop-Location }
