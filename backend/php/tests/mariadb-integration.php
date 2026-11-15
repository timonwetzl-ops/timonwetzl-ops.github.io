<?php
declare(strict_types=1);

/*
 * Integration checks for the fresh-install schema and the customer-account
 * upgrade migration. This script runs only against the disposable CI database.
 */

$host = getenv('MYSQL_HOST') ?: '127.0.0.1';
$port = getenv('MYSQL_PORT') ?: '3306';
$user = getenv('MYSQL_USER') ?: 'root';
$password = getenv('MYSQL_PASSWORD') ?: '';
$pdo = new PDO(
    "mysql:host={$host};port={$port};charset=utf8mb4",
    $user,
    $password,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
);

function run_sql_file(PDO $pdo, string $path): void
{
    $sql = file_get_contents($path);
    if ($sql === false) throw new RuntimeException("SQL-Datei kann nicht gelesen werden: {$path}");
    // The repository SQL files contain ordinary statements, not stored routines.
    foreach (preg_split('/;\\s*(?:\\r?\\n|$)/', $sql) ?: [] as $statement) {
        $statement = trim($statement);
        if ($statement !== '') $pdo->exec($statement);
    }
}

function assert_true(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function reset_database(PDO $pdo, string $name): void
{
    $pdo->exec("DROP DATABASE IF EXISTS `{$name}`");
    $pdo->exec("CREATE DATABASE `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `{$name}`");
}

$root = dirname(__DIR__);
$migrationDb = 'candybar_migration_test';
reset_database($pdo, $migrationDb);

// Simulate the pre-customer MariaDB database that already contains bookings.
$pdo->exec("CREATE TABLE bookings (
    id CHAR(32) NOT NULL PRIMARY KEY,
    email VARCHAR(254) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$migration = $root . '/migrations/002_customer_accounts.sql';
run_sql_file($pdo, $migration);
run_sql_file($pdo, $migration); // The migration must be safe to re-run.

$tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
foreach (['customer_users', 'customer_tokens', 'customer_auth_attempts', 'contact_attempts', 'bookings'] as $table) {
    assert_true(in_array($table, $tables, true), "Migration fehlt Tabelle {$table}");
}

$column = $pdo->query("SHOW COLUMNS FROM bookings LIKE 'customer_id'")->fetch();
assert_true((bool)$column, 'Migration hat bookings.customer_id nicht angelegt');

$foreignKey = $pdo->query("SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'
      AND CONSTRAINT_NAME = 'fk_booking_customer'")->fetchColumn();
assert_true((int)$foreignKey === 1, 'Booking-Customer-Fremdschlüssel fehlt');

$pdo->exec("INSERT INTO customer_users(email,password_hash,created_at,updated_at)
    VALUES ('test@example.invalid','test-hash',UTC_TIMESTAMP(),UTC_TIMESTAMP())");
$customerId = (int)$pdo->lastInsertId();
$pdo->prepare("INSERT INTO bookings(id,email,customer_id) VALUES(:id,:email,:customer)")
    ->execute([':id' => str_repeat('a', 32), ':email' => 'test@example.invalid', ':customer' => $customerId]);
$pdo->prepare("DELETE FROM customer_users WHERE id=:id")->execute([':id' => $customerId]);
$bookingOwner = $pdo->query("SELECT customer_id FROM bookings WHERE id='" . str_repeat('a', 32) . "'")->fetchColumn();
assert_true($bookingOwner === null, 'Kundenlöschung muss Buchungen erhalten und customer_id leeren');

// Fresh-install schema must also create all tables and the booking foreign key.
$freshDb = 'candybar_fresh_test';
reset_database($pdo, $freshDb);
run_sql_file($pdo, $root . '/schema.sql');
$freshTables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
foreach (['bookings', 'booking_lock_halves', 'customer_users', 'customer_tokens', 'customer_auth_attempts', 'contacts', 'contact_attempts', 'packages', 'site_settings'] as $table) {
    assert_true(in_array($table, $freshTables, true), "Fresh-Schema fehlt Tabelle {$table}");
}

$pdo->exec("INSERT INTO bookings
    (id,name,email,phone,location,message,package_id,package_name,event_start,event_end,event_days,pickup_date,return_date,base_price_cents,price_cents,created_at)
    VALUES ('" . str_repeat('b', 32) . "','Test','test@example.invalid','','','', 'basic','Basic','2030-01-10','2030-01-10',1,'2030-01-09','2030-01-11',8900,8900,UTC_TIMESTAMP())");
$pdo->prepare("INSERT INTO bookings
    (id,name,email,phone,location,message,package_id,package_name,event_start,event_end,event_days,pickup_date,return_date,base_price_cents,price_cents,created_at)
    VALUES ('" . str_repeat('c', 32) . "','Test 2','test2@example.invalid','','','', 'basic','Basic','2030-01-12','2030-01-12',1,'2030-01-11','2030-01-13',8900,8900,UTC_TIMESTAMP())");
$pdo->prepare("INSERT INTO booking_lock_halves(lock_date,half,booking_id) VALUES('2030-01-09','pm',:id)")
    ->execute([':id' => str_repeat('b', 32)]);
$duplicateRejected = false;
try {
    $pdo->prepare("INSERT INTO booking_lock_halves(lock_date,half,booking_id) VALUES('2030-01-09','pm',:id)")
        ->execute([':id' => str_repeat('c', 32)]);
} catch (PDOException $error) {
    $duplicateRejected = (string)$error->getCode() === '23000';
}
assert_true($duplicateRejected, 'Doppelte Buchungssperren müssen durch den Primärschlüssel verhindert werden');

echo "OK: MariaDB-Migration, Fremdschlüssel, Fresh-Schema und Buchungssperren geprüft.\\n";
