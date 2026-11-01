<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    json_response(['error' => 'Methode nicht erlaubt.'], 405);
}

try {
    // Publish dates only; never expose customer or booking details.
    // The calendar uses the afternoon before the event and morning after it.
    $stmt = db()->query(
        "SELECT pickup_date AS startDate, return_date AS endDate
         FROM bookings
         WHERE booking_status <> 'abgelehnt'
         ORDER BY pickup_date"
    );
    json_response(['blocked' => $stmt->fetchAll()]);
} catch (Throwable $error) {
    error_log('Calendar endpoint: ' . $error->getMessage());
    json_response(['error' => 'Kalender momentan nicht verfügbar.'], 503);
}
