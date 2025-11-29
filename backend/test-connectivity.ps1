# Simple API Health Test
$baseUrl = "http://localhost:3001"

Write-Host "🔍 Testing API Connectivity" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor Gray

# Test 1: Basic connectivity
Write-Host "`n❤️ Testing Health Endpoint" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -TimeoutSec 10
    if ($response) {
        Write-Host "✅ Success: Server is responding" -ForegroundColor Green
        Write-Host "Response: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Check if server is running on the port
Write-Host "`n🌐 Testing Port Connectivity" -ForegroundColor Yellow
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.ConnectAsync("localhost", 3001).Wait(3000)
    if ($tcpClient.Connected) {
        Write-Host "✅ Success: Port 3001 is open and responding" -ForegroundColor Green
        $tcpClient.Close()
    } else {
        Write-Host "❌ Failed: Port 3001 is not responding" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed: Cannot connect to port 3001 - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Check what's running on port 3001
Write-Host "`n🔍 Checking Port 3001 Usage" -ForegroundColor Yellow
try {
    $processInfo = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($processInfo) {
        $process = Get-Process -Id $processInfo.OwningProcess -ErrorAction SilentlyContinue
        Write-Host "✅ Port 3001 is in use by: $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Warning: No process found using port 3001" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed: Cannot check port usage - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Connectivity Test Complete" -ForegroundColor Cyan