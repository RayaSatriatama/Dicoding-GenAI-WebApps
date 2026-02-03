# Start Development Servers (Frontend + Backend + Kotaemon Proxy)
# Usage: .\start-dev.ps1
# Usage with logs: .\start-dev.ps1 -EnableLogs

param(
    [switch]$EnableLogs = $false
)

Write-Host "🚀 Starting Dicoding GenAI Development Servers..." -ForegroundColor Cyan
Write-Host ""

# Get the script's directory (project root)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) {
    $scriptDir = Get-Location
}
Write-Host "📂 Project root: $scriptDir" -ForegroundColor Gray

# Setup log directory if logging is enabled
$logsDir = Join-Path $scriptDir "logs"
if ($EnableLogs) {
    if (-not (Test-Path $logsDir)) {
        New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
    }
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backendLogFile = Join-Path $logsDir "backend_$timestamp.log"
    $frontendLogFile = Join-Path $logsDir "frontend_$timestamp.log"
    Write-Host "📝 Logging enabled!" -ForegroundColor Yellow
    Write-Host "   Backend log:  $backendLogFile" -ForegroundColor Gray
    Write-Host "   Frontend log: $frontendLogFile" -ForegroundColor Gray
    Write-Host ""
}

# ---------------------------------------------------------
# Check & Start MongoDB Service
# ---------------------------------------------------------
Write-Host "Checking MongoDB Service..." -ForegroundColor Cyan
$mongoService = Get-Service -Name MongoDB -ErrorAction SilentlyContinue

if ($mongoService) {
    if ($mongoService.Status -ne 'Running') {
        Write-Host "⚠️ MongoDB is $($mongoService.Status). Attempting to start..." -ForegroundColor Yellow
        try {
            Start-Service -Name MongoDB -ErrorAction Stop
            Write-Host "✅ MongoDB started successfully!" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ Failed to start with current permissions. Requesting Administrator rights..." -ForegroundColor Yellow
            try {
                $proc = Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile", "-Command", "Start-Service -Name MongoDB" -PassThru
                $proc.WaitForExit()
                
                # Re-check status
                $mongoService.Refresh()
                if ($mongoService.Status -eq 'Running') {
                     Write-Host "✅ MongoDB started successfully (via Admin)!" -ForegroundColor Green
                } else {
                     Write-Host "❌ Failed to start MongoDB even with Admin request." -ForegroundColor Red
                }
            } catch {
                Write-Host "❌ Could not request Admin privileges. Please run script as Administrator." -ForegroundColor Red
            }
        }
    } else {
        Write-Host "✅ MongoDB is running." -ForegroundColor Green
    }
} else {
    # Fallback to checking Docker if local service is missing
    Write-Host "⚠️ Local MongoDB service not found. Checking Docker..." -ForegroundColor Yellow
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        $dockerContainer = docker ps -q -f name=mongodb
        if ($dockerContainer) {
             Write-Host "✅ MongoDB is running in Docker." -ForegroundColor Green
        } else {
             Write-Host "⚠️ MongoDB not found in Docker either." -ForegroundColor Yellow
        }
    }
}
Write-Host ""


# Check if Python virtual environment exists for backend
$venvPath = Join-Path $scriptDir "backend\.venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "📦 Setting up backend virtual environment..." -ForegroundColor Yellow
    Set-Location (Join-Path $scriptDir "backend")
    python -m venv .venv
    & .\.venv\Scripts\pip install -r requirements.txt
    Set-Location $scriptDir
    Write-Host "✅ Kotaemon proxy dependencies installed!" -ForegroundColor Green
}

# Start Unified Backend (Python FastAPI) in new terminal
Write-Host "🔵 Starting Backend..." -ForegroundColor Blue
$backendPath = Join-Path $scriptDir "backend"
# Set UTF-8 encoding for Python to handle emojis properly
$envSetup = "`$env:PYTHONIOENCODING='utf-8'; `$env:PYTHONUTF8='1';"
if ($EnableLogs) {
    $backendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "$envSetup Set-Location '$backendPath'; .\.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000 2>&1 | Tee-Object -FilePath '$backendLogFile'" -PassThru
} else {
    $backendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "$envSetup Set-Location '$backendPath'; .\.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000" -PassThru
}

# Wait a bit for proxy to start
Start-Sleep -Seconds 2

# Start Frontend (Vite) in new terminal
Write-Host "🟢 Starting Vite Frontend..." -ForegroundColor Green
$frontendPath = Join-Path $scriptDir "client"
if ($EnableLogs) {
    $frontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendPath'; npm run dev 2>&1 | Tee-Object -FilePath '$frontendLogFile'" -PassThru
} else {
    $frontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendPath'; npm run dev" -PassThru
}

Write-Host ""
Write-Host "✅ All development servers started!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Frontend:        http://localhost:5173" -ForegroundColor Yellow
Write-Host "📍 Backend:         http://localhost:8000" -ForegroundColor Yellow
Write-Host "📍 Kotaemon UI:     http://localhost:7860 (must be running separately)" -ForegroundColor Cyan
Write-Host ""
if ($EnableLogs) {
    Write-Host "📝 Log files location: $logsDir" -ForegroundColor Yellow
    Write-Host "   To view backend logs:  Get-Content '$backendLogFile' -Tail 100" -ForegroundColor Gray
    Write-Host "   To follow backend logs: Get-Content '$backendLogFile' -Tail 50 -Wait" -ForegroundColor Gray
    Write-Host ""
}
Write-Host "💡 Make sure Kotaemon is running at http://localhost:7860" -ForegroundColor Gray
Write-Host "   Run: docker run -p 7860:7860 ghcr.io/cinnamon/kotaemon:main-full" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C in each terminal to stop the servers." -ForegroundColor Gray
