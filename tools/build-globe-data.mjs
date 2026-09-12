/**
 * Builds assets/js/globe-data.js for the visitor globe.
 *
 *   npm install world-atlas@2 topojson-client@3 i18n-iso-countries
 *   node tools/build-globe-data.mjs
 *
 * Land is sampled on an equal-area grid (STEP degrees of latitude, longitude
 * spacing widened by 1/cos(lat)) against Natural Earth 1:50m land polygons and
 * stored as one bit per sample. Country markers use the centroid of each
 * country's largest polygon (Natural Earth 1:50m), keyed by ISO 3166-1 alpha-2.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { feature } = require("topojson-client");
const iso = require("i18n-iso-countries");
const land = require("world-atlas/land-50m.json");
const countries = require("world-atlas/countries-50m.json");

const STEP = 1.5;
const OUT = process.argv[2] || "globe-data.js";

// ---- land bitmask ---------------------------------------------------------
const landFc = feature(land, land.objects.land);
const rings = [];
for (const f of landFc.features) {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) for (const ring of poly) rings.push(ring);
}
const edges = [];
for (const ring of rings) for (let i = 0; i < ring.length - 1; i++) edges.push([ring[i], ring[i + 1]]);

const bands = [];
const bits = [];
for (let lat = -90 + STEP / 2; lat < 90; lat += STEP) {
  const n = Math.max(1, Math.round((360 / STEP) * Math.cos((lat * Math.PI) / 180)));
  // longitudes where a polygon edge crosses this latitude
  const xs = [];
  for (const [[x1, y1], [x2, y2]] of edges) {
    if ((y1 > lat) !== (y2 > lat)) xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
  }
  xs.sort((a, b) => a - b);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const lon = -180 + ((i + 0.5) * 360) / n;
    // even-odd rule: odd number of crossings to the west => inside land
    let lo = 0, hi = xs.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (xs[mid] < lon) lo = mid + 1; else hi = mid; }
    const inside = (lo & 1) === 1;
    bits.push(inside ? 1 : 0);
    if (inside) count++;
  }
  bands.push(n);
}
const bytes = new Uint8Array(Math.ceil(bits.length / 8));
bits.forEach((b, i) => { if (b) bytes[i >> 3] |= 1 << (i & 7); });
const landB64 = Buffer.from(bytes).toString("base64");
const landDots = bits.reduce((a, b) => a + b, 0);

// ---- country centroids ----------------------------------------------------
const cFc = feature(countries, countries.objects.countries);
const centroids = {};
const areas = {};
// Longitudes made continuous along the ring so a polygon that crosses the
// antimeridian (Russia, Fiji) does not fold back on itself.
const unwrap = (ring) => {
  const out = [];
  let prev = ring[0][0];
  let shift = 0;
  for (const [x, y] of ring) {
    if (x + shift - prev > 180) shift -= 360;
    else if (x + shift - prev < -180) shift += 360;
    prev = x + shift;
    out.push([prev, y]);
  }
  return out;
};
const ringArea = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  const meanLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return Math.abs(a / 2) * Math.cos((meanLat * Math.PI) / 180);
};
for (const f of cFc.features) {
  const a2 = iso.numericToAlpha2(String(f.id).padStart(3, "0"));
  if (!a2) continue;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let best = null, bestArea = -1;
  for (const poly of polys) {
    const ring = unwrap(poly[0]);
    const ar = ringArea(ring);
    if (ar > bestArea) { bestArea = ar; best = ring; }
  }
  // Several Natural Earth features can share one ISO code (Australia and
  // Ashmore and Cartier Islands are both 036): keep the largest.
  if (areas[a2] !== undefined && areas[a2] >= bestArea) continue;
  areas[a2] = bestArea;
  let sx = 0, sy = 0, sa = 0;
  for (let i = 0; i < best.length - 1; i++) {
    const [x0, y0] = best[i], [x1, y1] = best[i + 1];
    const cross = x0 * y1 - x1 * y0;
    sa += cross; sx += (x0 + x1) * cross; sy += (y0 + y1) * cross;
  }
  let lon, lat;
  if (Math.abs(sa) > 1e-9) { lon = sx / (3 * sa); lat = sy / (3 * sa); }
  else { lon = best.reduce((s, p) => s + p[0], 0) / best.length; lat = best.reduce((s, p) => s + p[1], 0) / best.length; }
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  centroids[a2] = [Math.round(lat * 10) / 10, Math.round(lon * 10) / 10];
}
// Territories and microstates that 1:50m omits or that i18n maps oddly.
Object.assign(centroids, {
  SG: [1.35, 103.8], MT: [35.9, 14.4], BH: [26.1, 50.5], MV: [3.2, 73.2], MC: [43.7, 7.4],
  LI: [47.1, 9.5], SM: [43.9, 12.5], VA: [41.9, 12.5], AD: [42.5, 1.5], HK: [22.3, 114.2],
  MO: [22.2, 113.5], GI: [36.1, -5.35], BM: [32.3, -64.8], KY: [19.3, -81.3], AW: [12.5, -70.0],
  CW: [12.2, -69.0], SX: [18.0, -63.1], BB: [13.2, -59.5], LC: [13.9, -61.0], GD: [12.1, -61.7],
  VC: [13.3, -61.2], AG: [17.1, -61.8], KN: [17.3, -62.7], DM: [15.4, -61.4], MU: [-20.3, 57.6],
  SC: [-4.7, 55.5], KM: [-11.7, 43.3], ST: [0.2, 6.6], CV: [16.0, -24.0], TO: [-21.2, -175.2],
  WS: [-13.8, -172.1], FM: [6.9, 158.2], PW: [7.5, 134.6], MH: [7.1, 171.4], KI: [1.9, -157.4],
  NR: [-0.5, 166.9], TV: [-8.5, 179.2], JE: [49.2, -2.1], GG: [49.5, -2.6], IM: [54.2, -4.5],
  FO: [62.0, -6.8], RE: [-21.1, 55.5], MQ: [14.6, -61.0], GP: [16.2, -61.6], GU: [13.4, 144.8],
  PR: [18.2, -66.5], VI: [18.3, -64.9], XK: [42.6, 20.9]
});
for (const k of Object.keys(centroids)) if (!/^[A-Z]{2}$/.test(k)) delete centroids[k];

const sorted = Object.fromEntries(Object.keys(centroids).sort().map((k) => [k, centroids[k]]));
const js = `// Generated by tools/build-globe-data.mjs from Natural Earth (public domain)
// via world-atlas. Do not edit by hand; re-run the script instead.
export const LAND_STEP = ${STEP};
export const LAND_BANDS = [${bands.join(",")}];
export const LAND_BITS = "${landB64}";
export const CENTROIDS = ${JSON.stringify(sorted)};
`;
fs.writeFileSync(OUT, js);
console.log(`samples=${bits.length} landDots=${landDots} bands=${bands.length} countries=${Object.keys(sorted).length} bytes=${js.length}`);
