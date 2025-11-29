# How to Fix "Too Many Connections" via cPanel

## Step 1: Log into cPanel
- Go to your hosting provider's cPanel
- URL is usually: `https://yourdomain.com:2083` or `https://yourserver.com/cpanel`

## Step 2: Access MySQL Management

### Option A: Remote MySQL
1. Find "Remote MySQL" in cPanel
2. Look for option to "Restart MySQL Service" or "Reset Connections"
3. Click it

### Option B: phpMyAdmin
1. Click "phpMyAdmin" in cPanel
2. Once loaded, look at the top menu
3. Click "Status" or "Variables"
4. Look for "Threads_connected" - this shows current connections
5. If you see an option to "Kill Process" or "Reset", use it

### Option C: Terminal/SSH (Advanced)
If you have SSH access:
```bash
# Login via SSH, then:
mysql -u idealstayco_db -p

# Enter password: [~y13pu-,){^df!w

# Once in MySQL:
SHOW PROCESSLIST;

# Kill specific connections (replace 123 with actual ID):
KILL 123;

# Or kill all your user's connections:
SELECT CONCAT('KILL ',id,';') FROM information_schema.processlist 
WHERE user='idealstayco_db';

# Exit MySQL
exit;
```

## Step 3: Wait for Timeout (If No Access)
If you can't access cPanel or SSH:
- Wait **8-10 minutes** for idle connections to timeout
- MySQL's default wait_timeout is usually 28800 seconds (8 hours)
- But your host might have it set to 300-600 seconds (5-10 minutes)

## Step 4: Verify Fix
After restarting/waiting, run:
```bash
node backend/check-connections.js
```

You should see:
```
✅ Successfully connected to database
📊 Max Connections Setting: 30 (or whatever your limit is)
📊 Current Active Connections: 5 (or less)
```

## Step 5: Prevent Future Issues
Your code is already fixed! Just make sure:
- ✅ Only run one script at a time
- ✅ Always let scripts finish (don't Ctrl+C mid-execution)
- ✅ Use the new `utils/db-pool.js` for any new code

## Common Hosting Providers

### Bluehost
- cPanel → "Database Tools" → "Remote MySQL"
- Live chat: Available 24/7

### HostGator  
- cPanel → "Databases" → "Remote MySQL"
- Phone: 1-866-964-2867

### SiteGround
- Site Tools → "MySQL" → "Connections"
- Ticket system for restart requests

### GoDaddy
- cPanel → "Databases" → "MySQL Databases"
- Phone: 1-480-505-8877

### A2 Hosting
- cPanel → "Databases" → "Remote MySQL" 
- Live chat available

## Contact Template

Copy this message to send to your host:

---

**Subject: Request MySQL Service Restart - Too Many Connections**

Hello,

I'm experiencing a "Too many connections" error (Error 1040) on my MySQL database.

**Database Details:**
- Host: 198.251.89.34:3306
- Database: idealstayco_db
- User: idealstayco_db

**Request:**
1. Please restart the MySQL service to clear stale connections
2. What is my current max_connections limit?
3. Can you confirm how many connections are currently active?

I've already updated my application code to use proper connection pooling and cleanup. I just need the existing connections cleared so I can continue development.

Thank you!

---

## Emergency Workaround

While waiting for the fix, you can temporarily:

1. **Use a different database** (if you have access to create one)
2. **Develop locally** with a local MySQL instance
3. **Wait for automatic timeout** (usually 5-10 minutes for shared hosting)

## Verification Command

Once fixed, verify everything works:
```bash
# Check connections
node backend/check-connections.js

# Test a simple script  
node backend/check-db-schema.js

# If successful, you should see:
# ✅ Pool properly closes
# ✅ No errors
```

## Your Code is Fixed! 

The good news: Your application code is already fixed and won't cause this problem again. You just need to clear the existing connections on the server once, then you're good to go! 🎉
