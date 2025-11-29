#!/usr/bin/env tsx
/**
 * create-admin.ts
 * Idempotent script to create or promote a user to admin.
 * Usage (PowerShell):
 *   $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="SomeStrongP@ss1"; npm run create-admin
 * Or pass flags:
 *   npm run create-admin -- --email admin@example.com --password SomeStrongP@ss1 --first "Site" --last "Admin"
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { getPool, connectDB } from '../src/config/database';
import { randomUUID } from 'crypto';

interface Args { [k: string]: string | undefined }

const parseArgs = (): Args => {
  const out: Args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].replace(/^--/, '');
      const next = argv[i+1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; } else { out[key] = 'true'; }
    }
  }
  return out;
};

const args = parseArgs();

const email = args.email || process.env.ADMIN_EMAIL;
const password = args.password || process.env.ADMIN_PASSWORD;
const firstName = args.first || process.env.ADMIN_FIRST_NAME || 'Admin';
const lastName = args.last || process.env.ADMIN_LAST_NAME || 'User';

if (!email || !password) {
  console.error('❌ Missing required email/password. Provide via --email/--password or ADMIN_EMAIL/ADMIN_PASSWORD env vars.');
  process.exit(1);
}

const run = async () => {
  try {
  await connectDB();
  const pool = getPool();

    // Look up existing user
    const [existingRows] = await pool.execute(
      'SELECT id, role, is_verified FROM users WHERE email = ?', [email]
    );
    const existing = (existingRows as any[])[0];

    if (existing) {
      if (existing.role === 'admin') {
        console.log(`✅ User already admin: ${email}`);
        return;
      }
      // Promote existing user
      await pool.execute(
        `UPDATE users
         SET role = 'admin', is_verified = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`, [existing.id]
      );
      console.log(`✅ Promoted existing user to admin: ${email}`);
      return;
    }

    // Create new admin user
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const verificationToken = randomUUID();

    const [result] = await pool.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified, verification_token)
       VALUES (?, ?, ?, ?, 'admin', 1, ?)`,
      [email, passwordHash, firstName, lastName, verificationToken]
    );

    const insertId = (result as any).insertId;
    console.log(`✅ Created new admin user id=${insertId} email=${email}`);
  } catch (err: any) {
    console.error('❌ Failed to create admin:', err.message || err);
    process.exit(1);
  } finally {
    try { await getPool().end(); } catch {}
  }
};

run();
