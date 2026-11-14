# AI SDET Job Applier - PowerShell Runner
Set-Location -Path $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Starting AI SDET Job Applier Agent (PowerShell)" -ForegroundColor Cyan
Write-Host "  Time: $(Get-Date)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Check if node is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found on PATH. Please install Node.js." -ForegroundColor Red
    Exit 1
}

# Run Playwright Agent
Write-Host "`n[1/2] Discovering & Applying to QA/SDET Roles..." -ForegroundColor Green
npx ts-node src/applyAgent.ts

# Run Email Reporter
Write-Host "`n[2/2] Generating and Dispatching Consolidated Email Report..." -ForegroundColor Green
npx ts-node src/sendEmailReport.ts

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  Agent execution completed successfully!" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
