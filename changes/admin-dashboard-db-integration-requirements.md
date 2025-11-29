# Admin Dashboard - Database Integration Requirements

## Overview
This document outlines all database integration requirements for the Admin Dashboard to be fully functional. It analyzes the current implementation and identifies gaps between the frontend, services, backend API, and database.

## Current Implementation Status

### ✅ Currently Implemented

#### 1. Admin Statistics (Stats Cards)
- **Frontend**: `AdminDashboardPage.tsx` lines 98-123
- **Hook**: `useAdminStats()` in `src/hooks/analytics.ts` lines 150-179
- **Service**: `analyticsService.getAdminStats()` in `src/services/analytics.service.ts` lines 93-96
- **API Endpoint**: `GET /analytics/admin/stats` in `backend/src/routes/analytics.ts` line 29
- **Controller**: `getAdminStats()` in `backend/src/controllers/analyticsController.ts` lines 245-320
- **Database Queries**:
  - Total users count from `users` table
  - Total properties count from `properties` table (excluding deleted)
  - Total bookings count from `bookings` table
  - Total revenue sum from `bookings` table (confirmed/completed only)
  - Pending properties count from `properties` table (status='pending')
  - User growth metrics (monthly comparison)

**Status**: ✅ FULLY INTEGRATED

#### 2. User Management
- **Frontend**: `AdminDashboardPage.tsx` lines 130-230
- **Hook**: `useAdminUsers()` in `src/hooks/analytics.ts` lines 182-225
- **Service**: `analyticsService.getAllUsers()` and `updateUserStatus()` in `src/services/analytics.service.ts` lines 98-117
- **API Endpoints**:
  - `GET /analytics/admin/users` in `backend/src/routes/analytics.ts` line 30
  - `PUT /analytics/admin/users/:userId/status` in `backend/src/routes/analytics.ts` line 31
- **Controllers**:
  - `getAllUsers()` in `backend/src/controllers/analyticsController.ts` lines 322-403
  - `updateUserStatus()` in `backend/src/controllers/analyticsController.ts` lines 405-453
- **Database Queries**:
  - Paginated user list from `users` table
  - Search by first_name, last_name, email
  - Update `is_active` field in `users` table

**Status**: ✅ FULLY INTEGRATED

**Features**:
- ✅ Pagination (page, limit)
- ✅ Search functionality
- ✅ User status updates (active/inactive/suspended)
- ✅ Display user details (name, email, role, status, join date)

#### 3. Property Approvals
- **Frontend**: `AdminDashboardPage.tsx` lines 232-291
- **Function**: `handleUpdatePropertyStatus()` lines 55-74
- **Service**: `propertiesService.updateProperty()` in `src/services/properties.service.ts` lines 159-167
- **API Endpoint**: `PUT /properties/:id` in `backend/src/routes/properties.ts` line 104
- **Controller**: `updateProperty()` in `backend/src/controllers/propertyController.ts`
- **Database Query**: Update `status` field in `properties` table

**Status**: ✅ FULLY INTEGRATED

**Features**:
- ✅ Display pending properties
- ✅ Approve property (set status to 'active')
- ✅ Reject property (set status to 'inactive')
- ✅ Show property details (image, title, host, location, price)

---

## ⚠️ Missing or Incomplete Features

### 1. Property Listing Filters/Search
**Current**: Frontend filters pending properties client-side: `properties.filter(prop => prop.status === 'pending')`

**Missing**:
- Server-side filtering by status
- Search by property title, host name, or location
- Sort options (date submitted, price, etc.)
- Pagination for pending properties

**Recommendation**:
Create dedicated admin endpoint: `GET /api/admin/properties` with query params:
- `status`: pending|active|inactive|suspended|draft
- `search`: string (property title, host name)
- `sortBy`: created_at|price_per_night|title
- `page`, `limit`: pagination

### 2. Property Detail View for Approval
**Current**: Only table view with limited property info

**Missing**:
- Full property detail modal/page for review before approval
- View all property images
- View complete property description
- View amenities list
- View host profile information
- Approval notes/reason field
- Rejection reason field (to notify host)

**Database Requirements**:
- Add `admin_notes` field to `properties` table
- Add `rejection_reason` field to `properties` table
- Create `property_status_history` table to track status changes:
  ```sql
  CREATE TABLE property_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    property_id INT NOT NULL,
    old_status ENUM('draft','pending','active','inactive','suspended'),
    new_status ENUM('draft','pending','active','inactive','suspended'),
    changed_by_user_id INT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
  );
  ```

### 3. User Management Enhancements

**Missing Features**:
- User role management (promote guest to host, assign admin)
- View user's bookings history
- View user's properties (for hosts)
- View user's reviews (given and received)
- Email verification status management
- Delete/permanently ban user
- User activity log

**Database Requirements**:
- Consider adding `banned_at` field to `users` table
- Consider adding `ban_reason` field to `users` table
- Create `user_activity_log` table:
  ```sql
  CREATE TABLE user_activity_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  ```

### 4. Booking Management
**Current**: No booking management in admin dashboard

