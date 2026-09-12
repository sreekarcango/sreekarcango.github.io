/**
 * Interactive visitor globe. No dependencies.
 *
 * Land is a dot matrix sampled offline from Natural Earth (see
 * tools/build-globe-data.mjs); each visiting country gets a marker at its
 * centroid, sized by visit count. Drag or use the arrow keys to rotate; the
 * globe idles slowly unless the visitor prefers reduced motion.
 */
import { LAND_STEP, LAND_BANDS, LAND_BITS, CENTROIDS } from "./globe-data.js";

const RAD = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function unit(lat, lon) {
  const cl = Math.cos(lat * RAD);
  return [cl * Math.cos(lon * RAD), Math.sin(lat * RAD), cl * Math.sin(lon * RAD)];
}

/** Decode the land bitmask into unit vectors, one per land sample. */
function decodeLand() {
  const bin = atob(LAND_BITS);
  const pts = [];
  let bit = 0;
  for (let b = 0; b < LAND_BANDS.length; b++) {
    const lat = -90 + LAND_STEP / 2 + b * LAND_STEP;
    const n = LAND_BANDS[b];
    for (let i = 0; i < n; i++, bit++) {
      if (bin.charCodeAt(bit >> 3) & (1 << (bit & 7))) {
        pts.push(...unit(lat, -180 + ((i + 0.5) * 360) / n));
      }
    }
  }
  return new Float32Array(pts);
}

function readTheme(el) {
  const cs = getComputedStyle(el);
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return {
    accent: v("--accent", "#1a9be6"),
    accent2: v("--accent-2", "#7c5cff"),
    glow: v("--accent-glow", "rgba(26,155,230,0.28)"),
    land: v("--text-muted", "#5a6776"),
    sea: v("--surface-2", "#eaf1f9"),
    seaDeep: v("--surface", "#f5f8fc"),
    rim: v("--border-strong", "rgba(15,30,55,0.22)"),
    dark: cs.colorScheme === "dark" || document.documentElement.getAttribute("data-theme") === "dark"
      || (!document.documentElement.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches)
  };
}

/**
 * @param {HTMLElement} host   square container the canvas fills
 * @param {{rows: {code: string, count: number}[], you: string|null,
 *          flagFor: (c: string) => string, countryName: (c: string) => string}} opts
 */
