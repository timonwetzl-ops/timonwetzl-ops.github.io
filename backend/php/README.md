# PHP + MariaDB backend (Hetzner Webhosting M target)

This is a **development draft**, not connected to the public website yet.

## Hosting fit

The target is Hetzner Webhosting M. It supports PHP and MariaDB/MySQL-compatible databases. Static HTML, CSS and browser JavaScript remain normal website files; PHP is used only for server-side endpoints.

## Files

- `config.example.php`: template; copy to `config.php` on the server and fill in database credentials.
- `schema.sql`: MariaDB tables for bookings, half-day locks, admin accounts and login-attempt tracking.
- `lib/bootstrap.php`: shared PDO, JSON and date helpers.
- `api/blocked.php`: public calendar date ranges without customer data.
- `api/packages.php`: public package names and server-side prices.
- `api/bookings.php`: transactional booking endpoint with server-side price calculation and a basic hourly request limit.

## Current package defaults

- Basic: 89 EUR
- Comfort: 129 EUR
- Rundum sorglos: 229 EUR
- Additional event day: 89 EUR
- Deposit: 100 EUR

These match the current `packages-default.js` defaults as inspected during development. The final dashboard must edit these server-side values; browser-provided prices are never trusted.

## Important unfinished work

- Existing `anfrage.html` still uses Firebase. It has not been switched to these endpoints.
- Existing `dashboard.html` still uses Firebase and has not been migrated.
- Existing `meine-buchungen.html` and customer sign-in still use Firebase.
- Admin login/session handling, CSRF protection, secure password reset, mail notifications, customer accounts and migration of existing bookings are not finished.
- The basic request limit uses keyed IP hashes; review the threshold and retention policy before launch and add further bot protection if abuse appears.
- Test the transaction and duplicate-lock behavior against a real MariaDB instance.
- Configure HTTPS, backups, database credentials and permissions on Hetzner.
- Never upload `config.php`, passwords, private keys or customer data to GitHub.
- Do not deploy this draft or accept real bookings until the remaining work and tests are complete.

## Automated tests\n\nRun the PHP test suite with:\n\n```sh\nphp backend/php/tests/run.php\n```\n\nThe suite currently contains more than 100 assertions covering package prices, date validation, date shifts, calendar lock slots and invalid inputs. These are unit-level checks, not a substitute for MariaDB integration and concurrency tests.\n\n## Local syntax check

Run PHP lint on each PHP file:

```sh
php -l backend/php/lib/bootstrap.php
php -l backend/php/api/blocked.php
php -l backend/php/api/bookings.php
```
