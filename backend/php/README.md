# PHP + MariaDB backend (Hetzner Webhosting M target)

This is a **development draft**, not connected to the public website yet.

## Hosting fit

The target is Hetzner Webhosting M. It supports PHP and MariaDB/MySQL-compatible databases. Static HTML, CSS and browser JavaScript remain normal website files; PHP is used only for server-side endpoints.

## Files

- `config.example.php`: template; copy to `config.php` on the server and fill in database credentials.
- `schema.sql`: MariaDB tables for bookings, half-day locks, admin accounts and login-attempt tracking.
- `lib/bootstrap.php`: shared PDO, JSON and date helpers.
- `api/blocked.php`: public calendar occupancy endpoint.
- `api/bookings.php`: transactional booking endpoint. Prices are calculated on the server.

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
- Add production-grade rate limiting / bot protection and privacy-aware logging before launch.
- Test the transaction and duplicate-lock behavior against a real MariaDB instance.
- Configure HTTPS, backups, database credentials and permissions on Hetzner.
- Never upload `config.php`, passwords, private keys or customer data to GitHub.
- Do not deploy this draft or accept real bookings until the remaining work and tests are complete.

## Local syntax check

Run PHP lint on each PHP file:

```sh
php -l backend/php/lib/bootstrap.php
php -l backend/php/api/blocked.php
php -l backend/php/api/bookings.php
```
