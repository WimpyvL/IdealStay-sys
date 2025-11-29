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

  const sqlPath = path.join(__dirname, 'database-phase8-extensions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running migration...');
  await connection.query(sql);
  console.log('Migration completed successfully!');

  await connection.end();
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
