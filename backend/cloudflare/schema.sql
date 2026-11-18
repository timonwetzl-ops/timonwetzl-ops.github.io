PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  uid TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  location TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  package_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  event_start TEXT NOT NULL,
  event_end TEXT NOT NULL,
  event_days INTEGER NOT NULL,
  pickup_date TEXT NOT NULL,
  return_date TEXT NOT NULL,
  base_price REAL NOT NULL,
  price REAL NOT NULL,
  deposit REAL NOT NULL DEFAULT 100,
  booking_status TEXT NOT NULL DEFAULT 'neu',
  payment_status TEXT NOT NULL DEFAULT 'offen',
  paid_amount REAL NOT NULL DEFAULT 0,
  email_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_event_start ON bookings(event_start);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email);

-- Jede Buchung belegt zwei Halbtag-Slots pro Veranstaltungstag.
-- Abholung: nur pm; Rückgabe: nur am. UNIQUE verhindert Doppelbuchungen.
CREATE TABLE IF NOT EXISTS booking_locks (
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  lock_date TEXT NOT NULL,
  half TEXT NOT NULL CHECK (half IN ('am', 'pm')),
  PRIMARY KEY (lock_date, half)
);

CREATE INDEX IF NOT EXISTS idx_booking_locks_booking ON booking_locks(booking_id);
