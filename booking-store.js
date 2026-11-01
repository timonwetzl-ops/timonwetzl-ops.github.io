// Sichere Buchungsspeicherung mit Firestore-Transaktionen.
// Jeder Kalendertag erhält eine Sperre (am / pm / full). Bei konkurrierenden
// Anfragen kann Firestore nur eine Transaktion für denselben Slot durchlassen.

import {
  createAvailability, addDays, fmt, LEAD_DAYS, periodFor,
  lockPlan, slotField, slotConflict
} from "./booking-logic.js";

export class BookingError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function createStore(fs, db) {
  const { doc, collection, getDocs, runTransaction, serverTimestamp } = fs;

  async function assertFree(eventStart, eventEnd, ignoreId = null) {
    const snap = await getDocs(collection(db, "blocked"));
    const blocks = [];
    snap.forEach(d => {
      if (d.id !== ignoreId) {
        const b = d.data();
        if (b.startDate) blocks.push({ S: b.startDate, E: b.endDate || b.startDate });
      }
    });
    const firstBookable = addDays(fmt(new Date()), LEAD_DAYS);
    const availability = createAvailability(blocks, firstBookable);
    if (!availability.validEventRange(eventStart, eventEnd)) {
      throw new BookingError("unavailable", "Dieser Zeitraum ist leider nicht mehr frei. Bitte wähle einen anderen.");
    }
  }

  async function lockInTransaction(tx, bookingId, eventStart, eventEnd) {
    const plan = lockPlan(eventStart, eventEnd);
    const refs = plan.map(p => doc(db, "dayLocks", p.date));
    const snapshots = [];
    for (const ref of refs) snapshots.push(await tx.get(ref));
    for (let i = 0; i < plan.length; i++) {
      const data = snapshots[i].exists() ? snapshots[i].data() : {};
      if (slotConflict(data, plan[i].slot) && data[slotField(plan[i].slot)] !== bookingId) {
        throw new BookingError("unavailable", "Der Zeitraum wurde gerade von jemand anderem reserviert.");
      }
    }
    for (let i = 0; i < plan.length; i++) {
      tx.set(refs[i], { [slotField(plan[i].slot)]: bookingId }, { merge: true });
    }
  }

  async function clearLocksInTransaction(tx, bookingId, eventStart, eventEnd) {
    const plan = lockPlan(eventStart, eventEnd);
    const refs = plan.map(p => doc(db, "dayLocks", p.date));
    const snapshots = [];
    for (const ref of refs) snapshots.push(await tx.get(ref));
    for (let i = 0; i < plan.length; i++) {
      const field = slotField(plan[i].slot);
      if (snapshots[i].exists() && snapshots[i].data()[field] === bookingId) {
        tx.set(refs[i], { [field]: null }, { merge: true });
      }
    }
  }

  function blockedData(booking) {
    return {
      startDate: booking.startDate,
      endDate: booking.endDate || booking.startDate,
      eventStart: booking.eventStart,
      eventEnd: booking.eventEnd,
      uid: booking.uid
    };
  }

  async function reserve(bookingId, booking) {
    await assertFree(booking.eventStart, booking.eventEnd);
    const bookingRef = doc(db, "bookings", bookingId);
    const blockedRef = doc(db, "blocked", bookingId);
    await runTransaction(db, async tx => {
      await lockInTransaction(tx, bookingId, booking.eventStart, booking.eventEnd);
      tx.set(bookingRef, { ...booking, createdAt: serverTimestamp() });
      tx.set(blockedRef, blockedData(booking));
    });
    return { atomic: true };
  }

  // Status und Kalender werden gemeinsam geändert, damit Ablehnen/Freigeben
  // nicht nur eine der beiden Datenstellen aktualisiert.
  async function setStatus(bookingId, bookingStatus) {
    const bookingRef = doc(db, "bookings", bookingId);
    const blockedRef = doc(db, "blocked", bookingId);
    await runTransaction(db, async tx => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists()) throw new BookingError("not-found", "Buchung nicht gefunden.");
      const booking = snap.data();
      const eventStart = booking.eventStart || booking.firstEventDay || booking.eventDate;
      const eventEnd = booking.eventEnd || booking.lastEventDay || eventStart;
      if (!eventStart) throw new BookingError("invalid-booking", "Der Buchung fehlen Datumsangaben.");
      if (bookingStatus === "abgelehnt") {
        await clearLocksInTransaction(tx, bookingId, eventStart, eventEnd);
        tx.delete(blockedRef);
      } else {
        await lockInTransaction(tx, bookingId, eventStart, eventEnd);
        tx.set(blockedRef, blockedData({
          ...booking,
          eventStart,
          eventEnd,
          startDate: booking.startDate || addDays(eventStart, -1),
          endDate: booking.endDate || addDays(eventEnd, 1)
        }));
      }
      tx.update(bookingRef, { bookingStatus });
    });
  }

  return { reserve, setStatus };
}
