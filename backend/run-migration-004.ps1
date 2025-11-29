# Migration 004: Add Payment History and Refunds Tables
# This script runs the database migration to fix the payment confirmation error

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  IDEAL STAY V3 - Database Migration 004" -ForegroundColor Cyan
Write-Host "  Add Payment History and Refunds Tables" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the backend directory
if (!(Test-Path ".\run-migration-004.js")) {
    Write-Host "❌ Error: run-migration-004.js not found" -ForegroundColor Red
    Write-Host "   Please run this script from the backend directory" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Check if .env file exists
if (!(Test-Path ".\.env")) {
    Write-Host "⚠️  Warning: .env file not found" -ForegroundColor Yellow
    Write-Host "   Make sure you have configured your database credentials" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "🔄 Running migration..." -ForegroundColor Yellow
Write-Host ""

# Run the migration script
node run-migration-004.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Restart your backend server if it's running" -ForegroundColor White
    Write-Host "2. Try confirming a payment again from the Host Dashboard" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Migration failed. Please check the error messages above." -ForegroundColor Red
    Write-Host ""
    exit 1
}
