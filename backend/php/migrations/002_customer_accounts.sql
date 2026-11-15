-- Run once on an existing MariaDB database after deploying customer account files.
-- Back up the database first.
CREATE TABLE IF NOT EXISTS customer_users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    verified_at DATETIME NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NOT NULL,
    purpose ENUM('verify','reset') NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_customer_tokens_owner (customer_id,purpose,used_at),
    CONSTRAINT fk_customer_token_owner FOREIGN KEY (customer_id)
        REFERENCES customer_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_auth_attempts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email_hash CHAR(64) NOT NULL,
    attempted_at DATETIME NOT NULL,
    INDEX idx_customer_auth_attempts_email_time (email_hash,attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS customer_id BIGINT UNSIGNED NULL,
    ADD INDEX IF NOT EXISTS idx_bookings_customer (customer_id);

-- Match the fresh-install schema: deleting a customer keeps booking records
-- but removes their account association.
SET @has_booking_customer_fk = (
    SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND CONSTRAINT_NAME = 'fk_booking_customer'
);
SET @booking_customer_fk_sql = IF(
    @has_booking_customer_fk = 0,
    'ALTER TABLE bookings ADD CONSTRAINT fk_booking_customer FOREIGN KEY (customer_id) REFERENCES customer_users(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE booking_customer_fk_stmt FROM @booking_customer_fk_sql;
EXECUTE booking_customer_fk_stmt;
DEALLOCATE PREPARE booking_customer_fk_stmt;

CREATE TABLE IF NOT EXISTS contact_attempts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ip_hash CHAR(64) NOT NULL,
    attempted_at DATETIME NOT NULL,
    INDEX idx_contact_attempts_ip_time (ip_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
