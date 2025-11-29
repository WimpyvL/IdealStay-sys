# Payment History Migration - Fix Guide

## Problem
When trying to confirm a pending payment from the Host Dashboard, you received this error:
```
Table 'idealstayco_db.payment_history' doesn't exist
```

## Solution
The `payment_history` and `refunds` tables were missing from your database. This migration adds them.

## What These Tables Do

### `payment_history` Table
Tracks all payment status changes for bookings:
- Records who made the change (updated_by)
- Tracks previous and new payment status
- Stores payment method and reference numbers
- Keeps notes about the change
- Useful for audit trails and dispute resolution

### `refunds` Table
Tracks refund processing:
- Records refund amounts and reasons
- Links to the original booking
- Tracks who processed the refund
- Stores refund method and reference
- Helps with financial reporting

## How to Run the Migration

### Option 1: PowerShell Script (Easiest)
```powershell
cd backend
.\run-migration-004.ps1
```

### Option 2: Node.js Script
```powershell
cd backend
node run-migration-004.js
```

### Option 3: Direct SQL
If you prefer to run SQL directly in phpMyAdmin or MySQL Workbench:
1. Open `backend/migrations/004-add-payment-history.sql`
2. Copy the entire contents
3. Paste into your SQL client
4. Execute

## After Running the Migration

1. **Restart your backend server** if it's currently running:
   ```powershell
   # In the terminal running your backend:
   # Press Ctrl+C to stop
   # Then restart:
   npm run dev
   ```

2. **Test the payment confirmation**:
   - Go to Host Dashboard
   - Find a booking with pending payment
   - Click "Approve Payment"
   - It should now work without errors

## Verification

After running the migration, you can verify the tables exist:

```sql
-- Check if tables exist
SHOW TABLES LIKE 'payment_history';
SHOW TABLES LIKE 'refunds';

-- View table structure
DESCRIBE payment_history;
DESCRIBE refunds;

-- Check for any records
SELECT COUNT(*) FROM payment_history;
SELECT COUNT(*) FROM refunds;
```

## What the Migration Does

1. Creates `payment_history` table with:
   - Booking reference
   - Status tracking (pending, paid, failed, refunded, partial)
   - Payment method and reference
   - User who made the change
   - Timestamp of change

2. Creates `refunds` table with:
   - Booking reference
   - Refund amount and reason
   - Refund method and reference
   - Admin who processed it
   - Processing timestamp

3. Adds performance indexes to `bookings` table:
   - Property and date lookups
   - Guest and host status queries
   - Payment status filtering

## Troubleshooting

### Error: "Access denied"
- Check your `.env` file in the backend directory
- Verify `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_NAME` are correct

### Error: "Connection refused"
- Make sure MySQL server is running
- Check if `DB_HOST` is correct (usually `localhost` for local development)

### Error: "Cannot find module 'mysql2'"
- Install dependencies: `npm install` in the backend directory

### Error: "ER_NO_SUCH_TABLE: bookings"
- You need to run the main database schema first
- Import `database-schema.sql` into your database

## Files Modified/Created

1. **database-schema.sql** - Added payment_history and refunds tables to main schema
2. **backend/migrations/004-add-payment-history.sql** - Migration SQL file
3. **backend/run-migration-004.js** - Node.js migration runner
4. **backend/run-migration-004.ps1** - PowerShell helper script
5. **backend/PAYMENT_HISTORY_MIGRATION.md** - This documentation

## Technical Details

### Payment Status Flow
```
pending → paid (confirmed by host)
pending → failed (payment declined)
paid → refunded (after cancellation)
paid → partial (partial refund issued)
```

### Foreign Key Relationships
- `payment_history.booking_id` → `bookings.id` (CASCADE DELETE)
- `payment_history.updated_by` → `users.id` (SET NULL on delete)
- `refunds.booking_id` → `bookings.id` (CASCADE DELETE)
- `refunds.processed_by` → `users.id` (SET NULL on delete)

### Indexes for Performance
- `idx_payment_history_booking` - Fast booking lookups
- `idx_payment_history_date` - Date range queries
- `idx_refunds_booking` - Fast refund lookups
- `idx_refunds_date` - Refund reporting queries

## Future Enhancements

Consider adding:
- Email notifications when payment status changes
- Automatic payment history entries via triggers
- Payment history dashboard for hosts
- Refund request workflow for guests
- Integration with payment gateways (Stripe, PayPal)

## Support

If you continue to have issues after running this migration:
1. Check the browser console for new error messages
2. Check the backend server logs
3. Verify the tables exist in your database
4. Ensure your backend server has restarted
