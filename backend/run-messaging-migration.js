const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  console.log('Connected to database');

  const sqlPath = path.join(__dirname, 'create-messaging-tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Creating messaging tables...');
  await connection.query(sql);
  console.log('Messaging tables created successfully!');

  // Verify tables were created
  const [tables] = await connection.query(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('conversations', 'conversation_participants', 'messages')
  `, [process.env.DB_NAME]);

  console.log('\nCreated tables:');
  tables.forEach(t => console.log('  ✓', t.TABLE_NAME));

  await connection.end();
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
