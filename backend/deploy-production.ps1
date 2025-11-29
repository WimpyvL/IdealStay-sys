# Production Deployment Script for cPanel
# This script prepares the backend for production deployment

Write-Host "🚀 Ideal Stay V3 - Production Deployment Preparation" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Step 1: Build the backend for production
Write-Host "`n📦 Step 1: Building Production Bundle" -ForegroundColor Yellow
try {
    npm run build
    Write-Host "✅ Production build completed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Check required files
Write-Host "`n📋 Step 2: Checking Required Files" -ForegroundColor Yellow
$requiredFiles = @(
    "package.json",
    "dist/server.js",
    "dist/app.js",
    ".env.production.template"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ Found: $file" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $file" -ForegroundColor Red
    }
}

# Step 3: Create deployment package
Write-Host "`n📦 Step 3: Creating Deployment Package" -ForegroundColor Yellow
$deploymentFiles = @(
    "dist/",
    "package.json",
    ".env.production.template",
    "uploads/",
    "README.md"
)

if (Test-Path "deployment-package") {
    Remove-Item "deployment-package" -Recurse -Force
}
New-Item -ItemType Directory -Name "deployment-package"

foreach ($item in $deploymentFiles) {
    if (Test-Path $item) {
        Copy-Item $item "deployment-package/" -Recurse -Force
        Write-Host "✅ Packaged: $item" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Skipped: $item (not found)" -ForegroundColor Yellow
    }
}

# Step 4: Create production instructions
Write-Host "`n📖 Step 4: Creating Production Instructions" -ForegroundColor Yellow
$instructions = @"
🚀 IDEAL STAY V3 - PRODUCTION DEPLOYMENT INSTRUCTIONS
=================================================

📋 PREREQUISITES:
1. cPanel hosting account with Node.js support
2. MySQL database (idealstayco_db) already set up
3. Node.js 18+ enabled in cPanel
4. Domain/subdomain configured for the application

📦 DEPLOYMENT STEPS:

1. UPLOAD FILES:
   - Upload all files from 'deployment-package/' to your cPanel public_html or app directory
   - Maintain the directory structure

2. CONFIGURE ENVIRONMENT:
   - Copy .env.production.template to .env
   - Update all values in .env with your production settings
   - IMPORTANT: Change JWT_SECRET and SESSION_SECRET to strong random keys

3. INSTALL DEPENDENCIES:
   - SSH into your cPanel or use Terminal
   - Navigate to your app directory
   - Run: npm install --production

4. DATABASE SETUP:
   - Database schema is already deployed
   - Verify connection settings in .env match your cPanel MySQL credentials

5. START APPLICATION:
   - In cPanel Node.js app settings:
     * Set Startup file: dist/server.js
     * Set Node.js version: 18 or higher
   - Click "Restart" to start the application

6. CONFIGURE DOMAIN:
   - Update DNS settings if needed
   - Configure SSL certificate
   - Test the health endpoint: https://your-domain.com/health

7. FRONTEND CONFIGURATION:
   - Update frontend build to point to production API
   - Deploy frontend to your web server
   - Update CORS settings in backend .env

🔍 TESTING:
- Health check: GET https://your-domain.com/health
- API test: GET https://your-domain.com/api/v1/properties
- Authentication: POST https://your-domain.com/api/v1/auth/login

⚠️  IMPORTANT SECURITY NOTES:
- Never use development secrets in production
- Enable HTTPS for all endpoints
- Regularly update dependencies
- Monitor logs for security issues
- Backup database regularly

📞 SUPPORT:
If you encounter issues, check the application logs in cPanel
or contact support with specific error messages.

🎉 Your Ideal Stay V3 backend should now be running in production!
"@

$instructions | Out-File -FilePath "deployment-package/DEPLOYMENT-INSTRUCTIONS.txt" -Encoding UTF8
Write-Host "✅ Created deployment instructions" -ForegroundColor Green

# Step 5: Security checklist
Write-Host "`n🔒 Step 5: Security Checklist" -ForegroundColor Yellow
$securityChecklist = @(
    "JWT_SECRET changed from default",
    "CORS origins restricted to production domain",
    "Database credentials secured",
    "File upload limits configured",
    "Rate limiting enabled",
    "HTTPS configured",
    "Environment variables secured"
)

Write-Host "Security Checklist (manual verification required):" -ForegroundColor Gray
foreach ($item in $securityChecklist) {
    Write-Host "  ⚠️  $item" -ForegroundColor Yellow
}

Write-Host "`n🎯 Deployment Preparation Complete!" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "✅ Production build created" -ForegroundColor Green
Write-Host "✅ Deployment package ready" -ForegroundColor Green
Write-Host "✅ Instructions generated" -ForegroundColor Green
Write-Host "📁 Files ready in: deployment-package/" -ForegroundColor White
Write-Host "`n📋 Next Steps:" -ForegroundColor White
Write-Host "1. Review deployment-package/DEPLOYMENT-INSTRUCTIONS.txt" -ForegroundColor Gray
Write-Host "2. Upload files to your cPanel hosting" -ForegroundColor Gray
Write-Host "3. Configure environment variables" -ForegroundColor Gray
Write-Host "4. Install dependencies and start application" -ForegroundColor Gray
Write-Host "5. Test all endpoints in production" -ForegroundColor Gray