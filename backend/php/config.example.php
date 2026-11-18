<?php
declare(strict_types=1);

/*
 * Copy this file to config.php on the Hetzner server.
 * Never commit config.php or real passwords to GitHub.
 */
return [
    'db' => [
        'dsn' => 'mysql:host=localhost;dbname=YOUR_DATABASE;charset=utf8mb4',
        'user' => 'YOUR_DATABASE_USER',
        'password' => 'CHANGE_ME',
    ],
    'booking' => [
        'lead_days' => 14,
        'max_event_days' => 14,
        'extra_day_price_cents' => 8900,
        'deposit_cents' => 10000,
        'packages' => [
            'basic' => ['name' => 'Basic', 'price_cents' => 8900],
            'comfort' => ['name' => 'Comfort', 'price_cents' => 12900],
            'rundumsorglos' => ['name' => 'Rundum sorglos', 'price_cents' => 22900],
        ],
    ],
    'app' => [
        // Vor dem Aktivieren durch die echte HTTPS-Adresse der Website ersetzen.
        'base_url' => 'https://candybar-vogtland.de',
    ],
    'mail' => [
        // Absenderadresse muss beim Hosting für den Versand eingerichtet sein.
        'from' => 'noreply@candybar-vogtland.de',
        'from_name' => 'Candy Bar Vogtland',
    ],
    'security' => [
        // Generate a long random value before deployment.
        'rate_limit_secret' => 'CHANGE_TO_A_LONG_RANDOM_SECRET',
    ],
];
