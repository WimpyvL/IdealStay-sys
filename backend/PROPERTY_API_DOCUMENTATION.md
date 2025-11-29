# Property Management API - Phase 7 Documentation

## 🎯 Overview

Phase 7 implements comprehensive property management functionality for the Ideal Stay platform, including:

- **Full CRUD operations** for properties
- **Advanced search and filtering** with multiple criteria
- **Image upload and management** system
- **Amenity management** and assignment
- **Property status workflow** (draft → pending → active)
- **Role-based access control** (guests, hosts, admins)

## 🛡️ Authentication & Authorization

### Roles
- **Guest**: Can view properties and amenities
- **Host**: Can manage their own properties + guest permissions
- **Admin**: Can manage all properties and amenities + host permissions

### Authentication Headers
```
Authorization: Bearer <jwt_token>
```

## 🏠 Property Endpoints

### Public Endpoints (No Authentication Required)

#### `GET /api/v1/properties`
Search and filter properties with advanced query parameters.

**Query Parameters:**
- `location` - City, address, or country search
- `checkIn` - Check-in date (YYYY-MM-DD)
- `checkOut` - Check-out date (YYYY-MM-DD)
- `guests` - Number of guests
- `minPrice` - Minimum price per night
- `maxPrice` - Maximum price per night
- `propertyType` - apartment|house|villa|cabin|cottage|condo|townhouse|other
- `amenities` - Comma-separated amenity IDs (e.g., "1,2,5")
- `bedrooms` - Minimum bedrooms
- `bathrooms` - Minimum bathrooms
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 12, max: 50)
- `sortBy` - price_per_night|average_rating|created_at (default: created_at)
- `sortOrder` - asc|desc (default: desc)

**Example:**
```
GET /api/v1/properties?location=New York&guests=2&minPrice=50&maxPrice=200&amenities=1,3,5
```

**Response:**
```json
{
  "success": true,
  "data": {
    "properties": [...],
    "pagination": {
      "page": 1,
      "limit": 12,
      "total": 45,
      "totalPages": 4,
      "hasNext": true,
      "hasPrev": false
    },
    "filters": {
      "location": "New York",
      "guests": 2,
      ...
    }
  }
}
```

#### `GET /api/v1/properties/:id`
Get detailed property information including host details, amenities, and recent reviews.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Cozy Downtown Apartment",
    "description": "...",
    "images": [...],
    "amenities": [...],
    "reviews": [...],
    "host": {
      "first_name": "John",
      "last_name": "Doe",
      "host_rating": 4.8,
      ...
    }
  }
}
```

#### `GET /api/v1/properties/:id/images`
Get all images for a property.

#### `GET /api/v1/properties/:propertyId/amenities`
Get amenities for a specific property.

### Protected Endpoints (Authentication Required)

#### `POST /api/v1/properties`
Create a new property (Hosts & Admins only).

**Request Body:**
```json
{
  "title": "Amazing Beach House",
  "description": "Beautiful property with ocean view...",
  "property_type": "house",
  "address": "123 Ocean Drive",
  "city": "Miami",
  "state": "FL",
  "country": "USA",
  "max_guests": 8,
  "bedrooms": 4,
  "bathrooms": 3,
  "beds": 6,
  "price_per_night": 299.99,
  "cleaning_fee": 50,
  "security_deposit": 200,
  "min_nights": 2,
  "max_nights": 14,
  "check_in_time": "15:00:00",
  "check_out_time": "11:00:00",
  "advance_booking_days": 365,
  "is_instant_book": true,
  "amenity_ids": [1, 2, 5, 8]
}
```

#### `PUT /api/v1/properties/:id`
Update property details (Host of property or Admin).

#### `DELETE /api/v1/properties/:id`
Soft delete property (Host of property or Admin).

#### `GET /api/v1/properties/host/my-properties`
Get current host's properties with optional status filter.

**Query Parameters:**
- `status` - draft|pending|active|inactive
- `page` - Page number
- `limit` - Results per page

## 📸 Image Management Endpoints

#### `POST /api/v1/properties/:id/images`
Upload images for a property (Host/Admin only).

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `images` - File array (up to 10 files, 5MB each)
- `isPrimary` - Boolean (set first image as primary)
- `altText` - String (alt text for images)

**File Constraints:**
- **Formats:** JPEG, PNG, WebP
- **Size:** 5MB maximum per file
- **Quantity:** 10 files per upload, 20 total per property

#### `PUT /api/v1/properties/:id/images/:imageId`
Update image details (alt text, display order, primary status).

#### `DELETE /api/v1/properties/:id/images/:imageId`
Delete a property image.

#### `PUT /api/v1/properties/:id/images/reorder`
Reorder property images.

**Request Body:**
```json
{
  "imageOrders": [
    {"id": 1, "display_order": 1},
    {"id": 2, "display_order": 2}
  ]
}
```

## 🏷️ Amenity Management Endpoints

### Public Amenity Endpoints

#### `GET /api/v1/amenities`
Get all available amenities.

**Query Parameters:**
- `category` - basic|safety|luxury|outdoor|family
- `active_only` - true|false (default: true)

**Response:**
```json
{
  "success": true,
  "data": {
    "amenities": [...],
    "grouped": {
      "basic": [...],
      "safety": [...],
      "luxury": [...]
    },
    "categories": ["basic", "safety", "luxury"],
    "total": 25
  }
}
```

### Property Amenity Assignment

#### `PUT /api/v1/properties/:propertyId/amenities`
Assign amenities to a property (Host/Admin only).

**Request Body:**
```json
{
  "amenity_ids": [1, 3, 5, 8, 12]
}
```

### Admin Amenity Management

#### `POST /api/v1/amenities`
Create new amenity (Admin only).

#### `PUT /api/v1/amenities/:id`
Update amenity (Admin only).

#### `DELETE /api/v1/amenities/:id`
Delete/deactivate amenity (Admin only).

#### `GET /api/v1/amenities/stats`
Get amenity usage statistics (Admin only).

## 🔄 Property Status Workflow

Properties have the following status progression:

1. **Draft** - Newly created, not visible to guests
2. **Pending** - Submitted for review (future: admin approval)
3. **Active** - Live and bookable
4. **Inactive** - Hidden from search, not bookable
5. **Suspended** - Administratively suspended

## 📁 File Upload Structure

Images are stored in:
```
uploads/
└── properties/
    ├── uuid-1.jpg
    ├── uuid-2.png
    └── uuid-3.webp
