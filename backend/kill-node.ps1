# Kill Node.js Processes
# This script stops all running Node.js processes to free up database connections

Write-Host "Stopping all Node.js processes..." -ForegroundColor Yellow

try {
    $processes = Get-Process node -ErrorAction SilentlyContinue
    
    if ($processes) {
        $count = $processes.Count
        Write-Host "Found $count Node.js process(es)" -ForegroundColor Cyan
        
        $processes | Stop-Process -Force
        Start-Sleep -Seconds 1
        
        Write-Host "Successfully killed $count Node.js process(es)" -ForegroundColor Green
        Write-Host "Database connections should now be released." -ForegroundColor Green
    } else {
        Write-Host "No Node.js processes found." -ForegroundColor Gray
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`nYou can now restart your backend server." -ForegroundColor Cyan
