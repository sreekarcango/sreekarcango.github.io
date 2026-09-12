/**
 * Visitor statistics.
 *
 * Counts a visit once per browser session and records the visitor's country
 * code only -- never an IP address or a precise location.
 *
 * The write path is constrained by firestore.rules (see repo root), which
 * only permits a count to move up by exactly one. Enabling App Check (set
 * RECAPTCHA_SITE_KEY below) additionally restricts writes to this domain.
 * See README.md for the console steps.
 */

const FIREBASE_VERSION = "11.0.0";
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const firebaseConfig = {
  apiKey: "AIzaSyAGXEAB9iUZKvotqF8Vi6xrBTryswDwR3Y",
  authDomain: "personal-website-6faf4.firebaseapp.com",
  projectId: "personal-website-6faf4",
  storageBucket: "personal-website-6faf4.appspot.com",
  messagingSenderId: "647751906953",
  appId: "1:647751906953:web:df5dafa168b9b8bf8cf858",
  measurementId: "G-GFKRN255M9"
};

// Paste the reCAPTCHA v3 site key here after enabling App Check to restrict
// writes to this domain. Left empty, App Check is skipped and the Firestore
// rules remain the only guard.
const RECAPTCHA_SITE_KEY = "";

// The original counter document, kept so the count since May 2024 carries over.
const TOTAL_DOC = "mDely3ZcTwmVP4oSVRHo";
const SESSION_KEY = "sc-counted";
const TOP_N = 8;

const els = {
  section: document.getElementById("stats"),
  total: document.getElementById("stats-total"),
  countries: document.getElementById("stats-countries"),
  you: document.getElementById("stats-you"),
  list: document.getElementById("country-list")
};

const regionNames =
  typeof Intl !== "undefined" && Intl.DisplayNames
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const countryName = (code) => {
  try {
    return regionNames ? regionNames.of(code) || code : code;
  } catch {
    return code;
  }
};

// ISO 3166-1 alpha-2 -> regional indicator pair
const flagFor = (code) =>
  /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)))
    : "\u{1F310}";

const hideSection = () => {
  if (els.section) els.section.hidden = true;
  const navLink = document.querySelector('#navbar a[href="#stats"]');
  if (navLink && navLink.parentElement) navLink.parentElement.hidden = true;
};

/** Country code for this visitor, or null if the lookup is unavailable. */
async function lookupCountry() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://ipwho.is/?fields=country_code", {
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const code = (data.country_code || "").toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

function renderCountries(rows, total) {
  if (!els.list) return;

  if (!rows.length) {
    els.list.innerHTML = '<li class="stats-loading">No country data yet.</li>';
    return;
  }

  const max = rows[0].count || 1;
  els.list.innerHTML = "";

  rows.slice(0, TOP_N).forEach(({ code, count }) => {
    const li = document.createElement("li");

    const flag = document.createElement("span");
    flag.className = "country-flag";
    flag.textContent = flagFor(code);

    const name = document.createElement("span");
    name.className = "country-name";
    name.textContent = countryName(code);

    const num = document.createElement("span");
    num.className = "country-count";
    num.textContent = total
      ? `${count.toLocaleString()} · ${Math.round((count / total) * 100)}%`
      : count.toLocaleString();

    const bar = document.createElement("span");
    bar.className = "country-bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.max(3, (count / max) * 100)}%`;
    bar.appendChild(fill);

    li.append(flag, name, num, bar);
    els.list.appendChild(li);
  });
}

async function run() {
  if (!els.section) return;

  // Dynamic import so a blocked or failed CDN fetch degrades to a hidden
  // section rather than an uncaught module error.
  let fb, fs;
  try {
    [fb, fs] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-firestore.js`)
    ]);
  } catch {
    hideSection();
    return;
  }

  let app;
  try {
    app = fb.initializeApp(firebaseConfig);

    if (RECAPTCHA_SITE_KEY) {
      const ac = await import(`${CDN}/firebase-app-check.js`);
      ac.initializeAppCheck(app, {
        provider: new ac.ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
    }
  } catch {
    hideSection();
    return;
  }

  const { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, getDocs } = fs;
  const db = getFirestore(app);

  let counted = false;
  try {
    counted = sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    // Private mode: treat as uncounted; the rules still cap this at +1.
  }

  const country = counted ? null : await lookupCountry();

  if (!counted) {
    try {
      const totalRef = doc(db, "visitors", TOTAL_DOC);
      const snap = await getDoc(totalRef);
      if (snap.exists()) {
        await updateDoc(totalRef, { count: increment(1) });
      } else {
        await setDoc(totalRef, { count: 1 });
      }

      if (country) {
        const cRef = doc(db, "countries", country);
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) {
          await updateDoc(cRef, { count: increment(1) });
        } else {
          await setDoc(cRef, { count: 1 });
        }
      }

      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* nothing to do */
      }
    } catch {
      // A rejected write still leaves the read-only display below usable.
    }
  }

  try {
    const totalSnap = await getDoc(doc(db, "visitors", TOTAL_DOC));
    const total = totalSnap.exists() ? totalSnap.data().count || 0 : 0;

    const rows = [];
    const countriesSnap = await getDocs(collection(db, "countries"));
    countriesSnap.forEach((d) => {
      const count = d.data().count || 0;
      if (count > 0) rows.push({ code: d.id, count });
    });
    rows.sort((a, b) => b.count - a.count);

    const countryTotal = rows.reduce((sum, r) => sum + r.count, 0);

    if (els.total) els.total.textContent = total.toLocaleString();
    if (els.countries) els.countries.textContent = rows.length ? String(rows.length) : "—";
    if (els.you) {
      els.you.textContent = country ? `${flagFor(country)} ${country}` : "—";
    }
    renderCountries(rows, countryTotal);
  } catch {
    hideSection();
  }
}

run();
