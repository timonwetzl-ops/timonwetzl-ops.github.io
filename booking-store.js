// Speichern, Freigeben und Wieder-Reservieren von Buchungen.
// Die Firestore-Funktionen werden von außen übergeben (fs), damit dieselbe Logik
// im Browser (echtes Firestore) und in den Tests (Fake-Datenbank) läuft.
//
// Ablauf beim Reservieren:
//   1. Frische Belegung aus "blocked" laden und den ganzen Zeitraum prüfen (deckt auch ältere Buchungen ab).
//   2. In EINER Transaktion pro Kalendertag ein Sperr-Dokument "dayLocks/<Datum>" prüfen und setzen,
//      zusammen mit der Buchung und dem Eintrag in "blocked". Zwei gleichzeitige Buchungen
//      für denselben Tag können so nicht beide durchkommen.

import {
  buildOccupancy, checkRange, lockPlan, slotConflict, slotField, localTodayIso
} from "./booking-logic.js";

export class BookingError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function createStore(fs, db) {
  const { doc, collection, getDocs, runTransaction, setDoc, serverTimestamp } = fs;

  async function freshOccupancy(ignoreId = null) {
    const snap = await getDocs(collection(db, "blocked"));
    const list = [];
    snap.forEach(d => { if (d.id !== ignoreId) list.push(d.data()); });
    return buildOccupancy(list);
  }

  async function assertFree(range, ignoreId = null, today = localTodayIso()) {
    const occ = await freshOccupancy(ignoreId);
    const r = checkRange(occ, range.eventStart, range.eventEnd, today);
    if (!r.ok) throw new BookingError("unavailable", "Der Zeitraum ist nicht mehr verfügbar (" + r.reason + ").");
  }

  // Prüft/setzt die Tages-Sperren innerhalb einer Transaktion.
  async function lockInTx(tx, bookingId, eventStart, eventEnd) {
    const plan = lockPlan(eventStart, eventEnd);
    const refs = plan.map(p => doc(db, "dayLocks", p.date));
    const snaps = [];
    for (const r of refs) snaps.push(await tx.get(r));       // alle Lesezugriffe vor den Schreibzugriffen
    plan.forEach((p, i) => {
      const data = snaps[i].exists() ? snaps[i].data() : undefined;
      if (slotConflict(data, p.slot, bookingId)) {
        throw new BookingError("unavailable", "Der Zeitraum wurde gerade von jemand anderem gebucht.");
      }
    });
    plan.forEach((p, i) => tx.set(refs[i], { [slotField(p.slot)]: bookingId }, { merge: true }));
  }

  // Neue Buchung speichern. booking = vollständiges Buchungsdokument (ohne createdAt).
  async function reserve(bookingId, booking, today = localTodayIso()) {
    const range = { eventStart: booking.eventStart, eventEnd: booking.eventEnd };
    await assertFree(range, null, today);
    const bookingRef = doc(db, "bookings", bookingId);
    const blockedRef = doc(db, "blocked", bookingId);
    const blocked = { startDate: booking.startDate, endDate: booking.endDate, uid: booking.uid,
                      eventStart: booking.eventStart, eventEnd: booking.eventEnd };
    try {
      await runTransaction(db, async tx => {
        await lockInTx(tx, bookingId, range.eventStart, range.eventEnd);
        tx.set(bookingRef, { ...booking, createdAt: serverTimestamp() });
        tx.set(blockedRef, blocked);
      });
      return { atomic: true };
    } catch (e) {
      if (e instanceof BookingError) throw e;
      if (e && e.code === "permission-denied") {
        // Die Sicherheitsregeln für "dayLocks" sind noch nicht freigeschaltet:
        // wie bisher speichern (mit frischer Prüfung direkt davor), damit Buchungen nicht ausfallen.
        console.warn("dayLocks nicht beschreibbar – Fallback ohne atomare Sperre. Bitte firestore.rules.beispiel einspielen.");
        await assertFree(range, null, today);
        await setDoc(bookingRef, { ...booking, createdAt: serverTimestamp() });
        try { await setDoc(blockedRef, blocked); } catch (err) { console.warn("Sperrliste nicht geschrieben", err); }
        return { atomic: false };
      }
      throw e;
    }
  }

  // Buchung freigeben (abgelehnt/storniert): Sperren und Eintrag in "blocked" entfernen.
  async function release(bookingId, booking) {
    const blockedRef = doc(db, "blocked", bookingId);
    await runTransaction(db, async tx => {
      const plan = booking.eventStart && booking.eventEnd ? lockPlan(booking.eventStart, booking.eventEnd) : [];
      const refs = plan.map(p => doc(db, "dayLocks", p.date));
      const snaps = [];
      for (const r of refs) snaps.push(await tx.get(r));
      plan.forEach((p, i) => {
        const f = slotField(p.slot);
        if (snaps[i].exists() && snaps[i].data()[f] === bookingId) tx.set(refs[i], { [f]: null }, { merge: true });
      });
      tx.delete(blockedRef);
    });
  }

  // Abgelehnte Buchung wieder aktivieren: nur wenn der Zeitraum noch frei ist.
  async function reactivate(bookingId, booking, today = localTodayIso()) {
    const hasEvent = booking.eventStart && booking.eventEnd;
    const blockedRef = doc(db, "blocked", bookingId);
    const blocked = { startDate: booking.startDate, endDate: booking.endDate, uid: booking.uid,
                      ...(hasEvent ? { eventStart: booking.eventStart, eventEnd: booking.eventEnd } : {}) };
    // Frische Prüfung gegen alle anderen Buchungen (Datum in der Vergangenheit/Vorlaufzeit zählt hier nicht).
    const occ = await freshOccupancy(bookingId);
    const start = booking.startDate, end = booking.endDate || booking.startDate;
    const clash = occ.full.has(start) || occ.pm.has(start) || occ.full.has(end) || occ.am.has(end);
    let interior = false;
    for (let d = start; d <= end; d = nextDay(d)) {
      if (d !== start && d !== end && (occ.full.has(d) || occ.pm.has(d) || occ.am.has(d))) interior = true;
    }
    if (clash || interior) throw new BookingError("unavailable", "Der Zeitraum ist inzwischen anderweitig vergeben.");
    await runTransaction(db, async tx => {
      if (hasEvent) await lockInTx(tx, bookingId, booking.eventStart, booking.eventEnd);
      tx.set(blockedRef, blocked);
    });
  }

  return { reserve, release, reactivate, freshOccupancy };
}

function nextDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}
