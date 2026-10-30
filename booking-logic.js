// Buchungslogik: Datum, Preis, Verfügbarkeit und Klick-Verhalten im Kalender.
// Diese Datei hat KEINE Verbindung zu Firebase und wird deshalb auch getestet.

export const EXTRA_DAY_PRICE = 89;  // jeder weitere Veranstaltungstag, bei allen Paketen
export const DEPOSIT = 100;         // Kaution, wird NICHT zum Mietpreis gerechnet
export const LEAD_DAYS = 14;        // die nächsten 2 Wochen ab heute sind nicht buchbar

// ---------- Datums-Helfer (immer lokale Kalendertage, keine Zeitzonen-Fehler) ----------
export const pad = n => String(n).padStart(2, "0");
export const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return fmt(d); };
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const nice = iso => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };

// ---------- Preis ----------
export function parsePrice(str) {
  return parseFloat((str || "").toString().replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
}
export const eventDayCount = (firstDay, lastDay) => diffDays(firstDay, lastDay) + 1;

// Mietpreis = Paketpreis für den 1. Tag + (Tage - 1) x 89 €.
// Abholtag und Rückgabetag (halbe Tage) kommen hier gar nicht vor.
export function rentalPrice(basePrice, eventDays) {
  if (!Number.isInteger(eventDays) || eventDays < 1) throw new Error("Mindestens 1 Veranstaltungstag nötig");
  return basePrice + (eventDays - 1) * EXTRA_DAY_PRICE;
}

export function euro(n) {
  return (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",")) + " €";
}

// Preisübersicht als HTML. Die Kaution steht GANZ AM ENDE, einmal, als kleine Zusatzzeile.
export function priceSummaryHtml(basePrice, eventDays) {
  const total = rentalPrice(basePrice, eventDays);
  const calc = eventDays === 1
    ? `${euro(basePrice)}`
    : `${euro(basePrice)} + ${eventDays - 1} × ${euro(EXTRA_DAY_PRICE)}`;
  return `<div class="price-days">${eventDays} ${eventDays === 1 ? "Veranstaltungstag" : "Veranstaltungstage"}: ${calc}</div>` +
         `<div class="price-total">Gesamtmietpreis: <strong>${euro(total)}</strong></div>` +
         `<div class="price-deposit">+ ${euro(DEPOSIT)} Kaution</div>`;
}

// ---------- Zeitraum einer Buchung ----------
// Veranstaltungstage: first … last (volle Tage, kostenpflichtig)
// Abholung: Tag davor (halber Tag, Nachmittag) · Rückgabe: Tag danach (halber Tag, Vormittag)
export function periodFor(firstDay, lastDay) {
  return { pickup: addDays(firstDay, -1), ret: addDays(lastDay, 1) };
}

// Aus gespeicherten Buchungen den belegten Zeitraum {S: Abholtag, E: Rückgabetag} machen.
export function blockOf(b) {
  if (!b) return null;
  if ((b.bookingStatus || b.status) === "abgelehnt") return null;
  if (b.startDate) return { S: b.startDate, E: b.endDate || b.startDate };
  if (b.eventDate) return { S: addDays(b.eventDate, -1), E: addDays(b.eventDate, 1) }; // ältere Buchungen
  return null;
}

// ---------- Verfügbarkeit ----------
export function createAvailability(blocks, firstBookable) {
  const full = new Set(), pmTaken = new Set(), amTaken = new Set();
  for (const blk of blocks) {
    if (!blk || !blk.S) continue;
    const { S, E } = blk;
    if (!E || E === S) { full.add(S); continue; }
    pmTaken.add(S);   // am Abholtag ist der Nachmittag belegt
    amTaken.add(E);   // am Rückgabetag ist der Vormittag belegt
    for (let d = addDays(S, 1); d < E; d = addDays(d, 1)) full.add(d);
  }
  const isFull = d => full.has(d) || (pmTaken.has(d) && amTaken.has(d));
  const tooEarly = d => d < firstBookable;
  const canStart = d => !tooEarly(d) && !isFull(d) && !pmTaken.has(d);   // Abholung = Nachmittag muss frei sein
  const canEnd = d => !tooEarly(d) && !isFull(d) && !amTaken.has(d);     // Rückgabe = Vormittag muss frei sein
  const interiorFree = (a, b) => {
    for (let d = addDays(a, 1); d < b; d = addDays(d, 1)) {
      if (isFull(d) || pmTaken.has(d) || amTaken.has(d)) return false;
    }
    return true;
  };
  // Ist dieser Veranstaltungszeitraum (inkl. Abhol- und Rückgabetag) komplett frei?
  const validEventRange = (firstDay, lastDay) => {
    if (!firstDay || !lastDay || lastDay < firstDay) return false;
    const { pickup, ret } = periodFor(firstDay, lastDay);
    return canStart(pickup) && canEnd(ret) && interiorFree(pickup, ret);
  };
  return { isFull, tooEarly, canStart, canEnd, interiorFree, validEventRange, pmTaken, amTaken, full };
}

// ---------- Auswahl im Kalender (Klick-Verhalten und Einfärbung) ----------
// state = { first, last, phase }   phase: "none" | "extending" | "done"
export const emptySelection = () => ({ first: null, last: null, phase: "none" });

export function pickDay(state, iso, av) {
  if (state.phase !== "extending") {
    // neue Auswahl beginnen (ersetzt eine frühere – es gibt immer nur EINEN Zeitraum)
    return av.validEventRange(iso, iso) ? { first: iso, last: iso, phase: "extending" } : state;
  }
  if (iso === state.first) return { ...state, phase: "done" };           // nur ein Veranstaltungstag
  if (iso < state.first) {
    return av.validEventRange(iso, iso) ? { first: iso, last: iso, phase: "extending" } : state;
  }
  if (av.validEventRange(state.first, iso)) return { first: state.first, last: iso, phase: "done" };
  return state;                                                          // Lücke/Belegung dazwischen: ignorieren
}

export function dayDisabled(state, iso, av) {
  if (state.phase !== "extending") return !av.validEventRange(iso, iso);
  if (iso === state.first) return false;
  if (iso < state.first) return !av.validEventRange(iso, iso);
  return !av.validEventRange(state.first, iso);
}

// Klasse für die Farbe eines Kalendertags
export function dayClass(state, iso, av) {
  if (state.first) {
    const { pickup, ret } = periodFor(state.first, state.last);
    if (iso === pickup) return "sel-start";            // halber Tag: Abholung
    if (iso === ret) return "sel-end";                 // halber Tag: Rückgabe
    if (iso >= state.first && iso <= state.last) return "sel";   // voller Veranstaltungstag
  }
  if (av.isFull(iso)) return "full";
  if (av.pmTaken.has(iso)) return "half-pm";
  if (av.amTaken.has(iso)) return "half-am";
  return "";
}