**Missing**:
- View all bookings (all statuses)
- Filter bookings by status (pending/confirmed/cancelled/completed)
- Search bookings by guest, host, or property
- Cancel bookings on behalf of users
- Refund management
- Booking dispute resolution

**Required API Endpoints**:
- `GET /api/admin/bookings` - List all bookings with filters
- `PUT /api/admin/bookings/:id/status` - Update booking status
- `POST /api/admin/bookings/:id/refund` - Process refund
- `GET /api/admin/bookings/:id` - Get booking details

**Database Queries Needed**:
- Query all bookings across all users
- Update booking status (requires admin notes)
- Create refund records

### 5. Revenue and Financial Analytics
**Current**: Only shows total revenue in stats

**Missing**:
- Revenue breakdown by period (daily/weekly/monthly/yearly)
- Revenue by property type
- Revenue by location
- Commission calculations
- Payout management for hosts
- Transaction history
- Financial reports export

**Required API Endpoints**:
- `GET /api/admin/analytics/revenue` - Revenue analytics
- `GET /api/admin/analytics/transactions` - Transaction history
- `GET /api/admin/payouts` - Host payout management

**Database Requirements**:
- Create `transactions` table:
  ```sql
  CREATE TABLE transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT,
    user_id INT NOT NULL,
    transaction_type ENUM('booking','refund','payout','fee','commission') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status ENUM('pending','completed','failed','cancelled') NOT NULL,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  ```

- Create `host_payouts` table:
  ```sql
  CREATE TABLE host_payouts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    host_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status ENUM('pending','processing','completed','failed') NOT NULL,
    payout_method VARCHAR(50),
    payout_reference VARCHAR(255),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    bookings_included JSON,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (host_id) REFERENCES users(id)
  );
  ```

### 6. Review Moderation
**Current**: No review management

**Missing**:
- View all reviews
- Flag/moderate inappropriate reviews
- Delete/hide reviews
- Respond to flagged reviews
- Review dispute resolution

**Required API Endpoints**:
- `GET /api/admin/reviews` - List all reviews with filters
- `PUT /api/admin/reviews/:id/moderate` - Moderate review
- `DELETE /api/admin/reviews/:id` - Delete review
- `GET /api/admin/reviews/flagged` - Get flagged reviews

**Database Requirements**:
- Add `is_flagged` field to `reviews` table
- Add `flag_reason` field to `reviews` table
- Add `admin_action` field to `reviews` table
- Add `moderated_by` field to `reviews` table (references users.id)
- Add `moderated_at` field to `reviews` table

### 7. Amenity Management
**Current**: No amenity CRUD in admin dashboard

**Missing**:
- Create new amenities
- Edit existing amenities
- Activate/deactivate amenities
- View amenity usage statistics

**Required API Endpoints**:
- `GET /api/admin/amenities` - List all amenities
- `POST /api/admin/amenities` - Create amenity
- `PUT /api/admin/amenities/:id` - Update amenity
- `DELETE /api/admin/amenities/:id` - Delete/deactivate amenity

**Database Queries Needed**:
- CRUD operations on `amenities` table
- Query to count properties using each amenity

### 8. Platform Settings
**Current**: No settings management

**Missing**:
- Platform commission rate settings
- Cancellation policy settings
- Email template management
- Feature flags
- Maintenance mode toggle

**Database Requirements**:
- Create `platform_settings` table:
  ```sql
  CREATE TABLE platform_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type ENUM('string','number','boolean','json') NOT NULL,
    description TEXT,
    updated_by_user_id INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
  );
  ```

### 9. Messaging/Support System
**Current**: No admin messaging interface

**Missing**:
- View all user messages/inquiries
- Respond to support tickets
- Flag/moderate inappropriate messages

**Database Requirements**:
- Extend `messages` table or create `support_tickets` table

### 10. Reports and Exports
**Current**: No reporting functionality

**Missing**:
- Generate PDF/CSV reports
- Export user data (GDPR compliance)
- Export booking data
- Export financial data
- Scheduled reports

**Required API Endpoints**:
- `GET /api/admin/reports/users` - User report
- `GET /api/admin/reports/bookings` - Booking report
- `GET /api/admin/reports/revenue` - Revenue report
- `POST /api/admin/exports` - Trigger data export

### 11. Activity Dashboard/Logs
**Current**: No activity monitoring

**Missing**:
- Real-time activity feed
- Admin action logs
- System health monitoring
- Error logs viewer

**Database Requirements**:
- `admin_actions_log` table (track all admin actions)
- `system_logs` table (optional)

---

## Summary of Database Schema Changes Needed

### New Tables Required:
1. ✅ `property_status_history` - Track property approval/rejection history
2. ✅ `user_activity_log` - Track user actions for admin review
3. ✅ `transactions` - Track all financial transactions
4. ✅ `host_payouts` - Manage host payout schedules
5. ✅ `platform_settings` - Store platform configuration
6. ✅ `admin_actions_log` - Track admin user actions

### Existing Table Modifications:
1. **properties** table:
   - Add `admin_notes` TEXT
   - Add `rejection_reason` TEXT
   - Add `approved_by_user_id` INT (FK to users.id)
   - Add `approved_at` TIMESTAMP

