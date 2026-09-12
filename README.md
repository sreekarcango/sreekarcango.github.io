# sreekarcango.github.io

Personal site for Sreekar Cango — robotics engineer working on SLAM, localisation and HD mapping.
Live at <https://sreekarcango.github.io/>.

A single static page served by GitHub Pages. No build step: edit `index.html`, commit, push.

## Layout

```
index.html                 the whole site
assets/css/style.css       theme tokens (light + dark), layout, components
assets/js/main.js          nav, theme toggle, scroll reveal, hero typing
assets/js/visitor-stats.js visitor counter + per-country breakdown (Firebase)
assets/Sreekar_Cango_Resume.pdf
assets/img/                optimised media (WebP + ~1 Mbps H.264 loops)
assets/vendor/             bootstrap CSS, bootstrap-icons, typed.js, purecounter
firestore.rules            security rules for the visitor counter
```

## Updating content

- **Text, roles, projects, publications** — edit the relevant section in `index.html`.
- **CV PDF** — regenerate from the master Google Doc. The committed PDF was rendered from a
  print-styled HTML copy of the doc using headless Chromium (`page.pdf()`), A4, 14/15 mm margins.
- **Images** — the site serves WebP. Convert with any tool at ~80 quality, max 800 px wide for
  project cards. Videos are muted decorative loops; encode with
  `ffmpeg -c:v libx264 -crf 30 -preset slow -vf scale=640:-2 -an -movflags +faststart`
  (1280 wide for the hero). WebM was measured and came out larger than H.264 for every clip,
  so only MP4 is shipped.
- **Impact numbers** — the four tiles under *Impact* and the hero tagline are hand-maintained.

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

## Notes

- `.nojekyll` is present so GitHub Pages serves files as-is without a Jekyll pass.
- Git history still contains the original ~45 MB of unoptimised video, so a fresh clone is
  larger than the working tree. Rewriting history with `git filter-repo` would shrink it but
  changes every commit hash; it was deliberately left alone.
- Based on the [iPortfolio](https://bootstrapmade.com/iportfolio-bootstrap-portfolio-websites-template/)
  template by BootstrapMade, whose license asks that the footer credit remain.
