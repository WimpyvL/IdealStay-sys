# 🚀 Quick Reference Card - Database Connections

## Emergency Fix
```powershell
# Kill all Node processes to free connections
Get-Process node | Stop-Process -Force
```

## Check Connection Status
```bash
node backend/check-connections.js
```

## Common Tasks

### Run Test Scripts
```bash
node backend/test-conversations-api.js      # Test messaging
node backend/test-profile-image-size.js     # Test profile images  
node backend/check-db-schema.js             # Check schema
```

### Configuration
```env
# Edit backend/.env
DB_CONNECTION_LIMIT=3    # Shared hosting (recommended)
DB_CONNECTION_LIMIT=10   # Dedicated server only
```

## Code Templates

### Simple Query
```javascript
const { query } = require('./utils/db-pool');
const users = await query('SELECT * FROM users WHERE id = ?', [1]);
```

### Test Script Template
```javascript
require('dotenv').config();
const { getPool, closePool, query } = require('./utils/db-pool');

async function myTest() {
  try {
    const results = await query('SELECT * FROM table');
    console.log(results);
  } catch (error) {
    console.error(error);
  } finally {
    await closePool();
  }
}

myTest()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Too many connections" | `Get-Process node \| Stop-Process -Force` |
| Connection timeout | Check `.env` settings |
| Pool not closing | Add `finally { await closePool(); }` |
| Multiple pools | Use `utils/db-pool.js` instead |

## Key Rules

✅ **DO:**
- Use `utils/db-pool.js` for all DB operations
- Always close pool in scripts: `await closePool()`
- Always release connections: `connection.release()`
- Keep `DB_CONNECTION_LIMIT` low on shared hosting

❌ **DON'T:**
- Create multiple connection pools
- Hardcode connection limits
- Exit scripts without closing pool
- Run multiple scripts simultaneously

## Files Created

- `utils/db-pool.js` - Connection pool utility
- `CONNECTION_MANAGEMENT.md` - Full documentation
- `CONNECTION_FIXES_SUMMARY.md` - What was fixed
- `check-connections.js` - Diagnostics tool
- `kill-node-processes.ps1` - Helper script

## Get Help

See `CONNECTION_MANAGEMENT.md` for detailed guide.
