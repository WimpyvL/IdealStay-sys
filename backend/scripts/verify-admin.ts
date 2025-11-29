#!/usr/bin/env tsx
/**
 * verify-admin.ts
 * Quick script to verify admin users in the database
 */
import 'dotenv/config';
import { getPool, connectDB } from '../src/config/database';

const run = async () => {
  try {
    await connectDB();
    const pool = getPool();

    console.log('\n📋 Checking admin users...\n');

    // Get all admin users
    const [adminRows] = await pool.execute(
      'SELECT id, email, first_name, last_name, role, is_verified, is_active, created_at FROM users WHERE role = ?',
      ['admin']
    );

    const admins = adminRows as any[];

    if (admins.length === 0) {
      console.log('⚠️  No admin users found in database');
    } else {
      console.log(`✅ Found ${admins.length} admin user(s):\n`);
      admins.forEach(admin => {
        console.log(`ID: ${admin.id}`);
        console.log(`Email: ${admin.email}`);
        console.log(`Name: ${admin.first_name} ${admin.last_name}`);
        console.log(`Role: ${admin.role}`);
        console.log(`Verified: ${admin.is_verified ? 'Yes' : 'No'}`);
        console.log(`Active: ${admin.is_active ? 'Yes' : 'No'}`);
        console.log(`Created: ${admin.created_at}`);
        console.log('---');
      });
    }

    // Get total user count
    const [countRows] = await pool.execute('SELECT COUNT(*) as total FROM users');
    const count = (countRows as any[])[0];
    console.log(`\n📊 Total users in database: ${count.total}\n`);

    // Test the columns that were causing issues
    console.log('🔍 Verifying database schema...\n');
    const [columns] = await pool.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'idealstayco_db' AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('status', 'is_active', 'email_verified', 'is_verified')"
    );

    const foundColumns = (columns as any[]).map(c => c.COLUMN_NAME);
    console.log('Available columns:', foundColumns.join(', '));

    if (!foundColumns.includes('is_active')) {
      console.log('❌ Column "is_active" not found!');
    } else {
      console.log('✅ Column "is_active" exists');
    }

    if (!foundColumns.includes('is_verified')) {
      console.log('❌ Column "is_verified" not found!');
    } else {
      console.log('✅ Column "is_verified" exists');
    }

    if (foundColumns.includes('status')) {
      console.log('⚠️  Column "status" exists (not expected in schema)');
    }

    if (foundColumns.includes('email_verified')) {
      console.log('⚠️  Column "email_verified" exists (not expected in schema)');
    }

  } catch (err: any) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  } finally {
    try { await getPool().end(); } catch {}
  }
};

run();
