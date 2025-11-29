# Database Connection Management Guide

## Overview

This document explains how database connections are managed in the Ideal Stay backend to prevent "Too many connections" errors.

## The Problem

The "Too many connections" error occurs when:
- Multiple connection pools are created simultaneously
- Connections aren't properly released back to the pool
- Scripts exit without closing the pool
- You're on shared hosting with limited max_connections

## The Solution

### Centralized Connection Pool

All scripts now use a centralized connection pool utility located at `utils/db-pool.js`.

**Benefits:**
- ✅ Single pool shared across your entire application
- ✅ Automatic connection cleanup on exit
- ✅ Consistent configuration from `.env`
- ✅ Proper error handling
- ✅ Respects DB_CONNECTION_LIMIT setting

### How to Use

#### For Test Scripts

```javascript
require('dotenv').config();
const { getPool, closePool, query } = require('./utils/db-pool');

async function myTestScript() {
  try {
    // Use query() for simple queries
    const users = await query('SELECT * FROM users WHERE id = ?', [1]);
    console.log(users);

    // Or get the pool for more complex operations
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      const [results] = await connection.execute('SELECT * FROM bookings');
      // Do something with results
    } finally {
      connection.release(); // ALWAYS release the connection
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closePool(); // ALWAYS close the pool when done
  }
}

// ALWAYS add proper exit handling
myTestScript()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
```

#### For Express Routes

```javascript
const { query } = require('../utils/db-pool');

router.get('/users/:id', async (req, res) => {
  try {
    const users = await query(
      'SELECT * FROM users WHERE id = ?',
      [req.params.id]
    );
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  // No need to close pool in routes - it stays open
});
```

## Best Practices

### 1. Always Close Connections

❌ **Bad:**
```javascript
const pool = mysql.createPool({...});
await pool.execute('SELECT * FROM users');
// Script exits without closing pool
```

✅ **Good:**
```javascript
const { getPool, closePool } = require('./utils/db-pool');
try {
  const pool = getPool();
  await pool.query('SELECT * FROM users');
} finally {
  await closePool(); // Always close
}
```

### 2. Release Connections After Use

❌ **Bad:**
```javascript
const connection = await pool.getConnection();
await connection.execute('SELECT * FROM users');
// Connection never released!
```

✅ **Good:**
```javascript
const connection = await pool.getConnection();
try {
  await connection.execute('SELECT * FROM users');
} finally {
  connection.release(); // Always release
}
```

### 3. Use Low Connection Limits

For shared hosting, keep `DB_CONNECTION_LIMIT` low:

```env
# .env file
DB_CONNECTION_LIMIT=3  # Good for shared hosting
DB_CONNECTION_LIMIT=10 # Only for dedicated servers
```

### 4. Don't Create Multiple Pools

❌ **Bad:**
```javascript
// file1.js
const pool1 = mysql.createPool({...});

// file2.js
const pool2 = mysql.createPool({...});

// Each creates separate connections!
```

✅ **Good:**
```javascript
// Both files use the same pool
const { getPool } = require('./utils/db-pool');
const pool = getPool();
```

### 5. Handle Errors Gracefully

```javascript
async function myScript() {
  try {
    await query('SELECT * FROM users');
  } catch (error) {
    if (error.code === 'ER_CON_COUNT_ERROR') {
      console.error('Too many connections!');
      console.log('Solutions:');
      console.log('1. Kill all node processes: Get-Process node | Stop-Process -Force');
      console.log('2. Wait 8-10 minutes for connections to timeout');
      console.log('3. Contact hosting provider');
    }
  } finally {
    await closePool();
  }
}
```

## Troubleshooting

### Still Getting "Too Many Connections"?

**1. Kill All Node Processes**
```powershell
Get-Process node | Stop-Process -Force
```

**2. Check Active Connections**
```bash
node backend/check-connections.js
```

**3. Reduce Connection Limit**
Edit `.env`:
```env
DB_CONNECTION_LIMIT=2
```

**4. Check for Zombie Connections**
Log into your hosting control panel (cPanel) and restart MySQL.

**5. Contact Hosting Provider**
Ask them to:
- Check current max_connections limit
- Increase if possible (typically 100-150 for shared hosting)
- Reset any stuck connections

### Updated Scripts

The following scripts now use proper connection management:
- ✅ `test-conversations-api.js`
- ✅ `test-profile-image-size.js`
- ✅ `check-db-schema.js`
- ✅ `run-migration-003.js`
- ✅ `migrate-messaging-schema.js`
- ✅ `create-conversations-for-existing-bookings.js`

### Not Updated (Creates Own Pool)
- `check-connections.js` - Intentionally creates minimal pool for diagnostics

## Quick Reference

```javascript
// Import
const { getPool, closePool, query, testConnection } = require('./utils/db-pool');

// Simple query
const users = await query('SELECT * FROM users');

// Get pool for complex operations
const pool = getPool();

// Test connection
const isConnected = await testConnection();

// Always close when script exits
await closePool();
```

## Environment Variables

```env
# Database Configuration
DB_HOST=198.251.89.34
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=your_database
DB_CONNECTION_LIMIT=3        # Keep low for shared hosting
DB_ACQUIRE_TIMEOUT=60000     # How long to wait for a connection
DB_TIMEOUT=60000             # Query timeout
```

## Summary

✅ Use `utils/db-pool.js` for all database operations  
✅ Always close the pool when scripts exit  
✅ Always release connections after use  
✅ Keep connection limits low on shared hosting  
✅ Handle errors gracefully  
✅ Kill zombie processes if needed  

This will prevent connection exhaustion and keep your app running smoothly!
