import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "backend" / "cloudflare" / "schema.sql"


class BookingSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript(SCHEMA.read_text(encoding="utf-8"))

    def add_booking(self, booking_id, locks):
        self.db.execute(
            """INSERT INTO bookings
            (id, name, email, phone, location, package_id, package_name,
             event_start, event_end, event_days, pickup_date, return_date,
             base_price, price, created_at)
            VALUES (?, 'Test', 'test@example.com', '123', 'Ort', 'basic', 'Basic',
                    '2027-05-10', '2027-05-10', 1, '2027-05-09', '2027-05-11',
                    89, 89, '2027-01-01T12:00:00Z')""",
            (booking_id,)
        )
        for date, half in locks:
            self.db.execute(
                "INSERT INTO booking_locks (booking_id, lock_date, half) VALUES (?, ?, ?)",
                (booking_id, date, half)
            )

    def test_same_half_day_cannot_be_booked_twice(self):
        self.db.execute("BEGIN")
        self.add_booking("A", [("2027-05-10", "am"), ("2027-05-10", "pm")])
        self.db.commit()

        self.db.execute("BEGIN")
        with self.assertRaises(sqlite3.IntegrityError):
            self.add_booking("B", [("2027-05-10", "pm")])
        self.db.rollback()

        self.assertEqual(
            self.db.execute("SELECT COUNT(*) FROM bookings WHERE id='B'").fetchone()[0],
            0
        )

    def test_pickup_pm_and_return_am_can_share_day(self):
        self.db.execute("BEGIN")
        self.add_booking("pickup", [("2027-05-10", "pm")])
        self.add_booking("return", [("2027-05-10", "am")])
        self.db.commit()
        self.assertEqual(
            self.db.execute("SELECT COUNT(*) FROM booking_locks WHERE lock_date='2027-05-10'").fetchone()[0],
            2
        )

    def test_rejected_booking_releases_its_locks(self):
        self.db.execute("BEGIN")
        self.add_booking("A", [("2027-05-10", "am"), ("2027-05-10", "pm")])
        self.db.commit()
        self.db.execute("DELETE FROM booking_locks WHERE booking_id='A'")
        self.db.commit()
        self.db.execute("BEGIN")
        self.add_booking("B", [("2027-05-10", "am"), ("2027-05-10", "pm")])
        self.db.commit()
        self.assertEqual(
            self.db.execute("SELECT COUNT(*) FROM booking_locks WHERE booking_id='B'").fetchone()[0],
            2
        )


if __name__ == "__main__":
    unittest.main()
