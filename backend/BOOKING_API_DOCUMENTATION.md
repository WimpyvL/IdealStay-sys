# Booking System API - Phase 8 Documentation

## 🎯 Overview

Phase 8 implements the complete booking system for Ideal Stay, including:

- **Advanced availability checking** with conflict prevention
- **Complete booking lifecycle** (pending → confirmed → completed/cancelled)
- **Payment status tracking** with audit trails  
- **Role-based booking management** for guests, hosts, and admins
- **Refund processing system** for cancellations
- **Financial reporting** and breakdown
- **Booking conflict prevention** with date validation

## 🏨 Booking Workflow

### Booking Statuses
1. **Pending** - Awaiting host approval (non-instant book)
2. **Confirmed** - Approved and ready (instant book or host approved)
3. **Completed** - Guest stay finished successfully
4. **Cancelled** - Booking cancelled by guest, host, or admin
5. **Refunded** - Cancellation with processed refund

### Payment Statuses
1. **Pending** - Payment not yet processed
2. **Paid** - Full payment received
3. **Partial** - Partial payment received
4. **Failed** - Payment processing failed
5. **Refunded** - Payment refunded (full or partial)

## 🔍 Availability Checking

### `GET /api/v1/bookings/properties/:id/availability`

Check if a property is available for specific dates with comprehensive validation.

**Query Parameters:**
- `check_in_date` - YYYY-MM-DD format (required)
- `check_out_date` - YYYY-MM-DD format (required)
- `guests_count` - Number of guests (optional, default: 1)

**Validation Rules:**
- Check-out must be after check-in
- Dates cannot be in the past
- Guest count cannot exceed property capacity
- Respects min/max night restrictions
- Respects advance booking limits
- Prevents double-booking conflicts

**Example Request:**
```
GET /api/v1/bookings/properties/123/availability?check_in_date=2024-03-15&check_out_date=2024-03-18&guests_count=4
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "available": true,
    "property": {
      "id": 123,
      "title": "Beachfront Villa",
      "max_guests": 8,
      "is_instant_book": true
    },
    "booking_details": {
      "check_in_date": "2024-03-15",
      "check_out_date": "2024-03-18",
      "guests_count": 4,
      "nights": 3,
      "pricing": {
        "base_price": 600.00,
        "cleaning_fee": 75.00,
        "security_deposit": 200.00,
        "taxes": 81.00,
        "total_amount": 956.00
      }
    }
  }
}
```

**Error Response (Unavailable):**
```json
{
  "success": false,
  "message": "Property is not available for the selected dates"
}
```

## 📝 Booking Management

### `POST /api/v1/bookings` - Create Booking

Create a new booking (authenticated guests only).

**Authentication:** Required (Guest or Admin role)

**Request Body:**
```json
{
  "property_id": 123,
  "check_in_date": "2024-03-15",
  "check_out_date": "2024-03-18",
  "guests_count": 4,
  "special_requests": "Late check-in requested",
  "payment_method": "credit_card"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking created and pending approval",
  "data": {
    "booking": {
      "id": 456,
      "property_id": 123,
      "status": "pending",
      "payment_status": "pending",
      "total_amount": 956.00,
      ...
    },
    "next_steps": "Your booking request has been sent to the host for approval."
  }
}
```

### `GET /api/v1/bookings` - Get User Bookings

Retrieve bookings with role-based filtering.

**Authentication:** Required

**Query Parameters:**
- `status` - Filter by booking status
- `property_id` - Filter by property (admin/host only)
- `guest_id` - Filter by guest (admin only)
- `host_id` - Filter by host (admin only)
- `start_date` - Filter by check-in date
- `end_date` - Filter by check-out date
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 10, max: 50)

**Role Permissions:**
- **Guest**: Only their own bookings
- **Host**: Their property bookings + their own guest bookings
- **Admin**: All bookings with optional filters

### `GET /api/v1/bookings/:id` - Get Booking Details

Get detailed booking information with permissions check.

**Response Includes:**
- Complete booking information
- Property details and images
- Guest and host information
- Payment status and history
- User permissions for actions
- Any reviews associated with booking

### `PUT /api/v1/bookings/:id/status` - Update Status

Update booking status (hosts and admins only).

**Authentication:** Host of property or Admin

**Request Body:**
```json
{
  "status": "confirmed",
  "host_notes": "Welcome! Check-in instructions sent via email."
}
```

**Valid Status Transitions:**
- `pending` → `confirmed`, `cancelled`
- `confirmed` → `completed`, `cancelled`
- `cancelled` → `refunded` (admin only)

### `POST /api/v1/bookings/:id/cancel` - Cancel Booking

Cancel a booking with reason tracking.

**Authentication:** Guest, Host, or Admin

**Request Body:**
```json
{
  "cancellation_reason": "Travel plans changed due to emergency"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "booking": {...},
    "cancelled_by": "guest",
    "cancellation_info": "Refund processing will be handled according to the cancellation policy"
  }
}
```

## 💳 Payment Management

### `PUT /api/v1/bookings/:id/payment` - Update Payment Status

Update payment status with audit trail.

**Authentication:** Guest, Host, or Admin

**Request Body:**
```json
{
  "payment_status": "paid",
  "payment_method": "stripe",
  "payment_reference": "pi_1234567890",
  "payment_notes": "Payment processed successfully via Stripe"
}
```

**Auto-Confirmation:** If payment status becomes "paid" and booking is "pending", automatically confirms the booking.

### `GET /api/v1/bookings/:id/payment/history` - Payment History

Get complete payment status change history.

