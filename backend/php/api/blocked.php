<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    json_response(['error' => 'Methode nicht erlaubt.'], 405);
}

try {
    $stmt = db()->query(
        "SELECT lock_date,
                MAX(half = 'am') AS am_taken,
                MAX(half = 'pm') AS pm_taken
         FROM booking_lock_halves
         GROUP BY lock_date
         ORDER BY lock_date"
    );
    json_response(['blocked' => $stmt->fetchAll()]);
} catch (Throwable $error) {
    error_log('Calendar endpoint: ' . $error->getMessage());
    json_response(['error' => 'Kalender momentan nicht verfügbar.'], 503);
}
