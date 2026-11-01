<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    json_response(['error' => 'Methode nicht erlaubt.'], 405);
}

$data = request_json();

// Unsichtbares Formularfeld als einfache Bot-Falle; echte Rate-Limits und
// zusätzliche Schutzmaßnahmen werden vor dem Livegang ergänzt.
if (clean_text($data['website'] ?? '', 200) !== '') {
    json_response(['ok' => true, 'message' => 'Anfrage erhalten.'], 202);
}

$name = clean_text($data['name'] ?? '', 120);
$email = clean_text($data['email'] ?? '', 254);
$phone = clean_text($data['phone'] ?? '', 60);
$location = clean_text($data['location'] ?? '', 180);
$message = clean_text($data['message'] ?? '', 2000);
$packageId = clean_text($data['packageId'] ?? '', 32);
$eventStart = $data['eventStart'] ?? null;
$eventEnd = $data['eventEnd'] ?? null;

$config = app_config();
$bookingConfig = $config['booking'];
$packages = $bookingConfig['packages'];

if (
    $name === '' ||
    !filter_var($email, FILTER_VALIDATE_EMAIL) ||
    $phone === '' ||
    $location === '' ||
    !isset($packages[$packageId]) ||
    !valid_iso_date($eventStart) ||
    !valid_iso_date($eventEnd)
) {
    json_response(['error' => 'Bitte prüfe deine Angaben.'], 400);
}

$startDate = new DateTimeImmutable($eventStart, new DateTimeZone('Europe/Berlin'));
$endDate = new DateTimeImmutable($eventEnd, new DateTimeZone('Europe/Berlin'));
$eventDays = (int)$startDate->diff($endDate)->format('%a') + 1;
$today = new DateTimeImmutable('today', new DateTimeZone('Europe/Berlin'));
$earliest = $today->modify('+' . (int)$bookingConfig['lead_days'] . ' days');

if (
    $eventEnd < $eventStart ||
    $eventDays > (int)$bookingConfig['max_event_days'] ||
    $startDate < $earliest
) {
    json_response(['error' => 'Der gewählte Zeitraum ist nicht buchbar.'], 400);
}

$package = $packages[$packageId];
$basePrice = (int)$package['price_cents'];
$price = $basePrice + ($eventDays - 1) * (int)$bookingConfig['extra_day_price_cents'];
$deposit = (int)$bookingConfig['deposit_cents'];
$pickupDate = shift_date($eventStart, -1);
$returnDate = shift_date($eventEnd, 1);
$id = bin2hex(random_bytes(16));

try {
    $pdo = db();
    $pdo->beginTransaction();

    $insertBooking = $pdo->prepare(
        "INSERT INTO bookings
         (id, name, email, phone, location, message, package_id, package_name,
          event_start, event_end, event_days, pickup_date, return_date,
          base_price_cents, price_cents, deposit_cents, booking_status,
          payment_status, paid_amount_cents, created_at)
         VALUES
         (:id, :name, :email, :phone, :location, :message, :package_id, :package_name,
          :event_start, :event_end, :event_days, :pickup_date, :return_date,
          :base_price, :price, :deposit, 'neu', 'offen', 0, UTC_TIMESTAMP())"
    );
    $insertBooking->execute([
        ':id' => $id,
        ':name' => $name,
        ':email' => $email,
        ':phone' => $phone,
        ':location' => $location,
        ':message' => $message,
        ':package_id' => $packageId,
        ':package_name' => $package['name'],
        ':event_start' => $eventStart,
        ':event_end' => $eventEnd,
        ':event_days' => $eventDays,
        ':pickup_date' => $pickupDate,
        ':return_date' => $returnDate,
        ':base_price' => $basePrice,
        ':price' => $price,
        ':deposit' => $deposit,
    ]);

    $insertLock = $pdo->prepare(
        "INSERT INTO booking_lock_halves (lock_date, half, booking_id)
         VALUES (:lock_date, :half, :booking_id)"
    );
    foreach (date_slots($eventStart, $eventEnd) as [$lockDate, $half]) {
        $insertLock->execute([
            ':lock_date' => $lockDate,
            ':half' => $half,
            ':booking_id' => $id,
        ]);
    }

    $pdo->commit();
    json_response([
        'ok' => true,
        'bookingId' => $id,
        'message' => 'Deine Buchungsanfrage ist eingegangen.',
        'priceCents' => $price,
        'depositCents' => $deposit,
    ], 201);
} catch (PDOException $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    // MySQL duplicate-key error means another booking took at least one slot.
    if (($error->errorInfo[1] ?? null) === 1062) {
        json_response(['error' => 'Dieser Zeitraum ist inzwischen vergeben. Bitte wähle einen anderen.'], 409);
    }
    error_log('Booking endpoint: ' . $error->getMessage());
    json_response(['error' => 'Buchung konnte nicht gespeichert werden.'], 503);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Booking endpoint: ' . $error->getMessage());
    json_response(['error' => 'Buchung konnte nicht gespeichert werden.'], 503);
}
