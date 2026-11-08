<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    json_response(['error' => 'Methode nicht erlaubt.'], 405);
}

try {
    $packages = app_config()['booking']['packages'] ?? [];
    $public = [];
    foreach ($packages as $id => $package) {
        if (!is_array($package) || !isset($package['name'], $package['price_cents'])) continue;
        $price = (int)$package['price_cents'];
        if ($price < 0) continue;
        $public[] = [
            'id' => (string)$id,
            'name' => (string)$package['name'],
            'priceCents' => $price,
        ];
    }
    json_response(['packages' => $public]);
} catch (Throwable $error) {
    error_log('Packages endpoint: ' . $error->getMessage());
    json_response(['error' => 'Pakete momentan nicht verfügbar.'], 503);
}
