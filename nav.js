import { auth } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const NAV_LINKS = [
  { href: "index.html", label: "Startseite" },
  { href: "pakete.html", label: "Pakete" },
  { href: "galerie.html", label: "Galerie" },
  { href: "anfrage.html", label: "Buchen" },
  { href: "meine-buchungen.html", label: "Meine Buchungen" }
];

const MARK = `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><line x1="32" y1="45" x2="32" y2="60" stroke="var(--cream-dim)" stroke-width="4.5" stroke-linecap="round"/><circle cx="32" cy="26" r="21" fill="var(--pink)"/><path d="M32.00 24.80 L32.15 24.70 L32.33 24.62 L32.52 24.57 L32.73 24.55 L32.96 24.55 L33.19 24.59 L33.42 24.67 L33.65 24.78 L33.88 24.92 L34.09 25.11 L34.28 25.33 L34.45 25.58 L34.59 25.86 L34.69 26.17 L34.76 26.50 L34.79 26.85 L34.77 27.21 L34.70 27.58 L34.58 27.95 L34.42 28.31 L34.20 28.66 L33.93 28.99 L33.62 29.29 L33.26 29.55 L32.86 29.78 L32.43 29.96 L31.96 30.09 L31.47 30.17 L30.97 30.18 L30.45 30.13 L29.93 30.02 L29.42 29.84 L28.92 29.59 L28.44 29.28 L28.00 28.91 L27.59 28.48 L27.23 27.99 L26.93 27.45 L26.69 26.87 L26.52 26.25 L26.42 25.60 L26.40 24.93 L26.46 24.26 L26.60 23.58 L26.83 22.91 L27.14 22.27 L27.53 21.65 L28.00 21.08 L28.54 20.55 L29.15 20.09 L29.83 19.70 L30.55 19.39 L31.32 19.15 L32.13 19.02 L32.95 18.97 L33.79 19.03 L34.63 19.18 L35.45 19.44 L36.26 19.80 L37.02 20.26 L37.73 20.81 L38.39 21.45 L38.97 22.17 L39.46 22.97 L39.87 23.83 L40.18 24.74 L40.37 25.70 L40.46 26.68 L40.43 27.69 L40.27 28.69 L40.00 29.68 L39.61 30.64 L39.10 31.56 L38.48 32.43 L37.76 33.22 L36.94 33.93 L36.02 34.55 L35.03 35.06 L33.98 35.46 L32.88 35.73 L31.73 35.87 L30.57 35.88 L29.40 35.75 L28.25 35.48 L27.12 35.08 L26.03 34.53 L25.01 33.86 L24.06 33.06 L23.20 32.15 L22.45 31.14 L21.82 30.03 L21.32 28.85 L20.95 27.60 L20.73 26.30 L20.67 24.98 L20.76 23.65 L21.01 22.32 L21.41 21.02 L21.97 19.76 L22.69 18.57 L23.54 17.46 L24.52 16.45 L25.63 15.55 L26.85 14.79 L28.15 14.16 L29.54 13.69 L30.98 13.38 L32.46 13.24 L33.96 13.27 L35.45 13.48 L36.93 13.87 L38.36 14.43 L39.72 15.16 L41.01 16.06 L42.18 17.10 L43.24 18.29 L44.15 19.60 L44.92 21.02 L45.51 22.53 L45.93 24.11 L46.16 25.75 L46.20 27.41 L46.05 29.07 L45.69 30.72 L45.15 32.33 L44.41 33.88 L43.49 35.34 L42.40 36.69 L41.15 37.91 L39.76 38.99 L38.24 39.90 L36.61 40.63 L34.90 41.18 L33.12 41.52 L31.30 41.65 L29.46 41.57 L27.64 41.27 L25.85 40.76 L24.12 40.03 L22.48 39.11" fill="none" stroke="var(--bg-card)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="56" cy="9" r="3" fill="var(--yellow)"/><circle cx="8" cy="12" r="2.4" fill="var(--mint)"/></svg>`;

