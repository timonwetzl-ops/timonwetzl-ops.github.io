# PHP + MariaDB backend (Hetzner Webhosting M target)

This is a **development draft**. The booking form (`anfrage.html`) now uses the PHP endpoints for package prices, calendar availability and booking submission. The public website is not deployed from this branch.

## Hosting fit

The target is Hetzner Webhosting M. It supports PHP and MariaDB/MySQL-compatible databases. Static HTML, CSS and browser JavaScript remain normal website files; PHP is used only for server-side endpoints.

## Files

- `config.example.php`: template; copy to `config.php` on the server and fill in database credentials.
- `schema.sql`: MariaDB tables for bookings, half-day locks, admin accounts and login-attempt tracking.
- `lib/bootstrap.php`: shared PDO, JSON and date helpers.
- `api/blocked.php`: public calendar date ranges without customer data.
- `api/packages.php`: public package names and server-side prices.
- `api/admin.php`: PHP-session admin login, CSRF-protected booking and package management, and editable text settings.
- `api/contacts.php`: public contact form endpoint.
- `create-admin.php`: CLI-only admin account setup; never exposed through HTTP.
- `api/bookings.php`: transactional booking endpoint with server-side price calculation and a basic hourly request limit.

## Current package defaults

- Basic: 89 EUR
- Comfort: 129 EUR
- Rundum sorglos: 229 EUR
- Additional event day: 89 EUR
- Deposit: 100 EUR

These match the current `packages-default.js` defaults as inspected during development. The final dashboard must edit these server-side values; browser-provided prices are never trusted.

## Important unfinished work

- `dashboard.html` and `kontakt.html` now use PHP endpoints; the admin dashboard manages PHP bookings, contact requests, package text/prices and legal/homepage text.
- Customer sign-in and `meine-buchungen.html` still use Firebase.
- Public package detail pages, homepage content, gallery and image uploads still need migration; dashboard image upload controls are temporarily disabled.
- Existing `meine-buchungen.html` and customer sign-in still use Firebase.
- Run `schema.sql` on the new MariaDB database, then create an admin from the server CLI with `php create-admin.php admin@example.com` and a strong password. Do not put the password in GitHub.
- PHP admin sessions require HTTPS in production. Set up the database and HTTPS before testing the login on the hosted site.
- Secure password reset, mail notifications, customer accounts and migration of existing Firebase bookings are not finished. Do not accept live bookings until full end-to-end tests and adult review are complete.
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
