-- ============================================================
-- Admin Dashboard Database Enhancements Migration
-- Version: 001
-- Description: Adds tables and columns for full admin dashboard functionality
-- ============================================================

-- ============================================================
-- PART 1: ALTER EXISTING TABLES
-- ============================================================

-- Add admin-related columns to properties table
ALTER TABLE properties
  ADD COLUMN admin_notes TEXT AFTER status,
  ADD COLUMN rejection_reason TEXT AFTER admin_notes,
  ADD COLUMN approved_by_user_id INT AFTER rejection_reason,
  ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by_user_id,
  ADD CONSTRAINT fk_properties_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add ban-related columns to users table
ALTER TABLE users
  ADD COLUMN banned_at TIMESTAMP NULL AFTER is_active,
  ADD COLUMN ban_reason TEXT AFTER banned_at;

-- Add moderation columns to reviews table
ALTER TABLE reviews
  ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE AFTER is_featured,
  ADD COLUMN flag_reason TEXT AFTER is_flagged,
  ADD COLUMN admin_action ENUM('none','approved','hidden','deleted') DEFAULT 'none' AFTER flag_reason,
  ADD COLUMN moderated_by_user_id INT AFTER admin_action,
  ADD COLUMN moderated_at TIMESTAMP NULL AFTER moderated_by_user_id,
  ADD CONSTRAINT fk_reviews_moderated_by FOREIGN KEY (moderated_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add admin and refund columns to bookings table
ALTER TABLE bookings
  ADD COLUMN admin_notes TEXT AFTER guest_notes,
  ADD COLUMN cancelled_by_admin_id INT AFTER cancelled_by,
  ADD COLUMN refund_status ENUM('none','requested','processing','completed','failed') DEFAULT 'none' AFTER cancelled_by_admin_id,
  ADD COLUMN refund_amount DECIMAL(10,2) DEFAULT 0.00 AFTER refund_status,
  ADD CONSTRAINT fk_bookings_cancelled_by_admin FOREIGN KEY (cancelled_by_admin_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- PART 2: CREATE NEW TABLES
-- ============================================================

-- Property Status History Table
CREATE TABLE IF NOT EXISTS property_status_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  property_id INT NOT NULL,
  old_status ENUM('draft','pending','active','inactive','suspended') NOT NULL,
  new_status ENUM('draft','pending','active','inactive','suspended') NOT NULL,
  changed_by_user_id INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_property_status_history_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT fk_property_status_history_user FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_property_id (property_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Activity Log Table
CREATE TABLE IF NOT EXISTS user_activity_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_activity_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT,
  user_id INT NOT NULL,
  transaction_type ENUM('booking','refund','payout','fee','commission') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status ENUM('pending','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  CONSTRAINT fk_transactions_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_booking_id (booking_id),
  INDEX idx_user_id (user_id),
  INDEX idx_transaction_type (transaction_type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Host Payouts Table
CREATE TABLE IF NOT EXISTS host_payouts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  host_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  payout_method VARCHAR(50),
  payout_reference VARCHAR(255),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  bookings_included JSON,
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  CONSTRAINT fk_host_payouts_host FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_host_id (host_id),
  INDEX idx_status (status),
  INDEX idx_period (period_start, period_end),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Platform Settings Table
CREATE TABLE IF NOT EXISTS platform_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  setting_type ENUM('string','number','boolean','json') NOT NULL DEFAULT 'string',
  description TEXT,
  updated_by_user_id INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_platform_settings_user FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin Actions Log Table
CREATE TABLE IF NOT EXISTS admin_actions_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INT,
  description TEXT,
  changes JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_actions_log_admin FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_admin_user_id (admin_user_id),
  INDEX idx_action (action),
  INDEX idx_target (target_type, target_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PART 3: INSERT DEFAULT PLATFORM SETTINGS
-- ============================================================

INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) VALUES
  ('commission_rate', '15.0', 'number', 'Platform commission percentage'),
  ('min_booking_amount', '50.0', 'number', 'Minimum booking amount in USD'),
  ('max_booking_days', '365', 'number', 'Maximum booking duration in days'),
  ('cancellation_policy', 'flexible', 'string', 'Default cancellation policy'),
  ('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode'),
  ('email_notifications', 'true', 'boolean', 'Enable email notifications'),
  ('auto_approve_properties', 'false', 'boolean', 'Auto-approve property listings'),
  ('require_email_verification', 'true', 'boolean', 'Require email verification for new users')
ON DUPLICATE KEY UPDATE setting_key=setting_key;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================