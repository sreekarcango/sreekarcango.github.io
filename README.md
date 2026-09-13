# sreekarcango.github.io

Personal site for Sreekar Cango — robotics engineer working across computer vision, perception
and state estimation.
Live at <https://sreekarcango.github.io/>.

A single static page served by GitHub Pages. No build step and no dependencies: there is no
CSS framework, no icon font and no third-party JavaScript. Edit `index.html`, commit, push.

## Layout

```
index.html                 the whole site, with an inline SVG icon sprite at the top of <body>
assets/css/style.css       theme tokens (light + dark), layout grid, components
assets/js/main.js          nav, theme toggle, scroll reveal, hero typing, count-up, video gating
assets/js/visitor-stats.js visitor counter + per-country breakdown (Firebase, loaded from CDN)
assets/js/globe.js         interactive visitor globe (canvas, no dependencies)
assets/js/globe-data.js    generated land dot-matrix + country centroids for the globe
tools/build-globe-data.mjs regenerates globe-data.js from Natural Earth
assets/Sreekar_Cango_Resume.pdf
assets/img/                optimised media (WebP + H.264 loops)
assets/img/education/      institution emblems shown beside each Education entry
firestore.rules            security rules for the visitor counter
```

## Performance notes

Measured with a headless browser against a local server (fonts and analytics excluded):

| Page                       | Before   | After   |
|----------------------------|----------|---------|
| Mobile (390 px)            | 1,706 KB / 20 requests | **190 KB / 12 requests** |
| Desktop (1440 px)          | 1,706 KB / 20 requests | **734 KB / 13 requests** |

What changed: Bootstrap (227 KB) was replaced by ~40 lines of grid CSS; the Bootstrap Icons
font + stylesheet (223 KB) by an inline SVG sprite containing only the 38 icons used (~20 KB);
typed.js and purecounter by ~60 lines in `main.js`. The hero video is only fetched on viewports
900 px and wider, and never when the visitor has set reduced motion or Save-Data — phones get
the poster. It is also cut to a 9 s loop at a high CRF, which is invisible under the overlay.

## Icons

Icons come from [Bootstrap Icons](https://icons.getbootstrap.com/) (MIT) as an inline sprite.
To add one, copy its `<svg>` inner markup from the icon set into a new
`<symbol id="i-NAME" viewBox="0 0 16 16">` in the sprite and reference it with
`<svg class="icon"><use href="#i-NAME"/></svg>`.

## Updating content

- **Text, roles, projects, publications** — edit the relevant section in `index.html`.
- **CV PDF** — regenerate from the master Google Doc. The committed PDF was rendered from a
  print-styled HTML copy of the doc using headless Chromium (`page.pdf()`), A4, 14/15 mm margins.
- **Images** — the site serves WebP. Convert with any tool at ~80 quality, max 800 px wide for
  project cards. Videos are muted decorative loops; encode with
  `ffmpeg -c:v libx264 -crf 30 -preset slow -vf scale=640:-2 -an -movflags +faststart`
  (1280 wide for the hero). WebM was measured and came out larger than H.264 for every clip,
  so only MP4 is shipped.
- **Hero tagline** — the rotating phrases under the name are hand-maintained.

## Visitor statistics (Firebase)

The *Who's visiting* section counts one visit per browser session and records only an ISO
country code — never an IP address or precise location. It runs against the Firebase project
`personal-website-6faf4` and keeps the count accumulated since May 2024 in the original document.

Because the site is static, the browser writes to Firestore directly. Two things stop a visitor
from tampering with the numbers; **one is done, one is yours to enable**:

### 1. Security rules (done — but must be deployed)

`firestore.rules` restricts every write to `count == previous + 1` and forbids touching any
other field or deleting documents. It is committed here but Firestore only enforces the rules
it has been given, so paste it in:

1. Open the [Firebase console](https://console.firebase.google.com/) → project
   `personal-website-6faf4` → **Firestore Database** → **Rules** tab.
2. Replace the contents with `firestore.rules` from this repo and click **Publish**.

Until this is published the old open-write rules are still live.

> The existing counter document must contain only a `count` field for the rules to accept an
> update. If the old code left other fields on it, delete them in the console once.

### 2. App Check (recommended, ~5 minutes)

App Check makes Firestore reject requests that did not come from this domain, so the rules
above cannot be driven from a script elsewhere.

1. Console → **Build → App Check** → **Get started** → register the web app.
2. Choose **reCAPTCHA v3** as the provider. It will send you to create a reCAPTCHA v3 site key;
   add `sreekarcango.github.io` as the domain and copy the **site key** (not the secret).
3. Back in App Check, paste the site key and save. Under **APIs → Cloud Firestore** switch
   enforcement to **Enforced**.
4. In `assets/js/visitor-stats.js`, set `RECAPTCHA_SITE_KEY` to that site key and push.

Leave `RECAPTCHA_SITE_KEY` empty until step 3 is complete, or the site will start sending
tokens Firestore is not yet checking.

### Data model

| Document               | Fields          | Meaning                              |
|------------------------|-----------------|--------------------------------------|
| `visitors/mDely3ZcTwmVP4oSVRHo` | `count: int` | total visits (original doc, kept)   |
| `countries/{ISO-2}`    | `count: int`    | visits from that country             |

Country is resolved client-side from a free IP-geo lookup (`ipwho.is`). If that lookup
fails the visit is still counted, just without a country. If Firebase itself is unreachable
the whole section hides rather than showing a permanent *Loading…*.

### Institution emblems

The two Education entries each show a small emblem from `assets/img/education/`. These are
original line drawings in the site's accent blue, not official university logos, so there is
no trademark to license. To use a real logo instead, drop a square SVG or PNG at the same path
and filename; nothing else needs to change.

### The globe

The *Who's visiting* card draws every visiting country on a rotating dot-matrix globe. It is
plain `<canvas>` with no library: `assets/js/globe-data.js` holds a 1.5° equal-area land
bitmask (~3 KB) and one centroid per ISO country, both generated from Natural Earth 1:50m data.
The module is only fetched once Firestore has returned rows, and the ranked list stays as the
accessible version of the same data. Drag or use the arrow keys to rotate; it idles slowly
unless the visitor prefers reduced motion. To regenerate the data:

```
npm install world-atlas@2 topojson-client@3 i18n-iso-countries
node tools/build-globe-data.mjs assets/js/globe-data.js
```

## Notes

- `.nojekyll` is present so GitHub Pages serves files as-is without a Jekyll pass.
- Git history still contains the original ~45 MB of unoptimised video, so a fresh clone is
  larger than the working tree. Rewriting history with `git filter-repo` would shrink it but
  changes every commit hash; it was deliberately left alone.
- Based on the [iPortfolio](https://bootstrapmade.com/iportfolio-bootstrap-portfolio-websites-template/)
  template by BootstrapMade, whose license asks that the footer credit remain.
