import { db } from "./firebase-init.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Die drei Pakete – immer vorhanden, genau einmal.
export const PACKAGE_IDS = ["basic", "comfort", "rundumsorglos"];

const ABHOLUNG = "Abholung in 08468 Reichenbach im Vogtland";
const KAUTION = "Kaution 100 € – wird bei Rückgabe erstattet";
const AUSSTATTUNG = [
  "15 Gläser in verschiedenen Größen (5 groß, 6 mittel, 4 klein)",
  "2 dekorative Holzkisten zur Präsentation, für eine schöne Höhenstaffelung",
  "Servierzangen",
  "weiteres passendes Zubehör für einen stimmigen Gesamtlook"
];

// Das sind die Startwerte. Alles, was du im Dashboard änderst,
// wird in der Datenbank gespeichert und ersetzt diese Werte.
export const DEFAULT_PACKAGES = {
  basic: {
    name: "Basic",
    price: "89 €",
    description: "Das Basic-Paket enthält nur die Candybar selbst, ganz ohne weiteres Zubehör.",
    includes: ["Die Candybar selbst", ABHOLUNG, KAUTION],
    note: "Gläser, Deko-Kisten, Servierzangen und Süßigkeitenfüllung sind im Basic-Paket nicht enthalten – die gibt's optional im Comfort- bzw. Rundum-Sorglos-Paket dazu.",
    images: []
  },
  comfort: {
    name: "Comfort",
    price: "129 €",
    description: "Im Comfort-Paket ist unsere Candybar mit folgender Ausstattung enthalten:",
    includes: [...AUSSTATTUNG, ABHOLUNG, KAUTION],
    note: "Die Süßigkeitenfüllung ist im Comfort-Paket nicht enthalten – die gibt's optional im Rundum-Sorglos-Paket dazu.",
    images: []
  },
  rundumsorglos: {
    name: "Rundum sorglos",
    price: "229 €",
    description: "Das Rundum-Sorglos-Paket enthält alles aus dem Comfort-Paket, plus die komplette Süßigkeitenfüllung – ihr müsst euch um nichts mehr kümmern.",
    includes: [
      ...AUSSTATTUNG,
      "vollständige Süßigkeitenfüllung für alle Gläser, abgestimmt auf die jeweilige Glasgröße",
      ABHOLUNG,
      KAUTION
    ],
    extrasTitle: "Süßigkeitenfüllung (ca. 5,8 kg gesamt)",
    extras: [
      "Erdnüsse – 500 g",
      "Pistazien – 375 g",
      "Kinder Schoko-Bons – 400 g",
      "Zetti Knusper Flocken – 810 g",
      "Schoko & Keks Sticks – 180 g",
      "Hitschies Original Mix – 420 g",
      "Haribo Happy-Cola – 350 g",
      "Haribo Primavera Erdbeeren – 350 g",
      "Haribo Fruity-Fruits – 480 g",
      "Rainbow Pixel – 320 g",
      "Katjes Wunderland sauer – 420 g",
      "Marshmallows – 300 g",
      "Popcorn karamellisiert – 200 g",
      "Paprika Chips – 400 g",
      "Linsen Chips – 270 g"
    ],
    note: "Reicht für ca. 60–70 Gäste.",
    images: []
  }
};

// Holt ein Paket: Startwerte + das, was in der Datenbank gespeichert ist.
// Klappt die Datenbank mal nicht, bleiben trotzdem die Startwerte sichtbar.
export async function getPackage(id) {
  const out = { id, ...JSON.parse(JSON.stringify(DEFAULT_PACKAGES[id])) };
  try {
    const snap = await getDoc(doc(db, "packages", id));
    if (snap.exists()) {
      for (const [k, v] of Object.entries(snap.data())) {
        if (v === undefined || v === null || v === "") continue;
        if (Array.isArray(v) && v.length === 0) continue;
        out[k] = v;
      }
    }
  } catch (e) {
    console.warn("Pakete konnten nicht aus der Datenbank geladen werden – Startwerte werden gezeigt.", e);
  }
  return out;
}

export async function getAllPackages() {
  const list = [];
  for (const id of PACKAGE_IDS) list.push(await getPackage(id));
  return list;
}