```

URLs are served as: `/uploads/properties/uuid-1.jpg`

## ⚠️ Error Responses

All endpoints follow consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Development details (only in dev mode)"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `413` - Payload Too Large (file size exceeded)
- `500` - Internal Server Error

## 🧪 Testing the API

### Using the Test Script
```powershell
# Run the comprehensive test suite
./test-phase7.ps1
```

### Manual Testing Examples

1. **Search Properties:**
```bash
curl -X GET "http://localhost:5000/api/v1/properties?location=Miami&guests=4"
```

2. **Get Amenities:**
```bash
curl -X GET "http://localhost:5000/api/v1/amenities"
```

3. **Create Property (with auth):**
```bash
curl -X POST "http://localhost:5000/api/v1/properties" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Property","property_type":"apartment",...}'
```

## 🎯 Implementation Highlights

### Advanced Search Features
- **Location Search** - Searches city, address, and country fields
- **Availability Filter** - Excludes properties with conflicting bookings
- **Multi-Amenity Filter** - Properties must have ALL specified amenities
- **Price Range** - Flexible min/max pricing
- **Guest Capacity** - Ensures property can accommodate party size
- **Sorting Options** - Price, rating, or recency

### Security Features
- **Role-based Access Control** - Granular permissions
- **Owner Verification** - Hosts can only manage their properties
- **File Validation** - Image type and size restrictions
- **Rate Limiting** - Built into Express app
- **SQL Injection Protection** - Parameterized queries

### Performance Optimizations
- **Pagination** - Prevents large data sets
- **Indexed Queries** - Database indexes on search fields
- **Efficient Joins** - Minimal database calls
- **Image Optimization** - Size and format restrictions

### Data Integrity
- **Foreign Key Constraints** - Referential integrity
- **Transaction Safety** - Atomic operations
- **Soft Deletes** - Preserves booking history
- **Validation** - Comprehensive input validation

## 🔗 Related Documentation

- [Database Schema](../DATABASE_DOCUMENTATION.md)
- [Authentication System](./auth-system.md)
- [Backend Integration Process](../BACKEND_INTEGRATION_PROCESS.md)
- [API Configuration](./api-config.md)

---

**Phase 7 Status:** ✅ **COMPLETED**
**Next Phase:** Phase 8 - Booking System APIs