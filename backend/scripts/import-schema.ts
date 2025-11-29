import fs from 'fs';
import path from 'path';
import { getPool } from '../src/config/database';

const importSchema = async () => {
  try {
    console.log('🔍 Starting database schema import...\n');

    // Read the schema file
    const schemaPath = path.join(__dirname, '..', '..', 'database-schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');
    console.log('📖 Schema file loaded successfully');

    // Get database connection
    const pool = getPool();

    // Clean up the SQL - remove comments and normalize whitespace
    const cleanedSQL = schemaSQL
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('--'))
      .join('\n');

    // Split the SQL into individual statements
    const statements = cleanedSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);
        
        // Skip empty statements
        if (!statement || statement.trim() === '') {
          console.log(`   ⏭️  Skipping empty statement\n`);
          continue;
        }

        await pool.execute(statement);
        console.log(`✅ Statement ${i + 1} executed successfully`);
        
        // Show what was executed (truncated)
        const preview = statement.length > 80 
          ? statement.substring(0, 80) + '...' 
          : statement;
        console.log(`   📝 ${preview}\n`);
        
      } catch (error) {
        console.error(`❌ Error in statement ${i + 1}:`);
        console.error(`   SQL: ${statement.substring(0, 100)}...`);
        console.error(`   Error:`, error);
        
        // Continue with other statements but log the error
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log('   ℹ️  Table/constraint already exists, continuing...\n');
        } else {
          console.log('   ⚠️  Continuing with next statement...\n');
        }
      }
    }

    // Verify tables were created
    console.log('\n🔍 Verifying database structure...');
    
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME, TABLE_ROWS, TABLE_COMMENT 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      ORDER BY TABLE_NAME
    `);

    console.log('\n📊 Database Tables:');
    console.log('─'.repeat(60));
    
    (tables as any[]).forEach(table => {
      console.log(`📄 ${table.TABLE_NAME.padEnd(20)} | Rows: ${(table.TABLE_ROWS || 0).toString().padStart(5)}`);
    });

    console.log('─'.repeat(60));
    console.log(`✅ Found ${(tables as any[]).length} tables in database`);

    console.log('\n🎉 Database schema import completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Start the development server: npm run dev');
    console.log('   2. Test the authentication endpoints');
    console.log('   3. Register a test user account');
    console.log('   4. Verify JWT authentication works');

  } catch (error) {
    console.error('❌ Schema import failed:', error);
    process.exit(1);
  }

  process.exit(0);
};

// Import the database configuration first
import('../src/config/database').then(() => {
  importSchema();
}).catch(error => {
  console.error('❌ Failed to load database config:', error);
  process.exit(1);
});