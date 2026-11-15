<?php
declare(strict_types=1);

function customer_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('candybar_customer');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true, 'samesite' => 'Lax',
    ]);
    session_start();
}

function customer_current(): ?array
{
    customer_session_start();
    if (empty($_SESSION['customer_id'])) return null;
    $q = db()->prepare('SELECT id,email,verified_at FROM customer_users WHERE id=:id AND active=1 LIMIT 1');
    $q->execute([':id' => (int)$_SESSION['customer_id']]);
    $user = $q->fetch();
    if (!$user || empty($user['verified_at'])) {
        $_SESSION = [];
        session_destroy();
        return null;
    }
    return $user;
}

function customer_require_csrf(): array
{
    $user = customer_current();
    if (!$user) json_response(['error' => 'Bitte melde dich erneut an.'], 401);
    $token = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($token === '' || !hash_equals((string)($_SESSION['csrf'] ?? ''), $token)) {
        json_response(['error' => 'Sicherheitsprüfung fehlgeschlagen. Bitte lade die Seite neu.'], 403);
    }
    return $user;
}

function customer_issue_token(PDO $pdo, int $customerId, string $purpose, int $minutes): string
{
    $pdo->prepare("UPDATE customer_tokens SET used_at=UTC_TIMESTAMP() WHERE customer_id=:id AND purpose=:purpose AND used_at IS NULL")
        ->execute([':id' => $customerId, ':purpose' => $purpose]);
    $raw = bin2hex(random_bytes(32));
    $expires = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify('+' . $minutes . ' minutes')->format('Y-m-d H:i:s');
    $q = $pdo->prepare("INSERT INTO customer_tokens(customer_id,purpose,token_hash,expires_at,created_at) VALUES(:id,:purpose,:hash,:expires,UTC_TIMESTAMP())");
    $q->bindValue(':id', $customerId, PDO::PARAM_INT);
    $q->bindValue(':purpose', $purpose);
    $q->bindValue(':hash', hash('sha256', $raw));
    $q->bindValue(':expires', $expires);
    $q->execute();
    return $raw;
}

function customer_send_mail(string $to, string $subject, string $body): bool
{
    $mail = app_config()['mail'] ?? [];
    $from = (string)($mail['from'] ?? '');
    $name = (string)($mail['from_name'] ?? 'Candy Bar Vogtland');
    if (!filter_var($from, FILTER_VALIDATE_EMAIL) || !function_exists('mail')) return false;
    $encodedName = '=?UTF-8?B?' . base64_encode($name) . '?=';
    $headers = [
        'From: ' . $encodedName . ' <' . $from . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ];
    return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\r\n", $headers));
}

function customer_base_url(): string
{
    $base = rtrim((string)(app_config()['app']['base_url'] ?? ''), '/');
    if (!preg_match('~^https://[a-z0-9.-]+(?::[0-9]+)?$~i', $base)) {
        json_response(['error' => 'Die Website-Adresse ist auf dem Server noch nicht eingerichtet.'], 503);
    }
    return $base;
}

function customer_rate_limit(PDO $pdo, string $email, string $action): void
{
    $hash = hash('sha256', $action . '|' . strtolower($email));
    $pdo->prepare("DELETE FROM customer_auth_attempts WHERE attempted_at < UTC_TIMESTAMP()-INTERVAL 2 DAY")->execute();
    $q = $pdo->prepare("SELECT COUNT(*) FROM customer_auth_attempts WHERE email_hash=:h AND attempted_at>=UTC_TIMESTAMP()-INTERVAL 15 MINUTE");
    $q->execute([':h' => $hash]);
    if ((int)$q->fetchColumn() >= 8) json_response(['error' => 'Zu viele Versuche. Bitte warte 15 Minuten.'], 429);
    $pdo->prepare("INSERT INTO customer_auth_attempts(email_hash,attempted_at) VALUES(:h,UTC_TIMESTAMP())")
        ->execute([':h' => $hash]);
}
