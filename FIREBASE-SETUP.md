# Firebase – Einrichtung für das Buchungssystem

## Status

Cloud Functions verwenden Node.js 22 (von Firebase unterstützt).

Der Branch `firebase-security-fix` enthält den Übergangsentwurf mit:
- Callable Functions `createBooking` und `createContact` für Buchungs- und Kontaktanfragen
- serverseitige IP- und Nutzer-Begrenzung gegen massenhafte Anfragen
- verstecktes Honeypot-Feld im Kontaktformular
- transaktionalen Tages-Sperren inklusive zusätzlicher Prüfung älterer Buchungen und Sperreinträge
- Firestore-Regeln für Buchungen, Kalenderdaten und Kontaktanfragen
- Storage-Regeln für Bilddateien
- Admin-Dashboard mit Firebase-Authentication

**Noch nicht veröffentlichen und PHP nicht löschen.** Die Integration und Tests im Firebase-Projekt sind noch erforderlich. Der Pull Request bleibt absichtlich ein Entwurf.

## Einmalige Einrichtung in der Firebase Console

1. Projekt `candybar-a33ca` öffnen.
2. Authentication → Sign-in method → **Anonym** aktivieren. Das Buchungsformular benötigt diese Anmeldung für Gäste.
3. Prüfen, dass Firestore Database und Firebase Storage eingerichtet sind.
4. Die Callable Functions verwenden derzeit serverseitige Rate-Limits: höchstens 8 Buchungsversuche pro IP und 4 pro angemeldetem Nutzer innerhalb von 24 Stunden sowie 3 Kontaktanfragen pro IP und Stunde. Die IP wird nur als SHA-256-Hash in `rateLimits` gespeichert.
5. App Check in Firebase registrieren. Zuerst die Website mit dem gewählten Anbieter und dem öffentlichen Site-Key verbinden und in der Testumgebung prüfen. Erst danach `enforceAppCheck: true` bei `createBooking` und `createContact` aktivieren. Vorher darf App Check serverseitig nicht erzwungen werden, sonst schlagen legitime Anfragen fehl. Bis zur Aktivierung sind Rate-Limits und Honeypot zusätzlicher, aber kein vollständiger Bot-Schutz.
6. Für automatische E-Mail-Benachrichtigungen die Firebase Extension **Trigger Email** installieren und mit einem SMTP-Anbieter konfigurieren. Die Erweiterung muss die Collection `mail` überwachen. Die Function legt dort eine Nachricht an das Admin-Postfach `vermietung.candybar@gmail.com` ab.
7. Für Cloud Functions kann der Blaze-Tarif erforderlich sein. Dabei können nutzungsabhängige Kosten entstehen. Vor einer Aktivierung müssen die Kosten und das Budget geprüft werden.

## Firestore-TTL für Rate-Limits aktivieren\n\nDie Functions schreiben `expiresAt` als Firestore-Timestamp. Damit alte Zähler automatisch gelöscht werden, muss die TTL-Richtlinie einmalig in der Firebase Console eingerichtet werden:\n\n1. Firestore Database öffnen.\n2. Den Bereich **Time-to-live (TTL)** öffnen.\n3. Eine Richtlinie für Collection Group `rateLimits` und Feld `expiresAt` erstellen.\n4. Speichern und warten, bis der Status der Richtlinie aktiv ist. Die Löschung erfolgt anschließend automatisch und nicht sekundengenau.\n\nOhne diese Richtlinie funktionieren die Rate-Limits weiterhin; die alten Zähler werden dann nur nicht automatisch aufgeräumt.\n\n## Deployment über GitHub Actions

Die Datei `.github/workflows/deploy-firebase.yml` ist für GitHub Actions vorbereitet. Sie veröffentlicht:
- Cloud Functions
- Firestore-Regeln
- Storage-Regeln

Automatisches Deployment erfolgt nur nach Änderungen auf `main`. Der manuelle Workflow-Start ist ebenfalls vorgesehen. Die Anmeldung bei Google Cloud erfolgt über **Workload Identity Federation**.

Es wird **kein JSON-Servicekonto-Schlüssel und kein GitHub-Secret mit einem privaten Schlüssel** benötigt. Der Workload-Identity-Provider ist auf dieses Repository und den Branch `main` beschränkt.

Wichtig: Der Workflow darf erst ausgeführt werden, wenn die Änderungen geprüft und für die Veröffentlichung freigegeben wurden. Der aktuelle Pull Request ist ein Entwurf und darf nicht allein zum Testen zusammengeführt werden.

## Noch zu testen

- Anonyme Anmeldung im echten Firebase-Projekt
- Function-Deployment in `europe-west3`
- Buchung mit freien Tagen
- Zwei gleichzeitige Buchungen für denselben Zeitraum (nur eine darf durchgehen)
- Bereits belegte Tage und 14-Tage-Vorlauf\n- Alte Buchungen ohne `dayLocks` sowie alte `blocked`-Einträge müssen serverseitig jede Überschneidung verhindern
- Admin-Dashboard: Statusänderungen und Tages-Sperren
- E-Mail-Auslösung über „Trigger Email“
- Bild-Upload, Ersetzen und Löschen über Firebase Storage
- Bestehende Buchungen: vor dem Umschalten müssen alte Buchungen und Sperren übernommen bzw. geprüft werden
- Kontaktformular: Rate-Limit (3 Anfragen je IP und Stunde), Honeypot und serverseitige Validierung prüfen
- Buchungsformular: Rate-Limit (8 Anfragen je IP und 4 je Nutzer pro 24 Stunden) prüfen
- App Check in Firebase registrieren und nach Einrichtung in beiden Callable Functions erzwingen
- Firestore TTL für `rateLimits.expiresAt` in der Firebase Console aktivieren; die Functions setzen das Ablaufdatum automatisch auf zwei Zeitfenster nach dem jeweiligen Versuch

## Sicherheits- und Veröffentlichungsgrenzen

Die Function nutzt das Admin-SDK und umgeht dadurch bewusst die Firestore-Regeln. Browser-Clients dürfen Buchungen und Tages-Sperren nicht direkt schreiben.

Öffentliche Kalenderdaten enthalten nur die für die Verfügbarkeitsanzeige erforderlichen Datumsfelder, keine Kunden-UID oder Kontaktdaten.

Die Regeln und Functions müssen zuerst in einer Testumgebung geprüft werden. Bestehende Website- und PHP-Dateien bleiben bis zur abgeschlossenen Integration und Migration unverändert.

**Nicht deployen und nicht zusammenführen**, bis Integration, Migration, Sicherheitsprüfung und Tests abgeschlossen sind.