2. **users** table:
   - Add `banned_at` TIMESTAMP NULL
   - Add `ban_reason` TEXT
   - Add `account_status` ENUM('active','suspended','banned','deleted') (alternative to is_active)

3. **reviews** table:
   - Add `is_flagged` BOOLEAN DEFAULT FALSE
   - Add `flag_reason` TEXT
   - Add `admin_action` ENUM('none','approved','hidden','deleted')
   - Add `moderated_by_user_id` INT (FK to users.id)
   - Add `moderated_at` TIMESTAMP NULL

4. **bookings** table:
   - Add `admin_notes` TEXT
   - Add `cancelled_by_admin_id` INT (FK to users.id)
   - Add `refund_status` ENUM('none','requested','processing','completed','failed')
   - Add `refund_amount` DECIMAL(10,2)

---

## Priority Implementation Order

### Phase 1 - Critical (Immediate)
1. ✅ Property approval workflow (COMPLETE)
2. ✅ User status management (COMPLETE)
3. Property status history tracking
4. Property approval notes/rejection reasons

### Phase 2 - High Priority
1. Booking management interface
2. Financial transaction tracking
3. Revenue analytics and reporting
4. Property detail view for approval

### Phase 3 - Medium Priority
1. Review moderation
2. Amenity management
3. User role management
4. Enhanced user details view

### Phase 4 - Lower Priority
1. Platform settings management
2. Support ticket system
3. Activity logs and monitoring
4. Report generation and exports

---

## API Endpoint Summary - What's Missing

### Needed Admin Endpoints:

#### Property Management
- `GET /api/admin/properties` - Admin property list with filters
- `GET /api/admin/properties/:id/history` - Property status history
- `PUT /api/admin/properties/:id/approve` - Approve with notes
- `PUT /api/admin/properties/:id/reject` - Reject with reason

#### Booking Management
- `GET /api/admin/bookings` - All bookings with filters
- `PUT /api/admin/bookings/:id/cancel` - Cancel booking (admin)
- `POST /api/admin/bookings/:id/refund` - Process refund

#### Financial Management
- `GET /api/admin/analytics/revenue` - Revenue breakdown
- `GET /api/admin/transactions` - Transaction history
- `GET /api/admin/payouts` - Payout management
- `POST /api/admin/payouts/:id/process` - Process payout

#### Review Management
- `GET /api/admin/reviews` - All reviews with filters
- `GET /api/admin/reviews/flagged` - Flagged reviews
- `PUT /api/admin/reviews/:id/moderate` - Moderate review
- `DELETE /api/admin/reviews/:id` - Delete review

#### Amenity Management
- `GET /api/admin/amenities` - All amenities
- `POST /api/admin/amenities` - Create amenity
- `PUT /api/admin/amenities/:id` - Update amenity
- `DELETE /api/admin/amenities/:id` - Delete amenity

#### Settings Management
- `GET /api/admin/settings` - Platform settings
- `PUT /api/admin/settings` - Update settings

#### Reports
- `GET /api/admin/reports/users` - User report
- `GET /api/admin/reports/bookings` - Booking report
- `GET /api/admin/reports/revenue` - Revenue report
- `POST /api/admin/exports/:type` - Trigger data export

---

## Security Considerations

### Current Implementation
- ✅ Admin role check via `requireAdmin` middleware
- ✅ JWT authentication via `authenticateToken` middleware
- ✅ Role-based access control

### Needed Enhancements
1. Audit logging for all admin actions
2. Rate limiting on admin endpoints
3. IP whitelisting for admin access (optional)
4. Two-factor authentication for admin users
5. Session timeout for admin users
6. Admin activity notifications
7. Sensitive data masking in logs

---

## Testing Requirements

### Unit Tests Needed
1. Admin statistics calculations
2. Property approval/rejection logic
3. User status update logic
4. Financial calculations
5. Permission checks

### Integration Tests Needed
1. Complete property approval workflow
2. User management workflows
3. Booking management workflows
4. Financial transaction workflows
5. Report generation

### End-to-End Tests Needed
1. Admin login and access control
2. Complete property approval flow
3. User suspension/activation flow
4. Booking cancellation and refund flow

---

## Documentation Needed

1. Admin API documentation (Swagger/OpenAPI)
2. Database schema documentation
3. Admin user guide
4. Security and compliance documentation
5. Backup and recovery procedures
6. Data retention policies

---

## Conclusion

The Admin Dashboard currently has **basic functionality** for:
- ✅ Viewing platform statistics
- ✅ Managing users (list, search, status updates)
- ✅ Approving/rejecting properties

**Major gaps** that need database integration:
1. Booking management (high priority)
2. Financial tracking and analytics (high priority)
3. Review moderation (medium priority)
4. Enhanced property approval workflow (medium priority)
5. Amenity management (medium priority)
6. Platform settings (low priority)
7. Reporting and exports (low priority)

**Estimated effort**:
- Phase 1: 2-3 weeks
- Phase 2: 3-4 weeks
- Phase 3: 2-3 weeks
- Phase 4: 2-3 weeks

**Total**: Approximately 9-13 weeks for full admin dashboard integration