-- MariaDB schema for Candy Bar Vogtland PHP backend.
-- Run only on a new/test database first. Do not import live data yet.

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

CREATE TABLE IF NOT EXISTS bookings (
    id CHAR(32) NOT NULL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(60) NOT NULL,
    location VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    customer_id BIGINT UNSIGNED NULL,
    package_id VARCHAR(32) NOT NULL,
    package_name VARCHAR(80) NOT NULL,
    event_start DATE NOT NULL,
    event_end DATE NOT NULL,
    event_days SMALLINT UNSIGNED NOT NULL,
    pickup_date DATE NOT NULL,
    return_date DATE NOT NULL,
    base_price_cents INT UNSIGNED NOT NULL,
    price_cents INT UNSIGNED NOT NULL,
    deposit_cents INT UNSIGNED NOT NULL DEFAULT 10000,
    booking_status ENUM('neu','bestätigt','abgelehnt') NOT NULL DEFAULT 'neu',
    payment_status ENUM('offen','bezahlt','fehlgeschlagen','erstattet') NOT NULL DEFAULT 'offen',
    paid_amount_cents INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NULL,
    INDEX idx_bookings_event_start (event_start),
    INDEX idx_bookings_email (email),
    INDEX idx_bookings_status (booking_status),
    INDEX idx_bookings_customer (customer_id),
    CONSTRAINT fk_booking_customer FOREIGN KEY (customer_id)
        REFERENCES customer_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every occupied full day is represented by AM + PM. Pickup takes PM,
-- return takes AM. The primary key prevents overlaps, including races.
CREATE TABLE IF NOT EXISTS booking_lock_halves (
    lock_date DATE NOT NULL,
    half ENUM('am','pm') NOT NULL,
    booking_id CHAR(32) NOT NULL,
    PRIMARY KEY (lock_date, half),
    INDEX idx_lock_booking (booking_id),
    CONSTRAINT fk_lock_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email_hash CHAR(64) NOT NULL,
    attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_login_attempts_email_time (email_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Keyed IP hashes only; raw IP addresses are never stored.
CREATE TABLE IF NOT EXISTS booking_attempts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ip_hash CHAR(64) NOT NULL,
    attempted_at DATETIME NOT NULL,
    INDEX idx_booking_attempts_ip_time (ip_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS contacts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL, email VARCHAR(254) NOT NULL,
 address VARCHAR(240) NOT NULL DEFAULT '', subject VARCHAR(180) NOT NULL DEFAULT '',
 message TEXT NOT NULL, created_at DATETIME NOT NULL,
 INDEX idx_contacts_created(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Public contact form throttling stores keyed IP hashes, never raw addresses.
CREATE TABLE IF NOT EXISTS contact_attempts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ip_hash CHAR(64) NOT NULL,
    attempted_at DATETIME NOT NULL,
    INDEX idx_contact_attempts_ip_time (ip_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS packages (
 package_id VARCHAR(32) PRIMARY KEY, data_json LONGTEXT NOT NULL, updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
 setting_key VARCHAR(40) PRIMARY KEY, setting_value MEDIUMTEXT NOT NULL, updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