const ICON_THEME = `
  <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
  <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

export function renderNav(activePage) {
  const navEl = document.getElementById("site-nav");
  if (!navEl) return;
  const linksHtml = NAV_LINKS.map(l =>
    `<a href="${l.href}" class="${activePage === l.href ? "active" : ""}">${l.label}</a>`
  ).join("");

  navEl.innerHTML = `
    <div class="stripe"></div>
    <div class="inner">
      <a href="index.html" class="logo" aria-label="Candy Bar Vogtland – Startseite">${MARK}<span class="logo-text">Candy Bar <span>Vogtland</span></span></a>
      <div class="links" id="navLinks">
        ${linksHtml}
        <a href="anmelden.html" id="navAuthLink">Anmelden</a>
      </div>
      <div class="nav-actions">
        <button class="theme-toggle" id="themeBtn" type="button" aria-label="Zwischen hell und dunkel wechseln">${ICON_THEME}</button>
        <button class="burger" id="burgerBtn" type="button" aria-label="Menü öffnen" aria-expanded="false" aria-controls="navLinks"><span class="burger-icon"><i></i><i></i><i></i></span></button>
      </div>
    </div>
    <div class="nav-overlay" id="navOverlay"></div>`;

  setupMenu(navEl);
  setupTheme();

  const authLink = document.getElementById("navAuthLink");
  onAuthStateChanged(auth, (user) => {
    if (user) {
      authLink.textContent = "Abmelden";
      authLink.href = "#";
      authLink.onclick = (e) => { e.preventDefault(); signOut(auth).then(()=>location.href="index.html"); };
    } else {
      authLink.textContent = "Anmelden";
      authLink.href = "anmelden.html";
      authLink.onclick = null;
    }
  });
}

// ---------- Menü (Handy): Kreuz zum Schließen, Tippen daneben, Wischen, Esc ----------
function setupMenu(navEl) {
  const burger = document.getElementById("burgerBtn");
  const panel = document.getElementById("navLinks");
  const overlay = document.getElementById("navOverlay");
  const root = document.documentElement;

  const isOpen = () => navEl.classList.contains("menu-open");
  function setOpen(open) {
    navEl.classList.toggle("menu-open", open);
    root.classList.toggle("menu-lock", open);          // Seite dahinter bleibt stehen
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
  }
  burger.addEventListener("click", () => setOpen(!isOpen()));
  overlay.addEventListener("click", () => setOpen(false));
  panel.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) { setOpen(false); burger.focus(); } });
  window.addEventListener("resize", () => { if (window.innerWidth > 840 && isOpen()) setOpen(false); });
  window.addEventListener("pageshow", () => setOpen(false));   // Zurück-Taste: Menü nicht offen lassen

  // Nach rechts wegwischen schließt das Menü
  let sx = null, sy = null;
  const start = (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; };
  const end = (e) => {
    if (sx === null) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    sx = sy = null;
    if (dx > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) setOpen(false);
  };
  [panel, overlay].forEach(el => {
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
  });
}

// ---------- Hell / Dunkel ----------
function setupTheme() {
  const btn = document.getElementById("themeBtn");
  const root = document.documentElement;
  const current = () => root.dataset.theme === "dark" ? "dark" : "light";
  const sync = () => btn.setAttribute("aria-pressed", String(current() === "dark"));
  sync();
  btn.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
    sync();
  });
}

export function renderFooter() {
  const footEl = document.getElementById("site-footer");
  if (!footEl) return;
  footEl.innerHTML = `
    <div class="inner">
      <div class="logo">${MARK}<span>Candy Bar <span>Vogtland</span></span></div>
      <div class="links">
        <a href="index.html">Startseite</a>
        <a href="pakete.html">Pakete</a>
        <a href="galerie.html">Galerie</a>
        <a href="anfrage.html">Buchen</a>
        <a href="kontakt.html">Kontakt</a>
        <a href="meine-buchungen.html">Meine Buchungen</a>
        <a href="impressum.html">Impressum</a>
        <a href="agb.html">AGB</a>
        <a href="datenschutz.html">Datenschutz</a>
        <a href="mailto:candybar.vogtland@gmail.com">candybar.vogtland@gmail.com</a>
      </div>
    </div>
    <div class="bottom">© ${new Date().getFullYear()} Candy Bar Vogtland</div>`;
}
