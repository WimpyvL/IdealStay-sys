# Ideal Stay V3 - Backend API

🏡 **Premium vacation rental platform backend** built with Node.js, Express, TypeScript, and MySQL.

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ 
- MySQL 8.0+
- cPanel hosting account (for production)

### **Installation**

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env with your database credentials
   # Update the following variables:
   # DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
   # JWT_SECRET (generate a strong random string)
   ```

4. **Database Setup**
   ```bash
   # Run the database schema (in MySQL)
   mysql -u your_username -p your_database < ../database-schema.sql
   
   # Verify with test script
   mysql -u your_username -p your_database < ../database-test.sql
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📋 **Available Scripts**

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## 🏗️ **Project Structure**

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── index.ts     # Main config
│   │   └── database.ts  # Database connection
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   │   ├── errorHandler.ts
│   │   └── notFound.ts
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   │   ├── auth.ts      # Authentication routes
│   │   ├── properties.ts # Property management
│   │   ├── bookings.ts  # Booking system
│   │   └── ...
│   ├── utils/           # Utility functions
│   ├── app.ts          # Express app configuration
│   └── server.ts       # Server entry point
├── uploads/            # File upload directory
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🔌 **API Endpoints**

### **Health & Status**
- `GET /health` - Health check
- `GET /` - Welcome message

### **Authentication** (Phase 6)
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/me` - Get current user

### **Properties** (Phase 7)
- `GET /api/v1/properties` - Search/list properties
- `GET /api/v1/properties/:id` - Get single property
- `POST /api/v1/properties` - Create property (hosts only)
- `PUT /api/v1/properties/:id` - Update property

### **Bookings** (Phase 8)
- `GET /api/v1/bookings` - Get user bookings
- `POST /api/v1/bookings` - Create booking
- `PUT /api/v1/bookings/:id/status` - Update booking status

## 🔧 **Environment Variables**

### **Required**
```env
# Database
DB_HOST=your_cpanel_host
DB_USER=your_cpanel_username  
DB_PASSWORD=your_cpanel_password
DB_NAME=your_database_name

# JWT
JWT_SECRET=your_super_secure_secret_key
```

### **Optional**
```env
# Server
PORT=3001
NODE_ENV=development

# Email (for verification)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Email / SMTP (Optional but recommended for verification)
```env
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_SECURE=false
EMAIL_FROM="IdealStay <no-reply@yourdomain>"
FRONTEND_BASE_URL=http://localhost:3000
```

If SMTP variables are omitted, the system gracefully logs verification links to the console in development so you can test without a mail server.

## 📨 Email Verification Flow

1. User registers → backend stores `verification_token` & `is_verified = 0` and sends email.
2. User clicks link: `GET /api/v1/auth/verify/:token` → marks account verified.
3. Frontend may call `GET /api/v1/auth/validate` on load to refresh auth state.
4. If link expired/invalid, user can resend via `POST /api/v1/auth/resend-verification` `{ email }`.

Endpoints introduced:
| Method | Path | Purpose |
|-------|------|---------|
| POST | /api/v1/auth/register | Register user (unverified) |
| GET | /api/v1/auth/verify/:token | Verify email token |
| POST | /api/v1/auth/resend-verification | Resend verification email |
| GET | /api/v1/auth/validate | Validate token & return user |

## 🧭 Path Aliases (TypeScript)

To keep imports clean and avoid brittle relative paths, the backend uses path aliases defined in `tsconfig.json`:

```jsonc
"baseUrl": "./src",
"paths": {
   "@/*": ["./*"],
   "@/config/*": ["./config/*"],
   "@/controllers/*": ["./controllers/*"],
   "@/middleware/*": ["./middleware/*"],
   "@/models/*": ["./models/*"],
   "@/routes/*": ["./routes/*"],
   "@/utils/*": ["./utils/*"]
}
```

Example usage:
```ts
import { sendVerificationEmail } from '@/utils/email';
import { authenticateToken } from '@/middleware/auth';
```

Avoid deep `../../..` relative imports—use the alias instead. If your editor complains, ensure it is using the workspace TypeScript version and restart the TS server.


## 🛡️ **Security Features**

- ✅ **JWT Authentication** - Secure user sessions
- ✅ **Password Hashing** - bcrypt with salt rounds
- ✅ **Rate Limiting** - Prevent API abuse
- ✅ **CORS Protection** - Configured origins
- ✅ **Helmet Security** - HTTP headers protection
- ✅ **Input Validation** - Zod schema validation
- ✅ **SQL Injection Prevention** - Parameterized queries

## 🎯 **Development Status**

### **✅ Completed Phases**
- [x] **Phase 1**: Database Schema Design
- [x] **Phase 2**: TypeScript Type Alignment  
- [x] **Phase 3**: Process Documentation
- [x] **Phase 4**: Backend API Setup

### **🚧 Next Phases**
- [ ] **Phase 5**: Database Connection Setup
- [ ] **Phase 6**: Authentication System
- [ ] **Phase 7**: Property Management APIs
- [ ] **Phase 8**: Booking System APIs

## 🚀 **Deployment (cPanel)**

1. **Upload Files**
   ```bash
   # Build the project
   npm run build
   
   # Upload dist/ folder to your cPanel
   ```

2. **Configure Node.js App** (in cPanel)
   - App Root: `/path/to/your/app`
   - App URL: `your-domain.com/api`
   - App Startup File: `dist/server.js`

3. **Environment Variables** (in cPanel)
   - Set all production environment variables
   - Update database credentials for production

4. **Database Setup**
   - Import schema to production database
   - Update connection credentials

## 🔍 **Testing**

```bash
# Health check
curl http://localhost:3001/health

# API status
curl http://localhost:3001/api/v1/auth

# With authentication (after Phase 6)
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/v1/properties
```

## 📚 **Documentation**

- [Database Schema](../DATABASE_DOCUMENTATION.md)
- [Integration Process](../BACKEND_INTEGRATION_PROCESS.md)
- [TypeScript Types](../types.ts)

## 🐛 **Troubleshooting**

### **Database Connection Issues**
```bash
# Check MySQL is running
mysql -u root -p

# Test connection
npm run dev
# Look for "✅ Database connected successfully"
```

### **Port Already in Use**
```bash
# Change port in .env
PORT=3002

# Or kill process using port 3001
npx kill-port 3001
```

### **Permission Issues (cPanel)**
```bash
# Ensure proper file permissions
chmod 755 dist/
chmod 644 dist/*
```

## 🤝 **Contributing**

1. Follow TypeScript strict mode
2. Use the exact types from `../types.ts`
3. Update process documentation after each phase
4. Test all endpoints before deployment

---

**Built with ❤️ for the best vacation rental platform in the world! 🏆**