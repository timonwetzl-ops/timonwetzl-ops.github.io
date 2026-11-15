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
- `api/customer.php`: customer registration, email verification, login, password reset, booking list and account deletion.
- `lib/customer.php`: customer sessions, hashed one-time tokens, rate limits and email helper.
- `migrations/002_customer_accounts.sql`: add customer account tables to an existing MariaDB database.
- The customer-account migration also adds the booking-to-customer foreign key and the contact-form rate-limit table.
- Public contact submissions are limited to five per IP-hash per hour; the raw IP is not stored.
- `api/content.php`: public homepage, gallery and legal-page content from MariaDB.
- `api/media-upload.php`: admin-only image upload (JPG/PNG/WebP, max. 5 MB) with session and CSRF checks; uploads are stored under `uploads/candybar/`.
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

- `dashboard.html`, `kontakt.html`, `index.html`, `pakete.html`, `paket-detail.html`, `galerie.html`, `impressum.html`, `agb.html` and `datenschutz.html` now read or write their content through PHP endpoints.
- The admin dashboard can upload a homepage image and gallery images to the PHP host; uploads are restricted to JPG/PNG/WebP and 5 MB each.
- Customer email/password sign-in, registration, verification, password reset, navigation login state and `meine-buchungen.html` now use PHP/MariaDB.
- Google and Apple sign-in are shown as not yet available; OAuth setup is a separate remaining step.
- Existing Firebase customer accounts are not imported automatically. Customers will need to create a PHP account with the same verified email; the old Firebase passwords cannot be copied into MariaDB.
- Run `schema.sql` on a new MariaDB database, or back up an existing database and apply `migrations/002_customer_accounts.sql` before using customer accounts. Then create an admin from the server CLI with `php create-admin.php admin@example.com` and a strong password. Do not put the password in GitHub.
- PHP admin sessions require HTTPS in production. Set up the database and HTTPS before testing the login on the hosted site.
- Configure a real sender mailbox on the website domain and verify PHP mail delivery (SPF/DKIM and provider settings) before enabling registration. The current code uses PHP `mail()`; SMTP is not implemented yet. Do not assume that a mailbox or outbound delivery is configured just because an address appears in `config.php`.
- Existing Firebase customer accounts and Firebase bookings are not imported. Existing PHP bookings can be linked to a PHP account after the customer verifies the same email address.
- Google/Apple OAuth, SMTP integration if PHP mail is unavailable, and end-to-end email testing remain unfinished. Do not accept live bookings until full end-to-end tests and adult review are complete.
- The basic request limit uses keyed IP hashes; review the threshold and retention policy before launch and add further bot protection if abuse appears.
- Test the transaction and duplicate-lock behavior against a real MariaDB instance.
- Configure HTTPS, backups, database credentials and permissions on Hetzner.
- Never upload `config.php`, passwords, private keys or customer data to GitHub.
- Do not deploy this draft or accept real bookings until the remaining work and tests are complete.

## Automated tests\n\nRun the PHP test suite with:\n\n```sh\nphp backend/php/tests/run.php\n```\n\nThe suite currently contains more than 100 assertions covering package prices, date validation, date shifts, calendar lock slots and invalid inputs. These are unit-level checks, not a substitute for MariaDB integration and concurrency tests.

GitHub Actions also runs `tests/mariadb-integration.php` against a disposable MariaDB 11.4 service. It checks that the customer migration can be applied twice, the customer foreign key preserves bookings on account deletion, the fresh-install schema creates the required tables, and duplicate booking-lock slots are rejected. This still does not replace a full hosted end-to-end test of email delivery, sessions, uploads and booking workflows.\n\n## Local syntax check

Run PHP lint on each PHP file:

```sh
php -l backend/php/lib/bootstrap.php
php -l backend/php/api/blocked.php
php -l backend/php/api/bookings.php
```
