import { auth } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const NAV_LINKS = [
  { href: "index.html", label: "Startseite" },
  { href: "pakete.html", label: "Pakete" },
  { href: "galerie.html", label: "Galerie" },
  { href: "anfrage.html", label: "Buchen" },
  { href: "meine-buchungen.html", label: "Meine Buchungen" }
];

export function renderNav(activePage) {
  const navEl = document.getElementById("site-nav");
  if (!navEl) return;
  const linksHtml = NAV_LINKS.map(l =>
    `<a href="${l.href}" class="${activePage === l.href ? "active" : ""}">${l.label}</a>`
  ).join("");

  navEl.innerHTML = `
    <div class="stripe"></div>
    <div class="inner">
      <a href="index.html" class="logo">Candy Bar <span>Vogtland</span></a>
      <button class="burger" id="burgerBtn">☰</button>
      <div class="links" id="navLinks">
        ${linksHtml}
        <a href="anmelden.html" id="navAuthLink">Anmelden</a>
      </div>
    </div>`;

  document.getElementById("burgerBtn").addEventListener("click", () => {
    document.getElementById("navLinks").classList.toggle("open");
  });

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

export function renderFooter() {
  const footEl = document.getElementById("site-footer");
  if (!footEl) return;
  footEl.innerHTML = `
    <div class="inner">
      <div class="logo">Candy Bar <span>Vogtland</span></div>
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
