import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { connectDB } from '../config/database';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

const updateEnvFile = (updates: Record<string, string>): void => {
  const envPath = path.join(__dirname, '../../.env');
  let envContent = '';
  
  // Read existing .env file or create from .env.example
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  } else {
    const examplePath = path.join(__dirname, '../../.env.example');
    if (fs.existsSync(examplePath)) {
      envContent = fs.readFileSync(examplePath, 'utf8');
    }
  }
  
  // Update or add environment variables
  Object.entries(updates).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  });
  
  // Write updated .env file
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file updated');
};

const setupDatabase = async (): Promise<void> => {
  console.log('🏡 IDEAL STAY V3 - DATABASE SETUP WIZARD');
  console.log('=========================================');
  console.log('');
  
  console.log('Choose your database setup option:');
  console.log('1. cPanel MySQL Database (Production/Remote)');
  console.log('2. Local MySQL Database (Development)');
  console.log('3. Skip Database Setup (Development Mode)');
  console.log('');
  
  const option = await question('Enter your choice (1-3): ');
  
  switch (option.trim()) {
    case '1':
      await setupCPanelDatabase();
      break;
    case '2':
      await setupLocalDatabase();
      break;
    case '3':
      await setupSkipDatabase();
      break;
    default:
      console.log('❌ Invalid option. Please run the setup again.');
      process.exit(1);
  }
};

const setupCPanelDatabase = async (): Promise<void> => {
  console.log('');
  console.log('🌐 cPanel Database Setup');
  console.log('========================');
  console.log('');
  
  console.log('Please enter your cPanel database credentials:');
  console.log('(You can find these in cPanel → MySQL Databases)');
  console.log('');
  
  const host = await question('Database Host (e.g., your-domain.com or server IP): ');
  const port = await question('Database Port [3306]: ') || '3306';
  const name = await question('Database Name: ');
  const user = await question('Database Username: ');
  const password = await question('Database Password: ');
  
  console.log('');
  console.log('⚠️  IMPORTANT: Make sure to:');
  console.log('1. Enable "Remote MySQL" in your cPanel');
  console.log('2. Add your IP address to allowed hosts');
  console.log('3. Import database-schema.sql to your database');
  console.log('');
  
  const updates = {
    DB_HOST: host,
    DB_PORT: port,
    DB_NAME: name,
    DB_USER: user,
    DB_PASSWORD: password
  };
  
  updateEnvFile(updates);
  await testConnection();
};

const setupLocalDatabase = async (): Promise<void> => {
  console.log('');
  console.log('🏠 Local Database Setup');
  console.log('=======================');
  console.log('');
  
  const host = await question('Database Host [localhost]: ') || 'localhost';
  const port = await question('Database Port [3306]: ') || '3306';
  const name = await question('Database Name [idealstay_dev]: ') || 'idealstay_dev';
  const user = await question('Database Username [root]: ') || 'root';
  const password = await question('Database Password: ');
  
  console.log('');
  console.log('📝 Make sure you have:');
  console.log('1. MySQL server installed and running');
  console.log('2. Created the database: CREATE DATABASE ' + name + ';');
  console.log('3. Imported the schema: SOURCE database-schema.sql;');
  console.log('');
  
  const updates = {
    DB_HOST: host,
    DB_PORT: port,
    DB_NAME: name,
    DB_USER: user,
    DB_PASSWORD: password
  };
  
  updateEnvFile(updates);
  await testConnection();
};

const setupSkipDatabase = async (): Promise<void> => {
  console.log('');
  console.log('🚫 Skip Database Setup');
  console.log('======================');
  console.log('');
  
  const updates = {
    SKIP_DB_TEST: 'true'
  };
  
  updateEnvFile(updates);
  
  console.log('✅ Database connection will be skipped');
  console.log('ℹ️  You can set up the database later by running this script again');
  console.log('');
  console.log('🚀 You can now start the server with: npm run dev');
};

const testConnection = async (): Promise<void> => {
  console.log('');
  console.log('🔍 Testing database connection...');
  
  try {
    // Reload config to use new environment variables
    delete require.cache[require.resolve('../config/index')];
    await connectDB();
    
    console.log('');
    console.log('🎉 SUCCESS! Database connection established');
    console.log('');
    console.log('Next steps:');
    console.log('1. Import database schema: mysql -u user -p database < database-schema.sql');
    console.log('2. Start the server: npm run dev');
    console.log('3. Continue to Phase 6: Authentication System');
    
  } catch (error) {
    console.log('');
    console.log('❌ Database connection failed');
    console.log('');
    console.log('Error details:', error instanceof Error ? error.message : error);
    console.log('');
    console.log('Please check the DATABASE_CONNECTION_GUIDE.md for troubleshooting steps');
    
    const retry = await question('Would you like to try different credentials? (y/n): ');
    if (retry.toLowerCase() === 'y') {
      await setupDatabase();
    } else {
      console.log('');
      console.log('You can run this setup again later with: npm run setup-db');
      console.log('Or manually edit the .env file');
    }
  }
};

// Run the setup
setupDatabase()
  .then(() => {
    rl.close();
  })
  .catch((error) => {
    console.error('Setup failed:', error);
    rl.close();
    process.exit(1);
  });