# Kill all Node.js processes to free database connections
# Run this if you get "Too many connections" errors

Write-Host "🔍 Looking for Node.js processes..." -ForegroundColor Cyan

$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Found $($nodeProcesses.Count) Node.js process(es)" -ForegroundColor Yellow
    
    foreach ($proc in $nodeProcesses) {
        Write-Host "  - PID: $($proc.Id) | Started: $($proc.StartTime)" -ForegroundColor Gray
    }
    
    Write-Host "`n⚠️  Stopping all Node.js processes..." -ForegroundColor Yellow
    Stop-Process -Name node -Force -ErrorAction SilentlyContinue
    
    Start-Sleep -Seconds 2
    
    $remainingProcesses = Get-Process node -ErrorAction SilentlyContinue
    if ($remainingProcesses) {
        Write-Host "❌ Some processes still running. Try running as Administrator." -ForegroundColor Red
    } else {
        Write-Host "✅ All Node.js processes stopped successfully!" -ForegroundColor Green
        Write-Host "`n💡 Database connections should be released." -ForegroundColor Cyan
        Write-Host "   Wait 30 seconds before starting new processes." -ForegroundColor Cyan
    }
} else {
    Write-Host "✅ No Node.js processes found running." -ForegroundColor Green
}

Write-Host "`nPress any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
