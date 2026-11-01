const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const PACKAGE_PRICES = {
  basic: { name: "Basic", price: 89 },
  comfort: { name: "Comfort", price: 129 },
  rundumsorglos: { name: "Rundum sorglos", price: 229 }
};
const EXTRA_DAY_PRICE = 89;
const DEPOSIT = 100;
const MAX_EVENT_DAYS = 14;
let cachedFirebaseKeys = null;
let cachedFirebaseKeysUntil = 0;

function todayInBerlin() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function response(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      "access-control-allow-origin": origin || "null",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
      "access-control-allow-headers": "Content-Type,Authorization",
      "vary": "Origin"
    }
  });
}

function validIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function shiftDate(iso, days) {
  const d = new Date(iso + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}
function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function makeLockSlots(start, end) {
  const slots = [{ date: shiftDate(start, -1), half: "pm" }];
  for (let day = start; day <= end; day = shiftDate(day, 1)) {
    slots.push({ date: day, half: "am" }, { date: day, half: "pm" });
  }
  slots.push({ date: shiftDate(end, 1), half: "am" });
  return slots;
}
function jsonError(message, status = 400) {
  return { error: message, status };
}

async function verifyTurnstile(token, secret, ip) {
  if (!secret) return false;
  if (typeof token !== "string" || token.length < 10) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form
  });
  if (!result.ok) return false;
  const data = await result.json();
  return data.success === true;
}

async function verifyFirebaseToken(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !env.FIREBASE_PROJECT_ID || !env.ADMIN_EMAIL) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let jwt;
  try {
    jwt = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return null; }

  const now = Math.floor(Date.now() / 1000);
  let tokenHeader;
  try { tokenHeader = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/"))); }
  catch { return null; }
  if (tokenHeader.alg !== "RS256" || !tokenHeader.kid) return null;
  if (jwt.aud !== env.FIREBASE_PROJECT_ID ||
      jwt.iss !== "https://securetoken.google.com/" + env.FIREBASE_PROJECT_ID ||
      !jwt.sub || jwt.exp <= now || jwt.iat > now + 60 ||
      (jwt.nbf && jwt.nbf > now) ||
      jwt.email !== env.ADMIN_EMAIL || jwt.email_verified !== true) return null;

  if (!cachedFirebaseKeys || cachedFirebaseKeysUntil < Date.now()) {
    const jwksResponse = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    if (!jwksResponse.ok) return null;
    cachedFirebaseKeys = await jwksResponse.json();
    cachedFirebaseKeysUntil = Date.now() + 60 * 60 * 1000;
  }
  const jwk = cachedFirebaseKeys.keys.find(key => key.kid === tokenHeader.kid);
  if (!jwk) return null;

  try {
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const data = new TextEncoder().encode(parts[0] + "." + parts[1]);
    const signature = Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
    return ok ? { uid: jwt.sub, email: jwt.email } : null;
  } catch { return null; }
}

async function sendNotification(env, booking) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM || !env.NOTIFY_EMAIL) return "not_configured";
  const subject = "Neue Candybar-Buchung – " + booking.name;
  const lines = [
    "Eine neue Buchungsanfrage ist eingegangen.",
    "",
    "Name: " + booking.name,
    "E-Mail: " + booking.email,
    "Telefon: " + booking.phone,
    "Ort: " + booking.location,
    "Paket: " + booking.package_name,
    "Veranstaltung: " + booking.event_start + " bis " + booking.event_end,
    "Abholung: " + booking.pickup_date + " (Nachmittag)",
    "Rückgabe: " + booking.return_date + " (Vormittag)",
    "Mietpreis: " + booking.price.toFixed(2) + " EUR",
    "Kaution: " + DEPOSIT + " EUR",
    "",
    "Nachricht:",
    booking.message || "Keine Nachricht"
  ];
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "authorization": "Bearer " + env.RESEND_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: [env.NOTIFY_EMAIL],
      subject,
      text: lines.join("\n")
    })
  });
  return result.ok ? "sent" : "failed";
}

