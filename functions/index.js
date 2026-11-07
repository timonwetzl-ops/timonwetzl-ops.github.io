const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();
const ADMIN_EMAIL = "vermietung.candybar@gmail.com";
const EXTRA_DAY_PRICE = 89;
const DEPOSIT = 100;
const DEFAULT_PRICES = { basic: 89, comfort: 129, rundumsorglos: 229 };
const PACKAGE_NAMES = { basic: "Basic", comfort: "Comfort", rundumsorglos: "Rundum sorglos" };

function berlinToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function shiftDate(iso, days) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function validDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)
    && !Number.isNaN(Date.parse(s + "T00:00:00Z"))
    && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
}
function priceFrom(value, fallback) {
  const n = Number.parseFloat(String(value ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
function lockPlan(start, end) {
  const plan = [{ date: shiftDate(start, -1), slot: "pm" }];
  for (let d = start; d <= end; d = shiftDate(d, 1)) plan.push({ date: d, slot: "full" });
  plan.push({ date: shiftDate(end, 1), slot: "am" });
  return plan;
}
function conflicts(data, slot) {
  if (slot === "full") return !!(data.full || data.am || data.pm);
  if (slot === "pm") return !!(data.full || data.pm);
  if (slot === "am") return !!(data.full || data.am);
  return true;
}
function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

exports.createBooking = onCall({ region: "europe-west3" }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Bitte lade die Seite neu.");
  const input = request.data || {};
  const name = clean(input.name, 120);
  const email = clean(input.email, 254);
  const phone = clean(input.phone, 60);
  const location = clean(input.location, 300);
  const message = clean(input.message, 3000);
  const packageId = clean(input.packageId, 40);
  const start = input.eventStart;
  const end = input.eventEnd;

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpsError("invalid-argument", "Bitte gib einen Namen und eine gültige E-Mail-Adresse ein.");
  if (!Object.hasOwn(DEFAULT_PRICES, packageId))
    throw new HttpsError("invalid-argument", "Bitte wähle ein gültiges Paket.");
  if (!validDate(start) || !validDate(end) || end < start)
    throw new HttpsError("invalid-argument", "Der ausgewählte Zeitraum ist ungültig.");
  const days = Math.round((Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000) + 1;
  if (days < 1 || days > 14)
    throw new HttpsError("invalid-argument", "Ein Zeitraum darf höchstens 14 Veranstaltungstage umfassen.");
  if (shiftDate(berlinToday(), 14) > start)
    throw new HttpsError("failed-precondition", "Buchungen sind frühestens 14 Tage im Voraus möglich.");

  const packageSnap = await db.doc("packages/" + packageId).get();
  const basePrice = priceFrom(packageSnap.exists ? packageSnap.data().price : null, DEFAULT_PRICES[packageId]);
  const totalPrice = basePrice + (days - 1) * EXTRA_DAY_PRICE;
  const bookingRef = db.collection("bookings").doc();
  const blockedRef = db.collection("blocked").doc(bookingRef.id);
  const plan = lockPlan(start, end);
  const lockRefs = plan.map(p => db.doc("dayLocks/" + p.date));
  const booking = {
    uid: request.auth.uid, name, email, phone, location,
    package: PACKAGE_NAMES[packageId],
    firstEventDay: start, lastEventDay: end, eventStart: start, eventEnd: end,
    eventDays: days, startDate: shiftDate(start, -1), endDate: shiftDate(end, 1),
    eventDate: start, basePrice, extraDayPrice: EXTRA_DAY_PRICE,
    price: totalPrice, deposit: DEPOSIT, message,
    bookingStatus: "neu", paymentStatus: "offen", paidAmount: 0,
    createdAt: FieldValue.serverTimestamp()
  };

  await db.runTransaction(async tx => {
    const snapshots = [];
    for (const ref of lockRefs) snapshots.push(await tx.get(ref));
    for (let i = 0; i < plan.length; i++) {
      const current = snapshots[i].exists ? snapshots[i].data() : {};
      if (conflicts(current, plan[i].slot))
        throw new HttpsError("already-exists", "Der Zeitraum wurde gerade von jemand anderem reserviert. Bitte wähle andere Tage.");
    }
    for (let i = 0; i < plan.length; i++) {
      tx.set(lockRefs[i], { [plan[i].slot]: bookingRef.id }, { merge: true });
    }
    tx.create(bookingRef, booking);
    tx.create(blockedRef, {
      uid: request.auth.uid, startDate: booking.startDate, endDate: booking.endDate,
      eventStart: start, eventEnd: end
    });
    // Wird nur versendet, wenn die Firebase-Extension „Trigger Email“ eingerichtet ist.
    tx.create(db.collection("mail").doc(), {
      to: [ADMIN_EMAIL],
      message: {
        subject: "Neue Candybar-Buchungsanfrage",
        text: `Neue Buchungsanfrage von ${name}.\nE-Mail: ${email}\nTelefon: ${phone}\nOrt: ${location}\nPaket: ${booking.package}\nZeitraum: ${start} bis ${end}\nPreis: ${totalPrice.toFixed(2)} €\nNachricht: ${message}`
      }
    });
  });
  return { bookingId: bookingRef.id, priceCents: Math.round(totalPrice * 100), depositCents: DEPOSIT * 100 };
});
