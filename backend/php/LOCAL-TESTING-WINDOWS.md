# Lokal auf Windows testen (XAMPP)

Diese Anleitung startet die PHP-Version der Website auf deinem eigenen Windows-Laptop. Sie veröffentlicht nichts im Internet. Nutze dafür den Branch `firebase-security-fix`, nicht `main`.

## 1. Aktuellen Projektstand holen

Öffne PowerShell im Projektordner und führe aus:

```powershell
git switch firebase-security-fix
git pull origin firebase-security-fix
```

Wenn der Branch lokal noch nicht existiert:

```powershell
git fetch origin
git switch --track origin/firebase-security-fix
```

## 2. XAMPP installieren und starten

1. Installiere XAMPP für Windows mit PHP 8.2 oder neuer.
2. Öffne das XAMPP Control Panel.
3. Starte **Apache** und **MySQL**.
4. Lege den Projektordner in `C:\\xampp\\htdocs\\candybar` ab. Der Ordner muss direkt die Website-Dateien wie `index.html`, `backend` und `assets` enthalten.
5. Öffne `http://localhost/candybar/` im Browser.

Falls dein Projekt bereits an einem anderen Ort liegt, kannst du es stattdessen nach `C:\\xampp\\htdocs\\candybar` kopieren. Arbeite nicht gleichzeitig in zwei verschiedenen Kopien.

## 3. Lokale Datenbank anlegen

1. Öffne `http://localhost/phpmyadmin/`.
2. Erstelle eine Datenbank mit dem Namen `candybar` und der Kollation `utf8mb4_unicode_ci`.
3. Wähle die Datenbank aus und importiere `backend/php/schema.sql`.

Das ist eine frische lokale Testdatenbank. Importiere das Schema nicht in eine Datenbank mit echten Kundendaten.

## 4. Lokale PHP-Konfiguration erstellen

Kopiere `backend/php/config.example.php` und nenne die Kopie `backend/php/config.php`.

Passe in der lokalen Kopie die Datenbankwerte so an (typische XAMPP-Standardeinstellung):

```php
'db' => [
    'dsn' => 'mysql:host=127.0.0.1;port=3306;dbname=candybar;charset=utf8mb4',
    'user' => 'root',
    'password' => '',
],
```

Setze außerdem:

- `app.base_url` auf `http://localhost/candybar`
- `security.rate_limit_secret` auf einen eigenen zufälligen lokalen Wert. Erzeuge ihn z. B. mit `C:\\xampp\\php\\php.exe -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`.

Die leere Datenbank-Passwortangabe ist nur für eine lokale Standard-XAMPP-Installation gedacht. Verwende diese Zugangsdaten niemals auf einem öffentlichen Server. `config.php` darf niemals zu GitHub hochgeladen werden.

## 5. Lokales Admin-Konto erstellen

Öffne PowerShell im Projektordner und führe aus:

```powershell
C:\\xampp\\php\\php.exe backend/php/create-admin.php admin@localhost.test
```

Gib ein Testpasswort mit mindestens 12 Zeichen ein. Verwende kein Passwort, das du woanders nutzt.

Danach kannst du im Browser die Admin-Anmeldung öffnen: `http://localhost/candybar/anmelden.html`.

## 6. Was lokal getestet werden kann

- Website-Seiten und Navigation
- PHP-Verbindung zur lokalen MariaDB-Datenbank
- Paketdaten und Kalender-/Buchungsendpunkte
- Admin-Anmeldung, Dashboard und Bearbeitung von Testdaten
- Kontaktformular und Uploads mit lokalen Testdaten
- Kundenfunktionen, soweit kein echter E-Mail-Versand erforderlich ist

## 7. Was lokal noch nicht vollständig getestet werden kann

- Echte E-Mail-Zustellung, Verifizierung und Passwort-Reset: Der aktuelle Versand nutzt PHP `mail()`; XAMPP ist dafür normalerweise nicht eingerichtet.
- Google- und Apple-Anmeldung: OAuth ist noch nicht implementiert.
- HTTPS, echte Domain, Hetzner-Datenbank und produktive Serverrechte.
- Vollständige Live-Buchungstests mit echten Kunden.

Verwende ausschließlich erfundene Testdaten. Trage keine echten Kundendaten ein und veröffentliche die lokale Testversion nicht. Vor dem Livegang müssen E-Mail, HTTPS, Backups, Serverkonfiguration und die vollständigen Abläufe auf dem Hosting geprüft werden.
