# Firebase – Einrichtung für Candy Bar Vogtland

## Was diese Änderung voraussetzt

1. In Firebase Authentication muss **Anonym** als Anmeldemethode aktiviert werden.
   Die Buchungsseite meldet Gäste damit anonym an, damit jede Buchung eine eigene UID erhält.
2. Die Regeln aus `firestore.rules` müssen in Firebase Console → Firestore Database → Regeln veröffentlicht werden.
3. Die Datei `storage.rules` ist vorbereitet, aber Storage ist derzeit im Firebase-Projekt nicht eingerichtet. Sie muss erst veröffentlicht werden, falls Storage später aktiviert wird.

## Buchungen und Kalender

- Buchung und öffentliche Kalendersperre werden gemeinsam gespeichert.
- Zusätzliche Tages-Sperren verhindern konkurrierende Buchungen derselben Zeitabschnitte.
- Statusänderung und Freigabe/Wiederbelegung werden im Dashboard gemeinsam transaktional ausgeführt.
- Gäste sehen nur die anonymisierte Sperrliste, keine Buchungsdetails.
- Kundenkonten können nur eigene Buchungen lesen.
- Admin-Zugriff setzt das verifizierte Admin-Konto voraus.

## Grenzen ohne Backend

Eine automatische E-Mail an den Betreiber wird von der Website aktuell noch nicht verschickt. Dafür ist ein vertrauenswürdiger Maildienst bzw. Backend nötig. Zugangsdaten für SMTP oder private Mail-API-Schlüssel dürfen nicht in JavaScript im Browser stehen. Diese Änderung behauptet daher nicht, dass E-Mail-Benachrichtigungen bereits funktionieren.

## Wichtig

Die Regeln und Änderungen zuerst in einer Testumgebung prüfen. Alte Buchungen, die vor Einführung der Tages-Sperren angelegt wurden, müssen bei der Umstellung kontrolliert und gegebenenfalls über das Dashboard erneut gesperrt werden.
