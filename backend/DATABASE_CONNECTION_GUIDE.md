# ===========================================
# IDEAL STAY V3 - DATABASE CONNECTION GUIDE
# ===========================================

## 🎯 **Connection Options**

You have **3 options** for setting up the database connection:

### **Option 1: Direct cPanel Database (Recommended)**
Connect directly to your cPanel MySQL database for development and production.

### **Option 2: Local MySQL + cPanel Production**
Use local MySQL for development, cPanel for production.

### **Option 3: Development Mode (Skip DB)**
Continue development without database (uses mock data).

---

## 🔧 **Option 1: Direct cPanel Connection**

### **Step 1: Get cPanel Database Credentials**
From your cPanel hosting account, collect:
- Database Host (usually your domain or server IP)
- Database Name 
- Database Username
- Database Password
- Port (usually 3306)

### **Step 2: Update .env File**
```env
# Database Configuration (cPanel)
DB_HOST=your_cpanel_server.com
DB_PORT=3306
DB_USER=your_cpanel_db_user
DB_PASSWORD=your_cpanel_db_password
DB_NAME=your_cpanel_db_name

# Enable remote connections
DB_ALLOW_REMOTE=true
```

### **Step 3: Enable Remote MySQL Access**
In cPanel → **Remote MySQL**:
1. Add your IP address to allowed hosts
2. Or add `%` to allow all connections (less secure)
3. Save changes

### **Step 4: Create Database & Import Schema**
In cPanel → **phpMyAdmin**:
1. Create database (if not exists)
2. Import `database-schema.sql`
3. Run `database-test.sql` to verify

---

## 🏠 **Option 2: Local MySQL Setup**

### **Step 1: Install MySQL Locally**
**Windows:**
```powershell
# Download MySQL Community Server
# OR use XAMPP/WAMP
# OR use MySQL Installer
```

**Alternative - Docker:**
```bash
docker run --name mysql-idealstay -e MYSQL_ROOT_PASSWORD=password -d -p 3306:3306 mysql:8.0
```

### **Step 2: Create Local Database**
```sql
CREATE DATABASE idealstay_dev;
USE idealstay_dev;
SOURCE database-schema.sql;
```

### **Step 3: Update .env for Local Development**
```env
# Local Development Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=idealstay_dev
```

---

## 🚫 **Option 3: Skip Database (Development Mode)**

### **Continue Without Database**
```powershell
# In backend directory
$env:SKIP_DB_TEST="true"
npm run dev
```

This allows you to:
- ✅ Test API structure
- ✅ Develop frontend components  
- ✅ Work on authentication logic
- ❌ No real data persistence
- ❌ No database operations

---

## 🔍 **Testing Database Connection**

### **Test Connection**
```powershell
# Remove skip flag to test
$env:SKIP_DB_TEST="false"
npm run dev
```

### **Expected Success Output:**
```
🔍 Testing database connection...
🔌 MySQL connection pool created
✅ Database connection test successful
🚀 Server running on port: 3001
```

### **Common Connection Errors:**

**ECONNREFUSED:**
- MySQL server not running
- Wrong host/port
- Firewall blocking connection

**ER_ACCESS_DENIED_ERROR:**
- Wrong username/password
- User doesn't have database permissions

**ER_BAD_DB_ERROR:**
- Database doesn't exist
- Wrong database name

---

## 🛠️ **Troubleshooting Guide**

### **1. cPanel Remote Connection Issues**

**Problem:** Can't connect to cPanel database
**Solutions:**
- Enable Remote MySQL in cPanel
- Add your IP to allowed hosts
- Check if host allows remote connections
- Verify credentials are correct
- Try using server IP instead of domain

### **2. Local MySQL Issues**

**Problem:** ECONNREFUSED on localhost
**Solutions:**
```powershell
# Check if MySQL is running
Get-Service -Name "*mysql*"

# Start MySQL service
Start-Service -Name "MySQL80"

# Check MySQL port
netstat -an | findstr :3306
```

### **3. Firewall Issues**

**Problem:** Connection timeout
**Solutions:**
- Add MySQL port (3306) to firewall exceptions
- Check antivirus/security software
- Verify network connectivity

### **4. Authentication Issues**

**Problem:** Access denied
**Solutions:**
```sql
-- Create user and grant permissions
CREATE USER 'idealstay_user'@'%' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON idealstay_dev.* TO 'idealstay_user'@'%';
FLUSH PRIVILEGES;
```

---

## 🎯 **Recommended Next Steps**

1. **Choose your option** based on your setup preferences
2. **Configure .env file** with correct credentials
3. **Test connection** using the provided commands
4. **Import database schema** once connection works
5. **Proceed to Phase 6** (Authentication System)

---

## 🆘 **Need Help?**

**For cPanel issues:** Contact your hosting provider
**For local MySQL:** Check MySQL documentation
**For connection errors:** Share the specific error message

**The backend is designed to work with any of these options!** 🚀