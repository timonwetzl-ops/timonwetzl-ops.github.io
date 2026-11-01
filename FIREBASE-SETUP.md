# Firebase – Status des Buchungssystem-Entwurfs

## WICHTIG: Noch nicht veröffentlichen

Dieser Branch ist ein technischer Entwurf und **nicht produktionsbereit**. Bitte die Regeln aus `firestore.rules` noch nicht in Firebase veröffentlichen und den Pull Request nicht zusammenführen.

Die Firestore-Transaktion setzt Buchung, Kalendersperre und Tages-Sperren gemeinsam. Das schützt den normalen Ablauf über das Buchungsformular vor zeitgleichen Doppelbuchungen. Die Firestore-Regeln erzwingen derzeit aber noch nicht vollständig, dass ein direkter Datenbankzugriff für jeden einzelnen Veranstaltungstag sämtliche korrekten Tages-Sperren setzt. Ein Angreifer könnte diese Prüfung umgehen. Eine reine Browser-Lösung kann das nicht zuverlässig absichern.

## Was für den Entwurf benötigt wird

1. Firebase Authentication: anonyme Anmeldung für Gäste.
2. Firestore: Regeln erst nach Ergänzung und Test eines vertrauenswürdigen Backend-Endpunkts veröffentlichen.
3. Storage: Im Firebase-Projekt ist Storage derzeit nicht eingerichtet. Die Datei `storage.rules` allein aktiviert es nicht.

## Aktueller Funktionsstand

- Das Buchungsformular meldet Gäste anonym an.
- Buchung, öffentlicher Kalendereintrag und Tages-Sperren werden in einer Firestore-Transaktion geschrieben.
- Die Tages-Sperren unterscheiden Abholung am Nachmittag, Veranstaltungstage ganztägig und Rückgabe am Vormittag.
- Statusänderungen im Dashboard aktualisieren Buchung und Sperren gemeinsam.
- Gäste sehen die öffentliche Sperrliste, nicht die privaten Buchungsdetails.
- Der Admin-Zugriff verlangt das bestätigte Admin-Konto.

## Noch offen

- **E-Mail-Benachrichtigung:** Es wird noch keine automatische E-Mail bei einer neuen Buchung verschickt. Dafür braucht es einen vertrauenswürdigen Maildienst oder Backend. Private Mail-Zugangsdaten dürfen nicht im Browser-JavaScript liegen.
- **Serverseitige Buchungsprüfung:** Ein Backend muss Buchungsdaten validieren und alle Tages-Sperren verbindlich setzen.
- **Tests:** Die Regeln und Transaktionen wurden noch nicht in einer Firebase-Testumgebung ausgeführt.
- **Alte Buchungen:** Vor einer Umstellung müssen bestehende Buchungen berücksichtigt und ihre Zeiträume gesperrt werden.
- **Bild-Uploads:** Storage ist derzeit nicht eingerichtet; Uploads funktionieren deshalb nicht verlässlich.

## Nächster sinnvoller Schritt

Die Buchungslogik braucht einen kleinen vertrauenswürdigen Backend-Endpunkt. Erst danach sollten die Regeln getestet und veröffentlicht werden. Bis dahin bleibt die bisherige Live-Website auf `main` unverändert.
