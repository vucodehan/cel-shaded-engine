/**
 * Colour helpers: sRGB hex for three.js (srgb), canvas and CSS gradients, mixing, and curated brand palettes.
 */
import * as THREE from "three";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const hexRgb = (hex: string): [number, number, number] => {
  let h = hex.trim().replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

export const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/**
 * A display (sRGB) hex colour as a three.js material colour. Correct whether or not THREE.ColorManagement is
 * enabled (the kit's cel engine turns it off for the whole bundle, after which `new THREE.Color(hex)` renders too
 * light). Use it for every material colour.
 */
export const srgb = (hex: string): THREE.Color => {
  const [r, g, b] = hexRgb(hex);
  return new THREE.Color().setRGB(toLinear(r / 255), toLinear(g / 255), toLinear(b / 255), THREE.LinearSRGBColorSpace);
};

/** CSS rgba() string from a hex colour. */
export const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${clamp01(a)})`;
};

/** Mix two hex colours (t = 0 -> a, 1 -> b), in display space by default or in linear light. */
export const mix = (a: string, b: string, t: number, linearLight = false) => {
  const A = hexRgb(a), B = hexRgb(b);
  if (!linearLight) return rgbHex(...(A.map((v, i) => v + (B[i] - v) * t) as [number, number, number]));
  const out = A.map((v, i) => {
    const la = toLinear(v / 255), lb = toLinear(B[i] / 255);
    return toSrgb(la + (lb - la) * t) * 255;
  });
  return rgbHex(out[0], out[1], out[2]);
};
/** k > 0 towards white, k < 0 towards black. */
export const shade = (hex: string, k: number) => (k >= 0 ? mix(hex, "#ffffff", k) : mix(hex, "#000000", -k));
/** WCAG relative luminance, 0..1. */
export const luminance = (hex: string) => {
  const [r, g, b] = hexRgb(hex).map((v) => toLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Readable ink on a fill. */
export const onColor = (fill: string, dark = "#0b0b0c", light = "#ffffff") => (luminance(fill) > 0.42 ? dark : light);

/** Gradient stops: plain colours spread evenly, or [offset, colour] pairs. */
export type Stops = (string | [number, string])[];
const addStops = (g: CanvasGradient, stops: Stops) =>
  stops.forEach((s, i) => (Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(stops.length < 2 ? 0 : i / (stops.length - 1), s)));

type Ctx = CanvasRenderingContext2D;
export const linear = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Stops) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  addStops(g, stops);
  return g;
};
/** CSS-style angle over a box: 180 = top to bottom (the default), 90 = left to right, 135 = top-left to bottom-right. */
export const linearAngle = (ctx: Ctx, x: number, y: number, w: number, h: number, angle: number, stops: Stops) => {
  const a = ((angle - 90) * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = x + w / 2, cy = y + h / 2;
  return linear(ctx, cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half, stops);
};
export const radial = (ctx: Ctx, cx: number, cy: number, r: number, stops: Stops, r0 = 0) => {
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, Math.max(r, r0 + 0.001));
  addStops(g, stops);
  return g;
};
const cssStops = (stops: Stops) =>
  stops.map((s, i) => (Array.isArray(s) ? `${s[1]} ${s[0] * 100}%` : `${s} ${stops.length < 2 ? 0 : (i / (stops.length - 1)) * 100}%`)).join(", ");
export const cssLinear = (angle: number, stops: Stops) => `linear-gradient(${angle}deg, ${cssStops(stops)})`;
export const cssRadial = (x: string, y: string, size: string, stops: Stops) => `radial-gradient(${size} at ${x} ${y}, ${cssStops(stops)})`;

export type Palette = {
  name: string;
  /** page / card background and its ink */
  bg: string; ink: string; sub: string; line: string; card: string;
  /** brand accents, strongest first */
  accent: string; accent2: string; accent3: string;
  /** a pale tint of the accent for washes and backgrounds */
  soft: string;
  /** wallpaper stops (top to bottom) */
  wall: string[];
  mascot: string; mascotEye: string;
  ok: string; warn: string; bad: string;
  dark: boolean;
};

const base = { bg: "#ffffff", ink: "#0b0b0c", sub: "#6e6e73", line: "#e5e5ea", card: "#ffffff", mascotEye: "#ffffff", ok: "#34c759", warn: "#ff9f0a", bad: "#ff3b30", dark: false };

/** Curated palettes (original). Light ones sit on white; `night` is dark. */
export const PALETTES = {
  citrus: { ...base, name: "citrus", accent: "#ff7a1a", accent2: "#ffb800", accent3: "#ff4d2e", soft: "#fff3e6", wall: ["#ffe2bd", "#ffae62", "#ff7633"], mascot: "#ff8a1f" },
  ocean: { ...base, name: "ocean", accent: "#2c6bff", accent2: "#3fc8ff", accent3: "#6a4bff", soft: "#edf4ff", wall: ["#d4ecff", "#7fbfff", "#3e6cff"], mascot: "#2f7bff" },
  mint: { ...base, name: "mint", accent: "#00a97f", accent2: "#5fe0b5", accent3: "#0b7f70", soft: "#e8f9f2", wall: ["#dcfbea", "#80e6c1", "#12b08d"], mascot: "#13c08f" },
  berry: { ...base, name: "berry", accent: "#ff3b7a", accent2: "#ff9cc2", accent3: "#9b3cff", soft: "#fff0f5", wall: ["#ffd8e7", "#ff80b2", "#c24eff"], mascot: "#ff4f8b" },
  violet: { ...base, name: "violet", accent: "#6d4dff", accent2: "#b3a3ff", accent3: "#ff5fc8", soft: "#f2efff", wall: ["#e3ddff", "#a18cff", "#5c3ef5"], mascot: "#7457ff" },
  night: { ...base, name: "night", bg: "#08080a", ink: "#f5f5f7", sub: "#8e8e93", line: "#2c2c2e", card: "#1c1c1e", accent: "#8c7bff", accent2: "#43d1ff", accent3: "#ff6ad5", soft: "#16161c", wall: ["#2d2556", "#1b2150", "#0c0f26"], mascot: "#8c7bff", dark: true },
} satisfies Record<string, Palette>;
export type PaletteName = keyof typeof PALETTES;