export function mountGlobe(host, opts) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Interactive globe of visitor locations. Drag or use the arrow keys to rotate.");

  const tip = document.createElement("div");
  tip.className = "globe-tooltip";
  tip.setAttribute("aria-hidden", "true");
  host.append(canvas, tip);

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const land = decodeLand();
  const landCount = land.length / 3;
  let theme = readTheme(host);

  let markers = [];
  let maxCount = 1;
  let totalCount = 0;
  const setRows = (rows) => {
    markers = rows
      .filter((r) => CENTROIDS[r.code])
      .map((r) => ({ ...r, p: unit(CENTROIDS[r.code][0], CENTROIDS[r.code][1]), sx: 0, sy: 0, z: -1, r: 0 }));
    maxCount = Math.max(1, ...markers.map((m) => m.count));
    totalCount = rows.reduce((s, r) => s + r.count, 0);
  };
  setRows(opts.rows);

  // Initial view: face the visitor's own country, else the busiest one.
  const focusCode = (opts.you && CENTROIDS[opts.you] && opts.you) || (markers[0] && markers[0].code);
  const focus = focusCode ? CENTROIDS[focusCode] : [20, 0];
  let yaw = (focus[1] - 90) * RAD;
  let pitch = clamp(focus[0] * RAD, -1.1, 1.1);

  let size = 0;
  let dpr = 1;
  const resize = () => {
    const w = host.clientWidth;
    if (!w) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = w;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(w * dpr);
    canvas.style.width = canvas.style.height = `${w}px`;
    dirty = true;
  };

  let dirty = true;
  let dragging = false;
  let hovered = null;
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;
  let visible = true;
  let raf = 0;

  const project = (p, cy, sy, cp, sp) => {
    const x1 = p[0] * cy + p[2] * sy;
    const z1 = -p[0] * sy + p[2] * cy;
    const y2 = p[1] * cp - z1 * sp;
    const z2 = p[1] * sp + z1 * cp;
    return [x1, y2, z2];
  };

  function draw(now) {
    if (!size) return;
    const R = (size / 2) * 0.92;
    const cx = size / 2;
    const cyc = size / 2;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // Sea: soft sphere shading plus a rim.
    const g = ctx.createRadialGradient(cx - R * 0.35, cyc - R * 0.4, R * 0.1, cx, cyc, R);
    g.addColorStop(0, theme.sea);
    g.addColorStop(1, theme.seaDeep);
    ctx.beginPath();
    ctx.arc(cx, cyc, R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme.rim;
    ctx.stroke();

    // Land dots, bucketed by depth so fillStyle changes only eight times.
    const dot = Math.max(1.2, size / 300);
    const buckets = Array.from({ length: 8 }, () => []);
    for (let i = 0; i < landCount; i++) {
      const x = land[i * 3], y = land[i * 3 + 1], z = land[i * 3 + 2];
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      const y2 = y * cp - z1 * sp;
      const z2 = y * sp + z1 * cp;
      if (z2 <= 0.02) continue;
      buckets[Math.min(7, (z2 * 8) | 0)].push(cx - x1 * R, cyc - y2 * R);
    }
    ctx.fillStyle = theme.land;
    for (let b = 0; b < 8; b++) {
      const pts = buckets[b];
      if (!pts.length) continue;
      ctx.globalAlpha = (theme.dark ? 0.22 : 0.18) + (b / 7) * (theme.dark ? 0.55 : 0.5);
      const s = dot * (0.65 + 0.35 * (b / 7));
      for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i] - s / 2, pts[i + 1] - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    // Visitor markers.
    const pulse = reducedMotion ? 0 : (now / 1400) % 1;
    for (const m of markers) {
      const [x, y, z] = project(m.p, cy, sy, cp, sp);
      m.z = z;
      if (z <= 0) continue;
      m.sx = cx - x * R;
      m.sy = cyc - y * R;
      const isYou = m.code === opts.you;
      const base = 3 + 9 * Math.sqrt(m.count / maxCount);
      m.r = base * (size / 480 + 0.5);
      const r = hovered === m ? m.r * 1.25 : m.r;
      const color = isYou ? theme.accent2 : theme.accent;
      ctx.globalAlpha = 0.35 + 0.65 * z;

      const glow = ctx.createRadialGradient(m.sx, m.sy, 0, m.sx, m.sy, r * 2.6);
      glow.addColorStop(0, theme.glow);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(m.sx, m.sy, r * 2.6, 0, Math.PI * 2);
      ctx.fill();

      if (pulse && (isYou || m.count === maxCount)) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = (1 - pulse) * 0.6 * (0.35 + 0.65 * z);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(m.sx, m.sy, r + pulse * r * 1.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.35 + 0.65 * z;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(m.sx, m.sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(m.sx, m.sy, Math.max(1, r * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    if (!visible) return;
    const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0;
    lastT = now;
    const idle = !dragging && !hovered && !reducedMotion;
    if (idle) {
      yaw -= dt * 0.12;
      dirty = true;
    }
    if (dirty || (!reducedMotion && markers.length)) {
      draw(now);
      dirty = false;
    }
    if (idle || dirty || !reducedMotion) raf = requestAnimationFrame(frame);
  }
  const wake = () => {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  };

  // Pointer interaction: horizontal drag rotates, vertical scroll still scrolls
  // on touch (touch-action: pan-y in CSS).
  const markerAt = (px, py) => {
    let best = null;
    let bestD = Infinity;
    for (const m of markers) {
      if (m.z <= 0) continue;
      const d = Math.hypot(m.sx - px, m.sy - py);
      if (d < Math.max(14, m.r + 6) && d < bestD) { bestD = d; best = m; }
    }
    return best;
  };
  const showTip = (m) => {
    if (!m) { tip.classList.remove("is-visible"); return; }
    const share = totalCount ? Math.round((m.count / totalCount) * 100) : 0;
    tip.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = `${opts.flagFor(m.code)} ${opts.countryName(m.code)}`;
    const span = document.createElement("span");
    span.textContent = `${m.count.toLocaleString()} ${m.count === 1 ? "visit" : "visits"} · ${share}%` + (m.code === opts.you ? " · you" : "");
    tip.append(strong, span);
    tip.style.left = `${m.sx}px`;
    tip.style.top = `${m.sy - m.r}px`;
    tip.classList.add("is-visible");
  };
  const local = (e) => {
    const b = canvas.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    [lastX, lastY] = local(e);
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-dragging");
  });
  canvas.addEventListener("pointermove", (e) => {
    const [x, y] = local(e);
    if (dragging) {
      yaw -= (x - lastX) * (0.9 / (size / 2 || 1));
      pitch = clamp(pitch + (y - lastY) * (0.9 / (size / 2 || 1)), -1.1, 1.1);
      lastX = x; lastY = y;
      dirty = true;
      wake();
      return;
    }
    const m = markerAt(x, y);
    if (m !== hovered) {
      hovered = m;
      showTip(m);
      canvas.style.cursor = m ? "pointer" : "";
      dirty = true;
      wake();
    }
  });
  const release = () => {
    dragging = false;
    canvas.classList.remove("is-dragging");
    wake();
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("pointerleave", () => {
    if (!dragging && hovered) { hovered = null; showTip(null); canvas.style.cursor = ""; dirty = true; wake(); }
  });
  canvas.addEventListener("keydown", (e) => {
    const step = 0.12;
    if (e.key === "ArrowLeft") yaw += step;
    else if (e.key === "ArrowRight") yaw -= step;
    else if (e.key === "ArrowUp") pitch = clamp(pitch - step, -1.1, 1.1);
    else if (e.key === "ArrowDown") pitch = clamp(pitch + step, -1.1, 1.1);
    else return;
    e.preventDefault();
    dirty = true;
    wake();
  });

  // Only animate while on screen.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((en) => en.isIntersecting);
      lastT = 0;
      if (visible) wake();
    }, { threshold: 0.05 }).observe(host);
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(host);
  else window.addEventListener("resize", resize);
  const rethemed = () => { theme = readTheme(host); dirty = true; wake(); };
  new MutationObserver(rethemed).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rethemed);

  resize();
  wake();
  host.dispatchEvent(new CustomEvent("globe:ready", { detail: { markers: markers.length, dots: landCount } }));

  return {
    update(rows) { setRows(rows); dirty = true; wake(); },
    /** Internal state, for tests and debugging. */
    state() { return { visible, animating: !!raf, size, yaw, pitch, markers: markers.length }; },
    /** Screen position of a country's marker, for tests and debugging. */
    markerPosition(code) {
      const m = markers.find((x) => x.code === code);
      return m && m.z > 0 ? { x: m.sx, y: m.sy, r: m.r } : null;
    }
  };
}
