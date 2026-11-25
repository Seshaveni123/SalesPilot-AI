[CmdletBinding()]
param(
    [switch]$OpenBrowser,
    [switch]$RestartBackend
)

# If your machine blocks script files under its PowerShell execution policy, launch this
# script once with: powershell -ExecutionPolicy Bypass -File .\Start-SalesPilot.ps1

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDirectory = Join-Path $ProjectRoot 'backend'
$FrontendDirectory = Join-Path $ProjectRoot 'frontend'
$Python = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
$Npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$BackendUrl = 'http://127.0.0.1:8000'
$FrontendUrl = 'http://localhost:5173'
$LogDirectory = Join-Path $ProjectRoot 'logs'

if (-not (Test-Path -LiteralPath $Python)) {
    throw "Python virtual environment was not found at $Python. Create it and install backend/requirements.txt first."
}
if (-not (Test-Path -LiteralPath (Join-Path $FrontendDirectory 'node_modules'))) {
    throw "Frontend dependencies are missing. Run 'npm.cmd install' from $FrontendDirectory first."
}

# Make the selected virtual environment available to any child processes as well.
$env:VIRTUAL_ENV = Join-Path $ProjectRoot '.venv'
$env:Path = "$(Join-Path $env:VIRTUAL_ENV 'Scripts');$env:Path"
New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null

function Test-SalesPilotBackend {
    try {
        $response = Invoke-WebRequest -Uri "$BackendUrl/api/health" -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

function Test-SalesPilotBackendIdentity {
    try {
        $identity = Invoke-RestMethod -Uri "$BackendUrl/" -TimeoutSec 2
        return $identity.service -eq 'SalesPilot AI' -and $identity.api_base -eq '/api'
    }
    catch {
        return $false
    }
}

function Get-ListenerOnPort([int]$Port) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
}

$backendListener = Get-ListenerOnPort 8000
if ($backendListener) {
    $isHealthySalesPilot = Test-SalesPilotBackend
    $isCurrentSalesPilot = $isHealthySalesPilot -and (Test-SalesPilotBackendIdentity)
    if ($RestartBackend -and $isHealthySalesPilot) {
        $stalePid = $backendListener.OwningProcess
        Write-Host "Stopping the existing SalesPilot backend on port 8000 (PID $stalePid)." -ForegroundColor Yellow
        Stop-Process -Id $stalePid -ErrorAction Stop
        $deadline = (Get-Date).AddSeconds(10)
        do {
            Start-Sleep -Milliseconds 250
            $backendListener = Get-ListenerOnPort 8000
        } until (-not $backendListener -or (Get-Date) -gt $deadline)
        if ($backendListener) {
            throw "SalesPilot backend PID $stalePid did not release port 8000. Stop it manually before retrying."
        }
    }
    elseif ($isCurrentSalesPilot) {
        Write-Host "Backend already running on port 8000 (PID $($backendListener.OwningProcess)); reusing it." -ForegroundColor Yellow
    }
    elseif (-not $isHealthySalesPilot) {
        throw "Port 8000 is occupied by PID $($backendListener.OwningProcess), but it is not a healthy SalesPilot backend. Stop that process or configure another port before starting SalesPilot."
    }
    else {
        throw "Port 8000 has an outdated SalesPilot backend (PID $($backendListener.OwningProcess)). Run this script again with -RestartBackend to safely replace it."
    }
}
if (-not (Get-ListenerOnPort 8000)) {
    $backendOut = Join-Path $LogDirectory 'backend.out.log'
    $backendErr = Join-Path $LogDirectory 'backend.err.log'
    $backendProcess = Start-Process -FilePath $Python `
        -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') `
        -WorkingDirectory $BackendDirectory `
        -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr -PassThru

    $deadline = (Get-Date).AddSeconds(20)
    do {
        Start-Sleep -Milliseconds 400
        if ($backendProcess.HasExited) {
            throw "Backend exited during startup. See $backendErr"
        }
    } until ((Test-SalesPilotBackend) -or (Get-Date) -gt $deadline)

    if (-not (Test-SalesPilotBackend) -or -not (Test-SalesPilotBackendIdentity)) {
        throw "Backend did not become healthy within 20 seconds. See $backendErr"
    }
    Write-Host "Backend started on port 8000 (PID $($backendProcess.Id))." -ForegroundColor Green
}

$frontendListener = Get-ListenerOnPort 5173
if ($frontendListener) {
    Write-Host "Frontend already has a listener on port 5173 (PID $($frontendListener.OwningProcess)); reusing it." -ForegroundColor Yellow
}
else {
    $frontendOut = Join-Path $LogDirectory 'frontend.out.log'
    $frontendErr = Join-Path $LogDirectory 'frontend.err.log'
    $frontendProcess = Start-Process -FilePath $Npm `
        -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173') `
        -WorkingDirectory $FrontendDirectory `
        -RedirectStandardOutput $frontendOut -RedirectStandardError $frontendErr -PassThru
    Write-Host "Frontend starting on port 5173 (PID $($frontendProcess.Id))." -ForegroundColor Green
}

Write-Host "`nSalesPilot AI is ready:" -ForegroundColor Cyan
Write-Host "  Frontend: $FrontendUrl"
Write-Host "  Backend:  $BackendUrl"
Write-Host "  Swagger:  $BackendUrl/docs"
Write-Host "  Logs:     $LogDirectory"

if ($OpenBrowser) {
    Start-Process $FrontendUrl
}
