<?php
declare(strict_types=1);

function app_config(): array
{
    static $config = null;
    if ($config === null) {
        $path = dirname(__DIR__) . '/config.php';
        if (!is_file($path)) {
            json_response(['error' => 'Serverkonfiguration fehlt.'], 503);
        }
        $config = require $path;
    }
    return $config;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $cfg = app_config()['db'];
        $pdo = new PDO($cfg['dsn'], $cfg['user'], $cfg['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec("SET time_zone = '+00:00'");
    }
    return $pdo;
}

function json_response(array $body, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 20000) {
        json_response(['error' => 'Ungültige Anfrage.'], 400);
    }
    try {
        $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        json_response(['error' => 'Ungültige JSON-Daten.'], 400);
    }
    if (!is_array($data)) {
        json_response(['error' => 'Ungültige Anfrage.'], 400);
    }
    return $data;
}

function clean_text(mixed $value, int $max): string
{
    if (!is_string($value)) return '';
    $value = trim($value);
    // mbstring ist auf Shared-Hosting nicht garantiert aktiviert.
    if (function_exists('mb_substr')) return mb_substr($value, 0, $max, 'UTF-8');
    return substr($value, 0, $max);
}

function valid_iso_date(mixed $value): bool
{
    if (!is_string($value)) return false;
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('Europe/Berlin'));
    return $date !== false && $date->format('Y-m-d') === $value;
}

function shift_date(string $date, int $days): string
{
    return (new DateTimeImmutable($date, new DateTimeZone('Europe/Berlin')))
        ->modify(($days >= 0 ? '+' : '') . $days . ' days')
        ->format('Y-m-d');
}

function date_slots(string $eventStart, string $eventEnd): array
{
    $slots = [[shift_date($eventStart, -1), 'pm']];
    for ($day = $eventStart; $day <= $eventEnd; $day = shift_date($day, 1)) {
        $slots[] = [$day, 'am'];
        $slots[] = [$day, 'pm'];
    }
    $slots[] = [shift_date($eventEnd, 1), 'am'];
    return $slots;
}
