export type UserRole = 'guest' | 'host' | 'admin';
export interface User {
    id: number;
    email: string;
    password_hash?: string;
    first_name: string;
    last_name: string;
    phone?: string;
    profile_image_url?: string;
    date_of_birth?: string;
    role: UserRole;
    is_verified: boolean;
    verification_token?: string;
    is_host: boolean;
    host_approved: boolean;
    host_rating: number;
    host_total_reviews: number;
    guest_rating: number;
    guest_total_reviews: number;
    is_active: boolean;
    last_login?: string;
    created_at: string;
    updated_at: string;
}
export type AddressType = 'home' | 'billing' | 'other';
export interface UserAddress {
    id: number;
    user_id: number;
    type: AddressType;
    street_address: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}
export type AmenityCategory = 'basic' | 'safety' | 'luxury' | 'outdoor' | 'family';
export interface Amenity {
    id: number;
    name: string;
    icon?: string;
    category: AmenityCategory;
    description?: string;
    is_active: boolean;
    created_at: string;
}
export type PropertyType = 'apartment' | 'house' | 'villa' | 'cabin' | 'cottage' | 'condo' | 'townhouse' | 'other';
export type PropertyStatus = 'draft' | 'pending' | 'active' | 'inactive' | 'suspended';
export interface Property {
    id: number;
    host_id: number;
    title: string;
    description: string;
    property_type: PropertyType;
    address: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    max_guests: number;
    bedrooms: number;
    bathrooms: number;
    beds: number;
    price_per_night: number;
    cleaning_fee: number;
    security_deposit: number;
    min_nights: number;
    max_nights: number;
    check_in_time: string;
    check_out_time: string;
    advance_booking_days: number;
    status: PropertyStatus;
    is_instant_book: boolean;
    total_bookings: number;
    total_reviews: number;
    average_rating: number;
    created_at: string;
    updated_at: string;
    host?: User;
    amenities?: Amenity[];
    images?: PropertyImage[];
    reviews?: Review[];
}
export interface PropertyImage {
    id: number;
    property_id: number;
    image_url: string;
    alt_text?: string;
    display_order: number;
    is_primary: boolean;
    created_at: string;
}
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'refunded';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';
export type CancelledBy = 'guest' | 'host' | 'admin';
export interface Booking {
    id: number;
    property_id: number;
    guest_id: number;
    host_id: number;
    check_in_date: string;
    check_out_date: string;
    guests_count: number;
    base_price: number;
    cleaning_fee: number;
    security_deposit: number;
    taxes: number;
    total_amount: number;
    status: BookingStatus;
    payment_status: PaymentStatus;
    payment_method?: string;
    payment_reference?: string;
    special_requests?: string;
    host_notes?: string;
    guest_notes?: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    cancelled_by?: CancelledBy;
    created_at: string;
    updated_at: string;
    property?: Property;
    guest?: User;
    host?: User;
}
export type ReviewType = 'property' | 'guest' | 'host';
export interface Review {
    id: number;
    booking_id: number;
    property_id: number;
    reviewer_id: number;
    reviewee_id: number;
    rating: number;
    title?: string;
    comment?: string;
    cleanliness_rating?: number;
    accuracy_rating?: number;
    check_in_rating?: number;
    communication_rating?: number;
    location_rating?: number;
    value_rating?: number;
    review_type: ReviewType;
    is_published: boolean;
    is_featured: boolean;
    response?: string;
    response_date?: string;
    created_at: string;
    updated_at: string;
    reviewer?: User;
    reviewee?: User;
    property?: Property;
    booking?: Booking;
}
export type MessageType = 'inquiry' | 'booking' | 'general' | 'system';
export interface Message {
    id: number;
    booking_id?: number;
    property_id: number;
    sender_id: number;
    recipient_id: number;
    subject?: string;
    message: string;
    is_read: boolean;
    read_at?: string;
    message_type: MessageType;
    created_at: string;
    sender?: User;
    recipient?: User;
    property?: Property;
    booking?: Booking;
}
export type NotificationType = 'booking' | 'review' | 'message' | 'payment' | 'system';
export interface Notification {
    id: number;
    user_id: number;
    title: string;
    message: string;
    type: NotificationType;
    related_id?: number;
    related_type?: string;
    is_read: boolean;
    read_at?: string;
    created_at: string;
}
export interface Favorite {
    id: number;
    user_id: number;
    property_id: number;
    created_at: string;
    property?: Property;
}
export type BlockedReason = 'booked' | 'maintenance' | 'personal' | 'other';
export interface BlockedDate {
    id: number;
    property_id: number;
    blocked_date: string;
    reason: BlockedReason;
    notes?: string;
    created_at: string;
}
export type Page = 'Explore' | 'Host Dashboard' | 'Admin Dashboard' | 'Messages' | 'Bookings' | 'Financials';
export interface NewPropertyData {
    title: string;
    description: string;
    property_type: PropertyType;
    address: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
    max_guests: number;
    bedrooms: number;
    bathrooms: number;
    beds: number;
    price_per_night: number;
    cleaning_fee?: number;
    security_deposit?: number;
    min_nights?: number;
    max_nights?: number;
    check_in_time?: string;
    check_out_time?: string;
    amenity_ids: number[];
    image_urls: string[];
}
export interface PropertySearchFilters {
    city?: string;
    country?: string;
    check_in_date?: string;
    check_out_date?: string;
    guests_count?: number;
    min_price?: number;
    max_price?: number;
    property_type?: PropertyType;
    amenity_ids?: number[];
    min_rating?: number;
    is_instant_book?: boolean;
}
export interface PropertySearchResult extends Property {
    distance?: number;
    host_name?: string;
    primary_image_url?: string;
}
export type ActivityType = 'booking' | 'message' | 'review' | 'payment';
export interface ActivityItem {
    id: string;
    type: ActivityType;
    description: string;
    timestamp: string;
    user: {
        name: string;
        profile_image_url?: string;
    };
    related_id?: number;
}
export interface FinanceData {
    month: string;
    revenue: number;
    expenses: number;
    bookings_count: number;
}
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'refunded';
export type TransactionType = 'booking' | 'refund' | 'fee' | 'payout';
export interface Transaction {
    id: number;
    booking_id?: number;
    date: string;
    type: TransactionType;
    property_title: string;
    amount: number;
    status: TransactionStatus;
    description?: string;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
export interface LoginCredentials {
    email: string;
    password: string;
}
export interface RegisterData {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
}
export interface AuthResponse {
    success: boolean;
    token?: string;
    user?: User;
    error?: string;
}
//# sourceMappingURL=types.d.ts.map