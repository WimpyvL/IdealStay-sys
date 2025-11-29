// Backend Types - Aligned with database schema

export interface User {
  id: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone?: string;
  date_of_birth?: string;
  profile_image_url?: string;
  role: 'guest' | 'host' | 'admin';
  is_verified: boolean;
  is_host: boolean;
  host_approved: boolean;
  host_rating: number;
  host_total_reviews: number;
  created_at: string;
  updated_at: string;
}

export interface Property {
  property_id: number;
  host_id: number;
  title: string;
  description: string;
  type: 'apartment' | 'house' | 'villa' | 'condo' | 'cabin' | 'other';
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  price_per_night: number;
  currency: string;
  amenities?: string;
  house_rules?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PropertyImage {
  image_id: number;
  property_id: number;
  image_url: string;
  image_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface Booking {
  booking_id: number;
  property_id: number;
  guest_id: number;
  check_in_date: string;
  check_out_date: string;
  total_guests: number;
  total_amount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  special_requests?: string;
  created_at: string;
  updated_at: string;
}

export interface Review {
  review_id: number;
  booking_id: number;
  reviewer_id: number;
  reviewee_id: number;
  rating: number;
  comment?: string;
  review_type: 'guest_to_host' | 'host_to_guest';
  created_at: string;
  updated_at: string;
}

export interface Message {
  message_id: number;
  booking_id?: number;
  sender_id: number;
  recipient_id: number;
  message_text: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  notification_id: number;
  user_id: number;
  type: 'booking' | 'payment' | 'review' | 'message' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Payment {
  payment_id: number;
  booking_id: number;
  amount: number;
  currency: string;
  payment_method: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_date?: string;
  transaction_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Availability {
  availability_id: number;
  property_id: number;
  date: string;
  is_available: boolean;
  price_override?: number;
  minimum_stay?: number;
  created_at: string;
  updated_at: string;
}

// API Response Types
export interface ApiResponse<T = void> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface LoginResponse {
  user: Omit<User, 'password_hash'>;
  token: string;
  expiresIn: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// JWT Token Payload
export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}