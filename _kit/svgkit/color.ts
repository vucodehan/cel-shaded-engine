const hex = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Mix two hex colours, returning hex (so results can be mixed again). */
export const mixHex = (a: string, b: string, t: number) => {
  const ca = hex(a);
  const cb = hex(b);
  const k = Math.min(1, Math.max(0, t));
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
};

export const rgba = (h: string, a: number) => {
  const [r, g, b] = hex(h);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};

/** "r,g,b" triplet for Glow-style colour props. */
export const rgb3 = (h: string) => hex(h).join(",");

/** Lighten (k > 0) or darken (k < 0) a hex colour. */
export const tone = (h: string, k: number) => (k >= 0 ? mixHex(h, "#ffffff", k) : mixHex(h, "#000000", -k));

/** Sky gradient keys over a day: time of day 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk. */
const KEYS: [number, string, string, string][] = [
  [0.0, "#04060F", "#0A1024", "#141A34"],
  [0.18, "#070B1E", "#161C3A", "#2E2A4A"],
  [0.26, "#1A2850", "#5A5A8A", "#E89A70"],
  [0.32, "#24467E", "#7A92BE", "#F4C796"],
  [0.42, "#2E5A9A", "#7FA6CF", "#EED8B4"],
  [0.5, "#2F64A8", "#86B2DE", "#DCE8F2"],
  [0.6, "#2E5A9A", "#8AAFD6", "#F0DEBE"],
  [0.68, "#2E3E78", "#9A7A94", "#F6B47A"],
  [0.74, "#241E48", "#7A4A6A", "#EE8452"],
  [0.8, "#0E0E2A", "#2A2244", "#5A3448"],
  [0.88, "#05071A", "#10142E", "#1E1E38"],
  [1.0, "#04060F", "#0A1024", "#141A34"],
];

export type SkyPal = { top: string; mid: string; hz: string };

export const skyAt = (tod: number): SkyPal => {
  const t = ((tod % 1) + 1) % 1;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] < t) i++;
  const [t0, a1, a2, a3] = KEYS[i];
  const [t1, b1, b2, b3] = KEYS[i + 1];
  const k = (t - t0) / (t1 - t0);
  return { top: mixHex(a1, b1, k), mid: mixHex(a2, b2, k), hz: mixHex(a3, b3, k) };
};

/** Storm-darken a palette (0..1). */
export const stormy = (p: SkyPal, s: number): SkyPal => ({
  top: mixHex(p.top, "#0E1016", s * 0.85),
  mid: mixHex(p.mid, "#262A34", s * 0.85),
  hz: mixHex(p.hz, "#3A3E46", s * 0.8),
});

/** 1 at noon, 0 at dawn/dusk and through the night. */
export const dayness = (tod: number) => Math.max(0, Math.sin(2 * Math.PI * (tod - 0.25)));
/** 1 at midnight, 0 from dawn to dusk. */
export const nightness = (tod: number) => Math.max(0, -Math.sin(2 * Math.PI * (tod - 0.25)));

/** Rim-light colour for the time of day (warm low sun, white noon, blue moonlight). */
export const rimAt = (tod: number) => {
  const d = dayness(tod);
  const n = nightness(tod);
  if (n > 0.25) return "170,192,255";
  const low = 1 - d;
  return low > 0.55 ? "255,176,112" : "255,224,170";
};