async function createBooking(request, env) {
  const body = await request.json();
  const name = clean(body.name, 120);
  const email = clean(body.email, 254);
  const phone = clean(body.phone, 60);
  const location = clean(body.location, 180);
  const message = clean(body.message, 2000);
  const packageId = clean(body.packageId, 32);
  const start = body.eventStart;
  const end = body.eventEnd;

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !phone || !location || !PACKAGE_PRICES[packageId] ||
      !validIsoDate(start) || !validIsoDate(end)) {
    return jsonError("Bitte prüfe deine Angaben.");
  }
  const eventDays = daysBetween(start, end) + 1;
  if (eventDays < 1 || eventDays > MAX_EVENT_DAYS) return jsonError("Der Zeitraum ist ungültig oder zu lang.");
  const earliest = shiftDate(todayInBerlin(), 14);
  if (start < earliest) return jsonError("Buchungen sind frühestens 14 Tage im Voraus möglich.");

  if (!await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET_KEY, request.headers.get("cf-connecting-ip"))) {
    return jsonError("Sicherheitsprüfung fehlgeschlagen. Bitte lade die Seite neu.", 403);
  }

  const packageInfo = PACKAGE_PRICES[packageId];
  const price = packageInfo.price + (eventDays - 1) * EXTRA_DAY_PRICE;
  const pickup = shiftDate(start, -1);
  const ret = shiftDate(end, 1);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const booking = {
    id, uid: null, name, email, phone, location, message,
    package_id: packageId, package_name: packageInfo.name,
    event_start: start, event_end: end, event_days: eventDays,
    pickup_date: pickup, return_date: ret,
    base_price: packageInfo.price, price, deposit: DEPOSIT,
    booking_status: "neu", payment_status: "offen", paid_amount: 0,
    created_at: createdAt
  };

  const statements = [
    env.DB.prepare(`INSERT INTO bookings
      (id, uid, name, email, phone, location, message, package_id, package_name,
       event_start, event_end, event_days, pickup_date, return_date, base_price,
       price, deposit, booking_status, payment_status, paid_amount, created_at, email_status)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'neu', 'offen', 0, ?, 'pending')`)
      .bind(id, name, email, phone, location, message, packageId, packageInfo.name,
        start, end, eventDays, pickup, ret, packageInfo.price, price, DEPOSIT, createdAt)
  ];

  for (const slot of makeLockSlots(start, end)) {
    statements.push(env.DB.prepare(
      "INSERT INTO booking_locks (booking_id, lock_date, half) VALUES (?, ?, ?)"
    ).bind(id, slot.date, slot.half));
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (/UNIQUE|constraint/i.test(String(error))) return jsonError("Dieser Zeitraum ist inzwischen vergeben. Bitte wähle einen anderen.", 409);
    throw error;
  }

  let emailStatus = "not_configured";
  try { emailStatus = await sendNotification(env, booking); }
  catch (error) { console.error("E-Mail-Versand fehlgeschlagen", error); emailStatus = "failed"; }

  await env.DB.prepare("UPDATE bookings SET email_status = ? WHERE id = ?").bind(emailStatus, id).run();
  return { ok: true, bookingId: id, emailStatus };
}

async function listBlocked(env) {
  const result = await env.DB.prepare(
    "SELECT pickup_date AS startDate, return_date AS endDate FROM bookings WHERE booking_status != 'abgelehnt' ORDER BY pickup_date"
  ).all();
  return result.results || [];
}

async function listAdminBookings(env) {
  const result = await env.DB.prepare("SELECT * FROM bookings ORDER BY event_start DESC").all();
  return result.results || [];
}

async function updateAdminBooking(request, env, id) {
  const admin = await verifyFirebaseToken(request, env);
  if (!admin) return jsonError("Nicht autorisiert.", 401);
  const body = await request.json();
  const status = body.bookingStatus;
  const payment = body.paymentStatus;
  const existing = await env.DB.prepare("SELECT * FROM bookings WHERE id = ?").bind(id).first();
  if (!existing) return jsonError("Buchung nicht gefunden.", 404);

  const statements = [];
  if (status !== undefined) {
    if (!["neu", "bestätigt", "abgelehnt"].includes(status)) return jsonError("Ungültiger Buchungsstatus.");
    if (status === "abgelehnt") {
      statements.push(env.DB.prepare("DELETE FROM booking_locks WHERE booking_id = ?").bind(id));
    } else if (existing.booking_status === "abgelehnt") {
      for (const slot of makeLockSlots(existing.event_start, existing.event_end)) {
        statements.push(env.DB.prepare(
          "INSERT INTO booking_locks (booking_id, lock_date, half) VALUES (?, ?, ?)"
        ).bind(id, slot.date, slot.half));
      }
    }
    statements.push(env.DB.prepare("UPDATE bookings SET booking_status = ? WHERE id = ?").bind(status, id));
  }
  if (payment !== undefined) {
    if (!["offen", "bezahlt", "fehlgeschlagen", "erstattet"].includes(payment)) return jsonError("Ungültiger Zahlungsstatus.");
    const paid = payment === "bezahlt" ? existing.price : existing.paid_amount;
    statements.push(env.DB.prepare("UPDATE bookings SET payment_status = ?, paid_amount = ? WHERE id = ?").bind(payment, paid, id));
  }
  if (!statements.length) return jsonError("Keine Änderung angegeben.");
  try { await env.DB.batch(statements); }
  catch (error) {
    if (/UNIQUE|constraint/i.test(String(error))) return jsonError("Der Zeitraum ist inzwischen anderweitig vergeben.", 409);
    throw error;
  }
  return { ok: true };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "";
    if (allowed && origin && origin !== allowed) return response({ error: "Origin nicht erlaubt." }, 403, allowed);
    if (request.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": allowed || origin || "*",
        "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
        "access-control-allow-headers": "Content-Type,Authorization",
        "access-control-max-age": "86400",
        "vary": "Origin"
      }
    });

    const url = new URL(request.url);
    try {
      let result;
      let status = 200;
      if (request.method === "GET" && url.pathname === "/api/blocked") {
        result = await listBlocked(env);
      } else if (request.method === "POST" && url.pathname === "/api/bookings") {
        result = await createBooking(request, env);
      } else if (request.method === "GET" && url.pathname === "/api/admin/bookings") {
        if (!await verifyFirebaseToken(request, env)) return response({ error: "Nicht autorisiert." }, 401, allowed || origin);
        result = await listAdminBookings(env);
      } else if (request.method === "PATCH" && /^\/api\/admin\/bookings\/[a-f0-9-]+$/i.test(url.pathname)) {
        const id = url.pathname.split("/").pop();
        result = await updateAdminBooking(request, env, id);
      } else {
        result = jsonError("Nicht gefunden.", 404);
      }
      if (result && result.status) {
        status = result.status;
        delete result.status;
      }
      return response(result, status, allowed || origin);
    } catch (error) {
      console.error("Worker-Fehler", error);
      return response({ error: "Interner Fehler. Bitte versuche es später erneut." }, 500, allowed || origin);
    }
  }
};
