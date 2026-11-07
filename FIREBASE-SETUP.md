# Firebase – Einrichtung für das Buchungssystem

## Status
Der Branch `firebase-security-fix` enthält jetzt:
- Buchungsformular mit Firebase statt PHP-API
- Firebase Callable Function `createBooking` als vertrauenswürdigen Buchungs-Endpunkt
- Transaktionale Tages-Sperren (Abholung nachmittags, Veranstaltung ganztägig, Rückgabe vormittags)
- Firestore-Regeln, die öffentliche Schreibzugriffe auf Buchungen und Kalendersperren blockieren
- Mail-Dokument an das Admin-Postfach als Vorbereitung für die Firebase-Erweiterung „Trigger Email“

**Noch nicht veröffentlichen und PHP noch nicht löschen.** Die Einrichtung und Tests im Firebase-Projekt sind noch erforderlich.

## Einmalige Einrichtung in der Firebase Console

1. Projekt `candybar-a33ca` öffnen.
2. Authentication → Sign-in method → **Anonym** aktivieren. Das Formular braucht diese Anmeldung für Gäste.
3. Prüfen, dass Firestore Database bereits eingerichtet ist.
4. Für automatische E-Mail-Benachrichtigungen die Firebase Extension **Trigger Email** installieren und mit einem SMTP-Anbieter konfigurieren. Die Erweiterung muss die Collection `mail` überwachen. Die Funktion legt dort nur eine Nachricht an das Admin-Postfach `vermietung.candybar@gmail.com` ab.
5. Für Cloud Functions muss das Firebase-Projekt gegebenenfalls auf den Blaze-Tarif umgestellt werden. Firebase kann dafür nutzungsabhängige Kosten berechnen.

## Deployment (im Projektordner)

Mit installiertem Firebase CLI und angemeldetem Projektkonto:

```bash
npm --prefix functions install
firebase deploy --only functions:createBooking
firebase deploy --only firestore:rules
```

Vorher sicherstellen, dass das aktive Firebase-Projekt wirklich `candybar-a33ca` ist.

## Noch zu testen

- Anonyme Anmeldung im echten Firebase-Projekt
- Function-Deployment in `europe-west3`
- Buchung mit freien Tagen
- Zwei gleichzeitige Buchungen für denselben Zeitraum (nur eine darf durchgehen)
- Bereits belegte Tage sowie 14-Tage-Vorlauf
- Admin-Dashboard: Bestätigen und Ablehnen muss die Tages-Sperren korrekt ändern
- E-Mail-Auslösung über „Trigger Email“
- Bestehende Buchungen: vor dem Umschalten müssen alte Buchungen und Sperren übernommen bzw. geprüft werden
- Bild-Uploads: Firebase Storage muss separat eingerichtet werden

## Wichtig
Die Function nutzt Admin-SDK und umgeht dadurch bewusst die Firestore-Regeln. Browser-Clients können Buchungen und Tages-Sperren nicht direkt schreiben. Die Regeln müssen erst nach Tests im Firebase Emulator oder in einem Testprojekt veröffentlicht werden.
