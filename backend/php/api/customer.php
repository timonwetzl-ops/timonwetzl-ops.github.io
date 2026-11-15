<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/bootstrap.php';
require_once dirname(__DIR__) . '/lib/customer.php';

function customer_email(mixed $value): string {
    $email = strtolower(clean_text($value, 254));
    return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : '';
}
function customer_password(mixed $value): string {
    return is_string($value) ? $value : '';
}
function customer_send_link(PDO $pdo, array $user, string $purpose): bool {
    $minutes = $purpose === 'verify' ? 1440 : 60;
    $token = customer_issue_token($pdo, (int)$user['id'], $purpose, $minutes);
    $action = $purpose === 'verify' ? 'verify' : 'reset';
    $url = customer_base_url() . '/backend/php/api/customer.php?action=' . $action . '&token=' . rawurlencode($token);
    if ($purpose === 'verify') {
        $subject = 'Bitte bestätige deine E-Mail-Adresse';
        $body = "Hallo!\n\nBitte bestätige deine E-Mail-Adresse für dein Candy-Bar-Vogtland-Konto:\n\n{$url}\n\nDer Link ist 24 Stunden gültig. Wenn du kein Konto erstellt hast, kannst du diese E-Mail ignorieren.\n";
    } else {
        $subject = 'Passwort zurücksetzen';
        $body = "Hallo!\n\nÜber diesen Link kannst du ein neues Passwort festlegen:\n\n{$url}\n\nDer Link ist 60 Minuten gültig. Wenn du kein Zurücksetzen angefordert hast, kannst du diese E-Mail ignorieren.\n";
    }
    return customer_send_mail((string)$user['email'], $subject, $body);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = (string)($_GET['action'] ?? 'me');
    if ($action === 'me') {
        $user = customer_current();
        json_response(['authenticated' => (bool)$user, 'email' => $user['email'] ?? null, 'csrf' => $user ? ($_SESSION['csrf'] ?? null) : null]);
    }
    if ($action === 'verify' || $action === 'reset') {
        $token = (string)($_GET['token'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) json_response(['error' => 'Dieser Link ist ungültig oder abgelaufen.'], 400);
        $purpose = $action === 'verify' ? 'verify' : 'reset';
        // The email link only opens the page. The user confirms there, so link scanners
        // cannot consume a one-time token just by previewing the email.
        header('Location: ' . customer_base_url() . '/anmelden.html?' . ($purpose === 'verify' ? 'verify=1' : 'reset=1') . '&token=' . rawurlencode($token), true, 303);
        exit;
    }
    if ($action === 'bookings') {
        $user = customer_require_csrf();
        $pdo = db();
        $pdo->prepare('UPDATE bookings SET customer_id=:id WHERE customer_id IS NULL AND LOWER(email)=:email')
            ->execute([':id' => $user['id'], ':email' => strtolower((string)$user['email'])]);
        $q = $pdo->prepare("SELECT id,name,email,location,message,package_name,event_start,event_end,event_days,pickup_date,return_date,price_cents,deposit_cents,booking_status,payment_status,paid_amount_cents,created_at FROM bookings WHERE customer_id=:id ORDER BY created_at DESC");
        $q->execute([':id' => $user['id']]);
        json_response(['bookings' => $q->fetchAll()]);
    }
    json_response(['error' => 'Unbekannte Aktion.'], 404);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, POST');
    json_response(['error' => 'Methode nicht erlaubt.'], 405);
}
$d = request_json();
$action = (string)($d['action'] ?? '');
$pdo = db();

if ($action === 'verify_email') {
    $token = is_string($d['token'] ?? null) ? $d['token'] : '';
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) json_response(['error' => 'Dieser Link ist ungültig oder abgelaufen.'], 400);
    $pdo->beginTransaction();
    try {
        // Lock the token row so simultaneous requests cannot consume it twice.
        $q = $pdo->prepare("SELECT id,customer_id FROM customer_tokens WHERE token_hash=:h AND purpose='verify' AND used_at IS NULL AND expires_at>UTC_TIMESTAMP() LIMIT 1 FOR UPDATE");
        $q->execute([':h' => hash('sha256', $token)]);
        $row = $q->fetch();
        if (!$row) {
            $pdo->rollBack();
            json_response(['error' => 'Dieser Link ist ungültig oder abgelaufen.'], 400);
        }
        $consume = $pdo->prepare("UPDATE customer_tokens SET used_at=UTC_TIMESTAMP() WHERE id=:id AND used_at IS NULL AND expires_at>UTC_TIMESTAMP()");
        $consume->execute([':id' => $row['id']]);
        if ($consume->rowCount() !== 1) {
            $pdo->rollBack();
            json_response(['error' => 'Dieser Link ist ungültig oder abgelaufen.'], 400);
        }
        $pdo->prepare('UPDATE customer_users SET verified_at=COALESCE(verified_at,UTC_TIMESTAMP()),updated_at=UTC_TIMESTAMP() WHERE id=:id')
            ->execute([':id' => $row['customer_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    json_response(['ok' => true, 'message' => 'E-Mail bestätigt. Du kannst dich jetzt anmelden.']);
}

if ($action === 'register') {
    $email = customer_email($d['email'] ?? '');
    $password = customer_password($d['password'] ?? '');
    if (!$email || strlen($password) < 12 || strlen($password) > 1024) {
        json_response(['error' => 'Bitte gib eine gültige E-Mail und ein Passwort mit mindestens 12 Zeichen ein.'], 400);
    }
    customer_rate_limit($pdo, $email, 'register');
    $q = $pdo->prepare('SELECT id FROM customer_users WHERE email=:email LIMIT 1');
    $q->execute([':email' => $email]);
    if ($q->fetch()) json_response(['error' => 'Zu dieser E-Mail gibt es bereits ein Konto. Bitte melde dich an oder setze dein Passwort zurück.'], 409);
    $q = $pdo->prepare('INSERT INTO customer_users(email,password_hash,created_at,updated_at) VALUES(:email,:hash,UTC_TIMESTAMP(),UTC_TIMESTAMP())');
    $q->execute([':email' => $email, ':hash' => password_hash($password, PASSWORD_DEFAULT)]);
    $user = ['id' => (int)$pdo->lastInsertId(), 'email' => $email];
    $sent = customer_send_link($pdo, $user, 'verify');
    json_response(['ok' => true, 'verificationSent' => $sent, 'message' => $sent ? 'Konto erstellt. Bitte bestätige deine E-Mail über den Link in deinem Postfach.' : 'Konto erstellt. Der E-Mail-Versand ist noch nicht eingerichtet. Bitte später erneut versuchen oder den Betreiber kontaktieren.'], 201);
}

if ($action === 'login') {
    $email = customer_email($d['email'] ?? '');
    $password = customer_password($d['password'] ?? '');
    if (!$email || $password === '') json_response(['error' => 'E-Mail oder Passwort stimmt nicht.'], 400);
    customer_rate_limit($pdo, $email, 'login');
    $q = $pdo->prepare('SELECT id,email,password_hash,verified_at FROM customer_users WHERE email=:email AND active=1 LIMIT 1');
    $q->execute([':email' => $email]);
    $user = $q->fetch();
    if (!$user || !password_verify($password, (string)$user['password_hash'])) json_response(['error' => 'E-Mail oder Passwort stimmt nicht.'], 401);
    if (empty($user['verified_at'])) json_response(['error' => 'Bitte bestätige zuerst deine E-Mail. Du kannst dir den Bestätigungslink erneut senden lassen.'], 403);
    $loginHash = hash('sha256', 'login|' . strtolower($email));
    $pdo->prepare('DELETE FROM customer_auth_attempts WHERE email_hash=:h')->execute([':h' => $loginHash]);
    customer_session_start();
    session_regenerate_id(true);
    $_SESSION['customer_id'] = (int)$user['id'];
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    $pdo->prepare('UPDATE customer_users SET last_login_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=:id')->execute([':id' => $user['id']]);
    json_response(['ok' => true, 'email' => $email, 'csrf' => $_SESSION['csrf']]);
}

if ($action === 'resend_verify') {
    $email = customer_email($d['email'] ?? '');
    if (!$email) json_response(['error' => 'Bitte gib eine gültige E-Mail-Adresse ein.'], 400);
    customer_rate_limit($pdo, $email, 'resend');
    $q = $pdo->prepare('SELECT id,email,verified_at FROM customer_users WHERE email=:email AND active=1 LIMIT 1');
    $q->execute([':email' => $email]);
    $user = $q->fetch();
    if ($user && empty($user['verified_at'])) customer_send_link($pdo, $user, 'verify');
    json_response(['ok' => true, 'message' => 'Falls ein unbestätigtes Konto zu dieser Adresse existiert, wurde eine E-Mail versendet.']);
}

if ($action === 'forgot') {
    $email = customer_email($d['email'] ?? '');
    if (!$email) json_response(['error' => 'Bitte gib eine gültige E-Mail-Adresse ein.'], 400);
    customer_rate_limit($pdo, $email, 'forgot');
    $q = $pdo->prepare('SELECT id,email FROM customer_users WHERE email=:email AND active=1 AND verified_at IS NOT NULL LIMIT 1');
    $q->execute([':email' => $email]);
    $user = $q->fetch();
    if ($user) customer_send_link($pdo, $user, 'reset');
    json_response(['ok' => true, 'message' => 'Falls ein Konto zu dieser Adresse existiert, wurde eine E-Mail zum Zurücksetzen versendet.']);
}

if ($action === 'reset_password') {
    $token = is_string($d['token'] ?? null) ? $d['token'] : '';
    $password = customer_password($d['password'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $token) || strlen($password) < 12 || strlen($password) > 1024) {
        json_response(['error' => 'Der Link ist ungültig oder das neue Passwort ist zu kurz. Mindestens 12 Zeichen.'], 400);
    }
    $pdo->beginTransaction();
    try {
        // Lock the customer row as well: only one outstanding reset may win,
        // even if multiple reset links were issued close together.
        $q = $pdo->prepare("SELECT t.id,t.customer_id FROM customer_tokens t INNER JOIN customer_users u ON u.id=t.customer_id WHERE t.token_hash=:h AND t.purpose='reset' AND t.used_at IS NULL AND t.expires_at>UTC_TIMESTAMP() LIMIT 1 FOR UPDATE");
        $q->execute([':h' => hash('sha256', $token)]);
        $row = $q->fetch();
        if (!$row) {
            $pdo->rollBack();
            json_response(['error' => 'Dieser Link ist ungültig oder abgelaufen.'], 400);
        }
        $pdo->prepare('UPDATE customer_users SET password_hash=:hash,updated_at=UTC_TIMESTAMP() WHERE id=:id')
            ->execute([':hash' => password_hash($password, PASSWORD_DEFAULT), ':id' => $row['customer_id']]);
        $pdo->prepare("UPDATE customer_tokens SET used_at=UTC_TIMESTAMP() WHERE customer_id=:id AND purpose='reset' AND used_at IS NULL")
            ->execute([':id' => $row['customer_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    json_response(['ok' => true, 'message' => 'Passwort geändert. Du kannst dich jetzt anmelden.']);
}

if ($action === 'logout') {
    customer_session_start();
    $token = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!empty($_SESSION['customer_id']) && ($token === '' || !hash_equals((string)($_SESSION['csrf'] ?? ''), $token))) json_response(['error' => 'Sicherheitsprüfung fehlgeschlagen.'], 403);
    $_SESSION = [];
    session_destroy();
    json_response(['ok' => true]);
}

if ($action === 'delete') {
    $user = customer_require_csrf();
    $password = customer_password($d['password'] ?? '');
    $q = $pdo->prepare('SELECT password_hash FROM customer_users WHERE id=:id');
    $q->execute([':id' => $user['id']]);
    $hash = $q->fetchColumn();
    if (!$hash || !password_verify($password, (string)$hash)) json_response(['error' => 'Passwort stimmt nicht. Bitte melde dich erneut an.'], 401);
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE bookings SET customer_id=NULL WHERE customer_id=:id')->execute([':id' => $user['id']]);
        $pdo->prepare('DELETE FROM customer_tokens WHERE customer_id=:id')->execute([':id' => $user['id']]);
        $pdo->prepare('DELETE FROM customer_users WHERE id=:id')->execute([':id' => $user['id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    $_SESSION = [];
    session_destroy();
    json_response(['ok' => true]);
}

json_response(['error' => 'Unbekannte Aktion.'], 404);
