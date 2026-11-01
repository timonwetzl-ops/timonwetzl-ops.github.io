<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

$checks = 0;
function check(bool $condition, string $message): void {
    global $checks;
    $checks++;
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$config = [
    'max_event_days' => 14,
    'extra_day_price_cents' => 8900,
    'packages' => [
        'basic' => ['price_cents' => 8900],
        'comfort' => ['price_cents' => 12900],
        'rundumsorglos' => ['price_cents' => 22900],
    ],
];

// 42 price assertions: all packages for every supported event length.
$expectedBase = ['basic' => 8900, 'comfort' => 12900, 'rundumsorglos' => 22900];
foreach ($expectedBase as $id => $base) {
    for ($days = 1; $days <= 14; $days++) {
        check(
            booking_price_cents($config, $id, $days) === $base + (($days - 1) * 8900),
            "Preis {$id}, {$days} Veranstaltungstag(e)"
        );
    }
}

// 28 calendar assertions: dates, slot count, pickup/return and slot order.
for ($days = 1; $days <= 14; $days++) {
    $start = '2027-03-01';
    $end = shift_date($start, $days - 1);
    $slots = date_slots($start, $end);
    check(count($slots) === (2 * $days) + 2, "Slot-Anzahl für {$days} Tag(e)");
    check($slots[0] === [shift_date($start, -1), 'pm'], "Abholungsslot für {$days} Tag(e)");
    check($slots[count($slots) - 1] === [shift_date($end, 1), 'am'], "Rückgabeslot für {$days} Tag(e)");
    check($slots[1] === [$start, 'am'], "Erster Veranstaltungsslot für {$days} Tag(e)");
}

// 20 date validation assertions.
$validDates = ['2024-02-29', '2027-01-01', '2027-12-31', '2028-02-29', '2030-06-15'];
foreach ($validDates as $date) check(valid_iso_date($date), "Gültiges Datum {$date}");
$invalidDates = ['2027-02-29', '2027-13-01', '2027-04-31', '01.02.2027', '2027-1-01'];
foreach ($invalidDates as $date) check(!valid_iso_date($date), "Ungültiges Datum {$date}");
for ($i = 1; $i <= 5; $i++) {
    $d = sprintf('2027-05-%02d', $i);
    check(shift_date($d, 1) === sprintf('2027-05-%02d', $i + 1), "Datum plus ein Tag {$d}");
    check(shift_date($d, -1) === (new DateTimeImmutable($d))->modify('-1 day')->format('Y-m-d'), "Datum minus ein Tag {$d}");
}

// 15 input and boundary assertions.
check(clean_text('  Test  ', 20) === 'Test', 'Whitespace wird entfernt');
check(clean_text(123, 20) === '', 'Nicht-Text wird abgewiesen');
check(clean_text('abcdef', 3) === 'abc', 'Maximallänge wird eingehalten');
check(clean_text('', 10) === '', 'Leerer Text bleibt leer');
check(clean_text('  Candy Bar  ', 9) === 'Candy Bar', 'Textlänge wird begrenzt');
foreach ([0, -1, 15, 100] as $days) {
    $thrown = false;
    try { booking_price_cents($config, 'basic', $days); }
    catch (InvalidArgumentException) { $thrown = true; }
    check($thrown, "Ungültige Tagesanzahl {$days} wird abgewiesen");
}
foreach (['missing', '', 'BASIC'] as $id) {
    $thrown = false;
    try { booking_price_cents($config, $id, 1); }
    catch (InvalidArgumentException) { $thrown = true; }
    check($thrown, "Unbekanntes Paket {$id} wird abgewiesen");
}

if ($checks < 100) {
    fwrite(STDERR, "Nur {$checks} Tests ausgeführt; mindestens 100 erwartet.\n");
    exit(1);
}
echo "OK: {$checks} PHP-Assertions erfolgreich.\n";
