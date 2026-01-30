# Start Development Servers (Frontend + Backend)
# Usage: .\start-dev.ps1

Write-Host "🚀 Starting Dicoding GenAI Development Servers..." -ForegroundColor Cyan

# Start Backend in new terminal
$backendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npx nodemon --env-file .env index.js" -PassThru

# Wait a bit for backend to start
Start-Sleep -Seconds 2

# Start Frontend in new terminal
$frontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd client; npm run build; npm run dev" -PassThru

Write-Host ""
Write-Host "✅ Development servers started!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "📍 Backend:  http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C in each terminal to stop the servers." -ForegroundColor Gray
