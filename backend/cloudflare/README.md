# Backend-Entwurf – Candy Bar Vogtland

## Architektur

Dieser Ordner enthält einen **separaten Backend-Entwurf** für Cloudflare Workers + D1. Er ändert die bestehende Website nicht und ist noch nicht mit den Live-Seiten verbunden.

- Worker: API und serverseitige Validierung
- D1: Buchungen und eindeutige Halbtag-Sperren
- Turnstile: Bot-Schutz beim öffentlichen Buchungsformular
- Resend: E-Mail-Benachrichtigung aus dem Backend
- Firebase Authentication: bestehendes bestätigtes Admin-Konto wird für Dashboard-API-Aufrufe geprüft

## Kostenrahmen (Free-Tarife, keine Garantie)

Laut den aktuellen offiziellen Preis-/Limitseiten bieten Cloudflare Workers Free 100.000 Requests pro Tag und D1 Free 5 Mio. gelesene sowie 100.000 geschriebene Zeilen pro Tag; D1 hat im Free-Tarif 500 MB pro Datenbank. Resend Free nennt 3.000 E-Mails pro Monat und 100 pro Tag. Bei Überschreitung können Dienste Anfragen ablehnen oder ein Upgrade verlangen. Vor Aktivierung müssen die aktuellen Limits geprüft werden.

## Dateien

- `worker.js`: API-Endpunkte
- `schema.sql`: D1-Tabellen
- `wrangler.toml.example`: Konfigurationsvorlage

## Endpunkte

- `GET /api/blocked`: nur öffentliche Datumsbereiche
- `POST /api/bookings`: validiert und speichert eine Buchung atomar mit Halbtag-Sperren; versucht danach die Betreiber-E-Mail zu senden
- `GET /api/admin/bookings`: Buchungsliste nur mit gültigem Firebase-ID-Token des bestätigten Admin-Kontos
- `PATCH /api/admin/bookings/:id`: Buchungs-/Zahlungsstatus; Freigabe und Wiederbelegung werden in einer D1-Batch-Transaktion geändert

## Wichtige Hinweise

1. Für öffentliche Buchungen ist Turnstile erforderlich. `TURNSTILE_SECRET_KEY` muss als Worker-Secret gesetzt werden; ohne Secret lehnt die API Buchungen ab.
2. Für E-Mails müssen `RESEND_API_KEY`, `RESEND_FROM` und `NOTIFY_EMAIL` als Secrets/Variablen gesetzt sein. Die Absenderdomain muss bei Resend verifiziert sein. Ohne E-Mail-Konfiguration wird die Buchung trotzdem gespeichert und `emailStatus` meldet `not_configured`.
3. Firebase-ID-Tokens werden anhand der Google Secure Token JWKs geprüft. `FIREBASE_PROJECT_ID` und `ADMIN_EMAIL` müssen exakt stimmen.
4. Paketpreise sind vorläufig serverseitig auf 89 €, 129 € und 229 € festgelegt; jeder weitere Veranstaltungstag kostet 89 €. Änderungen im bisherigen Firebase-Dashboard werden von diesem Entwurf noch nicht übernommen.
5. Dieser Worker ist noch nicht produktionsreif. Es fehlen Integrationstests gegen eine echte D1-Testdatenbank, Turnstile-Konfiguration, E-Mail-Domainprüfung und Migration der vorhandenen Firebase-Buchungen.
6. Die vorhandenen Seiten verwenden derzeit weiterhin Firebase. **Nicht deployen und nicht die Buchungsseite umstellen**, bevor die Migration und alle Tests abgeschlossen sind.

## Datenbank anlegen

Mit Wrangler (lokal installiert) kann nach Einrichtung eines Cloudflare-Kontos eine D1-Datenbank angelegt und `schema.sql` ausgeführt werden. Die konkrete Einrichtung erfolgt erst nach Freigabe und Prüfung der Konfiguration. Keine Schlüssel in Git committen.
