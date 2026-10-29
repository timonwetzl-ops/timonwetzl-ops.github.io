// Gemeinsame Buchungslogik: Preise, Datumsrechnung, Verfügbarkeit, Auswahlregeln.
// Reines JavaScript ohne Firebase – wird von anfrage.html, dashboard.html und den Tests genutzt.
//
// Begriffe:
//   eventStart / eventEnd = erster / letzter Veranstaltungstag (volle, kostenpflichtige Tage)
//   pickupDate            = Tag vor eventStart  (halber Tag, kostenlos, Nachmittag)
//   returnDate            = Tag nach eventEnd   (halber Tag, kostenlos, bis Mittag)
// Im bestehenden System heißen Abhol-/Rückgabetag startDate/endDate. Das bleibt so,
// damit ältere Ansichten und ältere Buchungen weiter funktionieren.

export const PACKAGE_BASE_PRICE = { basic: 89, comfort: 129, rundumsorglos: 229 };
export const EXTRA_DAY_PRICE = 89;
export const DEPOSIT = 100;
export const LEAD_DAYS = 14;        // wie bisher: die nächsten 2 Wochen sind immer belegt
export const MAX_EVENT_DAYS = 14;   // technische Obergrenze (Schutz vor unsinnigen Werten)

// ---------- Datums-Helfer (reine Kalenderdaten, UTC-Rechnung => keine Sommerzeit-Fehler) ----------
const pad = n => String(n).padStart(2, "0");
export const isIso = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  fmtUTC(parseUTC(s)) === s;
function parseUTC(iso) { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); }
function fmtUTC(ms) { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
export const addDays = (iso, n) => fmtUTC(parseUTC(iso) + n * 86400000);
export const diffDays = (a, b) => Math.round((parseUTC(b) - parseUTC(a)) / 86400000);
export const niceDate = iso => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
export const localTodayIso = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const WD = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
export const weekdayName = iso => WD[new Date(parseUTC(iso)).getUTCDay()];

// ---------- Preis ----------
export function rentalPrice(packageId, eventDays) {
  const base = PACKAGE_BASE_PRICE[packageId];
  if (base === undefined) throw new Error("Unbekanntes Paket: " + packageId);
  if (!Number.isInteger(eventDays) || eventDays < 1) throw new Error("Mindestens ein Veranstaltungstag nötig");
  return base + (eventDays - 1) * EXTRA_DAY_PRICE;
}

// Aus Paket + Veranstaltungszeitraum alles ableiten. Einzige Quelle für Tage, Halbtage und Preis.
export function computeBooking(packageId, eventStart, eventEnd) {
  if (!isIso(eventStart) || !isIso(eventEnd)) throw new Error("Ungültiges Datum");
  if (eventEnd < eventStart) throw new Error("Ende liegt vor dem Start");
  const eventDays = diffDays(eventStart, eventEnd) + 1;   // Anzahl VOLLER Tage
  if (eventDays > MAX_EVENT_DAYS) throw new Error("Zeitraum zu lang");
  const base = PACKAGE_BASE_PRICE[packageId];
  return {
    packageId, eventStart, eventEnd, eventDays,
    pickupDate: addDays(eventStart, -1),
    returnDate: addDays(eventEnd, 1),
    basePrice: base,
    extraDays: eventDays - 1,
    extraDayPrice: EXTRA_DAY_PRICE,
    rentalPrice: rentalPrice(packageId, eventDays),   // Abhol-/Rückgabetag erhöhen den Preis nie
    deposit: DEPOSIT                                  // zusätzlich, NICHT im Mietpreis enthalten
  };
}

// ---------- Belegung ----------
// Eine Belegung ist {startDate, endDate} = Abholtag/Rückgabetag (altes und neues Format identisch).
// Abholtag: Nachmittag belegt (pm). Rückgabetag: Vormittag belegt (am). Tage dazwischen: voll.
export function emptyOccupancy() { return { full: new Set(), pm: new Set(), am: new Set() }; }
export function addOccupancy(occ, startDate, endDate) {
  if (!startDate) return;
  if (!endDate || endDate === startDate) { occ.full.add(startDate); return; }
  occ.pm.add(startDate);
  occ.am.add(endDate);
  for (let d = addDays(startDate, 1); d < endDate; d = addDays(d, 1)) occ.full.add(d);
}
export function buildOccupancy(list) {
  const occ = emptyOccupancy();
  for (const b of list) addOccupancy(occ, b.startDate, b.endDate);
  return occ;
}

export const isFullDay = (occ, d) => occ.full.has(d) || (occ.pm.has(d) && occ.am.has(d));
export const isTooEarly = (d, todayIso) => d < addDays(todayIso, LEAD_DAYS);

// Ist der komplette benötigte Zeitraum (Abholung + Veranstaltungstage + Rückgabe) frei?
// Rückgabe: { ok:true } oder { ok:false, reason }
export function checkRange(occ, eventStart, eventEnd, todayIso) {
  let b;
  try { b = computeBooking("basic", eventStart, eventEnd); }
  catch (e) { return { ok: false, reason: e.message }; }
  const { pickupDate: P, returnDate: R } = b;
  if (isTooEarly(P, todayIso)) return { ok: false, reason: "zu kurzfristig" };
  if (isFullDay(occ, P) || occ.pm.has(P)) return { ok: false, reason: "Abholtag belegt" };
  if (isFullDay(occ, R) || occ.am.has(R)) return { ok: false, reason: "Rückgabetag belegt" };
  for (let d = eventStart; d <= eventEnd; d = addDays(d, 1)) {
    if (isFullDay(occ, d) || occ.pm.has(d) || occ.am.has(d)) return { ok: false, reason: "Veranstaltungstag belegt" };
  }
  return { ok: true };
}

// ---------- Auswahl (ein zusammenhängender Zeitraum) ----------
// sel = null | {start, end}; end >= start. Nie zwei getrennte Zeiträume.
// Klick auf Tag d:
//   - keine Auswahl: Auswahl = nur d (falls möglich)
//   - d liegt hinter der Auswahl / davor: Zeitraum wird bis d erweitert (alle Tage dazwischen kommen automatisch dazu), falls frei
//   - d liegt in der Auswahl: Zeitraum endet jetzt an d (verkürzen); Klick auf den einzigen gewählten Tag hebt die Auswahl auf
//   - Erweiterung nicht möglich, aber d allein buchbar: neuer Zeitraum nur mit d (ersetzt die alte Auswahl)
export function nextSelection(sel, d, occ, todayIso) {
  if (!sel) return checkRange(occ, d, d, todayIso).ok ? { start: d, end: d } : null;
  if (d >= sel.start && d <= sel.end) {
    if (sel.start === sel.end) return null;
    return { start: sel.start, end: d };
  }
  const cand = d > sel.end ? { start: sel.start, end: d } : { start: d, end: sel.end };
  if (checkRange(occ, cand.start, cand.end, todayIso).ok &&
      diffDays(cand.start, cand.end) + 1 <= MAX_EVENT_DAYS) return cand;
  return checkRange(occ, d, d, todayIso).ok ? { start: d, end: d } : sel;
}

// ---------- Tages-Sperren (für atomares Reservieren) ----------
// Pro Kalendertag ein Dokument {fullBy, amBy, pmBy}. Gibt die benötigten Plätze für eine Buchung zurück.
export function lockPlan(eventStart, eventEnd) {
  const { pickupDate, returnDate } = computeBooking("basic", eventStart, eventEnd);
  const plan = [{ date: pickupDate, slot: "pm" }];
  for (let d = eventStart; d <= eventEnd; d = addDays(d, 1)) plan.push({ date: d, slot: "full" });
  plan.push({ date: returnDate, slot: "am" });
  return plan;
}
const SLOT_FIELD = { full: "fullBy", am: "amBy", pm: "pmBy" };
export const slotField = slot => SLOT_FIELD[slot];

// existing = Inhalt des Tages-Dokuments (oder undefined). ownerId = eigene Buchung (zählt nicht als Konflikt).
export function slotConflict(existing, slot, ownerId = null) {
  const e = existing || {};
  const taken = k => e[k] && e[k] !== ownerId;
  if (slot === "full") return !!(taken("fullBy") || taken("amBy") || taken("pmBy"));
  if (slot === "am") return !!(taken("fullBy") || taken("amBy"));
  if (slot === "pm") return !!(taken("fullBy") || taken("pmBy"));
  return true;
}
