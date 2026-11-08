const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { createHash } = require("node:crypto");

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

function requestIp(request) {
  const ip = request.rawRequest && request.rawRequest.ip;
  if (typeof ip !== "string" || !ip) {
    throw new HttpsError("unavailable", "Der Sicherheitscheck ist gerade nicht verfügbar. Bitte versuche es später erneut.");
  }
  return createHash("sha256").update(ip).digest("hex");
}

async function consumeLimit(scope, identity, max, windowMs) {
  const id = createHash("sha256").update(scope + ":" + identity).digest("hex");
  const ref = db.collection("rateLimits").doc(id);
  const now = Date.now();
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const active = Number(data.windowStart) > 0 && now - Number(data.windowStart) < windowMs;
    const count = active ? Number(data.count || 0) : 0;
    if (count >= max) {
      throw new HttpsError("resource-exhausted", "Zu viele Anfragen in kurzer Zeit. Bitte versuche es später erneut.");
    }
    tx.set(ref, {
      windowStart: active ? data.windowStart : now,
      count: count + 1,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now + 2 * windowMs)
    });
  });
}

async function enforceRateLimit(request, scope, maxPerIp, windowMs, maxPerUser) {
  const ipHash = requestIp(request);
  await consumeLimit(scope + ":ip", ipHash, maxPerIp, windowMs);
  if (maxPerUser && request.auth) {
    await consumeLimit(scope + ":user", request.auth.uid, maxPerUser, windowMs);
  }
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
  await enforceRateLimit(request, "booking", 8, 24 * 60 * 60 * 1000, 4);

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
    // Alte Buchungen aus dem bisherigen System haben eventuell noch keine dayLocks.
    // Deshalb werden die öffentlichen Sperreinträge UND vorhandene Buchungen
    // innerhalb derselben Transaktion zusätzlich auf Überschneidungen geprüft.
    const blockedQuery = db.collection("blocked").where("startDate", "<=", booking.endDate);
    const bookingsQuery = db.collection("bookings").where("startDate", "<=", booking.endDate);
    const [blockedSnap, bookingsSnap] = await Promise.all([
      tx.get(blockedQuery),
      tx.get(bookingsQuery)
    ]);
    const overlaps = (data) => {
      const oldStart = data.startDate;
      const oldEnd = data.endDate || oldStart;
      return typeof oldStart === "string" && typeof oldEnd === "string"
        && oldStart <= booking.endDate && oldEnd >= booking.startDate;
    };
    if (blockedSnap.docs.some(doc => overlaps(doc.data()))) {
      throw new HttpsError("already-exists", "Der Zeitraum ist bereits belegt. Bitte wähle andere Tage.");
    }
    if (bookingsSnap.docs.some(doc => {
      const data = doc.data();
      return data.bookingStatus !== "abgelehnt" && data.status !== "abgelehnt" && overlaps(data);
    })) {
      throw new HttpsError("already-exists", "Der Zeitraum ist durch eine bestehende Buchung belegt. Bitte wähle andere Tage.");
    }

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
    // Öffentliche Kalenderdaten enthalten keine Kunden-UID.
    tx.create(blockedRef, {
      startDate: booking.startDate, endDate: booking.endDate,
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


exports.createContact = onCall({ region: "europe-west3" }, async request => {
  const input = request.data || {};
  // Honeypot: Bots, die das versteckte Feld ausfüllen, werden ohne Speicherung abgewiesen.
  if (clean(input.website, 200)) return { ok: true };
  const name = clean(input.name, 120);
  const email = clean(input.email, 254);
  const address = clean(input.address, 300);
  const subject = clean(input.subject, 160).replace(/[\r\n]/g, " ");
  const message = clean(input.message, 5000);
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) {
    throw new HttpsError("invalid-argument", "Bitte prüfe Name, E-Mail-Adresse und Nachricht.");
  }
  await enforceRateLimit(request, "contact", 3, 60 * 60 * 1000);
  const contactRef = db.collection("contacts").doc();
  await db.runTransaction(async tx => {
    tx.create(contactRef, {
      name, email, address, subject, message,
      createdAt: FieldValue.serverTimestamp()
    });
    tx.create(db.collection("mail").doc(), {
      to: [ADMIN_EMAIL],
      message: {
        subject: subject ? "Neue Kontaktanfrage: " + subject : "Neue Kontaktanfrage",
        text: "Neue Kontaktanfrage von " + name + "\nE-Mail: " + email + "\nAdresse: " + address + "\nBetreff: " + subject + "\nNachricht: " + message
      }
    });
  });
  return { ok: true };
});