**Response:**
```json
{
  "success": true,
  "data": {
    "booking_id": 456,
    "payment_history": [
      {
        "id": 1,
        "previous_status": "pending",
        "new_status": "paid",
        "payment_method": "stripe",
        "payment_reference": "pi_1234567890",
        "updated_by": "John Doe",
        "updated_by_role": "guest",
        "created_at": "2024-03-14T10:30:00Z"
      }
    ],
    "total_records": 1
  }
}
```

### `POST /api/v1/bookings/:id/refund` - Process Refund

Process refunds with administrative oversight (admin only).

**Authentication:** Admin only

**Request Body:**
```json
{
  "refund_amount": 956.00,
  "refund_reason": "Host cancellation within 24 hours",
  "refund_method": "original_payment"
}
```

**Features:**
- Full or partial refunds
- Automatic status updates
- Audit trail maintenance
- Refund history tracking

### `GET /api/v1/bookings/:id/financials` - Financial Summary

Get detailed financial breakdown for a booking.

**Authentication:** Guest, Host, or Admin (involved parties only)

**Response:**
```json
{
  "success": true,
  "data": {
    "booking_id": 456,
    "financial_summary": {
      "base_price": 600.00,
      "cleaning_fee": 75.00,
      "security_deposit": 200.00,
      "taxes": 81.00,
      "total_amount": 956.00,
      "total_refunded": 0.00,
      "net_amount": 956.00,
      "platform_fee": 18.00,
      "host_payout": 582.00
    },
    "payment_info": {
      "status": "paid",
      "method": "stripe",
      "reference": "pi_1234567890"
    },
    "refunds": [],
    "calculated_at": "2024-03-14T15:45:00Z"
  }
}
```

## 🛡️ Security Features

### Role-Based Access Control
- **Guests**: Can create bookings, view their own, cancel their bookings
- **Hosts**: Can manage bookings for their properties, update statuses
- **Admins**: Full access to all bookings, refund processing

### Conflict Prevention
- **Database-level conflict checking**: Prevents double bookings
- **Date validation**: Ensures logical date ranges
- **Capacity validation**: Respects property guest limits
- **Status transition validation**: Prevents invalid status changes

### Audit Trails
- **Payment history**: Complete log of payment changes
- **Refund tracking**: Full refund processing history
- **User attribution**: Tracks who made each change
- **Timestamp tracking**: Precise change timing

## 🧪 Testing the Booking System

### Automated Test Script
```powershell
# Run comprehensive test suite
./test-phase8.ps1
```

### Manual Testing Scenarios

1. **Availability Checking:**
```bash
# Valid availability check
curl "http://localhost:5000/api/v1/bookings/properties/1/availability?check_in_date=2024-04-01&check_out_date=2024-04-05&guests_count=2"

# Invalid dates (should fail)
curl "http://localhost:5000/api/v1/bookings/properties/1/availability?check_in_date=2023-01-01&check_out_date=2023-01-02"
```

2. **Booking Creation (with auth):**
```bash
curl -X POST "http://localhost:5000/api/v1/bookings" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": 1,
    "check_in_date": "2024-04-01",
    "check_out_date": "2024-04-05",
    "guests_count": 2,
    "special_requests": "Late check-in please"
  }'
```

3. **Payment Status Update:**
```bash
curl -X PUT "http://localhost:5000/api/v1/bookings/1/payment" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_status": "paid",
    "payment_method": "stripe",
    "payment_reference": "pi_1234567890"
  }'
```

## 💾 Database Schema Extensions

Phase 8 adds these tables to support booking functionality:

```sql
-- Payment history tracking
CREATE TABLE payment_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    previous_status ENUM(...),
    new_status ENUM(...),
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    updated_by INT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ...
);

-- Refund processing
CREATE TABLE refunds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    refund_amount DECIMAL(10, 2) NOT NULL,
    refund_reason TEXT,
    refund_method VARCHAR(50),
    processed_by INT NOT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ...
);
```

Run `database-phase8-extensions.sql` to add these tables.

## ⚡ Performance Optimizations

### Database Indexes
- `idx_bookings_property_dates` - Fast availability checking
- `idx_bookings_guest_status` - Quick user booking lookups  
- `idx_bookings_host_status` - Host booking management
- `idx_bookings_payment_status` - Payment filtering
- `idx_bookings_dates` - Date range queries

### Query Optimizations
- **Efficient conflict detection**: Optimized overlap queries
- **Pagination**: Prevents large data sets
- **Role-based filtering**: Reduces data transfer
- **Selective joins**: Only necessary data included

## 🚨 Error Handling

All endpoints provide consistent error responses:

```json
{
  "success": false,
  "message": "Human-readable error description",
  "error": "Technical details (development only)"
}
```

**Common Error Scenarios:**
- **400**: Validation errors, date conflicts, capacity exceeded
- **401**: Authentication required
- **403**: Insufficient permissions
- **404**: Booking/property not found
- **409**: Booking conflicts, status transition errors

## 🔗 Integration Points

### Payment Processors
- **Flexible payment method tracking**
- **Reference number storage**
- **Status webhooks support**
- **Refund processing hooks**

### Notification Systems
- **Booking status changes**
- **Payment confirmations**
- **Cancellation notifications**
- **Host approval requests**

### Calendar Systems
- **Availability export**
- **Booking synchronization**
- **Conflict prevention**

---

**Phase 8 Status:** ✅ **COMPLETED**
**Next Phase:** Phase 9 - Frontend Integration

The booking system provides a complete, secure, and scalable foundation for managing vacation rental bookings with advanced conflict prevention and comprehensive payment tracking.